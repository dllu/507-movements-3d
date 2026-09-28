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

test('movement 303 is one clockwise deadbeat wheel and one pendulum-carried two-pallet anchor', () => {
  const movement = catalog.movements[302];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    cameraDistanceScale,
    cameraFitBounds,
    fidelity,
    mechanism,
    presentation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 303);
  assert.equal(movement.number, '303');
  assert.equal(movement.title, 'Graham deadbeat pendulum escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'clockwise-thirty-tooth-graham-deadbeat-pendulum-escapement-with-concentric-d-e-locks');
  assert.equal(archetype, movement.archetype);
  assert.equal(presentation, 'front elevation');
  assert.match(mechanism, /outer concentric dead face of left pallet D/);
  assert.match(mechanism, /inner concentric dead face of right pallet E/);
  assert.match(mechanism, /exactly stationary/);
  assert.match(mechanism, /drops two degrees/);
  assert.equal(transmission.toothCount, 30);
  assert.match(transmission.direction, /clockwise/);
  assert.match(transmission.deadbeat, /exactly zero/);
  assert.match(transmission.recoil, /^none/);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.anchor.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  // Source presentation detaches the contact marker Brown does not draw;
  // the factory still positions it for metadata consumers.
  assert.equal(blocks.contactMarker.parent, null);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.toothedRim.parent, blocks.wheelRotor);
  assert.equal(blocks.wheelHub.parent, blocks.wheelRotor);
  assert.equal(blocks.leftPallet.parent, blocks.anchor);
  assert.equal(blocks.rightPallet.parent, blocks.anchor);
  assert.equal(blocks.pendulumRod.parent, blocks.anchor);
  assert.equal(blocks.pendulumBob.parent, blocks.anchor);
  // Brown marks F only as a dot; the white swing witness is not presented.
  assert.equal(blocks.pendulumIndex.parent, null);
  assert.equal(blocks.anchorArms.length, 2);
  assert.ok(blocks.anchorArms.every((arm) => arm.parent === blocks.anchor));
  assert.equal(blocks.spokeMeshes.length, 4);
  vectorNear(blocks.anchor.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'anchor axis');
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'escape-wheel axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'thirty-forward-leaning-deadbeat-teeth').length, 1);
  // The white face highlights are construction aids Brown does not draw;
  // source presentation removes them and the solid pallets carry the faces.
  assert.equal(roles.filter((role) =>
    /(?:left-D|right-E)-concentric-locking-face$/.test(role)).length, 0);
  assert.equal(roles.filter((role) =>
    /(?:left-D|right-E)-impulse-face$/.test(role)).length, 0);
  assert.equal(roles.filter((role) =>
    /^(?:left|right)-anchor-arm-and-pallet-[DE]$/.test(role)).length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  near(cameraDistanceScale, 1.08, 0, 'source-complete camera scale');
  vectorNear(cameraFitBounds.min,
    new THREE.Vector3(-3.1, -4.05, -0.8), 0, 'camera minimum');
  vectorNear(cameraFitBounds.max,
    new THREE.Vector3(3.1, 4.3, 0.8), 0, 'camera maximum');
  assert.ok(model.cameraDirection.z > 10 * Math.abs(model.cameraDirection.x));
  assert.ok(model.cameraDirection.z > 10 * Math.abs(model.cameraDirection.y));
  disposeModel(model.root);
});

