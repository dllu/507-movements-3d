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

test('movement 288 is one 30-tooth recoil wheel and one two-pallet anchor', () => {
  const movement = catalog.movements[287];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 288);
  assert.equal(movement.number, '288');
  assert.equal(movement.title, 'Recoil Anchor Escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'thirty-tooth-recoil-anchor-escapement-nonconcentric-pallets');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /inner face c-e of pallet H/);
  assert.match(mechanism, /outer face d-b of pallet K/);
  assert.match(mechanism, /recoil during the outbound/);
  assert.match(mechanism, /drop freely/);
  assert.equal(transmission.toothCount, 30);
  assert.match(transmission.direction, /counterclockwise/);
  assert.match(transmission.recoil, /negative/);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.anchor.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.toothedRim.parent, blocks.wheelRotor);
  assert.equal(blocks.wheelHub.parent, blocks.wheelRotor);
  assert.equal(blocks.anchorBody.parent, blocks.anchor);
  assert.equal(blocks.leftPallet.parent, blocks.anchor);
  assert.equal(blocks.rightPallet.parent, blocks.anchor);
  assert.equal(blocks.anchorPivotHub.parent, blocks.anchor);
  assert.equal(blocks.contactMarker.parent, model.root);
  assert.equal(blocks.spokeMeshes.length, 3);
  vectorNear(blocks.anchor.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'anchor axis');
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'escape-wheel axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'thirty-backward-raked-escape-wheel-teeth').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'visible-nonconcentric-working-face').length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 288 records Brown’s unavailable animation and measured plate', () => {
  const movement = catalog.movements[287];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate288;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /static engravings/);
  assert.match(sourceAnimation.referenceScope, /nonconcentric pallet faces/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_288.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.deepEqual(plate.rasterAnchorPivot, new THREE.Vector2(250, 143));
  assert.deepEqual(plate.rasterWheelCenter, new THREE.Vector2(250, 403));
  assert.deepEqual(plate.rasterLeftFaceOuterC,
    new THREE.Vector2(117, 213));
  assert.deepEqual(plate.rasterLeftFaceInnerE,
    new THREE.Vector2(149, 171));
  assert.deepEqual(plate.rasterRightFaceInnerD,
    new THREE.Vector2(365, 174));
  assert.deepEqual(plate.rasterRightFaceOuterB,
    new THREE.Vector2(400, 214));
  assert.deepEqual(plate.rasterDirectionArrow,
    new THREE.Vector2(101, 356));
  assert.match(plate.inferredTopology, /counterclockwise/);
  assert.match(plate.inferredTopology, /inner face c-e/);
  assert.match(plate.inferredTopology, /outer face d-b/);
  vectorNear(sourcePointToModel(plate.rasterAnchorPivot),
    geometry.anchorPivot, 0, 'source anchor pivot');
  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 0, 'source wheel center');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 288 pallet faces are explicitly nonconcentric with arbor a', () => {
  const model = createMovementModel(catalog.movements[287]);
  const {
    geometry,
    palletFacePoints,
    palletProfiles,
  } = model.root.userData;

  assert.deepEqual(palletProfiles.left.sourceLabels, ['c', 'e']);
  assert.deepEqual(palletProfiles.right.sourceLabels, ['d', 'b']);
  assert.equal(palletProfiles.left.side, 1);
  assert.equal(palletProfiles.right.side, -1);
  assert.equal(palletProfiles.left.points.length, 41);
  assert.equal(palletProfiles.right.points.length, 41);
  assert.ok(palletProfiles.left.concentricRadiusRange > 0.15);
  assert.ok(palletProfiles.right.concentricRadiusRange > 0.15);
  for (const side of [-1, 1]) {
    const points = palletFacePoints(side, 101);
    assert.equal(points.length, 101);
    for (const point of points) {
      assert.equal(Math.sign(point.x), side > 0 ? -1 : 1);
      assert.ok(point.y < 0);
    }
    const radii = points.map((point) => point.length());
    assert.ok(Math.max(...radii) - Math.min(...radii) > 0.15);
  }
  near(geometry.palletSpanAngle,
    geometry.palletSpanTeeth * geometry.toothPitch, 0,
  'half-integer pallet span');
  assert.equal(geometry.palletSpanTeeth, 6.5);
  disposeModel(model.root);
});

