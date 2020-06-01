const express = require('express')
const aws = require('aws-sdk');
const cors = require('cors');
const { Client, Pool } = require('pg');
var app = express()

app.use(cors())

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

app.get('/', function(req, res){
    res.send("Backend teszt! Egyenlőre csak database testing.");
 });

app.get('/testsql', async function(req,res){
    await pool.connect()
       .then(client => {
        return client
          .query('SELECT * FROM test')
          .then(r => {
            client.release()
            console.log(r.rows)
            res.send(JSON.stringify(r.rows))
          })
          .catch(err => {
            client.release()
            console.log(err.stack)
          })
      })
});

app.get('/upload-video', (req, res) => {
  const s3 = new aws.S3();
  const fileName = req.query['file-name'];
  const fileType = req.query['file-type'];
  var s3Params = {
    Bucket: process.env.S3_BUCKET,
    Key: fileName,
    Expires: 60,
    ContentType: fileType,
    ACL: 'public-read'
  };

  console.log(fileName)
  console.log(fileType)
  console.log(s3Params)

  s3.getSignedUrl('putObject', s3Params, (err, data) => {
    if(err){
      console.log(err);
      return res.send("Upload failed");
    }
    const returnData = {
      signedRequest: data,
      url: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${fileName}`
    };
    res.json(returnData);
  });
});

app.listen(process.env.PORT || 3000);