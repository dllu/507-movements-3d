import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

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

test('movement 305 is one tiny single-pin disc inside one pendulum-carried Z-slot pallet plate', () => {
  const movement = catalog.movements[304];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    presentation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 305);
  assert.equal(movement.number, '305');
  assert.equal(movement.title,
    'Macdowall single-pin pendulum escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'clockwise-macdowall-single-ruby-pin-deadbeat-pendulum-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(presentation, /front elevation/);
  assert.match(mechanism, /one ruby pin/);
  assert.match(mechanism, /upper-left and lower-right/);
  assert.match(mechanism, /one clockwise half-turn per pendulum beat/);
  assert.equal(transmission.pinCount, 1);
  assert.equal(transmission.discAdvancePerBeatRadians, Math.PI);
  assert.equal(transmission.discTurnsPerPendulumCycle, 1);
  assert.match(transmission.direction, /clockwise/);
  assert.match(transmission.recoil, /^none/);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.palletAssembly.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.contactMarker.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.rubyPin.parent, blocks.wheelRotor);
  assert.equal(blocks.upperPallet.parent, blocks.palletAssembly);
  assert.equal(blocks.lowerPallet.parent, blocks.palletAssembly);
  assert.equal(blocks.upperDeadEdge.parent, blocks.palletAssembly);
  assert.equal(blocks.lowerDeadEdge.parent, blocks.palletAssembly);
  assert.equal(blocks.upperImpulseEdge.parent, blocks.palletAssembly);
  assert.equal(blocks.lowerImpulseEdge.parent, blocks.palletAssembly);
  assert.equal(blocks.adjustmentScrews.length, 2);
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'disc axis');
  vectorNear(blocks.palletAssembly.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'pendulum-pallet axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'single-eccentric-ruby-pin').length, 1);
  assert.equal(roles.filter((role) =>
    /concentric-horizontal-dead-face$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /upright-impulse-face$/.test(role)).length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 305 records Brown, Macdowall, the period figure, and the surviving demonstrator', () => {
  const movement = catalog.movements[304];
  const model = createMovementModel(movement);
  const {
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate305;
  const period = sourceReference.periodConstructionReference;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.match(sourceAnimation.referenceScope, /one-half-turn-per-beat/);
  assert.match(sourceAnimation.referenceScope, /1:60 eccentricity limit/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_305.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 5);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterPendulumPivot,
    new THREE.Vector2(264, 35));
  assert.deepEqual(plate.rasterDiskCenter,
    new THREE.Vector2(260, 380));
  assert.deepEqual(plate.rasterRubyPin,
    new THREE.Vector2(241, 380));
  assert.deepEqual(plate.rasterUpperPalletCorner,
    new THREE.Vector2(268, 340));
  assert.deepEqual(plate.rasterLowerPalletCorner,
    new THREE.Vector2(268, 419));
  assert.deepEqual(plate.rasterLeftAdjustment,
    new THREE.Vector2(224, 479));
  assert.deepEqual(plate.rasterRightAdjustment,
    new THREE.Vector2(297, 479));
  assert.match(plate.inferredTopology, /Z-like opening/);
  assert.match(plate.sourceDirection, /clockwise/);

  assert.equal(period.inventor, 'C. Macdowall');
  assert.equal(period.patentYear, 1851);
  assert.equal(period.publicationYear, 1878);
  assert.equal(period.figure, 7);
  assert.match(period.publication, /Encyclopaedia Britannica/);
  assert.match(period.description, /half a revolution at every beat/);
  assert.match(period.constructionRule, /one-sixtieth/);
  assert.match(period.url, /wikisource\.org/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 75,
    edition: 21,
    illustrationPage: 74,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.survivingModelReference.collection,
    'Franklin Institute escapement collection');
  assert.match(sourceReference.survivingModelReference.credit,
    /Macdowall/);
  assert.match(sourceReference.survivingModelReference.url,
    /commons\.wikimedia\.org/);
  disposeModel(model.root);
});

