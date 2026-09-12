import {test,expect} from '@playwright/test';
import {visibleForegroundBounds,hasFrameMargin} from '../helpers/rendered-frame.mjs';

test('085 starts, pauses and keeps repeating the stamp on desktop and mobile',async({page})=>{
  test.setTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#/movement/085');
  const canvas=page.locator('canvas'),play=page.getByRole('button',{name:'Play',exact:true}),pause=page.getByRole('button',{name:'Pause',exact:true});
  await expect(canvas).toBeVisible();await expect(play).toBeVisible();const first=await canvas.screenshot();
  await page.waitForTimeout(200);expect(await canvas.screenshot()).toEqual(first);
  await play.click();await page.waitForTimeout(650);await pause.click();const stopped=await canvas.screenshot();expect(stopped.equals(first)).toBe(false);
  await page.waitForTimeout(200);expect(await canvas.screenshot()).toEqual(stopped);
  await play.click();await page.waitForTimeout(5500);await expect(pause).toBeVisible();await pause.click();
  expect(hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Reset view',exact:true}).click();
  await expect.poll(async()=>hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const mobile=await canvas.screenshot();await play.click();await page.waitForTimeout(650);await pause.click();expect((await canvas.screenshot()).equals(mobile)).toBe(false);
  expect(errors).toEqual([]);
});
