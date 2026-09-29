import {expect} from '@playwright/test';

// The viewer lowers its drawing-buffer resolution while frames stay slow
// (async-engine.js trackResolution). Headless software WebGL usually takes
// one such step about a second after loading, which changes every pixel of a
// paused frame. Wait for the buffer size to hold before comparing screenshots.
export async function settleCanvas(canvas, {quiet = 2000, timeout = 15000} = {}) {
  const page = canvas.page();
  const size = () => canvas.evaluate(element => `${element.width}x${element.height}`);
  const start = Date.now();
  let last = await size(), since = Date.now();
  while (Date.now() - since < quiet && Date.now() - start < timeout) {
    await page.waitForTimeout(150);
    const current = await size();
    if (current !== last) { last = current; since = Date.now(); }
  }
  // Let the renderer draw at least one frame at the settled size.
  await page.waitForTimeout(100);
}

// Model notes appear beside the engraving: either as a visible paragraph
// (source description or mechanical correction) or inside the collapsed
// "Reconstruction notes" disclosure, which is revealed only when a model has
// a reconstruction note.
export async function expectReconstructionNote(page, text) {
  await expect(page.locator('.movement-notes')).toContainText(text);
  const disclosure = page.locator('.reconstruction-notes').filter({hasText: text});
  if (await disclosure.count()) await expect(disclosure.locator('summary')).toBeVisible();
  else await expect(page.getByText(text)).toBeVisible();
}
