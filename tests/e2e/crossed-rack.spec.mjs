import {test,expect} from '@playwright/test';
import {visibleForegroundBounds,hasFrameMarginExcept} from '../helpers/rendered-frame.mjs';
import {settleCanvas} from '../helpers/viewer.mjs';

// 080 was rebuilt as a baked MuJoCo loop: the lift repeats continuously, so
// playback never finishes and no Replay control is offered.
// The rack bar now runs on past the view's lower edge, as on Brown's plate.
const OPEN=['bottom'];

test('080 pauses, resumes and keeps looping its lift on desktop and mobile',async({page})=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#/movement/080');
 const canvas=page.locator('canvas'),play=page.getByRole('button',{name:'Play',exact:true}),pause=page.getByRole('button',{name:'Pause',exact:true}),
  replay=page.getByRole('button',{name:'Replay',exact:true});await expect(canvas).toBeVisible();await settleCanvas(canvas);await expect(play).toBeVisible();
 const initial=await canvas.screenshot();await page.waitForTimeout(200);expect(await canvas.screenshot()).toEqual(initial);
 await page.getByLabel('Animation speed').selectOption('2');await play.click();await page.waitForTimeout(300);await pause.click();
 const paused=await canvas.screenshot();expect(paused.equals(initial)).toBe(false);await page.waitForTimeout(200);expect(await canvas.screenshot()).toEqual(paused);
 // Run past a full displayed cycle: the loop keeps playing instead of ending.
 await play.click();await page.waitForTimeout(5000);
 await expect(pause).toBeVisible();await expect(replay).toHaveCount(0);
 const looping=await canvas.screenshot();await expect.poll(async()=>(await canvas.screenshot()).equals(looping)).toBe(false);
 await pause.click();const held=await canvas.screenshot();await page.waitForTimeout(250);expect(await canvas.screenshot()).toEqual(held);
 await page.getByRole('button',{name:'Reset view',exact:true}).click();
 expect(hasFrameMarginExcept(await visibleForegroundBounds(canvas),OPEN)).toBe(true);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Reset view',exact:true}).click();
 await expect.poll(async()=>hasFrameMarginExcept(await visibleForegroundBounds(canvas),OPEN)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const mobile=await canvas.screenshot();await play.click();await expect(pause).toBeVisible();await page.waitForTimeout(300);await pause.click();
 const resumed=await canvas.screenshot();expect(resumed.equals(mobile)).toBe(false);await expect(play).toBeVisible();
 await page.waitForTimeout(200);expect(await canvas.screenshot()).toEqual(resumed);expect(errors).toEqual([]);
});
