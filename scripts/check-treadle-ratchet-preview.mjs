import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/082-thirtysecond-ms-compressed-trajectory.json';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/082-refined-live-preview';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = [input, 'scripts/check-treadle-ratchet-preview.mjs', 'scripts/lib/treadle-ratchet-candidate.mjs',
  'scripts/lib/treadle-ratchet-linkage.mjs', 'scripts/lib/treadle-ratchet-source.mjs',
  'src/simulation/engine.js', 'src/simulation/finite-plate-geometry.js', 'src/simulation/primitives.js'];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const data = JSON.parse(fs.readFileSync(input));
assert(data.failures.length === 0 && data.rows.length > 1);
const duration = data.rows.at(-1).time - data.rows[0].time;
assert(duration > 0 && duration <= 60, 'Use a finite preview of at most one minute');
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1500, height: 800}}), errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5174/#/about');
  const metrics = await page.evaluate(async ({input}) => {
    const {MovementEngine} = await import('/src/simulation/engine.js');
    const {default: catalog} = await import('/src/data/movements.json');
    const {makeTreadleRatchetCandidate} = await import('/scripts/lib/treadle-ratchet-candidate.mjs');
    const {Box3, Vector3} = await import('/node_modules/three/build/three.module.js');
    const data = await (await fetch('/' + input)).json();
    document.body.innerHTML = '<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-082-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();
    const e = new MovementEngine(document.querySelector('#stage'), catalog.movements[81], {playing: false});
    cancelAnimationFrame(e.animationFrame); e.animationFrame = 0; e.scene.remove(e.model.root);
    e.model.root.traverse(o => {
      o.geometry?.dispose();
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material?.dispose();
    });
    e.model = makeTreadleRatchetCandidate(data.geometry); e.scene.add(e.model.root);
    const first = data.rows[0].time, last = data.rows.at(-1).time;
    const sample = time => {
      let lo = 0, hi = data.rows.length - 1;
      while (hi - lo > 1) {const mid = (lo + hi) >> 1; if (data.rows[mid].time <= time) lo = mid; else hi = mid;}
      const a = data.rows[lo], b = data.rows[hi], f = Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time)));
      const x = a.x.map((v, i) => v + f * (b.x[i] - v));
      e.model.setState({time, wheelAngle: x[0], pawlAngles: x.slice(1)});
      return x;
    };
    // A fixed preview frame, sampled over its finite domain. The live check
    // below measures its actual rendered frames; this is not a swept bound.
    const envelope = new Box3(), samples = 601;
    for (let i = 0; i < samples; i++) {
      sample(first + (last - first) * i / (samples - 1));
      envelope.union(new Box3().setFromObject(e.model.root, true));
    }
    envelope.expandByScalar(.02); e.model.root.userData.cameraFitBounds = envelope;
    e.model.root.userData.sampledMotionBounds = {min: envelope.min.toArray(), max: envelope.max.toArray()};
    e.model.root.userData.sampledFloorY = envelope.min.y;
    sample(first); e.fitCamera(new Vector3(0, 0, 10)); e.updateGroundClearance();
    e.renderer.render(e.scene, e.camera);
    const frames = [], bounds = new Box3(); let previous, origin;
    let maximumProjectedExtent = 0, minimumFloorGap = Infinity;
    await new Promise(resolve => {
      const frame = now => {
        origin ??= now; const time = Math.min(last, first + (now - origin) / 1000);
        const begin = performance.now(), x = sample(time), updateMilliseconds = performance.now() - begin;
        e.renderer.render(e.scene, e.camera);
        bounds.setFromObject(e.model.root, true);
        minimumFloorGap = Math.min(minimumFloorGap, bounds.min.y - e.ground.position.y);
        for (const ix of ['min', 'max']) for (const iy of ['min', 'max']) for (const iz of ['min', 'max']) {
          const v = new Vector3(bounds[ix].x, bounds[iy].y, bounds[iz].z).project(e.camera);
          maximumProjectedExtent = Math.max(maximumProjectedExtent, Math.abs(v.x), Math.abs(v.y));
        }
        document.querySelector('#title').textContent = '082 · finite trajectory preview · ' + time.toFixed(3) + ' s';
        if (previous !== undefined) frames.push({time, intervalMilliseconds: now - previous, updateMilliseconds});
        previous = now;
        if (time < last) requestAnimationFrame(frame);
        else {window.treadlePreviewFinalState = {time, x}; resolve();}
      };
      requestAnimationFrame(frame);
    });
    const percentile = (key, fraction) => {
      const values = frames.map(f => f[key]).sort((a, b) => a - b);
      return values[Math.min(values.length - 1, Math.floor(values.length * fraction))];
    };
    return {startTime: first, endTime: last, duration: last - first, frames: frames.length,
      averageFramesPerSecond: frames.length / ((previous - origin) / 1000),
      medianFrameMilliseconds: percentile('intervalMilliseconds', .5), p95FrameMilliseconds: percentile('intervalMilliseconds', .95),
      p95UpdateMilliseconds: percentile('updateMilliseconds', .95), maximumProjectedExtent, minimumFloorGap,
      envelopeSamples: samples, final: window.treadlePreviewFinalState};
  }, {input});
  const image = prefix + '-end.png'; assert(!fs.existsSync(image)); await page.screenshot({path: image});
  for (const source of sources) assert.equal(hash(source.file), source.sha256, 'Source changed during preview: ' + source.file);
  const passed = !errors.length && metrics.frames >= 2 && metrics.maximumProjectedExtent <= 1
    && metrics.minimumFloorGap >= 0 && metrics.final.time === data.rows.at(-1).time;
  const report = {movement: 82, passed, productionChanged: false, mechanicsPassed: false,
    status: 'finite-trajectory-browser-preview', metrics, errors, sources,
    image: {file: image, sha256: hash(image), inspected: false},
    qualification: 'One real-time pass through the finite trajectory, without a repeated seam or a state reset. The prescribed input takes four seconds per cycle. Framing and floor checks cover the actual rendered frames only. Performance is diagnostic, not a production or mobile regression result.'};
  fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log({...report, sources: undefined}); if (!passed) process.exitCode = 1;
} finally {await browser.close();}
