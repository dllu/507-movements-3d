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

test('movement 331 is the flywheel Scotch-yoke engine in pillar guides D-D', () => {
  const movement = catalog.movements[330];
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

  assert.equal(movement.id, 331);
  assert.equal(movement.number, '331');
  assert.match(movement.title, /^engine with crank motion/);
  assert.equal(movement.category, 'Cranks & reciprocation');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'flywheel-scotch-yoke-crosshead-between-pillar-guides-D');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /wrist-journal-in-real-slot-A/);
  assert.match(mechanism, /pillar-guides-D-D/);
  assert.match(transmission.sliderLaw, /sin\(theta\)/);
  assert.match(transmission.journalConstraint, /exactly fills/);
  assert.equal(degreesOfFreedom.mechanism, 1);
  assert.equal(degreesOfFreedom.crossheadTranslationAxes, 1);
  assert.equal(degreesOfFreedom.crossheadRotation, 0);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.guidePosts.length, 2);
  assert.equal(blocks.guidePosts[0].parent, blocks.fixedFrame);
  assert.equal(blocks.guidePosts[1].parent, blocks.fixedFrame);
  assert.equal(blocks.crankRotor.parent, model.root);
  assert.equal(blocks.flywheelRim.parent, blocks.crankRotor);
  assert.equal(blocks.flywheelSpokes.length, 6);
  assert.equal(blocks.crankArm.parent, blocks.crankRotor);
  assert.equal(blocks.wristJournal.parent, blocks.crankRotor);
  assert.equal(blocks.crankPinAnchor.parent, blocks.crankRotor);
  assert.equal(blocks.crossheadA.parent, model.root);
  assert.equal(blocks.yokeBody.parent, blocks.crossheadA);
  assert.equal(blocks.slotOutline, undefined, 'no decorative ink outline around slot A');
  assert.equal(blocks.leftGuideShoe.parent, blocks.crossheadA);
  assert.equal(blocks.rightGuideShoe.parent, blocks.crossheadA);
  assert.equal(blocks.pistonRod.parent, blocks.crossheadA);
  assert.equal(blocks.pistonHead.parent, blocks.crossheadA);
  assert.equal(contacts.crankJournalInSlotA.movingMember,
    blocks.crankRotor);
  assert.equal(contacts.crankJournalInSlotA.slotMember,
    blocks.crossheadA);
  assert.equal(contacts.leftShoeOnPillarD.fixedMember,
    blocks.guidePosts[0]);
  assert.equal(contacts.rightShoeOnPillarD.fixedMember,
    blocks.guidePosts[1]);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => /flywheel-rigid-spoke-/.test(role)).length,
    6);
  assert.equal(roles.filter((role) => /fixed-pillar-guide-D$/.test(role)).length,
    2);
  assert.equal(roles.filter((role) => /guide-shoe-embracing-pillar-D$/.test(role))
    .length, 2);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 331 preserves the official canvas dimensions and timing', () => {
  const movement = catalog.movements[330];
  const model = createMovementModel(movement);
  const {
    geometry,
    modelPointToOfficialAnimationRaster,
    officialAnimationRasterToModel,
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
  assert.deepEqual(sourceAnimation.officialFunctionChain,
    ['add_rot', 'add_hidden', 'add_cam_f']);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_331.html');
  assert.match(sourceAnimation.referenceScope, /3\.75-unit crank/);
  assert.match(sourceAnimation.referenceScope, /pillar guides D-D/);

  assert.deepEqual(official, {
    crankRadius: 3.75,
    crossheadGuideBottomY: -17,
    crossheadGuideInnerX: 6,
    crossheadGuideOuterX: 7.5,
    crossheadGuideTopY: 6.4,
    flywheelInnerRadius: 10.25,
    flywheelOuterRadius: 12.25,
    journalRadius: 1.25,
    pistonHeadBottomOffsetY: -15.75,
    pistonHeadHalfWidth: 3.5,
    pistonHeadTopOffsetY: -14.75,
    pistonRodBottomOffsetY: -14.75,
    pistonRodTopOffsetY: -2.75,
    slotHalfHeight: 1.25,
    slotLeftCenterX: -4,
    slotRightCenterX: 4,
  });
  near(geometry.crankRadius, 3.75 * geometry.sourceScale, 0,
    'uniformly scaled crank radius');
  near(geometry.crankJournalRadius, 1.25 * geometry.sourceScale, 0,
    'uniformly scaled journal radius');
  near(geometry.flywheelInnerRadius, 10.25 * geometry.sourceScale, 0,
    'uniformly scaled flywheel inner radius');
  near(geometry.flywheelOuterRadius, 12.25 * geometry.sourceScale, 0,
    'uniformly scaled flywheel outer radius');
  near(geometry.outputStroke, 7.5 * geometry.sourceScale, 0,
    'official 7.5-unit stroke');

  assert.deepEqual(sourceReference.relatedMovements, [93, 279]);
  assert.equal(sourceReference.brownPlate331.imageWidth, 525);
  assert.equal(sourceReference.brownPlate331.imageHeight, 525);
  assert.match(sourceReference.brownPlate331.inferredTopology,
    /crosshead slot A/);
  assert.deepEqual(sourceReference.officialAnimationView, {
    canvasHeight: 525,
    canvasWidth: 525,
    minimum: new THREE.Vector2(-14, -14),
    viewHeight: 28,
    viewWidth: 28,
  });
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    edition: 21,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.officialDescription, movement.description);

  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(0, 0)), new THREE.Vector2(262.5, 262.5), 0,
  'official canvas origin');
  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(geometry.crankRadius, 0)),
  new THREE.Vector2(332.8125, 262.5), 0,
  'official phase-zero crank pin');
  vector3Near(officialAnimationRasterToModel(
    new THREE.Vector2(332.8125, 262.5)),
  new THREE.Vector3(geometry.crankRadius, 0, geometry.slotPlaneZ), 0,
  'inverse official-canvas mapping');
  disposeModel(model.root);
});

