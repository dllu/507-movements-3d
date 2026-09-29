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

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vector2Near(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function cross2(first, second) {
  return first.x * second.y - first.y * second.x;
}

function polygonAreaXZ(points) {
  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    twiceArea += current.x * next.z - current.z * next.x;
  }
  return Math.abs(twiceArea) / 2;
}

function closedPolylineLength(points) {
  let length = 0;
  for (let index = 0; index < points.length; index += 1) {
    length += points[index].distanceTo(points[(index + 1) % points.length]);
  }
  return length;
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

test('movement 246 is the adjustable parallelogram pantograph with A, B, and fixed C', () => {
  const movement = catalog.movements[245];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 246);
  assert.equal(movement.number, '246');
  assert.equal(movement.title, 'Adjustable 2:1 Pantograph');
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'adjustable-parallelogram-pantograph-with-two-to-one-homothety',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'fixed-slide-C-and-pencil-slide-A-extend-opposite-sides-of-a-four-bar-parallelogram-so-B-is-the-midpoint-of-C-A',
  );
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /two-to-one copy/);
  assert.equal(transmission.degreesOfFreedom, 2);
  assert.equal(transmission.drawingScaleFactor, 2);
  assert.equal(transmission.areaScaleFactor, 4);
  assert.equal(transmission.input, 'ivory-tracing-point-B');
  assert.equal(transmission.output, 'pencil-A');
  assert.equal(transmission.fixedPoint, 'C');
  assert.deepEqual(transmission.parallelogramVertices, ['B', 'U', 'R', 'L']);
  assert.equal(transmission.adjustableBySlidingAAndC, true);
  assert.equal(blocks.fixedPivot.userData.fixed, true);
  assert.equal(blocks.fixedPivot.userData.role,
    'fixed-point-C-and-rotatable-slide');
  assert.equal(blocks.tracerAssembly.userData.role, 'ivory-tracing-point-B');
  assert.equal(blocks.pencilAssembly.userData.role, 'adjustable-pencil-slide-A');
  disposeModel(model.root);
});

test('movement 246 preserves the measured source plate and available canvas reference', () => {
  const movement = catalog.movements[245];
  const model = createMovementModel(movement);
  const { sourceReference, stateAtTime } = model.root.userData;
  const plate = sourceReference.plate246;

  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.officialAnimationAvailable, true);
  assert.deepEqual(plate.rasterFixedPointC.toArray(), [65, 448]);
  assert.deepEqual(plate.rasterTracingPointB.toArray(), [109, 274]);
  assert.deepEqual(plate.rasterPencilSlideA.toArray(), [84, 96]);
  assert.deepEqual(plate.rasterUpperJoint.toArray(), [293, 190]);
  assert.deepEqual(plate.rasterLowerJoint.toArray(), [294, 356]);
  assert.deepEqual(plate.rasterRightJoint.toArray(), [492, 275]);
  assert.match(plate.sourceTopology, /parallelogram/);
  assert.match(plate.sourceTopology, /collinear adjustable arms/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 63,
    edition: 21,
    illustrationPage: 62,
    publicationYear: 1908,
  });
  const source = stateAtTime(0);
  assert.equal(source.sourcePose, true);
  assert.equal(source.scaleFactor, 2);
  assert.equal(source.areaScaleFactor, 4);
  disposeModel(model.root);
});

