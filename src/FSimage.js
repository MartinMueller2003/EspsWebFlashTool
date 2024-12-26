/*
    FSimage.js - Functions to create and manage flash tool manifests
 */

const fs = require("fs");
const path = require('path');
const spawnSync = require("child_process").spawnSync;
const os = require("os");

exports.GenerateFsImage = async function (DistLocation, PathToDists, ConfigData, ImageDestinationDir, logger)
{
    // logger.info("FS DistLocation: '" + DistLocation + "'");
    // logger.info("FS ConfigData: '" + ConfigData.platform + "'");

    var response = {};
    response.platform = ConfigData.platform;

    const HtmlTargetPath = path.join(ImageDestinationDir, "fs");
    const SourceDistPath = path.join(PathToDists, "ESPixelStick_Firmware-" + ConfigData.version.name);
    const HtmlSourcePath = path.join(SourceDistPath, "fs");

    // logger.info("FS HtmlTargetPath: '" + HtmlTargetPath + "'");
    // logger.info("FS SourceDistPath: '" + SourceDistPath + "'");
    // logger.info("FS HtmlSourcePath: '" + HtmlSourcePath + "'");

    // make sure the directory is gone
    fs.rmSync(HtmlTargetPath, { recursive: true, force: true });

    // set up the directory in which we will build the FS
    fs.mkdirSync(HtmlTargetPath, { recursive: true });

    // get the FS files
    fs.cpSync(HtmlSourcePath + "/", HtmlTargetPath, { recursive : true, force : true });

    // minify the FS files - This step is not needed. The dist comes with the files minified and compressed

    // save the config data
    fs.writeFileSync(path.join(HtmlTargetPath, "config.json"), JSON.stringify(ConfigData));

    // array of littlefs parameters
    let FsParameters = [];
    FsParameters.push("-c");
    FsParameters.push(HtmlTargetPath);
    var PlatformInfo = await GetBoardParameters(ConfigData.platform, SourceDistPath, FsParameters, logger);
    FsParameters.push(ImageDestinationDir + "/fs.bin"); // must be last

    var OSBin = path.join(DistLocation, "bin");
    let osVersion = os.version().toLowerCase();
    let exeName = "";
    if(-1 !== osVersion.indexOf("windows"))
    {
        OSBin = path.join(OSBin, "win32");
        exeName = "mklittlefs.exe";
    }
    else if(-1 !== osVersion.indexOf("linux"))
    {
        OSBin = path.join(OSBin, "linux64");
        exeName = "mklittlefs";
    }
    else if(-1 !== osVersion.indexOf("ubuntu"))
    {
        OSBin = path.join(OSBin, "linux64");
        exeName = "mklittlefs";
    }
    else if(-1 !== osVersion.indexOf("darwin"))
    {
        OSBin = path.join(OSBin, "macos");
        exeName = "mklittlefs";
    }
    else if(-1 !== osVersion.indexOf("pmx"))
    {
        OSBin = path.join(OSBin, "linux64");
        exeName = "mklittlefs";
    }
    else
    {
        logger.error("Could not determine OS type. Got: '" + osVersion + "'");
        return;
    }

    // logger.info("   osVersion: " + osVersion);
    // logger.info("       OSBin: " + OSBin);
    const ExePath = path.join(OSBin, exeName);
    // logger.info("     ExePath: " + ExePath);
    logger.info("FsParameters: " + FsParameters);

    // make the fs image
    // const Process = spawnSync(ExePath, FsParameters, { stdio: 'inherit' });
    const Process = spawnSync(ExePath, FsParameters);

    // logger.info("GenerateFsImage - Done:" + fs.statSync(ImageDestinationDir + "/fs.bin"));
    return PlatformInfo;

}; // GenerateFsImage

async function GetBoardParameters(platformName, DistLocation, FsParameters, logger)
{
    // logger.info("FS GetBoardParameters: platformName: '" + platformName + "'");

    // read the firmware description file.
    const FirmWareConfig = JSON.parse(fs.readFileSync( DistLocation + "/firmware/firmware.json", 'utf8'));

    // logger.info("FS GetBoardParameters: Data: " + JSON.stringify(FirmWareConfig));
    if ({}.hasOwnProperty.call(FirmWareConfig, "boards"))
    {
        // logger.info("FS GetBoardParameters: Found the boards array");
        var FirmwareBoards = FirmWareConfig.boards;
        var SelectedPlatform =null;

        FirmwareBoards.forEach (function (CurrentBoard)
        {
            // logger.info("FS GetBoardParameters: CurrentBoard.name: " + CurrentBoard.name);
            if(platformName === CurrentBoard.name)
            {
                // logger.info("FS GetBoardParameters: Found the board");
                SelectedPlatform = CurrentBoard;
                FsParameters.push("-p");
                FsParameters.push(CurrentBoard.filesystem.page);
                FsParameters.push("-b");
                FsParameters.push(CurrentBoard.filesystem.block);
                FsParameters.push("-s");
                FsParameters.push(CurrentBoard.filesystem.size);
                logger.info("filesystem.size: " + CurrentBoard.filesystem.size);
            }
        });
    }
    else
    {
        logger.error("FS GetBoardParameters: No boards defined in firmware file.");
    }

    // logger.info("FS GetBoardParameters: Done:");
    return SelectedPlatform;

} // GetBoardParameters


