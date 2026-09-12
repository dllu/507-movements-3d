import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-reviewed-candidate';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const freezeFile = 'artifacts/review/083-shadow-source-hashes.json', frozen = JSON.parse(fs.readFileSync(freezeFile));
for (const [file, expected] of Object.entries(frozen)) assert.equal(hash(file), expected, file);
const sources = ['scripts/capture-spring-sector-candidate.mjs', 'scripts/lib/spring-sector-candidate.mjs',
  'scripts/lib/spring-sector-source.mjs', 'src/simulation/engine.js', 'src/simulation/finite-plate-geometry.js',
  'src/simulation/primitives.js', 'artifacts/reference/brown-083-detail.png'].map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1500, height: 800}}), views = [], errors = [], warnings = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => {if (['warning', 'error'].includes(m.type())) warnings.push(m.text());});
try {
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async () => {
    const {MovementEngine} = await import('/src/simulation/engine.js');
    const {default: catalog} = await import('/src/data/movements.json');
    const {makeSpringSectorCandidate} = await import('/scripts/lib/spring-sector-candidate.mjs');
    document.body.innerHTML = '<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-083-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();
    const e = new MovementEngine(document.querySelector('#stage'), catalog.movements[82], {playing: false});
    cancelAnimationFrame(e.animationFrame); e.animationFrame = 0; e.scene.remove(e.model.root);
    e.model.root.traverse(o => {o.geometry?.dispose(); if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material?.dispose();});
    e.model = makeSpringSectorCandidate(); e.scene.add(e.model.root); e.updateGroundClearance(); window.springSectorCandidate = e;
  });
  for (const [name, direction] of [['source', [0, 0, 10]], ['source-overlay', [0, 0, 10]], ['oblique', [4, 3, 10]], ['rear', [-4, 3, -10]]]) {
    const state = await page.evaluate(async ({name, direction}) => {
      const {THREE: {Vector3, OrthographicCamera}} = await import('/scripts/lib/spring-sector-candidate.mjs');
      const e = window.springSectorCandidate; document.querySelector('#overlay')?.remove();
      e.model.setState(); e.fitCamera(new Vector3(...direction)); let camera = e.camera;
      if (name.startsWith('source')) {
        const p = e.model.root.userData.source, h = Math.max(1250, 1120 * 720 / 726) / p.scale, w = h * 726 / 720;
        const cx = (560 - p.center[0]) / p.scale, cy = (p.center[1] - 625) / p.scale;
        camera = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, .01, 100);
        camera.position.set(cx, cy, 10); camera.lookAt(cx, cy, 0); camera.updateMatrixWorld();
      }
      e.renderer.render(e.scene, camera);
      if (name === 'source-overlay') {
        const overlay = document.createElement('img'); overlay.id = 'overlay'; overlay.src = '/artifacts/reference/brown-083-detail.png';
        overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';
        document.querySelector('#stage').append(overlay); await overlay.decode();
      }
      document.querySelector('#title').textContent = '083 · static geometry study · ' + name;
      return e.model.root.userData.state;
    }, {name, direction});
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
    sources, freezeFile, frozenProductionInputsMatched: Object.keys(frozen).length, views, errors, classifiedWarnings, unexpectedWarnings}, null, 2) + '\n', {flag: 'wx'});
  console.log({views: views.length, errors, classifiedWarnings, unexpectedWarnings});
  assert.equal(errors.length, 0); assert.equal(unexpectedWarnings.length, 0);
} finally {await browser.close();}
