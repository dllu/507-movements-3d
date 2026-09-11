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

function planarWorldPosition(object) {
  const point = object.getWorldPosition(new THREE.Vector3());
  return new THREE.Vector2(point.x, point.y);
}

test('movement 206 is one lever carrying two independent curved pawls around one forty-four-tooth ratchet', () => {
  const movement = catalog.movements[205];
  const model = createMovementModel(movement);
  const {
    blocks,
    sourceAnchors,
    sourceAnimation,
    sourceRaster,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 206);
  assert.equal(movement.number, '206');
  assert.equal(movement.title, 'Double-Stroke Shared-Pivot Ratchet Drive');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(
    movement.description,
    '206. A continuous circular movement of the ratchet-wheel, produced by the vibration of the lever carrying two pawls, one of which engages the ratchet-teeth in rising and the other in falling.',
  );
  assert.equal(
    movement.archetype,
    'shared-pivot-opposed-curved-pawl-double-stroke-forty-four-tooth-ratchet',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'one-vibrating-lever-pin-carries-two-independent-curved-pawls-driving-one-clockwise-ratchet-on-opposite-strokes',
  );
  assert.equal(
    model.root.userData.variant,
    'left-pawl-rising-right-pawl-falling-with-one-tooth-per-complete-vibration',
  );

  assert.equal(blocks.ratchet.parent, model.root);
  assert.equal(blocks.ratchetShaft.parent, model.root);
  assert.equal(blocks.rocker.parent, model.root);
  assert.equal(blocks.leftPawl.parent, model.root);
  assert.equal(blocks.rightPawl.parent, model.root);
  assert.equal(blocks.commonPawlJoint.parent, blocks.rocker.userData.rotor);
  assert.equal(blocks.commonPawlJoint.children.length, 2);
  assert.equal(blocks.commonPawlJoint.userData.commonMovingPawlPivot, true);
  assert.equal(blocks.leftPawl.userData.independentAtSharedPivot, true);
  assert.equal(blocks.rightPawl.userData.independentAtSharedPivot, true);
  assert.notEqual(blocks.leftPawl, blocks.rightPawl);
  assert.equal(blocks.leftPawl.userData.centerlinePoints.length, 37);
  assert.equal(blocks.rightPawl.userData.centerlinePoints.length, 37);
  assert.ok(blocks.leftPawl.userData.bend < 0);
  assert.ok(blocks.rightPawl.userData.bend > 0);
  assert.equal(blocks.ratchet.userData.teeth, 44);
  assert.equal(blocks.ratchet.userData.profilePoints.length, 132);
  assert.equal(blocks.ratchet.userData.toothFaces.length, 44);
  assert.equal(blocks.ratchet.userData.rotor.children.includes(
    blocks.ratchetBody,
  ), true);

  assert.equal(transmission.toothCount, 44);
  assert.equal(transmission.risingPawl, 'left');
  assert.equal(transmission.fallingPawl, 'right');
  assert.equal(transmission.clockwiseOutput, true);
  assert.equal(transmission.continuousAcrossBothInputStrokes, true);
  assert.equal(transmission.wheelPitchesPerInputCycle, 1);
  assert.equal(transmission.wheelClosureInputCycles, 44);
  near(
    transmission.outputTurnsPerInputCycle,
    -1 / 44,
    0,
    'one clockwise tooth per vibration',
  );

  assert.equal(sourceAnimation.available, false);
  assert.deepEqual(sourceRaster.imageSize.toArray(), [525, 525]);
  assert.equal(sourceRaster.sourceUrl, movement.sourceUrl);
  assert.equal(sourceRaster.wheelToothCount, 44);
  assert.equal(sourceRaster.wheelToothTipRadiusPixels, 211);
  assert.deepEqual(sourceAnchors.wheelCenter.toArray(), [261, 303]);
  assert.deepEqual(sourceAnchors.fixedLeverPivot.toArray(), [338, 49]);
  assert.deepEqual(sourceAnchors.sharedPawlPivot.toArray(), [257, 66]);
  assert.deepEqual(sourceAnchors.leftPawlTip.toArray(), [94, 203]);
  assert.deepEqual(sourceAnchors.rightPawlTip.toArray(), [408, 193]);
  assert.deepEqual(sourceAnchors.handleEnd.toArray(), [421, 17]);

  const counts = {
    belts: 0,
    commonPawlPins: 0,
    curvedPawls: 0,
    gears: 0,
    ratchets: 0,
    vibratingLevers: 0,
  };
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (/belt|pulley/i.test(role)) counts.belts += 1;
    if (/gear|worm|rack|cam/i.test(role)) counts.gears += 1;
    if (role === 'single-moving-pin-carrying-two-independent-pawls') {
      counts.commonPawlPins += 1;
    }
    if (/curved-pawl-driving-while-common-pin/.test(role)) {
      counts.curvedPawls += 1;
    }
    if (/forty-four-tooth-clockwise-double-stroke-ratchet-wheel/.test(role)) {
      counts.ratchets += 1;
    }
    if (/vibrating-input-lever-carrying-one-common-pawl-pin/.test(role)) {
      counts.vibratingLevers += 1;
    }
  });
  assert.deepEqual(counts, {
    belts: 0,
    commonPawlPins: 1,
    curvedPawls: 2,
    gears: 0,
    ratchets: 1,
    vibratingLevers: 1,
  });
  disposeModel(model.root);
});

