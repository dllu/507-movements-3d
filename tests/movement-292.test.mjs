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

test('movement 292 is one alternate-front-rear stud wheel and two-plane pallet assembly', () => {
  const movement = catalog.movements[291];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 292);
  assert.equal(movement.number, '292');
  assert.equal(movement.title, 'Stud escapement, used in large clocks');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'forty-eight-alternating-front-rear-stud-deadbeat-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /48 equally spaced studs alternating/);
  assert.match(mechanism, /front pallet B and a rear pallet/);
  assert.match(mechanism, /exact arcs about F/);
  assert.match(mechanism, /inclines alternately/);
  assert.equal(transmission.studCount, 48);
  assert.equal(transmission.frontStudCount, 24);
  assert.equal(transmission.rearStudCount, 24);
  assert.match(transmission.direction, /clockwise/);
  assert.equal(transmission.recoil, 'none');

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.palletAssembly.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.wheelRim.parent, blocks.wheelRotor);
  assert.equal(blocks.frontPallet.parent, blocks.palletAssembly);
  assert.equal(blocks.rearPallet.parent, blocks.palletAssembly);
  assert.equal(blocks.contactMarker.parent, model.root);
  assert.equal(blocks.studMeshes.length, 48);
  assert.equal(blocks.frontStuds.length, 24);
  assert.equal(blocks.rearStuds.length, 24);
  assert.equal(blocks.spokeMeshes.length, 4);
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'escape-wheel axis');
  vectorNear(blocks.palletAssembly.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'pallet arbor axis');

  for (let index = 0; index < blocks.studMeshes.length; index += 1) {
    const stud = blocks.studMeshes[index];
    assert.equal(stud.userData.index, index);
    assert.equal(stud.userData.axialPlane,
      index % 2 === 0 ? 'front' : 'rear');
    assert.equal(Math.sign(stud.position.z), index % 2 === 0 ? 1 : -1);
  }
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'front-face-escape-wheel-stud').length, 24);
  assert.equal(roles.filter((role) =>
    role === 'rear-face-escape-wheel-stud').length, 24);
  assert.equal(roles.filter((role) =>
    /pallet-concentric-stop-face$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /pallet-inclined-impulse-face$/.test(role)).length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 292 records Brown’s plate, unavailable animation, and corroborating stud description', () => {
  const movement = catalog.movements[291];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate292;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /alternating axial stud planes/);
  assert.match(sourceAnimation.referenceScope, /common pallet arbor F/);
  assert.match(sourceAnimation.referenceScope, /concentric dead-beat stops/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_292.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 9);
  assert.deepEqual(plate.rasterPalletPivotF, new THREE.Vector2(226, 62));
  assert.deepEqual(plate.rasterWheelCenter, new THREE.Vector2(177, 478));
  assert.deepEqual(plate.rasterWorkingRegion,
    new THREE.Vector2(390, 379));
  assert.deepEqual(plate.rasterFrontPalletB,
    new THREE.Vector2(489, 344));
  assert.deepEqual(plate.rasterRearPalletEnd,
    new THREE.Vector2(363, 357));
  assert.deepEqual(plate.rasterDirectionArrow,
    new THREE.Vector2(473, 447));
  assert.equal(plate.rasterWheelOuterRadius, 236);
  assert.equal(plate.rasterVisibleStudCount, 13);
  assert.match(plate.inferredTopology, /alternate front\/rear studs/);
  assert.match(plate.inferredTopology, /common arbor F/);
  vectorNear(sourcePointToModel(plate.rasterPalletPivotF),
    geometry.palletPivot, 0, 'source pallet pivot F');
  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 0, 'source wheel center');
  near(geometry.wheelOuterRadius,
    plate.rasterWheelOuterRadius * geometry.sourceScale, 0,
  'source wheel outer radius');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.corroboratingEdition.entry, 1157);
  assert.match(sourceReference.corroboratingEdition.wording,
    /Alternate studs are set on front and back/);
  assert.match(sourceReference.corroboratingEdition.wording,
    /inclined planes give alternate impulse/);
  disposeModel(model.root);
});

