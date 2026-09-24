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
  'fixed-and-adjustable-parallel-cheek-bisecting-gauge-with-equal-link-midpoint-marker';

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function vector2Near(actual, expected, tolerance, message) {
  near(
    new THREE.Vector2(actual.x, actual.y).distanceTo(
      new THREE.Vector2(expected.x, expected.y),
    ),
    0,
    tolerance,
    message,
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

test('movement 410 is one cross-bar, one fixed cheek, one adjustable cheek and thumb screw, two equal links, and one marker', () => {
  const movement = catalog.movements[409];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 410);
  assert.equal(movement.number, '410');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /one cheek is fixed/);
  assert.match(data.mechanism, /one parallel cheek slides and locks by thumb screw/);
  assert.match(data.mechanism, /equal fixed-length bars/);
  assert.equal(degreesOfFreedom.independentManualCoordinates, 2);
  assert.equal(degreesOfFreedom.simultaneouslyActiveManualCoordinates, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedomWhenLocked, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(blocks.gauge.parent, model.root);
  assert.equal(blocks.crossbar.parent, blocks.gauge);
  assert.equal(blocks.fixedCheek.group.parent, blocks.gauge);
  assert.equal(blocks.adjustableCheek.group.parent, blocks.gauge);
  assert.equal(blocks.leftLink.parent, blocks.gauge);
  assert.equal(blocks.rightLink.parent, blocks.gauge);
  assert.equal(blocks.markingPoint.parent, blocks.gauge);
  assert.equal(blocks.thumbScrew.parent,
    blocks.adjustableCheek.group);

  const roles = [];
  const gauges = [];
  const centeringBars = [];
  const markingPoints = [];
  const belts = [];
  const gears = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.role
      === 'single-bisecting-gauge-sliding-longitudinally-on-workpiece') {
      gauges.push(object);
    }
    if (object.userData.role?.endsWith('equal-short-centering-bar')) {
      centeringBars.push(object);
    }
    if (object.userData.role
      === 'sharp-marking-point-at-common-equal-link-pivot') {
      markingPoints.push(object);
    }
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.teeth) gears.push(object);
  });
  assert.equal(gauges.length, 1);
  assert.equal(centeringBars.length, 2);
  assert.equal(markingPoints.length, 1);
  assert.deepEqual(belts, []);
  assert.deepEqual(gears, []);
  for (const role of [
    'rigid-cross-bar-fixed-to-left-cheek-and-guiding-right-cheek',
    'left-cheek-rigidly-fixed-to-crossbar',
    'right-cheek-sliding-on-crossbar',
    'thumb-screw-locking-adjustable-cheek-to-crossbar',
    'equal-left-link-pivot-centered-in-fixed-cheek',
    'equal-right-link-pivot-centered-in-adjustable-cheek',
    'sharp-marker-needle-touching-workpiece',
    'fixed-parallel-sided-workpiece-being-bisected',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 410 records Brown’s plate, written construction, and unavailable-animation boundary', () => {
  const movement = catalog.movements[409];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate410;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_410.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /two parallel cheeks on the cross-bar/);
  assert.match(movement.description,
    /one is fixed and the other adjustable, and held by thumb-screw/);
  assert.match(movement.description, /two short bars of equal length/);
  assert.match(movement.description, /sharp point for marking/);
  assert.match(movement.description,
    /always in a central position between the cheeks/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.fixedCheekApproximateBoundsPixels,
    [48, 91, 205, 275]);
  assert.deepEqual(plate.adjustableCheekApproximateBoundsPixels,
    [301, 230, 474, 417]);
  assert.deepEqual(plate.crossbarApproximateBoundsPixels,
    [132, 153, 431, 321]);
  assert.deepEqual(plate.markingPivotApproximatePixels, [191, 315]);
  assert.deepEqual(plate.workpieceApproximateBoundsPixels,
    [23, 76, 507, 510]);
  assert.equal(evidence.explicitInBrownDescription.length, 9);
  assert.match(evidence.engravingEvidence,
    /long cross-bar.*two deep parallel cheek plates/);
  assert.match(evidence.reconstructionDisclosure,
    /exact equal-link midpoint construction is retained/);
  disposeModel(model.root);
});

