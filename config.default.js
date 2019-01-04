var config = new Configuration();

/** The channel to join */
config.set("channel", "");

/** Twitch credentials */
config.set("username", "").set("oauth_token", "");

/** Max messages to display */
config.set("max_messages", 100);

/** Alternate background shade of messages for easier reading */
config.set("alternating_backgrounds", false);

/** 
 * By default, "deleted" messages are just greyed out.
 * If this is set to true, they're actually deleted.
 */
config.set("remove_deleted_messages", false);

/** This set luminance (brightness) is forced as a minimum onto all username colors */
config.set("min_user_color_luminance", 0.3);

/** The color to use for users not having a color set */
config.set("default_user_color", '#999999');
