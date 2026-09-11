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

function rotateVector2(vector, angle) {
  return new THREE.Vector2(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  );
}

test('movement 183 replaces the diagonal catch with two rigid mutually retaining handle quadrants', () => {
  const movement = catalog.movements[182];
  const model = createMovementModel(movement);
  const {
    baseStateAtCyclePhase,
    blocks,
    canonicalStates,
    cyclePhaseToBasePhase,
    geometry,
    modelPointToSource183,
    modelVectorToSource,
    source183PointToModel,
    source184PointToModel,
    sourceVectorToModel,
    stateAtCyclePhase,
    stateAtTime,
    topStateLawAtCyclePhase,
  } = model.root.userData;
  const {
    bottomLatchMarker,
    frameSpine,
    lowerCrossbar,
    lowerHandle,
    lowerHandleContactAnchor,
    lowerHandleContactRoller,
    lowerHandleHub,
    lowerHandleIndex,
    lowerHandleWeightAnchor,
    lowerHandleWeightArm,
    lowerHandleWorkingArm,
    lowerHandleWorkingTip,
    lowerPivot,
    lowerPivotHead,
    lowerPivotShaft,
    lowerPivotSlot,
    lowerQuadrant,
    lowerQuadrantBand,
    lowerQuadrantEndSpoke,
    lowerQuadrantIndex,
    lowerQuadrantStartSpoke,
    lowerTopSeatAnchor,
    lowerTopSeatPin,
    lowerWeight,
    lowerWeightAssembly,
    lowerWeightConnector,
    lowerWeightRod,
    pistonGroup,
    pistonGuide,
    pistonRod,
    tappet,
    tappetAnchor,
    tappetContactMarker,
    tappetIndex,
    topLatchMarker,
    upperBottomSeatAnchor,
    upperBottomSeatPin,
    upperCrossbar,
    upperHandle,
    upperHandleContactAnchor,
    upperHandleContactRoller,
    upperHandleHub,
    upperHandleIndex,
    upperHandleWeightAnchor,
    upperHandleWeightArm,
    upperHandleWorkingArm,
    upperHandleWorkingTip,
    upperPivot,
    upperPivotHead,
    upperPivotShaft,
    upperPivotSlot,
    upperQuadrant,
    upperQuadrantBand,
    upperQuadrantEndSpoke,
    upperQuadrantIndex,
    upperQuadrantStartSpoke,
    upperTopHookAnchor,
    upperWeight,
    upperWeightAssembly,
    upperWeightConnector,
    upperWeightRod,
  } = blocks;

  assert.equal(movement.id, 183);
  assert.equal(movement.number, '183');
  assert.equal(
    movement.title,
    'Two-Quadrant Blowing-Engine Hand Gear — Ascending Stroke',
  );
  assert.equal(movement.category, 'Steam engines');
  assert.equal(
    movement.description,
    '183 and 184. represent a modification of 181 and 182, the diagonal catches being superseded by two quadrants.',
  );
  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_183.html');
  assert.equal(
    movement.archetype,
    'double-backweighted-valve-handles-mutually-latching-quadrants-piston-tappet-position-183',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'ascending-piston-tappet-trips-lower-quadrant-handle-releases-upper-backweighted-quadrant-handle-and-reverses-four-valves',
  );
  assert.equal(
    model.root.userData.variant,
    'source-183-ascending-stroke-initial-pose',
  );
  assert.equal(model.root.userData.materialsIgnoreSceneFog, true);
  for (const fn of [
    baseStateAtCyclePhase,
    cyclePhaseToBasePhase,
    modelPointToSource183,
    modelVectorToSource,
    source183PointToModel,
    source184PointToModel,
    sourceVectorToModel,
    stateAtCyclePhase,
    stateAtTime,
    topStateLawAtCyclePhase,
  ]) {
    assert.equal(typeof fn, 'function');
  }

  // Brown's modification has two fixed axes and exactly two quadrants, one
  // rigidly owned by each handle.  It has no central diagonal catch, third
  // catch pivot, or separately animated decorative sector.
  for (const object of [
    bottomLatchMarker,
    frameSpine,
    lowerCrossbar,
    lowerHandle,
    lowerHandleContactAnchor,
    lowerHandleContactRoller,
    lowerHandleHub,
    lowerHandleIndex,
    lowerHandleWeightAnchor,
    lowerHandleWeightArm,
    lowerHandleWorkingArm,
    lowerHandleWorkingTip,
    lowerPivot,
    lowerPivotHead,
    lowerPivotShaft,
    lowerPivotSlot,
    lowerQuadrant,
    lowerQuadrantBand,
    lowerQuadrantEndSpoke,
    lowerQuadrantIndex,
    lowerQuadrantStartSpoke,
    lowerTopSeatAnchor,
    lowerTopSeatPin,
    lowerWeight,
    lowerWeightAssembly,
    lowerWeightConnector,
    lowerWeightRod,
    pistonGroup,
    pistonGuide,
    pistonRod,
    tappet,
    tappetAnchor,
    tappetContactMarker,
    tappetIndex,
    topLatchMarker,
    upperBottomSeatAnchor,
    upperBottomSeatPin,
    upperCrossbar,
    upperHandle,
    upperHandleContactAnchor,
    upperHandleContactRoller,
    upperHandleHub,
    upperHandleIndex,
    upperHandleWeightAnchor,
    upperHandleWeightArm,
    upperHandleWorkingArm,
    upperHandleWorkingTip,
    upperPivot,
    upperPivotHead,
    upperPivotShaft,
    upperPivotSlot,
    upperQuadrant,
    upperQuadrantBand,
    upperQuadrantEndSpoke,
    upperQuadrantIndex,
    upperQuadrantStartSpoke,
    upperTopHookAnchor,
    upperWeight,
    upperWeightAssembly,
    upperWeightConnector,
    upperWeightRod,
  ]) {
    assert.ok(object?.isObject3D, `${object?.userData?.role ?? 'block'} is 3D`);
  }
  assert.equal(upperHandle.parent, model.root);
  assert.equal(lowerHandle.parent, model.root);
  assert.equal(upperQuadrant.parent, upperHandle);
  assert.equal(lowerQuadrant.parent, lowerHandle);
  assert.equal(upperQuadrantBand.parent, upperQuadrant);
  assert.equal(lowerQuadrantBand.parent, lowerQuadrant);
  assert.equal(upperPivot.parent, model.root);
  assert.equal(lowerPivot.parent, model.root);
  assert.equal(upperPivot.userData.fixed, true);
  assert.equal(lowerPivot.userData.fixed, true);
  assert.equal(geometry.axis.equals(new THREE.Vector3(0, 0, 1)), true);
  const fixedAxes = [];
  const quadrantGroups = [];
  const diagonalCatchObjects = [];
  model.root.traverse((object) => {
    if (object.userData.fixed) fixedAxes.push(object);
    if (/rigid-hollow-quadrant$/.test(object.userData.role ?? '')) {
      quadrantGroups.push(object);
    }
    if (/diagonal-catch|central-catch/i.test(object.userData.role ?? '')) {
      diagonalCatchObjects.push(object);
    }
  });
  assert.deepEqual(fixedAxes, [upperPivot, lowerPivot]);
  assert.deepEqual(quadrantGroups, [upperQuadrant, lowerQuadrant]);
  assert.equal(diagonalCatchObjects.length, 0);

  // Source locks from the two independently scanned 525 px engravings.
  assert.equal(geometry.sourceImageWidth, 525);
  assert.equal(geometry.sourceImageHeight, 525);
  near(geometry.sourceScale, 0.0125, 0, 'source scale');
  assert.deepEqual(geometry.source183UpperPivot.toArray(), [275, 129]);
  assert.deepEqual(geometry.source183LowerPivot.toArray(), [283, 353]);
  assert.deepEqual(geometry.source183Origin.toArray(), [279, 241]);
  assert.equal(geometry.source183PistonRodCenterX, 177);
  assert.deepEqual(geometry.source183TappetCenter.toArray(), [181, 365]);
  assert.deepEqual(geometry.source183UpperWeightPin.toArray(), [400, 45]);
  assert.deepEqual(geometry.source183LowerWeightPin.toArray(), [142, 421]);
  assert.deepEqual(geometry.source183LowerFreeTip.toArray(), [74, 313]);
  assert.deepEqual(geometry.source183LowerContact.toArray(), [177, 313]);
  assert.deepEqual(geometry.source183BottomLatchPoint.toArray(), [337, 260]);
  assert.deepEqual(geometry.source184UpperPivot.toArray(), [277, 96]);
  assert.deepEqual(geometry.source184LowerPivot.toArray(), [281, 320]);
  assert.deepEqual(geometry.source184Origin.toArray(), [279, 208]);
  assert.deepEqual(geometry.source184TappetCenter.toArray(), [180, 87]);
  assert.deepEqual(geometry.source184UpperWeightPin.toArray(), [377, 201]);
  assert.deepEqual(geometry.source184LowerWeightPin.toArray(), [181, 238]);
  assert.deepEqual(geometry.source184UpperFreeTip.toArray(), [84, 145]);
  assert.deepEqual(geometry.source184UpperContact.toArray(), [177, 145]);
  assert.deepEqual(geometry.source184TopLatchPoint.toArray(), [347, 218]);
  vector2Near(geometry.upperPivot, new THREE.Vector2(-0.05, 1.4), 1e-14,
    'upper fixed pivot');
  vector2Near(geometry.lowerPivot, new THREE.Vector2(0.05, -1.4), 1e-14,
    'lower fixed pivot');
  near(geometry.pistonRodX, -1.275, 1e-14, 'piston guide x');
  near(geometry.source183PistonY, -1.55, 1e-14,
    'source 183 tappet height');
  near(geometry.source184PistonY, 1.5125, 1e-14,
    'source 184 tappet height');
  near(geometry.source184UpperAngle, -1.4014694007142283, 1e-15,
    'upper rigid rotation between source figures');
  near(geometry.source184LowerAngle, -1.1361805161720548, 1e-15,
    'lower rigid rotation between source figures');
  assert.ok(geometry.source184UpperAngle < 0);
  assert.ok(geometry.source184LowerAngle < 0);
  assert.ok(geometry.upperSource184WeightResidual < 5.61,
    'upper weight-arm engraving drift stays below six pixels');
  assert.ok(geometry.lowerSource184WeightResidual < 27.23,
    'faint hidden lower eye remains within its measured engraving drift');
  near(geometry.upperQuadrantInnerRadius, 1.24, 0,
    'upper quadrant inner radius');
  near(geometry.upperQuadrantOuterRadius, 2.02, 0,
    'upper quadrant outer radius');
  near(geometry.upperQuadrantStartAngle, -1.20, 0,
    'upper quadrant first radial boundary');
  near(geometry.upperQuadrantEndAngle, 0.42, 0,
    'upper quadrant second radial boundary');
  near(geometry.lowerQuadrantInnerRadius, 1.04, 0,
    'lower quadrant inner radius');
  near(geometry.lowerQuadrantOuterRadius, 1.62, 0,
    'lower quadrant outer radius');
  near(geometry.lowerQuadrantStartAngle, 0.78, 0,
    'lower quadrant first radial boundary');
  near(geometry.lowerQuadrantEndAngle, 2.36, 0,
    'lower quadrant second radial boundary');
  for (const sourcePoint of [
    geometry.source183UpperPivot,
    geometry.source183LowerPivot,
    geometry.source183TappetCenter,
    geometry.source183UpperWeightPin,
    geometry.source183LowerWeightPin,
    geometry.source183LowerFreeTip,
    geometry.source183BottomLatchPoint,
  ]) {
    vector2Near(
      modelPointToSource183(source183PointToModel(sourcePoint)),
      sourcePoint,
      1e-12,
      `source/model raster round trip for ${sourcePoint.toArray()}`,
    );
  }
  const sampleSourceVector = new THREE.Vector2(41, -53);
  vector2Near(
    modelVectorToSource(sourceVectorToModel(
      sampleSourceVector,
      new THREE.Vector2(0, 0),
    )),
    sampleSourceVector,
    1e-12,
    'source/model vector round trip',
  );

  const source183 = canonicalStates.source183Ascending;
  const source184 = canonicalStates.source184Top;
  const source183Returned = canonicalStates.source183Returned;
  assert.equal(
    source183.canonicalStage,
    'source-183-lower-steam-and-upper-eduction-open',
  );
  assert.equal(
    source184.canonicalStage,
    'source-184-upper-steam-and-lower-eduction-open',
  );
  assert.equal(
    source183Returned.canonicalStage,
    'source-183-returned-after-full-cycle',
  );
  near(source183.pistonPosition.y, geometry.source183PistonY, 0,
    'source 183 piston pose');
  near(source183.upperHandleAngle, 0, 0,
    'source 183 upper handle angle');
  near(source183.lowerHandleAngle, 0, 0,
    'source 183 lower handle angle');
  near(source183.bottomLatchGap, 0, 0,
    'source 183 quadrant contact closes');
  assert.ok(source183.topLatchGap > 3.21,
    'source 184 quadrant contact is open in source 183');
  near(source183.bottomLatchEngagement, 1, 0,
    'lower quadrant retains the upper handle in source 183');
  near(source183.topLatchEngagement, 0, 0,
    'upper quadrant does not retain the lower handle in source 183');
  near(source183.lowerSteamOpenFraction, 1, 0,
    'source 183 lower steam valve is open');
  near(source183.upperEductionOpenFraction, 1, 0,
    'source 183 upper eduction valve is open');
  near(source183.upperSteamOpenFraction, 0, 0,
    'source 183 upper steam valve is shut');
  near(source183.lowerEductionOpenFraction, 0, 0,
    'source 183 lower eduction valve is shut');
  vector2Near(
    source183.upperWeightPin,
    source183PointToModel(geometry.source183UpperWeightPin),
    1e-14,
    'source 183 upper weight pin',
  );
  vector2Near(
    source183.lowerWeightPin,
    source183PointToModel(geometry.source183LowerWeightPin),
    1e-14,
    'source 183 lower weight pin',
  );

  near(source184.pistonPosition.y, geometry.source184PistonY, 0,
    'source 184 piston pose');
  near(source184.upperHandleAngle, geometry.source184UpperAngle, 1e-15,
    'source 184 upper handle angle');
  near(source184.lowerHandleAngle, geometry.source184LowerAngle, 1e-15,
    'source 184 lower handle angle');
  near(source184.topLatchGap, 0, 3e-15,
    'source 184 quadrant contact closes');
  assert.ok(source184.bottomLatchGap > 3.47,
    'source 183 quadrant contact is open in source 184');
  near(source184.bottomLatchEngagement, 0, 0,
    'lower quadrant releases the upper handle in source 184');
  near(source184.topLatchEngagement, 1, 0,
    'upper quadrant retains the lower handle in source 184');
  near(source184.upperSteamOpenFraction, 1, 0,
    'source 184 upper steam valve is open');
  near(source184.lowerEductionOpenFraction, 1, 0,
    'source 184 lower eduction valve is open');
  near(source184.lowerSteamOpenFraction, 0, 0,
    'source 184 lower steam valve is shut');
  near(source184.upperEductionOpenFraction, 0, 0,
    'source 184 upper eduction valve is shut');
  vector2Near(
    source184.upperWeightPin.clone().sub(geometry.upperPivot).normalize(),
    sourceVectorToModel(
      geometry.source184UpperWeightPin,
      geometry.source184UpperPivot,
    ).normalize(),
    1e-14,
    'source 184 upper back-weight direction',
  );
  vector2Near(
    source184.lowerWeightPin.clone().sub(geometry.lowerPivot).normalize(),
    sourceVectorToModel(
      geometry.source184LowerWeightPin,
      geometry.source184LowerPivot,
    ).normalize(),
    1e-14,
    'source 184 lower back-weight direction',
  );
  assert.ok(source184.upperWeightPin.y < source183.upperWeightPin.y,
    'released upper back weight falls after the lower trip');
  assert.ok(source183.lowerWeightPin.y < source184.lowerWeightPin.y,
    'released lower back weight falls on the descending return');
  vector3Near(
    source183Returned.pistonPosition,
    source183.pistonPosition,
    0,
    'one cycle returns the source 183 tappet',
  );
  near(source183Returned.upperHandleAngle, source183.upperHandleAngle, 0,
    'one cycle returns the upper handle');
  near(source183Returned.lowerHandleAngle, source183.lowerHandleAngle, 0,
    'one cycle returns the lower handle');

  // Exhaustive mechanics audit: only the correct tappet contact is active on
  // each stroke, both quadrants remain rigid with their owning handles, the
  // two stable contacts alternate, and all four valve states stay paired.
  const sampleCount = 32768;
  const stageOrder = [];
  let previousStage;
  let lowerTripSamples = 0;
  let upperTripSamples = 0;
  let maximumLowerContactError = 0;
  let maximumUpperContactError = 0;
  let minimumPistonY = Infinity;
  let maximumPistonY = -Infinity;
  let maximumUpperRadiusError = 0;
  let maximumLowerRadiusError = 0;
  let maximumBottomLatchGap = 0;
  let maximumTopLatchGap = 0;
  for (let index = 0; index <= sampleCount; index += 1) {
    const phase = index / sampleCount;
    const state = stateAtCyclePhase(phase);
    near(state.basePhase, cyclePhaseToBasePhase(phase), 0,
      `public/base phase identity at ${phase}`);
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
      assert.equal(Number.isFinite(value), true, `finite cycle value at ${phase}`);
    }
    assert.ok(state.topStateBlend >= -1e-15 && state.topStateBlend <= 1 + 1e-15);
    near(state.bottomLatchEngagement + state.topLatchEngagement, 1, 1e-14,
      `one complementary quadrant latch at ${phase}`);
    near(state.upperSteamOpenFraction + state.lowerSteamOpenFraction, 1, 1e-14,
      `steam valves are complementary at ${phase}`);
    near(state.upperEductionOpenFraction + state.lowerEductionOpenFraction, 1, 1e-14,
      `eduction valves are complementary at ${phase}`);
    near(state.upperSteamOpenFraction, state.lowerEductionOpenFraction, 1e-14,
      `upper-steam/lower-eduction pair at ${phase}`);
    near(state.lowerSteamOpenFraction, state.upperEductionOpenFraction, 1e-14,
      `lower-steam/upper-eduction pair at ${phase}`);
    assert.ok(state.upperHandleAngle <= 1e-14);
    assert.ok(state.upperHandleAngle >= geometry.source184UpperAngle - 1e-14);
    assert.ok(state.lowerHandleAngle <= 1e-14);
    assert.ok(state.lowerHandleAngle >= geometry.source184LowerAngle - 1e-14);
    minimumPistonY = Math.min(minimumPistonY, state.pistonPosition.y);
    maximumPistonY = Math.max(maximumPistonY, state.pistonPosition.y);
    assert.ok(state.pistonPosition.y >= geometry.source183PistonY - 1e-13);
    assert.ok(state.pistonPosition.y <= geometry.source184PistonY + 1e-13);
    maximumBottomLatchGap = Math.max(
      maximumBottomLatchGap,
      state.bottomLatchGap,
    );
    maximumTopLatchGap = Math.max(maximumTopLatchGap, state.topLatchGap);
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
    if (state.activeContact === 'lower-quadrant-handle') {
      lowerTripSamples += 1;
      maximumLowerContactError = Math.max(
        maximumLowerContactError,
        Math.abs(state.lowerTappetContactError),
      );
      near(state.lowerTappetContactError, 0, 2e-14,
        `ascending lower-handle contact at ${phase}`);
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
    } else if (state.activeContact === 'upper-quadrant-handle') {
      upperTripSamples += 1;
      maximumUpperContactError = Math.max(
        maximumUpperContactError,
        Math.abs(state.upperTappetContactError),
      );
      near(state.upperTappetContactError, 0, 2e-14,
        `descending upper-handle contact at ${phase}`);
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
    } else {
      assert.equal(state.activeContactPoint, null);
    }
  }
  assert.deepEqual(stageOrder, [
    'source-183-ascending-stroke-pose-hold',
    'ascending-tappet-approaches-lower-quadrant-handle',
    'ascending-tappet-trips-lower-quadrant-and-releases-upper',
    'ascending-after-quadrant-transfer-to-top',
    'source-184-top-of-cylinder-pose-hold',
    'descending-tappet-approaches-upper-quadrant-handle',
    'descending-tappet-trips-upper-quadrant-and-releases-lower',
    'descending-after-quadrant-transfer-to-bottom',
    'source-183-returned-pose-hold',
  ]);
  assert.ok(lowerTripSamples > 4500);
  assert.ok(upperTripSamples > 4500);
  near(minimumPistonY, geometry.source183PistonY, 0,
    'cycle reaches the source 183 endpoint');
  near(maximumPistonY, geometry.source184PistonY, 0,
    'cycle reaches the source 184 endpoint');
  near(maximumBottomLatchGap, source184.bottomLatchGap, 2e-14,
    'bottom contact opens through its complete travel');
  near(maximumTopLatchGap, source183.topLatchGap, 2e-14,
    'top contact opens through its complete travel');
  assert.ok(maximumLowerContactError < 2e-14);
  assert.ok(maximumUpperContactError < 2e-14);
  assert.ok(maximumUpperRadiusError < 7e-16);
  assert.ok(maximumLowerRadiusError < 7e-16);

  // Every event boundary is C2.  Independent finite differences verify the
  // analytic piston, handle, and hanging-weight rates between those events.
  const boundaryPhases = [0, ...Object.values(geometry.sequenceBreaks), 1];
  for (const phase of boundaryPhases) {
    const state = stateAtCyclePhase(phase);
    near(state.pistonVelocity.y, 0, 1e-13,
      `zero piston velocity at ${phase}`);
    near(state.pistonAcceleration, 0, 1e-12,
      `zero piston acceleration at ${phase}`);
    near(state.upperHandleAngularVelocity, 0, 1e-13,
      `zero upper velocity at ${phase}`);
    near(state.upperHandleAngularAcceleration, 0, 1e-12,
      `zero upper acceleration at ${phase}`);
    near(state.lowerHandleAngularVelocity, 0, 1e-13,
      `zero lower velocity at ${phase}`);
    near(state.lowerHandleAngularAcceleration, 0, 1e-12,
      `zero lower acceleration at ${phase}`);
  }
  const derivativeSamples = 4096;
  const timeStep = 1e-4;
  let maximumPistonVelocityError = 0;
  let maximumPistonAccelerationError = 0;
  let maximumUpperVelocityError = 0;
  let maximumUpperAccelerationError = 0;
  let maximumLowerVelocityError = 0;
  let maximumLowerAccelerationError = 0;
  let maximumUpperWeightVelocityError = 0;
  let maximumLowerWeightVelocityError = 0;
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
    const upperWeightFirst = after.upperWeightPin.clone()
      .sub(before.upperWeightPin).multiplyScalar(1 / (2 * timeStep));
    const lowerWeightFirst = after.lowerWeightPin.clone()
      .sub(before.lowerWeightPin).multiplyScalar(1 / (2 * timeStep));
    maximumUpperWeightVelocityError = Math.max(
      maximumUpperWeightVelocityError,
      upperWeightFirst.distanceTo(state.upperWeightVelocity),
    );
    maximumLowerWeightVelocityError = Math.max(
      maximumLowerWeightVelocityError,
      lowerWeightFirst.distanceTo(state.lowerWeightVelocity),
    );
  }
  assert.ok(maximumPistonVelocityError < 5e-7);
  assert.ok(maximumPistonAccelerationError < 2e-6);
  assert.ok(maximumUpperVelocityError < 2e-7);
  assert.ok(maximumUpperAccelerationError < 5e-7);
  assert.ok(maximumLowerVelocityError < 2e-7);
  assert.ok(maximumLowerAccelerationError < 5e-7);
  assert.ok(maximumUpperWeightVelocityError < 4e-7);
  assert.ok(maximumLowerWeightVelocityError < 4e-7);

  // Rendered tips, pins, quadrants, weights, and markers follow the audited
  // rigid state.  The two fixed shafts never inherit handle rotation.
  model.root.updateMatrixWorld(true);
  const fixedPivotMatrices = [upperPivot, lowerPivot].map(
    (pivot) => pivot.matrix.clone(),
  );
  vector3Near(
    worldPoint(lowerHandleWorkingTip),
    new THREE.Vector3(
      source183PointToModel(geometry.source183LowerFreeTip).x,
      source183PointToModel(geometry.source183LowerFreeTip).y,
      geometry.handlePlaneZ,
    ),
    1e-12,
    'rendered source 183 lower free tip',
  );
  vector3Near(
    worldPoint(upperHandleWeightAnchor),
    new THREE.Vector3(
      source183.upperWeightPin.x,
      source183.upperWeightPin.y,
      geometry.handlePlaneZ,
    ),
    1e-12,
    'rendered source 183 upper weight pin',
  );
  vector3Near(
    worldPoint(lowerHandleWeightAnchor),
    new THREE.Vector3(
      source183.lowerWeightPin.x,
      source183.lowerWeightPin.y,
      geometry.handlePlaneZ,
    ),
    1e-12,
    'rendered source 183 lower weight pin',
  );
  near(upperQuadrant.position.z, geometry.upperQuadrantPlaneZ, 0,
    'upper quadrant occupies its rigid handle layer');
  near(lowerQuadrant.position.z, geometry.lowerQuadrantPlaneZ, 0,
    'lower quadrant occupies its rigid handle layer');
  assert.equal(bottomLatchMarker.visible, true);
  assert.equal(topLatchMarker.visible, false);
  assert.equal(tappetContactMarker.visible, false);
  near(upperWeightRod.rotation.z, 0, 0, 'upper weight rod remains vertical');
  near(lowerWeightRod.rotation.z, 0, 0, 'lower weight rod remains vertical');

  const source184Phase = (
    geometry.sequenceBreaks.upwardOvertravelEnd
      + geometry.sequenceBreaks.source184HoldEnd
  ) / 2;
  model.update(source184Phase * geometry.cyclePeriod, 0);
  model.root.updateMatrixWorld(true);
  const expectedUpperFreeVector = sourceVectorToModel(
    geometry.source184UpperFreeTip,
    geometry.source184UpperPivot,
  );
  vector3Near(
    worldPoint(upperHandleWorkingTip),
    new THREE.Vector3(
      geometry.upperPivot.x + expectedUpperFreeVector.x,
      geometry.upperPivot.y + expectedUpperFreeVector.y,
      geometry.handlePlaneZ,
    ),
    1e-11,
    'rendered source 184 upper free tip after fixed-axis registration',
  );
  vector3Near(
    worldPoint(upperHandleContactAnchor),
    new THREE.Vector3(
      source184.upperHandleContactPoint.x,
      source184.upperHandleContactPoint.y,
      geometry.handlePlaneZ,
    ),
    1e-11,
    'rendered source 184 upper tappet contact',
  );
  near(upperHandle.rotation.z, geometry.source184UpperAngle, 1e-15,
    'rendered source 184 upper angle');
  near(lowerHandle.rotation.z, geometry.source184LowerAngle, 1e-15,
    'rendered source 184 lower angle');
  near(pistonGroup.position.y, geometry.source184PistonY, 1e-15,
    'rendered source 184 piston height');
  assert.equal(bottomLatchMarker.visible, false);
  assert.equal(topLatchMarker.visible, true);
  assert.equal(tappetContactMarker.visible, false);

  const lowerTripPhase = (
    geometry.sequenceBreaks.upwardApproachEnd
      + geometry.sequenceBreaks.lowerTripEnd
  ) / 2;
  const lowerTripState = stateAtCyclePhase(lowerTripPhase);
  model.update(lowerTripPhase * geometry.cyclePeriod, 0);
  model.root.updateMatrixWorld(true);
  assert.equal(model.root.userData.contacts.activeTappetContact,
    'lower-quadrant-handle');
  assert.equal(tappetContactMarker.visible, true);
  vector3Near(
    tappetContactMarker.position,
    new THREE.Vector3(
      lowerTripState.activeContactPoint.x,
      lowerTripState.activeContactPoint.y,
      geometry.lowerQuadrantPlaneZ + geometry.lowerQuadrantDepth / 2 + 0.18,
    ),
    1e-14,
    'lower-trip marker follows exact tappet contact',
  );

  const upperTripPhase = (
    geometry.sequenceBreaks.downwardApproachEnd
      + geometry.sequenceBreaks.upperTripEnd
  ) / 2;
  const upperTripState = stateAtCyclePhase(upperTripPhase);
  model.update(upperTripPhase * geometry.cyclePeriod, 0);
  model.root.updateMatrixWorld(true);
  assert.equal(model.root.userData.contacts.activeTappetContact,
    'upper-quadrant-handle');
  assert.equal(tappetContactMarker.visible, true);
  vector3Near(
    tappetContactMarker.position,
    new THREE.Vector3(
      upperTripState.activeContactPoint.x,
      upperTripState.activeContactPoint.y,
      geometry.lowerQuadrantPlaneZ + geometry.lowerQuadrantDepth / 2 + 0.18,
    ),
    1e-14,
    'upper-trip marker follows exact tappet contact',
  );
  for (const [pivot, matrix] of [upperPivot, lowerPivot].map(
    (pivot, index) => [pivot, fixedPivotMatrices[index]],
  )) {
    assert.deepEqual(pivot.matrix.elements, matrix.elements,
      `${pivot.userData.role} remains fixed through both trips`);
  }

  const frameFrontZ = geometry.frameCenterZ + geometry.frameDepth / 2;
  const handleBottomZ = geometry.handlePlaneZ - geometry.handleDepth / 2;
  const handleTopZ = geometry.handlePlaneZ + geometry.handleDepth / 2;
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
    'upper quadrant clears its owning handle plate');
  assert.ok(upperQuadrantTopZ < lowerQuadrantBottomZ,
    'the two crossing quadrants occupy separate depth layers');
  assert.ok(lowerQuadrantTopZ < weightBottomZ,
    'foreground hanging weights clear both quadrant plates');
  assert.ok(tappet.geometry.parameters.depth > geometry.handleDepth,
    'projecting tappet spans the handle contact plane');
  model.update(0, 0);
  model.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 4.69,
    'handles, quadrants, and both weight eyes span the source width');
  assert.ok(size.y > 7.37,
    'piston guide and hanging weights span the source height');
  assert.ok(size.z > 1.64,
    'frame, handles, separate quadrants, weights, and fixed heads occupy depth');
  assert.ok(bounds.min.z < -0.73);
  assert.ok(bounds.max.z > 0.90);
  near(model.root.userData.cameraDistanceScale, 1.16, 0,
    'source-complete portrait camera scale');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 3);

  // The paired source-184 model is the same audited physical cycle shifted to
  // its top pose; the diagonal-catch predecessor remains independently fixed.
  const movement182 = createMovementModel(catalog.movements[181]);
  const movement184 = createMovementModel(catalog.movements[183]);
  assert.equal(movement182.root.userData.fidelity, 'authored');
  assert.equal(
    movement182.root.userData.mechanism,
    'top-position-descending-piston-tappet-trips-upper-valve-handle-diagonal-catch-releases-lower-backweighted-handle-and-restores-four-valves',
  );
  assert.notEqual(
    movement182.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.equal(catalog.movements[183].fidelity, 'authored');
  assert.equal(movement184.root.userData.fidelity, 'authored');
  assert.equal(
    movement184.root.userData.mechanism,
    'top-position-descending-piston-tappet-trips-upper-quadrant-handle-releases-lower-backweighted-quadrant-handle-and-restores-four-valves',
  );

  disposeModel(movement184.root);
  disposeModel(movement182.root);
  disposeModel(model.root);
});
