var fs = require("fs");
var mime = require('ringo/mime');
var dates = require('ringo/utils/dates');
var {Reinhardt} = require("reinhardt");
var {Loader} = require('reinhardt/loaders/filesystem');
var {setCookie, parseParameters} = require('ringo/utils/http');
var {Store} = require("ringo-sqlstore");
var {uploadFile} = require('./owncloud');
var base64 = require("ringo/base64");
var strings = require("ringo/utils/strings");
var response = require("ringo/jsgi/response");
var config = require("../config");
var menuconfig = require("gestalt").load(module.resolve("../config/menu.json"));
var log = require("ringo/logging").getLogger(module.id);

const MAPPING_USER = {
	'table': 'oc_users',
	'id': {
		'column': 'user_id'
	},
	'properties':{
		'name': 'string',
		'password': 'string'
	}
};

var HttpHandler = exports.HttpHandler = function(req) {
	this.request = req;
	var title = menuconfig.get('title');
	var menus = menuconfig.get('menus');
	this.mconfig = {title: title, menus: menus};

	this.selectMenu = getSelectMenuByAction(menus, this.request.query.action);

	if(this.request.query.action != 'login'
		&& this.request.query.action != 'logout') {
		this.request.query.action = this.selectMenu.submenu.action;
	}
	//this.selectData = getDataByRequest(this.request);
}

HttpHandler.prototype.response = function(templates) {
	if(this.request.query.action == 'login') {
		return response.redirect('/login.html');
	}
	else if(this.request.query.action == 'logout') {
		return response.setStatus(303).addHeaders({
			"location": '/index.html',
			"set-cookie": [setCookie('authKey', '', 0)]
		});
	}

	var restemp = templates.renderResponse('index.html', {
		selectMenu: this.selectMenu,
		//selectData: this.selectData,
		mconfig: this.mconfig,
		user: this.request.user,
		authKey: base64.encode(this.request.user.name + ':' + this.request.user.password),
		query: this.request.query
	});

	if(this.cookie) {
		restemp.headers['set-cookie'] = this.cookie;
	}
	return restemp;
}

HttpHandler.prototype.addCookie = function(name, value, duration) {
	this.cookie = setCookie(name, value, duration);
	return this;
}

var getQueryParams = exports.getQueryParams = function(queryStr){
	var params = {};
	var qarr = unescape(queryStr).split('&');
	for(var x in qarr) {
		var keyval = qarr[x].split('=', 2);
		if(keyval.length > 1) {
			params[keyval[0]] = keyval[1];
		}
	}

	return params;
}

function getSelectMenuByAction(menus, action) {
	var x = 0;
	var y = 0;

	for(var i in menus) {
		if(menus[i].action == action) {
			x = i;
			break;
		}

		for(var j in menus[i].submenu) {
			if(menus[i].submenu[j].action == action) {
				x = i;
				y = j;
				break;
			}
		}
	}

	return {
		name: menus[x].name,
		action: menus[x].action,
		page: menus[x].submenu[y].action+'.html',
		submenu: {
			name: menus[x].submenu[y].name,
			action: menus[x].submenu[y].action
		}
	}
}

function getDataByRequest(req) {
	switch(req.query.action) {
	case 'all': return getSelectFiles(req.query.path, req.user.name);
	}

	return null;
}

function getSelectFiles(path, name) {
	var locpath = path || '/';
	var homepath = config.get('datapath') + '/' + name + '/files';
	if(!fs.exists(homepath)) {
		fs.makeTree(homepath);
	}

	var abspath = homepath + locpath;

	var locallist = getLocalPathList(locpath);
	var lastlink;
	if(locallist.length > 1) {
		lastlink = locallist[locallist.length-2];
	}
	return {path: path || '/', locallist: locallist, lastlink: lastlink, files: getAllFilesByPath(abspath)};
}

