'use strict';

var libQ = require('kew');

// Define the CoreStateMachine class
module.exports = CoreStateMachine;
function CoreStateMachine(commandRouter) {
	this.unmanagedMode=false;

	this.commandRouter = commandRouter;

	this.currentPosition=0;
	this.currentConsume=false;
	this.prefetchDone=false;
	this.askedForPrefetch=false;
	this.simulateStopStartDone=false;
    this.volatileService="";
    this.volatileState={};
	this.isVolatile = false;
	this.isAirPlay = false;	// 2016/11/28 matuoka add

	this.logger=this.commandRouter.logger;

	this.playQueue = new (require('./playqueue.js'))(commandRouter, this);
	this.resetVolumioState();
}

// Public Methods ---------------------------------------------------------------------------------------
// Get the current state of the player
CoreStateMachine.prototype.getState = function () {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::getState');

    if(this.isVolatile)
    {
		// Here we are in volatile state mode, so we do not take playback informations from the queue but rather from the volatileState
        return {
            status: this.volatileState.status,
            title: this.volatileState.title,
            artist: this.volatileState.artist,
            album: this.volatileState.album,
            albumart: this.volatileState.albumart,
            uri: this.volatileState.uri,
            trackType: this.volatileState.trackType,
            seek: this.volatileState.seek,
            duration: this.volatileState.duration,
            samplerate: this.volatileState.samplerate,
            bitdepth: this.volatileState.bitdepth,
            channels: this.volatileState.channels,
            random: false,
            repeat: false,
            consume: false,
            volume: this.currentVolume,
            mute: this.currentMute,
            stream: false,
            updatedb: false,
			volatile: true,
            service: this.volatileState.service
        };
    }
    else
    {
    	// 2016/11/29 matuoka upd start
        //var trackBlock = this.getTrack(this.currentPosition);
        var trackBlock = undefined;
        if( this.isAirPlay )
        {
        	var trackBlock = {
        		name: 'testName',
        		status: 'play',
        		title: 'testTitle',
        		artist: 'airPlayArtist',
        		album: 'airPlayAlbum',
        		albumart: '/albumart',
        		uri: 'testUri',
        		trackType: 'airplaytracktype',//mp3
        		position: 'testposition',
        		seek: 0,
        		duration: 0,
        		samplerate: '',
        		bitdepth: '',
        		channels: 2,
        		dynamictitle: 'testDynamicTitle',
        		service: 'AirPlay'
        	};
        }
        else
        {
        	trackBlock = this.getTrack(this.currentPosition);
        }
        // 2016/11/29 matuoka upd end
        if(trackBlock===undefined )
        {
            return {
                status: 'stop',
                position: 0,
                title: '',
                artist: '',
                album: '',
                albumart: '/albumart',
                duration:0,
                uri: '',
                seek: 0,
                samplerate: '',
                channels: '',
                bitdepth: '',
                Streaming: false,
                service: 'mpd',
                volume: this.currentVolume,
                mute: this.currentMute,
                random:this.currentRandom,
                repeat: this.currentRepeat,
                updatedb: this.currentUpdate,
                consume: this.currentConsume
            };
        }
        else {
            if (trackBlock.service === 'webradio') {
                trackBlock.trackType = 'webradio';
                trackBlock.bitdepth = '';
                trackBlock.samplerate = '';
            }
            return {
                status: this.currentStatus,
                position: this.currentPosition,
                title: trackBlock.name,
                artist: trackBlock.artist,
                album: trackBlock.album,
                albumart: trackBlock.albumart,
                uri: trackBlock.uri,
                trackType: trackBlock.trackType,
                seek: this.currentSeek,
                duration: trackBlock.duration,
                samplerate: trackBlock.samplerate,
                bitdepth: trackBlock.bitdepth,
                channels: trackBlock.channels,
                random: this.currentRandom,
                repeat: this.currentRepeat,
                consume: this.currentConsume,
                volume: this.currentVolume,
                mute: this.currentMute,
                stream: trackBlock.trackType,
                updatedb: this.currentUpdate,
				volatile: false,
                service: trackBlock.service
            };
        }
    }


};

