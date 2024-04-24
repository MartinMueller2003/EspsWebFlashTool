/*
    manifest.js - Functions to create and manage flash tool manifests
 */

const fs = require("fs");
const path = require('path'); 
const spawnSync = require("child_process").spawnSync;
const os = require("os"); 

exports.GenerateFsImage = async function (DistLocation, PathToDists, ConfigData, ImageDestinationDir)
{
    // console.info("FS DistLocation: '" + DistLocation + "'");
    // console.info("FS ConfigData: '" + ConfigData.platform + "'");

    var response = {};
    response.platform = ConfigData.platform;

    const HtmlTargetPath = path.join(ImageDestinationDir, "fs");
    const SourceDistPath = path.join(PathToDists, "ESPixelStick_Firmware-" + ConfigData.version.name);
    const HtmlSourcePath = path.join(SourceDistPath, "fs");

    // console.info("FS HtmlTargetPath: '" + HtmlTargetPath + "'");
    // console.info("FS SourceDistPath: '" + SourceDistPath + "'");
    // console.info("FS HtmlSourcePath: '" + HtmlSourcePath + "'");

    // set up the directory in which we will build the FS
    fs.mkdirSync(HtmlTargetPath, { recursive: true });

    // get the FS files
    fs.cpSync(HtmlSourcePath + "/", HtmlTargetPath, { recursive : true, force : true });

    // minify the FS files - This step s not needed. The dist comes with the files minified and compressed

    // save the config data
    fs.writeFileSync(path.join(HtmlTargetPath, "config.json"), JSON.stringify(ConfigData));

    // array of littlefs parameters
    let FsParameters = [];
    FsParameters.push("-c");
    FsParameters.push(HtmlTargetPath);
    var PlatformInfo = await GetBoardParameters(ConfigData.platform, SourceDistPath, FsParameters);
    FsParameters.push(ImageDestinationDir + "/fs.bin"); // must be last

    var OSBin = path.join(DistLocation, "bin"); 
    let osVersion = os.version().toLowerCase(); 
    if(-1 !== osVersion.indexOf("windows"))
    {
        OSBin = path.join(OSBin, "win32");
    }
    else if(-1 !== osVersion.indexOf("linux"))
    {
        OSBin = path.join(OSBin, "linux64");
    }
    else if(-1 !== osVersion.indexOf("ubuntu"))
    {
        OSBin = path.join(OSBin, "linux64");
    }
    else if(-1 !== osVersion.indexOf("darwin"))
    {
        OSBin = path.join(OSBin, "macos");
    }
    else
    {
        console.error("Could not determine OS type. Got: '" + osVersion + "'");
        return;
    }

    // console.info("osVersion: " + osVersion);
    // console.info("OSBin: " + OSBin);
    
    // make the fs image
    // const Process = spawnSync(path.join(DistLocation, OSBin + "mklittlefs.exe"), FsParameters, { stdio: 'inherit' });
    const Process = spawnSync(path.join(OSBin, "mklittlefs.exe"), FsParameters);

    // console.info("GenerateFsImage - Done");
    return PlatformInfo;

}; // GenerateFsImage

async function GetBoardParameters(platformName, DistLocation, FsParameters)
{
    // console.info("FS GetBoardParameters: platformName: '" + platformName + "'");

    // read the firmware description file.
    const FirmWareConfig = JSON.parse(fs.readFileSync( DistLocation + "/firmware/firmware.json", 'utf8'));

    // console.info("FS GetBoardParameters: Data: " + JSON.stringify(FirmWareConfig));
    if ({}.hasOwnProperty.call(FirmWareConfig, "boards"))
    {
        // console.info("FS GetBoardParameters: Found the boards array");
        var FirmwareBoards = FirmWareConfig.boards;
        var SelectedPlatform =null;

        FirmwareBoards.forEach (function (CurrentBoard)
        {
            // console.info("FS GetBoardParameters: CurrentBoard.name: " + CurrentBoard.name);
            if(platformName === CurrentBoard.name)
            {
                // console.info("FS GetBoardParameters: Found the board");
                SelectedPlatform = CurrentBoard;
                FsParameters.push("-p");
                FsParameters.push(CurrentBoard.filesystem.page);
                FsParameters.push("-b");
                FsParameters.push(CurrentBoard.filesystem.block);
                FsParameters.push("-s");
                FsParameters.push(CurrentBoard.filesystem.size);
            }
        });
    }
    else
    {
        console.error("FS GetBoardParameters: No boards defined in firmware file.");
    }
    
    // console.info("FS GetBoardParameters: Done:");
    return SelectedPlatform;

} // GetBoardParameters


