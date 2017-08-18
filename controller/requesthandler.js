var fs = require("fs");
var mime = require('ringo/mime');
var dates = require('ringo/utils/dates');
var {Reinhardt} = require("reinhardt");
var {Loader} = require('reinhardt/loaders/filesystem');
var {setCookie, parseParameters} = require('ringo/utils/http');
var {getFileSizeFormat, uploadFile, getShareFilesWithCellphone} = require('./owncloud');
var {addUserToDB, updateUserPass, updateUserToDB, getUsersFromDB, getFileShareFromPathWithNum, delFileShareFromId, getFileShareWithNum, getNameFromCellphone, getFileShareToUserWithNum, setFileShareToUserWithNum} = require('./dataopt');
var base64 = require("ringo/base64");
var strings = require("ringo/utils/strings");
var response = require("ringo/jsgi/response");
var config = require("../config");
var menuconfig = require("gestalt").load(module.resolve("../config/menu.json"));
var log = require("ringo/logging").getLogger(module.id);

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
		authKey: base64.encode(this.request.user.cellphone + ':' + this.request.user.password),
		query: this.request.query
	});

	if(this.cookie) {
		restemp.headers['set-cookie'] = this.cookie;
	}
	return restemp;
}

HttpHandler.prototype.addCookie = function(cellphone, value, duration) {
	this.cookie = setCookie(cellphone, value, duration);
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
	case 'all': return getSelectFiles(req.query.path, req.user.cellphone);
	}

	return null;
}

function getSelectFiles(path, cellphone, lastlink, appendobj) {
	var locpath = path || '/';
	var homepath = config.get('datapath') + '/' + cellphone;
	if(!fs.exists(homepath)) {
		fs.makeTree(homepath);
	}

	var abspath = homepath + locpath;

	var locallist = getLocalPathList(locpath);
	if(!lastlink && locallist.length > 1) {
		lastlink = locallist[locallist.length-2];
	}
	return {path: locpath, locallist: locallist, lastlink: lastlink, files: getAllFilesByPath(abspath, locpath, appendobj)};
}

function getMyShareFiles(path, cellphone) {
	var lastlink;
	path = path || '/';

	if(path == '/') {
		var filesinfo = [];
		var dirsinfo = [];

		var fileshares = getFileShareWithNum('master', cellphone);
		var homepath = config.get('datapath') + '/' + cellphone;

		for(var x in fileshares) {
			var fullPath = homepath + fileshares[x].path;
			var sloc = fullPath.replace(/\/{2,}/g, "/").split('/');
			var name = sloc.pop();
			if(!name) {
				name = sloc.pop();
			}

			var slavename = getNameFromCellphone(fileshares[x].slave) || (fileshares[x].slave.substr(0,3) + '****' + fileshares[x].slave.substr(-4));

			if (fs.isFile(fullPath)) {
				filesinfo.push({
					name: name,
					type: '-',
					mime: mime.mimeType(name),
					path: encodeURIComponent(fileshares[x].path),
					size: getFileSizeFormat(fullPath),
					append: {
						shareid: fileshares[x].id,
						sharewith: slavename
					}
				});
			}
			else if (fs.isDirectory(fullPath)) {
				dirsinfo.push({
					name: name,
					type: 'd',
					path: encodeURIComponent(fileshares[x].path),
					size: fs.list(fullPath).length,
					append: {
						shareid: fileshares[x].id,
						sharewith: slavename
					}
				});
			}
		}

		return {path: path, files: appendindex(dirsinfo.concat(filesinfo))};
	}
	else if(getFileShareWithNum('master', cellphone, path).length > 0) {
		lastlink = {index: 1, path: '.', link: encodeURIComponent('/'), type: 'd'};
	}

	return getSelectFiles(path, cellphone, lastlink);
}

function getShareFiles(path, cellphone, master) {
	var lastlink;
	path = path || '/';

	if(path == '/') {
		return {path: path, files: getShareFilesWithCellphone(cellphone)};
	}
	else if(getFileShareWithNum('slave', cellphone, path).length > 0) {
		lastlink = {index: 1, path: '.', link: encodeURIComponent('/'), type: 'd'};
	}

	var mastername = getNameFromCellphone(master) || (master.substr(0,3) + '****' + master.substr(-4));
	return getSelectFiles(path, master, lastlink, {sharefrom: mastername, sharemaster: master});
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
			if(type == 'd') {
				tlink += '/';
			}

			loclink.push({index: x+1, path: locarr[x], link: encodeURIComponent(tlink.replace(/\/{2,}/g, "/")), type: type});
		}
	}

	//log.info('loclink: ' + JSON.stringify(loclink));
	return loclink;
}

