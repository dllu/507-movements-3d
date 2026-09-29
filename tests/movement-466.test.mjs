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
  'hand-pumped-hydrostatic-press-with-pascal-area-force-ratio-volume-displacement-and-relief-return';
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
  const movement = catalog.movements[465];
  return { model: createMovementModel(movement), movement };
}

test('movement 466 is one hand pump hydraulically linked to a much larger solid ram inside a fixed press frame', () => {
  const { model, movement } = movementModel();
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 466);
  assert.equal(movement.number, '466');
  assert.equal(movement.title, 'Hand-pumped hydrostatic press');
  assert.equal(movement.category, 'Hydraulics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.pumpLever.parent, model.root);
  assert.equal(blocks.pumpCylinder.parent, model.root);
  assert.equal(blocks.pressurePipe.parent, model.root);
  assert.equal(blocks.ramCylinder.parent, model.root);
  assert.equal(blocks.ramAssembly.parent, model.root);
  assert.equal(blocks.movingPlaten.parent, blocks.ramAssembly);
  assert.equal(blocks.compressibleLoad.parent, model.root);
  assert.equal(blocks.fixedHead.parent, blocks.pressFrame);
  assert.equal(blocks.inletValve.parent, model.root);
  assert.equal(blocks.deliveryValve.parent, model.root);
  // Pass 73: Brown's plate. The lever's fulcrum rides a swing link from the
  // T lug, and the ball weight loads a real safety valve on the chest.
  assert.equal(blocks.swingLink.parent, model.root);
  assert.equal(blocks.safetyValve.parent, model.root);
  assert.equal(blocks.ballWeight.parent, blocks.safetyValve);
  assert.equal(blocks.valveChest.parent, model.root);
  assert.equal(blocks.compressibleLoad.children.length, 4);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.pumpAndRamIndependent, false);
  assert.equal(degreesOfFreedom.reliefReturnScheduledAfterPumping, true);
  disposeModel(model.root);
});

test('movement 466 source record preserves Brown’s pump, pipe, solid ram, squared-diameter law, and unavailable animation', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.brownPlate466;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_466.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.plate, 'Brown 1868, Movement 466');
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(sourceAnimation.sourcePrescribedNormalizedTiming, false);
  assert.equal(plate.pixelToModel, 'x=(px-262)/72, y=(280-py)/72');
  assert.deepEqual(plate.crossheadPinPixels, [366, 155]);
  assert.deepEqual(plate.swingLinkFootPixels, [324.5, 265.5]);
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('small pipe')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('solid ram')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('squared diameters')));
  assert.match(evidence.engravingEvidence, /ball weight.*tall pump barrel/i);
  assert.match(evidence.reconstructionDisclosure, /4:1 diameter ratio/i);
  disposeModel(model.root);
});

test('movement 466 obeys the exact Pascal area-force law and preserves Brown’s 1-to-30 example', () => {
  const { model } = movementModel();
  const { geometry, transmission } = model.root.userData;

  near(geometry.diameterRatio,
    geometry.ramRadius / geometry.pumpPlungerRadius, 1e-12,
    'modeled diameter ratio');
  near(geometry.diameterRatio, 4, 1e-12,
    'plate ram-to-plunger diameter ratio');
  near(geometry.areaRatio,
    geometry.ramArea / geometry.pumpPlungerArea, 1e-12,
    'piston area ratio');
  near(geometry.areaRatio, geometry.diameterRatio ** 2, 1e-12,
    'squared-diameter area ratio');
  near(geometry.idealHydraulicPressure,
    geometry.nominalInputForce / geometry.pumpPlungerArea, 1e-12,
    'uniform ideal hydraulic pressure');
  near(geometry.idealRamForce,
    geometry.idealHydraulicPressure * geometry.ramArea, 1e-9,
    'large ram force from pressure');
  near(geometry.idealRamForce,
    geometry.nominalInputForce * geometry.areaRatio, 1e-9,
    'force multiplication');
  assert.equal(geometry.brownExamplePumpDiameter, 1);
  assert.equal(geometry.brownExampleRamDiameter, 30);
  assert.equal(geometry.brownExampleForceRatio, 900);
  assert.match(transmission.force, /\(D_ram\/D_pump\)\^2/);
  disposeModel(model.root);
});

