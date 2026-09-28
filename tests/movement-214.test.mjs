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

function cross(a, b, c) {
  return (b.x - a.x) * (c.y - a.y)
    - (b.y - a.y) * (c.x - a.x);
}

function properSegmentIntersection(a, b, c, d) {
  const first = cross(a, b, c);
  const second = cross(a, b, d);
  const third = cross(c, d, a);
  const fourth = cross(c, d, b);
  return first * second < -1e-16 && third * fourth < -1e-16;
}

function pointInsideTriangle(point, triangle) {
  const signs = triangle.map((vertex, index) => cross(
    vertex,
    triangle[(index + 1) % triangle.length],
    point,
  ));
  return signs.every((value) => value > 1e-10)
    || signs.every((value) => value < -1e-10);
}

function trianglesProperlyOverlap(first, second) {
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    for (let secondIndex = 0;
      secondIndex < second.length;
      secondIndex += 1) {
      if (properSegmentIntersection(
        first[firstIndex],
        first[(firstIndex + 1) % first.length],
        second[secondIndex],
        second[(secondIndex + 1) % second.length],
      )) return true;
    }
  }
  return pointInsideTriangle(first[0], second)
    || pointInsideTriangle(second[0], first);
}

test('movement 214 is the source ten-to-twelve gear-finger stop, not a generic intermittent draft', () => {
  const movement = catalog.movements[213];
  const model = createMovementModel(movement);
  const { blocks, geometry, transmission } = model.root.userData;

  assert.equal(movement.id, 214);
  assert.equal(movement.number, '214');
  assert.equal(movement.title, 'Ten-to-Twelve Gear-Finger Winding Stop');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'ten-tooth-twelve-tooth-opposed-finger-winding-stop',
  );
  assert.match(movement.description, /comparison with 212/);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'ten-tooth-input-counter-rotates-a-twelve-tooth-wheel-at-five-sixths-speed-until-one-finger-point-meets-the-other-finger-flank',
  );
  assert.equal(transmission.driverTeeth, 10);
  assert.equal(transmission.drivenTeeth, 12);
  near(transmission.gearRatio, -5 / 6, 0, 'external gear ratio');
  assert.equal(
    transmission.speedRelationship,
    'omega_driven=-(10/12)*omega_driver',
  );
  assert.equal(
    transmission.direction,
    'opposite-through-the-entire-free-travel',
  );

  assert.equal(blocks.driver.userData.teeth, 10);
  assert.equal(blocks.driven.userData.teeth, 12);
  assert.equal(blocks.driverAssembly.gearBody.userData.teeth, 10);
  assert.equal(blocks.drivenAssembly.gearBody.userData.teeth, 12);
  assert.equal(
    blocks.driverAssembly.fingerBody.userData.integralStopFinger,
    true,
  );
  assert.equal(
    blocks.drivenAssembly.fingerBody.userData.integralStopFinger,
    true,
  );
  assert.equal(geometry.driverGearOutline.length, 10 * 19);
  assert.equal(geometry.drivenGearOutline.length, 12 * 19);
  // Brown's teardrops: tangent point, point, tangent point, then the boss arc.
  assert.equal(geometry.driverFingerLocal.length, 83);
  assert.equal(geometry.drivenFingerLocal.length, 83);
  assert.equal(geometry.driverBoreLocal.length, 4);
  assert.equal(geometry.drivenBoreLocal.length, 4);
  assert.equal(
    blocks.driverAssembly.gearBody.geometry.parameters.shapes.holes.length,
    1,
  );
  assert.equal(
    blocks.drivenAssembly.gearBody.geometry.parameters.shapes.holes.length,
    1,
  );

  const roles = [];
  let integralFingerCount = 0;
  let tenToTwelveMeshCount = 0;
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.integralStopFinger) integralFingerCount += 1;
    if (object.userData.role === 'constant-ten-to-twelve-tooth-mesh-contact') {
      tenToTwelveMeshCount += 1;
    }
  });
  assert.equal(integralFingerCount, 2);
  assert.equal(tenToTwelveMeshCount, 1);
  assert.ok(roles.includes(
    'right-ten-tooth-winding-input-integral-rigid-stop-finger',
  ));
  assert.ok(roles.includes(
    'left-twelve-tooth-stop-counterwheel-integral-rigid-stop-finger',
  ));
  assert.equal(
    roles.some((role) => /belt|pulley|geneva-slot|pawl|ratchet/.test(role)),
    false,
    'Movement 214 contains one continuous spur mesh and no substitute drive',
  );
  disposeModel(model.root);
});

