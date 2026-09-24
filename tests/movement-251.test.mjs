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

test('movement 251 is a symmetric slot-triggered two-hook pile-driver release', () => {
  const movement = catalog.movements[250];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 251);
  assert.equal(movement.number, '251');
  assert.equal(movement.title, 'Automatic Pile-Driver Releasing Hooks');
  assert.equal(movement.category, 'Presses & clamps');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'slot-triggered-twin-pivot-releasing-hooks-with-ballistic-pile-driver-drop',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'rope-lifts-head-and-latched-hammer-until-converging-slot-b-squeezes-both-hook-tips-inward-and-the-unretained-weight-falls-freely',
  );
  assert.equal(transmission.hookCount, 2);
  assert.equal(transmission.guideCount, 2);
  assert.equal(transmission.latchContactCount, 2);
  assert.equal(transmission.externalReloadRequired, true);
  assert.equal(transmission.releasedBody, 'pile-driver-weight-w');
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(blocks.leftHook.parent, blocks.weightAssembly);
  assert.equal(blocks.rightHook.parent, blocks.weightAssembly);
  assert.notEqual(blocks.liftHead.parent, blocks.weightAssembly);
  disposeModel(model.root);
});

test('movement 251 preserves the measured unavailable front elevation', () => {
  const movement = catalog.movements[250];
  const model = createMovementModel(movement);
  const { sourceReference } = model.root.userData;
  const plate = sourceReference.plate251;

  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 5);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.equal(
    plate.view,
    'front-elevation-through-rope-hook-pivots-weight-and-guide-slot',
  );
  assert.deepEqual(plate.rasterFrameBounds, {
    bottom: 524,
    left: 137,
    right: 396,
    top: 9,
  });
  assert.deepEqual(plate.rasterGuideSlot, {
    bottomHalfWidth: 40,
    centerX: 266,
    lowerY: 42,
    topHalfWidth: 28,
    upperY: 10,
  });
  assert.deepEqual(plate.rasterHookBounds, [
    { bottom: 228, left: 183, right: 260, top: 67 },
    { bottom: 228, left: 269, right: 348, top: 67 },
  ]);
  assert.deepEqual(plate.rasterHookPivots, [
    { centerX: 238, centerY: 215, radius: 10 },
    { centerX: 294, centerY: 215, radius: 10 },
  ]);
  assert.deepEqual(plate.rasterLiftingHeadBounds, {
    bottom: 188,
    left: 192,
    right: 336,
    top: 88,
  });
  assert.deepEqual(plate.rasterWeightBounds, {
    bottom: 480,
    left: 151,
    right: 380,
    top: 230,
  });
  assert.match(plate.inferredTopology, /two mirror-image hooks/);
  assert.match(plate.inferredTopology, /upward-converging slot/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 63,
    edition: 21,
    illustrationPage: 62,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 251 keeps both round hook tips exactly on the straight slot faces', () => {
  const model = createMovementModel(catalog.movements[250]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  let maximumClearance = 0;
  let maximumPathResidual = 0;
  let previousAngle = -Infinity;

  assert.ok(
    Math.abs(geometry.guidePathEnd.x)
      < Math.abs(geometry.guidePathStart.x),
    'slot B narrows upward',
  );
  assert.ok(geometry.guidePathEnd.y > geometry.guidePathStart.y);
  for (let sample = 0; sample <= 32768; sample += 1) {
    const time = THREE.MathUtils.lerp(
      timeline.guideEngagementTime,
      timeline.releaseTime,
      sample / 32768,
    );
    const state = stateAtTime(time);
    assert.equal(state.guideContactActive, true);
    assert.ok(state.hookOpeningAngle >= previousAngle - 1e-14);
    previousAngle = state.hookOpeningAngle;
    maximumClearance = Math.max(
      maximumClearance,
      Math.abs(state.guideContactClearances.left),
      Math.abs(state.guideContactClearances.right),
    );
    maximumPathResidual = Math.max(
      maximumPathResidual,
      Math.abs(state.guidePathResiduals.left),
      Math.abs(state.guidePathResiduals.right),
    );
    near(state.leftHookTip.x, -state.rightHookTip.x, 1e-15,
      `mirror tip x at ${sample}`);
    near(state.leftHookTip.y, state.rightHookTip.y, 1e-15,
      `mirror tip y at ${sample}`);
    near(
      state.leftHookTip.distanceTo(state.guideContactPoints.left),
      geometry.hookTubeRadius,
      5e-16,
      `left round-tip radius at ${sample}`,
    );
    near(
      state.rightHookTip.distanceTo(state.guideContactPoints.right),
      geometry.hookTubeRadius,
      5e-16,
      `right round-tip radius at ${sample}`,
    );
    near(
      state.guideContactPoints.left.x
        - geometry.guidePathSlope * state.guideContactPoints.left.y
        - geometry.guideSurfaceIntercept,
      0,
      2e-15,
      `left point lies on guide face at ${sample}`,
    );
    near(
      -state.guideContactPoints.right.x
        - geometry.guidePathSlope * state.guideContactPoints.right.y
        - geometry.guideSurfaceIntercept,
      0,
      2e-15,
      `right point lies on guide face at ${sample}`,
    );
  }
  assert.ok(maximumClearance < 1.3e-15);
  assert.ok(maximumPathResidual < 1.8e-15);
  near(previousAngle, geometry.releaseHookAngle, 0,
    'guide reaches the exact release angle');
  disposeModel(model.root);
});

test('movement 251 carries finite rounded toes on head shelves until their inner edges', () => {
  const model = createMovementModel(catalog.movements[250]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  let maximumLatchGap = 0;
  let maximumRadialError = 0;

  for (let sample = 0; sample < 32768; sample += 1) {
    const time = timeline.releaseTime * sample / 32768;
    const state = stateAtTime(time);
    assert.equal(state.weightSupported, true);
    assert.equal(state.headLatched, true);
    maximumLatchGap = Math.max(
      maximumLatchGap,
      state.leftLatchContact.gap,
      state.rightLatchContact.gap,
    );
    maximumRadialError = Math.max(
      maximumRadialError,
      Math.abs(state.leftLatchContact.radialError),
      Math.abs(state.rightLatchContact.radialError),
    );
    assert.ok(state.leftLatchContact.remainingRetainingAngle > 0);
    near(
      state.leftLatchContact.arcCoordinate,
      state.rightLatchContact.arcCoordinate,
      0,
      `matching latch coordinates at ${sample}`,
    );
  }
  assert.ok(maximumLatchGap < 2e-15);
  assert.ok(maximumRadialError < 5e-16);

  const release = stateAtTime(timeline.releaseTime);
  assert.equal(release.released, true);
  assert.equal(release.weightSupported, false);
  near(release.hookOpeningAngle, geometry.releaseHookAngle, 0,
    'hook arc endpoint at release');
  near(release.leftLatchContact.remainingRetainingAngle, 0, 0,
    'no retaining arc remains');
  near(release.leftLatchContact.gap, 0, 5e-16,
    'release begins without a position jump');

  const afterRelease = stateAtTime(timeline.releaseTime + 0.01);
  assert.ok(afterRelease.leftLatchContact.gap > 0);
  assert.ok(afterRelease.weightVelocity < 0);
  const loweringStart = stateAtTime(timeline.impactDwellEnd);
  const loweringMiddle = stateAtTime(
    (timeline.impactDwellEnd + timeline.headLoweringEnd) / 2,
  );
  const relatchStart = stateAtTime(timeline.headLoweringEnd);
  assert.ok(loweringStart.leftLatchContact.gap > loweringMiddle.leftLatchContact.gap);
  assert.ok(loweringMiddle.leftLatchContact.gap > relatchStart.leftLatchContact.gap);
  near(relatchStart.leftLatchContact.gap, 0, 5e-16,
    'lifting head returns to the hook arcs');
  assert.equal(relatchStart.weightSupported, false);
  assert.equal(
    stateAtTime((timeline.headLoweringEnd + timeline.relatchEnd) / 2)
      .weightSupported,
    true,
  );
  disposeModel(model.root);
});

test('movement 251 gives the released hammer an exact gravity-only fall and impact', () => {
  const model = createMovementModel(catalog.movements[250]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  let maximumPositionError = 0;
  let maximumVelocityError = 0;
  let maximumEnergyError = 0;
  let minimumPileGap = Infinity;

  for (let sample = 0; sample < 65536; sample += 1) {
    const elapsed = (timeline.impactTime - timeline.releaseTime)
      * sample / 65536;
    const state = stateAtTime(timeline.releaseTime + elapsed);
    const expectedDrop =
      0.5 * geometry.gravitationalAcceleration * elapsed ** 2;
    maximumPositionError = Math.max(
      maximumPositionError,
      Math.abs(state.weightPivotY - (geometry.releasePivotY - expectedDrop)),
    );
    maximumVelocityError = Math.max(
      maximumVelocityError,
      Math.abs(
        state.weightVelocity + geometry.gravitationalAcceleration * elapsed,
      ),
    );
    maximumEnergyError = Math.max(
      maximumEnergyError,
      Math.abs(
        state.kineticEnergyPerUnitMass
          - state.potentialEnergyLostPerUnitMass,
      ),
      Math.abs(state.freeFallIdentityError),
    );
    minimumPileGap = Math.min(minimumPileGap, state.pileHeadGap);
    near(state.weightAcceleration, -geometry.gravitationalAcceleration, 0,
      `gravity-only acceleration at ${sample}`);
    near(state.liftHeadY, stateAtTime(timeline.releaseTime).liftHeadY, 0,
      `released lifting head remains fixed at ${sample}`);
    near(state.hookOpeningAngle, geometry.releaseHookAngle, 0,
      `released hooks remain open at ${sample}`);
  }
  assert.ok(maximumPositionError < 8.1e-15);
  assert.ok(maximumVelocityError < 9e-15);
  assert.ok(maximumEnergyError < 3e-14);
  assert.ok(minimumPileGap > 0);

  const impact = stateAtTime(timeline.impactTime);
  near(geometry.dropDistance, 4.2, 0, 'full free-fall distance');
  near(geometry.gravitationalAcceleration, 8.4, 0,
    'scaled gravitational acceleration');
  near(impact.pileHeadGap, 0, 0, 'hammer reaches pile head exactly');
  assert.equal(impact.impactContact, true);
  assert.equal(impact.stage, 'weight-stopped-on-pile-head');
  near(impact.impactSpeed, 8.4, 0, 'pre-impact speed magnitude');
  near(impact.weightVelocity, 0, 0, 'inelastic stop after impact');
  disposeModel(model.root);
});

test('movement 251 uses smooth controlled handoffs and labels the external reset', () => {
  const model = createMovementModel(catalog.movements[250]);
  const { stateAtTime, timeline } = model.root.userData;
  const expectedStages = [
    [0.2, 'latched-low-source-dwell'],
    [1.2, 'raising-latched-weight-to-slot'],
    [2.7, 'slot-b-squeezing-hooks-inward'],
    [3.8, 'released-weight-in-gravity-only-fall'],
    [4.8, 'weight-stopped-on-pile-head'],
    [5.6, 'external-reset-lowering-lifting-head'],
    [6.6, 'external-reset-relatching-hooks'],
    [7.8, 'external-reset-recovering-latched-weight'],
    [9.2, 'latched-low-cycle-end-dwell'],
  ];
  for (const [time, stage] of expectedStages) {
    assert.equal(stateAtTime(time).stage, stage);
  }
  for (const boundary of [
    timeline.lowDwellEnd,
    timeline.guideEngagementTime,
    timeline.impactDwellEnd,
    timeline.headLoweringEnd,
    timeline.relatchEnd,
    timeline.recoveryEnd,
  ]) {
    const state = stateAtTime(boundary);
    near(state.weightVelocity, 0, 2e-14,
      `controlled weight velocity at ${boundary}`);
    near(state.liftHeadVelocity, 0, 2e-14,
      `controlled head velocity at ${boundary}`);
    near(state.hookAngularSpeed, 0, 2e-14,
      `controlled hook speed at ${boundary}`);
  }
  assert.equal(stateAtTime(5.6).externalReload, true);
  assert.equal(stateAtTime(6.6).externalReload, true);
  assert.equal(stateAtTime(7.8).externalReload, true);
  assert.equal(stateAtTime(2.7).externalReload, false);

  const step = 1e-5;
  for (const time of [1.2, 2.35, 2.75, 3.1, 5.6, 6.6, 7.8]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    near(
      (after.weightPivotY - before.weightPivotY) / (2 * step),
      state.weightVelocity,
      2e-8,
      `weight velocity at ${time}`,
    );
    near(
      (after.liftHeadY - before.liftHeadY) / (2 * step),
      state.liftHeadVelocity,
      2e-8,
      `head velocity at ${time}`,
    );
    near(
      (after.hookOpeningAngle - before.hookOpeningAngle) / (2 * step),
      state.hookAngularSpeed,
      2e-8,
      `hook velocity at ${time}`,
    );
  }
  disposeModel(model.root);
});

test('movement 251 renderer binds separate head, hooks, hammer, guides, and pile head', () => {
  const model = createMovementModel(catalog.movements[250]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const fixedObjects = [
    blocks.frame,
    blocks.pileHead,
    blocks.anvil,
    ...blocks.rails,
  ];
  const fixedTransforms = fixedObjects.map((object) => ({
    object,
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
  }));

  assert.equal(blocks.guideContactMarkers.length, 2);
  assert.equal(blocks.latchContactMarkers.length, 2);
  assert.equal(blocks.pivotPins.length, 2);
  assert.equal(blocks.pivotIndexes.length, 2);
  assert.equal(blocks.frame.userData.fixed, true);
  assert.equal(blocks.pileHead.userData.fixed, true);
  assert.match(blocks.leftGuide.userData.role, /slot-b/);
  assert.match(blocks.rightGuide.userData.role, /slot-b/);
  assert.match(blocks.leftHook.userData.role, /hook-a/);
  assert.match(blocks.rightHook.userData.role, /hook-a/);
  assert.match(blocks.hammer.userData.role, /weight-w/);
  assert.match(blocks.hammerIndex.userData.role, /white/);
  assert.match(blocks.leftBearing.userData.role, /white/);
  assert.match(blocks.rightBearing.userData.role, /white/);

  const hammerRailClearance =
    geometry.frameRailInnerHalfWidth - geometry.hammerHalfWidth;
  // W fills the space between the rails, as Brown draws it, with a small
  // running clearance.
  assert.ok(hammerRailClearance > 0.3 && hammerRailClearance < 0.4);
  let minimumHookRailClearance = Infinity;
  for (let sample = 0; sample <= 1024; sample += 1) {
    const opening = geometry.releaseHookAngle * sample / 1024;
    for (const point of geometry.leftHookCenterline) {
      const world = new THREE.Vector2(
        -geometry.hookPivotHalfSpacing,
        0,
      ).add(point.clone().rotateAround(
        new THREE.Vector2(),
        -opening,
      ));
      minimumHookRailClearance = Math.min(
        minimumHookRailClearance,
        geometry.frameRailInnerHalfWidth
          + world.x - geometry.hookTubeRadius,
      );
    }
  }
  assert.ok(minimumHookRailClearance > 0.17);
  const releaseHeadY = geometry.releasePivotY + geometry.headRelativeY;
  const guideHalfWidthAtBottom = Math.abs(
    geometry.guideSurfaceStart.x,
  );
  assert.ok(guideHalfWidthAtBottom - geometry.headBarHalfWidth > 0.05);
  assert.ok(
    geometry.guideSurfaceStart.y
      - (releaseHeadY + geometry.headBarHalfHeight)
      > 0.1,
    'the lifting head remains vertically below the slot faces',
  );
  const bearingCenterline = geometry.leftHookCenterline.find(
    (point) => point.x === -1.53 && point.y === 2,
  );
  assert.ok(bearingCenterline);
  near(
    bearingCenterline.distanceTo(geometry.leftLatchBearingLocal),
    geometry.hookTubeRadius,
    1e-15,
    'latch bearing lies on the inner hook surface',
  );
  near(
    geometry.hookPivotHalfSpacing
      + Math.abs(geometry.leftLatchBearingLocal.x),
    geometry.headBarHalfWidth,
    0,
    'latch bearing lies directly below the lifting-head edge',
  );
  near(
    geometry.headRelativeY - geometry.headBarHalfHeight,
    geometry.leftLatchBearingLocal.y,
    0,
    'latch bearing lies on the lifting-head underside',
  );

  for (const time of [0, 1.4, 2.8, 3.8, 4.8, 5.7, 6.6, 7.8, 9.3]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.weightAssembly.position.y, state.weightPivotY, 0,
      `rendered weight position at ${time}`);
    near(blocks.liftHead.position.y, state.liftHeadY, 0,
      `rendered head position at ${time}`);
    near(blocks.leftHook.rotation.z, state.leftHookAngle, 0,
      `rendered left hook angle at ${time}`);
    near(blocks.rightHook.rotation.z, state.rightHookAngle, 0,
      `rendered right hook angle at ${time}`);
    // The pile head is below the plate crop; its impact ring is never shown.
    assert.equal(blocks.impactMarker.visible, false);
    for (const fixed of fixedTransforms) {
      vectorNear(fixed.object.position, fixed.position, 0,
        `fixed position at ${time}`);
      near(fixed.object.quaternion.angleTo(fixed.quaternion), 0, 0,
        `fixed orientation at ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 251 closes exactly in ten seconds and leaves movement 507 authored', () => {
  const movement251 = catalog.movements[250];
  const model251 = createMovementModel(movement251);
  const { animationTiming, stateAtTime, timeline } = model251.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.cycleDuration);

  assert.equal(start.sourcePose, true);
  assert.equal(closure.sourcePose, true);
  assert.equal(closure.cycleCoordinate, 0);
  near(closure.weightPivotY, start.weightPivotY, 0,
    'weight closes without teleport');
  near(closure.liftHeadY, start.liftHeadY, 0,
    'lifting head closes without teleport');
  near(closure.hookOpeningAngle, start.hookOpeningAngle, 0,
    'hooks close exactly');
  near(closure.weightVelocity, 0, 0, 'closed weight velocity');
  near(closure.liftHeadVelocity, 0, 0, 'closed head velocity');
  near(closure.hookAngularSpeed, 0, 0, 'closed hook velocity');
  near(animationTiming.authoredCyclePeriod, 10, 0,
    'authored demonstration period');
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model251.root);
  disposeModel(model289.root);
});