test('movement 466 hand lever keeps its swing-link closure while the plunger stays on its vertical axis', () => {
  const { model } = movementModel();
  const { geometry, pumpKinematics } = model.root.userData;

  for (let sample = 0; sample <= 240; sample += 1) {
    const strokeAngle = FULL_TURN * sample / 60;
    const state = pumpKinematics(strokeAngle);
    near(state.leverPin.distanceTo(state.fulcrum),
      geometry.pumpLeverPinRadius, 2e-12,
      `rigid lever between fulcrum and crosshead pin at ${strokeAngle}`);
    near(state.fulcrum.distanceTo(new THREE.Vector3(geometry.swingLinkFoot.x, geometry.swingLinkFoot.y, 0)),
      geometry.swingLinkLength, 2e-12,
      `swing link closure at ${strokeAngle}`);
    near(state.crosshead.x, geometry.pumpSliderX, 1e-12,
      `crosshead slider axis at ${strokeAngle}`);
    near(state.piston.x, geometry.pumpSliderX, 1e-12,
      `plunger slider axis at ${strokeAngle}`);
    near(state.crosshead.y - state.piston.y,
      geometry.pumpPistonRodOffset, 1e-12,
      `rigid plunger at ${strokeAngle}`);
    assert.ok(state.piston.y > geometry.pumpCylinderBottomY);
    assert.ok(state.piston.y < geometry.pumpCylinderTopY);
  }
  disposeModel(model.root);
});

test('movement 466 analytic small-plunger velocity and acceleration match finite differences', () => {
  const { model } = movementModel();
  const { pumpKinematics } = model.root.userData;
  const speed = 4.17;
  const acceleration = -0.63;
  const timeStep = 1e-4;

  for (const angle of [0.31, 1.17, 2.46, 3.52, 4.74, 5.61]) {
    const center = pumpKinematics(angle, speed, acceleration);
    const beforeAngle = angle - speed * timeStep
      + 0.5 * acceleration * timeStep ** 2;
    const afterAngle = angle + speed * timeStep
      + 0.5 * acceleration * timeStep ** 2;
    const before = pumpKinematics(beforeAngle);
    const after = pumpKinematics(afterAngle);
    const numericalVelocity = (after.piston.y - before.piston.y)
      / (2 * timeStep);
    const numericalAcceleration = (
      after.piston.y - 2 * center.piston.y + before.piston.y
    ) / timeStep ** 2;
    near(numericalVelocity, center.pistonVelocity, 5e-8,
      `plunger velocity at ${angle}`);
    near(numericalAcceleration, center.pistonAcceleration, 1e-6,
      `plunger acceleration at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 466 cumulative delivery counts only downward plunger strokes', () => {
  const { model } = movementModel();
  const {
    deliveredLengthAtStrokeAngle,
    geometry,
    pumpKinematics,
  } = model.root.userData;

  // Stroke 0 is Brown's pose: the lever on its plate slope at mid-stroke,
  // going down. Bottom at pi/2, top at 3pi/2, the next rest pose at 2pi.
  for (let cycle = 0; cycle < geometry.pumpCycleCount; cycle += 1) {
    const restAngle = cycle * FULL_TURN;
    const bottomAngle = restAngle + Math.PI / 2;
    const topAngle = restAngle + 1.5 * Math.PI;
    const nextRestAngle = restAngle + FULL_TURN;
    const lowerHalf = pumpKinematics(restAngle).piston.y
      - pumpKinematics(bottomAngle).piston.y;
    near(deliveredLengthAtStrokeAngle(
      restAngle,
      pumpKinematics(restAngle),
    ), cycle * geometry.pumpStrokeLength, 2e-11,
    `delivery at Brown's rest pose of cycle ${cycle}`);
    near(deliveredLengthAtStrokeAngle(
      bottomAngle,
      pumpKinematics(bottomAngle),
    ), cycle * geometry.pumpStrokeLength + lowerHalf, 2e-11,
    `delivery at bottom of cycle ${cycle}`);
    near(deliveredLengthAtStrokeAngle(
      topAngle,
      pumpKinematics(topAngle),
    ), cycle * geometry.pumpStrokeLength + lowerHalf, 2e-11,
    `suction return adds no delivery in cycle ${cycle}`);
    near(deliveredLengthAtStrokeAngle(
      nextRestAngle,
      pumpKinematics(nextRestAngle),
    ), (cycle + 1) * geometry.pumpStrokeLength, 2e-11,
    `delivery back at Brown's rest pose after cycle ${cycle}`);
  }
  near(geometry.maximumDeliveredVolume,
    geometry.pumpCycleCount * geometry.pumpPlungerArea
      * geometry.pumpStrokeLength,
    1e-12, 'twelve-stroke delivered volume');
  disposeModel(model.root);
});

test('movement 466 ram rise is exactly displaced pump volume divided by ram area and therefore trades travel for force', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;
  let previousVolume = -1;
  let previousLift = -1;

  for (let sample = 0; sample <= 380; sample += 1) {
    const phase = geometry.operationEndPhase * sample / 380;
    const state = stateAtPhase(phase);
    near(state.cumulativeDeliveredVolume,
      geometry.pumpPlungerArea * state.deliveredLength, 1e-12,
      `pump displacement at phase ${phase}`);
    near(state.retainedPressVolume,
      geometry.ramArea * state.ramLift, 1e-12,
      `large cylinder displacement at phase ${phase}`);
    near(state.volumeDisplacementResidual, 0, 1e-12,
      `volume closure at phase ${phase}`);
    assert.ok(state.retainedPressVolume >= previousVolume - 1e-12);
    assert.ok(state.ramLift >= previousLift - 1e-12);
    previousVolume = state.retainedPressVolume;
    previousLift = state.ramLift;
  }
  near(geometry.maximumRamLift,
    geometry.maximumDeliveredVolume / geometry.ramArea, 1e-12,
    'maximum inverse-area ram travel');
  near(geometry.maximumRamLift,
    geometry.pumpCycleCount * geometry.pumpStrokeLength
      / geometry.areaRatio,
    1e-12, 'travel reduction equals force multiplication');
  disposeModel(model.root);
});

