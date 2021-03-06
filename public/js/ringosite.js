function getIndexViewRequest(action, data) {
  if(typeof data != 'object') {
    data = {};
  }
  data.opt = 'view';
  data.action = action;

  $.post('/index.html', data, function(data, status) {
    if(status == 'success') {
	  switch(data.action) {
	  case 'all':
		$('.main').html(getAllFilesXML(data.selectMenu.submenu.name, data.selectData));
		$('#filesearch').keydown(fileSearchRequest);
		updateActiveMenuBySelect(data.selectMenu);
		fileUploadSetting(data.selectData.path);
		break;

	case 'myshare':
		$('.main').html(getMyShareXML(data.selectMenu.submenu.name, data.selectData));
		updateActiveMenuBySelect(data.selectMenu);
		break;

	case 'share':
		$('.main').html(getShareXML(data.selectMenu.submenu.name, data.selectData));
		updateActiveMenuBySelect(data.selectMenu);
		break;

	case 'user':
		$('.main').html(getUserInfoXML(data.selectMenu.submenu.name, data.name, data.cellphone));
		updateActiveMenuBySelect(data.selectMenu);
		imageUploadSetting();
		break;

	case 'resetpass':
		$('.main').html(getResetPassXML(data.selectMenu.submenu.name, data.cellphone));
		updateActiveMenuBySelect(data.selectMenu);
		break;

	case 'logout':
		setCookie('authKey', '', -1);
		window.location.reload();
		break;

	default:
		$('.main').html(getDefaultXML(data.selectMenu.submenu.name));
		updateActiveMenuBySelect(data.selectMenu);
		break;
	  }
	}
  })
}

function updateActiveMenuBySelect(selectMenu) {
  $('.menu').removeClass('active');
  $('.submenu').removeClass('active');
  $('.sidemenu').removeClass('active');
  $('.sidemenu').addClass('hidden');
  $('.sd'+selectMenu.action).removeClass('hidden');
  
  $('#me'+selectMenu.action).addClass('active');
  $('#sm'+selectMenu.submenu.action).addClass('active');
  $('#ss'+selectMenu.submenu.action).addClass('active');
}

function fileUploadSetting(path) {
	$('#fileupload').fileupload({
		url: '/index.html',
		type: 'PUT',
		dataType: 'json',
		maxChunkSize: 1048576, // 1MB
		formData: {relpath: path},
		/*add: function (e, data) {
			data.submit();
		},*/
		done: function (e, fdata) {
			$.each(fdata.result.files, function (index, file) {
				//console.log('Uploadfile Done: ' + JSON.stringify(file));
			});
			getIndexViewRequest('all', {path: path});
		},
		progressall: function (e, data) {
			var progress = parseInt(data.loaded / data.total * 100, 10);
			var bitrate = '';
			if(data.bitrate < 1024*8) {
			  bitrate = (data.bitrate/8).toFixed(2) + 'B/s';
			}
			else if(data.bitrate < 1024*1024*8) {
			  bitrate = (data.bitrate/1024/8).toFixed(2) + 'KB/s';
			}
			else if(data.bitrate < 1024*1024*1024*8) {
			  bitrate = (data.bitrate/1024/1024/8).toFixed(2) + 'MB/s';
			}
			else if(data.bitrate < 1024*1024*1024*1024*8) {
			  bitrate = (data.bitrate/1024/1024/1024/8).toFixed(2) + 'G/s';
			}

			if(progress == 100) {
			  $('#progress').addClass('hidden');
			}
			else {
			  $('#progress').removeClass('hidden');
			}

			var barname = $('#progress .barname');
			var barpercent = $('#progress .barpercent');
			var bar = $('#progress .bar');

			var name = '正在上传';
			switch(barname.attr('index')) {
			case '1':
				name += '.&nbsp;&nbsp;&nbsp;&nbsp;';
				barname.attr('index', '2');
				break;

			case '2':
				name += '..&nbsp;&nbsp;&nbsp;';
				barname.attr('index', '3');
				break;

			case '3':
				name += '...&nbsp;&nbsp;';
				barname.attr('index', '0');
				break;

			default:
				name += '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
				barname.attr('index', '1');
				break;
			}

			barname.html(name + bitrate);
			barpercent.text(progress + '%');
			bar.css('width', progress + '%');
		}
	})
	.on('fileuploadchunksend', function (e, data) {
		var chunktotal = Math.ceil(data.total/data.maxChunkSize);
		var chunknum = Math.floor(parseInt(data.contentRange.split('-')[0].substr(6))/data.maxChunkSize);

		data.headers['Content-Disposition'] = 'attachment; filename="' + data.files[0].name + '-chunking-' + chunktotal + '-' + chunknum + '"';
	});
}

function imageUploadSetting() {
	$('#imgupload').fileupload({
		url: '/index.html',
		type: 'PUT',
		dataType: 'json',
		acceptFileTypes: /(\.|\/)(gif|jpe?g|png)$/i,
		maxFileSize: 5 * 1024 * 1024,
		minFileSize: 512,
		maxChunkSize: 1048576, // 1MB
		formData: {upimg: 'usericon'},
		done: function (e, fdata) {
			$('.logimg').attr('src', '/usericon?'+Math.random());
		}
	})
	.on('fileuploadchunksend', function (e, data) {
		var chunktotal = Math.ceil(data.total/data.maxChunkSize);
		var chunknum = Math.floor(parseInt(data.contentRange.split('-')[0].substr(6))/data.maxChunkSize);

		data.headers['Content-Disposition'] = 'attachment; filename="' + data.files[0].name + '-chunking-' + chunktotal + '-' + chunknum + '"';
	});
}

