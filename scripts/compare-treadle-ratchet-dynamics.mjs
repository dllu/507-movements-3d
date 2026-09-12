import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeTreadleRatchetCandidate} from './lib/treadle-ratchet-candidate.mjs';
const inputs = JSON.parse(process.env.PROBE_INPUTS ?? '["artifacts/review/082-source-seat-dynamics.json","artifacts/review/082-source-seat-fine-dynamics.json","artifacts/review/082-source-seat-finer-dynamics.json"]');
const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/082-dynamics-refinement.json';
assert(inputs.length >= 2, 'At least two trajectories are needed for a refinement comparison');
const data = inputs.map(file => JSON.parse(fs.readFileSync(file))), candidate = makeTreadleRatchetCandidate(data[0].geometry), u = candidate.root.userData;
const families = ['wheel', 'lowerPawl', 'upperPawl'], radius = families.map(family => {
  let maximum = 0;
  for (const [name, mesh] of Object.entries(u.parts)) if (u.families[name] === family) {
    mesh.updateMatrix(); const p = mesh.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const q = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrix);
      maximum = Math.max(maximum, Math.hypot(q.x, q.y));
    }
  }
  return maximum;
});
for (const d of data) {
  assert.deepEqual(d.parameters, data[0].parameters); assert.deepEqual(d.geometry, data[0].geometry);
  assert(d.rows.length >= 2, 'A trajectory needs at least one interval');
  assert.equal(d.failures.length, 0); assert.deepEqual(d.rows[0].x, data[0].rows[0].x);
  assert.deepEqual(d.rows[0].v, data[0].rows[0].v);
  assert.equal(d.rows[0].time, data[0].rows[0].time);
  assert(Math.abs(d.rows.at(-1).time - data[0].rows.at(-1).time) < 1e-8);
  for (let i = 0; i < d.rows.length; i++) {
    const row = d.rows[i];
    assert(Number.isFinite(row.time) && row.x.length === 3 && row.x.every(Number.isFinite));
    if (i) assert(row.time > d.rows[i - 1].time, 'Saved times must increase strictly');
  }
}
const comparisons = [];
for (let i = 1; i < data.length; i++) {
  const coarse = data[i - 1], fine = data[i]; let maximumPixels = 0, witness;
  assert(fine.dt > 0 && fine.dt < coarse.dt, 'Order trajectories from coarser to finer steps');
  const times = [...new Set([...coarse.rows, ...fine.rows].map(row => row.time))].sort((a, b) => a - b), indices = [0, 0];
  const sample = (trajectory, which, time) => {
    while (indices[which] + 1 < trajectory.rows.length - 1 && trajectory.rows[indices[which] + 1].time < time) indices[which]++;
    const a = trajectory.rows[indices[which]], b = trajectory.rows[indices[which] + 1];
    const fraction = Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time)));
    return a.x.map((angle, j) => angle + fraction * (b.x[j] - angle));
  };
  const bodies = families.map(family => ({family, maximumPixels: 0}));
  for (const time of times) {
    const a = sample(coarse, 0, time), b = sample(fine, 1, time);
    for (let j = 0; j < 3; j++) {
      const difference = Math.abs(b[j] - a[j]);
      const pixels = 2 * radius[j] * Math.sin(Math.min(Math.PI, difference) / 2) * u.geometry.source.scale;
      if (pixels > bodies[j].maximumPixels) bodies[j] = {family: families[j], maximumPixels: pixels, time, angleDifference: difference};
      if (pixels > maximumPixels) {maximumPixels = pixels; witness = {time, family: families[j], angleDifference: difference};}
    }
  }
  comparisons.push({coarse: inputs[i - 1], fine: inputs[i], coarseStep: coarse.dt, fineStep: fine.dt,
    unionKnots: times.length, maximumPixels, bodies, witness});
}
const targetPixels = .25, last = comparisons.at(-1);
const decreasing = comparisons.length < 2 ? null : last.maximumPixels < comparisons.at(-2).maximumPixels;
const files = [...inputs, 'scripts/compare-treadle-ratchet-dynamics.mjs', 'scripts/lib/treadle-ratchet-candidate.mjs',
  'scripts/lib/treadle-ratchet-linkage.mjs', 'scripts/lib/treadle-ratchet-source.mjs'];
const sources = files.map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report = {movement: 82, status: 'observed-time-step-agreement', productionChanged: false, mechanicsPassed: false,
  passed: last.maximumPixels < targetPixels && decreasing !== false, targetPixels, decreasing, radius, comparisons, sources,
  qualification: 'The union of both saved time grids bounds the difference of their piecewise-linear angles. Actual maximum mesh radii convert those differences to bounds on rigid-body displacement between the interpolants. Prescribed linkage positions are identical at equal times. This is observed numerical agreement, not a bound on the exact continuum solution.'};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined});
if (!report.passed) process.exitCode = 1;
