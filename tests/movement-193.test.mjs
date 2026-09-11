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
  const actual2 = new THREE.Vector2(actual.x, actual.y);
  const expected2 = new THREE.Vector2(expected.x, expected.y);
  assert.ok(
    actual2.distanceTo(expected2) <= tolerance,
    `${message}: expected ${expected2.toArray()}, received ${actual2.toArray()}`,
  );
}

function vector3Near(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function worldPoint(object) {
  return object.getWorldPosition(new THREE.Vector3());
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

test('movement 193 matches Brown\'s two concentric tooth circles, single pinion, and guided universal shaft', () => {
  const movement = catalog.movements[192];
  const model = createMovementModel(movement);
  const {
    blocks,
    geometry,
    modelPointToSourceRaster,
    sourceAnchors,
    sourcePointToModel,
    sourceRaster,
    stateAtCycleProgress,
  } = model.root.userData;

  assert.equal(movement.id, 193);
  assert.equal(movement.number, '193');
  assert.equal(movement.title, 'Unequal-Speed Concentric Mangle Wheel');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(
    movement.description,
    '193. Another kind of mangle-wheel with its pinion. With this as well as with that in the preceding figure, although the pinion continues to revolve in one direction, the mangle-wheel will make almost an entire revolution in one direction and the same in an opposite direction; but the revolution of the wheel in one direction will be slower than that in the other, owing to the greater radius of the outer circle of teeth.',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'concentric-two-radius-closed-groove-mangle-wheel-unequal-forward-reverse-speeds',
  );
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'uniform-pinion-concentric-outer-internal-inner-external-mangle-wheel-unequal-speed-oscillation',
  );

  assert.equal(blocks.mangleToothObjects.length, 68);
  assert.equal(blocks.pinion.userData.teeth, 10);
  assert.equal(blocks.wheel.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.wheel);
  assert.equal(blocks.wheelBody.parent, blocks.wheelRotor);
  assert.equal(blocks.pitchGroove.parent, blocks.wheelRotor);
  assert.equal(blocks.guideGrooveOuter.parent, blocks.wheelRotor);
  assert.equal(blocks.guideGrooveRecess.parent, blocks.wheelRotor);
  assert.equal(blocks.fixedUniversalCross.userData.fixed, true);
  assert.equal(
    blocks.universalSlipShaft.userData.role,
    'vibrating-telescopic-shaft-through-universal-joint',
  );
  blocks.mangleToothObjects.forEach((tooth, index) => {
    assert.equal(tooth.parent, blocks.wheelRotor);
    assert.equal(tooth.userData.index, index);
    assert.equal(
      tooth.userData.role,
      'tooth-on-concentric-two-radius-mangle-path',
    );
  });

  assert.deepEqual(sourceAnchors.wheelCenter.toArray(), [262, 258]);
  assert.deepEqual(sourceAnchors.pinionCenter.toArray(), [263, 401]);
  assert.deepEqual(sourceAnchors.outerPitchBottom.toArray(), [262, 442]);
  assert.deepEqual(sourceAnchors.innerPitchBottom.toArray(), [262, 343]);
  vector2Near(
    sourceAnchors.guideOuterBottom,
    new THREE.Vector2(262, 401.52),
    1e-12,
    'outer shaft-guide radius follows the source pinion pose',
  );
  vector2Near(
    sourceAnchors.guideInnerBottom,
    new THREE.Vector2(262, 383.48),
    1e-12,
    'inner shaft-guide radius follows the inner tooth circle',
  );
  assert.ok(
    sourceAnchors.modeledPinionCenter.distanceTo(
      sourceAnchors.pinionCenter,
    ) < 1.2,
    'modeled pinion center stays within the hand-drawn axle center',
  );
  near(
    sourceAnchors.connectorCenters[0].x
      + sourceAnchors.connectorCenters[1].x,
    sourceAnchors.wheelCenter.x * 2,
    2e-12,
    'the source reversal centers are mirror symmetric',
  );
  near(
    sourceAnchors.connectorCenters[0].y,
    sourceAnchors.connectorCenters[1].y,
    2e-12,
    'the source reversal centers share one height',
  );
  assert.ok(sourceAnchors.connectorCenters[0].x > 196);
  assert.ok(sourceAnchors.connectorCenters[0].x < 198);
  assert.ok(sourceAnchors.connectorCenters[1].x > 326);
  assert.ok(sourceAnchors.connectorCenters[1].x < 328);
  assert.ok(sourceAnchors.connectorCenters[0].y > 140);
  assert.ok(sourceAnchors.connectorCenters[0].y < 141);
  assert.deepEqual(sourceRaster, {
    height: 525,
    scale: 1.5 / 184,
    width: 525,
  });
  vector3Near(
    sourcePointToModel(sourceAnchors.wheelCenter),
    new THREE.Vector3(),
    1e-14,
    'Brown\'s wheel shaft is the fixed modeled axis',
  );
  vector2Near(
    modelPointToSourceRaster(new THREE.Vector3()),
    sourceAnchors.wheelCenter,
    1e-14,
    'model origin maps back to Brown\'s wheel shaft',
  );

  const sourceState = stateAtCycleProgress(0);
  near(sourceState.wheelAngle, 0, 2e-14, 'source wheel orientation');
  vector3Near(
    sourcePointToModel(sourceAnchors.outerPitchBottom),
    sourceState.contactPoint,
    2e-12,
    'source bottom outer pitch point is the initial contact',
  );
  vector3Near(
    sourcePointToModel(sourceAnchors.modeledPinionCenter),
    sourceState.pinionCenter,
    2e-12,
    'source pinion shaft begins in the outer guide run',
  );
  near(sourceState.pinionCenter.x, 0, 3e-15, 'source guide ray');
  assert.equal(sourceState.branch, 'outer-concentric-internal-arc');

  let wheelCount = 0;
  let pinionCount = 0;
  const forbiddenRoles = [];
  model.root.traverse((object) => {
    if (object.userData.role === 'concentric-two-radius-mangle-wheel') {
      wheelCount += 1;
    }
    if (object.userData.role === 'uniformly-rotating-single-mangle-pinion') {
      pinionCount += 1;
    }
    if (/belt|pulley|rack|cam|spring/i.test(object.userData.role ?? '')) {
      forbiddenRoles.push(object.userData.role);
    }
  });
  assert.equal(wheelCount, 1);
  assert.equal(pinionCount, 1);
  assert.deepEqual(forbiddenRoles, []);
  assert.ok(geometry.outerPitchRadius > geometry.innerPitchRadius);
  disposeModel(model.root);
});

test('movement 193 closes one tangent two-radius tooth path and its exact parallel shaft guide', () => {
  const model = createMovementModel(catalog.movements[192]);
  const {
    blocks,
    evaluateArc,
    geometry,
    pathDerivatives,
    stateAtPitchDistance,
  } = model.root.userData;
  const { pitchSegments } = geometry;

  assert.equal(pitchSegments.length, 4);
  assert.deepEqual(
    pitchSegments.map(({ kind }) => kind),
    [
      'outer-concentric-internal-arc',
      'upper-left-radius-change-reversal',
      'inner-concentric-external-arc',
      'upper-right-radius-change-reversal',
    ],
  );
  vector2Near(pitchSegments[0].center, new THREE.Vector2(), 1e-15, 'outer circle center');
  vector2Near(pitchSegments[2].center, new THREE.Vector2(), 1e-15, 'inner circle center');
  near(
    geometry.circularPitch,
    FULL_TURN * geometry.pinionPitchRadius / geometry.pinionTeeth,
    1e-15,
    'pinion circular pitch',
  );
  near(
    geometry.pitchPerimeter,
    geometry.circularPitch * geometry.mangleTeeth,
    2e-14,
    '68 equal pitches close the mangle tooth path',
  );
  near(
    geometry.pitchPerimeter,
    (geometry.outerPitchRadius + geometry.innerPitchRadius)
      * geometry.mainArcSweep
      + FULL_TURN * geometry.connectorRadius,
    2e-14,
    'two main circles and two semicircles make the perimeter',
  );
  near(
    geometry.guidePerimeter,
    geometry.pitchPerimeter - FULL_TURN * geometry.pinionPitchRadius,
    3e-14,
    'the inward parallel guide is one pinion circumference shorter',
  );
  near(
    geometry.totalPinionTravel,
    geometry.guidePerimeter / geometry.pinionPitchRadius,
    4e-14,
    'closed guide traversal gives the exact pinion input travel',
  );
  near(
    geometry.totalPinionTravel / FULL_TURN,
    geometry.mangleTeeth / geometry.pinionTeeth - 1,
    3e-14,
    'one mangle cycle takes exactly 5.8 pinion revolutions',
  );
  near(
    geometry.connectorRadius,
    (geometry.outerPitchRadius - geometry.innerPitchRadius) / 2,
    1e-15,
    'reversal radius joins the two tooth circles',
  );
  near(
    geometry.connectorCenterRadius,
    (geometry.outerPitchRadius + geometry.innerPitchRadius) / 2,
    1e-15,
    'reversal centers bisect the two pitch radii',
  );
  near(geometry.gapCenterAngle, Math.PI / 2, 1e-15, 'upper source gap');
  assert.ok(geometry.gapHalfAngle > 0.5);
  assert.ok(geometry.gapHalfAngle < 0.51);
  assert.ok(geometry.guideAngleClosureError < 2e-14);
  assert.ok(geometry.connectorRadius > geometry.pinionPitchRadius);
  assert.ok(
    geometry.outerGuideRadius - geometry.innerGuideRadius
      > geometry.toothHeight,
    'the inactive main tooth row clears the complete pinion tooth envelope',
  );
  assert.ok(
    geometry.outerPitchRadius - geometry.innerPitchRadius
      - 2 * geometry.pinionPitchRadius - geometry.toothHeight > 0.015,
    'only one concentric tooth circle can engage the pinion at a time',
  );
  near(
    pitchSegments[1].guideRadius,
    geometry.connectorRadius - geometry.pinionPitchRadius,
    1e-15,
    'left reversal guide remains a positive-radius arc',
  );

  for (let index = 0; index < pitchSegments.length; index += 1) {
    const current = pitchSegments[index];
    const next = pitchSegments[(index + 1) % pitchSegments.length];
    const end = evaluateArc(current, 1);
    const start = evaluateArc(next, 0);
    vector2Near(end.point, start.point, 2e-14, `pitch join ${index}`);
    vector2Near(end.guidePoint, start.guidePoint, 2e-14, `guide join ${index}`);
    assert.ok(end.tangent.dot(start.tangent) > 1 - 2e-14);
    assert.ok(end.rightNormal.dot(start.rightNormal) > 1 - 2e-14);
    assert.ok(current.pinionTravelLength > 0);
    near(
      current.guideScale,
      current.guideRadius / current.radius,
      1e-15,
      `parallel-curve scale ${index}`,
    );
    const ratioBeforeJoin = pathDerivatives(stateAtPitchDistance(
      current.pitchEnd - 1e-9,
    )).wheelToPinionRatio;
    const ratioAfterJoin = pathDerivatives(stateAtPitchDistance(
      current.pitchEnd + 1e-9,
    )).wheelToPinionRatio;
    near(
      ratioBeforeJoin,
      ratioAfterJoin,
      2e-8,
      `wheel speed is continuous through path join ${index}`,
    );
  }

  let maximumGuideOffsetError = 0;
  for (let index = 0; index <= 16384; index += 1) {
    const state = stateAtPitchDistance(
      geometry.pitchPerimeter * index / 16384,
    );
    maximumGuideOffsetError = Math.max(
      maximumGuideOffsetError,
      Math.abs(
        state.guidePoint.distanceTo(state.point)
          - geometry.pinionPitchRadius,
      ),
    );
    near(state.tangent.length(), 1, 2e-14, `unit tangent ${index}`);
    near(state.rightNormal.length(), 1, 2e-14, `unit normal ${index}`);
    near(
      state.tangent.dot(state.rightNormal),
      0,
      2e-14,
      `orthogonal guide frame ${index}`,
    );
  }
  assert.ok(maximumGuideOffsetError < 3e-14);

  const outerMidpoint = stateAtPitchDistance(
    pitchSegments[0].pitchStart + pitchSegments[0].pitchLength / 2,
  );
  const innerMidpoint = stateAtPitchDistance(
    pitchSegments[2].pitchStart + pitchSegments[2].pitchLength / 2,
  );
  near(
    pathDerivatives(outerMidpoint).wheelToPinionRatio,
    geometry.pinionPitchRadius / geometry.outerPitchRadius,
    2e-14,
    'outer internal circle has one constant slow ratio',
  );
  near(
    pathDerivatives(innerMidpoint).wheelToPinionRatio,
    -geometry.pinionPitchRadius / geometry.innerPitchRadius,
    2e-14,
    'inner external circle has the opposite faster ratio',
  );

  const sortedToothDistances = [...geometry.toothPitchDistances]
    .sort((left, right) => left - right);
  assert.equal(sortedToothDistances.length, geometry.mangleTeeth);
  for (let index = 0; index < sortedToothDistances.length; index += 1) {
    const gap = THREE.MathUtils.euclideanModulo(
      sortedToothDistances[(index + 1) % sortedToothDistances.length]
        - sortedToothDistances[index],
      geometry.pitchPerimeter,
    );
    near(gap, geometry.circularPitch, 8e-14, `equal tooth pitch ${index}`);
  }
  near(
    blocks.mangleToothObjects[0].userData.pitchDistance,
    geometry.toothOriginPitchDistance,
    2e-14,
    'first mangle tooth is indexed at the source contact',
  );
  disposeModel(model.root);
});

test('movement 193 keeps one uniform pinion, exact rolling, and unequal constant main-run speeds over 32,769 states', () => {
  const model = createMovementModel(catalog.movements[192]);
  const {
    geometry,
    stateAtCycleProgress,
    stateAtInputTravel,
    transmission,
  } = model.root.userData;
  const sampleCount = 32769;
  let maximumContactError = 0;
  let maximumGuideLineError = 0;
  let maximumGuideOffsetError = 0;
  let maximumMeshPhaseError = 0;
  let maximumRollingError = 0;
  let maximumShaftVelocityError = 0;
  let minimumCenterRadius = Infinity;
  let maximumCenterRadius = -Infinity;
  let minimumWheelAngle = Infinity;
  let maximumWheelAngle = -Infinity;
  let previousWheelAngle = null;
  let previousNonzeroSign = null;
  let reversalCount = 0;
  let outerStateCount = 0;
  let innerStateCount = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / (sampleCount - 1);
    const state = stateAtCycleProgress(progress);
    finiteStateNumbers(state, `state[${index}]`);
    maximumContactError = Math.max(maximumContactError, state.contactDistanceError);
    maximumGuideLineError = Math.max(maximumGuideLineError, state.guideLineError);
    maximumGuideOffsetError = Math.max(maximumGuideOffsetError, state.guideOffsetError);
    maximumMeshPhaseError = Math.max(maximumMeshPhaseError, Math.abs(state.meshPhaseError));
    maximumRollingError = Math.max(maximumRollingError, state.rollingVelocityError);
    maximumShaftVelocityError = Math.max(
      maximumShaftVelocityError,
      state.shaftGuideVelocityError,
    );
    minimumCenterRadius = Math.min(minimumCenterRadius, state.pinionCenterRadius);
    maximumCenterRadius = Math.max(maximumCenterRadius, state.pinionCenterRadius);
    minimumWheelAngle = Math.min(minimumWheelAngle, state.wheelAngle);
    maximumWheelAngle = Math.max(maximumWheelAngle, state.wheelAngle);
    near(
      state.inputTravel,
      progress * geometry.totalPinionTravel,
      4e-12,
      `uniform pinion angle ${index}`,
    );
    near(
      state.pinionAngularSpeed,
      transmission.pinionAngularSpeed,
      1e-15,
      `constant pinion speed ${index}`,
    );
    near(
      state.wheelAngularSpeed,
      state.wheelToPinionRatio * state.pinionAngularSpeed,
      3e-14,
      `instantaneous transmission ratio ${index}`,
    );
    near(state.pinionCenter.x, 0, 5e-14, `fixed shaft ray ${index}`);
    assert.ok(state.pinionTravelDerivative > 0);
    if (state.branch === 'outer-concentric-internal-arc') {
      outerStateCount += 1;
      near(
        state.wheelToPinionRatio,
        transmission.outerRunRatio,
        3e-14,
        `constant outer ratio ${index}`,
      );
    }
    if (state.branch === 'inner-concentric-external-arc') {
      innerStateCount += 1;
      near(
        state.wheelToPinionRatio,
        transmission.innerRunRatio,
        3e-14,
        `constant inner ratio ${index}`,
      );
    }
    const speedSign = Math.abs(state.wheelAngularSpeed) < 1e-8
      ? 0
      : Math.sign(state.wheelAngularSpeed);
    if (speedSign !== 0) {
      if (previousNonzeroSign !== null && speedSign !== previousNonzeroSign) {
        reversalCount += 1;
      }
      previousNonzeroSign = speedSign;
    }
    if (previousWheelAngle !== null) {
      assert.ok(
        Math.abs(state.wheelAngle - previousWheelAngle) < 0.003,
        `continuous wheel angle at sample ${index}`,
      );
    }
    previousWheelAngle = state.wheelAngle;
  }

  assert.ok(maximumContactError < 8e-14);
  assert.ok(maximumGuideLineError < 8e-14);
  assert.ok(maximumGuideOffsetError < 8e-14);
  assert.ok(maximumMeshPhaseError < 8e-13);
  assert.ok(maximumRollingError < 8e-13);
  assert.ok(maximumShaftVelocityError < 8e-13);
  assert.equal(reversalCount, 2);
  assert.ok(outerStateCount > 20000);
  assert.ok(innerStateCount > 9800);
  near(maximumCenterRadius, geometry.outerGuideRadius, 3e-12, 'outer guide radius');
  near(minimumCenterRadius, geometry.innerGuideRadius, 3e-12, 'inner guide radius');
  near(maximumWheelAngle, transmission.maximumWheelAngle, 3e-7, 'sampled maximum');
  near(minimumWheelAngle, transmission.minimumWheelAngle, 3e-7, 'sampled minimum');
  near(
    Math.abs(transmission.innerRunRatio / transmission.outerRunRatio),
    transmission.speedMagnitudeFactor,
    2e-15,
    'inner return speed factor',
  );
  assert.ok(transmission.speedMagnitudeFactor > 2.16);
  assert.ok(transmission.speedMagnitudeFactor < 2.17);
  assert.ok(transmission.slowDirectionInputTravel > transmission.fastDirectionInputTravel);
  assert.ok(transmission.slowDirectionInputTravel / transmission.fastDirectionInputTravel > 2.13);
  assert.ok(transmission.wheelSwing > 5.4);
  assert.ok(transmission.wheelSwing < FULL_TURN);
  near(
    transmission.pinionRevolutionsPerMangleCycle,
    5.8,
    2e-14,
    'pinion turns per closed path cycle',
  );

  const start = stateAtInputTravel(0);
  const closure = stateAtInputTravel(geometry.totalPinionTravel);
  near(closure.wheelAngle, start.wheelAngle, 3e-14, 'wheel cycle closure');
  vector3Near(closure.pinionCenter, start.pinionCenter, 3e-14, 'shaft cycle closure');
  vector3Near(closure.contactPoint, start.contactPoint, 3e-14, 'contact cycle closure');
  const pinionAngularPitch = FULL_TURN / geometry.pinionTeeth;
  const pinionClosureResidual = THREE.MathUtils.euclideanModulo(
    closure.pinionAngle - start.pinionAngle,
    pinionAngularPitch,
  );
  near(
    Math.min(
      pinionClosureResidual,
      pinionAngularPitch - pinionClosureResidual,
    ),
    0,
    3e-14,
    'pinion tooth phase closes after the complete mangle path',
  );
  disposeModel(model.root);
});