function getLocalPathList(locpath) {
	var locarr = fs.split(locpath);
	var loclink = [{index: 1, path: '.', link: encodeURIComponent('/'), type: 'd'}];
	var tlink = '';
	for(var x=1; x<locarr.length; x++) {
		var type = 'd';
		if(x == locarr.length-1 && locarr[x].indexOf('.') >= 0) {
			type = '-';
		}

		if(locarr[x] != '') {
			tlink += '/' + locarr[x];
			loclink.push({index: x+1, path: locarr[x], link: encodeURIComponent(tlink), type: type});
		}
	}

	//log.info('loclink: ' + JSON.stringify(loclink));
	return loclink;
}

function getAllFilesByPath(path) {
	var locpath = path.substr(path.indexOf('/files')+6);
	if(fs.isDirectory(path)) {
		var filesinfo = [];
		var dirsinfo = [];
		var names = fs.list(path);
		names.forEach(function(name) {
			var fullPath = fs.join(path, name).replace(/\/{2,}/g, "/");
			if (fs.isFile(fullPath)) {
				filesinfo.push({
					name: name,
					type: '-',
					mime: mime.mimeType(name),
					path: encodeURIComponent((locpath+'/'+name).replace(/\/{2,}/g, "/")),
					size: getFileSizeFormat(fullPath),
					//date: dates.format(fs.lastModified(fullPath), 'yyyy-MM-dd')
				});
			}
			else if (fs.isDirectory(fullPath)) {
				dirsinfo.push({
					name: name,
					type: 'd',
					path: encodeURIComponent((locpath+'/'+name).replace(/\/{2,}/g, "/")),
					size: fs.list(fullPath).length,
					//date: dates.format(fs.lastModified(fullPath), 'yyyy-MM-dd')
				});
			}
		});

		return appendindex(dirsinfo.concat(filesinfo));
	}
	else if(fs.isFile(path)) {
		var fsnamearr = fs.split(path);
		var fname = fsnamearr[fsnamearr.length-1];

		var fileinfo = {
			name: fname,
			type: '-',
			mime: mime.mimeType(fname),
			path: encodeURIComponent(locpath.replace(/\/{2,}/g, "/")),
			size: getFileSizeFormat(path),
			date: dates.format(fs.lastModified(path), 'yyyy-MM-dd')
		};

		//log.info('fileinfo: ' + JSON.stringify(fileinfo));
		return appendindex([fileinfo]);
	}

	return [];
}

function appendindex(arr) {
	for(var x in arr) {
		arr[x].index = x;
	}

	return arr;
}

function getFileSizeFormat(path) {
	var size = fs.size(path);
	if(size < 1024) {
		return size + ' B';
	}
	else if(size < 1024*1024) {
		return (size/1024).toFixed(2) + ' KB';
	}
	else if(size < 1024*1024*1024) {
		return (size/1024/1024).toFixed(2) + ' MB';
	}
	else {
		return (size/1024/1024/1024).toFixed(2) + ' G';
	}
}

