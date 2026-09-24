import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vector2Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function vector3Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function cross2(a, b) {
  return a.x * b.y - a.y * b.x;
}

function worldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function worldXYNear(object, expected, tolerance, message) {
  const actual = worldPosition(object);
  vector2Near(new THREE.Vector2(actual.x, actual.y), expected,
    tolerance, message);
}

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

test('movement 344 is the mid-trunnion direct-crank oscillating engine', () => {
  const movement = catalog.movements[343];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    contacts,
    degreesOfFreedom,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 344);
  assert.equal(movement.number, '344');
  assert.equal(movement.title,
    'Oscillating engine. The cylinder has trunnions at the middle of its…');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'mid-trunnion-oscillating-cylinder-direct-crank-engine');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /crank-O-P-direct-piston-rod-P-H/);
  assert.match(mechanism, /midpoint-trunnion-T/);
  assert.match(transmission.exactConstraint, /\|O-P\|=2\.25/);
  assert.match(transmission.exactConstraint, /H=P-6\.75u/);
  assert.match(transmission.output, /\|T-P\|-6\.75/);
  assert.equal(degreesOfFreedom.mechanism, 1);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.inputCrank.parent, model.root);
  assert.equal(blocks.cylinderAssembly.parent, model.root);
  assert.equal(blocks.pistonAssembly.parent, model.root);
  assert.ok(blocks.crankPin.parent === blocks.inputCrank,
    'the crank carries its own pin P');
  assert.ok(blocks.crankShaft.parent === blocks.inputCrank,
    'the live shaft turns with the crank in the rail bearing');
  assert.equal(blocks.crankArm.parent, blocks.inputCrank);
  assert.equal(blocks.crankPinAnchor.parent, blocks.inputCrank);
  assert.equal(blocks.cylinderPivotAnchor.parent,
    blocks.cylinderAssembly);
  assert.equal(blocks.cylinderTopAxisAnchor.parent,
    blocks.cylinderAssembly);
  assert.equal(blocks.pistonCrankAnchor.parent, blocks.pistonAssembly);
  assert.equal(blocks.pistonHeadAnchor.parent, blocks.pistonAssembly);
  assert.equal(blocks.pistonHead.parent, blocks.pistonAssembly);
  assert.equal(blocks.pistonRod.parent, blocks.pistonAssembly);
  assert.equal(blocks.cylinderWalls.length, 1);
  assert.ok(blocks.cylinderWalls[0] === blocks.barrel);
  assert.equal(blocks.cylinderEndPlates.length, 2);
  assert.equal(blocks.glandCollars.length, 3);
  for (const undrawn of ['boreBack', 'crankDisk', 'crankHub', 'crankIndex',
    'crankPinBoss', 'pistonHeadIndex', 'trunnionBearingFront',
    'trunnionCenterCap', 'upperBearingPedestal']) {
    assert.equal(blocks[undrawn], undefined, `${undrawn} is not in Brown's plate`);
  }
  assert.equal(contacts.crankBearingO.fixedMember, blocks.fixedFrame);
  assert.equal(contacts.crankBearingO.movingMember, blocks.inputCrank);
  assert.equal(contacts.crankPinP.members[0], blocks.inputCrank);
  assert.equal(contacts.crankPinP.members[1], blocks.pistonAssembly);
  assert.equal(contacts.cylinderTrunnionT.fixedMember, blocks.fixedFrame);
  assert.equal(contacts.cylinderTrunnionT.movingMember,
    blocks.cylinderAssembly);
  assert.equal(contacts.pistonInCylinder.members[0], blocks.pistonAssembly);
  assert.equal(contacts.pistonInCylinder.members[1],
    blocks.cylinderAssembly);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'two-point-two-five-unit-direct-acting-crank-O-P').length, 1);
  assert.equal(roles.filter((role) => role ===
    'mid-trunnion-closed-oscillating-cylinder').length, 1);
  assert.equal(roles.filter((role) => role ===
    'fixed-length-piston-rod-and-head-rooted-at-crank-pin-P').length, 1);
  assert.equal(roles.filter((role) => role ===
    'enclosed-piston-head').length, 1);
  assert.equal(roles.some((role) => /index|transparent|open-/i.test(role)), false,
    'Brown draws a closed cylinder without index marks');
  assert.equal(roles.some((role) => /crosshead|slider-guide/i.test(role)),
    false, 'the source explicitly has no guide');
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 344 preserves every official animation constant, phase, and view', () => {
  const model = createMovementModel(catalog.movements[343]);
  const {
    geometry,
    modelPointToOfficialAnimationRaster,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const official = sourceAnimation.officialGeometry;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.durationSeconds, 4);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_344.html');
  assert.deepEqual(sourceAnimation.officialFunctionChain, [
    'add_stat',
    'add_rot',
    'add_rot_to',
    'add_rot_to',
    'add_text',
  ]);
  assert.equal(sourceAnimation.physicalCorrection.applied, false);
  assert.match(sourceAnimation.physicalCorrection.reason,
    /share the exact T-P axis/);

  assert.deepEqual(official.crankCenter, new THREE.Vector2(0, 0));
  assert.equal(official.crankRadius, 2.25);
  assert.equal(official.crankPhaseOffsetTurns, 0.625);
  assert.deepEqual(official.cylinderPivot,
    new THREE.Vector2(0, -6.75));
  assert.equal(official.pistonRodLength, 6.75);
  assert.equal(official.pistonHeadHalfWidth, 1.3125);
  assert.equal(official.pistonHeadThickness, 0.375);
  assert.equal(official.pistonRodHalfWidth, 0.15625);
  assert.equal(official.pistonRodCrankClearance, 0.340897);
  assert.equal(official.cylinderOuterHalfWidth, 1.75);
  assert.equal(official.cylinderWallOuterX, 1.5);
  assert.equal(official.cylinderWallInnerX, 1.3125);
  assert.equal(official.cylinderBoreEnd, 2.5);
  assert.equal(official.cylinderShellEnd, 2.875);
  assert.deepEqual(official.cylinderDirectionRay,
    new THREE.Vector2(0, 2.5));
  assert.deepEqual(official.pistonDirectionRay,
    new THREE.Vector2(0, -6.9375));

  near(geometry.crankRadius, 2.25 * geometry.sourceScale, 0,
    'scaled crank radius');
  near(geometry.pistonRodLength, 6.75 * geometry.sourceScale, 0,
    'scaled piston rod');
  vector2Near(geometry.cylinderPivot,
    official.cylinderPivot.clone().multiplyScalar(geometry.sourceScale),
    0, 'scaled cylinder pivot');
  near(geometry.cylinderBoreEnd, 2.5 * geometry.sourceScale, 0,
    'scaled bore end');
  near(geometry.cyclePeriod, 4, 0, 'official cycle period');
  near(geometry.inputAngularSpeed, Math.PI / 2, 0,
    'official crank angular speed');

  assert.equal(sourceReference.brownPlate344.imageWidth, 525);
  assert.equal(sourceReference.brownPlate344.imageHeight, 525);
  assert.match(sourceReference.brownPlate344.inferredTopology,
    /midpoint trunnions/);
  assert.equal(sourceReference.officialAnimationView.viewWidth, 13);
  assert.equal(sourceReference.officialAnimationView.viewHeight, 13);
  assert.deepEqual(sourceReference.officialAnimationView.minimum,
    new THREE.Vector2(-6.5, -10.3125));
  vector2Near(
    modelPointToOfficialAnimationRaster(
      new THREE.Vector2(-6.5, -10.3125)
        .multiplyScalar(geometry.sourceScale),
    ),
    new THREE.Vector2(0, 525),
    5e-14,
    'official lower-left raster transform',
  );
  vector2Near(
    modelPointToOfficialAnimationRaster(
      new THREE.Vector2(6.5, 2.6875)
        .multiplyScalar(geometry.sourceScale),
    ),
    new THREE.Vector2(525, 0),
    5e-14,
    'official upper-right raster transform',
  );
  disposeModel(model.root);
});

