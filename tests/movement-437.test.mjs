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
  'volute-water-wheel-with-eight-radial-vanes-driven-around-fixed-scroll-and-four-lower-inclined-escape-buckets';
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

test('movement 437 combines eight upper radial vanes with four lower inclined buckets inside a fixed scroll', () => {
  const movement = catalog.movements[436];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 437);
  assert.equal(movement.number, '437');
  assert.equal(movement.category, 'Water wheels & turbines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /fixed scroll casing b.*circulates clockwise/);
  assert.match(data.mechanism, /all eight upper radial vanes a/);
  assert.match(data.mechanism, /Four inclined buckets c occupy a lower axial level/);
  assert.match(data.mechanism, /adds a second clockwise torque/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.voluteCasingRotates, false);
  assert.equal(degreesOfFreedom.lowerBucketsAndUpperVanesIndependent, false);
  assert.equal(geometry.radialVaneCount, 8);
  assert.equal(geometry.lowerBucketCount, 4);
  assert.equal(blocks.radialVanes.length, 8);
  assert.equal(blocks.lowerBuckets.length, 4);
  assert.equal(blocks.escapeFlowTubes.length, 4);
  assert.equal(blocks.escapeMarkers.length, 12);
  for (const part of [...blocks.radialVanes, ...blocks.lowerBuckets,
    blocks.runnerFloor, blocks.runnerHub, blocks.shaft,
    blocks.rotationMarker]) assert.ok(part.parent === blocks.runner, `${part.userData.role} parent`);
  for (const fixed of [blocks.outerScrollWall, blocks.innerScrollWall,
    blocks.scrollWater, blocks.inletFlume, blocks.inletWater,
    blocks.lowerBasin,
    ...blocks.escapeFlowTubes]) assert.ok(fixed.parent === model.root, `${fixed.userData.role} parent`);
  for (const removed of [blocks.casingFloor, blocks.upperBearing]) {
    assert.ok(removed.parent === null, `source presentation removes ${removed.userData.role}`);
  }
  assert.ok(geometry.radialVaneCenterY > geometry.lowerBucketCenterY,
    'inclined outlet buckets are below the radial vanes');

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.filter((role) =>
    /^upper-radial-vane-a-\d+-of-eight$/.test(role)).length, 8);
  assert.equal(roles.filter((role) =>
    /^inclined-lower-escape-bucket-c-\d+-of-four$/.test(role)).length, 4);
  for (const role of [
    'fixed-outer-wall-of-scroll-casing-b',
    'fixed-inner-wall-of-scroll-casing-b',
    'clockwise-water-confined-around-runner-by-volute-b',
    'clockwise-volute-wheel-with-upper-radial-vanes-a-and-lower-buckets-c',
    'tailwater-basin-below-inclined-outlet-buckets',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 437 preserves Brown’s three-part volute description and discloses reconstructed quantities', () => {
  const movement = catalog.movements[436];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate437;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_437.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /radial vanes, a, against which the water impinges/);
  assert.match(movement.description,
    /scroll or volute casing, b.*acts against the vanes all around/);
  assert.match(movement.description,
    /inclined buckets, c, c, at the bottom.*additional force/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /static plan-view engraving and caption.*no Canvas construction/);
  assert.equal(dynamics.fluidPressureViscosityTurbulenceLeakageCavitationDetailedBladeLoadingBearingFrictionRunnerInertiaGeneratorLoadAndSpeedResponseModeled,
    false);
  assert.match(dynamics.upperVaneImpulseDiagnostic,
    /tangential water force times effective radius.*negative \(clockwise\)/);
  assert.match(dynamics.lowerBucketAngularMomentumDiagnostic,
    /additional lower-stage torque.*adds to the clockwise upper-vane torque/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.centerApproximatePixels, [226, 285]);
  assert.deepEqual(plate.inletThroatApproximatePixels, [116, 128]);
  assert.equal(plate.approximateRadialVaneCount, 8);
  assert.equal(plate.approximateInclinedLowerBucketCount, 4);
  assert.equal(evidence.explicitInBrownDescription.length, 3);
  assert.match(evidence.engravingEvidence,
    /tangential upper-left inlet.*clockwise scroll.*eight radial vane positions.*four shaded inclined bucket sectors/);
  assert.match(evidence.reconstructionDisclosure,
    /Eight radial vanes, four lower buckets.*independently engineered/);
  disposeModel(model.root);
});

