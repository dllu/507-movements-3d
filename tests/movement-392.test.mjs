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

test('movement 392 is one crank-driven ungated saw, two fixed guide pairs, and one upper tension spring', () => {
  const movement = catalog.movements[391];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 392);
  assert.equal(movement.number, '392');
  assert.equal(movement.category, 'Cranks & reciprocation');
  assert.equal(
    movement.archetype,
    'crank-driven-ungated-gig-saw-with-tangent-flexing-upper-tension-spring',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-uniform-crank/);
  assert.match(data.mechanism, /one-straight-toothed-gig-saw-blade/);
  assert.match(data.mechanism, /two-fixed-open-guide-pairs/);
  assert.match(data.mechanism, /one-flexing-upper-leaf-spring/);
  assert.match(data.mechanism, /without-a-moving-gate/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.inputs[0], /crankshaft angle/);

  for (const component of [
    blocks.connectingRod,
    blocks.crankRotor,
    blocks.flexingSpring,
    blocks.frame,
    blocks.sawAssembly,
    blocks.springFixedBoss,
  ]) assert.equal(component.parent, model.root);
  assert.equal(blocks.guideRails.length, 4);
  assert.equal(blocks.tableParts.length, 2);
  assert.equal(blocks.sawAssembly.userData.sawTeeth.length, 30);
  assert.equal(blocks.flexingSpring.userData.segments.length, 36);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'uniformly-rotating-gig-saw-crank-flywheel',
    'constant-length-crank-pin-to-vertical-saw-wrist-connecting-rod',
    'single-rigid-reciprocating-gig-saw-blade-and-two-guide-blocks',
    'straight-vertical-gig-saw-blade',
    'one-cutting-tooth-on-ungated-gig-saw-blade',
    'single-flexing-upper-leaf-spring-maintaining-blade-tension',
    'fixed-right-hand-anchor-of-leaf-spring',
  ]) assert.ok(roles.includes(role), role);
  // Brown draws no white indices; the source presentation detaches them.
  assert.ok(!roles.some((role) => /^white-/.test(role)), 'no white indices remain');
  disposeModel(model.root);
});

test('movement 392 preserves the official canvas construction and source proportions', () => {
  const movement = catalog.movements[391];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const canvas = sourceReference.canvasModel392;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_392.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /lower end connected with a crank/);
  assert.match(movement.description, /upper end connected with a spring/);
  assert.match(movement.description, /strained without a gate/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourceCanvasRotationsPerPanelCycle, 2);
  assert.equal(sourceAnimation.sourceSliderSolution,
    'upper circle-line intersection');
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);

  assert.equal(canvas.crankWheelRadius, 4);
  assert.equal(canvas.crankRadius, 2.5);
  assert.deepEqual(canvas.crankPinAtZero, [-2.5, 0]);
  assert.deepEqual(canvas.wristAtZero, [0, 7.27988]);
  assert.deepEqual(canvas.sliderLine, [[0, 4], [0, 24]]);
  assert.equal(canvas.tableY, 12.15488);
  assert.deepEqual(canvas.sawBladeLocalYRange, [1, 8.75]);
  assert.deepEqual(canvas.lowerGuideYRange, [5.02988, 11.02988]);
  assert.deepEqual(canvas.upperGuideYRange, [14.27988, 20.27988]);
  assert.equal(canvas.springMovingEndLocalY, 15.582695);
  assert.deepEqual(canvas.springBendCenter, [11.121157, 13.17988]);
  assert.equal(canvas.springBendRadius, 13);
  assert.deepEqual(canvas.springFixedEnd, [13.121157, 26.12988]);
  assert.deepEqual(canvas.modelViewport,
    [-14.270615, -5.166375, 33, 33]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence, /slotted table/);
  assert.match(evidence.reconstructionDisclosure, /official canvas construction/);
  assert.match(evidence.reconstructionDisclosure, /independently re-solves/);
  disposeModel(model.root);
});

