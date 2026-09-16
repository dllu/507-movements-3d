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
const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

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

function assertArcOnPulley(arc, center, axis, radius, message) {
  for (let sample = 0; sample <= 1024; sample += 1) {
    const progress = sample / 1024;
    const point = arc.getPoint(progress);
    const tangent = arc.getTangent(progress);
    const radial = point.clone().sub(center);
    near(radial.dot(axis), 0, 3e-15,
      `${message} axial plane at sample ${sample}`);
    near(radial.length(), radius, 3e-15,
      `${message} radius at sample ${sample}`);
    near(radial.dot(tangent), 0, 3e-15,
      `${message} tangent at sample ${sample}`);
  }
}

test('movement 243 is one spatial band driving two vertical shafts', () => {
  const movement = catalog.movements[242];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 243);
  assert.equal(movement.number, '243');
  assert.equal(
    movement.title,
    'Single-Band Horizontal-to-Twin-Vertical Shaft Drive',
  );
  assert.equal(movement.category, 'Ropes, belts & pulleys');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'single-spatial-band-horizontal-driver-to-two-vertical-shafts-with-guide-idlers',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'one-endless-flat-band-wraps-a-horizontal-driver-two-guide-idlers-and-two-parallel-vertical-shaft-pulleys',
  );
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.beltCount, 1);
  assert.equal(transmission.noSlip, true);
  assert.equal(transmission.quarterTwistCount, 2);
  assert.equal(transmission.rearReturnLeafPresent, true);
  assert.equal(transmission.verticalOutputsRotateTogether, true);
  assert.equal(
    blocks.belt.userData.role,
    'one-endless-band-driving-both-vertical-shafts',
  );
  assert.equal(
    blocks.driver.userData.role,
    'horizontal-shaft-central-driving-pulley',
  );
  assert.equal(
    blocks.leftVertical.userData.role,
    'left-vertical-shaft-driven-pulley',
  );
  assert.equal(
    blocks.rightVertical.userData.role,
    'right-vertical-shaft-driven-pulley',
  );
  assert.equal(
    blocks.leftGuide.userData.role,
    'left-horizontal-axis-guide-idler',
  );
  assert.equal(
    blocks.rightGuide.userData.role,
    'right-horizontal-axis-guide-idler',
  );
  disposeModel(model.root);
});

test('movement 243 preserves the measured unavailable source plate', () => {
  const movement = catalog.movements[242];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceReference,
    stateAtInputAngle,
  } = model.root.userData;
  const plate = sourceReference.plate243;

  assert.equal(sourceReference.officialDescription, movement.description);
  assert.deepEqual(plate.rasterDriverCenter.toArray(), [272, 304]);
  assert.deepEqual(plate.rasterLeftGuideCenter.toArray(), [168, 277]);
  assert.deepEqual(plate.rasterRightGuideCenter.toArray(), [375, 277]);
  assert.deepEqual(plate.rasterLeftVerticalBeltPlane.toArray(), [72, 252]);
  assert.deepEqual(plate.rasterRightVerticalBeltPlane.toArray(), [460, 252]);
  assert.equal(plate.rasterDriverPitchRadius, 47);
  assert.equal(plate.rasterGuidePitchRadius, 25);
  assert.equal(plate.rasterVerticalPitchRadius, 32);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.match(plate.inferredTopology, /one continuous spatial band/);
  assert.match(plate.sourceProjectionNote, /rear return leaf overlaps/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 63,
    edition: 21,
    illustrationPage: 62,
    publicationYear: 1908,
  });
  vectorNear(geometry.driverCenter, new THREE.Vector3(0, 0, 0), 0,
    'source-mapped driver center');
  vectorNear(geometry.leftGuideCenter, new THREE.Vector3(-1.56, 0.405, 0),
    2e-16, 'source-mapped left guide center');
  vectorNear(geometry.rightGuideCenter, new THREE.Vector3(1.545, 0.405, 0),
    2e-16, 'source-mapped right guide center');
  vectorNear(
    geometry.leftVerticalCenter,
    new THREE.Vector3(-3, 0.78, -0.48),
    2e-16,
    'source-mapped left vertical pulley',
  );
  vectorNear(
    geometry.rightVerticalCenter,
    new THREE.Vector3(2.82, 0.78, -0.48),
    2e-16,
    'source-mapped right vertical pulley',
  );
  const source = stateAtInputAngle(0);
  assert.equal(source.sourcePose, true);
  assert.equal(
    source.stage,
    'one-endless-band-drives-both-vertical-shafts-continuously',
  );
  near(source.driverAngle, 0, 0, 'source driver angle');
  near(source.leftVerticalAngle, 0, 0, 'source left-output angle');
  near(source.rightVerticalAngle, 0, 0, 'source right-output angle');
  disposeModel(model.root);
});

