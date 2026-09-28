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
    'bottom-probe-slides-upward-against-a-spring-loaded-bell-crank-which-withdraws-the-sloped-catch-from-beneath-the-bored-sounding-weight',
  );
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.oneShotRelease, true);
  assert.equal(transmission.automaticReset, false);
  assert.equal(transmission.catchDetainedAfterTrip, false);
  assert.equal(transmission.catchSpringLoadedIntoEngagement, true);
  assert.equal(transmission.catchSelfSetsOnReload, true);
  assert.match(transmission.loopReset, /re-armed-far-above-view.*vessel-moves-to-next-station.*bottom-and-spent-weight-off-sideways/);
  assert.equal(blocks.resetSling, undefined, 'no reload sling');
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
  // The sea bottom is a plain block whose top is the contact plane, long
  // enough that its ends stay far beyond any view at both stations.
  const bed = new THREE.Box3().setFromObject(blocks.seabedSlab);
  const { stationDrift } = model.root.userData.geometry;
  near(bed.max.y, model.root.userData.geometry.seabedY, 1e-6, 'bed top is the contact plane');
  assert.ok(stationDrift >= 40 && bed.min.x < -60 && bed.max.x > 60);
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
  assert.match(plate.inferredTopology, /curved leaf spring loads the catch outward/);
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
  assert.equal(source.catchSprungAgainstWeight, false);
  assert.equal(source.probeToCatchContactActive, true);
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

