const express = require('express')
const { Client } = require('pg');
var app = express()

queryDatabase(query)
{
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      });
      
      client.connect();
      
      client.query(query, (err, res) => {
        if (err) throw err;
        /*for (let row of res.rows) {
          console.log(JSON.stringify(row));
        }*/
        return JSON.stringify(res.rows);
        client.end();
      });
}

app.get('/', function(req, res){
    res.send("Backend teszt! Egyenlőre csak database testing.");
 });

app.get('/testsql', function(req,res){
    res.send(queryDatabase('SELECT * FROM test'));
});

app.listen(process.env.PORT || 3000)