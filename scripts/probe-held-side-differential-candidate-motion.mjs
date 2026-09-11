import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeHeldSideDifferentialCandidate } from '../artifacts/review/061-candidate-model.mjs';
const model = makeHeldSideDifferentialCandidate(), { parts, blocks, geometry: p, motion } = model.root.userData;
const setTime = time => { model.update(time); model.root.updateMatrixWorld(true); };
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);
const groups = ['driver', 'output', 'loose', 'carrier', 'brake', 'planet'];
const dt = 1e-5, boundaries = p.selectionSequence.flatMap((_, stage) => [stage * p.stageDuration, stage * p.stageDuration + p.dwellDuration]);
const times = [-31.37, -2.11, 0.731, 1.527, 2.85, 4.127, 6.15, 7.91, 9.45, 10.71, 12.75, 17.61, 2 * p.cycleDuration, ...boundaries];
const report = { method: 'Finite differences of actual group angles and belt translations; independent common-apex velocity and differential relations; actual belt neutral-curve tangents; stopped shifts and pure transform/color seeking. Physical meshes are unchanged by section toggling.',
  poses: times.length, maximumAngularDerivativeError: 0, maximumAxialDerivativeError: 0, maximumFlowDerivativeError: 0,
  maximumRelativeNeutralSlip: 0, wrappedNeutralSamples: 0, maximumPitchContactVelocityError: 0, stoppedShifts: 0 };
for (const time of times) {
  setTime(time - dt); const beforeAngles = groups.map(name => blocks[name].rotation.z), beforeZ = parts.belt.position.z, before = model.root.userData.kinematics;
  setTime(time + dt); const afterAngles = groups.map(name => blocks[name].rotation.z), afterZ = parts.belt.position.z, after = model.root.userData.kinematics;
  setTime(time); const state = model.root.userData.kinematics;
  groups.forEach((name, i) => { report.maximumAngularDerivativeError = Math.max(report.maximumAngularDerivativeError,
    Math.abs((afterAngles[i] - beforeAngles[i]) / (2 * dt) - state[`${name}Speed`])); });
  report.maximumAxialDerivativeError = Math.max(report.maximumAxialDerivativeError, Math.abs((afterZ - beforeZ) / (2 * dt) - state.beltAxialSpeed));
  report.maximumFlowDerivativeError = Math.max(report.maximumFlowDerivativeError, Math.abs((after.beltDistance - before.beltDistance) / (2 * dt) - state.beltLinearSpeed));
  near(state.outputSpeed + state.brakeSpeed, 2 * state.carrierSpeed);
  near(state.planetSpeed * p.planetTeeth, p.sideTeeth * (state.outputSpeed - state.carrierSpeed));
  near(state.planetSpeed * p.planetTeeth, p.sideTeeth * (state.carrierSpeed - state.brakeSpeed));
  near(state.outputSpeed, state.selected * state.driverSpeed);
  if (state.selected > 0) near(state.looseSpeed, 0);
  if (state.shifting) {
    assert.ok(groups.every(name => state[`${name}Speed`] === 0)); near(state.beltLinearSpeed, 0);
    if (Math.abs(state.beltAxialSpeed) > 0.01) report.stoppedShifts += 1;
  }
  const axis = new THREE.Vector3(Math.cos(state.carrierAngle), Math.sin(state.carrierAngle), 0);
  const z = new THREE.Vector3(0, 0, 1), omegaPlanet = z.clone().multiplyScalar(state.carrierSpeed).addScaledVector(axis, state.planetSpeed);
  for (const sign of [-1, 1]) for (const scale of [0.6, 0.8, 1]) {
    const q = axis.clone().multiplyScalar(p.planetOuterDistance * scale).addScaledVector(z, sign * p.sideOuterDistance * scale);
    const omegaSide = z.clone().multiplyScalar(sign === -1 ? state.outputSpeed : state.brakeSpeed);
    const error = omegaPlanet.clone().cross(q).distanceTo(omegaSide.cross(q));
    report.maximumPitchContactVelocityError = Math.max(report.maximumPitchContactVelocityError, error);
  }
  if (state.driverSpeed > 1e-6) {
    const curve = parts.belt.userData.curve, speed = state.beltLinearSpeed;
    const lowerOmega = state.selected === 0 ? state.looseSpeed : state.selected === 1 ? state.outputSpeed : state.carrierSpeed;
    for (let i = 0; i < 1024; i += 1) {
      const u = (i + 0.371) / 1024, q = curve.getPointAt(u), tangent = curve.getTangentAt(u);
      let centerY, omega;
      if (q.y > p.driverHeight + 0.1 && Math.abs(Math.hypot(q.x, q.y - p.driverHeight) - p.beltPitchRadius) < 1e-8) {
        centerY = p.driverHeight; omega = state.driverSpeed;
      } else if (q.y < -0.1 && Math.abs(Math.hypot(q.x, q.y) - p.beltPitchRadius) < 1e-8) {
        centerY = 0; omega = lowerOmega;
      } else continue;
      report.maximumRelativeNeutralSlip = Math.max(report.maximumRelativeNeutralSlip,
        Math.hypot(tangent.x * speed + omega * (q.y - centerY), tangent.y * speed - omega * q.x) / Math.abs(speed));
      report.wrappedNeutralSamples += 1;
    }
  }
  const matrices = Object.values(parts).map(mesh => mesh.matrixWorld.clone()), colors = parts.belt.geometry.attributes.color.array.slice();
  setTime(time + 9.317); setTime(time);
  Object.values(parts).forEach((mesh, i) => assert.ok(mesh.matrixWorld.equals(matrices[i])));
  assert.deepEqual(parts.belt.geometry.attributes.color.array, colors);
  for (const section of [false, true]) {
    model.root.userData.setSectionView(section); model.root.updateMatrixWorld(true);
    Object.values(parts).forEach((mesh, i) => assert.ok(mesh.matrixWorld.equals(matrices[i])));
  }
}
for (const time of boundaries) {
  const before = motion.atTime(time - dt), after = motion.atTime(time + dt);
  near(before.driverSpeed, 0, 1e-8); near(after.driverSpeed, 0, 1e-8);
  near((after.driverSpeed - before.driverSpeed) / (2 * dt), 0, 0.0001);
  near((after.beltAxialSpeed - before.beltAxialSpeed) / (2 * dt), 0, 0.0002);
}
assert.ok(report.maximumAngularDerivativeError < 2e-7 && report.maximumAxialDerivativeError < 2e-7 && report.maximumFlowDerivativeError < 2e-7);
assert.ok(report.maximumRelativeNeutralSlip < 1e-9 && report.wrappedNeutralSamples > 3000 && report.stoppedShifts >= 4);
assert.ok(report.maximumPitchContactVelocityError < 1e-10);
await writeFile('artifacts/review/061-candidate-motion-check.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
