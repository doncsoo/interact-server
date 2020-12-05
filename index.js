const express = require('express');
const aws = require('aws-sdk');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { Pool } = require('pg');
const extractFrames = require('ffmpeg-extract-frames');
var app = express();

app.use(cors());

app.use(bodyParser.json());

const fs = require('fs');
const token_data = require('./tokendata.json');

///TESTING - PLEASE FILL THESE VARIABLES WITH LOCAL DATABASE CREDENTIALS
const test_username = "postgres";
const test_password = "admin";

const pool = new Pool({
    connectionString: !process.env.DATABASE_URL ? "postgresql://" + test_username + ":" + test_password + "@localhost:5432" : process.env.DATABASE_URL
});

//Modify this variable, to set your Amazon S3 bucket's name
const bucket = process.env.S3_BUCKET;

app.get('/', function(req, res){
    res.redirect('http://interact-client.herokuapp.com/');
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

function verifyAdmin(recv_token)
{
  let tokens = token_data.tokens;
  for(let i = 0; i < tokens.length; i++)
  {
    if(tokens[i].token == recv_token) return tokens[i].isadmin;
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
          client.release();
          console.log(r.rows);
          response.status(200).send(r.rows);
        })
        .catch(err => {
          client.release();
          console.log(err.stack);
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
          if(response) response.status(201).send("OK");
        })
        .catch(err => {
          client.release();
          console.log(err.stack);
          if(response) response.status(500).send("ERROR");
          else throw "ERROR";
        })
    });
}

function getUploadLink(req,res,key,type)
{
  const s3 = new aws.S3({region:"eu-central-1"});
  let fileName = req.query['file-name'];
  var s3Params = {
    Bucket: bucket,
    Key: key,
    Expires: 600,
    ContentType: type,
    ACL: 'public-read'
  };

  s3.getSignedUrl('putObject', s3Params, (err, data) => {
    if(err){
      console.log(err);
      return res.status(500).send("Upload failed");
    }
    const returnData = {
      signedRequest: data,
      url: `https://${bucket}.s3.amazonaws.com/${fileName}`
    };
    res.status(200).send(returnData);
  });
}

app.get('/upload-verify', (req, res) => {
  getUploadLink(req,res,req.query['file-name'],"video/mp4");
});

app.get('/upload-verify-image', (req, res) => {
  getUploadLink(req,res,"previews/" + req.query['file-name'],req.query['file-type']);
});

app.put('/content', async function(req, res){
  video_data = req.body;
  //Invalid body, rejecting request
  if(req.body === {}) res.status(400).send("Empty request body. Cancelling request.");
  video_name = video_data.name;
  video_desc = video_data.desc;
  video_owner = verifyUser(video_data.token);
  video_preview_id = video_data.preview_id;
  video_tree = video_data.tree;
  video_prereq = video_data.prereq;

  if(!video_owner)
  {
    res.status(401).send("ERROR");
    return;
  }

  if(!video_name) res.status(400).send("ERROR");
  
  await queryDatabaseUpdateInsert(res,'INSERT INTO videos (id,name,description,owner,preview_id,prerequisite,tree) VALUES ((SELECT MAX(id) + 1 FROM videos),$1,$2,$3,$4,$5,$6)',
    [video_name,video_desc,video_owner,video_preview_id,video_prereq,video_tree]);
  
});

app.post('/content', async function(req, res){
  video_data = req.body;
  //Invalid body, rejecting request
  if(req.body === {}) res.status(400).send("Empty request body. Cancelling request.");
  video_id = video_data.id;
  video_owner = verifyUser(video_data.token);
  video_tree = video_data.tree;
  isadmin = verifyAdmin(video_data.token);

  if(!video_owner)
  {
    res.status(403).send("ERROR");
    return;
  }

  if(!video_tree)
  {
    res.status(400).send("ERROR");
    return;
  }

  await pool.connect()
       .then(client => {
        return client
          .query('SELECT owner FROM videos WHERE id = $1',[video_id])
          .then(r => {
            client.release();
            if(r.rows[0].owner == video_owner || isadmin == true)
            {
              queryDatabaseUpdateInsert(res,'UPDATE videos SET tree = $1 WHERE id = $2',[video_tree,video_id]);
            }
            else
            {
              res.status(403).send("ERROR");
            }
          })
          .catch(err => {
            client.release();
            console.log(err.stack);
            res.status(500).send("ERROR");
            return;
          })
      })
});

