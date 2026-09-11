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

test('movement 378 is one pendulum-driven bow saw in a counterweighted vertical-feed carriage above one lying tree', () => {
  const movement = catalog.movements[377];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 378);
  assert.equal(movement.number, '378');
  assert.equal(movement.category, 'Springs & balances');
  assert.equal(
    movement.archetype,
    'pendulum-rod-slider-counterweighted-bow-saw',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-swinging-pendulum/);
  assert.match(data.mechanism, /one-constant-length-connecting-rod/);
  assert.match(data.mechanism, /horizontal-bow-saw-slider/);
  assert.match(data.mechanism, /counterweighted-u-carriage/);
  assert.match(data.mechanism, /lying-tree/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 2);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(degreesOfFreedom.inputs.length, 2);
  assert.match(degreesOfFreedom.inputs[0], /pendulum oscillation/);
  assert.match(degreesOfFreedom.inputs[1], /vertical carriage feed/);
  assert.match(degreesOfFreedom.note, /rigid connecting rod/);
  assert.match(degreesOfFreedom.note, /constant-length rope/);

  for (const component of [
    blocks.carriage,
    blocks.connectingRod,
    ...blocks.counterweights,
    blocks.fixedFrame,
    ...blocks.groundRails,
    blocks.log,
    blocks.pendulum,
    blocks.pendulumFrame,
    ...blocks.pulleyRoots,
    ...blocks.ropeArcs,
    ...blocks.ropeSegments,
    blocks.saw,
    blocks.sawPinMarker,
  ]) assert.equal(component.parent, model.root);
  for (const component of [
    ...blocks.carriageAnchors,
    blocks.carriageGuide,
    ...blocks.carriageSides,
    blocks.carriageTop,
  ]) assert.equal(component.parent, blocks.carriage);
  for (const component of [
    blocks.pendulumBob,
    blocks.pendulumIndex,
    blocks.pendulumRod,
    blocks.rodJointPin,
  ]) assert.equal(component.parent, blocks.pendulum);
  for (const component of [
    blocks.sawBlade,
    ...blocks.sawHandles,
    ...blocks.sawTeeth,
    blocks.sawTop,
  ]) assert.equal(component.parent, blocks.saw);
  assert.equal(blocks.pulleyRoots.length, 2);
  assert.equal(blocks.counterweights.length, 2);
  assert.equal(blocks.ropeArcs.length, 2);
  assert.equal(blocks.ropeSegments.length, 4);
  assert.equal(blocks.carriageSides.length, 2);
  assert.equal(blocks.sawHandles.length, 2);
  assert.equal(blocks.sawTeeth.length, 27);
  assert.equal(blocks.log.userData.fixed, true);
  assert.equal(blocks.fixedFrame.userData.fixed, true);
  assert.equal(blocks.pendulumFrame.userData.fixed, true);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'prescribed-small-angle-pendulum-driving-lower-rod-joint',
    'constant-length-rod-from-pendulum-pin-to-horizontal-saw-slider',
    'vertically-fed-u-shaped-horizontal-saw-guide-carriage',
    'bow-saw-translating-horizontally-with-fed-guide',
    'horizontal-crosscut-saw-blade',
    'one-of-two-carriage-balancing-counterweights',
    'fixed-lying-tree-log-beneath-saw',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 378 records Brown, the measured engraving, and the official animation evidence while disclosing engineered timing and feed', () => {
  const movement = catalog.movements[377];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate378;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_378.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Saw for cutting trees/);
  assert.match(movement.description, /motion of pendulum/);
  assert.match(movement.description, /lying tree/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(
    sourceAnimation
      .sourceShowsThreePendulumOscillationsDuringOneDownwardFeedPass,
    true,
  );
  assert.equal(
    dynamics.sourceSpecifiesPendulumPeriodRodLengthFeedRateOrMasses,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);
  assert.match(dynamics.treatment, /pendulum pin/);
  assert.match(dynamics.treatment, /horizontal rigid-rod slider/);
  assert.match(dynamics.treatment, /paired pulleys/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 9);
  assert.deepEqual(plate.pendulumPivot.toArray(), [86, 146]);
  assert.deepEqual(plate.pendulumBobCenter.toArray(), [90, 374]);
  assert.deepEqual(plate.frameTopLeft.toArray(), [165, 222]);
  assert.deepEqual(plate.frameTopRight.toArray(), [484, 224]);
  assert.deepEqual(plate.leftPulleyCenter.toArray(), [181, 275]);
  assert.deepEqual(plate.rightPulleyCenter.toArray(), [478, 279]);
  assert.deepEqual(plate.logCenter.toArray(), [326, 432]);
  assert.equal(evidence.explicitInBrownDescription.length, 3);
  assert.match(evidence.officialAnimationEvidence, /constant-length green link/);
  assert.match(evidence.officialAnimationEvidence, /blue U-shaped/);
  assert.match(evidence.officialAnimationEvidence, /two green ropes/);
  assert.match(evidence.reconstructionDisclosure, /7.19-degree half swing/);
  assert.match(evidence.reconstructionDisclosure, /independently engineered/);
  disposeModel(model.root);
});

