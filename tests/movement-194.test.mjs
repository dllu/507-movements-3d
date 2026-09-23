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

test('movement 194 matches Brown\'s one face-pin circle, one pinion, groove guide, and universal shaft', () => {
  const movement = catalog.movements[193];
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

  assert.equal(movement.id, 194);
  assert.equal(movement.number, '194');
  assert.equal(movement.title, 'Equal-Speed Single-Circle Mangle Wheel');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(
    movement.description,
    '194. Another mangle-wheel. In this the speed is equal in both directions of motion, only one circle of teeth being provided on the wheel. With all of these mangle-wheels the pinion-shaft is guided and the pinion kept in gear by a groove in the wheel. The said shaft is made with a universal joint, which allows a portion of it to have the vibratory motion necessary to keep the pinion in gear.',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'single-coincident-pitch-circle-face-pin-mangle-wheel-equal-forward-reverse-speeds',
  );
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'uniform-pinion-single-double-sided-face-pin-circle-closed-shaft-guide-equal-speed-oscillation',
  );

  assert.equal(blocks.toothPins.length, 25);
  assert.equal(blocks.pinRoots.length, 25);
  assert.equal(blocks.pinion.userData.teeth, 10);
  assert.equal(blocks.wheel.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.wheel);
  assert.equal(blocks.wheelBody.parent, blocks.wheelRotor);
  assert.equal(blocks.singlePitchArc.parent, blocks.wheelRotor);
  assert.equal(blocks.guideGrooveOuter.parent, blocks.wheelRotor);
  assert.equal(blocks.guideGrooveRecess.parent, blocks.wheelRotor);
  assert.equal(blocks.fixedUniversalCross.userData.fixed, true);
  assert.equal(
    blocks.universalSlipShaft.userData.role,
    'large-travel-telescopic-shaft-through-universal-joint',
  );
  blocks.toothPins.forEach((pin, index) => {
    assert.equal(pin.parent, blocks.wheelRotor);
    assert.equal(pin.userData.index, index);
    assert.equal(
      pin.userData.role,
      'double-sided-radial-face-pin-on-single-pitch-circle',
    );
    near(
      pin.position.lengthSq() - pin.position.z ** 2,
      geometry.toothPitchRadius ** 2,
      2e-14,
      `face pin ${index} lies on the one pitch circle`,
    );
  });

  assert.deepEqual(sourceAnchors.wheelCenter.toArray(), [262, 258]);
  assert.deepEqual(sourceAnchors.pinionCenter.toArray(), [260, 456]);
  vector2Near(
    sourceAnchors.modeledPinionCenter,
    new THREE.Vector2(262, 449.39130434782606),
    2e-12,
    'modeled source pinion follows the hand-drawn bottom axle',
  );
  assert.ok(
    sourceAnchors.modeledPinionCenter.distanceTo(
      sourceAnchors.pinionCenter,
    ) < 7,
    'modeled axle remains within the line weight of Brown\'s drawing',
  );
  assert.deepEqual(sourceAnchors.toothPitchBottom.toArray(), [262, 400]);
  vector2Near(
    sourceAnchors.outerGuideBottom,
    new THREE.Vector2(262, 449.39130434782606),
    2e-12,
    'outer shaft-guide branch follows the source',
  );
  vector2Near(
    sourceAnchors.innerGuideBottom,
    new THREE.Vector2(262, 350.6086956521739),
    2e-12,
    'inner shaft-guide branch follows the source',
  );
  near(
    sourceAnchors.terminalContacts[0].x
      + sourceAnchors.terminalContacts[1].x,
    sourceAnchors.wheelCenter.x * 2,
    2e-12,
    'the two terminal tooth contacts are mirror symmetric',
  );
  near(
    sourceAnchors.terminalContacts[0].y,
    sourceAnchors.terminalContacts[1].y,
    2e-12,
    'the two terminal tooth contacts share one height',
  );
  assert.ok(sourceAnchors.terminalContacts[0].x > 191);
  assert.ok(sourceAnchors.terminalContacts[0].x < 192);
  assert.ok(sourceAnchors.terminalContacts[1].x > 332);
  assert.ok(sourceAnchors.terminalContacts[1].x < 333);
  assert.ok(sourceAnchors.terminalContacts[0].y > 134);
  assert.ok(sourceAnchors.terminalContacts[0].y < 135);
  assert.deepEqual(sourceRaster, {
    height: 525,
    scale: 1.15 / 142,
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
    sourcePointToModel(sourceAnchors.toothPitchBottom),
    sourceState.contactPoint,
    2e-12,
    'source bottom pin circle is the initial outside contact',
  );
  vector3Near(
    sourcePointToModel(sourceAnchors.modeledPinionCenter),
    sourceState.pinionCenter,
    2e-12,
    'source pinion shaft begins on the outer guide branch',
  );
  assert.equal(sourceState.branch, 'outside-of-single-face-pin-circle');
  assert.equal(sourceState.activeSide, 'outside');

  let wheelCount = 0;
  let pinionCount = 0;
  const forbiddenRoles = [];
  model.root.traverse((object) => {
    if (object.userData.role === 'single-face-pin-circle-mangle-wheel') {
      wheelCount += 1;
    }
    if (object.userData.role === 'uniformly-rotating-single-face-pin-pinion') {
      pinionCount += 1;
    }
    if (/belt|pulley|rack|cam|spring/i.test(object.userData.role ?? '')) {
      forbiddenRoles.push(object.userData.role);
    }
  });
  assert.equal(wheelCount, 1);
  assert.equal(pinionCount, 1);
  assert.deepEqual(forbiddenRoles, []);
  disposeModel(model.root);
});

