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

function planarNear(actual, expected, tolerance, message) {
  near(Math.hypot(actual.x - expected.x, actual.z - expected.z),
    0, tolerance, message);
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

test('movement 324 is Brown’s complete crossed-arm slotted compound ruler', () => {
  const movement = catalog.movements[323];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 324);
  assert.equal(movement.number, '324');
  assert.match(movement.title, /^Compound parallel ruler/);
  assert.equal(movement.category, 'Miscellaneous mechanisms');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'crossed-midpoint-arm-slotted-compound-parallel-ruler');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /two simple rulers A, A/);
  assert.match(mechanism, /each arm is pivoted at the right end/);
  assert.match(mechanism, /pin slides in slot B/);
  assert.match(mechanism, /exact midpoint pivot/);
  assert.match(mechanism, /ends and long edges parallel/);
  assert.equal(transmission.rulerTranslationRatio, -1);
  assert.match(transmission.input, /symmetric separation/);
  assert.match(transmission.output, /slot-pin travel/);

  assert.equal(blocks.upperRulerA.parent, model.root);
  assert.equal(blocks.lowerRulerA.parent, model.root);
  assert.equal(blocks.upperFixedPin.parent, blocks.upperRulerA);
  assert.equal(blocks.lowerFixedPin.parent, blocks.lowerRulerA);
  assert.equal(blocks.upperSliderPinB.parent, model.root);
  assert.equal(blocks.lowerSliderPin.parent, model.root);
  assert.equal(blocks.centerPivot.parent, model.root);
  assert.equal(blocks.armUpperFixedToLowerSlider.parent, model.root);
  assert.equal(blocks.armLowerFixedToUpperSlider.parent, model.root);
  assert.equal(blocks.upperRulerA.userData.body.parent,
    blocks.upperRulerA);
  assert.equal(blocks.lowerRulerA.userData.body.parent,
    blocks.lowerRulerA);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role === 'upper-simple-ruler-A').length,
    1);
  assert.equal(roles.filter((role) => role === 'lower-simple-ruler-A').length,
    1);
  assert.equal(roles.filter((role) =>
    role.endsWith('solid-with-real-sliding-slot-B')).length, 2);
  assert.equal(roles.filter((role) =>
    role.startsWith('crossed-arm-')).length, 2);
  assert.equal(roles.filter((role) =>
    role === 'common-midpoint-pivot-of-both-crossed-arms').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'upper-slot-sliding-pin-B').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 324 preserves Brown landmarks and the official canvas dimensions and timing', () => {
  const movement = catalog.movements[323];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToReferenceFront,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.brownPlate324;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.deepEqual(sourceAnimation.officialGeometry, {
    armLength: 13,
    armMidpoint: 6.5,
    fixedPivotX: 0,
    rulerMaximumX: 1,
    rulerMinimumX: -14,
    rulerWidth: 2,
    slotEndX: -9,
    slotRadius: 0.25,
    slotStartX: -13,
  });
  assert.deepEqual(sourceAnimation.officialKeyframes.map(({ phase }) => phase),
    [0, 0.4, 0.5, 0.9, 1]);
  assert.deepEqual(sourceAnimation.officialKeyframes[0].upperOrigin,
    new THREE.Vector2(0, 2));
  assert.deepEqual(sourceAnimation.officialKeyframes[1].upperOrigin,
    new THREE.Vector2(0, 4.366061));
  assert.deepEqual(sourceAnimation.officialKeyframes[1].lowerOrigin,
    new THREE.Vector2(0, -4.366061));
  assert.match(sourceAnimation.referenceScope, /two 15-by-2 rulers/);
  assert.match(sourceAnimation.referenceScope, /two equal 13-unit arms/);
  assert.match(sourceAnimation.referenceScope, /0, 0.4, 0.5, 0.9, and 1/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_324.html');

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 12);
  assert.deepEqual(plate.rasterCenterPivot, new THREE.Vector2(280, 273));
  assert.deepEqual(plate.rasterUpperFixedPivot,
    new THREE.Vector2(480, 201));
  assert.deepEqual(plate.rasterLowerFixedPivot,
    new THREE.Vector2(477, 345));
  assert.deepEqual(plate.rasterUpperSliderB,
    new THREE.Vector2(75, 201));
  assert.deepEqual(plate.rasterLowerSlider,
    new THREE.Vector2(75, 345));
  assert.match(plate.inferredTopology, /two equal crossed arms/);
  assert.match(plate.inferredTopology, /shared arm-midpoint pivot/);
  assert.equal(sourceReference.officialDescription, movement.description);

  const reference = stateAtTime(0);
  const tolerance = plate.measurementUncertaintyPixels
    * Math.max(geometry.sourceScaleX, geometry.sourceScaleZ);
  planarNear(sourcePointToReferenceFront(plate.rasterCenterPivot),
    reference.centerPivot.position, 0, 'source center pivot');
  planarNear(sourcePointToReferenceFront(plate.rasterUpperFixedPivot),
    reference.pins.upperFixed, tolerance, 'source upper fixed pivot');
  planarNear(sourcePointToReferenceFront(plate.rasterLowerFixedPivot),
    reference.pins.lowerFixed, tolerance, 'source lower fixed pivot');
  planarNear(sourcePointToReferenceFront(plate.rasterUpperSliderB),
    reference.pins.upperSlider, tolerance, 'source upper slider B');
  planarNear(sourcePointToReferenceFront(plate.rasterLowerSlider),
    reference.pins.lowerSlider, tolerance, 'source lower slider');
  planarNear(sourcePointToReferenceFront(plate.rasterUpperRuler.topLeft),
    new THREE.Vector3(-geometry.rulerLength / 2, 0,
      geometry.minimumHalfSeparation + geometry.rulerWidth / 2),
  tolerance, 'source upper ruler corner');
  planarNear(sourcePointToReferenceFront(plate.rasterLowerRuler.bottomRight),
    new THREE.Vector3(geometry.rulerLength / 2, 0,
      -geometry.minimumHalfSeparation - geometry.rulerWidth / 2),
  tolerance, 'source lower ruler corner');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 324 solves both rigid arms, both slots, and the common midpoint exactly', () => {
  const model = createMovementModel(catalog.movements[323]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 2048; sample += 1) {
    const state = stateAtTime(
      geometry.demonstrationPeriod * sample / 2048,
    );
    const upperToLower = state.arms.upperFixedToLowerSlider;
    const lowerToUpper = state.arms.lowerFixedToUpperSlider;
    near(upperToLower.length, geometry.armLength, 2e-15,
      `upper-to-lower arm length at ${sample}`);
    near(lowerToUpper.length, geometry.armLength, 2e-15,
      `lower-to-upper arm length at ${sample}`);
    vectorNear(upperToLower.midpoint, lowerToUpper.midpoint, 0,
      `shared midpoint at ${sample}`);
    vectorNear(state.centerPivot.closureResidual,
      new THREE.Vector3(), 0, `center-pivot closure at ${sample}`);
    vectorNear(state.centerPivot.position, upperToLower.midpoint, 0,
      `center pin follows both arms at ${sample}`);
    vectorNear(upperToLower.start, state.pins.upperFixed, 0,
      `upper fixed joint at ${sample}`);
    vectorNear(upperToLower.end, state.pins.lowerSlider, 0,
      `lower slider joint at ${sample}`);
    vectorNear(lowerToUpper.start, state.pins.lowerFixed, 0,
      `lower fixed joint at ${sample}`);
    vectorNear(lowerToUpper.end, state.pins.upperSlider, 0,
      `upper slider joint at ${sample}`);
    near(state.slots.upper.normalResidual, 0, 0,
      `upper pin on slot centerline at ${sample}`);
    near(state.slots.lower.normalResidual, 0, 0,
      `lower pin on slot centerline at ${sample}`);
    assert.ok(state.slots.upper.startMargin
      >= geometry.sliderPinRadius - 1e-14,
    `upper pin clears slot start at ${sample}`);
    assert.ok(state.slots.upper.endMargin
      >= geometry.sliderPinRadius - 1e-14,
    `upper pin clears slot end at ${sample}`);
    near(state.slots.upper.startMargin, state.slots.lower.startMargin, 0,
      `equal slot positions at ${sample}`);
    near(state.horizontalProjection ** 2
      + (2 * state.halfSeparation) ** 2,
    geometry.armLength ** 2, 1.5e-14,
    `Pythagorean arm closure at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 324 keeps corresponding ruler ends and edges parallel under symmetric translation', () => {
  const model = createMovementModel(catalog.movements[323]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 1024; sample += 1) {
    const state = stateAtTime(
      geometry.demonstrationPeriod * sample / 1024,
    );
    vectorNear(state.upperRuler.translation.clone()
      .add(state.lowerRuler.translation),
    new THREE.Vector3(), 0, `symmetric ruler translation at ${sample}`);
    near(state.upperRuler.rotation, 0, 0,
      `upper ruler does not rotate at ${sample}`);
    near(state.lowerRuler.rotation, 0, 0,
      `lower ruler does not rotate at ${sample}`);
    vectorNear(state.upperRuler.longEdgeDirection,
      state.lowerRuler.longEdgeDirection, 0,
    `long edges parallel at ${sample}`);
    vectorNear(state.upperRuler.endEdgeDirection,
      state.lowerRuler.endEdgeDirection, 0,
    `end edges parallel at ${sample}`);
    near(state.upperRuler.longEdgeDirection.length(),
      geometry.rulerLength, 0, `upper edge rigid at ${sample}`);
    near(state.lowerRuler.endEdgeDirection.length(),
      geometry.rulerWidth, 0, `lower end rigid at ${sample}`);
    near(state.pins.upperFixed.x, geometry.fixedPivotX, 0,
      `upper fixed pivot x at ${sample}`);
    near(state.pins.lowerFixed.x, geometry.fixedPivotX, 0,
      `lower fixed pivot x at ${sample}`);
    near(state.pins.upperSlider.x, state.pins.lowerSlider.x, 0,
      `both sliders have equal x at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 324 slider position, velocity, and acceleration obey the closed-form arm constraint', () => {
  const model = createMovementModel(catalog.movements[323]);
  const {
    geometry,
    sliderXForHalfSeparation,
    stateAtTime,
  } = model.root.userData;

  for (let sample = 0; sample <= 1024; sample += 1) {
    const state = stateAtTime(
      geometry.demonstrationPeriod * sample / 1024,
    );
    near(state.sliderX,
      sliderXForHalfSeparation(state.halfSeparation), 0,
    `closed-form slider position at ${sample}`);
    vectorNear(state.centerPivot.velocity,
      new THREE.Vector3(state.sliderRate / 2, 0, 0), 0,
    `midpoint velocity at ${sample}`);
    assert.ok(Number.isFinite(state.sliderRate));
    assert.ok(Number.isFinite(state.sliderAcceleration));
    assert.ok(Number.isFinite(
      state.arms.upperFixedToLowerSlider.angularRate,
    ));
    near(state.arms.upperFixedToLowerSlider.angularRate,
      -state.arms.lowerFixedToUpperSlider.angularRate, 8e-16,
    `opposed arm angular rates at ${sample}`);
  }

  const step = 1e-5;
  for (const time of [0.35, 0.9, 1.55, 2.9, 3.45, 4.15]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    near((after.sliderX - before.sliderX) / (2 * step),
      state.sliderRate, 1.6e-9,
    `finite-difference slider rate at ${time}`);
    near((after.sliderRate - before.sliderRate) / (2 * step),
      state.sliderAcceleration, 2.2e-9,
    `finite-difference slider acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 324 follows its smooth move-hold-return-hold official phase schedule', () => {
  const model = createMovementModel(catalog.movements[323]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  const period = geometry.demonstrationPeriod;
  const outwardEnd = period * geometry.outwardEndPhase;
  const holdEnd = period * geometry.outwardHoldEndPhase;
  const returnEnd = period * geometry.returnEndPhase;

  for (const time of [0, outwardEnd, holdEnd, returnEnd, period]) {
    const state = stateAtTime(time);
    near(state.halfSeparationRate, 0, 0,
      `zero ruler speed at keyframe ${time}`);
    near(state.halfSeparationAcceleration, 0, 0,
      `zero ruler acceleration at keyframe ${time}`);
  }
  near(stateAtTime(0).halfSeparation,
    geometry.minimumHalfSeparation, 0, 'minimum source separation');
  near(stateAtTime(outwardEnd).halfSeparation,
    geometry.maximumHalfSeparation, 0, 'maximum source separation');
  near(stateAtTime(holdEnd).halfSeparation,
    geometry.maximumHalfSeparation, 0, 'maximum hold separation');
  near(stateAtTime(returnEnd).halfSeparation,
    geometry.minimumHalfSeparation, 0, 'returned separation');
  for (const phase of [0.41, 0.45, 0.49]) {
    assert.equal(stateAtTime(period * phase).mode,
      'holding-maximum-parallel-separation');
  }
  for (const phase of [0.91, 0.95, 0.99]) {
    assert.equal(stateAtTime(period * phase).mode,
      'holding-minimum-parallel-separation');
  }
  const openingMid = stateAtTime(period * 0.2);
  const closingMid = stateAtTime(period * 0.7);
  near(openingMid.halfSeparation, closingMid.halfSeparation, 3e-16,
    'symmetric separation path');
  near(openingMid.halfSeparationRate,
    -closingMid.halfSeparationRate, 8e-16,
  'symmetric separation rate');
  assert.deepEqual(timeline.schedule.map(({ phase }) => phase),
    [0, 0.4, 0.5, 0.9, 1]);
  disposeModel(model.root);
});

test('movement 324 renderer follows both rulers, both slots, both crossed arms, and center pivot', () => {
  const model = createMovementModel(catalog.movements[323]);
  const {
    animationTiming,
    blocks,
    geometry,
    stateAtTime,
  } = model.root.userData;

  assert.equal(animationTiming.authoredCyclePeriod, geometry.demonstrationPeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(blocks.upperRulerA.userData.solidDepth,
    geometry.rulerDepth);
  assert.equal(blocks.lowerRulerA.userData.solidDepth,
    geometry.rulerDepth);
  assert.deepEqual(blocks.upperRulerA.userData.slot,
    blocks.lowerRulerA.userData.slot);
  assert.ok(geometry.armLayerUpperToLower
    < geometry.armLayerLowerToUpper,
  'crossed arms occupy readable adjacent 3D layers');

  for (const time of [0, 0.7, 1.5, 2, 2.3, 2.5, 3.4, 4.5, 4.8, 5]) {
    const state = stateAtTime(time);
    model.update(time);
    vectorNear(blocks.upperRulerA.position,
      state.upperRuler.translation, 0, `rendered upper ruler at ${time}`);
    vectorNear(blocks.lowerRulerA.position,
      state.lowerRuler.translation, 0, `rendered lower ruler at ${time}`);
    vectorNear(blocks.upperSliderPinB.position,
      state.pins.upperSlider, 0, `rendered upper slider at ${time}`);
    vectorNear(blocks.lowerSliderPin.position,
      state.pins.lowerSlider, 0, `rendered lower slider at ${time}`);
    vectorNear(blocks.centerPivot.position,
      state.centerPivot.position, 0, `rendered center pivot at ${time}`);
    vectorNear(blocks.armUpperFixedToLowerSlider.userData.renderedStart,
      new THREE.Vector3(state.pins.upperFixed.x,
        geometry.armLayerUpperToLower, state.pins.upperFixed.z),
    0, `rendered first arm start at ${time}`);
    vectorNear(blocks.armUpperFixedToLowerSlider.userData.renderedEnd,
      new THREE.Vector3(state.pins.lowerSlider.x,
        geometry.armLayerUpperToLower, state.pins.lowerSlider.z),
    0, `rendered first arm end at ${time}`);
    vectorNear(blocks.armLowerFixedToUpperSlider.userData.renderedStart,
      new THREE.Vector3(state.pins.lowerFixed.x,
        geometry.armLayerLowerToUpper, state.pins.lowerFixed.z),
    0, `rendered second arm start at ${time}`);
    near(blocks.armUpperFixedToLowerSlider.children[0].scale.x,
      geometry.armLength, 2e-15, `rendered first arm length at ${time}`);
    near(blocks.armLowerFixedToUpperSlider.children[0].scale.x,
      geometry.armLength, 2e-15, `rendered second arm length at ${time}`);
    vectorNear(model.root.userData.contacts.centerArmPivot.closureResidual,
      new THREE.Vector3(), 0, `rendered center closure at ${time}`);
    model.root.traverse((object) => {
      for (const value of object.position.toArray()) {
        assert.ok(Number.isFinite(value), `finite position at ${time}`);
      }
      for (const value of object.quaternion.toArray()) {
        assert.ok(Number.isFinite(value), `finite quaternion at ${time}`);
      }
    });
  }
  disposeModel(model.root);
});

test('movement 324 closes exactly and leaves movement 339 as the next authored draft', () => {
  const model = createMovementModel(catalog.movements[323]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(geometry.demonstrationPeriod);

  near(closure.phase, start.phase, 0, 'phase closure');
  near(closure.halfSeparation, start.halfSeparation, 0,
    'ruler-separation closure');
  near(closure.halfSeparationRate, start.halfSeparationRate, 0,
    'ruler-speed closure');
  near(closure.sliderX, start.sliderX, 0, 'slider closure');
  near(closure.sliderRate, start.sliderRate, 0, 'slider-speed closure');
  vectorNear(closure.centerPivot.position,
    start.centerPivot.position, 0, 'center-pivot closure');
  vectorNear(closure.pins.upperFixed, start.pins.upperFixed, 0,
    'upper fixed joint closure');
  vectorNear(closure.pins.lowerSlider, start.pins.lowerSlider, 0,
    'lower slider closure');
  model.update(geometry.demonstrationPeriod);
  vectorNear(blocks.upperRulerA.position,
    start.upperRuler.translation, 0, 'rendered upper closure');
  vectorNear(blocks.lowerRulerA.position,
    start.lowerRuler.translation, 0, 'rendered lower closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
