function Configuration() {
	var config = {};

	/**
	 * Assigns a new value to the given key.
	 * If 'null' or 'undefined' are passed as a val, the key is removed from this configuration.
	 * @return this configuration
	 */
	this.set = function(key, val) {
		if (typeof val !== "undefined" && val != null)
			config[key] = val;
		else
			this.unset(key);
		return this;
	}

	/**
	 * Removes the key in this configuration, if it was assigned before.
	 * @return this configuration
	 */
	this.unset = function(key) {
		delete config[key];
		return this;
	}

	/**
	 * Returns true if there is any value assigned to this key, or false if not.
	 */
	this.has = function(key) {
		return key in config;
	}

	/**
	 * Returns the value assigned to this key. If there is no value assigned to this key,
	 * returns defVal or null if defVal is not given.
	 */
	this.get = function(key, defVal) {
		if (key in config)
			return config[key];
		else
			return defVal || null;
	}
}
