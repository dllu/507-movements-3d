import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';

const inputs = JSON.parse(process.env.PROBE_INPUTS ?? '["artifacts/review/083-slower-drive-dynamics.json","artifacts/review/083-slower-drive-finer-dynamics.json"]');
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-slower-drive-refinement';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const data = inputs.map(file => JSON.parse(fs.readFileSync(file))), model = makeSpringSectorCandidate(), u = model.root.userData;
const targetPixels = .25, comparisons = [];
assert(data.length >= 2);
let wheelRadius = 0;
for (const [name, mesh] of Object.entries(u.parts)) if (u.families[name] === 'wheel') {
  mesh.updateMatrix();
  for (const t of surfaceTriangles(mesh.geometry)) for (const p of [t.a, t.b, t.c]) {
    p.applyMatrix4(mesh.matrix); wheelRadius = Math.max(wheelRadius, Math.hypot(p.x, p.z));
  }
}
for (const d of data) {
  assert.equal(d.failures.length, 0);
  for (const s of d.sources) assert.equal(hash(s.file), s.sha256, s.file);
  assert.deepEqual(d.parameters, data[0].parameters);
  assert.deepEqual(d.rows[0], data[0].rows[0]);
  assert(Math.abs(d.rows.at(-1).time - data[0].rows.at(-1).time) < 1e-8);
}
for (let pair = 1; pair < data.length; pair++) {
  const a = data[pair - 1], b = data[pair]; assert(b.dt < a.dt);
  const times = [...new Set([...a.rows.map(r => r.time), ...b.rows.map(r => r.time)])].sort((a, b) => a - b);
  const pointers = [0, 0], bodies = ['wheel', 'frontSector', 'rearSector'].map(family => ({family, maximumPixels: 0}));
  const sample = (d, time, index) => {
    while (pointers[index] + 1 < d.rows.length - 1 && d.rows[pointers[index] + 1].time < time) pointers[index]++;
    const A = d.rows[pointers[index]], B = d.rows[pointers[index] + 1], f = Math.max(0, Math.min(1, (time - A.time) / (B.time - A.time)));
    return A.x.map((v, i) => v + f * (B.x[i] - v));
  };
  for (const time of times) {
    const x = sample(a, time, 0), y = sample(b, time, 1);
    for (let i = 0; i < 3; i++) {
      const difference = Math.abs(x[i] - y[i]), pixels = difference * u.source.scale * (i === 0 ? wheelRadius : 1);
      if (pixels > bodies[i].maximumPixels) Object.assign(bodies[i], {maximumPixels: pixels, time, coordinateDifference: difference});
    }
  }
  comparisons.push({coarse: inputs[pair - 1], fine: inputs[pair], coarseStep: a.dt, fineStep: b.dt,
    unionKnots: times.length, bodies, maximumPixels: Math.max(...bodies.map(b => b.maximumPixels))});
}
const files = [...inputs, 'scripts/compare-spring-sector-dynamics.mjs', 'scripts/lib/spring-sector-candidate.mjs', 'tests/helpers/solid-surface.mjs'];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const report = {movement: 83, status: 'observed-free-coordinate-time-step-agreement', productionChanged: false, mechanicsPassed: false,
  passed: comparisons.at(-1).maximumPixels <= targetPixels, targetPixels, wheelRadius, comparisons, sources,
  qualification: 'Union knots bound differences between piecewise-linear free coordinates. Actual wheel mesh radius bounds angular displacement; radial sector displacement is exactly the lift difference because prescribed shaft motion is identical. This is observed agreement, not a continuum error bound or complete spring/hardware displacement bound.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined}); if (!report.passed) process.exitCode = 1;
