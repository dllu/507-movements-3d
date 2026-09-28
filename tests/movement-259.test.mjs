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

test('movement 259 is one physically notched V-groove rigid on its shaft', () => {
  const movement = catalog.movements[258];
  const model = createMovementModel(movement);
  const {
    archetype,
    bandDefinition,
    blocks,
    fidelity,
    geometry,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 259);
  assert.equal(movement.number, '259');
  assert.equal(movement.title, 'Notched V-Grooved Round-Band Pulley');
  assert.equal(movement.category, 'Ropes, belts & pulleys');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'periodically-notched-v-groove-round-band-pulley-rigid-on-horizontal-shaft',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /transverse-notches-indent-both-flanks/);
  assert.equal(bandDefinition.grooveSurface, 'periodically-notched');
  assert.equal(blocks.pulleyBody.geometry.type, 'BufferGeometry');
  assert.notEqual(blocks.pulleyBody.geometry.type, 'LatheGeometry');
  assert.ok(blocks.pulleyBody.geometry.getAttribute('position').count > 20000);
  assert.equal(blocks.pulleyBody.parent, blocks.pulleyRotor);
  assert.equal(blocks.hub.parent, blocks.pulleyRotor);
  assert.equal(blocks.shaft.parent, blocks.pulleyRotor);
  assert.equal(geometry.notchCount, 88);
  assert.equal(
    transmission.potentialNoSlipLandLaw,
    'v=omega-times-(groove-root-radius+band-radius/sin(groove-half-angle))',
  );
  disposeModel(model.root);
});

test('movement 259 preserves the measured unavailable edge elevation', () => {
  const movement = catalog.movements[258];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.plate259;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 5);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.equal(plate.notchCountSpecifiedBySource, false);
  assert.equal(plate.modeledNotchCount, 88);
  assert.deepEqual(plate.rasterPulleyBounds, {
    bottom: 474,
    left: 222,
    right: 326,
    top: 64,
  });
  assert.deepEqual(plate.rasterGrooveBounds, {
    bottomRoot: 418,
    left: 244,
    right: 306,
    topRoot: 123,
  });
  assert.deepEqual(plate.rasterHubBounds, {
    bottom: 329,
    left: 202,
    right: 345,
    top: 214,
  });
  assert.deepEqual(plate.rasterShaftBounds, {
    bottom: 299,
    left: 94,
    right: 451,
    top: 242,
  });
  assert.match(plate.inferredTopology, /transverse chevron notches/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 65,
    edition: 21,
    illustrationPage: 64,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 259 matches the source V, pulley, hub, and shaft proportions', () => {
  const model = createMovementModel(catalog.movements[258]);
  const { geometry, sourceReference } = model.root.userData;
  const plate = sourceReference.plate259;
  const rasterPulleyRadius = (
    plate.rasterPulleyBounds.bottom - plate.rasterPulleyBounds.top
  ) / 2;
  const rasterPulleyWidth =
    plate.rasterPulleyBounds.right - plate.rasterPulleyBounds.left;
  const rasterGrooveHalfWidth = (
    plate.rasterGrooveBounds.right - plate.rasterGrooveBounds.left
  ) / 2;
  const rasterGrooveDepth = (
    plate.rasterGrooveBounds.topRoot - plate.rasterPulleyBounds.top
    + plate.rasterPulleyBounds.bottom - plate.rasterGrooveBounds.bottomRoot
  ) / 2;
  const rasterHalfAngle = Math.atan(
    rasterGrooveHalfWidth / rasterGrooveDepth,
  );
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

  near(geometry.pulleyWidth / geometry.outerRadius,
    rasterPulleyWidth / rasterPulleyRadius, 0.006,
    'pulley-width-to-radius ratio');
  near(geometry.grooveHalfWidth / geometry.outerRadius,
    rasterGrooveHalfWidth / rasterPulleyRadius, 0.006,
    'groove-half-width-to-radius ratio');
  near(geometry.grooveDepth / geometry.outerRadius,
    rasterGrooveDepth / rasterPulleyRadius, 0.007,
    'groove-depth-to-radius ratio');
  near(geometry.grooveHalfAngle, rasterHalfAngle, 0.006,
    'groove half-angle');
  near(geometry.hubRadius / geometry.outerRadius,
    rasterHubRadius / rasterPulleyRadius, 0.006,
    'hub-to-pulley radius ratio');
  near(geometry.hubWidth / geometry.outerRadius,
    rasterHubWidth / rasterPulleyRadius, 0.006,
    'hub-width-to-pulley-radius ratio');
  near(geometry.shaftRadius / geometry.outerRadius,
    rasterShaftRadius / rasterPulleyRadius, 0.006,
    'shaft-to-pulley radius ratio');
  near(geometry.shaftLength / geometry.outerRadius,
    rasterShaftLength / rasterPulleyRadius, 0.006,
    'shaft-length-to-pulley-radius ratio');
  disposeModel(model.root);
});