test('movement 246 preserves every rigid length, midpoint, and collinearity constraint', () => {
  const model = createMovementModel(catalog.movements[245]);
  const { geometry, solvePantographAtAngle } = model.root.userData;
  const C = geometry.fixedPointC;
  let maximumLengthError = 0;
  let maximumMidpointError = 0;
  let maximumCollinearityError = 0;
  let maximumClosureError = 0;

  for (let sample = 0; sample <= 65536; sample += 1) {
    const state = solvePantographAtAngle(FULL_TURN * 8 * sample / 65536);
    const A = state.pencilPosition;
    const B = state.tracerPosition;
    const L = state.lowerJoint;
    const R = state.rightJoint;
    const U = state.upperJoint;
    for (const [actual, expected] of [
      [B.distanceTo(U), geometry.parallelBarLength],
      [L.distanceTo(R), geometry.parallelBarLength],
      [C.distanceTo(L), geometry.parallelBarLength],
      [B.distanceTo(L), geometry.adjacentBarLength],
      [U.distanceTo(R), geometry.adjacentBarLength],
      [A.distanceTo(U), geometry.adjacentBarLength],
    ]) {
      maximumLengthError = Math.max(
        maximumLengthError,
        Math.abs(actual - expected),
      );
    }
    maximumMidpointError = Math.max(
      maximumMidpointError,
      B.distanceTo(C.clone().add(A).multiplyScalar(0.5)),
      L.distanceTo(C.clone().add(R).multiplyScalar(0.5)),
      U.distanceTo(A.clone().add(R).multiplyScalar(0.5)),
    );
    maximumCollinearityError = Math.max(
      maximumCollinearityError,
      Math.abs(cross2(L.clone().sub(C), R.clone().sub(C))),
      Math.abs(cross2(U.clone().sub(A), R.clone().sub(A))),
    );
    maximumClosureError = Math.max(
      maximumClosureError,
      state.parallelogramClosureResidual.length(),
    );
  }
  assert.ok(maximumLengthError < 1.4e-15);
  assert.ok(maximumMidpointError < 5e-16);
  assert.ok(maximumCollinearityError < 2.8e-15);
  assert.ok(maximumClosureError < 2.3e-16);
  disposeModel(model.root);
});

test('movement 246 pencil locus, velocity, acceleration, length, and area are exact 2:1 copies', () => {
  const model = createMovementModel(catalog.movements[245]);
  const { blocks, geometry, solvePantographAtAngle } = model.root.userData;
  const C = geometry.fixedPointC;

  for (let sample = 0; sample <= 32768; sample += 1) {
    const state = solvePantographAtAngle(FULL_TURN * 5 * sample / 32768);
    vector2Near(
      state.pencilPosition.clone().sub(C),
      state.tracerPosition.clone().sub(C).multiplyScalar(2),
      1e-15,
      `position homothety at sample ${sample}`,
    );
    vector2Near(
      state.pencilVelocity,
      state.tracerVelocity.clone().multiplyScalar(2),
      0,
      `velocity homothety at sample ${sample}`,
    );
    vector2Near(
      state.pencilAcceleration,
      state.tracerAcceleration.clone().multiplyScalar(2),
      0,
      `acceleration homothety at sample ${sample}`,
    );
    near(state.pencilSpeed, state.tracerSpeed * 2, 0,
      `speed ratio at sample ${sample}`);
    near(state.copyResidual.length(), 0, 0,
      `copy residual at sample ${sample}`);
  }

  const tracerPoints = blocks.tracerTrace.userData.points;
  const pencilPoints = blocks.pencilTrace.userData.points;
  assert.equal(tracerPoints.length, geometry.traceSampleCount);
  assert.equal(pencilPoints.length, geometry.traceSampleCount);
  tracerPoints.forEach((tracerPoint, index) => {
    const pencilPoint = pencilPoints[index];
    near(pencilPoint.x - C.x, 2 * (tracerPoint.x - C.x), 5e-16,
      `sampled locus x at point ${index}`);
    near(pencilPoint.z - C.y, 2 * (tracerPoint.z - C.y), 5e-16,
      `sampled locus z at point ${index}`);
  });
  near(
    closedPolylineLength(pencilPoints)
      / closedPolylineLength(tracerPoints),
    2,
    2e-15,
    'closed trace length ratio',
  );
  near(
    polygonAreaXZ(pencilPoints) / polygonAreaXZ(tracerPoints),
    4,
    3e-14,
    'closed trace area ratio',
  );
  disposeModel(model.root);
});

