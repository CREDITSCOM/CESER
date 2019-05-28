console.log("Credits Api");

(function () {
	window.CS_Extension_Id = document.getElementById("CS_Extension_Id").value;
	window.CreditsExtension = 
	{
			balanceGet: function(Obj,callBack)
			{
				console.log("balanceGet");
				let Res = {
					result: false,
					message: undefined
				};
				
				if(Obj === undefined)
				{
					Obj = {};
				}
				
				if(typeof Obj !== "object")
				{
					Res.message = "Obj is not an object";
				}
				else
				{
				
					if(typeof callBack !== "function")
					{
						Res.message = "Callback is not a function";
					}
					else
					{
						Obj.method = "CS_Extension_Balance";
						SendMess(CS_Extension_Id,Obj,callBack);
						Res.result = true;
					}
				}
				return Res;
			},
			sendTransaction: function(Transaction,callBack)
			{
				console.log("sendTransaction");
				let Res = {
					result: false,
					message: undefined
				};
				
				if(typeof Transaction !== "object")
				{
					Res.message = "Transaction is not valid";
				}
				else
				{
					if(typeof callBack !== "function")
					{
						Res.message = "Callback is not a function";
					}
					else
					{
						SendMess(CS_Extension_Id,{method:"CS_Extension_Transaction",Trans:Transaction},callBack);
						Res.result = true;
					}
				}
				return Res;
			},
			getHistory: function(Obj,callBack)
			{
				console.log("getHistory");
				
				let Res = {
					result: false,
					message: undefined
				};
				
				if(typeof Obj !== "object")
				{
					Res.message = "Obj is not an object";
				}
				else
				{
					if(typeof callBack !== "function")
					{
						Res.message = "Callback is not a function";
					}
					else
					{
						SendMess(CS_Extension_Id,{method:"CS_Extension_History",Data:Obj},callBack);
						Res.result = true;
					}
				}
				return Res;
			},
			authorization: function(callBack)
			{
				console.log("authorization");
				
				let Res = {
					result: false,
					message: undefined
				};
				
				if(typeof callBack !== "function")
				{
					Res.message = "Callback is not a function";
				}
				else
				{
					SendMess(CS_Extension_Id,"CS_Extension_Authorization",callBack);
					Res.result = true;
				}
				return Res;
			},
			AddWebSite: function(callBack)
			{
				console.log("CS_Extension_AddWebsite");
				
				let Res = {
					result: false,
					message: undefined
				};
				
				if(typeof callBack !== "function")
				{
					Res.message = "Callback is not a function";
				}
				else
				{
					SendMess(CS_Extension_Id,"CS_Extension_AddWebsite",callBack);
					Res.result = true;
				}
				return Res;
			},
			compiledSmartContractCode: function(Code,callBack)
			{
				console.log("compiledSmartContractCode");
				
				let Res = {
					result: false,
					message: undefined
				};
				
				if(typeof Code !== "string")
				{
					Res.message = "Code is not a string";
				}
				else
				{
					if(typeof callBack !== "function")
					{
						Res.message = "Callback is not a function";
					}
					else
					{
						SendMess(CS_Extension_Id,{method:"CS_Extension_compiledSmartContractCode",code:Code},callBack);
						Res.result = true;
					}
				}
				return Res;
			},
			CurNet: (callBack) => 
			{
				console.log("CurNet");
				
				let Res = {
					result: false,
					message: undefined
				};
				
				if(typeof callBack !== "function")
				{
					Res.message = "Callback is not a function";
					return Res;
				}
				
				SendMess(CS_Extension_Id,"CS_CurNet",callBack);
				Res.result = true;
				return Res;
			}
	}
	
	function SendMess(i,m,c){
		chrome.runtime.sendMessage(i,m,r => {
			if (chrome.runtime.lastError) { 
				r = {message: "Connect ERROR: " + chrome.runtime.lastError.message};
			} 
			c(r);
		});
	}
}());