test('movement 378 pendulum follows the measured small-angle sinusoid with exact position, velocity, and acceleration', () => {
  const model = createMovementModel(catalog.movements[377]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  const expectedAmplitude = Math.atan2(
    geometry.officialHalfSwingVector.x,
    geometry.officialHalfSwingVector.y,
  );
  const step = 1e-6;

  near(geometry.pendulumAmplitude, expectedAmplitude, 0,
    'source-observed pendulum half swing');
  near(stateAtTime(geometry.pendulumPeriod / 4).pendulumAngle,
    geometry.pendulumAmplitude, 0, 'positive swing extreme');
  near(stateAtTime(3 * geometry.pendulumPeriod / 4).pendulumAngle,
    -geometry.pendulumAmplitude, 0, 'negative swing extreme');
  for (let sample = -360; sample <= 720; sample += 1) {
    const time = geometry.pendulumPeriod * sample / 360 + 0.003;
    const state = stateAtTime(time);
    const before = stateAtTime(time - step);
    const after = stateAtTime(time + step);
    const numericalAngularSpeed = (
      after.pendulumAngle - before.pendulumAngle
    ) / (2 * step);
    const numericalAngularAcceleration = (
      after.pendulumAngularSpeed - before.pendulumAngularSpeed
    ) / (2 * step);
    near(numericalAngularSpeed, state.pendulumAngularSpeed, 2e-10,
      'pendulum angular-speed derivative');
    near(numericalAngularAcceleration,
      state.pendulumAngularAcceleration, 2e-10,
      'pendulum angular-acceleration derivative');
    vectorNear(state.rodJoint, geometry.pendulumPivot.clone().add(
      new THREE.Vector3(
        Math.sin(state.pendulumAngle)
          * geometry.rodAttachmentRadius,
        -Math.cos(state.pendulumAngle)
          * geometry.rodAttachmentRadius,
        0,
      ),
    ), 0, 'lower pin rigidly follows pendulum');
    near(state.rodJoint.distanceTo(geometry.pendulumPivot),
      geometry.rodAttachmentRadius, 5e-16,
      'lower pin radius');
  }
  disposeModel(model.root);
});

test('movement 378 rigid connecting rod selects the right-hand intersection with the moving horizontal guide and gives derivative-consistent saw velocity', () => {
  const model = createMovementModel(catalog.movements[377]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;
  const step = 1e-6;

  assert.match(transmission.pendulumSliderLaw, /right-hand intersection/);
  assert.match(transmission.pendulumSliderLaw, /circle/);
  for (let sample = -1800; sample <= 3600; sample += 1) {
    const time = data.timeline.demonstrationPeriod
      * sample / 1800 + 0.001;
    const state = stateAtTime(time);
    assert.ok(state.horizontalRodProjection > 0,
      'right-hand assembly branch stays feasible');
    assert.ok(state.sawPin.x > state.rodJoint.x,
      'saw pin remains to right of pendulum pin');
    near(state.sawPin.y, state.guideY, 0,
      'saw pin lies on horizontal guide');
    near(state.sawPin.z, geometry.sawPinZ, 0,
      'saw and pendulum rod share one working plane');
    near(state.rodJoint.distanceTo(state.sawPin),
      geometry.connectingRodLength, 5e-16,
      'rigid connecting-rod length');
    const before = stateAtTime(time - step);
    const after = stateAtTime(time + step);
    vectorNear(
      after.sawPin.clone().sub(before.sawPin)
        .multiplyScalar(1 / (2 * step)),
      state.sawPinVelocity,
      6e-9,
      'analytic saw-pin velocity',
    );
  }
  near(transmission.pendulumJointHorizontalSweep,
    2 * geometry.rodAttachmentRadius
      * Math.sin(geometry.pendulumAmplitude),
    0, 'published pendulum-pin horizontal sweep');
  disposeModel(model.root);
});

test('movement 378 carriage feed and both opposing counterweights preserve two exact constant-length ropes', () => {
  const model = createMovementModel(catalog.movements[377]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;
  const start = stateAtTime(0);
  const bottom = stateAtTime(data.timeline.demonstrationPeriod / 2);

  near(start.guideY, geometry.feedMeanY + geometry.feedAmplitude, 0,
    'feed begins raised');
  near(bottom.guideY, geometry.feedMeanY - geometry.feedAmplitude, 0,
    'feed reaches cutting depth at half-cycle');
  assert.ok(bottom.counterweightY > start.counterweightY,
    'counterweights rise as carriage descends');
  assert.match(transmission.feedCounterweightLaw, /rises by exactly/);
  for (let sample = -1500; sample <= 3000; sample += 1) {
    const state = stateAtTime(data.timeline.demonstrationPeriod
      * sample / 1500);
    near(state.counterweightY + state.guideY,
      geometry.counterweightMeanY + geometry.feedMeanY,
      2e-16, 'equal and opposite carriage/counterweight travel');
    near(state.counterweightVelocity, -state.guideVelocity, 0,
      'equal and opposite carriage/counterweight velocity');
    for (let side = 0; side < 2; side += 1) {
      near(state.ropeLengths[side],
        transmission.constantRopeLength, 5e-16,
        `side ${side} constant rope length`);
    }
  }
  disposeModel(model.root);
});

test('movement 378 equal rope pulleys obey no slip and rotate oppositely at the feed speed divided by radius', () => {
  const model = createMovementModel(catalog.movements[377]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;

  assert.match(transmission.pulleyNoSlipLaw, /rotate oppositely/);
  assert.match(transmission.pulleyNoSlipLaw, /divided by pulley radius/);
  for (let sample = -1200; sample <= 2400; sample += 1) {
    const state = stateAtTime(data.timeline.demonstrationPeriod
      * sample / 1200);
    near(state.pulleyAngularSpeeds[0] * geometry.pulleyRadius,
      state.guideVelocity, 6e-17,
      'left inner tangent no slip');
    near(state.pulleyAngularSpeeds[1] * geometry.pulleyRadius,
      -state.guideVelocity, 6e-17,
      'right inner tangent no slip');
    near(state.pulleyAngularSpeeds[0],
      -state.pulleyAngularSpeeds[1], 0,
      'equal pulleys rotate oppositely');
    near(state.pulleyAngles[0] - geometry.pulleyStartAngles[0],
      -(state.pulleyAngles[1] - geometry.pulleyStartAngles[1]),
      2e-16, 'opposite accumulated pulley travel');
  }
  disposeModel(model.root);
});

test('movement 378 renderer binds pendulum, fed carriage, saw, rigid rod, ropes, counterweights, and pulley indices to state', () => {
  const model = createMovementModel(catalog.movements[377]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const fixedFramePosition = blocks.fixedFrame.position.clone();
  const logPosition = blocks.log.position.clone();

  for (let frame = 0; frame <= 720; frame += 1) {
    const time = data.timeline.demonstrationPeriod * frame / 720;
    const expected = stateAtTime(time);
    model.update(time, 0.016);
    near(blocks.pendulum.rotation.z, expected.pendulumAngle, 0,
      'rendered pendulum angle');
    near(blocks.carriage.position.y, expected.guideY, 0,
      'rendered carriage feed');
    vectorNear(blocks.saw.position, expected.sawPin, 0,
      'rendered saw pin translation');
    vectorNear(blocks.sawPinMarker.position, expected.sawPin, 0,
      'rendered guide pin marker');
    for (let side = 0; side < 2; side += 1) {
      near(blocks.counterweights[side].position.y,
        expected.counterweightY, 0,
        `rendered counterweight ${side}`);
      near(blocks.pulleyRoots[side].userData.rotor.rotation.z,
        expected.pulleyAngles[side], 0,
        `rendered pulley ${side}`);
    }
    blocks.connectingRod.updateMatrixWorld(true);
    const renderedStart = blocks.connectingRod.localToWorld(
      new THREE.Vector3(-0.5, 0, 0),
    );
    const renderedEnd = blocks.connectingRod.localToWorld(
      new THREE.Vector3(0.5, 0, 0),
    );
    vectorNear(renderedStart, expected.rodJoint, 8e-16,
      'rendered rigid rod pendulum endpoint');
    vectorNear(renderedEnd, expected.sawPin, 8e-16,
      'rendered rigid rod saw endpoint');
    vectorNear(blocks.fixedFrame.position, fixedFramePosition, 0,
      'overhead frame remains fixed');
    vectorNear(blocks.log.position, logPosition, 0,
      'lying tree remains fixed');
    for (const residual of Object.values(data.constraintResiduals)) {
      near(residual, 0, 5e-16, 'published renderer constraint residual');
    }
  }
  assert.ok(geometry.logLength > geometry.logRadius * 2,
    'tree is a lying log rather than a disk');
  disposeModel(model.root);
});

test('movement 378 closes six pendulum strokes and one smooth feed-return cycle before movement 507 remains the next authored draft', () => {
  const movement = catalog.movements[377];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.demonstrationPeriod);

  near(closure.pendulumPhase - start.pendulumPhase,
    geometry.pendulumCyclesPerDemonstration * FULL_TURN, 0,
    'six unwrapped pendulum cycles');
  near(closure.feedPhase - start.feedPhase, FULL_TURN, 0,
    'one unwrapped feed-return cycle');
  angleNear(closure.pendulumAngle, start.pendulumAngle, 0,
    'pendulum pose closes');
  vectorNear(closure.rodJoint, start.rodJoint, 5e-16,
    'pendulum lower pin closes');
  vectorNear(closure.sawPin, start.sawPin, 6e-16,
    'saw position closes');
  near(closure.guideY, start.guideY, 0,
    'carriage feed closes');
  near(closure.counterweightY, start.counterweightY, 0,
    'counterweights close');
  for (let side = 0; side < 2; side += 1) {
    angleNear(closure.pulleyAngles[side],
      start.pulleyAngles[side], 0,
      `pulley ${side} closes`);
  }
  assert.equal(timeline.demonstrationPeriod,
    geometry.pendulumPeriod * geometry.pendulumCyclesPerDemonstration);
  assert.equal(data.animationTiming.authoredCyclePeriod,
    timeline.demonstrationPeriod);
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