test('movement 344 exactly reconstructs both official add_rot_to transforms', () => {
  const model = createMovementModel(catalog.movements[343]);
  const {
    sourceStateAtCyclePosition,
    sourceStateAtTime,
  } = model.root.userData;
  const crankCenter = new THREE.Vector2(0, 0);
  const trunnion = new THREE.Vector2(0, -6.75);

  for (let sample = 0; sample <= 8192; sample += 1) {
    const cyclePosition = sample / 8192;
    const state = sourceStateAtCyclePosition(cyclePosition);
    near(state.pointP.distanceTo(crankCenter), 2.25, 9e-16,
      `official crank radius ${sample}`);
    near(state.cylinderAxis.length(), 1, 5e-16,
      `official unit cylinder axis ${sample}`);
    const geometricAxis = state.pointP.clone().sub(trunnion).normalize();
    vector2Near(state.cylinderAxis, geometricAxis, 0,
      `official T-to-P axis ${sample}`);
    const rotatedCylinderRay = new THREE.Vector2(
      -Math.sin(state.cylinderAngle),
      Math.cos(state.cylinderAngle),
    );
    vector2Near(rotatedCylinderRay, state.cylinderAxis, 4e-16,
      `official cylinder add_rot_to ${sample}`);
    const rotatedPistonRay = rotatedCylinderRay.clone().negate();
    vector2Near(rotatedPistonRay,
      trunnion.clone().sub(state.pointP).normalize(), 4e-16,
      `official piston add_rot_to ${sample}`);
    near(state.pointP.distanceTo(state.pistonHead), 6.75, 4e-15,
      `official fixed piston rod ${sample}`);
    near(cross2(
      state.pistonHead.clone().sub(trunnion),
      state.cylinderAxis,
    ), 0, 2e-15, `official coaxial piston ${sample}`);
    near(state.pistonTravel,
      state.crankToTrunnionDistance - 6.75, 0,
      `official piston coordinate ${sample}`);
  }

  const expectedPins = [
    [-Math.SQRT1_2 * 2.25, -Math.SQRT1_2 * 2.25],
    [Math.SQRT1_2 * 2.25, -Math.SQRT1_2 * 2.25],
    [Math.SQRT1_2 * 2.25, Math.SQRT1_2 * 2.25],
    [-Math.SQRT1_2 * 2.25, Math.SQRT1_2 * 2.25],
  ];
  [0, 1, 2, 3].forEach((time, index) => {
    const state = sourceStateAtTime(time);
    vector2Near(state.pointP, new THREE.Vector2(...expectedPins[index]),
      2.5e-15, `official quarter-cycle pin ${index}`);
    near(state.phase, index / 4, 0,
      `official quarter-cycle phase ${index}`);
  });
  disposeModel(model.root);
});

