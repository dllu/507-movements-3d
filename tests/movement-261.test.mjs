import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
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

function distance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
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

test('movement 261 is the one-cord crank-rocker moving-pulley drive', () => {
  const movement = catalog.movements[260];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    cordDefinition,
    fidelity,
    mechanism,
  } = model.root.userData;

  assert.equal(movement.id, 261);
  assert.equal(movement.number, '261');
  assert.equal(
    movement.title,
    'Crank-Rocker Drum and Moving-Pulley Weight Drive',
  );
  assert.equal(movement.category, 'Cranks & reciprocation');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'crank-rocker-carried-moving-pulley-plus-coaxial-drum-takeup-driving-unequal-weight-strokes',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /disk-B-crank-and-link-C-rock-arm-A-about-G/);
  assert.match(mechanism, /coaxial-drum-winds-the-single-cord-D/);
  assert.equal(blocks.diskBody.parent, blocks.diskAssembly);
  assert.equal(blocks.drum.parent, blocks.diskAssembly);
  assert.equal(blocks.movingPulleyRotor.parent, blocks.movingPulley);
  assert.equal(blocks.pulleyCore.parent, blocks.movingPulleyRotor);
  assert.equal(blocks.weightBody.parent, blocks.weight);
  assert.equal(blocks.weightEye.parent, blocks.weight);
  assert.equal(blocks.cord.userData.ropeCount, 1);
  assert.equal(cordDefinition.renderedCordCount, 1);
  assert.equal(
    blocks.cord.children.filter((object) => (
      object.userData.role === 'single-visible-continuous-cord-D-tube'
    )).length,
    1,
  );
  disposeModel(model.root);
});

test('movement 261 preserves the unavailable labeled source elevation', () => {
  const movement = catalog.movements[260];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.plate261;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 6);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterAnchors, {
    crankPin: { x: 274, y: 386 },
    diskCenterB: { x: 225, y: 388 },
    fixedPivotG: { x: 352, y: 85 },
    movingPulleyE: { x: 129, y: 99 },
    rockerJoint: { x: 207, y: 97 },
  });
  assert.equal(plate.rasterMovingPulleyRadius, 56);
  assert.deepEqual(plate.rasterWeightBounds, {
    bottom: 517,
    left: 50,
    right: 96,
    top: 431,
  });
  assert.match(plate.inferredTopology, /one crank-rocker/);
  assert.match(plate.inferredTopology, /one moving pulley/);
  assert.match(plate.inferredTopology, /one cord/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 67,
    edition: 21,
    illustrationPage: 66,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 261 matches the measured linkage proportions', () => {
  const model = createMovementModel(catalog.movements[260]);
  const { geometry, sourceReference } = model.root.userData;
  const { rasterAnchors, rasterMovingPulleyRadius } =
    sourceReference.plate261;
  const rasterCrankRadius = distance(
    rasterAnchors.crankPin,
    rasterAnchors.diskCenterB,
  );
  const rasterRockerJointRadius = distance(
    rasterAnchors.fixedPivotG,
    rasterAnchors.rockerJoint,
  );
  const rasterPulleyArmRadius = distance(
    rasterAnchors.fixedPivotG,
    rasterAnchors.movingPulleyE,
  );
  const rasterCouplerLength = distance(
    rasterAnchors.rockerJoint,
    rasterAnchors.crankPin,
  );
  const rasterGroundLength = distance(
    rasterAnchors.fixedPivotG,
    rasterAnchors.diskCenterB,
  );
  const modelGroundLength = geometry.fixedPivotG.distanceTo(
    geometry.diskCenter,
  );

  near(
    geometry.crankRadius / geometry.movingPulleyPitchRadius,
    rasterCrankRadius / rasterMovingPulleyRadius,
    0.04,
    'crank-to-moving-pulley radius ratio',
  );
  near(
    geometry.rockerJointRadius / geometry.pulleyArmRadius,
    rasterRockerJointRadius / rasterPulleyArmRadius,
    0.02,
    'rocker-joint-to-pulley-arm ratio',
  );
  near(
    geometry.couplerLength / geometry.rockerJointRadius,
    rasterCouplerLength / rasterRockerJointRadius,
    0.05,
    'coupler-to-rocker radius ratio',
  );
  near(
    modelGroundLength / geometry.pulleyArmRadius,
    rasterGroundLength / rasterPulleyArmRadius,
    0.07,
    'ground-to-pulley-arm ratio',
  );
  disposeModel(model.root);
});

