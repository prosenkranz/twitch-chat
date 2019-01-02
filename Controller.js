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


	var apiGet = function(path, callbackFn) {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", "https://api.twitch.tv/kraken" + path, true);
		xhr.setRequestHeader('Accept', 'application/vnd.twitchtv.v5+json');
		xhr.setRequestHeader('Client-ID', CLIENT_ID);
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

	var makeUserInfo = function(userstate, self) {
		return {
			isSelf: self,
			username: userstate['username'],
			displayName: userstate['display-name'],
			color: userstate['color'],
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
	this.onJoin = function(channel, username, self) {
		updateEmoteSetsPeriodically();
	}

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
}
