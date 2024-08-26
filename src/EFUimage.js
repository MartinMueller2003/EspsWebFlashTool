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

exports.GenerateEfuImage = async function (ToolsLocation, PathToDists, ConfigData, ImageDestinationDir, RootUrl)
{
    // console.info("EFU: ToolsLocation: '" + ToolsLocation + "'");
    // console.info("EFU:    ConfigData: '" + ConfigData.platform + "'");
    // console.info("EFU:    ConfigData: '" + JSON.stringify(ConfigData) + "'");

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
    console.info("EFU: ImageDestinationDir: '" + ImageDestinationDir + "'");

    const UploadToolDir = path.join(ToolsLocation, "bin/upload.py");
    // console.info("EFU: uploadToolDir: '" + UploadToolDir + "'");

    // make the directory in which we will build the monolithic image
    fs.mkdirSync(ImageDestinationDir, { recursive: true });

    console.info ("EFU: create the file system image");
    // console.info("EFU: AdjustedConfigData: '" + JSON.stringify(ConfigData) + "'");

    const FsSourcePath = path.join(ImageDestinationDir, "fs.bin");
    console.info("EFU: FsSourcePath: '" + FsSourcePath + "'");
    var PlatformInfo = await FSimage.GenerateFsImage(ToolsLocation, PathToDists, ConfigData, ImageDestinationDir);
    console.info("EFU: Make FS image - done");

    var FwSourcePath = "";
    var TargetName = "";
    var EfuTarget = "";

    // search the files looking for the app.bin file
    for(currentFileIndex in PlatformInfo.binfiles)
    {
        // console.info("EFU: currentFile: " + PlatformInfo.binfiles[currentFileIndex].name);
        let headPosition = PlatformInfo.binfiles[currentFileIndex].name.search(/\//);
        let tailposition = PlatformInfo.binfiles[currentFileIndex].name.search(/-app.bin/);
        // console.info("EFU: tailposition: '" + tailposition + "'");

        if(-1 !== tailposition)
        {
            FwSourcePath = path.join(path.join(PathToDists, "ESPixelStick_Firmware-" + ConfigData.version.name), "firmware");
            FwSourcePath = path.join(FwSourcePath, PlatformInfo.binfiles[currentFileIndex].name);
            TargetName = PlatformInfo.binfiles[currentFileIndex].name.substring(headPosition, tailposition);
            EfuTarget = path.join(ImageDestinationDir, TargetName + ".efu");
        }
    }
    console.info("EFU: EfuTarget: '" + EfuTarget + "'");
    console.info("EFU: FwSourcePath: '" + FwSourcePath + "'");
    if("" === FwSourcePath)
    {
        console.error("Could not get a valid Firmware image.");
        return "";
    }
    console.info("EFU: create the combined FS + Bin image");

    let FsData = fs.readFileSync(FsSourcePath);
    console.info("EFU:  FsData size: '" + FsData.length + "'");
    let BinData = fs.readFileSync(FwSourcePath);
    console.info("EFU: BinData size: '" + BinData.length + "'");

/*
    Sketch + LittleFS combined OTA format
        32bit signature
        16bit version

        {n # of records}
        16bit record type
        32bit size
        {x bytes of data}
*/
    console.info("EFU: Write header");
    let Offset = 0;
    var sigBuf = Buffer.alloc(4 + 2 + 2 + 4);
    sigBuf.write(SIGNATURE, Offset);              Offset = Offset + 3;
    sigBuf.writeInt8(0x00, Offset);               Offset = Offset + 1; // null terminator
    sigBuf.writeUInt16BE(VERSION, Offset);        Offset = Offset + 2;
    sigBuf.writeUInt16BE(SKETCH_IMAGE, Offset);   Offset = Offset + 2;
    sigBuf.writeUInt32BE(BinData.length, Offset); Offset = Offset + 4;
    fs.writeFileSync(EfuTarget,sigBuf, { flag: "w" });

    console.info("EFU: Write Sketch Image");
    fs.writeFileSync(EfuTarget,BinData, { flag: "a+" });

    var fsRecordHeader = Buffer.alloc(2 + 4);
    offset = 0;
    fsRecordHeader.writeUInt16BE(FS_IMAGE, offset);      offset = offset + 2;
    fsRecordHeader.writeUInt32BE(FsData.length, offset); offset = offset + 4
    fs.writeFileSync(EfuTarget, fsRecordHeader, { flag: "a+" });
    console.info("EFU: Write FS Image");
    fs.writeFileSync(EfuTarget, FsData, { flag: "a+" });
/*
    // add file terminator
    offset = 0;
    fsRecordHeader.writeUInt16BE(0, offset); offset = offset + 2;
    fsRecordHeader.writeUInt32BE(0, offset); offset = offset + 4
    fs.writeFileSync(EfuTarget, fsRecordHeader, { flag: "a+" });
*/
    var FileStat = fs.statSync(EfuTarget);
    console.info("EFU: Build Image Done. Size: " + FileStat.size);

    // build the URLs
    const SessionUrl = RootUrl + SessionDir;
    const ManifestUrl = SessionUrl + "/manifest.json";
    const EfuUrl = SessionUrl + "/" + TargetName + ".efu";
    console.info("EFU:  SessionUrl: " + SessionUrl);
    console.info("EFU: ManifestUrl: " + ManifestUrl);
    console.info("EFU:      EfuUrl: " + EfuUrl);

    // make the manifest
    // read the manifest into memory
    currentManifest = require(path.join(__dirname, "/manifest.json"));
    currentManifest.builds[0].chipFamily = PlatformInfo.chip.toString().toUpperCase();
    currentManifest.builds[0].parts[0].path = EfuUrl;

    ManifestTarget = path.join(ImageDestinationDir, "manifest.json");
    console.info("EFU: ManifestTarget: " + ManifestTarget);
    fs.writeFileSync (ManifestTarget, JSON.stringify(currentManifest), function(err)
    {
        if (err) throw err;
        // console.log('complete');
    });

    // clean up the files to remove sensitive data
    fs.rmSync(path.join(ImageDestinationDir, "fs.bin"), {force: true});
    fs.rmSync(path.join(ImageDestinationDir, "fs"), {force: true, recursive: true });

    return (ManifestUrl);
}; // GenerateEfuImage
