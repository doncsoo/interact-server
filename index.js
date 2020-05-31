const express = require('express')
const { Client, Pool } = require('pg');
var app = express()

queryDatabase = async(query) =>
{
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });
     
    pool.connect()
       .then(client => {
        return client
          .query(query)
          .then(res => {
            client.release()
            console.log(res.rows);
            return res.rows;
          })
          .catch(err => {
            client.release()
            console.log(err.stack)
            return null;
          })
      })
    
    pool.end()
}

app.get('/', function(req, res){
    res.send("Backend teszt! Egyenlőre csak database testing.");
 });

app.get('/testsql', async function(req,res){
    resp = await queryDatabase('SELECT * FROM test')
    .then(console.log(resp))
    .then(res.send(JSON.stringify(resp)));
});

app.listen(process.env.PORT || 3000);