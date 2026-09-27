import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const HALF_PI = Math.PI / 2;

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function nearVector(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
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

function rotate2(vector, angle) {
  return vector.clone().rotateAround(new THREE.Vector2(0, 0), angle);
}

function assertUnorderedPair(actual, expected, tolerance, message) {
  const direct = actual[0].distanceTo(expected[0]) <= tolerance
    && actual[1].distanceTo(expected[1]) <= tolerance;
  const reversed = actual[0].distanceTo(expected[1]) <= tolerance
    && actual[1].distanceTo(expected[0]) <= tolerance;
  assert.ok(direct || reversed, message);
}

test('movement 395 is one four-port body and one quarter-turn plug carrying exactly two rigid passages', () => {
  const movement = catalog.movements[394];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 395);
  assert.equal(movement.number, '395');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(
    movement.archetype,
    'quarter-turn-two-passage-four-way-steam-cock-alternating-admission-and-exhaust',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-quarter-turn-cylindrical-plug/);
  assert.match(data.mechanism, /two-opposed-quarter-circular-passages/);
  assert.match(data.mechanism, /top-steam-supply/);
  assert.match(data.mechanism, /bottom-exhaust/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.inputs[0], /quarter-turn angle/);
  assert.equal(blocks.fixedBody.parent, model.root);
  assert.equal(blocks.plugRotor.parent, model.root);
  assert.equal(blocks.channels.channelA.parent, blocks.plugRotor);
  assert.equal(blocks.channels.channelB.parent, blocks.plugRotor);
  assert.equal(Object.keys(blocks.pipes).length, 4);
  // Brown draws the plug sections only: no pipes, handle, stem, travel arc or
  // flow markers. The presentation detaches them and adds his second figure.
  for (const undrawn of [...Object.values(blocks.pipes), blocks.handle,
    blocks.handleIndex, blocks.stem, blocks.fixedQuadrant, blocks.externalFlow]) {
    assert.equal(undrawn.parent, null);
  }
  // One model animated through both positions; no second plate figure.
  assert.equal(blocks.secondFigure, undefined);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'fixed-four-port-body-with-top-supply-bottom-exhaust-and-two-cylinder-ports',
    'fixed-annular-four-port-cock-body-surrounding-turning-plug',
    'single-quarter-turn-plug-carrying-two-rigid-disjoint-passages',
    'close-fitting-rotary-cock-plug',
    'passage-A-rigid-quarter-circular-plug-passage',
    'passage-B-rigid-quarter-circular-plug-passage',
  ]) assert.ok(roles.includes(role), role);
  assert.ok(!roles.some((role) => role.startsWith('second-plate-figure')));
  disposeModel(model.root);
});

test('movement 395 preserves Brown routing evidence and discloses the unavailable animation and transient overlap', () => {
  const movement = catalog.movements[394];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate395;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_395.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Four-way cock/);
  assert.match(movement.description, /quarter turn of the plug/);
  assert.match(movement.description, /steam to enter at the top/);
  assert.match(movement.description, /exhaust is from the right end/);
  assert.match(movement.description, /exhaust is from the left/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /two static plug positions/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.ok(dynamics.idealizations.some((item) => /partial overlap/.test(item)));
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.upperPlugApproximateCenterPixels, [360, 173]);
  assert.deepEqual(plate.lowerPlugApproximateCenterPixels, [167, 356]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence, /four orthogonal ports/);
  assert.match(evidence.reconstructionDisclosure, /No official animation/);
  assert.match(evidence.reconstructionDisclosure, /transient overlap/);
  disposeModel(model.root);
});

test('movement 395 constructs two diametrically opposed passages and two indexed angles exactly one quarter-turn apart', () => {
  const model = createMovementModel(catalog.movements[394]);
  const data = model.root.userData;
  const { constraintResiduals, geometry } = data;
  for (const [name, residual] of Object.entries(constraintResiduals)) {
    near(residual, 0, 8e-17, name);
  }
  near(
    geometry.lowerPositionAngle - geometry.upperPositionAngle,
    -HALF_PI,
    0,
    'clockwise indexed quarter-turn',
  );
  near(geometry.channelAStart.length(), geometry.passageEndpointRadius, 0,
    'passage A start radius');
  near(geometry.channelAEnd.length(), geometry.passageEndpointRadius, 0,
    'passage A end radius');
  nearVector(geometry.channelBStart,
    geometry.channelAStart.clone().multiplyScalar(-1), 0,
    'passage B starts opposite passage A');
  nearVector(geometry.channelBEnd,
    geometry.channelAEnd.clone().multiplyScalar(-1), 0,
    'passage B ends opposite passage A');
  assert.ok(geometry.bodyInnerRadius > geometry.plugRadius);
  disposeModel(model.root);
});

