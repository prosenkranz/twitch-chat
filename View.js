/**
 * Main view implementation
 */
function View(controller, config) {	
	ViewInterface.apply(this);

	// Register at controller
	controller.registerView(this);

	var pauseAutoScroll = false;

	var encodeMessageId = function(username, timestamp) {
		return username + ":" + timestamp;
	}

	var decodeMessageId = function(messageId) {
		var parts = messageId.split(":");
		return {username: parts[0], timestamp: parseInt(parts[1])}
	}

	var injectOfficialEmotes = function(text, emotes) {
		// Twitch sends us positions of emotes, based on characters
		var splitText = text.split('');
		for (var i in emotes) {
			var e = emotes[i];
			for (var j in e) {
				var mote = e[j];
				if (typeof mote == 'string') {
					mote = mote.split('-');
					mote = [parseInt(mote[0]), parseInt(mote[1])];
					var length =  mote[1] - mote[0],
						empty = Array.apply(null, new Array(length + 1)).map(function() { return '' });
					splitText = splitText.slice(0, mote[0]).concat(empty).concat(splitText.slice(mote[1] + 1, splitText.length));
					splitText.splice(mote[0], 1, '<span class="emoticon-wrapper">'
						+ '<img class="emoticon" src="http://static-cdn.jtvnw.net/emoticons/v1/' + i + '/1.0"></span>');
				}
			}
		}
		return splitText.join('');
	}

	/**
	 * @param emotesets should be in the form of {<emote-set>: [ {code: <emote-code>, id: <emote-id>}, ... ], ...}
	 */
	var injectOfficialEmotesFromEmotesets = function(text, emotesets) {
		var words = text.split(/\s+/);
		words.forEach(function(word, i) {
			// Find word in emote codes
			for (var j in emotesets) {
				for (var k in emotesets[j]) {
					var emote = emotesets[j][k];
					if (word == emote.code) {
						words[i] = '<span class="emoticon-wrapper">'
							+ '<img class="emoticon" src="http://static-cdn.jtvnw.net/emoticons/v1/' + emote.id + '/1.0"></span>';
						return;
					}
				}
			}
		});
		return words.join(' ');
	}

	/**
	 * @param bttvEmotes should be in the form of { <code>: {id: ..., channel: ..., imageType: ...}, ... }
	 */
	var injectBTTVEmotes = function(text, bttvEmotes, bttvEmoteURLTemplate) {
		var words = text.split(/\s+/);
		words.forEach(function(word, i) {
			if (word in bttvEmotes) {
				var emote = bttvEmotes[word];
				var url = bttvEmoteURLTemplate
						.replace("{{id}}", emote.id)
						.replace("{{image}}", "1x")
						.replace(/^\/\//, "https://");
				words[i] = '<span class="emoticon-wrapper"><img class="emoticon" src="' + url + '"></span>';
			}
		});
		return words.join(' ');
	}

	var injectFFZEmotes = function(text) {
		// TODO
		return text;
	}

	var injectHyperlinks = function(text) {
		return text.replace(/(https?:\/\/[-a-zA-Z0-9@:%._\+~#=\/\?&]+)/, '<a href="$1">$1</a>');
	}

	/**
	 * @param badges should be in the form of
	 * 	{
	 * 		<badge-set>: {
	 * 			versions: {
	 * 				<version>: {
	 * 					title: ...,
	 * 					image_url_[1|2|4]x: ...,
	 * 					...
	 * 				}
	 *			},
	 *			...
	 *		},
	 *		...
	 *	}
	 */
	var createBadgesHTML = function(user, badges) {
		var html = "";
		for (var badgeSet in user.badges) {
			if (!(badgeSet in badges))
				continue;
			
			var badgeVersion = user.badges[badgeSet];
			if (!(badgeVersion in badges[badgeSet].versions))
				continue;

			var badge = badges[badgeSet].versions[badgeVersion];
			html += '<img class="badge" src="' + badge['image_url_1x'] +'" title="' + badge['title'] + '" /> ';
		}
		return html;
	}

	/**
	 * Adds a new message to the output
	 */
	this.appendChatMessage = function(timestamp, user, message, emotes, isAction) {
		var messageElems = $('#messages .message').not('.debug-message').not('#message-template');

		// If timestamp not given, use current latest timestamp
		if (timestamp == null || timestamp == -1) {
			if (messageElems.length > 0) {
				var lastMessageIdData = decodeMessageId(messageElems.last().attr('id'));
				timestamp = lastMessageIdData.timestamp;
			}
			else {
				// No messages yet. First message will get current timestamp
				timestamp = currentTimeMillis();
			}
		}
		
		var newMessageElem = $('#message-template').clone();
		newMessageElem.attr('id', encodeMessageId(user.username, timestamp));
		newMessageElem.find('.message-time').text(formatTimestamp(timestamp));
		newMessageElem.find('.message-user').css('color', user.color);
		newMessageElem.find('.message-username').text(user.displayName);

		// Action messages
		if (isAction) {
			newMessageElem.find('.message-text').css('color', user.color);
			newMessageElem.find('.message-user-colon').remove();
		}

		// Mentions
		if (message.includes(config.get('username')))
			newMessageElem.addClass('mention');

		// Badges
		var badgesHtml = createBadgesHTML(user, controller.badges);
		newMessageElem.find('.message-badges').html(badgesHtml);
		
		var finalMsg = message;
		
		// Hyperlinks
		finalMsg = injectHyperlinks(finalMsg);

		// Emotes
		finalMsg = user.isSelf
			? injectOfficialEmotesFromEmotesets(finalMsg, controller.emotesets)
			: injectOfficialEmotes(finalMsg, emotes);

		finalMsg = injectBTTVEmotes(finalMsg, controller.bttvEmotes, controller.bttvEmoteURLTemplate);
		finalMsg = injectFFZEmotes(finalMsg);

		newMessageElem.find('.message-text').html(finalMsg);

		//newMessageElem.find('.message-debug').text("(" + (currentTimeMillis() - timestamp) + "ms)");

		// Insert message where it belongs (based on original timestamp)
		// Since they're already sorted, we can traverse them in DOM order
		var insertAfter = null;
		for (var i = 0; i < messageElems.length; ++i) {
			var messageIdData = decodeMessageId(messageElems[i].id);
			if (insertAfter == null || timestamp >= messageIdData.timestamp)
				insertAfter = messageElems[i];
			else if (timestamp < messageIdData.timestamp)
				break;
		}

		var messages = $('#messages');

		if (insertAfter != null)
			$(insertAfter).after(newMessageElem);
		else
			messages.append(newMessageElem);

		if (!pauseAutoScroll) {
			// Scroll to bottom
			messages.scrollTop(messages.prop('scrollHeight'));

			// Remove old messages
			var maxMessages = config.get('max_messages');
			var numMessages = messageElems.length + 1; // + 1 for new message
			if (numMessages > maxMessages) {
				$('#messages .message').not('#message-template').slice(0, numMessages - maxMessages).remove();
			}
		}
	}

	this.appendActionMessage = function(timestamp, user, message, emotes) {
		this.appendChatMessage(timestamp, user, message, emotes, true);
	};

	this.appendDebugMessage = function(message) {
		var newMessageElem = $('#message-template').clone();
		newMessageElem.attr('id', '');
		newMessageElem.addClass('debug-message');
		newMessageElem.find('.message-user').remove();
		newMessageElem.find('.message-text').html(message);
		$('#messages').append(newMessageElem);
	}

	this.sendCurrentMessage = function() {
		var message = $('#input-message').val();
		controller.sendChatMessage(message);

		// Reset input
		$('#input-message').val("");
	}


	this.doAutoComplete = function() {
		var inputBox = $('#input-message');
		var text = inputBox.val();
		if (text.length == 0)
			return;

		var cursorPos = inputBox.getCursorPosition();
		if (cursorPos == null || cursorPos == 0)
			return;

		// Get last typed word
		var lastWhitespace = text.lastIndexOf(" ", cursorPos);
		var lastTypedWord = text.substr(lastWhitespace + 1, cursorPos);
		if (lastTypedWord.length == 0)
			return;

		var autoCompletions = (lastTypedWord[0] == '@'
				? controller.recentChatters.map(function(x) { return "@" + x; })
				: controller.usableEmotes.concat(controller.recentChatters));

		// Find a replacement starting with (and NOT case-sensitively matching) the last typed (partial) word
		var forceNext = false;
		for (var i in autoCompletions) {
			var replacement = autoCompletions[i];
			if (replacement.toLowerCase().startsWith(lastTypedWord.toLowerCase()) || forceNext) {
				if (lastTypedWord == replacement) {
					// Use next replacement in list
					forceNext = true;
					continue;
				}

				// Replace last typed word
				text = text.substr(0, lastWhitespace + 1).concat(replacement, text.substr(cursorPos));
				inputBox.val(text);
				inputBox.selectRange(lastWhitespace + 1 + replacement.length);
				break;
			}
		}
	}

	
	/**
	 * Register Event Listeners
	 */
	var view = this;
	this.onDocumentReady = function() {
		$('#input-message').keydown(function(event) {
			// Handle TAB
			if (event.keyCode === 9) {
				view.doAutoComplete();
				event.preventDefault();
			}
		});
		
		$('#input-message').keypress(function(event) {
			// Handle return key
			if (event.keyCode === 13) {
				view.sendCurrentMessage();
				event.preventDefault();
			}
		});

		$('#messages').bind('wheel', function(event) {
			var messages = $('#messages');
			var scrollBottom = messages.scrollTop() + messages.prop('offsetHeight');
			pauseAutoScroll = (scrollBottom < messages.prop('scrollHeight') - 50);
		});
	}
}
