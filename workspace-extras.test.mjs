import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDraft,serializeDraft,hasDraftContent} from './dist/drafts.mjs';
import {searchPaymentHistory} from './dist/history-search.mjs';
import {loadWalletProjects} from './dist/project-library.mjs';
const draft={title:'Unfinished',preview:'300',members:[{name:'Ada',address:'0xabc',share:'50.'},{name:'',address:'',share:''}],expenses:[{name:'Hosting',member:-1,amount:''}]};
test('partial drafts preserve unfinished fields and unselected expense recipients',()=>{
 assert.deepEqual(parseDraft(serializeDraft(draft)),{version:1,...draft});assert.equal(hasDraftContent(draft),true);
 assert.equal(hasDraftContent({title:'',members:[{name:'',address:'',share:'50'}],expenses:[]}),false);
});
test('invalid draft structure and recipient indices cannot be restored',()=>{
 for(const raw of ['bad','{}',JSON.stringify({version:2,...draft}),JSON.stringify({version:1,...draft,expenses:[{name:'x',amount:'1',member:8}]}),' '.repeat(30001)])assert.throws(()=>parseDraft(raw));
});
test('history searches empty recent pages until a confirmed payment is found',async()=>{
 const calls=[];const client={paymentHistory:async(a,id,opts)=>{calls.push(opts);const end=opts.toBlock??10000;return {fromBlock:end-1999,toBlock:end,earlierBlock:end-2000,payments:calls.length===3?[{hash:'confirmed'}]:[]};}};
 const result=await searchPaymentHistory(client,'contract','2');assert.equal(calls.length,3);assert.equal(result.toBlock,10000);assert.equal(result.fromBlock,4001);assert.equal(result.payments[0].hash,'confirmed');assert.equal(calls[1].toBlock,8000);
});
test('history stops at search budget, cancellation, or an unfunded agreement',async()=>{
 let calls=0;const client={paymentHistory:async()=>{calls++;return {fromBlock:100,toBlock:200,earlierBlock:99,payments:[]};}};
 await searchPaymentHistory(client,'c','1',{maxPages:2});assert.equal(calls,2);
 assert.equal(await searchPaymentHistory(client,'c','1',{isCurrent:()=>false}),null);assert.equal(calls,2);
 await searchPaymentHistory(client,'c','1',{hasPayments:false});assert.equal(calls,3);
});
test('project discovery includes creators and unfunded teammates, excludes unrelated wallets and removed events',async()=>{
 const wallet='0x000000000000000000000000000000000000a001',other='0x000000000000000000000000000000000000b001';
 const events=[{id:'1',creator:wallet},{id:'2',creator:other},{id:'3',creator:other},{id:'4',creator:wallet,removed:true}];
 const provider={getBlockNumber:async()=>499,getLogs:async()=>events.map((e,i)=>({...e,transactionHash:'hash'+i,blockNumber:i+1}))};
 const client={at:async()=>({project:async id=>({collaborators:[id==='2'?wallet:other],expenseRecipients:id==='2'?[wallet]:[]}),interface:{getEvent:()=>({topicHash:'topic'}),parseLog:l=>({args:{projectId:l.id,creator:l.creator}})}}),load:async(c,id)=>({plan:{title:'Project '+id,members:[{address:id==='2'?wallet:other}],expenses:id==='2'?[{member:0}]:[]}})};
 const page=await loadWalletProjects(provider,client,{},other,wallet,{fromBlock:0});assert.deepEqual(page.projects.map(p=>p.id),['2','1']);assert.deepEqual(page.projects[0].roles,['Teammate','Expense recipient']);assert.deepEqual(page.projects[1].roles,['Creator']);assert.equal(page.nextBlock,null);
});

test('publishing clears only its saved draft snapshot and preserves later edits',async()=>{
 const {initWorkspaceExtras}=await import('./dist/workspace-extras.mjs');const {DRAFT_KEY}=await import('./dist/drafts.mjs');
 const previous=globalThis.localStorage,storage=new Map([[DRAFT_KEY,serializeDraft(draft)]]),nodes=new Map();
 globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
 const $=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);};
 try{const component=initWorkspaceExtras({$,getContext:()=>({}),esc:String});const old=storage.get(DRAFT_KEY);assert.equal(component.draftSnapshot(),null,'pending restore decision must not be deleted by unrelated publication');storage.set(DRAFT_KEY,'newer edits');component.clearPublishedDraft(old);assert.equal(storage.get(DRAFT_KEY),'newer edits');component.clearPublishedDraft('newer edits');assert.equal(storage.has(DRAFT_KEY),false);}finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});
