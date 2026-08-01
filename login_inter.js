//javascript for login_inter.html
// var isEmpty = true;

var sessionidstr = "";
var operator_name = "";
var FirstTimeSetting = "";
var verifiCode = "";
var super_userName = "";
var admin_enable = "";
var zkzcode;//3BB��֤��
var username = "";
var lang = "";
var login_error_hint;
var login_user;
var isFirstSetting;
var sn;
var default_password;
document.onkeydown=function mykeyDown(e){   
	e = e||event;		
	if(e.keyCode == 13) 
	{
		document.getElementById('login_btn').click();
		
	}    
	return;
}

$(document).ready(function(){
	
	XHR.get("get_operator", null, get_operator_sn);
	initCustom();
	if(operator_name == "EG_TELECOM")
	{
       XHR.get("get_web_config", null, getWebConfig);
	}
    if(operator_name == "BZ_CLARO")
    {
        XHR.get("get_super_userName_telmex", null, get_super_userName); 
		noNeedSavePassword();
		//createCode();
	}

	if(operator_name == "MEX_TELMEX")
	{
		XHR.get("get_super_userName_telmex", null, get_super_userName);
		XHR.get("get_lang_info", null, get_lang_info);
		$("#show_password").show();
		$("#lang_div").show();
		$(".STYLE2").css("width","100px");
	}

});

function get_super_userName(data)
{
	if(data && data != undefined){
		$("#user_name").val(data.super_userName);
		$("#user_name").css("background-color","#F5F5F5");
		$("#user_name").attr("disabled",true);
	}

}

function get_lang_info(data)
{
	if(data && data != undefined){
		if(data.i18n == 'span')
		{
			$("#SpanishModify").css("color","#00BFFF");
			$("#EnglishModify").css("color","black");
		}
		else if(data.i18n == 'en')
		{
			$("#EnglishModify").css("color","#00BFFF");
			$("#SpanishModify").css("color","black");
		}
	}
}

function change_eye()
{
    $("#loginpp").toggleClass("fh-text-security");
    
}
function getWebConfig(data){
    if ( data )
    {
       isFirstSetting = data. FirstTimeSetting
    }
}

//����Claro���󣺽��ù���Ա��¼
function disableSuperUser(username){
	if(super_userName == username && operator_name == "BZ_CLARO" && admin_enable == "0" ){
		return false;
	}
}

//����Claro���󣺵�¼ʱ�����������û������뵯��
function noNeedSavePassword(){
	//$("#loginpp").attr("type","text");
		var html ='';
		html='<input name="loginpp" id="loginpp" maxlength="32" type="text"  autocomplete="off" style="width:130px; height:28px;" >';
		$("#password_td").html(html);
		html = '';
		html = '<input name="loginpp_display" id="loginpp_display" maxlength="32" type="text" autocomplete="off" style="width:130px; height:28px;">';
		$("#password_td").append(html);		
		$("#loginpp").hide();
		$("#loginpp_display").val();
		var str=""//�洢������ʵ����
	     $("#loginpp_display").keyup(function(){
	        value=$(this).val();//��ȡ��������
	        if(value.length>=str.length){//�����볤������ʱ����ǰ����Ѿ�����Ǻţ����Խ�ȡ����������ַ�׷�ӵ�str��
	           str+=value.substr(str.length,value.length-str.length);    
			}
	        else
			{//�����볤�ȼ�Сʱ���жϼ�С��ĳ��ȣ�Ȼ�����ʵ�����н�ȡ
	          str=str.substr(0,value.length);
	        } 
			 $("#loginpp").val(str);
	        $(this).val(value.replace(/./g,"*"));//�������
	     })	
}

//ˢ����֤�밴ť
function refresh()
{
	//createCode();
	$("#verifiCode").html(zkzcode);
}


function initCustom()
{
	
	if(operator_name == 'TH_TRUE'  )
	{
		$("#tr_verifi").show();
		$("#verifiCode").html(verifiCode);
	}else if( operator_name == 'TH_3BB')
	{
		//createCode();
		$("#tr_verifi").show();
		var obj = document.getElementById("verifiCode");
		   obj.style.cssText ="letter-spacing:15px";
		$("#verifiCode").html(zkzcode);
	}
}

function get_operator_sn(getdata)
{
	
	if ( getdata.operator_name != undefined )
	{
		operator_name = getdata.operator_name;
        sn = getdata.SerialNumber;
        default_password = sn.substring(sn.length-8, sn.length);
        //alert(default_password);
	}
	if(operator_name == "BZ_TIM"){
		sessionStorage.setItem("operator_name", "BZ_TIM");
	}
}

function onlogin(a) 
	{
		if (a == 1)//login
		{	
			if($("#user_name").val().length <= 0) {
				alert("no_username_alert".i18n());
				return false;
			}
			if($("#loginpp").val().length <= 0) {
				alert("no_password_alert".i18n());
				return false;
			}
			if($("#validate_code").val() != zkzcode) {
				//alert("11");
				alert("validate_code_alert".i18n());
				return false;
			}
			doLoginRequest();
		}
		else if (a == 2)//cancel
		{
			user_name.value = "";
			loginpp.value = "";
			document.getElementById("login_error_hint").style.display = "none";	
		}
		else if (a ==3)//regist
		{		
			window.location.href = "register.html";			
			document.getElementById("login_error_hint").style.display = "none";
		}			
	}

