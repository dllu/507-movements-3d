import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeStarMangleCandidate } from '../artifacts/review/054-candidate-model.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const profilePath = process.env.PROFILE_INPUT ?? 'artifacts/review/054-candidate32-shifted-profiles.json';
const mapPath = process.env.MAP_INPUT ?? 'artifacts/review/054-candidate32-shifted-contact-map.json';
const model = makeStarMangleCandidate(JSON.parse(await readFile(profilePath, 'utf8')),
  { contactMap: JSON.parse(await readFile(mapPath, 'utf8')) });
const { parts, geometry: p } = model.root.userData, cache = new Map();
const tree = mesh => {
  if (!cache.has(mesh.geometry)) cache.set(mesh.geometry, triangleTree(mesh.geometry));
  return cache.get(mesh.geometry);
};
const ey = new THREE.Vector3(0, 1, 0), ez = new THREE.Vector3(0, 0, 1);
const outputDrag = Number(process.env.OUTPUT_DRAG ?? 0.03), bearingDrag = Number(process.env.BEARING_DRAG ?? 0.2);
const phases = Array.from({ length: 16 }, (_, i) => p.cycleTravel * (i + 0.327) / 16);
for (const start of [p.runTravel, p.returnStart]) for (const fraction of [0.031, 0.125, 0.25, 0.375, 0.4999, 0.5, 0.5001, 0.625, 0.75, 0.875, 0.969]) {
  phases.push(start + Math.PI * fraction);
}
const report = { status: 'quasistatic-force-diagnostic', profilePath, mapPath, outputDrag, bearingDrag,
  constraints: 'Ideal external input bearing: X fixed; Y²−Z²=R²−rp², with end stops at Z=±rp. Wheel output has a fixed axis. Smooth collar/crab contacts are frictionless. This evaluates compressive reactions under output and bearing drag; it is not a mass/inertia simulation.', poses: [] };
