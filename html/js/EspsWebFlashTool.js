// ESPS Web Flashtool

var StatusRequestTimer = null;
let ExpectedStartingFileIndex = 0;
var DiagTimer = null;

// global data
var System_Config = null;
var Firmware_Boards = null;
var VersionList = null;
var FirmwareImageManifestUrl = null;
var EfuFirmwareImageManifestUrl = null;
var EfuImageUrl = null;
var EfuImageData;
var EfuFileHandle = null;
var selector = [];
var target = document.location.host;
// target = "192.168.10.233";

var ServerTransactionTimer = null;
var CompletedServerTransaction = true;
var DocumentIsHidden = false;
const ApiHdr = "/api/ESPSWFT/v1/";
const SessionHdr = ApiHdr + "session";

// Default modal properties
$.fn.modal.Constructor.DEFAULTS.backdrop = 'static';
$.fn.modal.Constructor.DEFAULTS.keyboard = false;

class Semaphore {
    /**
     * Creates a semaphore that limits the number of concurrent Promises being handled
     * @param {*} maxConcurrentRequests max number of concurrent promises being handled at any time
     */
    constructor(maxConcurrentRequests = 1) {
        this.currentRequests = [];
        this.runningRequests = 0;
        this.maxConcurrentRequests = maxConcurrentRequests;
    }

    /**
     * Returns a Promise that will eventually return the result of the function passed in
     * Use this to limit the number of concurrent function executions
     * @param {*} fnToCall function that has a cap on the number of concurrent executions
     * @param  {...any} args any arguments to be passed to fnToCall
     * @returns Promise that will resolve with the resolved value as if the function passed in was directly called
     */
    callFunction(fnToCall, ...args) {
        return new Promise((resolve, reject) => {
            this.currentRequests.push({
                resolve,
                reject,
                fnToCall,
                args,
            });
            this.tryNext();
        });
    }

    tryNext() {
        if (!this.currentRequests.length) {
            return;
        } else if (this.runningRequests < this.maxConcurrentRequests) {
            let { resolve, reject, fnToCall, args } = this.currentRequests.shift();
            this.runningRequests++;
            let req = fnToCall(...args);
            req.then((res) => resolve(res))
                .catch((err) => reject(err))
                .finally(() => {
                    this.runningRequests--;
                    this.tryNext();
                });
        }
    }
} // callFunction

const ServerAccess = new Semaphore(1);

// lets get started
// MonitorServerConnection();
RequestConfig();
RequestVersionList();

// jQuery doc ready
$(function ()
{
    // DHCP field toggles
    $('#wifi #dhcp').on("change", (function () {
        // console.info("Got #wifi #dhcp Change Notification")
        if ($(this).is(':checked')) {
            $('.wifiDhcp').addClass('hidden');
        }
        else {
            $('.wifiDhcp').removeClass('hidden');
        }
        $('#btn_flash').prop("disabled", !ValidateConfigFields());
        $('#efu_create').prop("disabled", !ValidateConfigFields());
        $('#efu_ota').prop("disabled", !ValidateConfigFields());
    }));

    $('#eth #dhcp').on("change", (function () {
        // console.info("Got #eth #dhcp Change Notification")
        if ($(this).is(':checked')) {
            $('.ethdhcp').addClass('hidden');
        }
        else {
            $('.ethdhcp').removeClass('hidden');
        }
        $('#btn_flash').prop("disabled", !ValidateConfigFields());
        $('#efu_create').prop("disabled", !ValidateConfigFields());
        $('#efu_ota').prop("disabled", !ValidateConfigFields());
    }));

    $('#network').on("input", (function () {
        // console.info("Change on network page");
        $('#btn_flash').prop("disabled", !ValidateConfigFields());
        $('#efu_create').prop("disabled", !ValidateConfigFields());
        $('#efu_ota').prop("disabled", !ValidateConfigFields());
    }));

    $('#btn_flash').on("click", (function () {
        GetFlashImage();
    }));

    $('#efu_create').on("click", (function () {
        GetEfuImage();
    }));

    $('#efu_ota').on("click", (function () {
        EfuOtaUpdate();
    }));

    $('#VersionSelector').on("change", (function () {
        RequestSupportedPlatformsList();
    }));

    // Halt server health check if document is not visible
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            DocumentIsHidden = true;
        } else {
            DocumentIsHidden = false;
        }
    });

});

