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

test('movement 290 is one fixed seven-tooth wheel inside one annular pendulum', () => {
  const movement = catalog.movements[289];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 290);
  assert.equal(movement.number, '290');
  assert.equal(movement.title,
    'Seven-Tooth Annular Pendulum Escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'seven-tooth-clockwise-annular-pendulum-recoil-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /annular pendulum C-K/);
  assert.match(mechanism, /seven-tooth wheel D/);
  assert.match(mechanism, /pallets A and B/);
  assert.match(mechanism, /half-pitch drop/);
  assert.equal(transmission.toothCount, 7);
  assert.match(transmission.direction, /clockwise/);
  assert.match(transmission.recoil, /counterclockwise/);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.annularPendulum.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.sevenToothDisk.parent, blocks.wheelRotor);
  assert.equal(blocks.wheelHub.parent, blocks.wheelRotor);
  assert.equal(blocks.annulus.parent, blocks.annularPendulum);
  assert.equal(blocks.upperRod.parent, blocks.annularPendulum);
  assert.equal(blocks.lowerRod.parent, blocks.annularPendulum);
  assert.equal(blocks.rightPallet.parent, blocks.annularPendulum);
  assert.equal(blocks.leftPallet.parent, blocks.annularPendulum);
  assert.equal(blocks.rightConnector.parent, blocks.annularPendulum);
  assert.equal(blocks.leftConnector.parent, blocks.annularPendulum);
  // Source presentation detaches the contact marker Brown does not draw;
  // the factory still positions it for metadata consumers.
  assert.equal(blocks.contactMarker.parent, null);
  vectorNear(blocks.annularPendulum.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'pendulum axis');
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'escape-wheel axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'seven-source-counted-broad-ratchet-teeth-E-through-H'
  ).length, 1);
  assert.equal(roles.filter((role) =>
    /pallet-[AB]-nonconcentric-recoil-face$/.test(role)).length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 290 records the unavailable source animation and measured plate', () => {
  const movement = catalog.movements[289];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate290;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /one-sentence caption/);
  assert.match(sourceAnimation.referenceScope, /seven-tooth count/);
  assert.match(sourceAnimation.referenceScope, /independently reconstructed/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_290.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.equal(plate.countedToothCount, 7);
  assert.equal(plate.rasterWheelTipRadius, 91);
  assert.equal(plate.rasterAnnulusOuterRadius, 124);
  assert.equal(plate.rasterAnnulusInnerRadius, 102);
  assert.deepEqual(plate.rasterSuspensionPivot,
    new THREE.Vector2(260, 51));
  assert.deepEqual(plate.rasterWheelCenterD,
    new THREE.Vector2(260, 279));
  assert.deepEqual(plate.rasterAnnulusCenter,
    new THREE.Vector2(260, 280));
  assert.deepEqual(plate.rasterRightPalletA,
    new THREE.Vector2(329, 278));
  assert.deepEqual(plate.rasterLeftPalletB,
    new THREE.Vector2(191, 280));
  assert.deepEqual(plate.rasterDirectionArrow,
    new THREE.Vector2(286, 243));
  assert.match(plate.inferredTopology, /seven broad ratchet teeth/);
  assert.match(plate.inferredTopology, /fixed arbor D/);
  vectorNear(sourcePointToModel(plate.rasterSuspensionPivot),
    geometry.suspensionPivot, 0, 'source suspension pivot');
  vectorNear(sourcePointToModel(plate.rasterWheelCenterD),
    geometry.wheelCenter, 0, 'source wheel center');
  vectorNear(sourcePointToModel(plate.rasterAnnulusCenter)
    .sub(geometry.suspensionPivot), geometry.pendulumCenterLocal, 0,
  'source annulus center');
  near(geometry.toothTipRadius,
    plate.rasterWheelTipRadius * geometry.sourceScale, 0,
  'source wheel tip radius');
  near(geometry.annulusInnerRadius,
    plate.rasterAnnulusInnerRadius * geometry.sourceScale, 0,
  'source annulus inner radius');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 290 preserves the suspended annulus and odd-tooth alternation', () => {
  const model = createMovementModel(catalog.movements[289]);
  const {
    canonicalStates,
    geometry,
    pendulumCenterAtAngle,
    stateAtCyclePhase,
  } = model.root.userData;
  const suspensionLength = geometry.pendulumCenterLocal.length();
  let minimumClearance = Infinity;

  assert.equal(geometry.toothCount, 7);
  near(geometry.halfToothPitch, Math.PI / 7, 0,
    'seven-tooth half pitch');
  near(-geometry.toothLeanAngle,
    geometry.toothProfileTipOffset, 0,
  'analytic contact uses the rendered ratchet-tip offset');
  assert.equal(canonicalStates.rightLanding.activeToothIndex, 0);
  assert.equal(canonicalStates.leftLanding.activeToothIndex, 4);
  near(canonicalStates.leftLanding.activeToothAngle
      - canonicalStates.rightLanding.activeToothAngle,
  Math.PI, 2e-15, 'diametrically opposed contacts');

  for (let sample = 0; sample <= 10000; sample += 1) {
    const state = stateAtCyclePhase(sample / 10000);
    vectorNear(state.annulusCenter,
      pendulumCenterAtAngle(state.pendulumAngle), 0,
    `annulus center at ${sample}`);
    near(state.annulusCenter.distanceTo(geometry.suspensionPivot),
      suspensionLength, 2e-15,
    `rigid suspension length at ${sample}`);
    minimumClearance = Math.min(
      minimumClearance,
      state.annulusWheelClearance,
    );
  }
  assert.ok(minimumClearance > 0.03);
  assert.ok(minimumClearance < 0.04);
  disposeModel(model.root);
});

