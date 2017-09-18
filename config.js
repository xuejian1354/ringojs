var fs = require("fs");
var log = require("ringo/logging").getLogger(module.id);

// Load the default configuration
var config = require("gestalt").load(module.resolve("./config/config.json"));

// Load the config file
var configHome = fs.resolve( module.directory);
var logConfig = module.resolve("./config/log4j.properties");
config.set("logging", getResource(fs.absolute(logConfig)));

// Set the logging config
require("ringo/logging").setConfig(config.get("logging"), true);

module.exports = config;