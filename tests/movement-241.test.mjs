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

function pointInsidePolygon(point, polygon) {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1
  ) {
    const first = polygon[index];
    const second = polygon[previous];
    if (
      (first.y > point.y) !== (second.y > point.y)
      && point.x < (second.x - first.x) * (point.y - first.y)
        / (second.y - first.y) + first.x
    ) inside = !inside;
  }
  return inside;
}

function pointSegmentDistance(point, start, end) {
  const delta = end.clone().sub(start);
  const coordinate = delta.lengthSq() > 0
    ? THREE.MathUtils.clamp(
      point.clone().sub(start).dot(delta) / delta.lengthSq(),
      0,
      1,
    )
    : 0;
  return start.clone().addScaledVector(delta, coordinate).distanceTo(point);
}

function orientation(first, second, third) {
  return (second.x - first.x) * (third.y - first.y)
    - (second.y - first.y) * (third.x - first.x);
}

function segmentsProperlyCross(firstStart, firstEnd, secondStart, secondEnd) {
  const firstSide = orientation(firstStart, firstEnd, secondStart);
  const secondSide = orientation(firstStart, firstEnd, secondEnd);
  const thirdSide = orientation(secondStart, secondEnd, firstStart);
  const fourthSide = orientation(secondStart, secondEnd, firstEnd);
  return firstSide * secondSide < -1e-14
    && thirdSide * fourthSide < -1e-14;
}

function assertPolygonsDoNotOverlap(first, second, message) {
  for (const point of first) {
    const clearance = Math.min(...second.map((start, index) => (
      pointSegmentDistance(point, start, second[(index + 1) % second.length])
    )));
    assert.ok(
      !pointInsidePolygon(point, second) || clearance <= 1e-7,
      `${message}: first polygon penetrates by ${clearance}`,
    );
  }
  for (const point of second) {
    const clearance = Math.min(...first.map((start, index) => (
      pointSegmentDistance(point, start, first[(index + 1) % first.length])
    )));
    assert.ok(
      !pointInsidePolygon(point, first) || clearance <= 1e-7,
      `${message}: second polygon penetrates by ${clearance}`,
    );
  }
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      assert.equal(
        segmentsProperlyCross(
          first[firstIndex],
          first[(firstIndex + 1) % first.length],
          second[secondIndex],
          second[(secondIndex + 1) % second.length],
        ),
        false,
        `${message}: polygon boundaries cross`,
      );
    }
  }
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

test('movement 241 is one continuous single-tooth driver, wheel A, and holding click', () => {
  const movement = catalog.movements[240];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 241);
  assert.equal(movement.number, '241');
  assert.equal(movement.title, 'Continuous Single-Tooth Ratchet Index');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'continuous-single-curved-tooth-driver-with-nineteen-tooth-ratchet-and-holding-click',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'one-continuously-counterclockwise-curved-tooth-rotor-indexes-wheel-A-clockwise-while-an-upper-gravity-click-holds-the-dwell',
  );
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.driverDirection, 'counterclockwise-continuous');
  assert.equal(transmission.outputDirection, 'clockwise-intermittent');
  assert.equal(transmission.outputTeeth, 19);
  assert.equal(transmission.outputTeethPerDriverRevolution, 1);
  assert.equal(transmission.driverRevolutionsPerOutputTooth, 1);
  near(transmission.outputToDriverAverageRatio, -1 / 19, 0,
    'average transmission ratio');
  assert.equal(transmission.holdingClickPresent, true);
  assert.equal(transmission.holdingClickReseatsAtPitchBoundary, true);
  assert.equal(transmission.holdingClickUsesIdealRigidImpact, true);
  assert.equal(blocks.driver.parent, model.root);
  assert.equal(blocks.outputWheel.parent, model.root);
  assert.equal(blocks.holdingClick.parent, model.root);
  assert.equal(
    blocks.driver.userData.role,
    'continuous-counterclockwise-single-tooth-driver',
  );
  assert.equal(
    blocks.driverTooth.userData.role,
    'one-source-shaped-curved-driving-tooth',
  );
  assert.equal(
    blocks.outputWheel.userData.role,
    'nineteen-tooth-clockwise-indexed-wheel-A',
  );
  assert.equal(
    blocks.holdingClick.userData.role,
    'upper-curved-gravity-holding-click',
  );
  disposeModel(model.root);
});

