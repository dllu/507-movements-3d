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
  'robertson-hydrostatic-jack-with-fixed-hollow-ram-rising-cylinder-claw-internal-feed-and-thumb-screw-return';
const FULL_TURN = Math.PI * 2;

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
    } else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function movementModel() {
  const movement = catalog.movements[466];
  return { model: createMovementModel(movement), movement };
}

test('movement 467 is Robertson’s jack with a fixed hollow ram and one moving cylinder-saddle-claw assembly', () => {
  const { model, movement } = movementModel();
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 467);
  assert.equal(movement.number, '467');
  assert.equal(movement.title, 'Robertson’s hydrostatic jack');
  assert.equal(movement.category, 'Hydraulics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.hollowBase.parent, model.root);
  assert.equal(blocks.fixedRam.parent, model.root);
  assert.equal(blocks.fixedRamBody.parent, blocks.fixedRam);
  assert.equal(blocks.internalPressurePipe.parent, blocks.fixedRam);
  assert.equal(blocks.movingCylinder.parent, model.root);
  assert.equal(blocks.cylinderShell.parent, blocks.movingCylinder);
  assert.equal(blocks.topSaddle.parent, blocks.movingCylinder);
  assert.equal(blocks.sideClaw.parent, blocks.movingCylinder);
  assert.equal(blocks.thumbScrew.parent, model.root);
  assert.equal(blocks.screwThread.parent, blocks.thumbScrew);
  assert.equal(blocks.pumpBarrel.parent, model.root);
  assert.equal(blocks.pumpCylinder.parent, blocks.pumpBarrel);
  assert.equal(blocks.gland.parent, blocks.pumpBarrel);
  assert.equal(blocks.plunger.parent, model.root);
  assert.equal(blocks.pumpPiston.parent, blocks.plunger);
  assert.equal(blocks.pumpLever.parent, model.root);
  assert.equal(blocks.swingLink.parent, model.root);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.fixedRamTranslates, false);
  assert.equal(degreesOfFreedom.cylinderAndClawIndependent, false);
  assert.equal(degreesOfFreedom.thumbScrewReturnScheduledAfterPumping, true);
  disposeModel(model.root);
});

test('movement 467 source record preserves every explicitly described moving, fixed, feed, and return member', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.brownPlate467;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_467.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.plate, 'Brown 1868, Movement 467');
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(sourceAnimation.sourcePrescribedNormalizedTiming, false);
  assert.deepEqual(plate.approximateHollowBaseBoundsPixels,
    [209, 419, 131, 83]);
  assert.deepEqual(plate.approximateMovingCylinderAndClawBoundsPixels,
    [204, 57, 185, 372]);
  assert.deepEqual(plate.approximateThumbScrewBoundsPixels,
    [177, 438, 105, 44]);
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('ram is stationary')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('cylinder and attached claw slide')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('pipe inside the ram')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('thumb-screw valve')));
  assert.match(evidence.engravingEvidence, /winged horizontal return screw/i);
  assert.match(evidence.reconstructionDisclosure, /one 0.045-pitch screw turn/i);
  disposeModel(model.root);
});