test('movement 331 solves the exact Scotch-yoke displacement law', () => {
  const model = createMovementModel(catalog.movements[330]);
  const {
    canonicalStates,
    geometry,
    sourceAnimation,
    stateAtTime,
  } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const time = geometry.cyclePeriod * sample / 8192;
    const state = stateAtTime(time);
    near(state.crankPin.length(), geometry.crankRadius, 4e-16,
      `fixed crank radius at ${sample}`);
    near(state.sliderY, state.crankPin.y, 0,
      `crosshead follows crank ordinate at ${sample}`);
    near(state.slotVerticalResidual, 0, 0,
      `journal centerline remains in slot at ${sample}`);
    near(state.journalRelativeToSlot.y, 0, 0,
      `journal has no transverse slot offset at ${sample}`);
    near(state.journalRelativeToSlot.x, state.crankPin.x, 0,
      `journal slides horizontally within A at ${sample}`);
    assert.ok(Math.abs(state.journalRelativeToSlot.x)
      <= geometry.crankRadius + 1e-15);
    near(state.sliderRotation, 0, 0,
      `crosshead has zero yaw at ${sample}`);
  }

  const expectedKeyframes = sourceAnimation.officialKeyframes;
  const orderedStates = [
    canonicalStates.crankAtRight,
    canonicalStates.crankAtTop,
    canonicalStates.crankAtLeft,
    canonicalStates.crankAtBottom,
    canonicalStates.cycleClosure,
  ];
  for (let index = 0; index < expectedKeyframes.length; index += 1) {
    const expected = expectedKeyframes[index];
    const state = orderedStates[index];
    vector2Near(state.sourceCrankPin, expected.crankPin, 1.1e-15,
      `official crank keyframe ${index}`);
    near(state.sliderY / geometry.sourceScale, expected.sliderY, 1.1e-15,
      `official slider keyframe ${index}`);
    near(state.phase, expected.phase % 1, 0,
      `official phase keyframe ${index}`);
  }
  near(canonicalStates.crankAtTop.sliderY
    - canonicalStates.crankAtBottom.sliderY,
  geometry.outputStroke, 0, 'full Scotch-yoke stroke');
  disposeModel(model.root);
});

