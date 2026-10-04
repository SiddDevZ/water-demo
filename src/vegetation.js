import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { springRadius } from './environment.js';
import { createSpringFlora } from './spring-flora.js';

export function createVegetation(scene,bankHeight=()=>.13) {
  const group=new THREE.Group();group.name='Natural spring canopy and banks';scene.add(group);
  const loader=new GLTFLoader(),textures=new THREE.TextureLoader(),time={value:0},dummy=new THREE.Object3D();
  let seed=74421;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const map=(url,color=true)=>{const t=textures.load(url);t.flipY=false;if(color)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;};
  const wind=(material,strength)=>{material.onBeforeCompile=shader=>{shader.uniforms.uGardenTime=time;shader.vertexShader='uniform float uGardenTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    float windPhase=0.0;
    #ifdef USE_INSTANCING
      windPhase=instanceMatrix[3].x*.31+instanceMatrix[3].z*.22;
    #endif
    transformed.x+=sin(uGardenTime*.8+windPhase+position.y*.15)*pow(max(position.y,0.0),1.15)*${strength.toFixed(4)};
  `);};material.customProgramCacheKey=()=>`courtyard-wind-${strength}`;};
  const treePlaces=[{x:-8.6,z:-1.6,s:.96,r:2.8,cherry:true},{x:8.1,z:5.0,s:1.20,r:.3,cherry:true}];
  const flora=createSpringFlora(group,bankHeight,random);
  const readyTrees=new Promise(resolve=>loader.load('/assets/trees/tree.glb',gltf=>{
    const bark=map('/assets/trees/bark.jpg'),leaves=map('/assets/trees/leaves.png'),branches=map('/assets/trees/branches.jpg'),barkNormal=map('/assets/trees/bark-normal.jpg',false),branchNormal=map('/assets/trees/branches-normal.jpg',false);gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(node=>{
      if(!node.isMesh)return;const leaf=/leaves/.test(node.material.name),branch=/branches/.test(node.material.name);
      for(const cherry of (leaf?[false]:[false])){
        const places=leaf?treePlaces.filter(p=>!!p.cherry===cherry).flatMap(p=>[p,{...p,x:p.x+.055,z:p.z-.035,r:p.r+.075,s:p.s*1.025}]):treePlaces;
        if(!places.length)continue;const material=node.material.clone();material.map=leaf?leaves:branch?branches:bark;
        material.color.set(leaf?0xffffff:0xeee6d5);material.roughness=leaf?.72:.91;material.metalness=0;material.side=THREE.DoubleSide;
        if(leaf){material.alphaTest=.35;wind(material,.009);
          const before=material.onBeforeCompile;
          material.onBeforeCompile=shader=>{before(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
            float botanicalLight=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*1.6,0.0,1.0);
            diffuseColor.rgb=${cherry?'mix(vec3(.25,.050,.085),vec3(.66,.22,.34),pow(botanicalLight,.65))':'mix(vec3(.026,.085,.012),vec3(.17,.36,.056),pow(botanicalLight,.72))'};
          `);};material.customProgramCacheKey=()=>`spring-canopy-${cherry}`;
        }else{material.normalMap=branch?branchNormal:barkNormal;material.normalScale.set(.5,.5);}
        const geo=node.geometry.clone().applyMatrix4(node.matrixWorld),mesh=new THREE.InstancedMesh(geo,material,places.length);mesh.castShadow=true;mesh.receiveShadow=!leaf;
        places.forEach((p,i)=>{dummy.position.set(p.x,bankHeight(p.x,p.z)-.07,p.z);dummy.rotation.set(0,p.r,0);dummy.scale.set(p.s*.98,p.s,p.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});group.add(mesh);
      }
    });
    for(const p of treePlaces.filter(p=>p.cherry))flora.addCherry(gltf,p);
    resolve();
  },undefined,()=>resolve()));
  // Fern colonies follow moist coves, with gaps around exposed mineral shelves.
  const fernClusters=[[-8.8,-8.7,.73],[-11,-8.4,.7],[8.8,-9.2,.73],[11,-9,.66],[-10.1,-1,.68],[-10.1,4.4,.73],[10.4,.8,.69],[10.9,4.8,.66],[-5.9,-7.7,.68],[6.3,-7.0,.62],[-12.1,-4.3,.8],[12,-3.8,.75]];
  const fernPlaces=[];for(const [cx,cz,s] of fernClusters)for(let i=0;i<5;i++){const a=i*2.399,r=.15+random()*.62;fernPlaces.push({x:cx+Math.cos(a)*r,z:cz+Math.sin(a)*r,s:s*(.74+random()*.38),r:random()*6.28});}
  for(let i=0;i<130;i++){const a=random()*6.28,r=1.025+random()*.14,x=Math.cos(a)*9.1*r,z=Math.sin(a)*6.8*r,h=bankHeight(x,z);if(h<.008||h>.65||Math.abs(x)<1.3&&z<-6)continue;fernPlaces.push({x,z,s:.42+random()*.32,r:random()*6.28});}
  const readyFerns=new Promise(resolve=>loader.load('/assets/ferns/lod1.gltf',gltf=>{gltf.scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(gltf.scene),h=bounds.max.y-bounds.min.y;gltf.scene.traverse(node=>{if(!node.isMesh)return;const geo=node.geometry.clone().applyMatrix4(node.matrixWorld);geo.translate(0,-bounds.min.y,0);geo.scale(1/h,1/h,1/h);const material=node.material.clone();material.alphaTest=.46;material.side=THREE.DoubleSide;material.roughness=.85;material.color.set(0xe8f4bc);if(material.map)material.map.anisotropy=8;wind(material,.033);const mesh=new THREE.InstancedMesh(geo,material,fernPlaces.length);mesh.receiveShadow=true;mesh.castShadow=true;fernPlaces.forEach((p,i)=>{dummy.position.set(p.x,bankHeight(p.x,p.z)-.025,p.z);dummy.rotation.set(0,p.r,0);dummy.scale.setScalar(p.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});group.add(mesh);});resolve();},undefined,()=>resolve()));
  // As in Willowmere's field, density, tallness and lushness vary continuously.
  // Broad curved blades replace the previous uniformly spaced upright needles.
  const hash=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);};
  const noise=(x,z)=>{const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iz),hash(ix+1,iz),sx),THREE.MathUtils.lerp(hash(ix,iz+1),hash(ix+1,iz+1),sx),sz);};
  const meadowField=(x,z)=>noise(x*.28,z*.28)*.62+noise(x*.81+4,z*.81-7)*.28+noise(x*2.1,z*2.1)*.1;
  const inStream=(x,z)=>Math.abs(x)<1.12&&z< -6.4&&z> -12.7;
  const grassGeometry=(blades,segments)=>{const position=[],color=[],index=[];
    for(let blade=0;blade<blades;blade++){
      const angle=random()*6.28,h=.19+random()*.40,lean=.16+random()*.30,width=.010+random()*.017,ox=(random()-.5)*.23,oz=(random()-.5)*.23,start=position.length/3;
      for(let j=0;j<=segments;j++){const t=j/segments,bend=lean*t*t,w=width*Math.pow(1-t,.7);for(const side of [-1,1]){
        position.push(ox+Math.cos(angle)*bend-Math.sin(angle)*w*side,h*(t-.27*t*t),oz+Math.sin(angle)*bend+Math.cos(angle)*w*side);
        const shade=new THREE.Color().setHSL(.207+blade%3*.005,.70,.12+t*.25);color.push(shade.r,shade.g,shade.b);
      }if(j<segments){const k=start+j*2;index.push(k,k+1,k+2,k+1,k+3,k+2);}}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(position,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(color,3));geo.setIndex(index);geo.computeVertexNormals();return geo;
  };
  const grassMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.84,side:THREE.DoubleSide});wind(grassMat,.08);
  const nearPlaces=[],farPlaces=[];
  for(let i=0;i<50000&&nearPlaces.length<5400;i++){
    const x=(random()-.5)*37,z=-18+random()*30,r=springRadius(x,z);if(r<1.008||r>1.48||bankHeight(x,z)>.65||bankHeight(x,z)<.006||inStream(x,z))continue;
    const density=meadowField(x,z);if(random()>.30+density*.77)continue;
    const shore=1-THREE.MathUtils.smoothstep(r,1.06,1.6),front=z>4&&Math.abs(x)<5.3;
    nearPlaces.push({x,z,s:(.45+density*.43+random()*.24)*(front?.66:1),wide:.82+random()*.44,r:random()*6.28,tint:.77+random()*.28});
  }
  for(let i=0;i<0&&farPlaces.length<0;i++){
    const x=(random()-.5)*64,z=-37+random()*29,r=springRadius(x,z);if(r<2.03||inStream(x,z))continue;
    const field=meadowField(x,z);if(random()>.18+field*.82)continue;
    farPlaces.push({x,z,s:.25+field*.34+random()*.14,wide:.82+random()*.34,r:random()*6.28,tint:.78+random()*.25});
  }
  const grassBatch=(places,geometry,name)=>{const mesh=new THREE.InstancedMesh(geometry,grassMat,places.length);mesh.name=name;mesh.receiveShadow=true;places.forEach((p,i)=>{dummy.position.set(p.x,bankHeight(p.x,p.z)-.01,p.z);dummy.rotation.set(0,p.r,0);dummy.scale.set(p.s*p.wide,p.s,p.s*p.wide);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color(p.tint,p.tint,p.tint*.96));});group.add(mesh);};
  grassBatch(nearPlaces,grassGeometry(11,5),'Lush curved bank grass');grassBatch(farPlaces,grassGeometry(7,4),'Low meadow grass on distant slopes');
  // Broadleaf rosettes knit the fern colonies into the grass in ten irregular patches.
  const leafP=[],leafC=[],leafI=[];
  for(let leaf=0;leaf<6;leaf++){const a=leaf*2.399,start=leafP.length/3,len=.22+random()*.14;for(let j=0;j<=5;j++){const t=j/5,w=Math.sin(t*Math.PI)*.072;for(const side of [-1,1]){leafP.push(Math.cos(a)*len*t-Math.sin(a)*w*side,.015+Math.sin(t*1.7)*.075,Math.sin(a)*len*t+Math.cos(a)*w*side);const c=new THREE.Color().setHSL(.217,.55,.16+t*.095);leafC.push(c.r,c.g,c.b);}if(j<5){const k=start+j*2;leafI.push(k,k+1,k+2,k+1,k+3,k+2);}}}
  const broadGeo=new THREE.BufferGeometry();broadGeo.setAttribute('position',new THREE.Float32BufferAttribute(leafP,3));broadGeo.setAttribute('color',new THREE.Float32BufferAttribute(leafC,3));broadGeo.setIndex(leafI);broadGeo.computeVertexNormals();const broadMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.77,side:THREE.DoubleSide});wind(broadMat,.038);
  const coverPlaces=[];for(const [cx,cz] of [[-8,-7.4],[-11,-5],[8.6,-7.4],[11.8,-5],[-10.4,1],[10.5,1.7],[-9.3,5.5],[9.4,5.6],[-5.7,-10.5],[5.7,-11]])for(let i=0;i<100;i++){const a=random()*6.28,r=Math.sqrt(random())*(.85+random()*.35),x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(bankHeight(x,z)<.025||inStream(x,z))continue;coverPlaces.push({x,z,s:.27+random()*.29,r:random()*6.28});}
  const cover=new THREE.InstancedMesh(broadGeo,broadMat,coverPlaces.length);cover.name='Broadleaf groundcover colonies';cover.receiveShadow=true;coverPlaces.forEach((p,i)=>{dummy.position.set(p.x,bankHeight(p.x,p.z),p.z);dummy.rotation.set(0,p.r,0);dummy.scale.setScalar(p.s);dummy.updateMatrix();cover.setMatrixAt(i,dummy.matrix);});group.add(cover);
  const groundOcclusion=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);groundOcclusion.needsUpdate=true;
  return {group,groundOcclusion,stats:{trees:2,ferns:fernPlaces.length,bankGrassTufts:nearPlaces.length,meadowTufts:farPlaces.length,groundcover:coverPlaces.length,...flora.stats},ready:Promise.all([readyTrees,readyFerns]),update(dt,elapsed){time.value=elapsed??time.value+dt;flora.update(dt,time.value);}};
}
