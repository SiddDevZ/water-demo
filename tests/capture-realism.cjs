const {chromium}=require('../../jelly-hop/node_modules/playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
  const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1,acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5190',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__komorebi?.life);await page.evaluate(()=>window.__komorebi.environment.ready);await page.waitForTimeout(5500);
  const point=async(x,z)=>page.evaluate(({x,z})=>{const k=window.__komorebi,p=k.camera.position.clone().set(x,0,z).project(k.camera);return{x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight};},{x,z});
  const click=async(x,z)=>{const p=await point(x,z);await page.mouse.click(p.x,p.y);};
  await page.locator('.elements-toggle').click();await page.locator('#record-button').click();await page.locator('.elements-toggle').click();await page.keyboard.press('h');await page.mouse.move(1598,899);await page.waitForTimeout(2000);
  await page.keyboard.press('5');await click(-.5,-.6);await page.mouse.move(1598,899);await page.waitForTimeout(5000);
  await page.keyboard.press('1');const start=await point(-3.1,2.8);await page.mouse.move(start.x,start.y);await page.mouse.down();
  for(let i=0;i<48;i++){const t=i/47,p=await point(-3.1+t*5.2,2.8+Math.sin(t*Math.PI*2)*.6);await page.mouse.move(p.x,p.y);await page.waitForTimeout(16);}
  await page.mouse.up();await page.mouse.move(1598,899);await page.waitForTimeout(1500);
  await page.keyboard.press('2');await click(-2,-.6);await page.mouse.move(1598,899);await page.waitForTimeout(2400);
  await page.keyboard.press('6');await click(2.2,-1.8);await page.mouse.move(1598,899);await page.waitForTimeout(2500);
  await page.keyboard.press('1');await page.screenshot({path:path.resolve('captures/realism-clean.png')});
  await page.keyboard.press('h');const download=page.waitForEvent('download');await page.locator('.elements-toggle').click();await page.locator('#record-button').click();await page.locator('.elements-toggle').click();await(await download).saveAs(path.resolve('captures/realism-garden.webm'));
  await page.waitForTimeout(3200);await page.screenshot({path:path.resolve('captures/realism-garden.png')});
  const desktop=await page.evaluate(()=>({fps:document.querySelector('#fps').textContent,programs:window.__komorebi.renderer.info.programs.length,boats:window.__komorebi.paperBoats.boats.length,fish:window.__komorebi.life.getState().fish.length}));
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1600);
  for(const t of ['stir','stone','leaf','rain','feed','boat']){const box=await page.locator(`[data-tool="${t}"]`).boundingBox();assert(box.x>=0&&box.x+box.width<=390,'mobile tool fits: '+t);}
  await page.screenshot({path:path.resolve('captures/realism-mobile.png')});
  assert.deepEqual(errors,[]);console.log({status:'PASS',desktop,errors});await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
