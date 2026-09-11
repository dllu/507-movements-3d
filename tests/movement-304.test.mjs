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

test('movement 304 is one thirty-pin wheel and one same-plane two-pallet Le Paute assembly', () => {
  const movement = catalog.movements[303];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    presentation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 304);
  assert.equal(movement.number, '304');
  assert.equal(movement.title,
    'Le Paute pin-wheel escapement with replaceable A/B pins');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'thirty-replaceable-single-plane-le-paute-pin-wheel-deadbeat-with-a-b-profiles');
  assert.equal(archetype, movement.archetype);
  assert.match(presentation, /front elevation/);
  assert.match(mechanism, /thirty replaceable single-plane pins/);
  assert.match(mechanism, /half-round A/);
  assert.match(mechanism, /undercut B/);
  assert.match(mechanism, /higher-outer and lower-inner pallets/);
  assert.match(mechanism, /concentric resting arcs/);
  assert.equal(transmission.pinCount, 30);
  assert.match(transmission.direction, /clockwise/);
  assert.match(transmission.impulse, /both pallet impulses act downward/);
  assert.match(transmission.deadbeat, /exactly zero/);
  assert.equal(transmission.recoil, 'none');

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.palletAssembly.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.contactMarker.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.wheelRim.parent, blocks.wheelRotor);
  assert.equal(blocks.outerPallet.parent, blocks.palletAssembly);
  assert.equal(blocks.innerPallet.parent, blocks.palletAssembly);
  assert.equal(blocks.pinMeshes.length, 30);
  assert.equal(blocks.preferredPins.length, 15);
  assert.equal(blocks.legacyPins.length, 15);
  assert.equal(blocks.spokeMeshes.length, 5);
  assert.equal(blocks.hubBoltMeshes.length, 8);
  assert.equal(blocks.palletSupportBolts.length, 3);
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'pin-wheel axis');
  vectorNear(blocks.palletAssembly.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'pallet axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'replaceable-pin-rivet-stem').length, 30);
  assert.equal(roles.filter((role) =>
    role === 'five-arm-pin-wheel-spoke').length, 5);
  assert.equal(roles.filter((role) =>
    /pallet-concentric-resting-face$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /pallet-downward-impulse-face$/.test(role)).length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 304 records Brown’s plate and the period thirty-pin construction evidence', () => {
  const movement = catalog.movements[303];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate304;
  const construction = sourceReference.constructionReference;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.match(sourceAnimation.referenceScope, /same-plane pallet offset/);
  assert.match(sourceAnimation.referenceScope, /downward action/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_304.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.equal(plate.modeledPinCount, 30);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterWheelCenter, new THREE.Vector2(190, 333));
  assert.equal(plate.rasterWheelOuterRadius, 171);
  assert.deepEqual(plate.rasterWheelBounds, {
    bottom: 506,
    left: 19,
    right: 385,
    top: 164,
  });
  assert.deepEqual(plate.rasterPalletPivot, new THREE.Vector2(359, 83));
  assert.deepEqual(plate.rasterOuterPalletTip,
    new THREE.Vector2(331, 353));
  assert.deepEqual(plate.rasterInnerPalletTip,
    new THREE.Vector2(311, 336));
  assert.deepEqual(plate.rasterLegacyPinA, new THREE.Vector2(47, 318));
  assert.deepEqual(plate.rasterPreferredPinB,
    new THREE.Vector2(321, 429));
  assert.equal(plate.rasterHubBoltCircleRadius, 31);
  assert.match(plate.inferredTopology, /single working plane/);
  assert.match(plate.sourceDirection, /clockwise/);
  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 0, 'source wheel center');
  vectorNear(sourcePointToModel(plate.rasterPalletPivot),
    geometry.palletPivot, 0, 'source pallet pivot');
  near(geometry.wheelOuterRadius,
    plate.rasterWheelOuterRadius * geometry.sourceScale, 0,
  'source wheel radius');

  assert.equal(construction.author, 'Ward L. Goodrich');
  assert.equal(construction.publicationYear, 1905);
  assert.equal(construction.title, 'The Modern Clock');
  assert.match(construction.chapter, /Le Paute/);
  assert.deepEqual(construction.figures, [39, 40]);
  assert.match(construction.details, /Thirty pins at twelve-degree spacing/);
  assert.match(construction.details, /four-degree pallet swing/);
  assert.match(construction.details, /inner arm is offset/);
  assert.match(construction.details, /same plane/);
  assert.match(construction.url, /gutenberg\.org/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 75,
    edition: 21,
    illustrationPage: 74,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 304 builds replaceable half-round A and relieved B pin profiles at twelve-degree spacing', () => {
  const model = createMovementModel(catalog.movements[303]);
  const {
    blocks,
    geometry,
    pinProfileForIndex,
    pinProfiles,
    stateAtTime,
  } = model.root.userData;

  assert.equal(geometry.pinCount, 30);
  near(geometry.pinPitch, THREE.MathUtils.degToRad(12), 1e-15,
    'pin pitch');
  near(geometry.halfPinPitch, THREE.MathUtils.degToRad(6), 1e-15,
    'half-pitch beat');
  near(geometry.sourcePinAngularDiameter,
    THREE.MathUtils.degToRad(4), 0, 'source pin angular diameter');
  near(geometry.sourcePendulumTotalSwing,
    THREE.MathUtils.degToRad(4), 0, 'source total swing');
  near(geometry.palletAmplitude,
    geometry.sourcePendulumTotalSwing / 2, 0, 'swing amplitude');
  near(geometry.pinRadius,
    geometry.meanPalletRadius
      * Math.sin(geometry.sourcePinAngularDiameter / 2),
    1e-15, 'pin size from four-degree construction');
  near(geometry.legacyPinWorkingArc, Math.PI, 0,
    'legacy half-round working arc');
  near(geometry.preferredPinWorkingArc, Math.PI / 2, 0,
    'preferred short working arc');
  assert.deepEqual(pinProfiles.legacyA, {
    count: 15,
    profile: 'one-half circular cylinder retained; inactive upper half removed',
    sourceLabel: 'A',
    workingArcRadians: Math.PI,
  });
  assert.deepEqual(pinProfiles.preferredB, {
    count: 15,
    profile: 'upper half removed and underside additionally relieved',
    sourceLabel: 'B',
    workingArcRadians: Math.PI / 2,
  });

  for (let index = 0; index < blocks.pinMeshes.length; index += 1) {
    const pin = blocks.pinMeshes[index];
    const expectedProfile = pinProfileForIndex(index);
    assert.equal(pin.userData.index, index);
    assert.equal(pin.userData.profile, expectedProfile);
    assert.equal(pin.userData.replaceable, true);
    assert.equal(pin.children.length, 2);
    assert.equal(pin.children.some(({ userData }) =>
      userData.role === 'replaceable-pin-rivet-stem'), true);
    assert.equal(pin.userData.role, expectedProfile === 'preferred-B'
      ? 'replaceable-preferred-flattened-B-pin'
      : 'replaceable-legacy-half-round-A-pin');
  }
  assert.equal(stateAtTime(0).activePinProfile, 'preferred-B');
  assert.equal(stateAtTime(4).activePinProfile, 'preferred-B');
  disposeModel(model.root);
});