test('movement 194 closes one tangent shaft guide around exactly one double-sided pitch circle', () => {
  const model = createMovementModel(catalog.movements[193]);
  const {
    evaluateGuideArc,
    geometry,
    stateAtGuideDistance,
  } = model.root.userData;
  const { guideSegments } = geometry;

  assert.equal(guideSegments.length, 4);
  assert.deepEqual(
    guideSegments.map(({ kind }) => kind),
    [
      'outside-of-single-face-pin-circle',
      'upper-right-terminal-reversal',
      'inside-of-single-face-pin-circle',
      'upper-left-terminal-reversal',
    ],
  );
  assert.deepEqual(
    guideSegments.map(({ contactMode }) => contactMode),
    ['outside', 'right-terminal', 'inside', 'left-terminal'],
  );
  vector2Near(guideSegments[0].center, new THREE.Vector2(), 1e-15, 'outer branch center');
  vector2Near(guideSegments[2].center, new THREE.Vector2(), 1e-15, 'inner branch center');
  near(
    geometry.outerGuideRadius,
    geometry.toothPitchRadius + geometry.pinionPitchRadius,
    1e-15,
    'outer guide is one pinion radius outside the shared tooth circle',
  );
  near(
    geometry.innerGuideRadius,
    geometry.toothPitchRadius - geometry.pinionPitchRadius,
    1e-15,
    'inner guide is one pinion radius inside the shared tooth circle',
  );
  near(
    geometry.circularPitch,
    FULL_TURN * geometry.pinionPitchRadius / geometry.pinionTeeth,
    1e-15,
    'pinion circular pitch',
  );
  near(
    geometry.toothArcLength,
    geometry.circularPitch * geometry.toothPitchIntervals,
    2e-14,
    '25 pins span 24 exact tooth pitches',
  );
  near(
    geometry.mainArcSweep + geometry.gapHalfAngle * 2,
    FULL_TURN,
    2e-14,
    'one upper gap closes the single pin circle',
  );
  near(geometry.guideAngleClosureError, 0, 2e-14, 'closed guide angle');
  near(
    geometry.guidePerimeter,
    guideSegments.reduce((sum, segment) => sum + segment.guideLength, 0),
    2e-14,
    'closed guide perimeter is the sum of its four arcs',
  );

  for (let index = 0; index < guideSegments.length; index += 1) {
    const segment = guideSegments[index];
    const next = guideSegments[(index + 1) % guideSegments.length];
    const end = evaluateGuideArc(segment, 1);
    const start = evaluateGuideArc(next, 0);
    vector2Near(end.guidePoint, start.guidePoint, 3e-14, `guide joint ${index}`);
    vector2Near(end.tangent, start.tangent, 3e-14, `guide tangent ${index}`);
    vector2Near(end.contactPoint, start.contactPoint, 3e-14, `contact joint ${index}`);
  }

  for (let index = 0; index < geometry.toothPitchCoordinates.length; index += 1) {
    near(
      geometry.toothPitchCoordinates[index],
      index * geometry.circularPitch,
      2e-14,
      `single-circle pin pitch ${index}`,
    );
  }
  assert.equal(geometry.toothPitchCoordinates.length, geometry.toothPinCount);
  for (let index = 0; index < 4096; index += 1) {
    const state = stateAtGuideDistance(
      geometry.guidePerimeter * index / 4096,
    );
    near(
      state.contactPoint.length(),
      geometry.toothPitchRadius,
      3e-14,
      `one shared contact circle at guide sample ${index}`,
    );
    near(
      state.contactPoint.distanceTo(state.guidePoint),
      geometry.pinionPitchRadius,
      3e-14,
      `pinion remains tangent at guide sample ${index}`,
    );
  }
  disposeModel(model.root);
});

