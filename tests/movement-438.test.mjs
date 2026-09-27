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
  'barker-reaction-mill-with-four-tangential-nozzles-fed-through-central-hollow-shaft-rotating-opposite-exhaust';
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

function horizontalRadius(vector) {
  return Math.hypot(vector.x, vector.z);
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

test('movement 438 feeds four equally handed bent outlet arms through one central hollow shaft', () => {
  const movement = catalog.movements[437];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 438);
  assert.equal(movement.number, '438');
  assert.equal(movement.category, 'Water wheels & turbines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /Water descends inside the rotating shaft, divides equally among four hollow radial arms/);
  assert.match(data.mechanism, /escapes tangentially from four equally handed nozzles/);
  assert.match(data.mechanism, /reaction is opposite its local exhaust direction/);
  assert.match(data.mechanism, /reverse, clockwise direction/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.armAndShaftIndependent, false);
  assert.equal(degreesOfFreedom.jetFlowIndependent, false);
  assert.equal(geometry.armCount, 4);
  assert.equal(blocks.armPipes.length, 4);
  assert.equal(blocks.nozzleCollars.length, 4);
  assert.equal(blocks.jetMarkers.length, 24);
  for (const rotating of [blocks.shaft, blocks.shaftWater,
    blocks.lowerShaftCone, ...blocks.armPipes]) assert.equal(rotating.parent, blocks.runner);
  // Brown draws plain open pipe ends: the presentation removes the collars.
  for (const collar of blocks.nozzleCollars) assert.equal(collar.parent, null);
  // Source presentation removes the white rotation marker Brown does not draw.
  assert.equal(blocks.rotationMarker.parent, null);
  for (const fixed of [blocks.inletHopper, blocks.inletWaterBowl,
    blocks.upperBearing, blocks.lowerBearing, blocks.bearingBracket,
    blocks.wall, blocks.inletFlume, blocks.inletStream]) assert.equal(fixed.parent, model.root);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.filter((role) =>
    /^hollow-radial-arm-with-bent-nozzle-\d+-of-four$/.test(role)).length,
  4);
  assert.equal(roles.filter((role) =>
    /^tangential-outlet-collar-\d+-of-four$/.test(role)).length, 0);
  for (const role of [
    'central-rotating-hollow-water-supply-shaft',
    'fixed-open-hopper-feeding-central-hollow-shaft',
    'reaction-mill-runner-rotating-opposite-four-exhaust-jets',
    'fixed-horizontal-upper-bearing-bracket',
  ]) assert.ok(roles.includes(role), role);
  // Brown draws neither a floor plate nor a catch basin under the arms.
  for (const role of ['fixed-reaction-mill-foundation',
    'basin-receiving-four-tangential-exhaust-jets'])
    assert.ok(!roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 438 preserves Brown’s reaction principle and discloses all reconstructed values', () => {
  const movement = catalog.movements[437];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate438;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_438.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /central hollow shaft/);
  assert.match(movement.description, /water escaping at the ends of its arms/);
  assert.match(movement.description, /rotation being in a direction the reverse of the escape/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /static engraving and caption.*no Canvas construction/);
  assert.equal(dynamics.fluidPressureViscosityTurbulenceLeakageNozzleLossBearingFrictionRunnerInertiaLoadAndSpeedResponseModeled,
    false);
  assert.match(dynamics.reactionDiagnostic,
    /exactly minus mass flow times the water velocity relative.*equal, negative, and additive/);
  assert.match(dynamics.markerContinuity,
    /smooth quasi-steady tangent-plus-gravity path.*fades to zero/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.approximateArmCount, 4);
  assert.equal(plate.approximateShaftCenterXPixels, 216);
  assert.deepEqual(plate.approximateHopperCenterPixels, [222, 124]);
  assert.deepEqual(plate.approximateNozzlePixels, [
    [64, 368],
    [111, 449],
    [316, 347],
    [396, 415],
  ]);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.engravingEvidence,
    /elevated flume.*open hopper.*vertical hollow shaft.*four curved radial outlet arms/);
  assert.match(evidence.reconstructionDisclosure,
    /Four equally spaced coplanar arms.*equal normalized flow split.*independently engineered/);
  disposeModel(model.root);
});

