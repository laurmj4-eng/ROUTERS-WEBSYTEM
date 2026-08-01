var goperator_name = null;
if(goperator_name === null){
		XHR.get("get_operator_test", null, function(data) {
			if (data) {
				goperator_name = data.operator_name;
			}
		});
}

function loginPageAccessCheck(operator_name,curentpage)
{
	var url;
	if(curentpage == "3bb.html" || curentpage == "rmnt.html" || curentpage == "update.html" || curentpage == "tr069.html")
	{
		if(operator_name != "TH_3BB")
		{
			url = "html/login_inter.html";
			if(operator_name == "PH_PLDT"){
				sessionStorage.setItem("fh_access", "0");
				url = "html/login_pldt.html";
			}
			if(operator_name == "BZ_TIM"){
				url = "public/index.html";
			}
			if(operator_name == "PLE_PALTEL"){
				url = "html/login_paltel.html";
			}
			if(operator_name == "TH_AIS"){
				url = "html/login_ais.html";
			}
			window.location.href = url;
		}	
	}
	else if(curentpage == "help.html")
	{
		if(operator_name != "PH_PLDT")
		{
			url = "html/login_inter.html";
			if(operator_name == "BZ_TIM"){
				url = "public/index.html";
			}
			if(operator_name == "PLE_PALTEL"){
				url = "html/login_paltel.html";
			}
			if(operator_name == "TH_AIS"){
				url = "html/login_ais.html";
			}
			if(operator_name == "TH_3BB"){
				url = "html/login_3bb.html";
			}
			window.location.href = url;
		}	
	}
	else if(curentpage == "index_th_ais.html" || curentpage == "LandingPage.html")
	{
		if(operator_name != "TH_AIS")
		{
			url = "html/login_inter.html";
			if(operator_name == "PH_PLDT"){
				sessionStorage.setItem("fh_access", "0");
				url = "html/login_pldt.html";
			}
			if(operator_name == "BZ_TIM"){
				url = "public/index.html";
			}
			if(operator_name == "PLE_PALTEL"){
				url = "html/login_paltel.html";
			}
			if(operator_name == "TH_3BB"){
				url = "html/login_3bb.html";
			}
			window.location.href = url;
		}	
	}

}


function loginHtmlAccessCheck(operator_name,curentpage)
{
	var url;
	if(curentpage == "login_3bb.html"){
		if(operator_name != "TH_3BB")
		{
			url = "login_inter.html";
			if(operator_name == "PH_PLDT"){
				sessionStorage.setItem("fh_access", "0");
				url = "login_pldt.html";
			}
			if(operator_name == "BZ_TIM"){
				url = "index.html";
			}
			if(operator_name == "PLE_PALTEL"){
				url = "login_paltel.html";
			}
			if(operator_name == "TH_AIS"){
				url = "login_ais.html";
			}
			if(operator_name == "ROM_RCSRDS" || operator_name == "MAGYAR_4IG"){
				url = "login_romania.html";
			}
			window.location.href = url;
		}	
	}
	else if(curentpage == "login_ais.html"){
		if(operator_name != "TH_AIS")
		{
			url = "login_inter.html";
			if(operator_name == "PH_PLDT"){
				sessionStorage.setItem("fh_access", "0");
				url = "login_pldt.html";
			}
			if(operator_name == "BZ_TIM"){
				url = "index.html";
			}
			if(operator_name == "PLE_PALTEL"){
				url = "login_paltel.html";
			}
			if(operator_name == "TH_3BB"){
				url = "login_3bb.html";
			}
			if(operator_name == "ROM_RCSRDS" || operator_name == "MAGYAR_4IG"){
				url = "login_romania.html";
			}
			window.location.href = url;
		}	
	}
	else if(curentpage == "login_paltel.html"){
		if(operator_name != "PLE_PALTEL")
		{
			url = "login_inter.html";
			if(operator_name == "PH_PLDT"){
				sessionStorage.setItem("fh_access", "0");
				url = "login_pldt.html";
			}
			if(operator_name == "BZ_TIM"){
				url = "index.html";
			}
			if(operator_name == "TH_AIS"){
				url = "login_ais.html";
			}
			if(operator_name == "TH_3BB"){
				url = "login_3bb.html";
			}
			if(operator_name == "ROM_RCSRDS" || operator_name == "MAGYAR_4IG"){
				url = "login_romania.html";
			}
			window.location.href = url;
		}	
	}
	else if(curentpage == "login_pldt.html"){
		if(operator_name != "PH_PLDT")
		{
			url = "login_inter.html";
			if(operator_name == "PLE_PALTEL"){
				url = "login_paltel.html";
			}
			if(operator_name == "BZ_TIM"){
				url = "index.html";
			}
			if(operator_name == "TH_AIS"){
				url = "login_ais.html";
			}
			if(operator_name == "TH_3BB"){
				url = "login_3bb.html";
			}
			if(operator_name == "ROM_RCSRDS" || operator_name == "MAGYAR_4IG"){
				url = "login_romania.html";
			}
			window.location.href = url;
		}	
	}
	else if(curentpage == "login_romania.html"){
		if(operator_name != "ROM_RCSRDS" && operator_name != "MAGYAR_4IG")
		{
			url = "login_inter.html";
			if(operator_name == "PLE_PALTEL"){
				url = "login_paltel.html";
			}
			if(operator_name == "BZ_TIM"){
				url = "index.html";
			}
			if(operator_name == "TH_AIS"){
				url = "login_ais.html";
			}
			if(operator_name == "TH_3BB"){
				url = "login_3bb.html";
			}
			if(operator_name == "PH_PLDT"){
				sessionStorage.setItem("fh_access", "0");
				url = "login_pldt.html";
			}
			window.location.href = url;
		}	
	}
	else if(curentpage == "login_inter.html"){
		var url;
		if(operator_name == "PLE_PALTEL"){
			url = "login_paltel.html";
			window.location.href = url;
		}
		// if(operator_name == "BZ_TIM"){
		// 	url = "/public/index.html";
		// 	window.location.href = url;
		// }
		if(operator_name == "TH_AIS"){
			url = "login_ais.html";
			window.location.href = url;
		}
		if(operator_name == "TH_3BB"){
			url = "login_3bb.html";
			window.location.href = url;
		}
		if(operator_name == "PH_PLDT"){
			sessionStorage.setItem("fh_access", "0");
			url = "login_pldt.html";
			window.location.href = url;
		}	
		if(operator_name == "ROM_RCSRDS" || operator_name == "MAGYAR_4IG"){
			url = "login_romania.html";
			window.location.href = url;
		}
	}
}
