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

test('movement 235 is one six-tooth ratchet, one hinged tappet, and one holding click', () => {
  const movement = catalog.movements[234];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 235);
  assert.equal(movement.number, '235');
  assert.equal(movement.title, 'Spring-Held Tappet-Arm Ratchet');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'spring-held-hinged-tappet-arm-six-tooth-star-ratchet',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.holdingClickPreventsReverse, true);
  assert.equal(transmission.returnStrokeWheelDwell, true);
  assert.equal(transmission.tappetRigidAgainstSpringStopDuringDrive, true);
  near(transmission.outputTeethPerCarrierCycle, 1, 2e-15,
    'one ratchet tooth per arm cycle');
  assert.equal(blocks.ratchet.parent, model.root);
  assert.equal(blocks.ratchetShaft.parent, model.root);
  assert.equal(blocks.carrierGroup.parent, model.root);
  assert.equal(blocks.tappet.parent, model.root);
  assert.equal(blocks.tappetSpring.parent, blocks.carrierGroup);
  assert.equal(blocks.holdingClick.parent, model.root);
  assert.notEqual(blocks.tappet, blocks.holdingClick);
  assert.equal(blocks.ratchet.userData.teeth, 6);
  assert.equal(blocks.ratchet.userData.profilePoints.length, 18);
  disposeModel(model.root);
});

test('movement 235 preserves the measured engraving layout and straight-face design', () => {
  const model = createMovementModel(catalog.movements[234]);
  const {
    driveContactAtCarrierAngle,
    geometry,
    sourceReference,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const plate = sourceReference.plate235;

  assert.deepEqual(plate.rasterWheelCenter.toArray(), [168, 235]);
  assert.deepEqual(plate.rasterCarrierPivot.toArray(), [455, 338]);
  assert.deepEqual(plate.rasterTappetHinge.toArray(), [319, 331]);
  // The nose centre sits on Brown's dashed swing arc (254 px about the pivot).
  assert.deepEqual(plate.rasterTappetNose.toArray(), [204.3, 297]);
  // The click's eye sits a little above Brown's hole (153) so the hook
  // runs round the points in one sweep.
  assert.deepEqual(plate.rasterHoldingClickPivot.toArray(), [159, 141]);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.inferredRatchetTeeth, 6);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.match(plate.inferredTopology, /hinged driving tappet/);
  assert.deepEqual(sourceReference.primaryScan, {
    edition: 21,
    printedPage: 61,
    publicationYear: 1908,
  });

  near(geometry.toothPitch, FULL_TURN / 6, 0, 'six-tooth pitch');
  near(
    geometry.driveFaceAngularSpan,
    THREE.MathUtils.degToRad(52),
    0,
    'raked teeth: an almost radial working face (8 degrees) and a long back',
  );
  // Brown's stubby points: the root circle is about 0.6 of the tip circle.
  assert.ok(geometry.ratchetRootRadius > geometry.ratchetOuterRadius * 0.55);
  assert.ok(geometry.ratchetRootRadius < geometry.ratchetOuterRadius * 0.62);
  assert.ok(geometry.sourceContactFraction > 0.15);
  assert.ok(geometry.sourceContactFraction < 0.2);
  vectorNear(
    stateAtCycleCoordinate(0).tappetHinge,
    geometry.sourceHinge,
    2e-15,
    'source tappet hinge',
  );
  vectorNear(
    stateAtCycleCoordinate(0).tappetNoseCenter,
    geometry.sourceNoseCenter,
    2e-15,
    'source tappet nose',
  );
  const sourceContact = driveContactAtCarrierAngle(
    geometry.sourceCarrierAngle,
  );
  const endContact = driveContactAtCarrierAngle(
    geometry.driveCarrierEndAngle,
  );
  near(sourceContact.wheelTravel, 0, 2e-15,
    'source face starts the index');
  near(endContact.wheelTravel, geometry.toothPitch, 3e-15,
    'straight face finishes one pitch');
  assert.ok(sourceContact.contactFraction >= 0);
  assert.ok(endContact.contactFraction <= 1);
  disposeModel(model.root);
});