test('movement 241 preserves the measured unavailable source plate', () => {
  const model = createMovementModel(catalog.movements[240]);
  const {
    geometry,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.plate241;

  assert.equal(sourceReference.officialDescription, catalog.movements[240].description);
  assert.deepEqual(plate.rasterOutputCenter.toArray(), [315, 253]);
  assert.deepEqual(plate.rasterDriverCenter.toArray(), [127, 350]);
  assert.deepEqual(plate.rasterDriverToothTip.toArray(), [190, 318]);
  assert.deepEqual(plate.rasterHoldingPivot.toArray(), [118, 159]);
  assert.deepEqual(plate.rasterHoldingNose.toArray(), [285, 111]);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.inferredOutputToothCount, 19);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.match(plate.inferredTopology, /one continuous one-tooth lower driver/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 61,
    edition: 21,
    illustrationPage: 60,
    publicationYear: 1908,
  });
  vectorNear(plate.sourceMappedDriverCenter, geometry.driverCenter, 0,
    'source-mapped driver center');
  vectorNear(
    plate.reconstructedHoldingPivot,
    geometry.holdingPivot,
    0,
    'reconstructed holding pivot',
  );
  assert.ok(plate.holdingPivotClosureAdjustment.length() < 0.071);
  const source = stateAtTime(0);
  assert.equal(source.sourcePose, true);
  assert.equal(source.driverEngaged, true);
  assert.equal(source.stage, 'single-curved-tooth-indexes-wheel-A-clockwise');
  near(source.driverAngle, THREE.MathUtils.degToRad(27), 2e-15,
    'engraved driver angle');
  const modeledTip = geometry.driverCenter.clone().add(
    rotate(
      new THREE.Vector2(geometry.driverContactRadius, 0),
      source.driverAngle,
    ),
  );
  vectorNear(modeledTip, plate.sourceMappedDriverToothTip, 0.002,
    'engraved single-tooth tip');
  vectorNear(source.driverContact.point, modeledTip, 2e-15,
    'source-pose driver contact');
  assert.ok(source.holdingContact.point.distanceTo(
    plate.sourceMappedHoldingNose,
  ) < 0.11);
  disposeModel(model.root);
});

test('movement 241 reconstructs nineteen asymmetric three-face teeth', () => {
  const model = createMovementModel(catalog.movements[240]);
  const { blocks, geometry } = model.root.userData;

  assert.equal(blocks.outputWheel.userData.teeth, 19);
  assert.equal(geometry.localProfilePoints.length, 57);
  assert.equal(geometry.localProfileEdges.length, 57);
  assert.equal(
    geometry.localProfileEdges.filter(({ type }) => type === 'rising-ramp').length,
    19,
  );
  assert.equal(
    geometry.localProfileEdges.filter(({ type }) => type === 'short-tip').length,
    19,
  );
  assert.equal(
    geometry.localProfileEdges.filter(({ type }) => (
      type === 'radial-lock-face'
    )).length,
    19,
  );
  near(geometry.outputPitch, FULL_TURN / 19, 0, 'nineteen-tooth pitch');
  vectorNear(
    blocks.outputWheel.userData.axis,
    new THREE.Vector3(0, 0, 1),
    0,
    'wheel-A axis',
  );
  for (let toothIndex = 0; toothIndex < 19; toothIndex += 1) {
    const rootPoint = geometry.localProfilePoints[toothIndex * 3];
    const outerStart = geometry.localProfilePoints[toothIndex * 3 + 1];
    const outerEnd = geometry.localProfilePoints[toothIndex * 3 + 2];
    near(rootPoint.length(), geometry.outputRootRadius, 3e-16,
      `tooth ${toothIndex} root radius`);
    near(outerStart.length(), geometry.outputOuterRadius, 4e-16,
      `tooth ${toothIndex} outer-start radius`);
    near(outerEnd.length(), geometry.outputOuterRadius, 4e-16,
      `tooth ${toothIndex} outer-end radius`);
    assert.ok(rootPoint.distanceTo(outerStart) > outerStart.distanceTo(outerEnd));
  }
  assert.ok(geometry.outputOuterRadius > geometry.outputRootRadius);
  disposeModel(model.root);
});

