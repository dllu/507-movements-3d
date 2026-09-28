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
const Z_AXIS = new THREE.Vector3(0, 0, 1);

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

function vector3Near(actual, expected, tolerance, message) {
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

function radialDistanceToAxis(point, origin, axis) {
  const offset = point.clone().sub(origin);
  return offset.addScaledVector(axis, -offset.dot(axis)).length();
}

function pointToSegmentDistance(point, start, end) {
  const direction = end.clone().sub(start);
  const fraction = THREE.MathUtils.clamp(
    point.clone().sub(start).dot(direction) / direction.lengthSq(),
    0,
    1,
  );
  return point.distanceTo(start.clone().addScaledVector(
    direction,
    fraction,
  ));
}

test('movement 212 is one winding finger and one five-slot Geneva stop wheel, not a generic ratchet', () => {
  const movement = catalog.movements[211];
  const model = createMovementModel(movement);
  const {
    blocks,
    geometry,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 212);
  assert.equal(movement.number, '212');
  assert.equal(
    movement.title,
    'Five-Slot Geneva Winding Stop with Convex Limit Sector',
  );
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'five-slot-geneva-winding-stop-three-indexes-and-convex-terminal-sector',
  );
  assert.match(movement.description, /Geneva-stop/);
  assert.match(movement.description, /convex curved part/);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'one-winding-finger-indexes-four-lock-poses-before-the-fifth-convex-sector-blocks-overwinding',
  );
  assert.deepEqual(blocks.driver.userData.axis.toArray(), [0, 0, 1]);
  assert.deepEqual(blocks.stopWheel.userData.axis.toArray(), [0, 0, 1]);
  assert.deepEqual(blocks.driverShaft.userData.axis.toArray(), [0, 0, 1]);
  assert.deepEqual(blocks.stopWheelShaft.userData.axis.toArray(), [0, 0, 1]);
  assert.equal(blocks.driverBody.userData.trueGenevaDriverProfile, true);
  assert.equal(blocks.stopWheelBody.userData.trueGenevaStopProfile, true);
  assert.equal(blocks.driverBody.geometry.parameters.shapes.holes.length, 1);
  assert.equal(blocks.stopWheelBody.geometry.parameters.shapes.holes.length, 1);
  assert.equal(blocks.stopSectorEndpointMarkers.length, 2);
  assert.equal(geometry.nominalSlotCount, 5);
  assert.equal(geometry.slotPolylines.length, 5);
  assert.equal(geometry.lockPocketArcs.length, 4);
  assert.equal(geometry.lockPocketCenters.length, 4);
  assert.equal(transmission.normalIndexCount, 3);
  assert.equal(transmission.nominalSlotCount, 5);
  assert.equal(transmission.direction,
    'opposite-during-each-index-and-locked-between-indexes');

  const roles = [];
  let driverProfileCount = 0;
  let stopProfileCount = 0;
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.trueGenevaDriverProfile) driverProfileCount += 1;
    if (object.userData.trueGenevaStopProfile) stopProfileCount += 1;
  });
  assert.equal(driverProfileCount, 1);
  assert.equal(stopProfileCount, 1);
  assert.ok(roles.includes('single-finger-locking-rim-geneva-driver-A'));
  assert.ok(roles.includes(
    'five-slot-four-pocket-wheel-with-one-convex-stop-sector',
  ));
  assert.ok(roles.includes('convex-a-b-terminal-stop-sector-highlight'));
  assert.equal(
    roles.some((role) => /belt|pulley|pawl|ratchet-wheel|gear-pair/.test(role)),
    false,
    'no unrelated transmission family is invented',
  );
  disposeModel(model.root);
});

