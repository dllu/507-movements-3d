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

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function planarArea(vertices) {
  let doubledArea = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const point = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    doubledArea += point.x * next.z - next.x * point.z;
  }
  return Math.abs(doubledArea) / 2;
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

test('movement 322 is the source two-triangle diagonal-contact ruler', () => {
  const movement = catalog.movements[321];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 322);
  assert.equal(movement.number, '322');
  assert.match(movement.title, /parallel ruler/);
  assert.equal(movement.category, 'Miscellaneous mechanisms');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'sliding-triangle-diagonal-contact-parallel-ruler');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /quadrangle is cut once on its diagonal/);
  assert.match(mechanism, /equal opposite pure translations/);
  assert.match(mechanism, /working edges remain parallel/);
  assert.equal(transmission.relativeTravelRatio, -1);
  assert.match(transmission.input, /translation.*diagonal/);
  assert.match(transmission.output, /parallel translation/);

  assert.equal(blocks.pieceA.parent, model.root);
  assert.equal(blocks.pieceB.parent, model.root);
  assert.equal(blocks.paper.parent, model.root);
  assert.equal(blocks.pieceA.userData.body.parent, blocks.pieceA);
  assert.equal(blocks.pieceB.userData.body.parent, blocks.pieceB);
  assert.equal(blocks.seamA.parent, blocks.pieceA);
  assert.equal(blocks.seamB.parent, blocks.pieceB);
  assert.equal(blocks.workingEdgeA.parent, blocks.pieceA);
  assert.equal(blocks.workingEdgeB.parent, blocks.pieceB);
  assert.equal(blocks.pieceA.userData.holeRings.length, 2);
  assert.equal(blocks.pieceB.userData.holeRings.length, 2);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'upper-left-right-triangle-A').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'lower-right-right-triangle-B').length, 1);
  assert.equal(roles.filter((role) =>
    role.endsWith('-handling-hole-rim')).length, 4);
  assert.equal(roles.filter((role) =>
    role.startsWith('visible-contact-edge-on-hypotenuse-')).length, 2);
  assert.equal(roles.filter((role) =>
    role.startsWith('parallel-drawing-edge-of-triangle-')).length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 322 preserves Brown’s rectangle, holes A and B, and official animated states', () => {
  const movement = catalog.movements[321];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToReferenceFront,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.brownPlate322;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /5 by 3 quadrangle/);
  assert.match(sourceAnimation.referenceScope,
    /equal opposite one-sixth-diagonal translations/);
  assert.match(sourceAnimation.referenceScope,
    /C2-continuous easing to prevent endpoint jerk/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_322.html');
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.deepEqual(sourceAnimation.officialNormalizedGeometry, {
    height: 3,
    lowerBHole: new THREE.Vector2(4, 0.73),
    upperAHole: new THREE.Vector2(1, 2.27),
    width: 5,
  });
  assert.deepEqual(sourceAnimation.officialKeyframes.map((keyframe) =>
    keyframe.phase), [0, 0.4, 0.5, 0.9, 1]);
  assert.deepEqual(sourceAnimation.officialKeyframes[1].upperA,
    new THREE.Vector2(-0.833333, -0.5));
  assert.deepEqual(sourceAnimation.officialKeyframes[1].lowerB,
    new THREE.Vector2(0.833333, 0.5));

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 5);
  assert.deepEqual(plate.rasterRectangle.bottomLeft,
    new THREE.Vector2(42, 401));
  assert.deepEqual(plate.rasterRectangle.topRight,
    new THREE.Vector2(470, 115));
  assert.deepEqual(plate.rasterHoleA, new THREE.Vector2(145, 192));
  assert.deepEqual(plate.rasterHoleB, new THREE.Vector2(366, 332));
  assert.equal(plate.rasterHoleRadiusA, 25);
  assert.equal(plate.rasterHoleRadiusB, 26);
  assert.match(plate.inferredTopology, /upper-left triangle A/);
  assert.match(plate.inferredTopology, /lower-right triangle B/);

  const reference = stateAtTime(0);
  vectorNear(sourcePointToReferenceFront(plate.rasterRectangle.bottomLeft),
    new THREE.Vector3(-3, geometry.plateDepth / 2, -2), 0,
    'source bottom-left corner');
  vectorNear(sourcePointToReferenceFront(plate.rasterRectangle.topRight),
    new THREE.Vector3(3, geometry.plateDepth / 2, 2), 0,
    'source top-right corner');
  vectorNear(sourcePointToReferenceFront(plate.rasterHoleA),
    reference.pieceA.holeCenter, 0, 'source handling hole A');
  vectorNear(sourcePointToReferenceFront(plate.rasterHoleB),
    reference.pieceB.holeCenter, 0, 'source handling hole B');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 322 reassembles exactly into one quadrangle cut on its diagonal', () => {
  const model = createMovementModel(catalog.movements[321]);
  const { geometry, stateAtTime } = model.root.userData;
  const state = stateAtTime(0);
  const [aBottomLeft, aTopRight, aTopLeft] = state.pieceA.vertices;
  const [bBottomLeft, bBottomRight, bTopRight] = state.pieceB.vertices;

  near(planarArea(state.pieceA.vertices), 12, 0,
    'upper triangle A area');
  near(planarArea(state.pieceB.vertices), 12, 0,
    'lower triangle B area');
  near(planarArea(state.pieceA.vertices)
    + planarArea(state.pieceB.vertices),
  geometry.rectangleWidth * geometry.rectangleHeight, 0,
  'two triangles exactly cover the quadrangle');
  vectorNear(aBottomLeft, bBottomLeft, 0,
    'shared bottom-left diagonal endpoint');
  vectorNear(aTopRight, bTopRight, 0,
    'shared top-right diagonal endpoint');
  vectorNear(aTopLeft, new THREE.Vector3(-3, 0, 2), 0,
    'upper-left outer corner');
  vectorNear(bBottomRight, new THREE.Vector3(3, 0, -2), 0,
    'lower-right outer corner');

  const aLeg1 = aBottomLeft.clone().sub(aTopLeft);
  const aLeg2 = aTopRight.clone().sub(aTopLeft);
  const bLeg1 = bBottomLeft.clone().sub(bBottomRight);
  const bLeg2 = bTopRight.clone().sub(bBottomRight);
  near(aLeg1.dot(aLeg2), 0, 0, 'A is right-angled');
  near(bLeg1.dot(bLeg2), 0, 0, 'B is right-angled');
  near(state.contact.overlapLength, geometry.diagonalLength, 0,
    'full diagonal contact when reassembled');
  disposeModel(model.root);
});

