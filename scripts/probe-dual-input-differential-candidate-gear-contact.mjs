import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeDualInputDifferentialCandidate } from '../artifacts/review/062-candidate-model.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';
import { surfaceTriangles } from '../tests/helpers/solid-surface.mjs';
const model = makeDualInputDifferentialCandidate(), { parts, geometry: p, motion } = model.root.userData;
const configuration = process.env.PROBE_CONFIGURATION ?? 'open';
model.root.userData.setConfiguration(configuration);
const names = ['planetTeeth', 'outputGearTeeth', 'sideGearTeeth'];
const trees = Object.fromEntries(names.map(name => [name, triangleTree(parts[name].geometry)]));
const direction = Number(process.env.PROBE_DIRECTION ?? 0);
const targets = names.slice(1).filter(name => !process.env.PROBE_PAIR || name === process.env.PROBE_PAIR);
const selectedFaces = {};
if (direction) for (const name of targets) {
  // A compressive load acts opposite the outward target-face normal.
  // Ignore meridional heel/toe caps, whose torque arm is only faceting noise.
  const axisSign = name === 'outputGearTeeth' ? -1 : 1;
  const faces = surfaceTriangles(parts[name].geometry).filter(face => {
    const center = face.getMidpoint(new THREE.Vector3()), normal = face.getNormal(new THREE.Vector3());
    return direction * axisSign * -center.clone().cross(normal).z > 0.1 * Math.hypot(center.x, center.y);
  });
  selectedFaces[name] = faces.length;
  trees[name] = triangleTree(new THREE.BufferGeometry().setFromPoints(faces.flatMap(({ a, b, c }) => [a, b, c])));
}
const count = Number(process.env.PROBE_POSES ?? 65), rows = [];
for (let i = 0; i < count; i += 1) {
  const delta = motion.plans[configuration].deltas[2];
  const progress = (2 * Math.PI / p.sideTeeth) / (delta.output - delta.carrier) * (i + 0.317) / count;
  let low = 0, high = 1;
  for (let step = 0; step < 50; step += 1) {
    const u = (low + high) / 2;
    if (u ** 3 * (10 - 15 * u + 6 * u ** 2) < progress) low = u; else high = u;
  }
  const time = p.stageStarts[2] + p.dwellDurations[2] * (low + high) / 2;
  model.update(time); model.root.updateMatrixWorld(true);
  const state = motion.atTime(time, configuration), axis = new THREE.Vector3(Math.cos(state.carrierAngle), Math.sin(state.carrierAngle), 0);
  const apex = new THREE.Vector3(0, 0, p.bevelCenterZ), z = new THREE.Vector3(0, 0, 1);
  for (const name of targets) {
    const a = parts.planetTeeth, b = parts[name];
    const result = meshPairDistance(trees.planetTeeth, trees[name], b.matrixWorld.clone().invert().multiply(a.matrixWorld), 0.01);
    let residual = null, torqueA = null, torqueB = null;
    if (result.witness && result.distance > 1e-10) {
      const pa = new THREE.Vector3().fromArray(result.witness.a).applyMatrix4(b.matrixWorld);
      const pb = new THREE.Vector3().fromArray(result.witness.b).applyMatrix4(b.matrixWorld);
      const normal = pb.clone().sub(pa).normalize();
      torqueA = pa.clone().sub(apex).cross(normal.clone().negate()).dot(axis);
      torqueB = pb.clone().sub(apex).cross(normal).dot(z);
      const powerA = torqueA * state.planetSpeed;
      const powerB = torqueB * ((name === 'outputGearTeeth' ? state.outputSpeed : state.sideSpeed) - state.carrierSpeed);
      residual = Math.abs(powerA + powerB) / Math.max(Math.abs(powerA), Math.abs(powerB));
    }
    rows.push({ name, direction, time, carrierAngle: state.carrierAngle, distance: result.distance, torqueA, torqueB, residual, witness: result.witness });
  }
}
const summary = targets.map(name => {
  const r = rows.filter(row => row.name === name);
  return { name, direction, rows: r.length, minimumGap: Math.min(...r.map(row => row.distance)), maximumGap: Math.max(...r.map(row => row.distance)),
    maximumPowerResidual: Math.max(...r.map(row => row.residual ?? Infinity)), intersections: r.filter(row => row.distance < 1e-10).length };
});
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/062-candidate-gear-contact.json', JSON.stringify({
  method: direction ? 'Actual Float32 target-flank triangles selected by the sign of compressive torque about the physical side-gear axis; meridional caps excluded. Source planet retains all actual triangles. One complete carrier-relative engagement in the quick dwell. Normal-force power is evaluated in the carrier frame. Full-skin collision checks are separate.'
    : 'Actual 3D tooth triangles over one complete carrier-relative engagement in the quick dwell. Closest bilateral witness; pairwise normal-force power evaluated in the carrier frame.',
  configuration, selectedFaces, summary, rows,
}, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (rows.some(row => !row.witness || row.distance < 0.00002 || row.distance > 0.00008
  || row.residual > 0.004 || (direction && direction * row.torqueB <= 0))) process.exitCode = 1;
