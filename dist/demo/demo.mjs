const video=document.getElementById('demo-video'),status=document.getElementById('player-status');
const time=value=>`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;
try{
 const response=await fetch('/demo/chapters.json');if(!response.ok)throw new Error();const scenes=await response.json();
 const nav=document.querySelector('.chapters'),transcript=document.getElementById('transcript');
 for(const scene of scenes){
  const link=document.createElement('a');link.href=`?t=${scene.start}#watch`;link.dataset.start=scene.start;
  const stamp=document.createElement('span');stamp.textContent=time(scene.start);link.append(stamp,document.createTextNode(scene.title));
  link.onclick=async event=>{event.preventDefault();const seek=()=>{video.currentTime=scene.start;};if(video.readyState>=1)seek();else video.addEventListener('loadedmetadata',seek,{once:true});history.replaceState(null,'',link.href);try{await video.play();status.textContent='';}catch{status.textContent='Press Play to watch this chapter.';}};
  nav.append(link);const heading=document.createElement('h3'),paragraph=document.createElement('p');heading.textContent=`${time(scene.start)} · ${scene.title}`;paragraph.textContent=scene.text;transcript.append(heading,paragraph);
 }
 const initial=Number(new URL(location.href).searchParams.get('t'));if(Number.isFinite(initial)&&initial>0){const seek=()=>{video.currentTime=Math.min(initial,Math.max(0,video.duration-0.1));};if(video.readyState>=1)seek();else video.addEventListener('loadedmetadata',seek,{once:true});}
 video.addEventListener('timeupdate',()=>{const current=scenes.findLastIndex(s=>s.start<=video.currentTime);[...nav.children].forEach((a,i)=>a.setAttribute('aria-current',String(i===current)));});
}catch{status.textContent='Chapter navigation could not load. The video and product links are still available.';}
video.addEventListener('error',()=>{status.textContent='The video could not load. Try the Download MP4 link below.';});
document.getElementById('copy-demo').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+'/demo');status.textContent='Demo link copied.';}catch{status.textContent='Copy this link: '+location.origin+'/demo';}};
