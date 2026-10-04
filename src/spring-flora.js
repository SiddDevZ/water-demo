import * as THREE from 'three';

function blossomGeometry(){
 const positions=[],colors=[],indices=[];
 // Five rounded overlapping bowls, with a pink throat and softly lighter petal edge.
 for(let petal=0;petal<5;petal++){
  const angle=petal/5*Math.PI*2,start=positions.length/3,rings=2,segments=12;
  for(let ring=0;ring<=rings;ring++)for(let j=0;j<=segments;j++){
   const t=ring/rings,q=j/segments*Math.PI*2,r=.063+Math.cos(q)*.062*t,across=Math.sin(q)*.046*t;
   const h=.011+.013*t*t+.019*Math.pow(Math.max(0,r)/.125,2);
   positions.push(Math.cos(angle)*r-Math.sin(angle)*across,h,Math.sin(angle)*r+Math.cos(angle)*across);
   const blush=.47+.28*t;colors.push(.98,blush,blush+.07);
   if(ring<rings&&j<segments){const k=start+ring*(segments+1)+j;indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
  }
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
export function createSpringFlora(group,ground,random){
  const dummy=new THREE.Object3D(),flowerGeo=blossomGeometry(),flowerMat=new THREE.MeshStandardMaterial({vertexColors:true,color:0xffffff,roughness:.77,side:THREE.DoubleSide});
  const patches=[[-8.4,-8.1,.95,0xf0d9a9],[-10.8,-8.5,1.0,0xefd3d4],[8.9,-8.6,1.0,0xf4e4bd],[10.7,2.8,.85,0xf0dfb5],[-10.2,2.8,.85,0xe8becb],[-9.4,5.2,.68,0xf5e5b8],[8.7,5.4,.72,0xf0d1d4],[-5.6,-9.0,.85,0xf6e6bb],[5.0,-10.7,1.1,0xefd0d1],[-13.2,-12.4,1.2,0xf4e4c2]];
  const leafGeo=new THREE.BufferGeometry();leafGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-.5,-.2,.055,-.14,-.22,.09,.18,0,.12,.02,.22,.09,.18,.2,.055,-.14,0,.06,.65],3));leafGeo.setIndex([0,1,3,1,2,3,2,6,3,3,6,4,3,4,5,0,3,5]);leafGeo.computeVertexNormals();
  const leafMat=new THREE.MeshStandardMaterial({color:0x6e9549,roughness:.82,side:THREE.DoubleSide});
  const leaves=new THREE.InstancedMesh(leafGeo,leafMat,patches.length*110),flowers=new THREE.InstancedMesh(flowerGeo,flowerMat,patches.length*40);leaves.castShadow=true;leaves.receiveShadow=true;flowers.receiveShadow=true;
  let li=0,fi=0;
  for(const [cx,cz,size,tint]of patches){
    for(let i=0;i<110;i++){const a=random()*6.28,r=Math.sqrt(random())*size*.9,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r,y=ground(x,z)+.12+.25*Math.sqrt(Math.max(0,1-r*r/(size*size)))+random()*.08;dummy.position.set(x,y,z);dummy.rotation.set((random()-.5)*1.1,random()*6.28,(random()-.5)*1.1);const s=.12+random()*.14;dummy.scale.set(s*.7,s,s);dummy.updateMatrix();leaves.setMatrixAt(li,dummy.matrix);leaves.setColorAt(li++,new THREE.Color().setHSL(.23+random()*.025,.27+random()*.12,.5+random()*.2));}
    for(let i=0;i<40;i++){const a=random()*6.28,r=Math.sqrt(random())*size*.83,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r,y=ground(x,z)+.21+.25*Math.sqrt(Math.max(0,1-r*r/(size*size)))+random()*.09;dummy.position.set(x,y,z);dummy.rotation.set((random()-.5)*.8,random()*6.28,(random()-.5)*.8);dummy.scale.setScalar(.43+random()*.26);dummy.updateMatrix();flowers.setMatrixAt(fi,dummy.matrix);flowers.setColorAt(fi++,new THREE.Color(tint));}
  }
  leaves.name='Layered perennial foliage';flowers.name='Coral and cream perennial pockets';group.add(leaves,flowers);
  // A broken ribbon of small daisies at the immediate bank, with warm pollen centers.
  const daisyPlaces=[];
  for(let i=0;i<1800&&daisyPlaces.length<620;i++){
    const a=random()*6.28,r=1.025+random()*.15,x=Math.cos(a)*9.1*r,z=Math.sin(a)*6.8*r,h=ground(x,z);
    if(h<.006||h>.6||Math.abs(x)<1.4&&z<-6)continue;
    daisyPlaces.push({x,z,y:h+.11+random()*.15,s:.392+random()*.308,pink:random()<.25});
  }
  const daisies=new THREE.InstancedMesh(flowerGeo,flowerMat,daisyPlaces.length),centers=new THREE.InstancedMesh(new THREE.SphereGeometry(.022,7,4),new THREE.MeshStandardMaterial({color:'#e6b54c',roughness:.8}),daisyPlaces.length);
  daisyPlaces.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set((random()-.5)*.45,random()*6.28,(random()-.5)*.45);dummy.scale.setScalar(p.s);dummy.updateMatrix();daisies.setMatrixAt(i,dummy.matrix);daisies.setColorAt(i,new THREE.Color(p.pink?'#f4bbbd':'#fff2cb'));dummy.position.y+=.013;dummy.rotation.set(0,0,0);dummy.scale.set(.77,.448,.77);dummy.updateMatrix();centers.setMatrixAt(i,dummy.matrix);});daisies.receiveShadow=true;group.add(daisies,centers);
  const time={value:0};
  // Three small wet-margin colonies: flexible reed blades and a few pale irises.
  const reedP=[],reedI=[];for(let blade=0;blade<7;blade++){const a=blade*2.399,h=.58+random()*.33,start=reedP.length/3;for(let j=0;j<=7;j++){const t=j/7,w=Math.sin(Math.PI*t)*.035,reach=t*t*.22;for(const side of [-1,1])reedP.push(Math.cos(a)*reach-Math.sin(a)*w*side,h*t,Math.sin(a)*reach+Math.cos(a)*w*side);if(j<7){const k=start+j*2;reedI.push(k,k+1,k+2,k+1,k+3,k+2);}}}
  const reedGeo=new THREE.BufferGeometry();reedGeo.setAttribute('position',new THREE.Float32BufferAttribute(reedP,3));reedGeo.setIndex(reedI);reedGeo.computeVertexNormals();const reedMat=new THREE.MeshStandardMaterial({color:0x557e35,roughness:.72,side:THREE.DoubleSide});reedMat.onBeforeCompile=shader=>{shader.uniforms.uReedTime=time;shader.vertexShader='uniform float uReedTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(uReedTime*1.2+position.y*2.0)*position.y*position.y*.05;');};
  const reedPlaces=[];for(const [cx,cz]of [[-8.55,-3.8],[8.75,-1.7],[6.3,-5.8]])for(let i=0;i<15;i++){const a=i*2.399,r=.1+random()*.45;let x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;for(let k=0;k<18&&ground(x,z)<.025;k++){x*=1.012;z*=1.012;}reedPlaces.push({x,z,h:.7+random()*.3,r:random()*6.28});}
  const reeds=new THREE.InstancedMesh(reedGeo,reedMat,reedPlaces.length);reeds.name='Small iris and reed colonies';reeds.receiveShadow=true;reedPlaces.forEach((p,i)=>{dummy.position.set(p.x,ground(p.x,p.z)-.015,p.z);dummy.rotation.set(0,p.r,0);dummy.scale.setScalar(p.h);dummy.updateMatrix();reeds.setMatrixAt(i,dummy.matrix);});group.add(reeds);
  const irisP=[],irisC=[],irisI=[];
  for(let petal=0;petal<6;petal++){const a=(petal%3)*6.28/3+(petal>2?.4:0),up=petal>2,start=irisP.length/3;for(let j=0;j<=5;j++){const t=j/5,r=t*(up?.095:.17),w=Math.sin(t*Math.PI)*.064,h=up?Math.sin(t*1.45)*.16:Math.sin(t*3.14)*.04-t*t*.06;for(const side of [-1,1]){irisP.push(Math.cos(a)*r-Math.sin(a)*w*side,h,Math.sin(a)*r+Math.cos(a)*w*side);const yellow=!up&&j<2;irisC.push(yellow?.85:.58+t*.18,yellow?.66:.55+t*.17,yellow?.20:.79+t*.11);}if(j<5){const k=start+j*2;irisI.push(k,k+1,k+2,k+1,k+3,k+2);}}}
  const irisGeo=new THREE.BufferGeometry();irisGeo.setAttribute('position',new THREE.Float32BufferAttribute(irisP,3));irisGeo.setAttribute('color',new THREE.Float32BufferAttribute(irisC,3));irisGeo.setIndex(irisI);irisGeo.computeVertexNormals();const iris=new THREE.InstancedMesh(irisGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7,side:THREE.DoubleSide}),18),stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(.004,.006,1,4),reedMat,18);iris.name='Pale violet margin irises';
  for(let i=0;i<18;i++){const p=reedPlaces[(i*7)%reedPlaces.length],h=.42+p.h*.18,y=ground(p.x,p.z);dummy.position.set(p.x,y+h,p.z);dummy.rotation.set(0,p.r,0);dummy.scale.setScalar(.6+random()*.25);dummy.updateMatrix();iris.setMatrixAt(i,dummy.matrix);dummy.position.y=y+h/2;dummy.rotation.set(0,0,0);dummy.scale.set(1,h,1);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);}group.add(iris,stems);
  // Two cream butterflies hover over flowering banks, never swarm over the water.
  const wingShape=new THREE.Shape();wingShape.moveTo(0,0);wingShape.bezierCurveTo(.08,.12,.30,.29,.30,.12);wingShape.bezierCurveTo(.32,-.02,.21,-.065,.12,-.04);wingShape.bezierCurveTo(.26,-.21,.04,-.24,0,0);
  const wingGeo=new THREE.ShapeGeometry(wingShape,9);const wingMat=new THREE.MeshStandardMaterial({color:0xf1dcae,roughness:.67,side:THREE.DoubleSide});const butterflies=[];
  for(let i=0;i<2;i++){const insect=new THREE.Group(),wings=[];for(const side of [-1,1]){const hinge=new THREE.Group(),wing=new THREE.Mesh(wingGeo,wingMat);wing.rotation.x=-Math.PI/2;wing.scale.set(side*.43,.43,.43);hinge.add(wing);insect.add(hinge);wings.push(hinge);}const body=new THREE.Mesh(new THREE.SphereGeometry(1,6,4),new THREE.MeshStandardMaterial({color:0x74654b,roughness:.8}));body.scale.set(.008,.009,.065);insect.add(body);group.add(insect);butterflies.push({mesh:insect,wings,phase:i*3.1});}

  function addCherry(gltf,placement){
    const samples=[];gltf.scene.updateMatrixWorld(true);const v=new THREE.Vector3();
    gltf.scene.traverse(node=>{if(!node.isMesh||!/leaves/.test(node.material.name))return;const p=node.geometry.attributes.position;for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/2200))){v.fromBufferAttribute(p,i).applyMatrix4(node.matrixWorld);if(v.y>2.0 && (v.x<.4 || v.z>.3))samples.push(v.clone());}});if(!samples.length)return;
    const mat=flowerMat.clone();mat.onBeforeCompile=shader=>{shader.uniforms.uBloomTime=time;shader.vertexShader='uniform float uBloomTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
        transformed.x+=sin(uBloomTime*.8+instanceMatrix[3].y*.7)*.014;
      #endif
    `);};
    const blooms=new THREE.InstancedMesh(flowerGeo,mat,520);blooms.name='Soft blush cherry blossom sprays';blooms.receiveShadow=false;const hearts=new THREE.InstancedMesh(new THREE.SphereGeometry(.021,8,5),new THREE.MeshStandardMaterial({color:'#efbc9b',roughness:.7}),520);
    for(let i=0;i<520;i++){const p=samples[Math.floor(random()*samples.length)];dummy.position.set(p.x+(random()-.5)*.12,p.y+(random()-.5)*.12,p.z+(random()-.5)*.12);dummy.rotation.set((random()-.5)*1.4,random()*6.28,(random()-.5)*1.4);dummy.scale.setScalar(.95+random()*.65);dummy.updateMatrix();blooms.setMatrixAt(i,dummy.matrix);hearts.setMatrixAt(i,dummy.matrix);blooms.setColorAt(i,new THREE.Color().setHSL(.94+random()*.015,.40+random()*.14,.49+random()*.15));}
    blooms.position.set(placement.x,ground(placement.x,placement.z)-.09,placement.z);blooms.rotation.y=placement.r;blooms.scale.set(placement.s*.98,placement.s,placement.s);hearts.position.copy(blooms.position);hearts.rotation.copy(blooms.rotation);hearts.scale.copy(blooms.scale);group.add(blooms,hearts);
  }
  return {addCherry,stats:{flowerPatches:patches.length,wildflowers:patches.length*40,reedClumps:reedPlaces.length,irises:18,butterflies:2},update(dt,elapsed){time.value=elapsed??time.value+dt;butterflies.forEach((b,i)=>{const t=time.value,a=t*.32+b.phase,x=(i?8.9:-8.6)+Math.sin(a)*.75,z=(i?-7.8:-6.9)+Math.cos(a*.83)*.42;b.mesh.position.set(x,ground(x,z)+.78+Math.sin(t*1.25+b.phase)*.17,z);b.mesh.rotation.y=-a;const flap=Math.sin(t*26+b.phase)*.9;b.wings[0].rotation.z=flap;b.wings[1].rotation.z=-flap;});}};
}