// Get the current contents of the play queue
CoreStateMachine.prototype.getQueue = function () {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::getQueue');
	return this.playQueue.getQueue();
};

// Remove one item from the queue


// Add array of items to queue
CoreStateMachine.prototype.addQueueItems = function (arrayItems) {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::addQueueItems');

	return this.playQueue.addQueueItems(arrayItems);
};

// Add array of items to queue
CoreStateMachine.prototype.clearQueue = function () {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::ClearQueue');

	this.stop();
	return this.playQueue.clearPlayQueue();

};











// Volumio Stop Command
CoreStateMachine.prototype.stop = function (promisedResponse) {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::stop');

	if (this.currentStatus === 'play') {
		// Play -> Stop transition
		this.currentStatus = 'stop';
		this.currentSeek = 0;
		this.updateTrackBlock();
		return this.serviceStop();

	} else if (this.currentStatus === 'pause') {
		// Pause -> Stop transition
		this.currentStatus = 'stop';
		this.currentSeek = 0;
		this.updateTrackBlock();
		return this.serviceStop();
	}
	else return libQ.resolve();
};

// Volumio Pause Command
CoreStateMachine.prototype.pause = function (promisedResponse) {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::pause');

	if (this.currentStatus === 'play') {
		// Play -> Pause transition
		if (this.currentTrackType === 'webradio') {
			this.currentStatus = 'stop';
			return this.serviceStop();

		} else {
			this.currentStatus = 'pause';
			return this.servicePause();
		}
	}
};


// Internal methods ---------------------------------------------------------------------------
// These are 'this' aware, and may or may not return a promise

// Update the currently active track block
CoreStateMachine.prototype.updateTrackBlock = function () {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::updateTrackBlock');
	this.currentTrackBlock = this.playQueue.getTrackBlock(this.currentPosition);

	return libQ.resolve();
};

// Perform a clear-add-play action on the current track block
CoreStateMachine.prototype.serviceClearAddPlay = function () {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::serviceClearAddPlay');
	var trackBlock = this.currentTrackBlock;
	return this.commandRouter.serviceClearAddPlayTracks(trackBlock.uris, trackBlock.service);
};





// Resume the current track block playback
CoreStateMachine.prototype.serviceResume = function (trackBlock) {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::serviceResume');

	return this.commandRouter.serviceResume(trackBlock.service);
};

// Reset the properties of the state machine
CoreStateMachine.prototype.resetVolumioState = function () {
	var self = this;

	return libQ.resolve()
		.then(function () {
			self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::resetVolumioState');
			self.currentStatus = 'stop';
			self.currentPosition = 0;
			self.currentSeek = 0;
			self.currentDuration = 0;
			self.currentTrackBlock = [];
			self.timeLastServiceStateUpdate = 0;
			self.currentTrackType = null;
			self.timerPlayback = null;
			self.currentTitle = null;
			self.currentArtist = null;
			self.currentAlbum = null;
			self.currentUri = null;
			self.currentAlbumArt = '/albumart';
			self.currentSampleRate = null;
			self.currentBitDepth = null;
			self.currentChannels = null;
			self.currentRandom = null;
			self.currentRepeat = null;
			self.currentVolume = null;
			self.currentMute = null;
			self.currentUpdate = false;
			return self.getcurrentVolume();
		});
};

// Start the timer to track playback time (counts in ms)
CoreStateMachine.prototype.startPlaybackTimer = function (nStartTime) {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::startPlaybackTimer');

	this.runPlaybackTimer=true;
	this.playbackStart=Date.now();

	var trackBlock = this.getTrack(this.currentPosition);

	if(trackBlock){
		this.currentSongDuration=trackBlock.duration*1000;


		this.askedForPrefetch=false;
		this.simulateStopStartDone=false;

		setTimeout(this.increasePlaybackTimer.bind(this),250);
	}
	return libQ.resolve();
};

