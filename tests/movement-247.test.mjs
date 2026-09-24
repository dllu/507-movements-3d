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

test('movement 247 is one seabed probe, one detained catch, and one detachable sounding weight', () => {
  const movement = catalog.movements[246];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 247);
  assert.equal(movement.number, '247');
  assert.equal(movement.title, 'Sounding-Weight Release');
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'seabed-triggered-sounding-weight-release-with-sliding-probe-and-latched-bell-crank',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'bottom-probe-slides-upward-against-a-bell-crank-which-withdraws-and-detent-latches-the-catch-from-beneath-the-bored-sounding-weight',
  );
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.oneShotRelease, true);
  assert.equal(transmission.automaticReset, false);
  assert.equal(transmission.catchDetainedAfterTrip, true);
  assert.match(transmission.loopReset, /external-sling/);
  assert.equal(
    blocks.probeAssembly.userData.role,
    'bottom-projecting-seabed-probe-sliding-relative-to-rod',
  );
  assert.equal(
    blocks.catchAssembly.userData.role,
    'single-rigid-bell-crank-and-weight-support-catch',
  );
  assert.equal(
    blocks.weightAssembly.userData.role,
    'detachable-bored-spherical-sounding-weight-with-front-section-cutaway',
  );
  assert.equal(blocks.seabed.userData.fixed, true);
  disposeModel(model.root);
});

test('movement 247 preserves the measured unavailable sectional plate', () => {
  const movement = catalog.movements[246];
  const model = createMovementModel(movement);
  const { sourceReference, stateAtTime } = model.root.userData;
  const plate = sourceReference.plate247;

  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 4);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.equal(plate.view,
    'longitudinal-section-through-rod-and-bored-weight');
  assert.deepEqual(plate.rasterRodBounds, {
    bottom: 451,
    left: 240,
    right: 307,
    top: 20,
  });
  assert.deepEqual(plate.rasterWeightBounds, {
    bottom: 385,
    left: 176,
    right: 383,
    top: 171,
  });
  assert.deepEqual(plate.rasterWindowBounds, {
    bottom: 405,
    left: 252,
    right: 320,
    top: 198,
  });
  assert.deepEqual(plate.rasterProbeFootBounds, {
    bottom: 512,
    left: 235,
    right: 288,
    top: 459,
  });
  assert.deepEqual(plate.rasterLeverPivot.toArray(), [283, 322]);
  assert.deepEqual(plate.rasterProbeContact.toArray(), [258, 229]);
  assert.deepEqual(plate.rasterCatchSupport.toArray(), [322, 375]);
  assert.deepEqual(plate.rasterDetentTip.toArray(), [292, 266]);
  assert.match(plate.inferredTopology, /curved detent/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 63,
    edition: 21,
    illustrationPage: 62,
    publicationYear: 1908,
  });
  const source = stateAtTime(0);
  assert.equal(source.sourcePose, true);
  assert.equal(source.stage, 'loaded-dwell');
  assert.equal(source.catchToWeightContactActive, true);
  assert.equal(source.detentLatched, false);
  disposeModel(model.root);
});

test('movement 247 probe remains on the seabed and exactly drives the bell crank through release', () => {
  const model = createMovementModel(catalog.movements[246]);
  const { geometry, stateAtTime, timeline } = model.root.userData.nominalKinematics247;
  let maximumFootError = 0;
  let maximumPusherError = 0;
  let previousProbeRise = -Infinity;
  let previousCatchAngle = Infinity;

  for (let sample = 0; sample <= 32768; sample += 1) {
    const time = timeline.seabedContact
      + (timeline.probeDecompressed - timeline.seabedContact)
        * sample / 32768;
    const state = stateAtTime(time);
    maximumFootError = Math.max(
      maximumFootError,
      Math.abs(state.probeFootContactY - geometry.seabedY),
    );
    if (time <= timeline.weightImpact) {
      maximumPusherError = Math.max(
        maximumPusherError,
        Math.abs(state.probePusherClearance),
      );
    }
    if (time <= timeline.catchFullyRetracted) {
      assert.ok(state.probeOffset >= previousProbeRise - 2e-15);
      assert.ok(state.catchAngle <= previousCatchAngle + 2e-15);
      previousProbeRise = state.probeOffset;
      previousCatchAngle = state.catchAngle;
    }
  }
  assert.ok(maximumFootError < 1e-12);
  assert.equal(maximumPusherError, 0);
  const contact = stateAtTime(timeline.seabedContact);
  const release = stateAtTime(timeline.supportRelease);
  const retracted = stateAtTime(timeline.catchFullyRetracted);
  near(contact.probeOffset, 0, 2e-15, 'uncompressed probe at contact');
  near(release.catchAngle, geometry.releaseAngle, 2e-15,
    'catch angle at support loss');
  near(release.supportRadialReach, geometry.boreRadius, 2e-15,
    'catch reaches the bore edge at release');
  near(retracted.probeOffset, geometry.maximumProbeRise, 2e-15,
    'maximum upward probe travel');
  assert.ok(retracted.supportRadialClearance > 0.044);
  disposeModel(model.root);
});

