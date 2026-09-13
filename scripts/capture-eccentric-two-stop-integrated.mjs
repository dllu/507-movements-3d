import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {makeEccentricTwoStopMotion} from '../src/simulation/eccentric-two-stop-motion.js';
import profile from '../src/data/eccentric-two-stop-profile.js';
import {hashStudyFile, freezeStudySources, verifyStudySources} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/088-integrated-playback';
const files = ['scripts/capture-eccentric-two-stop-integrated.mjs', 'src/simulation/eccentric-two-stop.js',
  'src/simulation/eccentric-two-stop-motion.js', 'src/data/eccentric-two-stop-profile.js',
  ...fs.readdirSync('src/simulation/eccentric-two-stop').map(f => 'src/simulation/eccentric-two-stop/' + f),
  'src/data/display-profiles.js', 'src/data/display-profiles.json', 'src/simulation/authored-intermittent.js',
  'src/simulation/registry.js', 'src/simulation/engine.js', 'src/simulation/primitives.js',
  'src/simulation/finite-plate-geometry.js', 'src/simulation/conforming-plate-mesh.js',
  'src/simulation/bevel-geometry.js', 'src/simulation/jaw-clutch-geometry.js',
  'src/simulation/clutch-section-geometry.js', 'public/engravings/mm_088.png'];
const sources = freezeStudySources(files, prefix), motion = makeEccentricTwoStopMotion(profile);
const errors = [], warnings = [], views = [];
const event = (kind, n = 0) => (profile.events.filter(e => e.kind === kind)[n].time) / motion.rate;
const specs = [{name: 'source', time: 0}, {name: 'source-overlay', time: 0},
  {name: 'C-driven', time: (event('contact') + event('release')) / 2},
  {name: 'C-release', time: event('release')}, {name: 'first-rest', time: event('rest') + .04},
  {name: 'D-driven', time: (event('contact', 1) + event('release', 1)) / 2},
  {name: 'D-release', time: event('release', 1)}, {name: 'second-rest', time: event('rest', 1) + .04},
  {name: 'oblique-drive', time: (event('contact') + event('release')) / 2, oblique: true},
  {name: 'stop-detail', time: event('contact') + .01, detail: true},
  {name: 'loop-before', time: profile.repeat.end / motion.rate - 1e-6},
  {name: 'loop-after', time: profile.repeat.end / motion.rate + 1e-6}];
