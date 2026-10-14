export function units(value) {
  if (!/^\d{1,9}(\.\d{1,6})?$/.test(String(value))) throw new Error('Enter an amount with up to 6 decimal places.');
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
}
export function display(value) {
  const n = BigInt(value); const fraction = String(n % 1000000n).padStart(6, '0').replace(/0+$/, '').padEnd(2, '0');
  return `${(n / 1000000n).toLocaleString('en-US')}.${fraction}`;
}
export function allocate(plan, remaining, raw) {
  const amount = BigInt(raw); if (amount <= 0n) throw new Error('Payment must be greater than zero.');
  const shares = plan.members.map(m => m.bps);
  if (shares.some(s => !Number.isInteger(s) || s <= 0) || shares.reduce((a,b)=>a+b,0) !== 10000) throw new Error('Shares must total 100%.');
  let rest = amount; const next = remaining.map(BigInt); const credits = plan.members.map(()=>0n); const expenses = next.map(()=>0n);
  plan.expenses.forEach((expense, i) => { const part = rest < next[i] ? rest : next[i]; next[i] -= part; rest -= part; credits[expense.member] += part; expenses[i] = part; });
  const residual = rest; const revenue = credits.map(()=>0n);
  plan.members.forEach((member,i)=> { const part = i === credits.length-1 ? rest : residual * BigInt(member.bps) / 10000n; rest -= part; credits[i] += part; revenue[i] = part; });
  return {remaining:next,credits,expenses,revenue};
}
