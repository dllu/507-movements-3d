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
  'warren-inward-flow-turbine-with-fixed-outer-guides-and-clockwise-inner-runner-discharging-centrally';
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

test('movement 435 keeps sixteen outer guides a fixed around a separate twenty-bucket inner runner b', () => {
  const movement = catalog.movements[434];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 435);
  assert.equal(movement.number, '435');
  assert.equal(movement.category, 'Water wheels & turbines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /sixteen stationary curved passages in the outer guide assembly a/);
  assert.match(data.mechanism, /twenty oppositely curved passages.*inner runner b/);
  assert.match(data.mechanism, /Water leaves at the center/);
  assert.match(data.mechanism, /only runner b.*rotate together/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.fixedOuterGuideVanesRotate, false);
  assert.equal(degreesOfFreedom.runnerAndOutputShaftIndependent, false);
  assert.equal(geometry.fixedGuideCount, 16);
  assert.equal(geometry.runnerBucketCount, 20);
  assert.equal(blocks.fixedGuideVanes.length, 16);
  assert.equal(blocks.runnerBuckets.length, 20);
  assert.equal(blocks.flowPathTubes.length, 8);
  assert.equal(blocks.flowMarkers.length, 24);
  for (const guide of blocks.fixedGuideVanes) {
    assert.equal(guide.parent, blocks.fixedGuideAssembly);
  }
  for (const bucket of blocks.runnerBuckets) {
    assert.equal(bucket.parent, blocks.runner);
  }
  for (const rotating of [blocks.runnerDisk, blocks.runnerHub,
    blocks.runnerShaft, blocks.rotationMarker, ...blocks.runnerSupportArms]) {
    assert.equal(rotating.parent, blocks.runner);
  }
  for (const fixed of [blocks.fixedGuideAssembly, blocks.casingFloor,
    blocks.outerSupplyRing, blocks.centralDischarge,
    ...blocks.flowPathTubes]) assert.equal(fixed.parent, model.root);
  assert.ok(geometry.guideInnerRadius > geometry.runnerOuterRadius,
    'fixed outer guides clear the revolving inner runner');

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.filter((role) =>
    /^fixed-outer-curved-guide-\d+-of-sixteen$/.test(role)).length, 16);
  assert.equal(roles.filter((role) =>
    /^curved-inner-runner-bucket-\d+-of-twenty$/.test(role)).length, 20);
  for (const role of [
    'fixed-outer-warren-guide-assembly-a',
    'clockwise-inner-warren-runner-b',
    'circumferential-water-supply-to-fixed-outer-guides',
    'water-discharging-downward-at-turbine-center',
    'vertical-output-shaft-of-inner-runner-b',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 435 preserves Brown’s stated central-discharge topology and discloses reconstructed quantities', () => {
  const movement = catalog.movements[434];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate435;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_435.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /guides, a, are outside/);
  assert.match(movement.description, /wheel, b, revolves within them/);
  assert.match(movement.description, /discharging the water at the center/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /static plan-view engraving and caption.*no Canvas construction/);
  assert.equal(dynamics.fluidPressureViscosityTurbulenceLeakageCavitationBladeLoadingBearingFrictionRunnerInertiaGeneratorLoadAndSpeedResponseModeled,
    false);
  assert.match(dynamics.angularMomentumDiagnostic,
    /guide-exit minus central-discharge specific angular momentum.*negative \(clockwise\)/);
  assert.match(dynamics.markerContinuity,
    /outer supply through guide a and runner b to the central outlet/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.centerApproximatePixels, [267, 261]);
  assert.equal(plate.approximateFixedOuterGuideCount, 16);
  assert.equal(plate.approximateInnerRunnerBucketCount, 20);
  assert.equal(plate.approximateGuideInnerRadiusPixels, 157);
  assert.equal(plate.approximateRunnerInnerDiskRadiusPixels, 111);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.engravingEvidence,
    /sixteen broad curved fixed passages.*twenty finer oppositely curved passages/);
  assert.match(evidence.reconstructionDisclosure,
    /Sixteen fixed guides, twenty runner buckets.*independently engineered/);
  disposeModel(model.root);
});

