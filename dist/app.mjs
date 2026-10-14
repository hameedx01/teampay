import {units,display,allocate,basisPoints,DECIMALS} from './money.mjs';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initial = () => ({title:'Studio launch film',members:[{name:'Tobi',bps:4000},{name:'Ada',bps:3500},{name:'Sam',bps:2500}],expenses:[{name:'Equipment rental',member:0,amount:'200'},{name:'Production materials',member:1,amount:'100'}]});
let plan, remaining, credits, paid, received, shared, history, preview, pendingPlan;
function start(p,seed=false){plan=p;remaining=p.expenses.map(e=>units(e.amount));credits=p.members.map(()=>0n);paid=p.members.map(()=>0n);received=0n;shared=0n;history=[];if(seed){record(units('150'));record(units('100'));}render();}
function record(amount){const result=allocate(plan,remaining,amount);remaining=result.remaining;result.credits.forEach((v,i)=>credits[i]+=v);received+=amount;shared+=result.revenue.reduce((a,b)=>a+b,0n);history.unshift({type:'payment',amount,description:result.credits.map((v,i)=>v>0n?`${plan.members[i].name}: ${display(v)}`:null).filter(Boolean).join(' · '),at:new Date().toISOString()});}
function toast(s){$('toast').textContent=s;$('toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function render(){
 $('project-title').textContent=plan.title;$('crumb').textContent=plan.title;
 const total=plan.expenses.reduce((a,e)=>a+units(e.amount),0n),left=remaining.reduce((a,b)=>a+b,0n);
 for(const [key,value] of Object.entries({received,recovered:total-left,shared}))$(key).innerHTML=`${display(value)} <small>USDC</small>`;
 $('recovery-note').textContent=left?`${display(left)} USDC left to recover`:'All recorded expenses recovered';
 let next=remaining.findIndex(v=>v>0n);if(next<0)next=remaining.length;
 $('stages').innerHTML=plan.expenses.map((e,i)=>{const cap=units(e.amount),done=cap-remaining[i],pct=Number(done*100n/cap);return `<div class="stage"><span class="step ${i<next?'done':i===next?'current':''}">${i<next?'✓':i+1}</span><div class="stage-content"><div class="stage-title"><strong>${esc(e.name)}</strong><span>${display(cap)}</span></div><p class="stage-sub">${i===0?'Paid first':'Paid next'} · ${esc(plan.members[e.member].name)}</p><div class="bar" role="progressbar" aria-label="${esc(e.name)} recovered" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><div class="stage-progress"><span>${display(done)} / ${display(cap)} USDC allocated</span><span>${i<next?'Recovered':`${pct}%`}</span></div></div></div>`;}).join('')+`<div class="stage"><span class="step ${next===remaining.length?'current':''}">3</span><div class="stage-content"><div class="stage-title"><strong>Share remaining income</strong><span>↗</span></div><p class="stage-sub">${left?'Starts after expenses are repaid':'Active · expenses are recovered'}</p><div class="members-inline">${plan.members.map(m=>`<span>${esc(m.name)} <strong>${m.bps/100}%</strong></span>`).join('')}</div></div></div>`;
 $('team-grid').innerHTML=plan.members.map((m,i)=>`<article class="person"><div class="person-head"><span class="avatar a${i}">${esc(m.name.slice(0,1))}</span><strong>${esc(m.name)}</strong><small>${m.bps/100}% remainder</small></div><dl><dt>Available to withdraw</dt><dd>${display(credits[i])}</dd><dt>Paid out in demo</dt><dd>${display(paid[i])}</dd></dl><button data-withdraw="${i}" ${credits[i]===0n?'disabled':''}>Simulate withdrawal ↗</button></article>`).join('');
 $('history').innerHTML=history.length?history.map((h,i)=>`<tr><td>${h.type==='payment'?'Client payment':esc(h.member)+' withdrew'}<small>Demo entry ${history.length-i} · no transaction hash</small></td><td>${esc(h.description)}</td><td>${display(h.amount)} USDC</td><td>${h.type==='payment'?'ALLOCATED · DEMO':'PAID OUT · DEMO'}</td></tr>`).join(''):'<tr><td colspan="4">No payments yet. Preview and record a demo payment to begin.</td></tr>';
 updatePreview();
}
function updatePreview(){try{const amount=units($('amount').value.trim());preview=allocate(plan,remaining,amount);$('preview-error').textContent='';$('record').disabled=false;
 $('preview').innerHTML=plan.members.map((m,i)=>`<div class="preview-row"><span class="avatar a${i}">${esc(m.name[0])}</span><div><p>${esc(m.name)}</p><small>${display(preview.credits[i]-preview.revenue[i])} expenses + ${display(preview.revenue[i])} share</small></div><strong>${display(preview.credits[i])}</strong></div>`).join('');
 const expenses=preview.expenses.reduce((a,b)=>a+b,0n),revenue=preview.revenue.reduce((a,b)=>a+b,0n);
 $('preview-summary').textContent=`${display(expenses)} USDC repays expenses. ${display(revenue)} USDC is shared with the team.`;
 }catch(e){preview=null;$('record').disabled=true;$('preview-error').textContent=e.message;$('preview').innerHTML='';$('preview-summary').textContent='Enter a valid payment to see the breakdown.';}}
 $('amount').addEventListener('input',()=>{document.querySelectorAll('[data-amount]').forEach(b=>b.classList.remove('selected'));updatePreview();});
 document.querySelectorAll('[data-amount]').forEach(b=>b.onclick=()=>{$('amount').value=b.dataset.amount;document.querySelectorAll('[data-amount]').forEach(x=>x.classList.toggle('selected',x===b));updatePreview();});
 $('record').onclick=()=>{if(!preview)return;record(units($('amount').value.trim()));render();toast('Demo payment recorded. Review the updated agreement and balances.');};
 $('team-grid').onclick=e=>{const b=e.target.closest('[data-withdraw]');if(!b)return;const i=Number(b.dataset.withdraw),amount=credits[i];if(!amount)return;credits[i]=0n;paid[i]+=amount;history.unshift({type:'withdrawal',member:plan.members[i].name,amount,description:'Simulated transfer to recipient',at:new Date().toISOString()});render();toast('Demo withdrawal recorded. No real funds moved.');};
 $('reset').onclick=()=>{start(initial(),true);toast('Original example restored.');};
 $('edit').onclick=()=>{$('form-error').textContent='';$('builder').showModal();};$('close').onclick=()=>$('builder').close();
 $('agreement-form').onsubmit=e=>{e.preventDefault();try{const data=new FormData(e.target),get=k=>String(data.get(k)).trim();const members=[0,1,2].map(i=>({name:get(`name${i}`),bps:basisPoints(get(`share${i}`))}));if(members.some(m=>!m.name))throw new Error('Enter a name for each collaborator.');if(!get('title'))throw new Error('Enter a project name.');const expenses=[0,1].map(i=>({name:get(`expense${i}`),member:i,amount:get(`cost${i}`)}));if(expenses.some(e=>!e.name||units(e.amount)<=0n))throw new Error('Enter a label and positive amount for each expense.');const p={title:get('title'),members,expenses};allocate(p,expenses.map(e=>units(e.amount)),1n);pendingPlan=p;showReview();}catch(error){$('form-error').textContent=error.message;}};
 $('export').onclick=()=>{const data={schemaVersion:2,asset:'native USDC',amountDecimals:DECIMALS,rounding:'final recipient receives smallest-unit remainder per payment',prototype:true,network_transactions:false,plan,received,remaining,availableToWithdraw:credits,paidOut:paid,history};const blob=new Blob([JSON.stringify(data,(_,v)=>typeof v==='bigint'?v.toString():v,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='teampay-demo-record.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Demo record exported. Amounts use native USDC base units (18 decimals).');};

function showReview(){
 $('review-title').textContent=pendingPlan.title;
 $('review-content').innerHTML=`<h3>First, repay these expenses</h3><ol class="review-expenses">${pendingPlan.expenses.map(e=>`<li><div><strong>${esc(e.name)}</strong><span>${esc(pendingPlan.members[e.member].name)}</span></div><b>${display(units(e.amount))} USDC</b></li>`).join('')}</ol><h3>Then, share the remainder</h3><div class="review-shares">${pendingPlan.members.map(m=>`<div><span>${esc(m.name)}</span><strong>${m.bps/100}%</strong></div>`).join('')}</div>`;
 $('review-ack').checked=false;
 $('builder').close();
 updateReview();
 $('review-dialog').showModal();
}
function updateReview(){
 if(!pendingPlan)return;
 try{
  const result=allocate(pendingPlan,pendingPlan.expenses.map(e=>units(e.amount)),units($('review-amount').value.trim()));
  $('review-error').textContent='';$('review-start').disabled=false;
  $('review-allocation').innerHTML=`<div class="review-shares">${pendingPlan.members.map((m,i)=>`<div><span>${esc(m.name)}<small>${display(result.credits[i]-result.revenue[i])} expenses + ${display(result.revenue[i])} share</small></span><strong>${display(result.credits[i])} USDC</strong></div>`).join('')}</div>`;
 }catch(error){$('review-error').textContent=error.message;$('review-allocation').innerHTML='';$('review-start').disabled=true;}
}
$('review-amount').addEventListener('input',updateReview);
function backToDetails(){$('review-dialog').close();$('builder').showModal();}
$('review-back').onclick=backToDetails;
$('review-close').onclick=backToDetails;
$('review-dialog').addEventListener('cancel',event=>{event.preventDefault();backToDetails();});
$('review-form').onsubmit=event=>{event.preventDefault();if(!pendingPlan||!$('review-ack').checked||$('review-start').disabled)return;start(pendingPlan);pendingPlan=null;$('review-dialog').close();$('edit').focus();toast('Local agreement started. No real payment or signature was made.');};
 start(initial(),true);
