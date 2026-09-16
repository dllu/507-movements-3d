import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
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

test('movement 279 is Clayton’s adjustable journal-box Scotch yoke', () => {
  const movement = catalog.movements[278];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
  } = model.root.userData;

  assert.equal(movement.id, 279);
  assert.equal(movement.number, '279');
  assert.equal(movement.title,
    'Clayton Adjustable Sliding Journal Crosshead');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'crank-wrist-adjustable-sliding-journal-scotch-yoke');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one fixed-axis crank/);
  assert.match(mechanism, /orientation-fixed sliding journal box/);
  assert.match(mechanism, /two adjustable taper gibs/);
  assert.match(mechanism, /one exact Scotch-yoke reciprocation/);

  assert.equal(blocks.crank.parent, model.root);
  assert.equal(blocks.crankRotor.parent, blocks.crank);
  assert.equal(blocks.crankWrist.parent, blocks.crankRotor);
  assert.equal(blocks.crosshead.parent, model.root);
  assert.equal(blocks.journalBox.parent, model.root);
  vectorNear(blocks.crank.userData.axis, Z_AXIS, 0, 'crank axis');
  vectorNear(blocks.crosshead.userData.axis, X_AXIS, 0,
    'crosshead guide axis');
  vectorNear(blocks.journalBox.userData.axis, Y_AXIS, 0,
    'box slide axis');
  assert.equal(blocks.liningPieces.length, 2);
  assert.equal(blocks.taperGibs.length, 2);
  assert.equal(blocks.adjustmentScrews.length, 2);
  assert.ok(blocks.liningPieces.every((piece) =>
    piece.parent === blocks.journalBox));
  assert.ok(blocks.taperGibs.every((gib) =>
    gib.parent === blocks.journalBox));
  assert.ok(blocks.adjustmentScrews.every((screw) =>
    screw.parent === blocks.journalBox));

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => /taper-bearing-lining-piece$/.test(role))
    .length, 2);
  assert.equal(roles.filter((role) => /adjustable-taper-gib$/.test(role))
    .length, 2);
  assert.equal(roles.filter((role) => /wear-adjustment-screw$/.test(role))
    .length, 2);
  assert.equal(roles.filter((role) => /belt|gear|pulley/.test(role)).length, 0);
  disposeModel(model.root);
});

