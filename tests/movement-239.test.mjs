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

test('movement 239 is one spur gear held by two separately pivoted stops', () => {
  const movement = catalog.movements[238];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 239);
  assert.equal(movement.number, '239');
  assert.equal(movement.title, 'Paired Stops for a Spur Gear');
  assert.equal(movement.category, 'Toothed gearing');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'paired-opposed-gravity-stops-eighteen-tooth-spur-gear',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.actuationDepictedBySource, false);
  assert.equal(transmission.fullRotationPermittedWhileStopsSeated, false);
  assert.equal(transmission.separatelyPivotedStopCount, 2);
  assert.match(transmission.sourceLimitedDemonstration, /externally applied/);
  assert.equal(blocks.gear.parent, model.root);
  assert.equal(blocks.leftStop.parent, model.root);
  assert.equal(blocks.rightStop.parent, model.root);
  assert.equal(blocks.leftPivotShaft.parent, model.root);
  assert.equal(blocks.rightPivotShaft.parent, model.root);
  assert.equal(blocks.gear.userData.teeth, 18);
  assert.equal(
    blocks.leftStop.userData.role,
    'left-gravity-seated-spur-gear-stop',
  );
  assert.equal(
    blocks.rightStop.userData.role,
    'right-gravity-seated-spur-gear-stop',
  );
  let stopCount = 0;
  model.root.traverse((object) => {
    if (/gravity-seated-spur-gear-stop$/.test(object.userData.role ?? '')) {
      stopCount += 1;
    }
  });
  assert.equal(stopCount, 2);
  disposeModel(model.root);
});

test('movement 239 preserves the measured pivots, noses, and abbreviated source plate', () => {
  const model = createMovementModel(catalog.movements[238]);
  const {
    geometry,
    sourceReference,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const plate = sourceReference.plate239;

  assert.deepEqual(plate.rasterGearCenter.toArray(), [222, 363]);
  assert.deepEqual(plate.rasterLeftPivot.toArray(), [25, 284]);
  assert.deepEqual(plate.rasterLeftNose.toArray(), [177, 225]);
  assert.deepEqual(plate.rasterRightPivot.toArray(), [496, 253]);
  assert.deepEqual(plate.rasterRightNose.toArray(), [319, 268]);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.inferredFullToothCount, 18);
  assert.equal(plate.visibleUpperToothTipCount, 10);
  assert.equal(plate.sourceBreakLineAbbreviatesLowerGearHalf, true);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.match(plate.inferredTopology, /two separately pivoted stops/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 61,
    edition: 21,
    illustrationPage: 60,
    publicationYear: 1908,
  });
  vectorNear(geometry.leftPivot, new THREE.Vector2(-3.152, 1.264), 2e-15,
    'left source pivot');
  vectorNear(geometry.leftNose, new THREE.Vector2(-0.72, 2.208), 2e-15,
    'left source nose');
  vectorNear(geometry.rightPivot, new THREE.Vector2(4.384, 1.76), 2e-15,
    'right source pivot');
  vectorNear(geometry.rightNose, new THREE.Vector2(1.552, 1.52), 2e-15,
    'right source nose');
  near(THREE.MathUtils.radToDeg(geometry.gearMountPhase),
    38.27666115384453, 2e-14, 'source tooth mounting phase');
  near(THREE.MathUtils.radToDeg(geometry.clockwiseLimit),
    -4.88543310360168, 2e-14, 'source-derived clockwise limit');
  const source = stateAtCycleCoordinate(0);
  assert.equal(source.stage, 'right-stop-holds-counterclockwise-limit');
  assert.equal(source.activeStop, 'right');
  near(source.wheelAngle, 0, 0, 'source wheel pose');
  near(source.rightMetrics.clearance, 0, 4e-16,
    'right source contact');
  assert.ok(source.leftMetrics.clearance > 0.19);
  disposeModel(model.root);
});

