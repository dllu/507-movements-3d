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

test('movement 181 trips two backweighted valve handles through one diagonal catch on alternate piston strokes', () => {
  const movement = catalog.movements[180];
  const model = createMovementModel(movement);
  const {
    blocks,
    canonicalStates,
    catchLawAtCyclePhase,
    geometry,
    modelPointToSource181,
    modelVectorToSource,
    source181PointToModel,
    sourceVectorToModel,
    stateAtCyclePhase,
    stateAtTime,
    topStateLawAtCyclePhase,
  } = model.root.userData;
  const {
    catchBackbone,
    catchEye,
    catchGroup,
    catchHub,
    catchIndex,
    catchPivot,
    catchPivotHead,
    catchPivotShaft,
    catchPivotSlot,
    catchWeight,
    catchWeightAnchor,
    catchWeightAssembly,
    catchWeightArm,
    catchWeightRod,
    frameSpine,
    lowerCrossbar,
    lowerHandle,
    lowerHandleContactAnchor,
    lowerHandleContactRoller,
    lowerHandleHub,
    lowerHandleIndex,
    lowerHandleLatchAnchor,
    lowerHandleLatchArm,
    lowerHandleLatchRoller,
    lowerHandleWeightAnchor,
    lowerHandleWeightArm,
    lowerHandleWorkingArm,
    lowerHandleWorkingTip,
    lowerHook,
    lowerLatchMarker,
    lowerPivot,
    lowerPivotHead,
    lowerPivotShaft,
    lowerPivotSlot,
    lowerSeatAnchor,
    lowerWeight,
    lowerWeightAssembly,
    lowerWeightRod,
    pistonGroup,
    pistonGuide,
    pistonRod,
    tappet,
    tappetAnchor,
    tappetContactMarker,
    tappetIndex,
    upperCrossbar,
    upperHandle,
    upperHandleContactAnchor,
    upperHandleContactRoller,
    upperHandleHub,
    upperHandleIndex,
    upperHandleLatchAnchor,
    upperHandleLatchArm,
    upperHandleLatchRoller,
    upperHandleWeightAnchor,
    upperHandleWeightArm,
    upperHandleWorkingArm,
    upperHandleWorkingTip,
    upperHook,
    upperLatchMarker,
    upperPivot,
    upperPivotHead,
    upperPivotShaft,
    upperPivotSlot,
    upperSeatAnchor,
    upperWeight,
    upperWeightAssembly,
    upperWeightRod,
  } = blocks;

  assert.equal(movement.id, 181);
  assert.equal(movement.number, '181');
  assert.equal(
    movement.title,
    'Diagonal-Catch Blowing-Engine Hand Gear — Ascending Stroke',
  );
  assert.equal(movement.category, 'Steam engines');
  assert.equal(
    movement.description,
    '181 and 182. Diagonal catch or hand-gear used in large blowing and pumping engines. In 181 the lower steam-valve and upper eduction-valve are open, while the upper steam-valve and lower eduction-valve are shut; consequently the piston will be ascending. In the ascent of the piston-rod the lower handle will be struck by the projecting tappet, and, being raised, will become engaged by the catch and shut the upper eduction and lower steam valves; at the same time, the upper handle being disengaged from the catch, the back weight will pull the handle up and open the upper steam and lower eduction valves, when the piston will consequently descend. 182 represents the position of the catchers and handles when the piston is at the top of the cylinder. In going down, the tappet of the piston-rod strikes the upper handle and throws the catches and handles to the position shown in 181.',
  );
  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_181.html');
  assert.equal(
    movement.archetype,
    'double-backweighted-valve-handles-center-pivoted-diagonal-catch-piston-tappet-position-181',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'ascending-piston-tappet-trips-lower-valve-handle-diagonal-catch-releases-upper-backweighted-handle-and-reverses-four-valves',
  );
  assert.equal(model.root.userData.materialsIgnoreSceneFog, true);
  for (const fn of [
    catchLawAtCyclePhase,
    modelPointToSource181,
    modelVectorToSource,
    source181PointToModel,
    sourceVectorToModel,
    stateAtCyclePhase,
    stateAtTime,
    topStateLawAtCyclePhase,
  ]) {
    assert.equal(typeof fn, 'function');
  }

  // The topology is exactly Brown's paired figures: one translating piston
  // tappet, two independently pivoted handles, one central diagonal catch,
  // three fixed axes, and three vertical back-weight rods. Movement 183's
  // replacement quadrants are deliberately absent.
  for (const object of [
    catchBackbone,
    catchEye,
    catchGroup,
    catchHub,
    catchIndex,
    catchPivot,
    catchPivotHead,
    catchPivotShaft,
    catchPivotSlot,
    catchWeight,
    catchWeightAnchor,
    catchWeightAssembly,
    catchWeightArm,
    catchWeightRod,
    frameSpine,
    lowerCrossbar,
    lowerHandle,
    lowerHandleContactAnchor,
    lowerHandleContactRoller,
    lowerHandleHub,
    lowerHandleIndex,
    lowerHandleLatchAnchor,
    lowerHandleLatchArm,
    lowerHandleLatchRoller,
    lowerHandleWeightAnchor,
    lowerHandleWeightArm,
    lowerHandleWorkingArm,
    lowerHandleWorkingTip,
    lowerHook,
    lowerLatchMarker,
    lowerPivot,
    lowerPivotHead,
    lowerPivotShaft,
    lowerPivotSlot,
    lowerSeatAnchor,
    lowerWeight,
    lowerWeightAssembly,
    lowerWeightRod,
    pistonGroup,
    pistonGuide,
    pistonRod,
    tappet,
    tappetAnchor,
    tappetContactMarker,
    tappetIndex,
    upperCrossbar,
    upperHandle,
    upperHandleContactAnchor,
    upperHandleContactRoller,
    upperHandleHub,
    upperHandleIndex,
    upperHandleLatchAnchor,
    upperHandleLatchArm,
    upperHandleLatchRoller,
    upperHandleWeightAnchor,
    upperHandleWeightArm,
    upperHandleWorkingArm,
    upperHandleWorkingTip,
    upperHook,
    upperLatchMarker,
    upperPivot,
    upperPivotHead,
    upperPivotShaft,
    upperPivotSlot,
    upperSeatAnchor,
    upperWeight,
    upperWeightAssembly,
    upperWeightRod,
  ]) {
    assert.ok(object?.isObject3D, `${object?.userData?.role ?? 'block'} is 3D`);
  }
  assert.equal(upperHandle.parent, model.root);
  assert.equal(lowerHandle.parent, model.root);
  assert.equal(catchGroup.parent, model.root);
  assert.equal(pistonGroup.parent, model.root);
  assert.equal(upperWeightAssembly.parent, model.root);
  assert.equal(lowerWeightAssembly.parent, model.root);
  assert.equal(catchWeightAssembly.parent, model.root);
  assert.equal(upperPivot.parent, model.root);
  assert.equal(lowerPivot.parent, model.root);
  assert.equal(catchPivot.parent, model.root);
  assert.equal(upperHandleWorkingArm.parent, upperHandle);
  assert.equal(lowerHandleWorkingArm.parent, lowerHandle);
  assert.equal(upperHandleWeightArm.parent, upperHandle);
  assert.equal(lowerHandleWeightArm.parent, lowerHandle);
  assert.equal(upperHandleLatchArm.parent, upperHandle);
  assert.equal(lowerHandleLatchArm.parent, lowerHandle);
  assert.equal(catchBackbone.parent, catchGroup);
  assert.equal(catchWeightArm.parent, catchGroup);
  assert.equal(upperHook.parent, catchGroup);
  assert.equal(lowerHook.parent, catchGroup);
  assert.equal(pistonRod.parent, pistonGroup);
  assert.equal(tappet.parent, pistonGroup);
  assert.equal(upperPivot.userData.fixed, true);
  assert.equal(lowerPivot.userData.fixed, true);
  assert.equal(catchPivot.userData.fixed, true);
  assert.equal(geometry.axis.equals(new THREE.Vector3(0, 0, 1)), true);
  const quadrantObjects = [];
  model.root.traverse((object) => {
    if (/quadrant/i.test(object.userData.role ?? '')) quadrantObjects.push(object);
  });
  assert.equal(quadrantObjects.length, 0);

  // Locks measured from the two 525 px public-domain engravings. Movement
  // 181 supplies the common fixed axes and source pose; 182 supplies the
  // second rigid-body directions and top tappet position.
  assert.equal(geometry.sourceImageWidth, 525);
  assert.equal(geometry.sourceImageHeight, 525);
  near(geometry.sourceScale, 0.0125, 0, 'source scale');
  assert.deepEqual(geometry.source181CatchPivot.toArray(), [271, 234]);
  assert.deepEqual(geometry.source181UpperPivot.toArray(), [275, 122]);
  assert.deepEqual(geometry.source181LowerPivot.toArray(), [273, 351]);
  assert.equal(geometry.source181PistonRodCenterX, 177);
  assert.deepEqual(geometry.source181TappetCenter.toArray(), [183, 365]);
  assert.deepEqual(geometry.source181UpperWeightPin.toArray(), [402, 54]);
  assert.deepEqual(geometry.source181LowerWeightPin.toArray(), [137, 422]);
  assert.deepEqual(geometry.source181CatchWeightPin.toArray(), [370, 354]);
  assert.deepEqual(geometry.source181LowerFreeTip.toArray(), [82, 315]);
  assert.deepEqual(geometry.source181LowerContact.toArray(), [177, 320]);
  assert.deepEqual(geometry.source181UpperLatchSeat.toArray(), [202, 137]);
  assert.deepEqual(geometry.source181LowerLatchSeat.toArray(), [354, 348]);
  assert.deepEqual(geometry.source182CatchPivot.toArray(), [270, 236]);
  assert.deepEqual(geometry.source182UpperPivot.toArray(), [273, 120]);
  assert.deepEqual(geometry.source182LowerPivot.toArray(), [269, 351]);
  assert.deepEqual(geometry.source182TappetCenter.toArray(), [184, 79]);
  assert.deepEqual(geometry.source182UpperWeightPin.toArray(), [408, 170]);
  assert.deepEqual(geometry.source182LowerWeightPin.toArray(), [127, 305]);
  assert.deepEqual(geometry.source182CatchWeightPin.toArray(), [370, 359]);
  assert.deepEqual(geometry.source182UpperFreeTip.toArray(), [66, 154]);
  assert.deepEqual(geometry.source182UpperContact.toArray(), [177, 154]);
  vector2Near(geometry.catchPivot, new THREE.Vector2(0, 0), 0,
    'central catch pivot is the model origin');
  vector2Near(geometry.upperPivot, new THREE.Vector2(0.05, 1.4), 1e-14,
    'upper fixed pivot');
  vector2Near(geometry.lowerPivot, new THREE.Vector2(0.025, -1.4625), 1e-14,
    'lower fixed pivot');
  near(geometry.pistonRodX, -1.175, 1e-14, 'piston rod guide x');
  near(geometry.source181PistonY, -1.6375, 1e-14,
    'source 181 tappet height');
  near(geometry.source182PistonY, 1.9625, 1e-14,
    'source 182 tappet height');
  near(geometry.source182UpperAngle, -0.846296296534586, 1e-15,
    'upper handle rigid rotation between source figures');
  near(geometry.source182LowerAngle, -0.7944147174651272, 1e-15,
    'lower handle rigid rotation between source figures');
  assert.ok(geometry.source182UpperAngle < 0);
  assert.ok(geometry.source182LowerAngle < 0);
  assert.ok(geometry.upperSource182WeightResidual < 0.10,
    'upper weight-arm radius agrees in both engravings within one tenth pixel');
  assert.ok(geometry.lowerSource182WeightResidual < 4.16,
    'lower weight-arm radius engraving drift remains below five pixels');
  assert.ok(geometry.catchSource182WeightResidual < 2.96,
    'catch weight-arm radius engraving drift remains below three pixels');
  for (const sourcePoint of [
    geometry.source181CatchPivot,
    geometry.source181UpperPivot,
    geometry.source181LowerPivot,
    geometry.source181TappetCenter,
    geometry.source181UpperWeightPin,
    geometry.source181LowerWeightPin,
    geometry.source181CatchWeightPin,
  ]) {
    vector2Near(
      modelPointToSource181(source181PointToModel(sourcePoint)),
      sourcePoint,
      1e-12,
      `source/model raster round trip for ${sourcePoint.toArray()}`,
    );
  }
  const sampleSourceVector = new THREE.Vector2(37, -49);
  vector2Near(
    modelVectorToSource(sourceVectorToModel(
      sampleSourceVector,
      new THREE.Vector2(0, 0),
    )),
    sampleSourceVector,
    1e-12,
    'source/model vector round trip',
  );

  const source181 = canonicalStates.source181Ascending;
  const source182 = canonicalStates.source182Top;
  const source181Returned = canonicalStates.source181Returned;
  assert.equal(
    source181.canonicalStage,
    'source-181-lower-steam-and-upper-eduction-open',
  );
  assert.equal(
    source182.canonicalStage,
    'source-182-upper-steam-and-lower-eduction-open',
  );
  assert.equal(
    source181Returned.canonicalStage,
    'source-181-returned-after-full-cycle',
  );
  near(source181.pistonPosition.y, geometry.source181PistonY, 0,
    'source 181 piston pose');
  near(source181.upperHandleAngle, 0, 0, 'source 181 upper handle angle');
  near(source181.lowerHandleAngle, 0, 0, 'source 181 lower handle angle');
  near(source181.catchAngle, 0, 0, 'source 181 stable catch angle');
  near(source181.upperLatchGap, 0, 1e-15, 'source 181 upper latch seated');
  assert.ok(source181.lowerLatchGap > 0.78,
    'source 181 lower handle is clear of the catch seat');
  near(source181.upperLatchEngagement, 1, 0,
    'source 181 upper handle is caught');
  near(source181.lowerLatchEngagement, 0, 0,
    'source 181 lower handle is free');
  near(source181.lowerSteamOpenFraction, 1, 0,
    'source 181 lower steam valve is open');
  near(source181.upperEductionOpenFraction, 1, 0,
    'source 181 upper eduction valve is open');
  near(source181.upperSteamOpenFraction, 0, 0,
    'source 181 upper steam valve is shut');
  near(source181.lowerEductionOpenFraction, 0, 0,
    'source 181 lower eduction valve is shut');
  vector2Near(
    source181.upperWeightPin,
    source181PointToModel(geometry.source181UpperWeightPin),
    1e-14,
    'source 181 upper weight pin',
  );
  vector2Near(
    source181.lowerWeightPin,
    source181PointToModel(geometry.source181LowerWeightPin),
    1e-14,
    'source 181 lower weight pin',
  );
  vector2Near(
    source181.catchWeightPin,
    source181PointToModel(geometry.source181CatchWeightPin),
    1e-14,
    'source 181 catch weight pin',
  );

  near(source182.pistonPosition.y, geometry.source182PistonY, 0,
    'source 182 top tappet pose');
  near(source182.upperHandleAngle, geometry.source182UpperAngle, 1e-15,
    'source 182 upper handle angle');
  near(source182.lowerHandleAngle, geometry.source182LowerAngle, 1e-15,
    'source 182 lower handle angle');
  near(source182.catchAngle, 0, 0, 'source 182 stable catch angle');
  near(source182.lowerLatchGap, 0, 3e-15, 'source 182 lower latch seated');
  assert.ok(source182.upperLatchGap > 0.76,
    'source 182 upper handle is clear of the catch seat');
  near(source182.upperLatchEngagement, 0, 0,
    'source 182 upper handle is free');
  near(source182.lowerLatchEngagement, 1, 0,
    'source 182 lower handle is caught');
  near(source182.upperSteamOpenFraction, 1, 0,
    'source 182 upper steam valve is open');
  near(source182.lowerEductionOpenFraction, 1, 0,
    'source 182 lower eduction valve is open');
  near(source182.lowerSteamOpenFraction, 0, 0,
    'source 182 lower steam valve is shut');
  near(source182.upperEductionOpenFraction, 0, 0,
    'source 182 upper eduction valve is shut');
  const upper182Direction = source182.upperWeightPin.clone()
    .sub(geometry.upperPivot).normalize();
  const measuredUpper182Direction = sourceVectorToModel(
    geometry.source182UpperWeightPin,
    geometry.source182UpperPivot,
  ).normalize();
  vector2Near(upper182Direction, measuredUpper182Direction, 1e-14,
    'source 182 upper back-weight direction');
  const lower182Direction = source182.lowerWeightPin.clone()
    .sub(geometry.lowerPivot).normalize();
  const measuredLower182Direction = sourceVectorToModel(
    geometry.source182LowerWeightPin,
    geometry.source182LowerPivot,
  ).normalize();
  vector2Near(lower182Direction, measuredLower182Direction, 1e-14,
    'source 182 lower back-weight direction');
  assert.ok(source182.upperWeightPin.y < source181.upperWeightPin.y,
    'the released upper back weight falls on the ascending trip');
  assert.ok(source181.lowerWeightPin.y < source182.lowerWeightPin.y,
    'the released lower back weight falls on the descending trip');
  vector3Near(
    source181Returned.pistonPosition,
    source181.pistonPosition,
    0,
    'full cycle returns the source 181 tappet pose',
  );
  near(source181Returned.upperHandleAngle, source181.upperHandleAngle, 0,
    'full cycle returns the upper handle');
  near(source181Returned.lowerHandleAngle, source181.lowerHandleAngle, 0,
    'full cycle returns the lower handle');

  // Exhaustive cycle audit: only one tappet contact is active, the correct
  // handle is driven on each stroke, the four valves swap diagonal pairs,
  // all three weight arms remain rigid, and the piston never leaves its two
  // source-locked endpoint positions.
  const sampleCount = 32768;
  const stageOrder = [];
  let previousStage;
  let lowerTripSamples = 0;
  let upperTripSamples = 0;
  let maximumLowerContactError = 0;
  let maximumUpperContactError = 0;
  let maximumCatchDeflection = 0;
  let minimumPistonY = Infinity;
  let maximumPistonY = -Infinity;
  let maximumUpperRadiusError = 0;
  let maximumLowerRadiusError = 0;
  let maximumCatchRadiusError = 0;
  for (let index = 0; index <= sampleCount; index += 1) {
    const phase = index / sampleCount;
    const state = stateAtCyclePhase(phase);
    if (state.stage !== previousStage) {
      stageOrder.push(state.stage);
      previousStage = state.stage;
    }
    for (const value of [
      state.catchAngle,
      state.catchAngularAcceleration,
      state.catchAngularVelocity,
      state.lowerEductionOpenFraction,
      state.lowerHandleAngle,
      state.lowerHandleAngularAcceleration,
      state.lowerHandleAngularVelocity,
      state.lowerLatchEngagement,
      state.lowerLatchGap,
      state.lowerSteamOpenFraction,
      state.pistonAcceleration,
      state.pistonPosition.y,
      state.pistonVelocity.y,
      state.topStateAcceleration,
      state.topStateBlend,
      state.topStateVelocity,
      state.upperEductionOpenFraction,
      state.upperHandleAngle,
      state.upperHandleAngularAcceleration,
      state.upperHandleAngularVelocity,
      state.upperLatchEngagement,
      state.upperLatchGap,
      state.upperSteamOpenFraction,
      ...state.upperWeightPin.toArray(),
      ...state.lowerWeightPin.toArray(),
      ...state.catchWeightPin.toArray(),
      ...state.upperHandleContactPoint.toArray(),
      ...state.lowerHandleContactPoint.toArray(),
    ]) {
      assert.equal(Number.isFinite(value), true, `finite cycle value at ${phase}`);
    }
    assert.ok(state.topStateBlend >= -1e-15 && state.topStateBlend <= 1 + 1e-15);
    assert.ok(state.upperLatchEngagement >= -1e-15);
    assert.ok(state.lowerLatchEngagement >= -1e-15);
    near(state.upperLatchEngagement + state.lowerLatchEngagement, 1, 1e-14,
      `one complementary catch state at phase ${phase}`);
    near(state.upperSteamOpenFraction + state.lowerSteamOpenFraction, 1, 1e-14,
      `steam valves are complementary at phase ${phase}`);
    near(state.upperEductionOpenFraction + state.lowerEductionOpenFraction, 1, 1e-14,
      `eduction valves are complementary at phase ${phase}`);
    near(state.upperSteamOpenFraction, state.lowerEductionOpenFraction, 1e-14,
      `upper-steam/lower-eduction diagonal pair at ${phase}`);
    near(state.lowerSteamOpenFraction, state.upperEductionOpenFraction, 1e-14,
      `lower-steam/upper-eduction diagonal pair at ${phase}`);
    assert.ok(state.upperHandleAngle <= 1e-14);
    assert.ok(state.upperHandleAngle >= geometry.source182UpperAngle - 1e-14);
    assert.ok(state.lowerHandleAngle <= 1e-14);
    assert.ok(state.lowerHandleAngle >= geometry.source182LowerAngle - 1e-14);
    minimumPistonY = Math.min(minimumPistonY, state.pistonPosition.y);
    maximumPistonY = Math.max(maximumPistonY, state.pistonPosition.y);
    assert.ok(state.pistonPosition.y >= geometry.source181PistonY - 1e-13);
    assert.ok(state.pistonPosition.y <= geometry.source182PistonY + 1e-13);
    maximumCatchDeflection = Math.max(
      maximumCatchDeflection,
      Math.abs(state.catchAngle),
    );
    assert.ok(Math.abs(state.catchAngle) <= geometry.catchTripDeflection + 1e-14);
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
    if (state.activeContact === 'lower-handle') {
      lowerTripSamples += 1;
      maximumLowerContactError = Math.max(
        maximumLowerContactError,
        Math.abs(state.lowerTappetContactError),
      );
      near(state.lowerTappetContactError, 0, 2e-14,
        `lower tappet rolling contact at ${phase}`);
      assert.ok(state.pistonVelocity.y >= -1e-13,
        `ascending tappet drives the lower handle at ${phase}`);
      assert.ok(state.activeContactPoint.x >= geometry.tappetShoeLeftX - 1e-12);
      assert.ok(state.activeContactPoint.x <= geometry.tappetShoeRightX + 1e-12);
    } else if (state.activeContact === 'upper-handle') {
      upperTripSamples += 1;
      maximumUpperContactError = Math.max(
        maximumUpperContactError,
        Math.abs(state.upperTappetContactError),
      );
      near(state.upperTappetContactError, 0, 2e-14,
        `upper tappet rolling contact at ${phase}`);
      assert.ok(state.pistonVelocity.y <= 1e-13,
        `descending tappet drives the upper handle at ${phase}`);
      assert.ok(state.activeContactPoint.x >= geometry.tappetShoeLeftX - 1e-12);
      assert.ok(state.activeContactPoint.x <= geometry.tappetShoeRightX + 1e-12);
    } else {
      assert.equal(state.activeContactPoint, null);
    }
  }
  assert.deepEqual(stageOrder, [
    'source-181-ascending-stroke-pose-hold',
    'ascending-tappet-approaches-lower-handle',
    'ascending-tappet-trips-lower-handle-and-releases-upper',
    'ascending-after-valve-reversal-to-top',
    'source-182-top-of-cylinder-pose-hold',
    'descending-tappet-approaches-upper-handle',
    'descending-tappet-trips-upper-handle-and-releases-lower',
    'descending-after-valve-reversal-to-bottom',
    'source-181-returned-pose-hold',
  ]);
  assert.ok(lowerTripSamples > 4500);
  assert.ok(upperTripSamples > 4500);
  near(minimumPistonY, geometry.source181PistonY, 0,
    'cycle reaches source 181 piston endpoint');
  near(maximumPistonY, geometry.source182PistonY, 0,
    'cycle reaches source 182 piston endpoint');
  near(maximumCatchDeflection, geometry.catchTripDeflection, 2e-8,
    'catch rocks through its complete release pulse');
  assert.ok(maximumLowerContactError < 2e-14);
  assert.ok(maximumUpperContactError < 2e-14);
  assert.ok(maximumUpperRadiusError < 7e-16);
  assert.ok(maximumLowerRadiusError < 7e-16);
  assert.ok(maximumCatchRadiusError < 7e-16);

  // Analytic velocities and accelerations keep the impact-driven sequence
  // visually smooth. Every stage boundary is C2, including the catch's
  // temporary release pulse, and finite differences agree away from breaks.
  const boundaryPhases = [0, ...Object.values(geometry.sequenceBreaks), 1];
  for (const phase of boundaryPhases) {
    const state = stateAtCyclePhase(phase);
    near(state.pistonVelocity.y, 0, 1e-13,
      `zero piston velocity at boundary ${phase}`);
    near(state.pistonAcceleration, 0, 1e-12,
      `zero piston acceleration at boundary ${phase}`);
    near(state.upperHandleAngularVelocity, 0, 1e-13,
      `zero upper angular velocity at boundary ${phase}`);
    near(state.upperHandleAngularAcceleration, 0, 1e-12,
      `zero upper angular acceleration at boundary ${phase}`);
    near(state.lowerHandleAngularVelocity, 0, 1e-13,
      `zero lower angular velocity at boundary ${phase}`);
    near(state.lowerHandleAngularAcceleration, 0, 1e-12,
      `zero lower angular acceleration at boundary ${phase}`);
    near(state.catchAngularVelocity, 0, 1e-13,
      `zero catch angular velocity at boundary ${phase}`);
    near(state.catchAngularAcceleration, 0, 1e-12,
      `zero catch angular acceleration at boundary ${phase}`);
  }
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
    const centralFirst = (after.pistonPosition.y - before.pistonPosition.y)
      / (2 * timeStep);
    const centralSecond = (after.pistonVelocity.y - before.pistonVelocity.y)
      / (2 * timeStep);
    maximumPistonVelocityError = Math.max(
      maximumPistonVelocityError,
      Math.abs(centralFirst - state.pistonVelocity.y),
    );
    maximumPistonAccelerationError = Math.max(
      maximumPistonAccelerationError,
      Math.abs(centralSecond - state.pistonAcceleration),
    );
    const upperFirst = (after.upperHandleAngle - before.upperHandleAngle)
      / (2 * timeStep);
    const upperSecond = (
      after.upperHandleAngularVelocity - before.upperHandleAngularVelocity
    ) / (2 * timeStep);
    maximumUpperVelocityError = Math.max(
      maximumUpperVelocityError,
      Math.abs(upperFirst - state.upperHandleAngularVelocity),
    );
    maximumUpperAccelerationError = Math.max(
      maximumUpperAccelerationError,
      Math.abs(upperSecond - state.upperHandleAngularAcceleration),
    );
    const lowerFirst = (after.lowerHandleAngle - before.lowerHandleAngle)
      / (2 * timeStep);
    const lowerSecond = (
      after.lowerHandleAngularVelocity - before.lowerHandleAngularVelocity
    ) / (2 * timeStep);
    maximumLowerVelocityError = Math.max(
      maximumLowerVelocityError,
      Math.abs(lowerFirst - state.lowerHandleAngularVelocity),
    );
    maximumLowerAccelerationError = Math.max(
      maximumLowerAccelerationError,
      Math.abs(lowerSecond - state.lowerHandleAngularAcceleration),
    );
    const catchFirst = (after.catchAngle - before.catchAngle) / (2 * timeStep);
    const catchSecond = (
      after.catchAngularVelocity - before.catchAngularVelocity
    ) / (2 * timeStep);
    maximumCatchVelocityError = Math.max(
      maximumCatchVelocityError,
      Math.abs(catchFirst - state.catchAngularVelocity),
    );
    maximumCatchAccelerationError = Math.max(
      maximumCatchAccelerationError,
      Math.abs(catchSecond - state.catchAngularAcceleration),
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
  assert.ok(maximumUpperVelocityError < 8e-8);
  assert.ok(maximumUpperAccelerationError < 2e-7);
  assert.ok(maximumLowerVelocityError < 8e-8);
  assert.ok(maximumLowerAccelerationError < 2e-7);
  assert.ok(maximumCatchVelocityError < 2e-7);
  assert.ok(maximumCatchAccelerationError < 2e-6);
  assert.ok(maximumUpperWeightVelocityError < 2e-7);
  assert.ok(maximumLowerWeightVelocityError < 2e-7);

  // Rendered anchors, vertical weights, fixed shafts, and contact markers all
  // follow the same audited state rather than a separate visual approximation.
  model.root.updateMatrixWorld(true);
  const fixedPivotMatrices = [upperPivot, lowerPivot, catchPivot].map(
    (pivot) => pivot.matrix.clone(),
  );
  model.update(0, 0);
  model.root.updateMatrixWorld(true);
  vector3Near(
    worldPoint(lowerHandleWorkingTip),
    new THREE.Vector3(
      source181PointToModel(geometry.source181LowerFreeTip).x,
      source181PointToModel(geometry.source181LowerFreeTip).y,
      geometry.handlePlaneZ,
    ),
    1e-12,
    'rendered lower free handle tip matches source 181',
  );
  vector3Near(
    worldPoint(upperHandleWeightAnchor),
    new THREE.Vector3(
      source181.upperWeightPin.x,
      source181.upperWeightPin.y,
      geometry.handlePlaneZ,
    ),
    1e-12,
    'rendered upper back-weight anchor matches source 181',
  );
  vector3Near(
    worldPoint(lowerHandleWeightAnchor),
    new THREE.Vector3(
      source181.lowerWeightPin.x,
      source181.lowerWeightPin.y,
      geometry.handlePlaneZ,
    ),
    1e-12,
    'rendered lower back-weight anchor matches source 181',
  );
  vector3Near(
    worldPoint(catchWeightAnchor),
    new THREE.Vector3(
      source181.catchWeightPin.x,
      source181.catchWeightPin.y,
      geometry.catchPlaneZ,
    ),
    1e-12,
    'rendered catch back-weight anchor matches source 181',
  );
  assert.equal(upperLatchMarker.visible, true);
  assert.equal(lowerLatchMarker.visible, false);
  assert.equal(tappetContactMarker.visible, false);
  near(upperWeightRod.rotation.z, 0, 0, 'upper weight rod stays vertical');
  near(lowerWeightRod.rotation.z, 0, 0, 'lower weight rod stays vertical');
  near(catchWeightRod.rotation.z, 0, 0, 'catch weight rod stays vertical');

  const source182Phase = (
    geometry.sequenceBreaks.upwardOvertravelEnd
      + geometry.sequenceBreaks.source182HoldEnd
  ) / 2;
  model.update(source182Phase * geometry.cyclePeriod, 0);
  model.root.updateMatrixWorld(true);
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
    'rendered upper free handle tip matches source 182 after pivot registration',
  );
  vector3Near(
    worldPoint(upperHandleContactAnchor),
    new THREE.Vector3(
      source182.upperHandleContactPoint.x,
      source182.upperHandleContactPoint.y,
      geometry.handlePlaneZ,
    ),
    1e-11,
    'rendered upper tappet contact matches the top-pose state',
  );
  near(upperHandle.rotation.z, geometry.source182UpperAngle, 1e-15,
    'rendered upper top-pose angle');
  near(lowerHandle.rotation.z, geometry.source182LowerAngle, 1e-15,
    'rendered lower top-pose angle');
  near(catchGroup.rotation.z, 0, 1e-15, 'catch returns after the trip pulse');
  near(pistonGroup.position.y, geometry.source182PistonY, 1e-15,
    'rendered piston reaches source 182 height');
  assert.equal(upperLatchMarker.visible, false);
  assert.equal(lowerLatchMarker.visible, true);
  assert.equal(tappetContactMarker.visible, false);

  const lowerTripPhase = (
    geometry.sequenceBreaks.upwardApproachEnd
      + geometry.sequenceBreaks.lowerTripEnd
  ) / 2;
  const lowerTripState = stateAtCyclePhase(lowerTripPhase);
  model.update(lowerTripPhase * geometry.cyclePeriod, 0);
  model.root.updateMatrixWorld(true);
  assert.equal(tappetContactMarker.visible, true);
  vector3Near(
    tappetContactMarker.position,
    new THREE.Vector3(
      lowerTripState.activeContactPoint.x,
      lowerTripState.activeContactPoint.y,
      geometry.handlePlaneZ + geometry.handleDepth / 2 + 0.20,
    ),
    1e-14,
    'visible lower-trip marker follows the exact contact',
  );
  for (const [pivot, matrix] of [upperPivot, lowerPivot, catchPivot].map(
    (pivot, index) => [pivot, fixedPivotMatrices[index]],
  )) {
    assert.deepEqual(pivot.matrix.elements, matrix.elements,
      `${pivot.userData.role} remains fixed through the cycle`);
  }

  const frameFrontZ = geometry.frameCenterZ + geometry.frameDepth / 2;
  const handleBottomZ = geometry.handlePlaneZ - geometry.handleDepth / 2;
  const handleTopZ = geometry.handlePlaneZ + geometry.handleDepth / 2;
  const catchBottomZ = geometry.catchPlaneZ - geometry.catchDepth / 2;
  const catchTopZ = geometry.catchPlaneZ + geometry.catchDepth / 2;
  assert.ok(handleBottomZ > frameFrontZ,
    'both valve handles clear the rear fixed frame');
  assert.ok(handleTopZ < catchBottomZ,
    'the handle plates pass behind the diagonal catch without interpenetration');
  assert.ok(catchTopZ > handleTopZ,
    'the diagonal catch is visibly the front latch layer');
  assert.ok(tappet.geometry.parameters.depth > geometry.handleDepth,
    'the projecting tappet spans the handle contact plane');
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 4.37,
    'free handles and all three back-weight eyes span the source width');
  assert.ok(size.y > 7.84,
    'piston guide and hanging weights occupy the complete stroke height');
  assert.ok(size.z > 1.35,
    'frame, handles, latch rollers, catch, and fixed heads occupy real depth');
  assert.ok(bounds.min.z < -0.73);
  assert.ok(bounds.max.z > 0.61);
  near(model.root.userData.cameraDistanceScale, 1.18, 0,
    'source-complete portrait camera scale');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 3);

  // The paired Movement 182 top-position variant and Movement 183's
  // mechanically distinct quadrant replacement are independently authored.
  const movement180 = createMovementModel(catalog.movements[179]);
  const movement182 = createMovementModel(catalog.movements[181]);
  const movement183 = createMovementModel(catalog.movements[182]);
  assert.equal(movement180.root.userData.fidelity, 'authored');
  assert.equal(
    movement180.root.userData.mechanism,
    'fixed-straight-side-piece-single-screw-pivoted-eccentric-jaw-upward-friction-self-clamping-board',
  );
  assert.notEqual(
    movement180.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.equal(catalog.movements[181].fidelity, 'authored');
  assert.equal(movement182.root.userData.fidelity, 'authored');
  assert.equal(
    movement182.root.userData.mechanism,
    'top-position-descending-piston-tappet-trips-upper-valve-handle-diagonal-catch-releases-lower-backweighted-handle-and-restores-four-valves',
  );
  assert.notEqual(
    movement182.root.userData.mechanism,
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

  disposeModel(movement180.root);
  disposeModel(movement182.root);
  disposeModel(movement183.root);
  disposeModel(model.root);
});
