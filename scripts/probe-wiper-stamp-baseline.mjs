import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createMovementModel} from '../src/simulation/registry.js';
import {surfaceTriangles, surfacePoints, solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport, hashStudyFile, freezeStudySources, verifyStudySources} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/085-baseline-surfaces';
const frozen = readStudyReport('artifacts/review/084-integrated-source-hashes.json');
const verifyProduction = () => {for (const [file, sha256] of Object.entries(frozen)) assert.equal(hashStudyFile(file), sha256, file);};
verifyProduction();
const catalog = readStudyReport('src/data/movements.json'), model = createMovementModel(catalog.movements[84]), u = model.root.userData, g = u.geometry, b = u.blocks;
const ancestor = (mesh, parent) => {for (let o = mesh; o; o = o.parent) if (o === parent) return true; return false;};
const names = new Map(Object.entries(b).filter(([, v]) => v?.isMesh).map(([name, v]) => [v, name]));
b.guides.forEach((guide, i) => {names.set(guide.userData.collar, 'guideCollar' + i); names.set(guide.userData.bracket, 'guideBracket' + i);});
const parts = [];
model.root.traverse(mesh => {
  if (!mesh.isMesh) return;
  const name = names.get(mesh) ?? 'mesh' + parts.length, family = ancestor(mesh, b.rodGroup) ? 'stamp' : ancestor(mesh, b.cam) || ancestor(mesh, b.camShaft) ? 'cam' : 'fixed';
  const edges = new Map(); let volume = 0, degenerate = 0;
  for (const t of surfaceTriangles(mesh.geometry)) {
    volume += t.a.dot(t.b.clone().cross(t.c)) / 6; if (t.getArea() < 1e-12) degenerate++;
    const keys = [t.a, t.b, t.c].map(p => p.toArray().map(v => Math.round(v * 1e8)).join(','));
    for (let i = 0; i < 3; i++) {const a = keys[i], c = keys[(i + 1) % 3], key = [a, c].sort().join('/'), e = edges.get(key) ?? {count: 0, sign: 0};
      e.count++; e.sign += a < c ? 1 : -1; edges.set(key, e);}
  }
  const unmatchedEdges = [...edges.values()].filter(e => e.count !== 2 || e.sign !== 0).length, topology = {volume, degenerate, unmatchedEdges, closed: volume > 0 && !degenerate && !unmatchedEdges};
  parts.push({name, mesh, family, topology, points: surfacePoints(mesh.geometry), solid: solidSurface(mesh.geometry)});
});
const pairs = parts.flatMap((a, i) => parts.slice(i + 1).filter(b => b.family !== a.family).map(b => ({a, b, checks: 0, intrusions: 0, maximumDepth: 0, worst: null})));
const phases = [...new Set([...Array.from({length: 129}, (_, i) => i / 64), .1, .29, .48, .72])].sort((a, b) => a - b);
let boxExclusions = 0, openTargetExclusions = 0, reportedContactError = 0, minimumRequiredVerticalForcePerMass = Infinity, tensileSamples = 0;
for (const phase of phases) {
  const time = (phase - g.initialCyclePhase) * g.lobePitch / g.driverAngularSpeed; model.update(time); model.root.updateMatrixWorld(true);
  const s = u.stateAtTime(time);
  if (s.camContactEngaged) {
    reportedContactError = Math.max(reportedContactError, s.camFollowerContactError);
    const force = s.rodAcceleration + s.gravityAcceleration; minimumRequiredVerticalForcePerMass = Math.min(minimumRequiredVerticalForcePerMass, force);
    if (force < -1e-9 && s.camNormal.y > 0) tensileSamples++;
  }
  for (const p of parts) p.box = p.solid.box.clone().applyMatrix4(p.mesh.matrixWorld);
  for (const pair of pairs) {
    if (!pair.a.box.intersectsBox(pair.b.box)) {boxExclusions++; continue;}
    for (const [a, b] of [[pair.a, pair.b], [pair.b, pair.a]]) {
      if (!b.topology.closed) {openTargetExclusions++; continue;}
      const transform = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for (const sample of a.points) {
        pair.checks++; const point = sample.clone().applyMatrix4(transform); if (!b.solid.inside(point)) continue;
        const depth = b.solid.distance(point); if (depth <= 1e-6) continue; pair.intrusions++;
        if (depth > pair.maximumDepth) {pair.maximumDepth = depth; pair.worst = {phase, time, sampleOn: a.name, inside: b.name, local: point.toArray()};}
      }
    }
  }
}
verifyProduction();
const sources = freezeStudySources(['scripts/probe-wiper-stamp-baseline.mjs', 'src/simulation/authored-intermittent.js', 'src/simulation/registry.js',
  'src/simulation/primitives.js', 'src/data/movements.json', 'tests/helpers/solid-surface.mjs', 'scripts/lib/study-report-io.mjs'], prefix); verifyStudySources(sources);
const result = pairs.map(({a, b, ...p}) => ({a: a.name, b: b.name, ...p}));
const report = {movement: 85, status: 'existing-stamp-finite-surface-and-load-diagnostic', productionChanged: false, mechanicsPassed: false,
  meshes: parts.length, topology: parts.map(p => ({name: p.name, family: p.family, ...p.topology})), poses: phases.length, pairs: result,
  pairCount: pairs.length, checks: result.reduce((sum, p) => sum + p.checks, 0), intrusions: result.reduce((sum, p) => sum + p.intrusions, 0), maximumDepth: Math.max(...result.map(p => p.maximumDepth)),
  boxExclusions, openTargetExclusions, reportedContactError, minimumRequiredVerticalForcePerMass, tensileSamples,
  gravityAcceleration: g.gravityAcceleration, camPeriod: 2 * Math.PI / g.driverAngularSpeed, displayedCamPeriod: 2 * Math.PI / g.driverAngularSpeed / u.animationTiming.playbackTimeScale,
  frozenProductionInputsMatched: Object.keys(frozen).length, sources,
  qualification: 'All mesh pairs across cam, stamp and fixed families are sampled over a shaft revolution. Only closed surfaces are used as interior targets. The reported analytic point contact is compared with actual mesh intrusion. Required vertical force assumes the model-described gravity and frictionless vertical guide; a negative force with an upward cam normal cannot be supplied by unilateral support. No continuous or full-dynamics qualification is claimed.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, topology: report.topology.filter(p => !p.closed), pairs: result.filter(p => p.intrusions).sort((a, b) => b.maximumDepth - a.maximumDepth).slice(0, 8), sources: undefined});
