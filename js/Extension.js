var CS_PublicKey,Mon,CS_PrivateKey,Url,Port;

(function () {
    function CreateTransaction(Obj) {
        let DefObj = {
            _connect: Connect(),
            Source: "",
            Target: "",
            PrivateKey: "",
            Amount: "0.0",
            Fee: "0.9",
            SmartContract: undefined,
            TransactionObj: undefined,
            UserData: undefined
        };

        let DefSmart = {
            Params: undefined,
            Method: undefined,
            Code: undefined,
            NewState: false
        };

        /*
            Params = [
                {K: "STRING",V: "Valuw"}
            ] 

            List approved keys:
            STRING
        */

        let ResObj = {
            Message: null,
            Result: null
        };

        for (let i in DefObj) {
            if (Obj[i] === undefined) {
                Obj[i] = DefObj[i];
            }
        }

        if (Obj.SmartContract !== undefined) {
            for (let i in DefSmart) {
                if (Obj.SmartContract[i] === undefined) {
                    Obj.SmartContract[i] = DefSmart[i];
                }
            }
        }

        Obj.Amount = String(Obj.Amount).replace(',', '.');
        Obj.Fee = String(Obj.Fee).replace(',', '.');

        let Trans;

        if (Obj.TransactionObj === undefined) {
            Trans = new Transaction();
        }
        else {
            Trans = Obj.TransactionObj;
        }

        let Source = CheckStrTransaction(Obj.Source, "Source");
        if (Source.R === undefined) {
            ResObj.Message = Source.M;
            return ResObj;
        }
        else {
            Trans.source = Source.R;
        }

        let Private = CheckStrTransaction(Obj.PrivateKey, "Private");
        if (Private.R === undefined) {
            ResObj.Message = Private.M;
            return ResObj;
        }
        else {
            Private = Private.R;
        }

        let TRes = Obj._connect.WalletTransactionsCountGet(Trans.source);
        if (TRes.status.code === 0) {
            Trans.id = TRes.lastTransactionInnerId + 1;
        }
        else {
            ResObj.Message = TRes.status.message;
            return ResObj;
        }

        if (Obj.SmartContract !== undefined && Obj.SmartContract.Code !== undefined) {
            let Target = Trans.source;
            Target = concatTypedArrays(Target, NumbToByte(Trans.id, 6));
            let ByteCode = Obj._connect.SmartContractCompile(Obj.SmartContract.Code);
            if (ByteCode.status.code === 0) {
                for (let i in ByteCode.byteCodeObjects) {
                    Target = concatTypedArrays(Target, ConvertCharToByte(ByteCode.byteCodeObjects[i].byteCode));
                }
            }
            else {
                ResObj.Message = ByteCode.status.message;
                return ResObj;
            }

            Trans.target = blake2s(Target);
        }
        else {
            let Target = CheckStrTransaction(Obj.Target, "Target");
            if (Target.R === undefined) {
                ResObj.Message = Target.M;
                return ResObj;
            }
            else {
                Trans.target = Target.R;
            }
        }

        Trans.amount = new Amount({
            integral: Math.trunc(Obj.Amount),
            fraction: 0
        });
        if (Obj.Amount.split(".").length > 1) {
            Trans.amount.fraction = Number("0." + Obj.Amount.split(".")[1]) * Math.pow(10, 18);
        }

        let F = Fee(Obj.Fee);
        let FE = NumbToBits(F.exp);
        while (FE.length < 5) {
            FE = "0" + FE;
        }
        let FM = NumbToBits(F.man);
        while (FM.length < 10) {
            FM = "0" + FM;
        }

        Trans.fee = new AmountCommission({
            commission: BitsToNumb("0" + FE + FM)
        });

        Trans.currency = 1;

        let PerStr = NumbToByte(Trans.id, 6);
        PerStr = concatTypedArrays(PerStr, Trans.source);
        PerStr = concatTypedArrays(PerStr, Trans.target);
        PerStr = concatTypedArrays(PerStr, NumbToByte(Trans.amount.integral, 4));
        PerStr = concatTypedArrays(PerStr, NumbToByte(Trans.amount.fraction, 8));
        PerStr = concatTypedArrays(PerStr, NumbToByte(Trans.fee.commission, 2));
        PerStr = concatTypedArrays(PerStr, new Uint8Array([1]));

        if (Obj.SmartContract === undefined && Obj.UserData === undefined) {
            PerStr = concatTypedArrays(PerStr, new Uint8Array(1));
        }
        else if (Obj.SmartContract !== undefined) {
            PerStr = concatTypedArrays(PerStr, new Uint8Array([1]));

            let UserField = new Uint8Array();

            Trans.smartContract = new SmartContractInvocation();

            UserField = concatTypedArrays(UserField, new Uint8Array([11, 0, 1]));
            if (Obj.SmartContract.Method === undefined) {
                UserField = concatTypedArrays(UserField, new Uint8Array(4));
            }
            else {
                Trans.smartContract.method = Obj.SmartContract.Method;
                UserField = concatTypedArrays(UserField, NumbToByte(Obj.SmartContract.Method.length, 4).reverse());
                UserField = concatTypedArrays(UserField, ConvertCharToByte(Obj.SmartContract.Method));
            }

            UserField = concatTypedArrays(UserField, new Uint8Array([15, 0, 2, 12]));
            if (Obj.SmartContract.Params === undefined) {
                UserField = concatTypedArrays(UserField, new Uint8Array(4));
            }
            else {
                Trans.smartContract.params = [];
                UserField = concatTypedArrays(UserField, NumbToByte(Obj.SmartContract.Params.length, 4).reverse());
                for (let i in Obj.SmartContract.Params) {
                    let val = Obj.SmartContract.Params[i];

                    switch (val.K) {
                        case "STRING":
                            UserField = concatTypedArrays(UserField, new Uint8Array([11, 0, 17]));
                            UserField = concatTypedArrays(UserField, NumbToByte(val.V.length, 4).reverse());
                            UserField = concatTypedArrays(UserField, ConvertCharToByte(val.V));
                            Trans.smartContract.params.push(new Variant({ v_string: val.V }));
                            UserField = concatTypedArrays(UserField, new Uint8Array(1));
                            break;
                        case "INT":
                            UserField = concatTypedArrays(UserField, new Uint8Array([8, 0, 9]));
                            UserField = concatTypedArrays(UserField, NumbToByte(val.V, 4).reverse());
                            Trans.smartContract.params.push(new Variant({ v_int: val.V }));
                            UserField = concatTypedArrays(UserField, new Uint8Array(1));
                            break;
                        case "BOOL":
                            UserField = concatTypedArrays(UserField, new Uint8Array([2, 0, 3]));
                            UserField = concatTypedArrays(UserField, new Uint8Array(1));
                            if (val.V) {
                                UserField[UserField.length - 1] = 1;
                            }
                            Trans.smartContract.params.push(new Variant({ v_boolean: val.V }));
                            UserField = concatTypedArrays(UserField, new Uint8Array(1));
                            break;
                    }
                }
            }

            UserField = concatTypedArrays(UserField, new Uint8Array([15, 0, 3, 11, 0, 0, 0, 0]));

            Trans.smartContract.forgetNewState = Obj.SmartContract.NewState;
            UserField = concatTypedArrays(UserField, new Uint8Array([2, 0, 4, 0]));
            if (Obj.SmartContract.NewState) {
                UserField[UserField.length - 1] = 1;
            }

            if (Obj.SmartContract.Code !== undefined) {
                UserField = concatTypedArrays(UserField, new Uint8Array([12, 0, 5, 11, 0, 1]));

                Trans.smartContract.smartContractDeploy = new SmartContractDeploy({
                    sourceCode: Obj.SmartContract.Code
                });

                UserField = concatTypedArrays(UserField, NumbToByte(Obj.SmartContract.Code.length, 4).reverse());
                UserField = concatTypedArrays(UserField, ConvertCharToByte(Obj.SmartContract.Code));

                UserField = concatTypedArrays(UserField, new Uint8Array([15, 0, 2, 12]));
                let ByteCode = Obj._connect.SmartContractCompile(Obj.SmartContract.Code);


                if (ByteCode.status.code === 0) {
                    Trans.smartContract.smartContractDeploy.byteCodeObjects = [];
                    UserField = concatTypedArrays(UserField, NumbToByte(ByteCode.byteCodeObjects.length, 4).reverse());

                    for (let i in ByteCode.byteCodeObjects) {


                        let val = ByteCode.byteCodeObjects[i];
                        UserField = concatTypedArrays(UserField, new Uint8Array([11, 0, 1]));
                        UserField = concatTypedArrays(UserField, NumbToByte(val.name.length, 4).reverse());
                        UserField = concatTypedArrays(UserField, ConvertCharToByte(val.name));

                        UserField = concatTypedArrays(UserField, new Uint8Array([11, 0, 2]));
                        UserField = concatTypedArrays(UserField, NumbToByte(val.byteCode.length, 4).reverse());
                        UserField = concatTypedArrays(UserField, ConvertCharToByte(val.byteCode));
                        Trans.smartContract.smartContractDeploy.byteCodeObjects.push(new ByteCodeObject({
                            name: val.name,
                            byteCode: val.byteCode
                        }));
                        UserField = concatTypedArrays(UserField, new Uint8Array(1));
                    }
                }
                else {
                    ResObj.Message = ByteCode.Status.Message;
                    return ResObj;
                }

                UserField = concatTypedArrays(UserField, new Uint8Array([11, 0, 3, 0, 0, 0, 0, 8, 0, 4, 0, 0, 0, 0, 0]));
            }

            UserField = concatTypedArrays(UserField, new Uint8Array(1));
            PerStr = concatTypedArrays(PerStr, NumbToByte(UserField.length, 4));
            PerStr = concatTypedArrays(PerStr, UserField);
        }
        else if (Obj.UserData !== undefined)
        {
            let UserField = concatTypedArrays(new Uint8Array([1]), NumbToByte(Obj.UserData.length,4));
            UserField = concatTypedArrays(UserField, ConvertCharToByte(Obj.UserData));
            PerStr = concatTypedArrays(PerStr, UserField);
            Trans.userFields = ConvertCharToByte(Obj.UserData);
        }



        var ArHex = "0123456789ABCDEF";
        var Hex = "";
        for (let j = 0; j < PerStr.length; j++) {
            Hex += ArHex[Math.floor(PerStr[j] / 16)];
            Hex += ArHex[Math.floor(PerStr[j] % 16)];
        }
        console.log(Hex);

        Trans.signature = nacl.sign.detached(PerStr, Private);
        console.log(Trans);
        ResObj.Result = Trans;
        return ResObj;
    }

    function ConvertCharToByte(Str) {
        let B = new Uint8Array(Str.length);
        for (let i in Str) {
            B[i] = Str[i].charCodeAt();
        }
        return B;
    }

    function CheckStrTransaction(Field, FieldName) {
        let Res = {
            M: "",
            R: undefined
        };

        if (Field === "") {
            Res.M = `${FieldName} is not found`;
            return Res;
        }
        else {
            if (typeof Field === "string") {
                try {
                    Res.R = Base58.decode(Field);
                } catch (e) {
                    Res.M = `${FieldName} is not valid`;
                }
            }
            else {
                Res.R = Field;
            }
        }
        return Res;
    }

    function NumbToBits(int) {
        let Bits = "";

        let numb = String(int);
        while (true) {
            Bits = (numb % 2) + Bits;
            numb = Math.floor(numb / 2);

            if (numb <= 1) {
                Bits = numb + Bits;
                break;
            }
        }

        return Bits;
    }

    function BitsToByts(Bits) {
        let Lng = 0;
        if (Bits.length % 8 === 0) {
            Lng = Math.floor(Bits.length / 8);
        } else {
            Lng = Math.floor(Bits.length / 8) + 1;
        }

        let Byts = new Uint8Array(Lng);
        let Stage = 1;
        let i = Bits.length - 1;
        while (true) {
            if (Math.floor(((i + 1) % 8)) === 0) {
                Stage = 1;
            }
            Byts[Math.floor(i / 8)] += Stage * Bits[i];
            Stage *= 2;
            if (i === 0) {
                break;
            }
            i -= 1;
        }

        return Byts;
    }

    function BitsToNumb(Bits) {
        let numb = 0;
        let mnoj = 1;
        for (var i = Bits.length - 1; i > 0; i -= 1) {
            if (Bits[i] !== 0) {
                numb += mnoj * Bits[i];
            }
            mnoj *= 2;
        }
        return numb;
    }

    function GetBitArray(n, i) {
        var Ar = new Uint8Array(i);
        for (var index in Ar) {
            Ar[index] = index > 0 ? (n >> index * 8) & 0xFF : n & 0xFF;
        }
        return Ar;
    }

    function concatTypedArrays(a, b) {
        var c = new (Uint8Array.prototype.constructor)(a.length + b.length);
        c.set(a, 0);
        c.set(b, a.length);
        return c;
    }

    (function () {
        var ALPHABET, ALPHABET_MAP, Base58, i;

        Base58 = (typeof module !== "undefined" && module !== null ? module.exports : void 0) || (window.Base58 = {});

        ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

        ALPHABET_MAP = {};

        i = 0;

        while (i < ALPHABET.length) {
            ALPHABET_MAP[ALPHABET.charAt(i)] = i;
            i++;
        }

        Base58.encode = function (buffer) {
            var carry, digits, j;
            if (buffer.length === 0) {
                return "";
            }
            i = void 0;
            j = void 0;
            digits = [0];
            i = 0;
            while (i < buffer.length) {
                j = 0;
                while (j < digits.length) {
                    digits[j] <<= 8;
                    j++;
                }
                digits[0] += buffer[i];
                carry = 0;
                j = 0;
                while (j < digits.length) {
                    digits[j] += carry;
                    carry = (digits[j] / 58) | 0;
                    digits[j] %= 58;
                    ++j;
                }
                while (carry) {
                    digits.push(carry % 58);
                    carry = (carry / 58) | 0;
                }
                i++;
            }
            i = 0;
            while (buffer[i] === 0 && i < buffer.length - 1) {
                digits.push(0);
                i++;
            }
            return digits.reverse().map(function (digit) {
                return ALPHABET[digit];
            }).join("");
        };

        Base58.decode = function (string) {
            var bytes, c, carry, j;
            if (string.length === 0) {
                return new (typeof Uint8Array !== "undefined" && Uint8Array !== null ? Uint8Array : Buffer)(0);
            }
            i = void 0;
            j = void 0;
            bytes = [0];
            i = 0;
            while (i < string.length) {
                c = string[i];
                if (!(c in ALPHABET_MAP)) {
                    throw "Base58.decode received unacceptable input. Character '" + c + "' is not in the Base58 alphabet.";
                }
                j = 0;
                while (j < bytes.length) {
                    bytes[j] *= 58;
                    j++;
                }
                bytes[0] += ALPHABET_MAP[c];
                carry = 0;
                j = 0;
                while (j < bytes.length) {
                    bytes[j] += carry;
                    carry = bytes[j] >> 8;
                    bytes[j] &= 0xff;
                    ++j;
                }
                while (carry) {
                    bytes.push(carry & 0xff);
                    carry >>= 8;
                }
                i++;
            }
            i = 0;
            while (string[i] === "1" && i < string.length - 1) {
                bytes.push(0);
                i++;
            }
            return new (typeof Uint8Array !== "undefined" && Uint8Array !== null ? Uint8Array : Buffer)(bytes.reverse());
        };

    }).call(this);


    function B2S_GET32(v, i) {
        return v[i] ^ (v[i + 1] << 8) ^ (v[i + 2] << 16) ^ (v[i + 3] << 24)
    }

    function B2S_G(a, b, c, d, x, y) {
        v[a] = v[a] + v[b] + x
        v[d] = ROTR32(v[d] ^ v[a], 16)
        v[c] = v[c] + v[d]
        v[b] = ROTR32(v[b] ^ v[c], 12)
        v[a] = v[a] + v[b] + y
        v[d] = ROTR32(v[d] ^ v[a], 8)
        v[c] = v[c] + v[d]
        v[b] = ROTR32(v[b] ^ v[c], 7)
    }

    function ROTR32(x, y) {
        return (x >>> y) ^ (x << (32 - y))
    }

    var BLAKE2S_IV = new Uint32Array([
        0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
        0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19])

    var SIGMA = new Uint8Array([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
        14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3,
        11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4,
        7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8,
        9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13,
        2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9,
        12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11,
        13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10,
        6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5,
        10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0])

    var v = new Uint32Array(16)
    var m = new Uint32Array(16)
    function blake2sCompress(ctx, last) {
        var i = 0
        for (i = 0; i < 8; i++) {
            v[i] = ctx.h[i]
            v[i + 8] = BLAKE2S_IV[i]
        }

        v[12] ^= ctx.t
        v[13] ^= (ctx.t / 0x100000000)
        if (last) {
            v[14] = ~v[14]
        }

        for (i = 0; i < 16; i++) {
            m[i] = B2S_GET32(ctx.b, 4 * i)
        }

        for (i = 0; i < 10; i++) {

            B2S_G(0, 4, 8, 12, m[SIGMA[i * 16 + 0]], m[SIGMA[i * 16 + 1]])
            B2S_G(1, 5, 9, 13, m[SIGMA[i * 16 + 2]], m[SIGMA[i * 16 + 3]])
            B2S_G(2, 6, 10, 14, m[SIGMA[i * 16 + 4]], m[SIGMA[i * 16 + 5]])
            B2S_G(3, 7, 11, 15, m[SIGMA[i * 16 + 6]], m[SIGMA[i * 16 + 7]])
            B2S_G(0, 5, 10, 15, m[SIGMA[i * 16 + 8]], m[SIGMA[i * 16 + 9]])
            B2S_G(1, 6, 11, 12, m[SIGMA[i * 16 + 10]], m[SIGMA[i * 16 + 11]])
            B2S_G(2, 7, 8, 13, m[SIGMA[i * 16 + 12]], m[SIGMA[i * 16 + 13]])
            B2S_G(3, 4, 9, 14, m[SIGMA[i * 16 + 14]], m[SIGMA[i * 16 + 15]])
        }

        for (i = 0; i < 8; i++) {
            ctx.h[i] ^= v[i] ^ v[i + 8]
        }
    }

    function blake2sInit(outlen, key) {
        if (!(outlen > 0 && outlen <= 32)) {
            throw new Error('Incorrect output length, should be in [1, 32]')
        }
        var keylen = key ? key.length : 0
        if (key && !(keylen > 0 && keylen <= 32)) {
            throw new Error('Incorrect key length, should be in [1, 32]')
        }

        var ctx = {
            h: new Uint32Array(BLAKE2S_IV),
            b: new Uint32Array(64),
            c: 0,
            t: 0,
            outlen: outlen
        }
        ctx.h[0] ^= 0x01010000 ^ (keylen << 8) ^ outlen

        if (keylen > 0) {
            blake2sUpdate(ctx, key)
            ctx.c = 64
        }

        return ctx
    }

    function blake2sUpdate(ctx, input) {
        for (var i = 0; i < input.length; i++) {
            if (ctx.c === 64) {
                ctx.t += ctx.c
                blake2sCompress(ctx, false)
                ctx.c = 0
            }
            ctx.b[ctx.c++] = input[i]
        }
    }

    function blake2sFinal(ctx) {
        ctx.t += ctx.c
        while (ctx.c < 64) {
            ctx.b[ctx.c++] = 0
        }
        blake2sCompress(ctx, true)

        var out = new Uint8Array(ctx.outlen)
        for (var i = 0; i < ctx.outlen; i++) {
            out[i] = (ctx.h[i >> 2] >> (8 * (i & 3))) & 0xFF
        }
        return out
    }

    function blake2s(input, key, outlen) {
        outlen = outlen || 32

        var ctx = blake2sInit(outlen, key)
        blake2sUpdate(ctx, input)
        return blake2sFinal(ctx)
    }

    function Fee(v) {
        let s = v > 0 ? 0 : 1;
        v = Math.abs(v);
        exp = v === 0 ? 0 : Math.log10(v);
        exp = Math.floor(exp >= 0 ? exp + 0.5 : exp - 0.5);
        v /= Math.pow(10, exp);
        if (v >= 1) {
            v *= 0.1;
            ++exp;
        }
        v = Number((v * 1024).toFixed(0));
        return { exp: exp + 18, man: v === 1024 ? 1023 : v };
    }

    function NumbToByte(numb, CountByte) {
        let InnerId = new Uint8Array(CountByte);
        numb = String(numb);
        let i = 1;
        let index = 0;
        while (true) {
            InnerId[index] += (numb % 2) * i;
            numb = Math.floor(numb / 2);
            if (numb === 0) {
                break;
            }
            if (numb === 1) {
                var b = (numb % 2) * i * 2;
                if (b === 256) {
                    ++InnerId[index + 1];
                } else {
                    InnerId[index] += (numb % 2) * i * 2;
                }
                break;
            }

            if (i === 128) {
                i = 1;
                index++;
            } else {
                i *= 2;
            }
        }
        return InnerId;
    }

    function Connect() {
        var transport = new Thrift.Transport("http://" + Url + ":" + Port + "/thrift/service/Api/");
        var protocol = new Thrift.Protocol(transport);
        return new APIClient(protocol);
    }
	
	function CommissionToNumb(c){
		let sign = c >> 15;
		let m = c & 0x3FF;
		let f = (c >> 10) & 0x1F;
		let v1024 = 1.0 / 1024;
		return (sign != 0 ? -1 : 1) * m * v1024 * Math.pow(10, f - 18);
	}

    window.SignCS = {
        CreateTransaction: CreateTransaction,
        Connect: Connect,
		FeeToNumber: CommissionToNumb
    };
}());

/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/*jshint evil:true*/

/**
 * The Thrift namespace houses the Apache Thrift JavaScript library
 * elements providing JavaScript bindings for the Apache Thrift RPC
 * system. End users will typically only directly make use of the
 * Transport (TXHRTransport/TWebSocketTransport) and Protocol
 * (TJSONPRotocol/TBinaryProtocol) constructors.
 *
 * Object methods beginning with a __ (e.g. __onOpen()) are internal
 * and should not be called outside of the object's own methods.
 *
 * This library creates one global object: Thrift
 * Code in this library must never create additional global identifiers,
 * all features must be scoped within the Thrift namespace.
 * @namespace
 * @example
 *     var transport = new Thrift.Transport('http://localhost:8585');
 *     var protocol  = new Thrift.Protocol(transport);
 *     var client = new MyThriftSvcClient(protocol);
 *     var result = client.MyMethod();
 */
var Thrift = {
    /**
     * Thrift JavaScript library version.
     * @readonly
     * @const {string} Version
     * @memberof Thrift
     */
    Version: '1.0.0-dev',

    /**
     * Thrift IDL type string to Id mapping.
     * @readonly
     * @property {number}  STOP   - End of a set of fields.
     * @property {number}  VOID   - No value (only legal for return types).
     * @property {number}  BOOL   - True/False integer.
     * @property {number}  BYTE   - Signed 8 bit integer.
     * @property {number}  I08    - Signed 8 bit integer.
     * @property {number}  DOUBLE - 64 bit IEEE 854 floating point.
     * @property {number}  I16    - Signed 16 bit integer.
     * @property {number}  I32    - Signed 32 bit integer.
     * @property {number}  I64    - Signed 64 bit integer.
     * @property {number}  STRING - Array of bytes representing a string of characters.
     * @property {number}  UTF7   - Array of bytes representing a string of UTF7 encoded characters.
     * @property {number}  STRUCT - A multifield type.
     * @property {number}  MAP    - A collection type (map/associative-array/dictionary).
     * @property {number}  SET    - A collection type (unordered and without repeated values).
     * @property {number}  LIST   - A collection type (unordered).
     * @property {number}  UTF8   - Array of bytes representing a string of UTF8 encoded characters.
     * @property {number}  UTF16  - Array of bytes representing a string of UTF16 encoded characters.
     */
    Type: {
        STOP: 0,
        VOID: 1,
        BOOL: 2,
        BYTE: 3,
        I08: 3,
        DOUBLE: 4,
        I16: 6,
        I32: 8,
        I64: 10,
        STRING: 11,
        UTF7: 11,
        STRUCT: 12,
        MAP: 13,
        SET: 14,
        LIST: 15,
        UTF8: 16,
        UTF16: 17
    },

    /**
     * Thrift RPC message type string to Id mapping.
     * @readonly
     * @property {number}  CALL      - RPC call sent from client to server.
     * @property {number}  REPLY     - RPC call normal response from server to client.
     * @property {number}  EXCEPTION - RPC call exception response from server to client.
     * @property {number}  ONEWAY    - Oneway RPC call from client to server with no response.
     */
    MessageType: {
        CALL: 1,
        REPLY: 2,
        EXCEPTION: 3,
        ONEWAY: 4
    },

    /**
     * Utility function returning the count of an object's own properties.
     * @param {object} obj - Object to test.
     * @returns {number} number of object's own properties
     */
    objectLength: function (obj) {
        var length = 0;
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                length++;
            }
        }
        return length;
    },

    /**
     * Utility function to establish prototype inheritance.
     * @see {@link http://javascript.crockford.com/prototypal.html|Prototypal Inheritance}
     * @param {function} constructor - Contstructor function to set as derived.
     * @param {function} superConstructor - Contstructor function to set as base.
     * @param {string} [name] - Type name to set as name property in derived prototype.
     */
    inherits: function (constructor, superConstructor, name) {
        function F() { }
        F.prototype = superConstructor.prototype;
        constructor.prototype = new F();
        constructor.prototype.name = name || '';
    }
};

/**
 * Initializes a Thrift TException instance.
 * @constructor
 * @augments Error
 * @param {string} message - The TException message (distinct from the Error message).
 * @classdesc TException is the base class for all Thrift exceptions types.
 */
Thrift.TException = function (message) {
    this.message = message;
};
Thrift.inherits(Thrift.TException, Error, 'TException');

/**
 * Returns the message set on the exception.
 * @readonly
 * @returns {string} exception message
 */
Thrift.TException.prototype.getMessage = function () {
    return this.message;
};

/**
 * Thrift Application Exception type string to Id mapping.
 * @readonly
 * @property {number}  UNKNOWN                 - Unknown/undefined.
 * @property {number}  UNKNOWN_METHOD          - Client attempted to call a method unknown to the server.
 * @property {number}  INVALID_MESSAGE_TYPE    - Client passed an unknown/unsupported MessageType.
 * @property {number}  WRONG_METHOD_NAME       - Unused.
 * @property {number}  BAD_SEQUENCE_ID         - Unused in Thrift RPC, used to flag proprietary sequence number errors.
 * @property {number}  MISSING_RESULT          - Raised by a server processor if a handler fails to supply the required return result.
 * @property {number}  INTERNAL_ERROR          - Something bad happened.
 * @property {number}  PROTOCOL_ERROR          - The protocol layer failed to serialize or deserialize data.
 * @property {number}  INVALID_TRANSFORM       - Unused.
 * @property {number}  INVALID_PROTOCOL        - The protocol (or version) is not supported.
 * @property {number}  UNSUPPORTED_CLIENT_TYPE - Unused.
 */
Thrift.TApplicationExceptionType = {
    UNKNOWN: 0,
    UNKNOWN_METHOD: 1,
    INVALID_MESSAGE_TYPE: 2,
    WRONG_METHOD_NAME: 3,
    BAD_SEQUENCE_ID: 4,
    MISSING_RESULT: 5,
    INTERNAL_ERROR: 6,
    PROTOCOL_ERROR: 7,
    INVALID_TRANSFORM: 8,
    INVALID_PROTOCOL: 9,
    UNSUPPORTED_CLIENT_TYPE: 10
};

/**
 * Initializes a Thrift TApplicationException instance.
 * @constructor
 * @augments Thrift.TException
 * @param {string} message - The TApplicationException message (distinct from the Error message).
 * @param {Thrift.TApplicationExceptionType} [code] - The TApplicationExceptionType code.
 * @classdesc TApplicationException is the exception class used to propagate exceptions from an RPC server back to a calling client.
*/
Thrift.TApplicationException = function (message, code) {
    this.message = message;
    this.code = typeof code === 'number' ? code : 0;
};
Thrift.inherits(Thrift.TApplicationException, Thrift.TException, 'TApplicationException');

/**
 * Read a TApplicationException from the supplied protocol.
 * @param {object} input - The input protocol to read from.
 */
Thrift.TApplicationException.prototype.read = function (input) {
    while (1) {
        var ret = input.readFieldBegin();

        if (ret.ftype == Thrift.Type.STOP) {
            break;
        }

        var fid = ret.fid;

        switch (fid) {
            case 1:
                if (ret.ftype == Thrift.Type.STRING) {
                    ret = input.readString();
                    this.message = ret.value;
                } else {
                    ret = input.skip(ret.ftype);
                }
                break;
            case 2:
                if (ret.ftype == Thrift.Type.I32) {
                    ret = input.readI32();
                    this.code = ret.value;
                } else {
                    ret = input.skip(ret.ftype);
                }
                break;
            default:
                ret = input.skip(ret.ftype);
                break;
        }

        input.readFieldEnd();
    }

    input.readStructEnd();
};

/**
 * Wite a TApplicationException to the supplied protocol.
 * @param {object} output - The output protocol to write to.
 */
Thrift.TApplicationException.prototype.write = function (output) {
    output.writeStructBegin('TApplicationException');

    if (this.message) {
        output.writeFieldBegin('message', Thrift.Type.STRING, 1);
        output.writeString(this.getMessage());
        output.writeFieldEnd();
    }

    if (this.code) {
        output.writeFieldBegin('type', Thrift.Type.I32, 2);
        output.writeI32(this.code);
        output.writeFieldEnd();
    }

    output.writeFieldStop();
    output.writeStructEnd();
};

/**
 * Returns the application exception code set on the exception.
 * @readonly
 * @returns {Thrift.TApplicationExceptionType} exception code
 */
Thrift.TApplicationException.prototype.getCode = function () {
    return this.code;
};

Thrift.TProtocolExceptionType = {
    UNKNOWN: 0,
    INVALID_DATA: 1,
    NEGATIVE_SIZE: 2,
    SIZE_LIMIT: 3,
    BAD_VERSION: 4,
    NOT_IMPLEMENTED: 5,
    DEPTH_LIMIT: 6
};

Thrift.TProtocolException = function TProtocolException(type, message) {
    Error.call(this);
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.type = type;
    this.message = message;
};
Thrift.inherits(Thrift.TProtocolException, Thrift.TException, 'TProtocolException');

/**
 * Constructor Function for the XHR transport.
 * If you do not specify a url then you must handle XHR operations on
 * your own. This type can also be constructed using the Transport alias
 * for backward compatibility.
 * @constructor
 * @param {string} [url] - The URL to connect to.
 * @classdesc The Apache Thrift Transport layer performs byte level I/O
 * between RPC clients and servers. The JavaScript TXHRTransport object
 * uses Http[s]/XHR. Target servers must implement the http[s] transport
 * (see: node.js example server_http.js).
 * @example
 *     var transport = new Thrift.TXHRTransport("http://localhost:8585");
 */
Thrift.Transport = Thrift.TXHRTransport = function (url, options) {
    this.url = url;
    this.wpos = 0;
    this.rpos = 0;
    this.useCORS = (options && options.useCORS);
    this.customHeaders = options ? (options.customHeaders ? options.customHeaders : {}) : {};
    this.send_buf = '';
    this.recv_buf = '';
};

Thrift.TXHRTransport.prototype = {
    /**
     * Gets the browser specific XmlHttpRequest Object.
     * @returns {object} the browser XHR interface object
     */
    getXmlHttpRequestObject: function () {
        try { return new XMLHttpRequest(); } catch (e1) { }
        try { return new ActiveXObject('Msxml2.XMLHTTP'); } catch (e2) { }
        try { return new ActiveXObject('Microsoft.XMLHTTP'); } catch (e3) { }

        throw "Your browser doesn't support XHR.";
    },

    /**
     * Sends the current XRH request if the transport was created with a URL
     * and the async parameter is false. If the transport was not created with
     * a URL, or the async parameter is True and no callback is provided, or
     * the URL is an empty string, the current send buffer is returned.
     * @param {object} async - If true the current send buffer is returned.
     * @param {object} callback - Optional async completion callback
     * @returns {undefined|string} Nothing or the current send buffer.
     * @throws {string} If XHR fails.
     */
    flush: function (async, callback) {
        var self = this;
        if ((async && !callback) || this.url === undefined || this.url === '') {
            return this.send_buf;
        }

        var xreq = this.getXmlHttpRequestObject();

        if (xreq.overrideMimeType) {
            xreq.overrideMimeType('application/vnd.apache.thrift.json; charset=utf-8');
        }

        if (callback) {
            //Ignore XHR callbacks until the data arrives, then call the
            //  client's callback
            xreq.onreadystatechange =
                (function () {
                    var clientCallback = callback;
                    return function () {
                        if (this.readyState == 4 && this.status == 200) {
                            self.setRecvBuffer(this.responseText);
                            clientCallback();
                        }
                    };
                }());

            // detect net::ERR_CONNECTION_REFUSED and call the callback.
            xreq.onerror =
                (function () {
                    var clientCallback = callback;
                    return function () {
                        clientCallback();
                    };
                }());

        }

        xreq.open('POST', this.url, !!async);

        // add custom headers
        Object.keys(self.customHeaders).forEach(function (prop) {
            xreq.setRequestHeader(prop, self.customHeaders[prop]);
        });

        if (xreq.setRequestHeader) {
            xreq.setRequestHeader('Accept', 'application/vnd.apache.thrift.json; charset=utf-8');
            xreq.setRequestHeader('Content-Type', 'application/vnd.apache.thrift.json; charset=utf-8');
        }

        xreq.send(this.send_buf);
        if (async && callback) {
            return;
        }

        if (xreq.readyState != 4) {
            throw 'encountered an unknown ajax ready state: ' + xreq.readyState;
        }

        if (xreq.status != 200) {
            throw 'encountered a unknown request status: ' + xreq.status;
        }

        this.recv_buf = xreq.responseText;
        this.recv_buf_sz = this.recv_buf.length;
        this.wpos = this.recv_buf.length;
        this.rpos = 0;
    },

    /**
     * Creates a jQuery XHR object to be used for a Thrift server call.
     * @param {object} client - The Thrift Service client object generated by the IDL compiler.
     * @param {object} postData - The message to send to the server.
     * @param {function} args - The original call arguments with the success call back at the end.
     * @param {function} recv_method - The Thrift Service Client receive method for the call.
     * @returns {object} A new jQuery XHR object.
     * @throws {string} If the jQuery version is prior to 1.5 or if jQuery is not found.
     */
    jqRequest: function (client, postData, args, recv_method) {
        if (typeof jQuery === 'undefined' ||
            typeof jQuery.Deferred === 'undefined') {
            throw 'Thrift.js requires jQuery 1.5+ to use asynchronous requests';
        }

        var thriftTransport = this;

        var jqXHR = jQuery.ajax({
            url: this.url,
            data: postData,
            type: 'POST',
            cache: false,
            contentType: 'application/vnd.apache.thrift.json; charset=utf-8',
            dataType: 'text thrift',
            converters: {
                'text thrift': function (responseData) {
                    thriftTransport.setRecvBuffer(responseData);
                    var value = recv_method.call(client);
                    return value;
                }
            },
            context: client,
            success: jQuery.makeArray(args).pop()
        });

        return jqXHR;
    },

    /**
     * Sets the buffer to provide the protocol when deserializing.
     * @param {string} buf - The buffer to supply the protocol.
     */
    setRecvBuffer: function (buf) {
        this.recv_buf = buf;
        this.recv_buf_sz = this.recv_buf.length;
        this.wpos = this.recv_buf.length;
        this.rpos = 0;
    },

    /**
     * Returns true if the transport is open, XHR always returns true.
     * @readonly
     * @returns {boolean} Always True.
     */
    isOpen: function () {
        return true;
    },

    /**
     * Opens the transport connection, with XHR this is a nop.
     */
    open: function () { },

    /**
     * Closes the transport connection, with XHR this is a nop.
     */
    close: function () { },

    /**
     * Returns the specified number of characters from the response
     * buffer.
     * @param {number} len - The number of characters to return.
     * @returns {string} Characters sent by the server.
     */
    read: function (len) {
        var avail = this.wpos - this.rpos;

        if (avail === 0) {
            return '';
        }

        var give = len;

        if (avail < len) {
            give = avail;
        }

        var ret = this.read_buf.substr(this.rpos, give);
        this.rpos += give;

        //clear buf when complete?
        return ret;
    },

    /**
     * Returns the entire response buffer.
     * @returns {string} Characters sent by the server.
     */
    readAll: function () {
        return this.recv_buf;
    },

    /**
     * Sets the send buffer to buf.
     * @param {string} buf - The buffer to send.
     */
    write: function (buf) {
        this.send_buf = buf;
    },

    /**
     * Returns the send buffer.
     * @readonly
     * @returns {string} The send buffer.
     */
    getSendBuffer: function () {
        return this.send_buf;
    }

};


