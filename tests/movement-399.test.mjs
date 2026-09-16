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

test('movement 399 is two rigid U-halves with diagonally cross-coupled screws and swivel nuts', () => {
  const movement = catalog.movements[398];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 399);
  assert.equal(movement.number, '399');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(movement.archetype,
    'two-piece-chain-repair-link-with-cross-coupled-opposed-screws-and-captured-swivel-nuts');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.match(data.archetype, /two-piece-chain-repair-link/);
  assert.match(data.mechanism, /two-rigid-opposed-u-shaped/);
  assert.match(data.mechanism, /two-male-screws/);
  assert.match(data.mechanism, /two-axially-captured-swivel-nuts/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(blocks.topHalf.parent, model.root);
  assert.equal(blocks.bottomHalf.parent, model.root);
  assert.equal(blocks.leftNut.parent, model.root);
  assert.equal(blocks.rightNut.parent, model.root);
  assert.equal(blocks.topHalf.userData.screwSide, 'right');
  assert.equal(blocks.topHalf.userData.swivelSide, 'left');
  assert.equal(blocks.bottomHalf.userData.screwSide, 'left');
  assert.equal(blocks.bottomHalf.userData.swivelSide, 'right');

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'upper-rigid-u-shaped-link-half',
    'lower-rigid-u-shaped-link-half',
    'upper-right-male-screw-fixed-to-link-half',
    'lower-left-male-screw-fixed-to-link-half',
    'left-upper-carried-captured-rotating-swivel-nut',
    'right-lower-carried-captured-rotating-swivel-nut',
    'left-upper-carried-internally-threaded-receiver-barrel',
    'right-lower-carried-internally-threaded-receiver-barrel',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 399 preserves Brown’s two-part cross-connection and discloses its unsourced demonstration choices', () => {
  const movement = catalog.movements[398];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate399;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_399.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /repairing chains/);
  assert.match(movement.description, /tightening chains used as guys or braces/);
  assert.match(movement.description, /screw of each part fits into nut of other/);
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
  assert.deepEqual(plate.topArchApproximatePixels, [194, 353, 86, 239]);
  assert.deepEqual(plate.bottomArchApproximatePixels, [194, 353, 288, 451]);
  assert.deepEqual(plate.leftNutApproximatePixels, [166, 242, 201, 353]);
  assert.deepEqual(plate.rightNutApproximatePixels, [298, 374, 202, 356]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence, /opposed upper and lower U-shaped halves/);
  assert.match(evidence.engravingEvidence, /diagonally opposite ends/);
  assert.match(evidence.reconstructionDisclosure, /no animation/);
  assert.match(evidence.reconstructionDisclosure, /equal 0.20-unit pitch/);
  assert.match(evidence.reconstructionDisclosure, /explanatory choices/);
  disposeModel(model.root);
});

test('movement 399 closed male threads have the same physical handedness and declared lead', () => {
  const model = createMovementModel(catalog.movements[398]);
  const {blocks,geometry}=model.root.userData;
  for(const half of [blocks.topHalf,blocks.bottomHalf]) {
    const thread=half.userData.screw.userData.thread;
    assert.equal(thread.geometry.type,'BufferGeometry');
    near(thread.userData.threadProfile.lead*FULL_TURN,-geometry.threadPitch,1e-16,'signed thread lead');
    near(thread.userData.threadProfile.high-thread.userData.threadProfile.low,geometry.screwLength,1e-16,'finite threaded length');
  }
  disposeModel(model.root);
});