test('movement 206 uses source-proportioned pivots and exact sawtooth working faces', () => {
  const model = createMovementModel(catalog.movements[205]);
  const {
    blocks,
    geometry,
    modelPointToSource,
    sourceAnchors,
    sourcePointToModel,
    transmission,
  } = model.root.userData;
  const {
    fixedLeverPivot,
    leftDrivePointLocal,
    leftEndWorldAngle,
    leftFaceFraction,
    leftPawlLength,
    leftSourceContactAngle,
    lowAnchor,
    highAnchor,
    pawlCarrierRadius,
    ratchetMountPhase,
    ratchetOuterRadius,
    ratchetRootRadius,
    rightDrivePointOnToothZero,
    rightEndWorldAngle,
    rightFaceFraction,
    rightPawlLength,
    rightStartWorldAngle,
    rightToothOffset,
    risingAdvance,
    fallingAdvance,
    rockerAmplitude,
    sharedPawlPivotAtSource,
    toothCount,
    toothOuterEndPhase,
    toothOuterStartPhase,
    toothPitch,
  } = geometry;

  assert.equal(toothCount, 44);
  near(toothPitch, FULL_TURN / 44, 0, 'ratchet tooth pitch');
  near(ratchetOuterRadius, 2.38, 0, 'ratchet tooth-tip radius');
  near(ratchetRootRadius, 2.08, 0, 'ratchet root radius');
  near(toothOuterStartPhase, 0.04, 0, 'short rising-face phase');
  near(toothOuterEndPhase, 0.28, 0, 'outer corner phase');
  near(leftFaceFraction, 0.43, 0, 'left working point on face');
  near(rightFaceFraction, 0, 0, 'right working point at outer corner');
  assert.equal(rightToothOffset, -13);
  assert.ok(rockerAmplitude > THREE.MathUtils.degToRad(8.2));
  assert.ok(rockerAmplitude < THREE.MathUtils.degToRad(8.3));
  near(risingAdvance + fallingAdvance, toothPitch, 2e-15, 'stroke closure');
  near(transmission.risingStrokeAdvance, risingAdvance, 0, 'rising advance');
  near(transmission.fallingStrokeAdvance, fallingAdvance, 0, 'falling advance');
  assert.ok(risingAdvance > THREE.MathUtils.degToRad(3.2));
  assert.ok(risingAdvance < THREE.MathUtils.degToRad(3.3));
  assert.ok(fallingAdvance > THREE.MathUtils.degToRad(4.9));
  assert.ok(fallingAdvance < THREE.MathUtils.degToRad(5));

  vector2Near(
    sourcePointToModel(sourceAnchors.fixedLeverPivot),
    fixedLeverPivot,
    0,
    'fixed lever pivot source mapping',
  );
  vector2Near(
    sourcePointToModel(sourceAnchors.sharedPawlPivot),
    sharedPawlPivotAtSource,
    0,
    'shared pawl pivot source mapping',
  );
  vector2Near(
    modelPointToSource(fixedLeverPivot),
    sourceAnchors.fixedLeverPivot,
    3e-14,
    'fixed pivot inverse source mapping',
  );
  near(
    fixedLeverPivot.distanceTo(sharedPawlPivotAtSource),
    pawlCarrierRadius,
    2e-16,
    'one rigid lever arm reaches the common pawl pin',
  );
  near(lowAnchor.distanceTo(fixedLeverPivot), pawlCarrierRadius, 2e-16, 'low pin radius');
  near(highAnchor.distanceTo(fixedLeverPivot), pawlCarrierRadius, 2e-16, 'high pin radius');
  assert.ok(highAnchor.y > lowAnchor.y);

  near(
    Math.atan2(leftDrivePointLocal.y, leftDrivePointLocal.x),
    leftSourceContactAngle,
    2e-15,
    'left contact angular source anchor',
  );
  near(
    rightStartWorldAngle,
    Math.atan2(
      sourcePointToModel(sourceAnchors.rightPawlTip).y,
      sourcePointToModel(sourceAnchors.rightPawlTip).x,
    ),
    THREE.MathUtils.degToRad(0.36),
    'right contact sector matches the engraving',
  );
  near(
    leftSourceContactAngle - leftEndWorldAngle,
    risingAdvance,
    0,
    'left stroke angular advance',
  );
  near(
    rightStartWorldAngle - rightEndWorldAngle,
    fallingAdvance,
    0,
    'right stroke angular advance',
  );
  near(lowAnchor.distanceTo(leftDrivePointLocal), leftPawlLength, 0, 'left pawl length');
  const rightStartPoint = new THREE.Vector2(
    Math.cos(rightStartWorldAngle) * geometry.rightContactOrbitRadius,
    Math.sin(rightStartWorldAngle) * geometry.rightContactOrbitRadius,
  );
  near(highAnchor.distanceTo(rightStartPoint), rightPawlLength, 0, 'right pawl length');

  blocks.ratchet.userData.profilePoints.forEach((point, pointIndex) => {
    const pointWithinTooth = pointIndex % 3;
    const expectedRadius = pointWithinTooth === 0
      ? ratchetRootRadius
      : ratchetOuterRadius;
    near(point.length(), expectedRadius, 8e-16, `profile radius ${pointIndex}`);
  });
  blocks.ratchet.userData.toothFaces.forEach((face, toothIndex) => {
    assert.equal(face.toothIndex, toothIndex);
    near(face.outer.length(), ratchetOuterRadius, 8e-16, `face outer ${toothIndex}`);
    near(face.root.length(), ratchetRootRadius, 8e-16, `face root ${toothIndex}`);
    near(face.tangent.length(), 1, 3e-16, `face tangent ${toothIndex}`);
    near(face.outwardNormal.length(), 1, 3e-16, `face normal ${toothIndex}`);
    near(face.tangent.dot(face.outwardNormal), 0, 2e-16, `face orthogonality ${toothIndex}`);
  });
  const faceZero = blocks.ratchet.userData.toothFaces[0];
  vector2Near(
    leftDrivePointLocal,
    faceZero.outer.clone().lerp(faceZero.root, leftFaceFraction),
    0,
    'left point lies on tooth-zero drive face',
  );
  vector2Near(
    rightDrivePointOnToothZero,
    faceZero.outer.clone().lerp(faceZero.root, rightFaceFraction),
    0,
    'right point lies at the tooth-zero drive corner',
  );
  near(
    ratchetMountPhase,
    Math.atan2(faceZero.outer.y, faceZero.outer.x)
      - toothOuterEndPhase * toothPitch,
    2e-16,
    'ratchet mount phase',
  );
  disposeModel(model.root);
});

