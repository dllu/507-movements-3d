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

function radialDistanceToAxis(point, center, axis) {
  const offset = point.clone().sub(center);
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

test('movement 195 preserves Brown\'s opposed-wheel layout and nominal source geometry', () => {
  const movement = catalog.movements[194];
  const model = createMovementModel(movement);
  const {
    blocks,
    geometry,
    modelPointToSourceRaster,
    sourceAnchors,
    sourcePointToModel,
    sourceRaster,
  } = model.root.userData;

  assert.equal(movement.id, 195);
  assert.equal(movement.number, '195');
  assert.equal(movement.title, 'Opposed Feed-Roll Worm Drive');
  assert.equal(movement.category, 'Worm gearing');
  assert.equal(
    movement.description,
    '195. A mode of driving a pair of feed-rolls, the opposite surfaces of which require to move in the same direction. The two wheels are precisely similar, and both gear into the endless screw which is arranged between them. The teeth of one wheel only are visible, those of the other being on the back or side which is concealed from view.',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'single-worm-opposed-identical-feed-roll-wheels-common-direction-nip',
  );
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'single-start-worm-between-opposed-identical-wheels-counter-rotating-feed-surfaces',
  );

  assert.equal(blocks.upperWheel.parent, model.root);
  assert.equal(blocks.lowerWheel.parent, model.root);
  assert.equal(blocks.worm.parent, model.root);
  assert.equal(blocks.upperWheelBody.parent, blocks.upperWheelRotor);
  assert.equal(blocks.lowerWheelBody.parent, blocks.lowerWheelRotor);
  assert.equal(blocks.upperGrooves.length, 24);
  assert.equal(blocks.lowerGrooves.length, 24);
  assert.equal(blocks.upperWheel.userData.teeth, 24);
  assert.equal(blocks.lowerWheel.userData.teeth, 24);
  assert.equal(blocks.worm.userData.starts, 1);
  assert.equal(blocks.worm.userData.turns, 3.5);
  assert.equal(
    blocks.upperWheelBody.geometry,
    blocks.lowerWheelBody.geometry,
    'Brown\'s two wheels share precisely the same body geometry',
  );
  blocks.upperGrooves.forEach((groove, index) => {
    assert.equal(groove.parent, blocks.upperWheelRotor);
    assert.equal(groove.userData.index, index);
    assert.equal(
      groove.userData.role,
      'visible-tooth-space-on-upper-near-mesh-face',
    );
    assert.ok(groove.position.z > 0);
  });
  blocks.lowerGrooves.forEach((groove, index) => {
    assert.equal(groove.parent, blocks.lowerWheelRotor);
    assert.equal(groove.userData.index, index);
    assert.equal(
      groove.userData.role,
      'concealed-tooth-space-on-lower-rear-mesh-face',
    );
    assert.ok(groove.position.z < 0);
    assert.equal(groove.geometry, blocks.upperGrooves[index].geometry);
  });
  assert.equal(geometry.upperBodySide, -1);
  assert.equal(geometry.lowerBodySide, 1);
  vector3Near(geometry.upperMeshFaceNormal, Z_AXIS, 1e-15, 'upper near mesh face');
  vector3Near(
    geometry.lowerMeshFaceNormal,
    Z_AXIS.clone().negate(),
    1e-15,
    'lower concealed rear mesh face',
  );
  near(
    blocks.upperWheelBody.position.z,
    -geometry.wheelDepth / 2,
    1e-15,
    'upper body is behind the worm plane',
  );
  near(
    blocks.lowerWheelBody.position.z,
    geometry.wheelDepth / 2,
    1e-15,
    'lower body is in front of the concealed mesh face',
  );

  assert.deepEqual(sourceAnchors.upperWheelCenter.toArray(), [262, 139]);
  assert.deepEqual(sourceAnchors.lowerWheelCenter.toArray(), [262, 369]);
  assert.deepEqual(sourceAnchors.wormCenter.toArray(), [262, 254]);
  assert.equal(sourceAnchors.sourceWheelOuterRadius, 127);
  vector3Near(
    sourcePointToModel(sourceAnchors.upperWheelCenter, geometry.upperWheelCenter.z),
    geometry.upperWheelCenter,
    2e-14,
    'upper source hub maps to the upper modeled shaft',
  );
  vector3Near(
    sourcePointToModel(sourceAnchors.lowerWheelCenter, geometry.lowerWheelCenter.z),
    geometry.lowerWheelCenter,
    2e-14,
    'lower source hub maps to the lower modeled shaft',
  );
  vector3Near(
    sourcePointToModel(sourceAnchors.wormCenter),
    geometry.wormCenter,
    1e-15,
    'source worm midpoint maps to the modeled origin',
  );
  vector2Near(
    modelPointToSourceRaster(new THREE.Vector3()),
    sourceAnchors.wormCenter,
    1e-14,
    'model origin maps back to Brown\'s worm midpoint',
  );
  // p99: Brown's rims at 12 and 496; the worm axis radius is set from his
  // 115 px hub-to-worm distance.
  assert.ok(sourceAnchors.upperOuterTop.y > 13);
  assert.ok(sourceAnchors.upperOuterTop.y < 14.5);
  assert.ok(sourceAnchors.lowerOuterBottom.y > 493.5);
  assert.ok(sourceAnchors.lowerOuterBottom.y < 495);
  sourceAnchors.modeledWormShaftEndpoints.forEach((point, index) => {
    assert.ok(
      point.distanceTo(sourceAnchors.wormShaftEndpoints[index]) < 5,
      `modeled shaft endpoint ${index} follows Brown's line`,
    );
  });
  // Brown's threaded window runs from about 213 to 318.
  assert.ok(sourceAnchors.modeledThreadEndpoints[0].x > 209);
  assert.ok(sourceAnchors.modeledThreadEndpoints[0].x < 210);
  assert.ok(sourceAnchors.modeledThreadEndpoints[1].x > 314);
  assert.ok(sourceAnchors.modeledThreadEndpoints[1].x < 315);
  assert.deepEqual(sourceRaster, {
    height: 525,
    scale: geometry.centerDistance / 115,
    width: 525,
  });

  let upperWheelCount = 0;
  let lowerWheelCount = 0;
  let wormCount = 0;
  const forbiddenRoles = [];
  model.root.traverse((object) => {
    if (object.userData.role === 'upper-identical-feed-roll-worm-wheel') {
      upperWheelCount += 1;
    }
    if (object.userData.role === 'lower-identical-feed-roll-worm-wheel') {
      lowerWheelCount += 1;
    }
    if (object.userData.role === 'single-start-worm-between-opposed-feed-roll-wheels') {
      wormCount += 1;
    }
    if (/belt|pulley|rack|cam|spring/i.test(object.userData.role ?? '')) {
      forbiddenRoles.push(object.userData.role);
    }
  });
  assert.equal(upperWheelCount, 1);
  assert.equal(lowerWheelCount, 1);
  assert.equal(wormCount, 1);
  assert.deepEqual(forbiddenRoles, []);
  disposeModel(model.root);
});

