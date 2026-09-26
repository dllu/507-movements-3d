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

test('movement 358 is one carriage-mounted fusee constrained by two opposed cords', () => {
  const movement = catalog.movements[357];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 358);
  assert.equal(movement.number, '358');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(movement.archetype,
    'double-cord-profiled-fusee-carriage');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /carriage-mounted-profiled-fusee/);
  assert.match(data.mechanism, /two-oppositely-wound-fixed-cords/);
  assert.equal(degreesOfFreedom.mechanism, 1);
  assert.match(degreesOfFreedom.input, /fusee shaft/);
  assert.match(degreesOfFreedom.output, /two inextensible opposed cords/);

  assert.equal(blocks.track.parent, model.root);
  assert.equal(blocks.carriage.parent, model.root);
  assert.equal(blocks.fuseeRotor.parent, blocks.carriage);
  assert.equal(blocks.fuseeBody.parent, blocks.fuseeRotor);
  assert.equal(blocks.fuseeGroove.parent, blocks.fuseeRotor);
  assert.equal(blocks.spinIndicator.parent, blocks.fuseeRotor);
  assert.equal(blocks.firstCord.parent, model.root);
  assert.equal(blocks.secondCord.parent, model.root);
  assert.notEqual(blocks.firstCord, blocks.secondCord);
  // Brown's plan draws two axles, each carrying one edge-on wheel.
  assert.equal(blocks.carriageWheels.length, 2);
  blocks.carriageWheels.forEach((wheel) => {
    assert.equal(wheel.parent, blocks.carriage);
  });
  assert.equal(blocks.fixedAnchors.length, 2);
  blocks.fixedAnchors.forEach((anchor) => {
    assert.equal(anchor.parent, model.root);
    // Brown draws no anchor stand, foot or eye: the fixed ends are ideal.
    let meshes = 0;
    anchor.traverse((object) => { if (object.isMesh) meshes += 1; });
    assert.equal(meshes, 0);
  });
  assert.equal(blocks.firstCord.userData.closed, false);
  assert.equal(blocks.secondCord.userData.closed, false);
  assert.equal(blocks.firstCord.userData.markers.length, 9);
  assert.equal(blocks.secondCord.userData.markers.length, 9);

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  for (const role of [
    'fixed-parallel-carriage-rails',
    'fusee-bearing-traversing-carriage',
    'historically-profiled-sureda-fusee-body',
    'continuous-helical-fusee-groove',
    'first-opposed-fusee-cord',
    'second-opposed-fusee-cord',
    'white-fusee-spin-rate-index',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 358 records Brown, Fuller, and the earlier Sureda arrangement without inventing source timing', () => {
  const movement = catalog.movements[357];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate358;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_358.html');
  assert.match(movement.description, /Traverse of carriage/);
  assert.match(movement.description, /variation in diameter/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.match(data.timeline.note, /Brown supplies no timing/);
  assert.match(data.timeline.note, /explicit display cycle/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.fuseeAxisLeft.toArray(), [64, 304]);
  assert.deepEqual(plate.fuseeAxisRight.toArray(), [371, 304]);
  assert.deepEqual(plate.fuseeLargeTop.toArray(), [214, 220]);
  assert.deepEqual(plate.fuseeLargeBottom.toArray(), [214, 394]);
  assert.deepEqual(plate.fuseeSmallTop.toArray(), [361, 290]);
  assert.deepEqual(plate.fuseeSmallBottom.toArray(), [361, 318]);
  assert.deepEqual(plate.currentBandAtAxis.toArray(), [294, 304]);
  assert.deepEqual(plate.bandLimitLeft.toArray(), [236, 16]);
  assert.deepEqual(plate.bandLimitRight.toArray(), [325, 25]);
  assert.deepEqual(plate.carriageUpperRoller.toArray(), [445, 105]);
  assert.deepEqual(plate.carriageLowerRoller.toArray(), [445, 441]);

  assert.equal(sourceReference.fullerAnalyticalTable.movementNumber, 100);
  assert.equal(sourceReference.fullerAnalyticalTable.publicationYear, 1834);
  assert.match(sourceReference.fullerAnalyticalTable.use,
    /direct predecessor of Brown 358/);
  assert.equal(sourceReference.borgnisSureda.publicationYear, 1820);
  assert.equal(sourceReference.borgnisSureda.figure,
    'plate XIII, figure 3');
  assert.match(sourceReference.borgnisSureda.use,
    /fusee is carried by the traversing carriage/);
  assert.match(sourceReference.borgnisSureda.use,
    /two cords occupy the groove in opposite senses/);
  assert.match(sourceReference.borgnisSureda.use,
    /one winds while the other unwinds/);
  assert.deepEqual(data.historicalTrial.carriageTravelLines,
    [112, 88, 74, 62, 53, 46, 41, 38, 36, 30]);
  assert.equal(data.historicalTrial.totalTravelLines, 580);
  disposeModel(model.root);
});

test('movement 358 turns Sureda’s ten observations into one monotone fusee profile', () => {
  const model = createMovementModel(catalog.movements[357]);
  const data = model.root.userData;
  const { geometry, historicalTrial, profile, stateAtDriveTurns } = data;

  // Ten display turns carry Sureda's ten observations (one turn each).
  assert.equal(geometry.revolutionCount, 10);
  assert.equal(profile.sampledRadii.length, 10);
  const turnsPerObservation = geometry.revolutionCount / 10;
  near(
    FULL_TURN * turnsPerObservation
      * profile.sampledRadii.reduce((sum, value) => sum + value, 0),
    geometry.carriageStroke,
    3e-15 * geometry.carriageStroke,
    'full profile integral',
  );
  for (let index = 0; index < 10; index += 1) {
    const radius = profile.radiusAtTurns((index + 0.5) * turnsPerObservation);
    near(radius, profile.sampledRadii[index], 3e-16,
      `turn-center radius ${index}`);
    near(
      radius / profile.sampledRadii[0],
      historicalTrial.carriageTravelLines[index]
        / historicalTrial.carriageTravelLines[0],
      4e-16,
      `historical velocity ratio ${index}`,
    );
  }

  let previousRadius = Infinity;
  let previousDisplacement = -Infinity;
  for (let index = 0; index <= 4096; index += 1) {
    const turns = geometry.revolutionCount * index / 4096;
    const state = stateAtDriveTurns(turns);
    assert.ok(state.localRadius <= previousRadius + 2e-15,
      `radius remains monotone at ${index}`);
    assert.ok(state.displacement >= previousDisplacement - 2e-15,
      `payout remains monotone at ${index}`);
    near(state.contactPoint.y,
      THREE.MathUtils.lerp(
        geometry.fuseeTopY,
        geometry.fuseeBottomY,
        turns / geometry.revolutionCount,
      ), 2e-15, `helical contact station ${index}`);
    previousRadius = state.localRadius;
    previousDisplacement = state.displacement;
  }
  near(stateAtDriveTurns(0).displacement, 0, 0, 'zero payout');
  near(stateAtDriveTurns(geometry.revolutionCount).displacement,
    geometry.carriageStroke, 3e-15 * geometry.carriageStroke, 'full payout');
  near(stateAtDriveTurns(0).localRadius,
    geometry.largeRadius, 0, 'large-end radius');
  near(stateAtDriveTurns(geometry.revolutionCount).localRadius,
    geometry.smallRadius, 0, 'small-end radius');
  disposeModel(model.root);
});

test('movement 358 obeys the local fusee radius and carriage-wheel no-slip laws', () => {
  const model = createMovementModel(catalog.movements[357]);
  const data = model.root.userData;
  const { geometry, profile, stateAtDriveTurns, transmission } = data;

  assert.match(transmission.profileLaw,
    /d\(carriage displacement\)\/d\(fusee angle\)/);
  assert.match(transmission.localNoSlipLaw,
    /carriageVelocity \+ shaftAngularSpeed \* localFuseeRadius = 0/);
  assert.match(transmission.doubleCordLaw,
    /first cord winds by exactly the length released by the second/);

  const differenceStep = 1e-6;
  // Sample stations between the profile knots at (k + 0.5) turns.
  for (const turns of [0.04, 0.83, 2.17, 4.33, 6.83, 8.83, 9.93]) {
    const turnRate = turns < geometry.revolutionCount / 2 ? 0.73 : -0.61;
    const state = stateAtDriveTurns(turns, turnRate, 0.14);
    const previous = stateAtDriveTurns(turns - differenceStep);
    const next = stateAtDriveTurns(turns + differenceStep);
    const derivativePerRadian = (
      next.displacement - previous.displacement
    ) / (2 * differenceStep * FULL_TURN);
    near(derivativePerRadian, state.localRadius, 4e-10,
      `local pitch-radius derivative ${turns}`);
    near(state.displacement,
      FULL_TURN * profile.radiusIntegralAtTurns(turns), 0,
      `integrated payout ${turns}`);
    near(state.carriagePosition,
      geometry.carriageStroke / 2 - state.displacement, 0,
      `carriage position ${turns}`);
    near(state.carriageVelocity
      + state.shaftAngularSpeed * state.localRadius,
    0, 8e-16, `stationary-cord tangential contact ${turns}`);
    near(state.surfaceContactVelocityX, 0, 8e-16,
      `reported cord contact ${turns}`);
    near(state.wheelAngularSpeed,
      -state.carriageVelocity / geometry.wheelRadius, 2e-15,
      `wheel rolling speed ${turns}`);
  }
  disposeModel(model.root);
});

test('movement 358 has smooth physical reversals and exposes the decreasing-radius speed change', () => {
  const model = createMovementModel(catalog.movements[357]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;

  // One crank turn per second at cruise over ten turns: a 22 s cycle.
  assert.equal(timeline.demonstrationPeriod, 22);
  assert.equal(timeline.strokeDuration, 10.7);
  assert.equal(timeline.dwellDuration, 0.3);
  const stroke = timeline.strokeDuration;
  const dwell = timeline.dwellDuration;
  const zero = stateAtTime(0);
  const outEnd = stateAtTime(stroke);
  const firstDwell = stateAtTime(stroke + dwell / 2);
  const returnStart = stateAtTime(stroke + dwell);
  const returnEnd = stateAtTime(2 * stroke + dwell);
  const secondDwell = stateAtTime(2 * stroke + 1.5 * dwell);
  const closure = stateAtTime(2 * (stroke + dwell));
  assert.equal(zero.phase, 'large-to-small-radius-stroke');
  assert.equal(firstDwell.phase, 'small-radius-end-dwell');
  assert.equal(returnStart.phase, 'small-to-large-radius-return');
  assert.equal(secondDwell.phase, 'large-radius-end-dwell');
  near(outEnd.driveTurns, geometry.revolutionCount, 2e-15,
    'outstroke turns');
  near(returnEnd.driveTurns, 0, 2e-15, 'return turns');
  for (const [name, state] of Object.entries({
    closure,
    firstDwell,
    outEnd,
    returnEnd,
    returnStart,
    secondDwell,
    zero,
  })) {
    near(state.driveTurnsPerSecond, 0, 2e-15,
      `${name} reversal velocity`);
    near(state.driveTurnsAcceleration, 0, 2e-14,
      `${name} reversal acceleration`);
  }
  vectorNear(closure.contactPoint, zero.contactPoint, 0,
    'cycle contact closure');
  near(closure.carriagePosition, zero.carriagePosition, 0,
    'cycle carriage closure');

  const earlyCruise = stateAtTime(1.3);
  const lateCruise = stateAtTime(stroke - 1.35);
  assert.ok(earlyCruise.driveTurnsPerSecond <= 1,
    'cruise stays within one crank turn per second');
  near(earlyCruise.driveTurnsPerSecond,
    lateCruise.driveTurnsPerSecond, 0, 'equal cruise input speed');
  assert.ok(earlyCruise.localRadius > lateCruise.localRadius);
  assert.ok(Math.abs(earlyCruise.carriageVelocity)
    > Math.abs(lateCruise.carriageVelocity));

  let previousOut = Infinity;
  let previousReturn = -Infinity;
  for (let index = 0; index <= 500; index += 1) {
    const out = stateAtTime(stroke * index / 500);
    const returning = stateAtTime(stroke + dwell + stroke * index / 500);
    assert.ok(out.carriagePosition <= previousOut + 2e-14,
      `outstroke monotonic ${index}`);
    assert.ok(returning.carriagePosition >= previousReturn - 2e-14,
      `return monotonic ${index}`);
    previousOut = out.carriagePosition;
    previousReturn = returning.carriagePosition;
  }
  disposeModel(model.root);
});

test('movement 358 renderer keeps every cord marker continuous across free and wrapped portions', () => {
  const model = createMovementModel(catalog.movements[357]);
  const data = model.root.userData;
  const { blocks, contacts, geometry } = data;
  const cords = [blocks.firstCord, blocks.secondCord];
  const minimumLengths = [Infinity, Infinity];
  const maximumLengths = [0, 0];
  let previousMarkers = null;
  let maximumMarkerStep = 0;

  for (let index = 0; index <= 1200; index += 1) {
    const time = geometry.cyclePeriod * index / 1200;
    const state = model.update(time);
    near(blocks.carriage.position.x, state.carriagePosition, 2e-15,
      `rendered carriage ${index}`);
    near(blocks.fuseeRotor.rotation.y, state.shaftAngle, 2e-15,
      `rendered fusee ${index}`);
    blocks.carriageWheels.forEach((wheel, wheelIndex) => {
      near(wheel.userData.rotor.rotation.z, state.wheelAngle, 2e-15,
        `rendered wheel ${wheelIndex}/${index}`);
      near(contacts.carriageWheels[wheelIndex].rollingVelocityError,
        0, 1e-15, `wheel rolling contact ${wheelIndex}/${index}`);
    });
    near(contacts.fuseeCords.commonTakeoffSeparation,
      .068, 1e-14, `finite separated takeoffs ${index}`);
    near(contacts.fuseeCords.tangentialVelocityError,
      0, 1e-16 * geometry.carriageStroke, `cord no-slip contact ${index}`);
    cords.forEach((cord, cordIndex) => {
      assert.ok(Number.isFinite(cord.userData.length));
      minimumLengths[cordIndex] = Math.min(
        minimumLengths[cordIndex],
        cord.userData.length,
      );
      maximumLengths[cordIndex] = Math.max(
        maximumLengths[cordIndex],
        cord.userData.length,
      );
    });
    const markers = cords.flatMap((cord) => cord.userData.markers.map(
      (marker) => marker.position.clone(),
    ));
    markers.forEach((marker, markerIndex) => {
      assert.ok(marker.toArray().every(Number.isFinite));
      if (previousMarkers) {
        maximumMarkerStep = Math.max(
          maximumMarkerStep,
          marker.distanceTo(previousMarkers[markerIndex]),
        );
      }
    });
    previousMarkers = markers;
  }
  maximumLengths.forEach((maximumLength, index) => {
    // The carriage law uses the pitch radius only; on Brown's steep cone
    // the ignored helical lay changes the rendered length by about 0.37%.
    assert.ok(maximumLength - minimumLengths[index] < 0.004 * maximumLength,
      `cord ${index} remains effectively inextensible`);
  });
  // Per-sample travel scales with the carriage stroke (0.09 per 10 units).
  assert.ok(maximumMarkerStep < 0.009 * geometry.carriageStroke,
    `arc-length markers have no path-transition jump: ${maximumMarkerStep}`);

  // The rendered cycle opens mid-stroke, as Brown draws it.
  model.update(data.timeline.strokeDuration / 2 - geometry.displayTimeOffset);
  near(data.cordState.firstWrappedProgress, 0.5, 2e-15,
    'first cord half wound');
  near(data.cordState.secondWrappedProgress, 0.5, 2e-15,
    'second cord half unwound');
  disposeModel(model.root);
});

test('movement 358 is reviewed while movement 507 remains the next authored draft', () => {
  const movement358 = catalog.movements[357];
  const model358 = createMovementModel(movement358);
  assert.equal(movement358.fidelity, 'authored');
  assert.equal(model358.root.userData.fidelity, 'authored');
  disposeModel(model358.root);

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
});
