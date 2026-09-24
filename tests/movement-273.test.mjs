import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
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

function wrappedAngleDifference(first, second) {
  return Math.atan2(
    Math.sin(first - second),
    Math.cos(first - second),
  );
}

test('movement 273 is one four-link rhombus joining four rectilinear sliders', () => {
  const movement = catalog.movements[272];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 273);
  assert.equal(movement.number, '273');
  assert.equal(movement.title,
    'Four-Link Rhombus Rectilinear Converter');
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'four-equal-link-rhombus-opposed-horizontal-sliders-opposed-vertical-sliders',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /four-equal-rigid-links/);
  assert.match(mechanism, /opposed-horizontal-sliders-A-and-B/);
  assert.match(mechanism, /opposed-vertical-sliders-C-and-D/);
  assert.match(mechanism, /x-squared-plus-y-squared/);
  assert.deepEqual(transmission.horizontalInputSliders, ['A', 'B']);
  assert.deepEqual(transmission.verticalOutputSliders, ['C', 'D']);
  assert.match(transmission.constraintLaw, /linkLength\^2/);

  assert.equal(blocks.linkage.parent, model.root);
  assert.equal(blocks.linkMeshes.length, 4);
  assert.ok(blocks.linkMeshes.every((link) =>
    link.parent === blocks.linkage));
  assert.deepEqual(Object.keys(blocks.rods), ['A', 'B', 'C', 'D']);
  assert.deepEqual(Object.keys(blocks.pins), ['A', 'B', 'C', 'D']);
  assert.deepEqual(Object.keys(blocks.guides), ['A', 'B', 'C', 'D']);
  for (const object of [
    ...Object.values(blocks.rods),
    ...Object.values(blocks.pins),
    ...Object.values(blocks.guides),
  ]) {
    assert.equal(object.parent, model.root);
  }
  vectorNear(blocks.rods.A.userData.axis, X_AXIS, 0, 'rod A axis');
  vectorNear(blocks.rods.B.userData.axis, X_AXIS, 0, 'rod B axis');
  vectorNear(blocks.rods.C.userData.axis, Y_AXIS, 0, 'rod C axis');
  vectorNear(blocks.rods.D.userData.axis, Y_AXIS, 0, 'rod D axis');
  vectorNear(blocks.guides.A.userData.axis, X_AXIS, 0, 'guide A axis');
  vectorNear(blocks.guides.C.userData.axis, Y_AXIS, 0, 'guide C axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    /^rigid-rhombus-link-/.test(role)).length, 4);
  assert.equal(roles.filter((role) =>
    /^shared-through-pin-[ABCD]$/.test(role)).length, 4);
  assert.equal(roles.filter((role) =>
    /^fixed-(horizontal|vertical)-split-guide-for-[ABCD]$/.test(role)).length,
  4);
  assert.equal(roles.filter((role) => /gear|belt|pulley|cam/.test(role)).length, 0);
  disposeModel(model.root);
});

