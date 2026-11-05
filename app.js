/* Solid, rounded creatures. The corner count controls the complete silhouette. */
'use strict';
const $=id=>document.getElementById(id);
const COLORS=[{color:'#F4D34F',name:'黄'},{color:'#F37456',name:'橙'},{color:'#E95C8B',name:'粉'},{color:'#42C391',name:'绿'},{color:'#57B7D2',name:'蓝'},{color:'#B591DC',name:'紫'}];
const DEFAULT={color:'#F4D34F',saturation:100,height:100,width:105,horns:5,arms:32,legs:35,gait:'walk',speed:48,emotion:'curious'};
const GAITS=[{id:'walk',name:'漫步'},{id:'bounce',name:'蹦跳'},{id:'sway',name:'摇摆'},{id:'float',name:'漂浮'}];
const DATA_DEFAULT={chat:28,people:12,steps:6800,exercise:35,regularity:75};
const DATA_DEFS=[{key:'chat',label:'每日聊天频次',max:100,step:1,unit:'次'},{key:'people',label:'每周互动人数',max:40,step:1,unit:'人'},{key:'steps',label:'日均步数',max:20000,step:100,unit:'步'},{key:'exercise',label:'每日运动时长',max:120,step:5,unit:'分钟'},{key:'regularity',label:'运动规律性',max:100,step:1,unit:'%'}];
let state={...DEFAULT},data={...DATA_DEFAULT},mode='manual',paused=matchMedia('(prefers-reduced-motion: reduce)').matches,phase=0,frameTime=0,temporaryExpressionUntil=0;
let parts={};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
function makeRange(key,label,min,max,parent){
  parent.insertAdjacentHTML('beforeend',`<div class="range-control"><label for="${key}">${label}<output id="${key}Out"></output></label><input id="${key}" type="range" min="${min}" max="${max}" value="${state[key]}"></div>`);
  $(key).oninput=e=>{state[key]=+e.target.value;sync();};
}
function buildUI(){
  $('palette').innerHTML=COLORS.map(s=>`<button class="swatch" style="--swatch:${s.color}" data-color="${s.color}" aria-label="${s.name}色" title="${s.name}色" aria-pressed="false"></button>`).join('')+'<label class="swatch custom" title="自定义颜色"><input id="customColor" type="color" aria-label="自定义身体颜色"></label>';
  $('palette').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.color=b.dataset.color;sync();});
  $('customColor').oninput=e=>{state.color=e.target.value;sync();};
  for(const [key,label,min,max] of [['saturation','饱和度',0,100],['height','体长',65,160],['width','胖瘦',65,150],['horns','角数',3,16],['arms','手长',0,100],['legs','腿长',0,100]])makeRange(key,label,min,max,$('appearanceControls'));
  makeRange('speed','速度',15,100,$('speedControl'));
  $('gaitOptions').innerHTML=GAITS.map(g=>`<button data-gait="${g.id}" aria-pressed="false">${g.name}</button>`).join('');
  $('gaitOptions').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.gait=b.dataset.gait;sync();});
  $('dataControls').innerHTML=DATA_DEFS.map(d=>`<div class="range-control"><label for="data-${d.key}">${d.label}<output id="data-${d.key}Out"></output></label><input id="data-${d.key}" type="range" min="0" max="${d.max}" step="${d.step}"></div>`).join('');
  DATA_DEFS.forEach(d=>$('data-'+d.key).oninput=e=>{data[d.key]=+e.target.value;mapDataToAppearance();sync();});
}
// Demo hypotheses; corner count is the total number of rounded lobes around the body.
function mapDataToAppearance(){
  const chat=clamp(data.chat/100,0,1),people=clamp(data.people/40,0,1),steps=clamp(data.steps/20000,0,1),exercise=clamp(data.exercise/120,0,1);
  Object.assign(state,{saturation:Math.round(lerp(25,100,chat)),horns:Math.round(lerp(3,16,people)),arms:Math.round(lerp(10,90,people)),legs:Math.round(lerp(10,100,steps)),height:Math.round(lerp(78,150,exercise)),width:Math.round(lerp(135,72,exercise)),speed:Math.round(lerp(20,95,steps)),gait:steps<.15?'float':steps>.65?'bounce':'walk',emotion:chat>.6?'happy':chat<.2?'calm':'curious'});
}
function setMode(next){mode=next;if(mode==='data')mapDataToAppearance();sync();}
function updateRange(input){input.style.setProperty('--fill',(+input.value-+input.min)/(+input.max-+input.min)*100+'%');}
function sync(){
  for(const key of ['saturation','height','width','horns','arms','legs','speed']){
    $(key).value=state[key];$(key+'Out').textContent=key==='horns'?state[key]:key==='speed'?(state[key]/48).toFixed(1)+'×':state[key]+'%';updateRange($(key));
  }
  $('customColor').value=state.color;
  for(const [selector,key,attr,cls] of [['[data-color]','color','color','selected'],['[data-gait]','gait','gait','active']])document.querySelectorAll(selector).forEach(b=>{const yes=b.dataset[attr]===state[key];b.classList.toggle(cls,yes);b.setAttribute('aria-pressed',yes);});
  DATA_DEFS.forEach(d=>{$('data-'+d.key).value=data[d.key];$('data-'+d.key+'Out').textContent=Number(data[d.key]).toLocaleString('zh-CN')+' '+d.unit;updateRange($('data-'+d.key));});
  $('manualPanel').hidden=mode!=='manual';$('dataPanel').hidden=mode!=='data';
  for(const m of ['manual','data']){$(m+'Tab').classList.toggle('active',mode===m);$(m+'Tab').setAttribute('aria-selected',mode===m);$(m+'Tab').tabIndex=mode===m?0:-1;}
  renderCreature();
}
function rgbToHsl(hex){const [r,g,b]=hex.match(/\w\w/g).map(v=>parseInt(v,16)/255);const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=(max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4)*60;if(h<0)h+=360;}return[h,s*100,l*100];}
function bodyRadius(t,count){
  // Envelope of overlapping circles: broad circular petals rather than pointed spikes.
  const c=1/(1+1.45*Math.sin(Math.PI/count)),r=1-c;
  let radius=.48;
  for(let k=0;k<count;k++){
    const a=-Math.PI/2+k*2*Math.PI/count;
    const delta=t-a,s=c*Math.sin(delta),disc=r*r-s*s;
    if(disc>=0){const reach=c*Math.cos(delta)+Math.sqrt(disc);radius=Math.max(radius,reach);}
  }
  return radius;
}
function bodyPath(w,h,count=state.horns){
  const points=[],samples=Math.max(420,count*60);
  for(let i=0;i<samples;i++){
    const t=i/samples*Math.PI*2,r=bodyRadius(t,count);
    points.push([Math.cos(t)*w*.5*r,Math.sin(t)*h*.5*r]);
  }
  // A short symmetric smoothing pass rounds the junctions between neighboring circles.
  const smoothed=points.map((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];return[(a[0]+p[0]*2+b[0])/4,(a[1]+p[1]*2+b[1])/4];});
  return smoothed.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ')+'Z';
}
function legPath(x,hipY,floor,dir,thickness){
  // One filled silhouette from the thick leg to a broad, rounded toe.
  const d=dir,t=thickness/2;
  return `M${x-d*t} ${hipY}Q${x-d*t-2} ${(hipY+floor)/2} ${x-d*t} ${floor-18}L${x-d*t} ${floor-8}Q${x-d*t} ${floor+1} ${x+d*2} ${floor+1}L${x+d*27} ${floor+1}Q${x+d*37} ${floor+1} ${x+d*34} ${floor-8}Q${x+d*31} ${floor-16} ${x+d*20} ${floor-15}L${x+d*t} ${floor-13}Q${x+d*t} ${(hipY+floor)/2} ${x+d*t} ${hipY}Z`;
}
function eyeMarkup(faceColor){
  const emotion=performance.now()<temporaryExpressionUntil?'happy':state.emotion;
  const eyes=emotion==='happy'?'<path d="M-32-13Q-23-30-14-13M14-13Q23-30 32-13" fill="none" stroke-width="7"/>':emotion==='calm'?'<path d="M-32-14h17M15-14h17" fill="none" stroke-width="6"/>':'<ellipse cx="-23" cy="-17" rx="7" ry="11"/><ellipse cx="23" cy="-18" rx="7" ry="11"/>';
  return `<g fill="${faceColor}" stroke="${faceColor}" stroke-linecap="round" stroke-linejoin="round">${eyes}<path d="M-9 9Q0 18 10 8" fill="none" stroke-width="4.5"/></g>`;
}
function renderCreature(){
  const [hue,saturation,lightness]=rgbToHsl(state.color),sat=saturation*state.saturation/100;
  const color=`hsl(${hue.toFixed(1)} ${sat.toFixed(1)}% ${lightness.toFixed(1)}%)`,faceColor=lightness<42?'#FFFFFF':'#20221F';
  const w=270*state.width/100,h=240*state.height/100,leg=18+state.legs*.8,floor=470,cy=floor-leg-h/2;
  const hipY=cy+h*.25,hipX=Math.min(55,w*.16),arm=22+state.arms*.7,armY=cy+h*.04,thickness=18;
  const leftX=350-w*.36,rightX=350+w*.36;
  const handY=armY+arm*.94,leftHand=350-w*.48-arm*.47,rightHand=350+w*.48+arm*.47;
  $('creature').innerHTML=`<g id="creatureMotion">
    <g id="leftLeg" style="transform-origin:${350-hipX}px ${hipY}px"><path class="leg" d="${legPath(350-hipX,hipY,floor,-1,thickness)}" fill="${color}"/></g>
    <g id="rightLeg" style="transform-origin:${350+hipX}px ${hipY}px"><path class="leg" d="${legPath(350+hipX,hipY,floor,1,thickness)}" fill="${color}"/></g>
    <g id="leftArm" style="transform-origin:${leftX}px ${armY}px"><path d="M${leftX} ${armY}Q${350-w*.53-arm*.72} ${armY+arm*.26} ${leftHand} ${handY}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"/><circle cx="${leftHand}" cy="${handY}" r="8" fill="${color}"/></g>
    <g id="rightArm" style="transform-origin:${rightX}px ${armY}px"><path d="M${rightX} ${armY}Q${350+w*.53+arm*.72} ${armY+arm*.26} ${rightHand} ${handY}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"/><circle cx="${rightHand}" cy="${handY}" r="8" fill="${color}"/></g>
    <g id="bodyMotion" transform="translate(350 ${cy})"><path id="body" d="${bodyPath(w,h)}" fill="${color}"/><g id="face">${eyeMarkup(faceColor)}</g></g>
  </g>`;
  parts={root:$('creatureMotion'),ll:$('leftLeg'),rl:$('rightLeg'),la:$('leftArm'),ra:$('rightArm'),face:$('face')};
  animatePose();
}
function animatePose(){
  if(!parts.root)return;
  const a=Math.sin(phase),b=Math.cos(phase);let x=0,y=0,rot=0,ll=0,rl=0,la=0,ra=0;
  if(state.gait==='walk'){y=-Math.abs(a)*4;rot=a*2;ll=a*18;rl=-a*18;la=-a*11;ra=a*11;}
  if(state.gait==='bounce'){y=-Math.abs(a)*25;rot=a*3;ll=-Math.abs(a)*14;rl=Math.abs(a)*14;la=12+Math.abs(a)*24;ra=-la;}
  if(state.gait==='sway'){x=a*10;rot=a*7;ll=-a*5;rl=-a*5;la=b*15;ra=-b*15;}
  if(state.gait==='float'){y=-20+a*9;x=b*5;rot=a*4;ll=-12+a*5;rl=12-a*5;la=25+a*9;ra=-25-a*9;}
  parts.root.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(2)} 350 380)`);
  for(const [k,v] of [['ll',ll],['rl',rl],['la',la],['ra',ra]])parts[k].style.transform=`rotate(${v.toFixed(2)}deg)`;
  const blink=Math.sin(phase*.32);parts.face.style.transformOrigin='0px -15px';parts.face.style.transform=`scaleY(${blink>.998?.08:1})`;
}
function tick(time){const dt=Math.min((time-frameTime)/1000,.05);frameTime=time;if(!paused&&!document.hidden){const variability=mode==='data'?1+(1-data.regularity/100)*.19*Math.sin(phase*.63):1;phase+=dt*3.5*(state.speed/48)*variability;animatePose();}requestAnimationFrame(tick);}
function bindEvents(){
  $('manualTab').onclick=()=>setMode('manual');$('dataTab').onclick=()=>setMode('data');
  document.querySelector('.tabs').onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setMode(mode==='manual'?'data':'manual');$(mode+'Tab').focus();}};
  $('resetBtn').onclick=()=>{state={...DEFAULT};data={...DATA_DEFAULT};mode='manual';phase=0;sync();};
  $('randomBtn').onclick=()=>{if(mode==='data'){DATA_DEFS.forEach(d=>data[d.key]=Math.round(Math.random()*d.max/d.step)*d.step);state.color=COLORS[Math.floor(Math.random()*COLORS.length)].color;mapDataToAppearance();}else{state={color:COLORS[Math.floor(Math.random()*COLORS.length)].color,saturation:Math.round(65+Math.random()*35),height:Math.round(75+Math.random()*65),width:Math.round(75+Math.random()*55),horns:3+Math.floor(Math.random()*14),arms:Math.round(Math.random()*100),legs:Math.round(Math.random()*100),gait:GAITS[Math.floor(Math.random()*4)].id,speed:Math.round(25+Math.random()*60),emotion:['curious','happy','calm'][Math.floor(Math.random()*3)]};}sync();};
  $('pauseBtn').onclick=()=>{paused=!paused;updatePause();};
  $('creature').onclick=()=>{temporaryExpressionUntil=performance.now()+1800;renderCreature();setTimeout(renderCreature,1850);};
}
function updatePause(){$('pauseBtn').textContent=paused?'▷':'Ⅱ';$('pauseBtn').setAttribute('aria-label',paused?'播放':'暂停');$('pauseBtn').title=paused?'播放':'暂停';}
buildUI();bindEvents();sync();updatePause();requestAnimationFrame(tick);
