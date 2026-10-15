import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {walletSnapshot} from './dist/wallet-session.mjs';
import {NETWORK} from './dist/chain.mjs';
const source=readFileSync(new URL('./dist/workspace.mjs',import.meta.url),'utf8');
function fixture(){
 const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);};
 let accounts=['0x1234567890'],chain='0x1';
 const provider={request:async({method})=>method==='eth_accounts'?accounts:chain};
 const context=vm.createContext({$,walletSnapshot,window:{ethereum:provider},NETWORK,short:s=>s,accountConnection:null,wallet:null,selected:null,busy:false,disconnected:false,resetActivity(){},refreshActivity:async()=>{},contractAddress:'0xcontract',refreshWithdrawal:async()=>{},updatePayment:()=>{},BrowserProvider:class{async getSigner(){return {};}}});
 vm.runInContext(source.slice(source.indexOf('let networkConnection='),source.indexOf('const KEY=')),context);
 return {$,context,sync:()=>vm.runInContext('syncWallet()',context),chain:v=>chain=v,accounts:v=>accounts=v};
}
test('workspace displays wrong-network banner and blocks transaction controls',async()=>{
 const f=fixture();await f.sync();assert.equal(f.$('network-help').hidden,false);assert.match(f.$('wallet-label').textContent,/Wrong network/);assert.equal(f.$('connect').textContent,'Switch network');
 for(const id of ['pay','publish','deploy','withdraw'])assert.equal(f.$(id).disabled,true);
});
test('manual switch restores connected state; account revocation clears it',async()=>{
 const f=fixture();await f.sync();f.chain(NETWORK.chainId);await f.sync();assert.equal(f.$('network-help').hidden,true);assert.equal(f.$('connect').textContent,'Connected');assert.equal(f.$('publish').disabled,false);
 f.accounts([]);await f.sync();assert.equal(f.$('connect').textContent,'Connect wallet');assert.equal(f.$('wallet-label').textContent,'Wallet not connected');
});

function reviewFixture(changeAt){
 let sent=0,opened=0;const elements=new Map();let context;
 const invalidate=()=>vm.runInContext('walletVersion++;',context);
 const $=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',close(){},showModal(){opened++;if(changeAt==='review')invalidate();queueMicrotask(()=>elements.get('confirm-send').onclick());}});return elements.get(id);};
 const signer={sendTransaction:async()=>{sent++;return {hash:'0xhash'};}};
 context=vm.createContext({$,queueMicrotask,pending:null,wallet:{account:'0xabc',signer},walletVersion:1,selected:null,contractAddress:'0xcontract',NETWORK,
  reader:{estimateGas:async()=>{if(changeAt==='estimate')invalidate();return 100n;},getFeeData:async()=>({gasPrice:1n}),getBalance:async()=>1000n,waitForTransaction:async()=>null},
  window:{ethereum:{request:async({method})=>{if(changeAt==='verification'&&method==='eth_chainId')invalidate();return method==='eth_accounts'?['0xabc']:NETWORK.chainId;}}},
  display:String,esc:String,message(){},store:{set(){}},KEY:'test',showPending(){},recover(){}});
 vm.runInContext(source.slice(source.indexOf('async function sendReviewed('),source.indexOf('async function refreshWithdrawal(')),context);
 return {send:()=>vm.runInContext("sendReviewed('pay',{value:1n})",context),sent:()=>sent,opened:()=>opened};
}
for(const stage of ['estimate','review','verification'])test(`wallet change during ${stage} invalidates review without sending`,async()=>{
 const f=reviewFixture(stage);await assert.rejects(f.send(),/wallet account or network changed/);assert.equal(f.sent(),0);if(stage==='estimate')assert.equal(f.opened(),0);
});
test('unchanged approved wallet review submits once',async()=>{const f=reviewFixture();await f.send();assert.equal(f.sent(),1);assert.equal(f.opened(),1);});

