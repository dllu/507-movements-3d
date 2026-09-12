import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {makeSelectorRackFreeCandidate} from './lib/selector-rack-free-candidate.mjs';
import {makeSelectorRackDynamics} from './lib/selector-rack-dynamics.mjs';
import {readStudyReport, hashStudyFile, verifyStudySources, freezeStudySources} from './lib/study-report-io.mjs';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/084-planar-half-ms-pulses.json.gz';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/084-half-ms-loaded';
const data = readStudyReport(input); verifyStudySources(data.sources); assert.equal(data.failures.length, 0);
const physics = makeSelectorRackDynamics(makeSelectorRackFreeCandidate(), data.parameters);
const selected = [['initial', 0], ['lower-engage', 1.3], ['lower-drive', 1.5], ['lower-release', 1.7], ['lower-stop', 2.1],
  ['upper-start', 3.45], ['upper-drive', 3.7], ['upper-release', 4], ['final', 5.5], ['oblique', 1.5], ['rear', 3.7], ['suspension-detail', 3.7]];
const poses = selected.map(([name, time]) => {
  const row = data.rows.reduce((a, b) => Math.abs(a.time - time) <= Math.abs(b.time - time) ? a : b), k = physics.input(row.time);
  return {name, time: row.time, x: row.x, v: row.v, state: {camAngle: k.camAngle, selectorY: k.selectorY, center: row.x.slice(0, 2), frameAngle: row.x[2]}};
});
const frozen = readStudyReport('artifacts/review/083-shadow-source-hashes.json');
const verifyProduction = () => {for (const [file, sha] of Object.entries(frozen)) assert.equal(hashStudyFile(file), sha, file);};
verifyProduction();
const sources = freezeStudySources([input, 'scripts/capture-selector-rack-dynamics.mjs', ...data.sources.map(s => s.file),
  'src/simulation/engine.js', 'artifacts/reference/brown-084-detail.png'], prefix);
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1500, height: 800}}), errors = [], warnings = [], views = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => {if (['warning', 'error'].includes(m.type())) warnings.push(m.text());});
try {
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async () => {
    const {MovementEngine} = await import('/src/simulation/engine.js'), {default: catalog} = await import('/src/data/movements.json');
    const {makeSelectorRackFreeCandidate} = await import('/scripts/lib/selector-rack-free-candidate.mjs');
    document.body.innerHTML = '<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-084-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();
    const e = new MovementEngine(document.querySelector('#stage'), catalog.movements[83], {playing: false});
    cancelAnimationFrame(e.animationFrame); e.animationFrame = 0; e.scene.remove(e.model.root);
    e.model.root.traverse(o => {o.geometry?.dispose(); if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material?.dispose();});
    e.model = makeSelectorRackFreeCandidate(); e.scene.add(e.model.root); e.updateGroundClearance(); window.loadedSelector = e;
  });
  for (const pose of poses) {
    const state = await page.evaluate(async pose => {
      const {THREE: {Vector3, OrthographicCamera}} = await import('/scripts/lib/selector-rack-candidate.mjs');
      const e = window.loadedSelector, p = e.model.root.userData.source;
      e.model.setState(pose.state); const direction = pose.name === 'rear' ? [-4, 3, -10] : pose.name === 'oblique' ? [4, 3, 10] : [0, 0, 10];
      e.fitCamera(new Vector3(...direction)); let camera = e.camera;
      if (!['rear', 'oblique'].includes(pose.name)) {
        const h = Math.max(1250, 1800 * 720 / 726) / p.scale, w = h * 726 / 720, cx = (900 - p.center[0]) / p.scale, cy = (p.center[1] - 625) / p.scale;
        camera = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, .01, 100); camera.position.set(cx, cy, 10); camera.lookAt(cx, cy, 0); camera.updateMatrixWorld();
      }
      if (pose.name === 'suspension-detail') {
        const target = new Vector3(0, .8, .1); camera = new OrthographicCamera(-1.65, 1.65, 1.65 * 720 / 726, -1.65 * 720 / 726, .01, 100);
        camera.position.copy(target).add(new Vector3(.4, .2, 8)); camera.lookAt(target); camera.updateMatrixWorld();
      }
      e.renderer.render(e.scene, camera); document.querySelector('#title').textContent = `084 · loaded contact study · ${pose.name} · ${pose.time.toFixed(3)} s`;
      return e.model.root.userData.state;
    }, pose);
    const file = prefix + '-' + pose.name + '.png'; assert(!fs.existsSync(file)); await page.screenshot({path: file});
    views.push({...pose, state, file, sha256: hashStudyFile(file), inspected: false});
  }
  verifyStudySources(sources); verifyProduction();
  const known = [/^THREE.Clock: This module has been deprecated\./, /^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./, /^\[.WebGL-.*GPU stall due to ReadPixels/];
  const unexpectedWarnings = warnings.filter(w => !known.some(r => r.test(w)));
  fs.writeFileSync(prefix + '-captures.json', JSON.stringify({movement: 84, input, productionChanged: false, mechanicsPassed: false,
    views, errors, warnings, unexpectedWarnings, sources, frozenProductionInputsMatched: Object.keys(frozen).length}, null, 2) + '\n', {flag: 'wx'});
  console.log({views: views.length, errors, unexpectedWarnings}); assert(!errors.length && !unexpectedWarnings.length);
} finally {await browser.close();}
