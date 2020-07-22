var CS_NET;
window.onload = function () {
	main();
};

function main()
{
	chrome.storage.local.get(['CS_PrivateKey','CS_PublicKey','CS_NET'], function(d) {
		if(d.CS_PublicKey === undefined)
		{
			RenderLogIn();
		}
		else
		{
			CS_PublicKey = Base58.decode(d.CS_PublicKey);
			CS_PrivateKey = Base58.decode(d.CS_PrivateKey);
			if(d.CS_NET === undefined)
			{
				chrome.storage.local.set({CS_NET: {Name:"test", Url:"165.22.212.41", Port:"18081",Mon:"testnet"}});
				CS_NET = {Name: "test",Url: "165.22.212.41",Port:"18081",Mon:"testnet"};
			}else{
				CS_NET = d.CS_NET;
			}
			RenderMain();
		}
	});
}

function RenderApproveCreate()
{
	$("body").html(`
	<header>
		<div class="top-line main_p">
			<div class="logo">
				<img src="img/Logo.png" class="logoimg">
			</div>
		</div>
	</header>
	<div id="Table" class="wrapper">
		<div class="ro-wr">
			<div class="Main2 text-medium mb-25">Before you get started</div>
			<p class="text-center mb-25">This Extension does not collect or store 
			any information about you.</p>
			<hr class="hr-awr">
			<p class="row-awr"><input class="inp-awr" type="checkbox" id="CheckAllow1"><span class="mid-awr">I accept that my funds are stored on this account and it is impossible to recover account access if it is lost.</span></p>
			<p class="row-awr"><input class="inp-awr" type="checkbox" id="CheckAllow2"><span class="mid-awr">I accept that the transfer of access keys or an access file to second parties can lead to theft of funds available on the account.</span></p>
		</div>
	</div>
	<div class="button-line">
		<div class="button-back" id="Back" style="width: 25%;">
			<img src="img/Arrow-left.png" alt=""> Back
		</div>
		<div class="button-c disabled_b" id="ApproveCreate">Continue</div>
		<div style="width: 20%;"></div>
	</div>
	<footer>
		<span>Powered by Credits</span>
	</footer>
	`)
	$("#Back").on("click",RenderLogIn);
	$("#CheckAllow1").on("click",CheckApproveInCreate);
	$("#CheckAllow2").on("click",CheckApproveInCreate);
}


function RenderCreatedAccount()
{
	
	let signPair = nacl.sign.keyPair();
	let PublicKey = Base58.encode(signPair.publicKey);
	let PrivateKey = Base58.encode(signPair.secretKey);

	$("body").html(`
	<header>
		<div class="top-line main_p">
			<div class="logo">
				<img src="img/Logo.png" class="logoimg">
			</div>
		</div>
	</header>
	<div id="Table" class="wrapper">
		<div class="ro-wr">
			<div class="Main2 text-medium mb-25">Create an Account</div>
			<p class="text-center mb-25">To make payments with Credits (CS) cryptocurrency, tokens or use smart contracts, you need to create an account in the Credits blockchain. It’s very easy.</p>
		</div>
		<div class="ro-wr">
			<label for="private">Public key</label>
			<p>${PublicKey}</p>
		</div>
		<div class="ro-wr">
			<label for="private">Private key</label>
			<p>${PrivateKey}</p>
		</div>
	</div>
	<div class="button-line loginPage" style="justify-content:center;">
		<div id="DownloadFile" class="button-c">
			Download File
		</div>
	</div>
	<div class="button-line loginPage" style="justify-content:center;">
		<div id="LogIn" class="button-blue">
			Sign In
		</div>
	</div>
	<footer>
		<span>Powered by Credits</span>
	</footer>
	`);
	$("#DownloadFile").on("click",() => {DownloadFile("key.json", JSON.stringify({
			key: {
				public: PublicKey,
				private: PrivateKey
			}
		})
	)});
	$("#LogIn").on("click",RenderLogIn);
}

