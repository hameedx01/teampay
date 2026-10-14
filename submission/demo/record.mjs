// Record public pages in an isolated Chrome profile via CDP. Never accesses a wallet.
// Start Chrome with --headless --remote-debugging-port=9227 --user-data-dir=/tmp/teampay-demo-chrome.
// WS_MODULE points to an installed ws ESM wrapper. Frames and audio remain outside the repo.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const {default:WebSocket}=await import(process.env.WS_MODULE);
const scenes=JSON.parse(readFileSync(new URL('./scenes.json',import.meta.url)));
const out=process.env.DEMO_WORKDIR||'/tmp/teampay-video';mkdirSync(out+'/frames',{recursive:true});
const target=await (await fetch('http://127.0.0.1:9227/json/new?about:blank',{method:'PUT'})).json();const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));
let requestId=0,frame=0;const waiting=new Map();ws.on('message',raw=>{const m=JSON.parse(raw);if(m.id){const p=waiting.get(m.id);waiting.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++requestId;waiting.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const project='/workspace?network=5042&contract=0xB8A30476424DF1b2954e9a934a66fC52463C62cD&project=2';
const paths=['/','/','/workspace',project,'/proof/team-payment','/'];
await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
const captions=[];let elapsed=0;
for(let s=0;s<scenes.length;s++){
 const scene=scenes[s];await call('Page.navigate',{url:'https://product-ruby-chi.vercel.app'+paths[s]});await wait(1200);
 for(let n=0;n<120;n++){
  const ready=await evaluate(`document.readyState==='complete' && ${s===2?"document.getElementById('members')?.children.length===2 && !document.getElementById('availability').textContent.includes('Checking')":s===3?"!document.getElementById('project')?.hidden && document.getElementById('title')?.textContent.includes('two-wallet')":"true"}`);
  if(ready)break;if(n===119)throw new Error('Page never ready '+s);await wait(500);
 }
 await evaluate('document.fonts.ready.then(()=>true)');
 await evaluate("document.documentElement.style.setProperty('scroll-behavior','auto','important')");
 if(s===1)await evaluate(`document.querySelector('.receipt-scene').scrollIntoView({block:'center'});`);
 if(s===2)await evaluate(`(()=>{const set=(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));};set(document.querySelector('[name=title]'),'Website for Green Studio');const rows=[...document.querySelectorAll('.member-row')];['Ada','Tobi'].forEach((name,i)=>{set(rows[i].querySelector('[data-field=name]'),name);set(rows[i].querySelector('[data-field=address]'),['0x940D6F7F596Aa65342fE490510b74282156C949B','0xef4D5945A4F48943b74af0957d61638CF645Ad2b'][i]);});document.getElementById('add-expense').click();set(document.querySelector('[data-expense-name]'),'Hosting');set(document.querySelector('[data-expense-amount]'),'60');const select=document.querySelector('[data-expense-member]');select.value=rows[0].dataset.member;select.dispatchEvent(new Event('change',{bubbles:true}));set(document.getElementById('draft-payment'),'300');document.querySelector('.create-layout').scrollIntoView({block:'start'});})()`);
 if(s===3)await evaluate(`document.querySelector('.metrics').scrollIntoView({block:'start'});window.scrollBy(0,-60);`);
 if(s===4)await evaluate(`window.scrollTo(0,0)`);
 if(s===5)await evaluate(`document.querySelector('.closing').scrollIntoView({block:'center'});`);
 const sentences=scene.text.match(/[^.!?]+[.!?]+/g)||[scene.text];const totalWords=sentences.reduce((n,x)=>n+x.trim().split(/\s+/).length,0);let offset=0;
 const cues=sentences.map(sentence=>{const duration=scene.speechDuration*sentence.trim().split(/\s+/).length/totalWords;const cue={start:offset,end:offset+duration,text:sentence.trim().replaceAll('U S D C','USDC').replace('zero point zero zero six','0.006')};offset+=duration;captions.push({...cue,start:elapsed+cue.start,end:elapsed+cue.end});return cue;});
 await evaluate(`(()=>{const style=document.createElement('style');style.textContent='html{scroll-behavior:auto!important} #demo-label{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#173c31;color:#f7f7ee;border:1px solid #7e9f8f;border-radius:30px;padding:10px 22px;font:600 14px system-ui;letter-spacing:1.4px;pointer-events:none;white-space:nowrap}#demo-caption{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);width:1080px;max-width:85vw;background:#173c31f5;color:white;border:1px solid #527568;border-radius:14px;padding:16px 24px;z-index:2147483647;text-align:center;font:500 24px/1.4 system-ui;box-shadow:0 8px 28px #173c3130;pointer-events:none}#demo-click{position:fixed;z-index:2147483646;width:32px;height:32px;border:3px solid #caef77;border-radius:50%;background:#caef7750;pointer-events:none;display:none}';document.head.append(style);for(const id of ['demo-label','demo-caption','demo-click']){const el=document.createElement('div');el.id=id;document.body.append(el);}document.getElementById('demo-label').textContent=${JSON.stringify(scene.label)};})()`);
 const initialY=await evaluate('scrollY');let lastCue='',lastImage;
 for(let n=0;n<Math.round(scene.duration*8);n++){
  const t=n/8;let changed=n===0;
  const cue=cues.find(c=>t>=c.start&&t<c.end)?.text||cues.at(-1).text;
  if(cue!==lastCue){await evaluate(`document.getElementById('demo-caption').textContent=${JSON.stringify(cue)}`);lastCue=cue;changed=true;}
  if(s===1&&(n===16||n===48)){
   const selector=n===16?'[data-payment="30"]':'[data-payment="300"]';
   const box=await evaluate(`(()=>{const e=document.querySelector('${selector}');const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
   await call('Input.dispatchMouseEvent',{type:'mouseMoved',...box});await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box});
   await evaluate(`Object.assign(document.getElementById('demo-click').style,{display:'block',left:'${box.x-16}px',top:'${box.y-16}px'})`);changed=true;
  }
  if(s===1&&(n===22||n===54)){await evaluate("document.getElementById('demo-click').style.display='none'");changed=true;}
  if(s===2&&t>=3&&t<=6){const progress=(t-3)/3,eased=progress*progress*(3-2*progress);await evaluate(`scrollTo(0,${initialY+eased*420})`);changed=true;}
  if(s===4&&t>=5&&t<=7){const p=(t-5)/2;await evaluate(`scrollTo(0,${p*p*(3-2*p)*260})`);changed=true;}
  if(changed){await wait(40);const shot=await call('Page.captureScreenshot',{format:'jpeg',quality:90,captureBeyondViewport:false});lastImage=Buffer.from(shot.data,'base64');}
  writeFileSync(out+'/frames/'+String(frame++).padStart(5,'0')+'.jpg',lastImage);
 }
 console.log('Captured',s,scene.title,scene.duration+'s');elapsed+=scene.duration;
}
const stamp=n=>{const ms=Math.round(n*1000),h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;return [h,m,s].map(n=>String(n).padStart(2,'0')).join(':')+'.'+String(ms%1000).padStart(3,'0');};
writeFileSync(new URL('../../dist/demo/captions.vtt',import.meta.url),'WEBVTT\n\n'+captions.map(c=>stamp(c.start)+' --> '+stamp(c.end)+'\n'+c.text+'\n').join('\n'));
writeFileSync(out+'/capture.json',JSON.stringify({frames:frame,fps:8,duration:elapsed,scenes},null,2));
await call('Page.close');ws.close();