test('movement 331 wrist journal exactly fills and traverses real slot A', () => {
  const model = createMovementModel(catalog.movements[330]);
  const {
    blocks,
    contacts,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const contact = contacts.crankJournalInSlotA;

  assert.equal(blocks.yokeBody.userData.realSlot, true);
  assert.equal(contact.type, 'circular-journal-in-straight-horizontal-slot');
  near(contact.journalRadius, geometry.crankJournalRadius, 0,
    'journal contact radius');
  near(contact.slotHalfHeight, geometry.slotHalfHeight, 0,
    'slot contact half-height');
  near(contact.diametralClearance, 0, 0,
    'journal exactly fits slot height');
  near(contact.endCenterMargin, 0.25 * geometry.sourceScale, 0,
    'journal-center margin inside rounded slot ends');
  near(blocks.wristJournal.userData.radius,
    geometry.crankJournalRadius, 0, 'rendered journal radius');

  blocks.wristJournal.geometry.computeBoundingBox();
  blocks.yokeBody.geometry.computeBoundingBox();
  const journalBounds = blocks.wristJournal.geometry.boundingBox;
  const journalCenterZ = blocks.wristJournal.position.z;
  const yokeBounds = blocks.yokeBody.geometry.boundingBox;
  const yokeCenterZ = blocks.yokeBody.position.z;
  const axialOverlap = Math.min(
    journalCenterZ + journalBounds.max.z,
    yokeCenterZ + yokeBounds.max.z,
  ) - Math.max(
    journalCenterZ + journalBounds.min.z,
    yokeCenterZ + yokeBounds.min.z,
  );
  assert.ok(axialOverlap > 0.15,
    'journal physically crosses the slotted-yoke depth');

  for (let sample = 0; sample <= 4096; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 4096);
    const transverseGap = geometry.slotHalfHeight
      - geometry.crankJournalRadius
      - Math.abs(state.slotVerticalResidual);
    near(transverseGap, 0, 0,
      `two working slot faces capture journal at ${sample}`);
    assert.ok(state.crankPin.x - geometry.crankJournalRadius
      >= geometry.slotLeftCenterX - geometry.slotHalfHeight - 1e-15);
    assert.ok(state.crankPin.x + geometry.crankJournalRadius
      <= geometry.slotRightCenterX + geometry.slotHalfHeight + 1e-15);
  }
  disposeModel(model.root);
});

