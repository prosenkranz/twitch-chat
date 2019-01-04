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
		return text.replace(/(https?:\/\/[-a-zA-Z0-9@:%._\+~#=\/\?&]+)/, '<a href="$1" target="_blank">$1</a>');
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

	var getUserMessageElements = function() {
		return $('#messages .message').not('.debug-message').not('#message-template');
	}

	/**
	 * Injects emotes, hyperlinks, etc.
	 */
	var processMessage = function(message, user, emotes) {
		// Hyperlinks
		message = injectHyperlinks(message);

		// Emotes
		message = (user && user.isSelf)
			? injectOfficialEmotesFromEmotesets(message, controller.emotesets)
			: injectOfficialEmotes(message, emotes);

		message = injectBTTVEmotes(message, controller.bttvEmotes, controller.bttvEmoteURLTemplate);
		message = injectFFZEmotes(message);

		return message;
	}

	/**
	 * Adds a new message to the output
	 */
	this.appendChatMessage = function(timestamp, user, message, emotes, isAction) {
		var messageElems = getUserMessageElements();

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

		// Alternating backgrounds
		if (config.get('alternating_backgrounds', false))
			newMessageElem.addClass("alternating-bg");

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
		
		// Inject emotes, etc.
		var finalMsg = processMessage(message, user, emotes);
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
		this.appendSystemMessage(message);
	}

	this.appendSystemMessage = function(message) {
		var newMessageElem = $('#message-template').clone();
		newMessageElem.attr('id', encodeMessageId("system", currentTimeMillis()));
		newMessageElem.addClass('system-message');
		newMessageElem.find('.message-user').remove();
		newMessageElem.find('.message-text').html(message);
		$('#messages').append(newMessageElem);
	};

	this.appendSubscriptionMessage = function(username, message, method) {
		var newMessageElem = $('#message-template').clone();
		newMessageElem.attr('id', encodeMessageId("system", currentTimeMillis()));
		newMessageElem.addClass('system-message');
		newMessageElem.addClass('subscription-message');
		newMessageElem.find('.message-user').remove();
		
		var html = username + " just (re-)subscribed";
		if (method.prime)
			html += " with Twitch Prime";

		if (message && message.length > 0)
			html += ": " + processMessage(message);

		newMessageElem.find('.message-text').html(html);

		$('#messages').append(newMessageElem);
	}

	this.hideMessagesOfUser = function(username) {
		var messageElems = getUserMessageElements();
		messageElems.each(function(i, elem) {
			elem = $(elem);
			var data = decodeMessageId(elem.attr('id'));
			if (data.username == username) {
				if (config.get('remove_deleted_messages', false))
					elem.remove();
				else
					elem.addClass("hidden-message");
			}
		});
	};

	this.sendCurrentMessage = function() {
		var message = $('#input-message').val();
		controller.sendChatMessage(message);

		// Reset input
		$('#input-message').val("");
	}

	var autocomplete = {
		fragment: null, // the initial fragment to complete
		candidates: null,
		nextCandidate: 0,
		cursorPos: null,
		replaceStart: null // start of autocompleted word
	}

	this.resetAutoComplete = function() {
		autocomplete.fragment = null;
	}

	this.doAutoComplete = function() {
		var inputBox = $('#input-message');
		var text = inputBox.val();
		if (text.length == 0)
			return;

		var cursorPos = inputBox.getCursorPosition();
		if (cursorPos == null || cursorPos == 0)
			return;
		
		// Cursor pos changed outside of this function?
		if (autocomplete.cursorPos != cursorPos)
			this.resetAutoComplete();
		
		var ac = autocomplete;

		if (ac.fragment == null) {
			// Determine initial fragment
			var replaceStart = text.lastIndexOf(" ", cursorPos - 2) + 1;
			var fragment = text.substr(replaceStart, cursorPos).rtrim();
			if (fragment.length == 0)
				return;

			// Find candidates for this new fragment
			var recentChatters = controller.recentChatters
				.filter(username => username.toLowerCase().startsWith(fragment.toLowerCase()))
				.sort();
			
			var candidates = null;
			if (fragment.startsWith('@')) {
				candidates = recentChatters.map(function(x) { return '@' + x; });
			} else {
				candidates = controller.usableEmotes
					.filter(emote => emote.toLowerCase().startsWith(fragment.toLowerCase()))
					.concat(recentChatters)
					.sort();
			}

			if (candidates.length == 0)
				return;

			ac.fragment = fragment;
			ac.candidates = candidates;
			ac.nextCandidate = 0;
			ac.replaceStart = replaceStart;
		}

		// Loop through candidates
		var replacement = ac.candidates[ac.nextCandidate] + " ";
		text = text.substr(0, ac.replaceStart).concat(replacement, text.substr(cursorPos));
		inputBox.val(text);
		inputBox.selectRange(ac.replaceStart + replacement.length);

		ac.cursorPos = ac.replaceStart + replacement.length;
		ac.nextCandidate = (ac.nextCandidate + 1) % ac.candidates.length;

		autocomplete = ac;
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
			} else {
				view.resetAutoComplete();
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
