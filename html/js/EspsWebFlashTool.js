// ESPS Web Flashtool

var StatusRequestTimer = null;
let ExpectedStartingFileIndex = 0;
var DiagTimer = null;

// global data
var System_Config = null;
var selector = [];
var target = document.location.host;
// target = "192.168.10.233";

var ServerTransactionTimer = null;
var CompletedServerTransaction = true;
var DocumentIsHidden = false;

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
RequestConfigFile("config.json");

// jQuery doc ready
$(function () 
{

    // DHCP field toggles
    $('#wifi #dhcp').on("change", (function () {
        if ($(this).is(':checked')) {
            $('.wifiDhcp').addClass('hidden');
        }
        else {
            $('.wifiDhcp').removeClass('hidden');
        }
        $('#btn_network').prop("disabled", ValidateConfigFields($("#network #wifi input")));
    }));

    $('#eth #dhcp').on("change", (function () {
        if ($(this).is(':checked')) {
            $('.ethdhcp').addClass('hidden');
        }
        else {
            $('.ethdhcp').removeClass('hidden');
        }
        $('#btn_network').prop("disabled", ValidateConfigFields($("#network #wifi input")));
    }));

    $('#network').on("input", (function () {
        $('#btn_network').prop("disabled", ValidateConfigFields($("#network #wifi input")));
    }));

    $('#btn_network').on("click", (function () {
        submitNetworkConfig();
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


function UpdateAdvancedOptionsMode(){
    // console.info("UpdateAdvancedOptionsMode");

    let am = $('#AdvancedOptions');
    let AdvancedModeState = am.prop("checked");

    $(".AdvancedMode").each(function () {
        if (true === AdvancedModeState) {
            $(this).removeClass("hidden");
        }
        else {
            $(this).addClass("hidden");
        }
    });
} // UpdateAdvancedOptionsMode

async function SendConfigFileToServer(FileName = "", DataString = "")
{
    // console.info("FileName: " + FileName);
    // console.info("Data: " + JSON.stringify(Data));

    let ConfigXfer = new XMLHttpRequest();

    ConfigXfer.addEventListener("loadend", function() 
    {
        // console.info("SendConfigFileToServer: Success");
        return 1;
    }, false);
    ConfigXfer.addEventListener("error", function () {
        console.error("SendConfigFileToServer: Error");
        return 0;
    }, false);
    ConfigXfer.addEventListener("abort", function() {
        console.error("SendConfigFileToServer: abort");
        return -1;
    }, false);
    ConfigXfer.open("PUT", "http://" + target + "/conf/" + FileName + ".json");
    ConfigXfer.send(DataString);
    // console.info("DataString: " + DataString);
    // ConfigXfer.send(JSON.stringify(Data));

} // SendConfigFileToServer

async function RequestConfigFile(FileName)
{
    // console.log("RequestConfigFile FileName: " + FileName);

    await $.getJSON("HTTP://" + target + "/conf/" + FileName, function(data)
    {
        // console.log("RequestConfigFile: " + JSON.stringify(data));
        ProcessReceivedJsonConfigMessage(data);
        return true;
    })
    .fail(function()
    {
        console.error("Could not read config file: " + FileName);
        return false;
    });

} // RequestConfigFile


function ParseParameter(name) {
    return (location.search.split(name + '=')[1] || '').split('&')[0];
} // ParseParameter

function UUID() {
    var uuid = (function () {
        var i,
            c = "89ab",
            u = [];
        for (i = 0; i < 36; i += 1) {
            u[i] = (Math.random() * 16 | 0).toString(16);
        }
        u[8] = u[13] = u[18] = u[23] = "-";
        u[14] = "4";
        u[19] = c.charAt(Math.random() * 4 | 0);
        return u.join("");
    })();
    return {
        toString: function () {
            return uuid;
        },
        valueOf: function () {
            return uuid;
        }
    };
} // UUID

function ProcessReceivedJsonConfigMessage(JsonConfigData) {
    // console.info("ProcessReceivedJsonConfigMessage: Start");

    // is this an output config?
    if ({}.hasOwnProperty.call(JsonConfigData, "output_config")) {
        // save the config for later use.
        Output_Config = JsonConfigData.output_config;
        CreateOptionsFromConfig("output", Output_Config);
    }

    // is this an input config?
    else if ({}.hasOwnProperty.call(JsonConfigData, "input_config")) {
        // save the config for later use.
        Input_Config = JsonConfigData.input_config;
        CreateOptionsFromConfig("input", Input_Config);
    }

    // is this a device config?
    else if ({}.hasOwnProperty.call(JsonConfigData, "system")) {
        System_Config = JsonConfigData.system;
        // console.info("Got System Config: " + JSON.stringify(System_Config) );

        updateFromJSON(System_Config);

        if ({}.hasOwnProperty.call(System_Config.network, 'eth')) {
            $('#pg_network #network #eth').removeClass("hidden")
        }
        else {
            $('#pg_network #network #eth').addClass("hidden")
        }

        if ({}.hasOwnProperty.call(System_Config, 'sensor')) {
            $('#TemperatureSensorGrp').removeClass("hidden");
            $('#TemperatureSensorUnits').val(System_Config.sensor.units);
        }
        else {
            $('#TemperatureSensorGrp').addClass("hidden");
        }
    }

    // is this a file list?
    else if ({}.hasOwnProperty.call(JsonConfigData, "files")) {
        ProcessGetFileListResponse(JsonConfigData);
    }

    // is this an admin msg?
    else if ({}.hasOwnProperty.call(JsonConfigData, "admin")) {
        ProcessReceivedJsonAdminMessage(JsonConfigData);
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


function CreateOptionsFromConfig(OptionListName, Config) {
    // console.info("CreateOptionsFromConfig");

    // Set selection column width based on arch which equates to number of outputs for now
    let col = (AdminInfo.arch === 'ESP8266') ? '4' : '2';
    let Channels = Config.channels;

    if ("input" === OptionListName) {
        $('#ecpin').val(Config.ecpin);
    }

    // for each field we need to populate (input vs output)
    Object.keys(Channels).forEach(function (ChannelId) {
        // OptionListName is 'input' or 'output'
        // console.info("ChannelId: " + ChannelId);
        let CurrentChannel = Channels[ChannelId];

        // does the selection box we need already exist?
        if (!$('#' + OptionListName + 'mode' + ChannelId).length) {
            // console.log(`OptionListName: ${OptionListName}`)
            // create the selection box
            $(`#fg_${OptionListName}`).append(`<label class="control-label col-sm-2" for="${OptionListName}${ChannelId}">${GenerateInputOutputControlLabel(OptionListName, ChannelId)}</label>`);
            $(`#fg_${OptionListName}`).append(`<div class="col-sm-${col}"><select class="form-control wsopt" id="${OptionListName}${ChannelId}"></select></div>`);
            $(`#fg_${OptionListName}_mode`).append(`<fieldset id="${OptionListName}mode${ChannelId}"></fieldset>`);

        }

        let jqSelector = "#" + OptionListName + ChannelId;

        // remove the existing options
        $(jqSelector).empty();

        // for each Channel type in the list
        Object.keys(CurrentChannel).forEach(function (SelectionTypeId) {
            // console.info("SelectionId: " + SelectionTypeId);
            if ("type" === SelectionTypeId) {
                // console.info("Set the selector type to: " + CurrentChannel.type);
                $(jqSelector).val(CurrentChannel.type);
                LoadDeviceSetupSelectedOption(OptionListName, ChannelId);
                $(jqSelector).change(function () {
                    // console.info("Set the selector type to: " + CurrentChannel.type);
                    LoadDeviceSetupSelectedOption(OptionListName, ChannelId);
                });
            }
            else {
                let CurrentSection = CurrentChannel[SelectionTypeId];
                // console.info("Add '" + CurrentSection.type + "' to selector");
                $(jqSelector).append('<option value="' + SelectionTypeId + '">' + CurrentSection.type + '</option>');
            }
        }); // end for each selection type
    }); // end for each channel
} // CreateOptionsFromConfig

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
        System_Config.network.eth.type = parseInt($('#network #eth #type option:selected').val(), 10);
        System_Config.network.eth.addr = $('#network #eth #addr').val();
        System_Config.network.eth.power_pin = $('#network #eth #power_pin').val();
        System_Config.network.eth.mode = parseInt($('#network #eth #mode option:selected').val(), 10);
        System_Config.network.eth.mdc_pin = $('#network #eth #mdc_pin').val();
        System_Config.network.eth.mdio_pin = $('#network #eth #mdio_pin').val();
        System_Config.network.eth.activevalue = (parseInt($('#network #eth #activevalue option:selected').val(), 10) === 1);
        System_Config.network.eth.activedelay = $('#network #eth #activedelay').val();
    }

} // ExtractNetworkEthernetConfigFromHtmlPage

// Builds JSON config submission for "Network" tab
function ExtractNetworkConfigFromHtmlPage() {
    System_Config.network.hostname = $('#hostname').val();

    ExtractNetworkWiFiConfigFromHtmlPage();
    ExtractNetworkEthernetConfigFromHtmlPage();

} // ExtractNetworkConfigFromHtmlPage

// Builds JSON config submission for "WiFi" tab
function submitNetworkConfig() {
    System_Config.device.id = $('#config #device #id').val();
    System_Config.device.blanktime = $('#config #device #blanktime').val();
    System_Config.device.miso_pin = $('#config #device #miso_pin').val();
    System_Config.device.mosi_pin = $('#config #device #mosi_pin').val();
    System_Config.device.clock_pin = $('#config #device #clock_pin').val();
    System_Config.device.cs_pin = $('#config #device #cs_pin').val();
    
    ExtractNetworkConfigFromHtmlPage();

    ServerAccess.callFunction(SendConfigFileToServer,"config", JSON.stringify({'system': System_Config}));

} // submitNetworkConfig

function hexToRgb(hex) {
    // console.info("hex: " + hex);
    while (hex.length < 7) { hex = hex.replace("#", "#0"); }
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
} // hexToRgb

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

function int2ip(num) {
    let d = num % 256;
    for (let i = 3; i > 0; i--) {
        num = Math.floor(num / 256);
        d = d + '.' + num % 256;
    }
    return d;
} // int2ip

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

// Show reboot modal
function showReboot() {
    $("#EfuProgressBar").addClass("hidden");
    $('#update').modal('hide');
    $('#reboot').modal();
    setTimeout(function () {
        if ($('#wifi #dhcp').prop('checked')) {
            window.location.assign("/");
        }
        else {
            window.location.assign("http://" + $('#ip').val());
        }
    }, 5000);
} // showReboot

async function SendCommand(command)
{
    // console.info("SendCommand: " + command);
    return fetch("HTTP://" + target + "/" + command, {
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