test('movement 437 source pose uniformly spaces both vane stages on their distinct axial levels', () => {
  const model = createMovementModel(catalog.movements[436]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  near(sourcePose.runnerAngle, 0, 0, 'source runner angle');
  near(sourcePose.voluteAngle, 0, 0, 'fixed volute angle');
  assert.equal(sourcePose.radialVanes.length, geometry.radialVaneCount);
  assert.equal(sourcePose.lowerBuckets.length, geometry.lowerBucketCount);
  for (let index = 0; index < geometry.radialVaneCount; index += 1) {
    const vane = source.radialVanes[index];
    const next = source.radialVanes[(index + 1) % geometry.radialVaneCount];
    near(horizontalRadius(vane.center), geometry.radialVaneCenterRadius,
      4.5e-16, `vane ${index + 1} radius`);
    near(vane.center.y, geometry.radialVaneCenterY, 0,
      `vane ${index + 1} upper height`);
    near(THREE.MathUtils.euclideanModulo(
      next.worldAngle - vane.worldAngle,
      FULL_TURN,
    ), geometry.radialVanePitch, 1.8e-15, `vane ${index + 1} pitch`);
    vectorNear(sourcePose.radialVanes[index].center,
      vane.center, 0, `source vane ${index + 1}`);
  }
  for (let index = 0; index < geometry.lowerBucketCount; index += 1) {
    const bucket = source.lowerBuckets[index];
    const next = source.lowerBuckets[(index + 1) % geometry.lowerBucketCount];
    near(horizontalRadius(bucket.center), geometry.lowerBucketCenterRadius,
      4.5e-16, `lower bucket ${index + 1} radius`);
    near(bucket.center.y, geometry.lowerBucketCenterY, 0,
      `lower bucket ${index + 1} height`);
    near(THREE.MathUtils.euclideanModulo(
      next.worldAngle - bucket.worldAngle,
      FULL_TURN,
    ), geometry.lowerBucketPitch, 1.8e-15,
    `lower bucket ${index + 1} pitch`);
  }
  disposeModel(model.root);
});

test('movement 437 radial vanes a, lower buckets c, and shaft rotate clockwise as one rigid runner', () => {
  const model = createMovementModel(catalog.movements[436]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = -10000; sample <= 20000; sample += 1) {
    const inputAngle = FULL_TURN * sample / 10000;
    const state = stateAtInputAngle(inputAngle);
    sameAngle(state.runnerAngle, -inputAngle, 5e-15,
      'clockwise runner coordinate');
    assert.ok(state.runnerAngularSpeed < 0);
    for (const vane of state.radialVanes) {
      sameAngle(vane.worldAngle,
        vane.localAngle + state.runnerAngle, 5e-15,
        'rigid radial-vane attachment');
      near(horizontalRadius(vane.center),
        geometry.radialVaneCenterRadius, 7e-16,
        'radial vane stays on runner');
    }
    for (const bucket of state.lowerBuckets) {
      sameAngle(bucket.worldAngle,
        bucket.localAngle + state.runnerAngle, 5e-15,
        'rigid lower-bucket attachment');
      near(horizontalRadius(bucket.center),
        geometry.lowerBucketCenterRadius, 7e-16,
        'lower bucket stays on runner');
    }
  }
  disposeModel(model.root);
});

test('movement 437 decreasing-radius scroll carries water clockwise around all radial vanes', () => {
  const model = createMovementModel(catalog.movements[436]);
  const {
    geometry,
    scrollFlowCurve,
    voluteRadiusAtProgress,
  } = model.root.userData;

  near(voluteRadiusAtProgress(0), geometry.voluteStartRadius, 0,
    'scroll inlet radius');
  near(voluteRadiusAtProgress(1), geometry.voluteEndRadius, 0,
    'scroll tongue radius');
  let previousRadius = horizontalRadius(scrollFlowCurve.getPoint(0));
  let previousUnwrappedAngle = geometry.voluteStartAngle;
  for (let sample = 1; sample <= 20000; sample += 1) {
    const progress = sample / 20000;
    const point = scrollFlowCurve.getPoint(progress);
    const radius = horizontalRadius(point);
    const expectedRadius = voluteRadiusAtProgress(progress);
    near(radius, expectedRadius, 1e-3,
      'rendered scroll follows decreasing-radius law');
    assert.ok(radius <= previousRadius + 1e-6);
    previousRadius = radius;
    const rawAngle = Math.atan2(-point.z, point.x);
    let unwrappedAngle = rawAngle;
    while (unwrappedAngle > previousUnwrappedAngle + Math.PI) {
      unwrappedAngle -= FULL_TURN;
    }
    while (unwrappedAngle < previousUnwrappedAngle - Math.PI) {
      unwrappedAngle += FULL_TURN;
    }
    assert.ok(unwrappedAngle <= previousUnwrappedAngle + 1e-6,
      'scroll proceeds clockwise');
    previousUnwrappedAngle = unwrappedAngle;
  }
  near(previousUnwrappedAngle,
    geometry.voluteStartAngle - geometry.voluteSweepAngle, 2e-5,
    'scroll wraps through reconstructed sweep');
  disposeModel(model.root);
});

test('movement 437 inclined lower buckets add same-direction torque to casing-distributed vane impulse', () => {
  const model = createMovementModel(catalog.movements[436]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const state = stateAtInputAngle(0);

  near(state.upperVaneTorqueNormalized,
    -geometry.upperEffectiveRadius
      * geometry.upperTangentialForceNormalized,
  0, 'upper radial-vane torque');
  near(state.lowerInletAngularMomentumY,
    -geometry.lowerBucketCenterRadius
      * geometry.lowerInletClockwiseWhirlSpeed,
  0, 'lower-stage inlet angular momentum');
  near(state.lowerOutletAngularMomentumY,
    -geometry.lowerBucketCenterRadius
      * geometry.lowerOutletClockwiseWhirlSpeed,
  0, 'lower-stage outlet angular momentum');
  near(state.lowerBucketTorqueNormalized,
    geometry.lowerMassFlowNormalized * (
      state.lowerInletAngularMomentumY
        - state.lowerOutletAngularMomentumY
    ), 0, 'inclined escape-bucket torque');
  assert.ok(state.upperVaneTorqueNormalized < 0);
  assert.ok(state.lowerBucketTorqueNormalized < 0);
  near(state.totalTorqueNormalized,
    state.upperVaneTorqueNormalized + state.lowerBucketTorqueNormalized,
    0, 'two-stage torque sum');
  assert.ok(Math.abs(state.totalTorqueNormalized)
    > Math.abs(state.upperVaneTorqueNormalized));
  near(state.totalTorqueNormalized, -20.0682, 1e-14,
    'reconstructed total clockwise torque');
  disposeModel(model.root);
});

test('movement 437 outlet markers descend through unified inclined-bucket paths without a stage jump', () => {
  const model = createMovementModel(catalog.movements[436]);
  const { escapeFlowCurves } = model.root.userData;

  assert.equal(escapeFlowCurves.length, 4);
  for (let pathIndex = 0; pathIndex < escapeFlowCurves.length;
    pathIndex += 1) {
    const curve = escapeFlowCurves[pathIndex];
    assert.ok(curve.getPoint(0).y > 0);
    assert.ok(curve.getPoint(1).y < -1.5);
    let previousY = curve.getPoint(0).y;
    let maximumStep = 0;
    for (let sample = 1; sample <= 10000; sample += 1) {
      const point = curve.getPoint(sample / 10000);
      assert.ok(point.y <= previousY + 1e-5,
        `escape path ${pathIndex + 1} remains downward`);
      maximumStep = Math.max(maximumStep, Math.abs(point.y - previousY));
      previousY = point.y;
    }
    assert.ok(maximumStep < 4e-4);
    const before = curve.getTangent(0.49999).normalize();
    const after = curve.getTangent(0.50001).normalize();
    assert.ok(before.angleTo(after) < 2e-4,
      `escape path ${pathIndex + 1} is tangent-continuous`);
  }
  disposeModel(model.root);
});

test('movement 437 analytic vane and lower-bucket motion matches finite differences', () => {
  const model = createMovementModel(catalog.movements[436]);
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
    for (const [collection, indices] of [
      ['radialVanes', [0, 3, 6]],
      ['lowerBuckets', [0, 1, 3]],
    ]) {
      for (const index of indices) {
        const numericalVelocity = after[collection][index].center.clone()
          .sub(before[collection][index].center)
          .multiplyScalar(1 / (2 * timeStep));
        const numericalAcceleration =
          after[collection][index].centerVelocity.clone()
            .sub(before[collection][index].centerVelocity)
            .multiplyScalar(1 / (2 * timeStep));
        vectorNear(numericalVelocity,
          state[collection][index].centerVelocity, 4e-10,
          `${collection} ${index + 1} velocity at ${angle}`);
        vectorNear(numericalAcceleration,
          state[collection][index].centerAcceleration, 7e-10,
          `${collection} ${index + 1} acceleration at ${angle}`);
      }
    }
  }
  disposeModel(model.root);
});

test('movement 437 update rotates one two-stage runner while scroll casing and flow paths remain fixed', () => {
  const model = createMovementModel(catalog.movements[436]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const fixedBlocks = [blocks.outerScrollWall, blocks.innerScrollWall,
    blocks.scrollWater, blocks.inletFlume, blocks.inletWater,
    blocks.lowerBasin, blocks.casingFloor, blocks.upperBearing,
    ...blocks.escapeFlowTubes];
  const fixedTransforms = fixedBlocks.map((block) => ({
    position: block.position.clone(),
    quaternion: block.quaternion.clone(),
  }));

  for (const time of [0, 0.23, 0.61, 1.04, 1.49, 1.97, 2.44,
    2.91, 3.39, 3.86, 4.34, 4.82, 5.24]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.runner.rotation.y, state.runnerAngle, 1.2e-16,
      'clockwise runner update');
    fixedBlocks.forEach((block, index) => {
      vectorNear(block.position, fixedTransforms[index].position, 0,
        'fixed scroll/flow position');
      near(block.quaternion.angleTo(fixedTransforms[index].quaternion),
        0, 5e-8, 'fixed scroll/flow orientation');
    });
  }
  model.update(0);
  near(blocks.scrollMarkers[0].scale.x, 0, 0,
    'scroll recycling marker fades completely');
  near(blocks.escapeMarkers[0].scale.x, 0, 0,
    'escape recycling marker fades completely');
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  vectorNear(closure.rimReferencePoint, source.rimReferencePoint, 0,
    'runner cycle closure');
  near(closure.totalTorqueNormalized, source.totalTorqueNormalized, 0,
    'two-stage torque cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 5.5);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 437 volute topology', () => {
  const movement437 = catalog.movements[436];
  const movement507 = catalog.movements[506];
  const model437 = createMovementModel(movement437);
  const model507 = createMovementModel(movement507);

  assert.equal(movement437.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model437.root);
  disposeModel(model507.root);
});