// Stop playback timer
CoreStateMachine.prototype.stopPlaybackTimer = function () {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::stPlaybackTimer');

	this.runPlaybackTimer=false;
	this.currentSongDuration=0;
	this.askedForPrefetch=false;
	return libQ.resolve();
};

// Stop playback timer
CoreStateMachine.prototype.increasePlaybackTimer = function () {
	var self=this;

	var now=Date.now();
	this.currentSeek+=(now-this.playbackStart);

	if(this.runPlaybackTimer==true)
	{
		this.playbackStart=Date.now();


		var remainingTime=this.currentSongDuration-this.currentSeek;
		if(remainingTime<5000 && this.askedForPrefetch==false)
		{
			this.askedForPrefetch=true;

			var trackBlock = this.getTrack(this.currentPosition);

            var nextIndex=this.currentPosition+1;

            if(this.currentRandom)
            {
                nextIndex=Math.floor(Math.random() * (this.playQueue.arrayQueue.length ));
                this.nextRandomIndex=nextIndex;
            }

            var nextTrackBlock = this.getTrack(nextIndex);

			if(nextTrackBlock!==undefined && nextTrackBlock!==null && nextTrackBlock.service==trackBlock.service)
			{
				this.logger.info("Prefetching next song");

				var plugin = this.commandRouter.pluginManager.getPlugin('music_service', trackBlock.service);
				if(plugin.prefetch!==undefined)
				{
					this.prefetchDone=true;
					plugin.prefetch(nextTrackBlock);
				}
			}
		}

		if(remainingTime<=500 && this.prefetchDone==true && this.simulateStopStartDone==false)
		{

			this.simulateStopStartDone=true;
			this.currentSeek=0;

            if(this.currentConsume)
            {
                this.playQueue.removeQueueItem({value:this.currentPosition});
            }
            else
            {
                if(this.currentRandom)
                    this.currentPosition=this.nextRandomIndex;
                else
                    this.currentPosition++;
            }

            this.nextRandomIndex=undefined;

            this.askedForPrefetch=false;
			this.pushState.bind(this);

			this.startPlaybackTimer();

		} else setTimeout(this.increasePlaybackTimer.bind(this),250);
	}
};




//Update Volume Value
CoreStateMachine.prototype.updateVolume = function (Volume) {

	this.currentVolume = Volume.vol;
	this.currentMute = Volume.mute;
	this.pushState().fail(this.pushError.bind(this));
};

//Gets current Volume and Mute Status
CoreStateMachine.prototype.getcurrentVolume = function () {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::getcurrentVolume');
	this.commandRouter.volumioretrievevolume();
	this.updateTrackBlock();
	return libQ.resolve();
};



// Announce updated Volumio state
CoreStateMachine.prototype.pushState = function () {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::pushState');

	var promise = libQ.defer();

	var state = this.getState();

	var self = this;
	self.commandRouter.volumioPushState(state)
		.then(function (data) {
			self.checkFavourites(state)
				.then(function (a) {
					promise.resolve({});
				})
		});

	return promise.promise;
};

CoreStateMachine.prototype.pushEmptyState = function () {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::pushState');

	var promise = libQ.defer();

	var state = {
		status: 'stop',
		position: 0,
		title: '',
		artist: '',
		album: '',
		albumart: '/albumart',
		duration:0,
		uri: '',
		seek: 0,
		samplerate: '',
		channels: '',
		bitdepth: 0,
		Streaming: false,
		service: 'mpd',
		volume: this.currentVolume,
		random:this.currentRandom,
		repeat: this.currentRepeat,
		updatedb: this.currentUpdate,
		consume: this.currentConsume
	};
	var self = this;
	self.commandRouter.volumioPushState(state)
		.then(function (data) {
			self.checkFavourites(state)
				.then(function (a) {
					promise.resolve({});
				})
		});

	return promise.promise;
};