test('movement 261 satisfies exact four-bar closure through a revolution', () => {
  const model = createMovementModel(catalog.movements[260]);
  const { geometry, transmission } = model.root.userData;
  let maximumCrankError = 0;
  let maximumRockerError = 0;
  let maximumCouplerError = 0;
  let maximumPulleyArmError = 0;
  let maximumCollinearityError = 0;

  for (let sample = 0; sample <= 4096; sample += 1) {
    const diskAngle = FULL_TURN * sample / 4096;
    const { linkage } = transmission.configurationAtDiskAngle(diskAngle);
    const rockerVector = linkage.rockerJoint.clone().sub(
      geometry.fixedPivotG,
    );
    const pulleyVector = linkage.pulleyCenter.clone().sub(
      geometry.fixedPivotG,
    );
    maximumCrankError = Math.max(
      maximumCrankError,
      Math.abs(linkage.crankPin.distanceTo(geometry.diskCenter)
        - geometry.crankRadius),
    );
    maximumRockerError = Math.max(
      maximumRockerError,
      Math.abs(rockerVector.length() - geometry.rockerJointRadius),
    );
    maximumCouplerError = Math.max(
      maximumCouplerError,
      Math.abs(linkage.rockerJoint.distanceTo(linkage.crankPin)
        - geometry.couplerLength),
    );
    maximumPulleyArmError = Math.max(
      maximumPulleyArmError,
      Math.abs(pulleyVector.length() - geometry.pulleyArmRadius),
    );
    maximumCollinearityError = Math.max(
      maximumCollinearityError,
      Math.abs(
        rockerVector.x * pulleyVector.y
          - rockerVector.y * pulleyVector.x,
      ),
    );
    assert.ok(rockerVector.dot(pulleyVector) > 0);
  }
  assert.ok(maximumCrankError < 7e-16);
  assert.ok(maximumRockerError < 7e-16);
  assert.ok(maximumCouplerError < 2e-15);
  assert.ok(maximumPulleyArmError < 9e-16);
  assert.ok(maximumCollinearityError < 9e-16);
  disposeModel(model.root);
});

test('movement 261 keeps one exact-length cord tangent to pulley and drum', () => {
  const model = createMovementModel(catalog.movements[260]);
  const {
    blocks,
    cordDefinition,
    geometry,
    transmission,
  } = model.root.userData;
  let maximumLengthError = 0;
  let maximumEntryTangentError = 0;
  let maximumExitTangentError = 0;
  let maximumDrumTangentError = 0;

  for (let sample = 0; sample <= 4096; sample += 1) {
    const configuration = transmission.configurationAtDiskAngle(
      FULL_TURN * sample / 4096,
    );
    maximumLengthError = Math.max(
      maximumLengthError,
      Math.abs(configuration.cordLengthError),
    );
    maximumEntryTangentError = Math.max(
      maximumEntryTangentError,
      Math.abs(configuration.pulleyArcEntryTangentError),
    );
    maximumExitTangentError = Math.max(
      maximumExitTangentError,
      Math.abs(configuration.pulleyArcExitTangentError),
    );
    maximumDrumTangentError = Math.max(
      maximumDrumTangentError,
      Math.abs(configuration.drumEntryProjectedTangentError),
    );
    assert.ok(configuration.movingPulleySweep < 0);
    assert.ok(configuration.drumWrapAngle >= geometry.initialDrumWrapAngle);
  }
  assert.ok(maximumLengthError < 4e-15);
  assert.ok(maximumEntryTangentError < 5e-16);
  assert.ok(maximumExitTangentError < 5e-16);
  assert.ok(maximumDrumTangentError < 5e-16);
  near(
    transmission.constantCordLength,
    cordDefinition.constantCenterlineLength,
    0,
    'single cord centerline length',
  );
  assert.equal(blocks.cord.userData.closed, false);
  assert.equal(blocks.cordMarkers.length, geometry.cordMarkerCount);
  blocks.cordMarkers.forEach((marker, index) => {
    near(
      marker.userData.materialDistance,
      transmission.constantCordLength
        * (index + 1) / (geometry.cordMarkerCount + 1),
      0,
      `fixed material marker ${index + 1}`,
    );
  });
  disposeModel(model.root);
});