function getAllFilesXML(title, selectData) {
  var locallist = selectData.locallist;
  var files = selectData.files;

  var filesXml = '<h2>' + title + '</h2><hr>'
	+ '<div><button class="btn btn-info btn-sm" onclick="uploadFileDialog();"><span class="glyphicon glyphicon-cloud-upload"></span>上传</button>'
	+ '<input id="fileupload" name="files[]" type="file" multiple style="display: none;">'
	+ '<button class="btn btn-default btn-sm" onclick="createNewFolder(\'/index.html\', \'' + selectData.path + '\');"><span class="glyphicon glyphicon-folder-open" style="color: #aa6;"></span> 新建文件夹</button>'
    + '<button class="btn btn-default btn-sm btnopt hidden" onclick="checkMoveToOpt()" style="margin-left: 15px;">移动</button>'
	+ '<button class="btn btn-default btn-sm btnopt hidden" onclick="checkCopyToOpt()">复制</button>'
	+ '<button class="btn btn-default btn-sm btnopt hidden" onclick="checkDelToOpt()">删除</button>'
	+ '<div class="form-group has-feedback" style="width: 150px; float: right;">';
	if(selectData.searstr) {
      filesXml += '<input id="filesearch" type="text" class="form-control input-sm" curpath="' + selectData.path + '" value="' + selectData.searstr + '">';
	}
	else {
	  filesXml += '<input id="filesearch" type="text" class="form-control input-sm" curpath="' + selectData.path + '">';
	}
      filesXml += '<span class="glyphicon glyphicon-search form-control-feedback" aria-hidden="true"></span>'
    + '</div>'
  + '</div>'
  + '<div id="progress" class="hidden" style="float: left;">'
    + '<div style="margin: 10px 0; border-radius: 4px; width: 500px; background: #c3c3c3">'
      + '<div class="barname" style="float: left;  color: white;"></div>'
	  + '<div class="barpercent" style="margin-right: 10px; float: right;  color: white;">0%</div>'
      + '<div class="bar" style="width: 0%; height: 20px; background: #338833;"></div>'
    + '</div>'
  + '</div>'
  + '<br><br>';

  if (selectData.lastlink) {
    filesXml += '<a href="javascript:getIndexViewRequest(\'all\', {path: \'' + selectData.lastlink.link + '\'})">返回上一级</a><span> | </span>';
  }

  filesXml += '<span>位置：</span>';

  for (x in locallist) {
    if (x < locallist.length-1) {
	  filesXml += '<a href="javascript:getIndexViewRequest(\'all\', {path: \'' + locallist[x].link + '\'})">' + locallist[x].path + '</a>';
	}
	else {
	  filesXml += '<span>' + locallist[x].path + '</span>';
	}

	if(locallist[x].type == 'd') {
	  filesXml += '/';
	}
  }

  filesXml += 
    '<div><table class="table table-hover" style="min-width: 460px;">'
    + '<thead>'
    + '<tr>'
    + '<th style="width: 40px;"><input id="checkall" type="checkbox" onclick="checkAll(\'checkall\')"></th>'
    + '<th>文件名</th>'
	+ '<th style="width: 80px;"></th>'
    + '<th style="text-align: center; width: 80px;">大小</th>'
    + '<th style="text-align: center; width: 180px;">修改日期</th>'
    + '</tr>'
    + '</thead>'
  + '<tbody id="gwtbody">';

  for (x in files) {
    filesXml += 
      '<tr id="tr' + files[x].index + '">'
      + '<td><input type="checkbox" onclick="trcheck()" fpath="' + files[x].path + '"></td>'
	  + '<td class="tdname">'
	    + '<a href="javascript:getIndexViewRequest(\'all\', {path: \'' + files[x].path + '\'})">';

	if (files[x].type == '-') {
	  filesXml += '<span class="glyphicon glyphicon-file" style="color: #a8a8a8;"> </span>';
	} else {
	  filesXml += '<span class="glyphicon glyphicon-folder-close" style="color: #dfdf00;"> </span>';
	}

	filesXml += files[x].name + '</a>'
	  + '</td>'
	  + '<td>'
	  + '<div class="ringo-moreopt-nav">'
	    + '<a href="javascript:shareToOpt([\'' + files[x].path + '\']);"><span title="分享" class="glyphicon glyphicon-share" style="margin: 0 2px;"></span></a>'
	    + '<a ';

		if (files[x].type == '-') {
			filesXml += 'href="javascript:downloadToOpt([\'' + files[x].path + '\'])"'
		} else {
			filesXml += 'href="javascript:void(0)"';
		}

		filesXml += ' class="downlink">'
		  + '<span title="下载" class="glyphicon glyphicon-download-alt" style="margin: 0 2px;"></span>'
		+ '</a>'
		+ '<div class="dropdown" style="margin: 0 2px; float: right;">'
          + '<a href="javascript: void(0);"  id="dropdownmoreopt" class="dropdown-toggle" data-toggle="dropdown">'
		    + '<span title="更多" class="glyphicon glyphicon-option-horizontal"></span>'
		  + '</a>'
          + '<ul class="dropdown-menu" aria-labelledby="dropdownmoreopt">'
	        + '<li><a href="javascript:moveToOpt([\'' + files[x].path + '\']);" class="mvlink">移动</a></li>'
			+ '<li><a href="javascript:copyToOpt([\'' + files[x].path + '\']);" class="cplink">复制</a></li>'
			+ '<li><a href="javascript:renameOpt(\'tr' + files[x].index + '\', \'' + selectData.path + '\');">重命名</a></li>'
			+ '<li><a href="javascript:removeFile(\'/index.html\', \'' + files[x].path + '\');" class="rmlink">删除</a></li>'
	      + '</ul>'
		+ '</div>'
	  + '</div>'
	  + '</td>';

	if (files[x].type == '-') {
	  filesXml += '<td style="font-family: times; text-align: center;">' + files[x].size + '</td>';
	} else {
	  filesXml += '<td style="text-align: center;">-</td>';
	}

	filesXml += '<td style="text-align: center; font-family: times;">';
	if(files[x].date) {
	  filesXml += files[x].date;
	}
	filesXml += '</td></tr>';
  }

  filesXml += '</tbody></table></div>'
    + '<div id="queryfolderModal" class="modal" role="dialog">'
      + '<div class="modal-dialog">'
        + '<div class="modal-content">'
          + '<div class="modal-header"><a class="close" data-dismiss="modal">×</a><h4>标题</h4></div>'
          + '<div class="modal-body">'
		    + '<div id="macor" class="accordion">'
		      + '<div class="accordion-group">'
		        + '<div class="accordion-heading">'
			      + '<a href="javascript:getFoldersListByPath(\'/index.html\', \'/\', \'macor\', neutralOpt)" style="text-decoration: none;">'
			        + '<span class="glyphicon glyphicon-folder-close" style="color: #dfdf00;"></span> 全部文件'
			      + '</a>'
			    + '</div>'
		      + '</div>'
		    + '</div>'
          + '</div>'
          + '<div class="modal-footer">'
	        + '<button type="button" class="btn btn-info" onclick="filesToQueryFolder(\'/index.html\');" data-dismiss="modal">确定</button>'
            + '<button type="button" class="btn btn-default" data-dismiss="modal">取消</button>'
          + '</div>'
        + '</div>'
      + '</div>'
      + '<input id="queryaction"  type="hidden">'
      + '<input id="querysrcarr"  type="hidden">'
      + '<input id="querysource"  type="hidden" value="' + selectData.path + '">'
      + '<input id="querytarget"  type="hidden">'
    + '</div>'
	+ '<div id="shareModal" class="modal" role="dialog">'
      + '<div class="modal-dialog">'
        + '<div class="modal-content">'
          + '<div class="modal-header"><a class="close" data-dismiss="modal">×</a><h4>分享</h4></div>'
          + '<div class="modal-body">'
		    + '<div class="row">'
			  + '<div class="col-xs-6 col-sm-6">'
			    + '<h5>用户：</h5>'
			    + '<select id="selpub" multiple class="form-control" onclick="javascript:addShareUser()">'
				+ '</select>'
			  + '</div>'
			  + '<div class="col-xs-6 col-sm-6">'
			    + '<h5>选中：</h5>'
			    + '<select id="selsha" multiple class="form-control" onclick="javascript:rmShareUser()">'
				+ '</select>'
			  + '</div>'
			+ '</div>'
          + '</div>'
          + '<div class="modal-footer">'
	        + '<button id="shareok" type="button" class="btn btn-info" data-dismiss="modal">确定</button>'
            + '<button id="sharecancle" type="button" class="btn btn-default" data-dismiss="modal">取消</button>'
          + '</div>'
        + '</div>'
      + '</div>'
    + '</div>';

  return filesXml;
}

