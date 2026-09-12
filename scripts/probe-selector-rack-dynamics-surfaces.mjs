import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeSelectorRackFreeCandidate} from './lib/selector-rack-free-candidate.mjs';
import {makeSelectorRackCandidate} from './lib/selector-rack-candidate.mjs';
import {makeSelectorRackDynamics} from './lib/selector-rack-dynamics.mjs';
import {surfacePoints, solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport, verifyStudySources, freezeStudySources} from './lib/study-report-io.mjs';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/084-planar-corrected-guide-pulses.json.gz';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/084-first-planar-surfaces';
const topologyFile = 'artifacts/review/084-supported-candidate-surfaces.json';
const data = readStudyReport(input), topology = readStudyReport(topologyFile);
verifyStudySources(data.sources); verifyStudySources(topology.sources); assert(topology.passed && topology.topology.every(p => p.closed));
const model = makeSelectorRackFreeCandidate(), base = makeSelectorRackCandidate(), u = model.root.userData, physics = makeSelectorRackDynamics(model, data.parameters);
const names = Object.keys(u.parts); assert.deepEqual(names, Object.keys(base.root.userData.parts));
for (const name of names) for (const attribute of Object.keys(u.parts[name].geometry.attributes))
  assert.deepEqual(u.parts[name].geometry.attributes[attribute].array, base.root.userData.parts[name].geometry.attributes[attribute].array);
const parts = names.map(name => ({name, mesh: u.parts[name], family: u.families[name], points: surfacePoints(u.parts[name].geometry), solid: solidSurface(u.parts[name].geometry)}));
const pairs = parts.flatMap((a, i) => parts.slice(i + 1).filter(b => a.family !== b.family).map(b => ({a, b, checks: 0, intrusions: 0, maximumDepth: 0, worst: null})));
const indices = new Set(Array.from({length: 101}, (_, i) => Math.round(i * (data.rows.length - 1) / 100)));
for (const axis of [0, 1, 2]) for (const sign of [-1, 1]) indices.add(data.rows.reduce((best, r, i) => sign * r.x[axis] > sign * data.rows[best].x[axis] ? i : best, 0));
for (let i = 1; i < data.rows.length; i++) if (data.rows[i].contacts.some(c => c.key === 'cam') !== (data.rows[i - 1].contacts ?? []).some(c => c.key === 'cam')) {indices.add(i); indices.add(i - 1);}
let boxExclusions = 0;
for (const index of [...indices].sort((a, b) => a - b)) {
  const r = data.rows[index], k = physics.input(r.time);
  model.setState({camAngle: k.camAngle, selectorY: k.selectorY, center: r.x.slice(0, 2), frameAngle: r.x[2]});
  for (const part of parts) part.box = part.solid.box.clone().applyMatrix4(part.mesh.matrixWorld);
  for (const pair of pairs) {
    if (!pair.a.box.intersectsBox(pair.b.box)) {boxExclusions++; continue;}
    for (const [a, b] of [[pair.a, pair.b], [pair.b, pair.a]]) {
      const matrix = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for (const point of a.points) {
        pair.checks++; const local = point.clone().applyMatrix4(matrix); if (!b.solid.inside(local)) continue;
        const depth = b.solid.distance(local); if (depth <= 1e-6) continue; pair.intrusions++;
        if (depth > pair.maximumDepth) {pair.maximumDepth = depth; pair.worst = {index, time: r.time, sampleOn: a.name, inside: b.name, local: local.toArray()};}
      }
    }
  }
}
const result = pairs.map(({a, b, ...p}) => ({a: a.name, b: b.name, ...p}));
const sources = freezeStudySources([input, topologyFile, 'scripts/probe-selector-rack-dynamics-surfaces.mjs', ...data.sources.map(s => s.file)], prefix);
const report = {movement: 84, passed: result.every(p => !p.intrusions), productionChanged: false, mechanicsPassed: false, input,
  meshes: parts.length, pairs: result, pairCount: pairs.length, poses: indices.size, indices: [...indices].sort((a, b) => a - b),
  checks: result.reduce((s, p) => s + p.checks, 0), intrusions: result.reduce((s, p) => s + p.intrusions, 0), maximumDepth: Math.max(...result.map(p => p.maximumDepth)),
  boxExclusions, originalClosedGeometryBuffersMatch: true, sources,
  qualification: 'All pairs of independently moving families are checked bidirectionally at uniform times, extrema of all three free coordinates and every saved cam engagement/release. The free wrapper preserves all closed part buffers. These finite-surface samples do not certify the continuous path between poses.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, pairs: result.filter(p => p.intrusions), indices: undefined, sources: undefined}); if (!report.passed) process.exitCode = 1;
