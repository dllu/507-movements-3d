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

test('movement 213 is a single face-pin friction stop, not two meshing gears', () => {
  const movement = catalog.movements[212];
  const model = createMovementModel(movement);
  const {
    blocks,
    geometry,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 213);
  assert.equal(movement.number, '213');
  assert.equal(movement.title, 'Split-Rim Face-Pin Winding Stop');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'face-pin-indexed-five-tooth-split-rim-friction-winding-stop',
  );
  assert.match(movement.description, /same purpose/);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'one-face-pin-indexes-a-five-tooth-split-ring-once-per-winding-revolution-and-the-uncut-rim-stops-both-directions',
  );

  assert.deepEqual(blocks.driver.userData.axis.toArray(), [0, 0, 1]);
  assert.deepEqual(blocks.stopWheel.userData.axis.toArray(), [0, 0, 1]);
  assert.deepEqual(blocks.driverShaft.userData.axis.toArray(), [0, 0, 1]);
  assert.equal(blocks.driverBody.userData.ratchetToothCount, 22);
  assert.equal(blocks.driverBody.userData.directlyMeshesStopWheel, false);
  assert.equal(blocks.facePin.userData.onlyStopWheelDriver, true);
  assert.equal(blocks.stopWheelBody.userData.installedToothCount, 5);
  assert.equal(blocks.stopWheelBody.userData.selfHoldingSplitRing, true);
  assert.equal(blocks.driverBody.geometry.parameters.shapes.holes.length, 1);
  assert.equal(blocks.stopWheelBody.geometry.parameters.shapes.holes.length, 0);
  assert.equal(geometry.driverRatchetToothCount, 22);
  assert.equal(geometry.installedStopToothCount, 5);
  assert.equal(geometry.stopGapCount, 6);
  assert.equal(geometry.stopEquivalentToothCount, 22);
  assert.equal(geometry.stopToothArcs.length, 5);
  assert.equal(geometry.stopToothCenters.length, 5);
  assert.equal(blocks.stopToothHighlights.length, 5);
  assert.equal(blocks.stopShoulderHighlights.length, 2);
  // The ratchet runs just behind the split ring; the face pin bridges only that gap.
  assert.ok(geometry.axialClearance >= 0.02 && geometry.axialClearance <= 0.05);
  assert.equal(transmission.directRatchetToStopWheelMesh, false);
  assert.equal(transmission.frictionHeldBetweenIndexes, true);
  assert.equal(transmission.pinIndexesPerInputTurn, 1);
  assert.equal(
    transmission.direction,
    'opposite-only-while-the-single-face-pin-indexes',
  );

  const roles = [];
  let facePinCount = 0;
  let directlyMeshedStopMemberCount = 0;
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.onlyStopWheelDriver) facePinCount += 1;
    if (object.userData.directlyMeshesStopWheel === true) {
      directlyMeshedStopMemberCount += 1;
    }
  });
  assert.equal(facePinCount, 1);
  assert.equal(directlyMeshedStopMemberCount, 0);
  assert.ok(roles.includes('single-round-face-pin-indexing-driver'));
  assert.ok(roles.includes(
    'rear-plane-ratchet-wheel-not-meshed-to-stop-ring',
  ));
  assert.ok(roles.includes(
    'split-rim-five-teeth-six-gaps-and-uncut-stop-arc',
  ));
  assert.ok(roles.includes('fixed-friction-stud-drum-gripped-by-split-ring'));
  // The split ring grips the fixed stud: the stud fills the ring's bore.
  const drum = model.root.userData.blocks.frictionDrum;
  const bore = model.root.userData.geometry?.stopInnerRadius;
  if (Number.isFinite(bore)) {
    const gap = bore - drum.geometry.parameters.radiusTop;
    assert.ok(gap >= 0 && gap <= 0.003, `stud fills the split-ring bore (gap ${gap})`);
  }
  assert.equal(
    roles.some((role) => /belt|pulley|geneva-slot|continuous-gear-mesh/.test(
      role,
    )),
    false,
    'the source does not contain a belt, Geneva wheel, or direct gear pair',
  );
  disposeModel(model.root);
});

