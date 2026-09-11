import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeDualInputDifferentialCandidate } from '../artifacts/review/062-candidate-model.mjs';
const model = makeDualInputDifferentialCandidate(), { parts, blocks, geometry: p, motion } = model.root.userData;
const setTime = time => { model.update(time); model.root.updateMatrixWorld(true); };
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);
const groups = ['driver', 'output', 'loose', 'carrier', 'side', 'planet'];
const dt = 1e-5, boundaries = p.selectionSequence.flatMap((_, stage) => [p.stageStarts[stage], p.stageStarts[stage] + p.dwellDurations[stage]]);
const times = [-31.37, -2.11, -1e-15, 0.2, 0.95, 2.7, 4.25, 5.91, 7.55, 9.21, 10.85, 17.61, 2 * p.cycleDuration, ...boundaries];
const report = { method: 'Finite differences of actual group angles and belt translations; independent common-apex velocity and differential relations; actual belt neutral-curve tangents; stopped shifts and pure transform/color seeking. Physical meshes are unchanged by section toggling.',
  configurations: ['open', 'crossed'], poses: 2 * times.length, maximumAngularDerivativeError: 0, maximumAxialDerivativeError: 0, maximumFlowDerivativeError: 0,
  maximumRelativeNeutralSlip: 0, wrappedNeutralSamples: 0, maximumPitchContactVelocityError: 0, stoppedShifts: 0 };
