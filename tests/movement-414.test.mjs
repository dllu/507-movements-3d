import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const ARCHETYPE =
  'archimedean-face-scroll-driven-by-feather-keyed-axially-sliding-radial-pinion-with-reciprocal-radius-speed-law';

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function sameAngle(actual, expected, tolerance, message) {
  near(Math.sin(actual), Math.sin(expected), tolerance, `${message} sine`);
  near(Math.cos(actual), Math.cos(expected), tolerance, `${message} cosine`);
}

function signedAngleDifference(actual, expected) {
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
    } else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 414 is one finite face scroll A, one feathered radial shaft, and one axially sliding pinion B', () => {
  const movement = catalog.movements[413];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 414);
  assert.equal(movement.number, '414');
  assert.equal(movement.category, 'Rack & pinion');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /longitudinal feather to pinion B/);
  assert.match(data.mechanism, /one finite Archimedean face-scroll/);
  assert.match(data.mechanism,
    /instantaneous speed gain pinionPitchRadius\/contactRadius increases/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.pinionAxialPositionIndependent, false);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.scrollRotor.parent, model.root);
  assert.equal(blocks.pinionShaftRotor.parent, model.root);
  assert.equal(blocks.spiralRail.parent, blocks.scrollRotor);
  assert.equal(blocks.scrollBackplate.parent, blocks.scrollRotor);
  assert.equal(blocks.scrollShaft.parent, blocks.scrollRotor);
  assert.equal(blocks.pinionShaft.parent, blocks.pinionShaftRotor);
  assert.equal(blocks.shaftFeather.parent, blocks.pinionShaftRotor);
  assert.equal(blocks.slidingPinion.parent, blocks.pinionShaftRotor);
  assert.equal(blocks.pinionBody.parent, blocks.slidingPinion);
  assert.equal(blocks.pinionTeethMeshes.length, 18);
  assert.equal(blocks.scrollTeeth.length, 108);

  const roles = [];
  const belts = [];
  const scrollRacks = [];
  const slidingPinions = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.scrollTooth) scrollRacks.push(object);
    if (object.userData.role
      === 'pinion-B-sliding-axially-on-shaft-feather') {
      slidingPinions.push(object);
    }
  });
  assert.deepEqual(belts, []);
  assert.equal(scrollRacks.length, 108);
  assert.equal(slidingPinions.length, 1);
  for (const role of [
    'variable-speed-scroll-plate-A-output-rotor',
    'single-finite-archimedean-scroll-rack-on-plate-A',
    'uniform-input-feathered-radial-pinion-shaft',
    'longitudinal-feather-key-on-input-shaft',
    'pinion-B-sliding-axially-on-shaft-feather',
    'bevel-like-sliding-pinion-B-body',
    'white-moving-scroll-pinion-pitch-contact',
    'white-scroll-plate-A-output-rotation-index',
    'white-sliding-pinion-B-rotation-index',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 414 records Brown’s plate, variable-speed statement, feather constraint, and unavailable-animation boundary', () => {
  const movement = catalog.movements[413];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate414;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_414.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Scroll gear and sliding pinion/);
  assert.match(movement.description,
    /increasing velocity of scroll-plate, A, in one direction/);
  assert.match(movement.description,
    /decreasing velocity when the motion is reversed/);
  assert.match(movement.description,
    /Pinion, B, moves on a feather on the shaft/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /marks its Animated control unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(dynamics.backlashElasticityInertiaLoadsAndForcesModeled, false);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.scrollPlateAApproximateBoundsPixels,
    [92, 108, 413, 374]);
  assert.deepEqual(plate.pinionBApproximateBoundsPixels,
    [205, 332, 327, 405]);
  assert.deepEqual(plate.radialShaftApproximateBoundsPixels,
    [243, 38, 291, 482]);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence,
    /finite spiral band.*radial shaft.*conical pinion B/);
  assert.match(evidence.reconstructionDisclosure,
    /finite Archimedean scroll/);
  assert.match(evidence.reconstructionDisclosure,
    /exact integrated rolling constraint/);
  disposeModel(model.root);
});

