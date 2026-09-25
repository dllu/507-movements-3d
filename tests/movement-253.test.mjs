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

function smootherStep01(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return u ** 3 * (u * (u * 6 - 15) + 10);
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

test('movement 253 is the three-hook centrifugal mine-drum safety catch', () => {
  const movement = catalog.movements[252];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    safetyFunction,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 253);
  assert.equal(movement.number, '253');
  assert.equal(
    movement.title,
    'Centrifugal Mine-Drum Safety Check-Hooks',
  );
  assert.equal(movement.category, 'Governors & flywheels');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'threefold-centrifugal-check-hooks-latching-fixed-studs-with-spring-isolated-rope-drum',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /three-flange-b-hooks-into-fixed-studs-d/);
  assert.equal(transmission.hookCount, 3);
  assert.equal(transmission.studCount, 3);
  assert.equal(safetyFunction.idealSymmetricContactCount, 3);
  assert.equal(safetyFunction.externalResetRequired, true);
  assert.equal(safetyFunction.shockProtectionRequiredBySource, true);
  assert.equal(blocks.hooks.length, 3);
  assert.equal(blocks.hookPivots.length, 3);
  assert.equal(blocks.studs.length, 3);
  blocks.hookPivots.forEach((pivot) => {
    assert.equal(pivot.parent, blocks.arrestFlange);
  });
  blocks.studs.forEach((stud) => {
    assert.equal(stud.parent, blocks.fixedFrame);
  });
  assert.notEqual(blocks.ropeDrum.parent, blocks.arrestFlange);
  disposeModel(model.root);
});

test('movement 253 preserves the measured unavailable source elevation', () => {
  const movement = catalog.movements[252];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.plate253;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 5);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterFixedFrameA, {
    centerX: 263,
    centerY: 260,
    radius: 232,
  });
  assert.deepEqual(plate.rasterDrumFlangeB, {
    centerX: 266,
    centerY: 281,
    radius: 103,
  });
  assert.deepEqual(plate.rasterHookPivots, [
    { centerX: 260, centerY: 178, radius: 15 },
    { centerX: 343, centerY: 284, radius: 16 },
    { centerX: 202, centerY: 308, radius: 15 },
  ]);
  assert.deepEqual(plate.rasterStudsD, [
    { centerX: 171, centerY: 95, radius: 21 },
    { centerX: 455, centerY: 250, radius: 22 },
    { centerX: 165, centerY: 424, radius: 22 },
  ]);
  assert.match(plate.inferredTopology, /three equally spaced check-hooks/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 65,
    edition: 21,
    illustrationPage: 64,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 253 deploys monotonically with centrifugal demand and clears every stud until catch', () => {
  const model = createMovementModel(catalog.movements[252]);
  const { geometry, stateAtTime, timeline, transmission } = model.root.userData;
  let previousAngularSpeed = -Infinity;
  // Hooks fold forward (positive angle) and deploy back toward zero.
  let previousHookAngle = Infinity;
  let minimumPrecatchGap = Infinity;
  let maximumDeploymentLawError = 0;

  for (let sample = 0; sample < 32768; sample += 1) {
    const time = timeline.catchTime * sample / 32768;
    const state = stateAtTime(time);
    assert.ok(state.flangeAngularSpeed >= previousAngularSpeed - 2e-14);
    assert.ok(state.hookAngle <= previousHookAngle + 2e-14);
    previousAngularSpeed = state.flangeAngularSpeed;
    previousHookAngle = state.hookAngle;
    const squaredSpeedProgress = THREE.MathUtils.clamp(
      (state.flangeAngularSpeed ** 2
        - transmission.centrifugalReleaseSpeed ** 2)
        / (transmission.tripAngularSpeed ** 2
          - transmission.centrifugalReleaseSpeed ** 2),
      0,
      1,
    );
    const expectedProgress = smootherStep01(squaredSpeedProgress);
    maximumDeploymentLawError = Math.max(
      maximumDeploymentLawError,
      Math.abs(state.hookDeploymentProgress - expectedProgress),
    );
    if (state.flangeAngularSpeed <= transmission.centrifugalReleaseSpeed) {
      near(
        state.hookAngle,
        geometry.retractedHookAngle,
        0,
        `return springs retain the hooks at ${sample}`,
      );
    }
    minimumPrecatchGap = Math.min(
      minimumPrecatchGap,
      state.minimumHookStudGap,
    );
    assert.ok(
      state.minimumHookStudGap > -2e-14,
      `no hook penetrates a stud before catch at ${sample}`,
    );
  }
  assert.equal(maximumDeploymentLawError, 0);
  assert.ok(minimumPrecatchGap > 0);
  near(previousAngularSpeed, transmission.tripAngularSpeed, 2e-12,
    'dangerous catch speed');
  near(previousHookAngle, 0, 2e-14, 'fully deployed catch angle');
  disposeModel(model.root);
});

