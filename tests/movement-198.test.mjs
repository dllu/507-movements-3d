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

test('movement 198 matches Brown\'s fixed pinion, endless rack, two lifting rods, main frame, and four guide rollers', () => {
  const movement = catalog.movements[197];
  const model = createMovementModel(movement);
  const {
    blocks,
    canonicalStates,
    geometry,
    sourceAnchors,
    sourceRaster,
  } = model.root.userData;

  assert.equal(movement.id, 198);
  assert.equal(movement.number, '198');
  assert.equal(movement.title, 'Fixed-Pinion Rod-Lifted Mangle Rack');
  assert.equal(movement.category, 'Rack & pinion');
  assert.equal(
    movement.description,
    '198. A modification of 197. In this the pinion revolves, but does not rise and fall as in the former figure. The portion of the frame carrying the rack is jointed to the main portion of the frame by rods, so that when the pinion arrives at the end it lifts the rack by its own movement, and follows on the other side.',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'fixed-pinion-two-rod-lifted-endless-mangle-rack-horizontal-frame',
  );
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'six-tooth-fixed-pinion-rolls-five-turns-around-thirty-six-tooth-rack-with-exact-two-rod-carrier-closure',
  );
  assert.equal(
    model.root.userData.variant,
    'fixed-pinion-rigid-two-rod-rack-lift-and-roller-guided-main-frame',
  );

  assert.equal(blocks.rackCarrier.parent, model.root);
  assert.equal(blocks.outerFrame.parent, model.root);
  assert.equal(blocks.pinion.parent, model.root);
  assert.equal(blocks.pinionShaft.parent, model.root);
  assert.equal(blocks.topSuspensionRod.parent, model.root);
  assert.equal(blocks.bottomSuspensionRod.parent, model.root);
  assert.equal(blocks.carrierPlate.parent, blocks.rackCarrier);
  assert.equal(blocks.carrierCrossTie.parent, blocks.rackCarrier);
  assert.equal(blocks.carrierTopPivot.parent, blocks.rackCarrier);
  assert.equal(blocks.carrierBottomPivot.parent, blocks.rackCarrier);
  assert.equal(blocks.frameMembers.length, 4);
  blocks.frameMembers.forEach((member) => {
    assert.equal(member.parent, blocks.outerFrame);
  });
  assert.equal(blocks.rackTeeth.length, 36);
  blocks.rackTeeth.forEach((tooth, index) => {
    assert.equal(tooth.parent, blocks.rackCarrier);
    assert.equal(tooth.userData.index, index);
  });
  assert.equal(blocks.guideRollers.length, 4);
  assert.equal(blocks.guideRollerShafts.length, 4);
  blocks.guideRollers.forEach((roller) => {
    assert.equal(roller.parent, model.root);
    assert.equal(roller.userData.fixedCenter, true);
  });
  assert.equal(blocks.pinion.userData.teeth, 6);
  assert.equal(blocks.pinionShaft.userData.fixed, true);
  assert.match(blocks.pinionShaft.userData.role, /does-not-rise-or-fall/);
  assert.match(blocks.topSuspensionRod.userData.role, /upper-rack-lifting/);
  assert.match(blocks.bottomSuspensionRod.userData.role, /lower-rack-lifting/);

  const suspensionRodRoles = [];
  const floatingPinionRoles = [];
  model.root.traverse((object) => {
    if (/rack-lifting-rod/.test(object.userData.role ?? '')) {
      suspensionRodRoles.push(object.userData.role);
    }
    if (/floating-pinion|pinion-shaft.*rise-and-fall/.test(
      object.userData.role ?? '',
    )) {
      floatingPinionRoles.push(object.userData.role);
    }
  });
  assert.equal(suspensionRodRoles.length, 2);
  assert.deepEqual(floatingPinionRoles, []);

  assert.deepEqual(
    geometry.normalizedCarrierTopPivot.toArray(),
    [14.895856, 3.5],
  );
  assert.deepEqual(
    geometry.normalizedCarrierBottomPivot.toArray(),
    [-2.329485, -3.5],
  );
  assert.equal(geometry.normalizedLinkLength, 19);
  assert.equal(geometry.normalizedLinkageHalfSpan, 3.5);
  assert.equal(geometry.normalizedFrameLeft, -1.139005);
  assert.equal(geometry.normalizedFrameRight, 21.860995);
  assert.equal(geometry.normalizedFrameHalfHeight, 6);
  assert.equal(geometry.normalizedGuideRollerX, 4.25);
  assert.equal(geometry.normalizedGuideRollerY, 7.5);
  assert.equal(geometry.normalizedGuideRollerRadius, 1.5);
  near(
    geometry.officialScale,
    geometry.pinionPitchRadius,
    1e-15,
    'official animation unit is one pinion pitch radius',
  );

  assert.equal(sourceRaster.width, 525);
  assert.equal(sourceRaster.height, 525);
  assert.deepEqual(sourceAnchors.pinionCenter.toArray(), [176, 249]);
  assert.deepEqual(sourceAnchors.frameTopLeftPivot.toArray(), [54, 172]);
  assert.deepEqual(sourceAnchors.frameBottomRightPivot.toArray(), [438, 352]);
  near(
    sourceRaster.scale,
    (geometry.frameRight - geometry.frameLeft) / (504 - 20),
    1e-15,
    'source scale is fixed by Brown\'s main-frame width',
  );
  sourceAnchors.modeledRackPitchCenters.forEach((point, index) => {
    vector2Near(
      point,
      sourceAnchors.rackPitchCenters[index],
      0.23,
      `source-fitted rack pitch center ${index}`,
    );
  });
  sourceAnchors.modeledFrameCorners.forEach((point, index) => {
    near(
      point.x,
      sourceAnchors.frameCorners[index].x,
      0.01,
      `source-fitted frame corner ${index} x`,
    );
    near(
      point.y,
      sourceAnchors.frameCorners[index].y,
      index < 2 ? 35 : 2,
      `source-fitted frame corner ${index} y`,
    );
  });
  assert.equal(canonicalStates.sourcePose.pathSegment, 'upper-straight-rack-run');
  near(canonicalStates.sourcePose.carrierAngle, 0, 1e-14, 'source carrier angle');
  vector2Near(
    canonicalStates.sourcePose.fixedPinionCenter,
    new THREE.Vector2(),
    1e-15,
    'source pinion remains on its fixed axis',
  );
  disposeModel(model.root);
});