test('movement 467 lever keeps exact floating-fulcrum closure and a fixed straight oblique plunger axis', () => {
  const { model } = movementModel();
  const { geometry, pumpKinematics } = model.root.userData;
  const axis = geometry.plungerAxis;
  const home = geometry.plungerPinHome;
  let lowAngle = Infinity;
  let highAngle = -Infinity;

  for (let sample = 0; sample <= 200; sample += 1) {
    const strokeAngle = FULL_TURN * sample / 50;
    const state = pumpKinematics(strokeAngle);
    const pin = new THREE.Vector2(state.plungerPin.x, state.plungerPin.y);
    const fulcrum = new THREE.Vector2(state.leverFulcrum.x,
      state.leverFulcrum.y);
    near(pin.distanceTo(fulcrum), geometry.leverShortArm, 1e-12,
      `lever short arm at ${strokeAngle}`);
    near(fulcrum.distanceTo(geometry.swingLinkPivot),
      geometry.swingLinkLength, 1e-12, `swing link at ${strokeAngle}`);
    const offset = pin.clone().sub(home);
    near(offset.x * axis.y - offset.y * axis.x, 0, 1e-12,
      `plunger pin stays on its axis at ${strokeAngle}`);
    near(-offset.dot(axis), state.plungerWithdrawal, 1e-12,
      `withdrawal along axis at ${strokeAngle}`);
    near(state.piston.distanceTo(state.plungerPin),
      geometry.plungerTipDistance, 1e-12, `plunger length at ${strokeAngle}`);
    near(Math.atan2(pin.y - fulcrum.y, pin.x - fulcrum.x),
      state.leverAngle, 1e-12, `straight lever at ${strokeAngle}`);
    assert.ok(state.plungerWithdrawal >= -1e-12
      && state.plungerWithdrawal <= geometry.pumpStrokeLength + 1e-12);
    lowAngle = Math.min(lowAngle, state.leverAngle);
    highAngle = Math.max(highAngle, state.leverAngle);
  }
  // Brown's lower eye sits almost in line with the upper eye and handle.
  assert.ok(highAngle - lowAngle > THREE.MathUtils.degToRad(12));
  assert.ok(highAngle - lowAngle < THREE.MathUtils.degToRad(30));
  disposeModel(model.root);
});