test('movement 253 gives all three ideal hooks exact surface contact with fixed studs D', () => {
  const model = createMovementModel(catalog.movements[252]);
  const {
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const state = stateAtTime(timeline.catchTime);

  assert.equal(state.contactActive, true);
  assert.equal(state.hookCenters.length, 3);
  near(state.minimumHookStudGap, 0, 4e-16, 'minimum catch gap');
  state.hookCenters.forEach((hookCenter, index) => {
    const studCenter = geometry.studCenters[index];
    const normal = studCenter.clone().sub(hookCenter.contactCenter).normalize();
    const hookSurface = hookCenter.contactCenter.clone().addScaledVector(
      normal,
      geometry.hookBarRadius,
    );
    const studSurface = studCenter.clone().addScaledVector(
      normal,
      -geometry.studRadius,
    );
    near(
      state.pairedContactClearances[index],
      0,
      1e-15, // round-off of the phased stud pattern
      `paired hook-to-stud clearance ${index + 1}`,
    );
    vectorNear(
      hookSurface,
      studSurface,
      7e-16,
      `coincident contact surfaces ${index + 1}`,
    );
    near(
      hookCenter.pivotCenter.length(),
      geometry.hookPivotRadius,
      5e-16,
      `flange-fixed hook pivot ${index + 1}`,
    );
    const next = state.hookCenters[(index + 1) % 3].pivotCenter;
    const includedAngle = Math.acos(
      THREE.MathUtils.clamp(
        hookCenter.pivotCenter.dot(next)
          / geometry.hookPivotRadius ** 2,
        -1,
        1,
      ),
    );
    // The phased pattern adds acos round-off at the 1e-15 level.
    near(includedAngle, geometry.sectorPitch, 2e-15,
      `threefold pivot pitch ${index + 1}`);
  });
  disposeModel(model.root);
});

test('movement 253 arrests the load side through the source-required spring', () => {
  const model = createMovementModel(catalog.movements[252]);
  const {
    safetyFunction,
    shockIsolation,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;
  const immediatelyBefore = stateAtTime(timeline.catchTime - 1e-8);
  const impact = stateAtTime(timeline.catchTime);
  const arrested = stateAtTime(timeline.loadArrestEnd);
  let maximumEnergyError = 0;
  let previousLoadSpeed = Infinity;

  assert.equal(
    safetyFunction.catchImpactIsIntentionalVelocityDiscontinuity,
    true,
  );
  near(immediatelyBefore.flangeAngularSpeed, transmission.tripAngularSpeed,
    2e-14, 'flange speed immediately before catch');
  near(impact.flangeAngularSpeed, 0, 0, 'caught flange stops');
  near(impact.catchImpactVelocityJump, -transmission.tripAngularSpeed, 0,
    'explicit flange impact velocity jump');
  near(impact.loadAngularSpeed, transmission.tripAngularSpeed, 0,
    'load-side speed remains continuous at catch');

  for (let sample = 0; sample <= 32768; sample += 1) {
    const time = THREE.MathUtils.lerp(
      timeline.catchTime,
      timeline.loadArrestEnd,
      sample / 32768,
    );
    const state = stateAtTime(time);
    assert.equal(state.flangeAngle, 0);
    assert.equal(state.flangeAngularSpeed, 0);
    assert.ok(state.loadAngularSpeed <= previousLoadSpeed + 2e-14);
    assert.ok(state.loadAngularSpeed >= -2e-14);
    previousLoadSpeed = state.loadAngularSpeed;
    maximumEnergyError = Math.max(
      maximumEnergyError,
      Math.abs(
        state.loadKineticEnergy
          + state.springPotentialEnergy
          - shockIsolation.initialLoadKineticEnergy,
      ),
    );
  }
  assert.ok(maximumEnergyError < 1.4e-15);
  near(arrested.loadAngularSpeed, 0, 0, 'spring-arrested load speed');
  near(
    arrested.springDeflection,
    shockIsolation.maximumSpringDeflection,
    0,
    'maximum spring deflection',
  );
  near(
    shockIsolation.springStiffness,
    shockIsolation.loadSideInertia * shockIsolation.naturalFrequency ** 2,
    0,
    'torsional spring identity',
  );
  disposeModel(model.root);
});

test('movement 253 resets only by explicit unload, hook retraction, and rewind', () => {
  const model = createMovementModel(catalog.movements[252]);
  const { geometry, safetyFunction, stateAtTime, timeline } = model.root.userData;
  const caught = stateAtTime(5.5);
  const unloaded = stateAtTime(timeline.springUnloadEnd);
  const retracting = stateAtTime(7.8);
  const retracted = stateAtTime(timeline.hookRetractionEnd);
  const returning = stateAtTime(9.3);
  const ready = stateAtTime(timeline.externalReturnEnd);
  const closure = stateAtTime(timeline.cycleClosure);
  const start = stateAtTime(0);

  assert.equal(safetyFunction.externalResetRequired, true);
  assert.equal(caught.phase, 'caught-load-held-on-spring');
  assert.equal(unloaded.phase, 'external-spring-unload');
  assert.equal(retracting.phase, 'external-hook-retraction');
  assert.equal(retracted.phase, 'external-rewind-and-reset');
  assert.equal(returning.phase, 'external-rewind-and-reset');
  assert.equal(ready.phase, 'external-rewind-and-reset');
  assert.ok(caught.springDeflection > 0);
  near(unloaded.springDeflection, 0, 0, 'spring unloaded before release');
  near(unloaded.hookAngle, 0, 0, 'hooks remain latched while unloading');
  assert.ok(retracting.hookAngle > 0);
  near(retracted.hookAngle, geometry.retractedHookAngle, 0,
    'hooks fully retracted before rewind');
  assert.ok(returning.flangeAngularSpeed < 0);
  near(ready.flangeAngularSpeed, 0, 2e-29, 'reset stops at ready pose');
  near(closure.flangeAngle, start.flangeAngle, 0, 'exact flange closure');
  near(closure.ropeDrumAngle, start.ropeDrumAngle, 0,
    'exact load-drum closure');
  near(closure.hookAngle, start.hookAngle, 0, 'exact hook closure');
  assert.equal(closure.contactActive, false);
  disposeModel(model.root);
});

test('movement 253 renderer binds both rotors, all hooks, spring, and contacts', () => {
  const model = createMovementModel(catalog.movements[252]);
  const { blocks, geometry, stateAtTime, timeline } = model.root.userData;
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));

  assert.equal(blocks.hoistingRope.geometry.type, 'LaidRopeGeometry');
  // Brown draws no springs or speed indices; the source presentation removes
  // them from the display while the kinematic spring law stays in the model.
  const removed = model.root.userData.sourcePresentation.removedRoles;
  for (const role of [
    'white-flange-b-speed-index',
    'white-load-side-drum-speed-index',
    'visible-torsional-shock-spring-between-flange-and-load-side-drum',
  ]) {
    assert.ok(!roles.includes(role), role);
    assert.ok(removed.includes(role), role);
  }
  assert.equal(roles.filter((role) => /torsion-return-spring/.test(role)).length, 0);
  assert.equal(removed.filter((role) => /torsion-return-spring/.test(role)).length, 3);

  for (const time of [0, 2.8, 4.4, timeline.catchTime, 4.82, 5.5, 6.6, 7.4, 9.3, 11.2]) {
    // update() takes display time, which opens at Brown's pose.
    model.update(time - model.root.userData.displayTimeOffset);
    const state = stateAtTime(time);
    near(blocks.arrestFlange.rotation.z, state.flangeAngle, 0,
      `rendered flange angle at ${time}`);
    near(blocks.ropeDrum.rotation.z, state.ropeDrumAngle, 0,
      `rendered load-drum angle at ${time}`);
    blocks.hooks.forEach((hook, index) => {
      near(hook.rotation.z, state.hookAngle, 0,
        `rendered hook ${index + 1} angle at ${time}`);
    });
    blocks.contactMarkers.forEach((marker) => {
      // The plate draws no contact markers; contacts remain in userData.
      assert.equal(marker.visible, false);
    });
    const springPoints = blocks.shockSpring.userData.currentPoints;
    vectorNear(springPoints[0], state.springPoints[0], 0,
      `spring inner attachment at ${time}`);
    vectorNear(
      springPoints.at(-1),
      state.springPoints.at(-1),
      0,
      `spring outer attachment at ${time}`,
    );
    near(Math.hypot(springPoints[0].x, springPoints[0].y), 0.7, 1e-15,
      `spring inner radius at ${time}`);
    near(Math.hypot(springPoints.at(-1).x, springPoints.at(-1).y), 1.7,
      2e-15, `spring outer radius at ${time}`);
  }
  near(
    geometry.flangePlaneZ - geometry.flangeDepth / 2
      - (geometry.fixedBackingZ + geometry.fixedBackingDepth / 2),
    0.1,
    1e-15,
    'physical fixed-to-moving axial separation',
  );
  disposeModel(model.root);
});

