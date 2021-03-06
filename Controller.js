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

	/** Set of emotes the chatting user can use: {<emote-set>: [ {code: <emote-code>, id: <emote-id>}, ... ], ...} */
	this.emotesets = {};

	/** BTTV Emotes: { <code>: {...}, ... } */
	this.bttvEmotes = {};
	this.bttvEmoteURLTemplate = null;

	this.badges = {};

	this.channelId = null;

	/** List of emote codes, the current user can use. Sorted by code */
	this.usableEmotes = [];

	/** bounded list of recently seen chatters - for autocomplete. Sorted by time seen */
	this.recentChatters = [];

	/**
	 * Sends an ajax GET requests accepting JSON. The callbackFn is called for success AND errors
	 * @param callbackFn a function(statusCode, responseBody)
	 * @param additionalHeaders dict, e.g. { 'Accept': 'application/json', ... }
	 */
	var ajaxGetJSON = function(url, callbackFn, additionalHeaders) {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", url, true);
		for (var key in additionalHeaders)
			xhr.setRequestHeader(key, additionalHeaders[key]);
		xhr.responseType = "json";
		xhr.addEventListener("load", function(ev) {
			if (xhr.readyState == 4 && callbackFn) {
				if (xhr.status != 200) {
					callbackFn(xhr.status, null);
				} else {
					callbackFn(null, xhr.response);
				}
			}
		});
		xhr.send();
	}

	/**
	 * Start asynchronous call against twitch REST api
	 */
	var apiGet = function(path, callbackFn, authorized) {
		var headers = {
			'Accept': 'application/vnd.twitchtv.v5+json',
			'Client-ID': clientId
		};

		if (authorized)
			headers['Authorization'] = 'OAuth ' + config.get('oauth_token');

		ajaxGetJSON("https://api.twitch.tv/kraken" + path, callbackFn, headers);
	}
	this._apiGet = apiGet;

	// path - e.g. "/badges/global/display?language=en"
	var badgesApiGet = function(path, callbackFn) {
		ajaxGetJSON("https://badges.twitch.tv/v1" + path, callbackFn, { 'Accept': 'application/json' });
	}

	var updateEmoteSetsPeriodically = function() {
		var emotesets = client.emotes;
		apiGet("/chat/emoticon_images?emotesets=" + emotesets, function(status, response) {
			if (response != null) {
				_this.emotesets = response['emoticon_sets'];
				updateUsableEmotes();
			}
			
			// Schedule next update
			window.setTimeout(updateEmoteSetsPeriodically, 60000);
		});
	}

	var updateBTTVEmotesPeriodically = function() {
		// Global emotes
		ajaxGetJSON("https://api.betterttv.net/2/emotes", function(status, response) {
			if (response != null) {
				response['emotes'].forEach(function(emote, i) {
					_this.bttvEmotes[emote['code']] = emote;
				});
				updateUsableEmotes();
			}
		});
		
		// Channel emotes
		ajaxGetJSON("https://api.betterttv.net/2/channels/" + config.get('channel'), function(status, response) {
			if (response != null) {
				_this.bttvEmoteURLTemplate = response['urlTemplate'];
				response['emotes'].forEach(function(emote, i) {
					_this.bttvEmotes[emote['code']] = emote;
				});
				updateUsableEmotes();
			}

			window.setTimeout(updateBTTVEmotesPeriodically, 60000);
		});
	}

	var updateUsableEmotes = function() {
		var usableEmotes = [];
		
		// Add official emotes
		for (var emoteSet in _this.emotesets) {
			for (var i in _this.emotesets[emoteSet]) {
				usableEmotes.push(_this.emotesets[emoteSet][i].code);
			}
		}

		// Add bttv emotes
		for (var code in _this.bttvEmotes) {
			usableEmotes.push(code);
		}

		// Sort by code
		_this.usableEmotes = usableEmotes.sort();
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
		var user = makeUserInfo(userstate, self);

		var timestamp = null;
		if ('tmi-sent-ts' in userstate) {
			timestamp = parseInt(userstate['tmi-sent-ts']);
		} else if (self) {
			timestamp = currentTimeMillis();
		} else {
			timestamp = -1; // Append to end
		}

		// (Re-)add user to recently seen chatters list
		var recentChatterName = (user.displayName || user.username);
		for (var i = 0; i < _this.recentChatters.length; ++i) {
			if (_this.recentChatters[i] == recentChatterName) {
				_this.recentChatters.splice(i, 1);
				break;
			}
		}

		_this.recentChatters.push(recentChatterName);

		// Limit recent chatters list to a certain length
		while (_this.recentChatters.length > 250) {
			_this.recentChatters.shift();
		}

		//console.debug(userstate);
		switch (userstate['message-type']) {
			case 'action':
				view.appendActionMessage(timestamp, user, message, userstate['emotes']);
				break;
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
	 * A user has been timed out on the channel
	 */
	this.onUserTimeout = function(channel, username, reason, duration) {
		var reasonSuffix = (reason != null && reason.length > 0 ? ": " + reason : "");
		view.hideMessagesOfUser(username);
		view.appendSystemMessage("User " + username + " has been timed out for " + duration + "s" + reasonSuffix);
	}

	/**
	 * A user subscribed to the channel
	 */
	this.onSubscription = function(channel, username, method, message, userstate) {
		view.appendSubscriptionMessage(username, {
			method: method,
			message: message,
			resub: false
		});
	}

	/**
	 * A user resubscribed to the channel
	 */
	this.onResubscription = function(channel, username, months, message, userstate, method) {
		view.appendSubscriptionMessage(username, {
			method: method,
			message: message,
			resub: true,
			months: months
		});
	}

	/**
	 * Joined a channel
	 */
	var joinedChannel = false;
	this.onJoin = function(channel, username, self) {
		// This event is called multiple times for some reason...
		if (!joinedChannel) {
			updateEmoteSetsPeriodically();
			updateBTTVEmotesPeriodically();
			
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
		client.on("timeout", this.onUserTimeout);
		client.on("subscription", this.onSubscription);
		client.on("resub", this.onResubscription);

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
	/** A regular chat message (i.e. someone typed in chat) */
	this.appendChatMessage = function(timestamp, user, message, emotes) {};

	/** An action message (/me ...) */
	this.appendActionMessage = function(timestamp, user, message, emotes) {};

	/** A simple debug message */
	this.appendDebugMessage = function(message) {
		console.debug(message);
	};

	/** A specially formatted system message */
	this.appendSystemMessage = function(message) {};

	/** Show that someone (re-)subscribed to the channel */
	this.appendSubscriptionMessage = function(username, subscriptionInfo) {};

	/** Hide the messages of a user (e.g. because of a timeout or ban) */
	this.hideMessagesOfUser = function(username) {};
}