test('movement 410 equal links force the marker onto the exact cheek midpoint at every admissible setting', () => {
  const model = createMovementModel(catalog.movements[409]);
  const { geometry, stateAtTime } = model.root.userData;
  let maximumCenterResidual = 0;
  let maximumLeftLengthResidual = 0;
  let maximumRightLengthResidual = 0;
  let minimumSpacing = Infinity;
  let maximumSpacing = -Infinity;

  for (let sample = -10000; sample <= 20000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 10000);
    maximumCenterResidual = Math.max(maximumCenterResidual,
      Math.abs(state.centerResidual));
    maximumLeftLengthResidual = Math.max(maximumLeftLengthResidual,
      Math.abs(state.leftLinkLengthResidual));
    maximumRightLengthResidual = Math.max(maximumRightLengthResidual,
      Math.abs(state.rightLinkLengthResidual));
    minimumSpacing = Math.min(minimumSpacing, state.cheekSpacing);
    maximumSpacing = Math.max(maximumSpacing, state.cheekSpacing);
    near(state.markerLocal.x,
      (geometry.fixedCheekX + state.adjustableCheekX) / 2,
      0, 'marker transverse midpoint');
    assert.ok(state.cheekSpacing < 2 * geometry.equalLinkLength,
      'equal links retain a real below-bar intersection');
  }
  assert.equal(maximumCenterResidual, 0);
  assert.ok(maximumLeftLengthResidual < 4.5e-16);
  assert.ok(maximumRightLengthResidual < 4.5e-16);
  near(minimumSpacing, geometry.fittedCheekSpacing, 5e-16, 'fitted spacing');
  near(maximumSpacing, geometry.setupAdjustableCheekX - geometry.fixedCheekX,
    7e-16, 'outward setup spacing');
  disposeModel(model.root);
});

test('movement 410 fitted equal-offset cheeks put the marker on the workpiece centerline throughout both traverses', () => {
  const model = createMovementModel(catalog.movements[409]);
  const { geometry, stateAtTime } = model.root.userData;
  let minimumMarkerY = Infinity;
  let maximumMarkerY = -Infinity;
  let fittedSamples = 0;

  for (let sample = 0; sample < 20000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 20000);
    if (!state.stage.startsWith('locked-')) continue;
    fittedSamples += 1;
    assert.equal(state.fitted, true);
    near(state.leftCheekContactResidual, 0, 0,
      'fixed cheek edge contact');
    near(state.rightCheekContactResidual, 0, 5e-16,
      'adjustable cheek edge contact');
    near(state.markerWorld.x, 0, 3e-16,
      'marker on parallel workpiece centerline');
    minimumMarkerY = Math.min(minimumMarkerY, state.markerWorld.y);
    maximumMarkerY = Math.max(maximumMarkerY, state.markerWorld.y);
  }
  assert.ok(fittedSamples > 12000);
  assert.ok(minimumMarkerY < -2.24);
  assert.ok(maximumMarkerY > 0.33);
  assert.ok(minimumMarkerY > -geometry.workpieceHalfLength);
  assert.ok(maximumMarkerY < geometry.workpieceHalfLength);
  disposeModel(model.root);
});

test('movement 410 schedule never moves the cheek, gauge, or screw simultaneously and locks every working traverse', () => {
  const model = createMovementModel(catalog.movements[409]);
  const { geometry, stateAtTime } = model.root.userData;
  const stages = new Set();

  for (let sample = 0; sample < 20000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 20000);
    stages.add(state.stage);
    const activeCoordinates = [
      Math.abs(state.adjustableCheekSpeed) > 1e-12,
      Math.abs(state.gaugeSpeed) > 1e-12,
      Math.abs(state.lockSpeed) > 1e-12,
    ].filter(Boolean).length;
    assert.ok(activeCoordinates <= 1);
    if (Math.abs(state.gaugeSpeed) > 1e-12) {
      near(state.lockFraction, 1, 0, 'gauge traverses only while locked');
      assert.equal(state.fitted, true);
    }
    if (Math.abs(state.adjustableCheekSpeed) > 1e-12) {
      near(state.lockFraction, 0, 0, 'cheek adjusts only while unlocked');
      near(state.gaugeSpeed, 0, 0, 'gauge rests during adjustment');
    }
  }
  assert.deepEqual(stages, new Set([
    'locked-forward-centerline-traverse',
    'locked-far-end-dwell',
    'locked-return-centerline-traverse',
    'releasing-adjustable-cheek-thumb-screw',
    'unlocked-cheek-retracted-from-workpiece-edge',
    'unlocked-cheek-adjusted-to-workpiece-edge',
    'tightening-thumb-screw-at-fitted-width',
  ]));
  disposeModel(model.root);
});

test('movement 410 analytic cheek, gauge, and marker derivatives match finite differences within every moving stage', () => {
  const model = createMovementModel(catalog.movements[409]);
  const { stateAtTime } = model.root.userData;
  const velocityEpsilon = 1e-6;
  const accelerationEpsilon = 1e-4;

  for (const time of [0.43, 1.67, 3.35, 4.68, 5.48, 6.26, 7.18, 7.91]) {
    const before = stateAtTime(time - velocityEpsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + velocityEpsilon);
    const beforeAcceleration = stateAtTime(time - accelerationEpsilon);
    const afterAcceleration = stateAtTime(time + accelerationEpsilon);
    near(state.adjustableCheekSpeed,
      (after.adjustableCheekX - before.adjustableCheekX)
        / (2 * velocityEpsilon),
    7e-10, 'adjustable cheek speed');
    near(state.gaugeSpeed,
      (after.gaugeY - before.gaugeY) / (2 * velocityEpsilon),
      7e-10, 'gauge speed');
    const finiteMarkerVelocity = after.markerWorld.clone()
      .sub(before.markerWorld)
      .multiplyScalar(1 / (2 * velocityEpsilon));
    const finiteMarkerAcceleration = afterAcceleration.markerVelocity.clone()
      .sub(beforeAcceleration.markerVelocity)
      .multiplyScalar(1 / (2 * accelerationEpsilon));
    vectorNear(state.markerVelocity, finiteMarkerVelocity, 8e-10,
      'marker velocity');
    vectorNear(state.markerAcceleration, finiteMarkerAcceleration, 1.2e-7,
      'marker acceleration');
  }
  disposeModel(model.root);
});

