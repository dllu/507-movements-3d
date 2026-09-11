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

function rotate(vector, angle) {
  return new THREE.Vector2(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  );
}

function polylineLength(points) {
  return points.slice(1).reduce(
    (length, point, index) => length + point.distanceTo(points[index]),
    0,
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

test('movement 242 is one lever-contracted constant-length crane band brake', () => {
  const movement = catalog.movements[241];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 242);
  assert.equal(movement.number, '242');
  assert.equal(movement.title, 'Lever-Contracted Crane Band Brake');
  assert.equal(movement.category, 'Ropes, belts & pulleys');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'lever-contracted-constant-length-crane-band-brake',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'fixed-upper-band-end-and-pivoted-short-arm-draw-the-constant-length-strap-tight-around-a-crane-brake-wheel',
  );
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.brakeType, 'external-contracting-band-brake');
  assert.equal(transmission.bandCirculates, false);
  assert.equal(transmission.upperBandEndAnchoredToFulcrum, true);
  assert.equal(transmission.lowerBandEndMovesWithLever, true);
  assert.equal(transmission.wheelRevolutionsPerDemonstrationCycle, 1);
  assert.match(transmission.driveAssumption, /external crane or hoist load/);
  assert.equal(
    blocks.brakeBand.userData.role,
    'constant-length-contracting-brake-strap',
  );
  assert.equal(
    blocks.upperAnchorLink.userData.role,
    'rigid-upper-band-end-anchor-link',
  );
  assert.equal(
    blocks.leverShortArm.userData.role,
    'rigid-short-arm-to-lower-band-end',
  );
  assert.equal(
    blocks.leverHandle.userData.role,
    'long-hand-operated-brake-lever',
  );
  assert.equal(blocks.leverFulcrumShaft.userData.fixedPivot, true);
  disposeModel(model.root);
});

test('movement 242 preserves the measured unavailable source plate', () => {
  const movement = catalog.movements[241];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceReference,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const plate = sourceReference.plate242;

  assert.equal(sourceReference.officialDescription, movement.description);
  assert.deepEqual(plate.rasterWheelCenter.toArray(), [170, 270]);
  assert.deepEqual(plate.rasterUpperBandEnd.toArray(), [352, 259]);
  assert.deepEqual(plate.rasterLowerBandEnd.toArray(), [338, 337]);
  assert.deepEqual(plate.rasterFulcrum.toArray(), [384, 301]);
  assert.deepEqual(plate.rasterHandleEnd.toArray(), [516, 275]);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.match(plate.inferredTopology, /one open contracting strap/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 61,
    edition: 21,
    illustrationPage: 60,
    publicationYear: 1908,
  });
  vectorNear(geometry.wheelCenter, new THREE.Vector2(0, 0), 0,
    'source-mapped wheel center');
  vectorNear(geometry.upperBandEnd, new THREE.Vector2(2.002, 0.121), 1e-15,
    'source-mapped upper strap end');
  vectorNear(geometry.sourceLowerEnd, new THREE.Vector2(1.848, -0.737), 1e-15,
    'source-mapped lower strap end');
  vectorNear(geometry.leverFulcrum, new THREE.Vector2(2.354, -0.341), 1e-15,
    'source-mapped fixed fulcrum');
  vectorNear(geometry.sourceHandlePosition, new THREE.Vector2(3.806, -0.055), 1e-15,
    'source-mapped handle end');

  const source = stateAtCycleCoordinate(0);
  assert.equal(source.sourcePose, true);
  assert.equal(source.stage, 'released-band-wheel-turning');
  near(source.leverAngleDelta, 0, 0, 'source lever angle');
  vectorNear(source.lowerBandEnd, geometry.sourceLowerEnd, 0,
    'source lower strap end');
  vectorNear(source.handlePosition, geometry.sourceHandlePosition, 0,
    'source handle end');
  disposeModel(model.root);
});

