'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOW=(navigator.hardwareConcurrency||4)<=4;
const MAX=100000; // max link length (characters)
const st={data:null,mode:'build',stages:[],i:0,photos:[],link:'',tm:0,ck:0,popped:0};
const bad=m=>Object.assign(new Error(m),{ok:1});
const fmt=d=>new Date(d+'T00:00:00').toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'});

/* ---------- encoding + validation ---------- */
const enc=o=>{const b=new TextEncoder().encode(JSON.stringify(o));let s='';b.forEach(x=>s+=String.fromCharCode(x));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const dec=t=>{const s=atob(t.replace(/-/g,'+').replace(/_/g,'/'));return JSON.parse(new TextDecoder().decode(Uint8Array.from(s,c=>c.charCodeAt(0))))};
function clean(d){
  if(!d||typeof d!=='object'||d.v!==1)throw bad('This link was made with a different version of the site.');
  const str=(x,n)=>typeof x==='string'?x.trim().slice(0,n):'';
  const o={v:1,to:str(d.to,40),from:str(d.from,40),age:Math.round(+d.age),
    date:/^\d{4}-\d{2}-\d{2}$/.test(d.date)&&!isNaN(new Date(d.date))?d.date:'',
    theme:['violet','rose','ocean'].includes(d.theme)?d.theme:'violet',cd:d.cd?1:0,
    notes:(Array.isArray(d.notes)?d.notes:[]).slice(0,6).map(n=>str(n,90)).filter(Boolean),
    letter:str(d.letter,900),
    photos:(Array.isArray(d.photos)?d.photos:[]).slice(0,5).filter(p=>p&&typeof p.s==='string'&&p.s.length<30000&&/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(p.s)).map(p=>({s:p.s,c:str(p.c,80)}))};
  if(!o.to)throw bad('Add the name of the person you’re celebrating.');
  if(!o.from)throw bad('Add your name so they know who it’s from.');
  if(!(o.age>=1&&o.age<=120))throw bad('Enter an age between 1 and 120.');
  return o;
}
function readForm(){
  return clean({v:1,to:$('#f-to').value,from:$('#f-from').value,age:$('#f-age').value,date:$('#f-date').value,
    theme:$('#f-theme').value,cd:$('#f-cd').checked,notes:$('#f-notes').value.split('\n'),letter:$('#f-letter').value,
    photos:st.photos.map(p=>({s:p.s,c:p.c}))});
}
function makeLink(){
  const l=location.href.split('#')[0]+'#draft='+enc(readForm());
  if(l.length>MAX)throw bad('That’s too much for one link. Remove a photo or two and try again.');
  return l;
}

/* ---------- UI helpers ---------- */
const msg=t=>{$('#formMsg').textContent=t||''};
let tt;const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('on'),2600)};
function words(el,t){el.textContent='';t.split(' ').forEach((w,i)=>{const s=document.createElement('span');s.className='w';s.style.setProperty('--i',i);s.textContent=w;el.append(s,' ')})}
function flash(){const b=document.body;b.classList.remove('bloom');void b.offsetWidth;b.classList.add('bloom');setTimeout(()=>b.classList.remove('bloom'),1900)}
function show(id){document.body.dataset.stage=id;$$('.stage').forEach(s=>s.classList.toggle('on',s.id==='s-'+id));scrollTo(0,0);const h=$('#s-'+id+' h1');h&&h.focus({preventScroll:true})}
async function copy(t){
  try{await navigator.clipboard.writeText(t);toast('Link copied');return}catch{}
  const a=document.createElement('textarea');a.value=t;a.style.cssText='position:fixed;opacity:0';document.body.append(a);a.select();
  let ok=false;try{ok=document.execCommand('copy')}catch{}a.remove();
  toast(ok?'Link copied':'Couldn’t copy. Select the link and copy it by hand.');
}
function currentLink(){
  if(st.mode==='view')return location.href;
  try{st.link=makeLink();return st.link}catch(e){toast(e.ok?e.message:'Couldn’t build the link.');return ''}
}
async function share(url){
  if(!url)return;
  if(navigator.share){try{await navigator.share({title:'A birthday surprise',text:'I made something for you.',url});return}catch(e){if(e.name==='AbortError')return}}
  copy(url);
}

