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

test('movement 388 is one toothed upper feed roller, one smooth lower support roller, and one plank nip', () => {
  const movement = catalog.movements[387];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 388);
  assert.equal(movement.number, '388');
  assert.equal(movement.category, 'Toothed gearing');
  assert.equal(
    movement.archetype,
    'equal-working-radius-toothed-upper-feed-and-smooth-lower-support-roller-planer-nip',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /woodworth-planer/);
  assert.match(data.mechanism, /toothed-upper-feed-roller/);
  assert.match(data.mechanism, /smooth-lower-support-roller/);
  assert.match(data.mechanism, /equal-opposed-no-slip/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.inputs[0], /toothed upper feed roller/);
  assert.match(degreesOfFreedom.note, /equal 4-unit working radii/);
  assert.match(degreesOfFreedom.note, /zero slip/);

  for (const component of [
    blocks.lowerContactIndex,
    blocks.lowerRoller,
    blocks.upperContactIndex,
    blocks.upperRoller,
    blocks.workpiece,
  ]) assert.ok(component.parent === model.root, `${component.userData.role} parent`);
  assert.ok(blocks.frame.parent === null, 'source presentation removes frame');
  assert.ok(blocks.lowerRotor.parent === blocks.lowerRoller, 'blocks.lowerRotor parent');
  assert.ok(blocks.upperRotor.parent === blocks.upperRoller, 'blocks.upperRotor parent');
  assert.ok(blocks.workpieceBoard.parent === blocks.workpiece, 'blocks.workpieceBoard parent');
  assert.equal(blocks.upperTeeth.length, 20);
  assert.equal(blocks.lowerFaceIndexes.length, 2);
  assert.equal(blocks.upperFaceIndexes.length, 2);
  assert.ok(blocks.workpieceIndexes.length > 20);
  for (const tooth of blocks.upperTeeth) {
    assert.ok(tooth.parent === blocks.upperRotor, 'tooth parent');
  }
  for (const index of blocks.lowerFaceIndexes) {
    assert.ok(index.parent === blocks.lowerRotor, 'index parent');
  }
  for (const index of blocks.upperFaceIndexes) {
    assert.ok(index.parent === blocks.upperRotor, 'index parent');
  }

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'toothed-upper-woodworth-feed-roller',
    'radial-work-gripping-feed-tooth',
    'smooth-lower-supporting-feed-roller',
    'smooth-cylindrical-workpiece-support-surface',
    'wood-plank-between-feed-rollers',
    'white-fed-workpiece-material-index',
    'white-roller-face-spin-index',
  ]) assert.ok(roles.includes(role), role);
  for (const role of [
    'fixed-planer-feed-roller-bearing-frame',
    'roller-shaft-bearing-block',
  ]) assert.ok(!roles.includes(role), `source presentation removes ${role}`);
  disposeModel(model.root);
});

test('movement 388 preserves the measured Brown plate and exact official canvas construction', () => {
  const movement = catalog.movements[387];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate388;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_388.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Woodworth’s planing machine/);
  assert.match(movement.description, /smooth supporting roller/);
  assert.match(movement.description, /toothed top roller/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.deepEqual(sourceAnimation.sourceViewBox, [-12.5, -8, 25, 25]);
  assert.deepEqual(sourceAnimation.sourceLowerCenter, [0, 0]);
  assert.deepEqual(sourceAnimation.sourceUpperCenter, [0, 9]);
  assert.deepEqual(sourceAnimation.sourcePlankFacesY, [4, 5]);
  assert.equal(sourceAnimation.sourceLowerRadius, 4);
  assert.equal(sourceAnimation.sourceUpperRootRadius, 3);
  assert.equal(sourceAnimation.sourceToothArcCount, 20);
  assert.equal(sourceAnimation.sourceToothArcRadius, 1);
  near(sourceAnimation.sourceToothCenterRadius,
    Math.hypot(0.740058, 4.672543), 0,
    'official first tooth-arc center radius');
  assert.equal(sourceAnimation.upperRotationTurnsPerCycle, 1);
  assert.equal(sourceAnimation.lowerRotationTurnsPerCycle, -1);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 6);
  assert.deepEqual(plate.upperRollerCenterPixels, [263, 202]);
  assert.deepEqual(plate.lowerRollerCenterPixels, [263, 366]);
  assert.equal(plate.upperToothTipRadiusPixels, 69);
  assert.equal(plate.upperRootRadiusPixels, 51);
  assert.equal(plate.lowerRollerRadiusPixels, 69);
  assert.deepEqual(plate.plankFacesYPixels, [272, 297]);
  assert.deepEqual(plate.feedArrowPixels, {
    end: [184, 310],
    start: [83, 310],
  });
  assert.equal(evidence.explicitInBrownDescription.length, 3);
  assert.match(evidence.officialAnimationEvidence, /4-unit smooth roller/);
  assert.match(evidence.officialAnimationEvidence, /20-tooth roller/);
  assert.match(evidence.officialAnimationEvidence, /\+1 and -1 turn/);
  assert.match(evidence.reconstructionDisclosure, /plank translation/);
  assert.match(evidence.reconstructionDisclosure, /independently engineered/);
  disposeModel(model.root);
});

