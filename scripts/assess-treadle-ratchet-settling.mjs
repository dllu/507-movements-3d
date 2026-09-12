import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeTreadleRatchetCandidate} from './lib/treadle-ratchet-candidate.mjs';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/082-settling-study.json';
const inputs = JSON.parse(process.env.PROBE_INPUTS ?? JSON.stringify([input]));
const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/082-settling-recurrence.json';
assert(inputs.length > 0);
const chunks = inputs.map(file => JSON.parse(fs.readFileSync(file)));
for (let i = 0; i < chunks.length; i++) {
  const chunk = chunks[i]; assert.equal(chunk.failures.length, 0);
  assert.deepEqual(chunk.geometry, chunks[0].geometry); assert.deepEqual(chunk.parameters, chunks[0].parameters);
  assert.equal(chunk.dt, chunks[0].dt);
  if (i) for (const field of ['time', 'x', 'v']) assert.deepEqual(chunk.rows[0][field], chunks[i - 1].rows.at(-1)[field], 'Continuation must carry the complete previous state');
}
const data = {...chunks[0], rows: chunks.flatMap((chunk, i) => i ? chunk.rows.slice(1) : chunk.rows)};
const candidate = makeTreadleRatchetCandidate(data.geometry), u = candidate.root.userData;
const inputCycles = Number(process.env.PROBE_INPUT_CYCLES ?? 2), teeth = 2.5 * inputCycles;
assert(Number.isInteger(inputCycles) && inputCycles > 0 && Number.isInteger(teeth), 'The candidate recurrence must span an integral number of teeth and input cycles');
const period = inputCycles * u.linkage.parameters.period, turn = teeth * 2 * Math.PI / u.geometry.source.ratchet.teeth;
const families = ['wheel', 'lowerPawl', 'upperPawl'], radii = families.map(family => {
  let radius = 0;
  for (const [name, mesh] of Object.entries(u.parts)) if (u.families[name] === family) {
    mesh.updateMatrix(); const p = mesh.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrix);
      radius = Math.max(radius, Math.hypot(v.x, v.y));
    }
  }
  return radius;
});
assert.equal(data.failures.length, 0);
assert(data.rows.length > 1);
for (let i = 0; i < data.rows.length; i++) {
  const r = data.rows[i];
  assert(Number.isFinite(r.time) && r.x.length === 3 && r.v.length === 3 && [...r.x, ...r.v].every(Number.isFinite));
  if (i) assert(r.time > data.rows[i - 1].time);
}
const sample = time => {
  assert(time >= data.rows[0].time - 1e-8 && time <= data.rows.at(-1).time + 1e-8);
  let lo = 0, hi = data.rows.length - 1;
  while (hi - lo > 1) {const mid = (lo + hi) >> 1; if (data.rows[mid].time <= time) lo = mid; else hi = mid;}
  const a = data.rows[lo], b = data.rows[hi], f = Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time)));
  return Object.fromEntries(['x', 'v'].map(key => [key, a[key].map((v, i) => v + f * (b[key][i] - v))]));
};
const differences = (a, b) => ({
  pixels: a.x.map((v, i) => 2 * radii[i] * Math.sin(Math.min(Math.PI, Math.abs(b.x[i] - v - (i === 0 ? turn : 0))) / 2) * u.geometry.source.scale),
  velocity: a.v.map((v, i) => Math.abs(b.v[i] - v)),
});
const comparisons = [];
for (let start = Math.ceil((data.rows[0].time - 1e-8) / u.linkage.parameters.period) * u.linkage.parameters.period;
  start + 2 * period <= data.rows.at(-1).time + 1e-8; start += period) {
  const end = start + period;
  const times = [...new Set([start, end, ...data.rows.flatMap(r => [r.time, r.time - period])
    .filter(time => time > start && time < end)])].sort((a, b) => a - b);
  let maximumPixels = 0, witness;
  const maximumVelocityDifference = [0, 0, 0];
  for (const time of times) {
    const d = differences(sample(time), sample(time + period));
    for (let i = 0; i < 3; i++) {
      if (d.pixels[i] > maximumPixels) {maximumPixels = d.pixels[i]; witness = {time, family: families[i]};}
      maximumVelocityDifference[i] = Math.max(maximumVelocityDifference[i], d.velocity[i]);
    }
  }
  const a = sample(start), b = sample(start + period);
  comparisons.push({start, end, comparedStart: start + period, comparedEnd: start + 2 * period,
    unionKnots: times.length, maximumPixels, witness, maximumVelocityDifference,
    seam: differences(a, b), advancedTeethAtSeam: (b.x[0] - a.x[0]) / (turn / teeth)});
}
assert(comparisons.length > 0, 'At least two complete candidate cycles are required');
const files = [...inputs, 'scripts/assess-treadle-ratchet-settling.mjs', 'scripts/lib/treadle-ratchet-candidate.mjs',
  'scripts/lib/treadle-ratchet-linkage.mjs', 'scripts/lib/treadle-ratchet-source.mjs'];
const sources = files.map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report = {movement: 82, status: 'candidate-cycle-recurrence-assessment', productionChanged: false, mechanicsPassed: false,
  playbackQualified: false, inputs, period, teeth, inputCycles, dt: data.dt, comparisons, sources,
  qualification: `A ${period}-second, ${teeth}-tooth recurrence is tested over whole adjacent cycles, subtracting exactly ${teeth} pitches only from the wheel coordinate. Union knots bound differences between linearly interpolated free angles and stored velocities. The input linkage repeats exactly after ${inputCycles} prescribed periods. These trajectory comparisons do not qualify a playback seam or establish an exact periodic solution.`};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined});
