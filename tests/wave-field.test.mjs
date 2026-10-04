import assert from 'node:assert/strict';
import {createWaveField} from '../src/wave-field.js';
const close=(a,b,t,message)=>assert.ok(Math.abs(a-b)<=t,`${message}: ${a} vs ${b}`);
const rmsDifference=(a,b)=>Math.sqrt(a.reduce((sum,h,i)=>sum+(h-b[i])**2,0)/a.length);
function radius(f){let moment=0,total=0;f.heights.forEach((h,i)=>{const r2=((i%192+.5)*20/192-10)**2+((Math.floor(i/192)+.5)*16/154-8)**2;moment+=h*h*r2;total+=h*h;});return Math.sqrt(moment/total);}
const impact=createWaveField();impact.disturb(0,0,1);
assert.ok(impact.heightAt(0,0)<-.05,'Impact starts as a depression');
assert.ok(impact.heightAt(.55,0)>0,'Displaced volume forms a shoulder');
close(impact.stats().mass,0,1e-7,'Initial impulse conserves volume');
const initialEnergy=impact.stats().energy;
impact.update(8);
assert.ok(impact.stats().energy<initialEnergy*.35,'Waves decay and domain sponge removes returning energy');
close(impact.stats().mass,0,1e-6,'Finite-volume flux conserves volume over time');
assert.ok(impact.heights.every(Number.isFinite));
const shallow=createWaveField({terrain:()=>-.08}),deep=createWaveField({terrain:()=>-1.2});
for(const f of [shallow,deep]){f.disturb(0,0,.1);f.update(.8);}
const speedRatio=radius(deep)/radius(shallow);
const expectedTravel=.8*Math.sqrt(9.81*Math.tanh((2*Math.PI/1.8)*1.2)/(2*Math.PI/1.8));
assert.ok(Math.abs(radius(deep)/expectedTravel-1)<.12,'Deep waves travel at the 1.8m-band phase speed, not shallow-water speed');
const k=2*Math.PI/1.8,expectedRatio=Math.sqrt(Math.tanh(k*1.2)/Math.tanh(k*.08));
assert.ok(Math.abs(speedRatio/expectedRatio-1)<.12,`Propagation follows finite-depth gravity-wave speed: ${speedRatio} vs ${expectedRatio}`);
const partitionA=createWaveField(),partitionB=createWaveField();
for(const f of [partitionA,partitionB])f.disturb(.3,-.7,.9);
partitionA.update(1);for(let i=0;i<60;i++)partitionB.update(1/60);
assert.deepEqual(partitionA.heights,partitionB.heights,'Fixed simulation is independent of render cadence');
function stroke(events,interleave){const f=createWaveField();for(let i=0;i<events;i++){f.stirSegment(-3+6*i/events,0,-3+6*(i+1)/events,0,1,1/events);if(interleave)f.update(1/events);}if(!interleave)f.update(.25);return f;}
const sparse=stroke(7,false),dense=stroke(91,false);
assert.ok(rmsDifference(sparse.heights,dense.heights)<.0001,'Spatially integrated forcing is independent of pointer partition');
const sixty=stroke(60,true),oneTwenty=stroke(120,true);
assert.ok(rmsDifference(sixty.heights,oneTwenty.heights)<.001,'Timed stroke remains consistent across event rates');
assert.ok(oneTwenty.stats().maxHeight>.025&&oneTwenty.stats().maxAbsHeight<.15,'Stroke produces visible, bounded centimetre-scale waves');
close(oneTwenty.stats().mass,0,1e-6,'Dragging adds momentum, not water volume');
const shore=createWaveField({terrain:(x,z)=>x>2||z>3?.2:-.6});shore.setObstacles([{x:0,z:0,radius:.8}]);
shore.disturb(1.1,0,2);for(let i=0;i<180;i++){shore.stirSegment(-2,1,-1,1,1,1/60);shore.update(1/60);}
close(shore.heightAt(0,0),0,0,'Obstacle remains dry');close(shore.heightAt(3,0),0,0,'Raised terrain remains dry');
assert.ok(shore.heights.every(Number.isFinite));assert.ok(shore.stats().maxAbsHeight<.5,'Repeated forcing remains bounded');
close(shore.stats().mass,0,2e-5,'Shoreline and obstacle faces conserve volume');
const abyss=createWaveField({width:2,depth:2,nx:192,nz:154,terrain:()=>-30});assert.ok(abyss.stats().substeps>1,'Fine custom grids use CFL substeps');abyss.disturb(0,0);abyss.update(2);assert.ok(abyss.stats().maxAbsHeight<.1&&abyss.heights.every(Number.isFinite));
oneTwenty.fillTexture();for(let i=0;i<oneTwenty.heights.length;i++)assert.equal(oneTwenty.texturePixelsRGBA[i*4],oneTwenty.heights[i]);
oneTwenty.reset();assert.equal(oneTwenty.stats().energy,0);assert.equal(oneTwenty.stats().stepCount,0);
console.log('Wave-field tests passed: depth speed, mass, damping, CFL, shore/obstacle boundaries, stroke partition and render cadence.');