function getMyShareXML(title, selectData) {
  var files = selectData.files;

  var filesXml = '<h2>' + title + '</h2><hr>';
  if (selectData.lastlink) {
    filesXml += '<a href="javascript:getIndexViewRequest(\'myshare\', {path: \'' + selectData.lastlink.link + '\'})">返回上一级</a>';
  }
  else {
	filesXml += '<div style="height: 20px;"></div>';
  }

  filesXml += 
    '<div><table class="table table-hover" style="min-width: 460px;">'
    + '<thead>'
    + '<tr>'
    + '<th style="width: 40px;"><input id="checkall" type="checkbox" onclick="checkAll(\'checkall\')"></th>'
    + '<th>文件名</th>'
	+ '<th style="width: 80px;"></th>'
    + '<th style="text-align: center; width: 80px;">大小</th>'
    + '<th style="text-align: center; width: 180px;">';
	if(selectData.path == '/') {
		filesXml += '分享给';
	}

	filesXml += '</th>'
    + '</tr>'
    + '</thead>'
  + '<tbody id="gwtbody">';

  for (x in files) {
    filesXml += 
      '<tr id="tr' + files[x].index + '">'
      + '<td><input type="checkbox" onclick="trcheck()" fpath="' + files[x].path + '"></td>'
	  + '<td class="tdname">'
	    + '<a title="' + decodeURIComponent(files[x].path) + '" href="javascript:getIndexViewRequest(\'myshare\', {path: \'' + files[x].path + '\'})">';

	if (files[x].type == '-') {
	  filesXml += '<span class="glyphicon glyphicon-file" style="color: #a8a8a8;"> </span>';
	} else {
	  filesXml += '<span class="glyphicon glyphicon-folder-close" style="color: #dfdf00;"> </span>';
	}

	filesXml += files[x].name + '</a>'
	  + '</td>'
	  + '<td>'
	  + '<div class="ringo-moreopt-nav">';
		if(selectData.path == '/') {
			filesXml += '<a href="javascript:CancleSharedWithId(\'' + files[x].append.shareid + '\', \'myshare\')"><span title="取消分享" class="glyphicon glyphicon-remove" style="margin: 0 2px;"></span></a>';
		}

	    filesXml += '<a ';

		if (files[x].type == '-') {
			filesXml += 'href="javascript:downloadToOpt([\'' + files[x].path + '\'])"'
		} else {
			filesXml += 'href="javascript:void(0)"';
		}

		filesXml += ' class="downlink">'
		  + '<span title="下载" class="glyphicon glyphicon-download-alt" style="margin: 0 2px;"></span>'
		+ '</a>'
	  + '</div>'
	  + '</td>';

	if (files[x].type == '-') {
	  filesXml += '<td style="font-family: times; text-align: center;">' + files[x].size + '</td>';
	} else {
	  filesXml += '<td style="text-align: center;">-</td>';
	}

	filesXml += '<td style="text-align: center; font-family: times;">';
	if(files[x].append && files[x].append.sharewith) {
	  filesXml += files[x].append.sharewith;
	}
	filesXml += '</td></tr>';
  }

  filesXml += '</tbody></table></div>';
  return filesXml;
}

