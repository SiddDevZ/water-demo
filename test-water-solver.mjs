import './tests/wave-field.test.mjs';
import './tests/stones.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWater,sampleAmbientWaves } from './src/water.js';

const draws=[];let target=null,color=new THREE.Color('#18242c'),alpha=.8;
const renderer={xr:{enabled:false},shadowMap:{autoUpdate:true},clippingPlanes:[],autoClear:false,toneMapping:THREE.ACESFilmicToneMapping,
 getDrawingBufferSize:v=>v.set(800,450),getRenderTarget:()=>target,getScissorTest:()=>false,
 getViewport:v=>v.set(0,0,800,450),getScissor:v=>v.set(0,0,800,450),getClearColor:v=>v.copy(color),getClearAlpha:()=>alpha,
 setClearColor(v,a){color.set(v);alpha=a;},setRenderTarget(v){target=v;},setViewport(){},setScissor(){},setScissorTest(){},
 render(scene,camera){draws.push({scene,camera:camera.clone(),target});}
};
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,16/9,.1,240);
camera.position.set(3.2,3.8,11);camera.lookAt(0,0,-1.8);
const marker=new THREE.Mesh(new THREE.SphereGeometry(.1),new THREE.MeshBasicMaterial());
marker.userData.excludeWaterCapture=true;marker.visible=false;scene.add(marker);
const water=createWater(scene,renderer,camera);water.setTerrain(()=>-1.85);water.setFlow(0);
water.update(1/60,0);
assert.equal(draws.length,4,'Ray density, filter, transmission and reflection render initially');
assert.equal(renderer.getRenderTarget(),null);assert.equal(renderer.autoClear,false);
assert.equal(renderer.toneMapping,THREE.ACESFilmicToneMapping);assert.equal(marker.visible,false,'Hidden capture exclusions stay hidden');
assert.equal(renderer.getClearColor(new THREE.Color()).getHexString(),'18242c');
assert.equal(renderer.getClearAlpha(),.8);
const mirror=draws[3].camera;
assert(Math.abs(mirror.position.y+camera.position.y)<1e-12,'Mirror camera reflects height');
assert.notDeepEqual(mirror.projectionMatrix.elements,camera.projectionMatrix.elements,'Mirror clips submerged geometry with oblique plane');
for(let i=1;i<=60;i++)water.update(1/60,i/60);
assert.equal(draws.length,244,'Moving optics refresh at60Hz without skipped floating-point ticks');
water.disturb(0,0,1);water.update(1/60,1.02);
assert(water.waveField.stats().energy>0);assert(Math.abs(water.waveField.stats().mass)<1e-7);
water.reset();water.setFlow(.65);water.update(0,2.3);
assert(Math.abs(water.heightAt(1.3,-.7)-sampleAmbientWaves(1.3,-.7,2.3).height)<1e-12,'CPU float height matches deep rendered ambient');
water.setTerrain((x)=>x/4-.5);water.setFlow(0);water.disturb(3,0,1);water.update(1/60,2.4);
assert.equal(water.waveField.stats().energy,0,'Dry land rejects impulses');assert.equal(water.heightAt(3,0),0);
for(const[x,z,t]of[[1.7,-.8,2.2],[-4.1,2.9,6.2]]){
 const h=sampleAmbientWaves(x,z,t),e=1e-5;
 const dx=(sampleAmbientWaves(x+e,z,t).height-sampleAmbientWaves(x-e,z,t).height)/(2*e);
 const dz=(sampleAmbientWaves(x,z+e,t).height-sampleAmbientWaves(x,z-e,t).height)/(2*e);
 assert(Math.abs(dx-h.slopeX)<1e-7&&Math.abs(dz-h.slopeZ)<1e-7);
}
assert.equal(water.mesh.receiveShadow,true);assert.equal(water.mesh.material.lights,true);
water.dispose();
console.log('PASS: optical state restoration, live60Hz mirror, oblique clipping, dry masks, CPU normals and shadow bindings.');
