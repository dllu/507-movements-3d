import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const FULL_TURN = Math.PI * 2;

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function nearVector(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
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

test('movement 397 is one constant-speed crank pin, one curved-slot rocker, one finite rod, and one horizontal shuttle', () => {
  const movement = catalog.movements[396];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 397);
  assert.equal(movement.number, '397');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(
    movement.archetype,
    'constant-speed-crank-pin-in-synthesized-two-dwell-curved-slot-rocker-driving-finite-rod-shuttle',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-constant-speed-crank-roller/);
  assert.match(data.mechanism, /one-curved-positive-cam-slot/);
  assert.match(data.mechanism, /finite-rod/);
  assert.match(data.mechanism, /horizontally-guided-shuttle/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.inputs[0], /constant-speed crank angle/);
  assert.equal(blocks.crank.parent, model.root);
  assert.equal(blocks.rocker.parent, model.root);
  assert.equal(blocks.connectingRod.parent, model.root);
  assert.equal(blocks.outputSlider.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.guides.length, 2);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'constant-speed-input-crank-with-slot-roller-pin',
    'crank-pin-running-in-synthesized-curved-slot',
    'bottom-pivoted-rocker-carrying-one-closed-dwell-cam-slot',
    'single-closed-synthesized-slot-centerline-envelope',
    'rocker-top-pin-to-finite-output-rod',
    'finite-link-from-rocker-top-to-horizontal-shuttle-slide',
    'intermittently-reciprocating-horizontal-shuttle-carriage',
    'fixed-horizontal-shuttle-guide-rail',
    'white-index-making-output-strokes-and-dwells-legible',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 397 preserves Brown’s static topology and discloses the independently synthesized slot and dwells', () => {
  const movement = catalog.movements[396];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate397;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_397.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Continuous circular into intermittent rectilinear reciprocating/);
  assert.match(movement.description, /sewing machines.*shuttle/);
  assert.match(movement.description, /three-revolution cylinder printing-presses/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.crankCenterApproximatePixels, [381, 242]);
  assert.deepEqual(plate.crankPinApproximatePixels, [300, 195]);
  assert.deepEqual(plate.rockerPivotApproximatePixels, [327, 407]);
  assert.deepEqual(plate.rockerTopJointApproximatePixels, [327, 108]);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.engravingEvidence, /one long curved slot/);
  assert.match(evidence.reconstructionDisclosure, /no animation/);
  assert.match(evidence.reconstructionDisclosure, /inverse-kinematic slot/);
  assert.match(evidence.reconstructionDisclosure, /30-percent dwells/);
  disposeModel(model.root);
});

