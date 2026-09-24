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

test('movement 248 is the three-part union coupling A-B-C', () => {
  const movement = catalog.movements[247];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 248);
  assert.equal(movement.number, '248');
  assert.equal(movement.title, 'Three-Part Union Pipe Coupling');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'three-part-union-pipe-coupling-with-captive-flange-nut-and-right-hand-thread',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'nut-B-rotates-and-screws-on-fixed-pipe-C-so-its-inward-shoulder-clamps-the-nonrotating-flange-of-pipe-A-against-C',
  );
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.jointType, 'three-part-union-coupling');
  assert.equal(transmission.captiveNut, true);
  assert.equal(transmission.pipeRotationRequired, false);
  assert.equal(transmission.threadHand, 'right-hand');
  assert.equal(
    blocks.pipeA.userData.role,
    'nonrotating-upper-pipe-A-with-small-flange-and-locating-spigot',
  );
  assert.equal(
    blocks.nutB.userData.role,
    'rotating-captive-union-nut-B-with-internal-right-hand-thread',
  );
  assert.equal(
    blocks.pipeC.userData.role,
    'fixed-lower-pipe-C-with-external-threaded-end',
  );
  assert.equal(blocks.pipeC.userData.fixed, true);
  disposeModel(model.root);
});

test('movement 248 preserves the measured unavailable sectional plate', () => {
  const movement = catalog.movements[247];
  const model = createMovementModel(movement);
  const { sourceReference, stateAtTime } = model.root.userData;
  const plate = sourceReference.plate248;

  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 4);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.equal(plate.view,
    'longitudinal-section-through-three-coaxial-union-parts');
  assert.deepEqual(plate.rasterPipeABounds, {
    bottom: 309,
    left: 159,
    right: 352,
    top: 13,
  });
  assert.deepEqual(plate.rasterPipeAFlangeBounds, {
    bottom: 241,
    left: 114,
    right: 399,
    top: 198,
  });
  assert.deepEqual(plate.rasterNutBBounds, {
    bottom: 349,
    left: 62,
    right: 462,
    top: 160,
  });
  assert.deepEqual(plate.rasterPipeCBodyBounds, {
    bottom: 502,
    left: 159,
    right: 368,
    top: 239,
  });
  assert.deepEqual(plate.rasterPipeBoreBounds, {
    left: 193,
    right: 329,
  });
  assert.deepEqual(plate.rasterThreadBounds, {
    bottom: 355,
    left: 111,
    right: 413,
    top: 238,
  });
  assert.match(plate.inferredTopology, /inward shoulder/);
  assert.match(plate.inferredTopology, /internal thread/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 63,
    edition: 21,
    illustrationPage: 62,
    publicationYear: 1908,
  });
  const source = stateAtTime(0);
  assert.equal(source.sourcePose, true);
  assert.equal(source.stage, 'tight-dwell');
  assert.equal(source.jointSealed, true);
  disposeModel(model.root);
});

test('movement 248 flange is captured by B while its spigot seats in C with positive clearances', () => {
  const model = createMovementModel(catalog.movements[247]);
  const { geometry, stateAtTime, timeline } = model.root.userData;

  assert.ok(geometry.flangeRadius > geometry.nutShoulderBoreRadius);
  near(
    geometry.flangeRadius - geometry.nutShoulderBoreRadius,
    geometry.captiveShoulderOverlap,
    0,
    'flange captured beneath nut shoulder',
  );
  assert.ok(geometry.flangeRadius < geometry.nutCavityRadius);
  near(
    geometry.nutCavityRadius - geometry.flangeRadius,
    geometry.flangeToNutCavityRadialClearance,
    0,
    'flange radial clearance inside nut',
  );
  assert.ok(geometry.pipeAOuterRadius < geometry.nutShoulderBoreRadius);
  assert.ok(geometry.spigotOuterRadius < geometry.counterboreRadius);
  near(
    geometry.counterboreRadius - geometry.spigotOuterRadius,
    geometry.spigotRadialClearance,
    0,
    'spigot radial clearance',
  );
  assert.ok(geometry.spigotBottomClearance > 0.029);

  let minimumShoulderGap = Infinity;
  let minimumSeatGap = Infinity;
  let maximumCapturedGap = 0;
  for (let sample = 0; sample <= 65536; sample += 1) {
    const time = timeline.cycleClosure * sample / 65536;
    const state = stateAtTime(time);
    minimumShoulderGap = Math.min(minimumShoulderGap, state.shoulderGap);
    minimumSeatGap = Math.min(minimumSeatGap, state.seatGap);
    if (time >= timeline.flangeCaptured
      && time <= timeline.returnedTogether) {
      maximumCapturedGap = Math.max(
        maximumCapturedGap,
        Math.abs(state.shoulderGap),
      );
      assert.equal(state.captiveCarryActive, true);
      near(
        state.nutYVelocity,
        state.pipeAVelocity,
        0,
        `captured common velocity at ${sample}`,
      );
    }
  }
  assert.ok(minimumShoulderGap > -5e-16);
  assert.equal(minimumSeatGap, 0);
  assert.ok(maximumCapturedGap < 9e-16);
  disposeModel(model.root);
});

