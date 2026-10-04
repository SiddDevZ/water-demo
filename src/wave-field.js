// Narrowband finite-depth gravity waves on a staggered finite-volume grid.
// Effective depth tanh(k*d)/k matches phase speed at wavelength 1.8m.
// This approximates one interaction band, not full wavelength dispersion.
// Height is cell centered; horizontal velocities live on cell faces. Updating
// height only from shared face fluxes conserves volume across reflective shores.
export function createWaveField({width=20,depth=16,nx=192,nz=154,terrain=null}={}) {
  if(!(width>0&&depth>0&&Number.isInteger(nx)&&Number.isInteger(nz)&&nx>=8&&nz>=8))throw new Error('Invalid wave-field dimensions');
  const count=nx*nz,dx=width/nx,dz=depth/nz,area=dx*dz,g=9.81,fixedStep=1/120;
  const dominantWavelength=1.8,wavenumber=2*Math.PI/dominantWavelength;
  const heights=new Float32Array(count),texturePixelsRGBA=new Float32Array(count*4);
  const bed=new Float32Array(count),waterDepth=new Float32Array(count),effectiveDepth=new Float32Array(count),wet=new Uint8Array(count);
  const ux=new Float32Array((nx+1)*nz),uz=new Float32Array(nx*(nz+1));
  const faceDepthX=new Float32Array(ux.length),faceDepthZ=new Float32Array(uz.length);
  const dampingX=new Float32Array(ux.length),dampingZ=new Float32Array(uz.length);
  let reboundSources=[];
  let terrainFn=terrain,obstacles=[],accumulator=0,elapsed=0,stepCount=0,substeps=1,step=fixedStep;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const gridX=x=>(x+width/2)/dx-.5,gridZ=z=>(z+depth/2)/dz-.5;
  const harmonic=(a,b)=>a>0&&b>0?2*a*b/(a+b):0;
  function faceDamping(x,z){
    const distance=Math.min(x,nx-x,z,nz-z);
    const edge=Math.max(0,1-distance/10);
    return Math.exp(-(.20+18*edge*edge)*step);
  }
  function rebuild(){
    reboundSources=[];
    let deepest=0;
    for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
      const i=z*nx+x,wx=(x+.5)*dx-width/2,wz=(z+.5)*dz-depth/2;
      const h=terrainFn?terrainFn(wx,wz):-1.2;
      bed[i]=Number.isFinite(h)?h:1;
      let blocked=bed[i]>=-.018;
      for(const o of obstacles)if((wx-o.x)**2+(wz-o.z)**2<o.radius*o.radius){blocked=true;break;}
      wet[i]=blocked?0:1;waterDepth[i]=blocked?0:-bed[i];effectiveDepth[i]=Math.tanh(wavenumber*waterDepth[i])/wavenumber;deepest=Math.max(deepest,effectiveDepth[i]);
      if(blocked)heights[i]=0;
    }
    // CFL < .72 for the deepest cell. The public simulation clock always runs
    // at 120 Hz; finer custom grids transparently subdivide that fixed tick.
    substeps=Math.max(1,Math.ceil(Math.sqrt(g*deepest)*fixedStep*Math.hypot(1/dx,1/dz)/.72));
    step=fixedStep/substeps;
    faceDepthX.fill(0);faceDepthZ.fill(0);
    for(let z=0;z<nz;z++)for(let x=1;x<nx;x++){
      const i=z*(nx+1)+x;
      faceDepthX[i]=harmonic(effectiveDepth[z*nx+x-1],effectiveDepth[z*nx+x]);
      dampingX[i]=faceDamping(x,z+.5);
    }
    for(let z=1;z<nz;z++)for(let x=0;x<nx;x++){
      const i=z*nx+x;
      faceDepthZ[i]=harmonic(effectiveDepth[(z-1)*nx+x],effectiveDepth[z*nx+x]);
      dampingZ[i]=faceDamping(x+.5,z);
    }
    for(let i=0;i<ux.length;i++)if(!faceDepthX[i])ux[i]=0;
    for(let i=0;i<uz.length;i++)if(!faceDepthZ[i])uz[i]=0;
    fillTexture();
  }
  function advance(){
    // One stone excavates a cavity; a short damped rebound drives its trailing
    // wave train. This is localized forcing, never prescribed travelling rings.
    // Each spatial profile sums to zero, so the source cannot add water volume.
    for(const source of reboundSources){
      source.age+=step;
      const t=Math.min(source.age,1.2),window=(1-(t/1.2)**4)**2;
      const value=1.05*Math.exp(-1.8*t)*Math.sin(2*Math.PI*t/.30)*window;
      const delta=value-source.previous;source.previous=value;
      for(const [i,profile] of source.cells)if(wet[i])heights[i]+=profile*delta;
    }
    reboundSources=reboundSources.filter(source=>source.age<1.2-1e-12);

    const gx=g*step/dx,gz=g*step/dz;
    for(let z=0;z<nz;z++)for(let x=1;x<nx;x++){
      const i=z*(nx+1)+x,d=faceDepthX[i];if(!d)continue;
      const left=heights[z*nx+x-1],right=heights[z*nx+x];
      const steep=Math.max(0,Math.max(Math.abs(left),Math.abs(right))/d-.18);
      ux[i]=(ux[i]-gx*(right-left))*dampingX[i]/(1+steep*step*16);
    }
    for(let z=1;z<nz;z++)for(let x=0;x<nx;x++){
      const i=z*nx+x,d=faceDepthZ[i];if(!d)continue;
      const back=heights[(z-1)*nx+x],front=heights[z*nx+x];
      const steep=Math.max(0,Math.max(Math.abs(back),Math.abs(front))/d-.18);
      uz[i]=(uz[i]-gz*(front-back))*dampingZ[i]/(1+steep*step*16);
    }
    for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
      const i=z*nx+x;if(!wet[i])continue;
      const l=z*(nx+1)+x,r=l+1,b=z*nx+x,f=b+nx;
      const fluxX=(faceDepthX[r]*ux[r]-faceDepthX[l]*ux[l])/dx;
      const fluxZ=(faceDepthZ[f]*uz[f]-faceDepthZ[b]*uz[b])/dz;
      heights[i]-=step*(fluxX+fluxZ);
    }
  }
  function update(dt){
    if(!Number.isFinite(dt)||dt<=0){fillTexture();return;}
    accumulator+=dt;
    while(accumulator+1e-12>=fixedStep){
      for(let k=0;k<substeps;k++)advance();
      accumulator=Math.max(0,accumulator-fixedStep);elapsed+=fixedStep;stepCount++;
    }
    fillTexture();
  }
  function bounds(cx,cz,radius){return [Math.max(0,Math.floor(gridX(cx-radius))),Math.min(nx-1,Math.ceil(gridX(cx+radius))),Math.max(0,Math.floor(gridZ(cz-radius))),Math.min(nz-1,Math.ceil(gridZ(cz+radius)))];}
  function isWet(x,z){
    const ix=Math.round(gridX(x)),iz=Math.round(gridZ(z));
    return ix>=0&&ix<nx&&iz>=0&&iz<nz&&wet[iz*nx+ix];
  }
  function disturb(x,z,strength=1){
    if(![x,z,strength].every(Number.isFinite)||strength<=0||!isWet(x,z))return;
    const sigma=.14,radius=1.3,[x0,x1,z0,z1]=bounds(x,z,radius);
    const cells=[];let innerSum=0,outerSum=0;
    for(let iz=z0;iz<=z1;iz++)for(let ix=x0;ix<=x1;ix++){
      const i=iz*nx+ix;if(!wet[i])continue;
      const r2=((ix+.5)*dx-width/2-x)**2+((iz+.5)*dz-depth/2-z)**2;
      const inner=Math.exp(-r2/(2*sigma*sigma)),outer=Math.exp(-r2/(8*sigma*sigma));
      cells.push([i,inner,outer]);innerSum+=inner;outerSum+=outer;
    }
    if(outerSum<1e-8)return;
    const balance=innerSum/outerSum,amplitude=.082*Math.min(clamp(strength,0,2),1.5);
    // Balance against only wet cells, including truncated footprints near rocks.
    // One depression with displaced shoulders then evolves freely; no timed rings.
    let scale=1;
    for(const [i,inner,outer] of cells){
      const change=amplitude*(-inner+balance*outer),limit=Math.min(.28,waterDepth[i]*.4);
      if(change>0)scale=Math.min(scale,Math.max(0,(limit-heights[i])/change));
      else if(change<0)scale=Math.min(scale,Math.max(0,(-limit-heights[i])/change));
    }
    const profile=cells.map(([i,inner,outer])=>[i,amplitude*(-inner+balance*outer)*scale]);
    for(const [i,value] of profile)heights[i]+=value;
    if(strength>=.15&&scale>0){
      reboundSources.push({cells:profile,age:0,previous:0});
      // Ignore tiny secondary droplets; a bounded list keeps rain/rapid clicking cheap.
      if(reboundSources.length>24)reboundSources.shift();
    }
  }
  function stirSegment(x0,z0,x1,z1,strength=1,dt=1/60){
    if(![x0,z0,x1,z1,strength,dt].every(Number.isFinite)||strength<=0)return;
    const vx=x1-x0,vz=z1-z0,length=Math.hypot(vx,vz);if(length<.003)return;
    const tx=vx/length,tz=vz/length,px=-tz,pz=tx;
    const speed=length/Math.max(dt,.001),gain=clamp(strength,0,2)*clamp(Math.sqrt(speed/2),.5,1.6);
    const samples=Math.max(1,Math.ceil(length/.09)),ds=length/samples,alongWidth=.28,acrossWidth=.32,radius=1.7;
    for(let sample=0;sample<samples;sample++){
      const t=(sample+.5)/samples,cx=x0+vx*t,cz=z0+vz*t;
      if(cx<-width/2-radius||cx>width/2+radius||cz<-depth/2-radius||cz>depth/2+radius)continue;
      const [bx0,bx1,bz0,bz1]=bounds(cx,cz,radius),impulse=1.48*gain*ds;
      // Momentum follows the finger, with a smaller sideways displacement.
      // Divergence creates the bow crest, rear depression and continuous wake.
      // A weak outer counterflow closes the transverse circulation and adds a
      // smooth trailing crest. The odd profile has zero net lateral momentum.
      for(let z=bz0;z<=bz1;z++)for(let x=Math.max(1,bx0);x<=Math.min(nx-1,bx1+1);x++){
        const i=z*(nx+1)+x;if(!faceDepthX[i])continue;
        // Saturate forcing on already steep waves; do not clamp height/volume.
        const sourceDamping=1/(1+(Math.max(Math.abs(heights[z*nx+x-1]),Math.abs(heights[z*nx+x]))/.08)**4);
        const ox=x*dx-width/2-cx,oz=(z+.5)*dz-depth/2-cz;
        const along=(ox*tx+oz*tz)/alongWidth,across=(ox*px+oz*pz)/acrossWidth;
        const envelope=Math.exp(-.5*(along*along+across*across));
        ux[i]=clamp(ux[i]+sourceDamping*impulse*envelope*(tx*.85+px*across*.40*(1-.30*across*across)),-1.4,1.4);
      }
      for(let z=Math.max(1,bz0);z<=Math.min(nz-1,bz1+1);z++)for(let x=bx0;x<=bx1;x++){
        const i=z*nx+x;if(!faceDepthZ[i])continue;
        const sourceDamping=1/(1+(Math.max(Math.abs(heights[(z-1)*nx+x]),Math.abs(heights[z*nx+x]))/.08)**4);
        const ox=(x+.5)*dx-width/2-cx,oz=z*dz-depth/2-cz;
        const along=(ox*tx+oz*tz)/alongWidth,across=(ox*px+oz*pz)/acrossWidth;
        const envelope=Math.exp(-.5*(along*along+across*across));
        uz[i]=clamp(uz[i]+sourceDamping*impulse*envelope*(tz*.85+pz*across*.40*(1-.30*across*across)),-1.4,1.4);
      }
    }
  }
  function heightAt(x,z){
    if(!Number.isFinite(x+z))return 0;
    const gx=clamp(gridX(x),0,nx-1),gz=clamp(gridZ(z),0,nz-1),ix=Math.floor(gx),iz=Math.floor(gz),ix1=Math.min(ix+1,nx-1),iz1=Math.min(iz+1,nz-1),fx=gx-ix,fz=gz-iz;
    const a=heights[iz*nx+ix]*(1-fx)+heights[iz*nx+ix1]*fx,b=heights[iz1*nx+ix]*(1-fx)+heights[iz1*nx+ix1]*fx;
    return a*(1-fz)+b*fz;
  }
  function motionAt(x,z){
    if(!Number.isFinite(x+z)||!isWet(x,z))return {vx:0,vz:0,height:0};
    const sample=(values,sx,sz,columns,rows)=>{
      sx=clamp(sx,0,columns-1);sz=clamp(sz,0,rows-1);
      const ix=Math.floor(sx),iz=Math.floor(sz),jx=Math.min(ix+1,columns-1),jz=Math.min(iz+1,rows-1),fx=sx-ix,fz=sz-iz;
      return (values[iz*columns+ix]*(1-fx)+values[iz*columns+jx]*fx)*(1-fz)+(values[jz*columns+ix]*(1-fx)+values[jz*columns+jx]*fx)*fz;
    };
    return {vx:sample(ux,(x+width/2)/dx,gridZ(z),nx+1,nz),vz:sample(uz,gridX(x),(z+depth/2)/dz,nx,nz+1),height:heightAt(x,z)};
  }
  function fillTexture(output=texturePixelsRGBA){
    if(output.length<count*4)throw new Error('Wave texture buffer too small');
    for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
      const i=z*nx+x,h=heights[i];output[i*4]=h;
      // Reflective ghost samples equal the wet cell itself. A dry neighbor is
      // not a zero-height trough: using zero would invent a shoreline cliff.
      const left=x>0&&wet[i-1]?heights[i-1]:h,right=x<nx-1&&wet[i+1]?heights[i+1]:h;
      const back=z>0&&wet[i-nx]?heights[i-nx]:h,front=z<nz-1&&wet[i+nx]?heights[i+nx]:h;
      output[i*4+1]=wet[i]?(right-left)/(2*dx):0;
      output[i*4+2]=wet[i]?(front-back)/(2*dz):0;output[i*4+3]=1;
    }
    return output;
  }
  function reset(){reboundSources=[];heights.fill(0);ux.fill(0);uz.fill(0);accumulator=0;elapsed=0;stepCount=0;fillTexture();}
  function stats(){
    let mass=0,potential=0,kinetic=0,maxHeight=0,minHeight=0,maxVelocity=0,wetCells=0;
    for(let i=0;i<count;i++){mass+=heights[i]*area;potential+=.5*g*heights[i]**2*area;maxHeight=Math.max(maxHeight,heights[i]);minHeight=Math.min(minHeight,heights[i]);wetCells+=wet[i];}
    for(let i=0;i<ux.length;i++){kinetic+=.5*faceDepthX[i]*ux[i]**2*area;maxVelocity=Math.max(maxVelocity,Math.abs(ux[i]));}
    for(let i=0;i<uz.length;i++){kinetic+=.5*faceDepthZ[i]*uz[i]**2*area;maxVelocity=Math.max(maxVelocity,Math.abs(uz[i]));}
    return {mass,energy:potential+kinetic,maxHeight,minHeight,maxAbsHeight:Math.max(maxHeight,-minHeight),maxVelocity,wetCells,elapsed,stepCount,fixedStep,substeps,accumulator,dominantWavelength,activeImpacts:reboundSources.length};
  }
  rebuild();
  return {heights,texturePixelsRGBA,update,disturb,stirSegment,heightAt,motionAt,fillTexture,reset,stats,
    setTerrain(fn){terrainFn=typeof fn==='function'?fn:null;rebuild();},
    setObstacles(list){obstacles=(list||[]).filter(o=>Number.isFinite(o.x+o.z+o.radius)&&o.radius>0);rebuild();},
  };
}