test('movement 397 input pin remains on one constant-radius circle at exactly constant angular speed', () => {
  const model = createMovementModel(catalog.movements[396]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const expectedSpeed = FULL_TURN / timeline.cycleDuration;

  for (let sample = -18000; sample <= 36000; sample += 1) {
    const state = stateAtTime(
      timeline.cycleDuration * sample / 18000,
    );
    near(state.inputPinWorld.distanceTo(geometry.crankCenter),
      geometry.crankRadius, 2e-15, 'constant crank radius');
    near(state.inputAngularSpeed, expectedSpeed, 0,
      'constant crank angular speed');
  }
  for (const phase of [-3.19, -0.27, 0.13, 0.71, 2.44]) {
    const start = stateAtTime(timeline.cycleDuration * phase);
    const end = stateAtTime(timeline.cycleDuration * (phase + 1));
    near(end.inputAngle - start.inputAngle, FULL_TURN, 4e-15,
      'one input revolution per cycle');
    nearVector(end.inputPinWorld, start.inputPinWorld, 4e-15,
      'crank-pin orbit closure');
  }
  disposeModel(model.root);
});

test('movement 397 inverse-kinematic slot contains the crank pin at every phase and its rendered spline follows the exact locus', () => {
  const model = createMovementModel(catalog.movements[396]);
  const data = model.root.userData;
  const { geometry, slotSynthesis, stateAtTime, timeline } = data;
  let maximumRenderedError = 0;
  let maximumClosureError = 0;

  assert.match(slotSynthesis.law, /R\(-theta\(phi\)\)/);
  assert.equal(slotSynthesis.samples.length, geometry.slotSampleCount);
  for (let sample = 0; sample <= 36000; sample += 1) {
    const driverPhase = sample / 36000;
    const exact = slotSynthesis.localPointAtDriverPhase(driverPhase);
    const rendered = slotSynthesis.curve.getPoint(driverPhase);
    const renderedError = Math.hypot(
      rendered.x - exact.x,
      rendered.y - exact.y,
    );
    maximumRenderedError = Math.max(maximumRenderedError, renderedError);
    const state = stateAtTime(timeline.cycleDuration * driverPhase);
    maximumClosureError = Math.max(
      maximumClosureError,
      state.slotPinClosureError,
    );
    nearVector(state.slotLocalPoint, exact, 4e-15,
      'analytic fixed-rocker slot coordinate');
  }
  assert.ok(maximumRenderedError < 5e-5,
    `rendered slot error ${maximumRenderedError}`);
  assert.ok(maximumRenderedError < geometry.pinRadius / 1000 * 0.35);
  assert.ok(maximumClosureError < 1.5e-15,
    `analytic pin/slot closure ${maximumClosureError}`);
  disposeModel(model.root);
});

test('movement 397 has two exact output dwells while its crank continues rotating', () => {
  const model = createMovementModel(catalog.movements[396]);
  const data = model.root.userData;
  const { geometry, motion, stateAtTime, timeline } = data;
  const timeForLawPhase = (lawPhase) => timeline.cycleDuration
    * positiveModulo(lawPhase - timeline.sourcePoseLawPhase, 1);

  near(motion.leftDwellFraction, 0.30, 6e-17,
    'left dwell fraction');
  near(motion.rightDwellFraction, 0.30, 6e-17,
    'right dwell fraction');
  for (const lawPhase of [0.01, 0.10, 0.24, 0.46, 0.60, 0.74, 0.96, 0.99]) {
    const state = stateAtTime(timeForLawPhase(lawPhase));
    assert.equal(state.dwellActive, true);
    assert.equal(state.strokeActive, false);
    near(state.rockerAngularSpeed, 0, 0, 'dwell rocker speed');
    near(state.rockerAngularAcceleration, 0, 0,
      'dwell rocker acceleration');
    near(state.sliderVelocity, 0, 0, 'dwell shuttle speed');
    assert.ok(state.inputAngularSpeed > 0);
    if (/right-end/.test(state.outputStage)) {
      near(state.sliderJointWorld.x, geometry.rightSlider, 5e-15,
        'right dwell coordinate');
    } else {
      near(state.sliderJointWorld.x, geometry.leftSlider, 5e-15,
        'left dwell coordinate');
    }
  }
  disposeModel(model.root);
});

test('movement 397 executes one monotonic left stroke and one monotonic right return with zero-speed handoffs', () => {
  const model = createMovementModel(catalog.movements[396]);
  const data = model.root.userData;
  const { motion, stateAtTime, timeline } = data;
  const intervals = timeline.lawPhaseIntervals;
  const timeForLawPhase = (lawPhase) => timeline.cycleDuration
    * positiveModulo(lawPhase - timeline.sourcePoseLawPhase, 1);
  near(motion.leftwardStrokeFraction, 0.20, 6e-17,
    'leftward stroke fraction');
  near(motion.rightwardStrokeFraction, 0.20, 6e-17,
    'rightward stroke fraction');

  let previousLeft = Infinity;
  let previousRight = -Infinity;
  for (let sample = 0; sample <= 4000; sample += 1) {
    const progress = sample / 4000;
    const leftLawPhase = THREE.MathUtils.lerp(
      intervals.leftwardStroke[0],
      intervals.leftwardStroke[1],
      progress,
    );
    const rightLawPhase = THREE.MathUtils.lerp(
      intervals.rightwardStroke[0],
      intervals.rightwardStroke[1],
      progress,
    );
    const left = stateAtTime(timeForLawPhase(leftLawPhase));
    const right = stateAtTime(timeForLawPhase(rightLawPhase));
    assert.ok(left.sliderJointWorld.x <= previousLeft + 2e-14);
    assert.ok(right.sliderJointWorld.x >= previousRight - 2e-14);
    assert.ok(left.sliderVelocity <= 2e-14);
    assert.ok(right.sliderVelocity >= -2e-14);
    previousLeft = left.sliderJointWorld.x;
    previousRight = right.sliderJointWorld.x;
  }
  for (const boundary of [0.25, 0.45, 0.75, 0.95]) {
    const state = stateAtTime(timeForLawPhase(boundary));
    near(state.rockerAngularSpeed, 0, 5e-14,
      'zero-speed rocker handoff');
    near(state.rockerAngularAcceleration, 0, 5e-13,
      'zero-acceleration rocker handoff');
    near(state.sliderVelocity, 0, 2e-13,
      'zero-speed slider handoff');
  }
  disposeModel(model.root);
});

test('movement 397 finite output rod and horizontal guide close exactly through every stroke and dwell', () => {
  const model = createMovementModel(catalog.movements[396]);
  const data = model.root.userData;
  const { constraintResiduals, geometry, stateAtTime, timeline } = data;
  for (const [name, residual] of Object.entries(constraintResiduals)) {
    near(residual, 0, 3e-16, name);
  }
  near(geometry.rightSlider - geometry.leftSlider,
    data.motion.outputStroke, 0, 'reported output stroke');

  for (let sample = -12000; sample <= 24000; sample += 1) {
    const state = stateAtTime(
      timeline.cycleDuration * sample / 12000,
    );
    near(state.sliderJointWorld.y, geometry.guideY, 0,
      'horizontal guide coordinate');
    near(state.topJointWorld.distanceTo(state.sliderJointWorld),
      geometry.connectingRodLength, 1.5e-15,
      'finite connecting-rod length');
  }
  disposeModel(model.root);
});

test('movement 397 output and slotted-rocker state close after every input revolution', () => {
  const model = createMovementModel(catalog.movements[396]);
  const data = model.root.userData;
  const { stateAtTime, timeline } = data;

  for (const phase of [-5.173, -1.281, -0.13, 0.27, 0.81, 3.419]) {
    const start = stateAtTime(timeline.cycleDuration * phase);
    const end = stateAtTime(timeline.cycleDuration * (phase + 1));
    near(end.rockerAngle, start.rockerAngle, 7e-15,
      'rocker cycle closure');
    near(end.rockerAngularSpeed, start.rockerAngularSpeed, 3e-14,
      'rocker-speed cycle closure');
    nearVector(end.sliderJointWorld, start.sliderJointWorld, 3e-14,
      'shuttle cycle closure');
    near(end.sliderVelocity, start.sliderVelocity, 8e-14,
      'shuttle-speed cycle closure');
    nearVector(end.slotLocalPoint, start.slotLocalPoint, 8e-15,
      'slot coordinate cycle closure');
  }
  disposeModel(model.root);
});

test('movement 397 update binds crank, rocker, rod, slide, and reported slot/guide contacts to one state', () => {
  const model = createMovementModel(catalog.movements[396]);
  const data = model.root.userData;
  const { blocks, stateAtTime, timeline } = data;

  for (const phase of [0, 0.10, 0.25, 0.50, 0.75, 0.91]) {
    const time = timeline.cycleDuration * phase;
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.crank.rotation.z, expected.inputAngle, 0,
      'rendered crank angle');
    near(blocks.rocker.rotation.z, expected.rockerAngle, 0,
      'rendered rocker angle');
    near(blocks.outputSlider.position.x, expected.sliderJointWorld.x, 0,
      'rendered slider x');
    near(blocks.outputSlider.position.y, expected.sliderJointWorld.y, 0,
      'rendered slider guide y');
    near(data.contacts.crankPinToCurvedSlot.slotCenterlineError,
      0, 7e-16, 'updated pin/slot closure');
    assert.equal(data.contacts.crankPinToCurvedSlot.drivingRocker,
      expected.strokeActive);
    near(data.contacts.outputRodToSlider.guideError, 0, 0,
      'updated guide closure');
    near(data.contacts.outputRodToSlider.lengthError, 0, 6e-16,
      'updated rod closure');
  }
  disposeModel(model.root);
});

test('movement 397 factory is isolated before movement 398', () => {
  const model397 = createMovementModel(catalog.movements[396]);
  const model398 = createMovementModel(catalog.movements[397]);
  assert.equal(model397.root.userData.fidelity, 'authored');
  assert.equal(
    model397.root.userData.archetype,
    'constant-speed-crank-pin-in-synthesized-two-dwell-curved-slot-rocker-driving-finite-rod-shuttle',
  );
  assert.equal(catalog.movements[397].id, 398);
  assert.equal(catalog.movements[397].fidelity, 'authored');
  assert.equal(
    catalog.movements[397].archetype,
    'constant-speed-three-sided-disc-cam-driving-horizontal-roller-crosshead-finite-rod-and-intermittently-rocking-wheel',
  );
  assert.equal(model398.root.userData.fidelity, 'authored');
  assert.notEqual(
    model398.root.userData.archetype,
    model397.root.userData.archetype,
  );
  disposeModel(model397.root);
  disposeModel(model398.root);
});
