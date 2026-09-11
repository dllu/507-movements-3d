import {test,expect} from '@playwright/test';
import {visibleForegroundBounds,hasFrameMargin} from '../helpers/rendered-frame.mjs';

test('076 plays, pauses and switches between engraving and complete views on desktop and mobile',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/#/movement/076');const canvas=page.locator('canvas'),view=page.locator('.configuration-control select');
  await expect(canvas).toBeVisible();await expect(view).toHaveValue('complete');
  const pause=page.getByRole('button',{name:'Pause',exact:true});await pause.click();
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  const stopped=await canvas.screenshot();await page.waitForTimeout(250);expect(await canvas.screenshot()).toEqual(stopped);
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await expect.poll(async()=>(await canvas.screenshot()).equals(stopped)).toBe(false);await pause.click();
  expect(hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);
  await view.selectOption('section');expect(await canvas.screenshot()).not.toEqual(stopped);
  expect(hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);
  await page.setViewportSize({width:390,height:844});await view.selectOption('section');
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  await expect.poll(async()=>hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await view.selectOption('complete');await expect(view).toHaveValue('complete');
  await expect.poll(async()=>hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);
  const mobile=await canvas.screenshot();await page.waitForTimeout(250);expect(await canvas.screenshot()).toEqual(mobile);
  expect(errors).toEqual([]);
});