test('movement 198 has an exact 30-pitch center loop, 36-tooth rack, and five-turn pinion cycle', () => {
  const model = createMovementModel(catalog.movements[197]);
  const {
    blocks,
    evaluatePinionCenterPath,
    evaluateRackToothPitch,
    geometry,
    transmission,
  } = model.root.userData;

  near(
    geometry.pinionPitchRadius,
    geometry.pinionTeeth * geometry.circularPitch / FULL_TURN,
    1e-15,
    'six-tooth pinion pitch radius',
  );
  near(
    geometry.straightRackLength,
    geometry.rackStraightPitchCount * geometry.circularPitch,
    1e-15,
    'each straight rack run has twelve pitches',
  );
  near(
    geometry.centerPathPerimeter,
    geometry.circularPitch * 30,
    2e-15,
    'pinion-center loop has thirty pitches',
  );
  near(
    geometry.rackToothPitchPerimeter,
    geometry.circularPitch * geometry.rackToothCount,
    2e-15,
    'outer rack pitch curve has thirty-six pitches',
  );
  near(
    geometry.inputTravelPerCycle,
    5 * FULL_TURN,
    2e-14,
    'one rack cycle requires five pinion turns',
  );
  assert.equal(geometry.pinionTeeth, 6);
  assert.equal(geometry.rackToothCount, 36);
  assert.equal(geometry.rackStraightPitchCount, 12);
  assert.equal(transmission.pinionRevolutionsPerRackCycle, -5);
  assert.equal(transmission.rackTeethPassingPerCycle, 36);
  assert.equal(transmission.frameReversalsPerCycle, 2);

  const pathSegments = new Set();
  for (let index = 0; index < 16384; index += 1) {
    const distance = geometry.centerPathPerimeter * index / 16384;
    const state = evaluatePinionCenterPath(distance);
    pathSegments.add(state.pathSegment);
    near(state.tangent.length(), 1, 2e-15, `path tangent ${index}`);
    near(state.outwardNormal.length(), 1, 2e-15, `path normal ${index}`);
    near(
      state.tangent.dot(state.outwardNormal),
      0,
      2e-15,
      `path tangent-normal orthogonality ${index}`,
    );
    const contactRadius = state.contactPointLocal.clone()
      .sub(state.pinionCenterLocal);
    vector2Near(
      contactRadius,
      state.outwardNormal.clone().multiplyScalar(
        geometry.pinionPitchRadius,
      ),
      2e-15,
      `pitch contact offset ${index}`,
    );
    assert.ok(state.activeRackToothIndex >= 0);
    assert.ok(state.activeRackToothIndex < 36);
  }
  assert.deepEqual(pathSegments, new Set([
    'left-end-pinion-lift',
    'lower-straight-rack-run',
    'right-end-pinion-lift',
    'upper-straight-rack-run',
  ]));

  const transferDistances = [
    0,
    geometry.straightRackLength,
    geometry.straightRackLength + Math.PI * geometry.pinionPitchRadius,
    2 * geometry.straightRackLength + Math.PI * geometry.pinionPitchRadius,
  ];
  const epsilon = geometry.pinionPitchRadius * 1e-8;
  transferDistances.forEach((distance, index) => {
    const before = evaluatePinionCenterPath(distance - epsilon);
    const after = evaluatePinionCenterPath(distance + epsilon);
    assert.ok(
      before.pinionCenterLocal.distanceTo(after.pinionCenterLocal)
        < epsilon * 2.1,
      `center path is position-continuous at transfer ${index}`,
    );
    assert.ok(
      before.tangent.distanceTo(after.tangent) < 3e-8,
      `center path is tangent-continuous at transfer ${index}`,
    );
    assert.ok(
      before.contactPointLocal.distanceTo(after.contactPointLocal)
        < epsilon * 4.1,
      `rack pitch contact is continuous at transfer ${index}`,
    );
  });

  blocks.rackTeeth.forEach((tooth, index) => {
    const pitchDistance = index * geometry.circularPitch;
    const expected = evaluateRackToothPitch(pitchDistance);
    near(tooth.userData.pitchDistance, pitchDistance, 1e-15, `tooth ${index} pitch`);
    vector2Near(tooth.position, expected.point, 2e-15, `tooth ${index} center`);
    near(expected.tangent.length(), 1, 2e-15, `tooth ${index} tangent`);
    near(expected.normal.length(), 1, 2e-15, `tooth ${index} normal`);
    near(
      expected.tangent.dot(expected.normal),
      0,
      2e-15,
      `tooth ${index} tangent-normal orthogonality`,
    );
  });
  const closure = evaluatePinionCenterPath(geometry.centerPathPerimeter);
  const start = evaluatePinionCenterPath(0);
  vector2Near(
    closure.pinionCenterLocal,
    start.pinionCenterLocal,
    1e-15,
    'center path closes',
  );
  vector2Near(closure.tangent, start.tangent, 1e-15, 'center tangent closes');
  disposeModel(model.root);
});

