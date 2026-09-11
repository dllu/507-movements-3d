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
  'jonval-axial-flow-turbine-with-fixed-radial-upper-shutes-and-more-numerous-tangential-parabolic-lower-runner-buckets';
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

test('movement 436 stacks twelve fixed radial shutes above eighteen tangential curved runner buckets in casing b', () => {
  const movement = catalog.movements[435];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 436);
  assert.equal(movement.number, '436');
  assert.equal(movement.category, 'Water wheels & turbines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /twelve stationary shutes arranged radially around a fixed central drum/);
  assert.match(data.mechanism, /Immediately below.*eighteen moving buckets in wheel c/);
  assert.match(data.mechanism, /exceed the shutes in number.*slight tangent/);
  assert.match(data.mechanism, /exact parabolic sweep/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.fixedUpperShutesRotate, false);
  assert.equal(degreesOfFreedom.runnerAndShaftIndependent, false);
  assert.equal(geometry.fixedShuteCount, 12);
  assert.equal(geometry.runnerBucketCount, 18);
  assert.ok(geometry.runnerBucketCount > geometry.fixedShuteCount);
  assert.equal(blocks.fixedShuteGroups.length, 12);
  assert.equal(blocks.runnerBucketGroups.length, 18);
  assert.equal(blocks.flowPathTubes.length, 6);
  assert.equal(blocks.flowMarkers.length, 24);
  for (const guide of blocks.fixedShuteGroups) {
    assert.equal(guide.parent, blocks.fixedGuideAssembly);
  }
  for (const bucket of blocks.runnerBucketGroups) {
    assert.equal(bucket.parent, blocks.runner);
  }
  for (const rotating of [blocks.runnerFloor, blocks.runnerHub,
    blocks.shaft, blocks.rotationMarker]) {
    assert.equal(rotating.parent, blocks.runner);
  }
  for (const fixed of [blocks.fixedGuideAssembly, blocks.casing,
    blocks.inletFlume, blocks.inletWater, blocks.lowerBasin,
    blocks.foundation, blocks.upperBearing, blocks.lowerBearing,
    ...blocks.flowPathTubes]) assert.equal(fixed.parent, model.root);
  assert.ok(geometry.guideRowCenterY > geometry.runnerRowCenterY,
    'stationary guide row is physically above runner row');

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.filter((role) =>
    /^fixed-radially-arranged-shute-\d+-of-twelve$/.test(role)).length, 12);
  assert.equal(roles.filter((role) =>
    /^tangential-parabolic-runner-bucket-\d+-of-eighteen$/.test(role)).length,
  18);
  for (const role of [
    'stationary-upper-jonval-shute-row-a',
    'clockwise-lower-jonval-runner-c',
    'fixed-trunk-or-casing-b-around-both-vane-rows',
    'vertical-shaft-fast-on-jonval-runner-c',
    'tailwater-basin-below-axial-runner-discharge',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 436 preserves Brown’s detailed Jonval caption and discloses all engineered values', () => {
  const movement = catalog.movements[435];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate436;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_436.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /shutes.*outside of a drum.*radial to a common center and stationary/);
  assert.match(movement.description,
    /buckets exceed in number those of the shutes/);
  assert.match(movement.description,
    /slight tangent instead of radially.*cycloid or parabola/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /static sectional engraving and caption.*no Canvas construction/);
  assert.equal(dynamics.fluidPressureViscosityTurbulenceLeakageCavitationBladeLoadingBearingFrictionRunnerInertiaGeneratorLoadAndSpeedResponseModeled,
    false);
  assert.match(dynamics.angularMomentumDiagnostic,
    /guide-exit minus runner-discharge specific angular momentum.*negative \(clockwise\)/);
  assert.match(dynamics.markerContinuity,
    /continuously downward through both stacked rows.*fades to zero/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateCasingBoundsPixels, [96, 98, 333, 506]);
  assert.deepEqual(plate.approximateGuideRowYRangePixels, [327, 383]);
  assert.deepEqual(plate.approximateRunnerRowYRangePixels, [384, 441]);
  assert.equal(plate.approximateVisibleGuidePassages, 10);
  assert.equal(plate.approximateVisibleRunnerPassages, 14);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence,
    /sloping inlet.*downward flow arrow.*stationary upper vane row a.*lower runner row c/);
  assert.match(evidence.reconstructionDisclosure,
    /Twelve fixed shutes, eighteen parabolic runner buckets.*independently engineered/);
  disposeModel(model.root);
});

