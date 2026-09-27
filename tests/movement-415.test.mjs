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
  'selector-cord-opposed-internal-friction-pawls-on-coaxial-oscillating-lever-for-reversible-intermittent-rim-drive';

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function signedAngleDifference(actual, expected) {
  return Math.atan2(
    Math.sin(actual - expected),
    Math.cos(actual - expected),
  );
}

function sameAngle(actual, expected, tolerance, message) {
  near(signedAngleDifference(actual, expected), 0, tolerance, message);
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

test('movement 415 is one smooth wheel D with coaxial lever A, opposed pawls B/C, and selector crank E', () => {
  const movement = catalog.movements[414];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 415);
  assert.equal(movement.number, '415');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /Lever A oscillates coaxially/);
  assert.match(data.mechanism, /C self-wedges.*positive half-stroke/);
  assert.match(data.mechanism, /B self-wedges.*negative half-stroke/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.independentConfigurationSettings, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.pawlAnglesIndependent, false);
  assert.equal(degreesOfFreedom.selectorChangesPermittedWhileMoving, false);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(blocks.wheelRing.parent, blocks.wheelRotor);
  assert.equal(blocks.bPawl.parent, blocks.leverRotor);
  assert.equal(blocks.cPawl.parent, blocks.leverRotor);
  assert.equal(blocks.selectorRotor.parent, blocks.leverRotor);
  assert.equal(blocks.bCord.parent, blocks.leverRotor);
  assert.equal(blocks.cCord.parent, blocks.leverRotor);
  assert.equal(blocks.leverInputPin.parent, blocks.leverRotor);
  for (const cord of [blocks.bCord, blocks.cCord]) {
    assert.equal(cord.userData.rope.geometry.type, 'LaidRopeGeometry',
      'each E-to-pawl cord is one continuous laid cord');
    assert.equal(cord.userData.segments, undefined);
  }

  const roles = [];
  const belts = [];
  const teeth = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
    if (/ratchet-tooth|rim-tooth/.test(object.userData.role ?? '')) {
      teeth.push(object);
    }
  });
  assert.deepEqual(belts, []);
  assert.deepEqual(teeth, []);
  for (const role of [
    'intermittently-rotating-wheel-D-output',
    'single-smooth-internal-friction-rim-of-wheel-D',
    'coaxially-oscillating-lever-A-input-carrier',
    'selectable-left-pawl-B',
    'selectable-right-pawl-C',
    'small-reversing-crank-E-on-lever-A',
    'constant-material-length-cord-from-E-to-pawl-B',
    'constant-material-length-cord-from-E-to-pawl-C',
  ]) assert.ok(roles.includes(role), role);
  // Brown draws a plain disc and lever: no painted indices or spokes.
  for (const role of [
    'white-wheel-D-intermittent-rotation-index',
    'white-lever-A-oscillation-index',
    'wheel-D-spoke-fast-with-rim-and-hub',
  ]) assert.ok(!roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 415 records Brown’s reversible pawl description, plate topology, and unavailable-animation boundary', () => {
  const movement = catalog.movements[414];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate415;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_415.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /P\. Dickson’s patent device/);
  assert.match(movement.description,
    /oscillating motion into intermittent circular, in either direction/);
  assert.match(movement.description,
    /two pawls, B and C, hinged to its upper side/);
  assert.match(movement.description,
    /Small crank, E.*attached by cord to each of pawls/);
  assert.match(movement.description,
    /contact with interior of rim of wheel, D/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /marks its Animated control unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(dynamics.complianceLoadsInertiaAndImpactModeled, false);
  assert.match(dynamics.frictionModel, /directional self-wedging contact/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.wheelDApproximateBoundsPixels,
    [104, 101, 454, 449]);
  assert.deepEqual(plate.leverAApproximateBoundsPixels,
    [178, 238, 362, 415]);
  assert.deepEqual(plate.pawlBApproximateBoundsPixels,
    [164, 177, 253, 272]);
  assert.deepEqual(plate.pawlCApproximateBoundsPixels,
    [295, 214, 431, 271]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.engravingEvidence,
    /smooth annular wheel D.*T-shaped lever A.*pawls B and C/);
  assert.match(evidence.reconstructionDisclosure,
    /Smooth inner-rim wedge contact is inferred/);
  disposeModel(model.root);
});

