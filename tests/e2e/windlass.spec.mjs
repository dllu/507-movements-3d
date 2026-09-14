import {expect,test} from '@playwright/test';
test('129 renders and animates its corrected hardware on desktop and mobile',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/portable/#/movement/129');const canvas=page.locator('.simulation-canvas');await expect(canvas).toBeVisible();
 await expect(page.getByText(/Bare barrel separates the rope exits/)).toBeVisible();await page.waitForTimeout(300);
 const initial=await canvas.screenshot();await page.screenshot({path:'/dev/shm/129-hardware-packaged.png'});
 await page.locator('.play-control').click();await page.waitForTimeout(1500);await page.locator('.play-control').click();
 expect((await canvas.screenshot()).equals(initial)).toBe(false);
 await page.setViewportSize({width:390,height:844});await expect(canvas).toBeVisible();await page.screenshot({path:'/dev/shm/129-hardware-mobile.png'});
 expect(errors).toEqual([]);
});
