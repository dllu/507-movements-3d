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
  'undershot-water-wheel-with-bottom-stream-impulse-on-radial-float-boards-turning-counterclockwise';
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

test('movement 431 is a bottom-stream undershot wheel with sixteen floats, eight spokes, and a lifting sluice', () => {
  const movement = catalog.movements[430];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 431);
  assert.equal(movement.number, '431');
  assert.equal(movement.category, 'Water wheels & turbines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /raised sluice gate.*left-to-right stream beneath the wheel/);
  assert.match(data.mechanism, /immersed radial float-boards below the shaft/);
  assert.match(data.mechanism, /positive, counterclockwise torque/);
  assert.match(data.mechanism, /no water is carried in buckets/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.paddleImpulseIndependent, false);
  assert.equal(degreesOfFreedom.sluiceGateOpeningAnimated, false);
  assert.equal(geometry.paddleCount, 16);
  assert.equal(geometry.spokeCount, 8);
  assert.equal(blocks.paddleBoards.length, 16);
  assert.equal(blocks.flowMarkers.length, 10);
  assert.equal(blocks.impulseIndicators.length, 3);
  for (const paddle of blocks.paddleBoards) assert.equal(paddle.parent, blocks.rotor);
  assert.equal(blocks.hub.parent, blocks.rotor);
  assert.equal(blocks.rotationMarker.parent, blocks.rotor);
  for (const fixed of [blocks.shaft, blocks.channelBed, blocks.channelWater,
    blocks.gateTower, blocks.gateLeaf, blocks.gateScrew, blocks.gateHandle]) {
    assert.equal(fixed.parent, model.root);
  }

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.filter((role) =>
    /^radial-float-board-\d+-of-sixteen$/.test(role)).length, 16);
  assert.equal(roles.filter((role) =>
    /^undershot-wheel-spoke-\d+-of-eight$/.test(role)).length, 8);
  for (const role of [
    'raised-sluice-gate-metering-bottom-flow',
    'left-to-right-lower-stream-driving-paddle-bottoms',
    'counterclockwise-undershot-wheel-with-radial-float-boards',
    'undershot-wheel-main-shaft-in-fixed-bearings',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 431 records the sparse Brown source honestly and identifies reconstruction choices', () => {
  const movement = catalog.movements[430];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate431;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_431.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(movement.description, '431. Undershot water-wheel.');
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /static engraving and two-word caption.*no Canvas construction/);
  assert.equal(dynamics.fluidPressureViscosityTurbulenceSplashLeakageImpactBearingFrictionWheelInertiaGeneratorLoadAndSpeedResponseModeled,
    false);
  assert.match(dynamics.dragModel,
    /smooth paddle immersion.*square of positive stream speed relative/);
  assert.match(dynamics.impulseTorqueDiagnostic,
    /exact moment -y\*F_x.*speed is prescribed/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.shaftApproximateCenterPixels, [345, 302]);
  assert.deepEqual(plate.sluiceGateApproximateCenterPixels, [153, 303]);
  assert.equal(plate.approximateFloatBoardCount, 16);
  assert.equal(plate.approximateSpokeCount, 8);
  assert.deepEqual(evidence.explicitInBrownDescription,
    ['the mechanism is an undershot water-wheel']);
  assert.match(evidence.engravingEvidence,
    /vertical lifting sluice.*left-to-right stream below the axle.*counterclockwise/);
  assert.match(evidence.reconstructionDisclosure,
    /Sixteen equal floats.*smooth immersion law.*independently engineered/);
  disposeModel(model.root);
});