test('movement 273 records the source animation and idealizes its hand drawing within uncertainty', () => {
  const model = createMovementModel(catalog.movements[272]);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.plate273;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /source animation instead holds briefly/);
  assert.match(sourceAnimation.reason, /reconstructed independently/);
  assert.equal(sourceReference.officialDescription,
    catalog.movements[272].description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.equal(plate.officialAnimationAvailable, true);
  assert.deepEqual(plate.rasterCenter, { x: 267, y: 274 });
  assert.deepEqual(plate.rasterJointCenters, {
    A: { x: 154, y: 278 },
    B: { x: 382, y: 274 },
    C: { x: 266, y: 125 },
    D: { x: 260, y: 423 },
  });
  assert.deepEqual(plate.rasterGuideCenters, {
    A: { x: 95, y: 279 },
    B: { x: 445, y: 274 },
    C: { x: 267, y: 52 },
    D: { x: 259, y: 486 },
  });
  assert.deepEqual(plate.rasterOuterRodEnds, {
    A: { x: 60, y: 279 },
    B: { x: 485, y: 274 },
    C: { x: 267, y: 16 },
    D: { x: 259, y: 520 },
  });
  assert.match(plate.inferredTopology, /four equal side links/);
  assert.match(plate.inferredTopology, /four shared corner pins/);
  assert.match(plate.inferredTopology, /four fixed rectilinear guides/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 69,
    edition: 21,
    illustrationPage: 68,
    publicationYear: 1908,
  });
  assert.deepEqual(plate.sourceIdealizationPixelErrors, {
    A: Math.sqrt(17),
    B: 1,
    C: 1,
    D: 7,
  });
  for (const error of Object.values(plate.sourceIdealizationPixelErrors)) {
    assert.ok(error <= plate.measurementUncertaintyPixels);
  }

  const idealRasterPoints = {
    A: { x: 153, y: 274 },
    B: { x: 381, y: 274 },
    C: { x: 267, y: 125 },
    D: { x: 267, y: 423 },
  };
  const sourceState = stateAtTime(0);
  for (const label of ['A', 'B', 'C', 'D']) {
    vectorNear(
      sourceState.points[label].position,
      sourcePointToModel(idealRasterPoints[label]),
      3e-16,
      `ideal source joint ${label}`,
    );
    near(
      sourceState.points[label].position.distanceTo(
        sourcePointToModel(plate.rasterJointCenters[label]),
      ) / geometry.sourceScale,
      plate.sourceIdealizationPixelErrors[label],
      2e-14,
      `measured source uncertainty ${label}`,
    );
  }
  disposeModel(model.root);
});