test('movement 239 reconstructs the complete eighteen-tooth source spur profile', () => {
  const model = createMovementModel(catalog.movements[238]);
  const {
    blocks,
    flankSegmentAt,
    geometry,
    pointOnLocalFlankAtRadius,
  } = model.root.userData;
  const gear = blocks.gear;

  vectorNear(gear.userData.axis, new THREE.Vector3(0, 0, 1), 0,
    'spur-gear axis');
  assert.equal(gear.userData.toothProfile, 'source-trapezoidal-spur');
  near(gear.userData.angularPitch, FULL_TURN / 18, 0,
    'eighteen-tooth pitch');
  near(gear.userData.rootRadius, geometry.gearRootRadius, 0,
    'root radius');
  near(gear.userData.outerRadius, geometry.gearOuterRadius, 0,
    'outer radius');
  near(gear.userData.pitchRadius, geometry.gearPitchRadius, 0,
    'pitch radius');
  assert.ok(geometry.rootHalfToothAngle > geometry.tipHalfToothAngle);
  for (let toothIndex = 0; toothIndex < geometry.toothCount; toothIndex += 1) {
    for (const side of [-1, 1]) {
      const segment = flankSegmentAt(side, toothIndex, 0);
      near(segment.root.length(), geometry.gearRootRadius, 5e-16,
        `tooth ${toothIndex} flank ${side} root radius`);
      near(segment.outer.length(), geometry.gearOuterRadius, 5e-16,
        `tooth ${toothIndex} flank ${side} outer radius`);
      const expectedRootAngle = geometry.gearMountPhase
        + toothIndex * geometry.toothPitch
        + side * geometry.rootHalfToothAngle;
      near(
        Math.atan2(
          Math.sin(Math.atan2(segment.root.y, segment.root.x)
            - expectedRootAngle),
          Math.cos(Math.atan2(segment.root.y, segment.root.x)
            - expectedRootAngle),
        ),
        0,
        2e-15,
        `tooth ${toothIndex} flank ${side} root phase`,
      );
    }
  }
  const rightPoint = pointOnLocalFlankAtRadius(
    1,
    geometry.rightNose.length(),
  );
  const leftPoint = pointOnLocalFlankAtRadius(
    -1,
    geometry.leftNose.length(),
  );
  assert.ok(rightPoint.segmentCoordinate > 0.18);
  assert.ok(rightPoint.segmentCoordinate < 0.19);
  assert.ok(leftPoint.segmentCoordinate > 0.42);
  assert.ok(leftPoint.segmentCoordinate < 0.43);
  disposeModel(model.root);
});

test('movement 239 right stop closes exactly and rejects counterclockwise overtravel', () => {
  const model = createMovementModel(catalog.movements[238]);
  const {
    geometry,
    stateAtCycleCoordinate,
    stopMetricsAtWheelAngle,
  } = model.root.userData;

  for (const coordinate of [0, 0.04, 0.1, 0.159, 0.8, 0.9, 0.999]) {
    const state = stateAtCycleCoordinate(coordinate);
    assert.equal(state.activeStop, 'right');
    assert.equal(state.dwell, true);
    assert.equal(state.demonstrationTorque, 'counterclockwise-blocked');
    near(state.wheelAngle, 0, 0, `right lock angle at ${coordinate}`);
    near(state.wheelAngularSpeed, 0, 0,
      `right lock speed at ${coordinate}`);
    near(state.contact.clearance, 0, 4e-16,
      `right contact closure at ${coordinate}`);
    near(state.contact.angularClearance, 0, 0,
      `right angular closure at ${coordinate}`);
    assert.equal(state.contact.toothIndex, 0);
    assert.equal(state.contact.flankSide, 1);
  }
  const legal = stopMetricsAtWheelAngle('right', -1e-6);
  const overtravel = stopMetricsAtWheelAngle('right', 1e-6);
  assert.ok(legal.angularClearance > 0);
  assert.ok(overtravel.angularClearance < 0);
  near(overtravel.angularClearance, -1e-6, 3e-16,
    'right stop rejects added counterclockwise rotation');
  assert.equal(geometry.clockwiseLimit < 0, true);
  disposeModel(model.root);
});

