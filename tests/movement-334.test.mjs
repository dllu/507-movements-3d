import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vector2Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function vector3Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

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

test('movement 334 is the single-acting beam rack-sector parallel motion', () => {
  const movement = catalog.movements[333];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    contacts,
    degreesOfFreedom,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 334);
  assert.equal(movement.number, '334');
  assert.equal(movement.title,
    'parallel motion used in some of the old single-acting beam engines');
  assert.equal(movement.category, 'Rack & pinion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'single-acting-beam-engine-rack-sector-and-chain-parallel-motion');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /straight-rack-B-sector-C/);
  assert.match(mechanism, /backing-roller-A/);
  assert.match(mechanism, /chain-suspension-D/);
  assert.match(transmission.exactConstraints, /y_B=-30 theta/);
  assert.match(transmission.rackSector, /180-tooth-equivalent/);
  assert.match(transmission.chainSuspension, /-16\.5 theta/);
  assert.equal(degreesOfFreedom.mechanism, 1);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.pivotPedestal.parent, blocks.fixedFrame);
  assert.equal(blocks.rollerStand.parent, blocks.fixedFrame);
  assert.equal(blocks.beam.parent, model.root);
  assert.equal(blocks.rack.parent, model.root);
  assert.equal(blocks.rollerA.parent, model.root);
  assert.equal(blocks.chainRod.parent, model.root);
  assert.equal(blocks.chainShoe.parent, blocks.beam);
  assert.equal(blocks.sectorTeeth.length, 17);
  assert.equal(blocks.rackTeeth.length, 17);
  assert.equal(blocks.chainLinks.length, 10);
  blocks.sectorTeeth.forEach((tooth) => assert.equal(tooth.parent, blocks.beam));
  blocks.rackTeeth.forEach((tooth) => assert.equal(tooth.parent, blocks.rack));
  blocks.chainLinks.forEach(({ link }) => assert.equal(link.parent, model.root));
  assert.deepEqual(contacts.sectorRackPitchLine.members,
    [blocks.beam, blocks.rack]);
  assert.deepEqual(contacts.rackBackAtRollerA.members,
    [blocks.rack, blocks.rollerA]);
  assert.equal(contacts.beamPivotF.fixedMember, blocks.pivotPedestal);
  assert.equal(contacts.beamPivotF.movingMember, blocks.beam);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'working-tooth-of-thirty-unit-sector-C').length, 17);
  assert.equal(roles.filter((role) => role ===
    'working-tooth-of-straight-piston-rack-B').length, 17);
  assert.equal(roles.filter((role) => role ===
    'articulated-link-of-D-suspension-chain').length, 10);
  assert.equal(roles.some((role) => /index/i.test(role)), false,
    'Brown draws a plain roller A and rack B without index marks');
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 334 preserves every official transform and source landmark', () => {
  const movement = catalog.movements[333];
  const model = createMovementModel(movement);
  const {
    geometry,
    modelPointToOfficialAnimationRaster,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const official = sourceAnimation.officialGeometry;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.durationSeconds, 4);
  assert.deepEqual(sourceAnimation.officialFunctionChain, [
    'add_stat',
    'add_stat',
    'add_pos_interp',
    'add_pos_interp',
    'add_pos_interp',
    'add_belt',
  ]);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_334.html');
  assert.match(sourceAnimation.referenceScope, /roller A/);
  assert.match(sourceAnimation.referenceScope, /articulated chain D/);
  assert.match(sourceAnimation.reconstructionDifference,
    /rounded to six decimals/);

  assert.deepEqual(official, {
    beamDirectionEnd: new THREE.Vector2(2.897777, 0.776457),
    beamDirectionStart: new THREE.Vector2(2.897777, -0.776457),
    beamHalfSwing: Math.PI / 12,
    beamPivotF: new THREE.Vector2(0, 0),
    chainGuideRadius: 16.5,
    chainLinkPitch: 1.5,
    chainRodEndLine: [
      new THREE.Vector2(-16.5, -13.31969),
      new THREE.Vector2(-14.5, -13.31969),
    ],
    chainRodStartLine: [
      new THREE.Vector2(-16.5, -4.68031),
      new THREE.Vector2(-14.5, -4.68031),
    ],
    rackEndLine: [
      new THREE.Vector2(-30.383024, -7.853982),
      new THREE.Vector2(-29.383024, -7.853982),
    ],
    rackOriginX: -30.383024,
    rackStartLine: [
      new THREE.Vector2(-30.383024, 7.853982),
      new THREE.Vector2(-29.383024, 7.853982),
    ],
    rackToothCount: 17,
    rawChainAttachment: new THREE.Vector2(-15.420934, 5.901815),
    rollerCenterA: new THREE.Vector2(-33.216357, 1),
    rollerRadius: 2,
    sectorEquivalentTeeth: 180,
    sectorOuterRadius: 30.333333,
    sectorPitchRadius: 30,
    sectorRootRadius: 29.666667,
    sectorToothCount: 17,
  });
  near(geometry.sectorPitchRadius, 30 * geometry.sourceScale, 0,
    'scaled sector pitch radius');
  near(geometry.sectorRootRadius, 29.666667 * geometry.sourceScale, 0,
    'scaled sector root radius');
  near(geometry.sectorOuterRadius, 30.333333 * geometry.sourceScale, 0,
    'scaled sector outer radius');
  near(geometry.chainGuideRadius, 16.5 * geometry.sourceScale, 0,
    'scaled chain-shoe radius');
  near(geometry.rollerRadius, 2 * geometry.sourceScale, 0,
    'scaled roller-A radius');
  vector2Near(geometry.rollerCenterA,
    new THREE.Vector2(-33.216357, 1).multiplyScalar(geometry.sourceScale),
  0, 'scaled roller-A center');
  vector2Near(geometry.beamPivotF, new THREE.Vector2(0, 0), 0,
    'fixed pivot F');
  near(geometry.chainAttachmentRadialResidual / geometry.sourceScale,
    Math.hypot(-15.420934, 5.901815) - 16.5, 2e-15,
  'official rounded chain attachment radial residual');

  assert.equal(sourceReference.brownPlate334.imageWidth, 525);
  assert.equal(sourceReference.brownPlate334.imageHeight, 525);
  assert.deepEqual(sourceReference.brownPlate334.labels,
    ['A', 'B', 'C', 'D', 'F']);
  assert.match(sourceReference.brownPlate334.inferredTopology,
    /sector C meshes with straight piston rack B/);
  assert.deepEqual(sourceReference.officialAnimationView, {
    canvasHeight: 525,
    canvasWidth: 525,
    minimum: new THREE.Vector2(-36.685185, -21),
    viewHeight: 42,
    viewWidth: 42,
  });
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    edition: 21,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.officialDescription, movement.description);

  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(-36.685185, -21)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(0, 525), 0, 'official lower-left view corner');
  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(5.314815, 21)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(525, 0), 1.2e-13,
  'official upper-right view corner');
  disposeModel(model.root);
});

