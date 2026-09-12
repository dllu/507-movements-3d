import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createMovementModel} from '../src/simulation/registry.js';
import {surfacePoints, surfaceTriangles, solidSurface} from '../tests/helpers/solid-surface.mjs';

const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/083-baseline-surfaces.json';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const freezeFile = process.env.PROBE_FREEZE ?? 'artifacts/review/081-production-source-hashes.json';
const frozen = JSON.parse(fs.readFileSync(freezeFile));
for (const [file, expected] of Object.entries(frozen)) assert.equal(hash(file), expected, file);
const catalog = JSON.parse(fs.readFileSync('src/data/movements.json'));
const model = createMovementModel(catalog.movements[82]), u = model.root.userData, g = u.geometry, b = u.blocks;
const named = [
  ['wheelBody', b.crownWheel.userData.body, 'wheel'],
  ...b.crownWheel.userData.crownTeeth.map((mesh, i) => ['wheelTooth' + i, mesh, 'wheel']),
  ...['front', 'rear'].flatMap(key => {
    const sector = b[key + 'Sector'].userData;
    return [[key + 'Rim', sector.rim, key], ...sector.teeth.map((mesh, i) => [key + 'Tooth' + i, mesh, key])];
  }),
];
const topology = geometry => {
  const edges = new Map(); let volume = 0, degenerate = 0;
  for (const triangle of surfaceTriangles(geometry)) {
    const v = [triangle.a, triangle.b, triangle.c];
    volume += v[0].dot(v[1].clone().cross(v[2])) / 6;
    if (v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).lengthSq() < 1e-22) degenerate++;
    const keys = v.map(q => q.toArray().map(x => Math.round(x * 1e8)).join(','));
    for (let j = 0; j < 3; j++) {
      const a = keys[j], b = keys[(j + 1) % 3], key = a < b ? a + '/' + b : b + '/' + a;
      const edge = edges.get(key) ?? {count: 0, sign: 0}; edge.count++; edge.sign += a < b ? 1 : -1; edges.set(key, edge);
    }
  }
  const openOrInconsistentEdges = [...edges.values()].filter(e => e.count !== 2 || e.sign !== 0).length;
  return {volume, degenerate, openOrInconsistentEdges, closed: volume > 0 && !degenerate && !openOrInconsistentEdges};
};
const parts = named.map(([name, mesh, family]) => ({name, mesh, family, topology: topology(mesh.geometry),
  points: surfacePoints(mesh.geometry), solid: solidSurface(mesh.geometry)}));
const pairs = parts.filter(p => p.family !== 'wheel').flatMap(a => parts.filter(p => p.family === 'wheel').map(b =>
  ({a, b, checks: 0, intrusions: 0, maximumDepth: 0, worst: null})));
const sources = ['scripts/probe-spring-sector-baseline.mjs', 'src/simulation/authored-intermittent.js',
  'src/simulation/primitives.js', 'tests/helpers/solid-surface.mjs'].map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const poses = 65; let boxExclusions = 0, openTargetDirectionsExcluded = 0;
for (let i = 0; i < poses; i++) {
  const phase = i / (poses - 1);
  model.update((phase - g.initialCyclePhase) / g.cyclesPerSecond); model.root.updateMatrixWorld(true);
  for (const part of parts) part.worldBox = part.solid.box.clone().applyMatrix4(part.mesh.matrixWorld);
  for (const pair of pairs) {
    if (!pair.a.worldBox.intersectsBox(pair.b.worldBox)) {boxExclusions++; continue;}
    for (const [a, b] of [[pair.a, pair.b], [pair.b, pair.a]]) {
      // An uncapped tube has no well-defined interior. Its own surface may
      // still be checked against a closed target, but not conversely.
      if (!b.topology.closed) {openTargetDirectionsExcluded++; continue;}
      const matrix = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for (const point of a.points) {
        const local = point.clone().applyMatrix4(matrix); pair.checks++;
        if (!b.solid.inside(local)) continue;
        const depth = b.solid.distance(local); if (depth <= 1e-6) continue;
        pair.intrusions++;
        if (depth > pair.maximumDepth) {
          pair.maximumDepth = depth; pair.worst = {phase, sampleOn: a.name, inside: b.name,
            point: local.toArray(), worldPoint: local.clone().applyMatrix4(b.mesh.matrixWorld).toArray()};
        }
      }
    }
  }
}
for (const source of sources) assert.equal(hash(source.file), source.sha256, source.file);
for (const [file, expected] of Object.entries(frozen)) assert.equal(hash(file), expected, file);
const rows = pairs.map(({a, b, ...row}) => ({a: a.name, b: b.name, ...row}));
const report = {movement: 83, status: 'baseline-finite-tooth-and-rim-screen', productionChanged: false, mechanicsPassed: false,
  poses, pairCount: rows.length, checks: rows.reduce((sum, r) => sum + r.checks, 0), boxExclusions,
  intrusions: rows.reduce((sum, r) => sum + r.intrusions, 0), maximumDepth: Math.max(...rows.map(r => r.maximumDepth)),
  pairs: rows, topology: parts.map(p => ({name: p.name, ...p.topology})), openTargetDirectionsExcluded,
  sources, freezeFile, frozenProductionInputsMatched: Object.keys(frozen).length,
  qualification: 'Actual crown teeth/body against both sector teeth/rims, sampled at 65 phases. Bidirectional tests require closed, outward-wound targets; open rims supply surface points only. This is a baseline diagnostic, not a continuous clearance certificate or a complete all-parts check.'};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, pairs: rows.filter(r => r.intrusions).sort((a, b) => b.maximumDepth - a.maximumDepth).slice(0, 4),
  topology: report.topology.filter(p => !p.closed), sources: undefined});
