var fs = require("fs");
var {Store} = require("ringo-sqlstore");
var base64 = require("ringo/base64");
var strings = require("ringo/utils/strings");
var config = require("../config");

var log = require("ringo/logging").getLogger(module.id);

const MAPPING_GATEWAY = {
	'table': 'oc_gateway',
	'properties':{
		'key': 'string',
		'val': 'string'
	}
};

const MAPPING_USER = {
	'table': 'oc_users',
	'id': {
		'column': 'user_id'
	},
	'properties':{
		'cellphone': {
			'type': 'string',
			'length': '16',
			'nullable': false,
			'unique': true
		},
		'name': 'string',
		'password': 'string',
		'authority': 'string',
		'status': 'string',
		'update_at': 'timestamp'
	}
};

const MAPPING_SHAREFILE = {
	'table': 'oc_sharefiles',
	'id': {
		'column': 'share_id'
	},
	'properties':{
		'path': 'string',
		'master': 'string',
		'slave': 'string'
	}
};


var getUserFromAuthKey = exports.getUserFromAuthKey = function(authorization, withname) {
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

		var queryret = store.query("from User where cellphone='" + credentials[0] + "' and password='" + passcode + "'");
		if(queryret.length > 0) {
			var useret = queryret[0];
			useret.password = credentials[1];
			return useret;
		}

		if(withname) {
			queryret = store.query("from User where name='" + credentials[0] + "' and password='" + passcode + "'");
			if(queryret.length > 0) {
				var useret = queryret[0];
				useret.password = credentials[1];
				return useret;
			}
		}
	}
	else if(config.get('dbsupport') == 'file') {
		var txtStream = fs.open(config.get('database'), 'r');
		var authKey = txtStream.readLine().trim();

		while(authKey) {
			if(authKey.indexOf(authorization) >= 0) {
				return {cellphone:credentials[0], password: credentials[1]};
			}
			authKey = txtStream.readLine().trim();
		}
	}

	return false;
}

var getUsersFromDB = exports.getUsersFromDB = function(cellphone) {
	var connectionPool = module.singleton('connectionPool', function() {
		return Store.initConnectionPool({
			'url': 'jdbc:h2:' + config.get('database'),
			'driver': 'org.h2.Driver'
		});
	});
	var store = new Store(connectionPool);

	var User = store.defineEntity("User", MAPPING_USER);
	store.syncTables();
	
	var querysql = "select cellphone, name from User";
	if(cellphone) {
		querysql += " where cellphone!='" + cellphone + "'";
	}

	return store.query(querysql);
}

var addUserToDB = exports.addUserToDB = function(cellphone, password) {

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

		var queryret = store.query("from User where cellphone='" + cellphone + "' and password='" + passcode + "'");
		if(queryret.length > 0) {
			return false;
		}

		var authority = 'user';
		queryret = store.query("from User where authority='admin'");
		if(queryret.length <= 0) {
			authority = 'admin';
		}

		var transaction = store.beginTransaction();
		var newuser = new User({"cellphone": cellphone, "password": passcode, "authority": authority, "status": 'unblock', 'update_at': (new Date()).valueOf()});
		newuser.save();
		transaction.commit();

		var iconlink = config.get('datapath') + '/' + cellphone + '/user.png';
		fs.copy(module.resolve("../public/img/user.png"), iconlink);

		if(authority == 'admin') {
			return 'admin';
		}
	}
	else if(config.get('dbsupport') == 'file') {
		var authorization = base64.encode(cellphone + ':' + password);

		var inStream = fs.open(config.get('database'), 'r');
		var authKey = inStream.readLine().trim();

		while(authKey) {
			var credentials = base64.decode(authKey).split(':');
			if(cellphone == credentials[0]) {
				return false;
			}

			authKey = inStream.readLine().trim();
		}

		var outStream = fs.open(config.get('database'), 'a');
		outStream.writeLine(authorization);
	}

	return true;
}

