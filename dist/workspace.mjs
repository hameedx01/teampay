import {initWorkspaceExtras} from './workspace-extras.mjs';
import {searchPaymentHistory} from './history-search.mjs';
import {loadWalletActivity,describeWalletActivity,filterWalletActivity} from './activity.mjs';
import {receiptHTML} from './receipt.mjs';
import {AccountConnection,NetworkConnection,revokeWalletAccess,walletSnapshot,walletErrorCode,PENDING_MESSAGE} from './wallet-session.mjs';
import {BrowserProvider,JsonRpcProvider,Interface} from './vendor/ethers.mjs';
import {NETWORK,TeamPayClient,address,normalizePlan} from './chain.mjs';
import {units,display,allocate,basisPoints} from './money.mjs';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=s=>`${s.slice(0,6)}…${s.slice(-4)}`;
const store={get(key){try{return localStorage.getItem(key);}catch{return null;}},set(key,value){try{localStorage.setItem(key,value);}catch{}},remove(key){try{localStorage.removeItem(key);}catch{}}};
const DISCONNECT_KEY='teampay.wallet.disconnected.v1';
let disconnected=store.get(DISCONNECT_KEY)==='true';
let activityVersion=0,activityRows=[],activityNext=null,activityEnd=null,activityAccount=null,activityBusy=false,sharedConfig=null;
let accountConnection=null;
let extras=null;
function connectionSession(){if(!window.ethereum?.request)throw new Error('Open this page in a wallet-enabled browser or install an EVM wallet extension.');if(!accountConnection||accountConnection.provider!==window.ethereum)accountConnection=new AccountConnection(window.ethereum);return accountConnection;}
let networkConnection=null,connecting=false,walletVersion=0,walletState={account:null,wrongNetwork:false};
function updateConnectButton(){
 const waiting=Boolean(accountConnection?.inFlight),switching=Boolean(networkConnection?.inFlight);
 $('connect').disabled=connecting||waiting||Boolean(accountConnection?.pending)||Boolean(wallet);
 $('connect').textContent=switching?'Switch in wallet…':waiting?'Open your wallet…':walletState.wrongNetwork?'Switch network':wallet?'Connected':'Connect wallet';
 $('wallet-help').hidden=disconnected||(!waiting&&!accountConnection?.pending);
 $('disconnect').hidden=!walletState.account;
 $('disconnect').disabled=connecting||busy;
 $('network-help').hidden=!walletState.wrongNetwork;
 $('switch-network').disabled=connecting||switching;
 $('switch-network').textContent=switching?'Approve in your wallet…':'Switch to Arc Mainnet';
 $('wallet-label').textContent=walletState.account?short(walletState.account)+(walletState.wrongNetwork?' · Wrong network':wallet?' · Arc Mainnet':' · Checking network…'):'Wallet not connected';
 if(walletState.wrongNetwork){$('pay').disabled=true;$('publish').disabled=true;$('deploy').disabled=true;$('withdraw').disabled=true;}
 else{$('deploy').disabled=false;$('publish').disabled=!contractAddress;if(selected)updatePayment();}
}
async function syncWallet(){
 if(disconnected||!window.ethereum?.request)return;
 const previousAccount=walletState.account;
 const version=++walletVersion;wallet=null;$('withdraw').disabled=true;$('withdrawable').textContent='Checking wallet…';
 const state=await walletSnapshot(window.ethereum,NETWORK.chainId);if(version!==walletVersion)return;
 walletState=state;if(previousAccount?.toLowerCase()!==state.account?.toLowerCase())resetActivity();if(state.wrongNetwork)$('network-message').textContent='Your wallet is on another network (chain '+Number(BigInt(state.chainId))+'). Switch to Arc Mainnet before publishing or making a payment.';updateConnectButton();
 if(state.account&&!state.wrongNetwork){const provider=new BrowserProvider(window.ethereum);const signer=await provider.getSigner(state.account);if(version!==walletVersion)return;wallet={provider,signer,account:state.account};}
 if(version!==walletVersion)return;updateConnectButton();if(selected)await refreshWithdrawal();if(!$('activity').hidden)void refreshActivity();if(!$('my-projects').hidden)void extras?.refreshLibrary();
}
const KEY='teampay.arc-mainnet.pending.v1',CONTRACT_KEY='teampay.arc-mainnet.contract.v1';
let client,reader,artifact,wallet=null,busy=false,selected=null,draft=null,contractAddress='',memberCount=0,historyRows=[],historyCursor=null,historyStart=null,historyEnd=null,historyVersion=0;
const setupMode=false; // The shared mainnet contract is already deployed.
$('contract-setup').hidden=!setupMode;
let pending;try{pending=JSON.parse(store.get(KEY)||'null');}catch{pending=null;}
const message=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error);for(const el of document.querySelectorAll('.dialog-status')){el.textContent=error?text:'';}};
function explain(error){if(Number(walletErrorCode(error))===-32002)return PENDING_MESSAGE;if(Number(walletErrorCode(error))===4001||error.code==='ACTION_REJECTED')return 'Request cancelled in your wallet. No new transaction was submitted.';return error.shortMessage||error.message||'The request failed. Please try again.';}
async function run(fn){if(busy)return;busy=true;document.body.setAttribute('aria-busy','true');updateConnectButton();try{if(!client)throw new Error('Payment tools are still loading.');await fn();}catch(error){message(explain(error),true);}finally{busy=false;document.body.removeAttribute('aria-busy');updateConnectButton();}}
function appendMember(focus=true){
 if($('members').children.length>=10)return;
 const row=document.createElement('div');row.className='member-row';row.dataset.member=String(memberCount++);
 row.innerHTML=`<label>Teammate’s name<input data-field="name" required maxlength="30" placeholder="Teammate’s public name"></label><label class="wallet-field">Wallet address<input data-field="address" required autocomplete="off" spellcheck="false" placeholder="0x…"></label><label class="share-field">Share · %<input data-field="share" inputmode="decimal" required placeholder="50"></label><button type="button" class="secondary remove" aria-label="Remove teammate">×</button>`;
 row.querySelector('button').onclick=()=>{if($('members').children.length===1)return;row.remove();updateRecipients();updateDraft();};
 const useWallet=document.createElement('button');useWallet.type='button';useWallet.className='text-action use-wallet';useWallet.textContent='Use my wallet';useWallet.onclick=()=>run(async()=>{if(!wallet)await connect();row.querySelector('[data-field="address"]').value=wallet.account;updateDraft();});row.querySelector('[data-field="address"]').parentElement.append(useWallet);
 row.querySelector('[data-field="name"]').oninput=updateRecipients;
 $('members').append(row);updateRecipients();updateDraft();if(focus)row.querySelector('input').focus();
}
function updateRecipients(){
 const members=[...$('members').children];
 for(const select of document.querySelectorAll('[data-expense-member]')){const value=select.value;select.innerHTML='<option value="">Choose teammate</option>'+members.map((r,i)=>`<option value="${r.dataset.member}">${esc(r.querySelector('[data-field="name"]').value||`Teammate ${i+1}`)}</option>`).join('');if(members.some(r=>r.dataset.member===value))select.value=value;else select.value='';}
 $('add-member').disabled=members.length>=10;for(const row of members)row.querySelector('.remove').disabled=members.length===1;
}
function appendExpense(focus=true){
 if($('expenses').children.length>=10)return;
 const row=document.createElement('div');row.className='expense-row';
 row.innerHTML='<label>Expense<input data-expense-name required maxlength="40" placeholder="Hosting"></label><label>Repay to<select data-expense-member required></select></label><label>Amount · USDC<input data-expense-amount inputmode="decimal" required placeholder="0.01"></label><button type="button" class="secondary remove" aria-label="Remove expense">×</button>';
 row.querySelector('button').onclick=()=>{row.remove();updateExpenseControls();updateDraft();};
 const order=document.createElement('div');order.className='expense-order';order.innerHTML='<span class="expense-position"></span><button type="button" class="text-action" data-move="up" aria-label="Repay this expense earlier">↑ Earlier</button><button type="button" class="text-action" data-move="down" aria-label="Repay this expense later">↓ Later</button>';row.prepend(order);
 order.addEventListener('click',event=>{const direction=event.target.dataset.move;if(direction==='up'&&row.previousElementSibling)row.parentElement.insertBefore(row,row.previousElementSibling);if(direction==='down'&&row.nextElementSibling)row.parentElement.insertBefore(row.nextElementSibling,row);updateExpenseControls();updateDraft();});
 $('expenses').append(row);updateRecipients();updateExpenseControls();updateDraft();if(focus)row.querySelector('input').focus();
}

