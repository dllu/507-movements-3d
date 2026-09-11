import {test,expect} from '@playwright/test';
import {visibleForegroundBounds,hasFrameMargin} from '../helpers/rendered-frame.mjs';

test('080 pauses, finishes and explicitly replays its finite lift on desktop and mobile',async({page})=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#/movement/080');
 const canvas=page.locator('canvas'),play=page.getByRole('button',{name:'Play',exact:true}),pause=page.getByRole('button',{name:'Pause',exact:true}),
  replay=page.getByRole('button',{name:'Replay',exact:true});await expect(canvas).toBeVisible();await expect(play).toBeVisible();
 const initial=await canvas.screenshot();await page.waitForTimeout(200);expect(await canvas.screenshot()).toEqual(initial);
 await page.getByLabel('Animation speed').selectOption('2');await play.click();await page.waitForTimeout(300);await pause.click();
 const paused=await canvas.screenshot();expect(paused.equals(initial)).toBe(false);await page.waitForTimeout(200);expect(await canvas.screenshot()).toEqual(paused);
 await play.click();await expect(replay).toBeVisible({timeout:60000});await expect(replay).toHaveAttribute('aria-pressed','false');
 const raised=await canvas.screenshot();await page.waitForTimeout(250);expect(await canvas.screenshot()).toEqual(raised);
 await page.getByRole('button',{name:'Reset view',exact:true}).click();expect(await canvas.screenshot()).toEqual(raised);
 expect(hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Reset view',exact:true}).click();
 await expect.poll(async()=>hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const mobileEnd=await canvas.screenshot();await replay.click();await expect(pause).toBeVisible();await page.waitForTimeout(150);await pause.click();
 const restarted=await canvas.screenshot();expect(restarted.equals(mobileEnd)).toBe(false);await expect(play).toBeVisible();
 await page.waitForTimeout(200);expect(await canvas.screenshot()).toEqual(restarted);expect(errors).toEqual([]);
});
