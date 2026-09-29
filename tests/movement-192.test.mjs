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

test('movement 192 matches Brown\'s eccentric toothed path, shaft groove, and omitted-but-required pinion', () => {
  const movement = catalog.movements[191];
  const model = createMovementModel(movement);
  const {
    blocks,
    geometry,
    modelPointToSourceRaster,
    sourceAnchors,
    sourcePointToModel,
    stateAtCycleProgress,
  } = model.root.userData;

  assert.equal(movement.id, 192);
  assert.equal(movement.number, '192');
  assert.equal(movement.title, 'Eccentric Variable-Speed Mangle Wheel');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(
    movement.description,
    '192. A variety of what is known as the “mangle-wheel.” One variety of this was illustrated by 36. In this one the speed varies in every part of a revolution, the groove, b, d, in which the pinion-shaft is guided, as well as the series of teeth, being eccentric to the axis of the wheel.',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'eccentric-closed-groove-mangle-wheel-continuously-variable-forward-reverse-speed',
  );
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'uniform-pinion-eccentric-tooth-and-shaft-guide-path-variable-speed-oscillating-mangle-wheel',
  );

  assert.equal(blocks.mangleToothObjects.length, 0);
  assert.equal(blocks.toothLand.parent, blocks.wheelRotor);
  assert.equal(blocks.pinion.userData.teeth, 6);
  assert.equal(blocks.wheel.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.wheel);
  assert.equal(blocks.wheelBody.parent, blocks.wheelRotor);
  assert.equal(blocks.pitchGroove.parent, blocks.wheelRotor);
  assert.equal(blocks.guideGrooveOuter.parent, blocks.wheelRotor);
  assert.equal(blocks.guideGrooveRecess.parent, blocks.wheelRotor);
  // p109: mangle wheels need no universal-joint drive (as 194). The
  // jointed drive and its standard are left out, and the pinion shaft ends
  // just proud of the pinion's hub.
  for (const key of ['fixedUniversalCross', 'universalSlipShaft', 'rearInputShaft', 'movingUniversalJoint', 'framePost', 'frameFoot']) {
    assert.equal(blocks[key].parent, null, key);
  }
  assert.equal(blocks.universalDrive, undefined);
  model.root.traverse((object) => assert.ok(!/universal|slip-shaft|input-shaft/.test(object.userData.role ?? ''), object.userData.role));
  {
    model.root.updateMatrixWorld(true);
    const shaft = new THREE.Box3().setFromObject(blocks.pinionShaft);
    const pinion = new THREE.Box3().setFromObject(blocks.pinion);
    assert.ok(shaft.max.z > pinion.max.z && shaft.max.z < pinion.max.z + 0.05, `shaft end ${shaft.max.z}`);
  }
  assert.ok(Math.abs(model.cameraDirection.y / model.cameraDirection.z) < 0.06, 'face-on default camera');
  blocks.mangleToothObjects.forEach((tooth, index) => {
    assert.equal(tooth.parent, blocks.wheelRotor);
    assert.equal(tooth.userData.index, index);
    assert.equal(tooth.userData.role, 'tooth-on-eccentric-closed-mangle-path');
  });

  vector3Near(
    sourcePointToModel(sourceAnchors.wheelCenter),
    new THREE.Vector3(),
    1e-12,
    'Brown\'s wheel shaft is the authored fixed axis',
  );
  // The traced pitch knots stay on Brown's crenellated tooth row.
  assert.equal(geometry.tracedPitchKnots.length, 56);
  assert.equal(geometry.toothLandInsidePitchLoop, true);
  for (const [x, y] of geometry.tracedPitchKnots) {
    const knot = sourcePointToModel(new THREE.Vector2(x, y));
    let nearest = Infinity;
    for (let index = 0; index < 4096; index += 1) {
      const point = model.root.userData.stateAtPitchDistance(
        geometry.pitchPerimeter * index / 4096,
      ).point;
      nearest = Math.min(nearest, point.distanceTo(knot));
    }
    assert.ok(nearest < 0.003, `pitch curve passes traced knot ${x},${y}`);
  }
  // A hooked path: the rim run reaches near the rim, the hub lobe passes
  // close under the shaft and the groove stays inside the wheel.
  assert.ok(geometry.maximumGuideRadius > 1.8);
  assert.ok(geometry.maximumGuideRadius + 0.064 < geometry.wheelRadius);
  assert.ok(geometry.minimumGuideRadius < 0.5);
  assert.ok(geometry.minimumConcavePitchRadius > geometry.pinionPitchRadius + 0.3);
  assert.equal(geometry.wheelReversalCount, 2);
  vector2Near(
    modelPointToSourceRaster(sourcePointToModel(sourceAnchors.hubLobeBottom)),
    sourceAnchors.hubLobeBottom,
    1e-10,
    'source mapping round trip',
  );
  const sourceState = stateAtCycleProgress(0);
  near(sourceState.wheelAngle, 0, 2e-14, 'source wheel pose');
  assert.ok(
    sourcePointToModel(sourceAnchors.hubLobeBottom)
      .distanceTo(sourceState.contactPoint) < 0.02,
    'omitted pinion starts under the hub lobe, wholly on the wheel',
  );
  vector3Near(
    sourcePointToModel(sourceAnchors.pinionCenter),
    sourceState.pinionCenter,
    2e-12,
    'the inferred pinion shaft begins inside Brown\'s guide groove',
  );

  let mangleWheelCount = 0;
  let inputPinionCount = 0;
  const forbiddenRoles = [];
  model.root.traverse((object) => {
    if (object.userData.role === 'eccentric-tooth-and-guide-path-mangle-wheel') {
      mangleWheelCount += 1;
    }
    if (object.userData.role === 'uniformly-rotating-input-pinion') {
      inputPinionCount += 1;
    }
    if (/belt|pulley|cam|spring/i.test(object.userData.role ?? '')) {
      forbiddenRoles.push(object.userData.role);
    }
  });
  assert.equal(mangleWheelCount, 1);
  assert.equal(inputPinionCount, 1);
  assert.deepEqual(forbiddenRoles, []);
  disposeModel(model.root);
});

