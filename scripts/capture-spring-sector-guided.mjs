import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-conformal-guided-candidate';
const input = process.env.PROBE_INPUT;
const dynamics = input ? JSON.parse(fs.readFileSync(input)) : null;
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const freezeFile = 'artifacts/review/083-shadow-source-hashes.json', frozen = JSON.parse(fs.readFileSync(freezeFile));
for (const [file, expected] of Object.entries(frozen)) assert.equal(hash(file), expected, file);
const sourceFiles = [...(input ? [input, 'scripts/lib/spring-sector-dynamics.mjs', 'scripts/lib/spring-sector-mass.mjs'] : []),
  'scripts/capture-spring-sector-guided.mjs', 'scripts/lib/spring-sector-guided-candidate.mjs', 'scripts/lib/spring-sector-candidate.mjs',
  'scripts/lib/spring-sector-source.mjs', 'scripts/lib/spring-sector-contact.mjs', 'scripts/lib/spring-sector-linkage.mjs',
  'scripts/lib/spring-rack-coil.mjs', 'tests/helpers/solid-surface.mjs', 'src/simulation/engine.js', 'src/simulation/finite-plate-geometry.js',
  'src/simulation/primitives.js', 'artifacts/reference/brown-083-detail.png'];
if (dynamics) {assert.equal(dynamics.failures.length, 0); for (const source of dynamics.sources) assert.equal(hash(source.file), source.sha256, source.file);}
const sources = sourceFiles.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1500, height: 800}}), views = [], errors = [], warnings = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => {if (['warning', 'error'].includes(m.type())) warnings.push(m.text());});
try {
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async ({input}) => {
    const {MovementEngine} = await import('/src/simulation/engine.js');
    const {default: catalog} = await import('/src/data/movements.json');
    const {makeSpringSectorGuidedCandidate} = await import('/scripts/lib/spring-sector-guided-candidate.mjs');
    const {makeSpringSectorContact} = await import('/scripts/lib/spring-sector-contact.mjs');
    document.body.innerHTML = '<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-083-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();
    const e = new MovementEngine(document.querySelector('#stage'), catalog.movements[82], {playing: false});
    cancelAnimationFrame(e.animationFrame); e.animationFrame = 0; e.scene.remove(e.model.root);
    e.model.root.traverse(o => {o.geometry?.dispose(); if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material?.dispose();});
    e.model = makeSpringSectorGuidedCandidate(); e.scene.add(e.model.root); e.updateGroundClearance();
    const data = input ? await (await fetch('/' + input)).json() : null;
    const physics = data ? (await import('/scripts/lib/spring-sector-dynamics.mjs')).makeSpringSectorDynamics(e.model, data.parameters) : null;
    window.springSectorCandidate = {engine: e, contact: makeSpringSectorContact(e.model), data, physics};
  }, {input});
  const frames = [['source', [0, 0, 10], 0, .25], ['source-overlay', [0, 0, 10], 0, .25],
    ['oblique', [4, 3, 10], 0, .25], ['rear', [-4, 3, -10], 0, .75], ['negative-angle', [0, 0, 10], -.22, 0],
    ['positive-angle', [0, 0, 10], .22, .5], ['guide-detail', [1, 0, -1], 0, .25],
    ...(input ? [.125, .375, .625, .875, 1].map(phase => ['cycle-' + phase, [0, 0, 10], 0, phase]) : [])];
  for (const [name, direction, shaftAngle, phase] of frames) {
    const state = await page.evaluate(async ({name, direction, shaftAngle, phase}) => {
      const {THREE: {Vector3, OrthographicCamera}} = await import('/scripts/lib/spring-sector-candidate.mjs');
      const {engine: e, contact, data, physics} = window.springSectorCandidate; document.querySelector('#overlay')?.remove();
      let supplied, row;
      if (data) {
        const time = data.rows.at(-1).time - data.parameters.period + phase * data.parameters.period;
        row = data.rows.reduce((a, b) => Math.abs(a.time - time) < Math.abs(b.time - time) ? a : b);
        supplied = {shaftAngle: physics.input(row.time).q, wheelAngle: row.x[0], lifts: row.x.slice(1)};
      } else {
        const wheelAngle = .07233930452344918;
        supplied = {shaftAngle, wheelAngle, lifts: [0, 1].map(side => contact.seat(shaftAngle, wheelAngle, side, {lower: -.06, upper: .18}).lift)};
      }
      e.model.setState(supplied); e.fitCamera(new Vector3(...direction)); let camera = e.camera;
      if (name.startsWith('source')) {
        const p = e.model.root.userData.source, h = Math.max(1250, 1120 * 720 / 726) / p.scale, w = h * 726 / 720;
        const cx = (560 - p.center[0]) / p.scale, cy = (p.center[1] - 625) / p.scale;
        camera = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, .01, 100);
        camera.position.set(cx, cy, 10); camera.lookAt(cx, cy, 0); camera.updateMatrixWorld();
      }
      if (name === 'guide-detail') {
        const target = new Vector3(0, -.4, e.model.root.userData.geometry.wheelPitchRadius - .15);
        camera = new OrthographicCamera(-.75, .75, .75 * 720 / 726, -.75 * 720 / 726, .01, 100);
        camera.position.copy(target).add(new Vector3(-.9, .35, -1.5)); camera.lookAt(target); camera.updateMatrixWorld();
      }
      e.renderer.render(e.scene, camera);
      if (name === 'source-overlay') {
        const overlay = document.createElement('img'); overlay.id = 'overlay'; overlay.src = '/artifacts/reference/brown-083-detail.png';
        overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';
        document.querySelector('#stage').append(overlay); await overlay.decode();
      }
      document.querySelector('#title').textContent = '083 · ' + (data ? 'contact dynamics' : 'seated geometry') + ' study · ' + name;
      return {...e.model.root.userData.state, ...(row ? {time: row.time, x: row.x, v: row.v} : {})};
    }, {name, direction, shaftAngle, phase});
    const file = prefix + '-' + name + '.png'; assert(!fs.existsSync(file)); await page.screenshot({path: file});
    views.push({file, name, direction, state, sha256: hash(file), inspected: false});
  }
  for (const source of sources) assert.equal(hash(source.file), source.sha256, source.file);
  for (const [file, expected] of Object.entries(frozen)) assert.equal(hash(file), expected, file);
  const knownWarnings = [
    {pattern: /^THREE.Clock: This module has been deprecated\./, reason: 'Existing production engine clock deprecation.'},
    {pattern: /^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./, reason: 'Existing production shadow-map deprecation.'},
    {pattern: /^\[.WebGL-.*GPU stall due to ReadPixels/, reason: 'Chrome screenshot readback performance notice.'},
  ];
  const classifiedWarnings = warnings.map(text => ({text, reason: knownWarnings.find(w => w.pattern.test(text))?.reason ?? null}));
  const unexpectedWarnings = classifiedWarnings.filter(w => !w.reason);
  fs.writeFileSync(prefix + '-captures.json', JSON.stringify({movement: 83, productionChanged: false, mechanicsPassed: false,
    input, sources, freezeFile, frozenProductionInputsMatched: Object.keys(frozen).length, views, errors, classifiedWarnings, unexpectedWarnings}, null, 2) + '\n', {flag: 'wx'});
  console.log({views: views.length, errors, classifiedWarnings, unexpectedWarnings});
  assert.equal(errors.length, 0); assert.equal(unexpectedWarnings.length, 0);
} finally {await browser.close();}