// Pass the error if we don't want to handle it
CoreStateMachine.prototype.pushError = function (sReason) {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::pushError');
	this.commandRouter.pushConsoleMessage(sReason);
};

// Sync state from service status announcement
// Input state object has the form {status: sStatus, position: nPosition, seek: nSeek, duration: nDuration, samplerate: nSampleRate, bitdepth: nBitDepth, channels: nChannels, dynamictitle: sTitle}
CoreStateMachine.prototype.syncState = function (stateService, sService) {
	var  self = this;
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::syncState');


    if (this.isVolatile && stateService.status == 'play') {
	    this.volatileService = sService;
        this.currentStatus='play';
        this.volatileState=stateService;
        this.pushState().fail(this.pushError.bind(this));
        return;
	}
	else if (this.volatileState && stateService.status == 'stop'){
        this.volatileService = undefined;
        //this.currentStatus='stop';
		var trackBlock = this.getTrack(this.currentPosition);
	}
	else {
        this.volatileService = undefined;

        var trackBlock = this.getTrack(this.currentPosition);
	}

    /**
     *
     *
     *
     */
	if(this.consumeUpdateService){
		if(this.consumeUpdateService!=sService)

		{
			this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CONSUME SERVICE: Received update from a service different from the one supposed to be playing music. Skipping notification. Current '+this.consumeUpdateService+" Received "+sService);
			return;
		}
	} else
	{

		if(trackBlock!=undefined && trackBlock.service!==sService)
		{
			this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'Received update from a service different from the one supposed to be playing music. Skipping notification.Current '+trackBlock.service+" Received "+sService);
			return;
		}

	}

	this.timeLastServiceStateUpdate = Date.now();

	this.commandRouter.logger.info("STATE SERVICE "+JSON.stringify(stateService));

	this.commandRouter.logger.info("CURRENT POSITION "+this.currentPosition);


	if (stateService.isStreaming != undefined) {
		this.isStreaming = stateService.isStreaming;
	}
	else this.isStreaming = false;

	if (this.isStreaming) {
		this.uri = stateService.uri;
	} else {
		this.uri = '/' + stateService.uri;
	}
	this.currentUpdate = stateService.updatedb;

	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::syncState   stateService '+stateService.status);
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::syncState   currentStatus '+this.currentStatus);


	if (stateService.status === 'play') {
		if (this.currentStatus === 'play') {
			this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'Received an update from plaugin. extracting info from payload');

			//checking if prefetch has been done. In that case the update is sent elsewhere
			if(this.askedForPrefetch==false) {


				if (stateService.seek !== undefined) {
					this.currentSeek = stateService.seek;
				}

				if(trackBlock!==undefined)
				{
					if (stateService.duration !== undefined) {
						trackBlock.duration = stateService.duration;
					}

					if (stateService.samplerate !== undefined && trackBlock.samplerate === undefined) {
						trackBlock.samplerate = stateService.samplerate;
					}

					if (stateService.bitdepth !== undefined && trackBlock.bitdepth === undefined) {
						trackBlock.bitdepth = stateService.bitdepth;
					}

					if (stateService.channels !== undefined && trackBlock.channels === undefined) {
						trackBlock.channels = stateService.channels;
					}

					if (stateService.title !== undefined)
					{
						if(trackBlock.service==='webradio'  || trackBlock.name === undefined)
							trackBlock.name = stateService.title;

					}

					if (stateService.artist !== undefined && trackBlock.artist === undefined) {
						trackBlock.artist = stateService.artist;
					}

					if (stateService.album !== undefined && trackBlock.album === undefined) {
						trackBlock.album = stateService.album;
					}

					if (stateService.albumart !== undefined && trackBlock.albumart === undefined) {
						trackBlock.albumart = stateService.albumart;
					}
				}

				this.currentStatus='play';
				this.pushState().fail(this.pushError.bind(this));
			}
		}
		else if (this.currentStatus === 'stop') {

			//this.currentPosition = stateService.position;
			this.currentSeek = stateService.seek;
			this.currentDuration = stateService.duration;
			this.currentTrackType = null;
			this.currentTitle = null;
			this.currentArtist = null;
			this.currentAlbum = null;
			this.currentAlbumArt = '/albumart';
			this.currentUri = stateService.uri;
			this.currentSampleRate = null;
			this.currentBitDepth = null;
			this.currentChannels = null;
			this.currentStatus = 'play';


			/* if (this.currentPosition >= this.playQueue.arrayQueue.length) {
			 this.commandRouter.logger.info("END OF QUEUE ");

			 this.pushState().fail(this.pushError.bind(this));

			 return this.stopPlaybackTimer();

			 } else {
			 this.play();
			 this.pushState().fail(this.pushError.bind(this));
			 }*/
		}
		else if (this.currentStatus === 'pause') {
			this.currentStatus='play';
			this.pushState().fail(this.pushError.bind(this));
		}

	} else if (stateService.status === 'stop') {
		if (this.currentStatus === 'play') {

			// Service has stopped without client request, meaning it is finished playing its track block. Move on to next track block.
			//this.currentPosition = stateService.position;
			this.currentSeek = stateService.seek;
			this.currentDuration = stateService.duration;
			this.currentTrackType = null;
			this.currentTitle = null;
			this.currentArtist = null;
			this.currentAlbum = null;
			this.currentAlbumArt = '/albumart';
			this.currentUri = stateService.uri;
			this.currentSampleRate = null;
			this.currentBitDepth = null;
			this.currentChannels = null;

			this.commandRouter.logger.info("CURRENT POSITION "+this.currentPosition);


            console.log("RANDOM: "+this.currentRandom+ ' OBJ '+JSON.stringify(trackBlock));

            if(trackBlock!==undefined && trackBlock.service!=='webradio')
			{
				if(this.currentConsume!==undefined && this.currentConsume==true)
				{
					this.playQueue.removeQueueItem(this.currentPosition);
				}
				else
				{
                    if(this.currentRandom!==undefined && this.currentRandom===true)
					{
                        var nextSongIndex=0;


                        /**
                         * Using nextRandomIndex because prefetch may have picked one sone randomly
                         * from another service (thus not prefetched). This way we use the same index
                         */
                        if(this.nextRandomIndex)
                            this.currentPosition=this.nextRandomIndex;
                        else
                            this.currentPosition=Math.floor(Math.random() * (this.playQueue.arrayQueue.length ));
					}
					else {
						if(this.currentPosition ==null || this.currentPosition===undefined)
							this.currentPosition=0;
						else this.currentPosition++;
					}
				}
			}


			this.commandRouter.logger.info("CURRENT POSITION "+this.currentPosition);

			this.currentStatus = 'stop';
			//this.consumeUpdateService=undefined;

			if (this.currentPosition >= this.playQueue.arrayQueue.length) {
				this.commandRouter.logger.info("END OF QUEUE ");

				//Queuing following track;
				if(this.currentRepeat!==undefined && this.currentRepeat===true)
				{
					this.currentPosition=0;

					if(this.prefetchDone==false)
					{
						this.play()
							.then(self.pushState.bind(self))
							.fail(this.pushError.bind(this));

						this.askedForPrefetch=false;
						this.simulateStopStartDone=false;
					}
					else
					{
						this.prefetchDone=false;
						this.askedForPrefetch=false;
						this.simulateStopStartDone=false;

						this.logger.info("Prefetch done, skipping queuing");
					}


					this.commandRouter.logger.info("Repeating playlist ");
				}
				else
				{
					this.currentPosition=0;
					this.pushEmptyState().fail(this.pushError.bind(this));

					return this.stopPlaybackTimer();
				}



			} else {
				if(this.prefetchDone==false)
				{
					this.play()
						.then(self.pushState.bind(self))
						.fail(this.pushError.bind(this));

					this.askedForPrefetch=false;
					this.simulateStopStartDone=false;
				}
				else
				{
					this.prefetchDone=false;
					this.askedForPrefetch=false;
					this.simulateStopStartDone=false;
					this.pushState();
					this.logger.info("Prefetch done, skipping queuing");
				}
			}



		} else if (this.currentStatus === 'stop') {
			this.pushState().fail(this.pushError.bind(this));
			this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'No code');
		}
	} else if (stateService.status === 'pause') {
		if (this.currentStatus === 'pause') {
			this.pushState().fail(this.pushError.bind(this));

			return this.stopPlaybackTimer();
		}
	}

	this.pushState().fail(this.pushError.bind(this));

	/*else if (stateService.status === 'undefined') {
	 stateService.status = 'stop';
	 }

	 return libQ.reject('Error: \"' + sService + '\" state \"' + stateService.status + '\" not recognized when Volumio state is \"' + self.currentStatus + '\"');
	 */
};

