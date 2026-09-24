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

test('movement 398 is one cam, one roller crosshead, one finite rod, and one rocking output wheel', () => {
  const movement = catalog.movements[397];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 398);
  assert.equal(movement.number, '398');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.archetype,
    'constant-speed-three-sided-disc-cam-driving-horizontal-roller-crosshead-finite-rod-and-intermittently-rocking-wheel');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.match(data.archetype, /three-sided-disc-cam/);
  assert.match(data.mechanism, /one-constant-speed-clockwise/);
  assert.match(data.mechanism, /one-horizontal-roller-crosshead/);
  assert.match(data.mechanism, /single-finite-rod/);
  assert.match(data.mechanism, /one-fixed-axis-output-wheel/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(blocks.cam.parent, model.root);
  assert.equal(blocks.follower.parent, model.root);
  assert.equal(blocks.connectingRod.parent, model.root);
  assert.equal(blocks.outputWheel.parent, model.root);
  assert.equal(blocks.guides.length, 2);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'constant-speed-clockwise-disc-cam-with-rounded-three-sided-groove',
    'single-solid-input-cam-disc',
    'cam-contact-roller-constrained-to-horizontal-line',
    'one-piece-horizontal-roller-crosshead-and-rod-pivot-carriage',
    'single-finite-connecting-rod-from-crosshead-to-output-crank',
    'intermittently-rocking-output-wheel-with-offset-crank-pin',
    'output-crank-pin-driven-by-finite-rod',
  ]) assert.ok(roles.includes(role), role);
  // Brown draws no white indices; the source presentation detaches them.
  assert.ok(!roles.some((role) => /^white-/.test(role)), 'no white indices remain');
  assert.equal(blocks.cam.userData.contactEdges.length, 1);
  assert.equal(blocks.cam.userData.offsetEdges.length, 1);
  disposeModel(model.root);
});

test('movement 398 reproduces the official canvas dimensions and discloses only display additions', () => {
  const movement = catalog.movements[397];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, geometry, sourceAnimation, sourceReference } = data;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_398.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Continuous circular motion into intermittent circular/);
  assert.match(movement.description, /cam, C, being the driver/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.canvasGeometryReproduced, true);
  assert.equal(sourceAnimation.independentlyReconstructed, false);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(geometry.sourceContactArcs.length, 6);
  assert.deepEqual(geometry.sourceContactArcs[0], [
    4, -7.949994, 1.982629, 6, 5.635297, 0.001357,
  ]);
  assert.deepEqual(geometry.sourceGuideStart.toArray(), [15.5, 0]);
  assert.deepEqual(geometry.sourceGuideEnd.toArray(), [0.5, 0]);
  near(geometry.sourceRollerRadius, 0.25, 0, 'source roller radius');
  near(geometry.sourceFollowerPivotOffset, 8.197955, 0,
    'source crosshead pivot offset');
  near(geometry.sourceConnectingRodLength, 8, 0,
    'source connecting-rod length');
  nearVector(geometry.sourceOutputCenter,
    new THREE.Vector2(19.070509, 0), 0, 'source output center');
  nearVector(geometry.sourceOutputCrankVector,
    new THREE.Vector2(-1.459783, 0.531318), 0,
    'source output crank vector');
  assert.equal(
    sourceReference.constructionEvidence.explicitInBrownDescription.length,
    3,
  );
  assert.match(
    sourceReference.constructionEvidence.officialAnimationEvidence,
    /one clockwise rotating cam/,
  );
  assert.match(
    sourceReference.constructionEvidence.reproductionDisclosure,
    /reproduced numerically from the official canvas model/,
  );
  assert.match(
    sourceReference.constructionEvidence.reproductionDisclosure,
    /uniform scene scale, translation, depth, materials, and demonstration period/,
  );
  disposeModel(model.root);
});

