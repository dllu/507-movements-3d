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
  'holly-double-conjugate-toothed-elliptical-pistons-counterrotating-one-to-one-between-central-steam-ports';
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

function transformedProfilePoint(point, angle, center, scale) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    center.x + scale * (cosine * point[0] - sine * point[1]),
    center.y + scale * (sine * point[0] + cosine * point[1]),
  );
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

test('movement 429 has two distinct conjugate toothed elliptical pistons on fixed side-by-side shafts and central steam ports', () => {
  const movement = catalog.movements[428];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 429);
  assert.equal(movement.number, '429');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /two distinct conjugate toothed elliptical piston profiles/);
  assert.match(data.mechanism, /fixed centers eight source units apart/);
  assert.match(data.mechanism, /left piston turns counterclockwise while the right turns clockwise/);
  assert.match(data.mechanism, /exactly the same speed/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.leftAndRightRotationIndependent, false);
  assert.equal(blocks.leftPiston.parent, blocks.leftRotor);
  assert.equal(blocks.rightPiston.parent, blocks.rightRotor);
  assert.equal(blocks.leftRotor.parent, model.root);
  assert.equal(blocks.rightRotor.parent, model.root);
  assert.equal(blocks.leftShaft.parent, model.root);
  assert.equal(blocks.rightShaft.parent, model.root);
  // Pass 90: Brown's packing strips are inset flush in each piston tip.
  assert.equal(blocks.leftPackingStrips.length, 2);
  assert.equal(blocks.rightPackingStrips.length, 2);
  for (const strip of [...blocks.leftPackingStrips, ...blocks.rightPackingStrips]) {
    assert.ok([blocks.leftRotor, blocks.rightRotor].includes(strip.parent));
  }

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'left-rounded-conjugate-elliptical-piston',
    'right-rounded-conjugate-elliptical-piston',
    'fixed-double-lobed-cylinder-around-both-elliptical-pistons',
    'fixed-solid-back-cover-of-double-lobed-casing',
    'live-steam-in-top-induction-channel',
    'exhaust-steam-in-bottom-eduction-channel',
    'left-piston-shaft-in-fixed-bearing',
    'right-piston-shaft-in-fixed-bearing',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 429 records Brown’s Holly topology and the official two-profile Canvas construction', () => {
  const movement = catalog.movements[428];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate429;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_429.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Holly’s patent double-elliptical rotary engine/);
  assert.match(movement.description, /two elliptical pistons geared together/);
  assert.match(movement.description, /steam entering between them/);
  assert.match(movement.description, /opposite directions/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.officialCanvasCyclePeriod, 4);
  assert.equal(sourceAnimation.officialCanvasCyclesPerMinute, 15);
  assert.equal(sourceAnimation.officialCanvasLeftRotationMultiplier, 1);
  assert.equal(sourceAnimation.officialCanvasRightRotationMultiplier, -1);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(dynamics.profileContactModel,
    /two conjugate source profiles.*exact 1:-1 phase law/);
  assert.equal(dynamics.pressureExpansionCutoffLeakageFrictionInertiaAndLoadsModeled,
    false);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.leftShaftApproximateCenterPixels, [177, 273]);
  assert.deepEqual(plate.rightShaftApproximateCenterPixels, [348, 273]);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.officialCanvasEvidence,
    /pivots at source coordinates \(0,0\) and \(8,0\)/);
  assert.match(evidence.officialCanvasEvidence,
    /distinct left and right conjugate profiles with ten paths apiece/);
  assert.match(evidence.officialCanvasEvidence,
    /left profile by \+cyclePos and the right by -cyclePos/);
  assert.match(evidence.reconstructionDisclosure,
    /come from the official Canvas model/);
  disposeModel(model.root);
});