test('movement 273 source pose and travel limits preserve one exact rhombus', () => {
  const model = createMovementModel(catalog.movements[272]);
  const {
    geometry,
    stateAtCycleAngle,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;
  const source = stateAtTime(0);
  const horizontalApart = stateAtCycleAngle(0);
  const horizontalTogether = stateAtCycleAngle(Math.PI);

  near(geometry.linkLength,
    Math.hypot(
      geometry.sourceHorizontalHalfSpan,
      geometry.sourceVerticalHalfSpan,
    ),
    0,
    'source Pythagorean link length',
  );
  near(source.cycleAngle, timeline.sourceCycleAngle, 0,
    'source cycle angle');
  near(source.horizontalHalfSpan, 114 * geometry.sourceScale, 0,
    'source horizontal half span');
  near(source.verticalHalfSpan, 149 * geometry.sourceScale, 0,
    'source vertical half span');
  near(source.points.A.position.x, -geometry.sourceHorizontalHalfSpan, 0,
    'source A position');
  near(source.points.B.position.x, geometry.sourceHorizontalHalfSpan, 0,
    'source B position');
  near(source.points.C.position.y, geometry.sourceVerticalHalfSpan, 0,
    'source C position');
  near(source.points.D.position.y, -geometry.sourceVerticalHalfSpan, 0,
    'source D position');

  near(horizontalApart.horizontalHalfSpan,
    geometry.maximumHorizontalHalfSpan, 0,
    'A and B maximum half separation');
  near(horizontalApart.verticalHalfSpan,
    geometry.minimumVerticalHalfSpan, 0,
    'C and D minimum half separation');
  assert.equal(horizontalApart.stage,
    'A-and-B-apart-C-and-D-together-reversal');
  near(horizontalTogether.horizontalHalfSpan,
    geometry.minimumHorizontalHalfSpan, 0,
    'A and B minimum half separation');
  near(horizontalTogether.verticalHalfSpan,
    geometry.maximumVerticalHalfSpan, 0,
    'C and D maximum half separation');
  assert.equal(horizontalTogether.stage,
    'A-and-B-together-C-and-D-apart-reversal');
  near(geometry.inputIndividualStroke,
    geometry.maximumHorizontalHalfSpan
      - geometry.minimumHorizontalHalfSpan,
    0,
    'individual horizontal slider stroke',
  );
  near(geometry.outputIndividualStroke,
    geometry.maximumVerticalHalfSpan
      - geometry.minimumVerticalHalfSpan,
    0,
    'individual vertical slider stroke',
  );
  near(transmission.inputSeparationStroke,
    2 * geometry.inputIndividualStroke, 0,
    'A-to-B separation stroke');
  near(transmission.outputSeparationStroke,
    2 * geometry.outputIndividualStroke, 0,
    'C-to-D separation stroke');
  near(
    THREE.MathUtils.radToDeg(Math.atan2(
      geometry.sourceHorizontalHalfSpan,
      geometry.sourceVerticalHalfSpan,
    )),
    37.41962706187638,
    2e-14,
    'source link inclination from vertical',
  );
  disposeModel(model.root);
});

test('movement 273 keeps all four links rigid through the complete configuration envelope', () => {
  const model = createMovementModel(catalog.movements[272]);
  const {
    geometry,
    stateAtCycleAngle,
  } = model.root.userData;
  let maximumPositionConstraintError = 0;
  let maximumVelocityConstraintError = 0;
  let maximumLinkLengthError = 0;
  let maximumLinkRateError = 0;
  let maximumLinkAccelerationError = 0;

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtCycleAngle(FULL_TURN * sample / 16384);
    maximumPositionConstraintError = Math.max(
      maximumPositionConstraintError,
      Math.abs(state.positionConstraintError),
    );
    maximumVelocityConstraintError = Math.max(
      maximumVelocityConstraintError,
      Math.abs(state.velocityConstraintError),
    );
    maximumLinkLengthError = Math.max(
      maximumLinkLengthError,
      state.maximumLinkLengthError,
    );
    maximumLinkRateError = Math.max(
      maximumLinkRateError,
      state.maximumLinkLengthRateError,
    );
    maximumLinkAccelerationError = Math.max(
      maximumLinkAccelerationError,
      state.maximumLinkLengthAccelerationError,
    );
    assert.equal(state.links.length, 4);
    assert.equal(new Set(state.links.map((link) => link.id)).size, 4);
    for (const link of state.links) {
      near(link.length, geometry.linkLength, 9e-16,
        `${link.id} length at sample ${sample}`);
      assert.ok(Math.abs(link.lengthRate) < 8e-17,
        `${link.id} length rate at sample ${sample}`);
      assert.ok(Math.abs(link.lengthAcceleration) < 1.2e-16,
        `${link.id} length acceleration at sample ${sample}`);
      assert.ok(Math.abs(link.lengthAccelerationInvariantError) < 4e-16,
        `${link.id} acceleration invariant at sample ${sample}`);
    }
    near(state.points.A.position.x + state.points.B.position.x,
      0, 0, `horizontal bisection at sample ${sample}`);
    near(state.points.C.position.y + state.points.D.position.y,
      0, 0, `vertical bisection at sample ${sample}`);
    near(state.points.A.position.y, 0, 0,
      `A horizontal axis at sample ${sample}`);
    near(state.points.B.position.y, 0, 0,
      `B horizontal axis at sample ${sample}`);
    near(state.points.C.position.x, 0, 0,
      `C vertical axis at sample ${sample}`);
    near(state.points.D.position.x, 0, 0,
      `D vertical axis at sample ${sample}`);
  }
  assert.ok(maximumPositionConstraintError < 1.8e-15);
  assert.ok(maximumVelocityConstraintError < 2.3e-16);
  assert.ok(maximumLinkLengthError < 5e-16);
  assert.ok(maximumLinkRateError < 8e-17);
  assert.ok(maximumLinkAccelerationError < 1.2e-16);
  disposeModel(model.root);
});