CoreStateMachine.prototype.checkFavourites = function (state) {

	var defer = libQ.defer();
	var response = {
		service: state.service,
		uri: state.uri,
		favourite: false
	};

	if (state.uri != undefined && state.uri != null) {
		var promise = this.commandRouter.playListManager.listFavourites();
		var self = this;
		promise.then(function (favList) {
			/**
			 * WARNING: The favourites section uses music-library/ to start each uri
			 * This is not used in mpd uris, so we are adding it at the beginning of each uri
			 */
			var list = favList.navigation.lists[0].items;
			var nFavs = list.length;
			for (var i = 0; i < nFavs; i++) {
				var match = self.sanitizeUri(state.uri);
				var listUri= self.sanitizeUri(list[i].uri);

				if (match === listUri) {
					response.favourite = true;
					break;
				}
			}
			self.emitFavourites(response);
		});
	}
	else {
		this.emitFavourites(response);
		defer.resolve({});
	}
	return defer.promise;
};


CoreStateMachine.prototype.emitFavourites = function (msg) {
	this.commandRouter.emitFavourites(msg);
};


//------------------------- new play mechanism USED METHODS ------------------

CoreStateMachine.prototype.getTrack = function (position) {
	var track=this.playQueue.getTrack(position);

	return track;
};