test('movement 304 keeps both pallet bits in one plane while doglegging only the inner arm clear of the pins', () => {
  const model = createMovementModel(catalog.movements[303]);
  const {
    blocks,
    geometry,
    impulseFacePoints,
    lockFacePoints,
    palletProfiles,
  } = model.root.userData;
  const pinFrontZ = geometry.wheelDepth / 2 + geometry.pinLength;

  near(blocks.outerPalletBody.position.z, geometry.workingPlaneZ, 0,
    'outer pallet working plane');
  near(blocks.innerPalletBody.position.z, geometry.workingPlaneZ, 0,
    'inner pallet working plane');
  near(blocks.outerPalletArm.position.z, geometry.workingPlaneZ, 0,
    'outer arm remains in working plane');
  assert.ok(blocks.innerPalletArm.position.z > pinFrontZ);
  assert.ok(blocks.innerPalletOffsetPost.geometry.parameters.height
    > blocks.outerPalletOffsetPost.geometry.parameters.height);
  assert.match(blocks.innerPalletOffsetPost.userData.role,
    /offset-to-clear-pin-row/);
  assert.match(palletProfiles.outer.position, /higher pallet/);
  assert.match(palletProfiles.inner.position, /lower pallet/);
  assert.equal(palletProfiles.outer.impulseDirection, 'downward');
  assert.equal(palletProfiles.inner.impulseDirection, 'downward');
  assert.equal(palletProfiles.outer.lockPoints.length, 49);
  assert.equal(palletProfiles.inner.lockPoints.length, 49);
  assert.equal(palletProfiles.outer.impulsePoints.length, 37);
  assert.equal(palletProfiles.inner.impulsePoints.length, 37);
  assert.ok(palletProfiles.outer.lockConcentricRadiusRange < 4e-15);
  assert.ok(palletProfiles.inner.lockConcentricRadiusRange < 4e-15);
  assert.ok(palletProfiles.outer.impulseConcentricRadiusRange > 0.25);
  assert.ok(palletProfiles.inner.impulseConcentricRadiusRange > 0.25);

  for (const side of [-1, 1]) {
    const lockPoints = lockFacePoints(side, 121);
    const impulsePoints = impulseFacePoints(side, 121);
    const lockRadii = lockPoints.map((point) => point.length());
    near(Math.max(...lockRadii) - Math.min(...lockRadii), 0, 4e-15,
      `${side} concentric pallet rest`);
    vectorNear(lockPoints[0], impulsePoints[0], 3e-15,
      `${side} rest/impulse join`);
    assert.ok(impulsePoints.at(-1).distanceTo(impulsePoints[0]) > 0.19);
  }
  disposeModel(model.root);
});