function RenderApprovedSite()
{
	chrome.storage.local.get(["CS_ApproveWebSite"], d =>{
		let Tr = "";
		
		if(d.CS_ApproveWebSite != undefined)
		{
			for(let i in d.CS_ApproveWebSite)
			{
				Tr += `<tr>
					<td>${d.CS_ApproveWebSite[i]}</td>
					<td><span class="del">Delete</span></td>
				</tr>`
			}
		}
		$("#Table").html(`
			<div class="ro-wr">
				<div class="Main2 text-medium mb-25">List of approved sites</div>
				<p class="text-center mb-25 fw-400">Here you can manage your <span class="green">approved</span> sites</p>
			</div>
			<div class="ro-wr">
				<table border cellpadding="10">
					<thead>
						<th>
							Sites
						</th>
						<th>
							Action 
						</th>
					</thead>
					<tbody>
						${Tr}
					</tbody>
				</table>
			</div>
		`)
		$(".del").on("click",(event) => {
			console.log(event);
			chrome.storage.local.get(["CS_ApproveWebSite"], d =>{
				if(d.CS_ApproveWebSite != undefined)
				{
					for(let i in d.CS_ApproveWebSite)
					{
						if(d.CS_ApproveWebSite[i] === $(event.target).parents("tr").children()[0].innerText){
							d.CS_ApproveWebSite.splice(i);
							chrome.storage.local.set({CS_ApproveWebSite:d.CS_ApproveWebSite});
							break;
						}
					}
				}
				RenderApprovedSite();
			});
		});
	});
}

function RenderMain()
{
	Url = CS_NET.Url; 
	Port = CS_NET.Port; 
	Mon = CS_NET.Mon; 
	$("body").html(`
		<header>
			<div class="top-line">
				<div class="logo">
					<img src="img/Logo.png" class="logoimg" id="logostart">
				</div>
				<div class="top-line-part2">
					<div class="login">
						<select id="CS_Net" class="button-c button100">
							<option value="main" Url="165.22.212.41" Port="18081" Mon="CreditsNetwork">CreditsNetwork</option>
							<option value="testnet" Url="165.22.212.41" Port="18081" Mon="testnet">TestNet</option>
						 </select>
					</div>
					<div class="burgmenu">
						<img src="img/menu.png" class="closed">
					</div>
				</div>
			</div>
			<div class="top-line3">
				<div id="Balance"></div><div class="refresh" id="UpdateBalance"><img src="img/RefreshImg.png" alt="RefreshImg"></div>
			</div>
			<div class="top-line2">
				<div class="wallets">Wallet's address</div>
				<div class="flex">
					<div class="text-blue" id="WalletKey">${Base58.encode(CS_PublicKey)}</div>
					<div><img id="CopyWalletKey"  src="img/CopyImg.png" alt="CopyImg"></div>
				</div>
			</div>
		</header>
		<div class="menu-bg"></div>
		<div id="Table" class="wrapper">
		</div>
		<footer>
			<span>Powered by Credits</span>
		</footer>
	`);
	$("#WalletKey").on("click",function(){
		chrome.tabs.create({url:`https://monitor.credits.com/${Mon}/account/${Base58.encode(CS_PublicKey)}`})
	})
	$("#logostart").on("click",RenderStart);
	$("#UpdateBalance").on("click",CheckBalance);
	$("#CopyWalletKey").on("click",CopyWalletKey);
	$(".burgmenu").on("click", function(){
		$('.menu').toggleClass('menu_active');
		$('.content').toggleClass('content_active');
		$('.menu-bg').toggleClass('flex')
	});
	RenderMenu();
	$(`#CS_Net [Url='${Url}']`).prop('selected', true);
	$("#CS_Net").on("change",function(){
		Url = $("#CS_Net :selected").attr("Url");
		Port = $("#CS_Net :selected").attr("Port");
		Mon = $("#CS_Net :selected").attr("Mon")
		chrome.storage.local.set({
			CS_NET: {
				Name:$("#CS_Net :selected").val()
				, Url:Url
				, Port:Port
				,Mon:Mon
			}
		});
		CheckBalance();
	});
	CheckBalance();
	RenderStart();
}

function RenderMenu()
{
	$(".menu-bg").after(`
	<div class="menu">
		<div class="menu-close">
			<div class="left-hr"></div>
			<div class="right-hr"></div>
		</div>
		<div class="menu-body">
		<nav class="menu-list">
			<div class="list-item"><a href="#" id="Main">Main</a></div>
			<div class="list-item"><a href="#" id="Tokens">Tokens</a></div>
			<div class="list-item"><a href="#" id="ApprovedSite">Approved sites</a></div>
		</nav>
		<a  class="blue LogOut button-blue2" id="LogOut">Log out</a>
		</div>
	</div>
	`);
	$("#Main").on("click",RenderStart);
	$("#Tokens").on("click",function(){chrome.tabs.create({url:`https://monitor.credits.com/${Mon}/accountTokens/${Base58.encode(CS_PublicKey)}`})});
	$("#ApprovedSite").on("click",RenderApprovedSite);
	$("#LogOut").on("click",LogOut);
	$(".menu-close").on("click", function(){
		$('.menu').toggleClass('menu_active');
		$('.content').toggleClass('content_active');
		$('.menu-bg').toggleClass('flex')
	});
	$(".menu-bg").on("click", function(){
		$('.menu').toggleClass('menu_active');
		$('.content').toggleClass('content_active');
		$('.menu-bg').toggleClass('flex')
	});
}

