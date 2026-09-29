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

function wrappedAngleDifference(left, right) {
  return Math.atan2(Math.sin(left - right), Math.cos(left - right));
}

test('movement 196 matches Brown\'s one fixed pinion B, one arm-carried wheel A, and source anchors', () => {
  const movement = catalog.movements[195];
  const model = createMovementModel(movement);
  const {
    blocks,
    canonicalStates,
    geometry,
    modelPointToSourceRaster,
    sourceAnchors,
    sourcePointToModel,
    sourceRaster,
  } = model.root.userData;

  assert.equal(movement.id, 196);
  assert.equal(movement.number, '196');
  assert.equal(movement.title, 'Irregular Vibrating Noncircular-Gear Arm');
  assert.equal(movement.category, 'Toothed gearing');
  assert.equal(
    movement.description,
    '196. The pinion, B, rotates about a fixed axis and gives an irregular vibratory motion to the arm carrying the wheel, A.',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'fixed-pinion-noncircular-wheel-pivoted-carrier-irregular-vibration',
  );
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'uniform-fixed-pinion-rolls-noncircular-wheel-on-single-pivoted-carrier-arm',
  );

  assert.equal(blocks.wheel.parent, model.root);
  assert.equal(blocks.pinion.parent, model.root);
  assert.equal(blocks.carrierArm.parent, model.root);
  assert.equal(blocks.wheelBody.parent, blocks.wheelRotor);
  assert.equal(blocks.wheelHub.parent, blocks.wheelRotor);
  assert.equal(blocks.wheelFaceIndex.parent, blocks.wheelRotor);
  assert.equal(blocks.wheelToothMeshes.length, 22);
  assert.equal(blocks.wheel.userData.teeth, 22);
  assert.equal(blocks.pinion.userData.teeth, 10);
  assert.equal(geometry.wheelTeeth, 22);
  assert.equal(geometry.pinionTeeth, 10);
  assert.match(blocks.wheel.userData.role, /wheel-A/);
  assert.match(blocks.pinion.userData.role, /pinion-B/);
  assert.match(blocks.carrierArm.userData.role, /single-pivoted-arm/);

  const forbiddenRoles = [];
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (/(?:rack|belt|guide[ -]pulley|guide[ -]wheel)/i.test(role)) {
      forbiddenRoles.push(role);
    }
  });
  assert.deepEqual(
    forbiddenRoles,
    [],
    'Brown 196 contains no rack, belt, or perpendicular guide pulleys',
  );

  assert.deepEqual(sourceAnchors.wheelCenter.toArray(), [130, 250]);
  assert.deepEqual(sourceAnchors.pinionCenter.toArray(), [126, 351]);
  assert.deepEqual(sourceAnchors.carrierPivot.toArray(), [391, 260]);
  assert.equal(sourceRaster.width, 525);
  assert.equal(sourceRaster.height, 525);
  near(sourceRaster.scale, 0.01, 1e-15, 'source raster scale');
  vector2Near(
    sourcePointToModel(sourceAnchors.pinionCenter),
    geometry.pinionCenter,
    1e-14,
    'source pinion B maps to its fixed modeled shaft',
  );
  vector2Near(
    sourcePointToModel(sourceAnchors.carrierPivot),
    geometry.carrierPivot,
    1e-14,
    'source arm pivot maps to its fixed modeled bearing',
  );
  vector2Near(
    sourcePointToModel(sourceAnchors.wheelCenter),
    canonicalStates.sourcePose.wheelCenter,
    0.09,
    'the unrotated source pose puts wheel A within 9 px of Brown\'s hub A',
  );
  vector2Near(
    sourceAnchors.modeledWheelCenterAtSource,
    sourceAnchors.wheelCenter,
    9,
    'the modeled A center stays within 9 source pixels of Brown\'s hub',
  );
  vector2Near(
    modelPointToSourceRaster(geometry.pinionCenter),
    sourceAnchors.pinionCenter,
    1e-12,
    'model-to-source mapping preserves fixed pinion B',
  );
  disposeModel(model.root);
});