test('movement 304 alternates the same pin outer-to-inner and the succeeding pin back to outer with exact contact', () => {
  const model = createMovementModel(catalog.movements[303]);
  const {
    lockPinCenterForSide,
    palletFaceFrame,
    stateAtCyclePhase,
  } = model.root.userData;
  const contactSpells = [];
  const lockCounts = new Map([[-1, 0], [1, 0]]);
  const impulseCounts = new Map([[-1, 0], [1, 0]]);
  let previousContact = false;

  for (let sample = 0; sample <= 14000; sample += 1) {
    const state = stateAtCyclePhase(sample / 14000);
    if (state.contactActive && !previousContact) {
      contactSpells.push({
        index: state.activePinIndex,
        profile: state.activePinProfile,
        side: state.activeSide,
      });
    }
    previousContact = state.contactActive;
    if (!state.contactActive) continue;

    near(state.contact.pointError, 0, 4e-15,
      `pin/pallet point closure at ${sample}`);
    near(state.contact.normalVelocityError, 0, 2e-15,
      `pin/pallet normal velocity at ${sample}`);
    near(state.contact.radialClearanceError, 0, 1e-15,
      `pin surface radius at ${sample}`);
    assert.ok(Number.isFinite(state.contact.relativeSlipSpeed));
    assert.equal(state.contact.pinProfile, state.activePinProfile);
    const mode = state.lockActive ? 'lock' : 'impulse';
    const frame = palletFaceFrame(
      state.activeSide,
      state.palletAngle,
      mode,
    );
    vectorNear(state.contact.localPoint, frame.point, 0,
      `pallet material point at ${sample}`);
    if (state.lockActive) {
      lockCounts.set(state.activeSide, lockCounts.get(state.activeSide) + 1);
      assert.equal(state.contactMode, 'concentric-rest');
      assert.equal(state.wheelAngularSpeed, 0);
      assert.equal(state.wheelAngularAcceleration, 0);
      near(state.contact.concentricRadiusError, 0, 4e-15,
        `deadbeat radius at ${sample}`);
      vectorNear(state.activePinCenter,
        lockPinCenterForSide(state.activeSide), 4e-15,
      `stationary pin center at ${sample}`);
    } else {
      impulseCounts.set(state.activeSide,
        impulseCounts.get(state.activeSide) + 1);
      assert.equal(state.contactMode, 'downward-impulse');
      assert.ok(state.contact.faceNormal.y < -0.16);
      assert.ok(state.contact.pinMaterialVelocity.y <= 1e-14);
      assert.ok(state.impulseProgress >= 0);
      assert.ok(state.impulseProgress <= 1);
    }
  }
  assert.deepEqual(contactSpells, [
    { index: 0, profile: 'preferred-B', side: 1 },
    { index: 0, profile: 'preferred-B', side: -1 },
    { index: 1, profile: 'preferred-B', side: 1 },
  ]);
  assert.ok(lockCounts.get(1) > 4800);
  assert.ok(lockCounts.get(-1) > 4800);
  assert.ok(impulseCounts.get(1) > 700);
  assert.ok(impulseCounts.get(-1) > 700);
  disposeModel(model.root);
});

