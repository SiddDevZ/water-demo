import * as THREE from 'three';
import { createWaveField } from './wave-field.js';
import { createCaustics } from './caustics.js';

// Low-amplitude wind chop; all interaction energy propagates through wave-field.js.
// Optics use live planar captures, physical Fresnel and depth absorption.
const WIND_WAVES=[[1,.32,.0027,3.8,6.10],[-.38,1,.003375,11.8,10.76],[.76,-.65,.00225,17.7,13.18],[-.9,-.24,.00135,23.,15.02],[.41,.91,.0018,7.3,8.46]];
const waveGLSL = /* glsl */ `
  uniform float uTime,uWaveGain;
  uniform sampler2D uField,uTerrain;
  void wind(vec2 p,vec2 direction,float a,float k,float omega,float footprint,inout vec3 result){
    vec2 d=normalize(direction);
    vec2 transverse=vec2(-d.y,d.x);
    float crossPhase=dot(p,transverse)*k*.71+uTime*omega*.14;
    float phase=dot(p,d)*k-uTime*omega+.35*sin(crossPhase);
    vec2 phaseGradient=k*(d+transverse*.2485*cos(crossPhase));
    a*=1.-smoothstep(.6,2.4,k*footprint);
    result+=vec3(sin(phase),phaseGradient*cos(phase))*a;
  }
  vec3 waves(vec2 p,float footprint){
    vec3 result=vec3(0.);
    wind(p,vec2(1.,.32),.0027,3.8,6.10,footprint,result);
    wind(p,vec2(-.38,1.),.003375,11.8,10.76,footprint,result);
    wind(p,vec2(.76,-.65),.00225,17.7,13.18,footprint,result);
    wind(p,vec2(-.9,-.24),.00135,23.,15.02,footprint,result);
    wind(p,vec2(.41,.91),.0018,7.3,8.46,footprint,result);
    vec2 uv=(p+vec2(10.,8.))/vec2(20.,16.);
    vec4 terrain=texture2D(uTerrain,uv);
    result*=uWaveGain;
    result.yz=result.yz*terrain.g+result.x*terrain.ba;
    result.x*=terrain.g;
    float e=.105;
    float h=texture2D(uField,uv).r;
    vec2 slope=vec2(
      texture2D(uField,uv+vec2(e/20.,0.)).r-texture2D(uField,uv-vec2(e/20.,0.)).r,
      texture2D(uField,uv+vec2(0.,e/16.)).r-texture2D(uField,uv-vec2(0.,e/16.)).r)/(2.*e);
    result.x+=h*terrain.g;
    result.yz+=slope*terrain.g+h*terrain.ba;
    return result;
  }
`;
export function sampleAmbientWaves(x,z,time,gain=1){
  let height=0,slopeX=0,slopeZ=0;
  for(const [vx,vz,a,k,omega] of WIND_WAVES){
    const len=Math.hypot(vx,vz),dx=vx/len,dz=vz/len;
    const crossPhase=(-x*dz+z*dx)*k*.71+time*omega*.14;
    const phase=(x*dx+z*dz)*k-time*omega+.35*Math.sin(crossPhase);
    height+=Math.sin(phase)*a*gain;
    slopeX+=Math.cos(phase)*a*k*gain*(dx-dz*.2485*Math.cos(crossPhase));
    slopeZ+=Math.cos(phase)*a*k*gain*(dz+dx*.2485*Math.cos(crossPhase));
  }
  return {height,slopeX,slopeZ};
}

