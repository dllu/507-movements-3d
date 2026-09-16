import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const FULL_TURN = Math.PI * 2;

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

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vector2Near(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function signedAngleDifference(left, right) {
  return Math.atan2(Math.sin(left - right), Math.cos(left - right));
}

function segmentIntersection(firstStart, firstEnd, secondStart, secondEnd) {
  const first = firstEnd.clone().sub(firstStart);
  const second = secondEnd.clone().sub(secondStart);
  const denominator = first.cross(second);
  if (Math.abs(denominator) < 1e-11) return false;
  const between = secondStart.clone().sub(firstStart);
  const firstParameter = between.cross(second) / denominator;
  const secondParameter = between.cross(first) / denominator;
  return firstParameter > 1e-7
    && firstParameter < 1 - 1e-7
    && secondParameter > 1e-7
    && secondParameter < 1 - 1e-7;
}

function assertSimpleClosedPolyline(points, label) {
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 2; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length;
      if (first === 0 && secondNext === 0) continue;
      assert.equal(
        segmentIntersection(
          points[first],
          points[firstNext],
          points[second],
          points[secondNext],
        ),
        false,
        `${label} segments ${first} and ${second} intersect`,
      );
    }
  }
}

function pointToSegmentDistance(point, start, end) {
  const segment = end.clone().sub(start);
  const parameter = THREE.MathUtils.clamp(
    point.clone().sub(start).dot(segment) / segment.lengthSq(),
    0,
    1,
  );
  return point.distanceTo(
    start.clone().addScaledVector(segment, parameter),
  );
}

function nearestPolylineDistance(point, points) {
  let minimum = Infinity;
  for (let index = 0; index < points.length; index += 1) {
    minimum = Math.min(
      minimum,
      pointToSegmentDistance(
        point,
        points[index],
        points[(index + 1) % points.length],
      ),
    );
  }
  return minimum;
}

