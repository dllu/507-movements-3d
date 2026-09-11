import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { makeDualBeltSpeedsCandidate } from '../artifacts/review/060-candidate-model.mjs';

const model = makeDualBeltSpeedsCandidate(), { parts, blocks, geometry: p, motion } = model.root.userData;
const setTime = time => { model.update(time); model.root.updateMatrixWorld(true); };
const dt = 1e-5, boundaries = [0, p.dwellDuration, p.stageDuration, p.stageDuration + p.dwellDuration, p.cycleDuration];
const times = [-13.37, -2.11, 0.731, 1.527, 2.85, 3.827, 4.781, 6.15, 9.14, 13.79, ...boundaries];
const report = { method: 'Finite differences of actual rigid group angles and belt translations; neutral-fiber tangent velocities compared with the corresponding driver and selected lower pulley rotations; stopped shifts and repeatable geometry/material seeking.',
  poses: times.length, maximumAngularDerivativeError: 0, maximumAxialDerivativeError: 0, maximumFlowDerivativeError: 0,
  maximumRelativeNeutralSlip: 0, wrappedNeutralSamples: 0, checkedStoppedTraversals: 0 };
const groupNames = ['driver', 'output', 'looseLeft', 'looseRight'], bandNames = ['leftBelt', 'rightBelt'];
for (const time of times) {
  setTime(time - dt);
  const beforeAngles = groupNames.map(name => blocks[name].rotation.z), beforeZ = bandNames.map(name => parts[name].position.z);
  const before = model.root.userData.kinematics;
  setTime(time + dt);
  const afterAngles = groupNames.map(name => blocks[name].rotation.z), afterZ = bandNames.map(name => parts[name].position.z);
  const after = model.root.userData.kinematics;
  setTime(time);
  const state = model.root.userData.kinematics;
  for (const [i, name] of groupNames.entries()) report.maximumAngularDerivativeError = Math.max(report.maximumAngularDerivativeError,
    Math.abs((afterAngles[i] - beforeAngles[i]) / (2 * dt) - state[`${name}Speed`]));
  for (let i = 0; i < 2; i += 1) {
    report.maximumAxialDerivativeError = Math.max(report.maximumAxialDerivativeError,
      Math.abs((afterZ[i] - beforeZ[i]) / (2 * dt) - state.beltAxialSpeeds[i]));
    report.maximumFlowDerivativeError = Math.max(report.maximumFlowDerivativeError,
      Math.abs((after.beltDistances[i] - before.beltDistances[i]) / (2 * dt) - state.beltLinearSpeeds[i]));
  }
  if (state.shifting) {
    assert.ok(groupNames.every(name => state[`${name}Speed`] === 0));
    assert.ok(state.beltLinearSpeeds.every(speed => speed === 0));
    if (state.beltAxialSpeeds.every(speed => Math.abs(speed) > 0.01)) {
      assert.ok(state.beltAxialSpeeds[0] * state.beltAxialSpeeds[1] > 0, 'both bands traverse in the same axial direction');
      report.checkedStoppedTraversals += 1;
    }
  }
  if (state.driverSpeed > 1e-6) for (const [i, name] of bandNames.entries()) {
    const curve = parts[name].userData.curve, speed = state.beltLinearSpeeds[i];
    const lowerOmega = i === 0 ? (state.mode === 'slow' ? state.looseLeftSpeed : state.outputSpeed)
      : (state.mode === 'slow' ? state.outputSpeed : state.looseRightSpeed);
    for (let sample = 0; sample < 1024; sample += 1) {
      const u = (sample + 0.371) / 1024, q = curve.getPointAt(u), tangent = curve.getTangentAt(u);
      let centerY, omega;
      if (q.y > p.driverHeight + 0.1 && Math.abs(Math.hypot(q.x, q.y - p.driverHeight) - p.driverPitchRadii[i]) < 1e-8) {
        centerY = p.driverHeight; omega = state.driverSpeed;
      } else if (q.y < -0.1 && Math.abs(Math.hypot(q.x, q.y) - p.lowerPitchRadius) < 1e-8) {
        centerY = 0; omega = lowerOmega;
      } else continue;
      const error = Math.hypot(tangent.x * speed + omega * (q.y - centerY), tangent.y * speed - omega * q.x) / Math.abs(speed);
      report.maximumRelativeNeutralSlip = Math.max(report.maximumRelativeNeutralSlip, error); report.wrappedNeutralSamples += 1;
    }
  }
  const matrices = Object.values(parts).map(mesh => mesh.matrixWorld.clone());
  const colors = bandNames.map(name => parts[name].geometry.attributes.color.array.slice());
  setTime(time + 9.317); setTime(time);
  Object.values(parts).forEach((mesh, i) => assert.ok(mesh.matrixWorld.equals(matrices[i])));
  bandNames.forEach((name, i) => assert.deepEqual(parts[name].geometry.attributes.color.array, colors[i]));
}
for (const time of boundaries) {
  const before = motion.atTime(time - dt), after = motion.atTime(time + dt);
  assert.ok(Math.abs((after.driverSpeed - before.driverSpeed) / (2 * dt)) < 0.0001);
  assert.ok(after.beltAxialSpeeds.every((speed, i) => Math.abs((speed - before.beltAxialSpeeds[i]) / (2 * dt)) < 0.0002));
}
assert.ok(report.maximumAngularDerivativeError < 2e-7 && report.maximumAxialDerivativeError < 2e-7 && report.maximumFlowDerivativeError < 2e-7);
assert.ok(report.maximumRelativeNeutralSlip < 1e-9 && report.wrappedNeutralSamples > 5000 && report.checkedStoppedTraversals >= 2);
await writeFile('artifacts/review/060-candidate-motion-check.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