test('movement 196 uses a traced closed pitch profile with 22 equal-pitch teeth and exact circle contact', () => {
  const model = createMovementModel(catalog.movements[195]);
  const {
    blocks,
    geometry,
    pitchArcAtProfileParameter,
    profileAtParameter,
    staticGeometryAtProfileParameter,
  } = model.root.userData;

  near(
    geometry.circularPitch,
    FULL_TURN * geometry.pinionPitchRadius / geometry.pinionTeeth,
    1e-15,
    'pinion circular pitch',
  );
  near(
    geometry.pitchPerimeter,
    geometry.wheelTeeth * geometry.circularPitch,
    2e-14,
    '22 wheel pitches close the irregular profile',
  );
  near(
    geometry.module,
    geometry.circularPitch / Math.PI,
    1e-15,
    'common gear module',
  );
  assert.ok(geometry.minimumInputStep > 0, 'the rolling input map is monotone');
  // Brown's wheel A: a small round lobe about A, a concave waist on top
  // and a long lobe reaching right under the arm.
  let rightReach = 0;
  let leftReach = 0;
  let concaveSamples = 0;
  for (let index = 0; index < 720; index += 1) {
    const profile = profileAtParameter(index / 720 * FULL_TURN);
    rightReach = Math.max(rightReach, profile.pitchPoint.x);
    leftReach = Math.max(leftReach, -profile.pitchPoint.x);
    const ahead = profileAtParameter((index + 1) / 720 * FULL_TURN);
    const turn = profile.tangent.x * ahead.tangent.y
      - profile.tangent.y * ahead.tangent.x;
    if (turn < 0 && profile.pitchPoint.y > 0.3) concaveSamples += 1;
  }
  assert.ok(rightReach > leftReach * 1.9, 'the right lobe is much longer');
  assert.ok(rightReach > 1.45 && rightReach < 1.6, 'traced right-lobe reach');
  assert.ok(concaveSamples > 20, 'the upper waist is concave');
  near(
    pitchArcAtProfileParameter(geometry.sourceProfileParameter),
    0,
    1e-15,
    'source contact starts the pitch arc',
  );
  near(
    pitchArcAtProfileParameter(geometry.sourceProfileParameter + FULL_TURN),
    geometry.pitchPerimeter,
    2e-14,
    'pitch arc closes after one profile traversal',
  );

  assert.equal(blocks.wheel.userData.toothData.length, 22);
  blocks.wheel.userData.toothData.forEach((tooth, index) => {
    assert.equal(tooth.index, index);
    near(
      tooth.pitchArc,
      index * geometry.circularPitch,
      2e-14,
      `wheel tooth ${index} has equal pitch arc`,
    );
    const profile = profileAtParameter(tooth.parameter);
    vector2Near(
      tooth.pitchPoint,
      profile.pitchPoint,
      2e-14,
      `wheel tooth ${index} lies on the pitch curve`,
    );
    near(
      tooth.outwardNormal.dot(tooth.tangent),
      0,
      2e-14,
      `wheel tooth ${index} normal is perpendicular to its tangent`,
    );
    near(
      tooth.tipCenter.distanceTo(tooth.pitchPoint),
      geometry.addendum,
      2e-14,
      `wheel tooth ${index} addendum`,
    );
    near(
      tooth.rootCenter.distanceTo(tooth.pitchPoint),
      geometry.dedendum,
      2e-14,
      `wheel tooth ${index} dedendum`,
    );
  });

  let maximumArmError = 0;
  let maximumCenterDistanceError = 0;
  let maximumContactRadiusError = 0;
  let minimumIntersectionHeight = Infinity;
  for (let index = 0; index <= 4096; index += 1) {
    const parameter = geometry.sourceProfileParameter
      + index / 4096 * FULL_TURN;
    const state = staticGeometryAtProfileParameter(parameter);
    maximumArmError = Math.max(
      maximumArmError,
      Math.abs(
        state.wheelCenter.distanceTo(geometry.carrierPivot)
          - geometry.carrierLength,
      ),
    );
    maximumCenterDistanceError = Math.max(
      maximumCenterDistanceError,
      Math.abs(
        state.wheelCenter.distanceTo(geometry.pinionCenter)
          - state.centerDistance,
      ),
    );
    maximumContactRadiusError = Math.max(
      maximumContactRadiusError,
      Math.abs(
        state.contactPoint.distanceTo(geometry.pinionCenter)
          - geometry.pinionPitchRadius,
      ),
    );
    minimumIntersectionHeight = Math.min(
      minimumIntersectionHeight,
      state.circleIntersectionHeight,
    );
    vector2Near(
      state.wheelCenter.clone().add(state.wheelPitchRadiusWorld),
      state.contactPoint,
      2e-14,
      `wheel pitch point meets contact at sample ${index}`,
    );
    vector2Near(
      geometry.pinionCenter.clone().add(state.pinionPitchRadiusWorld),
      state.contactPoint,
      2e-14,
      `pinion pitch point meets contact at sample ${index}`,
    );
    near(
      state.worldNormal.dot(state.worldTangent),
      0,
      2e-14,
      `pitch curves are tangent at sample ${index}`,
    );
  }
  assert.ok(maximumArmError < 1e-14);
  assert.ok(maximumCenterDistanceError < 2e-14);
  assert.ok(maximumContactRadiusError < 2e-14);
  assert.ok(minimumIntersectionHeight > 0.5);
  disposeModel(model.root);
});