test('movement 292 builds concentric stop arcs joined to nonconcentric impulse inclines', () => {
  const model = createMovementModel(catalog.movements[291]);
  const {
    geometry,
    lockFacePoints,
    impulseFacePoints,
    palletFaceFrame,
    palletProfiles,
  } = model.root.userData;

  assert.equal(palletProfiles.front.axialPlane, 'front');
  assert.equal(palletProfiles.front.sourceName, 'B');
  assert.equal(palletProfiles.rear.axialPlane, 'rear');
  assert.equal(palletProfiles.rear.sourceName, 'unlettered rear pallet');
  assert.equal(palletProfiles.front.lockPoints.length, 49);
  assert.equal(palletProfiles.rear.lockPoints.length, 49);
  assert.equal(palletProfiles.front.impulsePoints.length, 31);
  assert.equal(palletProfiles.rear.impulsePoints.length, 31);
  assert.ok(palletProfiles.front.lockConcentricRadiusRange < 4e-15);
  assert.ok(palletProfiles.rear.lockConcentricRadiusRange < 4e-15);
  assert.ok(palletProfiles.front.impulseConcentricRadiusRange > 0.05);
  assert.ok(palletProfiles.rear.impulseConcentricRadiusRange > 0.05);

  for (const side of [-1, 1]) {
    const lockPoints = lockFacePoints(side, 121);
    const impulsePoints = impulseFacePoints(side, 121);
    const lockRadii = lockPoints.map((point) => point.length());
    near(Math.max(...lockRadii) - Math.min(...lockRadii), 0, 4e-15,
      `${side} concentric stop radius`);
    vectorNear(lockPoints[0], impulsePoints[0], 3e-15,
      `${side} stop/impulse corner`);
    assert.ok(impulsePoints.at(-1).distanceTo(impulsePoints[0]) > 0.07);

    const joinAngle = side * geometry.lockingAmplitudeFraction
      * geometry.palletAmplitude;
    const lockFrame = palletFaceFrame(side, joinAngle, 'lock');
    const impulseFrame = palletFaceFrame(side, joinAngle, 'impulse');
    vectorNear(lockFrame.point, impulseFrame.point, 3e-15,
      `${side} tangent profile join point`);
    assert.ok(Math.abs(lockFrame.tangent.dot(impulseFrame.tangent))
      > 1 - 2e-8);
    near(lockFrame.center.distanceTo(lockFrame.point),
      geometry.studRadius, 2e-15, `${side} pin-radius stop offset`);
  }
  disposeModel(model.root);
});

test('movement 292 alternates matching front and rear studs without changing the projected lock point', () => {
  const model = createMovementModel(catalog.movements[291]);
  const {
    blocks,
    canonicalStates,
    geometry,
    lockStudCenter,
    stateAtTime,
  } = model.root.userData;

  assert.ok(geometry.frontPlaneZ > geometry.wheelDepth / 2);
  assert.ok(geometry.rearPlaneZ < -geometry.wheelDepth / 2);
  assert.ok(blocks.frontPalletBody.position.z > 0);
  assert.ok(blocks.rearPalletBody.position.z < 0);
  assert.equal(canonicalStates.frontLanding.activeStudIndex, 0);
  assert.equal(canonicalStates.frontLanding.activeStudPlane, 'front');
  assert.equal(canonicalStates.rearLanding.activeStudIndex, 1);
  assert.equal(canonicalStates.rearLanding.activeStudPlane, 'rear');
  vectorNear(canonicalStates.frontLanding.activeStudCenter,
    lockStudCenter, 2e-15, 'front landing stud center');
  vectorNear(canonicalStates.rearLanding.activeStudCenter,
    lockStudCenter, 2e-15, 'rear landing stud center');

  for (let halfBeatIndex = -4; halfBeatIndex <= 52;
    halfBeatIndex += 1) {
    const time = (halfBeatIndex + 0.5) * geometry.halfBeatDuration;
    const state = stateAtTime(time);
    const expectedPlane = halfBeatIndex % 2 === 0 ? 'front' : 'rear';
    assert.equal(state.contactMode, 'concentric-stop');
    assert.equal(state.activeStudIndex,
      ((halfBeatIndex % geometry.studCount) + geometry.studCount)
        % geometry.studCount);
    assert.equal(state.activeStudPlane, expectedPlane);
    assert.equal(state.contact.axialPlane, expectedPlane);
    assert.equal(blocks.studMeshes[state.activeStudIndex]
      .userData.axialPlane, expectedPlane);
    vectorNear(state.activeStudCenter, lockStudCenter, 5e-15,
      `common projected lock point at half beat ${halfBeatIndex}`);
  }
  disposeModel(model.root);
});