test('movement 206 exhaustively advances clockwise on both strokes without reversal or pawl penetration', () => {
  const model = createMovementModel(catalog.movements[205]);
  const {
    geometry,
    stateAtCycleCoordinate,
    transmission,
  } = model.root.userData;
  const sampleCount = 32768;
  const leftTeeth = new Set();
  const rightTeeth = new Set();
  let previousAngle = null;
  let previousLeftTip = null;
  let previousRightTip = null;
  let maximumActiveLengthError = 0;
  let maximumInactiveLengthError = 0;
  let maximumContactError = 0;
  let maximumTipVelocityError = 0;
  let maximumResetStep = 0;
  let minimumClearance = Infinity;
  let minimumClockwiseTorque = Infinity;
  let maximumAngularSpeed = -Infinity;

  for (let sample = 0; sample <= sampleCount; sample += 1) {
    const cycleCoordinate = transmission.wheelClosureInputCycles
      * sample / sampleCount;
    const state = stateAtCycleCoordinate(cycleCoordinate);
    finiteStateNumbers(state, `state[${sample}]`);
    maximumActiveLengthError = Math.max(
      maximumActiveLengthError,
      state.activePawlLengthError,
      state.leftPawlLengthError,
      state.rightPawlLengthError,
    );
    maximumInactiveLengthError = Math.max(
      maximumInactiveLengthError,
      state.inactivePawlLengthError,
    );
    maximumContactError = Math.max(
      maximumContactError,
      state.toothContactError,
    );
    maximumTipVelocityError = Math.max(
      maximumTipVelocityError,
      state.activeTipVelocityError,
    );
    minimumClearance = Math.min(
      minimumClearance,
      state.leftProfileClearance,
      state.rightProfileClearance,
    );
    minimumClockwiseTorque = Math.min(
      minimumClockwiseTorque,
      state.activeClockwiseTorque,
    );
    maximumAngularSpeed = Math.max(
      maximumAngularSpeed,
      state.drivenAngularSpeed,
    );

    assert.equal(state.leftDriving, state.cyclePhase < 0.5);
    assert.equal(state.rightDriving, !state.leftDriving);
    assert.equal(state.activePawl, state.leftDriving ? 'left' : 'right');
    assert.equal(state.inactivePawl, state.leftDriving ? 'right' : 'left');
    assert.match(
      state.stage,
      state.leftDriving ? /rising-left-pawl-drives/ : /falling-right-pawl-drives/,
    );
    assert.equal(state.activeFaceSegmentIndex, state.activeToothIndex * 3 + 2);
    if (state.leftDriving) {
      assert.equal(
        state.activeProfileContact.segmentIndex,
        state.activeFaceSegmentIndex,
      );
    } else {
      assert.ok([
        state.activeFaceSegmentIndex - 1,
        state.activeFaceSegmentIndex,
      ].includes(state.activeProfileContact.segmentIndex));
    }
    assert.ok(state.activeForceNormalAlignment < -0.49);
    assert.ok(state.activeClockwiseTorque > 1.9);
    assert.ok(state.drivenAngularSpeed <= 1e-12);
    if (state.leftDriving) leftTeeth.add(state.activeToothIndex);
    else rightTeeth.add(state.activeToothIndex);

    if (previousAngle !== null) {
      assert.ok(
        state.drivenAngle < previousAngle,
        `ratchet advances strictly clockwise at sample ${sample}`,
      );
      maximumResetStep = Math.max(
        maximumResetStep,
        state.leftTip.distanceTo(previousLeftTip),
        state.rightTip.distanceTo(previousRightTip),
      );
    }
    previousAngle = state.drivenAngle;
    previousLeftTip = state.leftTip;
    previousRightTip = state.rightTip;
  }

  assert.equal(leftTeeth.size, 44);
  assert.equal(rightTeeth.size, 44);
  assert.ok(maximumActiveLengthError < 3e-15);
  assert.ok(maximumInactiveLengthError < 2e-15);
  assert.ok(maximumContactError < 3e-15);
  assert.ok(maximumTipVelocityError < 2e-16);
  assert.ok(minimumClearance >= -1e-14);
  assert.ok(minimumClockwiseTorque > 1.9);
  assert.ok(maximumAngularSpeed < 1e-12);
  assert.ok(maximumResetStep < 0.004);

  for (let cycleIndex = 0; cycleIndex < 44; cycleIndex += 1) {
    const start = stateAtCycleCoordinate(cycleIndex);
    const handoff = stateAtCycleCoordinate(cycleIndex + 0.5);
    const end = stateAtCycleCoordinate(cycleIndex + 1);
    near(
      handoff.drivenAngle - start.drivenAngle,
      -geometry.risingAdvance,
      3e-15,
      `rising advance ${cycleIndex}`,
    );
    near(
      end.drivenAngle - handoff.drivenAngle,
      -geometry.fallingAdvance,
      3e-15,
      `falling advance ${cycleIndex}`,
    );
    near(
      end.drivenAngle - start.drivenAngle,
      -geometry.toothPitch,
      3e-15,
      `one pitch per vibration ${cycleIndex}`,
    );
  }
  near(
    stateAtCycleCoordinate(44).drivenAngle
      - stateAtCycleCoordinate(0).drivenAngle,
    -FULL_TURN,
    1e-15,
    'forty-four-cycle wheel closure',
  );
  disposeModel(model.root);
});

