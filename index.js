const express = require('express')
const { Client, Pool } = require('pg');
var app = express()

queryDatabase = (query) =>
{
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });
    
    stuff = null;  
    pool.connect()
       .then(client => {
        return client
          .query(query)
          .then(res => {
            client.release()
            console.log(res.rows);
            stuff = res.rows;
          })
          .catch(err => {
            client.release()
            console.log(err.stack)
          })
      })
    
    pool.end()
    return stuff;
}

app.get('/', function(req, res){
    res.send("Backend teszt! Egyenlőre csak database testing.");
 });

app.get('/testsql', function(req,res){
    resp = queryDatabase('SELECT * FROM test')
    console.log(resp)
    res.send(JSON.stringify(resp));
});

app.listen(process.env.PORT || 3000);