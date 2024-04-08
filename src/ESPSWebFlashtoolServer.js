var Express = require("express");
var app = Express();
const cors = require("cors");
var fs = require("fs");
var path = require('path');
var bodyParser = require('body-parser')
var logger = require('morgan');

app.use(cors());
app.use( bodyParser.json() );      
app.use(bodyParser.urlencoded({  extended: true }));
// app.use(logger(':method :url'));
app.use(logger("dev"));

app.post('/api/1/session', function (req, res) {
    console.info("session: '" + req.path + "'");
    res.end( '01234567890' );
//    fs.readFile( "./html/" + "EspsWebFlashTool.html", 'utf8', function (err, data) {
//       res.end( data );
//    });
 })

app.use("/", Express.static("html"));

// Express Routes Import
// const AuthorizationRoutes = require("./authorization/routes");
// const UserRoutes = require("./users/routes");
// const ProductRoutes = require("./products/routes");

// Sequelize model imports
// const UserModel = require("./common/models/User");
// const ProductModel = require("./common/models/Product");


// Middleware that parses the body payloads as JSON to be consumed next set
// of middlewares and controllers.
app.use(Express.json());
var server = app.listen(5000, function () {
    console.log("Express App running at http://127.0.0.1:5000/");
 });
console.info("Server Init Done");
