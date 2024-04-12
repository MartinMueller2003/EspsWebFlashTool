/*
    manifest.js - Functions to create and manage flash tool manifests
 */

const fs = require("fs");
const path = require('path'); 
const spawnSync = require("child_process").spawnSync;

exports.GenerateFsImage = async function (DistLocation, ConfigData, ImageDestinationDir)
{
    // console.info("FS DistLocation: '" + DistLocation + "'");
    // console.info("FS ConfigData: '" + ConfigData.platform + "'");

    var response = {};
    response.platform = ConfigData.platform;

    const HtmlTargetPath = path.join(ImageDestinationDir, "fs");
    const HtmlSourcePath = path.join(DistLocation, "fs");
    // console.info("FS HtmlTargetPath: '" + HtmlTargetPath + "'");
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
    var PlatformInfo = await GetBoardParameters(ConfigData.platform, DistLocation, FsParameters);
    FsParameters.push(ImageDestinationDir + "/fs.bin"); // must be last

    var OSBin = "bin/win32/";
    // make the fs image
    const Process = spawnSync(path.join(DistLocation, OSBin + "mklittlefs.exe"), FsParameters, { stdio: 'inherit' });

    // console.info("GenerateFsImage - Done");
    return PlatformInfo;

}; // GenerateFsImage

async function GetBoardParameters(platformName, DistLocation, FsParameters)
{
    // console.info("FS GetBoardParameters: platformName: '" + platformName + "'");

    // read the firmware description file.
    const FirmWareConfig = JSON.parse(fs.readFileSync( DistLocation + "/firmware/firmware.json", 'utf8'));

    // console.info("FS GetBoardParameters: Data: " + JSON.stringify(FirmWareConfig));
    var targetPlatform = null;

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


