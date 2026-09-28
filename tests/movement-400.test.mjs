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

test('movement 400 is one compound cam, forked carrier A, pivoted feed bar B, feeder, and return spring', () => {
  const movement = catalog.movements[399];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 400);
  assert.equal(movement.number, '400');
  assert.equal(movement.category, 'Cams & followers');
  assert.equal(movement.archetype,
    'wilson-compound-radial-and-axial-cam-driving-forked-carrier-and-pivoted-feed-dog-through-four-motion-cycle');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.match(data.archetype, /wilson-compound-radial-and-axial-cam/);
  assert.match(data.mechanism, /one-constant-speed-compound-cam-C/);
  assert.match(data.mechanism, /feed-bar-B/);
  assert.match(data.mechanism, /forked-carrier-A/);
  assert.match(data.mechanism, /gravity-drop-and-spring-return/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(blocks.cam.parent, model.root);
  assert.equal(blocks.carrierA.parent, model.root);
  assert.equal(blocks.feedBarB.parent, model.root);
  assert.equal(blocks.returnSpring.parent, model.root);
  assert.equal(blocks.guideRails.length, 2);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'single-rigid-x-axis-compound-cam-C-with-radial-and-axial-prominence',
    'nearly-cylindrical-radial-cam-with-one-broad-lifting-prominence',
    'front-extension-of-same-prominence-driving-carrier-forward',
    'forked-horizontal-carrier-bar-A-sliding-only-in-feed-direction',
    'carrier-A-fork-cheek-around-B-pivot',
    'feed-bar-B-pivoted-in-fork-A-and-carrying-the-toothed-feeder',
    'spur-or-feeder-carried-at-end-of-bar-B',
    'preloaded-carrier-return-spring-pushing-bar-A-rearward',
    'carrier-A-left-cross-leg-bearing-return-spring',
    'fixed-cup-socket-holding-return-spring',
  ]) assert.ok(roles.includes(role), role);
  // Pass 90: one raked feeder plate with an upturned toe carries five teeth.
  assert.equal(roles.filter((role) => role === 'feeder-tooth-tip').length,
    5);
  assert.ok(roles.includes('raked-toothed-feeder-plate-with-upturned-toe'));
  assert.ok(!roles.includes('underside-pad-stem-set-into-bar-B'), 'no stem-and-ball pad');
  disposeModel(model.root);
});

test('movement 400 preserves Brown’s topology and the corroborating 1854 Wilson patent operation', () => {
  const movement = catalog.movements[399];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate400;
  const evidence = sourceReference.constructionEvidence;
  const patent = sourceReference.usPatent12116;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_400.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Four-motion feed/);
  assert.match(movement.description, /A\. B\. Wilson’s patent/);
  assert.match(movement.description, /bar, A, is forked/);
  assert.match(movement.description, /bar, B.*pivoted in the said fork/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.barAApproximatePixels, [52, 400, 225, 248]);
  assert.deepEqual(plate.forkPivotApproximatePixels, [108, 261]);
  assert.deepEqual(plate.camCenterApproximatePixels, [344, 296]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence, /shaft parallel to the feed direction/);
  assert.match(evidence.reconstructionDisclosure, /independently synthesized/);
  assert.equal(patent.number, 'US12116A');
  assert.equal(patent.inventor, 'Allen B. Wilson');
  assert.equal(patent.date, '1854-12-19');
  assert.equal(patent.url,
    'https://patents.google.com/patent/US12116A/en');
  assert.match(patent.operationalEvidence, /nearly cylindrical and concentric/);
  assert.match(patent.operationalEvidence, /front acts on the feed-bar projection/);
  disposeModel(model.root);
});