test('movement 436 source pose spaces all runner buckets uniformly in the row below fixed shutes', () => {
  const model = createMovementModel(catalog.movements[435]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  near(sourcePose.fixedGuideAngle, 0, 0, 'fixed guide source angle');
  near(sourcePose.runnerAngle, 0, 0, 'runner source angle');
  near(sourcePose.rowSeparation,
    geometry.guideRowCenterY - geometry.runnerRowCenterY, 0,
    'source row separation');
  assert.equal(sourcePose.runnerBuckets.length, geometry.runnerBucketCount);
  for (let index = 0; index < geometry.runnerBucketCount; index += 1) {
    const bucket = source.runnerBuckets[index];
    const next = source.runnerBuckets[(index + 1)
      % geometry.runnerBucketCount];
    near(horizontalRadius(bucket.center), geometry.runnerBucketCenterRadius,
      4.5e-16, `bucket ${index + 1} center radius`);
    near(bucket.center.y, geometry.runnerRowCenterY, 0,
      `bucket ${index + 1} runner-row height`);
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

test('movement 436 bucket centerlines have a slight initial tangent and an exact nonzero parabolic sweep', () => {
  const model = createMovementModel(catalog.movements[435]);
  const {
    geometry,
    runnerBucketProfiles,
    runnerSweepOffsetAtProgress,
  } = model.root.userData;
  const radialTravel = geometry.annulusOuterRadius
    - geometry.annulusInnerRadius;
  const step = 1e-4;
  const initialSlope = (
    runnerSweepOffsetAtProgress(step)
      - runnerSweepOffsetAtProgress(0)
  ) / (radialTravel * step);
  near(initialSlope, -Math.tan(geometry.runnerTangentAngle)
    - geometry.runnerParabolicCamber * step / radialTravel,
  2e-13, 'slight tangent at bucket entrance');
  const midpointSecondDerivative = (
    runnerSweepOffsetAtProgress(0.5 + step)
      - 2 * runnerSweepOffsetAtProgress(0.5)
      + runnerSweepOffsetAtProgress(0.5 - step)
  ) / step ** 2;
  near(midpointSecondDerivative, -2 * geometry.runnerParabolicCamber,
    1.5e-8, 'exact parabolic curvature');
  assert.notEqual(midpointSecondDerivative, 0);
  assert.equal(runnerBucketProfiles.length, geometry.runnerBucketCount);
  for (const profile of runnerBucketProfiles) {
    assert.equal(profile.length, 13);
    for (let index = 0; index < profile.length; index += 1) {
      const progress = index / (profile.length - 1);
      near(profile[index].z, runnerSweepOffsetAtProgress(progress), 0,
        'rendered profile follows diagnostic parabola');
      near(profile[index].y, geometry.runnerRowCenterY, 0,
        'profile stays within runner row');
    }
  }
  disposeModel(model.root);
});

test('movement 436 runner c and its vertical shaft rotate clockwise as one body under fixed row a', () => {
  const model = createMovementModel(catalog.movements[435]);
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
        'rigid runner-bucket attachment');
      near(horizontalRadius(bucket.center),
        geometry.runnerBucketCenterRadius, 7e-16,
        'bucket stays in axial annulus');
      near(bucket.center.y, geometry.runnerRowCenterY, 0,
        'bucket stays in lower row');
    }
  }
  disposeModel(model.root);
});

test('movement 436 guide whirl and runner de-whirl give exact clockwise angular-momentum torque', () => {
  const model = createMovementModel(catalog.movements[435]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const state = stateAtInputAngle(0);
  const positiveTangent = new THREE.Vector3(0, 0, -1);

  near(state.guideExitVelocity.y, -geometry.guideExitAxialSpeed, 0,
    'downward guide-exit speed');
  near(state.guideExitVelocity.dot(positiveTangent),
    -geometry.guideExitClockwiseWhirlSpeed, 0,
    'clockwise guide-exit whirl');
  near(state.runnerDischargeVelocity.y,
    -geometry.runnerDischargeAxialSpeed, 0,
    'downward runner discharge speed');
  near(state.runnerDischargeVelocity.dot(positiveTangent),
    -geometry.runnerDischargeClockwiseWhirlSpeed, 0,
    'small residual clockwise whirl');
  const inletMomentum = new THREE.Vector3()
    .crossVectors(state.guideExitPoint, state.guideExitVelocity).y;
  const outletMomentum = new THREE.Vector3()
    .crossVectors(
      state.runnerDischargePoint,
      state.runnerDischargeVelocity,
    ).y;
  near(state.inletSpecificAngularMomentumY, inletMomentum, 0,
    'guide-exit specific angular momentum');
  near(state.outletSpecificAngularMomentumY, outletMomentum, 0,
    'runner-exit specific angular momentum');
  assert.ok(Math.abs(outletMomentum) < Math.abs(inletMomentum));
  near(state.runnerTorqueNormalized,
    geometry.massFlowNormalized * (inletMomentum - outletMomentum),
    0, 'Euler angular-momentum torque');
  near(state.runnerTorqueNormalized, -3.5519999999999996, 1e-15,
    'reconstructed clockwise torque');
  disposeModel(model.root);
});

test('movement 436 water markers descend continuously through both rows without a row-boundary jump', () => {
  const model = createMovementModel(catalog.movements[435]);
  const { flowCurves } = model.root.userData;

  assert.equal(flowCurves.length, 6);
  for (let pathIndex = 0; pathIndex < flowCurves.length; pathIndex += 1) {
    const curve = flowCurves[pathIndex];
    assert.ok(curve.getPoint(0).y > 1.6);
    assert.ok(curve.getPoint(1).y < -1.6);
    let previousY = curve.getPoint(0).y;
    let maximumStep = 0;
    for (let sample = 1; sample <= 10000; sample += 1) {
      const point = curve.getPoint(sample / 10000);
      assert.ok(Number.isFinite(point.x + point.y + point.z));
      assert.ok(point.y <= previousY + 1e-5,
        `path ${pathIndex + 1} remains downward`);
      maximumStep = Math.max(maximumStep, Math.abs(point.y - previousY));
      previousY = point.y;
    }
    assert.ok(maximumStep < 6e-4);
    const before = curve.getTangent(0.49999).normalize();
    const after = curve.getTangent(0.50001).normalize();
    assert.ok(before.angleTo(after) < 2e-4,
      `path ${pathIndex + 1} is tangent-continuous between rows`);
  }
  disposeModel(model.root);
});

test('movement 436 analytic runner-rim and bucket motion matches finite differences', () => {
  const model = createMovementModel(catalog.movements[435]);
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
    for (const index of [0, 6, 12]) {
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

test('movement 436 update rotates only runner c while casing b, shutes a, and axial flow stay fixed', () => {
  const model = createMovementModel(catalog.movements[435]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const fixedBlocks = [blocks.fixedGuideAssembly, blocks.casing,
    blocks.inletFlume, blocks.inletWater, blocks.lowerBasin,
    blocks.foundation, blocks.upperBearing, blocks.lowerBearing,
    ...blocks.flowPathTubes];
  const fixedTransforms = fixedBlocks.map((block) => ({
    position: block.position.clone(),
    quaternion: block.quaternion.clone(),
  }));

  for (const time of [0, 0.23, 0.61, 1.04, 1.49, 1.97, 2.44,
    2.91, 3.39, 3.86, 4.34, 4.82, 5.42]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.runner.rotation.y, state.runnerAngle, 1.2e-16,
      'clockwise runner update');
    fixedBlocks.forEach((block, index) => {
      vectorNear(block.position, fixedTransforms[index].position, 0,
        'fixed casing/flow position');
      near(block.quaternion.angleTo(fixedTransforms[index].quaternion),
        0, 5e-8, 'fixed casing/flow orientation');
    });
  }
  model.update(0);
  near(blocks.flowMarkers[0].scale.x, 0, 0,
    'top recycling marker fades completely');
  model.update(1.18);
  near(blocks.flowMarkers[0].scale.x, 0, 2e-8,
    'bottom-to-top marker reset is hidden');
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  vectorNear(closure.rimReferencePoint, source.rimReferencePoint, 0,
    'runner cycle closure');
  near(closure.runnerTorqueNormalized, source.runnerTorqueNormalized, 0,
    'flow torque cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 5.7);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 436 stacked Jonval rows', () => {
  const movement436 = catalog.movements[435];
  const movement507 = catalog.movements[506];
  const model436 = createMovementModel(movement436);
  const model507 = createMovementModel(movement507);

  assert.equal(movement436.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model436.root);
  disposeModel(model507.root);
});
