const {chromium}=require('../../jelly-hop/node_modules/playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1672,height:941},deviceScaleFactor:1,acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5190',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__komorebi?.stoneThrows);
 await page.evaluate(()=>Promise.all([window.__komorebi.environment.ready,window.__komorebi.vegetation.ready]));await page.waitForTimeout(2200);
 const point=async(x,z)=>page.evaluate(({x,z})=>{const k=window.__komorebi,p=k.camera.position.clone().set(x,0,z).project(k.camera);return{x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight};},{x,z});
 const click=async(x,z)=>{const p=await point(x,z);await page.mouse.click(p.x,p.y);};
 await page.screenshot({path:path.resolve('captures/reference-pond.png')});
 await page.locator('.elements-toggle').click();await page.locator('#record-button').click();await page.locator('.elements-toggle').click();await page.keyboard.press('h');
 await page.mouse.move(1671,940);await page.waitForTimeout(1000);await page.screenshot({path:path.resolve('captures/reference-pond-still.png')});
 await page.keyboard.press('2');await click(2.3,.2);await page.mouse.move(1671,940);
 await page.waitForTimeout(350);await page.screenshot({path:path.resolve('captures/reference-pond-toss.png')});
 await page.waitForFunction(()=>window.__komorebi.stones[0]?.impacted);
 await page.waitForTimeout(160);await page.screenshot({path:path.resolve('captures/reference-pond-impact.png')});
 await page.waitForTimeout(650);await page.screenshot({path:path.resolve('captures/reference-pond-ripples.png')});
 await page.waitForTimeout(1000);
 await page.keyboard.press('1');const start=await point(-3.4,1.4);await page.mouse.move(start.x,start.y);await page.mouse.down();
 for(let i=1;i<=80;i++){const t=i/80,p=await point(-3.4+t*6.8,1.4+Math.sin(t*Math.PI*1.5)*.7);await page.mouse.move(p.x,p.y);await page.waitForTimeout(24);if(i===64)await page.screenshot({path:path.resolve('captures/reference-pond-wake.png')});}
 await page.mouse.up();await page.mouse.move(1671,940);await page.waitForTimeout(1700);
 await page.waitForTimeout(1200);
 await page.keyboard.press('5');await click(-1.8,-.7);await page.mouse.move(1671,940);await page.waitForTimeout(2800);
 await page.keyboard.press('1');await page.screenshot({path:path.resolve('captures/reference-pond-clean.png')});
 await page.keyboard.press('h');const download=page.waitForEvent('download');await page.locator('.elements-toggle').click();await page.locator('#record-button').click();await page.locator('.elements-toggle').click();await(await download).saveAs(path.resolve('captures/reference-pond-demo.webm'));
 const desktop=await page.evaluate(()=>({fps:document.querySelector('#fps').textContent,programs:window.__komorebi.renderer.info.programs.length,field:window.__komorebi.water.waveField.stats(),stoneImpacts:window.__komorebi.stones.filter(s=>s.impacted).length}));
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1300);
 for(const t of ['stir','stone','leaf','rain','feed','boat']){const box=await page.locator(`[data-tool="${t}"]`).boundingBox();assert(box.x>=0&&box.x+box.width<=390,'mobile tool fits: '+t);}
 await page.screenshot({path:path.resolve('captures/reference-pond-mobile.png')});
 assert.deepEqual(errors,[]);console.log({status:'PASS',desktop,errors});await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