test('movement 438 source pose spaces four bent nozzles uniformly at one radius and height', () => {
  const model = createMovementModel(catalog.movements[437]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);
  const nozzleOrbitRadius = Math.hypot(
    geometry.armRadius,
    geometry.nozzleTangentialOffset,
  );

  near(sourcePose.runnerAngle, 0, 0, 'source runner angle');
  assert.equal(sourcePose.nozzles.length, geometry.armCount);
  for (let index = 0; index < geometry.armCount; index += 1) {
    const nozzle = source.nozzles[index];
    const next = source.nozzles[(index + 1) % geometry.armCount];
    near(horizontalRadius(nozzle.nozzlePoint), nozzleOrbitRadius, 4.5e-16,
      `nozzle ${index + 1} orbit radius`);
    near(nozzle.nozzlePoint.y, geometry.armHeight, 0,
      `nozzle ${index + 1} arm height`);
    near(THREE.MathUtils.euclideanModulo(
      next.worldAngle - nozzle.worldAngle,
      FULL_TURN,
    ), geometry.armPitch, 1.8e-15, `arm ${index + 1} pitch`);
    vectorNear(sourcePose.nozzles[index].nozzlePoint,
      nozzle.nozzlePoint, 0, `source nozzle ${index + 1}`);
    vectorNear(sourcePose.nozzles[index].jetDirection,
      nozzle.jetDirection, 0, `source jet direction ${index + 1}`);
  }
  near(sourcePose.totalReactionTorqueNormalized,
    source.totalReactionTorqueNormalized, 0, 'source total torque');
  disposeModel(model.root);
});

test('movement 438 shaft and all bent arms rotate clockwise as one rigid assembly', () => {
  const model = createMovementModel(catalog.movements[437]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const nozzleOrbitRadius = Math.hypot(
    geometry.armRadius,
    geometry.nozzleTangentialOffset,
  );

  for (let sample = -10000; sample <= 20000; sample += 1) {
    const inputAngle = FULL_TURN * sample / 10000;
    const state = stateAtInputAngle(inputAngle);
    sameAngle(state.runnerAngle, -inputAngle, 5e-15,
      'clockwise runner coordinate');
    assert.ok(state.runnerAngularSpeed < 0);
    for (const nozzle of state.nozzles) {
      sameAngle(nozzle.worldAngle,
        nozzle.localAngle + state.runnerAngle, 5e-15,
        'rigid arm attachment');
      near(horizontalRadius(nozzle.nozzlePoint), nozzleOrbitRadius, 9e-16,
        'bent nozzle remains on rigid orbit');
      near(nozzle.nozzlePoint.y, geometry.armHeight, 0,
        'arm remains horizontal');
    }
  }
  disposeModel(model.root);
});

test('movement 438 every exhaust is tangent and opposite the local runner velocity', () => {
  const model = createMovementModel(catalog.movements[437]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = 0; sample <= 20000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    for (const nozzle of state.nozzles) {
      near(nozzle.jetDirection.length(), 1, 2.3e-16,
        'unit exhaust direction');
      near(nozzle.jetDirection.dot(nozzle.radial), 0, 2.3e-16,
        'exhaust has no radial component');
      near(nozzle.jetDirection.dot(nozzle.tangent), 1, 2.3e-16,
        'exhaust follows positive local tangent');
      near(nozzle.relativeJetVelocity.length(), geometry.relativeJetSpeed,
        9e-16, 'relative jet speed');
      assert.ok(nozzle.relativeJetVelocity.dot(nozzle.nozzleVelocity) < 0,
        'moving nozzle travels opposite its exhaust');
      assert.ok(nozzle.absoluteJetVelocity.dot(nozzle.jetDirection) > 0,
        'water still leaves in the illustrated exhaust direction');
    }
  }
  disposeModel(model.root);
});

test('movement 438 equal-and-opposite nozzle reactions produce four equal reinforcing torques', () => {
  const model = createMovementModel(catalog.movements[437]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = 0; sample <= 30000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 30000);
    let torqueSum = 0;
    for (const nozzle of state.nozzles) {
      vectorNear(nozzle.reactionForce,
        nozzle.relativeJetVelocity.clone().multiplyScalar(
          -geometry.massFlowPerNozzleNormalized,
        ), 0, 'Newton-third-law reaction');
      const reconstructedTorque = new THREE.Vector3()
        .crossVectors(nozzle.nozzlePoint, nozzle.reactionForce).y;
      near(nozzle.reactionTorque, reconstructedTorque, 0,
        'exact nozzle reaction moment');
      near(nozzle.reactionTorque, -3.025, 2e-15,
        'equal clockwise contribution');
      torqueSum += nozzle.reactionTorque;
    }
    near(state.totalReactionTorqueNormalized, torqueSum, 0,
      'sum of four nozzle moments');
    near(state.totalReactionTorqueNormalized, -12.1, 8e-15,
      'constant reinforcing reaction torque');
  }
  disposeModel(model.root);
});

