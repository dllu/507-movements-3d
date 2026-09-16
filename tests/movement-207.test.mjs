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
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
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

function radialDistanceToAxis(point, origin, axis) {
  const offset = point.clone().sub(origin);
  return offset.addScaledVector(axis, -offset.dot(axis)).length();
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

test('movement 207 is one common shaft carrying two opposite-hand worms and two same-side worm-wheels', () => {
  const movement = catalog.movements[206];
  const model = createMovementModel(movement);
  const {
    blocks,
    sourceAnimation,
    sourceRaster,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 207);
  assert.equal(movement.number, '207');
  assert.equal(movement.title, 'Opposite-Hand Twin-Worm Feed-Roll Drive');
  assert.equal(movement.category, 'Worm gearing');
  assert.equal(
    movement.description,
    '207. A modification of 195 by means of two worms and worm-wheels.',
  );
  assert.equal(
    movement.archetype,
    'common-shaft-opposite-hand-twin-worm-counterrotating-feed-roll-wheels',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'one-continuous-shaft-carries-left-and-right-hand-single-start-worms-driving-two-same-side-worm-wheels-oppositely',
  );
  assert.equal(
    model.root.userData.variant,
    'movement-195-feed-direction-preserved-by-opposite-worm-hands-in-a-side-by-side-layout',
  );

  assert.equal(blocks.inputShaft.parent, model.root);
  assert.equal(blocks.leftWorm.parent, model.root);
  assert.equal(blocks.rightWorm.parent, model.root);
  assert.equal(blocks.leftWheel.parent, model.root);
  assert.equal(blocks.rightWheel.parent, model.root);
  assert.notEqual(blocks.leftWorm, blocks.rightWorm);
  assert.notEqual(blocks.leftWheel, blocks.rightWheel);
  assert.equal(blocks.inputShaft.userData.carriesBothWorms, true);
  assert.equal(blocks.leftWorm.userData.keyedToCommonShaft, true);
  assert.equal(blocks.rightWorm.userData.keyedToCommonShaft, true);
  assert.equal(blocks.leftWorm.userData.handedness, -1);
  assert.equal(blocks.rightWorm.userData.handedness, 1);
  assert.equal(blocks.leftWorm.userData.starts, 1);
  assert.equal(blocks.rightWorm.userData.starts, 1);
  assert.equal(blocks.leftWheel.userData.teeth, 24);
  assert.equal(blocks.rightWheel.userData.teeth, 24);
  assert.equal(blocks.leftWheelTeeth.count, 24);
  assert.equal(blocks.rightWheelTeeth.count, 24);

  assert.equal(transmission.gearReduction, 24);
  assert.equal(transmission.fullTrainClosureInputTurns, 24);
  near(transmission.leftToInputRatio, 1 / 24, 0, 'left reduction');
  near(transmission.rightToInputRatio, -1 / 24, 0, 'right reduction');
  near(
    transmission.leftWheelAngularSpeed,
    -transmission.rightWheelAngularSpeed,
    0,
    'equal opposite output rates',
  );

  assert.equal(sourceAnimation.available, false);
  assert.match(sourceAnimation.reason, /unavailable|no registered/i);
  assert.equal(sourceRaster.sourceUrl, movement.sourceUrl);
  assert.equal(sourceRaster.referenceMovement, 195);
  assert.equal(sourceRaster.inferredWheelTeeth, 24);
  assert.equal(sourceRaster.wormTurns, 3);
  assert.equal(sourceRaster.visibleLowerSectorPitches, 11);
  assert.equal(sourceRaster.width, 525);
  assert.equal(sourceRaster.height, 525);

  const counts = {
    commonInputShafts: 0,
    forbidden: 0,
    screwThreads: 0,
    wormWheels: 0,
    worms: 0,
    wormWheelTeeth: 0,
  };
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (/belt|pulley|chain|sprocket|rack|ratchet|cam|pawl/i.test(role)) {
      counts.forbidden += 1;
    }
    if (role === 'single-continuous-input-shaft-carrying-two-worms') {
      counts.commonInputShafts += 1;
    }
    if (/single-start-worm-on-common-shaft$/.test(role)) counts.worms += 1;
    if (/twenty-four-tooth-worm-wheel$/.test(role)) counts.wormWheels += 1;
    if (object.userData.screwThread) counts.screwThreads += 1;
    if (object.userData.profile === 'offline-worm-generated-envelope') counts.wormWheelTeeth += object.count;
  });
  assert.deepEqual(counts, {
    commonInputShafts: 1,
    forbidden: 0,
    screwThreads: 2,
    wormWheels: 2,
    worms: 2,
    wormWheelTeeth: 48,
  });
  disposeModel(model.root);
});