test('movement 214 reproduces the official dimensions, phases, six half-turn track, and both rigid flank contacts', () => {
  const model = createMovementModel(catalog.movements[213]);
  const {
    geometry,
    modelPointToSourceAnimation,
    sourceAnimation,
    sourceAnimationPointToModel,
    sourceAnimationPointToRaster,
    sourceRaster,
    transmission,
  } = model.root.userData;

  near(geometry.sourceScale, 0.48, 0, 'source construction scale');
  near(geometry.centerDistance, 5.28, 1e-15, 'source-scaled center distance');
  vector2Near(geometry.driverCenter, new THREE.Vector2(2.64, 0), 5e-16,
    'right input center');
  vector2Near(geometry.drivenCenter, new THREE.Vector2(-2.64, 0), 5e-16,
    'left counterwheel center');
  near(geometry.driverPitchRadius, 2.4, 5e-16, 'ten-tooth pitch radius');
  near(geometry.drivenPitchRadius, 2.88, 5e-16,
    'twelve-tooth pitch radius');
  near(
    geometry.driverPitchRadius + geometry.drivenPitchRadius,
    geometry.centerDistance,
    1e-15,
    'pitch circles are tangent',
  );
  // Brown's short square teeth: 0.30 addendum and 0.36 dedendum on the site
  // construction's pitch circles (its deeper 3.75/6 radii are retained as
  // sourceDriverRootRadius and sourceDriverOuterRadius).
  near(geometry.driverRootRadius, 2.4 - 0.36, 1e-9, 'input root radius');
  near(geometry.drivenRootRadius, 2.88 - 0.36, 1e-9,
    'counterwheel root radius');
  near(geometry.driverOuterRadius, 2.4 + 0.3, 1e-9,
    'input addendum radius');
  near(geometry.drivenOuterRadius, 2.88 + 0.3, 1e-9,
    'counterwheel addendum radius');
  near(
    geometry.sourceDriverToothCenterPhase,
    THREE.MathUtils.degToRad(18),
    0,
    'input source tooth phase',
  );
  near(geometry.sourceDrivenToothCenterPhase, 0, 0,
    'counterwheel source tooth phase');

  const driverRadii = geometry.driverGearOutline.map((point) => point.length());
  const drivenRadii = geometry.drivenGearOutline.map((point) => point.length());
  near(Math.min(...driverRadii), geometry.driverRootRadius, 1e-9,
    'input outline root circle');
  near(Math.max(...driverRadii), geometry.driverOuterRadius, 1e-9,
    'input outline addendum circle');
  near(Math.min(...drivenRadii), geometry.drivenRootRadius, 1e-9,
    'counterwheel outline root circle');
  near(Math.max(...drivenRadii), geometry.drivenOuterRadius, 1e-9,
    'counterwheel outline addendum circle');

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.durationSeconds, 8);
  assert.equal(sourceAnimation.terminalHoldSeconds, 2);
  assert.equal(sourceAnimation.driverHalfTurnsBeforeStop, 6);
  assert.equal(sourceAnimation.driverTurnsBeforeStop, 3);
  near(sourceAnimation.normalizedTerminalPosition, 0.75, 0,
    'source terminal cpos');
  assert.equal(sourceAnimation.keyframes.length, 8);
  sourceAnimation.keyframes.forEach((keyframe, index) => {
    const workingIndex = Math.min(index, 6);
    near(keyframe.cpos, index === 7 ? 1 : index / 8, 0,
      `source keyframe ${index} cpos`);
    near(keyframe.driverAngle, workingIndex * Math.PI, 0,
      `source keyframe ${index} input angle`);
    near(
      keyframe.drivenAngle,
      -workingIndex * THREE.MathUtils.degToRad(150),
      3e-15,
      `source keyframe ${index} output angle`,
    );
  });
  assert.equal(sourceAnimation.officialLoopResetsDiscontinuously, true);
  assert.equal(sourceAnimation.runtimeAddsContinuousReverseDemonstration, true);

  vector2Near(sourceRaster.fittedDrivenCenter,
    new THREE.Vector2(166.25, 262.5), 0, 'animation-raster left center');
  vector2Near(sourceRaster.fittedDriverCenter,
    new THREE.Vector2(358.75, 262.5), 0, 'animation-raster right center');
  near(sourceRaster.fittedDrivenOuterRadius, 122.5, 0,
    'animation-raster left radius');
  near(sourceRaster.fittedDriverOuterRadius, 105, 0,
    'animation-raster right radius');
  assert.equal(
    sourceRaster.sourceUrl,
    'https://507movements.com/mm_214.html',
  );
  const arbitrarySourcePoint = new THREE.Vector2(4.125, -3.75);
  const modeledPoint = sourceAnimationPointToModel(arbitrarySourcePoint);
  vector2Near(
    modelPointToSourceAnimation(modeledPoint),
    arbitrarySourcePoint,
    9e-16,
    'source/model transforms are inverse',
  );
  vector2Near(
    sourceAnimationPointToRaster(geometry.sourceDrivenCenter),
    sourceRaster.fittedDrivenCenter,
    0,
    'source point maps to raster center',
  );

  // From the plate pose Brown's teardrops meet 1.33 input turns forward and
  // 4.47 turns back: one blocking encounter approached from both sides,
  // short of the six-turn relative period. (The site's triangles, from its
  // own start pose, met after exactly three turns.)
  near(geometry.forwardInputLimit, 8.325470045045869, 1e-12,
    'plate-finger forward stop');
  near(
    geometry.reverseInputLimit,
    -28.103004129716965,
    1e-12,
    'opposite-flank reverse stop',
  );
  near(
    transmission.inputTurnsBetweenStops,
    5.797771734208958,
    1e-12,
    'finite input travel between finger flanks',
  );
  assert.ok(transmission.inputTurnsBetweenStops < 6,
    'the stops fall inside one relative period');
  near(transmission.forwardInputTurnsFromSourcePose, 1.3250397112325545,
    1e-12, 'forward plate-pose travel');
  near(
    transmission.reverseInputTurnsFromSourcePose,
    4.472732022976404,
    1e-12,
    'reverse plate-pose travel',
  );

  for (const [side, contact, expectedAlong, expectedRate] of [
    [
      'forward',
      geometry.forwardStopContact,
      0.829994826159767,
      1.629779340928117,
    ],
    [
      'reverse',
      geometry.reverseStopContact,
      0.7787458820710101,
      1.7510135266740612,
    ],
  ]) {
    assert.equal(contact.side, side);
    assert.deepEqual([contact.tipMember, contact.flankMember],
      side === 'forward' ? ['driver', 'driven'] : ['driven', 'driver']);
    near(contact.alongFlank, expectedAlong, 1e-12,
      `${side} contact lies within the intended straight flank`);
    assert.ok(contact.alongFlank > 0);
    assert.ok(contact.alongFlank < 1);
    near(contact.normal.length(), 1, 2e-16,
      `${side} contact normal is unit length`);
    near(contact.tangent.length(), 1, 2e-16,
      `${side} contact tangent is unit length`);
    near(contact.normal.dot(contact.tangent), 0, 2e-16,
      `${side} contact frame is orthogonal`);
    // The round end (radius 0.18) touches the other finger's flank.
    near(contact.tip.distanceTo(contact.projectedPoint), contact.tipRadius, 4e-7,
      `${side} finger end reaches the other finger's flank`);
    near(contact.tipRadius, 0.18, 0, `${side} finger end is rounded`);
    near(
      side === 'forward'
        ? geometry.forwardBlockedClosingRate
        : geometry.reverseBlockedClosingRate,
      expectedRate,
      2e-9,
      `${side} blocked-direction closing rate`,
    );
  }
  disposeModel(model.root);
});

