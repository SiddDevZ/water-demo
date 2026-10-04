// Local Pixelify font and the 2px notched-slot language follow Willowmere's in-game HUD.
// Sprites are authored at 12px and rendered on whole-pixel coordinates.
const art={
 stir:['............','.....ww.....','.....ww.....','...w.ww.w...','....wwww....','.....ww.....','............','..cc....cc..','.c..cccc..c.','............','...cccccc...','............'],
 stone:['............','............','....ssss....','...sSSSSs...','..sSSSSsss..','..ssssssss..','...ssssss...','............','..cc....cc..','...cccccc...','............','............'],
 leaf:['............','.......ggg..','.....ggggg..','...gggGggg..','..gggGggg...','..ggGgggg...','..gGgggg....','..Gggg......','.G..........','............','............','............'],
 rain:['............','....ssss....','..ssssssss..','.ssSSSSSSss.','.ssssssssss.','............','...c..c..c..','..c..c..c...','............','...c..c.....','..c..c......','............'],
 feed:['............','............','....wwww....','...wrrwww..w','..wwrrwww.ww','.wBwwwwwwwww','..wwrrwww.ww','...wrrwww..w','....wwww....','............','............','............'],
 boat:['............','.....w......','....ww......','...www......','..wwww......','.wwwww......','............','.ssssssssss.','..swwwwwss..','...ssssss...','............','..cccccccc..'],
 settings:['............','.....ss.....','..s.ssss.s..','..ssssssss..','...ss..ss...','.sss....sss.','.sss....sss.','...ss..ss...','..ssssssss..','..s.ssss.s..','.....ss.....','............'],
 sound:['............','......ss....','.....sss....','..ssssss..s.','..ssssss...s','..ssssss...s','..ssssss..s.','.....sss....','......ss....','............','............','............'],
 record:['............','............','....rrrr....','...rrrrrr...','..rrrrrrrr..','..rrrrrrrr..','..rrrrrrrr..','..rrrrrrrr..','...rrrrrr...','....rrrr....','............','............'],
 fullscreen:['............','.ssss..ssss.','.s........s.','.s........s.','.s........s.','............','............','.s........s.','.s........s.','.s........s.','.ssss..ssss.','............'],
};
const palette={w:'#f4ecd8',s:'#b7beb0',S:'#e1e2d2',c:'#91c6cf',g:'#90b975',G:'#d0d9a0',r:'#d79277',B:'#333f36'};
function icon(name){return `<svg viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">${art[name].flatMap((row,y)=>[...row].map((p,x)=>p==='.'?'':`<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[p]}"/>`)).join('')}</svg>`;}
const tools=[['stir','Make waves','1'],['stone','Toss stone','2'],['leaf','Float a leaf','3'],['rain','Sunshower','4'],['feed','Feed koi','5'],['boat','Paper boat','6']];
export function setupUI(callbacks={}){
 const root=document.querySelector('#ui');
 document.body.dataset.waterTool='stir';
 root.innerHTML=`<header class="brand"><h1>komorebi<span class="title-mark">水</span></h1><p>A little spring, in bloom</p></header>
 <aside class="elements"><button class="elements-toggle pixel-button" aria-label="Settings" title="Settings" aria-expanded="false">${icon('settings')}</button><div class="elements-content"><div class="panel-heading">The spring <span>01</span></div><div class="top-actions"><button class="icon-button" id="sound-button" aria-label="Enable sound" title="Enable sound" aria-pressed="false">${icon('sound')}</button><button class="icon-button" id="record-button" aria-label="Record a clip" title="Record a clip" aria-pressed="false">${icon('record')}</button><button class="icon-button" id="fullscreen-button" aria-label="Fullscreen" title="Fullscreen">${icon('fullscreen')}</button></div><label>Flow <output id="flow-output">65%</output><input id="flow" type="range" aria-label="Water flow" min="0" max="1" step=".01" value=".65"></label><label>Ripples <output id="strength-output">85%</output><input id="strength" type="range" aria-label="Ripple strength" min="0" max="1" step=".01" value=".85"></label><label>Sunlight <output id="light-output">75%</output><input id="light" type="range" aria-label="Daylight" min="0" max="1" step=".01" value=".75"></label><button class="reset-button">Begin again</button><div class="navigation-hint">Right-drag to orbit<br>Scroll to explore</div></div></aside>
 <div class="interaction-hint"><span id="hint-text">Hold & drag to make waves</span></div>
 <nav class="tool-dock" aria-label="Water interactions">${tools.map(([tool,label,key])=>`<button class="tool ${tool==='stir'?'active':''}" data-tool="${tool}" aria-label="${label}" aria-pressed="${tool==='stir'}" aria-keyshortcuts="${key}" title="${tool==='stir'?'Hold & drag to make waves':label} (${key})">${icon(tool)}<kbd>${key}</kbd><span class="tool-label">${tool==='stir'?'Hold & drag to make waves':label}</span></button>`).join('')}</nav>
 <footer class="status"><span class="live-dot"></span><span id="fps">60 FPS</span></footer><button class="cinematic-button" title="Hide interface (H)"><kbd>H</kbd> Hide UI</button><div class="toast" role="status"></div><div class="cinematic-return">H · return</div>`;
 let timer;
 const hints={stir:'Hold & drag to make waves',stone:'Click to toss one stone',leaf:'Click to float a leaf',rain:'A little passing rain',feed:'Click to feed the koi',boat:'Click to launch a boat'};
 const setTool=tool=>{document.body.dataset.waterTool=tool;root.querySelectorAll('[data-tool]').forEach(b=>{const active=b.dataset.tool===tool;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});root.querySelector('#hint-text').textContent=hints[tool]||hints.stir;};
 root.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{setTool(b.dataset.tool);callbacks.onTool?.(b.dataset.tool);}));
 for(const [id,cb]of [['flow','onFlow'],['strength','onStrength'],['light','onLight']])root.querySelector('#'+id).addEventListener('input',e=>{root.querySelector('#'+id+'-output').textContent=Math.round(e.target.value*100)+'%';callbacks[cb]?.(Number(e.target.value));});
 const toggleSettings=()=>{const b=root.querySelector('.elements-toggle'),open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',open);root.querySelector('.elements').classList.toggle('open',open);};
 root.querySelector('.elements-toggle').addEventListener('click',toggleSettings);
 root.querySelector('.reset-button').addEventListener('click',()=>callbacks.onReset?.());
 root.querySelector('#sound-button').addEventListener('click',e=>{const b=e.currentTarget,on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',on);b.setAttribute('aria-label',on?'Mute sound':'Enable sound');b.title=on?'Mute sound':'Enable sound';callbacks.onSound?.();});
 root.querySelector('#record-button').addEventListener('click',()=>callbacks.onRecord?.());
 root.querySelector('#fullscreen-button').addEventListener('click',()=>callbacks.onFullscreen?.());
 const cinematic=()=>{root.classList.toggle('cinematic');callbacks.onCinematic?.();};
 root.querySelector('.cinematic-button').addEventListener('click',cinematic);
 window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;if(e.key.toLowerCase()==='h')cinematic();if(e.key==='Escape'&&root.querySelector('.elements').classList.contains('open'))toggleSettings();const tool=tools.find(t=>t[2]===e.key)?.[0];if(tool){setTool(tool);callbacks.onTool?.(tool);}});
 return{setTool,setFPS:fps=>root.querySelector('#fps').textContent=Math.round(fps)+' FPS',setRecording:on=>{const b=root.querySelector('#record-button');b.classList.toggle('recording',on);b.setAttribute('aria-pressed',on);b.setAttribute('aria-label',on?'Stop recording':'Record a clip');b.title=on?'Stop recording':'Record a clip';root.classList.toggle('is-recording',on);},toast:text=>{const t=root.querySelector('.toast');t.textContent=text;t.classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>t.classList.remove('visible'),2600);}};
}