test('movement 466 inlet, delivery, and relief valves expose only physically valid flow routes', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase, transmission } = model.root.userData;

  for (let sample = 1; sample < 760; sample += 1) {
    const phase = geometry.operationEndPhase * sample / 760;
    const state = stateAtPhase(phase);
    assert.ok(!(state.inletOpenAmount > 1e-12
      && state.deliveryOpenAmount > 1e-12));
    if (state.pistonVelocity > 1e-10) {
      assert.ok(state.inletOpenAmount > 0);
      near(state.deliveryOpenAmount, 0, 1e-12,
        `delivery seated on suction at ${phase}`);
      near(state.deliveryFlowRate, 0, 1e-12,
        `no press delivery on suction at ${phase}`);
    } else if (state.pistonVelocity < -1e-10) {
      assert.ok(state.deliveryOpenAmount > 0);
      near(state.inletOpenAmount, 0, 1e-12,
        `inlet seated on delivery at ${phase}`);
      near(state.suctionFlowRate, 0, 1e-12,
        `no suction on delivery at ${phase}`);
    }
    near(state.reliefOpenAmount, 0, 1e-12,
      `relief shut during pumping at ${phase}`);
  }
  const hold = stateAtPhase(0.80);
  near(hold.inletOpenAmount, 0, 1e-12, 'inlet seated on hold');
  near(hold.deliveryOpenAmount, 0, 1e-12, 'delivery seated on hold');
  near(hold.reliefOpenAmount, 0, 1e-12, 'relief seated on hold');
  const relief = stateAtPhase(0.92);
  assert.ok(relief.reliefOpenAmount > 0);
  near(relief.inletOpenAmount, 0, 1e-12, 'inlet seated on relief');
  near(relief.deliveryOpenAmount, 0, 1e-12, 'delivery seated on relief');
  assert.ok(relief.reliefReturnFlowRate > 0);
  assert.ok(relief.ramVelocity < 0);
  assert.match(transmission.volume, /A_pump\*sum/);
  disposeModel(model.root);
});