test('movement 193 rendered transforms keep the pinion captured through the slow drive and fast return', () => {
  const model = createMovementModel(catalog.movements[192]);
  const {
    blocks,
    canonicalStates,
    canonicalTimes,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const orderedNames = [
    'sourcePose',
    'maximumWheelAngle',
    'innerRunMidpoint',
    'minimumWheelAngle',
    'cycleClosure',
  ];
  const wheelIndexPositions = [];
  const universalLengths = [];
  for (const [index, name] of orderedNames.entries()) {
    const time = canonicalTimes[name];
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    finiteStateNumbers(model.root.userData.kinematics, `rendered[${name}]`);
    near(
      blocks.wheelRotor.rotation.z,
      state.wheelAngle,
      3e-13,
      `${name} rendered wheel angle`,
    );
    near(
      blocks.wheelShaft.userData.rotor.rotation.z,
      state.wheelAngle,
      3e-13,
      `${name} rendered wheel shaft`,
    );
    near(
      blocks.pinion.userData.rotor.rotation.z,
      state.pinionAngle,
      3e-13,
      `${name} rendered pinion`,
    );
    near(
      blocks.pinionShaft.userData.rotor.rotation.z,
      state.pinionAngle,
      3e-13,
      `${name} rendered pinion shaft`,
    );
    vector2Near(blocks.pinion.position, state.pinionCenter, 2e-13, `${name} guided pinion`);
    vector2Near(blocks.pinionShaft.position, state.pinionCenter, 2e-13, `${name} coaxial shaft`);
    vector2Near(blocks.guideFollower.position, state.pinionCenter, 2e-13, `${name} groove follower`);
    vector2Near(worldPoint(blocks.contactMarker), state.contactPoint, 2e-12, `${name} contact marker`);
    vector2Near(
      blocks.movingUniversalJoint.position,
      state.pinionCenter,
      2e-13,
      `${name} moving universal yoke`,
    );
    const couplingStart = blocks.universalSlipShaft.children[1].position;
    const couplingEnd = blocks.universalSlipShaft.children[2].position;
    vector3Near(
      couplingStart,
      blocks.fixedUniversalCross.position,
      2e-13,
      `${name} fixed universal endpoint`,
    );
    vector3Near(
      couplingEnd,
      blocks.movingUniversalJoint.position,
      2e-13,
      `${name} moving universal endpoint`,
    );
    near(
      blocks.universalSlipShaft.children[0].scale.x,
      couplingStart.distanceTo(couplingEnd),
      2e-13,
      `${name} telescopic shaft closure`,
    );
    near(
      blocks.wheel.userData.angularSpeed,
      state.wheelAngularSpeed,
      3e-13,
      `${name} rendered wheel speed`,
    );
    near(
      blocks.pinion.userData.angularSpeed,
      transmission.pinionAngularSpeed,
      1e-15,
      `${name} rendered constant input speed`,
    );
    wheelIndexPositions.push(worldPoint(blocks.wheelIndex));
    universalLengths.push(couplingStart.distanceTo(couplingEnd));
    if (name === 'maximumWheelAngle' || name === 'minimumWheelAngle') {
      assert.ok(wheelIndexPositions[index].distanceTo(wheelIndexPositions[0]) > 0.35);
    }
  }

  near(canonicalStates.sourcePose.wheelAngle, 0, 2e-14, 'engraving source pose');
  assert.equal(canonicalStates.sourcePose.branch, 'outer-concentric-internal-arc');
  assert.equal(canonicalStates.innerRunMidpoint.branch, 'inner-concentric-external-arc');
  near(
    canonicalStates.sourcePose.wheelToPinionRatio,
    transmission.outerRunRatio,
    2e-14,
    'source pose uses the slow outer circle',
  );
  near(
    canonicalStates.innerRunMidpoint.wheelToPinionRatio,
    transmission.innerRunRatio,
    2e-14,
    'return pose uses the fast inner circle',
  );
  assert.ok(Math.abs(canonicalStates.maximumWheelAngle.wheelAngularSpeed) < 4e-13);
  assert.ok(Math.abs(canonicalStates.minimumWheelAngle.wheelAngularSpeed) < 4e-13);
  near(
    canonicalStates.maximumWheelAngle.wheelAngle,
    transmission.maximumWheelAngle,
    2e-13,
    'left transition is the positive reversal',
  );
  near(
    canonicalStates.minimumWheelAngle.wheelAngle,
    transmission.minimumWheelAngle,
    2e-13,
    'right transition is the negative reversal',
  );
  assert.ok(Math.max(...universalLengths) - Math.min(...universalLengths) > 0.001);
  assert.ok(canonicalTimes.maximumWheelAngle < canonicalTimes.minimumWheelAngle);
  assert.ok(
    canonicalTimes.minimumWheelAngle - canonicalTimes.maximumWheelAngle
      < canonicalTimes.cycleClosure
        - canonicalTimes.minimumWheelAngle + canonicalTimes.maximumWheelAngle,
    'the inner-radius return is faster than the outer-radius drive',
  );
  disposeModel(model.root);
});

test('movement 193 is fully three-dimensional and remains distinct as the review queue advances through 200', () => {
  const model = createMovementModel(catalog.movements[192]);
  const { blocks, canonicalTimes } = model.root.userData;
  const physicalBounds = new THREE.Box3();
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const object of [
      blocks.wheel,
      blocks.wheelShaft,
      blocks.pinion,
      blocks.pinionShaft,
      blocks.fixedUniversalCross,
      blocks.universalSlipShaft,
      blocks.rearInputShaft,
      blocks.framePost,
      blocks.frameFoot,
    ]) physicalBounds.expandByObject(object);
  }
  const size = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 5.0);
  assert.ok(size.y > 5.0);
  assert.ok(size.z > 2.3);
  assert.ok(physicalBounds.min.z < -1.53);
  assert.ok(physicalBounds.max.z > 0.79);
  let meshCount = 0;
  let mangleToothCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
    if (object.userData.role === 'tooth-on-concentric-two-radius-mangle-path') {
      mangleToothCount += 1;
    }
  });
  assert.ok(meshCount >= 95);
  assert.equal(mangleToothCount, 68);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 1.7);
  assert.ok(blocks.wheel.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.pinion.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.wheelShaft.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.pinionShaft.userData.axis.distanceTo(Z_AXIS) < 1e-14);

  const movement192 = createMovementModel(catalog.movements[191]);
  const movement194 = createMovementModel(catalog.movements[193]);
  const movement195 = createMovementModel(catalog.movements[194]);
  const movement196 = createMovementModel(catalog.movements[195]);
  const movement197 = createMovementModel(catalog.movements[196]);
  const movement198 = createMovementModel(catalog.movements[197]);
  const movement199 = createMovementModel(catalog.movements[198]);
  const movement200 = createMovementModel(catalog.movements[199]);
  assert.equal(movement192.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(movement194.root.userData.fidelity, 'authored');
  assert.equal(movement195.root.userData.fidelity, 'authored');
  assert.equal(movement196.root.userData.fidelity, 'authored');
  assert.equal(movement197.root.userData.fidelity, 'authored');
  assert.equal(movement198.root.userData.fidelity, 'authored');
  assert.equal(movement199.root.userData.fidelity, 'authored');
  assert.equal(movement200.root.userData.fidelity, 'authored');
  assert.notEqual(movement192.root.userData.mechanism, model.root.userData.mechanism);
  assert.notEqual(movement194.root.userData.mechanism, model.root.userData.mechanism);
  assert.notEqual(movement192.root.userData.archetype, model.root.userData.archetype);
  assert.notEqual(movement194.root.userData.archetype, model.root.userData.archetype);
  assert.notEqual(movement195.root.userData.archetype, movement194.root.userData.archetype);
  assert.notEqual(movement196.root.userData.archetype, movement195.root.userData.archetype);
  disposeModel(movement192.root);
  disposeModel(movement194.root);
  disposeModel(movement195.root);
  disposeModel(movement196.root);
  disposeModel(movement197.root);
  disposeModel(movement198.root);
  disposeModel(movement199.root);
  disposeModel(movement200.root);
  disposeModel(model.root);
});
