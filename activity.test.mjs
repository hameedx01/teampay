import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Interface} from './dist/vendor/ethers.mjs';
import {walletActivityFromLogs,loadWalletActivity} from './dist/activity.mjs';
const artifact=JSON.parse(readFileSync(new URL('./dist/contract.json',import.meta.url))),iface=new Interface(artifact.abi);
const a='0x940D6F7F596Aa65342fE490510b74282156C949B',b='0xef4D5945A4F48943b74af0957d61638CF645Ad2b';
const log=(name,args,index=0,hash='0x'+'1'.repeat(64))=>({...iface.encodeEventLog(iface.getEvent(name),args),transactionHash:hash,blockNumber:100,index,removed:false});
test('activity separates publishing, payments, allocations and withdrawals for the selected wallet',()=>{
 const logs=[log('ProjectPublished',[1,a]),log('Funded',[1,a,10n],1),log('Allocated',[1,a,1n],2),log('Allocated',[1,a,9n],3),log('Claimed',[a,10n],4),log('Claimed',[b,99n],5)];
 const records=walletActivityFromLogs(logs,iface,a);assert.equal(records.length,4);assert.equal(records.find(r=>r.type==='allocation').amount,10n);assert.equal(records.find(r=>r.type==='withdrawal').projectId,null);assert.equal(records.find(r=>r.type==='agreement').projectId,'1');
 const other=walletActivityFromLogs(logs,iface,b);assert.equal(other.length,1);assert.equal(other[0].amount,99n);
});
test('receipt credits stay separate across projects in a shared transaction and ignore removed logs',()=>{
 const logs=[log('Allocated',[1,a,3n]),log('Allocated',[2,a,4n],1),{...log('Claimed',[a,7n],2),removed:true}];
 const rows=walletActivityFromLogs(logs,iface,a);assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.projectId),['2','1']);
});
test('activity pagination covers bounded non-overlapping RPC ranges and exposes its cursor',async()=>{
 const ranges=[];const provider={getCode:async()=>artifact.runtime,getBlockNumber:async()=>6100,getLogs:async range=>{ranges.push([range.fromBlock,range.toBlock]);return [];}};
 const page=await loadWalletActivity(provider,artifact,a,a,{fromBlock:100,window:5000});assert.equal(page.toBlock,5099);assert.equal(page.nextBlock,5100);assert.equal(ranges.length,10);assert.deepEqual(ranges[0],[100,599]);assert.deepEqual(ranges.at(-1),[4600,5099]);
 const last=await loadWalletActivity(provider,artifact,a,a,{fromBlock:5100});assert.equal(last.nextBlock,null);assert.equal(last.toBlock,6100);
});
test('activity rejects an untrusted contract or invalid range',async()=>{
 await assert.rejects(loadWalletActivity({},artifact,a,a,{fromBlock:-1}),/range/);
 await assert.rejects(loadWalletActivity({getCode:async()=>'0x'},artifact,a,a,{fromBlock:0}),/does not match/);
});

import {describeWalletActivity,filterWalletActivity} from './dist/activity.mjs';
test('activity descriptions load each project and date once and keep events when metadata fails',async()=>{
 let reads=0,blocks=0;const rows=[{projectId:'1',blockNumber:10,type:'agreement'},{projectId:'1',blockNumber:10,type:'payment'},{projectId:'2',blockNumber:11,type:'allocation'},{projectId:null,blockNumber:11,type:'withdrawal'}];
 const described=await describeWalletActivity({getBlock:async n=>{blocks++;return {timestamp:n};}},{load:async(_,id)=>{reads++;if(id==='2')throw new Error('RPC unavailable');return {plan:{title:'Website design'}};}},a,rows);
 assert.equal(reads,2);assert.equal(blocks,2);assert.equal(described[0].projectTitle,'Website design');assert.equal(described[1].confirmedAt,'1970-01-01T00:00:10.000Z');assert.equal(described[2].projectTitle,null);assert.equal(described.length,4);
 assert.deepEqual(filterWalletActivity(described,'payment'),[described[1]]);assert.equal(filterWalletActivity(described,'all').length,4);assert.throws(()=>filterWalletActivity(described,'unknown'),/Unknown/);
});