test('movement 431 source pose spaces every rigid float uniformly around one wheel', () => {
  const model = createMovementModel(catalog.movements[430]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  near(sourcePose.wheelAngle, 0, 0, 'source wheel angle');
  assert.equal(sourcePose.paddles.length, geometry.paddleCount);
  for (let index = 0; index < geometry.paddleCount; index += 1) {
    const paddle = source.paddles[index];
    const next = source.paddles[(index + 1) % geometry.paddleCount];
    near(paddle.center.length(), geometry.paddleCenterRadius, 4.5e-16,
      `float ${index + 1} center radius`);
    near(THREE.MathUtils.euclideanModulo(
      next.worldAngle - paddle.worldAngle,
      FULL_TURN,
    ), FULL_TURN / geometry.paddleCount, 1.8e-15,
    `float ${index + 1} pitch`);
    vectorNear(sourcePose.paddles[index].center, paddle.center, 0,
      `source float ${index + 1} position`);
    near(sourcePose.paddles[index].immersion, paddle.immersion, 0,
      `source float ${index + 1} immersion`);
  }
  disposeModel(model.root);
});

test('movement 431 wheel and float boards rotate counterclockwise as one rigid body', () => {
  const model = createMovementModel(catalog.movements[430]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = -10000; sample <= 20000; sample += 1) {
    const inputAngle = FULL_TURN * sample / 10000;
    const state = stateAtInputAngle(inputAngle);
    sameAngle(state.wheelAngle, inputAngle, 5e-15,
      'counterclockwise wheel coordinate');
    assert.ok(state.wheelAngularSpeed > 0);
    for (const paddle of state.paddles) {
      sameAngle(paddle.worldAngle,
        paddle.localAngle + state.wheelAngle, 5e-15,
        'rigid float attachment');
      near(paddle.center.length(), geometry.paddleCenterRadius, 4.5e-16,
        'float stays on wheel');
      vectorNear(paddle.center,
        paddle.radial.clone().multiplyScalar(geometry.paddleCenterRadius),
        0, 'float radial construction');
    }
  }
  disposeModel(model.root);
});

test('movement 431 immersion law is bounded, smooth, and acts only below the water surface', () => {
  const model = createMovementModel(catalog.movements[430]);
  const { geometry, immersionAtPaddleCenterY, stateAtInputAngle } =
    model.root.userData;

  near(immersionAtPaddleCenterY(geometry.waterSurfaceY), 0, 0,
    'center at waterline');
  near(immersionAtPaddleCenterY(
    geometry.waterSurfaceY - geometry.paddleRadialLength / 2,
  ), 0.5, 1e-15, 'half immersed center');
  near(immersionAtPaddleCenterY(
    geometry.waterSurfaceY - geometry.paddleRadialLength,
  ), 1, 0, 'fully immersed center');
  near(immersionAtPaddleCenterY(geometry.waterSurfaceY + 2), 0, 0,
    'float above stream');
  near(immersionAtPaddleCenterY(geometry.channelBottomY), 1, 0,
    'deep float');

  let maximumStep = 0;
  let previous = stateAtInputAngle(0).paddles[0].immersion;
  for (let sample = 1; sample <= 100000; sample += 1) {
    const immersion = stateAtInputAngle(
      FULL_TURN * sample / 100000,
    ).paddles[0].immersion;
    assert.ok(immersion >= 0 && immersion <= 1);
    maximumStep = Math.max(maximumStep, Math.abs(immersion - previous));
    previous = immersion;
  }
  assert.ok(maximumStep < 4.2e-4);
  near(previous, stateAtInputAngle(0).paddles[0].immersion, 0,
    'one-turn immersion closure');
  disposeModel(model.root);
});

test('movement 431 stream force uses exact downstream relative speed and smooth immersion', () => {
  const model = createMovementModel(catalog.movements[430]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = 0; sample <= 20000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    for (const paddle of state.paddles) {
      const relative = Math.max(
        0,
        geometry.flowSpeed - paddle.centerVelocity.x,
      );
      const force = geometry.dragCoefficientNormalized
        * paddle.immersion * relative ** 2;
      near(paddle.relativeFlowSpeed, relative, 0,
        'positive stream-relative speed');
      near(paddle.dragForceX, force, 0,
        'immersed quadratic downstream force');
      vectorNear(paddle.dragForce, new THREE.Vector3(force, 0, 0), 0,
        'force acts downstream only');
      if (paddle.immersion === 0) near(paddle.dragForceX, 0, 0,
        'dry float receives no stream force');
    }
  }
  disposeModel(model.root);
});

test('movement 431 submerged float impulse produces counterclockwise torque at every phase', () => {
  const model = createMovementModel(catalog.movements[430]);
  const { stateAtInputAngle } = model.root.userData;
  let minimumTorque = Infinity;
  let maximumTorque = -Infinity;

  for (let sample = 0; sample <= 30000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 30000);
    const reconstructedTorque = state.paddles.reduce(
      (sum, paddle) => sum - paddle.center.y * paddle.dragForceX,
      0,
    );
    const reconstructedDrag = state.paddles.reduce(
      (sum, paddle) => sum + paddle.dragForceX,
      0,
    );
    near(state.totalImpulseTorqueNormalized, reconstructedTorque, 0,
      'sum of exact stream-force moments');
    near(state.totalDragForceNormalized, reconstructedDrag, 0,
      'sum of downstream forces');
    assert.ok(state.totalImpulseTorqueNormalized > 14.1);
    minimumTorque = Math.min(minimumTorque,
      state.totalImpulseTorqueNormalized);
    maximumTorque = Math.max(maximumTorque,
      state.totalImpulseTorqueNormalized);
  }
  assert.ok(minimumTorque > 0);
  assert.ok(maximumTorque < 15.6);
  disposeModel(model.root);
});

