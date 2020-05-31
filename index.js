const express = require('express')
var app = express()

app.get('/', function(req, res){
    res.send("Backend teszt! Egyenlőre csak database testing.");
 });

app.listen(process.env.PORT || 3000)