test('movement 247 retains its historical point-support and ballistic law separately from finite-seat playback', () => {
  const model = createMovementModel(catalog.movements[246]);
  const { geometry, stateAtTime, timeline } = model.root.userData.nominalKinematics247;
  let maximumSupportGap = 0;
  let minimumPositiveOverlap = Infinity;
  for (let sample = 0; sample < 32768; sample += 1) {
    const time = timeline.supportRelease * sample / 32768;
    const state = stateAtTime(time);
    maximumSupportGap = Math.max(
      maximumSupportGap,
      Math.abs(
        state.weightLowerOpeningY - state.catchSupportPosition.y,
      ),
    );
    minimumPositiveOverlap = Math.min(
      minimumPositiveOverlap,
      state.supportOverlap,
    );
    assert.equal(state.catchToWeightContactActive, true);
  }
  assert.ok(maximumSupportGap < 9e-16);
  assert.ok(minimumPositiveOverlap > 0);

  let previousWeightY = Infinity;
  let maximumBallisticError = 0;
  let minimumSeabedGap = Infinity;
  for (let sample = 0; sample <= 32768; sample += 1) {
    const time = timeline.supportRelease
      + (timeline.weightImpact - timeline.supportRelease)
        * sample / 32768;
    const state = stateAtTime(time);
    const elapsed = time - timeline.supportRelease;
    const expected = geometry.releaseWeightCenterY
      - geometry.modelGravity * elapsed ** 2 / 2;
    maximumBallisticError = Math.max(
      maximumBallisticError,
      Math.abs(state.weightCenterY - expected),
    );
    minimumSeabedGap = Math.min(
      minimumSeabedGap,
      state.weightLowerOpeningY - geometry.seabedY,
    );
    assert.ok(state.weightCenterY <= previousWeightY + 2e-15);
    previousWeightY = state.weightCenterY;
  }
  assert.ok(maximumBallisticError < 1e-12);
  assert.ok(minimumSeabedGap > -2e-15);
  const impact = stateAtTime(timeline.weightImpact + 1e-10);
  near(impact.weightLowerOpeningY, geometry.seabedY, 0,
    'weight rests on seabed after impact');
  near(impact.weightVelocity, 0, 0, 'inelastic impact stops weight');
  assert.equal(impact.weightOnSeabed, true);
  disposeModel(model.root);
});

