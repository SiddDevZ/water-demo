import * as THREE from 'three';

// Planting regions, not discrete garden beds. Vegetation samples the same surface.
export const gardenIslands=[
  {x:-8.8,z:-8.6,rx:4.4,rz:3.2,h:0,phase:.3},
  {x:8.6,z:-8.8,rx:4.8,rz:3.0,h:0,phase:1.2},
  {x:-11.4,z:1.2,rx:3.0,rz:5.6,h:0,phase:2.1},
  {x:11.3,z:1.8,rx:2.8,rz:5.0,h:0,phase:.8}
];
export function springRadius(x,z){
  const angle=Math.atan2(z/6.8,x/9.1);
  const outline=1+.05*Math.sin(angle*3+.7)+.031*Math.sin(angle*5-1.1)+.02*Math.cos(angle*2+.4);
  return Math.hypot(x/9.1,z/6.8)/outline;
}
export function streamCenter(z){return .2+.23*Math.sin((z+7)*.85);}
export function bankHeight(x,z){
  const radius=springRadius(x,z);
  let y;
  if(radius<=1){
    const frontProfile=-1.72+1.26*THREE.MathUtils.smoothstep(radius,0,.70)+.46*THREE.MathUtils.smoothstep(radius,.70,1);
    const rearProfile=-1.72+1.26*THREE.MathUtils.smoothstep(radius,.50,.86)+.46*THREE.MathUtils.smoothstep(radius,.86,1);
    y=THREE.MathUtils.lerp(frontProfile,rearProfile,1-THREE.MathUtils.smoothstep(z,-1,1.7));
    y+=.009*Math.sin(x*.93+z*.27)*Math.cos(z*.8)*(1-radius);
    // A deeper rear spring pocket broadens the blue water toward the far bank.
    // Its shore fade preserves the exact zero-height outline and sandy lip.
    const rearPocket=Math.exp(-Math.pow((x-1.0)/5.3,4)-Math.pow((z+2.8)/3.5,4));
    const pocketShore=1-THREE.MathUtils.smoothstep(radius,.64,.98);
    y-=.94*rearPocket*pocketShore;
  }else{
    const rise=THREE.MathUtils.smoothstep(radius,1,1.28),roll=THREE.MathUtils.smoothstep(radius,1.06,1.6);
    y=.34*rise+roll*(.14*Math.sin(x*.23+z*.16)+.11*Math.cos(z*.31-x*.07));
    const hills=2.65*Math.exp(-((x+13)**2/170+(z+23)**2/115))+3.05*Math.exp(-((x-17)**2/210+(z+28)**2/155))+.95*Math.exp(-((x+28)**2/135+(z-2)**2/185));
    y+=THREE.MathUtils.smoothstep(radius,1.4,2.5)*hills;
    y+=THREE.MathUtils.smoothstep(radius,1.8,3.8)*(.30*Math.sin((z+12)*.073)**2+.21*Math.sin(x*.086+.5)**2);
  }
  return y;
}
export function basinBedHeight(x,z){return bankHeight(x,z);}
export function gardenHeight(x,z){return Math.max(0,bankHeight(x,z));}