test('movement 212 reproduces the official five-position construction, four pockets, source poses, and terminal contact', () => {
  const model = createMovementModel(catalog.movements[211]);
  const {
    geometry,
    sourceAnchors,
    sourceAnimation,
    sourcePointToModel,
    sourceRaster,
    transmission,
  } = model.root.userData;

  near(geometry.centerDistance,
    geometry.rawCenterDistance * geometry.constructionScale, 0,
    'modeled center distance');
  near(
    geometry.rawCenterDistance * Math.sin(Math.PI / 5),
    4.374409,
    7e-7,
    'five-position Geneva transverse construction',
  );
  near(
    geometry.rawCenterDistance * Math.cos(Math.PI / 5),
    6.020858,
    7e-7,
    'five-position Geneva longitudinal construction',
  );
  near(geometry.stopStepAngle, THREE.MathUtils.degToRad(72), 0,
    'five-position output step');
  near(geometry.normalIndexInputAngle, THREE.MathUtils.degToRad(51), 0,
    'official normal index interval');
  near(geometry.driverLockingRadius, 4 * geometry.constructionScale, 0,
    'driver locking rim radius');
  near(geometry.stopSectorRadius, geometry.driverLockingRadius, 0,
    'matching stop and lock radii');
  near(geometry.driverFingerRadius, 4.5 * geometry.constructionScale, 0,
    'winding finger outer radius');
  near(transmission.normalIndexRatio, -24 / 17, 3e-16,
    'official 72-over-51 active ratio');

  assert.equal(geometry.driverOutlineRaw.length, 1307);
  assert.equal(geometry.stopWheelOutlineRaw.length, 1297);
  assert.equal(geometry.driverFingerArcRaw.length, 129);
  assert.equal(geometry.convexStopArcRaw.length, 257);
  vector2Near(
    geometry.driverOutlineRaw[0],
    new THREE.Vector2(2.783027155941134, 3.5362069862062944),
    1e-15,
    'official driver finger arc start',
  );
  vector2Near(
    geometry.driverOutlineRaw.at(-1),
    new THREE.Vector2(2.7830276905849964, 3.53620624852058),
    1e-15,
    'official driver finger arc closure',
  );
  assert.ok(
    geometry.driverOutlineRaw[0].distanceTo(
      geometry.driverOutlineRaw.at(-1),
    ) < 1e-6,
    'driver profile closes within source rounding',
  );
  vector2Near(
    geometry.stopWheelOutlineRaw[0],
    new THREE.Vector2(-3.9924431309329567, 0.24575973280065902),
    1e-15,
    'convex a-b sector starts at the official point',
  );
  assert.ok(
    geometry.stopWheelOutlineRaw[0].distanceTo(
      geometry.stopWheelOutlineRaw.at(-1),
    ) < 0.016,
    'only the source sub-pixel segment gap is bridged',
  );

  geometry.lockPocketCentersRaw.forEach((center, index) => {
    near(center.length(), geometry.rawCenterDistance, 7e-7,
      `lock-pocket center ${index} lies on the center-distance circle`);
  });
  const expectedLockCenters = [
    [0, -7.442189],
    [7.077943, -2.299763],
    [4.374409, 6.020858],
    [-4.374409, 6.020858],
  ];
  geometry.lockPocketCentersRaw.forEach((center, index) => {
    vector2Near(center, new THREE.Vector2(...expectedLockCenters[index]), 0,
      `official lock-pocket center ${index}`);
  });

  const terminalRaw = geometry.terminalContactPoint.clone()
    .sub(geometry.driverCenter)
    .divideScalar(geometry.constructionScale);
  vector2Near(
    terminalRaw,
    new THREE.Vector2(-1.5774316870080167, 4.214464292507773),
    2e-15,
    'terminal tooth/stop contact reconstructed from the source profiles',
  );
  near(
    geometry.terminalContactPoint.distanceTo(geometry.driverCenter),
    geometry.driverFingerRadius,
    2e-16,
    'terminal contact lies on the winding-finger arc',
  );
  near(
    pointToSegmentDistance(
      geometry.terminalContactPoint,
      geometry.terminalStopShoulder[0],
      geometry.terminalStopShoulder[1],
    ),
    0,
    6e-17,
    'terminal contact lies on the solid-sector shoulder',
  );
  near(geometry.terminalStopNormal.length(), 1, 2e-16,
    'terminal contact normal is normalized');
  assert.ok(geometry.blockedForwardClosingRate > 1.62,
    'a further positive driver turn closes into the stop shoulder');

  near(
    THREE.MathUtils.radToDeg(geometry.sourceTerminalInputAngle),
    33.25472788792632,
    2e-14,
    'official final driver pose',
  );
  near(
    THREE.MathUtils.radToDeg(geometry.terminalStopWheelAdvance),
    46.01723289896809,
    3e-14,
    'partial final Geneva advance before blocking',
  );
  near(transmission.inputTurnsBeforeTerminalStop,
    3.092374244133129, 5e-16, 'finite winding range');
  near(transmission.outputStepsAtStop,
    3.63912823470789, 5e-16, 'stop-wheel travel at the limit');

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.driverFullTurnsBeforeStop, 3);
  assert.equal(sourceAnimation.officialDurationSeconds, 12);
  assert.equal(sourceAnimation.officialNormalIndexInputDegrees, 51);
  assert.equal(sourceAnimation.officialLoopResetsDiscontinuously, true);
  assert.equal(sourceAnimation.runtimeUsesContinuousReverseReturn, true);
  near(sourceAnimation.officialNormalizedIntervals.firstIndex[1],
    (51 / 360) / 4, 0, 'official first index timing');
  near(sourceAnimation.officialNormalizedIntervals.terminalHold[0],
    (3 + 33.25 / 360) / 4, 0, 'official terminal hold timing');
  assert.equal(sourceRaster.width, 525);
  assert.equal(sourceRaster.height, 525);
  assert.equal(sourceRaster.sourceUrl,
    'https://507movements.com/mm_212.html');
  vector2Near(sourceAnchors.modeledDriverCenter,
    sourceAnchors.driverCenter, 0, 'source driver center maps exactly');
  vector2Near(sourceAnchors.modeledStopWheelCenter,
    sourceAnchors.stopWheelCenter, 3e-14,
    'source stop-wheel center maps exactly');
  vector3Near(
    sourcePointToModel(sourceAnchors.driverCenter),
    new THREE.Vector3(geometry.driverCenter.x, geometry.driverCenter.y, 0),
    0,
    'source driver origin to model',
  );
  vector3Near(
    sourcePointToModel(sourceAnchors.stopWheelCenter),
    new THREE.Vector3(
      geometry.stopWheelCenter.x,
      geometry.stopWheelCenter.y,
      0,
    ),
    5e-16,
    'source stop-wheel origin to model',
  );
  disposeModel(model.root);
});

