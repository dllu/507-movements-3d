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
    } else if (object.material) {
      materials.add(object.material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 306 is one open three-leg wheel behind one pendulum-carried upper/lower pallet plate', () => {
  const movement = catalog.movements[305];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    presentation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 306);
  assert.equal(movement.number, '306');
  assert.equal(movement.title,
    'Denison three-legged half-dead pendulum escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'clockwise-denison-three-leg-half-dead-direct-impulse-pendulum-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(presentation, /full-size-style front elevation/);
  assert.match(mechanism, /three lightweight 120-degree-spaced wheel legs/);
  assert.match(mechanism, /upper and lower pallets cut into one/);
  assert.match(mechanism, /clockwise 60-degree step/);
  assert.match(mechanism, /recoil slightly/);
  assert.equal(transmission.toothCount, 3);
  assert.match(transmission.direction, /clockwise/);
  assert.match(transmission.recoil, /intentional half-dead recoil/);

  assert.equal(blocks.wheel.parent, model.root);
  assert.equal(blocks.palletAssembly.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.contactMarker.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.wheel);
  assert.equal(blocks.plateCarrier.parent, blocks.palletAssembly);
  assert.equal(blocks.plate.parent, blocks.plateCarrier);
  assert.equal(blocks.legMeshes.length, 3);
  assert.equal(blocks.toothTips.length, 3);
  assert.equal(blocks.screwMeshes.length, 4);
  assert.equal(blocks.faceEdges.length, 4);
  assert.ok(blocks.legMeshes.every((leg) =>
    leg.parent === blocks.wheelRotor));
  assert.ok(blocks.toothTips.every((tip) =>
    tip.parent === blocks.wheelRotor));
  vectorNear(blocks.wheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'wheel axis');
  vectorNear(blocks.palletAssembly.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'remote pallet axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'three-legged-wheel-arm-and-working-tooth').length, 3);
  assert.equal(roles.filter((role) =>
    role === 'sharp-three-leg-working-tip').length, 3);
  assert.equal(roles.filter((role) =>
    /generated-direct-impulse-face$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /generated-half-dead-stopping-face$/.test(role)).length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 306 records Brown’s plate and Beckett’s full-size Westminster construction evidence', () => {
  const movement = catalog.movements[305];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate306;
  const construction = sourceReference.periodConstructionReference;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.match(sourceAnimation.referenceScope, /60-degree alternating beat/);
  assert.match(sourceAnimation.referenceScope, /24:1 centre-distance/);
  assert.match(sourceAnimation.referenceScope, /half-dead stopping faces/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_306.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 6);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterPlateBounds, {
    bottom: 395,
    left: 14,
    right: 510,
    top: 159,
  });
  assert.deepEqual(plate.rasterWheelCenter,
    new THREE.Vector2(265, 273));
  assert.deepEqual(plate.rasterUpperWorkingTooth,
    new THREE.Vector2(277, 181));
  assert.deepEqual(plate.rasterLowerRightTooth,
    new THREE.Vector2(328, 346));
  assert.deepEqual(plate.rasterLowerLeftTooth,
    new THREE.Vector2(178, 318));
  assert.equal(plate.rasterScrews.length, 4);
  assert.match(plate.inferredTopology, /three-leg open wheel/);
  assert.match(plate.shownAction, /upper tooth.*right/);
  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 0, 'source wheel center');
  near((plate.rasterPlateBounds.right - plate.rasterPlateBounds.left)
    * geometry.sourceScale,
  geometry.plateWidth, 1e-15, 'source plate width');

  assert.equal(construction.author,
    'Edmund Beckett, Lord Grimthorpe');
  assert.equal(construction.designDate, 1851);
  assert.equal(construction.publicationYear, 1903);
  assert.equal(construction.publicationEdition, 8);
  assert.equal(construction.figure, 17);
  assert.equal(construction.page, 71);
  assert.match(construction.figureScale, /full-sized view/);
  assert.match(construction.figureScale, /Westminster/);
  assert.match(construction.construction, /twenty-four times/);
  assert.match(construction.construction, /one-eighth wheel radius/);
  assert.match(construction.operatingEvidence, /most direct part/);
  assert.match(construction.operatingEvidence, /slight recoil/);
  assert.match(construction.wheelMass, /73 grains/);
  assert.match(construction.url, /campaners\.com/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 306 obeys the three-leg pitch, 24-radius spacing, one-degree escape, and lower-pallet depth limit', () => {
  const model = createMovementModel(catalog.movements[305]);
  const { geometry, palletFaces, transmission } = model.root.userData;

  assert.equal(geometry.toothCount, 3);
  near(geometry.toothPitch, FULL_TURN / 3, 1e-15,
    'three-leg pitch');
  near(geometry.wheelAdvancePerBeat, Math.PI / 3, 1e-15,
    'half-pitch beat advance');
  near(geometry.centerDistanceRatio, 24, 0,
    'period center-distance ratio');
  near(geometry.centerDistance,
    24 * geometry.toothTipRadius, 1e-15,
  'pallet-to-wheel center distance');
  near(geometry.escapeAngle,
    THREE.MathUtils.degToRad(1), 0, 'one-degree escape');
  assert.ok(geometry.pendulumAmplitude
    < THREE.MathUtils.degToRad(2), 'swing remains below two degrees');
  near(geometry.lowerPalletDepthLimit,
    geometry.toothTipRadius / 8, 0, 'one-eighth depth limit');
  near(palletFaces.lower.maximumDepth,
    geometry.lowerPalletMaximumDepth, 0, 'modeled lower depth');
  assert.ok(geometry.lowerPalletMaximumDepth
    < geometry.lowerPalletDepthLimit);
  near(transmission.wheelAdvancePerBeatRadians,
    geometry.wheelAdvancePerBeat, 0, 'published beat advance');
  assert.equal(transmission.wheelTurnsPerSixBeats, 1);
  disposeModel(model.root);
});

test('movement 306 advances exactly sixty clockwise degrees each beat and alternates all three teeth', () => {
  const model = createMovementModel(catalog.movements[305]);
  const { geometry, stateAtTime } = model.root.userData;
  const startingTeeth = [];

  for (let beat = -2; beat <= 6; beat += 1) {
    const start = stateAtTime(beat * geometry.halfBeatDuration);
    const end = stateAtTime((beat + 1) * geometry.halfBeatDuration);
    near(end.wheelAngle - start.wheelAngle,
      -geometry.wheelAdvancePerBeat, 1e-12,
    `clockwise sixty-degree step at beat ${beat}`);
    startingTeeth.push(start.startToothIndex);
    assert.equal(start.impulseSide,
      positiveModulo(beat, 2) === 0 ? 'upper' : 'lower');
  }
  assert.deepEqual(startingTeeth.slice(2, 8), [0, 2, 1, 0, 2, 1]);
  const sixBeatStart = stateAtTime(0);
  const sixBeatEnd = stateAtTime(6 * geometry.halfBeatDuration);
  near(sixBeatEnd.wheelAngle - sixBeatStart.wheelAngle,
    -FULL_TURN, 1e-12, 'one complete turn in six beats');
  vectorNear(
    model.root.userData.toothTipAt(
      sixBeatEnd.wheelAngle,
      sixBeatEnd.startToothIndex,
    ),
    sixBeatEnd.activeToothTip,
    1e-14,
    'six-beat active tooth identity',
  );
  disposeModel(model.root);
});

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

test('movement 306 half-dead stopping faces produce the intended small symmetric recoil', () => {
  const model = createMovementModel(catalog.movements[305]);
  const {
    geometry,
    palletFaces,
    stateAtTime,
    wheelAngleAtBeatStart,
  } = model.root.userData;

  for (const [extremeTime, side] of [[0, 'upper'], [2, 'lower']]) {
    const extreme = stateAtTime(extremeTime);
    const before = stateAtTime(extremeTime - 0.22);
    const after = stateAtTime(extremeTime + 0.22);
    assert.equal(extreme.contactKind, 'half-dead-rest');
    assert.equal(extreme.activeSide, side);
    near(extreme.recoil, geometry.halfDeadRecoil, 1e-15,
      `${side} maximum recoil`);
    near(extreme.wheelAngle,
      wheelAngleAtBeatStart(extreme.halfBeatIndex)
        + geometry.halfDeadRecoil,
    1e-15, `${side} wheel recoils opposite its clockwise advance`);
    near(before.recoil, after.recoil, 1e-12,
      `${side} recoil is symmetric around the extreme`);
    vectorNear(before.contactPointLocal, after.contactPointLocal, 1e-12,
      `${side} tooth retraces one half-dead face`);
    assert.ok(extreme.contactError < 1e-12);
    assert.ok(before.contactError < 1e-12);
    assert.ok(after.contactError < 1e-12);
  }
  for (const face of [palletFaces.upper, palletFaces.lower]) {
    assert.ok(face.stoppingPoints.length >= 30);
    assert.ok(face.stoppingPoints[0].distanceTo(
      face.stoppingPoints.at(-1)) > 0.1,
    'half-dead stopping profile has finite travel');
  }
  disposeModel(model.root);
});

test('movement 306 gives exact rightward upper and leftward lower direct impulses on generated pallet faces', () => {
  const model = createMovementModel(catalog.movements[305]);
  const {
    geometry,
    palletFaces,
    stateAtTime,
  } = model.root.userData;
  const upper = stateAtTime(geometry.halfBeatDuration / 2);
  const lower = stateAtTime(geometry.halfBeatDuration * 1.5);

  assert.equal(upper.mode, 'upper-direct-impulse');
  assert.equal(lower.mode, 'lower-direct-impulse');
  assert.equal(upper.activeFace,
    'upper-generated-direct-impulse-face');
  assert.equal(lower.activeFace,
    'lower-generated-direct-impulse-face');
  assert.equal(upper.activeToothIndex, 0);
  assert.equal(lower.activeToothIndex, 2);
  assert.ok(upper.palletAngularSpeed > 0,
    'upper tooth drives plate rightward');
  assert.ok(lower.palletAngularSpeed < 0,
    'lower tooth drives plate leftward');
  assert.ok(upper.wheelAngularSpeed < 0);
  assert.ok(lower.wheelAngularSpeed < 0);
  assert.ok(upper.contactError < 1e-12);
  assert.ok(lower.contactError < 1e-12);
  vectorNear(upper.contactPoint, upper.activeToothTip, 1e-12,
    'upper point contact');
  vectorNear(lower.contactPoint, lower.activeToothTip, 1e-12,
    'lower point contact');

  for (const [beat, points] of [
    [0, palletFaces.upper.impulsePoints],
    [1, palletFaces.lower.impulsePoints],
  ]) {
    for (const index of [0, 10, 20, 30, 40]) {
      const halfPhase = THREE.MathUtils.lerp(
        geometry.releaseHalfPhase,
        geometry.impulseEndHalfPhase,
        index / 40,
      );
      const state = stateAtTime(
        (beat + halfPhase) * geometry.halfBeatDuration,
      );
      vectorNear(state.contactPointLocal, points[index], 1e-12,
        `${beat === 0 ? 'upper' : 'lower'} profile sample ${index}`);
    }
  }
  disposeModel(model.root);
});

test('movement 306 preserves a finite non-contact clearance drop before every alternate pallet landing', () => {
  const model = createMovementModel(catalog.movements[305]);
  const { geometry, stateAtTime, timeline, transmission } =
    model.root.userData;

  for (let beat = 0; beat < 4; beat += 1) {
    const impulseEndTime = (
      beat + geometry.impulseEndHalfPhase
    ) * geometry.halfBeatDuration;
    const dropMiddleTime = (
      beat + (geometry.impulseEndHalfPhase
        + geometry.landingHalfPhase) / 2
    ) * geometry.halfBeatDuration;
    const landingTime = (
      beat + geometry.landingHalfPhase
    ) * geometry.halfBeatDuration;
    const impulseEnd = stateAtTime(impulseEndTime);
    const drop = stateAtTime(dropMiddleTime);
    const landing = stateAtTime(landingTime);
    assert.equal(impulseEnd.contactKind, 'direct-impulse');
    assert.equal(drop.contactKind, 'clearance-drop');
    assert.equal(drop.contactPoint, null);
    assert.equal(landing.contactKind, 'half-dead-rest');
    assert.equal(landing.activeSide,
      impulseEnd.activeSide === 'upper' ? 'lower' : 'upper');
    near(landing.beatAdvance - impulseEnd.beatAdvance,
      geometry.clearanceDropAngle, 1e-12,
    `finite wheel drop at beat ${beat}`);
  }
  near(geometry.impulseAdvance + geometry.clearanceDropAngle,
    geometry.wheelAdvancePerBeat, 1e-15,
  'impulse and drop partition the sixty-degree step');
  assert.match(transmission.clearance, /finite 2.4-degree wheel drop/);
  assert.equal(timeline.demonstrationPeriod, geometry.pendulumPeriod);
  assert.equal(timeline.schedule.filter((entry) =>
    entry.includes('clearance-drop')).length, 2);
  disposeModel(model.root);
});

test('movement 306 renderer follows its exact contact state and leaves movement 507 authored', () => {
  const movement = catalog.movements[305];
  const model = createMovementModel(movement);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.5, 1, 1.34, 1.5, 2, 2.5, 3, 3.34, 4]) {
    model.update(time, 0.016);
    const state = stateAtTime(time);
    near(blocks.palletAssembly.rotation.z,
      state.palletAngle, 0, `pallet angle at ${time}`);
    near(blocks.wheelRotor.rotation.z,
      state.wheelAngle, 0, `wheel angle at ${time}`);
    assert.equal(blocks.contactMarker.visible,
      state.contactPoint !== null);
    assert.equal(blocks.contactMarker.userData.activeFace,
      state.activeFace);
    assert.equal(blocks.contactMarker.userData.activeToothIndex,
      state.activeToothIndex);
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
