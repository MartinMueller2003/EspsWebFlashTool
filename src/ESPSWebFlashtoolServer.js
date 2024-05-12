const  Express = require("express");
const app = Express();
var https = require('https');
const cors = require("cors");
const path = require('path'); 
const manifest = require('./manifest.js');
const BinImage = require('./BinImage.js');
const PORT = 5000;

var fs = require("fs");
var bodyParser = require('body-parser')
var logger = require('morgan');
const ApiHdr = "/api/ESPSWFT/v1/";
const PathToSessionData = path.join(__dirname, "../sessions");
const PathToTools = path.join(__dirname, "../tools");
const PathToDistList = path.join(__dirname, "../dists");
const PathToCerts = path.join(__dirname, "../certs");
const PathToHtmlData = path.join(__dirname, "../html");
const PathToConfigData = path.join(PathToHtmlData, "conf");

manifest.begin(PathToSessionData);
var VersionList = [];
BinImage.GenerateVersionList(PathToDistList, VersionList);
console.info("GenerateVersionList - Done");

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
    var RootUrl = ApiHdr + "sessions/";

    // console.info("manifest body: " + JSON.stringify(req.body));
    // console.info("manifest hostname: " + req.hostname);
    // console.info("manifest RootUrl: " + RootUrl);

    var responseData = await manifest.GenerateImageAndManifest (PathToTools, PathToDistList, req.body, PathToSessionData, RootUrl);
    res.send( responseData );
 });

  // process a request to get a list of versions we can supply.
  app.get(ApiHdr + "versions", async function (req, res) 
  {
      // console.info("versions: " + JSON.stringify(VersionList));
      res.send( JSON.stringify(VersionList) );
  });
 
 // handle a session termination request
 app.delete(ApiHdr + "sessions", async function (req, res) 
 {
    // console.info("DELETE body: " + JSON.stringify(req.body));
    let url = req.body.manifest;
    session = url.replace(ApiHdr + "sessions/", "");
    session = session.substr(0,session.lastIndexOf("/"));
    var responseData = await manifest.DeleteImageAndManifest (session, PathToSessionData);
    res.sendStatus( responseData );
 });

// processing path for the static files for the client UI
 app.post(ApiHdr + "firmware", async function (req, res) 
 {
    // console.info("firmware body: " + JSON.stringify(req.body));
    let filepath = path.join(PathToDistList, "ESPixelStick_Firmware-" + req.body.version.name);
    filepath = path.join(filepath, "firmware/firmware.json");
    // console.info("filepath: " + filepath);

    res.download( filepath );
 });

 app.use(Express.static(PathToHtmlData));
 app.use(ApiHdr + "sessions", Express.static(PathToSessionData));
 app.use(ApiHdr + "config", Express.static(path.join(PathToConfigData, "config.json")));

// start the express server
var options = {
    key: fs.readFileSync(path.join(PathToCerts, 'cert.pem')),
    cert: fs.readFileSync(path.join(PathToCerts, 'cert.cert'))
  };
https.createServer(options, app).listen(PORT);
console.info("Server Init Done");
