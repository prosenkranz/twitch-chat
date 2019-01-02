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
		return {username: parts[0], timestamp: parts[1]}
	}

	/**
	 * Replaces emote codes with images
	 */
	var injectEmotes = function(text, emotes) {
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
	 * Adds a new message to the output
	 */
	this.appendChatMessage = function(timestamp, user, message, emotes) {
		var messageElems = $('#messages .message').not('#message-template');

		// If timestamp not given, use current latest timestamp
		if (timestamp == null || timestamp == -1) {
			if (messageElems.length > 0) {
				var lastMessageIdData = decodeMessageId(messageElems.last().attr('id'));
				timestamp = lastMessageIdData.timestamp;
			}
			else {
				// No messages yet. First message will get timestamp 0
				timestamp = 0;
			}
		}
		
		var newMessageElem = $('#message-template').clone();
		newMessageElem.attr('id', encodeMessageId(user.username, timestamp));
		newMessageElem.find('.message-time').text(formatTimestamp(timestamp));
		newMessageElem.find('.message-user').css('color', user.color);
		newMessageElem.find('.message-username').text(user.displayName);

		// Badges
		var badgesHtml = "";
		if (user.isSubscriber) {
			badgesHtml += '<span class="badge badge-subscriber">S</span> ';
		}
		if (user.isModerator) {
			badgesHtml += '<span class="badge badge-moderator">M</span> ';
		}

		newMessageElem.find('.message-badges').html(badgesHtml);
		
		// Process message
		var msgWithEmotes = injectEmotes(message, emotes);
		newMessageElem.find('.message-text').html(msgWithEmotes);

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

	this.sendCurrentMessage = function() {
		var message = $('#input-message').val();
		controller.sendChatMessage(message);

		// Reset input
		$('#input-message').val("");
	}

	
	/**
	 * Register Event Listeners
	 */
	var view = this;
	this.onDocumentReady = function() {
		$('#input-message').keypress(function() {
			// Handle return key
			if (event.keyCode == 13) {
				view.sendCurrentMessage();
				event.preventDefault();
			}
		});

		$('#input-submit').click(function() {
			view.sendCurrentMessage();
		});

		$('#messages').bind('wheel', function(event) {
			var messages = $('#messages');
			var scrollBottom = messages.scrollTop() + messages.prop('offsetHeight');
			pauseAutoScroll = (scrollBottom < messages.prop('scrollHeight') - 50);
		});
	}
}