test('movement 415 seats only the selected pawl on D’s exact inner circle and visibly lifts the other', () => {
  const model = createMovementModel(catalog.movements[414]);
  const { geometry } = model.root.userData;
  // These checks run on the mechanism's own cycle clock; playback time zero is
  // Brown's pose at geometry.sourceTime.
  const stateAtTime = (t) => model.root.userData.stateAtTime(t - model.root.userData.geometry.sourceTime);
  let minimumBGap = Infinity;
  let minimumCGap = Infinity;
  let maximumBGap = -Infinity;
  let maximumCGap = -Infinity;

  for (let sample = 0; sample <= 48000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 48000);
    minimumBGap = Math.min(minimumBGap, state.bPawlContactGap);
    minimumCGap = Math.min(minimumCGap, state.cPawlContactGap);
    maximumBGap = Math.max(maximumBGap, state.bPawlContactGap);
    maximumCGap = Math.max(maximumCGap, state.cPawlContactGap);
    assert.ok(state.bPawlContactGap >= -8e-16);
    assert.ok(state.cPawlContactGap >= -8e-16);
    assert.ok(state.bPawlContactGap > 1e-6
      || state.cPawlContactGap > 1e-6);
    if (state.drivingPawl === 'B') {
      near(state.bPawlContactGap, 0, 4e-16,
        'B seated during negative drive');
      near(Math.hypot(state.bPawlTipWorld.x, state.bPawlTipWorld.y),
        geometry.wheelInnerRadius, 8e-16,
        'B tip on D inner circle');
      assert.ok(state.cPawlContactGap > 0.09);
    }
    if (state.drivingPawl === 'C') {
      near(state.cPawlContactGap, 0, 4e-16,
        'C seated during positive drive');
      near(Math.hypot(state.cPawlTipWorld.x, state.cPawlTipWorld.y),
        geometry.wheelInnerRadius, 8e-16,
        'C tip on D inner circle');
      assert.ok(state.bPawlContactGap > 0.09);
    }
  }
  near(minimumBGap, 0, 4e-16, 'minimum B gap');
  near(minimumCGap, 0, 4e-16, 'minimum C gap');
  assert.ok(maximumBGap > 0.09);
  assert.ok(maximumCGap > 0.09);
  const midShift = stateAtTime(
    geometry.cToBShiftStart + geometry.cToBShiftDuration / 2,
  );
  assert.ok(midShift.bPawlContactGap > 0.04);
  assert.ok(midShift.cPawlContactGap > 0.04);
  disposeModel(model.root);
});

test('movement 415 pawl C advances D positively on one half-stroke and overruns while D dwells on the return', () => {
  const model = createMovementModel(catalog.movements[414]);
  const { geometry } = model.root.userData;
  // These checks run on the mechanism's own cycle clock; playback time zero is
  // Brown's pose at geometry.sourceTime.
  const stateAtTime = (t) => model.root.userData.stateAtTime(t - model.root.userData.geometry.sourceTime);
  let previousWheelAngle = -Infinity;

  for (let sample = 1; sample < 16000; sample += 1) {
    const time = geometry.cOscillationStart
      + geometry.halfStrokeDuration * sample / 16000;
    const state = stateAtTime(time);
    assert.equal(state.stage, 'C-positive-driving-stroke');
    assert.equal(state.drivingPawl, 'C');
    near(state.wheelAngle,
      state.leverAngle + geometry.leverAmplitude, 0,
      'C driving position constraint');
    near(state.wheelAngularSpeed, state.leverAngularSpeed, 0,
      'C driving speed constraint');
    near(state.wheelAngularAcceleration,
      state.leverAngularAcceleration, 0,
      'C driving acceleration constraint');
    assert.ok(state.wheelAngularSpeed >= 0);
    assert.ok(state.wheelAngle >= previousWheelAngle);
    previousWheelAngle = state.wheelAngle;
  }
  for (let sample = 1; sample < 16000; sample += 1) {
    const time = geometry.cOscillationStart
      + geometry.halfStrokeDuration
      + geometry.halfStrokeDuration * sample / 16000;
    const state = stateAtTime(time);
    assert.equal(state.stage, 'C-negative-overrunning-return');
    assert.equal(state.drivingPawl, null);
    near(state.wheelAngle, geometry.leverAmplitude * 2, 0,
      'D positive-end dwell');
    near(state.wheelAngularSpeed, 0, 0, 'D return-stroke dwell speed');
    assert.ok(state.leverAngularSpeed <= 0);
    assert.ok(state.cPawlContactGap > 0);
  }
  disposeModel(model.root);
});