async function RequestConfig()
{
    // console.log("RequestConfig: ");

    await $.getJSON("HTTPS://" + target + ApiHdr + "config", function(data)
    {
        // console.log("RequestConfig: " + JSON.stringify(data));
        ProcessReceivedJsonConfigMessage(data);
        return true;
    })
    .fail(function()
    {
        console.error("Could not get config data");
        return false;
    });

} // RequestConfig

async function RequestFirmwareImageManifestUrl()
{
    // console.log("RequestFirmwareImageManifestUrl");

    let ManifestRequest = {};
    ManifestRequest.system = System_Config;
    ManifestRequest.platform = $('#BoardSelector').find(":selected").val();
    var VersionString = $('#VersionSelector').find(":selected").val();
    const VersionArray = VersionString.split(",");
    ManifestRequest.version =
    {
        "date" : VersionArray[0],
        "time" : VersionArray[1],
        "name" : VersionArray[2]
    };

    // console.info("ManifestRequest: " + JSON.stringify(ManifestRequest));

    await $.post("HTTPS://" + target + ApiHdr + "manifest" , ManifestRequest, function(data)
    {
        FirmwareImageManifestUrl = data;
        // console.log("RequestFirmwareImageManifestUrl reply: " + FirmwareImageManifestUrl);
        return true;
    })
    .fail(function()
    {
        console.error("Could not get manifest file: ");
        return false;
    });

} // RequestFirmwareImageManifestUrl

async function RequestEfuFirmwareImageManifestUrl()
{
    // console.info("RequestEfuFirmwareImageManifestUrl");

    let EfuRequest = {};
    EfuRequest.system = System_Config;
    EfuRequest.platform = $('#BoardSelector').find(":selected").val();
    var VersionString = $('#VersionSelector').find(":selected").val();
    const VersionArray = VersionString.split(",");
    EfuRequest.version =
    {
        "date" : VersionArray[0],
        "time" : VersionArray[1],
        "name" : VersionArray[2]
    };

    // console.info("EfuRequest: " + JSON.stringify(EfuRequest));

    await $.post("HTTPS://" + target + ApiHdr + "efu" , EfuRequest, function(data)
    {
        EfuFirmwareImageManifestUrl = data;
        // console.info("RequestEfuFirmwareImageManifestUrl reply: " + EfuFirmwareImageManifestUrl);
        return true;
    })
    .fail(function()
    {
        console.error("Could not get EFU file: ");
        return false;
    });

} // RequestEfuFirmwareImageManifestUrl

async function RequestEfuFirmwareImageManifest()
{
    // console.log("RequestEfuFirmwareImageManifest");
    let data = "";
    await $.getJSON("HTTPS://" + target + EfuFirmwareImageManifestUrl, async function(data)
    {
        // console.info("RequestEfuFirmwareImageManifest: " + JSON.stringify(data));
        EfuImageUrl = data.builds[0].parts[0].path;
        // console.info("EfuImageUrl: " + EfuImageUrl);
        return true;
    })
    .fail(function()
    {
        console.error("Could not get EFU Manifest");
        return false;
    });

} // RequestEfuFirmwareImageManifest

function RequestEfuFirmwareImage()
{
    // console.info("RequestEfuFirmwareImage");
    const req = new XMLHttpRequest();
    let url = "HTTPS://" + target + EfuImageUrl;
    req.open("GET", url, true);
    req.responseType = "blob";

    req.onload = (event) =>
    {
        EfuImageData = req.response;
        console.info("EfuImageData.size: " + EfuImageData.size);
        if(null !== EfuFileHandle)
        {
            SaveEfuFirmwareImage();
        }
        else
        {
            TransmitEfuImageToDevice();
        }
    };
    req.send();
} // RequestEfuFirmwareImage

async function SaveEfuFirmwareImage()
{
    // console.info("SaveEfuFirmwareImage");
    const writableStream = await EfuFileHandle.createWritable();
    await writableStream.write(EfuImageData);
    await writableStream.close();
    window.alert("Save EFU Complete");
} // SaveEfuFirmwareImage