test('movement 334 follows the official smooth thirty-degree beam swing', () => {
  const model = createMovementModel(catalog.movements[333]);
  const {
    canonicalStates,
    geometry,
    sourceAnimation,
    stateAtTime,
  } = model.root.userData;

  let minimumBeamAngle = Infinity;
  let maximumBeamAngle = -Infinity;
  let minimumRackY = Infinity;
  let maximumRackY = -Infinity;
  let minimumChainRodY = Infinity;
  let maximumChainRodY = -Infinity;
  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 8192);
    near(state.beamAngle,
      -geometry.beamHalfSwing * Math.cos(state.inputAngle), 0,
    `harmonic beam angle at ${sample}`);
    near(state.beamAngularVelocity,
      geometry.beamHalfSwing * geometry.inputAngularSpeed
        * Math.sin(state.inputAngle), 1e-16,
    `harmonic beam speed at ${sample}`);
    minimumBeamAngle = Math.min(minimumBeamAngle, state.beamAngle);
    maximumBeamAngle = Math.max(maximumBeamAngle, state.beamAngle);
    minimumRackY = Math.min(minimumRackY, state.rackY);
    maximumRackY = Math.max(maximumRackY, state.rackY);
    minimumChainRodY = Math.min(minimumChainRodY, state.chainRodTopY);
    maximumChainRodY = Math.max(maximumChainRodY, state.chainRodTopY);
  }
  near(minimumBeamAngle, -Math.PI / 12, 0, 'lower beam angle');
  near(maximumBeamAngle, Math.PI / 12, 0, 'upper beam angle');
  near(maximumBeamAngle - minimumBeamAngle, Math.PI / 6, 0,
    'thirty-degree angular stroke');
  near(maximumRackY - minimumRackY, geometry.rackStroke, 9e-16,
    'rack-B stroke');
  near(maximumChainRodY - minimumChainRodY,
    geometry.suspensionRodStroke, 5e-16, 'chain-suspended rod stroke');
  assert.equal(canonicalStates.rackUpperStroke.rackY, maximumRackY);
  assert.equal(canonicalStates.rackLowerStroke.rackY, minimumRackY);

  const official = sourceAnimation.officialGeometry;
  near(Math.atan2(official.beamDirectionStart.y,
    official.beamDirectionStart.x), -Math.PI / 12, 3e-9,
  'rounded source start direction');
  near(Math.atan2(official.beamDirectionEnd.y,
    official.beamDirectionEnd.x), Math.PI / 12, 3e-9,
  'rounded source end direction');
  near(official.rackStartLine[0].y,
    30 * Math.PI / 12, 4e-7, 'rounded source upper rack ordinate');
  near(official.rackEndLine[0].y,
    -30 * Math.PI / 12, 4e-7, 'rounded source lower rack ordinate');
  near(official.chainRodStartLine[0].y,
    -9 + 16.5 * Math.PI / 12, 2e-7,
  'rounded source upper chain-rod ordinate');
  near(official.chainRodEndLine[0].y,
    -9 - 16.5 * Math.PI / 12, 2e-7,
  'rounded source lower chain-rod ordinate');
  disposeModel(model.root);
});