test('movement 415 pawl B overruns the positive half-stroke then returns D by the same negative increment', () => {
  const model = createMovementModel(catalog.movements[414]);
  const { geometry } = model.root.userData;
  // These checks run on the mechanism's own cycle clock; playback time zero is
  // Brown's pose at geometry.sourceTime.
  const stateAtTime = (t) => model.root.userData.stateAtTime(t - model.root.userData.geometry.sourceTime);
  let previousWheelAngle = Infinity;

  for (let sample = 1; sample < 16000; sample += 1) {
    const time = geometry.bOscillationStart
      + geometry.halfStrokeDuration * sample / 16000;
    const state = stateAtTime(time);
    assert.equal(state.stage, 'B-positive-overrunning-outstroke');
    assert.equal(state.drivingPawl, null);
    near(state.wheelAngle, geometry.leverAmplitude * 2, 0,
      'D held during B overrun');
    near(state.wheelAngularSpeed, 0, 0, 'D B-overrun speed');
    assert.ok(state.leverAngularSpeed >= 0);
    assert.ok(state.bPawlContactGap > 0);
  }
  for (let sample = 1; sample < 16000; sample += 1) {
    const time = geometry.bOscillationStart
      + geometry.halfStrokeDuration
      + geometry.halfStrokeDuration * sample / 16000;
    const state = stateAtTime(time);
    assert.equal(state.stage, 'B-negative-driving-stroke');
    assert.equal(state.drivingPawl, 'B');
    near(state.wheelAngle,
      geometry.leverAmplitude + state.leverAngle, 0,
      'B driving position constraint');
    near(state.wheelAngularSpeed, state.leverAngularSpeed, 0,
      'B driving speed constraint');
    near(state.wheelAngularAcceleration,
      state.leverAngularAcceleration, 0,
      'B driving acceleration constraint');
    assert.ok(state.wheelAngularSpeed <= 0);
    assert.ok(state.wheelAngle <= previousWheelAngle);
    previousWheelAngle = state.wheelAngle;
  }
  near(stateAtTime(geometry.bOscillationEnd).wheelAngle, 0, 0,
    'equal opposite increment returns D');
  disposeModel(model.root);
});

test('movement 415 crank E changes pawl selection only while A and D are stationary', () => {
  const model = createMovementModel(catalog.movements[414]);
  const { geometry } = model.root.userData;
  // These checks run on the mechanism's own cycle clock; playback time zero is
  // Brown's pose at geometry.sourceTime.
  const stateAtTime = (t) => model.root.userData.stateAtTime(t - model.root.userData.geometry.sourceTime);
  let shiftSamples = 0;

  for (let sample = 0; sample <= 60000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 60000);
    if (Math.abs(state.selectorAngularSpeed) > 1e-12) {
      shiftSamples += 1;
      near(state.leverAngularSpeed, 0, 0,
        'A stopped during E shift');
      near(state.wheelAngularSpeed, 0, 0,
        'D stopped during E shift');
      near(state.leverAngle, -geometry.leverAmplitude, 0,
        'A at stopped endpoint during E shift');
      assert.equal(state.drivingPawl, null);
    }
  }
  assert.ok(shiftSamples > 8000);
  assert.equal(stateAtTime(0).selectedPawl, 'C');
  assert.equal(stateAtTime(5.5).selectedPawl, 'between-C-and-B');
  assert.equal(stateAtTime(6.25).selectedPawl, 'B');
  assert.equal(stateAtTime(11.125).selectedPawl, 'between-B-and-C');
  assert.equal(stateAtTime(11.75).selectedPawl, 'C');
  disposeModel(model.root);
});

test('movement 415 both E-to-pawl cords preserve material length through selection and overrun', () => {
  const model = createMovementModel(catalog.movements[414]);
  const { geometry } = model.root.userData;
  // These checks run on the mechanism's own cycle clock; playback time zero is
  // Brown's pose at geometry.sourceTime.
  const stateAtTime = (t) => model.root.userData.stateAtTime(t - model.root.userData.geometry.sourceTime);
  let maximumResidual = 0;
  let observedSlack = false;

  for (let sample = -18000; sample <= 36000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 18000);
    for (const [name, cord, materialLength, start, end] of [
      ['B', state.bCord, geometry.bCordMaterialLength,
        state.bCrankPinLocal, state.bCordEyeLocal],
      ['C', state.cCord, geometry.cCordMaterialLength,
        state.cCrankPinLocal, state.cCordEyeLocal],
    ]) {
      maximumResidual = Math.max(maximumResidual,
        Math.abs(cord.totalLength - materialLength));
      near(cord.segmentLengths[0] + cord.segmentLengths[1],
        materialLength, 2e-15, `${name} segment length sum`);
      vectorNear(cord.start, start, 0, `${name} crank endpoint`);
      vectorNear(cord.end, end, 0, `${name} pawl endpoint`);
      assert.ok(cord.chordLength <= materialLength + 2e-16);
      if (cord.sag > 0.12) observedSlack = true;
    }
  }
  assert.ok(maximumResidual < 2e-15);
  assert.ok(observedSlack);
  disposeModel(model.root);
});