test('movement 235 keeps the spring-held tappet exactly on one drive face', () => {
  const model = createMovementModel(catalog.movements[234]);
  const {
    geometry,
    stateAtCycleCoordinate,
    timeline,
  } = model.root.userData;
  const samples = 16_384;
  let previousWheelAngle = -Infinity;
  let minimumContactFraction = Infinity;
  let maximumContactFraction = -Infinity;
  let maximumWheelSpeed = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const coordinate = timeline.driveEndPhase * sample / samples;
    const state = stateAtCycleCoordinate(coordinate);
    assert.equal(state.stage, 'spring-held-tappet-driving-one-tooth');
    assert.equal(state.tappetDelta, 0);
    assert.ok(state.driveContact);
    assert.ok(state.driveContact.contactError < 2e-12);
    assert.ok(state.driveContact.normalVelocityError < 2e-11);
    assert.ok(state.driveContact.contactFraction >= -1e-12);
    assert.ok(state.driveContact.contactFraction <= 1 + 1e-12);
    assert.ok(state.wheelAngle >= previousWheelAngle - 2e-13);
    assert.ok(state.wheelAngularSpeed >= -2e-12);
    previousWheelAngle = state.wheelAngle;
    minimumContactFraction = Math.min(
      minimumContactFraction,
      state.driveContact.contactFraction,
    );
    maximumContactFraction = Math.max(
      maximumContactFraction,
      state.driveContact.contactFraction,
    );
    maximumWheelSpeed = Math.max(maximumWheelSpeed, state.wheelAngularSpeed);
  }
  near(minimumContactFraction, geometry.sourceContactFraction, 2e-12,
    'drive starts at the measured face fraction');
  assert.ok(maximumContactFraction > 0.8);
  assert.ok(maximumWheelSpeed > 2);
  const indexed = stateAtCycleCoordinate(timeline.driveEndPhase);
  near(indexed.wheelAngle, geometry.toothPitch, 3e-15,
    'drive advances one exact pitch');
  assert.equal(indexed.wheelAngularSpeed, 0);
  disposeModel(model.root);
});

test('movement 235 tappet yields only on return and clears the tooth before spring reset', () => {
  const model = createMovementModel(catalog.movements[234]);
  const {
    geometry,
    stateAtCycleCoordinate,
    timeline,
  } = model.root.userData;
  const stages = new Set();
  let maximumReturnDeflection = 0;
  let contactSegments = new Set();
  for (let sample = 0; sample <= 8192; sample += 1) {
    const coordinate = sample / 8192;
    const state = stateAtCycleCoordinate(coordinate);
    stages.add(state.stage);
    if (coordinate >= timeline.driveEndPhase) {
      near(state.wheelAngle, geometry.toothPitch, 4e-15,
        `wheel dwell at ${coordinate}`);
      assert.equal(state.wheelAngularSpeed, 0);
      assert.ok(state.tappetClearance >= -3e-12);
    }
    if (state.returnContact?.engaged) {
      assert.ok(state.returnContact.clearance >= -1e-4 && state.returnContact.clearance < .008);
      assert.ok(state.returnContact.contactError < .008);
      assert.ok(state.tappetDelta <= .006001);
      contactSegments.add(state.returnContact.segmentIndex);
    }
    maximumReturnDeflection = Math.max(
      maximumReturnDeflection,
      Math.abs(state.tappetDelta),
    );
  }
  assert.deepEqual([...stages], [
    'spring-held-tappet-driving-one-tooth',
    'handoff-dwell-after-index',
    'holding-dwell-before-return',
    'tappet-yielding-over-next-tooth',
    'tappet-clearing-tooth-tip',
    'spring-returning-tappet-to-stop',
    'arm-rising-from-low-clearance-to-drive-face',
  ]);
  assert.ok(contactSegments.size >= 2, 'the nose traverses adjacent tooth faces');
  assert.ok(maximumReturnDeflection > .40 && maximumReturnDeflection <= .43);
  assert.equal(stateAtCycleCoordinate(0).tappetDelta, 0);
  assert.ok(stateAtCycleCoordinate(timeline.topOvertravelEndPhase).tappetClearance > .0003,
    'the prescribed transfer dwell releases the tappet without penetrating the star');
  assert.equal(stateAtCycleCoordinate(1).tappetDelta, 0);
  disposeModel(model.root);
});

