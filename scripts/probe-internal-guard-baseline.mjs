import { readFile, writeFile } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[70]), { blocks, geometry: p, stateAtTime } = model.root.userData;
const input = [['driverBody', blocks.driverBody], ...blocks.guardSegments.map((mesh,i) => ['guard' + i,mesh]), ['tappet', blocks.tappet]];
const output = [['drivenBody', blocks.drivenBody], ...blocks.studs.map((mesh, i) => ['stud' + i, mesh])];
const data = Object.fromEntries([...input, ...output].map(([name, mesh]) => [name, { mesh,
  solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry), tree: triangleTree(mesh.geometry) }]));
const times = Array.from({ length: 97 }, (_, i) => p.driverCyclePeriod * (i + .319) / 97);
const phaseTime = phase => (phase - p.initialCyclePhase) * p.driverCyclePeriod;
for (let i = 0; i < 97; i++) times.push(phaseTime(p.contactStartPhase + (p.contactEndPhase - p.contactStartPhase) * i / 96));
for (const phase of [p.contactStartPhase, p.contactEndPhase]) for (const delta of [-1e-5, 0, 1e-5]) times.push(phaseTime(phase) + delta);
const pairs = input.flatMap(([a]) => output.map(([b]) => ({ a, b, checks: 0, inside: 0, maximumDepth: 0 })));
const rows = [];
for (const [index, time] of times.entries()) {
  model.update(time); model.root.updateMatrixWorld(true); const state = stateAtTime(time);
  for (const pair of pairs) for (const [a, b, source] of [
    [data[pair.a], data[pair.b], pair.a], [data[pair.b], data[pair.a], pair.b]]) {
    const matrix = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
    for (const sample of a.points) {
      const point = sample.clone().applyMatrix4(matrix); pair.checks++;
      if (!b.solid.inside(point)) continue;
      const depth = b.solid.distance(point); if (depth <= 1e-6) continue;
      pair.inside++; pair.maximumDepth = Math.max(pair.maximumDepth, depth);
      pair.firstWitness ??= { time, stage: state.stage, source, point: point.toArray(), depth };
    }
  }
  if (index % 8 === 0 || index >= times.length - 6) {
    const active = state.indexing ? data.tappet : data.guard0;
    const studIndex = state.indexing ? state.activeStudIndex : state.guardStudContacts[0]?.index;
    if (studIndex !== undefined) {
      const stud = data['stud' + studIndex], distance = meshPairDistance(active.tree, stud.tree,
        stud.mesh.matrixWorld.clone().invert().multiply(active.mesh.matrixWorld), .1);
      rows.push({ time, stage: state.stage, studIndex, active: state.indexing ? 'tappet' : 'guard0',
        distance: Number.isFinite(distance.distance) ? distance.distance : null, witness: distance.witness });
    }
  }
}
const report = { movement: 71, status: 'baseline-diagnosis', productionChanged: false,
  method: 'Actual Float32 triangle vertices, edge midpoints and face centers in both directions for all 44 pairings of the driver plate, both guard segments and finite tappet against the output plate and all ten studs. Full cycle, dense indexing and both sides of entry/exit. Penetration tolerance 1e-6. Selected actual triangle distances also test the declared active surfaces. Other hardware, topology and forces remain separate checks.',
  poses: times.length, pairs, checks: pairs.reduce((sum, row) => sum + row.checks, 0),
  inside: pairs.reduce((sum, row) => sum + row.inside, 0), rows,
  entry: stateAtTime(phaseTime(p.contactStartPhase)), exit: stateAtTime(phaseTime(p.contactEndPhase)) };
await writeFile('artifacts/review/071-working-surface-baseline.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log({ poses: report.poses, pairs: pairs.length, checks: report.checks, inside: report.inside,
  failures: pairs.filter(pair => pair.inside) });
