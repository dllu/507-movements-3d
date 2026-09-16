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
  'overshot-water-wheel-with-top-fed-retaining-buckets-weighting-clockwise-descending-side';
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

test('movement 430 is a top-fed overshot wheel with twelve retaining buckets, six spokes, and a bottom tailrace', () => {
  const movement = catalog.movements[429];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 430);
  assert.equal(movement.number, '430');
  assert.equal(movement.category, 'Water wheels & turbines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /fixed elevated headrace delivers water over the crown/);
  assert.match(data.mechanism, /filled buckets remain on the right-hand descending side/);
  assert.match(data.mechanism, /clockwise torque/);
  assert.match(data.mechanism, /bottom tailrace/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.bucketWaterFillIndependent, false);
  assert.equal(geometry.bucketCount, 12);
  assert.equal(geometry.spokeCount, 6);
  assert.equal(blocks.bucketGroups.length, 12);
  assert.equal(blocks.bucketWaterBodies.length, 12);
  assert.equal(blocks.bucketWaterLoads.length, 12);
  assert.equal(blocks.hub.parent, blocks.rotor);
  assert.equal(blocks.rotationMarker.parent, blocks.rotor);
  assert.equal(blocks.shaft.parent, model.root);
  assert.equal(blocks.flume.parent, model.root);
  assert.equal(blocks.feedWater.parent, model.root);
  assert.equal(blocks.tailrace.parent, model.root);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.filter((role) =>
    /^overshot-retaining-bucket-\d+-of-twelve$/.test(role)).length, 12);
  assert.equal(roles.filter((role) =>
    /^wheel-spoke-\d+-of-six$/.test(role)).length, 6);
  for (const role of [
    'fixed-top-feed-headrace-flume',
    'continuous-top-fed-water-stream-onto-wheel',
    'bottom-tailrace-carrying-discharged-water-away',
    'clockwise-overshot-water-wheel-rotor-with-retaining-buckets',
    'main-water-wheel-shaft-in-fixed-bearings',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 430 records the sparse Brown source honestly and separates source-grounded features from reconstruction choices', () => {
  const movement = catalog.movements[429];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate430;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_430.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(movement.description, '430. Overshot water-wheel.');
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /single static engraving and two-word caption.*no Canvas construction/);
  assert.equal(dynamics.fluidPressureViscositySplashLeakageImpactBearingFrictionWheelInertiaGeneratorLoadAndSpeedResponseModeled,
    false);
  assert.match(dynamics.bucketFillModel,
    /smooth fill ramp.*descending side.*drains smoothly/);
  assert.match(dynamics.gravityTorqueDiagnostic,
    /exact moment.*speed remains prescribed/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.shaftApproximateCenterPixels, [315, 293]);
  assert.deepEqual(plate.topFlumeOutletApproximatePixels, [357, 119]);
  assert.equal(plate.approximateBucketCount, 12);
  assert.deepEqual(evidence.explicitInBrownDescription,
    ['the mechanism is an overshot water-wheel']);
  assert.match(evidence.engravingEvidence,
    /elevated left-to-right headrace.*six spokes.*clockwise/);
  assert.match(evidence.reconstructionDisclosure,
    /Twelve equal buckets.*six-second demonstration cycle.*independently engineered/);
  disposeModel(model.root);
});