test('movement 242 keeps one major-wrap strap tangent and constant-length', () => {
  const model = createMovementModel(catalog.movements[241]);
  const {
    geometry,
    stateAtCycleCoordinate,
    transmission,
  } = model.root.userData;

  let maximumLengthError = 0;
  let minimumCenterlineRadius = Infinity;
  for (let sample = 0; sample <= 4096; sample += 1) {
    const state = stateAtCycleCoordinate(sample / 4096);
    const path = state.bandPath;
    const firstArcPoint = path.points2D[1];
    const lastArcPoint = path.points2D.at(-2);
    assert.equal(path.points2D.length, geometry.bandArcSamples + 2);
    vectorNear(path.points2D[0], geometry.upperBandEnd, 0,
      `fixed upper endpoint at sample ${sample}`);
    vectorNear(path.points2D.at(-1), state.lowerBandEnd, 0,
      `moving lower endpoint at sample ${sample}`);
    near(polylineLength(path.points2D), path.length, 3e-14,
      `reported strap length at sample ${sample}`);
    maximumLengthError = Math.max(
      maximumLengthError,
      Math.abs(path.length - geometry.constantBandLength),
    );
    minimumCenterlineRadius = Math.min(
      minimumCenterlineRadius,
      path.minimumCenterlineRadius,
    );
    assert.ok(path.wrapAngle > Math.PI * 1.49,
      `major wrap retained at sample ${sample}`);
    near(
      geometry.upperBandEnd.clone().sub(firstArcPoint).dot(firstArcPoint),
      0,
      3e-15,
      `upper exact tangent at sample ${sample}`,
    );
    near(
      state.lowerBandEnd.clone().sub(lastArcPoint).dot(lastArcPoint),
      0,
      3e-15,
      `lower exact tangent at sample ${sample}`,
    );
  }
  assert.ok(maximumLengthError < 1.2e-10);
  near(minimumCenterlineRadius, geometry.bandContactRadius, 3e-15,
    'minimum strap centerline radius');
  near(transmission.constantBandLength, geometry.constantBandLength, 0,
    'transmission strap length');

  const released = stateAtCycleCoordinate(0);
  const applied = stateAtCycleCoordinate(0.45);
  assert.ok(released.bandPath.slackLength > 0.088);
  assert.ok(released.bandPath.slackAmplitude > 0.037);
  near(applied.bandPath.slackLength, 0, 0, 'applied strap slack');
  near(applied.bandPath.slackAmplitude, 0, 0, 'applied strap bow');
  for (const point of applied.bandPath.points2D.slice(1, -1)) {
    near(point.length(), geometry.bandContactRadius, 3e-15,
      'applied strap is seated concentrically');
  }
  near(
    THREE.MathUtils.radToDeg(applied.bandPath.wrapAngle),
    transmission.appliedWrapAngleDegrees,
    1e-13,
    'applied wrap angle',
  );
  disposeModel(model.root);
});

test('movement 242 rigid lever draws the two strap ends together', () => {
  const model = createMovementModel(catalog.movements[241]);
  const {
    geometry,
    stateAtCycleCoordinate,
    transmission,
  } = model.root.userData;

  let priorSeparation = stateAtCycleCoordinate(geometry.releasedEnd)
    .endpointSeparation;
  for (let sample = 1; sample <= 1024; sample += 1) {
    const phase = geometry.releasedEnd
      + (geometry.applicationEnd - geometry.releasedEnd) * sample / 1024;
    const state = stateAtCycleCoordinate(phase);
    assert.ok(state.endpointSeparation < priorSeparation,
      `strap endpoints approach at application sample ${sample}`);
    priorSeparation = state.endpointSeparation;
    near(
      state.lowerBandEnd.distanceTo(geometry.leverFulcrum),
      geometry.lowerArmLength,
      3e-15,
      `short-arm rigidity at sample ${sample}`,
    );
    near(
      state.handlePosition.distanceTo(geometry.leverFulcrum),
      geometry.handleLength,
      3e-15,
      `handle rigidity at sample ${sample}`,
    );
    vectorNear(
      state.lowerBandEnd,
      geometry.leverFulcrum.clone().add(
        rotate(geometry.lowerArmLocal, state.leverAngleDelta),
      ),
      2e-15,
      `short-arm endpoint at sample ${sample}`,
    );
  }
  const released = stateAtCycleCoordinate(0);
  const applied = stateAtCycleCoordinate(geometry.applicationEnd);
  assert.ok(applied.handlePosition.y < released.handlePosition.y);
  assert.ok(applied.lowerBandEnd.y > released.lowerBandEnd.y);
  assert.ok(applied.lowerBandEnd.x < released.lowerBandEnd.x);
  near(
    released.endpointSeparation,
    transmission.endpointSeparationReleased,
    0,
    'released endpoint separation',
  );
  near(
    applied.endpointSeparation,
    transmission.endpointSeparationApplied,
    0,
    'applied endpoint separation',
  );
  assert.ok(applied.endpointSeparation < released.endpointSeparation - 0.2);
  near(
    geometry.handleLength / geometry.lowerArmLength,
    transmission.leverMechanicalAdvantage,
    0,
    'lever mechanical advantage',
  );
  near(
    geometry.upperBandEnd.distanceTo(geometry.leverFulcrum),
    geometry.upperAnchorLength,
    0,
    'fixed upper anchor-link length',
  );
  disposeModel(model.root);
});