/* ---------- photos ---------- */
function shrink(f){return new Promise((res,rej)=>{
  const u=URL.createObjectURL(f),im=new Image();
  im.onload=()=>{const r=Math.min(1,300/Math.max(im.width,im.height)),c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(im.width*r));c.height=Math.max(1,Math.round(im.height*r));
    c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);
    let q=.6,s;do{s=c.toDataURL('image/jpeg',q);q-=.1}while(s.length>24000&&q>.2);res(s)};
  im.onerror=()=>{URL.revokeObjectURL(u);rej()};im.src=u})}
function renderPhotos(){
  const ul=$('#plist');ul.textContent='';
  st.photos.forEach((p,i)=>{
    const li=document.createElement('li'),im=new Image(),inp=document.createElement('input'),b=document.createElement('button');
    im.src=p.s;im.alt='';inp.value=p.c;inp.maxLength=80;inp.placeholder='Caption (optional)';inp.setAttribute('aria-label','Caption for photo '+(i+1));
    inp.oninput=()=>{p.c=inp.value};
    b.type='button';b.className='btn ghost sm';b.textContent='Remove';b.setAttribute('aria-label','Remove photo '+(i+1));
    b.onclick=()=>{st.photos.splice(i,1);renderPhotos()};
    li.append(im,inp,b);ul.append(li)});
}
$('#f-photos').onchange=async e=>{
  msg('');
  for(const f of e.target.files){
    if(st.photos.length>=5){msg('Five photos is the limit.');break}
    if(!f.type.startsWith('image/')){msg(f.name+' isn’t an image.');continue}
    try{st.photos.push({s:await shrink(f),c:''})}catch{msg('Couldn’t read '+f.name+'.')}
  }
  e.target.value='';renderPhotos();
};

