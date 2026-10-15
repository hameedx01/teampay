import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlan,createArgs,address} from './dist/chain.mjs';
const a='0x000000000000000000000000000000000000a001',b='0x000000000000000000000000000000000000b001';
const sample=()=>({title:'Website',members:[{name:'Ada',address:a,bps:4000},{name:'Tobi',address:b,bps:6000}],expenses:[{name:'Hosting',member:0,amount:'0.01'}]});
test('agreement serialization preserves native units, recipients, and shares',()=>{const plan=normalizePlan(sample());const args=createArgs(plan);assert.equal(args[1][0],10000000000000000n);assert.deepEqual(args[3],[4000,6000]);assert.deepEqual(JSON.parse(args[4]),plan);});
test('bad, zero, duplicate, and invalid mixed-case addresses fail before signing',()=>{
 for(const raw of ['0x123','0x0000000000000000000000000000000000000000','0x52908400098527886E0F7030069857D2E4169Ee7'])assert.throws(()=>address(raw));
 const p=sample();p.members[1].address=a;assert.throws(()=>normalizePlan(p));
});
test('missing expense recipient and invalid shares fail before signing',()=>{const p=sample();p.expenses[0].member=-1;assert.throws(()=>normalizePlan(p));const q=sample();q.members[0].bps=4001;assert.throws(()=>normalizePlan(q));});
test('a project can have no expenses',()=>{const p=sample();p.expenses=[];assert.deepEqual(createArgs(normalizePlan(p))[0],[]);});

test('payment history stops at deployment and does not query earlier chain blocks',async()=>{
 const {TeamPayClient}=await import('./dist/chain.mjs');const {Interface}=await import('./dist/vendor/ethers.mjs');const {readFileSync}=await import('node:fs');
 const artifact=JSON.parse(readFileSync(new URL('./dist/contract.json',import.meta.url)));const ranges=[];
 const client=new TeamPayClient({getBlockNumber:async()=>1234,getLogs:async range=>{ranges.push(range);return [];}},artifact);
 client.at=async()=>({getAddress:async()=>a,interface:new Interface(artifact.abi)});
 const page=await client.paymentHistory(a,'2',{minBlock:1000});assert.equal(page.fromBlock,1000);assert.equal(page.earlierBlock,null);assert.equal(ranges[0].fromBlock,1000);assert.equal(ranges[0].toBlock,1234);
 const recent=await client.paymentHistory(a,'2',{minBlock:1000,window:100});assert.equal(recent.earlierBlock,1134);
 await assert.rejects(client.paymentHistory(a,'2',{minBlock:1235}),/Invalid history start/);
});