test('movement 247 detent holds the catch clear while the light rod is recovered', () => {
  const model = createMovementModel(catalog.movements[246]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  let minimumBoreClearance = Infinity;
  let minimumProbeClearance = Infinity;
  let maximumGroundedWeightError = 0;

  for (let sample = 0; sample <= 32768; sample += 1) {
    const time = timeline.weightImpact
      + (timeline.manualReloadBegins - timeline.weightImpact)
        * sample / 32768;
    const state = stateAtTime(time);
    minimumBoreClearance = Math.min(
      minimumBoreClearance,
      state.supportRadialClearance,
    );
    if (time >= timeline.probeDecompressed) {
      minimumProbeClearance = Math.min(
        minimumProbeClearance,
        state.probePusherClearance,
      );
    }
    maximumGroundedWeightError = Math.max(
      maximumGroundedWeightError,
      Math.abs(state.weightLowerOpeningY - geometry.seabedY),
    );
    assert.equal(state.detentLatched, true);
    assert.equal(state.catchToWeightContactActive, false);
    assert.equal(state.weightExternallySupported, false);
  }
  assert.ok(minimumBoreClearance > 0.016);
  // The wider 0.545 bore (roller clearance) needs a deeper held retraction,
  // which brings the pusher about 1 mm closer than the old 0.096.
  assert.ok(minimumProbeClearance > 0.094);
  assert.ok(maximumGroundedWeightError < 2e-15);

  const recovered = stateAtTime(timeline.rodRecovered + 1e-9);
  assert.ok(recovered.probeFootContactY > recovered.weightUpperOpeningY);
  assert.ok(
    recovered.catchSupportPosition.y > recovered.weightUpperOpeningY,
  );
  assert.equal(recovered.stage, 'released-dwell');
  disposeModel(model.root);
});

test('movement 247 labels its loop closure as an external manual reload', () => {
  const model = createMovementModel(catalog.movements[246]);
  const { geometry, stateAtTime, timeline, transmission } =
    model.root.userData;
  assert.equal(transmission.automaticReset, false);
  assert.match(transmission.loopReset, /external-sling/);

  const lift = stateAtTime(
    (timeline.manualReloadBegins + timeline.manualReloadLifted) / 2,
  );
  const reset = stateAtTime(
    (timeline.manualReloadLifted + timeline.manualCatchReset) / 2,
  );
  const seat = stateAtTime(
    (timeline.manualCatchReset + timeline.weightSeated) / 2,
  );
  assert.equal(lift.stage, 'external-manual-weight-lift');
  assert.equal(lift.weightExternallySupported, true);
  assert.equal(lift.manualResetActive, true);
  assert.ok(lift.resetSlingOpacity > 0.99);
  assert.equal(reset.stage, 'external-manual-detent-reset');
  assert.equal(reset.weightExternallySupported, true);
  assert.equal(reset.detentLatched, false);
  assert.ok(reset.catchAngle < 0);
  near(reset.weightCenterY, geometry.preloadedWeightCenterY, 0,
    'external sling holds weight above catch during reset');
  assert.equal(seat.stage, 'external-manual-weight-seating');
  assert.equal(seat.catchAngle, 0);
  assert.ok(seat.weightLowerOpeningY
    > seat.catchSupportPosition.y);
  disposeModel(model.root);
});

test('movement 247 renderer exposes the cutaway, rigid catch, moving weight, and all contacts', () => {
  const model = createMovementModel(catalog.movements[246]);
  const { blocks, geometry, stateAtTime, timeline } = model.root.userData;
  assert.equal(blocks.windowShell.userData.frontWindowIsPhysicalOpening, true);
  assert.equal(
    blocks.weightShell.userData.isMechanicallyCompleteDespiteDisplayCutaway,
    true,
  );
  assert.equal(blocks.weightSectionFaces.length, 2);
  assert.ok(blocks.weightShell.geometry.parameters.phiLength < Math.PI * 2);
  near(
    geometry.boreRadius - geometry.housingRadius,
    geometry.boreRadialClearance,
    0,
    'rod-to-weight bore clearance',
  );
  assert.ok(geometry.boreRadialClearance > 0.089);

  const localSupport = new THREE.Vector3(
    geometry.catchSupportLocal.x,
    geometry.catchSupportLocal.y,
    0,
  );
  for (const time of [0, 2.7, 3.4, 3.8, 4.35, 5.4, 7.4, 8.6, 9.25]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    near(blocks.bodyAssembly.position.y, state.bodyPositionY, 0,
      `rendered rod position at ${time}`);
    near(blocks.probeAssembly.position.y, state.probeOffset, 0,
      `rendered probe offset at ${time}`);
    near(blocks.catchAssembly.rotation.z, state.catchAngle, 0,
      `rendered catch angle at ${time}`);
    near(blocks.weightAssembly.position.y, state.weightCenterY, 0,
      `rendered weight position at ${time}`);
    vectorNear(
      localSupport.clone().applyMatrix4(blocks.catchAssembly.matrixWorld),
      state.catchSupportPosition.clone()
        .applyMatrix4(model.root.userData.displayFrame247.matrixWorld),
      4e-15,
      `rigid catch support point at ${time}`,
    );
    const contacts = model.root.userData.contacts;
    assert.equal(contacts.housingToWeightBore.interference, false);
    near(
      contacts.housingToWeightBore.radialClearance,
      geometry.boreRadialClearance,
      0,
      `bore clearance at ${time}`,
    );
    assert.equal(
      contacts.externalReloadSling.automatic,
      false,
    );
    assert.equal(blocks.resetSling.visible, state.resetSlingOpacity > 0);
  }
  model.update((timeline.manualReloadBegins + timeline.manualReloadLifted) / 2);
  assert.equal(blocks.resetSling.visible, true);
  assert.equal(model.root.userData.contacts.externalReloadSling.active, true);
  disposeModel(model.root);
});

test('movement 247 reported rates close away from edge release and leave movement 339 authored', () => {
  const model = createMovementModel(catalog.movements[246]);
  const {
    animationTiming,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const step = 1e-5;
  for (const time of [
    1.2,
    2.6,
    3.0,
    3.4,
    3.8,
    4.35,
    5.2,
    7.4,
    7.9,
    8.5,
    9.25,
  ]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    for (const [positionKey, velocityKey, accelerationKey, label] of [
      ['bodyPositionY', 'bodyVelocity', 'bodyAcceleration', 'rod'],
      ['probeOffset', 'probeVelocity', 'probeAcceleration', 'probe'],
      [
        'catchAngle',
        'catchAngularSpeed',
        'catchAngularAcceleration',
        'catch',
      ],
      ['weightCenterY', 'weightVelocity', 'weightAcceleration', 'weight'],
    ]) {
      near(
        (after[positionKey] - before[positionKey]) / (2 * step),
        state[velocityKey],
        5e-8,
        `${label} velocity at ${time}`,
      );
      near(
        (after[velocityKey] - before[velocityKey]) / (2 * step),
        state[accelerationKey],
        label === 'weight' ? 1e-5 : 5e-7,
        `${label} acceleration at ${time}`,
      );
    }
  }

  const start = stateAtTime(0);
  const end = stateAtTime(timeline.cycleClosure);
  for (const key of [
    'bodyPositionY',
    'probeOffset',
    'catchAngle',
    'weightCenterY',
  ]) {
    near(end[key], start[key], 0, `closed ${key}`);
  }
  near(animationTiming.authoredCyclePeriod, 11.1, 0,
    'authored cycle duration');
  near(animationTiming.targetCycleDuration, 2, 0,
    'display cycle duration');
  assertReadableTiming(animationTiming);
  assert.ok(geometry.modelGravity > 0);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model289.root);
});