test('movement 214 maintains the exact external-gear law and collision-free finger travel through 32,769 states', () => {
  const model = createMovementModel(catalog.movements[213]);
  const {
    fingerGeometryAtInputTravel,
    geometry,
    stateAtInputTravel,
    transmission,
  } = model.root.userData;
  const sampleCount = 32768;
  let previousDrivenAngle = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= sampleCount; index += 1) {
    const fraction = index / sampleCount;
    const inputTravel = THREE.MathUtils.lerp(
      geometry.reverseInputLimit,
      geometry.forwardInputLimit,
      fraction,
    );
    const driverAngularSpeed = 0.72 + 0.21 * Math.cos(fraction * FULL_TURN);
    const driverAngularAcceleration = -0.19 * Math.sin(
      fraction * FULL_TURN,
    );
    const state = stateAtInputTravel(
      inputTravel,
      driverAngularSpeed,
      driverAngularAcceleration,
    );
    finiteStateNumbers(state, `state[${index}]`);
    near(state.inputTravel, inputTravel, 4e-15,
      `unclamped input travel ${index}`);
    near(state.driverAngle, inputTravel, 4e-15,
      `input angle ${index}`);
    near(state.drivenAngle, -5 * inputTravel / 6, 4e-15,
      `counterwheel angle ${index}`);
    near(state.gearMesh.meshPhaseInvariant, 0, 1e-13,
      `mesh phase invariant ${index}`);
    near(state.gearMesh.ratio, -5 / 6, 0,
      `mesh ratio ${index}`);
    assert.equal(state.gearMesh.active, true);
    assert.ok(state.drivenAngle <= previousDrivenAngle + 4e-15,
      `counterwheel remains monotonic at ${index}`);
    previousDrivenAngle = state.drivenAngle;

    if (index < sampleCount) {
      near(state.drivenAngularSpeed, -5 * driverAngularSpeed / 6, 4e-16,
        `counterwheel speed ${index}`);
      near(
        state.drivenAngularAcceleration,
        -5 * driverAngularAcceleration / 6,
        4e-16,
        `counterwheel acceleration ${index}`,
      );
      near(state.driverPitchLineSpeed + state.drivenPitchLineSpeed, 0,
        7e-16, `equal pitch-line speed ${index}`);
      vector2Near(
        state.gearMesh.driverPitchVelocity,
        state.gearMesh.drivenPitchVelocity,
        7e-16,
        `equal contact velocity ${index}`,
      );
      assert.equal(state.atForwardStop, false);
    } else {
      assert.equal(state.atForwardStop, true);
      assert.equal(state.limit.blocked, true);
      assert.equal(state.driverAngularSpeed, 0);
      near(state.drivenAngularSpeed, 0, 0, 'blocked counterwheel speed');
    }

    if (index > 0) assert.equal(state.atReverseStop, false);
    if (index % 8 === 0 && index > 0 && index < sampleCount) {
      const fingers = fingerGeometryAtInputTravel(inputTravel);
      assert.equal(
        trianglesProperlyOverlap(
          fingers.driverFinger,
          fingers.drivenFinger,
        ),
        false,
        `rigid stop fingers remain separate at sample ${index}`,
      );
    }
  }

  const reverseStop = stateAtInputTravel(geometry.reverseInputLimit, -1, 0.3);
  assert.equal(reverseStop.atReverseStop, true);
  assert.equal(reverseStop.limit.blocked, true);
  assert.equal(reverseStop.limit.stopContact.side, 'reverse');
  assert.equal(reverseStop.limit.stopContact.blockedDirection, 'reverse');
  assert.equal(reverseStop.driverAngularSpeed, 0);
  assert.equal(reverseStop.driverAngularAcceleration, 0);
  const forwardStop = stateAtInputTravel(geometry.forwardInputLimit, 1, -0.2);
  assert.equal(forwardStop.atForwardStop, true);
  assert.equal(forwardStop.limit.stopContact.side, 'forward');
  assert.equal(forwardStop.limit.stopContact.blockedDirection, 'forward');

  const movingAwayFromReverse = stateAtInputTravel(
    geometry.reverseInputLimit,
    0.7,
    0.1,
  );
  assert.equal(movingAwayFromReverse.atReverseStop, false);
  near(movingAwayFromReverse.drivenAngularSpeed, -7 / 12, 2e-16,
    'the reverse stop releases in the allowed direction');
  const movingAwayFromForward = stateAtInputTravel(
    geometry.forwardInputLimit,
    -0.7,
    -0.1,
  );
  assert.equal(movingAwayFromForward.atForwardStop, false);
  near(movingAwayFromForward.drivenAngularSpeed, 7 / 12, 2e-16,
    'the forward stop releases in the allowed direction');

  const below = stateAtInputTravel(geometry.reverseInputLimit - 2.5, -1, -1);
  near(below.inputTravel, geometry.reverseInputLimit, 0,
    'reverse overtravel is clamped');
  near(below.limit.undertravelPrevented, 2.5, 9e-16,
    'reported reverse overtravel');
  const above = stateAtInputTravel(geometry.forwardInputLimit + 3.25, 1, 1);
  near(above.inputTravel, geometry.forwardInputLimit, 0,
    'forward overtravel is clamped');
  near(above.limit.overtravelPrevented, 3.25, 9e-16,
    'reported forward overtravel');
  near(transmission.gearRatio, -5 / 6, 0, 'public transmission ratio');
  disposeModel(model.root);
});