test('movement 212 retains the official interpolation as an independent source oracle through 32,769 states', () => {
  const model = createMovementModel(catalog.movements[211]);
  const {
    geometry,
    stateAtTime,
    timeline,
    transmission,
  } = {...model.root.userData, ...model.root.userData.sourceKinematics};
  const sampleCount = 32768;
  const directions = new Set();
  const stages = new Set();
  const activeSlots = new Set();
  const lockPockets = new Set();
  let maximumLockConcentricityError = 0;
  let maximumOfficialPhaseError = 0;
  let maximumRateError = 0;
  let minimumDriverAngle = Infinity;
  let maximumDriverAngle = -Infinity;
  let minimumStopWheelAngle = Infinity;
  let maximumStopWheelAngle = -Infinity;
  let terminalStateCount = 0;
  let previous = null;

  for (let index = 0; index <= sampleCount; index += 1) {
    const state = stateAtTime(
      timeline.demonstrationPeriod * index / sampleCount,
    );
    finiteStateNumbers(state);
    directions.add(state.demonstrationDirection);
    stages.add(state.stage);
    minimumDriverAngle = Math.min(minimumDriverAngle, state.driverAngle);
    maximumDriverAngle = Math.max(maximumDriverAngle, state.driverAngle);
    minimumStopWheelAngle = Math.min(
      minimumStopWheelAngle,
      state.stopWheelAngle,
    );
    maximumStopWheelAngle = Math.max(
      maximumStopWheelAngle,
      state.stopWheelAngle,
    );
    assert.ok(state.driverAngle >= -1e-15);
    assert.ok(state.driverAngle <= geometry.forwardInputLimit + 1e-15);
    assert.ok(state.stopWheelAngle <= 1e-15);
    assert.ok(
      state.stopWheelAngle >= geometry.sourceTerminalInputAngle
        * transmission.terminalIndexRatio
        - transmission.normalIndexCount * transmission.stopStepAngle
        - 3e-15,
    );
    maximumOfficialPhaseError = Math.max(
      maximumOfficialPhaseError,
      state.engagement.officialPhaseError,
    );

    const expectedRatio = state.engagement.active
      ? state.engagement.activeSlotIndex === 4
        ? transmission.terminalIndexRatio
        : transmission.normalIndexRatio
      : 0;
    maximumRateError = Math.max(
      maximumRateError,
      Math.abs(
        state.stopWheelAngularSpeed
          - expectedRatio * state.driverAngularSpeed,
      ),
      Math.abs(
        state.stopWheelAngularAcceleration
          - expectedRatio * state.driverAngularAcceleration,
      ),
    );
    if (state.engagement.active) {
      activeSlots.add(state.engagement.activeSlotIndex);
      assert.equal(state.lock.active, false);
    }
    if (state.lock.active) {
      lockPockets.add(state.lock.pocketIndex);
      maximumLockConcentricityError = Math.max(
        maximumLockConcentricityError,
        state.lock.concentricityError,
      );
      near(state.stopWheelAngle,
        -state.lock.pocketIndex * transmission.stopStepAngle, 2e-15,
        'locked stop-wheel pose');
      near(state.stopWheelAngularSpeed, 0, 0,
        'locked stop wheel has no angular velocity');
      near(state.stopWheelAngularAcceleration, 0, 0,
        'locked stop wheel has no angular acceleration');
    }
    if (state.atTerminalStop) {
      terminalStateCount += 1;
      near(state.driverAngle, geometry.forwardInputLimit, 0,
        'terminal driver angle cannot overtravel');
      near(state.stopWheelAngle,
        -transmission.outputStepsAtStop * transmission.stopStepAngle,
        3e-15,
        'terminal stop-wheel angle');
      near(state.driverAngularSpeed, 0, 1e-12,
        'driver is stationary against the terminal stop');
      assert.equal(state.limit.blocked, true);
      assert.ok(state.limit.blockedForwardClosingRate > 0);
    }

    if (previous
      && previous.demonstrationDirection === state.demonstrationDirection) {
      if (state.demonstrationDirection === 'winding-toward-stop') {
        assert.ok(state.driverAngle >= previous.driverAngle - 2e-14);
        assert.ok(state.stopWheelAngle <= previous.stopWheelAngle + 2e-14);
      } else if (state.demonstrationDirection
        === 'unwinding-away-from-stop') {
        assert.ok(state.driverAngle <= previous.driverAngle + 2e-14);
        assert.ok(state.stopWheelAngle >= previous.stopWheelAngle - 2e-14);
      } else {
        near(state.driverAngle, previous.driverAngle, 0,
          'held input pose is stationary');
        near(state.stopWheelAngle, previous.stopWheelAngle, 0,
          'held output pose is stationary');
      }
    }
    previous = state;
  }

  near(minimumDriverAngle, 0, 0, 'minimum finite input angle');
  near(maximumDriverAngle, geometry.forwardInputLimit, 0,
    'maximum finite input angle');
  near(maximumStopWheelAngle, 0, 0, 'initial stop-wheel angle');
  near(minimumStopWheelAngle,
    -transmission.outputStepsAtStop * transmission.stopStepAngle,
    3e-15,
    'terminal stop-wheel travel');
  assert.ok(maximumLockConcentricityError < 2.81e-7);
  assert.ok(maximumOfficialPhaseError < 9e-16);
  near(maximumRateError, 0, 0,
    'every active and locked rate follows its source branch');
  assert.deepEqual([...activeSlots].sort(), [1, 2, 3, 4]);
  assert.deepEqual([...lockPockets].sort(), [1, 2, 3]);
  assert.deepEqual([...directions].sort(), [
    'held-at-convex-stop',
    'held-at-source-start',
    'unwinding-away-from-stop',
    'winding-toward-stop',
  ]);
  assert.deepEqual([...stages].sort(), [
    'concentric-pocket-1-locked-dwell',
    'concentric-pocket-2-locked-dwell',
    'concentric-pocket-3-locked-dwell',
    'convex-sector-terminal-stop',
    'terminal-stop-approach',
    'winding-finger-indexes-slot-1',
    'winding-finger-indexes-slot-2',
    'winding-finger-indexes-slot-3',
  ]);
  assert.ok(terminalStateCount > 1400,
    'the terminal stop remains visible during its hold');
  disposeModel(model.root);
});