test('movement 213 reproduces the engraving proportions, five teeth, source pose, and two uncut-rim contacts', () => {
  const model = createMovementModel(catalog.movements[212]);
  const {
    canonicalStates,
    geometry,
    sourceAnchors,
    sourceAnimation,
    sourcePointToModel,
    sourceRaster,
    transmission,
  } = model.root.userData;

  near(geometry.centerDistance, 3.297133003437801, 0,
    'source-scaled center distance');
  near(geometry.facePinOrbitRadius, 1.4005801944058167, 0,
    'source-scaled face-pin orbit');
  near(geometry.facePinRadius, 0.156, 0,
    'source-scaled face-pin radius');
  near(geometry.stopOuterRadius, 2.1241262292, 0,
    'source-fitted uncut rim radius');
  near(geometry.stopInnerRadius, 1.0237758166000002, 0,
    'source-fitted split-ring inner radius');
  near(geometry.stopToothRootRadius, 1.7, 0,
    'source-fitted tooth-space root radius');
  near(geometry.stopPitchAngle, FULL_TURN / 22, 0,
    'five cut teeth preserve the observed 22-position pitch');
  near(
    geometry.stopSectorEndAngle - geometry.stopSectorStartAngle,
    6 * geometry.stopPitchAngle,
    2e-16,
    'six spaces span the entire partial-tooth sector',
  );
  geometry.stopToothCenters.forEach((angle, index) => {
    near(
      angle,
      -Math.PI / 2 + (index - 2) * geometry.stopPitchAngle,
      0,
      `source tooth center ${index + 1}`,
    );
  });
  assert.ok(geometry.stopOuterProfile.length > 1000);
  assert.equal(geometry.stopInnerProfile.length, 151);
  assert.equal(geometry.stopRingOutline.length, geometry.stopOuterProfile.length + geometry.stopInnerProfile.length);
  assert.equal(geometry.driverRatchetOutline.length, 66);
  assert.deepEqual(
    geometry.stopToothArcs.map((arc) => arc.length),
    [9, 9, 9, 9, 9],
  );

  near(
    geometry.entryContactPhase + geometry.exitContactPhase,
    Math.PI,
    0,
    'pin/rim intersection phases are mirror images about top dead center',
  );
  near(
    geometry.activeIndexInputAngle + geometry.freeApproachInputAngle,
    FULL_TURN,
    0,
    'one active interval and one free interval make each input turn',
  );
  assert.ok(geometry.sourceFacePinPhase > geometry.entryContactPhase);
  assert.ok(geometry.sourceFacePinPhase < geometry.exitContactPhase);
  assert.ok(geometry.sourceActiveProgress > 0.658);
  assert.ok(geometry.sourceActiveProgress < 0.659);
  assert.ok(geometry.sourceIndexProgress > 0.777);
  assert.ok(geometry.sourceIndexProgress < 0.778);
  assert.ok(Math.abs(canonicalStates.sourcePose.stopWheelAngle) < 0.05, 'finite contact changes source tooth orientation by less than three degrees');
  assert.equal(canonicalStates.sourcePose.activeIndex, 3);
  assert.equal(canonicalStates.sourcePose.engagement.active, true);
  vector3Near(
    sourcePointToModel(sourceAnchors.facePinCenter),
    new THREE.Vector3(
      canonicalStates.sourcePose.engagement.pinCenter.x,
      canonicalStates.sourcePose.engagement.pinCenter.y,
      0,
    ),
    2e-15,
    'the modeled face pin passes through its fitted engraving center',
  );

  for (const [side, pinCenter, contactPoint, normal] of [
    [
      'initial',
      geometry.initialFacePinCenter,
      geometry.initialStopContactPoint,
      geometry.initialStopNormal,
    ],
    [
      'final',
      geometry.finalFacePinCenter,
      geometry.finalStopContactPoint,
      geometry.finalStopNormal,
    ],
  ]) {
    near(contactPoint.distanceTo(geometry.stopWheelCenter),
      geometry.stopOuterRadius, 5e-16,
      `${side} contact lies on the uncut stop rim`);
    near(contactPoint.distanceTo(pinCenter), geometry.facePinRadius, 4e-15,
      `${side} contact lies on the face-pin circumference`);
    near(normal.length(), 1, 2e-16, `${side} stop normal is normalized`);
  }
  assert.ok(geometry.initialUncutRimMarginAngle > 0.28);
  assert.ok(geometry.finalUncutRimMarginAngle > 0.13);
  assert.ok(geometry.initialBlockedReverseClosingRate > 1.13);
  assert.ok(geometry.finalBlockedForwardClosingRate > 1.13);
  near(
    geometry.initialStopWheelAngle - geometry.finalStopWheelAngle,
    5 * geometry.stopPitchAngle - geometry.reversalTakeup,
    5e-16,
    'five pin engagements move the split ring through five pitches',
  );
  near(transmission.outputTravelAngle, 5 * FULL_TURN / 22 - geometry.reversalTakeup, 5e-16,
    'finite split-ring output travel');
  near(transmission.inputTurnsBetweenStops, 5.809692771901795, 0,
    'five indexes plus the final free approach between end stops');

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.engravingHasStaticSourcePoseOnly, true);
  assert.equal(sourceAnimation.runtimeUsesContinuousReverseReturn, true);
  assert.equal(sourceRaster.width, 525);
  assert.equal(sourceRaster.height, 525);
  assert.equal(sourceRaster.observedDriverRatchetToothCount, 22);
  assert.equal(sourceRaster.observedStopToothCount, 5);
  assert.equal(sourceRaster.observedStopGapCount, 6);
  assert.equal(sourceRaster.sourceUrl,
    'https://507movements.com/mm_213.html');
  vector2Near(sourceAnchors.modeledDriverCenter,
    sourceAnchors.driverCenter, 0, 'source driver center maps exactly');
  vector2Near(sourceAnchors.modeledStopWheelCenter,
    sourceAnchors.stopWheelCenter, 0,
    'source stop-wheel center maps exactly');
  vector2Near(sourceAnchors.modeledFacePinAtSource,
    sourceAnchors.facePinCenter, 6e-14,
    'source face-pin center maps exactly');
  disposeModel(model.root);
});