test('movement 334 keeps the sector, rack, and backing roller in exact no-slip contact', () => {
  const model = createMovementModel(catalog.movements[333]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const firstSectorCenter = Math.PI
    - (geometry.sectorToothCount - 1) / 2 * geometry.sectorAngularPitch;
  const lastSectorCenter = Math.PI
    + (geometry.sectorToothCount - 1) / 2 * geometry.sectorAngularPitch;
  const lastRackCenter = geometry.rackFirstToothCenterY
    + (geometry.rackToothCount - 1) * geometry.rackToothPitch;

  near(geometry.rackToothPitch,
    geometry.sectorPitchRadius * geometry.sectorAngularPitch, 0,
  'one common circular pitch');
  near(geometry.rackOriginX + geometry.rackBackOffsetX,
    geometry.rollerCenterA.x + geometry.rollerRadius, 9e-16,
  'roller A tangent to the rack back');
  blocks.sectorTeeth.forEach((tooth, index) => near(
    tooth.userData.centerAngle,
    firstSectorCenter + index * geometry.sectorAngularPitch,
    5e-16,
    `sector tooth ${index} phase`,
  ));
  blocks.rackTeeth.forEach((tooth, index) => near(
    tooth.position.y,
    geometry.rackFirstToothCenterY + index * geometry.rackToothPitch,
    0,
    `rack tooth ${index} phase`,
  ));

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 16384);
    near(state.rackY, -geometry.sectorPitchRadius * state.beamAngle, 0,
      `rack-sector displacement at ${sample}`);
    near(state.rackVelocityY, state.sectorPitchSurfaceVelocityY, 0,
      `rack-sector pitch speed at ${sample}`);
    near(state.rollerAngularVelocity * geometry.rollerRadius,
      state.rackVelocityY, 2.3e-16,
    `rack-roller no-slip speed at ${sample}`);
    near(state.rollerAngle,
      (state.rackY - geometry.initialRackY) / geometry.rollerRadius,
    0, `rack-roller accumulated travel at ${sample}`);
    vector2Near(state.pitchContactPoint,
      new THREE.Vector2(-geometry.sectorPitchRadius, 0), 0,
    `fixed pitch contact at ${sample}`);
    vector2Near(state.rollerContactPoint,
      new THREE.Vector2(
        geometry.rollerCenterA.x + geometry.rollerRadius,
        geometry.rollerCenterA.y,
      ), 0, `fixed roller contact at ${sample}`);
    assert.ok(state.localSectorContactAngle >= firstSectorCenter);
    assert.ok(state.localSectorContactAngle <= lastSectorCenter);
    assert.ok(state.localRackContactY
      >= geometry.rackFirstToothCenterY - 4e-7);
    assert.ok(state.localRackContactY <= lastRackCenter);
  }
  disposeModel(model.root);
});

