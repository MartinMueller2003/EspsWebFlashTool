// ESPS Web Flashtool

var StatusRequestTimer = null;
let ExpectedStartingFileIndex = 0;
var DiagTimer = null;

// global data
var System_Config = null;
var Firmware_Boards = null;
var ManifestUrl = null;
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
RequestFirmware();
RequestConfig();

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
        $('#btn_flash').prop("disabled", ValidateConfigFields($("#network #wifi input")));
    }));

    $('#eth #dhcp').on("change", (function () {
        // console.info("Got #eth #dhcp Change Notification")
        if ($(this).is(':checked')) {
            $('.ethdhcp').addClass('hidden');
        }
        else {
            $('.ethdhcp').removeClass('hidden');
        }
        $('#btn_flash').prop("disabled", ValidateConfigFields($("#network #wifi input")));
    }));

    $('#network').on("input", (function () {
        $('#btn_flash').prop("disabled", ValidateConfigFields($("#network #wifi input")));
    }));

    $('#btn_flash').on("click", (function () {
        GetFlashImage();
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

async function RequestManifest()
{
    // console.log("RequestManifest");

    let ManifestRequest = {};
    ManifestRequest.system = System_Config;
    ManifestRequest.platform = $('#BoardSelector').find(":selected").val();

    // console.info("ManifestRequest: " + JSON.stringify(ManifestRequest));

    await $.post("HTTPS://" + target + ApiHdr + "manifest" , ManifestRequest, function(data)
    {
        // ManifestUrl = JSON.stringify(data);
        ManifestUrl = data;
        // console.log("RequestManifest reply: " + ManifestUrl);
        return true;
    })
    .fail(function()
    {
        console.error("Could not get manifest file: ");
        return false;
    });

} // RequestConfig

async function ReleaseManifest()
{
    console.info("ReleaseManifest: " + ManifestUrl);
    let ManifestRequest = {};
    ManifestRequest.manifest = ManifestUrl;

    await $.delete("HTTPS://" + target + ApiHdr + "sessions" , ManifestRequest, function(data)
    {
        console.log("RequestManifest reply: " + ManifestUrl);
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

} // ProcessReceivedJsonConfigMessage

async function RequestFirmware()
{
    // console.log("RequestFirmware FileName: firmware.json");
    let data = "";
    await $.getJSON("HTTPS://" + target + ApiHdr + "firmware", function(data)
    {
        // console.log("RequestFirmware: " + JSON.stringify(data));
        ProcessReceivedJsonFirmwareMessage(data);
        return true;
    })
    .fail(function()
    {
        console.error("Could not get Firmware list");
        return false;
    });

} // RequestFirmware

function ProcessReceivedJsonFirmwareMessage(JsonData) {
    // console.info("ProcessReceivedJsonFirmwareMessage: Start");

    // is this a board config?
    if ({}.hasOwnProperty.call(JsonData, "boards")) {
        Firmware_Boards = JsonData.boards;
        // console.info("Got Firmware Config: " + JSON.stringify(Firmware_Boards) );

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

    // is this an ACK response?
    else if ({}.hasOwnProperty.call(JsonData, "OK")) {
        // console.info("Received Acknowledgement to Firmware set command.")
    }

    else {
        console.error("unknown Firmware record type has been ignored.")
    }
    // console.info("ProcessReceivedJsonFirmwareMessage: Done");
} // ProcessReceivedJsonConfigMessage

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

} // ExtractNetworkConfigFromHtmlPage

async function GetFlashImage()
{
    // console.info("Set up manifest");

    // get the current configuration
    ExtractNetworkConfigFromHtmlPage();

    // Ask the server to create an image and manifest
    await RequestManifest();

    // tell the flash tool to take over
    console.info("ManifestUrl: '" + ManifestUrl + "'");
    $("#FlashButton").attr("manifest", ManifestUrl);
    document.querySelector('esp-web-install-button').shadowRoot.children.activate.children[0].click();
    ReleaseManifest();

} // GetFlashImage

function ValidateConfigFields(ElementList) {
    // return true if errors were found
    let response = false;

    for (let ChildElementId = 0;
        ChildElementId < ElementList.length;
        ChildElementId++) {
        let ChildElement = ElementList[ChildElementId];
        // let ChildType = ChildElement.type;

        if ((ChildElement.validity.valid !== undefined) && (!$(ChildElement).hasClass('hidden'))) {
            // console.info("ChildElement.validity.valid: " + ChildElement.validity.valid);
            if (false === ChildElement.validity.valid) {
                // console.info("          Element: " + ChildElement.id);
                // console.info("   ChildElementId: " + ChildElementId);
                // console.info("ChildElement Type: " + ChildType);
                response = true;
            }
        }
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
