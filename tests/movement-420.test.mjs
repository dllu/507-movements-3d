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
  'pivoted-bell-hammer-with-preloaded-under-lever-return-leaf-spring-and-clear-ring-dwell';

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

test('movement 420 is one pivoted external hammer, one under-lever return spring, and one separately supported bell', () => {
  const movement = catalog.movements[419];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 420);
  assert.equal(movement.number, '420');
  assert.equal(movement.category, 'Springs & balances');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /rigid external hammer pivots/);
  assert.match(data.mechanism, /preloaded curved leaf spring.*beneath/);
  assert.match(data.mechanism, /long ringing dwell/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.hammerAngleIndependent, false);
  assert.equal(degreesOfFreedom.springDeflectionIndependent, false);
  assert.equal(degreesOfFreedom.bellStructuralModesRepresented, 1);
  assert.equal(blocks.hammer.parent, model.root);
  assert.equal(blocks.returnLeafSpring.parent, model.root);
  assert.equal(blocks.springContactPad.parent, model.root);
  assert.equal(blocks.bellBody.parent, blocks.bellPivot);
  assert.equal(blocks.bellPivot.parent, model.root);
  assert.equal(blocks.fixedBellSupport.parent, model.root);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(blocks.returnLeafSpring.children.length, 24);
  for (const role of [
    'pivoted-external-bell-hammer',
    'fixed-bearing-at-hammer-pivot',
    'rigid-hammer-arm',
    'abstract-actuating-tail-of-hammer',
    'rectangular-hammer-head',
    'rounded-bell-contact-face',
    'preloaded-under-lever-return-leaf-spring',
    'sliding-contact-of-leaf-spring-under-hammer',
    'fixed-mounted-struck-bell',
    'reinforced-lip-at-hammer-contact-height',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 420 records Brown’s hammer, lower spring, post-strike clearance, and unavailable-animation boundary', () => {
  const movement = catalog.movements[419];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate420;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_420.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /hammer for striking bells/);
  assert.match(movement.description, /Spring below the hammer raises it/);
  assert.match(movement.description, /out of contact with the bell after striking/);
  assert.match(movement.description, /prevents it from interfering with the vibration/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsSpringRateOrLoads,
    false,
  );
  assert.equal(dynamics.actuatorAndImpactContactForceHistoryModeled, false);
  assert.match(dynamics.bellResponse, /legibility cue.*elastic shell solution/);
  assert.match(dynamics.hammerMotion, /prescribed compact-support strike pulse/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.hammerPivotApproximateCenterPixels, [161, 327]);
  assert.deepEqual(plate.returnSpringApproximateBoundsPixels,
    [167, 260, 254, 370]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence,
    /external rectangular-headed hammer.*curved leaf spring/);
  assert.match(evidence.reconstructionDisclosure,
    /no actuator.*spring characteristic.*impact speed/);
  disposeModel(model.root);
});

test('movement 420 compact strike pulse is C2 at its dwell boundaries and reaches one exact contact pose', () => {
  const model = createMovementModel(catalog.movements[419]);
  const { geometry, stateAtTime } = model.root.userData;
  const start = stateAtTime(geometry.strikeWindowStart);
  const strike = stateAtTime(geometry.strikeTime);
  const end = stateAtTime(
    geometry.strikeWindowStart + geometry.strikeWindowDuration,
  );

  for (const [state, label] of [[start, 'start'], [end, 'end']]) {
    near(state.pulsePosition, 0, 0, `${label} pulse position`);
    near(state.pulseVelocity, 0, 0, `${label} pulse velocity`);
    near(state.pulseAcceleration, 0, 0, `${label} pulse acceleration`);
    near(state.hammerAngle, geometry.restAngle, 0,
      `${label} rest angle`);
    near(state.hammerAngularSpeed, 0, 0,
      `${label} rest speed`);
    near(state.hammerAngularAcceleration, 0, 0,
      `${label} rest acceleration`);
  }
  near(strike.pulsePosition, 1, 3e-16, 'strike pulse peak');
  near(strike.pulseVelocity, 0, 1e-14, 'strike pulse speed');
  near(strike.hammerAngle, geometry.strikeAngle, 1e-16,
    'strike angle');
  vectorNear(strike.hammerHeadCenter, geometry.strikeHeadCenter, 5e-16,
    'strike head center');
  near(strike.contactClearance, 0, 1e-14, 'exact bell contact');
  assert.equal(strike.isImpact, true);
  assert.equal(strike.hammerClearOfBell, false);
  disposeModel(model.root);
});