test('movement 322 maintains exact coincident sliding contact through the dense cycle', () => {
  const model = createMovementModel(catalog.movements[321]);
  const { geometry, stateAtTime } = model.root.userData;
  let observedMinimumOverlap = Infinity;

  for (let sample = 0; sample <= 2048; sample += 1) {
    const time = geometry.demonstrationPeriod * sample / 2048;
    const state = stateAtTime(time);
    const relativeTranslation = state.pieceB.translation.clone()
      .sub(state.pieceA.translation);
    const aDirection = state.contact.aHypotenuse.end.clone()
      .sub(state.contact.aHypotenuse.start);
    const bDirection = state.contact.bHypotenuse.end.clone()
      .sub(state.contact.bHypotenuse.start);

    near(state.contact.coincidentLineResidual, 0, 5e-16,
      `zero contact-normal gap at ${sample}`);
    near(relativeTranslation.dot(state.contact.normal), 0, 8e-16,
      `relative motion is tangent at ${sample}`);
    near(state.contact.directionCrossResidual, 0, 0,
      `hypotenuses remain parallel at ${sample}`);
    near(aDirection.length(), geometry.diagonalLength, 2e-15,
      `A hypotenuse is rigid at ${sample}`);
    near(bDirection.length(), geometry.diagonalLength, 2e-15,
      `B hypotenuse is rigid at ${sample}`);
    near(state.contact.overlapLength,
      geometry.diagonalLength - 2 * state.travel, 2e-15,
    `contact overlap equation at ${sample}`);
    assert.ok(state.contact.overlapLength
      >= geometry.minimumOverlapLength - 2e-15,
    `positive two-thirds overlap at ${sample}`);
    observedMinimumOverlap = Math.min(
      observedMinimumOverlap,
      state.contact.overlapLength,
    );
  }
  near(observedMinimumOverlap, geometry.minimumOverlapLength, 2e-15,
    'minimum overlap is exactly two thirds of the diagonal');
  disposeModel(model.root);
});

