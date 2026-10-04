import * as THREE from 'three';

// Only airborne contact spray lives here. The height-field owns every water impulse.
export function createStirEffects(scene,water,bankHeight){
  const capacity=48,particles=[],dummy=new THREE.Object3D();
  const geometry=new THREE.SphereGeometry(.012,7,5);
  const material=new THREE.MeshPhysicalMaterial({color:0xcfe8ed,roughness:.10,metalness:0,clearcoat:1,clearcoatRoughness:.08,transparent:true,opacity:.46,depthWrite:false});
  const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name='Pointer contact water spray';mesh.count=0;mesh.frustumCulled=false;mesh.userData.excludeWaterCapture=true;scene.add(mesh);
  let choppiness=1,credit=0,seed=4217;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const height=(x,z)=>Number(water.heightAt?.(x,z))||0;
  const wet=(x,z)=>Math.abs(x)<9.9&&Math.abs(z)<7.9&&Number.isFinite(bankHeight(x,z))&&bankHeight(x,z)<-.08;
  function setSettings(config={}){
    if(typeof config?.stirChoppiness==='number'&&Number.isFinite(config.stirChoppiness))choppiness=THREE.MathUtils.clamp(config.stirChoppiness,0,1.5);
    if(choppiness===0)reset();
  }
  function stirSegment(x0,z0,x1,z1,strength=1,seconds=1/60){
    if(![x0,z0,x1,z1,strength,seconds].every(Number.isFinite)||strength<=0||seconds<=0||!choppiness)return;
    const dx=x1-x0,dz=z1-z0,length=Math.hypot(dx,dz);if(length<.003||length>2)return;
    const speed=length/Math.max(seconds,1/240);
    // Slow displacement stays entirely in the water surface. Faster cuts shed a
    // few millimeter-sized droplets from the bow, never a continuous white line.
    if(speed<1.2){credit=0;return;}
    const energy=THREE.MathUtils.clamp((speed-1.2)/3.4,0,1)*THREE.MathUtils.clamp(strength,0,1.5)*choppiness;
    credit+=Math.min(seconds,.06)*Math.min(58,energy*36);
    const count=Math.min(5,Math.floor(credit));credit-=count;
    const tx=dx/length,tz=dz/length;
    for(let i=0;i<count;i++){
      if(particles.length>=capacity)break;
      const along=.68+random()*.32,side=(random()-.5)*.13;
      const x=x0+dx*along+tx*.045-tz*side,z=z0+dz*along+tz*.045+tx*side;
      if(!wet(x,z))continue;
      const spread=(random()-.5)*.9,forward=.20+Math.min(speed,5)*(.08+random()*.055);
      const lift=(.50+random()*.68)*Math.sqrt(Math.min(energy,1.8));
      particles.push({x,y:height(x,z)+.018,z,vx:tx*forward-tz*spread,vz:tz*forward+tx*spread,vy:lift,age:0,life:.32+random()*.15,scale:.38+random()*.62});
    }
  }
  function update(dt){
    dt=THREE.MathUtils.clamp(Number.isFinite(dt)?dt:0,0,.06);
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];p.age+=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt-4.9*dt*dt;p.vy-=9.8*dt;
      if(p.age>p.life||!wet(p.x,p.z)||p.y<=height(p.x,p.z)){particles.splice(i,1);continue;}
    }
    mesh.count=particles.length;
    particles.forEach((p,i)=>{
      const fade=1-THREE.MathUtils.smoothstep(p.age/p.life,.55,1);
      dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.vz*.12,0,-p.vx*.12);
      const scale=p.scale*fade;dummy.scale.set(scale,scale*Math.min(2.3,1+Math.abs(p.vy)*.55),scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate=true;
  }
  function reset(){particles.length=0;credit=0;mesh.count=0;}
  return {mesh,stirSegment,update,reset,setSettings,getState:()=>({count:particles.length,capacity,choppiness}),dispose(){reset();scene.remove(mesh);geometry.dispose();material.dispose();}};
}