test('movement 217 reconstructs Brown plates 217 and 218 as one mechanism', () => {
  const movement = catalog.movements[216];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    geometry,
    mechanism,
    notchCountRationale,
    sourceAnimation,
  } = model.root.userData;

  assert.equal(movement.id, 217);
  assert.equal(movement.number, '217');
  assert.equal(
    movement.title,
    'Grooved Heart-Cam Wool-Comber Roller Motion',
  );
  assert.equal(movement.category, 'Cams & followers');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'grooved-heart-cam-rocker-lifted-catch-nine-notch-detaching-roller',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /heart cam C-D-e.*catch G.*wheel F.*shaft H/);
  assert.match(notchCountRationale, /one-third-turn.*three-notch pitch/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.sourceUrl, movement.sourceUrl);
  assert.equal(sourceAnimation.durationSeconds, 8);

  assert.equal(geometry.notchCount, 9);
  assert.equal(blocks.camFloor.parent, blocks.camRotor);
  assert.equal(blocks.outerLand.parent, blocks.camRotor);
  assert.equal(blocks.innerIsland.parent, blocks.camRotor);
  assert.equal(blocks.tripLug.parent, blocks.camRotor);
  assert.equal(blocks.notchWheel.parent, blocks.outputRotor);
  assert.equal(blocks.outputShaft.parent, blocks.outputRotor);
  assert.equal(blocks.rockerBody.parent, blocks.rocker);
  assert.equal(blocks.followerRoller.parent, blocks.rocker);
  assert.equal(blocks.tripRoller.parent, blocks.catchLink);
  assert.equal(blocks.catchHook.parent, blocks.catchLink);
  assert.notEqual(blocks.camRotor, blocks.outputRotor);
  assert.notEqual(blocks.outputRotor, blocks.rocker);
  assert.notEqual(blocks.rocker, blocks.catchLink);
  assert.equal(
    blocks.outerLand.geometry.parameters.shapes.holes.length,
    1,
  );
  assert.equal(
    blocks.notchWheel.geometry.parameters.shapes.holes.length,
    1,
  );

  const roles = [];
  let meshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.ok(meshCount >= 27);
  assert.ok(roles.includes('A-stud-running-inside-real-groove'));
  assert.ok(roles.includes('hinged-catch-G'));
  assert.ok(roles.includes('F-solid-nine-notch-wheel'));
  assert.ok(roles.includes('rear-projection-lifting-catch-at-e'));
  assert.equal(roles.some((role) => /belt/i.test(role)), false);
  assert.equal(roles.some((role) => /gear-tooth/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 217 uses a source-shaped conjugate groove with a physical cutter envelope', () => {
  const model = createMovementModel(catalog.movements[216]);
  const {
    geometry,
    sourceReference,
  } = model.root.userData;
  const {
    backwardEndPhase,
    forwardEndPhase,
  } = model.root.userData.motion;

  assert.equal(
    sourceReference.companionPlateUrl,
    'https://507movements.com/mm_218.html',
  );
  assert.deepEqual(
    sourceReference.plate217.rasterCamCenter.toArray(),
    [265, 268],
  );
  assert.deepEqual(sourceReference.plate217.rasterC.toArray(), [180, 314]);
  assert.deepEqual(sourceReference.plate217.rasterD.toArray(), [266, 336]);
  assert.deepEqual(sourceReference.plate217.rasterE.toArray(), [267, 43]);
  assert.deepEqual(
    sourceReference.plate218.rasterOutputCenterH.toArray(),
    [264, 264],
  );
  assert.deepEqual(
    sourceReference.plate218.rasterFollowerA.toArray(),
    [241, 492],
  );
  assert.match(sourceReference.historicalCrossCheck, /hinged finger/);

  const pointC = model.root.userData.groovePointAtPhase(0);
  const pointD = model.root.userData.groovePointAtPhase(backwardEndPhase);
  const pointE = model.root.userData.groovePointAtPhase(forwardEndPhase);
  near(pointE.x, 0, 1e-14, 'engraved e is centered at the top');
  assert.ok(pointE.y > 4.5);
  assert.ok(pointC.x < -3.9 && pointC.y < -2.1);
  assert.ok(Math.abs(pointD.x) < 0.01 && pointD.y < -1.29);
  const sourceCVector = new THREE.Vector2(-85, -46).normalize();
  const sourceDVector = new THREE.Vector2(1, -68).normalize();
  near(
    pointC.clone().normalize().angleTo(sourceCVector),
    0,
    0.002,
    'C direction matches plate 217',
  );
  near(
    pointD.clone().normalize().angleTo(sourceDVector),
    0,
    0.02,
    'D direction matches plate 217',
  );

  assert.equal(geometry.grooveCenterline.length, 720);
  assert.ok(geometry.cutterEnvelopeDiscardedPointCount > 45);
  assert.ok(geometry.cutterEnvelopeDiscardedPointCount < 70);
  assert.ok(geometry.cutterEnvelopeIntersection);
  assert.ok(geometry.outerWall.length < geometry.idealOuterWall.length);
  assertSimpleClosedPolyline(geometry.grooveCenterline, 'groove centerline');
  assertSimpleClosedPolyline(geometry.innerWall, 'inner groove wall');
  assertSimpleClosedPolyline(geometry.outerWall, 'trimmed outer groove wall');

  let minimumWallDistance = Infinity;
  for (const point of geometry.grooveCenterline) {
    minimumWallDistance = Math.min(
      minimumWallDistance,
      nearestPolylineDistance(point, geometry.innerWall),
      nearestPolylineDistance(point, geometry.outerWall),
    );
  }
  assert.ok(minimumWallDistance > 0.154);
  assert.ok(minimumWallDistance - geometry.followerRollerRadius > 0.034);
  near(
    geometry.grooveRadialClearance,
    geometry.grooveHalfWidth - geometry.followerRollerRadius,
    0,
    'declared follower clearance',
  );

  for (let index = 0; index <= 4096; index += 1) {
    const phase = index / 4096;
    const inputTravel = phase * FULL_TURN;
    const state = model.root.userData.stateAtInputTravel(inputTravel);
    vector2Near(
      state.followerWorld,
      state.grooveWorld,
      6e-15,
      `conjugate groove sample ${index}`,
    );
    assert.ok(Math.abs(state.grooveNormalVelocityError) < 6e-15);
  }
  disposeModel(model.root);
});