test('movement 192 closes one tangent-continuous eccentric pitch path and its exact parallel shaft guide', () => {
  const model = createMovementModel(catalog.movements[191]);
  const {
    blocks,
    evaluateArc,
    geometry,
    stateAtPitchDistance,
  } = model.root.userData;
  const { pitchSegments } = geometry;
  assert.equal(pitchSegments.length, 112);
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
    '65 mangle pitches close the traced tooth path',
  );
  near(
    geometry.pitchPerimeter,
    pitchSegments.reduce((sum, segment) => sum + segment.radius * Math.abs(segment.sweep), 0),
    2e-14,
    'tangent-continuous biarcs make the pitch perimeter',
  );
  near(
    geometry.guidePerimeter,
    geometry.pitchPerimeter + FULL_TURN * geometry.pinionPitchRadius,
    2e-13,
    'the outward parallel guide is one pinion circumference longer',
  );
  near(
    geometry.totalPinionTravel,
    geometry.guidePerimeter / geometry.pinionPitchRadius,
    3e-13,
    'closed guide traversal is the exact pinion input travel',
  );
  near(
    geometry.totalPinionTravel / FULL_TURN,
    geometry.mangleTeeth / geometry.pinionTeeth + 1,
    2e-13,
    'one mangle cycle takes exactly 11 5/6 pinion revolutions',
  );
  assert.ok(Math.abs(geometry.guideAngleClosureError) < 2e-14);

  for (let index = 0; index < pitchSegments.length; index += 1) {
    const current = pitchSegments[index];
    const next = pitchSegments[(index + 1) % pitchSegments.length];
    const end = evaluateArc(current, 1);
    const start = evaluateArc(next, 0);
    vector2Near(end.point, start.point, 5e-14, `pitch join ${index}`);
    vector2Near(end.guidePoint, start.guidePoint, 5e-14, `guide join ${index}`);
    assert.ok(end.tangent.dot(start.tangent) > 1 - 2e-14);
    assert.ok(end.rightNormal.dot(start.rightNormal) > 1 - 2e-14);
    assert.ok(current.pinionTravelLength > 0);
    near(
      current.guideScale,
      current.guideRadius / current.radius,
      1e-15,
      `parallel-curve scale ${index}`,
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
    geometry.toothOriginPitchDistance,
    geometry.toothOriginPitchDistance,
    2e-14,
    'first mangle tooth is source-contact indexed',
  );
  assert.equal(blocks.pitchGroove.parent, blocks.wheelRotor);
  assert.equal(blocks.guideGrooveOuter.parent, blocks.wheelRotor);
  assert.equal(blocks.guideGrooveRecess.parent, blocks.wheelRotor);
  disposeModel(model.root);
});

