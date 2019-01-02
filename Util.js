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

function padZeros(num, size) {
	var s = num+"";
	while (s.length < size) s = "0" + s;
	return s;
}