test('movement 196 holds pinion B fixed and rolls without slip through 32,769 states while the carrier reverses irregularly', () => {
  const model = createMovementModel(catalog.movements[195]);
  const {
    canonicalStates,
    geometry,
    stateAtInputTravel,
    transmission,
  } = model.root.userData;
  near(
    transmission.totalInputTravel,
    FULL_TURN * geometry.wheelTeeth / geometry.pinionTeeth,
    2e-14,
    'one irregular-wheel traversal advances the 10-tooth pinion by 22 teeth',
  );
  near(
    transmission.pinionRevolutionsPerProfileCycle,
    2.2,
    2e-14,
    'pinion turns per profile cycle',
  );
  near(
    transmission.wheelRevolutionsPerProfileCycle,
    -1,
    3e-14,
    'wheel A makes one opposite turn per profile cycle',
  );
  assert.equal(transmission.carrierReversalCount, 4);
  assert.ok(transmission.carrierSwing > 0.38);

  let maximumArmError = 0;
  let maximumCenterDistanceError = 0;
  let maximumContactRadiusError = 0;
  let maximumMeshPhaseError = 0;
  let maximumRollingVelocityError = 0;
  let minimumWheelSpeed = Infinity;
  let maximumWheelSpeed = -Infinity;
  let minimumCarrierSpeed = Infinity;
  let maximumCarrierSpeed = -Infinity;
  let previousCarrierDirection = 0;
  let carrierReversals = 0;
  const sampleCount = 32768;
  for (let index = 0; index <= sampleCount; index += 1) {
    const inputTravel = transmission.totalInputTravel * index / sampleCount;
    const state = stateAtInputTravel(inputTravel);
    finiteStateNumbers(state, `state[${index}]`);
    near(
      state.pinionAngle,
      canonicalStates.sourcePose.pinionAngle + inputTravel,
      2e-14,
      `pinion input angle is uniform at sample ${index}`,
    );
    vector2Near(
      state.fixedPinionCenter,
      geometry.pinionCenter,
      1e-15,
      `pinion B stays on its fixed axis at sample ${index}`,
    );
    near(
      state.pinionAngularSpeed,
      transmission.pinionAngularSpeed,
      1e-15,
      `pinion B speed stays uniform at sample ${index}`,
    );
    assert.ok(
      state.wheelAngularSpeed < 0,
      `wheel A rolls opposite the input at sample ${index}`,
    );
    maximumArmError = Math.max(maximumArmError, state.armLengthError);
    maximumCenterDistanceError = Math.max(
      maximumCenterDistanceError,
      state.centerDistanceError,
    );
    maximumContactRadiusError = Math.max(
      maximumContactRadiusError,
      state.contactRadiusError,
    );
    maximumMeshPhaseError = Math.max(
      maximumMeshPhaseError,
      state.meshPhaseError,
    );
    maximumRollingVelocityError = Math.max(
      maximumRollingVelocityError,
      state.rollingVelocityError,
    );
    minimumWheelSpeed = Math.min(minimumWheelSpeed, state.wheelAngularSpeed);
    maximumWheelSpeed = Math.max(maximumWheelSpeed, state.wheelAngularSpeed);
    minimumCarrierSpeed = Math.min(
      minimumCarrierSpeed,
      state.carrierAngularSpeed,
    );
    maximumCarrierSpeed = Math.max(
      maximumCarrierSpeed,
      state.carrierAngularSpeed,
    );
    if (index < sampleCount) {
      const direction = Math.sign(state.carrierAngularSpeed);
      if (previousCarrierDirection !== 0 && direction !== previousCarrierDirection) {
        carrierReversals += 1;
      }
      if (direction !== 0) previousCarrierDirection = direction;
    }
  }
  assert.ok(maximumArmError < 2e-14);
  assert.ok(maximumCenterDistanceError < 2e-14);
  assert.ok(maximumContactRadiusError < 2e-14);
  assert.ok(maximumMeshPhaseError < 2e-12);
  assert.ok(maximumRollingVelocityError < 3e-10);
  assert.equal(carrierReversals, 4);
  assert.ok(minimumCarrierSpeed < -0.08);
  assert.ok(maximumCarrierSpeed > 0.06);
  assert.ok(Math.abs(minimumWheelSpeed) > Math.abs(maximumWheelSpeed) * 2.8);

  const majorStroke = Math.abs(canonicalStates.firstInwardExtreme.carrierAngle
    - canonicalStates.majorOutwardExtreme.carrierAngle);
  const minorStroke = Math.abs(canonicalStates.secondInwardExtreme.carrierAngle
    - canonicalStates.minorOutwardExtreme.carrierAngle);
  assert.ok(majorStroke > 0.3);
  assert.ok(minorStroke > 0.1);
  assert.ok(majorStroke > minorStroke * 2.7);
  assert.ok(
    Math.abs(canonicalStates.majorOutwardExtreme.carrierAngularSpeed) < 5e-5,
  );
  assert.ok(
    Math.abs(canonicalStates.firstInwardExtreme.carrierAngularSpeed) < 5e-5,
  );
  assert.ok(
    Math.abs(canonicalStates.minorOutwardExtreme.carrierAngularSpeed) < 5e-5,
  );
  assert.ok(
    Math.abs(canonicalStates.secondInwardExtreme.carrierAngularSpeed) < 5e-5,
  );

  vector2Near(
    canonicalStates.meshCycleClosure.wheelCenter,
    canonicalStates.sourcePose.wheelCenter,
    2e-14,
    'wheel center and arm close after one profile cycle',
  );
  near(
    canonicalStates.meshCycleClosure.wheelAngle
      - canonicalStates.sourcePose.wheelAngle,
    -FULL_TURN,
    3e-14,
    'wheel A closes after one opposite revolution',
  );
  near(
    canonicalStates.meshCycleClosure.pinionAngle
      - canonicalStates.sourcePose.pinionAngle,
    FULL_TURN * 2.2,
    2e-14,
    'pinion advances 2.2 turns per wheel profile cycle',
  );
  near(
    canonicalStates.completeIndexClosure.wheelAngle
      - canonicalStates.sourcePose.wheelAngle,
    -FULL_TURN * 5,
    2e-13,
    'wheel face index closes after five profile cycles',
  );
  near(
    canonicalStates.completeIndexClosure.pinionAngle
      - canonicalStates.sourcePose.pinionAngle,
    FULL_TURN * 11,
    2e-13,
    'pinion face index closes after eleven turns',
  );
  disposeModel(model.root);
});