test('movement 259 has equal-pitch real indentations across both V flanks', () => {
  const model = createMovementModel(catalog.movements[258]);
  const { blocks, geometry } = model.root.userData;
  const {
    baseVRadiusAtAxial,
    nearestNotchAngularOffset,
    notchDepthAtAngle,
    surfaceRadiusAt,
  } = blocks.pulleyBody.userData;

  near(geometry.notchAngularPitch * geometry.notchCount,
    Math.PI * 2, 0, 'full equal-pitch notch ring');
  near(geometry.notchPitchAtOuterRadius,
    geometry.outerRadius * geometry.notchAngularPitch, 0,
    'outer-radius notch pitch');
  near(notchDepthAtAngle(0), geometry.notchDepth, 1e-12,
    'notch-center depth');
  near(notchDepthAtAngle(geometry.notchAngularPitch / 2), 0, 0,
    'between-notch depth');
  near(notchDepthAtAngle(Math.PI * 2), geometry.notchDepth, 1e-12,
    'periodic notch depth');
  near(nearestNotchAngularOffset(3 * geometry.notchAngularPitch), 0,
    2e-16, 'third notch center offset');
  near(baseVRadiusAtAxial(0), geometry.grooveRootRadius, 0,
    'unnotched V root');
  near(surfaceRadiusAt(0, 0),
    geometry.grooveRootRadius - geometry.notchDepth, 1e-12,
    'physically indented V root');
  near(surfaceRadiusAt(0, geometry.notchAngularPitch / 2),
    geometry.grooveRootRadius, 0,
    'smooth land between notches');
  for (const axial of [
    -geometry.grooveHalfWidth * 0.7,
    0,
    geometry.grooveHalfWidth * 0.7,
  ]) {
    assert.ok(surfaceRadiusAt(axial, 0) < baseVRadiusAtAxial(axial));
  }
  near(surfaceRadiusAt(-geometry.grooveHalfWidth, 0),
    geometry.outerRadius, 0, 'left lip remains intact');
  near(surfaceRadiusAt(geometry.grooveHalfWidth, 0),
    geometry.outerRadius, 0, 'right lip remains intact');
  assert.equal(blocks.notchContrastLines.children.length, geometry.notchCount);
  disposeModel(model.root);
});

test('movement 259 preserves V-land pitch kinematics without inventing adhesion', () => {
  const model = createMovementModel(catalog.movements[258]);
  const {
    bandDefinition,
    geometry,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;
  const step = 1e-6;
  let maximumAngularRateError = 0;

  for (let sample = 1; sample < 8192; sample += 1) {
    const time = timeline.demonstrationPeriod * sample / 8192;
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
    near(state.pulleyAngularSpeed, state.shaftAngularSpeed, 0,
      `rigid shaft rate at ${sample}`);
  }
  assert.ok(maximumAngularRateError < 1.2e-9);
  for (const bandRadius of [0.025, 0.08, 0.15]) {
    const pitchRadius = transmission.smoothLandPitchRadiusForBandRadius(
      bandRadius,
    );
    near(
      pitchRadius,
      geometry.grooveRootRadius
        + bandRadius / Math.sin(geometry.grooveHalfAngle),
      2e-15,
      `smooth-land pitch radius for ${bandRadius}`,
    );
    near(
      transmission.potentialBandLinearSpeedForRadius(bandRadius),
      transmission.angularSpeed * pitchRadius,
      0,
      `potential no-slip speed for ${bandRadius}`,
    );
  }
  assert.equal(bandDefinition.adhesionIncreaseSpecifiedQualitativelyBySource,
    true);
  assert.equal(bandDefinition.adhesionIncreaseValueSpecifiedBySource, false);
  assert.equal(bandDefinition.bandElasticitySpecifiedBySource, false);
  assert.equal(transmission.demonstrationAngularSpeedSpecifiedBySource, false);
  assert.equal(transmission.speedRatioSpecifiedBySource, false);
  disposeModel(model.root);
});

test('movement 259 fabricates neither a round-band route nor a mate pulley', () => {
  const model = createMovementModel(catalog.movements[258]);
  const { bandDefinition } = model.root.userData;
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));

  assert.equal(bandDefinition.exactBandRouteSpecifiedBySource, false);
  assert.equal(bandDefinition.matePulleySpecifiedBySource, false);
  assert.equal(bandDefinition.renderedBand, false);
  assert.equal(bandDefinition.roundBandRadiusSpecifiedBySource, false);
  assert.equal(
    bandDefinition.status,
    'notched-pulley-interface-only-with-no-invented-band-drive',
  );
  assert.equal(
    roles.some((role) => /(?:moving-band|closed-band|free-span-band)/.test(role)),
    false,
  );
  assert.equal(
    roles.filter((role) => role === 'notch-bottom-contrast-line').length,
    88,
  );
  disposeModel(model.root);
});

test('movement 259 renderer spins the notches and shaft as one rotor without painted indexes', () => {
  const model = createMovementModel(catalog.movements[258]);
  const { blocks, stateAtTime } = model.root.userData;
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));

  assert.equal(
    roles.filter((role) => role === 'white-notched-v-pulley-face-speed-index').length,
    0,
  );
  assert.equal(
    roles.filter((role) => role === 'white-notched-v-pulley-rim-speed-index').length,
    0,
  );
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);
  for (const time of [0, 0.4, 1.35, 2.7, 4.1, 5.39, 7.4]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.pulleyRotor.rotation.x, state.pulleyAngle, 0,
      `rendered pulley angle at ${time}`);
    near(blocks.pulleyBody.rotation.x, 0, 0,
      `notched body has no independent rotation at ${time}`);
    near(blocks.notchContrastLines.rotation.x, 0, 0,
      `notch lines have no independent rotation at ${time}`);
    near(blocks.shaft.rotation.x, 0, 0,
      `shaft has no independent rotation at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 259 closes exactly in 5.4 seconds and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[258]);
  const { animationTiming, stateAtTime, timeline } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.cycleClosure);

  near(animationTiming.authoredCyclePeriod, 5.4, 0, 'authored cycle period');
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
