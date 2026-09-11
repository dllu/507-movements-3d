import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],evidence=[];
const output=name=>new URL(name,import.meta.url).pathname;
const watch=page=>{
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
};
try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}});watch(page);
  await page.goto('http://127.0.0.1:5188/demos/fluid-463/');
  await page.waitForFunction(()=>window.fluidDemo?.ready);
  await page.locator('#pause').click();
  const before=await page.evaluate(()=>fluidDemo.stats.time);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>fluidDemo.stats.time),before,'pause freezes physics');
  await page.evaluate(()=>fluidDemo.advance(2));
  await page.waitForTimeout(1200);
  await page.screenshot({path:output('demo-closed.png'),fullPage:true});
  evidence.push({case:'closed',stats:await page.evaluate(()=>fluidDemo.stats)});
  await page.locator('#gate').focus();await page.keyboard.press('End');
  assert.equal(await page.locator('#automatic').isChecked(),false);
  await page.evaluate(()=>fluidDemo.advance(3));await page.waitForTimeout(1200);
  assert.ok((await page.evaluate(()=>fluidDemo.stats.angle))>39);
  await page.screenshot({path:output('demo-open.png'),fullPage:true});
  evidence.push({case:'manual open',stats:await page.evaluate(()=>fluidDemo.stats)});
  await page.locator('#render-mode').selectOption('particles');await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>fluidDemo.stats.renderMode),'particles');
  await page.screenshot({path:output('demo-particles.png'),fullPage:true});
  await page.locator('#render-mode').selectOption('water');
  await page.locator('#side').click();await page.waitForTimeout(900);
  await page.screenshot({path:output('demo-side.png'),fullPage:true});
  const oldPosition=await page.evaluate(()=>fluidDemo.camera.position.toArray());
  const rect=await page.locator('#viewport').boundingBox();
  await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.5);await page.mouse.down();
  await page.mouse.move(rect.x+rect.width*.5+100,rect.y+rect.height*.5+35,{steps:8});await page.mouse.up();
  await page.waitForTimeout(500);
  assert.notDeepEqual(await page.evaluate(()=>fluidDemo.camera.position.toArray()),oldPosition,'orbit changes camera');
  await page.locator('#perspective').click();
  await page.locator('#reset').click();await page.locator('#pause').click();
  assert.ok((await page.evaluate(()=>fluidDemo.stats.angle))<.01,'reset closes gates');
  await page.locator('#quality').selectOption('balanced');
  await page.evaluate(()=>fluidDemo.pause());
  assert.ok((await page.evaluate(()=>fluidDemo.stats.count))>5000,'detail control creates more particles');
  await page.locator('#quality').selectOption('light');await page.evaluate(()=>fluidDemo.pause());
  await page.locator('#flood').click();
  assert.equal(await page.evaluate(()=>fluidDemo.fluid.floodUntil>fluidDemo.fluid.time),true);
  assert.equal(await page.locator('#automatic').isChecked(),true);
  await page.locator('#normal').click();
  assert.equal(await page.evaluate(()=>fluidDemo.fluid.floodUntil),0);
  await page.evaluate(()=>fluidDemo.pause(false));
  const timingStart=await page.evaluate(()=>({sim:fluidDemo.stats.time,wall:performance.now()}));
  await page.waitForTimeout(5000);
  const perf=await page.evaluate(()=>{
    const gl=document.querySelector('canvas').getContext('webgl2');const extension=gl.getExtension('WEBGL_debug_renderer_info');
    return {sim:fluidDemo.stats.time,wall:performance.now(),display:document.getElementById('performance').textContent,
      gpu:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):'unavailable'};
  });
  evidence.push({case:'performance sample',...perf,simulationSecondsPerWallSecond:(perf.sim-timingStart.sim)/((perf.wall-timingStart.wall)/1000)});
  await page.close();

  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});watch(mobile);
  await mobile.goto('http://127.0.0.1:5188/demos/fluid-463/');
  await mobile.waitForFunction(()=>window.fluidDemo?.ready);
  await mobile.evaluate(()=>{fluidDemo.pause();fluidDemo.advance(1);});
  await mobile.waitForTimeout(900);
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile has no horizontal overflow');
  await mobile.screenshot({path:output('demo-mobile.png'),fullPage:true});
  await mobile.locator('#gate').evaluate(el=>{el.value='35';el.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await mobile.locator('#automatic').isChecked(),false);
  evidence.push({case:'mobile',stats:await mobile.evaluate(()=>fluidDemo.stats),width:390});
  await mobile.close();
  assert.deepEqual(errors,[],'no page or shader errors');
  const report={status:'passed',date:new Date().toISOString(),errors,evidence,
    checks:['desktop rendering','pause','manual gate slider','particle mode','side view','orbit','reset','detail selection','flood and normal presets','mobile layout and control'],
    qualification:'Headless Chrome; the recorded GPU string and simulation/wall ratio qualify performance. Visual inspection is recorded separately.'};
  await writeFile(output('browser-verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