test('movement 207 reproduces the source proportions and exact conjugate lead directions', () => {
  const model = createMovementModel(catalog.movements[206]);
  const {
    blocks,
    geometry,
    modelPointToSourceRaster,
    sourceAnchors,
    sourcePointToModel,
    threadPitchPointAt,
    threadTangentAtContact,
    toothCenterAngleAtAxial,
    toothLineTangentAtContact,
  } = model.root.userData;

  assert.deepEqual(sourceAnchors.sourceOrigin.toArray(), [269, 371.5]);
  assert.deepEqual(sourceAnchors.leftWheelCenter.toArray(), [141, 260]);
  assert.deepEqual(sourceAnchors.rightWheelCenter.toArray(), [397, 260]);
  assert.deepEqual(sourceAnchors.leftWormCenter.toArray(), [141, 371.5]);
  assert.deepEqual(sourceAnchors.rightWormCenter.toArray(), [397, 371.5]);
  assert.deepEqual(
    sourceAnchors.inputShaftEndpoints.map((point) => point.toArray()),
    [[29, 371.5], [496, 371.5]],
  );
  assert.equal(sourceAnchors.wheelRootRadius, 78);
  assert.equal(sourceAnchors.wheelPitchRadius, 86);
  assert.equal(sourceAnchors.wheelOuterRadius, 94);
  assert.equal(sourceAnchors.wormPitchRadius, 25.5);
  near(model.root.userData.sourceRaster.scale, 1 / 86, 0, 'source scale');
  vector3Near(
    sourcePointToModel(sourceAnchors.leftWheelCenter),
    geometry.leftWheelCenter,
    1e-15,
    'left source hub maps to the modeled wheel shaft',
  );
  vector3Near(
    sourcePointToModel(sourceAnchors.rightWheelCenter),
    geometry.rightWheelCenter,
    1e-15,
    'right source hub maps to the modeled wheel shaft',
  );
  vector3Near(
    sourcePointToModel(sourceAnchors.sourceOrigin),
    new THREE.Vector3(),
    1e-15,
    'source origin maps to the common shaft midpoint datum',
  );
  vector2Near(
    modelPointToSourceRaster(geometry.leftWormCenter),
    sourceAnchors.leftWormCenter,
    1e-14,
    'left worm axis maps back to the source',
  );
  vector2Near(
    modelPointToSourceRaster(geometry.rightWormCenter),
    sourceAnchors.rightWormCenter,
    1e-14,
    'right worm axis maps back to the source',
  );
  sourceAnchors.modeledInputShaftEndpoints.forEach((point, index) => {
    vector2Near(
      point,
      sourceAnchors.inputShaftEndpoints[index],
      2e-14,
      `input shaft endpoint ${index}`,
    );
  });

  assert.equal(geometry.wheelTeeth, 24);
  assert.equal(geometry.wormStarts, 1);
  assert.equal(geometry.wormTurns, 3);
  assert.equal(geometry.leftWormHandedness, -1);
  assert.equal(geometry.rightWormHandedness, 1);
  vector3Near(geometry.wormAxis, X_AXIS, 1e-15, 'common horizontal worm axis');
  vector3Near(blocks.leftWorm.userData.axis, X_AXIS, 1e-15, 'left worm axis');
  vector3Near(blocks.rightWorm.userData.axis, X_AXIS, 1e-15, 'right worm axis');
  vector3Near(blocks.leftWheel.userData.axis, Z_AXIS, 1e-15, 'left wheel axis');
  vector3Near(blocks.rightWheel.userData.axis, Z_AXIS, 1e-15, 'right wheel axis');
  vector3Near(blocks.leftWheelShaft.userData.axis, Z_AXIS, 1e-15, 'left output axis');
  vector3Near(blocks.rightWheelShaft.userData.axis, Z_AXIS, 1e-15, 'right output axis');
  near(
    geometry.leftWheelCenter.y - geometry.leftWormCenter.y,
    geometry.centerDistance,
    1e-15,
    'left source center distance',
  );
  near(
    geometry.rightWheelCenter.y - geometry.rightWormCenter.y,
    geometry.centerDistance,
    1e-15,
    'right source center distance',
  );
  near(
    geometry.centerDistance,
    geometry.wheelPitchRadius + geometry.wormPitchRadius,
    1e-15,
    'tangent pitch cylinders',
  );
  near(
    geometry.wheelCenterSeparation,
    256 / 86,
    1e-15,
    'source wheel-shaft separation',
  );
  near(
    geometry.axialPitch,
    geometry.wheelCircularPitch,
    1e-15,
    'each single-start worm advances exactly one wheel pitch per turn',
  );
  near(
    geometry.wormLength,
    geometry.wormTurns * geometry.axialPitch,
    1e-15,
    'three complete source-proportioned thread turns',
  );
  near(
    geometry.wheelRootRadius + geometry.wheelToothHeight / 2,
    geometry.wheelPitchRadius,
    1e-15,
    'pitch radius bisects root and tip radii',
  );
  near(
    geometry.wheelOuterRadius - geometry.wheelToothHeight / 2,
    geometry.wheelPitchRadius,
    1e-15,
    'tip and root addenda are symmetric',
  );

  for (const [label, contact, wheelCenter, wormCenter] of [
    ['left', geometry.leftContactPoint, geometry.leftWheelCenter, geometry.leftWormCenter],
    ['right', geometry.rightContactPoint, geometry.rightWheelCenter, geometry.rightWormCenter],
  ]) {
    near(
      radialDistanceToAxis(contact, wheelCenter, Z_AXIS),
      geometry.wheelPitchRadius,
      1e-15,
      `${label} wheel pitch radius at contact`,
    );
    near(
      radialDistanceToAxis(contact, wormCenter, X_AXIS),
      geometry.wormPitchRadius,
      1e-15,
      `${label} worm pitch radius at contact`,
    );
  }
  vector3Near(
    geometry.leftSourceThreadPoint,
    geometry.leftContactPoint,
    2e-15,
    'left helix passes through the source contact',
  );
  vector3Near(
    geometry.rightSourceThreadPoint,
    geometry.rightContactPoint,
    2e-15,
    'right helix passes through the source contact',
  );
  vector3Near(
    threadPitchPointAt({
      axial: 0,
      center: geometry.leftWormCenter,
      handedness: geometry.leftWormHandedness,
      wormAngle: geometry.wormPhase,
    }),
    geometry.leftContactPoint,
    2e-15,
    'analytic left thread center point',
  );
  vector3Near(
    threadPitchPointAt({
      axial: 0,
      center: geometry.rightWormCenter,
      handedness: geometry.rightWormHandedness,
      wormAngle: geometry.wormPhase,
    }),
    geometry.rightContactPoint,
    2e-15,
    'analytic right thread center point',
  );

  model.update(0);
  model.root.updateMatrixWorld(true);
  for (const [label, worm, expected] of [
    ['left', blocks.leftWorm, geometry.leftContactPoint],
    ['right', blocks.rightWorm, geometry.rightContactPoint],
  ]) {
    assert.equal(worm.userData.threadPoints.length, 85);
    const localMiddle = worm.userData.threadPoints[42].clone();
    const renderedMiddle = worm.userData.thread.localToWorld(localMiddle);
    vector3Near(
      renderedMiddle,
      expected,
      3e-15,
      `${label} rendered helix center crosses the pitch contact`,
    );
    near(worm.userData.pitch, geometry.axialPitch, 1e-15, `${label} rendered lead`);
    near(worm.userData.length, geometry.wormLength, 1e-15, `${label} rendered length`);
    assert.equal(worm.userData.turns, 3);
  }

  near(
    geometry.leftWheelPhase + geometry.contactGapLocalAngle,
    geometry.contactPolarAngle,
    1e-15,
    'left source gap is centered over its worm',
  );
  near(
    geometry.rightWheelPhase + geometry.contactGapLocalAngle,
    geometry.contactPolarAngle,
    1e-15,
    'right source gap is centered over its worm',
  );
  for (const [label, teeth, handedness] of [
    ['left', blocks.leftWheelTeeth, -1],
    ['right', blocks.rightWheelTeeth, 1],
  ]) {
    assert.equal(teeth.isInstancedMesh, true);
    assert.equal(teeth.count, 24);
    assert.equal(teeth.userData.handedness, handedness);
    assert.equal(teeth.userData.profile, 'offline-worm-generated-envelope');
    assert.ok(teeth.geometry.attributes.position.count > 3000);
    near(
      Math.abs(threadTangentAtContact(handedness).dot(
        toothLineTangentAtContact(handedness),
      )),
      1,
      2e-15,
      `${label} worm thread and wheel tooth lead are parallel`,
    );
  }
  disposeModel(model.root);
});