test('movement 217 gives minus one-third, plus two-thirds, then a true dwell', () => {
  const model = createMovementModel(catalog.movements[216]);
  const {
    backwardAngle,
    backwardEndPhase,
    forwardAngleFromD,
    forwardEndPhase,
    inputTravelAngularSpeed,
    netOutputAdvance,
  } = model.root.userData.motion;
  const stateAtInputTravel = model.root.userData.stateAtInputTravel;

  near(backwardAngle, -FULL_TURN / 3, 0, 'one-third turn backward');
  near(forwardAngleFromD, 2 * FULL_TURN / 3, 0,
    'two-thirds turn forward');
  near(netOutputAdvance, FULL_TURN / 3, 0, 'net one-third advance');
  near(
    netOutputAdvance / model.root.userData.geometry.notchPitchAngle,
    3,
    5e-16,
    'one cycle advances exactly three of nine notches',
  );

  const atC = stateAtInputTravel(0);
  const atD = stateAtInputTravel(backwardEndPhase * FULL_TURN);
  const atE = stateAtInputTravel(forwardEndPhase * FULL_TURN);
  const inDwell = stateAtInputTravel((forwardEndPhase + 0.21) * FULL_TURN);
  const nextC = stateAtInputTravel(FULL_TURN);
  const nextD = stateAtInputTravel(
    (1 + backwardEndPhase) * FULL_TURN,
  );
  const thirdC = stateAtInputTravel(3 * FULL_TURN);
  near(atC.outputAngle, 0, 0, 'C output angle');
  near(atD.outputAngle, -FULL_TURN / 3, 5e-16, 'D output angle');
  near(atE.outputAngle, FULL_TURN / 3, 5e-16, 'e output angle');
  near(inDwell.outputAngle, FULL_TURN / 3, 5e-16, 'dwell output angle');
  near(nextC.outputAngle, FULL_TURN / 3, 5e-16, 'next C output angle');
  near(
    nextD.outputAngle - atD.outputAngle,
    FULL_TURN / 3,
    5e-16,
    'successive D poses advance by one third turn',
  );
  near(thirdC.outputAngle, FULL_TURN, 2e-15, 'three-cycle closure');
  assert.equal(atC.catchEngaged, true);
  assert.equal(atD.catchEngaged, true);
  assert.equal(atE.catchEngaged, true);
  assert.equal(inDwell.catchEngaged, false);
  near(inDwell.outputAngularSpeed, 0, 0, 'true output dwell speed');
  near(inDwell.outputAngularAcceleration, 0, 0,
    'true output dwell acceleration');

  let maximumConstraintError = 0;
  let maximumNormalVelocityError = 0;
  for (let index = 0; index <= 32768; index += 1) {
    const state = stateAtInputTravel(index / 32768 * FULL_TURN);
    maximumConstraintError = Math.max(
      maximumConstraintError,
      state.grooveConstraintError,
    );
    maximumNormalVelocityError = Math.max(
      maximumNormalVelocityError,
      Math.abs(state.grooveNormalVelocityError),
    );
    if (state.catchEngaged) {
      assert.ok(Math.abs(state.nearestNotchAngularDifference) < 3e-15);
      near(state.outputAngularSpeed, state.rockerAngularSpeed, 0,
        `engaged speed sample ${index}`);
    } else {
      near(state.outputAngularSpeed, 0, 0, `dwell speed sample ${index}`);
    }
  }
  assert.ok(maximumConstraintError < 6e-15);
  assert.ok(maximumNormalVelocityError < 6e-15);

  const finiteDifferenceStep = 1e-5;
  for (const phase of [0.04, 0.22, 0.41, 0.63, 0.79, 0.96]) {
    const inputTravel = phase * FULL_TURN;
    const state = stateAtInputTravel(inputTravel);
    const previous = stateAtInputTravel(
      inputTravel - inputTravelAngularSpeed * finiteDifferenceStep,
    );
    const next = stateAtInputTravel(
      inputTravel + inputTravelAngularSpeed * finiteDifferenceStep,
    );
    near(
      (next.rockerAngle - previous.rockerAngle)
        / (2 * finiteDifferenceStep),
      state.rockerAngularSpeed,
      3e-8,
      `rocker analytic speed at phase ${phase}`,
    );
    near(
      (next.outputAngle - previous.outputAngle)
        / (2 * finiteDifferenceStep),
      state.outputAngularSpeed,
      3e-8,
      `output analytic speed at phase ${phase}`,
    );
    near(
      (next.rockerAngularSpeed - previous.rockerAngularSpeed)
        / (2 * finiteDifferenceStep),
      state.rockerAngularAcceleration,
      2e-6,
      `rocker analytic acceleration at phase ${phase}`,
    );
  }
  disposeModel(model.root);
});