/**
 * Constructor Function for the WebSocket transport.
 * @constructor
 * @param {string} [url] - The URL to connect to.
 * @classdesc The Apache Thrift Transport layer performs byte level I/O
 * between RPC clients and servers. The JavaScript TWebSocketTransport object
 * uses the WebSocket protocol. Target servers must implement WebSocket.
 * (see: node.js example server_http.js).
 * @example
 *   var transport = new Thrift.TWebSocketTransport("http://localhost:8585");
 */
Thrift.TWebSocketTransport = function (url) {
    this.__reset(url);
};

Thrift.TWebSocketTransport.prototype = {
    __reset: function (url) {
        this.url = url;             //Where to connect
        this.socket = null;         //The web socket
        this.callbacks = [];        //Pending callbacks
        this.send_pending = [];     //Buffers/Callback pairs waiting to be sent
        this.send_buf = '';         //Outbound data, immutable until sent
        this.recv_buf = '';         //Inbound data
        this.rb_wpos = 0;           //Network write position in receive buffer
        this.rb_rpos = 0;           //Client read position in receive buffer
    },

    /**
     * Sends the current WS request and registers callback. The async
     * parameter is ignored (WS flush is always async) and the callback
     * function parameter is required.
     * @param {object} async - Ignored.
     * @param {object} callback - The client completion callback.
     * @returns {undefined|string} Nothing (undefined)
     */
    flush: function (async, callback) {
        var self = this;
        if (this.isOpen()) {
            //Send data and register a callback to invoke the client callback
            this.socket.send(this.send_buf);
            this.callbacks.push((function () {
                var clientCallback = callback;
                return function (msg) {
                    self.setRecvBuffer(msg);
                    if (clientCallback) {
                        clientCallback();
                    }
                };
            }()));
        } else {
            //Queue the send to go out __onOpen
            this.send_pending.push({
                buf: this.send_buf,
                cb: callback
            });
        }
    },

    __onOpen: function () {
        var self = this;
        if (this.send_pending.length > 0) {
            //If the user made calls before the connection was fully
            //open, send them now
            this.send_pending.forEach(function (elem) {
                self.socket.send(elem.buf);
                self.callbacks.push((function () {
                    var clientCallback = elem.cb;
                    return function (msg) {
                        self.setRecvBuffer(msg);
                        clientCallback();
                    };
                }()));
            });
            this.send_pending = [];
        }
    },

    __onClose: function (evt) {
        this.__reset(this.url);
    },

    __onMessage: function (evt) {
        if (this.callbacks.length) {
            this.callbacks.shift()(evt.data);
        }
    },

    __onError: function (evt) {
        console.log('Thrift WebSocket Error: ' + evt.toString());
        this.socket.close();
    },

    /**
     * Sets the buffer to use when receiving server responses.
     * @param {string} buf - The buffer to receive server responses.
     */
    setRecvBuffer: function (buf) {
        this.recv_buf = buf;
        this.recv_buf_sz = this.recv_buf.length;
        this.wpos = this.recv_buf.length;
        this.rpos = 0;
    },

    /**
     * Returns true if the transport is open
     * @readonly
     * @returns {boolean}
     */
    isOpen: function () {
        return this.socket && this.socket.readyState == this.socket.OPEN;
    },

    /**
     * Opens the transport connection
     */
    open: function () {
        //If OPEN/CONNECTING/CLOSING ignore additional opens
        if (this.socket && this.socket.readyState != this.socket.CLOSED) {
            return;
        }
        //If there is no socket or the socket is closed:
        this.socket = new WebSocket(this.url);
        this.socket.onopen = this.__onOpen.bind(this);
        this.socket.onmessage = this.__onMessage.bind(this);
        this.socket.onerror = this.__onError.bind(this);
        this.socket.onclose = this.__onClose.bind(this);
    },

    /**
     * Closes the transport connection
     */
    close: function () {
        this.socket.close();
    },

    /**
     * Returns the specified number of characters from the response
     * buffer.
     * @param {number} len - The number of characters to return.
     * @returns {string} Characters sent by the server.
     */
    read: function (len) {
        var avail = this.wpos - this.rpos;

        if (avail === 0) {
            return '';
        }

        var give = len;

        if (avail < len) {
            give = avail;
        }

        var ret = this.read_buf.substr(this.rpos, give);
        this.rpos += give;

        //clear buf when complete?
        return ret;
    },

    /**
     * Returns the entire response buffer.
     * @returns {string} Characters sent by the server.
     */
    readAll: function () {
        return this.recv_buf;
    },

    /**
     * Sets the send buffer to buf.
     * @param {string} buf - The buffer to send.
     */
    write: function (buf) {
        this.send_buf = buf;
    },

    /**
     * Returns the send buffer.
     * @readonly
     * @returns {string} The send buffer.
     */
    getSendBuffer: function () {
        return this.send_buf;
    }

};

/**
 * Initializes a Thrift JSON protocol instance.
 * @constructor
 * @param {Thrift.Transport} transport - The transport to serialize to/from.
 * @classdesc Apache Thrift Protocols perform serialization which enables cross
 * language RPC. The Protocol type is the JavaScript browser implementation
 * of the Apache Thrift TJSONProtocol.
 * @example
 *     var protocol  = new Thrift.Protocol(transport);
 */
Thrift.TJSONProtocol = Thrift.Protocol = function (transport) {
    this.tstack = [];
    this.tpos = [];
    this.transport = transport;
};

/**
 * Thrift IDL type Id to string mapping.
 * @readonly
 * @see {@link Thrift.Type}
 */
Thrift.Protocol.Type = {};
Thrift.Protocol.Type[Thrift.Type.BOOL] = '"tf"';
Thrift.Protocol.Type[Thrift.Type.BYTE] = '"i8"';
Thrift.Protocol.Type[Thrift.Type.I16] = '"i16"';
Thrift.Protocol.Type[Thrift.Type.I32] = '"i32"';
Thrift.Protocol.Type[Thrift.Type.I64] = '"i64"';
Thrift.Protocol.Type[Thrift.Type.DOUBLE] = '"dbl"';
Thrift.Protocol.Type[Thrift.Type.STRUCT] = '"rec"';
Thrift.Protocol.Type[Thrift.Type.STRING] = '"str"';
Thrift.Protocol.Type[Thrift.Type.MAP] = '"map"';
Thrift.Protocol.Type[Thrift.Type.LIST] = '"lst"';
Thrift.Protocol.Type[Thrift.Type.SET] = '"set"';

/**
 * Thrift IDL type string to Id mapping.
 * @readonly
 * @see {@link Thrift.Type}
 */
Thrift.Protocol.RType = {};
Thrift.Protocol.RType.tf = Thrift.Type.BOOL;
Thrift.Protocol.RType.i8 = Thrift.Type.BYTE;
Thrift.Protocol.RType.i16 = Thrift.Type.I16;
Thrift.Protocol.RType.i32 = Thrift.Type.I32;
Thrift.Protocol.RType.i64 = Thrift.Type.I64;
Thrift.Protocol.RType.dbl = Thrift.Type.DOUBLE;
Thrift.Protocol.RType.rec = Thrift.Type.STRUCT;
Thrift.Protocol.RType.str = Thrift.Type.STRING;
Thrift.Protocol.RType.map = Thrift.Type.MAP;
Thrift.Protocol.RType.lst = Thrift.Type.LIST;
Thrift.Protocol.RType.set = Thrift.Type.SET;

/**
 * The TJSONProtocol version number.
 * @readonly
 * @const {number} Version
 * @memberof Thrift.Protocol
 */
Thrift.Protocol.Version = 1;

Thrift.Protocol.prototype = {
    /**
     * Returns the underlying transport.
     * @readonly
     * @returns {Thrift.Transport} The underlying transport.
     */
    getTransport: function () {
        return this.transport;
    },

    /**
     * Serializes the beginning of a Thrift RPC message.
     * @param {string} name - The service method to call.
     * @param {Thrift.MessageType} messageType - The type of method call.
     * @param {number} seqid - The sequence number of this call (always 0 in Apache Thrift).
     */
    writeMessageBegin: function (name, messageType, seqid) {
        this.tstack = [];
        this.tpos = [];

        this.tstack.push([Thrift.Protocol.Version, '"' +
            name + '"', messageType, seqid]);
    },

    /**
     * Serializes the end of a Thrift RPC message.
     */
    writeMessageEnd: function () {
        var obj = this.tstack.pop();

        this.wobj = this.tstack.pop();
        this.wobj.push(obj);

        this.wbuf = '[' + this.wobj.join(',') + ']';

        this.transport.write(this.wbuf);
    },


    /**
     * Serializes the beginning of a struct.
     * @param {string} name - The name of the struct.
     */
    writeStructBegin: function (name) {
        this.tpos.push(this.tstack.length);
        this.tstack.push({});
    },

    /**
     * Serializes the end of a struct.
     */
    writeStructEnd: function () {

        var p = this.tpos.pop();
        var struct = this.tstack[p];
        var str = '{';
        var first = true;
        for (var key in struct) {
            if (first) {
                first = false;
            } else {
                str += ',';
            }

            str += key + ':' + struct[key];
        }

        str += '}';
        this.tstack[p] = str;
    },

    /**
     * Serializes the beginning of a struct field.
     * @param {string} name - The name of the field.
     * @param {Thrift.Protocol.Type} fieldType - The data type of the field.
     * @param {number} fieldId - The field's unique identifier.
     */
    writeFieldBegin: function (name, fieldType, fieldId) {
        this.tpos.push(this.tstack.length);
        this.tstack.push({
            'fieldId': '"' +
                fieldId + '"', 'fieldType': Thrift.Protocol.Type[fieldType]
        });

    },

    /**
     * Serializes the end of a field.
     */
    writeFieldEnd: function () {
        var value = this.tstack.pop();
        var fieldInfo = this.tstack.pop();

        this.tstack[this.tstack.length - 1][fieldInfo.fieldId] = '{' +
            fieldInfo.fieldType + ':' + value + '}';
        this.tpos.pop();
    },

    /**
     * Serializes the end of the set of fields for a struct.
     */
    writeFieldStop: function () {
        //na
    },

    /**
     * Serializes the beginning of a map collection.
     * @param {Thrift.Type} keyType - The data type of the key.
     * @param {Thrift.Type} valType - The data type of the value.
     * @param {number} [size] - The number of elements in the map (ignored).
     */
    writeMapBegin: function (keyType, valType, size) {
        this.tpos.push(this.tstack.length);
        this.tstack.push([Thrift.Protocol.Type[keyType],
        Thrift.Protocol.Type[valType], 0]);
    },

    /**
     * Serializes the end of a map.
     */
    writeMapEnd: function () {
        var p = this.tpos.pop();

        if (p == this.tstack.length) {
            return;
        }

        if ((this.tstack.length - p - 1) % 2 !== 0) {
            this.tstack.push('');
        }

        var size = (this.tstack.length - p - 1) / 2;

        this.tstack[p][this.tstack[p].length - 1] = size;

        var map = '}';
        var first = true;
        while (this.tstack.length > p + 1) {
            var v = this.tstack.pop();
            var k = this.tstack.pop();
            if (first) {
                first = false;
            } else {
                map = ',' + map;
            }

            if (!isNaN(k)) { k = '"' + k + '"'; } //json "keys" need to be strings
            map = k + ':' + v + map;
        }
        map = '{' + map;

        this.tstack[p].push(map);
        this.tstack[p] = '[' + this.tstack[p].join(',') + ']';
    },

    /**
     * Serializes the beginning of a list collection.
     * @param {Thrift.Type} elemType - The data type of the elements.
     * @param {number} size - The number of elements in the list.
     */
    writeListBegin: function (elemType, size) {
        this.tpos.push(this.tstack.length);
        this.tstack.push([Thrift.Protocol.Type[elemType], size]);
    },

    /**
     * Serializes the end of a list.
     */
    writeListEnd: function () {
        var p = this.tpos.pop();

        while (this.tstack.length > p + 1) {
            var tmpVal = this.tstack[p + 1];
            this.tstack.splice(p + 1, 1);
            this.tstack[p].push(tmpVal);
        }

        this.tstack[p] = '[' + this.tstack[p].join(',') + ']';
    },

    /**
     * Serializes the beginning of a set collection.
     * @param {Thrift.Type} elemType - The data type of the elements.
     * @param {number} size - The number of elements in the list.
     */
    writeSetBegin: function (elemType, size) {
        this.tpos.push(this.tstack.length);
        this.tstack.push([Thrift.Protocol.Type[elemType], size]);
    },

    /**
     * Serializes the end of a set.
     */
    writeSetEnd: function () {
        var p = this.tpos.pop();

        while (this.tstack.length > p + 1) {
            var tmpVal = this.tstack[p + 1];
            this.tstack.splice(p + 1, 1);
            this.tstack[p].push(tmpVal);
        }

        this.tstack[p] = '[' + this.tstack[p].join(',') + ']';
    },

    /** Serializes a boolean */
    writeBool: function (value) {
        this.tstack.push(value ? 1 : 0);
    },

    /** Serializes a number */
    writeByte: function (i8) {
        this.tstack.push(i8);
    },

    /** Serializes a number */
    writeI16: function (i16) {
        this.tstack.push(i16);
    },

    /** Serializes a number */
    writeI32: function (i32) {
        this.tstack.push(i32);
    },

    /** Serializes a number */
    writeI64: function (i64) {
        this.tstack.push(i64);
    },

    /** Serializes a number */
    writeDouble: function (dbl) {
        this.tstack.push(dbl);
    },

    /** Serializes a string */
    writeString: function (str) {
        // We do not encode uri components for wire transfer:
        if (str === null) {
            this.tstack.push(null);
        } else {
            // concat may be slower than building a byte buffer
            var escapedString = '';
            for (var i = 0; i < str.length; i++) {
                var ch = str.charAt(i);      // a single double quote: "
                if (ch === '\"') {
                    escapedString += '\\\"'; // write out as: \"
                } else if (ch === '\\') {    // a single backslash
                    escapedString += '\\\\'; // write out as double backslash
                } else if (ch === '\b') {    // a single backspace: invisible
                    escapedString += '\\b';  // write out as: \b"
                } else if (ch === '\f') {    // a single formfeed: invisible
                    escapedString += '\\f';  // write out as: \f"
                } else if (ch === '\n') {    // a single newline: invisible
                    escapedString += '\\n';  // write out as: \n"
                } else if (ch === '\r') {    // a single return: invisible
                    escapedString += '\\r';  // write out as: \r"
                } else if (ch === '\t') {    // a single tab: invisible
                    escapedString += '\\t';  // write out as: \t"
                } else {
                    escapedString += ch;     // Else it need not be escaped
                }
            }
            this.tstack.push('"' + escapedString + '"');
        }
    },

    /** Serializes a string */
    writeBinary: function (binary) {
        var str = '';
        if (typeof binary == 'string') {
            str = binary;
        } else if (binary instanceof Uint8Array) {
            var arr = binary;
            for (var i = 0; i < arr.length; ++i) {
                str += String.fromCharCode(arr[i]);
            }
        } else {
            throw new TypeError('writeBinary only accepts String or Uint8Array.');
        }
        this.tstack.push('"' + btoa(str) + '"');
    },

    /**
       @class
       @name AnonReadMessageBeginReturn
       @property {string} fname - The name of the service method.
       @property {Thrift.MessageType} mtype - The type of message call.
       @property {number} rseqid - The sequence number of the message (0 in Thrift RPC).
     */
    /**
     * Deserializes the beginning of a message.
     * @returns {AnonReadMessageBeginReturn}
     */
    readMessageBegin: function () {
        this.rstack = [];
        this.rpos = [];

        if (typeof JSON !== 'undefined' && typeof JSON.parse === 'function') {
            this.robj = JSON.parse(this.transport.readAll());
        } else if (typeof jQuery !== 'undefined') {
            this.robj = jQuery.parseJSON(this.transport.readAll());
        } else {
            this.robj = eval(this.transport.readAll());
        }

        var r = {};
        var version = this.robj.shift();

        if (version != Thrift.Protocol.Version) {
            throw 'Wrong thrift protocol version: ' + version;
        }

        r.fname = this.robj.shift();
        r.mtype = this.robj.shift();
        r.rseqid = this.robj.shift();


        //get to the main obj
        this.rstack.push(this.robj.shift());

        return r;
    },

    /** Deserializes the end of a message. */
    readMessageEnd: function () {
    },

    /**
     * Deserializes the beginning of a struct.
     * @param {string} [name] - The name of the struct (ignored)
     * @returns {object} - An object with an empty string fname property
     */
    readStructBegin: function (name) {
        var r = {};
        r.fname = '';

        //incase this is an array of structs
        if (this.rstack[this.rstack.length - 1] instanceof Array) {
            this.rstack.push(this.rstack[this.rstack.length - 1].shift());
        }

        return r;
    },

    /** Deserializes the end of a struct. */
    readStructEnd: function () {
        if (this.rstack[this.rstack.length - 2] instanceof Array) {
            this.rstack.pop();
        }
    },

    /**
       @class
       @name AnonReadFieldBeginReturn
       @property {string} fname - The name of the field (always '').
       @property {Thrift.Type} ftype - The data type of the field.
       @property {number} fid - The unique identifier of the field.
     */
    /**
     * Deserializes the beginning of a field.
     * @returns {AnonReadFieldBeginReturn}
     */
    readFieldBegin: function () {
        var r = {};

        var fid = -1;
        var ftype = Thrift.Type.STOP;

        //get a fieldId
        for (var f in (this.rstack[this.rstack.length - 1])) {
            if (f === null) {
                continue;
            }

            fid = parseInt(f, 10);
            this.rpos.push(this.rstack.length);

            var field = this.rstack[this.rstack.length - 1][fid];

            //remove so we don't see it again
            delete this.rstack[this.rstack.length - 1][fid];

            this.rstack.push(field);

            break;
        }

        if (fid != -1) {

            //should only be 1 of these but this is the only
            //way to match a key
            for (var i in (this.rstack[this.rstack.length - 1])) {
                if (Thrift.Protocol.RType[i] === null) {
                    continue;
                }

                ftype = Thrift.Protocol.RType[i];
                this.rstack[this.rstack.length - 1] =
                    this.rstack[this.rstack.length - 1][i];
            }
        }

        r.fname = '';
        r.ftype = ftype;
        r.fid = fid;

        return r;
    },

    /** Deserializes the end of a field. */
    readFieldEnd: function () {
        var pos = this.rpos.pop();

        //get back to the right place in the stack
        while (this.rstack.length > pos) {
            this.rstack.pop();
        }

    },

    /**
       @class
       @name AnonReadMapBeginReturn
       @property {Thrift.Type} ktype - The data type of the key.
       @property {Thrift.Type} vtype - The data type of the value.
       @property {number} size - The number of elements in the map.
     */
    /**
     * Deserializes the beginning of a map.
     * @returns {AnonReadMapBeginReturn}
     */
    readMapBegin: function () {
        var map = this.rstack.pop();
        var first = map.shift();
        if (first instanceof Array) {
            this.rstack.push(map);
            map = first;
            first = map.shift();
        }

        var r = {};
        r.ktype = Thrift.Protocol.RType[first];
        r.vtype = Thrift.Protocol.RType[map.shift()];
        r.size = map.shift();


        this.rpos.push(this.rstack.length);
        this.rstack.push(map.shift());

        return r;
    },

    /** Deserializes the end of a map. */
    readMapEnd: function () {
        this.readFieldEnd();
    },

    /**
       @class
       @name AnonReadColBeginReturn
       @property {Thrift.Type} etype - The data type of the element.
       @property {number} size - The number of elements in the collection.
     */
    /**
     * Deserializes the beginning of a list.
     * @returns {AnonReadColBeginReturn}
     */
    readListBegin: function () {
        var list = this.rstack[this.rstack.length - 1];

        var r = {};
        r.etype = Thrift.Protocol.RType[list.shift()];
        r.size = list.shift();

        this.rpos.push(this.rstack.length);
        this.rstack.push(list.shift());

        return r;
    },

    /** Deserializes the end of a list. */
    readListEnd: function () {
        this.readFieldEnd();
    },

    /**
     * Deserializes the beginning of a set.
     * @returns {AnonReadColBeginReturn}
     */
    readSetBegin: function (elemType, size) {
        return this.readListBegin(elemType, size);
    },

    /** Deserializes the end of a set. */
    readSetEnd: function () {
        return this.readListEnd();
    },

    /** Returns an object with a value property set to
     *  False unless the next number in the protocol buffer
     *  is 1, in which case the value property is True */
    readBool: function () {
        var r = this.readI32();

        if (r !== null && r.value == '1') {
            r.value = true;
        } else {
            r.value = false;
        }

        return r;
    },

    /** Returns the an object with a value property set to the
        next value found in the protocol buffer */
    readByte: function () {
        return this.readI32();
    },

    /** Returns the an object with a value property set to the
        next value found in the protocol buffer */
    readI16: function () {
        return this.readI32();
    },

    /** Returns the an object with a value property set to the
        next value found in the protocol buffer */
    readI32: function (f) {
        if (f === undefined) {
            f = this.rstack[this.rstack.length - 1];
        }

        var r = {};

        if (f instanceof Array) {
            if (f.length === 0) {
                r.value = undefined;
            } else {
                r.value = f.shift();
            }
        } else if (f instanceof Object) {
            for (var i in f) {
                if (i === null) {
                    continue;
                }
                this.rstack.push(f[i]);
                delete f[i];

                r.value = i;
                break;
            }
        } else {
            r.value = f;
            this.rstack.pop();
        }

        return r;
    },

    /** Returns the an object with a value property set to the
        next value found in the protocol buffer */
    readI64: function () {
        return this.readI32();
    },

    /** Returns the an object with a value property set to the
        next value found in the protocol buffer */
    readDouble: function () {
        return this.readI32();
    },

    /** Returns the an object with a value property set to the
        next value found in the protocol buffer */
    readString: function () {
        var r = this.readI32();
        return r;
    },

    /** Returns the an object with a value property set to the
        next value found in the protocol buffer */
    readBinary: function () {
        var r = this.readI32();
        r.value = atob(r.value);
        return r;
    },

    /**
     * Method to arbitrarily skip over data */
    skip: function (type) {
        var ret, i;
        switch (type) {
            case Thrift.Type.STOP:
                return null;

            case Thrift.Type.BOOL:
                return this.readBool();

            case Thrift.Type.BYTE:
                return this.readByte();

            case Thrift.Type.I16:
                return this.readI16();

            case Thrift.Type.I32:
                return this.readI32();

            case Thrift.Type.I64:
                return this.readI64();

            case Thrift.Type.DOUBLE:
                return this.readDouble();

            case Thrift.Type.STRING:
                return this.readString();

            case Thrift.Type.STRUCT:
                this.readStructBegin();
                while (true) {
                    ret = this.readFieldBegin();
                    if (ret.ftype == Thrift.Type.STOP) {
                        break;
                    }
                    this.skip(ret.ftype);
                    this.readFieldEnd();
                }
                this.readStructEnd();
                return null;

            case Thrift.Type.MAP:
                ret = this.readMapBegin();
                for (i = 0; i < ret.size; i++) {
                    if (i > 0) {
                        if (this.rstack.length > this.rpos[this.rpos.length - 1] + 1) {
                            this.rstack.pop();
                        }
                    }
                    this.skip(ret.ktype);
                    this.skip(ret.vtype);
                }
                this.readMapEnd();
                return null;

            case Thrift.Type.SET:
                ret = this.readSetBegin();
                for (i = 0; i < ret.size; i++) {
                    this.skip(ret.etype);
                }
                this.readSetEnd();
                return null;

            case Thrift.Type.LIST:
                ret = this.readListBegin();
                for (i = 0; i < ret.size; i++) {
                    this.skip(ret.etype);
                }
                this.readListEnd();
                return null;
        }
    }
};


/**
 * Initializes a MutilplexProtocol Implementation as a Wrapper for Thrift.Protocol
 * @constructor
 */
Thrift.MultiplexProtocol = function (srvName, trans, strictRead, strictWrite) {
    Thrift.Protocol.call(this, trans, strictRead, strictWrite);
    this.serviceName = srvName;
};
Thrift.inherits(Thrift.MultiplexProtocol, Thrift.Protocol, 'multiplexProtocol');

/** Override writeMessageBegin method of prototype*/
Thrift.MultiplexProtocol.prototype.writeMessageBegin = function (name, type, seqid) {

    if (type === Thrift.MessageType.CALL || type === Thrift.MessageType.ONEWAY) {
        Thrift.Protocol.prototype.writeMessageBegin.call(this, this.serviceName + ':' + name, type, seqid);
    } else {
        Thrift.Protocol.prototype.writeMessageBegin.call(this, name, type, seqid);
    }
};

Thrift.Multiplexer = function () {
    this.seqid = 0;
};

/** Instantiates a multiplexed client for a specific service
 * @constructor
 * @param {String} serviceName - The transport to serialize to/from.
 * @param {Thrift.ServiceClient} SCl - The Service Client Class
 * @param {Thrift.Transport} transport - Thrift.Transport instance which provides remote host:port
 * @example
 *    var mp = new Thrift.Multiplexer();
 *    var transport = new Thrift.Transport("http://localhost:9090/foo.thrift");
 *    var protocol = new Thrift.Protocol(transport);
 *    var client = mp.createClient('AuthService', AuthServiceClient, transport);
*/
Thrift.Multiplexer.prototype.createClient = function (serviceName, SCl, transport) {
    if (SCl.Client) {
        SCl = SCl.Client;
    }
    var self = this;
    SCl.prototype.new_seqid = function () {
        self.seqid += 1;
        return self.seqid;
    };
    var client = new SCl(new Thrift.MultiplexProtocol(serviceName, transport));

    return client;
};



var copyList, copyMap;

copyList = function (lst, types) {

    if (!lst) { return lst; }

    var type;

    if (types.shift === undefined) {
        type = types;
    }
    else {
        type = types[0];
    }
    var Type = type;

    var len = lst.length, result = [], i, val;
    for (i = 0; i < len; i++) {
        val = lst[i];
        if (type === null) {
            result.push(val);
        }
        else if (type === copyMap || type === copyList) {
            result.push(type(val, types.slice(1)));
        }
        else {
            result.push(new Type(val));
        }
    }
    return result;
};

copyMap = function (obj, types) {

    if (!obj) { return obj; }

    var type;

    if (types.shift === undefined) {
        type = types;
    }
    else {
        type = types[0];
    }
    var Type = type;

    var result = {}, val;
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            val = obj[prop];
            if (type === null) {
                result[prop] = val;
            }
            else if (type === copyMap || type === copyList) {
                result[prop] = type(val, types.slice(1));
            }
            else {
                result[prop] = new Type(val);
            }
        }
    }
    return result;
};

Thrift.copyMap = copyMap;
Thrift.copyList = copyList;


//
// Autogenerated by Thrift Compiler (0.11.0)
//
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
//


