/*
    manifest.js - Functions to create and manage flash tool manifests
 */

const crypto = require('crypto');
var fs = require("fs");

exports.GenerateImageAndManifest = function (DistLocation, ConfigData, ImageDestinationDir)
{
        console.info("DistLocation: '" + DistLocation + "'");
        console.info("ConfigData: '" + ConfigData.platform + "'");

        ImageDestinationDir = ImageDestinationDir + crypto.randomBytes(16).toString('hex');
        console.info("ImageDestination: '" + ImageDestinationDir + "'");

        fs.mkdirSync(ImageDestinationDir, { recursive: true });

}; // GenerateImageAndManifest