test('movement 217 catch clears the rim and its rear projection contacts only at e', () => {
  const model = createMovementModel(catalog.movements[216]);
  const {
    geometry,
    motion,
  } = model.root.userData;
  const stateAtInputTravel = model.root.userData.stateAtInputTravel;
  const stateAtE = stateAtInputTravel(motion.forwardEndPhase * FULL_TURN);

  near(stateAtE.tripClearance, 0, 2e-15, 'trip projection contact at e');
  assert.equal(stateAtE.tripContact, true);
  near(stateAtE.catchLiftFraction, 0, 1e-14,
    'catch begins lifting at e');
  assert.equal(stateAtE.hookWithinNotchOpening, true);

  let minimumCatchClearance = Infinity;
  let minimumPlainRimClearance = Infinity;
  let minimumTripClearance = Infinity;
  let tripContactSamples = 0;
  for (let index = 0; index <= 32768; index += 1) {
    const state = stateAtInputTravel(index / 32768 * FULL_TURN);
    minimumCatchClearance = Math.min(
      minimumCatchClearance,
      state.catchSolidClearance,
    );
    minimumTripClearance = Math.min(
      minimumTripClearance,
      state.tripClearance,
    );
    if (!state.hookWithinNotchOpening) {
      minimumPlainRimClearance = Math.min(
        minimumPlainRimClearance,
        state.catchSolidClearance,
      );
    }
    if (state.tripContact) tripContactSamples += 1;
  }
  assert.ok(minimumCatchClearance > geometry.notchReliefClearance - 0.00011);
  assert.ok(minimumPlainRimClearance > 0.028);
  assert.ok(minimumTripClearance > -1e-12);
  assert.ok(tripContactSamples <= 1);

  const beforeTrip = stateAtInputTravel(
    (motion.forwardEndPhase - 0.02) * FULL_TURN,
  );
  const afterTrip = stateAtInputTravel(
    (motion.forwardEndPhase + 0.02) * FULL_TURN,
  );
  assert.ok(beforeTrip.tripClearance > 0.06);
  assert.ok(afterTrip.tripClearance > 0.06);
  assert.equal(afterTrip.catchEngaged, false);
  assert.ok(afterTrip.catchLiftFraction > 0);

  const clearances = model.root.userData.solidClearanceAtInputTravel(
    0.77 * FULL_TURN,
  );
  near(
    clearances.followerToEachGrooveWallClearance,
    geometry.grooveHalfWidth - geometry.followerRollerRadius,
    0,
    'follower-to-wall radial clearance',
  );
  assert.ok(clearances.rockerToWheelAxialClearance > 0.039);
  assert.ok(
    geometry.wheelCenterZ - geometry.wheelDepth / 2
      - geometry.camLandDepth > 0.44,
  );
  disposeModel(model.root);
});