test('movement 467 analytic plunger velocity and acceleration match finite differences', () => {
  const { model } = movementModel();
  const { pumpKinematics } = model.root.userData;
  const speed = 4.31;
  const acceleration = -0.71;
  const timeStep = 1e-4;

  for (const angle of [0.28, 1.09, 2.37, 3.58, 4.62, 5.73]) {
    const center = pumpKinematics(angle, speed, acceleration);
    const beforeAngle = angle - speed * timeStep
      + 0.5 * acceleration * timeStep ** 2;
    const afterAngle = angle + speed * timeStep
      + 0.5 * acceleration * timeStep ** 2;
    const before = pumpKinematics(beforeAngle);
    const after = pumpKinematics(afterAngle);
    near((after.plungerWithdrawal - before.plungerWithdrawal)
      / (2 * timeStep), center.pistonVelocity, 5e-8,
    `plunger velocity at ${angle}`);
    near((after.plungerWithdrawal - 2 * center.plungerWithdrawal
      + before.plungerWithdrawal) / timeStep ** 2,
    center.pistonAcceleration, 1e-6,
    `plunger acceleration at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 467 counts only delivery downstrokes and converts their exact volume into cylinder lift', () => {
  const { model } = movementModel();
  const {
    deliveredLengthAtStrokeAngle,
    geometry,
    pumpKinematics,
    stateAtPhase,
  } = model.root.userData;

  for (let cycle = 0; cycle < geometry.pumpCycleCount; cycle += 1) {
    const home = cycle * FULL_TURN;
    const withdrawn = home + Math.PI;
    const nextHome = home + FULL_TURN;
    near(deliveredLengthAtStrokeAngle(home, pumpKinematics(home)),
      cycle * geometry.pumpStrokeLength, 2e-11,
      `home delivery count ${cycle}`);
    near(deliveredLengthAtStrokeAngle(withdrawn, pumpKinematics(withdrawn)),
      cycle * geometry.pumpStrokeLength, 2e-11,
      `suction withdrawal adds no delivery ${cycle}`);
    near(deliveredLengthAtStrokeAngle(nextHome, pumpKinematics(nextHome)),
      (cycle + 1) * geometry.pumpStrokeLength, 2e-11,
      `return stroke delivers ${cycle}`);
  }
  near(geometry.maximumDeliveredVolume,
    geometry.pumpCycleCount * geometry.pumpPlungerArea
      * geometry.pumpStrokeLength,
    1e-12, 'maximum delivered volume');
  near(geometry.maximumCylinderLift,
    geometry.maximumDeliveredVolume / geometry.fixedRamArea,
    1e-12, 'maximum moving-cylinder lift');
  for (let sample = 0; sample <= 320; sample += 1) {
    const phase = geometry.operationEndPhase * sample / 320;
    const state = stateAtPhase(phase);
    near(state.cumulativeDeliveredVolume,
      geometry.pumpPlungerArea * state.deliveredLength, 1e-12,
      `pump volume at phase ${phase}`);
    near(state.retainedCylinderVolume,
      geometry.fixedRamArea * state.cylinderLift, 1e-12,
      `cylinder volume at phase ${phase}`);
    near(state.volumeDisplacementResidual, 0, 1e-12,
      `volume closure at phase ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 467 pressure chamber grows upward from the fixed ram while base-water loss is exactly retained volume', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;
  let previousLift = -1;

  for (let sample = 0; sample <= 240; sample += 1) {
    const phase = geometry.operationEndPhase * sample / 240;
    const state = stateAtPhase(phase);
    assert.ok(state.cylinderLift >= previousLift - 1e-12);
    near(state.pressureChamberHeight,
      geometry.initialPressureChamberHeight + state.cylinderLift,
      1e-12, `chamber height at ${phase}`);
    near(state.baseWaterVolume,
      geometry.baseInitialWaterVolume - state.retainedCylinderVolume,
      1e-12, `base reservoir balance at ${phase}`);
    assert.ok(state.baseWaterVolume > 0);
    assert.ok(state.baseWaterVolume < geometry.baseWaterCapacity);
    previousLift = state.cylinderLift;
  }
  near(geometry.hydraulicAreaRatio,
    geometry.fixedRamArea / geometry.pumpPlungerArea, 1e-12,
    'hydraulic area ratio');
  disposeModel(model.root);
});

test('movement 467 check valves alternate during pumping and both seat before the thumb-screw return opens', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase, transmission } = model.root.userData;

  for (let sample = 1; sample < 640; sample += 1) {
    const phase = geometry.operationEndPhase * sample / 640;
    const state = stateAtPhase(phase);
    assert.ok(!(state.inletOpenAmount > 1e-12
      && state.deliveryOpenAmount > 1e-12));
    near(state.screwOpenAmount, 0, 1e-12,
      `thumb screw seated while pumping at ${phase}`);
    if (state.pistonVelocity > 1e-10) {
      assert.ok(state.inletOpenAmount > 0);
      near(state.deliveryOpenAmount, 0, 1e-12,
        `delivery check seated on suction at ${phase}`);
      near(state.deliveryFlowRate, 0, 1e-12,
        `no delivery flow on suction at ${phase}`);
    } else if (state.pistonVelocity < -1e-10) {
      assert.ok(state.deliveryOpenAmount > 0);
      near(state.inletOpenAmount, 0, 1e-12,
        `inlet check seated on delivery at ${phase}`);
      near(state.suctionFlowRate, 0, 1e-12,
        `no suction flow on delivery at ${phase}`);
    }
  }
  for (const phase of [0.66, 0.69]) {
    const held = stateAtPhase(phase);
    near(held.inletOpenAmount, 0, 1e-12, 'inlet seated on hold');
    near(held.deliveryOpenAmount, 0, 1e-12, 'delivery seated on hold');
    near(held.returnFlowRate, 0, 1e-12, 'return shut on hold');
  }
  assert.match(transmission.internalFeed, /pipe inside fixed ram/);
  disposeModel(model.root);
});

