import {expect,test} from '@playwright/test';
import {expectReconstructionNote,settleCanvas} from '../helpers/viewer.mjs';
test('123 plays recorded physics without loading MuJoCo, including portable hosting and restart',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/portable/#/movement/123');
 const canvas=page.locator('.simulation-canvas');await expect(canvas).toBeVisible({timeout:10000});await settleCanvas(canvas);
 await expectReconstructionNote(page,/Motion is recorded from a validated simulation/);
 expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/\.wasm(?:\?|$)/.test(r.name)))).toBe(false);
 const initial=await canvas.screenshot(),play=page.locator('.play-control');await play.click();await page.waitForTimeout(1100);await play.click();
 const moved=await canvas.screenshot();expect(moved.equals(initial)).toBe(false);await page.waitForTimeout(100);expect((await canvas.screenshot()).equals(moved)).toBe(true);
 await page.getByRole('button',{name:'Restart',exact:true}).click();expect((await canvas.screenshot()).equals(initial)).toBe(true);
 await page.getByRole('button',{name:'Section view',exact:true}).click();expect((await canvas.screenshot()).equals(initial)).toBe(false);
 await page.getByRole('button',{name:'Section view',exact:true}).click();expect((await canvas.screenshot()).equals(initial)).toBe(true);
 await page.setViewportSize({width:390,height:844});await expect(canvas).toBeVisible();await settleCanvas(canvas);expect(errors).toEqual([]);
});
