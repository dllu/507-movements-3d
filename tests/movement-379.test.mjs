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

function angleNear(actual, expected, tolerance, message) {
  const error = THREE.MathUtils.euclideanModulo(
    actual - expected + Math.PI,
    FULL_TURN,
  ) - Math.PI;
  near(error, 0, tolerance, message);
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

test('movement 379 is a C-frame portable drill with separate coaxial upper drill and opposed lower feed screw', () => {
  const movement = catalog.movements[378];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 379);
  assert.equal(movement.number, '379');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(
    movement.archetype,
    'opposed-feed-screw-portable-cramp-drill',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-fixed-c-cramp/);
  assert.match(data.mechanism, /one-axially-fixed-upper-hand-crank-drill/);
  assert.match(data.mechanism, /one-separate-coaxial-opposed-lower-feed-screw/);
  assert.match(data.mechanism, /fixed-nut/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 2);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(degreesOfFreedom.inputs.length, 2);
  assert.match(degreesOfFreedom.inputs[0], /upper hand crank/);
  assert.match(degreesOfFreedom.inputs[1], /lower handwheel/);
  assert.match(degreesOfFreedom.note, /axially fixed/);
  assert.match(degreesOfFreedom.note, /separate lower/);

  for (const component of [
    blocks.crampFrame,
    blocks.drillRotor,
    blocks.feedScrewRotor,
  ]) assert.equal(component.parent, model.root);
  for (const component of [
    blocks.drillHousing,
    blocks.fixedFeedNut,
    blocks.cFrame,
  ]) assert.equal(component.parent, blocks.crampFrame);
  for (const component of [
    blocks.drillBit,
    blocks.drillChuck,
    blocks.drillCrankArm,
    blocks.drillCrankHub,
    blocks.drillCrankKnob,
    blocks.drillSpindle,
  ]) assert.equal(component.parent, blocks.drillRotor);
  // Brown draws no white indices.
  assert.equal(blocks.drillIndex.parent, null);
  assert.equal(blocks.feedIndex.parent, null);
  for (const component of [
    blocks.feedScrewCore,
    blocks.feedThread,
    ...blocks.handwheelArms,
    blocks.handwheelHub,
    ...blocks.handwheelKnobs,
    blocks.workRest,
  ]) assert.equal(component.parent, blocks.feedScrewRotor);
  assert.equal(blocks.handwheelArms.length, 2);
  assert.equal(blocks.handwheelKnobs.length, 2);
  assert.equal(blocks.crampFrame.userData.fixed, true);
  assert.equal(
    blocks.fixedFeedNut.userData.fixedAgainstRotationAndTranslation,
    true,
  );
  assert.equal(blocks.feedThread.userData.lead,
    data.geometry.threadLead);
  assert.equal(blocks.feedThread.userData.handedness,
    'right-hand-about-positive-Y');

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'fixed-c-shaped-portable-cramp-drill-frame',
    'upper-hand-crank-drill-spindle-rigid-rotor',
    'fixed-height-rotating-drill-spindle',
    'lower-feed-screw-rest-and-handwheel-rigid-rotor',
    'visible-helical-feed-screw-thread',
    'flat-work-rest-opposite-and-coaxial-with-drill',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 379 preserves Brown\'s paired caption, measured opposed layout, unavailable animation, and reconstruction disclosure', () => {
  const movement = catalog.movements[378];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate379;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_379.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.pairedMovement, 380);
  assert.match(movement.description, /379 and 380/);
  assert.match(movement.description, /Portable cramp drills/);
  assert.match(movement.description, /379 the feed-screw is opposite the drill/);
  assert.match(movement.description, /380 the drill spindle passes through the center/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(dynamics.sourceSpecifiesDimensionsTimingLeadOrSpeed, false);
  assert.equal(dynamics.idealizations.length, 5);
  assert.match(dynamics.treatment, /coaxial opposed layout/);
  assert.match(dynamics.treatment, /analytic screw-lead constraint/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.deepEqual(plate.cFrameTopLeft.toArray(), [159, 140]);
  assert.deepEqual(plate.cFrameBottomLeft.toArray(), [158, 410]);
  assert.deepEqual(plate.cFrameBottomRight.toArray(), [390, 412]);
  assert.equal(plate.drillAxisX, 338);
  assert.deepEqual(plate.drillBitTip.toArray(), [338, 279]);
  assert.deepEqual(plate.feedRestCenter.toArray(), [338, 324]);
  assert.deepEqual(plate.feedHandwheelCenter.toArray(), [337, 480]);
  assert.equal(evidence.explicitInBrownDescription.length, 2);
  assert.match(evidence.engravingEvidence, /C-shaped frame/);
  assert.match(evidence.engravingEvidence, /lower coaxial threaded feed screw/);
  assert.match(evidence.reconstructionDisclosure, /0.28-unit screw lead/);
  assert.match(evidence.reconstructionDisclosure, /no canvas animation/);
  disposeModel(model.root);
});

test('movement 379 drill tip, feed screw, and work rest share one exact vertical axis while the two rotors stay separate', () => {
  const model = createMovementModel(catalog.movements[378]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime, transmission } = data;

  assert.notEqual(blocks.drillRotor, blocks.feedScrewRotor);
  assert.equal(blocks.drillRotor.parent, blocks.feedScrewRotor.parent);
  near(geometry.drillRotorOrigin.x, geometry.commonAxisX, 0,
    'drill origin axis x');
  near(geometry.feedRotorOrigin.x, geometry.commonAxisX, 0,
    'feed origin axis x');
  near(geometry.drillRotorOrigin.z, geometry.commonAxisZ, 0,
    'drill origin axis z');
  near(geometry.feedRotorOrigin.z, geometry.commonAxisZ, 0,
    'feed origin axis z');
  assert.match(transmission.opposedAxisLaw, /exactly one vertical axis/);
  assert.match(transmission.opposedAxisLaw, /separate independently operated/);
  for (let sample = -800; sample <= 1600; sample += 1) {
    const state = stateAtTime(geometry.demonstrationPeriod * sample / 800);
    near(state.drillTipY, geometry.drillTipY, 0,
      'drill remains fixed axially');
    near(state.workRestY,
      state.feedRotorY + geometry.workRestLocalY, 0,
      'work rest follows lower screw axially');
    near(state.clearance, state.drillTipY - state.workRestTopY, 0,
      'opposed axial clearance');
    assert.ok(state.clearance >= geometry.minimumClearance - 2e-16,
      'rest never intersects drill tip');
  }
  assert.ok(geometry.minimumClearance > 0);
  disposeModel(model.root);
});

test('movement 379 feed screw obeys its exact signed lead through forward motion, reversal, and return', () => {
  const model = createMovementModel(catalog.movements[378]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;

  assert.match(transmission.feedLeadLaw, /axial travel/);
  assert.match(transmission.feedLeadLaw, /thread lead/);
  assert.match(transmission.feedLeadLaw, /negative sign/);
  near(geometry.threadTurns,
    (geometry.threadMaximumY - geometry.threadMinimumY)
      / geometry.threadLead,
    0, 'visible helix turn count follows lead');
  for (let sample = -1800; sample <= 3600; sample += 1) {
    const state = stateAtTime(geometry.demonstrationPeriod
      * sample / 1800);
    near(state.axialTravel,
      -geometry.threadLead * state.feedScrewAngle / FULL_TURN,
      2e-16, 'signed screw lead');
    near(state.axialSpeed,
      -geometry.threadLead * state.feedScrewAngularSpeed / FULL_TURN,
      2e-16, 'signed screw lead velocity');
    near(state.axialAcceleration,
      -geometry.threadLead * state.feedScrewAngularAcceleration
        / FULL_TURN,
      2e-16, 'signed screw lead acceleration');
    near(state.threadAdvanceResidual, 0, 2e-16,
      'thread advance residual');
  }
  disposeModel(model.root);
});

test('movement 379 reversible feed schedule is smooth and derivative-consistent at both travel limits', () => {
  const model = createMovementModel(catalog.movements[378]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  const step = 1e-6;
  const start = stateAtTime(0);
  const top = stateAtTime(geometry.demonstrationPeriod / 2);
  const closure = stateAtTime(geometry.demonstrationPeriod);

  near(start.feedTurns, 0, 0, 'feed begins retracted');
  near(top.feedTurns, geometry.feedTurnAmplitude, 0,
    'feed reaches prescribed turn amplitude');
  near(closure.feedTurns, 0, 0, 'feed returns retracted');
  near(start.feedTurnsRate, 0, 0, 'start is smooth');
  near(top.feedTurnsRate, 0, 2e-16, 'reversal is smooth');
  near(closure.feedTurnsRate, 0, 3e-16, 'closure is smooth');
  for (let sample = 0; sample <= 720; sample += 1) {
    const time = geometry.demonstrationPeriod * sample / 720 + 0.002;
    const state = stateAtTime(time);
    const before = stateAtTime(time - step);
    const after = stateAtTime(time + step);
    near((after.feedTurns - before.feedTurns) / (2 * step),
      state.feedTurnsRate, 1e-9,
      'feed-turn derivative');
    near((after.feedTurnsRate - before.feedTurnsRate) / (2 * step),
      state.feedTurnsAcceleration, 1e-9,
      'feed-turn acceleration derivative');
  }
  disposeModel(model.root);
});

test('movement 379 upper drill rotates uniformly and independently of the reversing feed screw', () => {
  const model = createMovementModel(catalog.movements[378]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;

  near(transmission.drillAngularSpeed,
    geometry.drillTurnsPerDemonstration * FULL_TURN
      / geometry.demonstrationPeriod,
    0, 'drill speed from turn count and period');
  const firstQuarter = stateAtTime(geometry.demonstrationPeriod / 4);
  const thirdQuarter = stateAtTime(3 * geometry.demonstrationPeriod / 4);
  near(firstQuarter.feedTurns, thirdQuarter.feedTurns, 3e-16,
    'feed has same position on outward and return branches');
  near(firstQuarter.feedTurnsRate, -thirdQuarter.feedTurnsRate, 3e-16,
    'feed reverses direction');
  assert.equal(firstQuarter.drillAngularSpeed,
    thirdQuarter.drillAngularSpeed);
  assert.ok(firstQuarter.drillAngularSpeed > 0);
  near(thirdQuarter.drillAngle - firstQuarter.drillAngle,
    geometry.drillTurnsPerDemonstration * Math.PI,
    0, 'drill continues through feed reversal');
  disposeModel(model.root);
});

test('movement 379 renderer keeps the C-frame and drill height fixed while binding both independent rotor states exactly', () => {
  const model = createMovementModel(catalog.movements[378]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const framePosition = blocks.crampFrame.position.clone();
  const drillPosition = blocks.drillRotor.position.clone();
  const fixedNutPosition = blocks.fixedFeedNut.position.clone();

  for (let frame = 0; frame <= 720; frame += 1) {
    const time = geometry.demonstrationPeriod * 2 * frame / 720;
    const expected = stateAtTime(time);
    model.update(time, 0.016);
    near(blocks.drillRotor.rotation.y, expected.drillAngle, 0,
      'rendered drill angle');
    near(blocks.feedScrewRotor.rotation.y,
      expected.feedScrewAngle, 0,
      'rendered feed screw angle');
    near(blocks.feedScrewRotor.position.y,
      expected.feedRotorY, 0,
      'rendered feed screw axial position');
    vectorNear(blocks.crampFrame.position, framePosition, 0,
      'C-frame remains fixed');
    vectorNear(blocks.drillRotor.position, drillPosition, 0,
      'drill rotor remains fixed axially');
    vectorNear(blocks.fixedFeedNut.position, fixedNutPosition, 0,
      'feed nut remains fixed');
    blocks.workRest.updateMatrixWorld(true);
    const restCenter = blocks.workRest.getWorldPosition(
      new THREE.Vector3(),
    );
    near(restCenter.x, geometry.commonAxisX, 2e-16,
      'rendered rest axis x');
    near(restCenter.y, expected.workRestY, 2e-16,
      'rendered rest height');
    near(restCenter.z, geometry.commonAxisZ, 2e-16,
      'rendered rest axis z');
    for (const residual of Object.values(data.constraintResiduals)) {
      near(residual, 0, 2e-16, 'renderer constraint residual');
    }
  }
  disposeModel(model.root);
});

test('movement 379 closes four drill turns and one feed advance-return before movement 507 remains the next authored draft', () => {
  const movement = catalog.movements[378];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.demonstrationPeriod);

  near(closure.drillAngle - start.drillAngle,
    geometry.drillTurnsPerDemonstration * FULL_TURN, 0,
    'four unwrapped drill turns');
  near(closure.feedPhase - start.feedPhase, FULL_TURN, 0,
    'one unwrapped feed cycle');
  angleNear(closure.drillAngle, start.drillAngle, 0,
    'drill pose closes');
  angleNear(closure.feedScrewAngle, start.feedScrewAngle, 0,
    'feed handwheel pose closes');
  near(closure.feedRotorY, start.feedRotorY, 0,
    'feed axial position closes');
  near(closure.workRestY, start.workRestY, 0,
    'work-rest position closes');
  assert.equal(timeline.demonstrationPeriod,
    geometry.demonstrationPeriod);
  assert.equal(data.animationTiming.authoredCyclePeriod,
    geometry.demonstrationPeriod);
  assert.equal(data.animationTiming.targetCycleDuration, 2);
  assertReadableTiming(data.animationTiming);
  assert.ok(data.cameraFitBounds instanceof THREE.Box3);
  assert.ok(Number.isFinite(data.groundFloorY));

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model507.root);
});
