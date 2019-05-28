chrome.runtime.onMessage.addListener( (m, s, c) => {
	if(m == "Api")
	{
		chrome.tabs.executeScript(null,{
		  file: `js/i.js`
		});
	}else if(m === "CS_Extension_AddWebSite_Confirm"){
		chrome.storage.local.get(["CS_ApproveWebSite"], function(d) {
			if(d.CS_ApproveWebSite === undefined)
			{
				d.CS_ApproveWebSite = [];
			}
			d.CS_ApproveWebSite.push(s.url);
			chrome.storage.local.set({CS_ApproveWebSite:d.CS_ApproveWebSite});
		});
		c(true);
	}
});

chrome.runtime.onMessageExternal.addListener((m, s, c) => {
	let Res = {
		message: undefined,
		result: undefined
	};
	if(m.method != undefined && m.method == 'CS_Extension_Balance'){
		chrome.storage.local.get(['CS_PublicKey',"CS_NET"], function(d) {
			if(d.CS_NET === undefined)
			{
				Res.message = "Network is not set";
				c(Res);
				return;
			}
			
			Url = d.CS_NET.Url;
			Port = d.CS_NET.Port;
			let Key;
			if(m.Key === undefined){
				Key = d.CS_PublicKey;
			}else{
				Key = m.Key;
			}
			
			try	
			{
				Key = Base58.decode(Key);
			}
			catch (e)
			{
				Res.message = "Public Key unvalid";
				c(Res);
				return;
			}
			
			SignCS.Connect().WalletBalanceGet(Key,function(r){
				if(r.status.code > 0 && r.status.message != "Not found")
				{
					Res.message = r.status.message;
				}
				else
				{
					Res.result = {Credits_CS:r.balance.integral + r.balance.fraction * Math.pow(10,-18)};
				}
				c(Res);
				return;
			});
		});
	} else if (m.method != undefined && m.method == "CS_Extension_Transaction"){
		if(typeof m.Trans !== "object")
		{
			Res.message = "No transaction data";
			c(Res);
			return;
		}
		
		
		let val = m.Trans;  
		chrome.storage.local.get(['CS_PrivateKey','CS_PublicKey',"CS_NET","CS_ApproveWebSite"], function(d) 
		{
			let CheckSite = false;
			
			if(d.CS_ApproveWebSite !== undefined)
			{
				for(let i in d.CS_ApproveWebSite)
				{
					if(d.CS_ApproveWebSite[i] === s.url)
					{
						CheckSite = true;
					}
				}
			}
			
			if(CheckSite)
			{
				if(d.CS_PublicKey === undefined)
				{
					Res.message = "User is not authorized";
					c(Res);
					return;
				}
				
				
				Url = d.CS_NET.Url;
				Port = d.CS_NET.Port;
				val.Source = Base58.decode(d.CS_PublicKey);
				val.PrivateKey = Base58.decode(d.CS_PrivateKey);
				let Trans = SignCS.CreateTransaction(val);
				if(Trans.Result == null)
				{
					Res.message = Trans.Message;
					c(Res);
					return;
				}
				else
				{
					SignCS.Connect().TransactionFlow(Trans.Result,function(r)
					{
						if(r.status.code > 0)
						{
							Res.message = r.status.message;
						}
						else
						{
							Res.result = r;
						}
						c(Res);
					});
				}
			}
			else
			{
				Res.message = "Site not approved";
				c(Res);
				chrome.tabs.sendMessage(s.tab.id, {method:"CS_Extension_AddWebsite",url:s.url});
			}
		});
	} else if (m.method !== undefined && m.method === "CS_Extension_History"){
		
		if(typeof m.Data !== "object")
		{
			Res.message = "Data is not be empty";
			c(Res);
			return;
		}
		
		
		
		if(isNaN(Number(m.Data.Page)))
		{
			Res.message = "Page must be a number";
			c(Res);
			return;
		}
		if(isNaN(Number(m.Data.Size)))
		{
			Res.message = "Size must be a number";
			c(Res);
			return;
		}
		
		let Key = ["CS_NET"];
		if(m.Key === undefined)
		{
			Key.push('CS_PublicKey');
		}
		chrome.storage.local.get(Key, function(d) {
			if(d.CS_NET === undefined)
			{
				Res.message = "Network is not set";
				c(Res);
				return;
			}
			
			Url = d.CS_NET.Url;
			Port = d.CS_NET.Port;
			
			let PubKey;
			if(m.Key === undefined)
			{
				PubKey = d.CS_PublicKey;
			}else{
				PubKey = m.Key;
			}
			
			try	
			{
				PubKey = Base58.decode(PubKey);
			}
			catch (e)
			{
				Res.message = "Public Key unvalid";
				c(Res);
				return;
			}
			
			SignCS.Connect().TransactionsGet(PubKey,m.Data.Page * m.Data.Size - m.Data.Size,m.Data.Size,r => {
				if(r.status.code > 0)
				{
					Res.message = r.status.message;
				}
				else
				{
					Res.result = [];
					for(let i in r.transactions)
					{
						let val = r.transactions[i];
						Res.result.push({
							id: `${ByteToHex(StrToByte(val.id.poolHash))}.${val.id.index}`,
							amount: val.trxn.amount.integral + val.trxn.amount.fraction * Math.pow(10,-18),
							fee: SignCS.FeeToNumber(val.trxn.fee.commission),
							source: Base58.encode(StrToByte(val.trxn.source)),
							target: Base58.encode(StrToByte(val.trxn.target)),
							smartContract: val.trxn.smartContract,
							smartInfo: val.trxn.smartInfo
						});
					}
				}
				c(Res);
			});
		});
	} else if (m === "CS_Extension_Authorization"){
		chrome.storage.local.get(['CS_PublicKey'], function(d) {
			if(d.CS_PublicKey === undefined)
			{
				Res.result = false;
			}else{
				Res.result = true;
			}
			c(Res);
		});
	} 
	else if(m === "CS_Extension_AddWebsite")
	{
		chrome.tabs.sendMessage(s.tab.id, "CS_Extension_AddWebsite");
	} 
	else if(m.method !== undefined && m.method === "CS_Extension_compiledSmartContractCode")
	{
		if(m.code == "" || m.code == undefined){
			Res.message == "The code must not be empty";
			c(Res);
		}else{
			chrome.storage.local.get(["CS_NET"], d => {
				if(d.CS_NET === undefined)
				{
					Res.message = "Network is not set";
					c(Res);
				}
				else
				{
					Url = d.CS_NET.Url;
					Port = d.CS_NET.Port;
					
					SignCS.Connect().SmartContractCompile(m.code,r => {
						if(r.status.code > 0){
							Res.message = r.status.message;
						}else{
							Res.result = r.byteCodeObjects;
						}
						c(Res);
					});
				}
			});
		}
	} 
	else if (m === "CS_CurNet")
	{
		chrome.storage.local.get(["CS_NET"], d => {
			if(d.CS_NET === undefined)
			{
				Res.message = "User is not authorized";
			}
			else
			{
				Res.result = d.CS_NET.Mon;
			}
			c(Res);
		});
	}
});
	
function ByteToHex(Byte)
{
	let ArHex = "0123456789ABCDEF";
	let Hex = "";
	for (let j = 0; j < Byte.length; j++) {
		Hex += ArHex[Math.floor(Byte[j] / 16)];
		Hex += ArHex[Math.floor(Byte[j] % 16)];
	}
	return Hex;
}

function StrToByte(Str)
{
	let B = new Uint8Array(Str.length);
	for (let i in Str) {
		B[i] = Str[i].charCodeAt();
	}
	return B;
}