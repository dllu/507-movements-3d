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

test('movement 197 matches Brown\'s moving square frame, eleven-pin rack, two end guides, and vertically floating pinion', () => {
  const movement = catalog.movements[196];
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

  assert.equal(movement.id, 197);
  assert.equal(movement.number, '197');
  assert.equal(movement.title, 'Capsule-Guided Mangle Rack');
  assert.equal(movement.category, 'Rack & pinion');
  assert.equal(
    movement.description,
    '197. What is called a “mangle-rack.” A continuous rotation of the pinion will give a reciprocating motion to the square frame. The pinion-shaft must be free to rise and fall, to pass round the guides at the ends of the rack. This motion may be modified as follows:—If the square frame be fixed, and the pinion be fixed upon a shaft made with a universal joint, the end of the shaft will describe a line, similar to that shown in the drawing, around the rack.',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'continuous-pinion-capsule-guided-mangle-rack-reciprocating-frame',
  );
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'uniform-pinion-three-turn-capsule-roll-reciprocating-square-frame-with-vertical-shaft-float',
  );
  assert.equal(
    model.root.userData.variant,
    'moving-square-frame-with-vertically-floating-pinion-shaft',
  );

  assert.equal(blocks.rackAssembly.parent, model.root);
  assert.equal(blocks.pinion.parent, model.root);
  assert.equal(blocks.pinionShaft.parent, model.root);
  assert.equal(blocks.shaftSlider.parent, model.root);
  assert.equal(blocks.rackPlate.parent, blocks.rackAssembly);
  assert.equal(blocks.leftEndGuide.parent, blocks.rackAssembly);
  assert.equal(blocks.rightEndGuide.parent, blocks.rackAssembly);
  assert.equal(blocks.outerFrameMembers.length, 4);
  blocks.outerFrameMembers.forEach((member) => {
    assert.equal(member.parent, blocks.rackAssembly);
  });
  assert.equal(blocks.rackPins.length, 11);
  assert.equal(blocks.rackPinRims.length, 11);
  assert.equal(blocks.pinion.userData.teeth, 10);
  assert.equal(geometry.rackPinCount, 11);
  assert.equal(geometry.pinionTeeth, 10);
  assert.match(blocks.leftEndGuide.userData.role, /left-end/);
  assert.match(blocks.rightEndGuide.userData.role, /right-end/);
  assert.match(blocks.pinionShaft.userData.role, /vertically-free/);

  const universalJointRoles = [];
  model.root.traverse((object) => {
    if (/universal/i.test(object.userData.role ?? '')) {
      universalJointRoles.push(object.userData.role);
    }
  });
  assert.deepEqual(
    universalJointRoles,
    [],
    'the rendered primary variant moves the frame; it does not substitute Brown\'s optional fixed-frame universal-joint variant',
  );

  assert.deepEqual(sourceAnchors.pinionCenter.toArray(), [204, 212]);
  assert.deepEqual(sourceAnchors.rackFirstPin.toArray(), [130, 255]);
  assert.deepEqual(sourceAnchors.rackLastPin.toArray(), [402, 255]);
  assert.equal(sourceRaster.width, 525);
  assert.equal(sourceRaster.height, 525);
  near(
    sourceRaster.scale,
    geometry.circularPitch / geometry.sourceRackPinSpacing,
    1e-15,
    'source scale is fixed by the rack-pin pitch',
  );
  assert.equal(sourceAnchors.modeledRackPins.length, 11);
  sourceAnchors.modeledRackPins.forEach((point, index) => {
    vector2Near(
      point,
      new THREE.Vector2(130 + index * 27.2, 255),
      2e-12,
      `source rack pin ${index}`,
    );
  });
  vector2Near(
    sourceAnchors.modeledPinionCenter,
    sourceAnchors.pinionCenter,
    0.31,
    'source-fitted pinion center',
  );
  sourceAnchors.modeledFrameCorners.forEach((corner, index) => {
    vector2Near(
      corner,
      sourceAnchors.frameCorners[index],
      5,
      `source outer-frame corner ${index}`,
    );
  });
  vector2Near(
    sourcePointToModel(sourceAnchors.rackFirstPin),
    new THREE.Vector2(
      blocks.rackPins[0].position.x
        + canonicalStates.sourcePose.rackTranslation.x,
      0,
    ),
    2e-14,
    'first source rack pin maps into the moving frame',
  );
  vector2Near(
    modelPointToSourceRaster(canonicalStates.sourcePose.pinionCenter),
    sourceAnchors.modeledPinionCenter,
    1e-14,
    'modeled source pinion maps back to the engraving',
  );
  disposeModel(model.root);
});

