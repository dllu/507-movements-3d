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
const STEP_ANGLE = FULL_TURN / 6;

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

function finiteStateNumbers(value, path = 'state') {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} is finite`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (value.isVector2 || value.isVector3) {
    value.toArray().forEach((coordinate, index) => {
      assert.ok(Number.isFinite(coordinate), `${path}[${index}] is finite`);
    });
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    finiteStateNumbers(child, `${path}.${key}`);
  }
}

function signedArea(points) {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1
  ) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (
      (currentPoint.y > point.y) !== (previousPoint.y > point.y)
      && point.x < (previousPoint.x - currentPoint.x)
        * (point.y - currentPoint.y)
        / (previousPoint.y - currentPoint.y) + currentPoint.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInRotorLocal(worldX, worldY, center, rotorAngle) {
  const x = worldX - center.x;
  const y = worldY - center.y;
  const cosine = Math.cos(-rotorAngle);
  const sine = Math.sin(-rotorAngle);
  return new THREE.Vector2(
    x * cosine - y * sine,
    x * sine + y * cosine,
  );
}

function lockingPlaneOverlapArea(geometry, state, pitch = 0.02) {
  let overlappingSamples = 0;
  for (let y = -3.2; y <= 3.2; y += pitch) {
    for (let x = -1.1; x <= 1.1; x += pitch) {
      const driverLocal = pointInRotorLocal(
        x,
        y,
        geometry.driverCenter,
        state.driverAngle,
      );
      if (
        !pointInPolygon(driverLocal, geometry.lockingCamOutline)
        || pointInPolygon(driverLocal, geometry.driverBoreLocal)
      ) {
        continue;
      }
      const wheelLocal = pointInRotorLocal(
        x,
        y,
        geometry.stopWheelCenter,
        state.stopWheelAngle,
      );
      if (
        pointInPolygon(wheelLocal, geometry.stopWheelOutline)
        && wheelLocal.length() > 0.5 * geometry.sourceScale
      ) {
        overlappingSamples += 1;
      }
    }
  }
  return overlappingSamples * pitch * pitch;
}

function signedAngleDifference(left, right) {
  return Math.atan2(Math.sin(left - right), Math.cos(left - right));
}

test('movement 215 is one layered crescent face-pin driver and one six-slot convex-sector stop wheel', () => {
  const movement = catalog.movements[214];
  const model = createMovementModel(movement);
  const { blocks, geometry, transmission } = model.root.userData;

  assert.equal(movement.id, 215);
  assert.equal(movement.number, '215');
  assert.equal(movement.title, 'Crescent-Pin Six-Slot Winding Stop');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'crescent-pin-six-slot-geneva-stop-with-convex-terminal-sector',
  );
  assert.match(movement.description, /comparison with 212/);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'one-rear-carrier-face-pin-indexes-a-six-slot-wheel-a-raised-crescent-locks-five-dwells-and-one-convex-sector-stops-both-directions',
  );

  assert.deepEqual(blocks.driver.userData.axis.toArray(), [0, 0, 1]);
  assert.deepEqual(blocks.stopWheel.userData.axis.toArray(), [0, 0, 1]);
  assert.equal(blocks.driverBody.userData.singleFacePinDriver, true);
  assert.equal(blocks.facePin.userData.onlyIndexingDriver, true);
  assert.equal(blocks.stopWheelBody.userData.radialSlotCount, 6);
  assert.equal(blocks.stopWheelBody.userData.normalLockingSectorCount, 5);
  assert.equal(blocks.stopWheelBody.userData.convexTerminalSectorCount, 1);
  assert.equal(blocks.driverBody.geometry.parameters.shapes.holes.length, 1,
    'the rear carrier contains only its square arbor bore');
  assert.equal(
    blocks.lockingCamBody.geometry.parameters.shapes.holes.length,
    1,
    'the raised locking cam also clears the square arbor',
  );
  assert.equal(blocks.stopWheelBody.geometry.parameters.shapes[0].holes.length, 1,
    'the stop wheel contains only its shaft bore');
  assert.equal(geometry.sourceStopWheelSegments.length, 36);
  assert.equal(geometry.sourceStopWheelSegmentOrder.length, 36);
  assert.equal(new Set(
    geometry.sourceStopWheelSegmentOrder.map(([index]) => index),
  ).size, 36);
  assert.equal(geometry.sourceStopWheelSegments[33][3], 4.833622);
  assert.equal(geometry.sourceStopWheelSegments[33][4], 4.820506);
  assert.equal(geometry.sourceStopWheelSegments[33][5], 5.651469);
  assert.equal(transmission.sixSlotWheel, true);
  assert.equal(transmission.normalIndexesPerInputTurn, 1);
  near(transmission.normalIndexAngle, STEP_ANGLE, 0,
    'one-sixth-turn normal index');
  assert.equal(transmission.forwardFullIndexes, 3);
  assert.equal(transmission.reverseFullIndexes, 1);

  const roles = [];
  let facePinCount = 0;
  let convexSectorCount = 0;
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.onlyIndexingDriver) facePinCount += 1;
    if (object.userData.convexTerminalSectorCount === 1) {
      convexSectorCount += 1;
    }
  });
  assert.equal(facePinCount, 1);
  assert.equal(convexSectorCount, 1);
  assert.ok(roles.includes(
    'rear-full-driver-carrier-disk-with-square-bore',
  ));
  assert.ok(roles.includes(
    'front-raised-crescent-locking-cam-with-square-bore',
  ));
  assert.ok(roles.includes('single-crescent-driver-face-pin'));
  assert.ok(roles.includes(
    'six-radial-slots-five-concave-locks-one-convex-terminal-sector',
  ));
  assert.ok(roles.includes('uncut-convex-terminal-sector-highlight'));
  assert.equal(
    roles.some((role) => /belt|pulley|spur-gear|pawl|ratchet/.test(role)),
    false,
    'the source mechanism is not replaced by a belt, gear, or ratchet',
  );
  disposeModel(model.root);
});

test('movement 215 reproduces the source construction, official track, and two convex-sector cusp limits', () => {
  const model = createMovementModel(catalog.movements[214]);
  const {
    geometry,
    modelPointToSourceAnimation,
    sourceAnimation,
    sourceAnimationPointToModel,
    sourceAnimationPointToRaster,
    sourceRaster,
    stopWheelAngleAtInputTravel,
    transmission,
  } = model.root.userData;

  near(geometry.sourceScale, 0.58, 0, 'source construction scale');
  near(geometry.sourceCenterDistance, 8, 0, 'source center distance');
  near(geometry.centerDistance, 4.64, 9e-16,
    'source-scaled center distance');
  vector2Near(geometry.driverCenter, new THREE.Vector2(-2.32, 0), 5e-16,
    'left crescent center');
  vector2Near(geometry.stopWheelCenter, new THREE.Vector2(2.32, 0), 5e-16,
    'right six-slot center');
  near(geometry.sourceDriverOuterRadius, 5.3, 0,
    'source driver outer radius');
  near(geometry.driverOuterRadius, 3.074, 5e-16,
    'scaled driver outer radius');
  near(geometry.driverInnerRadius, 2.32, 5e-16,
    'scaled crescent locking radius');
  near(geometry.sourcePinOrbitRadius, Math.hypot(4, 2.309401), 0,
    'source face-pin orbit');
  near(geometry.pinOrbitRadius, geometry.sourcePinOrbitRadius * 0.58, 0,
    'scaled face-pin orbit');
  near(geometry.pinRadius, 0.174, 3e-17, 'scaled face-pin radius');
  near(geometry.slotHalfWidth, geometry.pinRadius, 0,
    'slot half-width fits the single face pin');
  near(geometry.slotInnerEndRadius, 3.331198 * 0.58, 0,
    'slot inner-end center radius');
  near(geometry.slotOuterRadius, 4.618802 * 0.58, 0,
    'slot mouth radius');
  near(geometry.specialSectorRadius, 4.833622 * 0.58, 0,
    'convex terminal-sector radius');
  near(geometry.stopStepAngle, STEP_ANGLE, 0,
    'six-slot angular pitch');

  assert.equal(geometry.sourceStopWheelOutline.length, 6829);
  assert.equal(geometry.stopWheelOutline.length, 6829);
  assert.equal(geometry.sourceCrescentInnerProfile.length, 1025);
  assert.equal(geometry.sourceCrescentEccentricProfile.length, 257);
  assert.equal(geometry.sourceLockingCamOutline.length, 1281);
  assert.equal(geometry.lockingCamOutline.length, 1281);
  assert.equal(geometry.specialSectorArc.length, 108);
  near(signedArea(geometry.sourceStopWheelOutline), 56.555749033972425,
    2e-14, 'ordered source stop-wheel outline area');
  near(signedArea(geometry.stopWheelOutline), 19.025353975028477,
    8e-15, 'scaled stop-wheel outline area');
  assert.ok(signedArea(geometry.sourceLockingCamOutline) < 0,
    'traced source locking-cam contour retains its clockwise order');
  assert.ok(signedArea(geometry.lockingCamOutline) < 0,
    'scaled locking-cam contour retains the source order');
  near(geometry.driverCarrierDepth, 0.24, 0,
    'rear carrier thickness');
  near(geometry.driverCarrierZ, -0.4, 6e-17,
    'rear carrier axial center');
  near(geometry.lockingCamDepth, geometry.stopWheelDepth, 0,
    'raised cam and Geneva wheel share a working thickness');
  near(geometry.commonLockingPlaneZ, 0, 0,
    'raised cam and wheel share the locking plane');
  near(geometry.axialLayerGap, 0.085, 0,
    'rear carrier clears the front Geneva wheel');

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.durationSeconds, 8);
  assert.equal(sourceAnimation.forwardFullIndexes, 3);
  near(sourceAnimation.normalizedTerminalPosition,
    (3 + 33 / 360) / 4, 0, 'official terminal timeline position');
  near(sourceAnimation.officialScheduledTerminalExtraInputDegrees, 33, 0,
    'official terminal schedule label');
  near(
    sourceAnimation.officialTerminalPoseExtraInputDegrees,
    32.99754674581821,
    8e-15,
    'terminal pose derived from the official direction vector',
  );
  near(sourceAnimation.terminalOutputDegrees, 214.0783212215342,
    8e-14, 'terminal output pose follows the face pin');
  near(
    sourceAnimation.terminalOutputDegrees,
    THREE.MathUtils.radToDeg(
      Math.atan2(-1.902932, -2.81291) + FULL_TURN,
    ),
    1e-5,
    'terminal pose agrees with the official wl vector',
  );
  assert.equal(sourceAnimation.keyframes.length, 9);
  const expectedKeyframes = [
    [0, 0, 0],
    [1 / 24, STEP_ANGLE, STEP_ANGLE],
    [0.25, FULL_TURN, STEP_ANGLE],
    [7 / 24, FULL_TURN + STEP_ANGLE, 2 * STEP_ANGLE],
    [0.5, 2 * FULL_TURN, 2 * STEP_ANGLE],
    [13 / 24, 2 * FULL_TURN + STEP_ANGLE, 3 * STEP_ANGLE],
    [0.75, 3 * FULL_TURN, 3 * STEP_ANGLE],
  ];
  expectedKeyframes.forEach(([cpos, inputTravel, outputAngle], index) => {
    const keyframe = sourceAnimation.keyframes[index];
    near(keyframe.cpos, cpos, 0, `source keyframe ${index} cpos`);
    near(keyframe.inputTravel, inputTravel, 0,
      `source keyframe ${index} input travel`);
    near(keyframe.driverAngle, -inputTravel, 0,
      `source keyframe ${index} clockwise driver angle`);
    near(keyframe.stopWheelAngle, outputAngle, 2e-15,
      `source keyframe ${index} stop-wheel angle`);
  });
  near(sourceAnimation.keyframes[7].inputTravel, geometry.forwardInputLimit,
    0, 'terminal keyframe uses the vector-derived pose');
  near(sourceAnimation.keyframes[8].inputTravel, geometry.forwardInputLimit,
    0, 'terminal hold preserves the vector-derived pose');
  assert.equal(sourceAnimation.officialLoopResetsDiscontinuously, true);
  assert.equal(
    sourceAnimation.runtimeAddsContinuousTwoLimitReverseDemonstration,
    true,
  );

  vector2Near(sourceRaster.fittedDriverCenter,
    new THREE.Vector2(167.04545454545453, 262.5), 0,
    'source-raster crescent center');
  vector2Near(sourceRaster.fittedStopWheelCenter,
    new THREE.Vector2(357.95454545454544, 262.5), 0,
    'source-raster stop-wheel center');
  near(sourceRaster.fittedDriverOuterRadius, 126.47727272727273, 0,
    'source-raster driver radius');
  assert.equal(sourceRaster.sourceUrl,
    'https://507movements.com/mm_215.html');
  const arbitrarySourcePoint = new THREE.Vector2(5.25, -2.75);
  const modeledPoint = sourceAnimationPointToModel(arbitrarySourcePoint);
  vector2Near(modelPointToSourceAnimation(modeledPoint), arbitrarySourcePoint,
    9e-16, 'source/model transforms are inverse');
  vector2Near(
    sourceAnimationPointToRaster(geometry.sourceDriverCenter),
    sourceRaster.fittedDriverCenter,
    0,
    'source crescent center maps to its raster fit',
  );

  near(geometry.forwardInputLimit, 19.425471757334027, 4e-15,
    'three-turn-plus-terminal-stroke forward limit');
  near(geometry.reverseInputLimit, -12.095088685048523, 4e-15,
    'first reachable reverse cusp contact');
  near(transmission.forwardInputTurnsFromSourcePose, 3.091659852071717,
    8e-16, 'forward turns from source pose');
  near(transmission.reverseInputTurnsFromSourcePose, 1.924993151360325,
    8e-16, 'reverse turns from source pose');
  near(transmission.inputTurnsBetweenStops, 5.016653003432042,
    9e-16, 'full usable winding range');
  near(stopWheelAngleAtInputTravel(geometry.reverseInputLimit),
    -1.641976132509026, 2e-15,
    'one reverse index plus the terminal partial index');
  near(stopWheelAngleAtInputTravel(geometry.forwardInputLimit),
    3.736371562457821, 2e-15,
    'three full indexes plus terminal partial index');
  near(transmission.forwardPartialIndexAngle, 0.5947789088680278,
    2e-15, 'terminal partial fourth index');
  near(transmission.reversePartialIndexAngle, 0.5947785813124284,
    2e-15, 'terminal partial second reverse index');

  for (const [side, contact, expectedLocalAngle, expectedRate] of [
    [
      'forward',
      geometry.forwardStopContact,
      5.292776462837539,
      1.7882074887509702,
    ],
    [
      'reverse',
      geometry.reverseStopContact,
      5.179198759683617,
      1.7882076197572871,
    ],
  ]) {
    assert.equal(contact.side, side);
    assert.equal(contact.driverCusp, side === 'forward' ? 'upper' : 'lower');
    near(contact.normal.length(), 1, 5e-16,
      `${side} special-sector contact normal`);
    near(contact.sectorPoint.distanceTo(geometry.stopWheelCenter),
      geometry.specialSectorRadius, 9e-16,
      `${side} contact lies on the convex sector circle`);
    assert.ok(contact.sectorLocalAngle > geometry.sourceSpecialSectorStartAngle);
    assert.ok(contact.sectorLocalAngle < geometry.sourceSpecialSectorEndAngle);
    near(contact.sectorLocalAngle, expectedLocalAngle, 2e-15,
      `${side} contact lies within the correct convex arc`);
    assert.ok(contact.cuspPoint.distanceTo(contact.sectorPoint) < 2e-7,
      `${side} crescent cusp reaches the convex sector`);
    near(
      side === 'forward'
        ? geometry.forwardBlockedClosingRate
        : geometry.reverseBlockedClosingRate,
      expectedRate,
      3e-9,
      `${side} blocked-direction closing rate`,
    );
  }
  disposeModel(model.root);
});

test('movement 215 retains the original source oracle through 32,769 states alongside the finite handoff law', () => {
  const model = createMovementModel(catalog.movements[214]);
  const {geometry,sourceKinematics} = model.root.userData;
  const {engagementAtInputTravel,stateAtInputTravel,stopWheelAngleAtInputTravel} = sourceKinematics;
  const sampleCount = 32768;
  let previousOutputAngle = Number.NEGATIVE_INFINITY;
  const eventAngles = [
    geometry.reverseInputLimit,
    -(FULL_TURN + 5 * STEP_ANGLE),
    -FULL_TURN,
    -5 * STEP_ANGLE,
    0,
    STEP_ANGLE,
    FULL_TURN,
    FULL_TURN + STEP_ANGLE,
    2 * FULL_TURN,
    2 * FULL_TURN + STEP_ANGLE,
    3 * FULL_TURN,
    geometry.forwardInputLimit,
  ];
  for (let index = 0; index <= sampleCount; index += 1) {
    const fraction = index / sampleCount;
    const inputTravel = THREE.MathUtils.lerp(
      geometry.reverseInputLimit,
      geometry.forwardInputLimit,
      fraction,
    );
    const inputAngularSpeed = 0.73 + 0.16 * Math.cos(fraction * FULL_TURN);
    const inputAngularAcceleration = -0.14 * Math.sin(
      fraction * FULL_TURN,
    );
    const state = stateAtInputTravel(
      inputTravel,
      inputAngularSpeed,
      inputAngularAcceleration,
    );
    finiteStateNumbers(state, `state[${index}]`);
    near(state.inputTravel, inputTravel, 4e-15,
      `unclamped input travel ${index}`);
    near(state.driverAngle, -inputTravel, 4e-15,
      `clockwise driver angle ${index}`);
    near(state.stopWheelAngle, stopWheelAngleAtInputTravel(inputTravel),
      0, `public output law ${index}`);
    assert.ok(state.stopWheelAngle >= previousOutputAngle - 2e-13,
      `stop wheel never reverses within increasing input at ${index}`);
    previousOutputAngle = state.stopWheelAngle;
    assert.ok(state.stopWheelAngle >= -2 * STEP_ANGLE - 2e-14);
    assert.ok(state.stopWheelAngle <= 3.737);

    if (index < sampleCount) {
      near(state.inputAngularSpeed, inputAngularSpeed, 0,
        `unblocked input speed ${index}`);
      near(state.driverAngularSpeed, -inputAngularSpeed, 0,
        `opposite rendered driver speed ${index}`);
      near(
        state.stopWheelAngularSpeed,
        state.engagement.instantaneousRatio * inputAngularSpeed,
        3e-16,
        `intermittent output speed ${index}`,
      );
      near(
        state.stopWheelAngularAcceleration,
        state.engagement.instantaneousRatio * inputAngularAcceleration
          + state.engagement.ratioDerivative
            * inputAngularSpeed * inputAngularSpeed,
        7e-16,
        `intermittent output acceleration ${index}`,
      );
      assert.equal(state.atForwardStop, false);
    } else {
      assert.equal(state.atForwardStop, true);
      assert.equal(state.limit.blocked, true);
      near(state.inputAngularSpeed, 0, 0, 'blocked input speed');
      near(state.driverAngularSpeed, 0, 0, 'blocked driver speed');
      near(state.stopWheelAngularSpeed, 0, 0, 'blocked stop-wheel speed');
    }

    if (state.engagement.active) {
      assert.ok(state.engagement.slotIndex >= 0);
      assert.ok(state.engagement.slotIndex < 6);
      near(
        signedAngleDifference(
          state.engagement.localPinAngle,
          state.engagement.slotCenterAngle,
        ),
        0,
        3e-7,
        `face pin remains on slot ${state.engagement.slotIndex + 1} centerline`,
      );
      assert.ok(
        state.engagement.slotRadialPosition
          >= geometry.slotInnerEndRadius - 3e-8,
        `pin remains outside the rounded slot end at ${index}`,
      );
      assert.ok(
        state.engagement.slotRadialPosition
          <= geometry.slotOuterRadius + 3e-8,
        `pin remains inside the slot mouth at ${index}`,
      );
      assert.ok(state.engagement.instantaneousRatio >= 0.499999);
      assert.ok(state.engagement.instantaneousRatio <= 1.367);
      assert.equal(state.lock.active, false);
    } else {
      near(state.engagement.instantaneousRatio, 0, 0,
        `zero output ratio during dwell ${index}`);
      near(state.stopWheelAngularSpeed, 0, 0,
        `stationary stop wheel during dwell ${index}`);
      if (state.lock.active) {
        assert.equal(state.lock.normalPocket, true);
        vector2Near(
          state.lock.pocketCenterWorld,
          geometry.driverCenter,
          4e-15,
          `concave pocket is concentric with crescent at ${index}`,
        );
      } else {
        assert.equal(state.lock.pocketIndex, 5,
          'only the uncut sixth sector lacks a normal locking pocket');
      }
    }

    const boundaryMargin = Math.min(...eventAngles.map((angle) => (
      Math.abs(inputTravel - angle)
    )));
    if (index % 16 === 0 && boundaryMargin > 2e-4) {
      const derivativeStep = 1e-7;
      const numericalRatio = (
        stopWheelAngleAtInputTravel(inputTravel + derivativeStep)
          - stopWheelAngleAtInputTravel(inputTravel - derivativeStep)
      ) / (2 * derivativeStep);
      near(
        numericalRatio,
        state.engagement.instantaneousRatio,
        1.1e-7,
        `analytic Geneva ratio ${index}`,
      );
    }
  }

  for (const boundary of eventAngles.slice(1, -1)) {
    const epsilon = 1e-8;
    const before = stopWheelAngleAtInputTravel(boundary - epsilon);
    const after = stopWheelAngleAtInputTravel(boundary + epsilon);
    near(before, after, 3e-8,
      `output angle is continuous at event boundary ${boundary}`);
  }
  const reverseStop = stateAtInputTravel(
    geometry.reverseInputLimit,
    -1,
    0.2,
  );
  assert.equal(reverseStop.atReverseStop, true);
  assert.equal(reverseStop.limit.blocked, true);
  assert.equal(reverseStop.limit.stopContact.side, 'reverse');
  assert.equal(reverseStop.limit.stopContact.blockedDirection, 'reverse');
  const forwardStop = stateAtInputTravel(
    geometry.forwardInputLimit,
    1,
    -0.2,
  );
  assert.equal(forwardStop.atForwardStop, true);
  assert.equal(forwardStop.limit.stopContact.side, 'forward');
  assert.equal(forwardStop.limit.stopContact.blockedDirection, 'forward');

  const movingAwayFromReverse = stateAtInputTravel(
    geometry.reverseInputLimit,
    0.8,
    0.1,
  );
  assert.equal(movingAwayFromReverse.atReverseStop, false);
  near(movingAwayFromReverse.inputAngularSpeed, 0.8, 0,
    'reverse stop releases in the allowed direction');
  const movingAwayFromForward = stateAtInputTravel(
    geometry.forwardInputLimit,
    -0.8,
    -0.1,
  );
  assert.equal(movingAwayFromForward.atForwardStop, false);
  near(movingAwayFromForward.inputAngularSpeed, -0.8, 0,
    'forward stop releases in the allowed direction');
  const below = stateAtInputTravel(geometry.reverseInputLimit - 2.25, -1, -1);
  near(below.inputTravel, geometry.reverseInputLimit, 0,
    'reverse overtravel is clamped');
  near(below.limit.undertravelPrevented, 2.25, 9e-16,
    'reported reverse overtravel');
  const above = stateAtInputTravel(geometry.forwardInputLimit + 2.75, 1, 1);
  near(above.inputTravel, geometry.forwardInputLimit, 0,
    'forward overtravel is clamped');
  near(above.limit.overtravelPrevented, 2.75, 9e-16,
    'reported forward overtravel');

  const sourceEngagement = engagementAtInputTravel(0);
  assert.equal(sourceEngagement.active, true);
  assert.equal(sourceEngagement.slotIndex, 2);
  near(sourceEngagement.slotCenterAngle, 5 * Math.PI / 6, 5e-16,
    'source pin enters the 150-degree slot');
  disposeModel(model.root);
});

test('movement 215 runtime stops at every engagement boundary, reverses continuously, and binds exact contacts', () => {
  const model = createMovementModel(catalog.movements[214]);
  const {
    blocks,
    canonicalStates,
    canonicalTimes,
    geometry,
    inputStateAtTime,
    stateAtTime,
    timeline,
  } = model.root.userData;

  near(canonicalStates.sourcePose.inputTravel, 0, 0,
    'runtime begins in the official source pose');
  near(canonicalStates.firstIndexComplete.inputTravel, STEP_ANGLE, 0,
    'first 60-degree index completes exactly');
  near(canonicalStates.firstIndexComplete.stopWheelAngle, model.root.userData.stopWheelAngleAtInputTravel(STEP_ANGLE), 0,
    'source nominal index endpoint uses the corrected finite handoff pose');
  near(canonicalStates.firstTurnComplete.inputTravel, FULL_TURN, 0,
    'first input revolution completes exactly');
  near(canonicalStates.firstTurnComplete.stopWheelAngle, STEP_ANGLE, 0,
    'output dwells after the first index');
  near(canonicalStates.thirdIndexComplete.stopWheelAngle, model.root.userData.stopWheelAngleAtInputTravel(2*FULL_TURN+STEP_ANGLE), 0,
    'third nominal endpoint uses the corrected handoff pose');
  near(canonicalStates.thirdTurnComplete.stopWheelAngle, 3 * STEP_ANGLE, 0,
    'third dwell ends without output drift');
  assert.equal(canonicalStates.forwardStop.atForwardStop, true);
  assert.equal(canonicalStates.forwardStop.limit.stopContact.side, 'forward');
  assert.equal(canonicalStates.reverseStop.atReverseStop, true);
  assert.equal(canonicalStates.reverseStop.limit.stopContact.side, 'reverse');
  near(canonicalStates.reverseSourcePose.inputTravel, 0, 7e-15,
    'full reverse traverse passes through the source pose');
  near(canonicalStates.cycleClosure.inputTravel, 0, 0,
    'cycle closes at the source pose');

  const motionBoundaries = timeline.allMotionSegments.flatMap((segment) => [
    segment.startTime,
    segment.endTime,
  ]);
  const boundaries = [...new Set([
    0,
    timeline.sourceHoldDuration,
    timeline.forwardTraversal.endTime,
    timeline.forwardStopHoldEnd,
    timeline.fullReverseTraversal.endTime,
    timeline.reverseStopHoldEnd,
    timeline.demonstrationPeriod,
    ...motionBoundaries,
  ])];
  for (const boundary of boundaries) {
    const input = inputStateAtTime(boundary);
    near(input.angularSpeed, 0, 8e-14,
      `zero input speed at runtime boundary ${boundary}`);
    near(input.angularAcceleration, 0, 2e-12,
      `zero input acceleration at runtime boundary ${boundary}`);
  }

  const epsilon = 1e-7;
  for (const boundary of boundaries.filter((value) => (
    value > epsilon && value < timeline.demonstrationPeriod - epsilon
  ))) {
    const before = stateAtTime(boundary - epsilon);
    const after = stateAtTime(boundary + epsilon);
    near(before.inputTravel, after.inputTravel, 3e-11,
      `continuous input pose at ${boundary}`);
    near(before.stopWheelAngle, after.stopWheelAngle, 4e-11,
      `continuous stop-wheel pose at ${boundary}`);
  }
  const cycleBefore = stateAtTime(timeline.demonstrationPeriod - epsilon);
  const cycleAfter = stateAtTime(epsilon);
  near(cycleBefore.inputTravel, cycleAfter.inputTravel, 3e-11,
    'cycle seam is position-continuous');
  near(cycleBefore.inputAngularSpeed, cycleAfter.inputAngularSpeed, 2e-10,
    'cycle seam is velocity-continuous');

  for (let index = 1; index < 4096; index += 1) {
    const time = timeline.demonstrationPeriod * index / 4096;
    if (boundaries.some((boundary) => Math.abs(time - boundary) < 2e-4)) {
      continue;
    }
    const state = stateAtTime(time);
    const before = stateAtTime(time - epsilon);
    const after = stateAtTime(time + epsilon);
    const numericalInputSpeed = (
      after.inputTravel - before.inputTravel
    ) / (2 * epsilon);
    near(numericalInputSpeed, state.inputAngularSpeed, 2.2e-6,
      `analytic input speed at runtime sample ${index}`);
    near(state.driverAngularSpeed, -state.inputAngularSpeed, 0,
      `rendered input turns clockwise at sample ${index}`);
    near(
      state.stopWheelAngularSpeed,
      state.engagement.instantaneousRatio * state.inputAngularSpeed,
      2e-14,
      `analytic intermittent output speed at sample ${index}`,
    );
  }

  model.update(canonicalTimes.forwardStopMidHold);
  assert.equal(model.root.userData.contacts.convexTerminalSector.side,
    'forward');
  assert.equal(blocks.forwardContactMarker.visible, true);
  assert.equal(blocks.reverseContactMarker.visible, false);
  model.update(canonicalTimes.reverseStopMidHold);
  assert.equal(model.root.userData.contacts.convexTerminalSector.side,
    'reverse');
  assert.equal(blocks.forwardContactMarker.visible, false);
  assert.equal(blocks.reverseContactMarker.visible, true);
  model.update(canonicalTimes.sourcePose);
  near(blocks.driver.userData.rotor.rotation.z, 0, 0,
    'rendered crescent source orientation');
  near(blocks.stopWheel.userData.rotor.rotation.z, 0, 0,
    'rendered stop-wheel source orientation');
  assert.equal(model.root.userData.contacts.facePinSlot, null);
  assert.equal(model.root.userData.contacts.crescentLockingPocket.active, true);
  assert.equal(model.root.userData.contacts.convexTerminalSector, null);
  disposeModel(model.root);
});

test('movement 215 renders separated carrier and locking planes with nominal profile checks and leaves the reviewed queue sequential', () => {
  const model = createMovementModel(catalog.movements[214]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtInputTravel,
  } = model.root.userData;
  model.update(canonicalTimes.sourcePose);
  model.root.updateMatrixWorld(true);

  const driverBounds = new THREE.Box3().setFromObject(blocks.driverBody);
  const lockingCamBounds = new THREE.Box3().setFromObject(
    blocks.lockingCamBody,
  );
  const stopWheelBounds = new THREE.Box3().setFromObject(blocks.stopWheelBody);
  const pinBounds = new THREE.Box3().setFromObject(blocks.facePin);
  const sectorBounds = new THREE.Box3().setFromObject(
    blocks.specialSectorHighlight,
  );
  assert.ok(driverBounds.max.x > geometry.driverCenter.x);
  assert.ok(stopWheelBounds.min.x < geometry.stopWheelCenter.x);
  assert.ok(driverBounds.max.x > stopWheelBounds.min.x,
    'the rear carrier overlaps the Geneva wheel only in projection');
  near(stopWheelBounds.min.z - driverBounds.max.z, geometry.axialLayerGap,
    2e-8, 'rear carrier clears the Geneva wheel axially');
  near(lockingCamBounds.min.z, stopWheelBounds.min.z, 2e-8,
    'raised crescent and Geneva wheel share the locking-plane back face');
  near(lockingCamBounds.max.z, stopWheelBounds.max.z, 2e-8,
    'raised crescent and Geneva wheel share the locking-plane front face');
  assert.ok(pinBounds.max.z > driverBounds.max.z + 0.35,
    'the single face pin projects from the rear carrier');
  assert.ok(pinBounds.max.z > stopWheelBounds.max.z + 0.35,
    'the face pin bridges into the radial-slot plane');
  assert.ok(sectorBounds.min.z > stopWheelBounds.max.z - 0.01,
    'the convex terminal sector is visibly highlighted on the front face');
  assert.equal(blocks.stopWheelBody.geometry.parameters.shapes[0].holes.length, 1);
  assert.equal(blocks.driverBody.geometry.parameters.shapes.holes.length, 1);
  assert.equal(
    blocks.lockingCamBody.geometry.parameters.shapes.holes.length,
    1,
  );

  const clearancePoses = [
    geometry.reverseInputLimit,
    -(FULL_TURN + 5 * STEP_ANGLE),
    -FULL_TURN,
    -5 * STEP_ANGLE,
    0,
    STEP_ANGLE / 2,
    STEP_ANGLE,
    Math.PI,
    FULL_TURN,
    FULL_TURN + STEP_ANGLE / 2,
    2 * FULL_TURN,
    2 * FULL_TURN + STEP_ANGLE / 2,
    3 * FULL_TURN,
    geometry.forwardInputLimit,
  ];
  for (const inputTravel of clearancePoses) {
    const state = stateAtInputTravel(inputTravel, 0, 0);
    assert.ok(
      lockingPlaneOverlapArea(geometry, state) < 0.006,
      `locking cam and Geneva wheel do not penetrate at ${inputTravel}`,
    );
  }

  const pinWorld = new THREE.Vector3();
  blocks.facePin.getWorldPosition(pinWorld);
  const sourcePin = model.root.userData.pinCenterAtInputTravel(0);
  near(pinWorld.x, sourcePin.x, 2e-16, 'rendered source pin x');
  near(pinWorld.y, sourcePin.y, 2e-16, 'rendered source pin y');
  model.update(canonicalTimes.firstIndexComplete);
  near(blocks.driver.userData.rotor.rotation.z, -STEP_ANGLE, 2e-15,
    'driver turns clockwise through the first index');
  near(blocks.stopWheel.userData.rotor.rotation.z, model.root.userData.stopWheelAngleAtInputTravel(STEP_ANGLE), 2e-15,
    'six-slot wheel renders the finite handoff pose');
  model.update(canonicalTimes.forwardStopMidHold);
  assert.equal(blocks.forwardContactMarker.visible, true);
  const forwardMarkerWorld = new THREE.Vector3();
  blocks.forwardContactMarker.getWorldPosition(forwardMarkerWorld);
  near(forwardMarkerWorld.x, geometry.forwardStopContact.contactPoint.x,
    2e-16, 'forward marker x');
  near(forwardMarkerWorld.y, geometry.forwardStopContact.contactPoint.y,
    2e-16, 'forward marker y');
  model.update(canonicalTimes.reverseStopMidHold);
  assert.equal(blocks.reverseContactMarker.visible, true);
  const reverseMarkerWorld = new THREE.Vector3();
  blocks.reverseContactMarker.getWorldPosition(reverseMarkerWorld);
  near(reverseMarkerWorld.x, geometry.reverseStopContact.contactPoint.x,
    2e-16, 'reverse marker x');
  near(reverseMarkerWorld.y, geometry.reverseStopContact.contactPoint.y,
    2e-16, 'reverse marker y');

  const sweptBounds = new THREE.Box3();
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    sweptBounds.union(new THREE.Box3().setFromObject(model.root));
  }
  const sweptSize = sweptBounds.getSize(new THREE.Vector3());
  assert.ok(sweptSize.x > 9);
  assert.ok(sweptSize.y > 7.5);
  assert.ok(sweptSize.z > 1.65, 'the planes use depth without the undrawn frame');
  let meshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  assert.ok(meshCount >= 20, 'the undrawn frame is presented away');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const movement214 = createMovementModel(catalog.movements[213]);
  const movement216 = createMovementModel(catalog.movements[215]);
  const movement507 = createMovementModel(catalog.movements[506]);
  assert.equal(catalog.movements[213].id, 214);
  assert.equal(catalog.movements[213].fidelity, 'authored');
  assert.equal(movement214.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement214.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.equal(catalog.movements[215].id, 216);
  assert.equal(catalog.movements[215].fidelity, 'authored');
  assert.equal(movement216.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement216.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(catalog.movements[506].fidelity, 'authored');
  assert.equal(movement507.root.userData.fidelity, 'authored');
  disposeModel(movement214.root);
  disposeModel(movement216.root);
  disposeModel(movement507.root);
  disposeModel(model.root);
});
