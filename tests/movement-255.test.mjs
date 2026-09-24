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

test('movement 255 is one straight-tread pulley with two retaining flanges', () => {
  const movement = catalog.movements[254];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 255);
  assert.equal(movement.number, '255');
  assert.equal(movement.title, 'Flanged Flat-Belt Pulley');
  assert.equal(movement.category, 'Ropes, belts & pulleys');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'straight-tread-double-flanged-flat-belt-pulley-rigid-on-horizontal-shaft',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /two-larger-radius-flanges/);
  assert.equal(blocks.flanges.length, 2);
  assert.equal(blocks.flangeRims.length, 2);
  assert.equal(blocks.tread.parent, blocks.pulleyRotor);
  assert.equal(blocks.hub.parent, blocks.pulleyRotor);
  assert.equal(blocks.shaft.parent, blocks.pulleyRotor);
  blocks.flanges.forEach((flange) => {
    assert.equal(flange.parent, blocks.pulleyRotor);
  });
  assert.equal(
    transmission.compatibleBeltSpeedLaw,
    'v=omega-times-straight-tread-radius',
  );
  disposeModel(model.root);
});

test('movement 255 preserves the measured unavailable edge elevation', () => {
  const movement = catalog.movements[254];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.plate255;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 5);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterFlangeBounds, {
    bottom: 465,
    left: 211,
    right: 321,
    top: 49,
  });
  assert.deepEqual(plate.rasterTreadBounds, {
    bottom: 440,
    left: 233,
    right: 300,
    top: 75,
  });
  assert.deepEqual(plate.rasterHubBounds, {
    bottom: 320,
    left: 190,
    right: 342,
    top: 203,
  });
  assert.deepEqual(plate.rasterShaftBounds, {
    bottom: 296,
    left: 98,
    right: 448,
    top: 231,
  });
  assert.match(plate.inferredTopology, /straight cylindrical tread/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 65,
    edition: 21,
    illustrationPage: 64,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 255 matches the source tread, flange, hub, and shaft proportions', () => {
  const model = createMovementModel(catalog.movements[254]);
  const { geometry, sourceReference } = model.root.userData;
  const plate = sourceReference.plate255;
  const rasterFlangeRadius = (
    plate.rasterFlangeBounds.bottom - plate.rasterFlangeBounds.top
  ) / 2;
  const rasterTreadRadius = (
    plate.rasterTreadBounds.bottom - plate.rasterTreadBounds.top
  ) / 2;
  const rasterHubRadius = (
    plate.rasterHubBounds.bottom - plate.rasterHubBounds.top
  ) / 2;
  const rasterShaftRadius = (
    plate.rasterShaftBounds.bottom - plate.rasterShaftBounds.top
  ) / 2;

  near(
    geometry.treadRadius / geometry.flangeRadius,
    rasterTreadRadius / rasterFlangeRadius,
    0.006,
    'tread-to-flange radius ratio',
  );
  near(
    geometry.hubRadius / geometry.flangeRadius,
    rasterHubRadius / rasterFlangeRadius,
    0.01,
    'hub-to-flange radius ratio',
  );
  near(
    geometry.shaftRadius / geometry.flangeRadius,
    rasterShaftRadius / rasterFlangeRadius,
    0.015,
    'shaft-to-flange radius ratio',
  );
  assert.ok(geometry.flangeRadius > geometry.treadRadius);
  assert.ok(geometry.treadRadius > geometry.hubRadius);
  assert.ok(geometry.hubRadius > geometry.shaftRadius);
  disposeModel(model.root);
});

