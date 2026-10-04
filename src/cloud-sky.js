// Sparse raymarched cumulus inside the existing Three Sky material. Because these
// live on the scene sky itself, the water's reflection camera sees the same clouds.
// Call before PMREM generation. Optional update(dt, elapsed) adds slow cloud drift.
export function enhanceCloudSky(sky, sunPosition) {
  if (!sky?.material?.uniforms) throw new TypeError('enhanceCloudSky requires a Three Sky mesh');
  const material=sky.material;
  if(material.userData.springCloudController)return material.userData.springCloudController;
  const originalFragment=material.fragmentShader;
  material.uniforms.uSunDisc??={value:1};
  material.uniforms.uCloudTime={value:0};
  material.uniforms.uCloudAmount={value:1};
  if(sunPosition)material.uniforms.sunPosition.value.copy(sunPosition).normalize();
  material.fragmentShader=/* glsl */`
    varying vec3 vWorldPosition;
    varying vec3 vSunDirection;
    uniform float uSunDisc;
    uniform float uCloudTime;
    uniform float uCloudAmount;

    float cloudHash(vec3 p) {
      p=fract(p*.1031);
      p+=dot(p,p.yzx+33.33);
      return fract((p.x+p.y)*p.z);
    }
    float cloudNoise(vec3 p) {
      vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      float a=mix(cloudHash(i),cloudHash(i+vec3(1.,0.,0.)),f.x);
      float b=mix(cloudHash(i+vec3(0.,1.,0.)),cloudHash(i+vec3(1.,1.,0.)),f.x);
      float c=mix(cloudHash(i+vec3(0.,0.,1.)),cloudHash(i+vec3(1.,0.,1.)),f.x);
      float d=mix(cloudHash(i+vec3(0.,1.,1.)),cloudHash(i+vec3(1.,1.,1.)),f.x);
      return mix(mix(a,b,f.y),mix(c,d,f.y),f.z);
    }
    float cloudDensity(vec3 p,vec3 center,vec3 radius,float seed) {
      vec3 q=(p-center)/radius;
      float envelope=1.-dot(q,q);
      if(envelope<.015)return 0.;
      vec3 n=q*3.2+vec3(seed,seed*.37,seed*.71);
      float billow=cloudNoise(n)*.64+cloudNoise(n*2.13+8.1)*.25+cloudNoise(n*4.27-4.3)*.11;
      // A broken, fairly level base and rounded turbulent towers.
      float base=smoothstep(-.94,-.55,q.y);
      float density=max(0.,envelope*.87+billow*.81-.66)*base;
      return density*1.7;
    }
    vec2 cloudInterval(vec3 direction,vec3 center,vec3 radius) {
      vec3 o=-center/radius,d=direction/radius;
      float a=dot(d,d),b=dot(o,d),c=dot(o,o)-1.,disc=b*b-a*c;
      if(disc<=0.)return vec2(-1.);
      float root=sqrt(disc);
      return vec2(max(0.,(-b-root)/a),(-b+root)/a);
    }
    vec4 traceCloud(vec3 direction,vec3 center,vec3 radius,float seed) {
      vec2 interval=cloudInterval(direction,center,radius);
      if(interval.y<=0.)return vec4(0.);
      float stepSize=(interval.y-interval.x)/14.;
      float travel=interval.x+stepSize*.5;
      vec3 color=vec3(0.);float transmission=1.;
      vec3 sunDirection=normalize(vSunDirection);
      for(int i=0;i<14;i++){
        vec3 p=direction*travel;
        float density=cloudDensity(p,center,radius,seed);
        if(density>.006){
          float lightDensity=cloudDensity(p+sunDirection*3.7,center,radius,seed);
          float top=smoothstep(-.25,.8,(p.y-center.y)/radius.y);
          float sunlight=exp(-lightDensity*2.15);
          vec3 ambient=mix(vec3(.27,.39,.53),vec3(.43,.55,.66),top);
          vec3 lit=ambient+vec3(.94,.88,.75)*sunlight*(.61+.19*top);
          float alpha=1.-exp(-density*stepSize*.57);
          color+=transmission*alpha*lit;
          transmission*=1.-alpha;
          if(transmission<.025)break;
        }
        travel+=stepSize;
      }
      return vec4(color,1.-transmission);
    }
    void main() {
      vec3 direction=normalize(vWorldPosition-cameraPosition);
      float elevation=max(direction.y,0.);
      vec3 clearSky=mix(vec3(.12,.40,.82),vec3(.025,.16,.55),pow(elevation,.55));
      clearSky+=vec3(1.,.88,.64)*pow(max(dot(direction,normalize(vSunDirection)),0.),16384.)*uSunDisc*3.;
      vec3 cloudColor=vec3(0.);float transmission=1.;
      // Most sky pixels exit here or fail the inexpensive ellipsoid intersection.
      // No low-altitude haze layer, cards, or all-over white cloud coverage.
      if(direction.y>.016&&direction.z<-.23&&uCloudAmount>.001){
        float drift=sin(uCloudTime*.003)*1.6;
        // Two small, high cumulus banks sit inside the pond's reflected sky.
        // They use the same bounded volume integration as the distant clouds.
        vec4 overheadLeft=traceCloud(direction,vec3(-30.+drift*.5,110.,-62.),vec3(20.,9.,18.),31.8);
        cloudColor+=overheadLeft.rgb;transmission*=1.-overheadLeft.a;
        vec4 overheadRight=traceCloud(direction,vec3(45.+drift*.4,100.,-70.),vec3(20.,9.,18.),47.2);
        cloudColor+=transmission*overheadRight.rgb;transmission*=1.-overheadRight.a;
        vec4 a=traceCloud(direction,vec3(-5.+drift,44.,-115.),vec3(20.,10.5,14.),3.7);
        cloudColor+=transmission*a.rgb;transmission*=1.-a.a;
        vec4 b=traceCloud(direction,vec3(-35.+drift*.65,18.,-165.),vec3(24.,7.8,12.5),11.2);
        cloudColor+=transmission*b.rgb;transmission*=1.-b.a;
        vec4 c=traceCloud(direction,vec3(29.+drift*.8,24.,-190.),vec3(31.,10.5,15.),23.4);
        cloudColor+=transmission*c.rgb;transmission*=1.-c.a;
      }
      vec3 result=clearSky*transmission+cloudColor;
      result=mix(clearSky,result,clamp(uCloudAmount,0.,1.));
      gl_FragColor=vec4(result,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;
  material.needsUpdate=true;
  const controller={
    update(dt,elapsed){material.uniforms.uCloudTime.value=elapsed??material.uniforms.uCloudTime.value+(dt||0);},
    setSun(position){material.uniforms.sunPosition.value.copy(position).normalize();},
    setAmount(value){material.uniforms.uCloudAmount.value=Math.max(0,Math.min(1,Number(value)||0));},
    dispose(){material.fragmentShader=originalFragment;delete material.uniforms.uCloudTime;delete material.uniforms.uCloudAmount;delete material.userData.springCloudController;material.needsUpdate=true;}
  };
  material.userData.springCloudController=controller;
  return controller;
}