test('movement 192 keeps constant pinion input, exact rolling contact, and variable speed over 32,769 states', () => {
  const model = createMovementModel(catalog.movements[191]);
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
  let previousNonzeroSign = null;
  let reversalCount = 0;
  let previousWheelAngle = null;
  const branchMinimumRatios = new Map();
  const branchMaximumRatios = new Map();
  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / (sampleCount - 1);
    const state = stateAtCycleProgress(progress);
    finiteStateNumbers(state, `state[${index}]`);
    maximumContactError = Math.max(
      maximumContactError,
      state.contactDistanceError,
    );
    maximumGuideLineError = Math.max(
      maximumGuideLineError,
      state.guideLineError,
    );
    maximumGuideOffsetError = Math.max(
      maximumGuideOffsetError,
      state.guideOffsetError,
    );
    maximumMeshPhaseError = Math.max(
      maximumMeshPhaseError,
      Math.abs(state.meshPhaseError),
    );
    maximumRollingError = Math.max(
      maximumRollingError,
      state.rollingVelocityError,
    );
    maximumShaftVelocityError = Math.max(
      maximumShaftVelocityError,
      state.shaftGuideVelocityError,
    );
    near(
      state.inputTravel,
      progress * geometry.totalPinionTravel,
      3e-12,
      `uniform input angle ${index}`,
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
      `instantaneous output ratio ${index}`,
    );
    near(state.tangent.length(), 1, 3e-14, `contact tangent ${index}`);
    near(state.rightNormal.length(), 1, 3e-14, `contact normal ${index}`);
    near(
      state.tangent.dot(state.rightNormal),
      0,
      3e-14,
      `contact frame ${index}`,
    );
    assert.ok(state.pinionTravelDerivative > 0);
    branchMinimumRatios.set(
      state.branch,
      Math.min(
        branchMinimumRatios.get(state.branch) ?? Infinity,
        state.wheelToPinionRatio,
      ),
    );
    branchMaximumRatios.set(
      state.branch,
      Math.max(
        branchMaximumRatios.get(state.branch) ?? -Infinity,
        state.wheelToPinionRatio,
      ),
    );
    const sign = Math.abs(state.wheelToPinionRatio) < 1e-10
      ? null
      : Math.sign(state.wheelToPinionRatio);
    if (sign != null && previousNonzeroSign != null && sign !== previousNonzeroSign) {
      reversalCount += 1;
    }
    if (sign != null) previousNonzeroSign = sign;
    if (previousWheelAngle != null) {
      assert.ok(
        Math.abs(state.wheelAngle - previousWheelAngle) < 0.002,
        `wheel angle remains continuous at sample ${index}`,
      );
    }
    previousWheelAngle = state.wheelAngle;
  }
  assert.ok(maximumContactError < 2e-13);
  assert.ok(maximumGuideLineError < 2e-13);
  assert.ok(maximumGuideOffsetError < 2e-13);
  assert.ok(maximumMeshPhaseError < 2e-12);
  assert.ok(maximumRollingError < 2e-12);
  assert.ok(maximumShaftVelocityError < 2e-12);
  assert.equal(reversalCount, 2);
  assert.ok(branchMaximumRatios.size > 100, 'every traced biarc is driven');
  // Isolated stationary samples are smooth ratio extrema; a constant-speed
  // interval would give a run of them.
  let constantRun = 0;
  let longestConstantRun = 0;
  for (let index = 1; index < 4096; index += 1) {
    const before = stateAtCycleProgress((index - 1) / 4096).wheelToPinionRatio;
    const after = stateAtCycleProgress(index / 4096).wheelToPinionRatio;
    constantRun = Math.abs(after - before) < 1e-7 ? constantRun + 1 : 0;
    longestConstantRun = Math.max(longestConstantRun, constantRun);
  }
  assert.ok(longestConstantRun <= 2, 'the speed varies in every part of the path');
  assert.ok(transmission.maximumRatio > 0.28 && transmission.maximumRatio < 0.29);
  assert.ok(transmission.minimumRatio < -0.14 && transmission.minimumRatio > -0.15);

  const source = stateAtCycleProgress(0);
  const closure = stateAtCycleProgress(1);
  near(closure.wheelAngle, source.wheelAngle, 3e-13, 'wheel cycle closure');
  vector3Near(closure.contactPoint, source.contactPoint, 3e-13, 'contact closure');
  vector3Near(closure.pinionCenter, source.pinionCenter, 3e-13, 'guide closure');
  near(
    closure.pinionAngle - source.pinionAngle,
    geometry.totalPinionTravel,
    3e-13,
    'uniform pinion completes the exact cycle travel',
  );
  assert.ok(transmission.wheelSwing > 5.738);
  assert.ok(transmission.wheelSwing < 5.740);
  assert.ok(transmission.maximumWheelAngle > 3.066);
  assert.ok(transmission.minimumWheelAngle < -2.672);
  assert.ok(transmission.slowDirectionInputTravel > 47.6);
  assert.ok(transmission.fastDirectionInputTravel < 26.8);
  assert.ok(
    transmission.slowDirectionInputTravel
      > transmission.fastDirectionInputTravel * 1.78,
    'the rim-side direction takes substantially longer',
  );
  near(
    transmission.pinionRevolutionsPerMangleCycle,
    71 / 6,
    2e-13,
    'pinion revolutions per oscillation',
  );

  for (const progress of [0.03, 0.17, 0.42, 0.58, 0.81, 0.94]) {
    const inputTravel = progress * geometry.totalPinionTravel;
    const state = stateAtInputTravel(inputTravel);
    const travelStep = 1e-4;
    const before = stateAtInputTravel(inputTravel - travelStep);
    const after = stateAtInputTravel(inputTravel + travelStep);
    const numericalAcceleration = (
      after.wheelAngularSpeed - before.wheelAngularSpeed
    ) / (2 * travelStep / transmission.pinionAngularSpeed);
    near(
      state.wheelAngularAcceleration,
      numericalAcceleration,
      3e-5,
      `wheel acceleration at progress ${progress}`,
    );
  }
  disposeModel(model.root);
});