test('movement 196 rendered transforms show independent wheel spin, arm vibration, fixed pinion input, and index closure', () => {
  const model = createMovementModel(catalog.movements[195]);
  const {
    blocks,
    canonicalStates,
    canonicalTimes,
    geometry,
  } = model.root.userData;
  const pinionFaceIndex = blocks.pinion.userData.rotor.children.at(-1);
  const armEndpointZ = geometry.wheelDepth / 2 + 0.235;

  for (const [name, time] of Object.entries(canonicalTimes)) {
    model.update(time);
    const state = canonicalStates[name];
    vector2Near(
      blocks.wheel.position,
      state.wheelCenter,
      2e-14,
      `${name} rendered wheel A center`,
    );
    vector2Near(
      blocks.wheelShaft.position,
      state.wheelCenter,
      2e-14,
      `${name} carried wheel A shaft`,
    );
    vector2Near(
      blocks.pinion.position,
      geometry.pinionCenter,
      1e-15,
      `${name} rendered pinion B remains fixed`,
    );
    near(
      blocks.wheelRotor.rotation.z,
      state.wheelAngle,
      2e-14,
      `${name} independently rotating wheel A`,
    );
    near(
      blocks.pinion.userData.rotor.rotation.z,
      state.pinionAngle,
      2e-14,
      `${name} uniformly rotating pinion B`,
    );
    vector3Near(
      blocks.boredCarrierLink.position,
      new THREE.Vector3(
        geometry.carrierPivot.x,
        geometry.carrierPivot.y,
        armEndpointZ,
      ),
      2e-14,
      `${name} fixed arm pivot`,
    );
    vector3Near(
      new THREE.Vector3(geometry.carrierLength, 0, 0)
        .applyAxisAngle(Z_AXIS, blocks.boredCarrierLink.rotation.z)
        .add(blocks.boredCarrierLink.position),
      new THREE.Vector3(
        state.wheelCenter.x,
        state.wheelCenter.y,
        armEndpointZ,
      ),
      2e-14,
      `${name} arm end carries wheel A`,
    );
    vector2Near(
      blocks.contactMarker.position,
      state.contactPoint,
      2e-14,
      `${name} rendered pitch-contact marker`,
    );
    assert.equal(
      model.root.userData.contacts.irregularWheelPinionMesh
        .activeWheelToothIndex,
      state.activeWheelToothIndex,
    );
    near(
      model.root.userData.contacts.irregularWheelPinionMesh
        .rollingVelocityError,
      state.rollingVelocityError,
      1e-18,
      `${name} rendered rolling constraint`,
    );
  }

  const worldPosition = (object) => {
    model.root.updateMatrixWorld(true);
    return object.getWorldPosition(new THREE.Vector3());
  };
  model.update(canonicalTimes.sourcePose);
  const sourceWheelIndex = worldPosition(blocks.wheelIndexTip);
  const sourcePinionIndex = worldPosition(pinionFaceIndex);
  model.update(canonicalTimes.meshCycleClosure);
  const meshCycleWheelIndex = worldPosition(blocks.wheelIndexTip);
  const meshCyclePinionIndex = worldPosition(pinionFaceIndex);
  vector3Near(
    meshCycleWheelIndex,
    sourceWheelIndex,
    2e-13,
    'wheel A index closes after one profile cycle',
  );
  assert.ok(
    meshCyclePinionIndex.distanceTo(sourcePinionIndex) > 0.18,
    'pinion B face index still exposes its fractional 2.2-turn advance',
  );
  model.update(canonicalTimes.completeIndexClosure);
  vector3Near(
    worldPosition(blocks.wheelIndexTip),
    sourceWheelIndex,
    3e-13,
    'wheel A face index closes after five cycles',
  );
  vector3Near(
    worldPosition(pinionFaceIndex),
    sourcePinionIndex,
    3e-13,
    'pinion B face index closes after eleven turns',
  );
  assert.ok(
    Math.abs(
      wrappedAngleDifference(
        canonicalStates.majorOutwardExtreme.wheelAngle,
        canonicalStates.majorOutwardExtreme.carrierAngle,
      ) - wrappedAngleDifference(
        canonicalStates.sourcePose.wheelAngle,
        canonicalStates.sourcePose.carrierAngle,
      ),
    ) > 0.5,
    'wheel A visibly spins independently of the vibrating carrier',
  );
  disposeModel(model.root);
});

