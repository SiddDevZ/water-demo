import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { createLife } from './life.js';
import { createBoats } from './boats.js';
import { createVegetation } from './vegetation.js';
import { createWater } from './water.js';
import { createEnvironment } from './environment.js';
import { createInlet } from './inlet.js';
import { createStones } from './stones.js';
import { enhanceCloudSky } from './cloud-sky.js';
import { setupUI } from './ui.js';
import { createPostFX } from './postfx.js';
import {loadSettings,normalizeSettings} from './settings.js';
import './style.css';
const canvas=document.querySelector('#scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;THREE.DefaultLoadingManager.onLoad=()=>{renderer.shadowMap.needsUpdate=true;};renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
const scene=new THREE.Scene();scene.background=null;scene.fog=null;
const camera=new THREE.PerspectiveCamera(32,innerWidth/innerHeight,.1,240);camera.position.set(0,15.2,9.5);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,0,2.1);controls.enableDamping=true;controls.minDistance=8;controls.maxDistance=32;controls.maxPolarAngle=Math.PI*.475;controls.minPolarAngle=.25;controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.ROTATE};controls.touches={ONE:null,TWO:THREE.TOUCH.DOLLY_ROTATE};controls.update();
scene.add(new THREE.HemisphereLight('#eefcff','#bdcc74',1.05));
// Side light shapes the stone and sends the canopy's dappled shadows across the bank.
// Soft sky illumination preserves colour inside those shadows without flattening them.
const sun=new THREE.DirectionalLight('#fff1d4',3.4);sun.position.set(2.605,29.544,-4.512);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-15,right:15,top:19,bottom:-15,near:1,far:100});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.00012;sun.shadow.normalBias=.008;scene.add(sun);const fill=new THREE.DirectionalLight('#d0edff',.22);fill.position.set(5,7,12);scene.add(fill);
// Clear daylight gives the spring a blue sky reflection and fresh, neutral fill.
const sky=new Sky();sky.scale.setScalar(250);scene.add(sky);
const skyUniforms=sky.material.uniforms;
skyUniforms.turbidity.value=2;skyUniforms.rayleigh.value=2.2;skyUniforms.mieCoefficient.value=.003;skyUniforms.mieDirectionalG.value=.8;skyUniforms.sunPosition.value.copy(sun.position).normalize();
// A clear-air sky avoids the pale horizon wash of the previous overcast map.
sky.material.uniforms.uSunDisc={value:1};
sky.material.fragmentShader='uniform float uSunDisc;\n'+sky.material.fragmentShader;
sky.material.fragmentShader=sky.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );',`
  vec3 clearSky=mix(vec3(.12,.40,.82),vec3(.025,.16,.55),pow(max(direction.y,0.),.55));
  clearSky+=vec3(1.,.88,.64)*pow(max(dot(direction,vSunDirection),0.),16384.)*uSunDisc*3.;
  gl_FragColor=vec4(clearSky,1.);