function getShareXML(title, selectData) {
  var files = selectData.files;

  var filesXml = '<h2>' + title + '</h2><hr>';

  if (selectData.lastlink) {
    filesXml += '<a href="javascript:getIndexViewRequest(\'share\', {path: \'' + selectData.lastlink.link + '\', master: \'' + selectData.sharemaster + '\'})">返回上一级</a>';
  }
  else {
	filesXml += '<div style="height: 20px;"></div>';
  }

  filesXml += 
    '<div><table class="table table-hover" style="min-width: 460px;">'
    + '<thead>'
    + '<tr>'
    + '<th style="width: 40px;"><input id="checkall" type="checkbox" onclick="checkAll(\'checkall\')"></th>'
    + '<th>文件名</th>'
	+ '<th style="width: 80px;"></th>'
    + '<th style="text-align: center; width: 80px;">大小</th>'
    + '<th style="text-align: center; width: 180px;">来自于</th>'
    + '</tr>'
    + '</thead>'
  + '<tbody id="gwtbody">';

  for (x in files) {
    filesXml += 
      '<tr id="tr' + files[x].index + '">'
      + '<td><input type="checkbox" onclick="trcheck()" fpath="' + files[x].path + '"></td>'
	  + '<td class="tdname">'
	    + '<a title="' + decodeURIComponent(files[x].path) + '" href="javascript:getIndexViewRequest(\'share\', {path: \'' + files[x].path + '\', master: \'' + files[x].append.sharemaster + '\'})">';

	if (files[x].type == '-') {
	  filesXml += '<span class="glyphicon glyphicon-file" style="color: #a8a8a8;"> </span>';
	} else {
	  filesXml += '<span class="glyphicon glyphicon-folder-close" style="color: #dfdf00;"> </span>';
	}

	filesXml += files[x].name + '</a>'
	  + '</td>'
	  + '<td>'
	  + '<div class="ringo-moreopt-nav">';
	    if(typeof files[x].append.shareid != 'undefined') {
	      filesXml += '<a href="javascript:CancleSharedWithId(\'' + files[x].append.shareid + '\', \'share\')"><span title="取消分享" class="glyphicon glyphicon-remove" style="margin: 0 2px;"></span></a>';
		}
		filesXml += '<a href="javascript:copyToOpt([\'' + files[x].path + '\'], \'' + files[x].append.sharemaster + '\');"><span title="复制到" class="glyphicon glyphicon-share-alt" style="margin: 0 2px;"></span></a>'
	    + '<a ';

		if (files[x].type == '-') {
			filesXml += 'href="javascript:downloadToOpt([\'' + files[x].path + '\'], \'' + files[x].append.sharemaster + '\')"'
		} else {
			filesXml += 'href="javascript:void(0)"';
		}

		filesXml += ' class="downlink">'
		  + '<span title="下载" class="glyphicon glyphicon-download-alt" style="margin: 0 2px;"></span>'
		+ '</a>'
	  + '</div>'
	  + '</td>';

	if (files[x].type == '-') {
	  filesXml += '<td style="font-family: times; text-align: center;">' + files[x].size + '</td>';
	} else {
	  filesXml += '<td style="text-align: center;">-</td>';
	}

	filesXml += '<td style="text-align: center; font-family: times;">';
	if(files[x].append.sharefrom) {
	  filesXml += files[x].append.sharefrom;
	}
	filesXml += '</td></tr>';
  }

  filesXml += '</tbody></table></div>'
    + '<div id="queryfolderModal" class="modal" role="dialog">'
      + '<div class="modal-dialog">'
        + '<div class="modal-content">'
          + '<div class="modal-header"><a class="close" data-dismiss="modal">×</a><h4>标题</h4></div>'
          + '<div class="modal-body">'
		    + '<div id="macor" class="accordion">'
		      + '<div class="accordion-group">'
		        + '<div class="accordion-heading">'
			      + '<a href="javascript:getFoldersListByPath(\'/index.html\', \'/\', \'macor\', neutralOpt)" style="text-decoration: none;">'
			        + '<span class="glyphicon glyphicon-folder-close" style="color: #dfdf00;"></span> 全部文件'
			      + '</a>'
			    + '</div>'
		      + '</div>'
		    + '</div>'
          + '</div>'
          + '<div class="modal-footer">'
	        + '<button type="button" class="btn btn-info" onclick="filesToQueryFolder(\'/index.html\', \'share\');" data-dismiss="modal">确定</button>'
            + '<button type="button" class="btn btn-default" data-dismiss="modal">取消</button>'
          + '</div>'
        + '</div>'
      + '</div>'
      + '<input id="queryaction"  type="hidden">'
      + '<input id="querysrcarr"  type="hidden">'
      + '<input id="querysource"  type="hidden" value="' + selectData.path + '">'
      + '<input id="querytarget"  type="hidden">'
	  + '<input id="querymaster"  type="hidden">'
    + '</div>';

  return filesXml;
}