test('movement 192 rendered transforms keep the pinion captured while the wheel reverses slowly and quickly', () => {
  const model = createMovementModel(catalog.movements[191]);
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
    'outerRunBottom',
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
      `${name} rendered pinion angle`,
    );
    near(
      blocks.pinionShaft.userData.rotor.rotation.z,
      state.pinionAngle,
      3e-13,
      `${name} rendered pinion shaft`,
    );
    vector2Near(
      blocks.pinion.position,
      state.pinionCenter,
      2e-13,
      `${name} pinion follows the guide`,
    );
    vector2Near(
      blocks.pinionShaft.position,
      state.pinionCenter,
      2e-13,
      `${name} shaft remains coaxial with pinion`,
    );
    vector2Near(
      blocks.guideFollower.position,
      state.pinionCenter,
      2e-13,
      `${name} collar remains captured`,
    );
    vector2Near(
      worldPoint(blocks.contactMarker),
      state.contactPoint,
      2e-12,
      `${name} contact marker`,
    );
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
    // The beam runs between the fixed joint centre's surface (r 0.1) and the
    // moving yoke's surface (r 0.085), each with a 0.001 running gap.
    near(
      blocks.universalSlipShaft.children[0].scale.x,
      couplingStart.distanceTo(couplingEnd) - 0.1 - 0.085 - 0.002,
      2e-13,
      `${name} telescopic shaft closes between the joints`,
    );
    near(
      blocks.wheel.userData.angularSpeed,
      state.wheelAngularSpeed,
      3e-13,
      `${name} rendered variable wheel speed`,
    );
    near(
      blocks.pinion.userData.angularSpeed,
      transmission.pinionAngularSpeed,
      1e-15,
      `${name} rendered constant pinion speed`,
    );
    wheelIndexPositions.push(
      new THREE.Vector3(1, 0, 0).applyQuaternion(
        blocks.wheelRotor.getWorldQuaternion(new THREE.Quaternion()),
      ),
    );
    universalLengths.push(couplingStart.distanceTo(couplingEnd));
    if (name === 'maximumWheelAngle' || name === 'minimumWheelAngle') {
      assert.ok(wheelIndexPositions[index].distanceTo(wheelIndexPositions[0]) > 0.35);
    }
  }
  near(
    canonicalStates.sourcePose.wheelAngle,
    0,
    2e-14,
    'source pose is the engraving orientation',
  );
  assert.ok(Math.abs(canonicalStates.maximumWheelAngle.wheelAngularSpeed) < 3e-13);
  assert.ok(Math.abs(canonicalStates.minimumWheelAngle.wheelAngularSpeed) < 3e-13);
  near(
    canonicalStates.maximumWheelAngle.wheelAngle,
    transmission.maximumWheelAngle,
    2e-13,
    'upper-left transition is the positive reversal',
  );
  near(
    canonicalStates.minimumWheelAngle.wheelAngle,
    transmission.minimumWheelAngle,
    2e-13,
    'upper-right transition is the negative reversal',
  );
  assert.ok(Math.max(...universalLengths) - Math.min(...universalLengths) > 0.01);
  assert.ok(canonicalTimes.maximumWheelAngle < canonicalTimes.minimumWheelAngle);
  assert.ok(
    canonicalTimes.maximumWheelAngle < canonicalTimes.outerRunBottom
      && canonicalTimes.outerRunBottom < canonicalTimes.minimumWheelAngle,
  );
  assert.ok(
    canonicalTimes.minimumWheelAngle - canonicalTimes.maximumWheelAngle
      > canonicalTimes.cycleClosure
        - canonicalTimes.minimumWheelAngle + canonicalTimes.maximumWheelAngle,
    'the hub-lobe return is faster than the rim-side drive',
  );
  disposeModel(model.root);
});

