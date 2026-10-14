import {Contract, ContractFactory, getAddress, ZeroAddress} from './vendor/ethers.mjs';
import {units,validatePlan} from './money.mjs';
export const NETWORK={chainId:'0x4cef52',chainName:'Arc Testnet',nativeCurrency:{name:'USDC',symbol:'USDC',decimals:18},rpcUrls:['https://rpc.blockdaemon.testnet.arc.io'],blockExplorerUrls:['https://explorer.testnet.arc.io']};
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
 async createTransaction(raw,plan){const contract=await this.at(raw);if(plan.members.some(m=>m.address.toLowerCase()===raw.toLowerCase()))throw new Error('The payment contract cannot be a recipient.');return contract.createWithMetadata.populateTransaction(...createArgs(plan));}
 async deployTransaction(){return new ContractFactory(this.artifact.abi,this.artifact.bytecode).getDeployTransaction();}
}