function getResetPassXML(title, cellphone) {
  var resetXml = '<h2>' + title + '</h2><hr>';

  resetXml += '<div style="padding: 5px 20%">'
    + '<div><div style="height: 30px;"><p id="resetpasssuccess" class="hidden">'
	  + '<span class="glyphicon glyphicon-ok-sign" style="font-size: 15px; color: #0a0;"></span>'
	  + '<span>密码修改成功</span>'
	+ '</p>'
	+ '<p id="resetpassfail" class="hidden">'
	  + '<span class="glyphicon glyphicon-exclamation-sign" style="font-size: 15px; color: #a00;"></span>'
	  + '<span>密码修改失败</span>'
	+ '</p></div>'
	  + '<input id="cellphone" type="hidden" name="cellphone" value="' + cellphone + '">'
      + '<div class="form-group has-feedback">'
        + '<input id="password" type="password" class="form-control" placeholder="Password" name="password">'
        + '<span class="glyphicon glyphicon-lock form-control-feedback"></span>'
      + '</div>'
	  + '<div class="form-group has-feedback">'
        + '<input id="newpassword" type="password" class="form-control" placeholder="New Password" name="newpassword">'
        + '<span class="glyphicon glyphicon-lock form-control-feedback"></span>'
      + '</div>'
      + '<div class="form-group has-feedback">'
	    + '<button class="btn btn-primary btn-block btn-flat" onclick="javascript:ResetPassRequest(\'index.html\')">Reset</button>'
      + '</div></div>';

  return resetXml;
}

function getUserInfoXML(title, name, cellphone) {
  if(!name) {
    name = '';
  }

  var resetXml = '<h2>' + title + '</h2><hr>';

  resetXml += '<div><img class="logimg" src="/usericon" style="width: 120px; height: 120px; border-radius: 8px;"><button onclick="javascript:uploadFileDialog()" class="btn btn-link">更改头像</button><input id="imgupload" name="files[]" type="file" accept="image/gif, image/jpeg, image/png" multiple style="display: none;"><br><div id="unedt"><div style="border: 1px; padding: 9px 12px; width: 120px; float: left; text-align: center;">昵称：' + name + '</div><button onclick="javascript:setUserName(\'' + name + '\')" class="btn btn-link" style="float: left;">修改</button></div><br><br><br><div style="margin-left: -24px; width: 160px; text-align: center;">手机：' + cellphone + '</div></div>';

  return resetXml;
}

function getDefaultXML(title) {
  var defaultXml = '<h2>' + title + '</h2><hr>';
  return defaultXml;
}

function setUserName(name) {
  $('#unedt').html('<div style="border: 1px; padding: 6px 12px; float: left;">昵称：<input id="nameval" type="text" value="' + name + '" onblur="javascript:setUserNameReq()" style="width: 80px;"></div>');
  $('#nameval').focus();
}

function setUserNameReq() {
  var name = $('#nameval').val();

  $('#unedt').html('<div style="border: 1px; padding: 9px 12px; width: 120px; float: left; text-align: center;">昵称：' + name + '</div><button onclick="javascript:setUserName(\'' + name + '\')" class="btn btn-link" style="float: left;">修改</button>');

  $.post('/index.html', {opt: 'renameuser', name: name}, function (data, status) {
	  if(status == 'success') {
		  $('#logname').text(name);
	  }
  });
}

