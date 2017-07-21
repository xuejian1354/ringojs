var config = require("./config");
var {Server} = require("ringo/httpserver");

var httpServer = new Server({
    "appName": "app",
    "appModule": module.resolve("./webapp"),
    "port": config.get("port") || 8080
});

/**
 * Called when the application starts
 */
var start = exports.start = function() {
    httpServer.start();
};

/**
 * Called when the engine is shut down
 */
var stop = exports.stop = function() {
    httpServer.stop();
    httpServer.destroy();
};

//Script run from command line
if (require.main === module) {
    start();
}
