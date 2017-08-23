var fs = require("fs");
var mime = require('ringo/mime');
var dates = require('ringo/utils/dates');
var {Reinhardt} = require("reinhardt");
var {Loader} = require('reinhardt/loaders/filesystem');
var {Store} = require("ringo-sqlstore");
var {getSearchUser, getFileShareWithNum, getFileShareFromPathWithNum, getFileShareFromId, delFileShareFromId, setFileShareToUserWithNum, getCellphoneFromName, getNameFromCellphone} = require('./dataopt');
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

	function reqHandler(reqpath) {
		switch(reqpath) {
		case '/status.php':
			return {type: 'json', code: 200, context: config.get('owncloud')};

		case '/ocs/v1.php/cloud/user':
			if(req.query.format == 'json') {
				var usercontext = owndata.get('usercontext');
				usercontext.ocs.data['id'] = req.user.cellphone;
				usercontext.ocs.data['display-name'] = req.user.cellphone;
				return {type: 'json', code: 200, context: usercontext};
			}
			break;

		case '/ocs/v1.php/cloud/capabilities':
			if(req.query.format == 'json') {
				return {type: 'json', code: 200, context: owndata.get('capacontext')};
			}
			break;

		case '/ocs/v1.php/apps/files_sharing/api/v1/shares':
			var fshare;
			if(method == 'get') {
				fshare = getFileShareFromPath(req.query.path);
			}
			else if(method == 'post') {
				fshare = setFileShareToUser(req.params.path, req.params.shareWith);
			}

			return {type: 'xml', code: 200, context: getFileShareXML(fshare)};

		case '/ocs/v2.php/apps/notifications/api/v1/notifications':
			if(req.query.format == 'json') {
				var usercontext = owndata.get('usercontext');
				usercontext.ocs.data = [];
				return {type: 'json', code: 200, context: usercontext};
			}
			break;

		case '/ocs/v2.php/apps/files_sharing/api/v1/sharees':
			if(req.query.format == 'json') {
				var users = getSearchUser(req.query.search, req.query.page, req.query.perpage);
				return {type: 'json', code: 200, context: transSearchUsersToJson(users)};
			}
			break;

		default:
			if(reqpath.indexOf('/remote.php/webdav') == 0) {
				if(method == 'prop') {
					var baseurl = config.get('ownbaseurl');
					var davpath = '/remote.php/webdav';
					var fpath = req.pathInfo.substr((baseurl+davpath).length) || '/';
					return webdavHandler(req, fpath);
				}
				else if(method == 'get') {
					var master = req.user.name;
					var datahome = config.get('datapath') + '/' + master;
					var fpath = req.pathInfo.substr((config.get('ownbaseurl')+'/remote.php/webdav').length) || '/';
					if(!fs.exists(datahome+fpath)) {
						var fshare = getShareFilesWithCellphone(master, [], fpath);
						if(!fshare) {
							break;
						}

						fpath = fshare.path;
						master = fshare.append.sharemaster;
					}

					var filesinfo = getFilesInfo(fpath, master);
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
					putFile(filePath, req.input.read(), req.headers['oc-total-length']);
					return {code: 201};
				}
			}
			else if(reqpath.indexOf('/index.php/apps/files/api/v1/thumbnail') == 0) {
				var thumbimg = config.get('datapath') + '/thumbnails/82/512-512.png';
				return {type: 'image/png', code: 200, headers: {'Content-Length': fs.size(thumbimg)}, context: fs.read(thumbimg, 'rb')};
			}
			else if(reqpath.indexOf('/index.php/avatar') == 0) {
				return {type: 'json', code: 200, context: {"data": {"displayname": req.user.cellphone}}};
			}
			else if(reqpath.indexOf('/ocs/v1.php/apps/files_sharing/api/v1/shares') == 0) {
				var fshare;
				var fid = reqpath.split('/').pop();
				if(method == 'del') {
					fshare = delFileShareFromId(fid);
				}
				else if(method == 'get') {
					fshare = getFileShareFromId(fid);
				}
				return {type: 'xml', code: 200, context: getFileShareXML(fshare)};
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

	function webdavHandler(req, fpath, master, prehead) {
		var datahome = config.get('datapath') + '/' + req.user.cellphone;
		if(master) {
			datahome = config.get('datapath') + '/' + master;
		}
		var reqpath = datahome + fpath;
		//log.info('reqpath: ' + reqpath);

		if(!fs.exists(reqpath) && fpath == '/') {
			fs.makeTree(reqpath);
		}

		if(fs.exists(reqpath)) {
			var filesinfo = getFilesDavInfo(fpath, master, prehead);

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

		var fshare = getShareFilesWithCellphone(req.user.cellphone, getFilesInfo('/'), fpath);
		if(fshare) {
			return webdavHandler(req, fshare.path, fshare.append.sharemaster, fpath);
		}

		var davScript = '<?xml version="1.0"?>\r\n';
		davScript += '<d:error xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">\r\n';
		davScript += '  <s:exception>Sabre\DAV\Exception\NotFound</s:exception>\r\n';
		davScript += '  <s:message>File with name ' + fpath + ' could not be located</s:message>\r\n';
		davScript += '</d:error>\r\n';

		return {type: '404', code: 404, context: davScript};
	}

	function getFilesDavInfo(fpath, master, prehead){
		var filesinfo = getFilesInfo(fpath, master, prehead);
		if(fpath == '/') {
			filesinfo = getShareFilesWithCellphone(req.user.cellphone, filesinfo);
		}

		return genDavXML(filesinfo);
	}

	function getFilesInfo(fpath, master, prehead){
		var baseurl = config.get('ownbaseurl') + '/remote.php/webdav/';
		var datahome = config.get('datapath') + '/' + req.user.cellphone;
		if(master) {
			datahome = config.get('datapath') + '/' + master;
		}

		var requrl = (baseurl+fpath).replace(/\/{2,}/g, "/");
		if(prehead) {
			requrl = (baseurl+prehead).replace(/\/{2,}/g, "/");
		}
		var reqpath = datahome + fpath;

		if(fs.isFile(reqpath)) {
			var fileinfo = {
				name: fpath,
				type: '-',
				mime: mime.mimeType(fpath),
				path: reqpath,
				url: requrl,
				size: fs.size(reqpath),
				date: dates.format(fs.lastModified(reqpath), 'E, dd MMM yyyy HH:mm:ss', 'en', 'TMT+8') + ' GMT'
			};

			//log.info('fileinfo: ' + JSON.stringify(fileinfo));
			return [fileinfo];
		}
		else if(fs.isDirectory(reqpath)) {
			var filesinfo = [{
				name: fpath,
				type: 'd',
				path: reqpath,
				url: requrl,
				size: fs.list(reqpath).length,
				date: dates.format(fs.lastModified(reqpath), 'E, dd MMM yyyy HH:mm:ss', 'en', 'TMT+8') + ' GMT'
			}];

			var names = fs.list(reqpath);
			names.forEach(function(name) {
				if(name.indexOf('.') == 0) {
					return;
				}

				var fullPath = fs.join(reqpath, name).replace(/\/{2,}/g, "/");
				if (fs.isFile(fullPath)) {
					filesinfo.push({
						name: name,
						type: '-',
						mime: mime.mimeType(name),
						path: reqpath,
						url: (requrl+'/'+name).replace(/\/{2,}/g, "/"),
						size: fs.size(fullPath),
						date: dates.format(fs.lastModified(fullPath), 'E, dd MMM yyyy HH:mm:ss', 'en', 'TMT+8') + ' GMT'
					});
				}
				else if (fs.isDirectory(fullPath)) {
					filesinfo.push({
						name: name,
						type: 'd',
						path: reqpath,
						url: (requrl+'/'+name+'/').replace(/\/{2,}/g, "/"),
						size: fs.list(fullPath).length,
						date: dates.format(fs.lastModified(fullPath), 'E, dd MMM yyyy HH:mm:ss', 'en', 'TMT+8') + ' GMT'
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

		var datahome = config.get('datapath') + '/' + req.user.cellphone;
		var reqpath = datahome + dpath;
		log.info('reqpath: ' + reqpath);

		if(!fs.exists(reqpath)) {
			fs.makeDirectory(reqpath);
		}
	}

	function rmFile(fpath) {
		var baseurl = config.get('ownbaseurl') + '/remote.php/webdav/';

		var datahome = config.get('datapath') + '/' + req.user.cellphone;
		var reqpath = datahome + fpath;
		log.info('reqpath: ' + reqpath);

		if(fs.exists(reqpath)) {
			var fshares = getFileShareFromPathWithNum(fpath, req.user.cellphone);
			if(fshares.length > 0) {
				delFileShareFromId(fshares[0].id);
			}

			fs.removeTree(reqpath);
		}
	}

	function findFile(fpath) {
		var baseurl = config.get('ownbaseurl') + '/remote.php/webdav/';

		var datahome = config.get('datapath') + '/' + req.user.cellphone;
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

		var datahome = config.get('datapath') + '/' + req.user.cellphone;
		var reqsrc = datahome + source;
		var reqtar = datahome + target;
		log.info('move: ' + reqsrc + ' To ' + reqtar);

		if(fs.exists(reqsrc)) {
			fs.move(reqsrc, reqtar);
		}
	}

	function copyFile(source, target) {
		var baseurl = config.get('ownbaseurl') + '/remote.php/webdav/';

		var datahome = config.get('datapath') + '/' + req.user.cellphone;
		var reqsrc = datahome + source;
		var reqtar = datahome + target;
		log.info('copy: ' + reqsrc + ' To ' + reqtar);

		if(fs.exists(reqsrc) && !fs.exists(reqtar)) {
			fs.copyTree(reqsrc, reqtar);
		}
	}

	function putFile(fpath, content, totallen) {
		uploadFile(fpath, content, req.user.cellphone);
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

	function getFileShareFromPath(path){
		var sharefiles = getFileShareFromPathWithNum(path, req.user.cellphone);
		if(path == '/') {
			var slaveshares = getFileShareWithNum('slave', req.user.cellphone);
			for(var x in slaveshares) {
				var sarr = slaveshares[x].path.split('/');
				slaveshares[x].path = '/' + sarr.pop();
				if(slaveshares[x].path == '/') {
					slaveshares[x].path = '/' + sarr.pop() + '/';
				}
			}

			sharefiles = sharefiles.concat(slaveshares);
		}

		return sharefiles;
	}

	function setFileShareToUser(path, shareWith) {
		
		return setFileShareToUserWithNum(path, getCellphoneFromName(shareWith), req.user.cellphone);
	}

	function getFileShareXML(fshare) {
		var shareXML = '<?xml version="1.0"?>\r\n';
		shareXML += '<ocs>\r\n';
		shareXML += ' <meta>\r\n';
		shareXML += '  <status>ok</status>\r\n';
		shareXML += '  <statuscode>100</statuscode>\r\n';
		shareXML += '  <message/>\r\n';
		shareXML += ' </meta>\r\n';
		shareXML += ' <data>\r\n';
		for(var x in fshare) {
			shareXML += '  <element>\r\n';
			shareXML += '   <id>' + fshare[x].id +  '</id>\r\n';
			shareXML += '   <share_type>0</share_type>\r\n';
			shareXML += '   <uid_owner>' + fshare[x].master + '</uid_owner>\r\n';
			shareXML += '   <displayname_owner>' + fshare[x].master + '</displayname_owner>\r\n';
			shareXML += '   <permissions>19</permissions>\r\n';
			shareXML += '   <stime>' + dates.format(new Date(), 'yyMMddhhmm') + '</stime>\r\n';
			shareXML += '   <parent/>\r\n';
			shareXML += '   <expiration/>\r\n';
			shareXML += '   <token/>\r\n';
			shareXML += '   <uid_file_owner>' + fshare[x].master + '</uid_file_owner>\r\n';
			shareXML += '   <displayname_file_owner>' + fshare[x].master + '</displayname_file_owner>\r\n';
			shareXML += '   <path>' + fshare[x].path + '</path>\r\n';
			shareXML += '   <item_type>file</item_type>\r\n';
			shareXML += '   <mimetype>application/octet-stream</mimetype>\r\n';
			shareXML += '   <storage_id>home::' + fshare[x].master + '</storage_id>\r\n';
			shareXML += '   <storage>1</storage>\r\n';
			shareXML += '   <item_source>25</item_source>\r\n';
			shareXML += '   <file_source>25</file_source>\r\n';
			shareXML += '   <file_parent>2</file_parent>\r\n';
			shareXML += '   <file_target>' + fshare[x].path + '</file_target>\r\n';
			shareXML += '   <share_with>' + fshare[x].slave + '</share_with>\r\n';
			shareXML += '   <share_with_displayname>' + fshare[x].slave + '</share_with_displayname>\r\n';
			shareXML += '   <mail_send>0</mail_send>\r\n';
			shareXML += '  </element>\r\n';
		}
		shareXML += ' </data>\r\n';
		shareXML += '</ocs>\r\n';

		//log.info(shareXML)
		return shareXML;
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

function transSearchUsersToJson(users) {
	var ownusers = [];
	for(var x in users) {
		ownusers.push({
			'label': users[x],
			'value': {
				'shareType': 0,
				'shareWith': users[x]
			}
		});
	}

	return {
		'ocs': {
			'meta': {
				'status': 'ok',
				'statuscode': 200,
				'message': null
			},
			'data':{
				'exact': {
					'users': ownusers,
					'groups': [],
					'remotes': []
				},
				'users': [],
				'groups': [],
				'remotes': []
			}
		}
	}
}

var getFileSizeFormat = exports.getFileSizeFormat = function (path) {
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

var uploadFile = exports.uploadFile = function (fpath, content, cellphone, upimg) {
	var fsstol = 1;
	var fsscur = 0;

	var fname = fpath.split('/')
	fname = fname[fname.length-1];

	if(upimg != 'usericon') {
		log.info('PUT ' + fpath);
	}

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

	var datahome = config.get('datapath') + '/' + cellphone;
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

	if(upimg == 'usericon') {
		reqpath = config.get('datapath') + '/' + cellphone + '/user' + fpath.substr(fpath.lastIndexOf('.'));
	}
	//log.info('reqpath: ' + reqpath);

	if(fsscur == 0) {
		if(upimg == 'usericon') {
			var imghead = config.get('datapath') + '/' + cellphone + '/user';
			var imgpng = imghead + '.png';
			var imgjpg = imghead + '.jpg';
			var imgjpeg = imghead + '.jpeg';
			var imggif = imghead + '.gif';

			fs.exists(imgpng) && fs.remove(imgpng);
			fs.exists(imgjpg) && fs.remove(imgjpg);
			fs.exists(imgjpeg) && fs.remove(imgjpeg);
			fs.exists(imggif) && fs.remove(imggif);
		}

		fs.write(reqpath, content);
	}
	else if(fsscur > 0 && fsstol > 1 && fsscur < fsstol) {
		fs.write(reqpath, content, 'a');
	}
}

function encodeURIComponentByFalse(url, flag) {
	if(flag) {
		return url;
	}

	return encodeURIComponent(url);
}

var getShareFilesWithCellphone = exports.getShareFilesWithCellphone = function (cellphone, haveinfos, strictpath) {
	var filesinfo = [];
	var dirsinfo = [];
	var shmain, shbase;

	if(strictpath) {
		var strindex = strictpath.indexOf('/', 1);
		if(strindex < 0) {
			strindex = strictpath.length;
		}
		shmain = strictpath.substr(0, strindex);
		shbase = strictpath.substr(strindex);
	}

	var fileshares = getFileShareWithNum('slave', cellphone);
	for(var x in fileshares) {
		var fullPath = config.get('datapath') + '/' + fileshares[x].master + fileshares[x].path;
		var sloc = fullPath.replace(/\/{2,}/g, "/").split('/');
		var name = sloc.pop();
		if(!name) {
			name = sloc.pop();
		}

		var mastername = getNameFromCellphone(fileshares[x].master) || (fileshares[x].master.substr(0,3) + '****' + fileshares[x].master.substr(-4));

		if (fs.isFile(fullPath)) {
			var finfo = {
				name: name,
				type: '-',
				mime: mime.mimeType(name),
				path: encodeURIComponentByFalse(fileshares[x].path, haveinfos),
				size: getFileSizeFormat(fullPath),
				date: dates.format(fs.lastModified(fullPath), 'E, dd MMM yyyy HH:mm:ss', 'en', 'TMT+8') + ' GMT',
				append: {
					shareid: fileshares[x].id,
					sharefrom: mastername,
					sharemaster: fileshares[x].master
				}
			};

			if(strictpath && shmain == '/' + name) {
				finfo.path = (finfo.path + shbase).replace(/\/{2,}/g, "/");
				return finfo;
			}

			if(haveinfos) {
				finfo.path = config.get('datapath') + '/' + cellphone + '/';
				finfo.size = fs.size(fullPath);
				finfo.url = config.get('ownbaseurl') + '/remote.php/webdav/' + name;
			}

			filesinfo.push(finfo);
		}
		else if (fs.isDirectory(fullPath)) {
			var dinfo = {
				name: name,
				type: 'd',
				path: encodeURIComponentByFalse(fileshares[x].path, haveinfos),
				size: fs.list(fullPath).length,
				date: dates.format(fs.lastModified(fullPath), 'E, dd MMM yyyy HH:mm:ss', 'en', 'TMT+8') + ' GMT',
				append: {
					shareid: fileshares[x].id,
					sharefrom: mastername,
					sharemaster: fileshares[x].master
				}
			}

			if(strictpath && shmain == '/' + name) {
				dinfo.path = (dinfo.path+shbase).replace(/\/{2,}/g, "/");
				return dinfo;
			}

			if(haveinfos) {
				dinfo.path = config.get('datapath') + '/' + cellphone + '/';
				dinfo.url = config.get('ownbaseurl') + '/remote.php/webdav/' + name + '/';
			}

			dirsinfo.push(dinfo);
		}
	}

	if(strictpath) {
		return false;
	}

	if(haveinfos) {
		return haveinfos.concat(dirsinfo.concat(filesinfo));
	}

	return dirsinfo.concat(filesinfo);
}