export function createWater(scene,renderer,camera) {
  const NX=192,NZ=154,total=NX*NZ;
  const waveField=createWaveField({width:20,depth:16,nx:NX,nz:NZ});
  const pixels=waveField.texturePixelsRGBA;
  const terrainPixels=new Float32Array(total*4);
  for(let i=0;i<total;i++){terrainPixels[i*4]=-2;terrainPixels[i*4+1]=1;}
  const terrainTexture=new THREE.DataTexture(terrainPixels,NX,NZ,THREE.RGBAFormat,THREE.FloatType);
  terrainTexture.minFilter=terrainTexture.magFilter=THREE.LinearFilter;terrainTexture.needsUpdate=true;
  const field=new THREE.DataTexture(pixels,NX,NZ,THREE.RGBAFormat,THREE.FloatType);
  field.minFilter=field.magFilter=THREE.LinearFilter;field.needsUpdate=true;
  const makeTarget=()=>{
    const t=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true,samples:4});
    t.texture.colorSpace=THREE.LinearSRGBColorSpace;
    t.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    t.depthTexture.minFilter=t.depthTexture.magFilter=THREE.NearestFilter;
    return t;
  };
  const transmission=makeTarget(),reflection=makeTarget();
  const reflectCamera=camera.clone(),reflectMatrix=new THREE.Matrix4();
  const uniforms={...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
    uTime:{value:0},uField:{value:field},uTerrain:{value:terrainTexture},uWaveGain:{value:1},
    uAbsorption:{value:new THREE.Vector3(5.,1.2,.08)},uScatterColor:{value:new THREE.Color(.001,.18,.38)},uScatterDensity:{value:.90},
    uColor:{value:transmission.texture},uDepth:{value:transmission.depthTexture},
    uReflection:{value:reflection.texture},uReflectionDepth:{value:reflection.depthTexture},
    uReflectionMatrix:{value:reflectMatrix},uReflectionInverse:{value:new THREE.Matrix4()},uReflectionWorld:{value:new THREE.Matrix4()},uReflectionWeight:{value:1},
    uInverseProjection:{value:new THREE.Matrix4()},uCameraWorld:{value:new THREE.Matrix4()},
    uNear:{value:camera.near},uFar:{value:camera.far},uWaterLevel:{value:0},uUnderwater:{value:0},
    uSun:{value:new THREE.Vector3(-90,28,-60).normalize()},uSunColor:{value:new THREE.Color(1,.84,.58)},
  };
  const material=new THREE.ShaderMaterial({uniforms,lights:true,side:THREE.DoubleSide,
    vertexShader:`
      #include <common>
      #include <shadowmap_pars_vertex>
      ${waveGLSL}
      varying vec3 vWorld;
      varying vec4 vClip;
      void main(){
        vec4 world=modelMatrix*vec4(position,1.);
        vec3 waveData=waves(world.xz,0.);
        world.y=waveData.x;
        vWorld=world.xyz;vClip=projectionMatrix*viewMatrix*world;gl_Position=vClip;
        vec4 worldPosition=world;
        vec3 transformedNormal=normalMatrix*normalize(vec3(-waveData.y,1.,-waveData.z));
        #include <shadowmap_vertex>
      }
    `,
    fragmentShader:`
      #include <common>
      #include <packing>
      #include <shadowmap_pars_fragment>
      uniform bool receiveShadow;
      #include <shadowmask_pars_fragment>
      ${waveGLSL}
      uniform sampler2D uReflection,uReflectionDepth;
      uniform mat4 uReflectionMatrix,uReflectionInverse,uReflectionWorld;
      uniform float uReflectionWeight;
      uniform vec3 uSunColor,uAbsorption,uScatterColor;
      uniform float uScatterDensity;
      uniform sampler2D uColor;
      uniform sampler2D uDepth;
      uniform mat4 uInverseProjection;
      uniform mat4 uCameraWorld;
      uniform float uNear;
      uniform float uFar;
      uniform float uWaterLevel;
      uniform float uUnderwater;
      uniform vec3 uSun;
      varying vec3 vWorld;
      varying vec4 vClip;
      float linearDepth(float depth) {
        return (uNear * uFar) / (uFar - depth * (uFar - uNear));
      }
      vec3 reconstruct(vec2 uv, float depth) {
        vec4 view = uInverseProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        return (uCameraWorld * vec4(view.xyz / view.w, 1.0)).xyz;
      }
      vec3 sky(vec3 direction) {
        float elevation = pow(clamp(direction.y, 0.0, 1.0), 0.55);
        vec3 color = mix(vec3(.12,.40,.82), vec3(.025,.16,.55), elevation);
        color += vec3(1.0, 0.68, 0.32) * pow(max(dot(direction, uSun), 0.0), 12.0) * 0.10;
        return color;
      }
      void main() {
        vec4 terrain=texture2D(uTerrain,(vWorld.xz+vec2(10.,8.))/vec2(20.,16.));
        if(terrain.r>=-.005)discard;
        vec2 uv = vClip.xy / vClip.w * 0.5 + 0.5;
        // capillary detail fades before it becomes subpixel shimmer
        float footprint = max(length(dFdx(vWorld.xz)), length(dFdy(vWorld.xz)));
        vec3 waveData = waves(vWorld.xz, footprint);
        vec3 normal = normalize(vec3(-waveData.y, 1.0, -waveData.z));
        vec3 toEye = normalize(cameraPosition - vWorld);
        if (uUnderwater > 0.5) normal = -normal;
        float sceneDepth = texture2D(uDepth, uv).r;
        float surfaceDepth = -(viewMatrix * vec4(vWorld, 1.0)).z;
        float depthGap = max(linearDepth(sceneDepth) - surfaceDepth, 0.0);
        // Refraction bends with surface perturbations, not camera tilt.
        // Using the absolute view normal offsets shallow object silhouettes twice.
        vec3 viewNormal = mat3(viewMatrix) * (normal - vec3(0.0, 1.0, 0.0));
        // Refraction follows the actual distance to a fish or the mineral bed.
        float columnLength=max(-terrain.r,0.)/max(abs(toEye.y),.3);
        float objectPath=min(columnLength,length(reconstruct(uv,sceneDepth)-vWorld));
        vec2 distortion = viewNormal.xy * min(objectPath, 4.0) * 0.035 / max(surfaceDepth * 0.16, 1.0);
        distortion*=smoothstep(0.,.06,depthGap);
        vec2 refractedUV = clamp(uv + distortion, vec2(0.002), vec2(0.998));
        float refractedDepth = texture2D(uDepth, refractedUV).r;
        vec3 hit = reconstruct(refractedUV, refractedDepth);
        // reject foreground silhouettes instead of dragging land into the sea
        if (linearDepth(refractedDepth) < surfaceDepth + 0.03 ||
            (uUnderwater < 0.5 && hit.y > uWaterLevel + 0.15)) {
          refractedUV = uv;
          refractedDepth = sceneDepth;
          hit = reconstruct(uv, sceneDepth);
        }
        float waterDistance = min(length(hit - vWorld), 65.0);
        if (refractedDepth > 0.99999) waterDistance = 65.0;
        // the underwater scene is already fogged by the main pass setup
        if (uUnderwater > 0.5) waterDistance = 0.0;
        // Clear, sunlit margins graduate into the richer blue central basin.
        vec3 absorption=uAbsorption;
        absorption.y*=mix(.18,1.,smoothstep(.60,2.7,-terrain.r));
        vec3 transmission = exp(-absorption * waterDistance);
        vec3 refracted = texture2D(uColor, refractedUV).rgb;
        float sunVisibility=getShadowMask();
        // Selectively remove red while retaining blue/green bottom detail.
        // A small suspended-particle term adds depth colour without a flat coat.
        vec3 scattering=uScatterColor*mix(.45,1.,sunVisibility);
        vec3 water=refracted*transmission+scattering*(1.-exp(-uScatterDensity*waterDistance));
        float ndv = clamp(dot(normal, toEye), 0.0, 1.0);
        float fresnel = 0.0204 + 0.9796 * pow(1.0 - ndv, 5.0);
        vec3 reflected = reflect(-toEye, normal);
        vec3 reflection = sky(reflected);
        vec4 mirrorClip=uReflectionMatrix*vec4(vWorld.x,0.,vWorld.z,1.);
        vec2 flatUV=clamp(mirrorClip.xy/mirrorClip.w*.5+.5,vec2(.002),vec2(.998));
        float mirrorDepth=texture2D(uReflectionDepth,clamp(flatUV,.001,.999)).r;
        vec4 mirrorView=uReflectionInverse*vec4(flatUV*2.-1.,mirrorDepth*2.-1.,1.);
        vec3 mirrorHit=(uReflectionWorld*vec4(mirrorView.xyz/mirrorView.w,1.)).xyz;
        // Bend the actual reflected ray toward the captured object's height.
        // Reflection geometry moves with the scene; there is no white overlay.
        float reflectedHeight=mirrorDepth<.99998?max(mirrorHit.y-vWorld.y,.15):4.;
        float rayLength=min(reflectedHeight/max(reflected.y,.12),28.);
        vec3 bentHit=vWorld+reflected*rayLength;
        vec4 bentClip=uReflectionMatrix*vec4(bentHit,1.);
        vec2 mirrorUV=bentClip.xy/bentClip.w*.5+.5;
        float mirrorValid=step(.001,bentClip.w)*step(.002,mirrorUV.x)*step(mirrorUV.x,.998)*step(.002,mirrorUV.y)*step(mirrorUV.y,.998);
        mirrorUV=clamp(mirrorUV,vec2(.002),vec2(.998));
        reflection=mix(reflection,texture2D(uReflection,mirrorUV).rgb,mirrorValid*uReflectionWeight);
        if (uUnderwater > 0.5) {
          float totalInternal = 1.0 - smoothstep(0.64, 0.69, ndv);
          fresnel = max(fresnel, totalInternal);
          reflection = vec3(0.025, 0.16, 0.17);
        }
        vec3 halfVector=normalize(uSun+toEye);
        float nv=max(dot(normal,toEye),.001),nl=max(dot(normal,uSun),0.);
        float nh=max(dot(normal,halfVector),0.),vh=max(dot(toEye,halfVector),0.);
        float variance=dot(dFdx(normal),dFdx(normal))+dot(dFdy(normal),dFdy(normal));
        float alpha=clamp(.003+variance*1.4,.003,.055);
        float a2=alpha*alpha;
        float denominator=nh*nh*(a2-1.)+1.;
        float D=a2/(3.14159265*denominator*denominator);
        float V=.5/max(nl*sqrt(nv*nv*(1.-a2)+a2)+nv*sqrt(nl*nl*(1.-a2)+a2),.0001);
        float F=.0204+.9796*pow(1.-vh,5.);
        float glint=D*V*F*nl*.14;
        // Finite-area sunlight and pixel slope variance limit unstable peaks.
        glint=glint/(1.+glint/2.);
        vec3 color=mix(water,reflection,fresnel)+uSunColor*glint*sunVisibility*(1.-uUnderwater);
        float horizon = 1.0 - exp(-max(surfaceDepth - 140.0, 0.0) * 0.004);
        color = mix(color, sky(vec3(0.0, 0.02, 1.0)), horizon * 0.35);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }

    `,
  });
  const geometry=new THREE.PlaneGeometry(20,16,NX-1,NZ-1);geometry.rotateX(-Math.PI/2);
  const mesh=new THREE.Mesh(geometry,material);mesh.name='saltwind-water';mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.renderOrder=3;scene.add(mesh);
  const caustics=createCaustics(renderer,geometry,waveGLSL,uniforms);
  let lastOpticalTime=-Infinity,disposed=false,lastCausticScan=-Infinity,skyObject=null;
  const opticalPeriod=1/60;
  const cachedCameraWorld=new THREE.Matrix4(),cachedProjection=new THREE.Matrix4();
  const drawSize=new THREE.Vector2(),targetPoint=new THREE.Vector3(),reflectedTarget=new THREE.Vector3();
  const viewport=new THREE.Vector4(),scissor=new THREE.Vector4();
  const clipPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.015),cameraClip=new THREE.Plane();
  const clipVector=new THREE.Vector4(),q=new THREE.Vector4(),cameraRotation=new THREE.Matrix4();
  const patchedMaterials=new Map();
  function attachCaustics(){
    scene.traverse(object=>{
      if(!object.isMesh||object===mesh)return;
      const materials=Array.isArray(object.material)?object.material:[object.material];
      for(const ground of materials){
        const name=`${object.name} ${ground?.name} ${ground?.map?.image?.src||''}`;
        const eligible=ground?.userData.waterCaustics||/(rock|stone|boulder|seabed|riverbed)/i.test(name);
        if(!eligible||!ground?.isMeshStandardMaterial||patchedMaterials.has(ground))continue;
        const previousCompile=ground.onBeforeCompile,previousKey=ground.customProgramCacheKey,cacheKey=previousKey.call(ground);
        const compile=function(shader,activeRenderer){
          previousCompile.call(this,shader,activeRenderer);
          shader.uniforms.uCausticMap={value:caustics.texture};shader.uniforms.uCausticSun=uniforms.uSun;
          shader.vertexShader=`varying vec3 vCausticWorld;\n${shader.vertexShader}`.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
            vec4 causticPosition=vec4(transformed,1.);
            #ifdef USE_BATCHING
              causticPosition=batchingMatrix*causticPosition;
            #endif
            #ifdef USE_INSTANCING
              causticPosition=instanceMatrix*causticPosition;
            #endif
            vCausticWorld=(modelMatrix*causticPosition).xyz;
          `);
          shader.fragmentShader='varying vec3 vCausticWorld;\nuniform sampler2D uCausticMap;\nuniform vec3 uCausticSun;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>','#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>');
          shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
            float causticDepth=max(-vCausticWorld.y,0.);
            float submerged=smoothstep(.03,.3,causticDepth)*(1.-smoothstep(.85,4.,causticDepth));
            float photons=texture2D(uCausticMap,(vCausticWorld.xz+vec2(10.,8.))/vec2(20.,16.)).r;
            vec3 groundNormal=normalize(cross(dFdx(vCausticWorld),dFdy(vCausticWorld)));
            float upFacing=max(dot(groundNormal,normalize(uCausticSun)),0.);
            // Restrained, surface-coupled concentration of actual refracted rays.
            float focus=clamp(photons-1.,-.50,3.5);
            outgoingLight+=diffuseColor.rgb*vec3(.95,1.,.91)*focus*submerged*upFacing*1.05*getShadowMask();
            #include <opaque_fragment>
          `);
        };
        ground.onBeforeCompile=compile;ground.customProgramCacheKey=()=>`${cacheKey}|surface-ray-caustics-v2`;ground.needsUpdate=true;
        patchedMaterials.set(ground,{previousCompile,previousKey,compile});
      }
    });
  }
  function disturb(x,z,strength=1){waveField.disturb(x,z,strength);}
  function stirSegment(...args){waveField.stirSegment(...args);}

  function update(dt,time){
    if(disposed)return;
    uniforms.uTime.value=Number.isFinite(time)?time:uniforms.uTime.value;
    waveField.update(dt);field.needsUpdate=true;
    caustics.update();
    uniforms.uUnderwater.value=camera.position.y<-.07?1:0;
    if(time-lastCausticScan>1||lastCausticScan===-Infinity){attachCaustics();lastCausticScan=time;}
    renderer.getDrawingBufferSize(drawSize);
    const scale=Math.min(1,1920/drawSize.x);
    const width=Math.max(1,Math.round(drawSize.x*scale)),height=Math.max(1,Math.round(drawSize.y*scale));
    const resized=transmission.width!==width||transmission.height!==height;
    if(resized) {
      transmission.setSize(width,height);reflection.setSize(width,height);
    }
    camera.updateMatrixWorld();
    const cameraChanged=!cachedCameraWorld.equals(camera.matrixWorld)||!cachedProjection.equals(camera.projectionMatrix);
    // The simulation and all surface shading run every frame. Only the two
    // expensive scene captures are reused while the camera remains still.
    const opticalElapsed=time-lastOpticalTime;
    if(!resized&&!cameraChanged&&opticalElapsed>=0&&opticalElapsed+1e-6<opticalPeriod) return;
    lastOpticalTime=time;
    cachedCameraWorld.copy(camera.matrixWorld);cachedProjection.copy(camera.projectionMatrix);
    uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);uniforms.uCameraWorld.value.copy(camera.matrixWorld);
    reflectCamera.copy(camera);
    reflectCamera.position.y=-camera.position.y;
    camera.getWorldDirection(targetPoint).add(camera.position);
    reflectedTarget.copy(targetPoint);reflectedTarget.y=-targetPoint.y;
    cameraRotation.extractRotation(camera.matrixWorld);
    reflectCamera.up.set(0,1,0).applyMatrix4(cameraRotation);reflectCamera.up.y*=-1;
    reflectCamera.lookAt(reflectedTarget);reflectCamera.updateMatrixWorld();
    reflectMatrix.multiplyMatrices(reflectCamera.projectionMatrix,reflectCamera.matrixWorldInverse);
    // Oblique clipping follows Three's Reflector: remove submerged geometry
    // from the mirror without relying on material clipping support.
    cameraClip.copy(clipPlane).applyMatrix4(reflectCamera.matrixWorldInverse);
    clipVector.set(cameraClip.normal.x,cameraClip.normal.y,cameraClip.normal.z,cameraClip.constant);
    const projection=reflectCamera.projectionMatrix.elements;
    q.set((Math.sign(clipVector.x)+projection[8])/projection[0],(Math.sign(clipVector.y)+projection[9])/projection[5],-1,(1+projection[10])/projection[14]);
    clipVector.multiplyScalar(2/clipVector.dot(q));
    projection[2]=clipVector.x;projection[6]=clipVector.y;projection[10]=clipVector.z+1-.0003;projection[14]=clipVector.w;
    uniforms.uReflectionInverse.value.copy(reflectCamera.projectionMatrix).invert();
    uniforms.uReflectionWorld.value.copy(reflectCamera.matrixWorld);
    uniforms.uNear.value=camera.near;uniforms.uFar.value=camera.far;
    const saved={target:renderer.getRenderTarget(),tone:renderer.toneMapping,auto:renderer.autoClear,clipping:renderer.clippingPlanes,shadow:renderer.shadowMap.autoUpdate,xr:renderer.xr.enabled,scissor:renderer.getScissorTest()};
    renderer.getViewport(viewport);renderer.getScissor(scissor);
    const excluded=[];
    scene.traverse(object=>{if(object.userData.excludeWaterCapture){excluded.push([object,object.visible]);object.visible=false;}});
    mesh.visible=false;
    try {
      renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;
      renderer.toneMapping=THREE.NoToneMapping;renderer.autoClear=true;renderer.setScissorTest(false);
      renderer.setRenderTarget(transmission);renderer.render(scene,camera);
      renderer.clippingPlanes=[];
      const sunDisc=skyObject?.material.uniforms.uSunDisc;
      const previousDisc=sunDisc?.value;if(sunDisc)sunDisc.value=0;
      try{renderer.setRenderTarget(reflection);renderer.render(scene,reflectCamera);}
      finally{if(sunDisc)sunDisc.value=previousDisc;}
    } finally {
      for(const [object,visible] of excluded)object.visible=visible;
      mesh.visible=true;renderer.clippingPlanes=saved.clipping;
      renderer.toneMapping=saved.tone;renderer.autoClear=saved.auto;renderer.shadowMap.autoUpdate=saved.shadow;renderer.xr.enabled=saved.xr;
      renderer.setRenderTarget(saved.target);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(saved.scissor);
    }
  }

  function terrainSample(x,z,channel){
    const gx=THREE.MathUtils.clamp((x+10)/20*NX-.5,0,NX-1),gz=THREE.MathUtils.clamp((z+8)/16*NZ-.5,0,NZ-1);
    const i=Math.floor(gx),j=Math.floor(gz),ix=Math.min(i+1,NX-1),jz=Math.min(j+1,NZ-1);
    const a=terrainPixels[(j*NX+i)*4+channel],b=terrainPixels[(j*NX+ix)*4+channel];
    const c=terrainPixels[(jz*NX+i)*4+channel],d=terrainPixels[(jz*NX+ix)*4+channel];
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,gx-i),THREE.MathUtils.lerp(c,d,gx-i),gz-j);
  }
  function setTerrain(bankHeight){
    const sample=(x,z)=>{
      const h=typeof bankHeight==='function'?bankHeight(x,z):-2;
      return Number.isFinite(h)?h:1;
    };
    const fade=(x,z)=>THREE.MathUtils.smoothstep(-sample(x,z),.015,.18);
    const e=.035;
    for(let z=0;z<NZ;z++)for(let x=0;x<NX;x++){
      const i=z*NX+x,wx=(x+.5)/NX*20-10,wz=(z+.5)/NZ*16-8;
      terrainPixels[i*4]=sample(wx,wz);terrainPixels[i*4+1]=fade(wx,wz);
      terrainPixels[i*4+2]=(fade(wx+e,wz)-fade(wx-e,wz))/(2*e);
      terrainPixels[i*4+3]=(fade(wx,wz+e)-fade(wx,wz-e))/(2*e);
    }
    terrainTexture.needsUpdate=true;lastOpticalTime=-Infinity;waveField.setTerrain(bankHeight);
  }
  return {mesh,update,disturb,stirSegment,setTerrain,
    waveField,caustics,
    heightAt(x,z){return (sampleAmbientWaves(x,z,uniforms.uTime.value,uniforms.uWaveGain.value).height+waveField.heightAt(x,z))*terrainSample(x,z,1);},
    setFlow(value){uniforms.uWaveGain.value=THREE.MathUtils.clamp(Number(value)||0,0,2)/.65;},
    setSky(sky){skyObject=sky;},
    setSun(direction,color){uniforms.uSun.value.copy(direction).normalize();if(color)uniforms.uSunColor.value.copy(color);},
    setReflectionWeight(value){uniforms.uReflectionWeight.value=THREE.MathUtils.clamp(value,0,1);},
    setObstacles(list){waveField.setObstacles(list);attachCaustics();},
    reset(){waveField.reset();field.needsUpdate=true;lastOpticalTime=-Infinity;},
    dispose(){disposed=true;scene.remove(mesh);geometry.dispose();material.dispose();field.dispose();terrainTexture.dispose();transmission.dispose();reflection.dispose();caustics.dispose();
      for(const [ground,p] of patchedMaterials)if(ground.onBeforeCompile===p.compile){ground.onBeforeCompile=p.previousCompile;ground.customProgramCacheKey=p.previousKey;ground.needsUpdate=true;}
      patchedMaterials.clear();
    },
  };
}
