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
  'breast-water-wheel-with-axle-level-inlet-and-fixed-close-fitting-channel-forming-moving-buckets';
const FULL_TURN = Math.PI * 2;

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function sameAngle(actual, expected, tolerance, message) {
  near(Math.sin(actual), Math.sin(expected), tolerance, `${message} sine`);
  near(Math.cos(actual), Math.cos(expected), tolerance, `${message} cosine`);
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

test('movement 432 uses sixteen moving float boards and a fixed close-fitting breast to form temporary buckets', () => {
  const movement = catalog.movements[431];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 432);
  assert.equal(movement.number, '432');
  assert.equal(movement.category, 'Water wheels & turbines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /spaces between successive radial float-boards/);
  assert.match(data.mechanism, /stationary channel fitted closely.*supplies its missing outer wall/);
  assert.match(data.mechanism, /produces clockwise torque/);
  assert.match(data.mechanism, /breast, inlet gate, and race remain fixed/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.bucketWaterFillIndependent, false);
  assert.equal(degreesOfFreedom.inletGateOpeningAnimated, false);
  assert.equal(geometry.floatCount, 16);
  assert.equal(geometry.spokeCount, 8);
  assert.equal(blocks.floatBoards.length, 16);
  assert.equal(blocks.bucketWaterBodies.length, 16);
  assert.equal(blocks.bucketWaterLoads.length, 16);
  assert.equal(blocks.breastChannelRails.length, 48);
  for (const floatBoard of blocks.floatBoards) {
    assert.equal(floatBoard.parent, blocks.rotor);
  }
  for (const waterLoad of blocks.bucketWaterLoads) {
    assert.equal(waterLoad.parent, blocks.rotor);
  }
  assert.equal(blocks.hub.parent, blocks.rotor);
  assert.equal(blocks.rotationMarker.parent, blocks.rotor);
  for (const fixed of [blocks.shaft, blocks.headrace, blocks.headraceWater,
    blocks.gateTower, blocks.gateLeaf, blocks.gateStem, blocks.feedWater,
    blocks.channelWater, blocks.tailrace, blocks.foundation]) {
    assert.equal(fixed.parent, model.root);
  }
  assert.ok(geometry.breastInnerRadius > geometry.wheelOuterRadius,
    'the fixed breast clears the rotating float tips');
  assert.ok(geometry.breastInnerRadius - geometry.wheelOuterRadius < 0.25,
    'the breast is close enough to close the moving cavities');

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.filter((role) =>
    /^breast-wheel-float-board-\d+-of-sixteen$/.test(role)).length, 16);
  assert.equal(roles.filter((role) =>
    /^breast-wheel-spoke-\d+-of-eight$/.test(role)).length, 8);
  for (const role of [
    'fixed-headrace-nearly-level-with-wheel-axle',
    'water-confined-between-wheel-floats-and-close-fitting-breast-channel',
    'free-tailwater-after-breast-cell-discharge',
    'clockwise-breast-wheel-with-float-board-cells',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 432 preserves Brown’s caption and separates source evidence from engineered details', () => {
  const movement = catalog.movements[431];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate432;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_432.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /intermediate place between overshot and undershot wheels/);
  assert.match(movement.description,
    /cavities between are converted into buckets.*channel adapted to circumference and width/);
  assert.match(movement.description, /water enters nearly at the level of axle/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /static engraving and caption.*no Canvas construction/);
  assert.equal(dynamics.fluidPressureViscosityTurbulenceSplashLeakageImpactBearingFrictionWheelInertiaGeneratorLoadAndSpeedResponseModeled,
    false);
  assert.match(dynamics.bucketFillModel,
    /fixed inlet near axle level.*closed radially.*stationary close-fitting breast/);
  assert.match(dynamics.gravityTorqueDiagnostic,
    /exact moment.*speed is prescribed.*hydrodynamics are not integrated/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.shaftApproximateCenterPixels, [187, 269]);
  assert.deepEqual(plate.inletApproximatePixels, [347, 288]);
  assert.deepEqual(plate.sluiceApproximateCenterPixels, [424, 189]);
  assert.equal(plate.approximateFloatBoardCount, 16);
  assert.equal(plate.approximateSpokeCount, 8);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.engravingEvidence,
    /right-side sluice.*close curved breast.*clockwise/);
  assert.match(evidence.reconstructionDisclosure,
    /Sixteen equal floats.*fill and drain angles.*independently engineered/);
  disposeModel(model.root);
});

