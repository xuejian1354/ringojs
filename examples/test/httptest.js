var {Server} = require("ringo/httpserver");

var server = new Server({
    "appName": "app",
    "port": 8088
});

server.getDefaultContext().serveApplication(function(req) {
  return {
    status: 200,
    headers: {},
    body: ["Hello World!\n"]
  };
});

server.start();
