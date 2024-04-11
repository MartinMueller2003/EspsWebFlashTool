/*
    manifest.js - Functions to create and manage flash tool manifests
 */

const crypto = require('crypto');
const fs = require("fs");
const MaxAgeInMs = (60 * 60  * 1000);
const path = require('path'); 
const spawn = require("child_process").spawn;


// manage the directories created and delete after N minutes since last use
exports.begin = function (ImageDestinationDir)
{
    // clean up past directories
    if(fs.existsSync(ImageDestinationDir))
    {
    console.info("Delete old sessions");
    fs.rmSync(ImageDestinationDir, { recursive: true });
    }

    fs.mkdirSync(ImageDestinationDir);

    var intervalId = setInterval(function() 
    {
        // console.info("Interval reached every Hour");

        // scan the existing directories
        const files = fs.readdirSync(ImageDestinationDir, { withFileTypes: true });

        for (const file of files) 
        {
                if (file.isDirectory()) 
                {
                        const filePath = path.join(ImageDestinationDir, file.name);
                        const stats = fs.statSync(filePath);
                        const deltaTime = new Date().getTime() - stats.atime;
                        // console.info("filePath: '" + filePath + "'");
                        // console.info("Date(): '" + new Date().getTime() + "'");
                        // console.info("stats.atime: '" + stats.atime + "'");
                        // console.info("MaxAgeInMs: '" + MaxAgeInMs + "'");
                        // console.info("deltaTime: '" + deltaTime + "'");

                        // has it been hanging around too long?
                        if(deltaTime > MaxAgeInMs)
                        {
                                // clean up the directory
                                // TODO - Restore fs.rmSync(filePath, { recursive: true });
                        }
                } 
                else 
                {
                // no files allowed in this directory
                fs.rmSync(filePath);
                }
        }       
    }, MaxAgeInMs);
}; // begin

exports.GenerateImageAndManifest = function (DistLocation, ConfigData, ImageDestinationDir)
{
    console.info("DistLocation: '" + DistLocation + "'");
    console.info("ConfigData: '" + ConfigData.platform + "'");

    ImageDestinationDir = path.join(ImageDestinationDir, crypto.randomBytes(16).toString('hex'));
    console.info("ImageDestination: '" + ImageDestinationDir + "'");

    fs.mkdirSync(ImageDestinationDir, { recursive: true });

    var response = {};
    response.platform = ConfigData.platform;

    const HtmlTargetPath = path.join(ImageDestinationDir, "fs");
    const HtmlSourcePath = path.join(DistLocation, "fs");
    console.info("HtmlTargetPath: '" + HtmlTargetPath + "'");
    console.info("HtmlSourcePath: '" + HtmlSourcePath + "'");

    // set up the directory in which we will build the FS
    fs.mkdirSync(HtmlTargetPath, { recursive: true });

    // get the FS files
    fs.cpSync(HtmlSourcePath + "/", HtmlTargetPath, { recursive : true, force : true });

    // minify the FS files

    // save the config data
    fs.writeFileSync(path.join(HtmlTargetPath, "config.json"), JSON.stringify(ConfigData));

    var OSBin = "bin/win32/";
    // make the fs image
    const pythonProcess = spawn(path.join(DistLocation, OSBin + "mklittlefs.exe"),["-c ", HtmlTargetPath, ImageDestinationDir + "/fs.bin"]);


    // make the combined image

    // make the manifest


    return JSON.stringify(response);

}; // GenerateImageAndManifest


//    fs.readFile( "./html/" + "EspsWebFlashTool.html", 'utf8', function (err, data) {
//       res.end( data );
//    });

