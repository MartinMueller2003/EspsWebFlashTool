/*
    EFUimage.js - Functions to create flash tool manifests
 */

const crypto = require('crypto');
const fs = require("fs");
const path = require('path');
const FSimage = require('./FSimage.js');
const { Logger } = require('winston');

const SIGNATURE = "EFU";
const VERSION = 1;
const SKETCH_IMAGE = 1;
const FS_IMAGE = 2;

exports.GenerateEfuImage = async function (ToolsLocation, PathToDists, ConfigData, ImageDestinationDir, RootUrl, logger)
{
    // logger.info("EFU: ToolsLocation: '" + ToolsLocation + "'");
    // logger.info("EFU:    ConfigData: '" + ConfigData.platform + "'");
    // logger.info("EFU:    ConfigData: '" + JSON.stringify(ConfigData) + "'");

    // This is the wrong way to fix this but I need a hack right now.
    ConfigData.system.requiresConfigSave = (ConfigData.system.requiresConfigSave === "true") ? true : false;
    ConfigData.system.network.wifi.dhcp = (ConfigData.system.network.wifi.dhcp === "true") ? true : false;
    ConfigData.system.network.wifi.ap_fallback = (ConfigData.system.network.wifi.ap_fallback === "true") ? true : false;
    ConfigData.system.network.wifi.StayInApMode = (ConfigData.system.network.wifi.StayInApMode === "true") ? true : false;
    ConfigData.system.network.wifi.ap_reboot = (ConfigData.system.network.wifi.ap_reboot === "true") ? true : false;
    ConfigData.system.network.weus = (ConfigData.system.network.weus === "true") ? true : false;
    ConfigData.system.network.eth.dhcp = (ConfigData.system.network.eth.dhcp === "true") ? true : false;
    ConfigData.system.network.eth.activevalue = (ConfigData.system.network.eth.activevalue === "true") ? true : false;

    let SessionDir = crypto.randomBytes(16).toString('hex');
    ImageDestinationDir = path.join(ImageDestinationDir, SessionDir);
    logger.info("EFU: ImageDestinationDir: '" + ImageDestinationDir + "'");

    const UploadToolDir = path.join(ToolsLocation, "bin/upload.py");
    // logger.info("EFU: uploadToolDir: '" + UploadToolDir + "'");

    // make the directory in which we will build the monolithic image
    fs.mkdirSync(ImageDestinationDir, { recursive: true });

    logger.info ("EFU: create the file system image");
    // logger.info("EFU: AdjustedConfigData: '" + JSON.stringify(ConfigData) + "'");

    const FsSourcePath = path.join(ImageDestinationDir, "fs.bin");
    logger.info("EFU: FsSourcePath: '" + FsSourcePath + "'");
    var PlatformInfo = await FSimage.GenerateFsImage(ToolsLocation, PathToDists, ConfigData, ImageDestinationDir, logger);
    logger.info("EFU: Make FS image - done");

    var FwSourcePath = "";
    var TargetName = "";
    var EfuTarget = "";

    // search the files looking for the app.bin file
    for(currentFileIndex in PlatformInfo.binfiles)
    {
        // logger.info("EFU: currentFile: " + PlatformInfo.binfiles[currentFileIndex].name);
        let headPosition = PlatformInfo.binfiles[currentFileIndex].name.search(/\//);
        let tailposition = PlatformInfo.binfiles[currentFileIndex].name.search(/-app.bin/);
        // logger.info("EFU: tailposition: '" + tailposition + "'");

        if(-1 !== tailposition)
        {
            FwSourcePath = path.join(path.join(PathToDists, "ESPixelStick_Firmware-" + ConfigData.version.name), "firmware");
            FwSourcePath = path.join(FwSourcePath, PlatformInfo.binfiles[currentFileIndex].name);
            TargetName = PlatformInfo.binfiles[currentFileIndex].name.substring(headPosition, tailposition);
            EfuTarget = path.join(ImageDestinationDir, TargetName + ".efu");
        }
    }
    logger.info("EFU: EfuTarget: '" + EfuTarget + "'");
    logger.info("EFU: FwSourcePath: '" + FwSourcePath + "'");
    if("" === FwSourcePath)
    {
        logger.error("Could not get a valid Firmware image.");
        return "";
    }
    logger.info("EFU: create the combined FS + Bin image");

    let FsData = fs.readFileSync(FsSourcePath);
    logger.info("EFU:  FsData size: '" + FsData.length + "'");
    let BinData = fs.readFileSync(FwSourcePath);
    logger.info("EFU: BinData size: '" + BinData.length + "'");

/*
    Sketch + LittleFS combined OTA format
        32bit signature
        16bit version

        {n # of records}
        16bit record type
        32bit size
        {x bytes of data}
            ...
        16bit record type
        32bit size
        {x bytes of data}
 */
    logger.info("EFU: Write header");
    let Offset = 0;
    var sigBuf = Buffer.alloc(4 + 2 + 2 + 4);
    sigBuf.write(SIGNATURE, Offset);              Offset = Offset + 3;
    sigBuf.writeInt8(0x00, Offset);               Offset = Offset + 1; // null terminator
    sigBuf.writeUInt16BE(VERSION, Offset);        Offset = Offset + 2;
    sigBuf.writeUInt16BE(SKETCH_IMAGE, Offset);   Offset = Offset + 2;
    sigBuf.writeUInt32BE(BinData.length, Offset); Offset = Offset + 4;
    fs.writeFileSync(EfuTarget,sigBuf, { flag: "w" });

    logger.info("EFU: Write Sketch Image");
    fs.writeFileSync(EfuTarget,BinData, { flag: "a+" });

    var fsRecordHeader = Buffer.alloc(2 + 4);
    offset = 0;
    fsRecordHeader.writeUInt16BE(FS_IMAGE, offset);      offset = offset + 2;
    fsRecordHeader.writeUInt32BE(FsData.length, offset); offset = offset + 4
    fs.writeFileSync(EfuTarget, fsRecordHeader, { flag: "a+" });
    logger.info("EFU: Write FS Image");
    fs.writeFileSync(EfuTarget, FsData, { flag: "a+" });
/*
    // add file terminator
    offset = 0;
    fsRecordHeader.writeUInt16BE(0, offset); offset = offset + 2;
    fsRecordHeader.writeUInt32BE(0, offset); offset = offset + 4
    fs.writeFileSync(EfuTarget, fsRecordHeader, { flag: "a+" });
*/
    var FileStat = fs.statSync(EfuTarget);
    logger.info("EFU: Build Image Done. Size: " + FileStat.size);

    // build the URLs
    const SessionUrl = RootUrl + SessionDir;
    const ManifestUrl = SessionUrl + "/manifest.json";
    const EfuUrl = SessionUrl + "/" + TargetName + ".efu";
    logger.info("EFU:  SessionUrl: " + SessionUrl);
    logger.info("EFU: ManifestUrl: " + ManifestUrl);
    logger.info("EFU:      EfuUrl: " + EfuUrl);

    // make the manifest
    // read the manifest into memory
    currentManifest = require(path.join(__dirname, "/manifest.json"));
    currentManifest.builds[0].chipFamily = PlatformInfo.chip.toString().toUpperCase();
    currentManifest.builds[0].parts[0].path = EfuUrl;

    ManifestTarget = path.join(ImageDestinationDir, "manifest.json");
    logger.info("EFU: ManifestTarget: " + ManifestTarget);
    fs.writeFileSync (ManifestTarget, JSON.stringify(currentManifest), function(err)
    {
        if (err) throw err;
        // logger.log('complete');
    });

    // clean up the files to remove sensitive data
    fs.rmSync(path.join(ImageDestinationDir, "fs.bin"), {force: true});
    fs.rmSync(path.join(ImageDestinationDir, "fs"), {force: true, recursive: true });

    return (ManifestUrl);
}; // GenerateEfuImage