test('movement 194 keeps exact rolling and equal opposite main-run speeds over 32,769 states', () => {
  const model = createMovementModel(catalog.movements[193]);
  const {
    geometry,
    stateAtCycleProgress,
    stateAtInputTravel,
    transmission,
  } = model.root.userData;
  const sampleCount = 32769;
  let maximumContactError = 0;
  let maximumGuideLineError = 0;
  let maximumMeshPhaseError = 0;
  let maximumRollingError = 0;
  let maximumShaftVelocityError = 0;
  let maximumSingleCircleError = 0;
  let minimumCenterRadius = Infinity;
  let maximumCenterRadius = -Infinity;
  let minimumWheelAngle = Infinity;
  let maximumWheelAngle = -Infinity;
  let previousWheelAngle = null;
  let previousNonzeroSign = null;
  let reversalCount = 0;
  let outsideStateCount = 0;
  let insideStateCount = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / (sampleCount - 1);
    const state = stateAtCycleProgress(progress);
    finiteStateNumbers(state, `state[${index}]`);
    maximumContactError = Math.max(maximumContactError, state.contactDistanceError);
    maximumGuideLineError = Math.max(maximumGuideLineError, state.guideLineError);
    maximumRollingError = Math.max(maximumRollingError, state.rollingVelocityError);
    maximumShaftVelocityError = Math.max(
      maximumShaftVelocityError,
      state.shaftGuideVelocityError,
    );
    maximumSingleCircleError = Math.max(
      maximumSingleCircleError,
      state.singlePitchCircleError,
    );
    if (state.meshPhaseError !== null) {
      maximumMeshPhaseError = Math.max(
        maximumMeshPhaseError,
        Math.abs(state.meshPhaseError),
      );
    }
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
    if (state.branch === 'outside-of-single-face-pin-circle') {
      outsideStateCount += 1;
      near(
        state.wheelToPinionRatio,
        transmission.outsideRunRatio,
        3e-14,
        `constant outside ratio ${index}`,
      );
    }
    if (state.branch === 'inside-of-single-face-pin-circle') {
      insideStateCount += 1;
      near(
        state.wheelToPinionRatio,
        transmission.insideRunRatio,
        3e-14,
        `constant inside ratio ${index}`,
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
  assert.ok(maximumMeshPhaseError < 8e-13);
  assert.ok(maximumRollingError < 8e-13);
  assert.ok(maximumShaftVelocityError < 8e-13);
  assert.ok(maximumSingleCircleError < 8e-14);
  assert.equal(reversalCount, 2);
  assert.ok(outsideStateCount > 13000);
  assert.ok(insideStateCount > 13000);
  assert.ok(Math.abs(outsideStateCount - insideStateCount) <= 1);
  near(maximumCenterRadius, geometry.outerGuideRadius, 3e-12, 'outer guide radius');
  near(minimumCenterRadius, geometry.innerGuideRadius, 3e-12, 'inner guide radius');
  near(maximumWheelAngle, transmission.maximumWheelAngle, 3e-7, 'sampled maximum');
  near(minimumWheelAngle, transmission.minimumWheelAngle, 3e-7, 'sampled minimum');
  near(
    transmission.insideRunRatio,
    -transmission.outsideRunRatio,
    2e-15,
    'equal and opposite main-run ratios',
  );
  near(transmission.speedMagnitudeMismatch, 0, 2e-15, 'zero speed mismatch');
  near(
    transmission.insideDirectionInputTravel,
    transmission.outsideDirectionInputTravel,
    2e-14,
    'equal input travel in both wheel directions',
  );
  assert.ok(transmission.wheelSwing > 5.9);
  assert.ok(transmission.wheelSwing < FULL_TURN);
  near(
    transmission.pinionRevolutionsPerMangleCycle,
    5.8,
    2e-14,
    'pinion turns per closed guide cycle',
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
    'pinion tooth phase closes after the complete guide path',
  );
  disposeModel(model.root);
});

test('movement 194 rendered transforms keep the one pinion captured through both equal-speed runs and both smooth reversals', () => {
  const model = createMovementModel(catalog.movements[193]);
  const {
    blocks,
    canonicalStates,
    canonicalTimes,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const orderedNames = [
    'sourcePose',
    'minimumWheelAngle',
    'insideRunMidpoint',
    'maximumWheelAngle',
    'cycleClosure',
  ];
  const universalLengths = [];
  const centerRadii = [];
  for (const name of orderedNames) {
    const time = canonicalTimes[name];
    const state = canonicalStates[name];
    model.update(time);
    model.root.updateMatrixWorld(true);
    const evaluated = stateAtTime(time);
    vector3Near(evaluated.pinionCenter, state.pinionCenter, 3e-14, `${name} state`);
    near(blocks.wheelRotor.rotation.z, state.wheelAngle, 3e-14, `${name} wheel`);
    near(
      blocks.wheelShaft.userData.rotor.rotation.z,
      state.wheelAngle,
      3e-14,
      `${name} wheel shaft`,
    );
    near(
      blocks.pinion.userData.rotor.rotation.z,
      state.pinionAngle,
      3e-14,
      `${name} pinion`,
    );
    near(
      blocks.pinionShaft.userData.rotor.rotation.z,
      state.pinionAngle,
      3e-14,
      `${name} moving shaft`,
    );
    vector3Near(blocks.pinion.position, new THREE.Vector3(state.pinionCenter.x, state.pinionCenter.y, model.root.userData.finiteGuide.pinionPlaneZ), 1e-14, `${name} rendered pinion center`);
    vector2Near(blocks.pinion.position, state.pinionCenter, 3e-14, `${name} pinion xy`);
    vector2Near(blocks.pinionShaft.position, state.pinionCenter, 3e-14, `${name} shaft xy`);
    vector2Near(blocks.guideFollower.position, state.pinionCenter, 3e-14, `${name} follower xy`);
    vector2Near(blocks.contactMarker.position, state.contactPoint, 3e-14, `${name} contact marker`);
    assert.equal(model.root.userData.contacts.singleFacePinCircleMesh.activeSide, state.activeSide);
    near(
      model.root.userData.contacts.singleFacePinCircleMesh.rollingVelocityError,
      state.rollingVelocityError,
      2e-15,
      `${name} published rolling contact`,
    );
    universalLengths.push(
      blocks.fixedUniversalCross.position.distanceTo(
        blocks.movingUniversalJoint.position,
      ),
    );
    centerRadii.push(state.pinionCenterRadius);
  }

  assert.equal(canonicalStates.sourcePose.activeSide, 'outside');
  assert.equal(canonicalStates.minimumWheelAngle.activeSide, 'right-terminal');
  assert.equal(canonicalStates.insideRunMidpoint.activeSide, 'inside');
  assert.equal(canonicalStates.maximumWheelAngle.activeSide, 'left-terminal');
  near(
    canonicalStates.minimumWheelAngle.wheelAngularSpeed,
    0,
    2e-14,
    'right terminal reaches rest before reversal',
  );
  near(
    canonicalStates.maximumWheelAngle.wheelAngularSpeed,
    0,
    2e-14,
    'left terminal reaches rest before reversal',
  );
  near(
    canonicalStates.insideRunMidpoint.wheelAngularSpeed,
    -canonicalStates.sourcePose.wheelAngularSpeed,
    2e-14,
    'rendered forward and reverse runs have equal speed magnitude',
  );
  assert.ok(Math.max(...centerRadii) - Math.min(...centerRadii) > 0.79);
  assert.ok(Math.max(...universalLengths) - Math.min(...universalLengths) > 0.09);
  assert.ok(canonicalTimes.sourcePose < canonicalTimes.minimumWheelAngle);
  assert.ok(canonicalTimes.minimumWheelAngle < canonicalTimes.insideRunMidpoint);
  assert.ok(canonicalTimes.insideRunMidpoint < canonicalTimes.maximumWheelAngle);
  assert.ok(canonicalTimes.maximumWheelAngle < canonicalTimes.cycleClosure);
  near(
    canonicalTimes.minimumWheelAngle,
    canonicalTimes.cycleClosure - canonicalTimes.maximumWheelAngle,
    2e-14,
    'equal timing from the source midpoint to either reversal',
  );
  near(
    canonicalTimes.insideRunMidpoint,
    canonicalTimes.cycleClosure / 2,
    2e-14,
    'inside midpoint occurs halfway through the cycle',
  );
  near(
    canonicalStates.maximumWheelAngle.wheelAngle
      - canonicalStates.minimumWheelAngle.wheelAngle,
    transmission.wheelSwing,
    2e-14,
    'canonical reversal states span the modeled wheel swing',
  );
  disposeModel(model.root);
});

test('movement 194 is fully three-dimensional and remains distinct as the review queue advances through 200', () => {
  const model = createMovementModel(catalog.movements[193]);
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
  assert.ok(size.x > 4.3);
  assert.ok(size.y > 4.4);
  assert.ok(size.z > 2.3);
  assert.ok(physicalBounds.min.z < -0.76);
  assert.ok(physicalBounds.max.z > 0.79);
  let meshCount = 0;
  let facePinCount = 0;
  let facePinSeatCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
    if (object.userData.role === 'double-sided-radial-face-pin-on-single-pitch-circle') {
      facePinCount += 1;
    }
    if (object.userData.role === 'dark-seat-of-double-sided-face-pin') {
      facePinSeatCount += 1;
    }
  });
  assert.ok(meshCount >= 72, "the undrawn standard and foot are presented away");
  assert.equal(facePinCount, 25);
  assert.equal(facePinSeatCount, 25);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 1.7);
  assert.ok(blocks.wheel.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.pinion.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.wheelShaft.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.pinionShaft.userData.axis.distanceTo(Z_AXIS) < 1e-14);

  const movement193 = createMovementModel(catalog.movements[192]);
  const movement195 = createMovementModel(catalog.movements[194]);
  const movement196 = createMovementModel(catalog.movements[195]);
  const movement197 = createMovementModel(catalog.movements[196]);
  const movement198 = createMovementModel(catalog.movements[197]);
  const movement199 = createMovementModel(catalog.movements[198]);
  const movement200 = createMovementModel(catalog.movements[199]);
  assert.equal(movement193.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(movement195.root.userData.fidelity, 'authored');
  assert.equal(movement196.root.userData.fidelity, 'authored');
  assert.equal(movement197.root.userData.fidelity, 'authored');
  assert.equal(movement198.root.userData.fidelity, 'authored');
  assert.equal(movement199.root.userData.fidelity, 'authored');
  assert.equal(movement200.root.userData.fidelity, 'authored');
  assert.notEqual(movement193.root.userData.mechanism, model.root.userData.mechanism);
  assert.notEqual(movement195.root.userData.mechanism, model.root.userData.mechanism);
  assert.notEqual(movement193.root.userData.archetype, model.root.userData.archetype);
  assert.notEqual(movement195.root.userData.archetype, model.root.userData.archetype);
  assert.notEqual(movement196.root.userData.archetype, movement195.root.userData.archetype);
  disposeModel(movement193.root);
  disposeModel(movement195.root);
  disposeModel(movement196.root);
  disposeModel(movement197.root);
  disposeModel(movement198.root);
  disposeModel(movement199.root);
  disposeModel(movement200.root);
  disposeModel(model.root);
});