/* ---------- audio ---------- */
const A={ac:null,m:null,muted:false,on:false,n:0,tm:0,el:null,url:''};
function au(){
  if(!A.ac){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
    A.ac=new C();A.m=A.ac.createGain();A.m.gain.value=A.muted?0:.8;A.m.connect(A.ac.destination)}
  if(A.ac.state==='suspended')A.ac.resume();return A.ac;
}
function tn(f,t,d,type,v,to){
  const c=A.ac,o=c.createOscillator(),g=c.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);
  if(to)o.frequency.exponentialRampToValueAtTime(to,t+d);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v||.15,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g);g.connect(A.m);o.start(t);o.stop(t+d+.05);
}
const fx=fn=>{const c=au();if(c)fn(c.currentTime)};
const sfx={
  pop:()=>fx(t=>tn(520,t,.14,'sine',.3,70)),
  letter:()=>fx(t=>{tn(392,t,.5,'triangle',.12);tn(587,t+.15,.7,'triangle',.12)}),
  cut:()=>fx(t=>{tn(900,t,.2,'triangle',.18,300);tn(523,t+.2,.6,'triangle',.12)}),
  party:()=>fx(t=>[523,659,784,1047].forEach((f,i)=>tn(f,t+i*.09,.6,'triangle',.13))),
  blow:()=>fx(t=>{const c=A.ac,b=c.createBuffer(1,c.sampleRate*.4,c.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
    const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();f.type='lowpass';f.frequency.value=900;g.gain.value=.25;
    s.buffer=b;s.connect(f);f.connect(g);g.connect(A.m);s.start(t)})
};
const CH=[[261.63,329.63,392,523.25],[196,246.94,293.66,392],[220,261.63,329.63,440],[174.61,220,261.63,349.23]];
function bar(){const t=A.ac.currentTime+.05,ch=CH[A.n++%4];
  [0,1,2,3,2,1,2,1].forEach((k,i)=>tn(ch[k],t+i*.3,1.4,'triangle',.05));tn(ch[0]/2,t,2.2,'sine',.06)}
function audioUI(){
  $('#btnMusic').textContent=A.on?'Pause music':'Play music';$('#btnMusic').setAttribute('aria-pressed',A.on);
  $('#btnMute').textContent=A.muted?'Unmute':'Mute';$('#btnMute').setAttribute('aria-pressed',A.muted);
}
function startMusic(){
  if(A.on)return;
  if(A.el){A.el.play().then(()=>{A.on=true;audioUI()}).catch(()=>toast('Tap Play music to start the sound.'));return}
  if(!au()){toast('This browser can’t play audio.');return}
  A.on=true;A.n=0;bar();A.tm=setInterval(bar,2400);audioUI();
}
function stopMusic(){A.on=false;clearInterval(A.tm);A.el&&A.el.pause();audioUI()}
$('#btnMusic').onclick=()=>A.on?stopMusic():startMusic();
$('#btnMute').onclick=()=>{A.muted=!A.muted;if(A.m)A.m.gain.value=A.muted?0:.8;if(A.el)A.el.muted=A.muted;audioUI()};
$('#f-music').onchange=e=>{
  const f=e.target.files[0];stopMusic();if(A.url)URL.revokeObjectURL(A.url);A.el=null;A.url='';if(!f)return;
  if(!f.type.startsWith('audio/')){msg('Choose an audio file.');e.target.value='';return}
  A.url=URL.createObjectURL(f);A.el=new Audio(A.url);A.el.loop=true;A.el.muted=A.muted;msg('');
};

/* ---------- confetti ---------- */
const cv=$('#fx'),cx=cv.getContext('2d');let ps=[],raf=0;
function fit(){const r=Math.min(devicePixelRatio||1,2);cv.width=innerWidth*r;cv.height=innerHeight*r;cx.setTransform(r,0,0,r,0,0)}
addEventListener('resize',fit);fit();
function confetti(){
  const n=RM?20:LOW?60:110,cols=['#f2dcb3','#d85a7f','#8c2146','#6b4cc4','#fff3d6'];
  for(let i=0;i<n;i++)ps.push({x:innerWidth/2+(Math.random()-.5)*innerWidth*.3,y:innerHeight*.5,vx:(Math.random()-.5)*14,vy:-Math.random()*14-4,r:Math.random()*5+3,a:Math.random()*6,va:(Math.random()-.5)*.4,c:cols[i%5]});
  if(!raf)raf=requestAnimationFrame(loop);
}
function loop(){
  cx.clearRect(0,0,innerWidth,innerHeight);ps=ps.filter(p=>p.y<innerHeight+20);
  for(const p of ps){p.vy+=.35;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.a+=p.va;
    cx.save();cx.translate(p.x,p.y);cx.rotate(p.a);cx.fillStyle=p.c;cx.fillRect(-p.r,-p.r/2,p.r*2,p.r);cx.restore()}
  raf=ps.length?requestAnimationFrame(loop):0;
}

/* ---------- stage flow ---------- */
const E={};
function go(n){
  clearInterval(st.tm);document.body.classList.remove('spot');st.i=n;const nm=st.stages[n];
  $('#progFill').style.width=(n/Math.max(st.stages.length-1,1)*100)+'%';
  E[nm]();show(nm);
}
const next=()=>go(st.i+1);
function begin(){
  const d=st.data;document.body.dataset.theme=d.theme;
  st.stages=['cake'];
  if(d.notes.length)st.stages.push('balloons');
  if(d.photos.length)st.stages.push('gallery');
  if(d.letter)st.stages.push('letter');
  st.stages.push('final');
  if(d.cd&&d.date&&new Date(d.date+'T00:00:00')>Date.now())st.stages.unshift('count');
  $('#bar').hidden=false;$('#btnEdit').hidden=st.mode!=='preview';
  startMusic();go(0);
}
function toBuilder(){
  stopMusic();clearInterval(st.tm);$('#bar').hidden=true;st.mode='build';
  document.body.dataset.theme=$('#f-theme').value;show('build');
}

E.count=()=>{
  const d=st.data,t=new Date(d.date+'T00:00:00');words($('#cdH'),d.to+'’s birthday is on its way');
  const tick=()=>{const ms=Math.max(0,t-Date.now()),s=Math.floor(ms/1e3),p=n=>String(n).padStart(2,'0');
    $('#cd').textContent=`${Math.floor(s/86400)} days ${p(Math.floor(s%86400/3600))}h ${p(Math.floor(s%3600/60))}m ${p(s%60)}s`;
    $('#cdBtn').textContent=ms>0?'Open early':'Open the gift'};
  tick();st.tm=setInterval(tick,1000);
};
E.cake=()=>{
  const d=st.data,n=Math.min(d.age,7),g=$('#candles'),NS='http://www.w3.org/2000/svg';g.textContent='';
  for(let i=0;i<n;i++){
    const x=n===1?150:85+i*(130/(n-1)),c=document.createElementNS(NS,'g');
    c.setAttribute('class','candle');c.setAttribute('tabindex','0');c.setAttribute('role','button');c.setAttribute('aria-label','Blow out candle '+(i+1));
    c.innerHTML=`<circle class="gl" cx="${x}" cy="62" r="22"/><rect x="${x-4}" y="74" width="8" height="34" rx="2" fill="#f7e7c6"/><path class="fl" d="M${x} 50c7 8 7 15 0 22c-7-7-7-14 0-22z"/>`;
    g.append(c);
  }
  st.ck=0;document.body.style.setProperty('--lit',1);words($('#cakeH'),d.to+', it’s your moment');
  $('#cakeP').textContent='Tap each flame, or blow them all out at once.';$('#cakeBtn').textContent='Blow them all out';
};
function blow(c){
  if(st.ck!==0||c.classList.contains('out'))return;
  c.classList.add('out');document.body.style.setProperty('--lit',$$('#candles .candle:not(.out)').length/$$('#candles .candle').length);c.removeAttribute('tabindex');c.removeAttribute('role');sfx.blow();
  if(!$('#candles .candle:not(.out)')){st.ck=1;$('#cakeP').textContent='Close your eyes and make a wish.';$('#cakeBtn').textContent='Make a wish'}
}
$('#candles').addEventListener('click',e=>{const c=e.target.closest('.candle');c&&blow(c)});
$('#candles').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const c=e.target.closest('.candle');if(c){e.preventDefault();blow(c)}}});
$('#cakeBtn').onclick=()=>{
  if(st.ck===0)$$('#candles .candle').forEach((c,i)=>setTimeout(()=>blow(c),i*160));
  else if(st.ck===1){st.ck=2;confetti();sfx.party();flash();$('#cakeP').textContent='Wish made. Now cut the cake.';$('#cakeBtn').textContent='Cut the cake'}
  else if(st.ck===2){sfx.cut();next()}
};

