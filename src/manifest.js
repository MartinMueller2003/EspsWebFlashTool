/*
    manifest.js - Functions to create and manage flash tool manifests
 */

const crypto = require('crypto');
const fs = require("fs");
const MaxAgeInMs = (60 * 60  * 1000);
const path = require('path'); 
const spawnSync = require("child_process").spawnSync;
const FSimage = require('./FSimage.js');

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
                    fs.rmSync(filePath, { recursive: true });
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

exports.GenerateImageAndManifest = async function (DistLocation, ConfigData, ImageDestinationDir, RootUrl)
{
    // console.info("DistLocation: '" + DistLocation + "'");
    // console.info("ConfigData: '" + ConfigData.platform + "'");
    
    var SessionDir = crypto.randomBytes(16).toString('hex');
    ImageDestinationDir = path.join(ImageDestinationDir, SessionDir);
    // console.info("ImageDestinationDir: '" + ImageDestinationDir + "'");
    const ImageTarget = path.join(ImageDestinationDir, "output.bin");
    // console.info("ImageTarget: '" + ImageTarget + "'");

    const UploadToolDir = path.join(DistLocation, "bin/upload.py");
    // console.info("uploadToolDir: '" + UploadToolDir + "'");

    // make the directory in which we will build the monolithic image
    fs.mkdirSync(ImageDestinationDir, { recursive: true });

    console.info ("create the file system image");
    var PlatformInfo = await FSimage.GenerateFsImage(DistLocation, ConfigData, ImageDestinationDir);
    const FirmwarePath = path.join(DistLocation, "firmware");

    console.info("create the combined FS + Bin image");
    MergeParameters = [];
    MergeParameters.push(UploadToolDir);
    MergeParameters.push("--chip");
    MergeParameters.push(PlatformInfo.chip);
    MergeParameters.push("merge_bin");
    MergeParameters.push("-o");
    MergeParameters.push(ImageTarget);
    MergeParameters.push("--flash_mode");
    MergeParameters.push("dio");
    MergeParameters.push("--flash_freq");
    MergeParameters.push("80m");
    MergeParameters.push("--flash_size");
    MergeParameters.push("4MB");

    PlatformInfo.binfiles.forEach (function (CurrentBin)
    {
        MergeParameters.push(CurrentBin.offset);
        MergeParameters.push(path.join(FirmwarePath, CurrentBin.name));
    });

    MergeParameters.push(PlatformInfo.filesystem.offset);
    MergeParameters.push(path.join(ImageDestinationDir, "fs.bin"));

    const Process = spawnSync("python", MergeParameters, { stdio: 'inherit' });
    // console.info("make the combined image - done");

    // build the URLs
    const SessionUrl = RootUrl + SessionDir;
    const ManifestUrl = SessionUrl + "/manifest.json";
    const BinUrl = SessionUrl + "/output.bin";
    // console.info(" SessionUrl: " + SessionUrl);
    // console.info("ManifestUrl: " + ManifestUrl);
    // console.info("     BinUrl: " + BinUrl);

    // make the manifest
    // read the manifest into memory
    currentManifest = require(path.join(__dirname, "/manifest.json"));
    currentManifest.builds[0].chipFamily = PlatformInfo.chip.toString().toUpperCase();
    currentManifest.builds[0].parts[0].path = BinUrl;

    ManifestTarget = path.join(ImageDestinationDir, "manifest.json");
    // console.info("ManifestTarget: " + ManifestTarget);
    fs.writeFile (ManifestTarget, JSON.stringify(currentManifest), function(err)
    {
        if (err) throw err;
        console.log('complete');
    });

    // clean up the files to remove sensitive data
    fs.rmSync(path.join(ImageDestinationDir, "fs.bin"));
    fs.rmSync(path.join(ImageDestinationDir, "fs"), { recursive: true });

    return (ManifestUrl);

}; // GenerateImageAndManifest

exports.DeleteImageAndManifest = async function (sessionId, PathToSessionData)
{
    const ImageDestinationDir = path.join(PathToSessionData, sessionId);

    // console.info("          sessionId: '" + sessionId + "'");
    // console.info("  PathToSessionData: '" + PathToSessionData + "'");
    // console.info("ImageDestinationDir: '" + ImageDestinationDir + "'");

    if(fs.existsSync(ImageDestinationDir))
    {
        fs.rmSync(ImageDestinationDir, { recursive: true });
    }

    return 200;
    
} // DeleteImageAndManifest