test('movement 414 contact remains on the exact Archimedean scroll and fixed lower radial line over the full throw', () => {
  const model = createMovementModel(catalog.movements[413]);
  const { geometry, stateAtTime } = model.root.userData;
  let minimumRadius = Infinity;
  let maximumRadius = -Infinity;
  let maximumSpiralResidual = 0;
  let maximumWorldContactResidual = 0;

  near(geometry.scrollInnerRadius
    + geometry.spiralLeadPerRadian * geometry.scrollSweep,
  geometry.scrollOuterRadius, 3e-16, 'Archimedean end radii');
  near(geometry.spiralMaximumLocalAngle
    - geometry.spiralMinimumLocalAngle,
  geometry.scrollSweep, 0, 'finite spiral angular extent');
  for (let sample = 0; sample <= 40000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 40000);
    minimumRadius = Math.min(minimumRadius, state.contactRadius);
    maximumRadius = Math.max(maximumRadius, state.contactRadius);
    maximumSpiralResidual = Math.max(maximumSpiralResidual,
      Math.abs(state.spiralRadiusResidual));
    maximumWorldContactResidual = Math.max(maximumWorldContactResidual,
      state.spiralWorldContact.distanceTo(state.pitchContact));
    near(state.spiralLocalAngle,
      geometry.contactWorldAngle - state.plateAngle, 0,
      'local spiral phase at fixed world ray');
    near(state.pitchContact.x, 0, 0,
      'contact constrained to shaft center plane');
    near(state.pitchContact.y, -state.contactRadius, 0,
      'contact constrained to lower radial line');
    near(state.pitchContact.z, geometry.plateFaceZ, 0,
      'contact constrained to scroll face');
  }
  near(minimumRadius, geometry.scrollInnerRadius, 1.2e-15,
    'inner scroll endpoint reached');
  near(maximumRadius, geometry.scrollOuterRadius, 0,
    'outer scroll endpoint reached');
  assert.ok(maximumSpiralResidual < 3e-16);
  assert.ok(maximumWorldContactResidual < 5e-15);
  disposeModel(model.root);
});

test('movement 414 satisfies integrated, velocity, and acceleration rolling constraints throughout forward and reverse travel', () => {
  const model = createMovementModel(catalog.movements[413]);
  const { geometry, stateAtTime } = model.root.userData;
  let maximumIntegratedResidual = 0;
  let maximumSpeedResidual = 0;
  let maximumAccelerationResidual = 0;

  for (let sample = -30000; sample <= 60000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 30000);
    maximumIntegratedResidual = Math.max(maximumIntegratedResidual,
      Math.abs(state.integratedRollingResidual));
    maximumSpeedResidual = Math.max(maximumSpeedResidual,
      Math.abs(state.pitchLineSpeedResidual));
    maximumAccelerationResidual = Math.max(maximumAccelerationResidual,
      Math.abs(state.accelerationConstraintResidual));
    near(state.pinionPitchLineSpeed,
      geometry.pinionPitchRadius * state.pinionAngularSpeed, 0,
      'pinion pitch-line speed');
    near(state.platePitchLineSpeed,
      state.contactRadius * state.plateAngularSpeed, 0,
      'plate pitch-line speed');
  }
  assert.ok(maximumIntegratedResidual < 1.3e-14);
  assert.ok(maximumSpeedResidual < 9e-16);
  assert.ok(maximumAccelerationResidual < 4e-15);
  disposeModel(model.root);
});

test('movement 414 uniform forward input gives strictly increasing plate speed as B slides inward', () => {
  const model = createMovementModel(catalog.movements[413]);
  const { geometry, stateAtTime } = model.root.userData;
  let previousRadius = Infinity;
  let previousSpeed = -Infinity;
  let previousGain = -Infinity;

  for (let sample = 0; sample < 20000; sample += 1) {
    const time = geometry.rampDuration
      + geometry.cruiseDuration * sample / 20000;
    const state = stateAtTime(time);
    assert.equal(state.stage,
      'forward-uniform-input-increasing-output-speed');
    near(state.pinionAngularSpeed,
      geometry.cruisePinionAngularSpeed, 0,
      'uniform forward pinion input');
    assert.ok(state.contactRadius <= previousRadius + 2e-15);
    assert.ok(state.plateAngularSpeed >= previousSpeed - 2e-14);
    assert.ok(state.instantaneousOutputToInputRatio
      >= previousGain - 2e-15);
    assert.ok(state.plateAngularAcceleration > 0);
    assert.ok(state.pinionSlideSpeed > 0);
    previousRadius = state.contactRadius;
    previousSpeed = state.plateAngularSpeed;
    previousGain = state.instantaneousOutputToInputRatio;
  }
  const first = stateAtTime(geometry.rampDuration);
  const last = stateAtTime(
    geometry.rampDuration + geometry.cruiseDuration - 1e-7,
  );
  assert.ok(last.plateAngularSpeed > first.plateAngularSpeed * 1.7);
  assert.ok(last.instantaneousOutputToInputRatio
    > first.instantaneousOutputToInputRatio * 1.7);
  disposeModel(model.root);
});

