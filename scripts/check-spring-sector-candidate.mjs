import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
import {surfaceTriangles, surfacePoints, solidSurface} from '../tests/helpers/solid-surface.mjs';

const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/083-first-candidate-solids.json';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const freezeFile = 'artifacts/review/083-shadow-source-hashes.json', frozen = JSON.parse(fs.readFileSync(freezeFile));
for (const [file, expected] of Object.entries(frozen)) assert.equal(hash(file), expected, file);
const model = makeSpringSectorCandidate(), u = model.root.userData, topology = [];
const pose = JSON.parse(process.env.PROBE_STATE ?? '{"shaftAngle":0,"wheelAngle":0,"lifts":[0,0]}');
model.setState(pose);
for (const [name, mesh] of Object.entries(u.parts)) {
  const edges = new Map(), triangles = surfaceTriangles(mesh.geometry); let volume = 0, degenerate = 0;
  for (const t of triangles) {
    const v = [t.a, t.b, t.c]; volume += t.a.dot(t.b.clone().cross(t.c)) / 6;
    if (t.getArea() < 1e-12) degenerate++;
    const keys = v.map(q => q.toArray().map(x => Math.round(x * 1e8)).join(','));
    for (let i = 0; i < 3; i++) {
      const a = keys[i], b = keys[(i + 1) % 3], key = a < b ? a + '/' + b : b + '/' + a;
      const edge = edges.get(key) ?? {count: 0, sign: 0}; edge.count++; edge.sign += a < b ? 1 : -1; edges.set(key, edge);
    }
  }
  const invalidEdges = [...edges.values()].filter(e => e.count !== 2 || e.sign !== 0).length;
  topology.push({name, triangles: triangles.length, volume, degenerate, invalidEdges, passed: volume > 0 && !degenerate && !invalidEdges});
}
const bodies = Object.entries(u.parts).map(([name, mesh]) => ({name, mesh, family: u.families[name],
  solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry)}));
const pairs = []; let checks = 0, intrusions = 0;
for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
  const a = bodies[i], b = bodies[j]; if (a.family === b.family) continue;
  const boxA = a.solid.box.clone().applyMatrix4(a.mesh.matrixWorld), boxB = b.solid.box.clone().applyMatrix4(b.mesh.matrixWorld);
  const row = {a: a.name, b: b.name, excludedByBox: !boxA.intersectsBox(boxB), checks: 0, intrusions: 0, maximumDepth: 0};
  if (!row.excludedByBox) for (const [from, to] of [[a, b], [b, a]]) {
    const transform = to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
    for (const point of from.points) {
      row.checks++; const q = point.clone().applyMatrix4(transform);
      if (to.solid.inside(q)) {
        const depth = to.solid.distance(q);
        if (depth > 1e-6) {row.intrusions++; row.maximumDepth = Math.max(row.maximumDepth, depth);}
      }
    }
  }
  pairs.push(row); checks += row.checks; intrusions += row.intrusions;
}
const sourceFiles = ['scripts/check-spring-sector-candidate.mjs', 'scripts/lib/spring-sector-candidate.mjs',
  'scripts/lib/spring-sector-source.mjs', 'src/simulation/finite-plate-geometry.js', 'src/simulation/clutch-section-geometry.js',
  'scripts/lib/spring-sector-linkage.mjs', 'scripts/lib/spring-rack-coil.mjs',
  'src/simulation/primitives.js', 'tests/helpers/solid-surface.mjs'];
const sources = sourceFiles.map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
for (const [file, expected] of Object.entries(frozen)) assert.equal(hash(file), expected, file);
const report = {movement: 83, status: 'static-geometry-candidate-screen', productionChanged: false, mechanicsPassed: false,
  pose, topology, topologyPassed: topology.every(r => r.passed), pairs, checks, intrusions,
  maximumDepth: Math.max(...pairs.map(p => p.maximumDepth)), sources, freezeFile, frozenProductionInputsMatched: Object.keys(frozen).length,
  qualification: 'One supplied static pose of actual finite meshes, all distinct rigid-family pairs including each spring as its own deforming family. Surface samples are a diagnostic; zero intrusions would not prove continuous clearance or exclude spring self-contact. Dynamics and guide loads remain open.'};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, topology: topology.filter(r => !r.passed), pairs: pairs.filter(p => p.intrusions), sources: undefined});
assert(report.topologyPassed, 'Closed outward nondegenerate solids required');
