import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createMovementModel} from '../src/simulation/registry.js';
import {surfacePoints, surfaceTriangles, solidSurface} from '../tests/helpers/solid-surface.mjs';
import {hashStudyFile, freezeStudySources, verifyStudySources} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/084-baseline-surfaces';
const freezeFile = 'artifacts/review/083-shadow-source-hashes.json', frozen = JSON.parse(fs.readFileSync(freezeFile));
const verifyProduction = () => {for (const [file, sha] of Object.entries(frozen)) assert.equal(hashStudyFile(file), sha, file);};
verifyProduction();
const catalog = JSON.parse(fs.readFileSync('src/data/movements.json'));
const model = createMovementModel(catalog.movements[83]), u = model.root.userData, g = u.geometry, b = u.blocks;
const named = [['camBody', b.camBody, 'cam'], ['camHub', b.camHub, 'cam'],
  ...b.camLobeTips.map((mesh, i) => ['camTip' + i, mesh, 'cam']),
  ['rackBody', b.rackBody, 'frame'], ['hangerHousing', b.hangerHousing, 'frame'],
  ...b.lowerRackTeeth.map((mesh, i) => ['lowerTooth' + i, mesh, 'frame']),
  ...b.upperRackTeeth.map((mesh, i) => ['upperTooth' + i, mesh, 'frame']),
  ...b.suspensionPins.map((pin, i) => {
    const meshes = []; pin.traverse(child => {if (child.isMesh) meshes.push(child);});
    assert.equal(meshes.length, 1);
    return ['suspensionPin' + i, meshes[0], 'selector'];
  })];
const topology = geometry => {
  const edges = new Map(); let volume = 0, degenerate = 0;
  for (const triangle of surfaceTriangles(geometry)) {
    const v = [triangle.a, triangle.b, triangle.c]; volume += v[0].dot(v[1].clone().cross(v[2])) / 6;
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
const pairs = parts.flatMap((a, i) => parts.slice(i + 1).filter(b => b.family !== a.family).map(b =>
  ({a, b, checks: 0, intrusions: 0, maximumDepth: 0, worst: null})));
const sources = freezeStudySources(['scripts/probe-selector-rack-baseline.mjs', 'scripts/lib/study-report-io.mjs',
  'src/simulation/authored-intermittent.js', 'src/simulation/primitives.js', 'src/simulation/registry.js',
  'src/data/movements.json', 'tests/helpers/solid-surface.mjs'], prefix);
const phases = [...new Set([...Array.from({length: 129}, (_, i) => i / 128), .025, .525])].sort((a, b) => a - b);
let boxExclusions = 0, openTargetDirectionsExcluded = 0, reportedContactSamples = 0, maximumReportedContactError = 0;
for (const phase of phases) {
  const time = (phase - g.initialCyclePhase) / g.cyclesPerSecond;
  model.update(time); model.root.updateMatrixWorld(true);
  const state = u.stateAtTime(time);
  if (state.contactActive) {reportedContactSamples++; maximumReportedContactError = Math.max(maximumReportedContactError, state.toothContactError);}
  for (const part of parts) part.worldBox = part.solid.box.clone().applyMatrix4(part.mesh.matrixWorld);
  for (const pair of pairs) {
    if (!pair.a.worldBox.intersectsBox(pair.b.worldBox)) {boxExclusions++; continue;}
    for (const [a, b] of [[pair.a, pair.b], [pair.b, pair.a]]) {
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
verifyProduction(); verifyStudySources(sources);
const rows = pairs.map(({a, b, ...row}) => ({a: a.name, b: b.name, ...row}));
const report = {movement: 84, status: 'baseline-cam-rack-and-suspension-screen', productionChanged: false, mechanicsPassed: false,
  poses: phases.length, phases, pairCount: rows.length, checks: rows.reduce((sum, r) => sum + r.checks, 0), boxExclusions,
  intrusions: rows.reduce((sum, r) => sum + r.intrusions, 0), maximumDepth: Math.max(...rows.map(r => r.maximumDepth)),
  pairs: rows, topology: parts.map(p => ({name: p.name, ...p.topology})), openTargetDirectionsExcluded,
  reportedContactSamples, maximumReportedContactError, cycleSeconds: 1 / g.cyclesPerSecond,
  camRevolutionSeconds: 1 / g.camTurnsPerSecond, camLobeCount: g.camLobeCount, sources, freezeFile,
  frozenProductionInputsMatched: Object.keys(frozen).length,
  qualification: 'Selected actual cam body, hub and tips, rack body, housing and all teeth, and suspension pins are sampled bidirectionally across distinct moving families. Only closed outward-wound meshes are used as interior targets. This diagnoses the baseline; it does not certify continuous clearance or the untested flywheel, guides and supports. The model-reported contact error is recorded separately from finite-solid penetration.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, pairs: rows.filter(r => r.intrusions).sort((a, b) => b.maximumDepth - a.maximumDepth).slice(0, 6),
  topology: report.topology.filter(p => !p.closed), sources: undefined});