test('movement 248 nut obeys one exact right-hand screw law whenever B and C are engaged', () => {
  const model = createMovementModel(catalog.movements[247]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  let maximumAxialError = 0;
  let maximumPhaseError = 0;
  let maximumPhaseVelocityError = 0;
  let maximumPhaseAccelerationError = 0;
  let maximumRadialVelocityError = 0;
  let maximumFlankVelocityError = 0;

  for (let sample = 0; sample <= 65536; sample += 1) {
    const time = timeline.cycleClosure * sample / 65536;
    const state = stateAtTime(time);
    if (!state.threadEngaged) continue;
    maximumAxialError = Math.max(
      maximumAxialError,
      Math.abs(state.threadAxialConstraintError),
    );
    maximumPhaseError = Math.max(
      maximumPhaseError,
      Math.abs(state.threadPhaseError),
    );
    maximumPhaseVelocityError = Math.max(
      maximumPhaseVelocityError,
      Math.abs(state.threadPhaseVelocityError),
    );
    maximumPhaseAccelerationError = Math.max(
      maximumPhaseAccelerationError,
      Math.abs(state.threadPhaseAccelerationError),
    );
    maximumRadialVelocityError = Math.max(
      maximumRadialVelocityError,
      Math.abs(state.threadRadialNormalVelocityError),
    );
    maximumFlankVelocityError = Math.max(
      maximumFlankVelocityError,
      Math.abs(state.threadFlankNormalVelocityError),
    );
  }
  assert.ok(maximumAxialError < 1.2e-16);
  assert.ok(maximumPhaseError < 3.6e-15);
  assert.ok(maximumPhaseVelocityError < 1.8e-15);
  assert.ok(maximumPhaseAccelerationError < 1.8e-15);
  assert.ok(maximumRadialVelocityError < 4e-30);
  assert.ok(maximumFlankVelocityError < 2.3e-16);
  near(geometry.unscrewTravel,
    geometry.loosenTurns * geometry.threadLead, 0,
    'three-turn axial travel');
  near(geometry.looseNutAngle, -geometry.loosenTurns * Math.PI * 2, 0,
    'counter-rotation required to loosen');
  assert.ok(geometry.threadRadialClearance > 0.003);
  assert.ok(geometry.disengagedThreadAxialClearance > 0.019);
  disposeModel(model.root);
});

test('movement 248 disconnects without rotating either pipe and reconnects in source order', () => {
  const model = createMovementModel(catalog.movements[247]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  const expectedStages = [
    [0.2, 'tight-dwell'],
    [1.8, 'unscrewing-nut-B'],
    [3.3, 'loose-thread-dwell'],
    [4.0, 'lifting-A-to-captive-shoulder'],
    [5.0, 'withdrawing-captive-A-and-B'],
    [6.0, 'separated-dwell'],
    [7.0, 'returning-captive-A-and-B'],
    [8.2, 'lowering-A-onto-C'],
    [9.8, 'tightening-nut-B'],
    [11.5, 'tight-dwell'],
  ];
  for (const [time, expected] of expectedStages) {
    const state = stateAtTime(time);
    assert.equal(state.stage, expected);
    assert.equal(state.pipeARotation, 0);
  }

  const loose = stateAtTime(timeline.unscrewed + 1e-8);
  assert.equal(loose.threadEngaged, false);
  assert.ok(loose.threadAxialClearance > 0.019);
  assert.equal(loose.flangeToCContactActive, true);
  assert.equal(loose.nutShoulderToFlangeContactActive, false);

  const captured = stateAtTime(timeline.flangeCaptured + 1e-8);
  assert.equal(captured.threadEngaged, false);
  assert.equal(captured.nutShoulderToFlangeContactActive, true);
  assert.equal(captured.captiveCarryActive, true);

  const separated = stateAtTime(timeline.fullySeparated + 1e-8);
  assert.equal(separated.flangeToCContactActive, false);
  near(
    separated.pipeAOffset,
    geometry.unscrewTravel + geometry.separationTravel,
    2e-15,
    'full withdrawal',
  );
  assert.ok(separated.spigotBottomWorldY > geometry.pipeCSeatY);

  const tight = stateAtTime(timeline.retightened + 1e-8);
  assert.equal(tight.threadEngaged, true);
  assert.equal(tight.flangeToCContactActive, true);
  assert.equal(tight.nutShoulderToFlangeContactActive, true);
  assert.equal(tight.jointSealed, true);
  disposeModel(model.root);
});

test('movement 248 renderer has real bores, matching helices, a cutaway nut, and exact rigid transforms', () => {
  const model = createMovementModel(catalog.movements[247]);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  assert.equal(blocks.nutSectionFaces.length, 2);
  // Brown draws A whole (unhatched, bore dashed); only B and C are halved.
  assert.equal(blocks.pipeASectionFaces.length, 0);
  assert.equal(blocks.pipeCSectionFaces.length, 4);
  assert.equal(blocks.flangeSectionFaces.length, 0);
  assert.equal(blocks.spigotSectionFaces.length, 0);
  assert.equal(blocks.externalThread.userData.rightHand, true);
  assert.equal(blocks.internalThread.userData.rightHand, true);
  assert.equal(blocks.externalThread.userData.turns, 3);
  assert.equal(blocks.internalThread.userData.turns, 3);
  near(blocks.externalThread.userData.pitch, geometry.threadPitch, 0,
    'external thread pitch');
  near(blocks.internalThread.userData.pitch, geometry.threadPitch, 0,
    'internal thread pitch');
  assert.equal(blocks.gripRibs.length, 10);
  assert.equal(
    blocks.gripRibs.filter(({ userData }) => (
      userData.role === 'white-rotation-index-on-nut-B'
    )).length,
    1,
  );

  const pipeCPosition = blocks.pipeC.position.clone();
  const pipeCQuaternion = blocks.pipeC.quaternion.clone();
  for (const time of [0, 1.5, 3.3, 4.1, 5.2, 6.0, 7.1, 8.2, 9.7]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    near(blocks.pipeA.position.y, state.pipeAOffset, 0,
      `rendered A translation at ${time}`);
    near(blocks.pipeA.rotation.y, 0, 0,
      `rendered A rotation at ${time}`);
    near(blocks.nutB.position.y, state.nutY, 0,
      `rendered B translation at ${time}`);
    near(blocks.nutB.rotation.y, state.nutAngle, 0,
      `rendered B rotation at ${time}`);
    vectorNear(blocks.pipeC.position, pipeCPosition, 0,
      `fixed C position at ${time}`);
    near(blocks.pipeC.quaternion.angleTo(pipeCQuaternion), 0, 0,
      `fixed C rotation at ${time}`);
    const contacts = model.root.userData.contacts;
    near(contacts.AFlangeToCEndFace.gap, state.seatGap, 0,
      `rendered seat gap at ${time}`);
    near(contacts.BShoulderToAFlange.gap, state.shoulderGap, 0,
      `rendered shoulder gap at ${time}`);
    assert.equal(contacts.continuousFluidBore.aligned, true);
    near(contacts.continuousFluidBore.radius, geometry.pipeBoreRadius, 0,
      `continuous bore radius at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 248 analytic pipe and nut rates agree with finite differences', () => {
  const model = createMovementModel(catalog.movements[247]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-5;
  for (const time of [
    1.2,
    2.4,
    3.8,
    4.15,
    4.8,
    5.3,
    6.8,
    7.3,
    8.0,
    8.35,
    9.3,
    10.5,
  ]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    for (const [positionKey, velocityKey, accelerationKey, label] of [
      ['pipeAOffset', 'pipeAVelocity', 'pipeAAcceleration', 'pipe A'],
      ['nutY', 'nutYVelocity', 'nutYAcceleration', 'nut axial'],
      [
        'nutAngle',
        'nutAngularSpeed',
        'nutAngularAcceleration',
        'nut angular',
      ],
    ]) {
      near(
        (after[positionKey] - before[positionKey]) / (2 * step),
        state[velocityKey],
        7e-8,
        `${label} velocity at ${time}`,
      );
      near(
        (after[velocityKey] - before[velocityKey]) / (2 * step),
        state[accelerationKey],
        8e-7,
        `${label} acceleration at ${time}`,
      );
    }
  }
  disposeModel(model.root);
});

test('movement 248 closes exactly in twelve seconds and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[247]);
  const { animationTiming, stateAtTime, timeline } = model.root.userData;
  const start = stateAtTime(0);
  const end = stateAtTime(timeline.cycleClosure);

  for (const key of ['pipeAOffset', 'nutY', 'nutAngle']) {
    near(end[key], start[key], 0, `closed ${key}`);
  }
  assert.equal(end.stage, start.stage);
  assert.equal(end.jointSealed, true);
  near(animationTiming.authoredCyclePeriod, 12, 0,
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
