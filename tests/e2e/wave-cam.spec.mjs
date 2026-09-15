import {expect,test} from '@playwright/test';
test('165 plays its baked waved cam and restarts on desktop and mobile',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/portable/#/movement/165');const canvas=page.locator('.simulation-canvas');await expect(canvas).toBeVisible();await page.waitForTimeout(300);
 await expect(page.getByText('Six identical, evenly spaced sinusoidal lobes drive the upright bar through a roller and lever.',{exact:false})).toBeVisible();
 console.log('165 load ms',await page.evaluate(()=>performance.now()));
 const initial=await canvas.screenshot();await page.screenshot({path:'/dev/shm/165-packaged-source.png'});
 await page.locator('.play-control').click();console.log('165 frame timing',await page.evaluate(()=>new Promise(resolve=>{const start=performance.now();let frames=0;function tick(now){frames++;if(now-start>=1800)resolve({frames,elapsed:now-start,fps:1000*frames/(now-start)});else requestAnimationFrame(tick);}requestAnimationFrame(tick);})));
 await page.locator('.play-control').click();
 expect((await canvas.screenshot()).equals(initial)).toBe(false);await page.screenshot({path:'/dev/shm/165-packaged-moving.png'});
 await page.getByRole('button',{name:'Restart',exact:true}).click();expect((await canvas.screenshot()).equals(initial)).toBe(true);
 expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/\.wasm(?:\?|$)/.test(r.name)))).toBe(false);
 const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+100,box.y+box.height*.5+10,{steps:12});await page.mouse.up();await page.screenshot({path:'/dev/shm/165-packaged-oblique.png'});
 await page.getByRole('button',{name:'Reset view',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await expect(canvas).toBeVisible();await page.screenshot({path:'/dev/shm/165-packaged-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