async function TransmitEfuImageToDevice()
{
    console.info("TransmitEfuImageToDevice");
    let TargetDeviceIp = $('#ota_ip').val();
    console.info("ota_ip: " + TargetDeviceIp);

    let FileXfer = new XMLHttpRequest();
    FileXfer.upload.addEventListener("progress", progressHandler, false);
    FileXfer.addEventListener("load", completeHandler, false);
    FileXfer.addEventListener("error", errorHandler, false);
    FileXfer.addEventListener("abort", abortHandler, false);
    FileXfer.open("POST", "https://" + TargetDeviceIp + "/updatefw");
    FileXfer.send(EfuImageData);
    $("#EfuProgressBar").value = 0; //will clear progress bar after successful upload
    $("#EfuProgressBar").removeClass("hidden");

    function _(el)
    {
        return document.getElementById(el);
    }

    function progressHandler(event)
    {
        let percent = (event.loaded / event.total) * 100;
        _("EfuProgressBar").value = Math.round(percent);
    }

    function completeHandler(event)
    {
        console.info("Status: " + event.target.responseText);
        $("#EfuProgressBar").value = 0; //will clear progress bar after successful upload
        $("#EfuProgressBar").addClass("hidden");
    }

    function errorHandler(event)
    {
        console.error("EFU Transfer Error");
        console.info("Status: " + event.target.responseText);
        $("#EfuProgressBar").addClass("hidden");
        window.alert("EFU Transfer Error");
    }

    function abortHandler(event)
    {
        console.error("EFU Transfer Abort");
        console.info("Status: " + event.target.responseText);
        $("#EfuProgressBar").addClass("hidden");
        window.alert("EFU Transfer Abort");
    }
} // TransmitEfuImageToDevice

async function ReleaseManifest()
{
    // console.info("ReleaseManifest: " + FirmwareImageManifestUrl);
    let ManifestRequest = {};
    ManifestRequest.manifest = FirmwareImageManifestUrl;

    await $.delete("HTTPS://" + target + ApiHdr + "sessions" , ManifestRequest, function(data)
    {
        // console.log("RequestFirmwareImageManifestUrl reply: " + FirmwareImageManifestUrl);
        return true;
    })
    .fail(function()
    {
        console.error("Could not release manifest");
        return false;
    });

} // ReleaseManifest

function ProcessReceivedJsonConfigMessage(JsonConfigData) {
    // console.info("ProcessReceivedJsonConfigMessage: Start");

    // is this a device config?
    if ({}.hasOwnProperty.call(JsonConfigData, "system")) {
        System_Config = JsonConfigData.system;
        // console.info("Got System Config: " + JSON.stringify(System_Config) );

        updateFromJSON(System_Config);

        $('#network #devicename').val(System_Config.device.id);

        if ($('#wifi #dhcp').is(':checked')) {
            $('.wifiDhcp').addClass('hidden');
        }
        else {
            $('.wifiDhcp').removeClass('hidden');
        }

        if ($('#eth #dhcp').is(':checked')) {
            $('.ethdhcp').addClass('hidden');
        }
        else {
            $('.ethdhcp').removeClass('hidden');
        }

        if ({}.hasOwnProperty.call(System_Config.network, 'eth')) {
            $('#pg_network #network #eth').removeClass("hidden")
        }
        else {
            $('#pg_network #network #eth').addClass("hidden")
        }
    }

    // is this an ACK response?
    else if ({}.hasOwnProperty.call(JsonConfigData, "OK")) {
        // console.info("Received Acknowledgement to config set command.")
    }


    else {
        console.error("unknown configuration record type has been ignored.")
    }

    // console.info("ProcessReceivedJsonConfigMessage: Done");
    $('#btn_flash').prop("disabled", !ValidateConfigFields());
    $('#efu_create').prop("disabled", !ValidateConfigFields());
    $('#efu_ota').prop("disabled", !ValidateConfigFields());

} // ProcessReceivedJsonConfigMessage

async function RequestVersionList()
{
    // console.log("RequestVersionList");
    let data = "";
    await $.getJSON("HTTPS://" + target + ApiHdr + "versions", async function(data)
    {
        // console.log("RequestVersionList: " + JSON.stringify(data));
        await ProcessReceivedJsonVersionsMessage(data);
        return true;
    })
    .fail(function()
    {
        console.error("Could not get Versions list");
        return false;
    });

} // RequestVersionList

