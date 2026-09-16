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

test('movement 258 is one smooth symmetric V-groove rigid on its shaft', () => {
  const movement = catalog.movements[257];
  const model = createMovementModel(movement);
  const {
    archetype,
    bandDefinition,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 258);
  assert.equal(movement.number, '258');
  assert.equal(movement.title, 'Smooth V-Grooved Round-Band Pulley');
  assert.equal(movement.category, 'Ropes, belts & pulleys');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'smooth-sixty-degree-v-groove-round-band-pulley-rigid-on-horizontal-shaft',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /smooth-two-flank-v-groove/);
  assert.equal(bandDefinition.grooveSurface, 'smooth');
  assert.ok(blocks.pulleyBody.geometry.userData.boreRadius > 0,
    'the revolved body has a through-bore for the hub');
  assert.equal(blocks.pulleyBody.parent, blocks.pulleyRotor);
  assert.equal(blocks.hub.parent, blocks.pulleyRotor);
  assert.equal(blocks.shaft.parent, blocks.pulleyRotor);
  assert.equal(
    transmission.potentialNoSlipLaw,
    'v=omega-times-(groove-root-radius+band-radius/sin(groove-half-angle))',
  );
  disposeModel(model.root);
});

test('movement 258 preserves the measured unavailable edge elevation', () => {
  const movement = catalog.movements[257];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.plate258;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 5);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterPulleyBounds, {
    bottom: 471,
    left: 210,
    right: 319,
    top: 67,
  });
  assert.deepEqual(plate.rasterGrooveBounds, {
    bottomRoot: 420,
    left: 231,
    right: 298,
    topRoot: 130,
  });
  assert.deepEqual(plate.rasterHubBounds, {
    bottom: 335,
    left: 189,
    right: 340,
    top: 215,
  });
  assert.deepEqual(plate.rasterShaftBounds, {
    bottom: 305,
    left: 83,
    right: 448,
    top: 243,
  });
  assert.match(plate.inferredTopology, /smooth symmetric v-groove/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 65,
    edition: 21,
    illustrationPage: 64,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 258 matches the source V, pulley, hub, and shaft proportions', () => {
  const model = createMovementModel(catalog.movements[257]);
  const { geometry, sourceReference } = model.root.userData;
  const plate = sourceReference.plate258;
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
    rasterGrooveDepth / rasterPulleyRadius, 0.006,
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

test('movement 258 has two exact straight flanks meeting at one sharp V root', () => {
  const model = createMovementModel(catalog.movements[257]);
  const { blocks, geometry } = model.root.userData;
  const [leftLip, root, rightLip] = geometry.grooveProfile;

  assert.equal(geometry.grooveProfile.length, 3);
  near(leftLip.axial, -geometry.grooveHalfWidth, 0, 'left lip axial');
  near(leftLip.radial, geometry.outerRadius, 0, 'left lip radius');
  near(root.axial, 0, 0, 'V root axial');
  near(root.radial, geometry.grooveRootRadius, 0, 'V root radius');
  near(rightLip.axial, geometry.grooveHalfWidth, 0, 'right lip axial');
  near(rightLip.radial, geometry.outerRadius, 0, 'right lip radius');
  near(geometry.grooveRootRadius,
    geometry.outerRadius - geometry.grooveDepth, 0,
    'V depth identity');
  near(geometry.grooveHalfAngle,
    Math.atan(geometry.grooveHalfWidth / geometry.grooveDepth), 0,
    'V half-angle identity');
  near(geometry.grooveIncludedAngle, 2 * geometry.grooveHalfAngle, 0,
    'V included-angle identity');
  near(
    (root.radial - leftLip.radial) / (root.axial - leftLip.axial),
    -geometry.grooveDepth / geometry.grooveHalfWidth,
    0,
    'left flank slope',
  );
  near(
    (rightLip.radial - root.radial) / (rightLip.axial - root.axial),
    geometry.grooveDepth / geometry.grooveHalfWidth,
    0,
    'right flank slope',
  );
  assert.strictEqual(blocks.pulleyBody.userData.grooveProfile,
    geometry.grooveProfile);
  assert.ok(geometry.rimLandWidth > 0);
  disposeModel(model.root);
});

test('movement 258 derives exact two-flank tangency and no-slip pitch speed', () => {
  const model = createMovementModel(catalog.movements[257]);
  const { geometry, stateAtTime, timeline, transmission } = model.root.userData;
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
  const bandRadii = [
    0.025,
    0.08,
    0.16,
    geometry.maximumFullySeatedBandRadius,
  ];
  for (const bandRadius of bandRadii) {
    const pitchRadius = transmission.effectivePitchRadiusForBandRadius(
      bandRadius,
    );
    const centerRise = pitchRadius - geometry.grooveRootRadius;
    near(centerRise,
      bandRadius / Math.sin(geometry.grooveHalfAngle), 2e-15,
      `band center rise for radius ${bandRadius}`);
    near(centerRise * Math.sin(geometry.grooveHalfAngle), bandRadius,
      2e-15, `two-flank tangent distance for radius ${bandRadius}`);
    assert.ok(pitchRadius + bandRadius <= geometry.outerRadius + 1e-15);
    near(
      transmission.potentialBandLinearSpeedForRadius(bandRadius),
      transmission.angularSpeed * pitchRadius,
      0,
      `no-slip speed for band radius ${bandRadius}`,
    );
  }
  assert.equal(transmission.effectivePitchRadiusForBandRadius(0), null);
  assert.equal(
    transmission.effectivePitchRadiusForBandRadius(
      geometry.maximumFullySeatedBandRadius + 1e-6,
    ),
    null,
  );
  assert.equal(transmission.demonstrationAngularSpeedSpecifiedBySource, false);
  assert.equal(transmission.speedRatioSpecifiedBySource, false);
  disposeModel(model.root);
});

test('movement 258 keeps the source groove smooth and fabricates no band drive', () => {
  const model = createMovementModel(catalog.movements[257]);
  const { bandDefinition } = model.root.userData;
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));

  assert.equal(bandDefinition.exactBandRouteSpecifiedBySource, false);
  assert.equal(bandDefinition.grooveSurface, 'smooth');
  assert.equal(bandDefinition.matePulleySpecifiedBySource, false);
  assert.equal(bandDefinition.renderedBand, false);
  assert.equal(bandDefinition.roundBandRadiusSpecifiedBySource, false);
  assert.equal(
    bandDefinition.status,
    'pulley-interface-only-because-band-path-is-under-specified',
  );
  assert.equal(
    roles.some((role) => /(?:notch|tooth|lug|moving-band|closed-band)/.test(role)),
    false,
  );
  disposeModel(model.root);
});

test('movement 258 renderer spins one rigid V-grooved body with two indexes', () => {
  const model = createMovementModel(catalog.movements[257]);
  const { blocks, stateAtTime } = model.root.userData;
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));

  assert.equal(
    roles.filter((role) => role === 'white-smooth-v-pulley-face-speed-index').length,
    1,
  );
  assert.equal(
    roles.filter((role) => role === 'white-smooth-v-pulley-rim-speed-index').length,
    1,
  );
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);
  for (const time of [0, 0.4, 1.3, 2.6, 3.8, 5.19, 7.4]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.pulleyRotor.rotation.x, state.pulleyAngle, 0,
      `rendered pulley angle at ${time}`);
    near(blocks.pulleyBody.rotation.x, 0, 0,
      `V-grooved body has no independent rotation at ${time}`);
    near(blocks.shaft.rotation.x, 0, 0,
      `shaft has no independent rotation at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 258 closes exactly in 5.2 seconds and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[257]);
  const { animationTiming, stateAtTime, timeline } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.cycleClosure);

  near(animationTiming.authoredCyclePeriod, 5.2, 0, 'authored cycle period');
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
