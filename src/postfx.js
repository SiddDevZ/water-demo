import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// A crisp HDR resolve with local contact shading. No fog, glow, lens blur or vignette.
export function createPostFX(renderer,scene,camera){
  const supported=renderer.extensions.has('EXT_color_buffer_float');
  const size=new THREE.Vector2(),viewport=new THREE.Vector4(),scissor=new THREE.Vector4();
  let target=null,quality='high',disposed=false;
  const material=new THREE.ShaderMaterial({
    name:'Clear courtyard output',depthTest:false,depthWrite:false,blending:THREE.NoBlending,
    uniforms:{uScene:{value:null},uDepth:{value:null},uInverseProjection:{value:new THREE.Matrix4()},uProjectionScale:{value:new THREE.Vector2()},uAO:{value:1}},
    vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`
      uniform sampler2D uScene,uDepth;
      uniform mat4 uInverseProjection;
      uniform vec2 uProjectionScale;
      uniform float uAO;
      varying vec2 vUv;
      vec3 viewPosition(vec2 uv,float d){vec4 p=uInverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}
      float contact(vec2 offset,vec3 p,vec3 n){
        vec2 uv=clamp(vUv+offset,vec2(.001),vec2(.999));
        vec3 ray=viewPosition(uv,texture2D(uDepth,uv).r)-p;
        float dist=length(ray);
        return max(dot(n,ray)/max(dist,.001)-.12,0.)*(1.-smoothstep(.056,.28,dist));
      }
      void main(){
        vec4 color=texture2D(uScene,vUv);
        float d=texture2D(uDepth,vUv).r;
        vec3 p=viewPosition(vUv,d),dx=dFdx(p),dy=dFdy(p);
        vec3 n=normalize(cross(dx,dy));if(dot(n,-p)<0.)n=-n;
        if(uAO>.5&&d<.99999&&-p.z<40.){
          vec2 stepSize=uProjectionScale*.14/max(-p.z,1.);
          float occ=contact(vec2(.92,0.)*stepSize,p,n)+contact(vec2(-.64,0.)*stepSize,p,n)
            +contact(vec2(0.,.82)*stepSize,p,n)+contact(vec2(0.,-.55)*stepSize,p,n)
            +contact(vec2(.48,.48)*stepSize,p,n)+contact(vec2(-.68,.68)*stepSize,p,n)
            +contact(vec2(.62,-.62)*stepSize,p,n)+contact(vec2(-.35,-.35)*stepSize,p,n);
          float reliable=1.-smoothstep(.098,.308,max(length(dx),length(dy)));
          color.rgb*=1.-min(.17,occ*.1)*reliable;
        }
        gl_FragColor=color;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const quad=new FullScreenQuad(material);
  function resize(){
    if(!target||disposed)return;
    renderer.getDrawingBufferSize(size);
    if(target.width!==size.x||target.height!==size.y)target.setSize(Math.max(1,size.x),Math.max(1,size.y));
  }
  function render(){
    if(disposed)return;
    if(!supported||quality==='low'||renderer.xr.isPresenting||renderer.getRenderTarget()){renderer.render(scene,camera);return;}
    if(!target){
      target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples),stencilBuffer:false});
      target.texture.colorSpace=THREE.LinearSRGBColorSpace;
      target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);target.resolveDepthBuffer=true;
      material.uniforms.uScene.value=target.texture;material.uniforms.uDepth.value=target.depthTexture;
    }
    resize();
    const auto=renderer.autoClear,xr=renderer.xr.enabled,scissorTest=renderer.getScissorTest();
    renderer.getViewport(viewport);renderer.getScissor(scissor);
    try{
      renderer.autoClear=true;renderer.xr.enabled=false;renderer.setScissorTest(false);
      renderer.setRenderTarget(target);renderer.render(scene,camera);
      material.uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
      material.uniforms.uProjectionScale.value.set(camera.projectionMatrix.elements[0],camera.projectionMatrix.elements[5]);
      renderer.setRenderTarget(null);quad.render(renderer);
    }finally{
      renderer.setRenderTarget(null);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.autoClear=auto;renderer.xr.enabled=xr;
    }
  }
  function setQuality(value){quality=value==='low'||value===0?'low':value==='balanced'?'balanced':'high';material.uniforms.uAO.value=quality==='high'?1:0;}
  function dispose(){disposed=true;target?.dispose();material.dispose();quad.dispose();}
  return{render,resize,setQuality,dispose};
}
