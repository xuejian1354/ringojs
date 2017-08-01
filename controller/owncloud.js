var fs = require("fs");
var mime = require('ringo/mime');
var {Reinhardt} = require("reinhardt");
var {Loader} = require('reinhardt/loaders/filesystem');
var log = require("ringo/logging").getLogger(module.id);

var config = require("../config");
var owndata = require("gestalt").load(module.resolve("owndata.json"));

 var templates = new Reinhardt({
	 loader: new Loader(module.resolve('../views'), module.resolve('../views/templates'))
});

var OwnCloud = exports.OwnCloud = function(method, req) {

	var baseurl = config.get('ownbaseurl');
	var reqpath = req.pathInfo;

	var reqable = (req.pathInfo.indexOf(baseurl) == 0);
	if(reqable) {
		reqpath = req.pathInfo.substr(baseurl.length);
	}

	var requrl = reqpath;
	if(req.queryString) {
		 requrl += '?' + req.queryString;
	}
	log.info(req.method + ' ' + requrl);
	//method == 'prop' && log.info('Body ' + req.body);

	function reqHandler(reqpath) {
		switch(reqpath) {
		case '/status.php':
			return {type: 'json', code: 200, context: config.get('owncloud')};

		case '/ocs/v1.php/cloud/user':
			if(req.query.format == 'json') {
				var usercontext = owndata.get('usercontext');
				usercontext.ocs.data['id'] = req.user.name;
				usercontext.ocs.data['display-name'] = req.user.name;
				return {type: 'json', code: 200, context: usercontext};
			}

		case '/ocs/v1.php/cloud/capabilities':
			if(req.query.format == 'json') {
				return {type: 'json', code: 200, context: owndata.get('capacontext')};
			}

		case '/ocs/v1.php/apps/files_sharing/api/v1/shares':
			return {type: 'xml', code: 200, context: '<?xml version="1.0"?>\r\n<ocs>\r\n <meta>\r\n  <status>ok</status>\r\n  <statuscode>100</statuscode>\r\n  <message/>\r\n </meta>\r\n <data/>\r\n</ocs>\r\n'};

		default:
			if(reqpath.indexOf('/remote.php/webdav') == 0) {
				if(method == 'prop') {
					return webdavHandler(req);
				}
				else if(method == 'get') {
					var filesinfo = getFilesInfo(req.pathInfo.substr((config.get('ownbaseurl')+'/remote.php/webdav').length) || '/');
					if(filesinfo.length > 0) {
						return getFileContentToReturnCode(filesinfo[0]);
					}
				}
				else if(method == 'mkcol') {
					var newfolder = req.pathInfo.substr((config.get('ownbaseurl')+'/remote.php/webdav').length);
					mkDir(newfolder);
					return {code: 201};
				}
				else if(method == 'del') {
					var filePath = req.pathInfo.substr((config.get('ownbaseurl')+'/remote.php/webdav').length);
					rmFile(filePath);
					return {code: 204};
				}
				else if(method == 'head') {
					var filePath = req.pathInfo.substr((config.get('ownbaseurl')+'/remote.php/webdav').length);
					if(findFile(filePath)) {
						return {code: 204};
					}
					else {
						return {code: 404};
					}
				}
				else if(method == 'move') {
					var filePath = req.pathInfo.substr((config.get('ownbaseurl')+'/remote.php/webdav').length);
					var destination = req.headers.destination;
					var davreq = '/remote.php/webdav';
					var destPath = destination.substr(destination.indexOf(davreq)+davreq.length);
					moveFile(filePath, destPath);
					return {code: 201};
				}
				else if(method == 'copy') {
					var filePath = req.pathInfo.substr((config.get('ownbaseurl')+'/remote.php/webdav').length);
					var destination = req.headers.destination;
					var davreq = '/remote.php/webdav';
					var destPath = destination.substr(destination.indexOf(davreq)+davreq.length);
					copyFile(filePath, destPath);
					return {code: 201};
				}
				else if(method == 'put') {
					var filePath = req.pathInfo.substr((config.get('ownbaseurl')+'/remote.php/webdav').length);
					putFile(filePath, req.body, req.headers['oc-total-length']);
					return {code: 201};
				}
			}
			else if(reqpath.indexOf('/index.php/apps/files/api/v1/thumbnail') == 0) {
				var thumbimg = config.get('datapath') + '/thumbnails/82/512-512.png';
				return {type: 'image/png', code: 200, headers: {'Content-Length': fs.size(thumbimg)}, context: fs.read(thumbimg, 'rb')};
			}
			else if(reqpath.indexOf('/index.php/avatar') == 0) {
				return {type: 'json', code: 200, context: {"data": {"displayname": req.user.name}}};
			}
			break;
		}

		return {code: 405};
	}

	OwnCloud.prototype.resHandler = function(res) {
		var rescon = reqHandler(reqpath);

		log.info('Return: ' + rescon.code + '\n');

		switch(rescon.type) {
		case 'json':
			return res.json(rescon.context).setStatus(rescon.code);

		case 'xml':
			return res.xml(rescon.context).setStatus(rescon.code);

		case '401':
			return res.setStatus(rescon.code).addHeaders(rescon.headers);

		case '207':
			return res.setStatus(rescon.code).addHeaders(rescon.headers).xml(rescon.context);

		case '404':
			return res.setStatus(rescon.code).xml(rescon.context);

		default:
			if(rescon.type 
			  && (rescon.type.indexOf('text/plain') == 0
			    || rescon.type.indexOf('image/') == 0
				|| rescon.type.indexOf('application/') == 0)) {
				return res.setStatus(rescon.code).addHeaders(rescon.headers).stream(rescon.stream, rescon.type);
			}

			return res.setStatus(rescon.code);
		}
	};

	function webdavHandler(req) {
		//get files.
		var baseurl = config.get('ownbaseurl');
		var davpath = '/remote.php/webdav';

		var fpath = req.pathInfo.substr((baseurl+davpath).length) || '/';

		var datahome = config.get('datapath') + '/' + req.user.name + '/files';
		var reqpath = datahome + fpath;
		//log.info('reqpath: ' + reqpath);

		if(!fs.exists(reqpath) && fpath == '/') {
			fs.makeTree(reqpath);
		}

		if(fs.exists(reqpath)) {
			var filesinfo = getFilesDavInfo(fpath);

			//request handler
			var headers = req.headers;

			var depth = headers.depth;
			var auth = headers.authorization;

			if(auth && auth.indexOf('Basic') == 0) {
				if(depth == 0) {
					return {type: "207", code: 207, headers: {'DAV': '1, 3, extended-mkcol', 'Vary': 'Brief,Prefer'}};
				}
				else if(depth == 1) {
					return {type: "207", code: 207, headers: {'DAV': '1, 3, extended-mkcol', 'Vary': 'Brief,Prefer'}, context: filesinfo};
				}

				return {code: 200};
			}
			else {
				return {type: "401", code: 401, headers: {'WWW-Authenticate': 'Basic realm="owncloud"'}};
			}
		}
		else {
			var davScript = '<?xml version="1.0"?>\r\n';
			davScript += '<d:error xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">\r\n';
			davScript += '  <s:exception>Sabre\DAV\Exception\NotFound</s:exception>\r\n';
			davScript += '  <s:message>File with name ' + fpath + ' could not be located</s:message>\r\n';
			davScript += '</d:error>\r\n';

			return {type: '404', code: 404, context: davScript};
		}
	}

	function getFilesDavInfo(fpath){
		return genDavXML(getFilesInfo(fpath));
	}

	function getFilesInfo(fpath){
		var baseurl = config.get('ownbaseurl') + '/remote.php/webdav/';

		var datahome = config.get('datapath') + '/' + req.user.name + '/files';
		var reqpath = datahome + fpath;
		log.info('reqpath: ' + reqpath);

		if(fs.isFile(reqpath)) {
			var fileinfo = {
				name: fpath,
				type: '-',
				mime: mime.mimeType(fpath),
				path: reqpath,
				url: (baseurl+fpath).replace(/\/{2,}/g, "/"),
				size: fs.size(reqpath),
				date: fs.lastModified(reqpath)
			};

			//log.info('fileinfo: ' + JSON.stringify(fileinfo));
			return [fileinfo];
		}
		else if(fs.isDirectory(reqpath)) {
			var filesinfo = [{
				name: fpath,
				type: 'd',
				path: reqpath,
				url: (baseurl+fpath).replace(/\/{2,}/g, "/"),
				size: fs.list(reqpath).length,
				date: fs.lastModified(reqpath)
			}];

			var names = fs.list(reqpath);
			names.forEach(function(name) {
				var fullPath = fs.join(reqpath, name).replace(/\/{2,}/g, "/");
				if (fs.isFile(fullPath)) {
					filesinfo.push({
						name: name,
						type: '-',
						mime: mime.mimeType(name),
						path: reqpath,
						url: (baseurl+fpath+'/'+name).replace(/\/{2,}/g, "/"),
						size: fs.size(fullPath),
						date: fs.lastModified(fullPath)
					});
				}
				else if (fs.isDirectory(fullPath)) {
					filesinfo.push({
						name: name,
						type: 'd',
						path: reqpath,
						url: (baseurl+fpath+'/'+name+'/').replace(/\/{2,}/g, "/"),
						size: fs.list(fullPath).length,
						date: fs.lastModified(fullPath)
					});
				}
			});

			//log.info('filesinfo: ' + JSON.stringify(filesinfo));
			return filesinfo;
		}
		else if(!fs.exists(reqpath) && fpath == '/') {
			fs.makeDirectory(reqpath);
		}

		return [];
	}

	function mkDir(dpath) {
		var baseurl = config.get('ownbaseurl') + '/remote.php/webdav/';

		var datahome = config.get('datapath') + '/' + req.user.name + '/files';
		var reqpath = datahome + dpath;
		log.info('reqpath: ' + reqpath);

		if(!fs.exists(reqpath)) {
			fs.makeDirectory(reqpath);
		}
	}

	function rmFile(fpath) {
		var baseurl = config.get('ownbaseurl') + '/remote.php/webdav/';

		var datahome = config.get('datapath') + '/' + req.user.name + '/files';
		var reqpath = datahome + fpath;
		log.info('reqpath: ' + reqpath);

		if(fs.exists(reqpath)) {
			fs.removeTree(reqpath);
		}
	}

	function findFile(fpath) {
		var baseurl = config.get('ownbaseurl') + '/remote.php/webdav/';

		var datahome = config.get('datapath') + '/' + req.user.name + '/files';
		var reqpath = datahome + fpath;
		log.info('reqpath: ' + reqpath);

		if(fs.exists(reqpath)) {
			return true;
		}
		else {
			return false;
		}
	}

	function moveFile(source, target) {
		var baseurl = config.get('ownbaseurl') + '/remote.php/webdav/';

		var datahome = config.get('datapath') + '/' + req.user.name + '/files';
		var reqsrc = datahome + source;
		var reqtar = datahome + target;
		log.info('move: ' + reqsrc + ' To ' + reqtar);

		if(fs.exists(reqsrc)) {
			fs.move(reqsrc, reqtar);
		}
	}

	function copyFile(source, target) {
		var baseurl = config.get('ownbaseurl') + '/remote.php/webdav/';

		var datahome = config.get('datapath') + '/' + req.user.name + '/files';
		var reqsrc = datahome + source;
		var reqtar = datahome + target;
		log.info('copy: ' + reqsrc + ' To ' + reqtar);

		if(fs.exists(reqsrc) && !fs.exists(reqtar)) {
			fs.copyTree(reqsrc, reqtar);
		}
	}

	function putFile(fpath, content, totallen) {
		uploadFile(fpath, content, req.user.name);
	}

	function genDavXML(infos) {
		var davScript = '<?xml version="1.0"?>\r\n<d:multistatus xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns" xmlns:oc="http://owncloud.org/ns">\r\n';

		for(var x in infos) {
			davScript += '<d:response>\r\n';
			davScript += ' <d:href>' + escape(infos[x].url) + '</d:href>\r\n';
			davScript += ' <d:propstat>\r\n';
			davScript += '  <d:prop>\r\n';
			davScript += '   <d:getlastmodified>' + infos[x].date + '</d:getlastmodified>\r\n';
			davScript += '   <oc:id>0000000' + x + 'ocsnrcs3yj8t</oc:id>\r\n';
			davScript += '   <d:getetag>&quot;593f46028afe' + x + '&quot;</d:getetag>\r\n';
			if(infos[x].type == '-') {
				davScript += '   <d:resourcetype/>\r\n';
				davScript += '   <d:getcontentlength>' + infos[x].size + '</d:getcontentlength>\r\n';
				davScript += '   <d:getcontenttype>' + infos[x].mime + '</d:getcontenttype>\r\n';
				davScript += '   <oc:permissions>RDNVW</oc:permissions>\r\n';
			}
			else {
				davScript += '   <d:quota-available-bytes>-3</d:quota-available-bytes>\r\n';
				davScript += '   <d:resourcetype>\r\n    <d:collection/>\r\n   </d:resourcetype>\r\n';
				davScript += '   <oc:size>' + infos[x].size + '</oc:size>\r\n';
				davScript += '   <oc:permissions>RDNVCK</oc:permissions>\r\n';
			}
			davScript += '  </d:prop>\r\n';
			davScript += '  <d:status>HTTP/1.1 200 OK</d:status>\r\n';
			davScript += ' </d:propstat>\r\n';
			if(infos[x].type == '-') {
				davScript += '  <d:propstat>\r\n   <d:prop>\r\n    <oc:size/>\r\n    <d:creationdate/>\r\n    <d:displayname/>\r\n    <d:quota-available-bytes/>\r\n    <d:quota-used-bytes/>\r\n   </d:prop>\r\n  <d:status>HTTP/1.1 404 Not Found</d:status>\r\n </d:propstat>\r\n';
			}
			else {
				davScript += ' <d:propstat>\r\n  <d:prop>\r\n   <d:creationdate/>\r\n   <d:getcontentlength/>\r\n   <d:displayname/>\r\n   <d:getcontenttype/>\r\n  </d:prop>\r\n  <d:status>HTTP/1.1 404 Not Found</d:status>\r\n </d:propstat>\r\n';
			}
			davScript += '</d:response>\r\n';
		}

		davScript += '</d:multistatus>\r\n';
		//log.info('davXML: ' + davScript);
		return davScript;
		//return fs.read(config.get("configHome")+"/controller/test.xml", "r");
	}

	function getFileContentToReturnCode(fileinfo) {
		var stream = fs.open(fileinfo.path, 'rb');
		if(stream) {
			return {type: fileinfo.mime, code: 200, headers: {'Content-Length': fileinfo.size}, stream: stream};
		}
		else {
			return {code: 404};
		}
	}
}