test('movement 334 chain unwraps tangent-continuously at constant length', () => {
  const model = createMovementModel(catalog.movements[333]);
  const {
    chainPointAtDistance,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const epsilon = 1e-8;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 8192);
    near(state.chainStraightLength + state.chainArcLength,
      state.chainPathLength, 0, `chain parts sum at ${sample}`);
    near(state.chainPathLength, geometry.constantChainPathLength, 9e-16,
      `constant chain length at ${sample}`);
    near(state.chainRodTopY,
      geometry.chainRodBaselineY
        - geometry.chainGuideRadius * state.beamAngle,
    0, `chain-rod displacement at ${sample}`);
    near(state.chainRodVelocityY,
      state.suspensionShoeSurfaceVelocityAtTangent, 0,
    `chain-shoe tangent speed at ${sample}`);

    const start = chainPointAtDistance(state, 0);
    const end = chainPointAtDistance(state, state.chainPathLength);
    vector2Near(start.point,
      new THREE.Vector2(-geometry.chainGuideRadius, state.chainRodTopY),
    0, `chain begins at rod at ${sample}`);
    vector2Near(end.point, state.chainAttachmentPoint, 8e-16,
      `chain ends at beam D at ${sample}`);
    assert.equal(start.curve, 'vertical-free-part');
    assert.equal(end.curve, 'circular-shoe-part');

    const tangent = chainPointAtDistance(state, state.chainStraightLength);
    const justOnShoe = chainPointAtDistance(
      state,
      state.chainStraightLength + epsilon,
    );
    vector2Near(tangent.point,
      new THREE.Vector2(-geometry.chainGuideRadius, 0), 1e-15,
    `common tangent point at ${sample}`);
    near(tangent.pathAngle, Math.PI / 2, 0,
      `free-chain tangent direction at ${sample}`);
    near(justOnShoe.pathAngle,
      Math.PI / 2 - epsilon / geometry.chainGuideRadius, 3e-16,
    `shoe-side tangent direction at ${sample}`);
    assert.ok(justOnShoe.velocity.distanceTo(tangent.velocity) < 2e-8);
  }
  disposeModel(model.root);
});

test('movement 334 analytic beam, rack, roller, and chain rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[333]);
  const {
    chainPointAtDistance,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const step = 1e-5;
  const pathDistances = [0.12, 0.42, 0.75, 0.95]
    .map((fraction) => geometry.constantChainPathLength * fraction);

  for (const time of [0.13, 0.48, 0.92, 1.37, 1.88, 2.36, 2.83, 3.41, 3.78]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    near((after.beamAngle - before.beamAngle) / (2 * step),
      state.beamAngularVelocity, 5e-11,
    `beam angular velocity at ${time}`);
    near((after.beamAngularVelocity - before.beamAngularVelocity)
      / (2 * step), state.beamAngularAcceleration, 6e-11,
    `beam angular acceleration at ${time}`);
    for (const [positionKey, velocityKey, accelerationKey, toleranceScale] of [
      ['rackY', 'rackVelocityY', 'rackAccelerationY', 1],
      ['rollerAngle', 'rollerAngularVelocity', 'rollerAngularAcceleration', 4],
      ['chainRodTopY', 'chainRodVelocityY', 'chainRodAccelerationY', 1],
    ]) {
      near((after[positionKey] - before[positionKey]) / (2 * step),
        state[velocityKey], 1.2e-10 * toleranceScale,
      `${positionKey} velocity at ${time}`);
      near((after[velocityKey] - before[velocityKey]) / (2 * step),
        state[accelerationKey], 1.4e-10 * toleranceScale,
      `${positionKey} acceleration at ${time}`);
    }
    vector2Near(after.chainAttachmentPoint.clone().sub(
      before.chainAttachmentPoint).multiplyScalar(1 / (2 * step)),
    state.chainAttachmentVelocity, 1.2e-10,
    `chain attachment velocity at ${time}`);
    vector2Near(after.chainAttachmentVelocity.clone().sub(
      before.chainAttachmentVelocity).multiplyScalar(1 / (2 * step)),
    state.chainAttachmentAcceleration, 1.4e-10,
    `chain attachment acceleration at ${time}`);
    pathDistances.forEach((distance, index) => {
      const beforePoint = chainPointAtDistance(before, distance);
      const point = chainPointAtDistance(state, distance);
      const afterPoint = chainPointAtDistance(after, distance);
      vector2Near(afterPoint.point.clone().sub(beforePoint.point)
        .multiplyScalar(1 / (2 * step)), point.velocity, 1.3e-10,
      `chain material point ${index} velocity at ${time}`);
      vector2Near(afterPoint.velocity.clone().sub(beforePoint.velocity)
        .multiplyScalar(1 / (2 * step)), point.acceleration, 1.4e-10,
      `chain material point ${index} acceleration at ${time}`);
    });
  }
  disposeModel(model.root);
});