test('movement 213 preserves five intermittent indexes, friction dwells, reversal, and both limits through 32,769 states', () => {
  const model = createMovementModel(catalog.movements[212]);
  const {
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const sampleCount = 32768;
  const directions = new Set();
  const stages = new Set();
  const activeIndexes = new Set();
  let maximumRateError = 0;
  let minimumInput = Infinity;
  let maximumInput = -Infinity;
  let minimumOutput = Infinity;
  let maximumOutput = -Infinity;
  let initialStopStateCount = 0;
  let finalStopStateCount = 0;
  let previous = null;

  for (let index = 0; index <= sampleCount; index += 1) {
    const state = stateAtTime(
      timeline.demonstrationPeriod * index / sampleCount,
    );
    finiteStateNumbers(state);
    directions.add(state.demonstrationDirection);
    stages.add(state.stage);
    minimumInput = Math.min(minimumInput, state.inputTravel);
    maximumInput = Math.max(maximumInput, state.inputTravel);
    minimumOutput = Math.min(minimumOutput, state.stopWheelAngle);
    maximumOutput = Math.max(maximumOutput, state.stopWheelAngle);
    assert.ok(state.inputTravel >= -1e-15);
    assert.ok(state.inputTravel <= geometry.forwardInputLimit + 1e-14);
    assert.ok(state.stopWheelAngle
      >= geometry.finalStopWheelAngle - 2e-15);
    assert.ok(state.stopWheelAngle
      <= geometry.initialStopWheelAngle + 2e-15);
    maximumRateError = Math.max(
      maximumRateError,
      Math.abs(
        state.stopWheelAngularSpeed
          - state.engagement.instantaneousRatio
            * state.driverAngularSpeed,
      ),
    );

    assert.equal(
      state.frictionRetention.active,
      !state.engagement.active,
      'the split-ring friction hold releases only during pin engagement',
    );
    if (state.engagement.active) {
      activeIndexes.add(state.activeIndex);
      assert.ok(state.engagement.inputProgress > 0);
      assert.ok(state.engagement.inputProgress <= 1);
      assert.ok(state.engagement.outputProgress > 0);
      assert.ok(state.engagement.outputProgress <= 1);
      assert.ok(state.engagement.instantaneousRatio <= 0);
      assert.equal(state.activeIndex, state.completedIndexes + 1);
    } else {
      near(state.stopWheelAngularSpeed, 0, 0,
        'the friction-held split ring has zero angular speed');
      near(state.stopWheelAngularAcceleration, 0, 0,
        'the friction-held split ring has zero angular acceleration');
    }
    if (state.atInitialStop) {
      initialStopStateCount += 1;
      near(state.inputTravel, 0, 0, 'initial stop clamps input travel');
      assert.equal(state.limit.stopContact.side, 'initial');
      assert.equal(state.limit.stopContact.blockedDirection, 'reverse');
    }
    if (state.atFinalStop) {
      finalStopStateCount += 1;
      near(state.inputTravel, geometry.forwardInputLimit, 0,
        'final stop clamps input travel');
      assert.equal(state.limit.stopContact.side, 'final');
      assert.equal(state.limit.stopContact.blockedDirection, 'forward');
    }

    if (previous
      && previous.demonstrationDirection === state.demonstrationDirection) {
      if (state.demonstrationDirection === 'winding-toward-final-stop') {
        assert.ok(state.inputTravel >= previous.inputTravel - 3e-14);
        assert.ok(state.stopWheelAngle
          <= previous.stopWheelAngle + 3e-14);
      } else if (state.demonstrationDirection
        === 'running-down-toward-initial-stop') {
        assert.ok(state.inputTravel <= previous.inputTravel + 3e-14);
        assert.ok(state.stopWheelAngle
          >= previous.stopWheelAngle - 3e-14);
      } else {
        near(state.inputTravel, previous.inputTravel, 0,
          'a hard-stop hold has no input motion');
        near(state.stopWheelAngle, previous.stopWheelAngle, 0,
          'a hard-stop hold has no output motion');
      }
    }
    previous = state;
  }

  near(minimumInput, 0, 0, 'minimum finite input travel');
  near(maximumInput, geometry.forwardInputLimit, 0,
    'maximum finite input travel');
  near(minimumOutput, geometry.finalStopWheelAngle, 1e-15,
    'minimum split-ring angle');
  near(maximumOutput, geometry.initialStopWheelAngle, 1e-15,
    'maximum split-ring angle');
  near(maximumRateError, 0, 0,
    'every output rate follows the active pin-contact ratio');
  assert.deepEqual([...activeIndexes].sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual([...directions].sort(), [
    'held-at-final-stop',
    'held-at-initial-stop',
    'running-down-toward-initial-stop',
    'winding-toward-final-stop',
  ]);
  assert.ok(stages.has('initial-uncut-rim-hard-stop'));
  assert.ok(stages.has('final-uncut-rim-hard-stop'));
  assert.ok(stages.has('friction-held-before-first-index'));
  assert.ok(stages.has('friction-held-final-rim-approach'));
  for (let index = 1; index <= 5; index += 1) {
    assert.ok(stages.has(`face-pin-indexes-stop-tooth-${index}`));
    if (index < 5) {
      assert.ok(stages.has(`friction-held-after-index-${index}`));
    }
  }
  assert.ok(initialStopStateCount > 900);
  assert.ok(finalStopStateCount > 1100);
  disposeModel(model.root);
});

test('movement 213 has continuous rates, retained source timing, reversible run-down, and clamped overtravel', () => {
  const model = createMovementModel(catalog.movements[212]);
  const {
    canonicalStates,
    canonicalTimes,
    geometry,
    inputStateAtTime,
    stateAtInputTravel,
    stateAtTime,
    timeline,
  } = model.root.userData;

  near(timeline.demonstrationPeriod, 38.5, 0,
    'continuous stop-to-stop-and-back period');
  near(timeline.forwardMotionStart, 1.1, 0, 'initial hold duration');
  near(timeline.forwardMotionEnd, 19.1, 0, 'forward traverse end');
  near(timeline.reverseMotionStart, 20.5, 0, 'reverse traverse start');
  assert.equal(canonicalStates.initialStop.atInitialStop, true);
  assert.equal(canonicalStates.finalStop.atFinalStop, true);
  assert.equal(canonicalStates.finalStopMidHold.atFinalStop, true);
  assert.equal(canonicalStates.sourcePose.activeIndex, 3);
  near(canonicalStates.sourcePose.inputTravel,
    geometry.sourceInputTravel, 4e-15, 'source input pose');
  assert.ok(Math.abs(canonicalStates.sourcePose.stopWheelAngle) < 0.05, 'source split-ring orientation remains close');
  near(canonicalStates.cycleClosure.inputTravel, 0, 0,
    'cycle closes without an input reset jump');
  near(canonicalStates.cycleClosure.stopWheelAngle,
    geometry.initialStopWheelAngle, 0,
    'cycle closes without a split-ring reset jump');

  for (let index = 1; index <= 5; index += 1) {
    const mid = canonicalStates[`index${index}Mid`];
    const complete = canonicalStates[`index${index}Complete`];
    assert.equal(mid.activeIndex, index);
    near(mid.engagement.inputProgress, 0.5, 3e-14,
      `index ${index} input midpoint`);
    assert.ok(mid.engagement.outputProgress > .45 && mid.engagement.outputProgress < .55, `index ${index} passes near the half-pitch position`);
    near(complete.inputTravel, index * FULL_TURN, 7e-15,
      `index ${index} completes at one more input revolution`);
    near(
      complete.stopWheelAngle,
      geometry.initialStopWheelAngle + geometry.reversalTakeup - index * geometry.stopPitchAngle,
      8e-16,
      `index ${index} advances exactly one stop-wheel pitch`,
    );
    assert.equal(complete.engagement.active, false);
    assert.equal(complete.frictionRetention.active, true);
  }

  const differenceStep = 0.00001;
  let maximumDriverVelocityError = 0;
  let maximumDriverAccelerationError = 0;
  let maximumStopVelocityError = 0;
  let maximumStopAccelerationError = 0;
  for (let index = 1; index <= 5; index += 1) {
    const time = canonicalTimes[`index${index}Mid`];
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
    maximumDriverAccelerationError = Math.max(
      maximumDriverAccelerationError,
      Math.abs(
        (next.driverAngularSpeed - previous.driverAngularSpeed)
          / (2 * differenceStep) - state.driverAngularAcceleration,
      ),
    );
    maximumStopVelocityError = Math.max(
      maximumStopVelocityError,
      Math.abs(
        (next.stopWheelAngle - previous.stopWheelAngle)
          / (2 * differenceStep) - state.stopWheelAngularSpeed,
      ),
    );
    maximumStopAccelerationError = Math.max(
      maximumStopAccelerationError,
      Math.abs(
        (next.stopWheelAngularSpeed - previous.stopWheelAngularSpeed)
          / (2 * differenceStep) - state.stopWheelAngularAcceleration,
      ),
    );
  }
  assert.ok(maximumDriverVelocityError < 2e-9);
  assert.ok(maximumDriverAccelerationError < 7e-9);
  // The contact bake is C1 piecewise cubic. These midpoints remain inside
  // individual cells; finite differencing has truncation error above roundoff.
  assert.ok(maximumStopVelocityError < 5e-8);
  let coarseVelocityError = 0;
  for (let index = 1; index <= 5; index += 1) {
    const time = canonicalTimes[`index${index}Mid`], h = 1e-4;
    const measured = (stateAtTime(time + h).stopWheelAngle
      - stateAtTime(time - h).stopWheelAngle) / (2 * h);
    coarseVelocityError = Math.max(coarseVelocityError,
      Math.abs(measured - stateAtTime(time).stopWheelAngularSpeed));
  }
  assert.ok(maximumStopVelocityError < coarseVelocityError / 50,
    'velocity difference converges quadratically away from interpolation knots');
  assert.ok(maximumStopAccelerationError < 8e-8);

  for (const forwardTime of [
    timeline.forwardMotionStart,
    canonicalTimes.firstIndexMid,
    canonicalTimes.sourcePose,
    canonicalTimes.fifthIndexComplete,
    canonicalTimes.finalApproachMid,
    timeline.forwardMotionEnd,
  ]) {
    const forward = stateAtTime(forwardTime);
    const reverse = stateAtTime(
      timeline.reverseMotionStart
        + timeline.forwardMotionEnd - forwardTime,
    );
    near(reverse.inputTravel, forward.inputTravel, 5e-14,
      'reverse path retraces the exact input pose');
    assert.ok(Math.abs(reverse.stopWheelAngle-forward.stopWheelAngle)<.04, 'reverse retaining face includes finite take-up');
    near(reverse.driverAngularSpeed, -forward.driverAngularSpeed, 2e-14,
      'reverse input speed changes sign');
    assert.ok(reverse.stopWheelAngularSpeed >= -1e-12 && forward.stopWheelAngularSpeed <= 1e-12, 'each retaining branch follows its input direction');
  }

  for (const time of [
    0,
    timeline.forwardMotionStart,
    timeline.forwardMotionEnd,
    timeline.reverseMotionStart,
    timeline.demonstrationPeriod,
  ]) {
    const input = inputStateAtTime(time);
    near(input.angularSpeed, 0, 3e-27,
      'each hold/reversal boundary has zero input velocity');
    near(input.angularAcceleration, 0, 3e-14,
      'each hold/reversal boundary has zero input acceleration');
  }

  const initialOvertravel = stateAtInputTravel(-2, -1);
  near(initialOvertravel.inputTravel, 0, 0,
    'reverse overtravel is clamped at the initial stop');
  near(initialOvertravel.driverAngularSpeed, 0, 0,
    'reverse speed is removed at the initial stop');
  near(initialOvertravel.limit.initialUndertravelPrevented, 2, 0,
    'prevented reverse overtravel is reported');
  assert.equal(initialOvertravel.atInitialStop, true);
  const leavingInitial = stateAtInputTravel(0, 1);
  assert.equal(leavingInitial.atInitialStop, false);
  near(leavingInitial.driverAngularSpeed, 1, 0,
    'the allowed direction can leave the initial stop');

  const finalOvertravel = stateAtInputTravel(
    geometry.forwardInputLimit + 2,
    1,
  );
  near(finalOvertravel.inputTravel, geometry.forwardInputLimit, 0,
    'forward overtravel is clamped at the final stop');
  near(finalOvertravel.driverAngularSpeed, 0, 0,
    'forward speed is removed at the final stop');
  near(finalOvertravel.limit.overtravelPrevented, 2, 4e-15,
    'prevented forward overtravel is reported');
  assert.equal(finalOvertravel.atFinalStop, true);
  const leavingFinal = stateAtInputTravel(
    geometry.forwardInputLimit,
    -1,
  );
  assert.equal(leavingFinal.atFinalStop, false);
  near(leavingFinal.driverAngularSpeed, -1, 0,
    'the reverse direction can leave the final stop');
  disposeModel(model.root);
});

test('movement 213 renders the separated planes, pin contacts, rigid indices, and differs from authored movement 214', () => {
  const model = createMovementModel(catalog.movements[212]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const renderedTimes = [
    canonicalTimes.initialStop,
    canonicalTimes.index1Mid,
    canonicalTimes.index2Mid,
    canonicalTimes.sourcePose,
    canonicalTimes.index4Mid,
    canonicalTimes.index5Mid,
    canonicalTimes.fifthIndexComplete,
    canonicalTimes.finalApproachMid,
    canonicalTimes.finalStop,
    canonicalTimes.finalStopMidHold,
    canonicalTimes.unwindFromFinalStop,
    canonicalTimes.cycleClosure,
  ];
  const sweptBounds = new THREE.Box3();

  // The display loop opens at Brown's pose; phase time = display time + offset.
  const displayTime = (time) => time - model.root.userData.displayTimeOffset;
  near(model.root.userData.displayTimeOffset, canonicalTimes.sourcePose, 0,
    'the display opens at the engraving pose');
  for (const time of renderedTimes) {
    const state = stateAtTime(time);
    model.update(displayTime(time));
    model.root.updateMatrixWorld(true);
    near(blocks.driver.userData.rotor.rotation.z,
      state.driverAngle, 0, 'rendered winding-ratchet angle');
    near(blocks.driverShaft.userData.rotor.rotation.z,
      state.driverAngle, 0, 'rendered winding-arbor angle');
    near(blocks.stopWheel.userData.rotor.rotation.z,
      state.stopWheelAngle, 0, 'rendered split-stop-wheel angle');
    near(blocks.driver.userData.angularSpeed,
      state.driverAngularSpeed, 0, 'rendered winding-ratchet speed');
    near(blocks.stopWheel.userData.angularSpeed,
      state.stopWheelAngularSpeed, 0, 'rendered split-ring speed');
    assert.equal(blocks.activeContactMarker.visible,
      state.engagement.active);
    assert.equal(blocks.stopContactMarker.visible,
      state.atInitialStop || state.atFinalStop);
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
      1.29,
      8e-16,
      'driver white speed index remains rigid',
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
      1.8,
      8e-16,
      'stop-wheel white speed index remains rigid',
    );
    const renderedPinCenter = blocks.facePin.getWorldPosition(
      new THREE.Vector3(),
    );
    vector2Near(
      new THREE.Vector2(renderedPinCenter.x, renderedPinCenter.y),
      state.engagement.pinCenter,
      8e-15,
      'the only driving face pin follows the winding ratchet',
    );
    sweptBounds.union(new THREE.Box3().setFromObject(model.root));
  }

  model.update(displayTime(canonicalTimes.sourcePose));
  model.root.updateMatrixWorld(true);
  assert.equal(model.root.userData.contacts.directRatchetToStopWheelMesh,
    null);
  assert.equal(model.root.userData.contacts.facePinTooth.toothIndex, 3);
  assert.equal(model.root.userData.contacts.selfHoldingSplitRingFriction,
    null);
  vector3Near(
    blocks.activeContactMarker.getWorldPosition(new THREE.Vector3()),
    new THREE.Vector3(
      model.root.userData.contacts.facePinTooth.contactPoint.x,
      model.root.userData.contacts.facePinTooth.contactPoint.y,
      blocks.activeContactMarker.position.z,
    ),
    0,
    'active marker sits on the moving face-pin/tooth contact',
  );

  model.update(displayTime(canonicalTimes.fifthIndexComplete));
  assert.equal(model.root.userData.contacts.facePinTooth, null);
  assert.equal(
    model.root.userData.contacts.selfHoldingSplitRingFriction.active,
    true,
  );
  model.update(displayTime(canonicalTimes.finalStop));
  model.root.updateMatrixWorld(true);
  assert.equal(model.root.userData.contacts.finalUncutRimStop.side, 'final');
  assert.equal(model.root.userData.contacts.initialUncutRimStop, null);
  vector3Near(
    blocks.stopContactMarker.getWorldPosition(new THREE.Vector3()),
    new THREE.Vector3(
      geometry.finalStopContactPoint.x,
      geometry.finalStopContactPoint.y,
      blocks.stopContactMarker.position.z,
    ),
    0,
    'final marker sits on the exact pin/uncut-rim contact',
  );

  const driverBodyBounds = new THREE.Box3().setFromObject(blocks.driverBody);
  const stopBodyBounds = new THREE.Box3().setFromObject(blocks.stopWheelBody);
  const pinBounds = new THREE.Box3().setFromObject(blocks.facePin);
  assert.ok(driverBodyBounds.max.z < stopBodyBounds.min.z,
    'the rear ratchet and front split ring occupy disjoint axial planes');
  near(
    stopBodyBounds.min.z - driverBodyBounds.max.z,
    geometry.axialClearance,
    5e-9,
    'the rendered axial clearance matches the construction',
  );
  assert.ok(pinBounds.min.z < driverBodyBounds.max.z);
  assert.ok(pinBounds.max.z > stopBodyBounds.min.z,
    'only the projecting face pin bridges the two axial planes');

  const sweptSize = sweptBounds.getSize(new THREE.Vector3());
  assert.ok(sweptSize.x > 5.6);
  assert.ok(sweptSize.y > 7.2);
  assert.ok(sweptSize.z > 1.7, 'the separated planes use depth without the undrawn frame');
  // Pass 54 removed the two orphaned rear bearing tori too, so a mesh-count
  // floor no longer describes the design. Check the parts themselves: the
  // undrawn frame, bearings, white indices and contact markers are out of
  // the presented tree, and every mesh left in it is either a working part
  // or a hidden retired outline.
  const presented = (object) => {
    for (let parent = object; parent; parent = parent.parent) {
      if (parent === model.root) return true;
    }
    return false;
  };
  for (const removed of [blocks.baseRail, blocks.upright, ...blocks.bearingArms,
    ...blocks.bearings, ...blocks.feet, blocks.driverIndex, blocks.stopWheelIndex,
    blocks.activeContactMarker, blocks.stopContactMarker]) {
    assert.equal(presented(removed), false,
      `the undrawn frame, white indices and contact markers are presented away (${removed.userData.role})`);
  }
  model.root.traverse((object) => {
    if (object.isMesh && /speed-index|motion-index|contact-marker|base-rail|bearing-upright|bearing-arm|transverse-foot/.test(object.userData.role ?? '')) {
      assert.equal(object.visible, false, `${object.userData.role} is not presented`);
    }
  });
  for (const part of [blocks.driverBody, blocks.facePin, blocks.stopWheelBody, blocks.frictionDrum]) {
    assert.ok(presented(part) && part.visible, `${part.userData.role} stays presented`);
  }
  // The dark ratchet outline Brown only inks is retired.
  assert.equal(blocks.stopWheelOutline.visible, false);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const movement212 = createMovementModel(catalog.movements[211]);
  const movement214 = createMovementModel(catalog.movements[213]);
  assert.equal(catalog.movements[211].id, 212);
  assert.equal(catalog.movements[211].fidelity, 'authored');
  assert.equal(movement212.root.userData.fidelity, 'authored');
  assert.notEqual(movement212.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(catalog.movements[213].id, 214);
  assert.equal(catalog.movements[213].fidelity, 'authored');
  assert.equal(movement214.root.userData.fidelity, 'authored');
  assert.notEqual(movement214.root.userData.archetype,
    model.root.userData.archetype);
  disposeModel(movement212.root);
  disposeModel(movement214.root);
  disposeModel(model.root);
});