test('movement 398 cam makes exactly one clockwise revolution at constant speed per cycle', () => {
  const model = createMovementModel(catalog.movements[397]);
  const { stateAtTime, timeline } = model.root.userData;
  const expectedSpeed = -FULL_TURN / timeline.cycleDuration;

  for (let sample = -12000; sample <= 24000; sample += 1) {
    const state = stateAtTime(
      timeline.cycleDuration * sample / 12000,
    );
    near(state.camAngularSpeed, expectedSpeed, 0,
      'constant clockwise cam speed');
    near(state.camAngle, -FULL_TURN * state.cycleCoordinate, 0,
      'unwrapped cam angle');
  }
  for (const phase of [-2.41, -0.18, 0.27, 0.93, 3.12]) {
    const start = stateAtTime(timeline.cycleDuration * phase);
    const end = stateAtTime(timeline.cycleDuration * (phase + 1));
    near(end.camAngle - start.camAngle, -FULL_TURN, 8e-15,
      'one clockwise revolution per cycle');
    nearVector(end.rollerCenterWorld, start.rollerCenterWorld, 5e-15,
      'cam/follower cycle closure');
    near(end.outputRotorAngle, start.outputRotorAngle, 6e-15,
      'output angle cycle closure');
  }
  disposeModel(model.root);
});

