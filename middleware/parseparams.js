var {getQueryParams} = require('../controller/requesthandler');
var {parseParameters} = require("ringo/utils/http");
var {Stream} = require('io');

exports.middleware = function Parameters(next, app) {

    return function Parameters(request) {
		switch(request.method) {
		case 'GET':
			request.query = getQueryParams(request.queryString);
			break;

		case 'POST':
			var input = new Stream(request.env.servletRequest.getInputStream());
			request.body = input.read();
			request.params = parseParameters(request.body);
			break;

		case 'PUT':
			request.input = new Stream(request.env.servletRequest.getInputStream());
			break;
		}

        return next(request, app);
    };
};