test('movement 414 uniform reverse input gives strictly decreasing speed magnitude as B slides outward', () => {
  const model = createMovementModel(catalog.movements[413]);
  const { geometry, stateAtTime } = model.root.userData;
  const reverseCruiseStart = geometry.reverseStartTime
    + geometry.rampDuration;
  let previousRadius = -Infinity;
  let previousSpeedMagnitude = Infinity;
  let previousGain = Infinity;

  for (let sample = 0; sample < 20000; sample += 1) {
    const time = reverseCruiseStart
      + geometry.cruiseDuration * sample / 20000;
    const state = stateAtTime(time);
    assert.equal(state.stage,
      'reverse-uniform-input-decreasing-output-speed');
    near(state.pinionAngularSpeed,
      -geometry.cruisePinionAngularSpeed, 0,
      'uniform reverse pinion input');
    assert.ok(state.contactRadius >= previousRadius - 2e-15);
    assert.ok(Math.abs(state.plateAngularSpeed)
      <= previousSpeedMagnitude + 2e-14);
    assert.ok(state.instantaneousOutputToInputRatio
      <= previousGain + 2e-15);
    assert.ok(state.plateAngularAcceleration > 0);
    assert.ok(state.pinionSlideSpeed < 0);
    previousRadius = state.contactRadius;
    previousSpeedMagnitude = Math.abs(state.plateAngularSpeed);
    previousGain = state.instantaneousOutputToInputRatio;
  }
  disposeModel(model.root);
});

test('movement 414 pinion B has only feather-compatible axial slide and remains rotationally locked to its input shaft', () => {
  const model = createMovementModel(catalog.movements[413]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  let minimumY = Infinity;
  let maximumY = -Infinity;

  assert.equal(blocks.slidingPinion.rotation.x, 0);
  assert.equal(blocks.slidingPinion.rotation.y, 0);
  assert.equal(blocks.slidingPinion.rotation.z, 0);
  for (let sample = 0; sample <= 24000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 24000);
    near(state.pinionCenterY,
      -state.contactRadius - geometry.pinionFaceLength / 2,
      0, 'pinion center axial position');
    near(state.pinionSlideSpeed, -state.contactRadiusSpeed, 0,
      'pinion axial speed');
    near(state.pinionSlideAcceleration,
      -state.contactRadiusAcceleration, 0,
      'pinion axial acceleration');
    minimumY = Math.min(minimumY, state.pinionCenterY);
    maximumY = Math.max(maximumY, state.pinionCenterY);
  }
  near(minimumY,
    -geometry.scrollOuterRadius - geometry.pinionFaceLength / 2,
    0, 'outer-end pinion position');
  near(maximumY,
    -geometry.scrollInnerRadius - geometry.pinionFaceLength / 2,
    1.2e-15, 'inner-end pinion position');
  disposeModel(model.root);
});