test('movement 261 derives smooth pulley spin from material cord travel', () => {
  const model = createMovementModel(catalog.movements[260]);
  const {
    geometry,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;
  const initial = transmission.configurationAtDiskAngle(0);
  const timeStep = 1e-5;
  let maximumPulleyLawError = 0;
  let maximumPulleyRateError = 0;
  let maximumAdjacentAngleStep = 0;
  let previous = initial;

  for (let sample = 1; sample <= 4096; sample += 1) {
    const diskAngle = FULL_TURN * sample / 4096;
    const configuration = transmission.configurationAtDiskAngle(diskAngle);
    const tangentAngleChange = Math.atan2(
      Math.sin(
        configuration.weightTangentAngle - initial.weightTangentAngle,
      ),
      Math.cos(
        configuration.weightTangentAngle - initial.weightTangentAngle,
      ),
    );
    const expectedPulleyAngle = tangentAngleChange + (
      configuration.leftSpanLength - initial.leftSpanLength
    ) / geometry.movingPulleyPitchRadius;
    maximumPulleyLawError = Math.max(
      maximumPulleyLawError,
      Math.abs(configuration.pulleyAngleUnwrapped - expectedPulleyAngle),
    );
    maximumAdjacentAngleStep = Math.max(
      maximumAdjacentAngleStep,
      Math.abs(
        configuration.pulleyAngleUnwrapped - previous.pulleyAngleUnwrapped,
      ),
    );
    previous = configuration;
  }
  for (let sample = 1; sample < 2048; sample += 1) {
    const time = timeline.demonstrationPeriod * sample / 2048;
    if (Math.abs(time - timeline.forwardWindingEnd) < 2 * timeStep) continue;
    const before = stateAtTime(time - timeStep);
    const state = stateAtTime(time);
    const after = stateAtTime(time + timeStep);
    const numericalPulleySpeed = (
      after.pulleyAngleUnwrapped - before.pulleyAngleUnwrapped
    ) / (2 * timeStep);
    maximumPulleyRateError = Math.max(
      maximumPulleyRateError,
      Math.abs(numericalPulleySpeed - state.pulleyAngularSpeed),
    );
  }
  assert.ok(maximumPulleyLawError < 2e-15);
  assert.ok(maximumAdjacentAngleStep < 0.003);
  assert.ok(maximumPulleyRateError < 2e-8);
  assert.equal(
    transmission.movingPulleyNoSlipLaw,
    'pulley-angle-change=tangent-angle-change+left-span-length-change/pitch-radius',
  );
  disposeModel(model.root);
});

test('movement 261 makes the down-stroke shorter by continuous drum take-up', () => {
  const model = createMovementModel(catalog.movements[260]);
  const {
    driveSchedule,
    geometry,
    stateAtTime,
    strokeAnalysis,
    timeline,
    transmission,
  } = model.root.userData;
  const atZero = transmission.configurationAtDiskAngle(0);
  const afterOneRevolution = transmission.configurationAtDiskAngle(FULL_TURN);

  assert.ok(
    strokeAnalysis.downwardStrokeLength < strokeAnalysis.upwardStrokeLength,
  );
  assert.ok(strokeAnalysis.forwardMaximum.diskAngle
    < strokeAnalysis.forwardMinimum.diskAngle);
  assert.ok(strokeAnalysis.forwardMinimum.diskAngle < FULL_TURN);
  assert.ok(strokeAnalysis.nextCycleMaximum.diskAngle > FULL_TURN);
  assert.ok(strokeAnalysis.nextCycleMaximum.weightY
    > strokeAnalysis.forwardMaximum.weightY);
  assert.ok(afterOneRevolution.weightY > atZero.weightY);
  near(
    afterOneRevolution.linkage.pulleyCenter.distanceTo(
      atZero.linkage.pulleyCenter,
    ),
    0,
    3e-15,
    'rocker returns while drum has lifted the weight',
  );
  near(
    afterOneRevolution.drumWrapLength - atZero.drumWrapLength,
    transmission.drumTakeupLengthPerRevolution,
    9e-16,
    'one-revolution drum take-up',
  );
  for (const time of [0, 1, 2.5, 4, 6, 8, 10.5, 12]) {
    near(
      stateAtTime(time).weightPosition.x,
      geometry.weightFixedX,
      0,
      `strictly vertical weight guide at ${time}`,
    );
  }
  assert.equal(driveSchedule.sourcePrescribesReversal, false);
  assert.match(driveSchedule.diskExcursion, /forward-revolution/);
  assert.match(driveSchedule.diskExcursion, /reverse-revolution/);
  assert.equal(timeline.forwardWindingEnd, 6);
  assert.equal(timeline.reverseUnwindingEnd, 12);
  disposeModel(model.root);
});

test('movement 261 renders a smooth exact closure and leaves 269 authored', () => {
  const model = createMovementModel(catalog.movements[260]);
  const {
    animationTiming,
    blocks,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const start = stateAtTime(0);
  const forward = stateAtTime(3);
  const reversal = stateAtTime(6);
  const reverse = stateAtTime(9);
  const closure = stateAtTime(timeline.cycleClosure);
  const cordMesh = blocks.cord.children.find((object) => (
    object.userData.role === 'single-visible-continuous-cord-D-tube'
  ));
  const originalCordGeometry = cordMesh.geometry;

  assert.ok(forward.diskAngularSpeed > 0);
  assert.ok(reverse.diskAngularSpeed < 0);
  near(start.diskAngularSpeed, 0, 0, 'start at rest');
  near(reversal.diskAngularSpeed, 0, 3e-16, 'smooth reversal at rest');
  for (const key of [
    'diskAngleUnwrapped',
    'diskAngularSpeed',
    'pulleyAngleUnwrapped',
    'rockerAngle',
    'weightVelocityY',
  ]) {
    near(closure[key], start[key], 0, `${key} closure`);
  }
  near(
    closure.weightPosition.distanceTo(start.weightPosition),
    0,
    0,
    'weight position closure',
  );
  near(
    closure.pulleyCenter.distanceTo(start.pulleyCenter),
    0,
    0,
    'moving pulley center closure',
  );
  for (const time of [0, 1.2, 3, 6, 8.4, 11.9, 12]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.diskAssembly.rotation.z, state.diskAngle, 0,
      `rendered disk angle at ${time}`);
    near(blocks.movingPulleyRotor.rotation.z, state.pulleyAngle, 0,
      `rendered pulley angle at ${time}`);
    near(blocks.weight.position.y, state.weightPosition.y, 0,
      `rendered weight height at ${time}`);
    near(blocks.movingPulley.position.x, state.pulleyCenter.x, 0,
      `rendered pulley x at ${time}`);
    near(blocks.movingPulley.position.y, state.pulleyCenter.y, 0,
      `rendered pulley y at ${time}`);
    assert.equal(cordMesh.geometry, originalCordGeometry);
  }
  near(animationTiming.authoredCyclePeriod, 12, 0, 'authored cycle period');
  near(animationTiming.targetCycleDuration, 2, 0, 'display period');
  assertReadableTiming(animationTiming);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});

test('movement 261 shows the real drum and drum-side strand of D behind B, with no dashed notation', () => {
  const movement = catalog.movements[260];
  const model = createMovementModel(movement);
  const { blocks, geometry } = model.root.userData;
  const lines = [];
  model.root.traverse((object) => { if (object.isLine) lines.push(object); });
  assert.deepEqual(lines.map((line) => line.userData.role), [], 'no hidden-line notation is drawn');
  assert.equal(blocks.drumHiddenCircle, undefined);
  assert.equal(blocks.strandHiddenLine, undefined);
  const { drum, diskAssembly, cord } = blocks;
  assert.equal(drum.parent, diskAssembly, 'the drum turns with B');
  assert.ok(drum.visible && drum.isMesh, 'the drum itself is drawn');
  assert.ok(geometry.diskHubRadius < geometry.drumRadius - 0.05, 'Brown\'s small hub leaves the drum clear');
  const cordMesh = cord.userData.mesh;
  assert.equal(cordMesh.geometry.type, 'LaidRopeGeometry', 'cord D is a laid rope');
  assert.ok(cordMesh.visible, 'the cord tube is drawn');
  model.root.updateMatrixWorld(true);
  const drumBox = new THREE.Box3().setFromObject(drum);
  const diskBox = new THREE.Box3().setFromObject(blocks.diskBody);
  assert.ok(drumBox.max.z <= diskBox.min.z + 1e-6, 'the drum lies behind B, hidden from the front as Brown dashes it');
  for (const time of [0, 3, 6, 9]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const { configuration } = model.root.userData.kinematics;
    const tangent = diskAssembly.parent.localToWorld(
      new THREE.Vector3(configuration.drumTangent.x, configuration.drumTangent.y, 0));
    const box = new THREE.Box3().setFromObject(cordMesh);
    assert.ok(box.min.x <= tangent.x + 1e-3 && box.max.x >= tangent.x - 1e-3
      && box.min.y <= tangent.y + 1e-3 && box.max.y >= tangent.y - 1e-3,
    `the cord reaches the drum tangent at ${time}`);
  }
  disposeModel(model.root);
});