test('movement 400 compound cam makes one constant-speed revolution and closes both surfaces each cycle', () => {
  const model = createMovementModel(catalog.movements[399]);
  const { stateAtTime, timeline } = model.root.userData;
  const expectedSpeed = FULL_TURN / timeline.cycleDuration;

  for (let sample = -16000; sample <= 32000; sample += 1) {
    const state = stateAtTime(
      timeline.cycleDuration * sample / 16000,
    );
    near(state.camAngularSpeed, expectedSpeed, 0,
      'constant cam angular speed');
    near(state.camAngle, FULL_TURN * state.cycleCoordinate, 0,
      'unwrapped cam angle');
    near(state.radialCamContactError, 0, 4e-16,
      'radial cam contact closure');
    near(state.axialCamContactError, 0, 1e-12,
      'axial cam contact closure');
  }
  for (const phase of [-2.14, -0.21, 0.18, 0.73, 2.91]) {
    const start = stateAtTime(timeline.cycleDuration * phase);
    const end = stateAtTime(timeline.cycleDuration * (phase + 1));
    near(end.camAngle - start.camAngle, FULL_TURN, 8e-15,
      'one cam revolution per cycle');
    near(end.carrierX, start.carrierX, 5e-15,
      'carrier cycle closure');
    near(end.rockerAngle, start.rockerAngle, 5e-15,
      'feed-bar cycle closure');
  }
  disposeModel(model.root);
});

test('movement 400 sampled radial pitch and axial face controls track the nominal schedule', () => {
  const model = createMovementModel(catalog.movements[399]);
  const data = model.root.userData;
  const synthesis = data.camSynthesis;
  let maximumRadialError = 0;
  let maximumAxialError = 0;

  assert.equal(synthesis.profileSampleCount, 720);
  assert.equal(synthesis.surfaceSamples.length, 721);
  for (let sample = 0; sample <= 72000; sample += 1) {
    const phase = sample / 72000;
    const exact = synthesis.nominalControlAtPhase(phase);
    const rendered = synthesis.sampledControlAtPhase(phase);
    maximumRadialError = Math.max(maximumRadialError,
      Math.abs(rendered.radialRadius - exact.radialRadius));
    maximumAxialError = Math.max(maximumAxialError,
      Math.abs(rendered.axialFront - exact.axialFront));
  }
  assert.ok(maximumRadialError < 4.1e-5,
    `rendered radial error ${maximumRadialError}`);
  assert.ok(maximumAxialError < 1.5e-5,
    `rendered axial error ${maximumAxialError}`);
  assert.ok(maximumRadialError < data.geometry.radialLift / 7000);
  assert.ok(maximumAxialError < data.geometry.feedStroke / 45000);
  disposeModel(model.root);
});

test('movement 400 executes the four-motion sequence without dragging fabric backward', () => {
  const model = createMovementModel(catalog.movements[399]);
  const data = model.root.userData;
  const { geometry, motion, stateAtTime, timeline } = data;
  const expectedStages = [
    [0.05, 'lowered-rear-dwell'],
    [0.16, 'simultaneous-cam-rise-and-forward-feed'],
    [0.29, 'raised-forward-feed'],
    [0.42, 'raised-at-forward-limit'],
    [0.53, 'gravity-drop-at-forward-limit'],
    [0.70, 'spring-return-below-work'],
    [0.92, 'lowered-rear-dwell'],
  ];
  for (const [phase, stage] of expectedStages) {
    assert.equal(
      stateAtTime(timeline.cycleDuration * phase).overallStage,
      stage,
    );
  }
  assert.match(motion.sequence, /rise while forward feed begins/);
  assert.match(motion.sequence, /drop at forward limit/);
  assert.match(motion.sequence, /spring return below work/);

  let previousForwardX = -Infinity;
  let previousReturnX = Infinity;
  let engagedForwardSamples = 0;
  for (let sample = 0; sample <= 30000; sample += 1) {
    const phase = sample / 30000;
    const state = stateAtTime(timeline.cycleDuration * phase);
    // The spring inside fork A is compressed by the forward stroke.
    assert.ok(state.springLength <= geometry.springBaseLength + 2e-16);
    near(state.springExtension, state.carrierX, 0,
      'spring deflection equals carrier stroke');
    near(state.springLength, geometry.springBaseLength - state.carrierX, 1e-15,
      'compressed length');
    if (phase >= 0.10 && phase <= 0.36) {
      assert.ok(state.carrierX >= previousForwardX - 2e-15);
      previousForwardX = state.carrierX;
      if (state.clothEngaged && state.carrierVelocity > 0) {
        engagedForwardSamples += 1;
      }
    }
    if (phase >= 0.58 && phase <= 0.84) {
      assert.ok(state.carrierX <= previousReturnX + 2e-15);
      previousReturnX = state.carrierX;
      assert.equal(state.clothEngaged, false,
        `return must stay below work at phase ${phase}`);
    }
    if (state.carrierVelocity < -1e-10) {
      assert.equal(state.clothEngaged, false,
        `backward motion must not drag work at phase ${phase}`);
    }
  }
  assert.ok(engagedForwardSamples > 2500);
  disposeModel(model.root);
});