var postHandler = exports.postHandler = function(req) {

	switch(req.params.opt){
	case 'view':
		var retdata = {};
		retdata.selectMenu = getSelectMenuByAction(menuconfig.get('menus'), req.params.action);
		retdata.action = retdata.selectMenu.submenu.action;

		switch(req.params.action) {
		case 'pan':
		case 'all':
			retdata.selectData = getSelectFiles(req.params.path, req.user.name);
			break;

		case 'more':
		case 'resetpass':
			retdata.username = req.user.name;
			break;

		case 'logout':
			retdata.action = 'logout';
			break;
		}
		return response.setStatus(200).json(retdata);

	case 'newfolder':
		var locpath = req.params.path || '/';
		var abspath = config.get('datapath') + '/' + req.user.name + '/files' + locpath;
		var newFolder = createNewFolderInPath(abspath);
		if(newFolder) {
			return response.setStatus(201).json({folder: newFolder, date: dates.format(new Date(), 'yyyy-MM-dd')});
		}
		else {
			return response.setStatus(405);
		}

	case 'renamefile':
		var locpath = req.params.path || '/';
		var abspath = config.get('datapath') + '/' + req.user.name + '/files' + locpath;
		var ret = renameNewFolderInPath(abspath, req.params.file, req.params.newfile);
		if(ret == 0) {
			return response.setStatus(200);
		}
		else if(ret > 0) {
			return response.setStatus(304);
		}
		else {
			return response.setStatus(403);
		}

	case 'removefile':
		var reqpaths = [];
	    if(typeof req.params.path == 'object') {
			reqpaths = req.params.path;
		}
		else if(typeof req.params.path == 'string') {
			reqpaths.push(req.params.path);
		}

		var retpath = '/';
		for(var x in reqpaths) {
			var abspath = (config.get('datapath') + '/' + req.user.name + '/files/' + decodeURIComponent(reqpaths[x])).replace(/\/{2,}/g, "/");
			removeFileFromPath(abspath);
			retpath = fs.directory(decodeURIComponent(reqpaths[x]));
		}

		req.params.opt = 'view';
		req.params.action = 'all';
		req.params.path = retpath;
		return postHandler(req);

	case 'getfolders':
		var locpath = req.params.path || '/';
		var abspath = config.get('datapath') + '/' + req.user.name + '/files' + locpath;
		var folders = getFoldersInPath(abspath);
		if(folders) {
			return response.setStatus(200).json({folders: folders});
		}
		else {
			return response.setStatus(405);
		}

	case 'movefile':
	case 'copyfile':
	    var srcs = JSON.parse(req.params.srcarr);
		for(var x in srcs) {
			var srcpath = config.get('datapath') + '/' + req.user.name + '/files' + decodeURIComponent(srcs[x]);
			var tarpath = config.get('datapath') + '/' + req.user.name + '/files' + req.params.target;

			if(fs.exists(srcpath) && fs.isDirectory(tarpath)) {
				if(req.params.opt == 'movefile') {
					fs.move(srcpath, fs.join(tarpath, fs.base(srcpath)));
				}
				else if(req.params.opt == 'copyfile') {
					fs.copyTree(srcpath, fs.join(tarpath, fs.base(srcpath)));
				}
			}
		}

		req.params.opt = 'view';
		req.params.action = 'all';
		req.params.path = req.params.location;
		return postHandler(req);

	case 'resetpass':
		if(updateUserPass(req.params.username, req.params.password, req.params.newpassword)) {
			var authKey = base64.encode(req.params.username + ':' + req.params.newpassword);
			return response.setStatus(200).json({status: 'success', authKey: authKey});
		}
		else {
			return response.setStatus(200).json({status: 'fail'});
		}
	}

	return response.setStatus(200);
}