function RenderLogIn()
{
	$("body").html(`<header>
					<div class="top-line main_p">
						<div class="burgmenu">
						</div>
					</div>
				</header>
				<div class="mid-wrap">
					<div class="logo">
						<img src="img/Logo.png" class="logoimg">
					</div>
				</div>
				<div class="wrapper">
					<div class="login mb-25 justify-c-center">
						<span>Log in</span>
					</div>
					<div class="ro-wr">
						<label for="private">Private key</label>
						<input id="PrivateKey" class="info-in" placeholder="Put your private key here">
					</div>
					<div class="ro-wr">
						<label id="Error" class="red"></label>
					</div>
				</div>
				<div class="button-line loginPage">
					<div id="CrateKey" class="button-c">
						Create Wallet
					</div>
					<div id="LogIn" class="button-blue">
						Login
					</div>
				</div>
				<footer>
					<span>Powered by Credits</span>
				</footer>`);
			$("#LogIn").on("click",LogIn);
			$("#CrateKey").on("click",RenderApproveCreate);
}

function RenderAccDetails(){
	$("#Table").html(`
		<div class="Acc_details">
			<div class="ro-wr">
				<div class="text-medium">Account details</div>
			</div>
			<div class="ro-wr">
				<div id="Qr"></div>
			</div>
		</div>
		<div class="button-line">
			<div class="button-back" id="Back" style="width: 25%;">
				<img src="img/Arrow-left.png" alt=""> Back
			</div>
			<div class="button-c" id="SeeMonitor">See on Monitor</div>
			<div style="width: 20%;"></div>
		</div>
	`);
	new QRCode(document.getElementById("Qr"),{
		text: Base58.encode(CS_PublicKey),
		colorDark : "#000",
		colorLight : "#fff",
		width: 180,
		height: 180
	});
	$("#SeeMonitor").on("click",function(){chrome.tabs.create({url:`https://monitor.credits.com/${Mon}/account/${Base58.encode(CS_PublicKey)}`})})
	$("#Back").on("click",RenderStart)
};

function RenderCompliteTransaction(Obj){
	$('#Table').removeClass();
	$('#Table').toggleClass('wrapper');
	$("#Table").html(`
		<div class="ro-wr TrarsactionCompliteBox">
			<div class="mb-25">
				<img src="img/completeTransaction-Green.png" alt="completeTransaction">
			</div>
			<div class="mb-25 text-medium">Transaction was sent</div>
		</div>
		<div class="ro-wr">
			
		</div>
		<div class="ro-wr">
			<label for="public">Details</label>
			<label for="public"><span class="bblack">${Obj.Amount} CS</span></label>
			<label for="public">To</label>
			<label for="public"><span class="bblack">${Obj.Target}</span></label>
		</div>
		<div class="button-line">
			<div class="button-back" id="Back" style="width: 25%;">
				<img src="img/Arrow-left.png" alt=""> Main
			</div>
			<div class="button-c" id="SeeMonitor">See on Monitor</div>
			<div style="width: 20%;"></div>
		</div>
	`);
	$("#Ok").on("click",RenderStart);
};

function RenderStart(){
	$('#Table').html(`
		<div class="ro-wr">
			<div class="Main2 text-medium">Menu</div>
		</div>
		<div class="ro-wr mb-25">
			<div class="itemBox">
				<div id="MakeAPayment" class="item">
					<img src="img/TransImg1.png" alt="">
					<span>Transfer money</span>
				</div>
				<div id="RenderAccDetails" class="item">
					<img src="img/TransImg2.png" alt="">
					<span>Receive</span>
				</div>
			</div>
		</div>
		<div class="ro-wr">
			<div class="Main2 text-medium">History</div>
		</div>
		<div class="text-blue link-center" id="see_history_monitor">See on Monitor</div>
		`);
		$("#MakeAPayment").on("click",RenderMakeAPayment);
		$("#RenderAccDetails").on("click",RenderAccDetails)
		$("#see_history_monitor").on("click",function(){chrome.tabs.create({url:`https://monitor.credits.com/${Mon}/account/${Base58.encode(CS_PublicKey)}`})})
}

