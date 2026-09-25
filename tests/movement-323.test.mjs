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

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function planarNear(actual, expected, tolerance, message) {
  near(Math.hypot(actual.x - expected.x, actual.z - expected.z),
    0, tolerance, message);
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

test('movement 323 is one rolling parallel ruler with a common axle and two nicked wheels', () => {
  const movement = catalog.movements[322];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 323);
  assert.equal(movement.number, '323');
  assert.match(movement.title, /^Parallel ruler/);
  assert.equal(movement.category, 'Miscellaneous mechanisms');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'common-axle-nicked-wheel-rolling-parallel-ruler');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /straight ruler B/);
  assert.match(mechanism, /axle C/);
  assert.match(mechanism, /two equal nicked wheels A, A/);
  assert.match(mechanism, /roll without slip/);
  assert.match(mechanism, /zero yaw/);
  assert.match(transmission.contactEquation,
    /v_contact = v_ruler - omega_C r_A = 0/);
  assert.match(transmission.input, /normal to its long edge/);
  assert.match(transmission.output, /both wheels A and common axle C/);

  assert.equal(blocks.carrier.parent, model.root);
  assert.equal(blocks.rulerB.parent, blocks.carrier);
  assert.equal(blocks.rollingAssembly.parent, blocks.carrier);
  assert.equal(blocks.axleC.parent, blocks.rollingAssembly);
  assert.equal(blocks.wheelALeft.parent, blocks.rollingAssembly);
  assert.equal(blocks.wheelARight.parent, blocks.rollingAssembly);
  assert.equal(blocks.bearingHousings.length, 2);
  for (const housing of blocks.bearingHousings) {
    assert.equal(housing.parent, blocks.carrier);
  }
  assert.equal(blocks.wheelALeft.userData.nickCount, 16);
  assert.equal(blocks.wheelARight.userData.nickCount, 16);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'straight-ruler-B').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'common-rotating-axle-C').length, 1);
  assert.equal(roles.filter((role) =>
    role.endsWith('equal-nicked-wheel-A')).length, 2);
  assert.equal(roles.filter((role) =>
    role.endsWith('paper-gripping-edge-nick')).length, 30);
  // Brown draws no white nick or face rotation indices.
  assert.equal(roles.filter((role) =>
    role.endsWith('white-rolling-index-nick')).length, 0);
  assert.equal(roles.filter((role) =>
    role.endsWith('white-face-rotation-index')).length, 0);
  assert.equal(roles.filter((role) =>
    role === 'fixed-axle-C-journal-bearing-on-ruler-B').length, 4);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 323 preserves Brown’s B, C, A, A plan and unavailable animation status', () => {
  const movement = catalog.movements[322];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToReferenceTop,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.brownPlate323;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /straight ruler B/);
  assert.match(sourceAnimation.referenceScope, /longitudinal axle C/);
  assert.match(sourceAnimation.referenceScope, /two equal wheels A, A/);
  assert.match(sourceAnimation.referenceScope, /visible edge nicks/);
  assert.match(sourceAnimation.referenceScope, /timing/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_323.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 6);
  assert.deepEqual(plate.rasterRectangle.bottomLeft,
    new THREE.Vector2(8, 326));
  assert.deepEqual(plate.rasterRectangle.topRight,
    new THREE.Vector2(517, 169));
  assert.deepEqual(plate.rasterWheelLeft, new THREE.Vector2(72, 249));
  assert.deepEqual(plate.rasterWheelRight, new THREE.Vector2(453, 249));
  assert.deepEqual(plate.rasterAxleMarkC, new THREE.Vector2(242, 249));
  assert.equal(plate.rasterWheelRadius, 33.75);
  assert.equal(plate.rasterWheelWidth, 26);
  assert.match(plate.inferredTopology, /common longitudinal axle C/);
  assert.match(plate.inferredTopology, /nicked wheels A, A/);

  vectorNear(sourcePointToReferenceTop(plate.rasterRectangle.bottomLeft),
    new THREE.Vector3(-4, geometry.rulerTopY, -1.225), 1e-15,
    'source ruler bottom-left');
  vectorNear(sourcePointToReferenceTop(plate.rasterRectangle.topRight),
    new THREE.Vector3(4, geometry.rulerTopY, 1.225), 1e-15,
    'source ruler top-right');
  const reference = stateAtTime(0);
  const tolerance = plate.measurementUncertaintyPixels
    * Math.max(geometry.sourceScaleX, geometry.sourceScaleZ);
  planarNear(sourcePointToReferenceTop(plate.rasterWheelLeft),
    reference.leftWheel.center, tolerance, 'source left wheel station');
  planarNear(sourcePointToReferenceTop(plate.rasterWheelRight),
    reference.rightWheel.center, tolerance, 'source right wheel station');
  near(geometry.wheelRadius,
    plate.rasterWheelRadius * geometry.sourceScaleZ, 0,
    'source wheel radius');
  near(geometry.wheelWidth,
    plate.rasterWheelWidth * geometry.sourceScaleX, 0,
    'source wheel axial width');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 323 fixes both equal wheels and axle C into one rigid rotor', () => {
  const model = createMovementModel(catalog.movements[322]);
  const { blocks, geometry } = model.root.userData;

  assert.deepEqual(blocks.rollingAssembly.userData.axis,
    new THREE.Vector3(1, 0, 0));
  assert.deepEqual(blocks.axleC.userData.axis,
    new THREE.Vector3(1, 0, 0));
  assert.deepEqual(blocks.wheelALeft.userData.axis,
    new THREE.Vector3(1, 0, 0));
  assert.deepEqual(blocks.wheelARight.userData.axis,
    new THREE.Vector3(1, 0, 0));
  near(blocks.wheelALeft.position.x, geometry.wheelLeftStation, 0,
    'left wheel station');
  near(blocks.wheelARight.position.x, geometry.wheelRightStation, 0,
    'right wheel station');
  near(blocks.wheelALeft.position.y, 0, 0, 'left wheel is coaxial');
  near(blocks.wheelARight.position.y, 0, 0, 'right wheel is coaxial');
  near(blocks.wheelALeft.position.z, 0, 0, 'left wheel axial line');
  near(blocks.wheelARight.position.z, 0, 0, 'right wheel axial line');
  near(blocks.wheelALeft.userData.pitchRadius, geometry.wheelRadius, 0,
    'left wheel pitch radius');
  near(blocks.wheelARight.userData.pitchRadius, geometry.wheelRadius, 0,
    'right wheel pitch radius');
  assert.equal(blocks.wheelALeft.userData.width, geometry.wheelWidth);
  assert.equal(blocks.wheelARight.userData.width, geometry.wheelWidth);
  near(blocks.rollingAssembly.position.y, geometry.wheelCenterY, 0,
    'common axle height');
  near(geometry.wheelCenterY - geometry.wheelRadius,
    geometry.paperTopY, 0, 'wheel tread touches paper');
  assert.ok(geometry.paperTopY < -geometry.rulerDepth / 2,
    'wheel edges protrude slightly beneath the ruler underside');
  assert.ok(-geometry.rulerDepth / 2 - geometry.paperTopY < 0.10,
    'protrusion beneath B remains slight');
  disposeModel(model.root);
});