test('movement 273 always sends C and D opposite to A and B while all guides remain covered', () => {
  const model = createMovementModel(catalog.movements[272]);
  const {
    geometry,
    stateAtCycleAngle,
  } = model.root.userData;
  let minimumHorizontalCoverage = Infinity;
  let minimumVerticalCoverage = Infinity;
  const stages = new Set();

  for (let sample = 0; sample <= 12000; sample += 1) {
    const state = stateAtCycleAngle(FULL_TURN * sample / 12000);
    stages.add(state.stage);
    minimumHorizontalCoverage = Math.min(
      minimumHorizontalCoverage,
      state.horizontalGuideCoverage,
    );
    minimumVerticalCoverage = Math.min(
      minimumVerticalCoverage,
      state.verticalGuideCoverage,
    );
    assert.ok(state.horizontalGuideCoverage > 0.1439,
      `A/B rods cover guides at sample ${sample}`);
    assert.ok(state.verticalGuideCoverage > 0.1578,
      `C/D rods cover guides at sample ${sample}`);
    near(state.symmetryPositionError, 0, 0,
      `symmetric positions at sample ${sample}`);
    near(state.symmetryVelocityError, 0, 0,
      `symmetric velocities at sample ${sample}`);
    near(state.symmetryAccelerationError, 0, 0,
      `symmetric accelerations at sample ${sample}`);
    if (!state.atReversal) {
      near(
        state.verticalSeparationSpeed / state.horizontalSeparationSpeed,
        state.instantaneousSeparationRatio,
        7e-16,
        `instantaneous separation ratio at sample ${sample}`,
      );
      assert.ok(
        state.horizontalSeparationSpeed * state.verticalSeparationSpeed < 0,
        `input and output separations oppose at sample ${sample}`,
      );
      if (state.horizontalHalfSpanSpeed < 0) {
        assert.ok(state.points.A.velocity.x > 0);
        assert.ok(state.points.B.velocity.x < 0);
        assert.ok(state.points.C.velocity.y > 0);
        assert.ok(state.points.D.velocity.y < 0);
      } else {
        assert.ok(state.points.A.velocity.x < 0);
        assert.ok(state.points.B.velocity.x > 0);
        assert.ok(state.points.C.velocity.y < 0);
        assert.ok(state.points.D.velocity.y > 0);
      }
    }
  }
  near(minimumHorizontalCoverage,
    geometry.horizontalRodLength - (
      geometry.horizontalGuideDistance
        + geometry.guideLength / 2
        - geometry.minimumHorizontalHalfSpan
    ),
    5e-16,
    'minimum horizontal guide coverage',
  );
  near(minimumVerticalCoverage,
    geometry.verticalRodLength - (
      geometry.verticalGuideDistance
        + geometry.guideLength / 2
        - geometry.minimumVerticalHalfSpan
    ),
    5e-16,
    'minimum vertical guide coverage',
  );
  assert.deepEqual(stages, new Set([
    'A-and-B-apart-C-and-D-together-reversal',
    'A-and-B-moving-together-C-and-D-moving-apart',
    'A-and-B-together-C-and-D-apart-reversal',
    'A-and-B-moving-apart-C-and-D-moving-together',
  ]));
  disposeModel(model.root);
});

