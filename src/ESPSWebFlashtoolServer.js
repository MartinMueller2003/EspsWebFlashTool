const  Express = require("express");
const app = Express();
const Winston = require ("winston");
const { format, createLogger, transports } = require("winston");
var https = require('https');
const cors = require("cors");
const path = require('path'); 
const manifest = require('./manifest.js');
const BinImage = require('./BinImage.js');
const PORT = 5000;

var fs = require("fs");
var bodyParser = require('body-parser');
var morgan = require('morgan');
const ApiHdr = "/api/ESPSWFT/v1/";
const PathToSessionData = path.join(__dirname, "../sessions");
const PathToTools = path.join(__dirname, "../tools");
const PathToDistList = path.join(__dirname, "../dists");
const PathToCerts = path.join(__dirname, "../certs");
const PathToHtmlData = path.join(__dirname, "../html");
const PathToConfigData = path.join(PathToHtmlData, "conf");
const PathToLogfiles = path.join(__dirname, "../logs");
const LogFileName = path.join(PathToLogfiles, "log.txt");

// make sure the logging directory exists
if (!fs.existsSync(PathToLogfiles))
{
    fs.mkdirSync(PathToLogfiles, 0777);
}

const logger = Winston.createLogger(
    {
        level: 'info',
        format: format.combine(
            format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
            format.printf(info => `${info.timestamp}: ${info.message}`)
        ),
        transports:
        [   // use console for debugging
            // new Winston.transports.Console(),
            new Winston.transports.File(
            {
                filename: LogFileName,
                level: 'info',
                maxsize: 500
            }),
        ]
    });
logger.info('Log system Started');

manifest.begin(PathToSessionData);
var VersionList = [];
BinImage.GenerateVersionList(PathToDistList, VersionList);
logger.info("GenerateVersionList - Done");

app.use(cors());
app.use(bodyParser.urlencoded({  extended: true }));

// setting for logging to the local console. Not needed for production
app.use(morgan("dev"));

// Middleware that parses the body payloads as JSON to be consumed 
// by next set of middlewares and controllers.
app.use( bodyParser.json() );
app.use(Express.json());

// processing for the API calls

 // process a request to create a mono image and manifest.
 app.post(ApiHdr + "manifest", async function (req, res) 
 {
    var RootUrl = ApiHdr + "sessions/";

    // logger.info("manifest body: " + JSON.stringify(req.body));
    // logger.info("manifest hostname: " + req.hostname);
    // logger.info("manifest RootUrl: " + RootUrl);
    logger.info("Generate manifest");
    var responseData = await manifest.GenerateImageAndManifest (PathToTools, PathToDistList, req.body, PathToSessionData, RootUrl);
    res.send( responseData );
 });

  // process a request to get a list of versions we can supply.
  app.get(ApiHdr + "versions", async function (req, res)
  {
      // logger.info("versions: " + JSON.stringify(VersionList));
      res.send( JSON.stringify(VersionList) );
  });

 // handle a session termination request
 app.delete(ApiHdr + "sessions", async function (req, res)
 {
    // logger.info("DELETE body: " + JSON.stringify(req.body));
    let url = req.body.manifest;
    session = url.replace(ApiHdr + "sessions/", "");
    session = session.substr(0,session.lastIndexOf("/"));
    var responseData = await manifest.DeleteImageAndManifest (session, PathToSessionData);
    res.sendStatus( responseData );
 });

// processing path for the static files for the client UI
 app.post(ApiHdr + "firmware", async function (req, res)
 {
    // logger.info("firmware body: " + JSON.stringify(req.body));
    let filepath = path.join(PathToDistList, "ESPixelStick_Firmware-" + req.body.version.name);
    filepath = path.join(filepath, "firmware/firmware.json");
    logger.info("Download filepath: " + filepath);

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
logger.info("Server Init Done.");