test('movement 206 rates, reversals, handoffs, and full-wheel closure agree analytically', () => {
  const model = createMovementModel(catalog.movements[205]);
  const { geometry, stateAtCycleCoordinate, transmission } = model.root.userData;
  const numericalHalfWidth = 1e-6;
  for (const cycleCoordinate of [
    0.07,
    0.19,
    0.33,
    0.44,
    0.57,
    0.69,
    0.82,
    0.94,
    3.37,
  ]) {
    const before = stateAtCycleCoordinate(
      cycleCoordinate - numericalHalfWidth,
    );
    const state = stateAtCycleCoordinate(cycleCoordinate);
    const after = stateAtCycleCoordinate(
      cycleCoordinate + numericalHalfWidth,
    );
    const numericalDrivenSpeed = (
      after.drivenAngle - before.drivenAngle
    ) / (2 * numericalHalfWidth) * geometry.cyclesPerSecond;
    const numericalRockerSpeed = (
      after.rockerAngle - before.rockerAngle
    ) / (2 * numericalHalfWidth) * geometry.cyclesPerSecond;
    near(
      state.drivenAngularSpeed,
      numericalDrivenSpeed,
      1e-8,
      `driven speed ${cycleCoordinate}`,
    );
    near(
      state.rockerAngularSpeed,
      numericalRockerSpeed,
      1e-8,
      `rocker speed ${cycleCoordinate}`,
    );
    assert.ok(state.drivenAngularSpeed < 0);
  }

  for (const reversal of [0, 0.5, 1, 12.5, 44]) {
    const state = stateAtCycleCoordinate(reversal);
    near(state.rockerAngularSpeed, 0, 2e-16, `rocker reversal ${reversal}`);
    near(state.drivenAngularSpeed, 0, 2e-16, `wheel reversal ${reversal}`);
    assert.equal(state.inputReversing, true);
  }

  const handoffEpsilon = 1e-8;
  for (const handoff of [0, 0.5, 1, 17.5, 44]) {
    const before = stateAtCycleCoordinate(handoff - handoffEpsilon);
    const exact = stateAtCycleCoordinate(handoff);
    const after = stateAtCycleCoordinate(handoff + handoffEpsilon);
    assert.ok(before.leftTip.distanceTo(exact.leftTip) < 2e-7);
    assert.ok(after.leftTip.distanceTo(exact.leftTip) < 2e-7);
    assert.ok(before.rightTip.distanceTo(exact.rightTip) < 2e-7);
    assert.ok(after.rightTip.distanceTo(exact.rightTip) < 2e-7);
    assert.ok(Math.abs(before.drivenAngle - exact.drivenAngle) < 2e-8);
    assert.ok(Math.abs(after.drivenAngle - exact.drivenAngle) < 2e-8);
  }

  near(
    transmission.risingStrokeAdvance
      + transmission.fallingStrokeAdvance,
    transmission.toothPitch,
    2e-15,
    'two strokes sum to one pitch',
  );
  near(
    transmission.outputTurnsPerInputCycle,
    -transmission.toothPitch / FULL_TURN,
    0,
    'mean cycle ratio',
  );
  near(
    stateAtCycleCoordinate(44).rockerAngle,
    stateAtCycleCoordinate(0).rockerAngle,
    0,
    'input closes every vibration',
  );
  near(
    stateAtCycleCoordinate(44).drivenAngle,
    stateAtCycleCoordinate(0).drivenAngle - FULL_TURN,
    1e-15,
    'output closes after forty-four vibrations',
  );
  disposeModel(model.root);
});