test('movement 305 uses the historical one-to-sixty eccentricity rule and exactly one working pin', () => {
  const model = createMovementModel(catalog.movements[304]);
  const { blocks, geometry } = model.root.userData;

  assert.equal(geometry.pinCount, 1);
  near(geometry.eccentricityRatio, 1 / 60, 0,
    'historic eccentricity ratio');
  near(geometry.pinOrbitRadius,
    geometry.centerDistance / 60, 1e-15,
  'ruby-pin eccentricity');
  near(geometry.faceEquationScale, 60, 1e-13,
    'upright-face equation scale');
  near(geometry.escapeAngle,
    Math.atan(1 / 60), 1e-15, 'escape angle');
  assert.ok(geometry.escapeAngle < THREE.MathUtils.degToRad(1),
    'escape angle remains below one degree');
  assert.ok(geometry.diskRadius < geometry.centerDistance / 10,
    'escape disc remains very small compared with the centre distance');
  assert.ok(geometry.pinOrbitRadius < geometry.diskRadius / 4,
    'the ruby pin is close to the disc arbor');
  near(blocks.rubyPin.position.x, geometry.pinOrbitRadius, 0,
    'single pin radial location');
  near(blocks.rubyPin.userData.eccentricity,
    geometry.pinOrbitRadius, 0, 'published pin eccentricity');
  assert.equal(blocks.rubyPin.userData.material, 'ruby');
  disposeModel(model.root);
});

test('movement 305 advances clockwise by exactly one half-turn per beat and one turn per pendulum cycle', () => {
  const model = createMovementModel(catalog.movements[304]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let halfBeat = -2; halfBeat <= 4; halfBeat += 1) {
    const start = stateAtTime(halfBeat * geometry.halfBeatDuration);
    const end = stateAtTime((halfBeat + 1) * geometry.halfBeatDuration);
    near(end.wheelAngle - start.wheelAngle, -Math.PI, 1e-12,
      `half-turn at beat ${halfBeat}`);
    vectorNear(end.pinCenter,
      model.root.userData.pinCenterAtWheelAngle(start.wheelAngle - Math.PI),
      1e-14, `opposite pin location at beat ${halfBeat}`);
  }
  const cycleStart = stateAtTime(0);
  const cycleEnd = stateAtTime(geometry.pendulumPeriod);
  near(cycleEnd.wheelAngle - cycleStart.wheelAngle,
    -FULL_TURN, 1e-12, 'one clockwise disc turn per cycle');
  vectorNear(cycleEnd.pinCenter, cycleStart.pinCenter, 1e-14,
    'single pin closes spatially');
  near(cycleEnd.pendulumAngle, cycleStart.pendulumAngle, 1e-14,
    'pendulum closes spatially');
  disposeModel(model.root);
});

const FULL_TURN = Math.PI * 2;

test('movement 305 dead faces are concentric with the pendulum pivot and produce exactly zero recoil', () => {
  const model = createMovementModel(catalog.movements[304]);
  const {
    geometry,
    palletFaces,
    stateAtTime,
  } = model.root.userData;

  near(palletFaces.upper.deadFaceRadius,
    geometry.lockCenterRadius - geometry.pinRadius, 0,
  'upper inner concentric rest radius');
  near(palletFaces.lower.deadFaceRadius,
    geometry.lockCenterRadius + geometry.pinRadius, 0,
  'lower outer concentric rest radius');
  near(palletFaces.lower.deadFaceRadius
    - palletFaces.upper.deadFaceRadius,
  2 * geometry.pinRadius, 1e-15, 'finite-pin face separation');
  for (const face of [palletFaces.upper, palletFaces.lower]) {
    for (const point of face.deadFacePoints) {
      near(point.length(), face.deadFaceRadius, 1e-12,
        `${face.position} rest is concentric`);
    }
  }

  for (const [start, end] of [
    [0.05, 0.75],
    [1.25, 1.95],
    [2.05, 2.75],
    [3.25, 3.95],
  ]) {
    const first = stateAtTime(start);
    const middle = stateAtTime((start + end) / 2);
    const last = stateAtTime(end);
    assert.equal(first.contactKind, 'dead-rest');
    assert.equal(middle.contactKind, 'dead-rest');
    assert.equal(last.contactKind, 'dead-rest');
    near(middle.wheelAngle, first.wheelAngle, 0,
      `${start} dead-rest wheel is stationary`);
    near(last.wheelAngle, first.wheelAngle, 0,
      `${end} dead-rest wheel is stationary`);
    assert.ok(first.contactError < 1e-12);
    assert.ok(middle.contactError < 1e-12);
    assert.ok(last.contactError < 1e-12);
  }
  disposeModel(model.root);
});