var putHandler = exports.putHandler = function(req) {
	const CRLF = new ByteString("\r\n", "ASCII");
	const EMPTY_LINE = new ByteString("\r\n\r\n", "ASCII");

	var boundary = new ByteString(req.headers['content-type'].substr(req.headers['content-type'].indexOf('boundary=')+9), "ASCII");

	var relpath = null;
	var fname = null;
	var content = null;

	var boundpos1 = 0;
	var boundpos2 = 0;
	while(boundpos1+boundary.length < req.body.length) {
	  boundpos1 = req.body.indexOf(boundary, boundpos1);
	  boundpos2 = req.body.indexOf(boundary, boundpos1+boundary.length);

	  if(boundpos1 < 0 || boundpos2 < 0) {
		  break;
	  }

	  var emptypos = req.body.indexOf(EMPTY_LINE, boundpos1);
	  if(emptypos < boundpos2) {
		var discontent = req.body.slice(boundpos1+boundary.length+2, emptypos).decodeToString().replace(/"/g, '');
		var namepos = discontent.indexOf('name=');
		var nameend = discontent.length;
		var nameend1 = discontent.indexOf(';', namepos);
		if(nameend1 > 0 && nameend1 < nameend) {
			nameend = nameend1;
		}
		var nameend2 = discontent.indexOf('\r\n', namepos);
		if(nameend2 > 0 && nameend2 < nameend) {
			nameend = nameend2;
		}

		var dataname = discontent.substr(namepos+5, nameend-namepos-5);
		switch(dataname) {
		case 'relpath':
			var relend = req.body.indexOf(CRLF, emptypos+4);
			relpath = req.body.slice(emptypos+4, relend).decodeToString();
			break;

		case 'files[]':
			var fnamepos = discontent.indexOf('filename=');
			var fnameend = discontent.length;
			var fnameend1 = discontent.indexOf(';', fnamepos);
			if(fnameend1 > 0 && fnameend1 < fnameend) {
				fnameend = fnameend1;
			}
			var fnameend2 = discontent.indexOf('\r\n', fnamepos);
			if(fnameend2 > 0 && fnameend2 < fnameend) {
				fnameend = fnameend2;
			}
			fname = discontent.substr(fnamepos+9, fnameend-fnamepos-9);

			content = req.body.slice(emptypos+4, boundpos2-4);

			var hcondis = req.headers['content-disposition'];
			if(typeof hcondis == 'string') {
				var hcondisarr = hcondis.split(';');
				for(var x in hcondisarr) {
					var findex = hcondisarr[x].indexOf('filename=');
					if(findex >= 0) {
						var fn = hcondisarr[x].substr(findex+9);
						if(fn.indexOf('-chunking-')) {
							fname = fn.replace(/"/g, '');
						}
					}
				}
			}
			break;
		}
	  }

	  boundpos1 = boundpos2;
	}

	var path = relpath || '/';
	var fpath = (path + '/' + fname).replace(/\/+/g, '/');

	uploadFile(fpath, content, req.user.name);

	return response.setStatus(200).json({
	  "files": [
	    {
		  "name": fname,
		  "size": content.length,
		  "type": "application/octet-stream",
		  "url": req.headers.origin + '/index.html?action=all&path=' + encodeURIComponent(fpath)
		  }
	  ]
	});
}

function createNewFolderInPath(path) {
	if(fs.isDirectory(path)) {
		var newName = 'NewFolder';
		var newPath = (path + '/').replace(/\/{2,}/g, "/");

		var index = 1;
		var iteName = newName;
		while(fs.exists(newPath + iteName)) {
			iteName = newName + '(' + index + ')';
			index++;
		}

		fs.makeDirectory(newPath + iteName);
		log.info('Create New Folder: ' + newPath + iteName);
		return iteName;
	}

	return null;
}

function getFoldersInPath(path) {
	var fsarr = []
	if(fs.isDirectory(path)) {
		var fslists = fs.list(path);
		for(var x in fslists) {
			var file = fs.join(path, fslists[x]);
			if(fs.isDirectory(file)) {
				fsarr.push(fslists[x]);
			}
		}

		return fsarr;
	}

	return null;
}

function renameNewFolderInPath(path, file, newfile) {
	var filePath = (path + '/' + file).replace(/\/{2,}/g, "/");
	var newfilePath = (path + '/' + newfile).replace(/\/{2,}/g, "/");
	if(fs.exists(filePath)) {
		if(fs.exists(newfilePath)) {
			return 1;
		}
		else {
			fs.move(filePath, newfilePath);
			return 0;
		}
	}

	return -1;
}

function removeFileFromPath(path) {
	if(fs.exists(path)) {
		fs.removeTree(path);
		return true;
	}

	return false;
}

var getUserFromAuthKey = exports.getUserFromAuthKey = function(authorization) {
	if(!authorization) {
		return false;
	}

	var credentials = base64.decode(authorization).split(':');

	if(config.get('dbsupport') == 'db') {
		var passcode = strings.digest(credentials[1], 'MD5');

		var connectionPool = module.singleton('connectionPool', function() {
			return Store.initConnectionPool({
				'url': 'jdbc:h2:' + config.get('database'),
				'driver': 'org.h2.Driver'
			});
		});
		var store = new Store(connectionPool);

		var User = store.defineEntity("User", MAPPING_USER);
		store.syncTables();

		var queryret = store.query("from User where name='" + credentials[0] + "' and password='" + passcode + "'");
		if(queryret.length > 0) {
			var useret = queryret[0];
			useret.password = credentials[1];

			return useret;
		}
	}
	else if(config.get('dbsupport') == 'file') {
		var txtStream = fs.open(config.get('database'), 'r');
		var authKey = txtStream.readLine().trim();

		while(authKey) {
			if(authKey.indexOf(authorization) >= 0) {
				return {name:credentials[0], password: credentials[1]};
			}

			authKey = txtStream.readLine().trim();
		}
	}

	return false;
}

var addUserToDB = exports.addUserToDB = function(name, password) {

	if(config.get('dbsupport') == 'db') {
		var passcode = strings.digest(password, 'MD5');

		var connectionPool = module.singleton('connectionPool', function() {
			return Store.initConnectionPool({
				'url': 'jdbc:h2:' + config.get('database'),
				'driver': 'org.h2.Driver'
			});
		});
		var store = new Store(connectionPool);

		var User = store.defineEntity("User", MAPPING_USER);
		store.syncTables();

		var queryret = store.query("from User where name='" + name + "' and password='" + passcode + "'");
		if(queryret.length > 0) {
			return false;
		}

		var transaction = store.beginTransaction();
		var newuser = new User({"name": name, "password": passcode});
		newuser.save();
		transaction.commit();
	}
	else if(config.get('dbsupport') == 'file') {
		var authorization = base64.encode(name + ':' + password);

		var inStream = fs.open(config.get('database'), 'r');
		var authKey = inStream.readLine().trim();

		while(authKey) {
			var credentials = base64.decode(authKey).split(':');
			if(name == credentials[0]) {
				return false;
			}

			authKey = inStream.readLine().trim();
		}

		var outStream = fs.open(config.get('database'), 'a');
		outStream.writeLine(authorization);
	}

	return true;
}

var updateUserPass = exports.updateUserPass = function(name, pass, newpass) {

	var auth = false;
	if(config.get('dbsupport') == 'db') {
		var passcode = strings.digest(pass, 'MD5');
		var newpasscode = strings.digest(newpass, 'MD5');

		var connectionPool = module.singleton('connectionPool', function() {
			return Store.initConnectionPool({
				'url': 'jdbc:h2:' + config.get('database'),
				'driver': 'org.h2.Driver'
			});
		});
		var store = new Store(connectionPool);

		var User = store.defineEntity("User", MAPPING_USER);
		store.syncTables();

		var queryret = store.query("from User where name='" + name + "' and password='" + passcode + "'");
		if(queryret.length > 0) {
			var upuser = User.get(queryret[0].id);
			upuser.password = newpasscode;
			upuser.save();
			auth = true;
		}

		return auth;
	}
	else if(config.get('dbsupport') == 'file') {
		var inStream = fs.open(config.get('database'), 'r');
		var rows = inStream.readLines();

		for(var x in rows) {
			var authKey = base64.encode(name + ':' + pass);
			var newKey = base64.encode(name + ':' + newpass);
			if(rows[x].trim().indexOf(authKey) >= 0) {
				auth = true;
				rows[x] = newKey;
			}
			else {
				rows[x] = rows[x].trim();
			}
		}

		if(auth) {
			var outStream = fs.open(config.get('database'), 'w');
			outStream.writeLines(rows);
		}
	}

	return auth;
}
