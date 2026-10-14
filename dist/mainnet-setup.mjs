import {JsonRpcProvider,BrowserProvider,formatEther} from './vendor/ethers.mjs';
import {AccountConnection,NetworkConnection,walletErrorCode} from './wallet-session.mjs';
import {MAINNET,prepareDeployment,verifyDeploymentReview} from './mainnet-deployment.mjs';
const $=id=>document.getElementById(id),KEY='teampay.mainnet.deployment.v1';
const reader=new JsonRpcProvider(MAINNET.rpcUrls[0],undefined,{cacheTimeout:-1});
let artifact,plan,busy=false,version=0,attempt=null;
try{attempt=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}
const message=s=>$('status').textContent=s;
function persist(value){localStorage.setItem(KEY,JSON.stringify(value));attempt=value;}
function invalidate(){version++;plan=null;$('review').hidden=true;$('deploy').disabled=true;}
function controls(){$('estimate').disabled=busy||Boolean(attempt);$('deploy').disabled=busy||!plan||!$('ack').checked||Boolean(attempt);$('check').hidden=!attempt;$('check').disabled=busy;}
async function run(fn){if(busy)return;busy=true;controls();try{if(!artifact)throw new Error('Contract definition is still loading.');await fn();}catch(e){message(Number(walletErrorCode(e))===4001?'Request cancelled in your wallet.':e.shortMessage||e.message||'Wallet request failed.');}finally{busy=false;controls();}}
function showAttempt(){
 $('result').hidden=false;$('contract').value=attempt.predictedAddress;$('hash').value=attempt.hash||'Awaiting transaction hash';
 $('explorer').href=MAINNET.blockExplorerUrls[0]+(attempt.hash?'/tx/'+attempt.hash:'/address/'+attempt.predictedAddress);
 $('result-message').textContent='Keep this page or record the transaction hash. Do not deploy again while this attempt is unresolved.';
}
async function check(){
 if(!attempt)return;showAttempt();
 if((await reader.getNetwork()).chainId!==5042n)throw new Error('RPC network mismatch.');
 if(attempt.hash){
  const receipt=await reader.getTransactionReceipt(attempt.hash);
  if(!receipt){message('Still awaiting confirmation. Check the explorer before taking another action.');return;}
  if(receipt.status!==1){message('Deployment reverted. Gas was spent. Review the transaction before trying again.');return;}
  if(receipt.contractAddress?.toLowerCase()!==attempt.predictedAddress.toLowerCase())throw new Error('Deployment address mismatch. Keep the receipt for investigation.');
 }
 const code=await reader.getCode(attempt.predictedAddress);
 if(code.toLowerCase()===artifact.runtime.toLowerCase()){
  $('result-title').textContent='Contract deployed and code verified';$('result-message').textContent='Send the contract address and transaction hash back to finish mainnet configuration. Deployment alone does not activate the public workspace.';message('Deployed on Arc Mainnet. Runtime code matches this TeamPay build.');return;
 }
 if(code!=='0x')throw new Error('Contract code does not match this build. Do not use it.');
 message('No contract is visible yet. If you cancelled the wallet prompt or refreshed before a hash appeared, keep this record and share it for recovery. Do not deploy again.');
}
$('ack').onchange=controls;
$('estimate').onclick=()=>run(async()=>{
 invalidate();if(!window.ethereum?.request)throw new Error('Open this page in a browser with an EVM wallet extension.');
 const accounts=await new AccountConnection(window.ethereum).connect();if(!accounts.length)throw new Error('No wallet account connected.');
 message('Switch to Arc Mainnet in your wallet to estimate the deployment.');await new NetworkConnection(window.ethereum,MAINNET).switch();
 const expected=new URLSearchParams(location.search).get('deployer');if(expected&&accounts[0].toLowerCase()!==expected.toLowerCase())throw new Error('Select the deployment wallet shown in the link, then estimate again.');
 const revision=version;const prepared=await prepareDeployment(reader,artifact,accounts[0]);if(revision!==version)throw new Error('Wallet changed while estimating. Try again.');
 plan=prepared;$('account').textContent=plan.account;$('balance').textContent=formatEther(plan.balance)+' USDC';$('fee').textContent=formatEther(plan.maxFee)+' USDC';$('ack').checked=false;$('review').hidden=false;message('Estimate ready. No transaction has been sent.');
});
$('deploy').onclick=()=>run(async()=>{
 if(!plan||!$('ack').checked||attempt)throw new Error('Review the deployment first.');const reviewed=plan,revision=version;
 await verifyDeploymentReview(reader,window.ethereum,reviewed);
 const provider=new BrowserProvider(window.ethereum),signer=await provider.getSigner(reviewed.account);
 if(revision!==version)throw new Error('Wallet changed. Estimate again.');
 persist({account:reviewed.account,nonce:reviewed.transaction.nonce,predictedAddress:reviewed.predictedAddress,hash:null});showAttempt();
 message('Approve this contract deployment in MetaMask. Keep the fee at or below the reviewed maximum.');
 try{const tx=await signer.sendTransaction(reviewed.transaction);persist({...attempt,hash:tx.hash});showAttempt();invalidate();message('Transaction submitted. Check its status; do not deploy again.');await check();}
 catch(error){if(Number(walletErrorCode(error))===4001||error.code==='ACTION_REJECTED'){localStorage.removeItem(KEY);attempt=null;$('result').hidden=true;}throw error;}
});
$('check').onclick=()=>run(check);
if(window.ethereum?.on)for(const event of ['accountsChanged','chainChanged','disconnect'])window.ethereum.on(event,()=>{invalidate();controls();message('Wallet changed. Any unsubmitted fee review has been cleared.');});
try{const response=await fetch('./contract.json',{cache:'no-store'});if(!response.ok)throw new Error('Could not load contract definition.');artifact=await response.json();const configResponse=await fetch('./mainnet-deployment.json',{cache:'no-store'});if(!configResponse.ok)throw new Error('Could not check existing mainnet deployment.');const config=await configResponse.json();if(config.chainId!==5042)throw new Error('Mainnet configuration mismatch.');if(config.contract){attempt={predictedAddress:config.contract,hash:config.deploymentTransaction};$('estimate').textContent='Shared contract already deployed';}if(attempt)await run(check);}catch(e){message(e.message);}
