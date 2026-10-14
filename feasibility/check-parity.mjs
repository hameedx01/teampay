// Run from any directory: node feasibility/check-parity.mjs
// Uses only a disposable local Anvil chain; no RPC, wallet, or funds from Arc.
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import net from 'node:net';
import {allocate,units} from '../dist/money.mjs';
const cwd=fileURLToPath(new URL('.',import.meta.url));
const build=spawnSync('forge',['build'],{cwd,encoding:'utf8'});
assert.equal(build.status,0,build.stderr);
const server=net.createServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
await new Promise(resolve=>server.close(resolve));
const anvil=spawn('anvil',['--port',String(port),'--silent'],{stdio:'ignore'});
const rpc=async(method,params=[])=>{
 const response=await fetch(`http://127.0.0.1:${port}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
 const json=await response.json();if(json.error)throw new Error(JSON.stringify(json.error));return json.result;
};
const calldata=(signature,...args)=>{
 const result=spawnSync('cast',['calldata',signature,...args.map(String)],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);return result.stdout.trim();
};
try{
 let ready=false;
 for(let i=0;i<50;i++){try{await rpc('eth_chainId');ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
 assert(ready,'Local Anvil did not start');
 const [from,...members]=await rpc('eth_accounts');
 const send=async(to,data,value=0n)=>{
  const tx={from,data,value:'0x'+value.toString(16),gas:'0x989680'};if(to)tx.to=to;
  const hash=await rpc('eth_sendTransaction',[tx]);
  let receipt;
  for(let i=0;i<50;i++){receipt=await rpc('eth_getTransactionReceipt',[hash]);if(receipt)break;await new Promise(resolve=>setTimeout(resolve,50));}
  assert.equal(receipt?.status,'0x1','Local transaction reverted');return receipt;
 };
 const artifact=JSON.parse(readFileSync(new URL('out/ProjectPayments.sol/ProjectPayments.json',import.meta.url)));
 const contract=(await send(null,artifact.bytecode.object)).contractAddress;
 const read=async(signature,...args)=>BigInt(await rpc('eth_call',[{to:contract,data:calldata(signature,...args)},'latest']));
 let cases=0;
 for(const shares of [[4000,3500,2500],[3333,3333,3334],[1,1,9998]]){
  const plan={members:shares.map(bps=>({bps})),expenses:[{member:0},{member:1}]};
  let remaining=[units('60'),units('20')];
  await send(contract,calldata('create(address[],uint256[],address[],uint16[],bytes32)',`[${members[0]},${members[1]}]`,`[${remaining}]`,`[${members.slice(0,3)}]`,`[${shares}]`,'0x'+'00'.repeat(32)));
  const id=await read('projectCount()');
  for(const amount of [1n,units('30'),units('50'),units('220.000000000000000001'),3n]){
   const before=await Promise.all(members.slice(0,3).map(a=>read('claimable(address)',a)));
   const expected=allocate(plan,remaining,amount);
   await send(contract,calldata('pay(uint256)',id),amount);
   const after=await Promise.all(members.slice(0,3).map(a=>read('claimable(address)',a)));
   assert.deepEqual(after.map((n,i)=>n-before[i]),expected.credits,`Mismatch: shares ${shares}, amount ${amount}`);
   remaining=expected.remaining;cases++;
  }
 }
 console.log(`Frontend/Solidity parity passed: ${cases} real local-EVM payments across 3 share arrangements.`);
}finally{anvil.kill('SIGTERM');}
