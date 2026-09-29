import {expect,test} from '@playwright/test';
import {expectReconstructionNote,settleCanvas} from '../helpers/viewer.mjs';
test('127 loads analytically and plays on desktop and mobile',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/portable/#/movement/127');
 const canvas=page.locator('.simulation-canvas');await expect(canvas).toBeVisible();await settleCanvas(canvas);
 await expectReconstructionNote(page,/One lever drives equal and opposite racks/);
 await page.waitForTimeout(300);
 const initial=await canvas.screenshot();
 await page.locator('.play-control').click();await page.waitForTimeout(1000);await page.locator('.play-control').click();
 expect((await canvas.screenshot()).equals(initial)).toBe(false);
 expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/\.wasm(?:\?|$)/.test(r.name)))).toBe(false);
 await page.setViewportSize({width:390,height:844});await expect(canvas).toBeVisible();await settleCanvas(canvas);
 await page.screenshot({path:'/dev/shm/127-mobile.png'});
 expect(errors).toEqual([]);
});