test('movement 303 records Brown’s measured plate, disabled animation, and deadbeat-period reference', () => {
  const movement = catalog.movements[302];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate303;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.match(sourceAnimation.referenceScope, /apex pallet arbor/);
  assert.match(sourceAnimation.referenceScope, /concentric outer-D and inner-E/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_303.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.equal(plate.modeledToothCount, 30);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterAnchorPivot, new THREE.Vector2(263, 29));
  assert.deepEqual(plate.rasterWheelCenter, new THREE.Vector2(254, 257));
  assert.deepEqual(plate.rasterWheelBounds, {
    bottom: 407,
    left: 104,
    right: 405,
    top: 106,
  });
  assert.deepEqual(plate.rasterLeftPalletD, new THREE.Vector2(111, 127));
  assert.deepEqual(plate.rasterLeftImpulseA, new THREE.Vector2(145, 157));
  assert.deepEqual(plate.rasterRightImpulseB, new THREE.Vector2(362, 155));
  assert.deepEqual(plate.rasterRightPalletE, new THREE.Vector2(396, 126));
  assert.deepEqual(plate.rasterPendulumEndpoints, [
    new THREE.Vector2(263, 29),
    new THREE.Vector2(255, 476),
  ]);
  assert.deepEqual(plate.rasterDirectionArrow, {
    end: new THREE.Vector2(327, 101),
    start: new THREE.Vector2(207, 101),
  });
  assert.equal(plate.rasterWheelTipRadius, 151);
  assert.match(plate.inferredTopology, /clockwise thirty-tooth wheel/);
  assert.match(plate.inferredTopology, /pendulum/);
  assert.match(plate.toothCountBasis, /twelve-degree intervals/);
  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 0, 'source wheel center');
  vectorNear(sourcePointToModel(plate.rasterAnchorPivot),
    geometry.anchorPivot, 0, 'source anchor pivot');
  near(geometry.toothTipRadius,
    plate.rasterWheelTipRadius * geometry.sourceScale, 0,
  'source wheel tip radius');
  near(geometry.pendulumRodLength,
    plate.rasterPendulumEndpoints[0]
      .distanceTo(plate.rasterPendulumEndpoints[1]) * geometry.sourceScale,
    0.11, 'source pendulum length');
  assert.deepEqual(sourceReference.primaryScan, {
    descriptionPage: 75,
    edition: 21,
    illustrationPage: 74,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.periodReference.publicationYear, 1911);
  assert.match(sourceReference.periodReference.title,
    /Encyclopaedia Britannica/);
  assert.match(sourceReference.periodReference.section, /Dead escapements/);
  assert.match(sourceReference.periodReference.description,
    /circular arcs about pallet axis C/);
  assert.match(sourceReference.periodReference.description,
    /two degrees of wheel drop/);
  assert.match(sourceReference.periodReference.url, /wikisource\.org/);
  disposeModel(model.root);
});

test('movement 303 resolves the clockwise thirty-tooth and quarter-turn plate geometry', () => {
  const model = createMovementModel(catalog.movements[302]);
  const { geometry, transmission } = model.root.userData;

  assert.equal(geometry.direction, -1);
  assert.equal(geometry.toothCount, 30);
  near(geometry.toothPitch, THREE.MathUtils.degToRad(12), 1e-15,
    'twelve-degree tooth pitch');
  near(geometry.halfToothPitch, THREE.MathUtils.degToRad(6), 1e-15,
    'six-degree beat advance');
  assert.equal(geometry.wholePalletSpanTeeth, 7);
  assert.equal(geometry.palletSpanTeeth, 7.5);
  near(geometry.palletSpanAngle, Math.PI / 2, 1e-15,
    'seven-and-a-half-pitch pallet span');
  near(geometry.leftLockReferenceAngle - geometry.rightLockReferenceAngle,
    geometry.palletSpanAngle, 1e-15, 'left/right contact span');
  near(geometry.impulseAdvance, THREE.MathUtils.degToRad(4), 1e-15,
    'four-degree impulse');
  near(geometry.freeDropAdvance, THREE.MathUtils.degToRad(2), 1e-15,
    'two-degree free drop');
  near(geometry.impulseAdvance + geometry.freeDropAdvance,
    geometry.halfToothPitch, 1e-15, 'one half-pitch per beat');
  near(transmission.palletSpanInToothPitches, 7.5, 0,
    'reported pallet span');
  near(transmission.impulseAdvancePerBeatDegrees, 4, 1e-14,
    'reported impulse');
  near(transmission.dropPerBeatDegrees, 2, 1e-14,
    'reported drop');
  near(transmission.oscillationAdvance, geometry.toothPitch, 0,
    'one tooth per oscillation');
  assert.equal(geometry.pendulumPeriod, 4);
  assert.equal(geometry.halfBeatDuration, 2);
  assert.equal(geometry.eventPeriod, 4);
  near(geometry.anchorAmplitude, THREE.MathUtils.degToRad(5), 0,
    'five-degree pendulum amplitude');
  disposeModel(model.root);
});