function Connectrequest(){
	$('body').html(`
		<header>
			<div class="top-line">
				<div class="logo">
					<img src="img/Logo.png" class="logoimg">
				</div>
				<div class="login">
					<span>Connect request</span>
				</div>
				<div class="burgmenu">
					<img src="img/menu.png" class="closed">
				</div>
			</div>
		</header>
		<div class="wrapper">
			<div class="menu-bg"></div>
				<div class="menu">
					<div class="menu-close">
						<div class="left-hr"></div>
						<div class="right-hr">
					</div>
				</div>
				<nav class="menu-list">
					<a href="#">Account</a>
					<a href="#">Tokens</a>
					<a href="#">TX history</a>
					<a href="#">Settings</a>
				</nav>
				<div class="button-blue2">Log out</div>
			</div>
			<div class="ro-wr">
				<label for="public">Website</label>
				<input type="text" id="public" name="public" class="info-in" placeholder="Put website here" value="www.credits.com">
			</div>
			<div class="ro-wr">
				<div class="text-blue">This website will be able to see public data</div>
				<div>
					Transaction historyThis connection request aims to protect you from maliciouswebsites. This site is requesting access to view Public dataon the Credits blockchain and to see public key.Make sureyou trust the sites you interact with. Your private key willalways remain safe inside the extension.
				</div>
			</div>
			<div class="ro-wr">
				<div class="text-blue">Block this website from getting access permanently</div>
			<div>You can always revoke access to website on the settings page</div>
		</div>
	</div>
	<div class="button-line">
		<div class="button-c">Cancel</div>
		<div class="button-blue">Connect</div>
	</div>`);
	$(".burgmenu").on("click", function(){
		$('.menu').toggleClass('menu_active');
		$('.content').toggleClass('content_active');
		$('.menu-bg').toggleClass('flex')
	});
	$(".menu-close").on("click", function(){
		$('.menu').toggleClass('menu_active');
		$('.content').toggleClass('content_active');
		$('.menu-bg').toggleClass('flex')
	});
	$(".menu-bg").on("click", function(){
		$('.menu').toggleClass('menu_active');
		$('.content').toggleClass('content_active');
		$('.menu-bg').toggleClass('flex')
	});
}

function RenderMakeAPayment(){
	$("#Table").html(`
		<div class="ro-wr">
			<div class="text-big">Create transaction</div>
		</div>
		<div class="ro-wr">
			<label>Receiver's address</label>
			<input id="TargetKey" class="info-in">
		</div>
		<div class="ro-wr">
			<label id="TargetKeyError" class="red"></label>
		</div>
		<div class="ro-wr">
			<label for="public">Asset</label>
			<select id="token" class="info-in">
				<option value="CS">CS</option>
			</select>
		</div>
		<div class="ro-wr">
			<label>Amount</label>
			<input id="Amount" class="info-in">
			<label>Fee about 0.9 CS</label>
		</div>
		<div class="ro-wr">
			<label id="AmountError" class="red"></label>
		</div>
		<div class="ro-wr">
			<label id="Error" class="red"></label>
		</div>
		<div class="button-line">
			<div class="button-back" id="Back" style="width: 25%;">
				<img src="img/Arrow-left.png" alt=""> Back
			</div>
			<div id="CreateTransaction" class="button-blue button-createTratsaction">
			   Send transaction
			</div>
			<div style="width: 20%;"></div>
		</div>
	`);
	$("#CreateTransaction").on("click",GenerateTrans);
	$("#Back").on("click",RenderStart)
};

function RenderConfirmPayment(obj)
{
	$(".wrapper").html(`
		<div class="ro-wr">
			<div class="text-big">Create transaction</div>
		</div>
		<div class="ro-wr">
			<label>Receiver's address</label>
			<div>${obj.Target}</div>
		</div>
		<div class="ro-wr">
			<label>Amount</label>
			<div>${obj.Amount}</div>
			<label>Fee about 0.9 CS</label>
		</div>
		<div class="ro-wr">
			<label id="Error" class="red"></label>
		</div>
		<div class="button-line">
			<div class="button-back" id="Back" style="width: 25%;">
				<img src="img/Arrow-left.png" alt=""> Back
			</div>
			<div id="ConfirmTransaction" class="button-blue button-createTratsaction">
			   Confirm Transaction
			</div>
			<div style="width: 20%;"></div>
		</div>
		`);
	$("#ConfirmTransaction").on("click",function(){
		SignCS.Connect().TransactionFlow(obj.Trans,function(r){
			if(r.status.code > 0)
			{
				$("#Error").html(r.status.message);
				return;
			}
			else
			{
				RenderCompliteTransaction(obj);
			}
		});
	});
	$("#Back").on("click",RenderMakeAPayment);
}