test('movement 243 closed route is position-, tangent-, and ribbon-frame continuous', () => {
  const model = createMovementModel(catalog.movements[242]);
  const { blocks, geometry } = model.root.userData;
  const { beltSegments } = geometry;
  const frameAtDistance = blocks.belt.userData.frameAtDistance;

  assert.equal(beltSegments.length, 10);
  near(
    beltSegments.reduce((length, segment) => length + segment.length, 0),
    geometry.beltLength,
    2e-15,
    'piecewise belt length',
  );
  for (let index = 0; index < beltSegments.length; index += 1) {
    const segment = beltSegments[index];
    const next = beltSegments[(index + 1) % beltSegments.length];
    vectorNear(segment.curve.getPoint(1), next.curve.getPoint(0), 2e-15,
      `position continuity after segment ${index}`);
    near(segment.curve.getTangent(1).dot(next.curve.getTangent(0)), 1,
      3e-15, `tangent continuity after segment ${index}`);
    const before = frameAtDistance(segment.endDistance - 1e-10);
    const after = frameAtDistance(segment.endDistance + 1e-10);
    near(before.widthDirection.dot(after.widthDirection), 1, 3e-15,
      `ribbon width continuity after segment ${index}`);
  }

  const leftTwist = beltSegments[0];
  vectorNear(frameAtDistance(leftTwist.startDistance).widthDirection, Y_AXIS,
    2e-15, 'left twist begins in vertical-pulley axial direction');
  vectorNear(frameAtDistance(leftTwist.endDistance).widthDirection, Z_AXIS,
    2e-15, 'left twist ends in guide axial direction');
  const leftMidWidth = frameAtDistance(
    (leftTwist.startDistance + leftTwist.endDistance) / 2,
  ).widthDirection;
  near(leftMidWidth.dot(Y_AXIS), Math.SQRT1_2, 2e-15,
    'left twist halfway Y component');
  near(leftMidWidth.dot(Z_AXIS), Math.SQRT1_2, 2e-15,
    'left twist halfway Z component');

  const rightTwist = beltSegments[6];
  vectorNear(frameAtDistance(rightTwist.startDistance).widthDirection, Z_AXIS,
    2e-15, 'right twist begins in guide axial direction');
  vectorNear(frameAtDistance(rightTwist.endDistance).widthDirection, Y_AXIS,
    2e-15, 'right twist ends in vertical-pulley axial direction');
  const rearReturn = frameAtDistance(
    (beltSegments[8].startDistance + beltSegments[8].endDistance) / 2,
  );
  near(rearReturn.point.z, geometry.rearReturnDepth, 0,
    'rear return axial depth');
  vectorNear(rearReturn.tangent, X_AXIS.clone().negate(), 0,
    'rear return direction');
  vectorNear(rearReturn.widthDirection, Y_AXIS, 0,
    'rear return band-width direction');

  for (let sample = 0; sample <= 8192; sample += 1) {
    const frame = frameAtDistance(geometry.beltLength * sample / 8192);
    near(frame.tangent.length(), 1, 3e-15,
      `unit tangent at sample ${sample}`);
    near(frame.widthDirection.length(), 1, 3e-15,
      `unit width at sample ${sample}`);
    near(frame.thicknessDirection.length(), 1, 3e-15,
      `unit thickness at sample ${sample}`);
    near(frame.tangent.dot(frame.widthDirection), 0, 3e-15,
      `tangent/width orthogonality at sample ${sample}`);
    near(frame.tangent.dot(frame.thicknessDirection), 0, 3e-15,
      `tangent/thickness orthogonality at sample ${sample}`);
    near(frame.widthDirection.dot(frame.thicknessDirection), 0, 3e-15,
      `width/thickness orthogonality at sample ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 243 band is exactly tangent to all five pulleys', () => {
  const model = createMovementModel(catalog.movements[242]);
  const { geometry } = model.root.userData;

  assertArcOnPulley(
    geometry.driverArc,
    geometry.driverCenter,
    Z_AXIS,
    geometry.driverRadius,
    'central driver wrap',
  );
  assertArcOnPulley(
    geometry.leftGuideArc,
    geometry.leftGuideCenter,
    Z_AXIS,
    geometry.guideRadius,
    'left guide wrap',
  );
  assertArcOnPulley(
    geometry.rightGuideArc,
    geometry.rightGuideCenter,
    Z_AXIS,
    geometry.guideRadius,
    'right guide wrap',
  );
  assertArcOnPulley(
    geometry.leftVerticalArc,
    geometry.leftVerticalCenter,
    Y_AXIS,
    geometry.verticalRadius,
    'left vertical wrap',
  );
  assertArcOnPulley(
    geometry.rightVerticalArc,
    geometry.rightVerticalCenter,
    Y_AXIS,
    geometry.verticalRadius,
    'right vertical wrap',
  );

  assert.ok(geometry.driverArc.sweep > 0);
  assert.ok(geometry.leftGuideArc.sweep < 0);
  assert.ok(geometry.rightGuideArc.sweep < 0);
  near(Math.abs(geometry.leftVerticalArc.sweep), Math.PI, 0,
    'left vertical half wrap');
  near(Math.abs(geometry.rightVerticalArc.sweep), Math.PI, 0,
    'right vertical half wrap');
  near(
    THREE.MathUtils.radToDeg(geometry.driverArc.sweep),
    113.38074406353309,
    2e-13,
    'driver source-proportioned wrap',
  );
  near(
    THREE.MathUtils.radToDeg(geometry.leftGuideArc.sweep),
    -56.38885518956931,
    2e-13,
    'left guide source-proportioned wrap',
  );
  near(
    THREE.MathUtils.radToDeg(geometry.rightGuideArc.sweep),
    -56.99188887396376,
    2e-13,
    'right guide source-proportioned wrap',
  );
  for (const tangent of [
    geometry.leftInternalTangent,
    geometry.rightInternalTangent,
  ]) {
    const span = tangent.secondPoint.clone().sub(tangent.firstPoint);
    near(span.dot(tangent.firstNormal), 0, 3e-15,
      'internal span tangent to both pitch circles');
    near(span.length(), tangent.spanLength, 0,
      'internal tangent span length');
  }
  disposeModel(model.root);
});

test('movement 243 has one non-self-intersecting flat band and one marker set', () => {
  const model = createMovementModel(catalog.movements[242]);
  const { blocks, geometry } = model.root.userData;
  const { beltSegments } = geometry;
  const { ribbon, markers } = blocks.belt.userData;
  const positions = ribbon.geometry.getAttribute('position');

  assert.equal(blocks.belt.userData.beltCount, 1);
  assert.equal(markers.length, geometry.markerCount);
  assert.equal(geometry.markerCount, 14);
  assert.equal(ribbon.userData.role, 'single-flat-spatial-power-band');
  assert.equal(positions.count, (blocks.belt.userData.ribbonSamples + 1) * 4);
  assert.equal(ribbon.geometry.index.count, blocks.belt.userData.ribbonSamples * 24);
  assert.equal(
    new Set(markers.map(({ userData }) => userData.markerIndex)).size,
    geometry.markerCount,
  );
  markers.forEach((marker) => {
    assert.equal(marker.userData.role, 'constant-arclength-band-marker');
  });

  let minimumNonAdjacentClearance = Infinity;
  for (let firstIndex = 0; firstIndex < beltSegments.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < beltSegments.length;
      secondIndex += 1
    ) {
      const adjacent = secondIndex === firstIndex + 1
        || (firstIndex === 0 && secondIndex === beltSegments.length - 1);
      if (adjacent) continue;
      for (let firstSample = 0; firstSample <= 48; firstSample += 1) {
        const firstPoint = beltSegments[firstIndex].curve.getPoint(
          firstSample / 48,
        );
        for (let secondSample = 0; secondSample <= 48; secondSample += 1) {
          const secondPoint = beltSegments[secondIndex].curve.getPoint(
            secondSample / 48,
          );
          minimumNonAdjacentClearance = Math.min(
            minimumNonAdjacentClearance,
            firstPoint.distanceTo(secondPoint),
          );
        }
      }
    }
  }
  const fullSectionDiagonal = Math.hypot(
    geometry.beltWidth,
    geometry.beltThickness,
  );
  assert.ok(minimumNonAdjacentClearance > fullSectionDiagonal * 2);
  near(geometry.leftVerticalFront.z, 0, 0, 'left front leaf plane');
  near(geometry.rightVerticalFront.z, 0, 0, 'right front leaf plane');
  near(
    Math.abs(geometry.rearReturnDepth),
    geometry.verticalRadius * 2,
    0,
    'rear return separation',
  );
  disposeModel(model.root);
});

test('movement 243 applies one no-slip belt speed and the exact pulley ratios', () => {
  const model = createMovementModel(catalog.movements[242]);
  const {
    geometry,
    stateAtInputAngle,
    stateAtTime,
    transmission,
  } = model.root.userData;

  near(transmission.leftVerticalAngularSpeedToDriver, 35 / 24, 0,
    'left vertical speed ratio');
  near(transmission.rightVerticalAngularSpeedToDriver, 35 / 24, 0,
    'right vertical speed ratio');
  near(transmission.guideAngularSpeedToDriver, -28 / 15, 3e-16,
    'guide idler speed ratio');
  assert.equal(transmission.guideIdlersChangeDirectionNotBeltSpeed, true);

  for (let sample = 0; sample <= 4096; sample += 1) {
    const inputAngle = FULL_TURN * 12 * sample / 4096;
    const state = stateAtInputAngle(inputAngle);
    near(state.beltDistance, inputAngle * geometry.driverRadius, 2e-14,
      `belt travel at sample ${sample}`);
    near(
      state.leftVerticalAngle,
      inputAngle * geometry.driverRadius / geometry.verticalRadius,
      3e-14,
      `left vertical angle at sample ${sample}`,
    );
    near(state.rightVerticalAngle, state.leftVerticalAngle, 0,
      `synchronized vertical outputs at sample ${sample}`);
    near(
      state.guideAngle,
      -inputAngle * geometry.driverRadius / geometry.guideRadius,
      3e-14,
      `guide angle at sample ${sample}`,
    );
    assert.ok(state.driverAngularSpeed > 0);
    assert.ok(state.verticalAngularSpeed > 0);
    assert.ok(state.guideAngularSpeed < 0);
    near(state.driverAngularSpeed * geometry.driverRadius,
      state.beltLinearSpeed, 0,
      `driver surface speed at sample ${sample}`);
    near(state.verticalAngularSpeed * geometry.verticalRadius,
      state.beltLinearSpeed, 0,
      `vertical surface speed at sample ${sample}`);
    near(-state.guideAngularSpeed * geometry.guideRadius,
      state.beltLinearSpeed, 0,
      `guide surface speed at sample ${sample}`);
  }
  const oneInputTurn = stateAtTime(geometry.cyclePeriod);
  near(oneInputTurn.driverAngle, FULL_TURN, 0,
    'one input revolution per authored cycle');
  near(oneInputTurn.leftVerticalAngle, FULL_TURN * 35 / 24, 2e-15,
    'vertical travel per input revolution');
  near(oneInputTurn.guideAngle, -FULL_TURN * 28 / 15, 2e-15,
    'guide travel per input revolution');
  disposeModel(model.root);
});

test('movement 243 markers cross every free-span-to-pulley join at constant speed', () => {
  const model = createMovementModel(catalog.movements[242]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const frameAtDistance = blocks.belt.userData.frameAtDistance;
  const step = 1e-5;

  for (const segment of geometry.beltSegments) {
    const distance = segment.endDistance;
    const before = frameAtDistance(distance - step);
    const boundary = frameAtDistance(distance);
    const after = frameAtDistance(distance + step);
    const derivative = after.point.clone().sub(before.point)
      .divideScalar(2 * step);
    near(derivative.length(), 1, 3e-10,
      `constant arclength speed at ${segment.role}`);
    assert.ok(
      derivative.distanceTo(boundary.tangent) < 7e-6,
      `continuous marker direction at ${segment.role}`,
    );
  }

  for (let sample = 0; sample <= 1024; sample += 1) {
    const time = geometry.cyclePeriod * 9 * sample / 1024;
    model.update(time);
    const distance = stateAtTime(time).beltDistance;
    blocks.belt.userData.markers.forEach((marker, index) => {
      const expected = frameAtDistance(
        distance + geometry.beltLength * index / geometry.markerCount,
      );
      vectorNear(marker.position, expected.point, 2e-14,
        `marker ${index} position at runtime sample ${sample}`);
      vectorNear(marker.userData.tangent, expected.tangent, 2e-14,
        `marker ${index} tangent at runtime sample ${sample}`);
      assert.equal(marker.userData.segmentIndex, expected.segmentIndex);
      assert.equal(marker.userData.pathRole, expected.role);
    });
  }
  disposeModel(model.root);
});

test('movement 243 renderer binds all five pulleys and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[242]);
  const {
    animationTiming,
    blocks,
    geometry,
    stateAtTime,
  } = model.root.userData;
  vectorNear(blocks.driver.userData.axis, Z_AXIS, 0, 'driver shaft axis');
  vectorNear(blocks.leftGuide.userData.axis, Z_AXIS, 0, 'left guide axis');
  vectorNear(blocks.rightGuide.userData.axis, Z_AXIS, 0, 'right guide axis');
  vectorNear(blocks.leftVertical.userData.axis, Y_AXIS, 0,
    'left vertical output axis');
  vectorNear(blocks.rightVertical.userData.axis, Y_AXIS, 0,
    'right vertical output axis');

  for (let sample = 0; sample <= 1024; sample += 1) {
    const time = geometry.cyclePeriod * 6 * sample / 1024;
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.driver.userData.rotor.rotation.z, state.driverAngle, 2e-15,
      `rendered driver angle at sample ${sample}`);
    near(blocks.leftGuide.userData.rotor.rotation.z, state.guideAngle, 2e-15,
      `rendered left guide angle at sample ${sample}`);
    near(blocks.rightGuide.userData.rotor.rotation.z, state.guideAngle, 2e-15,
      `rendered right guide angle at sample ${sample}`);
    near(blocks.leftVertical.userData.rotor.rotation.z,
      state.leftVerticalAngle, 2e-15,
      `rendered left output angle at sample ${sample}`);
    near(blocks.rightVertical.userData.rotor.rotation.z,
      state.rightVerticalAngle, 2e-15,
      `rendered right output angle at sample ${sample}`);
    near(blocks.driverShaft.userData.rotor.rotation.z,
      state.driverAngle, 2e-15,
      `rendered input-shaft angle at sample ${sample}`);
    near(blocks.leftVerticalShaft.userData.rotor.rotation.z,
      state.leftVerticalAngle, 2e-15,
      `rendered left shaft angle at sample ${sample}`);
    near(blocks.rightVerticalShaft.userData.rotor.rotation.z,
      state.rightVerticalAngle, 2e-15,
      `rendered right shaft angle at sample ${sample}`);
    for (const contact of Object.values(model.root.userData.contacts)) {
      assert.equal(contact.active, true);
      near(contact.surfaceSpeedAlongBand, state.beltLinearSpeed, 0,
        `rendered no-slip contact at sample ${sample}`);
    }
  }
  near(animationTiming.authoredCyclePeriod, 4, 0,
    'authored cycle duration');
  near(animationTiming.targetCycleDuration, 2, 0,
    'display cycle duration');
  assertReadableTiming(animationTiming);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model289.root);
});