test('movement 305 alternates exact upper and lower upright-face impulse constraints', () => {
  const model = createMovementModel(catalog.movements[304]);
  const {
    geometry,
    impulseFaceCenterlineError,
    palletFaces,
    stateAtTime,
  } = model.root.userData;

  assert.equal(palletFaces.upper.impulseCenterlineX, 0);
  assert.equal(palletFaces.lower.impulseCenterlineX, 0);
  near(palletFaces.upper.impulseFaceX,
    -geometry.pinRadius, 0, 'upper solid lies left of pin centre');
  near(palletFaces.lower.impulseFaceX,
    geometry.pinRadius, 0, 'lower solid lies right of pin centre');
  for (const side of ['upper', 'lower']) {
    for (const fraction of [-1, -0.5, 0, 0.5, 1]) {
      const palletAngle = fraction * geometry.contactAngle;
      near(impulseFaceCenterlineError(side, palletAngle), 0, 3e-17,
        `${side} generated centreline at ${fraction}`);
    }
  }

  const upper = stateAtTime(geometry.halfBeatDuration / 2);
  const lower = stateAtTime(geometry.halfBeatDuration * 1.5);
  assert.equal(upper.mode, 'upper-upright-impulse');
  assert.equal(lower.mode, 'lower-upright-impulse');
  assert.equal(upper.activeFace, 'upper-upright-impulse-face');
  assert.equal(lower.activeFace, 'lower-upright-impulse-face');
  assert.ok(upper.contactError < 1e-14);
  assert.ok(lower.contactError < 1e-14);
  near(upper.pinCenter.distanceTo(upper.contactPoint),
    geometry.pinRadius, 1e-14, 'upper finite-pin contact');
  near(lower.pinCenter.distanceTo(lower.contactPoint),
    geometry.pinRadius, 1e-14, 'lower finite-pin contact');
  assert.ok(upper.pinCenterLocal.y > geometry.diskCenter.y
    - geometry.palletPivot.y, 'upper pin traverses above the disc arbor');
  assert.ok(lower.pinCenterLocal.y < geometry.diskCenter.y
    - geometry.palletPivot.y, 'lower pin traverses below the disc arbor');
  disposeModel(model.root);
});

test('movement 305 state remains monotone, finite, periodic, and exposes both free drops', () => {
  const model = createMovementModel(catalog.movements[304]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  const modes = new Set();
  let previousAngle = stateAtTime(0).wheelAngle;

  for (let index = 1; index <= 20_000; index += 1) {
    const time = geometry.pendulumPeriod * index / 20_000;
    const state = stateAtTime(time);
    modes.add(state.mode);
    assert.ok(state.wheelAngle <= previousAngle + 1e-12,
      `disc never reverses at sample ${index}`);
    previousAngle = state.wheelAngle;
    for (const value of [
      state.beatAdvance,
      state.halfPhase,
      state.pendulumAngle,
      state.pendulumAngularSpeed,
      state.wheelAngle,
      state.wheelAngularSpeed,
    ]) assert.equal(Number.isFinite(value), true);
  }
  assert.deepEqual([...modes].sort(), [
    'lower-right-dead-rest',
    'lower-right-landing-drop',
    'lower-right-release-drop',
    'lower-upright-impulse',
    'upper-left-dead-rest',
    'upper-left-landing-drop',
    'upper-left-release-drop',
    'upper-upright-impulse',
  ]);
  assert.equal(timeline.demonstrationPeriod, geometry.pendulumPeriod);
  assert.equal(timeline.schedule.length, 8);
  assert.deepEqual(timeline.schedule.filter((entry) =>
    entry.includes('upright-face-impulse')), [
    'upper-upright-face-impulse',
    'lower-upright-face-impulse',
  ]);
  disposeModel(model.root);
});

test('movement 305 renderer follows the exact state and leaves movement 507 authored', () => {
  const movement = catalog.movements[304];
  const model = createMovementModel(movement);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.83, 1, 1.17, 2, 2.83, 3, 3.17, 4]) {
    model.update(time, 0.016);
    const state = stateAtTime(time);
    near(blocks.palletAssembly.rotation.z,
      state.pendulumAngle, 0, `pallet angle at ${time}`);
    near(blocks.wheelRotor.rotation.z,
      state.wheelAngle, 0, `disc angle at ${time}`);
    assert.equal(blocks.contactMarker.visible,
      state.contactPoint !== null);
    assert.equal(blocks.contactMarker.userData.activeFace,
      state.activeFace);
    blocks.rubyPin.updateWorldMatrix(true, false);
    const pinWorld = blocks.rubyPin.getWorldPosition(new THREE.Vector3());
    vectorNear(new THREE.Vector2(pinWorld.x, pinWorld.y),
      state.pinCenter, 1e-12, `rendered pin center at ${time}`);
    if (state.contactPoint) {
      vectorNear(new THREE.Vector2(
        blocks.contactMarker.position.x,
        blocks.contactMarker.position.y,
      ), state.contactPoint, 1e-12, `contact marker at ${time}`);
    }
  }
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, geometry.pendulumPeriod);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  assertReadableTiming(model.root.userData.animationTiming);

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
