const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;
var jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.PAYMENT_SK);

app.use(cors());
app.use(express.json());

// token verify middleware
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    req.decoded = decoded;
    next();
  })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ze0g6j8.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10
});

async function run() {
  try {
    const database = client.db('mastery-karate-db');
    const classes = database.collection('classes');
    const users = database.collection('users');
    // verify Instructor middleware 
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await users.findOne({email: email});
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }
    // verify Admin middleware 
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await users.findOne({email: email});
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }
    // get all users
    app.get('/instructors', async (req, res) => {
      const result = await users.find({ role: "instructor" }).toArray();
      res.send(result)
    })
    // find user role
    app.get('/role/:email',verifyJWT, async (req, res) => {
      const email = req.params.email;
      const user = await users.findOne({ email: email });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const { role } = user;
      res.send({ role })
    })
    // get instructor classes
    app.get('/classes/:email', verifyJWT, verifyInstructor, async (req, res) => {
      const email = req.params.email;
      const result = await classes.find({ instructor_email: email }).toArray();
      res.send(result);
    })
    // get approved classes
    app.get('/allclass/:status', async (req, res) => {
      const status = req.params.status;
      if (status === 'all') {
        const result = await classes.find().toArray();
        res.send(result)
      }
      else {
        const result = await classes.find({ status: status }).toArray();
        res.send(result)
      }
    })
    // get all users
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await users.find().toArray();
      res.send(result);
    })
    // get specific user 
    app.get('/users/:email',verifyJWT, async (req, res) => {
      const result = await users.findOne({email: req.params.email});
      res.send(result);
    })
    // get specific class by id
    app.get('/selected-classes/:id',verifyJWT, async (req,res) => {
      const id = req.params.id;
      const singleClass = await classes.findOne({_id: new ObjectId(id)});
      const {price} = singleClass;
      res.send({price})
    })
    // send jwt token
    app.post('/jwt', (req, res) => {
      const email = req.body.email;
      const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
      res.send({ token });
    })
    // saved user when first time registration
    app.post('/users', async (req, res) => {
      const user = req.body;
      const existingUser = await users.findOne({ email: user.email });
      if (existingUser) {
        return res.send({ message: 'user already registered' })
      }
      else {
        const result = await users.insertOne(user);
        res.send(result)
      }
    })
    // add class 
    app.post('/classes', verifyJWT, verifyInstructor, async (req, res) => {
      const newClass = req.body;
      const result = await classes.insertOne(newClass);
      res.send(result)
    })
    // process payment intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const {price} = req.body;
      if(!price){
        return res.send({message: 'Price not valid'})
      }
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })
    // update class status
    app.patch('/allclass/:id', async (req, res) => {
      const id = req.params.id;
      const { text } = req.body;
      if (text === 'denied' || text === 'approved') {
        const updatedClass = {
          $set: {
            status: text,
          }
        }
        const result = await classes.updateOne({ _id: new ObjectId(id) }, updatedClass);
        res.send(result)
      }
      else {
        const updatedClass = {
          $set: {
            feedback: text,
          }
        }
        const result = await classes.updateOne({ _id: new ObjectId(id) }, updatedClass);
        res.send(result)
      }

    })
    // update user role
    app.put('/users/:id', async (req, res) => {
      const id = req.params.id;
      const { roleText } = req.body;
      if (roleText === 'instructor') {
        const updatedUser = {
          $set: {
            role: roleText,
            total_student: 0,
            number_of_classes: 0,
            name_of_classes: []
          }
        }
        const result = await users.updateOne({ _id: new ObjectId(id) }, updatedUser);
        res.send(result)
      }
      else {
        const updatedUser = {
          $set: {
            role: roleText,
          }
        }
        const result = await users.updateOne({ _id: new ObjectId(id) }, updatedUser);
        res.send(result)
      }
    })
    // select class by user
    app.put('/select-class', async (req, res) => {
      const info = req.query;
      const instructor = await users.findOne({email: info.inst});
      const student = await users.findOne({email: info.user});
      const selectedClass = await classes.findOne({_id: new ObjectId(info.classid)});
      const updatedInst = {
        $set:{
          total_student : parseInt(instructor.total_student)+1,
        }
      }
      const updateInst = await users.updateOne({email: info.inst}, updatedInst);
      const updatedStudent = {
        $set:{
          selectedClasses : student.selectedClasses ? [...student?.selectedClasses, info.classid] : [info.classid],
        }
      }
      const updateStudent = await users.updateOne({email: info.user}, updatedStudent);
      const updatedClass = {
        $set: {
          available_seats: parseInt(selectedClass?.available_seats) - 1,
          number_of_students : parseInt(selectedClass.number_of_students)+1,
        }
      }
      const updateClass = await classes.updateOne({_id: new ObjectId(info.classid)}, updatedClass);
      res.send({updateInst, updateStudent, updateClass})
    })
    // update after delete selected classes
    app.put('/selected-classes/:email', verifyJWT, async(req, res)=>{
      const newSelectedClasses = req.body;
      const email = req.params.email;
      const updatedStudent = {
        $set: {
          selectedClasses: newSelectedClasses,
        }
      }
      const result = await users.updateOne({email: email}, updatedStudent);
      res.send(result)
    })
    // update instructor details when add new class
    app.put('/instructors/:email', async(req, res)=>{
      const email = req.params.email;
      const {name} = req.body;
      const instructor = await users.findOne({email: email});
      const updatedInfo = {
        $set:{
          name_of_classes: [...instructor.name_of_classes, name],
          number_of_classes: parseInt(instructor.number_of_classes) + 1,
        }
      }
      const result = await users.updateOne({email: email}, updatedInfo);
      res.send(result);
    })
    // user delete
    app.delete('/users/:id', async (req, res) => {
      const result = await users.deleteOne({ _id: new ObjectId(req.params.id) })
      res.send(result);
    })
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Server is listening');
})
app.listen(port, (req, res) => {
  console.log(`listening on ${port}`);
})