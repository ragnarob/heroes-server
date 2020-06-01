const express = require('express')
const bodyParser = require('body-parser')
require('dotenv').config()

app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

app.use(express.static('./public'))

require('./api').setupRoutes()

app.get('*', (req, res) => res.sendFile('index.html', {root: './public'}))

app.listen(process.env.PORT)

console.log(`Heroes listening on port ${process.env.PORT}!`)