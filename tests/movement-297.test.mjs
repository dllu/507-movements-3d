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

test('movement 297 is one eight-trundle lantern cage controlled by one two-pallet arm', () => {
  const movement = catalog.movements[296];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 297);
  assert.equal(movement.number, '297');
  assert.equal(movement.title, 'Lantern-wheel escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'eight-trundle-single-arm-two-pallet-lantern-wheel-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one counter-clockwise eight-trundle lantern cage/);
  assert.match(mechanism, /one rocking arm A carrying exactly two/);
  assert.match(mechanism, /one cylindrical trundle contacts one pallet/);
  assert.equal(transmission.trundleCount, 8);
  assert.equal(transmission.palletCount, 2);
  assert.equal(transmission.activeContactsAtOnce, 1);
  assert.match(transmission.direction, /counter-clockwise/);

  assert.equal(blocks.lanternWheel.parent, model.root);
  assert.equal(blocks.armAssembly.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.lanternWheel);
  assert.equal(blocks.armA.parent, blocks.armAssembly);
  assert.equal(blocks.palletB.parent, blocks.armAssembly);
  assert.equal(blocks.palletC.parent, blocks.armAssembly);
  assert.equal(blocks.palletBBody.parent, blocks.palletB);
  assert.equal(blocks.palletCBody.parent, blocks.palletC);
  assert.equal(blocks.sidePlates.length, 2);
  assert.equal(blocks.sidePlateSpokes.length, 8);
  assert.equal(blocks.trundles.length, 8);
  assert.equal(blocks.wheelHubs.length, 2);
  vectorNear(blocks.lanternWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'lantern-wheel axis');
  vectorNear(blocks.armAssembly.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'arm A axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'axial-cylindrical-lantern-trundle').length, 8);
  assert.equal(roles.filter((role) =>
    /^complete-lantern-pallet-[BC]$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    role === 'one-piece-rocking-arm-A').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'one-white-active-trundle-contact-marker').length, 1);
  assert.equal(roles.some((role) => /escape-wheel-tooth/.test(role)), false);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 297 records Brown’s eight circles, A–C layout, arrow, and unavailable animation', () => {
  const movement = catalog.movements[296];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate297;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /eight-position lantern wheel/);
  assert.match(sourceAnimation.referenceScope, /arm A/);
  assert.match(sourceAnimation.referenceScope, /pallets B and C/);
  assert.match(sourceAnimation.referenceScope, /one-pitch-per-oscillation/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_297.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.rasterWheelCenter, new THREE.Vector2(272, 315));
  assert.deepEqual(plate.rasterArmPivotA, new THREE.Vector2(385, 76));
  assert.deepEqual(plate.rasterPalletB, new THREE.Vector2(405, 203));
  assert.deepEqual(plate.rasterPalletC, new THREE.Vector2(355, 270));
  assert.deepEqual(plate.rasterDirectionArrow,
    new THREE.Vector2(145, 264));
  assert.equal(plate.rasterWheelOuterRadius, 190);
  assert.equal(plate.rasterTrundleOrbitRadius, 151);
  assert.equal(plate.rasterTrundleRadius, 22);
  assert.equal(plate.visibleTrundleCount, 8);
  assert.equal(plate.rasterTrundleCenters.length, 8);
  assert.deepEqual(plate.rasterTrundleCenters, [
    new THREE.Vector2(258, 157),
    new THREE.Vector2(157, 226),
    new THREE.Vector2(113, 316),
    new THREE.Vector2(163, 423),
    new THREE.Vector2(289, 462),
    new THREE.Vector2(382, 413),
    new THREE.Vector2(424, 306),
    new THREE.Vector2(369, 195),
  ]);
  assert.match(plate.inferredTopology, /eight axial round trundles/);
  assert.match(plate.inferredTopology, /one pivoted arm A/);

  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 0, 'source wheel center');
  vectorNear(sourcePointToModel(plate.rasterArmPivotA),
    geometry.armPivot, 0, 'source arm pivot A');
  near(plate.rasterWheelOuterRadius * geometry.sourceScale,
    geometry.wheelOuterRadius, 0, 'source outer radius');
  near(plate.rasterTrundleOrbitRadius * geometry.sourceScale,
    geometry.trundleOrbitRadius, 0, 'source trundle orbit');
  near(plate.rasterTrundleRadius * geometry.sourceScale,
    geometry.trundleRadius, 0, 'source trundle radius');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.periodReference.publicationYear, 1904);
  assert.equal(sourceReference.periodReference.entry, 107);
  assert.match(sourceReference.periodReference.description,
    /two plates set at angles/);
  disposeModel(model.root);
});