test('movement 432 source pose uniformly alternates float dividers and inter-float water cells', () => {
  const model = createMovementModel(catalog.movements[431]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);
  const pitch = FULL_TURN / geometry.floatCount;

  near(sourcePose.wheelAngle, 0, 0, 'source wheel angle');
  assert.equal(sourcePose.floatBoards.length, geometry.floatCount);
  assert.equal(sourcePose.bucketCells.length, geometry.floatCount);
  for (let index = 0; index < geometry.floatCount; index += 1) {
    const floatBoard = source.floatBoards[index];
    const next = source.floatBoards[(index + 1) % geometry.floatCount];
    const bucket = source.bucketCells[index];
    near(floatBoard.center.length(), geometry.floatCenterRadius, 4.5e-16,
      `float ${index + 1} center radius`);
    near(bucket.center.length(), geometry.bucketCenterRadius, 4.5e-16,
      `cell ${index + 1} center radius`);
    near(THREE.MathUtils.euclideanModulo(
      next.worldAngle - floatBoard.worldAngle,
      FULL_TURN,
    ), pitch, 1.8e-15, `float ${index + 1} pitch`);
    near(THREE.MathUtils.euclideanModulo(
      bucket.worldAngle - floatBoard.worldAngle,
      FULL_TURN,
    ), pitch / 2, 1.8e-15, `cell ${index + 1} lies between floats`);
    vectorNear(sourcePose.floatBoards[index].center,
      floatBoard.center, 0, `source float ${index + 1}`);
    vectorNear(sourcePose.bucketCells[index].center,
      bucket.center, 0, `source cell ${index + 1}`);
    near(sourcePose.bucketCells[index].waterFill,
      bucket.waterFill, 0, `source cell ${index + 1} fill`);
  }
  disposeModel(model.root);
});

test('movement 432 rims, float boards, and cell centers rotate clockwise as one wheel', () => {
  const model = createMovementModel(catalog.movements[431]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = -10000; sample <= 20000; sample += 1) {
    const inputAngle = FULL_TURN * sample / 10000;
    const state = stateAtInputAngle(inputAngle);
    sameAngle(state.wheelAngle, -inputAngle, 5e-15,
      'clockwise wheel coordinate');
    assert.ok(state.wheelAngularSpeed < 0);
    for (const floatBoard of state.floatBoards) {
      sameAngle(floatBoard.worldAngle,
        floatBoard.localAngle + state.wheelAngle, 5e-15,
        'rigid float attachment');
      near(floatBoard.center.length(), geometry.floatCenterRadius, 4.5e-16,
        'float remains between rims');
    }
    for (const bucket of state.bucketCells) {
      sameAngle(bucket.worldAngle,
        bucket.localAngle + state.wheelAngle, 5e-15,
        'cell rotates between its two floats');
      near(bucket.center.length(), geometry.bucketCenterRadius, 4.5e-16,
        'cell center stays on wheel');
    }
  }
  disposeModel(model.root);
});

