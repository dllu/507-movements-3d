import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {freezeStudySources, verifyStudySources, hashStudyFile} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/089-joints-corrected';
const sources = freezeStudySources([
  'scripts/capture-eccentric-strap-joints.mjs', 'src/simulation/authored-cams.js',
  'src/simulation/eccentric-strap-joints.js', 'src/simulation/registry.js', 'src/simulation/engine.js', 'src/simulation/primitives.js',
  'src/simulation/eccentric-two-stop/source-geometry.js', 'src/simulation/conforming-plate-mesh.js',
  'src/simulation/finite-plate-geometry.js', 'src/simulation/clutch-section-geometry.js',
  'src/data/display-profiles.js', 'public/engravings/mm_089.png',
], prefix);
const errors = [], warnings = [], views = [];
const browser = await chromium.launch({channel: 'chrome', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1450, height: 760}});
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (['warning', 'error'].includes(m.type())) warnings.push(m.text());});
  await page.route('**/__study_089', r => r.fulfill({contentType: 'text/html', body:
    '<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0}.simulation-canvas{display:block;width:100%;height:100%}</style></head><body></body></html>'}));
  await page.goto('http://127.0.0.1:5174/__study_089', {waitUntil: 'domcontentloaded'});
  await page.evaluate(async () => {
    const {MovementEngine} = await import('/src/simulation/engine.js');
    const {default: catalog} = await import('/src/data/movements.json');
    document.body.innerHTML = '<main style="padding:16px;background:#faf8f2"><div id="title" style="font:20px system-ui;height:32px"></div><div style="display:flex;gap:16px"><div id="stage" style="width:700px;height:700px"></div><img src="/engravings/mm_089.png" style="width:700px;height:700px;object-fit:contain"></div></main>';
    await document.querySelector('img').decode();
    const e = new MovementEngine(document.querySelector('#stage'), catalog.movements[88], {playing: false});
    cancelAnimationFrame(e.animationFrame); e.animationFrame = 0; window.review089 = e;
  });
  for (const spec of [
    {name: 'front', fraction: 0}, {name: 'lower-quarter', fraction: .25},
    {name: 'return', fraction: .5}, {name: 'upper-quarter', fraction: .75},
    {name: 'oblique', fraction: .25, direction: [3, 2, 8]},
    {name: 'rear', fraction: .75, direction: [-3, 2, -8]},
    {name: 'wrist', fraction: .25, detail: 'wrist'},
    {name: 'flange', fraction: .25, detail: 'flange'},
  ]) {
    const state = await page.evaluate(async spec => {
      const {THREE: {Vector3, OrthographicCamera}} = await import('/src/simulation/eccentric-two-stop/source-geometry.js');
      const e = window.review089, u = e.model.root.userData;
      e.model.update(spec.fraction * u.geometry.cyclePeriod); e.model.root.updateMatrixWorld(true);
      e.fitCamera(new Vector3(...(spec.direction ?? [0, 0, 10]))); let camera = e.camera;
      if (spec.detail) {
        const part = spec.detail === 'wrist' ? u.blocks.rodEndEye : u.blocks.outerCouplingPlate;
        const center = part.getWorldPosition(new Vector3()), half = spec.detail === 'wrist' ? .9 : .75;
        camera = new OrthographicCamera(-half, half, half, -half, .01, 100);
        camera.position.copy(center).add(new Vector3(3, 2, 7)); camera.lookAt(center); camera.updateMatrixWorld();
      }
      e.renderer.render(e.scene, camera);
      document.querySelector('#title').textContent = '089 · ' + spec.name;
      return u.kinematics;
    }, spec);
    const file = prefix + '-' + spec.name + '.png'; assert(!fs.existsSync(file));
    await page.screenshot({path: file}); views.push({...spec, state, file, sha256: hashStudyFile(file), inspected: false});
  }
  const runtime = await page.evaluate(() => new Promise(resolve => {
    const e = window.review089, frames = []; let first, last;
    e.fitCamera(e.model.cameraDirection);
    function frame(now) {
      first ??= now; const time = (now - first) / 1000, start = performance.now();
      e.model.update(time * e.playbackTimeScale); const updateMs = performance.now() - start;
      e.renderer.render(e.scene, e.camera); frames.push({time, updateMs, intervalMs: last === undefined ? 0 : now - last}); last = now;
      if (time < 8.2) requestAnimationFrame(frame);
      else resolve({frames, timeScale: e.playbackTimeScale, timing: e.model.root.userData.animationTiming,
        fog: e.scene.fog, hideGround: e.model.root.userData.hideGround ?? false});
    } requestAnimationFrame(frame);
  }));
  await page.evaluate(() => window.review089.dispose());
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('http://127.0.0.1:5174/?review=089-joints#/movement/089', {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: 'Play', exact: true}).waitFor();
  for (const [name, viewport] of [['desktop', {width: 1440, height: 1000}], ['mobile', {width: 390, height: 844}]]) {
    await page.setViewportSize(viewport); await page.getByRole('button', {name: 'Reset view', exact: true}).click();
    await page.waitForTimeout(200);
    const file = prefix + '-' + name + '.png'; assert(!fs.existsSync(file));
    await page.screenshot({path: file, fullPage: true}); views.push({name, file, sha256: hashStudyFile(file), inspected: false});
  }
  const known = [/^THREE.Clock: This module has been deprecated\./, /^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./, /^\[.WebGL-.*GPU stall due to ReadPixels/];
  const unexpectedWarnings = warnings.filter(w => !known.some(r => r.test(w)));
  verifyStudySources(sources);
  const passed = !errors.length && !unexpectedWarnings.length;
  fs.writeFileSync(prefix + '.json', JSON.stringify({movement: 89, sources, views, runtime, errors, warnings, unexpectedWarnings, passed}, null, 2) + '\n', {flag: 'wx'});
  console.log({passed, views: views.length, frames: runtime.frames.length, timing: runtime.timing, errors, unexpectedWarnings}); assert(passed);
} finally {await browser.close();}