export function createEnvironment(scene){
  const group=new THREE.Group();group.name='Natural spring and rolling mineral banks';scene.add(group);
  let seed=49212;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const loader=new THREE.TextureLoader();
  const tex=(name,kind,scale)=>{const t=loader.load(`/assets/terrain/${name}/${name}_${kind}_1k.jpg`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.setScalar(scale);t.anisotropy=16;if(kind==='diffuse')t.colorSpace=THREE.SRGBColorSpace;return t;};
  const gravelMap=tex('river_small_rocks','diffuse',1),gravelNormal=tex('river_small_rocks','nor_gl',1),grassMap=tex('leafy_grass','diffuse',1),grassNormal=tex('leafy_grass','nor_gl',1);
  const groundGeo=new THREE.PlaneGeometry(120,120,420,420);groundGeo.rotateX(-Math.PI/2);const p=groundGeo.attributes.position,uv=groundGeo.attributes.uv;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,bankHeight(x,z));uv.setXY(i,x*.34,z*.34);}groundGeo.computeVertexNormals();
  const unoccludedGround=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);unoccludedGround.needsUpdate=true;const groundOcclusion={value:unoccludedGround};
  const groundMat=new THREE.MeshStandardMaterial({map:gravelMap,normalMap:gravelNormal,normalScale:new THREE.Vector2(.25,.25),roughness:.9});groundMat.name='Natural spring mineral bed';groundMat.userData.waterCaustics=true;
  groundMat.onBeforeCompile=shader=>{
    shader.uniforms.uGrassMap={value:grassMap};shader.uniforms.uGrassNormal={value:grassNormal};shader.uniforms.uGroundOcclusion=groundOcclusion;
    shader.vertexShader='varying vec3 vTerrainPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrainPosition=position;');
    shader.fragmentShader='varying vec3 vTerrainPosition;uniform sampler2D uGrassMap;uniform sampler2D uGrassNormal;uniform sampler2D uGroundOcclusion;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float mineralLight=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      vec3 fineSand=vec3(.64,.48,.24)*mix(.48,1.16,smoothstep(.06,.32,mineralLight));
      vec3 shelf=vec3(.64,.48,.24)*mix(.40,1.18,smoothstep(.06,.28,mineralLight));
      float shallowShelf=smoothstep(-1.18,-.25,vTerrainPosition.y);
      vec3 mineral=mix(fineSand,shelf,shallowShelf);
      float grassBlend=smoothstep(.005,.06,vTerrainPosition.y);
      vec3 meadowScan=texture2D(uGrassMap,vTerrainPosition.xz*.48).rgb;
      float meadowLight=dot(meadowScan,vec3(.2126,.7152,.0722));
      vec3 meadow=mix(meadowScan*vec3(.44,1.00,.28),meadowLight*vec3(.49,1.10,.27),.55)*.86+vec3(.014,.024,.005);
      float meadowPatch=.5+.5*sin(vTerrainPosition.x*.24+sin(vTerrainPosition.z*.19))*cos(vTerrainPosition.z*.27);
      meadow*=mix(.86,1.07,meadowPatch);
      diffuseColor.rgb=mix(mineral,meadow,grassBlend);
      float shoreWet=exp(-pow((vTerrainPosition.y+.015)/.12,2.));
      diffuseColor.rgb*=1.-shoreWet*.10;
      float canopy=texture2D(uGroundOcclusion,clamp(vTerrainPosition.xz/80.+.5,vec2(0.),vec2(1.))).r;
      diffuseColor.rgb*=mix(.87,1.,canopy);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',THREE.ShaderChunk.normal_fragment_maps.replace('texture2D( normalMap, vNormalMapUv ).xyz','mix(texture2D(normalMap,vNormalMapUv).xyz,texture2D(uGrassNormal,vTerrainPosition.xz*.48).xyz,grassBlend)'));
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=mix(.76,.97,grassBlend);`);
  };
  const ground=new THREE.Mesh(groundGeo,groundMat);ground.receiveShadow=true;group.add(ground);
  const rockMap=tex('dark_rock_02','diffuse',1),rockNormal=tex('dark_rock_02','nor_gl',1),mossMap=tex('mossy_rock','diffuse',1);
  const rockARM=tex('dark_rock_02','arm',1);
  const makeRockMaterial=(moss=true)=>{
    const material=new THREE.MeshStandardMaterial({map:rockMap,normalMap:rockNormal,normalScale:new THREE.Vector2(.32,.32),roughness:.84,color:0xf4eee2});
    // The moss flag changes emitted GLSL; closure source alone is identical
    // for both materials and would otherwise make pebbles share moss shading.
    material.name='Warm natural limestone stone';material.userData.waterCaustics=true;
    material.customProgramCacheKey=()=>`scanned-stone-moss-${moss}`;
    material.onBeforeCompile=shader=>{
      shader.uniforms.mossMap={value:mossMap};shader.uniforms.rockARM={value:rockARM};
      shader.vertexShader='varying vec3 vStonePos; varying vec3 vStoneNorm; varying vec3 vStoneWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        vStonePos=position;vStoneNorm=normal;
        vec4 stoneWorldPosition=vec4(position,1.);
        #ifdef USE_INSTANCING
          stoneWorldPosition=instanceMatrix*stoneWorldPosition;
        #endif
        vStoneWorld=(modelMatrix*stoneWorldPosition).xyz;
      `);
      shader.fragmentShader='varying vec3 vStonePos; varying vec3 vStoneNorm; varying vec3 vStoneWorld; uniform sampler2D mossMap; uniform sampler2D rockARM;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec3 weights=pow(abs(normalize(vStoneNorm)),vec3(5.0)); weights/=dot(weights,vec3(1.0));
      vec3 stone=texture2D(map,vStonePos.yz*2.1).rgb*weights.x+texture2D(map,vStonePos.xz*2.1).rgb*weights.y+texture2D(map,vStonePos.xy*2.1).rgb*weights.z;
      float stoneLight=dot(stone,vec3(.2126,.7152,.0722));
      stone=vec3(.65,.48,.28)+(stoneLight-.15)*vec3(.39,.31,.22);
      // The scanned moss image supplies irregular growth at several scales.
      // Object-world offset keeps each stone's colonies from repeating.
      vec2 mossUV=vStonePos.xz+vStonePos.y*vec2(.37,-.23)+floor(vStoneWorld.xz)*.173;
      vec2 mossWarp=texture2D(mossMap,mossUV*.73).rg-.23;
      float mossCoarse=dot(texture2D(mossMap,mossUV*.89+mossWarp*.48).rgb,vec3(.2126,.7152,.0722));
      float mossMedium=dot(texture2D(mossMap,mat2(.8,-.6,.6,.8)*mossUV*3.13+mossWarp*.17).rgb,vec3(.2126,.7152,.0722));
      float mossFine=dot(texture2D(mossMap,mossUV*11.7).rgb,vec3(.2126,.7152,.0722));
      float mossFlecks=clamp((mossFine-.14)*5.,-1.,1.);
      float mossGrowth=mossCoarse*.64+mossMedium*.26+mossFine*.10;
      float cover=${moss?'smoothstep(.18,.33,mossGrowth+max(vStoneNorm.y,0.)*.12)*.96':'0.0'};
      vec3 mossScan=texture2D(mossMap,vStonePos.xz*2.0).rgb;
      float mossLight=dot(mossScan,vec3(.2126,.7152,.0722));
      vec3 moss=vec3(.14,.27,.009)+(mossLight-.16)*vec3(.66,.85,.10);
      moss*=.94+.12*mossFlecks;
      diffuseColor.rgb*=mix(${moss?'stone':'mix(dot(stone,vec3(.299,.587,.114))*vec3(1.12,1.08,.98),stone,.35)*1.16+vec3(.024,.022,.017)'},moss,cover);
      float wetStone=1.-smoothstep(-.09,.15,vStoneWorld.y);
      float stoneWaterline=exp(-pow((vStoneWorld.y-.015)/.085,2.));
      diffuseColor.rgb*=mix(1.,${moss?'.86':'.92'},wetStone)*mix(1.,.86,stoneWaterline);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        vec3 rockSurface=texture2D(rockARM,vStonePos.yz*2.1).rgb*weights.x+texture2D(rockARM,vStonePos.xz*2.1).rgb*weights.y+texture2D(rockARM,vStonePos.xy*2.1).rgb*weights.z;
        roughnessFactor=mix(clamp(rockSurface.g*.8+.2,.60,.95),.32+rockSurface.g*.12,wetStone);
        roughnessFactor=mix(roughnessFactor,.94,cover*.7);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
        reflectedLight.indirectDiffuse*=mix(.58,1.,rockSurface.r);
      `);
    };
    return material;
  };
  const stoneMaterial=makeRockMaterial(true),pebbleMaterial=makeRockMaterial(false);const obstacles=[];const dummy=new THREE.Object3D();
  const ready=Promise.all([fetch('/assets/terrain/rocks/rocks.json').then(r=>r.json()),fetch('/assets/terrain/rocks/rocks.bin').then(r=>r.arrayBuffer())]).then(([meta,bin])=>{
    const V=meta.vertexCount,P=new Float32Array(bin,0,V*3),N=new Float32Array(bin,V*12,V*3),I=new Uint32Array(bin,V*24,meta.indexCount),cache=new Map();
    const geoFor=(index,lod=0)=>{const key=index+':'+lod;if(cache.has(key))return cache.get(key);const l=meta.pieces[index].lods[lod],geo=new THREE.BufferGeometry(),points=P.slice(l.vOff*3,(l.vOff+l.vCount)*3);geo.setAttribute('position',new THREE.BufferAttribute(points,3));geo.setAttribute('normal',new THREE.BufferAttribute(N.slice(l.vOff*3,(l.vOff+l.vCount)*3),3));geo.setIndex(new THREE.BufferAttribute(I.slice(l.iOff,l.iOff+l.iCount),1));const uv=new Float32Array(l.vCount*2);for(let i=0;i<l.vCount;i++){uv[i*2]=Math.atan2(points[i*3+2],points[i*3])/(Math.PI*2)+.5;uv[i*2+1]=points[i*3+1]*2;}geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.computeBoundingBox();geo.computeBoundingSphere();cache.set(key,geo);return geo;};
    const roundedGeometries=Array.from({length:6},(_,variant)=>{
      const geo=new THREE.SphereGeometry(.5,40,28),a=geo.attributes.position;
      const q=variant*1.71;
      for(let j=0;j<a.count;j++){
        const x=a.getX(j),y=a.getY(j),z=a.getZ(j);
        const bulge=1+.105*Math.sin(x*7+q)*Math.cos(z*6-q)+.055*Math.sin(y*11+z*8+q);
        a.setXYZ(j,x*bulge*(1+variant*.025),y*bulge*.85,z*bulge*(.91+variant*.025));
      }
      geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();return geo;
    });
    // A ring of rounded, photographed stones follows the irregular shoreline.
    // Keep broad gaps between clusters; the open center remains uninterrupted.
    const compositions=[];
    const rounded=[2,7,13,14,5];
    const clusters=[
      {angle:.10,count:4},{angle:.72,count:4,hero:true},
      {angle:1.55,count:3},{angle:2.38,count:5,hero:true},
      {angle:3.03,count:4,hero:true},{angle:3.82,count:3},
      {angle:4.57,count:5},{angle:5.40,count:4}
    ];
    for(const cluster of clusters){
      for(let j=0;j<cluster.count;j++){
        const local=j-(cluster.count-1)*.5;
        const angle=cluster.angle+local*.115+(rand()-.5)*.035;
        let x=Math.cos(angle)*9.1,z=Math.sin(angle)*6.8;
        const outline=1/springRadius(x,z),radial=.982+(j%2?-.024:.021)+(rand()-.5)*.023;
        x*=outline*radial;z*=outline*radial;
        const hero=cluster.hero&&j===Math.floor(cluster.count/2);
        const size=hero?1.72*1.25:.60+rand()*.82;
        compositions.push([x,z,size,rounded[compositions.length%rounded.length],(rand()-.5)*.13,rand()*6.28]);
      }
    }
    for(const [stoneIndex,[x,z,size,index,tilt,rotation]]of compositions.entries()){
      const geo=stoneIndex%7<4?roundedGeometries[stoneIndex%6]:geoFor(index),mesh=new THREE.Mesh(geo,stoneMaterial),box=geo.boundingBox;
      // Normalize individual scans to consistent real dimensions, soften their
      // silhouette without replacing the scanned surface detail with a sphere.
      const extent=new THREE.Vector3();box.getSize(extent);const scale=size/Math.max(extent.x,extent.z);
      mesh.scale.set(scale,scale*.86,scale);
      mesh.position.set(x,bankHeight(x,z)-box.min.y*scale*.86-(size<1?.14:.07),z);
      mesh.rotation.set(tilt,rotation,0);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
      mesh.updateMatrixWorld(true);const worldBounds=new THREE.Box3().setFromObject(mesh);
      if(worldBounds.max.y>-.04&&worldBounds.min.y<.02)obstacles.push({x,z,radius:size*.39});
    }
    for(let i=0;i<12;i++){
      const submerged=i%4!==0;
      const angle=(i+.38)/12*Math.PI*2,radial=submerged?.70+rand()*.10:.88+rand()*.025;
      let x=Math.cos(angle)*9.1,z=Math.sin(angle)*6.8;const outline=1/springRadius(x,z);x*=outline*radial;z*=outline*radial;
      const geo=roundedGeometries[i%6],box=geo.boundingBox,extent=new THREE.Vector3();box.getSize(extent);
      const hero=i===1||i===5||i===6;
      const size=hero?1.7+rand()*.4:.70+rand()*.50,scale=size/Math.max(extent.x,extent.z),mesh=new THREE.Mesh(geo,stoneMaterial);
      const flatten=hero?.60:.66;
      mesh.scale.set(scale,scale*flatten,scale);mesh.position.set(x,bankHeight(x,z)-box.min.y*scale*flatten-.025,z);
      mesh.rotation.set((bankHeight(x,z+.1)-bankHeight(x,z-.1))*.25,rand()*6.28,-(bankHeight(x+.1,z)-bankHeight(x-.1,z))*.25);
      mesh.updateMatrixWorld(true);let worldBounds=new THREE.Box3().setFromObject(mesh);
      if(submerged){
        mesh.position.y-=hero?.035:.18+rand()*.08;
        mesh.updateMatrixWorld(true);worldBounds.setFromObject(mesh);
        mesh.position.y-=Math.max(0,worldBounds.max.y+.10);
        mesh.updateMatrixWorld(true);worldBounds.setFromObject(mesh);
      }
      mesh.name=submerged?'Submerged rounded shelf boulder':'Shallow shoreline dome';
      mesh.receiveShadow=true;mesh.castShadow=true;group.add(mesh);
      if(worldBounds.max.y>-.04&&worldBounds.min.y<.02)obstacles.push({x,z,radius:size*.36});
    }
    const pebbleCount=1600,smallGeo=geoFor(2,2),small=new THREE.InstancedMesh(smallGeo,pebbleMaterial,pebbleCount);small.receiveShadow=true;
    const extent=new THREE.Vector3();smallGeo.boundingBox.getSize(extent);
    for(let i=0;i<pebbleCount;i++){
      const a=rand()*Math.PI*2,r=.66+Math.pow(rand(),.43)*.35;let x=Math.cos(a)*9.1,z=Math.sin(a)*6.8;
      const outline=1/springRadius(x,z);x*=outline*r;z*=outline*r;
      const size=(.025+Math.pow(rand(),2)*.14)/Math.max(extent.x,extent.z);
      dummy.position.set(x,bankHeight(x,z)-smallGeo.boundingBox.min.y*size*.63,z);dummy.rotation.set(rand()*.2,rand()*6.28,0);dummy.scale.set(size,size*.63,size);dummy.updateMatrix();small.setMatrixAt(i,dummy.matrix);
      small.setColorAt(i,new THREE.Color().setHSL(.115,.08,.65+rand()*.27));
    }group.add(small);
  }).catch(error=>console.error('Natural spring stones failed to load',error));
  // The feeder follows a carved mineral channel. No manufactured sill or blocks.
  const streamPositions=[],streamUV=[],streamIndices=[];
  for(let j=0;j<=56;j++){const t=j/56,z=-11.9+t*4.92,cx=streamCenter(z),width=.44+.045*Math.sin(t*9);for(let side=-1;side<=1;side+=2){streamPositions.push(cx+side*width,.235+(-z-7)*.035,z);streamUV.push((side+1)*.5,t);}if(j<56){const k=j*2;streamIndices.push(k,k+2,k+1,k+1,k+2,k+3);}}
  const streamGeo=new THREE.BufferGeometry();streamGeo.setAttribute('position',new THREE.Float32BufferAttribute(streamPositions,3));streamGeo.setAttribute('uv',new THREE.Float32BufferAttribute(streamUV,2));streamGeo.setIndex(streamIndices);streamGeo.computeVertexNormals();
  const streamMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uTime:{value:0}},vertexShader:`
    varying vec2 vUv;varying vec3 vWorld;
    void main(){vUv=uv;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}
  `,fragmentShader:`
    uniform float uTime;varying vec2 vUv;varying vec3 vWorld;
    void main(){
      float t=uTime;float dx=cos(vWorld.x*17.+vWorld.z*4.-t*5.)*.03;float dz=cos(vWorld.z*24.-t*9.)*.047+sin(vWorld.x*13.+vWorld.z*7.-t*6.)*.02;
      vec3 n=normalize(vec3(-dx,1.,-dz)),eye=normalize(cameraPosition-vWorld);
      float fresnel=.02+.98*pow(1.-max(dot(n,eye),0.),5.);
      vec3 color=mix(vec3(.035,.125,.155),vec3(.26,.42,.53),fresnel);
      float glint=pow(max(dot(reflect(-normalize(vec3(.45,.78,.43)),n),eye),0.),180.);
      color+=vec3(.7,.79,.73)*glint*.14;
      float shore=smoothstep(0.,.14,vUv.x)*(1.-smoothstep(.86,1.,vUv.x));
      float ends=smoothstep(0.,.035,vUv.y);
      gl_FragColor=vec4(color,(.19+fresnel*.24)*shore*ends);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `});const stream=new THREE.Mesh(streamGeo,streamMat);stream.visible=false;group.add(stream);
  const rp=[],ruv=[],rseed=[],ri=[];
  for(let r=0;r<25;r++){const x=-.36+r/24*1.15,width=.018+rand()*.024,phase=rand()*6.28;for(let j=0;j<=10;j++){const t=j/10;for(let side=-1;side<=1;side+=2){rp.push(x+side*width*(.45+t*.3),.24*(1-t),-6.99+t*.37);ruv.push((side+1)*.5,t);rseed.push(phase);}if(j<10){const k=r*22+j*2;ri.push(k,k+1,k+2,k+1,k+3,k+2);}}}
  const fallGeo=new THREE.BufferGeometry();fallGeo.setAttribute('position',new THREE.Float32BufferAttribute(rp,3));fallGeo.setAttribute('uv',new THREE.Float32BufferAttribute(ruv,2));fallGeo.setAttribute('aPhase',new THREE.Float32BufferAttribute(rseed,1));fallGeo.setIndex(ri);
  const fallMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uTime:{value:0}},vertexShader:`
    uniform float uTime;attribute float aPhase;varying vec2 vUv;varying float vPhase;
    void main(){vUv=uv;vPhase=aPhase;vec3 p=position;p.x+=sin(uv.y*13.-uTime*7.+aPhase)*.004*uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}
  `,fragmentShader:`
    uniform float uTime;varying vec2 vUv;varying float vPhase;
    void main(){float edge=pow(max(0.,1.-abs(vUv.x*2.-1.)),1.5);float ends=smoothstep(0.,.04,vUv.y)*(1.-smoothstep(.8,1.,vUv.y));float streak=pow(.5+.5*sin(vUv.y*39.-uTime*15.+vPhase),4.);gl_FragColor=vec4(.8,.9,.86,edge*ends*(.09+streak*.24));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `});const fall=new THREE.Mesh(fallGeo,fallMat);fall.visible=false;group.add(fall);
  return {group,ready,bankHeight,obstacles,gate:fall,setGroundOcclusion(texture){groundOcclusion.value=texture||unoccludedGround;},update(dt,time){fallMat.uniforms.uTime.value=time;streamMat.uniforms.uTime.value=time;const p=streamGeo.attributes.position;for(let i=0;i<p.count;i++){const z=p.getZ(i);p.setY(i,.235+(-z-7)*.035+Math.sin(z*12-time*6+p.getX(i)*5)*.005);}p.needsUpdate=true;}};
}