test('movement 467 thumb-screw rotation, thread-pitch retreat, return flow, and reseating remain consistent', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase, transmission } = model.root.userData;
  let previousLift = Infinity;
  let previousAngle = -Infinity;

  for (let sample = 0; sample <= 100; sample += 1) {
    const phase = THREE.MathUtils.lerp(
      geometry.loweringStartPhase,
      geometry.loweringEndPhase,
      sample / 100,
    );
    const state = stateAtPhase(phase);
    near(state.thumbScrewRetreat,
      geometry.thumbScrewPitch * state.thumbScrewAngle / FULL_TURN,
      1e-12, `screw lead at ${phase}`);
    near(state.screwOpenAmount, state.loweringProgress, 1e-12,
      `screw meters lowering at ${phase}`);
    assert.ok(state.cylinderLift <= previousLift + 1e-12);
    assert.ok(state.thumbScrewAngle >= previousAngle - 1e-12);
    if (sample > 0 && sample < 100) assert.ok(state.returnFlowRate > 0);
    previousLift = state.cylinderLift;
    previousAngle = state.thumbScrewAngle;
  }
  const fullyOpen = stateAtPhase(geometry.loweringEndPhase);
  near(fullyOpen.thumbScrewAngle,
    geometry.thumbScrewMaximumAngle, 1e-12, 'one full opening turn');
  near(fullyOpen.thumbScrewRetreat,
    geometry.thumbScrewMaximumRetreat, 1e-12,
    'one-pitch maximum retreat');
  near(fullyOpen.cylinderLift, 0, 1e-12,
    'moving cylinder fully lowered');
  const reclosing = stateAtPhase(
    (geometry.loweringEndPhase + 1) / 2,
  );
  assert.ok(reclosing.screwOpenAmount > 0
    && reclosing.screwOpenAmount < 1);
  near(reclosing.returnFlowRate, 0, 1e-12,
    'no pressure return after cylinder is down');
  const closure = stateAtPhase(1);
  near(closure.thumbScrewAngle, 0, 1e-12, 'screw rotational closure');
  near(closure.thumbScrewRetreat, 0, 1e-12, 'screw axial closure');
  assert.match(transmission.screw, /pitch\*rotation\/\(2\*pi\)/);
  disposeModel(model.root);
});

test('movement 467 renderer moves only the outer cylinder assembly and maps chamber and threaded return states', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const fixedRamPosition = blocks.fixedRam.position.clone();
  const basePosition = blocks.hollowBase.position.clone();
  const screwClosedX = blocks.thumbScrew.position.x;

  for (const phase of [0, 0.24, 0.48, 0.66, 0.79, 0.88, 0.94, 1]) {
    const time = phase * geometry.cycleDuration;
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.movingCylinder.position.y, state.cylinderLift, 1e-12,
      `moving cylinder at phase ${phase}`);
    vectorNear(blocks.fixedRam.position, fixedRamPosition, 0,
      'stationary ram remains fixed');
    vectorNear(blocks.hollowBase.position, basePosition, 0,
      'hollow base remains fixed');
    near(blocks.pressureChamber.scale.y,
      state.pressureChamberHeight - 2 * geometry.chamberWaterGap, 1e-12,
      `pressure chamber height at phase ${phase}`);
    near(blocks.pressureChamber.position.y,
      geometry.fixedRamTopY + state.pressureChamberHeight / 2,
      1e-12, `pressure chamber center at phase ${phase}`);
    near(blocks.thumbScrew.rotation.x, state.thumbScrewAngle, 1e-12,
      `thumb-screw rotation at phase ${phase}`);
    near(blocks.thumbScrew.position.x,
      screwClosedX - state.thumbScrewRetreat, 1e-12,
      `thumb-screw axial position at phase ${phase}`);
    // The return passage stands full; the screw's retreat shows the return.
    assert.equal(blocks.returnWater.visible, true);
    vectorNear(blocks.plunger.position, state.plungerPin, 1e-12,
      `plunger at phase ${phase}`);
    near(blocks.pumpLever.rotation.z, state.leverAngle, 1e-12,
      `lever at phase ${phase}`);
    model.root.updateMatrixWorld(true);
    const fulcrumPin = new THREE.Box3().setFromObject(blocks.fulcrumPin)
      .getCenter(new THREE.Vector3());
    near(Math.hypot(fulcrumPin.x - state.leverFulcrum.x,
      fulcrumPin.y - state.leverFulcrum.y), 0, 1e-6,
    `swing link carries the lever fulcrum at phase ${phase}`);
  }
  // The view opens on Brown's pose: the cylinder raised, the plunger home.
  const opening = stateAtTime(0);
  near(opening.cylinderLift, geometry.maximumCylinderLift, 1e-12,
    'source pose raised');
  near(opening.plungerWithdrawal, 0, 1e-12, 'source pose plunger home');
  disposeModel(model.root);
});