test('movement 197 closes a ten-pitch, two-semicircle capsule path in exactly three pinion turns', () => {
  const model = createMovementModel(catalog.movements[196]);
  const {
    blocks,
    evaluateCapsuleAtPathDistance,
    geometry,
    transmission,
  } = model.root.userData;

  near(
    geometry.straightRackLength,
    geometry.rackPitchCount * geometry.circularPitch,
    1e-15,
    'ten straight rack pitches',
  );
  near(
    geometry.pinionPitchRadius,
    geometry.pinionTeeth * geometry.circularPitch / FULL_TURN,
    1e-15,
    '10-tooth pinion pitch radius',
  );
  near(
    geometry.endTurnLength,
    Math.PI * geometry.pinionPitchRadius,
    1e-15,
    'each guide turn is one pitch-radius semicircle',
  );
  near(
    geometry.endTurnLength,
    geometry.circularPitch * 5,
    1e-15,
    'each end turn advances five pinion teeth',
  );
  near(
    geometry.capsulePerimeter,
    geometry.circularPitch * 30,
    2e-15,
    'capsule has thirty equal pitch lengths',
  );
  near(
    geometry.inputTravelPerCycle,
    FULL_TURN * 3,
    3e-15,
    'one frame cycle takes exactly three pinion turns',
  );
  near(
    transmission.rackStroke,
    geometry.straightRackLength + 2 * geometry.pinionPitchRadius,
    1e-15,
    'full frame stroke includes both outward guide bulges',
  );
  assert.equal(transmission.rackReversalsPerCycle, 2);
  near(transmission.pinionRevolutionsPerRackCycle, 3, 1e-15, 'signed turns');

  blocks.rackPins.forEach((pin, index) => {
    assert.equal(pin.userData.index, index);
    near(
      pin.position.x,
      -geometry.straightRackLength / 2 + index * geometry.circularPitch,
      2e-14,
      `rack pin ${index} pitch position`,
    );
    if (index > 0) {
      near(
        pin.position.x - blocks.rackPins[index - 1].position.x,
        geometry.circularPitch,
        2e-14,
        `rack pin ${index} spacing`,
      );
    }
  });
  near(
    blocks.leftEndGuide.userData.pathRadius,
    geometry.guideRailCenterRadius,
    1e-15,
    'left guide rail radius',
  );
  near(
    blocks.rightEndGuide.userData.pathRadius,
    geometry.guideRailCenterRadius,
    1e-15,
    'right guide rail radius',
  );
  assert.ok(geometry.guideFollowerOuterRadius > 0.2);
  assert.ok(
    geometry.guideRailCenterRadius - geometry.guideRailRadius
      - geometry.pinionPitchRadius - geometry.guideFollowerOuterRadius
      < 0.01,
    'the shaft collar runs immediately inside each end guide',
  );

  const segments = new Set();
  let maximumPathError = 0;
  for (let index = 0; index <= 16384; index += 1) {
    const distance = geometry.capsulePerimeter * index / 16384;
    const state = evaluateCapsuleAtPathDistance(distance);
    finiteStateNumbers(state, `capsule[${index}]`);
    segments.add(state.pathSegment);
    near(state.tangent.length(), 1, 2e-14, `unit tangent ${index}`);
    if (state.endCenterLocal) {
      maximumPathError = Math.max(
        maximumPathError,
        Math.abs(
          state.wheelCenterRelativeToRack.distanceTo(state.endCenterLocal)
            - geometry.pinionPitchRadius,
        ),
      );
    } else {
      maximumPathError = Math.max(
        maximumPathError,
        Math.abs(
          Math.abs(state.wheelCenterRelativeToRack.y)
            - geometry.pinionPitchRadius,
        ),
      );
    }
  }
  assert.deepEqual([...segments], [
    'upper-rack-run',
    'right-end-guide-turn',
    'lower-rack-run',
    'left-end-guide-turn',
  ]);
  assert.ok(maximumPathError < 4e-16);

  const boundaries = [
    geometry.straightRackLength,
    geometry.straightRackLength + geometry.endTurnLength,
    2 * geometry.straightRackLength + geometry.endTurnLength,
    geometry.capsulePerimeter,
  ];
  const epsilon = 1e-8;
  boundaries.forEach((boundary, index) => {
    const before = evaluateCapsuleAtPathDistance(boundary - epsilon);
    const after = evaluateCapsuleAtPathDistance(boundary + epsilon);
    vector2Near(
      before.wheelCenterRelativeToRack,
      after.wheelCenterRelativeToRack,
      epsilon * 2.1,
      `capsule position is continuous at boundary ${index}`,
    );
    vector2Near(
      before.tangent,
      after.tangent,
      epsilon / geometry.pinionPitchRadius * 1.1,
      `capsule velocity direction is continuous at boundary ${index}`,
    );
  });
  disposeModel(model.root);
});