test('movement 331 crosshead is captured between both pillar guides D', () => {
  const model = createMovementModel(catalog.movements[330]);
  const {
    blocks,
    contacts,
    geometry,
    stateAtTime,
  } = model.root.userData;

  assert.equal(blocks.guidePosts[0].userData.fixed, true);
  assert.equal(blocks.guidePosts[1].userData.fixed, true);
  near(blocks.guidePosts[0].userData.innerWorkingFaceX,
    -geometry.guideInnerX, 0, 'left D working face');
  near(blocks.guidePosts[1].userData.innerWorkingFaceX,
    geometry.guideInnerX, 0, 'right D working face');
  near(blocks.leftGuideShoe.userData.contactX,
    -geometry.guideInnerX, 0, 'left crosshead shoe face');
  near(blocks.rightGuideShoe.userData.contactX,
    geometry.guideInnerX, 0, 'right crosshead shoe face');
  near(contacts.leftShoeOnPillarD.lateralClearance, 0, 0,
    'left prismatic contact clearance');
  near(contacts.rightShoeOnPillarD.lateralClearance, 0, 0,
    'right prismatic contact clearance');

  for (let sample = 0; sample <= 4096; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 4096);
    const shoeBottom = state.sliderY - 4 * geometry.sourceScale;
    const shoeTop = state.sliderY + 2 * geometry.sourceScale;
    assert.ok(shoeBottom >= geometry.guideBottomY,
      `crosshead remains on D pillars at lower edge ${sample}`);
    assert.ok(shoeTop <= geometry.guideTopY,
      `crosshead remains on D pillars at upper edge ${sample}`);
    near(state.sliderRotation, 0, 0,
      `opposed D guides prevent yaw at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 331 analytic pin and crosshead rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[330]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-5;

  for (const time of [0.13, 0.51, 0.96, 1.44, 1.93, 2.47, 3.18, 3.72]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    vector2Near(after.crankPin.clone().sub(before.crankPin)
      .multiplyScalar(1 / (2 * step)), state.crankPinVelocity,
    1.2e-10, `crank-pin velocity at ${time}`);
    vector2Near(after.crankPinVelocity.clone()
      .sub(before.crankPinVelocity).multiplyScalar(1 / (2 * step)),
    state.crankPinAcceleration, 2.5e-10,
    `crank-pin acceleration at ${time}`);
    near((after.sliderY - before.sliderY) / (2 * step),
      state.sliderVelocityY, 1.2e-10,
    `crosshead velocity at ${time}`);
    near((after.sliderVelocityY - before.sliderVelocityY) / (2 * step),
      state.sliderAccelerationY, 2.5e-10,
    `crosshead acceleration at ${time}`);
    near((after.journalRelativeToSlot.x
      - before.journalRelativeToSlot.x) / (2 * step),
    state.journalRelativeVelocityX, 1.2e-10,
    `journal sliding speed at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 331 renderer binds the rotor, journal, yoke, and piston in 3D', () => {
  const model = createMovementModel(catalog.movements[330]);
  const {
    animationTiming,
    blocks,
    contacts,
    geometry,
    groundFloorY,
    stateAtTime,
  } = model.root.userData;

  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  model.root.updateMatrixWorld(true);
  const frameMatrix = blocks.fixedFrame.matrixWorld.clone();
  for (const time of [0, 0.37, 0.91, 1.42, 2.08, 2.69, 3.33, 4]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.crankRotor.rotation.z, state.crankAngle, 0,
      `rendered crank angle at ${time}`);
    vector3Near(blocks.crossheadA.position,
      new THREE.Vector3(0, state.sliderY, 0), 0,
    `rendered crosshead translation at ${time}`);
    near(blocks.crossheadA.rotation.z, 0, 0,
      `rendered crosshead yaw at ${time}`);
    vector3Near(blocks.crankPinAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.crankPin.x,
        state.crankPin.y,
        geometry.slotPlaneZ,
      ), 5e-16, `rendered wrist-journal center at ${time}`);
    vector3Near(blocks.slotCenterAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        0,
        state.sliderY,
        geometry.slotPlaneZ,
      ), 0, `rendered slot center at ${time}`);
    vector3Near(blocks.pistonCenterAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pistonCenter.x,
        state.pistonCenter.y,
        geometry.crossheadPlaneZ,
      ), 0, `rendered piston center at ${time}`);
    vector3Near(contacts.crankJournalInSlotA.point,
      new THREE.Vector3(
        state.crankPin.x,
        state.crankPin.y,
        geometry.slotPlaneZ,
      ), 0, `live journal-slot contact at ${time}`);
    near(contacts.leftShoeOnPillarD.relativeSlidingSpeed,
      state.sliderVelocityY, 0, `left D sliding speed at ${time}`);
    near(contacts.rightShoeOnPillarD.relativeSlidingSpeed,
      state.sliderVelocityY, 0, `right D sliding speed at ${time}`);
    assert.ok(blocks.fixedFrame.matrixWorld.equals(frameMatrix));
  }

  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 5.89);
  assert.ok(size.y > 7.02);
  assert.ok(size.z > 1.4,
    'flywheel, frame, crank, yoke, shoes, and journal occupy real depth');
  assert.ok(geometry.flywheelPlaneZ < geometry.frameBackZ);
  assert.ok(geometry.crossheadPlaneZ > geometry.frameFrontZ);
  assert.ok(model.root.userData.cameraFitBounds.min.y
    < geometry.pistonHeadBottomOffsetY - geometry.crankRadius);
  near(groundFloorY,
    geometry.pistonHeadBottomOffsetY - geometry.crankRadius - 0.04, 0,
  'ground plane clears piston at bottom dead center');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const model330 = createMovementModel(catalog.movements[329]);
  assert.equal(model330.root.userData.fidelity, 'authored');
  assert.notEqual(model330.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(model330.root.userData.blocks.forkProngs.length, 2);
  assert.equal(blocks.flywheelSpokes.length, 6);
  disposeModel(model330.root);
  disposeModel(model.root);
});

test('movement 331 closes exactly and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[330]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);

  near(closure.phase, start.phase, 0, 'source phase closure');
  near(closure.crankAngle, start.crankAngle, 0, 'crank-angle closure');
  vector2Near(closure.crankPin, start.crankPin, 0,
    'crank-pin closure');
  vector2Near(closure.crankPinVelocity, start.crankPinVelocity, 0,
    'crank-pin velocity closure');
  near(closure.sliderY, start.sliderY, 0, 'crosshead closure');
  near(closure.sliderVelocityY, start.sliderVelocityY, 0,
    'crosshead velocity closure');
  near(closure.unwrappedCrankAngle, Math.PI * 2, 0,
    'one unwrapped flywheel turn');
  model.update(canonicalTimes.cycleClosure);
  near(blocks.crankRotor.rotation.z, start.crankAngle, 0,
    'rendered rotor closure');
  vector3Near(blocks.crossheadA.position,
    new THREE.Vector3(0, start.sliderY, 0), 0,
  'rendered crosshead closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