// One impact yields a decaying train via localized cavity rebound, then the
// source expires. Sample distinct radial maxima rather than counting events.
const rebound=createWaveField();rebound.disturb(0,0,1);rebound.update(.9);
let crests=0;
for(let r=.2;r<2.4;r+=.05){const h=rebound.heightAt(r,0);if(h>.003&&h>rebound.heightAt(r-.05,0)&&h>=rebound.heightAt(r+.05,0))crests++;}
assert.ok(crests>=3&&crests<=5,`One stone emits3–5 coherent concentric crests: ${crests}`);
close(rebound.stats().mass,0,1e-6,'Cavity rebound conserves water volume');
assert.ok(rebound.stats().maxAbsHeight<.08,'Rebound stays gentle');
rebound.update(.3);assert.equal(rebound.stats().activeImpacts,0,'Source stops after1.2seconds');
rebound.update(1);close(rebound.stats().mass,0,1e-6,'Freely travelling packet retains volume');
console.log('Single-impact cavity rebound: three resolved travelling crests, bounded amplitude, zero added volume, finite source lifetime.');

const {bankHeight}=await import('../src/environment.js');
const gardenImpact=createWaveField({terrain:bankHeight});gardenImpact.disturb(2.3,-.65,.85*1.65);
assert.ok(gardenImpact.stats().maxAbsHeight<.15,'Default stone cavity stays below15cm');
gardenImpact.update(.7);
assert.ok(gardenImpact.stats().maxHeight>=.018&&gardenImpact.stats().maxHeight<.04,'Stone crests remain visible at700ms in the actual garden');
close(gardenImpact.stats().mass,0,1e-6,'Actual terrain impact preserves volume');
const strong=createWaveField({terrain:bankHeight});strong.disturb(2.3,-.65,2);let strongPeak=0;
for(let i=0;i<180;i++){strong.update(1/120);strongPeak=Math.max(strongPeak,strong.stats().maxAbsHeight);}
assert.ok(strongPeak<.15,`Strongest stone remains bounded below15cm: ${strongPeak}`);
console.log('Actual garden stone: visible travelling crests at700ms; maximum-power cavity remains below15cm.');

function gardenStroke(fps){const f=createWaveField({terrain:bankHeight}),steps=fps*1.5;for(let i=0;i<steps;i++){f.stirSegment(-3+6*i/steps,2,-3+6*(i+1)/steps,2,.85,1/fps);f.update(1/fps);}return f;}
const gardenDrag=gardenStroke(60),gardenDragFine=gardenStroke(120);
assert.ok(gardenDrag.stats().maxHeight>.04&&gardenDrag.stats().maxHeight<.07,'Default real-terrain drag makes a4–7cm bow crest');
assert.ok(rmsDifference(gardenDrag.heights,gardenDragFine.heights)<.001,'Actual-terrain drag remains event-cadence independent');
gardenDrag.update(.6);
let outwardPeak=0;for(let x=-3;x<4;x+=.15)for(const z of [.9,1.1,2.9,3.1])outwardPeak=Math.max(outwardPeak,Math.abs(gardenDrag.heightAt(x,z)));
assert.ok(outwardPeak>.01,'Continuous wake propagates at least.9m laterally after release');
close(gardenDrag.stats().mass,0,1e-6,'Real-terrain drag conserves volume');
const sustained=createWaveField({terrain:bankHeight});let dragPeak=0;
for(let i=0;i<1200;i++){const t=i/60;sustained.stirSegment(3*Math.sin(t*3),2*Math.cos(t*2),3*Math.sin((t+1/60)*3),2*Math.cos((t+1/60)*2),.85,1/60);sustained.update(1/60);dragPeak=Math.max(dragPeak,sustained.stats().maxAbsHeight);}
assert.ok(dragPeak<.18,`Twenty seconds of fast repeated stirring stays below18cm: ${dragPeak}`);
console.log('Real-terrain stirring: visible bow crest, outward wake, cadence consistency and sustained stability.');

