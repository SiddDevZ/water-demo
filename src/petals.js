import * as THREE from 'three';
export function createPetals(scene,water,bankHeight){
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
    petals.push({x,z,angle:rand()*6.28,scale:.65+rand()*.55,phase:rand()*6.28});
    mesh.setColorAt(i,new THREE.Color().setHSL(.94+rand()*.025,.42+rand()*.15,.83+rand()*.13));
  }
  const dummy=new THREE.Object3D();
  function update(dt,time){
    petals.forEach((o,i)=>{
      o.x+=Math.sin(time*.17+o.phase)*dt*.013;o.z+=dt*.009;
      if(bankHeight(o.x,o.z)>-.035){o.x*=.997;o.z*=.997;}
      const dx=(water.heightAt(o.x+.08,o.z)-water.heightAt(o.x-.08,o.z))/.16;
      const dz=(water.heightAt(o.x,o.z+.08)-water.heightAt(o.x,o.z-.08))/.16;
      dummy.position.set(o.x,water.heightAt(o.x,o.z)+.022,o.z);
      dummy.rotation.set(-Math.atan(dz)*.6,o.angle+time*.017,Math.atan(dx)*.6);
      dummy.scale.setScalar(o.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    });mesh.instanceMatrix.needsUpdate=true;
  }
  update(0,0);return {mesh,update};
}
