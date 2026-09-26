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
  'single-acting-steam-hammer-with-pressure-raised-rigid-piston-rod-head-gravity-fall-exhaust-valve-and-anvil-impact';

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
  const movement = catalog.movements[469];
  return { model: createMovementModel(movement), movement };
}

test('movement 470 is a fixed upper cylinder with one rigid piston-rod-hammer assembly over a fixed anvil', () => {
  const { model, movement } = movementModel();
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 470);
  assert.equal(movement.number, '470');
  assert.equal(movement.title, 'Single-acting steam hammer');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.fixedCylinder.parent, model.root);
  assert.equal(blocks.movingAssembly.parent, model.root);
  assert.equal(blocks.piston.parent, blocks.movingAssembly);
  assert.equal(blocks.pistonRod.parent, blocks.movingAssembly);
  assert.equal(blocks.hammerHead.parent, blocks.movingAssembly);
  assert.equal(blocks.hammerFace.parent, blocks.movingAssembly);
  assert.equal(blocks.anvil.parent, model.root);
  assert.equal(blocks.anvilFace.parent, blocks.anvil);
  assert.equal(blocks.steamChamber.parent, model.root);
  assert.equal(blocks.valveSpool.parent, model.root);
  assert.equal(blocks.valvePitman.parent, model.root);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.movingAssemblyDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.cylinderTranslates, false);
  assert.equal(degreesOfFreedom.hammerAndPistonIndependent, false);
  assert.equal(degreesOfFreedom.valveScheduledFromSameCycle, true);
  disposeModel(model.root);
});

test('movement 470 source record preserves fixed cylinder, attached hammer, below-piston admission, exhaust, and unavailable animation', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.brownPlate470;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_470.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.plate, 'Brown 1868, Movement 470');
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(sourceAnimation.sourcePrescribedNormalizedTiming, false);
  assert.deepEqual(plate.approximateCylinderBoundsPixels,
    [233, 126, 112, 177]);
  assert.deepEqual(plate.approximateHammerBoundsPixels,
    [221, 269, 91, 144]);
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('cylinder is fixed above')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('hammer is attached')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('admitted below the piston')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('release lets it fall')));
  assert.match(evidence.engravingEvidence, /single straight piston rod/i);
  assert.match(evidence.reconstructionDisclosure, /160 kg rigid moving assembly/i);
  assert.match(evidence.reconstructionDisclosure, /ideal rigid impact/i);
  disposeModel(model.root);
});

