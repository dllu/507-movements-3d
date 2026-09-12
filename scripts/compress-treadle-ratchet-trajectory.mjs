import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeTreadleRatchetCandidate} from './lib/treadle-ratchet-candidate.mjs';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/082-startup-sixteenth-ms-dynamics.json';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/082-sixteenth-ms-compressed';
const epsilon = Number(process.env.PROBE_EPSILON ?? 1e-7), data = JSON.parse(fs.readFileSync(input));
assert(data.failures.length === 0 && data.rows.length > 1 && epsilon > 0 && epsilon <= 1e-7);
const candidate = makeTreadleRatchetCandidate(data.geometry), u = candidate.root.userData;
const radii = ['wheel', 'lowerPawl', 'upperPawl'].map(family => {
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
const raw = data.rows.map(row => [row.time, ...row.x]), rows = [raw[0]];
let start = 0, index = 1, low = [-Infinity, -Infinity, -Infinity], high = [Infinity, Infinity, Infinity];
while (index < raw.length) {
  const a = raw[start], b = raw[index], dt = b[0] - a[0]; assert(dt > 0);
  const slope = b.slice(1).map((v, i) => (v - a[i + 1]) / dt);
  if (!slope.every((v, i) => v >= low[i] && v <= high[i])) {
    assert(index - 1 > start); start = index - 1; rows.push(raw[start]);
    low = [-Infinity, -Infinity, -Infinity]; high = [Infinity, Infinity, Infinity]; continue;
  }
  for (let i = 0; i < 3; i++) {low[i] = Math.max(low[i], slope[i] - epsilon / dt); high[i] = Math.min(high[i], slope[i] + epsilon / dt);}
  index++;
}
if (rows.at(-1) !== raw.at(-1)) rows.push(raw.at(-1));
let segment = 0; const errors = [0, 0, 0];
for (const row of raw) {
  while (segment + 1 < rows.length - 1 && rows[segment + 1][0] < row[0]) segment++;
  const a = rows[segment], b = rows[segment + 1], f = (row[0] - a[0]) / (b[0] - a[0]);
  row.slice(1).forEach((v, i) => {errors[i] = Math.max(errors[i], Math.abs(v - a[i + 1] - f * (b[i + 1] - a[i + 1])));});
}
assert(errors.every(e => e <= epsilon + 1e-13));
const files = [input, 'scripts/compress-treadle-ratchet-trajectory.mjs', 'scripts/lib/treadle-ratchet-candidate.mjs',
  'scripts/lib/treadle-ratchet-linkage.mjs', 'scripts/lib/treadle-ratchet-source.mjs'];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const maximumPixels = Math.max(...errors.map((v, i) => 2 * radii[i] * Math.sin(v / 2) * u.geometry.source.scale));
const trajectory = {movement: 82, status: 'compressed-study-trajectory', productionChanged: false, mechanicsPassed: false,
  geometry: data.geometry, parameters: data.parameters, dt: null, duration: rows.at(-1)[0] - rows[0][0], failures: [],
  rows: rows.map(r => ({time: r[0], x: r.slice(1)})), sources,
  qualification: 'A compressed free-angle interpolant over the original time domain with unchanged endpoint states. The prescribed linkage keeps its exact time dependence. No periodic seam, state reset or final playback policy is introduced. Contact clearance and dynamical time-step agreement require separate checks.'};
const output = prefix + '-trajectory.json'; fs.writeFileSync(output, JSON.stringify(trajectory) + '\n', {flag: 'wx'});
const report = {movement: 82, passed: true, productionChanged: false, mechanicsPassed: false, status: 'trajectory-compression-check',
  rawStates: raw.length, knots: rows.length, epsilon, maximumAngleErrors: errors, maximumPixels,
  output: {file: output, sha256: crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex')}, sources,
  qualification: 'Retained knots are a subset of the raw time grid. Checking every raw knot bounds the angle difference everywhere between both linear interpolants. Actual mesh radii convert this to a free-body displacement bound. This checks compression only.'};
fs.writeFileSync(prefix + '-check.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined});
