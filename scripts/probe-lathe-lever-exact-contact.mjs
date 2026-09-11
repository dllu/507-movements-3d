import { writeFile } from 'node:fs/promises';
import { makeLatheLeverCandidate } from '../artifacts/review/056-candidate-model.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const model = makeLatheLeverCandidate(), { parts, geometry: p } = model.root.userData;
const trees = Object.fromEntries(['largeGear', 'pinion', 'outputShaft', 'leverPlate'].map(name => [name, triangleTree(parts[name].geometry)]));
const report = { method: 'Exact actual triangle vertex/face, edge/edge and segment/face distances.', poses: [] };
for (const [a, b, times] of [['pinion', 'largeGear', [0.351, 0.779, 1.593]],
  ['outputShaft', 'leverPlate', [0, 2.4, 2.61, 2.93, 3.22, 3.6, 6.17, 6.47, 6.83, 7.2]]]) {
  for (const time of times) {
    model.update(time); model.root.updateMatrixWorld(true);
    const transform = parts[b].matrixWorld.clone().invert().multiply(parts[a].matrixWorld);
    const result = meshPairDistance(trees[a], trees[b], transform, 0.0001);
    report.poses.push({ a, b, time, ...result }); console.log(JSON.stringify({ a, b, time, distance: result.distance, testedTriangles: result.testedTriangles }));
  }
}
await writeFile('artifacts/review/056-candidate-exact-contact.json', JSON.stringify(report, null, 2) + '\n');
if (report.poses.some(v => !v.witness || v.distance <= 1e-6)) process.exitCode = 1;