async function ProcessReceivedJsonVersionsMessage(JsonData) {
    // console.info("ProcessReceivedJsonVersionsMessage: Start");

    VersionList = JsonData;
    // console.log("VersionList : " + JSON.stringify(VersionList));
    // sort most recent first
    VersionList.sort(function (a, b)
    {
        // console.info("a.date: " + a.date);
        // console.info("b.date: " + b.date);
        let response = -1;
        if(Date.parse(a.date) == Date.parse(b.date))
        {
            response = 0;
        }
        else if(Date.parse(a.date) < Date.parse(b.date))
        {
            response = 1
        }
        // console.info("response: " + response);
        return response;
    });
    // console.log("VersionList : " + JSON.stringify(VersionList));

    // clear the existing list of versions
    $("#VersionSelector").find('option').remove();

    // iterate the list of versions and
    // build selection list
    $.each (VersionList, function (index, Currentversion)
    {
        $('<option/>', { value : Currentversion.date + "," + Currentversion.time + "," + Currentversion.name }).text(Currentversion.name + " " + Currentversion.date + ":" + Currentversion.time).appendTo('#VersionSelector');
        // console.info("name: '" + Currentversion.name + "'");
        // console.info("date: '" + Currentversion.date + "'");
        // console.info("time: '" + Currentversion.time + "'");
    });

    // update the firmware list based on the version being processed
    await RequestSupportedPlatformsList();
} // ProcessReceivedJsonVersionsMessage

async function RequestSupportedPlatformsList()
{
    // console.log("RequestSupportedPlatformsList");
    let data = "";
    var VersionString = $('#VersionSelector').find(":selected").val();
    if(VersionString === undefined)
    {
        return;
    }
    const VersionArray = VersionString.split(",");

    let FirmwareRequest = {"version" :
    {
        "date" : VersionArray[0],
        "time" : VersionArray[1],
        "name" : VersionArray[2]
    }};

    await $.post("HTTPS://" + target + ApiHdr + "firmware" , FirmwareRequest, async function(data)
    {
        // console.log("RequestSupportedPlatformsList response: " + JSON.stringify(data));
        await ProcessReceivedJsonFirmwareMessage(data);
        return true;
    })
    .fail(function()
    {
        console.error("Could not get Firmware list");
        return false;
    });

} // RequestSupportedPlatformsList

async function ProcessReceivedJsonFirmwareMessage(JsonData) {
    // console.info("ProcessReceivedJsonFirmwareMessage: Start");

    // is this a board config?
    if ({}.hasOwnProperty.call(JsonData, "boards")) {
        Firmware_Boards = JsonData.boards;
        // console.info("Got Firmware Config: " + JSON.stringify(Firmware_Boards) );

        // clear the current list
        $("#BoardSelector").find('option').remove();

        // iterate the list of boards and 
        // build selection list
        $.each (Firmware_Boards, function (index, CurrentBoard)
        {
            $('<option/>', { value : CurrentBoard.name }).text(CurrentBoard.name).appendTo('#BoardSelector');
            // console.info("CurrentBoard: '" + CurrentBoard.name + "'");
        });

        // now sort the options
        $("#BoardSelector").html($("#BoardSelector option").sort(function (a, b)
        {
            return a.text == b.text ? 0 : a.text < b.text ? -1 : 1
        }));
    }

    else {
        console.error("unknown Firmware response has been ignored.")
    }
    // console.info("ProcessReceivedJsonFirmwareMessage: Done");
} // ProcessReceivedJsonFirmwareMessage

// Builds jQuery selectors from JSON data and updates the web interface
function updateFromJSON(obj) {
    for (let k in obj) {
        selector.push('#' + k);
        if (typeof obj[k] === 'object' && obj[k] !== null) {
            updateFromJSON(obj[k]);
        }
        else {
            let jqSelector = selector.join(' ');
            if (typeof obj[k] === 'boolean') {
                $(jqSelector).prop('checked', obj[k]);
            }
            else {
                $(jqSelector).val(obj[k]);
            }

            // Trigger keyup / change events
            $(jqSelector).trigger('keyup');
            $(jqSelector).trigger('change');
        }
        selector.pop();
    }

    // Update Device ID in footer
    $('#device-id').text($('#config #id').val());
} // updateFromJSON