test('movement 400 retains nominal cam dwells, exact lift and finite-face feed limits', () => {
  const model = createMovementModel(catalog.movements[399]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const at = (phase) => stateAtTime(timeline.cycleDuration * phase);

  for (const phase of [0, 0.05, 0.90, 1]) {
    const state = at(phase);
    near(state.carrierX, 0, 1e-7, 'rear carrier limit against float32 face');
    near(state.rockerAngle, 0, 2e-15, 'lowered feed-bar angle');
  }
  for (const phase of [0.36, 0.42, 0.53, 0.58]) {
    near(at(phase).carrierX, geometry.feedStroke, 1e-7,
      'forward carrier limit');
  }
  const raisedAngle = at(0.30).rockerAngle;
  assert.ok(raisedAngle > 0);
  for (const phase of [0.22, 0.30, 0.40, 0.48]) {
    near(at(phase).rockerAngle, raisedAngle, 2e-15,
      'raised feed-bar limit');
  }
  for (const phase of [0.10, 0.36, 0.48, 0.58, 0.84]) {
    const state = at(phase);
    near(state.feedLaw.ratePerPhase, 0, 4e-13,
      'nominal carrier-control zero-speed handoff');
  }
  for (const phase of [0.10, 0.22, 0.48, 0.58]) {
    near(at(phase).liftLaw.ratePerPhase, 0, 4e-13,
      'lift zero-speed handoff');
  }
  disposeModel(model.root);
});

test('movement 400 contact-normal carrier velocity and differentiated acceleration match finite differences', () => {
  const model = createMovementModel(catalog.movements[399]);
  const { stateAtTime, timeline } = model.root.userData;
  const velocityEpsilon = 2e-6;
  const accelerationEpsilon = 2e-5;

  for (const phase of [0.12, 0.17, 0.25, 0.34, 0.61, 0.69, 0.77, 0.82]) {
    const time = timeline.cycleDuration * phase;
    const before = stateAtTime(time - velocityEpsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + velocityEpsilon);
    const velocity = (after.carrierX - before.carrierX)
      / (2 * velocityEpsilon);
    near(state.carrierVelocity, velocity, 1e-8,
      'analytic carrier velocity');

    const beforeAcceleration = stateAtTime(time - accelerationEpsilon);
    const afterAcceleration = stateAtTime(time + accelerationEpsilon);
    const acceleration = (
      afterAcceleration.carrierVelocity
      - beforeAcceleration.carrierVelocity
    ) / (2 * accelerationEpsilon);
    near(state.carrierAcceleration, acceleration, 1e-5,
      'differentiated contact-normal acceleration');
  }
  disposeModel(model.root);
});

test('movement 400 update binds the cam, fork pivot, feed bar, and stretched return spring', () => {
  const model = createMovementModel(catalog.movements[399]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime, timeline } = data;

  for (const phase of [0, 0.14, 0.25, 0.42, 0.53, 0.65, 0.80, 1]) {
    const time = timeline.cycleDuration * phase;
    const expected = stateAtTime(time);
    model.update(time, 0);
    model.root.updateMatrixWorld(true);
    near(blocks.cam.rotation.x, expected.camAngle, 0,
      'rendered cam angle');
    near(blocks.carrierA.position.x, expected.carrierX, 0,
      'rendered carrier position');
    near(blocks.feedBarB.position.x,
      expected.carrierX + geometry.pivotX, 0,
      'rendered feed-bar pivot x');
    near(blocks.feedBarB.position.y, geometry.pivotY, 0,
      'rendered feed-bar pivot y');
    near(blocks.feedBarB.rotation.z, expected.rockerAngle, 0,
      'rendered feed-bar angle');
    near(blocks.returnSpring.scale.x,
      expected.springLength / geometry.springBaseLength, 0,
      'rendered spring stretch');
    near(data.contacts.radialCamToBarB.residual, 0, 3e-16,
      'reported radial contact');
    near(data.contacts.axialCamToCarrierProjection.residual, 0, 1e-12,
      'reported axial contact');
  }
  disposeModel(model.root);
});