test('movement 344 maintains one fixed piston rod on the instantaneous cylinder axis', () => {
  const model = createMovementModel(catalog.movements[343]);
  const { geometry, stateAtInputTravel } = model.root.userData;
  let maximumRodError = 0;
  let maximumLateralError = 0;
  let minimumDistance = Infinity;
  let maximumDistance = -Infinity;
  let minimumTravel = Infinity;
  let maximumTravel = -Infinity;
  let minimumClearance = Infinity;

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtInputTravel(FULL_TURN * sample / 16384);
    const headFromTrunnion = state.piston.head.clone()
      .sub(geometry.cylinderPivot);
    const along = headFromTrunnion.dot(state.cylinder.axis);
    const lateral = cross2(headFromTrunnion, state.cylinder.axis);
    const upperClearance = geometry.cylinderBoreEnd
      - (state.piston.travel + geometry.pistonHeadThickness / 2);
    const lowerClearance = geometry.cylinderBoreEnd
      + (state.piston.travel - geometry.pistonHeadThickness / 2);
    near(state.pointP.distanceTo(geometry.crankCenter),
      geometry.crankRadius, 9e-16, `physical crank radius ${sample}`);
    near(state.pointP.distanceTo(state.piston.head),
      geometry.pistonRodLength, 2e-15,
      `physical piston rod length ${sample}`);
    near(along, state.piston.travel, 1.8e-15,
      `physical signed piston coordinate ${sample}`);
    maximumRodError = Math.max(maximumRodError,
      Math.abs(state.piston.rodLengthError));
    maximumLateralError = Math.max(maximumLateralError,
      Math.abs(lateral));
    minimumDistance = Math.min(minimumDistance,
      state.crankToTrunnionDistance);
    maximumDistance = Math.max(maximumDistance,
      state.crankToTrunnionDistance);
    minimumTravel = Math.min(minimumTravel, state.piston.travel);
    maximumTravel = Math.max(maximumTravel, state.piston.travel);
    minimumClearance = Math.min(minimumClearance,
      upperClearance, lowerClearance);
  }

  assert.ok(maximumRodError <= 1.8e-15,
    `fixed piston rod closes; worst error ${maximumRodError}`);
  assert.ok(maximumLateralError <= 9e-16,
    `piston stays coaxial; worst error ${maximumLateralError}`);
  near(minimumDistance / geometry.sourceScale, 4.5, 2e-15,
    'minimum trunnion-to-crank distance');
  near(maximumDistance / geometry.sourceScale, 9, 3e-15,
    'maximum trunnion-to-crank distance');
  near(minimumTravel / geometry.sourceScale, -2.25, 2e-15,
    'minimum piston travel');
  near(maximumTravel / geometry.sourceScale, 2.25, 3e-15,
    'maximum piston travel');
  near(minimumClearance / geometry.sourceScale, 0.0625, 8e-16,
    'minimum piston-to-bore-end clearance');
  near(geometry.maximumRodLengthError, maximumRodError, 0,
    'published rod closure error');
  disposeModel(model.root);
});