function getAllFilesByPath(path, locpath, appendobj) {
	if(fs.isDirectory(path)) {
		var filesinfo = [];
		var dirsinfo = [];
		var names = fs.list(path).sort();
		names.forEach(function(name) {
			if(name.indexOf('.') == 0) {
				return;
			}

			var fullPath = fs.join(path, name).replace(/\/{2,}/g, "/");
			if (fs.isFile(fullPath)) {
				filesinfo.push({
					name: name,
					type: '-',
					mime: mime.mimeType(name),
					path: encodeURIComponent((locpath+'/'+name).replace(/\/{2,}/g, "/")),
					size: getFileSizeFormat(fullPath),
					date: dates.format(fs.lastModified(fullPath), 'yyyy-MM-dd'),
					append: appendobj
				});
			}
			else if (fs.isDirectory(fullPath)) {
				dirsinfo.push({
					name: name,
					type: 'd',
					path: encodeURIComponent((locpath+'/'+name+'/').replace(/\/{2,}/g, "/")),
					size: fs.list(fullPath).length,
					date: dates.format(fs.lastModified(fullPath), 'yyyy-MM-dd'),
					append: appendobj
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
			date: dates.format(fs.lastModified(path), 'yyyy-MM-dd'),
			append: appendobj
		};

		//log.info('fileinfo: ' + JSON.stringify(fileinfo));
		return appendindex([fileinfo]);
	}

	return [];
}

function getSearchFiles(cellphone, locpath, searstr, filesinfo, dirsinfo) {
	var homepath = config.get('datapath') + '/' + cellphone;
	var path = (homepath+locpath).replace(/\/{2,}/g, "/");
	var names = fs.list(path);
	names.forEach(function(name) {
		var fullPath = fs.join(path, name).replace(/\/{2,}/g, "/");
		if (fs.isFile(fullPath) && name.toLowerCase().indexOf(searstr.toLowerCase()) >= 0) {
			filesinfo.push({
				name: name,
				type: '-',
				mime: mime.mimeType(name),
				path: encodeURIComponent((locpath+'/'+name).replace(/\/{2,}/g, "/")),
				size: getFileSizeFormat(fullPath),
				date: dates.format(fs.lastModified(fullPath), 'yyyy-MM-dd')
			});
		}
		else if (fs.isDirectory(fullPath)) {
			if(name.toLowerCase().indexOf(searstr.toLowerCase()) >= 0) {
				dirsinfo.push({
					name: name,
					type: 'd',
					path: encodeURIComponent((locpath+'/'+name+'/').replace(/\/{2,}/g, "/")),
					size: fs.list(fullPath).length,
					date: dates.format(fs.lastModified(fullPath), 'yyyy-MM-dd')
				});
			}

			getSearchFiles(cellphone, locpath+'/'+name+'/', searstr, filesinfo, dirsinfo);
		}
	});
}

function appendindex(arr) {
	for(var x in arr) {
		arr[x].index = x;
	}

	return arr;
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
			retdata.selectData = getSelectFiles(req.params.path, req.user.cellphone);
			break;

		case 'myshare':
			retdata.selectData = getMyShareFiles(req.params.path, req.user.cellphone);
			break;

		case 'share':
			retdata.selectData = getShareFiles(req.params.path, req.user.cellphone, req.params.master);
			retdata.selectData.sharemaster = req.params.master;
			break;

		case 'more':
		case 'user':
			retdata.name = req.user.name;
			retdata.cellphone = req.user.cellphone.substr(0, 3) + '****' + req.user.cellphone.substr(-4);
			break;

		case 'resetpass':
			retdata.cellphone = req.user.cellphone;
			break;

		case 'logout':
			retdata.action = 'logout';
			break;
		}
		return response.setStatus(200).json(retdata);

	case 'newfolder':
		var locpath = req.params.path || '/';
		var abspath = config.get('datapath') + '/' + req.user.cellphone + locpath;
		var newFolder = createNewFolderInPath(abspath);
		if(newFolder) {
			return response.setStatus(201).json({folder: newFolder, date: dates.format(new Date(), 'yyyy-MM-dd')});
		}
		else {
			return response.setStatus(405);
		}

	case 'renamefile':
		var locpath = req.params.path || '/';
		var abspath = config.get('datapath') + '/' + req.user.cellphone + locpath;
		var ret = renameNewFolderInPath(abspath, req.params.file, req.params.newfile);
		if(ret == 0) {
			var fshares = getFileShareFromPathWithNum(locpath, req.user.cellphone);
			if(fshares.length > 0) {
				delFileShareFromId(fshares[0].id);
			}

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
			var fpath = decodeURIComponent(reqpaths[x]);
			var abspath = (config.get('datapath') + '/' + req.user.cellphone + '/' + fpath).replace(/\/{2,}/g, "/");

			var fshares = getFileShareFromPathWithNum(fpath, req.user.cellphone);
			if(fshares.length > 0) {
				delFileShareFromId(fshares[0].id);
			}

			removeFileFromPath(abspath);
			retpath = fs.directory(decodeURIComponent(reqpaths[x]));
		}

		req.params.opt = 'view';
		req.params.action = 'all';
		req.params.path = retpath;
		return postHandler(req);

	case 'getfolders':
		var locpath = req.params.path || '/';
		var abspath = config.get('datapath') + '/' + req.user.cellphone + locpath;
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
			var fpath = decodeURIComponent(srcs[x]);
			var srcpath = config.get('datapath') + '/' + req.user.cellphone + fpath;
			if(req.params.master) {
				srcpath = config.get('datapath') + '/' + req.params.master + fpath;
			}
			var tarpath = config.get('datapath') + '/' + req.user.cellphone + req.params.target;

			if(fs.exists(srcpath) && fs.isDirectory(tarpath)) {
				if(srcpath.lastIndexOf('/') == srcpath.length-1) {
					srcpath = srcpath.substr(0, srcpath.length-1);
				}

				var ftarget = fs.join(tarpath, fs.base(srcpath));

				if(req.params.opt == 'movefile') {
					if(!fs.exists(ftarget)) {
						fs.move(srcpath, ftarget);

						var fshares = getFileShareFromPathWithNum(fpath, req.user.cellphone);
						if(fshares.length > 0) {
							delFileShareFromId(fshares[0].id);
						}
					}
				}
				else if(req.params.opt == 'copyfile') {
					var index = 1;
					var srcbase = fs.base(srcpath);
					while(fs.exists(ftarget)) {
						var potpos = srcbase.lastIndexOf('.');
						log.info('potpos: ' + potpos);
						if(potpos <= 0 || potpos > srcbase.length-2) {
							potpos = srcbase.length;
						}

						ftarget = fs.join(tarpath, srcbase.substr(0, potpos) + '(' + index + ')' + srcbase.substr(potpos));
						index++;
					}

					fs.copyTree(srcpath, ftarget);
				}
			}
		}

		req.params.opt = 'view';
		req.params.action = 'all';
		if(req.params.reaction) {
			req.params.action = req.params.reaction;
		}
		req.params.path = req.params.location;
		return postHandler(req);

	case 'getusers':
		var srcarr = req.params.srcarr;
		var users = getUsersFromDB(req.user.cellphone);
		for(var x in users) {
			users[x].name = users[x].name || (users[x].cellphone.substr(0, 3) + '****' + users[x].cellphone.substr(-4));
			for(var y in srcarr) {
				var queryret = getFileShareToUserWithNum(srcarr, users[x].cellphone, req.user.cellphone);
				if(queryret.length > 0) {
					users[x].selected = true;
					users[x].shareid = queryret[0].id;
				}
			}
		}
		return response.setStatus(200).json({users: users});

	case 'sharefile':
		for(var x in req.params.shareids) {
			delFileShareFromId(req.params.shareids[x]);
		}

		for(var x in req.params.optnums) {
			for(var y in req.params.files) {
				setFileShareToUserWithNum(req.params.files[y], req.params.optnums[x], req.user.cellphone);
			}
		}
		return response.setStatus(200);

	case 'cancleshare':
		delFileShareFromId(req.params.id);

		req.params.opt = 'view';
		req.params.action = req.params.reaction;
		return postHandler(req);

	case 'resetpass':
		if(updateUserPass(req.params.cellphone, req.params.password, req.params.newpassword)) {
			var authKey = base64.encode(req.params.cellphone + ':' + req.params.newpassword);
			return response.setStatus(200).json({status: 'success', authKey: authKey});
		}
		else {
			return response.setStatus(200).json({status: 'fail'});
		}

	case 'renameuser':
		updateUserToDB(req.user.cellphone, req.params.name);
		return response.setStatus(200);

	case 'filesearch':
		var retdata = {};
		if(req.params.val) {
			var filesinfo = [];
			var dirsinfo = [];

			getSearchFiles(req.user.cellphone, req.params.path, req.params.val, filesinfo, dirsinfo);

			var lastlink;
			var locallist = getLocalPathList(req.params.path);
			if(!lastlink && locallist.length > 1) {
				lastlink = locallist[locallist.length-2];
			}

			retdata.selectData = {
				searstr: req.params.val,
				path: req.params.path,
				locallist: locallist,
				lastlink: lastlink,
				files: dirsinfo.concat(filesinfo)
			}
		}
		else {
			retdata.selectData = getSelectFiles(req.params.path, req.user.cellphone);
		}

		retdata.selectMenu = getSelectMenuByAction(menuconfig.get('menus'), req.params.action);
		retdata.action = retdata.selectMenu.submenu.action;

		return response.setStatus(200).json(retdata);
	}

	return response.setStatus(200);
}

var putHandler = exports.putHandler = function(req) {
	const CRLF = new ByteString("\r\n", "ASCII");
	const EMPTY_LINE = new ByteString("\r\n\r\n", "ASCII");

	var boundary = new ByteString(req.headers['content-type'].substr(req.headers['content-type'].indexOf('boundary=')+9), "ASCII");

	var relpath = null;
	var upimg = null;
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

		case 'upimg':
			var relend = req.body.indexOf(CRLF, emptypos+4);
			upimg = req.body.slice(emptypos+4, relend).decodeToString();
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
							break;
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

	uploadFile(fpath, content, req.user.cellphone, upimg);

	return response.setStatus(200).json({
	  "files": [
	    {
		  "name": fname,
		  "size": content.length,
		  "type": "application/octet-stream"
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
			if(fs.isDirectory(file) && fslists[x].indexOf('.') != 0) {
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