test('movement 334 renderer binds all teeth, rods, links, and live contacts', () => {
  const model = createMovementModel(catalog.movements[333]);
  const {
    animationTiming,
    blocks,
    chainPointAtDistance,
    contacts,
    geometry,
    stateAtTime,
  } = model.root.userData;

  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  model.root.updateMatrixWorld(true);
  const fixedFrameMatrix = blocks.fixedFrame.matrixWorld.clone();
  for (const time of [0, 0.34, 0.87, 1.41, 2.06, 2.58, 3.17, 3.71, 4]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.beam.rotation.z, state.beamAngle, 0,
      `rendered beam-D angle at ${time}`);
    vector3Near(blocks.rack.position,
      new THREE.Vector3(geometry.rackOriginX, state.rackY, 0), 0,
    `rendered rack-B position at ${time}`);
    near(blocks.rollerA.rotation.z, state.rollerAngle, 0,
      `rendered roller-A angle at ${time}`);
    vector3Near(blocks.chainRod.position,
      new THREE.Vector3(-geometry.chainGuideRadius,
        state.chainRodTopY, 0), 0,
    `rendered chain rod at ${time}`);
    vector3Near(blocks.beamChainAttachmentAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.chainAttachmentPoint.x,
        state.chainAttachmentPoint.y,
        0.58,
      ), 1e-15, `beam-chain attachment at ${time}`);
    vector3Near(blocks.rackOriginAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        geometry.rackOriginX,
        state.rackY,
        geometry.rackPlaneZ,
      ), 0, `rack transform origin at ${time}`);
    vector3Near(blocks.rackBackLineAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        geometry.rackOriginX + geometry.rackBackOffsetX,
        state.rackY,
        geometry.rackPlaneZ,
      ), 0, `rack back line at ${time}`);
    vector3Near(blocks.chainRodTopAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        -geometry.chainGuideRadius,
        state.chainRodTopY,
        0.58,
      ), 0, `chain-rod top at ${time}`);
    vector3Near(blocks.pivotFAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(0, 0, 0.10), 0,
    `fixed F anchor at ${time}`);
    vector3Near(blocks.pitchContactAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        -geometry.sectorPitchRadius, 0, 0.25,
      ), 0, `fixed pitch contact anchor at ${time}`);
    vector3Near(blocks.rollerContactAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        geometry.rollerCenterA.x + geometry.rollerRadius,
        geometry.rollerCenterA.y,
        0.25,
      ), 0, `fixed roller contact anchor at ${time}`);

    blocks.chainLinks.forEach((parts, index) => {
      const expectedStart = chainPointAtDistance(
        state,
        index * geometry.chainLinkPitch,
      ).point;
      const expectedEnd = chainPointAtDistance(
        state,
        (index + 1) * geometry.chainLinkPitch,
      ).point;
      vector3Near(parts.startAnchor.getWorldPosition(new THREE.Vector3()),
        new THREE.Vector3(expectedStart.x, expectedStart.y, 0.58), 0,
      `chain link ${index} start at ${time}`);
      vector3Near(parts.endAnchor.getWorldPosition(new THREE.Vector3()),
        new THREE.Vector3(expectedEnd.x, expectedEnd.y, 0.58), 8e-16,
      `chain link ${index} end at ${time}`);
      assert.ok(parts.link.userData.chordLength > 0);
      assert.ok(parts.link.userData.chordLength
        <= geometry.chainLinkPitch + 1e-15);
    });
    vector3Near(contacts.chainAtBeamD.point,
      new THREE.Vector3(
        state.chainAttachmentPoint.x,
        state.chainAttachmentPoint.y,
        0.58,
      ), 0, `live chain-D contact at ${time}`);
    vector3Near(contacts.sectorRackPitchLine.surfaceVelocityError,
      new THREE.Vector3(), 0, `rack-sector no-slip error at ${time}`);
    vector3Near(contacts.rackBackAtRollerA.surfaceVelocityError,
      new THREE.Vector3(), 3e-16, `rack-roller no-slip error at ${time}`);
    vector3Near(contacts.chainShoeTangent.surfaceVelocityError,
      new THREE.Vector3(), 0, `chain-shoe no-slip error at ${time}`);
    near(contacts.chainShoeTangent.pathLength,
      geometry.constantChainPathLength, 9e-16,
    `live chain length at ${time}`);
    assert.ok(blocks.fixedFrame.matrixWorld.equals(fixedFrameMatrix));
  }

  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 7.3);
  assert.ok(size.y > 5.0, 'rack B and the shortened drawn chain rod span the plate height');
  assert.ok(size.z > 1.20,
    'bed, rack, open sector, roller, plate chain and rods occupy real layers');
  // p96: roller A's fixed axle runs back into a bored pillow block that
  // stands on the bed and reaches above the axle, hidden inside the roller's
  // silhouette from the plate view.
  {
    const find = (role) => {
      let found = null;
      model.root.traverse((object) => { if (object.userData.role === role) found = object; });
      return found;
    };
    const block = new THREE.Box3().setFromObject(find('fixed-pillow-block-under-roller-A-axle'));
    const axle = new THREE.Box3().setFromObject(find('fixed-axis-of-backing-roller-A'));
    const bed = new THREE.Box3().setFromObject(find('fixed-timber-bed-behind-rack-and-chain'));
    const tread = new THREE.Box3().setFromObject(find('working-tread-of-backing-roller-A'));
    assert.ok(block.max.y > axle.max.y, 'the block rises past the axle');
    assert.ok(block.min.y <= bed.max.y, 'the block stands on the bed');
    assert.ok(axle.min.z < block.max.z && axle.min.z > block.min.z, 'the axle ends inside the block');
    assert.ok(block.min.x > tread.min.x && block.max.x < tread.max.x
      && block.max.y < tread.max.y, 'the block hides behind the roller');
  }
  const drawnRoles = [];
  model.root.traverse((object) => drawnRoles.push(object.userData.role ?? ''));
  assert.equal(drawnRoles.some((role) => /guide-rail|index-on-rocking-beam|pivot-bore-at-F/.test(role)), false,
    'Brown draws one bed timber and a plain bored beam boss at F');
  blocks.chainLinks.forEach(({ link }, index) =>
    assert.equal(link.userData.outerLink, index % 2 === 0, 'outer and inner links alternate'));
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const model333 = createMovementModel(catalog.movements[332]);
  assert.equal(model333.root.userData.fidelity, 'authored');
  assert.notEqual(model333.root.userData.archetype,
    model.root.userData.archetype);
  disposeModel(model333.root);
  disposeModel(model.root);
});