E.balloons=()=>{
  const N=st.data.notes,sky=$('#sky');sky.textContent='';st.popped=0;
  words($('#balH'),'A few notes for '+st.data.to);$('#balBtn').hidden=true;$('#noteCard').textContent='Tap a balloon to read what’s inside.';
  N.forEach((t,i)=>{
    const b=document.createElement('button');b.type='button';b.className='bl';
    b.style.setProperty('--x',(N.length===1?50:12+i*(76/(N.length-1)))+'%');
    b.style.setProperty('--y',['0px','60px','25px'][i%3]);b.style.setProperty('--h',[345,330,38,265,355,290][i]);b.style.setProperty('--d',(i*.6)+'s');b.style.setProperty('--t',(4.2+(i*1.3)%3)+'s');b.style.setProperty('--r',(i%2?6:-6)+'deg');b.style.setProperty('--s',.82+(i%3)*.16);
    b.setAttribute('aria-label','Balloon '+(i+1)+' of '+N.length);
    b.onclick=()=>{b.disabled=true;sfx.pop();const nc=$('#noteCard');nc.textContent=t;nc.classList.remove('rev');void nc.offsetWidth;nc.classList.add('rev');if(++st.popped===N.length)$('#balBtn').hidden=false};
    sky.append(b);
  });
};
$('#balBtn').onclick=next;

E.gallery=()=>{
  const el=$('#slides');el.textContent='';el.scrollLeft=0;
  st.data.photos.forEach((p,i)=>{
    const f=document.createElement('figure'),im=new Image(),c=document.createElement('figcaption');
    f.className='slide';im.src=p.s;im.alt=p.c||'Memory '+(i+1);c.textContent=p.c;f.append(im,c);el.append(f)});
  upd();
};
const slides=$('#slides'),n=()=>st.data.photos.length;
const step=()=>{const f=slides.firstElementChild;return f?f.offsetWidth+16:1};
function upd(){const k=Math.round(slides.scrollLeft/step());$('#galCount').textContent=(k+1)+' of '+n();[...slides.children].forEach((s,i)=>s.classList.toggle('cur',i===k))}
function slide(d){slides.scrollBy({left:d*step(),behavior:RM?'auto':'smooth'})}
slides.addEventListener('scroll',upd);
slides.addEventListener('keydown',e=>{if(e.key==='ArrowRight')slide(1);if(e.key==='ArrowLeft')slide(-1)});
$('#galPrev').onclick=()=>slide(-1);$('#galNext').onclick=()=>slide(1);$('#galBtn').onclick=next;