test('movement 415 input connecting rod has constant length and its outer pin stays in one horizontal guide', () => {
  const model = createMovementModel(catalog.movements[414]);
  const { geometry } = model.root.userData;
  // These checks run on the mechanism's own cycle clock; playback time zero is
  // Brown's pose at geometry.sourceTime.
  const stateAtTime = (t) => model.root.userData.stateAtTime(t - model.root.userData.geometry.sourceTime);
  let minimumSliderX = Infinity;
  let maximumSliderX = -Infinity;

  for (let sample = 0; sample <= 24000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 24000);
    near(state.inputRodLength, geometry.inputRodLength, 9e-16,
      'constant input rod length');
    near(state.inputSlider.y, geometry.inputGuideY, 0,
      'slider constrained to guide y');
    vectorNear(state.inputPin,
      geometry.inputPinLocal.clone().applyAxisAngle(
        new THREE.Vector3(0, 0, 1),
        state.leverAngle,
      ), 4e-16, 'tail pin rotates rigidly with A');
    minimumSliderX = Math.min(minimumSliderX, state.inputSlider.x);
    maximumSliderX = Math.max(maximumSliderX, state.inputSlider.x);
  }
  assert.ok(maximumSliderX - minimumSliderX > 1.0);
  disposeModel(model.root);
});

