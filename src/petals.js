import * as THREE from 'three';
export function createPetals(scene,water,bankHeight){
  let floatResponse=1;
  function setSettings(config={}){config=config||{};if(typeof config.floatResponse==='number'&&Number.isFinite(config.floatResponse))floatResponse=THREE.MathUtils.clamp(config.floatResponse,0,2);}
  const geometry=new THREE.PlaneGeometry(.19,.25,8,12),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getY(i),t=(z+.125)/.25;
    p.setXYZ(i,x*Math.pow(Math.sin(t*Math.PI),.48),.014*Math.sin(t*Math.PI)+x*x*.6,z);
  }
  geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({color:'#ffd0df',roughness:.53,side:THREE.DoubleSide});
  const mesh=new THREE.InstancedMesh(geometry,material,44);mesh.name='Floating cherry petals';mesh.receiveShadow=true;scene.add(mesh);
  let seed=72911;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const petals=[];
  for(let i=0;i<44;i++){
    let x,z;do{x=(rand()-.5)*17;z=(rand()-.5)*12.5;}while(bankHeight(x,z)>-.07);
    const r=Math.hypot(x/9,z/6.8);
    if(r<.65&&i%3){const a=Math.atan2(z/6.8,x/9);x=Math.cos(a)*9*(.70+rand()*.20);z=Math.sin(a)*6.8*(.70+rand()*.20);}
    while(bankHeight(x,z)>-.05){x*=.97;z*=.97;}
    petals.push({x,z,angle:rand()*6.28,scale:.65+rand()*.55,phase:rand()*6.28,vx:0,vz:0,spin:0});
    mesh.setColorAt(i,new THREE.Color().setHSL(.94+rand()*.025,.42+rand()*.15,.83+rand()*.13));
  }
  const dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),normal=new THREE.Vector3();
  const tilt=new THREE.Quaternion(),yaw=new THREE.Quaternion();
  function update(dt,time){
    dt=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.06));
    petals.forEach((o,i)=>{
      const motion=water.motionAt?.(o.x,o.z)||{vx:0,vz:0};
      const fluidX=THREE.MathUtils.clamp(Number(motion.vx)||0,-2.4,2.4),fluidZ=THREE.MathUtils.clamp(Number(motion.vz)||0,-2.4,2.4);
      const response=1-Math.exp(-dt*3.2);
      o.vx+=(fluidX*floatResponse+Math.sin(time*.17+o.phase)*.013-o.vx)*response;
      o.vz+=(fluidZ*floatResponse+.009-o.vz)*response;
      const nx=o.x+o.vx*dt,nz=o.z+o.vz*dt;
      if(bankHeight(nx,nz)<-.04){o.x=nx;o.z=nz;}else{
        // Sliding contact removes outward velocity rather than teleporting the petal.
        const gx=bankHeight(o.x+.08,o.z)-bankHeight(o.x-.08,o.z),gz=bankHeight(o.x,o.z+.08)-bankHeight(o.x,o.z-.08),length=Math.hypot(gx,gz);
        if(length>.00001){const ax=gx/length,az=gz/length,outward=Math.max(0,o.vx*ax+o.vz*az);o.vx-=outward*ax;o.vz-=outward*az;}
        o.vx*=Math.exp(-dt*4);o.vz*=Math.exp(-dt*4);
      }
      const ahead=water.motionAt?.(o.x+.10,o.z),behind=water.motionAt?.(o.x-.10,o.z),left=water.motionAt?.(o.x,o.z-.10),right=water.motionAt?.(o.x,o.z+.10);
      const curl=ahead&&behind&&left&&right?((ahead.vz-behind.vz)-(right.vx-left.vx))/.20:0;
      o.spin=THREE.MathUtils.damp(o.spin,THREE.MathUtils.clamp((Number(curl)||0)*.32*floatResponse,-1.7,1.7),3,dt);o.angle+=dt*(.017+o.spin);
      const dx=(water.heightAt(o.x+.08,o.z)-water.heightAt(o.x-.08,o.z))/.16;
      const dz=(water.heightAt(o.x,o.z+.08)-water.heightAt(o.x,o.z-.08))/.16;
      dummy.position.set(o.x,water.heightAt(o.x,o.z)+.022,o.z);
      normal.set(-dx*floatResponse,1,-dz*floatResponse).normalize();tilt.setFromUnitVectors(up,normal);yaw.setFromAxisAngle(up,o.angle);dummy.quaternion.copy(tilt).multiply(yaw);
      dummy.scale.setScalar(o.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    });mesh.instanceMatrix.needsUpdate=true;
  }
  update(0,0);return {mesh,update,setSettings};
}