test('movement 198 preserves both rigid rods and exact rolling through 32,769 states while the frame reverses twice', () => {
  const model = createMovementModel(catalog.movements[197]);
  const {
    canonicalStates,
    geometry,
    rollingCoordinateAtLocalPath,
    stateAtInputTravel,
    transmission,
  } = model.root.userData;
  const sampleCount = 32768;
  const sourceState = stateAtInputTravel(0);
  let frameMinimum = Infinity;
  let frameMaximum = -Infinity;
  let carrierMinimumY = Infinity;
  let carrierMaximumY = -Infinity;
  let maximumCarrierRock = 0;
  let previousDirection = 0;
  let reversalCount = 0;
  let rockedStateCount = 0;
  const pathSegments = new Set();

  for (let index = 0; index <= sampleCount; index += 1) {
    const inputTravel = geometry.inputTravelPerCycle * index / sampleCount;
    const state = stateAtInputTravel(inputTravel);
    finiteStateNumbers(state, `state ${index}`);
    pathSegments.add(state.pathSegment);
    near(
      state.pinionAngle,
      sourceState.pinionAngle - inputTravel,
      2e-14,
      `uniform pinion angle ${index}`,
    );
    near(
      state.pinionAngularSpeed,
      transmission.pinionAngularSpeed,
      1e-15,
      `uniform pinion speed ${index}`,
    );
    vector2Near(
      state.fixedPinionCenter,
      new THREE.Vector2(),
      1e-15,
      `fixed pinion center ${index}`,
    );
    near(state.frameTranslation.y, 0, 1e-15, `horizontal frame ${index}`);
    near(state.frameVerticalError, 0, 1e-15, `frame vertical error ${index}`);
    assert.ok(Math.abs(state.topRodLengthError) < 3e-14);
    assert.ok(Math.abs(state.bottomRodLengthError) < 3e-14);
    assert.ok(Math.abs(state.linkageResidual) < 3e-14);
    assert.ok(state.contactRadiusError < 2e-14);
    assert.ok(state.rollingVelocityError < 2e-14);
    assert.ok(state.meshPhaseError < 3e-12);
    assert.ok(Math.abs(state.carrierAngle) < geometry.carrierAngleBracket);
    if (Math.abs(state.carrierAngle) > 1e-5) rockedStateCount += 1;
    maximumCarrierRock = Math.max(
      maximumCarrierRock,
      Math.abs(state.carrierAngle),
    );

    near(
      rollingCoordinateAtLocalPath(state.localPathDistance),
      state.localRollingCoordinate,
      4e-12,
      `rolling-coordinate inverse ${index}`,
    );
    const topRodVector = state.carrierTopPivotWorld.clone()
      .sub(state.frameTopPivotWorld);
    const bottomRodVector = state.carrierBottomPivotWorld.clone()
      .sub(state.frameBottomPivotWorld);
    assert.ok(
      Math.abs(topRodVector.dot(state.topRodRelativeVelocity)) < 3e-11,
      `upper rod has no axial stretch velocity at ${index}`,
    );
    assert.ok(
      Math.abs(bottomRodVector.dot(state.bottomRodRelativeVelocity)) < 3e-11,
      `lower rod has no axial stretch velocity at ${index}`,
    );
    vector2Near(
      state.frameVelocityFromTopRoller,
      state.frameVelocity,
      1e-15,
      `upper roller surface speed ${index}`,
    );
    vector2Near(
      state.frameVelocityFromBottomRoller,
      state.frameVelocity,
      1e-15,
      `lower roller surface speed ${index}`,
    );

    frameMinimum = Math.min(frameMinimum, state.frameTranslation.x);
    frameMaximum = Math.max(frameMaximum, state.frameTranslation.x);
    carrierMinimumY = Math.min(carrierMinimumY, state.carrierOrigin.y);
    carrierMaximumY = Math.max(carrierMaximumY, state.carrierOrigin.y);
    const direction = Math.abs(state.frameVelocity.x) > 1e-7
      ? Math.sign(state.frameVelocity.x)
      : 0;
    if (direction !== 0 && previousDirection !== 0
      && direction !== previousDirection) {
      reversalCount += 1;
    }
    if (direction !== 0) previousDirection = direction;
  }

  assert.deepEqual(pathSegments, new Set([
    'left-end-pinion-lift',
    'lower-straight-rack-run',
    'right-end-pinion-lift',
    'upper-straight-rack-run',
  ]));
  assert.equal(reversalCount, 2);
  assert.ok(rockedStateCount > sampleCount / 8);
  near(
    frameMaximum - frameMinimum,
    transmission.frameStroke,
    2e-7,
    'sampled main-frame stroke',
  );
  assert.ok(carrierMaximumY - carrierMinimumY > transmission.rackLift * 0.99);
  near(
    maximumCarrierRock,
    transmission.carrierMaximumRockAngle,
    2e-8,
    'sampled maximum carrier rock',
  );
  assert.ok(transmission.carrierMaximumRockAngle > 0.0075);
  assert.ok(transmission.carrierMaximumRockAngle < 0.0076);

  const closure = stateAtInputTravel(geometry.inputTravelPerCycle);
  vector2Near(
    closure.carrierOrigin,
    sourceState.carrierOrigin,
    3e-14,
    'carrier origin closes',
  );
  near(
    closure.carrierAngle,
    sourceState.carrierAngle,
    3e-14,
    'carrier angle closes',
  );
  vector2Near(
    closure.frameTranslation,
    sourceState.frameTranslation,
    3e-14,
    'main frame closes',
  );
  near(
    closure.pinionAngle - sourceState.pinionAngle,
    -5 * FULL_TURN,
    3e-14,
    'pinion advances exactly five clockwise turns',
  );
  near(
    closure.absoluteRackToothPitchDistance
      - sourceState.absoluteRackToothPitchDistance,
    geometry.rackToothPitchPerimeter,
    3e-14,
    'contact advances through all thirty-six rack teeth',
  );
  assert.equal(closure.activeRackToothIndex, sourceState.activeRackToothIndex);
  vector2Near(
    canonicalStates.rightFrameReversal.frameVelocity,
    new THREE.Vector2(),
    3e-12,
    'right reversal has zero frame speed',
  );
  vector2Near(
    canonicalStates.leftFrameReversal.frameVelocity,
    new THREE.Vector2(),
    3e-12,
    'left reversal has zero frame speed',
  );
  disposeModel(model.root);
});