test('movement 414 input ramps, reversals, and endpoint dwells are position-, speed-, and acceleration-continuous', () => {
  const model = createMovementModel(catalog.movements[413]);
  const { geometry, stateAtTime } = model.root.userData;
  const boundaries = [
    0,
    geometry.rampDuration,
    geometry.rampDuration + geometry.cruiseDuration,
    geometry.rampDuration * 2 + geometry.cruiseDuration,
    geometry.reverseStartTime,
    geometry.reverseStartTime + geometry.rampDuration,
    geometry.reverseStartTime + geometry.rampDuration
      + geometry.cruiseDuration,
    geometry.reverseStartTime + geometry.rampDuration * 2
      + geometry.cruiseDuration,
    geometry.cycleDuration,
  ];
  const epsilon = 1e-7;
  for (const boundary of boundaries) {
    const before = stateAtTime(boundary - epsilon);
    const atBoundary = stateAtTime(boundary);
    const after = stateAtTime(boundary + epsilon);
    near(
      signedAngleDifference(after.pinionAngle, before.pinionAngle),
      2 * epsilon * atBoundary.pinionAngularSpeed,
      5e-12,
      `pinion position continuity at ${boundary}`);
    near(
      signedAngleDifference(after.plateAngle, before.plateAngle),
      2 * epsilon * atBoundary.plateAngularSpeed,
      5e-12,
      `plate position continuity at ${boundary}`);
    near(
      after.pinionAngularSpeed - before.pinionAngularSpeed,
      2 * epsilon * atBoundary.pinionAngularAcceleration,
      2e-9,
      `pinion speed continuity at ${boundary}`);
    near(
      after.plateAngularSpeed - before.plateAngularSpeed,
      2 * epsilon * atBoundary.plateAngularAcceleration,
      9e-10,
      `plate speed continuity at ${boundary}`);
    near(before.pinionAngularAcceleration,
      after.pinionAngularAcceleration, 7e-6,
      `pinion acceleration continuity at ${boundary}`);
    near(before.plateAngularAcceleration,
      after.plateAngularAcceleration, 4e-6,
      `plate acceleration continuity at ${boundary}`);
  }
  assert.equal(stateAtTime(4.5).stage,
    'stationary-inner-end-reversal-dwell');
  assert.equal(stateAtTime(9.5).stage,
    'stationary-outer-end-cycle-dwell');
  disposeModel(model.root);
});

test('movement 414 analytic pinion, plate, radius, and slide derivatives match finite differences', () => {
  const model = createMovementModel(catalog.movements[413]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-5;
  for (const time of [0.31, 0.61, 1.2, 2.3, 3.48, 5.29, 5.62, 6.4, 7.7, 8.56]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    for (const [positionKey, speedKey, accelerationKey] of [
      ['pinionAngle', 'pinionAngularSpeed', 'pinionAngularAcceleration'],
      ['plateAngle', 'plateAngularSpeed', 'plateAngularAcceleration'],
      ['contactRadius', 'contactRadiusSpeed',
        'contactRadiusAcceleration'],
      ['pinionCenterY', 'pinionSlideSpeed',
        'pinionSlideAcceleration'],
    ]) {
      const numericalSpeed = (after[positionKey] - before[positionKey])
        / (2 * step);
      const numericalAcceleration = (after[speedKey] - before[speedKey])
        / (2 * step);
      near(numericalSpeed, state[speedKey], 5e-8,
        `${speedKey} finite difference at ${time}`);
      near(numericalAcceleration, state[accelerationKey], 2e-7,
        `${accelerationKey} finite difference at ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 414 update binds scroll rotation, feathered shaft rotation, pinion slide, and pitch marker to one state', () => {
  const model = createMovementModel(catalog.movements[413]);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.42, 1.7, 3.6, 4.5, 5.4, 6.8, 8.6, 9.5]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.scrollRotor.rotation.z, state.plateAngle, 0,
      'scroll plate update');
    near(blocks.pinionShaftRotor.rotation.y, state.pinionAngle, 0,
      'feathered shaft update');
    near(blocks.slidingPinion.position.y, state.pinionCenterY, 0,
      'pinion axial slide update');
    vectorNear(blocks.contactMarker.position, state.pitchContact, 0,
      'moving pitch marker update');
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  sameAngle(closure.pinionAngle, source.pinionAngle, 0,
    'pinion cycle closure');
  sameAngle(closure.plateAngle, source.plateAngle, 0,
    'plate cycle closure');
  near(closure.pinionCenterY, source.pinionCenterY, 0,
    'pinion slide cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.cycleDuration);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 414 scroll geometry', () => {
  const movement414 = catalog.movements[413];
  const movement507 = catalog.movements[506];
  const model414 = createMovementModel(movement414);
  const model507 = createMovementModel(movement507);

  assert.equal(movement414.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype,
    model414.root.userData.archetype);
  assert.notEqual(model507.root.userData.mechanism,
    model414.root.userData.mechanism);
  disposeModel(model414.root);
  disposeModel(model507.root);
});