test('movement 253 is collision-free, closes in twelve seconds, and leaves 269 authored', () => {
  const model = createMovementModel(catalog.movements[252]);
  const {
    animationTiming,
    solidClearanceAtTime,
    stateAtTime,
    timeline,
  } = model.root.userData;
  let minimumGap = Infinity;

  for (let sample = 0; sample <= 16384; sample += 1) {
    const time = timeline.demonstrationPeriod * sample / 16384;
    const clearance = solidClearanceAtTime(time);
    minimumGap = Math.min(minimumGap, clearance.hookToStudMinimumGap);
    assert.ok(clearance.flangeToFixedBackingAxialClearance > 0.09);
    assert.ok(clearance.studToFrameRimRadialClearance > 0.15);
    assert.ok(clearance.hookToStudMinimumGap > -8e-15);
  }
  assert.ok(minimumGap < 5e-15);
  near(animationTiming.authoredCyclePeriod, 12, 0,
    'authored safety demonstration period');
  near(animationTiming.targetCycleDuration, 2, 0,
    'normalized display period');
  assertReadableTiming(animationTiming);
  const start = stateAtTime(0);
  const closure = stateAtTime(12);
  near(closure.flangeAngle, start.flangeAngle, 0, 'flange closure');
  near(closure.ropeDrumAngle, start.ropeDrumAngle, 0,
    'rope drum closure');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
