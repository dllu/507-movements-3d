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

test('movement 289 is one 30-tooth deadbeat wheel and one two-pallet anchor', () => {
  const movement = catalog.movements[288];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 289);
  assert.equal(movement.number, '289');
  assert.equal(movement.title, 'Deadbeat Anchor Escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'thirty-tooth-deadbeat-anchor-escapement-concentric-locking-faces');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /inner and K outer locking faces/);
  assert.match(mechanism, /perfectly at rest/);
  assert.match(mechanism, /impulse face c-e or d-b/);
  assert.match(mechanism, /drops freely/);
  assert.equal(transmission.toothCount, 30);
  assert.match(transmission.direction, /counterclockwise/);
  assert.match(transmission.recoil, /^none/);
  assert.match(transmission.deadbeat, /exactly zero/);

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
  // Source presentation detaches the contact marker Brown does not draw;
  // the factory still positions it for metadata consumers.
  assert.equal(blocks.contactMarker.parent, null);
  // Brown's wheel A is a web pierced by four lens windows, not spokes.
  assert.equal(blocks.spokeMeshes.length, 0);
  assert.equal(blocks.toothedRim.geometry.parameters.shapes.holes.length, 5);
  vectorNear(blocks.anchor.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'anchor axis');
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'escape-wheel axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'thirty-deadbeat-escape-wheel-teeth').length, 1);
  // The white face highlights are construction aids Brown does not draw;
  // source presentation removes them and the solid pallets carry the faces.
  assert.equal(roles.filter((role) =>
    /concentric-locking-face$/.test(role)).length, 0);
  assert.equal(roles.filter((role) =>
    /^(?:left-H|right-K)-impulse-face$/.test(role)).length, 0);
  assert.equal(roles.filter((role) =>
    /^(?:left-H|right-K)-deadbeat-pallet-solid$/.test(role)).length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 289 records Brown’s unavailable animation and measured plate', () => {
  const movement = catalog.movements[288];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate289;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /static engravings/);
  assert.match(sourceAnimation.referenceScope, /stationary lock/);
  assert.match(sourceAnimation.referenceScope, /c-e\/d-b impulse faces/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_289.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.deepEqual(plate.rasterAnchorPivot, new THREE.Vector2(260, 49));
  assert.deepEqual(plate.rasterWheelCenter, new THREE.Vector2(261, 350));
  assert.deepEqual(plate.rasterLeftLockCornerC,
    new THREE.Vector2(109, 333));
  assert.deepEqual(plate.rasterLeftImpulseEndE,
    new THREE.Vector2(88, 362));
  assert.deepEqual(plate.rasterRightLockCornerD,
    new THREE.Vector2(409, 329));
  assert.deepEqual(plate.rasterRightImpulseEndB,
    new THREE.Vector2(432, 359));
  assert.deepEqual(plate.rasterDirectionArrow,
    new THREE.Vector2(111, 463));
  assert.equal(plate.rasterWheelTipRadius, 151);
  assert.match(plate.inferredTopology, /wide anchor H-L-K/);
  assert.match(plate.inferredTopology, /concentric about a/);
  vectorNear(sourcePointToModel(plate.rasterAnchorPivot),
    geometry.anchorPivot, 0, 'source anchor pivot');
  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 0, 'source wheel center');
  near(geometry.toothTipRadius,
    plate.rasterWheelTipRadius * geometry.sourceScale, 0,
  'source wheel tip radius');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 289 has concentric locks and distinct impulse faces', () => {
  const model = createMovementModel(catalog.movements[288]);
  const {
    geometry,
    impulseFacePoints,
    lockFacePoints,
    palletProfiles,
  } = model.root.userData;

  assert.deepEqual(palletProfiles.left.impulseSourceLabels, ['c', 'e']);
  assert.deepEqual(palletProfiles.right.impulseSourceLabels, ['d', 'b']);
  assert.equal(palletProfiles.left.lockSurface, 'inner face of H');
  assert.equal(palletProfiles.right.lockSurface, 'outer face of K');
  assert.equal(palletProfiles.left.side, 1);
  assert.equal(palletProfiles.right.side, -1);
  assert.equal(palletProfiles.left.lockPoints.length, 45);
  assert.equal(palletProfiles.right.lockPoints.length, 45);
  assert.equal(palletProfiles.left.impulsePoints.length, 25);
  assert.equal(palletProfiles.right.impulsePoints.length, 25);
  assert.ok(palletProfiles.left.lockConcentricRadiusRange < 3e-15);
  assert.ok(palletProfiles.right.lockConcentricRadiusRange < 3e-15);
  assert.ok(palletProfiles.left.impulseConcentricRadiusRange > 0.05);
  assert.ok(palletProfiles.right.impulseConcentricRadiusRange > 0.05);

  for (const side of [-1, 1]) {
    const lockPoints = lockFacePoints(side, 101);
    const impulsePoints = impulseFacePoints(side, 101);
    const lockRadii = lockPoints.map((point) => point.length());
    near(Math.max(...lockRadii) - Math.min(...lockRadii), 0, 3e-15,
      `${side} concentric lock radius`);
    vectorNear(lockPoints[0], impulsePoints[0], 2e-15,
      `${side} lock/impulse corner`);
    assert.ok(impulsePoints.at(-1).distanceTo(impulsePoints[0]) > 0.08);
    for (const point of [...lockPoints, ...impulsePoints]) {
      assert.equal(Math.sign(point.x), side > 0 ? -1 : 1);
      assert.ok(point.y < 0);
    }
  }
  near(geometry.palletSpanAngle,
    geometry.palletSpanTeeth * geometry.toothPitch, 0,
  'half-integer pallet span');
  assert.equal(geometry.palletSpanTeeth, 14.5);
  disposeModel(model.root);
});

