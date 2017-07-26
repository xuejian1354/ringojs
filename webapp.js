var Route = require("./route");
var {Application} = require("stick");

var app = exports.app = new Application();

app.configure(
	module.resolve("./middleware/static"),
	module.resolve("./middleware/parseparams"),
	module.resolve("./middleware/baseauth"),
	module.resolve("./middleware/webdav"),
	"route"
);

app.static(
	module.resolve('./public'),
	"index.html",
	"/static",
	{
		"servePrecompressed": false,
		"maxAge": 600
	}
);

Route(app);
