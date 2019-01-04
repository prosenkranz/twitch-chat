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

// #rrggbb -> [ r, g, b ]
function hexColorToRGB(hexColor) {
	hexColor = hexColor.trim().replace('#', '');
	var color = null;
	if (hexColor.length == 6)
		color = [hexColor.substr(0, 2), hexColor.substr(2, 2), hexColor.substr(4, 2)];
	else if (hexColor.length == 3)
		color = [hexColor.substr(0, 1), hexColor.substr(1, 1), hexColor.substr(2, 1)];
	else
		return false;

	return color.map(c => parseInt(c, 16));
}

function rgbToHexColor(r, g, b) {
	return '#' + [r, g, b].map(function(c) {
		var h = c.toString(16);
		if (h.length % 2)
			h = '0' + h;
		return h;
	}).join('');
}

/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   {number}  r       The red color value
 * @param   {number}  g       The green color value
 * @param   {number}  b       The blue color value
 * @return  {Array}           The HSL representation
 */
function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min) {
        h = s = 0; // achromatic
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, l];
}

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @return  {Array}           The RGB representation
 */
function hslToRgb(h, s, l){
    var r, g, b;

    if(s == 0) {
        r = g = b = l; // achromatic
    } else {
        var hue2rgb = function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hexColorToHsl(hexColor) {
	var rgb = hexColorToRGB(hexColor);
	return rgbToHsl(rgb[0], rgb[1], rgb[2]);
}

function hslToHexColor(h, s, l) {
	var rgb = hslToRgb(h, s, l);
	return rgbToHexColor(rgb[0], rgb[1], rgb[2]);
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