test('movement 246 slide law covers enlargement and reduction settings', () => {
  const model = createMovementModel(catalog.movements[245]);
  const { slideSettingsForScale } = model.root.userData;

  for (const scale of [1.25, 1.5, 2, 3, 5]) {
    const settings = slideSettingsForScale(scale);
    near(settings.scaleFactor, scale, 0, `scale setting ${scale}`);
    near(settings.areaScaleFactor, scale ** 2, 0,
      `area setting ${scale}`);
    near(settings.pencilExtensionOverAdjacentBar, scale - 1, 0,
      `pencil slide station ${scale}`);
    near(settings.pivotExtensionOverParallelBar, 1 / (scale - 1), 0,
      `fixed slide station ${scale}`);
    near(
      settings.pencilExtensionOverAdjacentBar
        * settings.pivotExtensionOverParallelBar,
      1,
      2e-16,
      `reciprocal slide law ${scale}`,
    );
  }
  assert.deepEqual(slideSettingsForScale(2), {
    areaScaleFactor: 4,
    pencilExtensionOverAdjacentBar: 1,
    pivotExtensionOverParallelBar: 1,
    scaleFactor: 2,
  });
  assert.throws(() => slideSettingsForScale(1), RangeError);
  assert.throws(() => slideSettingsForScale(0.5), RangeError);
  disposeModel(model.root);
});

test('movement 246 trace is smooth, nonsingular, and its crossing bars occupy separate layers', () => {
  const model = createMovementModel(catalog.movements[245]);
  const { geometry, stateAtTime } = model.root.userData;
  let minimumIntersectionHeight = Infinity;
  const finiteDifferenceStep = 1e-5;

  near(geometry.layerClearance, 0.075, 6e-17,
    'physical clearance between bar layers');
  assert.ok(geometry.layerClearance > 0);
  for (let sample = 0; sample <= 16384; sample += 1) {
    const time = geometry.cyclePeriod * 4 * sample / 16384;
    const state = stateAtTime(time);
    const distance = state.centerDistance;
    const along = (
      geometry.parallelBarLength ** 2
      - geometry.adjacentBarLength ** 2
      + distance ** 2
    ) / (2 * distance);
    minimumIntersectionHeight = Math.min(
      minimumIntersectionHeight,
      Math.sqrt(geometry.parallelBarLength ** 2 - along ** 2),
    );
  }
  assert.ok(minimumIntersectionHeight > 2.13);

  for (const coordinate of [0.03, 0.17, 0.31, 0.49, 0.66, 0.84]) {
    const time = coordinate * geometry.cyclePeriod;
    const before = stateAtTime(time - finiteDifferenceStep);
    const state = stateAtTime(time);
    const after = stateAtTime(time + finiteDifferenceStep);
    const tracerVelocity = after.tracerPosition.clone()
      .sub(before.tracerPosition)
      .divideScalar(2 * finiteDifferenceStep);
    const pencilVelocity = after.pencilPosition.clone()
      .sub(before.pencilPosition)
      .divideScalar(2 * finiteDifferenceStep);
    const tracerAcceleration = after.tracerVelocity.clone()
      .sub(before.tracerVelocity)
      .divideScalar(2 * finiteDifferenceStep);
    vector2Near(tracerVelocity, state.tracerVelocity, 2e-10,
      `tracer velocity at coordinate ${coordinate}`);
    vector2Near(pencilVelocity, state.pencilVelocity, 4e-10,
      `pencil velocity at coordinate ${coordinate}`);
    vector2Near(tracerAcceleration, state.tracerAcceleration, 2e-10,
      `tracer acceleration at coordinate ${coordinate}`);
  }
  const start = stateAtTime(0);
  const end = stateAtTime(geometry.cyclePeriod);
  vector2Near(end.tracerPosition, start.tracerPosition, 3e-16,
    'C2 trace position closure');
  vector2Near(end.tracerVelocity, start.tracerVelocity, 3e-16,
    'C2 trace velocity closure');
  vector2Near(end.tracerAcceleration, start.tracerAcceleration, 3e-16,
    'C2 trace acceleration closure');
  disposeModel(model.root);
});

