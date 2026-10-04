import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBoats} from '../src/boats.js';
import {createWaveField} from '../src/wave-field.js';
const ctx=new Proxy({},{get:()=>()=>{}});globalThis.document={createElement:()=>({getContext:()=>ctx})};
function rig(){const f=createWaveField();const boats=createBoats(new THREE.Scene(),{heightAt:f.heightAt,motionAt:f.motionAt,disturb(){},stirSegment(){}},()=>-1.2);boats.add(0,0);return {f,boats};}
const quiet=rig();for(let i=0;i<1200;i++){quiet.f.update(1/60);quiet.boats.update(1/60,i/60);}assert.equal(quiet.boats.boats[0].mesh.position.x,0);assert.equal(quiet.boats.boats[0].mesh.rotation.z,0);
for(const kind of ['impact','stir']){const {f,boats}=rig();if(kind==='impact')f.disturb(.65,.25,1.4);let peak=0,travel=0;for(let i=0;i<1200;i++){if(kind==='stir'&&i<90)f.stirSegment(-3+6*i/90,.25,-3+6*(i+1)/90,.25,.85,1/60);f.update(1/60);boats.update(1/60,i/60);const b=boats.boats[0];peak=Math.max(peak,Math.abs(b.pitch),Math.abs(b.roll));travel=Math.max(travel,Math.hypot(b.mesh.position.x,b.mesh.position.z));assert.ok([b.mesh.position.x,b.mesh.position.y,b.mesh.position.z,b.yaw].every(Number.isFinite));}const b=boats.boats[0];console.log(kind,{rockDegrees:peak*180/Math.PI,drift:travel});assert.ok(peak>.005&&peak<.3,'Waves rock hull without destabilizing');assert.ok(travel>(kind==='impact'?.001:.01),'Wave motion displaces hull');}
function cadence(fps){const b=createBoats(new THREE.Scene(),{heightAt:(x,z)=>.08*x+.04*z,motionAt:()=>({vx:.18,vz:.07}),disturb(){}},()=>-1.2);b.add(0,0);for(let i=0;i<fps*5;i++)b.update(1/fps,i/fps);return b.boats[0];}
const a=cadence(60),b=cadence(120);assert.ok(a.mesh.position.distanceTo(b.mesh.position)<1e-8);assert.ok(Math.abs(a.yaw-b.yaw)<1e-8);
const dry=createWaveField({terrain:(x)=>x>0?1:-1});dry.stirSegment(-2,0,-1,0,1,.2);assert.deepEqual(dry.motionAt(1,0),{vx:0,vz:0,height:0});assert.deepEqual(dry.motionAt(20,0),{vx:0,vz:0,height:0});assert.ok(dry.motionAt(-1.5,0).vx>0);
console.log('Boat motion passes quiet, impact, stirring, 20s stability, fixed-step cadence and dry velocity sampling.');