test('movement 197 rolls without slip through 32,769 states while the frame reverses and the shaft only rises and falls', () => {
  const model = createMovementModel(catalog.movements[196]);
  const {
    canonicalStates,
    geometry,
    stateAtInputTravel,
    transmission,
  } = model.root.userData;
  const sampleCount = 32768;
  const segments = new Set();
  let maximumContactRadiusError = 0;
  let maximumFixedHorizontalError = 0;
  let maximumFrameVerticalError = 0;
  let maximumGuidePathError = 0;
  let maximumMeshPhaseError = 0;
  let maximumRollingVelocityError = 0;
  let minimumRackPosition = Infinity;
  let maximumRackPosition = -Infinity;
  let minimumShaftPosition = Infinity;
  let maximumShaftPosition = -Infinity;
  let previousRackDirection = 0;
  let rackReversals = 0;
  for (let index = 0; index <= sampleCount; index += 1) {
    const inputTravel = transmission.inputTravelPerCycle
      * index / sampleCount;
    const state = stateAtInputTravel(inputTravel);
    finiteStateNumbers(state, `state[${index}]`);
    segments.add(state.pathSegment);
    near(
      state.pinionAngle,
      canonicalStates.sourcePose.pinionAngle + inputTravel,
      4e-14,
      `uniform counterclockwise pinion angle at sample ${index}`,
    );
    near(
      state.pinionAngularSpeed,
      transmission.pinionAngularSpeed,
      1e-15,
      `uniform pinion speed at sample ${index}`,
    );
    near(
      Math.hypot(state.rackVelocity.x, state.shaftVerticalVelocity),
      transmission.rackStraightRunSpeed,
      2e-15,
      `constant capsule path speed at sample ${index}`,
    );
    maximumContactRadiusError = Math.max(
      maximumContactRadiusError,
      state.contactRadiusError,
    );
    maximumFixedHorizontalError = Math.max(
      maximumFixedHorizontalError,
      state.fixedPinionHorizontalError,
    );
    maximumFrameVerticalError = Math.max(
      maximumFrameVerticalError,
      state.frameVerticalError,
    );
    maximumGuidePathError = Math.max(
      maximumGuidePathError,
      state.guidePathError,
    );
    maximumMeshPhaseError = Math.max(
      maximumMeshPhaseError,
      state.meshPhaseError,
    );
    maximumRollingVelocityError = Math.max(
      maximumRollingVelocityError,
      state.rollingVelocityError,
    );
    minimumRackPosition = Math.min(
      minimumRackPosition,
      state.rackTranslation.x,
    );
    maximumRackPosition = Math.max(
      maximumRackPosition,
      state.rackTranslation.x,
    );
    minimumShaftPosition = Math.min(
      minimumShaftPosition,
      state.pinionCenter.y,
    );
    maximumShaftPosition = Math.max(
      maximumShaftPosition,
      state.pinionCenter.y,
    );
    if (index < sampleCount) {
      const direction = Math.sign(state.rackVelocity.x);
      if (direction !== 0 && previousRackDirection !== 0
        && direction !== previousRackDirection) {
        rackReversals += 1;
      }
      if (direction !== 0) previousRackDirection = direction;
    }
    if (/rack-run/.test(state.pathSegment)) {
      near(
        Math.abs(state.rackVelocity.x),
        transmission.rackStraightRunSpeed,
        1e-15,
        `constant straight-run rack speed at sample ${index}`,
      );
      near(
        state.shaftVerticalVelocity,
        0,
        1e-15,
        `shaft dwells vertically on straight run at sample ${index}`,
      );
    }
  }
  assert.deepEqual([...segments], [
    'upper-rack-run',
    'left-end-guide-turn',
    'lower-rack-run',
    'right-end-guide-turn',
  ]);
  assert.equal(rackReversals, 2);
  assert.ok(maximumContactRadiusError < 4e-16);
  assert.equal(maximumFixedHorizontalError, 0);
  assert.equal(maximumFrameVerticalError, 0);
  assert.ok(maximumGuidePathError < 4e-16);
  assert.ok(maximumMeshPhaseError < 2e-15);
  assert.ok(maximumRollingVelocityError < 4e-16);
  near(
    minimumRackPosition,
    -transmission.rackStroke / 2,
    1e-8,
    'left frame extreme',
  );
  near(
    maximumRackPosition,
    transmission.rackStroke / 2,
    1e-8,
    'right frame extreme',
  );
  near(
    minimumShaftPosition,
    -geometry.pinionPitchRadius,
    1e-14,
    'lower shaft level',
  );
  near(
    maximumShaftPosition,
    geometry.pinionPitchRadius,
    1e-14,
    'upper shaft level',
  );

  near(
    canonicalStates.rightRackExtreme.rackVelocity.x,
    0,
    2e-15,
    'rack stops at right guide midpoint',
  );
  near(
    canonicalStates.rightRackExtreme.shaftVerticalVelocity,
    transmission.rackStraightRunSpeed,
    2e-15,
    'shaft rises at full speed through right guide midpoint',
  );
  near(
    canonicalStates.leftRackExtreme.rackVelocity.x,
    0,
    4e-15,
    'rack stops at left guide midpoint',
  );
  near(
    canonicalStates.leftRackExtreme.shaftVerticalVelocity,
    -transmission.rackStraightRunSpeed,
    2e-15,
    'shaft descends at full speed through left guide midpoint',
  );

  const boundaryTravels = [
    model.root.userData.canonicalInputTravels.upperRunEnd,
    model.root.userData.canonicalInputTravels.lowerRunStart,
    model.root.userData.canonicalInputTravels.lowerRunEnd,
    model.root.userData.canonicalInputTravels.upperRunStart,
  ];
  const epsilon = 1e-7;
  boundaryTravels.forEach((travel, index) => {
    const before = stateAtInputTravel(travel - epsilon);
    const after = stateAtInputTravel(travel + epsilon);
    vector2Near(
      before.rackVelocity,
      after.rackVelocity,
      epsilon * transmission.rackStraightRunSpeed * 2,
      `rack velocity is tangent-continuous at transfer ${index}`,
    );
    vector2Near(
      before.pinionCenterVelocity,
      after.pinionCenterVelocity,
      epsilon * transmission.rackStraightRunSpeed * 2,
      `shaft velocity is tangent-continuous at transfer ${index}`,
    );
  });

  vector2Near(
    canonicalStates.cycleClosure.rackTranslation,
    canonicalStates.sourcePose.rackTranslation,
    3e-15,
    'frame closes after one rack cycle',
  );
  vector2Near(
    canonicalStates.cycleClosure.pinionCenter,
    canonicalStates.sourcePose.pinionCenter,
    2e-15,
    'floating shaft closes after one rack cycle',
  );
  near(
    canonicalStates.cycleClosure.pinionAngle
      - canonicalStates.sourcePose.pinionAngle,
    FULL_TURN * 3,
    4e-14,
    'pinion closes after three counterclockwise turns',
  );
  disposeModel(model.root);
});