for (const travel of phases) {
  model.root.userData.updateTravel(travel); model.root.updateMatrixWorld(true);
  const state = model.root.userData.kinematics, pinionTree = tree(parts.pinion);
  const inverse = parts.pinion.matrixWorld.clone().invert(); let nearest = { distance: 0.002 };
  for (const tooth of parts.teeth) {
    const result = meshPairDistance(tree(tooth), pinionTree, inverse.clone().multiply(tooth.matrixWorld), nearest.distance);
    if (result.distance < nearest.distance) nearest = { ...result, tooth: tooth.userData.index };
  }
  if (!nearest.witness || nearest.distance <= 0) throw new Error(`Missing separated contact at ${travel}`);
  const wheelPoint = new THREE.Vector3().fromArray(nearest.witness.a).applyMatrix4(parts.pinion.matrixWorld);
  const pinionPoint = new THREE.Vector3().fromArray(nearest.witness.b).applyMatrix4(parts.pinion.matrixWorld);
  const gearNormal = wheelPoint.clone().sub(pinionPoint).normalize();
  const center = new THREE.Vector3(0, state.centerY, state.centerZ);
  const gearMoment = ez.dot(wheelPoint.clone().cross(gearNormal));
  const inputMoment = gearNormal.dot(ey.clone().cross(pinionPoint.clone().sub(center)));
  const slotNormal = new THREE.Vector3(0, 1, -state.centerZ / state.centerY).normalize();
  const centerVelocity = new THREE.Vector3(0, state.centerVelocityY, state.centerVelocityZ);
  const wheelLoad = Math.abs(state.wheelAngularSpeed) < 1e-9 ? 0 : -outputDrag * Math.sign(state.wheelAngularSpeed);
  let gearForce, guideForce = 0, slotForce, stopForce = 0, guideVelocityResidual = 0;
  let guideFace = null, signedGuideReaction = 0, actualGuideGap = null, guideNormalAlignment = null, rayOffset = 0;
  if (state.branch.endsWith('crossover')) {
    const last = state.branch === 'last-crossover', guide = parts.crabEnds[last ? 0 : 1];
    const a = travel - (last ? p.runTravel : p.returnStart), centerAt = guide.geometry.userData.centerAt;
    const derivative = centerAt(a + 1e-5).sub(centerAt(a - 1e-5)).multiplyScalar(5e4);
    const guideNormal = new THREE.Vector3(0, -derivative.z, derivative.y).normalize().applyAxisAngle(ez,
      state.wheelAngle + guide.geometry.userData.terminal);
    const guidePoint = center.clone().addScaledVector(ey, -0.265).addScaledVector(guideNormal, 0.1);
    const guideMoment = ez.dot(guidePoint.clone().cross(guideNormal));
    const matrix = new THREE.Matrix3().set(gearMoment, guideMoment, 0,
      -gearNormal.y, -guideNormal.y, slotNormal.y, -gearNormal.z, -guideNormal.z, slotNormal.z);
    if (Math.abs(matrix.determinant()) < 1e-12) throw new Error(`Singular force system at ${travel}`);
    const result = new THREE.Vector3(-wheelLoad, bearingDrag * centerVelocity.y, bearingDrag * centerVelocity.z).applyMatrix3(matrix.invert());
    [gearForce, guideForce, slotForce] = result.toArray();
    guideVelocityResidual = guideNormal.dot(centerVelocity.clone().sub(ez.clone().cross(guidePoint).multiplyScalar(state.wheelAngularSpeed)));
    signedGuideReaction = guideForce;
    guideFace = guideForce < 0 ? 'return' : 'outer';
    const actualGuide = guideForce < 0 ? parts.crabReturns[last ? 0 : 1] : guide;
    if (!actualGuide) throw new Error(`A real opposing guide face is required at ${travel}`);
    if (guideForce < 0) guideNormal.negate();
    guideForce = Math.abs(guideForce);
    const ray = new THREE.Raycaster(center.clone().addScaledVector(ey, -0.265), guideNormal);
    let guideHit = ray.intersectObject(actualGuide, false)[0];
    // At the exact reversal apex, the ray can coincide with a tessellation
    // seam. Check immediately adjacent rays on the same physical surfaces.
    if (!guideHit) for (const offset of [-1e-9, 1e-9]) {
      ray.ray.origin.z = center.z + offset; guideHit = ray.intersectObject(actualGuide, false)[0];
      if (guideHit) { rayOffset = offset; break; }
    }
    parts.collar.material.side = THREE.DoubleSide;
    const collarHit = ray.intersectObject(parts.collar, false).at(-1);
    if (!guideHit || !collarHit) throw new Error(`Missing physical collar/guide face at ${travel}`);
    actualGuideGap = guideHit.distance - collarHit.distance;
    guideNormalAlignment = -guideHit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(actualGuide.matrixWorld)).dot(guideNormal);
  } else {
    gearForce = -wheelLoad / gearMoment;
    const stopNormal = new THREE.Vector3(0, state.centerZ / state.centerY, 1).normalize().multiplyScalar(-Math.sign(state.centerZ));
    stopForce = gearForce * gearNormal.dot(stopNormal); slotForce = gearForce * gearNormal.dot(slotNormal);
  }
  const inputTorque = gearForce * inputMoment, inputPower = inputTorque * p.inputSpeed;
  const dissipatedPower = outputDrag * Math.abs(state.wheelAngularSpeed) + bearingDrag * centerVelocity.lengthSq();
  const geometricRelative = ez.clone().cross(wheelPoint).multiplyScalar(state.wheelDerivative)
    .sub(new THREE.Vector3(0, state.centerDY, state.centerDZ));
  const contactInputDerivative = gearNormal.dot(geometricRelative) / inputMoment;
  const result = { travel, branch: state.branch, gap: nearest.distance, tooth: nearest.tooth,
    gearForce, guideForce, slotForce, stopForce, inputTorque, inputPower, dissipatedPower,
    relativePowerError: (inputPower - dissipatedPower) / Math.max(1e-9, dissipatedPower),
    inputMoment, contactInputDerivative, mappedInputDerivative: state.inputDerivative, guideVelocityResidual,
    guideFace, signedGuideReaction, actualGuideGap, guideNormalAlignment, rayOffset };
  report.poses.push(result); console.log(JSON.stringify(result));
}
report.summary = { poses: report.poses.length,
  minimumGearForce: Math.min(...report.poses.map(v => v.gearForce)), minimumGuideForce: Math.min(...report.poses.map(v => v.guideForce)),
  minimumStopForce: Math.min(...report.poses.map(v => v.stopForce)), minimumInputTorque: Math.min(...report.poses.map(v => v.inputTorque)),
  maximumRelativePowerError: Math.max(...report.poses.map(v => Math.abs(v.relativePowerError))),
  maximumGuideVelocityResidual: Math.max(...report.poses.map(v => Math.abs(v.guideVelocityResidual))),
  minimumGuideGap: Math.min(...report.poses.filter(v => v.actualGuideGap !== null).map(v => v.actualGuideGap)),
  maximumGuideGap: Math.max(...report.poses.filter(v => v.actualGuideGap !== null).map(v => v.actualGuideGap)),
  minimumGuideNormalAlignment: Math.min(...report.poses.filter(v => v.guideNormalAlignment !== null).map(v => v.guideNormalAlignment)) };
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/054-candidate32-shifted-forces.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary));