test('movement 235 upper click lifts for forward indexing and locks reverse dwell', () => {
  const model = createMovementModel(catalog.movements[234]);
  const {
    geometry,
    stateAtCycleCoordinate,
    timeline,
  } = model.root.userData;
  const source = stateAtCycleCoordinate(0);
  const dwell = stateAtCycleCoordinate(timeline.driveEndPhase);

  assert.equal(source.holdingClickEngaged, true);
  assert.equal(source.holdingClickDeflected, false);
  near(source.holdingClickState.clearance, .0005, 2e-15,
    'source holding-click seat');
  assert.ok(source.holdingTorque > 0, 'holding face resists clockwise reversal');
  assert.equal(dwell.holdingClickEngaged, true);
  assert.equal(dwell.holdingClickDeflected, false);
  assert.equal(dwell.ratchetLockedAgainstReverse, true);
  assert.ok(dwell.holdingTorque > 0);

  let maximumClickLift = 0;
  let deflectedSamples = 0;
  for (let sample = 0; sample <= 4096; sample += 1) {
    const coordinate = timeline.driveEndPhase * sample / 4096;
    const state = stateAtCycleCoordinate(coordinate);
    vectorNear(
      state.holdingClickState.center,
      geometry.holdingClickPivot.clone().add(new THREE.Vector2(
        Math.cos(state.holdingClickAngle) * geometry.holdingClickLength,
        Math.sin(state.holdingClickAngle) * geometry.holdingClickLength,
      )),
      2e-15,
      `fixed-length holding click at ${coordinate}`,
    );
    if (state.holdingClickDeflected) {
      deflectedSamples += 1;
      assert.ok(state.holdingClickState.clearance >= -1e-4); // prescribed clear lift/drop, not continuous seating
      maximumClickLift = Math.max(
        maximumClickLift,
        Math.abs(state.holdingClickDelta),
      );
    }
  }
  assert.ok(deflectedSamples > 500);
  // The stubby points lift the click less than the old long spikes did.
  assert.ok(maximumClickLift > THREE.MathUtils.degToRad(16));
  assert.ok(maximumClickLift < THREE.MathUtils.degToRad(19));
  disposeModel(model.root);
});

test('movement 235 reported angular speeds match finite differences', () => {
  const model = createMovementModel(catalog.movements[234]);
  const {
    stateAtCycleCoordinate,
    timeline,
  } = model.root.userData;
  const epsilon = 2e-6;
  const speedAt = (coordinate, key) => (
    stateAtCycleCoordinate(coordinate + epsilon)[key]
    - stateAtCycleCoordinate(coordinate - epsilon)[key]
  ) * timeline.cyclesPerSecond / (2 * epsilon);
  for (const coordinate of [
    0.04,
    0.1,
    0.15,
    0.18,
    0.22,
    0.3,
    0.41,
    0.52,
    0.61,
    0.68,
    0.735,
    0.78,
    0.9,
    0.97,
  ]) {
    const state = stateAtCycleCoordinate(coordinate);
    near(
      state.carrierAngularSpeed,
      speedAt(coordinate, 'carrierAngle'),
      2e-7,
      `carrier angular speed at ${coordinate}`,
    );
    near(
      state.tappetAngularSpeed,
      speedAt(coordinate, 'tappetAngle'),
      3e-5,
      `tappet angular speed at ${coordinate}`,
    );
    near(
      state.wheelAngularSpeed,
      speedAt(coordinate, 'wheelAngle'),
      3e-7,
      `wheel angular speed at ${coordinate}`,
    );
    near(
      state.holdingClickAngularSpeed,
      speedAt(coordinate, 'holdingClickAngle'),
      3e-5,
      `holding-click angular speed at ${coordinate}`,
    );
  }
  disposeModel(model.root);
});

