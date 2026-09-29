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

function rasterAngle(point, center) {
  return Math.atan2(center.y - point.y, point.x - center.x);
}

function wrappedDifference(left, right) {
  return Math.atan2(Math.sin(left - right), Math.cos(left - right));
}

test('movement 267 is the four-arm spring-biased one-way friction pulley', () => {
  const movement = catalog.movements[266];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
  } = model.root.userData;

  assert.equal(movement.id, 267);
  assert.equal(movement.number, '267');
  assert.equal(
    movement.title,
    'Spring-Biased Pivoted-Arm One-Way Friction Pulley',
  );
  assert.equal(movement.category, 'Friction drives');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'spring-biased-four-pivot-eccentric-arm-overrunning-friction-pulley',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /four-spring-biased-eccentric-arms/);
  assert.match(mechanism, /counterclockwise-friction-wedges/);
  assert.match(mechanism, /clockwise-friction-retracts/);
  assert.notEqual(blocks.outerRotor, blocks.carrierRotor);
  assert.equal(blocks.rim.parent, blocks.outerRotor);
  assert.equal(blocks.innerLiner.parent, blocks.outerRotor);
  assert.equal(blocks.looseHub.parent, blocks.outerRotor);
  assert.equal(blocks.spokes.length, 4);
  assert.ok(blocks.spokes.every((spoke) => spoke.parent === blocks.outerRotor));
  assert.equal(blocks.carrier.parent, blocks.carrierRotor);
  assert.equal(blocks.shaft.parent, blocks.carrierRotor);
  assert.equal(blocks.arms.length, 4);
  assert.equal(blocks.pivotBosses.length, 4);
  assert.equal(blocks.springs.length, 4);
  assert.ok(blocks.arms.every((arm) => arm.parent === blocks.carrierRotor));
  assert.ok(blocks.springs.every((spring) => (
    spring.parent === blocks.carrierRotor
  )));
  assert.ok(blocks.arms.every((arm) => (
    arm.userData.role === 'spring-biased-pivoted-eccentric-friction-arm'
  )));
  disposeModel(model.root);
});

test('movement 267 preserves the measured unavailable source engraving', () => {
  const movement = catalog.movements[266];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.plate267;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterOuterRimCenter, { x: 266, y: 269 });
  assert.equal(plate.rasterOuterRimRadius, 209);
  assert.equal(plate.rasterInnerWorkingRadius, 190);
  assert.equal(plate.rasterShaftRadius, 33);
  // Pass 107: the four straight lines are the wedges' radial sides.
  assert.equal(plate.rasterSpokeCount, 0);
  assert.equal(plate.rasterArmCount, 4);
  assert.deepEqual(plate.rasterCarrierPivotCenters, [
    { x: 276, y: 205 },
    { x: 328, y: 283 },
    { x: 253, y: 333 },
    { x: 206, y: 258 },
  ]);
  assert.deepEqual(plate.rasterArmContactPoints, [
    { x: 347, y: 97 },
    { x: 433, y: 357 },
    { x: 183, y: 438 },
    { x: 95, y: 194 },
  ]);
  assert.deepEqual(plate.rasterArrow, {
    end: { x: 466, y: 194 },
    start: { x: 396, y: 79 },
  });
  assert.match(plate.inferredTopology, /independently rotating/);
  assert.match(plate.inferredTopology, /four pivoted/);
  assert.match(plate.inferredTopology, /four return springs/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 67,
    edition: 21,
    illustrationPage: 66,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 267 matches the rim, shaft, pivots, and eccentric lead', () => {
  const model = createMovementModel(catalog.movements[266]);
  const { geometry, sourceReference } = model.root.userData;
  const plate = sourceReference.plate267;
  const center = plate.rasterOuterRimCenter;
  const pivotRadii = plate.rasterCarrierPivotCenters.map((point) => (
    Math.hypot(point.x - center.x, point.y - center.y)
  ));
  const averagePivotRadius = pivotRadii.reduce((sum, value) => sum + value, 0)
    / pivotRadii.length;
  const measuredLeadAngles = plate.rasterCarrierPivotCenters
    .slice(0, 3)
    .map((pivot, index) => wrappedDifference(
      rasterAngle(plate.rasterArmContactPoints[index], center),
      rasterAngle(pivot, center),
    ));
  const averageMeasuredLead = measuredLeadAngles.reduce(
    (sum, value) => sum + value,
    0,
  ) / measuredLeadAngles.length;

  near(
    geometry.rimOuterRadius / geometry.rimInnerRadius,
    plate.rasterOuterRimRadius / plate.rasterInnerWorkingRadius,
    2e-16,
    'outer-to-inner rim ratio',
  );
  near(
    geometry.pivotRadius / geometry.rimInnerRadius,
    averagePivotRadius / plate.rasterInnerWorkingRadius,
    0.012,
    'carrier-pivot radius ratio',
  );
  near(
    geometry.shaftRadius / geometry.rimInnerRadius,
    plate.rasterShaftRadius / plate.rasterInnerWorkingRadius,
    0.02,
    'shaft radius ratio',
  );
  near(
    geometry.contactLeadAngle,
    averageMeasuredLead,
    THREE.MathUtils.degToRad(1.2),
    'clockwise eccentric contact lead',
  );
  assert.equal(geometry.pivotCount, plate.rasterArmCount);
  assert.ok(geometry.contactLeadAngle < 0);
  assert.ok(geometry.releasedArmAngle < 0);
  assert.ok(geometry.releasedTipClearance > 0.09);
  disposeModel(model.root);
});