test('movement 399 matched thread law shortens both interfaces by exactly pitch times turns', () => {
  const model = createMovementModel(catalog.movements[398]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const loose = stateAtTime(0);

  for (let sample = -20000; sample <= 40000; sample += 1) {
    const state = stateAtTime(
      timeline.cycleDuration * sample / 20000,
    );
    near(
      geometry.looseSeparation - state.halfSeparation,
      geometry.threadPitch * state.adjustmentTurns,
      3e-16,
      'pitch-times-turns shortening law',
    );
    near(state.leftThreadEngagement, state.rightThreadEngagement,
      0, 'equal cross-coupled engagement');
    near(
      state.leftThreadEngagement - loose.leftThreadEngagement,
      geometry.threadPitch * state.adjustmentTurns,
      5e-16,
      'left engagement gain',
    );
    near(state.leftNutAngle, FULL_TURN * state.adjustmentTurns,
      0, 'left swivel-nut rotation');
    near(state.rightNutAngle, -FULL_TURN * state.adjustmentTurns,
      0, 'opposed right swivel-nut rotation');
  }
  disposeModel(model.root);
});

test('movement 399 reaches loose and tight limits smoothly and reverses without a jump', () => {
  const model = createMovementModel(catalog.movements[398]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const looseStart = stateAtTime(0);
  const tight = stateAtTime(timeline.cycleDuration / 2);
  const looseEnd = stateAtTime(timeline.cycleDuration);

  near(looseStart.adjustmentTurns, 0, 0, 'loose turns');
  near(looseStart.halfSeparation, geometry.looseSeparation, 0,
    'loose separation');
  near(tight.adjustmentTurns, geometry.maximumAdjustmentTurns, 0,
    'tight turns');
  near(tight.halfSeparation, geometry.tightSeparation, 3e-16,
    'tight separation');
  near(looseStart.adjustmentTurnRate, 0, 0, 'loose-start rate');
  near(tight.adjustmentTurnRate, 0, 1e-16, 'tight reversal rate');
  near(looseEnd.adjustmentTurnRate, 0, 2e-16, 'loose-end rate');
  near(looseEnd.halfSeparation, looseStart.halfSeparation, 0,
    'cycle separation closure');
  near(looseEnd.leftNutAngle, looseStart.leftNutAngle, 0,
    'left nut cycle closure');
  near(looseEnd.rightNutAngle, looseStart.rightNutAngle, 0,
    'right nut cycle closure');

  const epsilon = 1e-7;
  const before = stateAtTime(timeline.cycleDuration * (0.5 - epsilon));
  const after = stateAtTime(timeline.cycleDuration * (0.5 + epsilon));
  near(before.halfSeparation, after.halfSeparation, 3e-15,
    'position continuity through tight reversal');
  near(before.separationRate, -after.separationRate, 2e-15,
    'symmetric velocity reversal');
  disposeModel(model.root);
});

test('movement 399 analytic separation and nut rates agree with finite differences', () => {
  const model = createMovementModel(catalog.movements[398]);
  const { stateAtTime, timeline } = model.root.userData;
  const epsilon = 2e-6;

  for (const phase of [0.03, 0.12, 0.24, 0.38, 0.49, 0.63, 0.77, 0.91]) {
    const time = timeline.cycleDuration * phase;
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    const separationRate = (after.halfSeparation - before.halfSeparation)
      / (2 * epsilon);
    const turnRate = (after.adjustmentTurns - before.adjustmentTurns)
      / (2 * epsilon);
    near(state.separationRate, separationRate, 1e-10,
      'analytic separation rate');
    near(state.adjustmentTurnRate, turnRate, 5e-10,
      'analytic turn rate');
    near(state.upperHalfVelocity, state.separationRate / 2, 0,
      'upper symmetric velocity');
    near(state.lowerHalfVelocity, -state.separationRate / 2, 0,
      'lower symmetric velocity');
  }
  disposeModel(model.root);
});

test('movement 399 keeps the swivel bearings axially captured and both threaded pairs coaxial', () => {
  const model = createMovementModel(catalog.movements[398]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime, timeline } = data;

  for (let sample = 0; sample <= 12000; sample += 1) {
    const time = timeline.cycleDuration * sample / 12000;
    const state = stateAtTime(time);
    model.update(time, 0);
    near(
      blocks.leftNut.position.y + blocks.leftNut.userData.captiveOffset,
      blocks.topHalf.position.y,
      2e-16,
      'left nut captured to upper half',
    );
    near(
      blocks.rightNut.position.y + blocks.rightNut.userData.captiveOffset,
      blocks.bottomHalf.position.y,
      2e-16,
      'right nut captured to lower half',
    );
    near(blocks.leftNut.position.x, -geometry.legSpacing / 2, 0,
      'left thread-pair coaxial x');
    near(blocks.rightNut.position.x, geometry.legSpacing / 2, 0,
      'right thread-pair coaxial x');
    near(blocks.topHalf.position.x, 0, 0, 'upper half no lateral shift');
    near(blocks.bottomHalf.position.x, 0, 0, 'lower half no lateral shift');
    assert.ok(state.leftThreadEngagement > 0);
    assert.ok(state.rightThreadEngagement > 0);
    near(data.contacts.leftCaptiveSwivel.axialError, 0, 2e-16,
      'reported left capture residual');
    near(data.contacts.rightCaptiveSwivel.axialError, 0, 2e-16,
      'reported right capture residual');
  }
  disposeModel(model.root);
});

test('movement 399 update moves only rigid groups and applies both solved counter-rotations', () => {
  const model = createMovementModel(catalog.movements[398]);
  const data = model.root.userData;
  const { blocks, stateAtTime, timeline } = data;

  for (const phase of [0, 0.07, 0.25, 0.44, 0.5, 0.71, 0.93, 1]) {
    const time = timeline.cycleDuration * phase;
    const expected = stateAtTime(time);
    model.update(time, 0);
    near(blocks.topHalf.position.y, expected.upperEndY, 0,
      'rendered upper half position');
    near(blocks.bottomHalf.position.y, expected.lowerEndY, 0,
      'rendered lower half position');
    near(blocks.leftNut.position.y, expected.leftNutCenterY, 0,
      'rendered left nut position');
    near(blocks.rightNut.position.y, expected.rightNutCenterY, 0,
      'rendered right nut position');
    near(blocks.leftNut.rotation.y, expected.leftNutAngle, 0,
      'rendered left nut angle');
    near(blocks.rightNut.rotation.y, expected.rightNutAngle, 0,
      'rendered right nut angle');
    near(blocks.topHalf.rotation.x, 0, 0,
      'upper half remains unrotated about x');
    near(blocks.topHalf.rotation.y, 0, 0,
      'upper half remains unrotated about y');
    near(blocks.topHalf.rotation.z, 0, 0,
      'upper half remains unrotated about z');
    near(blocks.bottomHalf.rotation.x, 0, 0,
      'lower half remains unrotated about x');
    near(blocks.bottomHalf.rotation.y, 0, 0,
      'lower half remains unrotated about y');
    near(blocks.bottomHalf.rotation.z, 0, 0,
      'lower half remains unrotated about z');
  }
  disposeModel(model.root);
});
