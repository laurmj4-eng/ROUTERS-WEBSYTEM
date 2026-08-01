var sessionidstr = "";
var operator_name =  gOperatorName;
$(document).ready(function(){
	//优化滚动条，无需改动
	//customScrollBar("html");
	
	if(operator_name == "MEX_TELMEX"){
		$("#update_telmex").show();
		$("#update_common").hide();
	}else{
		$("#update_telmex").hide();
		$("#update_common").show();
	}

	if(operator_name == "IDN_TELKOM")
	{
		$("#update_config_header").hide();
		$("#file_form").hide();
	}

	if(operator_name == "IDN_TELKOM")
	{
		$('#upload_button').click(function(){
			window.location.reload();
		});
	}
	else
	{
			$('#upload_button').click(function(){
			//valid check
			console.log($('form')[0].uploadfile.value);
			if(operator_name == "MEX_TELMEX")
			{
				if ( $("#path").val() == '' )
				{
					alert("upload_path_empty_error".i18n());
					return false;
				}
			}else{
				if ( $('form')[0].uploadfile.value == '' || $('form')[0].uploadfile.value == undefined )
				{
					alert("file_error_alert".i18n());
					return false;
				}

			}
			$("#file_form").attr("action", "../cgi-bin/ajax?method=upload&action=commonfile&path=/var/");
	        
		});
	}
	
	
	var options = {
		success:completeHandler
	};
	$("#file_form").submit( function(){  
		$(this).ajaxSubmit(options);  
        $('#upload_button').attr('disabled',"true");
		return false;//阻止表单默认提交
        
	});	
	
});


function completeHandler(returnData, statusText)
{
	if ( statusText != "success" )
	{
		errorHandler();
		return;
	}
	returnData = JSON.parse(returnData);
	
	var uploadsuccess = false;
	var errmsg = "";
	if ( returnData )
	{
		if ( returnData.error_code != null && returnData.error_code != undefined )
		{
			if ( returnData.error_code == 14)//add by fengshuo 20191205
			{
				errmsg = "File is illegal, please check and upload again!";
			}
			else if ( returnData.error_code == 19 )
			{
				errmsg = "Path" + $("#path").val() + "is unreachable";
			}
			else if ( returnData.error_code == 20 )
			{
				errmsg = "Path" + $("#path").val() + "id readonly";
			}
		}
		
		if ( returnData.uploadStatus != null
			&& returnData.uploadStatus != undefined
			&& returnData.uploadStatus == "UPLOADSUCCESS" )
		{
			uploadsuccess = true;
			alert("Upload Success! ONU will reboot ")
			XHR.get("get_login_user", null, function(getdata){
				if ( getdata.sessionid != undefined )
				{
					sessionidstr = getdata.sessionid;
			
					var postdata = new Object();
					postdata.sessionid = sessionidstr;
					XHR.post("set_onu_reboot", postdata, null);
				}
			});
		}
	}

	if ( false == uploadsuccess )
	{
		errorHandler(errmsg);
	}
	else
	{
		//alert("Success");
	}
	return;
}


function errorHandler(msg)
{
	var showmessage = "upload_error_alert".i18n();
	
	if ( msg != undefined && msg != "" )
	{
		showmessage = msg;
	}
	
	fiberlog("upload error");
	alert(showmessage);
}

function down_cfgfile()
{
	XHR.get("get_login_user", null, function(getdata){
		if ( getdata.sessionid != undefined )
		{
			var postdata = new Object();
			postdata.sessionid = getdata.sessionid;
			XHR.post("down_cfgfile", postdata, parse_return_data);
		}
	});
}

function parse_return_data(data)
{
	if ( data && data.success == "true")
	{
		window.location = "../cgi-bin/download?usrconfig_conf";
	}
	else
	{
		alert("unknown_error_alert".i18n());
	}
}

function upload_file()
{
	$("#uploadfile_telmex").click();
}


function upload_file2(path)
{
	$("#path").val(path.slice(12));
}