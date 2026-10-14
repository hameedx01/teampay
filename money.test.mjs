import test from 'node:test';
import assert from 'node:assert/strict';
import {units,display,allocate} from './dist/money.mjs';
const plan={members:[{bps:4000},{bps:3500},{bps:2500}],expenses:[{member:0},{member:1}]};
test('partial receipts finish expenses before revenue sharing',()=>{let r=[units('200'),units('100')];for(const amount of ['150','100'])r=allocate(plan,r,units(amount)).remaining;const next=allocate(plan,r,units('350'));assert.deepEqual(next.credits,[units('120'),units('155'),units('75')]);assert.deepEqual(next.remaining,[0n,0n]);});
test('money parsing is exact and rejects invalid input',()=>{assert.equal(units('0.000001'),1n);assert.equal(display(units('1234.01')),'1,234.01');for(const bad of ['-1','Infinity','1e6','1.0000001',''])assert.throws(()=>units(bad));assert.throws(()=>allocate(plan,[0n,0n],0n));});
test('all payment units are allocated, including rounding dust',()=>{for(let i=1n;i<=2000n;i++){const out=allocate(plan,[13n,27n],i);assert.equal(out.credits.reduce((a,b)=>a+b,0n),i);assert(out.remaining.every(n=>n>=0n));}});
test('incorrect share totals cannot create an agreement',()=>assert.throws(()=>allocate({...plan,members:[{bps:5000},{bps:1000},{bps:1000}]},[1n,1n],10n)));
