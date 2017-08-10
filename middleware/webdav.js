var strings = require("ringo/utils/strings");
var response = require("ringo/jsgi/response");
var {OwnCloud} = require("../controller/owncloud");
var log = require("ringo/logging").getLogger(module.id);
var config = require("../config");

exports.middleware = function webdav(next, app) {

    return function webdav(request) {

		if(strings.startsWith(request.pathInfo, config.get('ownbaseurl'))) {
			return ownHandler(request, response);
		}

        return next(request);
    };
};

function ownHandler(req, res) {
	var method;

	switch(req.method) {
	case 'PROPFIND': method = 'prop'; break;
	case 'MKCOL': method = 'mkcol'; break;
	case 'GET': method = 'get'; break;
	case 'POST': method = 'post'; break;
	case 'PUT': method = 'put'; break;
	case 'DELETE': method = 'del'; break;
	case 'HEAD': method = 'head'; break;
	case 'MOVE': method = 'move'; break;
	case 'COPY': method = 'copy'; break;
	}

	var myown = new OwnCloud(method, req);
	return myown.resHandler(res);
}