test('movement 289 holds exact stationary contact on both deadbeat locks', () => {
  const model = createMovementModel(catalog.movements[288]);
  const {
    lockContactPointForSide,
    lockLocalContactPoint,
    stateAtCyclePhase,
  } = model.root.userData;
  const sideCounts = new Map([[-1, 0], [1, 0]]);
  for (let sample = 0; sample <= 10000; sample += 1) {
    const state = stateAtCyclePhase(sample / 10000);
    if (state.contactMode !== 'concentric-lock') continue;
    sideCounts.set(state.activeSide, sideCounts.get(state.activeSide) + 1);
    assert.equal(state.wheelAngularSpeed, 0);
    assert.equal(state.wheelAngularAcceleration, 0);
    near(state.contact.pointError, 0, 4e-15,
      `locked tooth point at ${sample}`);
    near(state.contact.normalVelocityError, 0, 2e-15,
      `locked normal velocity at ${sample}`);
    near(state.contact.concentricRadiusError, 0, 2e-15,
      `locked concentric radius at ${sample}`);
    vectorNear(state.activeToothPoint,
      lockContactPointForSide(state.activeSide), 3e-15,
    `stationary world contact at ${sample}`);
    vectorNear(state.contact.localPoint, lockLocalContactPoint(
      state.activeSide,
      state.anchorAngle,
    ), 0, `moving material point at ${sample}`);
    assert.ok(Number.isFinite(state.contact.relativeSlipSpeed));
  }
  assert.ok(sideCounts.get(1) > 3800);
  assert.ok(sideCounts.get(-1) > 3800);
  disposeModel(model.root);
});

