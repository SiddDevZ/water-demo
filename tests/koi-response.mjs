import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLife} from '../src/life.js';
import {bankHeight} from '../src/environment.js';
const gradient={addColorStop(){}};
const ctx=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(o,k)=>o[k]??(()=>{})});
globalThis.document={createElement:()=>({width:512,height:256,getContext:()=>ctx})};
function make(){let active=false;const water={heightAt:()=>0,disturb(){},motionAt:(x,z)=>active&&x<0?{vx:.32,vz:.14,height:.09}:{vx:0,vz:0,height:0}};return {life:createLife(new THREE.Scene(),water,bankHeight),wake(){active=true;}};}
const calm=make(),wake=make();wake.wake();
for(let i=0;i<45;i++){calm.life.update(1/60,i/60);wake.life.update(1/60,i/60);}
let a=calm.life.getState(),b=wake.life.getState();
assert(b.startled>0,'local velocity produces a wake response');
assert(b.fish[0].speed>a.fish[0].speed*1.4,'wake causes a visible speed burst');
assert(b.fish[0].tailAmplitude>a.fish[0].tailAmplitude*1.3,'tail kick is stronger');
assert(Math.hypot(b.fish[0].x-a.fish[0].x,b.fish[0].z-a.fish[0].z)>.1,'wake visibly changes path');
for(let i=45;i<1200;i++){wake.life.update(1/60,i/60);for(const p of wake.life.getState().fish){assert(bankHeight(p.x,p.z)<-.3);assert(p.y<-.10);assert(p.y-bankHeight(p.x,p.z)>=.18);}}
calm.life.reset();calm.life.spook(-3,1,1);assert(calm.life.getState().startled>0,'stone impact startles nearby koi');
const feeding=make();feeding.life.feed(0,1);const initial=feeding.life.getState();const distance=s=>s.fish.reduce((v,p)=>v+Math.hypot(p.x,p.z-1),0)/6;
for(let i=0;i<480;i++)feeding.life.update(1/60,i/60);
assert(distance(feeding.life.getState())<distance(initial),'calm koi still approach food');
console.log('PASS koi wake steering, tail kick, speed,20s bed safety, stone startle, feeding');
