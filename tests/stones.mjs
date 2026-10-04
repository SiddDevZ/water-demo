import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStones } from '../src/stones.js';
// Isolate physics from browser image loading. The actual scanned texture is checked separately.
const originalLoad=THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load=()=>new THREE.Texture();
try {
 let impulses=0,events=0,point;
 const scene=new THREE.Scene(),water={heightAt:()=>0,disturb:()=>impulses++};
 const system=createStones(scene,water,()=>-1,{onImpact:(x,z)=>{events++;point=[x,z];}});
 assert(system.throwAt(1,-2,1,{position:new THREE.Vector3(4,6,12)}));
 for(let i=0;i<600;i++)system.update(1/120,i/120);
 assert.equal(events,1,'one toss emits one impact event');
 assert.equal(impulses,1,'settling never repeats the water impulse');
 assert(Math.hypot(point[0]-1,point[1]+2)<.05,'ballistic impact lands within 5cm of target');
 assert.equal(system.stones[0].settled,true,'stone sinks to the bed');
 assert(system.stones[0].mesh.position.y>=-.92,'stone does not fall through bed');
 system.reset();assert.equal(system.stones.length,0);
 assert.equal(system.group.children.length,0,'reset removes droplets and crown too');
 const dry=createStones(scene,water,()=>.1);
 assert.equal(dry.throwAt(1,1,1),false,'dry terrain rejects a throw');
 for(let i=0;i<20;i++)system.throwAt(0,0,1);
 assert.equal(system.stones.length,14,'repeated discrete throws respect the cap');
 system.reset();
 console.log('PASS: single impact, accurate target, sinking, reset, dry rejection and cap.');
} finally {THREE.TextureLoader.prototype.load=originalLoad;}