`);
const clouds=enhanceCloudSky(sky,sun.position);
const pmrem=new THREE.PMREMGenerator(renderer),skyEnvironment=pmrem.fromScene(sky,.04);scene.environment=skyEnvironment.texture;scene.environmentIntensity=.25;pmrem.dispose();
const environment=createEnvironment(scene);const vegetation=createVegetation(scene,environment.bankHeight);environment.setGroundOcclusion?.(vegetation.groundOcclusion);const water=createWater(scene,renderer,camera);water.setSun?.(sun.position,sun.color);water.setSky?.(sky);water.setTerrain?.(environment.bankHeight);environment.ready?.then(()=>{water.setObstacles?.(environment.obstacles||[]);renderer.shadowMap.needsUpdate=true;});
const inlet=createInlet(water);inlet.update=()=>{};
const postFX=createPostFX(renderer,scene,camera);
const life=createLife(scene,water,environment.bankHeight);const paperBoats=createBoats(scene,water,environment.bankHeight);
paperBoats.add(5.82,.23);
paperBoats.boats[0].yaw=-.6;
let appSettings=loadSettings();
let tool='stir',strength=.85,flow=.65,raining=false,time=0,down=false,strokePoint=null,audioCtx,audioGain,soundOn=false,cinematic=false;
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
const debris=[],drops=[];
const stoneThrows=createStones(scene,water,environment.bankHeight,{onImpact:(x,z,power)=>{life.spook(x,z,power*appSettings.stonePower);playSplash(power*appSettings.stonePower);renderer.shadowMap.needsUpdate=true;}});
const stones=stoneThrows.stones;
const leafCanvas=document.createElement('canvas');leafCanvas.width=leafCanvas.height=256;const lc=leafCanvas.getContext('2d');
const grad=lc.createLinearGradient(0,0,256,256);grad.addColorStop(0,'#89b932');grad.addColorStop(.5,'#cbdd5c');grad.addColorStop(1,'#669826');lc.fillStyle=grad;lc.fillRect(0,0,256,256);
for(let i=0;i<2400;i++){lc.fillStyle=`rgba(${Math.random()>.5?'30,29,12':'209,184,107'},${Math.random()*.17})`;lc.fillRect(Math.random()*256,Math.random()*256,1+Math.random()*3,1+Math.random()*3);}
lc.strokeStyle='#d4bd74';lc.lineWidth=1.4;lc.beginPath();lc.moveTo(128,0);lc.lineTo(128,256);lc.stroke();lc.lineWidth=.6;for(let j=20;j<240;j+=24){lc.beginPath();lc.moveTo(128,j);lc.quadraticCurveTo(75,j-8,25,j-42);lc.moveTo(128,j);lc.quadraticCurveTo(181,j-8,231,j-42);lc.stroke();}
const leafTex=new THREE.CanvasTexture(leafCanvas);leafTex.colorSpace=THREE.SRGBColorSpace;
const lp=[],lu=[],li=[];for(let j=0;j<=12;j++){const t=j/12,width=Math.pow(Math.sin(Math.PI*t),.8)*.095;for(let k=0;k<=4;k++){const u=k/4,x=(u*2-1)*width;lp.push(x,Math.pow(u*2-1,2)*.015+Math.pow(t-.5,2)*.05,(t-.5)*.34);lu.push(u,t);if(j<12&&k<4){const q=j*5+k;li.push(q,q+5,q+1,q+1,q+5,q+6);}}}
const leafGeometry=new THREE.BufferGeometry();leafGeometry.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));leafGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(lu,2));leafGeometry.setIndex(li);leafGeometry.computeVertexNormals();
const leafMats=['#f0edbf','#ffe5b4','#b6d693'].map(color=>new THREE.MeshStandardMaterial({map:leafTex,color,roughness:.55,side:THREE.DoubleSide}));
const dropGeo=new THREE.SphereGeometry(.018,8,5),dropMat=new THREE.MeshStandardMaterial({color:'#d7f3ee',metalness:.32,roughness:.09,transparent:true,opacity:.72,envMapIntensity:1.4});
function leaf(x,z){for(let i=0;i<24&&environment.bankHeight(x,z)>-.10;i++){x*=.92;z*=.92;}const mesh=new THREE.Mesh(leafGeometry,leafMats[Math.floor(Math.random()*3)]);mesh.scale.setScalar(1.3);mesh.position.set(x,.06,z);mesh.rotation.y=Math.random()*6.28;scene.add(mesh);debris.push({mesh,seed:Math.random()*10,yaw:mesh.rotation.y,vx:0,vz:0});if(debris.length>55)scene.remove(debris.shift().mesh);}
leaf(-2.26,-.47);leaf(3.51,-1.14);leaf(.66,2.32);leaf(2.59,4.00);
const rainPositions=new Float32Array(440*6),rainSeeds=[];for(let i=0;i<440;i++){rainSeeds.push({x:(Math.random()-.5)*19,z:(Math.random()-.5)*15,y:Math.random()*13,speed:9+Math.random()*5});}
const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));const rainLines=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:'#cededb',transparent:true,opacity:.2,depthWrite:false}));rainLines.visible=false;scene.add(rainLines);
const pointerMark=new THREE.Mesh(new THREE.RingGeometry(.075,.089,40),new THREE.MeshBasicMaterial({color:0xf3f8ec,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));pointerMark.userData.excludeWaterCapture=true;pointerMark.rotation.x=-Math.PI/2;pointerMark.renderOrder=4;pointerMark.visible=false;scene.add(pointerMark);
function splash(x,z,power=1){water.disturb(x,z,power);life.spook(x,z,power);for(let i=0;i<Math.min(30,10*power);i++){const mesh=new THREE.Mesh(dropGeo,dropMat);mesh.position.set(x,water.heightAt(x,z)+.04,z);scene.add(mesh);drops.push({mesh,v:new THREE.Vector3((Math.random()-.5)*2*power,1+Math.random()*2*power,(Math.random()-.5)*2*power)});}playSplash(power);}
function playSplash(power){if(!audioCtx||!soundOn)return;const count=audioCtx.sampleRate*.22,buffer=audioCtx.createBuffer(1,count,audioCtx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<count;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/count,3)*.18;const source=audioCtx.createBufferSource();source.buffer=buffer;const filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1200+power*800;source.connect(filter).connect(audioGain);source.start();}
function toggleSound(){soundOn=!soundOn;if(!audioCtx){audioCtx=new AudioContext();audioGain=audioCtx.createGain();audioGain.connect(audioCtx.destination);const buffer=audioCtx.createBuffer(1,audioCtx.sampleRate*3,audioCtx.sampleRate);let prev=0;const d=buffer.getChannelData(0);for(let i=0;i<d.length;i++){prev=(prev+(Math.random()*2-1)*.04)/1.025;d[i]=prev;}const source=audioCtx.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(audioGain);source.start();}audioCtx.resume();audioGain.gain.setTargetAtTime(soundOn?.35:0,audioCtx.currentTime,.3);ui.toast(soundOn?'Forest stream audio on':'Audio off');return soundOn;}
let nextBird=0;
function birdsong(){if(!audioCtx||!soundOn)return;const start=audioCtx.currentTime;for(let i=0;i<3;i++){const oscillator=audioCtx.createOscillator(),gain=audioCtx.createGain(),t=start+i*.16;oscillator.type='sine';oscillator.frequency.setValueAtTime(2100+i*270,t);oscillator.frequency.exponentialRampToValueAtTime(3400+i*100,t+.045);oscillator.frequency.exponentialRampToValueAtTime(2400+i*220,t+.13);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.04,t+.025);gain.gain.exponentialRampToValueAtTime(.0001,t+.15);oscillator.connect(gain).connect(audioGain);oscillator.start(t);oscillator.stop(t+.16);}}
let recorder,recordChunks=[],recordTimer;
function recordClip(){if(recorder?.state==='recording'){recorder.stop();return;}if(!canvas.captureStream||!window.MediaRecorder){ui.toast('Recording is unavailable in this browser');return;}const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));recorder=new MediaRecorder(canvas.captureStream(60),{...(mime?{mimeType:mime}:{}),videoBitsPerSecond:14000000});recordChunks=[];recorder.ondataavailable=e=>{if(e.data.size)recordChunks.push(e.data);};recorder.onstop=()=>{clearTimeout(recordTimer);ui.setRecording?.(false);const blob=new Blob(recordChunks,{type:recorder.mimeType});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='komorebi-water-'+Date.now()+(recorder.mimeType.includes('mp4')?'.mp4':'.webm');a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);recorder.stream.getTracks().forEach(t=>t.stop());ui.toast('Your clip is ready — saved to downloads');};recorder.start();ui.setRecording?.(true);ui.toast('Recording the scene · Click again to save · 30s maximum');recordTimer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},30000);}
function setTool(value){water.endStir();strokePoint=null;tool=value;raining=value==='rain';rainLines.visible=raining;ui.setTool(value);}
function hideUI(){cinematic=!cinematic;document.querySelector('#ui').style.opacity=cinematic?'0':'1';document.querySelector('#ui').style.pointerEvents=cinematic?'none':'';}
function applySettings(value){
  appSettings=normalizeSettings(value);strength=appSettings.stirStrength;flow=appSettings.wind;
  water.setSettings(appSettings);stoneThrows.setSettings(appSettings);paperBoats.setSettings(appSettings);life.setSettings(appSettings);
  const elevation=THREE.MathUtils.degToRad(appSettings.sunElevation),azimuth=THREE.MathUtils.degToRad(appSettings.sunAzimuth);
  sun.intensity=appSettings.sunIntensity;sun.position.set(Math.cos(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.sin(azimuth)*Math.cos(elevation)).multiplyScalar(30);
  skyUniforms.sunPosition.value.copy(sun.position).normalize();clouds.setSun(sun.position);water.setSun(sun.position,sun.color,sun.intensity);
  renderer.toneMappingExposure=appSettings.exposure;renderer.shadowMap.needsUpdate=true;
}
const ui=setupUI({initialSettings:appSettings,onSettings:applySettings, onTool:setTool,onReset:()=>{for(const o of [...debris,...drops])scene.remove(o.mesh);debris.length=drops.length=0;stoneThrows.reset();camera.position.set(0,15.2,9.5);controls.target.set(0,0,2.1);raining=false;setTool('stir');water.reset?.();life.reset();paperBoats.reset();ui.toast('A fresh moment of stillness');},onSound:toggleSound,onFullscreen:()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.();},onCinematic:hideUI,onRecord:recordClip});
function getHit(e){
  const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
  if(!raycaster.ray.intersectPlane(plane,hit))return false;
  // Solve against the displaced surface, not the flat floor or a screen offset.
  if(Math.abs(raycaster.ray.direction.y)>.02)for(let i=0;i<4;i++){
    const h=water.heightAt(hit.x,hit.z),t=(h-raycaster.ray.origin.y)/raycaster.ray.direction.y;
    if(t<0)return false;raycaster.ray.at(t,hit);
  }
  return Math.abs(hit.x)<9.7&&Math.abs(hit.z)<7.7&&environment.bankHeight(hit.x,hit.z)<-.06;
}
function interact(e,first=false){
  if(!getHit(e)){water.endStir();strokePoint=null;return;}
  if(tool==='stir'){
    const t=e.timeStamp*.001;
    if(first||!strokePoint){strokePoint={x:hit.x,z:hit.z,t};return;}
    const distance=Math.hypot(hit.x-strokePoint.x,hit.z-strokePoint.z);
    if(distance>.001){
      water.stirSegment(strokePoint.x,strokePoint.z,hit.x,hit.z,strength,Math.max(1/240,Math.min(.2,t-strokePoint.t)));
      strokePoint={x:hit.x,z:hit.z,t};
    }
  }else if(first&&tool==='stone'){
    stoneThrows.throwAt(hit.x,hit.z,.85,camera);
  }else if(first&&tool==='leaf'){leaf(hit.x,hit.z);water.disturb(hit.x,hit.z,.10);}
  else if(first&&tool==='feed'){life.feed(hit.x,hit.z);}
  else if(first&&tool==='boat'){paperBoats.add(hit.x,hit.z);}
  else if(first)splash(hit.x,hit.z,strength);
}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;down=true;strokePoint=null;canvas.setPointerCapture(e.pointerId);interact(e,true);});
canvas.addEventListener('pointermove',e=>{pointerMark.visible=getHit(e);pointerMark.position.set(hit.x,.05,hit.z);if(down)interact(e);});
canvas.addEventListener('pointerleave',()=>{pointerMark.visible=false;water.endStir();strokePoint=null;});
canvas.addEventListener('pointerup',()=>{down=false;water.endStir();strokePoint=null;});
canvas.addEventListener('pointercancel',()=>{down=false;water.endStir();strokePoint=null;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);postFX.resize(innerWidth,innerHeight);});
let last=performance.now(),frames=0,fpsTime=0,fpsLast=performance.now(),lastShadowTime=-Infinity;
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.04);last=now;time+=dt;if(soundOn&&time>nextBird){birdsong();nextBird=time+8+Math.random()*9;}controls.update();if(down&&tool==='stir'&&strokePoint)water.stirSegment(strokePoint.x,strokePoint.z,strokePoint.x,strokePoint.z,strength,dt);clouds.update(dt,time);if(time-lastShadowTime>((down||stones.some(s=>!s.impacted)||life.getState().startled>0||paperBoats.boats.some(b=>Math.hypot(b.vx,b.vz)>.15))?1/30:1/15)){renderer.shadowMap.needsUpdate=true;lastShadowTime=time;}environment.update?.(dt,time);vegetation.update(dt,time);life.update(dt,time);paperBoats.update(dt,time,flow);if(pointerMark.visible)pointerMark.position.y=.045+water.heightAt(pointerMark.position.x,pointerMark.position.z);if(raining){for(let i=0;i<rainSeeds.length;i++){const p=rainSeeds[i];p.y-=dt*p.speed;p.x+=dt*.24;if(p.y<0){if(environment.bankHeight(p.x,p.z)<-.05)water.disturb(p.x,p.z,.055+.065*strength);p.y=8+Math.random()*5;p.x=(Math.random()-.5)*19;p.z=(Math.random()-.5)*15;}rainPositions.set([p.x,p.y,p.z,p.x-.007,p.y+.22,p.z],i*6);}rainGeometry.attributes.position.needsUpdate=true;}
for(const o of debris){
  const p=o.mesh.position,motion=water.motionAt(p.x,p.z);
  o.vx=THREE.MathUtils.damp(o.vx||0,motion.vx*appSettings.floatResponse+Math.sin(time*.3+o.seed)*.025,5,dt);
  o.vz=THREE.MathUtils.damp(o.vz||0,motion.vz*appSettings.floatResponse+.025,5,dt);
  const nx=p.x+o.vx*dt,nz=p.z+o.vz*dt;
  if(environment.bankHeight(nx,nz)<-.05){p.x=nx;p.z=nz;}else{
    const gx=environment.bankHeight(p.x+.12,p.z)-environment.bankHeight(p.x-.12,p.z),gz=environment.bankHeight(p.x,p.z+.12)-environment.bankHeight(p.x,p.z-.12),len=Math.hypot(gx,gz)||1;
    o.vx=THREE.MathUtils.damp(o.vx,-gx/len*.035,8,dt);o.vz=THREE.MathUtils.damp(o.vz,-gz/len*.035,8,dt);
  }
  const x=p.x,z=p.z,h=water.heightAt(x,z),dx=(water.heightAt(x+.12,z)-water.heightAt(x-.12,z))/.24,dz=(water.heightAt(x,z+.12)-water.heightAt(x,z-.12))/.24;
  const curl=(water.motionAt(x+.12,z).vz-water.motionAt(x-.12,z).vz-water.motionAt(x,z+.12).vx+water.motionAt(x,z-.12).vx)/.24;
  p.y=.024+h;o.yaw+=dt*(.035+THREE.MathUtils.clamp(curl*.5*appSettings.floatResponse,-1.5,1.5));
  o.mesh.rotation.set(-Math.atan((dx*Math.sin(o.yaw)+dz*Math.cos(o.yaw))*appSettings.floatResponse),o.yaw,Math.atan((dx*Math.cos(o.yaw)-dz*Math.sin(o.yaw))*appSettings.floatResponse));
}
stoneThrows.update(dt,time);
for(let i=drops.length-1;i>=0;i--){const o=drops[i];o.v.y-=dt*9.8;o.mesh.position.addScaledVector(o.v,dt);o.mesh.scale.set(.8,1+Math.min(1.7,Math.abs(o.v.y)*.25),.8);if(o.mesh.position.y<water.heightAt(o.mesh.position.x,o.mesh.position.z)){water.disturb(o.mesh.position.x,o.mesh.position.z,.012);scene.remove(o.mesh);drops.splice(i,1);}}
inlet.update(dt,time);water.update(dt,time);postFX.render(dt);frames++;fpsTime+=Math.max((now-fpsLast)/1000,.001);fpsLast=now;if(fpsTime>.5){ui.setFPS(Math.round(frames/fpsTime));frames=0;fpsTime=0;}}
applySettings(appSettings);requestAnimationFrame(frame);window.__komorebi={scene,camera,renderer,postFX,water,environment,vegetation,sky,clouds,inlet,life,paperBoats,controls,setTool,splash,debris,stones,stoneThrows,applySettings,getSettings:()=>({...appSettings}),sun};
