function Controller(clientId, config) {
	var _this = this;
	
	var channel = config.get('channel', '').trim();
	if (channel.length == 0) {
		console.error("Invalid channel configured: " + channel);
		return false;
	}

	/** TMI.js Client */
	var client = null;

	/** Interface to any view, instance of {@link ViewInterface} */
	var view = null;

	/** Set of emotes the chatting user can use */
	this.emotesets = {};

	this.badges = {};

	this.channelId = null;

	var apiGet = function(path, callbackFn, authorized) {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", "https://api.twitch.tv/kraken" + path, true);
		xhr.setRequestHeader('Accept', 'application/vnd.twitchtv.v5+json');
		if (authorized == true)
			xhr.setRequestHeader('Authorization', 'OAuth ' + config.get('oauth_token'));
		xhr.setRequestHeader('Client-ID', clientId);
		xhr.responseType = "json";
		xhr.addEventListener("load", function(ev) {
			if (xhr.readyState == 4) {
				if (xhr.status != 200) {
					callbackFn(xhr.status, null);
				} else {
					callbackFn(null, xhr.response);
				}
			}
		});
		xhr.send();
	}
	this._apiGet = apiGet;

	// path - e.g. "/badges/global/display?language=en"
	var badgesApiGet = function(path, callbackFn) {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", "https://badges.twitch.tv/v1" + path, true);
		xhr.setRequestHeader('Accept', 'application/json');
		xhr.responseType = "json";
		xhr.addEventListener("load", function(ev) {
			if (xhr.readyState == 4) {
				if (xhr.status != 200) {
					callbackFn(xhr.status, null);
				} else {
					callbackFn(null, xhr.response);
				}
			}
		});
		xhr.send();
	}

	var updateEmoteSetsPeriodically = function() {
		var emotesets = client.emotes;
		apiGet("/chat/emoticon_images?emotesets=" + emotesets, function(status, response) {
			if (response != null)
				_this.emotesets = response['emoticon_sets'];
			
			// Schedule next update
			window.setTimeout(updateEmoteSetsPeriodically, 60000);
		});
	}

	/**
	 * Loads all badges for this channel (global and channel subscriptions)
	 */
	var updateBadges = function() {
		var onBadgesResponse = function(status, response) {
			if (response != null) {
				for (var badgeSet in response['badge_sets']) {
					_this.badges[badgeSet] = response['badge_sets'][badgeSet];
				}
			}
		}
		
		// Global badges
		badgesApiGet("/badges/global/display?language=en", onBadgesResponse);

		// Channel subscription badges
		badgesApiGet("/badges/channels/" + _this.channelId + "/display?language=en", onBadgesResponse);
	}

	var makeUserInfo = function(userstate, self) {
		return {
			isSelf: self,
			username: userstate['username'],
			displayName: userstate['display-name'],
			color: userstate['color'],
			badges: userstate['badges'],
			isSubscriber: userstate['subscriber'],
			isModerator: userstate['mod']
		};
	}


	/**
	 * On raw message
	 */
	this.onMessage = function(channel, userstate, message, self) {
		var timestamp = ('tmi-sent-ts' in userstate) ? parseInt(userstate['tmi-sent-ts']) : -1;
		var user = makeUserInfo(userstate, self);

		console.debug(userstate);
		switch (userstate['message-type']) {
			case 'chat':
				view.appendChatMessage(timestamp, user, message, userstate['emotes']);
				break;
			default:
				break;
		}
	}

	/**
	 * Sends a chat message to the server
	 */
	this.sendChatMessage = function(message) {
		client.say(channel, message);
	}

	/**
	 * Joined a channel
	 */
	var joinedChannel = false;
	this.onJoin = function(channel, username, self) {
		// This event is called multiple times for some reason...
		if (!joinedChannel) {
			updateEmoteSetsPeriodically();
			
			view.appendDebugMessage("Joined channel " + channel);
			
			joinedChannel = true;
		}
	}

	this.onRoomState = function(channel, state) {
		_this.channelId = state['room-id'];
		updateBadges();
	};

	/**
	 * Connects to twitch servers
	 * @return true if connection succeeded, false otherwise
	 */
	this.connect = function() {
		client = new tmi.client({
			options: {
				clientId: clientId,
				debug: false
			},
			connection: {
				secure: config.get('secure_connection', false),
				reconnect: true,
			},
			identity: {
				username: config.get('username'),
				password: "oauth:" + config.get('oauth_token'),
			},
			channels: ['#' + channel],
		});

		client.connect();
		client.on("message", this.onMessage);
		client.on("join", this.onJoin);
		client.on("roomstate", this.onRoomState);

		return true;
	}

	/**
	 * Registers an implementation of {@link ViewInterface}
	 */
	this.registerView = function(view_) {
		view = view_;
	}

	this._getClient = function() {
		return client;
	}
}

function ViewInterface() {
	/**
	 * A regular chat message (i.e. someone typed in chat)
	 */
	this.appendChatMessage = function(timestamp, user, message, emotes) {};

	/**
	 * A simple debug message
	 */
	this.appendDebugMessage = function(message) {
		console.debug(message);
	};
}
