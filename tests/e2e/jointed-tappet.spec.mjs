import {test,expect} from '@playwright/test';
import {visibleForegroundBounds,hasFrameMarginExcept} from '../helpers/rendered-frame.mjs';
import {settleCanvas} from '../helpers/viewer.mjs';

// The engraving-section/complete-wheel selector was retired; 076 now shows
// only the complete wheel.
// The view keeps Brown's crop of the large wheel, whose rim runs past the
// left, top and lower edges; the tappet side stays inside the frame.
const OPEN=['left','top','bottom'];

test('076 plays, pauses and keeps its complete wheel framed on desktop and mobile',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/#/movement/076');const canvas=page.locator('canvas');
  await expect(canvas).toBeVisible();await settleCanvas(canvas);await expect(page.locator('.configuration-control')).toHaveCount(0);
  const pause=page.getByRole('button',{name:'Pause',exact:true});await pause.click();
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  const stopped=await canvas.screenshot();await page.waitForTimeout(250);expect(await canvas.screenshot()).toEqual(stopped);
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await expect.poll(async()=>(await canvas.screenshot()).equals(stopped)).toBe(false);await pause.click();
  expect(hasFrameMarginExcept(await visibleForegroundBounds(canvas),OPEN)).toBe(true);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  await expect.poll(async()=>hasFrameMarginExcept(await visibleForegroundBounds(canvas),OPEN)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await settleCanvas(canvas);
  const mobile=await canvas.screenshot();await page.waitForTimeout(250);expect(await canvas.screenshot()).toEqual(mobile);
  expect(errors).toEqual([]);
});
