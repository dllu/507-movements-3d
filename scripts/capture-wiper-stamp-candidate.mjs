import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readStudyReport, freezeStudySources, hashStudyFile, verifyStudySources} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/085-first-candidate';
const input = process.env.PROBE_INPUT ?? 'artifacts/review/085-eighth-ms-corrected-dynamics.json.gz';
const trajectory = readStudyReport(input); verifyStudySources(trajectory.sources);
const frozen = JSON.parse(fs.readFileSync('artifacts/review/084-integrated-source-hashes.json'));
const verifyProduction = () => {for (const [file, sha] of Object.entries(frozen)) assert.equal(hashStudyFile(file), sha, file);};
verifyProduction();
const sources = freezeStudySources(['scripts/capture-wiper-stamp-candidate.mjs', 'scripts/lib/wiper-stamp-candidate.mjs',
  'scripts/lib/wiper-stamp-source.mjs', 'src/simulation/conforming-plate-mesh.js', 'scripts/lib/study-report-io.mjs', 'src/simulation/engine.js',
  'src/simulation/finite-plate-geometry.js', 'src/simulation/clutch-section-geometry.js', 'src/simulation/primitives.js',
  'artifacts/reference/brown-085-detail.png', input, ...trajectory.sources.map(s => s.file)], prefix);
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1500, height: 800}}), errors = [], warnings = [], views = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {if (['warning', 'error'].includes(message.type())) warnings.push(message.text());});
try {
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async () => {
    const {MovementEngine} = await import('/src/simulation/engine.js');
    const {default: catalog} = await import('/src/data/movements.json');
    const {makeWiperStampCandidate} = await import('/scripts/lib/wiper-stamp-candidate.mjs');
    document.body.innerHTML = '<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-085-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();
    const e = new MovementEngine(document.querySelector('#stage'), catalog.movements[84], {playing: false});
    cancelAnimationFrame(e.animationFrame); e.animationFrame = 0; e.scene.remove(e.model.root);
    e.model.root.traverse(o => {o.geometry?.dispose(); if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material?.dispose();});
    e.model = makeWiperStampCandidate(); e.scene.add(e.model.root); e.updateGroundClearance(); window.wiperCandidate = e;
  });
  const pose = time => trajectory.rows[Math.round(time/trajectory.step)];
  const peak = trajectory.rows.reduce((best, row) => row.stampY > best.stampY ? row : best, trajectory.rows[0]);
  for (const [name, direction, state] of [['source', [0, 0, 10], {}], ['source-overlay', [0, 0, 10], {}],
    ['oblique', [4, 3, 10], {}], ['rear', [-4, 3, -10], {}], ['contact-detail', [0, 0, 10], pose(.12)],
    ['first-release', [0, 0, 10], pose(.25)], ['impact', [0, 0, 10], pose(.45)],
    ['second-lift', [0, 0, 10], pose(2)], ['maximum-lift', [0, 0, 10], peak], ['second-fall', [0, 0, 10], pose(2.2)]]) {
    const result = await page.evaluate(async ({name, direction, state}) => {
      const {THREE: {Vector3, OrthographicCamera}} = await import('/scripts/lib/wiper-stamp-candidate.mjs');
      const e = window.wiperCandidate, p = e.model.root.userData.source;
      document.querySelector('#overlay')?.remove(); e.model.setState(state); e.fitCamera(new Vector3(...direction)); let camera = e.camera;
      if (name.startsWith('source') || name === 'unused') {
        const h = Math.max(1350, 1220 * 720 / 726) / p.scale, w = h * 726 / 720;
        const cx = (610 - p.center[0]) / p.scale, cy = (p.center[1] - 675) / p.scale;
        camera = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, .01, 100);
        camera.position.set(cx, cy, 10); camera.lookAt(cx, cy, 0); camera.updateMatrixWorld();
      }
      if (name === 'contact-detail') {
        const target = new Vector3(-.25, .3, .05);
        camera = new OrthographicCamera(-.85, .85, .85 * 720 / 726, -.85 * 720 / 726, .01, 100);
        camera.position.copy(target).add(new Vector3(0, 0, 8)); camera.lookAt(target); camera.updateMatrixWorld();
      }
      e.renderer.render(e.scene, camera);
      if (name === 'source-overlay') {
        const image = document.createElement('img'); image.id = 'overlay'; image.src = '/artifacts/reference/brown-085-detail.png';
        image.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';
        document.querySelector('#stage').append(image); await image.decode();
      }
      document.querySelector('#title').textContent = '085 · finite geometry study · ' + name;
      return e.model.root.userData.state;
    }, {name, direction, state});
    const file = prefix + '-' + name + '.png'; assert(!fs.existsSync(file)); await page.screenshot({path: file});
    views.push({file, name, direction, state: result, sha256: hashStudyFile(file), inspected: false});
  }
  verifyProduction(); verifyStudySources(sources);
  const known = [/^THREE.Clock: This module has been deprecated\./, /^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./,
    /^\[.WebGL-.*GPU stall due to ReadPixels/];
  const unexpectedWarnings = warnings.filter(w => !known.some(pattern => pattern.test(w)));
  fs.writeFileSync(prefix + '-captures.json', JSON.stringify({movement: 85, productionChanged: false, mechanicsPassed: false,
    candidateIntegrated: false, views, errors, warnings, unexpectedWarnings, sources, frozenProductionInputsMatched: Object.keys(frozen).length}, null, 2) + '\n', {flag: 'wx'});
  console.log({views: views.length, errors, unexpectedWarnings});
  assert.equal(errors.length, 0); assert.equal(unexpectedWarnings.length, 0);
} finally {await browser.close();}