test('movement 255 flanges contain a centered compatible flat belt with positive clearances', () => {
  const model = createMovementModel(catalog.movements[254]);
  const { blocks, geometry } = model.root.userData;

  near(
    geometry.flangeHeightAboveTread,
    geometry.flangeRadius - geometry.treadRadius,
    0,
    'flange radial containment height',
  );
  near(
    geometry.flangeInnerFaceOffset * 2,
    geometry.treadWidth,
    0,
    'working width between flange faces',
  );
  near(
    geometry.maximumCompatibleBeltWidth
      + 2 * geometry.beltEdgeRunningClearance,
    geometry.treadWidth,
    0,
    'belt width plus two edge clearances',
  );
  assert.ok(geometry.maximumCompatibleBeltThickness > 0);
  assert.ok(
    geometry.maximumCompatibleBeltThickness
      < geometry.flangeHeightAboveTread,
  );
  near(blocks.flanges[0].position.x, -geometry.flangeCenterOffset, 0,
    'left flange center');
  near(blocks.flanges[1].position.x, geometry.flangeCenterOffset, 0,
    'right flange center');
  near(
    blocks.flanges[0].userData.innerFaceX,
    -geometry.flangeInnerFaceOffset,
    0,
    'left inner face',
  );
  near(
    blocks.flanges[1].userData.innerFaceX,
    geometry.flangeInnerFaceOffset,
    0,
    'right inner face',
  );
  disposeModel(model.root);
});

test('movement 255 exposes the exact potential no-slip flat-belt speed law', () => {
  const model = createMovementModel(catalog.movements[254]);
  const { geometry, stateAtTime, timeline, transmission } = model.root.userData;
  const step = 1e-6;
  let maximumAngularRateError = 0;

  for (let sample = 1; sample < 16384; sample += 1) {
    const time = timeline.demonstrationPeriod * sample / 16384;
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    const numericalAngularSpeed = (
      after.unwrappedPulleyAngle - before.unwrappedPulleyAngle
    ) / (2 * step);
    maximumAngularRateError = Math.max(
      maximumAngularRateError,
      Math.abs(numericalAngularSpeed - state.pulleyAngularSpeed),
    );
    near(state.compatibleBeltLinearSpeed,
      state.pulleyAngularSpeed * geometry.treadRadius, 0,
      `potential no-slip speed at ${sample}`);
    near(state.pulleyAngularSpeed, state.shaftAngularSpeed, 0,
      `rigid shaft speed at ${sample}`);
  }
  assert.ok(maximumAngularRateError < 1.2e-9);
  near(
    transmission.potentialBeltLinearSpeed,
    transmission.angularSpeed * geometry.treadRadius,
    0,
    'published potential belt speed',
  );
  disposeModel(model.root);
});

test('movement 255 does not fabricate the absent belt route or mate pulley', () => {
  const model = createMovementModel(catalog.movements[254]);
  const { beltDefinition } = model.root.userData;
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));

  assert.equal(beltDefinition.exactBeltRouteSpecifiedBySource, false);
  assert.equal(beltDefinition.matePulleySpecifiedBySource, false);
  assert.equal(beltDefinition.renderedBelt, false);
  assert.equal(
    beltDefinition.status,
    'pulley-interface-only-because-belt-path-is-under-specified',
  );
  assert.equal(
    roles.some((role) => /(?:moving|closed|free-span)-belt/.test(role)),
    false,
  );
  disposeModel(model.root);
});

test('movement 255 renderer spins one rigid assembly without undrawn painted indexes', () => {
  const model = createMovementModel(catalog.movements[254]);
  const { blocks, stateAtTime } = model.root.userData;
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));

  assert.equal(roles.filter((role) => role === 'white-flange-face-speed-index').length, 0);
  assert.equal(roles.filter((role) => role === 'white-tread-speed-index').length, 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);
  for (const time of [0, 0.4, 1.2, 2.25, 3.8, 4.49, 7.4]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.pulleyRotor.rotation.x, state.pulleyAngle, 0,
      `rendered pulley angle at ${time}`);
    near(blocks.tread.rotation.x, 0, 0,
      `tread has no independent rotation at ${time}`);
    near(blocks.shaft.rotation.x, 0, 0,
      `shaft has no independent rotation at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 255 closes exactly in 4.5 seconds and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[254]);
  const { animationTiming, stateAtTime, timeline } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.cycleClosure);

  near(animationTiming.authoredCyclePeriod, 4.5, 0, 'authored cycle period');
  near(animationTiming.targetCycleDuration, 2, 0, 'display period');
  assertReadableTiming(animationTiming);
  near(closure.pulleyAngle, start.pulleyAngle, 0, 'pulley closure');
  near(closure.shaftAngle, start.shaftAngle, 0, 'shaft closure');
  near(closure.hubAngle, start.hubAngle, 0, 'hub closure');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