test('movement 388 scales the source nip stack and equal working radii exactly', () => {
  const model = createMovementModel(catalog.movements[387]);
  const data = model.root.userData;
  const { constraintResiduals, geometry, transmission } = data;

  near(geometry.workingRadius,
    geometry.sourceWorkingRadius * geometry.sourceScale, 0,
    'scaled working radius');
  near(geometry.plankThickness,
    geometry.sourcePlankThickness * geometry.sourceScale, 0,
    'scaled plank thickness');
  near(geometry.centerDistance,
    geometry.sourceCenterDistance * geometry.sourceScale, 0,
    'scaled shaft center distance');
  near(geometry.upperRootRadius,
    geometry.sourceUpperRootRadius * geometry.sourceScale, 0,
    'scaled upper root radius');
  near(geometry.centerDistance,
    geometry.workingRadius * 2 + geometry.plankThickness, 0,
    'roller-plank-roller stack');
  near(geometry.boardBottomY,
    geometry.lowerCenter.y + geometry.workingRadius, 0,
    'lower smooth contact height');
  near(geometry.boardTopY,
    geometry.upperCenter.y - geometry.workingRadius, 3e-16,
    'upper pitch contact height');
  for (const [name, residual] of Object.entries(constraintResiduals)) {
    near(residual, 0, 3e-16, name);
  }
  assert.match(transmission.nipStackLaw, /9 source units/);
  assert.match(transmission.angularRatio, /-1/);
  assert.match(transmission.feedLaw, /feedSpeed/);
  disposeModel(model.root);
});

