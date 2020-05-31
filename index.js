const express = require('express')
const { Client, Pool } = require('pg');
var app = express()

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
          .then(res => {
            client.release()
            console.log(res.rows);
          })
          .then(r => console.log(r))
          .then(r => res.send(JSON.stringify(r)))
          .catch(err => {
            client.release()
            console.log(err.stack)
          })
      })
});

app.listen(process.env.PORT || 3000);