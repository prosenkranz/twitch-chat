function Controller(clientId, config) {
	var channel = config.get('channel', '').trim();
	if (channel.length == 0) {
		console.error("Invalid channel configured: " + channel);
		return false;
	}

	/** TMI.js Client */
	var client = null;

	/** Interface to any view, instance of {@link ViewInterface} */
	var view = null;


	var makeUserInfo = function(userstate) {
		return {
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
		var user = makeUserInfo(userstate);

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

		return true;
	}

	/**
	 * Registers an implementation of {@link ViewInterface}
	 */
	this.registerView = function(view_) {
		view = view_;
	}
}

function ViewInterface() {
	/**
	 * A regular chat message (i.e. someone typed in chat)
	 */
	this.appendChatMessage = function(timestamp, user, message, emotes) {};
}
