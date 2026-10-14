import {BrowserProvider,JsonRpcProvider,Interface} from './vendor/ethers.mjs';
import {NETWORK,TeamPayClient,address,normalizePlan} from './chain.mjs';
import {units,display,allocate,basisPoints} from './money.mjs';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=s=>`${s.slice(0,6)}…${s.slice(-4)}`;
const store={get(key){try{return localStorage.getItem(key);}catch{return null;}},set(key,value){try{localStorage.setItem(key,value);}catch{}},remove(key){try{localStorage.removeItem(key);}catch{}}};
const KEY='teampay.arc-testnet.pending.v1',CONTRACT_KEY='teampay.arc-testnet.contract.v1';
let client,reader,artifact,wallet=null,busy=false,selected=null,draft=null,contractAddress='',memberCount=0;
let pending;try{pending=JSON.parse(store.get(KEY)||'null');}catch{pending=null;}
const message=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error);for(const el of document.querySelectorAll('.dialog-status')){el.textContent=error?text:'';}};
function explain(error){if(error.code===4001||error.code==='ACTION_REJECTED')return 'Request cancelled in your wallet. No new transaction was submitted.';return error.shortMessage||error.message||'The request failed. Please try again.';}
async function run(fn){if(busy)return;busy=true;document.body.setAttribute('aria-busy','true');try{if(!client)throw new Error('Payment tools are still loading.');await fn();}catch(error){message(explain(error),true);}finally{busy=false;document.body.removeAttribute('aria-busy');}}
function appendMember(){
 if($('members').children.length>=10)return;
 const row=document.createElement('div');row.className='member-row';row.dataset.member=String(memberCount++);
 row.innerHTML=`<label>Name<input data-field="name" required maxlength="30" placeholder="Teammate’s public name"></label><label>Wallet address<input data-field="address" required autocomplete="off" spellcheck="false" placeholder="0x…"></label><label>Share · %<input data-field="share" inputmode="decimal" required placeholder="50"></label><button type="button" class="secondary remove" aria-label="Remove teammate">×</button>`;
 row.querySelector('button').onclick=()=>{if($('members').children.length===1)return;row.remove();updateRecipients();};
 row.querySelector('[data-field="name"]').oninput=updateRecipients;
 $('members').append(row);updateRecipients();
}
function updateRecipients(){
 const members=[...$('members').children];
 for(const select of document.querySelectorAll('[data-expense-member]')){const value=select.value;select.innerHTML=members.map((r,i)=>`<option value="${r.dataset.member}">${esc(r.querySelector('[data-field="name"]').value||`Teammate ${i+1}`)}</option>`).join('');if(members.some(r=>r.dataset.member===value))select.value=value;else select.selectedIndex=-1;}
 $('add-member').disabled=members.length>=10;
}
function appendExpense(){
 if($('expenses').children.length>=10)return;
 const row=document.createElement('div');row.className='expense-row';
 row.innerHTML='<label>Expense<input data-expense-name required maxlength="40" placeholder="Hosting"></label><label>Repay to<select data-expense-member required></select></label><label>Amount · USDC<input data-expense-amount inputmode="decimal" required placeholder="0.01"></label><button type="button" class="secondary remove" aria-label="Remove expense">×</button>';
 row.querySelector('button').onclick=()=>{row.remove();$('add-expense').disabled=false;};
 $('expenses').append(row);updateRecipients();$('add-expense').disabled=$('expenses').children.length>=10;
}
function readForm(){
 const rows=[...$('members').children];
 return normalizePlan({title:new FormData($('project-form')).get('title'),members:rows.map(r=>({name:r.querySelector('[data-field="name"]').value,address:r.querySelector('[data-field="address"]').value,bps:basisPoints(r.querySelector('[data-field="share"]').value)})),expenses:[...$('expenses').children].map(r=>({name:r.querySelector('[data-expense-name]').value,member:rows.findIndex(m=>m.dataset.member===r.querySelector('select').value),amount:r.querySelector('[data-expense-amount]').value.trim()}))});
}
function agreementHTML(plan,remaining=plan.expenses.map(e=>units(e.amount))){
 return `<h3>Expenses, in repayment order</h3>${plan.expenses.length?plan.expenses.map((e,i)=>`<div class="allocation"><span>${i+1}. ${esc(e.name)}<small>To ${esc(plan.members[e.member].name)} · Original amount ${display(units(e.amount))} USDC</small></span><strong>${display(remaining[i])} USDC left</strong></div>`).join(''):'<p class="fine">No expenses. Payments go directly to team shares.</p>'}<h3>Shares of the remainder</h3>${plan.members.map(m=>`<div class="allocation"><span>${esc(m.name)}<small>${esc(m.address)}</small></span><strong>${m.bps/100}%</strong></div>`).join('')}<p class="fine">Any smallest-unit rounding remainder goes to the final teammate.</p>`;
}
async function connect(){
 if(!window.ethereum?.request)throw new Error('Open this page in a wallet-enabled browser, or install an EVM wallet browser extension. Mobile wallet pairing is not connected yet.');
 await window.ethereum.request({method:'eth_requestAccounts'});
 try{await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:NETWORK.chainId}]});}catch(error){if(error.code!==4902&&error?.data?.originalError?.code!==4902)throw error;await window.ethereum.request({method:'wallet_addEthereumChain',params:[NETWORK]});}
 if(BigInt(await window.ethereum.request({method:'eth_chainId'}))!==BigInt(NETWORK.chainId))throw new Error('Switch your wallet to Arc Testnet.');
 const provider=new BrowserProvider(window.ethereum);const signer=await provider.getSigner();const account=await signer.getAddress();
 wallet={provider,signer,account};$('wallet-label').textContent=short(account)+' · Arc Testnet';$('connect').textContent='Reconnect wallet';
 if(selected)await refreshWithdrawal();return wallet;
}
async function setContract(raw){const checked=await client.at(raw);contractAddress=await checked.getAddress();$('contract-address').value=contractAddress;store.set(CONTRACT_KEY,contractAddress);$('contract-state').textContent='Supported TeamPay contract: '+contractAddress;$('contract-setup').open=false;return contractAddress;}
function txLink(hash){return NETWORK.blockExplorerUrls[0]+'/tx/'+hash;}
function showPending(){
 $('check-pending').hidden=!pending;
 if(pending)$('transaction-status').innerHTML=`Submitted on Arc Testnet. <a href="${txLink(pending.hash)}" target="_blank" rel="noopener noreferrer">View transaction ↗</a>. Waiting for confirmation; do not submit it again.`;
}
async function recover(receipt){
 const operation=pending;pending=null;store.remove(KEY);$('check-pending').hidden=true;
 if(receipt.status!==1){$('transaction-status').textContent='Transaction reverted. It did not complete; the network fee may still have been charged.';throw new Error('Transaction reverted. Review the agreement and wallet balance before retrying.');}
 $('transaction-status').innerHTML=`Confirmed on Arc Testnet. <a href="${txLink(receipt.hash)}" target="_blank" rel="noopener noreferrer">View receipt ↗</a>`;
 if(operation.kind==='deploy'){await setContract(receipt.contractAddress);message('Testnet contract deployed. You can now publish an agreement.');return;}
 if(operation.kind==='create'){
  const iface=new Interface(artifact.abi);let projectId;
  for(const log of receipt.logs){try{const event=iface.parseLog(log);if(event?.name==='ProjectPublished')projectId=event.args.projectId.toString();}catch{}}
  if(!projectId)throw new Error('Transaction confirmed, but its project event was not found. Keep the transaction receipt.');
  await loadProject(operation.contract,projectId);$('review').close();
 }else if(operation.projectId)await loadProject(operation.contract,operation.projectId);
 message('Transaction confirmed. Balances are loaded from Arc Testnet.');
}
async function checkPending(){if(!pending)return;const receipt=await reader.getTransactionReceipt(pending.hash);if(receipt)await recover(receipt);else{showPending();message('The transaction is still pending or not yet visible to this RPC. Check the explorer before taking further action.');}}
async function sendReviewed(kind,tx){
 if(pending){showPending();throw new Error('Check the pending transaction before submitting another one.');}
 if(!wallet)await connect();
 const account=wallet.account;
 const gas=await reader.estimateGas({...tx,from:account});const gasLimit=gas*120n/100n;
 const fees=await reader.getFeeData();const gasPrice=fees.maxFeePerGas??fees.gasPrice;if(!gasPrice)throw new Error('Could not estimate the network fee.');
 const maxFee=gasLimit*gasPrice;const value=BigInt(tx.value??0);
 if(await reader.getBalance(account)<value+maxFee)throw new Error('Insufficient test USDC for the payment and estimated fee. Use the Circle faucet.');
 const transaction={...tx,gasLimit,chainId:BigInt(NETWORK.chainId),from:account};
 if(fees.maxFeePerGas){transaction.maxFeePerGas=gasPrice;transaction.maxPriorityFeePerGas=fees.maxPriorityFeePerGas??0n;}else transaction.gasPrice=gasPrice;
 $('confirm-title').textContent={deploy:'Deploy testnet contract',create:'Publish your agreement',pay:'Confirm test payment',claim:'Withdraw your test USDC'}[kind];
 $('confirm-body').innerHTML=`<div class="allocation"><span>Network</span><strong>Arc Testnet</strong></div><div class="allocation"><span>Wallet</span><strong>${esc(account)}</strong></div><div class="allocation"><span>${kind==='claim'?'Transfer to your wallet':'Payment amount'}</span><strong>${kind==='claim'?display(await selected.contract.claimable(account)):display(value)} test USDC</strong></div><div class="allocation"><span>Estimated maximum network fee</span><strong>${display(maxFee)} test USDC</strong></div><p class="fine">Includes a 20% gas-limit buffer. Actual fees may be lower.</p>`;
 if(kind==='pay'){$('confirm-body').innerHTML+=`<h3>Current payment allocation</h3>${$('payment-preview').innerHTML}<p class="fine">This preview uses the latest loaded balances. Another payment confirmed first can change expense repayment versus revenue sharing.</p>`;}
 const approved=await new Promise(resolve=>{const close=value=>{$('confirm').close();resolve(value);};$('confirm-send').onclick=()=>close(true);$('confirm-cancel').onclick=()=>close(false);$('confirm').oncancel=e=>{e.preventDefault();close(false);};$('confirm').showModal();});
 if(!approved){message('Transaction cancelled before opening the wallet.');return;}
 if(!wallet||wallet.account!==account)throw new Error('Your wallet changed. Reconnect and review again.');
 const accounts=await window.ethereum.request({method:'eth_accounts'});
 if(accounts[0]?.toLowerCase()!==account.toLowerCase()||BigInt(await window.ethereum.request({method:'eth_chainId'}))!==BigInt(NETWORK.chainId))throw new Error('Your wallet account or network changed. Reconnect and review again.');
 message('Approve the transaction in your wallet.');
 const response=await wallet.signer.sendTransaction(transaction);
 pending={hash:response.hash,kind,contract:contractAddress,projectId:selected?.id??null};store.set(KEY,JSON.stringify(pending));showPending();message('Transaction submitted. Waiting for confirmation…');
 try{const receipt=await reader.waitForTransaction(response.hash,1,120000);if(receipt)await recover(receipt);}catch(error){if(pending)throw new Error('Confirmation is taking longer than expected. Your transaction may still complete. Use “Check pending transaction” or the explorer.');throw error;}
}
async function refreshWithdrawal(){
 $('withdraw').disabled=true;
 if(!wallet){$('withdrawable').textContent='Connect a wallet to view your balance.';return;}
 const balance=await selected.contract.claimable(wallet.account);$('withdrawable').textContent=display(balance)+' test USDC';$('withdraw').disabled=balance===0n;
}
async function loadProject(raw,id){
 message('Loading the agreement and balances from Arc Testnet…');
 $('project').hidden=true;selected=null;
 const loaded=await client.load(raw,id);selected=loaded;contractAddress=await loaded.contract.getAddress();store.set(CONTRACT_KEY,contractAddress);
 const url=new URL(location.href);url.search='';url.searchParams.set('contract',contractAddress);url.searchParams.set('project',id);history.replaceState(null,'',url);
 $('share-link').value=url.href;$('title').textContent=loaded.plan.title;$('project-id').textContent='Project #'+id;
 $('verified').textContent='Contract code matches this TeamPay build. Agreement and balances were read from Arc Testnet. This is not a security audit.';
 $('total').textContent=display(loaded.state.received)+' USDC';$('remaining').textContent=display(loaded.state.remainingExpenses.reduce((a,b)=>a+b,0n))+' USDC';
 $('agreement').innerHTML=agreementHTML(loaded.plan,loaded.state.remainingExpenses);
 $('setup').hidden=true;$('project').hidden=false;updatePayment();await refreshWithdrawal();message('Project loaded. Share the link or preview a test payment.');
}
function updatePayment(){
 if(!selected)return;
 try{const result=allocate(selected.plan,[...selected.state.remainingExpenses],units($('pay-amount').value.trim()));
 $('payment-preview').innerHTML=result.credits.map((amount,i)=>`<div class="allocation"><span>${esc(selected.plan.members[i].name)}</span><strong>${display(amount)} USDC</strong></div>`).join('');$('pay').disabled=false;
 }catch(error){$('payment-preview').textContent=explain(error);$('pay').disabled=true;}
}
$('connect').onclick=()=>run(async()=>{await connect();message('Wallet connected to Arc Testnet.');});
$('deploy').onclick=()=>run(async()=>{await sendReviewed('deploy',await client.deployTransaction());});
$('use-contract').onclick=()=>run(async()=>{await setContract($('contract-address').value);message('Contract verified. Create an agreement below.');});
$('add-member').onclick=appendMember;$('add-expense').onclick=appendExpense;
$('project-form').onsubmit=e=>{e.preventDefault();run(async()=>{draft=readForm();$('review-body').innerHTML=agreementHTML(draft);$('ack').checked=false;$('review').showModal();});};
$('edit').onclick=()=>$('review').close();
$('publish').onclick=()=>run(async()=>{if(!$('ack').checked)throw new Error('Check the agreement and tick the acknowledgement before publishing.');if(!contractAddress)throw new Error('Choose or deploy a testnet contract before publishing. Close this review and open Testnet contract setup.');const plan=normalizePlan(draft);await sendReviewed('create',await client.createTransaction(contractAddress,plan));});
$('payment-form').onsubmit=e=>{e.preventDefault();run(async()=>{const current=await client.load(contractAddress,selected.id);selected=current;updatePayment();const amount=units($('pay-amount').value.trim());if(amount<=0n)throw new Error('Enter a positive payment.');await sendReviewed('pay',await selected.contract.pay.populateTransaction(selected.id,{value:amount}));});};
$('pay-amount').addEventListener('input',updatePayment);
$('withdraw').onclick=()=>run(async()=>{if(!wallet)await connect();const balance=await selected.contract.claimable(wallet.account);if(!balance)throw new Error('No balance is available to withdraw.');await sendReviewed('claim',await selected.contract.claim.populateTransaction(wallet.account));});
$('refresh').onclick=()=>run(async()=>{await loadProject(contractAddress,selected.id);});
$('check-pending').onclick=()=>run(checkPending);
$('copy-link').onclick=()=>run(async()=>{try{await navigator.clipboard.writeText($('share-link').value);message('Project link copied. It loads the agreement from Arc Testnet.');}catch{$('share-link').select();message('Select and copy the project link from the field.');}});
$('new-project').onclick=()=>{if(busy)return;selected=null;$('project').hidden=true;$('setup').hidden=false;$('contract-address').value=contractAddress;history.replaceState(null,'',location.pathname);message('Create another project using the same contract.');};
if(window.ethereum?.on){for(const event of ['accountsChanged','chainChanged'])window.ethereum.on(event,()=>{wallet=null;$('wallet-label').textContent='Wallet changed · reconnect';$('withdraw').disabled=true;$('withdrawable').textContent='Reconnect to refresh your balance.';});}
appendMember();appendMember();
try{
 const response=await fetch('./contract.json');if(!response.ok)throw new Error('Could not load the contract definition.');artifact=await response.json();
 reader=new JsonRpcProvider(NETWORK.rpcUrls[0]);if((await reader.getNetwork()).chainId!==BigInt(NETWORK.chainId))throw new Error('RPC network mismatch.');client=new TeamPayClient(reader,artifact);
 const params=new URLSearchParams(location.search);const raw=params.get('contract')||store.get(CONTRACT_KEY);
 if(params.has('project')){if(!raw)throw new Error('This project link is missing its contract address.');await loadProject(raw,params.get('project'));}
 else{if(raw)await setContract(raw);else $('contract-setup').open=true;message('Ready. Create an agreement, or connect a wallet to set up a testnet contract.');}
 if(pending){if(!/^0x[0-9a-fA-F]{64}$/.test(pending.hash))throw new Error('Saved transaction record is invalid.');showPending();await checkPending();}
}catch(error){message(explain(error),true);}