test('movement 344 has the exact 4.5-unit stroke and tangent-limited cylinder swing', () => {
  const model = createMovementModel(catalog.movements[343]);
  const {
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const scale = geometry.sourceScale;
  const nearest = stateAtTime(canonicalTimes.nearestDeadCenter);
  const farthest = stateAtTime(canonicalTimes.farthestDeadCenter);

  near(nearest.crankToTrunnionDistance / scale, 4.5, 2e-15,
    'nearest dead-center distance');
  near(farthest.crankToTrunnionDistance / scale, 9, 3e-15,
    'farthest dead-center distance');
  near(nearest.piston.travel / scale, -2.25, 2e-15,
    'nearest piston coordinate');
  near(farthest.piston.travel / scale, 2.25, 3e-15,
    'farthest piston coordinate');
  near(nearest.cylinder.angle, 0, 3e-16,
    'nearest cylinder verticality');
  near(farthest.cylinder.angle, 0, 0,
    'farthest cylinder verticality');
  vector2Near(nearest.piston.head.clone().multiplyScalar(1 / scale),
    new THREE.Vector2(0, -9), 5e-16,
    'nearest piston-head center');
  vector2Near(farthest.piston.head.clone().multiplyScalar(1 / scale),
    new THREE.Vector2(0, -4.5), 2e-15,
    'farthest piston-head center');
  near(geometry.pistonStroke / scale, 4.5, 3e-15,
    'full piston stroke');
  near(geometry.maximumCylinderAngle, Math.asin(1 / 3), 7e-10,
    'maximum clockwise cylinder angle');
  near(geometry.minimumCylinderAngle, -Math.asin(1 / 3), 7e-10,
    'maximum counterclockwise cylinder angle');
  near(geometry.minimumEndClearance / scale, 0.0625, 8e-16,
    'dead-center end clearance');
  near(nearest.piston.velocity, 0, 7e-16,
    'nearest radial reversal speed');
  near(farthest.piston.velocity, 0, 8e-16,
    'farthest radial reversal speed');
  disposeModel(model.root);
});

test('movement 344 analytic crank, cylinder, and piston rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[343]);
  const { geometry, stateAtTime } = model.root.userData;
  const timeStep = 2e-4;

  for (const phase of [0.03, 0.13, 0.26, 0.39, 0.52, 0.67, 0.81, 0.96]) {
    const time = geometry.cyclePeriod * phase;
    const before = stateAtTime(time - timeStep);
    const state = stateAtTime(time);
    const after = stateAtTime(time + timeStep);
    const numericalPinVelocity = after.pointP.clone().sub(before.pointP)
      .multiplyScalar(1 / (2 * timeStep));
    const numericalPinAcceleration = after.pointP.clone()
      .add(before.pointP).addScaledVector(state.pointP, -2)
      .multiplyScalar(1 / timeStep ** 2);
    const numericalHeadVelocity = after.piston.head.clone()
      .sub(before.piston.head).multiplyScalar(1 / (2 * timeStep));
    const numericalHeadAcceleration = after.piston.head.clone()
      .add(before.piston.head).addScaledVector(state.piston.head, -2)
      .multiplyScalar(1 / timeStep ** 2);
    const numericalPistonVelocity = (
      after.piston.travel - before.piston.travel
    ) / (2 * timeStep);
    const numericalPistonAcceleration = (
      after.piston.travel + before.piston.travel
        - 2 * state.piston.travel
    ) / timeStep ** 2;
    const numericalCylinderVelocity = angleDifference(
      after.cylinder.angle,
      before.cylinder.angle,
    ) / (2 * timeStep);
    const numericalCylinderAcceleration = (
      angleDifference(after.cylinder.angle, state.cylinder.angle)
        - angleDifference(state.cylinder.angle, before.cylinder.angle)
    ) / timeStep ** 2;
    const numericalAxisVelocity = after.cylinder.axis.clone()
      .sub(before.cylinder.axis).multiplyScalar(1 / (2 * timeStep));
    const numericalAxisAcceleration = after.cylinder.axis.clone()
      .add(before.cylinder.axis).addScaledVector(state.cylinder.axis, -2)
      .multiplyScalar(1 / timeStep ** 2);

    vector2Near(state.pointPVelocity, numericalPinVelocity, 1.5e-7,
      `crank-pin velocity at phase ${phase}`);
    vector2Near(state.pointPAcceleration, numericalPinAcceleration, 3e-7,
      `crank-pin acceleration at phase ${phase}`);
    vector2Near(state.piston.headVelocity, numericalHeadVelocity, 1.5e-7,
      `piston-head velocity at phase ${phase}`);
    vector2Near(state.piston.headAcceleration, numericalHeadAcceleration,
      3e-7, `piston-head acceleration at phase ${phase}`);
    near(state.piston.velocity, numericalPistonVelocity, 7e-8,
      `piston slide velocity at phase ${phase}`);
    near(state.piston.acceleration, numericalPistonAcceleration, 1.5e-7,
      `piston slide acceleration at phase ${phase}`);
    near(state.cylinder.angularVelocity, numericalCylinderVelocity, 5e-8,
      `cylinder angular velocity at phase ${phase}`);
    near(state.cylinder.angularAcceleration,
      numericalCylinderAcceleration, 6e-8,
      `cylinder angular acceleration at phase ${phase}`);
    vector2Near(state.cylinder.axisVelocity, numericalAxisVelocity, 5e-8,
      `cylinder-axis velocity at phase ${phase}`);
    vector2Near(state.cylinder.axisAcceleration,
      numericalAxisAcceleration, 8e-8,
      `cylinder-axis acceleration at phase ${phase}`);
    near(state.piston.rodAngularVelocity,
      state.cylinder.angularVelocity, 0,
      `shared rod/cylinder speed at phase ${phase}`);
    near(state.piston.rodAngularAcceleration,
      state.cylinder.angularAcceleration, 0,
      `shared rod/cylinder acceleration at phase ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 344 renderer binds the crank, shared axis, trunnion, and sliding piston', () => {
  const model = createMovementModel(catalog.movements[343]);
  const {
    blocks,
    contacts,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const fixedCrankBearing = worldPosition(blocks.crankBearing);
  const fixedTrunnionBearing = worldPosition(blocks.trunnionBearingBack);

  for (const time of [0, 0.37, 0.91, 1.46, 2.13, 2.79, 3.52, 4]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    near(angleDifference(blocks.inputCrank.rotation.z, state.inputAngle),
      0, 0, `rendered crank angle ${time}`);
    near(angleDifference(blocks.cylinderAssembly.rotation.z,
      state.cylinder.angle), 0, 0,
    `rendered cylinder angle ${time}`);
    near(angleDifference(blocks.pistonAssembly.rotation.z,
      state.cylinder.angle), 0, 0,
    `rendered piston-rod angle ${time}`);
    near(angleDifference(blocks.pistonAssembly.rotation.z,
      blocks.cylinderAssembly.rotation.z), 0, 0,
    `shared rendered axis ${time}`);
    worldXYNear(blocks.crankPinAnchor, state.pointP, 8e-16,
      `crank arm endpoint P ${time}`);
    worldXYNear(blocks.pistonCrankAnchor, state.pointP, 8e-16,
      `piston rod endpoint P ${time}`);
    worldXYNear(blocks.pistonHeadAnchor, state.piston.head, 2e-15,
      `piston head H ${time}`);
    worldXYNear(blocks.cylinderPivotAnchor, geometry.cylinderPivot, 0,
      `cylinder pivot T ${time}`);
    worldXYNear(
      blocks.cylinderTopAxisAnchor,
      geometry.cylinderPivot.clone().addScaledVector(
        state.cylinder.axis,
        geometry.cylinderBoreEnd,
      ),
      1e-15,
      `cylinder axis witness ${time}`,
    );
    worldXYNear(blocks.crankPin, state.pointP, 8e-16,
      `visible common crank pin ${time}`);
    vector2Near(new THREE.Vector2(
      contacts.crankPinP.point.x,
      contacts.crankPinP.point.y,
    ), state.pointP, 0, `reported crank contact ${time}`);
    vector2Near(new THREE.Vector2(
      contacts.pistonInCylinder.point.x,
      contacts.pistonInCylinder.point.y,
    ), state.piston.head, 0, `reported piston contact ${time}`);
    vector2Near(new THREE.Vector2(
      contacts.pistonInCylinder.axis.x,
      contacts.pistonInCylinder.axis.y,
    ), state.cylinder.axis, 0, `reported cylinder axis ${time}`);
    near(contacts.pistonInCylinder.signedTravel,
      state.piston.travel, 0, `reported piston travel ${time}`);
    near(blocks.pistonAssembly.userData.relativeVelocity,
      state.piston.velocity, 0, `rendered piston speed ${time}`);
    near(blocks.cylinderAssembly.userData.angularSpeed,
      state.cylinder.angularVelocity, 0,
      `rendered cylinder speed ${time}`);
    vector3Near(worldPosition(blocks.crankBearing), fixedCrankBearing, 0,
      `fixed crank bearing ${time}`);
    vector3Near(worldPosition(blocks.trunnionBearingBack),
      fixedTrunnionBearing, 0, `fixed trunnion bearing ${time}`);
  }

  let meshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  assert.ok(meshCount >= 14);
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 3.8, 'broken-off rails as short as Brown draws them');
  assert.ok(size.y > 6.7);
  assert.ok(size.z >= 2.6,
    'fixed bearings, cylinder, piston, crank, and pins occupy real layers');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 2);
  disposeModel(model.root);
});

test('movement 344 closes one exact revolution and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[343]);
  const {
    blocks,
    canonicalTimes,
    sourceStateAtTime,
    stateAtTime,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);
  const sourceStart = sourceStateAtTime(0);
  const sourceClosure = sourceStateAtTime(canonicalTimes.cycleClosure);

  near(closure.phase, start.phase, 0, 'phase closure');
  near(closure.unwrappedInputAngle - start.unwrappedInputAngle,
    FULL_TURN, 1e-15, 'one unwrapped crank revolution');
  near(angleDifference(closure.inputAngle, start.inputAngle),
    0, 1e-15, 'crank closure');
  near(angleDifference(closure.cylinder.angle, start.cylinder.angle),
    0, 4e-16, 'cylinder closure');
  vector2Near(closure.pointP, start.pointP, 1.5e-15,
    'crank pin closure');
  vector2Near(closure.piston.head, start.piston.head, 2e-15,
    'piston-head closure');
  near(closure.piston.travel, start.piston.travel, 1.1e-15,
    'piston travel closure');
  vector2Near(sourceClosure.pointP, sourceStart.pointP, 3e-15,
    'official crank pin closure');
  vector2Near(sourceClosure.pistonHead, sourceStart.pistonHead, 3e-15,
    'official piston-head closure');
  model.update(canonicalTimes.cycleClosure);
  model.root.updateMatrixWorld(true);
  worldXYNear(blocks.pistonHeadAnchor, start.piston.head, 2e-15,
    'rendered piston closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});

test('movement 344 draws the crank plate over the rod eye with a double-webbed crank', () => {
  const model = createMovementModel(catalog.movements[343]);
  const { blocks } = model.root.userData;
  model.update(0);
  model.root.updateMatrixWorld(true);
  const box = (object) => new THREE.Box3().setFromObject(object);
  const front = box(blocks.crankFrontWeb), rear = box(blocks.crankArm);
  const eye = box(blocks.pistonCrankEye), shaft = box(blocks.crankShaft);
  // Brown's crank plate lies over the rod end; the shaft ends in the rear
  // web, so the rod can cross the shaft axis at dead centre.
  assert.ok(front.min.z > eye.max.z, 'front web in front of the rod eye');
  assert.ok(rear.max.z < eye.min.z, 'rear web behind the rod eye');
  assert.ok(shaft.max.z < eye.min.z, 'live shaft stops behind the rod plane');
  assert.equal(blocks.crankFrontWeb.parent, blocks.crankArm.parent);
  disposeModel(model.root);
});
