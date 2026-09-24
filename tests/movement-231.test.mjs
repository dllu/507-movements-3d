import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function nearVector(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function angularError(actual, expected) {
  return Math.atan2(
    Math.sin(actual - expected),
    Math.cos(actual - expected),
  );
}

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else if (object.material) {
      materials.add(object.material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 231 is one fixed-link Grashof double crank and one coupler', () => {
  const movement = catalog.movements[230];
  const model = createMovementModel(movement);
  const { blocks, fidelity, mechanism } = model.root.userData;

  assert.equal(movement.id, 231);
  assert.equal(movement.number, '231');
  assert.equal(movement.title, 'Drag-Link Double-Crank Coupling');
  assert.equal(movement.category, 'Cranks & reciprocation');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(movement.archetype, 'strict-grashof-drag-link-double-crank');
  assert.equal(mechanism, movement.archetype);
  assert.equal(blocks.fixedBearings.length, 2);
  assert.equal(blocks.groundEyeLiners.length, 2);
  assert.equal(blocks.couplerEyeLiners.length, 2);
  assert.equal(blocks.rotationIndexes.length, 2);
  assert.equal(blocks.shafts.length, 2);
  assert.equal(blocks.inputCrank.parent, blocks.inputRotor);
  assert.equal(blocks.outputCrank.parent, blocks.outputRotor);
  assert.equal(blocks.inputCrankPin.parent, blocks.inputRotor);
  assert.equal(blocks.outputCrankPin.parent, blocks.outputRotor);
  // Brown draws neither the bearing link nor the bearings.
  assert.equal(blocks.groundPlate.parent, null);
  for (const part of [...blocks.fixedBearings, ...blocks.groundEyeLiners]) {
    assert.equal(part.parent, null);
  }
  for (const index of blocks.rotationIndexes) assert.equal(index.parent, null);
  assert.equal(blocks.coupler.parent, model.root);
  disposeModel(model.root);
});

test('movement 231 preserves Brown’s two-shaft plate and strict drag-link proportions', () => {
  const model = createMovementModel(catalog.movements[230]);
  const {
    geometry,
    sourceReference,
    stateAtDriverAngle,
    transmission,
  } = model.root.userData;

  assert.deepEqual(sourceReference.plate231, {
    connectedCouplerCount: 1,
    fixedBearingLinkCount: 1,
    fullRotationCrankCount: 2,
    hangingCoupler: true,
    officialAnimationAvailable: false,
    parallelShaftCount: 2,
    shaftExtensionsShownOnOppositeSides: true,
    statedInputMotion: 'circular',
    statedOutputMotion: 'circular',
  });
  assert.deepEqual(transmission, {
    averageOutputTurnsPerInputTurn: 1,
    assemblyBranch: 'open-plus-circle-intersection',
    inputOutputDirection: 'same',
    instantaneousSpeedRatioVariable: true,
    strictGrashof: true,
    strictGrashofMargin: geometry.strictGrashofMargin,
    topology: 'fixed-shortest-link-double-crank-four-bar',
  });
  assert.equal(geometry.sourceImageWidth, 525);
  assert.equal(geometry.sourceImageHeight, 525);
  assert.ok(geometry.groundLength < geometry.inputCrankLength);
  assert.ok(geometry.groundLength < geometry.outputCrankLength);
  assert.ok(geometry.groundLength < geometry.couplerLength);
  near(
    geometry.inputPivot.distanceTo(geometry.outputPivot),
    geometry.groundLength,
    0,
    'fixed bearing-link length',
  );
  near(
    geometry.strictGrashofMargin,
    geometry.inputCrankLength + geometry.outputCrankLength
      - geometry.groundLength - geometry.couplerLength,
    0,
    'strict Grashof margin',
  );
  assert.ok(geometry.strictGrashofMargin > 0);
  assert.ok(geometry.innerTriangleClearance > 0);
  assert.ok(geometry.outerTriangleClearance > 0);
  for (const [name, clearance] of Object.entries(geometry.axialClearances)) {
    assert.ok(clearance > 0, `${name} axial clearance ${clearance}`);
  }
  const sourceState = stateAtDriverAngle(geometry.sourcePoseAngle);
  assert.ok(sourceState.inputPin.y > geometry.inputPivot.y);
  assert.ok(sourceState.outputPin.y > geometry.outputPivot.y);
  assert.ok(sourceState.outputPin.y < sourceState.inputPin.y);
  // Brown's pose: the input crank stands nearly upright and the coupler runs
  // down and to the left to the output crank's pin.
  assert.ok(sourceState.outputPin.x < sourceState.inputPin.x);
  near(THREE.MathUtils.radToDeg(geometry.sourcePoseAngle), 103.44, 1e-9, 'source input angle');
  near(THREE.MathUtils.radToDeg(sourceState.drivenAngle), 173.11, 0.01, 'source output angle');
  assert.ok(sourceState.circleBranchCross > 0);
  assert.ok(geometry.inputCrankPlaneZ < geometry.couplerPlaneZ);
  assert.ok(geometry.couplerPlaneZ < geometry.outputCrankPlaneZ);
  for (const contact of [
    model.root.userData.contacts.couplerInputPin,
    model.root.userData.contacts.couplerOutputPin,
  ]) {
    near(contact.centerError, 0, 0, 'crank pin and coupler eye coincide');
    assert.ok(contact.axialCaptureMargin > 0);
  }
  disposeModel(model.root);
});

test('movement 231 stays on one nonsingular full-rotation branch through 131,073 states', () => {
  const model = createMovementModel(catalog.movements[230]);
  const { geometry, stateAtDriverAngle } = model.root.userData;
  const maxima = {
    accelerationConstraint: 0,
    couplerLength: 0,
    inputRadius: 0,
    outputRadius: 0,
    velocityConstraint: 0,
  };
  let minimumBranchMagnitude = Infinity;
  let minimumInnerClearance = Infinity;
  let minimumIntersectionHeight = Infinity;
  let minimumOuterClearance = Infinity;
  let minimumSpeedRatio = Infinity;
  let maximumSpeedRatio = -Infinity;
  let maximumBranchCross = -Infinity;
  let minimumOutputAdvance = Infinity;
  let previousOutputAngle = -Infinity;
  const first = stateAtDriverAngle(geometry.sourcePoseAngle);

  for (let step = 0; step <= 131_072; step += 1) {
    const angle = geometry.sourcePoseAngle
      + step / 131_072 * geometry.fullTurn;
    const state = stateAtDriverAngle(angle);
    maxima.couplerLength = Math.max(
      maxima.couplerLength,
      state.couplerLengthError,
    );
    maxima.inputRadius = Math.max(
      maxima.inputRadius,
      state.inputPinRadiusError,
    );
    maxima.outputRadius = Math.max(
      maxima.outputRadius,
      state.outputPinRadiusError,
    );
    maxima.velocityConstraint = Math.max(
      maxima.velocityConstraint,
      state.couplerVelocityConstraintError,
    );
    maxima.accelerationConstraint = Math.max(
      maxima.accelerationConstraint,
      state.couplerAccelerationConstraintError,
    );
    minimumBranchMagnitude = Math.min(
      minimumBranchMagnitude,
      state.circleBranchCross,
      Math.abs(state.drivenDerivativeDenominator),
    );
    minimumInnerClearance = Math.min(
      minimumInnerClearance,
      state.innerCircleClearance,
    );
    minimumIntersectionHeight = Math.min(
      minimumIntersectionHeight,
      state.intersectionHeight,
    );
    minimumOuterClearance = Math.min(
      minimumOuterClearance,
      state.outerCircleClearance,
    );
    minimumSpeedRatio = Math.min(
      minimumSpeedRatio,
      state.drivenDerivativeByDriver,
    );
    maximumSpeedRatio = Math.max(
      maximumSpeedRatio,
      state.drivenDerivativeByDriver,
    );
    maximumBranchCross = Math.max(maximumBranchCross, state.circleBranchCross);
    if (step > 0) {
      minimumOutputAdvance = Math.min(
        minimumOutputAdvance,
        state.drivenAngle - previousOutputAngle,
      );
    }
    previousOutputAngle = state.drivenAngle;
  }
  const last = stateAtDriverAngle(
    geometry.sourcePoseAngle + geometry.fullTurn,
  );

  assert.ok(maxima.couplerLength <= 2.7e-15,
    `maximum coupler closure error ${maxima.couplerLength}`);
  assert.ok(maxima.inputRadius <= 9e-16,
    `maximum input radius error ${maxima.inputRadius}`);
  assert.ok(maxima.outputRadius <= 1.8e-15,
    `maximum output radius error ${maxima.outputRadius}`);
  assert.ok(maxima.velocityConstraint <= 2.7e-14,
    `maximum velocity closure error ${maxima.velocityConstraint}`);
  assert.ok(maxima.accelerationConstraint <= 3e-13,
    `maximum acceleration closure error ${maxima.accelerationConstraint}`);
  assert.ok(minimumBranchMagnitude > 5.05,
    `minimum branch/singularity margin ${minimumBranchMagnitude}`);
  assert.ok(minimumBranchMagnitude > 0,
    `circle-intersection branch crossed ${minimumBranchMagnitude}`);
  assert.ok(minimumOutputAdvance > 0,
    `minimum output advance ${minimumOutputAdvance}`);
  assert.ok(minimumInnerClearance >= geometry.innerTriangleClearance - 2e-10);
  assert.ok(minimumOuterClearance >= geometry.outerTriangleClearance - 6e-11);
  assert.ok(minimumIntersectionHeight > 2.886);
  assert.ok(minimumSpeedRatio > 0.500 && minimumSpeedRatio < 0.501);
  assert.ok(maximumSpeedRatio > 2.143 && maximumSpeedRatio < 2.144);
  near(last.drivenAngle - first.drivenAngle, geometry.fullTurn, 2e-15,
    'one full output turn per input turn');
  near(last.drivenRevolutions, 1, 2e-15, 'one output revolution');
  disposeModel(model.root);
});

test('movement 231 analytic coupler twist reproduces both endpoint motions', () => {
  const model = createMovementModel(catalog.movements[230]);
  const { geometry, stateAtDriverAngle } = model.root.userData;
  let maximumAccelerationError = 0;
  let maximumVelocityError = 0;

  for (let step = 0; step <= 32_768; step += 1) {
    const state = stateAtDriverAngle(
      geometry.sourcePoseAngle + step / 32_768 * geometry.fullTurn,
    );
    const vector = state.couplerVector;
    const predictedOutputVelocity = state.inputPinVelocity.clone().add(
      new THREE.Vector3(
        -state.couplerAngularSpeed * vector.y,
        state.couplerAngularSpeed * vector.x,
        0,
      ),
    );
    const predictedOutputAcceleration = state.inputPinAcceleration.clone().add(
      new THREE.Vector3(
        -state.couplerAngularAcceleration * vector.y
          - state.couplerAngularSpeed ** 2 * vector.x,
        state.couplerAngularAcceleration * vector.x
          - state.couplerAngularSpeed ** 2 * vector.y,
        0,
      ),
    );
    maximumVelocityError = Math.max(
      maximumVelocityError,
      predictedOutputVelocity.distanceTo(state.outputPinVelocity),
    );
    maximumAccelerationError = Math.max(
      maximumAccelerationError,
      predictedOutputAcceleration.distanceTo(state.outputPinAcceleration),
    );
  }
  assert.ok(maximumVelocityError <= 1.5e-14,
    `maximum rigid-coupler velocity error ${maximumVelocityError}`);
  assert.ok(maximumAccelerationError <= 1.1e-13,
    `maximum rigid-coupler acceleration error ${maximumAccelerationError}`);
  disposeModel(model.root);
});

test('movement 231 analytic output rate and acceleration match finite differences', () => {
  const model = createMovementModel(catalog.movements[230]);
  const { geometry, stateAtTime } = model.root.userData;
  const timeStep = 1e-4;
  let maximumAngularAccelerationError = 0;
  let maximumAngularSpeedError = 0;
  let maximumPointAccelerationError = 0;
  let maximumPointVelocityError = 0;

  for (let step = 0; step <= 512; step += 1) {
    const time = step / 512 * geometry.cyclePeriod;
    const previous = stateAtTime(time - timeStep);
    const current = stateAtTime(time);
    const next = stateAtTime(time + timeStep);
    for (const key of ['inputPin', 'outputPin']) {
      const numericalVelocity = next[key].clone()
        .sub(previous[key])
        .multiplyScalar(1 / (2 * timeStep));
      const numericalAcceleration = next[key].clone()
        .add(previous[key])
        .addScaledVector(current[key], -2)
        .multiplyScalar(1 / timeStep ** 2);
      maximumPointVelocityError = Math.max(
        maximumPointVelocityError,
        numericalVelocity.distanceTo(current[`${key}Velocity`]),
      );
      maximumPointAccelerationError = Math.max(
        maximumPointAccelerationError,
        numericalAcceleration.distanceTo(current[`${key}Acceleration`]),
      );
    }
    const numericalAngularSpeed = (
      next.drivenAngle - previous.drivenAngle
    ) / (2 * timeStep);
    const numericalAngularAcceleration = (
      next.drivenAngle + previous.drivenAngle - 2 * current.drivenAngle
    ) / timeStep ** 2;
    maximumAngularSpeedError = Math.max(
      maximumAngularSpeedError,
      Math.abs(numericalAngularSpeed - current.drivenAngularSpeed),
    );
    maximumAngularAccelerationError = Math.max(
      maximumAngularAccelerationError,
      Math.abs(
        numericalAngularAcceleration - current.drivenAngularAcceleration,
      ),
    );
  }
  assert.ok(maximumPointVelocityError <= 5.6e-7,
    `maximum finite-difference point velocity error ${maximumPointVelocityError}`);
  assert.ok(maximumPointAccelerationError <= 3.6e-6,
    `maximum finite-difference point acceleration error ${maximumPointAccelerationError}`);
  assert.ok(maximumAngularSpeedError <= 1.7e-7,
    `maximum finite-difference output speed error ${maximumAngularSpeedError}`);
  assert.ok(maximumAngularAccelerationError <= 1e-6,
    `maximum finite-difference output acceleration error ${maximumAngularAccelerationError}`);
  disposeModel(model.root);
});

test('movement 231 uses separated axial layers where the crank projections cross', () => {
  const model = createMovementModel(catalog.movements[230]);
  const { geometry, stateAtDriverAngle } = model.root.userData;
  const inputCrankMaximumZ = geometry.inputCrankPlaneZ
    + geometry.crankDepth / 2;
  const outputCrankMinimumZ = geometry.outputCrankPlaneZ
    - geometry.crankDepth / 2;
  const inputShaftMaximumZ = geometry.inputShaftCenterZ
    + geometry.shaftLength / 2;
  const outputShaftMinimumZ = geometry.outputShaftCenterZ
    - geometry.shaftLength / 2;

  assert.ok(inputCrankMaximumZ < outputCrankMinimumZ);
  assert.ok(inputCrankMaximumZ < outputShaftMinimumZ);
  assert.ok(inputShaftMaximumZ < outputCrankMinimumZ);
  // Plate order, back to front: input crank, coupler, output crank. Each
  // shaft runs away from the coupler, and each pin stops short of the other
  // crank's layer.
  assert.ok(
    inputCrankMaximumZ < geometry.couplerPlaneZ - geometry.couplerDepth / 2,
  );
  assert.ok(
    geometry.couplerPlaneZ + geometry.couplerDepth / 2 < outputCrankMinimumZ,
  );
  assert.ok(inputShaftMaximumZ < geometry.couplerPlaneZ - geometry.couplerDepth / 2);
  assert.ok(outputShaftMinimumZ > geometry.couplerPlaneZ + geometry.couplerDepth / 2);
  for (const [name, clearance] of Object.entries(geometry.axialClearances)) {
    assert.ok(clearance >= 0.079, `${name} axial clearance ${clearance}`);
  }
  // The long input crank sweeps across the output-shaft projection; the
  // output shaft runs forward from the front layer, so the solids stay apart.
  const groundAngle = Math.atan2(
    geometry.outputPivot.y - geometry.inputPivot.y,
    geometry.outputPivot.x - geometry.inputPivot.x,
  );
  const crossingState = stateAtDriverAngle(groundAngle);
  assert.ok(crossingState.inputPin.distanceTo(geometry.inputPivot.clone().setZ(geometry.couplerPlaneZ))
    > geometry.groundLength);
  assert.ok(geometry.axialClearances.inputCrankToOutputCrank > 0);
  disposeModel(model.root);
});

test('movement 231 renders both crank pins and every coupler eye at the solved state', () => {
  const model = createMovementModel(catalog.movements[230]);
  const { blocks, geometry } = model.root.userData;
  const localInputEye = new THREE.Vector3(-geometry.couplerLength / 2, 0, 0);
  const localOutputEye = new THREE.Vector3(geometry.couplerLength / 2, 0, 0);
  let maximumCouplerEyeError = 0;
  let maximumInputPinError = 0;
  let maximumOutputPinError = 0;

  for (let step = 0; step <= 8192; step += 1) {
    const time = step / 8192 * geometry.cyclePeriod;
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    maximumCouplerEyeError = Math.max(
      maximumCouplerEyeError,
      localInputEye.clone().applyMatrix4(blocks.coupler.matrixWorld)
        .distanceTo(state.inputPin),
      localOutputEye.clone().applyMatrix4(blocks.coupler.matrixWorld)
        .distanceTo(state.outputPin),
    );
    maximumInputPinError = Math.max(
      maximumInputPinError,
      new THREE.Vector3().applyMatrix4(blocks.inputCrankPin.matrixWorld)
        .distanceTo(state.inputPin.clone().setZ(geometry.inputCrankPinCenterZ)),
    );
    maximumOutputPinError = Math.max(
      maximumOutputPinError,
      new THREE.Vector3().applyMatrix4(blocks.outputCrankPin.matrixWorld)
        .distanceTo(state.outputPin.clone().setZ(geometry.outputCrankPinCenterZ)),
    );
    near(blocks.inputRotor.rotation.z, state.driverAngle, 0,
      'rendered input-crank angle');
    near(blocks.outputRotor.rotation.z, state.drivenAngle, 0,
      'rendered output-crank angle');
    near(blocks.coupler.userData.lengthError, state.couplerLengthError, 0,
      'rendered coupler closure');
    assert.ok(model.root.userData.contacts.couplerInputPin.axialCaptureMargin > 0);
    assert.ok(model.root.userData.contacts.couplerOutputPin.axialCaptureMargin > 0);
  }
  assert.ok(maximumCouplerEyeError <= 2.7e-15,
    `maximum rendered coupler-eye error ${maximumCouplerEyeError}`);
  assert.ok(maximumInputPinError <= 2.3e-15,
    `maximum rendered input-pin error ${maximumInputPinError}`);
  assert.ok(maximumOutputPinError <= 4.6e-15,
    `maximum rendered output-pin error ${maximumOutputPinError}`);
  disposeModel(model.root);
});

test('movement 231 closes both rotations in four seconds while movement 507 stays authored', () => {
  const model = createMovementModel(catalog.movements[230]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const finish = stateAtTime(geometry.cyclePeriod);
  near(finish.driverAngle - start.driverAngle, -geometry.fullTurn, 0,
    'input full-turn advance');
  near(finish.drivenAngle - start.drivenAngle, -geometry.fullTurn, 9e-16,
    'output full-turn advance');
  near(finish.driverRevolutions, -1, 0, 'input revolution count');
  near(finish.drivenRevolutions, -1, 1.2e-16, 'output revolution count');
  for (const key of ['inputPin', 'outputPin']) {
    nearVector(finish[key], start[key], 2e-15, `${key} full-cycle closure`);
    nearVector(finish[`${key}Velocity`], start[`${key}Velocity`], 4.8e-15,
      `${key} velocity closure`);
    nearVector(
      finish[`${key}Acceleration`],
      start[`${key}Acceleration`],
      1.1e-14,
      `${key} acceleration closure`,
    );
  }
  near(finish.drivenAngularSpeed, start.drivenAngularSpeed, 9e-16,
    'output speed closure');
  near(
    finish.drivenAngularAcceleration,
    start.drivenAngularAcceleration,
    2.7e-15,
    'output acceleration closure',
  );
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 4);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  assertReadableTiming(model.root.userData.animationTiming);

  model.update(0);
  model.root.updateMatrixWorld(true);
  const indexStart = blocks.rotationIndexes.map((index) => (
    new THREE.Vector3().applyMatrix4(index.matrixWorld)
  ));
  model.update(geometry.cyclePeriod);
  model.root.updateMatrixWorld(true);
  blocks.rotationIndexes.forEach((index, indexNumber) => {
    nearVector(
      new THREE.Vector3().applyMatrix4(index.matrixWorld),
      indexStart[indexNumber],
      1.7e-15,
      'visible crank index full-cycle closure',
    );
  });

  const movement507 = createMovementModel(catalog.movements[506]);
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(catalog.movements[506].fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(movement507.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(movement507.root);
});