test('movement 195 uses one matched single-start lead at two exact opposed pitch-cylinder contacts', () => {
  const model = createMovementModel(catalog.movements[194]);
  const { blocks, geometry } = model.root.userData;

  assert.equal(geometry.wormStarts, 1);
  // Left-handed: the visible front of each thread leans as Brown draws it.
  assert.equal(geometry.wormHandedness, -1);
  assert.equal(geometry.wheelTeeth, 24);
  vector3Near(geometry.wormAxis, X_AXIS, 1e-15, 'horizontal worm axis');
  assert.ok(blocks.upperWheel.userData.axis.distanceTo(Z_AXIS) < 1e-15);
  assert.ok(blocks.lowerWheel.userData.axis.distanceTo(Z_AXIS) < 1e-15);
  assert.ok(Math.abs(geometry.wormAxis.dot(blocks.upperWheel.userData.axis)) < 1e-15);
  assert.ok(Math.abs(geometry.wormAxis.dot(blocks.lowerWheel.userData.axis)) < 1e-15);
  vector3Near(blocks.upperWheel.position, geometry.upperWheelCenter, 1e-15, 'upper shaft center');
  vector3Near(blocks.lowerWheel.position, geometry.lowerWheelCenter, 1e-15, 'lower shaft center');
  vector3Near(blocks.worm.position, geometry.wormCenter, 1e-15, 'worm shaft center');
  // The worm axis crosses over each face at the pitch radius, standing
  // meshFaceOffset clear of it (p99).
  near(
    geometry.upperWheelCenter.distanceTo(geometry.wormCenter),
    Math.hypot(geometry.wheelPitchRadius, geometry.meshFaceOffset),
    1e-15,
    'upper wheel centre from the worm',
  );
  near(
    geometry.lowerWheelCenter.distanceTo(geometry.wormCenter),
    Math.hypot(geometry.wheelPitchRadius, geometry.meshFaceOffset),
    1e-15,
    'lower wheel centre from the worm',
  );
  assert.equal(geometry.wormPitchRadius, geometry.meshFaceOffset);
  assert.ok(geometry.wormTipRadius > geometry.meshFaceOffset);
  for (const [contact, center, label] of [
    [geometry.upperContactPoint, geometry.upperWheelCenter, 'upper'],
    [geometry.lowerContactPoint, geometry.lowerWheelCenter, 'lower'],
  ]) {
    near(
      radialDistanceToAxis(contact, center, Z_AXIS),
      geometry.wheelPitchRadius,
      2e-15,
      `${label} wheel pitch radius`,
    );
    near(
      radialDistanceToAxis(contact, geometry.wormCenter, X_AXIS),
      geometry.wormPitchRadius,
      2e-15,
      `${label} worm pitch radius`,
    );
  }
  near(
    geometry.axialPitch,
    FULL_TURN * geometry.wheelPitchRadius / geometry.wheelTeeth,
    2e-15,
    'worm axial pitch equals one wheel circular pitch',
  );
  near(
    geometry.wormLength,
    geometry.wormTurns * geometry.axialPitch,
    2e-15,
    'three and a half thread turns fill Brown\'s threaded window',
  );
  near(
    geometry.wheelToothPitch,
    FULL_TURN / geometry.wheelTeeth,
    2e-15,
    '24 equal wheel tooth spaces',
  );
  near(
    geometry.opposedThreadPhaseOffset,
    Math.PI,
    1e-15,
    'the opposite worm flank is half a thread turn away',
  );
  near(
    geometry.lowerToothPhaseOffset,
    geometry.wheelToothPitch / 2,
    1e-15,
    'the concealed wheel is installed at the corresponding half-tooth phase',
  );
  for (const grooves of [blocks.upperGrooves, blocks.lowerGrooves]) {
    for (let index = 0; index < grooves.length; index += 1) {
      near(
        grooves[index].userData.pitchAngle,
        index * geometry.wheelToothPitch,
        2e-14,
        `equal face-space pitch ${index}`,
      );
      near(
        Math.hypot(grooves[index].position.x, grooves[index].position.y),
        geometry.slotRadius,
        2e-14,
        `face-space radius ${index}`,
      );
    }
  }
  const threadMeshes = [];
  blocks.worm.traverse((object) => {
    if (object.userData.screwThread) threadMeshes.push(object);
  });
  assert.equal(threadMeshes.length, 1, 'the drive contains one continuous helical start');
  near(blocks.worm.userData.pitch, geometry.axialPitch, 1e-15, 'rendered helix lead');
  near(blocks.worm.userData.length, geometry.wormLength, 1e-15, 'rendered helix length');
  disposeModel(model.root);
});