test('movement 303 constructs exact concentric D/E locks and distinct A/B impulse faces', () => {
  const model = createMovementModel(catalog.movements[302]);
  const {
    impulseFacePoints,
    lockFacePoints,
    palletProfiles,
  } = model.root.userData;

  assert.equal(palletProfiles.left.impulseSourceLabel, 'A');
  assert.equal(palletProfiles.right.impulseSourceLabel, 'B');
  assert.equal(palletProfiles.left.lockSurface, 'outer face of pallet D');
  assert.equal(palletProfiles.right.lockSurface, 'inner face of pallet E');
  assert.equal(palletProfiles.left.side, 1);
  assert.equal(palletProfiles.right.side, -1);
  assert.equal(palletProfiles.left.lockPoints.length, 45);
  assert.equal(palletProfiles.right.lockPoints.length, 45);
  assert.equal(palletProfiles.left.impulsePoints.length, 31);
  assert.equal(palletProfiles.right.impulsePoints.length, 31);
  assert.ok(palletProfiles.left.lockConcentricRadiusRange < 1e-15);
  assert.ok(palletProfiles.right.lockConcentricRadiusRange < 1e-15);

  for (const side of [-1, 1]) {
    const lockPoints = lockFacePoints(side, 101);
    const impulsePoints = impulseFacePoints(side, 101);
    const lockRadii = lockPoints.map((point) => point.length());
    const impulseRadii = impulsePoints.map((point) => point.length());
    near(Math.max(...lockRadii) - Math.min(...lockRadii), 0, 1e-15,
      `${side} concentric lock radius`);
    assert.ok(Math.max(...impulseRadii) - Math.min(...impulseRadii) > 0.16);
    vectorNear(lockPoints[0], impulsePoints[0], 2e-15,
      `${side} common lock/impulse corner`);
    assert.ok(impulsePoints.at(-1).distanceTo(impulsePoints[0]) > 0.15);
    for (const point of [...lockPoints, ...impulsePoints]) {
      assert.equal(Math.sign(point.x), side > 0 ? -1 : 1);
      assert.ok(point.y < 0);
    }
  }
  disposeModel(model.root);
});

test('movement 303 maintains exact alternating contact through both lock and impulse intervals', () => {
  const model = createMovementModel(catalog.movements[302]);
  const {
    canonicalTimes,
    impulseLocalContactPoint,
    lockContactPointForSide,
    lockLocalContactPoint,
    stateAtCyclePhase,
    stateAtTime,
  } = model.root.userData;
  const lockCounts = new Map([[-1, 0], [1, 0]]);
  const impulseCounts = new Map([[-1, 0], [1, 0]]);
  const contactSpells = [];
  let previousContact = false;

  for (let sample = 0; sample <= 12000; sample += 1) {
    const state = stateAtCyclePhase(sample / 12000);
    if (state.contactActive && !previousContact) {
      contactSpells.push(state.activeSide);
    }
    previousContact = state.contactActive;
    if (!state.contactActive) continue;

    near(state.contact.pointError, 0, 4e-15,
      `contact-point closure at ${sample}`);
    near(state.contact.normalVelocityError, 0, 2e-15,
      `contact normal velocity at ${sample}`);
    assert.ok(Number.isFinite(state.contact.relativeSlipSpeed));
    if (state.contactMode === 'concentric-lock') {
      lockCounts.set(state.activeSide, lockCounts.get(state.activeSide) + 1);
      assert.equal(state.wheelAngularSpeed, 0);
      assert.equal(state.wheelAngularAcceleration, 0);
      near(state.contact.concentricRadiusError, 0, 1e-15,
        `concentric radius at ${sample}`);
      vectorNear(state.activeToothPoint,
        lockContactPointForSide(state.activeSide), 4e-15,
      `stationary lock point at ${sample}`);
      vectorNear(state.contact.localPoint, lockLocalContactPoint(
        state.activeSide,
        state.anchorAngle,
      ), 0, `lock material point at ${sample}`);
    } else {
      impulseCounts.set(state.activeSide,
        impulseCounts.get(state.activeSide) + 1);
      assert.equal(state.contactMode, 'impulse');
      assert.ok(state.impulseProgress >= 0);
      assert.ok(state.impulseProgress <= 1);
      assert.ok(state.wheelAngularSpeed <= 1e-14);
      assert.ok(state.activeSide * state.anchorAngularSpeed <= 1e-14);
      vectorNear(state.contact.localPoint, impulseLocalContactPoint(
        state.activeSide,
        state.anchorAngle,
      ), 0, `impulse material point at ${sample}`);
    }
  }
  assert.deepEqual(contactSpells, [-1, 1, -1]);
  assert.ok(lockCounts.get(1) > 4000);
  assert.ok(lockCounts.get(-1) > 4000);
  assert.ok(impulseCounts.get(1) > 400);
  assert.ok(impulseCounts.get(-1) > 400);

  for (const [label, landingName, maximumName, startName, releaseName] of [
    ['left', 'leftLanding', 'leftMaximumLock',
      'leftImpulseStart', 'leftRelease'],
    ['right', 'rightLanding', 'rightMaximumLock',
      'rightImpulseStart', 'rightRelease'],
  ]) {
    const landingTime = canonicalTimes[landingName];
    const unwrapAfterLanding = (time) => (
      time < landingTime ? time + 4 : time
    );
    const landing = stateAtTime(landingTime);
    const maximum = stateAtTime(unwrapAfterLanding(
      canonicalTimes[maximumName],
    ));
    const start = stateAtTime(unwrapAfterLanding(canonicalTimes[startName]));
    const release = stateAtTime(unwrapAfterLanding(
      canonicalTimes[releaseName],
    ));
    assert.equal(landing.contactMode, 'concentric-lock');
    assert.equal(maximum.contactMode, 'concentric-lock');
    assert.equal(start.contactMode, 'impulse');
    assert.equal(release.contactMode, 'impulse');
    near(maximum.wheelAngle, landing.wheelAngle, 0,
      `${label} stationary outbound lock`);
    near(start.wheelAngle, landing.wheelAngle, 0,
      `${label} stationary return lock`);
  }
  disposeModel(model.root);
});

