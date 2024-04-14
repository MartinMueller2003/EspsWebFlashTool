const  Express = require("express");
const app = Express();
const cors = require("cors");
const path = require('path'); 
const manifest = require('./manifest.js');

var fs = require("fs");
var bodyParser = require('body-parser')
var logger = require('morgan');
const ApiHdr = "/api/ESPSWFT/1/";
const PathToSessionData = path.join(__dirname, "../sessions");
const PathToDistData = path.join(__dirname, "../dist");

manifest.begin(PathToSessionData);
app.use(cors());
app.use(bodyParser.urlencoded({  extended: true }));

// setting for logging to the local console. Not needed for production
app.use(logger("dev"));

// Middleware that parses the body payloads as JSON to be consumed 
// by next set of middlewares and controllers.
app.use( bodyParser.json() );      
app.use(Express.json());

// processing for the API calls

 // process a request to create a mono image and manifest.
 app.post(ApiHdr + "manifest", async function (req, res) 
 {
    // console.info("manifest body: " + JSON.stringify(req.body.platform));
    var responseData = await manifest.GenerateImageAndManifest (PathToDistData, req.body, PathToSessionData);
    res.send( responseData );
 });

// processing path for the static files for the client UI
 app.use(Express.static(path.join(PathToDistData, "firmware")));
 app.use(Express.static("html"));

// Express Routes Import
// const AuthorizationRoutes = require("./authorization/routes");
// const UserRoutes = require("./users/routes");
// const ProductRoutes = require("./products/routes");

// Sequelize model imports
// const UserModel = require("./common/models/User");
// const ProductModel = require("./common/models/Product");


// start the express server
var server = app.listen(5000, function () {
    console.log("Express App running at http://127.0.0.1:5000/");
 });
console.info("Server Init Done");
