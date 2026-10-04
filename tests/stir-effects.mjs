import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStirEffects } from '../src/stir-effects.js';

let impulses=0;
const water={heightAt:()=>0,disturb(){impulses++;},stirSegment(){impulses++;}};
const scene=new THREE.Scene();
const spray=createStirEffects(scene,water,()=>-1);
const stroke=(distance,steps=60)=>{
  for(let i=0;i<steps;i++){
    spray.stirSegment(0,0,distance,0,1,1/60);
    spray.update(1/60);
  }
};
stroke(.005);
assert.equal(spray.getState().count,0,'Slow dragging must not emit spray');
stroke(.08);
assert(spray.getState().count>0,'Fast dragging should emit contact droplets');
assert(spray.getState().count<=spray.getState().capacity);

// Saturating input without advancing time exercises the actual population cap.
spray.reset();
for(let i=0;i<1000;i++)spray.stirSegment(0,0,.2,0,1.5,1/60);
assert.equal(spray.getState().count,48,'Particle population must be bounded');
spray.update(0);
for(let i=0;i<spray.mesh.count*16;i++)assert(Number.isFinite(spray.mesh.instanceMatrix.array[i]));
for(let i=0;i<60;i++)spray.update(1/60);
assert.equal(spray.getState().count,0,'All droplets must settle or expire');

const dry=createStirEffects(scene,water,()=>.2);
for(let i=0;i<100;i++)dry.stirSegment(0,0,.2,0,1,1/60);
assert.equal(dry.getState().count,0,'Dry ground must reject contact spray');
spray.setSettings({stirChoppiness:9});
assert.equal(spray.getState().choppiness,1.5,'Module and settings range must agree');
spray.setSettings({stirChoppiness:NaN});
assert.equal(spray.getState().choppiness,1.5,'Nonfinite settings must be ignored');
stroke(.08);
assert(spray.getState().count>0);
spray.setSettings({stirChoppiness:0});
assert.equal(spray.getState().count,0,'Disabling should clear active spray');
stroke(.08);
assert.equal(spray.getState().count,0,'Zero choppiness must remain silent');
assert.equal(impulses,0,'Visual contact spray must never inject secondary waves');
spray.dispose();dry.dispose();
assert.equal(scene.children.length,0,'Disposal should remove spray meshes');
console.log('Stir effects: slow/fast contact, cap, expiry, dry rejection, settings, disposal, and no secondary impulses passed.');
