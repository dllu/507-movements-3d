import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const ARCHETYPE =
  'eisach-current-driven-pot-wheel-with-twelve-rigid-inward-opening-peripheral-pots-and-high-discharge-trough';
const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function sameAngle(actual, expected, tolerance, message) {
  near(Math.sin(actual), Math.sin(expected), tolerance, `${message} sine`);
  near(Math.cos(actual), Math.cos(expected), tolerance, `${message} cosine`);
}

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 442 has twelve open pots rigidly secured between two wheel rims', () => {
  const movement = catalog.movements[441];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 442);
  assert.equal(movement.number, '442');
  assert.equal(movement.category, 'Water wheels & turbines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism,
    /One rigid wheel carries twelve equal pots secured around its periphery between two rims/);
  assert.match(data.mechanism,
    /no independent gravity-suspension pivot/);
  assert.match(data.mechanism,
    /at the top the same rigid mouth points downward/);
  assert.equal(geometry.potCount, 12);
  assert.equal(blocks.rims.length, 2);
  assert.equal(blocks.pots.length, 12);
  assert.equal(blocks.potWaters.length, 12);
  assert.equal(blocks.dischargeStreams.length, 12);
  assert.equal(blocks.spokes.length, 24);
  assert.equal(blocks.wheel.parent, model.root);
  assert.equal(blocks.hub.parent, blocks.wheel);
  blocks.rims.forEach((rim) => assert.equal(rim.parent, blocks.wheel));
  blocks.pots.forEach((pot, index) => {
    assert.equal(pot.parent, blocks.wheel);
    assert.equal(blocks.potWaters[index].parent, pot);
    assert.equal(pot.userData.potIndex, index);
    assert.equal(pot.userData.parts.mouthRim.parent, pot);
    assert.equal(pot.userData.parts.mouthRim.children.length, 4,
      'mouth is four rim rails, not a closing plate');
  });
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.potsIndependent, false);
  assert.equal(degreesOfFreedom.potOrientationIndependent, false);
  assert.equal(degreesOfFreedom.potWaterIndependent, false);

  const belts = [];
  const ropes = [];
  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.isRope) ropes.push(object);
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.deepEqual(belts, []);
  assert.deepEqual(ropes, []);
  assert.equal(roles.filter((role) =>
    /^rigid-inward-opening-peripheral-pot-/.test(role)).length, 12);
  assert.equal(roles.filter((role) =>
    /^inward-facing-mouth-of-pot-/.test(role)).length, 12);
  assert.ok(roles.includes(
    'fixed-trough-above-stream-receiving-overturned-pots'));
  disposeModel(model.root);
});

test('movement 442 source evidence distinguishes its secured pots from movement 441 suspended buckets', () => {
  const movement = catalog.movements[441];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate442;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_442.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /river Eisach.*Tyrol/);
  assert.match(movement.description, /current keeping the wheel in motion/);
  assert.match(movement.description,
    /pots on its periphery are successively immersed, filled, and emptied/);
  assert.match(movement.description, /trough above the stream/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /static engraving and caption.*Animated control is unavailable/);
  assert.equal(dynamics.currentPressurePotCaptureRetentionLeakageFreeSurfaceSloshDischargeBearingFrictionAndRotationalInertiaModeled,
    false);
  assert.match(dynamics.potFillSchedule,
    /rigid pot fills.*submerged lower arc.*empties.*upper trough/);
  assert.match(dynamics.waterRendering,
    /horizontal world-space surface.*not solved/);
  assert.match(dynamics.streamDrive,
    /rightward current force.*counterclockwise torque sign/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateAxleCenterPixels, [286, 241]);
  assert.deepEqual(plate.approximateTopPotCenterPixels, [277, 48]);
  assert.deepEqual(plate.approximateBottomPotCenterPixels, [294, 425]);
  assert.equal(plate.approximateWheelOuterRadiusPixels, 192);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence,
    /vertical two-rim wheel.*pots secured between the rims.*upward direction arrow on the right/);
  assert.match(evidence.reconstructionDisclosure,
    /twelve-pot count estimated from the engraving.*independently engineered/);
  assert.match(evidence.reconstructionDisclosure,
    /contrasting with Movement 441’s explicitly suspended buckets/);
  disposeModel(model.root);
});