test('movement 192 is fully three-dimensional and remains distinct as the review queue advances through 200', () => {
  const model = createMovementModel(catalog.movements[191]);
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
    ]) physicalBounds.expandByObject(object);
  }
  const size = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 3.8);
  assert.ok(size.y > 3.8);
  assert.ok(size.z > 1.1);
  assert.ok(physicalBounds.min.z < -0.50);
  assert.ok(physicalBounds.max.z > 0.59 && physicalBounds.max.z < 0.61);
  let meshCount = 0;
  let mangleToothCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
    if (object.userData.role === 'tooth-on-eccentric-closed-mangle-path') {
      mangleToothCount += 1;
    }
  });
  assert.ok(meshCount >= 14);
  assert.ok(blocks.toothLand.geometry.attributes.position.count > 1000);
  assert.equal(mangleToothCount, 0);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 1.7);
  assert.ok(blocks.wheel.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.pinion.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.wheelShaft.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.pinionShaft.userData.axis.distanceTo(Z_AXIS) < 1e-14);

  const movement191 = createMovementModel(catalog.movements[190]);
  const movement193 = createMovementModel(catalog.movements[192]);
  const movement194 = createMovementModel(catalog.movements[193]);
  const movement195 = createMovementModel(catalog.movements[194]);
  const movement196 = createMovementModel(catalog.movements[195]);
  const movement197 = createMovementModel(catalog.movements[196]);
  const movement198 = createMovementModel(catalog.movements[197]);
  const movement199 = createMovementModel(catalog.movements[198]);
  const movement200 = createMovementModel(catalog.movements[199]);
  assert.equal(movement191.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(movement193.root.userData.fidelity, 'authored');
  assert.equal(movement194.root.userData.fidelity, 'authored');
  assert.equal(movement195.root.userData.fidelity, 'authored');
  assert.equal(movement196.root.userData.fidelity, 'authored');
  assert.equal(movement197.root.userData.fidelity, 'authored');
  assert.equal(movement198.root.userData.fidelity, 'authored');
  assert.equal(movement199.root.userData.fidelity, 'authored');
  assert.equal(movement200.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement191.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement193.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement194.root.userData.mechanism,
    movement193.root.userData.mechanism,
  );
  assert.notEqual(
    movement191.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.notEqual(
    movement193.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.notEqual(
    movement194.root.userData.archetype,
    movement193.root.userData.archetype,
  );
  disposeModel(movement191.root);
  disposeModel(movement193.root);
  disposeModel(movement194.root);
  disposeModel(movement195.root);
  disposeModel(movement196.root);
  disposeModel(movement197.root);
  disposeModel(movement198.root);
  disposeModel(movement199.root);
  disposeModel(movement200.root);
  disposeModel(model.root);
});

test('p101: 192 and 193 teeth stand over a darker sunk groove floor, not the land colour', () => {
  for (const id of [192, 193]) {
    const model = createMovementModel(catalog.movements[id - 1]);
    const b = model.root.userData.blocks;
    assert.equal(b.pitchGroove.userData.role, 'darker-sunk-groove-floor-under-mangle-teeth');
    const floor = b.pitchGroove.material.color, land = b.toothLand.material.color;
    assert.ok(floor.r < land.r * 0.7 && floor.g < land.g * 0.7 && floor.b < land.b * 0.7, `${id} floor is darker`);
    b.pitchGroove.geometry.computeBoundingBox();
    b.toothLand.geometry.computeBoundingBox();
    const face = model.root.userData.finiteGuide.frontZ;
    assert.ok(Math.abs(b.pitchGroove.geometry.boundingBox.max.z - (face - 0.02)) < 1e-6, `${id} floor sits 0.02 under the face`);
    assert.ok(Math.abs(b.toothLand.geometry.boundingBox.min.z - (face - 0.02)) < 1e-6, `${id} land reaches the sunk floor`);
  }
});
