import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const prefix = process.env.PROBE_PREFIX ?? '/dev/shm/082-mujoco-integrated';
const base = process.env.PROBE_BASE_URL ?? 'http://127.0.0.1:43918';
const browser = await chromium.launch({channel: 'chrome', headless: true});
const errors = [], views = [];
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto(base + '/portable/#/movement/082', {waitUntil: 'networkidle'});
  await page.getByRole('button', {name: 'Restart', exact: true}).waitFor();
  const canvas = page.locator('.simulation-canvas'), play = page.locator('.play-control');
  await canvas.evaluate(element => element.addEventListener('webglcontextlost', () => { window.lostContext = true; }));
  const capture = async name => {
    assert(!await page.evaluate(() => window.lostContext));
    const file = prefix + '-' + name + '.png';
    assert(!fs.existsSync(file));
    await page.screenshot({path: file, fullPage: true});
    views.push({name, file});
  };
  await capture('desktop');
  for (let stroke = 1; stroke <= 4; stroke++) {
    await play.click();
    await page.waitForTimeout(1000);
    await play.click();
    await capture('stroke-' + stroke);
  }
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .56, box.y + box.height * .54, {steps: 12});
  await page.mouse.up();
  await page.waitForTimeout(400);
  await capture('oblique');
  await page.getByRole('button', {name: 'Reset view', exact: true}).click();
  await page.getByRole('button', {name: 'Restart', exact: true}).click();
  await play.click();
  const runtime = await page.evaluate(() => new Promise(resolve => {
    let start;
    const frames = [];
    function frame(now) {
      start ??= now;
      frames.push(now - start);
      if (now - start < 8200) requestAnimationFrame(frame);
      else resolve({seconds: (now - start) / 1000, frames: frames.length, fps: (frames.length - 1) * 1000 / (now - start)});
    }
    requestAnimationFrame(frame);
  }));
  await play.click();
  await page.setViewportSize({width: 390, height: 844});
  await page.getByRole('button', {name: 'Reset view', exact: true}).click();
  await capture('mobile');
  await page.goto(base + '/portable/#/catalog', {waitUntil: 'networkidle'});
  assert.equal(await page.locator('.movement-card').count(), 12);
  assert.deepEqual(errors, []);
  fs.writeFileSync(prefix + '.json', JSON.stringify({views, runtime, errors, passed: true}, null, 2) + '\n', {flag: 'wx'});
  console.log({views: views.length, runtime, errors});
} finally { await browser.close(); }