// Builds JSON config submission for "WiFi" tab
function ExtractNetworkWiFiConfigFromHtmlPage() {
    let wifi = System_Config.network.wifi;
    wifi.ssid = $('#network #wifi #ssid').val();
    wifi.passphrase = $('#network #wifi #passphrase').val();
    wifi.sta_timeout = $('#network #wifi #sta_timeout').val();
    wifi.ip = $('#network #wifi #ip').val();
    wifi.netmask = $('#network #wifi #netmask').val();
    wifi.gateway = $('#network #wifi #gateway').val();
    wifi.dnsp = $('#network #wifi #dnsp').val();
    wifi.dnss = $('#network #wifi #dnss').val();
    wifi.dhcp = $('#network #wifi #dhcp').prop('checked');
    wifi.ap_ssid = $('#network #wifi #ap_ssid').val();
    wifi.ap_passphrase = $('#network #wifi #ap_passphrase').val();
    wifi.ap_channel = $('#network #wifi #ap_channel').val();
    wifi.ap_fallback = $('#network #wifi #ap_fallback').prop('checked');
    wifi.ap_reboot = $('#network #wifi #ap_reboot').prop('checked');
    wifi.ap_timeout = $('#network #wifi #ap_timeout').val();
    wifi.StayInApMode = $('#network #wifi #StayInApMode').prop('checked');

} // ExtractNetworkWiFiConfigFromHtmlPage

function ExtractNetworkEthernetConfigFromHtmlPage() {
    if ({}.hasOwnProperty.call(System_Config.network, "eth")) {
        System_Config.network.weus = $('#network #eth #weus').prop('checked');

        System_Config.network.eth.ip = $('#network #eth #ip').val();
        System_Config.network.eth.netmask = $('#network #eth #netmask').val();
        System_Config.network.eth.gateway = $('#network #eth #gateway').val();
        System_Config.network.eth.dnsp = $('#network #eth #dnsp').val();
        System_Config.network.eth.dnss = $('#network #eth #dnss').val();
        System_Config.network.eth.dhcp = $('#network #eth #dhcp').prop('checked');
        System_Config.network.eth.addr = $('#network #eth #addr').val();
        System_Config.network.eth.activedelay = $('#network #eth #activedelay').val();
    }

} // ExtractNetworkEthernetConfigFromHtmlPage

// Builds JSON config submission for "Network" tab
function ExtractNetworkConfigFromHtmlPage() {
    System_Config.network.hostname = $('#hostname').val();

    ExtractNetworkWiFiConfigFromHtmlPage();
    ExtractNetworkEthernetConfigFromHtmlPage();

    // console.info(JSON.stringify(System_Config));

} // ExtractNetworkConfigFromHtmlPage

async function GetFlashImage()
{
    // console.info("Set up manifest");

    // get the current configuration
    ExtractNetworkConfigFromHtmlPage();

    // Ask the server to create an image and manifest
    await RequestFirmwareImageManifestUrl();

    // tell the flash tool to take over
    // console.info("FirmwareImageManifestUrl: '" + FirmwareImageManifestUrl + "'");
    $("#FlashButton").attr("manifest", FirmwareImageManifestUrl);
    $("#FlashButton").attr("showLog", true);

    const InstallButton = document.querySelector('esp-web-install-button');
    await InstallButton.shadowRoot.children.activate.children[0].click();

} // GetFlashImage

async function GetEfuImage()
{
    // console.info("Set up manifest");

    // get the current configuration
    ExtractNetworkConfigFromHtmlPage();
    var DeviceType =$('#BoardSelector').find(":selected").val();
    // console.info("DeviceType: " + DeviceType);

    // ask for a place to save the image
    const opts =
    {
        suggestedName: DeviceType,
        startIn: "downloads",
        types: [
          {
            description: "EFU Image file",
            accept: { "application/binary": [".efu"] },
          },
        ],
      };
    EfuFileHandle = await showSaveFilePicker(opts);
    // console.info("EfuFileHandle: " + EfuFileHandle);

    // Ask the server to create an image and manifest
    await RequestEfuFirmwareImageManifestUrl();
    await RequestEfuFirmwareImageManifest();
    await RequestEfuFirmwareImage();

} // GetEfuImage

