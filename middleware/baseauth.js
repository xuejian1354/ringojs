var fs = require('fs');
var strings = require("ringo/utils/strings");
var response = require("ringo/jsgi/response");
var {getUserFromAuthKey} = require('../controller/dataopt');
var log = require("ringo/logging").getLogger(module.id);
var config = require("../config");

exports.middleware = function baseauth(next, app) {

	function getAuthkeyFromCookie(req) {
		var authKey = false;

		var cookiearr = [];
		if(req.headers.cookie) {
			cookiearr = req.headers.cookie.split(';');
		}

		for(var x in cookiearr) {
			var xval = cookiearr[x].trim();
			if(xval.indexOf('authKey=') == 0) {
				authKey = xval.substr(8);
				break;
			}
		}

		return authKey;
	}

    return function baseauth(request) {

		if(strings.startsWith(request.pathInfo, config.get('ownbaseurl'))) {
			var auth = false;

			if(request.pathInfo.indexOf('/status.php') >= 0) {
				auth = true;
			}

			var authorization = request.headers.authorization;
			if(authorization && authorization.indexOf('Basic') == 0) {
				authorization = authorization.substr(authorization.indexOf('Basic')+6).trim();
			}

			var user = getUserFromAuthKey(authorization) || getUserFromAuthKey(getAuthkeyFromCookie(request));
			if(user) {
				request.user = user;
				auth = true;
			}

			if(!auth) {
				log.info(request.method + ' ' + request.pathInfo);
				log.info('Return: 401\n');

				if(request.pathInfo.indexOf('/remote.php/webdav') >= 0) {
					return response.setStatus(401).addHeaders({'WWW-Authenticate': 'Basic realm="owncloud"'});
				}

				return response.setStatus(401).xml(
					'<?xml version="1.0" encoding="utf-8"?>' +
					'<d:error xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">' +
					' <s:exception>Sabre\DAV\Exception\NotAuthenticated</s:exception>' +
					' <s:message>Username or password was incorrect, Username or password was incorrect</s:message>' +
					'</d:error>'
				);
			}
		}
		else if(strings.startsWith(request.pathInfo, '/login.html')
			|| strings.startsWith(request.pathInfo, '/register.html')) {
			if(getUserFromAuthKey(getAuthkeyFromCookie(request))) {
				return response.redirect('/index.html');
			}
		}
		else if(strings.startsWith(request.pathInfo, '/index.html')
			|| strings.startsWith(request.pathInfo, '/usericon')) {
			var user = getUserFromAuthKey(getAuthkeyFromCookie(request));
			if(user) {
				request.user = user;
			}
			else if(request.query.action != 'login') {
					request.query.action = 'login';
			}
		}

        return next(request, app);
    };
};


