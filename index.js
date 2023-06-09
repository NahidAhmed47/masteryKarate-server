const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ze0g6j8.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const database = client.db('mastery-karate-db');
    const classes = database.collection('classes');
    const users = database.collection('users');

    // app.get('/classes', async(req, res) => {
    //     const result = await classes.find().toArray();
    //     res.send(result);
    // })
    // get all users
    app.get('/instructors', async(req, res) => {
      const result = await users.find({role:"instructor"}).toArray();
      res.send(result)
    })
    // find user role
    app.get('/role/:email', async(req, res) => {
      const email = req.params.email;
      const user = await users.findOne({email: email});
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const {role} = user;
      res.send({role})
    })
    // get instructor classes
    app.get('/classes/:email', async(req, res) => {
      const email = req.params.email;
      const result = await classes.find({instructor_email: email}).toArray();
      res.send(result);
    })
    // get approved classes
    app.get('/allclass/:status', async(req, res) => {
      const status = req.params.status;
      if(status === 'all'){
        const result = await classes.find().toArray();
        res.send(result)
      }
      else{
        const result = await classes.find({status: status}).toArray();
      res.send(result)
      }
    })
    // get all users
    app.get('/users', async(req, res) => {
      const result = await users.find().toArray();
      res.send(result);
    })
    // saved user when first time registration
    app.post('/users', async(req, res) => {
      const user = req.body;
      const existingUser = await users.findOne({email: user.email});
      if(existingUser){
        return res.send({message: 'user already registered'})
      }
      else{
        const result = await users.insertOne(user);
        res.send(result)
      }
    })
    // add class 
    app.post('/classes', async(req, res) => {
      const newClass = req.body;
      console.log(newClass)
      const result = await classes.insertOne(newClass);
      res.send(result)
    })
    // update class status
    app.patch('/allclass/:id', async(req, res) => {
      const id = req.params.id;
      const {text} = req.body;
      if(text === 'denied' || text === 'approved'){
        const updatedClass = {
          $set: {
            status: text,
          }
        }
        const result = await classes.updateOne({_id: new ObjectId(id)}, updatedClass);
        res.send(result)
      }
      else{
        const updatedClass = {
          $set: {
            feedback: text,
          }
        }
        const result = await classes.updateOne({_id: new ObjectId(id)}, updatedClass);
        res.send(result)
      }
      
    })
    // update user role
    app.put('/users/:id', async(req, res) => {
      const id = req.params.id;
      const {roleText} = req.body;
      const updatedUser = {
        $set: {
          role: roleText,
        }
      }
      const result = await users.updateOne({_id: new ObjectId(id)}, updatedUser);
      res.send(result)
    })
    // user delete
    app.delete('/users/:id', async(req, res)=>{
      const result = await users.deleteOne({_id: new ObjectId(req.params.id)})
      res.send(result);
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res)=>{
    res.send('Server is listening');
})
app.listen(port, (req, res)=>{
    console.log(`listening on ${port}`);
})