// Volumio Play Command
CoreStateMachine.prototype.play = function (index) {
	var self=this;

	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::play');

	if (index) {
		self.currentPosition=index;
	}

	return self.setConsumeUpdateService(undefined)
		.then(function()
		{
			if(self.currentPosition ==null || self.currentPosition===undefined)
			{
				self.logger.info("CURRENT POSITION NOT SET, RESETTING TO 0");
				self.currentPosition=0;
			}


			if(index!==undefined)
			{
				return self.stop()
					.then(function(e)
					{
						self.currentPosition=index;
						return self.play();
					});
			}
			else
			{
				var trackBlock = self.getTrack(self.currentPosition);
				var thisPlugin = self.commandRouter.pluginManager.getPlugin('music_service', trackBlock.service);

				if(self.currentStatus==='stop')
				{
					//queuing
					self.currentSeek=0;
					self.startPlaybackTimer();

					thisPlugin.clearAddPlayTrack(trackBlock);
				}
				else  if(self.currentStatus==='pause')
				{
					self.startPlaybackTimer();
					thisPlugin.resume();
				}

				self.commandRouter.pushToastMessage('success',self.commandRouter.getI18nString('COMMON.PLAY_TITLE'),self.commandRouter.getI18nString('COMMON.PLAY_TEXT')+trackBlock.name);

				return libQ.resolve();

			}
		});
};