test('movement 242 brake stops, holds, and releases the externally driven wheel', () => {
  const model = createMovementModel(catalog.movements[241]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  const released = stateAtCycleCoordinate(0);
  const braking = stateAtCycleCoordinate(0.4);
  const stopped = stateAtCycleCoordinate(0.55);
  const resuming = stateAtCycleCoordinate(0.7);
  const freeAgain = stateAtCycleCoordinate(0.8);

  assert.equal(released.stage, 'released-band-wheel-turning');
  assert.equal(
    braking.stage,
    'lever-pulled-down-band-taking-load-and-wheel-decelerating',
  );
  assert.equal(stopped.stage, 'contracted-band-holds-brake-wheel-stopped');
  assert.equal(
    resuming.stage,
    'lever-released-band-unloads-and-wheel-resumes',
  );
  assert.equal(freeAgain.stage, 'lever-returning-with-band-slack');
  near(released.wheelAngularSpeed, geometry.freeWheelAngularSpeed, 0,
    'released wheel speed');
  near(braking.wheelAngularSpeed, geometry.freeWheelAngularSpeed / 2, 2e-15,
    'mid-braking wheel speed');
  near(stopped.wheelAngularSpeed, 0, 0, 'held wheel speed');
  near(resuming.wheelAngularSpeed, geometry.freeWheelAngularSpeed / 2, 3e-15,
    'mid-release wheel speed');
  near(freeAgain.wheelAngularSpeed, geometry.freeWheelAngularSpeed, 0,
    'restored wheel speed');
  assert.equal(stopped.wheelStopped, true);
  near(
    stateAtCycleCoordinate(geometry.appliedHoldEnd).wheelAngle,
    stateAtCycleCoordinate(geometry.applicationEnd).wheelAngle,
    0,
    'wheel remains fixed throughout applied hold',
  );
  let previousAngle = stateAtCycleCoordinate(0).wheelAngle;
  for (let sample = 1; sample <= 4096; sample += 1) {
    const angle = stateAtCycleCoordinate(sample / 4096).wheelAngle;
    assert.ok(angle >= previousAngle - 1e-14,
      `wheel never reverses at sample ${sample}`);
    previousAngle = angle;
  }
  near(stateAtCycleCoordinate(1).wheelAngle - released.wheelAngle, FULL_TURN,
    2e-15, 'one demonstration-cycle wheel revolution');
  disposeModel(model.root);
});

test('movement 242 analytic velocities and accelerations match finite differences', () => {
  const model = createMovementModel(catalog.movements[241]);
  const { geometry, stateAtTime } = model.root.userData;
  const step = 1e-5;
  for (const phase of [0.2, 0.28, 0.38, 0.42, 0.7, 0.8, 0.9]) {
    const time = phase * geometry.cyclePeriod;
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    const leverSpeed = (after.leverAngleDelta - before.leverAngleDelta)
      / (2 * step);
    const leverAcceleration = (
      after.leverAngularSpeed - before.leverAngularSpeed
    ) / (2 * step);
    const wheelSpeed = (after.wheelAngle - before.wheelAngle) / (2 * step);
    const wheelAcceleration = (
      after.wheelAngularSpeed - before.wheelAngularSpeed
    ) / (2 * step);
    near(leverSpeed, state.leverAngularSpeed, 7e-11,
      `lever speed finite difference at phase ${phase}`);
    near(leverAcceleration, state.leverAngularAcceleration, 2e-11,
      `lever acceleration finite difference at phase ${phase}`);
    near(wheelSpeed, state.wheelAngularSpeed, 7e-10,
      `wheel speed finite difference at phase ${phase}`);
    near(wheelAcceleration, state.wheelAngularAcceleration, 8e-9,
      `wheel acceleration finite difference at phase ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 242 renderer binds the rigid lever and non-circulating strap', () => {
  const model = createMovementModel(catalog.movements[241]);
  const {
    blocks,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const bandPositions = blocks.brakeBand.geometry.getAttribute('position');
  const wheelAxialRange = [-geometry.wheelDepth / 2, geometry.wheelDepth / 2];
  const bandAxialRange = [
    geometry.bandPlaneZ - geometry.bandDepth / 2,
    geometry.bandPlaneZ + geometry.bandDepth / 2,
  ];
  assert.ok(Math.max(wheelAxialRange[0], bandAxialRange[0])
    < Math.min(wheelAxialRange[1], bandAxialRange[1]));
  assert.equal(blocks.brakeBand.userData.isBrakeStrap, true);
  assert.equal(blocks.brakeBand.userData.noShadow, true);
  assert.equal(bandPositions.count, (geometry.bandArcSamples + 2) * 4);
  let movingBeltMarkerCount = 0;
  model.root.traverse((object) => {
    if (object.userData.markerIndex !== undefined) movingBeltMarkerCount += 1;
  });
  assert.equal(movingBeltMarkerCount, 0);

  for (let sample = 0; sample <= 512; sample += 1) {
    const time = geometry.cyclePeriod * sample / 512;
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    near(blocks.wheel.userData.rotor.rotation.z, state.wheelAngle, 2e-15,
      `rendered wheel angle at sample ${sample}`);
    near(blocks.wheelShaft.userData.rotor.rotation.z, state.wheelAngle, 2e-15,
      `rendered shaft angle at sample ${sample}`);
    near(blocks.lever.rotation.z, state.leverAngleDelta, 2e-15,
      `rendered lever angle at sample ${sample}`);
    const renderedLowerJoint = blocks.lowerEndpointJoint.getWorldPosition(
      new THREE.Vector3(),
    );
    vectorNear(
      new THREE.Vector2(renderedLowerJoint.x, renderedLowerJoint.y),
      state.lowerBandEnd,
      3e-15,
      `rendered lower strap joint at sample ${sample}`,
    );
    assert.equal(
      blocks.brakeBand.userData.centerlinePoints.length,
      geometry.bandArcSamples + 2,
    );
    blocks.brakeBand.userData.centerlinePoints.forEach((point, index) => {
      vectorNear(point, state.bandPath.points[index], 0,
        `rendered centerline point ${index} at sample ${sample}`);
    });
    let minimumRenderedRadius = Infinity;
    for (let index = 4; index < bandPositions.count - 4; index += 1) {
      minimumRenderedRadius = Math.min(
        minimumRenderedRadius,
        Math.hypot(bandPositions.getX(index), bandPositions.getY(index)),
      );
    }
    assert.ok(
      minimumRenderedRadius >= geometry.wheelRadius - 7e-8,
      `strap penetrates drum at sample ${sample}: ${minimumRenderedRadius}`,
    );
    const contact = model.root.userData.contacts.bandToBrakeWheel;
    assert.equal(contact.active, state.brakeEngagement > 0);
    near(contact.innerSurfaceClearance, 0, 3e-16,
      `strap/drum radial contact at sample ${sample}`);
    near(contact.normalForce, state.brakeNormalForce, 0,
      `rendered brake force at sample ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 242 closes exactly and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[241]);
  const {
    animationTiming,
    geometry,
    stateAtCycleCoordinate,
    stateAtTime,
  } = model.root.userData;
  const source = stateAtCycleCoordinate(0);
  for (let cycle = 1; cycle <= 8; cycle += 1) {
    const state = stateAtCycleCoordinate(cycle);
    near(state.wheelAngle - source.wheelAngle, cycle * FULL_TURN, 8e-15,
      `wheel closure ${cycle}`);
    near(state.leverAngleDelta, source.leverAngleDelta, 0,
      `lever closure ${cycle}`);
    vectorNear(state.lowerBandEnd, source.lowerBandEnd, 0,
      `lower strap endpoint closure ${cycle}`);
    near(state.bandPath.length, source.bandPath.length, 0,
      `strap closure ${cycle}`);
  }
  const timeClosure = stateAtTime(geometry.cyclePeriod);
  near(timeClosure.wheelAngle, FULL_TURN, 2e-15,
    'four-authored-second closure');
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
