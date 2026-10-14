import {units, display, allocate, landingPlan} from './money.mjs';
const $ = id => document.getElementById(id);
function update() {
  try {
    const raw = $('payment').value.trim();
    if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(raw)) throw new Error('Enter an amount from 0.01 to 999,999.99 USDC (up to 2 decimals).');
    const result = allocate(landingPlan, [units('60')], units(raw));
    $('calc-error').textContent = '';
    $('payment').removeAttribute('aria-invalid');
    const rest = result.revenue.reduce((a,b)=>a+b,0n);
    for (const [id,value] of Object.entries({expense:result.expenses[0],remainder:rest,ada:result.credits[0],tobi:result.credits[1],sam:result.credits[2]})) $(id).textContent=display(value);
    $('calculation').textContent = result.remaining[0] > 0n
      ? `${display(result.expenses[0])} repays Ada. ${display(result.remaining[0])} of the expense carries forward.`
      : `${display(result.expenses[0])} repays Ada. The rest follows the agreed 40% / 35% / 25% shares.`;
  } catch (error) {
    $('calc-error').textContent=error.message;
    $('payment').setAttribute('aria-invalid','true');
    for(const id of ['expense','remainder','ada','tobi','sam']) $(id).textContent='—';
    $('calculation').textContent='Enter a valid payment to see the allocation.';
  }
}
const presets=[...document.querySelectorAll('[data-payment]')];
function reflectPreset(){for(const button of presets)button.setAttribute('aria-pressed',String(button.dataset.payment===$('payment').value.trim()));}
for(const button of presets)button.addEventListener('click',()=>{$('payment').value=button.dataset.payment;update();reflectPreset();});
$('payment').addEventListener('input',()=>{update();reflectPreset();});
update();
