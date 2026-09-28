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
  'hotchkiss-atmospheric-hammer-with-crank-reciprocated-cylinder-free-hammer-piston-alternating-polytropic-air-cushions-and-post-bottom-center-blow';

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

function movementModel() {
  const movement = catalog.movements[470];
  return { model: createMovementModel(movement), movement };
}

test('movement 471 separates the crank-driven cylinder from the free piston-rod-hammer assembly', () => {
  const { model, movement } = movementModel();
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 471);
  assert.equal(movement.number, '471');
  assert.match(movement.title, /Hotchkiss.*atmospheric hammer/i);
  assert.equal(movement.category, 'Pumps & pneumatics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.crankAssembly.parent, model.root);
  // Crank pin A ends 0.01 inside the crank arm, not flush with its back face.
  {
    const arm = blocks.crankAssembly.children.find((o) => o.geometry?.type === 'BoxGeometry');
    const side = Math.sign(arm.position.z);
    const armOuter = arm.position.z + side * arm.geometry.parameters.depth / 2;
    const pin = blocks.crankPinVisual;
    const pinEnd = pin.position.z + side * pin.geometry.parameters.height / 2;
    assert.ok(Math.abs(pinEnd - (armOuter - side * 0.01)) < 1e-9);
  }
  assert.equal(blocks.movingCylinder.parent, model.root);
  assert.equal(blocks.cylinderShell.parent, blocks.movingCylinder);
  assert.equal(blocks.hammerAssembly.parent, model.root);
  assert.equal(blocks.piston.parent, blocks.hammerAssembly);
  assert.equal(blocks.pistonRod.parent, blocks.hammerAssembly);
  assert.equal(blocks.hammerHead.parent, blocks.hammerAssembly);
  assert.equal(blocks.connectingRod.parent, model.root);
  assert.equal(blocks.atmosphericPort.parent, blocks.movingCylinder);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.physicalOperatingDegreesOfFreedom, 2);
  assert.equal(degreesOfFreedom.crankAndCylinderIndependent, false);
  assert.equal(degreesOfFreedom.cylinderAndHammerPistonIndependent, true);
  assert.equal(degreesOfFreedom.pistonAndHammerIndependent, false);
  disposeModel(model.root);
});

test('movement 471 source record preserves Hotchkiss crank, rod, moving cylinder, port e, and alternating air charges', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.brownPlate471;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_471.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.plate, 'Brown 1868, Movement 471');
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(sourceAnimation.sourcePrescribedNormalizedTiming, false);
  assert.deepEqual(plate.approximateCylinderBBoundsPixels,
    [222, 79, 81, 183]);
  assert.deepEqual(plate.approximateHammerCBoundsPixels,
    [221, 304, 84, 61]);
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('piston fitted inside cylinder B')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('rod D to crank A')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('compressed below the piston')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('compressed above the piston')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('after crank and rod pass bottom center')));
  assert.match(evidence.engravingEvidence, /side hole e/i);
  assert.match(evidence.reconstructionDisclosure,
    /prescribed free-hammer trajectory/i);
  disposeModel(model.root);
});

test('movement 471 crank A and rod D close an exact in-line slider-crank for moving cylinder B', () => {
  const { model } = movementModel();
  const { crankKinematics, geometry } = model.root.userData;

  for (const phase of [0, 0.07, 0.19, 0.34, 0.5, 0.67, 0.83, 0.96]) {
    const state = crankKinematics(phase);
    near(state.crankPin.distanceTo(state.cylinderDrivePin),
      geometry.connectingRodLength, 2e-12,
      `connecting-rod closure at ${phase}`);
    near(state.cylinderDrivePin.x, geometry.cylinderAxisX, 1e-12,
      `cylinder guide axis at ${phase}`);
    near(state.cylinderCenterY - state.cylinderDrivePin.y,
      geometry.cylinderDriveAttachmentOffsetY, 1e-12,
      `cylinder lug offset at ${phase}`);
  }

  near(crankKinematics(0).cylinderCenterY,
    geometry.cylinderBottomCenterY, 1e-12, 'bottom-center cylinder datum');
  near(crankKinematics(0.5).cylinderCenterY,
    geometry.cylinderBottomCenterY + 2 * geometry.crankRadius,
    1e-12, 'top-center cylinder datum');
  for (let index = 0; index <= 400; index += 1) {
    const centerY = crankKinematics(index / 400).cylinderCenterY;
    assert.ok(centerY >= geometry.cylinderBottomCenterY - 1e-12);
    assert.ok(centerY <= geometry.cylinderBottomCenterY
      + 2 * geometry.crankRadius + 1e-12);
  }
  disposeModel(model.root);
});