test('movement 470 piston, rod, hammer head, and striking face preserve one exact rigid translation', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;
  const pistonToHammer = geometry.pistonBottomCenterY
    - geometry.hammerHeadBottomCenterY;
  const maximumHammerTopY = geometry.hammerHeadBottomCenterY
    + geometry.maximumLift + geometry.hammerHeadHeight / 2;
  const cylinderOuterBottomY = geometry.cylinderInnerBottomY - 0.09;
  assert.ok(maximumHammerTopY < cylinderOuterBottomY,
    'raised hammer head must remain below the fixed cylinder');

  for (const phase of [0, 0.12, 0.28, 0.46, 0.535, 0.59,
    geometry.impactPhase, 0.82]) {
    const state = stateAtPhase(phase);
    near(state.pistonCenterY - state.hammerHeadCenterY,
      pistonToHammer, 1e-12, `piston-to-hammer offset at ${phase}`);
    near(state.hammerFaceY,
      state.hammerHeadCenterY - geometry.hammerHeadHeight / 2,
      1e-12, `striking face offset at ${phase}`);
    near(state.pistonCenterY,
      geometry.pistonBottomCenterY + state.hammerLift,
      1e-12, `piston translation at ${phase}`);
    assert.ok(state.hammerFaceY >= geometry.anvilTopY - 1e-12,
      `hammer penetrates anvil at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 470 powered lift derivatives are analytic and steam force closes Newton’s law', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const timeStep = 1e-4;

  for (const phase of [0.12, 0.19, 0.28, 0.37, 0.44]) {
    const time = phase * geometry.cycleDuration;
    const center = stateAtTime(time);
    const before = stateAtTime(time - timeStep);
    const after = stateAtTime(time + timeStep);
    near((after.hammerLift - before.hammerLift) / (2 * timeStep),
      center.hammerVelocity, 2e-8,
      `lift velocity at ${phase}`);
    near((after.hammerLift - 2 * center.hammerLift + before.hammerLift)
      / timeStep ** 2,
    center.hammerAcceleration, 5e-7,
    `lift acceleration at ${phase}`);
    near(center.pressureForce - center.weightForce,
      geometry.movingMassKilogram * center.hammerAcceleration,
      2e-10, `lift force balance at ${phase}`);
    near(center.unconstrainedForceResidual, 0, 2e-10,
      `lift residual at ${phase}`);
    assert.ok(center.gaugePressure > 0);
    assert.equal(center.admissionOpening, 1);
    assert.equal(center.exhaustOpening, 0);
  }
  disposeModel(model.root);
});

test('movement 470 exhaust release integrates smoothly into exact constant-gravity free fall', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase, stateAtTime } = model.root.userData;
  const releaseEnd = stateAtPhase(geometry.releaseEndPhase);

  near(geometry.releaseDrop,
    geometry.gravity * geometry.releaseDuration ** 2 / 7,
    1e-14, 'integrated release drop');
  near(geometry.releaseEndDownwardSpeed,
    geometry.gravity * geometry.releaseDuration / 2,
    1e-14, 'integrated release speed');
  near(releaseEnd.hammerLift,
    geometry.maximumLift - geometry.releaseDrop, 1e-12,
    'release-end lift');
  near(releaseEnd.hammerVelocity,
    -geometry.releaseEndDownwardSpeed, 1e-12,
    'release-end velocity');
  near(releaseEnd.hammerAcceleration, -geometry.gravity, 1e-12,
    'release-end acceleration');
  near(releaseEnd.gaugePressure, 0, 1e-12,
    'release-end pressure');

  const timeStep = 1e-4;
  for (const phase of [geometry.releaseEndPhase + 0.01, 0.59, 0.62,
    geometry.impactPhase - 0.004]) {
    const time = phase * geometry.cycleDuration;
    const center = stateAtTime(time);
    const before = stateAtTime(time - timeStep);
    const after = stateAtTime(time + timeStep);
    near(center.hammerAcceleration, -geometry.gravity, 1e-12,
      `gravity acceleration at ${phase}`);
    near((after.hammerLift - before.hammerLift) / (2 * timeStep),
      center.hammerVelocity, 2e-9,
      `fall velocity at ${phase}`);
    near((after.hammerLift - 2 * center.hammerLift + before.hammerLift)
      / timeStep ** 2,
    -geometry.gravity, 1e-6,
    `fall acceleration at ${phase}`);
    near(center.unconstrainedForceResidual, 0, 1e-12,
      `fall force residual at ${phase}`);
    assert.equal(center.exhaustOpening, 1);
    assert.equal(center.admissionOpening, 0);
  }
  disposeModel(model.root);
});

test('movement 470 ballistic solution reaches exact anvil contact with the recorded physical impact speed and impulse', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;
  const epsilon = 1e-9;
  const immediatelyBefore = stateAtPhase(geometry.impactPhase - epsilon);
  const impact = stateAtPhase(geometry.impactPhase);

  near(immediatelyBefore.hammerFaceY, geometry.anvilTopY,
    3e-8, 'pre-impact face contact');
  near(immediatelyBefore.hammerVelocity, -geometry.impactSpeed,
    6e-8, 'pre-impact speed');
  near(impact.hammerFaceY, geometry.anvilTopY, 1e-12,
    'impact contact');
  near(impact.hammerVelocity, 0, 1e-12,
    'post-impact rigid stop');
  near(geometry.impactKineticEnergyJoule,
    0.5 * geometry.movingMassKilogram * geometry.impactSpeed ** 2,
    1e-12, 'impact kinetic energy');
  near(geometry.impactImpulseNewtonSecond,
    geometry.movingMassKilogram * geometry.impactSpeed,
    1e-12, 'impact impulse');
  assert.match(impact.regime, /contact-impulse/i);
  assert.ok(impact.anvilReaction > 0);
  disposeModel(model.root);
});

test('movement 470 hand lever, long valve rod, top rocker, spindle link and vertical spool maintain exact linkage closure', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase, valveKinematics } = model.root.userData;
  const spoolYs = [];

  for (const command of [-1, -0.73, -0.22, 0, 0.41, 0.86, 1]) {
    const valve = valveKinematics(command);
    near(valve.crankPin.distanceTo(geometry.handLeverPivot.clone().setZ(valve.crankPin.z)),
      geometry.handLeverRodArm, 2e-12, `hand lever arm at command ${command}`);
    near(valve.crankPin.distanceTo(valve.rockerRightPin),
      geometry.valvePitmanLength, 2e-12,
      `long valve rod length at command ${command}`);
    const fulcrum = geometry.rockerFulcrum.clone().setZ(valve.rockerLeftPin.z);
    near(valve.rockerRightPin.distanceTo(fulcrum), geometry.rockerRightArm, 2e-12,
      `rocker right arm at command ${command}`);
    near(valve.rockerLeftPin.distanceTo(fulcrum), geometry.rockerLeftArm, 2e-12,
      `rocker left arm at command ${command}`);
    near(valve.rockerLeftPin.distanceTo(valve.spindlePin), geometry.spindleLinkLength, 2e-12,
      `spindle link length at command ${command}`);
    near(valve.spoolPin.x, geometry.valveSpindleX, 1e-12,
      `vertical spool axis at command ${command}`);
    // The long rod hangs near-vertical from the rocker to the hand lever.
    assert.ok(Math.abs(valve.rockerRightPin.x - valve.crankPin.x) < 0.1);
    assert.ok(valve.rockerRightPin.y - valve.crankPin.y > 2.5);
    spoolYs.push(valve.spoolPin.y);
    // Brown's sliding handle post: its pin lies on the lever's axis, within
    // the lever-end slot, and the post stays on its vertical line.
    const pin = valve.handlePostPin;
    near(pin.x, geometry.handlePostX, 1e-12, `handle post line at command ${command}`);
    const along = Math.hypot(pin.x - geometry.handLeverPivot.x, pin.y - geometry.handLeverPivot.y);
    near(Math.atan2(pin.y - geometry.handLeverPivot.y, pin.x - geometry.handLeverPivot.x),
      valve.crankAngle, 1e-12, `post pin on the lever axis at command ${command}`);
    assert.ok(along >= geometry.handLeverHandleArm - 1e-12
      && along <= geometry.handLeverHandleArm / Math.cos(geometry.valveAngleAmplitude) + 1e-12);
  }
  // Brown's broad cylinder and slender uprights leave a short spool stroke.
  assert.ok(Math.max(...spoolYs) - Math.min(...spoolYs) > 0.1, 'the spool strokes');

  for (const phase of [0, 0.03, 0.08, 0.30, 0.50, 0.54, 0.58, 0.80]) {
    const state = stateAtPhase(phase);
    near(state.admissionOpening + state.exhaustOpening, 1, 1e-12,
      `complementary valve ports at ${phase}`);
    near(state.valve.command, state.valveCommand, 1e-12,
      `valve command at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 470 pressure chamber volume follows piston position and contains pressure only below the piston', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;

  for (const phase of [0, 0.08, 0.18, 0.34, 0.46, 0.53, 0.56,
    0.61, geometry.impactPhase, 0.90]) {
    const state = stateAtPhase(phase);
    near(state.steamChamberHeight,
      state.pistonCenterY - geometry.pistonThickness / 2
        - geometry.cylinderInnerBottomY,
      1e-12, `chamber height at ${phase}`);
    near(state.steamChamberVolume,
      geometry.pistonArea * state.steamChamberHeight,
      1e-12, `chamber volume at ${phase}`);
    near(state.pressureForce,
      state.gaugePressure * geometry.pistonArea,
      1e-12, `pressure force at ${phase}`);
    assert.ok(state.steamChamberHeight > 0);
  }
  disposeModel(model.root);
});

test('movement 470 renderer moves only the rigid assembly and maps valve, chamber, and linkage states', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtPhase } = model.root.userData;
  const cylinderPosition = blocks.fixedCylinder.position.clone();
  const anvilPosition = blocks.anvil.position.clone();

  for (const phase of [0, 0.17, 0.36, 0.48, 0.535, 0.59,
    geometry.impactPhase, 0.88]) {
    const state = stateAtPhase(phase);
    model.update(phase * geometry.cycleDuration);
    near(blocks.movingAssembly.position.y, state.hammerLift, 1e-12,
      `moving assembly at ${phase}`);
    vectorNear(blocks.fixedCylinder.position, cylinderPosition, 1e-12,
      `fixed cylinder at ${phase}`);
    vectorNear(blocks.anvil.position, anvilPosition, 1e-12,
      `fixed anvil at ${phase}`);
    near(blocks.steamChamber.scale.y,
      state.steamChamberHeight, 1e-12,
      `steam chamber height at ${phase}`);
    near(blocks.valveLever.rotation.z, state.valve.crankAngle, 1e-12,
      `valve lever at ${phase}`);
    vectorNear(blocks.valveSpool.position, state.valve.spoolPin, 1e-12,
      `valve spool at ${phase}`);
    near(blocks.valveRocker.rotation.z, state.valve.rockerAngle, 1e-12,
      `valve rocker at ${phase}`);
    near(blocks.valvePitman.userData.length, geometry.valvePitmanLength, 0,
      `valve rod at ${phase}`);
    blocks.valvePitman.updateMatrixWorld(true);
    const farEye = new THREE.Vector3(geometry.valvePitmanLength, 0, 0)
      .applyMatrix4(blocks.valvePitman.matrixWorld);
    near(Math.hypot(farEye.x - state.valve.rockerRightPin.x, farEye.y - state.valve.rockerRightPin.y),
      0, 2e-12, `bored valve rod upper eye on rocker pin at ${phase}`);
    near(Math.hypot(blocks.valvePitman.position.x - state.valve.crankPin.x,
      blocks.valvePitman.position.y - state.valve.crankPin.y), 0, 2e-12,
    `bored valve rod lower eye on hand-lever pin at ${phase}`);
    blocks.spindleLink.updateMatrixWorld(true);
    const linkTop = new THREE.Vector3(geometry.spindleLinkLength, 0, 0)
      .applyMatrix4(blocks.spindleLink.matrixWorld);
    near(Math.hypot(linkTop.x - state.valve.rockerLeftPin.x, linkTop.y - state.valve.rockerLeftPin.y),
      0, 2e-12, `spindle link on rocker pin at ${phase}`);
    assert.equal(blocks.steamChamber.visible, state.steamVisible);
  }
  disposeModel(model.root);
});

