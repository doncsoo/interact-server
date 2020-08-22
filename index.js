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

async function queryDatabaseSimple(response,query)
{
  await pool.connect()
     .then(client => {
      return client
        .query(query)
        .then(r => {
          client.release();
          console.log(r.rows);
          response.status(200).send(r.rows);
        })
        .catch(err => {
          client.release();
          console.log(err.stack);
          response.status(500).send("ERROR");
        })
    });
}

async function queryDatabaseParameters(response,query,parameters)
{
  await pool.connect()
     .then(client => {
      return client
        .query(query,parameters)
        .then(r => {
          client.release()
          console.log(r.rows);
          response.status(200).send(r.rows);
        })
        .catch(err => {
          client.release()
          console.log(err.stack)
          response.status(500).send("ERROR");
        })
    })
}

async function queryDatabaseUpdateInsert(response,query,parameters)
{
  await pool.connect()
     .then(client => {
      return client
        .query(query,parameters)
        .then(r => {
          client.release();
          console.log(r.rows);
          response.status(201).send("OK");
        })
        .catch(err => {
          client.release();
          console.log(err.stack);
          response.status(500).send("ERROR");
        })
    });
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
  //Invalid body, rejecting request
  if(req.body === {}) res.status(400).send("Empty request body. Cancelling request.");
  video_name = video_data.name;
  video_desc = video_data.desc;
  video_treeid = video_data.treeid;
  video_owner = video_data.owner;
  video_preview_id = video_data.preview_id;
  
  await queryDatabaseUpdateInsert(res,'INSERT INTO videos (id,name,description,tree_id,owner,preview_id) VALUES ((SELECT COUNT(*) + 1 FROM videos),$1,$2,$3,$4,$5)',
    [video_name,video_desc,video_treeid,video_owner,video_preview_id]);
  
});

app.get('/get-video/:id', async function(req,res) {
    await queryDatabaseParameters(res,'SELECT * FROM videos WHERE id = $1',[req.params.id]);
});

app.get('/get-videos/:owner', async function(req,res){
  if(req.params.owner == "all")
  {
    await queryDatabaseSimple(res, 'SELECT * FROM videos');
  }
  else
  {
    await queryDatabaseParameters(res, 'SELECT * FROM videos WHERE owner = $1', [req.params.owner]);
  }
});

app.get('/get-fav-videos/:owner', async function(req,res){
    await queryDatabaseParameters(res,'SELECT likes FROM likes_data WHERE username = $1',[req.params.owner]);
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

app.post('/like/:action', async function(req, res){

  like_data = req.body;
  if(req.body == {}) res.status(400).send("Empty request body. Cancelling request.");
  username = verifyUser(like_data.token);
  video_id = like_data.video_id;
  //if invalid token
  if(!username) res.status(403).send("ERROR")

  if(req.params.action == "add")
  {
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
    queryDatabaseUpdateInsert(res,'UPDATE videos SET likes = likes + 1 WHERE id = $1;',[video_id]);
  }
  else if(req.params.action == "remove")
  {
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
    queryDatabaseUpdateInsert(res,'UPDATE videos SET likes = likes - 1 WHERE id = $1;',[video_id]);
  }

});

function addToken(tokenobj)
{
  token_data.tokens.push(tokenobj)
  fs.writeFile('tokendata.json', JSON.stringify(token_data), function() {console.log("stored")});
}

app.post('/user-verify', async function(req, res){
  user_data = req.body;
  console.log(req.body);
  if(req.body === {}) res.status(400).send("Empty request body. Cancelling request.");
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
              res.status(401).json({verified: false, error: "This following user doesn't exist"})
            }
            else if(password == r.rows[0].password)
            {
              let gen_token = Math.floor(Math.random() * (9999999999) + 1000000000);
              addToken({username: username, token: gen_token});
              res.json({verified: true, token: gen_token})
            }
            else res.status(401).json({verified: false, error: "Invalid password"})
          })
          .catch(err => {
            console.log(err.stack)
          })
      })
  
});

app.post('/register', async function(req, res){
  user_data = req.body;
  console.log(req.body);
  if(req.body === {}) res.status(400).send("Empty request body. Cancelling request.");
  username = user_data.username;
  password = user_data.password;
  fullname = user_data.fullname;
  user_id = null;
  //inserting new row
  await pool.connect()
       .then(client => {
        return client
          .query('INSERT INTO users (id,username,password,fullname,isadmin) VALUES ((SELECT COUNT(*) FROM users),$1,$2,$3,FALSE)',
          [username,password,fullname])
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
  queryDatabaseUpdateInsert(res,'INSERT INTO likes_data (username) VALUES ($1)',[username]);
  
});

app.listen(process.env.PORT || 3000);