const browser = await chromium.launch({channel: 'chrome', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 800}});
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (['warning', 'error'].includes(m.type())) warnings.push(m.text());});
  await page.route('**/__study_088_integrated', route => route.fulfill({contentType: 'text/html', body:
    '<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0}.simulation-canvas{display:block;width:100%;height:100%}</style></head><body></body></html>'}));
  await page.goto('http://127.0.0.1:5174/__study_088_integrated', {waitUntil: 'domcontentloaded'});
  const rendererInfo = await page.evaluate(async () => {
    const {MovementEngine} = await import('/src/simulation/engine.js'), {default: catalog} = await import('/src/data/movements.json');
    document.body.innerHTML = '<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:19px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/engravings/mm_088.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();
    const e = new MovementEngine(document.querySelector('#stage'), catalog.movements[87], {playing: false});
    cancelAnimationFrame(e.animationFrame); e.animationFrame = 0; window.eccentricReview = e;
    const gl = e.renderer.getContext(), extension = gl.getExtension('WEBGL_debug_renderer_info');
    return {renderer: gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER), pixelRatio: e.renderer.getPixelRatio()};
  });
  const runtime = await page.evaluate(() => new Promise(resolve => {
    const e = window.eccentricReview, frames = []; let first, last;
    function frame(now) {
      first ??= now; const time = (now - first) / 1000, start = performance.now();
      e.model.update(time * e.playbackTimeScale); const updateMs = performance.now() - start;
      e.renderer.render(e.scene, e.camera);
      frames.push({time, intervalMs: last === undefined ? 0 : now - last, updateMs, ...e.model.root.userData.kinematics}); last = now;
      document.querySelector('#title').textContent = '088 · integrated playback · ' + time.toFixed(2) + ' s';
      if (time < 17.8) requestAnimationFrame(frame);
      else resolve({duration: time, frames, fog: e.scene.fog, hiddenGround: e.model.root.userData.hideGround,
        timeScale: e.playbackTimeScale, displayCycleDuration: e.model.root.userData.animationTiming.displayCycleDuration,
        repeatsIndefinitely: e.playbackDuration === Infinity});
    }
    requestAnimationFrame(frame);
  }));
  for (const spec of specs) {
    const state = await page.evaluate(async spec => {
      const {THREE: {Vector3, OrthographicCamera}} = await import('/src/simulation/eccentric-two-stop/source-geometry.js');
      const e = window.eccentricReview, s = e.model.root.userData.source;
      document.querySelector('#overlay')?.remove(); e.model.update(spec.time);
      e.fitCamera(new Vector3(...(spec.oblique ? [4, 3, 10] : [0, 0, 10]))); let camera = e.camera;
      if (spec.name === 'source-overlay') {
        const h = Math.max(s.height, s.width * 720 / 726) / s.scale, w = h * 726 / 720;
        const x = (s.width / 2 - s.input[0]) / s.scale, y = (s.input[1] - s.height / 2) / s.scale;
        camera = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, .01, 100);
        camera.position.set(x, y, 10); camera.lookAt(x, y, 0); camera.updateMatrixWorld();
      }
      if (spec.detail) {
        const center = new Vector3(-1.53, -.03, .15), half = .5;
        camera = new OrthographicCamera(-half, half, half * 720 / 726, -half * 720 / 726, .01, 100);
        camera.position.copy(center).add(new Vector3(3, 2, 9)); camera.lookAt(center); camera.updateMatrixWorld();
      }
      e.renderer.render(e.scene, camera);
      if (spec.name === 'source-overlay') {
        const image = document.createElement('img'); image.id = 'overlay'; image.src = '/engravings/mm_088.png';
        image.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';
        document.querySelector('#stage').append(image); await image.decode();
      }
      document.querySelector('#title').textContent = '088 · integrated model · ' + spec.name;
      const box = e.renderer.domElement.getBoundingClientRect();
      if (Math.abs(box.width - 726) > 1 || Math.abs(box.height - 720) > 1) throw Error('Incorrect canvas dimensions');
      return e.model.root.userData.kinematics;
    }, spec);
    const expected = motion.atTime(spec.time), maximumStateDifference = Math.max(Math.abs(state.inputAngle - expected.inputAngle),
      Math.abs(state.outputAngle - expected.outputAngle));
    assert(maximumStateDifference < 1e-12);
    const file = prefix + '-' + spec.name + '.png'; assert(!fs.existsSync(file)); await page.screenshot({path: file});
    views.push({...spec, state, maximumStateDifference, file, sha256: hashStudyFile(file), inspected: false});
  }
  await page.evaluate(() => window.eccentricReview.dispose());
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('http://127.0.0.1:5174/?review=088-integrated#/movement/088', {waitUntil: 'domcontentloaded'});
  await page.locator('canvas').waitFor({state: 'visible'}); await page.getByRole('button', {name: 'Play', exact: true}).waitFor();
  for (const [name, viewport] of [['desktop', {width: 1440, height: 1000}], ['mobile', {width: 390, height: 844}]]) {
    await page.setViewportSize(viewport); await page.getByRole('button', {name: 'Reset view', exact: true}).click(); await page.waitForTimeout(200);
    const file = prefix + '-' + name + '.png'; assert(!fs.existsSync(file)); await page.screenshot({path: file, fullPage: true});
    views.push({name, file, sha256: hashStudyFile(file), inspected: false});
  }
  const intervals = runtime.frames.slice(1).map(f => f.intervalMs).sort((a, b) => a - b);
  const updates = runtime.frames.map(f => f.updateMs).sort((a, b) => a - b);
  const known = [/^THREE.Clock: This module has been deprecated\./, /^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./, /^\[.WebGL-.*GPU stall due to ReadPixels/];
  const unexpectedWarnings = warnings.filter(w => !known.some(r => r.test(w)));
  const summary = {...runtime, frames: runtime.frames.length, fps: (runtime.frames.length - 1) / runtime.duration,
    p95IntervalMs: intervals[Math.floor(intervals.length * .95)], p95UpdateMs: updates[Math.floor(updates.length * .95)]};
  for (const f of runtime.frames) {
    const expected = motion.atTime(f.time * runtime.timeScale);
    assert(Math.abs(f.inputAngle - expected.inputAngle) < 1e-12 && Math.abs(f.outputAngle - expected.outputAngle) < 1e-12);
  }
  verifyStudySources(sources);
  const passed = !errors.length && !unexpectedWarnings.length && runtime.timeScale === 1 && runtime.fog === null &&
    runtime.hiddenGround && runtime.displayCycleDuration === 8 && runtime.repeatsIndefinitely;
  fs.writeFileSync(prefix + '-captures.json', JSON.stringify({movement: 88, sources, rendererInfo, runtime, summary,
    views, errors, warnings, unexpectedWarnings, passed}, null, 2) + '\n', {flag: 'wx'});
  console.log({passed, summary, views: views.length, errors, unexpectedWarnings}); assert(passed);
} finally { await browser.close(); }
