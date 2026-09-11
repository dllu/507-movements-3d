import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {makeTreadleRatchetCandidate} from './lib/treadle-ratchet-candidate.mjs';
import {solidSurface, surfacePoints} from '../tests/helpers/solid-surface.mjs';
const input = process.env.PROBE_INPUT ?? 'artifacts/review/082-preloaded-dynamics.json';
const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/082-first-motion-surfaces.json';
const data = JSON.parse(fs.readFileSync(input)), candidate = makeTreadleRatchetCandidate(data.geometry), u = candidate.root.userData;
const count = Number(process.env.PROBE_POSES ?? 13), names = Object.keys(u.parts), cache = new Map();
for (const name of names) if (name !== 'strap') {
  const g = u.parts[name].geometry;
  cache.set(name, {solid: solidSurface(g), points: surfacePoints(g)});
}
const pairs = [];
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
  const a = names[i], b = names[j];
  if (u.families[a] === u.families[b]) continue;
  // The eye tabs are bonded to the deforming strap at its two ends.
  if ((a === 'strap' && b.endsWith('StrapEye')) || (b === 'strap' && a.endsWith('StrapEye'))) continue;
  pairs.push({a, b, checks: 0, intrusions: 0, maximumDepth: 0, poses: []});
}
let checks = 0, intrusions = 0;
for (let i = 0; i < count; i++) {
  const row = data.rows[Math.round(i * (data.rows.length - 1) / (count - 1))];
  candidate.setState({time: row.time, wheelAngle: row.x[0], pawlAngles: row.x.slice(1)});
  cache.set('strap', {solid: solidSurface(u.parts.strap.geometry), points: surfacePoints(u.parts.strap.geometry)});
  const bounds = Object.fromEntries(names.map(name => [name, cache.get(name).solid.box.clone().applyMatrix4(u.parts[name].matrixWorld)]));
  for (const pair of pairs) {
    if (!bounds[pair.a].intersectsBox(bounds[pair.b])) continue;
    let found = false;
    for (const [sample, target] of [[pair.a, pair.b], [pair.b, pair.a]]) {
      const matrix = u.parts[target].matrixWorld.clone().invert().multiply(u.parts[sample].matrixWorld);
      const {solid} = cache.get(target);
      for (const p of cache.get(sample).points) {
        pair.checks++; checks++;
        const q = p.clone().applyMatrix4(matrix);
        if (!solid.inside(q)) continue;
        const depth = solid.distance(q);
        if (depth <= 1e-6) continue;
        pair.intrusions++; intrusions++; found = true;
        pair.maximumDepth = Math.max(pair.maximumDepth, depth);
      }
    }
    if (found) pair.poses.push(row.time);
  }
  console.log({pose: i + 1, time: row.time, checks, intrusions});
}
const files = [input, 'scripts/probe-treadle-ratchet-motion.mjs', 'scripts/lib/treadle-ratchet-candidate.mjs',
  'scripts/lib/treadle-ratchet-linkage.mjs', 'scripts/lib/treadle-ratchet-source.mjs', 'tests/helpers/solid-surface.mjs'];
const sources = files.map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt';
  fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report = {movement: 82, status: 'sampled-moving-solid-screen', productionChanged: false, mechanicsPassed: false,
  passed: intrusions === 0, poses: count, independentPairs: pairs.length, checks, intrusions, pairs, sources,
  qualification: 'Actual triangle vertices, edge midpoints and face centroids in both directions, with world-box pruning. All independent component pairs except rigidly connected families and bonded strap/eye joints. A sampled screen does not bound all surfaces or unsampled motion.'};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, pairs: pairs.filter(p => p.intrusions), sources: undefined});
if (!report.passed) process.exitCode = 1;
