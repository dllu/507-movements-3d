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
  'fourneyron-outward-flow-turbine-with-fixed-inner-curved-guides-and-clockwise-outer-runner';
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

test('movement 434 keeps six inner guide shutes fixed while a separate sixteen-bucket outer runner revolves', () => {
  const movement = catalog.movements[433];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 434);
  assert.equal(movement.number, '434');
  assert.equal(movement.category, 'Water wheels & turbines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /six stationary curved shutes in guide assembly A/);
  assert.match(data.mechanism, /sixteen curved buckets in the separate outer runner B/);
  assert.match(data.mechanism, /discharges radially around the circumference/);
  assert.match(data.mechanism, /only the outer bucket ring.*rotate together/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.fixedGuideVanesRotate, false);
  assert.equal(degreesOfFreedom.runnerAndOutputShaftIndependent, false);
  assert.equal(geometry.fixedGuideCount, 6);
  assert.equal(geometry.runnerBucketCount, 16);
  assert.equal(blocks.fixedGuideVanes.length, 6);
  assert.equal(blocks.runnerBuckets.length, 16);
  assert.equal(blocks.flowPathTubes.length, 6);
  assert.equal(blocks.flowMarkers.length, 24);
  for (const guide of blocks.fixedGuideVanes) {
    assert.equal(guide.parent, blocks.fixedGuideAssembly);
  }
  for (const bucket of blocks.runnerBuckets) {
    assert.equal(bucket.parent, blocks.runner);
  }
  for (const rotating of [blocks.runnerHub, blocks.runnerShaft,
    blocks.rotationMarker, ...blocks.runnerSupportArms]) {
    assert.equal(rotating.parent, blocks.runner);
  }
  for (const fixed of [blocks.fixedGuideAssembly, blocks.casingFloor]) {
    assert.equal(fixed.parent, model.root);
  }
  // Streamline tubes, flow particles and the hose-like discharge ring are
  // flow notation; source presentation does not show them.
  for (const notation of [blocks.dischargeRing, ...blocks.flowPathTubes,
    ...blocks.flowMarkers]) assert.equal(notation.parent, null);
  assert.ok(geometry.runnerInnerRadius > geometry.guideOuterRadius,
    'stationary guide assembly clears the revolving runner');

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.filter((role) =>
    /^fixed-curved-guide-shute-\d+-of-six$/.test(role)).length, 6);
  assert.equal(roles.filter((role) =>
    /^curved-outer-runner-bucket-\d+-of-sixteen$/.test(role)).length, 16);
  for (const role of [
    'fixed-inner-fourneyron-guide-assembly-A',
    'clockwise-outer-fourneyron-runner-B',
    'central-water-inlet-to-fixed-guides',
    'vertical-output-shaft-of-outer-runner',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 434 preserves Brown’s stated Fourneyron topology and discloses reconstructed quantities', () => {
  const movement = catalog.movements[433];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate434;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_434.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /fixed curved “shutes” or guides, A/);
  assert.match(movement.description,
    /outer wheel, B, which revolves/);
  assert.match(movement.description,
    /water discharges at the circumference/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /static plan-view engraving and caption.*no Canvas construction/);
  assert.equal(dynamics.fluidPressureViscosityTurbulenceLeakageCavitationBladeLoadingBearingFrictionRunnerInertiaGeneratorLoadAndSpeedResponseModeled,
    false);
  assert.match(dynamics.angularMomentumDiagnostic,
    /inlet-minus-outlet specific angular momentum.*negative \(clockwise\)/);
  assert.match(dynamics.markerContinuity,
    /one centripetal Catmull-Rom curve continuously.*fades to zero/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.centerApproximatePixels, [252, 255]);
  assert.equal(plate.approximateFixedGuideCount, 6);
  assert.equal(plate.approximateOuterRunnerBucketCount, 16);
  assert.equal(plate.approximateGuideOuterRadiusPixels, 143);
  assert.equal(plate.approximateRunnerOuterRadiusPixels, 207);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.engravingEvidence,
    /six broad curved guide passages.*sixteen oppositely curved bucket passages/);
  assert.match(evidence.reconstructionDisclosure,
    /Six fixed guides, sixteen runner buckets.*independently engineered/);
  disposeModel(model.root);
});

test('movement 434 source pose spaces every outer bucket uniformly around the fixed concentric guide assembly', () => {
  const model = createMovementModel(catalog.movements[433]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  near(sourcePose.fixedGuideAngle, 0, 0, 'fixed guide source angle');
  near(sourcePose.runnerAngle, 0, 0, 'runner source angle');
  vectorNear(sourcePose.guideExitPoint, source.guideExitPoint, 0,
    'source guide outlet');
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

test('movement 434 outer runner and output shaft turn clockwise as one body while A remains fixed', () => {
  const model = createMovementModel(catalog.movements[433]);
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
        'rigid outer bucket attachment');
      near(horizontalRadius(bucket.center),
        geometry.runnerBucketCenterRadius, 1e-15,
        'bucket remains in outer annulus');
    }
  }
  disposeModel(model.root);
});