ClassObject = function (args) {
    this.byteCodeObjects = null;
    this.instance = null;
    if (args) {
        if (args.byteCodeObjects !== undefined && args.byteCodeObjects !== null) {
            this.byteCodeObjects = Thrift.copyList(args.byteCodeObjects, [null]);
        }
        if (args.instance !== undefined && args.instance !== null) {
            this.instance = args.instance;
        }
    }
};
ClassObject.prototype = {};
ClassObject.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.LIST) {
                    var _size0 = 0;
                    var _rtmp34;
                    this.byteCodeObjects = [];
                    var _etype3 = 0;
                    _rtmp34 = input.readListBegin();
                    _etype3 = _rtmp34.etype;
                    _size0 = _rtmp34.size;
                    for (var _i5 = 0; _i5 < _size0; ++_i5) {
                        var elem6 = null;
                        elem6 = new ByteCodeObject();
                        elem6.read(input);
                        this.byteCodeObjects.push(elem6);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.instance = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

ClassObject.prototype.write = function (output) {
    output.writeStructBegin('ClassObject');
    if (this.byteCodeObjects !== null && this.byteCodeObjects !== undefined) {
        output.writeFieldBegin('byteCodeObjects', Thrift.Type.LIST, 1);
        output.writeListBegin(Thrift.Type.STRUCT, this.byteCodeObjects.length);
        for (var iter7 in this.byteCodeObjects) {
            if (this.byteCodeObjects.hasOwnProperty(iter7)) {
                iter7 = this.byteCodeObjects[iter7];
                iter7.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    if (this.instance !== null && this.instance !== undefined) {
        output.writeFieldBegin('instance', Thrift.Type.STRING, 2);
        output.writeBinary(this.instance);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

object = function (args) {
    this.nameClass = null;
    this.instance = null;
    if (args) {
        if (args.nameClass !== undefined && args.nameClass !== null) {
            this.nameClass = args.nameClass;
        }
        if (args.instance !== undefined && args.instance !== null) {
            this.instance = args.instance;
        }
    }
};
object.prototype = {};
object.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.nameClass = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.instance = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

object.prototype.write = function (output) {
    output.writeStructBegin('object');
    if (this.nameClass !== null && this.nameClass !== undefined) {
        output.writeFieldBegin('nameClass', Thrift.Type.STRING, 1);
        output.writeString(this.nameClass);
        output.writeFieldEnd();
    }
    if (this.instance !== null && this.instance !== undefined) {
        output.writeFieldBegin('instance', Thrift.Type.STRING, 2);
        output.writeBinary(this.instance);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

Variant = function (args) {
    this.v_null = null;
    this.v_void = null;
    this.v_boolean = null;
    this.v_boolean_box = null;
    this.v_byte = null;
    this.v_byte_box = null;
    this.v_short = null;
    this.v_short_box = null;
    this.v_int = null;
    this.v_int_box = null;
    this.v_long = null;
    this.v_long_box = null;
    this.v_float = null;
    this.v_float_box = null;
    this.v_double = null;
    this.v_double_box = null;
    this.v_string = null;
    this.v_object = null;
    this.v_array = null;
    this.v_list = null;
    this.v_set = null;
    this.v_map = null;
    if (args) {
        if (args.v_null !== undefined && args.v_null !== null) {
            this.v_null = args.v_null;
        }
        if (args.v_void !== undefined && args.v_void !== null) {
            this.v_void = args.v_void;
        }
        if (args.v_boolean !== undefined && args.v_boolean !== null) {
            this.v_boolean = args.v_boolean;
        }
        if (args.v_boolean_box !== undefined && args.v_boolean_box !== null) {
            this.v_boolean_box = args.v_boolean_box;
        }
        if (args.v_byte !== undefined && args.v_byte !== null) {
            this.v_byte = args.v_byte;
        }
        if (args.v_byte_box !== undefined && args.v_byte_box !== null) {
            this.v_byte_box = args.v_byte_box;
        }
        if (args.v_short !== undefined && args.v_short !== null) {
            this.v_short = args.v_short;
        }
        if (args.v_short_box !== undefined && args.v_short_box !== null) {
            this.v_short_box = args.v_short_box;
        }
        if (args.v_int !== undefined && args.v_int !== null) {
            this.v_int = args.v_int;
        }
        if (args.v_int_box !== undefined && args.v_int_box !== null) {
            this.v_int_box = args.v_int_box;
        }
        if (args.v_long !== undefined && args.v_long !== null) {
            this.v_long = args.v_long;
        }
        if (args.v_long_box !== undefined && args.v_long_box !== null) {
            this.v_long_box = args.v_long_box;
        }
        if (args.v_float !== undefined && args.v_float !== null) {
            this.v_float = args.v_float;
        }
        if (args.v_float_box !== undefined && args.v_float_box !== null) {
            this.v_float_box = args.v_float_box;
        }
        if (args.v_double !== undefined && args.v_double !== null) {
            this.v_double = args.v_double;
        }
        if (args.v_double_box !== undefined && args.v_double_box !== null) {
            this.v_double_box = args.v_double_box;
        }
        if (args.v_string !== undefined && args.v_string !== null) {
            this.v_string = args.v_string;
        }
        if (args.v_object !== undefined && args.v_object !== null) {
            this.v_object = new object(args.v_object);
        }
        if (args.v_array !== undefined && args.v_array !== null) {
            this.v_array = Thrift.copyList(args.v_array, [null]);
        }
        if (args.v_list !== undefined && args.v_list !== null) {
            this.v_list = Thrift.copyList(args.v_list, [null]);
        }
        if (args.v_set !== undefined && args.v_set !== null) {
            this.v_set = Thrift.copyList(args.v_set, [null]);
        }
        if (args.v_map !== undefined && args.v_map !== null) {
            this.v_map = Thrift.copyMap(args.v_map, [null]);
        }
    }
};
Variant.prototype = {};
Variant.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.v_null = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.BYTE) {
                    this.v_void = input.readByte().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.BOOL) {
                    this.v_boolean = input.readBool().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.BOOL) {
                    this.v_boolean_box = input.readBool().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 5:
                if (ftype == Thrift.Type.BYTE) {
                    this.v_byte = input.readByte().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 6:
                if (ftype == Thrift.Type.BYTE) {
                    this.v_byte_box = input.readByte().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 7:
                if (ftype == Thrift.Type.I16) {
                    this.v_short = input.readI16().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 8:
                if (ftype == Thrift.Type.I16) {
                    this.v_short_box = input.readI16().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 9:
                if (ftype == Thrift.Type.I32) {
                    this.v_int = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 10:
                if (ftype == Thrift.Type.I32) {
                    this.v_int_box = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 11:
                if (ftype == Thrift.Type.I64) {
                    this.v_long = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 12:
                if (ftype == Thrift.Type.I64) {
                    this.v_long_box = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 13:
                if (ftype == Thrift.Type.DOUBLE) {
                    this.v_float = input.readDouble().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 14:
                if (ftype == Thrift.Type.DOUBLE) {
                    this.v_float_box = input.readDouble().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 15:
                if (ftype == Thrift.Type.DOUBLE) {
                    this.v_double = input.readDouble().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 16:
                if (ftype == Thrift.Type.DOUBLE) {
                    this.v_double_box = input.readDouble().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 17:
                if (ftype == Thrift.Type.STRING) {
                    this.v_string = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 18:
                if (ftype == Thrift.Type.STRUCT) {
                    this.v_object = new object();
                    this.v_object.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 19:
                if (ftype == Thrift.Type.LIST) {
                    var _size8 = 0;
                    var _rtmp312;
                    this.v_array = [];
                    var _etype11 = 0;
                    _rtmp312 = input.readListBegin();
                    _etype11 = _rtmp312.etype;
                    _size8 = _rtmp312.size;
                    for (var _i13 = 0; _i13 < _size8; ++_i13) {
                        var elem14 = null;
                        elem14 = new Variant();
                        elem14.read(input);
                        this.v_array.push(elem14);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            case 20:
                if (ftype == Thrift.Type.LIST) {
                    var _size15 = 0;
                    var _rtmp319;
                    this.v_list = [];
                    var _etype18 = 0;
                    _rtmp319 = input.readListBegin();
                    _etype18 = _rtmp319.etype;
                    _size15 = _rtmp319.size;
                    for (var _i20 = 0; _i20 < _size15; ++_i20) {
                        var elem21 = null;
                        elem21 = new Variant();
                        elem21.read(input);
                        this.v_list.push(elem21);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            case 21:
                if (ftype == Thrift.Type.SET) {
                    var _size22 = 0;
                    var _rtmp326;
                    this.v_set = [];
                    var _etype25 = 0;
                    _rtmp326 = input.readSetBegin();
                    _etype25 = _rtmp326.etype;
                    _size22 = _rtmp326.size;
                    for (var _i27 = 0; _i27 < _size22; ++_i27) {
                        var elem28 = null;
                        elem28 = new Variant();
                        elem28.read(input);
                        this.v_set.push(elem28);
                    }
                    input.readSetEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            case 22:
                if (ftype == Thrift.Type.MAP) {
                    var _size29 = 0;
                    var _rtmp333;
                    this.v_map = {};
                    var _ktype30 = 0;
                    var _vtype31 = 0;
                    _rtmp333 = input.readMapBegin();
                    _ktype30 = _rtmp333.ktype;
                    _vtype31 = _rtmp333.vtype;
                    _size29 = _rtmp333.size;
                    for (var _i34 = 0; _i34 < _size29; ++_i34) {
                        if (_i34 > 0) {
                            if (input.rstack.length > input.rpos[input.rpos.length - 1] + 1) {
                                input.rstack.pop();
                            }
                        }
                        var key35 = null;
                        var val36 = null;
                        key35 = new Variant();
                        key35.read(input);
                        val36 = new Variant();
                        val36.read(input);
                        this.v_map[key35] = val36;
                    }
                    input.readMapEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

Variant.prototype.write = function (output) {
    output.writeStructBegin('Variant');
    if (this.v_null !== null && this.v_null !== undefined) {
        output.writeFieldBegin('v_null', Thrift.Type.STRING, 1);
        output.writeString(this.v_null);
        output.writeFieldEnd();
    }
    if (this.v_void !== null && this.v_void !== undefined) {
        output.writeFieldBegin('v_void', Thrift.Type.BYTE, 2);
        output.writeByte(this.v_void);
        output.writeFieldEnd();
    }
    if (this.v_boolean !== null && this.v_boolean !== undefined) {
        output.writeFieldBegin('v_boolean', Thrift.Type.BOOL, 3);
        output.writeBool(this.v_boolean);
        output.writeFieldEnd();
    }
    if (this.v_boolean_box !== null && this.v_boolean_box !== undefined) {
        output.writeFieldBegin('v_boolean_box', Thrift.Type.BOOL, 4);
        output.writeBool(this.v_boolean_box);
        output.writeFieldEnd();
    }
    if (this.v_byte !== null && this.v_byte !== undefined) {
        output.writeFieldBegin('v_byte', Thrift.Type.BYTE, 5);
        output.writeByte(this.v_byte);
        output.writeFieldEnd();
    }
    if (this.v_byte_box !== null && this.v_byte_box !== undefined) {
        output.writeFieldBegin('v_byte_box', Thrift.Type.BYTE, 6);
        output.writeByte(this.v_byte_box);
        output.writeFieldEnd();
    }
    if (this.v_short !== null && this.v_short !== undefined) {
        output.writeFieldBegin('v_short', Thrift.Type.I16, 7);
        output.writeI16(this.v_short);
        output.writeFieldEnd();
    }
    if (this.v_short_box !== null && this.v_short_box !== undefined) {
        output.writeFieldBegin('v_short_box', Thrift.Type.I16, 8);
        output.writeI16(this.v_short_box);
        output.writeFieldEnd();
    }
    if (this.v_int !== null && this.v_int !== undefined) {
        output.writeFieldBegin('v_int', Thrift.Type.I32, 9);
        output.writeI32(this.v_int);
        output.writeFieldEnd();
    }
    if (this.v_int_box !== null && this.v_int_box !== undefined) {
        output.writeFieldBegin('v_int_box', Thrift.Type.I32, 10);
        output.writeI32(this.v_int_box);
        output.writeFieldEnd();
    }
    if (this.v_long !== null && this.v_long !== undefined) {
        output.writeFieldBegin('v_long', Thrift.Type.I64, 11);
        output.writeI64(this.v_long);
        output.writeFieldEnd();
    }
    if (this.v_long_box !== null && this.v_long_box !== undefined) {
        output.writeFieldBegin('v_long_box', Thrift.Type.I64, 12);
        output.writeI64(this.v_long_box);
        output.writeFieldEnd();
    }
    if (this.v_float !== null && this.v_float !== undefined) {
        output.writeFieldBegin('v_float', Thrift.Type.DOUBLE, 13);
        output.writeDouble(this.v_float);
        output.writeFieldEnd();
    }
    if (this.v_float_box !== null && this.v_float_box !== undefined) {
        output.writeFieldBegin('v_float_box', Thrift.Type.DOUBLE, 14);
        output.writeDouble(this.v_float_box);
        output.writeFieldEnd();
    }
    if (this.v_double !== null && this.v_double !== undefined) {
        output.writeFieldBegin('v_double', Thrift.Type.DOUBLE, 15);
        output.writeDouble(this.v_double);
        output.writeFieldEnd();
    }
    if (this.v_double_box !== null && this.v_double_box !== undefined) {
        output.writeFieldBegin('v_double_box', Thrift.Type.DOUBLE, 16);
        output.writeDouble(this.v_double_box);
        output.writeFieldEnd();
    }
    if (this.v_string !== null && this.v_string !== undefined) {
        output.writeFieldBegin('v_string', Thrift.Type.STRING, 17);
        output.writeString(this.v_string);
        output.writeFieldEnd();
    }
    if (this.v_object !== null && this.v_object !== undefined) {
        output.writeFieldBegin('v_object', Thrift.Type.STRUCT, 18);
        this.v_object.write(output);
        output.writeFieldEnd();
    }
    if (this.v_array !== null && this.v_array !== undefined) {
        output.writeFieldBegin('v_array', Thrift.Type.LIST, 19);
        output.writeListBegin(Thrift.Type.STRUCT, this.v_array.length);
        for (var iter37 in this.v_array) {
            if (this.v_array.hasOwnProperty(iter37)) {
                iter37 = this.v_array[iter37];
                iter37.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    if (this.v_list !== null && this.v_list !== undefined) {
        output.writeFieldBegin('v_list', Thrift.Type.LIST, 20);
        output.writeListBegin(Thrift.Type.STRUCT, this.v_list.length);
        for (var iter38 in this.v_list) {
            if (this.v_list.hasOwnProperty(iter38)) {
                iter38 = this.v_list[iter38];
                iter38.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    if (this.v_set !== null && this.v_set !== undefined) {
        output.writeFieldBegin('v_set', Thrift.Type.SET, 21);
        output.writeSetBegin(Thrift.Type.STRUCT, this.v_set.length);
        for (var iter39 in this.v_set) {
            if (this.v_set.hasOwnProperty(iter39)) {
                iter39 = this.v_set[iter39];
                iter39.write(output);
            }
        }
        output.writeSetEnd();
        output.writeFieldEnd();
    }
    if (this.v_map !== null && this.v_map !== undefined) {
        output.writeFieldBegin('v_map', Thrift.Type.MAP, 22);
        output.writeMapBegin(Thrift.Type.STRUCT, Thrift.Type.STRUCT, Thrift.objectLength(this.v_map));
        for (var kiter40 in this.v_map) {
            if (this.v_map.hasOwnProperty(kiter40)) {
                var viter41 = this.v_map[kiter40];
                kiter40.write(output);
                viter41.write(output);
            }
        }
        output.writeMapEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

Annotation = function (args) {
    this.name = null;
    this.arguments = null;
    if (args) {
        if (args.name !== undefined && args.name !== null) {
            this.name = args.name;
        }
        if (args.arguments !== undefined && args.arguments !== null) {
            this.arguments = Thrift.copyMap(args.arguments, [null]);
        }
    }
};
Annotation.prototype = {};
Annotation.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.name = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.MAP) {
                    var _size42 = 0;
                    var _rtmp346;
                    this.arguments = {};
                    var _ktype43 = 0;
                    var _vtype44 = 0;
                    _rtmp346 = input.readMapBegin();
                    _ktype43 = _rtmp346.ktype;
                    _vtype44 = _rtmp346.vtype;
                    _size42 = _rtmp346.size;
                    for (var _i47 = 0; _i47 < _size42; ++_i47) {
                        if (_i47 > 0) {
                            if (input.rstack.length > input.rpos[input.rpos.length - 1] + 1) {
                                input.rstack.pop();
                            }
                        }
                        var key48 = null;
                        var val49 = null;
                        key48 = input.readString().value;
                        val49 = input.readString().value;
                        this.arguments[key48] = val49;
                    }
                    input.readMapEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

Annotation.prototype.write = function (output) {
    output.writeStructBegin('Annotation');
    if (this.name !== null && this.name !== undefined) {
        output.writeFieldBegin('name', Thrift.Type.STRING, 1);
        output.writeString(this.name);
        output.writeFieldEnd();
    }
    if (this.arguments !== null && this.arguments !== undefined) {
        output.writeFieldBegin('arguments', Thrift.Type.MAP, 2);
        output.writeMapBegin(Thrift.Type.STRING, Thrift.Type.STRING, Thrift.objectLength(this.arguments));
        for (var kiter50 in this.arguments) {
            if (this.arguments.hasOwnProperty(kiter50)) {
                var viter51 = this.arguments[kiter50];
                output.writeString(kiter50);
                output.writeString(viter51);
            }
        }
        output.writeMapEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

MethodArgument = function (args) {
    this.type = null;
    this.name = null;
    this.annotations = null;
    if (args) {
        if (args.type !== undefined && args.type !== null) {
            this.type = args.type;
        }
        if (args.name !== undefined && args.name !== null) {
            this.name = args.name;
        }
        if (args.annotations !== undefined && args.annotations !== null) {
            this.annotations = Thrift.copyList(args.annotations, [Annotation]);
        }
    }
};
MethodArgument.prototype = {};
MethodArgument.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.type = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.name = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.LIST) {
                    var _size52 = 0;
                    var _rtmp356;
                    this.annotations = [];
                    var _etype55 = 0;
                    _rtmp356 = input.readListBegin();
                    _etype55 = _rtmp356.etype;
                    _size52 = _rtmp356.size;
                    for (var _i57 = 0; _i57 < _size52; ++_i57) {
                        var elem58 = null;
                        elem58 = new Annotation();
                        elem58.read(input);
                        this.annotations.push(elem58);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

MethodArgument.prototype.write = function (output) {
    output.writeStructBegin('MethodArgument');
    if (this.type !== null && this.type !== undefined) {
        output.writeFieldBegin('type', Thrift.Type.STRING, 1);
        output.writeString(this.type);
        output.writeFieldEnd();
    }
    if (this.name !== null && this.name !== undefined) {
        output.writeFieldBegin('name', Thrift.Type.STRING, 2);
        output.writeString(this.name);
        output.writeFieldEnd();
    }
    if (this.annotations !== null && this.annotations !== undefined) {
        output.writeFieldBegin('annotations', Thrift.Type.LIST, 3);
        output.writeListBegin(Thrift.Type.STRUCT, this.annotations.length);
        for (var iter59 in this.annotations) {
            if (this.annotations.hasOwnProperty(iter59)) {
                iter59 = this.annotations[iter59];
                iter59.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

MethodDescription = function (args) {
    this.returnType = null;
    this.name = null;
    this.arguments = null;
    this.annotations = null;
    if (args) {
        if (args.returnType !== undefined && args.returnType !== null) {
            this.returnType = args.returnType;
        }
        if (args.name !== undefined && args.name !== null) {
            this.name = args.name;
        }
        if (args.arguments !== undefined && args.arguments !== null) {
            this.arguments = Thrift.copyList(args.arguments, [MethodArgument]);
        }
        if (args.annotations !== undefined && args.annotations !== null) {
            this.annotations = Thrift.copyList(args.annotations, [Annotation]);
        }
    }
};
MethodDescription.prototype = {};
MethodDescription.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.returnType = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.name = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.LIST) {
                    var _size60 = 0;
                    var _rtmp364;
                    this.arguments = [];
                    var _etype63 = 0;
                    _rtmp364 = input.readListBegin();
                    _etype63 = _rtmp364.etype;
                    _size60 = _rtmp364.size;
                    for (var _i65 = 0; _i65 < _size60; ++_i65) {
                        var elem66 = null;
                        elem66 = new MethodArgument();
                        elem66.read(input);
                        this.arguments.push(elem66);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.LIST) {
                    var _size67 = 0;
                    var _rtmp371;
                    this.annotations = [];
                    var _etype70 = 0;
                    _rtmp371 = input.readListBegin();
                    _etype70 = _rtmp371.etype;
                    _size67 = _rtmp371.size;
                    for (var _i72 = 0; _i72 < _size67; ++_i72) {
                        var elem73 = null;
                        elem73 = new Annotation();
                        elem73.read(input);
                        this.annotations.push(elem73);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

MethodDescription.prototype.write = function (output) {
    output.writeStructBegin('MethodDescription');
    if (this.returnType !== null && this.returnType !== undefined) {
        output.writeFieldBegin('returnType', Thrift.Type.STRING, 1);
        output.writeString(this.returnType);
        output.writeFieldEnd();
    }
    if (this.name !== null && this.name !== undefined) {
        output.writeFieldBegin('name', Thrift.Type.STRING, 2);
        output.writeString(this.name);
        output.writeFieldEnd();
    }
    if (this.arguments !== null && this.arguments !== undefined) {
        output.writeFieldBegin('arguments', Thrift.Type.LIST, 3);
        output.writeListBegin(Thrift.Type.STRUCT, this.arguments.length);
        for (var iter74 in this.arguments) {
            if (this.arguments.hasOwnProperty(iter74)) {
                iter74 = this.arguments[iter74];
                iter74.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    if (this.annotations !== null && this.annotations !== undefined) {
        output.writeFieldBegin('annotations', Thrift.Type.LIST, 4);
        output.writeListBegin(Thrift.Type.STRUCT, this.annotations.length);
        for (var iter75 in this.annotations) {
            if (this.annotations.hasOwnProperty(iter75)) {
                iter75 = this.annotations[iter75];
                iter75.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

ByteCodeObject = function (args) {
    this.name = null;
    this.byteCode = null;
    if (args) {
        if (args.name !== undefined && args.name !== null) {
            this.name = args.name;
        }
        if (args.byteCode !== undefined && args.byteCode !== null) {
            this.byteCode = args.byteCode;
        }
    }
};
ByteCodeObject.prototype = {};
ByteCodeObject.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.name = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.byteCode = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

ByteCodeObject.prototype.write = function (output) {
    output.writeStructBegin('ByteCodeObject');
    if (this.name !== null && this.name !== undefined) {
        output.writeFieldBegin('name', Thrift.Type.STRING, 1);
        output.writeString(this.name);
        output.writeFieldEnd();
    }
    if (this.byteCode !== null && this.byteCode !== undefined) {
        output.writeFieldBegin('byteCode', Thrift.Type.STRING, 2);
        output.writeBinary(this.byteCode);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

APIResponse = function (args) {
    this.code = null;
    this.message = null;
    if (args) {
        if (args.code !== undefined && args.code !== null) {
            this.code = args.code;
        }
        if (args.message !== undefined && args.message !== null) {
            this.message = args.message;
        }
    }
};
APIResponse.prototype = {};
APIResponse.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.BYTE) {
                    this.code = input.readByte().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.message = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

APIResponse.prototype.write = function (output) {
    output.writeStructBegin('APIResponse');
    if (this.code !== null && this.code !== undefined) {
        output.writeFieldBegin('code', Thrift.Type.BYTE, 1);
        output.writeByte(this.code);
        output.writeFieldEnd();
    }
    if (this.message !== null && this.message !== undefined) {
        output.writeFieldBegin('message', Thrift.Type.STRING, 2);
        output.writeString(this.message);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

//
// Autogenerated by Thrift Compiler (0.11.0)
//
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
//


TransactionType = {
    'TT_Normal': 0,
    'TT_SmartDeploy': 1,
    'TT_SmartExecute': 2,
    'TT_SmartState': 3
};
SmartOperationState = {
    'SOS_Pending': 0,
    'SOS_Success': 1,
    'SOS_Failed': 2
};
TransactionState = {
    'INVALID': 0,
    'VALID': 1,
    'INPROGRESS': 2
};
TokenStandart = {
    'NotAToken': 0,
    'CreditsBasic': 1,
    'CreditsExtended': 2
};
TokensListSortField = {
    'TL_Code': 0,
    'TL_Name': 1,
    'TL_Address': 2,
    'TL_TotalSupply': 3,
    'TL_HoldersCount': 4,
    'TL_TransfersCount': 5,
    'TL_TransactionsCount': 6
};
TokenHoldersSortField = {
    'TH_Balance': 0,
    'TH_TransfersCount': 1
};
Amount = function (args) {
    this.integral = 0;
    this.fraction = 0;
    if (args) {
        if (args.integral !== undefined && args.integral !== null) {
            this.integral = args.integral;
        } else {
            throw new Thrift.TProtocolException(Thrift.TProtocolExceptionType.UNKNOWN, 'Required field integral is unset!');
        }
        if (args.fraction !== undefined && args.fraction !== null) {
            this.fraction = args.fraction;
        } else {
            throw new Thrift.TProtocolException(Thrift.TProtocolExceptionType.UNKNOWN, 'Required field fraction is unset!');
        }
    }
};
Amount.prototype = {};
Amount.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.I32) {
                    this.integral = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.fraction = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

Amount.prototype.write = function (output) {
    output.writeStructBegin('Amount');
    if (this.integral !== null && this.integral !== undefined) {
        output.writeFieldBegin('integral', Thrift.Type.I32, 1);
        output.writeI32(this.integral);
        output.writeFieldEnd();
    }
    if (this.fraction !== null && this.fraction !== undefined) {
        output.writeFieldBegin('fraction', Thrift.Type.I64, 2);
        output.writeI64(this.fraction);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

AmountCommission = function (args) {
    this.commission = 0;
    if (args) {
        if (args.commission !== undefined && args.commission !== null) {
            this.commission = args.commission;
        } else {
            throw new Thrift.TProtocolException(Thrift.TProtocolExceptionType.UNKNOWN, 'Required field commission is unset!');
        }
    }
};
AmountCommission.prototype = {};
AmountCommission.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.I16) {
                    this.commission = input.readI16().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

AmountCommission.prototype.write = function (output) {
    output.writeStructBegin('AmountCommission');
    if (this.commission !== null && this.commission !== undefined) {
        output.writeFieldBegin('commission', Thrift.Type.I16, 1);
        output.writeI16(this.commission);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

CumulativeAmount = function (args) {
    this.integral = 0;
    this.fraction = 0;
    if (args) {
        if (args.integral !== undefined && args.integral !== null) {
            this.integral = args.integral;
        } else {
            throw new Thrift.TProtocolException(Thrift.TProtocolExceptionType.UNKNOWN, 'Required field integral is unset!');
        }
        if (args.fraction !== undefined && args.fraction !== null) {
            this.fraction = args.fraction;
        } else {
            throw new Thrift.TProtocolException(Thrift.TProtocolExceptionType.UNKNOWN, 'Required field fraction is unset!');
        }
    }
};
CumulativeAmount.prototype = {};
CumulativeAmount.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.I64) {
                    this.integral = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.fraction = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

CumulativeAmount.prototype.write = function (output) {
    output.writeStructBegin('CumulativeAmount');
    if (this.integral !== null && this.integral !== undefined) {
        output.writeFieldBegin('integral', Thrift.Type.I64, 1);
        output.writeI64(this.integral);
        output.writeFieldEnd();
    }
    if (this.fraction !== null && this.fraction !== undefined) {
        output.writeFieldBegin('fraction', Thrift.Type.I64, 2);
        output.writeI64(this.fraction);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

SmartContractDeploy = function (args) {
    this.sourceCode = null;
    this.byteCodeObjects = null;
    this.hashState = null;
    this.tokenStandart = null;
    if (args) {
        if (args.sourceCode !== undefined && args.sourceCode !== null) {
            this.sourceCode = args.sourceCode;
        }
        if (args.byteCodeObjects !== undefined && args.byteCodeObjects !== null) {
            this.byteCodeObjects = Thrift.copyList(args.byteCodeObjects, [ByteCodeObject]);
        }
        if (args.hashState !== undefined && args.hashState !== null) {
            this.hashState = args.hashState;
        }
        if (args.tokenStandart !== undefined && args.tokenStandart !== null) {
            this.tokenStandart = args.tokenStandart;
        }
    }
};
SmartContractDeploy.prototype = {};
SmartContractDeploy.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.sourceCode = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.LIST) {
                    var _size0 = 0;
                    var _rtmp34;
                    this.byteCodeObjects = [];
                    var _etype3 = 0;
                    _rtmp34 = input.readListBegin();
                    _etype3 = _rtmp34.etype;
                    _size0 = _rtmp34.size;
                    for (var _i5 = 0; _i5 < _size0; ++_i5) {
                        var elem6 = null;
                        elem6 = new ByteCodeObject();
                        elem6.read(input);
                        this.byteCodeObjects.push(elem6);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.STRING) {
                    this.hashState = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.I32) {
                    this.tokenStandart = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

SmartContractDeploy.prototype.write = function (output) {
    output.writeStructBegin('SmartContractDeploy');
    if (this.sourceCode !== null && this.sourceCode !== undefined) {
        output.writeFieldBegin('sourceCode', Thrift.Type.STRING, 1);
        output.writeString(this.sourceCode);
        output.writeFieldEnd();
    }
    if (this.byteCodeObjects !== null && this.byteCodeObjects !== undefined) {
        output.writeFieldBegin('byteCodeObjects', Thrift.Type.LIST, 2);
        output.writeListBegin(Thrift.Type.STRUCT, this.byteCodeObjects.length);
        for (var iter7 in this.byteCodeObjects) {
            if (this.byteCodeObjects.hasOwnProperty(iter7)) {
                iter7 = this.byteCodeObjects[iter7];
                iter7.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    if (this.hashState !== null && this.hashState !== undefined) {
        output.writeFieldBegin('hashState', Thrift.Type.STRING, 3);
        output.writeString(this.hashState);
        output.writeFieldEnd();
    }
    if (this.tokenStandart !== null && this.tokenStandart !== undefined) {
        output.writeFieldBegin('tokenStandart', Thrift.Type.I32, 4);
        output.writeI32(this.tokenStandart);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

SmartContract = function (args) {
    this.address = null;
    this.deployer = null;
    this.smartContractDeploy = null;
    this.objectState = null;
    this.createTime = null;
    this.transactionsCount = null;
    if (args) {
        if (args.address !== undefined && args.address !== null) {
            this.address = args.address;
        } else {
            throw new Thrift.TProtocolException(Thrift.TProtocolExceptionType.UNKNOWN, 'Required field address is unset!');
        }
        if (args.deployer !== undefined && args.deployer !== null) {
            this.deployer = args.deployer;
        }
        if (args.smartContractDeploy !== undefined && args.smartContractDeploy !== null) {
            this.smartContractDeploy = new SmartContractDeploy(args.smartContractDeploy);
        }
        if (args.objectState !== undefined && args.objectState !== null) {
            this.objectState = args.objectState;
        }
        if (args.createTime !== undefined && args.createTime !== null) {
            this.createTime = args.createTime;
        }
        if (args.transactionsCount !== undefined && args.transactionsCount !== null) {
            this.transactionsCount = args.transactionsCount;
        }
    }
};
SmartContract.prototype = {};
SmartContract.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.address = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.deployer = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.STRUCT) {
                    this.smartContractDeploy = new SmartContractDeploy();
                    this.smartContractDeploy.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.STRING) {
                    this.objectState = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 5:
                if (ftype == Thrift.Type.I64) {
                    this.createTime = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 6:
                if (ftype == Thrift.Type.I32) {
                    this.transactionsCount = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

SmartContract.prototype.write = function (output) {
    output.writeStructBegin('SmartContract');
    if (this.address !== null && this.address !== undefined) {
        output.writeFieldBegin('address', Thrift.Type.STRING, 1);
        output.writeBinary(this.address);
        output.writeFieldEnd();
    }
    if (this.deployer !== null && this.deployer !== undefined) {
        output.writeFieldBegin('deployer', Thrift.Type.STRING, 2);
        output.writeBinary(this.deployer);
        output.writeFieldEnd();
    }
    if (this.smartContractDeploy !== null && this.smartContractDeploy !== undefined) {
        output.writeFieldBegin('smartContractDeploy', Thrift.Type.STRUCT, 3);
        this.smartContractDeploy.write(output);
        output.writeFieldEnd();
    }
    if (this.objectState !== null && this.objectState !== undefined) {
        output.writeFieldBegin('objectState', Thrift.Type.STRING, 4);
        output.writeBinary(this.objectState);
        output.writeFieldEnd();
    }
    if (this.createTime !== null && this.createTime !== undefined) {
        output.writeFieldBegin('createTime', Thrift.Type.I64, 5);
        output.writeI64(this.createTime);
        output.writeFieldEnd();
    }
    if (this.transactionsCount !== null && this.transactionsCount !== undefined) {
        output.writeFieldBegin('transactionsCount', Thrift.Type.I32, 6);
        output.writeI32(this.transactionsCount);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

SmartContractInvocation = function (args) {
    this.method = null;
    this.params = null;
    this.usedContracts = null;
    this.forgetNewState = null;
    this.smartContractDeploy = null;
    if (args) {
        if (args.method !== undefined && args.method !== null) {
            this.method = args.method;
        }
        if (args.params !== undefined && args.params !== null) {
            this.params = Thrift.copyList(args.params, [Variant]);
        }
        if (args.usedContracts !== undefined && args.usedContracts !== null) {
            this.usedContracts = Thrift.copyList(args.usedContracts, [null]);
        }
        if (args.forgetNewState !== undefined && args.forgetNewState !== null) {
            this.forgetNewState = args.forgetNewState;
        }
        if (args.smartContractDeploy !== undefined && args.smartContractDeploy !== null) {
            this.smartContractDeploy = new SmartContractDeploy(args.smartContractDeploy);
        }
    }
};
SmartContractInvocation.prototype = {};
SmartContractInvocation.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.method = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.LIST) {
                    var _size8 = 0;
                    var _rtmp312;
                    this.params = [];
                    var _etype11 = 0;
                    _rtmp312 = input.readListBegin();
                    _etype11 = _rtmp312.etype;
                    _size8 = _rtmp312.size;
                    for (var _i13 = 0; _i13 < _size8; ++_i13) {
                        var elem14 = null;
                        elem14 = new Variant();
                        elem14.read(input);
                        this.params.push(elem14);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.LIST) {
                    var _size15 = 0;
                    var _rtmp319;
                    this.usedContracts = [];
                    var _etype18 = 0;
                    _rtmp319 = input.readListBegin();
                    _etype18 = _rtmp319.etype;
                    _size15 = _rtmp319.size;
                    for (var _i20 = 0; _i20 < _size15; ++_i20) {
                        var elem21 = null;
                        elem21 = input.readBinary().value;
                        this.usedContracts.push(elem21);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.BOOL) {
                    this.forgetNewState = input.readBool().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 5:
                if (ftype == Thrift.Type.STRUCT) {
                    this.smartContractDeploy = new SmartContractDeploy();
                    this.smartContractDeploy.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

SmartContractInvocation.prototype.write = function (output) {
    output.writeStructBegin('SmartContractInvocation');
    if (this.method !== null && this.method !== undefined) {
        output.writeFieldBegin('method', Thrift.Type.STRING, 1);
        output.writeString(this.method);
        output.writeFieldEnd();
    }
    if (this.params !== null && this.params !== undefined) {
        output.writeFieldBegin('params', Thrift.Type.LIST, 2);
        output.writeListBegin(Thrift.Type.STRUCT, this.params.length);
        for (var iter22 in this.params) {
            if (this.params.hasOwnProperty(iter22)) {
                iter22 = this.params[iter22];
                iter22.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    if (this.usedContracts !== null && this.usedContracts !== undefined) {
        output.writeFieldBegin('usedContracts', Thrift.Type.LIST, 3);
        output.writeListBegin(Thrift.Type.STRING, this.usedContracts.length);
        for (var iter23 in this.usedContracts) {
            if (this.usedContracts.hasOwnProperty(iter23)) {
                iter23 = this.usedContracts[iter23];
                output.writeBinary(iter23);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    if (this.forgetNewState !== null && this.forgetNewState !== undefined) {
        output.writeFieldBegin('forgetNewState', Thrift.Type.BOOL, 4);
        output.writeBool(this.forgetNewState);
        output.writeFieldEnd();
    }
    if (this.smartContractDeploy !== null && this.smartContractDeploy !== undefined) {
        output.writeFieldBegin('smartContractDeploy', Thrift.Type.STRUCT, 5);
        this.smartContractDeploy.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TransactionId = function (args) {
    this.poolHash = null;
    this.index = null;
    if (args) {
        if (args.poolHash !== undefined && args.poolHash !== null) {
            this.poolHash = args.poolHash;
        }
        if (args.index !== undefined && args.index !== null) {
            this.index = args.index;
        }
    }
};
TransactionId.prototype = {};
TransactionId.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.poolHash = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I32) {
                    this.index = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TransactionId.prototype.write = function (output) {
    output.writeStructBegin('TransactionId');
    if (this.poolHash !== null && this.poolHash !== undefined) {
        output.writeFieldBegin('poolHash', Thrift.Type.STRING, 1);
        output.writeBinary(this.poolHash);
        output.writeFieldEnd();
    }
    if (this.index !== null && this.index !== undefined) {
        output.writeFieldBegin('index', Thrift.Type.I32, 2);
        output.writeI32(this.index);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TokenDeployTransInfo = function (args) {
    this.name = null;
    this.code = null;
    this.standart = null;
    this.state = null;
    this.stateTransaction = null;
    if (args) {
        if (args.name !== undefined && args.name !== null) {
            this.name = args.name;
        }
        if (args.code !== undefined && args.code !== null) {
            this.code = args.code;
        }
        if (args.standart !== undefined && args.standart !== null) {
            this.standart = args.standart;
        }
        if (args.state !== undefined && args.state !== null) {
            this.state = args.state;
        }
        if (args.stateTransaction !== undefined && args.stateTransaction !== null) {
            this.stateTransaction = new TransactionId(args.stateTransaction);
        }
    }
};
TokenDeployTransInfo.prototype = {};
TokenDeployTransInfo.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.name = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.code = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I32) {
                    this.standart = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.I32) {
                    this.state = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 5:
                if (ftype == Thrift.Type.STRUCT) {
                    this.stateTransaction = new TransactionId();
                    this.stateTransaction.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TokenDeployTransInfo.prototype.write = function (output) {
    output.writeStructBegin('TokenDeployTransInfo');
    if (this.name !== null && this.name !== undefined) {
        output.writeFieldBegin('name', Thrift.Type.STRING, 1);
        output.writeString(this.name);
        output.writeFieldEnd();
    }
    if (this.code !== null && this.code !== undefined) {
        output.writeFieldBegin('code', Thrift.Type.STRING, 2);
        output.writeString(this.code);
        output.writeFieldEnd();
    }
    if (this.standart !== null && this.standart !== undefined) {
        output.writeFieldBegin('standart', Thrift.Type.I32, 3);
        output.writeI32(this.standart);
        output.writeFieldEnd();
    }
    if (this.state !== null && this.state !== undefined) {
        output.writeFieldBegin('state', Thrift.Type.I32, 4);
        output.writeI32(this.state);
        output.writeFieldEnd();
    }
    if (this.stateTransaction !== null && this.stateTransaction !== undefined) {
        output.writeFieldBegin('stateTransaction', Thrift.Type.STRUCT, 5);
        this.stateTransaction.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TokenTransferTransInfo = function (args) {
    this.code = null;
    this.sender = null;
    this.receiver = null;
    this.amount = null;
    this.state = null;
    this.stateTransaction = null;
    this.transferSuccess = null;
    if (args) {
        if (args.code !== undefined && args.code !== null) {
            this.code = args.code;
        }
        if (args.sender !== undefined && args.sender !== null) {
            this.sender = args.sender;
        }
        if (args.receiver !== undefined && args.receiver !== null) {
            this.receiver = args.receiver;
        }
        if (args.amount !== undefined && args.amount !== null) {
            this.amount = args.amount;
        }
        if (args.state !== undefined && args.state !== null) {
            this.state = args.state;
        }
        if (args.stateTransaction !== undefined && args.stateTransaction !== null) {
            this.stateTransaction = new TransactionId(args.stateTransaction);
        }
        if (args.transferSuccess !== undefined && args.transferSuccess !== null) {
            this.transferSuccess = args.transferSuccess;
        }
    }
};
TokenTransferTransInfo.prototype = {};
TokenTransferTransInfo.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.code = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.sender = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.STRING) {
                    this.receiver = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.STRING) {
                    this.amount = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 5:
                if (ftype == Thrift.Type.I32) {
                    this.state = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 6:
                if (ftype == Thrift.Type.STRUCT) {
                    this.stateTransaction = new TransactionId();
                    this.stateTransaction.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 7:
                if (ftype == Thrift.Type.BOOL) {
                    this.transferSuccess = input.readBool().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TokenTransferTransInfo.prototype.write = function (output) {
    output.writeStructBegin('TokenTransferTransInfo');
    if (this.code !== null && this.code !== undefined) {
        output.writeFieldBegin('code', Thrift.Type.STRING, 1);
        output.writeString(this.code);
        output.writeFieldEnd();
    }
    if (this.sender !== null && this.sender !== undefined) {
        output.writeFieldBegin('sender', Thrift.Type.STRING, 2);
        output.writeBinary(this.sender);
        output.writeFieldEnd();
    }
    if (this.receiver !== null && this.receiver !== undefined) {
        output.writeFieldBegin('receiver', Thrift.Type.STRING, 3);
        output.writeBinary(this.receiver);
        output.writeFieldEnd();
    }
    if (this.amount !== null && this.amount !== undefined) {
        output.writeFieldBegin('amount', Thrift.Type.STRING, 4);
        output.writeString(this.amount);
        output.writeFieldEnd();
    }
    if (this.state !== null && this.state !== undefined) {
        output.writeFieldBegin('state', Thrift.Type.I32, 5);
        output.writeI32(this.state);
        output.writeFieldEnd();
    }
    if (this.stateTransaction !== null && this.stateTransaction !== undefined) {
        output.writeFieldBegin('stateTransaction', Thrift.Type.STRUCT, 6);
        this.stateTransaction.write(output);
        output.writeFieldEnd();
    }
    if (this.transferSuccess !== null && this.transferSuccess !== undefined) {
        output.writeFieldBegin('transferSuccess', Thrift.Type.BOOL, 7);
        output.writeBool(this.transferSuccess);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

SmartDeployTransInfo = function (args) {
    this.state = null;
    this.stateTransaction = null;
    if (args) {
        if (args.state !== undefined && args.state !== null) {
            this.state = args.state;
        }
        if (args.stateTransaction !== undefined && args.stateTransaction !== null) {
            this.stateTransaction = new TransactionId(args.stateTransaction);
        }
    }
};
SmartDeployTransInfo.prototype = {};
SmartDeployTransInfo.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.I32) {
                    this.state = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRUCT) {
                    this.stateTransaction = new TransactionId();
                    this.stateTransaction.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

SmartDeployTransInfo.prototype.write = function (output) {
    output.writeStructBegin('SmartDeployTransInfo');
    if (this.state !== null && this.state !== undefined) {
        output.writeFieldBegin('state', Thrift.Type.I32, 1);
        output.writeI32(this.state);
        output.writeFieldEnd();
    }
    if (this.stateTransaction !== null && this.stateTransaction !== undefined) {
        output.writeFieldBegin('stateTransaction', Thrift.Type.STRUCT, 2);
        this.stateTransaction.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

SmartExecutionTransInfo = function (args) {
    this.method = null;
    this.params = null;
    this.state = null;
    this.stateTransaction = null;
    if (args) {
        if (args.method !== undefined && args.method !== null) {
            this.method = args.method;
        }
        if (args.params !== undefined && args.params !== null) {
            this.params = Thrift.copyList(args.params, [Variant]);
        }
        if (args.state !== undefined && args.state !== null) {
            this.state = args.state;
        }
        if (args.stateTransaction !== undefined && args.stateTransaction !== null) {
            this.stateTransaction = new TransactionId(args.stateTransaction);
        }
    }
};
SmartExecutionTransInfo.prototype = {};
SmartExecutionTransInfo.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.method = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.LIST) {
                    var _size24 = 0;
                    var _rtmp328;
                    this.params = [];
                    var _etype27 = 0;
                    _rtmp328 = input.readListBegin();
                    _etype27 = _rtmp328.etype;
                    _size24 = _rtmp328.size;
                    for (var _i29 = 0; _i29 < _size24; ++_i29) {
                        var elem30 = null;
                        elem30 = new Variant();
                        elem30.read(input);
                        this.params.push(elem30);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I32) {
                    this.state = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.STRUCT) {
                    this.stateTransaction = new TransactionId();
                    this.stateTransaction.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

SmartExecutionTransInfo.prototype.write = function (output) {
    output.writeStructBegin('SmartExecutionTransInfo');
    if (this.method !== null && this.method !== undefined) {
        output.writeFieldBegin('method', Thrift.Type.STRING, 1);
        output.writeString(this.method);
        output.writeFieldEnd();
    }
    if (this.params !== null && this.params !== undefined) {
        output.writeFieldBegin('params', Thrift.Type.LIST, 2);
        output.writeListBegin(Thrift.Type.STRUCT, this.params.length);
        for (var iter31 in this.params) {
            if (this.params.hasOwnProperty(iter31)) {
                iter31 = this.params[iter31];
                iter31.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    if (this.state !== null && this.state !== undefined) {
        output.writeFieldBegin('state', Thrift.Type.I32, 3);
        output.writeI32(this.state);
        output.writeFieldEnd();
    }
    if (this.stateTransaction !== null && this.stateTransaction !== undefined) {
        output.writeFieldBegin('stateTransaction', Thrift.Type.STRUCT, 4);
        this.stateTransaction.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

SmartStateTransInfo = function (args) {
    this.success = null;
    this.executionFee = null;
    this.returnValue = null;
    this.startTransaction = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = args.success;
        }
        if (args.executionFee !== undefined && args.executionFee !== null) {
            this.executionFee = new Amount(args.executionFee);
        }
        if (args.returnValue !== undefined && args.returnValue !== null) {
            this.returnValue = new Variant(args.returnValue);
        }
        if (args.startTransaction !== undefined && args.startTransaction !== null) {
            this.startTransaction = new TransactionId(args.startTransaction);
        }
    }
};
SmartStateTransInfo.prototype = {};
SmartStateTransInfo.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.BOOL) {
                    this.success = input.readBool().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRUCT) {
                    this.executionFee = new Amount();
                    this.executionFee.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.STRUCT) {
                    this.returnValue = new Variant();
                    this.returnValue.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.STRUCT) {
                    this.startTransaction = new TransactionId();
                    this.startTransaction.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

SmartStateTransInfo.prototype.write = function (output) {
    output.writeStructBegin('SmartStateTransInfo');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.BOOL, 1);
        output.writeBool(this.success);
        output.writeFieldEnd();
    }
    if (this.executionFee !== null && this.executionFee !== undefined) {
        output.writeFieldBegin('executionFee', Thrift.Type.STRUCT, 2);
        this.executionFee.write(output);
        output.writeFieldEnd();
    }
    if (this.returnValue !== null && this.returnValue !== undefined) {
        output.writeFieldBegin('returnValue', Thrift.Type.STRUCT, 3);
        this.returnValue.write(output);
        output.writeFieldEnd();
    }
    if (this.startTransaction !== null && this.startTransaction !== undefined) {
        output.writeFieldBegin('startTransaction', Thrift.Type.STRUCT, 4);
        this.startTransaction.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

SmartTransInfo = function (args) {
    this.v_tokenDeploy = null;
    this.v_tokenTransfer = null;
    this.v_smartDeploy = null;
    this.v_smartExecution = null;
    this.v_smartState = null;
    if (args) {
        if (args.v_tokenDeploy !== undefined && args.v_tokenDeploy !== null) {
            this.v_tokenDeploy = new TokenDeployTransInfo(args.v_tokenDeploy);
        }
        if (args.v_tokenTransfer !== undefined && args.v_tokenTransfer !== null) {
            this.v_tokenTransfer = new TokenTransferTransInfo(args.v_tokenTransfer);
        }
        if (args.v_smartDeploy !== undefined && args.v_smartDeploy !== null) {
            this.v_smartDeploy = new SmartDeployTransInfo(args.v_smartDeploy);
        }
        if (args.v_smartExecution !== undefined && args.v_smartExecution !== null) {
            this.v_smartExecution = new SmartExecutionTransInfo(args.v_smartExecution);
        }
        if (args.v_smartState !== undefined && args.v_smartState !== null) {
            this.v_smartState = new SmartStateTransInfo(args.v_smartState);
        }
    }
};
SmartTransInfo.prototype = {};
SmartTransInfo.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.v_tokenDeploy = new TokenDeployTransInfo();
                    this.v_tokenDeploy.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRUCT) {
                    this.v_tokenTransfer = new TokenTransferTransInfo();
                    this.v_tokenTransfer.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.STRUCT) {
                    this.v_smartDeploy = new SmartDeployTransInfo();
                    this.v_smartDeploy.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.STRUCT) {
                    this.v_smartExecution = new SmartExecutionTransInfo();
                    this.v_smartExecution.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 5:
                if (ftype == Thrift.Type.STRUCT) {
                    this.v_smartState = new SmartStateTransInfo();
                    this.v_smartState.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

SmartTransInfo.prototype.write = function (output) {
    output.writeStructBegin('SmartTransInfo');
    if (this.v_tokenDeploy !== null && this.v_tokenDeploy !== undefined) {
        output.writeFieldBegin('v_tokenDeploy', Thrift.Type.STRUCT, 1);
        this.v_tokenDeploy.write(output);
        output.writeFieldEnd();
    }
    if (this.v_tokenTransfer !== null && this.v_tokenTransfer !== undefined) {
        output.writeFieldBegin('v_tokenTransfer', Thrift.Type.STRUCT, 2);
        this.v_tokenTransfer.write(output);
        output.writeFieldEnd();
    }
    if (this.v_smartDeploy !== null && this.v_smartDeploy !== undefined) {
        output.writeFieldBegin('v_smartDeploy', Thrift.Type.STRUCT, 3);
        this.v_smartDeploy.write(output);
        output.writeFieldEnd();
    }
    if (this.v_smartExecution !== null && this.v_smartExecution !== undefined) {
        output.writeFieldBegin('v_smartExecution', Thrift.Type.STRUCT, 4);
        this.v_smartExecution.write(output);
        output.writeFieldEnd();
    }
    if (this.v_smartState !== null && this.v_smartState !== undefined) {
        output.writeFieldBegin('v_smartState', Thrift.Type.STRUCT, 5);
        this.v_smartState.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

Transaction = function (args) {
    this.id = null;
    this.source = null;
    this.target = null;
    this.amount = null;
    this.balance = null;
    this.currency = null;
    this.signature = null;
    this.smartContract = null;
    this.fee = null;
    this.timeCreation = null;
    this.userFields = null;
    this.type = null;
    this.smartInfo = null;
    if (args) {
        if (args.id !== undefined && args.id !== null) {
            this.id = args.id;
        }
        if (args.source !== undefined && args.source !== null) {
            this.source = args.source;
        }
        if (args.target !== undefined && args.target !== null) {
            this.target = args.target;
        }
        if (args.amount !== undefined && args.amount !== null) {
            this.amount = new Amount(args.amount);
        }
        if (args.balance !== undefined && args.balance !== null) {
            this.balance = new Amount(args.balance);
        }
        if (args.currency !== undefined && args.currency !== null) {
            this.currency = args.currency;
        }
        if (args.signature !== undefined && args.signature !== null) {
            this.signature = args.signature;
        }
        if (args.smartContract !== undefined && args.smartContract !== null) {
            this.smartContract = new SmartContractInvocation(args.smartContract);
        }
        if (args.fee !== undefined && args.fee !== null) {
            this.fee = new AmountCommission(args.fee);
        }
        if (args.timeCreation !== undefined && args.timeCreation !== null) {
            this.timeCreation = args.timeCreation;
        }
        if (args.userFields !== undefined && args.userFields !== null) {
            this.userFields = args.userFields;
        }
        if (args.type !== undefined && args.type !== null) {
            this.type = args.type;
        }
        if (args.smartInfo !== undefined && args.smartInfo !== null) {
            this.smartInfo = new SmartTransInfo(args.smartInfo);
        }
    }
};
Transaction.prototype = {};
Transaction.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.I64) {
                    this.id = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.source = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.STRING) {
                    this.target = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.STRUCT) {
                    this.amount = new Amount();
                    this.amount.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 5:
                if (ftype == Thrift.Type.STRUCT) {
                    this.balance = new Amount();
                    this.balance.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 6:
                if (ftype == Thrift.Type.BYTE) {
                    this.currency = input.readByte().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 7:
                if (ftype == Thrift.Type.STRING) {
                    this.signature = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 8:
                if (ftype == Thrift.Type.STRUCT) {
                    this.smartContract = new SmartContractInvocation();
                    this.smartContract.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 9:
                if (ftype == Thrift.Type.STRUCT) {
                    this.fee = new AmountCommission();
                    this.fee.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 10:
                if (ftype == Thrift.Type.I64) {
                    this.timeCreation = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 11:
                if (ftype == Thrift.Type.STRING) {
                    this.userFields = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 12:
                if (ftype == Thrift.Type.I32) {
                    this.type = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 13:
                if (ftype == Thrift.Type.STRUCT) {
                    this.smartInfo = new SmartTransInfo();
                    this.smartInfo.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

Transaction.prototype.write = function (output) {
    output.writeStructBegin('Transaction');
    if (this.id !== null && this.id !== undefined) {
        output.writeFieldBegin('id', Thrift.Type.I64, 1);
        output.writeI64(this.id);
        output.writeFieldEnd();
    }
    if (this.source !== null && this.source !== undefined) {
        output.writeFieldBegin('source', Thrift.Type.STRING, 2);
        output.writeBinary(this.source);
        output.writeFieldEnd();
    }
    if (this.target !== null && this.target !== undefined) {
        output.writeFieldBegin('target', Thrift.Type.STRING, 3);
        output.writeBinary(this.target);
        output.writeFieldEnd();
    }
    if (this.amount !== null && this.amount !== undefined) {
        output.writeFieldBegin('amount', Thrift.Type.STRUCT, 4);
        this.amount.write(output);
        output.writeFieldEnd();
    }
    if (this.balance !== null && this.balance !== undefined) {
        output.writeFieldBegin('balance', Thrift.Type.STRUCT, 5);
        this.balance.write(output);
        output.writeFieldEnd();
    }
    if (this.currency !== null && this.currency !== undefined) {
        output.writeFieldBegin('currency', Thrift.Type.BYTE, 6);
        output.writeByte(this.currency);
        output.writeFieldEnd();
    }
    if (this.signature !== null && this.signature !== undefined) {
        output.writeFieldBegin('signature', Thrift.Type.STRING, 7);
        output.writeBinary(this.signature);
        output.writeFieldEnd();
    }
    if (this.smartContract !== null && this.smartContract !== undefined) {
        output.writeFieldBegin('smartContract', Thrift.Type.STRUCT, 8);
        this.smartContract.write(output);
        output.writeFieldEnd();
    }
    if (this.fee !== null && this.fee !== undefined) {
        output.writeFieldBegin('fee', Thrift.Type.STRUCT, 9);
        this.fee.write(output);
        output.writeFieldEnd();
    }
    if (this.timeCreation !== null && this.timeCreation !== undefined) {
        output.writeFieldBegin('timeCreation', Thrift.Type.I64, 10);
        output.writeI64(this.timeCreation);
        output.writeFieldEnd();
    }
    if (this.userFields !== null && this.userFields !== undefined) {
        output.writeFieldBegin('userFields', Thrift.Type.STRING, 11);
        output.writeBinary(this.userFields);
        output.writeFieldEnd();
    }
    if (this.type !== null && this.type !== undefined) {
        output.writeFieldBegin('type', Thrift.Type.I32, 12);
        output.writeI32(this.type);
        output.writeFieldEnd();
    }
    if (this.smartInfo !== null && this.smartInfo !== undefined) {
        output.writeFieldBegin('smartInfo', Thrift.Type.STRUCT, 13);
        this.smartInfo.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

SealedTransaction = function (args) {
    this.id = null;
    this.trxn = null;
    if (args) {
        if (args.id !== undefined && args.id !== null) {
            this.id = new TransactionId(args.id);
        }
        if (args.trxn !== undefined && args.trxn !== null) {
            this.trxn = new Transaction(args.trxn);
        }
    }
};
SealedTransaction.prototype = {};
SealedTransaction.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.id = new TransactionId();
                    this.id.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRUCT) {
                    this.trxn = new Transaction();
                    this.trxn.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

SealedTransaction.prototype.write = function (output) {
    output.writeStructBegin('SealedTransaction');
    if (this.id !== null && this.id !== undefined) {
        output.writeFieldBegin('id', Thrift.Type.STRUCT, 1);
        this.id.write(output);
        output.writeFieldEnd();
    }
    if (this.trxn !== null && this.trxn !== undefined) {
        output.writeFieldBegin('trxn', Thrift.Type.STRUCT, 2);
        this.trxn.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

Pool = function (args) {
    this.hash = null;
    this.prevHash = null;
    this.time = null;
    this.transactionsCount = null;
    this.poolNumber = null;
    this.writer = null;
    this.totalFee = null;
    if (args) {
        if (args.hash !== undefined && args.hash !== null) {
            this.hash = args.hash;
        }
        if (args.prevHash !== undefined && args.prevHash !== null) {
            this.prevHash = args.prevHash;
        }
        if (args.time !== undefined && args.time !== null) {
            this.time = args.time;
        }
        if (args.transactionsCount !== undefined && args.transactionsCount !== null) {
            this.transactionsCount = args.transactionsCount;
        }
        if (args.poolNumber !== undefined && args.poolNumber !== null) {
            this.poolNumber = args.poolNumber;
        }
        if (args.writer !== undefined && args.writer !== null) {
            this.writer = args.writer;
        }
        if (args.totalFee !== undefined && args.totalFee !== null) {
            this.totalFee = new Amount(args.totalFee);
        }
    }
};
Pool.prototype = {};
Pool.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.hash = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.prevHash = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I64) {
                    this.time = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.I32) {
                    this.transactionsCount = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 5:
                if (ftype == Thrift.Type.I64) {
                    this.poolNumber = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 6:
                if (ftype == Thrift.Type.STRING) {
                    this.writer = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 7:
                if (ftype == Thrift.Type.STRUCT) {
                    this.totalFee = new Amount();
                    this.totalFee.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

Pool.prototype.write = function (output) {
    output.writeStructBegin('Pool');
    if (this.hash !== null && this.hash !== undefined) {
        output.writeFieldBegin('hash', Thrift.Type.STRING, 1);
        output.writeBinary(this.hash);
        output.writeFieldEnd();
    }
    if (this.prevHash !== null && this.prevHash !== undefined) {
        output.writeFieldBegin('prevHash', Thrift.Type.STRING, 2);
        output.writeBinary(this.prevHash);
        output.writeFieldEnd();
    }
    if (this.time !== null && this.time !== undefined) {
        output.writeFieldBegin('time', Thrift.Type.I64, 3);
        output.writeI64(this.time);
        output.writeFieldEnd();
    }
    if (this.transactionsCount !== null && this.transactionsCount !== undefined) {
        output.writeFieldBegin('transactionsCount', Thrift.Type.I32, 4);
        output.writeI32(this.transactionsCount);
        output.writeFieldEnd();
    }
    if (this.poolNumber !== null && this.poolNumber !== undefined) {
        output.writeFieldBegin('poolNumber', Thrift.Type.I64, 5);
        output.writeI64(this.poolNumber);
        output.writeFieldEnd();
    }
    if (this.writer !== null && this.writer !== undefined) {
        output.writeFieldBegin('writer', Thrift.Type.STRING, 6);
        output.writeBinary(this.writer);
        output.writeFieldEnd();
    }
    if (this.totalFee !== null && this.totalFee !== undefined) {
        output.writeFieldBegin('totalFee', Thrift.Type.STRUCT, 7);
        this.totalFee.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

WalletData = function (args) {
    this.walletId = null;
    this.balance = null;
    this.lastTransactionId = null;
    if (args) {
        if (args.walletId !== undefined && args.walletId !== null) {
            this.walletId = args.walletId;
        }
        if (args.balance !== undefined && args.balance !== null) {
            this.balance = new Amount(args.balance);
        }
        if (args.lastTransactionId !== undefined && args.lastTransactionId !== null) {
            this.lastTransactionId = args.lastTransactionId;
        }
    }
};
WalletData.prototype = {};
WalletData.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.I32) {
                    this.walletId = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRUCT) {
                    this.balance = new Amount();
                    this.balance.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I64) {
                    this.lastTransactionId = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

WalletData.prototype.write = function (output) {
    output.writeStructBegin('WalletData');
    if (this.walletId !== null && this.walletId !== undefined) {
        output.writeFieldBegin('walletId', Thrift.Type.I32, 1);
        output.writeI32(this.walletId);
        output.writeFieldEnd();
    }
    if (this.balance !== null && this.balance !== undefined) {
        output.writeFieldBegin('balance', Thrift.Type.STRUCT, 2);
        this.balance.write(output);
        output.writeFieldEnd();
    }
    if (this.lastTransactionId !== null && this.lastTransactionId !== undefined) {
        output.writeFieldBegin('lastTransactionId', Thrift.Type.I64, 3);
        output.writeI64(this.lastTransactionId);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

PeriodStats = function (args) {
    this.periodDuration = null;
    this.poolsCount = null;
    this.transactionsCount = null;
    this.balancePerCurrency = null;
    this.smartContractsCount = null;
    this.transactionsSmartCount = null;
    if (args) {
        if (args.periodDuration !== undefined && args.periodDuration !== null) {
            this.periodDuration = args.periodDuration;
        }
        if (args.poolsCount !== undefined && args.poolsCount !== null) {
            this.poolsCount = args.poolsCount;
        }
        if (args.transactionsCount !== undefined && args.transactionsCount !== null) {
            this.transactionsCount = args.transactionsCount;
        }
        if (args.balancePerCurrency !== undefined && args.balancePerCurrency !== null) {
            this.balancePerCurrency = Thrift.copyMap(args.balancePerCurrency, [CumulativeAmount]);
        }
        if (args.smartContractsCount !== undefined && args.smartContractsCount !== null) {
            this.smartContractsCount = args.smartContractsCount;
        }
        if (args.transactionsSmartCount !== undefined && args.transactionsSmartCount !== null) {
            this.transactionsSmartCount = args.transactionsSmartCount;
        }
    }
};
PeriodStats.prototype = {};
PeriodStats.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.I64) {
                    this.periodDuration = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I32) {
                    this.poolsCount = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I32) {
                    this.transactionsCount = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.MAP) {
                    var _size32 = 0;
                    var _rtmp336;
                    this.balancePerCurrency = {};
                    var _ktype33 = 0;
                    var _vtype34 = 0;
                    _rtmp336 = input.readMapBegin();
                    _ktype33 = _rtmp336.ktype;
                    _vtype34 = _rtmp336.vtype;
                    _size32 = _rtmp336.size;
                    for (var _i37 = 0; _i37 < _size32; ++_i37) {
                        if (_i37 > 0) {
                            if (input.rstack.length > input.rpos[input.rpos.length - 1] + 1) {
                                input.rstack.pop();
                            }
                        }
                        var key38 = null;
                        var val39 = null;
                        key38 = input.readByte().value;
                        val39 = new CumulativeAmount();
                        val39.read(input);
                        this.balancePerCurrency[key38] = val39;
                    }
                    input.readMapEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            case 5:
                if (ftype == Thrift.Type.I32) {
                    this.smartContractsCount = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 6:
                if (ftype == Thrift.Type.I32) {
                    this.transactionsSmartCount = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

PeriodStats.prototype.write = function (output) {
    output.writeStructBegin('PeriodStats');
    if (this.periodDuration !== null && this.periodDuration !== undefined) {
        output.writeFieldBegin('periodDuration', Thrift.Type.I64, 1);
        output.writeI64(this.periodDuration);
        output.writeFieldEnd();
    }
    if (this.poolsCount !== null && this.poolsCount !== undefined) {
        output.writeFieldBegin('poolsCount', Thrift.Type.I32, 2);
        output.writeI32(this.poolsCount);
        output.writeFieldEnd();
    }
    if (this.transactionsCount !== null && this.transactionsCount !== undefined) {
        output.writeFieldBegin('transactionsCount', Thrift.Type.I32, 3);
        output.writeI32(this.transactionsCount);
        output.writeFieldEnd();
    }
    if (this.balancePerCurrency !== null && this.balancePerCurrency !== undefined) {
        output.writeFieldBegin('balancePerCurrency', Thrift.Type.MAP, 4);
        output.writeMapBegin(Thrift.Type.BYTE, Thrift.Type.STRUCT, Thrift.objectLength(this.balancePerCurrency));
        for (var kiter40 in this.balancePerCurrency) {
            if (this.balancePerCurrency.hasOwnProperty(kiter40)) {
                var viter41 = this.balancePerCurrency[kiter40];
                output.writeByte(kiter40);
                viter41.write(output);
            }
        }
        output.writeMapEnd();
        output.writeFieldEnd();
    }
    if (this.smartContractsCount !== null && this.smartContractsCount !== undefined) {
        output.writeFieldBegin('smartContractsCount', Thrift.Type.I32, 5);
        output.writeI32(this.smartContractsCount);
        output.writeFieldEnd();
    }
    if (this.transactionsSmartCount !== null && this.transactionsSmartCount !== undefined) {
        output.writeFieldBegin('transactionsSmartCount', Thrift.Type.I32, 6);
        output.writeI32(this.transactionsSmartCount);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

WalletDataGetResult = function (args) {
    this.status = null;
    this.walletData = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.walletData !== undefined && args.walletData !== null) {
            this.walletData = new WalletData(args.walletData);
        }
    }
};
WalletDataGetResult.prototype = {};
WalletDataGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRUCT) {
                    this.walletData = new WalletData();
                    this.walletData.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

WalletDataGetResult.prototype.write = function (output) {
    output.writeStructBegin('WalletDataGetResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.walletData !== null && this.walletData !== undefined) {
        output.writeFieldBegin('walletData', Thrift.Type.STRUCT, 2);
        this.walletData.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

WalletIdGetResult = function (args) {
    this.status = null;
    this.walletId = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.walletId !== undefined && args.walletId !== null) {
            this.walletId = args.walletId;
        }
    }
};
WalletIdGetResult.prototype = {};
WalletIdGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I32) {
                    this.walletId = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

WalletIdGetResult.prototype.write = function (output) {
    output.writeStructBegin('WalletIdGetResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.walletId !== null && this.walletId !== undefined) {
        output.writeFieldBegin('walletId', Thrift.Type.I32, 2);
        output.writeI32(this.walletId);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

WalletTransactionsCountGetResult = function (args) {
    this.status = null;
    this.lastTransactionInnerId = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.lastTransactionInnerId !== undefined && args.lastTransactionInnerId !== null) {
            this.lastTransactionInnerId = args.lastTransactionInnerId;
        }
    }
};
WalletTransactionsCountGetResult.prototype = {};
WalletTransactionsCountGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.lastTransactionInnerId = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

WalletTransactionsCountGetResult.prototype.write = function (output) {
    output.writeStructBegin('WalletTransactionsCountGetResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.lastTransactionInnerId !== null && this.lastTransactionInnerId !== undefined) {
        output.writeFieldBegin('lastTransactionInnerId', Thrift.Type.I64, 2);
        output.writeI64(this.lastTransactionInnerId);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

WalletBalanceGetResult = function (args) {
    this.status = null;
    this.balance = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.balance !== undefined && args.balance !== null) {
            this.balance = new Amount(args.balance);
        }
    }
};
WalletBalanceGetResult.prototype = {};
WalletBalanceGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRUCT) {
                    this.balance = new Amount();
                    this.balance.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

WalletBalanceGetResult.prototype.write = function (output) {
    output.writeStructBegin('WalletBalanceGetResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.balance !== null && this.balance !== undefined) {
        output.writeFieldBegin('balance', Thrift.Type.STRUCT, 2);
        this.balance.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TransactionGetResult = function (args) {
    this.status = null;
    this.found = null;
    this.state = null;
    this.roundNum = null;
    this.transaction = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.found !== undefined && args.found !== null) {
            this.found = args.found;
        }
        if (args.state !== undefined && args.state !== null) {
            this.state = args.state;
        }
        if (args.roundNum !== undefined && args.roundNum !== null) {
            this.roundNum = args.roundNum;
        }
        if (args.transaction !== undefined && args.transaction !== null) {
            this.transaction = new SealedTransaction(args.transaction);
        }
    }
};
TransactionGetResult.prototype = {};
TransactionGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.BOOL) {
                    this.found = input.readBool().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I32) {
                    this.state = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.I32) {
                    this.roundNum = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 5:
                if (ftype == Thrift.Type.STRUCT) {
                    this.transaction = new SealedTransaction();
                    this.transaction.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TransactionGetResult.prototype.write = function (output) {
    output.writeStructBegin('TransactionGetResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.found !== null && this.found !== undefined) {
        output.writeFieldBegin('found', Thrift.Type.BOOL, 2);
        output.writeBool(this.found);
        output.writeFieldEnd();
    }
    if (this.state !== null && this.state !== undefined) {
        output.writeFieldBegin('state', Thrift.Type.I32, 3);
        output.writeI32(this.state);
        output.writeFieldEnd();
    }
    if (this.roundNum !== null && this.roundNum !== undefined) {
        output.writeFieldBegin('roundNum', Thrift.Type.I32, 4);
        output.writeI32(this.roundNum);
        output.writeFieldEnd();
    }
    if (this.transaction !== null && this.transaction !== undefined) {
        output.writeFieldBegin('transaction', Thrift.Type.STRUCT, 5);
        this.transaction.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TransactionsGetResult = function (args) {
    this.status = null;
    this.result = null;
    this.total_trxns_count = null;
    this.transactions = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.result !== undefined && args.result !== null) {
            this.result = args.result;
        }
        if (args.total_trxns_count !== undefined && args.total_trxns_count !== null) {
            this.total_trxns_count = args.total_trxns_count;
        }
        if (args.transactions !== undefined && args.transactions !== null) {
            this.transactions = Thrift.copyList(args.transactions, [SealedTransaction]);
        }
    }
};
TransactionsGetResult.prototype = {};
TransactionsGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.BOOL) {
                    this.result = input.readBool().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I32) {
                    this.total_trxns_count = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.LIST) {
                    var _size42 = 0;
                    var _rtmp346;
                    this.transactions = [];
                    var _etype45 = 0;
                    _rtmp346 = input.readListBegin();
                    _etype45 = _rtmp346.etype;
                    _size42 = _rtmp346.size;
                    for (var _i47 = 0; _i47 < _size42; ++_i47) {
                        var elem48 = null;
                        elem48 = new SealedTransaction();
                        elem48.read(input);
                        this.transactions.push(elem48);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TransactionsGetResult.prototype.write = function (output) {
    output.writeStructBegin('TransactionsGetResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.result !== null && this.result !== undefined) {
        output.writeFieldBegin('result', Thrift.Type.BOOL, 2);
        output.writeBool(this.result);
        output.writeFieldEnd();
    }
    if (this.total_trxns_count !== null && this.total_trxns_count !== undefined) {
        output.writeFieldBegin('total_trxns_count', Thrift.Type.I32, 3);
        output.writeI32(this.total_trxns_count);
        output.writeFieldEnd();
    }
    if (this.transactions !== null && this.transactions !== undefined) {
        output.writeFieldBegin('transactions', Thrift.Type.LIST, 4);
        output.writeListBegin(Thrift.Type.STRUCT, this.transactions.length);
        for (var iter49 in this.transactions) {
            if (this.transactions.hasOwnProperty(iter49)) {
                iter49 = this.transactions[iter49];
                iter49.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TransactionFlowResult = function (args) {
    this.status = null;
    this.smart_contract_result = null;
    this.roundNum = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.smart_contract_result !== undefined && args.smart_contract_result !== null) {
            this.smart_contract_result = new Variant(args.smart_contract_result);
        }
        if (args.roundNum !== undefined && args.roundNum !== null) {
            this.roundNum = args.roundNum;
        }
    }
};
TransactionFlowResult.prototype = {};
TransactionFlowResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRUCT) {
                    this.smart_contract_result = new Variant();
                    this.smart_contract_result.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I32) {
                    this.roundNum = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TransactionFlowResult.prototype.write = function (output) {
    output.writeStructBegin('TransactionFlowResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.smart_contract_result !== null && this.smart_contract_result !== undefined) {
        output.writeFieldBegin('smart_contract_result', Thrift.Type.STRUCT, 2);
        this.smart_contract_result.write(output);
        output.writeFieldEnd();
    }
    if (this.roundNum !== null && this.roundNum !== undefined) {
        output.writeFieldBegin('roundNum', Thrift.Type.I32, 3);
        output.writeI32(this.roundNum);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

PoolListGetResult = function (args) {
    this.status = null;
    this.result = null;
    this.count = null;
    this.pools = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.result !== undefined && args.result !== null) {
            this.result = args.result;
        }
        if (args.count !== undefined && args.count !== null) {
            this.count = args.count;
        }
        if (args.pools !== undefined && args.pools !== null) {
            this.pools = Thrift.copyList(args.pools, [Pool]);
        }
    }
};
PoolListGetResult.prototype = {};
PoolListGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.BOOL) {
                    this.result = input.readBool().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I32) {
                    this.count = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.LIST) {
                    var _size50 = 0;
                    var _rtmp354;
                    this.pools = [];
                    var _etype53 = 0;
                    _rtmp354 = input.readListBegin();
                    _etype53 = _rtmp354.etype;
                    _size50 = _rtmp354.size;
                    for (var _i55 = 0; _i55 < _size50; ++_i55) {
                        var elem56 = null;
                        elem56 = new Pool();
                        elem56.read(input);
                        this.pools.push(elem56);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

PoolListGetResult.prototype.write = function (output) {
    output.writeStructBegin('PoolListGetResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.result !== null && this.result !== undefined) {
        output.writeFieldBegin('result', Thrift.Type.BOOL, 2);
        output.writeBool(this.result);
        output.writeFieldEnd();
    }
    if (this.count !== null && this.count !== undefined) {
        output.writeFieldBegin('count', Thrift.Type.I32, 3);
        output.writeI32(this.count);
        output.writeFieldEnd();
    }
    if (this.pools !== null && this.pools !== undefined) {
        output.writeFieldBegin('pools', Thrift.Type.LIST, 4);
        output.writeListBegin(Thrift.Type.STRUCT, this.pools.length);
        for (var iter57 in this.pools) {
            if (this.pools.hasOwnProperty(iter57)) {
                iter57 = this.pools[iter57];
                iter57.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

PoolInfoGetResult = function (args) {
    this.status = null;
    this.isFound = null;
    this.pool = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.isFound !== undefined && args.isFound !== null) {
            this.isFound = args.isFound;
        }
        if (args.pool !== undefined && args.pool !== null) {
            this.pool = new Pool(args.pool);
        }
    }
};
PoolInfoGetResult.prototype = {};
PoolInfoGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.BOOL) {
                    this.isFound = input.readBool().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.STRUCT) {
                    this.pool = new Pool();
                    this.pool.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

PoolInfoGetResult.prototype.write = function (output) {
    output.writeStructBegin('PoolInfoGetResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.isFound !== null && this.isFound !== undefined) {
        output.writeFieldBegin('isFound', Thrift.Type.BOOL, 2);
        output.writeBool(this.isFound);
        output.writeFieldEnd();
    }
    if (this.pool !== null && this.pool !== undefined) {
        output.writeFieldBegin('pool', Thrift.Type.STRUCT, 3);
        this.pool.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

PoolTransactionsGetResult = function (args) {
    this.status = null;
    this.transactions = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.transactions !== undefined && args.transactions !== null) {
            this.transactions = Thrift.copyList(args.transactions, [SealedTransaction]);
        }
    }
};
PoolTransactionsGetResult.prototype = {};
PoolTransactionsGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.LIST) {
                    var _size58 = 0;
                    var _rtmp362;
                    this.transactions = [];
                    var _etype61 = 0;
                    _rtmp362 = input.readListBegin();
                    _etype61 = _rtmp362.etype;
                    _size58 = _rtmp362.size;
                    for (var _i63 = 0; _i63 < _size58; ++_i63) {
                        var elem64 = null;
                        elem64 = new SealedTransaction();
                        elem64.read(input);
                        this.transactions.push(elem64);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

PoolTransactionsGetResult.prototype.write = function (output) {
    output.writeStructBegin('PoolTransactionsGetResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.transactions !== null && this.transactions !== undefined) {
        output.writeFieldBegin('transactions', Thrift.Type.LIST, 2);
        output.writeListBegin(Thrift.Type.STRUCT, this.transactions.length);
        for (var iter65 in this.transactions) {
            if (this.transactions.hasOwnProperty(iter65)) {
                iter65 = this.transactions[iter65];
                iter65.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

StatsGetResult = function (args) {
    this.status = null;
    this.stats = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.stats !== undefined && args.stats !== null) {
            this.stats = Thrift.copyList(args.stats, [PeriodStats]);
        }
    }
};
StatsGetResult.prototype = {};
StatsGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.LIST) {
                    var _size66 = 0;
                    var _rtmp370;
                    this.stats = [];
                    var _etype69 = 0;
                    _rtmp370 = input.readListBegin();
                    _etype69 = _rtmp370.etype;
                    _size66 = _rtmp370.size;
                    for (var _i71 = 0; _i71 < _size66; ++_i71) {
                        var elem72 = null;
                        elem72 = new PeriodStats();
                        elem72.read(input);
                        this.stats.push(elem72);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

StatsGetResult.prototype.write = function (output) {
    output.writeStructBegin('StatsGetResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.stats !== null && this.stats !== undefined) {
        output.writeFieldBegin('stats', Thrift.Type.LIST, 2);
        output.writeListBegin(Thrift.Type.STRUCT, this.stats.length);
        for (var iter73 in this.stats) {
            if (this.stats.hasOwnProperty(iter73)) {
                iter73 = this.stats[iter73];
                iter73.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

SmartContractGetResult = function (args) {
    this.status = null;
    this.smartContract = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.smartContract !== undefined && args.smartContract !== null) {
            this.smartContract = new SmartContract(args.smartContract);
        }
    }
};
SmartContractGetResult.prototype = {};
SmartContractGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRUCT) {
                    this.smartContract = new SmartContract();
                    this.smartContract.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

SmartContractGetResult.prototype.write = function (output) {
    output.writeStructBegin('SmartContractGetResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.smartContract !== null && this.smartContract !== undefined) {
        output.writeFieldBegin('smartContract', Thrift.Type.STRUCT, 2);
        this.smartContract.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

SmartContractAddressesListGetResult = function (args) {
    this.status = null;
    this.addressesList = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.addressesList !== undefined && args.addressesList !== null) {
            this.addressesList = Thrift.copyList(args.addressesList, [null]);
        }
    }
};
SmartContractAddressesListGetResult.prototype = {};
SmartContractAddressesListGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.LIST) {
                    var _size74 = 0;
                    var _rtmp378;
                    this.addressesList = [];
                    var _etype77 = 0;
                    _rtmp378 = input.readListBegin();
                    _etype77 = _rtmp378.etype;
                    _size74 = _rtmp378.size;
                    for (var _i79 = 0; _i79 < _size74; ++_i79) {
                        var elem80 = null;
                        elem80 = input.readBinary().value;
                        this.addressesList.push(elem80);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

SmartContractAddressesListGetResult.prototype.write = function (output) {
    output.writeStructBegin('SmartContractAddressesListGetResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.addressesList !== null && this.addressesList !== undefined) {
        output.writeFieldBegin('addressesList', Thrift.Type.LIST, 2);
        output.writeListBegin(Thrift.Type.STRING, this.addressesList.length);
        for (var iter81 in this.addressesList) {
            if (this.addressesList.hasOwnProperty(iter81)) {
                iter81 = this.addressesList[iter81];
                output.writeBinary(iter81);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

SmartContractsListGetResult = function (args) {
    this.status = null;
    this.count = null;
    this.smartContractsList = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.count !== undefined && args.count !== null) {
            this.count = args.count;
        }
        if (args.smartContractsList !== undefined && args.smartContractsList !== null) {
            this.smartContractsList = Thrift.copyList(args.smartContractsList, [SmartContract]);
        }
    }
};
SmartContractsListGetResult.prototype = {};
SmartContractsListGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I32) {
                    this.count = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.LIST) {
                    var _size82 = 0;
                    var _rtmp386;
                    this.smartContractsList = [];
                    var _etype85 = 0;
                    _rtmp386 = input.readListBegin();
                    _etype85 = _rtmp386.etype;
                    _size82 = _rtmp386.size;
                    for (var _i87 = 0; _i87 < _size82; ++_i87) {
                        var elem88 = null;
                        elem88 = new SmartContract();
                        elem88.read(input);
                        this.smartContractsList.push(elem88);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

SmartContractsListGetResult.prototype.write = function (output) {
    output.writeStructBegin('SmartContractsListGetResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.count !== null && this.count !== undefined) {
        output.writeFieldBegin('count', Thrift.Type.I32, 2);
        output.writeI32(this.count);
        output.writeFieldEnd();
    }
    if (this.smartContractsList !== null && this.smartContractsList !== undefined) {
        output.writeFieldBegin('smartContractsList', Thrift.Type.LIST, 3);
        output.writeListBegin(Thrift.Type.STRUCT, this.smartContractsList.length);
        for (var iter89 in this.smartContractsList) {
            if (this.smartContractsList.hasOwnProperty(iter89)) {
                iter89 = this.smartContractsList[iter89];
                iter89.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TransactionsStateGetResult = function (args) {
    this.status = null;
    this.states = null;
    this.roundNum = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.states !== undefined && args.states !== null) {
            this.states = Thrift.copyMap(args.states, [null]);
        }
        if (args.roundNum !== undefined && args.roundNum !== null) {
            this.roundNum = args.roundNum;
        }
    }
};
TransactionsStateGetResult.prototype = {};
TransactionsStateGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.MAP) {
                    var _size90 = 0;
                    var _rtmp394;
                    this.states = {};
                    var _ktype91 = 0;
                    var _vtype92 = 0;
                    _rtmp394 = input.readMapBegin();
                    _ktype91 = _rtmp394.ktype;
                    _vtype92 = _rtmp394.vtype;
                    _size90 = _rtmp394.size;
                    for (var _i95 = 0; _i95 < _size90; ++_i95) {
                        if (_i95 > 0) {
                            if (input.rstack.length > input.rpos[input.rpos.length - 1] + 1) {
                                input.rstack.pop();
                            }
                        }
                        var key96 = null;
                        var val97 = null;
                        key96 = input.readI64().value;
                        val97 = input.readI32().value;
                        this.states[key96] = val97;
                    }
                    input.readMapEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I32) {
                    this.roundNum = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TransactionsStateGetResult.prototype.write = function (output) {
    output.writeStructBegin('TransactionsStateGetResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.states !== null && this.states !== undefined) {
        output.writeFieldBegin('states', Thrift.Type.MAP, 2);
        output.writeMapBegin(Thrift.Type.I64, Thrift.Type.I32, Thrift.objectLength(this.states));
        for (var kiter98 in this.states) {
            if (this.states.hasOwnProperty(kiter98)) {
                var viter99 = this.states[kiter98];
                output.writeI64(kiter98);
                output.writeI32(viter99);
            }
        }
        output.writeMapEnd();
        output.writeFieldEnd();
    }
    if (this.roundNum !== null && this.roundNum !== undefined) {
        output.writeFieldBegin('roundNum', Thrift.Type.I32, 3);
        output.writeI32(this.roundNum);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

SmartMethodParamsGetResult = function (args) {
    this.status = null;
    this.method = null;
    this.params = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.method !== undefined && args.method !== null) {
            this.method = args.method;
        }
        if (args.params !== undefined && args.params !== null) {
            this.params = Thrift.copyList(args.params, [Variant]);
        }
    }
};
SmartMethodParamsGetResult.prototype = {};
SmartMethodParamsGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.method = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.LIST) {
                    var _size100 = 0;
                    var _rtmp3104;
                    this.params = [];
                    var _etype103 = 0;
                    _rtmp3104 = input.readListBegin();
                    _etype103 = _rtmp3104.etype;
                    _size100 = _rtmp3104.size;
                    for (var _i105 = 0; _i105 < _size100; ++_i105) {
                        var elem106 = null;
                        elem106 = new Variant();
                        elem106.read(input);
                        this.params.push(elem106);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

SmartMethodParamsGetResult.prototype.write = function (output) {
    output.writeStructBegin('SmartMethodParamsGetResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.method !== null && this.method !== undefined) {
        output.writeFieldBegin('method', Thrift.Type.STRING, 2);
        output.writeString(this.method);
        output.writeFieldEnd();
    }
    if (this.params !== null && this.params !== undefined) {
        output.writeFieldBegin('params', Thrift.Type.LIST, 3);
        output.writeListBegin(Thrift.Type.STRUCT, this.params.length);
        for (var iter107 in this.params) {
            if (this.params.hasOwnProperty(iter107)) {
                iter107 = this.params[iter107];
                iter107.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

ContractAllMethodsGetResult = function (args) {
    this.code = null;
    this.message = null;
    this.methods = null;
    if (args) {
        if (args.code !== undefined && args.code !== null) {
            this.code = args.code;
        }
        if (args.message !== undefined && args.message !== null) {
            this.message = args.message;
        }
        if (args.methods !== undefined && args.methods !== null) {
            this.methods = Thrift.copyList(args.methods, [MethodDescription]);
        }
    }
};
ContractAllMethodsGetResult.prototype = {};
ContractAllMethodsGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.BYTE) {
                    this.code = input.readByte().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.message = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.LIST) {
                    var _size108 = 0;
                    var _rtmp3112;
                    this.methods = [];
                    var _etype111 = 0;
                    _rtmp3112 = input.readListBegin();
                    _etype111 = _rtmp3112.etype;
                    _size108 = _rtmp3112.size;
                    for (var _i113 = 0; _i113 < _size108; ++_i113) {
                        var elem114 = null;
                        elem114 = new MethodDescription();
                        elem114.read(input);
                        this.methods.push(elem114);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

ContractAllMethodsGetResult.prototype.write = function (output) {
    output.writeStructBegin('ContractAllMethodsGetResult');
    if (this.code !== null && this.code !== undefined) {
        output.writeFieldBegin('code', Thrift.Type.BYTE, 1);
        output.writeByte(this.code);
        output.writeFieldEnd();
    }
    if (this.message !== null && this.message !== undefined) {
        output.writeFieldBegin('message', Thrift.Type.STRING, 2);
        output.writeString(this.message);
        output.writeFieldEnd();
    }
    if (this.methods !== null && this.methods !== undefined) {
        output.writeFieldBegin('methods', Thrift.Type.LIST, 3);
        output.writeListBegin(Thrift.Type.STRUCT, this.methods.length);
        for (var iter115 in this.methods) {
            if (this.methods.hasOwnProperty(iter115)) {
                iter115 = this.methods[iter115];
                iter115.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

SmartContractMethodArgument = function (args) {
    this.type = null;
    this.name = null;
    if (args) {
        if (args.type !== undefined && args.type !== null) {
            this.type = args.type;
        }
        if (args.name !== undefined && args.name !== null) {
            this.name = args.name;
        }
    }
};
SmartContractMethodArgument.prototype = {};
SmartContractMethodArgument.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.type = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.name = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

SmartContractMethodArgument.prototype.write = function (output) {
    output.writeStructBegin('SmartContractMethodArgument');
    if (this.type !== null && this.type !== undefined) {
        output.writeFieldBegin('type', Thrift.Type.STRING, 1);
        output.writeString(this.type);
        output.writeFieldEnd();
    }
    if (this.name !== null && this.name !== undefined) {
        output.writeFieldBegin('name', Thrift.Type.STRING, 2);
        output.writeString(this.name);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

SmartContractMethod = function (args) {
    this.returnType = null;
    this.name = null;
    this.arguments = null;
    if (args) {
        if (args.returnType !== undefined && args.returnType !== null) {
            this.returnType = args.returnType;
        }
        if (args.name !== undefined && args.name !== null) {
            this.name = args.name;
        }
        if (args.arguments !== undefined && args.arguments !== null) {
            this.arguments = Thrift.copyList(args.arguments, [SmartContractMethodArgument]);
        }
    }
};
SmartContractMethod.prototype = {};
SmartContractMethod.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.returnType = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.name = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.LIST) {
                    var _size116 = 0;
                    var _rtmp3120;
                    this.arguments = [];
                    var _etype119 = 0;
                    _rtmp3120 = input.readListBegin();
                    _etype119 = _rtmp3120.etype;
                    _size116 = _rtmp3120.size;
                    for (var _i121 = 0; _i121 < _size116; ++_i121) {
                        var elem122 = null;
                        elem122 = new SmartContractMethodArgument();
                        elem122.read(input);
                        this.arguments.push(elem122);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

SmartContractMethod.prototype.write = function (output) {
    output.writeStructBegin('SmartContractMethod');
    if (this.returnType !== null && this.returnType !== undefined) {
        output.writeFieldBegin('returnType', Thrift.Type.STRING, 1);
        output.writeString(this.returnType);
        output.writeFieldEnd();
    }
    if (this.name !== null && this.name !== undefined) {
        output.writeFieldBegin('name', Thrift.Type.STRING, 2);
        output.writeString(this.name);
        output.writeFieldEnd();
    }
    if (this.arguments !== null && this.arguments !== undefined) {
        output.writeFieldBegin('arguments', Thrift.Type.LIST, 3);
        output.writeListBegin(Thrift.Type.STRUCT, this.arguments.length);
        for (var iter123 in this.arguments) {
            if (this.arguments.hasOwnProperty(iter123)) {
                iter123 = this.arguments[iter123];
                iter123.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

SmartContractDataResult = function (args) {
    this.status = null;
    this.methods = null;
    this.variables = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.methods !== undefined && args.methods !== null) {
            this.methods = Thrift.copyList(args.methods, [SmartContractMethod]);
        }
        if (args.variables !== undefined && args.variables !== null) {
            this.variables = Thrift.copyMap(args.variables, [Variant]);
        }
    }
};
SmartContractDataResult.prototype = {};
SmartContractDataResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.LIST) {
                    var _size124 = 0;
                    var _rtmp3128;
                    this.methods = [];
                    var _etype127 = 0;
                    _rtmp3128 = input.readListBegin();
                    _etype127 = _rtmp3128.etype;
                    _size124 = _rtmp3128.size;
                    for (var _i129 = 0; _i129 < _size124; ++_i129) {
                        var elem130 = null;
                        elem130 = new SmartContractMethod();
                        elem130.read(input);
                        this.methods.push(elem130);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.MAP) {
                    var _size131 = 0;
                    var _rtmp3135;
                    this.variables = {};
                    var _ktype132 = 0;
                    var _vtype133 = 0;
                    _rtmp3135 = input.readMapBegin();
                    _ktype132 = _rtmp3135.ktype;
                    _vtype133 = _rtmp3135.vtype;
                    _size131 = _rtmp3135.size;
                    for (var _i136 = 0; _i136 < _size131; ++_i136) {
                        if (_i136 > 0) {
                            if (input.rstack.length > input.rpos[input.rpos.length - 1] + 1) {
                                input.rstack.pop();
                            }
                        }
                        var key137 = null;
                        var val138 = null;
                        key137 = input.readString().value;
                        val138 = new Variant();
                        val138.read(input);
                        this.variables[key137] = val138;
                    }
                    input.readMapEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

SmartContractDataResult.prototype.write = function (output) {
    output.writeStructBegin('SmartContractDataResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.methods !== null && this.methods !== undefined) {
        output.writeFieldBegin('methods', Thrift.Type.LIST, 2);
        output.writeListBegin(Thrift.Type.STRUCT, this.methods.length);
        for (var iter139 in this.methods) {
            if (this.methods.hasOwnProperty(iter139)) {
                iter139 = this.methods[iter139];
                iter139.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    if (this.variables !== null && this.variables !== undefined) {
        output.writeFieldBegin('variables', Thrift.Type.MAP, 3);
        output.writeMapBegin(Thrift.Type.STRING, Thrift.Type.STRUCT, Thrift.objectLength(this.variables));
        for (var kiter140 in this.variables) {
            if (this.variables.hasOwnProperty(kiter140)) {
                var viter141 = this.variables[kiter140];
                output.writeString(kiter140);
                viter141.write(output);
            }
        }
        output.writeMapEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

SmartContractCompileResult = function (args) {
    this.status = null;
    this.byteCodeObjects = null;
    this.ts = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.byteCodeObjects !== undefined && args.byteCodeObjects !== null) {
            this.byteCodeObjects = Thrift.copyList(args.byteCodeObjects, [ByteCodeObject]);
        }
        if (args.ts !== undefined && args.ts !== null) {
            this.ts = args.ts;
        }
    }
};
SmartContractCompileResult.prototype = {};
SmartContractCompileResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.LIST) {
                    var _size142 = 0;
                    var _rtmp3146;
                    this.byteCodeObjects = [];
                    var _etype145 = 0;
                    _rtmp3146 = input.readListBegin();
                    _etype145 = _rtmp3146.etype;
                    _size142 = _rtmp3146.size;
                    for (var _i147 = 0; _i147 < _size142; ++_i147) {
                        var elem148 = null;
                        elem148 = new ByteCodeObject();
                        elem148.read(input);
                        this.byteCodeObjects.push(elem148);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I32) {
                    this.ts = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

SmartContractCompileResult.prototype.write = function (output) {
    output.writeStructBegin('SmartContractCompileResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.byteCodeObjects !== null && this.byteCodeObjects !== undefined) {
        output.writeFieldBegin('byteCodeObjects', Thrift.Type.LIST, 2);
        output.writeListBegin(Thrift.Type.STRUCT, this.byteCodeObjects.length);
        for (var iter149 in this.byteCodeObjects) {
            if (this.byteCodeObjects.hasOwnProperty(iter149)) {
                iter149 = this.byteCodeObjects[iter149];
                iter149.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    if (this.ts !== null && this.ts !== undefined) {
        output.writeFieldBegin('ts', Thrift.Type.I32, 3);
        output.writeI32(this.ts);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TokenInfo = function (args) {
    this.address = null;
    this.code = null;
    this.name = null;
    this.totalSupply = null;
    this.owner = null;
    this.transfersCount = null;
    this.transactionsCount = null;
    this.holdersCount = null;
    this.standart = null;
    if (args) {
        if (args.address !== undefined && args.address !== null) {
            this.address = args.address;
        }
        if (args.code !== undefined && args.code !== null) {
            this.code = args.code;
        }
        if (args.name !== undefined && args.name !== null) {
            this.name = args.name;
        }
        if (args.totalSupply !== undefined && args.totalSupply !== null) {
            this.totalSupply = args.totalSupply;
        }
        if (args.owner !== undefined && args.owner !== null) {
            this.owner = args.owner;
        }
        if (args.transfersCount !== undefined && args.transfersCount !== null) {
            this.transfersCount = args.transfersCount;
        }
        if (args.transactionsCount !== undefined && args.transactionsCount !== null) {
            this.transactionsCount = args.transactionsCount;
        }
        if (args.holdersCount !== undefined && args.holdersCount !== null) {
            this.holdersCount = args.holdersCount;
        }
        if (args.standart !== undefined && args.standart !== null) {
            this.standart = args.standart;
        }
    }
};
TokenInfo.prototype = {};
TokenInfo.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.address = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.code = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.STRING) {
                    this.name = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.STRING) {
                    this.totalSupply = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 5:
                if (ftype == Thrift.Type.STRING) {
                    this.owner = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 6:
                if (ftype == Thrift.Type.I32) {
                    this.transfersCount = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 7:
                if (ftype == Thrift.Type.I32) {
                    this.transactionsCount = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 8:
                if (ftype == Thrift.Type.I32) {
                    this.holdersCount = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 9:
                if (ftype == Thrift.Type.I32) {
                    this.standart = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TokenInfo.prototype.write = function (output) {
    output.writeStructBegin('TokenInfo');
    if (this.address !== null && this.address !== undefined) {
        output.writeFieldBegin('address', Thrift.Type.STRING, 1);
        output.writeBinary(this.address);
        output.writeFieldEnd();
    }
    if (this.code !== null && this.code !== undefined) {
        output.writeFieldBegin('code', Thrift.Type.STRING, 2);
        output.writeString(this.code);
        output.writeFieldEnd();
    }
    if (this.name !== null && this.name !== undefined) {
        output.writeFieldBegin('name', Thrift.Type.STRING, 3);
        output.writeString(this.name);
        output.writeFieldEnd();
    }
    if (this.totalSupply !== null && this.totalSupply !== undefined) {
        output.writeFieldBegin('totalSupply', Thrift.Type.STRING, 4);
        output.writeString(this.totalSupply);
        output.writeFieldEnd();
    }
    if (this.owner !== null && this.owner !== undefined) {
        output.writeFieldBegin('owner', Thrift.Type.STRING, 5);
        output.writeBinary(this.owner);
        output.writeFieldEnd();
    }
    if (this.transfersCount !== null && this.transfersCount !== undefined) {
        output.writeFieldBegin('transfersCount', Thrift.Type.I32, 6);
        output.writeI32(this.transfersCount);
        output.writeFieldEnd();
    }
    if (this.transactionsCount !== null && this.transactionsCount !== undefined) {
        output.writeFieldBegin('transactionsCount', Thrift.Type.I32, 7);
        output.writeI32(this.transactionsCount);
        output.writeFieldEnd();
    }
    if (this.holdersCount !== null && this.holdersCount !== undefined) {
        output.writeFieldBegin('holdersCount', Thrift.Type.I32, 8);
        output.writeI32(this.holdersCount);
        output.writeFieldEnd();
    }
    if (this.standart !== null && this.standart !== undefined) {
        output.writeFieldBegin('standart', Thrift.Type.I32, 9);
        output.writeI32(this.standart);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TokenTransaction = function (args) {
    this.token = null;
    this.transaction = null;
    this.time = null;
    this.initiator = null;
    this.method = null;
    this.params = null;
    if (args) {
        if (args.token !== undefined && args.token !== null) {
            this.token = args.token;
        }
        if (args.transaction !== undefined && args.transaction !== null) {
            this.transaction = new TransactionId(args.transaction);
        }
        if (args.time !== undefined && args.time !== null) {
            this.time = args.time;
        }
        if (args.initiator !== undefined && args.initiator !== null) {
            this.initiator = args.initiator;
        }
        if (args.method !== undefined && args.method !== null) {
            this.method = args.method;
        }
        if (args.params !== undefined && args.params !== null) {
            this.params = Thrift.copyList(args.params, [Variant]);
        }
    }
};
TokenTransaction.prototype = {};
TokenTransaction.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.token = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRUCT) {
                    this.transaction = new TransactionId();
                    this.transaction.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I64) {
                    this.time = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.STRING) {
                    this.initiator = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 5:
                if (ftype == Thrift.Type.STRING) {
                    this.method = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 6:
                if (ftype == Thrift.Type.LIST) {
                    var _size150 = 0;
                    var _rtmp3154;
                    this.params = [];
                    var _etype153 = 0;
                    _rtmp3154 = input.readListBegin();
                    _etype153 = _rtmp3154.etype;
                    _size150 = _rtmp3154.size;
                    for (var _i155 = 0; _i155 < _size150; ++_i155) {
                        var elem156 = null;
                        elem156 = new Variant();
                        elem156.read(input);
                        this.params.push(elem156);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TokenTransaction.prototype.write = function (output) {
    output.writeStructBegin('TokenTransaction');
    if (this.token !== null && this.token !== undefined) {
        output.writeFieldBegin('token', Thrift.Type.STRING, 1);
        output.writeBinary(this.token);
        output.writeFieldEnd();
    }
    if (this.transaction !== null && this.transaction !== undefined) {
        output.writeFieldBegin('transaction', Thrift.Type.STRUCT, 2);
        this.transaction.write(output);
        output.writeFieldEnd();
    }
    if (this.time !== null && this.time !== undefined) {
        output.writeFieldBegin('time', Thrift.Type.I64, 3);
        output.writeI64(this.time);
        output.writeFieldEnd();
    }
    if (this.initiator !== null && this.initiator !== undefined) {
        output.writeFieldBegin('initiator', Thrift.Type.STRING, 4);
        output.writeBinary(this.initiator);
        output.writeFieldEnd();
    }
    if (this.method !== null && this.method !== undefined) {
        output.writeFieldBegin('method', Thrift.Type.STRING, 5);
        output.writeString(this.method);
        output.writeFieldEnd();
    }
    if (this.params !== null && this.params !== undefined) {
        output.writeFieldBegin('params', Thrift.Type.LIST, 6);
        output.writeListBegin(Thrift.Type.STRUCT, this.params.length);
        for (var iter157 in this.params) {
            if (this.params.hasOwnProperty(iter157)) {
                iter157 = this.params[iter157];
                iter157.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TokenHolder = function (args) {
    this.holder = null;
    this.token = null;
    this.balance = null;
    this.transfersCount = null;
    if (args) {
        if (args.holder !== undefined && args.holder !== null) {
            this.holder = args.holder;
        }
        if (args.token !== undefined && args.token !== null) {
            this.token = args.token;
        }
        if (args.balance !== undefined && args.balance !== null) {
            this.balance = args.balance;
        }
        if (args.transfersCount !== undefined && args.transfersCount !== null) {
            this.transfersCount = args.transfersCount;
        }
    }
};
TokenHolder.prototype = {};
TokenHolder.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.holder = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.token = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.STRING) {
                    this.balance = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.I32) {
                    this.transfersCount = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TokenHolder.prototype.write = function (output) {
    output.writeStructBegin('TokenHolder');
    if (this.holder !== null && this.holder !== undefined) {
        output.writeFieldBegin('holder', Thrift.Type.STRING, 1);
        output.writeBinary(this.holder);
        output.writeFieldEnd();
    }
    if (this.token !== null && this.token !== undefined) {
        output.writeFieldBegin('token', Thrift.Type.STRING, 2);
        output.writeBinary(this.token);
        output.writeFieldEnd();
    }
    if (this.balance !== null && this.balance !== undefined) {
        output.writeFieldBegin('balance', Thrift.Type.STRING, 3);
        output.writeString(this.balance);
        output.writeFieldEnd();
    }
    if (this.transfersCount !== null && this.transfersCount !== undefined) {
        output.writeFieldBegin('transfersCount', Thrift.Type.I32, 4);
        output.writeI32(this.transfersCount);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TokenBalance = function (args) {
    this.token = null;
    this.code = null;
    this.name = null;
    this.balance = null;
    if (args) {
        if (args.token !== undefined && args.token !== null) {
            this.token = args.token;
        }
        if (args.code !== undefined && args.code !== null) {
            this.code = args.code;
        }
        if (args.name !== undefined && args.name !== null) {
            this.name = args.name;
        }
        if (args.balance !== undefined && args.balance !== null) {
            this.balance = args.balance;
        }
    }
};
TokenBalance.prototype = {};
TokenBalance.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.token = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.code = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.STRING) {
                    this.name = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.STRING) {
                    this.balance = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TokenBalance.prototype.write = function (output) {
    output.writeStructBegin('TokenBalance');
    if (this.token !== null && this.token !== undefined) {
        output.writeFieldBegin('token', Thrift.Type.STRING, 1);
        output.writeBinary(this.token);
        output.writeFieldEnd();
    }
    if (this.code !== null && this.code !== undefined) {
        output.writeFieldBegin('code', Thrift.Type.STRING, 2);
        output.writeString(this.code);
        output.writeFieldEnd();
    }
    if (this.name !== null && this.name !== undefined) {
        output.writeFieldBegin('name', Thrift.Type.STRING, 3);
        output.writeString(this.name);
        output.writeFieldEnd();
    }
    if (this.balance !== null && this.balance !== undefined) {
        output.writeFieldBegin('balance', Thrift.Type.STRING, 4);
        output.writeString(this.balance);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TokenBalancesResult = function (args) {
    this.status = null;
    this.balances = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.balances !== undefined && args.balances !== null) {
            this.balances = Thrift.copyList(args.balances, [TokenBalance]);
        }
    }
};
TokenBalancesResult.prototype = {};
TokenBalancesResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.LIST) {
                    var _size158 = 0;
                    var _rtmp3162;
                    this.balances = [];
                    var _etype161 = 0;
                    _rtmp3162 = input.readListBegin();
                    _etype161 = _rtmp3162.etype;
                    _size158 = _rtmp3162.size;
                    for (var _i163 = 0; _i163 < _size158; ++_i163) {
                        var elem164 = null;
                        elem164 = new TokenBalance();
                        elem164.read(input);
                        this.balances.push(elem164);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TokenBalancesResult.prototype.write = function (output) {
    output.writeStructBegin('TokenBalancesResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.balances !== null && this.balances !== undefined) {
        output.writeFieldBegin('balances', Thrift.Type.LIST, 2);
        output.writeListBegin(Thrift.Type.STRUCT, this.balances.length);
        for (var iter165 in this.balances) {
            if (this.balances.hasOwnProperty(iter165)) {
                iter165 = this.balances[iter165];
                iter165.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TokenTransfer = function (args) {
    this.token = null;
    this.code = null;
    this.sender = null;
    this.receiver = null;
    this.amount = null;
    this.initiator = null;
    this.transaction = null;
    this.time = null;
    if (args) {
        if (args.token !== undefined && args.token !== null) {
            this.token = args.token;
        }
        if (args.code !== undefined && args.code !== null) {
            this.code = args.code;
        }
        if (args.sender !== undefined && args.sender !== null) {
            this.sender = args.sender;
        }
        if (args.receiver !== undefined && args.receiver !== null) {
            this.receiver = args.receiver;
        }
        if (args.amount !== undefined && args.amount !== null) {
            this.amount = args.amount;
        }
        if (args.initiator !== undefined && args.initiator !== null) {
            this.initiator = args.initiator;
        }
        if (args.transaction !== undefined && args.transaction !== null) {
            this.transaction = new TransactionId(args.transaction);
        }
        if (args.time !== undefined && args.time !== null) {
            this.time = args.time;
        }
    }
};
TokenTransfer.prototype = {};
TokenTransfer.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.token = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.code = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.STRING) {
                    this.sender = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.STRING) {
                    this.receiver = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 5:
                if (ftype == Thrift.Type.STRING) {
                    this.amount = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 6:
                if (ftype == Thrift.Type.STRING) {
                    this.initiator = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 7:
                if (ftype == Thrift.Type.STRUCT) {
                    this.transaction = new TransactionId();
                    this.transaction.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 8:
                if (ftype == Thrift.Type.I64) {
                    this.time = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TokenTransfer.prototype.write = function (output) {
    output.writeStructBegin('TokenTransfer');
    if (this.token !== null && this.token !== undefined) {
        output.writeFieldBegin('token', Thrift.Type.STRING, 1);
        output.writeBinary(this.token);
        output.writeFieldEnd();
    }
    if (this.code !== null && this.code !== undefined) {
        output.writeFieldBegin('code', Thrift.Type.STRING, 2);
        output.writeString(this.code);
        output.writeFieldEnd();
    }
    if (this.sender !== null && this.sender !== undefined) {
        output.writeFieldBegin('sender', Thrift.Type.STRING, 3);
        output.writeBinary(this.sender);
        output.writeFieldEnd();
    }
    if (this.receiver !== null && this.receiver !== undefined) {
        output.writeFieldBegin('receiver', Thrift.Type.STRING, 4);
        output.writeBinary(this.receiver);
        output.writeFieldEnd();
    }
    if (this.amount !== null && this.amount !== undefined) {
        output.writeFieldBegin('amount', Thrift.Type.STRING, 5);
        output.writeString(this.amount);
        output.writeFieldEnd();
    }
    if (this.initiator !== null && this.initiator !== undefined) {
        output.writeFieldBegin('initiator', Thrift.Type.STRING, 6);
        output.writeBinary(this.initiator);
        output.writeFieldEnd();
    }
    if (this.transaction !== null && this.transaction !== undefined) {
        output.writeFieldBegin('transaction', Thrift.Type.STRUCT, 7);
        this.transaction.write(output);
        output.writeFieldEnd();
    }
    if (this.time !== null && this.time !== undefined) {
        output.writeFieldBegin('time', Thrift.Type.I64, 8);
        output.writeI64(this.time);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TokenTransfersResult = function (args) {
    this.status = null;
    this.count = null;
    this.transfers = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.count !== undefined && args.count !== null) {
            this.count = args.count;
        }
        if (args.transfers !== undefined && args.transfers !== null) {
            this.transfers = Thrift.copyList(args.transfers, [TokenTransfer]);
        }
    }
};
TokenTransfersResult.prototype = {};
TokenTransfersResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I32) {
                    this.count = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.LIST) {
                    var _size166 = 0;
                    var _rtmp3170;
                    this.transfers = [];
                    var _etype169 = 0;
                    _rtmp3170 = input.readListBegin();
                    _etype169 = _rtmp3170.etype;
                    _size166 = _rtmp3170.size;
                    for (var _i171 = 0; _i171 < _size166; ++_i171) {
                        var elem172 = null;
                        elem172 = new TokenTransfer();
                        elem172.read(input);
                        this.transfers.push(elem172);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TokenTransfersResult.prototype.write = function (output) {
    output.writeStructBegin('TokenTransfersResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.count !== null && this.count !== undefined) {
        output.writeFieldBegin('count', Thrift.Type.I32, 2);
        output.writeI32(this.count);
        output.writeFieldEnd();
    }
    if (this.transfers !== null && this.transfers !== undefined) {
        output.writeFieldBegin('transfers', Thrift.Type.LIST, 3);
        output.writeListBegin(Thrift.Type.STRUCT, this.transfers.length);
        for (var iter173 in this.transfers) {
            if (this.transfers.hasOwnProperty(iter173)) {
                iter173 = this.transfers[iter173];
                iter173.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TokenTransactionsResult = function (args) {
    this.status = null;
    this.count = null;
    this.transactions = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.count !== undefined && args.count !== null) {
            this.count = args.count;
        }
        if (args.transactions !== undefined && args.transactions !== null) {
            this.transactions = Thrift.copyList(args.transactions, [TokenTransaction]);
        }
    }
};
TokenTransactionsResult.prototype = {};
TokenTransactionsResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I32) {
                    this.count = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.LIST) {
                    var _size174 = 0;
                    var _rtmp3178;
                    this.transactions = [];
                    var _etype177 = 0;
                    _rtmp3178 = input.readListBegin();
                    _etype177 = _rtmp3178.etype;
                    _size174 = _rtmp3178.size;
                    for (var _i179 = 0; _i179 < _size174; ++_i179) {
                        var elem180 = null;
                        elem180 = new TokenTransaction();
                        elem180.read(input);
                        this.transactions.push(elem180);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TokenTransactionsResult.prototype.write = function (output) {
    output.writeStructBegin('TokenTransactionsResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.count !== null && this.count !== undefined) {
        output.writeFieldBegin('count', Thrift.Type.I32, 2);
        output.writeI32(this.count);
        output.writeFieldEnd();
    }
    if (this.transactions !== null && this.transactions !== undefined) {
        output.writeFieldBegin('transactions', Thrift.Type.LIST, 3);
        output.writeListBegin(Thrift.Type.STRUCT, this.transactions.length);
        for (var iter181 in this.transactions) {
            if (this.transactions.hasOwnProperty(iter181)) {
                iter181 = this.transactions[iter181];
                iter181.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TokenInfoResult = function (args) {
    this.status = null;
    this.token = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.token !== undefined && args.token !== null) {
            this.token = new TokenInfo(args.token);
        }
    }
};
TokenInfoResult.prototype = {};
TokenInfoResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRUCT) {
                    this.token = new TokenInfo();
                    this.token.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TokenInfoResult.prototype.write = function (output) {
    output.writeStructBegin('TokenInfoResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.token !== null && this.token !== undefined) {
        output.writeFieldBegin('token', Thrift.Type.STRUCT, 2);
        this.token.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TokenHoldersResult = function (args) {
    this.status = null;
    this.count = null;
    this.holders = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.count !== undefined && args.count !== null) {
            this.count = args.count;
        }
        if (args.holders !== undefined && args.holders !== null) {
            this.holders = Thrift.copyList(args.holders, [TokenHolder]);
        }
    }
};
TokenHoldersResult.prototype = {};
TokenHoldersResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I32) {
                    this.count = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.LIST) {
                    var _size182 = 0;
                    var _rtmp3186;
                    this.holders = [];
                    var _etype185 = 0;
                    _rtmp3186 = input.readListBegin();
                    _etype185 = _rtmp3186.etype;
                    _size182 = _rtmp3186.size;
                    for (var _i187 = 0; _i187 < _size182; ++_i187) {
                        var elem188 = null;
                        elem188 = new TokenHolder();
                        elem188.read(input);
                        this.holders.push(elem188);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TokenHoldersResult.prototype.write = function (output) {
    output.writeStructBegin('TokenHoldersResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.count !== null && this.count !== undefined) {
        output.writeFieldBegin('count', Thrift.Type.I32, 2);
        output.writeI32(this.count);
        output.writeFieldEnd();
    }
    if (this.holders !== null && this.holders !== undefined) {
        output.writeFieldBegin('holders', Thrift.Type.LIST, 3);
        output.writeListBegin(Thrift.Type.STRUCT, this.holders.length);
        for (var iter189 in this.holders) {
            if (this.holders.hasOwnProperty(iter189)) {
                iter189 = this.holders[iter189];
                iter189.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TokensListResult = function (args) {
    this.status = null;
    this.count = null;
    this.tokens = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.count !== undefined && args.count !== null) {
            this.count = args.count;
        }
        if (args.tokens !== undefined && args.tokens !== null) {
            this.tokens = Thrift.copyList(args.tokens, [TokenInfo]);
        }
    }
};
TokensListResult.prototype = {};
TokensListResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I32) {
                    this.count = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.LIST) {
                    var _size190 = 0;
                    var _rtmp3194;
                    this.tokens = [];
                    var _etype193 = 0;
                    _rtmp3194 = input.readListBegin();
                    _etype193 = _rtmp3194.etype;
                    _size190 = _rtmp3194.size;
                    for (var _i195 = 0; _i195 < _size190; ++_i195) {
                        var elem196 = null;
                        elem196 = new TokenInfo();
                        elem196.read(input);
                        this.tokens.push(elem196);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TokensListResult.prototype.write = function (output) {
    output.writeStructBegin('TokensListResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.count !== null && this.count !== undefined) {
        output.writeFieldBegin('count', Thrift.Type.I32, 2);
        output.writeI32(this.count);
        output.writeFieldEnd();
    }
    if (this.tokens !== null && this.tokens !== undefined) {
        output.writeFieldBegin('tokens', Thrift.Type.LIST, 3);
        output.writeListBegin(Thrift.Type.STRUCT, this.tokens.length);
        for (var iter197 in this.tokens) {
            if (this.tokens.hasOwnProperty(iter197)) {
                iter197 = this.tokens[iter197];
                iter197.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

WalletInfo = function (args) {
    this.address = null;
    this.balance = null;
    this.transactionsNumber = null;
    this.firstTransactionTime = null;
    if (args) {
        if (args.address !== undefined && args.address !== null) {
            this.address = args.address;
        }
        if (args.balance !== undefined && args.balance !== null) {
            this.balance = new Amount(args.balance);
        }
        if (args.transactionsNumber !== undefined && args.transactionsNumber !== null) {
            this.transactionsNumber = args.transactionsNumber;
        }
        if (args.firstTransactionTime !== undefined && args.firstTransactionTime !== null) {
            this.firstTransactionTime = args.firstTransactionTime;
        }
    }
};
WalletInfo.prototype = {};
WalletInfo.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.address = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRUCT) {
                    this.balance = new Amount();
                    this.balance.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I64) {
                    this.transactionsNumber = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.I64) {
                    this.firstTransactionTime = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

WalletInfo.prototype.write = function (output) {
    output.writeStructBegin('WalletInfo');
    if (this.address !== null && this.address !== undefined) {
        output.writeFieldBegin('address', Thrift.Type.STRING, 1);
        output.writeBinary(this.address);
        output.writeFieldEnd();
    }
    if (this.balance !== null && this.balance !== undefined) {
        output.writeFieldBegin('balance', Thrift.Type.STRUCT, 2);
        this.balance.write(output);
        output.writeFieldEnd();
    }
    if (this.transactionsNumber !== null && this.transactionsNumber !== undefined) {
        output.writeFieldBegin('transactionsNumber', Thrift.Type.I64, 3);
        output.writeI64(this.transactionsNumber);
        output.writeFieldEnd();
    }
    if (this.firstTransactionTime !== null && this.firstTransactionTime !== undefined) {
        output.writeFieldBegin('firstTransactionTime', Thrift.Type.I64, 4);
        output.writeI64(this.firstTransactionTime);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

WalletsGetResult = function (args) {
    this.status = null;
    this.count = null;
    this.wallets = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.count !== undefined && args.count !== null) {
            this.count = args.count;
        }
        if (args.wallets !== undefined && args.wallets !== null) {
            this.wallets = Thrift.copyList(args.wallets, [WalletInfo]);
        }
    }
};
WalletsGetResult.prototype = {};
WalletsGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I32) {
                    this.count = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.LIST) {
                    var _size198 = 0;
                    var _rtmp3202;
                    this.wallets = [];
                    var _etype201 = 0;
                    _rtmp3202 = input.readListBegin();
                    _etype201 = _rtmp3202.etype;
                    _size198 = _rtmp3202.size;
                    for (var _i203 = 0; _i203 < _size198; ++_i203) {
                        var elem204 = null;
                        elem204 = new WalletInfo();
                        elem204.read(input);
                        this.wallets.push(elem204);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

WalletsGetResult.prototype.write = function (output) {
    output.writeStructBegin('WalletsGetResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.count !== null && this.count !== undefined) {
        output.writeFieldBegin('count', Thrift.Type.I32, 2);
        output.writeI32(this.count);
        output.writeFieldEnd();
    }
    if (this.wallets !== null && this.wallets !== undefined) {
        output.writeFieldBegin('wallets', Thrift.Type.LIST, 3);
        output.writeListBegin(Thrift.Type.STRUCT, this.wallets.length);
        for (var iter205 in this.wallets) {
            if (this.wallets.hasOwnProperty(iter205)) {
                iter205 = this.wallets[iter205];
                iter205.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TrustedInfo = function (args) {
    this.address = null;
    this.timesWriter = null;
    this.timesTrusted = null;
    this.feeCollected = null;
    if (args) {
        if (args.address !== undefined && args.address !== null) {
            this.address = args.address;
        }
        if (args.timesWriter !== undefined && args.timesWriter !== null) {
            this.timesWriter = args.timesWriter;
        }
        if (args.timesTrusted !== undefined && args.timesTrusted !== null) {
            this.timesTrusted = args.timesTrusted;
        }
        if (args.feeCollected !== undefined && args.feeCollected !== null) {
            this.feeCollected = new Amount(args.feeCollected);
        }
    }
};
TrustedInfo.prototype = {};
TrustedInfo.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.address = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I32) {
                    this.timesWriter = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I32) {
                    this.timesTrusted = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.STRUCT) {
                    this.feeCollected = new Amount();
                    this.feeCollected.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TrustedInfo.prototype.write = function (output) {
    output.writeStructBegin('TrustedInfo');
    if (this.address !== null && this.address !== undefined) {
        output.writeFieldBegin('address', Thrift.Type.STRING, 1);
        output.writeBinary(this.address);
        output.writeFieldEnd();
    }
    if (this.timesWriter !== null && this.timesWriter !== undefined) {
        output.writeFieldBegin('timesWriter', Thrift.Type.I32, 2);
        output.writeI32(this.timesWriter);
        output.writeFieldEnd();
    }
    if (this.timesTrusted !== null && this.timesTrusted !== undefined) {
        output.writeFieldBegin('timesTrusted', Thrift.Type.I32, 3);
        output.writeI32(this.timesTrusted);
        output.writeFieldEnd();
    }
    if (this.feeCollected !== null && this.feeCollected !== undefined) {
        output.writeFieldBegin('feeCollected', Thrift.Type.STRUCT, 4);
        this.feeCollected.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

TrustedGetResult = function (args) {
    this.status = null;
    this.pages = null;
    this.writers = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.pages !== undefined && args.pages !== null) {
            this.pages = args.pages;
        }
        if (args.writers !== undefined && args.writers !== null) {
            this.writers = Thrift.copyList(args.writers, [TrustedInfo]);
        }
    }
};
TrustedGetResult.prototype = {};
TrustedGetResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I32) {
                    this.pages = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.LIST) {
                    var _size206 = 0;
                    var _rtmp3210;
                    this.writers = [];
                    var _etype209 = 0;
                    _rtmp3210 = input.readListBegin();
                    _etype209 = _rtmp3210.etype;
                    _size206 = _rtmp3210.size;
                    for (var _i211 = 0; _i211 < _size206; ++_i211) {
                        var elem212 = null;
                        elem212 = new TrustedInfo();
                        elem212.read(input);
                        this.writers.push(elem212);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

TrustedGetResult.prototype.write = function (output) {
    output.writeStructBegin('TrustedGetResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.pages !== null && this.pages !== undefined) {
        output.writeFieldBegin('pages', Thrift.Type.I32, 2);
        output.writeI32(this.pages);
        output.writeFieldEnd();
    }
    if (this.writers !== null && this.writers !== undefined) {
        output.writeFieldBegin('writers', Thrift.Type.LIST, 3);
        output.writeListBegin(Thrift.Type.STRUCT, this.writers.length);
        for (var iter213 in this.writers) {
            if (this.writers.hasOwnProperty(iter213)) {
                iter213 = this.writers[iter213];
                iter213.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

SyncStateResult = function (args) {
    this.status = null;
    this.currRound = null;
    this.lastBlock = null;
    if (args) {
        if (args.status !== undefined && args.status !== null) {
            this.status = new APIResponse(args.status);
        }
        if (args.currRound !== undefined && args.currRound !== null) {
            this.currRound = args.currRound;
        }
        if (args.lastBlock !== undefined && args.lastBlock !== null) {
            this.lastBlock = args.lastBlock;
        }
    }
};
SyncStateResult.prototype = {};
SyncStateResult.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.status = new APIResponse();
                    this.status.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.currRound = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I64) {
                    this.lastBlock = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

SyncStateResult.prototype.write = function (output) {
    output.writeStructBegin('SyncStateResult');
    if (this.status !== null && this.status !== undefined) {
        output.writeFieldBegin('status', Thrift.Type.STRUCT, 1);
        this.status.write(output);
        output.writeFieldEnd();
    }
    if (this.currRound !== null && this.currRound !== undefined) {
        output.writeFieldBegin('currRound', Thrift.Type.I64, 2);
        output.writeI64(this.currRound);
        output.writeFieldEnd();
    }
    if (this.lastBlock !== null && this.lastBlock !== undefined) {
        output.writeFieldBegin('lastBlock', Thrift.Type.I64, 3);
        output.writeI64(this.lastBlock);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

//
// Autogenerated by Thrift Compiler (0.11.0)
//
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
//


//HELPER FUNCTIONS AND STRUCTURES

API_WalletDataGet_args = function (args) {
    this.address = null;
    if (args) {
        if (args.address !== undefined && args.address !== null) {
            this.address = args.address;
        }
    }
};
API_WalletDataGet_args.prototype = {};
API_WalletDataGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.address = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_WalletDataGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_WalletDataGet_args');
    if (this.address !== null && this.address !== undefined) {
        output.writeFieldBegin('address', Thrift.Type.STRING, 1);
        output.writeBinary(this.address);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_WalletDataGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new WalletDataGetResult(args.success);
        }
    }
};
API_WalletDataGet_result.prototype = {};
API_WalletDataGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new WalletDataGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_WalletDataGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_WalletDataGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_WalletIdGet_args = function (args) {
    this.address = null;
    if (args) {
        if (args.address !== undefined && args.address !== null) {
            this.address = args.address;
        }
    }
};
API_WalletIdGet_args.prototype = {};
API_WalletIdGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.address = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_WalletIdGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_WalletIdGet_args');
    if (this.address !== null && this.address !== undefined) {
        output.writeFieldBegin('address', Thrift.Type.STRING, 1);
        output.writeBinary(this.address);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_WalletIdGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new WalletIdGetResult(args.success);
        }
    }
};
API_WalletIdGet_result.prototype = {};
API_WalletIdGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new WalletIdGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_WalletIdGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_WalletIdGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_WalletTransactionsCountGet_args = function (args) {
    this.address = null;
    if (args) {
        if (args.address !== undefined && args.address !== null) {
            this.address = args.address;
        }
    }
};
API_WalletTransactionsCountGet_args.prototype = {};
API_WalletTransactionsCountGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.address = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_WalletTransactionsCountGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_WalletTransactionsCountGet_args');
    if (this.address !== null && this.address !== undefined) {
        output.writeFieldBegin('address', Thrift.Type.STRING, 1);
        output.writeBinary(this.address);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_WalletTransactionsCountGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new WalletTransactionsCountGetResult(args.success);
        }
    }
};
API_WalletTransactionsCountGet_result.prototype = {};
API_WalletTransactionsCountGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new WalletTransactionsCountGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_WalletTransactionsCountGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_WalletTransactionsCountGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_WalletBalanceGet_args = function (args) {
    this.address = null;
    if (args) {
        if (args.address !== undefined && args.address !== null) {
            this.address = args.address;
        }
    }
};
API_WalletBalanceGet_args.prototype = {};
API_WalletBalanceGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.address = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_WalletBalanceGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_WalletBalanceGet_args');
    if (this.address !== null && this.address !== undefined) {
        output.writeFieldBegin('address', Thrift.Type.STRING, 1);
        output.writeBinary(this.address);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_WalletBalanceGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new WalletBalanceGetResult(args.success);
        }
    }
};
API_WalletBalanceGet_result.prototype = {};
API_WalletBalanceGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new WalletBalanceGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_WalletBalanceGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_WalletBalanceGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TransactionGet_args = function (args) {
    this.transactionId = null;
    if (args) {
        if (args.transactionId !== undefined && args.transactionId !== null) {
            this.transactionId = new TransactionId(args.transactionId);
        }
    }
};
API_TransactionGet_args.prototype = {};
API_TransactionGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.transactionId = new TransactionId();
                    this.transactionId.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TransactionGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_TransactionGet_args');
    if (this.transactionId !== null && this.transactionId !== undefined) {
        output.writeFieldBegin('transactionId', Thrift.Type.STRUCT, 1);
        this.transactionId.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TransactionGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new TransactionGetResult(args.success);
        }
    }
};
API_TransactionGet_result.prototype = {};
API_TransactionGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new TransactionGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TransactionGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_TransactionGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TransactionsGet_args = function (args) {
    this.address = null;
    this.offset = null;
    this.limit = null;
    if (args) {
        if (args.address !== undefined && args.address !== null) {
            this.address = args.address;
        }
        if (args.offset !== undefined && args.offset !== null) {
            this.offset = args.offset;
        }
        if (args.limit !== undefined && args.limit !== null) {
            this.limit = args.limit;
        }
    }
};
API_TransactionsGet_args.prototype = {};
API_TransactionsGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.address = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.offset = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I64) {
                    this.limit = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TransactionsGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_TransactionsGet_args');
    if (this.address !== null && this.address !== undefined) {
        output.writeFieldBegin('address', Thrift.Type.STRING, 1);
        output.writeBinary(this.address);
        output.writeFieldEnd();
    }
    if (this.offset !== null && this.offset !== undefined) {
        output.writeFieldBegin('offset', Thrift.Type.I64, 2);
        output.writeI64(this.offset);
        output.writeFieldEnd();
    }
    if (this.limit !== null && this.limit !== undefined) {
        output.writeFieldBegin('limit', Thrift.Type.I64, 3);
        output.writeI64(this.limit);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TransactionsGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new TransactionsGetResult(args.success);
        }
    }
};
API_TransactionsGet_result.prototype = {};
API_TransactionsGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new TransactionsGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TransactionsGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_TransactionsGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TransactionFlow_args = function (args) {
    this.transaction = null;
    if (args) {
        if (args.transaction !== undefined && args.transaction !== null) {
            this.transaction = new Transaction(args.transaction);
        }
    }
};
API_TransactionFlow_args.prototype = {};
API_TransactionFlow_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRUCT) {
                    this.transaction = new Transaction();
                    this.transaction.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TransactionFlow_args.prototype.write = function (output) {
    output.writeStructBegin('API_TransactionFlow_args');
    if (this.transaction !== null && this.transaction !== undefined) {
        output.writeFieldBegin('transaction', Thrift.Type.STRUCT, 1);
        this.transaction.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TransactionFlow_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new TransactionFlowResult(args.success);
        }
    }
};
API_TransactionFlow_result.prototype = {};
API_TransactionFlow_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new TransactionFlowResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TransactionFlow_result.prototype.write = function (output) {
    output.writeStructBegin('API_TransactionFlow_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TransactionsListGet_args = function (args) {
    this.offset = null;
    this.limit = null;
    if (args) {
        if (args.offset !== undefined && args.offset !== null) {
            this.offset = args.offset;
        }
        if (args.limit !== undefined && args.limit !== null) {
            this.limit = args.limit;
        }
    }
};
API_TransactionsListGet_args.prototype = {};
API_TransactionsListGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.I64) {
                    this.offset = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.limit = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TransactionsListGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_TransactionsListGet_args');
    if (this.offset !== null && this.offset !== undefined) {
        output.writeFieldBegin('offset', Thrift.Type.I64, 1);
        output.writeI64(this.offset);
        output.writeFieldEnd();
    }
    if (this.limit !== null && this.limit !== undefined) {
        output.writeFieldBegin('limit', Thrift.Type.I64, 2);
        output.writeI64(this.limit);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TransactionsListGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new TransactionsGetResult(args.success);
        }
    }
};
API_TransactionsListGet_result.prototype = {};
API_TransactionsListGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new TransactionsGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TransactionsListGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_TransactionsListGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_GetLastHash_args = function (args) {
};
API_GetLastHash_args.prototype = {};
API_GetLastHash_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        input.skip(ftype);
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_GetLastHash_args.prototype.write = function (output) {
    output.writeStructBegin('API_GetLastHash_args');
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_GetLastHash_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = args.success;
        }
    }
};
API_GetLastHash_result.prototype = {};
API_GetLastHash_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRING) {
                    this.success = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_GetLastHash_result.prototype.write = function (output) {
    output.writeStructBegin('API_GetLastHash_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRING, 0);
        output.writeBinary(this.success);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_PoolListGetStable_args = function (args) {
    this.hash = null;
    this.limit = null;
    if (args) {
        if (args.hash !== undefined && args.hash !== null) {
            this.hash = args.hash;
        }
        if (args.limit !== undefined && args.limit !== null) {
            this.limit = args.limit;
        }
    }
};
API_PoolListGetStable_args.prototype = {};
API_PoolListGetStable_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.hash = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.limit = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_PoolListGetStable_args.prototype.write = function (output) {
    output.writeStructBegin('API_PoolListGetStable_args');
    if (this.hash !== null && this.hash !== undefined) {
        output.writeFieldBegin('hash', Thrift.Type.STRING, 1);
        output.writeBinary(this.hash);
        output.writeFieldEnd();
    }
    if (this.limit !== null && this.limit !== undefined) {
        output.writeFieldBegin('limit', Thrift.Type.I64, 2);
        output.writeI64(this.limit);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_PoolListGetStable_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new PoolListGetResult(args.success);
        }
    }
};
API_PoolListGetStable_result.prototype = {};
API_PoolListGetStable_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new PoolListGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_PoolListGetStable_result.prototype.write = function (output) {
    output.writeStructBegin('API_PoolListGetStable_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_PoolListGet_args = function (args) {
    this.offset = null;
    this.limit = null;
    if (args) {
        if (args.offset !== undefined && args.offset !== null) {
            this.offset = args.offset;
        }
        if (args.limit !== undefined && args.limit !== null) {
            this.limit = args.limit;
        }
    }
};
API_PoolListGet_args.prototype = {};
API_PoolListGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.I64) {
                    this.offset = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.limit = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_PoolListGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_PoolListGet_args');
    if (this.offset !== null && this.offset !== undefined) {
        output.writeFieldBegin('offset', Thrift.Type.I64, 1);
        output.writeI64(this.offset);
        output.writeFieldEnd();
    }
    if (this.limit !== null && this.limit !== undefined) {
        output.writeFieldBegin('limit', Thrift.Type.I64, 2);
        output.writeI64(this.limit);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_PoolListGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new PoolListGetResult(args.success);
        }
    }
};
API_PoolListGet_result.prototype = {};
API_PoolListGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new PoolListGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_PoolListGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_PoolListGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_PoolInfoGet_args = function (args) {
    this.hash = null;
    this.index = null;
    if (args) {
        if (args.hash !== undefined && args.hash !== null) {
            this.hash = args.hash;
        }
        if (args.index !== undefined && args.index !== null) {
            this.index = args.index;
        }
    }
};
API_PoolInfoGet_args.prototype = {};
API_PoolInfoGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.hash = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.index = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_PoolInfoGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_PoolInfoGet_args');
    if (this.hash !== null && this.hash !== undefined) {
        output.writeFieldBegin('hash', Thrift.Type.STRING, 1);
        output.writeBinary(this.hash);
        output.writeFieldEnd();
    }
    if (this.index !== null && this.index !== undefined) {
        output.writeFieldBegin('index', Thrift.Type.I64, 2);
        output.writeI64(this.index);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_PoolInfoGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new PoolInfoGetResult(args.success);
        }
    }
};
API_PoolInfoGet_result.prototype = {};
API_PoolInfoGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new PoolInfoGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_PoolInfoGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_PoolInfoGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_PoolTransactionsGet_args = function (args) {
    this.hash = null;
    this.offset = null;
    this.limit = null;
    if (args) {
        if (args.hash !== undefined && args.hash !== null) {
            this.hash = args.hash;
        }
        if (args.offset !== undefined && args.offset !== null) {
            this.offset = args.offset;
        }
        if (args.limit !== undefined && args.limit !== null) {
            this.limit = args.limit;
        }
    }
};
API_PoolTransactionsGet_args.prototype = {};
API_PoolTransactionsGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.hash = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.offset = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I64) {
                    this.limit = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_PoolTransactionsGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_PoolTransactionsGet_args');
    if (this.hash !== null && this.hash !== undefined) {
        output.writeFieldBegin('hash', Thrift.Type.STRING, 1);
        output.writeBinary(this.hash);
        output.writeFieldEnd();
    }
    if (this.offset !== null && this.offset !== undefined) {
        output.writeFieldBegin('offset', Thrift.Type.I64, 2);
        output.writeI64(this.offset);
        output.writeFieldEnd();
    }
    if (this.limit !== null && this.limit !== undefined) {
        output.writeFieldBegin('limit', Thrift.Type.I64, 3);
        output.writeI64(this.limit);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_PoolTransactionsGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new PoolTransactionsGetResult(args.success);
        }
    }
};
API_PoolTransactionsGet_result.prototype = {};
API_PoolTransactionsGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new PoolTransactionsGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_PoolTransactionsGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_PoolTransactionsGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_StatsGet_args = function (args) {
};
API_StatsGet_args.prototype = {};
API_StatsGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        input.skip(ftype);
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_StatsGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_StatsGet_args');
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_StatsGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new StatsGetResult(args.success);
        }
    }
};
API_StatsGet_result.prototype = {};
API_StatsGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new StatsGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_StatsGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_StatsGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_SmartContractGet_args = function (args) {
    this.address = null;
    if (args) {
        if (args.address !== undefined && args.address !== null) {
            this.address = args.address;
        }
    }
};
API_SmartContractGet_args.prototype = {};
API_SmartContractGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.address = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_SmartContractGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_SmartContractGet_args');
    if (this.address !== null && this.address !== undefined) {
        output.writeFieldBegin('address', Thrift.Type.STRING, 1);
        output.writeBinary(this.address);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_SmartContractGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new SmartContractGetResult(args.success);
        }
    }
};
API_SmartContractGet_result.prototype = {};
API_SmartContractGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new SmartContractGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_SmartContractGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_SmartContractGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_SmartContractsListGet_args = function (args) {
    this.deployer = null;
    if (args) {
        if (args.deployer !== undefined && args.deployer !== null) {
            this.deployer = args.deployer;
        }
    }
};
API_SmartContractsListGet_args.prototype = {};
API_SmartContractsListGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.deployer = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_SmartContractsListGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_SmartContractsListGet_args');
    if (this.deployer !== null && this.deployer !== undefined) {
        output.writeFieldBegin('deployer', Thrift.Type.STRING, 1);
        output.writeBinary(this.deployer);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_SmartContractsListGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new SmartContractsListGetResult(args.success);
        }
    }
};
API_SmartContractsListGet_result.prototype = {};
API_SmartContractsListGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new SmartContractsListGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_SmartContractsListGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_SmartContractsListGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_SmartContractAddressesListGet_args = function (args) {
    this.deployer = null;
    if (args) {
        if (args.deployer !== undefined && args.deployer !== null) {
            this.deployer = args.deployer;
        }
    }
};
API_SmartContractAddressesListGet_args.prototype = {};
API_SmartContractAddressesListGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.deployer = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_SmartContractAddressesListGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_SmartContractAddressesListGet_args');
    if (this.deployer !== null && this.deployer !== undefined) {
        output.writeFieldBegin('deployer', Thrift.Type.STRING, 1);
        output.writeBinary(this.deployer);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_SmartContractAddressesListGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new SmartContractAddressesListGetResult(args.success);
        }
    }
};
API_SmartContractAddressesListGet_result.prototype = {};
API_SmartContractAddressesListGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new SmartContractAddressesListGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_SmartContractAddressesListGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_SmartContractAddressesListGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_WaitForBlock_args = function (args) {
    this.obsolete = null;
    if (args) {
        if (args.obsolete !== undefined && args.obsolete !== null) {
            this.obsolete = args.obsolete;
        }
    }
};
API_WaitForBlock_args.prototype = {};
API_WaitForBlock_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.obsolete = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_WaitForBlock_args.prototype.write = function (output) {
    output.writeStructBegin('API_WaitForBlock_args');
    if (this.obsolete !== null && this.obsolete !== undefined) {
        output.writeFieldBegin('obsolete', Thrift.Type.STRING, 1);
        output.writeBinary(this.obsolete);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_WaitForBlock_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = args.success;
        }
    }
};
API_WaitForBlock_result.prototype = {};
API_WaitForBlock_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRING) {
                    this.success = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_WaitForBlock_result.prototype.write = function (output) {
    output.writeStructBegin('API_WaitForBlock_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRING, 0);
        output.writeBinary(this.success);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_WaitForSmartTransaction_args = function (args) {
    this.smart_public = null;
    if (args) {
        if (args.smart_public !== undefined && args.smart_public !== null) {
            this.smart_public = args.smart_public;
        }
    }
};
API_WaitForSmartTransaction_args.prototype = {};
API_WaitForSmartTransaction_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.smart_public = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_WaitForSmartTransaction_args.prototype.write = function (output) {
    output.writeStructBegin('API_WaitForSmartTransaction_args');
    if (this.smart_public !== null && this.smart_public !== undefined) {
        output.writeFieldBegin('smart_public', Thrift.Type.STRING, 1);
        output.writeBinary(this.smart_public);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_WaitForSmartTransaction_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new TransactionId(args.success);
        }
    }
};
API_WaitForSmartTransaction_result.prototype = {};
API_WaitForSmartTransaction_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new TransactionId();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_WaitForSmartTransaction_result.prototype.write = function (output) {
    output.writeStructBegin('API_WaitForSmartTransaction_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_SmartContractsAllListGet_args = function (args) {
    this.offset = null;
    this.limit = null;
    if (args) {
        if (args.offset !== undefined && args.offset !== null) {
            this.offset = args.offset;
        }
        if (args.limit !== undefined && args.limit !== null) {
            this.limit = args.limit;
        }
    }
};
API_SmartContractsAllListGet_args.prototype = {};
API_SmartContractsAllListGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.I64) {
                    this.offset = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.limit = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_SmartContractsAllListGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_SmartContractsAllListGet_args');
    if (this.offset !== null && this.offset !== undefined) {
        output.writeFieldBegin('offset', Thrift.Type.I64, 1);
        output.writeI64(this.offset);
        output.writeFieldEnd();
    }
    if (this.limit !== null && this.limit !== undefined) {
        output.writeFieldBegin('limit', Thrift.Type.I64, 2);
        output.writeI64(this.limit);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_SmartContractsAllListGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new SmartContractsListGetResult(args.success);
        }
    }
};
API_SmartContractsAllListGet_result.prototype = {};
API_SmartContractsAllListGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new SmartContractsListGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_SmartContractsAllListGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_SmartContractsAllListGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TransactionsStateGet_args = function (args) {
    this.address = null;
    this.id = null;
    if (args) {
        if (args.address !== undefined && args.address !== null) {
            this.address = args.address;
        }
        if (args.id !== undefined && args.id !== null) {
            this.id = Thrift.copyList(args.id, [null]);
        }
    }
};
API_TransactionsStateGet_args.prototype = {};
API_TransactionsStateGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.address = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.LIST) {
                    var _size214 = 0;
                    var _rtmp3218;
                    this.id = [];
                    var _etype217 = 0;
                    _rtmp3218 = input.readListBegin();
                    _etype217 = _rtmp3218.etype;
                    _size214 = _rtmp3218.size;
                    for (var _i219 = 0; _i219 < _size214; ++_i219) {
                        var elem220 = null;
                        elem220 = input.readI64().value;
                        this.id.push(elem220);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TransactionsStateGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_TransactionsStateGet_args');
    if (this.address !== null && this.address !== undefined) {
        output.writeFieldBegin('address', Thrift.Type.STRING, 1);
        output.writeBinary(this.address);
        output.writeFieldEnd();
    }
    if (this.id !== null && this.id !== undefined) {
        output.writeFieldBegin('id', Thrift.Type.LIST, 2);
        output.writeListBegin(Thrift.Type.I64, this.id.length);
        for (var iter221 in this.id) {
            if (this.id.hasOwnProperty(iter221)) {
                iter221 = this.id[iter221];
                output.writeI64(iter221);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TransactionsStateGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new TransactionsStateGetResult(args.success);
        }
    }
};
API_TransactionsStateGet_result.prototype = {};
API_TransactionsStateGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new TransactionsStateGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TransactionsStateGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_TransactionsStateGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_ContractAllMethodsGet_args = function (args) {
    this.byteCodeObjects = null;
    if (args) {
        if (args.byteCodeObjects !== undefined && args.byteCodeObjects !== null) {
            this.byteCodeObjects = Thrift.copyList(args.byteCodeObjects, [ByteCodeObject]);
        }
    }
};
API_ContractAllMethodsGet_args.prototype = {};
API_ContractAllMethodsGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.LIST) {
                    var _size222 = 0;
                    var _rtmp3226;
                    this.byteCodeObjects = [];
                    var _etype225 = 0;
                    _rtmp3226 = input.readListBegin();
                    _etype225 = _rtmp3226.etype;
                    _size222 = _rtmp3226.size;
                    for (var _i227 = 0; _i227 < _size222; ++_i227) {
                        var elem228 = null;
                        elem228 = new ByteCodeObject();
                        elem228.read(input);
                        this.byteCodeObjects.push(elem228);
                    }
                    input.readListEnd();
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_ContractAllMethodsGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_ContractAllMethodsGet_args');
    if (this.byteCodeObjects !== null && this.byteCodeObjects !== undefined) {
        output.writeFieldBegin('byteCodeObjects', Thrift.Type.LIST, 1);
        output.writeListBegin(Thrift.Type.STRUCT, this.byteCodeObjects.length);
        for (var iter229 in this.byteCodeObjects) {
            if (this.byteCodeObjects.hasOwnProperty(iter229)) {
                iter229 = this.byteCodeObjects[iter229];
                iter229.write(output);
            }
        }
        output.writeListEnd();
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_ContractAllMethodsGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new ContractAllMethodsGetResult(args.success);
        }
    }
};
API_ContractAllMethodsGet_result.prototype = {};
API_ContractAllMethodsGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new ContractAllMethodsGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_ContractAllMethodsGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_ContractAllMethodsGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_SmartMethodParamsGet_args = function (args) {
    this.address = null;
    this.id = null;
    if (args) {
        if (args.address !== undefined && args.address !== null) {
            this.address = args.address;
        }
        if (args.id !== undefined && args.id !== null) {
            this.id = args.id;
        }
    }
};
API_SmartMethodParamsGet_args.prototype = {};
API_SmartMethodParamsGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.address = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.id = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_SmartMethodParamsGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_SmartMethodParamsGet_args');
    if (this.address !== null && this.address !== undefined) {
        output.writeFieldBegin('address', Thrift.Type.STRING, 1);
        output.writeBinary(this.address);
        output.writeFieldEnd();
    }
    if (this.id !== null && this.id !== undefined) {
        output.writeFieldBegin('id', Thrift.Type.I64, 2);
        output.writeI64(this.id);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_SmartMethodParamsGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new SmartMethodParamsGetResult(args.success);
        }
    }
};
API_SmartMethodParamsGet_result.prototype = {};
API_SmartMethodParamsGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new SmartMethodParamsGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_SmartMethodParamsGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_SmartMethodParamsGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_SmartContractDataGet_args = function (args) {
    this.address = null;
    if (args) {
        if (args.address !== undefined && args.address !== null) {
            this.address = args.address;
        }
    }
};
API_SmartContractDataGet_args.prototype = {};
API_SmartContractDataGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.address = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_SmartContractDataGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_SmartContractDataGet_args');
    if (this.address !== null && this.address !== undefined) {
        output.writeFieldBegin('address', Thrift.Type.STRING, 1);
        output.writeBinary(this.address);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_SmartContractDataGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new SmartContractDataResult(args.success);
        }
    }
};
API_SmartContractDataGet_result.prototype = {};
API_SmartContractDataGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new SmartContractDataResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_SmartContractDataGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_SmartContractDataGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_SmartContractCompile_args = function (args) {
    this.sourceCode = null;
    if (args) {
        if (args.sourceCode !== undefined && args.sourceCode !== null) {
            this.sourceCode = args.sourceCode;
        }
    }
};
API_SmartContractCompile_args.prototype = {};
API_SmartContractCompile_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.sourceCode = input.readString().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_SmartContractCompile_args.prototype.write = function (output) {
    output.writeStructBegin('API_SmartContractCompile_args');
    if (this.sourceCode !== null && this.sourceCode !== undefined) {
        output.writeFieldBegin('sourceCode', Thrift.Type.STRING, 1);
        output.writeString(this.sourceCode);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_SmartContractCompile_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new SmartContractCompileResult(args.success);
        }
    }
};
API_SmartContractCompile_result.prototype = {};
API_SmartContractCompile_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new SmartContractCompileResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_SmartContractCompile_result.prototype.write = function (output) {
    output.writeStructBegin('API_SmartContractCompile_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokenBalancesGet_args = function (args) {
    this.address = null;
    if (args) {
        if (args.address !== undefined && args.address !== null) {
            this.address = args.address;
        }
    }
};
API_TokenBalancesGet_args.prototype = {};
API_TokenBalancesGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.address = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokenBalancesGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_TokenBalancesGet_args');
    if (this.address !== null && this.address !== undefined) {
        output.writeFieldBegin('address', Thrift.Type.STRING, 1);
        output.writeBinary(this.address);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokenBalancesGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new TokenBalancesResult(args.success);
        }
    }
};
API_TokenBalancesGet_result.prototype = {};
API_TokenBalancesGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new TokenBalancesResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokenBalancesGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_TokenBalancesGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokenTransfersGet_args = function (args) {
    this.token = null;
    this.offset = null;
    this.limit = null;
    if (args) {
        if (args.token !== undefined && args.token !== null) {
            this.token = args.token;
        }
        if (args.offset !== undefined && args.offset !== null) {
            this.offset = args.offset;
        }
        if (args.limit !== undefined && args.limit !== null) {
            this.limit = args.limit;
        }
    }
};
API_TokenTransfersGet_args.prototype = {};
API_TokenTransfersGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.token = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.offset = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I64) {
                    this.limit = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokenTransfersGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_TokenTransfersGet_args');
    if (this.token !== null && this.token !== undefined) {
        output.writeFieldBegin('token', Thrift.Type.STRING, 1);
        output.writeBinary(this.token);
        output.writeFieldEnd();
    }
    if (this.offset !== null && this.offset !== undefined) {
        output.writeFieldBegin('offset', Thrift.Type.I64, 2);
        output.writeI64(this.offset);
        output.writeFieldEnd();
    }
    if (this.limit !== null && this.limit !== undefined) {
        output.writeFieldBegin('limit', Thrift.Type.I64, 3);
        output.writeI64(this.limit);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokenTransfersGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new TokenTransfersResult(args.success);
        }
    }
};
API_TokenTransfersGet_result.prototype = {};
API_TokenTransfersGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new TokenTransfersResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokenTransfersGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_TokenTransfersGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokenTransferGet_args = function (args) {
    this.token = null;
    this.id = null;
    if (args) {
        if (args.token !== undefined && args.token !== null) {
            this.token = args.token;
        }
        if (args.id !== undefined && args.id !== null) {
            this.id = new TransactionId(args.id);
        }
    }
};
API_TokenTransferGet_args.prototype = {};
API_TokenTransferGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.token = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRUCT) {
                    this.id = new TransactionId();
                    this.id.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokenTransferGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_TokenTransferGet_args');
    if (this.token !== null && this.token !== undefined) {
        output.writeFieldBegin('token', Thrift.Type.STRING, 1);
        output.writeBinary(this.token);
        output.writeFieldEnd();
    }
    if (this.id !== null && this.id !== undefined) {
        output.writeFieldBegin('id', Thrift.Type.STRUCT, 2);
        this.id.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokenTransferGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new TokenTransfersResult(args.success);
        }
    }
};
API_TokenTransferGet_result.prototype = {};
API_TokenTransferGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new TokenTransfersResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokenTransferGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_TokenTransferGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokenTransfersListGet_args = function (args) {
    this.offset = null;
    this.limit = null;
    if (args) {
        if (args.offset !== undefined && args.offset !== null) {
            this.offset = args.offset;
        }
        if (args.limit !== undefined && args.limit !== null) {
            this.limit = args.limit;
        }
    }
};
API_TokenTransfersListGet_args.prototype = {};
API_TokenTransfersListGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.I64) {
                    this.offset = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.limit = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokenTransfersListGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_TokenTransfersListGet_args');
    if (this.offset !== null && this.offset !== undefined) {
        output.writeFieldBegin('offset', Thrift.Type.I64, 1);
        output.writeI64(this.offset);
        output.writeFieldEnd();
    }
    if (this.limit !== null && this.limit !== undefined) {
        output.writeFieldBegin('limit', Thrift.Type.I64, 2);
        output.writeI64(this.limit);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokenTransfersListGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new TokenTransfersResult(args.success);
        }
    }
};
API_TokenTransfersListGet_result.prototype = {};
API_TokenTransfersListGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new TokenTransfersResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokenTransfersListGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_TokenTransfersListGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokenWalletTransfersGet_args = function (args) {
    this.token = null;
    this.address = null;
    this.offset = null;
    this.limit = null;
    if (args) {
        if (args.token !== undefined && args.token !== null) {
            this.token = args.token;
        }
        if (args.address !== undefined && args.address !== null) {
            this.address = args.address;
        }
        if (args.offset !== undefined && args.offset !== null) {
            this.offset = args.offset;
        }
        if (args.limit !== undefined && args.limit !== null) {
            this.limit = args.limit;
        }
    }
};
API_TokenWalletTransfersGet_args.prototype = {};
API_TokenWalletTransfersGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.token = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.STRING) {
                    this.address = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I64) {
                    this.offset = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.I64) {
                    this.limit = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokenWalletTransfersGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_TokenWalletTransfersGet_args');
    if (this.token !== null && this.token !== undefined) {
        output.writeFieldBegin('token', Thrift.Type.STRING, 1);
        output.writeBinary(this.token);
        output.writeFieldEnd();
    }
    if (this.address !== null && this.address !== undefined) {
        output.writeFieldBegin('address', Thrift.Type.STRING, 2);
        output.writeBinary(this.address);
        output.writeFieldEnd();
    }
    if (this.offset !== null && this.offset !== undefined) {
        output.writeFieldBegin('offset', Thrift.Type.I64, 3);
        output.writeI64(this.offset);
        output.writeFieldEnd();
    }
    if (this.limit !== null && this.limit !== undefined) {
        output.writeFieldBegin('limit', Thrift.Type.I64, 4);
        output.writeI64(this.limit);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokenWalletTransfersGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new TokenTransfersResult(args.success);
        }
    }
};
API_TokenWalletTransfersGet_result.prototype = {};
API_TokenWalletTransfersGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new TokenTransfersResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokenWalletTransfersGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_TokenWalletTransfersGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokenTransactionsGet_args = function (args) {
    this.token = null;
    this.offset = null;
    this.limit = null;
    if (args) {
        if (args.token !== undefined && args.token !== null) {
            this.token = args.token;
        }
        if (args.offset !== undefined && args.offset !== null) {
            this.offset = args.offset;
        }
        if (args.limit !== undefined && args.limit !== null) {
            this.limit = args.limit;
        }
    }
};
API_TokenTransactionsGet_args.prototype = {};
API_TokenTransactionsGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.token = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.offset = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I64) {
                    this.limit = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokenTransactionsGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_TokenTransactionsGet_args');
    if (this.token !== null && this.token !== undefined) {
        output.writeFieldBegin('token', Thrift.Type.STRING, 1);
        output.writeBinary(this.token);
        output.writeFieldEnd();
    }
    if (this.offset !== null && this.offset !== undefined) {
        output.writeFieldBegin('offset', Thrift.Type.I64, 2);
        output.writeI64(this.offset);
        output.writeFieldEnd();
    }
    if (this.limit !== null && this.limit !== undefined) {
        output.writeFieldBegin('limit', Thrift.Type.I64, 3);
        output.writeI64(this.limit);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokenTransactionsGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new TokenTransactionsResult(args.success);
        }
    }
};
API_TokenTransactionsGet_result.prototype = {};
API_TokenTransactionsGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new TokenTransactionsResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokenTransactionsGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_TokenTransactionsGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokenInfoGet_args = function (args) {
    this.token = null;
    if (args) {
        if (args.token !== undefined && args.token !== null) {
            this.token = args.token;
        }
    }
};
API_TokenInfoGet_args.prototype = {};
API_TokenInfoGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.token = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokenInfoGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_TokenInfoGet_args');
    if (this.token !== null && this.token !== undefined) {
        output.writeFieldBegin('token', Thrift.Type.STRING, 1);
        output.writeBinary(this.token);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokenInfoGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new TokenInfoResult(args.success);
        }
    }
};
API_TokenInfoGet_result.prototype = {};
API_TokenInfoGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new TokenInfoResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokenInfoGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_TokenInfoGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokenHoldersGet_args = function (args) {
    this.token = null;
    this.offset = null;
    this.limit = null;
    this.order = null;
    this.desc = null;
    if (args) {
        if (args.token !== undefined && args.token !== null) {
            this.token = args.token;
        }
        if (args.offset !== undefined && args.offset !== null) {
            this.offset = args.offset;
        }
        if (args.limit !== undefined && args.limit !== null) {
            this.limit = args.limit;
        }
        if (args.order !== undefined && args.order !== null) {
            this.order = args.order;
        }
        if (args.desc !== undefined && args.desc !== null) {
            this.desc = args.desc;
        }
    }
};
API_TokenHoldersGet_args.prototype = {};
API_TokenHoldersGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.STRING) {
                    this.token = input.readBinary().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.offset = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I64) {
                    this.limit = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.I32) {
                    this.order = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 5:
                if (ftype == Thrift.Type.BOOL) {
                    this.desc = input.readBool().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokenHoldersGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_TokenHoldersGet_args');
    if (this.token !== null && this.token !== undefined) {
        output.writeFieldBegin('token', Thrift.Type.STRING, 1);
        output.writeBinary(this.token);
        output.writeFieldEnd();
    }
    if (this.offset !== null && this.offset !== undefined) {
        output.writeFieldBegin('offset', Thrift.Type.I64, 2);
        output.writeI64(this.offset);
        output.writeFieldEnd();
    }
    if (this.limit !== null && this.limit !== undefined) {
        output.writeFieldBegin('limit', Thrift.Type.I64, 3);
        output.writeI64(this.limit);
        output.writeFieldEnd();
    }
    if (this.order !== null && this.order !== undefined) {
        output.writeFieldBegin('order', Thrift.Type.I32, 4);
        output.writeI32(this.order);
        output.writeFieldEnd();
    }
    if (this.desc !== null && this.desc !== undefined) {
        output.writeFieldBegin('desc', Thrift.Type.BOOL, 5);
        output.writeBool(this.desc);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokenHoldersGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new TokenHoldersResult(args.success);
        }
    }
};
API_TokenHoldersGet_result.prototype = {};
API_TokenHoldersGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new TokenHoldersResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokenHoldersGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_TokenHoldersGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokensListGet_args = function (args) {
    this.offset = null;
    this.limit = null;
    this.order = null;
    this.desc = null;
    if (args) {
        if (args.offset !== undefined && args.offset !== null) {
            this.offset = args.offset;
        }
        if (args.limit !== undefined && args.limit !== null) {
            this.limit = args.limit;
        }
        if (args.order !== undefined && args.order !== null) {
            this.order = args.order;
        }
        if (args.desc !== undefined && args.desc !== null) {
            this.desc = args.desc;
        }
    }
};
API_TokensListGet_args.prototype = {};
API_TokensListGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.I64) {
                    this.offset = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.limit = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.I32) {
                    this.order = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.BOOL) {
                    this.desc = input.readBool().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokensListGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_TokensListGet_args');
    if (this.offset !== null && this.offset !== undefined) {
        output.writeFieldBegin('offset', Thrift.Type.I64, 1);
        output.writeI64(this.offset);
        output.writeFieldEnd();
    }
    if (this.limit !== null && this.limit !== undefined) {
        output.writeFieldBegin('limit', Thrift.Type.I64, 2);
        output.writeI64(this.limit);
        output.writeFieldEnd();
    }
    if (this.order !== null && this.order !== undefined) {
        output.writeFieldBegin('order', Thrift.Type.I32, 3);
        output.writeI32(this.order);
        output.writeFieldEnd();
    }
    if (this.desc !== null && this.desc !== undefined) {
        output.writeFieldBegin('desc', Thrift.Type.BOOL, 4);
        output.writeBool(this.desc);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TokensListGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new TokensListResult(args.success);
        }
    }
};
API_TokensListGet_result.prototype = {};
API_TokensListGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new TokensListResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TokensListGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_TokensListGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_WalletsGet_args = function (args) {
    this.offset = null;
    this.limit = null;
    this.ordCol = null;
    this.desc = null;
    if (args) {
        if (args.offset !== undefined && args.offset !== null) {
            this.offset = args.offset;
        }
        if (args.limit !== undefined && args.limit !== null) {
            this.limit = args.limit;
        }
        if (args.ordCol !== undefined && args.ordCol !== null) {
            this.ordCol = args.ordCol;
        }
        if (args.desc !== undefined && args.desc !== null) {
            this.desc = args.desc;
        }
    }
};
API_WalletsGet_args.prototype = {};
API_WalletsGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.I64) {
                    this.offset = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 2:
                if (ftype == Thrift.Type.I64) {
                    this.limit = input.readI64().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 3:
                if (ftype == Thrift.Type.BYTE) {
                    this.ordCol = input.readByte().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 4:
                if (ftype == Thrift.Type.BOOL) {
                    this.desc = input.readBool().value;
                } else {
                    input.skip(ftype);
                }
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_WalletsGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_WalletsGet_args');
    if (this.offset !== null && this.offset !== undefined) {
        output.writeFieldBegin('offset', Thrift.Type.I64, 1);
        output.writeI64(this.offset);
        output.writeFieldEnd();
    }
    if (this.limit !== null && this.limit !== undefined) {
        output.writeFieldBegin('limit', Thrift.Type.I64, 2);
        output.writeI64(this.limit);
        output.writeFieldEnd();
    }
    if (this.ordCol !== null && this.ordCol !== undefined) {
        output.writeFieldBegin('ordCol', Thrift.Type.BYTE, 3);
        output.writeByte(this.ordCol);
        output.writeFieldEnd();
    }
    if (this.desc !== null && this.desc !== undefined) {
        output.writeFieldBegin('desc', Thrift.Type.BOOL, 4);
        output.writeBool(this.desc);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_WalletsGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new WalletsGetResult(args.success);
        }
    }
};
API_WalletsGet_result.prototype = {};
API_WalletsGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new WalletsGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_WalletsGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_WalletsGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TrustedGet_args = function (args) {
    this.page = null;
    if (args) {
        if (args.page !== undefined && args.page !== null) {
            this.page = args.page;
        }
    }
};
API_TrustedGet_args.prototype = {};
API_TrustedGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 1:
                if (ftype == Thrift.Type.I32) {
                    this.page = input.readI32().value;
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TrustedGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_TrustedGet_args');
    if (this.page !== null && this.page !== undefined) {
        output.writeFieldBegin('page', Thrift.Type.I32, 1);
        output.writeI32(this.page);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_TrustedGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new TrustedGetResult(args.success);
        }
    }
};
API_TrustedGet_result.prototype = {};
API_TrustedGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new TrustedGetResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_TrustedGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_TrustedGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_SyncStateGet_args = function (args) {
};
API_SyncStateGet_args.prototype = {};
API_SyncStateGet_args.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        input.skip(ftype);
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_SyncStateGet_args.prototype.write = function (output) {
    output.writeStructBegin('API_SyncStateGet_args');
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

API_SyncStateGet_result = function (args) {
    this.success = null;
    if (args) {
        if (args.success !== undefined && args.success !== null) {
            this.success = new SyncStateResult(args.success);
        }
    }
};
API_SyncStateGet_result.prototype = {};
API_SyncStateGet_result.prototype.read = function (input) {
    input.readStructBegin();
    while (true) {
        var ret = input.readFieldBegin();
        var fname = ret.fname;
        var ftype = ret.ftype;
        var fid = ret.fid;
        if (ftype == Thrift.Type.STOP) {
            break;
        }
        switch (fid) {
            case 0:
                if (ftype == Thrift.Type.STRUCT) {
                    this.success = new SyncStateResult();
                    this.success.read(input);
                } else {
                    input.skip(ftype);
                }
                break;
            case 0:
                input.skip(ftype);
                break;
            default:
                input.skip(ftype);
        }
        input.readFieldEnd();
    }
    input.readStructEnd();
    return;
};

API_SyncStateGet_result.prototype.write = function (output) {
    output.writeStructBegin('API_SyncStateGet_result');
    if (this.success !== null && this.success !== undefined) {
        output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
        this.success.write(output);
        output.writeFieldEnd();
    }
    output.writeFieldStop();
    output.writeStructEnd();
    return;
};

APIClient = function (input, output) {
    this.input = input;
    this.output = (!output) ? input : output;
    this.seqid = 0;
};
APIClient.prototype = {};
APIClient.prototype.WalletDataGet = function (address, callback) {
    this.send_WalletDataGet(address, callback);
    if (!callback) {
        return this.recv_WalletDataGet();
    }
};

APIClient.prototype.send_WalletDataGet = function (address, callback) {
    this.output.writeMessageBegin('WalletDataGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        address: address
    };
    var args = new API_WalletDataGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_WalletDataGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_WalletDataGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_WalletDataGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'WalletDataGet failed: unknown result';
};
APIClient.prototype.WalletIdGet = function (address, callback) {
    this.send_WalletIdGet(address, callback);
    if (!callback) {
        return this.recv_WalletIdGet();
    }
};

APIClient.prototype.send_WalletIdGet = function (address, callback) {
    this.output.writeMessageBegin('WalletIdGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        address: address
    };
    var args = new API_WalletIdGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_WalletIdGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_WalletIdGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_WalletIdGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'WalletIdGet failed: unknown result';
};
APIClient.prototype.WalletTransactionsCountGet = function (address, callback) {
    this.send_WalletTransactionsCountGet(address, callback);
    if (!callback) {
        return this.recv_WalletTransactionsCountGet();
    }
};

APIClient.prototype.send_WalletTransactionsCountGet = function (address, callback) {
    this.output.writeMessageBegin('WalletTransactionsCountGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        address: address
    };
    var args = new API_WalletTransactionsCountGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_WalletTransactionsCountGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_WalletTransactionsCountGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_WalletTransactionsCountGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'WalletTransactionsCountGet failed: unknown result';
};
APIClient.prototype.WalletBalanceGet = function (address, callback) {
    this.send_WalletBalanceGet(address, callback);
    if (!callback) {
        return this.recv_WalletBalanceGet();
    }
};

APIClient.prototype.send_WalletBalanceGet = function (address, callback) {
    this.output.writeMessageBegin('WalletBalanceGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        address: address
    };
    var args = new API_WalletBalanceGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_WalletBalanceGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_WalletBalanceGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_WalletBalanceGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'WalletBalanceGet failed: unknown result';
};
APIClient.prototype.TransactionGet = function (transactionId, callback) {
    this.send_TransactionGet(transactionId, callback);
    if (!callback) {
        return this.recv_TransactionGet();
    }
};

APIClient.prototype.send_TransactionGet = function (transactionId, callback) {
    this.output.writeMessageBegin('TransactionGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        transactionId: transactionId
    };
    var args = new API_TransactionGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_TransactionGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_TransactionGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_TransactionGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'TransactionGet failed: unknown result';
};
APIClient.prototype.TransactionsGet = function (address, offset, limit, callback) {
    this.send_TransactionsGet(address, offset, limit, callback);
    if (!callback) {
        return this.recv_TransactionsGet();
    }
};

APIClient.prototype.send_TransactionsGet = function (address, offset, limit, callback) {
    this.output.writeMessageBegin('TransactionsGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        address: address,
        offset: offset,
        limit: limit
    };
    var args = new API_TransactionsGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_TransactionsGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_TransactionsGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_TransactionsGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'TransactionsGet failed: unknown result';
};
APIClient.prototype.TransactionFlow = function (transaction, callback) {
    this.send_TransactionFlow(transaction, callback);
    if (!callback) {
        return this.recv_TransactionFlow();
    }
};

APIClient.prototype.send_TransactionFlow = function (transaction, callback) {
    this.output.writeMessageBegin('TransactionFlow', Thrift.MessageType.CALL, this.seqid);
    var params = {
        transaction: transaction
    };
    var args = new API_TransactionFlow_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_TransactionFlow();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_TransactionFlow = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_TransactionFlow_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'TransactionFlow failed: unknown result';
};
APIClient.prototype.TransactionsListGet = function (offset, limit, callback) {
    this.send_TransactionsListGet(offset, limit, callback);
    if (!callback) {
        return this.recv_TransactionsListGet();
    }
};

APIClient.prototype.send_TransactionsListGet = function (offset, limit, callback) {
    this.output.writeMessageBegin('TransactionsListGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        offset: offset,
        limit: limit
    };
    var args = new API_TransactionsListGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_TransactionsListGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_TransactionsListGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_TransactionsListGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'TransactionsListGet failed: unknown result';
};
APIClient.prototype.GetLastHash = function (callback) {
    this.send_GetLastHash(callback);
    if (!callback) {
        return this.recv_GetLastHash();
    }
};

APIClient.prototype.send_GetLastHash = function (callback) {
    this.output.writeMessageBegin('GetLastHash', Thrift.MessageType.CALL, this.seqid);
    var args = new API_GetLastHash_args();
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_GetLastHash();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_GetLastHash = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_GetLastHash_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'GetLastHash failed: unknown result';
};
APIClient.prototype.PoolListGetStable = function (hash, limit, callback) {
    this.send_PoolListGetStable(hash, limit, callback);
    if (!callback) {
        return this.recv_PoolListGetStable();
    }
};

APIClient.prototype.send_PoolListGetStable = function (hash, limit, callback) {
    this.output.writeMessageBegin('PoolListGetStable', Thrift.MessageType.CALL, this.seqid);
    var params = {
        hash: hash,
        limit: limit
    };
    var args = new API_PoolListGetStable_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_PoolListGetStable();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_PoolListGetStable = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_PoolListGetStable_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'PoolListGetStable failed: unknown result';
};
APIClient.prototype.PoolListGet = function (offset, limit, callback) {
    this.send_PoolListGet(offset, limit, callback);
    if (!callback) {
        return this.recv_PoolListGet();
    }
};

APIClient.prototype.send_PoolListGet = function (offset, limit, callback) {
    this.output.writeMessageBegin('PoolListGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        offset: offset,
        limit: limit
    };
    var args = new API_PoolListGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_PoolListGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_PoolListGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_PoolListGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'PoolListGet failed: unknown result';
};
APIClient.prototype.PoolInfoGet = function (hash, index, callback) {
    this.send_PoolInfoGet(hash, index, callback);
    if (!callback) {
        return this.recv_PoolInfoGet();
    }
};

APIClient.prototype.send_PoolInfoGet = function (hash, index, callback) {
    this.output.writeMessageBegin('PoolInfoGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        hash: hash,
        index: index
    };
    var args = new API_PoolInfoGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_PoolInfoGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_PoolInfoGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_PoolInfoGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'PoolInfoGet failed: unknown result';
};
APIClient.prototype.PoolTransactionsGet = function (hash, offset, limit, callback) {
    this.send_PoolTransactionsGet(hash, offset, limit, callback);
    if (!callback) {
        return this.recv_PoolTransactionsGet();
    }
};

APIClient.prototype.send_PoolTransactionsGet = function (hash, offset, limit, callback) {
    this.output.writeMessageBegin('PoolTransactionsGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        hash: hash,
        offset: offset,
        limit: limit
    };
    var args = new API_PoolTransactionsGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_PoolTransactionsGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_PoolTransactionsGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_PoolTransactionsGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'PoolTransactionsGet failed: unknown result';
};
APIClient.prototype.StatsGet = function (callback) {
    this.send_StatsGet(callback);
    if (!callback) {
        return this.recv_StatsGet();
    }
};

APIClient.prototype.send_StatsGet = function (callback) {
    this.output.writeMessageBegin('StatsGet', Thrift.MessageType.CALL, this.seqid);
    var args = new API_StatsGet_args();
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_StatsGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_StatsGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_StatsGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'StatsGet failed: unknown result';
};
APIClient.prototype.SmartContractGet = function (address, callback) {
    this.send_SmartContractGet(address, callback);
    if (!callback) {
        return this.recv_SmartContractGet();
    }
};

APIClient.prototype.send_SmartContractGet = function (address, callback) {
    this.output.writeMessageBegin('SmartContractGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        address: address
    };
    var args = new API_SmartContractGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_SmartContractGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_SmartContractGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_SmartContractGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'SmartContractGet failed: unknown result';
};
APIClient.prototype.SmartContractsListGet = function (deployer, callback) {
    this.send_SmartContractsListGet(deployer, callback);
    if (!callback) {
        return this.recv_SmartContractsListGet();
    }
};

APIClient.prototype.send_SmartContractsListGet = function (deployer, callback) {
    this.output.writeMessageBegin('SmartContractsListGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        deployer: deployer
    };
    var args = new API_SmartContractsListGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_SmartContractsListGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_SmartContractsListGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_SmartContractsListGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'SmartContractsListGet failed: unknown result';
};
APIClient.prototype.SmartContractAddressesListGet = function (deployer, callback) {
    this.send_SmartContractAddressesListGet(deployer, callback);
    if (!callback) {
        return this.recv_SmartContractAddressesListGet();
    }
};

APIClient.prototype.send_SmartContractAddressesListGet = function (deployer, callback) {
    this.output.writeMessageBegin('SmartContractAddressesListGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        deployer: deployer
    };
    var args = new API_SmartContractAddressesListGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_SmartContractAddressesListGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_SmartContractAddressesListGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_SmartContractAddressesListGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'SmartContractAddressesListGet failed: unknown result';
};
APIClient.prototype.WaitForBlock = function (obsolete, callback) {
    this.send_WaitForBlock(obsolete, callback);
    if (!callback) {
        return this.recv_WaitForBlock();
    }
};

APIClient.prototype.send_WaitForBlock = function (obsolete, callback) {
    this.output.writeMessageBegin('WaitForBlock', Thrift.MessageType.CALL, this.seqid);
    var params = {
        obsolete: obsolete
    };
    var args = new API_WaitForBlock_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_WaitForBlock();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_WaitForBlock = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_WaitForBlock_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'WaitForBlock failed: unknown result';
};
APIClient.prototype.WaitForSmartTransaction = function (smart_public, callback) {
    this.send_WaitForSmartTransaction(smart_public, callback);
    if (!callback) {
        return this.recv_WaitForSmartTransaction();
    }
};

APIClient.prototype.send_WaitForSmartTransaction = function (smart_public, callback) {
    this.output.writeMessageBegin('WaitForSmartTransaction', Thrift.MessageType.CALL, this.seqid);
    var params = {
        smart_public: smart_public
    };
    var args = new API_WaitForSmartTransaction_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_WaitForSmartTransaction();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_WaitForSmartTransaction = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_WaitForSmartTransaction_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'WaitForSmartTransaction failed: unknown result';
};
APIClient.prototype.SmartContractsAllListGet = function (offset, limit, callback) {
    this.send_SmartContractsAllListGet(offset, limit, callback);
    if (!callback) {
        return this.recv_SmartContractsAllListGet();
    }
};

APIClient.prototype.send_SmartContractsAllListGet = function (offset, limit, callback) {
    this.output.writeMessageBegin('SmartContractsAllListGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        offset: offset,
        limit: limit
    };
    var args = new API_SmartContractsAllListGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_SmartContractsAllListGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_SmartContractsAllListGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_SmartContractsAllListGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'SmartContractsAllListGet failed: unknown result';
};
APIClient.prototype.TransactionsStateGet = function (address, id, callback) {
    this.send_TransactionsStateGet(address, id, callback);
    if (!callback) {
        return this.recv_TransactionsStateGet();
    }
};

APIClient.prototype.send_TransactionsStateGet = function (address, id, callback) {
    this.output.writeMessageBegin('TransactionsStateGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        address: address,
        id: id
    };
    var args = new API_TransactionsStateGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_TransactionsStateGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_TransactionsStateGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_TransactionsStateGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'TransactionsStateGet failed: unknown result';
};
APIClient.prototype.ContractAllMethodsGet = function (byteCodeObjects, callback) {
    this.send_ContractAllMethodsGet(byteCodeObjects, callback);
    if (!callback) {
        return this.recv_ContractAllMethodsGet();
    }
};

APIClient.prototype.send_ContractAllMethodsGet = function (byteCodeObjects, callback) {
    this.output.writeMessageBegin('ContractAllMethodsGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        byteCodeObjects: byteCodeObjects
    };
    var args = new API_ContractAllMethodsGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_ContractAllMethodsGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_ContractAllMethodsGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_ContractAllMethodsGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'ContractAllMethodsGet failed: unknown result';
};
APIClient.prototype.SmartMethodParamsGet = function (address, id, callback) {
    this.send_SmartMethodParamsGet(address, id, callback);
    if (!callback) {
        return this.recv_SmartMethodParamsGet();
    }
};

APIClient.prototype.send_SmartMethodParamsGet = function (address, id, callback) {
    this.output.writeMessageBegin('SmartMethodParamsGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        address: address,
        id: id
    };
    var args = new API_SmartMethodParamsGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_SmartMethodParamsGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_SmartMethodParamsGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_SmartMethodParamsGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'SmartMethodParamsGet failed: unknown result';
};
APIClient.prototype.SmartContractDataGet = function (address, callback) {
    this.send_SmartContractDataGet(address, callback);
    if (!callback) {
        return this.recv_SmartContractDataGet();
    }
};

APIClient.prototype.send_SmartContractDataGet = function (address, callback) {
    this.output.writeMessageBegin('SmartContractDataGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        address: address
    };
    var args = new API_SmartContractDataGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_SmartContractDataGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_SmartContractDataGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_SmartContractDataGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'SmartContractDataGet failed: unknown result';
};
APIClient.prototype.SmartContractCompile = function (sourceCode, callback) {
    this.send_SmartContractCompile(sourceCode, callback);
    if (!callback) {
        return this.recv_SmartContractCompile();
    }
};

APIClient.prototype.send_SmartContractCompile = function (sourceCode, callback) {
    this.output.writeMessageBegin('SmartContractCompile', Thrift.MessageType.CALL, this.seqid);
    var params = {
        sourceCode: sourceCode
    };
    var args = new API_SmartContractCompile_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_SmartContractCompile();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_SmartContractCompile = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_SmartContractCompile_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'SmartContractCompile failed: unknown result';
};
APIClient.prototype.TokenBalancesGet = function (address, callback) {
    this.send_TokenBalancesGet(address, callback);
    if (!callback) {
        return this.recv_TokenBalancesGet();
    }
};

APIClient.prototype.send_TokenBalancesGet = function (address, callback) {
    this.output.writeMessageBegin('TokenBalancesGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        address: address
    };
    var args = new API_TokenBalancesGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_TokenBalancesGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_TokenBalancesGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_TokenBalancesGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'TokenBalancesGet failed: unknown result';
};
APIClient.prototype.TokenTransfersGet = function (token, offset, limit, callback) {
    this.send_TokenTransfersGet(token, offset, limit, callback);
    if (!callback) {
        return this.recv_TokenTransfersGet();
    }
};

APIClient.prototype.send_TokenTransfersGet = function (token, offset, limit, callback) {
    this.output.writeMessageBegin('TokenTransfersGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        token: token,
        offset: offset,
        limit: limit
    };
    var args = new API_TokenTransfersGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_TokenTransfersGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_TokenTransfersGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_TokenTransfersGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'TokenTransfersGet failed: unknown result';
};
APIClient.prototype.TokenTransferGet = function (token, id, callback) {
    this.send_TokenTransferGet(token, id, callback);
    if (!callback) {
        return this.recv_TokenTransferGet();
    }
};

APIClient.prototype.send_TokenTransferGet = function (token, id, callback) {
    this.output.writeMessageBegin('TokenTransferGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        token: token,
        id: id
    };
    var args = new API_TokenTransferGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_TokenTransferGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_TokenTransferGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_TokenTransferGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'TokenTransferGet failed: unknown result';
};
APIClient.prototype.TokenTransfersListGet = function (offset, limit, callback) {
    this.send_TokenTransfersListGet(offset, limit, callback);
    if (!callback) {
        return this.recv_TokenTransfersListGet();
    }
};

APIClient.prototype.send_TokenTransfersListGet = function (offset, limit, callback) {
    this.output.writeMessageBegin('TokenTransfersListGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        offset: offset,
        limit: limit
    };
    var args = new API_TokenTransfersListGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_TokenTransfersListGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_TokenTransfersListGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_TokenTransfersListGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'TokenTransfersListGet failed: unknown result';
};
APIClient.prototype.TokenWalletTransfersGet = function (token, address, offset, limit, callback) {
    this.send_TokenWalletTransfersGet(token, address, offset, limit, callback);
    if (!callback) {
        return this.recv_TokenWalletTransfersGet();
    }
};

APIClient.prototype.send_TokenWalletTransfersGet = function (token, address, offset, limit, callback) {
    this.output.writeMessageBegin('TokenWalletTransfersGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        token: token,
        address: address,
        offset: offset,
        limit: limit
    };
    var args = new API_TokenWalletTransfersGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_TokenWalletTransfersGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_TokenWalletTransfersGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_TokenWalletTransfersGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'TokenWalletTransfersGet failed: unknown result';
};
APIClient.prototype.TokenTransactionsGet = function (token, offset, limit, callback) {
    this.send_TokenTransactionsGet(token, offset, limit, callback);
    if (!callback) {
        return this.recv_TokenTransactionsGet();
    }
};

APIClient.prototype.send_TokenTransactionsGet = function (token, offset, limit, callback) {
    this.output.writeMessageBegin('TokenTransactionsGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        token: token,
        offset: offset,
        limit: limit
    };
    var args = new API_TokenTransactionsGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_TokenTransactionsGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_TokenTransactionsGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_TokenTransactionsGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'TokenTransactionsGet failed: unknown result';
};
APIClient.prototype.TokenInfoGet = function (token, callback) {
    this.send_TokenInfoGet(token, callback);
    if (!callback) {
        return this.recv_TokenInfoGet();
    }
};

APIClient.prototype.send_TokenInfoGet = function (token, callback) {
    this.output.writeMessageBegin('TokenInfoGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        token: token
    };
    var args = new API_TokenInfoGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_TokenInfoGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_TokenInfoGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_TokenInfoGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'TokenInfoGet failed: unknown result';
};
APIClient.prototype.TokenHoldersGet = function (token, offset, limit, order, desc, callback) {
    this.send_TokenHoldersGet(token, offset, limit, order, desc, callback);
    if (!callback) {
        return this.recv_TokenHoldersGet();
    }
};

APIClient.prototype.send_TokenHoldersGet = function (token, offset, limit, order, desc, callback) {
    this.output.writeMessageBegin('TokenHoldersGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        token: token,
        offset: offset,
        limit: limit,
        order: order,
        desc: desc
    };
    var args = new API_TokenHoldersGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_TokenHoldersGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_TokenHoldersGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_TokenHoldersGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'TokenHoldersGet failed: unknown result';
};
APIClient.prototype.TokensListGet = function (offset, limit, order, desc, callback) {
    this.send_TokensListGet(offset, limit, order, desc, callback);
    if (!callback) {
        return this.recv_TokensListGet();
    }
};

APIClient.prototype.send_TokensListGet = function (offset, limit, order, desc, callback) {
    this.output.writeMessageBegin('TokensListGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        offset: offset,
        limit: limit,
        order: order,
        desc: desc
    };
    var args = new API_TokensListGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_TokensListGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_TokensListGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_TokensListGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'TokensListGet failed: unknown result';
};
APIClient.prototype.WalletsGet = function (offset, limit, ordCol, desc, callback) {
    this.send_WalletsGet(offset, limit, ordCol, desc, callback);
    if (!callback) {
        return this.recv_WalletsGet();
    }
};

APIClient.prototype.send_WalletsGet = function (offset, limit, ordCol, desc, callback) {
    this.output.writeMessageBegin('WalletsGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        offset: offset,
        limit: limit,
        ordCol: ordCol,
        desc: desc
    };
    var args = new API_WalletsGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_WalletsGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_WalletsGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_WalletsGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'WalletsGet failed: unknown result';
};
APIClient.prototype.TrustedGet = function (page, callback) {
    this.send_TrustedGet(page, callback);
    if (!callback) {
        return this.recv_TrustedGet();
    }
};

APIClient.prototype.send_TrustedGet = function (page, callback) {
    this.output.writeMessageBegin('TrustedGet', Thrift.MessageType.CALL, this.seqid);
    var params = {
        page: page
    };
    var args = new API_TrustedGet_args(params);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_TrustedGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_TrustedGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_TrustedGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'TrustedGet failed: unknown result';
};
APIClient.prototype.SyncStateGet = function (callback) {
    this.send_SyncStateGet(callback);
    if (!callback) {
        return this.recv_SyncStateGet();
    }
};

APIClient.prototype.send_SyncStateGet = function (callback) {
    this.output.writeMessageBegin('SyncStateGet', Thrift.MessageType.CALL, this.seqid);
    var args = new API_SyncStateGet_args();
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
        var self = this;
        this.output.getTransport().flush(true, function () {
            var result = null;
            try {
                result = self.recv_SyncStateGet();
            } catch (e) {
                result = e;
            }
            callback(result);
        });
    } else {
        return this.output.getTransport().flush();
    }
};

APIClient.prototype.recv_SyncStateGet = function () {
    var ret = this.input.readMessageBegin();
    var fname = ret.fname;
    var mtype = ret.mtype;
    var rseqid = ret.rseqid;
    if (mtype == Thrift.MessageType.EXCEPTION) {
        var x = new Thrift.TApplicationException();
        x.read(this.input);
        this.input.readMessageEnd();
        throw x;
    }
    var result = new API_SyncStateGet_result();
    result.read(this.input);
    this.input.readMessageEnd();

    if (null !== result.success) {
        return result.success;
    }
    throw 'SyncStateGet failed: unknown result';
};

!function (r) { "use strict"; function n(r, n) { return r << n | r >>> 32 - n } function e(r, n) { var e = 255 & r[n + 3]; return e = e << 8 | 255 & r[n + 2], e = e << 8 | 255 & r[n + 1], e << 8 | 255 & r[n + 0] } function t(r, n) { var e = r[n] << 24 | r[n + 1] << 16 | r[n + 2] << 8 | r[n + 3], t = r[n + 4] << 24 | r[n + 5] << 16 | r[n + 6] << 8 | r[n + 7]; return new sr(e, t) } function o(r, n, e) { var t; for (t = 0; t < 4; t++)r[n + t] = 255 & e, e >>>= 8 } function i(r, n, e) { r[n] = e.hi >> 24 & 255, r[n + 1] = e.hi >> 16 & 255, r[n + 2] = e.hi >> 8 & 255, r[n + 3] = 255 & e.hi, r[n + 4] = e.lo >> 24 & 255, r[n + 5] = e.lo >> 16 & 255, r[n + 6] = e.lo >> 8 & 255, r[n + 7] = 255 & e.lo } function f(r, n, e, t, o) { var i, f = 0; for (i = 0; i < o; i++)f |= r[n + i] ^ e[t + i]; return (1 & f - 1 >>> 8) - 1 } function a(r, n, e, t) { return f(r, n, e, t, 16) } function u(r, n, e, t) { return f(r, n, e, t, 32) } function c(r, t, i, f, a) { var u, c, w, y = new Uint32Array(16), l = new Uint32Array(16), s = new Uint32Array(16), h = new Uint32Array(4); for (u = 0; u < 4; u++)l[5 * u] = e(f, 4 * u), l[1 + u] = e(i, 4 * u), l[6 + u] = e(t, 4 * u), l[11 + u] = e(i, 16 + 4 * u); for (u = 0; u < 16; u++)s[u] = l[u]; for (u = 0; u < 20; u++) { for (c = 0; c < 4; c++) { for (w = 0; w < 4; w++)h[w] = l[(5 * c + 4 * w) % 16]; for (h[1] ^= n(h[0] + h[3] | 0, 7), h[2] ^= n(h[1] + h[0] | 0, 9), h[3] ^= n(h[2] + h[1] | 0, 13), h[0] ^= n(h[3] + h[2] | 0, 18), w = 0; w < 4; w++)y[4 * c + (c + w) % 4] = h[w] } for (w = 0; w < 16; w++)l[w] = y[w] } if (a) { for (u = 0; u < 16; u++)l[u] = l[u] + s[u] | 0; for (u = 0; u < 4; u++)l[5 * u] = l[5 * u] - e(f, 4 * u) | 0, l[6 + u] = l[6 + u] - e(t, 4 * u) | 0; for (u = 0; u < 4; u++)o(r, 4 * u, l[5 * u]), o(r, 16 + 4 * u, l[6 + u]) } else for (u = 0; u < 16; u++)o(r, 4 * u, l[u] + s[u] | 0) } function w(r, n, e, t) { return c(r, n, e, t, !1), 0 } function y(r, n, e, t) { return c(r, n, e, t, !0), 0 } function l(r, n, e, t, o, i, f) { var a, u, c = new Uint8Array(16), y = new Uint8Array(64); if (!o) return 0; for (u = 0; u < 16; u++)c[u] = 0; for (u = 0; u < 8; u++)c[u] = i[u]; for (; o >= 64;) { for (w(y, c, f, Br), u = 0; u < 64; u++)r[n + u] = (e ? e[t + u] : 0) ^ y[u]; for (a = 1, u = 8; u < 16; u++)a = a + (255 & c[u]) | 0, c[u] = 255 & a, a >>>= 8; o -= 64, n += 64, e && (t += 64) } if (o > 0) for (w(y, c, f, Br), u = 0; u < o; u++)r[n + u] = (e ? e[t + u] : 0) ^ y[u]; return 0 } function s(r, n, e, t, o) { return l(r, n, null, 0, e, t, o) } function h(r, n, e, t, o) { var i = new Uint8Array(32); return y(i, t, o, Br), s(r, n, e, t.subarray(16), i) } function v(r, n, e, t, o, i, f) { var a = new Uint8Array(32); return y(a, i, f, Br), l(r, n, e, t, o, i.subarray(16), a) } function g(r, n) { var e, t = 0; for (e = 0; e < 17; e++)t = t + (r[e] + n[e] | 0) | 0, r[e] = 255 & t, t >>>= 8 } function b(r, n, e, t, o, i) { var f, a, u, c, w = new Uint32Array(17), y = new Uint32Array(17), l = new Uint32Array(17), s = new Uint32Array(17), h = new Uint32Array(17); for (u = 0; u < 17; u++)y[u] = l[u] = 0; for (u = 0; u < 16; u++)y[u] = i[u]; for (y[3] &= 15, y[4] &= 252, y[7] &= 15, y[8] &= 252, y[11] &= 15, y[12] &= 252, y[15] &= 15; o > 0;) { for (u = 0; u < 17; u++)s[u] = 0; for (u = 0; u < 16 && u < o; ++u)s[u] = e[t + u]; for (s[u] = 1, t += u, o -= u, g(l, s), a = 0; a < 17; a++)for (w[a] = 0, u = 0; u < 17; u++)w[a] = w[a] + l[u] * (u <= a ? y[a - u] : 320 * y[a + 17 - u] | 0) | 0 | 0; for (a = 0; a < 17; a++)l[a] = w[a]; for (c = 0, u = 0; u < 16; u++)c = c + l[u] | 0, l[u] = 255 & c, c >>>= 8; for (c = c + l[16] | 0, l[16] = 3 & c, c = 5 * (c >>> 2) | 0, u = 0; u < 16; u++)c = c + l[u] | 0, l[u] = 255 & c, c >>>= 8; c = c + l[16] | 0, l[16] = c } for (u = 0; u < 17; u++)h[u] = l[u]; for (g(l, Sr), f = 0 | -(l[16] >>> 7), u = 0; u < 17; u++)l[u] ^= f & (h[u] ^ l[u]); for (u = 0; u < 16; u++)s[u] = i[u + 16]; for (s[16] = 0, g(l, s), u = 0; u < 16; u++)r[n + u] = l[u]; return 0 } function p(r, n, e, t, o, i) { var f = new Uint8Array(16); return b(f, 0, e, t, o, i), a(r, n, f, 0) } function _(r, n, e, t, o) { var i; if (e < 32) return -1; for (v(r, 0, n, 0, e, t, o), b(r, 16, r, 32, e - 32, r), i = 0; i < 16; i++)r[i] = 0; return 0 } function A(r, n, e, t, o) { var i, f = new Uint8Array(32); if (e < 32) return -1; if (h(f, 0, 32, t, o), 0 !== p(n, 16, n, 32, e - 32, f)) return -1; for (v(r, 0, n, 0, e, t, o), i = 0; i < 32; i++)r[i] = 0; return 0 } function U(r, n) { var e; for (e = 0; e < 16; e++)r[e] = 0 | n[e] } function E(r) { var n, e; for (e = 0; e < 16; e++)r[e] += 65536, n = Math.floor(r[e] / 65536), r[(e + 1) * (e < 15 ? 1 : 0)] += n - 1 + 37 * (n - 1) * (15 === e ? 1 : 0), r[e] -= 65536 * n } function x(r, n, e) { for (var t, o = ~(e - 1), i = 0; i < 16; i++)t = o & (r[i] ^ n[i]), r[i] ^= t, n[i] ^= t } function d(r, n) { var e, t, o, i = hr(), f = hr(); for (e = 0; e < 16; e++)f[e] = n[e]; for (E(f), E(f), E(f), t = 0; t < 2; t++) { for (i[0] = f[0] - 65517, e = 1; e < 15; e++)i[e] = f[e] - 65535 - (i[e - 1] >> 16 & 1), i[e - 1] &= 65535; i[15] = f[15] - 32767 - (i[14] >> 16 & 1), o = i[15] >> 16 & 1, i[14] &= 65535, x(f, i, 1 - o) } for (e = 0; e < 16; e++)r[2 * e] = 255 & f[e], r[2 * e + 1] = f[e] >> 8 } function m(r, n) { var e = new Uint8Array(32), t = new Uint8Array(32); return d(e, r), d(t, n), u(e, 0, t, 0) } function B(r) { var n = new Uint8Array(32); return d(n, r), 1 & n[0] } function S(r, n) { var e; for (e = 0; e < 16; e++)r[e] = n[2 * e] + (n[2 * e + 1] << 8); r[15] &= 32767 } function K(r, n, e) { var t; for (t = 0; t < 16; t++)r[t] = n[t] + e[t] | 0 } function Y(r, n, e) { var t; for (t = 0; t < 16; t++)r[t] = n[t] - e[t] | 0 } function T(r, n, e) { var t, o, i = new Float64Array(31); for (t = 0; t < 31; t++)i[t] = 0; for (t = 0; t < 16; t++)for (o = 0; o < 16; o++)i[t + o] += n[t] * e[o]; for (t = 0; t < 15; t++)i[t] += 38 * i[t + 16]; for (t = 0; t < 16; t++)r[t] = i[t]; E(r), E(r) } function L(r, n) { T(r, n, n) } function k(r, n) { var e, t = hr(); for (e = 0; e < 16; e++)t[e] = n[e]; for (e = 253; e >= 0; e--)L(t, t), 2 !== e && 4 !== e && T(t, t, n); for (e = 0; e < 16; e++)r[e] = t[e] } function z(r, n) { var e, t = hr(); for (e = 0; e < 16; e++)t[e] = n[e]; for (e = 250; e >= 0; e--)L(t, t), 1 !== e && T(t, t, n); for (e = 0; e < 16; e++)r[e] = t[e] } function R(r, n, e) { var t, o, i = new Uint8Array(32), f = new Float64Array(80), a = hr(), u = hr(), c = hr(), w = hr(), y = hr(), l = hr(); for (o = 0; o < 31; o++)i[o] = n[o]; for (i[31] = 127 & n[31] | 64, i[0] &= 248, S(f, e), o = 0; o < 16; o++)u[o] = f[o], w[o] = a[o] = c[o] = 0; for (a[0] = w[0] = 1, o = 254; o >= 0; --o)t = i[o >>> 3] >>> (7 & o) & 1, x(a, u, t), x(c, w, t), K(y, a, c), Y(a, a, c), K(c, u, w), Y(u, u, w), L(w, y), L(l, a), T(a, c, a), T(c, u, y), K(y, a, c), Y(a, a, c), L(u, a), Y(c, w, l), T(a, c, Ar), K(a, a, w), T(c, c, a), T(a, w, l), T(w, u, f), L(u, y), x(a, u, t), x(c, w, t); for (o = 0; o < 16; o++)f[o + 16] = a[o], f[o + 32] = c[o], f[o + 48] = u[o], f[o + 64] = w[o]; var s = f.subarray(32), h = f.subarray(16); return k(s, s), T(h, h, s), d(r, h), 0 } function P(r, n) { return R(r, n, br) } function N(r, n) { return vr(n, 32), P(r, n) } function O(r, n, e) { var t = new Uint8Array(32); return R(t, e, n), y(r, gr, t, Br) } function C(r, n, e, t, o, i) { var f = new Uint8Array(32); return O(f, o, i), Kr(r, n, e, t, f) } function F(r, n, e, t, o, i) { var f = new Uint8Array(32); return O(f, o, i), Yr(r, n, e, t, f) } function M() { var r, n, e, t = 0, o = 0, i = 0, f = 0, a = 65535; for (e = 0; e < arguments.length; e++)r = arguments[e].lo, n = arguments[e].hi, t += r & a, o += r >>> 16, i += n & a, f += n >>> 16; return o += t >>> 16, i += o >>> 16, f += i >>> 16, new sr(i & a | f << 16, t & a | o << 16) } function G(r, n) { return new sr(r.hi >>> n, r.lo >>> n | r.hi << 32 - n) } function Z() { var r, n = 0, e = 0; for (r = 0; r < arguments.length; r++)n ^= arguments[r].lo, e ^= arguments[r].hi; return new sr(e, n) } function q(r, n) { var e, t, o = 32 - n; return n < 32 ? (e = r.hi >>> n | r.lo << o, t = r.lo >>> n | r.hi << o) : n < 64 && (e = r.lo >>> n | r.hi << o, t = r.hi >>> n | r.lo << o), new sr(e, t) } function I(r, n, e) { var t = r.hi & n.hi ^ ~r.hi & e.hi, o = r.lo & n.lo ^ ~r.lo & e.lo; return new sr(t, o) } function V(r, n, e) { var t = r.hi & n.hi ^ r.hi & e.hi ^ n.hi & e.hi, o = r.lo & n.lo ^ r.lo & e.lo ^ n.lo & e.lo; return new sr(t, o) } function X(r) { return Z(q(r, 28), q(r, 34), q(r, 39)) } function D(r) { return Z(q(r, 14), q(r, 18), q(r, 41)) } function j(r) { return Z(q(r, 1), q(r, 8), G(r, 7)) } function H(r) { return Z(q(r, 19), q(r, 61), G(r, 6)) } function J(r, n, e) { var o, f, a, u = [], c = [], w = [], y = []; for (f = 0; f < 8; f++)u[f] = w[f] = t(r, 8 * f); for (var l = 0; e >= 128;) { for (f = 0; f < 16; f++)y[f] = t(n, 8 * f + l); for (f = 0; f < 80; f++) { for (a = 0; a < 8; a++)c[a] = w[a]; for (o = M(w[7], D(w[4]), I(w[4], w[5], w[6]), Tr[f], y[f % 16]), c[7] = M(o, X(w[0]), V(w[0], w[1], w[2])), c[3] = M(c[3], o), a = 0; a < 8; a++)w[(a + 1) % 8] = c[a]; if (f % 16 === 15) for (a = 0; a < 16; a++)y[a] = M(y[a], y[(a + 9) % 16], j(y[(a + 1) % 16]), H(y[(a + 14) % 16])) } for (f = 0; f < 8; f++)w[f] = M(w[f], u[f]), u[f] = w[f]; l += 128, e -= 128 } for (f = 0; f < 8; f++)i(r, 8 * f, u[f]); return e } function Q(r, n, e) { var t, o = new Uint8Array(64), f = new Uint8Array(256), a = e; for (t = 0; t < 64; t++)o[t] = Lr[t]; for (J(o, n, e), e %= 128, t = 0; t < 256; t++)f[t] = 0; for (t = 0; t < e; t++)f[t] = n[a - e + t]; for (f[e] = 128, e = 256 - 128 * (e < 112 ? 1 : 0), f[e - 9] = 0, i(f, e - 8, new sr(a / 536870912 | 0, a << 3)), J(o, f, e), t = 0; t < 64; t++)r[t] = o[t]; return 0 } function W(r, n) { var e = hr(), t = hr(), o = hr(), i = hr(), f = hr(), a = hr(), u = hr(), c = hr(), w = hr(); Y(e, r[1], r[0]), Y(w, n[1], n[0]), T(e, e, w), K(t, r[0], r[1]), K(w, n[0], n[1]), T(t, t, w), T(o, r[3], n[3]), T(o, o, Er), T(i, r[2], n[2]), K(i, i, i), Y(f, t, e), Y(a, i, o), K(u, i, o), K(c, t, e), T(r[0], f, a), T(r[1], c, u), T(r[2], u, a), T(r[3], f, c) } function $(r, n, e) { var t; for (t = 0; t < 4; t++)x(r[t], n[t], e) } function rr(r, n) { var e = hr(), t = hr(), o = hr(); k(o, n[2]), T(e, n[0], o), T(t, n[1], o), d(r, t), r[31] ^= B(e) << 7 } function nr(r, n, e) { var t, o; for (U(r[0], pr), U(r[1], _r), U(r[2], _r), U(r[3], pr), o = 255; o >= 0; --o)t = e[o / 8 | 0] >> (7 & o) & 1, $(r, n, t), W(n, r), W(r, r), $(r, n, t) } function er(r, n) { var e = [hr(), hr(), hr(), hr()]; U(e[0], xr), U(e[1], dr), U(e[2], _r), T(e[3], xr, dr), nr(r, e, n) } function tr(r, n, e) { var t, o = new Uint8Array(64), i = [hr(), hr(), hr(), hr()]; for (e || vr(n, 32), Q(o, n, 32), o[0] &= 248, o[31] &= 127, o[31] |= 64, er(i, o), rr(r, i), t = 0; t < 32; t++)n[t + 32] = r[t]; return 0 } function or(r, n) { var e, t, o, i; for (t = 63; t >= 32; --t) { for (e = 0, o = t - 32, i = t - 12; o < i; ++o)n[o] += e - 16 * n[t] * kr[o - (t - 32)], e = n[o] + 128 >> 8, n[o] -= 256 * e; n[o] += e, n[t] = 0 } for (e = 0, o = 0; o < 32; o++)n[o] += e - (n[31] >> 4) * kr[o], e = n[o] >> 8, n[o] &= 255; for (o = 0; o < 32; o++)n[o] -= e * kr[o]; for (t = 0; t < 32; t++)n[t + 1] += n[t] >> 8, r[t] = 255 & n[t] } function ir(r) { var n, e = new Float64Array(64); for (n = 0; n < 64; n++)e[n] = r[n]; for (n = 0; n < 64; n++)r[n] = 0; or(r, e) } function fr(r, n, e, t) { var o, i, f = new Uint8Array(64), a = new Uint8Array(64), u = new Uint8Array(64), c = new Float64Array(64), w = [hr(), hr(), hr(), hr()]; Q(f, t, 32), f[0] &= 248, f[31] &= 127, f[31] |= 64; var y = e + 64; for (o = 0; o < e; o++)r[64 + o] = n[o]; for (o = 0; o < 32; o++)r[32 + o] = f[32 + o]; for (Q(u, r.subarray(32), e + 32), ir(u), er(w, u), rr(r, w), o = 32; o < 64; o++)r[o] = t[o]; for (Q(a, r, e + 64), ir(a), o = 0; o < 64; o++)c[o] = 0; for (o = 0; o < 32; o++)c[o] = u[o]; for (o = 0; o < 32; o++)for (i = 0; i < 32; i++)c[o + i] += a[o] * f[i]; return or(r.subarray(32), c), y } function ar(r, n) { var e = hr(), t = hr(), o = hr(), i = hr(), f = hr(), a = hr(), u = hr(); return U(r[2], _r), S(r[1], n), L(o, r[1]), T(i, o, Ur), Y(o, o, r[2]), K(i, r[2], i), L(f, i), L(a, f), T(u, a, f), T(e, u, o), T(e, e, i), z(e, e), T(e, e, o), T(e, e, i), T(e, e, i), T(r[0], e, i), L(t, r[0]), T(t, t, i), m(t, o) && T(r[0], r[0], mr), L(t, r[0]), T(t, t, i), m(t, o) ? -1 : (B(r[0]) === n[31] >> 7 && Y(r[0], pr, r[0]), T(r[3], r[0], r[1]), 0) } function ur(r, n, e, t) { var o, i, f = new Uint8Array(32), a = new Uint8Array(64), c = [hr(), hr(), hr(), hr()], w = [hr(), hr(), hr(), hr()]; if (i = -1, e < 64) return -1; if (ar(w, t)) return -1; for (o = 0; o < e; o++)r[o] = n[o]; for (o = 0; o < 32; o++)r[o + 32] = t[o]; if (Q(a, r, e), ir(a), nr(c, w, a), er(w, n.subarray(32)), W(c, w), rr(f, c), e -= 64, u(n, 0, f, 0)) { for (o = 0; o < e; o++)r[o] = 0; return -1 } for (o = 0; o < e; o++)r[o] = n[o + 64]; return i = e } function cr(r, n) { if (r.length !== zr) throw new Error("bad key size"); if (n.length !== Rr) throw new Error("bad nonce size") } function wr(r, n) { if (r.length !== Fr) throw new Error("bad public key size"); if (n.length !== Mr) throw new Error("bad secret key size") } function yr() { for (var r = 0; r < arguments.length; r++)if (!(arguments[r] instanceof Uint8Array)) throw new TypeError("unexpected type, use Uint8Array") } function lr(r) { for (var n = 0; n < r.length; n++)r[n] = 0 } var sr = function (r, n) { this.hi = 0 | r, this.lo = 0 | n }, hr = function (r) { var n, e = new Float64Array(16); if (r) for (n = 0; n < r.length; n++)e[n] = r[n]; return e }, vr = function () { throw new Error("no PRNG") }, gr = new Uint8Array(16), br = new Uint8Array(32); br[0] = 9; var pr = hr(), _r = hr([1]), Ar = hr([56129, 1]), Ur = hr([30883, 4953, 19914, 30187, 55467, 16705, 2637, 112, 59544, 30585, 16505, 36039, 65139, 11119, 27886, 20995]), Er = hr([61785, 9906, 39828, 60374, 45398, 33411, 5274, 224, 53552, 61171, 33010, 6542, 64743, 22239, 55772, 9222]), xr = hr([54554, 36645, 11616, 51542, 42930, 38181, 51040, 26924, 56412, 64982, 57905, 49316, 21502, 52590, 14035, 8553]), dr = hr([26200, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214]), mr = hr([41136, 18958, 6951, 50414, 58488, 44335, 6150, 12099, 55207, 15867, 153, 11085, 57099, 20417, 9344, 11139]), Br = new Uint8Array([101, 120, 112, 97, 110, 100, 32, 51, 50, 45, 98, 121, 116, 101, 32, 107]), Sr = new Uint32Array([5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 252]), Kr = _, Yr = A, Tr = [new sr(1116352408, 3609767458), new sr(1899447441, 602891725), new sr(3049323471, 3964484399), new sr(3921009573, 2173295548), new sr(961987163, 4081628472), new sr(1508970993, 3053834265), new sr(2453635748, 2937671579), new sr(2870763221, 3664609560), new sr(3624381080, 2734883394), new sr(310598401, 1164996542), new sr(607225278, 1323610764), new sr(1426881987, 3590304994), new sr(1925078388, 4068182383), new sr(2162078206, 991336113), new sr(2614888103, 633803317), new sr(3248222580, 3479774868), new sr(3835390401, 2666613458), new sr(4022224774, 944711139), new sr(264347078, 2341262773), new sr(604807628, 2007800933), new sr(770255983, 1495990901), new sr(1249150122, 1856431235), new sr(1555081692, 3175218132), new sr(1996064986, 2198950837), new sr(2554220882, 3999719339), new sr(2821834349, 766784016), new sr(2952996808, 2566594879), new sr(3210313671, 3203337956), new sr(3336571891, 1034457026), new sr(3584528711, 2466948901), new sr(113926993, 3758326383), new sr(338241895, 168717936), new sr(666307205, 1188179964), new sr(773529912, 1546045734), new sr(1294757372, 1522805485), new sr(1396182291, 2643833823), new sr(1695183700, 2343527390), new sr(1986661051, 1014477480), new sr(2177026350, 1206759142), new sr(2456956037, 344077627), new sr(2730485921, 1290863460), new sr(2820302411, 3158454273), new sr(3259730800, 3505952657), new sr(3345764771, 106217008), new sr(3516065817, 3606008344), new sr(3600352804, 1432725776), new sr(4094571909, 1467031594), new sr(275423344, 851169720), new sr(430227734, 3100823752), new sr(506948616, 1363258195), new sr(659060556, 3750685593), new sr(883997877, 3785050280), new sr(958139571, 3318307427), new sr(1322822218, 3812723403), new sr(1537002063, 2003034995), new sr(1747873779, 3602036899), new sr(1955562222, 1575990012), new sr(2024104815, 1125592928), new sr(2227730452, 2716904306), new sr(2361852424, 442776044), new sr(2428436474, 593698344), new sr(2756734187, 3733110249), new sr(3204031479, 2999351573), new sr(3329325298, 3815920427), new sr(3391569614, 3928383900), new sr(3515267271, 566280711), new sr(3940187606, 3454069534), new sr(4118630271, 4000239992), new sr(116418474, 1914138554), new sr(174292421, 2731055270), new sr(289380356, 3203993006), new sr(460393269, 320620315), new sr(685471733, 587496836), new sr(852142971, 1086792851), new sr(1017036298, 365543100), new sr(1126000580, 2618297676), new sr(1288033470, 3409855158), new sr(1501505948, 4234509866), new sr(1607167915, 987167468), new sr(1816402316, 1246189591)], Lr = new Uint8Array([106, 9, 230, 103, 243, 188, 201, 8, 187, 103, 174, 133, 132, 202, 167, 59, 60, 110, 243, 114, 254, 148, 248, 43, 165, 79, 245, 58, 95, 29, 54, 241, 81, 14, 82, 127, 173, 230, 130, 209, 155, 5, 104, 140, 43, 62, 108, 31, 31, 131, 217, 171, 251, 65, 189, 107, 91, 224, 205, 25, 19, 126, 33, 121]), kr = new Float64Array([237, 211, 245, 92, 26, 99, 18, 88, 214, 156, 247, 162, 222, 249, 222, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16]), zr = 32, Rr = 24, Pr = 32, Nr = 16, Or = 32, Cr = 32, Fr = 32, Mr = 32, Gr = 32, Zr = Rr, qr = Pr, Ir = Nr, Vr = 64, Xr = 32, Dr = 64, jr = 32, Hr = 64; r.lowlevel = { crypto_core_hsalsa20: y, crypto_stream_xor: v, crypto_stream: h, crypto_stream_salsa20_xor: l, crypto_stream_salsa20: s, crypto_onetimeauth: b, crypto_onetimeauth_verify: p, crypto_verify_16: a, crypto_verify_32: u, crypto_secretbox: _, crypto_secretbox_open: A, crypto_scalarmult: R, crypto_scalarmult_base: P, crypto_box_beforenm: O, crypto_box_afternm: Kr, crypto_box: C, crypto_box_open: F, crypto_box_keypair: N, crypto_hash: Q, crypto_sign: fr, crypto_sign_keypair: tr, crypto_sign_open: ur, crypto_secretbox_KEYBYTES: zr, crypto_secretbox_NONCEBYTES: Rr, crypto_secretbox_ZEROBYTES: Pr, crypto_secretbox_BOXZEROBYTES: Nr, crypto_scalarmult_BYTES: Or, crypto_scalarmult_SCALARBYTES: Cr, crypto_box_PUBLICKEYBYTES: Fr, crypto_box_SECRETKEYBYTES: Mr, crypto_box_BEFORENMBYTES: Gr, crypto_box_NONCEBYTES: Zr, crypto_box_ZEROBYTES: qr, crypto_box_BOXZEROBYTES: Ir, crypto_sign_BYTES: Vr, crypto_sign_PUBLICKEYBYTES: Xr, crypto_sign_SECRETKEYBYTES: Dr, crypto_sign_SEEDBYTES: jr, crypto_hash_BYTES: Hr }, r.randomBytes = function (r) { var n = new Uint8Array(r); return vr(n, r), n }, r.secretbox = function (r, n, e) { yr(r, n, e), cr(e, n); for (var t = new Uint8Array(Pr + r.length), o = new Uint8Array(t.length), i = 0; i < r.length; i++)t[i + Pr] = r[i]; return _(o, t, t.length, n, e), o.subarray(Nr) }, r.secretbox.open = function (r, n, e) { yr(r, n, e), cr(e, n); for (var t = new Uint8Array(Nr + r.length), o = new Uint8Array(t.length), i = 0; i < r.length; i++)t[i + Nr] = r[i]; return t.length < 32 ? null : 0 !== A(o, t, t.length, n, e) ? null : o.subarray(Pr) }, r.secretbox.keyLength = zr, r.secretbox.nonceLength = Rr, r.secretbox.overheadLength = Nr, r.scalarMult = function (r, n) { if (yr(r, n), r.length !== Cr) throw new Error("bad n size"); if (n.length !== Or) throw new Error("bad p size"); var e = new Uint8Array(Or); return R(e, r, n), e }, r.scalarMult.base = function (r) { if (yr(r), r.length !== Cr) throw new Error("bad n size"); var n = new Uint8Array(Or); return P(n, r), n }, r.scalarMult.scalarLength = Cr, r.scalarMult.groupElementLength = Or, r.box = function (n, e, t, o) { var i = r.box.before(t, o); return r.secretbox(n, e, i) }, r.box.before = function (r, n) { yr(r, n), wr(r, n); var e = new Uint8Array(Gr); return O(e, r, n), e }, r.box.after = r.secretbox, r.box.open = function (n, e, t, o) { var i = r.box.before(t, o); return r.secretbox.open(n, e, i) }, r.box.open.after = r.secretbox.open, r.box.keyPair = function () { var r = new Uint8Array(Fr), n = new Uint8Array(Mr); return N(r, n), { publicKey: r, secretKey: n } }, r.box.keyPair.fromSecretKey = function (r) { if (yr(r), r.length !== Mr) throw new Error("bad secret key size"); var n = new Uint8Array(Fr); return P(n, r), { publicKey: n, secretKey: new Uint8Array(r) } }, r.box.publicKeyLength = Fr, r.box.secretKeyLength = Mr, r.box.sharedKeyLength = Gr, r.box.nonceLength = Zr, r.box.overheadLength = r.secretbox.overheadLength, r.sign = function (r, n) { if (yr(r, n), n.length !== Dr) throw new Error("bad secret key size"); var e = new Uint8Array(Vr + r.length); return fr(e, r, r.length, n), e }, r.sign.open = function (r, n) { if (yr(r, n), n.length !== Xr) throw new Error("bad public key size"); var e = new Uint8Array(r.length), t = ur(e, r, r.length, n); if (t < 0) return null; for (var o = new Uint8Array(t), i = 0; i < o.length; i++)o[i] = e[i]; return o }, r.sign.detached = function (n, e) { for (var t = r.sign(n, e), o = new Uint8Array(Vr), i = 0; i < o.length; i++)o[i] = t[i]; return o }, r.sign.detached.verify = function (r, n, e) { if (yr(r, n, e), n.length !== Vr) throw new Error("bad signature size"); if (e.length !== Xr) throw new Error("bad public key size"); var t, o = new Uint8Array(Vr + r.length), i = new Uint8Array(Vr + r.length); for (t = 0; t < Vr; t++)o[t] = n[t]; for (t = 0; t < r.length; t++)o[t + Vr] = r[t]; return ur(i, o, o.length, e) >= 0 }, r.sign.keyPair = function () { var r = new Uint8Array(Xr), n = new Uint8Array(Dr); return tr(r, n), { publicKey: r, secretKey: n } }, r.sign.keyPair.fromSecretKey = function (r) { if (yr(r), r.length !== Dr) throw new Error("bad secret key size"); for (var n = new Uint8Array(Xr), e = 0; e < n.length; e++)n[e] = r[32 + e]; return { publicKey: n, secretKey: new Uint8Array(r) } }, r.sign.keyPair.fromSeed = function (r) { if (yr(r), r.length !== jr) throw new Error("bad seed size"); for (var n = new Uint8Array(Xr), e = new Uint8Array(Dr), t = 0; t < 32; t++)e[t] = r[t]; return tr(n, e, !0), { publicKey: n, secretKey: e } }, r.sign.publicKeyLength = Xr, r.sign.secretKeyLength = Dr, r.sign.seedLength = jr, r.sign.signatureLength = Vr, r.hash = function (r) { yr(r); var n = new Uint8Array(Hr); return Q(n, r, r.length), n }, r.hash.hashLength = Hr, r.verify = function (r, n) { return yr(r, n), 0 !== r.length && 0 !== n.length && (r.length === n.length && 0 === f(r, 0, n, 0, r.length)) }, r.setPRNG = function (r) { vr = r }, function () { var n = "undefined" != typeof self ? self.crypto || self.msCrypto : null; if (n && n.getRandomValues) { var e = 65536; r.setPRNG(function (r, t) { var o, i = new Uint8Array(t); for (o = 0; o < t; o += e)n.getRandomValues(i.subarray(o, o + Math.min(t - o, e))); for (o = 0; o < t; o++)r[o] = i[o]; lr(i) }) } else "undefined" != typeof require && (n = require("crypto"), n && n.randomBytes && r.setPRNG(function (r, e) { var t, o = n.randomBytes(e); for (t = 0; t < e; t++)r[t] = o[t]; lr(o) })) }() }("undefined" != typeof module && module.exports ? module.exports : self.nacl = self.nacl || {});