test('movement 288 holds exact sliding contact on both recoil pallets', () => {
  const model = createMovementModel(catalog.movements[287]);
  const {
    geometry,
    palletLocalContactPoint,
    stateAtCyclePhase,
  } = model.root.userData;
  const sideCounts = new Map([[-1, 0], [1, 0]]);
  for (let sample = 0; sample <= 10000; sample += 1) {
    const state = stateAtCyclePhase(sample / 10000);
    if (!state.contactActive) continue;
    sideCounts.set(state.activeSide, sideCounts.get(state.activeSide) + 1);
    assert.ok(state.activeToothIndex >= 0);
    assert.ok(state.activeToothIndex < geometry.toothCount);
    near(state.contact.pointError, 0, 5e-15,
      `tooth/pallet point closure at ${sample}`);
    near(state.contact.normalVelocityError, 0, 2e-15,
      `contact normal velocity at ${sample}`);
    vectorNear(state.activeToothPoint, state.contact.expectedPoint, 5e-15,
      `active tooth point at ${sample}`);
    const localPoint = palletLocalContactPoint(
      state.activeSide,
      state.anchorAngle,
    );
    vectorNear(localPoint, state.contact.localPoint, 0,
      `local pallet point at ${sample}`);
    assert.equal(Math.sign(localPoint.x),
      state.activeSide > 0 ? -1 : 1);
    assert.ok(Number.isFinite(state.contact.relativeSlipSpeed));
  }
  assert.ok(sideCounts.get(1) > 4000);
  assert.ok(sideCounts.get(-1) > 4000);
  disposeModel(model.root);
});