test('movement 273 analytic slider and link rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[272]);
  const {
    stateAtCycleAngle,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const angleStep = 1e-5;
  const timeStep = angleStep / timeline.cycleAngularSpeed;

  for (const angle of [0.17, 0.53, 1.13, 1.91, 2.67, 3.42, 4.31, 5.48]) {
    const before = stateAtCycleAngle(angle - angleStep);
    const state = stateAtCycleAngle(angle);
    const after = stateAtCycleAngle(angle + angleStep);
    const first = (key) => (after[key] - before[key])
      / (2 * angleStep);
    const second = (key) => (after[key] - 2 * state[key] + before[key])
      / angleStep ** 2;
    near(first('horizontalHalfSpan'),
      state.horizontalHalfSpanPerRadian, 3e-11,
      `horizontal first derivative at ${angle}`);
    near(second('horizontalHalfSpan'),
      state.horizontalHalfSpanSecondPerRadian, 5e-6,
      `horizontal second derivative at ${angle}`);
    near(first('verticalHalfSpan'),
      state.verticalHalfSpanPerRadian, 3.3e-11,
      `vertical first derivative at ${angle}`);
    near(second('verticalHalfSpan'),
      state.verticalHalfSpanSecondPerRadian, 5.3e-6,
      `vertical second derivative at ${angle}`);

    const time = (angle - timeline.sourceCycleAngle)
      / timeline.cycleAngularSpeed;
    const timeBefore = stateAtTime(time - timeStep);
    const timeAfter = stateAtTime(time + timeStep);
    for (const label of ['A', 'B', 'C', 'D']) {
      const finiteVelocity = timeAfter.points[label].position.clone()
        .sub(timeBefore.points[label].position)
        .multiplyScalar(1 / (2 * timeStep));
      const finiteAcceleration = timeAfter.points[label].position.clone()
        .addScaledVector(state.points[label].position, -2)
        .add(timeBefore.points[label].position)
        .multiplyScalar(1 / timeStep ** 2);
      vectorNear(finiteVelocity, state.points[label].velocity, 2.6e-11,
        `${label} velocity at ${angle}`);
      vectorNear(finiteAcceleration,
        state.points[label].acceleration, 3.3e-6,
        `${label} acceleration at ${angle}`);
    }
    state.links.forEach((link, index) => {
      const beforeAngle = Math.atan2(
        before.links[index].vector.y,
        before.links[index].vector.x,
      );
      const afterAngle = Math.atan2(
        after.links[index].vector.y,
        after.links[index].vector.x,
      );
      const finiteAngularSpeed = wrappedAngleDifference(
        afterAngle,
        beforeAngle,
      ) / (2 * timeStep);
      near(finiteAngularSpeed, link.angularSpeed, 5e-11,
        `${link.id} angular speed at ${angle}`);
    });
  }
  disposeModel(model.root);
});

test('movement 273 renderer binds four rods, pins, links and fixed guides without undrawn indices', () => {
  const model = createMovementModel(catalog.movements[272]);
  const {
    blocks,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const fixedObjects = [
    ...Object.values(blocks.guides),
  ].map((object) => ({
    object,
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
  }));

  for (const guide of Object.values(blocks.guides)) {
    assert.equal(guide.userData.jaws.length, 2);
    assert.ok(guide.userData.innerHalfGap > geometry.rodRadius);
  }
  // Brown draws no white slider stripes or pin dots; the source
  // presentation detaches them.
  for (const rod of Object.values(blocks.rods)) {
    assert.equal(rod.userData.blocks.index.parent, null);
    assert.match(rod.userData.blocks.index.userData.role,
      /white-translation-index/);
  }
  for (const pin of Object.values(blocks.pins)) {
    assert.equal(pin.userData.blocks.frontIndex.parent, null);
    assert.match(pin.userData.blocks.frontIndex.userData.role,
      /white-motion-index/);
  }
  assert.deepEqual(
    blocks.linkMeshes.map((link) => link.userData.planeZ),
    [
      geometry.frontLinkPlaneZ,
      geometry.rearLinkPlaneZ,
      geometry.frontLinkPlaneZ,
      geometry.rearLinkPlaneZ,
    ],
  );

  for (const time of [0, 0.63, 2, 3.47, 6, timeline.cyclePeriod]) {
    const state = stateAtTime(time);
    model.update(time);
    for (const label of ['A', 'B', 'C', 'D']) {
      vectorNear(blocks.rods[label].position,
        state.points[label].position, 0,
        `rendered rod ${label} at ${time}`);
      vectorNear(blocks.pins[label].position,
        state.points[label].position, 0,
        `rendered pin ${label} at ${time}`);
      vectorNear(blocks.rods[label].userData.velocity,
        state.points[label].velocity, 0,
        `rendered rod ${label} velocity at ${time}`);
      near(model.root.userData.contacts.sliderGuides[label].offAxisError,
        0, 0, `guide ${label} axis error at ${time}`);
      assert.ok(
        model.root.userData.contacts.sliderGuides[label]
          .rodCoverageBeyondGuide > 0,
      );
    }
    state.links.forEach((linkState, index) => {
      const link = blocks.linkMeshes[index];
      const expectedStart = linkState.start.position.clone();
      const expectedEnd = linkState.end.position.clone();
      expectedStart.z = linkState.planeZ;
      expectedEnd.z = linkState.planeZ;
      model.root.updateMatrixWorld(true);
      vectorNear(link.localToWorld(new THREE.Vector3()), expectedStart, 1e-14,
        `rendered ${linkState.id} start at ${time}`);
      vectorNear(link.localToWorld(new THREE.Vector3(geometry.linkLength, 0, 0)), expectedEnd, 1e-14,
        `rendered ${linkState.id} end at ${time}`);
      near(link.scale.x, 1, 0,
        `rendered ${linkState.id} length at ${time}`);
      near(link.userData.angularSpeed, linkState.angularSpeed, 0,
        `rendered ${linkState.id} angular speed at ${time}`);
    });
    for (const fixed of fixedObjects) {
      vectorNear(fixed.object.position, fixed.position, 0,
        `fixed position at ${time}`);
      assert.ok(fixed.object.quaternion.equals(fixed.quaternion),
        `fixed orientation at ${time}`);
    }
  }

  let meshCount = 0;
  model.root.traverse((object) => { if (object.isMesh) meshCount += 1; });
  assert.equal(meshCount, 40);
  const size = new THREE.Box3().setFromObject(model.root)
    .getSize(new THREE.Vector3());
  assert.ok(size.x > 7.5);
  assert.ok(size.y > 8.7);
  assert.ok(size.z < 1);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);
  assert.ok(model.cameraDirection.x > model.cameraDirection.y);
  disposeModel(model.root);
});