test('movement 304 partitions each clockwise beat into four degrees of impulse and two of free drop without recoil', () => {
  const model = createMovementModel(catalog.movements[303]);
  const { canonicalTimes, geometry, stateAtCyclePhase, stateAtTime } =
    model.root.userData;

  near(geometry.impulseAdvance, THREE.MathUtils.degToRad(4), 1e-15,
    'impulse advance');
  near(geometry.freeDropAdvance, THREE.MathUtils.degToRad(2), 1e-15,
    'free-drop advance');
  near(geometry.impulseAdvance + geometry.freeDropAdvance,
    geometry.halfPinPitch, 1e-15, 'half-pitch partition');
  near(geometry.impulseReleaseWheelSpeed, 0, 0,
    'zero-speed release');
  near(geometry.impulseReleaseWheelAcceleration, 0, 0,
    'zero-acceleration release');
  assert.ok(geometry.freeDropAngularAcceleration < 0);
  assert.ok(geometry.freeDropLandingWheelSpeed < 0);
  assert.ok(geometry.landingImpactVelocityChange > 0);

  let dropEntries = 0;
  let previousDrop = false;
  let previousAngle = stateAtTime(0).wheelAngle;
  for (let sample = 0; sample <= 14000; sample += 1) {
    const state = stateAtCyclePhase(sample / 14000);
    assert.ok(state.wheelAngularSpeed <= 1e-14,
      `clockwise/no recoil at ${sample}`);
    const dropping = state.dropProgress !== null;
    if (dropping && !previousDrop) dropEntries += 1;
    if (dropping) {
      assert.ok(state.dropProgress >= 0);
      assert.ok(state.dropProgress <= 1);
      assert.ok(state.wheelAngle <= previousAngle + 1e-13);
      near(state.wheelAngularAcceleration,
        geometry.freeDropAngularAcceleration, 0,
      `constant free-drop acceleration at ${sample}`);
    }
    previousDrop = dropping;
    previousAngle = state.wheelAngle;
  }
  assert.equal(dropEntries, 2);

  for (const [releaseName, landingName] of [
    ['outerRelease', 'innerLanding'],
    ['innerRelease', 'outerLanding'],
  ]) {
    const release = stateAtTime(canonicalTimes[releaseName]);
    const landingTime = canonicalTimes[landingName];
    const beforeLanding = stateAtTime(landingTime - 1e-9);
    const landing = stateAtTime(landingTime);
    near(release.wheelAngularSpeed, 0, 2e-12,
      `${releaseName} release speed`);
    near(beforeLanding.wheelAngle, landing.wheelAngle, 1e-9,
      `${landingName} position continuity`);
    near(beforeLanding.wheelAngularSpeed,
      geometry.freeDropLandingWheelSpeed, 4e-8,
    `${landingName} impact speed`);
    assert.equal(landing.wheelAngularSpeed, 0);
  }

  const start = stateAtTime(0.40);
  const nextBeat = stateAtTime(0.40 + geometry.halfBeatDuration);
  const nextCycle = stateAtTime(0.40 + geometry.pendulumPeriod);
  near(nextBeat.wheelAngle - start.wheelAngle,
    -geometry.halfPinPitch, 8e-16, 'one half-pitch per beat');
  near(nextCycle.wheelAngle - start.wheelAngle,
    -geometry.pinPitch, 9e-16, 'one pin pitch per oscillation');
  assert.equal(start.activePinIndex, nextBeat.activePinIndex);
  assert.equal(nextCycle.activePinIndex,
    (start.activePinIndex + 1) % geometry.pinCount);
  near(nextCycle.palletAngle, start.palletAngle, 5e-16,
    'pallet closure');
  disposeModel(model.root);
});

