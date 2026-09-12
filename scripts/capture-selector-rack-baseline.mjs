import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {hashStudyFile, freezeStudySources, verifyStudySources} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/084-baseline';
const freezeFile = 'artifacts/review/083-shadow-source-hashes.json';
const frozen = JSON.parse(fs.readFileSync(freezeFile));
const verifyProduction = () => {for (const [file, sha] of Object.entries(frozen)) assert.equal(hashStudyFile(file), sha, file);};
verifyProduction();
const sources = freezeStudySources(['scripts/capture-selector-rack-baseline.mjs', 'scripts/lib/study-report-io.mjs',
  'src/simulation/authored-intermittent.js', 'src/simulation/engine.js', 'src/simulation/primitives.js',
  'src/data/movements.json', 'artifacts/reference/brown-084-detail.png'], prefix);
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1500, height: 800}}), views = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async () => {
    const {MovementEngine} = await import('/src/simulation/engine.js');
    const {default: catalog} = await import('/src/data/movements.json');
    document.body.innerHTML = '<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-084-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();
    const e = new MovementEngine(document.querySelector('#stage'), catalog.movements[83], {playing: false});
    cancelAnimationFrame(e.animationFrame); e.animationFrame = 0; window.selectorRackBaseline = e;
  });
  for (const [name, phase, direction] of [['neutral', .35, [0, 0, 10]], ['lower-contact', .025, [0, 0, 10]],
    ['lower-end', .2, [0, 0, 10]], ['upper-contact', .525, [0, 0, 10]], ['upper-end', .7, [0, 0, 10]],
    ['neutral-return', .85, [0, 0, 10]], ['oblique', .025, [4, 3, 10]], ['rear', .525, [-4, 3, -10]]]) {
    const state = await page.evaluate(async ({name, phase, direction}) => {
      const {Vector3} = await import('/node_modules/three/build/three.module.js');
      const e = window.selectorRackBaseline, g = e.model.root.userData.geometry;
      const time = (phase - g.initialCyclePhase) / g.cyclesPerSecond;
      e.model.update(time); e.fitCamera(new Vector3(...direction)); e.renderer.render(e.scene, e.camera);
      document.querySelector('#title').textContent = '084 · existing baseline · ' + name;
      return {time, state: e.model.root.userData.stateAtTime(time)};
    }, {name, phase, direction});
    const file = prefix + '-' + name + '.png'; assert(!fs.existsSync(file));
    await page.screenshot({path: file}); views.push({file, name, phase, direction, ...state, sha256: hashStudyFile(file), inspected: false});
  }
  verifyProduction(); verifyStudySources(sources);
  fs.writeFileSync(prefix + '-captures.json', JSON.stringify({movement: 84, productionChanged: false, mechanicsPassed: false,
    freezeFile, frozenProductionInputsMatched: Object.keys(frozen).length, views, errors, sources}, null, 2) + '\n', {flag: 'wx'});
  console.log({views: views.length, errors}); if (errors.length) process.exitCode = 1;
} finally {await browser.close();}