app.delete('/content', async function(req,res){
  video_data = req.body;
  //Invalid body, rejecting request
  if(req.body === {}) res.status(400).send("Empty request body. Cancelling request.");
  video_id = video_data.id;
  video_owner = verifyUser(video_data.token);
  isadmin = verifyAdmin(video_data.token);

  if(!video_owner)
  {
    res.status(403).send("ERROR");
    return;
  }

  await pool.connect()
       .then(client => {
        return client
          .query('SELECT owner FROM videos WHERE id = $1',[video_id])
          .then(r => {
            client.release();
            if(r.rows[0].owner == video_owner || isadmin == true)
            {
              queryDatabaseParameters(null,'DELETE FROM videos WHERE id = $1',[video_id]);
              //deleting id from likes_data table
              queryDatabaseUpdateInsert(null,'UPDATE likes_data SET likes = array_remove(likes, $1)',[video_id]);
              //deleting corresponding choices
              queryDatabaseParameters(res,'DELETE FROM choice_data WHERE vidid = $1',[video_id]);
            }
            else
            {
              res.status(403).send("ERROR");
            }
          })
          .catch(err => {
            client.release();
            console.log(err.stack);
            res.status(500).send("ERROR");
            return;
          })
      })
});

app.get('/get-video/:id', async function(req,res) {
    if(!isNaN(req.params.id)) await queryDatabaseParameters(res,'SELECT * FROM videos WHERE id = $1',[req.params.id]);
    else res.status(400).send("ERROR");
});

app.get('/get-tree/:id', async function(req,res) {
    if(!isNaN(req.params.id)) await queryDatabaseParameters(res,'SELECT tree FROM videos WHERE id = $1',[req.params.id]);
    else res.status(400).send("ERROR");
});

app.get('/search-query/:term', async function(req,res) {
    await queryDatabaseParameters(res,"SELECT * FROM videos WHERE name ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%'",[req.params.term]);
});

app.get('/get-videos/:owner', async function(req,res){
    if(req.params.owner == "all") await queryDatabaseSimple(res, 'SELECT * FROM videos ORDER BY id');
    else await queryDatabaseParameters(res, 'SELECT * FROM videos WHERE owner = $1 ORDER BY id', [req.params.owner]);
});

app.get('/get-fav-videos/:owner', async function(req,res){
    await queryDatabaseParameters(res,'SELECT likes FROM likes_data WHERE username = $1',[req.params.owner]);
});

app.get('/get-preview/:id', async function(req,res){
  let link = "https://interact-videos.s3.eu-central-1.amazonaws.com/" + req.params.id;
  await extractFrames({
    input: link,
    output: './preview-' + req.params.id + '.png',
    offsets: [0]
  });
  res.sendFile(path.join(__dirname,'./preview-' + req.params.id + '.png'));
  fs.unlink('./preview-' + req.params.id + '.png');
});

app.put('/like', async function(req, res){
  like_data = req.body;
  if(req.body === {}) res.status(400).send("Empty request body. Cancelling request.");
  username = verifyUser(like_data.token);
  video_id = like_data.video_id;
  //if invalid token
  if(!username)
  {
    res.status(401).send("ERROR");
    return;
  }

  try
  {
    queryDatabaseUpdateInsert(null,'UPDATE likes_data SET likes = array_append(likes, $2) WHERE username = $1;',[username,video_id]);
    queryDatabaseUpdateInsert(res,'UPDATE videos SET likes = likes + 1 WHERE id = $1;',[video_id]);
  }
  catch(err)
  {
    res.status(500).send("ERROR");
  }
});

app.delete('/like', async function(req, res){
  like_data = req.body;
  if(req.body === {}) res.status(400).send("Empty request body. Cancelling request.");
  username = verifyUser(like_data.token);
  video_id = like_data.video_id;
  //if invalid token
  if(!username)
  {
    res.status(401).send("ERROR");
    return;
  }

  try
  {
    queryDatabaseUpdateInsert(null,'UPDATE likes_data SET likes = array_remove(likes, $2) WHERE username = $1;',[username,video_id]);
    queryDatabaseUpdateInsert(res,'UPDATE videos SET likes = likes - 1 WHERE id = $1;',[video_id]);
  }
  catch(err)
  {
    res.status(500).send("ERROR");
  }
});

function addToken(tokenobj)
{
  let replaced = false;
  for(let entry of token_data.tokens)
  {
    if(entry.username == tokenobj.username)
    {
      entry.token = tokenobj.token;
      entry.isadmin = tokenobj.isadmin;
      replaced = true;
    }
  }
  if(!replaced) token_data.tokens.push(tokenobj);
  fs.writeFile('tokendata.json', JSON.stringify(token_data), function() {console.log("stored")});
}

