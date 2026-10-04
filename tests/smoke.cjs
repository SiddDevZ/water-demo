const {chromium}=require('../../jelly-hop/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome',args:['--enable-webgl','--ignore-gpu-blocklist']});const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});await page.goto('http://127.0.0.1:5190',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__komorebi);await page.waitForTimeout(3000);
// Project real basin coordinates so the test remains valid when camera framing
// changes. Mouse input still follows the normal canvas event/raycast path.
async function waterPoint(x,z){
  const point=await page.evaluate(({x,z})=>{
    const {camera,renderer,environment}=window.__komorebi;
    if(environment.bankHeight(x,z)>=-.06)throw new Error('Smoke point must be inside wet basin');
    camera.updateMatrixWorld();
    const p=camera.position.clone().set(x,0,z).project(camera);
    const r=renderer.domElement.getBoundingClientRect();
    return {x:r.left+(p.x*.5+.5)*r.width,y:r.top+(-p.y*.5+.5)*r.height,visible:Math.abs(p.x)<1&&Math.abs(p.y)<1};
  },{x,z});
  assert(point.visible,'interaction point must be visible');
  return point;
}
async function clickWater(x=0,z=1){const p=await waterPoint(x,z);await page.mouse.click(p.x,p.y);}

await page.evaluate(()=>{
  const w=window.__komorebi.water;
  window.__stirAudit={strokes:0,drops:0,active:false};
  const originalStir=w.stirSegment,originalDrop=w.disturb;
  w.stirSegment=(...args)=>{
    // The inlet calls the same API near z=-6.88 every frame. Only audit the
    // pointer stroke in the open middle of the basin, never automatic forcing.
    if(window.__stirAudit.active&&args[1]>-4&&args[3]>-4)window.__stirAudit.strokes++;
    return originalStir(...args);
  };
  w.disturb=(...args)=>{if(window.__stirAudit.active&&args[1]>-4)window.__stirAudit.drops++;return originalDrop(...args);};
  window.__restoreStirAudit=()=>{w.stirSegment=originalStir;w.disturb=originalDrop;};
});
const strokeStart=await waterPoint(-2,1),strokeEnd=await waterPoint(2,1);
await page.mouse.move(strokeStart.x,strokeStart.y);
await page.evaluate(()=>window.__stirAudit.active=true);
await page.mouse.down();await page.mouse.move(strokeEnd.x,strokeEnd.y,{steps:20});await page.mouse.up();
const stirAudit=await page.evaluate(()=>{window.__stirAudit.active=false;window.__restoreStirAudit();return window.__stirAudit;});
assert(stirAudit.strokes>0,'pointer drag, excluding automatic inlet, makes directional wake segments');
assert.equal(stirAudit.drops,0,'drag never emits point-drop impulses');
const wave=await page.evaluate(()=>{
 const w=window.__komorebi.water;w.reset();w.setFlow(0);
 const field=w.waveField,reset=field.stats();w.disturb(0,0,1);
 const injected=field.stats(),initial=field.heightAt(0,0);
 for(let i=0;i<54;i++)field.update(1/120);
 const propagated=field.stats(),center=field.heightAt(0,0),remote=field.heightAt(8,6);
 field.update(1.2);const freelyTravelling=field.stats();
 w.reset();const cleared=field.stats();w.setFlow(.65);
 return {reset,injected,initial,propagated,center,remote,freelyTravelling,cleared};
});
assert.equal(wave.reset.energy,0,'reset clears field energy');
assert(wave.injected.energy>0,'one impact injects field energy');
assert(Math.abs(wave.injected.mass)<1e-5,'impact balances displaced water');
assert(wave.propagated.stepCount>=54,'actual dt advances the solver');
assert(Number.isFinite(wave.center)&&Math.abs(wave.center-wave.initial)>.001,'initial cavity rebounds while its waves propagate');
assert(wave.propagated.energy>0&&wave.propagated.energy<wave.injected.energy*8,'finite cavity source keeps field energy bounded');
assert(Math.abs(wave.propagated.mass)<1e-4,'shared face fluxes conserve water volume');
assert.equal(wave.freelyTravelling.activeImpacts,0,'localized source ends');
assert(wave.freelyTravelling.energy<wave.propagated.energy,'waves lose energy after source ends');
assert(Math.abs(wave.remote)<.001,'wave remains localized after 450ms');
assert.equal(wave.cleared.energy,0,'reset removes both height and velocity');
assert.equal(wave.cleared.maxAbsHeight,0);
await page.keyboard.press('3');const leaves=await page.evaluate(()=>window.__komorebi.debris.length);await clickWater();assert.equal(await page.evaluate(()=>window.__komorebi.debris.length),leaves+1);
await page.keyboard.press('5');await clickWater();assert.equal(await page.evaluate(()=>window.__komorebi.life.getState().feeding),true);assert((await page.evaluate(()=>window.__komorebi.life.getState().foodRemaining))>0);
const feedingStart=await page.evaluate(()=>{const s=window.__komorebi.life.getState();return {target:s.target,distance:s.fish.reduce((a,p)=>a+Math.hypot(p.x-s.target.x,p.z-s.target.z),0)/s.fish.length};});await page.waitForTimeout(6500);const afterFeed=await page.evaluate(target=>{const s=window.__komorebi.life.getState();return s.fish.reduce((a,p)=>a+Math.hypot(p.x-target.x,p.z-target.z),0)/s.fish.length;},feedingStart.target);assert(afterFeed<feedingStart.distance,'koi approach the food');
await page.keyboard.press('6');const boats=await page.evaluate(()=>window.__komorebi.paperBoats.boats.length);await clickWater();assert.equal(await page.evaluate(()=>window.__komorebi.paperBoats.boats.length),boats+1);
await page.keyboard.press('2');
const stoneStart=await waterPoint(0,1),stoneMove=await waterPoint(1,1),stoneCount=await page.evaluate(()=>window.__komorebi.stones.length);
await page.mouse.move(stoneStart.x,stoneStart.y);await page.mouse.down();
await page.mouse.move(stoneMove.x,stoneMove.y,{steps:20});await page.waitForTimeout(1400);
assert.equal(await page.evaluate(()=>window.__komorebi.stones.length),stoneCount+1,'held/moved pointer throws only one stone');
const impacts=await page.evaluate(()=>window.__komorebi.stones.filter(s=>s.impacted).length);
assert(impacts>=1,'thrown stone reaches the water');
await page.mouse.up();await clickWater(-1,1);
assert.equal(await page.evaluate(()=>window.__komorebi.stones.length),stoneCount+2,'new press throws exactly one additional stone');
await page.keyboard.press('4');assert.equal(await page.locator('[data-tool="rain"]').getAttribute('aria-pressed'),'true');await page.keyboard.press('1');
await page.keyboard.press('h');assert.equal(await page.locator('#ui').evaluate(el=>el.style.opacity),'0');await page.keyboard.press('h');assert.equal(await page.locator('#ui').evaluate(el=>el.style.opacity),'1');
await page.locator('.elements-toggle').click();await page.locator('#flow').fill('0.8');await page.locator('#flow').dispatchEvent('input');assert.equal(await page.locator('#flow-output').textContent(),'80%');await page.locator('.reset-button').click();assert.equal(await page.evaluate(()=>window.__komorebi.debris.length),0);assert.equal(await page.evaluate(()=>window.__komorebi.paperBoats.boats.length),0);assert.equal(await page.evaluate(()=>window.__komorebi.life.getState().feeding),false);
await page.locator('#record-button').click();await page.waitForTimeout(1100);const downloadPromise=page.waitForEvent('download');await page.locator('#record-button').click();const download=await downloadPromise;assert(download.suggestedFilename().startsWith('komorebi-water-'));await download.saveAs('/tmp/komorebi-test.webm');
await page.screenshot({path:'/tmp/water-final.png'});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);assert(await page.locator('[data-tool="leaf"]').isVisible());await page.screenshot({path:'/tmp/water-mobile.png'});assert.deepEqual(errors,[]);console.log('PASS: render, wave impulse, continuous stir without point drops, leaf, stone, rain, feeding convergence, paper boats, shortcuts, cinematic, controls, reset, video download, mobile.');await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
