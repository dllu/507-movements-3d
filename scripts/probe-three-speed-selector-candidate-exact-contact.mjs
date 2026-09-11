import { writeFile } from 'node:fs/promises';
import { makeThreeSpeedSelectorCandidate } from '../artifacts/review/058-candidate-model.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const model = makeThreeSpeedSelectorCandidate(), { parts, geometry: p } = model.root.userData;
const names = ['driverDrum', 'loosePulley', 'belt', ...[0, 1, 2].flatMap(i => [`inputPulley${i}`, `inputGear${i}`, `outputGear${i}`])];
const trees = Object.fromEntries(names.map(name => [name, triangleTree(parts[name].geometry)]));
const rows = [];
const check = (a, b, time, kind) => {
  model.update(time); model.root.updateMatrixWorld(true);
  const transform = parts[b].matrixWorld.clone().invert().multiply(parts[a].matrixWorld);
  const result = meshPairDistance(trees[a], trees[b], transform, 0.002);
  rows.push({ a, b, time, kind, ...result });
  console.log(JSON.stringify({ a, b, time, kind, distance: result.distance, testedTriangles: result.testedTriangles }));
};
for (let pair = 0; pair < 3; pair += 1) for (const offset of [0.379, 0.913]) {
  check(`inputGear${pair}`, `outputGear${pair}`, p.stageDuration + offset, 'gear');
}
const pulleyName = lane => lane === 0 ? 'loosePulley' : `inputPulley${lane - 1}`;
for (let stage = 0; stage < 4; stage += 1) {
  const time = stage * p.stageDuration + p.dwellDuration * 0.371;
  check('belt', 'driverDrum', time, 'belt');
  check('belt', pulleyName(p.selectionSequence[stage]), time, 'belt');
}
for (let stage = 0; stage < 3; stage += 1) {
  const time = stage * p.stageDuration + p.dwellDuration + p.shiftDuration / 2;
  for (const lane of [p.selectionSequence[stage], p.selectionSequence[stage + 1]]) check('belt', pulleyName(lane), time, 'traverse');
}
await writeFile('artifacts/review/058-candidate-exact-contact.json', JSON.stringify({
  method: 'Exact distance between actual rendered Float32 triangles, including vertex/face, edge/edge and segment/face intersections. Dwell contacts cover every lower lane; mid-shift contacts cover both adjoining pulley treads.',
  rows,
}, null, 2) + '\n');
if (rows.some(v => !v.witness || v.distance < (v.kind === 'gear' ? 0.00002 : 0.00012)
  || v.distance > (v.kind === 'gear' ? 0.00004 : 0.00020))) process.exitCode = 1;