test('movement 420 hammer never penetrates the bell and clears it promptly for most of the cycle', () => {
  const model = createMovementModel(catalog.movements[419]);
  const { geometry, motion, stateAtTime } = model.root.userData;
  let minimumClearance = Infinity;
  let minimumTime = 0;
  let clearSamples = 0;
  const sampleCount = 100000;

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const time = geometry.cycleDuration * sample / sampleCount;
    const state = stateAtTime(time);
    if (state.contactClearance < minimumClearance) {
      minimumClearance = state.contactClearance;
      minimumTime = time;
    }
    if (state.hammerClearOfBell) clearSamples += 1;
    assert.ok(state.contactClearance >= -1e-14);
  }
  near(minimumTime, geometry.strikeTime, 5e-15,
    'unique closest-approach time');
  near(minimumClearance, 0, 1e-14, 'minimum clearance');
  assert.ok(clearSamples / sampleCount > 0.999);
  near(motion.clearDwellDuration,
    geometry.cycleDuration - geometry.strikeWindowDuration, 0,
    'declared clear dwell');
  assert.ok(motion.clearDwellDuration > geometry.strikeWindowDuration * 2);
  disposeModel(model.root);
});

test('movement 420 lower leaf spring stays preloaded and gains restoring force throughout the approach', () => {
  const model = createMovementModel(catalog.movements[419]);
  const { geometry, stateAtTime } = model.root.userData;
  const rest = stateAtTime(0);
  const strike = stateAtTime(geometry.strikeTime);
  let previousCompression = -Infinity;

  near(rest.springCompression, geometry.springPreload, 0,
    'rest preload');
  near(rest.returnSpringForce,
    geometry.springStiffness * geometry.springPreload, 0,
    'rest spring force');
  for (let sample = 0; sample <= 20000; sample += 1) {
    const time = geometry.strikeWindowStart
      + geometry.strikeWindowDuration * 0.5 * sample / 20000;
    const state = stateAtTime(time);
    assert.ok(state.springCompression >= previousCompression - 2e-15);
    assert.ok(state.springCompression >= geometry.springPreload - 2e-16);
    assert.ok(state.returnSpringForce > 0);
    assert.ok(state.returnSpringTorque > 0);
    near(state.springElasticEnergy,
      0.5 * geometry.springStiffness * state.springCompression ** 2,
      0, 'spring energy');
    assert.ok(state.springContact.y < geometry.pivot.y
      + geometry.springContactRadius + 1e-15);
    previousCompression = state.springCompression;
  }
  assert.ok(strike.springCompression > rest.springCompression * 5);
  assert.ok(strike.returnSpringTorque > rest.returnSpringTorque * 6);
  disposeModel(model.root);
});

test('movement 420 hammer head and spring contact obey one rigid lever angle with exact analytic derivatives', () => {
  const model = createMovementModel(catalog.movements[419]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 50000; sample += 1) {
    const time = geometry.cycleDuration * sample / 50000;
    const state = stateAtTime(time);
    const headRadial = state.hammerHeadCenter.clone().sub(geometry.pivot);
    const springRadial = state.springContact.clone().sub(geometry.pivot);
    springRadial.z = 0;
    near(headRadial.length(), geometry.hammerArmLength, 5e-16,
      'rigid head radius');
    near(springRadial.length(), Math.hypot(geometry.springContactRadius,.1752), 8e-16,
      'rigid spring-contact radius');
    near(Math.atan2(headRadial.y, headRadial.x), state.hammerAngle,
      2.3e-16, 'head angle');
    near(state.hammerHeadVelocity.dot(headRadial), 0, 9e-16,
      'head velocity tangent to orbit');
    near(headRadial.dot(state.hammerHeadAcceleration)
      + state.hammerHeadVelocity.lengthSq(), 0, 6.3e-15,
      'head acceleration constraint');
  }
  disposeModel(model.root);
});