test('movement 212 retains the source timing and reversible oracle without a loop reset', () => {
  const model = createMovementModel(catalog.movements[211]);
  const {
    canonicalStates,
    canonicalTimes,
    geometry,
    inputStateAtTime,
    stateAtInputAngle,
    stateAtTime,
    timeline,
    transmission,
  } = {...model.root.userData, ...model.root.userData.sourceKinematics};

  assert.equal(timeline.forwardSegments.length, 7);
  near(timeline.forwardMotionDuration, 12.6, 2e-15,
    'forward winding duration');
  near(timeline.demonstrationPeriod, 27.6, 4e-15,
    'continuous wind-and-unwind period');
  near(canonicalTimes.terminalStop, 12.6, 2e-15,
    'terminal stop time');
  near(canonicalTimes.unwindFromStop, 13.9, 2e-15,
    'reverse departure time');
  assert.equal(canonicalStates.firstIndexComplete.lock.pocketIndex, 1);
  assert.equal(canonicalStates.secondIndexComplete.lock.pocketIndex, 2);
  assert.equal(canonicalStates.thirdIndexComplete.lock.pocketIndex, 3);
  assert.equal(canonicalStates.terminalStop.atTerminalStop, true);
  assert.equal(canonicalStates.terminalStopMidHold.atTerminalStop, true);
  assert.equal(canonicalStates.cycleClosure.driverAngle, 0);
  near(canonicalStates.cycleClosure.stopWheelAngle, 0, 0,
    'stop-wheel cycle closure');

  const expectedEndpoints = [
    geometry.normalIndexInputAngle,
    FULL_TURN,
    FULL_TURN + geometry.normalIndexInputAngle,
    FULL_TURN * 2,
    FULL_TURN * 2 + geometry.normalIndexInputAngle,
    FULL_TURN * 3,
    geometry.forwardInputLimit,
  ];
  timeline.forwardSegments.forEach((segment, index) => {
    const start = inputStateAtTime(segment.startTime);
    const end = inputStateAtTime(segment.endTime);
    near(start.angle, segment.startAngle, 8e-15,
      `segment ${index} exact start pose`);
    near(end.angle, expectedEndpoints[index], 8e-15,
      `segment ${index} exact end pose`);
    near(start.angularSpeed, 0, 2e-27,
      `segment ${index} starts without a velocity jump`);
    near(end.angularSpeed, 0, 2e-27,
      `segment ${index} ends without a velocity jump`);
    near(start.angularAcceleration, 0, 2e-13,
      `segment ${index} starts without an acceleration jump`);
    near(end.angularAcceleration, 0, 2e-13,
      `segment ${index} ends without an acceleration jump`);
  });

  const differenceStep = 0.00001;
  let maximumDriverVelocityError = 0;
  let maximumStopVelocityError = 0;
  let maximumDriverAccelerationError = 0;
  for (const segment of timeline.forwardSegments) {
    for (const fraction of [0.2, 0.4, 0.6, 0.8]) {
      const time = segment.startTime + segment.duration * fraction;
      const state = stateAtTime(time);
      const previous = stateAtTime(time - differenceStep);
      const next = stateAtTime(time + differenceStep);
      maximumDriverVelocityError = Math.max(
        maximumDriverVelocityError,
        Math.abs(
          (next.driverAngle - previous.driverAngle)
            / (2 * differenceStep) - state.driverAngularSpeed,
        ),
      );
      maximumStopVelocityError = Math.max(
        maximumStopVelocityError,
        Math.abs(
          (next.stopWheelAngle - previous.stopWheelAngle)
            / (2 * differenceStep) - state.stopWheelAngularSpeed,
        ),
      );
      maximumDriverAccelerationError = Math.max(
        maximumDriverAccelerationError,
        Math.abs(
          (next.driverAngularSpeed - previous.driverAngularSpeed)
            / (2 * differenceStep) - state.driverAngularAcceleration,
        ),
      );
    }
  }
  assert.ok(maximumDriverVelocityError < 1e-9);
  assert.ok(maximumStopVelocityError < 7e-10);
  assert.ok(maximumDriverAccelerationError < 4e-9);

  for (const forwardTime of [0, 0.55, 2.5, 4.45, 6.4, 8.35, 10.3, 12.6]) {
    const forward = stateAtTime(forwardTime);
    const reverse = stateAtTime(
      timeline.reverseMotionStart
        + timeline.forwardMotionDuration - forwardTime,
    );
    near(reverse.driverAngle, forward.driverAngle, 2e-14,
      'reverse path retraces the exact driver pose');
    near(reverse.stopWheelAngle, forward.stopWheelAngle, 2e-14,
      'reverse path retraces the exact stop-wheel pose');
    near(reverse.driverAngularSpeed, -forward.driverAngularSpeed, 3e-14,
      'reverse driver speed changes sign');
    near(reverse.stopWheelAngularSpeed, -forward.stopWheelAngularSpeed, 5e-14,
      'reverse output speed changes sign');
  }

  const overtravel = stateAtInputAngle(
    geometry.forwardInputLimit + FULL_TURN,
    2,
  );
  near(overtravel.driverAngle, geometry.forwardInputLimit, 0,
    'hard stop clamps requested input overtravel');
  near(overtravel.driverAngularSpeed, 0, 0,
    'hard stop removes attempted forward speed');
  near(overtravel.limit.overtravelPrevented, FULL_TURN, 0,
    'reported prevented overtravel');
  assert.equal(overtravel.limit.blocked, true);
  near(
    transmission.inputTurnsBeforeTerminalStop,
    3 + geometry.sourceTerminalInputAngle / FULL_TURN,
    0,
    'three complete turns plus the source terminal approach',
  );
  disposeModel(model.root);
});