test('movement 429 ports both official conjugate outlines rather than substituting ordinary ellipses or identical gears', () => {
  const model = createMovementModel(catalog.movements[428]);
  const { geometry, sourceProfiles } = model.root.userData;
  const leftXs = sourceProfiles.leftPoints.map(([x]) => x);
  const leftYs = sourceProfiles.leftPoints.map(([, y]) => y);
  const rightXs = sourceProfiles.rightPoints.map(([x]) => x);
  const rightYs = sourceProfiles.rightPoints.map(([, y]) => y);

  assert.equal(sourceProfiles.leftPathCount, 10);
  assert.equal(sourceProfiles.rightPathCount, 10);
  assert.equal(sourceProfiles.leftPoints.length, 343);
  assert.equal(sourceProfiles.rightPoints.length, 423);
  assert.equal(geometry.leftProfilePointCount, 343);
  assert.equal(geometry.rightProfilePointCount, 423);
  near(Math.min(...leftXs), -3.810977, 5e-7,
    'left source minimum x');
  near(Math.max(...leftXs), 3.810977, 5e-7,
    'left source maximum x');
  near(Math.min(...leftYs), -5.324122, 5e-7,
    'left source minimum y');
  near(Math.max(...leftYs), 5.324122, 5e-7,
    'left source maximum y');
  near(Math.min(...rightXs), -5.324122, 5e-7,
    'right source minimum x');
  near(Math.max(...rightXs), 5.324122, 5e-7,
    'right source maximum x');
  assert.ok(Math.max(...rightYs) > 4.0475);
  assert.ok(Math.min(...rightYs) < -4.0475);
  near(sourceProfiles.leftSignedArea, 47.89966964578996, 2e-13,
    'left exact profile area');
  near(sourceProfiles.rightSignedArea, 49.412117509932855, 2e-13,
    'right exact profile area');
  assert.notEqual(sourceProfiles.leftSignedArea,
    sourceProfiles.rightSignedArea);
  assert.ok(sourceProfiles.leftMaximumConnectionGap < 0.0171);
  assert.ok(sourceProfiles.rightMaximumConnectionGap < 2.4e-6);
  disposeModel(model.root);
});

