


	let s = document.createElement('script');
	s.src = chrome.runtime.getURL('js/Api.js');
	s.onerror = function(){console.log("Onerro")}
	document.head.appendChild(s,document.head.firstChild);
	
	let i = document.createElement("input");
	i.type = "hidden";
	i.value = chrome.runtime.id;
	i.id = "CS_Extension_Id"
	
	document.body.appendChild(i);