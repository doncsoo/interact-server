const express = require('express')
const aws = require('aws-sdk');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { Client, Pool } = require('pg');
const extractFrames = require('ffmpeg-extract-frames');
var app = express()

app.use(cors())

app.use(bodyParser.json())

const fs = require('fs');
const token_data = require('./tokendata.json')

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

app.get('/', function(req, res){
    res.redirect('http://interact-client.herokuapp.com/')
 });

 function verifyUser(recv_token)
{
  let tokens = token_data.tokens;
  for(let i = 0; i < tokens.length; i++)
  {
    if(tokens[i].token == recv_token) return tokens[i].username;
  }

  return null;
}

async function queryDatabaseSimple(query)
{
  await pool.connect()
     .then(client => {
      return client
        .query(query)
        .then(r => {
          client.release();
          return r.rows;
        })
        .catch(err => {
          client.release();
          console.log(err.stack);
          return "error";
        })
    });
}

async function queryDatabaseParameters(query,parameters)
{
  await pool.connect()
     .then(client => {
      return client
        .query(query,parameters)
        .then(r => {
          client.release()
          return r.rows;
        })
        .catch(err => {
          client.release()
          console.log(err.stack)
          return "error";
        })
    })
}

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
  video_owner = video_data.owner;
  video_preview_id = video_data.preview_id;
  //inserting new row
  await pool.connect()
       .then(client => {
        return client
          .query('INSERT INTO videos (id,name,description,tree_id,owner,preview_id) VALUES ((SELECT COUNT(*) + 1 FROM videos),$1,$2,$3,$4,$5)',[video_name,video_desc,video_treeid,video_owner,video_preview_id])
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

app.get('/get-video/:id', async function(req,res) {
    await pool.connect()
     .then(client => {
      return client
        .query('SELECT * FROM videos WHERE id = $1',[req.params.id])
        .then(r => {
          client.release()
          res.send(r.rows[0])
        })
        .catch(err => {
          client.release()
          console.log(err.stack)
        })
    })
  
});

app.get('/get-videos/:owner', async function(req,res){
  if(req.params.owner == "all")
  {
    let rows = await queryDatabaseSimple('SELECT * FROM videos');
    res.send(rows);
  }
  else
  {
    let rows = await queryDatabaseParameters('SELECT * FROM videos WHERE owner = $1',[req.params.owner]);
    res.send(rows);
  }
});

app.get('/get-fav-videos/:owner', async function(req,res){
  //check if likes are not empty array
  await pool.connect()
  .then(client => {
   return client
     .query('SELECT likes FROM likes_data WHERE username = $1',[req.params.owner])
     .then(r => {
       client.release()
       res.send(r.rows[0])
     })
     .catch(err => {
       console.log(err.stack)
     })
 })
});

app.get('/get-preview/:id', async function(req,res){
  let link = "https://interact-videos.s3.eu-central-1.amazonaws.com/" + req.params.id;
  await extractFrames({
    input: link,
    output: './preview-%i.png',
    offsets: [2000]
  })
  res.sendFile(path.join(__dirname,'/preview-1.png'))
  fs.unlink('./preview-1.png')
});

app.post('/interaction-addlike', async function(req, res){

  like_data = req.body;
  if(req.body == {}) res.status(400).send("Empty request body. Cancelling request.");
  username = verifyUser(like_data.token);
  video_id = like_data.video_id;
  //if invalid token
  if(!username) res.send("ERROR")
  //adding like
  await pool.connect()
       .then(client => {
        return client
          .query('UPDATE likes_data SET likes = array_append(likes, $2) WHERE username = $1;',[username,video_id])
          .then(r => {
            client.release()
          })
          .catch(err => {
            console.log(err.stack)
            res.send("ERROR")
            return;
          })
      })
  await pool.connect()
      .then(client => {
       return client
         .query('UPDATE videos SET likes = likes + 1 WHERE id = $1;',[video_id])
         .then(r => {
           client.release()
           res.send("OK")
         })
         .catch(err => {
           console.log(err.stack)
           res.send("ERROR")
         })
     })
  
});

app.post('/interaction-removelike', async function(req, res){

  like_data = req.body;
  if(req.body == {}) res.status(400).send("Empty request body. Cancelling request.");
  username = verifyUser(like_data.token);
  video_id = like_data.video_id;
  //if invalid token
  if(!username) res.send("ERROR")
  //adding like
  await pool.connect()
       .then(client => {
        return client
          .query('UPDATE likes_data SET likes = array_remove(likes, $2) WHERE username = $1;',[username,video_id])
          .then(r => {
            client.release()
          })
          .catch(err => {
            console.log(err.stack)
            res.send("ERROR")
            return;
          })
      })
  await pool.connect()
      .then(client => {
       return client
         .query('UPDATE videos SET likes = likes - 1 WHERE id = $1;',[video_id])
         .then(r => {
           client.release()
           res.send("OK")
         })
         .catch(err => {
           console.log(err.stack)
           res.send("ERROR")
         })
     })
  
});

function addToken(tokenobj)
{
  token_data.tokens.push(tokenobj)
  fs.writeFile('tokendata.json', JSON.stringify(token_data), function() {console.log("stored")});
}

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
            if(r.rows.length == 0)
            {
              res.json({verified: false, error: "This following user doesn't exist"})
            }
            else if(password == r.rows[0].password)
            {
              let gen_token = Math.floor(Math.random() * (9999999999) + 1000000000);
              addToken({username: username, token: gen_token});
              res.json({verified: true, token: gen_token})
            }
            else res.json({verified: false, error: "Invalid password"})
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
          })
          .catch(err => {
            client.release()
            console.log(err.stack)
            if(err.code === "23505") res.send("Error: This username already exists")
            else res.send("An unknown error occurred")
            return;
          })
      })
  //inserting new row in likes_data
  await pool.connect()
       .then(client => {
        return client
          .query('INSERT INTO likes_data (username) VALUES ($1)',[username])
          .then(r => {
            client.release()
            res.send("Registration successful!")
          })
          .catch(err => {
            client.release()
            console.log(err.stack)
            res.send("An unknown error occurred")
          })
      })
  
});

app.listen(process.env.PORT || 3000);