// Volumio Play Command
CoreStateMachine.prototype.seek = function (position) {
	var self=this;
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::seek');

	self.setConsumeUpdateService(undefined);

	var trackBlock = this.getTrack(this.currentPosition);
	if (trackBlock !== undefined)
	{
		this.commandRouter.pushConsoleMessage('TRACKBLOCK ' + JSON.stringify(trackBlock));

		var thisPlugin = this.commandRouter.pluginManager.getPlugin('music_service', trackBlock.service);

		this.currentSeek = position*1000;
		this.startPlaybackTimer(position*1000);

		thisPlugin.seek(position*1000);

		this.pushState().fail(this.pushError.bind(this));
	}
};


CoreStateMachine.prototype.next = function (promisedResponse) {
	var self=this;
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::next');

	self.setConsumeUpdateService(undefined);

	this.stop()
		.then(function()
		{
			if(self.currentRandom!==undefined && self.currentRandom===true)
			{
				self.currentPosition=Math.floor(Math.random() * (self.playQueue.arrayQueue.length  + 1));
			}
			else if (self.currentPosition < self.playQueue.arrayQueue.length - 1) {
				self.currentPosition++;
			}

			self.commandRouter.logger.info("NEXT POSITION "+self.currentPosition);

			return libQ.resolve();
		})
		.then(self.play.bind(self))
		.then(self.updateTrackBlock.bind(self));
};


// Volumio Pause Command
CoreStateMachine.prototype.pause = function (promisedResponse) {

	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::pause');

	this.setConsumeUpdateService(undefined);

	if (this.currentStatus === 'play') {
		this.currentStatus = 'pause';
		this.stopPlaybackTimer();
		return this.servicePause();
	}
};

// Pause the current track block playback
CoreStateMachine.prototype.servicePause = function () {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::servicePause');
	var trackBlock = this.getTrack(this.currentPosition);

	return this.commandRouter.servicePause(trackBlock.service);
};

// Volumio Stop Command
CoreStateMachine.prototype.stop = function (promisedResponse) {
	var self=this;
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::stop');

	self.setConsumeUpdateService(undefined);

	if (this.currentStatus === 'play') {
		// Play -> Stop transition
		this.currentStatus = 'stop';
		this.currentSeek = 0;

		this.stopPlaybackTimer();
		this.updateTrackBlock();
		this.pushState().fail(this.pushError.bind(this));
		return this.serviceStop();

	} else if (this.currentStatus === 'pause') {
		// Pause -> Stop transition
		this.currentStatus = 'stop';
		this.currentSeek = 0;
		this.updateTrackBlock();

		this.stopPlaybackTimer();
		this.pushState().fail(this.pushError.bind(this));
		return this.serviceStop();
	}
	else return libQ.resolve();
};

// Stop the current track block playback
CoreStateMachine.prototype.serviceStop = function () {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::serviceStop');
	var trackBlock = this.getTrack(this.currentPosition);
	if (trackBlock && trackBlock.service){
		return this.commandRouter.serviceStop(trackBlock.service);
	}

};


// Volumio Previous Command
CoreStateMachine.prototype.previous = function (promisedResponse) {
	var self=this;

	self.setConsumeUpdateService(undefined);
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::previous');

	if (this.currentStatus === 'stop') {
		// Stop -> Previous transition
		if(this.currentRandom!==undefined && this.currentRandom===true)
		{
			this.currentPosition=Math.floor(Math.random() * (this.playQueue.arrayQueue.length));
			return this.updateTrackBlock().then(this.serviceClearAddPlay.bind(this));
		}
		else if (this.currentPosition > 0) {
			this.currentPosition--;
			this.updateTrackBlock();
			return this.pushState();
		}

	} else if (this.currentStatus === 'play') {
		if(this.currentRandom!==undefined && this.currentRandom===true)
		{
			this.stop();
			setTimeout(function() {
				self.currentPosition=Math.floor(Math.random() * (self.playQueue.arrayQueue.length));
				self.play();
			},500);
		}
		else if (this.currentPosition > 0) {
			this.stop();
			setTimeout(function()
			{
				self.currentPosition--;
				self.play();
			},500);

		}
	} else if (this.currentStatus === 'pause') {
		// Pause -> Previous transition
		if(this.currentRandom!==undefined && this.currentRandom===true)
		{
			this.currentPosition=Math.floor(Math.random() * (this.playQueue.arrayQueue.length  + 1));
		}
		else if (this.currentPosition > 0) {
			this.currentPosition--;
		}
		this.currentSeek = 0;
		this.updateTrackBlock();
		return this.serviceClearAddPlay();
	}
};

