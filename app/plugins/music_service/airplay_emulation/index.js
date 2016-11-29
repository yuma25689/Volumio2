'use strict';

var fs = require('fs-extra');
var exec = require('child_process').exec;
var config = new (require('v-conf'))();
var libQ = require('kew');
var dgram = require('dgram'); // 2016/11/28 matuoka add

// Define the UpnpInterface class
module.exports = AirPlayInterface;


function AirPlayInterface(context) {
	// Save a reference to the parent commandRouter
	this.context = context;
	this.commandRouter = this.context.coreCommand;
	// 2016/11/28 matuoka add start
	this.stateMachine = this.context.stateMachine;
    this.logger = this.context.logger;
	// 2016/11/28 matuoka add end
}

AirPlayInterface.prototype.onVolumioStart = function () {
	var self = this;
	this.context.coreCommand.pushConsoleMessage('[' + Date.now() + '] Starting Shairport Sync');
	this.commandRouter.sharedVars.registerCallback('alsa.outputdevice', this.outputDeviceCallback.bind(this));
	this.commandRouter.sharedVars.registerCallback('system.name', this.playerNameCallback.bind(this));
	
	self.startShairportSync();
    return libQ.resolve();
};


AirPlayInterface.prototype.onStop = function () {
};

AirPlayInterface.prototype.onRestart = function () {
};

AirPlayInterface.prototype.onInstall = function () {
};

AirPlayInterface.prototype.onUninstall = function () {
};

AirPlayInterface.prototype.getUIConfig = function () {
};

AirPlayInterface.prototype.setUIConfig = function (data) {
};

AirPlayInterface.prototype.getConf = function (varName) {
};

AirPlayInterface.prototype.setConf = function (varName, varValue) {
};

//Optional functions exposed for making development easier and more clear
AirPlayInterface.prototype.getSystemConf = function (pluginName, varName) {
};

AirPlayInterface.prototype.setSystemConf = function (pluginName, varName) {
};

AirPlayInterface.prototype.getAdditionalConf = function () {
};

AirPlayInterface.prototype.setAdditionalConf = function () {
};

AirPlayInterface.prototype.startShairportSync = function () {
	// Loading Configured output device
	var outdev = this.commandRouter.sharedVars.get('alsa.outputdevice');
	if (outdev != 'softvolume' ) {
		outdev = 'plughw:'+outdev+',0';
	}
	var mixer = this.commandRouter.sharedVars.get('alsa.outputdevicemixer');
	var name = this.commandRouter.sharedVars.get('system.name');


	var fs = require('fs');

	var self = this;
	fs.readFile(__dirname + "/shairport-sync.conf.tmpl", 'utf8', function (err, data) {
		if (err) {
			return console.log(err);
		}

		var conf1 = data.replace("${name}", name);
		var conf2 = conf1.replace("${device}", outdev);
		var conf3 = conf1.replace("${mixer}", mixer);


		fs.writeFile("/etc/shairport-sync.conf", conf2, 'utf8', function (err) {
			if (err) return console.log(err);
			startAirPlay(self);
		});
	});
};

// 2016/11/28 matuoka add start
var lastAirPlayArtist = 'airplayArtist';
var lastAirPlayAlbum = 'airplayAlbum';
var lastAirPlaySong = 'airplaySong';
var lastAirPlayGenre = 'airplayGenre';
// 2016/11/28 matuoka add end

function startAirPlay(self) {
	exec("sudo systemctl restart airplay", function (error, stdout, stderr) {
		if (error !== null) {
			self.context.coreCommand.pushConsoleMessage('[' + Date.now() + '] Shairport-sync error: ' + error);
		}
		else {
			self.context.coreCommand.pushConsoleMessage('[' + Date.now() + '] Shairport-Sync Started');
            // 2016/11/28 matuoka add start
            var socket = dgram.createSocket('udp4');
            socket.bind(5555, function() {
                socket.addMembership('226.0.0.1');
                self.context.coreCommand.pushConsoleMessage('udp airplay track infos receive start');
            });
            socket.on('message', function(msg, rinfo) {
                self.logger.info('ReceiveAirPlayData---');
                var log = 'Received ' + msg.length + 'bytes from' + rinfo.address + ':' + rinfo.port;
                self.logger.info(log);

                // TODO: convert msg to string and set variable lastAirPlay~


                if( self.stateMachine.isVolatile && self.stateMachine.volatileService === "AirPlay" )
                {
                	// warning: call stateMachine internal method(syncState)
                	// {status: sStatus, position: nPosition, seek: nSeek, duration: nDuration, samplerate: nSampleRate, bitdepth: nBitDepth, channels: nChannels, dynamictitle: sTitle}
				   //          status: this.volatileState.status,
				   //          title: this.volatileState.title,
				   //          artist: this.volatileState.artist,
				   //          album: this.volatileState.album,
				   //          albumart: this.volatileState.albumart,
				   //          uri: this.volatileState.uri,
				   //          trackType: this.volatileState.trackType,
				   //          seek: this.volatileState.seek,
				   //          duration: this.volatileState.duration,
				   //          samplerate: this.volatileState.samplerate,
				   //          bitdepth: this.volatileState.bitdepth,
				   //          channels: this.volatileState.channels,
				   //          random: false,
				   //          repeat: false,
				   //          consume: false,
				   //          volume: this.currentVolume,
				   //          mute: this.currentMute,
				   //          stream: false,
				   //          updatedb: false,
				   // volatile: true,
				   //          service: this.volatileState.service
                // trackBlock.trackType = 'webradio';
                // trackBlock.bitdepth = '';
                // trackBlock.samplerate = '';

                	var stateService = {
                		status: 'play',
                		title: 'testTitle',
                		artist: lastAirPlayArtist,
                		album: lastAirPlayAlbum,
                		albumart: '/albumart',
                		uri: null,
                		trackType: '',//lastAirPlayGenre,
                		position: 0,
                		seek: 0,
                		duration: 0,
                		samplerate: '',
                		bitdepth: '',
                		channels: 2,
                		dynamictitle: 'testDynamicTitle',
                		service: 'AirPlay'
                	};
                	self.stateMachine.syncState(stateService,'AirPlay');
                }
            });
            // 2016/11/28 matuoka add end
		}
	});
}

AirPlayInterface.prototype.outputDeviceCallback = function () {
	var self = this;

	self.context.coreCommand.pushConsoleMessage('Output device has changed, restarting Shairport Sync');
	self.startShairportSync()
}


AirPlayInterface.prototype.playerNameCallback = function () {
	var self = this;

	self.context.coreCommand.pushConsoleMessage('System name has changed, restarting Shairport Sync');
	self.startShairportSync()
}

