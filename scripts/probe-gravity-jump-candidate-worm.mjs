import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeGravityJumpCandidate } from './lib/gravity-jump-candidate.mjs';
import { solidSurface, surfacePoints, surfaceTriangles } from '../tests/helpers/solid-surface.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const factory = process.env.REFINED ? (await import('./lib/gravity-jump-refined-candidate.mjs')).makeGravityJumpRefinedCandidate : makeGravityJumpCandidate;
const model = factory(), { parts, geometry: p } = model.root.userData;
const worm = parts.wormThread, wheel = parts.wormWheel;
const data = [worm, wheel].map(mesh => ({ mesh, solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry), tree: triangleTree(mesh.geometry) }));
const workingFaces = surfaceTriangles(wheel.geometry).filter(face => {
  const q = face.getMidpoint(new THREE.Vector3()), n = face.getNormal(new THREE.Vector3());
  return -q.clone().cross(n).z > Math.hypot(q.x, q.y) * 0.1;
});
const workingTree = triangleTree(new THREE.BufferGeometry().setFromPoints(workingFaces.flatMap(face => [face.a, face.b, face.c])));
const count = Number(process.env.PROBE_POSES ?? 65), rows = [], period = 2 * Math.PI / (p.wheelTeeth * p.driverSpeed);
for (let i = 0; i < count; i += 1) {
  const time = period * (i + 0.317) / count;
  model.update(time); model.root.updateMatrixWorld(true);
  let checks = 0, inside = 0, maximumDepth = 0;
  for (const [from, to] of [[data[0], data[1]], [data[1], data[0]]]) {
    const matrix = to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
    for (const local of from.points) {
      const point = local.clone().applyMatrix4(matrix); checks += 1;
      if (!to.solid.inside(point)) continue;
      const depth = to.solid.distance(point); if (depth < 1e-6) continue;
      inside += 1; maximumDepth = Math.max(maximumDepth, depth);
    }
  }
  const transform = wheel.matrixWorld.clone().invert().multiply(worm.matrixWorld);
  const exact = meshPairDistance(data[0].tree, workingTree, transform, 0.025);
  let outputTorque = null, inputTorque = null, residual = null;
  if (exact.witness && exact.distance > 1e-10) {
    const a = new THREE.Vector3().fromArray(exact.witness.a).applyMatrix4(wheel.matrixWorld);
    const b = new THREE.Vector3().fromArray(exact.witness.b).applyMatrix4(wheel.matrixWorld);
    const force = b.clone().sub(a).normalize(), center = new THREE.Vector3(0, -p.wormCenterDistance, 0);
    outputTorque = b.clone().cross(force).z;
    inputTorque = a.clone().sub(center).cross(force.clone().negate()).dot(new THREE.Vector3(-1, 0, 0));
    const inputPower = inputTorque * p.wheelTeeth * p.driverSpeed, outputPower = outputTorque * p.driverSpeed;
    residual = Math.abs(inputPower + outputPower) / Math.max(Math.abs(inputPower), Math.abs(outputPower));
  }
  rows.push({ time, checks, inside, maximumDepth, gap: exact.distance, witness: exact.witness, outputTorque, inputTorque, residual });
  if (i % 8 === 0) console.log({ pose: i, inside, gap: exact.distance, residual });
}
const summary = { poses: rows.length, checks: rows.reduce((sum, row) => sum + row.checks, 0), inside: rows.reduce((sum, row) => sum + row.inside, 0),
  minimumGap: Math.min(...rows.map(row => row.gap)), maximumGap: Math.max(...rows.map(row => row.gap)),
  maximumPowerResidual: Math.max(...rows.map(row => row.residual ?? Infinity)), minimumOutputTorque: Math.min(...rows.map(row => row.outputTorque ?? -Infinity)) };
const report = { movement: 66, method: 'Actual generated worm and wheel skins over one complete input revolution. Bidirectional containment uses both complete solids. Triangle distances select wheel flanks with positive compressive output torque; normal-force input/output power is evaluated around the physical world axes. This is a candidate diagnostic; zero exit alone is not full acceptance.', summary, rows };
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/066-candidate-worm.json', JSON.stringify(report, null, 2) + '\n');
console.log(summary); if (summary.inside || summary.minimumGap <= 1e-6 || summary.minimumOutputTorque <= 0 || summary.maximumPowerResidual > 0.02) process.exitCode = 1;