const normalField=createWaveField({terrain:(x)=>x>0?.2:-1});
for(let i=0;i<normalField.heights.length;i++)normalField.heights[i]=i%192<96?.02:0;
normalField.fillTexture();
for(let z=0;z<154;z++)assert.equal(normalField.texturePixelsRGBA[(z*192+95)*4+1],0,'Reflective shore must not become a fake normal cliff');
normalField.reset();normalField.disturb(-2,0,.1);normalField.update(.2);normalField.fillTexture();
const ix=76,iz=77,offset=iz*192+ix;
close(normalField.texturePixelsRGBA[offset*4+1],(normalField.heights[offset+1]-normalField.heights[offset-1])/(40/192),1e-7,'G stores metric x slope');
close(normalField.texturePixelsRGBA[offset*4+2],(normalField.heights[offset+192]-normalField.heights[offset-192])/(32/154),1e-7,'B stores metric z slope');
const ribbon=createWaveField({terrain:bankHeight});
for(let i=0;i<90;i++){const a=i/90,b=(i+1)/90;ribbon.stirSegment(-4+8*a,1.5+Math.sin(Math.PI*a),-4+8*b,1.5+Math.sin(Math.PI*b),.85,.02);ribbon.update(.02);}
let visibleBands=0;for(let z=-1;z<4.9;z+=.05){const h=ribbon.heightAt(0,z);if(h>.003&&h>ribbon.heightAt(0,z-.05)&&h>=ribbon.heightAt(0,z+.05))visibleBands++;}
assert.ok(visibleBands>=4,'Continuous curved drag has two main fronts and two weaker return-flow crests');
close(ribbon.stats().mass,0,1e-6,'Return-flow forcing preserves volume');
console.log('Slope texture and continuous return-flow bands pass.');

// Production's 6.25cm mesh resolves the impact footprint with >2cells/sigma.
const high=createWaveField({nx:320,nz:256,terrain:bankHeight});
high.disturb(2.3,-.65,1.4);let highPeak=high.stats().maxAbsHeight;
for(let i=0;i<1200;i++){
  if(i<90)high.stirSegment(-3+6*i/90,2,-3+6*(i+1)/90,2,.85,1/60);
  high.update(1/60);highPeak=Math.max(highPeak,high.stats().maxAbsHeight);
}
assert.ok(high.heights.every(Number.isFinite),'320x256 simulation remains finite for20s');
assert.ok(highPeak<.18,`High-resolution combined source bounded: ${highPeak}`);
close(high.stats().mass,0,2e-6,'High-resolution sources conserve volume');
let dryCells=0;for(let z=0;z<256;z++)for(let x=0;x<320;x++)if(bankHeight((x+.5)*20/320-10,(z+.5)*16/256-8)>=-.018){dryCells++;assert.equal(high.heights[z*320+x],0,'High-resolution dry terrain remains dry');}
assert.ok(dryCells>1000);
function ringAnisotropy(nx,nz){const f=createWaveField({nx,nz});f.disturb(0,0,1.4);f.update(.7);const peaks=[];for(let a=0;a<16;a++){const angle=a/16*Math.PI*2;let peak=-Infinity;for(let r=.65;r<1.2;r+=.0125)peak=Math.max(peak,f.heightAt(Math.cos(angle)*r,Math.sin(angle)*r));peaks.push(peak);}return (Math.max(...peaks)-Math.min(...peaks))/(peaks.reduce((a,b)=>a+b,0)/peaks.length);}
const lowAnisotropy=ringAnisotropy(192,154),highAnisotropy=ringAnisotropy(320,256);
assert.ok(highAnisotropy<lowAnisotropy,'Finer grid reduces angular wavefront amplitude bias');
console.log('320x256 production regression:',{peak:highPeak,mass:high.stats().mass,dryCells,lowAnisotropy,highAnisotropy});