test('movement 442 source pose places rigid pots at right, top, left, and bottom cardinal stations', () => {
  const model = createMovementModel(catalog.movements[441]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  near(source.wheelAngle, geometry.sourceWheelAngle, 0,
    'source wheel angle');
  near(sourcePose.wheelAngle, source.wheelAngle, 0,
    'recorded source angle');
  assert.equal(sourcePose.potPivotPositions.length, geometry.potCount);
  assert.equal(sourcePose.potFills.length, geometry.potCount);
  for (let index = 0; index < geometry.potCount; index += 1) {
    const baseAngle = index * FULL_TURN / geometry.potCount;
    const expected = new THREE.Vector3(
      geometry.wheelCenter.x
        + geometry.potPivotRadius * Math.cos(baseAngle),
      geometry.wheelCenter.y
        + geometry.potPivotRadius * Math.sin(baseAngle),
      0,
    );
    vectorNear(source.potStates[index].pivotPosition, expected, 2e-15,
      `source pot pivot ${index}`);
    vectorNear(sourcePose.potPivotPositions[index], expected, 2e-15,
      `recorded pot pivot ${index}`);
  }
  sameAngle(source.potStates[0].worldAngle, 0, 0,
    'right source pot');
  sameAngle(source.potStates[3].worldAngle, Math.PI / 2, 0,
    'top source pot');
  sameAngle(source.potStates[6].worldAngle, Math.PI, 1e-15,
    'left source pot');
  sameAngle(source.potStates[9].worldAngle, 3 * Math.PI / 2, 1e-15,
    'bottom source pot');
  assert.equal(source.activeDischargeCount, 1);
  near(source.potStates[3].dischargeFlow, 1, 1e-15,
    'engraving-like top discharge');
  disposeModel(model.root);
});

test('movement 442 rigid inward-facing mouths point up under water and down over the trough', () => {
  const model = createMovementModel(catalog.movements[441]);
  const { potStateAtWorldAngle } = model.root.userData;
  const degrees = (value) => THREE.MathUtils.degToRad(value);
  const right = potStateAtWorldAngle(degrees(0));
  const top = potStateAtWorldAngle(degrees(90));
  const left = potStateAtWorldAngle(degrees(180));
  const bottom = potStateAtWorldAngle(degrees(270));

  vectorNear(right.inwardOpeningDirection, new THREE.Vector2(-1, 0),
    2e-16, 'right pot opens toward hub');
  vectorNear(top.inwardOpeningDirection, new THREE.Vector2(0, -1),
    2e-16, 'top pot opens downward');
  vectorNear(left.inwardOpeningDirection, new THREE.Vector2(1, 0),
    3e-16, 'left pot opens toward hub');
  vectorNear(bottom.inwardOpeningDirection, new THREE.Vector2(0, 1),
    3e-16, 'bottom pot opens upward');
  sameAngle(right.openingDirectionAngle, Math.PI, 1e-15,
    'right opening angle');
  sameAngle(top.openingDirectionAngle, 3 * Math.PI / 2, 1e-15,
    'top opening angle');
  sameAngle(bottom.potWorldRotation, FULL_TURN, 1e-15,
    'bottom rigid pot body orientation');
  disposeModel(model.root);
});

test('movement 442 current and wheel directions agree at the partly immersed bottom radius', () => {
  const model = createMovementModel(catalog.movements[441]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  near(geometry.currentDriveTorque,
    geometry.wheelRadius * geometry.representativeCurrentForce,
    0, 'bottom current torque');
  assert.ok(geometry.currentDriveTorque > 0);
  for (const phase of [0, 0.07, 0.18, 0.31, 0.50, 0.77, 0.99]) {
    const state = stateAtInputAngle(FULL_TURN * phase);
    assert.ok(state.wheelAngularSpeed > 0,
      `counterclockwise wheel speed at ${phase}`);
    assert.ok(state.currentDriveTorque > 0,
      `counterclockwise water torque at ${phase}`);
    assert.ok(state.streamVelocityAtBottomDotWheelTangent > 0,
      `rightward current agrees with bottom tread at ${phase}`);
    assert.ok(state.immersedPotCount >= 3);
    assert.ok(state.immersedPotCount < geometry.potCount);
  }
  assert.ok(stateAtInputAngle(0.2).wheelAngle
    > stateAtInputAngle(0).wheelAngle);
  disposeModel(model.root);
});

test('movement 442 pots successively fill, carry, and empty with no overlapping upper discharge', () => {
  const model = createMovementModel(catalog.movements[441]);
  const { geometry, potStateAtWorldAngle, stateAtInputAngle } =
    model.root.userData;
  const degrees = (value) => THREE.MathUtils.degToRad(value);

  const entry = potStateAtWorldAngle(degrees(220));
  const pickupMiddle = potStateAtWorldAngle(degrees(262.5));
  const exit = potStateAtWorldAngle(degrees(305));
  const rising = potStateAtWorldAngle(degrees(20));
  const dumpStart = potStateAtWorldAngle(degrees(78));
  const dumpPeak = potStateAtWorldAngle(degrees(90));
  const dumpEnd = potStateAtWorldAngle(degrees(102));
  const descending = potStateAtWorldAngle(degrees(180));

  near(entry.potFill, 0, 0, 'empty pot enters current');
  near(pickupMiddle.potFill, 0.5, 3e-15,
    'pot half fills across immersion arc');
  near(exit.potFill, 1, 2e-15, 'pot leaves stream full');
  near(rising.potFill, 1, 0, 'pot carries water up right side');
  near(dumpStart.potFill, 1, 2e-15,
    'full pot reaches elevated trough');
  near(dumpPeak.potFill, 0.5, 3e-15,
    'top pot half emptied');
  near(dumpPeak.dischargeFlow, 1, 1e-15,
    'top discharge flow peaks');
  near(dumpEnd.potFill, 0, 3e-15,
    'pot leaves upper trough empty');
  near(descending.potFill, 0, 0,
    'pot descends empty');
  near((geometry.dumpEndAngle - geometry.dumpStartAngle)
    * geometry.potCount, THREE.MathUtils.degToRad(288), 2e-15,
  'twenty-four-degree window is narrower than thirty-degree spacing');
  for (let sample = -12000; sample <= 24000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 12000);
    assert.ok(state.activeDischargeCount <= 1,
      `only one pot discharges at sample ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 442 every pot orientation advances one-for-one with its one rigid wheel', () => {
  const model = createMovementModel(catalog.movements[441]);
  const { blocks, geometry, stateAtInputAngle, update } = model.root.userData;
  const localRotations = blocks.pots.map((pot) => pot.rotation.z);

  for (const phase of [0, 0.037, 0.11, 0.23, 0.41, 0.58, 0.76, 0.93]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtInputAngle(FULL_TURN * phase);
    update(time);
    model.root.updateMatrixWorld(true);
    for (let index = 0; index < geometry.potCount; index += 1) {
      const potState = state.potStates[index];
      near(blocks.pots[index].rotation.z, localRotations[index], 0,
        `pot ${index} has no hinge motion at ${phase}`);
      sameAngle(
        state.wheelAngle + blocks.pots[index].rotation.z,
        potState.potWorldRotation,
        3e-15,
        `pot ${index} rigid world orientation at ${phase}`,
      );
      const actualWorldRotation = new THREE.Quaternion();
      blocks.pots[index].getWorldQuaternion(actualWorldRotation);
      const expectedWorldRotation = new THREE.Quaternion()
        .setFromAxisAngle(Z_AXIS, potState.potWorldRotation);
      near(actualWorldRotation.angleTo(expectedWorldRotation), 0, 3e-8,
        `rendered pot ${index} rigid orientation at ${phase}`);
    }
  }
  disposeModel(model.root);
});

test('movement 442 update keeps displayed water level while all fixed supports and trough remain fixed', () => {
  const model = createMovementModel(catalog.movements[441]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [blocks.axle, blocks.base, blocks.streamBed,
    blocks.streamWater, blocks.dischargeTrough, ...blocks.bearings,
    ...blocks.supports, ...blocks.troughSupports];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());
  const identity = new THREE.Quaternion();

  for (const phase of [0, 0.083333333333, 0.21, 0.39,
    0.57, 0.74, 0.91]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    sameAngle(blocks.wheel.rotation.z, state.wheelAngle, 2e-15,
      `wheel update at ${phase}`);
    model.root.updateMatrixWorld(true);
    for (let index = 0; index < geometry.potCount; index += 1) {
      const potState = state.potStates[index];
      assert.equal(blocks.potWaters[index].visible,
        potState.potFill > 0.01);
      assert.equal(blocks.dischargeStreams[index].visible,
        potState.dischargeFlow > 0.01);
      if (blocks.potWaters[index].visible) {
        const worldRotation = new THREE.Quaternion();
        blocks.potWaters[index].getWorldQuaternion(worldRotation);
        near(worldRotation.angleTo(identity), 0, 3e-8,
          `pot ${index} displayed free surface at ${phase}`);
      }
    }
    fixedBlocks.forEach((block, index) => vectorNear(
      block.position,
      fixedPositions[index],
      0,
      `fixed apparatus at ${phase}`,
    ));
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  near(closure.wheelAngle, source.wheelAngle, 0,
    'wheel cycle closure');
  closure.potStates.forEach((potState, index) => {
    near(potState.potFill, source.potStates[index].potFill, 0,
      `pot ${index} fill closure`);
    near(potState.dischargeFlow,
      source.potStates[index].dischargeFlow, 0,
      `pot ${index} discharge closure`);
  });
  assert.equal(model.root.userData.metering.potsPerWheelRevolution, 12);
  assert.equal(model.root.userData.metering.elevatedVolumePerWheelRevolution,
    geometry.potCapacity * geometry.potCount);
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 12);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 442 pot wheel', () => {
  const movement442 = catalog.movements[441];
  const movement507 = catalog.movements[506];
  const model442 = createMovementModel(movement442);
  const model507 = createMovementModel(movement507);

  assert.equal(movement442.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model442.root);
  disposeModel(model507.root);
});
