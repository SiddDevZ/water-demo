import * as THREE from 'three';

// Refract a grid of sun rays through this frame's surface. The ratio of source
// triangle area to its projected bed area is photon density, rather than a
// painted white network. A small filter removes triangle-scale aliasing.
export function createCaustics(renderer,geometry,waveGLSL,waterUniforms){
  const width=1024,height=820;
  const rayGeometry=new THREE.PlaneGeometry(20,16,384,308);rayGeometry.rotateX(-Math.PI/2);
  const options={type:THREE.HalfFloatType,depthBuffer:false};
  const raw=new THREE.WebGLRenderTarget(width,height,options);
  const filtered=new THREE.WebGLRenderTarget(width,height,options);
  const camera=new THREE.Camera(),rays=new THREE.Scene(),filterScene=new THREE.Scene();
  const rayMaterial=new THREE.ShaderMaterial({
    uniforms:waterUniforms,side:THREE.DoubleSide,transparent:true,
    blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false,
    vertexShader:`${waveGLSL}
      uniform vec3 uSun;
      varying vec2 vSource,vTarget;
      varying float vWet;
      void main(){
        vec2 p=position.xz;
        vec3 surface=waves(p,0.);
        vec3 n=normalize(vec3(-surface.y,1.,-surface.z));
        vec3 ray=refract(-normalize(uSun),n,1./1.333);
        float bed=texture2D(uTerrain,(p+vec2(10.,8.))/vec2(20.,16.)).r;
        vec2 destination=p;
        for(int i=0;i<2;i++){
          float t=max((bed-surface.x)/min(ray.y,-.1),0.);
          destination=p+ray.xz*t;
          bed=texture2D(uTerrain,(destination+vec2(10.,8.))/vec2(20.,16.)).r;
        }
        vSource=p;vTarget=destination;vWet=1.-step(-.015,bed);
        gl_Position=vec4(destination/vec2(10.,8.),0.,1.);
      }`,
    fragmentShader:`
      varying vec2 vSource,vTarget;
      varying float vWet;
      float area(vec2 a,vec2 b){return abs(a.x*b.y-a.y*b.x);}
      void main(){
        if(vWet<.5)discard;
        float source=area(dFdx(vSource),dFdy(vSource));
        float projected=area(dFdx(vTarget),dFdy(vTarget));
        float density=clamp(source/max(projected,1.e-7),0.,8.);
        gl_FragColor=vec4(vec3(density),1.);
      }`
  });
  const rayMesh=new THREE.Mesh(rayGeometry,rayMaterial);rayMesh.frustumCulled=false;rays.add(rayMesh);
  const quadGeometry=new THREE.PlaneGeometry(2,2);
  const filterMaterial=new THREE.ShaderMaterial({
    uniforms:{uMap:{value:raw.texture},uTexel:{value:new THREE.Vector2(1/width,1/height)}},
    depthTest:false,depthWrite:false,
    vertexShader:'varying vec2 vUV;void main(){vUV=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`
      uniform sampler2D uMap;uniform vec2 uTexel;varying vec2 vUV;
      void main(){
        float light=texture2D(uMap,vUV).r*4.;
        light+=(texture2D(uMap,vUV+uTexel*vec2(1.,0.)).r+texture2D(uMap,vUV+uTexel*vec2(-1.,0.)).r
              +texture2D(uMap,vUV+uTexel*vec2(0.,1.)).r+texture2D(uMap,vUV+uTexel*vec2(0.,-1.)).r)*2.;
        light+=texture2D(uMap,vUV+uTexel).r+texture2D(uMap,vUV-uTexel).r
              +texture2D(uMap,vUV+uTexel*vec2(-1.,1.)).r+texture2D(uMap,vUV+uTexel*vec2(1.,-1.)).r;
        gl_FragColor=vec4(vec3(light/16.),1.);
      }`
  });
  const quad=new THREE.Mesh(quadGeometry,filterMaterial);quad.frustumCulled=false;filterScene.add(quad);
  const viewport=new THREE.Vector4(),scissor=new THREE.Vector4(),clearColor=new THREE.Color();
  function update(){
    const target=renderer.getRenderTarget(),auto=renderer.autoClear,tone=renderer.toneMapping;
    const test=renderer.getScissorTest(),alpha=renderer.getClearAlpha(),xr=renderer.xr.enabled;
    renderer.getViewport(viewport);renderer.getScissor(scissor);renderer.getClearColor(clearColor);
    try{
      renderer.xr.enabled=false;renderer.autoClear=true;renderer.toneMapping=THREE.NoToneMapping;
      renderer.setScissorTest(false);renderer.setClearColor(0,0);
      renderer.setRenderTarget(raw);renderer.render(rays,camera);
      renderer.setRenderTarget(filtered);renderer.render(filterScene,camera);
    }finally{
      renderer.setRenderTarget(target);renderer.setViewport(viewport);renderer.setScissor(scissor);
      renderer.setScissorTest(test);renderer.setClearColor(clearColor,alpha);
      renderer.autoClear=auto;renderer.toneMapping=tone;renderer.xr.enabled=xr;
    }
  }
  return {texture:filtered.texture,raw,filtered,update,
    dispose(){raw.dispose();filtered.dispose();rayMaterial.dispose();filterMaterial.dispose();quadGeometry.dispose();rayGeometry.dispose();}};
}
