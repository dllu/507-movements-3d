import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
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

function vectorNear(actual, expected, tolerance, message) {
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

test('movement 269 is the four-group mutilated-rack frame and complete pinion', () => {
  const movement = catalog.movements[268];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
  } = model.root.userData;

  assert.equal(movement.id, 269);
  assert.equal(movement.number, '269');
  assert.equal(
    movement.title,
    'Mutilated Double-Rack Frame and Alternating Spur Gear',
  );
  assert.equal(movement.category, 'Rack & pinion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'reciprocating-mutilated-alternating-upper-lower-rack-frame-driving-fixed-spur-gear',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /upper-four-lower-four-upper-six-lower-two/);
  assert.match(mechanism, /three-relieved-tooth-handoffs/);
  assert.equal(blocks.rackFrame.parent, model.root);
  assert.equal(blocks.pinion.parent, model.root);
  assert.equal(blocks.pinionRotor.parent, blocks.pinion);
  assert.equal(blocks.topRail.parent, blocks.rackFrame);
  assert.equal(blocks.bottomRail.parent, blocks.rackFrame);
  assert.equal(blocks.rightBridge.parent, blocks.rackFrame);
  assert.equal(blocks.driveRod.parent, blocks.rackFrame);
  assert.equal(blocks.driveCollar.parent, blocks.rackFrame);
  assert.equal(blocks.frameTranslationIndex.parent, blocks.rackFrame);
  assert.ok(blocks.rackTeeth.every((tooth) => tooth.parent === blocks.rackFrame));
  assert.equal(blocks.pinionRim.parent, blocks.pinionRotor);
  assert.equal(blocks.pinionHub.parent, blocks.pinionRotor);
  assert.equal(blocks.pinionShaft.parent, blocks.pinionRotor);
  assert.equal(blocks.pinionIndex.parent, blocks.pinionRotor);
  assert.ok(blocks.pinionSpokes.every(
    (spoke) => spoke.parent === blocks.pinionRotor,
  ));
  assert.ok(blocks.pinionToothMeshes.every(
    (tooth) => tooth.parent === blocks.pinionRotor,
  ));
  assert.notEqual(blocks.rackFrame, blocks.pinion);
  assert.equal(blocks.pinion.userData.mutilated, false);
  disposeModel(model.root);
});

test('movement 269 preserves the engraving, source note, and engagement order', () => {
  const model = createMovementModel(catalog.movements[268]);
  const {
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate269;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.match(sourceAnimation.officialNote, /avoid jamming/);
  assert.match(sourceAnimation.referenceScope, /qualitative traversal/);
  assert.match(sourceAnimation.referenceScope, /independently derived/);
  assert.equal(sourceReference.officialDescription,
    catalog.movements[268].description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 6);
  assert.equal(plate.officialAnimationAvailable, true);
  assert.deepEqual(plate.rasterPinionCenter, { x: 249, y: 250 });
  assert.equal(plate.rasterPinionOuterRadius, 72);
  assert.equal(plate.rasterPinionToothCount, 18);
  assert.deepEqual(plate.rasterFrameOuterBounds, {
    bottom: 349,
    left: 31,
    right: 390,
    top: 143,
  });
  assert.deepEqual(plate.rasterRackPitchLines, {
    lowerY: 310,
    upperY: 190,
  });
  assert.deepEqual(plate.rasterRackToothCounts, [4, 4, 6, 2]);
  assert.deepEqual(plate.rasterRackGroupOrder, [
    'upper-four',
    'lower-four',
    'upper-six',
    'lower-two',
  ]);
  assert.equal(plate.sourceEngagement,
    'upper-central-six-tooth-group');
  assert.match(plate.inferredTopology, /open-left frame/);
  assert.match(plate.inferredTopology, /upper four, lower four/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 67,
    edition: 21,
    illustrationPage: 66,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 269 matches the measured source proportions and source pose', () => {
  const model = createMovementModel(catalog.movements[268]);
  const {
    geometry,
    rackSequence,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.plate269;
  const source = stateAtTime(0);
  const rasterOuterHalfHeight = (
    plate.rasterPinionCenter.y - plate.rasterFrameOuterBounds.top
      + plate.rasterFrameOuterBounds.bottom - plate.rasterPinionCenter.y
  ) / 2;
  const modelSourceLeft = geometry.frameLeft + source.frameX;
  const modelSourceRight = geometry.frameRight + source.frameX;
  const modelDriveRodEnd = geometry.frameRight
    + geometry.driveRodLength + source.frameX;

  assert.equal(geometry.pinionTeeth, plate.rasterPinionToothCount);
  assert.equal(geometry.installedRackToothCount,
    plate.rasterRackToothCounts.reduce((sum, count) => sum + count, 0));
  assert.deepEqual(
    rackSequence.map(({ toothCount }) => toothCount),
    plate.rasterRackToothCounts,
  );
  assert.deepEqual(
    rackSequence.map(({ rack }) => rack),
    ['upper', 'lower', 'upper', 'lower'],
  );
  near(
    geometry.frameOuterHalfHeight / geometry.pinionOuterRadius,
    rasterOuterHalfHeight / plate.rasterPinionOuterRadius,
    0.04,
    'frame outer half-height ratio',
  );
  near(
    geometry.pinionPitchRadius / geometry.pinionOuterRadius,
    (plate.rasterPinionCenter.y - plate.rasterRackPitchLines.upperY)
      / plate.rasterPinionOuterRadius,
    0.03,
    'upper rack pitch-line radius',
  );
  near(
    modelSourceLeft / geometry.pinionOuterRadius,
    (plate.rasterFrameOuterBounds.left - plate.rasterPinionCenter.x)
      / plate.rasterPinionOuterRadius,
    0.42,
    'source frame left reach',
  );
  // Brown's closed end is one tooth past the last rack, too close for a full gear to reach it.
  assert.ok(
    modelSourceRight / geometry.pinionOuterRadius
      > (plate.rasterFrameOuterBounds.right - plate.rasterPinionCenter.x)
        / plate.rasterPinionOuterRadius,
    'source frame right reach',
  );
  assert.ok(
    geometry.frameRight - geometry.frameRightBridgeWidth
      - geometry.contactCoordinateMaximum
      >= geometry.pinionOuterRadius + 0.05,
    'closed right end clears the gear tips at the stroke limit',
  );
  near(
    modelDriveRodEnd / geometry.pinionOuterRadius,
    (plate.rasterDriveRodEnd.x - plate.rasterPinionCenter.x)
      / plate.rasterPinionOuterRadius,
    0.32,
    'source drive-rod reach',
  );
  near(source.contactCoordinate, geometry.sourceContactCoordinate,
    2e-15, 'source contact coordinate');
  near(source.frameX, geometry.sourceFrameX,
    2e-15, 'source frame position');
  near(source.pinionAngleUnwrapped, geometry.sourcePinionAngle,
    2e-15, 'source pinion phase');
  assert.equal(source.activeRack, 'upper');
  assert.equal(source.activeRackGroupId, 'upper-central-six');
  assert.equal(source.handoffActive, false);
  disposeModel(model.root);
});

test('movement 269 lays out exactly four staggered rack groups on one pitch', () => {
  const model = createMovementModel(catalog.movements[268]);
  const {
    blocks,
    geometry,
    handoffDesign,
    rackSequence,
    stateAtContactCoordinate,
  } = model.root.userData;
  const expectedRelieved = [3, 4, 7, 8, 13, 14];

  near(geometry.circularPitch,
    geometry.pinionPitchRadius * geometry.pinionAngularPitch,
    1e-15, 'common circular pitch');
  near(
    geometry.contactCoordinateMaximum - geometry.contactCoordinateMinimum,
    16 * geometry.circularPitch,
    2e-15,
    'sixteen-pitch frame stroke',
  );
  near(geometry.pinionOuterRadius,
    geometry.pinionPitchRadius + geometry.pinionToothHeight / 2,
    1e-15, 'pinion outer radius');
  near(geometry.pinionRootRadius,
    geometry.pinionPitchRadius - geometry.pinionToothHeight / 2,
    1e-15, 'pinion root radius');
  near(geometry.rackToothRootY,
    geometry.pinionOuterRadius + geometry.rackRadialClearance,
    1e-15, 'rack root line');
  near(geometry.rackToothTipY,
    geometry.pinionRootRadius + geometry.rackRadialClearance,
    1e-15, 'rack tip line');
  assert.ok(geometry.rackRadialClearance > 0, 'radial tip clearance');
  assert.equal(blocks.rackTeeth.length, 16);
  assert.equal(blocks.upperRackTeeth.length, 10);
  assert.equal(blocks.lowerRackTeeth.length, 6);
  assert.equal(blocks.pinionToothMeshes.length, 18);
  assert.equal(blocks.pinionSpokes.length, 4);
  assert.deepEqual(handoffDesign.boundaryAdjacentToothIndices,
    expectedRelieved);
  assert.equal(handoffDesign.handoffCount, 3);
  assert.equal(handoffDesign.relievedTransitionTeethPerHandoff, 2);
  assert.equal(handoffDesign.fullDepthContactsDuringHandoff, 0);

  for (const [index, tooth] of blocks.rackTeeth.entries()) {
    near(
      tooth.position.x,
      geometry.contactCoordinateMinimum
        + (index + 0.5) * geometry.circularPitch,
      1e-15,
      `rack tooth ${index} pitch position`,
    );
    assert.equal(tooth.userData.index, index);
    assert.equal(tooth.userData.pitch, geometry.circularPitch);
    assert.equal(
      tooth.userData.relievedForHandoff,
      expectedRelieved.includes(index),
    );
    if (!tooth.userData.relievedForHandoff) {
      const state = stateAtContactCoordinate(tooth.position.x, 1, 0);
      assert.equal(state.handoffActive, false);
      assert.equal(state.activeRack, tooth.userData.rack);
      assert.equal(state.activeRackGroupId, tooth.userData.groupId);
      near(state.meshPhaseError, 0, 1e-15,
        `rack tooth ${index} exact mesh phase`);
      near(
        Math.abs(Math.atan2(
          Math.sin(state.pinionAngleUnwrapped * geometry.pinionTeeth),
          Math.cos(state.pinionAngleUnwrapped * geometry.pinionTeeth),
        )) / geometry.pinionTeeth,
        0,
        2e-15,
        `rack tooth ${index} meets a pinion space center`,
      );
    }
  }

  let expectedStart = geometry.contactCoordinateMinimum;
  let expectedTheta = -geometry.pinionAngularPitch / 2;
  for (const group of rackSequence) {
    near(group.start, expectedStart, 2e-15, `${group.id} start`);
    near(group.startTheta, expectedTheta, 2e-15,
      `${group.id} starting phase`);
    near(group.end - group.start,
      group.toothCount * geometry.circularPitch,
      2e-15, `${group.id} span`);
    expectedStart = group.end;
    expectedTheta = group.endTheta;
  }
  near(expectedStart, geometry.contactCoordinateMaximum,
    2e-15, 'rack sequence closes at the right limit');
  disposeModel(model.root);
});

test('movement 269 handoffs are C2 and never engage both full-depth racks', () => {
  const model = createMovementModel(catalog.movements[268]);
  const {
    geometry,
    handoffDesign,
    stateAtContactCoordinate,
    transmission,
  } = model.root.userData;
  const epsilon = geometry.circularPitch * 1e-8;
  let maximumSlopeMagnitude = 0;

  for (const handoff of transmission.handoffs) {
    const before = transmission.profileAtContactCoordinate(
      handoff.left - epsilon,
    );
    const left = transmission.profileAtContactCoordinate(handoff.left);
    const right = transmission.profileAtContactCoordinate(handoff.right);
    const after = transmission.profileAtContactCoordinate(
      handoff.right + epsilon,
    );
    near(left.value, before.value,
      epsilon / geometry.pinionPitchRadius + 2e-15,
      `handoff ${handoff.index} left position continuity`);
    near(left.firstDerivative,
      handoff.previousGroup.sign / geometry.pinionPitchRadius,
      2e-14, `handoff ${handoff.index} left slope`);
    near(left.secondDerivative, 0, 2e-13,
      `handoff ${handoff.index} left curvature`);
    near(right.value, after.value,
      epsilon / geometry.pinionPitchRadius + 2e-15,
      `handoff ${handoff.index} right position continuity`);
    near(right.firstDerivative,
      handoff.nextGroup.sign / geometry.pinionPitchRadius,
      2e-14, `handoff ${handoff.index} right slope`);
    near(right.secondDerivative, 0, 2e-13,
      `handoff ${handoff.index} right curvature`);
    const center = stateAtContactCoordinate(handoff.center, 1, 0);
    assert.equal(center.activeRack, null);
    assert.equal(center.activeFullDepthContactCount, 0);
    assert.equal(center.relievedTransitionContactCount, 2);
    assert.equal(center.simultaneousFullDepthEngagement, false);
    assert.equal(center.handoffActive, true);
    near(center.pinionAngularSpeed, 0, 2e-14,
      `handoff ${handoff.index} reverses through rest`);
  }

  for (let sample = 0; sample <= 16384; sample += 1) {
    const q = THREE.MathUtils.lerp(
      geometry.contactCoordinateMinimum,
      geometry.contactCoordinateMaximum,
      sample / 16384,
    );
    const state = stateAtContactCoordinate(q, 1, 0);
    assert.ok(state.activeFullDepthContactCount === 0
      || state.activeFullDepthContactCount === 1);
    assert.equal(state.simultaneousFullDepthEngagement, false);
    if (state.handoffActive) {
      assert.equal(state.activeRack, null);
      assert.equal(state.activeFullDepthContactCount, 0);
    } else {
      assert.ok(state.activeRack === 'upper'
        || state.activeRack === 'lower');
      near(state.meshPhaseError, 0, 2e-15, 'active mesh phase');
    }
    maximumSlopeMagnitude = Math.max(
      maximumSlopeMagnitude,
      Math.abs(state.profileFirstDerivative),
    );
  }
  assert.ok(maximumSlopeMagnitude
    <= 1 / geometry.pinionPitchRadius + 2e-14);
  assert.match(handoffDesign.interpolation, /quintic-Hermite/);
  assert.match(handoffDesign.purpose, /prevent/);
  disposeModel(model.root);
});

test('movement 269 obeys analytic no-slip rates and alternates output direction', () => {
  const model = createMovementModel(catalog.movements[268]);
  const {
    geometry,
    rackSequence,
    stateAtContactCoordinate,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;
  const halfStep = 1e-5;
  let maximumAngularSpeedDerivativeError = 0;
  let maximumAngularAccelerationDerivativeError = 0;
  let maximumTangentialError = 0;
  let activeSamples = 0;
  let handoffSamples = 0;

  assert.deepEqual(
    rackSequence.map(({ sign }) => sign),
    [1, -1, 1, -1],
  );
  assert.deepEqual(
    transmission.signedSlopeSequence.map((slope) => Math.sign(slope)),
    [1, -1, 1, -1],
  );
  for (const group of rackSequence) {
    const state = stateAtContactCoordinate(
      (group.start + group.end) / 2,
      1,
      0,
    );
    assert.equal(Math.sign(state.pinionAngularSpeed), group.sign);
    assert.equal(state.activeRack, group.rack);
  }

  for (let sample = 0; sample < 4096; sample += 1) {
    const time = timeline.demonstrationPeriod * (sample + 0.5) / 4096;
    const state = stateAtTime(time);
    const before = stateAtTime(time - halfStep);
    const after = stateAtTime(time + halfStep);
    const numericalAngularSpeed = (
      after.pinionAngleUnwrapped - before.pinionAngleUnwrapped
    ) / (2 * halfStep);
    const numericalAngularAcceleration = (
      after.pinionAngularSpeed - before.pinionAngularSpeed
    ) / (2 * halfStep);
    maximumAngularSpeedDerivativeError = Math.max(
      maximumAngularSpeedDerivativeError,
      Math.abs(numericalAngularSpeed - state.pinionAngularSpeed),
    );
    maximumAngularAccelerationDerivativeError = Math.max(
      maximumAngularAccelerationDerivativeError,
      Math.abs(
        numericalAngularAcceleration - state.pinionAngularAcceleration
      ),
    );
    near(state.frameX + state.contactCoordinate, 0, 2e-15,
      'frame/contact-coordinate identity');
    near(state.frameVelocityX + state.contactCoordinateVelocity, 0,
      2e-15, 'frame velocity identity');
    near(state.frameAccelerationX + state.contactCoordinateAcceleration, 0,
      2e-15, 'frame acceleration identity');
    if (state.activeRack) {
      activeSamples += 1;
      maximumTangentialError = Math.max(
        maximumTangentialError,
        Math.abs(state.tangentialVelocityError),
      );
      assert.equal(state.normalVelocityError, 0);
      near(state.meshPhaseError, 0, 2e-15, 'time-domain mesh phase');
    } else {
      handoffSamples += 1;
      assert.equal(state.handoffActive, true);
      assert.equal(state.tangentialVelocityError, null);
      assert.equal(state.activeFullDepthContactCount, 0);
    }
  }
  assert.ok(activeSamples > 3000);
  assert.ok(handoffSamples > 500);
  assert.ok(maximumTangentialError < 5e-16);
  assert.ok(maximumAngularSpeedDerivativeError < 2e-8);
  assert.ok(maximumAngularAccelerationDerivativeError < 2e-7);
  near(transmission.frameStroke,
    geometry.contactCoordinateMaximum - geometry.contactCoordinateMinimum,
    1e-15, 'frame stroke');
  assert.match(transmission.noSlipLaws.upperRack, /-frame-x-speed/);
  assert.match(transmission.noSlipLaws.lowerRack, /frame-x-speed/);
  disposeModel(model.root);
});

test('movement 269 renderer binds translation, contacts, handoffs, and output spin', () => {
  const model = createMovementModel(catalog.movements[268]);
  const {
    blocks,
    geometry,
    rackSequence,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const fixedPinionPosition = blocks.pinion.position.clone();
  const fixedBearingPosition = blocks.pinionBearing.position.clone();
  const sampleCoordinates = [
    (rackSequence[0].start + rackSequence[0].end) / 2,
    (rackSequence[1].start + rackSequence[1].end) / 2,
    (rackSequence[2].start + rackSequence[2].end) / 2,
    (rackSequence[3].start + rackSequence[3].end) / 2,
  ];

  for (const [index, q] of sampleCoordinates.entries()) {
    const time = transmission.timeForContactCoordinate(q, 'increasing');
    const state = stateAtTime(time);
    model.update(time, 0.016);
    model.root.updateMatrixWorld(true);
    near(blocks.rackFrame.position.x, state.frameX, 2e-15,
      `rack frame position at group ${index}`);
    assert.equal(blocks.rackFrame.position.y, 0);
    assert.equal(blocks.rackFrame.position.z, 0);
    assert.equal(blocks.rackFrame.rotation.x, 0);
    assert.equal(blocks.rackFrame.rotation.y, 0);
    assert.equal(blocks.rackFrame.rotation.z, 0);
    near(blocks.pinionRotor.rotation.z, state.pinionAngleUnwrapped,
      2e-15, `pinion angle at group ${index}`);
    vectorNear(blocks.pinion.position, fixedPinionPosition, 0,
      'pinion center remains fixed');
    vectorNear(blocks.pinionBearing.position, fixedBearingPosition, 0,
      'pinion bearing remains fixed');
    assert.equal(blocks.upperContactMarker.visible,
      state.activeRack === 'upper');
    assert.equal(blocks.lowerContactMarker.visible,
      state.activeRack === 'lower');
    assert.equal(blocks.handoffMarker.visible, false);
    const rackIndexWorld = blocks.frameTranslationIndex.getWorldPosition(
      new THREE.Vector3(),
    );
    const rackIndexInRoot = model.root.worldToLocal(rackIndexWorld.clone());
    near(
      rackIndexInRoot.x,
      blocks.frameTranslationIndex.position.x + state.frameX,
      2e-15,
      'white frame index translates rigidly',
    );
    const { contacts } = model.root.userData;
    assert.equal(contacts.activeRackToPinion.activeRack, state.activeRack);
    assert.equal(contacts.activeRackToPinion.fullDepthContactCount, 1);
    near(contacts.activeRackToPinion.meshPhaseError, 0, 2e-15,
      'rendered active mesh phase');
    near(contacts.activeRackToPinion.tangentialVelocityError, 0,
      5e-16, 'rendered active no-slip velocity');
    assert.equal(contacts.relievedHandoff.active, false);
    assert.equal(contacts.shaftBearing.axialDisplacement, 0);
  }

  for (const handoff of transmission.handoffs) {
    const time = transmission.timeForContactCoordinate(
      handoff.center,
      'increasing',
    );
    const state = stateAtTime(time);
    model.update(time, 0.016);
    assert.equal(state.handoffActive, true);
    assert.equal(blocks.upperContactMarker.visible, false);
    assert.equal(blocks.lowerContactMarker.visible, false);
    assert.equal(blocks.handoffMarker.visible, true);
    assert.equal(
      model.root.userData.contacts.relievedHandoff.active,
      true,
    );
    assert.equal(
      model.root.userData.contacts.relievedHandoff
        .simultaneousFullDepthEngagement,
      false,
    );
    assert.equal(
      model.root.userData.contacts.relievedHandoff.fullDepthContactCount,
      0,
    );
  }

  assert.equal(blocks.pinion.userData.teeth, geometry.pinionTeeth);
  assert.equal(blocks.pinion.userData.circularPitch, geometry.circularPitch);
  assert.equal(blocks.pinion.userData.pitchRadius,
    geometry.pinionPitchRadius);
  for (const q of [
    geometry.contactCoordinateMinimum,
    geometry.contactCoordinateMaximum,
  ]) {
    const time = transmission.timeForContactCoordinate(q, 'increasing');
    model.update(time, 0.016);
    model.root.updateMatrixWorld(true);
    const renderedBounds = new THREE.Box3().setFromObject(model.root, true);
    const fitBounds = model.root.userData.cameraFitBounds;
    assert.ok(renderedBounds.min.x >= fitBounds.min.x - 1e-12);
    assert.ok(renderedBounds.max.x <= fitBounds.max.x + 1e-12);
    assert.ok(renderedBounds.min.y >= fitBounds.min.y - 1e-12);
    assert.ok(renderedBounds.max.y <= fitBounds.max.y + 1e-12);
  }
  disposeModel(model.root);
});

test('movement 269 closes exactly and leaves movement 507 authored', () => {
  const movement = catalog.movements[268];
  const model = createMovementModel(movement);
  const {
    animationTiming,
    canonicalTimes,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const source = stateAtTime(0);
  const closure = stateAtTime(timeline.demonstrationPeriod);

  near(closure.contactCoordinate, source.contactCoordinate,
    2e-15, 'cycle contact coordinate');
  near(closure.contactCoordinateVelocity, source.contactCoordinateVelocity,
    2e-15, 'cycle contact velocity');
  near(
    closure.contactCoordinateAcceleration,
    source.contactCoordinateAcceleration,
    3e-15,
    'cycle contact acceleration',
  );
  near(closure.frameX, source.frameX, 2e-15, 'cycle frame position');
  near(closure.pinionAngleUnwrapped, source.pinionAngleUnwrapped,
    3e-15, 'cycle output angle');
  near(closure.pinionAngularSpeed, source.pinionAngularSpeed,
    3e-15, 'cycle output angular speed');
  near(
    closure.pinionAngularAcceleration,
    source.pinionAngularAcceleration,
    4e-15,
    'cycle output angular acceleration',
  );
  assert.equal(closure.activeRack, source.activeRack);
  assert.equal(closure.activeRackGroupId, source.activeRackGroupId);
  assert.equal(canonicalTimes.cycleClosure, 8);
  assert.equal(animationTiming.authoredCyclePeriod, 8);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);

  model.update(0, 0.016);
  const sourceFrameX = model.root.userData.blocks.rackFrame.position.x;
  const sourcePinionAngle = model.root.userData.blocks.pinionRotor.rotation.z;
  model.update(timeline.demonstrationPeriod, 0.016);
  near(model.root.userData.blocks.rackFrame.position.x,
    sourceFrameX, 2e-15, 'rendered frame closure');
  near(model.root.userData.blocks.pinionRotor.rotation.z,
    sourcePinionAngle, 3e-15, 'rendered pinion closure');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
