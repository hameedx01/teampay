import {loadWalletProjects} from './project-library.mjs';
import {DRAFT_KEY,parseDraft,serializeDraft,hasDraftContent} from './drafts.mjs';
export function initWorkspaceExtras({$,esc,getContext,appendMember,appendExpense,updateRecipients,updateExpenseControls,updateDraft}){
 let version=0,rows=[],next=null,end=null,account=null,loading=false,suspended=false,needsDecision=false;
 const list=$('my-projects-list'),note=$('my-projects-status');
 function resetLibrary(){if(account&&account===getContext().account?.toLowerCase()&&!getContext().disconnected)return;version++;rows=[];next=null;end=null;account=null;loading=false;list.replaceChildren();note.textContent='Connect a wallet to find your agreements.';$('projects-more').hidden=true;$('projects-refresh').disabled=false;}
 async function refreshLibrary(){
  const ctx=getContext();if(loading)return;if(!ctx.account||ctx.disconnected){resetLibrary();return;}
  if(!ctx.reader||!ctx.client||!ctx.artifact||!ctx.config){note.textContent='Payment tools are still loading. Try again shortly.';return;}
  if(account!==ctx.account.toLowerCase()){resetLibrary();account=ctx.account.toLowerCase();}
  const active=version;loading=true;$('projects-refresh').disabled=true;$('projects-more').disabled=true;note.textContent='Searching confirmed agreements…';
  try{
   const page=await loadWalletProjects(ctx.reader,ctx.client,ctx.artifact,ctx.config.contract,ctx.account,{fromBlock:next??(end===null?ctx.config.deploymentBlock:end+1)});
   if(active!==version||getContext().account?.toLowerCase()!==account)return;
   rows=[...new Map([...rows,...page.projects].map(p=>[p.id,p])).values()].sort((a,b)=>b.block-a.block);end=page.toBlock;next=page.nextBlock;
   list.innerHTML=rows.map(p=>{const link=new URL(location.origin+location.pathname);link.searchParams.set('network','5042');link.searchParams.set('contract',ctx.config.contract);link.searchParams.set('project',p.id);return `<article class="payment-entry"><div><strong>${esc(p.title)}</strong><small>Project #${esc(p.id)} · ${p.roles.map(esc).join(' · ')}</small></div><a class="activity-project" href="${esc(link.href)}">Open project ↗</a></article>`;}).join('');
   note.textContent=`${rows.length} agreement${rows.length===1?'':'s'} found for this wallet. ${next===null?'Search complete through block '+end.toLocaleString()+'.':'More blocks remain. Continue searching to find later agreements.'}`;
   if(!rows.length)list.innerHTML='<p class="fine">'+(next===null?'No matching agreements found in the searched contract history.':'No matching agreements in these blocks yet.')+'</p>';
   $('projects-more').hidden=next===null;
  }catch(error){if(active===version)note.textContent='Could not finish the project search. '+error.message+' Try again; no funds were moved.';}
  finally{if(active===version){loading=false;$('projects-refresh').disabled=false;$('projects-more').disabled=false;}}
 }
 $('show-projects').onclick=()=>{$('my-projects').hidden=false;void refreshLibrary();};$('projects-refresh').onclick=()=>void refreshLibrary();$('projects-more').onclick=()=>void refreshLibrary();
 const savedBox=$('saved-draft'),savedNote=$('saved-draft-note');
 function readForm(){const members=[...$('members').children];return {version:1,title:$('project-form').elements.title.value,preview:$('draft-payment').value,members:members.map(r=>({name:r.querySelector('[data-field=name]').value,address:r.querySelector('[data-field=address]').value,share:r.querySelector('[data-field=share]').value})),expenses:[...$('expenses').children].map(r=>({name:r.querySelector('[data-expense-name]').value,amount:r.querySelector('[data-expense-amount]').value,member:members.findIndex(m=>m.dataset.member===r.querySelector('select').value)}))};}
 function offerDraft(){try{const raw=localStorage.getItem(DRAFT_KEY);needsDecision=Boolean(raw);savedBox.hidden=!raw;$('restore-draft').hidden=!raw;if(raw){try{parseDraft(raw);savedNote.textContent='An unfinished agreement is saved on this device. Restore it or discard it before this form is saved.';$('restore-draft').disabled=false;}catch{savedNote.textContent='The saved draft could not be read. Discard it to start saving a new draft.';$('restore-draft').disabled=true;}}}catch{needsDecision=false;savedBox.hidden=false;savedNote.textContent='This browser cannot save drafts. Keep this tab open until you finish.';$('restore-draft').hidden=true;}}
 function fillForm(data){suspended=true;try{$('members').replaceChildren();$('expenses').replaceChildren();$('project-form').elements.title.value=data.title;for(const member of data.members){appendMember(false);const row=$('members').lastElementChild;for(const field of ['name','address','share'])row.querySelector(`[data-field=${field}]`).value=member[field];}updateRecipients();for(const expense of data.expenses){appendExpense(false);const row=$('expenses').lastElementChild;row.querySelector('[data-expense-name]').value=expense.name;row.querySelector('[data-expense-amount]').value=expense.amount;row.querySelector('select').value=expense.member>=0?$('members').children[expense.member].dataset.member:'';}$('draft-payment').value=data.preview;updateExpenseControls();updateDraft();}finally{suspended=false;}}
 function saveDraft(){if(suspended||needsDecision||$('setup').hidden)return;try{const data=readForm();if(!hasDraftContent(data)){localStorage.removeItem(DRAFT_KEY);savedBox.hidden=true;return;}localStorage.setItem(DRAFT_KEY,serializeDraft(data));savedBox.hidden=false;savedNote.textContent='Draft saved on this device. Names and wallet addresses stay in this browser until you publish.';$('restore-draft').hidden=true;}catch{savedBox.hidden=false;savedNote.textContent='This draft could not be saved. Keep this tab open until you finish.';}}
 $('restore-draft').onclick=()=>{if(getContext().busy)return;try{const data=parseDraft(localStorage.getItem(DRAFT_KEY));fillForm(data);needsDecision=false;saveDraft();}catch{savedNote.textContent='Could not restore this draft. Discard it to start again.';}};
 $('discard-draft').onclick=()=>{if(getContext().busy)return;try{localStorage.removeItem(DRAFT_KEY);needsDecision=false;savedBox.hidden=true;}catch{savedNote.textContent='The browser could not remove the saved draft.';}};
 function draftSnapshot(){if(needsDecision)return null;try{return localStorage.getItem(DRAFT_KEY);}catch{return null;}}
 function clearPublishedDraft(snapshot){try{if(snapshot&&localStorage.getItem(DRAFT_KEY)===snapshot){localStorage.removeItem(DRAFT_KEY);needsDecision=false;savedBox.hidden=true;}}catch{}}
 function newProject(){fillForm({title:'',preview:'300',members:[{name:'',address:'',share:'50.00'},{name:'',address:'',share:'50.00'}],expenses:[]});offerDraft();}
 offerDraft();return {resetLibrary,refreshLibrary,saveDraft,draftSnapshot,clearPublishedDraft,newProject};
}