test('movement 415 stroke, dwell, and selector boundaries are position-, speed-, and acceleration-continuous', () => {
  const model = createMovementModel(catalog.movements[414]);
  const { geometry } = model.root.userData;
  // These checks run on the mechanism's own cycle clock; playback time zero is
  // Brown's pose at geometry.sourceTime.
  const stateAtTime = (t) => model.root.userData.stateAtTime(t - model.root.userData.geometry.sourceTime);
  const boundaries = [
    0,
    geometry.cOscillationStart,
    geometry.cOscillationStart + geometry.halfStrokeDuration,
    geometry.cOscillationEnd,
    geometry.cToBShiftStart,
    geometry.cToBShiftEnd,
    geometry.bOscillationStart,
    geometry.bOscillationStart + geometry.halfStrokeDuration,
    geometry.bOscillationEnd,
    geometry.bToCShiftStart,
    geometry.bToCShiftEnd,
    geometry.cycleDuration,
  ];
  const epsilon = 1e-7;

  for (const boundary of boundaries) {
    const before = stateAtTime(boundary - epsilon);
    const atBoundary = stateAtTime(boundary);
    const after = stateAtTime(boundary + epsilon);
    for (const [angle, speed] of [
      ['leverAngle', 'leverAngularSpeed'],
      ['wheelAngle', 'wheelAngularSpeed'],
      ['selectorAngle', 'selectorAngularSpeed'],
    ]) {
      near(signedAngleDifference(after[angle], before[angle]),
        2 * epsilon * atBoundary[speed], 3e-11,
        `${angle} continuity at ${boundary}`);
    }
    for (const [speed, acceleration] of [
      ['leverAngularSpeed', 'leverAngularAcceleration'],
      ['wheelAngularSpeed', 'wheelAngularAcceleration'],
      ['selectorAngularSpeed', 'selectorAngularAcceleration'],
    ]) {
      near(after[speed] - before[speed],
        2 * epsilon * atBoundary[acceleration], 3e-8,
        `${speed} continuity at ${boundary}`);
      near(before[acceleration], after[acceleration], 3e-5,
        `${acceleration} continuity at ${boundary}`);
    }
    sameAngle(before.bPawlAngle, after.bPawlAngle, 5e-10,
      `B pawl continuity at ${boundary}`);
    sameAngle(before.cPawlAngle, after.cPawlAngle, 5e-10,
      `C pawl continuity at ${boundary}`);
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  sameAngle(closure.leverAngle, source.leverAngle, 0,
    'lever cycle closure');
  sameAngle(closure.wheelAngle, source.wheelAngle, 0,
    'wheel cycle closure');
  sameAngle(closure.selectorAngle, source.selectorAngle, 0,
    'selector cycle closure');
  disposeModel(model.root);
});

test('movement 415 analytic lever, wheel, and selector derivatives match finite differences', () => {
  const model = createMovementModel(catalog.movements[414]);
  const { geometry } = model.root.userData;
  // These checks run on the mechanism's own cycle clock; playback time zero is
  // Brown's pose at geometry.sourceTime.
  const stateAtTime = (t) => model.root.userData.stateAtTime(t - model.root.userData.geometry.sourceTime);
  const step = 1e-5;
  for (const time of [0.83, 1.4, 2.12, 2.83, 3.7, 5.18, 5.54, 5.83,
    6.82, 7.6, 8.17, 8.82, 9.6, 10.17, 10.92, 11.22, 11.42]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    for (const [positionKey, speedKey, accelerationKey] of [
      ['leverAngle', 'leverAngularSpeed', 'leverAngularAcceleration'],
      ['wheelAngle', 'wheelAngularSpeed', 'wheelAngularAcceleration'],
      ['selectorAngle', 'selectorAngularSpeed',
        'selectorAngularAcceleration'],
    ]) {
      const numericalSpeed = (after[positionKey] - before[positionKey])
        / (2 * step);
      const numericalAcceleration = (after[speedKey] - before[speedKey])
        / (2 * step);
      near(numericalSpeed, state[speedKey], 4e-8,
        `${speedKey} finite difference at ${time}`);
      near(numericalAcceleration, state[accelerationKey], 2e-7,
        `${accelerationKey} finite difference at ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 415 update binds D, A, B, C, E, cords, input rod, and slider to one state', () => {
  const model = createMovementModel(catalog.movements[414]);
  const { blocks, geometry } = model.root.userData;
  // These checks run on the mechanism's own cycle clock; playback time zero is
  // Brown's pose at geometry.sourceTime.
  const stateAtTime = (t) => model.root.userData.stateAtTime(t - model.root.userData.geometry.sourceTime);

  for (const time of [0, 1.4, 3.5, 4.75, 5.5, 6.25, 7.5, 9.5,
    10.65, 11.125, 11.75]) {
    model.update(time - geometry.sourceTime);
    const state = stateAtTime(time);
    near(blocks.wheelRotor.rotation.z, state.wheelAngle, 0,
      'wheel D update');
    near(blocks.leverRotor.rotation.z, state.leverAngle, 0,
      'lever A update');
    near(blocks.bPawl.rotation.z, state.bPawlAngle, 0,
      'pawl B update');
    near(blocks.cPawl.rotation.z, state.cPawlAngle, 0,
      'pawl C update');
    // E turns about its journal (lever A's centre line): half a turn between selections.
    near(blocks.selectorRotor.rotation.y,
      -Math.PI / 2 * (1 - state.selectorAngle / geometry.selectorAmplitude), 1e-15,
      'selector E update');
    near(blocks.inputSlider.position.x, state.inputSlider.x, 0,
      'input slider update');
    // Pin-to-slider-pin distance is the constant rod length; the rendered
    // shank runs from the eye round the lever pin to the slider's face.
    near(state.inputPin.distanceTo(state.inputSlider), geometry.inputRodLength, 1e-12,
      'input rod pin-to-pin length');
    const shankEnd = state.inputSlider.clone().setZ(0).add(new THREE.Vector3(-0.176, 0, 0));
    const shankStart = state.inputPin.clone().setZ(0).addScaledVector(
      shankEnd.clone().sub(state.inputPin.clone().setZ(0)).normalize(), 0.206);
    near(blocks.inputRod.scale.y, shankStart.distanceTo(shankEnd), 1e-12,
      'input rod rendered shank');
    near(blocks.bCord.userData.renderedLength,
      geometry.bCordMaterialLength, 4e-16,
      'B cord rendered length');
    near(blocks.cCord.userData.renderedLength,
      geometry.cCordMaterialLength, 4e-16,
      'C cord rendered length');
  }
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.cycleDuration);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 415 geometry', () => {
  const movement415 = catalog.movements[414];
  const movement507 = catalog.movements[506];
  const model415 = createMovementModel(movement415);
  const model507 = createMovementModel(movement507);

  assert.equal(movement415.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model415.root);
  disposeModel(model507.root);
});