test('movement 429 exact source pose fixes the shafts eight units apart and the two major axes at a quarter turn', () => {
  const model = createMovementModel(catalog.movements[428]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  vectorNear(sourcePose.leftCenter,
    new THREE.Vector3(-1.44, 0, 0), 0, 'left source center');
  vectorNear(sourcePose.rightCenter,
    new THREE.Vector3(1.44, 0, 0), 0, 'right source center');
  near(sourcePose.leftCenter.distanceTo(sourcePose.rightCenter),
    geometry.centerDistance, 0, 'fixed center distance');
  near(geometry.sourceCenterDistance, 8, 0, 'source center distance');
  near(geometry.sourceProfilePhaseOffset, -Math.PI / 2, 0,
    'source embedded profile offset');
  sameAngle(sourcePose.leftMajorAxisAngle, Math.PI / 2, 0,
    'left source major axis');
  sameAngle(sourcePose.rightMajorAxisAngle, 0, 0,
    'right source major axis');
  near(source.sourceProfilePhaseConstraintResidual, 0, 0,
    'source quarter-turn phase constraint');
  near(source.centerDistanceResidual, 0, 0,
    'source fixed-center constraint');
  disposeModel(model.root);
});

test('movement 429 pistons retain exact equal-and-opposite rotations, speeds, and accelerations throughout the cycle', () => {
  const model = createMovementModel(catalog.movements[428]);
  const { stateAtInputAngle } = model.root.userData;

  for (let sample = -50000; sample <= 100000; sample += 1) {
    const angle = FULL_TURN * sample / 50000;
    const speed = 1.21 + 0.17 * Math.cos(angle * 0.31);
    const acceleration = -0.29 * Math.sin(angle * 0.47);
    const state = stateAtInputAngle(angle, speed, acceleration);
    sameAngle(state.leftAngle, angle, 5e-15,
      'left counterclockwise coordinate');
    sameAngle(state.rightAngle, -angle, 5e-15,
      'right clockwise coordinate');
    near(state.rightAngularSpeed, -state.leftAngularSpeed, 0,
      '1:-1 angular-speed ratio');
    near(state.rightAngularAcceleration,
      -state.leftAngularAcceleration, 0,
      '1:-1 angular-acceleration ratio');
    near(state.conjugateAngularSpeedResidual, 0, 0,
      'conjugate speed residual');
    near(state.sourceProfilePhaseConstraintResidual, 0, 8.9e-16,
      'embedded quarter-turn phase residual');
    vectorNear(state.leftCenter,
      new THREE.Vector3(-1.44, 0, 0), 0,
      'left shaft remains fixed');
    vectorNear(state.rightCenter,
      new THREE.Vector3(1.44, 0, 0), 0,
      'right shaft remains fixed');
  }
  disposeModel(model.root);
});

test('movement 429 both official piston profiles remain inside the exact double-lobed source cylinder through a full revolution', () => {
  const model = createMovementModel(catalog.movements[428]);
  const data = model.root.userData;
  const { geometry, sourceProfiles } = data;
  let maximumCapsuleRadius = 0;

  for (let phaseIndex = 0; phaseIndex < 720; phaseIndex += 1) {
    const inputAngle = FULL_TURN * phaseIndex / 720;
    for (const [points, angle, center] of [
      [sourceProfiles.leftPoints, inputAngle, geometry.leftCenter],
      [sourceProfiles.rightPoints, -inputAngle, geometry.rightCenter],
    ]) {
      for (const point of points) {
        const world = transformedProfilePoint(
          point,
          angle,
          center,
          geometry.sourceScale,
        );
        const nearestCenterlineX = THREE.MathUtils.clamp(
          world.x,
          -geometry.halfCenterDistance,
          geometry.halfCenterDistance,
        );
        const capsuleRadius = Math.hypot(
          world.x - nearestCenterlineX,
          world.y,
        );
        maximumCapsuleRadius = Math.max(
          maximumCapsuleRadius,
          capsuleRadius,
        );
        assert.ok(capsuleRadius <= geometry.innerHousingRadius + 3e-8);
      }
    }
  }
  near(maximumCapsuleRadius, geometry.innerHousingRadius, 3e-8,
    'profile-to-housing sealing reach');
  near(geometry.sourceInnerHousingRadius, 5.333333, 0,
    'official inner housing radius');
  near(geometry.sourceOuterHousingRadius, 6, 0,
    'official outer housing radius');
  disposeModel(model.root);
});

test('movement 429 exact conjugate outlines remain in continuous meshing proximity at all sampled phases', () => {
  const model = createMovementModel(catalog.movements[428]);
  const data = model.root.userData;
  const { geometry, sourceProfiles } = data;
  let largestNearestVertexDistance = 0;

  for (let phaseIndex = 0; phaseIndex < 72; phaseIndex += 1) {
    const inputAngle = FULL_TURN * phaseIndex / 72;
    const left = sourceProfiles.leftPoints.map((point) =>
      transformedProfilePoint(
        point,
        inputAngle,
        geometry.leftCenter,
        geometry.sourceScale,
      ));
    const right = sourceProfiles.rightPoints.map((point) =>
      transformedProfilePoint(
        point,
        -inputAngle,
        geometry.rightCenter,
        geometry.sourceScale,
      ));
    let nearestDistance = Infinity;
    for (const leftPoint of left) {
      for (const rightPoint of right) {
        nearestDistance = Math.min(
          nearestDistance,
          leftPoint.distanceTo(rightPoint),
        );
      }
    }
    largestNearestVertexDistance = Math.max(
      largestNearestVertexDistance,
      nearestDistance,
    );
  }
  assert.ok(largestNearestVertexDistance < 0.018);
  disposeModel(model.root);
});

test('movement 429 analytic reference-point velocities and accelerations match finite differences on both pistons', () => {
  const model = createMovementModel(catalog.movements[428]);
  const { stateAtInputAngle } = model.root.userData;
  const angleStep = 1e-5;

  for (const angle of [0.13, 0.48, 0.91, 1.37, 1.82, 2.29,
    2.77, 3.24, 3.72, 4.18, 4.67, 5.16, 5.63, 6.08]) {
    const state = stateAtInputAngle(angle);
    const timeStep = angleStep / state.inputSpeed;
    const before = stateAtInputAngle(angle - angleStep);
    const after = stateAtInputAngle(angle + angleStep);
    for (const prefix of ['left', 'right']) {
      const numericalVelocity = after[`${prefix}ReferencePoint`].clone()
        .sub(before[`${prefix}ReferencePoint`])
        .multiplyScalar(1 / (2 * timeStep));
      const numericalAcceleration = after[`${prefix}ReferenceVelocity`]
        .clone().sub(before[`${prefix}ReferenceVelocity`])
        .multiplyScalar(1 / (2 * timeStep));
      vectorNear(numericalVelocity,
        state[`${prefix}ReferenceVelocity`], 4e-10,
        `${prefix} reference velocity at ${angle}`);
      vectorNear(numericalAcceleration,
        state[`${prefix}ReferenceAcceleration`], 7e-10,
        `${prefix} reference acceleration at ${angle}`);
    }
  }
  disposeModel(model.root);
});

test('movement 429 update counterrotates only the two piston groups and closes the official four-second cycle', () => {
  const model = createMovementModel(catalog.movements[428]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const leftShaftPosition = blocks.leftShaft.position.clone();
  const rightShaftPosition = blocks.rightShaft.position.clone();
  const housingPosition = blocks.rearHousing.position.clone();

  for (const time of [0, 0.19, 0.53, 0.91, 1.34, 1.78, 2.21,
    2.66, 3.08, 3.47, 3.83]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.leftRotor.rotation.z, state.leftAngle, 1.2e-16,
      'left piston update');
    sameAngle(blocks.rightRotor.rotation.z, state.rightAngle, 1.2e-16,
      'right piston update');
    vectorNear(blocks.leftShaft.position, leftShaftPosition, 0,
      'left shaft bearing fixed');
    vectorNear(blocks.rightShaft.position, rightShaftPosition, 0,
      'right shaft bearing fixed');
    vectorNear(blocks.rearHousing.position, housingPosition, 0,
      'cylinder fixed');
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  vectorNear(closure.leftReferencePoint, source.leftReferencePoint, 0,
    'left profile cycle closure');
  vectorNear(closure.rightReferencePoint, source.rightReferencePoint, 0,
    'right profile cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 4);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 429 double-elliptical geometry', () => {
  const movement429 = catalog.movements[428];
  const movement507 = catalog.movements[506];
  const model429 = createMovementModel(movement429);
  const model507 = createMovementModel(movement507);

  assert.equal(movement429.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model429.root);
  disposeModel(model507.root);
});

test('429 (pass 71): pistons fill the bores\' depth; steam at the top drives them and is released at the bottom', () => {
  const model = createMovementModel(catalog.movements[428]);
  const { blocks, geometry, steamReport } = model.root.userData;
  try {
    for (const piston of [blocks.leftPiston, blocks.rightPiston]) {
      piston.geometry.computeBoundingBox();
      const box = piston.geometry.boundingBox;
      assert.ok(piston.position.z + box.min.z < -0.5 && piston.position.z + box.max.z > 0.68, 'full-depth piston');
    }
    // four pockets are released per turn, one every quarter turn
    assert.equal(steamReport.releaseAngles.length, 4);
    const { live, carried, exhaust, induction, eduction } = blocks.steam;
    assert.equal(induction.userData.pressure, 1);
    assert.equal(eduction.userData.pressure, 0);
    for (let i = 0; i <= 64; i += 1) {
      model.update(geometry.cycleDuration * i / 64);
      assert.ok(live.userData.area > 1, 'live space between the pistons at the top');
      assert.equal(live.userData.pressure, 1);
      assert.equal(carried.userData.pressure, 1);
      assert.ok(exhaust.userData.pressure < 0.6);
      assert.ok(live.userData.area + carried.userData.area + exhaust.userData.area > 7);
    }
  } finally { disposeModel(model.root); }
});
