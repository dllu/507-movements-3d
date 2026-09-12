import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeTreadleRatchetCandidate} from './lib/treadle-ratchet-candidate.mjs';

const trajectoryFile = process.env.PROBE_INPUT ?? 'artifacts/review/082-sixteenth-ms-compressed-trajectory.json';
const compressionFile = process.env.PROBE_COMPRESSION ?? 'artifacts/review/082-sixteenth-ms-compressed-check.json';
const secondaryFile = process.env.PROBE_SECONDARY ?? 'artifacts/review/082-secondary-continuous-bounds.json';
const primaryFile = process.env.PROBE_PRIMARY ?? 'artifacts/review/082-first-primary-continuous-bounds.json';
const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/082-compressed-complete-clearance.json';
const read = file => JSON.parse(fs.readFileSync(file)), hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const data = read(trajectoryFile), compression = read(compressionFile), secondary = read(secondaryFile), primary = read(primaryFile);
assert(compression.passed && secondary.passed && primary.passed);
assert.equal(compression.output.file, trajectoryFile); assert.equal(compression.output.sha256, hash(trajectoryFile));
assert.equal(primary.sources[0].file, trajectoryFile); assert.equal(primary.intervals, data.rows.length - 1);
assert.equal(secondary.sources[0].file, compression.sources[0].file);
assert.equal(secondary.sources[0].sha256, compression.sources[0].sha256);
for (const report of [compression, secondary, primary]) for (const source of report.sources) {
  assert.equal(hash(source.file), source.sha256, 'Evidence input changed: ' + source.file);
}
// The current pulley delegate was constructed with these specific options.
// Reject another geometry rather than silently transferring its certificate.
assert.deepEqual(data.geometry, {shortFaceFraction: .06, treadleInset: .055, rodEndOffset: .12});
assert(compression.maximumAngleErrors.length === 3 && compression.maximumAngleErrors.every(v => Number.isFinite(v) && v >= 0 && v < Math.PI));
const candidate = makeTreadleRatchetCandidate(data.geometry), u = candidate.root.userData;
const displacement = Object.fromEntries(Object.entries(u.parts).map(([name, mesh]) => {
  const coordinate = ['wheel', 'lowerPawl', 'upperPawl'].indexOf(u.families[name]); if (coordinate < 0) return [name, 0];
  mesh.updateMatrix(); const p = mesh.geometry.attributes.position; let radius = 0;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrix); radius = Math.max(radius, Math.hypot(v.x, v.y));
  }
  return [name, 2 * radius * Math.sin(compression.maximumAngleErrors[coordinate] / 2)];
}));
const id = (a, b) => [a, b].sort().join('/'), names = Object.keys(u.parts), expected = [];
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
  const a = names[i], b = names[j];
  if (u.families[a] === u.families[b] || (a === 'strap' && b.endsWith('StrapEye')) || (b === 'strap' && a.endsWith('StrapEye'))) continue;
  expected.push(id(a, b));
}
assert.deepEqual(secondary.pairs.map(p => p.id).sort(), expected.sort());
assert.deepEqual(secondary.pairs.filter(p => p.kind === 'primary-profile').map(p => p.id).sort(),
  ['lowerPawlBody/ratchetBody', 'ratchetBody/upperPawlBody'].sort());
const tolerance = Math.min(secondary.tolerance, primary.tolerance), transferred = [];
for (const pair of secondary.pairs) {
  if (pair.kind === 'primary-profile') continue;
  // Rotation about Z leaves each axial layer and each concentric bore bound
  // intact. The pulley bounds depend only on the unchanged prescribed input.
  // For swept hulls, subtract the actual maximum material-point displacement
  // of each participant; the reference trajectory already has positive gaps.
  assert(['axial', 'bore', 'pulley-bound', 'swept-hull'].includes(pair.kind));
  const change = pair.kind === 'swept-hull' ? displacement[pair.a] + displacement[pair.b] : 0;
  const lower = pair.minimum - change - 1e-12;
  assert(lower >= -tolerance, 'Compression exhausted the clearance of ' + pair.id);
  transferred.push({id: pair.id, kind: pair.kind, referenceLowerBound: pair.minimum, displacementAllowance: change, lowerBound: lower});
}
const files = [trajectoryFile, compressionFile, secondaryFile, primaryFile, 'scripts/check-treadle-ratchet-clearance-transfer.mjs',
  'scripts/lib/treadle-ratchet-candidate.mjs', 'scripts/lib/treadle-ratchet-linkage.mjs', 'scripts/lib/treadle-ratchet-source.mjs'];
const sources = files.map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const report = {movement: 82, passed: true, productionChanged: false, mechanicsPassed: false, status: 'complete-candidate-trajectory-clearance',
  tolerance, startTime: data.rows[0].time, endTime: data.rows.at(-1).time, knots: data.rows.length,
  independentPairs: expected.length, secondaryPairs: transferred.length, primaryPairs: 2,
  primaryIntervals: primary.intervals, primaryTrianglePairs: primary.totals.certifiedPairs,
  primaryLowerBound: primary.totals.minimumLowerBound, maximumCompressionPixels: compression.maximumPixels,
  displacement, transferred, sources,
  qualification: 'Both primary pawl/ratchet pairs have complete triangle-based interval bounds on this compressed trajectory. All secondary pairs retain their structural axial/bore/pulley bounds or a positive swept-enclosure bound after subtracting the compression displacement of both solids. Every independent pair is accounted for, excluding rigidly bonded families and bonded strap/eye joins. This is a clearance certificate for the stated finite time domain, not a dynamics-convergence, traction, periodic-extension or production-integration certificate.'};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, displacement: undefined, transferred: undefined, sources: undefined});