test('movement 207 exhaustively keeps both meshes conjugate while the facing roll surfaces travel together', () => {
  const model = createMovementModel(catalog.movements[206]);
  const {
    geometry,
    stateAtInputTravel,
    transmission,
  } = model.root.userData;
  const sampleCount = 32769;
  const totalInputTravel = FULL_TURN
    * transmission.fullTrainClosureInputTurns;
  let previousLeftAngle = null;
  let previousRightAngle = null;
  let maximumFeedError = 0;
  let maximumMeshPhaseError = 0;
  let maximumNormalVelocityError = 0;
  let maximumPitchVelocityError = 0;
  let maximumSlidingAlignmentError = 0;
  let maximumToothLeadAlignmentError = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / (sampleCount - 1);
    const inputTravel = totalInputTravel * progress;
    const state = stateAtInputTravel(inputTravel);
    finiteStateNumbers(state, `state[${index}]`);
    near(state.inputTravel, inputTravel, 0, `input travel ${index}`);
    near(
      state.leftOutputTeethAdvanced,
      transmission.fullTrainClosureInputTurns * progress,
      6e-14,
      `left tooth travel ${index}`,
    );
    near(
      state.rightOutputTeethAdvanced,
      -transmission.fullTrainClosureInputTurns * progress,
      6e-14,
      `right tooth travel ${index}`,
    );
    near(state.leftWormAngle, state.commonShaftAngle, 0, `left phase lock ${index}`);
    near(state.rightWormAngle, state.commonShaftAngle, 0, `right phase lock ${index}`);
    near(state.wormPhaseLockError, 0, 0, `published phase lock ${index}`);
    near(state.leftToInputRatio, 1 / geometry.wheelTeeth, 0, `left ratio ${index}`);
    near(state.rightToInputRatio, -1 / geometry.wheelTeeth, 0, `right ratio ${index}`);
    assert.ok(state.leftWheelAngularSpeed > 0);
    assert.ok(state.rightWheelAngularSpeed < 0);
    assert.ok(state.leftWormAngularSpeed > 0);
    assert.ok(state.rightWormAngularSpeed > 0);
    near(state.wheelAngularSpeedSum, 0, 0, `counterrotation ${index}`);
    vector3Near(
      state.commonFeedDirection,
      Y_AXIS,
      1e-15,
      `common upward feed ${index}`,
    );
    vector3Near(
      state.leftFacingVelocity,
      state.rightFacingVelocity,
      1e-15,
      `equal facing velocities ${index}`,
    );
    assert.ok(state.leftFacingVelocity.y > 0);
    near(state.leftFacingVelocity.x, 0, 1e-15, `left feed x ${index}`);
    near(state.leftFacingVelocity.z, 0, 1e-15, `left feed z ${index}`);
    vector3Near(
      state.leftMesh.contactPoint,
      geometry.leftContactPoint,
      1e-15,
      `left fixed contact ${index}`,
    );
    vector3Near(
      state.rightMesh.contactPoint,
      geometry.rightContactPoint,
      1e-15,
      `right fixed contact ${index}`,
    );
    assert.ok(state.leftMesh.wheelSurfaceVelocity.x > 0);
    assert.ok(state.rightMesh.wheelSurfaceVelocity.x < 0);
    assert.ok(state.leftMesh.wormSurfaceVelocity.z > 0);
    assert.ok(state.rightMesh.wormSurfaceVelocity.z > 0);
    assert.ok(state.leftMesh.slidingSpeed > 0);
    assert.ok(state.rightMesh.slidingSpeed > 0);
    maximumFeedError = Math.max(
      maximumFeedError,
      state.facingSurfaceVelocityError,
    );
    maximumMeshPhaseError = Math.max(
      maximumMeshPhaseError,
      Math.abs(state.leftMeshPhaseInvariant),
      Math.abs(state.rightMeshPhaseInvariant),
    );
    for (const mesh of [state.leftMesh, state.rightMesh]) {
      maximumNormalVelocityError = Math.max(
        maximumNormalVelocityError,
        mesh.conjugateNormalVelocityError,
        mesh.normalVelocityError,
      );
      maximumPitchVelocityError = Math.max(
        maximumPitchVelocityError,
        mesh.pitchVelocityError,
      );
      maximumSlidingAlignmentError = Math.max(
        maximumSlidingAlignmentError,
        mesh.slidingAlignmentError,
      );
      maximumToothLeadAlignmentError = Math.max(
        maximumToothLeadAlignmentError,
        mesh.toothLeadAlignmentError,
      );
    }
    if (previousLeftAngle !== null) {
      assert.ok(state.leftWheelAngle > previousLeftAngle);
      assert.ok(state.rightWheelAngle < previousRightAngle);
    }
    previousLeftAngle = state.leftWheelAngle;
    previousRightAngle = state.rightWheelAngle;
  }

  assert.ok(maximumFeedError < 2e-15);
  assert.ok(maximumMeshPhaseError < 2e-12);
  assert.ok(maximumNormalVelocityError < 2e-15);
  assert.ok(maximumPitchVelocityError < 2e-15);
  assert.ok(maximumSlidingAlignmentError < 2e-15);
  assert.ok(maximumToothLeadAlignmentError < 2e-15);

  const start = stateAtInputTravel(0);
  const oneTurn = stateAtInputTravel(FULL_TURN);
  near(oneTurn.commonShaftAngle - start.commonShaftAngle, FULL_TURN, 1e-15, 'one shaft turn');
  near(oneTurn.leftWheelAngle - start.leftWheelAngle, geometry.wheelToothPitch, 2e-15, 'left advances one tooth');
  near(oneTurn.rightWheelAngle - start.rightWheelAngle, -geometry.wheelToothPitch, 2e-15, 'right advances one tooth oppositely');
  near(oneTurn.leftOutputTeethAdvanced, 1, 2e-15, 'left tooth count after one input turn');
  near(oneTurn.rightOutputTeethAdvanced, -1, 2e-15, 'right tooth count after one input turn');
  const closure = stateAtInputTravel(totalInputTravel);
  near(closure.leftWheelAngle - start.leftWheelAngle, FULL_TURN, 3e-14, 'left full-wheel closure');
  near(closure.rightWheelAngle - start.rightWheelAngle, -FULL_TURN, 3e-14, 'right full-wheel closure');
  disposeModel(model.root);
});