test('movement 431 analytic rim and float-board motion matches finite differences', () => {
  const model = createMovementModel(catalog.movements[430]);
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
    vectorNear(numericalRimVelocity, state.rimReferenceVelocity, 4e-10,
      `rim velocity at ${angle}`);
    vectorNear(numericalRimAcceleration,
      state.rimReferenceAcceleration, 6e-10,
      `rim acceleration at ${angle}`);
    for (const index of [0, 5, 10]) {
      const numericalPaddleVelocity = after.paddles[index].center.clone()
        .sub(before.paddles[index].center)
        .multiplyScalar(1 / (2 * timeStep));
      const numericalPaddleAcceleration =
        after.paddles[index].centerVelocity.clone()
          .sub(before.paddles[index].centerVelocity)
          .multiplyScalar(1 / (2 * timeStep));
      vectorNear(numericalPaddleVelocity,
        state.paddles[index].centerVelocity, 4e-10,
        `float ${index + 1} velocity at ${angle}`);
      vectorNear(numericalPaddleAcceleration,
        state.paddles[index].centerAcceleration, 7e-10,
        `float ${index + 1} acceleration at ${angle}`);
    }
  }
  disposeModel(model.root);
});

test('movement 431 update turns only the rotor while the sluice and channel remain fixed', () => {
  const model = createMovementModel(catalog.movements[430]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const fixedBlocks = [blocks.shaft, blocks.channelBed, blocks.channelWater,
    blocks.gateTower, blocks.gateLeaf, blocks.gateScrew, blocks.gateHandle];
  const fixedTransforms = fixedBlocks.map((block) => ({
    position: block.position.clone(),
    quaternion: block.quaternion.clone(),
  }));

  for (const time of [0, 0.23, 0.61, 1.04, 1.49, 1.97, 2.44,
    2.91, 3.39, 3.86, 4.34, 4.82, 5.29, 5.77]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.rotor.rotation.z, state.wheelAngle, 1.2e-16,
      'counterclockwise wheel update');
    fixedBlocks.forEach((block, index) => {
      vectorNear(block.position, fixedTransforms[index].position, 0,
        'fixed support position');
      near(block.quaternion.angleTo(fixedTransforms[index].quaternion),
        0, 0, 'fixed support orientation');
    });
    for (const marker of blocks.flowMarkers) {
      assert.ok(marker.position.x >= -4.20 && marker.position.x <= 4.20);
      assert.ok(marker.position.y < geometry.waterSurfaceY);
    }
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  vectorNear(closure.rimReferencePoint, source.rimReferencePoint, 0,
    'wheel cycle closure');
  near(closure.totalImpulseTorqueNormalized,
    source.totalImpulseTorqueNormalized, 0, 'torque cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 6);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 431 undershot geometry', () => {
  const movement431 = catalog.movements[430];
  const movement507 = catalog.movements[506];
  const model431 = createMovementModel(movement431);
  const model507 = createMovementModel(movement507);

  assert.equal(movement431.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model431.root);
  disposeModel(model507.root);
});