test('movement 273 closes exactly and leaves movement 339 as the next authored draft', () => {
  const movement = catalog.movements[272];
  const model = createMovementModel(movement);
  const {
    animationTiming,
    blocks,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const start = stateAtTime(0);
  const together = stateAtTime(timeline.cyclePeriod / 4);
  const apart = stateAtTime(3 * timeline.cyclePeriod / 4);
  const closure = stateAtTime(timeline.cyclePeriod);

  near(timeline.cyclePeriod, 8, 0, 'authored cycle duration');
  near(timeline.cycleAngularSpeed, FULL_TURN / 8, 0,
    'demonstration angular speed');
  assert.equal(together.stage,
    'A-and-B-together-C-and-D-apart-reversal');
  assert.equal(apart.stage,
    'A-and-B-apart-C-and-D-together-reversal');
  for (const label of ['A', 'B', 'C', 'D']) {
    vectorNear(closure.points[label].position,
      start.points[label].position, 3e-16,
      `${label} position closure`);
    vectorNear(closure.points[label].velocity,
      start.points[label].velocity, 1.2e-16,
      `${label} velocity closure`);
    vectorNear(closure.points[label].acceleration,
      start.points[label].acceleration, 9e-17,
      `${label} acceleration closure`);
  }
  near(animationTiming.authoredCyclePeriod, timeline.cyclePeriod, 0,
    'authored timing period');
  near(animationTiming.targetCycleDuration, 2, 0,
    'display cycle duration');
  assertReadableTiming(animationTiming);

  model.update(0);
  const sourceRodPositions = Object.fromEntries(
    Object.entries(blocks.rods).map(([label, rod]) => [
      label,
      rod.position.clone(),
    ]),
  );
  model.update(timeline.cyclePeriod);
  for (const label of ['A', 'B', 'C', 'D']) {
    vectorNear(blocks.rods[label].position,
      sourceRodPositions[label], 3e-16,
      `rendered ${label} closure`);
  }

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