test('movement 430 reconstructed source pose spaces all wheel-fixed buckets uniformly on one rim', () => {
  const model = createMovementModel(catalog.movements[429]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  near(sourcePose.wheelAngle, 0, 0, 'source wheel angle');
  assert.equal(sourcePose.buckets.length, geometry.bucketCount);
  for (let index = 0; index < geometry.bucketCount; index += 1) {
    const bucket = source.buckets[index];
    const next = source.buckets[(index + 1) % geometry.bucketCount];
    near(bucket.center.length(), geometry.bucketCenterRadius, 4.5e-16,
      `bucket ${index + 1} center radius`);
    near(THREE.MathUtils.euclideanModulo(
      next.worldAngle - bucket.worldAngle,
      FULL_TURN,
    ), FULL_TURN / geometry.bucketCount, 1.8e-15,
    `bucket ${index + 1} pitch`);
    vectorNear(sourcePose.buckets[index].center, bucket.center, 0,
      `source bucket ${index + 1} position`);
    near(sourcePose.buckets[index].waterFill, bucket.waterFill, 0,
      `source bucket ${index + 1} water`);
  }
  disposeModel(model.root);
});

test('movement 430 wheel and every attached bucket rotate clockwise as one rigid body', () => {
  const model = createMovementModel(catalog.movements[429]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = -10000; sample <= 20000; sample += 1) {
    const inputAngle = FULL_TURN * sample / 10000;
    const state = stateAtInputAngle(inputAngle);
    sameAngle(state.wheelAngle, -inputAngle, 5e-15,
      'clockwise wheel coordinate');
    assert.ok(state.wheelAngularSpeed < 0);
    for (const bucket of state.buckets) {
      sameAngle(bucket.worldAngle,
        bucket.localAngle + state.wheelAngle, 5e-15,
        'rigid bucket attachment');
      near(bucket.center.length(), geometry.bucketCenterRadius, 4.5e-16,
        'bucket stays on rim');
      vectorNear(bucket.center,
        bucket.radial.clone().multiplyScalar(geometry.bucketCenterRadius),
        0, 'bucket radial construction');
    }
  }
  disposeModel(model.root);
});

test('movement 430 fill law loads only after the top feed, holds water down the descending side, and drains at the bottom', () => {
  const model = createMovementModel(catalog.movements[429]);
  const { geometry, waterFillAtWorldAngle } = model.root.userData;

  near(waterFillAtWorldAngle(geometry.inletAngle), 0, 0,
    'empty bucket arriving at inlet');
  near(waterFillAtWorldAngle(
    geometry.inletAngle - geometry.fillTravelAngle / 2,
  ), 0.5, 1.4e-15, 'half-filled beneath top stream');
  near(waterFillAtWorldAngle(
    geometry.inletAngle - geometry.fillTravelAngle,
  ), 1, 0, 'full after top stream');
  near(waterFillAtWorldAngle(0), 1, 0,
    'water retained on right descending quadrant');
  near(waterFillAtWorldAngle(
    geometry.inletAngle - (
      geometry.drainStartTravelAngle + geometry.drainEndTravelAngle
    ) / 2,
  ), 0.5, 3e-15, 'half drained at bottom');
  near(waterFillAtWorldAngle(
    geometry.inletAngle - geometry.drainEndTravelAngle,
  ), 0, 0, 'empty before rising side');
  near(waterFillAtWorldAngle(Math.PI), 0, 0,
    'rising left side remains empty');
  disposeModel(model.root);
});

test('movement 430 bucket filling and draining are smooth and exactly periodic rather than popping between states', () => {
  const model = createMovementModel(catalog.movements[429]);
  const { geometry, waterFillAtWorldAngle } = model.root.userData;
  const sampleCount = 100000;
  let previous = waterFillAtWorldAngle(geometry.inletAngle);
  let maximumStep = 0;

  for (let sample = 1; sample <= sampleCount; sample += 1) {
    const worldAngle = geometry.inletAngle
      - FULL_TURN * sample / sampleCount;
    const current = waterFillAtWorldAngle(worldAngle);
    maximumStep = Math.max(maximumStep, Math.abs(current - previous));
    previous = current;
  }
  assert.ok(maximumStep < 4.3e-4);
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

test('movement 430 retained water produces clockwise gravitational torque at every phase', () => {
  const model = createMovementModel(catalog.movements[429]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let leastNegativeTorque = -Infinity;
  let mostNegativeTorque = Infinity;

  for (let sample = 0; sample <= 30000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 30000);
    const reconstructedTorque = state.buckets.reduce(
      (sum, bucket) => sum
        - bucket.waterFill * geometry.gravity * bucket.center.x,
      0,
    );
    const reconstructedMass = state.buckets.reduce(
      (sum, bucket) => sum + bucket.waterFill,
      0,
    );
    near(state.gravityTorqueNormalized, reconstructedTorque, 0,
      'sum of bucket-weight moments');
    near(state.retainedWaterMassNormalized, reconstructedMass, 0,
      'sum of retained bucket water');
    assert.ok(state.gravityTorqueNormalized < -76);
    leastNegativeTorque = Math.max(
      leastNegativeTorque,
      state.gravityTorqueNormalized,
    );
    mostNegativeTorque = Math.min(
      mostNegativeTorque,
      state.gravityTorqueNormalized,
    );
  }
  assert.ok(leastNegativeTorque < 0);
  assert.ok(mostNegativeTorque < leastNegativeTorque);
  disposeModel(model.root);
});

test('movement 430 analytic rim and bucket motion matches finite differences', () => {
  const model = createMovementModel(catalog.movements[429]);
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
    for (const index of [0, 4, 8]) {
      const numericalBucketVelocity = after.buckets[index].center.clone()
        .sub(before.buckets[index].center)
        .multiplyScalar(1 / (2 * timeStep));
      vectorNear(numericalBucketVelocity,
        state.buckets[index].centerVelocity, 4e-10,
        `bucket ${index + 1} velocity at ${angle}`);
    }
  }
  disposeModel(model.root);
});

test('movement 430 update keeps water surfaces level while wheel-fixed bucket shells turn beneath them', () => {
  const model = createMovementModel(catalog.movements[429]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const shaftPosition = blocks.shaft.position.clone();
  const flumePosition = blocks.flume.position.clone();

  for (const time of [0, 0.23, 0.61, 1.04, 1.49, 1.97, 2.44,
    2.91, 3.39, 3.86, 4.34, 4.82, 5.29, 5.77]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.rotor.rotation.z, state.wheelAngle, 1.2e-16,
      'clockwise wheel update');
    for (let index = 0; index < geometry.bucketCount; index += 1) {
      const waterLoad = blocks.bucketWaterLoads[index];
      sameAngle(blocks.rotor.rotation.z + waterLoad.rotation.z,
        0, 2.5e-16, `bucket ${index + 1} horizontal water surface`);
      assert.equal(blocks.bucketWaterBodies[index].visible,
        state.buckets[index].waterFill > 0.002);
      assert.equal(blocks.bucketWaterBodies[index].scale.y, 1,
        `bucket ${index + 1} fill is clipped geometry rather than a scaled box`);
    }
    vectorNear(blocks.shaft.position, shaftPosition, 0,
      'shaft bearing fixed');
    vectorNear(blocks.flume.position, flumePosition, 0,
      'headrace fixed');
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

test('movement 507 remains the next authored frontier and does not reuse movement 430 overshot geometry', () => {
  const movement430 = catalog.movements[429];
  const movement507 = catalog.movements[506];
  const model430 = createMovementModel(movement430);
  const model507 = createMovementModel(movement507);

  assert.equal(movement430.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model430.root);
  disposeModel(model507.root);
});
