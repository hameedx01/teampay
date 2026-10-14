import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountConnection} from './dist/wallet-session.mjs';
test('concurrent clicks share one wallet permission request',async()=>{
 let requests=0,approve;
 const session=new AccountConnection({request:async({method})=>{if(method==='eth_accounts')return [];requests++;return new Promise(r=>approve=r);}});
 const first=session.connect(),second=session.connect();await new Promise(r=>setTimeout(r,0));assert.equal(requests,1);approve(['0xabc']);assert.deepEqual(await first,['0xabc']);assert.deepEqual(await second,['0xabc']);
});
test('pending requests stay blocked until approved or explicitly cancelled',async()=>{
 let accounts=[],requests=0;
 const session=new AccountConnection({request:async({method})=>{if(method==='eth_accounts')return accounts;requests++;throw {code:-32002};}});
 await assert.rejects(session.connect(),/already open/);await assert.rejects(session.connect(),/already open/);assert.equal(requests,1);
 accounts=['0xabc'];assert.deepEqual(await session.connect(),accounts);assert.equal(requests,1);assert.equal(session.pending,false);
});
test('already connected wallets do not get another permission prompt',async()=>{
 const session=new AccountConnection({request:async({method})=>{assert.equal(method,'eth_accounts');return ['0xabc'];}});assert.deepEqual(await session.connect(),['0xabc']);
});
test('rejected requests can be retried; nested pending errors are recognized',async()=>{
 let error={code:4001};const session=new AccountConnection({request:async({method})=>{if(method==='eth_accounts')return [];throw error;}});
 await assert.rejects(session.connect());assert.equal(session.pending,false);error={code:-32603,data:{originalError:{code:-32002}}};await assert.rejects(session.connect(),/already open/);assert.equal(session.pending,true);session.resetAfterCancellation();assert.equal(session.pending,false);
});

import {NetworkConnection,walletSnapshot} from './dist/wallet-session.mjs';
const network={chainId:'0x4cef52',chainName:'Arc Testnet'};
test('authorized wallet on wrong chain is detected without permission requests',async()=>{
 const calls=[];const state=await walletSnapshot({request:async({method})=>{calls.push(method);return method==='eth_accounts'?['0xabc']:'0x1';}},network.chainId);
 assert.equal(state.wrongNetwork,true);assert.deepEqual(calls,['eth_accounts','eth_chainId']);
});
test('already on Arc does not prompt to switch',async()=>{
 await new NetworkConnection({request:async({method})=>{assert.equal(method,'eth_chainId');return network.chainId;}},network).switch();
});
test('unknown chain is added then switched when adding does not select it',async()=>{
 let chain='0x1',added=false;const calls=[];
 await new NetworkConnection({request:async({method})=>{calls.push(method);if(method==='eth_chainId')return chain;if(method==='wallet_addEthereumChain'){added=true;return;}if(!added)throw {data:{originalError:{code:4902}}};chain=network.chainId;}},network).switch();
 assert.deepEqual(calls,['eth_chainId','wallet_switchEthereumChain','wallet_addEthereumChain','eth_chainId','wallet_switchEthereumChain','eth_chainId']);
});
test('rejected and pending switches remain failures and permit deliberate retry',async()=>{
 for(const code of [4001,-32002]){let reject=true,chain='0x1';const session=new NetworkConnection({request:async({method})=>{if(method==='eth_chainId')return chain;if(reject)throw {code};chain=network.chainId;}},network);
 await assert.rejects(session.switch(),e=>e.code===code);assert.equal(session.inFlight,null);reject=false;await session.switch();}
});
test('concurrent switches share a prompt and verify the final chain',async()=>{
 let approve,calls=0,chain='0x1';const session=new NetworkConnection({request:async({method})=>{if(method==='eth_chainId')return chain;calls++;await new Promise(r=>approve=r);chain=network.chainId;}},network);
 const a=session.switch(),b=session.switch();await new Promise(r=>setTimeout(r,0));assert.equal(calls,1);approve();await Promise.all([a,b]);
 const unchanged=new NetworkConnection({request:async({method})=>method==='eth_chainId'?'0x1':null},network);
 await assert.rejects(unchanged.switch(),/still on another network/);
});
test('disconnect and manual chain changes are reflected by read-only snapshots',async()=>{
 let accounts=['0xabc'],chain=network.chainId;const provider={request:async({method})=>method==='eth_accounts'?accounts:chain};
 assert.equal((await walletSnapshot(provider,network.chainId)).wrongNetwork,false);chain='0x1';assert.equal((await walletSnapshot(provider,network.chainId)).wrongNetwork,true);accounts=[];assert.equal((await walletSnapshot(provider,network.chainId)).account,null);
});

test('disconnect revokes site account permission and checks access was removed',async()=>{
 const {revokeWalletAccess}=await import('./dist/wallet-session.mjs');const calls=[];
 await revokeWalletAccess({request:async request=>{calls.push(request);return request.method==='eth_accounts'?[]:null;}});
 assert.deepEqual(calls,[{method:'wallet_revokePermissions',params:[{eth_accounts:{}}]},{method:'eth_accounts'}]);
 await assert.rejects(revokeWalletAccess({request:async request=>request.method==='eth_accounts'?['0xabc']:null}),/still grants/);
 await assert.rejects(revokeWalletAccess({request:async()=>{throw new Error('Unsupported');}}),/Unsupported/);
});
