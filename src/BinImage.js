/*
    BinImage.js - Functions to Create Lists of versions that can be selected
 */

const fs = require("fs");
const path = require('path');

const GenerateVersionList = async function (DistLocation, Response)
{
    // console.info("GenerateVersionList: DistLocation: '" + DistLocation + "'");

    // for each dist in the directory
    fs.readdirSync(DistLocation).forEach(file =>
    {
        // Make one pass and make the file complete
        var DistPath = path.join(DistLocation, file);

        let stat = fs.statSync(DistPath)

        if (stat.isDirectory())
        {
            // console.info("Processing '" + DistPath + "'");
            // console.info("file '" + file + "'");
            let Constant = "ESPixelStick_Firmware-";
            let TargetVersion = file.substring(Constant.length);
            // console.info("TargetVersion '" + TargetVersion + "'");
            GetBuildDate(DistPath, TargetVersion, Response);
            // await GetBuildDate(DistPath, TargetVersion, Response);
        }
    });

    // console.info("GenerateVersionList: Response" + JSON.stringify(Response));
    // console.info("GenerateVersionList - Done");
    return;

}; // GenerateVersionList

// excuse the below, it is a total hack for extracting date/time from the binary build file
const GetBuildDate = async (DistPath, TargetVersion, response) =>
{
    // console.info("GetBuildDate:TargetVersion: '" + TargetVersion + "'");
    // console.info("     GetBuildDate:DistPath: '" + DistPath + "'");

    TargetDate = "";
    // Get the espsv3 ESP8266 build
    var TargetBinPath = path.join(DistPath, "firmware/esp8266/espsv3-app.bin")
    // console.info("GetBuildDate:TargetBinPath: '" + TargetBinPath + "'");

    const bytes = fs.readFileSync(TargetBinPath, { encoding: 'utf8', flag: 'r' });
    // console.info(" fileData: '" + fileData.length + "'");
    // const bytes = fileData.buffer;
    // console.info(" bytes: '" + bytes.length + "'");

    const TargetVersionArray = JSON.stringify(TargetVersion);
    // console.info(" TargetVersionArray: " + TargetVersionArray);

    let DateString = "";
    let TimeString = "";

    for(index = 0; index < bytes.length; index++)
    {
        // find the 4.0-dev string
        // console.info("index: '" + index + "'");
        // console.info("slice: " + JSON.stringify(bytes.slice(index, index + TargetVersion.length)));
        if(TargetVersionArray === JSON.stringify(bytes.slice(index, index + TargetVersion.length)))
        {
            // console.info("Found at index: " + index);

            // extract the build date
            for(DateIndex = index + TargetVersion.length + 1; DateIndex < (index + TargetVersion.length + 50); DateIndex++)
            {
                const byteValue = bytes.charCodeAt(DateIndex).toString(16)
                // console.info(" byte: '" + bytes[DateIndex] + "' '" + byteValue + "'");
                if("0" === byteValue)
                {
                    // console.info("Date end Found at index: " + DateIndex);
                    DateString = JSON.stringify(bytes.slice(index + TargetVersion.length + 1, DateIndex));
                    // console.info("DateString: " + DateString);
                    // skip the time seperator
                    index = DateIndex + 5; // null - null
                    break;
                }
            } // end extract date

            // extract the build time
            for(TimeIndex = index; TimeIndex < index + 25; TimeIndex++)
            {
                const byteValue = bytes.charCodeAt(TimeIndex).toString(16)
                // console.info(" byte: '" + bytes[TimeIndex] + "' '" + byteValue + "'");
                if("0" === byteValue)
                {
                    // console.info("Time end Found at index: " + TimeIndex);
                    TimeString = JSON.stringify(bytes.slice(index, TimeIndex));
                    // console.info("TimeString: " + TimeString);
                    break;
                }
            }
            // exit the search loop
            break;
        } // if(TargetVersionArray === JSON.stringify(bytes.slice(index, index + TargetVersion.length)))
    }
    // generate an entry in the response table

    response.push({
        "name" : TargetVersionArray.replaceAll('"', ""),
        "date" : DateString.replaceAll('"', ""),
        "time" : TimeString.replaceAll('"', "")
    });

    // console.info("GetBuildDate:Response:" + JSON.stringify(response));

    return;
} // GetBuildDate

exports.AwaitGenerateVersionList = async function (DistLocation, Response)
{
    await GenerateVersionList(DistLocation, Response);
    // console.info("GenerateVersionList: Response" + JSON.stringify(Response));

} // GenerateVersionList
