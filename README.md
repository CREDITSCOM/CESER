# CESER

CESER - is the decentralized application working like a browser's extension connecting with the blockchain Credits. It allows you to connect directly to the network without entering a password on the sites increasing the security and usability. Create wallets and make transfers.

The goal of CESER (browser extension for Google Chrome & Opera) is to provide more secure and convenient user experience of websites based on Credits. In particular, it manages accounts and connects users to blockchain. Here are some CESER’s features:

• Allows users to manage their accounts and their keys with no context interaction of the site.

• Connects to nodes from different networks remotely. Fast synchronization with no need of waiting. 

## Supported operations 
**User registration using a private key**

* Press the “CS Extension” button in a browser

![button_extension](https://user-images.githubusercontent.com/50901107/58318025-ffd9f380-7de4-11e9-9174-9753a2028fa2.png)

The window will pop up

![pic_2](https://user-images.githubusercontent.com/50901107/58317441-bfc64100-7de3-11e9-9f84-fc19ec818acf.png)

**1. If you have a private key**

Type your private key into the “Private Key” field and press the "Login" button.

**2. If you don’t have your private key**

Press “Create Key” button. The “key.json” file will be downloaded along with both public and private keys. Next, repeat the step from “1. If you have a private key” option. 

* Click the “Login” button. The following window will open: 

![Group 3](https://user-images.githubusercontent.com/50901107/58317833-9d80f300-7de4-11e9-82de-1fb18b7befaf.png)

## Transaction Creation
 
In order to create a transaction, click the “Make a transaction” button. The window view: 

![make_a _transaction](https://user-images.githubusercontent.com/50901107/58318656-349a7a80-7de6-11e9-96b7-ad03b80c28e5.png)

## Fill out the fields in order to create and send a transaction.

1. Receiver’s address

2. Asset (choose a token type)

3. Amount (number of coins to be transferred) 

* Press the “Send transaction” button. If all information was entered correctly, then the following window will be displayed asking to confirm a transaction.

![confirm_transaction](https://user-images.githubusercontent.com/50901107/58319405-d7072d80-7de7-11e9-8868-22de45656e9f.png)

* Confirm the transaction by pressing the “Confirm Transaction” button. It can be seen that the transaction was send successfully:

![succesful transaction](https://user-images.githubusercontent.com/50901107/58319680-1a619c00-7de8-11e9-9801-42c86dcef029.png)

# Account Information

After pressing the “Receive” button

![recieve_button](https://user-images.githubusercontent.com/50901107/58320099-ea66c880-7de8-11e9-9062-6ecd4eb4fe4d.png)

It will take you to 

![account_details](https://user-images.githubusercontent.com/50901107/58320228-36b20880-7de9-11e9-8250-a1009a18ce51.png)

Here you can see account details. Also, information can be found through QRCode or the monitor page by clicking the “See on Monitor” button. 

# Guide For Developers

**Download & Install** 

To start developing apps using CESER , you can download it here. The object “CreditsExtension” will appear in your console after installing the extension.

**Run up a check on availability of the installed extension (example)**
```
if(typeof CreditsExtension === "object")

{
	//Code

}else{

	// error processing 
}
```
## Set of functions for sending extension calls

**CreditsExtension.authorization(callBack)**

• Checks user authorization in extension 

• Awaits the ```callBack(response)``` function

• Object is going to be passed to ```response``` function:
```
{
	message,

        result
}
```

• If ```result``` is ```undefined```, there will be a description of an error in ```message```

• ```result``` is going to have a boolean value with a checking result.

## **Example**
```
CreditsExtension.authorization(r => {

if(r.result === undefined){
	alert(r.message);
return;
}
if(r.result)
{
		alert(“user is authorized”)
}else{
	alert(“user is not authorized”)
}
})
```
## CreditsExtension.balanceGet(Obj,callBack)

• Returns balance by a public key

• The object type will be passed to ```response``` variable (callBack)
```
{
        message,
        result:{
	Credits_CS - CS user’s balance in a chosen network 
}
}

```

•	If ```result``` is ```undefined```,  there will be a description of an error in ```message```

•	```result``` is going to have a boolean value with a checking result

•	Obj looks like:
```
{
	Key: public key whose data is requested 
}
```
**Can be undefined**

If a key is not specified or Obj is _undefined_, then the balance of authorized wallet is going to be returned.

## Call Examples

CreditsExtension.balanceGet(undefined,callBack)

CreditsExtension.balanceGet({},callBack)

CreditsExtension.balanceGet({Key:”Requested key”},callBack)

## Example
```
CreditsExtension.balanceGet({Key:”Requested key”},r => {
if(r.result === undefined){
	alert(r.message);
return;
}
// code
})
```

CreditsExtension.getHistory(Obj,callBack)

•	Returns transaction history by a public key

•	object Obj has a form of: 
```
{
	Page: page number,
	Size: number of transactions per on page,
	Key: public key whose transactions will be returned. If the key is not specified, transactions of an authorized user will be returned. 

}
```

function ```callBack(response)```

The objects will be passed to ```response``` as: 
```
{
	message,
        result
}
```
•	If ```result``` is ```undefined```,  there will be a description of an error in message

•	```result``` will contain an array from object type 
```
{
	id -transaction ID,
	amount – amount transfer in CS,
	fee – transaction fee (commission) in CS,
	source – transaction sender’s public key 
	target - transaction receiver's public key 
	smartContract – smart contract information in a transaction
	smartInfo – smart contract condition information
}
```
## Call examples:

* CreditsExtension.getHistory({Page:0,Size:100},callBack)

* CreditsExtension.getHistory({Page:0,Size:100,Key:Public key},callBack)

## Example
```
CreditsExtension.getHistory({Page:0,Size:100}, r => {

if(r.result === undefined){
	alert(r.message);
return;
}
console.log(r.result);
});
```

## CreditsExtension.compiledSmartContractCode(Code,callBack)

Compiles a smart contract and reports compilation errors if those are found.

• line Code – smart contract code
• function callBack(response)
• The object will be passed to response as:

```
{
	message,
        result
}
```

• If ```result``` is ```undefined```, there will be a description of an error in ```message```
• ```result``` will contain an array from object type 
```
{
	name – class name,
	byteCode – line with a byte code of a smart contract. 
}
```

## Example
```
CreditsExtension.compiledSmartContractCode(“Code”, r => {
if(r.result === undefined){
	alert(r.message);
return;
}
console.log(r.result);
});
```
## CreditsExtension.sendTransaction(Transaction,callBack)

• Sends a transaction to blockchain;

• function callBack(response)

• The object will be passed to response as:
```
{
	message,
        result
}
```
If ```result``` is ```undefined```, there will be a description of an error in ```message```

To send a transaction for a CS transfer, the Transaction object must have the following form:
```
{
            Target: Receiver’s public key ,
            Amount: Amount Transfer,
            Fee: Maximum transfer fee. If there is no value specified, an approximate amount of fee will be set in order 
            to complete the transaction.  

}
```

## Example
```
CreditsExtension.sendTransaction({
Target: Public key,
Amount: “1.2”,
Fee: “0.1”
},r => {
if(r.result === undefined){
	alert(r.message);
return;
}
console.log(r.result);
});
```

To complete the smart contract method, the Transaction object must have the following form:
```
{
Target: Receiver’s public key ,
            Fee: Maximum transfer fee. If not specified, then 

	    SmartContract:
{
            Params – parameters being passed to a method, array objects as: 
{
	    K – data types (can be “STRING”, ”INT”, ”BOOL” ),
	    V – transmitted data
}           The sequence of array corresponds to the sequence of arguments in the method.
            Method – called method of a smart contract,
}
}
```
## Example
```
CreditsExtension.sendTransaction({
Target: Smart contract’s public key
Fee: “0.1”,
SmartContract:
{
	Params: [
	{K:“STRING”, V: “Test”},
	{K:“INT”, V: 2},
	{K:“BOOL”, V: true},
],
Method: “Test”
}
},r => {
if(r.result === undefined){
	alert(r.message);
return;
}
console.log(r.result);
});
```

**In order to deploy smart contract, the Transaction object must have the following form:**
 ```
{
            Fee: Maximum transfer fee. If not specified, then 

	    SmartContract:
{
            Сode: Smart contract code
}
}
```
## Example
```
CreditsExtension.sendTransaction({
            Fee: “0.9”,
	SmartContract:
{
            Сode: “Code”
}
},r => {
if(r.result === undefined){
	alert(r.message);
return;
}
console.log(r.result);
});
```























 

