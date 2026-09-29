import {expect} from '@playwright/test';

// The viewer lowers its drawing-buffer resolution while frames stay slower
// than 1/32 s (async-engine.js trackResolution), and never raises it again.
// Headless software WebGL on a busy host takes such steps during loading and
// playback, changing every pixel of an otherwise identical frame. Before
// comparing screenshots, wait until the buffer is at its one-pixel-per-CSS-
// pixel floor, or until frames are fast enough that no further step follows.
export async function settleCanvas(canvas, {quiet = 2000, timeout = 20000} = {}) {
  const page = canvas.page();
  const sample = () => canvas.evaluate(element => new Promise(resolve => {
    const times = [];
    const tick = time => {
      times.push(time);
      if (times.length < 6) requestAnimationFrame(tick);
      else resolve({size: `${element.width}x${element.height}`, floor: element.width <= element.clientWidth,
        frame: (times[5] - times[0]) / 5 / 1000});
    };
    requestAnimationFrame(tick);
  }));
  const start = Date.now();
  let state = await sample(), since = Date.now();
  while (!state.floor && Date.now() - start < timeout) {
    if (Date.now() - since >= quiet && state.frame < 1 / 40) break;
    const next = await sample();
    if (next.size !== state.size) since = Date.now();
    state = next;
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