test('movement 388 maintains exact equal-and-opposite roller speed and no-slip plank feed', () => {
  const model = createMovementModel(catalog.movements[387]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const expectedAngularSpeed = Math.PI * 2 / timeline.cycleDuration;
  const expectedFeedSpeed = geometry.workingRadius * expectedAngularSpeed;

  for (let sample = -7200; sample <= 14400; sample += 1) {
    const time = timeline.cycleDuration * sample / 7200;
    const state = stateAtTime(time);
    near(state.upperAngularSpeed, expectedAngularSpeed, 0,
      'upper angular speed');
    near(state.lowerAngularSpeed, -expectedAngularSpeed, 0,
      'lower angular speed');
    near(state.feedSpeed, expectedFeedSpeed, 0, 'plank feed speed');
    near(state.upperPitchSurfaceVelocity.x, state.feedSpeed, 0,
      'upper pitch no-slip velocity');
    near(state.lowerSurfaceVelocity.x, state.feedSpeed, 0,
      'lower smooth no-slip velocity');
    near(state.upperPitchSurfaceVelocity.y, 0, 0,
      'upper pitch transverse velocity');
    near(state.lowerSurfaceVelocity.y, 0, 0,
      'lower transverse velocity');
    near(
      state.upperAngle + state.lowerAngle,
      0,
      0,
      'opposed roller angles',
    );
    near(state.feedDisplacement,
      geometry.workingRadius * state.upperAngle, 0,
      'rolling displacement');
  }
  disposeModel(model.root);
});

test('movement 388 always presents one of twenty teeth at the upper nip with a small positive bite', () => {
  const model = createMovementModel(catalog.movements[387]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;
  const minimumBite = geometry.toothTipRadius
    * Math.cos(geometry.toothPitch / 2) - geometry.workingRadius;
  const maximumBite = geometry.toothTipRadius - geometry.workingRadius;

  assert.ok(minimumBite > 0);
  assert.match(transmission.toothEngagementLaw, /nearest of 20/);
  for (let sample = 0; sample < 20000; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 20000);
    assert.ok(state.activeToothIndex >= 0);
    assert.ok(state.activeToothIndex < geometry.toothCount);
    assert.ok(
      Math.abs(state.toothAngleFromNip)
        <= geometry.toothPitch / 2 + 2e-15,
    );
    near(state.activeToothTip.y,
      geometry.upperCenter.y
        - geometry.toothTipRadius * Math.cos(state.toothAngleFromNip),
      7e-16,
      'active tooth tip height',
    );
    assert.ok(state.toothBiteDepth >= minimumBite - 7e-16);
    assert.ok(state.toothBiteDepth <= maximumBite + 7e-16);
  }
  disposeModel(model.root);
});

test('movement 388 periodic long-stock indexes convey continuous rightward material feed', () => {
  const model = createMovementModel(catalog.movements[387]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const circumference = Math.PI * 2 * geometry.workingRadius;
  near(geometry.markerPitch * geometry.markerRepeatsPerCycle,
    circumference, 2e-15, 'five marker pitches per revolution');

  const samples = [0, 0.07, 0.19, 0.41, 0.73, 0.999999];
  for (const phase of samples) {
    const state = stateAtTime(timeline.cycleDuration * phase);
    near(state.workpieceOffset,
      state.feedDisplacement - circumference / 2, 0,
      'long-stock translation');
    assert.ok(state.feedVelocity.x > 0);
    near(state.feedVelocity.y, 0, 0, 'level feed direction');
  }

  const epsilon = 1e-9;
  const before = stateAtTime(timeline.cycleDuration - epsilon);
  const after = stateAtTime(epsilon);
  const patternShift = before.workpieceOffset - after.workpieceOffset;
  near(
    patternShift / geometry.markerPitch,
    geometry.markerRepeatsPerCycle,
    2e-8,
    'cycle boundary differs by an integer repeated-marker count',
  );
  disposeModel(model.root);
});

test('movement 388 renderer binds both indexed rotations, material feed, and both no-slip contacts exactly', () => {
  const model = createMovementModel(catalog.movements[387]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime, timeline } = data;
  const times = [
    0,
    timeline.cycleDuration * 0.031,
    timeline.cycleDuration * 0.247,
    timeline.cycleDuration * 0.503,
    timeline.cycleDuration * 0.819,
    timeline.cycleDuration,
  ];

  for (const time of times) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.upperRotor.rotation.z, state.upperAngle, 0,
      'rendered upper rotation');
    near(blocks.lowerRotor.rotation.z, state.lowerAngle, 0,
      'rendered lower rotation');
    near(blocks.workpiece.position.x, state.workpieceOffset, 0,
      'rendered material displacement');
    vectorNear(blocks.workpiece.userData.materialVelocity,
      state.feedVelocity, 0, 'rendered material velocity');
    near(data.contacts.lowerSmoothNip.normalGap, 0, 0,
      'lower contact normal gap');
    near(data.contacts.lowerSmoothNip.slipVelocity, 0, 0,
      'lower contact slip');
    near(data.contacts.upperToothedNip.pitchSlipVelocity, 0, 0,
      'upper pitch contact slip');
    assert.equal(
      data.contacts.upperToothedNip.activeToothIndex,
      state.activeToothIndex,
    );
    vectorNear(data.contacts.upperToothedNip.toothTip,
      state.activeToothTip, 0, 'active tooth-tip binding');
    vectorNear(data.contacts.upperToothedNip.pitchPoint,
      new THREE.Vector3(0, geometry.boardTopY, 0),
      0,
      'upper pitch point binding');
  }
  disposeModel(model.root);
});

test('movement 388 closes one opposed roller revolution before movement 507 remains authored', () => {
  const movement = catalog.movements[387];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const end = stateAtTime(timeline.cycleDuration);

  near(end.upperAngle, start.upperAngle, 0, 'cycle upper angle');
  near(end.lowerAngle, start.lowerAngle, 0, 'cycle lower angle');
  near(end.feedDisplacement, start.feedDisplacement, 0,
    'cycle material coordinate');
  near(end.workpieceOffset, start.workpieceOffset, 0,
    'cycle workpiece representation');
  assert.equal(end.activeToothIndex, start.activeToothIndex);
  vectorNear(end.activeToothTip, start.activeToothTip, 0,
    'cycle active tooth tip');

  model.update(0);
  const startUpperRotation = data.blocks.upperRotor.rotation.z;
  const startLowerRotation = data.blocks.lowerRotor.rotation.z;
  const startWorkpieceOffset = data.blocks.workpiece.position.x;
  model.update(timeline.cycleDuration);
  near(data.blocks.upperRotor.rotation.z, startUpperRotation, 0,
    'rendered upper cycle closure');
  near(data.blocks.lowerRotor.rotation.z, startLowerRotation, 0,
    'rendered lower cycle closure');
  near(data.blocks.workpiece.position.x, startWorkpieceOffset, 0,
    'rendered workpiece cycle closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, movement.archetype);
  disposeModel(model507.root);
  disposeModel(model.root);
});
