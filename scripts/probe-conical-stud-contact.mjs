// Diagnostic for unresolved 037 engagement. This samples actual stud surfaces
// against actual pinion flank triangles, separately from body-clearance tests.
import * as THREE from 'three';
import { readFile, writeFile } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));
const model = createMovementModel(catalog.movements[36]);
const geometry = model.root.userData.geometry;
const { toothedCone, studs, fullFaceTeeth } = model.root.userData.blocks;
const turn = 2 * Math.PI;
const columns = toothedCone.userData.unitOutline.length / geometry.toothedConeTeeth;
const faces = [];
for (const tooth of fullFaceTeeth) {
  const positions = tooth.geometry.attributes.position;
  const rotation = new THREE.Matrix4().makeRotationZ(tooth.rotation.z);
  for (let column = 0; column < columns; column += 1) {
    // Each contour segment has two flank triangles followed by two cap
    // triangles. All studs are strictly between the axial ends of the cone.
    faces.push([0, 3].map((offset) => new THREE.Triangle(...[0, 1, 2].map((vertex) =>
      new THREE.Vector3().fromBufferAttribute(positions, column * 12 + offset + vertex)
        .applyMatrix4(rotation)))));
  }
}
const clouds = studs.map((stud) => {
  const positions = stud.geometry.attributes.position;
  const index = stud.geometry.index;
  const vertices = Array.from({ length: positions.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(positions, i));
  const points = [...vertices];
  for (let i = 0; i < index.count; i += 3) {
    points.push(vertices[index.getX(i)].clone()
      .add(vertices[index.getX(i + 1)]).add(vertices[index.getX(i + 2)]).multiplyScalar(1 / 3));
  }
  return points;
});
const point = new THREE.Vector3();
const nearest = new THREE.Vector3();
const samples = [];
let minimum = Infinity;
let maximum = 0;
let worst;
const start = performance.now();
for (let phase = 0; phase < 256; phase += 1) {
  model.update(geometry.cycleDuration * (phase + 0.371) / 256, 0);
  model.root.updateMatrixWorld(true);
  const inverse = toothedCone.userData.rotor.matrixWorld.clone().invert();
  let distanceSquared = 0.25 ** 2;
  for (const [pinIndex, stud] of studs.entries()) {
    const transform = inverse.clone().multiply(stud.matrixWorld);
    for (const localPoint of clouds[pinIndex]) {
      point.copy(localPoint).applyMatrix4(transform);
      const radius = Math.hypot(point.x, point.y);
      const pitchRadius = geometry.meanPitchRadius + geometry.radiusSlope * point.z;
      if (radius > pitchRadius * (1 + 2 / geometry.toothedConeTeeth)
        + Math.sqrt(distanceSquared) * Math.hypot(1, geometry.radiusSlope)) continue;
      const column = Math.floor(THREE.MathUtils.euclideanModulo(Math.atan2(point.y, point.x), turn)
        / turn * faces.length);
      const window = Math.ceil(Math.asin(Math.min(1, Math.sqrt(distanceSquared) / radius))
        / turn * faces.length) + 1;
      for (let edge = column - window; edge <= column + window; edge += 1) {
        for (const triangle of faces[THREE.MathUtils.euclideanModulo(edge, faces.length)]) {
          triangle.closestPointToPoint(point, nearest);
          distanceSquared = Math.min(distanceSquared, point.distanceToSquared(nearest));
        }
      }
    }
  }
  const gap = Math.sqrt(distanceSquared);
  minimum = Math.min(minimum, gap);
  if (gap > maximum) {
    maximum = gap;
    worst = { phase, output: model.root.userData.kinematics.outputProgress,
      input: model.root.userData.kinematics.inputAngle, gap };
  }
  samples.push(gap);
}
const result = { ms: performance.now() - start, minimum, maximum, worst, samples };
await writeFile(new URL('../artifacts/review/conical-stud-euclidean-contact.json', import.meta.url),
  JSON.stringify(result, null, 2));
console.log(JSON.stringify({ minimum, maximum, worst }));
if (maximum > 0.004) {
  console.error('037 continuous engagement remains unresolved.');
  process.exitCode = 1;
}