test('movement 334 closes exactly and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[333]);
  const {
    blocks,
    canonicalTimes,
    stateAtTime,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);

  near(closure.phase, start.phase, 0, 'source phase closure');
  near(closure.inputAngle, start.inputAngle, 0, 'source input closure');
  near(closure.beamAngle, start.beamAngle, 0, 'beam-D closure');
  near(closure.rackY, start.rackY, 0, 'rack-B closure');
  near(closure.rollerAngle, start.rollerAngle, 0, 'roller-A closure');
  near(closure.chainRodTopY, start.chainRodTopY, 0,
    'chain-suspended rod closure');
  vector2Near(closure.chainAttachmentPoint,
    start.chainAttachmentPoint, 0, 'chain attachment closure');
  near(closure.chainPathLength, start.chainPathLength, 0,
    'chain path closure');
  near(closure.unwrappedInputAngle, Math.PI * 2, 0,
    'one unwrapped source timing turn');
  model.update(canonicalTimes.cycleClosure);
  near(blocks.beam.rotation.z, start.beamAngle, 0,
    'rendered beam closure');
  near(blocks.rack.position.y, start.rackY, 0,
    'rendered rack closure');
  near(blocks.rollerA.rotation.z, start.rollerAngle, 0,
    'rendered roller closure');
  near(blocks.chainRod.position.y, start.chainRodTopY, 0,
    'rendered chain rod closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});

test('movement 334 chain pins stand proud of the outer plates instead of lying flush', () => {
  const model = createMovementModel(catalog.movements[333]);
  const { blocks, geometry } = model.root.userData;
  model.update(0.7);
  model.root.updateMatrixWorld(true);
  const shoe = new THREE.Box3().setFromObject(blocks.chainShoe);
  let pins = 0;
  for (const parts of blocks.chainLinks) {
    if (!parts.startPin) continue;
    for (const pin of [parts.startPin, parts.endPin]) {
      const box = new THREE.Box3().setFromObject(pin);
      assert.ok(box.min.z < geometry.chainOuterLow - 0.01, 'back head proud');
      assert.ok(box.max.z > geometry.chainOuterHigh + 0.01, 'front head proud');
      assert.ok(box.max.z < shoe.max.z, 'heads stay behind the shoe face');
      assert.ok(pin.geometry.userData.headRadius > geometry.chainPinRadius);
      pins += 1;
    }
  }
  assert.equal(pins, 10);
  disposeModel(model.root);
});

test('movement 334 braces and gudgeon bracket are seated solidly in the beam and sector', async () => {
  const { surfacePoints, solidSurface } = await import('./helpers/solid-surface.mjs');
  const model = createMovementModel(catalog.movements[333]);
  const { blocks } = model.root.userData;
  model.update(0);
  model.root.updateMatrixWorld(true);
  const inside = (part, host) => {
    const solid = solidSurface(host.geometry);
    const toHost = host.matrixWorld.clone().invert().multiply(part.matrixWorld);
    const points = surfacePoints(part.geometry);
    return points.filter((p) => solid.inside(p.clone().applyMatrix4(toHost))).length / points.length;
  };
  // Each brace is one flat plate: one end buried in the beam, the other in
  // the sector's rim band, both by a generous share of the brace surface.
  assert.equal(blocks.sectorSpokes.length, 3);
  for (const spoke of blocks.sectorSpokes) {
    assert.ok(inside(spoke, blocks.beamBody) > 0.06, `${spoke.userData.role} seated in beam`);
    assert.ok(inside(spoke, blocks.sectorWeb) > 0.01, `${spoke.userData.role} seated in rim`);
    const box = new THREE.Box3().setFromObject(spoke);
    assert.ok(box.max.z < new THREE.Box3().setFromObject(blocks.beamBody).max.z,
      'brace faces stay inside the beam faces');
  }
  // The gudgeon bracket's top runs up into the beam; the strap reaches down
  // into the bracket and its washer sits in the beam's top edge.
  assert.ok(inside(blocks.beamPivotBoss, blocks.beamBody) > 0.08, 'bracket seated in beam');
  let strap;
  blocks.beam.traverse((o) => { if (o.userData.role === 'gudgeon-strap-and-nut-over-F-on-beam-D') strap = o; });
  assert.ok(inside(strap, blocks.beamBody) > 0.05, 'strap seated in beam');
  assert.ok(inside(strap, blocks.beamPivotBoss) > 0.005, 'strap reaches the bracket');
  disposeModel(model.root);
});