test('movement 303 advances clockwise without recoil through two finite drops and one tooth per cycle', () => {
  const model = createMovementModel(catalog.movements[302]);
  const { canonicalTimes, geometry, stateAtCyclePhase, stateAtTime } =
    model.root.userData;

  near(geometry.impulseReleaseWheelSpeed, 0, 0,
    'zero-speed impulse release');
  near(geometry.impulseReleaseWheelAcceleration, 0, 0,
    'zero-acceleration impulse release');
  assert.ok(geometry.freeDropAngularAcceleration < 0);
  assert.ok(geometry.freeDropLandingWheelSpeed < 0);
  assert.ok(geometry.landingImpactVelocityChange > 0);
  let dropEntries = 0;
  let previousDrop = false;
  let previousAngle = stateAtTime(0).wheelAngle;
  for (let sample = 0; sample <= 12000; sample += 1) {
    const state = stateAtCyclePhase(sample / 12000);
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
      `constant drop acceleration at ${sample}`);
    }
    previousDrop = dropping;
    previousAngle = state.wheelAngle;
  }
  assert.equal(dropEntries, 2);

  for (const [releaseName, landingName] of [
    ['rightRelease', 'leftLanding'],
    ['leftRelease', 'rightLanding'],
  ]) {
    const release = stateAtTime(canonicalTimes[releaseName]);
    const landingTime = canonicalTimes[landingName];
    const beforeLanding = stateAtTime(landingTime - 1e-9);
    const landing = stateAtTime(landingTime);
    near(release.wheelAngularSpeed, 0, 2e-12,
      `${releaseName} zero-speed release`);
    near(beforeLanding.wheelAngle, landing.wheelAngle, 1e-9,
      `${landingName} positional continuity`);
    near(beforeLanding.wheelAngularSpeed,
      geometry.freeDropLandingWheelSpeed, 4e-8,
    `${landingName} pre-impact speed`);
    assert.equal(landing.wheelAngularSpeed, 0);
  }

  const start = stateAtTime(0.43);
  const nextBeat = stateAtTime(0.43 + geometry.halfBeatDuration);
  const nextCycle = stateAtTime(0.43 + geometry.pendulumPeriod);
  near(nextBeat.wheelAngle - start.wheelAngle,
    -geometry.halfToothPitch, 9e-16, 'clockwise half-pitch per beat');
  near(nextCycle.wheelAngle - start.wheelAngle,
    -geometry.toothPitch, 9e-16, 'clockwise one tooth per oscillation');
  near(nextCycle.anchorAngle, start.anchorAngle, 5e-16,
    'pendulum closure');
  near(nextCycle.anchorAngularSpeed, start.anchorAngularSpeed, 5e-16,
    'pendulum-speed closure');
  assert.equal(nextCycle.stage, start.stage);
  disposeModel(model.root);
});