test('movement 195 counter-rotates equal wheels while both facing surfaces travel together over 32,769 states', () => {
  const model = createMovementModel(catalog.movements[194]);
  const {
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const sampleCount = 32769;
  const cycleTime = transmission.inputPeriod * geometry.wheelTeeth;
  let maximumUpperMeshError = 0;
  let maximumLowerMeshError = 0;
  let maximumUpperRollingError = 0;
  let maximumLowerRollingError = 0;
  let maximumFeedVelocityMismatch = 0;
  let maximumEqualSpeedError = 0;
  let maximumOpposedSpeedSum = 0;
  let previousUpperAngle = null;
  let previousLowerAngle = null;
  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / (sampleCount - 1);
    const state = stateAtTime(cycleTime * progress);
    finiteStateNumbers(state, `state[${index}]`);
    maximumUpperMeshError = Math.max(
      maximumUpperMeshError,
      Math.abs(state.upperMeshPhaseInvariant),
    );
    maximumLowerMeshError = Math.max(
      maximumLowerMeshError,
      Math.abs(state.lowerMeshPhaseInvariant),
    );
    maximumUpperRollingError = Math.max(
      maximumUpperRollingError,
      state.upperSurfaceVelocity.distanceTo(state.wormThreadVelocity),
    );
    maximumLowerRollingError = Math.max(
      maximumLowerRollingError,
      state.lowerSurfaceVelocity.distanceTo(state.wormThreadVelocity),
    );
    maximumFeedVelocityMismatch = Math.max(
      maximumFeedVelocityMismatch,
      state.commonFeedSurfaceVelocityError,
    );
    maximumEqualSpeedError = Math.max(
      maximumEqualSpeedError,
      state.equalWheelSpeedMagnitudeError,
    );
    maximumOpposedSpeedSum = Math.max(
      maximumOpposedSpeedSum,
      Math.abs(state.opposedWheelSpeedSum),
    );
    near(
      state.inputTravel,
      FULL_TURN * geometry.wheelTeeth * progress,
      3e-13,
      `uniform worm travel ${index}`,
    );
    near(
      state.wormAngularSpeed,
      transmission.wormAngularSpeed,
      1e-15,
      `constant worm speed ${index}`,
    );
    near(
      state.upperToWormRatio,
      transmission.upperToWormRatio,
      1e-15,
      `upper ratio ${index}`,
    );
    near(
      state.lowerToWormRatio,
      transmission.lowerToWormRatio,
      1e-15,
      `lower ratio ${index}`,
    );
    assert.ok(state.upperWheelAngularSpeed > 0);
    assert.ok(state.lowerWheelAngularSpeed < 0);
    assert.ok(state.wormThreadAxialSpeed > 0);
    vector3Near(
      state.commonFeedDirection,
      X_AXIS,
      2e-15,
      `common feed direction ${index}`,
    );
    vector3Near(
      state.upperContactPoint,
      geometry.upperContactPoint,
      1e-15,
      `fixed upper contact ${index}`,
    );
    vector3Near(
      state.lowerContactPoint,
      geometry.lowerContactPoint,
      1e-15,
      `fixed lower contact ${index}`,
    );
    if (previousUpperAngle !== null) {
      assert.ok(state.upperWheelAngle > previousUpperAngle);
      assert.ok(state.lowerWheelAngle < previousLowerAngle);
    }
    previousUpperAngle = state.upperWheelAngle;
    previousLowerAngle = state.lowerWheelAngle;
  }

  assert.ok(maximumUpperMeshError < 2e-12);
  assert.ok(maximumLowerMeshError < 2e-12);
  assert.ok(maximumUpperRollingError < 2e-14);
  assert.ok(maximumLowerRollingError < 2e-14);
  assert.ok(maximumFeedVelocityMismatch < 2e-14);
  assert.ok(maximumEqualSpeedError < 2e-14);
  assert.ok(maximumOpposedSpeedSum < 2e-14);
  assert.equal(transmission.gearReduction, 24);
  near(
    transmission.upperToWormRatio,
    1 / geometry.wheelTeeth,
    1e-15,
    'upper wheel reduction',
  );
  near(
    transmission.lowerToWormRatio,
    -1 / geometry.wheelTeeth,
    1e-15,
    'lower wheel reduction',
  );

  const start = stateAtTime(0);
  const afterOneInputTurn = stateAtTime(transmission.inputPeriod);
  near(
    afterOneInputTurn.wormAngle - start.wormAngle,
    FULL_TURN,
    3e-14,
    'one worm revolution',
  );
  near(
    afterOneInputTurn.upperWheelAngle - start.upperWheelAngle,
    geometry.wheelToothPitch,
    3e-14,
    'upper wheel advances one tooth forward',
  );
  near(
    afterOneInputTurn.lowerWheelAngle - start.lowerWheelAngle,
    -geometry.wheelToothPitch,
    3e-14,
    'lower wheel advances one tooth backward',
  );
  near(afterOneInputTurn.upperOutputTeethAdvanced, 1, 2e-14, 'upper tooth count');
  near(afterOneInputTurn.lowerOutputTeethAdvanced, -1, 2e-14, 'lower tooth count');
  const closure = stateAtTime(cycleTime);
  near(
    closure.upperWheelAngle - start.upperWheelAngle,
    FULL_TURN,
    2e-13,
    'upper wheel closes after 24 worm turns',
  );
  near(
    closure.lowerWheelAngle - start.lowerWheelAngle,
    -FULL_TURN,
    2e-13,
    'lower wheel closes after 24 worm turns',
  );
  disposeModel(model.root);
});