test('movement 292 has exact stationary dead-beat contact on both stop faces', () => {
  const model = createMovementModel(catalog.movements[291]);
  const {
    lockStudCenter,
    stateAtCyclePhase,
  } = model.root.userData;
  const planeCounts = new Map([['front', 0], ['rear', 0]]);

  for (let sample = 0; sample <= 12000; sample += 1) {
    const state = stateAtCyclePhase(sample / 12000);
    if (state.contactMode !== 'concentric-stop') continue;
    planeCounts.set(state.activeStudPlane,
      planeCounts.get(state.activeStudPlane) + 1);
    assert.equal(state.wheelAngularSpeed, 0);
    assert.equal(state.wheelAngularAcceleration, 0);
    vectorNear(state.activeStudCenter, lockStudCenter, 3e-15,
      `stationary locked stud center at ${sample}`);
    near(state.contact.pointError, 0, 3e-15,
      `locked stud surface closure at ${sample}`);
    near(state.contact.radialClearanceError, 0, 7e-16,
      `locked stud radius at ${sample}`);
    near(state.contact.concentricRadiusError, 0, 2e-15,
      `concentric stop face at ${sample}`);
    near(state.contact.normalVelocityError, 0, 7e-10,
      `dead-beat normal velocity at ${sample}`);
    assert.ok(Number.isFinite(state.contact.relativeSlipSpeed));
  }
  assert.ok(planeCounts.get('front') > 4500);
  assert.ok(planeCounts.get('rear') > 4500);
  disposeModel(model.root);
});

test('movement 292 transfers impulse only through the matching axial inclined pallet', () => {
  const model = createMovementModel(catalog.movements[291]);
  const {
    geometry,
    palletFaceFrame,
    stateAtCyclePhase,
  } = model.root.userData;
  const planeCounts = new Map([['front', 0], ['rear', 0]]);

  for (let sample = 0; sample <= 16000; sample += 1) {
    const state = stateAtCyclePhase(sample / 16000);
    if (state.contactMode !== 'inclined-impulse') continue;
    planeCounts.set(state.activeStudPlane,
      planeCounts.get(state.activeStudPlane) + 1);
    assert.ok(state.impulseProgress >= 0);
    assert.ok(state.impulseProgress <= 1);
    assert.ok(state.wheelAngularSpeed <= 1e-14);
    assert.equal(state.contact.axialPlane, state.activeStudPlane);
    assert.equal(state.activeStudIndex % 2,
      state.activeStudPlane === 'front' ? 0 : 1);
    near(state.contact.pointError, 0, 3e-15,
      `impulse stud surface closure at ${sample}`);
    near(state.contact.radialClearanceError, 0, 7e-16,
      `impulse stud radius at ${sample}`);
    near(state.contact.normalVelocityError, 0, 7e-10,
      `impulse normal velocity at ${sample}`);
    const frame = palletFaceFrame(
      state.activeSide,
      state.palletAngle,
      'impulse',
    );
    vectorNear(state.contact.localPoint, frame.point, 0,
      `inclined face material point at ${sample}`);
    near(state.contact.studSurfacePoint.distanceTo(
      state.activeStudCenter,
    ), geometry.studRadius, 7e-16,
    `stud surface offset at ${sample}`);
  }
  assert.ok(planeCounts.get('front') > 650);
  assert.ok(planeCounts.get('rear') > 650);
  disposeModel(model.root);
});

