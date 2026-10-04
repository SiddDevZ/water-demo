import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createLife(scene, water, bankHeight=()=>0) {
  const group=new THREE.Group();group.name='Koi, lilies and bank wildlife';scene.add(group);
  let fishResponse=1;
  function setSettings(config={}){config=config||{};if(typeof config.fishResponse==='number'&&Number.isFinite(config.fishResponse)){fishResponse=THREE.MathUtils.clamp(config.fishResponse,0,2);if(fishResponse===0)for(const fish of fishes){fish.startle=null;fish.fluidX=fish.fluidZ=fish.fluidHeight=0;}}}
  let seed=71024;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const dummy=new THREE.Object3D();let elapsed=0,lastRipple=-10;
  const surface=(x,z)=>water.heightAt?.(x,z)||0;
  const safeWater=(x,z,depth=.55,radius=.32)=>bankHeight(x,z)<-depth&&[[radius,0],[-radius,0],[0,radius],[0,-radius]].every(([dx,dz])=>bankHeight(x+dx,z+dz)<-depth);
  function projectWater(x,z,depth=.55,radius=.32){for(let i=0;i<60&&!safeWater(x,z,depth,radius);i++){x*=.94;z*=.94;}return {x,z};}

  // Rings describe the shoulders, cheeks and narrow caudal peduncle, not a capsule.
  const positions=[],uvs=[],indices=[];const rings=32,sides=24;
  for(let i=0;i<=rings;i++){const u=i/rings,x=-.45+u*.9;const outline=[[-.45,.013,.021],[-.31,.035,.047],[-.13,.077,.10],[.075,.107,.127],[.235,.086,.105],[.365,.047,.059],[.45,.014,.024]];let k=0;while(k<outline.length-2&&x>outline[k+1][0])k++;const t=THREE.MathUtils.smoothstep(x,outline[k][0],outline[k+1][0]);const width=THREE.MathUtils.lerp(outline[k][1],outline[k+1][1],t),depth=THREE.MathUtils.lerp(outline[k][2],outline[k+1][2],t);
    for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2;positions.push(x,Math.sin(a)*depth*(Math.sin(a)<0?.81:1)-.006,Math.cos(a)*width);uvs.push(u,j/sides);if(i<rings&&j<sides){const n=i*(sides+1)+j;indices.push(n,n+sides+1,n+1,n+1,n+sides+1,n+sides+2);}}
  }
  const bodyGeo=new THREE.BufferGeometry();bodyGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));bodyGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));bodyGeo.setIndex(indices);bodyGeo.computeVertexNormals();
  const fishMaps=[];
  for(let kind=0;kind<6;kind++){
    const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');
    ctx.fillStyle=kind===1?'#ff702d':'#fff8e9';ctx.fillRect(0,0,512,256);
    // Large, separated Kohaku pigment islands wrap from the back onto the flanks.
    // White breaks stay clean at the overhead camera's actual pixel footprint.
    const patches=kind===1?[]:[[112+kind*5,64,42,58],[258-kind*4,64,55,57],[414-kind*3,64,48,53]];
    for(let i=0;i<patches.length;i++){
      const [x,y,w,h]=patches[i];ctx.fillStyle=i===1?'#ff7c24':'#f97823';
      ctx.beginPath();for(let a=0;a<=36;a++){const angle=a/36*Math.PI*2,r=1+.11*Math.sin(angle*3+kind+i)+.06*Math.cos(angle*5);ctx.lineTo(x+Math.cos(angle)*w*r,y+Math.sin(angle)*h*r);}ctx.closePath();ctx.fill();
    }
    if(kind===4){for(const [x,y] of [[172,53],[295,86]]){ctx.fillStyle='#28312e';ctx.beginPath();ctx.ellipse(x,y,14,18,.4,0,Math.PI*2);ctx.fill();}}
    // Tiny overlapping scale arcs only provide a glint at close range.
    ctx.lineWidth=.6;for(let row=0;row<28;row++)for(let col=0;col<53;col++){const x=col*10+(row%2)*5,y=row*10;ctx.strokeStyle='rgba(90,77,48,.13)';ctx.beginPath();ctx.arc(x,y,5,-1.1,1.1);ctx.stroke();ctx.strokeStyle='rgba(255,255,246,.15)';ctx.beginPath();ctx.arc(x+.7,y-.5,4.7,-.7,.7);ctx.stroke();}
    const gradient=ctx.createLinearGradient(0,0,0,256);gradient.addColorStop(0,'rgba(255,253,232,.05)');gradient.addColorStop(.25,'rgba(77,75,42,.04)');gradient.addColorStop(.7,'rgba(255,251,225,.05)');gradient.addColorStop(1,'rgba(255,253,239,.15)');ctx.fillStyle=gradient;ctx.fillRect(0,0,512,256);
    // Geometry dorsal UV is v=.25; use canvas row64 directly, without CanvasTexture default vertical inversion.
    const texture=new THREE.CanvasTexture(c);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;fishMaps.push(texture);
  }
  const fishMats=fishMaps.map(map=>new THREE.MeshPhysicalMaterial({map,roughness:.4,metalness:0,clearcoat:.26,clearcoatRoughness:.3}));
  const finCanvas=document.createElement('canvas');finCanvas.width=256;finCanvas.height=256;const fctx=finCanvas.getContext('2d');
  const membrane=fctx.createLinearGradient(0,0,0,256);membrane.addColorStop(0,'rgba(255,248,228,.92)');membrane.addColorStop(.5,'rgba(255,248,230,.70)');membrane.addColorStop(1,'rgba(255,250,236,.34)');fctx.fillStyle=membrane;fctx.fillRect(0,0,256,256);
  for(let i=0;i<23;i++){fctx.strokeStyle='rgba(218,195,146,.25)';fctx.lineWidth=.8;fctx.beginPath();fctx.moveTo(i/22*256,0);fctx.bezierCurveTo(i/22*256+2,95,i/22*256-2,175,i/22*256,256);fctx.stroke();}
  const finTexture=new THREE.CanvasTexture(finCanvas);finTexture.colorSpace=THREE.SRGBColorSpace;
  const finMat=new THREE.MeshStandardMaterial({map:finTexture,color:0xfff9ed,transparent:true,opacity:.9,roughness:.49,side:THREE.DoubleSide,depthWrite:false});
  const eyeMat=new THREE.MeshPhysicalMaterial({color:0x111b16,roughness:.2,clearcoat:.75,clearcoatRoughness:.2});
  // Traveling body curvature moves from the shoulders into the tail; the same phase
  // deforms membranes so the fins never detach from a turning caudal peduncle.
  const animateMaterial=(material,swim,isFin=false)=>{
    material.onBeforeCompile=shader=>{shader.uniforms.uSwimPhase=swim.phase;shader.uniforms.uSwimAmplitude=swim.amplitude;shader.uniforms.uSwimTurn=swim.turn;
      shader.vertexShader=`uniform float uSwimPhase;uniform float uSwimAmplitude;uniform float uSwimTurn;
      float koiBend(float x){float tail=1.0-smoothstep(-.67,.30,x);return sin(uSwimPhase+x*6.8)*tail*tail*uSwimAmplitude+uSwimTurn*tail*tail*.029;}
      `+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nfloat bendSlope=(koiBend(position.x+.004)-koiBend(position.x-.004))/.008;objectNormal.x-=bendSlope*objectNormal.z;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        transformed.z+=koiBend(position.x);
        ${isFin?'float spread=smoothstep(.075,.25,abs(position.z));transformed.y+=sin(uSwimPhase*.56+abs(position.z)*9.0)*spread*.023;':''}
      `);
    };material.customProgramCacheKey=()=>isFin?'koi-membranes-2':'koi-body-2';
  };
  const fin=(root,boundary,bow=0)=>{
    const curve=new THREE.CatmullRomCurve3(boundary.map(point=>new THREE.Vector3(...point)));const p=[],uv=[],ix=[];const rays=20,steps=6;
    for(let r=0;r<=rays;r++){const edge=curve.getPoint(r/rays);for(let j=0;j<=steps;j++){const t=j/steps,v=new THREE.Vector3(...root).lerp(edge,t);v.z+=Math.sin(t*Math.PI)*bow;p.push(v.x,v.y,v.z);uv.push(r/rays,t);if(r<rays&&j<steps){const k=r*(steps+1)+j;ix.push(k,k+1,k+steps+1,k+1,k+steps+2,k+steps+1);}}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ix);geo.computeVertexNormals();return geo;
  };
  const allFinsGeo=mergeGeometries([
    fin([-.445,0,0],[[-.60,.125,0],[-.69,.17,0],[-.65,.06,0],[-.594,0,0],[-.65,-.06,0],[-.69,-.17,0],[-.60,-.125,0]],.012),
    fin([.1,-.035,.064],[[.015,-.035,.09],[-.015,-.061,.21],[-.11,-.085,.245],[-.17,-.081,.177],[-.13,-.06,.08]],.008),
    fin([.1,-.035,-.064],[[.015,-.035,-.09],[-.015,-.061,-.21],[-.11,-.085,-.245],[-.17,-.081,-.177],[-.13,-.06,-.08]],-.008),
    fin([-.075,.09,0],[[.095,.123,0],[.016,.186,0],[-.07,.169,0],[-.2,.109,0],[-.25,.067,0]],.009),
    fin([-.22,-.055,.035],[[-.20,-.077,.05],[-.31,-.109,.11],[-.34,-.101,.075]],.005),
    fin([-.22,-.055,-.035],[[-.20,-.077,-.05],[-.31,-.109,-.11],[-.34,-.101,-.075]],-.005)
  ]);
  const eyes=mergeGeometries([-1,1].map(sign=>{const geo=new THREE.SphereGeometry(.014,6,4);geo.translate(.337,.035,sign*.061);return geo;}));
  const fishes=[];
  const homes=[[-3.02,1.13],[-.98,.44],[-.93,2.99],[1.63,4.30],[4.12,4.0],[4.37,2.09]];
  for(let i=0;i<6;i++){
    const fish=new THREE.Group();fish.name='Koi '+(i+1);
    const swim={phase:{value:rand()*6.28},amplitude:{value:.045},turn:{value:0}};
    const bodyMat=fishMats[i].clone(),membraneMat=finMat.clone();animateMaterial(bodyMat,swim);animateMaterial(membraneMat,swim,true);
    const body=new THREE.Mesh(bodyGeo,bodyMat);body.castShadow=true;body.receiveShadow=true;
    body.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});animateMaterial(body.customDepthMaterial,swim);fish.add(body);
    const fins=new THREE.Mesh(allFinsGeo,membraneMat);fins.castShadow=true;fins.receiveShadow=true;
    fins.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:finTexture,alphaTest:.32,side:THREE.DoubleSide});animateMaterial(fins.customDepthMaterial,swim,true);fish.add(fins);fish.add(new THREE.Mesh(eyes,eyeMat));
    const scale=1.02+rand()*.11;fish.scale.setScalar(scale);
    const home=projectWater(...homes[i],.38,.32),phase=i*Math.PI*2/6+.22;
    fish.position.set(home.x,-.17-rand()*.045,home.z);group.add(fish);
    const angle=[-.95,-.75,-.6,.8,-1.2,.55][i];fish.rotation.y=angle;
    fishes.push({mesh:fish,fins,swim,home,phase,angle,speed:.22+rand()*.10,currentSpeed:.25,verticalVelocity:0,depth:fish.position.y});
  }
  const foodGeo=new THREE.SphereGeometry(.025,5,3),foodMat=new THREE.MeshStandardMaterial({color:0xb89658,roughness:.9});const crumbs=new THREE.InstancedMesh(foodGeo,foodMat,24);crumbs.count=0;group.add(crumbs);let food=null;
  function feed(x,z){if(!Number.isFinite(x)||!Number.isFinite(z))return;const point=projectWater(THREE.MathUtils.clamp(x,-6.3,6.3),THREE.MathUtils.clamp(z,-4.5,4.9));const fx=point.x,fz=point.z;food={x:fx,z:fz,created:elapsed,bits:Array.from({length:24},()=>({angle:rand()*6.28,radius:.08+rand()*.3}))};crumbs.count=24;water.disturb?.(fx,fz,.025,.2);}
  function spook(x,z,strength=1){
    if(!Number.isFinite(x)||!Number.isFinite(z)||fishResponse===0)return;
    const power=THREE.MathUtils.clamp(Number(strength)||0,0,2),radius=2.2+power*1.15;
    fishes.forEach(fish=>{const p=fish.mesh.position,dx=p.x-x,dz=p.z-z,distance=Math.hypot(dx,dz);if(distance>=radius)return;
      const angle=distance>.03?Math.atan2(dz,dx):fish.phase;
      fish.startle={until:elapsed+1.7,created:elapsed,x:THREE.MathUtils.clamp(p.x+Math.cos(angle)*2.25*fishResponse,-6.5,6.5),z:THREE.MathUtils.clamp(p.z+Math.sin(angle)*2.25*fishResponse,-4.8,5),power:(.78+power*.48)*fishResponse};
    });
  }
  // A cupped, asymmetric lamina with an open sinus and subtly rolled rim.
  const padPositions=[],padUVs=[],padIndices=[];const padSegments=64,padRings=7;
  for(let ring=0;ring<=padRings;ring++)for(let j=0;j<=padSegments;j++){
    const a=.1+j/padSegments*(Math.PI*2-.2),t=ring/padRings;
    const radius=.43*(1+.038*Math.sin(a*5+.3)+.025*Math.sin(a*11))*(.96+.055*Math.cos(a));
    const x=Math.cos(a)*radius*t,z=Math.sin(a)*radius*t*.91;
    const y=.013*Math.pow(t,4)*(1+.55*Math.sin(a*3))-.008*Math.sin(t*Math.PI)+.003*Math.sin(a*7)*t;
    padPositions.push(x,y,z);padUVs.push(x/.9+.5,z/.9+.5);if(ring<padRings&&j<padSegments){const k=ring*(padSegments+1)+j;padIndices.push(k,k+1,k+padSegments+1,k+1,k+padSegments+2,k+padSegments+1);}
  }
  const padGeo=new THREE.BufferGeometry();padGeo.setAttribute('position',new THREE.Float32BufferAttribute(padPositions,3));padGeo.setAttribute('uv',new THREE.Float32BufferAttribute(padUVs,2));padGeo.setIndex(padIndices);padGeo.computeVertexNormals();
  const padCanvas=document.createElement('canvas');padCanvas.width=padCanvas.height=512;const padCtx=padCanvas.getContext('2d');padCtx.fillStyle='#46602f';padCtx.fillRect(0,0,512,512);
  // Pigment clouds, edge freckles and branching veins avoid the uniform radial-disc appearance.
  for(let i=0;i<1900;i++){const x=rand()*512,y=rand()*512,r=rand()*13+2;padCtx.fillStyle=i%4?'rgba(91,119,52,.035)':'rgba(26,56,27,.065)';padCtx.beginPath();padCtx.ellipse(x,y,r,r*.7,rand()*6.28,0,6.28);padCtx.fill();}
  for(let i=0;i<13;i++){const a=i/13*6.28+.07*Math.sin(i*3),length=205+rand()*28;padCtx.strokeStyle='rgba(169,173,94,.21)';padCtx.lineWidth=1.15;padCtx.beginPath();padCtx.moveTo(256,256);padCtx.quadraticCurveTo(256+Math.cos(a+.06)*120,256+Math.sin(a+.06)*120,256+Math.cos(a)*length,256+Math.sin(a)*length);padCtx.stroke();for(let b=0;b<7;b++){const r=45+b*22;for(const side of [-1,1]){const x=256+Math.cos(a)*r,y=256+Math.sin(a)*r;padCtx.strokeStyle='rgba(163,170,87,.11)';padCtx.lineWidth=.6;padCtx.beginPath();padCtx.moveTo(x,y);padCtx.quadraticCurveTo(x+Math.cos(a+side*.7)*22,y+Math.sin(a+side*.7)*22,x+Math.cos(a+side*.47)*45,y+Math.sin(a+side*.47)*45);padCtx.stroke();}}}
  for(let i=0;i<85;i++){const a=rand()*6.28,r=198+rand()*30;padCtx.fillStyle='rgba(121,96,39,.14)';padCtx.beginPath();padCtx.ellipse(256+Math.cos(a)*r,256+Math.sin(a)*r,1+rand()*4,1+rand()*2,a,0,6.28);padCtx.fill();}
  const padTexture=new THREE.CanvasTexture(padCanvas);padTexture.colorSpace=THREE.SRGBColorSpace;padTexture.anisotropy=8;
  const padMat=new THREE.MeshPhysicalMaterial({map:padTexture,bumpMap:padTexture,bumpScale:.003,color:0xe4e7c8,roughness:.54,clearcoat:.16,clearcoatRoughness:.39,side:THREE.DoubleSide});const pads=new THREE.InstancedMesh(padGeo,padMat,4);pads.receiveShadow=true;group.add(pads);
  const padPlaces=Array.from({length:4},(_,i)=>{const center=[-5.8,-3.8],a=(i%5)*2.4;const pad={x:center[0]+Math.cos(a)*.52,z:center[1]+Math.sin(a)*.54,s:.55+rand()*.36,r:rand()*6.28,stretch:.87+rand()*.25,y:0,pitch:0,roll:0};Object.assign(pad,projectWater(pad.x,pad.z,.22,.42));pads.setColorAt(i,new THREE.Color().setHSL(.21+rand()*.025,.11+rand()*.06,.79+rand()*.17));return pad;});
  // Curled radial petals share a single geometry and two instanced blossoms.
  const petals=[];for(let layer=0;layer<3;layer++)for(let i=0;i<9;i++){const a=i/9*6.28+layer*.32;const points=[],ix=[];for(let j=0;j<=7;j++){const t=j/7,width=Math.sin(t*Math.PI)*(.058-layer*.012),radius=.018+t*(.24-layer*.047),height=.025+layer*.03+Math.pow(t,2)*(.08+layer*.025);for(let side=-1;side<=1;side+=2)points.push(Math.cos(a)*radius-Math.sin(a)*width*side,height,Math.sin(a)*radius+Math.cos(a)*width*side);if(j<7){const k=j*2;ix.push(k,k+1,k+2,k+1,k+3,k+2);}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setIndex(ix);geo.computeVertexNormals();petals.push(geo);}const flowers=new THREE.InstancedMesh(mergeGeometries(petals),new THREE.MeshStandardMaterial({color:0xf0d7d0,roughness:.55,side:THREE.DoubleSide}),1);group.add(flowers);
  const centers=new THREE.InstancedMesh(new THREE.SphereGeometry(.035,8,5),new THREE.MeshStandardMaterial({color:0xd9ab35,roughness:.6}),1);group.add(centers);pads.visible=false;flowers.visible=false;centers.visible=false;
  // Two small dragonflies: a blue-green thorax, tapered abdomen and four pale wings.
  const insectBodyGeo=new THREE.SphereGeometry(1,6,4);const insectBodies=new THREE.InstancedMesh(insectBodyGeo,new THREE.MeshStandardMaterial({color:0x297b8b,metalness:.3,roughness:.4}),2);group.add(insectBodies);
  const wingShape=new THREE.Shape();wingShape.moveTo(0,0);wingShape.bezierCurveTo(.06,.012,.2,.015,.22,.045);wingShape.bezierCurveTo(.22,.085,.04,.06,0,0);const wingGeo=new THREE.ShapeGeometry(wingShape,8);wingGeo.rotateX(-Math.PI/2);const wings=new THREE.InstancedMesh(wingGeo,new THREE.MeshStandardMaterial({color:0xd9e4d9,transparent:true,opacity:.36,roughness:.38,side:THREE.DoubleSide,depthWrite:false}),8);group.add(wings);
  function reset(){food=null;crumbs.count=0;fishes.forEach((fish,i)=>{fish.mesh.position.set(fish.home.x,fish.depth,fish.home.z);fish.startle=null;fish.currentSpeed=.3;fish.verticalVelocity=0;fish.wakeCooldown=0;fish.fluidX=fish.fluidZ=fish.fluidHeight=0;});}
  function update(dt,time){elapsed=time;dt=Math.min(dt,.06);
    for(let i=0;i<fishes.length;i++){
      const fish=fishes[i],p=fish.mesh.position;
      const motion=water.motionAt?.(p.x,p.z)||{vx:0,vz:0,height:0};
      const fluidX=THREE.MathUtils.clamp(Number(motion.vx)||0,-1.4,1.4)*fishResponse,fluidZ=THREE.MathUtils.clamp(Number(motion.vz)||0,-1.4,1.4)*fishResponse,fluidSpeed=Math.hypot(fluidX,fluidZ);
      fish.fluidX=THREE.MathUtils.damp(fish.fluidX||0,fluidX,4.2,dt);fish.fluidZ=THREE.MathUtils.damp(fish.fluidZ||0,fluidZ,4.2,dt);
      fish.fluidHeight=THREE.MathUtils.damp(fish.fluidHeight||0,THREE.MathUtils.clamp(Number(motion.height)||0,-.12,.12)*fishResponse,3,dt);
      if(fluidSpeed>.075&&time>(fish.wakeCooldown||0)&&!fish.startle){
        const direction=Math.atan2(fluidZ,fluidX)+(i%2?.55:-.55),escape=projectWater(p.x+Math.cos(direction)*1.55*fishResponse,p.z+Math.sin(direction)*1.55*fishResponse,.38,.30);
        fish.startle={until:time+1.1,created:time,x:escape.x,z:escape.z,power:(.58+Math.min(.75,fluidSpeed*1.8))*fishResponse};
        fish.wakeCooldown=time+2.7;
      }
      if(fish.startle&&time>=fish.startle.until)fish.startle=null;const startle=fish.startle;let tx,tz;
      if(startle){tx=startle.x;tz=startle.z;}else if(food){tx=food.x+Math.cos(time*.4+i*2.4)*.25;tz=food.z+Math.sin(time*.4+i*2.4)*.25;}else{tx=fish.home.x+Math.cos(time*.09+fish.phase)*1.25;tz=fish.home.z+Math.sin(time*.077+fish.phase)*.95;}
      const dx=tx-p.x,dz=tz-p.z,distance=Math.hypot(dx,dz),target=Math.atan2(-dz,dx),difference=Math.atan2(Math.sin(target-fish.angle),Math.cos(target-fish.angle));const turnRate=startle?4.2:.72;fish.angle+=THREE.MathUtils.clamp(difference,-dt*turnRate,dt*turnRate);
      const alarm=startle?Math.pow(Math.max(0,(startle.until-time)/(startle.until-startle.created)),.65):0;const stroke=.82+.18*Math.sin(time*1.35+fish.phase);const desiredSpeed=Math.min(1.8,fish.speed*(food?1.2:stroke)+alarm*(startle?.power||0))*THREE.MathUtils.clamp(distance,.22,1);fish.currentSpeed=THREE.MathUtils.damp(fish.currentSpeed,desiredSpeed,startle?8:2.8,dt);let speed=fish.currentSpeed;for(let j=0;j<fishes.length;j++){if(i===j)continue;const other=fishes[j].mesh.position,sq=p.distanceToSquared(other);if(sq<.64){p.x+=(p.x-other.x)*dt*.24;p.z+=(p.z-other.z)*dt*.24;}}
      const nx=p.x+(Math.cos(fish.angle)*speed+fish.fluidX*.24)*dt,nz=p.z+(-Math.sin(fish.angle)*speed+fish.fluidZ*.24)*dt;
      if(safeWater(nx,nz,.38,.30)){p.x=nx;p.z=nz;}else{
        const gx=bankHeight(p.x+.3,p.z)-bankHeight(p.x-.3,p.z),gz=bankHeight(p.x,p.z+.3)-bankHeight(p.x,p.z-.3);
        fish.angle=Math.atan2(gz,-gx);fish.currentSpeed*=.7;
        if(!safeWater(p.x,p.z,.36,.3)){const safe=projectWater(p.x,p.z,.38,.30);p.x=safe.x;p.z=safe.z;}
      }
      p.x=THREE.MathUtils.clamp(p.x,-6.7,6.7);p.z=THREE.MathUtils.clamp(p.z,-5,5.2);const targetDepth=fish.depth+Math.sin(time*.39+fish.phase)*.034+(food?Math.max(0,1-distance/1.3)*.065:0)-alarm*.045+fish.fluidHeight*.22;fish.verticalVelocity+=(targetDepth-p.y)*dt*7;fish.verticalVelocity*=Math.exp(-dt*4.5);p.y=THREE.MathUtils.clamp(p.y+fish.verticalVelocity*dt,Math.max(-.29,bankHeight(p.x,p.z)+.19),-.11);fish.mesh.rotation.y=fish.angle;fish.mesh.rotation.z=THREE.MathUtils.damp(fish.mesh.rotation.z,Math.atan2(fish.verticalVelocity,Math.max(.2,speed))*.4,3,dt);fish.mesh.rotation.x=THREE.MathUtils.damp(fish.mesh.rotation.x,THREE.MathUtils.clamp(difference,-1,1)*-.035,3,dt);fish.swim.phase.value+=dt*(3.1+speed*7.8);fish.swim.amplitude.value=THREE.MathUtils.damp(fish.swim.amplitude.value,.022+speed*.058+alarm*.027,7,dt);fish.swim.turn.value=THREE.MathUtils.damp(fish.swim.turn.value,THREE.MathUtils.clamp(difference,-1,1),4,dt);
      if(food&&!startle&&distance<.35&&time-lastRipple>.8){water.disturb?.(p.x,p.z,.009,.1);lastRipple=time;food.bits.pop();}
    }
    if(food){const age=time-food.created;if(age>16||!food.bits.length){food=null;crumbs.count=0;}else{crumbs.count=food.bits.length;food.bits.forEach((bit,i)=>{const radius=bit.radius+Math.min(age*.008,.1),x=food.x+Math.cos(bit.angle)*radius,z=food.z+Math.sin(bit.angle)*radius;dummy.position.set(x,surface(x,z)+.014,z);dummy.rotation.set(0,bit.angle,0);dummy.scale.setScalar(Math.max(.35,1-age/22));dummy.updateMatrix();crumbs.setMatrixAt(i,dummy.matrix);});crumbs.instanceMatrix.needsUpdate=true;}}
    padPlaces.forEach((pad,i)=>{const blend=dt===0?1:1-Math.exp(-dt*5);pad.y=THREE.MathUtils.lerp(pad.y,surface(pad.x,pad.z)+.012,blend);pad.pitch=THREE.MathUtils.lerp(pad.pitch,-Math.atan((surface(pad.x,pad.z+.16)-surface(pad.x,pad.z-.16))/.32)*.5,blend);pad.roll=THREE.MathUtils.lerp(pad.roll,Math.atan((surface(pad.x+.16,pad.z)-surface(pad.x-.16,pad.z))/.32)*.5,blend);dummy.position.set(pad.x,pad.y,pad.z);dummy.rotation.set(pad.pitch,pad.r,pad.roll);dummy.scale.set(pad.s*pad.stretch,pad.s,pad.s);dummy.updateMatrix();pads.setMatrixAt(i,dummy.matrix);});pads.instanceMatrix.needsUpdate=true;
    for(let i=0;i<1;i++){const pad=padPlaces[i*5];dummy.position.set(pad.x,pad.y+.003,pad.z);dummy.rotation.set(pad.pitch,pad.r,pad.roll);dummy.scale.setScalar(.8);dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);dummy.position.y+=.09;dummy.scale.set(.8,.48,.8);dummy.updateMatrix();centers.setMatrixAt(i,dummy.matrix);}flowers.instanceMatrix.needsUpdate=true;centers.instanceMatrix.needsUpdate=true;
    for(let i=0;i<2;i++){const phase=time*(.17+i*.014)+i*2.3,x=(i%2?-1:1)*(7.5+Math.sin(phase)*1.1),z=Math.sin(phase*.73)*5,y=Math.max(.3,bankHeight(x,z))+.7+Math.sin(phase*2)*.3;dummy.position.set(x,y,z);dummy.rotation.set(0,phase+.7,0);dummy.scale.set(.026,.021,.14);dummy.updateMatrix();insectBodies.setMatrixAt(i,dummy.matrix);for(let w=0;w<4;w++){dummy.position.set(x,y,z+(w>1?.045:-.025));dummy.rotation.set(0,phase+(w%2?Math.PI:0),Math.sin(time*42+i)*.28*(w%2?-1:1));dummy.scale.setScalar(.7);dummy.updateMatrix();wings.setMatrixAt(i*4+w,dummy.matrix);}}insectBodies.instanceMatrix.needsUpdate=true;wings.instanceMatrix.needsUpdate=true;
  }
  update(0,0);
  return {group,update,feed,spook,reset,setSettings,getState(){return {startled:fishes.filter(fish=>fish.startle&&fish.startle.until>elapsed).length,feeding:food!==null,foodRemaining:food?.bits.length||0,target:food?{x:food.x,z:food.z}:null,fish:fishes.map(fish=>({x:fish.mesh.position.x,y:fish.mesh.position.y,z:fish.mesh.position.z,speed:fish.currentSpeed,tailAmplitude:fish.swim.amplitude.value}))};},stats:{koi:6,dragonflies:2,lilyPads:0,flowers:0}};
}
