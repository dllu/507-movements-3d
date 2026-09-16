import {test, expect} from '@playwright/test';

for (const id of [183, 207, 210, 324]) {
  test(`${id} revised family loads and survives portable mobile resize`, async ({page}) => {
    const errors=[];
    page.on('pageerror', error=>errors.push(error.message));
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(`/portable/#/movement/${id}`);
    const canvas=page.locator('.simulation-canvas');
    await expect(canvas).toBeVisible();
    await expect(page.locator('#simulation-stage')).toHaveAttribute('aria-busy','false');
    await page.locator('.play-control').click();
    await expect(page.locator('.play-control')).toHaveAttribute('aria-pressed','true');
    await page.waitForTimeout(500);
    await page.locator('.play-control').click();
    await expect(page.locator('.play-control')).toHaveAttribute('aria-pressed','false');
    await page.setViewportSize({width:390,height:844});
    await expect(canvas).toBeVisible();
    await page.getByRole('button',{name:'Reset view',exact:true}).click();
    expect(errors).toEqual([]);
  });
}
