function currentTimeMillis() {
	return +new Date();
}

function formatTimestamp(millis) {
	var date = new Date(millis);
	return date.getHours()
		+ ":" + padZeros(date.getMinutes(), 2)
		/*+ ":" + padZeros(date.getSeconds(), 2)
		+ "." + padZeros(date.getMilliseconds(), 2)*/;
}

// Trim on right side only
String.prototype.rtrim = function() {
	return this.replace(/\s+$/, '');
}

function padZeros(num, size) {
	var s = num+"";
	while (s.length < size) s = "0" + s;
	return s;
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

(function ($, undefined) {
	// Credit to: https://stackoverflow.com/a/1909997
    $.fn.getCursorPosition = function() {
        var el = $(this).get(0);
        var pos = 0;
        if('selectionStart' in el) {
            pos = el.selectionStart;
        } else if('selection' in document) {
            el.focus();
            var Sel = document.selection.createRange();
            var SelLength = document.selection.createRange().text.length;
            Sel.moveStart('character', -el.value.length);
            pos = Sel.text.length - SelLength;
        }
        return pos;
	}
	
	// Credit to https://stackoverflow.com/a/841121
	$.fn.selectRange = function(start, end) {
		if(end === undefined) {
			end = start;
		}
		return this.each(function() {
			if('selectionStart' in this) {
				this.selectionStart = start;
				this.selectionEnd = end;
			} else if(this.setSelectionRange) {
				this.setSelectionRange(start, end);
			} else if(this.createTextRange) {
				var range = this.createTextRange();
				range.collapse(true);
				range.moveEnd('character', end);
				range.moveStart('character', start);
				range.select();
			}
		});
	};
})(jQuery);
