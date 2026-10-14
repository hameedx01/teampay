import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareDeployment,verifyDeploymentReview,DEPLOYMENT_FEE_CAP} from './dist/mainnet-deployment.mjs';
const artifact=JSON.parse(readFileSync(new URL('./dist/contract.json',import.meta.url)));
const account='0x940D6F7F596Aa65342fE490510b74282156C949B';
const provider=overrides=>({getNetwork:async()=>({chainId:5042n}),getBlock:async()=>({timestamp:Math.floor(Date.now()/1000)}),estimateGas:async()=>1213873n,getFeeData:async()=>({gasPrice:20000000000n}),getBalance:async()=>10n**18n,getTransactionCount:async()=>0,...overrides});
const wallet={request:async({method})=>method==='eth_accounts'?[account]:'0x13b2'};
test('mainnet plan contains explicit fee bounds, account, chain and nonce; no principal',async()=>{
 const p=await prepareDeployment(provider(),artifact,account);assert.equal(p.transaction.chainId,5042n);assert.equal(p.transaction.from,account);assert.equal(p.transaction.value,0n);assert.equal(p.transaction.nonce,0);assert(p.maxFee<DEPLOYMENT_FEE_CAP);assert.equal(p.maxFee,p.transaction.gasLimit*p.transaction.gasPrice);await verifyDeploymentReview(provider(),wallet,p);
});
test('wrong chain, stale RPC, excessive fees and insufficient balance fail closed',async()=>{
 for(const [override,expected] of [[{getNetwork:async()=>({chainId:5042002n})},/Mainnet/],[{getBlock:async()=>({timestamp:1})},/stale/],[{getFeeData:async()=>({gasPrice:10n**12n})},/fee cap/],[{getBalance:async()=>0n},/Not enough/]])await assert.rejects(prepareDeployment(provider(override),artifact,account),expected);
});
test('expired review, changed account, changed network and nonce prevent signing',async()=>{
 const p=await prepareDeployment(provider(),artifact,account);
 await assert.rejects(verifyDeploymentReview(provider(),wallet,{...p,preparedAt:Date.now()-121000}),/expired/);
 await assert.rejects(verifyDeploymentReview(provider(),{request:async()=>[]},p),/account or network/);
 await assert.rejects(verifyDeploymentReview(provider(),{request:async({method})=>method==='eth_accounts'?[account]:'0x1'},p),/account or network/);
 await assert.rejects(verifyDeploymentReview(provider({getTransactionCount:async()=>1}),wallet,p),/nonce/);
});
test('EIP-1559 fee envelope buffers the current price, not an already buffered maximum',async()=>{
 const p=await prepareDeployment(provider({getFeeData:async()=>({gasPrice:20000000000n,maxFeePerGas:40000001041n,maxPriorityFeePerGas:1041n})}),artifact,account);
 assert.equal(p.transaction.maxFeePerGas,40000000000n);assert.equal(p.transaction.maxPriorityFeePerGas,1041n);assert.equal(p.transaction.gasPrice,undefined);assert.equal(p.maxFee,p.transaction.gasLimit*p.transaction.maxFeePerGas);assert(p.maxFee<DEPLOYMENT_FEE_CAP);
});
