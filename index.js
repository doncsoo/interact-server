const express = require('express')
const aws = require('aws-sdk');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Client, Pool } = require('pg');
var app = express()

app.use(cors())

app.use(bodyParser.json())

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

app.get('/', function(req, res){
    res.redirect('http://interact-client.herokuapp.com/')
 });

app.get('/upload-verify', (req, res) => {
  const s3 = new aws.S3({region:"eu-central-1"});
  const fileName = req.query['file-name'];
  const fileType = req.query['file-type'];
  var s3Params = {
    Bucket: process.env.S3_BUCKET,
    Key: fileName,
    Expires: 60,
    ContentType: fileType,
    ACL: 'public-read'
  };

  s3.getSignedUrl('putObject', s3Params, (err, data) => {
    if(err){
      console.log(err);
      return res.send("Upload failed");
    }
    console.log(data)
    const returnData = {
      signedRequest: data,
      url: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${fileName}`
    };
    res.send(returnData);
  });
});

app.post('/insert-video', async function(req, res){
  video_data = req.body;
  console.log(req.body);
  if(req.body == {}) res.status(400).send("Empty request body. Cancelling request.");
  video_name = video_data.name;
  video_desc = video_data.desc;
  video_treeid = video_data.treeid;
  video_id = null;
  //generating url based on row count
  await pool.connect()
       .then(client => {
        return client
          .query('SELECT COUNT(*) FROM videos')
          .then(r => {
            client.release()
            video_id = r.rows[0].count;
          })
          .catch(err => {
            client.release()
            console.log(err.stack)
          })
      })
  //inserting new row
  await pool.connect()
       .then(client => {
        return client
          .query('INSERT INTO videos (id,name,description,tree_id,owner,preview_id) VALUES ($1,$2,$3,$4,$5,$6)',[video_id,video_name,video_desc,video_treeid,video_owner,video_preview_id])
          .then(r => {
            client.release()
            res.send("Video upload succeeded")
          })
          .catch(err => {
            client.release()
            console.log(err.stack)
          })
      })
  
});

app.get('/get-videos', async function(req,res){
  await pool.connect()
     .then(client => {
      return client
        .query('SELECT * FROM videos')
        .then(r => {
          client.release()
          res.send(r.rows)
        })
        .catch(err => {
          client.release()
          console.log(err.stack)
        })
    })
});

app.post('/user-verify', async function(req, res){
  user_data = req.body;
  console.log(req.body);
  if(req.body == {}) res.status(400).send("Empty request body. Cancelling request.");
  username = user_data.username;
  password = user_data.password;
  //querying password
  await pool.connect()
       .then(client => {
        return client
          .query('SELECT password FROM users WHERE username = $1',[username])
          .then(r => {
            client.release()
            if(password == r.rows[0].password)
            {
              res.send("User verified! Insert token sending stuff here")
            }
            else res.send("Invalid password")
          })
          .catch(err => {
            console.log(err.stack)
          })
      })
  
});

app.post('/register', async function(req, res){
  user_data = req.body;
  console.log(req.body);
  if(req.body == {}) res.status(400).send("Empty request body. Cancelling request.");
  username = user_data.username;
  password = user_data.password;
  fullname = user_data.fullname;
  user_id = null;
  //getting id
  await pool.connect()
       .then(client => {
        return client
          .query('SELECT COUNT(*) FROM users')
          .then(r => {
            client.release()
            user_id = r.rows[0].count;
          })
          .catch(err => {
            client.release()
            console.log(err.stack)
          })
      })
  //inserting new row
  await pool.connect()
       .then(client => {
        return client
          .query('INSERT INTO users (id,username,password,fullname,isadmin) VALUES ($1,$2,$3,$4,FALSE)',[user_id,username,password,fullname])
          .then(r => {
            client.release()
            res.send("Registration successful!")
          })
          .catch(err => {
            client.release()
            console.log(err.stack)
            if(err.code == 23503) res.send("Error: This username already exists")
            else res.send("An unknown error occurred")
          })
      })
  
});

app.listen(process.env.PORT || 3000);