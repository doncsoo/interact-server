const express = require('express')
const { Client, Pool } = require('pg');
var app = express()

queryDatabase = async(query) =>
{
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });
     
    await pool.connect()
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
    await queryDatabase('SELECT * FROM test')
    .then(r => console.log(r))
    .then(r => res.send(JSON.stringify(r)));
});

app.listen(process.env.PORT || 3000);