test('movement 471 cylinder velocity and acceleration are analytic derivatives of its exact slider-crank position', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const timeStep = 1e-4;

  for (const phase of [0.07, 0.18, 0.32, 0.46, 0.63, 0.78, 0.91]) {
    const time = phase * geometry.cycleDuration;
    const center = stateAtTime(time).crank;
    const before = stateAtTime(time - timeStep).crank;
    const after = stateAtTime(time + timeStep).crank;
    near((after.cylinderCenterY - before.cylinderCenterY)
      / (2 * timeStep), center.cylinderVelocity, 5e-8,
    `cylinder velocity at ${phase}`);
    near((after.cylinderCenterY - 2 * center.cylinderCenterY
      + before.cylinderCenterY) / timeStep ** 2,
    center.cylinderAcceleration, 3e-7,
    `cylinder acceleration at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 471 rigid piston-rod-hammer reaches the anvil with finite impact speed after bottom center', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;
  const pistonToHeadOffset = geometry.pistonContactCenterY
    - geometry.hammerHeadContactCenterY;

  for (const phase of [0, 0.04, 0.10, geometry.hammerImpactPhase,
    0.25, 0.5, geometry.upperAirSealPhase, 0.82]) {
    const state = stateAtPhase(phase);
    near(state.hammer.pistonCenterY - state.hammer.hammerHeadCenterY,
      pistonToHeadOffset, 1e-12,
      `rigid piston-to-hammer offset at ${phase}`);
    near(state.hammer.hammerFaceY,
      state.hammer.hammerHeadCenterY - geometry.hammerHeadHeight / 2,
      1e-12, `hammer-face offset at ${phase}`);
    assert.ok(state.hammer.hammerFaceY >= geometry.anvilTopY - 1e-12,
      `hammer penetrates anvil at ${phase}`);
  }

  const epsilon = 1e-9;
  const beforeImpact = stateAtPhase(geometry.hammerImpactPhase - epsilon);
  const impact = stateAtPhase(geometry.hammerImpactPhase);
  near(beforeImpact.hammer.hammerFaceY, geometry.anvilTopY,
    8e-9, 'pre-impact face contact');
  near(beforeImpact.hammer.velocity, -geometry.impactSpeed,
    2e-8, 'pre-impact downward speed');
  near(impact.hammer.hammerFaceY, geometry.anvilTopY,
    1e-12, 'impact face contact');
  near(impact.hammer.velocity, 0, 1e-12,
    'impact collision stops the hammer');
  near(geometry.impactKineticEnergyJoule,
    0.5 * geometry.movingHammerMassKilogram * geometry.impactSpeed ** 2,
    1e-12, 'impact kinetic energy');
  near(geometry.impactImpulseNewtonSecond,
    geometry.movingHammerMassKilogram * geometry.impactSpeed,
    1e-12, 'impact impulse');
  assert.ok(geometry.hammerImpactPhase > 0,
    'the blow must occur after crank bottom center');
  assert.match(impact.hammer.regime, /strikes-anvil/i);
  disposeModel(model.root);
});

test('movement 471 two chamber volumes follow independent cylinder and piston coordinates without overlap', () => {
  const { model } = movementModel();
  const { chamberGeometryAtPhase, geometry } = model.root.userData;

  for (let index = 0; index <= 400; index += 1) {
    const phase = index / 400;
    const chamber = chamberGeometryAtPhase(phase);
    near(chamber.lowerChamberHeight + geometry.pistonThickness
      + chamber.upperChamberHeight,
    2 * geometry.cylinderHalfChamberHeight, 2e-12,
    `partitioned cylinder height at ${phase}`);
    near(chamber.lowerChamberVolume,
      geometry.pistonArea * chamber.lowerChamberHeight,
      1e-12, `lower volume at ${phase}`);
    near(chamber.upperChamberVolume,
      geometry.pistonArea * chamber.upperChamberHeight,
      1e-12, `upper volume at ${phase}`);
    assert.ok(chamber.lowerChamberHeight > 0,
      `positive lower clearance at ${phase}`);
    assert.ok(chamber.upperChamberHeight > 0,
      `positive upper clearance at ${phase}`);
  }

  const topCenter = chamberGeometryAtPhase(0.5);
  const intake = chamberGeometryAtPhase(0.58);
  near(topCenter.hammer.lift, intake.hammer.lift, 1e-12,
    'hammer top dwell');
  assert.notEqual(topCenter.crank.cylinderCenterY,
    intake.crank.cylinderCenterY,
    'moving cylinder remains independent during hammer dwell');
  disposeModel(model.root);
});

test('movement 471 lower air lifts on ascent and stored upper air drives the post-bottom-center blow', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;
  const atmosphere = geometry.atmosphericPressurePascal;
  const lowerCompression = stateAtPhase(0.25);
  const upperCompression = stateAtPhase(0.82);
  const bottomCenter = stateAtPhase(0);
  const afterBottomCenter = stateAtPhase(0.03);
  const exhaustedUpperCharge = stateAtPhase(0.119);

  assert.ok(lowerCompression.lowerPressurePascal > atmosphere);
  near(lowerCompression.upperPressurePascal, atmosphere, 1e-9,
    'upper chamber atmospheric during lower lift');
  assert.ok(lowerCompression.pneumaticForce > 0,
    'lower compressed air supplies upward force');
  assert.ok(upperCompression.upperPressurePascal > atmosphere);
  near(upperCompression.lowerPressurePascal, atmosphere, 1e-9,
    'lower chamber atmospheric during upper compression');
  assert.ok(upperCompression.pneumaticForce < 0,
    'upper compressed air supplies downward force');
  assert.ok(bottomCenter.upperPressurePascal > atmosphere);
  assert.ok(afterBottomCenter.upperPressurePascal > atmosphere);
  assert.ok(afterBottomCenter.upperPressurePascal
    < bottomCenter.upperPressurePascal,
  'stored upper charge expands after bottom center');
  assert.ok(afterBottomCenter.hammer.velocity < 0);
  near(exhaustedUpperCharge.upperPressurePascal, atmosphere, 1e-9,
    'port e prevents sub-atmospheric upper pressure');
  assert.match(exhaustedUpperCharge.upperChamberMode,
    /port-e-admits-atmospheric-air/i);
  assert.ok(geometry.storedUpperAirEnergyJoule > 0);
  disposeModel(model.root);
});

test('movement 471 sealed lower and upper air charges obey exact polytropic invariants and vent at atmosphere', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;

  for (const phase of [0.12, 0.16, 0.25, 0.35, 0.44]) {
    const state = stateAtPhase(phase);
    assert.match(state.lowerChamberMode, /^sealed-lower/);
    near(state.lowerPressurePascal
      * state.lowerChamberVolume ** geometry.polytropicExponent,
    geometry.lowerPolytropicConstant, 2e-11,
    `lower P-V invariant at ${phase}`);
    near(state.lowerPolytropicResidual, 0, 2e-11,
      `lower recorded residual at ${phase}`);
  }
  for (const phase of [0.62, 0.70, 0.82, 0.95, 0, 0.03]) {
    const state = stateAtPhase(phase);
    assert.match(state.upperChamberMode, /^sealed-upper/);
    near(state.upperPressurePascal
      * state.upperChamberVolume ** geometry.polytropicExponent,
    geometry.upperPolytropicConstant, 2e-11,
    `upper P-V invariant at ${phase}`);
    near(state.upperPolytropicResidual, 0, 2e-11,
      `upper recorded residual at ${phase}`);
  }
  for (const phase of [0.119, 0.50, 0.56]) {
    const state = stateAtPhase(phase);
    near(state.upperPressurePascal,
      geometry.atmosphericPressurePascal, 1e-9,
      `vented upper pressure at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 471 upper-air state and hammer descent remain continuous across crank bottom center', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;
  const step = 1e-7;
  const before = stateAtPhase(1 - step);
  const center = stateAtPhase(0);
  const after = stateAtPhase(step);

  for (const state of [before, center, after]) {
    assert.match(state.upperChamberMode, /^sealed-upper/);
    near(state.upperPressurePascal
      * state.upperChamberVolume ** geometry.polytropicExponent,
    geometry.upperPolytropicConstant, 2e-11,
    'same upper charge crosses bottom center');
  }
  near(before.hammer.lift, center.hammer.lift, 1e-6,
    'left hammer position at bottom center');
  near(after.hammer.lift, center.hammer.lift, 1e-6,
    'right hammer position at bottom center');
  near(before.hammer.velocity, center.hammer.velocity, 1e-5,
    'left hammer velocity at bottom center');
  near(after.hammer.velocity, center.hammer.velocity, 1e-5,
    'right hammer velocity at bottom center');
  near(before.hammer.acceleration, center.hammer.acceleration, 1e-5,
    'left hammer acceleration at bottom center');
  near(after.hammer.acceleration, center.hammer.acceleration, 1e-5,
    'right hammer acceleration at bottom center');
  assert.match(before.hammer.regime, /compresses-and-stores/i);
  assert.match(after.hammer.regime, /expands-after-bottom-center/i);
  disposeModel(model.root);
});

test('movement 471 renderer maps crank, independent moving bodies, chambers, and exact rod D endpoints', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtPhase } = model.root.userData;

  for (const phase of [0, 0.12, 0.25, 0.5, 0.62, 0.82, 0.96]) {
    const state = stateAtPhase(phase);
    model.update(phase * geometry.cycleDuration);
    near(blocks.crankAssembly.rotation.z, state.crank.crankAngle,
      1e-12, `crank angle at ${phase}`);
    near(blocks.movingCylinder.position.x, geometry.cylinderAxisX,
      1e-12, `cylinder x at ${phase}`);
    near(blocks.movingCylinder.position.y, state.crank.cylinderCenterY,
      1e-12, `cylinder y at ${phase}`);
    near(blocks.hammerAssembly.position.x, geometry.cylinderAxisX,
      1e-12, `hammer x at ${phase}`);
    near(blocks.hammerAssembly.position.y, state.hammer.pistonCenterY,
      1e-12, `hammer y at ${phase}`);
    near(blocks.lowerAirChamber.scale.y, state.lowerChamberHeight,
      1e-12, `lower chamber scale at ${phase}`);
    near(blocks.upperAirChamber.scale.y, state.upperChamberHeight,
      1e-12, `upper chamber scale at ${phase}`);
    near(blocks.connectingRod.scale.y, geometry.connectingRodLength,
      2e-12, `rod D length at ${phase}`);

    const rodDirection = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(blocks.connectingRod.quaternion);
    const halfRod = rodDirection.multiplyScalar(
      geometry.connectingRodLength / 2,
    );
    const firstEnd = blocks.connectingRod.position.clone().sub(halfRod);
    const secondEnd = blocks.connectingRod.position.clone().add(halfRod);
    const directError = firstEnd.distanceTo(state.crank.crankPin)
      + secondEnd.distanceTo(state.crank.cylinderDrivePin);
    const reversedError = secondEnd.distanceTo(state.crank.crankPin)
      + firstEnd.distanceTo(state.crank.cylinderDrivePin);
    near(Math.min(directError, reversedError), 0, 3e-12,
      `rendered rod D endpoints at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 471 non-impact hammer transitions are C2 and its one impact velocity jump is explicit', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;
  const step = 1e-6;

  for (const boundary of [0, geometry.cylinderTopCenterPhase,
    geometry.upperAirSealPhase]) {
    const minus = stateAtPhase(boundary - step).hammer;
    const center = stateAtPhase(boundary).hammer;
    const plus = stateAtPhase(boundary + step).hammer;
    near(minus.lift, center.lift, 1e-5,
      `left position at ${boundary}`);
    near(plus.lift, center.lift, 1e-5,
      `right position at ${boundary}`);
    near(minus.velocity, center.velocity, 1e-4,
      `left velocity at ${boundary}`);
    near(plus.velocity, center.velocity, 1e-4,
      `right velocity at ${boundary}`);
    near(minus.acceleration, center.acceleration, 0.002,
      `left acceleration at ${boundary}`);
    near(plus.acceleration, center.acceleration, 0.002,
      `right acceleration at ${boundary}`);
  }

  const beforeImpact = stateAtPhase(geometry.hammerImpactPhase - step).hammer;
  const impact = stateAtPhase(geometry.hammerImpactPhase).hammer;
  const afterImpact = stateAtPhase(geometry.hammerImpactPhase + step).hammer;
  near(beforeImpact.lift, impact.lift, 8e-6,
    'impact position continuous from descent');
  near(afterImpact.lift, impact.lift, 8e-6,
    'impact position continuous into lift');
  assert.ok(Math.abs(beforeImpact.velocity - impact.velocity)
    > geometry.impactSpeed * 0.99,
  'impact deliberately removes downward velocity');
  near(afterImpact.velocity, impact.velocity, 1e-5,
    'lower-air lift begins from rest');
  disposeModel(model.root);
});

test('movement 471 has finite fitted render bounds and movement 507 remains the next authored frontier', () => {
  const movement471 = catalog.movements[470];
  const movement507 = catalog.movements[506];
  const model471 = createMovementModel(movement471);
  const model507 = createMovementModel(movement507);
  const fitBounds = model471.root.userData.cameraFitBounds;

  for (const phase of [0, 0.12, 0.25, 0.5, 0.62, 0.82, 0.96]) {
    model471.update(phase * model471.root.userData.geometry.cycleDuration);
    model471.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model471.root);
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
  assert.equal(movement471.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model471.root);
  disposeModel(model507.root);
});

test('movement 471 cylinder B is see-through so the dotted crank A, rod D and piston show', () => {
  const model = createMovementModel(catalog.movements[470]);
  const roles = new Map();
  model.root.traverse((object) => { if (object.isMesh) roles.set(object.userData.role, object); });
  for (const role of ['front-cutaway-moving-cylinder-shell-B', 'bored-lower-cylinder-head', 'closed-upper-cylinder-head']) {
    assert.ok(roles.get(role)?.userData.seeThrough, `${role} is see-through`);
  }
  for (const role of ['crank-A-disk', 'constant-length-connecting-rod-D', 'free-air-piston']) {
    const mesh = roles.get(role);
    assert.ok(mesh && mesh.visible && !mesh.userData.seeThrough, `${role} is shown solid`);
  }
  disposeModel(model.root);
});