for (const configuration of ['open', 'crossed']) {
model.root.userData.setConfiguration(configuration);
for (const time of times) {
  setTime(time - dt); const beforeAngles = groups.map(name => blocks[name].rotation.z), beforeZ = parts.belt.position.z, before = model.root.userData.kinematics;
  setTime(time + dt); const afterAngles = groups.map(name => blocks[name].rotation.z), afterZ = parts.belt.position.z, after = model.root.userData.kinematics;
  setTime(time); const state = model.root.userData.kinematics;
  groups.forEach((name, i) => { report.maximumAngularDerivativeError = Math.max(report.maximumAngularDerivativeError,
    Math.abs((afterAngles[i] - beforeAngles[i]) / (2 * dt) - state[`${name}Speed`])); });
  report.maximumAxialDerivativeError = Math.max(report.maximumAxialDerivativeError, Math.abs((afterZ - beforeZ) / (2 * dt) - state.beltAxialSpeed));
  for (const prefix of ['', 'side']) {
    const distanceKey = prefix ? 'sideBeltDistance' : 'beltDistance', speedKey = prefix ? 'sideBeltLinearSpeed' : 'beltLinearSpeed';
    report.maximumFlowDerivativeError = Math.max(report.maximumFlowDerivativeError, Math.abs((after[distanceKey] - before[distanceKey]) / (2 * dt) - state[speedKey]));
  }
  near(state.outputSpeed + state.sideSpeed, 2 * state.carrierSpeed);
  near(state.planetSpeed * p.planetTeeth, p.sideTeeth * (state.outputSpeed - state.carrierSpeed));
  near(state.planetSpeed * p.planetTeeth, p.sideTeeth * (state.carrierSpeed - state.sideSpeed));
  near(state.outputAngle + state.sideAngle, 2 * state.carrierAngle);
  near(state.sideSpeed, state.orientationSign * p.sideRatio * state.driverSpeed);
  if (state.selected === 2) near(state.carrierSpeed, p.mainRatio * state.driverSpeed);
  else near(state.outputSpeed, p.mainRatio * state.driverSpeed);
  if (state.selected === 0) assert.ok(groups.every(name => state[name + 'Speed'] === 0));
  if (state.selected > 0) near(state.looseSpeed, 0);
  if (state.shifting) {
    assert.ok(groups.every(name => state[`${name}Speed`] === 0)); near(state.beltLinearSpeed, 0);
    if (Math.abs(state.beltAxialSpeed) > 0.01) report.stoppedShifts += 1;
  }
  const axis = new THREE.Vector3(Math.cos(state.carrierAngle), Math.sin(state.carrierAngle), 0);
  const z = new THREE.Vector3(0, 0, 1), omegaPlanet = z.clone().multiplyScalar(state.carrierSpeed).addScaledVector(axis, state.planetSpeed);
  for (const sign of [-1, 1]) for (const scale of [0.6, 0.8, 1]) {
    const q = axis.clone().multiplyScalar(p.planetOuterDistance * scale).addScaledVector(z, sign * p.sideOuterDistance * scale);
    const omegaSide = z.clone().multiplyScalar(sign === -1 ? state.outputSpeed : state.sideSpeed);
    const error = omegaPlanet.clone().cross(q).distanceTo(omegaSide.cross(q));
    report.maximumPitchContactVelocityError = Math.max(report.maximumPitchContactVelocityError, error);
  }
  if (state.driverSpeed > 1e-6) {
    const lowerOmega = state.selected === 1 ? state.outputSpeed : state.carrierSpeed;
    for (const [mesh, speed, upperRadius, lowerSpeed] of [
      [parts.belt, state.beltLinearSpeed, p.driverPitchRadius, lowerOmega],
      [parts.sideBelt, state.sideBeltLinearSpeed, p.sideDriverPitchRadius, state.sideSpeed],
    ]) {
      const curve = mesh.userData.curve, lengths = curve.getCurveLengths();
      for (let i = 0; i < 1024; i += 1) {
        const u = (i + 0.371) / 1024, q = curve.getPointAt(u), tangent = curve.getTangentAt(u);
        const distance = curve.getUtoTmapping(u) * lengths.at(-1);
        const component = lengths.findIndex(end => distance <= end);
        if (![1, 3].includes(component)) continue;
        const start = component === 0 ? 0 : lengths[component - 1];
        if (Math.min(distance - start, lengths[component] - distance) < 0.01) continue;
        const centerY = component === 3 ? p.driverHeight : 0;
        const omega = component === 3 ? state.driverSpeed : lowerSpeed;
        near(Math.hypot(q.x, q.y - centerY), component === 3 ? upperRadius : p.pulleyPitchRadius, 1e-8);
        report.maximumRelativeNeutralSlip = Math.max(report.maximumRelativeNeutralSlip,
          Math.hypot(tangent.x * speed + omega * (q.y - centerY), tangent.y * speed - omega * q.x, tangent.z * speed) / Math.abs(speed));
        report.wrappedNeutralSamples += 1;
      }
    }
  }
  const matrices = Object.values(parts).map(mesh => mesh.matrixWorld.clone()), colors = [parts.belt, parts.sideBelt].map(mesh => mesh.geometry.attributes.color.array.slice());
  setTime(time + 9.317); setTime(time);
  Object.values(parts).forEach((mesh, i) => assert.ok(mesh.matrixWorld.equals(matrices[i])));
  [parts.belt, parts.sideBelt].forEach((mesh, i) => assert.deepEqual(mesh.geometry.attributes.color.array, colors[i]));
  for (const section of [false, true]) {
    model.root.userData.setSectionView(section); model.root.updateMatrixWorld(true);
    Object.values(parts).forEach((mesh, i) => assert.ok(mesh.matrixWorld.equals(matrices[i])));
  }
}
for (const time of boundaries) {
  const before = motion.atTime(time - dt, configuration), after = motion.atTime(time + dt, configuration);
  near(before.driverSpeed, 0, 1e-8); near(after.driverSpeed, 0, 1e-8);
  near((after.driverSpeed - before.driverSpeed) / (2 * dt), 0, 0.0001);
  near((after.beltAxialSpeed - before.beltAxialSpeed) / (2 * dt), 0, 0.0002);
}
}
assert.ok(report.maximumAngularDerivativeError < 2e-7 && report.maximumAxialDerivativeError < 2e-7 && report.maximumFlowDerivativeError < 2e-7);
assert.ok(report.maximumRelativeNeutralSlip < 1e-9 && report.wrappedNeutralSamples > 3000 && report.stoppedShifts >= 8);
assert.ok(report.maximumPitchContactVelocityError < 1e-10);
await writeFile('artifacts/review/062-candidate-motion-check.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
