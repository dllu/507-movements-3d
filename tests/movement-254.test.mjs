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
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
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

test('movement 254 is one ten-fork chain sprocket rigid on a horizontal shaft', () => {
  const movement = catalog.movements[253];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 254);
  assert.equal(movement.number, '254');
  assert.equal(movement.title, 'Ten-Fork Chain Sprocket Wheel');
  assert.equal(movement.category, 'Chain gearing');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'ten-fork-edge-profile-chain-sprocket-rigid-on-horizontal-shaft',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /ten-bifurcated-circumferential-pockets/);
  assert.equal(transmission.toothCount, 10);
  assert.equal(transmission.chainPitchesPerTurn, 10);
  assert.equal(blocks.forks.length, 10);
  assert.equal(blocks.wheelBody.parent, blocks.sprocketRotor);
  assert.equal(blocks.shaft.parent, blocks.sprocketRotor);
  assert.equal(blocks.hub.parent, blocks.sprocketRotor);
  blocks.forks.forEach((fork) => {
    assert.equal(fork.parent, blocks.sprocketRotor);
    assert.equal(fork.userData.rigidlyFixedToWheel, true);
  });
  disposeModel(model.root);
});

test('movement 254 preserves the measured unavailable edge elevation', () => {
  const movement = catalog.movements[253];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.plate254;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 5);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.equal(plate.inferredToothCount, 10);
  assert.match(plate.inferredTopology, /six fork profiles visible/);
  assert.deepEqual(plate.rasterWheelBodyBounds, {
    bottom: 471,
    left: 219,
    right: 317,
    top: 61,
  });
  assert.deepEqual(plate.rasterShaftBounds, {
    bottom: 328,
    left: 89,
    right: 444,
    top: 211,
  });
  assert.equal(plate.rasterForkProfiles.length, 6);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 65,
    edition: 21,
    illustrationPage: 64,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 254 builds ten equal three-dimensional bifurcated pockets', () => {
  const model = createMovementModel(catalog.movements[253]);
  const { blocks, geometry } = model.root.userData;

  assert.equal(geometry.forkGeometry.length, geometry.toothCount);
  geometry.forkGeometry.forEach((fork, index) => {
    near(fork.angle, index * geometry.toothStep, 0,
      `fork pitch angle ${index + 1}`);
    near(fork.rootPoint.x, 0, 0, `fork root centered axially ${index + 1}`);
    near(fork.rootPoint.y, geometry.forkRootRadius, 0,
      `fork root radius ${index + 1}`);
    near(fork.junctionPoint.y, geometry.forkJunctionRadius, 0,
      `fork junction radius ${index + 1}`);
    near(fork.leftTip.x, -geometry.forkHalfSpread, 0,
      `left fork tip ${index + 1}`);
    near(fork.rightTip.x, geometry.forkHalfSpread, 0,
      `right fork tip ${index + 1}`);
    near(fork.leftTip.y, geometry.forkTipRadius, 0,
      `left fork radial tip ${index + 1}`);
    near(fork.rightTip.y, geometry.forkTipRadius, 0,
      `right fork radial tip ${index + 1}`);
    vectorNear(
      fork.leftTip.clone().add(fork.rightTip),
      new THREE.Vector3(0, 2 * geometry.forkTipRadius, 0),
      0,
      `mirror fork prongs ${index + 1}`,
    );
    assert.equal(blocks.forks[index].children.length >= 6, true);
  });
  near(
    geometry.toothCount * geometry.toothStep,
    Math.PI * 2,
    0,
    'ten pockets close one circumference',
  );
  disposeModel(model.root);
});

test('movement 254 advances exactly one compatible chain pitch per fork step', () => {
  const model = createMovementModel(catalog.movements[253]);
  const { geometry, stateAtTime, transmission } = model.root.userData;
  const timePerPocket = geometry.toothStep / transmission.angularSpeed;

  near(
    geometry.chainPitch,
    2 * geometry.pitchRadius * Math.sin(geometry.toothStep / 2),
    0,
    'polygonal chain pitch chord',
  );
  for (let index = 0; index <= geometry.toothCount; index += 1) {
    const state = stateAtTime(index * timePerPocket);
    near(state.chainPitchCoordinate, index, 2e-15,
      `integer pitch coordinate ${index}`);
    near(state.chainAdvance, index * geometry.chainPitch, 4e-15,
      `one-pitch advance ${index}`);
    near(state.shaftAngle, state.sprocketAngle, 0,
      `shaft and wheel angle ${index}`);
    near(state.shaftAngularSpeed, state.sprocketAngularSpeed, 0,
      `shaft and wheel speed ${index}`);
  }
  near(
    transmission.chainAdvancePerSprocketTurn,
    geometry.toothCount * geometry.chainPitch,
    0,
    'ten-pitch advance per turn',
  );
  disposeModel(model.root);
});

