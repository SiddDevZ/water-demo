import * as THREE from 'three';

export function createBoats(scene, water, bankHeight) {
  const boats=[];let accumulator=0;
  const points=[[-.62,.22,0],[.62,.22,0],[-.35,.10,-.23],[.35,.10,-.23],[-.35,.10,.23],[.35,.10,.23],[-.28,-.07,0],[.28,-.07,0],[0,.58,0],[-.38,.08,0],[.38,.08,0],[0,.08,-.20],[0,.08,.20]];
  const faces=[[0,2,6],[2,3,7],[2,7,6],[3,1,7],[0,6,4],[4,6,7],[4,7,5],[5,7,1],[0,4,9],[0,9,2],[1,10,5],[1,3,10],[9,8,11],[11,8,10],[10,8,12],[12,8,9]];
  const positions=[],colors=[],uv=[];
  faces.forEach((f,i)=>{const color=new THREE.Color(i<8?'#fff2f3':i%2?'#fff9f5':'#f3cdda');for(const v of f){positions.push(...points[v]);colors.push(color.r,color.g,color.b);uv.push(points[v][0]*.7+.5,points[v][2]*1.8+points[v][1]*.3+.5);}});
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff9f4';ctx.fillRect(0,0,256,256);
  let seed=36212;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<4000;i++){const x=random()*256,y=random()*256;ctx.strokeStyle=i%2?'rgba(99,88,70,.045)':'rgba(255,255,255,.16)';ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+1+random()*4,y+(random()-.5)*2);ctx.stroke();}
  const paper=new THREE.CanvasTexture(canvas);paper.colorSpace=THREE.SRGBColorSpace;paper.anisotropy=4;
  const material=new THREE.MeshStandardMaterial({map:paper,bumpMap:paper,bumpScale:.0014,emissive:0xf4d6dc,emissiveIntensity:.06,vertexColors:true,roughness:.84,side:THREE.DoubleSide});
  const edgeGeometry=new THREE.EdgesGeometry(geometry,22),edgeMaterial=new THREE.LineBasicMaterial({color:'#8c7c65',transparent:true,opacity:.1});
  const height=(x,z)=>water.heightAt?.(x,z)||0;
  const safeHull=(x,z,yaw=0)=>{const c=Math.cos(yaw),s=Math.sin(yaw);return [[0,0],[.62,0],[-.62,0],[0,.27],[0,-.27]].every(([a,b])=>bankHeight(x+c*a+s*b,z-s*a+c*b)<-.2);};
  function add(x,z){
    if(!Number.isFinite(x)||!Number.isFinite(z))return;
    const mesh=new THREE.Group();mesh.name='Folded paper boat';const hull=new THREE.Mesh(geometry,material);hull.castShadow=true;hull.receiveShadow=true;mesh.add(hull,new THREE.LineSegments(edgeGeometry,edgeMaterial));
    x=THREE.MathUtils.clamp(x,-7.4,7.4);z=THREE.MathUtils.clamp(z,-5.9,5.9);for(let i=0;i<65&&!safeHull(x,z);i++){x*=.94;z*=.94;}mesh.position.set(x,height(x,z)+.045,z);scene.add(mesh);
    boats.push({mesh,yaw:0,phase:Math.random()*6.28,vx:0,vz:0,vy:0,pitch:0,roll:0,pitchVelocity:0,rollVelocity:0,yawVelocity:0,wake:0});
    water.disturb(x,z,.13);if(boats.length>10)scene.remove(boats.shift().mesh);
  }
  // Four waterline samples support a damped rigid hull. It has inertia, rather than
  // snapping each frame to the center sample or directly to the current vector.
  function update(dt,time,flow=0){
    accumulator+=Math.max(0,Number.isFinite(dt)?dt:0);const step=1/120,steps=Math.floor((accumulator+1e-12)/step);accumulator=Math.max(0,accumulator-steps*step);
    for(const b of boats){const p=b.mesh.position;
      for(let sub=0;sub<steps;sub++){
        const c=Math.cos(b.yaw),s=Math.sin(b.yaw);
        const bow=height(p.x+c*.4,p.z-s*.4),stern=height(p.x-c*.4,p.z+s*.4),port=height(p.x+s*.18,p.z+c*.18),starboard=height(p.x-s*.18,p.z-c*.18);
        const targetY=(bow+stern+port+starboard)*.25+.045;
        const targetRoll=THREE.MathUtils.clamp(1.3*Math.atan2(bow-stern,.8),-.2,.2),targetPitch=THREE.MathUtils.clamp(-1.3*Math.atan2(port-starboard,.36),-.23,.23);
        b.vy+=((targetY-p.y)*75-b.vy*9)*step;p.y+=b.vy*step;
        b.pitchVelocity+=((targetPitch-b.pitch)*100-b.pitchVelocity*8)*step;b.rollVelocity+=((targetRoll-b.roll)*90-b.rollVelocity*8)*step;b.pitch+=b.pitchVelocity*step;b.roll+=b.rollVelocity*step;
        const motion=water.motionAt?.(p.x,p.z)||{vx:0,vz:0};
        const targetVx=motion.vx||0,targetVz=motion.vz||0;
        const drag=2.4;b.vx+=(targetVx-b.vx)*drag*step;b.vz+=(targetVz-b.vz)*drag*step;
        const nx=p.x+b.vx*step,nz=p.z+b.vz*step;
        if(Math.abs(nx)<8.5&&Math.abs(nz)<6.7&&safeHull(nx,nz,b.yaw)){p.x=nx;p.z=nz;}else{
          // Inelastic contact with the shallow bank; keep the hull within the basin.
          const gx=bankHeight(p.x+.13,p.z)-bankHeight(p.x-.13,p.z),gz=bankHeight(p.x,p.z+.13)-bankHeight(p.x,p.z-.13),len=Math.hypot(gx,gz)||1;
          b.vx-=gx/len*.18*step;b.vz-=gz/len*.18*step;b.vx*=Math.exp(-step*2.2);b.vz*=Math.exp(-step*2.2);
          const sx=p.x+b.vx*step,sz=p.z+b.vz*step;if(bankHeight(sx,sz)<bankHeight(p.x,p.z)){p.x=sx;p.z=sz;}
        }
        const currentAngle=Math.atan2(-targetVz,targetVx),angleError=Math.atan2(Math.sin(currentAngle-b.yaw),Math.cos(currentAngle-b.yaw));
        const bowMotion=water.motionAt?.(p.x+c*.4,p.z-s*.4)||motion;
        const sternMotion=water.motionAt?.(p.x-c*.4,p.z+s*.4)||motion;
        const shear=(bowMotion.vx-sternMotion.vx)*s+(bowMotion.vz-sternMotion.vz)*c;
        const torque=Math.sin(angleError*2)*Math.hypot(targetVx,targetVz)*.7-shear*1.8;
        b.yawVelocity+=(torque-b.yawVelocity*1.6)*step;b.yaw+=b.yawVelocity*step;

      }
      b.mesh.rotation.set(b.pitch,b.yaw,b.roll,'YXZ');
      // Only a travelling hull displaces water; never stamp periodic radial drops.
      const travelled=Math.hypot(p.x-(b.lastX??p.x),p.z-(b.lastZ??p.z));
      if(travelled>.003&&Math.hypot(b.vx,b.vz)>.12)water.stirSegment?.(b.lastX,b.lastZ,p.x,p.z,.025,steps*step);
      b.lastX=p.x;b.lastZ=p.z;
    }
  }
  function reset(){accumulator=0;for(const b of boats)scene.remove(b.mesh);boats.length=0;}
  return {add,update,reset,boats};
}