test('movement 196 is fully three-dimensional as the review queue advances through 200', () => {
  const model = createMovementModel(catalog.movements[195]);
  const { blocks, canonicalTimes } = model.root.userData;
  const physicalBounds = new THREE.Box3();
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const object of [
      blocks.wheel,
      blocks.pinion,
      blocks.wheelShaft,
      blocks.pinionShaft,
      blocks.carrierArm,
      blocks.carrierStandard,
      blocks.frameFoot,
    ]) physicalBounds.expandByObject(object);
  // Brown draws no standard behind pinion B; the arm pivot stands on a
  // short pedestal over a block.
  assert.equal(blocks.pinionStandard, null);
  assert.equal(blocks.carrierStandard.userData.role, 'fixed-flared-standard-with-arm-pivot-eye');
  // p101: the stand eye is part of the one grey casting, concentric with the pin.
  assert.equal(blocks.carrierBearing, blocks.carrierStandard);
  assert.ok(Math.abs(blocks.carrierStandard.userData.eyeRadius - 0.23) < 1e-12);
  }
  const size = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 5.1);
  assert.ok(size.y > 3.5);
  // p93: wheel A's shaft is trimmed to its hub and strap, and the pedestal
  // stands in the arm's plane. p96: pinion B's axle ends just proud of its
  // hub; no undrawn bearing, stay or flange runs back behind it.
  assert.ok(size.z > 0.75);
  assert.ok(physicalBounds.min.z > -0.3 && physicalBounds.min.z < -0.2);
  assert.ok(physicalBounds.max.z > 0.5);
  const axle = blocks.pinionShaft.userData.rotor.children[0];
  assert.equal(axle.userData.role, 'pinion-B-axle-ending-at-its-hub-faces');
  assert.ok(Math.abs(axle.geometry.parameters.height - 0.5) < 1e-9);
  model.root.traverse((object) => {
    assert.ok(!/stay-from-pinion-B|framing-flange|framing-wall/.test(object.userData.role ?? ''), object.userData.role);
    if (object.userData.role === 'fixed-bearing-at-pinion-B') assert.equal(object.visible, false);
  });
  let meshCount = 0;
  let irregularWheelToothCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
    if (object.userData.role === 'equal-pitch-tooth-on-irregular-wheel-A') {
      irregularWheelToothCount += 1;
    }
  });
  assert.ok(meshCount >= 44);
  assert.equal(irregularWheelToothCount, 22);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 1.7);
  assert.ok(blocks.wheel.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.pinion.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.wheelShaft.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.pinionShaft.userData.axis.distanceTo(Z_AXIS) < 1e-14);

  const movement195 = createMovementModel(catalog.movements[194]);
  const movement197 = createMovementModel(catalog.movements[196]);
  const movement198 = createMovementModel(catalog.movements[197]);
  const movement199 = createMovementModel(catalog.movements[198]);
  const movement200 = createMovementModel(catalog.movements[199]);
  assert.equal(movement195.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(movement197.root.userData.fidelity, 'authored');
  assert.equal(movement198.root.userData.fidelity, 'authored');
  assert.equal(movement199.root.userData.fidelity, 'authored');
  assert.equal(movement200.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement195.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement197.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement195.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.notEqual(
    movement197.root.userData.archetype,
    model.root.userData.archetype,
  );
  disposeModel(movement195.root);
  disposeModel(movement197.root);
  disposeModel(movement198.root);
  disposeModel(movement199.root);
  disposeModel(movement200.root);
  disposeModel(model.root);
});
