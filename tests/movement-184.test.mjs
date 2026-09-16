import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

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

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vector2Near(actual, expected, tolerance, message) {
  const actual2 = new THREE.Vector2(actual.x, actual.y);
  const expected2 = new THREE.Vector2(expected.x, expected.y);
  assert.ok(
    actual2.distanceTo(expected2) <= tolerance,
    `${message}: expected ${expected2.toArray()}, received ${actual2.toArray()}`,
  );
}

function vector3Near(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function rotateVector2(vector, angle) {
  return new THREE.Vector2(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  );
}

function worldPoint(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function comparePhysicalStates(actual, expected, label) {
  for (const key of [
    'bottomLatchEngagement',
    'bottomLatchGap',
    'lowerEductionOpenFraction',
    'lowerHandleAngle',
    'lowerHandleAngularAcceleration',
    'lowerHandleAngularVelocity',
    'lowerSteamOpenFraction',
    'lowerTappetContactError',
    'pistonAcceleration',
    'topLatchEngagement',
    'topLatchGap',
    'topStateAcceleration',
    'topStateBlend',
    'topStateVelocity',
    'upperEductionOpenFraction',
    'upperHandleAngle',
    'upperHandleAngularAcceleration',
    'upperHandleAngularVelocity',
    'upperSteamOpenFraction',
    'upperTappetContactError',
  ]) {
    near(actual[key], expected[key], 2e-14, `${label} ${key}`);
  }
  for (const key of [
    'activeContact',
    'activeQuadrantLatch',
    'lowerHandleContactParameter',
    'stage',
    'upperHandleContactParameter',
  ]) {
    assert.equal(actual[key], expected[key], `${label} ${key}`);
  }
  for (const key of [
    'activeContactPoint',
    'lowerBottomHookPoint',
    'lowerHandleContactAcceleration',
    'lowerHandleContactLocalPoint',
    'lowerHandleContactPoint',
    'lowerHandleContactVelocity',
    'lowerTopSeatPoint',
    'lowerWeightAcceleration',
    'lowerWeightPin',
    'lowerWeightVelocity',
    'pistonPosition',
    'pistonVelocity',
    'upperBottomSeatPoint',
    'upperHandleContactAcceleration',
    'upperHandleContactLocalPoint',
    'upperHandleContactPoint',
    'upperHandleContactVelocity',
    'upperTopHookPoint',
    'upperWeightAcceleration',
    'upperWeightPin',
    'upperWeightVelocity',
  ]) {
    if (actual[key] === null || expected[key] === null) {
      assert.equal(actual[key], expected[key], `${label} ${key}`);
    } else {
      vector3Near(actual[key], expected[key], 2e-14, `${label} ${key}`);
    }
  }
}

test('movement 184 preserves the shifted top-pose illustration and prescribed return cycle', () => {
  const movement = catalog.movements[183];
  const model = createMovementModel(movement);
  assert.equal(model.root.userData.hideGround, true);
  const movement183 = createMovementModel(catalog.movements[182]);
  const {
    baseStateAtCyclePhase,
    blocks,
    canonicalStates,
    cyclePhaseToBasePhase,
    geometry,
    source184PointToModel,
    sourceVectorToModel,
    stateAtCyclePhase,
    stateAtTime,
    topStateLawAtCyclePhase,
  } = model.root.userData;
  const {
    bottomLatchMarker,
    lowerHandle,
    lowerHandleWeightAnchor,
    lowerPivot,
    lowerQuadrant,
    lowerWeightRod,
    pistonGroup,
    tappet,
    tappetAnchor,
    tappetContactMarker,
    topLatchMarker,
    upperHandle,
    upperHandleContactAnchor,
    upperHandleWeightAnchor,
    upperHandleWorkingTip,
    upperPivot,
    upperQuadrant,
    upperWeightRod,
  } = blocks;

  assert.equal(movement.id, 184);
  assert.equal(movement.number, '184');
  assert.equal(
    movement.title,
    'Two-Quadrant Blowing-Engine Hand Gear — Top-of-Cylinder Position',
  );
  assert.equal(movement.category, 'Steam engines');
  assert.equal(
    movement.description,
    '183 and 184. represent a modification of 181 and 182, the diagonal catches being superseded by two quadrants.',
  );
  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_184.html');
  assert.equal(
    movement.archetype,
    'double-backweighted-valve-handles-mutually-latching-quadrants-piston-tappet-position-184',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'top-position-descending-piston-tappet-trips-upper-quadrant-handle-releases-lower-backweighted-quadrant-handle-and-restores-four-valves',
  );
  assert.equal(
    model.root.userData.variant,
    'source-184-top-of-cylinder-initial-pose',
  );
  assert.equal(model.root.userData.materialsIgnoreSceneFog, true);
  for (const fn of [
    baseStateAtCyclePhase,
    cyclePhaseToBasePhase,
    source184PointToModel,
    sourceVectorToModel,
    stateAtCyclePhase,
    stateAtTime,
    topStateLawAtCyclePhase,
  ]) {
    assert.equal(typeof fn, 'function');
  }

  // This is the same two-axis, two-quadrant mechanism as 183. The variant is
  // only a public-cycle phase shift; it must not grow a diagonal or third catch.
  const fixedHandlePivots = [];
  const rigidQuadrants = [];
  const diagonalCatchParts = [];
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (role.startsWith('fixed-') && role.endsWith('-quadrant-handle-pivot')) {
      fixedHandlePivots.push(object);
    }
    if (role.endsWith('-rigid-hollow-quadrant')) rigidQuadrants.push(object);
    if (role.includes('diagonal-catch')) diagonalCatchParts.push(object);
  });
  assert.deepEqual(fixedHandlePivots, [upperPivot, lowerPivot]);
  assert.deepEqual(rigidQuadrants, [upperQuadrant, lowerQuadrant]);
  assert.deepEqual(diagonalCatchParts, []);
  assert.equal(upperQuadrant.parent, upperHandle);
  assert.equal(lowerQuadrant.parent, lowerHandle);
  assert.equal(upperPivot.parent, model.root);
  assert.equal(lowerPivot.parent, model.root);

  assert.equal(geometry.movementId, 184);
  near(geometry.initialBasePhase, 0.48, 0, 'source 184 initial base phase');
  near(geometry.publicBasePhaseWrap, 0.52, 0,
    'source 184 hidden base-phase wrap');
  assert.deepEqual(geometry.source184UpperPivot.toArray(), [277, 96]);
  assert.deepEqual(geometry.source184LowerPivot.toArray(), [281, 320]);
  assert.deepEqual(geometry.source184TappetCenter.toArray(), [180, 87]);
  assert.deepEqual(geometry.source184UpperWeightPin.toArray(), [377, 201]);
  assert.deepEqual(geometry.source184LowerWeightPin.toArray(), [181, 238]);
  assert.deepEqual(geometry.source184UpperFreeTip.toArray(), [84, 145]);
  assert.deepEqual(geometry.source184UpperContact.toArray(), [177, 145]);
  assert.deepEqual(geometry.source184TopLatchPoint.toArray(), [347, 218]);
  near(geometry.source184PistonY, 1.5125, 1e-14,
    'source 184 piston height');
  near(geometry.source184UpperAngle, -1.4014694007142283, 1e-15,
    'source 184 upper-handle angle');
  near(geometry.source184LowerAngle, -1.1361805161720548, 1e-15,
    'source 184 lower-handle angle');
  assert.deepEqual(geometry.publicSequenceBreaks, {
    source183HoldEnd: 0.6000000000000001,
    upwardApproachEnd: 0.72,
    lowerTripEnd: 0.8600000000000001,
    upwardOvertravelEnd: 0.96,
    source184HoldEnd: 0.040000000000000036,
    downwardApproachEnd: 0.16000000000000003,
    upperTripEnd: 0.30000000000000004,
    downwardOvertravelEnd: 0.44000000000000006,
  });

  const initial = stateAtCyclePhase(0);
  const source184 = canonicalStates.source184Top;
  comparePhysicalStates(initial, source184, 'initial source-184 pose');
  comparePhysicalStates(
    initial,
    movement183.root.userData.baseStateAtCyclePhase(0.48),
    'initial state equals movement 183 at base phase 0.48',
  );
  near(initial.basePhase, 0.48, 0, 'initial public/base mapping');
  near(initial.pistonPosition.y, geometry.source184PistonY, 0,
    'initial piston is at the top of the cylinder');
  near(initial.upperHandleAngle, geometry.source184UpperAngle, 1e-15,
    'initial upper handle matches source 184');
  near(initial.lowerHandleAngle, geometry.source184LowerAngle, 1e-15,
    'initial lower handle matches source 184');
  near(initial.topLatchGap, 0, 3e-15,
    'upper quadrant initially retains the lower handle');
  assert.ok(initial.bottomLatchGap > 3.47,
    'lower quadrant is clear of the upper handle at the top pose');
  near(initial.topLatchEngagement, 1, 0, 'top quadrant initially engaged');
  near(initial.bottomLatchEngagement, 0, 0,
    'bottom quadrant initially disengaged');
  near(initial.upperSteamOpenFraction, 1, 0,
    'upper steam valve initially open');
  near(initial.lowerEductionOpenFraction, 1, 0,
    'lower eduction valve initially open');
  near(initial.lowerSteamOpenFraction, 0, 0,
    'lower steam valve initially shut');
  near(initial.upperEductionOpenFraction, 0, 0,
    'upper eduction valve initially shut');
  vector2Near(
    initial.upperWeightPin.clone().sub(geometry.upperPivot).normalize(),
    sourceVectorToModel(
      geometry.source184UpperWeightPin,
      geometry.source184UpperPivot,
    ).normalize(),
    1e-14,
    'initial upper back-weight direction',
  );
  vector2Near(
    initial.lowerWeightPin.clone().sub(geometry.lowerPivot).normalize(),
    sourceVectorToModel(
      geometry.source184LowerWeightPin,
      geometry.source184LowerPivot,
    ).normalize(),
    1e-14,
    'initial lower back-weight direction',
  );

  const upperTrip = stateAtCyclePhase(0.23);
  assert.equal(upperTrip.stage,
    'descending-tappet-trips-upper-quadrant-and-releases-lower');
  assert.equal(upperTrip.activeContact, 'upper-quadrant-handle');
  assert.ok(upperTrip.pistonVelocity.y < 0);
  near(upperTrip.upperTappetContactError, 0, 2e-14,
    'descending tappet remains on the upper curved face');
  const source183Bottom = stateAtCyclePhase(0.48);
  near(source183Bottom.topStateBlend, 0, 0,
    'descending trip restores source 183 valve state');
  near(source183Bottom.pistonPosition.y, geometry.source183PistonY, 0,
    'descending stroke reaches source 183 piston position');
  assert.equal(source183Bottom.activeQuadrantLatch,
    'lower-quadrant-retains-upper-handle');
  const lowerTrip = stateAtCyclePhase(0.79);
  assert.equal(lowerTrip.stage,
    'ascending-tappet-trips-lower-quadrant-and-releases-upper');
  assert.equal(lowerTrip.activeContact, 'lower-quadrant-handle');
  assert.ok(lowerTrip.pistonVelocity.y > 0);
  near(lowerTrip.lowerTappetContactError, 0, 2e-14,
    'ascending tappet remains on the lower curved face');

  // Exhaustively prove that 184 is exactly the audited 183 physical cycle,
  // re-anchored at the source-184 top pose without timing or contact changes.
  const sampleCount = 32768;
  const stageOrder = [];
  let previousStage;
  let upperTripSamples = 0;
  let lowerTripSamples = 0;
  let maximumUpperContactError = 0;
  let maximumLowerContactError = 0;
  let maximumUpperRadiusError = 0;
  let maximumLowerRadiusError = 0;
  let minimumPistonY = Infinity;
  let maximumPistonY = -Infinity;
  for (let index = 0; index <= sampleCount; index += 1) {
    const phase = index / sampleCount;
    const state = stateAtCyclePhase(phase);
    const expectedBasePhase = cyclePhaseToBasePhase(phase);
    const baseState = baseStateAtCyclePhase(expectedBasePhase);
    const movement183State = movement183.root.userData
      .baseStateAtCyclePhase(expectedBasePhase);
    near(state.basePhase, expectedBasePhase, 0,
      `public/base phase mapping at ${phase}`);
    comparePhysicalStates(state, baseState, `own base state at ${phase}`);
    comparePhysicalStates(state, movement183State,
      `movement 183 physical state at ${phase}`);
    if (state.stage !== previousStage) {
      stageOrder.push(state.stage);
      previousStage = state.stage;
    }
    for (const value of [
      state.bottomLatchEngagement,
      state.bottomLatchGap,
      state.lowerEductionOpenFraction,
      state.lowerHandleAngle,
      state.lowerHandleAngularAcceleration,
      state.lowerHandleAngularVelocity,
      state.lowerSteamOpenFraction,
      state.pistonAcceleration,
      state.pistonPosition.y,
      state.pistonVelocity.y,
      state.topLatchEngagement,
      state.topLatchGap,
      state.topStateAcceleration,
      state.topStateBlend,
      state.topStateVelocity,
      state.upperEductionOpenFraction,
      state.upperHandleAngle,
      state.upperHandleAngularAcceleration,
      state.upperHandleAngularVelocity,
      state.upperSteamOpenFraction,
      ...state.upperWeightPin.toArray(),
      ...state.lowerWeightPin.toArray(),
      ...state.upperHandleContactPoint.toArray(),
      ...state.lowerHandleContactPoint.toArray(),
    ]) {
      assert.equal(Number.isFinite(value), true,
        `finite public-cycle value at ${phase}`);
    }
    assert.ok(state.topStateBlend >= -1e-15
      && state.topStateBlend <= 1 + 1e-15);
    near(state.bottomLatchEngagement + state.topLatchEngagement, 1, 1e-14,
      `one complementary quadrant latch at ${phase}`);
    near(state.upperSteamOpenFraction + state.lowerSteamOpenFraction, 1, 1e-14,
      `steam valves complementary at ${phase}`);
    near(state.upperEductionOpenFraction + state.lowerEductionOpenFraction,
      1, 1e-14, `eduction valves complementary at ${phase}`);
    near(state.upperSteamOpenFraction, state.lowerEductionOpenFraction, 1e-14,
      `upper-steam/lower-eduction pair at ${phase}`);
    near(state.lowerSteamOpenFraction, state.upperEductionOpenFraction, 1e-14,
      `lower-steam/upper-eduction pair at ${phase}`);
    minimumPistonY = Math.min(minimumPistonY, state.pistonPosition.y);
    maximumPistonY = Math.max(maximumPistonY, state.pistonPosition.y);
    maximumUpperRadiusError = Math.max(
      maximumUpperRadiusError,
      Math.abs(
        state.upperWeightPin.distanceTo(geometry.upperPivot)
          - geometry.upperWeightLocal.length(),
      ),
    );
    maximumLowerRadiusError = Math.max(
      maximumLowerRadiusError,
      Math.abs(
        state.lowerWeightPin.distanceTo(geometry.lowerPivot)
          - geometry.lowerWeightLocal.length(),
      ),
    );
    if (state.activeContact === 'upper-quadrant-handle') {
      upperTripSamples += 1;
      maximumUpperContactError = Math.max(
        maximumUpperContactError,
        Math.abs(state.upperTappetContactError),
      );
      near(state.upperTappetContactError, 0, 2e-14,
        `descending upper-face contact at ${phase}`);
      assert.ok(state.pistonVelocity.y <= 1e-13);
      assert.ok(state.activeContactPoint.x >= geometry.tappetShoeLeftX - 1e-12);
      assert.ok(state.activeContactPoint.x <= geometry.tappetShoeRightX + 1e-12);
      assert.ok(state.upperHandleContactParameter >= 0);
      assert.ok(state.upperHandleContactParameter <= 1);
      vector2Near(
        geometry.upperPivot.clone().add(rotateVector2(
          state.upperHandleContactLocalPoint,
          state.upperHandleAngle,
        )),
        state.activeContactPoint,
        2e-14,
        `sliding upper-face material point at ${phase}`,
      );
    } else if (state.activeContact === 'lower-quadrant-handle') {
      lowerTripSamples += 1;
      maximumLowerContactError = Math.max(
        maximumLowerContactError,
        Math.abs(state.lowerTappetContactError),
      );
      near(state.lowerTappetContactError, 0, 2e-14,
        `ascending lower-face contact at ${phase}`);
      assert.ok(state.pistonVelocity.y >= -1e-13);
      assert.ok(state.activeContactPoint.x >= geometry.tappetShoeLeftX - 1e-12);
      assert.ok(state.activeContactPoint.x <= geometry.tappetShoeRightX + 1e-12);
      assert.ok(state.lowerHandleContactParameter >= 0);
      assert.ok(state.lowerHandleContactParameter <= 1);
      vector2Near(
        geometry.lowerPivot.clone().add(rotateVector2(
          state.lowerHandleContactLocalPoint,
          state.lowerHandleAngle,
        )),
        state.activeContactPoint,
        2e-14,
        `sliding lower-face material point at ${phase}`,
      );
    } else {
      assert.equal(state.activeContactPoint, null);
    }
  }
  assert.deepEqual(stageOrder, [
    'source-184-top-of-cylinder-pose-hold',
    'descending-tappet-approaches-upper-quadrant-handle',
    'descending-tappet-trips-upper-quadrant-and-releases-lower',
    'descending-after-quadrant-transfer-to-bottom',
    'source-183-returned-pose-hold',
    'source-183-ascending-stroke-pose-hold',
    'ascending-tappet-approaches-lower-quadrant-handle',
    'ascending-tappet-trips-lower-quadrant-and-releases-upper',
    'ascending-after-quadrant-transfer-to-top',
    'source-184-top-of-cylinder-pose-hold',
  ]);
  assert.ok(upperTripSamples > 4500);
  assert.ok(lowerTripSamples > 4500);
  near(minimumPistonY, geometry.source183PistonY, 0,
    'cycle reaches source 183 piston endpoint');
  near(maximumPistonY, geometry.source184PistonY, 0,
    'cycle reaches source 184 piston endpoint');
  assert.ok(maximumUpperContactError < 2e-14);
  assert.ok(maximumLowerContactError < 2e-14);
  assert.ok(maximumUpperRadiusError < 7e-16);
  assert.ok(maximumLowerRadiusError < 7e-16);

  // The phase shift remains C2 at all public events and at the hidden wrap.
  const boundaryPhases = [...new Set([
    0,
    ...Object.values(geometry.publicSequenceBreaks),
    geometry.publicBasePhaseWrap,
    1,
  ])].sort((a, b) => a - b);
  for (const phase of boundaryPhases) {
    const state = stateAtCyclePhase(phase);
    near(state.pistonVelocity.y, 0, 1e-13,
      `zero piston velocity at public boundary ${phase}`);
    near(state.pistonAcceleration, 0, 1e-12,
      `zero piston acceleration at public boundary ${phase}`);
    near(state.upperHandleAngularVelocity, 0, 1e-13,
      `zero upper velocity at public boundary ${phase}`);
    near(state.upperHandleAngularAcceleration, 0, 1e-12,
      `zero upper acceleration at public boundary ${phase}`);
    near(state.lowerHandleAngularVelocity, 0, 1e-13,
      `zero lower velocity at public boundary ${phase}`);
    near(state.lowerHandleAngularAcceleration, 0, 1e-12,
      `zero lower acceleration at public boundary ${phase}`);
  }
  comparePhysicalStates(stateAtCyclePhase(1), stateAtCyclePhase(0),
    'closed public cycle');

  const derivativeSamples = 4096;
  const timeStep = 1e-4;
  let maximumPistonVelocityError = 0;
  let maximumPistonAccelerationError = 0;
  let maximumUpperVelocityError = 0;
  let maximumUpperAccelerationError = 0;
  let maximumLowerVelocityError = 0;
  let maximumLowerAccelerationError = 0;
  for (let index = 0; index < derivativeSamples; index += 1) {
    const time = geometry.cyclePeriod * (index + 0.371) / derivativeSamples;
    const phase = time / geometry.cyclePeriod;
    const phaseMargin = timeStep * 4 / geometry.cyclePeriod;
    if (
      phase < phaseMargin
      || phase > 1 - phaseMargin
      || boundaryPhases.some((boundary) => (
        Math.abs(phase - boundary) < phaseMargin
      ))
    ) {
      continue;
    }
    const before = stateAtTime(time - timeStep);
    const state = stateAtTime(time);
    const after = stateAtTime(time + timeStep);
    maximumPistonVelocityError = Math.max(
      maximumPistonVelocityError,
      Math.abs(
        (after.pistonPosition.y - before.pistonPosition.y) / (2 * timeStep)
          - state.pistonVelocity.y,
      ),
    );
    maximumPistonAccelerationError = Math.max(
      maximumPistonAccelerationError,
      Math.abs(
        (after.pistonVelocity.y - before.pistonVelocity.y) / (2 * timeStep)
          - state.pistonAcceleration,
      ),
    );
    maximumUpperVelocityError = Math.max(
      maximumUpperVelocityError,
      Math.abs(
        (after.upperHandleAngle - before.upperHandleAngle) / (2 * timeStep)
          - state.upperHandleAngularVelocity,
      ),
    );
    maximumUpperAccelerationError = Math.max(
      maximumUpperAccelerationError,
      Math.abs(
        (after.upperHandleAngularVelocity - before.upperHandleAngularVelocity)
          / (2 * timeStep) - state.upperHandleAngularAcceleration,
      ),
    );
    maximumLowerVelocityError = Math.max(
      maximumLowerVelocityError,
      Math.abs(
        (after.lowerHandleAngle - before.lowerHandleAngle) / (2 * timeStep)
          - state.lowerHandleAngularVelocity,
      ),
    );
    maximumLowerAccelerationError = Math.max(
      maximumLowerAccelerationError,
      Math.abs(
        (after.lowerHandleAngularVelocity - before.lowerHandleAngularVelocity)
          / (2 * timeStep) - state.lowerHandleAngularAcceleration,
      ),
    );
  }
  assert.ok(maximumPistonVelocityError < 5e-7);
  assert.ok(maximumPistonAccelerationError < 2e-6);
  assert.ok(maximumUpperVelocityError < 2e-7);
  assert.ok(maximumUpperAccelerationError < 5e-7);
  assert.ok(maximumLowerVelocityError < 2e-7);
  assert.ok(maximumLowerAccelerationError < 5e-7);

  // Audit the rendered initial source pose, both trips, and exact return.
  model.root.updateMatrixWorld(true);
  const fixedPivotMatrices = [upperPivot, lowerPivot].map(
    (pivot) => pivot.matrix.clone(),
  );
  const expectedUpperFreeVector = sourceVectorToModel(
    geometry.source184UpperFreeTip,
    geometry.source184UpperPivot,
  );
  vector3Near(
    worldPoint(upperHandleWorkingTip),
    new THREE.Vector3(
      geometry.upperPivot.x + expectedUpperFreeVector.x,
      geometry.upperPivot.y + expectedUpperFreeVector.y,
      geometry.upperHandlePlaneZ,
    ),
    1e-11,
    'initial rendered upper free tip matches source 184',
  );
  vector3Near(
    worldPoint(upperHandleContactAnchor),
    new THREE.Vector3(
      source184.upperHandleContactPoint.x,
      source184.upperHandleContactPoint.y,
      geometry.upperHandlePlaneZ,
    ),
    1e-11,
    'initial upper contact anchor matches source 184',
  );
  vector3Near(
    worldPoint(upperHandleWeightAnchor),
    new THREE.Vector3(
      source184.upperWeightPin.x,
      source184.upperWeightPin.y,
      geometry.upperHandlePlaneZ,
    ),
    1e-12,
    'initial upper weight pin matches source 184 registration',
  );
  vector2Near(
    worldPoint(lowerHandleWeightAnchor).sub(new THREE.Vector3(
      geometry.lowerPivot.x,
      geometry.lowerPivot.y,
      geometry.lowerHandlePlaneZ,
    )).normalize(),
    sourceVectorToModel(
      geometry.source184LowerWeightPin,
      geometry.source184LowerPivot,
    ).normalize(),
    1e-12,
    'initial lower weight direction matches source 184',
  );
  vector3Near(worldPoint(tappetAnchor), source184.pistonPosition, 1e-14,
    'initial rendered tappet is at the top source position');
  near(upperHandle.rotation.z, geometry.source184UpperAngle, 1e-15,
    'initial rendered upper angle');
  near(lowerHandle.rotation.z, geometry.source184LowerAngle, 1e-15,
    'initial rendered lower angle');
  near(pistonGroup.position.y, geometry.source184PistonY, 1e-15,
    'initial rendered piston height');
  assert.equal(bottomLatchMarker.visible, false);
  assert.equal(topLatchMarker.visible, false);
  assert.equal(tappetContactMarker.visible, false);
  near(upperWeightRod.rotation.z, 0, 0, 'upper weight rod remains vertical');
  near(lowerWeightRod.rotation.z, 0, 0, 'lower weight rod remains vertical');

  model.update(0.23 * geometry.cyclePeriod, 0);
  model.root.updateMatrixWorld(true);
  assert.equal(model.root.userData.contacts.activeTappetContact,
    'upper-quadrant-handle');
  assert.equal(tappetContactMarker.visible, false);
  vector3Near(
    tappetContactMarker.position,
    new THREE.Vector3(
      upperTrip.activeContactPoint.x,
      upperTrip.activeContactPoint.y,
      geometry.lowerQuadrantPlaneZ + geometry.lowerQuadrantDepth / 2 + 0.18,
    ),
    1e-14,
    'upper-trip marker follows exact descending contact',
  );
  for (const [pivot, matrix] of [upperPivot, lowerPivot].map(
    (pivot, index) => [pivot, fixedPivotMatrices[index]],
  )) {
    assert.deepEqual(pivot.matrix.elements, matrix.elements,
      `${pivot.userData.role} remains fixed during descending trip`);
  }

  model.update(0.48 * geometry.cyclePeriod, 0);
  near(model.root.userData.kinematics.topStateBlend, 0, 0,
    'rendered descending stroke reaches source 183');
  assert.equal(bottomLatchMarker.visible, false);
  assert.equal(topLatchMarker.visible, false);
  assert.equal(tappetContactMarker.visible, false);

  model.update(0.79 * geometry.cyclePeriod, 0);
  model.root.updateMatrixWorld(true);
  assert.equal(model.root.userData.contacts.activeTappetContact,
    'lower-quadrant-handle');
  assert.equal(tappetContactMarker.visible, false);
  vector3Near(
    tappetContactMarker.position,
    new THREE.Vector3(
      lowerTrip.activeContactPoint.x,
      lowerTrip.activeContactPoint.y,
      geometry.lowerQuadrantPlaneZ + geometry.lowerQuadrantDepth / 2 + 0.18,
    ),
    1e-14,
    'lower-trip marker follows exact ascending contact',
  );

  model.update(geometry.cyclePeriod, 0);
  model.root.updateMatrixWorld(true);
  vector3Near(worldPoint(tappetAnchor), source184.pistonPosition, 1e-14,
    'one public cycle returns exactly to source 184');
  assert.equal(bottomLatchMarker.visible, false);
  assert.equal(topLatchMarker.visible, false);
  assert.equal(tappetContactMarker.visible, false);

  const frameFrontZ = geometry.frameCenterZ + geometry.frameDepth / 2;
  const handleBottomZ = geometry.upperHandlePlaneZ - geometry.handleDepth / 2;
  const handleTopZ = geometry.lowerHandlePlaneZ + geometry.handleDepth / 2;
  const upperQuadrantBottomZ = geometry.upperQuadrantPlaneZ
    - geometry.upperQuadrantDepth / 2;
  const upperQuadrantTopZ = geometry.upperQuadrantPlaneZ
    + geometry.upperQuadrantDepth / 2;
  const lowerQuadrantBottomZ = geometry.lowerQuadrantPlaneZ
    - geometry.lowerQuadrantDepth / 2;
  const lowerQuadrantTopZ = geometry.lowerQuadrantPlaneZ
    + geometry.lowerQuadrantDepth / 2;
  const weightBottomZ = geometry.weightForegroundZ - 0.12;
  assert.ok(handleBottomZ > frameFrontZ,
    'both handles clear the fixed rear frame');
  assert.ok(handleTopZ < upperQuadrantBottomZ,
    'upper quadrant clears its handle plate');
  assert.ok(upperQuadrantTopZ < lowerQuadrantBottomZ,
    'crossing quadrants remain in separate depth layers');
  assert.ok(lowerQuadrantTopZ < weightBottomZ,
    'foreground weights clear both quadrants');
  assert.ok(tappet.geometry.parameters.depth > geometry.handleDepth,
    'projecting tappet spans the handle contact plane');
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 4.65, 'source-184 mechanism spans the engraving width');
  assert.ok(size.y > 7.14, 'source-184 mechanism spans the engraving height');
  assert.ok(size.z > 1.64, 'all audited depth layers occupy real 3D space');
  assert.ok(bounds.min.z < -0.73);
  assert.ok(bounds.max.z > 0.90);
  near(model.root.userData.cameraDistanceScale, .88, 0,
    'portrait source camera scale');
  assert.equal(model.cameraDirection.x, 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 3);

  // Sequential review continues independently: 185 is now a locomotive
  // Stephenson link rather than another variant of this quadrant hand gear.
  const movement185 = createMovementModel(catalog.movements[184]);
  assert.equal(catalog.movements[182].fidelity, 'authored');
  assert.equal(movement183.root.userData.fidelity, 'authored');
  assert.equal(catalog.movements[184].fidelity, 'authored');
  assert.equal(movement185.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement185.root.userData.mechanism,
    model.root.userData.mechanism,
  );

  disposeModel(movement185.root);
  disposeModel(movement183.root);
  disposeModel(model.root);
});
