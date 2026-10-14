const $ = id => document.getElementById(id);
const format = n => `${n / 100n}.${String(n % 100n).padStart(2, '0')}`;
$('payment').addEventListener('input', () => {
  const raw = $('payment').value.trim();
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(raw) || Number(raw) <= 0) {
    $('calc-error').textContent = 'Enter an amount from 0.01 to 999,999.99 USDC (up to 2 decimals).';
    $('payment').setAttribute('aria-invalid', 'true');
    for (const id of ['expense', 'remainder', 'ada', 'tobi', 'sam']) $(id).textContent = '—';
    $('calculation').textContent = 'Enter a valid payment to see the allocation.';
    return;
  }
  $('calc-error').textContent = '';
  $('payment').removeAttribute('aria-invalid');
  const [whole, decimals = ''] = raw.split('.');
  const amount = BigInt(whole) * 100n + BigInt(decimals.padEnd(2, '0'));
  const expense = amount < 6000n ? amount : 6000n;
  const rest = amount - expense;
  const share = rest / 3n;
  const extra = rest % 3n;
  const ada = share + (extra > 0n ? 1n : 0n);
  const tobi = share + (extra > 1n ? 1n : 0n);
  for (const [id, value] of Object.entries({expense, remainder: rest, ada: expense + ada, tobi, sam: share})) $(id).textContent = format(value);
  $('calculation').textContent = amount < 6000n
    ? `${format(expense)} repays Ada. ${format(6000n - expense)} of the expense carries forward.`
    : `${format(expense)} repays Ada. The rest is split equally${extra ? ', with leftover cents assigned to Ada, then Tobi' : ''}.`;
});
