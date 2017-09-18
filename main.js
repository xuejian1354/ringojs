var config = require("./config");
var {Server} = require("ringo/httpserver");

var httpServer = new Server({
    "appName": "app",
    "appModule": module.resolve("./webapp"),
    "port": config.get("port") || 8080
});

//Script run from command line
if (require.main === module) {
    httpServer.start();
}