test('movement 288 recoils, recovers, impulses, and advances one tooth', () => {
  const model = createMovementModel(catalog.movements[287]);
  const {
    canonicalStates,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const leftLanding = canonicalStates.leftLanding;
  const leftMaximum = canonicalStates.leftMaximumRecoil;
  const leftRelease = canonicalStates.leftRelease;
  const rightLanding = canonicalStates.rightLanding;
  const rightMaximum = canonicalStates.rightMaximumRecoil;
  const rightRelease = canonicalStates.rightRelease;

  for (const [label, landing, maximum, release] of [
    ['left', leftLanding, leftMaximum, leftRelease],
    ['right', rightLanding, rightMaximum, rightRelease],
  ]) {
    assert.equal(landing.contactActive, true);
    assert.match(landing.stage, /outbound-recoil/);
    assert.ok(landing.wheelAngularSpeed < 0);
    assert.match(maximum.stage, /maximum-recoil/);
    near(maximum.wheelAngularSpeed, 0, 5e-18,
      `${label} recoil reversal`);
    near(maximum.wheelAngle,
      landing.wheelAngle - geometry.maximumRecoilAngle, 5e-16,
    `${label} maximum recoil angle`);
    assert.equal(release.contactActive, true);
    assert.match(release.stage, /return-impulse/);
    assert.ok(release.wheelAngularSpeed > 0);
    near(release.wheelAngle,
      landing.wheelAngle + geometry.contactAdvancePastLanding, 6e-16,
    `${label} contact advance`);
  }
  const start = stateAtTime(0.73);
  const nextBeat = stateAtTime(0.73 + geometry.halfBeatDuration);
  const nextCycle = stateAtTime(0.73 + geometry.pendulumPeriod);
  near(nextBeat.wheelAngle - start.wheelAngle,
    geometry.halfToothPitch, 8e-16, 'half-pitch per beat');
  near(nextCycle.wheelAngle - start.wheelAngle,
    geometry.toothPitch, 9e-16, 'one tooth per oscillation');
  near(nextCycle.anchorAngle, start.anchorAngle, 5e-16,
    'anchor oscillation closure');
  near(nextCycle.anchorAngularSpeed, start.anchorAngularSpeed, 5e-16,
    'anchor speed closure');
  assert.equal(nextCycle.stage, start.stage);
  disposeModel(model.root);
});

test('movement 288 free drops are finite forward flights ending in recoil impacts', () => {
  const model = createMovementModel(catalog.movements[287]);
  const {
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;

  near(geometry.contactAdvancePastLanding + geometry.freeDropAdvance,
    geometry.halfToothPitch, 0, 'half-pitch partition');
  assert.ok(geometry.freeDropAngularAcceleration > 0);
  assert.ok(geometry.freeDropLandingWheelSpeed
    > geometry.contactReleaseWheelSpeed);
  assert.ok(geometry.landingImpactVelocityChange < 0);

  const release = canonicalTimes.leftRelease;
  const nextLanding = canonicalTimes.rightLanding;
  const samples = 200;
  let previousAngle = stateAtTime(release).wheelAngle;
  for (let sample = 1; sample < samples; sample += 1) {
    const time = THREE.MathUtils.lerp(
      release,
      nextLanding,
      sample / samples,
    );
    const state = stateAtTime(time);
    assert.equal(state.contactActive, false);
    assert.match(state.stage, /free-drop-forward/);
    assert.ok(state.wheelAngularSpeed > 0);
    near(state.wheelAngularAcceleration,
      geometry.freeDropAngularAcceleration, 0,
    `constant train acceleration at ${sample}`);
    assert.ok(state.wheelAngle > previousAngle);
    previousAngle = state.wheelAngle;
  }
  const epsilon = 1e-9;
  const afterRelease = stateAtTime(release + epsilon);
  const beforeLanding = stateAtTime(nextLanding - epsilon);
  const landing = stateAtTime(nextLanding);
  near(afterRelease.wheelAngle, stateAtTime(release).wheelAngle, 1e-10,
    'release/drop positional continuity');
  near(beforeLanding.wheelAngle, landing.wheelAngle, 1e-9,
    'drop/landing positional continuity');
  near(beforeLanding.wheelAngularSpeed,
    geometry.freeDropLandingWheelSpeed, 4e-8,
  'pre-impact forward speed');
  near(landing.wheelAngularSpeed,
    geometry.contactLandingWheelSpeed, 2e-16,
  'post-impact recoil speed');
  disposeModel(model.root);
});

test('movement 288 analytic wheel and anchor rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[287]);
  const { stateAtTime } = model.root.userData;
  const epsilon = 2e-5;
  for (const time of [0.38, 0.79, 1.31, 1.72, 2.41, 2.83, 3.24,
    3.71, 2.06, 3.98]) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near((after.anchorAngle - before.anchorAngle) / (2 * epsilon),
      state.anchorAngularSpeed, 2e-10,
    `anchor speed at ${time}`);
    near((after.anchorAngularSpeed - before.anchorAngularSpeed)
        / (2 * epsilon),
    state.anchorAngularAcceleration, 3e-10,
    `anchor acceleration at ${time}`);
    near((after.wheelAngle - before.wheelAngle) / (2 * epsilon),
      state.wheelAngularSpeed, 5e-9,
    `wheel speed at ${time}`);
    near((after.wheelAngularSpeed - before.wheelAngularSpeed)
        / (2 * epsilon),
    state.wheelAngularAcceleration, 6e-9,
    `wheel acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 288 renderer binds contact, recoil, drop, and the next draft', () => {
  const model = createMovementModel(catalog.movements[287]);
  const {
    animationTiming,
    blocks,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(timeline.demonstrationPeriod, 4);

  for (const time of [0, 0.3, 0.8, 1, 1.6, 2, 2.3, 2.8, 3, 3.6, 4]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.anchor.rotation.z, expected.anchorAngle, 0,
      `rendered anchor at ${time}`);
    near(blocks.wheelRotor.rotation.z, expected.wheelAngle, 0,
      `rendered wheel at ${time}`);
    near(blocks.wheelRotor.userData.angularSpeed,
      expected.wheelAngularSpeed, 0,
    `rendered wheel speed at ${time}`);
    assert.equal(blocks.contactMarker.visible, expected.contactActive);
    if (expected.contactActive) {
      near(blocks.contactMarker.position.x,
        expected.activeToothPoint.x, 0,
      `rendered contact x at ${time}`);
      near(blocks.contactMarker.position.y,
        expected.activeToothPoint.y, 0,
      `rendered contact y at ${time}`);
      near(model.root.userData.contacts.pointError, 0, 3e-15,
        `rendered contact closure at ${time}`);
      near(model.root.userData.contacts.normalVelocityError,
        0, 2e-15, `rendered normal velocity at ${time}`);
    } else {
      assert.equal(model.root.userData.contacts.activePallet, null);
      assert.ok(model.root.userData.contacts.dropProgress >= 0);
      assert.ok(model.root.userData.contacts.dropProgress <= 1);
    }
  }

  model.update(0.73);
  const startAnchorAngle = blocks.anchor.rotation.z;
  const startWheelAngle = blocks.wheelRotor.rotation.z;
  model.update(0.73 + geometry.pendulumPeriod);
  near(blocks.anchor.rotation.z, startAnchorAngle, 3e-16,
    'rendered anchor closure');
  near(blocks.wheelRotor.rotation.z - startWheelAngle,
    geometry.toothPitch, 9e-16, 'rendered one-tooth advance');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
