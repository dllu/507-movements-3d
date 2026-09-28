import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { createWoolComberTransmission } from '../src/simulation/authored-wool-comber.js';
import { heartCam217Geometry } from '../src/simulation/heart-cam-217.js';

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

test('movement 217 presents Brown\'s symmetric heart cam with stud A alone in its groove', () => {
  const model = createMovementModel(catalog.movements[216]);
  const { blocks, geometry: g, parts, leverSweep } = model.root.userData;
  try {
    assert.equal(blocks.cam.parent, model.root);
    assert.equal(blocks.lever.parent, model.root);
    for (const name of ['outer-cam-land', 'heart-island', 'hub-boss', 'stud-A-roller', 'stud-A-head']) {
      assert.ok(parts[name]?.isMesh, name);
    }
    // Brown draws the cam alone: the stud's lever and shaft H (plate 218)
    // are an undrawn kinematic path, not rendered parts.
    for (const name of ['lever-A-H', 'fixed-shaft-H']) assert.equal(parts[name], undefined, name);
    // No notch wheel, catch or frame: those belong to plate 218.
    const roles = [];
    model.root.traverse((o) => roles.push(o.userData.role ?? ''));
    assert.equal(roles.some((r) => /notch|catch|frame|base/.test(r)), false);
    // The groove centre line is symmetric about e-D, outermost at e and
    // innermost at D, and follows the measured engraving radii.
    for (let i = 0; i <= 36; i += 1) {
      const phi = i / 36 * Math.PI;
      near(g.radiusAt(phi), g.radiusAt(-phi), 1e-12, `symmetric at ${i}`);
      if (i) assert.ok(g.radiusAt(phi) < g.radiusAt(phi - Math.PI / 36) + 1e-12, `falls from e to D at ${i}`);
    }
    g.measuredProfilePx.forEach((px, i) => near(g.radiusAt(i * Math.PI / 18) * 237 / 5.58, px, 2.7, `measured radius ${i * 10} degrees`));
    assert.ok(g.rMax < g.camRadius - g.grooveHalfWidth && g.rMin - g.grooveHalfWidth > g.boreRadius);
    assert.ok(leverSweep > THREE.MathUtils.degToRad(20) && leverSweep < THREE.MathUtils.degToRad(35));
    // e is at twelve o'clock with the stud at e in the plate pose.
    model.update(0);
    const { stud } = model.root.userData.state;
    near(stud[0], 0, 0.02, 'stud at e');
    near(Math.hypot(...stud), g.rMax, 1e-6, 'stud at e radius');
  } finally {
    disposeModel(model.root);
  }
});

test('movement 217 stud A stays on the groove centre line with clearance to both walls', () => {
  const model = createMovementModel(catalog.movements[216]);
  const { blocks, geometry: g, parts } = model.root.userData;
  try {
    let maximumError = 0;
    let previous = null;
    let maximumStep = 0;
    let minimumRadius = Infinity;
    let maximumRadius = 0;
    for (let i = 0; i <= 1024; i += 1) {
      model.update(8 * i / 1024);
      const { stud, camAngle, leverAngle } = model.root.userData.state;
      const local = new THREE.Vector2(...stud).rotateAround(new THREE.Vector2(), -camAngle);
      const phi = Math.atan2(local.x, local.y);
      maximumError = Math.max(maximumError, Math.abs(local.length() - g.radiusAt(phi)));
      minimumRadius = Math.min(minimumRadius, local.length());
      maximumRadius = Math.max(maximumRadius, local.length());
      // The lever carries the stud: its end lies at the lever radius from H.
      near(Math.hypot(stud[0] - g.H[0], stud[1] - g.H[1]), g.leverLength, 1e-9, `lever length at ${i}`);
      if (previous !== null) maximumStep = Math.max(maximumStep, Math.abs(leverAngle - previous));
      previous = leverAngle;
    }
    assert.ok(maximumError < 1e-6, `stud off the groove centre line by ${maximumError}`);
    near(minimumRadius, g.rMin, 2e-3, 'stud reaches D');
    near(maximumRadius, g.rMax, 2e-3, 'stud reaches e');
    assert.ok(maximumStep < 0.004, 'lever moves continuously');
    // The walls are offsets of the centre line by the groove half-width, so
    // the stud roller keeps the designed radial clearance to both walls.
    assert.ok(g.grooveHalfWidth - g.rollerRadius > 0.03);
    // Rendered wall polygons are no closer than the half-width to the centre line.
    const segDistance = (p, a, b) => {
      const ab = [b[0] - a[0], b[1] - a[1]], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / (ab[0] ** 2 + ab[1] ** 2)));
      return Math.hypot(p[0] - a[0] - t * ab[0], p[1] - a[1] - t * ab[1]);
    };
    for (const name of ['outer-cam-land', 'heart-island']) {
      for (const polygon of parts[name].geometry.userData.plate.polygons) for (const ring of polygon) for (const p of ring) {
        let d = Infinity;
        for (let k = 0; k < g.centreLine.length; k += 1) d = Math.min(d, segDistance(p, g.centreLine[k], g.centreLine[(k + 1) % g.centreLine.length]));
        assert.ok(d > g.rollerRadius + 0.02, `${name} wall within ${d} of the stud path`);
      }
    }
    assert.equal(blocks.lever.children.includes(parts['stud-A-roller']), true);
  } finally {
    disposeModel(model.root);
  }
});

test('movement 217 reconstructs Brown plates 217 and 218 as one mechanism', () => {
  const movement = catalog.movements[216];
  // The complete shared transmission; plate 217 presents the heart cam.
  const model = createWoolComberTransmission(217);
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
  const model = createWoolComberTransmission(217);
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
  const model = createWoolComberTransmission(217);
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
  const model = createWoolComberTransmission(217);
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
  // The hook sits just inside F's rim in Brown's shallow notch, so it passes
  // the notch corner closer than the former deep slot (0.021 vs 0.028).
  assert.ok(minimumPlainRimClearance > 0.02);
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
  const model = createWoolComberTransmission(217);
  const {
    blocks,
    canonicalTimes,
    geometry,
    motion,
  } = model.root.userData;

  model.update(canonicalTimes.sourcePoseD);
  const sourceState = model.root.userData.kinematics;
  near(sourceState.phase, motion.backwardEndPhase, 1e-12,
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
  assert.ok(size.z > 0.3, 'the presented cam keeps its grooved depth without the undrawn frame');
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

test('movement 218 catch G rides F\'s plain rim between notches instead of hovering', () => {
  const model = createMovementModel(catalog.movements[217]);
  const { stateAtInputTravel } = model.root.userData;
  let minimum = Infinity;
  let maximumRideGap = 0;
  for (let index = 0; index <= 4000; index += 1) {
    const phase = index / 4000;
    const state = stateAtInputTravel((phase + 1) * FULL_TURN);
    minimum = Math.min(minimum, state.catchSolidClearance);
    // After the projection lifts it at e, G's lug tip grazes the rim (not
    // 20 degrees clear of it) and passes level over the intermediate notches
    // until it drops into the next notch at C.
    if (phase > 0.6 && phase < 0.94) {
      assert.ok(Math.abs(state.catchHookPolarRadius - 1.6405) < 1e-9, `phase ${phase}`);
      maximumRideGap = Math.max(maximumRideGap, state.catchHookPolarRadius - 0.09 - 1.55);
    }
  }
  assert.ok(minimum >= 0.0004, `minimum lug clearance ${minimum}`);
  assert.ok(maximumRideGap <= 0.0006, `ride gap ${maximumRideGap}`);
  disposeModel(model.root);
});
