import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { surfacePoints, solidSurface } from '../tests/helpers/solid-surface.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[64]), { blocks: b, geometry: p } = model.root.userData;
const meshOf = group => { let mesh; group.traverse(o => { if (!mesh && o.isMesh) mesh = o; }); return mesh; };
const named = { driver: b.driver.userData.body, driven: meshOf(b.driven), tappet: b.tappet,
  stop: meshOf(b.stop), pivot: meshOf(b.stopPivotShaft), rail: meshOf(b.shaftRail),
  driverShaft: meshOf(b.driverShaft), drivenShaft: meshOf(b.drivenShaft) };
b.driven.userData.studs.forEach((mesh, i) => { named['stud' + i] = mesh; });
const unbeveled = process.env.PROBE_UNBEVELED === '1';
if (unbeveled) for (const mesh of [named.driver, named.tappet, named.stop]) {
  const { shapes, options } = mesh.geometry.parameters;
  mesh.geometry = new THREE.ExtrudeGeometry(shapes, { ...options, bevelEnabled: false });
  mesh.geometry.translate(0, 0, -options.depth / 2);
}
const data = Object.fromEntries(Object.entries(named).map(([name, mesh]) => [name,
  { mesh, points: surfacePoints(mesh.geometry), solid: solidSurface(mesh.geometry), tree: triangleTree(mesh.geometry) }]));
const pairs = [['driver', 'driven'], ['driver', 'stop'], ['driven', 'stop'], ['tappet', 'driven'],
  ['stop', 'pivot'], ['rail', 'driverShaft'], ['rail', 'drivenShaft']];
for (let i = 0; i < p.studCount; i++) pairs.push(['tappet', 'stud' + i], ['stop', 'stud' + i]);
const pairRows = pairs.map(pair => ({ pair, checks: 0, inside: 0, maximumDepth: 0, penetratingPoses: 0 }));
const phases = new Set([0, p.contactPhaseSpan, 0.2, 0.5, 0.8]);
for (let i = 0; i <= 48; i++) phases.add(p.contactPhaseSpan * i / 48);
for (const edge of [0, p.contactPhaseSpan]) for (const offset of [-0.0001, 0.0001, -0.001, 0.001]) phases.add(edge + offset);
const rows = [];
for (let cycle = 0; cycle < 3; cycle++) for (const phase of [...phases].sort((a, b) => a - b)) {
  const time = (cycle + phase - p.initialCyclePhase) * p.eventPeriod;
  model.update(time); model.root.updateMatrixWorld(true);
  const state = model.root.userData.kinematics;
  for (const row of pairRows) {
    const [a, d] = row.pair.map(name => data[name]);
    if (!a.solid.box.clone().applyMatrix4(a.mesh.matrixWorld).intersectsBox(d.solid.box.clone().applyMatrix4(d.mesh.matrixWorld))) continue;
    let penetrating = false;
    for (const [from, to] of [[a, d], [d, a]]) {
      const matrix = to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
      for (const point of from.points) {
        const q = point.clone().applyMatrix4(matrix); row.checks++;
        if (!to.solid.inside(q)) continue;
        const depth = to.solid.distance(q); if (depth <= 1e-6) continue;
        row.inside++; row.maximumDepth = Math.max(row.maximumDepth, depth); penetrating = true;
      }
    }
    if (penetrating) row.penetratingPoses++;
  }
  const distance = (first, second) => {
    const a = data[first], d = data[second];
    return meshPairDistance(a.tree, d.tree, d.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld), 0.3).distance;
  };
  const row = { time, cycle, phase, stage: state.stage, activeStud: state.eventStudIndex,
    stopStud: state.passingStopStudIndex, claimedTappetError: state.tappetContactError,
    claimedStopDriverError: state.stopDriverContactError, claimedStopStudError: state.stopStudContactError,
    actualStopDriverGap: distance('stop', 'driver'),
    actualTappetStudGap: state.indexing ? distance('tappet', 'stud' + state.eventStudIndex) : null,
    actualStopStudGap: state.indexing ? distance('stop', 'stud' + state.passingStopStudIndex) : null,
    actualLockedStudGaps: state.indexing ? null : b.driven.userData.studs.map((_, i) => ({ stud: i, gap: distance('stop', 'stud' + i) })).sort((a, b) => a.gap - b.gap).slice(0, 2) };
  rows.push(row);
  console.log({ sample: rows.length, stage: row.stage, tappetGap: row.actualTappetStudGap, stopGap: row.actualStopStudGap });
}
const summary = { poses: rows.length, pairs: pairs.length, checks: pairRows.reduce((s, r) => s + r.checks, 0),
  inside: pairRows.reduce((s, r) => s + r.inside, 0), affectedPairs: pairRows.filter(r => r.inside).map(r => r.pair) };
await writeFile(`artifacts/review/${unbeveled ? '065-unbeveled-outline-study' : '065-contact-baseline'}.json`, JSON.stringify({ movement: 65,
  status: unbeveled ? 'isolated-unbeveled-diagnostic' : 'production-baseline-diagnostic',
  substitution: unbeveled ? 'Only the driver, tappet and stop extrusion bevels are removed in this isolated model. Production, depth arrangement, outlines and motion remain unchanged.' : null,
  method: 'Scoped baseline: 27 independent contact/bearing/frame pairs through three index events, with dense transition samples. Conservative box rejection then bidirectional actual triangle vertex/edge-midpoint/center containment; exact triangle gaps compare claimed working contact and the two closest studs during dwell. A zero process exit means the diagnostic completed, not that the mechanism passed.',
  geometry: p, summary, pairs: pairRows, rows }, null, 2) + '\n');
console.log(summary);
