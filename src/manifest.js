/*
    manifest.js - Functions to create and manage flash tool manifests
 */

const crypto = require('crypto');
const fs = require("fs");
const MaxAgeInMs = (30 * 60 * 1000); // minutes * seconds in a minute * miliseconds in a second
const path = require('path');
const spawnSync = require("child_process").spawnSync;
const FSimage = require('./FSimage.js');

// manage the directories created and delete after N minutes since last use
exports.begin = function (ImageDestinationDir, logger)
{
    // clean up past directories
    if(fs.existsSync(ImageDestinationDir))
    {
        logger.info("Delete old sessions");
        fs.rmSync(ImageDestinationDir, { recursive: true });
    }

    fs.mkdirSync(ImageDestinationDir);
    fs.chmodSync(ImageDestinationDir, 0o777);

    setInterval(function()
    {
        // logger.info("Interval reached every Hour");
        // logger.info("Date(): '" + new Date().getTime() + "'");

        // scan the existing directories
        const files = fs.readdirSync(ImageDestinationDir, { withFileTypes: true });

        for (const file of files)
        {
            if (file.isDirectory())
            {
                const filePath = path.join(ImageDestinationDir, file.name);
                const stats = fs.statSync(filePath);
                const deltaTime = new Date().getTime() - stats.atime.getTime();
                // logger.info("filePath: '" + filePath + "'");
                // logger.info("stats.atime: '" + stats.atime.getTime() + "'");
                // logger.info("MaxAgeInMs: '" + MaxAgeInMs + "'");
                // logger.info("deltaTime: '" + deltaTime + "'");

                // has it been hanging around too long?
                if(deltaTime > MaxAgeInMs)
                {
                    // logger.info("clean up the directory");
                    fs.rmSync(filePath, { force: true, recursive: true });
                }
            }
            else
            {
                // logger.info("no files allowed in this directory");
                fs.rmSync(filePath, { force: true, recursive: true });
            }
        }
    }, MaxAgeInMs);
}; // begin

exports.GenerateImageAndManifest = async function (ToolsLocation, PathToDists, ConfigData, ImageDestinationDir, RootUrl, logger)
{
    // logger.info("DistLocation: '" + DistLocation + "'");
    // logger.info("    platform: '" + ConfigData.platform + "'");
    // logger.info("  ConfigData: '" + JSON.stringify(ConfigData) + "'");

    // This is the wrong way to fix this but I need a hack right now.
    ConfigData.system.requiresConfigSave = (ConfigData.system.requiresConfigSave === "true") ? true : false;
    ConfigData.system.network.wifi.dhcp = (ConfigData.system.network.wifi.dhcp === "true") ? true : false;
    ConfigData.system.network.wifi.ap_fallback = (ConfigData.system.network.wifi.ap_fallback === "true") ? true : false;
    ConfigData.system.network.wifi.StayInApMode = (ConfigData.system.network.wifi.StayInApMode === "true") ? true : false;
    ConfigData.system.network.wifi.ap_reboot = (ConfigData.system.network.wifi.ap_reboot === "true") ? true : false;
    ConfigData.system.network.weus = (ConfigData.system.network.weus === "true") ? true : false;
    ConfigData.system.network.eth.dhcp = (ConfigData.system.network.eth.dhcp === "true") ? true : false;
    ConfigData.system.network.eth.activevalue = (ConfigData.system.network.eth.activevalue === "true") ? true : false;

    var SessionDir = crypto.randomBytes(16).toString('hex');
    ImageDestinationDir = path.join(ImageDestinationDir, SessionDir);
    // logger.info("ImageDestinationDir: '" + ImageDestinationDir + "'");
    const BinImageTarget = path.join(ImageDestinationDir, "output.bin");
    // logger.info("BinImageTarget: '" + BinImageTarget + "'");

    const UploadToolDir = path.join(ToolsLocation, "bin/upload.py");
    // logger.info("uploadToolDir: '" + UploadToolDir + "'");

    // make the directory in which we will build the monolithic image
    fs.mkdirSync(ImageDestinationDir, { recursive: true });
    fs.chmodSync(ImageDestinationDir, 0o777);

    logger.info ("create the file system image");
    // logger.info("AdjustedConfigData: '" + JSON.stringify(ConfigData) + "'");

    var PlatformInfo = await FSimage.GenerateFsImage(ToolsLocation, PathToDists, ConfigData, ImageDestinationDir, logger);
    // logger.info("PlatformInfo: '" + JSON.stringify(PlatformInfo) + "'");
    const FirmwarePath = path.join(path.join(PathToDists, "ESPixelStick_Firmware-" + ConfigData.version.name), "firmware");
    // logger.info("FirmwarePath: '" + FirmwarePath + "'");
    const FsImageTarget = path.join(ImageDestinationDir, "fs.bin");
    logger.info("Make FS image - done: ");

    logger.info("Create the combined FS + Bin image");
    MergeParameters = [];
    MergeParameters.push(UploadToolDir);
    MergeParameters.push("--chip");
    MergeParameters.push(PlatformInfo.chip);
    MergeParameters.push("merge_bin");
    MergeParameters.push("-o");
    MergeParameters.push(BinImageTarget);
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
    MergeParameters.push(FsImageTarget);

    spawnSync("ls -al", { stdio: 'inherit' });
    logger.info("MergeParameters: " + MergeParameters);
    const Process = spawnSync("python3", MergeParameters, { stdio: 'inherit' });
    // logger.info('Stdout:', Process.stdout.toString());
    // logger.info('Stderr:', Process.stderr.toString());
    logger.info("Create the combined image - done: ");

    // build the URLs
    const SessionUrl = RootUrl + SessionDir;
    const ManifestUrl = SessionUrl + "/manifest.json";
    const BinUrl = SessionUrl + "/output.bin";
    // logger.info(" SessionUrl: " + SessionUrl);
    // logger.info("ManifestUrl: " + ManifestUrl);
    // logger.info("     BinUrl: " + BinUrl);

    // make the manifest
    // read the manifest into memory
    currentManifest = require(path.join(__dirname, "/manifest.json"));
    currentManifest.builds[0].chipFamily = PlatformInfo.chip.toString().toUpperCase();
    currentManifest.builds[0].parts[0].path = BinUrl;

    ManifestTarget = path.join(ImageDestinationDir, "manifest.json");
    // logger.info("ManifestTarget: " + ManifestTarget);
    fs.writeFileSync (ManifestTarget, JSON.stringify(currentManifest), function(err)
    {
        if (err) throw err;
        // logger.log('complete');
    });

    // clean up the files to remove sensitive data
    fs.rmSync(path.join(ImageDestinationDir, "fs.bin"), {force: true});
    fs.rmSync(path.join(ImageDestinationDir, "fs"), {force: true, recursive: true });

    return (ManifestUrl);

}; // GenerateImageAndManifest

exports.DeleteImageAndManifest = async function (sessionId, PathToSessionData, logger)
{
    const ImageDestinationDir = path.join(PathToSessionData, sessionId);

    // logger.info("DeleteImageAndManifest");
    // logger.info("          sessionId: '" + sessionId + "'");
    // logger.info("  PathToSessionData: '" + PathToSessionData + "'");
    // logger.info("ImageDestinationDir: '" + ImageDestinationDir + "'");

    if(fs.existsSync(ImageDestinationDir))
    {
        fs.rmSync(ImageDestinationDir, { recursive: true });
    }

    return 200;

} // DeleteImageAndManifest
