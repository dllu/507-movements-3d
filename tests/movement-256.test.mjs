import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
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

test('movement 256 is one flangeless crowned-tread pulley rigid on its shaft', () => {
  const movement = catalog.movements[255];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    geometry,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 256);
  assert.equal(movement.number, '256');
  assert.equal(movement.title, 'Plain Flat-Belt Pulley');
  assert.equal(movement.category, 'Ropes, belts & pulleys');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'crowned-tread-flangeless-flat-belt-pulley-rigid-on-horizontal-shaft',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /flangeless-crowned-working-tread/);
  assert.equal(geometry.flangeCount, 0);
  assert.equal(blocks.tread.parent, blocks.pulleyRotor);
  assert.equal(blocks.hub.parent, blocks.pulleyRotor);
  assert.equal(blocks.shaft.parent, blocks.pulleyRotor);
  assert.equal(
    transmission.compatibleBeltSpeedLaw,
    'v=omega-times-crown-crest-radius',
  );
  disposeModel(model.root);
});

test('movement 256 preserves the measured unavailable edge elevation', () => {
  const movement = catalog.movements[255];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.plate256;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 5);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterPulleyBounds, {
    bottom: 473,
    left: 219,
    right: 328,
    top: 49,
  });
  assert.deepEqual(plate.rasterHubBounds, {
    bottom: 322,
    left: 200,
    right: 349,
    top: 207,
  });
  assert.deepEqual(plate.rasterShaftBounds, {
    bottom: 293,
    left: 87,
    right: 459,
    top: 235,
  });
  assert.match(plate.inferredTopology, /flangeless working tread/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 65,
    edition: 21,
    illustrationPage: 64,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 256 matches the source pulley, hub, and shaft proportions', () => {
  const model = createMovementModel(catalog.movements[255]);
  const { geometry, sourceReference } = model.root.userData;
  const plate = sourceReference.plate256;
  const rasterPulleyRadius = (
    plate.rasterPulleyBounds.bottom - plate.rasterPulleyBounds.top
  ) / 2;
  const rasterPulleyWidth =
    plate.rasterPulleyBounds.right - plate.rasterPulleyBounds.left;
  const rasterHubRadius = (
    plate.rasterHubBounds.bottom - plate.rasterHubBounds.top
  ) / 2;
  const rasterHubWidth =
    plate.rasterHubBounds.right - plate.rasterHubBounds.left;
  const rasterShaftRadius = (
    plate.rasterShaftBounds.bottom - plate.rasterShaftBounds.top
  ) / 2;
  const rasterShaftLength =
    plate.rasterShaftBounds.right - plate.rasterShaftBounds.left;

  near(
    geometry.treadWidth / geometry.treadRadius,
    rasterPulleyWidth / rasterPulleyRadius,
    0.006,
    'tread-width-to-radius ratio',
  );
  near(
    geometry.hubRadius / geometry.treadRadius,
    rasterHubRadius / rasterPulleyRadius,
    0.006,
    'hub-to-tread radius ratio',
  );
  near(
    geometry.hubWidth / geometry.treadRadius,
    rasterHubWidth / rasterPulleyRadius,
    0.006,
    'hub-width-to-tread-radius ratio',
  );
  near(
    geometry.shaftRadius / geometry.treadRadius,
    rasterShaftRadius / rasterPulleyRadius,
    0.006,
    'shaft-to-tread radius ratio',
  );
  near(
    geometry.shaftLength / geometry.treadRadius,
    rasterShaftLength / rasterPulleyRadius,
    0.006,
    'shaft-length-to-tread-radius ratio',
  );
  assert.ok(geometry.treadRadius > geometry.hubRadius);
  assert.ok(geometry.hubRadius > geometry.shaftRadius);
  assert.ok(geometry.hubWidth > geometry.treadWidth);
  assert.ok(geometry.shaftLength > geometry.hubWidth);
  disposeModel(model.root);
});

test('movement 256 has one crowned working tread as drawn and no flange', () => {
  const model = createMovementModel(catalog.movements[255]);
  const { blocks, geometry } = model.root.userData;
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));

  // Brown draws the rim's top and bottom edges as shallow convex arcs.
  assert.equal(geometry.treadProfile, 'circular-arc-crown-as-drawn');
  near(geometry.treadHalfWidth * 2, geometry.treadWidth, 0,
    'two tread half-widths');
  near(blocks.tread.userData.workingRadius, geometry.treadRadius, 0,
    'crest working radius');
  near(blocks.tread.userData.axialHalfWidth, geometry.treadHalfWidth, 0,
    'working half-width');
  assert.equal(blocks.tread.userData.profile, 'circular-arc-crown');
  // Plate: about 5.5 px of crown on a 212 px radius.
  near(geometry.crownHeight / geometry.treadRadius, 5.5 / 212, 0.004,
    'crown-to-radius ratio');
  const profile = blocks.tread.geometry.userData.outerProfile;
  const crest = profile.reduce((best, point) => (point.radial > best.radial ? point : best));
  near(crest.axial, 0, 1e-12, 'crest on the mid-plane');
  near(crest.radial, geometry.treadRadius, 1e-12, 'crest radius');
  near(profile[0].radial, geometry.treadEdgeRadius, 1e-12, 'left edge radius');
  near(profile.at(-1).radial, geometry.treadEdgeRadius, 1e-12, 'right edge radius');
  for (let index = 1; index < profile.length; index += 1) {
    const rising = profile[index].axial <= 0;
    assert.ok(rising ? profile[index].radial >= profile[index - 1].radial
      : profile[index].radial <= profile[index - 1].radial, 'convex crown');
  }
  assert.equal(roles.some((role) => /retaining-flange/.test(role)), false);
  assert.equal(blocks.faceRims.length, 2);
  blocks.faceRims.forEach((rim, index) => {
    const side = index === 0 ? -1 : 1;
    near(rim.position.x, side * (geometry.treadHalfWidth + 0.025), 0,
      `face rim ${index} axial location`);
  });
  disposeModel(model.root);
});

test('movement 256 exposes the exact potential no-slip flat-belt speed law', () => {
  const model = createMovementModel(catalog.movements[255]);
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
  assert.equal(transmission.demonstrationAngularSpeedSpecifiedBySource, false);
  assert.equal(transmission.speedRatioSpecifiedBySource, false);
  disposeModel(model.root);
});

test('movement 256 does not fabricate the absent belt route or mate pulley', () => {
  const model = createMovementModel(catalog.movements[255]);
  const { beltDefinition } = model.root.userData;
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));

  assert.equal(beltDefinition.exactBeltRouteSpecifiedBySource, false);
  assert.equal(beltDefinition.lateralGuidanceSpecifiedBySource, false);
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

test('movement 256 renderer spins one rigid assembly without undrawn painted indexes', () => {
  const model = createMovementModel(catalog.movements[255]);
  const { blocks, stateAtTime } = model.root.userData;
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));

  assert.equal(
    roles.filter((role) => role === 'white-plain-pulley-face-speed-index').length,
    0,
  );
  assert.equal(
    roles.filter((role) => role === 'white-plain-pulley-tread-speed-index').length,
    0,
  );
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);
  for (const time of [0, 0.4, 1.2, 2.4, 3.8, 4.79, 7.4]) {
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

test('movement 256 closes exactly in 4.8 seconds and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[255]);
  const { animationTiming, stateAtTime, timeline } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.cycleClosure);

  near(animationTiming.authoredCyclePeriod, 4.8, 0, 'authored cycle period');
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