test('movement 297 builds a real two-plate lantern cage with eight axial trundles', () => {
  const model = createMovementModel(catalog.movements[296]);
  const { blocks, geometry } = model.root.userData;

  assert.deepEqual(blocks.sidePlates.map((plate) => plate.userData.axialSide),
    ['rear', 'front']);
  near(blocks.sidePlates[0].position.z,
    -geometry.sidePlateOffset, 0, 'rear plate z');
  near(blocks.sidePlates[1].position.z,
    geometry.sidePlateOffset, 0, 'front plate z');
  assert.ok(geometry.trundleLength
    > 2 * geometry.sidePlateOffset + geometry.sidePlateDepth,
  'trundles bridge and project beyond both end plates');

  const measuredAngles = [];
  blocks.trundles.forEach((trundle, index) => {
    assert.equal(trundle.parent, blocks.wheelRotor);
    assert.equal(trundle.userData.index, index);
    vectorNear(trundle.userData.axis,
      new THREE.Vector3(0, 0, 1), 0, `trundle ${index} axis`);
    near(Math.hypot(trundle.position.x, trundle.position.y),
      geometry.trundleOrbitRadius, 4e-16, `trundle ${index} orbit`);
    near(trundle.position.z, 0, 0, `trundle ${index} centered in cage`);
    measuredAngles.push(Math.atan2(trundle.position.y, trundle.position.x));
  });
  for (let index = 0; index < measuredAngles.length; index += 1) {
    near(measuredAngles[index], index * geometry.trundlePitch > Math.PI
      ? index * geometry.trundlePitch - Math.PI * 2
      : index * geometry.trundlePitch,
    5e-16, `trundle ${index} angular station`);
  }
  near(geometry.trundlePitch, Math.PI / 4, 0, 'eight-position pitch');
  near(geometry.halfTrundlePitch, Math.PI / 8, 0, 'half pitch');
  assert.equal(blocks.wheelIndex.parent, blocks.wheelRotor);
  assert.equal(blocks.rimIndex.parent, blocks.wheelRotor);
  disposeModel(model.root);
});