test('movement 410 stage boundaries are twice-smooth and the complete setup/use cycle closes exactly', () => {
  const model = createMovementModel(catalog.movements[409]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);

  for (const [phase] of timeline.stages) {
    const state = stateAtTime(phase * geometry.cycleDuration);
    near(state.adjustableCheekSpeed, 0, 2e-15,
      `cheek boundary speed ${phase}`);
    near(state.adjustableCheekAcceleration, 0, 5e-14,
      `cheek boundary acceleration ${phase}`);
    near(state.gaugeSpeed, 0, 2e-15,
      `gauge boundary speed ${phase}`);
    near(state.gaugeAcceleration, 0, 5e-14,
      `gauge boundary acceleration ${phase}`);
    near(state.lockSpeed, 0, 2e-15,
      `lock boundary speed ${phase}`);
    near(state.lockAcceleration, 0, 5e-14,
      `lock boundary acceleration ${phase}`);
  }
  near(closure.adjustableCheekX, source.adjustableCheekX, 0,
    'cheek cycle closure');
  near(closure.gaugeY, source.gaugeY, 0, 'gauge cycle closure');
  near(closure.lockFraction, source.lockFraction, 0,
    'lock cycle closure');
  vectorNear(closure.markerWorld, source.markerWorld, 0,
    'marker cycle closure');
  disposeModel(model.root);
});

test('movement 410 update binds the two cheeks, equal links, marker tip, and screw state to one solved pose', () => {
  const model = createMovementModel(catalog.movements[409]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;

  for (const fraction of [0, 0.14, 0.33, 0.49, 0.66, 0.75, 0.86, 0.96, 1]) {
    const time = geometry.cycleDuration * fraction;
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.gauge.position.y, state.gaugeY, 0,
      'rendered gauge traverse');
    near(blocks.adjustableCheek.group.position.x,
      state.adjustableCheekX, 0, 'rendered adjustable cheek');
    near(blocks.adjustableLinkAnchor.position.x,
      state.adjustableCheekX, 0, 'rendered adjustable link pivot');
    // Compare in the board (model) frame; the root turns the board face up.
    vector2Near(
      model.root.worldToLocal(blocks.markingPoint.getWorldPosition(new THREE.Vector3())),
      new THREE.Vector3(state.markerWorld.x,state.markerWorld.y,0),
      4e-15,
      'rendered marker pivot',
    );
    const leftEnds = [
      blocks.leftLink.localToWorld(
        new THREE.Vector3(-geometry.equalLinkLength / 2, 0, 0),
      ),
      blocks.leftLink.localToWorld(
        new THREE.Vector3(geometry.equalLinkLength / 2, 0, 0),
      ),
    ].map(p => model.root.worldToLocal(p));
    const leftTargets = [state.fixedLinkPivotWorld, state.markerWorld];
    const directError = new THREE.Vector2(leftEnds[0].x, leftEnds[0].y)
      .distanceTo(leftTargets[0])
      + new THREE.Vector2(leftEnds[1].x, leftEnds[1].y)
        .distanceTo(leftTargets[1]);
    const reverseError = new THREE.Vector2(leftEnds[0].x, leftEnds[0].y)
      .distanceTo(leftTargets[1])
      + new THREE.Vector2(leftEnds[1].x, leftEnds[1].y)
        .distanceTo(leftTargets[0]);
    assert.ok(Math.min(directError, reverseError) < 1e-14);
    near(blocks.thumbScrew.position.z,
      0.49 + 0.13 * (1 - state.lockFraction), 0,
    'rendered thumb-screw lift');
    assert.equal(data.contacts.adjustableCheekToCrossbar.locked,
      state.lockFraction === 1);
    near(data.contacts.fixedCheekToWorkpiece.residual, 0, 0,
      'rendered fixed cheek contact');
  }
  const markerTip = model.root.worldToLocal(blocks.markerNeedle.localToWorld(
    new THREE.Vector3(0, blocks.markerNeedle.geometry.parameters.height / 2, 0),
  ));
  near(markerTip.z, -0.18, 1e-15,
    'sharp conical marker tip touches workpiece top plane');
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier', () => {
  const movement507 = catalog.movements[506];
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
});