test('movement 392 solves the source crank circle and vertical slider with exact rod closure', () => {
  const model = createMovementModel(catalog.movements[391]);
  const data = model.root.userData;
  const { geometry, motion, stateAtTime, timeline, transmission } = data;

  assert.match(motion.sliderLaw, /sqrt\(L\^2-r\^2\*cos/);
  assert.match(transmission.crankSliderLaw, /L\^2=/);
  near(data.constraintResiduals.sourceInitialRodClosure, 0, 8e-15,
    'source initial rod closure');
  near(data.constraintResiduals.sliderStroke, 0, 0,
    'slider stroke closure');
  near(geometry.sliderStroke, 2 * geometry.crankRadius, 0,
    'exact two-radius stroke');

  for (let sample = -12000; sample <= 24000; sample += 1) {
    const time = timeline.cycleDuration * sample / 12000;
    const state = stateAtTime(time);
    near(state.wrist.x, 0, 0, 'wrist stays on slider line');
    near(state.rodLength, geometry.connectingRodLength, 7e-16,
      'constant connecting-rod length');
    const dx = state.wrist.x - state.crankPin.x;
    const dy = state.wrist.y - state.crankPin.y;
    near(dx ** 2 + dy ** 2, geometry.connectingRodLength ** 2,
      2e-15, 'circle-line closure squared');
    assert.ok(state.sliderY >= geometry.sliderLowY - 1e-15);
    assert.ok(state.sliderY <= geometry.sliderHighY + 1e-15);
  }
  disposeModel(model.root);
});

test('movement 392 translates one straight blade through the table while its guide cheeks remain fixed', () => {
  const model = createMovementModel(catalog.movements[391]);
  const data = model.root.userData;
  const { blocks, constraints, geometry, stateAtTime, timeline } = data;
  assert.match(constraints.noGate, /Only the narrow blade/);
  assert.match(constraints.noGate, /guide cheeks.*fixed/);
  assert.equal(blocks.sawAssembly.userData.blade.parent,
    blocks.sawAssembly);
  assert.equal(blocks.sawAssembly.userData.lowerBlock.parent,
    blocks.sawAssembly);
  assert.equal(blocks.sawAssembly.userData.upperBlock.parent,
    blocks.sawAssembly);
  assert.equal(blocks.sawAssembly.userData.springStem.parent,
    blocks.sawAssembly);
  for (const rail of blocks.guideRails) assert.equal(rail.parent, blocks.frame);

  for (let sample = 0; sample < 4000; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 4000);
    near(state.wrist.x, 0, 0, 'blade axis x');
    assert.ok(state.bladeBottomY < geometry.tableY,
      'blade extends below table');
    assert.ok(state.bladeTopY > geometry.tableY,
      'blade extends above table');
    const lowerWorldRange = [
      state.sliderY,
      state.sliderY + 0.255,
    ];
    const upperWorldRange = [
      state.sliderY + geometry.bladeTop,
      state.sliderY + 10.25 * geometry.sourceScale,
    ];
    assert.ok(lowerWorldRange[1] > geometry.lowerGuideBottom);
    assert.ok(lowerWorldRange[0] < geometry.lowerGuideTop);
    assert.ok(upperWorldRange[1] > geometry.upperGuideBottom);
    assert.ok(upperWorldRange[0] < geometry.upperGuideTop);
  }
  disposeModel(model.root);
});

test('movement 392 straight leaf spring leaves its right clamp level and stays attached at both ends', () => {
  const model = createMovementModel(catalog.movements[391]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;
  assert.match(transmission.springPathLaw, /end-loaded cantilever/);
  assert.match(transmission.springPathLaw, /level right-hand clamp/);

  for (let sample = -6000; sample <= 12000; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 6000);
    const curve = state.spring.curve;
    vectorNear(curve.getPoint(0), state.spring.movingEnd, 0,
      'spring moving-end attachment');
    vectorNear(curve.getPoint(1), geometry.springFixedEnd, 0,
      'spring fixed-end attachment');
    near(state.spring.movingEnd.x, 0, 0, 'spring tip on the blade axis');
    near(state.spring.movingEnd.y, state.sliderY + geometry.springAttachmentY,
      0, 'spring tip rides with the blade');
    const nearClamp = curve.getPoint(1 - 1e-6);
    near((geometry.springFixedEnd.y - nearClamp.y)
      / (geometry.springFixedEnd.x - nearClamp.x), 0, 2e-5,
      'leaf leaves the clamp level');
    near(state.spring.length, curve.getLength(), 0,
      'reported spring path length');
  }
  disposeModel(model.root);
});

test('movement 392 spring is straight in the source pose, preloaded throughout, and most strained at lower dead center', () => {
  const model = createMovementModel(catalog.movements[391]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;
  assert.match(transmission.bladeTensionLaw, />0 over the complete stroke/);

  let minimumExtension = Infinity;
  let maximumExtension = -Infinity;
  for (let sample = 0; sample < 12000; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 12000);
    assert.ok(state.spring.extension >= geometry.springPreloadExtension
      - 2e-14);
    assert.ok(state.spring.forceProxy > 0);
    minimumExtension = Math.min(minimumExtension, state.spring.extension);
    maximumExtension = Math.max(maximumExtension, state.spring.extension);
  }
  near(minimumExtension, geometry.springPreloadExtension, 2e-14,
    'minimum spring preload');
  near(
    maximumExtension,
    geometry.springPreloadExtension + geometry.sliderStroke,
    2e-14,
    'maximum spring deflection',
  );
  const lowerDeadCenter = stateAtTime(
    timeline.cycleDuration * timeline.lowerDeadCenterPhase,
  );
  const upperDeadCenter = stateAtTime(
    timeline.cycleDuration * timeline.upperDeadCenterPhase,
  );
  near(lowerDeadCenter.sliderY, geometry.sliderLowY, 3e-16,
    'lower dead-center slider height');
  near(upperDeadCenter.sliderY, geometry.sliderHighY, 3e-16,
    'upper dead-center slider height');
  near(lowerDeadCenter.spring.extension,
    geometry.springPreloadExtension + geometry.sliderStroke, 2e-14,
    'most strained at lower dead center');
  near(upperDeadCenter.spring.extension, geometry.springPreloadExtension,
    2e-14, 'least strained at upper dead center');
  const sourcePose = stateAtTime(0);
  for (let index = 0; index <= 20; index += 1) {
    near(sourcePose.spring.curve.getPoint(index / 20).y,
      geometry.springFixedEnd.y, 3e-15, 'straight leaf in the source pose');
  }
  disposeModel(model.root);
});

