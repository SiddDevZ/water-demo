// The lip is drawn by environment.js. Feed its impact into the continuous field,
// leaving the eight user-driven analytic impact rings free for stones and rain.
export function createInlet(water){
 let accumulated=0;
 return {update(dt,time){
  if(!water.stirSegment)return;
  accumulated+=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.05));
  const step=1/12;
  while(accumulated>=step){
   accumulated-=step;
   const t=time-accumulated,z=-6.05+Math.sin(t*.73)*.022;
   // Alternate sweep direction to prevent a persistent sideways dipole.
   const reverse=Math.floor(t/step)%2===0;
   water.stirSegment(reverse?1.35:-1.0,z,reverse?-1.0:1.35,z,.065+Math.sin(t*1.17)*.009,step);
  }
 }};
}