test('movement 217 runtime matches D, shares 218, and leaves 269 authored', () => {
  const model = createMovementModel(catalog.movements[216]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    motion,
  } = model.root.userData;

  model.update(canonicalTimes.sourcePoseD);
  const sourceState = model.root.userData.kinematics;
  near(sourceState.phase, motion.backwardEndPhase, 3e-17,
    'source pose is D');
  near(sourceState.rockerAngle, -FULL_TURN / 3, 5e-16,
    'D rocker angle');
  const followerFromH = sourceState.followerWorld.clone().sub(
    geometry.outputCenter,
  );
  const catchPivotFromH = sourceState.catchPivotWorld.clone().sub(
    geometry.outputCenter,
  );
  const catchTripBossFromH = sourceState.catchTripBossWorld.clone().sub(
    geometry.outputCenter,
  );
  assert.ok(Math.abs(followerFromH.x) < 2e-15);
  near(followerFromH.y, -geometry.followerArmRadius, 5e-16,
    'A hangs below H in plate 218');
  near(catchPivotFromH.length(), geometry.catchPivotRadius, 5e-16,
    'G pivot radius about H');
  assert.ok(catchPivotFromH.clone().normalize().angleTo(
    new THREE.Vector2(86, 201).normalize(),
  ) < 0.004);
  near(catchTripBossFromH.x, 0, 2e-15,
    'G trip boss is centered over H');
  near(catchTripBossFromH.y, geometry.catchTripBossRadiusFromOutput, 5e-16,
    'G trip boss is above H');
  assert.ok(sourceState.catchHookWorld.x < geometry.outputCenter.x);
  assert.ok(sourceState.catchHookWorld.y > geometry.outputCenter.y);
  assert.equal(blocks.catchContactMarker.visible, true);
  assert.equal(blocks.tripContactMarker.visible, false);
  assert.ok(model.root.userData.contacts.catchToNotch);
  assert.ok(model.root.userData.contacts.followerToGroove);

  model.update(canonicalTimes.eCatchRelease);
  assert.equal(blocks.tripContactMarker.visible, true);
  assert.ok(model.root.userData.contacts.tripAtE);
  model.update(canonicalTimes.midDwellReturn);
  assert.equal(blocks.catchContactMarker.visible, false);
  assert.equal(blocks.tripContactMarker.visible, false);
  assert.equal(model.root.userData.contacts.catchToNotch, null);
  near(blocks.outputRotor.userData.angularSpeed, 0, 0,
    'rendered wheel is stopped during dwell');
  assert.ok(model.root.userData.kinematics.catchLiftFraction > 0.999);
  model.update(canonicalTimes.nextCReengagement);
  assert.equal(blocks.catchContactMarker.visible, true);
  assert.ok(model.root.userData.contacts.catchToNotch);

  model.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 12.4);
  assert.ok(size.y > 12.4);
  assert.ok(size.z > 2);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const movement218 = createMovementModel(catalog.movements[217]);
  const movement507 = createMovementModel(catalog.movements[506]);
  assert.equal(catalog.movements[216].id, 217);
  assert.equal(catalog.movements[216].fidelity, 'authored');
  assert.equal(catalog.movements[217].id, 218);
  assert.equal(catalog.movements[217].fidelity, 'authored');
  assert.equal(movement218.root.userData.fidelity, 'authored');
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(catalog.movements[506].fidelity, 'authored');
  assert.equal(movement507.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement218.root.userData.archetype,
    model.root.userData.archetype,
  );
  disposeModel(movement218.root);
  disposeModel(movement507.root);
  disposeModel(model.root);
});
