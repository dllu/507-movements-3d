import {expect,test} from '@playwright/test';
import {expectReconstructionNote,settleCanvas} from '../helpers/viewer.mjs';
test('154 plays its passive weighted bell-crank and restarts on desktop and mobile',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/portable/#/movement/154');const canvas=page.locator('.simulation-canvas');await expect(canvas).toBeVisible();await settleCanvas(canvas);await page.waitForTimeout(300);
 await expectReconstructionNote(page,'Three disk studs lift the weight through an elbow and a cord over the pulley.');
 const initial=await canvas.screenshot();await page.screenshot({path:'/dev/shm/154-packaged-source.png'});
 await page.locator('.play-control').click();await page.waitForTimeout(520);await page.locator('.play-control').click();
 expect((await canvas.screenshot()).equals(initial)).toBe(false);await page.screenshot({path:'/dev/shm/154-packaged-moving.png'});
 await page.getByRole('button',{name:'Restart',exact:true}).click();expect((await canvas.screenshot()).equals(initial)).toBe(true);
 expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/\.wasm(?:\?|$)/.test(r.name)))).toBe(false);
 const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+100,box.y+box.height*.5+10,{steps:12});await page.mouse.up();await page.screenshot({path:'/dev/shm/154-packaged-oblique.png'});
 await page.getByRole('button',{name:'Reset view',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await expect(canvas).toBeVisible();await settleCanvas(canvas);await page.screenshot({path:'/dev/shm/154-packaged-mobile.png'});expect(errors).toEqual([]);
});