test('movement 304 analytic rates and renderer bindings agree in locks, impulses, and drops', () => {
  const model = createMovementModel(catalog.movements[303]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const epsilon = 2e-5;
  const sampleTimes = [0.2, 0.8, 1.1, 1.8, 2.8, 3.1, 3.7];

  for (const time of sampleTimes) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near((after.palletAngle - before.palletAngle) / (2 * epsilon),
      state.palletAngularSpeed, 5e-10,
    `pallet speed at ${time}`);
    near((after.palletAngularSpeed - before.palletAngularSpeed)
        / (2 * epsilon),
    state.palletAngularAcceleration, 5e-10,
    `pallet acceleration at ${time}`);
    near((after.wheelAngle - before.wheelAngle) / (2 * epsilon),
      state.wheelAngularSpeed, 2e-8,
    `wheel speed at ${time}`);
    near((after.wheelAngularSpeed - before.wheelAngularSpeed)
        / (2 * epsilon),
    state.wheelAngularAcceleration, 5e-7,
    `wheel acceleration at ${time}`);

    model.update(time);
    near(blocks.palletAssembly.rotation.z, state.palletAngle, 0,
      `rendered pallets at ${time}`);
    near(blocks.wheelRotor.rotation.z, state.wheelAngle, 0,
      `rendered wheel at ${time}`);
    near(blocks.wheelRotor.userData.angularSpeed,
      state.wheelAngularSpeed, 0, `rendered wheel speed at ${time}`);
    assert.equal(blocks.contactMarker.visible, state.contactActive);
    assert.equal(model.root.userData.contacts.mode, state.contactMode);
    if (state.contactActive) {
      vectorNear(new THREE.Vector2(
        blocks.contactMarker.position.x,
        blocks.contactMarker.position.y,
      ), state.contact.expectedPoint, 0,
      `rendered contact at ${time}`);
      near(blocks.contactMarker.position.z,
        geometry.contactMarkerZ, 0, `front contact witness at ${time}`);
      near(model.root.userData.contacts.pointError, 0, 4e-15,
        `rendered contact closure at ${time}`);
    } else {
      assert.equal(model.root.userData.contacts.activePallet, null);
      assert.ok(model.root.userData.contacts.dropProgress >= 0);
      assert.ok(model.root.userData.contacts.dropProgress <= 1);
    }
  }
  disposeModel(model.root);
});

test('movement 304 closes one pin pitch, remains distinct from 292, and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[303]);
  const {
    animationTiming,
    canonicalTimes,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;

  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(timeline.demonstrationPeriod, 4);
  assert.equal(canonicalTimes.sourcePose, 0);
  assert.equal(canonicalTimes.outerMaximumLock, 0);
  const start = stateAtTime(0);
  const end = stateAtTime(4);
  assert.equal(start.sourcePose, true);
  assert.equal(end.sourcePose, true);
  assert.equal(start.stage, 'higher-outer-maximum-deadbeat-lock');
  assert.equal(end.stage, start.stage);
  assert.equal(start.activePinIndex, 0);
  assert.equal(end.activePinIndex, 1);
  assert.equal(start.activePinProfile, 'preferred-B');
  near(end.wheelAngle - start.wheelAngle,
    -geometry.pinPitch, 9e-16, 'clockwise cycle advance');
  near(end.pinsAdvanced, 1, 2e-15, 'one pin advanced');

  const stud292 = createMovementModel(catalog.movements[291]);
  assert.equal(stud292.root.userData.geometry.studCount, 48);
  assert.equal(stud292.root.userData.blocks.frontStuds.length, 24);
  assert.equal(stud292.root.userData.blocks.rearStuds.length, 24);
  assert.equal(stud292.root.userData.blocks.studMeshes.some((stud) =>
    stud.userData.axialPlane === 'rear'), true);
  assert.equal(model.root.userData.blocks.pinMeshes.some((pin) =>
    'axialPlane' in pin.userData), false);
  assert.notEqual(stud292.root.userData.archetype,
    model.root.userData.archetype);

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(stud292.root);
  disposeModel(model.root);
});
