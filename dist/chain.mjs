import {Contract, ContractFactory, getAddress, ZeroAddress, zeroPadValue, toBeHex} from './vendor/ethers.mjs';
import {units,validatePlan,display} from './money.mjs';
import {MAINNET} from './mainnet-deployment.mjs';
export const NETWORK=MAINNET;
export function address(value){const result=getAddress(String(value).trim());if(result===ZeroAddress)throw new Error('The zero address cannot receive payments.');return result;}
export function normalizePlan(input){
 const text=(s,max)=>{if(typeof s!=='string'||!s.trim()||s.trim().length>max)throw new Error('Enter a valid project, teammate, or expense name.');return s.trim();};
 const plan={version:1,title:text(input.title,70),members:input.members.map(m=>({name:text(m.name,30),address:address(m.address),bps:m.bps})),expenses:input.expenses.map(e=>({name:text(e.name,40),member:e.member,amount:String(e.amount)}))};
 if(new Set(plan.members.map(m=>m.address)).size!==plan.members.length)throw new Error('Use a different wallet address for each teammate.');
 const remaining=plan.expenses.map(e=>units(e.amount));
 if(remaining.some(n=>n<=0n))throw new Error('Expenses must be positive. Remove any expense you do not need.');
 validatePlan(plan,remaining);
 if(new TextEncoder().encode(JSON.stringify(plan)).length>4096)throw new Error('The agreement is too large. Shorten its descriptions.');
 return plan;
}
export function createArgs(plan){return [plan.expenses.map(e=>plan.members[e.member].address),plan.expenses.map(e=>units(e.amount)),plan.members.map(m=>m.address),plan.members.map(m=>m.bps),JSON.stringify(plan)];}
export class TeamPayClient {
 constructor(provider,artifact){this.provider=provider;this.artifact=artifact;}
 async at(raw){const target=address(raw);const code=await this.provider.getCode(target);if(code.toLowerCase()!==this.artifact.runtime.toLowerCase())throw new Error('This address does not contain the supported TeamPay contract.');return new Contract(target,this.artifact.abi,this.provider);}
 async load(raw,id){
  if(!/^[1-9]\d*$/.test(String(id)))throw new Error('Invalid project number.');
  const contract=await this.at(raw);
  const [state,metadata]=await Promise.all([contract.project(id),contract.projectMetadata(id)]);
  const plan=normalizePlan(JSON.parse(metadata));
  const args=createArgs(plan);
  const same=(a,b)=>a.length===b.length&&a.every((x,i)=>String(x).toLowerCase()===String(b[i]).toLowerCase());
  if(!same(state.collaborators,args[2])||!same(state.shares,args[3])||!same(state.expenseRecipients,args[0])||state.remainingExpenses.some((n,i)=>n>args[1][i]))throw new Error('Project descriptions do not match the payment rules.');
  return {contract,plan,state,id:String(id)};
 }
 async paymentHistory(raw,id,{toBlock,window=2000,minBlock=0}={}){
  if(!/^[1-9]\d*$/.test(String(id)))throw new Error('Invalid project number.');
  if(!Number.isInteger(window)||window<1||window>2000)throw new Error('History window must be between 1 and 2000 blocks.');
  const contract=await this.at(raw);
  const end=toBlock??await this.provider.getBlockNumber();
  if(!Number.isSafeInteger(end)||end<0)throw new Error('Invalid history block.');
  if(!Number.isSafeInteger(minBlock)||minBlock<0||minBlock>end)throw new Error('Invalid history start block.');
  const start=Math.max(minBlock,end-window+1),logs=[];
  const topics=[[contract.interface.getEvent('Funded').topicHash,contract.interface.getEvent('Allocated').topicHash],zeroPadValue(toBeHex(BigInt(id)),32)];
  for(let from=start;from<=end;from+=500){logs.push(...await this.provider.getLogs({address:await contract.getAddress(),fromBlock:from,toBlock:Math.min(end,from+499),topics}));}
  const payments=new Map(),allocations=new Map();
  for(const log of logs){if(log.removed)continue;const event=contract.interface.parseLog(log);
   if(event.name==='Funded'){const prior=payments.get(log.transactionHash);if(prior){prior.amount+=event.args.amount;prior.payers.push(event.args.payer);if(prior.payer!==event.args.payer)prior.payer=null;}else payments.set(log.transactionHash,{hash:log.transactionHash,blockHash:log.blockHash,blockNumber:log.blockNumber,logIndex:log.index,payer:event.args.payer,payers:[event.args.payer],amount:event.args.amount,allocations:[]});}
   else if(event.name==='Allocated'){const list=allocations.get(log.transactionHash)||[];list.push({recipient:event.args.recipient,amount:event.args.amount});allocations.set(log.transactionHash,list);}
  }
  for(const [hash,payment] of payments){payment.allocations=allocations.get(hash)||[];if(payment.allocations.reduce((n,a)=>n+a.amount,0n)!==payment.amount)throw new Error('Payment events are incomplete. Refresh before exporting a receipt.');}
  return {fromBlock:start,toBlock:end,earlierBlock:start>minBlock?start-1:null,payments:[...payments.values()].sort((a,b)=>b.blockNumber-a.blockNumber||b.logIndex-a.logIndex)};
 }
 async paymentReceipt(raw,id,hash){
  if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new Error('Invalid transaction hash.');
  const receipt=await this.provider.getTransactionReceipt(hash);
  if(!receipt||receipt.status!==1)throw new Error('A confirmed successful payment is required.');
  const page=await this.paymentHistory(raw,id,{toBlock:receipt.blockNumber,window:1});
  const payment=page.payments.find(p=>p.hash.toLowerCase()===hash.toLowerCase());
  if(!payment)throw new Error('This transaction does not contain a payment for this project.');
  if(payment.blockHash!==receipt.blockHash)throw new Error('The payment block changed. Refresh and try again.');
  const block=await this.provider.getBlock(receipt.blockHash);const network=await this.provider.getNetwork();
  return {schemaVersion:1,kind:'payment-allocation-receipt',chainId:network.chainId.toString(),contract:address(raw),projectId:String(id),transactionHash:hash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,confirmedAt:new Date(block.timestamp*1000).toISOString(),asset:'native USDC',amountDecimals:18,payer:payment.payer,payers:payment.payers,amount:payment.amount.toString(),amountUsdc:display(payment.amount).replaceAll(',',''),allocations:payment.allocations.map(a=>({recipient:a.recipient,amount:a.amount.toString(),amountUsdc:display(a.amount).replaceAll(',','')})),transactionFee:receipt.fee.toString(),transactionFeeUsdc:display(receipt.fee).replaceAll(',',''),note:'Allocation is not proof of recipient withdrawal. The network fee covers the complete transaction.'};
 }
 async verifyDeployment(raw,hash,expectedChainId){
  if((await this.provider.getNetwork()).chainId!==BigInt(expectedChainId))throw new Error('Deployment network mismatch.');
  if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new Error('Invalid deployment transaction hash.');
  const target=address(raw),receipt=await this.provider.getTransactionReceipt(hash);
  if(!receipt||receipt.status!==1||receipt.contractAddress?.toLowerCase()!==target.toLowerCase())throw new Error('The transaction does not confirm deployment of this contract.');
  await this.at(target);
  return {chainId:Number(expectedChainId),contract:target,deploymentBlock:receipt.blockNumber,deploymentTransaction:receipt.hash};
 }
 async createTransaction(raw,plan){const contract=await this.at(raw);if(plan.members.some(m=>m.address.toLowerCase()===raw.toLowerCase()))throw new Error('The payment contract cannot be a recipient.');return contract.createWithMetadata.populateTransaction(...createArgs(plan));}
 async deployTransaction(){return new ContractFactory(this.artifact.abi,this.artifact.bytecode).getDeployTransaction();}
}
