import {expect,test} from '@playwright/test';
import {expectReconstructionNote,settleCanvas} from '../helpers/viewer.mjs';
test('169 plays its link-connected crank and restarts on desktop and mobile',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/portable/#/movement/169');const canvas=page.locator('.simulation-canvas');await expect(canvas).toBeVisible();await settleCanvas(canvas);await page.waitForTimeout(300);
 await expectReconstructionNote(page,'The added link replaces the slotted crank of movement 168.');
 const initial=await canvas.screenshot();await page.screenshot({path:'/dev/shm/169-packaged-source.png'});
 await page.locator('.play-control').click();await page.waitForTimeout(1800);await page.locator('.play-control').click();
 expect((await canvas.screenshot()).equals(initial)).toBe(false);await page.screenshot({path:'/dev/shm/169-packaged-moving.png'});
 await page.getByRole('button',{name:'Restart',exact:true}).click();expect((await canvas.screenshot()).equals(initial)).toBe(true);
 expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/\.wasm(?:\?|$)/.test(r.name)))).toBe(false);
 const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+100,box.y+box.height*.5+10,{steps:12});await page.mouse.up();await page.screenshot({path:'/dev/shm/169-packaged-oblique.png'});
 await page.getByRole('button',{name:'Reset view',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await expect(canvas).toBeVisible();await settleCanvas(canvas);await page.screenshot({path:'/dev/shm/169-packaged-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
