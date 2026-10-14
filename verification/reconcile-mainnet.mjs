// Read-only mainnet reconciliation; writes evidence locally, never signs transactions.
import {JsonRpcProvider,Interface,formatEther} from '../dist/vendor/ethers.mjs';
import {TeamPayClient} from '../dist/chain.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const provider=new JsonRpcProvider('https://rpc.blockdaemon.mainnet.arc.io');
try{
 assert.equal((await provider.getNetwork()).chainId,5042n);
 const artifact=JSON.parse(readFileSync(new URL('../dist/contract.json',import.meta.url)));
 const address='0xB8A30476424DF1b2954e9a934a66fC52463C62cD',client=new TeamPayClient(provider,artifact),contract=await client.at(address),iface=new Interface(artifact.abi);
 const end=await provider.getBlockNumber(),start=25990879,logs=[];
 for(let from=start;from<=end;from+=2000){
  const pages=await Promise.all(Array.from({length:4},(_,i)=>from+i*500).filter(n=>n<=end).map(n=>provider.getLogs({address,fromBlock:n,toBlock:Math.min(n+499,end)})));
  logs.push(...pages.flat());
 }
 logs.sort((a,b)=>a.blockNumber-b.blockNumber||a.index-b.index);
 const events=logs.map(log=>{const e=iface.parseLog(log);return {type:e.name,hash:log.transactionHash,block:log.blockNumber,projectId:e.args.projectId?.toString(),recipient:e.args.recipient,payer:e.args.payer,amount:e.args.amount?.toString(),amountUsdc:e.args.amount===undefined?undefined:formatEther(e.args.amount)};});
 const projects=[];
 for(let id=1;id<=Number(await contract.projectCount({blockTag:end}));id++){
  const state=await contract.project(id,{blockTag:end});const plan=JSON.parse(await contract.projectMetadata(id,{blockTag:end}));
  const payments=events.filter(e=>e.type==='Funded'&&e.projectId===String(id)),allocations=events.filter(e=>e.type==='Allocated'&&e.projectId===String(id));
  assert.equal(payments.reduce((n,e)=>n+BigInt(e.amount),0n),state.received);
  assert.equal(allocations.reduce((n,e)=>n+BigInt(e.amount),0n),state.received);
  projects.push({id,title:plan.title,receivedUsdc:formatEther(state.received),remainingExpensesUsdc:state.remainingExpenses.map(formatEther),payments});
 }
 const wallets=[];
 for(const account of ['0x940D6F7F596Aa65342fE490510b74282156C949B','0xef4D5945A4F48943b74af0957d61638CF645Ad2b']){
  const matching=events.filter(e=>e.recipient?.toLowerCase()===account.toLowerCase());
  const credited=matching.filter(e=>e.type==='Allocated').reduce((n,e)=>n+BigInt(e.amount),0n),withdrawals=matching.filter(e=>e.type==='Claimed'),withdrawn=withdrawals.reduce((n,e)=>n+BigInt(e.amount),0n),available=await contract.claimable(account,{blockTag:end});
  assert.equal(credited-withdrawn,available);wallets.push({account,allocatedUsdc:formatEther(credited),withdrawnUsdc:formatEther(withdrawn),availableUsdc:formatEther(available),withdrawals});
 }
 const hashes=[...new Set(logs.map(l=>l.transactionHash))];let gas=0n;
 for(const hash of hashes){const receipt=await provider.getTransactionReceipt(hash);assert.equal(receipt.status,1);gas+=receipt.fee;}
 const deployment=await provider.getTransactionReceipt('0x5753f681d1a21184e96710739bab944164e439f3d268ca4c88e8070e104a1899');
 if(!hashes.includes(deployment.hash))gas+=deployment.fee;
 const evidence={checkedAt:new Date().toISOString(),chainId:5042,contract:address,fromBlock:start,toBlock:end,projects,wallets,contractTransactionGasUsdc:formatEther(gas),events};
 writeFileSync(new URL('./mainnet-reconciliation.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify({projects,wallets,contractTransactionGasUsdc:formatEther(gas)},null,2));
}finally{provider.destroy();}