test('movement 197 rendered transforms preserve the moving-frame and vertical-shaft constraints through every canonical pose', () => {
  const model = createMovementModel(catalog.movements[196]);
  const {
    blocks,
    canonicalStates,
    canonicalTimes,
  } = model.root.userData;
  for (const [name, time] of Object.entries(canonicalTimes)) {
    model.update(time);
    const state = canonicalStates[name];
    const renderedState = model.root.userData.kinematics;
    near(
      blocks.rackAssembly.position.x,
      state.rackTranslation.x,
      2e-14,
      `${name} horizontal square-frame translation`,
    );
    near(blocks.rackAssembly.position.y, 0, 1e-15, `${name} frame y`);
    near(blocks.pinion.position.x, 0, 1e-15, `${name} pinion fixed x`);
    near(
      blocks.pinion.position.y,
      state.pinionCenter.y,
      2e-14,
      `${name} floating pinion height`,
    );
    near(
      blocks.pinionShaft.position.y,
      state.pinionCenter.y,
      2e-14,
      `${name} floating shaft height`,
    );
    near(
      blocks.shaftGuideFollower.position.y,
      state.pinionCenter.y,
      2e-14,
      `${name} guide follower height`,
    );
    near(
      blocks.shaftSlider.position.y,
      state.pinionCenter.y,
      2e-14,
      `${name} vertical bearing carriage`,
    );
    near(
      blocks.pinion.userData.rotor.rotation.z,
      state.pinionAngle,
      3e-14,
      `${name} rendered pinion angle`,
    );
    near(
      blocks.pinionShaft.userData.rotor.rotation.z,
      state.pinionAngle,
      3e-14,
      `${name} rendered shaft angle`,
    );
    vector2Near(
      blocks.contactMarker.position,
      state.contactPoint,
      2e-14,
      `${name} pitch contact marker`,
    );
    assert.equal(
      model.root.userData.contacts.capsuleGuideConstraint.segment,
      renderedState.pathSegment,
    );
    assert.equal(
      model.root.userData.contacts.mangleRackMesh.activeRackPinIndex,
      renderedState.activeRackPinIndex,
    );
    near(
      model.root.userData.contacts.mangleRackMesh.rollingVelocityError,
      renderedState.rollingVelocityError,
      1e-18,
      `${name} rendered no-slip contact`,
    );
    blocks.rackPins.forEach((pin, index) => {
      near(
        pin.position.x + blocks.rackAssembly.position.x,
        -model.root.userData.geometry.straightRackLength / 2
          + index * model.root.userData.geometry.circularPitch
          + state.rackTranslation.x,
        2e-14,
        `${name} rack pin ${index} follows the frame`,
      );
    });
  }

  model.update(canonicalTimes.sourcePose);
  model.root.updateMatrixWorld(true);
  const pinionIndex = blocks.pinion.userData.rotor.children.at(-1);
  const sourcePinionIndex = pinionIndex.getWorldPosition(new THREE.Vector3());
  const sourceFirstRackPin = blocks.rackPins[0].getWorldPosition(
    new THREE.Vector3(),
  );
  model.update(canonicalTimes.cycleClosure);
  model.root.updateMatrixWorld(true);
  vector3Near(
    pinionIndex.getWorldPosition(new THREE.Vector3()),
    sourcePinionIndex,
    4e-14,
    'pinion face index closes after its three turns',
  );
  vector3Near(
    blocks.rackPins[0].getWorldPosition(new THREE.Vector3()),
    sourceFirstRackPin,
    4e-14,
    'moving rack frame closes after one reciprocation',
  );

  model.update(canonicalTimes.rightRackExtreme);
  const rightGuideCenterWorld = blocks.rightEndGuide.userData.center.clone()
    .add(new THREE.Vector2(blocks.rackAssembly.position.x, 0));
  near(
    blocks.pinion.position.x - rightGuideCenterWorld.x,
    model.root.userData.geometry.pinionPitchRadius,
    2e-14,
    'pinion lies on the right terminal guide circle at reversal',
  );
  model.update(canonicalTimes.leftRackExtreme);
  const leftGuideCenterWorld = blocks.leftEndGuide.userData.center.clone()
    .add(new THREE.Vector2(blocks.rackAssembly.position.x, 0));
  near(
    leftGuideCenterWorld.x - blocks.pinion.position.x,
    model.root.userData.geometry.pinionPitchRadius,
    2e-14,
    'pinion lies on the left terminal guide circle at reversal',
  );

  model.update(canonicalTimes.sourcePose);
  model.root.updateMatrixWorld(true);
  const rackPlateBounds = new THREE.Box3().setFromObject(blocks.rackPlate);
  const pinionBounds = new THREE.Box3().setFromObject(blocks.pinion);
  const rackPinBounds = new THREE.Box3().setFromObject(blocks.rackPins[3]);
  assert.ok(
    rackPlateBounds.max.z < pinionBounds.min.z - 0.04,
    'the rack backing plate clears the pinion in depth',
  );
  assert.ok(
    rackPinBounds.max.z > pinionBounds.min.z,
    'the projecting rack pins enter the pinion plane',
  );
  disposeModel(model.root);
});

