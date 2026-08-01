//javascript for login_inter.html
// var isEmpty = true;

var sessionidstr = "";
var operator_name = "";
var verifiCode = "";
var super_userName = "";
var admin_enable = "";
var zkzcode;//3BB��֤��
var username = "";
var login_error_hint;
//var default_admin = "6GFJdY4aAuUKJjdtSn7dC2x";
//var default_common = "1234";
var login_user = '1';
document.onkeydown=function mykeyDown(e){   
	e = e||event;		
	if(e.keyCode == 13) 
	{
		document.getElementById('login_btn').click();
		
	}    
	return;
}

$(document).ready(function(){

	if(operator_name == "BZ_CLARO")
	{
		noNeedSavePassword();
		
		//createCode();
	}
	XHR.get("get_login_user", null, parseLoginUser);
    XHR.get("get_operator", null, get_operator);
});

function get_operator(getdata){
    if ( getdata.operator_name != undefined )
    {
        operator_name = getdata.operator_name;
    }
}

function parseLoginUser(data)
{
	if ( data )
	{
		sessionidstr = data.sessionid;
		login_user = data.login_user;
	}
}

function onlogin(a) 
	{
		if (a == 1)//login
		{	
			if($("#user_name").val().length <= 0) {
				alert("no_username_alert".i18n());
				$("#user_name").focus();
				return false;
			}
			if($("#loginpp").val().length <= 0) {
				alert("no_password_alert".i18n());
				$("#loginpp").focus();
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
	
	postdata.fhAccess = sessionStorage.getItem("fh_access");
    XHR.post("do_login", postdata, parseLoginData);	
}

function parseLoginData(data)
{
	if (data)
	{
		$("#login_error_hint").show();
		var login_error_hint = document.getElementById("login_error_hint");
		if ( data.login_result == 0 )//У��ɹ�
		{
				//�������λ��С��12�������벻���Ϲ淶��������Сд��ĸ�����ֺ������ַ������ߵ��ڳ�ʼ����
				if($("#loginpp").val().length < 12 || check_pwd_strength($("#loginpp").val()) == false || data.is_default_pwd == "1"){
					//alert("The password needs to contain the following four types of characters: 0-9, a-z, A-Z, ! \" #$% & \'()*+,-./:; <=>?@[\]^_`{|}~");
					if(data.is_default_pwd == "1"){
						localStorage.setItem("default_pwd", "1");
					}else{
						localStorage.setItem("default_pwd", "0");
					}
					
					window.location.href = "default_pwdmodify_pldt.html";
					
				}else{
					window.location.href="main_pldt.html";
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
			login_error_hint.innerHTML = "name_pwd_error".i18n();

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
}


function check_pwd_strength(str)
{
    var reg = new RegExp(/\d+/,"g");
    var str1 = str.replace(reg,"");
        if(str == str1) 
        {
            return false;
        }
    var reg= new RegExp(/[\a-z]+/,"g");
    var str2= str1.replace(reg,"");
        if(str1 == str2) 
        {
            return false;
        }
    var reg = new RegExp(/[\A-Z]+/,"g");
    var str3 = str2.replace(reg,"");
        if(str2 == str3) 
        {
            return false;
        }
    //!"#$%&'()*+,-./:<=>?@[\]^_`{|}~
    var reg = new RegExp(/["'!#\$%&\(\)\*\+,-\./:;<=>\?@\[\]\^_`\{\|\}~\\\\]+/,"g");
    var str4 = str3.replace(reg,"");
        if(str4 == str3)
        {
            return false;
        }
        if("" == str4)
        {
            return true;
        }
        else
        {
            return false;
        }
}


