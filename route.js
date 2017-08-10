var fs = require("fs");
var mime = require('ringo/mime');
var response = require("ringo/jsgi/response");
var base64 = require("ringo/base64");
var {Reinhardt} = require("reinhardt");
var {Loader} = require('reinhardt/loaders/filesystem');
var {setCookie} = require("ringo/utils/http");
var {HttpHandler, postHandler, putHandler} = require('./controller/requesthandler');
var {getUserFromAuthKey, addUserToDB} = require('./controller/dataopt');
var menuconfig = require("gestalt").load(module.resolve("./config/menu.json"));
var config = require("./config");
var log = require("ringo/logging").getLogger(module.id);

module.exports = function(app) {
	app.get('/', function(req) {
		log.info("GET /");
		log.info("Redirect: /index.html");
		return response.redirect("/index.html");
	});

	app.get('/:way', function(req, way) {
		var templates = new Reinhardt({
			loader: new Loader(module.resolve('views'))
		});

		if(way =='login.html') {
			log.info("GET /" + way);
			log.info("Return: 200\n");

			if(req.query.action == 'auth') {
				var authKey = base64.encode(req.query.cellphone + ':' + req.query.password);
				if(getUserFromAuthKey(authKey)) {
					return response.setStatus(303).addHeaders({
						"location": '/index.html',
						"set-cookie": [setCookie('authKey', authKey, -1)]
					});
				}
				else {
					return response.setStatus(303).addHeaders({
						"location": '/login.html?error=unauthentication'
					});
				}
			}

			var context = {title: menuconfig.get('title')};
			if(req.query.error) {
				context.error = 'CellPhone or Password error';
			}

			return templates.renderResponse('login.html', context);
		}
		else if(way == 'register.html') {
			log.info("GET /" + way);
			log.info("Return: 200\n");

			if(req.query.action == 'auth') {
				var authKey = base64.encode(req.query.cellphone + ':' + req.query.password);
				if(req.query.password == req.query.repassword) {
					var addret = addUserToDB(req.query.cellphone, req.query.password);
					if(addret == 'admin') {
						return templates.renderResponse('register.html', {
							title: menuconfig.get('title'),
							'authority': addret,
							query: req.query
						});
					}
					else if(addret) {
						return response.setStatus(303).addHeaders({
							"location": '/index.html',
							"set-cookie": [setCookie('authKey', authKey, -1)]
						});
					}
				}

				return response.setStatus(303).addHeaders({
					"location": '/register.html?error=registererror'
				});
			}

			var context = {title: menuconfig.get('title')};
			if(req.query.error) {
				context.error = 'Register error';
			}

			return templates.renderResponse('register.html', context);
		}
		else if(way == 'index.html') {
			log.info("GET /" + way);

			var httphandler = new HttpHandler(req);
			if(req.user) {
				var authKey = base64.encode(req.user.cellphone + ':' + req.user.password);
				//httphandler.addCookie('authKey', authKey, 0.01);
			}

			log.info("Return: 200\n");
			return httphandler.response(templates);
		}		
		else if(way == 'usericon') {
			var iconpath;
			var imgtype = ['png', 'jpg', 'jpeg', 'ico', 'gif'];
			for(var x in imgtype) {
				iconpath = config.get('datapath') + '/' + req.user.cellphone + '/user.' + imgtype[x];
				if(fs.exists(iconpath)) {
					break;
				}
			}
			return response.addHeaders({'Content-Length': fs.size(iconpath)}).stream(fs.open(iconpath, 'rb'), mime.mimeType(iconpath));
		}

		log.error("404 - Not Found: /" + way + '\n');
		return templates.renderResponse('notFound.html', {path: '/' + way});
	});

	app.post('/index.html', function(req) {
		return postHandler(req);
	});

	app.put('/index.html', function(req) {
		return putHandler(req);
	});
}