test('movement 206 runtime binds the common pin, both pawls, wheel, and visible indexes while movement 207 is independently authored', () => {
  const model = createMovementModel(catalog.movements[205]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const sampleTimes = [
    ...Object.values(canonicalTimes),
    geometry.inputCyclePeriod * 0.11,
    geometry.inputCyclePeriod * 0.39,
    geometry.inputCyclePeriod * 1.64,
  ];
  for (const time of sampleTimes) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    near(blocks.ratchet.userData.rotor.rotation.z, state.drivenAngle, 0, 'runtime ratchet angle');
    near(blocks.ratchetShaft.userData.rotor.rotation.z, state.drivenAngle, 0, 'runtime shaft angle');
    near(blocks.rocker.userData.rotor.rotation.z, state.rockerAngle, 0, 'runtime lever angle');
    near(blocks.leftPawl.rotation.z, state.leftPawlAngle, 0, 'runtime left pawl angle');
    near(blocks.rightPawl.rotation.z, state.rightPawlAngle, 0, 'runtime right pawl angle');
    vector2Near(
      new THREE.Vector2(blocks.leftPawl.position.x, blocks.leftPawl.position.y),
      state.sharedPawlPivot,
      0,
      'left pawl uses common moving pivot',
    );
    vector2Near(
      new THREE.Vector2(blocks.rightPawl.position.x, blocks.rightPawl.position.y),
      state.sharedPawlPivot,
      0,
      'right pawl uses common moving pivot',
    );
    vector2Near(
      planarWorldPosition(blocks.commonPawlJoint),
      state.sharedPawlPivot,
      2e-15,
      'lever joint and both pawls share one point',
    );
    vector2Near(
      planarWorldPosition(blocks.leftPawlTipMarker),
      state.leftTip,
      2e-15,
      'left visible tip follows solved endpoint',
    );
    vector2Near(
      planarWorldPosition(blocks.rightPawlTipMarker),
      state.rightTip,
      2e-15,
      'right visible tip follows solved endpoint',
    );
    assert.equal(model.root.userData.contacts.leftPawlTooth.engaged, state.leftDriving);
    assert.equal(model.root.userData.contacts.rightPawlTooth.engaged, state.rightDriving);
    assert.equal(
      Number(model.root.userData.contacts.leftPawlTooth.engaged)
        + Number(model.root.userData.contacts.rightPawlTooth.engaged),
      1,
    );
    near(blocks.ratchet.userData.angularSpeed, state.drivenAngularSpeed, 0, 'runtime wheel speed');
    near(blocks.rocker.userData.angularSpeed, state.rockerAngularSpeed, 0, 'runtime lever speed');
  }

  const worldPositionAt = (object, time) => {
    model.update(time);
    model.root.updateMatrixWorld(true);
    return object.getWorldPosition(new THREE.Vector3());
  };
  const wheelSource = worldPositionAt(blocks.ratchetIndicator, canonicalTimes.sourcePose);
  const wheelOneCycle = worldPositionAt(blocks.ratchetIndicator, canonicalTimes.nextSourcePose);
  const wheelClosure = worldPositionAt(blocks.ratchetIndicator, canonicalTimes.fullWheelClosure);
  assert.ok(wheelSource.distanceTo(wheelOneCycle) > 0.18);
  vector3Near(wheelClosure, wheelSource, 3e-15, 'wheel index closes after forty-four cycles');
  const handleSource = worldPositionAt(blocks.handleIndicator, canonicalTimes.sourcePose);
  const handleHigh = worldPositionAt(blocks.handleIndicator, canonicalTimes.highReversal);
  const handleLow = worldPositionAt(blocks.handleIndicator, canonicalTimes.lowReversal);
  assert.ok(handleSource.distanceTo(handleHigh) > 0.1);
  assert.ok(handleSource.distanceTo(handleLow) > 0.1);
  assert.ok(handleHigh.distanceTo(handleLow) > 0.2);

  model.update(canonicalTimes.sourcePose);
  model.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 5 && size.x < 5.2);
  assert.ok(size.y > 6.3 && size.y < 6.6);
  assert.ok(size.z > 1.6 && size.z < 1.8);
  assert.ok(bounds.min.x < -2.6);
  assert.ok(bounds.max.y > 3.6);
  let visibleMeshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh && object.visible) visibleMeshCount += 1;
  });
  assert.ok(visibleMeshCount >= 38);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 2);

  const nextMovement = catalog.movements[206];
  const nextModel = createMovementModel(nextMovement);
  assert.equal(nextMovement.id, 207);
  assert.equal(nextMovement.fidelity, 'authored');
  assert.equal(nextModel.root.userData.fidelity, 'authored');
  assert.notEqual(nextModel.root.userData.archetype, model.root.userData.archetype);
  assert.notEqual(nextModel.root.userData.mechanism, model.root.userData.mechanism);
  const pendingMovement = catalog.movements[207];
  const pendingModel = createMovementModel(pendingMovement);
  assert.equal(pendingMovement.id, 208);
  assert.equal(pendingMovement.fidelity, 'authored');
  assert.equal(pendingModel.root.userData.fidelity, 'authored');
  assert.notEqual(pendingModel.root.userData.archetype,
    model.root.userData.archetype);
  const queuedMovement = catalog.movements[208];
  const queuedModel = createMovementModel(queuedMovement);
  assert.equal(queuedMovement.id, 209);
  assert.equal(queuedMovement.fidelity, 'authored');
  assert.equal(queuedModel.root.userData.fidelity, 'authored');
  const nextQueuedMovement = catalog.movements[209];
  const nextQueuedModel = createMovementModel(nextQueuedMovement);
  assert.equal(nextQueuedMovement.id, 210);
  assert.equal(nextQueuedMovement.fidelity, 'authored');
  assert.equal(nextQueuedModel.root.userData.fidelity, 'authored');
  const finalQueuedMovement = catalog.movements[210];
  const finalQueuedModel = createMovementModel(finalQueuedMovement);
  assert.equal(finalQueuedMovement.id, 211);
  assert.equal(finalQueuedMovement.fidelity, 'authored');
  assert.equal(finalQueuedModel.root.userData.fidelity, 'authored');
  const reviewedMovement = catalog.movements[211];
  const reviewedModel = createMovementModel(reviewedMovement);
  assert.equal(reviewedMovement.id, 212);
  assert.equal(reviewedMovement.fidelity, 'authored');
  assert.equal(reviewedModel.root.userData.fidelity, 'authored');
  const finalReviewedMovement = catalog.movements[215];
  const finalReviewedModel = createMovementModel(finalReviewedMovement);
  assert.equal(finalReviewedMovement.id, 216);
  assert.equal(finalReviewedMovement.fidelity, 'authored');
  assert.equal(finalReviewedModel.root.userData.fidelity, 'authored');
  const unreviewedMovement = catalog.movements[506];
  const unreviewedModel = createMovementModel(unreviewedMovement);
  assert.equal(unreviewedMovement.id, 507);
  assert.equal(unreviewedMovement.fidelity, 'authored');
  assert.equal(unreviewedModel.root.userData.fidelity, 'authored');
  disposeModel(unreviewedModel.root);
  disposeModel(finalReviewedModel.root);
  disposeModel(reviewedModel.root);
  disposeModel(finalQueuedModel.root);
  disposeModel(nextQueuedModel.root);
  disposeModel(queuedModel.root);
  disposeModel(pendingModel.root);
  disposeModel(nextModel.root);
  disposeModel(model.root);
});
