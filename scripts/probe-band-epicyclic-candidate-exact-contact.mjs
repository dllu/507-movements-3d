import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeBandEpicyclicCandidate } from '../artifacts/review/057-candidate-model.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const model = makeBandEpicyclicCandidate(), { parts, geometry: p } = model.root.userData;
const names = ['sun', 'planet', 'ring', 'ringPulley', 'sunDrum', 'driverPulley', 'outerBelt', 'innerBelt'];
const trees = Object.fromEntries(names.map(name => [name, triangleTree(parts[name].geometry)]));
const poses = [];
for (const [a, b, times] of [['planet', 'sun', [0.0131, 0.0579, 0.1197]], ['planet', 'ring', [0.0131, 0.0579, 0.1197]],
  ['outerBelt', 'ringPulley', [0, 0.173]], ['outerBelt', 'driverPulley', [0, 0.173]],
  ['innerBelt', 'sunDrum', [0, 0.173]], ['innerBelt', 'driverPulley', [0, 0.173]]]) {
  for (const time of times) {
    model.update(time); model.root.updateMatrixWorld(true);
    const transform = parts[b].matrixWorld.clone().invert().multiply(parts[a].matrixWorld);
    const result = meshPairDistance(trees[a], trees[b], transform, 0.002);
    poses.push({ a, b, time, ...result }); console.log(JSON.stringify({ a, b, time, distance: result.distance, testedTriangles: result.testedTriangles }));
  }
}
const rope = parts.innerBelt, curveLengths = rope.userData.curve.getCurveLengths(), length = curveLengths.at(-1);
const span = (low, high) => {
  const g = rope.geometry, positions = [], n = g.index?.count ?? g.attributes.position.count;
  for (let i = 0; i < n; i += 3) {
    const indices = [0, 1, 2].map(j => g.index ? g.index.getX(i + j) : i + j);
    if (indices.some(index => g.attributes.uv.getX(index) < low || g.attributes.uv.getX(index) > high)) continue;
    for (const index of indices) positions.push(g.attributes.position.getX(index), g.attributes.position.getY(index), g.attributes.position.getZ(index));
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return triangleTree(geometry);
};
// These are open subsets of the actual tube skin. Closest triangle distance
// needs no assumed solidity; the two free spans are far apart at their ends.
const first = span(0, curveLengths[0] / length), second = span(curveLengths[1] / length, curveLengths[2] / length);
const crossover = meshPairDistance(first, second, new THREE.Matrix4(), 0.01);
console.log(JSON.stringify({ crossover }));
const report = { method: 'Exact distances between actual tessellated skins: vertex/face, edge/edge, and segment/face intersection checks. The cord crossover uses UV-delimited free-span subsets of the rendered tube.', poses, crossover };
await writeFile('artifacts/review/057-candidate-exact-contact.json', JSON.stringify(report, null, 2) + '\n');
if ([...poses, crossover].some(v => !v.witness || v.distance <= 1e-6)) process.exitCode = 1;