test('movement 197 remains fully three-dimensional as the review queue advances through 200', () => {
  const model = createMovementModel(catalog.movements[196]);
  const { blocks, canonicalTimes } = model.root.userData;
  const physicalBounds = new THREE.Box3();
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const object of [
      blocks.rackAssembly,
      blocks.pinion,
      blocks.pinionShaft,
      blocks.shaftGuideFollower,
      blocks.fixedGuideLeft,
      blocks.fixedGuideRight,
      blocks.shaftSlider,
    ]) physicalBounds.expandByObject(object);
  }
  const size = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 13.2);
  assert.ok(size.y > 3.86);
  assert.ok(size.z > 1.32);
  assert.ok(physicalBounds.min.z < -0.76);
  assert.ok(physicalBounds.max.z > 0.55);
  let visibleMeshCount = 0;
  let rackPinCount = 0;
  let endGuideCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh && object.visible) visibleMeshCount += 1;
    if (object.userData.role === 'round-pin-tooth-of-mangle-rack') {
      rackPinCount += 1;
    }
    if (/end-shaft-rise-and-fall-guide/.test(object.userData.role ?? '')) {
      endGuideCount += 1;
    }
  });
  // The undrawn shaft rails and guide/rack mounts are presented away.
  assert.ok(visibleMeshCount >= 43);
  assert.equal(rackPinCount, 11);
  assert.equal(endGuideCount, 2);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 1.7);
  assert.ok(blocks.pinion.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.pinionShaft.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.equal(blocks.fixedGuideLeft.userData.fixed, true);
  assert.equal(blocks.fixedGuideRight.userData.fixed, true);
  assert.equal(blocks.sweptEnvelope.visible, false);

  const movement196 = createMovementModel(catalog.movements[195]);
  const movement198 = createMovementModel(catalog.movements[197]);
  const movement199 = createMovementModel(catalog.movements[198]);
  const movement200 = createMovementModel(catalog.movements[199]);
  assert.equal(movement196.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(movement198.root.userData.fidelity, 'authored');
  assert.equal(movement199.root.userData.fidelity, 'authored');
  assert.equal(movement200.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement196.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement198.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement196.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.notEqual(
    movement198.root.userData.archetype,
    model.root.userData.archetype,
  );
  disposeModel(movement196.root);
  disposeModel(movement198.root);
  disposeModel(movement199.root);
  disposeModel(movement200.root);
  disposeModel(model.root);
});


test('197 source-direction playback has consistent translational and rotational derivatives', () => {
  const model = createMovementModel(catalog.movements[196]);
  const { stateAtTime, transmission } = model.root.userData;
  // The registered source uses add_rot(..., 3, ...) in Y-up coordinates.
  assert.ok(stateAtTime(0).rackVelocity.x > 0);
  for (let i = 0; i < 65; i += 1) {
    const time = transmission.cyclePeriod * (i + 0.31) / 65;
    const h = 1e-5;
    const state = stateAtTime(time);
    const before = stateAtTime(time - h);
    const after = stateAtTime(time + h);
    near((after.pinionAngle - before.pinionAngle) / (2 * h), 0.9,
      1e-8, 'source counterclockwise pinion speed');
    for (const [position, velocity, acceleration] of [
      ['rackTranslation', 'rackVelocity', 'frameAcceleration'],
      ['pinionCenter', 'pinionCenterVelocity', 'pinionCenterAcceleration'],
    ]) {
      vector2Near(after[position].clone().sub(before[position]).multiplyScalar(1 / (2 * h)),
        state[velocity], 1e-8, `${position} velocity`);
      vector2Near(after[velocity].clone().sub(before[velocity]).multiplyScalar(1 / (2 * h)),
        state[acceleration], 1e-8, `${position} acceleration`);
    }
  }
  disposeModel(model.root);
});
