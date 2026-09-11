import { writeFile } from 'node:fs/promises';
import { makeDualBeltSpeedsCandidate } from '../artifacts/review/060-candidate-model.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const model = makeDualBeltSpeedsCandidate(), { parts, geometry: p } = model.root.userData;
const trees = Object.fromEntries(Object.entries(parts).map(([name, mesh]) => [name, triangleTree(mesh.geometry)]));
const pulleys = ['looseLeftPulley', 'fixedLeftPulley', 'fixedRightPulley', 'looseRightPulley'], rows = [];
const check = (band, pulley, time, kind) => {
  model.update(time); model.root.updateMatrixWorld(true);
  const transform = parts[pulley].matrixWorld.clone().invert().multiply(parts[band].matrixWorld);
  const result = meshPairDistance(trees[band], trees[pulley], transform, 0.002);
  rows.push({ band, pulley, time, kind, ...result });
  console.log(JSON.stringify({ band, pulley, time, kind, distance: result.distance, testedTriangles: result.testedTriangles }));
};
for (let stage = 0; stage < 2; stage += 1) {
  for (const offset of [0.537, 1.481]) {
    const time = stage * p.stageDuration + offset, state = model.root.userData.motion.atTime(time);
    for (const [i, band] of ['leftBelt', 'rightBelt'].entries()) {
      check(band, i === 0 ? 'largeDriver' : 'smallDriver', time, 'driver');
      check(band, pulleys[state.fromLanes[i]], time, 'selected-lower');
    }
  }
  const time = stage * p.stageDuration + p.dwellDuration + p.shiftDuration / 2;
  const state = model.root.userData.motion.atTime(time);
  for (const [i, band] of ['leftBelt', 'rightBelt'].entries()) {
    check(band, pulleys[state.fromLanes[i]], time, 'traverse-from');
    check(band, pulleys[state.toLanes[i]], time, 'traverse-to');
  }
}
await writeFile('artifacts/review/060-candidate-exact-contact.json', JSON.stringify({
  method: 'Exact distance between actual rendered Float32 triangles, including vertex/face, edge/edge and segment/face intersections. Both installed bands contact their upper driver and selected lower pulley in both speed modes, and both adjacent lower treads during each stopped traverse.', rows,
}, null, 2) + '\n');
if (rows.some(row => !row.witness || row.distance < 0.00012 || row.distance > 0.00020)) process.exitCode = 1;
