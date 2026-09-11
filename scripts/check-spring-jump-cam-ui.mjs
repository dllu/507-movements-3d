import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { visibleForegroundBounds, hasFrameMargin } from '../tests/helpers/rendered-frame.mjs';

const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const checks={},framing={};
try{
  await page.goto('http://127.0.0.1:5174/#/movement/064');
  const canvas=page.locator('canvas');await canvas.waitFor({state:'visible'});
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const paused=await canvas.screenshot();await page.waitForTimeout(160);
  checks.pauseStable=(await canvas.screenshot()).equals(paused);
  await page.getByRole('button',{name:'Play',exact:true}).click();
  for(let i=0;i<20;i++){
    await page.waitForTimeout(150);
    if(!(await canvas.screenshot()).equals(paused)){checks.playChangesFrame=true;break;}
  }
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  framing.desktop=await visibleForegroundBounds(canvas);checks.desktopFramed=hasFrameMargin(framing.desktop);
  await page.screenshot({path:'artifacts/review/064-desktop-controls.png',fullPage:true});
  const beforeOrbit=await canvas.screenshot(),box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width*.65,box.y+box.height*.45);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.3,box.y+box.height*.6,{steps:12});await page.mouse.up();
  await page.waitForTimeout(150);checks.orbitChangesFrame=!(await canvas.screenshot()).equals(beforeOrbit);
  // A large orbit changes the projected silhouette. Leave room to inspect it.
  await page.mouse.wheel(0,500);await page.waitForTimeout(500);
  framing.orbit=await visibleForegroundBounds(canvas);checks.orbitFramed=hasFrameMargin(framing.orbit);
  await page.screenshot({path:'artifacts/review/064-desktop-orbit.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  await canvas.waitFor({state:'visible'});
  checks.mobileNoHorizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
  checks.mobileCanvasVisible=await canvas.isVisible();
  framing.mobile=await visibleForegroundBounds(canvas);checks.mobileFramed=hasFrameMargin(framing.mobile);
  const reset=await canvas.screenshot();await page.waitForTimeout(300);
  checks.resetStable=(await canvas.screenshot()).equals(reset);
  await page.screenshot({path:'artifacts/review/064-mobile-controls.png',fullPage:true});
  await page.goto('file:///home/danlu/proj/507movements/artifacts/review/064-candidate-source-overlay.html');
  await page.setViewportSize({width:1320,height:1250});
  await page.screenshot({path:'artifacts/review/064-candidate-source-overlay.png'});
  checks.noPageErrors=errors.length===0;
  await writeFile('artifacts/review/064-ui-check.json',JSON.stringify({checks,framing,errors},null,2)+'\n');
  console.log({checks,framing,errors});if(Object.values(checks).some(v=>v!==true)||!checks.playChangesFrame)process.exitCode=1;
}finally{await browser.close();}