test('movement 303 analytic rates and renderer bindings agree through every motion stage', () => {
  const model = createMovementModel(catalog.movements[302]);
  const { blocks, stateAtTime } = model.root.userData;
  const epsilon = 2e-5;
  const sampleTimes = [0.2, 0.85, 1.08, 1.8, 2.85, 3.08, 3.7];

  for (const time of sampleTimes) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near((after.anchorAngle - before.anchorAngle) / (2 * epsilon),
      state.anchorAngularSpeed, 5e-10,
    `anchor speed at ${time}`);
    near((after.anchorAngularSpeed - before.anchorAngularSpeed)
        / (2 * epsilon),
    state.anchorAngularAcceleration, 5e-10,
    `anchor acceleration at ${time}`);
    near((after.wheelAngle - before.wheelAngle) / (2 * epsilon),
      state.wheelAngularSpeed, 5e-8,
    `wheel speed at ${time}`);
    near((after.wheelAngularSpeed - before.wheelAngularSpeed)
        / (2 * epsilon),
    state.wheelAngularAcceleration, 1e-6,
    `wheel acceleration at ${time}`);

    model.update(time);
    near(blocks.anchor.rotation.z, state.anchorAngle, 0,
      `rendered anchor at ${time}`);
    near(blocks.wheelRotor.rotation.z, state.wheelAngle, 0,
      `rendered wheel at ${time}`);
    near(blocks.wheelRotor.userData.angularSpeed,
      state.wheelAngularSpeed, 0, `rendered wheel speed at ${time}`);
    assert.equal(blocks.contactMarker.visible, false);
    assert.equal(blocks.contactMarker.userData.active, state.contactActive);
    assert.equal(model.root.userData.contacts.mode, state.contactMode);
    if (state.contactActive) {
      vectorNear(new THREE.Vector2(
        blocks.contactMarker.position.x,
        blocks.contactMarker.position.y,
      ), state.activeToothPoint, 0, `rendered contact at ${time}`);
      near(model.root.userData.contacts.pointError, 0, 4e-15,
        `rendered point closure at ${time}`);
      near(model.root.userData.contacts.normalVelocityError, 0, 2e-15,
        `rendered normal closure at ${time}`);
    } else {
      assert.equal(model.root.userData.contacts.activePallet, null);
      assert.ok(model.root.userData.contacts.dropProgress >= 0);
      assert.ok(model.root.userData.contacts.dropProgress <= 1);
    }
  }
  disposeModel(model.root);
});

test('movement 303 closes in four authored seconds and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[302]);
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
  assert.equal(canonicalTimes.rightMaximumLock, 0);
  const start = stateAtTime(0);
  const end = stateAtTime(4);
  assert.equal(start.sourcePose, true);
  assert.equal(end.sourcePose, true);
  assert.equal(start.stage, 'right-E-maximum-deadbeat-lock');
  assert.equal(end.stage, start.stage);
  assert.equal(start.contactMode, 'concentric-lock');
  near(end.anchorAngle, start.anchorAngle, 5e-16,
    'four-second pendulum closure');
  near(end.wheelAngle - start.wheelAngle,
    -geometry.toothPitch, 9e-16, 'four-second clockwise wheel advance');
  near(end.teethAdvanced, 1, 2e-15, 'one tooth advanced');
  assert.equal(end.activeToothIndex,
    (start.activeToothIndex + 1) % geometry.toothCount);

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});

test('movement 303 p89: the pallet arbor ends 0.01 inside the pendulum rod', () => {
  const model = createMovementModel(catalog.movements[302]);
  model.update(0, 0); model.root.updateMatrixWorld(true);
  const byRole = role => { let found = null; model.root.traverse(o => { if (!found && o.isMesh && (o.userData.role ?? o.parent?.userData.role) === role) found = o; }); assert.ok(found, role); return found; };
  const box = mesh => new THREE.Box3().setFromObject(mesh);
  const arbor = box(byRole('Graham-pallet-arbor-to-pendulum')), rod = box(byRole('pendulum-rod-C'));
  near(arbor.min.z - rod.min.z, 0.01, 1e-5, 'arbor rear end');
});

test('movement 303 p93: the pendulum strap hangs on the pallet arbor through a round eye', () => {
  const model = createMovementModel(catalog.movements[302]);
  model.update(0, 0); model.root.updateMatrixWorld(true);
  const roles = [];
  model.root.traverse(o => { if (o.userData.role) roles.push(o.userData.role); });
  assert.ok(!roles.includes('triangular-anchor-apex-cap'), 'no cap corner poking through the hub');
  let rod = null, arbor = null;
  model.root.traverse(o => {
    if (o.userData.role === 'pendulum-rod-C') rod = o;
    if (o.userData.role === 'Graham-pallet-arbor-to-pendulum') arbor = o;
  });
  rod.geometry.computeBoundingBox();
  const eye = rod.geometry.boundingBox;
  // The strap's top is an arc about the arbor axis (anchor-local origin),
  // wider than the arbor, so the arbor passes through the eye.
  near(eye.max.y, 0.24, 1e-6, 'eye top');
  assert.ok(eye.max.x >= 0.24 - 1e-3 && eye.min.x <= -0.24 + 1e-3, 'eye wider than the strap');
  assert.ok(arbor.geometry.parameters.radiusTop < 0.24, 'arbor inside the eye');
  disposeModel(model.root);
});