test('movement 395 upper position admits top steam leftward and exhausts the right cylinder end downward', () => {
  const model = createMovementModel(catalog.movements[394]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;
  const state = stateAtTime(0);

  assert.equal(state.alignedPosition, 'upper-engraving-position');
  assert.equal(state.upperPositionActive, true);
  assert.equal(state.lowerPositionActive, false);
  assert.deepEqual(state.connections, transmission.upperConnectionMap);
  assert.deepEqual(state.connections, [
    ['top-steam-supply', 'left-cylinder-end'],
    ['right-cylinder-end', 'bottom-exhaust'],
  ]);
  assert.equal(state.channelAFlowDirection, 1);
  assert.equal(state.channelBFlowDirection, -1);
  assertUnorderedPair(state.channelAEndpoints, [
    geometry.portCenters.topSupply,
    geometry.portCenters.leftCylinder,
  ], 0, 'upper passage A must join top and left');
  assertUnorderedPair(state.channelBEndpoints, [
    geometry.portCenters.rightCylinder,
    geometry.portCenters.bottomExhaust,
  ], 0, 'upper passage B must join right and bottom');
  disposeModel(model.root);
});

test('movement 395 lower position is the same rigid plug turned clockwise 90 degrees and reverses admission and exhaust ends', () => {
  const model = createMovementModel(catalog.movements[394]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;
  const state = stateAtTime(timeline.cycleDuration * 0.60);

  assert.equal(state.alignedPosition, 'lower-engraving-position');
  assert.equal(state.upperPositionActive, false);
  assert.equal(state.lowerPositionActive, true);
  near(state.plugAngle, -HALF_PI, 0, 'lower plug angle');
  assert.deepEqual(state.connections, transmission.lowerConnectionMap);
  assert.deepEqual(state.connections, [
    ['top-steam-supply', 'right-cylinder-end'],
    ['left-cylinder-end', 'bottom-exhaust'],
  ]);
  assert.equal(state.channelAFlowDirection, -1);
  assert.equal(state.channelBFlowDirection, 1);
  assertUnorderedPair(state.channelAEndpoints, [
    geometry.portCenters.topSupply,
    geometry.portCenters.rightCylinder,
  ], 2e-16, 'lower passage A must join top and right');
  assertUnorderedPair(state.channelBEndpoints, [
    geometry.portCenters.leftCylinder,
    geometry.portCenters.bottomExhaust,
  ], 2e-16, 'lower passage B must join left and bottom');
  disposeModel(model.root);
});

test('movement 395 rotates every passage endpoint as one rigid plug and never invents an intermediate connection', () => {
  const model = createMovementModel(catalog.movements[394]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;

  for (let sample = -12000; sample <= 24000; sample += 1) {
    const state = stateAtTime(
      timeline.cycleDuration * sample / 12000,
    );
    assert.ok(state.plugAngle >= -HALF_PI - 2e-15);
    assert.ok(state.plugAngle <= 2e-15);
    nearVector(state.channelAEndpoints[0],
      rotate2(geometry.channelAStart, state.plugAngle), 0,
      'rigid passage A start');
    nearVector(state.channelAEndpoints[1],
      rotate2(geometry.channelAEnd, state.plugAngle), 0,
      'rigid passage A end');
    nearVector(state.channelBEndpoints[0],
      rotate2(geometry.channelBStart, state.plugAngle), 0,
      'rigid passage B start');
    nearVector(state.channelBEndpoints[1],
      rotate2(geometry.channelBEnd, state.plugAngle), 0,
      'rigid passage B end');
    if (state.blockedDuringTransfer) {
      assert.deepEqual(state.connections, []);
      assert.equal(state.channelAFlowDirection, 0);
      assert.equal(state.channelBFlowDirection, 0);
    } else {
      assert.equal(state.connections.length, 2);
      const flattened = state.connections.flat();
      assert.equal(flattened.filter((port) => port === 'top-steam-supply').length, 1);
      assert.equal(flattened.filter((port) => port === 'bottom-exhaust').length, 1);
      assert.ok(!state.connections.some((connection) =>
        connection.includes('top-steam-supply')
          && connection.includes('bottom-exhaust')));
    }
  }
  disposeModel(model.root);
});

test('movement 395 dwells at both indexed positions and transfers smoothly in the stated directions', () => {
  const model = createMovementModel(catalog.movements[394]);
  const { stateAtTime, timeline } = model.root.userData;
  const upperEnd = timeline.upperPositionDwell[1];
  const clockwiseEnd = timeline.clockwiseTransfer[1];
  const lowerEnd = timeline.lowerPositionDwell[1];

  for (const phase of [0, 0.1, 0.31]) {
    const state = stateAtTime(timeline.cycleDuration * phase);
    near(state.plugAngle, 0, 0, 'upper dwell angle');
    near(state.plugAngularSpeed, 0, 0, 'upper dwell speed');
  }
  for (const phase of [0.50, 0.62, 0.81]) {
    const state = stateAtTime(timeline.cycleDuration * phase);
    near(state.plugAngle, -HALF_PI, 0, 'lower dwell angle');
    near(state.plugAngularSpeed, 0, 0, 'lower dwell speed');
  }
  near(stateAtTime(timeline.cycleDuration * upperEnd).plugAngularSpeed,
    0, 1e-14, 'clockwise transfer starts at rest');
  near(stateAtTime(timeline.cycleDuration * clockwiseEnd).plugAngularSpeed,
    0, 1e-14, 'clockwise transfer ends at rest');
  near(stateAtTime(timeline.cycleDuration * lowerEnd).plugAngularSpeed,
    0, 1e-14, 'return transfer starts at rest');
  for (let sample = 1; sample < 999; sample += 1) {
    const clockwise = stateAtTime(timeline.cycleDuration * (
      upperEnd + (clockwiseEnd - upperEnd) * sample / 1000
    ));
    const returning = stateAtTime(timeline.cycleDuration * (
      lowerEnd + (1 - lowerEnd) * sample / 1000
    ));
    assert.ok(clockwise.plugAngularSpeed < 0);
    assert.ok(returning.plugAngularSpeed > 0);
  }
  for (const phase of [-2.173, -0.271, 0.127, 0.713, 2.349]) {
    const start = stateAtTime(timeline.cycleDuration * phase);
    const end = stateAtTime(timeline.cycleDuration * (phase + 1));
    near(end.plugAngle, start.plugAngle, 3e-15,
      'plug motion repeats each explanatory cycle');
    near(end.plugAngularSpeed, start.plugAngularSpeed, 2e-14,
      'plug speed repeats each explanatory cycle');
    assert.deepEqual(end.connections, start.connections);
  }
  disposeModel(model.root);
});

test('movement 395 update binds the rigid plug, routes, cutaway flow indices, and fixed body correctly', () => {
  const model = createMovementModel(catalog.movements[394]);
  const data = model.root.userData;
  const { blocks, stateAtTime, timeline } = data;
  const fixedBodyMatrix = blocks.fixedBody.matrix.clone();

  for (const phase of [0.10, 0.41, 0.64, 0.91]) {
    const time = timeline.cycleDuration * phase;
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.plugRotor.rotation.z, expected.plugAngle, 0,
      'rendered plug angle');
    assert.ok(blocks.fixedBody.matrix.equals(fixedBodyMatrix));
    assert.equal(data.contacts.channelA.active,
      expected.alignedPosition !== null);
    assert.equal(data.contacts.channelB.active,
      expected.alignedPosition !== null);
    assert.deepEqual(data.contacts.channelA.route,
      expected.connections[0] ?? null);
    assert.deepEqual(data.contacts.channelB.route,
      expected.connections[1] ?? null);
    assert.equal(
      blocks.channels.channelA.userData.markers.every(
        (marker) => marker.visible,
      ),
      expected.alignedPosition !== null,
    );
    assert.equal(
      blocks.channels.channelB.userData.markers.every(
        (marker) => marker.visible,
      ),
      expected.alignedPosition !== null,
    );
    near(data.contacts.plugToBody.coaxialityError, 0, 0,
      'plug/body coaxiality');
    assert.ok(data.contacts.plugToBody.radialClearance > 0);
  }
  disposeModel(model.root);
});

test('movement 395 factory is isolated before movement 507', () => {
  const model395 = createMovementModel(catalog.movements[394]);
  const model507 = createMovementModel(catalog.movements[506]);
  assert.equal(model395.root.userData.fidelity, 'authored');
  assert.equal(
    model395.root.userData.archetype,
    'quarter-turn-two-passage-four-way-steam-cock-alternating-admission-and-exhaust',
  );
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(catalog.movements[506].fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model395.root);
  disposeModel(model507.root);
});

test('movement 395 shows one plug turning through both of Brown\'s positions', () => {
  const model = createMovementModel(catalog.movements[394]);
  const { blocks } = model.root.userData;
  const angles = [];
  for (let i = 0; i < 64; i++) {
    model.update(8 * i / 64); // one 8 s cycle
    angles.push(blocks.plugRotor.rotation.z);
  }
  near(Math.max(...angles), 0, 1e-9, 'upper position reached');
  near(Math.min(...angles), -HALF_PI, 1e-9, 'lower position reached');
  const bounds = model.root.userData.cameraFitBounds;
  near(bounds.min.x, -bounds.max.x, 1e-12, 'framed on the single figure');
  disposeModel(model.root);
});