test('movement 267 wedges in the direction opposite the clockwise arrow', () => {
  const model = createMovementModel(catalog.movements[266]);
  const {
    contactDefinition,
    geometry,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;
  let maximumLockedRateError = 0;
  let maximumLockedPhaseError = 0;
  let maximumContactError = 0;

  assert.equal(
    contactDefinition.arrowDirection,
    'clockwise-negative-about-the-visible-positive-z-face',
  );
  assert.ok(contactDefinition.engagingTorquePerUnitTangentialForce > 0);
  assert.ok(contactDefinition.freewheelTorquePerUnitTangentialForce < 0);
  near(
    contactDefinition.freewheelTorquePerUnitTangentialForce,
    -contactDefinition.engagingTorquePerUnitTangentialForce,
    0,
    'opposite friction-torque signs',
  );
  assert.ok(contactDefinition.radialExpansionPerArmRadian > 0);
  assert.match(contactDefinition.reason, /increasing radius/);
  assert.equal(transmission.oppositeArrowLockedRatio, 1);
  assert.equal(transmission.oppositeArrowMotion, 'counterclockwise-positive');

  for (let sample = 0; sample < 4096; sample += 1) {
    const time = timeline.driveDuration * sample / 4096;
    const state = stateAtTime(time);
    maximumLockedRateError = Math.max(
      maximumLockedRateError,
      Math.abs(state.rimAngularSpeed - state.outputAngularSpeed),
    );
    maximumLockedPhaseError = Math.max(
      maximumLockedPhaseError,
      Math.abs(state.rimAngleUnwrapped - state.outputAngleUnwrapped),
    );
    maximumContactError = Math.max(
      maximumContactError,
      Math.abs(state.armTipRadius - geometry.rimInnerRadius),
    );
    assert.equal(state.clutchLocked, true);
    assert.equal(
      state.stage,
      'opposite-arrow-counterclockwise-locked-drive',
    );
    assert.ok(state.rimAngularSpeed >= 0);
  }
  assert.equal(maximumLockedRateError, 0);
  assert.equal(maximumLockedPhaseError, 0);
  assert.ok(maximumContactError < 1e-15);
  disposeModel(model.root);
});

test('movement 267 freewheels clockwise while the output shaft is at rest', () => {
  const model = createMovementModel(catalog.movements[266]);
  const {
    geometry,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;
  let minimumClearance = Infinity;
  let maximumOutputRate = 0;

  assert.equal(transmission.arrowDirectionShaftRemainsAtRest, true);
  assert.equal(transmission.arrowDirectionOutputAngularSpeed, 0);
  for (let sample = 1; sample < 4096; sample += 1) {
    const time = timeline.driveDuration
      + timeline.freewheelDuration * sample / 4096;
    const state = stateAtTime(time);
    minimumClearance = Math.min(minimumClearance, state.armTipClearance);
    maximumOutputRate = Math.max(
      maximumOutputRate,
      Math.abs(state.outputAngularSpeed),
    );
    assert.equal(state.stage, 'arrow-direction-clockwise-freewheel');
    assert.equal(state.outputShaftAtRest, true);
    assert.ok(state.rimAngularSpeed <= 0);
    assert.ok(state.armPivotAngle <= 0);
    assert.ok(state.armTipRadius <= geometry.rimInnerRadius + 2e-15);
    near(state.outputAngleUnwrapped, FULL_TURN, 0,
      `stationary output angle at sample ${sample}`);
  }
  assert.ok(minimumClearance >= -2e-15);
  assert.equal(maximumOutputRate, 0);
  const released = stateAtTime(
    timeline.driveDuration + timeline.freewheelDuration / 2,
  );
  near(released.armPivotAngle, geometry.releasedArmAngle, 0,
    'fully retracted arm angle');
  near(released.armTipClearance, geometry.releasedTipClearance, 0,
    'fully retracted arm clearance');
  assert.ok(released.relativeRimOutputAngularSpeed < 0);
  disposeModel(model.root);
});

test('movement 267 arm, rim, and output derivatives are smooth and analytic', () => {
  const model = createMovementModel(catalog.movements[266]);
  const { canonicalTimes, stateAtTime } = model.root.userData;
  const derivativeStep = 1e-5;
  let maximumRimRateError = 0;
  let maximumOutputRateError = 0;
  let maximumArmRateError = 0;
  let maximumRimAccelerationError = 0;
  let maximumArmAccelerationError = 0;

  for (const time of [0.4, 1.2, 2.6, 3.6, 4.15, 4.55, 5.05, 5.8, 7.5, 8.2, 8.7, 9.05]) {
    const before = stateAtTime(time - derivativeStep);
    const state = stateAtTime(time);
    const after = stateAtTime(time + derivativeStep);
    maximumRimRateError = Math.max(
      maximumRimRateError,
      Math.abs(
        (after.rimAngleUnwrapped - before.rimAngleUnwrapped)
          / (2 * derivativeStep) - state.rimAngularSpeed,
      ),
    );
    maximumOutputRateError = Math.max(
      maximumOutputRateError,
      Math.abs(
        (after.outputAngleUnwrapped - before.outputAngleUnwrapped)
          / (2 * derivativeStep) - state.outputAngularSpeed,
      ),
    );
    maximumArmRateError = Math.max(
      maximumArmRateError,
      Math.abs(
        (after.armPivotAngle - before.armPivotAngle)
          / (2 * derivativeStep) - state.armPivotAngularSpeed,
      ),
    );
    maximumRimAccelerationError = Math.max(
      maximumRimAccelerationError,
      Math.abs(
        (after.rimAngularSpeed - before.rimAngularSpeed)
          / (2 * derivativeStep) - state.rimAngularAcceleration,
      ),
    );
    maximumArmAccelerationError = Math.max(
      maximumArmAccelerationError,
      Math.abs(
        (after.armPivotAngularSpeed - before.armPivotAngularSpeed)
          / (2 * derivativeStep) - state.armPivotAngularAcceleration,
      ),
    );
  }
  assert.ok(maximumRimRateError < 3e-10);
  assert.ok(maximumOutputRateError < 3e-10);
  assert.ok(maximumArmRateError < 4e-10);
  assert.ok(maximumRimAccelerationError < 5e-10);
  assert.ok(maximumArmAccelerationError < 2e-8);

  const engaged = stateAtTime(0);
  const released = stateAtTime(canonicalTimes.maximumRelease);
  const resetStart = stateAtTime(canonicalTimes.springResetStart);
  const closure = stateAtTime(canonicalTimes.cycleClosure);
  assert.ok(released.springLength < engaged.springLength);
  near(resetStart.armPivotAngularSpeed, 0, 0,
    'zero-rate spring reset start');
  near(closure.armPivotAngularSpeed, 0, 0,
    'zero-rate spring reset closure');
  near(closure.springLength, engaged.springLength, 0,
    'spring-length closure');
  disposeModel(model.root);
});

test('movement 267 renderer keeps rim and shaft independent without undrawn indices', () => {
  const model = createMovementModel(catalog.movements[266]);
  const { blocks, stateAtTime } = model.root.userData;
  const arrowPosition = blocks.directionArrow.position.clone();
  const arrowQuaternion = blocks.directionArrow.quaternion.clone();
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));

  assert.equal(
    roles.filter((role) => role
      === 'spring-biased-pivoted-eccentric-friction-arm').length,
    4,
  );
  assert.equal(
    roles.filter((role) => role
      === 'spring-holding-eccentric-arm-toward-rim').length,
    4,
  );
  // Brown draws no white index marks; none are rendered.
  assert.equal(
    roles.filter((role) => role.startsWith('white-')).length,
    0,
  );

  for (const time of [0, 1.3, 3.5, 4.6, 6.4, 8.4, 9.2]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.outerRotor.rotation.z, state.rimAngle, 0,
      `rendered rim angle at ${time}`);
    near(blocks.carrierRotor.rotation.z, state.outputAngle, 0,
      `rendered output angle at ${time}`);
    blocks.arms.forEach((arm, index) => near(
      arm.rotation.z,
      arm.userData.baseAngle + state.armPivotAngle,
      0,
      `rendered eccentric arm ${index} at ${time}`,
    ));
    near(blocks.directionArrow.position.distanceTo(arrowPosition), 0, 0,
      `fixed arrow position at ${time}`);
    near(blocks.directionArrow.quaternion.angleTo(arrowQuaternion), 0, 0,
      `fixed arrow orientation at ${time}`);
    near(blocks.outerRotor.userData.angularSpeed, state.rimAngularSpeed, 0,
      `rendered rim rate at ${time}`);
    near(blocks.carrierRotor.userData.angularSpeed, state.outputAngularSpeed, 0,
      `rendered shaft rate at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 267 closes smoothly with one output turn and leaves 269 authored', () => {
  const model = createMovementModel(catalog.movements[266]);
  const {
    animationTiming,
    canonicalTimes,
    driveSchedule,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);
  const secondClosure = stateAtTime(canonicalTimes.cycleClosure * 2);

  assert.match(driveSchedule.input, /counterclockwise-locked-rim-turn/);
  assert.match(driveSchedule.input, /clockwise-freewheel-return/);
  assert.equal(driveSchedule.sourcePrescribesTiming, false);
  assert.match(driveSchedule.purpose, /without an angular teleport/);
  near(closure.rimAngle, start.rimAngle, 0, 'rim visual closure');
  near(closure.outputAngle, start.outputAngle, 0, 'output visual closure');
  near(closure.armPivotAngle, start.armPivotAngle, 0, 'arm visual closure');
  near(closure.rimAngularSpeed, start.rimAngularSpeed, 0,
    'rim-rate closure');
  near(closure.outputAngularSpeed, start.outputAngularSpeed, 0,
    'output-rate closure');
  near(closure.outputAngleUnwrapped - start.outputAngleUnwrapped, FULL_TURN, 0,
    'one output turn per demonstration');
  near(
    secondClosure.outputAngleUnwrapped - start.outputAngleUnwrapped,
    2 * FULL_TURN,
    0,
    'ratcheted output accumulates without reversing',
  );
  near(transmission.outputAdvancePerDemonstrationCycle, FULL_TURN, 0,
    'declared output advance');
  assert.equal(timeline.demonstrationPeriod, 9.2);
  assert.equal(animationTiming.authoredCyclePeriod, 9.2);
  assert.ok(animationTiming.displayCycleDuration >= 9.2);
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

test('movement 267 arms are Brown wedge plates and the band springs never enter them', () => {
  const model = createMovementModel(catalog.movements[266]);
  const { blocks, geometry, timeline } = model.root.userData;
  const outline = geometry.armOutline;
  // A wedge: the straight radial side leads the pivot and the plate widens
  // from its root to its rim shoe.
  near(geometry.straightEdgeLead, THREE.MathUtils.degToRad(10.8), 1e-12, 'straight side lead');
  assert.ok(geometry.contactLeadAngle < 0 && geometry.shoeStartLead < 0,
    'the shoe lies behind the pivot radial, so counterclockwise drag wedges it');
  const inside = (point, polygon) => {
    let result = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i];
      const b = polygon[j];
      if ((a.y > point.y) !== (b.y > point.y)
        && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
    }
    return result;
  };
  let samples = 0;
  for (let k = 0; k <= 40; k += 1) {
    const time = timeline.driveDuration + (timeline.freewheelDuration + timeline.springResetDuration) * k / 40;
    model.update(time);
    const angle = model.root.userData.kinematics.armPivotAngle;
    const c = Math.cos(-angle);
    const s = Math.sin(-angle);
    const position = blocks.springs[0].userData.leaf.geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      // Band vertex in the rotated plate's frame.
      const point = new THREE.Vector2(c * x - s * y, s * x + c * y);
      assert.ok(!inside(point, outline), `band enters plate at ${time}`);
      samples += 1;
    }
  }
  assert.ok(samples > 1000);
  disposeModel(model.root);
});