test('movement 292 advances clockwise one stud per half-beat with analytic rates', () => {
  const model = createMovementModel(catalog.movements[291]);
  const {
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;

  near(transmission.halfBeatAdvance, geometry.studPitch, 0,
    'one stud per half-beat');
  near(transmission.oscillationAdvance, 2 * geometry.studPitch, 0,
    'two studs per oscillation');
  for (const time of [0.31, 0.84, 1.86, 2.12, 2.63, 3.88]) {
    near(stateAtTime(time + geometry.halfBeatDuration).wheelAngle
        - stateAtTime(time).wheelAngle,
    -geometry.studPitch, 8e-16,
    `half-beat advance at ${time}`);
    near(stateAtTime(time + geometry.pendulumPeriod).wheelAngle
        - stateAtTime(time).wheelAngle,
    -2 * geometry.studPitch, 9e-16,
    `oscillation advance at ${time}`);
  }

  let previous = stateAtTime(0).wheelAngle;
  for (let sample = 1; sample <= 24000; sample += 1) {
    const state = stateAtTime(
      geometry.pendulumPeriod * sample / 24000,
    );
    assert.ok(state.wheelAngle <= previous + 2e-15,
      `no clockwise recoil at sample ${sample}`);
    assert.ok(state.wheelAngularSpeed <= 1e-13);
    previous = state.wheelAngle;
  }

  const epsilon = 1e-5;
  for (const time of [0.35, 1, 1.82, 1.93, 2.07, 2.35, 3, 3.82,
    3.93]) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near((after.palletAngle - before.palletAngle) / (2 * epsilon),
      state.palletAngularSpeed, 7e-11,
    `pallet speed at ${time}`);
    near((after.palletAngularSpeed - before.palletAngularSpeed)
        / (2 * epsilon),
    state.palletAngularAcceleration, 2e-9,
    `pallet acceleration at ${time}`);
    near((after.wheelAngle - before.wheelAngle) / (2 * epsilon),
      state.wheelAngularSpeed, 8e-10,
    `wheel speed at ${time}`);
    near((after.wheelAngularSpeed - before.wheelAngularSpeed)
        / (2 * epsilon),
    state.wheelAngularAcceleration, 3e-8,
    `wheel acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 292 renderer binds both axial planes, contacts, cycle, and next draft', () => {
  const model = createMovementModel(catalog.movements[291]);
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

  for (const phase of [0, 0.0553, 0.25, 0.445, 0.475, 0.50,
    0.5553, 0.75, 0.945, 0.975, 1]) {
    const time = phase * geometry.pendulumPeriod;
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.palletAssembly.rotation.z, expected.palletAngle, 0,
      `rendered pallet assembly at ${phase}`);
    near(blocks.wheelRotor.rotation.z, expected.wheelAngle, 0,
      `rendered stud wheel at ${phase}`);
    assert.equal(blocks.contactMarker.visible, false, 'no undrawn contact marker');
    assert.equal(model.root.userData.contacts.mode, expected.contactMode);
    assert.equal(model.root.userData.contacts.activeStudIndex,
      expected.activeStudIndex);
    assert.equal(model.root.userData.contacts.axialPlane,
      expected.activeStudPlane);
    if (expected.contactActive) {
      near(model.root.userData.contacts.pointError, 0, 3e-15,
        `rendered contact closure at ${phase}`);
      near(blocks.contactMarker.position.z,
        (expected.activeStudPlane === 'front'
          ? geometry.frontPlaneZ
          : geometry.rearPlaneZ) + geometry.palletDepth / 2 + 0.10,
      0, `rendered axial marker plane at ${phase}`);
    }
  }

  model.update(0.77);
  const startPalletAngle = blocks.palletAssembly.rotation.z;
  const startWheelAngle = blocks.wheelRotor.rotation.z;
  model.update(0.77 + geometry.pendulumPeriod);
  near(blocks.palletAssembly.rotation.z, startPalletAngle, 8e-16,
    'rendered pallet oscillation closure');
  near(blocks.wheelRotor.rotation.z - startWheelAngle,
    -2 * geometry.studPitch, 9e-16,
  'rendered two-stud advance');

  const movement293 = catalog.movements[292];
  const model293 = createMovementModel(movement293);
  assert.equal(movement293.id, 293);
  assert.equal(movement293.fidelity, 'authored');
  assert.equal(movement293.archetype,
    'fifteen-tooth-single-beat-duplex-watch-escapement');
  assert.equal(model293.root.userData.fidelity, 'authored');
  disposeModel(model293.root);
  disposeModel(model.root);
});
