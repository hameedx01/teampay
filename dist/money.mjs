// All accounting uses native USDC's 18-decimal base units, as in ProjectPayments.
export const DECIMALS = 18;
export const SCALE = 10n ** BigInt(DECIMALS);
export function units(value) {
  if (!/^\d{1,9}(\.\d{1,18})?$/.test(String(value))) throw new Error('Enter an amount with up to 18 decimal places.');
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(DECIMALS, '0'));
}
export function display(value) {
  const n = BigInt(value);
  if (n < 0n) throw new Error('Amounts cannot be negative.');
  const fraction = String(n % SCALE).padStart(DECIMALS, '0').replace(/0+$/, '').padEnd(2, '0');
  return `${(n / SCALE).toLocaleString('en-US')}.${fraction}`;
}
export function basisPoints(value) {
  const text = String(value);
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) throw new Error('Use percentages with up to 2 decimal places.');
  const [whole, fraction = ''] = text.split('.');
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (bps < 1 || bps > 10000) throw new Error('Each share must be greater than 0% and at most 100%.');
  return bps;
}
export function validatePlan(plan, remaining) {
  if (!Array.isArray(plan?.members) || plan.members.length < 1 || plan.members.length > 10) throw new Error('Add between 1 and 10 teammates.');
  if (!Array.isArray(plan.expenses) || plan.expenses.length > 10) throw new Error('Use at most 10 expenses.');
  const shares = plan.members.map(m => m.bps);
  if (shares.some(s => !Number.isInteger(s) || s <= 0) || shares.reduce((a,b)=>a+b,0) !== 10000) throw new Error('Shares must total 100%.');
  if (!Array.isArray(remaining) || remaining.length !== plan.expenses.length || remaining.some(v=>BigInt(v)<0n)) throw new Error('Expense balances must match the agreement and cannot be negative.');
  if (plan.expenses.some(e=>!Number.isInteger(e.member)||e.member<0||e.member>=plan.members.length)) throw new Error('Choose a teammate for every expense.');
}
export function allocate(plan, remaining, raw) {
  validatePlan(plan, remaining);
  const amount = BigInt(raw); if (amount <= 0n) throw new Error('Payment must be greater than zero.');
  let rest = amount; const next = remaining.map(BigInt); const credits = plan.members.map(()=>0n); const expenses = next.map(()=>0n);
  plan.expenses.forEach((expense, i) => { const part = rest < next[i] ? rest : next[i]; next[i] -= part; rest -= part; credits[expense.member] += part; expenses[i] = part; });
  const residual = rest; const revenue = credits.map(()=>0n);
  plan.members.forEach((member,i)=> { const part = i === credits.length-1 ? rest : residual * BigInt(member.bps) / 10000n; rest -= part; credits[i] += part; revenue[i] = part; });
  return {remaining:next,credits,expenses,revenue};
}
// The landing example uses the same allocator and explicit percentages as the app.
export const landingPlan = {members:[{name:'Ada',bps:4000},{name:'Tobi',bps:3500},{name:'Sam',bps:2500}],expenses:[{member:0}]};