test('movement 438 analytic shaft marker and offset-nozzle motion matches finite differences', () => {
  const model = createMovementModel(catalog.movements[437]);
  const { stateAtInputAngle } = model.root.userData;
  const angleStep = 1e-5;

  for (const angle of [0.17, 0.54, 0.93, 1.38, 1.84, 2.31,
    2.79, 3.27, 3.74, 4.22, 4.69, 5.16, 5.63, 6.09]) {
    const state = stateAtInputAngle(angle);
    const timeStep = angleStep / state.inputSpeed;
    const before = stateAtInputAngle(angle - angleStep);
    const after = stateAtInputAngle(angle + angleStep);
    const numericalShaftVelocity = after.shaftReferencePoint.clone()
      .sub(before.shaftReferencePoint).multiplyScalar(1 / (2 * timeStep));
    const numericalShaftAcceleration = after.shaftReferenceVelocity.clone()
      .sub(before.shaftReferenceVelocity)
      .multiplyScalar(1 / (2 * timeStep));
    vectorNear(numericalShaftVelocity, state.shaftReferenceVelocity, 8e-11,
      `shaft marker velocity at ${angle}`);
    vectorNear(numericalShaftAcceleration,
      state.shaftReferenceAcceleration, 1e-10,
      `shaft marker acceleration at ${angle}`);
    for (const index of [0, 1, 3]) {
      const numericalNozzleVelocity = after.nozzles[index].nozzlePoint.clone()
        .sub(before.nozzles[index].nozzlePoint)
        .multiplyScalar(1 / (2 * timeStep));
      const numericalNozzleAcceleration =
        after.nozzles[index].nozzleVelocity.clone()
          .sub(before.nozzles[index].nozzleVelocity)
          .multiplyScalar(1 / (2 * timeStep));
      vectorNear(numericalNozzleVelocity,
        state.nozzles[index].nozzleVelocity, 5e-10,
        `nozzle ${index + 1} velocity at ${angle}`);
      vectorNear(numericalNozzleAcceleration,
        state.nozzles[index].nozzleAcceleration, 7e-10,
        `nozzle ${index + 1} acceleration at ${angle}`);
    }
  }
  disposeModel(model.root);
});

test('movement 438 update rotates only the reaction runner and keeps water markers attached smoothly to moving nozzles', () => {
  const model = createMovementModel(catalog.movements[437]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const fixedBlocks = [blocks.inletHopper, blocks.inletWaterBowl,
    blocks.upperBearing, blocks.lowerBearing, blocks.bearingBracket,
    blocks.wall, blocks.inletFlume, blocks.inletStream];
  const fixedTransforms = fixedBlocks.map((block) => ({
    position: block.position.clone(),
    quaternion: block.quaternion.clone(),
  }));

  for (const time of [0, 0.23, 0.61, 1.04, 1.49, 1.97, 2.44,
    2.91, 3.39, 3.86, 4.34, 4.82, 5.73]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.runner.rotation.y, state.runnerAngle, 1.2e-16,
      'clockwise reaction-runner update');
    fixedBlocks.forEach((block, index) => {
      vectorNear(block.position, fixedTransforms[index].position, 0,
        'fixed supply/support position');
      near(block.quaternion.angleTo(fixedTransforms[index].quaternion),
        0, 5e-8, 'fixed supply/support orientation');
    });
  }
  model.update(0);
  const source = stateAtTime(0);
  vectorNear(blocks.jetMarkers[0].position,
    source.nozzles[0].nozzlePoint, 0,
    'first exhaust marker begins at moving nozzle');
  near(blocks.jetMarkers[0].scale.x, 0, 0,
    'exhaust marker recycles invisibly');
  near(blocks.inletMarkers[0].scale.x, 0, 0,
    'inlet marker recycles invisibly');
  const closure = stateAtTime(geometry.cycleDuration);
  vectorNear(closure.shaftReferencePoint, source.shaftReferencePoint, 0,
    'runner cycle closure');
  near(closure.totalReactionTorqueNormalized,
    source.totalReactionTorqueNormalized, 0, 'reaction torque closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 6);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 438 reaction-mill geometry', () => {
  const movement438 = catalog.movements[437];
  const movement507 = catalog.movements[506];
  const model438 = createMovementModel(movement438);
  const model507 = createMovementModel(movement507);

  assert.equal(movement438.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model438.root);
  disposeModel(model507.root);
});
