import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptHTML} from './dist/receipt.mjs';
const receipt={chainId:'5042',transactionHash:'0x'+'a'.repeat(64),amount:'10000000000000000',transactionFee:'1742020090672141',allocations:[{recipient:'0xABC',amount:'1000000000000000'},{recipient:'0xabc',amount:'9000000000000000'}],payer:'0xpayer',projectId:'1',confirmedAt:'2026-10-14T22:33:31.000Z',contract:'0xcontract',blockNumber:25993773};
test('readable receipt combines expense and share credits without losing precision',()=>{const html=receiptHTML(receipt,'Website');assert.equal((html.match(/<span>0xabc<\/span>/g)||[]).length,1);assert(html.includes('0.01 USDC'));assert(html.includes('0.001742020090672141 USDC'));assert(html.includes('does not prove withdrawal'));});
test('public project labels are escaped in receipt HTML',()=>{const html=receiptHTML(receipt,'<img src=x onerror=alert(1)>');assert(!html.includes('<img'));assert(html.includes('&lt;img'));});
test('wrong network and inconsistent payment totals cannot generate a receipt',()=>{assert.throws(()=>receiptHTML({...receipt,chainId:'1'},'x'),/Invalid/);assert.throws(()=>receiptHTML({...receipt,amount:'1'},'x'),/does not match/);});