test('movement 246 renderer binds all four bars, six labeled stations, and two paper contacts', () => {
  const model = createMovementModel(catalog.movements[245]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const fixedPivotPosition = blocks.fixedPivot.position.clone();
  const toWorld = (point, y) => new THREE.Vector3(point.x, y, point.y);

  for (let sample = 0; sample <= 4096; sample += 1) {
    const time = geometry.cyclePeriod * 5 * sample / 4096;
    model.update(time);
    const state = stateAtTime(time);
    const A = toWorld(state.pencilPosition, geometry.jointCenterY);
    const B = toWorld(state.tracerPosition, geometry.jointCenterY);
    const L = toWorld(state.lowerJoint, geometry.jointCenterY);
    const R = toWorld(state.rightJoint, geometry.jointCenterY);
    const U = toWorld(state.upperJoint, geometry.jointCenterY);
    const C = toWorld(geometry.fixedPointC, geometry.jointCenterY);

    vectorNear(blocks.fixedPivot.position, fixedPivotPosition, 0,
      `fixed C position at sample ${sample}`);
    for (const [key, expected] of [
      ['B', B], ['L', L], ['R', R], ['U', U],
    ]) {
      vectorNear(
        new THREE.Vector3(
          blocks.jointPins[key].position.x,
          geometry.jointCenterY,
          blocks.jointPins[key].position.z,
        ),
        expected,
        0,
        `rendered joint ${key} at sample ${sample}`,
      );
    }
    vectorNear(
      new THREE.Vector3(
        blocks.tracerAssembly.position.x,
        geometry.jointCenterY,
        blocks.tracerAssembly.position.z,
      ),
      B,
      0,
      `rendered tracing point B at sample ${sample}`,
    );
    vectorNear(
      new THREE.Vector3(
        blocks.pencilAssembly.position.x,
        geometry.jointCenterY,
        blocks.pencilAssembly.position.z,
      ),
      A,
      0,
      `rendered pencil A at sample ${sample}`,
    );
    vectorNear(blocks.blueParallelBar.userData.endpoints.start,
      toWorld(state.tracerPosition, geometry.lowerLayerY), 0,
      `blue-bar B endpoint at sample ${sample}`);
    vectorNear(blocks.blueParallelBar.userData.endpoints.end,
      toWorld(state.upperJoint, geometry.lowerLayerY), 0,
      `blue-bar U endpoint at sample ${sample}`);
    vectorNear(blocks.redParallelBar.userData.endpoints.start,
      toWorld(state.tracerPosition, geometry.upperLayerY), 0,
      `red-bar B endpoint at sample ${sample}`);
    vectorNear(blocks.redParallelBar.userData.endpoints.end,
      toWorld(state.lowerJoint, geometry.upperLayerY), 0,
      `red-bar L endpoint at sample ${sample}`);
    const renderedUpperDirection = X_AXIS.clone()
      .applyQuaternion(blocks.pencilAssembly.quaternion);
    near(renderedUpperDirection.dot(R.clone().sub(A).normalize()), 1, 3e-15,
      `pencil slide alignment at sample ${sample}`);
    const contacts = model.root.userData.contacts;
    assert.equal(contacts.fixedPivotC.active, true);
    vectorNear(contacts.fixedPivotC.position, C, 0,
      `fixed contact C at sample ${sample}`);
    near(contacts.fixedPivotC.translationalVelocity.length(), 0, 0,
      `fixed C velocity at sample ${sample}`);
    assert.equal(contacts.pencilAToPaper.active, true);
    assert.equal(contacts.tracerBToPaper.active, true);
    near(contacts.jointR.closureError,
      state.parallelogramClosureResidual.length(), 0,
      `right-joint closure at sample ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 246 closes one trace in six seconds and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[245]);
  const { animationTiming, geometry, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const end = stateAtTime(geometry.cyclePeriod);

  near(end.traceAngle - start.traceAngle, FULL_TURN, 0,
    'one traced loop per authored cycle');
  vector2Near(end.pencilPosition, start.pencilPosition, 3e-16,
    'pencil cycle closure');
  vector2Near(end.tracerPosition, start.tracerPosition, 3e-16,
    'tracer cycle closure');
  near(animationTiming.authoredCyclePeriod, 6, 0,
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

test('p106: 246 long arms end at the right corner in a round eye no smaller than the washer', () => {
  const movement = catalog.movements.find((entry) => entry.id === 246);
  const model = createMovementModel(movement);
  try {
    const bars = model.root.userData.workingParts.bars;
    for (const bar of bars) {
      const last = bar.userData.holes.at(-1).station;
      bar.geometry.computeBoundingBox();
      const box = bar.geometry.boundingBox;
      assert.ok(box.max.x <= last + 0.15 + 1e-6, `${bar.userData.role} ends in its eye (${box.max.x} vs ${last})`);
      assert.ok(box.max.x >= last + 0.15 - 1e-3, `${bar.userData.role} eye radius at least the washer's`);
    }
  } finally {
    model.dispose?.();
  }
});