test('movement 247 spring holds the catch against the spent weight\'s bore, then out once the rod is clear', () => {
  const model = createMovementModel(catalog.movements[246]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  let minimumBoreClearance = Infinity;
  let minimumProbeClearance = Infinity;
  let maximumGroundedWeightError = 0;
  let maximumStep = 0;
  let previousAngle = null;
  let sprungSamples = 0;
  let returnedAt = null;

  for (let sample = 0; sample < 32768; sample += 1) {
    const time = timeline.weightImpact
      + (timeline.rodRecovered - timeline.weightImpact)
        * sample / 32768;
    const state = stateAtTime(time);
    minimumProbeClearance = Math.min(
      minimumProbeClearance,
      state.probePusherClearance,
    );
    if (state.catchSprungAgainstWeight) {
      sprungSamples += 1;
      // Rubbing the bore: the seat stands inside it.
      if (state.catchSupportPosition.y < state.weightUpperOpeningY) {
        minimumBoreClearance = Math.min(
          minimumBoreClearance,
          state.supportRadialClearance,
        );
      }
      assert.ok(state.probePusherClearance >= -1e-12);
    } else {
      // Otherwise the spring holds the roller down on the pusher pad.
      near(state.probePusherClearance, 0, 1e-12, `roller on pad at ${time}`);
      if (time > timeline.probeDecompressed && returnedAt === null) {
        returnedAt = time;
      }
    }
    if (previousAngle !== null) {
      maximumStep = Math.max(maximumStep, Math.abs(state.catchAngle - previousAngle));
    }
    previousAngle = state.catchAngle;
    maximumGroundedWeightError = Math.max(
      maximumGroundedWeightError,
      Math.abs(state.weightLowerOpeningY - geometry.seabedY),
    );
    assert.ok(state.catchAngle <= 0);
    assert.ok(state.catchAngle >= geometry.heldRetractedAngle - 1e-12);
    assert.equal(state.catchToWeightContactActive, false);
    assert.equal(state.weightExternallySupported, false);
  }
  assert.ok(sprungSamples > 1000, 'catch rubs up the bore after the trip');
  assert.ok(minimumBoreClearance > 0);
  assert.ok(minimumProbeClearance >= -1e-12);
  // The catch swings out over the weight's upper rim continuously.
  assert.ok(maximumStep < 0.02, `largest catch step ${maximumStep}`);
  assert.ok(returnedAt !== null && returnedAt < timeline.rodRecovered - 1,
    'catch springs back out once clear of the weight');
  assert.ok(maximumGroundedWeightError < 2e-15);
  assert.equal(stateAtTime(timeline.rodRecovered - 1e-9).catchAngle, 0);

  const recovered = stateAtTime(timeline.rodRecovered + 1e-9);
  assert.ok(recovered.probeFootContactY > recovered.weightUpperOpeningY);
  assert.ok(
    recovered.catchSupportPosition.y > recovered.weightUpperOpeningY,
  );
  assert.equal(recovered.stage, 'fresh-weight-pushed-up-camming-sprung-catch-aside');
  disposeModel(model.root);
});

test('movement 247 re-arms far above view, moves on to the next station, and no weight pops or passes into the bottom in any view', () => {
  const model = createMovementModel(catalog.movements[246]);
  const { geometry, stateAtTime, timeline, transmission, displayFrame247, blocks } =
    model.root.userData;
  assert.equal(transmission.automaticReset, false);

  const rising = stateAtTime((timeline.freshWeightAtRod + timeline.freshWeightRaised) / 2);
  const setting = stateAtTime((timeline.detentReleased + timeline.catchSet) / 2);
  const armed = stateAtTime((timeline.weightSeated + timeline.cycleClosure) / 2);
  assert.equal(rising.stage, 'fresh-weight-pushed-up-camming-sprung-catch-aside');
  // The rising weight has cammed the sprung catch aside on its sloped face.
  assert.equal(rising.catchSprungAgainstWeight, true);
  assert.ok(rising.catchAngle < 0);
  near(rising.bodyPositionY, geometry.rearmBodyY, 0, 'rod hauled up for re-arming');
  // Once the weight's lower opening passes the seat, the spring has swung
  // the catch out under it.
  assert.equal(setting.catchSprungAgainstWeight, false);
  assert.equal(setting.catchAngle, 0);
  assert.equal(setting.catchToWeightContactActive, false);
  let maximumStep = 0;
  let previousCatch = stateAtTime(timeline.freshWeightAtRod).catchAngle;
  let cammed = false;
  for (let sample = 1; sample <= 20000; sample += 1) {
    const state = stateAtTime(timeline.freshWeightAtRod
      + (timeline.catchSet - timeline.freshWeightAtRod) * sample / 20000);
    maximumStep = Math.max(maximumStep, Math.abs(state.catchAngle - previousCatch));
    previousCatch = state.catchAngle;
    cammed ||= state.catchSprungAgainstWeight;
  }
  assert.ok(cammed);
  assert.ok(maximumStep < 0.03, `the cam and snap are continuous (${maximumStep})`);
  assert.equal(armed.catchAngle, 0);
  assert.equal(armed.catchToWeightContactActive, true);

  // The default view (the fit) holds Brown's rod pose and not the bottom:
  // its crop floor stands above the bottom (the camera looks up from the
  // bottom's level, so the bottom is edge-on at the frame edge). "Any
  // view" is taken as the fit zoomed out three times.
  const fit = model.root.userData.cameraFitBounds;
  assert.ok(fit.min.y > geometry.seabedY + 0.3);
  assert.ok(model.cameraDirection.y < 0, 'camera looks up from the bottom level');
  const fitHeight = fit.max.y - geometry.seabedY;
  const center = (fit.max.y + geometry.seabedY) / 2;
  // Three times the fit height at a 16:9 aspect.
  const wide = { minY: center - 1.5 * fitHeight, maxY: center + 1.5 * fitHeight,
    halfWidth: 1.5 * fitHeight * 16 / 9 };
  const view = { halfWidth: fitHeight / 2 * 16 / 9 };
  const bedTop = new THREE.Box3().setFromObject(blocks.seabedSlab).max.y;
  const weights = [blocks.weightAssembly, blocks.spareWeightAssembly];
  const previous = weights.map(() => null);
  let previousBedX = null;
  const period = model.root.userData.animationTiming.authoredCyclePeriod;
  near(period, 2 * timeline.cycleClosure, 0, 'two soundings per loop');
  for (let sample = 0; sample <= 4000; sample += 1) {
    const time = period * sample / 4000;
    model.update(time);
    model.root.updateMatrixWorld(true);
    assert.equal(displayFrame247.position.y, 0);
    const bedBox = new THREE.Box3().setFromObject(blocks.seabedSlab);
    // The bottom only ever moves sideways, as one body, with its ends far
    // beyond any view.
    near(bedBox.max.y, bedTop, 0, 'bottom level fixed');
    assert.ok(bedBox.min.x < -wide.halfWidth - 20 && bedBox.max.x > wide.halfWidth + 20, `bottom ends in view at ${time}`);
    const bedX = blocks.seabed.position.x;
    if (previousBedX !== null) assert.ok(Math.abs(bedX - previousBedX) < 0.5, `bottom continuous at ${time}`);
    const state = model.root.userData.kinematics;
    const t = state.cycleTime;
    const rod = new THREE.Box3().setFromObject(blocks.housingTop)
      .union(new THREE.Box3().setFromObject(blocks.probeFoot));
    let shown = rod.max.y > fit.min.y && rod.min.y < fit.max.y;
    weights.forEach((weight, index) => {
      assert.equal(weight.visible, true);
      const box = new THREE.Box3().setFromObject(weight);
      // No weight ever passes into the bottom.
      assert.ok(box.min.y >= bedTop - 0.02, `weight ${index} in the bottom at ${time}`);
      // Every weight moves continuously (no pops, even out of view).
      if (previous[index]) {
        assert.ok(box.min.distanceTo(previous[index].box.min) < 1, `weight ${index} continuous at ${time}`);
      }
      const lying = box.min.y < bedTop + 0.2;
      // A weight lying on the bottom moves only with the bottom.
      if (previous[index]?.lying && lying) {
        const moved = box.getCenter(new THREE.Vector3()).x - previous[index].x;
        near(moved, bedX - previousBedX, 1e-9, `weight ${index} slides over the bottom at ${time}`);
      }
      previous[index] = { box, lying, x: box.getCenter(new THREE.Vector3()).x };
      if (box.max.y > fit.min.y && box.min.y < fit.max.y
        && box.max.x > -view.halfWidth && box.min.x < view.halfWidth) shown = true;
      if (box.max.y < wide.minY || box.min.y > wide.maxY || box.min.x > wide.halfWidth
        || box.max.x < -wide.halfWidth) return;
      // A weight in view is always seated on the rod, falling, or lying
      // on the bottom: never lifted or carried by nothing.
      const onRod = Math.abs(box.getCenter(new THREE.Vector3()).y - state.weightCenterY) < 1e-9
        && weight === model.root.userData.activeWeightAssembly
        && (t < timeline.supportRelease + 1 || t >= timeline.weightSeated);
      const falling = t >= timeline.supportRelease && t < timeline.weightImpact;
      assert.ok(onRod || lying || falling, `weight ${index} in view unsupported at ${time}`);
    });
    previousBedX = bedX;
    assert.ok(shown, `view empty at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 247 moves on to the next station slowly while the spent weight is in view', () => {
  const model = createMovementModel(catalog.movements[246]);
  const { blocks, cameraFitBounds, geometry, animationTiming } = model.root.userData;
  const halfWidth = (cameraFitBounds.max.y - geometry.seabedY) / 2 * 16 / 9 + geometry.weightOuterRadius;
  const weights = [blocks.weightAssembly, blocks.spareWeightAssembly];
  const previous = [null, null];
  let fastest = 0;
  const step = 0.005;
  for (let time = 0; time <= animationTiming.authoredCyclePeriod; time += step) {
    model.update(time);
    weights.forEach((weight, index) => {
      const { x, y } = weight.position;
      if (previous[index] && Math.abs(x) < halfWidth && y < geometry.groundedWeightCenterY + 1e-9
        && Math.abs(previous[index].y - y) < 1e-12) {
        fastest = Math.max(fastest, Math.abs(x - previous[index].x) / step);
      }
      previous[index] = { x, y };
    });
  }
  assert.ok(fastest > 0 && fastest < 7, `in-view station move ${fastest}`);
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
  for (const time of [0, 2.7, 3.4, 3.8, 4.35, 5.4, 6.9, 7.5, 8.2, 9.0, 9.8, 10.5, 14.0, 18.0, 20.0]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    near(blocks.bodyAssembly.position.y, state.bodyPositionY, 0,
      `rendered rod position at ${time}`);
    near(blocks.probeAssembly.position.y, state.probeOffset, 0,
      `rendered probe offset at ${time}`);
    near(blocks.catchAssembly.rotation.z, state.catchAngle, 0,
      `rendered catch angle at ${time}`);
    const active = model.root.userData.activeWeightAssembly;
    near(active.position.y, state.weightCenterY, 0,
      `rendered weight position at ${time}`);
    near(active.position.x, state.weightCenterX, 0,
      `rendered weight sideways position at ${time}`);
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
    assert.equal(contacts.freshWeightReload.automatic, false);
  }
  model.update((timeline.detentReleased + timeline.weightSeated) / 2);
  assert.equal(model.root.userData.contacts.freshWeightReload.active, true);
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
    6.3,
    6.9,
    7.2,
    7.5,
    8.0,
    8.5,
    9.0,
    9.8,
    10.5,
    11.2,
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
  // Two soundings per display loop: the two weights swap roles.
  near(animationTiming.authoredCyclePeriod, 2 * timeline.cycleClosure, 0,
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

test('movement 247 curled leaf spring bears on the upper arm and loads the catch outward; the sloped barb cams a rising weight', () => {
  const model = createMovementModel(catalog.movements[246]);
  const { blocks, geometry, stateAtTime, timeline } = model.root.userData;
  const spring = blocks.detentSpring;
  assert.equal(spring.userData.role, 'curled-leaf-spring-loading-catch-into-engagement');
  const { pivot, upperContactLocal } = geometry;
  const halfWidth = 0.065;
  const thickness = 0.04;
  const armLength = Math.hypot(upperContactLocal.x, upperContactLocal.y);
  for (const time of [0, 3.6, 4.2, timeline.supportRelease, 4.6, 5.45, 6.01, 8.1]) {
    const angle = stateAtTime(time).catchAngle;
    const { points } = spring.userData.centerline(angle);
    // The anchor is set in the solid rod above the window (top y 1.9).
    assert.ok(points[0].y > 1.9);
    const direction = new THREE.Vector2(upperContactLocal.x, upperContactLocal.y)
      .normalize().rotateAround(new THREE.Vector2(), angle);
    let minimumGap = Infinity;
    for (const point of points) {
      const local = point.clone().sub(pivot);
      const along = THREE.MathUtils.clamp(local.dot(direction), 0, armLength);
      minimumGap = Math.min(minimumGap,
        local.distanceTo(direction.clone().multiplyScalar(along))
          - halfWidth - thickness / 2);
    }
    // The curl bears on the arm's right edge without entering it.
    near(minimumGap, 0.003, 3e-3, `curl on arm at ${time}`);
    // Its push (to the left, -normal) at a point along the arm turns the
    // catch anticlockwise: outward, into engagement.
    const push = new THREE.Vector2(-direction.y, direction.x);
    assert.ok(direction.x * push.y - direction.y * push.x > 0);
  }

  // The barb: a rounded seat with a convex face falling inward to a tip
  // inside the bore, so a weight pushed up the rod meets the face.
  const ring = geometry.catchNoseProfile[0][0];
  const lowest = ring.reduce((a, b) => (b[1] < a[1] ? b : a));
  assert.ok(pivot.x + lowest[0] < geometry.boreRadius - 0.05, 'tip inside the bore');
  assert.ok(pivot.x + geometry.catchSupportLocal.x > geometry.boreRadius + 0.15, 'seat under the weight');
  assert.ok(lowest[1] < geometry.catchSupportLocal.y - 0.3, 'face runs well below the seat');
  // The retracted tip stays above the lower guide block.
  const retracted = new THREE.Vector2(...lowest).rotateAround(new THREE.Vector2(), geometry.heldRetractedAngle);
  assert.ok(pivot.y + retracted.y - 0.03 > -0.89);
  disposeModel(model.root);
});

test('p93: the moving sea bottom carries alternating tone bands so its sideways travel reads', () => {
  const model = createMovementModel(catalog.movements[246]);
  const slab = model.root.userData.blocks.seabedSlab;
  const colors = slab.geometry.attributes.color;
  assert.ok(colors, 'bottom has per-face tones');
  const shades = new Set();
  for (let i = 0; i < colors.count; i += 1) shades.add(colors.getX(i));
  assert.deepEqual([...shades].sort(), [0.8999999761581421, 1]);
  for (const material of slab.material) assert.equal(material.vertexColors, true);
  disposeModel(model.root);
});