test('movement 467 schedule is C2 at pumping, holding, lowering, reseating, and cycle boundaries', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;
  const boundaries = [
    0,
    geometry.operationEndPhase,
    geometry.loweringStartPhase,
    geometry.loweringEndPhase,
  ];
  const step = 1e-6;
  const fields = ['cylinderLift', 'leverAngle', 'thumbScrewAngle'];

  for (const boundary of boundaries) {
    for (const field of fields) {
      const minusTwo = stateAtPhase(boundary - 2 * step)[field];
      const minusOne = stateAtPhase(boundary - step)[field];
      const center = stateAtPhase(boundary)[field];
      const plusOne = stateAtPhase(boundary + step)[field];
      const plusTwo = stateAtPhase(boundary + 2 * step)[field];
      const leftVelocity = (center - minusOne) / step;
      const rightVelocity = (plusOne - center) / step;
      near(leftVelocity, rightVelocity, 0.003,
        `${field} velocity continuity at ${boundary}`);
      const leftAcceleration = (center - 2 * minusOne + minusTwo)
        / step ** 2;
      const rightAcceleration = (plusTwo - 2 * plusOne + center)
        / step ** 2;
      near(leftAcceleration, rightAcceleration, 0.30,
        `${field} acceleration continuity at ${boundary}`);
    }
  }
  disposeModel(model.root);
});

test('movement 467 has finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement467 = catalog.movements[466];
  const movement507 = catalog.movements[506];
  const model467 = createMovementModel(movement467);
  const model507 = createMovementModel(movement507);
  const fitBounds = model467.root.userData.cameraFitBounds;

  for (const phase of [0, 0.48, 0.68, 0.79, 0.94]) {
    model467.update(phase * model467.root.userData.geometry.cycleDuration);
    model467.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model467.root);
    for (const value of [bounds.min.x, bounds.min.y, bounds.min.z,
      bounds.max.x, bounds.max.y, bounds.max.z]) {
      assert.ok(Number.isFinite(value));
    }
    assert.ok(bounds.max.x > bounds.min.x);
    assert.ok(bounds.max.y > bounds.min.y);
    assert.ok(bounds.max.z > bounds.min.z);
    assert.ok(fitBounds.min.x <= bounds.min.x);
    assert.ok(fitBounds.min.y <= bounds.min.y);
    assert.ok(fitBounds.min.z <= bounds.min.z);
    assert.ok(fitBounds.max.x >= bounds.max.x);
    assert.ok(fitBounds.max.y >= bounds.max.y);
    assert.ok(fitBounds.max.z >= bounds.max.z);
  }
  assert.equal(movement467.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model467.root);
  disposeModel(model507.root);
});

test('movement 467 is drawn as Brown’s section: back half-shells, plain cut faces at z=0 and a butterfly wing', () => {
  const { model } = movementModel();
  const { blocks } = model.root.userData;
  model.root.updateMatrixWorld(true);
  for (const shell of [blocks.fixedRamBody, blocks.cylinderShell,
    blocks.cylinderTopCap, blocks.saddleHead, blocks.clawHook,
    blocks.baseShell, blocks.baseFloorPlate, blocks.baseTopPlate]) {
    const box = new THREE.Box3().setFromObject(shell);
    assert.ok(box.max.z <= 1e-6, `${shell.userData.role} keeps only z<0`);
    assert.equal(shell.material.transparent, false,
      `${shell.userData.role} is opaque`);
  }
  for (const section of [blocks.ramSection, blocks.cylinderSection,
    blocks.baseSection]) {
    // One plain solid face per cut: no hatch strokes (engraving notation).
    assert.equal(section.isMesh, true);
    assert.equal(section.children.length, 0);
    assert.equal(section.userData.presentationOnly, true);
    assert.equal(section.castShadow, false);
    const box = new THREE.Box3().setFromObject(section);
    assert.ok(box.min.z >= -1e-6 && box.max.z <= 0.0041);
  }
  // The lever passes behind the column, hidden by the back half-shells.
  const lever = new THREE.Box3().setFromObject(blocks.leverBar);
  const shell = new THREE.Box3().setFromObject(blocks.cylinderShell);
  assert.ok(lever.max.z < shell.min.z + 0.1 && lever.max.z < -0.6);
  assert.equal(blocks.screwWings.length, 1);
  const wing = new THREE.Box3().setFromObject(blocks.screwWings[0]);
  assert.ok(wing.max.y - wing.min.y > 0.4 && wing.max.z - wing.min.z < 0.08,
    'flat two-lobed wing across the screw');
  disposeModel(model.root);
});