test('movement 239 traverses clockwise through only the positive trapped clearance', () => {
  const model = createMovementModel(catalog.movements[238]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  const segment = geometry.phases.clockwiseTraverse;
  let previousWheelAngle = 0;
  let maximumClockwiseSpeed = 0;

  for (let sample = 0; sample < 32_768; sample += 1) {
    const coordinate = THREE.MathUtils.lerp(
      segment.start,
      segment.end,
      sample / 32_768,
    );
    const state = stateAtCycleCoordinate(coordinate);
    assert.equal(state.stage, 'clockwise-free-play-between-opposed-stops');
    assert.equal(state.activeStop, null);
    assert.equal(state.dwell, false);
    assert.equal(state.contact, null);
    assert.ok(state.wheelAngle <= previousWheelAngle + 2e-15);
    assert.ok(state.wheelAngle <= 2e-15);
    assert.ok(state.wheelAngle >= geometry.clockwiseLimit - 2e-15);
    assert.ok(state.wheelAngularSpeed <= 2e-14);
    assert.ok(state.leftMetrics.angularClearance >= -2e-15);
    assert.ok(state.rightMetrics.angularClearance >= -2e-15);
    assert.ok(state.leftClearance >= -2e-15);
    assert.ok(state.rightClearance >= -2e-15);
    maximumClockwiseSpeed = Math.max(
      maximumClockwiseSpeed,
      -state.wheelAngularSpeed,
    );
    previousWheelAngle = state.wheelAngle;
  }
  const leftLock = stateAtCycleCoordinate(segment.end);
  near(leftLock.wheelAngle, geometry.clockwiseLimit, 0,
    'clockwise traverse reaches left limit');
  assert.equal(leftLock.activeStop, 'left');
  near(leftLock.leftClearance, 0, 3e-16, 'left limit closes');
  assert.ok(maximumClockwiseSpeed > 0.18);
  disposeModel(model.root);
});

test('movement 239 left stop rejects clockwise overtravel and returns to the right stop', () => {
  const model = createMovementModel(catalog.movements[238]);
  const {
    geometry,
    stateAtCycleCoordinate,
    stopMetricsAtWheelAngle,
  } = model.root.userData;

  for (const coordinate of [0.38, 0.42, 0.5, 0.579]) {
    const state = stateAtCycleCoordinate(coordinate);
    assert.equal(state.activeStop, 'left');
    assert.equal(state.dwell, true);
    assert.equal(state.demonstrationTorque, 'clockwise-blocked');
    near(state.wheelAngle, geometry.clockwiseLimit, 0,
      `left lock angle at ${coordinate}`);
    near(state.wheelAngularSpeed, 0, 0,
      `left lock speed at ${coordinate}`);
    near(state.contact.clearance, 0, 3e-16,
      `left contact closure at ${coordinate}`);
    near(state.contact.angularClearance, 0, 0,
      `left angular closure at ${coordinate}`);
    assert.equal(state.contact.toothIndex, 4);
    assert.equal(state.contact.flankSide, -1);
  }
  const legal = stopMetricsAtWheelAngle(
    'left',
    geometry.clockwiseLimit + 1e-6,
  );
  const overtravel = stopMetricsAtWheelAngle(
    'left',
    geometry.clockwiseLimit - 1e-6,
  );
  assert.ok(legal.angularClearance > 0);
  assert.ok(overtravel.angularClearance < 0);
  near(overtravel.angularClearance, -1e-6, 3e-16,
    'left stop rejects added clockwise rotation');

  const segment = geometry.phases.counterclockwiseTraverse;
  let previousWheelAngle = geometry.clockwiseLimit;
  let maximumCounterclockwiseSpeed = 0;
  for (let sample = 0; sample < 32_768; sample += 1) {
    const coordinate = THREE.MathUtils.lerp(
      segment.start,
      segment.end,
      sample / 32_768,
    );
    const state = stateAtCycleCoordinate(coordinate);
    assert.equal(
      state.stage,
      'counterclockwise-free-play-between-opposed-stops',
    );
    assert.equal(state.activeStop, null);
    assert.ok(state.wheelAngle >= previousWheelAngle - 2e-15);
    assert.ok(state.wheelAngularSpeed >= -2e-14);
    assert.ok(state.leftMetrics.angularClearance >= -2e-15);
    assert.ok(state.rightMetrics.angularClearance >= -2e-15);
    maximumCounterclockwiseSpeed = Math.max(
      maximumCounterclockwiseSpeed,
      state.wheelAngularSpeed,
    );
    previousWheelAngle = state.wheelAngle;
  }
  const rightLock = stateAtCycleCoordinate(segment.end);
  near(rightLock.wheelAngle, 0, 0,
    'counterclockwise traverse reaches right limit');
  assert.equal(rightLock.activeStop, 'right');
  assert.ok(maximumCounterclockwiseSpeed > 0.18);
  disposeModel(model.root);
});

test('movement 239 analytic wheel derivatives agree with finite differences', () => {
  const model = createMovementModel(catalog.movements[238]);
  const { geometry, stateAtTime } = model.root.userData;
  const h = 2e-5;

  for (const cyclePhase of [
    0.19, 0.23, 0.27, 0.31, 0.35,
    0.61, 0.65, 0.69, 0.73, 0.77,
  ]) {
    const time = cyclePhase * geometry.cyclePeriod;
    const before = stateAtTime(time - h);
    const state = stateAtTime(time);
    const after = stateAtTime(time + h);
    const finiteSpeed = (after.wheelAngle - before.wheelAngle) / (2 * h);
    const finiteAcceleration = (
      after.wheelAngle - 2 * state.wheelAngle + before.wheelAngle
    ) / h ** 2;
    near(finiteSpeed, state.wheelAngularSpeed, 2e-9,
      `wheel speed at phase ${cyclePhase}`);
    near(finiteAcceleration, state.wheelAngularAcceleration, 2e-6,
      `wheel acceleration at phase ${cyclePhase}`);
  }
  for (let cycle = 0; cycle <= 20; cycle += 1) {
    const closure = model.root.userData.stateAtCycleCoordinate(cycle);
    near(closure.wheelAngle, 0, 0, `wheel closes cycle ${cycle}`);
    assert.equal(closure.activeStop, 'right');
  }
  disposeModel(model.root);
});

test('movement 239 renderer binds both limits and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[238]);
  const {
    animationTiming,
    blocks,
    geometry,
    stateAtTime,
  } = model.root.userData;

  for (const time of [0, 0.5, 1.08, 1.52, 1.96, 2.32, 2.76, 3.2, 4]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.gear.userData.rotor.rotation.z, state.wheelAngle, 0,
      `rendered gear at ${time}`);
    near(blocks.gearShaft.userData.rotor.rotation.z, state.wheelAngle, 0,
      `rendered arbor at ${time}`);
    near(blocks.leftStop.rotation.z, 0, 0,
      `left stop remains seated at ${time}`);
    near(blocks.rightStop.rotation.z, 0, 0,
      `right stop remains seated at ${time}`);
    assert.equal(blocks.leftContactMarker.visible, state.activeStop === 'left');
    assert.equal(
      blocks.rightContactMarker.visible,
      state.activeStop === 'right',
    );
    assert.equal(
      model.root.userData.contacts.leftStopTooth !== null,
      state.activeStop === 'left',
    );
    assert.equal(
      model.root.userData.contacts.rightStopTooth !== null,
      state.activeStop === 'right',
    );
  }
  assert.equal(animationTiming.authoredCyclePeriod, geometry.cyclePeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  model.root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model.root)
    .getSize(new THREE.Vector3());
  assert.ok(size.x > 8.3);
  assert.ok(size.y > 6.4);
  assert.ok(size.z > 1.05);
  let meshCount = 0;
  model.root.traverse((object) => { if (object.isMesh) meshCount += 1; });
  assert.ok(meshCount >= 21);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model289.root);
});
