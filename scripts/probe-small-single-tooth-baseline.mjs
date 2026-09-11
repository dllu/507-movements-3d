import { readFile, writeFile } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[68]), { blocks, geometry: p, stateAtTime } = model.root.userData;
const names = ['driverBody', 'tooth', 'toothTipBody', 'wheelBody'];
const data = Object.fromEntries(names.map(name => [name, { mesh: blocks[name],
  solid: solidSurface(blocks[name].geometry), points: surfacePoints(blocks[name].geometry), tree: triangleTree(blocks[name].geometry) }]));
const times = Array.from({ length: 97 }, (_, i) => p.driverCyclePeriod * (i + 0.319) / 97);
const phaseTime = phase => (phase - p.initialCyclePhase) * p.driverCyclePeriod;
for (let i = 0; i < 97; i++) times.push(phaseTime(p.contactStartPhase + (p.contactEndPhase - p.contactStartPhase) * i / 96));
for (const phase of [p.contactStartPhase, p.contactEndPhase]) for (const delta of [-1e-5, 0, 1e-5]) times.push(phaseTime(phase) + delta);
const pairs = names.slice(0, -1).map(name => ({ a: name, b: 'wheelBody', checks: 0, inside: 0, maximumDepth: 0 }));
const rows = [];
for (const [index, time] of times.entries()) {
  model.update(time); model.root.updateMatrixWorld(true);
  const state = stateAtTime(time);
  for (const pair of pairs) {
    for (const [a, b] of [[data[pair.a], data[pair.b]], [data[pair.b], data[pair.a]]]) {
      const matrix = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for (const q of a.points) {
        const point = q.clone().applyMatrix4(matrix); pair.checks++;
        if (!b.solid.inside(point)) continue;
        const depth = b.solid.distance(point); if (depth < 1e-6) continue;
        pair.inside++; pair.maximumDepth = Math.max(pair.maximumDepth, depth);
        pair.firstWitness ??= { time, stage: state.stage, source: a === data[pair.a] ? pair.a : pair.b, point: point.toArray(), depth };
      }
    }
  }
  if (index % 8 === 0 || index >= times.length - 6) {
    const active = state.indexing ? data.toothTipBody : data.driverBody;
    const exact = meshPairDistance(active.tree, data.wheelBody.tree,
      data.wheelBody.mesh.matrixWorld.clone().invert().multiply(active.mesh.matrixWorld), 0.1);
    rows.push({ time, stage: state.stage, indexing: state.indexing, drivenAngularSpeed: state.drivenAngularSpeed,
      declaredLockGap: state.lockClearance, activeSurfaceGap: Number.isFinite(exact.distance) ? exact.distance : null,
      searchedGapLimit: 0.1, witness: exact.witness });
  }
}
const report = { movement: 69, status: 'baseline-diagnosis', productionChanged: false,
  method: 'Actual Float32 triangle vertices, edge midpoints and face centers in both directions for the driver body, finite tooth shank and rounded tooth head against the notched output. Full cycle plus dense indexing and both event sides. Selected actual triangle distances assess the claimed active contacts. This scoped diagnostic does not certify other hardware or source fidelity.',
  sourceToothCount: 30, modeledToothCount: p.wheelTeeth, poses: times.length, pairs,
  checks: pairs.reduce((sum, row) => sum + row.checks, 0), inside: pairs.reduce((sum, row) => sum + row.inside, 0), rows,
  entry: stateAtTime(phaseTime(p.contactStartPhase)), exit: stateAtTime(phaseTime(p.contactEndPhase)),
};
await writeFile('artifacts/review/069-working-surface-baseline.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log({ poses: times.length, checks: report.checks, inside: report.inside, pairs });