test('movement 466 analytic ram velocity matches finite-difference lift during delivery and relief', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;
  const timeStep = 1e-5;
  const samples = [];
  for (let index = 1; index < 900 && samples.length < 8; index += 1) {
    const phase = geometry.operationEndPhase * index / 900;
    const state = stateAtPhase(phase);
    if (state.ramVelocity > 0.004) samples.push(phase);
  }
  samples.push(0.89, 0.92, 0.96);
  for (const phase of samples) {
    const center = stateAtPhase(phase);
    const before = stateAtPhase(phase - timeStep / geometry.cycleDuration);
    const after = stateAtPhase(phase + timeStep / geometry.cycleDuration);
    const numericalVelocity = (after.ramLift - before.ramLift)
      / (2 * timeStep);
    near(numericalVelocity, center.ramVelocity, 3e-8,
      `ram velocity at phase ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 466 renderer follows the exact pump and ram states and closes after relief return', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  model.update(0);
  blocks.reservoirWater.updateMatrixWorld(true);
  const reservoirTop = new THREE.Box3().setFromObject(blocks.reservoirWater).max.y;
  const releaseClosedY = blocks.safetyValve.position.y;

  for (const phase of [0, 0.19, 0.38, 0.57, 0.80, 0.92, 1]) {
    const time = phase * geometry.cycleDuration;
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.pumpLever.rotation.z, state.leverAngle, 1e-12,
      `lever angle at phase ${phase}`);
    vectorNear(blocks.pumpCrosshead.position, state.crosshead, 1e-12,
      `crosshead at phase ${phase}`);
    vectorNear(blocks.pumpPiston.position, state.piston, 1e-12,
      `plunger at phase ${phase}`);
    vectorNear(blocks.pumpLever.position, state.fulcrum, 1e-12,
      `lever fulcrum rides the swing link at phase ${phase}`);
    near(blocks.ramAssembly.position.y, state.ramLift, 1e-12,
      `large ram lift at phase ${phase}`);
    near(blocks.compressibleLoad.scale.y,
      (geometry.initialLoadHeight - state.loadCompression)
        / geometry.initialLoadHeight,
      1e-12, `load compression at phase ${phase}`);
    // The inlet passage stands full; the cistern gives up exactly the water
    // pumped under the ram and gets it back through the lifted weighted valve.
    assert.equal(blocks.inletWater.visible, true);
    blocks.reservoirWater.updateMatrixWorld(true);
    const top = new THREE.Box3().setFromObject(blocks.reservoirWater).max.y;
    near(top, reservoirTop - state.retainedPressVolume / model.root.userData.cisternArea, 1e-6,
      `cistern level conserves water at phase ${phase}`);
    assert.ok(blocks.safetyValve.position.y - releaseClosedY >= -1e-12, `weighted valve seated or lifted at phase ${phase}`);
    if (state.reliefReturnFlowRate <= 0) near(blocks.safetyValve.position.y, releaseClosedY, 1e-12, `weighted valve shut while pumping at phase ${phase}`);
  }
  const closure = stateAtTime(geometry.cycleDuration);
  near(closure.phase, 0, 1e-12, 'cycle phase closure');
  near(closure.ramLift, 0, 1e-12, 'ram returns after relief');
  near(closure.retainedPressVolume, 0, 1e-12,
    'press volume returns to reservoir');
  disposeModel(model.root);
});

test('movement 466 has finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement466 = catalog.movements[465];
  const movement507 = catalog.movements[506];
  const model466 = createMovementModel(movement466);
  const model507 = createMovementModel(movement507);
  const fitBounds = model466.root.userData.cameraFitBounds;

  for (const phase of [0, 0.47, 0.80, 0.92]) {
    model466.update(phase * model466.root.userData.geometry.cycleDuration);
    model466.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model466.root);
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
  assert.equal(movement466.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model466.root);
  disposeModel(model507.root);
});

test('movement 466 starts on Brown’s lever slope and models his thin line as a pull-only cord to the ball', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtPhase, cordState } = model.root.userData;
  const rest = stateAtPhase(0);
  near(rest.leverAngle, geometry.pumpLeverRestAngle, 1e-12, 'lever on the plate slope at phase 0');
  assert.ok(rest.leverAngle < -0.2, 'the plate lever slopes down to the grip');
  near(rest.fulcrum.x, (315 - 262) / 72, 1e-9, 'fulcrum at the plate pin');
  near(rest.ramLift, 0, 1e-12, 'ram down at Brown’s pose');
  for (const phase of [0.80, 0.83, 0.999]) near(stateAtPhase(phase).leverAngle, geometry.pumpLeverRestAngle, 1e-9, `hold/let-down lever on plate slope at ${phase}`);
  let maximumSagWhilePumping = 0, maximumSag = 0;
  for (let i = 0; i <= 400; i += 1) {
    const phase = i / 400;
    model.update(phase * geometry.cycleDuration);
    const cord = cordState();
    assert.ok(cord.chord <= geometry.cordLength + 1e-12, `cord never stretched at ${phase}`);
    if (phase < geometry.operationEndPhase) maximumSagWhilePumping = Math.max(maximumSagWhilePumping, cord.sag);
    maximumSag = Math.max(maximumSag, cord.sag);
    const length = blocks.ballCord.geometry.attributes.position.count;
    assert.ok(length > 0);
  }
  assert.ok(geometry.cordSpreadWhilePumping < 0.01, `pin swing barely changes the span: ${geometry.cordSpreadWhilePumping}`);
  assert.ok(maximumSagWhilePumping < 0.08, `cord nearly taut while pumping: ${maximumSagWhilePumping}`);
  assert.ok(maximumSag > maximumSagWhilePumping, 'cord slackens when the ball is lifted');
  disposeModel(model.root);
});

test('movement 466 plunger and crosshead contrast with the orange lever; ram casting is finely swept (p109)', () => {
  const model = createMovementModel(catalog.movements[465]);
  const colors = new Map();
  model.root.traverse((o) => { if (o.isMesh && o.userData.role) colors.set(o.userData.role, [].concat(o.material)[0].color.getHex()); });
  assert.notEqual(colors.get('plunger-rod'), 0xde5a3f);
  assert.notEqual(colors.get('crosshead-block'), 0xde5a3f);
  let casting = null;
  model.root.traverse((o) => { if (!casting && o.userData.role === 'sectioned-ram-cylinder-casting') casting = o; });
  assert.ok(casting.geometry.attributes.position.count > 3000, 'ram casting swept with 80 steps over the half');
});