test('movement 420 analytic hammer motion matches finite differences inside the strike window', () => {
  const model = createMovementModel(catalog.movements[419]);
  const { geometry, stateAtTime } = model.root.userData;
  const timeStep = 1e-5;

  for (const unitTime of [0.07, 0.16, 0.28, 0.39, 0.5, 0.63, 0.76,
    0.88, 0.95]) {
    const time = geometry.strikeWindowStart
      + geometry.strikeWindowDuration * unitTime;
    const state = stateAtTime(time);
    const before = stateAtTime(time - timeStep);
    const after = stateAtTime(time + timeStep);
    const numericalAngularSpeed = (
      after.hammerAngle - before.hammerAngle
    ) / (2 * timeStep);
    const numericalAngularAcceleration = (
      after.hammerAngularSpeed - before.hammerAngularSpeed
    ) / (2 * timeStep);
    const numericalHeadVelocity = after.hammerHeadCenter.clone()
      .sub(before.hammerHeadCenter)
      .multiplyScalar(1 / (2 * timeStep));
    near(numericalAngularSpeed, state.hammerAngularSpeed, 2e-9,
      `hammer speed at u=${unitTime}`);
    near(numericalAngularAcceleration, state.hammerAngularAcceleration,
      5e-8, `hammer acceleration at u=${unitTime}`);
    vectorNear(numericalHeadVelocity, state.hammerHeadVelocity, 5e-9,
      `head velocity at u=${unitTime}`);
  }
  disposeModel(model.root);
});

test('movement 420 bell response starts only at impact, ends exactly, and leaves a clear hammer dwell', () => {
  const model = createMovementModel(catalog.movements[419]);
  const { geometry, stateAtTime } = model.root.userData;
  let maximumBellAngle = 0;

  for (let sample = 0; sample <= 80000; sample += 1) {
    const time = geometry.cycleDuration * sample / 80000;
    const state = stateAtTime(time);
    maximumBellAngle = Math.max(maximumBellAngle, Math.abs(state.bellAngle));
    if (time <= geometry.strikeTime
      || time >= geometry.strikeTime + geometry.ringDuration) {
      near(state.bellAngle, 0, 0, 'bell outside finite ring window');
    }
    if (time > geometry.strikeWindowStart + geometry.strikeWindowDuration) {
      assert.equal(state.hammerClearOfBell, true);
      near(state.hammerAngle, geometry.restAngle, 0,
        'hammer clear rest during ring dwell');
    }
  }
  assert.ok(maximumBellAngle > THREE.MathUtils.degToRad(1.1));
  assert.ok(maximumBellAngle <= geometry.bellVibrationAmplitude + 1e-16);
  near(stateAtTime(geometry.strikeTime).bellAngle, 0, 0,
    'bell response begins at zero displacement');
  assert.notEqual(stateAtTime(geometry.strikeTime + 0.03).bellAngle, 0);
  near(stateAtTime(geometry.strikeTime + geometry.ringDuration).bellAngle,
    0, 0, 'bell response cutoff');
  disposeModel(model.root);
});

test('movement 420 update binds hammer, flexed leaf spring, contact pad, and bell response to one state', () => {
  const model = createMovementModel(catalog.movements[419]);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.55, 0.78, 1.1, 1.24, 1.65, 2.2, 3.15,
    4.38]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.hammer.rotation.z, state.hammerAngle, 0,
      'hammer update');
    sameAngle(blocks.bellPivot.rotation.z, state.bellAngle, 0,
      'bell update');
    vectorNear(blocks.springContactPad.position, state.springContact, 0,
      'spring contact update');
    assert.equal(blocks.returnLeafSpring.children.length, 24);
    for (const segment of blocks.returnLeafSpring.children) {
      assert.ok(Number.isFinite(segment.scale.y));
      assert.ok(segment.scale.y > 0);
    }
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  near(closure.hammerAngle, source.hammerAngle, 0,
    'hammer cycle closure');
  near(closure.bellAngle, source.bellAngle, 0,
    'bell cycle closure');
  near(closure.springCompression, source.springCompression, 0,
    'spring cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.cycleDuration);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 420 bell-hammer geometry', () => {
  const movement420 = catalog.movements[419];
  const movement507 = catalog.movements[506];
  const model420 = createMovementModel(movement420);
  const model507 = createMovementModel(movement507);

  assert.equal(movement420.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model420.root);
  disposeModel(model507.root);
});
