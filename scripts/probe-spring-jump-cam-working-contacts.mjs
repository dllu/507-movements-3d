import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeSpringJumpCam } from '../src/simulation/spring-jump-cam.js';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const model = makeSpringJumpCam(), { parts, geometry: p } = model.root.userData, h = 1e-5;
const rigidTrees = new Map(), tree = mesh => {
  if (mesh === parts.leafSpring) return triangleTree(mesh.geometry);
  if (!rigidTrees.has(mesh)) rigidTrees.set(mesh, triangleTree(mesh.geometry));
  return rigidTrees.get(mesh);
};
const materialPoint = (mesh, world) => {
  const local = world.clone().applyMatrix4(mesh.matrixWorld.clone().invert());
  if (mesh !== parts.leafSpring) return () => local.clone().applyMatrix4(mesh.matrixWorld);
  const g = mesh.geometry, attr = g.attributes.position, index = g.index;
  let best = Infinity, found = null;
  for (let i = 0; i < index.count; i += 3) {
    const ids = [0, 1, 2].map(j => index.getX(i + j));
    const vertices = ids.map(j => new THREE.Vector3().fromBufferAttribute(attr, j));
    const triangle = new THREE.Triangle(...vertices);
    if (triangle.getArea() < 1e-12) continue;
    const point = triangle.closestPointToPoint(local, new THREE.Vector3()), distance = point.distanceTo(local);
    if (distance >= best) continue;
    best = distance; found = { ids, weights: triangle.getBarycoord(point, new THREE.Vector3()).toArray() };
  }
  if (best > 1e-6) throw new Error(`Spring witness misses its actual material triangle by ${best}`);
  return () => found.ids.reduce((sum, j, k) => sum.addScaledVector(
    new THREE.Vector3().fromBufferAttribute(attr, j), found.weights[k]), new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
};
const pairs = [['camPlate', 'rollerTread'], ['leafSpring', 'followerLever'], ['drivingPin', 'halfCutSleeveEnd']];
const count = Number(process.env.PROBE_POSES ?? 49);
const times = Array.from({ length: count }, (_, i) => p.cycleDuration * (i + 0.317) / count);
for (let i = 0; i <= 24; i += 1) times.push(p.releaseTime + 0.005 + i * 0.025);
times.push(p.releaseTime - 1e-4, p.releaseTime + 1e-4, p.catchTime - 1e-4, p.catchTime + 1e-4);
const rows = [];
for (const [pose, time] of times.entries()) {
  model.update(time); model.root.updateMatrixWorld(true);
  const state = model.root.userData.kinematics, contacts = [];
  const leafStep = Math.min(0.0005, Math.abs(time - p.releaseTime) / 4, Math.abs(time - p.catchTime) / 4);
  for (const [aName, bName] of pairs) {
    const a = parts[aName], b = parts[bName], transform = b.matrixWorld.clone().invert().multiply(a.matrixWorld);
    const exact = meshPairDistance(tree(a), tree(b), transform, 2);
    if (!exact.witness) throw new Error(`No actual-solid contact witness for ${aName}/${bName}`);
    const pa = new THREE.Vector3().fromArray(exact.witness.a).applyMatrix4(b.matrixWorld);
    const pb = new THREE.Vector3().fromArray(exact.witness.b).applyMatrix4(b.matrixWorld);
    const normal = pb.clone().sub(pa).normalize();
    contacts.push({ a: aName, b: bName, gap: exact.distance, witness: exact.witness,
      normal, pa, pb, atA: materialPoint(a, pa), atB: materialPoint(b, pb) });
  }
  model.update(time - h); model.root.updateMatrixWorld(true);
  for (const c of contacts) { c.beforeA = c.atA(); c.beforeB = c.atB(); }
  const beforeEnergy = model.root.userData.kinematics.springEnergy;
  model.update(time + h); model.root.updateMatrixWorld(true);
  const energyDerivative = (model.root.userData.kinematics.springEnergy - beforeEnergy) / (2 * h);
  for (const c of contacts) { c.afterA = c.atA(); c.afterB = c.atB(); }
  // Stored spring positions are Float32. A 10-microsecond difference can
  // amplify one coordinate ULP into a false contact velocity. Use a larger
  // span for this deforming material point, and retain short rigid differences.
  model.update(time - leafStep); model.root.updateMatrixWorld(true);
  const leafContact = contacts.find(c => c.a === 'leafSpring'), leafBefore = leafContact.atA();
  model.update(time + leafStep); model.root.updateMatrixWorld(true);
  const leafVelocity = leafContact.atA().sub(leafBefore).divideScalar(2 * leafStep);
  const checked = contacts.map(c => {
    const va = c.a === 'leafSpring' ? leafVelocity : c.afterA.sub(c.beforeA).divideScalar(2 * h);
    const vb = c.afterB.sub(c.beforeB).divideScalar(2 * h);
    const relative = vb.clone().sub(va), scale = Math.max(0.1, va.length(), vb.length());
    const normalResidual = Math.abs(relative.dot(c.normal)), totalResidual = relative.length();
    const out = { a: c.a, b: c.b, gap: c.gap, pointA: c.pa.toArray(), pointB: c.pb.toArray(), normal: c.normal.toArray(),
      velocityA: va.toArray(), velocityB: vb.toArray(), normalResidual, totalResidual,
      relativeNormalResidual: normalResidual / scale, relativeTotalResidual: totalResidual / scale };
    if (c.a === 'camPlate') {
      const arm = c.pb.clone().sub(new THREE.Vector3(...p.followerPivot, c.pb.z));
      const followerMoment = arm.cross(c.normal).z;
      const force = state.leafForce * state.leaf.arm / followerMoment;
      out.normalForce = force; out.torqueOnCam = -c.pa.clone().cross(c.normal).z * force;
      out.springTorqueResidual = out.torqueOnCam - state.springTorque;
      out.normalPowerResidual = force * relative.dot(c.normal);
    } else if (c.a === 'leafSpring') {
      out.normalForce = state.leafForce;
      out.springPowerResidual = state.leafForce * va.dot(c.normal) + energyDerivative;
      out.followerPowerResidual = state.leafForce * vb.dot(c.normal) + energyDerivative;
    } else if (state.pinEngaged) {
      out.outputMoment = c.pb.clone().cross(c.normal).z;
      out.normalForce = state.pinTorque / out.outputMoment;
    }
    return out;
  });
  rows.push({ time, stage: state.stage, pinEngaged: state.pinEngaged, camLead: state.camLead,
    camSpeed: state.camAngularSpeed, leafDifferenceStep: leafStep, contacts: checked });
  if (pose % 16 === 0) console.log({ pose, time, gaps: checked.map(c => c.gap) });
}
const summary = pairs.map(([a, b]) => {
  const contacts = rows.filter(row => a !== 'drivingPin' || row.pinEngaged).map(row => row.contacts.find(c => c.a === a));
  return { a, b, poses: contacts.length, minimumGap: Math.min(...contacts.map(c => c.gap)), maximumGap: Math.max(...contacts.map(c => c.gap)),
    minimumForce: Math.min(...contacts.map(c => c.normalForce)),
    maximumRelativeNormalResidual: Math.max(...contacts.map(c => c.relativeNormalResidual)),
    maximumRelativeTotalResidual: Math.max(...contacts.map(c => c.relativeTotalResidual)),
    maximumSpringTorqueResidual: Math.max(...contacts.map(c => Math.abs(c.springTorqueResidual ?? 0))),
    maximumSpringPowerResidual: Math.max(...contacts.map(c => Math.abs(c.springPowerResidual ?? 0))),
    maximumFollowerPowerResidual: Math.max(...contacts.map(c => Math.abs(c.followerPowerResidual ?? 0))) };
});
await writeFile('artifacts/review/064-candidate-working-contacts.json', JSON.stringify({ movement: 64,
  method: 'Exact closest Float32 triangles at rendered transforms, followed by central differences of the same rigid material points or barycentric points on the deforming spring. Forces use actual separating normals and moment arms. Spring/follower contact may slide; cam/roller contact should roll. Pin checks select engaged poses. This diagnostic does not certify other hardware or the worm pair.', summary, rows }, null, 2) + '\n');
console.log(summary);
if (summary.some(row => row.minimumGap <= 1e-6 || row.minimumForce <= 0 || row.maximumRelativeNormalResidual > 0.02)
  || summary[0].maximumRelativeTotalResidual > 0.02) process.exitCode = 1;