app.post('/user-verify', async function(req, res){
  user_data = req.body;
  console.log(req.body);
  if(req.body === {}) res.status(400).send("Empty request body. Cancelling request.");
  username = user_data.username;
  password = user_data.password;
  if(!username || !password)
  {
    res.status(400).send("ERROR");
    return;
  }
  //querying password
  await pool.connect()
       .then(client => {
        return client
          .query('SELECT password, isadmin FROM users WHERE username = $1',[username])
          .then(r => {
            client.release();
            if(r.rows.length == 0)
            {
              res.status(400).json({verified: false, error: "The following user doesn't exist"});
            }
            else if(password == r.rows[0].password)
            {
              let gen_token = Math.floor(Math.random() * (9999999999) + 1000000000);
              addToken({username: username, token: gen_token, isadmin: r.rows[0].isadmin});
              res.status(200).json({verified: true, token: gen_token, isadmin: r.rows[0].isadmin});
            }
            else res.status(401).json({verified: false, error: "Invalid password"});
          })
          .catch(err => {
            console.log(err.stack);
            res.status(500).send("ERROR");
          })
      })
});

app.delete('/user', async function(req, res){
  user_data = req.body;
  if(req.body === {}) res.status(400).send("Empty request body. Cancelling request.");
  username = user_data.username;
  token_verify = verifyUser(user_data.token);
  isadmin = verifyAdmin(user_data.token);

  if(!username || !token_verify) res.status(400).send("Bad Request");

  await pool.connect()
  .then(client => {
   return client
     .query('SELECT * FROM users WHERE username = $1',
     [username])
     .then(r => {
       client.release();
       if(r.rows.length == 0)
       {
         res.status(400).send("The following user doesn't exist.");
         return;
       }
     })
     .catch(err => {
       client.release();
       console.log(err.stack);
       res.status(500).send("ERROR");
       return;
     })
  })
  
  if(username == token_verify || isadmin == true)
  {
    queryDatabaseParameters(null,'DELETE FROM likes_data WHERE username = $1',[username]);
    queryDatabaseParameters(null,'DELETE FROM choice_data WHERE username = $1',[username]);
    queryDatabaseParameters(null,'DELETE FROM videos WHERE owner = $1',[username]);
    queryDatabaseParameters(res,'DELETE FROM users WHERE username = $1',[username]);
  }
  else res.status(401).send("ERROR");

});

app.put('/user', async function(req, res){
  user_data = req.body;
  console.log(req.body);
  if(req.body === {}) res.status(400).send("Empty request body. Cancelling request.");
  username = user_data.username;
  password = user_data.password;
  fullname = user_data.fullname;
  user_id = null;

  if(!username || !password) res.status(400).send("ERROR");

  if(username == "VALIDATING")
  {
    res.status(400).send("ERROR: This username is not permitted");
  }

  //inserting new row
  await pool.connect()
       .then(client => {
        return client
          .query('INSERT INTO users (id,username,password,fullname,isadmin) VALUES ((SELECT MAX(id) + 1 FROM users),$1,$2,$3,FALSE)',
          [username,password,fullname])
          .then(r => {
            client.release();
          })
          .catch(err => {
            client.release();
            console.log(err.stack);
            if(err.code === "23505") res.status(400).send("Error: This username already exists");
            else res.status(500).send("ERROR");
            return;
          })
      })
  queryDatabaseUpdateInsert(res,'INSERT INTO likes_data (username) VALUES ($1)',[username]);
  
});

app.get('/verify-token/:token', async function(req,res){
  let result = verifyUser(req.params.token);
  if(result) res.status(200).send("VALID");
  else res.status(200).send("INVALID");
});

app.post('/prereq-choices', async function(req,res){
  body_data = req.body;

  username = verifyUser(body_data.token);
  vidid = body_data.vidid;

  if(!username || vidid == undefined)
  {
    res.status(400).send("ERROR");
    return;
  }

  await queryDatabaseParameters(res,'SELECT choices FROM choice_data WHERE username = $1 AND vidid = $2',
                                [username,vidid]);
});

app.post('/upload-choices', async function(req,res){
  body_data = req.body;

  username = verifyUser(body_data.token);
  vidid = body_data.vidid;
  choices = body_data.choices;

  if(!username)
  {
    res.status(401).send("ERROR");
    return;
  }

  if(vidid == undefined || !choices)
  {
    res.status(400).send("ERROR");
    return;
  }

  await pool.connect()
       .then(client => {
        return client
          .query('DELETE FROM choice_data WHERE username = $1 AND vidid = $2',
          [username,vidid])
          .then(r => {
            client.release();
            queryDatabaseUpdateInsert(res,'INSERT INTO choice_data (username,vidid,choices) VALUES ($1,$2,$3)', [username,vidid,choices]);
          })
          .catch(err => {
            client.release();
            console.log(err.stack);
            return;
          })
      });
});

module.exports = app

app.listen(process.env.PORT || 3000);