var updateUserPass = exports.updateUserPass = function(cellphone, pass, newpass) {

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

		var queryret = store.query("from User where cellphone='" + cellphone + "' and password='" + passcode + "'");
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
			var authKey = base64.encode(cellphone + ':' + pass);
			var newKey = base64.encode(cellphone + ':' + newpass);
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

var updateUserToDB = exports.updateUserToDB = function(cellphone, name) {
	var connectionPool = module.singleton('connectionPool', function() {
		return Store.initConnectionPool({
			'url': 'jdbc:h2:' + config.get('database'),
			'driver': 'org.h2.Driver'
		});
	});
	var store = new Store(connectionPool);

	var User = store.defineEntity("User", MAPPING_USER);
	store.syncTables();

	var queryret = store.query("from User where cellphone='" + cellphone + "'");
	if(queryret.length > 0) {
		var upuser = User.get(queryret[0].id);
		upuser.name = name;
		upuser.save();
		return true;
	}

	return false;
}

var getCellphoneFromName = exports.getCellphoneFromName = function (name) {
	var connectionPool = module.singleton('connectionPool', function() {
		return Store.initConnectionPool({
			'url': 'jdbc:h2:' + config.get('database'),
			'driver': 'org.h2.Driver'
		});
	});

	var store = new Store(connectionPool);

	var User = store.defineEntity("User", MAPPING_USER);
	store.syncTables();

	var queryret = store.query("select cellphone from User where name='" + name + "'");
	if(queryret.length > 0) {
		return queryret[0];
	}

	return '';
}

var getNameFromCellphone = exports.getNameFromCellphone = function (cellphone) {
	var connectionPool = module.singleton('connectionPool', function() {
		return Store.initConnectionPool({
			'url': 'jdbc:h2:' + config.get('database'),
			'driver': 'org.h2.Driver'
		});
	});

	var store = new Store(connectionPool);

	var User = store.defineEntity("User", MAPPING_USER);
	store.syncTables();

	var queryret = store.query("select name from User where cellphone='" + cellphone + "'");
	if(queryret.length > 0) {
		return queryret[0];
	}

	return '';
}

var getSearchUser = exports.getSearchUser = function (searchstr, page, perpage) {
	var connectionPool = module.singleton('connectionPool', function() {
		return Store.initConnectionPool({
			'url': 'jdbc:h2:' + config.get('database'),
			'driver': 'org.h2.Driver'
		});
	});

	var store = new Store(connectionPool);

	var User = store.defineEntity("User", MAPPING_USER);
	store.syncTables();

	var queryret = store.query("select name from User where name like '%" + searchstr + "%'");
	log.info(JSON.stringify(queryret));
	return queryret;
}

var getFileShareFromId = exports.getFileShareFromId = function (id){
	var connectionPool = module.singleton('connectionPool', function() {
		return Store.initConnectionPool({
			'url': 'jdbc:h2:' + config.get('database'),
			'driver': 'org.h2.Driver'
		});
	});
	var store = new Store(connectionPool);

	var Sharefile = store.defineEntity("Sharefile", MAPPING_SHAREFILE);
	store.syncTables();

	var queryret = store.query("from Sharefile where id='" + id + "'");
	return queryret;
}

var delFileShareFromId = exports.delFileShareFromId = function (id){
	var connectionPool = module.singleton('connectionPool', function() {
		return Store.initConnectionPool({
			'url': 'jdbc:h2:' + config.get('database'),
			'driver': 'org.h2.Driver'
		});
	});
	var store = new Store(connectionPool);

	var Sharefile = store.defineEntity("Sharefile", MAPPING_SHAREFILE);
	store.syncTables();

	var getshare = Sharefile.get(id);
	getshare.remove();

	return [];
}

var getFileShareFromPathWithNum = exports.getFileShareFromPathWithNum = function(path, cellphone){
	var connectionPool = module.singleton('connectionPool', function() {
		return Store.initConnectionPool({
			'url': 'jdbc:h2:' + config.get('database'),
			'driver': 'org.h2.Driver'
		});
	});
	var store = new Store(connectionPool);

	var Sharefile = store.defineEntity("Sharefile", MAPPING_SHAREFILE);
	store.syncTables();

	var queryret = store.query("from Sharefile where path like '" + path + "%' and master='" + cellphone + "'");
	return queryret;
}

var getFileShareToUserWithNum = exports.getFileShareToUserWithNum = function (path, shareWith, cellphone) {
	var connectionPool = module.singleton('connectionPool', function() {
		return Store.initConnectionPool({
			'url': 'jdbc:h2:' + config.get('database'),
			'driver': 'org.h2.Driver'
		});
	});
	var store = new Store(connectionPool);

	var Sharefile = store.defineEntity("Sharefile", MAPPING_SHAREFILE);
	store.syncTables();

	return store.query("from Sharefile where path='" + path + "' and master='" + cellphone + "' and slave='" + shareWith + "'");
}

var setFileShareToUserWithNum = exports.setFileShareToUserWithNum = function (path, shareWith, cellphone) {
	var connectionPool = module.singleton('connectionPool', function() {
		return Store.initConnectionPool({
			'url': 'jdbc:h2:' + config.get('database'),
			'driver': 'org.h2.Driver'
		});
	});
	var store = new Store(connectionPool);

	var Sharefile = store.defineEntity("Sharefile", MAPPING_SHAREFILE);
	store.syncTables();

	var queryret = store.query("from Sharefile where path='" + path + "' and master='" + cellphone + "' and slave='" + shareWith + "'");
	if(queryret.length == 0) {
		var transaction = store.beginTransaction();
		var newshare = new Sharefile({path: path, master: cellphone, slave: shareWith});
		newshare.save();
		transaction.commit();
	}

	return store.query("from Sharefile where path='" + path + "' and master='" + cellphone + "' and slave='" + shareWith + "'");
}

var getFileShareWithNum = exports.getFileShareWithNum = function(field, cellphone, path){
	var connectionPool = module.singleton('connectionPool', function() {
		return Store.initConnectionPool({
			'url': 'jdbc:h2:' + config.get('database'),
			'driver': 'org.h2.Driver'
		});
	});
	var store = new Store(connectionPool);

	var Sharefile = store.defineEntity("Sharefile", MAPPING_SHAREFILE);
	store.syncTables();

	var sqlsen = "from Sharefile where " + field + "='" + cellphone + "'";
	if(path) {
		sqlsen += " AND path='" + path + "'";
	}

	return store.query(sqlsen);
}
