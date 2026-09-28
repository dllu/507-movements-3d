import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
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

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
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

test('movement 283 is one handled pinion driving two opposed pump racks', () => {
  const movement = catalog.movements[282];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 283);
  assert.equal(movement.number, '283');
  assert.equal(movement.title,
    'Hand-Rocked Pinion with Opposed Pump Racks');
  assert.equal(movement.category, 'Rack & pinion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'half-turn-handle-pinion-opposed-air-pump-racks');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one manual handle is rigidly fixed/);
  assert.match(mechanism, /left vertical rack upward/);
  assert.match(mechanism, /right vertical rack downward/);
  assert.match(mechanism, /equal no-slip pitch travel/);
  assert.match(transmission.output, /equal-stroke, opposite-phase/);

  assert.equal(blocks.pinion.parent, model.root);
  assert.equal(blocks.pinionRotor.parent, blocks.pinion);
  assert.equal(blocks.handle.parent, blocks.pinionRotor);
  assert.equal(blocks.handleGrip.parent, blocks.pinionRotor);
  assert.equal(blocks.leftRack.parent, model.root);
  assert.equal(blocks.rightRack.parent, model.root);
  assert.equal(blocks.leftRackBody.parent, blocks.leftRack);
  assert.equal(blocks.rightRackBody.parent, blocks.rightRack);
  assert.ok(blocks.leftRackTeeth.every(
    ({ parent }) => parent === blocks.leftRack,
  ));
  assert.ok(blocks.rightRackTeeth.every(
    ({ parent }) => parent === blocks.rightRack,
  ));
  assert.equal(blocks.leftPiston.parent, blocks.leftRack);
  assert.equal(blocks.rightPiston.parent, blocks.rightRack);
  assert.equal(blocks.pumpCylinders.length, 2);
  assert.ok(blocks.pumpCylinders.every(({ parent }) => parent === model.root));
  vectorNear(blocks.pinion.userData.axis, Z_AXIS, 0, 'pinion axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'manual-handle-rigid-to-pinion').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'left-vertical-air-pump-rack').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'right-vertical-air-pump-rack').length, 1);
  assert.equal(roles.filter((role) => /air-pump-piston$/.test(role)).length,
    2);
  assert.equal(roles.filter((role) => /rack-pinion-pitch-contact/.test(role))
    .length, 0);
  assert.ok(blocks.contactMarkers.every(marker=>!marker.visible));
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 283 records the measured plate and bounded animation evidence', () => {
  const model = createMovementModel(catalog.movements[282]);
  const {
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.plate283;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.deepEqual(sourceAnimation.observedCycleFractions,
    [0, 0.4, 0.5, 0.9, 1]);
  near(sourceAnimation.observedPinionAngularStroke, Math.PI, 0,
    'observed half-turn stroke');
  near(sourceAnimation.observedRackStrokeToPitchRadiusRatio, Math.PI, 0,
    'observed rack-stroke ratio');
  assert.match(sourceAnimation.referenceScope,
    /half-turn pinion stroke/);
  assert.match(sourceAnimation.referenceScope, /40\/10\/40\/10/);
  assert.match(sourceAnimation.referenceScope, /geometry.*independent/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_283.html');
  assert.equal(sourceReference.officialDescription,
    catalog.movements[282].description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 6);
  assert.deepEqual(plate.rasterPinionCenter, { x: 270, y: 232 });
  assert.deepEqual(plate.rasterPinionPitchLeft, { x: 217, y: 232 });
  assert.deepEqual(plate.rasterPinionPitchRight, { x: 323, y: 232 });
  assert.deepEqual(plate.rasterHandleGrip, { x: 174, y: 130 });
  assert.deepEqual(plate.rasterLeftRackBottom, { x: 211, y: 385 });
  assert.deepEqual(plate.rasterRightRackTop, { x: 328, y: 54 });
  assert.equal(plate.pinionPitchRadiusPixels, 53);
  for (const [side, error] of Object.entries(
    plate.pitchRadiusFitPixelErrors,
  )) {
    assert.ok(error <= plate.measurementUncertaintyPixels,
      `${side} pitch radius error is ${error}px`);
  }
  for (const [side, error] of Object.entries(
    plate.outerRadiusFitPixelErrors,
  )) {
    assert.ok(error <= plate.measurementUncertaintyPixels,
      `${side} outer radius error is ${error}px`);
  }
  assert.match(plate.inferredTopology, /eighteen-tooth pinion/);
  assert.match(plate.inferredTopology, /left inward-facing vertical rack/);
  vectorNear(sourcePointToModel(plate.rasterPinionCenter),
    new THREE.Vector2(0, 0), 0, 'source pinion center');
  vectorNear(stateAtTime(0).handleGrip,
    new THREE.Vector3(-1.728, 1.836, 0), 4e-16,
  'source handle grip');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 75,
    edition: 21,
    illustrationPage: 74,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 283 follows one smooth half-turn, dwell, return, dwell cycle', () => {
  const model = createMovementModel(catalog.movements[282]);
  const {
    stateAtCyclePhase,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;

  assert.equal(timeline.cyclePeriod, 4);
  assert.equal(timeline.forwardStrokeFraction, 0.4);
  assert.equal(timeline.farDwellFraction, 0.1);
  assert.equal(timeline.returnStrokeFraction, 0.4);
  assert.equal(timeline.nearDwellFraction, 0.1);
  assert.deepEqual(timeline.schedule, [
    'clockwise-half-turn',
    'far-end-dwell',
    'counterclockwise-half-turn',
    'near-end-dwell',
  ]);
  assert.match(transmission.septicEndpointConditions,
    /zero velocity, acceleration, and jerk/);

  const start = stateAtCyclePhase(0);
  const farStart = stateAtCyclePhase(0.4);
  const farMiddle = stateAtCyclePhase(0.45);
  const returnStart = stateAtCyclePhase(0.5);
  const nearStart = stateAtCyclePhase(0.9);
  const nearMiddle = stateAtCyclePhase(0.95);
  near(start.gearAngle, 0, 0, 'near endpoint');
  near(farStart.gearAngle, -Math.PI, 0, 'far endpoint');
  near(farMiddle.gearAngle, -Math.PI, 0, 'far dwell position');
  near(returnStart.gearAngle, -Math.PI, 0, 'return start position');
  near(nearStart.gearAngle, 0, 0, 'near dwell start');
  near(nearMiddle.gearAngle, 0, 0, 'near dwell position');
  for (const state of [start, farStart, farMiddle, returnStart, nearStart,
    nearMiddle]) {
    near(state.gearAngularSpeed, 0, 0,
      `${state.stage} endpoint speed`);
    near(state.gearAngularAcceleration, 0, 0,
      `${state.stage} endpoint acceleration`);
  }
  assert.equal(farMiddle.stage, 'far-end-dwell');
  assert.equal(nearMiddle.stage, 'near-end-dwell');
  assert.ok(stateAtCyclePhase(0.2).gearAngularSpeed < 0);
  assert.ok(stateAtCyclePhase(0.7).gearAngularSpeed > 0);
  near(transmission.pinionAngularStroke, Math.PI, 0,
    'declared pinion stroke');
  near(stateAtTime(1.6).gearAngle - stateAtTime(0).gearAngle,
    -Math.PI, 0, 'clockwise half-turn');
  near(stateAtTime(3.6).gearAngle - stateAtTime(2).gearAngle,
    Math.PI, 0, 'counterclockwise return');
  disposeModel(model.root);
});

test('movement 283 keeps both rack meshes simultaneous and exactly no-slip', () => {
  const model = createMovementModel(catalog.movements[282]);
  const {
    geometry,
    stateAtCyclePhase,
    transmission,
  } = model.root.userData;
  let leftMinimum = Infinity;
  let leftMaximum = -Infinity;
  let rightMinimum = Infinity;
  let rightMaximum = -Infinity;
  let minimumMeshMargin = Infinity;

  assert.equal(geometry.pinionTeeth, 16);
  assert.equal(geometry.rackToothCount, 13);
  near(geometry.rackPitch,
    geometry.pinionPitchRadius * geometry.pinionAngularPitch, 0,
  'shared pinion-rack circular pitch');
  for (let index = 0; index <= 8192; index += 1) {
    const state = stateAtCyclePhase(index / 8192);
    near(state.leftNoSlipError, 0, 0,
      `left rack no-slip error at ${index}`);
    near(state.rightNoSlipError, 0, 0,
      `right rack no-slip error at ${index}`);
    near(state.leftRackSpeed, -state.rightRackSpeed, 0,
      `opposed rack speeds at ${index}`);
    near(state.leftRackAcceleration.y,
      -state.rightRackAcceleration.y, 0,
    `opposed rack accelerations at ${index}`);
    near(state.rackCenterMean, 0, 0,
      `constant rack midpoint at ${index}`);
    near((state.leftRackY - geometry.sourceLeftRackY)
      / geometry.rackPitch,
    -state.gearAngle / geometry.pinionAngularPitch, 2e-15,
    `left tooth phase at ${index}`);
    near((state.rightRackY - geometry.sourceRightRackY)
      / geometry.rackPitch,
    state.gearAngle / geometry.pinionAngularPitch, 2e-15,
    `right tooth phase at ${index}`);
    leftMinimum = Math.min(leftMinimum, state.leftRackY);
    leftMaximum = Math.max(leftMaximum, state.leftRackY);
    rightMinimum = Math.min(rightMinimum, state.rightRackY);
    rightMaximum = Math.max(rightMaximum, state.rightRackY);
    minimumMeshMargin = Math.min(
      minimumMeshMargin,
      geometry.rackLength / 2 - Math.abs(state.leftRackY),
      geometry.rackLength / 2 - Math.abs(state.rightRackY),
    );
  }
  near(leftMaximum - leftMinimum, transmission.rackStroke, 0,
    'left rack stroke');
  near(rightMaximum - rightMinimum, transmission.rackStroke, 0,
    'right rack stroke');
  near(transmission.rackStroke / geometry.rackPitch, 8, 1e-15,
    'eight tooth pitches per half-turn');
  assert.ok(minimumMeshMargin > 2.4 * geometry.rackPitch,
    `rack mesh coverage margin ${minimumMeshMargin}`);
  assert.match(transmission.leftRackNoSlipLaw, /left-rack-speed = -/);
  assert.match(transmission.rightRackNoSlipLaw, /right-rack-speed =/);
  disposeModel(model.root);
});

test('movement 283 keeps the opposed pistons inside their pump barrels', () => {
  const model = createMovementModel(catalog.movements[282]);
  const {
    geometry,
    stateAtCyclePhase,
  } = model.root.userData;
  let minimumBarrelClearance = Infinity;
  let leftMinimum = Infinity;
  let leftMaximum = -Infinity;
  let rightMinimum = Infinity;
  let rightMaximum = -Infinity;
  let pistonCenterSum;

  for (let index = 0; index <= 8192; index += 1) {
    const state = stateAtCyclePhase(index / 8192);
    if (pistonCenterSum === undefined) {
      pistonCenterSum = state.leftPistonY + state.rightPistonY;
    }
    near(state.leftPistonY + state.rightPistonY, pistonCenterSum, 0,
      `opposed piston center sum at ${index}`);
    minimumBarrelClearance = Math.min(
      minimumBarrelClearance,
      state.leftPistonY - geometry.pumpCylinderBottom,
      geometry.pumpCylinderTop - state.leftPistonY,
      state.rightPistonY - geometry.pumpCylinderBottom,
      geometry.pumpCylinderTop - state.rightPistonY,
    );
    leftMinimum = Math.min(leftMinimum, state.leftPistonY);
    leftMaximum = Math.max(leftMaximum, state.leftPistonY);
    rightMinimum = Math.min(rightMinimum, state.rightPistonY);
    rightMaximum = Math.max(rightMaximum, state.rightPistonY);
  }
  near(minimumBarrelClearance, 0.18, 3e-16,
    'piston end clearance');
  near(leftMaximum - leftMinimum, geometry.rackStroke, 5e-16,
    'left piston stroke');
  near(rightMaximum - rightMinimum, geometry.rackStroke, 5e-16,
    'right piston stroke');
  const source = stateAtCyclePhase(0);
  const exchanged = stateAtCyclePhase(0.4);
  near(source.leftPistonY, exchanged.rightPistonY, 0,
    'lower piston exchange');
  near(source.rightPistonY, exchanged.leftPistonY, 0,
    'upper piston exchange');
  disposeModel(model.root);
});

test('movement 283 analytic pinion, rack, handle, and piston rates agree', () => {
  const model = createMovementModel(catalog.movements[282]);
  const { stateAtTime } = model.root.userData;
  const step = 3e-4;

  for (const time of [0.11, 0.29, 0.53, 0.77, 1.03, 1.31, 1.53,
    2.11, 2.37, 2.73, 3.07, 3.43]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    const scalarVelocity = (key) => (after[key] - before[key])
      / (2 * step);
    const scalarAcceleration = (key) => (
      after[key] - 2 * state[key] + before[key]
    ) / step ** 2;
    const vectorVelocity = (key) => after[key].clone().sub(before[key])
      .multiplyScalar(1 / (2 * step));
    const vectorAcceleration = (key) => after[key].clone().add(before[key])
      .addScaledVector(state[key], -2)
      .multiplyScalar(1 / step ** 2);

    near(scalarVelocity('gearAngle'), state.gearAngularSpeed, 7e-7,
      `pinion speed at ${time}`);
    near(scalarAcceleration('gearAngle'),
      state.gearAngularAcceleration, 3e-6,
    `pinion acceleration at ${time}`);
    near(scalarVelocity('leftRackY'), state.leftRackSpeed, 7e-7,
      `left rack speed at ${time}`);
    near(scalarAcceleration('leftRackY'),
      state.leftRackAcceleration.y, 3e-6,
    `left rack acceleration at ${time}`);
    near(scalarVelocity('rightRackY'), state.rightRackSpeed, 7e-7,
      `right rack speed at ${time}`);
    near(scalarAcceleration('rightRackY'),
      state.rightRackAcceleration.y, 3e-6,
    `right rack acceleration at ${time}`);
    vectorNear(vectorVelocity('handleGrip'), state.handleGripVelocity,
      5e-6, `handle-grip velocity at ${time}`);
    vectorNear(vectorAcceleration('handleGrip'),
      state.handleGripAcceleration, 2.5e-5,
    `handle-grip acceleration at ${time}`);
    near(scalarVelocity('leftPistonY'), state.leftRackSpeed, 7e-7,
      `left piston speed at ${time}`);
    near(scalarVelocity('rightPistonY'), state.rightRackSpeed, 7e-7,
      `right piston speed at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 283 renderer binds the one rotor and both rack-piston trains', () => {
  const model = createMovementModel(catalog.movements[282]);
  const {
    animationTiming,
    blocks,
    stateAtTime,
  } = model.root.userData;
  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(model.root.userData.cameraDistanceScale, 1.02);
  for (const index of [blocks.leftRackIndex, blocks.rightRackIndex,
    blocks.handleGripCap]) {
    assert.equal(index.parent, null, 'undrawn white index removed');
  }

  for (const time of [0, 0.34, 0.79, 1.29, 1.72, 2.18, 2.64, 3.13,
    3.58, 4]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.pinionRotor.rotation.z, expected.gearAngle, 0,
      `rendered pinion angle at ${time}`);
    near(blocks.leftRack.position.y, expected.leftRackY, 0,
      `rendered left rack at ${time}`);
    near(blocks.rightRack.position.y, expected.rightRackY, 0,
      `rendered right rack at ${time}`);
    near(blocks.pinion.userData.angularSpeed,
      expected.gearAngularSpeed, 0,
    `rendered pinion speed at ${time}`);
    vectorNear(blocks.leftRack.userData.velocity,
      expected.leftRackVelocity, 0,
    `rendered left-rack velocity at ${time}`);
    vectorNear(blocks.rightRack.userData.velocity,
      expected.rightRackVelocity, 0,
    `rendered right-rack velocity at ${time}`);
    model.root.updateMatrixWorld(true);
    const renderedHandleGrip = model.root.worldToLocal(
      blocks.handleGrip.getWorldPosition(new THREE.Vector3()),
    );
    near(renderedHandleGrip.x, expected.handleGrip.x, 6e-16,
      `rendered handle x at ${time}`);
    near(renderedHandleGrip.y, expected.handleGrip.y, 6e-16,
      `rendered handle y at ${time}`);
    const renderedLeftPiston = model.root.worldToLocal(
      blocks.leftPiston.getWorldPosition(new THREE.Vector3()),
    );
    const renderedRightPiston = model.root.worldToLocal(
      blocks.rightPiston.getWorldPosition(new THREE.Vector3()),
    );
    near(renderedLeftPiston.y, expected.leftPistonY, 5e-16,
      `rendered left piston at ${time}`);
    near(renderedRightPiston.y, expected.rightPistonY, 5e-16,
      `rendered right piston at ${time}`);
    near(model.root.userData.contacts.leftRackPinion.noSlipError,
      expected.leftNoSlipError, 0,
    `rendered left mesh at ${time}`);
    near(model.root.userData.contacts.rightRackPinion.noSlipError,
      expected.rightNoSlipError, 0,
    `rendered right mesh at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 283 closes after one vibration while movement 339 stays draft', () => {
  const model = createMovementModel(catalog.movements[282]);
  const {
    blocks,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.cyclePeriod);

  assert.equal(closure.cycleIndex, 1);
  assert.equal(closure.cyclePhase, 0);
  assert.equal(closure.stage, start.stage);
  near(closure.gearAngle, start.gearAngle, 0, 'pinion closure');
  near(closure.gearAngularSpeed, start.gearAngularSpeed, 0,
    'pinion-speed closure');
  near(closure.leftRackY, start.leftRackY, 0, 'left-rack closure');
  near(closure.rightRackY, start.rightRackY, 0, 'right-rack closure');
  near(closure.leftPistonY, start.leftPistonY, 0,
    'left-piston closure');
  near(closure.rightPistonY, start.rightPistonY, 0,
    'right-piston closure');
  vectorNear(closure.handleGrip, start.handleGrip, 0,
    'handle closure');

  model.update(0);
  const startPinion = blocks.pinionRotor.quaternion.clone();
  const startLeftRack = blocks.leftRack.position.clone();
  const startRightRack = blocks.rightRack.position.clone();
  model.update(timeline.cyclePeriod);
  near(blocks.pinionRotor.quaternion.angleTo(startPinion), 0, 0,
    'rendered pinion closure');
  vectorNear(blocks.leftRack.position, startLeftRack, 0,
    'rendered left-rack closure');
  vectorNear(blocks.rightRack.position, startRightRack, 0,
    'rendered right-rack closure');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});

test('movement 283 (pass 92): the knob is the shared turned handle centred in a round bar-end eye', () => {
  const model = createMovementModel(catalog.movements[282]);
  try {
    const { handleEye, handleGrip } = model.root.userData.blocks;
    assert.equal(handleGrip.geometry.type, 'LatheGeometry', 'turned (lathed) knob');
    assert.equal(handleEye.parent, handleGrip.parent);
    near(handleGrip.position.x, handleEye.position.x, 1e-12, 'knob axis x on the eye');
    near(handleGrip.position.y, handleEye.position.y, 1e-12, 'knob axis y on the eye');
    const p = handleGrip.geometry.attributes.position;
    let footRadius = 0;
    for (let i = 0; i < p.count; i += 1) {
      if (Math.abs(p.getZ(i)) < 1e-9) footRadius = Math.max(footRadius, Math.hypot(p.getX(i), p.getY(i)));
    }
    const eyeRadius = handleEye.geometry.parameters.radiusTop;
    assert.ok(eyeRadius > 1.4 * footRadius, `eye ${eyeRadius} leaves a margin round the ${footRadius} foot`);
    const eyeFront = handleEye.position.z + handleEye.geometry.parameters.height / 2;
    assert.ok(handleGrip.position.z < eyeFront && handleGrip.position.z > eyeFront - 0.02, 'foot sunk into the eye face');
  } finally {
    disposeModel(model.root);
  }
});

test('movement 283 (pass 92): each rack bar is one extrusion whose top is a semicircle enclosing every corner', () => {
  const model = createMovementModel(catalog.movements[282]);
  try {
    const { leftRackBody, rightRackBody } = model.root.userData.blocks;
    for (const body of [leftRackBody, rightRackBody]) {
      assert.notEqual(body.geometry.type, 'BoxGeometry', 'no box bar');
      const { center: [cx, cy], radius } = body.userData.roundTop;
      assert.equal(body.parent.children.filter((child) => /rounded-upper-end/.test(child.userData.role ?? '')).length, 0,
        'no separate end cap');
      const p = body.geometry.attributes.position;
      let top = -Infinity;
      for (let i = 0; i < p.count; i += 1) {
        const x = p.getX(i), y = p.getY(i);
        top = Math.max(top, y);
        if (y > cy + 1e-6) {
          near(Math.hypot(x - cx, y - cy), radius, 1e-6, 'every vertex above the top centre lies on the end arc');
        } else {
          assert.ok(Math.abs(x - cx) <= radius + 1e-6, 'the bar is no wider than the end arc');
        }
      }
      near(top, cy + radius, 1e-6, 'the arc closes the bar');
    }
  } finally {
    disposeModel(model.root);
  }
});