test('movement 214 has smooth reversible runtime rates, exact terminal holds, and no discontinuous reset', () => {
  const model = createMovementModel(catalog.movements[213]);
  const {
    canonicalStates,
    canonicalTimes,
    geometry,
    inputStateAtTime,
    stateAtTime,
    timeline,
  } = model.root.userData;

  assert.equal(canonicalStates.sourcePose.stage, 'plate-source-open-pose');
  near(canonicalStates.sourcePose.inputTravel, 0, 0, 'initial source pose');
  near(canonicalStates.firstHalfTurn.inputTravel, Math.PI, 3e-15,
    'first official half-turn');
  assert.equal(canonicalStates.forwardStop.atForwardStop, true);
  near(canonicalStates.forwardStop.inputTravel, geometry.forwardInputLimit, 0,
    'forward terminal pose');
  assert.equal(canonicalStates.reverseStop.atReverseStop, true);
  near(canonicalStates.reverseStop.inputTravel, geometry.reverseInputLimit, 0,
    'reverse terminal pose');
  near(canonicalStates.sourcePoseOnReverse.inputTravel, 0, 5e-15,
    'reverse traverse passes through the official source pose');
  near(canonicalStates.cycleClosure.inputTravel, 0, 0,
    'cycle closes at the source pose');

  const boundaries = [
    0,
    timeline.forwardMotionStart,
    timeline.forwardMotionEnd,
    timeline.forwardStopHoldEnd,
    timeline.fullReverseMotionEnd,
    timeline.reverseStopHoldEnd,
    timeline.demonstrationPeriod,
  ];
  for (const boundary of boundaries) {
    const input = inputStateAtTime(boundary);
    near(input.angularSpeed, 0, 2e-14,
      `zero input speed at timeline boundary ${boundary}`);
    near(input.angularAcceleration, 0, 3e-14,
      `zero input acceleration at timeline boundary ${boundary}`);
  }

  const epsilon = 1e-7;
  for (const boundary of boundaries.slice(1, -1)) {
    const before = stateAtTime(boundary - epsilon);
    const after = stateAtTime(boundary + epsilon);
    near(before.inputTravel, after.inputTravel, 2e-11,
      `continuous input pose at ${boundary}`);
    near(before.drivenAngle, after.drivenAngle, 2e-11,
      `continuous counterwheel pose at ${boundary}`);
  }
  const cycleBefore = stateAtTime(timeline.demonstrationPeriod - epsilon);
  const cycleAfter = stateAtTime(epsilon);
  near(cycleBefore.inputTravel, cycleAfter.inputTravel, 2e-11,
    'cycle seam is position-continuous');
  near(cycleBefore.driverAngularSpeed, cycleAfter.driverAngularSpeed, 2e-10,
    'cycle seam is velocity-continuous');

  for (let index = 1; index < 4096; index += 1) {
    const time = timeline.demonstrationPeriod * index / 4096;
    if (boundaries.some((boundary) => Math.abs(time - boundary) < 1e-4)) {
      continue;
    }
    const state = stateAtTime(time);
    const before = stateAtTime(time - epsilon);
    const after = stateAtTime(time + epsilon);
    const numericalInputSpeed = (
      after.inputTravel - before.inputTravel
    ) / (2 * epsilon);
    near(numericalInputSpeed, state.driverAngularSpeed, 1.8e-6,
      `analytic input speed at ${index}`);
    near(state.drivenAngularSpeed, -5 * state.driverAngularSpeed / 6,
      2e-15, `analytic counterwheel speed at ${index}`);
  }

  model.update(canonicalTimes.forwardStopMidHold);
  assert.equal(model.root.userData.contacts.forwardFingerFlankStop.side,
    'forward');
  assert.equal(model.root.userData.contacts.reverseFingerFlankStop, null);
  assert.equal(model.root.userData.blocks.forwardContactMarker.visible, true);
  assert.equal(model.root.userData.blocks.reverseContactMarker.visible, false);
  model.update(canonicalTimes.reverseStopMidHold);
  assert.equal(model.root.userData.contacts.forwardFingerFlankStop, null);
  assert.equal(model.root.userData.contacts.reverseFingerFlankStop.side,
    'reverse');
  assert.equal(model.root.userData.blocks.forwardContactMarker.visible, false);
  assert.equal(model.root.userData.blocks.reverseContactMarker.visible, true);
  model.update(canonicalTimes.sourcePose);
  near(
    model.root.userData.blocks.driver.userData.rotor.rotation.z,
    0,
    0,
    'rendered input source orientation',
  );
  near(
    model.root.userData.blocks.driven.userData.rotor.rotation.z,
    0,
    0,
    'rendered counterwheel source orientation',
  );
  assert.equal(model.root.userData.contacts.constantSpurMesh.active, true);
  assert.equal(model.root.userData.contacts.forwardFingerFlankStop, null);
  assert.equal(model.root.userData.contacts.reverseFingerFlankStop, null);
  disposeModel(model.root);
});

