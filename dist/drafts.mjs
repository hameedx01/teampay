export const DRAFT_KEY='teampay.arc-mainnet.draft.v1';
// Partial drafts intentionally accept incomplete addresses and percentages; publishing still validates the agreement.
export function parseDraft(raw){
 if(typeof raw!=='string'||raw.length>30000)throw new Error('Draft is too large.');
 const value=JSON.parse(raw);if(value.version!==1||!Array.isArray(value.members)||value.members.length<1||value.members.length>10||!Array.isArray(value.expenses)||value.expenses.length>10)throw new Error('Unsupported saved draft.');
 const text=(v,max)=>{if(typeof v!=='string'||v.length>max)throw new Error('Invalid draft field.');return v;};
 return {version:1,title:text(value.title,70),preview:text(value.preview,60),members:value.members.map(m=>({name:text(m.name,30),address:text(m.address,100),share:text(m.share,30)})),expenses:value.expenses.map(e=>{if(!Number.isInteger(e.member)||e.member< -1||e.member>=value.members.length)throw new Error('Invalid draft recipient.');return {name:text(e.name,40),amount:text(e.amount,60),member:e.member};})};
}
export function serializeDraft(value){return JSON.stringify(parseDraft(JSON.stringify({...value,version:1})));}
export function hasDraftContent(value){return Boolean(value.title.trim()||value.members.some(m=>m.name.trim()||m.address.trim())||value.expenses.length);}
