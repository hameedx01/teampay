import {display} from './money.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function receiptHTML(receipt,title){
 if(String(receipt.chainId)!=='5042'||!/^0x[0-9a-fA-F]{64}$/.test(receipt.transactionHash))throw new Error('Invalid mainnet receipt.');
 const totals=new Map();for(const entry of receipt.allocations){const key=entry.recipient.toLowerCase();const prior=totals.get(key);totals.set(key,{recipient:entry.recipient,amount:(prior?.amount??0n)+BigInt(entry.amount)});}
 if([...totals.values()].reduce((sum,e)=>sum+e.amount,0n)!==BigInt(receipt.amount))throw new Error('Receipt allocation total does not match the payment.');
 const line=(label,value)=>`<div class="allocation"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
 return `<p class="eyebrow">TEAMPAY · CONFIRMED PAYMENT</p><h2>${esc(title)}</h2><p class="receipt-amount">${display(receipt.amount)} USDC</p><p class="fine">Arc Mainnet · Project #${esc(receipt.projectId)} · ${esc(receipt.confirmedAt)} (UTC)</p>${line('Paid by',receipt.payer||receipt.payers.join(', '))}<h3>Allocated to recipients</h3>${[...totals.values()].map(e=>line(e.recipient,display(e.amount)+' USDC')).join('')}${line('Network fee (additional)',display(receipt.transactionFee)+' USDC')}<p class="fine">Expense repayments and revenue shares are combined per recipient above. This receipt confirms payment and allocation; it does not prove withdrawal or act as a tax invoice.</p>${line('Contract',receipt.contract)}${line('Block',receipt.blockNumber)}<p class="fine">Transaction<br><a href="https://explorer.arc.io/tx/${receipt.transactionHash}" target="_blank" rel="noopener noreferrer">${receipt.transactionHash}</a></p>`;
}
