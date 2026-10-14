import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizePlan} from './dist/chain.mjs';
import {allocate,units} from './dist/money.mjs';
test('prepared two-wallet plan repays expenses over instalments and conserves all units',()=>{
 const draft=JSON.parse(readFileSync(new URL('./dist/two-wallet-plan.json',import.meta.url))),plan=normalizePlan(draft.plan);
 assert.equal(new Set(plan.members.map(m=>m.address)).size,2);
 const first=allocate(plan,plan.expenses.map(e=>units(e.amount)),units(draft.paymentsUSDC[0]));assert.deepEqual(first.remaining,[units('0.0005')]);assert.deepEqual(first.revenue,[0n,0n]);
 const second=allocate(plan,first.remaining,units(draft.paymentsUSDC[1]));assert.deepEqual(second.remaining,[0n]);
 assert.deepEqual(second.credits.map((n,i)=>n+first.credits[i]),draft.expectedFinalCreditsUSDC.map(units));
 assert.equal(second.credits.reduce((a,b)=>a+b,0n)+first.credits.reduce((a,b)=>a+b,0n),units('0.003'));
});
