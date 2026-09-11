import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';
import { surfaceTriangles } from '../tests/helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[61]);
const { blocks: b, geometry: p } = model.root.userData;
const rows = [], crossover = [];
const treadMeshes = [];
b.driver.traverse(mesh => {
  if (mesh.userData.role === 'stepped-pulley-tread') treadMeshes.push(mesh);
});
const lowerBodies = [b.neutralPulley, b.directPulley, b.carrierPulley]
  .map(group => group.children.find(mesh => mesh.isMesh));
const sideDriverBody = b.sideDriver.userData.rotor.children.find(mesh => mesh.isMesh);
const sideInputBody = b.sidePulley.children.find(mesh => mesh.isMesh);
const query = (name, from, to, time, maxDistance = 0.05) => {
  const result = meshPairDistance(triangleTree(from.geometry), triangleTree(to.geometry),
    to.matrixWorld.clone().invert().multiply(from.matrixWorld), maxDistance);
  rows.push({ name, time, ...result });
};
for (const stage of [0, 1, 2, 4, 5, 6]) {
  const time = p.stageStarts[stage] + p.dwellDuration * 0.5;
  model.update(time); model.root.updateMatrixWorld(true);
  const selection = p.stageDefinitions[stage].selection;
  query(`stage-${stage}/left-band/upper-tread`, b.leftBelt.userData.mesh, treadMeshes[selection], time);
  query(`stage-${stage}/left-band/lower-body`, b.leftBelt.userData.mesh, lowerBodies[selection], time);
  query(`stage-${stage}/right-band/upper-body`, b.rightBelt.userData.mesh, sideDriverBody, time);
  query(`stage-${stage}/right-band/lower-body`, b.rightBelt.userData.mesh, sideInputBody, time);
  if (stage !== 4) continue;
  const faces = surfaceTriangles(b.rightBelt.userData.mesh.geometry);
  // Select actual disjoint central span skins by their opposite axial lifts.
  // The excluded tangent regions join their respective pulley wraps.
  const select = sign => new THREE.BufferGeometry().setFromPoints(faces.filter(face => {
    const points = [face.a, face.b, face.c];
    return points.every(point => sign * (point.z - p.sideLaneZ) > 0.03);
  }).flatMap(({ a, b: second, c }) => [a, second, c]));
  const positive = select(1), negative = select(-1);
  crossover.push({ time, positiveTriangles: positive.attributes.position.count / 3,
    negativeTriangles: negative.attributes.position.count / 3,
    ...meshPairDistance(triangleTree(positive), triangleTree(negative), new THREE.Matrix4(), 0.5) });
}
const report = { movement: 62, status: 'uncorrected-baseline',
  method: 'Actual 3D triangle gaps between the two installed bands and each selected pulley body at six dwell midpoints. Zero distance denotes intersecting skins; distances at the search cap without a witness are lower bounds. The crossed-band check isolates disjoint lifted central spans; it does not certify the entire loop or marker clearance.',
  rows, crossover };
await writeFile('artifacts/review/062-belt-contact-baseline.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ rows: rows.map(({ name, distance }) => ({ name, distance })), crossover }, null, 2));