test('movement 214 renders coplanar meshing gears, legible rigid rate indices, two contacts, and differs from authored 215', () => {
  const model = createMovementModel(catalog.movements[213]);
  const { blocks, canonicalTimes, geometry } = model.root.userData;
  model.update(canonicalTimes.sourcePose);
  model.root.updateMatrixWorld(true);

  const driverBounds = new THREE.Box3().setFromObject(
    blocks.driverAssembly.gearBody,
  );
  const drivenBounds = new THREE.Box3().setFromObject(
    blocks.drivenAssembly.gearBody,
  );
  const driverFingerBounds = new THREE.Box3().setFromObject(
    blocks.driverAssembly.fingerBody,
  );
  const drivenFingerBounds = new THREE.Box3().setFromObject(
    blocks.drivenAssembly.fingerBody,
  );
  assert.ok(driverBounds.max.x > geometry.gearContactPoint.x);
  assert.ok(drivenBounds.max.x > geometry.gearContactPoint.x - 0.2);
  assert.ok(driverBounds.min.x < geometry.gearContactPoint.x + 0.2);
  assert.ok(drivenBounds.min.x < geometry.drivenCenter.x);
  near(driverBounds.min.z, drivenBounds.min.z, 2e-15,
    'gear bodies share one mesh plane');
  near(driverBounds.max.z, drivenBounds.max.z, 2e-15,
    'gear bodies have equal depth');
  near(driverFingerBounds.min.z, drivenFingerBounds.min.z, 2e-15,
    'stop fingers share their contact plane');
  near(driverFingerBounds.max.z, drivenFingerBounds.max.z, 2e-15,
    'stop fingers have equal contact depth');
  assert.ok(driverFingerBounds.min.z > driverBounds.max.z + 0.015,
    'raised stop fingers clear the opposing gear faces');
  assert.ok(driverFingerBounds.min.z < driverBounds.max.z + 0.02,
    'p93: the fingers lie just over their gear faces, not 0.075 proud');

  const meshPointWorld = new THREE.Vector3();
  blocks.gearMeshMarker.getWorldPosition(meshPointWorld);
  near(meshPointWorld.x, geometry.gearContactPoint.x, 2e-16,
    'visible mesh marker x');
  near(meshPointWorld.y, geometry.gearContactPoint.y, 2e-16,
    'visible mesh marker y');
  assert.ok(blocks.driverAssembly.motionIndex.children[0].material.color.equals(
    new THREE.Color(0xfaf9f5),
  ));
  assert.ok(blocks.drivenAssembly.motionIndex.children[0].material.color.equals(
    new THREE.Color(0xfaf9f5),
  ));

  model.update(canonicalTimes.forwardStopMidHold);
  model.root.updateMatrixWorld(true);
  const forwardMarkerWorld = new THREE.Vector3();
  blocks.forwardContactMarker.getWorldPosition(forwardMarkerWorld);
  near(forwardMarkerWorld.x, geometry.forwardStopContact.contactPoint.x,
    2e-16, 'forward marker x');
  near(forwardMarkerWorld.y, geometry.forwardStopContact.contactPoint.y,
    2e-16, 'forward marker y');
  assert.equal(blocks.forwardContactMarker.visible, true);
  model.update(canonicalTimes.reverseStopMidHold);
  const reverseMarkerWorld = new THREE.Vector3();
  blocks.reverseContactMarker.getWorldPosition(reverseMarkerWorld);
  near(reverseMarkerWorld.x, geometry.reverseStopContact.contactPoint.x,
    2e-16, 'reverse marker x');
  near(reverseMarkerWorld.y, geometry.reverseStopContact.contactPoint.y,
    2e-16, 'reverse marker y');
  assert.equal(blocks.reverseContactMarker.visible, true);

  const sweptBounds = new THREE.Box3();
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    sweptBounds.union(new THREE.Box3().setFromObject(model.root));
  }
  const sweptSize = sweptBounds.getSize(new THREE.Vector3());
  assert.ok(sweptSize.x > 9);
  assert.ok(sweptSize.y > 8);
  assert.ok(sweptSize.z > 1.7, 'the gears use depth without the undrawn frame');
  let meshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  assert.ok(meshCount >= 23, 'the undrawn frame is presented away');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const movement213 = createMovementModel(catalog.movements[212]);
  const movement215 = createMovementModel(catalog.movements[214]);
  assert.equal(catalog.movements[212].id, 213);
  assert.equal(catalog.movements[212].fidelity, 'authored');
  assert.equal(movement213.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement213.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.equal(catalog.movements[214].id, 215);
  assert.equal(catalog.movements[214].fidelity, 'authored');
  assert.equal(movement215.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement215.root.userData.archetype,
    model.root.userData.archetype,
  );
  disposeModel(movement213.root);
  disposeModel(movement215.root);
  disposeModel(model.root);
});