test('movement 207 analytic rates and opposite-hand directions agree with finite differences', () => {
  const model = createMovementModel(catalog.movements[206]);
  const {
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const derivativeStep = 1e-5;
  for (let index = 0; index <= 256; index += 1) {
    const time = transmission.inputPeriod * geometry.wheelTeeth
      * index / 256;
    const before = stateAtTime(time - derivativeStep);
    const state = stateAtTime(time);
    const after = stateAtTime(time + derivativeStep);
    const derivative = (key) => (
      after[key] - before[key]
    ) / (2 * derivativeStep);
    near(
      derivative('commonShaftAngle'),
      state.commonShaftAngularSpeed,
      2e-9,
      `common shaft derivative ${index}`,
    );
    near(
      derivative('leftWormAngle'),
      state.leftWormAngularSpeed,
      2e-9,
      `left worm derivative ${index}`,
    );
    near(
      derivative('rightWormAngle'),
      state.rightWormAngularSpeed,
      2e-9,
      `right worm derivative ${index}`,
    );
    near(
      derivative('leftWheelAngle'),
      state.leftWheelAngularSpeed,
      2e-10,
      `left wheel derivative ${index}`,
    );
    near(
      derivative('rightWheelAngle'),
      state.rightWheelAngularSpeed,
      2e-10,
      `right wheel derivative ${index}`,
    );
    near(
      derivative('inputTravel'),
      transmission.inputAngularSpeed,
      2e-9,
      `input derivative ${index}`,
    );
  }

  near(
    transmission.leftToInputRatio,
    -geometry.leftWormHandedness * geometry.wormStarts / geometry.wheelTeeth,
    0,
    'left hand fixes the positive output ratio',
  );
  near(
    transmission.rightToInputRatio,
    -geometry.rightWormHandedness * geometry.wormStarts / geometry.wheelTeeth,
    0,
    'right hand fixes the negative output ratio',
  );
  assert.ok(transmission.leftWheelAngularSpeed > 0, 'source left arrow is counterclockwise');
  assert.ok(transmission.rightWheelAngularSpeed < 0, 'source right arrow is clockwise');
  near(
    Math.abs(transmission.leftWheelAngularSpeed),
    Math.abs(transmission.rightWheelAngularSpeed),
    0,
    'identical wheels have equal speed magnitudes',
  );
  near(
    transmission.gearReduction,
    geometry.wheelTeeth / geometry.wormStarts,
    0,
    'single-start 24-tooth reduction',
  );
  disposeModel(model.root);
});

test('movement 207 runtime exposes both worm hands, counterrotation indexes, full closure, and the next authored boundary', () => {
  const model = createMovementModel(catalog.movements[206]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const canonicalNames = [
    'sourcePose',
    'quarterInputTurn',
    'halfInputTurn',
    'threeQuarterInputTurn',
    'oneInputTurn',
    'fullTrainClosure',
  ];
  for (const name of canonicalNames) {
    const time = canonicalTimes[name];
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.inputShaft.userData.rotor.rotation.z, state.commonShaftAngle, 1e-14, `${name} input shaft`);
    near(blocks.leftWorm.userData.rotor.rotation.z, state.leftWormAngle, 1e-14, `${name} left worm`);
    near(blocks.rightWorm.userData.rotor.rotation.z, state.rightWormAngle, 1e-14, `${name} right worm`);
    near(blocks.leftWheel.userData.rotor.rotation.z, state.leftWheelAngle, 1e-14, `${name} left wheel`);
    near(blocks.rightWheel.userData.rotor.rotation.z, state.rightWheelAngle, 1e-14, `${name} right wheel`);
    near(blocks.leftWheelShaft.userData.rotor.rotation.z, state.leftWheelAngle, 1e-14, `${name} left output shaft`);
    near(blocks.rightWheelShaft.userData.rotor.rotation.z, state.rightWheelAngle, 1e-14, `${name} right output shaft`);
    assert.equal(blocks.inputShaft.userData.angularSpeed, state.commonShaftAngularSpeed);
    assert.equal(blocks.leftWorm.userData.angularSpeed, state.leftWormAngularSpeed);
    assert.equal(blocks.rightWorm.userData.angularSpeed, state.rightWormAngularSpeed);
    assert.equal(blocks.leftWheel.userData.angularSpeed, state.leftWheelAngularSpeed);
    assert.equal(blocks.rightWheel.userData.angularSpeed, state.rightWheelAngularSpeed);
    vector3Near(blocks.leftContactMarker.position, geometry.leftContactPoint, 1e-15, `${name} left contact marker`);
    vector3Near(blocks.rightContactMarker.position, geometry.rightContactPoint, 1e-15, `${name} right contact marker`);
    near(model.root.userData.contacts.leftWormWheelMesh.pitchVelocityError, 0, 2e-15, `${name} left contact`);
    near(model.root.userData.contacts.rightWormWheelMesh.pitchVelocityError, 0, 2e-15, `${name} right contact`);
    near(model.root.userData.contacts.opposedFeedSurfaces.velocityError, 0, 2e-15, `${name} feed contact`);
  }

  const worldPositionAt = (object, time) => {
    model.update(time);
    model.root.updateMatrixWorld(true);
    return object.getWorldPosition(new THREE.Vector3());
  };
  const shaftSource = worldPositionAt(blocks.shaftIndex, canonicalTimes.sourcePose);
  const shaftOneTurn = worldPositionAt(blocks.shaftIndex, canonicalTimes.oneInputTurn);
  vector3Near(shaftOneTurn, shaftSource, 3e-15, 'common shaft index closes every input turn');
  const leftSource = worldPositionAt(blocks.leftWheelIndex, canonicalTimes.sourcePose);
  const rightSource = worldPositionAt(blocks.rightWheelIndex, canonicalTimes.sourcePose);
  const leftOneTurn = worldPositionAt(blocks.leftWheelIndex, canonicalTimes.oneInputTurn);
  const rightOneTurn = worldPositionAt(blocks.rightWheelIndex, canonicalTimes.oneInputTurn);
  assert.ok(leftOneTurn.distanceTo(leftSource) > 0.1, 'left rate index visibly advances');
  assert.ok(rightOneTurn.distanceTo(rightSource) > 0.1, 'right rate index visibly advances');
  near(
    leftOneTurn.distanceTo(leftSource),
    rightOneTurn.distanceTo(rightSource),
    3e-15,
    'equal output speed magnitudes are visually comparable',
  );
  const leftClosure = worldPositionAt(blocks.leftWheelIndex, canonicalTimes.fullTrainClosure);
  const rightClosure = worldPositionAt(blocks.rightWheelIndex, canonicalTimes.fullTrainClosure);
  vector3Near(leftClosure, leftSource, 3e-14, 'left index closes after 24 input turns');
  vector3Near(rightClosure, rightSource, 3e-14, 'right index closes after 24 input turns');

  model.update(0);
  model.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 5.6 && size.x < 5.7);
  assert.ok(size.y > 3.6 && size.y < 3.7);
  assert.equal(blocks.baseRail.visible, false);
  assert.ok(model.root.userData.cameraFitBounds.getSize(new THREE.Vector3()).z > .9);
  assert.ok(bounds.min.x < -2.88);
  assert.ok(bounds.max.x > 2.73);
  assert.ok(bounds.max.y > 2.37);
  assert.ok(bounds.min.z < -1.7);
  let screwThreadCount = 0;
  let toothCount = 0;
  model.root.traverse((object) => {
    if (object.userData.screwThread) screwThreadCount += 1;
    if (object.userData.profile === 'offline-worm-generated-envelope') toothCount += object.count;
  });
  for (const worm of [blocks.leftWorm, blocks.rightWorm]) {
    assert.equal(worm.userData.toothProfile, 'axial-straight-flanked-worm');
    assert.equal(worm.userData.rotor.children.filter(child => child.isMesh).length, 1);
  }
  assert.equal(model.root.userData.hideGround, true);
  assert.equal(blocks.leftContactMarker.visible, false);
  assert.equal(blocks.rightContactMarker.visible, false);
  assert.equal(screwThreadCount, 2);
  assert.equal(toothCount, 48);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 2);

  const referenceMovement = catalog.movements[194];
  const referenceModel = createMovementModel(referenceMovement);
  assert.equal(referenceMovement.id, 195);
  assert.equal(referenceModel.root.userData.fidelity, 'authored');
  assert.notEqual(referenceModel.root.userData.archetype, model.root.userData.archetype);
  assert.notEqual(referenceModel.root.userData.mechanism, model.root.userData.mechanism);
  let referenceThreadCount = 0;
  referenceModel.root.traverse((object) => {
    if (object.userData.screwThread) referenceThreadCount += 1;
  });
  assert.equal(referenceThreadCount, 1, 'movement 195 has one central worm');

  const nextMovement = catalog.movements[207];
  const nextModel = createMovementModel(nextMovement);
  assert.equal(nextMovement.id, 208);
  assert.equal(nextMovement.fidelity, 'authored');
  assert.equal(nextModel.root.userData.fidelity, 'authored');
  assert.notEqual(nextModel.root.userData.archetype, model.root.userData.archetype);
  assert.notEqual(nextModel.root.userData.mechanism, model.root.userData.mechanism);
  const pendingMovement = catalog.movements[208];
  const pendingModel = createMovementModel(pendingMovement);
  assert.equal(pendingMovement.id, 209);
  assert.equal(pendingMovement.fidelity, 'authored');
  assert.equal(pendingModel.root.userData.fidelity, 'authored');
  const queuedMovement = catalog.movements[209];
  const queuedModel = createMovementModel(queuedMovement);
  assert.equal(queuedMovement.id, 210);
  assert.equal(queuedMovement.fidelity, 'authored');
  assert.equal(queuedModel.root.userData.fidelity, 'authored');
  const nextQueuedMovement = catalog.movements[210];
  const nextQueuedModel = createMovementModel(nextQueuedMovement);
  assert.equal(nextQueuedMovement.id, 211);
  assert.equal(nextQueuedMovement.fidelity, 'authored');
  assert.equal(nextQueuedModel.root.userData.fidelity, 'authored');
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
  disposeModel(nextQueuedModel.root);
  disposeModel(queuedModel.root);
  disposeModel(pendingModel.root);
  disposeModel(nextModel.root);
  disposeModel(referenceModel.root);
  disposeModel(model.root);
});
