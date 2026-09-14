import {expect,test} from '@playwright/test';
test('133 plays its sector press motion without WASM and restarts on mobile',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/portable/#/movement/133');const canvas=page.locator('.simulation-canvas');await expect(canvas).toBeVisible();
 await page.waitForTimeout(300);
 const initial=await canvas.screenshot();await page.screenshot({path:'/dev/shm/133-packaged-source.png'});
 await page.locator('.play-control').click();await page.waitForTimeout(1330);await page.locator('.play-control').click();
 expect((await canvas.screenshot()).equals(initial)).toBe(false);await page.screenshot({path:'/dev/shm/133-packaged-moving.png'});
 await page.getByRole('button',{name:'Restart',exact:true}).click();expect((await canvas.screenshot()).equals(initial)).toBe(true);
 expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/\.wasm(?:\?|$)/.test(r.name)))).toBe(false);
 await page.setViewportSize({width:390,height:844});await expect(canvas).toBeVisible();await page.screenshot({path:'/dev/shm/133-packaged-mobile.png'});
 expect(errors).toEqual([]);
});
