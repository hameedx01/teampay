import test from 'node:test';
import assert from 'node:assert/strict';
import {units,display,allocate,basisPoints,landingPlan} from './dist/money.mjs';
const plan={members:[{bps:4000},{bps:3500},{bps:2500}],expenses:[{member:0},{member:1}]};
test('partial receipts finish expenses before revenue sharing',()=>{let r=[units('200'),units('100')];for(const amount of ['150','100'])r=allocate(plan,r,units(amount)).remaining;const next=allocate(plan,r,units('350'));assert.deepEqual(next.credits,[units('120'),units('155'),units('75')]);assert.deepEqual(next.remaining,[0n,0n]);});
test('money parsing is exact and rejects invalid input',()=>{assert.equal(units('0.000000000000000001'),1n);assert.equal(display(units('1234.01')),'1,234.01');for(const bad of ['-1','Infinity','1e6','1.0000000000000000001',''])assert.throws(()=>units(bad));assert.throws(()=>allocate(plan,[0n,0n],0n));});
test('all payment units are allocated, including rounding dust',()=>{for(let i=1n;i<=2000n;i++){const out=allocate(plan,[13n,27n],i);assert.equal(out.credits.reduce((a,b)=>a+b,0n),i);assert(out.remaining.every(n=>n>=0n));}});
test('incorrect share totals cannot create an agreement',()=>assert.throws(()=>allocate({...plan,members:[{bps:5000},{bps:1000},{bps:1000}]},[1n,1n],10n)));

test('native USDC precision is preserved without floating point',()=>{
 assert.equal(units('0.000001'),1000000000000n);
 assert.equal(display(1n),'0.000000000000000001');
 assert.equal(units('999999999.123456789123456789'),999999999123456789123456789n);
});
test('share parsing rejects silent rounding and scientific notation',()=>{
 assert.equal(basisPoints('33.33'),3333);
 for(const bad of ['33.333','1e2','0','100.01','-1'])assert.throws(()=>basisPoints(bad));
});
test('final recipient receives all indivisible smallest units',()=>{
 const p={members:[{bps:4000},{bps:3500},{bps:2500}],expenses:[]};
 assert.deepEqual(allocate(p,[],1n).credits,[0n,0n,1n]);
 assert.deepEqual(allocate(p,[],3n).credits,[1n,1n,1n]);
});
test('landing example uses the same accounting rules',()=>{
 assert.deepEqual(allocate(landingPlan,[units('60')],units('300')).credits,['156','84','60'].map(units));
 const partial=allocate(landingPlan,[units('60')],units('30'));
 assert.deepEqual(partial.credits,[units('30'),0n,0n]);
 assert.deepEqual(partial.remaining,[units('30')]);
});
test('malformed expense state cannot allocate funds',()=>{
 for(const remaining of [[-1n,0n],[1n],[]])assert.throws(()=>allocate(plan,remaining,1n));
 assert.throws(()=>allocate({...plan,expenses:[{member:3}]},[1n],1n));
});