function doLoginRequest()
{
	var postdata = new Object();
	$("#login_btn").attr("disabled",true);
	
	postdata.username = $("#user_name").val();
	postdata.loginpd = fhencrypt($("#loginpp").val());
	postdata.port = 0;
	
	//����Claroҳ�濪�����ù���Ա��¼
	if(disableSuperUser(postdata.username) == false){
			 alert("name_pwd_error".i18n()) ;
			return ;
	}
	        postdata.sessionid = sessionidstr;
	        XHR.post("do_login", postdata, parseLoginData);	

}

function parseLoginData(data)
{
	if (data)
	{
		$("#login_error_hint").show();
        XHR.get("get_login_user", null, function(data_1) {
        	if (data_1) {
        		login_user = data_1.login_user;
        	}
        });
        
		var login_error_hint = document.getElementById("login_error_hint");
		if ( data.login_result == 0 )//У��ɹ�
		{
			$("#login_btn").attr("disabled",false);
			if(operator_name == "OMN_OMANTEL" && data.is_redirect == 1){
				window.location.href="user_modifypw_omn_omantel.html";
			}else if(operator_name == "MEX_TELMEX" && data.is_redirect == 1){
				window.location.href="admin_modifypwd_inter.html";
			}
			else if(operator_name == "ECU_CNT"){
				//�����¼֮��, �ж��Ƿ��ǵ�һ������
				XHR.get("get_web_config", null, isFirstTimeSetting);
			}else if(operator_name == "EG_TELECOM"){
                XHR.get("get_web_config", null, isFirstTimeSetting);
                //alert(isFirstSetting);
                if(isFirstSetting == "1" && default_password ==  $("#loginpp").val() ){
                   if(window.confirm("If you want to modify you default password , please click yes. Else, you can click no to skip!"))
                   {
                       window.location.href="admin_modifypwd_inter.html";
                   }else{
                      window.location.href="main_inter.html";
                   } 
                }else{
                   window.location.href="main_inter.html"; 
                }
                
            }
			else{
				if(operator_name == "MEX_TELMEX"){
					window.location.href="main_inter_telmex.html";
				}else{
					window.location.href="main_inter.html";
				}	
			}
			return;
		}
		else if ( data.login_result == 1 )
		{
			//alert("��ǰ�����û��ڱ𴦵�¼�����Ժ��¼");
			//document.getElementById("login_error_hint").style.display = "none";
			login_error_hint.innerHTML = "haveuserlogin".i18n();
		}
		else if ( data.login_result == 2 )
		{
			//alert("�������������½�����Ѿ��ﵽ3�Σ���30���Ӻ�����");
			//document.getElementById("login_error_hint").style.display = "";
			login_error_hint.innerHTML = "3timeError".i18n();
			if(operator_name == "TH_TRUE"|| operator_name == "TH_SME_TRUE")
			{//̩��TRUE��������"�������������½�����Ѿ��ﵽ3�Σ���30���Ӻ�����"
				login_error_hint.innerHTML = "3timeError_30".i18n();
			}else if(operator_name == "ECU_CNT"){
              //��϶����������"�������������½�����Ѿ��ﵽ3�Σ���2���Ӻ�����"
              	login_error_hint.innerHTML = "3timeError_2".i18n();  
            }else if(operator_name == "PAK_PTCL" && data.is_admin == 1){
				login_error_hint.innerHTML = "10timeError_5".i18n();  
			}
		}
		else if ( data.login_result == 3 )
		{
			//alert("����ά���ʺ��ѱ����ã�����ѡ�ʺŵ�¼");
			//document.getElementById("login_error_hint").style.display = "none";
			login_error_hint.innerHTML = "account_disabled_error".i18n();
		}
		else if ( data.login_result == 4 )
		{
			//alert("�û������������������");
			//document.getElementById("login_error_hint").style.display = "";
			
			if(operator_name == "MEX_TELMEX"){
				login_error_hint.innerHTML = "name_pwd_error_mex".i18n();
				$("#login_error_hint").css("font-size","16px");
			}
			else{
				login_error_hint.innerHTML = "name_pwd_error".i18n();
			}

		}
		else if ( data.login_result == 100 )
		{
			//alert("wan���½");
			//document.getElementById("login_error_hint").style.display = "";
			login_error_hint.innerHTML = "login_fail".i18n();

		}
		else
		{
			//alert("δ֪����");
			//document.getElementById("login_error_hint").style.display = "none";
			login_error_hint.innerHTML = "unexpected_error".i18n();
		}
	}
	else
	{
		alert("unexpected_error".i18n());
		document.getElementById("login_error_hint").style.display = "none";
	}
	$("#login_btn").attr("disabled",false);
	$("#loginpp").val("");
	$("#loginpp_display").val("");
}
function change_css(id)
{
	$("#"+id+"").css({"border":"2px","border-style":"solid","border-color":"#00A0D7","outline":"none"});

}

function change_css2(id)
{
	$("#"+id+"").css({"border":"none","outline":"none"});
}

function initPage(data)
{
	if(data.success == "true")
	{
		window.location.reload();
	}
}

function changeLanguage(kind)
{
	 var postdata1 = new Object();
	if(kind == "en")
	{
		postdata1.lang = "en";
	}
	else if(kind == "spain")
	{
		postdata1.lang = "span";
	}
	
	XHR.post("set_lang_info", postdata1, initPage);
}

function isFirstTimeSetting (data)
{
    
	if ( data )
	{
		//login_user = gLoginUser;
        this.FirstTimeSetting = data.FirstTimeSetting;
		//��һ�ε�¼,�����������ҳ��
		if (this.FirstTimeSetting === "1" && login_user !== "2") {
        
            window.location.href="fast_settings_wan_ECU_CNT.html";

        } else {
            window.location.href="main_inter.html";
        }

	}
}

