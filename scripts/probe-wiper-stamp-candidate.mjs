import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWiperStampCandidate} from './lib/wiper-stamp-candidate.mjs';
import {surfacePoints, surfaceTriangles, solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport, freezeStudySources, hashStudyFile, verifyStudySources} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/085-first-candidate-surfaces';
const input = process.env.PROBE_INPUT ?? 'artifacts/review/085-eighth-ms-corrected-dynamics.json.gz';
const trajectory = readStudyReport(input); verifyStudySources(trajectory.sources);
const model = makeWiperStampCandidate(), u = model.root.userData;
const sources = freezeStudySources(['scripts/probe-wiper-stamp-candidate.mjs', 'scripts/lib/wiper-stamp-candidate.mjs',
  'scripts/lib/wiper-stamp-source.mjs', 'src/simulation/conforming-plate-mesh.js', 'scripts/lib/study-report-io.mjs', 'tests/helpers/solid-surface.mjs',
  'src/simulation/finite-plate-geometry.js', 'src/simulation/clutch-section-geometry.js', 'src/simulation/primitives.js',
  input, ...trajectory.sources.map(s => s.file)], prefix);
const frozen = JSON.parse(fs.readFileSync('artifacts/review/084-integrated-source-hashes.json'));
for (const [file, sha] of Object.entries(frozen)) assert.equal(hashStudyFile(file), sha, file);
const topology = geometry => {
  const edges = new Map(); let volume = 0, degenerate = 0;
  for (const t of surfaceTriangles(geometry)) {
    const v = [t.a, t.b, t.c]; volume += v[0].dot(v[1].clone().cross(v[2])) / 6;
    if (v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).lengthSq() < 1e-22) degenerate++;
    const keys = v.map(p => p.toArray().map(n => Math.round(n * 1e8)).join(','));
    for (let i = 0; i < 3; i++) {
      const a = keys[i], b = keys[(i + 1) % 3], key = a < b ? a + '/' + b : b + '/' + a;
      const edge = edges.get(key) ?? {count: 0, sign: 0}; edge.count++; edge.sign += a < b ? 1 : -1; edges.set(key, edge);
    }
  }
  const openOrInconsistentEdges = [...edges.values()].filter(e => e.count !== 2 || e.sign !== 0).length;
  return {volume, degenerate, openOrInconsistentEdges, closed: volume > 0 && !degenerate && !openOrInconsistentEdges};
};
const parts = Object.entries(u.parts).map(([name, mesh]) => ({name, mesh, family: u.families[name],
  topology: topology(mesh.geometry), points: surfacePoints(mesh.geometry), solid: solidSurface(mesh.geometry)}));
const pairs = parts.flatMap((a, i) => parts.slice(i + 1).filter(b => a.family !== b.family)
  .map(b => ({a, b, checks: 0, intrusions: 0, maximumDepth: 0, worst: null})));
const poses = trajectory.rows.filter((row, i) => i % Math.round(.08 / trajectory.step) === 0).map(row => ({name: 'loaded-' + row.time, camAngle: row.camAngle, stampY: row.stampY}));
let boxExclusions = 0, openTargetsExcluded = 0;
for (const pose of poses) {
  model.setState(pose);
  for (const part of parts) part.box = part.solid.box.clone().applyMatrix4(part.mesh.matrixWorld);
  for (const pair of pairs) {
    if (!pair.a.box.intersectsBox(pair.b.box)) {boxExclusions++; continue;}
    for (const [a, b] of [[pair.a, pair.b], [pair.b, pair.a]]) {
      if (!b.topology.closed) {openTargetsExcluded++; continue;}
      const matrix = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for (const p of a.points) {
        pair.checks++; const local = p.clone().applyMatrix4(matrix);
        if (!b.solid.inside(local)) continue;
        const depth = b.solid.distance(local); if (depth <= 1e-6) continue;
        pair.intrusions++;
        if (depth > pair.maximumDepth) {pair.maximumDepth = depth; pair.worst = {pose, sampleOn: a.name, inside: b.name,
          point: local.toArray(), worldPoint: local.clone().applyMatrix4(b.mesh.matrixWorld).toArray()};}
      }
    }
  }
}
verifyStudySources(sources);
for (const [file, sha] of Object.entries(frozen)) assert.equal(hashStudyFile(file), sha, file);
const resultPairs = pairs.map(({a, b, ...r}) => ({a: a.name, b: b.name, ...r}));
const report = {movement: 85, status: 'loaded-finite-candidate-screen', productionChanged: false,
  mechanicsPassed: false, candidateIntegrated: false, poses, meshes: parts.length, pairCount: pairs.length,
  topology: parts.map(p => ({name: p.name, ...p.topology})), pairs: resultPairs,
  checks: resultPairs.reduce((sum, p) => sum + p.checks, 0), intrusions: resultPairs.reduce((sum, p) => sum + p.intrusions, 0),
  maximumDepth: Math.max(...resultPairs.map(p => p.maximumDepth)), boxExclusions, openTargetsExcluded, sources,
  frozenProductionInputsMatched: Object.keys(frozen).length,
  qualification: 'All distinct-family pairs of all finite candidate meshes are sampled bidirectionally at 101 poses in the first eight-second contact/gravity trajectory. Only closed meshes are interior targets. This does not prove continuous clearance, contact reactions, time-step agreement or the adequacy of inferred guide and impact-bed construction.'};
report.passed = !report.intrusions && !openTargetsExcluded && report.topology.every(p => p.closed);
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, poses: poses.length, sources: undefined, pairs: resultPairs.filter(p => p.intrusions), topology: report.topology.filter(p => !p.closed)});
if (!report.passed) process.exitCode = 1;
