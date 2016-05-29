'use strict';

var fs = require('fs-extra');
var exec = require('child_process').exec;
var config = new (require('v-conf'))();
var libQ = require('kew');
var Inotify = require('inotify').Inotify;


// Define the UpnpInterface class
module.exports = AirPlayInterface;


function AirPlayInterface(context) {
	// Save a reference to the parent commandRouter
	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;

}

AirPlayInterface.prototype.onVolumioStart = function () {
	this.context.coreCommand.pushConsoleMessage('[' + Date.now() + '] Starting Shairport Sync');
	this.commandRouter.sharedVars.registerCallback('alsa.outputdevice', this.outputDeviceCallback.bind(this));
	this.startShairportSync();

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
	var hwdev = 'plughw:' + outdev + ',0';
	console.log(hwdev);

	var systemController = this.commandRouter.pluginManager.getPlugin('system_controller', 'system');
	var name = systemController.getConf('playerName');
	var fs = require('fs');

	var self = this;
	fs.readFile(__dirname + "/shairport-sync.conf.tmpl", 'utf8', function (err, data) {
		if (err) {
			return console.log(err);
		}
		var conf1 = data.replace("${name}", name);
		var conf2 = conf1.replace("${device}", hwdev);

		fs.writeFile("/etc/shairport-sync.conf", conf2, 'utf8', function (err) {
			if (err) return console.log(err);
			startAirPlay(self);
		});
	});
};

function startAirPlay(self) {
	exec("sudo systemctl restart airplay", function (error, stdout, stderr) {
		if (error !== null) {
			self.context.coreCommand.pushConsoleMessage('[' + Date.now() + '] Shairport-sync error: ' + error);
		}
		else {
			self.context.coreCommand.pushConsoleMessage('[' + Date.now() + '] Shairport-Sync Started');
		}
	});
}

AirPlayInterface.prototype.outputDeviceCallback = function () {
	var self = this;

	self.context.coreCommand.pushConsoleMessage('Output device has changed, restarting Shairport Sync');
	self.startShairportSync()
}


AirPlayInterface.prototype.metadataCallback=function(){
	var self=this;

	try
	{
		var content=fs.readJsonSync(self.songFile);
		var content2=fs.readJsonSync(self.progressFile);

		if (content.artist && content.album) {
			var metas = {'artist' : content.artist, 'album' :content.album } ;
			var promise=self.getAlbumArt(metas,content.albumart);
		} else if (content.artist){
			var metas = {'artist': content.artist};
			var promise=self.getAlbumArt(metas,content.albumart);
		} else {
			var promise=self.getAlbumArt({},content.albumart);
		}

		promise.then(function(value){
			self.status.status='play';
			/*
			self.status.title=content.title;
			self.status.artist=content.artist;
			self.status.album=content.album;
			self.status.seek=parseInt(content2.elapsed)*1000;
			self.status.duration=content2.total;
			//console.log(value)
			self.status.albumart=value;
			*/
			self.status.title='prova';
			self.status.artist='prova';
			self.commandRouter.servicePushState(self.status, 'airplay');
		});
	}
	catch(error)
	{
	}
}

AirPlayInterface.prototype.startAirplayPlayback = function (){
	var self = this;
	self.inotify = new Inotify();
	var status={
		status:'play',
		service:'airplay',
		title: 'asd',
		album: 'asd',
		artist: 'asd',
		isStreaming: false
	};


	self.logger.log('Airplay Playback Started')
	//self.metadataFile=self.config.get('progressFile');
	//self.progressWatch=self.addWatch(self.metadataFile,self.metadataCallback.bind(self));
	status.title='prova';
	status.artist='prova';
	self.commandRouter.servicePushState(self.status, 'airplay');
};

AirPlayInterface.prototype.stopAirplayPlayback = function (){
	var self = this;
};


;


AirPlayInterface.prototype.addWatch=function(file,callback){
	var self=this;

	self.logger.info("Adding watch for file "+file);
	var watch = {
		path: file,
		watch_for: Inotify.IN_MODIFY,
		callback: callback
	};

	fs.ensureFileSync(file);
	self.inotify.addWatch(watch);

	return watch;
}