CoreStateMachine.prototype.removeQueueItem = function (nIndex) {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::removeQueueItem');

	if(this.currentPosition==nIndex)
	{
		this.next();
		this.currentPosition--;
	}

	return this.playQueue.removeQueueItem(nIndex);
};

CoreStateMachine.prototype.setRandom = function (value) {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::setRandom '+value);

	this.currentRandom=value;

	this.pushState().fail(this.pushError.bind(this));
};

CoreStateMachine.prototype.setRepeat = function (value) {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::setRepeat '+value);

	this.currentRepeat=value;

	this.pushState().fail(this.pushError.bind(this));
};

CoreStateMachine.prototype.setConsume = function (value) {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::setConsume '+value);

	this.currentConsume=value;

	this.pushState().fail(this.pushError.bind(this));
};

CoreStateMachine.prototype.moveQueueItem = function (from,to) {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::moveQueueItem '+from+' '+to);

    if(from< this.currentPosition && to > this.currentPosition)
    {
        this.currentPosition--;
    }
    else if(from> this.currentPosition && to < this.currentPosition)
    {
        this.currentPosition++;
    }
    else if(from==this.currentPosition)
        this.currentPosition=to;

    this.pushState();
	return this.playQueue.moveQueueItem(from,to);
};

CoreStateMachine.prototype.setConsumeUpdateService = function (value) {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::setConsumeUpdateService '+value);

	var defer;

	/*if(value==undefined && this.consumeUpdateService!==undefined)
	 {
	 // shall stop MPD
	 var mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service', 'mpd');
	 defer= mpdPlugin.stop();
	 }
	 else if(value!==undefined && this.consumeUpdateService==undefined)
	 {
	 defer= this.stopPlaybackTimer()
	 .then(this.updateTrackBlock.bind(this))
	 .then(this.serviceStop.bind(this));
	 }
	 else*/
	{
		defer=libQ.defer();
		defer.resolve({});
	}

	this.consumeUpdateService = value;

	return defer.promise;



}

CoreStateMachine.prototype.sanitizeUri = function (uri) {
	return uri.replace('music-library/', '').replace('mnt/', '');
}

CoreStateMachine.prototype.setVolatile = function (data) {


    this.volatileService=data.service;
    this.isVolatile=true;

    /**
     * This function will be called on volatile stop
     */
    this.volatileCallback=data.callback;
};


CoreStateMachine.prototype.unSetVolatile = function () {
    console.log("UNSET VOLATILE");

    /**
     * This function will be called on volatile stop
     */
    if(this.volatileCallback!==undefined)
    {
        this.volatileCallback.call();
        this.volatileCallback=undefined;
    }

    this.volatileService=undefined;
    this.isVolatile=false;
}

// 2016/11/28 matuoka add start
CoreStateMachine.prototype.probablyAirPlay = function () {
	if( this.isAirPlay )
	{
		return true;
	}
	else
	{
		return false;
	}
};

// CoreStateMachine.prototype.syncAirPlayState = function (stateService) {
// 	var  self = this;
// 	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'CoreStateMachine::syncAirPlayState');

// 	this.volatileService = stateService.service;
//     this.currentStatus='play';
//     this.volatileState=stateService;
//     this.pushState().fail(this.pushError.bind(this));
// };

CoreStateMachine.prototype.setAirPlay = function () {
    console.log("SET AIRPLAY");

    this.isAirPlay=true;
}

CoreStateMachine.prototype.unSetAirPlay = function () {
    console.log("UNSET AIRPLAY");

    this.isAirPlay=false;
}
// 2016/11/28 matuoka add end