function createNewFolder(url, path) {
  $.post(url, {opt: 'newfolder', path: path}, function(data, status) {
    if(status == 'success') {
	  $('tbody').prepend('<tr id="tr' + $('#gwtbody').children().length + '"><td><input type="checkbox" onclick="trcheck()" fpath="' + path + '/' + data.folder + '"></td>'
		+ '<td class="tdname"><span class="glyphicon glyphicon-folder-close" style="color: #dfdf00;"></span>'
		+ '<input id="nfinput" type="text" value="' + data.folder + '" onblur="renameNewFolder(\'' + url + '\', \'' + path + '\', \'nfinput\')"  name="' + data.folder + '" /></td>'
		+ '<td><div class="ringo-moreopt-nav">'
	    + '<a><span title="分享" class="glyphicon glyphicon-share" style="margin: 0 2px;"></span></a>'
	    + '<a href="javascript:downloadToOpt([\'' + path + '/' + data.folder + '\']);">'
		+ '<span title="下载" class="glyphicon glyphicon-download-alt" style="margin: 0 2px;"></span></a>'
		+ '<div class="dropdown" style="margin: 0 2px; float: right;">'
        + '<a href="javascript: void(0);"  id="dropdownmoreopt" class="dropdown-toggle" data-toggle="dropdown"><span title="更多" class="glyphicon glyphicon-option-horizontal"></span></a>'
        + '<ul class="dropdown-menu" aria-labelledby="dropdownmoreopt">'
	    + '<li><a href="javascript:moveToOpt([\'' + path + '/' + data.folder + '\']);" class="mvlink">移动</a></li>'
		+ '<li><a href="javascript:copyToOpt([\'' + path + '/' + data.folder + '\']);" class="cplink">复制</a></li>'
		+ '<li><a href="javascript:renameOpt(\'tr' + $('#gwtbody').children().length + '\', \'' + path + '\');">重命名</a></li>'
		+ '<li><a href="javascript:removeFile(\'/index.html\', \'' + path + '/' + data.folder + '\');" class="rmlink">删除</a></li>'
	    + '</ul></div></div></td>'
		+ '<td style="text-align: center;">-</td>'
		+ '<td style="text-align: center; font-family: times;">' + data.date + '</td></tr>');

	  $('#nfinput').focus();
	}
	else {
	  alert("新建文件夹失败！");
	}
  });
}

function renameNewFolder(url, path, inputId) {
  var file = $('#'+inputId).attr('name');
  var newfile = $('#'+inputId).val();

  $.post(url, {opt: 'renamefile', path: path, file: file, newfile: newfile}, function(data, status) {
    var filename = file;
    if(status == 'success') {
	  filename = newfile;
	}
	else if(status == 'notmodified') {
	}
	else {
	  console.log(file + " 重命名失败！");
	}

	var filelink = encodeURIComponent((path + '/' + filename).replace(/\/{2,}/g, "/"))

	$('#'+inputId).parent().parent().find('input[type="checkbox"]').attr('fpath', filelink);
	$('#'+inputId).parent().parent().find('.downlink').attr('href', 'javascript:downloadToOpt([\'' + filelink + '\']);');
	$('#'+inputId).parent().parent().find('.mvlink').attr('href', 'javascript:moveToOpt([\'' + filelink + '\']);');
	$('#'+inputId).parent().parent().find('.cplink').attr('href', 'javascript:copyToOpt([\'' + filelink + '\']);');
	$('#'+inputId).parent().parent().find('.rmlink').attr('href', 'javascript:removeFile(\'/index.html\', \'' + filelink + '\');');
	$('#'+inputId).parent().html('<a href="javascript:getIndexViewRequest(\'all\', {path: \'' + filelink + '\'})"><span class="glyphicon glyphicon-folder-close" style="color: #dfdf00;"></span> ' + filename + '</a>');
  });
}

function checkAll(id) {
  if($('#'+id).prop('checked')) {
    $('td input[type="checkbox"]').prop('checked', true);
  }
  else {
	$('td input[type="checkbox"]').prop('checked', false);
  }

  trcheck();
}

function trcheck() {
  var hascheck = false;
  var allcheck = true;

  $('#gwtbody td input[type="checkbox"]').each(function() {
    if($(this).prop('checked')) {
	  hascheck = true;
	}
	else {
	  allcheck = false;
	}
  });

  if(hascheck) {
    $('.btnopt').removeClass('hidden');
  }
  else {
    $('.btnopt').addClass('hidden');
	$('#checkall').prop('checked', false);
  }

  if(allcheck) {
    $('#checkall').prop('checked', true);
  }
}

function checkMoveToOpt() {
  moveToOpt(getCheckPath());
}

function checkCopyToOpt() {
  copyToOpt(getCheckPath());
}

function checkDelToOpt() {
  removeFile('/index.html', getCheckPath());
}

function getCheckPath() {
  var filearr = [];
  $('#gwtbody td input[type="checkbox"]').each(function() {
    if($(this).prop('checked')) {
	  filearr.push($(this).attr('fpath'));
	}
  });

  return filearr;
}

function addShareUser() {
	var si = $('#selpub').get(0).selectedIndex;
	$('#selsha').get(0).selectedIndex = -1;
	$('#selpub option:eq(' + si + ')').addClass('hidden');
	$('#selsha option:eq(' + si + ')').removeClass('hidden');
}