test('movement 434 guide and discharge velocity triangles give exact clockwise runner torque', () => {
  const model = createMovementModel(catalog.movements[433]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const state = stateAtInputAngle(0);
  const radial = new THREE.Vector3(1, 0, 0);
  const positiveTangent = new THREE.Vector3(0, 0, -1);

  near(state.guideExitVelocity.dot(radial),
    geometry.guideExitRadialSpeed, 0, 'guide exit radial speed');
  near(state.guideExitVelocity.dot(positiveTangent),
    -geometry.guideExitWhirlSpeed, 0, 'clockwise guide-exit whirl');
  near(state.dischargeVelocity.dot(radial),
    geometry.dischargeRadialSpeed, 0, 'discharge radial speed');
  near(state.dischargeVelocity.dot(positiveTangent),
    -geometry.dischargeWhirlSpeed, 0, 'small residual discharge whirl');
  const inletMomentum = new THREE.Vector3()
    .crossVectors(state.guideExitPoint, state.guideExitVelocity).y;
  const outletMomentum = new THREE.Vector3()
    .crossVectors(state.dischargePoint, state.dischargeVelocity).y;
  near(state.inletSpecificAngularMomentumY, inletMomentum, 0,
    'inlet specific angular momentum');
  near(state.outletSpecificAngularMomentumY, outletMomentum, 0,
    'outlet specific angular momentum');
  assert.ok(Math.abs(outletMomentum) < Math.abs(inletMomentum),
    'runner removes most inlet whirl');
  near(state.runnerTorqueNormalized,
    geometry.massFlowNormalized * (inletMomentum - outletMomentum),
    0, 'Euler angular-momentum torque');
  near(state.runnerTorqueNormalized, -5.188000000000001, 1e-15,
    'reconstructed clockwise torque');
  for (const angle of [-8, -1, 0, 0.7, 2.8, 9]) {
    near(stateAtInputAngle(angle).runnerTorqueNormalized,
      state.runnerTorqueNormalized, 0,
      'axisymmetric torque is independent of bucket phase');
  }
  disposeModel(model.root);
});

test('movement 434 water markers follow unified center-to-circumference curves without a guide-runner jump', () => {
  const model = createMovementModel(catalog.movements[433]);
  const { flowCurves, geometry } = model.root.userData;

  assert.equal(flowCurves.length, geometry.fixedGuideCount);
  for (let pathIndex = 0; pathIndex < flowCurves.length; pathIndex += 1) {
    const curve = flowCurves[pathIndex];
    assert.ok(horizontalRadius(curve.getPoint(0)) < geometry.guideInnerRadius);
    assert.ok(horizontalRadius(curve.getPoint(1)) > geometry.runnerOuterRadius);
    let previousRadius = horizontalRadius(curve.getPoint(0));
    let maximumStep = 0;
    for (let sample = 1; sample <= 10000; sample += 1) {
      const point = curve.getPoint(sample / 10000);
      const radius = horizontalRadius(point);
      assert.ok(Number.isFinite(point.x + point.y + point.z));
      assert.ok(radius >= previousRadius - 1e-5,
        `path ${pathIndex + 1} remains outward`);
      maximumStep = Math.max(maximumStep, Math.abs(radius - previousRadius));
      previousRadius = radius;
    }
    assert.ok(maximumStep < 7e-4);
    const before = curve.getTangent(0.49999).normalize();
    const after = curve.getTangent(0.50001).normalize();
    assert.ok(before.angleTo(after) < 2e-4,
      `path ${pathIndex + 1} has continuous guide-runner tangent`);
  }
  disposeModel(model.root);
});

test('movement 434 analytic outer-rim and bucket motion matches finite differences', () => {
  const model = createMovementModel(catalog.movements[433]);
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
      state.rimReferenceAcceleration, 8e-10,
      `rim acceleration at ${angle}`);
    for (const index of [0, 5, 10]) {
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

test('movement 434 update rotates only runner B while guide A and the outward flow field stay fixed', () => {
  const model = createMovementModel(catalog.movements[433]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const fixedBlocks = [blocks.fixedGuideAssembly, blocks.casingFloor,
    blocks.dischargeRing, ...blocks.flowPathTubes];
  const fixedTransforms = fixedBlocks.map((block) => ({
    position: block.position.clone(),
    quaternion: block.quaternion.clone(),
  }));

  for (const time of [0, 0.23, 0.61, 1.04, 1.49, 1.97, 2.44,
    2.91, 3.39, 3.86, 4.34, 4.82, 5.29]) {
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
    'recycling inlet marker fades completely');
  model.update(1.24);
  near(blocks.flowMarkers[0].scale.x, 0, 2e-8,
    'recycling outlet-to-inlet reset is hidden');
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  vectorNear(closure.rimReferencePoint, source.rimReferencePoint, 0,
    'runner cycle closure');
  near(closure.runnerTorqueNormalized, source.runnerTorqueNormalized, 0,
    'flow torque cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 5.6);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 434 Fourneyron topology', () => {
  const movement434 = catalog.movements[433];
  const movement507 = catalog.movements[506];
  const model434 = createMovementModel(movement434);
  const model507 = createMovementModel(movement507);

  assert.equal(movement434.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model434.root);
  disposeModel(model507.root);
});