E.letter=()=>{
  $('#env').hidden=false;$('#env').classList.remove('open');$('#openLet').hidden=false;
  $('#sheet').hidden=true;$('#sheet').classList.remove('typing');$('#letBtn').hidden=true;$('#sig').hidden=true;$('#letterText').textContent='';
};
$('#openLet').onclick=()=>{
  const full=st.data.letter,tx=$('#letterText'),sh=$('#sheet');
  $('#openLet').hidden=true;document.body.classList.add('spot');$('#env').classList.add('open');sfx.letter();
  $('#letterFull').textContent=full;$('#sig').textContent='With love, '+st.data.from;
  setTimeout(()=>{
    $('#env').hidden=true;sh.hidden=false;let k=0;
    const done=()=>{clearInterval(st.tm);tx.textContent=full;sh.classList.remove('typing');$('#sig').hidden=false;$('#letBtn').hidden=false};
    sh.onclick=done;
    if(RM){done();return}
    sh.classList.add('typing');
    st.tm=setInterval(()=>{tx.textContent=full.slice(0,++k);if(k>=full.length)done()},32);
  },RM?0:900);
};
$('#letBtn').onclick=next;

E.final=()=>{
  const d=st.data;words($('#finH'),'Happy birthday, '+d.to);$('#s-final').dataset.age=d.age;$('#finP').textContent='Here’s to '+d.age+'. With love, '+d.from+'.';
  $('#finD').textContent=d.date?fmt(d.date):'';$('#fEdit').hidden=st.mode!=='preview';$('#fMake').hidden=st.mode!=='view';flash();
  sfx.party();confetti();
};
$('#fShare').onclick=()=>share(currentLink());
$('#fCopy').onclick=()=>{const l=currentLink();l&&copy(l)};
$('#fMore').onclick=()=>{confetti();sfx.party()};
$('#fReplay').onclick=()=>go(0);
$('#fEdit').onclick=toBuilder;$('#btnEdit').onclick=toBuilder;
function makeOwn(){history.replaceState(null,'',location.href.split('#')[0]);stopMusic();$('#bar').hidden=true;st.mode='build';document.body.dataset.theme=$('#f-theme').value;show('build')}
$('#fMake').onclick=makeOwn;$('#errMake').onclick=makeOwn;
$('#cdBtn').onclick=next;

/* ---------- builder ---------- */
$('#f-theme').onchange=e=>{document.body.dataset.theme=e.target.value};
$('#form').onsubmit=e=>{
  e.preventDefault();
  try{st.data=readForm();st.mode='preview';msg('');begin()}
  catch(x){msg(x.ok?x.message:'Something went wrong. Check your details and try again.')}
};
$('#btnLink').onclick=()=>{
  try{const l=makeLink();st.link=l;$('#linkOut').value=l;$('#linkBox').hidden=false;msg('Link ready ('+Math.ceil(l.length/1024)+' KB).')}
  catch(x){msg(x.ok?x.message:'Couldn’t build the link.')}
};
$('#btnCopy').onclick=()=>copy($('#linkOut').value);
$('#btnShare').onclick=()=>share($('#linkOut').value);

/* ---------- start ---------- */
function init(){
  const m=/^#draft=([\w-]+)$/.exec(location.hash);
  if(!m){show('build');return}
  try{
    if(m[1].length>MAX)throw bad('This link is longer than the site accepts.');
    st.data=clean(dec(m[1]));st.mode='view';document.body.dataset.theme=st.data.theme;
    words($('#introH'),st.data.from+' made a birthday surprise for '+st.data.to);show('intro');
  }catch(x){
    $('#errMsg').textContent=x.ok?x.message:'It looks damaged or cut off. Ask the sender to copy it again.';show('error');
  }
}
$('#introBtn').onclick=begin;
addEventListener('hashchange',()=>location.reload());
if(!RM){const d=$('#dust');for(let i=0;i<(LOW?4:8);i++){const s=document.createElement('span'),z=2+Math.random()*3;
  s.style.cssText=`left:${Math.random()*100}%;width:${z}px;height:${z}px;animation-duration:${12+Math.random()*14}s;animation-delay:${-Math.random()*20}s`;d.append(s)}}
init();