test('movement 212 renders every rigid pose and terminal contact while movement 213 is a distinct authored stop', () => {
  const model = createMovementModel(catalog.movements[211]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const renderedTimes = [
    canonicalTimes.sourceStart,
    canonicalTimes.firstIndexComplete,
    canonicalTimes.firstLockedDwellMid,
    canonicalTimes.secondIndexComplete,
    canonicalTimes.thirdIndexComplete,
    canonicalTimes.terminalApproachStart,
    canonicalTimes.terminalStop,
    canonicalTimes.terminalStopMidHold,
    canonicalTimes.unwindFromStop,
    canonicalTimes.cycleClosure,
  ];
  const sweptBounds = new THREE.Box3();

  // Display time t shows demonstration time t + displayTimeOffset.
  const shown = (time) => time - model.root.userData.displayTimeOffset;
  for (const time of renderedTimes) {
    const state = stateAtTime(time);
    model.update(shown(time));
    model.root.updateMatrixWorld(true);
    near(blocks.driver.userData.rotor.rotation.z,
      state.driverAngle, 0, 'rendered driver angle');
    near(blocks.driverShaft.userData.rotor.rotation.z,
      state.driverAngle, 0, 'rendered driver shaft angle');
    near(blocks.stopWheel.userData.rotor.rotation.z,
      state.stopWheelAngle, 0, 'rendered stop-wheel angle');
    near(blocks.stopWheelShaft.userData.rotor.rotation.z,
      state.stopWheelAngle, 0, 'rendered stop-wheel shaft angle');
    near(blocks.driver.userData.angularSpeed,
      state.driverAngularSpeed, 0, 'rendered driver speed');
    near(blocks.stopWheel.userData.angularSpeed,
      state.stopWheelAngularSpeed, 0, 'rendered stop-wheel speed');
    assert.equal(blocks.terminalContactMarker.visible,
      state.atTerminalStop);
    near(
      radialDistanceToAxis(
        blocks.driverIndexTip.getWorldPosition(new THREE.Vector3()),
        new THREE.Vector3(
          geometry.driverCenter.x,
          geometry.driverCenter.y,
          0,
        ),
        Z_AXIS,
      ),
      1.52,
      2e-15,
      'driver white index remains rigid',
    );
    near(
      radialDistanceToAxis(
        blocks.stopWheelIndexTip.getWorldPosition(new THREE.Vector3()),
        new THREE.Vector3(
          geometry.stopWheelCenter.x,
          geometry.stopWheelCenter.y,
          0,
        ),
        Z_AXIS,
      ),
      1.405,
      2e-15,
      'stop-wheel white index remains rigid',
    );
    blocks.stopSectorEndpointMarkers.forEach((marker, index) => {
      near(
        radialDistanceToAxis(
          marker.getWorldPosition(new THREE.Vector3()),
          new THREE.Vector3(
            geometry.stopWheelCenter.x,
            geometry.stopWheelCenter.y,
            0,
          ),
          Z_AXIS,
        ),
        geometry.stopSectorRadius,
        1e-15,
        `convex-sector endpoint ${index} remains rigid`,
      );
    });
    sweptBounds.union(new THREE.Box3().setFromObject(model.root));
  }

  model.update(shown(canonicalTimes.firstIndexComplete));
  const firstLockedAngle = blocks.stopWheel.userData.rotor.rotation.z;
  const driverAtLockEntry = blocks.driver.userData.rotor.rotation.z;
  model.update(shown(canonicalTimes.firstLockedDwellMid));
  near(blocks.stopWheel.userData.rotor.rotation.z,
    firstLockedAngle, 0, 'stop wheel is stationary through the free turn');
  assert.notEqual(blocks.driver.userData.rotor.rotation.z,
    driverAtLockEntry, 'driver continues through the locked dwell');
  assert.equal(model.root.userData.contacts.lockingPocket.active, true);
  assert.equal(model.root.userData.contacts.windingFingerSlot, null);

  model.update(shown(canonicalTimes.terminalStop));
  model.root.updateMatrixWorld(true);
  assert.equal(model.root.userData.contacts.convexTerminalStop.blocked, true);
  assert.equal(model.root.userData.contacts.lockingPocket, null);
  assert.equal(model.root.userData.contacts.windingFingerSlot, null);
  vector3Near(
    blocks.terminalContactMarker.getWorldPosition(new THREE.Vector3()),
    new THREE.Vector3(
      geometry.terminalContactPoint.x,
      geometry.terminalContactPoint.y,
      blocks.terminalContactMarker.position.z,
    ),
    0,
    'terminal marker sits on the reconstructed tooth/sector contact',
  );

  const sweptSize = sweptBounds.getSize(new THREE.Vector3());
  assert.ok(sweptSize.x > 4.8, 'frame and both profiles fill real width');
  assert.ok(sweptSize.y > 6.8, 'two source-scale wheels fill real height');
  assert.ok(sweptSize.z > 1.5, 'shafts, profiles and highlights use depth without the undrawn frame');
  assert.ok(sweptBounds.min.x < -2.4);
  assert.ok(sweptBounds.max.x > 2.2);
  assert.ok(sweptBounds.min.y < -3.5);
  assert.ok(sweptBounds.max.y > 3.3);
  let meshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  // The undrawn frame and its loose shaft bearings are presented away.
  assert.ok(meshCount >= 15, 'the undrawn frame is presented away');
  const roles212 = [];
  model.root.traverse((object) => { if (object.isMesh && object.userData.role) roles212.push(object.userData.role); });
  assert.ok(!roles212.some((role) => /^fixed-(?:driver-A|stop-wheel-B)-bearing$/.test(role)),
    'no bearing ring hangs on a shaft without a frame');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const movement211 = createMovementModel(catalog.movements[210]);
  const movement213 = createMovementModel(catalog.movements[212]);
  assert.equal(catalog.movements[210].id, 211);
  assert.equal(catalog.movements[210].fidelity, 'authored');
  assert.equal(movement211.root.userData.fidelity, 'authored');
  assert.notEqual(movement211.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(catalog.movements[212].id, 213);
  assert.equal(catalog.movements[212].fidelity, 'authored');
  assert.equal(movement213.root.userData.fidelity, 'authored');
  assert.notEqual(movement213.root.userData.archetype,
    model.root.userData.archetype);
  disposeModel(movement211.root);
  disposeModel(movement213.root);
  disposeModel(model.root);
});
