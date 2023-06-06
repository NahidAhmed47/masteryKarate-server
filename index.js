const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res)=>{
    res.send('Server is listening');
})
app.listen(port, (req, res)=>{
    console.log(`listening on ${port}`);
})