test('movement 432 cells fill at axle height, remain loaded down the breast, and drain near the bottom', () => {
  const model = createMovementModel(catalog.movements[431]);
  const { geometry, waterFillAtWorldAngle } = model.root.userData;

  near(waterFillAtWorldAngle(geometry.inletAngle), 0, 0,
    'empty cell reaches inlet');
  near(waterFillAtWorldAngle(
    geometry.inletAngle - geometry.fillTravelAngle / 2,
  ), 0.5, 1.4e-15, 'half fill beneath axle-level inlet');
  near(waterFillAtWorldAngle(
    geometry.inletAngle - geometry.fillTravelAngle,
  ), 1, 0, 'cell full after inlet');
  near(waterFillAtWorldAngle(THREE.MathUtils.degToRad(-55)), 1, 0,
    'water retained down the right-hand breast');
  near(waterFillAtWorldAngle(
    geometry.inletAngle - (
      geometry.drainStartTravelAngle + geometry.drainEndTravelAngle
    ) / 2,
  ), 0.5, 5e-15, 'half drain near bottom');
  near(waterFillAtWorldAngle(
    geometry.inletAngle - geometry.drainEndTravelAngle,
  ), 0, 1e-15, 'cell empty before rising side');
  near(waterFillAtWorldAngle(Math.PI), 0, 0,
    'left rising side stays empty');
  disposeModel(model.root);
});

test('movement 432 cell filling and draining is smooth, bounded, and exactly periodic', () => {
  const model = createMovementModel(catalog.movements[431]);
  const { geometry, waterFillAtWorldAngle } = model.root.userData;
  const sampleCount = 100000;
  let previous = waterFillAtWorldAngle(geometry.inletAngle);
  let maximumStep = 0;

  for (let sample = 1; sample <= sampleCount; sample += 1) {
    const worldAngle = geometry.inletAngle
      - FULL_TURN * sample / sampleCount;
    const current = waterFillAtWorldAngle(worldAngle);
    assert.ok(current >= 0 && current <= 1);
    maximumStep = Math.max(maximumStep, Math.abs(current - previous));
    previous = current;
  }
  assert.ok(maximumStep < 3.8e-4);
  const epsilon = 1e-5;
  for (const travel of [
    0,
    geometry.fillTravelAngle,
    geometry.drainStartTravelAngle,
    geometry.drainEndTravelAngle,
    FULL_TURN,
  ]) {
    const before = waterFillAtWorldAngle(
      geometry.inletAngle - travel + epsilon,
    );
    const at = waterFillAtWorldAngle(geometry.inletAngle - travel);
    const after = waterFillAtWorldAngle(
      geometry.inletAngle - travel - epsilon,
    );
    assert.ok(Math.abs(before - at) < 2e-8);
    assert.ok(Math.abs(after - at) < 2e-8);
  }
  near(waterFillAtWorldAngle(0.37),
    waterFillAtWorldAngle(0.37 + FULL_TURN), 0,
    'fill schedule closes at one turn');
  disposeModel(model.root);
});

test('movement 432 retained cell water produces clockwise gravity torque at every phase', () => {
  const model = createMovementModel(catalog.movements[431]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let minimumTorque = Infinity;
  let maximumTorque = -Infinity;

  for (let sample = 0; sample <= 30000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 30000);
    const reconstructedTorque = state.bucketCells.reduce(
      (sum, bucket) => sum
        - bucket.waterFill * geometry.gravity * bucket.center.x,
      0,
    );
    const reconstructedMass = state.bucketCells.reduce(
      (sum, bucket) => sum + bucket.waterFill,
      0,
    );
    near(state.gravityTorqueNormalized, reconstructedTorque, 0,
      'sum of cell-water weight moments');
    near(state.retainedWaterMassNormalized, reconstructedMass, 0,
      'sum of retained cell water');
    assert.ok(state.gravityTorqueNormalized < -52.6);
    minimumTorque = Math.min(minimumTorque,
      state.gravityTorqueNormalized);
    maximumTorque = Math.max(maximumTorque,
      state.gravityTorqueNormalized);
  }
  assert.ok(minimumTorque > -62.2);
  assert.ok(maximumTorque < 0);
  disposeModel(model.root);
});