test('movement 290 keeps exact sliding contact on both inward pallets', () => {
  const model = createMovementModel(catalog.movements[289]);
  const {
    geometry,
    palletLocalContactPoint,
    palletProfiles,
    stateAtCyclePhase,
  } = model.root.userData;
  const sideCounts = new Map([[-1, 0], [1, 0]]);

  assert.equal(palletProfiles.rightA.sourceLabel, 'A');
  assert.equal(palletProfiles.leftB.sourceLabel, 'B');
  assert.equal(palletProfiles.rightA.points.length, 45);
  assert.equal(palletProfiles.leftB.points.length, 45);
  assert.ok(palletProfiles.rightA.concentricRadiusRange > 0.09);
  assert.ok(palletProfiles.leftB.concentricRadiusRange > 0.09);
  for (let sample = 0; sample <= 10000; sample += 1) {
    const state = stateAtCyclePhase(sample / 10000);
    if (!state.contactActive) continue;
    sideCounts.set(state.activeSide, sideCounts.get(state.activeSide) + 1);
    assert.ok(state.activeToothIndex >= 0);
    assert.ok(state.activeToothIndex < geometry.toothCount);
    near(state.contact.pointError, 0, 3e-15,
      `tooth/pallet point closure at ${sample}`);
    near(state.contact.normalVelocityError, 0, 2e-15,
      `contact normal velocity at ${sample}`);
    vectorNear(state.contact.localPoint, palletLocalContactPoint(
      state.activeSide,
      state.pendulumAngle,
    ), 0, `local pallet point at ${sample}`);
    assert.equal(Math.sign(state.contact.localPoint.x), state.activeSide);
    assert.ok(state.contact.localPoint.y < 0);
    assert.ok(Number.isFinite(state.contact.relativeSlipSpeed));
  }
  assert.ok(sideCounts.get(1) > 4000);
  assert.ok(sideCounts.get(-1) > 4000);
  disposeModel(model.root);
});

test('movement 290 recoils, returns clockwise, and advances one tooth', () => {
  const model = createMovementModel(catalog.movements[289]);
  const {
    canonicalStates,
    geometry,
    stateAtTime,
  } = model.root.userData;

  for (const [label, landing, maximum, release] of [
    ['right A', canonicalStates.rightLanding,
      canonicalStates.rightMaximumRecoil,
      canonicalStates.rightRelease],
    ['left B', canonicalStates.leftLanding,
      canonicalStates.leftMaximumRecoil,
      canonicalStates.leftRelease],
  ]) {
    assert.equal(landing.contactActive, true);
    assert.match(landing.stage, /outbound-recoil/);
    assert.ok(landing.wheelAngularSpeed > 0);
    assert.match(maximum.stage, /maximum-recoil/);
    near(maximum.wheelAngularSpeed, 0, 1e-17,
      `${label} recoil reversal`);
    near(maximum.wheelAngle,
      landing.wheelAngle + geometry.maximumRecoilAngle, 5e-16,
    `${label} maximum recoil`);
    assert.match(release.stage, /return-impulse/);
    assert.ok(release.wheelAngularSpeed < 0);
    near(release.wheelAngle,
      landing.wheelAngle - geometry.contactAdvancePastLanding, 7e-16,
    `${label} contact advance`);
  }

  const start = stateAtTime(0.73);
  const nextBeat = stateAtTime(0.73 + geometry.halfBeatDuration);
  const nextCycle = stateAtTime(0.73 + geometry.pendulumPeriod);
  near(nextBeat.wheelAngle - start.wheelAngle,
    -geometry.halfToothPitch, 8e-16, 'clockwise half pitch per beat');
  near(nextCycle.wheelAngle - start.wheelAngle,
    -geometry.toothPitch, 9e-16, 'clockwise tooth per oscillation');
  near(nextCycle.pendulumAngle, start.pendulumAngle, 5e-16,
    'pendulum oscillation closure');
  near(nextCycle.pendulumAngularSpeed,
    start.pendulumAngularSpeed, 5e-16, 'pendulum speed closure');
  assert.equal(nextCycle.stage, start.stage);
  disposeModel(model.root);
});