test('movement 195 rendered transforms expose uniform input, equal counter-rotation, and common feed direction', () => {
  const model = createMovementModel(catalog.movements[194]);
  const {
    blocks,
    canonicalStates,
    canonicalTimes,
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const orderedNames = [
    'sourcePose',
    'quarterInputTurn',
    'halfInputTurn',
    'threeQuarterInputTurn',
    'oneInputTurn',
  ];

  model.update(0);
  model.root.updateMatrixWorld(true);
  const initialWormIndex = blocks.wormIndex.getWorldPosition(new THREE.Vector3());
  const initialUpperIndex = blocks.upperIndex.getWorldPosition(new THREE.Vector3());
  const initialLowerIndex = blocks.lowerIndex.getWorldPosition(new THREE.Vector3());
  vector2Near(
    initialUpperIndex.clone().sub(geometry.upperWheelCenter),
    new THREE.Vector2(geometry.wheelPitchRadius * 0.45, 0),
    2e-14,
    'upper source index starts to the right',
  );
  vector2Near(
    initialLowerIndex.clone().sub(geometry.lowerWheelCenter),
    new THREE.Vector2(geometry.wheelPitchRadius * 0.45, 0),
    2e-14,
    'lower source index starts aligned for direct speed comparison',
  );
  for (const name of orderedNames) {
    const time = canonicalTimes[name];
    const state = canonicalStates[name];
    model.update(time);
    model.root.updateMatrixWorld(true);
    const evaluated = stateAtTime(time);
    near(evaluated.inputTravel, state.inputTravel, 2e-14, `${name} input state`);
    near(blocks.worm.userData.rotor.rotation.z, state.wormAngle, 2e-14, `${name} worm`);
    near(blocks.wormShaft.userData.rotor.rotation.z, state.wormAngle, 2e-14, `${name} input shaft`);
    near(blocks.upperWheelRotor.rotation.z, state.upperWheelAngle, 2e-14, `${name} upper wheel`);
    near(blocks.lowerWheelRotor.rotation.z, state.lowerWheelAngle, 2e-14, `${name} lower wheel`);
    near(
      blocks.upperWheelShaft.userData.rotor.rotation.z,
      state.upperWheelAngle,
      2e-14,
      `${name} upper roll shaft`,
    );
    near(
      blocks.lowerWheelShaft.userData.rotor.rotation.z,
      state.lowerWheelAngle,
      2e-14,
      `${name} lower roll shaft`,
    );
    vector3Near(blocks.upperWheel.position, geometry.upperWheelCenter, 1e-15, `${name} upper center`);
    vector3Near(blocks.lowerWheel.position, geometry.lowerWheelCenter, 1e-15, `${name} lower center`);
    vector2Near(blocks.upperContactMarker.position, geometry.upperContactPoint, 1e-15, `${name} upper marker`);
    vector2Near(blocks.lowerContactMarker.position, geometry.lowerContactPoint, 1e-15, `${name} lower marker`);
    assert.equal(blocks.upperIndex.position.z, 0.0015);
    assert.equal(blocks.lowerIndex.position.z, 0.3655);
    const contacts = model.root.userData.contacts;
    near(
      contacts.upperWormWheelMesh.rollingVelocityError,
      0,
      2e-14,
      `${name} upper rolling`,
    );
    near(
      contacts.lowerWormWheelMesh.rollingVelocityError,
      0,
      2e-14,
      `${name} lower rolling`,
    );
    near(
      contacts.opposedFeedSurfaces.velocityError,
      0,
      2e-14,
      `${name} common facing-surface speed`,
    );
    vector3Near(
      contacts.opposedFeedSurfaces.commonDirection,
      X_AXIS,
      2e-15,
      `${name} published feed direction`,
    );
  }

  model.update(transmission.inputPeriod);
  model.root.updateMatrixWorld(true);
  vector3Near(
    blocks.wormIndex.getWorldPosition(new THREE.Vector3()),
    initialWormIndex,
    3e-14,
    'worm index closes after one input revolution',
  );
  assert.ok(
    blocks.upperIndex.getWorldPosition(new THREE.Vector3())
      .distanceTo(initialUpperIndex) > 0.1,
    'upper white index visibly advances one tooth',
  );
  assert.ok(
    blocks.lowerIndex.getWorldPosition(new THREE.Vector3())
      .distanceTo(initialLowerIndex) > 0.1,
    'lower white index visibly advances one tooth oppositely',
  );
  model.update(transmission.inputPeriod * geometry.wheelTeeth);
  model.root.updateMatrixWorld(true);
  vector3Near(
    blocks.upperIndex.getWorldPosition(new THREE.Vector3()),
    initialUpperIndex,
    3e-13,
    'upper rendered wheel closes after 24 worm turns',
  );
  vector3Near(
    blocks.lowerIndex.getWorldPosition(new THREE.Vector3()),
    initialLowerIndex,
    3e-13,
    'lower rendered wheel closes after 24 worm turns',
  );
  disposeModel(model.root);
});

test('movement 195 is fully three-dimensional as the review queue advances through 200', () => {
  const model = createMovementModel(catalog.movements[194]);
  const { blocks, canonicalTimes } = model.root.userData;
  const physicalBounds = new THREE.Box3();
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const object of [
      blocks.upperWheel,
      blocks.lowerWheel,
      blocks.worm,
      blocks.wormShaft,
      blocks.upperWheelShaft,
      blocks.lowerWheelShaft,
      blocks.framePost,
      blocks.frameFoot,
      ...blocks.wormBearingPosts,
    ]) physicalBounds.expandByObject(object);
  }
  const size = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 4.9);
  assert.ok(size.y > 5.2);
  // p99: one closed slotted solid per wheel (no instanced tooth sectors).
  assert.ok(blocks.upperGeneratedFace.isMesh && !blocks.upperGeneratedFace.isInstancedMesh);
  assert.ok(blocks.lowerGeneratedFace.isMesh && !blocks.lowerGeneratedFace.isInstancedMesh);
  assert.equal(blocks.framePost.visible, false, 'unpictured support frame is omitted');
  assert.ok(model.root.userData.cameraFitBounds.getSize(new THREE.Vector3()).z > .9);
  let visibleUpperSpaceCount = 0;
  let concealedLowerSpaceCount = 0;
  let screwThreadCount = 0;
  model.root.traverse((object) => {
    if (object.userData.role === 'visible-tooth-space-on-upper-near-mesh-face') {
      visibleUpperSpaceCount += 1;
    }
    if (object.userData.role === 'concealed-tooth-space-on-lower-rear-mesh-face') {
      concealedLowerSpaceCount += 1;
    }
    if (object.userData.screwThread) screwThreadCount += 1;
  });
  for (const worm of [blocks.worm]) {
    assert.equal(worm.userData.toothProfile, 'square-thread-slot-generated-crest');
    assert.equal(worm.userData.rotor.children.filter(child => child.isMesh).length, 2);
  }
  assert.equal(model.root.userData.hideGround, true);
  assert.equal(blocks.upperContactMarker.visible, false);
  assert.equal(blocks.lowerContactMarker.visible, false);
  assert.equal(visibleUpperSpaceCount, 24);
  assert.equal(concealedLowerSpaceCount, 24);
  assert.equal(screwThreadCount, 1);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 1.5);
  assert.ok(blocks.upperWheel.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.lowerWheel.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.upperWheelShaft.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.lowerWheelShaft.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.worm.userData.axis.distanceTo(X_AXIS) < 1e-14);
  assert.ok(blocks.wormShaft.userData.axis.distanceTo(X_AXIS) < 1e-14);

  const movement194 = createMovementModel(catalog.movements[193]);
  const movement196 = createMovementModel(catalog.movements[195]);
  const movement197 = createMovementModel(catalog.movements[196]);
  const movement198 = createMovementModel(catalog.movements[197]);
  const movement199 = createMovementModel(catalog.movements[198]);
  const movement200 = createMovementModel(catalog.movements[199]);
  assert.equal(movement194.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(movement196.root.userData.fidelity, 'authored');
  assert.equal(movement197.root.userData.fidelity, 'authored');
  assert.equal(movement198.root.userData.fidelity, 'authored');
  assert.equal(movement199.root.userData.fidelity, 'authored');
  assert.equal(movement200.root.userData.fidelity, 'authored');
  assert.notEqual(movement194.root.userData.mechanism, model.root.userData.mechanism);
  assert.notEqual(movement196.root.userData.mechanism, model.root.userData.mechanism);
  assert.notEqual(movement194.root.userData.archetype, model.root.userData.archetype);
  assert.notEqual(movement196.root.userData.archetype, model.root.userData.archetype);
  disposeModel(movement194.root);
  disposeModel(movement196.root);
  disposeModel(movement197.root);
  disposeModel(movement198.root);
  disposeModel(movement199.root);
  disposeModel(movement200.root);
  disposeModel(model.root);
});

test('p101: 195 hubs read in a darker shade with a chamfered collar and the shaft stubs cast no shadow', () => {
  const model = createMovementModel(catalog.movements[194]);
  const b = model.root.userData.blocks;
  for (const side of ['upper', 'lower']) {
    const hub = b[`${side}WheelHub`], body = b[`${side}GeneratedFace`];
    assert.ok(hub.material.color.getHSL({}).l < body.material.color.getHSL({}).l * 0.8, `${side} hub is darker than the face`);
    b[`${side}WheelShaft`].traverse((o) => {
      if (!o.isMesh) return;
      assert.equal(o.userData.noShadow, true);
      assert.equal(o.castShadow, false);
      assert.equal(o.receiveShadow, true);
    });
  }
});
