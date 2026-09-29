import {expect,test} from '@playwright/test';
import {expectReconstructionNote,settleCanvas} from '../helpers/viewer.mjs';
test('130 plays its baked contact motion without WASM and restarts on mobile',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/portable/#/movement/130');const canvas=page.locator('.simulation-canvas');await expect(canvas).toBeVisible();await settleCanvas(canvas);
 await expectReconstructionNote(page,/The cam closes the shear/);await page.waitForTimeout(300);
 const initial=await canvas.screenshot();await page.screenshot({path:'/dev/shm/130-packaged-source.png'});
 await page.locator('.play-control').click();await page.waitForTimeout(1300);await page.locator('.play-control').click();
 expect((await canvas.screenshot()).equals(initial)).toBe(false);await page.screenshot({path:'/dev/shm/130-packaged-moving.png'});
 await page.getByRole('button',{name:'Restart',exact:true}).click();expect((await canvas.screenshot()).equals(initial)).toBe(true);
 expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/\.wasm(?:\?|$)/.test(r.name)))).toBe(false);
 await page.setViewportSize({width:390,height:844});await expect(canvas).toBeVisible();await settleCanvas(canvas);await page.screenshot({path:'/dev/shm/130-packaged-mobile.png'});
 expect(errors).toEqual([]);
});