var uploadFile = exports.uploadFile = function (fpath, content, username) {
	var fsstol = 1;
	var fsscur = 0;

	var fname = fpath.split('/')
	fname = fname[fname.length-1];

	log.info('PUT ' + fpath);

	var chunkloc = fname.indexOf('-chunking-');
	if(chunkloc > 0) {
		var fss = fname.split('-');
		if(fss.length > 2) {
		  fsstol = parseInt(fss[fss.length-2]);
		  fsscur = parseInt(fss[fss.length-1]);
		}
		fname = fname.substr(0, chunkloc);
		fpath = fpath.substr(0, fpath.indexOf(fname)+fname.length);
	}
	//log.info('----->>> fname: ' + fname + ', fsstol: ' + fsstol + ', fsscur: ' + fsscur);

	var datahome = config.get('datapath') + '/' + username + '/files';
	var reqpath = datahome + fpath;

	if(fsstol == 1) {
		var i = 1;
		while(fs.exists(reqpath)) {
			var npos = fpath.lastIndexOf('.'); 
			if(npos < 0 || npos > fpath.length) {
				npos = fpath.length;
			}
			reqpath = datahome + fpath.substr(0, npos) + '(' + i + ')' + fpath.substr(npos);
			i++;
		}
	}

	//log.info('reqpath: ' + reqpath);

	if(fsscur == 0) {
		  fs.write(reqpath, content);
	}
	else if(fsscur > 0 && fsstol > 1 && fsscur < fsstol) {
		fs.write(reqpath, content, 'a');
	}
}
