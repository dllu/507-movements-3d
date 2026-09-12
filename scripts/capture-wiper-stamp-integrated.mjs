import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {hashStudyFile, freezeStudySources, verifyStudySources} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/085-integrated-first';
const files = ['scripts/capture-wiper-stamp-integrated.mjs', 'src/simulation/wiper-stamp.js', 'src/simulation/wiper-stamp-motion.js',
  'src/simulation/wiper-stamp-geometry.js', 'src/simulation/wiper-stamp-contact.js', 'src/simulation/conforming-plate-mesh.js',
  'src/data/wiper-stamp-profile.js', 'src/data/wiper-stamp-source.js', 'src/data/display-profiles.js', 'src/data/display-profiles.json',
  'src/data/movements.json', 'src/simulation/authored-intermittent.js', 'src/simulation/registry.js', 'src/simulation/engine.js',
  'src/simulation/finite-plate-geometry.js', 'src/simulation/clutch-section-geometry.js', 'src/simulation/primitives.js', 'artifacts/reference/brown-085-detail.png'];
const sources = freezeStudySources(files, prefix), browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1500, height: 800}}), errors = [], warnings = [], views = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => {if (['warning', 'error'].includes(m.type())) warnings.push(m.text());});
try {
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async () => {
    const {MovementEngine} = await import('/src/simulation/engine.js'), {default: catalog} = await import('/src/data/movements.json');
    document.body.innerHTML = '<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-085-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();
    const e = new MovementEngine(document.querySelector('#stage'), catalog.movements[84], {playing: false});
    cancelAnimationFrame(e.animationFrame); e.animationFrame = 0; window.wiperReview = e;
  });
  const runtime = await page.evaluate(() => new Promise(resolve => {
    const e = window.wiperReview, frames = []; let first;
    function draw(now) {
      first ??= now; const time = (now - first) / 1000, start = performance.now(); e.model.update(time);
      const updateMs = performance.now() - start; e.renderer.render(e.scene, e.camera);
      frames.push({time, updateMs, ...e.model.root.userData.kinematics});
      if (time < 8.5) requestAnimationFrame(draw); else resolve({duration: time, frames, fog: e.scene.fog, hiddenGround: e.model.root.userData.hideGround,
        timeScale: e.playbackTimeScale, playbackDuration: e.playbackDuration});
    }
    requestAnimationFrame(draw);
  }));
  const poses = [['source',0],['source-aligned',0],['source-overlay',0],['first-lift',.12],['first-release',.25],
    ['first-impact',.3755],['bed-dwell',1],['second-lift',2],['upward-release',2.055],['maximum-lift',2.095],['second-fall',2.2],
    ['second-impact',2.333],['repeat-seam',5.001],['oblique',0],['rear',0],['contact-detail',.12]];
  for (const [name, time] of poses) {
    const state = await page.evaluate(async ({name, time}) => {
      const {THREE: {Vector3, OrthographicCamera}} = await import('/src/simulation/wiper-stamp-geometry.js'), e = window.wiperReview, p = e.model.root.userData.source;
      document.querySelector('#overlay')?.remove(); e.model.update(time); e.fitCamera(new Vector3(...(name === 'rear' ? [-4, 3, -10] : name === 'oblique' ? [4, 3, 10] : [0, 0, 10])));
      let camera = e.camera;
      if (name === 'source-aligned' || name === 'source-overlay') {
        const h = Math.max(1350, 1220 * 720 / 726) / p.scale, w = h * 726 / 720, cx = (610 - p.center[0]) / p.scale, cy = (p.center[1] - 675) / p.scale;
        camera = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, .01, 100); camera.position.set(cx, cy, 10); camera.lookAt(cx, cy, 0); camera.updateMatrixWorld();
      }
      if (name === 'contact-detail') {
        const target = new Vector3(-.25,.3,.05); camera = new OrthographicCamera(-.85,.85,.85 * 720 / 726,-.85 * 720 / 726, .01, 100);
        camera.position.copy(target).add(new Vector3(0,0,8)); camera.lookAt(target); camera.updateMatrixWorld();
      }
      e.renderer.render(e.scene, camera); document.querySelector('#title').textContent = `085 · integrated model · ${name} · ${time.toFixed(3)} s`;
      if(name==='source-overlay'){
        const image=document.createElement('img');image.id='overlay';image.src='/artifacts/reference/brown-085-detail.png';
        image.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';
        document.querySelector('#stage').append(image);await image.decode();
      }
      return e.model.root.userData.kinematics;
    }, {name, time});
    const file = prefix + '-' + name + '.png'; assert(!fs.existsSync(file)); await page.screenshot({path: file});
    views.push({name, time, state, file, sha256: hashStudyFile(file), inspected: false});
  }
  await page.emulateMedia({reducedMotion: 'reduce'}); await page.goto('http://127.0.0.1:5174/?review=085-integrated#/movement/085');
  await page.locator('canvas').waitFor({state: 'visible'}); await page.getByRole('button', {name: 'Play', exact: true}).waitFor();
  for (const [name, viewport] of [['desktop', {width: 1440, height: 1000}], ['mobile', {width: 390, height: 844}]]) {
    await page.setViewportSize(viewport); await page.getByRole('button', {name: 'Reset view', exact: true}).click(); await page.waitForTimeout(200);
    const file = prefix + '-' + name + '.png'; assert(!fs.existsSync(file)); await page.screenshot({path: file, fullPage: true});
    views.push({name, file, sha256: hashStudyFile(file), inspected: false});
  }
  const updates = runtime.frames.map(f => f.updateMs).sort((a, b) => a - b), summary = {duration: runtime.duration, frames: runtime.frames.length,
    fps: (runtime.frames.length - 1) / runtime.duration, p95UpdateMs: updates[Math.floor(updates.length * .95)], fog: runtime.fog,
    hiddenGround: runtime.hiddenGround, timeScale: runtime.timeScale, playbackDuration: runtime.playbackDuration};
  const known = [/^THREE.Clock: This module has been deprecated\./, /^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./, /^\[.WebGL-.*GPU stall due to ReadPixels/];
  const unexpectedWarnings = warnings.filter(w => !known.some(r => r.test(w))); verifyStudySources(sources);
  fs.writeFileSync(prefix + '-captures.json', JSON.stringify({movement: 85, summary, runtime, views, errors, warnings, unexpectedWarnings, sources}, null, 2) + '\n', {flag: 'wx'});
  console.log({summary, views: views.length, errors, unexpectedWarnings});
  assert(!errors.length && !unexpectedWarnings.length); assert.equal(runtime.fog, null); assert(runtime.hiddenGround); assert.equal(runtime.timeScale, 1);
} finally {await browser.close();}
