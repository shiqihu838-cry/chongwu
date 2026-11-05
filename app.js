/* Parameter controls and SVG creature renderer. */
'use strict';
const $ = id => document.getElementById(id);
const SPECIES = [
  {id:'star', name:'绯焰', label:'星芒泡泡', color:'#ef829d', icon:'M25 2 32 13 45 10 42 23 52 30 40 36 40 49 28 45 18 55 17 42 5 43 9 31 0 24 13 18 11 6 23 11Z'},
  {id:'capsule', name:'橘光', label:'胶囊泡泡', color:'#efc56c', icon:'M15 12H40C60 12 60 39 40 39H29L18 46 21 39H15C-4 39-4 12 15 12Z'},
  {id:'round', name:'青芽', label:'圆形泡泡', color:'#75cba1', icon:'M27 3A23 23 0 1 1 17 47L9 54 9 39A23 23 0 0 1 27 3Z'},
  {id:'square', name:'澄蓝', label:'方形泡泡', color:'#74cddd', icon:'M8 6H46Q50 6 50 10V42Q50 46 46 46H26L15 54V46H8Q4 46 4 42V10Q4 6 8 6Z'},
  {id:'flower', name:'绮梦', label:'花朵泡泡', color:'#b495e0', icon:'M27 5C38-5 42 9 42 14C60 10 61 28 49 31C61 44 43 55 36 45C32 62 15 56 17 44C1 51-7 34 7 28C-4 16 11 3 19 13C18 4 22 1 27 5Z'}
];
const DEFAULT = {species:'square',color:'#74cddd',saturation:70,height:110,width:105,horns:1,arms:45,legs:50,gait:'walk',speed:48,emotion:'curious'};
const GAITS = [{id:'walk',name:'漫步'},{id:'bounce',name:'蹦跳'},{id:'sway',name:'摇摆'},{id:'float',name:'漂浮'}];
const DATA_DEFAULT = {chat:28,people:12,steps:6800,exercise:35,regularity:75};
const DATA_DEFS = [
  {key:'chat',label:'每日聊天频次',max:100,step:1,unit:'次',map:'饱和度 · 表情',low:'偶尔说说',high:'聊得火热'},
  {key:'people',label:'每周互动人数',max:40,step:1,unit:'人',map:'角的个数 · 手臂长度',low:'小圈子',high:'广泛连接'},
  {key:'steps',label:'日均步数',max:20000,step:100,unit:'步',map:'腿长 · 动作速度 · 步态',low:'慢慢来',high:'步履不停'},
  {key:'exercise',label:'每日运动时长',max:120,step:5,unit:'分钟',map:'体长 · 虚拟胖瘦',low:'休息一下',high:'舒展身体'},
  {key:'regularity',label:'近一周运动规律性',max:100,step:1,unit:'%',map:'动作节奏',low:'自由随性',high:'规律稳定'}
];

