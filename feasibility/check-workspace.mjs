// Full contract/client integration on a disposable local chain. No Arc funds used.
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
import assert from 'node:assert/strict';
import {JsonRpcProvider,Contract} from '../dist/vendor/ethers.mjs';
import {TeamPayClient,normalizePlan,createArgs} from '../dist/chain.mjs';
import {units} from '../dist/money.mjs';
const build=spawnSync('forge',['build'],{cwd:fileURLToPath(new URL('.',import.meta.url)),encoding:'utf8'});assert.equal(build.status,0,build.stderr);
const artifact=JSON.parse(readFileSync(new URL('../dist/contract.json',import.meta.url)));
const compiled=JSON.parse(readFileSync(new URL('out/TeamPay.sol/TeamPay.json',import.meta.url)));
assert.equal(artifact.bytecode,compiled.bytecode.object,'Browser artifact must match compiled source');
assert.equal(artifact.runtime,compiled.deployedBytecode.object);
const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));
const anvil=spawn('anvil',['--port',String(port),'--silent'],{stdio:'ignore'});
let provider,fresh;
try{
 const url=`http://127.0.0.1:${port}`;
 for(let i=0;i<50;i++){try{await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]})});break;}catch{await new Promise(r=>setTimeout(r,100));}}
 provider=new JsonRpcProvider(url,undefined,{cacheTimeout:-1});provider.pollingInterval=50;
 const [creator,other,third]=await Promise.all([0,1,2].map(i=>provider.getSigner(i)));
 const addresses=await Promise.all([creator,other,third].map(s=>s.getAddress()));
 const client=new TeamPayClient(provider,artifact);
 const deployed=await(await creator.sendTransaction(await client.deployTransaction())).wait();
 const address=deployed.contractAddress;
 const plan=normalizePlan({title:'A website together',members:addresses.map((address,i)=>({name:['Ada','Tobi','Sam'][i],address,bps:[4000,3500,2500][i]})),expenses:[{name:'Hosting',member:0,amount:'0.06'}]});
 const created=await(await creator.sendTransaction(await client.createTransaction(address,plan))).wait();
 const original=await client.load(address,1);assert.deepEqual(original.plan,plan);
 const contract=new Contract(address,artifact.abi,creator);
 const firstPayment=await(await contract.pay(1,{value:units('0.03')})).wait();
 assert.equal((await client.load(address,1)).state.remainingExpenses[0],units('0.03'));
 const secondPayment=await(await contract.pay(1,{value:units('0.27')})).wait();
 const credits=await Promise.all(addresses.map(a=>contract.claimable(a)));
 assert.deepEqual(credits,['0.156','0.084','0.06'].map(units));
 fresh=new JsonRpcProvider(url,undefined,{cacheTimeout:-1});fresh.pollingInterval=50;
 const reopened=await new TeamPayClient(fresh,artifact).load(address,'1');
 assert.equal(reopened.plan.title,plan.title);assert.equal(reopened.state.received,units('0.3'));
 // A different account may trigger a withdrawal, but the funds go only to its recipient.
 const before=await provider.getBalance(addresses[1]);
 const withdrawal=await(await contract.claim(addresses[1])).wait();
 assert.equal(await provider.getBalance(addresses[1]),before+units('0.084'));
 assert.equal(await contract.claimable(addresses[1]),0n);
 await assert.rejects(()=>contract.claim.staticCall(addresses[1]));
 // Concurrent project agreements keep expense state separate.
 await(await creator.sendTransaction(await client.createTransaction(address,plan))).wait();
 await(await contract.pay(2,{value:units('0.01')})).wait();
 assert.equal((await client.load(address,2)).state.remainingExpenses[0],units('0.05'));
 assert.equal((await client.load(address,1)).state.remainingExpenses[0],0n);
 // Receipts come from chain events, survive fresh-client loads, and exclude other projects.
 const history=await client.paymentHistory(address,1);
 assert.equal(history.payments.length,2);
 assert.equal(history.payments.reduce((n,p)=>n+p.amount,0n),units('0.3'));
 const newest=await client.paymentHistory(address,1,{toBlock:secondPayment.blockNumber,window:1});
 assert.equal(newest.payments.length,1);assert.equal(newest.payments[0].hash,secondPayment.hash);
 const earlier=await client.paymentHistory(address,1,{toBlock:newest.earlierBlock});
 assert.equal(earlier.payments.length,1);assert.equal(earlier.payments[0].hash,firstPayment.hash);
 const receipt=await new TeamPayClient(fresh,artifact).paymentReceipt(address,1,secondPayment.hash);
 assert.equal(receipt.amount,units('0.27').toString());
 assert.equal(receipt.allocations.reduce((n,a)=>n+BigInt(a.amount),0n),units('0.27'));
 assert.equal(receipt.amountDecimals,18);assert.equal(receipt.transactionFee,secondPayment.fee.toString());
 await assert.rejects(()=>client.paymentReceipt(address,2,secondPayment.hash));
 await assert.rejects(()=>client.paymentReceipt(address,1,withdrawal.hash));
 const configuration=await client.verifyDeployment(address,deployed.hash,31337);
 assert.equal(configuration.contract,address);assert.equal(configuration.deploymentBlock,deployed.blockNumber);
 await assert.rejects(()=>client.verifyDeployment(address,deployed.hash,5042002));
 await assert.rejects(()=>client.verifyDeployment(address,firstPayment.hash,31337));
 // Untrusted links and descriptions must not be accepted as valid agreements.
 await assert.rejects(()=>client.at(addresses[1]));
 const args=createArgs(plan);const badPlan={...plan,members:plan.members.map((m,i)=>({...m,bps:[5000,2500,2500][i]}))};args[4]=JSON.stringify(badPlan);
 await(await contract.createWithMetadata(...args)).wait();
 await assert.rejects(()=>client.load(address,3),/do not match/);
 const oversize=createArgs(plan);oversize[4]='x'.repeat(4097);
 await assert.rejects(()=>contract.createWithMetadata.staticCall(...oversize));
 console.log('Workspace integration passed: deploy, publish, fresh-client reload, two instalments, withdrawal, separate projects, untrusted contract, metadata mismatch, and metadata size limit.');
 console.log('History/receipt/configuration checks passed: fresh reads, pagination boundaries, allocation conservation, fee totals, cross-project isolation, withdrawal exclusion, and deployment verification.');
 console.log(JSON.stringify({deploymentGas:deployed.gasUsed.toString(),sampleProjectCreationGas:created.gasUsed.toString()}));
}finally{provider?.destroy();fresh?.destroy();anvil.kill('SIGTERM');}
