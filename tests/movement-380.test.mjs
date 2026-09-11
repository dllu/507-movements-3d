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

test('movement 380 is a C-frame drill whose inner spindle passes through a separately handled hollow feed screw', () => {
  const movement = catalog.movements[379];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 380);
  assert.equal(movement.number, '380');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(
    movement.archetype,
    'through-spindle-hollow-feed-screw-portable-cramp-drill',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /inner-drill-spindle-through-the-center-bore/);
  assert.match(data.mechanism, /separately-cross-handle-turned-hollow-feed-screw/);
  assert.match(data.mechanism, /fixed-nut-and-thrust-collar-feed/);
  assert.match(data.mechanism, /fixed-lower-rest/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 2);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(degreesOfFreedom.inputs.length, 2);
  assert.match(degreesOfFreedom.inputs[0], /inner drill spindle/);
  assert.match(degreesOfFreedom.inputs[1], /outer hollow feed screw/);
  assert.match(degreesOfFreedom.note, /rotates independently/);
  assert.match(degreesOfFreedom.note, /share feed translation/);

  for (const component of [
    blocks.crampFrame,
    blocks.drillRotor,
    blocks.feedSleeveRotor,
  ]) assert.equal(component.parent, model.root);
  for (const component of [
    blocks.fixedFeedNut,
    blocks.fixedWorkRest,
    blocks.frameBack,
    blocks.frameBottom,
    blocks.frameTop,
  ]) assert.equal(component.parent, blocks.crampFrame);
  for (const component of [
    blocks.feedHandleBar,
    blocks.feedHandleHub,
    ...blocks.feedHandleKnobs,
    blocks.feedIndex,
    blocks.feedThread,
    blocks.hollowSleeve,
    ...blocks.sleeveEndRings,
    blocks.thrustCollar,
  ]) assert.equal(component.parent, blocks.feedSleeveRotor);
  for (const component of [
    blocks.drillBit,
    blocks.drillChuck,
    blocks.drillCrankArm,
    blocks.drillCrankHub,
    blocks.drillCrankKnob,
    blocks.drillIndex,
    blocks.drillSpindle,
  ]) assert.equal(component.parent, blocks.drillRotor);
  assert.equal(blocks.feedHandleKnobs.length, 2);
  assert.equal(blocks.sleeveEndRings.length, 2);
  assert.equal(blocks.crampFrame.userData.fixed, true);
  assert.equal(
    blocks.fixedFeedNut.userData.fixedAgainstRotationAndTranslation,
    true,
  );
  assert.equal(blocks.hollowSleeve.geometry.parameters.openEnded, true);
  near(blocks.hollowSleeve.geometry.parameters.radiusTop,
    geometry.outerSleeveRadius, 0, 'outer sleeve radius');
  near(blocks.drillSpindle.geometry.parameters.radiusTop,
    geometry.drillSpindleRadius, 0, 'inner spindle radius');
  assert.equal(blocks.feedSleeveRotor.userData.innerBoreRadius,
    geometry.innerBoreRadius);
  assert.equal(blocks.feedThread.userData.lead, geometry.threadLead);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'rotating-translating-hollow-feed-screw-and-cross-handle',
    'open-ended-hollow-feed-screw-sleeve',
    'annular-end-face-showing-feed-screw-bore',
    'inner-drill-spindle-passing-coaxially-through-feed-screw-bore',
    'continuous-inner-spindle-through-hollow-feed-screw',
    'feed-sleeve-thrust-collar-capturing-inner-drill-axially',
    'fixed-lower-work-rest-beneath-through-feed-drill',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 380 preserves Brown\'s through-center distinction, measured engraving, unavailable animation, and disclosed reconstruction', () => {
  const movement = catalog.movements[379];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate380;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_380.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.pairedMovement, 379);
  assert.match(movement.description, /379 and 380/);
  assert.match(movement.description, /Portable cramp drills/);
  assert.match(movement.description, /380 the drill spindle passes through the center of the feed-screw/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(
    dynamics.sourceSpecifiesDimensionsTimingLeadClearanceOrSpeed,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);
  assert.match(dynamics.treatment, /genuinely hollow threaded sleeve/);
  assert.match(dynamics.treatment, /independently rotating inner spindle/);
  assert.match(dynamics.treatment, /analytic lead constraint/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.deepEqual(plate.cFrameTopLeft.toArray(), [153, 170]);
  assert.deepEqual(plate.cFrameBottomLeft.toArray(), [153, 478]);
  assert.deepEqual(plate.cFrameBottomRestCenter.toArray(), [354, 432]);
  assert.equal(plate.feedThreadAxisX, 354);
  assert.equal(plate.feedCrossHandleY, 127);
  assert.deepEqual(plate.drillCrankHandleCenter.toArray(), [171, 66]);
  assert.deepEqual(plate.drillBitTip.toArray(), [354, 359]);
  assert.equal(evidence.explicitInBrownDescription.length, 2);
  assert.match(evidence.engravingEvidence, /externally threaded upper feed member/);
  assert.match(evidence.engravingEvidence, /narrower continuous drill spindle through its center/);
  assert.match(evidence.reconstructionDisclosure, /thrust-collar interpretation/);
  assert.match(evidence.reconstructionDisclosure, /no canvas animation/);
  disposeModel(model.root);
});

test('movement 380 maintains exact coaxial bore clearance with a genuinely smaller continuous inner spindle', () => {
  const model = createMovementModel(catalog.movements[379]);
  const data = model.root.userData;
  const { blocks, geometry, transmission } = data;

  assert.notEqual(blocks.drillRotor, blocks.feedSleeveRotor);
  assert.equal(blocks.drillRotor.parent, blocks.feedSleeveRotor.parent);
  assert.ok(geometry.drillSpindleRadius > 0);
  assert.ok(geometry.innerBoreRadius > geometry.drillSpindleRadius);
  assert.ok(geometry.outerSleeveRadius > geometry.innerBoreRadius);
  near(geometry.radialBoreClearance,
    geometry.innerBoreRadius - geometry.drillSpindleRadius,
    0, 'radial journal clearance');
  assert.match(transmission.boreClearanceLaw, /inner drill radius/);
  assert.match(transmission.boreClearanceLaw, /fixed radial clearance/);
  near(blocks.drillRotor.position.x,
    blocks.feedSleeveRotor.position.x, 0, 'coaxial x');
  near(blocks.drillRotor.position.z,
    blocks.feedSleeveRotor.position.z, 0, 'coaxial z');
  near(blocks.drillRotor.position.x,
    geometry.commonAxisX, 0, 'common axis x');
  near(blocks.drillRotor.position.z,
    geometry.commonAxisZ, 0, 'common axis z');
  for (const ring of blocks.sleeveEndRings) {
    near(ring.geometry.parameters.innerRadius,
      geometry.innerBoreRadius, 0, 'annular bore radius');
    near(ring.geometry.parameters.outerRadius,
      geometry.outerSleeveRadius, 0, 'annular outer radius');
  }
  disposeModel(model.root);
});

test('movement 380 hollow feed screw obeys its exact signed lead with a visible helix of the same pitch', () => {
  const model = createMovementModel(catalog.movements[379]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;

  assert.match(transmission.feedLeadLaw, /axial travel/);
  assert.match(transmission.feedLeadLaw, /outer feed-screw angle/);
  near(geometry.threadTurns,
    geometry.sleeveLength / geometry.threadLead,
    0, 'visible external helix turn count');
  near(geometry.sleeveLength,
    geometry.sleeveMaximumY - geometry.sleeveMinimumY,
    0, 'hollow sleeve axial extent');
  for (let sample = -1800; sample <= 3600; sample += 1) {
    const state = stateAtTime(geometry.demonstrationPeriod
      * sample / 1800);
    near(state.axialTravel,
      -geometry.threadLead * state.feedScrewAngle / FULL_TURN,
      2e-16, 'signed feed lead');
    near(state.axialSpeed,
      -geometry.threadLead * state.feedScrewAngularSpeed / FULL_TURN,
      2e-16, 'signed feed velocity');
    near(state.axialAcceleration,
      -geometry.threadLead * state.feedScrewAngularAcceleration
        / FULL_TURN,
      2e-16, 'signed feed acceleration');
    near(state.threadAdvanceResidual, 0, 2e-16,
      'thread advance residual');
  }
  disposeModel(model.root);
});

test('movement 380 thrust capture gives inner spindle and outer feed screw identical axial motion but independent relative rotation', () => {
  const model = createMovementModel(catalog.movements[379]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;

  assert.match(transmission.axialCaptureLaw, /share exactly one axial translation/);
  assert.match(transmission.axialCaptureLaw, /allowing their relative rotation/);
  assert.match(transmission.relativeRotationLaw, /drill angle minus feed-screw angle/);
  for (let sample = -1200; sample <= 2400; sample += 1) {
    const state = stateAtTime(geometry.demonstrationPeriod
      * sample / 1200);
    near(state.sharedRotorY,
      geometry.feedBaseY + state.axialTravel, 0,
      'shared axial position');
    near(state.relativeDrillAngle,
      state.drillAngle - state.feedScrewAngle, 0,
      'independent relative angle');
    near(state.relativeDrillAngularSpeed,
      state.drillAngularSpeed - state.feedScrewAngularSpeed, 0,
      'independent relative angular speed');
    near(state.drillTipY,
      state.sharedRotorY + geometry.drillTipLocalY, 0,
      'drill tip follows shared feed');
    near(state.clearance,
      state.drillTipY - geometry.fixedWorkRestTopY, 0,
      'drill-to-rest clearance');
    assert.ok(state.clearance >= geometry.minimumClearance - 2e-16,
      'drill never intersects fixed work rest');
  }
  assert.ok(geometry.minimumClearance > 0);
  disposeModel(model.root);
});

test('movement 380 reversible feed is smooth and derivative-consistent while its inner drill continues uniformly', () => {
  const model = createMovementModel(catalog.movements[379]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  const step = 1e-6;
  const start = stateAtTime(0);
  const low = stateAtTime(geometry.demonstrationPeriod / 2);
  const closure = stateAtTime(geometry.demonstrationPeriod);

  near(start.feedTurns, 0, 0, 'feed starts raised');
  near(low.feedTurns, geometry.feedTurnAmplitude, 0,
    'feed reaches maximum down travel');
  near(closure.feedTurns, 0, 0, 'feed returns raised');
  near(start.feedTurnsRate, 0, 0, 'start is smooth');
  near(low.feedTurnsRate, 0, 2e-16, 'lower reversal is smooth');
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
      'feed acceleration derivative');
    near(state.drillAngularSpeed,
      geometry.drillTurnsPerDemonstration * FULL_TURN
        / geometry.demonstrationPeriod,
      0, 'independent drill speed stays uniform');
  }
  disposeModel(model.root);
});

test('movement 380 renderer binds shared feed, two distinct rotations, fixed frame, and fixed work rest exactly', () => {
  const model = createMovementModel(catalog.movements[379]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const framePosition = blocks.crampFrame.position.clone();
  const workRestPosition = blocks.fixedWorkRest.position.clone();
  const nutPosition = blocks.fixedFeedNut.position.clone();

  for (let frame = 0; frame <= 720; frame += 1) {
    const time = geometry.demonstrationPeriod * 2 * frame / 720;
    const expected = stateAtTime(time);
    model.update(time, 0.016);
    near(blocks.feedSleeveRotor.position.y,
      expected.sharedRotorY, 0,
      'rendered outer feed position');
    near(blocks.drillRotor.position.y,
      expected.sharedRotorY, 0,
      'rendered inner drill position');
    near(blocks.feedSleeveRotor.rotation.y,
      expected.feedScrewAngle, 0,
      'rendered outer feed angle');
    near(blocks.drillRotor.rotation.y,
      expected.drillAngle, 0,
      'rendered inner drill angle');
    vectorNear(blocks.crampFrame.position, framePosition, 0,
      'C-frame remains fixed');
    vectorNear(blocks.fixedWorkRest.position, workRestPosition, 0,
      'lower work rest remains fixed');
    vectorNear(blocks.fixedFeedNut.position, nutPosition, 0,
      'upper feed nut remains fixed');
    for (const residual of Object.values(data.constraintResiduals)) {
      near(residual, 0, 2e-16, 'renderer constraint residual');
    }
  }
  disposeModel(model.root);
});

test('movement 380 closes four inner drill turns and one hollow-feed advance-return before movement 507 remains authored', () => {
  const movement = catalog.movements[379];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.demonstrationPeriod);

  near(closure.drillAngle - start.drillAngle,
    geometry.drillTurnsPerDemonstration * FULL_TURN, 0,
    'four unwrapped inner drill turns');
  near(closure.feedPhase - start.feedPhase, FULL_TURN, 0,
    'one unwrapped hollow-feed cycle');
  angleNear(closure.drillAngle, start.drillAngle, 0,
    'inner drill pose closes');
  angleNear(closure.feedScrewAngle, start.feedScrewAngle, 0,
    'hollow feed screw pose closes');
  near(closure.sharedRotorY, start.sharedRotorY, 0,
    'shared axial feed closes');
  near(closure.drillTipY, start.drillTipY, 0,
    'drill tip closes');
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