test('movement 432 analytic rim, float, and cell motion matches finite differences', () => {
  const model = createMovementModel(catalog.movements[431]);
  const { stateAtInputAngle } = model.root.userData;
  const angleStep = 1e-5;

  for (const angle of [0.17, 0.54, 0.93, 1.38, 1.84, 2.31,
    2.79, 3.27, 3.74, 4.22, 4.69, 5.16, 5.63, 6.09]) {
    const state = stateAtInputAngle(angle);
    const timeStep = angleStep / state.inputSpeed;
    const before = stateAtInputAngle(angle - angleStep);
    const after = stateAtInputAngle(angle + angleStep);
    const numericalRimVelocity = after.rimReferencePoint.clone()
      .sub(before.rimReferencePoint).multiplyScalar(1 / (2 * timeStep));
    const numericalRimAcceleration = after.rimReferenceVelocity.clone()
      .sub(before.rimReferenceVelocity)
      .multiplyScalar(1 / (2 * timeStep));
    vectorNear(numericalRimVelocity, state.rimReferenceVelocity, 5e-10,
      `rim velocity at ${angle}`);
    vectorNear(numericalRimAcceleration,
      state.rimReferenceAcceleration, 7e-10,
      `rim acceleration at ${angle}`);
    for (const index of [0, 5, 10]) {
      const numericalFloatVelocity = after.floatBoards[index].center.clone()
        .sub(before.floatBoards[index].center)
        .multiplyScalar(1 / (2 * timeStep));
      const numericalCellAcceleration =
        after.bucketCells[index].centerVelocity.clone()
          .sub(before.bucketCells[index].centerVelocity)
          .multiplyScalar(1 / (2 * timeStep));
      vectorNear(numericalFloatVelocity,
        state.floatBoards[index].centerVelocity, 4e-10,
        `float ${index + 1} velocity at ${angle}`);
      vectorNear(numericalCellAcceleration,
        state.bucketCells[index].centerAcceleration, 7e-10,
        `cell ${index + 1} acceleration at ${angle}`);
    }
  }
  disposeModel(model.root);
});

test('movement 432 update keeps the breast fixed and water surfaces level while the wheel turns', () => {
  const model = createMovementModel(catalog.movements[431]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const fixedBlocks = [blocks.shaft, blocks.headrace, blocks.gateTower,
    blocks.gateLeaf, blocks.gateStem, blocks.channelWater, blocks.tailrace,
    ...blocks.breastChannelRails];
  const fixedTransforms = fixedBlocks.map((block) => ({
    position: block.position.clone(),
    quaternion: block.quaternion.clone(),
  }));

  for (const time of [0, 0.23, 0.61, 1.04, 1.49, 1.97, 2.44,
    2.91, 3.39, 3.86, 4.34, 4.82, 5.29, 5.77]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.rotor.rotation.z, state.wheelAngle, 1.2e-16,
      'clockwise wheel update');
    for (let index = 0; index < geometry.floatCount; index += 1) {
      const waterLoad = blocks.bucketWaterLoads[index];
      sameAngle(blocks.rotor.rotation.z + waterLoad.rotation.z,
        0, 2.5e-16, `cell ${index + 1} horizontal water surface`);
      assert.equal(blocks.bucketWaterBodies[index].visible,
        state.bucketCells[index].waterFill > 0.002);
    }
    fixedBlocks.forEach((block, index) => {
      vectorNear(block.position, fixedTransforms[index].position, 0,
        'fixed breast position');
      near(block.quaternion.angleTo(fixedTransforms[index].quaternion),
        0, 5e-8, 'fixed breast orientation');
    });
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  vectorNear(closure.rimReferencePoint, source.rimReferencePoint, 0,
    'wheel cycle closure');
  near(closure.gravityTorqueNormalized, source.gravityTorqueNormalized, 0,
    'water-loading cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 6);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 432 breast-wheel geometry', () => {
  const movement432 = catalog.movements[431];
  const movement507 = catalog.movements[506];
  const model432 = createMovementModel(movement432);
  const model507 = createMovementModel(movement507);

  assert.equal(movement432.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model432.root);
  disposeModel(model507.root);
});
