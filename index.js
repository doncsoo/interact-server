const express = require('express')
const { Client } = require('pg');
var app = express()

const queryDatabase = (query) =>
{
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      });
      
    client.connect();
    stuff = undefined;
    client.query(query)
          .then(res => stuff = res.rows)
          .catch(e => console.log("Something bad happened while querying...."))

    client.end();
    return stuff;
}

app.get('/', function(req, res){
    res.send("Backend teszt! Egyenlőre csak database testing.");
 });

app.get('/testsql', function(req,res){
    res.send(queryDatabase('SELECT * FROM test'));
});

app.listen(process.env.PORT || 3000);