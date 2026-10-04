import * as THREE from 'three';

export function createStones(scene,water,bankHeight,{onImpact}={}){
 const settings={stoneSize:1,throwDuration:.20,splashScale:1};
 function setSettings(config={}){config=config||{};for(const [key,lo,hi]of [['stoneSize',.6,1.4],['throwDuration',.1,.6],['splashScale',0,1.5]]){if(typeof config[key]==='number'&&Number.isFinite(config[key]))settings[key]=THREE.MathUtils.clamp(config[key],lo,hi);}for(const stone of stones)stone.mesh.scale.set(.82,.57,.72).multiplyScalar(settings.stoneSize);}
 const stones=[],effects=[],group=new THREE.Group();group.name='One-stone water tosses';scene.add(group);
 const loader=new THREE.TextureLoader(),map=loader.load('/assets/terrain/dark_rock_02/dark_rock_02_diffuse_1k.jpg');map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
 const geometry=new THREE.SphereGeometry(.16,24,16),material=new THREE.MeshStandardMaterial({map,color:0xffffff,roughness:.78,metalness:0});
 const pebblePositions=geometry.attributes.position;
 for(let i=0;i<pebblePositions.count;i++){
  const x=pebblePositions.getX(i),y=pebblePositions.getY(i),z=pebblePositions.getZ(i);
  const shape=1+.042*Math.sin(x*19+y*11)+.031*Math.cos(z*22-x*13)+.012*Math.sin(y*31+z*17);
  pebblePositions.setXYZ(i,x*shape,y*shape,z*shape);
 }
 geometry.computeVertexNormals();
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float mineral=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*1.7,0.0,1.0);
   diffuseColor.rgb=mix(vec3(.16,.15,.13),vec3(.35,.325,.28),pow(mineral,.6));
 `);};
 material.customProgramCacheKey=()=> 'warm-river-pebble-v1';
 material.userData.waterCaustics=true;
 const dropletGeometry=new THREE.SphereGeometry(.024,8,6),dropletMaterial=new THREE.MeshStandardMaterial({color:'#e1f2f1',roughness:.10,metalness:0,transparent:true,opacity:.74,depthWrite:false});
 const surface=(x,z)=>water.heightAt?.(x,z)||0;
 const sheetGeo=new THREE.CylinderGeometry(1,.62,1,80,3,true);
 // Ten fine irregular fingers break the crown rim; the base remains a thin sheet.
 const rim=sheetGeo.attributes.position;
 for(let i=0;i<rim.count;i++){
  const x=rim.getX(i),z=rim.getZ(i),y=rim.getY(i),a=Math.atan2(z,x),t=y+.5;
  const fingers=Math.pow(.5+.5*Math.sin(a*10+.32*Math.sin(a*3)),5);
  const height=.65+.28*fingers+.08*Math.sin(a*3+.6)+.055*Math.cos(a*7);
  const radial=1+t*(.045*Math.sin(a*5)+.025*Math.cos(a*9));
  rim.setXYZ(i,x*radial,-.5+t*height,z*radial);
 }
 sheetGeo.computeVertexNormals();
 function impact(stone){
  if(stone.impacted)return;stone.impacted=true;stone.impactAge=0;stone.velocity.multiplyScalar(.24);
  const p=stone.mesh.position,power=THREE.MathUtils.clamp(stone.strength,.3,1.7);
  // This module owns exactly one water impulse. Callback is sound/life feedback only.
  water.disturb(p.x,p.z,Math.min(2,power*1.65));onImpact?.(p.x,p.z,power);
  if(settings.splashScale===0)return;
  const material=new THREE.MeshStandardMaterial({color:'#e3f3f5',roughness:.12,metalness:0,side:THREE.DoubleSide,transparent:true,opacity:.30,depthWrite:false});
  const crown=new THREE.Mesh(sheetGeo,material);crown.position.set(p.x,surface(p.x,p.z),p.z);group.add(crown);
  const jet=new THREE.Mesh(new THREE.SphereGeometry(1,10,12),material);jet.position.copy(crown.position);group.add(jet);
  const drops=[];for(let i=0;i<13;i++){const a=i/13*Math.PI*2+Math.random()*.25,mesh=new THREE.Mesh(dropletGeometry,dropletMaterial);mesh.position.copy(crown.position);const speed=(.6+Math.random()*.75)*settings.splashScale;const v=new THREE.Vector3(Math.cos(a)*speed,(3.2+Math.random()*1.25)*Math.sqrt(settings.splashScale),Math.sin(a)*speed);mesh.scale.setScalar((.75+Math.random()*.65)*settings.splashScale);group.add(mesh);drops.push({mesh,v});}
  effects.push({crown,jet,drops,age:0,power});
 }
 function throwAt(x,z,strength=1,camera){
  if(!Number.isFinite(x+z)||bankHeight(x,z)>-.14)return false;
  const target=new THREE.Vector3(x,surface(x,z)+.075*settings.stoneSize,z),start=target.clone();
  const toward=new THREE.Vector3(camera?.position.x??x+3,0,camera?.position.z??z+5).sub(new THREE.Vector3(x,0,z)).normalize();
  const distance=1.25;start.addScaledVector(toward,distance);start.y=target.y+.65;
  const duration=settings.throwDuration,velocity=target.clone().sub(start).divideScalar(duration);velocity.y+=9.8*duration*.5;
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Thrown river pebble';mesh.position.copy(start);mesh.scale.set(.82,.57,.72).multiplyScalar(settings.stoneSize);mesh.rotation.set(Math.random(),Math.random()*6.28,Math.random());mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  stones.push({mesh,velocity,strength,targetX:x,targetZ:z,duration,flightAge:0,age:0,impacted:false,spin:new THREE.Vector3(.35,.6,.2),settled:false});
  if(stones.length>14)group.remove(stones.shift().mesh);return true;
 }
 function update(dt,time){
  const stepCount=Math.max(1,Math.ceil(Math.min(dt,.08)/.008)),step=Math.min(dt,.08)/stepCount;
  for(let i=stones.length-1;i>=0;i--){const s=stones[i];s.age+=dt;
   for(let k=0;k<stepCount;k++){
    if(s.settled)break;const p=s.mesh.position,oldY=p.y;
    const gravity=s.impacted?3.2:9.8;if(s.impacted)s.velocity.multiplyScalar(Math.exp(-step*1.8));p.addScaledVector(s.velocity,step);p.y-=.5*gravity*step*step;s.velocity.y-=step*gravity;s.mesh.rotation.x+=s.spin.x*step;s.mesh.rotation.y+=s.spin.y*step;s.mesh.rotation.z+=s.spin.z*step;
    s.flightAge+=step;const waterY=surface(s.targetX,s.targetZ)+.075*settings.stoneSize;
    if(!s.impacted&&s.flightAge>=s.duration-1e-8){p.set(s.targetX,waterY,s.targetZ);impact(s);}
    const floor=bankHeight(p.x,p.z)+.09*settings.stoneSize;if(s.impacted&&p.y<floor){p.y=floor;s.settled=true;s.mesh.rotation.x=.1;s.mesh.rotation.z=.15;}
   }
   if(s.age>18){group.remove(s.mesh);stones.splice(i,1);}
  }
  for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.age+=dt;const t=e.age/.44,scale=settings.splashScale;
   e.crown.visible=t<1&&scale>0;const radius=(.045+.34*e.age)*scale;e.crown.scale.set(radius,Math.max(.002,Math.sin(Math.min(1,t)*Math.PI)*.14*scale),radius);e.crown.position.y=surface(e.crown.position.x,e.crown.position.z)+e.crown.scale.y*.42;e.crown.material.opacity=.28*Math.max(0,1-t);
   const jetPhase=THREE.MathUtils.clamp((e.age-.07)/.50,0,1),jetHeight=.20*scale*Math.sin(jetPhase*Math.PI);e.jet.visible=jetHeight>.008;e.jet.scale.set(.026*scale,Math.max(.001,jetHeight*.5),.026*scale);e.jet.position.y=surface(e.jet.position.x,e.jet.position.z)+jetHeight*.5;
   for(const d of e.drops){d.v.y-=9.8*dt;d.mesh.position.addScaledVector(d.v,dt);d.mesh.scale.y=Math.max(.9,Math.abs(d.v.y)*.7)*scale;if(scale===0)d.mesh.visible=false;if(d.mesh.position.y<surface(d.mesh.position.x,d.mesh.position.z))d.mesh.visible=false;}
   if(e.age>1.1){group.remove(e.crown,e.jet);e.jet.geometry.dispose();e.crown.material.dispose();e.drops.forEach(d=>group.remove(d.mesh));effects.splice(i,1);}
  }
 }
 function reset(){for(const s of stones)group.remove(s.mesh);stones.length=0;for(const e of effects){group.remove(e.crown,e.jet);e.jet.geometry.dispose();e.crown.material.dispose();e.drops.forEach(d=>group.remove(d.mesh));}effects.length=0;}
 return {group,stones,throwAt,update,reset,setSettings};
}