let state={...DEFAULT}, data={...DATA_DEFAULT}, mode='manual', paused=matchMedia('(prefers-reduced-motion: reduce)').matches, sketch=false, phase=0, frameTime=0;
let parts={}, toastTimer, temporaryExpressionUntil=0;
const fmt=v=>Number(v).toLocaleString('zh-CN');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
function miniSVG(s){return `<svg viewBox="-8 -6 72 76" aria-hidden="true"><path d="${s.icon}" fill="${s.color}"/><path d="M23 23v6m11-6v6" fill="none" stroke="white" stroke-width="3.8" stroke-linecap="round"/></svg>`;}
function makeRange(key,label,min,max,parent){
  parent.insertAdjacentHTML('beforeend',`<div class="range-control"><label for="${key}">${label}<output id="${key}Out"></output></label><input id="${key}" type="range" min="${min}" max="${max}" value="${state[key]}"></div>`);
  $(key).addEventListener('input',e=>{state[key]=+e.target.value;sync();});
}
function buildUI(){
  $('speciesList').innerHTML=SPECIES.map(s=>`<button class="species-button" data-species="${s.id}" aria-label="${s.label}" title="${s.label}" aria-pressed="false">${miniSVG(s)}</button>`).join('');
  $('speciesList').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.species=b.dataset.species;state.color=SPECIES.find(s=>s.id===state.species).color;sync();});
  $('palette').innerHTML=SPECIES.map(s=>`<button class="swatch" style="--swatch:${s.color}" data-color="${s.color}" aria-label="${s.name}色" title="${s.name}色" aria-pressed="false"></button>`).join('')+`<label class="swatch custom" title="自定义颜色"><input id="customColor" type="color" value="${state.color}" aria-label="自定义身体颜色"></label>`;
  $('palette').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.color=b.dataset.color;sync();});
  $('customColor').oninput=e=>{state.color=e.target.value;sync();};
  for(const [key,label,min,max] of [['saturation','饱和度',10,100],['height','体长',65,160],['width','胖瘦',65,150],['horns','角数',0,8],['arms','手长',0,100],['legs','腿长',0,100]])makeRange(key,label,min,max,$('appearanceControls'));
  makeRange('speed','速度',15,100,$('speedControl'));
  $('gaitOptions').innerHTML=GAITS.map(g=>`<button data-gait="${g.id}" aria-pressed="false">${g.name}</button>`).join('');
  $('gaitOptions').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.gait=b.dataset.gait;sync();});
  $('dataControls').innerHTML=DATA_DEFS.map(d=>`<div class="range-control"><label for="data-${d.key}">${d.label}<output id="data-${d.key}Out"></output></label><input type="range" id="data-${d.key}" min="0" max="${d.max}" step="${d.step}" value="${data[d.key]}"></div>`).join('');
  DATA_DEFS.forEach(d=>$('data-'+d.key).oninput=e=>{data[d.key]=+e.target.value;mapDataToAppearance();sync();});
}
// Normalized demo mappings; replace these with the project's research model as needed.
function mapDataToAppearance(){
  const chat=clamp(data.chat/100,0,1),people=clamp(data.people/40,0,1),steps=clamp(data.steps/20000,0,1),exercise=clamp(data.exercise/120,0,1);
  Object.assign(state,{saturation:Math.round(lerp(24,100,chat)),horns:Math.round(people*8),arms:Math.round(lerp(10,95,people)),legs:Math.round(lerp(10,100,steps)),height:Math.round(lerp(78,150,exercise)),width:Math.round(lerp(135,72,exercise)),speed:Math.round(lerp(20,95,steps)),gait:steps<.15?'float':steps>.65?'bounce':'walk',emotion:chat>.6?'happy':chat<.2?'calm':'curious'});
}
function setMode(next){mode=next;if(mode==='data')mapDataToAppearance();sync();}
function updateRange(input){input.style.setProperty('--fill',(+input.value-+input.min)/(+input.max-+input.min)*100+'%');}
function sync(){
  ['height','width','horns','arms','legs','saturation','speed'].forEach(k=>{$(k).value=state[k];$(k+'Out').textContent=k==='horns'?state[k]:k==='speed'?(state[k]/48).toFixed(1)+'×':state[k]+'%';updateRange($(k));});
  $('customColor').value=state.color;
  for(const [selector,key,attr,cls] of [['[data-species]','species','species','selected'],['[data-color]','color','color','selected'],['[data-gait]','gait','gait','active']])document.querySelectorAll(selector).forEach(b=>{const yes=b.dataset[attr]===state[key];b.classList.toggle(cls,yes);b.setAttribute('aria-pressed',yes);});
  DATA_DEFS.forEach(d=>{$('data-'+d.key).value=data[d.key];$('data-'+d.key+'Out').textContent=fmt(data[d.key])+' '+d.unit;updateRange($('data-'+d.key));});
  $('manualPanel').hidden=mode!=='manual';$('dataPanel').hidden=mode!=='data';
  for(const m of ['manual','data']){$(m+'Tab').classList.toggle('active',mode===m);$(m+'Tab').setAttribute('aria-selected',mode===m);$(m+'Tab').tabIndex=mode===m?0:-1;}
  renderCreature();
}
function rgbToHsl(hex){let [r,g,b]=hex.match(/\w\w/g).map(v=>parseInt(v,16)/255);let max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,h=0,l=(max+min)/2,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360;}return[h,s*100,l*100];}
function bodyPath(w,h){
  const points=[],n=260;
  for(let i=0;i<n;i++){
    const t=i/n*Math.PI*2,cs=Math.cos(t),sn=Math.sin(t);
    let exponent=state.species==='square'?.30:state.species==='capsule'?.64:1;
    let x=Math.sign(cs)*Math.pow(Math.abs(cs),exponent)*w/2,y=Math.sign(sn)*Math.pow(Math.abs(sn),exponent)*h/2;
    if(state.species==='star'||state.species==='flower'){
      const lobes=state.species==='star'?7:6,amp=state.species==='star'?.18:.105;
      const r=1+amp*Math.cos(lobes*(t+Math.PI/2));x*=r;y*=r;
    }
    // A small conversational tail preserves the source visual's speech-bubble identity.
    const tailAngle=2.12,dist=Math.abs(Math.atan2(Math.sin(t-tailAngle),Math.cos(t-tailAngle)));
    const tail=state.species==='star'?0:Math.max(0,1-dist/.105)*20;
    x+=Math.cos(t)*tail;y+=Math.sin(t)*tail;
    // Each horn is a smooth bump on the upper contour, part of the same editable outline.
    for(let k=0;k<state.horns;k++){
      const a=state.horns===1?-1.0:lerp(-2.8,-.34,k/(state.horns-1));
      const d=Math.abs(Math.atan2(Math.sin(t-a),Math.cos(t-a)));
      const reach=Math.min(.17,.72/Math.max(1,state.horns));
      const bump=d<reach?Math.pow(Math.cos(d/reach*Math.PI/2),1.2)*(state.species==='flower'?19:26):0;
      x+=Math.cos(a)*bump;y+=Math.sin(a)*bump;
    }
    points.push([x,y]);
  }
  return points.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ')+'Z';
}
function eyeMarkup(){
  let emotion=performance.now()<temporaryExpressionUntil?'happy':state.emotion;
  if(emotion==='happy')return '<path class="eye" d="M-40-7Q-29-35-18-7M15-7Q26-35 37-7"/>';
  if(emotion==='calm')return '<path class="eye" d="M-40-10Q-29-4-18-10M15-10Q26-4 37-10"/>';
  return '<path class="eye" d="M-28-26L-31-4M24-27L27-6"/>';
}
function renderCreature(){
  const [hue,sourceSat,sourceLight]=rgbToHsl(state.color),sat=clamp(sourceSat*state.saturation/70,0,100);
  const hueColor=(s,l)=>`hsl(${hue.toFixed(1)} ${s}% ${l}%)`;
  const midLight=sourceLight+(100-sourceLight)*.12;
  const mid=hueColor(sat,midLight),light=hueColor(sat*.8,sourceLight+(100-sourceLight)*.65),deep=hueColor(sat,Math.max(0,sourceLight-10)),limb=hueColor(sat*.5,Math.max(0,sourceLight-14));
  let w=230*state.width/100,h=190*state.height/100;
  if(state.species==='capsule'){w*=1.12;h*=.77;}if(state.species==='flower'||state.species==='star'){w*=.92;h*=1.03;}
  const leg=24+state.legs*.73,arm=23+state.arms*.68,cy=440-leg-h/2,body=bodyPath(w,h),footX=Math.min(w*.23,58),armY=cy+h*.10;
  const viewHeight=Math.max(450,(h+leg+90)*1.12,(w+arm*1.6+90)*600/700),viewWidth=viewHeight*700/600,viewCenterY=(440-leg-h-35+450)/2;
  $('creature').setAttribute('viewBox',`${350-viewWidth/2} ${viewCenterY-viewHeight/2} ${viewWidth} ${viewHeight}`);
  const footPath=(x,dir)=>`M${x} 434q${dir*14}-13 ${dir*23}-3q${dir*9} 12 ${-dir*12} 14h${-dir*11}q-7 0-7-8Z`;
  const inner=state.species==='round'?`M-55 58Q-100-35 55-72Q80 28-55 58Z`:state.species==='star'?`M-55 55Q-75 10-15-38L0-84Q15-35 42-6Q90 56 25 74Q-30 88-55 55Z`:state.species==='flower'?`M45-75Q-52-66-30 22Q-14 70 60 60Q-20 110-65 43Q-105-35-20-70Z`:`M0-86Q14-70 61-8Q80 11 56 32L6 82Q0 90-13 75L-65 17Q-78 5-64-11Z`;
  $('creature').innerHTML=`<defs>
    <linearGradient id="bodyGradient" x1="${-w/2}" y1="${-h/2}" x2="${w/2}" y2="${h/2}" gradientUnits="userSpaceOnUse"><stop stop-color="${mid}"/><stop offset=".48" stop-color="${light}" stop-opacity=".87"/><stop offset="1" stop-color="${mid}" stop-opacity=".76"/></linearGradient>
    <radialGradient id="edgeLight" cx="32%" cy="12%" r="90%"><stop stop-color="white" stop-opacity=".5"/><stop offset=".35" stop-color="white" stop-opacity="0"/><stop offset=".78" stop-color="${deep}" stop-opacity=".03"/><stop offset="1" stop-color="${deep}" stop-opacity=".3"/></radialGradient>
    <radialGradient id="coreGradient"><stop stop-color="${deep}" stop-opacity=".95"/><stop offset="1" stop-color="${deep}" stop-opacity=".2"/></radialGradient>
    <linearGradient id="limbGradient"><stop stop-color="${limb}"/><stop offset="1" stop-color="${mid}"/></linearGradient>
    <linearGradient id="footGradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${light}"/><stop offset="1" stop-color="${mid}"/></linearGradient>
    <filter id="coreBlur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="10"/></filter>
    <filter id="shadowBlur" x="-80%" y="-200%" width="260%" height="500%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="softShadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="${deep}" flood-opacity=".10"/></filter>
    <clipPath id="bodyClip"><path d="${body}"/></clipPath>
  </defs>
  <ellipse id="groundShadow" cx="350" cy="462" rx="${w*.40}" ry="10" fill="#758b50" opacity=".14" filter="url(#shadowBlur)"/>
  <g id="creatureMotion">
    <g id="leftLeg" style="transform-origin:${350-footX}px ${cy+h/2-7}px"><path class="limb" d="M${350-footX} ${cy+h/2-7}Q${347-footX} ${440-leg*.5} ${350-footX} 436" fill="none" stroke="url(#limbGradient)" stroke-width="7" stroke-linecap="round"/><path class="foot" d="${footPath(350-footX,-1)}" fill="url(#footGradient)" stroke="${mid}" stroke-width="1"/></g>
    <g id="rightLeg" style="transform-origin:${350+footX}px ${cy+h/2-7}px"><path class="limb" d="M${350+footX} ${cy+h/2-7}Q${353+footX} ${440-leg*.5} ${350+footX} 436" fill="none" stroke="url(#limbGradient)" stroke-width="7" stroke-linecap="round"/><path class="foot" d="${footPath(350+footX,1)}" fill="url(#footGradient)" stroke="${mid}" stroke-width="1"/></g>
    <g id="leftArm" style="transform-origin:${350-w*.44}px ${armY}px"><path class="limb" d="M${350-w*.44} ${armY}Q${350-w*.5-arm*.77} ${armY+arm*.40} ${350-w*.48-arm*.50} ${armY+arm}q7 11 17 0" fill="none" stroke="url(#limbGradient)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>
    <g id="rightArm" style="transform-origin:${350+w*.44}px ${armY}px"><path class="limb" d="M${350+w*.44} ${armY}Q${350+w*.5+arm*.77} ${armY+arm*.4} ${350+w*.48+arm*.50} ${armY+arm}q-7 11-17 0" fill="none" stroke="url(#limbGradient)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>
    <g id="bodyMotion" transform="translate(350 ${cy})"><g filter="url(#softShadow)"><path class="body-color" d="${body}" fill="url(#bodyGradient)" stroke="${light}" stroke-opacity=".8" stroke-width="1.8"/><path class="body-highlight" d="${body}" fill="url(#edgeLight)"/>
      <g clip-path="url(#bodyClip)"><path class="core-light" d="${inner}" transform="translate(6 9) scale(${Math.min(w/240,1.5)} ${h/205})" fill="url(#coreGradient)" filter="url(#coreBlur)" opacity=".74"/><ellipse class="body-highlight" cx="${-w*.25}" cy="${-h*.37}" rx="${w*.27}" ry="${h*.12}" transform="rotate(-22)" fill="white" opacity=".12" filter="url(#coreBlur)"/></g></g>
      <g id="face" transform="translate(0 -6)" fill="none" stroke="white" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">${eyeMarkup()}</g>
    </g>
  </g>`;
  parts={root:$('creatureMotion'),body:$('bodyMotion'),ll:$('leftLeg'),rl:$('rightLeg'),la:$('leftArm'),ra:$('rightArm'),face:$('face'),shadow:$('groundShadow'),cy,leg};
  $('creature').classList.toggle('sketch-mode',sketch);
  animatePose();
}
function animatePose(){
  if(!parts.root)return;
  const a=Math.sin(phase),b=Math.cos(phase);let x=0,y=0,rot=0,ll=0,rl=0,la=0,ra=0;
  if(state.gait==='walk'){y=-Math.abs(a)*3;rot=a*2;ll=a*13;rl=-a*13;la=-a*9;ra=a*9;}
  if(state.gait==='bounce'){y=-Math.abs(a)*22;rot=a*3;ll=-Math.abs(a)*8;rl=Math.abs(a)*8;la=10+Math.abs(a)*19;ra=-la;}
  if(state.gait==='sway'){x=a*10;rot=a*7;ll=-a*4;rl=-a*4;la=b*12;ra=-b*12;}
  if(state.gait==='float'){y=-15+a*9;x=b*5;rot=a*4;ll=-7+a*4;rl=7-a*4;la=20+a*9;ra=-20-a*9;}
  parts.root.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(2)} 350 365)`);
  for(const [k,v] of [['ll',ll],['rl',rl],['la',la],['ra',ra]])parts[k].style.transform=`rotate(${v.toFixed(2)}deg)`;
  parts.shadow.setAttribute('opacity',(.14+y*.0025).toFixed(3));
  const blink=Math.sin(phase*.32);parts.face.style.transformOrigin='0px -16px';parts.face.style.transform=`scaleY(${blink>.997?.08:1})`;
}
function tick(time){const dt=Math.min((time-frameTime)/1000,.05);frameTime=time;if(!paused&&!document.hidden){const variability=mode==='data'?1+(1-data.regularity/100)*.19*Math.sin(phase*.63):1;phase+=dt*3.5*(state.speed/48)*variability;animatePose();}requestAnimationFrame(tick);}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2600);}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已生成 '+name);}
function exportSVG(){
  const clone=$('creature').cloneNode(true);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width','1400');clone.setAttribute('height','1200');clone.removeAttribute('id');clone.removeAttribute('class');clone.removeAttribute('role');clone.removeAttribute('aria-label');
  // Inline sketch styles so the exported file is independent of the page stylesheet.
  if(sketch){clone.querySelectorAll('.body-color').forEach(p=>{p.setAttribute('fill','#e4e8df');p.setAttribute('stroke','#68755f');p.setAttribute('stroke-width','2');});clone.querySelectorAll('.core-light,.body-highlight').forEach(p=>p.remove());clone.querySelectorAll('.eye,.limb').forEach(p=>p.setAttribute('stroke','#68755f'));clone.querySelectorAll('.foot').forEach(p=>{p.setAttribute('fill','#e4e8df');p.setAttribute('stroke','#68755f');p.setAttribute('stroke-width','2');});}
  return new XMLSerializer().serializeToString(clone);
}
async function exportPNG(){try{const svg=exportSVG(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=1200;canvas.getContext('2d').drawImage(img,0,0);URL.revokeObjectURL(url);canvas.toBlob(blob=>{if(blob)download(blob,'momo-creature.png');else toast('图片导出失败，请使用 SVG 格式');},'image/png');}catch{toast('图片导出失败，请使用 SVG 格式');}}

function bindEvents(){
  $('manualTab').onclick=()=>setMode('manual');$('dataTab').onclick=()=>setMode('data');
  document.querySelector('.tabs').onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setMode(mode==='manual'?'data':'manual');$(mode+'Tab').focus();}};
  $('resetBtn').onclick=()=>{state={...DEFAULT};data={...DATA_DEFAULT};mode='manual';phase=0;sync();};
  $('randomBtn').onclick=()=>{const s=SPECIES[Math.floor(Math.random()*SPECIES.length)];if(mode==='data'){DATA_DEFS.forEach(d=>data[d.key]=Math.round(Math.random()*d.max/d.step)*d.step);state.species=s.id;state.color=s.color;mapDataToAppearance();}else{state={species:s.id,color:s.color,saturation:Math.round(35+Math.random()*65),height:Math.round(70+Math.random()*80),width:Math.round(70+Math.random()*70),horns:Math.floor(Math.random()*9),arms:Math.round(Math.random()*100),legs:Math.round(Math.random()*100),gait:GAITS[Math.floor(Math.random()*4)].id,speed:Math.round(25+Math.random()*60),emotion:['curious','happy','calm'][Math.floor(Math.random()*3)]};}sync();};
  $('pauseBtn').onclick=()=>{paused=!paused;updatePause();};
  $('outlineBtn').onclick=()=>{sketch=!sketch;$('outlineBtn').setAttribute('aria-pressed',sketch);$('creature').classList.toggle('sketch-mode',sketch);};
  $('exportBtn').onclick=()=>$('exportDialog').showModal();
  $('closeExport').onclick=()=>$('exportDialog').close();
  $('exportDialog').onclick=e=>{const d=$('exportDialog'),r=d.getBoundingClientRect();if(e.target===d&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))d.close();};
  $('svgBtn').onclick=()=>download(new Blob([exportSVG()],{type:'image/svg+xml;charset=utf-8'}),'momo-creature.svg');
  $('pngBtn').onclick=exportPNG;
  $('jsonBtn').onclick=()=>download(new Blob([JSON.stringify({version:1,appearance:state,mode,simulationData:mode==='data'?data:null,mapping:'demo-design-hypothesis'},null,2)],{type:'application/json'}),'momo-parameters.json');
  $('creature').onclick=()=>{temporaryExpressionUntil=performance.now()+1800;renderCreature();setTimeout(renderCreature,1850);};
}
function updatePause(){$('pauseBtn').textContent=paused?'▷':'Ⅱ';$('pauseBtn').setAttribute('aria-label',paused?'播放':'暂停');$('pauseBtn').title=paused?'播放':'暂停';}
buildUI();bindEvents();sync();updatePause();requestAnimationFrame(tick);
