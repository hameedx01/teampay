import {Contract,getAddress} from './vendor/ethers.mjs';
export function walletActivityFromLogs(logs,iface,account){
 const wallet=getAddress(account).toLowerCase(),entries=new Map();
 for(const log of logs){if(log.removed)continue;let event;try{event=iface.parseLog(log);}catch{continue;}if(!event)continue;
  const a=event.args;let type,projectId=null,amount=0n;
  if(event.name==='ProjectPublished'&&a.creator.toLowerCase()===wallet){type='agreement';projectId=String(a.projectId);}
  else if(event.name==='Funded'&&a.payer.toLowerCase()===wallet){type='payment';projectId=String(a.projectId);amount=a.amount;}
  else if(event.name==='Allocated'&&a.recipient.toLowerCase()===wallet){type='allocation';projectId=String(a.projectId);amount=a.amount;}
  else if(event.name==='Claimed'&&a.recipient.toLowerCase()===wallet){type='withdrawal';amount=a.amount;}
  else continue;
  const key=[log.transactionHash,type,projectId].join(':');const previous=entries.get(key);
  entries.set(key,{key,type,projectId,amount:(previous?.amount??0n)+amount,transactionHash:log.transactionHash,blockNumber:log.blockNumber,logIndex:previous?.logIndex??log.index});
 }
 return [...entries.values()].sort((a,b)=>b.blockNumber-a.blockNumber||b.logIndex-a.logIndex);
}
export async function loadWalletActivity(provider,artifact,contractAddress,account,{fromBlock,window=5000}={}){
 if(!Number.isSafeInteger(fromBlock)||fromBlock<0||!Number.isInteger(window)||window<1||window>5000)throw new Error('Invalid activity block range.');
 const contract=new Contract(getAddress(contractAddress),artifact.abi,provider);
 if((await provider.getCode(contractAddress)).toLowerCase()!==artifact.runtime.toLowerCase())throw new Error('Activity contract code does not match TeamPay.');
 const latest=await provider.getBlockNumber();if(fromBlock>latest)return {entries:[],fromBlock,toBlock:latest,nextBlock:null};
 const end=Math.min(latest,fromBlock+window-1),logs=[];
 const topics=[['ProjectPublished','Funded','Allocated','Claimed'].map(name=>contract.interface.getEvent(name).topicHash)];
 for(let start=fromBlock;start<=end;start+=2000){const requests=[];for(let block=start;block<=Math.min(end,start+1999);block+=500)requests.push(provider.getLogs({address:contractAddress,topics,fromBlock:block,toBlock:Math.min(end,block+499)}));logs.push(...(await Promise.all(requests)).flat());}
 return {entries:walletActivityFromLogs(logs,contract.interface,account),fromBlock,toBlock:end,nextBlock:end<latest?end+1:null};
}

export async function describeWalletActivity(provider,client,contractAddress,entries){
 const titles=new Map(),dates=new Map();
 const jobs=[...new Set(entries.map(e=>e.projectId).filter(Boolean))].map(id=>async()=>{try{const project=await client.load(contractAddress,id);titles.set(id,project.plan.title);}catch{/* Keep the confirmed event if metadata is unavailable. */}});
 jobs.push(...[...new Set(entries.map(e=>e.blockNumber))].map(number=>async()=>{try{const block=await provider.getBlock(number);if(block)dates.set(number,new Date(block.timestamp*1000).toISOString());}catch{/* Block numbers remain available. */}}));
 for(let i=0;i<jobs.length;i+=4)await Promise.all(jobs.slice(i,i+4).map(job=>job()));
 return entries.map(entry=>({...entry,projectTitle:titles.get(entry.projectId)||null,confirmedAt:dates.get(entry.blockNumber)||null}));
}
export function filterWalletActivity(entries,type='all'){
 if(!['all','agreement','payment','allocation','withdrawal'].includes(type))throw new Error('Unknown activity filter.');
 return type==='all'?entries:entries.filter(entry=>entry.type===type);
}