test('movement 279 records its measured Brown plate and limited animation reference', () => {
  const model = createMovementModel(catalog.movements[278]);
  const {
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate279;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.behaviorReferenced, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /one rotating crank/);
  assert.match(sourceAnimation.referenceScope, /No proprietary animation coordinates were copied/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_279.html');
  assert.equal(sourceReference.officialDescription,
    catalog.movements[278].description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 6);
  assert.deepEqual(plate.rasterCrankCenter, { x: 215, y: 282 });
  assert.deepEqual(plate.rasterWristCenter, { x: 264, y: 183 });
  assert.deepEqual(plate.rasterLeftScrew, { x: 235, y: 78 });
  assert.deepEqual(plate.rasterRightScrew, { x: 293, y: 78 });
  assert.match(plate.inferredTopology, /two taper lining pieces/);
  assert.match(plate.inferredTopology, /two independent wear-adjustment screws/);
  for (const [feature, error] of Object.entries(
    plate.sourceIdealizationPixelErrors,
  )) {
    assert.ok(error <= plate.measurementUncertaintyPixels,
      `${feature} is ${error}px from its measured source point`);
  }
  vectorNear(sourcePointToModel(plate.rasterCrankCenter),
    new THREE.Vector2(0, 0), 0, 'plate crank center');
  vectorNear(sourcePointToModel(plate.rasterWristCenter),
    new THREE.Vector2(0.588, 1.188), 1e-15, 'plate wrist center');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 75,
    edition: 21,
    illustrationPage: 74,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 279 satisfies the exact crank-pin and Scotch-yoke constraints', () => {
  const model = createMovementModel(catalog.movements[278]);
  const {
    geometry,
    stateAtCrankAngle,
    transmission,
  } = model.root.userData;
  const samples = 4096;
  let minimumX = Infinity;
  let maximumX = -Infinity;

  for (let index = 0; index <= samples; index += 1) {
    const angle = Math.PI * 2 * index / samples;
    const state = stateAtCrankAngle(angle);
    near(state.crankPin.length(), geometry.crankRadius, 5e-16,
      `pin circle at sample ${index}`);
    near(state.crossheadX, state.crankPin.x, 0,
      `horizontal yoke constraint at sample ${index}`);
    near(state.boxRelativeY, state.crankPin.y, 0,
      `vertical box slide at sample ${index}`);
    near(state.horizontalConstraintError, 0, 0,
      `reported horizontal error at sample ${index}`);
    near(state.bearingConcentricityError, 0, 0,
      `bearing concentricity at sample ${index}`);
    near(state.boxAngle, 0, 0,
      `orientation-fixed box at sample ${index}`);
    minimumX = Math.min(minimumX, state.crossheadX);
    maximumX = Math.max(maximumX, state.crossheadX);
  }

  near(maximumX, geometry.crankRadius, 0, 'right dead center');
  near(minimumX, -geometry.crankRadius, 0, 'left dead center');
  near(maximumX - minimumX, transmission.outputStroke, 0,
    'one crank-diameter output stroke');
  near(transmission.outputStroke, 2 * geometry.crankRadius, 0,
    'declared stroke');
  assert.match(transmission.crossheadLaw,
    /crossheadX = crankRadius\*cos\(crankAngle\)/);
  assert.match(transmission.journalBoxLaw,
    /journalBoxWorld = crankPin/);
  assert.match(transmission.boxOrientationLaw, /journalBoxAngle = 0/);
  disposeModel(model.root);
});

test('movement 279 keeps the wrist bearing, taper gibs, and slot envelopes valid', () => {
  const model = createMovementModel(catalog.movements[278]);
  const {
    blocks,
    geometry,
    stateAtCrankAngle,
  } = model.root.userData;
  let minimumSlotEndClearance = Infinity;

  for (let index = 0; index <= 4096; index += 1) {
    const state = stateAtCrankAngle(Math.PI * 2 * index / 4096);
    near(state.linerRadialClearance, 0.026, 5e-17,
      `wrist running clearance at ${index}`);
    near(state.leftGibClearance, 0.018, 1e-16,
      `left gib clearance at ${index}`);
    near(state.rightGibClearance, state.leftGibClearance, 0,
      `equal gib clearance at ${index}`);
    assert.ok(state.upperEnvelopeClearance > 0,
      `upper slot end clears at ${index}`);
    assert.ok(state.lowerEnvelopeClearance > 0,
      `lower slot end clears at ${index}`);
    minimumSlotEndClearance = Math.min(
      minimumSlotEndClearance,
      state.minimumSlotEndClearance,
    );
  }
  near(minimumSlotEndClearance,
    geometry.slotTopY - geometry.boxTopY - geometry.crankRadius,
    5e-16, 'minimum box-to-slot-end clearance');
  assert.ok(minimumSlotEndClearance > 0.03);
  near(geometry.linerInnerRadius - geometry.wristRadius, 0.026, 5e-17,
    'liner-to-wrist radial clearance');
  near(geometry.slotHalfWidth - geometry.gibOuterFace, 0.018, 1e-16,
    'gib-to-slot side clearance');
  assert.notEqual(blocks.adjustmentScrews[0], blocks.adjustmentScrews[1]);
  near(blocks.adjustmentScrews[0].position.x, -geometry.screwX, 0,
    'left independent adjuster');
  near(blocks.adjustmentScrews[1].position.x, geometry.screwX, 0,
    'right independent adjuster');
  disposeModel(model.root);
});

test('movement 279 keeps its output rod captured by both fixed guides', () => {
  const model = createMovementModel(catalog.movements[278]);
  const {
    blocks,
    geometry,
    stateAtCrankAngle,
    transmission,
  } = model.root.userData;
  let minimumCoverage = Infinity;

  assert.equal(blocks.crossheadRod.parent, blocks.crosshead);
  assert.ok(blocks.guideBlocks.every((guide) => guide.parent === model.root));
  assert.ok(blocks.guidePosts.every((post) => post.parent === model.root));
  for (let index = 0; index <= 4096; index += 1) {
    const state = stateAtCrankAngle(Math.PI * 2 * index / 4096);
    minimumCoverage = Math.min(minimumCoverage,
      state.minimumRodGuideCoverage);
    assert.ok(state.leftRodGuideCoverage > 0,
      `left guide retains rod at ${index}`);
    assert.ok(state.rightRodGuideCoverage > 0,
      `right guide retains rod at ${index}`);
    near(state.crossheadX, state.crankPin.x, 0,
      `crosshead has no transverse freedom at ${index}`);
  }
  near(minimumCoverage,
    geometry.rodHalfLength - geometry.guideCenterX
      - geometry.guideHalfWidth - geometry.crankRadius,
    5e-16, 'minimum guide engagement');
  assert.ok(minimumCoverage > 0.074);
  near(transmission.outputStroke, 2 * geometry.crankRadius, 0,
    'crosshead stroke remains one crank diameter');
  disposeModel(model.root);
});

test('movement 279 analytic velocities and accelerations match finite differences', () => {
  const model = createMovementModel(catalog.movements[278]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-4;

  for (const time of [0.1, 0.4, 0.8, 1.2, 1.7, 2.1, 2.6, 3.1, 3.7]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    const pinVelocity = after.crankPin.clone().sub(before.crankPin)
      .multiplyScalar(1 / (2 * step));
    const pinAcceleration = after.crankPin.clone().add(before.crankPin)
      .addScaledVector(state.crankPin, -2)
      .multiplyScalar(1 / step ** 2);
    vectorNear(pinVelocity, state.crankPinVelocity, 2e-8,
      `crank-pin velocity at ${time}`);
    vectorNear(pinAcceleration, state.crankPinAcceleration, 1e-7,
      `crank-pin acceleration at ${time}`);
    near((after.crossheadX - before.crossheadX) / (2 * step),
      state.crossheadSpeed, 2e-8, `crosshead speed at ${time}`);
    near((after.crossheadX - 2 * state.crossheadX + before.crossheadX)
      / step ** 2, state.crossheadAcceleration, 1e-7,
    `crosshead acceleration at ${time}`);
    near((after.boxRelativeY - before.boxRelativeY) / (2 * step),
      state.boxRelativeSpeed, 2e-8, `box slide speed at ${time}`);
    near((after.boxRelativeY - 2 * state.boxRelativeY + before.boxRelativeY)
      / step ** 2, state.boxRelativeAcceleration, 1e-7,
    `box slide acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 279 renderer binds every moving member and visible motion index', () => {
  const model = createMovementModel(catalog.movements[278]);
  const {
    animationTiming,
    blocks,
    stateAtTime,
  } = model.root.userData;
  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(blocks.wristRotationIndex.parent, blocks.crankRotor);
  assert.equal(blocks.crossheadMotionIndex.parent, blocks.crosshead);
  assert.equal(blocks.boxMotionIndex.parent, blocks.journalBox);

  for (const time of [0, 0.37, 1.04, 1.73, 2.42, 3.18, 4]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.crankRotor.rotation.z, expected.crankAngle, 0,
      `rendered crank angle at ${time}`);
    near(blocks.crosshead.position.x, expected.crossheadX, 0,
      `rendered crosshead at ${time}`);
    near(blocks.crosshead.position.y, 0, 0,
      `crosshead remains horizontal at ${time}`);
    vectorNear(blocks.journalBox.position, expected.crankPin, 0,
      `rendered journal box at ${time}`);
    near(blocks.journalBox.quaternion.angleTo(new THREE.Quaternion()), 0, 0,
      `journal box remains upright at ${time}`);
    model.root.updateMatrixWorld(true);
    const renderedWrist = blocks.crankWrist.getWorldPosition(
      new THREE.Vector3(),
    );
    near(renderedWrist.x, expected.crankPin.x, 2e-15,
      `rendered wrist x at ${time}`);
    near(renderedWrist.y, expected.crankPin.y, 2e-15,
      `rendered wrist y at ${time}`);
    vectorNear(blocks.crosshead.userData.velocity,
      new THREE.Vector3(expected.crossheadSpeed, 0, 0), 0,
      `rendered crosshead velocity at ${time}`);
    near(model.root.userData.contacts.journalWrist.concentricityError,
      0, 0, `wrist bearing contact at ${time}`);
    near(model.root.userData.contacts.leftGibSlot.clearance,
      expected.leftGibClearance, 0, `left gib contact at ${time}`);
    near(model.root.userData.contacts.rightGibSlot.clearance,
      expected.rightGibClearance, 0, `right gib contact at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 279 closes after one crank turn while movement 339 remains authored', () => {
  const model = createMovementModel(catalog.movements[278]);
  const {
    blocks,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.cyclePeriod);

  assert.equal(timeline.crankTurnsPerCycle, 1);
  near(closure.crankAngle - start.crankAngle, Math.PI * 2, 1e-15,
    'one-turn crank closure');
  vectorNear(closure.crankPin, start.crankPin, 5e-16,
    'crank pin closure');
  vectorNear(closure.crankPinVelocity, start.crankPinVelocity, 1e-15,
    'crank pin velocity closure');
  near(closure.crossheadX, start.crossheadX, 5e-16,
    'crosshead closure');
  near(closure.boxRelativeY, start.boxRelativeY, 0,
    'journal-box slide closure');
  assert.equal(closure.cycleIndex, 1);
  assert.equal(closure.cycleTime, 0);

  model.update(0);
  const startCrank = blocks.crankRotor.quaternion.clone();
  const startCrosshead = blocks.crosshead.position.clone();
  const startBox = blocks.journalBox.position.clone();
  model.update(timeline.cyclePeriod);
  near(blocks.crankRotor.quaternion.angleTo(startCrank), 0, 4e-8,
    'rendered crank closure');
  vectorNear(blocks.crosshead.position, startCrosshead, 5e-16,
    'rendered crosshead closure');
  vectorNear(blocks.journalBox.position, startBox, 5e-16,
    'rendered journal-box closure');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