test('movement 392 closes every crank cycle with continuous slider velocity and acceleration', () => {
  const model = createMovementModel(catalog.movements[391]);
  const data = model.root.userData;
  const { stateAtTime, timeline } = data;

  for (let cycle = -8; cycle <= 8; cycle += 1) {
    const offset = 0.173;
    const first = stateAtTime(timeline.cycleDuration * (cycle + offset));
    const next = stateAtTime(timeline.cycleDuration
      * (cycle + 1 + offset));
    near(next.crankRotation - first.crankRotation, FULL_TURN, 8e-15,
      'one crank turn per mechanical cycle');
    near(next.sliderY, first.sliderY, 3e-15, 'slider cycle closure');
    near(next.sliderVelocity, first.sliderVelocity, 4e-15,
      'slider velocity cycle closure');
    near(next.sliderAcceleration, first.sliderAcceleration, 8e-15,
      'slider acceleration cycle closure');
    near(next.spring.length, first.spring.length, 4e-15,
      'spring shape cycle closure');
  }
  const epsilon = 1e-7;
  const before = stateAtTime(-epsilon);
  const after = stateAtTime(epsilon);
  near(before.sliderY, after.sliderY, 2e-7,
    'position continuous through cycle boundary');
  near(before.sliderVelocity, after.sliderVelocity, 2e-7,
    'velocity continuous through cycle boundary');
  near(before.sliderAcceleration, after.sliderAcceleration, 4e-7,
    'acceleration continuous through cycle boundary');
  disposeModel(model.root);
});

test('movement 392 update binds crank, rod, saw, guides, and flexing spring to one analytic state', () => {
  const model = createMovementModel(catalog.movements[391]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime, timeline } = data;

  for (const phase of [0, 0.17, 0.25, 0.51, 0.75, 0.93]) {
    const time = timeline.cycleDuration * phase;
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.crankRotor.rotation.z, expected.crankRotation, 0,
      'crank visual update');
    near(blocks.sawAssembly.position.y, expected.sliderY, 0,
      'saw visual update');
    vectorNear(blocks.connectingRod.userData.start, expected.crankPin,
      0, 'rod crank-pin endpoint update');
    vectorNear(blocks.connectingRod.userData.end, expected.wrist,
      0, 'rod wrist endpoint update');
    near(blocks.flexingSpring.userData.currentLength,
      expected.spring.length, 0, 'spring visual length update');
    vectorNear(blocks.flexingSpring.userData.currentCurve.getPoint(0),
      expected.spring.movingEnd, 0, 'spring visual moving endpoint');
    near(data.contacts.connectingRodToSawWrist.lengthError,
      0, 7e-16, 'updated rod contact closure');
    near(data.contacts.leafSpringToSawTop.pointError,
      0, 0, 'updated spring attachment closure');
    assert.equal(data.contacts.leafSpringToSawTop.tensionPositive, true);
    near(data.contacts.sawBlocksToFixedGuides.lowerBlockXError,
      0, 0, 'updated lower guide closure');
    near(data.contacts.sawBlocksToFixedGuides.upperBlockXError,
      0, 0, 'updated upper guide closure');
    assert.ok(expected.bladeBottomY < geometry.tableY);
    assert.ok(expected.bladeTopY > geometry.tableY);
  }
  disposeModel(model.root);
});

test('movement 392 factory is isolated before movement 507', () => {
  const model392 = createMovementModel(catalog.movements[391]);
  const model507 = createMovementModel(catalog.movements[506]);
  assert.equal(model392.root.userData.fidelity, 'authored');
  assert.equal(
    model392.root.userData.archetype,
    'crank-driven-ungated-gig-saw-with-tangent-flexing-upper-tension-spring',
  );
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(catalog.movements[506].fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model392.root);
  disposeModel(model507.root);
});