async function EfuOtaUpdate()
{
    console.info("EfuOtaUpdate");

    // get the current configuration
    ExtractNetworkConfigFromHtmlPage();

    EfuFileHandle = null
    // console.info("EfuFileHandle: " + EfuFileHandle);

    // Ask the server to create an image and manifest
    await RequestEfuFirmwareImageManifestUrl();
    await RequestEfuFirmwareImageManifest();
    await RequestEfuFirmwareImage();

} // GetEfuImage

function ValidateConfigFields() {
    // console.info("ValidateConfigFields");
    // return false if errors were found
    let response = true;

    let inputs = document.querySelectorAll('#network .required-entry, input');

    if(undefined !== inputs)
    {
        inputs.forEach(function(InputElement)
        {
            if ((InputElement.validity.valid !== undefined) &&
                (!$(InputElement).hasClass('hidden')))
            {
                // console.log(InputElement);
                // console.info("InputElement.validity.valid: " + InputElement.validity.valid);
                if (false === InputElement.validity.valid)
                {
                    // console.log(InputElement);
                    // console.info("Invalid Element Value: " + InputElement.value);
                    response = false;
                }
            }
        });
    }

    return response;

} // ValidateConfigFields

// Ping every 4sec
function MonitorServerConnection()
{
    // console.info("MonitorServerConnection");
    let MonitorTransactionRequestInProgress = false;
    let MonitorTransactionPreviousResponse = -1;

    if(null === ServerTransactionTimer)
    {
        // console.info("MonitorServerConnection: Start Timer");
        ServerTransactionTimer = setInterval(async function () 
        {
            // console.info("MonitorServerConnection: Expired");
            if(!CompletedServerTransaction && !MonitorTransactionRequestInProgress && !DocumentIsHidden)
            {
                MonitorTransactionRequestInProgress = true
                let Response = await SendCommand('XP');
                MonitorTransactionRequestInProgress = false;
                // console.info("MonitorServerConnection: " + Response);
                if(MonitorTransactionPreviousResponse !== Response)
                {
                    MonitorTransactionPreviousResponse = Response;
                    $('#wserror').modal((1 === Response) ? "hide" : "show");
                }
            }
            CompletedServerTransaction = false;
        }, 4000);
    }
} // MonitorServerConnection

// Show flash modal
function showFlash() {
    $("#EfuProgressBar").addClass("hidden");
    $('#flashdevice').modal();
} // showFlash

jQuery.each( [ "put", "delete" ], function( i, method ) {
    jQuery[ method ] = function( url, data, callback, type ) {
      if ( jQuery.isFunction( data ) ) {
        type = type || callback;
        callback = data;
        data = undefined;
      }

      return jQuery.ajax({
        url: url,
        type: method,
        dataType: type,
        data: data,
        success: callback
      });
    };
  });

async function SendCommand(command)
{
    // console.info("SendCommand: " + command);
    return fetch("HTTPS://" + target + "/" + command, {
            method: 'POST',
            mode: "cors", // no-cors, *cors, same-origin
            headers: { 'Content-Type': 'application/json' },
            cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
            credentials: "same-origin", // include, *same-origin, omit
            redirect: "follow", // manual, *follow, error
            referrerPolicy: "no-referrer" // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        })
        .then(async webResponse =>
        {
            const isJson = webResponse.headers.get('content-type')?.includes('application/json');
            const data = isJson && await webResponse.json();

            // console.info("SendCommand:webResponse.status: " + webResponse.status);
            // console.info("SendCommand:webResponse.ok: " + webResponse.ok);
            // check for error response
            if (!webResponse.ok) {
                // get error message from body or default to response status
                const error = (data && data.message) || webResponse.status;
                console.error("SendCommand: Error: " + Promise.reject(error));
            }
            else
            {
                // console.info("SendCommand: Transaction complete");
                CompletedServerTransaction = true;
            }
            return webResponse.ok ? 1 : 0;
        })
        .catch(error =>
        {
            console.error('SendCommand: Error: ', error);
            return -1;
        });
} // SendCommand
