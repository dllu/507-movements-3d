import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
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

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
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

test('movement 361 keeps the belt pulley loose from the axially separate pin-clutched output shaft', () => {
  const movement = catalog.movements[360];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 361);
  assert.equal(movement.number, '361');
  assert.equal(movement.category, 'Ropes, belts & pulleys');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'axially-shifted-single-pin-pulley-clutch',
  );
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /single-open-belt/);
  assert.match(data.mechanism, /axially-sliding-pulley/);
  assert.match(data.mechanism, /distinct-lower-shaft/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 2);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.inputs, /upper shaft rotation/);
  assert.match(degreesOfFreedom.inputs, /clutch lever/);

  assert.equal(blocks.driverRotor.parent, model.root);
  assert.equal(blocks.outputRotor.parent, model.root);
  assert.equal(blocks.slidingPulley.parent, model.root);
  assert.notEqual(blocks.outputRotor, blocks.slidingPulley);
  assert.equal(blocks.outputShaft.parent, blocks.outputRotor);
  assert.equal(blocks.shaftDog.parent, blocks.outputRotor);
  assert.equal(blocks.pulleyDog.parent, blocks.slidingPulley);
  assert.equal(blocks.lowerPulley.sheave.parent, blocks.slidingPulley);
  assert.equal(blocks.upperPulley.sheave.parent, blocks.driverRotor);
  assert.equal(blocks.driverShaft.parent, blocks.driverRotor);
  assert.equal(blocks.shiftCollar.parent, blocks.shiftCarrier);
  assert.equal(blocks.belt.parent, model.root);
  assert.equal(blocks.belt.userData.closed, true);
  assert.equal(blocks.belt.userData.markers.length, 10);
  assert.equal(data.transmission.beltCount, 1);

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  for (const role of [
    'upper-handwheel-shaft-and-driving-pulley-one-rotor',
    'single-open-belt-linking-upper-and-lower-equal-pitch-pulleys',
    'lower-belt-pulley-free-to-spin-and-slide-on-output-shaft',
    'lower-output-shaft-and-radial-dog-one-rotor',
    'single-axial-pin-fast-on-pulley-side',
    'single-radial-pin-fast-on-lower-shaft',
    'fork-groove-collar-moving-pulley-axially',
    'source-shown-operating-lever-with-sliding-fork-contact',
    'white-upper-driving-pulley-index',
    'white-lower-free-pulley-index',
    'white-lower-output-shaft-index',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 361 records Brown’s stated pin clutch and separates source evidence from display choices', () => {
  const movement = catalog.movements[360];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate361;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_361.html');
  assert.match(movement.description, /pin on the lower shaft/);
  assert.match(movement.description, /pin on side of pulley/);
  assert.match(movement.description, /moved lengthwise of the shaft/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(data.dynamics.sourceSpecifiesInertiaLoadOrTiming, false);
  assert.match(data.timeline.note, /Brown supplies no timing/);
  assert.match(data.timeline.note, /stops aligned pins/);
  assert.match(data.dynamics.disengagedOutputAssumption, /holds.*still/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.handwheelCenter.toArray(), [43, 113]);
  assert.deepEqual(plate.upperPulleyCenter.toArray(), [243, 110]);
  assert.deepEqual(plate.lowerPulleyCenter.toArray(), [242, 389]);
  assert.deepEqual(plate.pulleyAxialPin.toArray(), [201, 333]);
  assert.deepEqual(plate.shaftRadialPin.toArray(), [161, 350]);
  assert.deepEqual(plate.leverPivot.toArray(), [378, 307]);
  assert.equal(plate.upperPulleyRadiusPixels, 49);
  assert.equal(plate.lowerPulleyRadiusPixels, 49);

  assert.deepEqual(
    sourceReference.constructionEvidence.explicitInBrownDescription,
    [
      'one pin is on the lower shaft',
      'one pin is on the side of the pulley',
      'the pulley moves lengthwise of the shaft',
      'a lever or other means brings the pins into or out of contact',
    ],
  );
  assert.match(
    sourceReference.constructionEvidence.engravingEvidence,
    /one open belt/,
  );
  assert.match(
    sourceReference.constructionEvidence.inference,
    /exact equality.*display idealization/,
  );
  disposeModel(model.root);
});

test('movement 361 uses one open belt with the exact equal-radius no-slip speed law', () => {
  const model = createMovementModel(catalog.movements[360]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;

  near(geometry.upperPitchRadius, geometry.lowerPitchRadius, 0,
    'equal displayed pitch radii');
  near(geometry.pulleyRatio, 1, 0, 'equal-radius ratio');
  for (let index = 0; index <= 480; index += 1) {
    const time = geometry.cyclePeriod * 2 * index / 480;
    const state = stateAtTime(time);
    near(
      geometry.upperPitchRadius * state.driverAngularSpeed,
      geometry.lowerPitchRadius * state.lowerPulleyAngularSpeed,
      2e-12,
      `no-slip velocity at ${time}`,
    );
    near(
      state.lowerPulleyAngle,
      geometry.pulleyRatio * state.driverAngle,
      2e-12,
      `same-direction pulley angle at ${time}`,
    );
    near(
      state.beltTravel,
      geometry.upperPitchRadius * state.driverAngle,
      2e-12,
      `material travel at ${time}`,
    );
    if (state.driverAngularSpeed > 1e-9) {
      assert.ok(state.lowerPulleyAngularSpeed > 0);
    }
  }
  near(
    stateAtTime(geometry.cyclePeriod).driverAngle
      - stateAtTime(0).driverAngle,
    FULL_TURN * 3,
    2e-12,
    'three upper-pulley turns per demonstration',
  );
  assert.match(transmission.directionLaw, /same direction/);
  assert.match(transmission.noSlipLaw, /upperPitchRadius/);
  assert.match(transmission.equalRadiusLaw, /lowerPulleyAngularSpeed/);
  assert.match(transmission.travelLaw, /unbounded driver angle/);
  disposeModel(model.root);
});

test('movement 361 belt is one arc-length path with smooth free-span-to-pulley transitions', () => {
  const model = createMovementModel(catalog.movements[360]);
  const data = model.root.userData;
  const { beltGeometry, geometry } = data;

  assert.ok(beltGeometry.beltLengthChange < 0.006);
  assert.ok(beltGeometry.beltLengthChange > 0);
  assert.match(beltGeometry.note, /small axial skew/);
  assert.match(beltGeometry.pathContinuity, /one closed tangent-continuous/);

  for (const pulleyX of [
    geometry.disengagedPulleyX,
    0,
    geometry.engagedPulleyX,
  ]) {
    const path = beltGeometry.beltPathAtPulleyX(pulleyX);
    const { curve } = path;
    assert.deepEqual(path.components.map(({ name }) => name), [
      'descending-free-span',
      'lower-pulley-semicircular-wrap',
      'ascending-free-span',
      'upper-pulley-semicircular-wrap',
    ]);
    near(
      path.components[1].length,
      Math.PI * geometry.lowerPitchRadius,
      2e-12,
      'lower semicircle length',
    );
    near(
      path.components[3].length,
      Math.PI * geometry.upperPitchRadius,
      2e-12,
      'upper semicircle length',
    );
    vectorNear(curve.getPointAt(0), curve.getPointAt(1), 2e-12,
      `closed seam at pulley x ${pulleyX}`);

    for (const boundary of [...path.boundaryFractions, 1]) {
      const epsilon = 1e-5;
      const beforePhase = boundary === 1 ? 1 - epsilon : boundary - epsilon;
      const afterPhase = boundary === 1 ? epsilon : boundary + epsilon;
      const centerPhase = boundary === 1 ? 1 : boundary;
      const before = curve.getPointAt(beforePhase);
      const center = curve.getPointAt(centerPhase);
      const after = curve.getPointAt(afterPhase);
      const enteringDirection = center.clone().sub(before).normalize();
      const leavingDirection = after.clone().sub(center).normalize();
      assert.ok(
        enteringDirection.dot(leavingDirection) > 0.999999,
        `C1 direction at boundary ${boundary}`,
      );
      const enteringStep = center.distanceTo(before);
      const leavingStep = after.distanceTo(center);
      near(
        enteringStep / leavingStep,
        1,
        0.003,
        `constant marker speed through boundary ${boundary}`,
      );
      assert.ok(
        curve.getTangentAt(beforePhase).dot(
          curve.getTangentAt(afterPhase),
        ) > 0.99999,
      );
    }

    let shortestStep = Infinity;
    let longestStep = 0;
    let previous = curve.getPointAt(0);
    for (let index = 1; index <= 2400; index += 1) {
      const point = curve.getPointAt(index / 2400);
      const step = point.distanceTo(previous);
      shortestStep = Math.min(shortestStep, step);
      longestStep = Math.max(longestStep, step);
      previous = point;
    }
    assert.ok(longestStep / shortestStep < 1.006,
      `arc-length sampling at pulley x ${pulleyX}`);
  }
  disposeModel(model.root);
});

test('movement 361 shifts only at rest and changes from axial clearance to positive dog overlap', () => {
  const model = createMovementModel(catalog.movements[360]);
  const data = model.root.userData;
  const { dogGeometry, geometry, stateAtTime, timeline } = data;

  near(dogGeometry.disengagedIntervals.clearance, 0.085, 2e-12,
    'disengaged pin clearance');
  near(dogGeometry.disengagedIntervals.overlap, 0, 0,
    'no disengaged overlap');
  near(dogGeometry.engagedIntervals.clearance, 0, 0,
    'no engaged clearance');
  near(dogGeometry.engagedIntervals.overlap, 0.14, 2e-12,
    'engaged pin overlap');

  assert.deepEqual(timeline.engageAtRest, [3, 4.5]);
  assert.deepEqual(timeline.engagedDrive, [4.5, 7.5]);
  assert.deepEqual(timeline.disengageAtRest, [7.5, 9]);
  assert.deepEqual(timeline.freePulleyRuns, [[0, 3], [9, 12]]);
  for (const [start, end, expectedMode] of [
    [3, 4.5, 'engaging-at-rest'],
    [7.5, 9, 'disengaging-at-rest'],
  ]) {
    for (let index = 0; index < 60; index += 1) {
      const time = THREE.MathUtils.lerp(start, end, index / 60);
      const state = stateAtTime(time);
      assert.equal(state.clutchMode, expectedMode);
      near(state.driverAngularSpeed, 0, 0, `driver stopped at ${time}`);
      near(state.lowerPulleyAngularSpeed, 0, 0,
        `loose pulley stopped at ${time}`);
      near(state.outputAngularSpeed, 0, 0, `output stopped at ${time}`);
      near(state.dogAngularAlignmentError, 0, 2e-12,
        `pins aligned at ${time}`);
      assert.equal(state.safeShiftCondition, true);
      assert.equal(state.clutchTransmitting, false);
    }
  }

  const disconnected = stateAtTime(1.5);
  assert.equal(disconnected.clutchMode, 'disengaged-free-running');
  assert.ok(disconnected.lowerPulleyAngularSpeed > 0);
  near(disconnected.outputAngularSpeed, 0, 0,
    'disconnected output stopped');
  assert.ok(disconnected.dogAxialClearance > 0);
  assert.equal(disconnected.pinsAxiallyOverlapping, false);

  const connected = stateAtTime(6);
  assert.equal(connected.clutchMode, 'engaged-driving');
  assert.equal(connected.clutchTransmitting, true);
  assert.ok(connected.dogAxialOverlap > 0);
  assert.equal(connected.pinsAxiallyOverlapping, true);
  near(connected.outputAngularSpeed, connected.lowerPulleyAngularSpeed,
    2e-12, 'locked speed');
  near(
    positiveModulo(connected.outputAngle - connected.lowerPulleyAngle,
      FULL_TURN),
    0,
    2e-12,
    'locked angular phase',
  );
  near(
    stateAtTime(geometry.cyclePeriod).outputAngle
      - stateAtTime(0).outputAngle,
    FULL_TURN,
    2e-12,
    'one output turn per demonstration',
  );
  assert.match(data.transmission.clutchLaw, /axial overlap/);
  disposeModel(model.root);
});

test('movement 361 renderer preserves carriers, belt material continuity, and finite geometry over 1,200 frames', () => {
  const model = createMovementModel(catalog.movements[360]);
  const data = model.root.userData;
  const { blocks, geometry } = data;

  for (const time of [0, 1.5, 2.999, 3, 3.75, 4.5, 6, 7.5,
    8.25, 9, 10.5, 11.999, 12, 13.5]) {
    const expected = data.stateAtTime(time);
    model.update(time);
    near(blocks.driverRotor.rotation.x, expected.driverAngle, 2e-12,
      `upper rotor at ${time}`);
    near(blocks.slidingPulley.rotation.x, expected.lowerPulleyAngle,
      2e-12, `loose pulley at ${time}`);
    near(blocks.outputRotor.rotation.x, expected.outputAngle, 2e-12,
      `output rotor at ${time}`);
    near(blocks.slidingPulley.position.x, expected.pulleyAxialPosition,
      2e-12, `pulley axial position at ${time}`);
    near(blocks.shiftCarrier.position.x, expected.pulleyAxialPosition,
      2e-12, `shift collar axial position at ${time}`);
    near(blocks.belt.userData.curve.lowerCenter.x,
      expected.pulleyAxialPosition, 2e-12,
      `belt follows moving groove at ${time}`);
    assert.equal(data.currentState.clutchMode, expected.clutchMode);

    const curve = blocks.belt.userData.curve;
    const pathLength = blocks.belt.userData.length;
    blocks.belt.userData.markers.forEach((marker, index) => {
      const phase = positiveModulo(
        expected.beltTravel / pathLength
          + index / geometry.beltMarkerCount,
        1,
      );
      vectorNear(marker.position, curve.getPointAt(phase), 3e-12,
        `material marker ${index} at ${time}`);
    });
  }

  const beforeClosure = [];
  model.update(geometry.cyclePeriod - 1e-4);
  blocks.belt.userData.markers.forEach((marker) => {
    beforeClosure.push(marker.position.clone());
  });
  model.update(geometry.cyclePeriod + 1e-4);
  blocks.belt.userData.markers.forEach((marker, index) => {
    assert.ok(marker.position.distanceTo(beforeClosure[index]) < 1e-5,
      `marker ${index} stays continuous across demonstration boundary`);
  });

  let previousMarkers;
  let largestMarkerStep = 0;
  for (let index = 0; index <= 1200; index += 1) {
    model.update(geometry.cyclePeriod * 2 * index / 1200);
    model.root.updateMatrixWorld(true);
    const currentMarkers = blocks.belt.userData.markers.map(
      (marker) => marker.getWorldPosition(new THREE.Vector3()),
    );
    if (previousMarkers) {
      currentMarkers.forEach((marker, markerIndex) => {
        largestMarkerStep = Math.max(
          largestMarkerStep,
          marker.distanceTo(previousMarkers[markerIndex]),
        );
      });
    }
    previousMarkers = currentMarkers;
    model.root.traverse((object) => {
      assert.ok(object.position.toArray().every(Number.isFinite));
      assert.ok(object.quaternion.toArray().every(Number.isFinite));
      if (object.geometry?.attributes?.position) {
        const values = object.geometry.attributes.position.array;
        for (let valueIndex = 0; valueIndex < values.length;
          valueIndex += 1) assert.ok(Number.isFinite(values[valueIndex]));
      }
    });
  }
  assert.ok(largestMarkerStep < 0.045,
    `largest per-frame material-marker step was ${largestMarkerStep}`);
  disposeModel(model.root);
});

test('movement 361 closes its rigid orientations while movement 507 remains the next authored draft', () => {
  const movement361 = catalog.movements[360];
  const model361 = createMovementModel(movement361);
  const data = model361.root.userData;
  const start = data.stateAtTime(0);
  const end = data.stateAtTime(data.geometry.cyclePeriod);

  near(positiveModulo(end.driverAngle - start.driverAngle, FULL_TURN),
    0, 2e-12, 'driver orientation closure');
  near(positiveModulo(
    end.lowerPulleyAngle - start.lowerPulleyAngle,
    FULL_TURN,
  ), 0, 2e-12, 'lower pulley orientation closure');
  near(positiveModulo(end.outputAngle - start.outputAngle, FULL_TURN),
    0, 2e-12, 'output orientation closure');
  near(end.pulleyAxialPosition, start.pulleyAxialPosition, 2e-12,
    'axial position closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model361.root);
  disposeModel(model507.root);
});