test('movement 235 renderer binds the arm, tappet, spring, wheel, and two contacts', () => {
  const model = createMovementModel(catalog.movements[234]);
  const {
    blocks,
    timeline,
  } = model.root.userData;

  model.update(timeline.cyclePeriod * 0.18);
  let state = model.root.userData.kinematics;
  near(blocks.carrierGroup.rotation.z, state.carrierAngle, 0,
    'rendered driving arm angle');
  near(blocks.tappet.rotation.z, state.tappetAngle, 0,
    'rendered driving tappet angle');
  near(blocks.ratchet.userData.rotor.rotation.z, state.wheelAngle, 0,
    'rendered indexed wheel angle');
  near(blocks.holdingClick.rotation.z, state.holdingClickAngle, 0,
    'rendered lifted holding click');
  assert.ok([].concat(blocks.driveContactMarker.material).every((material) => material.visible === false), 'contact markers are not drawn on the plate');
  assert.ok([].concat(blocks.holdingContactMarker.material).every((material) => material.visible === false), 'contact markers are not drawn on the plate');
  assert.ok([].concat(blocks.returnContactMarker.material).every((material) => material.visible === false), 'contact markers are not drawn on the plate');

  model.update(timeline.cyclePeriod * 0.6);
  state = model.root.userData.kinematics;
  assert.ok([].concat(blocks.driveContactMarker.material).every((material) => material.visible === false), 'contact markers are not drawn on the plate');
  assert.ok([].concat(blocks.returnContactMarker.material).every((material) => material.visible === false), 'contact markers are not drawn on the plate');
  assert.ok([].concat(blocks.holdingContactMarker.material).every((material) => material.visible === false), 'contact markers are not drawn on the plate');
  vectorNear(
    new THREE.Vector2(
      blocks.returnContactMarker.position.x,
      blocks.returnContactMarker.position.y,
    ),
    state.returnContact.profilePoint,
    0,
    'rendered return contact',
  );

  model.update(timeline.cyclePeriod * 0.8);
  state = model.root.userData.kinematics;
  assert.equal(state.stage, 'spring-returning-tappet-to-stop');
  assert.ok([].concat(blocks.returnContactMarker.material).every((material) => material.visible === false), 'contact markers are not drawn on the plate');
  assert.ok(blocks.tappetSpring.userData.curve);
  assert.equal(blocks.ratchet.userData.indicator.userData.role,
    'ratchet-wheel-face-index');
  model.root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model.root)
    .getSize(new THREE.Vector3());
  // Without the undrawn base block the drawn parts span about 6.06 × 3.62.
  assert.ok(size.x > 5.9);
  assert.ok(size.y > 3.5);
  // p101: the arbor and arm pin end at their parts (depth about 0.75).
  assert.ok(size.z > 0.7);
  let meshCount = 0;
  model.root.traverse((object) => { if (object.isMesh) meshCount += 1; });
  assert.ok(meshCount >= 19); // no undrawn base block and no cross-pin noses
  disposeModel(model.root);
});

test('movement 235 closes after six indexes and leaves 269 authored', () => {
  const model = createMovementModel(catalog.movements[234]);
  const {
    animationTiming,
    geometry,
    stateAtCycleCoordinate,
    timeline,
  } = model.root.userData;
  const source = stateAtCycleCoordinate(0);
  for (let cycle = 1; cycle <= geometry.toothCount; cycle += 1) {
    const closure = stateAtCycleCoordinate(cycle);
    near(
      closure.wheelAngle - source.wheelAngle,
      cycle * geometry.toothPitch,
      4e-15,
      `ratchet advances ${cycle} tooth pitches`,
    );
    near(closure.carrierAngle, source.carrierAngle, 0,
      `arm closes cycle ${cycle}`);
    near(closure.tappetAngle, source.tappetAngle, 0,
      `tappet closes cycle ${cycle}`);
  }
  near(stateAtCycleCoordinate(geometry.toothCount).wheelAngle, FULL_TURN,
    4e-15, 'six indexes make one wheel revolution');
  assert.equal(animationTiming.authoredCyclePeriod, timeline.cyclePeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model289.root);
});