test('movement 470 non-impact transitions are C2 while the one impact velocity jump remains explicit', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;
  const boundaries = [
    0,
    geometry.liftStartPhase,
    geometry.liftEndPhase,
    geometry.topHoldEndPhase,
    geometry.releaseEndPhase,
  ];
  const step = 1e-6;

  for (const boundary of boundaries) {
    const minus = stateAtPhase(boundary - step);
    const center = stateAtPhase(boundary);
    const plus = stateAtPhase(boundary + step);
    near(minus.hammerLift, center.hammerLift, 1e-5,
      `left position at ${boundary}`);
    near(plus.hammerLift, center.hammerLift, 1e-5,
      `right position at ${boundary}`);
    near(minus.hammerVelocity, center.hammerVelocity, 1e-4,
      `left velocity at ${boundary}`);
    near(plus.hammerVelocity, center.hammerVelocity, 1e-4,
      `right velocity at ${boundary}`);
    near(minus.hammerAcceleration, center.hammerAcceleration, 0.001,
      `left acceleration at ${boundary}`);
    near(plus.hammerAcceleration, center.hammerAcceleration, 0.001,
      `right acceleration at ${boundary}`);
  }

  const preImpact = stateAtPhase(geometry.impactPhase - step);
  const impact = stateAtPhase(geometry.impactPhase);
  near(preImpact.hammerLift, impact.hammerLift, 4e-5,
    'impact position remains continuous');
  assert.ok(Math.abs(preImpact.hammerVelocity - impact.hammerVelocity)
    > geometry.impactSpeed * 0.99,
    'impact deliberately removes downward velocity');
  disposeModel(model.root);
});

test('movement 470 has finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement470 = catalog.movements[469];
  const movement507 = catalog.movements[506];
  const model470 = createMovementModel(movement470);
  const model507 = createMovementModel(movement507);
  const fitBounds = model470.root.userData.cameraFitBounds;

  for (const phase of [0, 0.16, 0.34, 0.48, 0.55, 0.61,
    model470.root.userData.geometry.impactPhase, 0.88]) {
    model470.update(phase * model470.root.userData.geometry.cycleDuration);
    model470.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model470.root);
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
  assert.equal(movement470.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model470.root);
  disposeModel(model507.root);
});
