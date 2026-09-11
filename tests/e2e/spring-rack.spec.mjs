import {test,expect} from '@playwright/test';
import {visibleForegroundBounds,hasFrameMargin} from '../helpers/rendered-frame.mjs';

test('081 lifts, returns and stays framed through desktop and mobile playback',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#/movement/081');const canvas=page.locator('canvas');await expect(canvas).toBeVisible();
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.getByRole('button',{name:'Reset view',exact:true}).click();
 const stopped=await canvas.screenshot();await page.waitForTimeout(200);expect(await canvas.screenshot()).toEqual(stopped);
 await page.getByRole('button',{name:'Play',exact:true}).click();
 await expect.poll(async()=>(await canvas.screenshot()).equals(stopped)).toBe(false);
 for(let i=0;i<5;i++){await page.waitForTimeout(900);expect(hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);}
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Reset view',exact:true}).click();
 await expect.poll(async()=>hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const mobile=await canvas.screenshot();await page.waitForTimeout(200);expect(await canvas.screenshot()).toEqual(mobile);
 await page.getByRole('button',{name:'Play',exact:true}).click();
 await expect.poll(async()=>(await canvas.screenshot()).equals(mobile)).toBe(false);
 expect(errors).toEqual([]);
});
