import {getAddress} from './vendor/ethers.mjs';
// Include unfunded agreements: membership is read from the agreement, not payment events.
export async function loadWalletProjects(provider,client,artifact,contractAddress,account,{fromBlock,window=5000}={}){
 if(!Number.isSafeInteger(fromBlock)||fromBlock<0||!Number.isInteger(window)||window<1||window>5000)throw new Error('Invalid project search range.');
 const wallet=getAddress(account).toLowerCase(),contract=await client.at(contractAddress),latest=await provider.getBlockNumber();
 if(fromBlock>latest)return {projects:[],fromBlock,toBlock:latest,nextBlock:null};
 const end=Math.min(latest,fromBlock+window-1),events=[];
 const topics=[contract.interface.getEvent('ProjectPublished').topicHash];
 for(let start=fromBlock;start<=end;start+=2000){const jobs=[];for(let block=start;block<=Math.min(end,start+1999);block+=500)jobs.push(provider.getLogs({address:contractAddress,topics,fromBlock:block,toBlock:Math.min(end,block+499)}));for(const log of (await Promise.all(jobs)).flat()){if(!log.removed){const event=contract.interface.parseLog(log);events.push({id:String(event.args.projectId),creator:event.args.creator,hash:log.transactionHash,block:log.blockNumber});}}}
 const projects=[];
 for(let n=0;n<events.length;n+=4){await Promise.all(events.slice(n,n+4).map(async event=>{
  const state=await contract.project(event.id),roles=[];
  if(event.creator.toLowerCase()===wallet)roles.push('Creator');
  if(state.collaborators.some(address=>address.toLowerCase()===wallet))roles.push('Teammate');
  if(state.expenseRecipients.some(address=>address.toLowerCase()===wallet))roles.push('Expense recipient');
  if(roles.length){let title='Project #'+event.id+' (description unavailable)';try{title=(await client.load(contractAddress,event.id)).plan.title;}catch{/* Membership is verified from contract state even if the description is unavailable. */}projects.push({...event,title,roles});}
 }));}
 return {projects:projects.sort((a,b)=>b.block-a.block),fromBlock,toBlock:end,nextBlock:end<latest?end+1:null};
}