function Loader()
{
	$("body").append(`
		<div class="loader-layer" id="loader-container">
			<div class="loader-wrap">
				<div class="loader-inner">
					<div class="loader-label">Loading...</div>
					<div id="loader-animate"></div>
				</div>
			</div>
		</div>
	`);
	
}

function CheckApproveInCreate(){
	if($("#CheckAllow1").prop("checked") && $("#CheckAllow2").prop("checked"))
	{
		$("#ApproveCreate").bind("click",RenderCreatedAccount);
		$("#ApproveCreate").removeClass("disabled_b");
	}
	else
	{
		$("#ApproveCreate").unbind("click");
		$("#ApproveCreate").addClass("disabled_b");
	}
	CreateKey
}

function LogIn()
{
	CS_PrivateKey = $("#PrivateKey").val();
	if(CS_PrivateKey == "")
	{
		$("#Error").html("Private key must not be empty");
		return;
	}
	
	let Keys = nacl.sign.keyPair.fromSecretKey(Base58.decode(CS_PrivateKey))
	
	CS_PublicKey = Keys.publicKey
	CS_PrivateKey = Keys.secretKey
	
	chrome.storage.local.set({CS_PrivateKey: Base58.encode(CS_PrivateKey), CS_PublicKey: Base58.encode(CS_PublicKey)});
	main();
}

function CloseLoader()
{
	let Loader = document.getElementById("loader-container");
	if(Loader !== null)
	{
		Loader.remove();
	}
}

function GenerateTrans()
{
	$("#TargetKey").removeClass("no-validate");
	$("#TargetKeyError").html("");
	$("#Amount").removeClass("no-validate");
	$("#AmountError").html("");
	
	let Target = $("#TargetKey").val();
	if(Target == "")
	{
		$("#TargetKey").addClass("no-validate");
		$("#TargetKeyError").html("Receiver's address must not be empty")
		return;
	}
	
	let Amount = $("#Amount").val();
	if(Amount == "")
	{
		$("#Amount").addClass("no-validate");
		$("#AmountError").html("Amount must not be empty")
		return;
	}
	
	let Trans = SignCS.CreateTransaction({
		Source: CS_PublicKey,
		Target: Target,
		PrivateKey: CS_PrivateKey,
		Amount: Amount
	});
	
	if(Trans.Result == null)
	{
		$("#Error").html(Trans.Message)
		return;
	}
	
	RenderConfirmPayment({Trans: Trans.Result,Amount:Amount,Target:Target});
}

function LogOut()
{
	chrome.storage.local.clear();
	RenderLogIn();
}

function CreateKey()
{
}

function CheckBalance()
{
	console.log("CheckBalance");
	Loader();
	SignCS.Connect().WalletBalanceGet(CS_PublicKey,function(r){
		if(r == null)
		{
			CloseLoader();
			console.log('not connected');
			return;
		}
		if(r.status == null)
		{
			CloseLoader();
			console.log('no status');
			return;
		}

		if(r.status.code > 0)
		{
			CloseLoader();
			if(r.status.message != "Not found"){
				console.log('Not found');
			}
			$("#Error").html(r.status.message);
			return;
		}
		else
		{
			CloseLoader();
			$("#Balance").html(Math.round((r.balance.integral + r.balance.fraction * Math.pow(10,-18)) * 1000) / 1000 + " CS")
		}

	});
}

function CopyWalletKey() {
	let key = document.querySelector('#WalletKey');
	let range = document.createRange();
	range.selectNode(key);
	let selection = window.getSelection();
	if (selection.rangeCount > 0) {
		selection.removeAllRanges();
	}
	selection.addRange(range); 
	console.log(document.execCommand('copy'));
	selection.removeAllRanges();
}



function DownloadFile(filename, text) {
	var element = document.createElement('a');
	element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
	element.setAttribute('download', filename);

	element.style.display = 'none';
	document.body.appendChild(element);

	element.click();

	document.body.removeChild(element);
}