test('movement 323 enforces zero slip at both separated paper contacts', () => {
  const model = createMovementModel(catalog.movements[322]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 2048; sample += 1) {
    const state = stateAtTime(
      geometry.cyclePeriod * sample / 2048,
    );
    near(state.wheelAngle, state.travel / geometry.wheelRadius, 2e-15,
      `rolling displacement law at ${sample}`);
    near(state.wheelAngularVelocity,
      state.travelRate / geometry.wheelRadius, 2e-15,
    `rolling speed law at ${sample}`);
    near(state.wheelAngularAcceleration,
      state.travelAcceleration / geometry.wheelRadius, 2e-15,
    `rolling acceleration law at ${sample}`);
    near(state.leftWheel.angle, state.rightWheel.angle, 0,
      `common axle angle at ${sample}`);
    vectorNear(state.leftWheel.angularVelocity,
      state.rightWheel.angularVelocity, 0,
    `common axle angular velocity at ${sample}`);
    near(state.leftWheel.contact.clearance, 0, 0,
      `left contact closure at ${sample}`);
    near(state.rightWheel.contact.clearance, 0, 0,
      `right contact closure at ${sample}`);
    vectorNear(state.leftWheel.contact.slipVelocity,
      new THREE.Vector3(), 5e-16, `left no-slip contact at ${sample}`);
    vectorNear(state.rightWheel.contact.slipVelocity,
      new THREE.Vector3(), 5e-16, `right no-slip contact at ${sample}`);
    near(state.leftWheel.contact.point.y, geometry.paperTopY, 0,
      `left point stays on paper at ${sample}`);
    near(state.rightWheel.contact.point.y, geometry.paperTopY, 0,
      `right point stays on paper at ${sample}`);
    near(state.rightWheel.contact.point.x
      - state.leftWheel.contact.point.x,
    geometry.wheelRightStation - geometry.wheelLeftStation, 0,
    `contact baseline remains rigid at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 323 translates B normal to its edge with exactly zero yaw', () => {
  const model = createMovementModel(catalog.movements[322]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 1024; sample += 1) {
    const state = stateAtTime(
      geometry.cyclePeriod * sample / 1024,
    );
    vectorNear(state.carrierTranslation,
      new THREE.Vector3(0, 0, state.travel), 0,
    `pure transverse translation at ${sample}`);
    vectorNear(state.carrierVelocity,
      new THREE.Vector3(0, 0, state.travelRate), 0,
    `pure transverse velocity at ${sample}`);
    near(state.workingEdge.yaw, 0, 0, `zero yaw at ${sample}`);
    near(state.workingEdge.parallelCrossResidual, 0, 0,
      `parallel edge residual at ${sample}`);
    vectorNear(state.workingEdge.direction,
      new THREE.Vector3(geometry.rulerLength, 0, 0), 0,
    `unchanged ruler direction at ${sample}`);
    near(state.workingEdge.start.z,
      -geometry.rulerWidth / 2 + state.travel, 0,
    `working-edge offset at ${sample}`);
    near(state.workingEdge.end.z, state.workingEdge.start.z, 0,
      `straight working edge at ${sample}`);
    near(state.leftWheel.center.z, state.travel, 0,
      `left wheel carried by B at ${sample}`);
    near(state.rightWheel.center.z, state.travel, 0,
      `right wheel carried by B at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 323 has smooth harmonic forward and return strokes with exact analytic rates', () => {
  const model = createMovementModel(catalog.movements[322]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  const period = geometry.cyclePeriod;
  const lower = stateAtTime(0);
  const forwardFast = stateAtTime(period / 4);
  const upper = stateAtTime(period / 2);
  const returnFast = stateAtTime(3 * period / 4);
  const closure = stateAtTime(period);

  assert.equal(lower.mode, 'lower-line-turnaround');
  assert.equal(forwardFast.mode, 'rolling-forward-normal-to-ruler');
  assert.equal(upper.mode, 'upper-line-turnaround');
  assert.equal(returnFast.mode, 'rolling-backward-normal-to-ruler');
  near(lower.travel, 0, 0, 'lower turnaround travel');
  near(upper.travel, geometry.stroke, 0, 'full transverse stroke');
  near(closure.travel, 0, 0, 'stroke closure');
  near(lower.travelRate, 0, 0, 'lower turnaround velocity');
  near(upper.travelRate, 0, 0, 'upper turnaround velocity');
  near(closure.travelRate, 0, 0, 'closure velocity');
  near(forwardFast.travelRate, -returnFast.travelRate, 3e-16,
    'symmetric maximum rolling speeds');
  near(forwardFast.travel, returnFast.travel, 5e-16,
    'symmetric mid-stroke positions');
  near(upper.wheelAngle, geometry.stroke / geometry.wheelRadius, 0,
    'wheel angle follows full stroke');

  const step = 1e-5;
  for (const time of [0.4, 1.1, 2.1, 3.7, 4.8, 5.5]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    near((after.travel - before.travel) / (2 * step),
      state.travelRate, 8e-11, `finite-difference travel rate at ${time}`);
    near((after.travelRate - before.travelRate) / (2 * step),
      state.travelAcceleration, 9e-11,
    `finite-difference travel acceleration at ${time}`);
  }
  assert.equal(timeline.schedule.length, 5);
  assert.deepEqual(timeline.schedule.map(({ phase }) => phase),
    [0, 0.25, 0.5, 0.75, 1]);
  disposeModel(model.root);
});

test('movement 323 renderer binds B and both indexed wheels to the solved common-axle state', () => {
  const model = createMovementModel(catalog.movements[322]);
  const {
    animationTiming,
    blocks,
    geometry,
    stateAtTime,
  } = model.root.userData;

  assert.equal(animationTiming.authoredCyclePeriod, geometry.cyclePeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(blocks.rulerB.userData.solidDepth, geometry.rulerDepth);
  assert.equal(blocks.rulerB.userData.body.userData.isRigidBody, true);
  assert.equal(blocks.rulerB.userData.slotCenters.length, 2);
  assert.equal(blocks.guideLines.length, 3);
  assert.ok(model.cameraDirection.y > 0,
    'camera reveals wheels protruding above and below B');

  for (const time of [0, 0.6, 1.5, 2.4, 3, 3.8, 4.5, 5.4, 6]) {
    const state = stateAtTime(time);
    model.update(time);
    vectorNear(blocks.carrier.position, state.carrierTranslation, 0,
      `rendered carrier at ${time}`);
    near(blocks.rollingAssembly.rotation.x, state.wheelAngle, 0,
      `rendered common axle angle at ${time}`);
    near(blocks.rollingAssembly.rotation.y, 0, 0,
      `no rendered pitch at ${time}`);
    near(blocks.rollingAssembly.rotation.z, 0, 0,
      `no rendered yaw at ${time}`);
    vectorNear(blocks.carrier.userData.velocity,
      state.carrierVelocity, 0, `rendered velocity at ${time}`);
    assert.equal(model.root.userData.contacts.leftWheelToPaper.active,
      true);
    assert.equal(model.root.userData.contacts.rightWheelToPaper.active,
      true);
    vectorNear(model.root.userData.contacts.leftWheelToPaper.slipVelocity,
      new THREE.Vector3(), 0, `rendered left no-slip state at ${time}`);
    vectorNear(model.root.userData.contacts.rightWheelToPaper.slipVelocity,
      new THREE.Vector3(), 0, `rendered right no-slip state at ${time}`);
    model.root.traverse((object) => {
      for (const value of object.position.toArray()) {
        assert.ok(Number.isFinite(value), `finite position at ${time}`);
      }
      for (const value of object.quaternion.toArray()) {
        assert.ok(Number.isFinite(value), `finite quaternion at ${time}`);
      }
    });
  }
  disposeModel(model.root);
});

test('movement 323 closes exactly after one harmonic roll and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[322]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(geometry.cyclePeriod);

  near(closure.phase, start.phase, 0, 'phase closure');
  near(closure.cycleAngle, start.cycleAngle, 0, 'cycle-angle closure');
  near(closure.travel, start.travel, 0, 'translation closure');
  near(closure.travelRate, start.travelRate, 0, 'velocity closure');
  near(closure.travelAcceleration, start.travelAcceleration, 0,
    'acceleration closure');
  near(closure.wheelAngle, start.wheelAngle, 0, 'wheel-angle closure');
  near(closure.wheelAngularVelocity, start.wheelAngularVelocity, 0,
    'wheel-speed closure');
  vectorNear(closure.leftWheel.contact.point,
    start.leftWheel.contact.point, 0, 'left contact closure');
  vectorNear(closure.rightWheel.contact.point,
    start.rightWheel.contact.point, 0, 'right contact closure');
  model.update(geometry.cyclePeriod);
  vectorNear(blocks.carrier.position, new THREE.Vector3(), 0,
    'rendered carriage closure');
  near(blocks.rollingAssembly.rotation.x, 0, 0,
    'rendered axle closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