test('movement 297 keeps B and C as two source-angle plates on the same rigid arm A', () => {
  const model = createMovementModel(catalog.movements[296]);
  const {
    blocks,
    palletProfiles,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate297;

  assert.equal(Object.keys(palletProfiles).length, 2);
  assert.deepEqual(Object.keys(palletProfiles), ['B', 'C']);
  for (const [name, sourceCenter, sourceAngle] of [
    ['B', plate.rasterPalletB, plate.rasterPalletBLongAxisDegrees],
    ['C', plate.rasterPalletC, plate.rasterPalletCLongAxisDegrees],
  ]) {
    const profile = palletProfiles[name];
    assert.equal(profile.name, name);
    near(profile.longAxisDegrees, sourceAngle, 0,
      `pallet ${name} source angle`);
    vectorNear(profile.sourceCenterWorld,
      sourcePointToModel(sourceCenter), 0, `pallet ${name} source center`);
    near(profile.tangent.length(), 1, 2e-16,
      `pallet ${name} unit tangent`);
    near(profile.normal.length(), 1, 2e-16,
      `pallet ${name} unit normal`);
    near(profile.tangent.dot(profile.normal), 0, 6e-17,
      `pallet ${name} perpendicular frame`);
    assert.equal(profile.workingFaceLocalPoints.length, 2);
    assert.ok(profile.workingFaceLocalPoints[0].distanceTo(
      profile.workingFaceLocalPoints[1],
    ) > 0.30, `pallet ${name} has a finite working plate`);
  }
  assert.equal(blocks.palletB.userData.sourceName, 'B');
  assert.equal(blocks.palletC.userData.sourceName, 'C');
  assert.equal(blocks.palletB.parent, blocks.armAssembly);
  assert.equal(blocks.palletC.parent, blocks.armAssembly);
  assert.equal(blocks.palletBFace.parent, blocks.palletB);
  assert.equal(blocks.palletCFace.parent, blocks.palletC);
  assert.equal(blocks.armAssembly.children.filter((child) =>
    /^complete-lantern-pallet-/.test(child.userData.role ?? '')).length, 2);
  disposeModel(model.root);
});

test('movement 297 alternates exactly one B/C trundle contact with exact surface closure', () => {
  const model = createMovementModel(catalog.movements[296]);
  const {
    geometry,
    stateAtTime,
    trundleIndexForHalfBeat,
  } = model.root.userData;
  const palletCounts = new Map([['B', 0], ['C', 0]]);
  const trundleSequence = [0, 7, 7, 6, 6, 5];

  trundleSequence.forEach((expectedIndex, halfBeatIndex) => {
    assert.equal(trundleIndexForHalfBeat(halfBeatIndex), expectedIndex);
  });
  for (let sample = 0; sample <= 24000; sample += 1) {
    const time = 3 * geometry.armPeriod * sample / 24000;
    const state = stateAtTime(time);
    if (!state.contactActive) {
      assert.equal(state.contact, null);
      assert.match(state.stage, /^free-drop-to-pallet-[BC]$/);
      continue;
    }
    palletCounts.set(state.activePalletName,
      palletCounts.get(state.activePalletName) + 1);
    assert.equal(state.contact.activePallet, state.activePalletName);
    assert.equal(state.contact.activeTrundleIndex,
      state.activeTrundleIndex);
    near(state.contact.pointError, 0, 1.5e-14,
      `trundle/pallet point closure at ${sample}`);
    near(state.contact.normalVelocityError, 0, 1e-7,
      `trundle/pallet normal velocity at ${sample}`);
    near(state.contact.trundleSurfacePoint.distanceTo(
      state.activeTrundleCenter,
    ), geometry.trundleRadius, 2e-15,
    `trundle surface radius at ${sample}`);
    assert.ok(Number.isFinite(state.contact.relativeSlipSpeed));
    assert.ok(['frictional-recoil', 'direct-return-impulse']
      .includes(state.contactMode));
  }
  assert.ok(palletCounts.get('B') > 8500);
  assert.ok(palletCounts.get('C') > 8500);
  disposeModel(model.root);
});

test('movement 297 recoils on both pallets and its two drops total one trundle pitch', () => {
  const model = createMovementModel(catalog.movements[296]);
  const {
    canonicalStates,
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;

  assert.ok(canonicalStates.palletBMaximumRecoil.wheelAngle
    < canonicalStates.palletBLanding.wheelAngle);
  assert.ok(canonicalStates.palletCMaximumRecoil.wheelAngle
    < canonicalStates.palletCLanding.wheelAngle);
  near(canonicalStates.palletBRelease.wheelAngle,
    canonicalStates.palletBLanding.wheelAngle, 7e-16,
  'B returns its recoil before release');
  near(canonicalStates.palletCRelease.wheelAngle,
    canonicalStates.palletCLanding.wheelAngle, 7e-16,
  'C returns its recoil before release');
  assert.equal(canonicalStates.palletBLanding.contactMode,
    'frictional-recoil');
  assert.equal(canonicalStates.palletBReturnImpulse.contactMode,
    'direct-return-impulse');
  assert.equal(canonicalStates.palletCLanding.contactMode,
    'frictional-recoil');
  assert.equal(canonicalStates.palletCReturnImpulse.contactMode,
    'direct-return-impulse');

  assert.ok(transmission.evenToOddDropAdvance > 0);
  assert.ok(transmission.oddToEvenDropAdvance > 0);
  assert.notEqual(transmission.evenToOddDropAdvance,
    transmission.oddToEvenDropAdvance);
  near(transmission.evenToOddDropAdvance
      + transmission.oddToEvenDropAdvance,
  geometry.trundlePitch, 8e-16, 'two unequal drops total one pitch');
  near(transmission.averageHalfBeatAdvance,
    geometry.halfTrundlePitch, 0, 'average advance per beat');
  near(transmission.armOscillationAdvance,
    geometry.trundlePitch, 0, 'one pitch per arm oscillation');

  for (const time of [0.03, 0.44, 1.17, 2.08, 3.61]) {
    near(stateAtTime(time + geometry.armPeriod).wheelAngle
        - stateAtTime(time).wheelAngle,
    geometry.trundlePitch, 1.5e-15,
    `one-pitch closure at ${time}`);
    near(stateAtTime(time + geometry.armPeriod).armAngle,
      stateAtTime(time).armAngle, 7e-16,
    `arm closure at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 297 exposes analytic arm and wheel rates and binds them to rendered transforms', () => {
  const model = createMovementModel(catalog.movements[296]);
  const {
    blocks,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const epsilon = 1e-5;

  for (const time of [0.10, 0.42, 0.83, 1.31, 1.91,
    2.10, 2.42, 2.83, 3.31, 3.91]) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near((after.armAngle - before.armAngle) / (2 * epsilon),
      state.armAngularSpeed, 2e-10, `arm speed at ${time}`);
    near((after.armAngularSpeed - before.armAngularSpeed)
        / (2 * epsilon),
    state.armAngularAcceleration, 2e-10, `arm acceleration at ${time}`);
    near((after.wheelAngle - before.wheelAngle) / (2 * epsilon),
      state.wheelAngularSpeed, 1.3e-6, `wheel speed at ${time}`);
    near((after.wheelAngularSpeed - before.wheelAngularSpeed)
        / (2 * epsilon),
    state.wheelAngularAcceleration, 4e-5,
    `wheel acceleration at ${time}`);

    model.update(time);
    near(blocks.armAssembly.rotation.z, state.armAngle, 0,
      `rendered arm angle at ${time}`);
    near(blocks.wheelRotor.rotation.z, state.wheelAngle, 0,
      `rendered wheel angle at ${time}`);
    assert.equal(blocks.contactMarker.visible, state.contactActive);
    assert.equal(model.root.userData.contacts.activePallet,
      state.contactActive ? state.activePalletName : null);
    assert.equal(model.root.userData.contacts.activeTrundleIndex,
      state.activeTrundleIndex);
  }
  model.update(0.70);
  const initialArm = blocks.armAssembly.rotation.z;
  const initialWheel = blocks.wheelRotor.rotation.z;
  model.update(0.70 + geometry.armPeriod);
  near(blocks.armAssembly.rotation.z, initialArm, 7e-16,
    'rendered arm cycle closure');
  near(blocks.wheelRotor.rotation.z - initialWheel,
    geometry.trundlePitch, 1e-15, 'rendered wheel one-pitch advance');
  disposeModel(model.root);
});

test('movement 297 publishes its reviewed timeline and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[296]);
  const {
    animationTiming,
    canonicalTimes,
    geometry,
    timeline,
  } = model.root.userData;

  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(timeline.demonstrationPeriod, 4);
  assert.deepEqual(timeline.schedule, [
    'trundle-lands-on-pallet-B',
    'B-recoil-then-direct-return-impulse',
    'counter-clockwise-free-drop-to-C',
    'trundle-lands-on-pallet-C',
    'C-recoil-then-direct-return-impulse',
    'counter-clockwise-free-drop-to-B',
  ]);
  near(canonicalTimes.palletBLanding,
    geometry.landingHalfPhase * geometry.halfBeatDuration, 0,
  'B landing time');
  near(canonicalTimes.palletCLanding,
    geometry.halfBeatDuration
      + geometry.landingHalfPhase * geometry.halfBeatDuration,
  0, 'C landing time');
  near(canonicalTimes.oneArmOscillation,
    geometry.armPeriod, 0, 'full oscillation time');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