test('movement 198 rendered transforms keep both rods pinned, the pinion fixed, and all four rollers synchronized', () => {
  const model = createMovementModel(catalog.movements[197]);
  const {
    blocks,
    canonicalStates,
    canonicalTimes,
    evaluateRackToothPitch,
    geometry,
  } = model.root.userData;
  const sourceFrameX = canonicalStates.sourcePose.frameTranslation.x;

  for (const [name, time] of Object.entries(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = canonicalStates[name];
    vector3Near(
      blocks.rackCarrier.position,
      new THREE.Vector3(state.carrierOrigin.x, state.carrierOrigin.y, 0),
      2e-14,
      `${name} rendered carrier origin`,
    );
    near(
      blocks.rackCarrier.rotation.z,
      state.carrierAngle,
      2e-14,
      `${name} rendered carrier angle`,
    );
    vector3Near(
      blocks.outerFrame.position,
      new THREE.Vector3(state.frameTranslation.x, 0, 0),
      2e-14,
      `${name} rendered main frame`,
    );
    near(blocks.pinion.position.x, 0, 1e-15, `${name} pinion x`);
    near(blocks.pinion.position.y, 0, 1e-15, `${name} pinion y`);
    near(blocks.pinionShaft.position.x, 0, 1e-15, `${name} shaft x`);
    near(blocks.pinionShaft.position.y, 0, 1e-15, `${name} shaft y`);
    near(
      blocks.pinion.userData.rotor.rotation.z,
      state.pinionAngle,
      2e-14,
      `${name} rendered pinion angle`,
    );
    vector3Near(
      blocks.contactMarker.getWorldPosition(new THREE.Vector3()),
      new THREE.Vector3(state.contactPoint.x, state.contactPoint.y, 0.49),
      2e-14,
      `${name} rendered pitch contact`,
    );

    const topStart = blocks.topSuspensionRod.children[1]
      .getWorldPosition(new THREE.Vector3());
    const topEnd = blocks.topSuspensionRod.children[2]
      .getWorldPosition(new THREE.Vector3());
    const bottomStart = blocks.bottomSuspensionRod.children[1]
      .getWorldPosition(new THREE.Vector3());
    const bottomEnd = blocks.bottomSuspensionRod.children[2]
      .getWorldPosition(new THREE.Vector3());
    vector3Near(
      topStart,
      new THREE.Vector3(
        state.frameTopPivotWorld.x,
        state.frameTopPivotWorld.y,
        0.48,
      ),
      2e-14,
      `${name} upper rod frame pin`,
    );
    vector3Near(
      topEnd,
      new THREE.Vector3(
        state.carrierTopPivotWorld.x,
        state.carrierTopPivotWorld.y,
        0.48,
      ),
      2e-14,
      `${name} upper rod carrier pin`,
    );
    vector3Near(
      bottomStart,
      new THREE.Vector3(
        state.carrierBottomPivotWorld.x,
        state.carrierBottomPivotWorld.y,
        0.48,
      ),
      2e-14,
      `${name} lower rod carrier pin`,
    );
    vector3Near(
      bottomEnd,
      new THREE.Vector3(
        state.frameBottomPivotWorld.x,
        state.frameBottomPivotWorld.y,
        0.48,
      ),
      2e-14,
      `${name} lower rod frame pin`,
    );

    blocks.guideRollers.forEach((roller, index) => {
      const expectedAngle = roller.userData.verticalSign > 0
        ? (state.frameTranslation.x - sourceFrameX)
          / geometry.guideRollerRadius
        : -(state.frameTranslation.x - sourceFrameX)
          / geometry.guideRollerRadius;
      near(
        roller.userData.rotor.rotation.z,
        expectedAngle,
        2e-14,
        `${name} guide roller ${index} angle`,
      );
      near(
        roller.position.x,
        roller.userData.horizontalSign * geometry.guideRollerX,
        1e-15,
        `${name} fixed roller ${index} x`,
      );
      near(
        roller.position.y,
        roller.userData.verticalSign > 0
          ? geometry.upperGuideRollerY
          : -geometry.lowerGuideRollerY,
        1e-15,
        `${name} fixed roller ${index} y`,
      );
    });
    near(
      model.root.userData.contacts.mainFrameGuideRollers.topSurfaceSpeed,
      state.frameVelocity.x,
      2e-14,
      `${name} upper roller no-slip speed`,
    );
    near(
      model.root.userData.contacts.mainFrameGuideRollers.bottomSurfaceSpeed,
      state.frameVelocity.x,
      2e-14,
      `${name} lower roller no-slip speed`,
    );

    const activeTooth = blocks.rackTeeth[state.activeRackToothIndex];
    const activePitch = evaluateRackToothPitch(
      activeTooth.userData.pitchDistance,
    );
    const activePitchWorld = new THREE.Vector3(
      activePitch.point.x,
      activePitch.point.y,
      0.02,
    ).applyMatrix4(blocks.rackCarrier.matrixWorld);
    assert.ok(
      new THREE.Vector2(activePitchWorld.x, activePitchWorld.y)
        .distanceTo(state.contactPoint) <= geometry.circularPitch * 0.51,
      `${name} active rack tooth is the nearest pitch`,
    );
  }

  model.update(canonicalTimes.sourcePose);
  model.root.updateMatrixWorld(true);
  const carrierPlateBounds = new THREE.Box3().setFromObject(
    blocks.carrierPlate,
  );
  const pinionBounds = new THREE.Box3().setFromObject(blocks.pinion);
  const rackToothBounds = new THREE.Box3();
  blocks.rackTeeth.forEach((tooth) => rackToothBounds.expandByObject(tooth));
  assert.ok(
    carrierPlateBounds.max.z < pinionBounds.min.z - 0.2,
    'rack carrier backing plate clears the pinion in depth',
  );
  assert.ok(
    rackToothBounds.max.z > pinionBounds.min.z,
    'rack teeth project into the pinion plane',
  );
  disposeModel(model.root);
});

test('movement 198 fills a real 3D envelope as the reviewed queue advances through 200', () => {
  const model = createMovementModel(catalog.movements[197]);
  const { blocks, canonicalTimes } = model.root.userData;
  const physicalBounds = new THREE.Box3();
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const object of [
      blocks.outerFrame,
      blocks.rackCarrier,
      blocks.pinion,
      blocks.pinionShaft,
      blocks.topSuspensionRod,
      blocks.bottomSuspensionRod,
      ...blocks.guideRollers,
      ...blocks.guideRollerShafts,
    ]) physicalBounds.expandByObject(object);
  }
  const size = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 15.15);
  // Brown's main-frame top edge sits just above the carrier's highest lift,
  // so the upper rollers stand lower than the lower pair hang.
  assert.ok(size.y > 7.1, 'the physical frame fills the vertical envelope without oversized pulley index blocks');
  assert.ok(size.z > 1.5);
  assert.ok(physicalBounds.min.z < -0.88);
  assert.ok(physicalBounds.max.z > 0.62);
  let visibleMeshCount = 0;
  let rackToothCount = 0;
  let suspensionRodCount = 0;
  let fixedGuideRollerCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh && object.visible) visibleMeshCount += 1;
    if (object.userData.role
      === 'tooth-of-closed-thirty-six-tooth-mangle-rack') {
      rackToothCount += 1;
    }
    if (/constant-length-.*rack-lifting-rod/.test(
      object.userData.role ?? '',
    )) {
      suspensionRodCount += 1;
    }
    if (/fixed-guide-roller-for-main-frame/.test(
      object.userData.role ?? '',
    )) {
      fixedGuideRollerCount += 1;
    }
  });
  // Undrawn white pulley indices and markers are hidden, and the guide
  // rollers are plain discs without spokes.
  // The traced carrier plate replaces the capsule rail and two stub arms.
  // The dark slot and face rims Brown only inks are retired.
  assert.ok(visibleMeshCount >= 83);
  assert.equal(rackToothCount, 36);
  assert.equal(suspensionRodCount, 2);
  assert.equal(fixedGuideRollerCount, 4);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 1.7);
  assert.ok(blocks.pinion.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.pinionShaft.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.equal(blocks.sweptEnvelope.visible, false);

  const movement197 = createMovementModel(catalog.movements[196]);
  const movement199 = createMovementModel(catalog.movements[198]);
  const movement200 = createMovementModel(catalog.movements[199]);
  assert.equal(movement197.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(movement199.root.userData.fidelity, 'authored');
  assert.equal(movement200.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement197.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement199.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement197.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.notEqual(
    movement199.root.userData.archetype,
    model.root.userData.archetype,
  );
  disposeModel(movement197.root);
  disposeModel(movement199.root);
  disposeModel(movement200.root);
  disposeModel(model.root);
});

test('movement 198 pinion has six stub involute teeth on a full hub (p93)', () => {
  const model = createMovementModel(catalog.movements[197]);
  const {pitchRadius, teeth, outerRadius, rootRadius} = model.root.userData.blocks.pinion.userData;
  const m = 2 * pitchRadius / teeth;
  assert.equal(teeth, 6);
  assert.ok(Math.abs(outerRadius - pitchRadius - 0.8 * m) < 1e-9);
  assert.ok(Math.abs(pitchRadius - rootRadius - 0.8 * m) < 1e-9);
  const gear = model.root.userData.blocks.pinion.userData.rotor.children[0];
  const radii = gear.userData.sourceOutline.map(([x, y]) => Math.hypot(x, y));
  assert.ok(Math.abs(Math.max(...radii) - outerRadius) < 1e-9 && Math.abs(Math.min(...radii) - rootRadius) < 1e-9);
});