test('movement 254 analytic pitch-line rate agrees with dense finite differences', () => {
  const model = createMovementModel(catalog.movements[253]);
  const { stateAtTime, timeline } = model.root.userData;
  const step = 1e-6;
  let maximumSpeedError = 0;

  for (let sample = 1; sample < 8192; sample += 1) {
    const time = timeline.demonstrationPeriod * sample / 8192;
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    const numericalSpeed = (
      after.chainAdvance - before.chainAdvance
    ) / (2 * step);
    maximumSpeedError = Math.max(
      maximumSpeedError,
      Math.abs(numericalSpeed - state.chainLinearSpeed),
    );
    state.forkPocketAngles.forEach((angle, index) => {
      near(angle - state.sprocketAngle, index * Math.PI * 2 / 10, 0,
        `rigid pocket phase ${sample}:${index}`);
    });
  }
  assert.ok(maximumSpeedError < 3e-9);
  disposeModel(model.root);
});

test('movement 254 has a positive fork gap but does not invent an unspecified chain', () => {
  const model = createMovementModel(catalog.movements[253]);
  const { chainDefinition, geometry } = model.root.userData;
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));

  assert.equal(chainDefinition.exactLinkFormSpecifiedBySource, false);
  assert.equal(chainDefinition.exactRouteSpecifiedBySource, false);
  assert.equal(chainDefinition.renderedChain, false);
  assert.equal(
    chainDefinition.status,
    'wheel-interface-only-because-chain-is-under-specified',
  );
  assert.equal(
    roles.some((role) => /chain-(?:link|span|loop)/.test(role)),
    false,
  );
  assert.ok(geometry.chainSeatHalfGap > 0.10);
  near(
    geometry.maximumReferenceLinkHalfWidth,
    geometry.chainSeatHalfGap,
    0,
    'maximum centered link half-width',
  );
  assert.ok(
    geometry.wheelWidth / 2
      - geometry.forkHalfSpread
      - geometry.forkBarRadius > 0.019,
    'rounded fork tips remain inside the broad wheel edge width',
  );
  assert.ok(geometry.forkRootRadius < geometry.wheelBodyRadius);
  assert.ok(geometry.forkJunctionRadius > geometry.wheelBodyRadius);
  disposeModel(model.root);
});

test('movement 254 renderer rotates one rigid member without painted speed indexes', () => {
  const model = createMovementModel(catalog.movements[253]);
  const { blocks, stateAtTime } = model.root.userData;
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));

  // Brown draws no speed or pocket index marks.
  assert.equal(roles.filter((role) => role === 'white-shaft-end-speed-index').length, 0);
  assert.equal(roles.filter((role) => role === 'white-one-pocket-per-turn-index').length, 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);
  for (const time of [0, 0.4, 1.1, 2.3, 3.7, 4.9, 7.25]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.sprocketRotor.rotation.x, state.sprocketAngle, 0,
      `rendered rotor angle at ${time}`);
    near(blocks.shaft.rotation.x, 0, 0,
      `shaft has no independent transform at ${time}`);
    blocks.forks.forEach((fork, index) => {
      near(fork.rotation.x, index * Math.PI * 2 / 10, 0,
        `fork remains rigid at ${time}:${index}`);
    });
  }
  disposeModel(model.root);
});

test('movement 254 closes exactly in five seconds and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[253]);
  const { animationTiming, geometry, stateAtTime, timeline } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.cycleClosure);

  near(animationTiming.authoredCyclePeriod, 5, 0, 'authored cycle period');
  near(animationTiming.targetCycleDuration, 2, 0, 'display period');
  assertReadableTiming(animationTiming);
  near(closure.sprocketAngle, start.sprocketAngle, 0,
    'sprocket geometry closure');
  near(closure.shaftAngle, start.shaftAngle, 0, 'shaft geometry closure');
  near(closure.chainAdvance, geometry.toothCount * geometry.chainPitch, 4e-15,
    'one turn transmits ten cumulative pitches');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