test('movement 435 source pose spaces every inner-runner bucket uniformly inside the fixed guide ring', () => {
  const model = createMovementModel(catalog.movements[434]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  near(sourcePose.fixedGuideAngle, 0, 0, 'fixed guide source angle');
  near(sourcePose.runnerAngle, 0, 0, 'runner source angle');
  vectorNear(sourcePose.guideExitPoint, source.guideExitPoint, 0,
    'source guide exit');
  assert.equal(sourcePose.runnerBuckets.length, geometry.runnerBucketCount);
  for (let index = 0; index < geometry.runnerBucketCount; index += 1) {
    const bucket = source.runnerBuckets[index];
    const next = source.runnerBuckets[(index + 1)
      % geometry.runnerBucketCount];
    near(horizontalRadius(bucket.center), geometry.runnerBucketCenterRadius,
      4.5e-16, `bucket ${index + 1} center radius`);
    near(bucket.center.y, 0, 0, `bucket ${index + 1} plan height`);
    near(THREE.MathUtils.euclideanModulo(
      next.worldAngle - bucket.worldAngle,
      FULL_TURN,
    ), geometry.runnerBucketPitch, 1.8e-15,
    `bucket ${index + 1} pitch`);
    vectorNear(sourcePose.runnerBuckets[index].center,
      bucket.center, 0, `source bucket ${index + 1}`);
  }
  disposeModel(model.root);
});

test('movement 435 inner runner b and its output shaft turn clockwise as one body while outer a stays fixed', () => {
  const model = createMovementModel(catalog.movements[434]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = -10000; sample <= 20000; sample += 1) {
    const inputAngle = FULL_TURN * sample / 10000;
    const state = stateAtInputAngle(inputAngle);
    sameAngle(state.runnerAngle, -inputAngle, 5e-15,
      'clockwise runner coordinate');
    assert.ok(state.runnerAngularSpeed < 0);
    for (const bucket of state.runnerBuckets) {
      sameAngle(bucket.worldAngle,
        bucket.localAngle + state.runnerAngle, 5e-15,
        'rigid inner bucket attachment');
      near(horizontalRadius(bucket.center),
        geometry.runnerBucketCenterRadius, 7e-16,
        'bucket remains inside outer guides');
    }
  }
  disposeModel(model.root);
});

test('movement 435 reverses residual whirl through runner b and gives exact clockwise angular-momentum torque', () => {
  const model = createMovementModel(catalog.movements[434]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const state = stateAtInputAngle(0);
  const radial = new THREE.Vector3(1, 0, 0);
  const positiveTangent = new THREE.Vector3(0, 0, -1);

  near(state.guideExitVelocity.dot(radial),
    -geometry.guideExitInwardSpeed, 0, 'guide exit inward speed');
  near(state.guideExitVelocity.dot(positiveTangent),
    -geometry.guideExitClockwiseWhirlSpeed, 0,
    'clockwise guide-exit whirl');
  near(state.centralDischargeVelocity.dot(radial),
    -geometry.centralDischargeInwardSpeed, 0,
    'central-discharge inward speed');
  near(state.centralDischargeVelocity.dot(positiveTangent),
    geometry.centralDischargeCounterclockwiseWhirlSpeed, 0,
    'reversed residual whirl at center');
  const inletMomentum = new THREE.Vector3()
    .crossVectors(state.guideExitPoint, state.guideExitVelocity).y;
  const outletMomentum = new THREE.Vector3()
    .crossVectors(
      state.centralDischargePoint,
      state.centralDischargeVelocity,
    ).y;
  near(state.inletSpecificAngularMomentumY, inletMomentum, 0,
    'guide-exit specific angular momentum');
  near(state.outletSpecificAngularMomentumY, outletMomentum, 0,
    'central-discharge specific angular momentum');
  assert.ok(inletMomentum < 0);
  assert.ok(outletMomentum > 0);
  near(state.runnerTorqueNormalized,
    geometry.massFlowNormalized * (inletMomentum - outletMomentum),
    0, 'Euler angular-momentum torque');
  near(state.runnerTorqueNormalized, -7.008, 1e-15,
    'reconstructed clockwise torque');
  for (const angle of [-8, -1, 0, 0.7, 2.8, 9]) {
    near(stateAtInputAngle(angle).runnerTorqueNormalized,
      state.runnerTorqueNormalized, 0,
      'axisymmetric torque is phase independent');
  }
  disposeModel(model.root);
});

test('movement 435 water markers follow unified inward curves from outer supply to center', () => {
  const model = createMovementModel(catalog.movements[434]);
  const { flowCurves, geometry } = model.root.userData;

  assert.equal(flowCurves.length, 8);
  for (let pathIndex = 0; pathIndex < flowCurves.length; pathIndex += 1) {
    const curve = flowCurves[pathIndex];
    assert.ok(horizontalRadius(curve.getPoint(0)) > geometry.guideOuterRadius);
    assert.ok(horizontalRadius(curve.getPoint(1)) < geometry.runnerInnerRadius);
    let previousRadius = horizontalRadius(curve.getPoint(0));
    let maximumStep = 0;
    for (let sample = 1; sample <= 10000; sample += 1) {
      const point = curve.getPoint(sample / 10000);
      const radius = horizontalRadius(point);
      assert.ok(Number.isFinite(point.x + point.y + point.z));
      assert.ok(radius <= previousRadius + 1e-5,
        `path ${pathIndex + 1} remains inward`);
      maximumStep = Math.max(maximumStep, Math.abs(radius - previousRadius));
      previousRadius = radius;
    }
    assert.ok(maximumStep < 8e-4);
    const before = curve.getTangent(0.49999).normalize();
    const after = curve.getTangent(0.50001).normalize();
    assert.ok(before.angleTo(after) < 2e-4,
      `path ${pathIndex + 1} has continuous guide-runner tangent`);
  }
  disposeModel(model.root);
});

test('movement 435 analytic outer-rim and inner-bucket motion matches finite differences', () => {
  const model = createMovementModel(catalog.movements[434]);
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
    for (const index of [0, 6, 13]) {
      const numericalBucketVelocity =
        after.runnerBuckets[index].center.clone()
          .sub(before.runnerBuckets[index].center)
          .multiplyScalar(1 / (2 * timeStep));
      const numericalBucketAcceleration =
        after.runnerBuckets[index].centerVelocity.clone()
          .sub(before.runnerBuckets[index].centerVelocity)
          .multiplyScalar(1 / (2 * timeStep));
      vectorNear(numericalBucketVelocity,
        state.runnerBuckets[index].centerVelocity, 4e-10,
        `bucket ${index + 1} velocity at ${angle}`);
      vectorNear(numericalBucketAcceleration,
        state.runnerBuckets[index].centerAcceleration, 7e-10,
        `bucket ${index + 1} acceleration at ${angle}`);
    }
  }
  disposeModel(model.root);
});

test('movement 435 update rotates only runner b while guide a and inward flow remain fixed', () => {
  const model = createMovementModel(catalog.movements[434]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const fixedBlocks = [blocks.fixedGuideAssembly, blocks.casingFloor,
    blocks.outerSupplyRing, blocks.centralDischarge,
    ...blocks.flowPathTubes];
  const fixedTransforms = fixedBlocks.map((block) => ({
    position: block.position.clone(),
    quaternion: block.quaternion.clone(),
  }));

  for (const time of [0, 0.23, 0.61, 1.04, 1.49, 1.97, 2.44,
    2.91, 3.39, 3.86, 4.34, 4.82, 5.46]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.runner.rotation.y, state.runnerAngle, 1.2e-16,
      'clockwise runner update');
    fixedBlocks.forEach((block, index) => {
      vectorNear(block.position, fixedTransforms[index].position, 0,
        'fixed guide/flow position');
      near(block.quaternion.angleTo(fixedTransforms[index].quaternion),
        0, 5e-8, 'fixed guide/flow orientation');
    });
  }
  model.update(0);
  near(blocks.flowMarkers[0].scale.x, 0, 0,
    'outer recycling marker fades completely');
  model.update(1.30);
  near(blocks.flowMarkers[0].scale.x, 0, 2e-8,
    'central-to-outer marker reset is hidden');
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  vectorNear(closure.rimReferencePoint, source.rimReferencePoint, 0,
    'runner cycle closure');
  near(closure.runnerTorqueNormalized, source.runnerTorqueNormalized, 0,
    'flow torque cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 5.8);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 435 central-discharge topology', () => {
  const movement435 = catalog.movements[434];
  const movement507 = catalog.movements[506];
  const model435 = createMovementModel(movement435);
  const model507 = createMovementModel(movement507);

  assert.equal(movement435.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model435.root);
  disposeModel(model507.root);
});
