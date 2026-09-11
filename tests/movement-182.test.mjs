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

function worldPoint(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function comparePhysicalStates(actual, expected, phase) {
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (
      key === 'phase'
      || key === 'basePhase'
      || key === 'canonicalStage'
      || key === 'cyclePhase'
    ) continue;
    const actualValue = actual[key];
    if (expectedValue?.isVector2 || expectedValue?.isVector3) {
      assert.ok(
        actualValue.distanceTo(expectedValue) <= 2e-14,
        `${key} follows the base mechanism at public phase ${phase}`,
      );
    } else if (typeof expectedValue === 'number') {
      near(
        actualValue,
        expectedValue,
        2e-14,
        `${key} follows the base mechanism at public phase ${phase}`,
      );
    } else {
      assert.deepEqual(
        actualValue,
        expectedValue,
        `${key} follows the base mechanism at public phase ${phase}`,
      );
    }
  }
}

test('movement 182 starts at the top pose and the descending tappet restores movement 181 through the upper handle', () => {
  const movement = catalog.movements[181];
  const model = createMovementModel(movement);
  const movement181 = createMovementModel(catalog.movements[180]);
  const {
    baseStateAtCyclePhase,
    blocks,
    canonicalStates,
    catchLawAtCyclePhase,
    cyclePhaseToBasePhase,
    geometry,
    sourceVectorToModel,
    stateAtCyclePhase,
    stateAtTime,
    topStateLawAtCyclePhase,
  } = model.root.userData;
  const {
    catchGroup,
    catchPivot,
    catchWeightAnchor,
    catchWeightRod,
    lowerHandle,
    lowerHandleWeightAnchor,
    lowerLatchMarker,
    lowerPivot,
    lowerWeightRod,
    pistonGroup,
    tappet,
    tappetAnchor,
    tappetContactMarker,
    upperHandle,
    upperHandleContactAnchor,
    upperHandleWorkingTip,
    upperHandleWeightAnchor,
    upperLatchMarker,
    upperPivot,
    upperWeightRod,
  } = blocks;

  assert.equal(movement.id, 182);
  assert.equal(movement.number, '182');
  assert.equal(
    movement.title,
    'Diagonal-Catch Blowing-Engine Hand Gear — Top-of-Cylinder Position',
  );
  assert.equal(movement.category, 'Steam engines');
  assert.equal(
    movement.description,
    '181 and 182. Diagonal catch or hand-gear used in large blowing and pumping engines. In 181 the lower steam-valve and upper eduction-valve are open, while the upper steam-valve and lower eduction-valve are shut; consequently the piston will be ascending. In the ascent of the piston-rod the lower handle will be struck by the projecting tappet, and, being raised, will become engaged by the catch and shut the upper eduction and lower steam valves; at the same time, the upper handle being disengaged from the catch, the back weight will pull the handle up and open the upper steam and lower eduction valves, when the piston will consequently descend. 182 represents the position of the catchers and handles when the piston is at the top of the cylinder. In going down, the tappet of the piston-rod strikes the upper handle and throws the catches and handles to the position shown in 181.',
  );
  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_182.html');
  assert.equal(
    movement.archetype,
    'double-backweighted-valve-handles-center-pivoted-diagonal-catch-piston-tappet-position-182',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'top-position-descending-piston-tappet-trips-upper-valve-handle-diagonal-catch-releases-lower-backweighted-handle-and-restores-four-valves',
  );
  assert.equal(
    model.root.userData.variant,
    'source-182-top-of-cylinder-initial-pose',
  );
  assert.equal(model.root.userData.materialsIgnoreSceneFog, true);
  for (const fn of [
    baseStateAtCyclePhase,
    catchLawAtCyclePhase,
    cyclePhaseToBasePhase,
    sourceVectorToModel,
    stateAtCyclePhase,
    stateAtTime,
    topStateLawAtCyclePhase,
  ]) {
    assert.equal(typeof fn, 'function');
  }

  // This is the same rigid hand gear as 181, but its public zero is locked to
  // the independently engraved top-of-cylinder pose rather than copied from
  // the preceding catalog entry.
  assert.equal(geometry.movementId, 182);
  near(geometry.initialBasePhase, 0.48, 0, 'source 182 initial base phase');
  near(geometry.publicBasePhaseWrap, 0.52, 0, 'public base-phase wrap');
  assert.deepEqual(geometry.source182CatchPivot.toArray(), [270, 236]);
  assert.deepEqual(geometry.source182UpperPivot.toArray(), [273, 120]);
  assert.deepEqual(geometry.source182LowerPivot.toArray(), [269, 351]);
  assert.deepEqual(geometry.source182TappetCenter.toArray(), [184, 79]);
  assert.deepEqual(geometry.source182UpperWeightPin.toArray(), [408, 170]);
  assert.deepEqual(geometry.source182LowerWeightPin.toArray(), [127, 305]);
  assert.deepEqual(geometry.source182CatchWeightPin.toArray(), [370, 359]);
  assert.deepEqual(geometry.source182UpperFreeTip.toArray(), [66, 154]);
  assert.deepEqual(geometry.source182UpperContact.toArray(), [177, 154]);
  near(geometry.source182PistonY, 1.9625, 1e-14,
    'source 182 top tappet height');
  near(geometry.source182UpperAngle, -0.846296296534586, 1e-15,
    'source 182 upper handle angle');
  near(geometry.source182LowerAngle, -0.7944147174651272, 1e-15,
    'source 182 lower handle angle');
  assert.ok(geometry.upperSource182WeightResidual < 0.10);
  assert.ok(geometry.lowerSource182WeightResidual < 4.16);
  assert.ok(geometry.catchSource182WeightResidual < 2.96);
  assert.equal(geometry.axis.equals(new THREE.Vector3(0, 0, 1)), true);

  for (const object of [
    catchGroup,
    catchPivot,
    catchWeightAnchor,
    lowerHandle,
    lowerHandleWeightAnchor,
    lowerPivot,
    pistonGroup,
    tappet,
    tappetAnchor,
    upperHandle,
    upperHandleContactAnchor,
    upperHandleWorkingTip,
    upperHandleWeightAnchor,
    upperPivot,
  ]) {
    assert.ok(object?.isObject3D, `${object?.userData?.role ?? 'block'} is 3D`);
  }
  assert.equal(upperHandle.parent, model.root);
  assert.equal(lowerHandle.parent, model.root);
  assert.equal(catchGroup.parent, model.root);
  assert.equal(pistonGroup.parent, model.root);
  assert.equal(upperPivot.userData.fixed, true);
  assert.equal(lowerPivot.userData.fixed, true);
  assert.equal(catchPivot.userData.fixed, true);
  const quadrantObjects = [];
  model.root.traverse((object) => {
    if (/quadrant/i.test(object.userData.role ?? '')) quadrantObjects.push(object);
  });
  assert.equal(quadrantObjects.length, 0,
    'movement 182 retains the one diagonal catch shown before movement 183');

  const source182 = canonicalStates.source182Top;
  const initial = stateAtCyclePhase(0);
  assert.equal(initial.cyclePhase, 0);
  near(initial.basePhase, 0.48, 0, 'public phase zero maps to source 182');
  assert.equal(initial.stage, 'source-182-top-of-cylinder-pose-hold');
  comparePhysicalStates(initial, source182, 0);
  near(initial.pistonPosition.y, geometry.source182PistonY, 0,
    'initial tappet is at the top of the cylinder');
  near(initial.upperHandleAngle, geometry.source182UpperAngle, 1e-15,
    'initial upper-handle source angle');
  near(initial.lowerHandleAngle, geometry.source182LowerAngle, 1e-15,
    'initial lower-handle source angle');
  near(initial.catchAngle, 0, 0, 'initial catch is seated');
  near(initial.upperLatchEngagement, 0, 0,
    'upper handle is released in 182');
  near(initial.lowerLatchEngagement, 1, 0,
    'lower handle is caught in 182');
  assert.ok(initial.upperLatchGap > 0.76);
  near(initial.lowerLatchGap, 0, 3e-15, 'lower catch seat closes');
  near(initial.upperSteamOpenFraction, 1, 0,
    'upper steam valve is open in 182');
  near(initial.lowerEductionOpenFraction, 1, 0,
    'lower eduction valve is open in 182');
  near(initial.lowerSteamOpenFraction, 0, 0,
    'lower steam valve is shut in 182');
  near(initial.upperEductionOpenFraction, 0, 0,
    'upper eduction valve is shut in 182');
  const measuredUpperDirection = sourceVectorToModel(
    geometry.source182UpperWeightPin,
    geometry.source182UpperPivot,
  ).normalize();
  const measuredLowerDirection = sourceVectorToModel(
    geometry.source182LowerWeightPin,
    geometry.source182LowerPivot,
  ).normalize();
  vector2Near(
    initial.upperWeightPin.clone().sub(geometry.upperPivot).normalize(),
    measuredUpperDirection,
    1e-14,
    'initial upper back-weight direction matches source 182',
  );
  vector2Near(
    initial.lowerWeightPin.clone().sub(geometry.lowerPivot).normalize(),
    measuredLowerDirection,
    1e-14,
    'initial lower back-weight direction matches source 182',
  );

  const beforeUpperTrip = stateAtCyclePhase(0.159);
  const upperTrip = stateAtCyclePhase(0.23);
  const afterUpperTrip = stateAtCyclePhase(0.301);
  assert.equal(
    beforeUpperTrip.stage,
    'descending-tappet-approaches-upper-handle',
  );
  assert.equal(
    upperTrip.stage,
    'descending-tappet-trips-upper-handle-and-releases-lower',
  );
  assert.equal(upperTrip.activeContact, 'upper-handle');
  assert.ok(upperTrip.pistonVelocity.y < 0,
    'the first public trip is driven by the descending tappet');
  near(upperTrip.upperTappetContactError, 0, 2e-14,
    'descending tappet remains on the upper contact roller');
  assert.equal(
    afterUpperTrip.stage,
    'descending-after-valve-reversal-to-bottom',
  );
  assert.ok(afterUpperTrip.topStateBlend < 0.01,
    'the upper trip restores the valve state shown in 181');

  // Every public sample must be exactly the verified 181/182 physical cycle,
  // shifted by 0.48 of a cycle. This prevents a visually plausible variant
  // from changing contacts, valve timing, or the order of the two trips.
  const sampleCount = 32768;
  const stageOrder = [];
  let previousStage;
  let upperTripSamples = 0;
  let lowerTripSamples = 0;
  let maximumUpperContactError = 0;
  let maximumLowerContactError = 0;
  let minimumPistonY = Infinity;
  let maximumPistonY = -Infinity;
  let maximumCatchDeflection = 0;
  let maximumUpperRadiusError = 0;
  let maximumLowerRadiusError = 0;
  let maximumCatchRadiusError = 0;
  for (let index = 0; index <= sampleCount; index += 1) {
    const phase = index / sampleCount;
    const state = stateAtCyclePhase(phase);
    const expectedBasePhase = cyclePhaseToBasePhase(phase);
    const baseState = baseStateAtCyclePhase(expectedBasePhase);
    const precedingModelState = movement181.root.userData
      .baseStateAtCyclePhase(expectedBasePhase);
    near(state.basePhase, expectedBasePhase, 0,
      `public/base phase mapping at ${phase}`);
    comparePhysicalStates(state, baseState, phase);
    comparePhysicalStates(state, precedingModelState, phase);
    if (state.stage !== previousStage) {
      stageOrder.push(state.stage);
      previousStage = state.stage;
    }
    for (const value of [
      state.catchAngle,
      state.catchAngularAcceleration,
      state.catchAngularVelocity,
      state.lowerHandleAngle,
      state.lowerHandleAngularAcceleration,
      state.lowerHandleAngularVelocity,
      state.lowerLatchEngagement,
      state.lowerLatchGap,
      state.pistonAcceleration,
      state.pistonPosition.y,
      state.pistonVelocity.y,
      state.topStateAcceleration,
      state.topStateBlend,
      state.topStateVelocity,
      state.upperHandleAngle,
      state.upperHandleAngularAcceleration,
      state.upperHandleAngularVelocity,
      state.upperLatchEngagement,
      state.upperLatchGap,
      ...state.upperWeightPin.toArray(),
      ...state.lowerWeightPin.toArray(),
      ...state.catchWeightPin.toArray(),
    ]) {
      assert.equal(Number.isFinite(value), true, `finite cycle value at ${phase}`);
    }
    near(state.upperLatchEngagement + state.lowerLatchEngagement, 1, 1e-14,
      `one complementary catch state at ${phase}`);
    near(state.upperSteamOpenFraction + state.lowerSteamOpenFraction, 1, 1e-14,
      `steam valves are complementary at ${phase}`);
    near(state.upperEductionOpenFraction + state.lowerEductionOpenFraction, 1, 1e-14,
      `eduction valves are complementary at ${phase}`);
    near(state.upperSteamOpenFraction, state.lowerEductionOpenFraction, 1e-14,
      `upper-steam/lower-eduction pair at ${phase}`);
    near(state.lowerSteamOpenFraction, state.upperEductionOpenFraction, 1e-14,
      `lower-steam/upper-eduction pair at ${phase}`);
    assert.ok(state.pistonPosition.y >= geometry.source181PistonY - 1e-13);
    assert.ok(state.pistonPosition.y <= geometry.source182PistonY + 1e-13);
    minimumPistonY = Math.min(minimumPistonY, state.pistonPosition.y);
    maximumPistonY = Math.max(maximumPistonY, state.pistonPosition.y);
    maximumCatchDeflection = Math.max(
      maximumCatchDeflection,
      Math.abs(state.catchAngle),
    );
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
    maximumCatchRadiusError = Math.max(
      maximumCatchRadiusError,
      Math.abs(
        state.catchWeightPin.distanceTo(geometry.catchPivot)
          - geometry.catchWeightLocal.length(),
      ),
    );
    if (state.activeContact === 'upper-handle') {
      upperTripSamples += 1;
      maximumUpperContactError = Math.max(
        maximumUpperContactError,
        Math.abs(state.upperTappetContactError),
      );
      near(state.upperTappetContactError, 0, 2e-14,
        `upper tappet rolling contact at ${phase}`);
      assert.ok(state.pistonVelocity.y <= 1e-13);
      assert.ok(state.activeContactPoint.x >= geometry.tappetShoeLeftX - 1e-12);
      assert.ok(state.activeContactPoint.x <= geometry.tappetShoeRightX + 1e-12);
    } else if (state.activeContact === 'lower-handle') {
      lowerTripSamples += 1;
      maximumLowerContactError = Math.max(
        maximumLowerContactError,
        Math.abs(state.lowerTappetContactError),
      );
      near(state.lowerTappetContactError, 0, 2e-14,
        `lower tappet rolling contact at ${phase}`);
      assert.ok(state.pistonVelocity.y >= -1e-13);
      assert.ok(state.activeContactPoint.x >= geometry.tappetShoeLeftX - 1e-12);
      assert.ok(state.activeContactPoint.x <= geometry.tappetShoeRightX + 1e-12);
    } else {
      assert.equal(state.activeContactPoint, null);
    }
  }
  assert.deepEqual(stageOrder, [
    'source-182-top-of-cylinder-pose-hold',
    'descending-tappet-approaches-upper-handle',
    'descending-tappet-trips-upper-handle-and-releases-lower',
    'descending-after-valve-reversal-to-bottom',
    'source-181-returned-pose-hold',
    'source-181-ascending-stroke-pose-hold',
    'ascending-tappet-approaches-lower-handle',
    'ascending-tappet-trips-lower-handle-and-releases-upper',
    'ascending-after-valve-reversal-to-top',
    'source-182-top-of-cylinder-pose-hold',
  ]);
  assert.ok(upperTripSamples > 4500);
  assert.ok(lowerTripSamples > 4500);
  near(minimumPistonY, geometry.source181PistonY, 0,
    'cycle reaches the source 181 lower endpoint');
  near(maximumPistonY, geometry.source182PistonY, 0,
    'cycle reaches the source 182 top endpoint');
  near(maximumCatchDeflection, geometry.catchTripDeflection, 2e-8,
    'catch completes both release pulses');
  assert.ok(maximumUpperContactError < 2e-14);
  assert.ok(maximumLowerContactError < 2e-14);
  assert.ok(maximumUpperRadiusError < 7e-16);
  assert.ok(maximumLowerRadiusError < 7e-16);
  assert.ok(maximumCatchRadiusError < 7e-16);

  // The public re-anchoring is C2 at every event and at its hidden base-phase
  // wrap. Finite differences independently audit the analytic rates.
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
    near(state.catchAngularVelocity, 0, 1e-13,
      `zero catch velocity at public boundary ${phase}`);
    near(state.catchAngularAcceleration, 0, 1e-12,
      `zero catch acceleration at public boundary ${phase}`);
  }
  comparePhysicalStates(stateAtCyclePhase(1), stateAtCyclePhase(0), 1);

  const derivativeSamples = 4096;
  const timeStep = 1e-4;
  let maximumPistonVelocityError = 0;
  let maximumPistonAccelerationError = 0;
  let maximumUpperVelocityError = 0;
  let maximumUpperAccelerationError = 0;
  let maximumLowerVelocityError = 0;
  let maximumLowerAccelerationError = 0;
  let maximumCatchVelocityError = 0;
  let maximumCatchAccelerationError = 0;
  for (let index = 0; index < derivativeSamples; index += 1) {
    const time = geometry.cyclePeriod * (index + 0.371) / derivativeSamples;
    const phase = time / geometry.cyclePeriod;
    const phaseMargin = timeStep * 4 / geometry.cyclePeriod;
    if (
      phase < phaseMargin
      || phase > 1 - phaseMargin
      || boundaryPhases.some((boundary) => Math.abs(phase - boundary) < phaseMargin)
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
        (
          after.upperHandleAngularVelocity - before.upperHandleAngularVelocity
        ) / (2 * timeStep) - state.upperHandleAngularAcceleration,
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
        (
          after.lowerHandleAngularVelocity - before.lowerHandleAngularVelocity
        ) / (2 * timeStep) - state.lowerHandleAngularAcceleration,
      ),
    );
    maximumCatchVelocityError = Math.max(
      maximumCatchVelocityError,
      Math.abs(
        (after.catchAngle - before.catchAngle) / (2 * timeStep)
          - state.catchAngularVelocity,
      ),
    );
    maximumCatchAccelerationError = Math.max(
      maximumCatchAccelerationError,
      Math.abs(
        (after.catchAngularVelocity - before.catchAngularVelocity)
          / (2 * timeStep) - state.catchAngularAcceleration,
      ),
    );
  }
  assert.ok(maximumPistonVelocityError < 5e-7);
  assert.ok(maximumPistonAccelerationError < 2e-6);
  assert.ok(maximumUpperVelocityError < 8e-8);
  assert.ok(maximumUpperAccelerationError < 2e-7);
  assert.ok(maximumLowerVelocityError < 8e-8);
  assert.ok(maximumLowerAccelerationError < 2e-7);
  assert.ok(maximumCatchVelocityError < 2e-7);
  assert.ok(maximumCatchAccelerationError < 2e-6);

  // The initial render itself—not just its numerical state—must show 182.
  model.root.updateMatrixWorld(true);
  const fixedPivotMatrices = [upperPivot, lowerPivot, catchPivot].map(
    (pivot) => pivot.matrix.clone(),
  );
  const expectedUpperFreeVector = sourceVectorToModel(
    geometry.source182UpperFreeTip,
    geometry.source182UpperPivot,
  );
  vector3Near(
    worldPoint(upperHandleWorkingTip),
    new THREE.Vector3(
      geometry.upperPivot.x + expectedUpperFreeVector.x,
      geometry.upperPivot.y + expectedUpperFreeVector.y,
      geometry.handlePlaneZ,
    ),
    1e-11,
    'initial rendered upper free tip matches source 182',
  );
  vector3Near(
    worldPoint(upperHandleContactAnchor),
    new THREE.Vector3(
      source182.upperHandleContactPoint.x,
      source182.upperHandleContactPoint.y,
      geometry.handlePlaneZ,
    ),
    1e-11,
    'initial upper tappet contact anchor matches source 182',
  );
  vector3Near(
    worldPoint(upperHandleWeightAnchor),
    new THREE.Vector3(
      source182.upperWeightPin.x,
      source182.upperWeightPin.y,
      geometry.handlePlaneZ,
    ),
    1e-12,
    'initial upper weight pin matches source 182',
  );
  vector3Near(
    worldPoint(lowerHandleWeightAnchor),
    new THREE.Vector3(
      source182.lowerWeightPin.x,
      source182.lowerWeightPin.y,
      geometry.handlePlaneZ,
    ),
    1e-12,
    'initial lower weight pin matches source 182',
  );
  vector3Near(
    worldPoint(catchWeightAnchor),
    new THREE.Vector3(
      source182.catchWeightPin.x,
      source182.catchWeightPin.y,
      geometry.catchPlaneZ,
    ),
    0.04,
    'initial catch weight stays within the source 182 engraving residual',
  );
  vector3Near(
    worldPoint(tappetAnchor),
    source182.pistonPosition,
    1e-14,
    'initial rendered tappet center is the source 182 top position',
  );
  near(upperHandle.rotation.z, geometry.source182UpperAngle, 1e-15,
    'initial rendered upper angle');
  near(lowerHandle.rotation.z, geometry.source182LowerAngle, 1e-15,
    'initial rendered lower angle');
  near(catchGroup.rotation.z, 0, 1e-15, 'initial rendered catch angle');
  near(pistonGroup.position.y, geometry.source182PistonY, 1e-15,
    'initial rendered piston height');
  assert.equal(upperLatchMarker.visible, false);
  assert.equal(lowerLatchMarker.visible, true);
  assert.equal(tappetContactMarker.visible, false);
  near(upperWeightRod.rotation.z, 0, 0, 'upper weight rod is vertical');
  near(lowerWeightRod.rotation.z, 0, 0, 'lower weight rod is vertical');
  near(catchWeightRod.rotation.z, 0, 0, 'catch weight rod is vertical');

  model.update(0.23 * geometry.cyclePeriod, 0);
  model.root.updateMatrixWorld(true);
  assert.equal(model.root.userData.contacts.activeTappetContact, 'upper-handle');
  assert.equal(tappetContactMarker.visible, true);
  vector3Near(
    tappetContactMarker.position,
    new THREE.Vector3(
      upperTrip.activeContactPoint.x,
      upperTrip.activeContactPoint.y,
      geometry.handlePlaneZ + geometry.handleDepth / 2 + 0.20,
    ),
    1e-14,
    'upper-trip marker follows the exact descending contact',
  );
  for (const [pivot, matrix] of [upperPivot, lowerPivot, catchPivot].map(
    (pivot, index) => [pivot, fixedPivotMatrices[index]],
  )) {
    assert.deepEqual(pivot.matrix.elements, matrix.elements,
      `${pivot.userData.role} remains fixed during the descending trip`);
  }

  model.update(0.48 * geometry.cyclePeriod, 0);
  assert.equal(
    model.root.userData.kinematics.stage,
    'source-181-returned-pose-hold',
  );
  near(model.root.userData.kinematics.topStateBlend, 0, 0,
    'descending stroke returns the 181 valve state');
  assert.equal(upperLatchMarker.visible, true);
  assert.equal(lowerLatchMarker.visible, false);

  const lowerTripPhase = 0.79;
  const lowerTripState = stateAtCyclePhase(lowerTripPhase);
  model.update(lowerTripPhase * geometry.cyclePeriod, 0);
  assert.equal(model.root.userData.contacts.activeTappetContact, 'lower-handle');
  assert.equal(tappetContactMarker.visible, true);
  assert.ok(lowerTripState.pistonVelocity.y > 0);

  model.update(geometry.cyclePeriod, 0);
  model.root.updateMatrixWorld(true);
  vector3Near(worldPoint(tappetAnchor), source182.pistonPosition, 1e-14,
    'one full public cycle returns exactly to source 182');
  assert.equal(upperLatchMarker.visible, false);
  assert.equal(lowerLatchMarker.visible, true);
  assert.equal(tappetContactMarker.visible, false);

  const frameFrontZ = geometry.frameCenterZ + geometry.frameDepth / 2;
  const handleBottomZ = geometry.handlePlaneZ - geometry.handleDepth / 2;
  const handleTopZ = geometry.handlePlaneZ + geometry.handleDepth / 2;
  const catchBottomZ = geometry.catchPlaneZ - geometry.catchDepth / 2;
  assert.ok(handleBottomZ > frameFrontZ);
  assert.ok(handleTopZ < catchBottomZ,
    'diagonal catch remains in front of both handles without interpenetration');
  assert.ok(tappet.geometry.parameters.depth > geometry.handleDepth,
    'projecting tappet spans the handle contact plane');
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 4.37);
  assert.ok(size.y > 7.84);
  assert.ok(size.z > 1.35);
  near(model.root.userData.cameraDistanceScale, 1.18, 0,
    'source-complete portrait camera scale');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 3);

  // Movement 183 now independently replaces this diagonal catch with two
  // rigid quadrants while retaining the verified paired valve sequence.
  const movement183 = createMovementModel(catalog.movements[182]);
  assert.equal(movement181.root.userData.fidelity, 'authored');
  assert.equal(
    movement181.root.userData.mechanism,
    'ascending-piston-tappet-trips-lower-valve-handle-diagonal-catch-releases-upper-backweighted-handle-and-reverses-four-valves',
  );
  assert.notEqual(
    movement181.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.equal(catalog.movements[182].fidelity, 'authored');
  assert.equal(movement183.root.userData.fidelity, 'authored');
  assert.equal(
    movement183.root.userData.mechanism,
    'ascending-piston-tappet-trips-lower-quadrant-handle-releases-upper-backweighted-quadrant-handle-and-reverses-four-valves',
  );
  assert.notEqual(
    movement183.root.userData.mechanism,
    model.root.userData.mechanism,
  );

  disposeModel(movement183.root);
  disposeModel(movement181.root);
  disposeModel(model.root);
});
