chrome.runtime.sendMessage('Api');

chrome.runtime.onMessage.addListener((m, s, c) => {
	if(m.method !== undefined && m.method === "CS_Extension_AddWebsite")
	{
		if(document.getElementById("CS_Extension_AddWebsite") == null){
			let Shutter = document.createElement("div");
			Shutter.id = "CS_Extension_AddWebsite";
			Shutter.style = `top: 0;left: 0;width: 100%;height: 100%;z-index: 1042;overflow: auto;position: fixed;background: rgba(11,11,11, .8);`
			
		
			let Back = document.createElement("div");
			Back.style = `box-sizing: border-box;background-color: #fff;font-size: 16px;z-index: 1142;color: #000;font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif,'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol';font-size: 14px;font-weight: 300;line-height: 1.3;text-align: left;width:350px;border:1px solid #e5e5e5;border-radius:4px; margin: 10px auto`;
			Shutter.appendChild(Back);
			
			let header = document.createElement("header");
			header.style = `box-sizing: border-box;padding: 12px 10px;background-color: #e5e5e5;`;
			Back.appendChild(header);
			
			let div = document.createElement("div");
			div.style = `box-sizing: border-box;display: -webkit-box;display: -ms-flexbox;display: flex;-ms-flex-wrap: wrap;flex-wrap: wrap;justify-content: space-between;align-items:center;`;
			header.appendChild(div);
			
			let el = document.createElement("div");
			div.appendChild(el);
			
			let img = document.createElement("img");
			img.src = chrome.runtime.getURL('img/Logo.png');
			img.style = `box-sizing: border-box;width:100%;max-width:45px;height:auto;`;
			el.appendChild(img);
			
			el = document.createElement("div");
			el.style = `box-sizing: border-box;font-size: 30px;font-weight: 200;display: flex;flex-direction: row;align-content: center;`;
			div.appendChild(el);
			
			let span = document.createElement("span");
			span.innerText = "Connect request";
			el.appendChild(span);
			
			div = document.createElement("div");
			div.style = `box-sizing: border-box;padding-top: 30px;padding-bottom: 0;padding-left: 20px;padding-right: 20px;`;
			Back.appendChild(div);
			
			let div2 = document.createElement("div");
			div2.style = `box-sizing: border-box;margin-bottom: 30px;`;
			div.appendChild(div2);
			
			let label = document.createElement("label");
			label.style = `box-sizing: border-box;font-size: 12px;color: #1b1b1b;font-weight: 200;display: block;margin-bottom: 10px;`;
			label.innerText = "Website";
			div2.appendChild(label);
			
			let input = document.createElement("input");
			input.id = "CS_Extension_AddWebsite_Domen";
			input.value = m.url;
			input.style = `    box-sizing: border-box;font-size: 16px;color: #187cf1;width: 100%;padding: 15px 6px;border: 1px solid #e5e5e5;border-radius: 4px;outline: none;text-overflow: ellipsis;`;
			div2.appendChild(input);
			
			div2 = document.createElement("div");
			div2.style = `box-sizing: border-box;margin-bottom: 30px;`;
			div.appendChild(div2);
			
			let div3 = document.createElement("div");
			div3.style = `box-sizing: border-box;color: #177bf0;margin-bottom: 10px;`;
			div3.innerText = `This website will be able to see public data`;
			div2.appendChild(div3);
			
			div3 = document.createElement("div");
			div3.innerText = `Transaction historyThis connection request aims to protect you from maliciouswebsites. This site is requesting access to view Public dataon the Credits blockchain and to see public key.Make sureyou trust the sites you interact with. Your private key willalways remain safe inside the extension.`;
			div2.appendChild(div3);
			
			div2 = document.createElement("div");
			div2.style = `box-sizing: border-box;margin-bottom: 30px;`;
			div.appendChild(div2);
			
			div3 = document.createElement("div");
			div3.style = `box-sizing: border-box;color: #177bf0;margin-bottom: 10px;`;
			div3.innerText = `Block this website from getting access permanently`;
			div2.appendChild(div3);
			
			div3 = document.createElement("div");
			div3.innerText = `You can always revoke access to website on the settings page`;
			div2.appendChild(div3);
			
			div = document.createElement("div");
			div.style = `box-sizing: border-box;padding: 24px 12px;width: 100%;text-align: center;display: flex;justify-content: space-between;align-items: center;`;
			Back.appendChild(div);
			
			div2 = document.createElement("div");
			div2.style = `box-sizing: border-box;font-size: 18px;padding: 15px;line-height: 1.2;border: 1px solid rgb(0, 0, 0);background: transparent;border-radius: 4px;color: rgb(0, 0, 0);cursor: pointer;transition: all 0.3s ease 0s;width: calc(50% - 6px);`;
			div2.onmouseenter = function(){this.style.color ='#fff';};
			div2.onmouseover = function(){this.style.backgroundColor ='#000';};
			div2.onmouseout = function(){this.style.color ='#000';};
			div2.onmouseleave = function(){this.style.backgroundColor ='transparent';};
			div2.onclick = function(){ document.getElementById("CS_Extension_AddWebsite").remove(); };
			div2.innerText = "Cancel";
			div2.id = "CS_Extension_AddWebsite_Cancel";
			div.appendChild(div2);
			
			div2 = document.createElement("div");
			div2.style = `box-sizing: border-box;font-size: 18px;padding: 15px;line-height: 1.2;border: 1px solid rgb(23, 123, 240);color: rgb(255, 255, 255);background-color: rgb(23, 123, 240);border-radius: 4px;cursor: pointer;transition: all 0.3s ease 0s;width: calc(50% - 6px);`;
			div2.onmouseenter = function(){this.style.color ='#177bf0';};
			div2.onmouseover = function(){this.style.backgroundColor ='#fff';};
			div2.onmouseout = function(){this.style.color ='#fff';};
			div2.onmouseleave = function(){this.style.backgroundColor ='#177bf0';};
			div2.onclick = function(){ 
				chrome.runtime.sendMessage("CS_Extension_AddWebSite_Confirm", r => {
					document.getElementById("CS_Extension_AddWebsite").remove();
				});
			};
			div2.innerText = "Confirm";
			div2.id = "CS_Extension_AddWebsite_Confirm";
			div.appendChild(div2);
			
			document.getElementsByTagName("body")[0].appendChild(Shutter);
		}
	}
});