function updateExpenseControls(){
 const rows=[...$('expenses').children];$('expense-empty').hidden=rows.length>0;$('add-expense').disabled=rows.length>=10;
 rows.forEach((r,i)=>{r.querySelector('.expense-position').textContent=`REPAY ${i+1===1?'FIRST':i+1===2?'SECOND':`#${i+1}`}`;r.querySelector('[data-move="up"]').disabled=i===0;r.querySelector('[data-move="down"]').disabled=i===rows.length-1;});
}
function updateDraft(){
 extras?.saveDraft();
 const rows=[...$('members').children];
 let total=0,valid=true;const shares=rows.map(row=>{try{const n=basisPoints(row.querySelector('[data-field="share"]').value.trim());total+=n;return n;}catch{valid=false;return 0;}});
 $('share-total').textContent=valid&&total===10000?'100% allocated · Ready':`Shares: ${total/100}% of 100%${total>10000?' · Reduce the total':''}`;
 $('share-total').classList.toggle('complete',valid&&total===10000);
 try{
  if(!valid||total!==10000)throw new Error('Set your team shares to a total of 100% to preview a payment.');
  const previewPlan={members:rows.map((r,i)=>({name:r.querySelector('[data-field="name"]').value.trim()||`Teammate ${i+1}`,bps:shares[i]})),expenses:[...$('expenses').children].map(r=>({member:rows.findIndex(m=>m.dataset.member===r.querySelector('select').value),amount:r.querySelector('[data-expense-amount]').value.trim()}))};
  const remaining=previewPlan.expenses.map(e=>units(e.amount));if(remaining.some(n=>n<=0n))throw new Error('Add a positive amount and a recipient for each expense.');
  const allocation=allocate(previewPlan,remaining,units($('draft-payment').value.trim()));
  $('draft-allocation').innerHTML=allocation.credits.map((amount,i)=>`<div class="allocation"><span><i class="summary-avatar">${esc(previewPlan.members[i].name[0])}</i>${esc(previewPlan.members[i].name)}<small>${display(amount-allocation.revenue[i])} expenses + ${display(allocation.revenue[i])} share</small></span><strong>${display(amount)}<small>USDC</small></strong></div>`).join('');
  $('draft-calculation-note').textContent=`${display(allocation.expenses.reduce((a,b)=>a+b,0n))} USDC repays expenses. ${display(allocation.revenue.reduce((a,b)=>a+b,0n))} USDC is shared.`;
 }catch(error){$('draft-allocation').innerHTML='<p class="draft-hint"></p>';$('draft-allocation').firstElementChild.textContent=error.message;$('draft-calculation-note').textContent='';}
}
$('project-form').addEventListener('input',()=>{$('draft-form-error').textContent='';updateDraft();});
$('project-form').addEventListener('change',updateDraft);
$('draft-payment').addEventListener('input',updateDraft);
$('equal-shares').onclick=()=>{const rows=[...$('members').children],base=Math.floor(10000/rows.length);rows.forEach((r,i)=>{r.querySelector('[data-field="share"]').value=((i===rows.length-1?10000-base*i:base)/100).toFixed(2);});updateDraft();};

function readForm(){
 const rows=[...$('members').children];
 return normalizePlan({title:new FormData($('project-form')).get('title'),members:rows.map(r=>({name:r.querySelector('[data-field="name"]').value,address:r.querySelector('[data-field="address"]').value,bps:basisPoints(r.querySelector('[data-field="share"]').value)})),expenses:[...$('expenses').children].map(r=>({name:r.querySelector('[data-expense-name]').value,member:rows.findIndex(m=>m.dataset.member===r.querySelector('select').value),amount:r.querySelector('[data-expense-amount]').value.trim()}))});
}
function agreementHTML(plan,remaining=plan.expenses.map(e=>units(e.amount))){
 return `<h3>Expenses, in repayment order</h3>${plan.expenses.length?plan.expenses.map((e,i)=>`<div class="allocation"><span>${i+1}. ${esc(e.name)}<small>To ${esc(plan.members[e.member].name)} · Original amount ${display(units(e.amount))} USDC</small></span><strong>${display(remaining[i])} USDC left</strong></div>`).join(''):'<p class="fine">No expenses. Payments go directly to team shares.</p>'}<h3>Shares of the remainder</h3>${plan.members.map(m=>`<div class="allocation"><span>${esc(m.name)}<small>${esc(m.address)}</small></span><strong class="share-percentage">${m.bps/100}%</strong></div>`).join('')}<p class="fine">Any smallest-unit rounding remainder goes to the final teammate.</p>`;
}
async function connect(){
 disconnected=false;store.remove(DISCONNECT_KEY);connecting=true;
 try{
  const request=connectionSession().connect();updateConnectButton();message('Approve the connection in your wallet. Connecting does not move funds.');await request;
  await syncWallet();
  if(walletState.wrongNetwork){
   $('network-message').textContent='Your wallet is on another network (chain '+Number(BigInt(walletState.chainId))+'). Approve the switch to Arc Mainnet in your wallet.';
   message('Wrong network. Switch to Arc Mainnet to continue.');
   networkConnection??=new NetworkConnection(window.ethereum,NETWORK);
   const switching=networkConnection.switch();updateConnectButton();
   try{await switching;}catch(error){
    const code=Number(walletErrorCode(error));
    const text=code===4001?'Network switch cancelled. Your wallet is connected, but payments stay disabled until you switch to Arc Mainnet.':code===-32002?'A network request is already open. Open your wallet and approve or cancel it, then try switching again.':explain(error);
    $('network-message').textContent=text;throw new Error(text);
   }
   await syncWallet();
  }
  if(!wallet)throw new Error('Wallet connection changed. Please connect again.');if(!$('activity').hidden)void refreshActivity();if(!$('my-projects').hidden)void extras?.refreshLibrary();return wallet;
 }finally{connecting=false;updateConnectButton();}
}
async function setContract(raw){const checked=await client.at(raw);contractAddress=await checked.getAddress();$('contract-address').value=contractAddress;store.set(CONTRACT_KEY,contractAddress);$('contract-state').textContent='Supported TeamPay contract: '+contractAddress;$('contract-setup').open=false;$('availability').textContent='Mainnet payments are configured. Review your agreement before publishing.';$('publish').disabled=walletState.wrongNetwork;return contractAddress;}
function txLink(hash){return NETWORK.blockExplorerUrls[0]+'/tx/'+hash;}
function showPending(){
 $('check-pending').hidden=!pending;
 if(pending)$('transaction-status').innerHTML=`Submitted on Arc Mainnet. <a href="${txLink(pending.hash)}" target="_blank" rel="noopener noreferrer">View transaction ↗</a>. Waiting for confirmation; do not submit it again.`;
}
async function recover(receipt){
 const operation=pending;pending=null;store.remove(KEY);$('check-pending').hidden=true;
 if(receipt.status!==1){$('transaction-status').textContent='Transaction reverted. It did not complete; the network fee may still have been charged.';throw new Error('Transaction reverted. Review the agreement and wallet balance before retrying.');}
 $('transaction-status').innerHTML=`Confirmed on Arc Mainnet. <a href="${txLink(receipt.hash)}" target="_blank" rel="noopener noreferrer">View receipt ↗</a>`;
 if(operation.kind==='deploy'){await setContract(receipt.contractAddress);message('Mainnet contract deployed. Share this contract address and deployment transaction with the builder to configure it for everyone.');$('contract-setup').hidden=false;$('contract-setup').open=true;return;}
 if(operation.kind==='pay'){
  $('pay-amount').value='';updatePayment();
  const paid=operation.value?display(BigInt(operation.value))+' USDC':'Your payment';
  $('payment-success').textContent=paid+' confirmed on Arc Mainnet. This payment is complete. Enter a new amount only if you want to make another payment.';
  $('payment-success').dataset.project=operation.contract.toLowerCase()+':'+operation.projectId;
  $('payment-success').hidden=false;
 }
 if(operation.kind==='create'){
  const iface=new Interface(artifact.abi);let projectId;
  for(const log of receipt.logs){try{const event=iface.parseLog(log);if(event?.name==='ProjectPublished')projectId=event.args.projectId.toString();}catch{}}
  if(!projectId)throw new Error('Transaction confirmed, but its project event was not found. Keep the transaction receipt.');
  extras?.clearPublishedDraft(operation.draftSnapshot);await loadProject(operation.contract,projectId);$('review').close();
 }else if(operation.projectId)await loadProject(operation.contract,operation.projectId);
 message(operation.kind==='pay'?$('payment-success').textContent:'Transaction confirmed. Balances are loaded from Arc Mainnet.');
}
async function checkPending(){if(!pending)return;const receipt=await reader.getTransactionReceipt(pending.hash);if(receipt)await recover(receipt);else{showPending();message('The transaction is still pending or not yet visible to this RPC. Check the explorer before taking further action.');}}
async function sendReviewed(kind,tx){
 const draftSnapshot=kind==='create'?extras?.draftSnapshot():null;
 if(pending){showPending();throw new Error('Check the pending transaction before submitting another one.');}
 if(!wallet)await connect();
 const reviewedWallet=wallet,reviewVersion=walletVersion,account=reviewedWallet.account;
 const assertReviewCurrent=()=>{if(wallet!==reviewedWallet||walletVersion!==reviewVersion)throw new Error('Your wallet account or network changed. Start a new review before continuing.');};
 const gas=await reader.estimateGas({...tx,from:account});const gasLimit=gas*120n/100n;
 const fees=await reader.getFeeData();const gasPrice=fees.maxFeePerGas??fees.gasPrice;if(!gasPrice)throw new Error('Could not estimate the network fee.');
 const maxFee=gasLimit*gasPrice;const value=BigInt(tx.value??0);
 if(maxFee>100000000000000000n)throw new Error('The estimated network fee exceeds the 0.10 USDC transaction limit. Try again when fees are lower.');
 if(await reader.getBalance(account)<value+maxFee)throw new Error('Insufficient USDC for the payment and estimated fee. Fund your wallet with USDC on Arc Mainnet.');
 const transaction={...tx,gasLimit,chainId:BigInt(NETWORK.chainId),from:account};
 if(fees.maxFeePerGas){transaction.maxFeePerGas=gasPrice;transaction.maxPriorityFeePerGas=fees.maxPriorityFeePerGas??0n;}else transaction.gasPrice=gasPrice;
 $('confirm-title').textContent={deploy:'Deploy mainnet contract',create:'Publish your agreement',pay:'Confirm payment',claim:'Withdraw your USDC'}[kind];
 $('confirm-body').innerHTML=`<div class="allocation"><span>Network</span><strong>Arc Mainnet</strong></div><div class="allocation"><span>Wallet</span><strong>${esc(account)}</strong></div><div class="allocation"><span>${kind==='claim'?'Transfer to your wallet':'Payment amount'}</span><strong>${kind==='claim'?display(await selected.contract.claimable(account)):display(value)} USDC</strong></div><div class="allocation"><span>Estimated maximum network fee</span><strong>${display(maxFee)} USDC</strong></div><p class="fine">Includes a 20% gas-limit buffer. Actual fees may be lower.</p>`;
 if(kind==='pay'){$('confirm-body').innerHTML+=`<h3>Current payment allocation</h3>${$('payment-preview').innerHTML}<p class="fine">This preview uses the latest loaded balances. Another payment confirmed first can change expense repayment versus revenue sharing.</p>`;}
 assertReviewCurrent();
 const approved=await new Promise(resolve=>{const close=value=>{$('confirm').close();resolve(value);};$('confirm-send').onclick=()=>close(true);$('confirm-cancel').onclick=()=>close(false);$('confirm').oncancel=e=>{e.preventDefault();close(false);};$('confirm-send').disabled=false;$('confirm').showModal();});
 if(!approved){message('Transaction cancelled before opening the wallet.');return;}
 assertReviewCurrent();
 const accounts=await window.ethereum.request({method:'eth_accounts'});
 if(accounts[0]?.toLowerCase()!==account.toLowerCase()||BigInt(await window.ethereum.request({method:'eth_chainId'}))!==BigInt(NETWORK.chainId))throw new Error('Your wallet account or network changed. Reconnect and review again.');
 assertReviewCurrent();
 message('Approve the transaction in your wallet.');
 const response=await reviewedWallet.signer.sendTransaction(transaction);
 pending={hash:response.hash,kind,value:value.toString(),draftSnapshot,contract:contractAddress,projectId:selected?.id??null};store.set(KEY,JSON.stringify(pending));showPending();message('Transaction submitted. Waiting for confirmation…');
 try{const receipt=await reader.waitForTransaction(response.hash,1,120000);if(receipt)await recover(receipt);}catch(error){if(pending)throw new Error('Confirmation is taking longer than expected. Your transaction may still complete. Use “Check pending transaction” or the explorer.');throw error;}
}
async function refreshWithdrawal(){
 $('withdraw').disabled=true;
 if(!wallet){$('withdrawable').textContent='Connect a wallet to view your balance.';return;}
 const currentWallet=wallet,currentProject=selected;const balance=await currentProject.contract.claimable(currentWallet.account);if(wallet!==currentWallet||selected!==currentProject)return;$('withdrawable').textContent=display(balance)+' USDC';$('withdraw').disabled=balance===0n;
}
async function loadProject(raw,id){
 if($('payment-success').dataset.project!==raw.toLowerCase()+':'+id){$('payment-success').hidden=true;$('payment-success').textContent='';}
 message('Loading the agreement and balances from Arc Mainnet…');
 $('project').hidden=true;selected=null;historyVersion++;historyRows=[];historyCursor=null;$('payment-history').innerHTML='';$('history-scope').textContent='';$('history-earlier').hidden=true;
 const loaded=await client.load(raw,id);selected=loaded;contractAddress=await loaded.contract.getAddress();store.set(CONTRACT_KEY,contractAddress);
 const url=new URL(location.href);url.search='';url.searchParams.set('network','5042');url.searchParams.set('contract',contractAddress);url.searchParams.set('project',id);history.replaceState(null,'',url);
 $('share-link').value=url.href;$('title').textContent=loaded.plan.title;$('project-id').textContent='Project #'+id;
 $('verified').textContent='Contract code matches this TeamPay build. Agreement and balances were read from Arc Mainnet. This is not a security audit.';
 $('total').textContent=display(loaded.state.received)+' USDC';$('remaining').textContent=display(loaded.state.remainingExpenses.reduce((a,b)=>a+b,0n))+' USDC';
 $('agreement').innerHTML=agreementHTML(loaded.plan,loaded.state.remainingExpenses);
 $('setup').hidden=true;$('project').hidden=false;updatePayment();await refreshWithdrawal();message('Project loaded. Share the link or preview a payment.');await loadHistory(true);
}
function updatePayment(){
 if(!selected)return;
 if(!$('pay-amount').value.trim()){$('payment-preview').textContent='Enter an amount to preview how a new payment will be allocated.';$('pay').disabled=true;return;}
 try{const result=allocate(selected.plan,[...selected.state.remainingExpenses],units($('pay-amount').value.trim()));
 $('payment-preview').innerHTML=result.credits.map((amount,i)=>`<div class="allocation"><span>${esc(selected.plan.members[i].name)}</span><strong>${display(amount)} USDC</strong></div>`).join('');$('pay').disabled=walletState.wrongNetwork;
 }catch(error){$('payment-preview').textContent=explain(error);$('pay').disabled=true;}
}

function renderHistory(){
 $('payment-history').innerHTML=historyRows.length?historyRows.map(p=>`<article class="payment-entry"><div><strong>${display(p.amount)} USDC</strong><small>Block ${p.blockNumber.toLocaleString()} · Payer ${p.payer?esc(short(p.payer)):'multiple'}</small><a href="${txLink(p.hash)}" target="_blank" rel="noopener noreferrer">${esc(short(p.hash))} ↗</a></div><div class="receipt-actions"><button class="secondary" data-receipt="${p.hash}">View receipt</button><button class="text-action" data-receipt="${p.hash}" data-format="json" aria-label="Download receipt as JSON">JSON ↓</button></div></article>`).join(''):'<p class="fine">No payments found in these blocks. Load earlier blocks to look further back.</p>';
 $('history-scope').textContent=`Showing ${historyRows.length} payment transaction${historyRows.length===1?'':'s'} from blocks ${historyStart.toLocaleString()}–${historyEnd.toLocaleString()}. ${historyCursor===null?'Reached the start of the available contract history.':'Earlier payments may exist.'}`;
 $('history-earlier').hidden=historyCursor===null;
}
async function loadHistory(reset=false){
 if(!selected)return;
 const version=historyVersion,current=selected;
 $('history-refresh').disabled=true;$('history-earlier').disabled=true;$('history-scope').textContent='Loading confirmed payment events…';
 try{
  const target=await current.contract.getAddress();
  const minBlock=sharedConfig?.contract?.toLowerCase()===target.toLowerCase()?sharedConfig.deploymentBlock:0;
  const page=await searchPaymentHistory(client,target,current.id,{minBlock,...(reset?{}:{toBlock:historyCursor}),hasPayments:current.state.received>0n,isCurrent:()=>version===historyVersion&&selected===current,onProgress:range=>{$('history-scope').textContent='Searching payments in blocks '+range.fromBlock.toLocaleString()+'–'+range.toBlock.toLocaleString()+'…';}});
  if(!page)return;
  if(version!==historyVersion||selected!==current)return;
  if(reset){historyRows=[];historyEnd=page.toBlock;}
  historyStart=page.fromBlock;historyCursor=page.earlierBlock;
  historyRows=[...new Map([...historyRows,...page.payments].map(p=>[p.hash,p])).values()];renderHistory();
 }catch(error){if(version===historyVersion)$('history-scope').textContent='Payment history could not be loaded. '+explain(error)+' Use Refresh history to retry.';}
 finally{if(version===historyVersion){$('history-refresh').disabled=false;$('history-earlier').disabled=false;}}
}
$('history-refresh').onclick=()=>run(()=>loadHistory(true));
$('history-earlier').onclick=()=>run(()=>loadHistory(false));
async function openReceipt(hash,format='view'){
 if(!selected)throw new Error('Open a project before viewing its receipt.');
 const current=selected,receipt=await client.paymentReceipt(contractAddress,current.id,hash);
 if(selected!==current)return;
 if(format!=='json'){$('receipt-body').innerHTML=receiptHTML(receipt,current.plan.title);$('receipt-dialog').showModal();return;}
 const blob=new Blob([JSON.stringify({...receipt,projectTitle:current.plan.title},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=`teampay-project-${current.id}-${receipt.transactionHash.slice(2,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Confirmed payment receipt downloaded. It records allocations, not withdrawals.');
}
$('payment-history').onclick=event=>{const button=event.target.closest('[data-receipt]');if(button)run(()=>openReceipt(button.dataset.receipt,button.dataset.format));};
$('receipt-close').onclick=()=>$('receipt-dialog').close();
$('receipt-print').onclick=()=>window.print();
function resetActivity(){
 extras?.resetLibrary();
 activityVersion++;activityRows=[];activityNext=null;activityEnd=null;activityAccount=null;activityBusy=false;
 $('activity-list').innerHTML='';$('activity-filter').value='all';$('activity-status').textContent='Connect your wallet to load your activity.';$('activity-more').hidden=true;$('activity-refresh').disabled=false;
}
function renderActivity(){
 const labels={agreement:'Agreement published',payment:'Payment sent',allocation:'Funds allocated to you',withdrawal:'Withdrawal to your wallet'};
 const visible=filterWalletActivity(activityRows,$('activity-filter').value);
 $('activity-list').innerHTML=visible.map(item=>{const link=new URL(location.origin+location.pathname);link.searchParams.set('network','5042');link.searchParams.set('contract',sharedConfig.contract);if(item.projectId)link.searchParams.set('project',item.projectId);if(item.type==='payment'||item.type==='allocation')link.searchParams.set('receipt',item.transactionHash);
 return `<article class="payment-entry"><div><strong>${labels[item.type]}${item.type==='agreement'?'':' · '+display(item.amount)+' USDC'}</strong><small>${item.confirmedAt?esc(new Date(item.confirmedAt).toLocaleString())+' · ':''}Block ${item.blockNumber.toLocaleString()}</small><small>${item.projectId?esc(item.projectTitle||'Project #'+item.projectId)+' · #'+esc(item.projectId):'Combined wallet balance across projects'}</small><a href="${txLink(item.transactionHash)}" target="_blank" rel="noopener noreferrer">View transaction ↗</a></div>${item.projectId?`<a class="activity-project" href="${esc(link.href)}">${item.type==='agreement'?'Open agreement':'View receipt'} ↗</a>`:''}</article>`;}).join('')||'<p class="fine">No matching activity in the blocks loaded so far. Load more activity to check later blocks.</p>';
}
async function refreshActivity(more=false){
 if(activityBusy)return;
 const account=walletState.account;
 if(disconnected||!account){resetActivity();return;}
 if(!sharedConfig?.contract||!reader||!artifact){$('activity-status').textContent='Activity tools are still loading. Try Refresh activity.';return;}
 if(activityAccount?.toLowerCase()!==account.toLowerCase()){resetActivity();activityAccount=account;}
 const version=activityVersion;activityBusy=true;$('activity-refresh').disabled=true;$('activity-more').disabled=true;
 $('activity-status').textContent='Reading confirmed activity from Arc Mainnet…';
 try{
  const fromBlock=more&&activityNext!==null?activityNext:activityEnd!==null?activityEnd+1:sharedConfig.deploymentBlock;
  const page=await loadWalletActivity(reader,artifact,sharedConfig.contract,account,{fromBlock});
  const described=await describeWalletActivity(reader,client,sharedConfig.contract,page.entries);
  if(version!==activityVersion||disconnected||walletState.account?.toLowerCase()!==account.toLowerCase())return;
  activityEnd=Math.max(activityEnd??0,page.toBlock);activityNext=page.nextBlock;
  activityRows=[...new Map([...activityRows,...described].map(item=>[item.key,item])).values()].sort((a,b)=>b.blockNumber-a.blockNumber||b.logIndex-a.logIndex);renderActivity();
  $('activity-status').textContent=`${activityRows.length} activity record${activityRows.length===1?'':'s'} for ${short(account)}. Checked blocks ${sharedConfig.deploymentBlock.toLocaleString()}–${activityEnd.toLocaleString()}. ${activityNext!==null?'More blocks remain. Use Load more activity to continue.':activityRows.length?'Up to date at this block.':'No activity found for this wallet.'}`;
  $('activity-more').hidden=activityNext===null;
 }catch(error){if(version===activityVersion)$('activity-status').textContent='Could not load activity. '+explain(error)+' Try Refresh activity.';}
 finally{if(version===activityVersion){activityBusy=false;$('activity-refresh').disabled=false;$('activity-more').disabled=false;}}
}
$('show-activity').onclick=()=>{$('activity').hidden=false;void refreshActivity();};
$('activity-filter').onchange=renderActivity;
$('activity-refresh').onclick=()=>void refreshActivity();$('activity-more').onclick=()=>void refreshActivity(true);
$('disconnect').onclick=async()=>{
 if(busy||connecting)return;
 const provider=window.ethereum;connecting=true;
 disconnected=true;store.set(DISCONNECT_KEY,'true');walletVersion++;wallet=null;walletState={account:null,wrongNetwork:false};accountConnection=null;networkConnection=null;resetActivity();
 $('withdraw').disabled=true;$('withdrawable').textContent='Connect a wallet to view your balance.';$('confirm-send').disabled=true;updateConnectButton();
 message('Disconnecting this site from your wallet…');
 try{await revokeWalletAccess(provider);message('Disconnected from TeamPay and wallet account access removed. Connect again to choose an account.');}
 catch{message('Disconnected from TeamPay. Your wallet could not remove this site’s permission automatically. In MetaMask, open this site’s connection or permissions and disconnect it there.');}
 finally{connecting=false;updateConnectButton();}
};
$('check-wallet').onclick=()=>run(async()=>{const accounts=await connectionSession().check();if(!accounts.length){message('The wallet has not granted access yet. Approve its open request, or cancel it and choose “I cancelled the request”.');return;}await connect();message('Wallet connected to Arc Mainnet.');});
$('reset-wallet-request').onclick=()=>{if(accountConnection?.inFlight){message('Close or cancel the request in your wallet first.');return;}accountConnection?.resetAfterCancellation();updateConnectButton();message('You can now try Connect wallet again.');};
$('switch-network').onclick=()=>run(async()=>{await connect();message('Wallet connected to Arc Mainnet.');});
$('connect').onclick=()=>run(async()=>{await connect();message('Wallet connected to Arc Mainnet.');});
$('deploy').onclick=()=>message('The shared mainnet contract is already deployed. No new deployment is needed.');
$('use-contract').onclick=()=>run(async()=>{await setContract($('contract-address').value);message('Contract verified. Create an agreement below.');});
$('add-member').onclick=appendMember;$('add-expense').onclick=appendExpense;
$('project-form').onsubmit=e=>{e.preventDefault();run(async()=>{try{draft=readForm();$('draft-form-error').textContent='';}catch(error){$('draft-form-error').textContent=explain(error);$('draft-form-error').scrollIntoView({block:'center',behavior:'smooth'});throw error;}$('review-body').innerHTML=agreementHTML(draft);$('ack').checked=false;$('review').showModal();});};
function returnToDraft(){$('review').close();$('review-draft').focus();}
$('edit').onclick=returnToDraft;$('review-close-top').onclick=returnToDraft;
$('publish').onclick=()=>run(async()=>{if(!$('ack').checked)throw new Error('Check the agreement and tick the acknowledgement before publishing.');if(!contractAddress)throw new Error('Publishing is not available until the shared mainnet contract is configured. You can still review your draft.');const plan=normalizePlan(draft);await sendReviewed('create',await client.createTransaction(contractAddress,plan));});
$('payment-form').onsubmit=e=>{e.preventDefault();run(async()=>{const current=await client.load(contractAddress,selected.id);selected=current;updatePayment();const amount=units($('pay-amount').value.trim());if(amount<=0n)throw new Error('Enter a positive payment.');await sendReviewed('pay',await selected.contract.pay.populateTransaction(selected.id,{value:amount}));});};
$('pay-amount').addEventListener('input',updatePayment);
$('withdraw').onclick=()=>run(async()=>{if(!wallet)await connect();const balance=await selected.contract.claimable(wallet.account);if(!balance)throw new Error('No balance is available to withdraw.');await sendReviewed('claim',await selected.contract.claim.populateTransaction(wallet.account));});
$('refresh').onclick=()=>run(async()=>{await loadProject(contractAddress,selected.id);});
$('check-pending').onclick=()=>run(checkPending);
$('copy-link').onclick=()=>run(async()=>{try{await navigator.clipboard.writeText($('share-link').value);message('Project link copied. It loads the agreement from Arc Mainnet.');}catch{$('share-link').select();message('Select and copy the project link from the field.');}});
$('new-project').onclick=()=>{if(busy)return;$('payment-success').hidden=true;$('payment-success').textContent='';delete $('payment-success').dataset.project;$('pay-amount').value='';selected=null;historyVersion++;$('project').hidden=true;$('setup').hidden=false;$('contract-address').value=contractAddress;history.replaceState(null,'',location.pathname);extras?.newProject();message('Create another project using the same contract.');};
if(window.ethereum?.on){
 for(const event of ['accountsChanged','chainChanged'])window.ethereum.on(event,()=>{
  if(disconnected)return;
  wallet=null;walletVersion++;$('withdraw').disabled=true;$('confirm-send').disabled=true;if($('confirm').open)message('Your wallet account or network changed. Cancel this review and start again.',true);
  if(connecting)return;
  syncWallet().then(()=>{if($('confirm').open)return;message(walletState.wrongNetwork?'Wrong network. Use Switch to Arc Mainnet to continue.':wallet?'Wallet updated on Arc Mainnet.':'Wallet disconnected. Connect to continue.');}).catch(error=>message(explain(error),true));
 });
 window.ethereum.on('disconnect',()=>{walletVersion++;wallet=null;$('confirm-send').disabled=true;$('withdrawable').textContent='Connect a wallet to view your balance.';walletState={account:null,wrongNetwork:false};resetActivity();updateConnectButton();$('withdraw').disabled=true;message($('confirm').open?'Wallet disconnected. Cancel this review and reconnect.':'Wallet disconnected. Reconnect to continue.',true);});
}
appendMember(false);appendMember(false);$('equal-shares').click();
if(new URLSearchParams(location.search).get('acceptance')==='two-wallet'){
 try{
  const response=await fetch('./two-wallet-plan.json');if(!response.ok)throw new Error('Could not load the test draft.');
  const prepared=await response.json(),plan=normalizePlan(prepared.plan);
  $('members').replaceChildren();$('expenses').replaceChildren();
  $('project-form').elements.title.value=plan.title;
  for(const member of plan.members){appendMember(false);const row=$('members').lastElementChild;row.querySelector('[data-field="name"]').value=member.name;row.querySelector('[data-field="address"]').value=member.address;row.querySelector('[data-field="share"]').value=(member.bps/100).toFixed(2);}
  updateRecipients();
  for(const expense of plan.expenses){appendExpense(false);const row=$('expenses').lastElementChild;row.querySelector('[data-expense-name]').value=expense.name;row.querySelector('[data-expense-amount]').value=expense.amount;row.querySelector('select').value=$('members').children[expense.member].dataset.member;}
  $('draft-payment').value='0.003';updateExpenseControls();updateDraft();$('acceptance-note').hidden=false;
 }catch(error){message('Test draft could not be loaded: '+explain(error),true);}
}

extras=initWorkspaceExtras({$,esc,getContext:()=>({account:walletState.account,disconnected,busy,reader,client,artifact,config:sharedConfig}),appendMember,appendExpense,updateRecipients,updateExpenseControls,updateDraft});
try{
 const response=await fetch('./contract.json');if(!response.ok)throw new Error('Could not load the contract definition.');artifact=await response.json();
 reader=new JsonRpcProvider(NETWORK.rpcUrls[0]);if((await reader.getNetwork()).chainId!==BigInt(NETWORK.chainId))throw new Error('RPC network mismatch.');client=new TeamPayClient(reader,artifact);
 const configResponse=await fetch('./deployment.json',{cache:'no-store'});if(!configResponse.ok)throw new Error('Could not load the shared deployment configuration.');const config=await configResponse.json();sharedConfig=config;if(BigInt(config.chainId)!==BigInt(NETWORK.chainId))throw new Error('Shared deployment network mismatch.');
 const params=new URLSearchParams(location.search);if(params.has('network')&&params.get('network')!=='5042')throw new Error('This link is for another network. Open a mainnet project link.');const raw=params.get('contract')||config.contract||store.get(CONTRACT_KEY);
 if(params.has('project')){if(!raw)throw new Error('This project link is missing its contract address.');await loadProject(raw,params.get('project'));if(params.has('receipt'))await openReceipt(params.get('receipt'));}
 else{if(raw){await setContract(raw);message('Ready to create a mainnet agreement.');}else{$('contract-setup').open=setupMode;$('availability').textContent='Shared mainnet setup is pending. You can draft and review an agreement now; publishing becomes available after deployment.';$('publish').disabled=true;message(setupMode?'Builder setup: connect a wallet with USDC, then deploy the shared contract.':'Create and review a draft. Mainnet publishing is awaiting setup.');}}
 await syncWallet();
 if(pending){if(!/^0x[0-9a-fA-F]{64}$/.test(pending.hash))throw new Error('Saved transaction record is invalid.');showPending();await checkPending();}
}catch(error){message(explain(error),true);}