function rmShareUser() {
	var si = $('#selsha').get(0).selectedIndex;
	$('#selpub').get(0).selectedIndex = -1;
	$('#selsha option:eq(' + si + ')').addClass('hidden');
	$('#selpub option:eq(' + si + ')').removeClass('hidden');
}

function shareToOpt(srcarr) {
	var srcstr = '';	
	for(var x in srcarr) {
		var denames = decodeURIComponent(srcarr[x]).split('/');
		var curname = denames.pop();
		if(!curname) {
			curname = denames.pop();
		}
		srcstr += '<span title="' + srcarr[x] + '"> ' + curname + '</span>';
	}

	$('#shareModal .modal-header').html('<h4>分享' + srcstr + '</h4>');
	$('#shareok').attr('onclick', 'javascript:setFileShareReq(' + JSON.stringify(srcarr) + ')');
	$('#selsha').html('');
	$('#selpub').html('');

	$.post('/index.html', {opt: 'getusers', srcarr: srcarr}, function(data, status) {
		if(status == 'success') {
			var users = data.users;
			for(var x in users) {
				if(users[x].selected) {
					$('#selpub').append('<option class="hidden">' + users[x].name + '</option>');
					$('#selsha').append('<option shareid="' + users[x].shareid + '">' + users[x].name + '</option>');
				}
				else {
					$('#selpub').append('<option>' + users[x].name + '</option>');
					$('#selsha').append('<option class="hidden" optnum="' + users[x].cellphone + '">' + users[x].name + '</option>');
				}
			}
			$('#shareModal').modal('show');
		}
	});
}

function setFileShareReq(files) {
	var shareids = [];
	var optnums = [];
	$('#selsha option:visible').each(function() {
		var optnum = $(this).attr('optnum');
		if(optnum) {
			optnums.push(optnum);
		}
	});

	$('#selsha option:hidden').each(function() {
		var shareid = $(this).attr('shareid');
		if(shareid) {
			shareids.push(shareid);
		}
	});

	$.post('/index.html', {
		opt: 'sharefile',
		files: files,
		shareids: shareids,
		optnums: optnums
	  }, function(data, status) {
	})
}

function downloadToOpt(srcarr, master) {
  var save_link = window.document.createElementNS("http://www.w3.org/1999/xhtml", "a")
  var event = new MouseEvent("click");

  for(var x in srcarr) {
    var path = decodeURIComponent(srcarr[x]);
	var fname = path.split('/').pop();

    save_link.href = '/owncloud/remote.php/webdav' + path;
	if(master) {
		save_link.href += '?master=' + master;
	}
    save_link.download = fname;
    save_link.dispatchEvent(event);
  }
}

function moveToOpt(srcarr) {
  getFoldersListByPath('/index.html', '/', 'macor', function(toggle, path, id, folders){
    selectFolderPath(toggle, path, id, folders, 'mv', srcarr);
  }, true);
}

function copyToOpt(srcarr, master) {
  getFoldersListByPath('/index.html', '/', 'macor', function(toggle, path, id, folders){
    selectFolderPath(toggle, path, id, folders, 'cp', srcarr, master);
  }, true);
}

function neutralOpt(toggle, path, id, folders){
  selectFolderPath(toggle, path, id, folders, 'neu');
}

function selectFolderPath(toggle, path, id, folders, action, srcarr, master) {
  if(action == 'mv') {
    $('#queryfolderModal .modal-header h4').text('移动到 ' + path);
	$('#queryaction').val('movefile');
	$('#querysrcarr').val(JSON.stringify(srcarr));
	$('#querytarget').val(path);
    $('#queryfolderModal').modal('show');
  }
  else if(action == 'cp') {
    $('#queryfolderModal .modal-header h4').text('复制到 ' + path);
	$('#queryaction').val('copyfile');
	$('#querysrcarr').val(JSON.stringify(srcarr));
	$('#querytarget').val(path);
	if(master) {
		$('#querymaster').val(master);
	}
    $('#queryfolderModal').modal('show');
  }
  else if(action == 'neu') {
    if($('#queryaction').val() == 'movefile') {
	  $('#queryfolderModal .modal-header h4').text('移动到 ' + path);
	}
	else if($('#queryaction').val() == 'copyfile') {
	  $('#queryfolderModal .modal-header h4').text('复制到 ' + path);
	}
	$('#querytarget').val(path);
  }

  if(!toggle) {
    appendFoldersList(id, path, folders);
  }
}

function appendFoldersList(id, path, folders) {
  var gralen = path.split('/').length;
  if(path == '/') {
    gralen = 1;
  }

  var y = 0;
  var grapre = '';
  while(y++ < gralen) {
    grapre += '&nbsp&nbsp&nbsp&nbsp';
  }

  grapre += '|--';

  $('#'+id+' .accordion-group').html($('#'+id+' .accordion-group').children().get(0));
  $('#'+id+' .accordion-group').append(
	'<div class="accordion-body collapse in"><div class="accordion-inner"></div></div>'
  );

  for(var x in folders) {
    var linkpath = (path + '/' + folders[x]).replace(/\/{2,}/g, '/');
	var linkid = linkpath.replace(/[\/\(\)]/g, '-');

    $('#'+id+' .accordion-body .accordion-inner').append(
	  '<div id="' + linkid + '" class="accordion"><div class="accordion-group"><div class="accordion-heading">'
	  + '<a href="javascript:getFoldersListByPath(\'/index.html\', \'' + linkpath + '\', \'' + linkid + '\', neutralOpt)" style="text-decoration: none;">' + grapre + ' <span class="glyphicon glyphicon-folder-close" style="color: #dfdf00;"></span> ' + folders[x]+ '</a>'
	  + '</div></div></div>'
	);
  }
}