test('movement 290 free drops are finite clockwise flights ending in recoil', () => {
  const model = createMovementModel(catalog.movements[289]);
  const {
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;

  near(geometry.contactAdvancePastLanding + geometry.freeDropAdvance,
    geometry.halfToothPitch, 0, 'half-pitch partition');
  assert.ok(geometry.freeDropAngularAcceleration < 0);
  assert.ok(geometry.freeDropLandingWheelSpeed
    < geometry.contactReleaseWheelSpeed);
  assert.ok(geometry.landingImpactVelocityChange > 0);

  const release = canonicalTimes.rightRelease;
  const nextLanding = canonicalTimes.leftLanding;
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
    assert.match(state.stage, /clockwise-free-drop/);
    assert.ok(state.wheelAngularSpeed < 0);
    near(state.wheelAngularAcceleration,
      geometry.freeDropAngularAcceleration, 0,
    `constant train acceleration at ${sample}`);
    assert.ok(state.wheelAngle < previousAngle);
    previousAngle = state.wheelAngle;
  }
  const epsilon = 1e-9;
  const afterRelease = stateAtTime(release + epsilon);
  const beforeLanding = stateAtTime(nextLanding - epsilon);
  const landing = stateAtTime(nextLanding);
  near(afterRelease.wheelAngle, stateAtTime(release).wheelAngle, 2e-10,
    'release/drop positional continuity');
  near(beforeLanding.wheelAngle, landing.wheelAngle, 3e-9,
    'drop/landing positional continuity');
  near(beforeLanding.wheelAngularSpeed,
    geometry.freeDropLandingWheelSpeed, 5e-8,
  'pre-impact clockwise speed');
  near(landing.wheelAngularSpeed,
    geometry.contactLandingWheelSpeed, 3e-16,
  'post-impact counterclockwise recoil speed');
  disposeModel(model.root);
});

test('movement 290 analytic wheel and pendulum rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[289]);
  const { stateAtTime } = model.root.userData;
  const epsilon = 2e-5;
  for (const time of [0.08, 0.50, 1.20, 1.80, 1.98, 2.10,
    2.50, 3.20, 3.80, 3.98]) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near((after.pendulumAngle - before.pendulumAngle) / (2 * epsilon),
      state.pendulumAngularSpeed, 2e-10,
    `pendulum speed at ${time}`);
    near((after.pendulumAngularSpeed - before.pendulumAngularSpeed)
        / (2 * epsilon),
    state.pendulumAngularAcceleration, 3e-10,
    `pendulum acceleration at ${time}`);
    near((after.wheelAngle - before.wheelAngle) / (2 * epsilon),
      state.wheelAngularSpeed, 9e-9,
    `wheel speed at ${time}`);
    near((after.wheelAngularSpeed - before.wheelAngularSpeed)
        / (2 * epsilon),
    state.wheelAngularAcceleration, 1.5e-8,
    `wheel acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 290 renderer binds the annulus, wheel, contacts, and next draft', () => {
  const model = createMovementModel(catalog.movements[289]);
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

  for (const time of [0, 0.50, 1, 1.80, 2, 2.50, 3, 3.80, 4]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.annularPendulum.rotation.z,
      expected.pendulumAngle, 0, `rendered pendulum at ${time}`);
    near(blocks.wheelRotor.rotation.z,
      expected.wheelAngle, 0, `rendered wheel at ${time}`);
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
  const startPendulumAngle = blocks.annularPendulum.rotation.z;
  const startWheelAngle = blocks.wheelRotor.rotation.z;
  model.update(0.73 + geometry.pendulumPeriod);
  near(blocks.annularPendulum.rotation.z,
    startPendulumAngle, 3e-16, 'rendered pendulum closure');
  near(blocks.wheelRotor.rotation.z - startWheelAngle,
    -geometry.toothPitch, 9e-16, 'rendered clockwise tooth advance');

  const movement507 = catalog.movements[506];
  const model294 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model294.root.userData.fidelity, 'authored');
  disposeModel(model294.root);
  disposeModel(model.root);
});