test('movement 398 roller remains on its horizontal guide and in exact circular-arc contact', () => {
  const model = createMovementModel(catalog.movements[397]);
  const data = model.root.userData;
  const { stateAtTime, timeline } = data;
  const activeArcs = new Set();
  const contactKinds = new Set();
  let maximumContactError = 0;

  for (let sample = 0; sample <= 36000; sample += 1) {
    const state = stateAtTime(
      timeline.cycleDuration * sample / 36000,
    );
    near(state.rollerCenterWorld.y, 0, 0,
      'roller guide centerline');
    near(state.followerPivotWorld.y, 0, 0,
      'crosshead rod pin guide centerline');
    near(
      state.followerPivotWorld.x - state.rollerCenterWorld.x,
      data.geometry.sourceFollowerPivotOffset * data.geometry.sourceScale,
      9e-16,
      'rigid roller-to-crosshead-pin offset',
    );
    maximumContactError = Math.max(
      maximumContactError,
      Math.abs(state.camRollerCenterDistanceError),
    );
    activeArcs.add(state.activeCamArcIndex);
    contactKinds.add(state.camContactKind);
  }
  assert.ok(maximumContactError < 2e-15,
    `maximum cam-contact residual ${maximumContactError}`);
  assert.deepEqual([...activeArcs].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
  assert.ok(contactKinds.has('internal-circle-tangency'));
  assert.ok(contactKinds.has('external-circle-tangency'));
  assert.ok(contactKinds.has('arc-endpoint-to-roller-circle'));
  disposeModel(model.root);
});

test('movement 398 finite rod and fixed-radius output crank close exactly at every phase', () => {
  const model = createMovementModel(catalog.movements[397]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const rodLength = geometry.sourceConnectingRodLength
    * geometry.sourceScale;

  for (let sample = -24000; sample <= 48000; sample += 1) {
    const state = stateAtTime(
      timeline.cycleDuration * sample / 24000,
    );
    near(
      state.followerPivotWorld.distanceTo(state.outputCrankPointWorld),
      rodLength,
      4e-15,
      'finite connecting-rod length',
    );
    near(
      state.outputCrankPointWorld.distanceTo(geometry.outputCenter),
      geometry.outputCrankRadius,
      5e-15,
      'fixed output-crank radius',
    );
  }
  disposeModel(model.root);
});

test('movement 398 agrees with the official canvas follower and output poses', () => {
  const model = createMovementModel(catalog.movements[397]);
  const { sourceStateAtPhase } = model.root.userData;
  const official = [
    [0, 12.547955, -2.443460],
    [1 / 24, 11.996254, -1.774581],
    [2 / 24, 10.684404, -0.879654],
    [3 / 24, 10.283748, -0.612570],
    [4 / 24, 10.166650, -0.527835],
    [5 / 24, 10.240511, -0.581798],
    [6 / 24, 10.560238, -0.799392],
    [7 / 24, 11.284533, -1.261645],
    [8 / 24, 11.547955, -1.437235],
    [9 / 24, 11.284534, -1.261646],
    [10 / 24, 10.786068, -0.944476],
    [11 / 24, 10.641969, -0.852387],
    [12 / 24, 10.750572, -0.921910],
    [13 / 24, 11.206960, -1.211552],
    [14 / 24, 12.327665, -2.099794],
    [15 / 24, 12.495238, -2.337751],
    [16 / 24, 11.138143, -1.167507],
    [17 / 24, 10.067313, -0.451817],
    [18 / 24, 9.746194, -0.155773],
    [19 / 24, 9.635223, -0.010719],
    [20 / 24, 9.656120, -0.041790],
    [21 / 24, 9.821602, -0.236049],
    [22 / 24, 10.269243, -0.602307],
    [23 / 24, 11.996254, -1.774581],
    [1, 12.547955, -2.443460],
  ];

  for (const [phase, followerPivotX, outputRotorAngle] of official) {
    const state = sourceStateAtPhase(phase);
    near(state.followerPivot.x, followerPivotX, 5.3e-7,
      `official follower checkpoint at phase ${phase}`);
    near(state.outputRotorAngle, outputRotorAngle, 5.3e-7,
      `official output checkpoint at phase ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 398 output rocks through 140 degrees with five reversals instead of making a false full turn', () => {
  const model = createMovementModel(catalog.movements[397]);
  const data = model.root.userData;
  const { motion, stateAtTime, timeline } = data;
  let minimumAngle = Infinity;
  let maximumAngle = -Infinity;
  let reversals = 0;
  let previousNonzeroSign = 0;

  for (let sample = 0; sample <= 24000; sample += 1) {
    const state = stateAtTime(
      timeline.cycleDuration * sample / 24000,
    );
    minimumAngle = Math.min(minimumAngle, state.outputRotorAngle);
    maximumAngle = Math.max(maximumAngle, state.outputRotorAngle);
    const sign = Math.abs(state.outputAngularSpeed) < 1e-5
      ? 0 : Math.sign(state.outputAngularSpeed);
    if (sign && previousNonzeroSign && sign !== previousNonzeroSign) {
      reversals += 1;
    }
    if (sign) previousNonzeroSign = sign;
  }
  near(minimumAngle, THREE.MathUtils.degToRad(-140), 8e-7,
    'minimum rocking angle');
  near(maximumAngle, 0, 8e-7, 'maximum rocking angle');
  near(maximumAngle - minimumAngle, THREE.MathUtils.degToRad(140),
    9e-7, 'rocking range');
  assert.equal(reversals, 5);
  assert.equal(motion.outputIsContinuousUnidirectionalRotation, false);
  assert.match(motion.outputCharacter, /alternating circular arcs/);
  disposeModel(model.root);
});

test('movement 398 update applies the solved cam, crosshead, rod, and wheel transforms', () => {
  const model = createMovementModel(catalog.movements[397]);
  const data = model.root.userData;
  const { blocks, stateAtTime, timeline } = data;

  for (const phase of [0, 0.071, 0.25, 0.417, 0.625, 0.806, 0.963, 1]) {
    const time = phase * timeline.cycleDuration;
    const expected = stateAtTime(time);
    model.update(time, 0);
    near(blocks.cam.rotation.z, expected.camAngle, 0,
      'rendered cam angle');
    near(blocks.follower.position.x, expected.rollerCenterWorld.x, 0,
      'rendered crosshead position');
    near(blocks.outputWheel.rotation.z, expected.outputRotorAngle, 0,
      'rendered output angle');
    near(data.contacts.connectingRodToOutputCrank.lengthError, 0, 4e-15,
      'rendered connecting-rod closure');
    near(data.contacts.camToFollowerRoller.centerDistanceError, 0, 2e-15,
      'rendered cam contact');
  }
  disposeModel(model.root);
});