test('direct receipt view uses verified payment data without asking for a wallet',async()=>{
 const evidence=JSON.parse(readFileSync(new URL('./verification/mainnet-flow.json',import.meta.url)));
 const {receiptHTML}=await import('./dist/receipt.mjs');let opened=0,calls=0;
 const elements={'receipt-body':{},'receipt-dialog':{showModal(){opened++;}}};
 const context=vm.createContext({$:id=>elements[id],selected:{id:'1',plan:{title:'Website design'}},contractAddress:evidence.contract,receiptHTML,client:{paymentReceipt:async(address,id,hash)=>{calls++;assert.equal(address,evidence.contract);assert.equal(id,'1');assert.equal(hash,evidence.transactions.payment);return evidence.paymentReceipt;}}});
 vm.runInContext(source.slice(source.indexOf('async function openReceipt('),source.indexOf("$('payment-history').onclick=")),context);
 await vm.runInContext(`openReceipt('${evidence.transactions.payment}')`,context);
 assert.equal(calls,1);assert.equal(opened,1);assert.match(elements['receipt-body'].innerHTML,/0.01 USDC/);
});

test('intentional disconnect clears wallet state and blocks passive reconnection',async()=>{
 const f=fixture();f.chain(NETWORK.chainId);await f.sync();
 const saved=new Map();Object.assign(f.context,{store:{set:(key,value)=>saved.set(key,value)},DISCONNECT_KEY:'disconnect',revokeWalletAccess:async()=>{},resetActivity(){},message(){}});
 vm.runInContext(source.slice(source.indexOf("$('disconnect').onclick="),source.indexOf("$('check-wallet').onclick=")),f.context);
 await f.$('disconnect').onclick();assert.equal(saved.get('disconnect'),'true');assert.equal(f.context.wallet,null);assert.equal(f.$('connect').textContent,'Connect wallet');assert.equal(f.$('disconnect').hidden,true);
 await f.sync();assert.equal(f.context.wallet,null);assert.equal(f.$('connect').textContent,'Connect wallet');
});

test('confirmed payment clears the amount before refreshing; reverted payment preserves it',async()=>{
 for(const status of [1,0]){
  const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{value:'0.0025',hidden:true,dataset:{}});return elements.get(id);};
  let refreshed=false;
  const context=vm.createContext({$,pending:{kind:'pay',value:'2500000000000000',contract:'0xcontract',projectId:'2'},store:{remove(){}},KEY:'pending',txLink:()=>'/tx/hash',display:()=> '0.0025',updatePayment(){ $('pay').disabled=true;},message(){},loadProject:async()=>{refreshed=true;assert.equal($('pay-amount').value,'');assert.equal($('payment-success').hidden,false);}});
  vm.runInContext(source.slice(source.indexOf('async function recover('),source.indexOf('async function checkPending(')),context);
  const result=vm.runInContext(`recover({status:${status},hash:'hash'})`,context);
  if(status===1){await result;assert.equal(refreshed,true);assert.match($('payment-success').textContent,/0.0025 USDC confirmed/);assert.equal($('pay').disabled,true);}
  else{await assert.rejects(result,/reverted/);assert.equal($('pay-amount').value,'0.0025');assert.equal($('payment-success').hidden,true);assert.equal(refreshed,false);}
 }
});

test('starting another project clears the previous payment confirmation and amount',()=>{
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'0.0025',hidden:false,textContent:'Payment complete',dataset:{project:'old:2'}});return nodes.get(id);};
 const context=vm.createContext({$,busy:false,selected:{id:'2'},historyVersion:0,contractAddress:'contract',history:{replaceState(){}},location:{pathname:'/workspace'},message(){}});
 vm.runInContext(source.slice(source.indexOf("$('new-project').onclick="),source.indexOf("if(window.ethereum?.on)")),context);
 $('new-project').onclick();assert.equal($('payment-success').hidden,true);assert.equal($('payment-success').textContent,'');assert.equal($('payment-success').dataset.project,undefined);assert.equal($('pay-amount').value,'');assert.equal(context.selected,null);
});
