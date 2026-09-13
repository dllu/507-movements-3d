import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {freezeStudySources, verifyStudySources, hashStudyFile} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/089-source-playback';
const sources = freezeStudySources([
  'scripts/capture-eccentric-strap-source.mjs', 'src/simulation/authored-cams.js',
  'src/simulation/eccentric-strap.js', 'src/simulation/eccentric-strap-source.js', 'src/simulation/eccentric-strap-joints.js', 'src/simulation/registry.js', 'src/simulation/engine.js', 'src/simulation/primitives.js',
  'src/simulation/finite-plate-geometry.js', 'src/simulation/clutch-section-geometry.js',
  'src/data/display-profiles.js', 'public/engravings/mm_089.png',
], prefix);
const errors = [], warnings = [], views = [];
const browser = await chromium.launch({channel: 'chrome', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1450, height: 760}});
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (['warning', 'error'].includes(m.type())) warnings.push(m.text());});
  await page.route('**/__study_089_source', r => r.fulfill({contentType: 'text/html', body:
    '<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0}.simulation-canvas{display:block;width:100%;height:100%}</style></head><body></body></html>'}));
  await page.goto('http://127.0.0.1:5174/__study_089_source', {waitUntil: 'domcontentloaded'});
  await page.evaluate(async () => {
    const {MovementEngine} = await import('/src/simulation/engine.js');
    const {default: catalog} = await import('/src/data/movements.json');
    document.body.innerHTML = '<main style="padding:16px;background:#faf8f2"><div id="title" style="font:20px system-ui;height:32px"></div><div style="display:flex;gap:16px"><div id="stage" style="width:700px;height:700px;position:relative"></div><img src="/engravings/mm_089.png" style="width:700px;height:700px;object-fit:contain"></div></main>';
    await document.querySelector('img').decode();
    const e = new MovementEngine(document.querySelector('#stage'), catalog.movements[88], {playing: false});
    cancelAnimationFrame(e.animationFrame); e.animationFrame = 0; window.review089 = e;
  });
  for (const spec of [
    {name: 'source-front', fraction: 0}, {name: 'source-overlay', fraction: 0}, {name: 'front', fraction: 0}, {name: 'lower-quarter', fraction: .25},
    {name: 'return', fraction: .5}, {name: 'upper-quarter', fraction: .75},
    {name: 'oblique', fraction: .25, direction: [3, 2, 8]},
    {name: 'rear', fraction: .75, direction: [-3, 2, -8]},
    {name: 'clamp', fraction: 0, detail: 'clamp'}, {name: 'wrist', fraction: .25, detail: 'wrist'},
    {name: 'flange', fraction: .25, detail: 'flange'},
  ]) {
    const state = await page.evaluate(async spec => {
      const {THREE: {Vector3, OrthographicCamera, Box3}} = await import('/src/simulation/eccentric-strap.js');
      const e = window.review089, u = e.model.root.userData;
      document.querySelector('#overlay')?.remove();
      e.model.update(spec.fraction * u.geometry.cyclePeriod); e.model.root.updateMatrixWorld(true);
      e.fitCamera(new Vector3(...(spec.direction ?? [0, 0, 10]))); let camera = e.camera;
      if (spec.name.startsWith('source-')) {
        const half = 525 / 200, x = (525 / 2 - 159) / 100, y = (288 - 525 / 2) / 100;
        camera = new OrthographicCamera(-half, half, half, -half, .01, 100);
        camera.position.set(x, y, 10); camera.lookAt(x, y, 0); camera.updateMatrixWorld();
      }
      if (spec.detail) {
        const part = spec.detail === 'wrist' ? u.blocks.rodEndEye : spec.detail === 'clamp' ? u.blocks.strapLugs[0] : u.blocks.outerCouplingPlate;
        const center = spec.detail === 'clamp' ? new Box3().setFromObject(part, true).getCenter(new Vector3()) : part.getWorldPosition(new Vector3());
        const half = spec.detail === 'wrist' ? .8 : .85;
        camera = new OrthographicCamera(-half, half, half, -half, .01, 100);
        camera.position.copy(center).add(new Vector3(...(spec.detail === 'wrist' ? [-8, 1, 3] : [3, 2, 7]))); camera.lookAt(center); camera.updateMatrixWorld();
      }
      e.renderer.render(e.scene, camera);
      if (spec.name === 'source-overlay') {
        const img = document.createElement('img'); img.id = 'overlay'; img.src = '/engravings/mm_089.png';
        img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';
        document.querySelector('#stage').append(img); await img.decode();
      }
      document.querySelector('#title').textContent = '089 · ' + spec.name;
      return u.kinematics;
    }, spec);
    const file = prefix + '-' + spec.name + '.png'; assert(!fs.existsSync(file));
    await page.screenshot({path: file}); views.push({...spec, state, file, sha256: hashStudyFile(file), inspected: false});
  }
  const runtime = await page.evaluate(() => new Promise(resolve => {
    const e = window.review089, frames = []; let first, last;
    document.querySelector('#overlay')?.remove();
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
  await page.goto('http://127.0.0.1:5174/?review=089-source#/movement/089', {waitUntil: 'domcontentloaded'});
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