test('movement 322 keeps both working edges parallel without rotating either ruler', () => {
  const model = createMovementModel(catalog.movements[321]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 1024; sample += 1) {
    const state = stateAtTime(
      geometry.demonstrationPeriod * sample / 1024,
    );
    const directionA = state.pieceA.workingEdge.direction;
    const directionB = state.pieceB.workingEdge.direction;
    const holeOffsetA = state.pieceA.holeCenter.clone()
      .sub(state.pieceA.translation);
    const holeOffsetB = state.pieceB.holeCenter.clone()
      .sub(state.pieceB.translation);

    near(directionA.length(), geometry.rectangleWidth, 0,
      `A working-edge length at ${sample}`);
    near(directionB.length(), geometry.rectangleWidth, 0,
      `B working-edge length at ${sample}`);
    near(state.workingEdges.directionCrossResidual, 0, 0,
      `working edges parallel at ${sample}`);
    near(directionA.dot(directionB), geometry.rectangleWidth ** 2, 0,
      `working edges point the same way at ${sample}`);
    near(state.workingEdges.separation,
      geometry.rectangleHeight
        - 2 * state.travel * geometry.diagonalUnit.y,
    5e-16, `working-edge separation at ${sample}`);
    near(state.pieceA.rotation, 0, 0, `A does not rotate at ${sample}`);
    near(state.pieceB.rotation, 0, 0, `B does not rotate at ${sample}`);
    vectorNear(holeOffsetA,
      new THREE.Vector3(
        geometry.holeCenterA.x,
        geometry.plateDepth / 2,
        geometry.holeCenterA.y,
      ),
    5e-16, `A hole is rigidly carried at ${sample}`);
    vectorNear(holeOffsetB,
      new THREE.Vector3(
        geometry.holeCenterB.x,
        geometry.plateDepth / 2,
        geometry.holeCenterB.y,
      ),
    5e-16, `B hole is rigidly carried at ${sample}`);
    vectorNear(state.rigidBodyCenterSum, new THREE.Vector3(), 8e-16,
      `equal opposite translations at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 322 follows a smooth move-hold-return-hold source schedule', () => {
  const model = createMovementModel(catalog.movements[321]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  const period = geometry.demonstrationPeriod;
  const outwardEnd = period * geometry.outwardEndPhase;
  const holdEnd = period * geometry.outwardHoldEndPhase;
  const returnEnd = period * geometry.returnEndPhase;

  for (const time of [0, outwardEnd, holdEnd, returnEnd, period]) {
    const state = stateAtTime(time);
    near(state.travelRate, 0, 0, `zero keyframe speed at ${time}`);
    near(state.travelAcceleration, 0, 0,
      `zero keyframe acceleration at ${time}`);
  }
  near(stateAtTime(outwardEnd).travel, geometry.maximumPieceTravel, 0,
    'one-sixth-diagonal outward travel');
  near(stateAtTime(holdEnd).travel, geometry.maximumPieceTravel, 0,
    'maximum offset persists through hold');
  near(stateAtTime(returnEnd).travel, 0, 0,
    'return completes at phase 0.9');
  for (const phase of [0.41, 0.45, 0.49]) {
    const state = stateAtTime(period * phase);
    assert.equal(state.mode, 'holding-maximum-parallel-offset');
    near(state.travel, geometry.maximumPieceTravel, 0,
      `outward hold at ${phase}`);
  }
  for (const phase of [0.91, 0.95, 0.99]) {
    const state = stateAtTime(period * phase);
    assert.equal(state.mode, 'holding-reassembled-quadrangle');
    near(state.travel, 0, 0, `reassembled hold at ${phase}`);
  }
  const outwardMid = stateAtTime(period * 0.2);
  const returnMid = stateAtTime(period * 0.7);
  near(outwardMid.travel, returnMid.travel, 2e-16,
    'outward and return paths are symmetric');
  near(outwardMid.travelRate, -returnMid.travelRate, 4e-16,
    'outward and return velocities are symmetric');
  near(outwardMid.travelAcceleration, -returnMid.travelAcceleration, 2e-15,
    'outward and return accelerations are symmetric');
  assert.equal(timeline.schedule.length, 5);
  assert.deepEqual(timeline.schedule.map(({ phase }) => phase),
    [0, 0.4, 0.5, 0.9, 1]);
  disposeModel(model.root);
});

test('movement 322 renderer carries both rigid plates, holes, and live contact state', () => {
  const model = createMovementModel(catalog.movements[321]);
  const {
    animationTiming,
    blocks,
    geometry,
    stateAtTime,
  } = model.root.userData;

  assert.equal(animationTiming.authoredCyclePeriod, geometry.demonstrationPeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(blocks.pieceA.userData.solidDepth, geometry.plateDepth);
  assert.equal(blocks.pieceB.userData.solidDepth, geometry.plateDepth);
  assert.equal(blocks.pieceA.userData.body.userData.isRigidBody, true);
  assert.equal(blocks.pieceB.userData.body.userData.isRigidBody, true);
  assert.equal(blocks.guideLines.length, 4);
  assert.ok(model.cameraDirection.y > 0,
    'camera looks down onto the three-dimensional drawing surface');

  for (const time of [0, 0.7, 1.5, 2, 2.3, 2.5, 3.4, 4.5, 4.8, 5]) {
    const state = stateAtTime(time);
    model.update(time);
    vectorNear(blocks.pieceA.position, state.pieceA.translation, 0,
      `rendered A translation at ${time}`);
    vectorNear(blocks.pieceB.position, state.pieceB.translation, 0,
      `rendered B translation at ${time}`);
    vectorNear(blocks.pieceA.userData.velocity, state.pieceA.velocity, 0,
      `rendered A velocity at ${time}`);
    vectorNear(blocks.pieceB.userData.velocity, state.pieceB.velocity, 0,
      `rendered B velocity at ${time}`);
    assert.deepEqual(
      [blocks.pieceA.rotation.x, blocks.pieceA.rotation.y,
        blocks.pieceA.rotation.z],
      [0, 0, 0],
    );
    assert.deepEqual(
      [blocks.pieceB.rotation.x, blocks.pieceB.rotation.y,
        blocks.pieceB.rotation.z],
      [0, 0, 0],
    );
    assert.equal(model.root.userData.contacts.slidingHypotenuses.active, true);
    near(model.root.userData.contacts.slidingHypotenuses.overlapLength,
      state.contact.overlapLength, 0, `rendered contact at ${time}`);
    near(model.root.userData.renderState.travel, state.travel, 0,
      `render-state travel at ${time}`);
    vectorNear(model.root.userData.renderState.pieceA.holeCenter,
      state.pieceA.holeCenter, 0, `render-state A hole at ${time}`);
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

test('movement 322 closes exactly and leaves movement 339 as the next authored draft', () => {
  const model = createMovementModel(catalog.movements[321]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(geometry.demonstrationPeriod);

  near(closure.phase, start.phase, 0, 'phase closure');
  near(closure.travel, start.travel, 0, 'travel closure');
  near(closure.travelRate, start.travelRate, 0, 'speed closure');
  near(closure.travelAcceleration, start.travelAcceleration, 0,
    'acceleration closure');
  vectorNear(closure.pieceA.translation, start.pieceA.translation, 0,
    'A translation closure');
  vectorNear(closure.pieceB.translation, start.pieceB.translation, 0,
    'B translation closure');
  vectorNear(closure.pieceA.holeCenter, start.pieceA.holeCenter, 0,
    'A hole closure');
  vectorNear(closure.pieceB.holeCenter, start.pieceB.holeCenter, 0,
    'B hole closure');
  vectorNear(closure.contact.overlapStart, start.contact.overlapStart, 0,
    'contact start closure');
  vectorNear(closure.contact.overlapEnd, start.contact.overlapEnd, 0,
    'contact end closure');
  model.update(geometry.demonstrationPeriod);
  vectorNear(blocks.pieceA.position, new THREE.Vector3(), 0,
    'rendered A closure');
  vectorNear(blocks.pieceB.position, new THREE.Vector3(), 0,
    'rendered B closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