test('movement 241 maintains exact driver and holding-click contact in 32,769 states', () => {
  const model = createMovementModel(catalog.movements[240]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  let driverContactStates = 0;
  let dwellStates = 0;
  let maximumDriverNormalError = 0;
  let maximumHoldingNormalError = 0;
  let previousDriverAngle = -Infinity;
  let previousOutputAngle = Infinity;
  const holdingFaces = new Set();

  for (let index = 0; index <= 32768; index += 1) {
    const state = stateAtCycleCoordinate(index / 32768);
    assert.ok(state.driverAngle >= previousDriverAngle);
    assert.ok(state.outputAngle <= previousOutputAngle + 2e-15);
    previousDriverAngle = state.driverAngle;
    previousOutputAngle = state.outputAngle;
    assert.ok(state.holdingContact);
    holdingFaces.add(state.holdingContact.edge.type);
    maximumHoldingNormalError = Math.max(
      maximumHoldingNormalError,
      Math.abs(state.holdingContact.normalVelocityError),
    );
    near(state.holdingContact.normalClearance, 0, 0,
      'holding-click normal clearance');
    if (state.driverEngaged) {
      driverContactStates += 1;
      assert.ok(state.driverContact);
      const renderedTip = geometry.driverCenter.clone().add(
        rotate(
          new THREE.Vector2(geometry.driverContactRadius, 0),
          state.driverAngle,
        ),
      );
      vectorNear(state.driverContact.point, renderedTip, 3e-15,
        'single-tooth contact tip');
      assert.ok(state.driverContact.toothFaceCoordinate >= -2e-14);
      assert.ok(state.driverContact.toothFaceCoordinate <= 1 + 2e-14);
      maximumDriverNormalError = Math.max(
        maximumDriverNormalError,
        Math.abs(state.driverContact.normalVelocityError),
      );
    } else {
      dwellStates += 1;
      assert.equal(state.driverContact, null);
      assert.equal(state.outputAngularSpeed, 0);
      assert.equal(state.outputAngularAcceleration, 0);
      near(
        state.outputAngle,
        -geometry.outputPitch,
        2e-15,
        'wheel-A dwell angle',
      );
    }
  }
  assert.ok(driverContactStates > 3600);
  assert.ok(dwellStates > 29000);
  assert.ok(maximumDriverNormalError < 8e-15);
  assert.ok(maximumHoldingNormalError < 8e-15);
  assert.deepEqual(
    [...holdingFaces].sort(),
    ['radial-lock-face', 'rising-ramp', 'short-tip'],
  );
  disposeModel(model.root);
});

test('movement 241 advances exactly one pitch and clears for the long dwell', () => {
  const model = createMovementModel(catalog.movements[240]);
  const {
    driverContactAtProgress,
    geometry,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const start = stateAtCycleCoordinate(0);
  const separation = stateAtCycleCoordinate(geometry.engagementFraction);
  const end = stateAtCycleCoordinate(1);

  near(start.outputAngle, 0, 0, 'wheel-A entry angle');
  near(separation.outputAngle, -geometry.outputPitch, 2e-15,
    'wheel-A separation angle');
  near(end.outputAngle, -geometry.outputPitch, 2e-15,
    'wheel-A one-cycle angle');
  near(end.driverAngle - start.driverAngle, FULL_TURN, 2e-15,
    'one continuous driver revolution');
  near(end.outputPitchesAdvanced - start.outputPitchesAdvanced, 1, 2e-15,
    'one output tooth per driver revolution');
  assert.ok(1 - geometry.engagementFraction > 0.88);
  const entry = driverContactAtProgress(0);
  const middle = driverContactAtProgress(0.5);
  const exit = driverContactAtProgress(1);
  near(entry.contactRadius, geometry.outputOuterRadius, 3e-15,
    'single tooth enters at outer radius');
  near(exit.contactRadius, geometry.outputOuterRadius, 3e-15,
    'single tooth exits at outer radius');
  assert.ok(middle.contactRadius < entry.contactRadius);
  assert.ok(middle.contactRadius > geometry.outputRootRadius);
  near(exit.outputAngle - entry.outputAngle, -geometry.outputPitch, 2e-15,
    'fixed tooth sweeps one output face pitch');
  assert.ok(entry.outputAngularDerivative < 0);
  assert.ok(middle.outputAngularDerivative < entry.outputAngularDerivative);
  near(
    driverContactAtProgress(0.25).contactRadius,
    driverContactAtProgress(0.75).contactRadius,
    4e-15,
    'source-symmetric tooth-tip orbit',
  );
  disposeModel(model.root);
});

test('movement 241 analytic output and click derivatives match finite differences', () => {
  const model = createMovementModel(catalog.movements[240]);
  const { geometry, stateAtTime } = model.root.userData;
  const delta = 1e-5;
  for (const engagementProgress of [0.08, 0.2, 0.4, 0.6, 0.8, 0.94]) {
    const coordinate = geometry.engagementFraction * engagementProgress;
    const time = (coordinate - geometry.initialCycleCoordinate)
      * geometry.cyclePeriod;
    const before = stateAtTime(time - delta);
    const state = stateAtTime(time);
    const after = stateAtTime(time + delta);
    const outputSpeed = (after.outputAngle - before.outputAngle) / (2 * delta);
    const outputAcceleration = (
      after.outputAngle - 2 * state.outputAngle + before.outputAngle
    ) / delta ** 2;
    near(outputSpeed, state.outputAngularSpeed, 2e-8,
      'wheel-A angular speed finite difference');
    near(outputAcceleration, state.outputAngularAcceleration, 2e-4,
      'wheel-A angular acceleration finite difference');
    const clickSpeed = (
      after.holdingAngleDelta - before.holdingAngleDelta
    ) / (2 * delta);
    const clickAcceleration = (
      after.holdingAngleDelta
      - 2 * state.holdingAngleDelta
      + before.holdingAngleDelta
    ) / delta ** 2;
    near(clickSpeed, state.holdingAngularSpeed, 2e-8,
      'holding-click angular speed finite difference');
    near(clickAcceleration, state.holdingAngularAcceleration, 2e-4,
      'holding-click angular acceleration finite difference');
  }
  disposeModel(model.root);
});

test('movement 241 renderer has overlapping contact planes and collision-free outlines', () => {
  const model = createMovementModel(catalog.movements[240]);
  const {
    blocks,
    geometry,
    stateAtCycleCoordinate,
    stateAtTime,
  } = model.root.userData;
  const outputRange = [-geometry.outputDepth / 2, geometry.outputDepth / 2];
  for (const contactBody of [blocks.driverTooth, blocks.holdingClickBody]) {
    contactBody.geometry.computeBoundingBox();
    const range = [
      contactBody.position.z + contactBody.geometry.boundingBox.min.z,
      contactBody.position.z + contactBody.geometry.boundingBox.max.z,
    ];
    assert.ok(Math.max(range[0], outputRange[0]) < Math.min(
      range[1],
      outputRange[1],
    ));
  }
  assert.ok(
    geometry.driverCenter.length()
      - geometry.driverBodyRadius
      - geometry.outputOuterRadius
    > 0.17,
  );

  for (let sample = 0; sample <= 4096; sample += 1) {
    const coordinate = sample / 4096;
    const state = stateAtCycleCoordinate(coordinate);
    const outputPolygon = geometry.localProfilePoints.map((point) => (
      rotate(point, state.outputAngle)
    ));
    const driverPolygon = geometry.driverToothOutlinePoints.map((point) => (
      rotate(point, state.driverAngle).add(geometry.driverCenter)
    ));
    const holdingPolygon = geometry.holdingClickOutlinePoints.map((point) => (
      rotate(point, state.holdingAngleDelta).add(geometry.holdingPivot)
    ));
    assertPolygonsDoNotOverlap(
      driverPolygon,
      outputPolygon,
      `driver/output clearance at sample ${sample}`,
    );
    assertPolygonsDoNotOverlap(
      holdingPolygon,
      outputPolygon,
      `holding-click/output clearance at sample ${sample}`,
    );
  }

  for (let sample = 0; sample <= 512; sample += 1) {
    const time = geometry.cyclePeriod * sample / 512;
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.driver.userData.rotor.rotation.z, state.driverAngle, 2e-15,
      'rendered continuous driver angle');
    near(blocks.outputWheel.userData.rotor.rotation.z, state.outputAngle, 2e-15,
      'rendered wheel-A angle');
    near(blocks.holdingClick.rotation.z, state.holdingAngleDelta, 2e-15,
      'rendered holding-click angle');
    assert.equal(blocks.driverContactMarker.visible, state.driverEngaged);
    assert.equal(blocks.holdingContactMarker.visible, true);
    const renderedDriverContact = model.root.userData.contacts.driverToWheelA;
    assert.equal(renderedDriverContact !== null, state.driverContact !== null);
    if (state.driverContact) {
      vectorNear(renderedDriverContact.point, state.driverContact.point, 2e-15,
        'rendered single-tooth contact');
    }
    vectorNear(
      model.root.userData.contacts.holdingClickToWheelA.point,
      state.holdingContact.point,
      2e-15,
      'rendered holding-click contact',
    );
  }
  disposeModel(model.root);
});

test('movement 241 closes after nineteen indexes and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[240]);
  const { geometry, stateAtCycleCoordinate, transmission } = model.root.userData;
  const source = stateAtCycleCoordinate(geometry.initialCycleCoordinate);
  for (let cycle = 1; cycle <= 19; cycle += 1) {
    const state = stateAtCycleCoordinate(
      geometry.initialCycleCoordinate + cycle,
    );
    near(state.driverAngle - source.driverAngle, cycle * FULL_TURN, 5e-14,
      `continuous driver closure ${cycle}`);
    near(state.outputAngle - source.outputAngle, -cycle * geometry.outputPitch,
      3e-14, `one-pitch output advance ${cycle}`);
    near(state.holdingAngleDelta, source.holdingAngleDelta, 3e-14,
      `holding-click phase closure ${cycle}`);
  }
  const closure = stateAtCycleCoordinate(geometry.initialCycleCoordinate + 19);
  near(closure.outputAngle - source.outputAngle, -FULL_TURN, 4e-14,
    'nineteen indexes close wheel A');
  near(transmission.outputToDriverAverageRatio, -1 / 19, 0,
    'closed average ratio');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model289.root);
});
