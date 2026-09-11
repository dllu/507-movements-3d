import fs from 'node:fs';
import crypto from 'node:crypto';
import {chromium} from 'playwright';
const input = process.env.PROBE_INPUT ?? 'artifacts/review/082-source-seat-dynamics.json';
const prefix = process.env.PROBE_PREFIX ?? '082-contact-motion';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = [input, 'scripts/capture-treadle-ratchet-motion.mjs', 'scripts/lib/treadle-ratchet-candidate.mjs',
  'scripts/lib/treadle-ratchet-linkage.mjs', 'scripts/lib/treadle-ratchet-source.mjs',
  'src/simulation/engine.js', 'src/simulation/finite-plate-geometry.js', 'src/simulation/primitives.js'];
const hashes = Object.fromEntries(files.map(file => [file, hash(file)]));
const data = JSON.parse(fs.readFileSync(input));
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1500, height: 800}}), views = [], errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async ({input}) => {
    const {MovementEngine} = await import('/src/simulation/engine.js');
    const {default: catalog} = await import('/src/data/movements.json');
    const {makeTreadleRatchetCandidate} = await import('/scripts/lib/treadle-ratchet-candidate.mjs');
    const data = await (await fetch('/' + input)).json();
    document.body.innerHTML = '<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-082-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();
    const e = new MovementEngine(document.querySelector('#stage'), catalog.movements[81], {playing: false});
    cancelAnimationFrame(e.animationFrame); e.animationFrame = 0; e.scene.remove(e.model.root);
    e.model.root.traverse(o => {o.geometry?.dispose(); if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material?.dispose();});
    e.model = makeTreadleRatchetCandidate(data.geometry); e.scene.add(e.model.root); e.updateGroundClearance();
    window.treadleMotion = {engine: e, data};
  }, {input});
  const end = data.rows.at(-1).time, cycleStart = Math.max(data.rows[0].time, end - 4);
  const frames = [['source-start', 0, [0, 0, 10]], ['source-overlay', 0, [0, 0, 10]],
    ...Array.from({length: 9}, (_, i) => ['cycle-' + i, cycleStart + i / 2, [0, 0, 10]]),
    ['oblique', cycleStart + 1, [-4, 3, 10]], ['rear', cycleStart + 3, [4, 3, -10]]];
  for (const [name, time, direction] of frames) {
    const state = await page.evaluate(async ({name, time, direction}) => {
      const {Vector3, OrthographicCamera} = await import('/node_modules/three/build/three.module.js');
      const {engine: e, data} = window.treadleMotion;
      const row = data.rows.reduce((a, b) => Math.abs(a.time - time) < Math.abs(b.time - time) ? a : b);
      document.querySelector('#overlay')?.remove();
      e.model.setState({time: row.time, wheelAngle: row.x[0], pawlAngles: row.x.slice(1)});
      e.fitCamera(new Vector3(...direction)); let camera = e.camera;
      if (name.startsWith('source-')) {
        const p = e.model.root.userData.geometry.source, h = Math.max(1250, 1350 * 720 / 726) / p.scale, w = h * 726 / 720;
        const cx = (675 - p.center[0]) / p.scale, cy = (p.center[1] - 625) / p.scale;
        camera = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, .01, 100);
        camera.position.set(cx, cy, 10); camera.lookAt(cx, cy, 0); camera.updateMatrixWorld();
      }
      e.renderer.render(e.scene, camera);
      if (name === 'source-overlay') {
        const overlay = document.createElement('img'); overlay.id = 'overlay'; overlay.src = '/artifacts/reference/brown-082-detail.png';
        overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';
        document.querySelector('#stage').append(overlay); await overlay.decode();
      }
      document.querySelector('#title').textContent = '082 · contact dynamics study · ' + name + ' · ' + row.time.toFixed(3) + ' s';
      return {time: row.time, x: row.x};
    }, {name, time, direction});
    const file = 'artifacts/review/' + prefix + '-' + name + '.png';
    if (fs.existsSync(file)) throw Error('Existing capture ' + file);
    await page.screenshot({path: file}); views.push({file, name, ...state, sha256: hash(file), inspected: false});
  }
  for (const [file, expected] of Object.entries(hashes)) if (hash(file) !== expected) throw Error('Source changed: ' + file);
  fs.writeFileSync('artifacts/review/' + prefix + '-captures.json', JSON.stringify({movement: 82, productionChanged: false,
    mechanicsPassed: false, input, hashes, views, errors}, null, 2) + '\n', {flag: 'wx'});
  console.log({views: views.length, errors});
} finally {await browser.close();}