test('movement 289 transfers impulse only on c-e and d-b', () => {
  const model = createMovementModel(catalog.movements[288]);
  const {
    canonicalStates,
    geometry,
    impulseLocalContactPoint,
    stateAtCyclePhase,
  } = model.root.userData;
  const sideCounts = new Map([[-1, 0], [1, 0]]);
  for (let sample = 0; sample <= 10000; sample += 1) {
    const state = stateAtCyclePhase(sample / 10000);
    if (state.contactMode !== 'impulse') continue;
    sideCounts.set(state.activeSide, sideCounts.get(state.activeSide) + 1);
    assert.ok(state.impulseProgress >= 0);
    assert.ok(state.impulseProgress <= 1);
    assert.ok(state.wheelAngularSpeed >= 0);
    assert.ok(state.activeSide * state.anchorAngularSpeed <= 1e-14);
    near(state.contact.pointError, 0, 4e-15,
      `impulse point closure at ${sample}`);
    near(state.contact.normalVelocityError, 0, 2e-15,
      `impulse normal velocity at ${sample}`);
    vectorNear(state.contact.localPoint, impulseLocalContactPoint(
      state.activeSide,
      state.anchorAngle,
    ), 0, `impulse material point at ${sample}`);
  }
  assert.ok(sideCounts.get(1) > 400);
  assert.ok(sideCounts.get(-1) > 400);

  for (const [label, landing, maximum, start, release] of [
    ['left', canonicalStates.leftLanding,
      canonicalStates.leftMaximumLock,
      canonicalStates.leftImpulseStart,
      canonicalStates.leftRelease],
    ['right', canonicalStates.rightLanding,
      canonicalStates.rightMaximumLock,
      canonicalStates.rightImpulseStart,
      canonicalStates.rightRelease],
  ]) {
    assert.equal(landing.contactMode, 'concentric-lock');
    assert.equal(maximum.contactMode, 'concentric-lock');
    assert.equal(start.contactMode, 'impulse');
    assert.equal(release.contactMode, 'impulse');
    near(maximum.wheelAngle, landing.wheelAngle, 0,
      `${label} stationary outbound lock`);
    near(start.wheelAngle, landing.wheelAngle, 0,
      `${label} stationary return lock`);
    // The distinct impulse corner imposes an idealized velocity change.
    assert.ok(start.wheelAngularSpeed > 0);
    near(release.wheelAngle - start.wheelAngle,
      geometry.impulseAdvance, 7e-16,
    `${label} impulse advance`);
    assert.ok(release.wheelAngularSpeed > 0);
  }
  disposeModel(model.root);
});

test('movement 289 drops forward, never recoils, and advances one tooth', () => {
  const model = createMovementModel(catalog.movements[288]);
  const {
    canonicalTimes,
    geometry,
    stateAtCyclePhase,
    stateAtTime,
  } = model.root.userData;

  near(geometry.impulseAdvance + geometry.freeDropAdvance,
    geometry.halfToothPitch, 2e-17, 'half-pitch partition');
  assert.ok(geometry.freeDropAngularAcceleration > 0);
  assert.ok(geometry.freeDropLandingWheelSpeed
    > geometry.impulseReleaseWheelSpeed);
  assert.ok(geometry.landingImpactVelocityChange < 0);
  for (let sample = 0; sample <= 10000; sample += 1) {
    assert.ok(stateAtCyclePhase(sample / 10000).wheelAngularSpeed >= 0,
      `no recoil at ${sample}`);
  }

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
  const beforeLanding = stateAtTime(nextLanding - epsilon);
  const landing = stateAtTime(nextLanding);
  near(beforeLanding.wheelAngle, landing.wheelAngle, 1e-9,
    'drop/landing positional continuity');
  near(beforeLanding.wheelAngularSpeed,
    geometry.freeDropLandingWheelSpeed, 4e-8,
  'pre-impact forward speed');
  assert.equal(landing.wheelAngularSpeed, 0);

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

test('movement 289 analytic wheel and anchor rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[288]);
  const { stateAtTime } = model.root.userData;
  const epsilon = 2e-5;
  for (const time of [0.45, 1, 1.55, 1.84, 1.92, 1.99, 2.08,
    2.45, 3, 3.55, 3.84, 3.92, 3.99]) {
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
      state.wheelAngularSpeed, 8e-9,
    `wheel speed at ${time}`);
    near((after.wheelAngularSpeed - before.wheelAngularSpeed)
        / (2 * epsilon),
    state.wheelAngularAcceleration, 1.2e-8,
    `wheel acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 289 renderer binds lock, impulse, drop, and the next draft', () => {
  const model = createMovementModel(catalog.movements[288]);
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

  for (const time of [0, 0.45, 1, 1.84, 1.92, 2, 2.45, 3,
    3.84, 3.92, 4]) {
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
      assert.equal(model.root.userData.contacts.mode,
        expected.contactMode);
    } else {
      assert.equal(model.root.userData.contacts.activePallet, null);
      assert.equal(model.root.userData.contacts.mode, null);
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
  const model294 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model294.root.userData.fidelity, 'authored');
  disposeModel(model294.root);
  disposeModel(model.root);
});
