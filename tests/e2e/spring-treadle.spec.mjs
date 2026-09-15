import {expect,test} from '@playwright/test';
test('160 plays its baked spring treadle and restarts on desktop and mobile',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/portable/#/movement/160');const canvas=page.locator('.simulation-canvas');await expect(canvas).toBeVisible();await page.waitForTimeout(300);
 await expect(page.getByText('Foot pressure bends the spring through a full-wrap band;',{exact:false})).toBeVisible();
 const initial=await canvas.screenshot();await page.screenshot({path:'/dev/shm/160-packaged-source.png'});
 await page.locator('.play-control').click();await page.waitForTimeout(1800);await page.locator('.play-control').click();
 expect((await canvas.screenshot()).equals(initial)).toBe(false);await page.screenshot({path:'/dev/shm/160-packaged-moving.png'});
 await page.getByRole('button',{name:'Restart',exact:true}).click();expect((await canvas.screenshot()).equals(initial)).toBe(true);
 expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/\.wasm(?:\?|$)/.test(r.name)))).toBe(false);
 const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+100,box.y+box.height*.5+10,{steps:12});await page.mouse.up();await page.screenshot({path:'/dev/shm/160-packaged-oblique.png'});
 await page.getByRole('button',{name:'Reset view',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await expect(canvas).toBeVisible();await page.screenshot({path:'/dev/shm/160-packaged-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