function removeFile(url, path) {
  $.post(url, {opt: 'removefile', path: path}, function(data, status) {
    if(status == 'success') {
	  $('.main').html(getAllFilesXML(data.selectMenu.submenu.name, data.selectData));
	  $('#filesearch').keydown(fileSearchRequest);
	  updateActiveMenuBySelect(data.selectMenu);
	  fileUploadSetting(data.selectData.path);
	}
	else {
	  alert('文件删除失败！');
	}
  });
}

function renameOpt(id, path) {
  var filename = $('#'+id).find('.tdname').text().trim();
  $('#'+id+' .tdname').html('<input id="nfinput" type="text" value="' + filename + '" onblur="renameNewFolder(\'/index.html\', \'' + path + '\', \'nfinput\')"  name="' + filename + '" />');
  $('#nfinput').focus();
}

function getFoldersListByPath(url, path, id, callback, untoggle) {
  if($('#'+id+' .accordion-body').length > 0 && !untoggle) {
    $('#'+id+' .collapse').collapse('toggle');
	callback(true, path);
  }
  else {
    $.post(url, {opt: 'getfolders', path: path}, function(data, status) {
      if(status == 'success' && typeof callback == 'function') {
	    callback(false, path, id, data.folders);
	  }
    });
  }
}

function filesToQueryFolder(url, reaction) {
  var postData = {
    opt: $('#queryaction').val(),
	srcarr: $('#querysrcarr').val(),
	location: $('#querysource').val(),
	target: $('#querytarget').val()
  };

  if($('#querymaster').val()) {
	postData.master = $('#querymaster').val();
  }

  if(reaction) {
	  postData.reaction = reaction;
  }

  $.post(url, postData, function(data, status) {
	  if(status == 'success') {
		if(reaction == 'share') {
		  $('.main').html(getShareXML(data.selectMenu.submenu.name, data.selectData));
		  updateActiveMenuBySelect(data.selectMenu);
		}
		else {
		  $('.main').html(getAllFilesXML(data.selectMenu.submenu.name, data.selectData));
		  $('#filesearch').keydown(fileSearchRequest);
	      updateActiveMenuBySelect(data.selectMenu);
		  fileUploadSetting(data.selectData.path);
		}
	  }
	}
  );
}

function uploadFileDialog() {
  $('input[type="file"]').click();
}

function CancleSharedWithId(id, reaction) {
	$.post('/index.html', {opt: 'cancleshare', id: id, reaction: reaction}, function (data, status){
		if(status == 'success') {
			$('.main').html(getMyShareXML(data.selectMenu.submenu.name, data.selectData));
			updateActiveMenuBySelect(data.selectMenu);
		}
	});
}

function ResetPassRequest(url) {
	if($('#password').val().trim() == '' || $('#newpassword').val().trim() == '') {
		return;
	}

	$.post(url, {
		opt: 'resetpass',
		cellphone: $('#cellphone').val(),
		password: $('#password').val(),
		newpassword: $('#newpassword').val()
	  },
	  function(data, status) {
		if(status == 'success') {
			if(data.status == 'success') {
				$('#resetpasssuccess').removeClass('hidden');
				$('#resetpassfail').addClass('hidden');
				setCookie('authKey', data.authKey);
			}
			else if(data.status == 'fail') {
				$('#resetpassfail').removeClass('hidden');
				$('#resetpasssuccess').addClass('hidden');
			}

			$('#password').val('');
			$('#newpassword').val('');
		}
	  });
}

function fileSearchRequest(e)
{
  if(e.which == 13)
  {
    $.post('/index.html',
	  {
	    opt: 'filesearch',
		path: $('#filesearch').attr('curpath'),
		val: $('#filesearch').val()
	  },
	  function(data, status) {
        $('.main').html(getAllFilesXML(data.selectMenu.submenu.name, data.selectData));
        $('#filesearch').keydown(fileSearchRequest);
        updateActiveMenuBySelect(data.selectMenu);
        fileUploadSetting(data.selectData.path);
    });
  }
}

function setCookie(c_name, value, expiredays) {
  var exdate = new Date();
  exdate.setDate(exdate.getDate() + expiredays);
  document.cookie = c_name + "=" + value
	+ ((expiredays==null) ? "" : ";expires=" + exdate.toGMTString());
}

function getCookie(cname) {
  var name = cname + "=";
  var ca = document.cookie.split(';');
  for(var i=0; i<ca.length; i++) 
  {
    var c = ca[i].trim();
    if (c.indexOf(name)==0) return c.substring(name.length,c.length);
  }
  return null;
}
