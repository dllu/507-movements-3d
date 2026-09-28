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

test('movement 234 is one odd-tooth crown wheel and one two-pallet verge', () => {
  const movement = catalog.movements[233];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 234);
  assert.equal(movement.number, '234');
  assert.equal(movement.title, 'Verge and Crown-Wheel Escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype, 'verge-and-crown-wheel-escapement');
  assert.equal(archetype, movement.archetype);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.oddToothCountRequired, true);
  assert.equal(transmission.beatsPerCycle, 2);
  assert.equal(transmission.outputAdvancePerBeatInToothPitches, 0.5);
  assert.equal(transmission.outputAdvancePerOscillationInToothPitches, 1);
  assert.equal(blocks.crownWheel.parent, model.root);
  assert.equal(blocks.crownShaft.parent, model.root);
  assert.equal(blocks.verge.parent, model.root);
  assert.equal(blocks.spindle.parent, blocks.verge);
  assert.equal(blocks.rightPallet.pallet.parent, blocks.verge);
  assert.equal(blocks.leftPallet.pallet.parent, blocks.verge);
  assert.notEqual(blocks.rightPallet.pallet, blocks.leftPallet.pallet);
  assert.equal(blocks.crownWheel.userData.teeth, 13);
  assert.equal(blocks.crownWheel.userData.toothMeshes.length, 13);
  assert.equal(blocks.crownWheel.userData.toothTips.length, 13);
  // Brown draws no frame or bearings.
  assert.equal(blocks.bearings.length, 0);
  assert.equal(blocks.frameBeams.length, 0);
  near(
    blocks.crownWheel.userData.axis.dot(blocks.verge.userData.axis),
    0,
    0,
    'crown arbor and verge spindle are perpendicular',
  );
  disposeModel(model.root);
});

test('movement 234 preserves the source layout and exact verge design equation', () => {
  const model = createMovementModel(catalog.movements[233]);
  const {
    geometry,
    sourceReference,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const plate = sourceReference.plate234;

  assert.deepEqual(plate.rasterWheelCenter.toArray(), [264, 291]);
  assert.deepEqual(plate.rasterLeftPalletCenter.toArray(), [231, 216]);
  assert.deepEqual(plate.rasterRightPalletCenter.toArray(), [338, 274]);
  assert.deepEqual(
    plate.rasterSpindleEndpoints.map((point) => point.toArray()),
    [[96, 117], [443, 260]],
  );
  assert.equal(plate.rasterImageWidth, 525);
  assert.equal(plate.rasterImageHeight, 525);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.match(plate.inferredTopology, /one crown wheel/);
  assert.deepEqual(sourceReference.primaryScan, {
    edition: 21,
    printedPage: 61,
    publicationYear: 1908,
  });
  assert.match(sourceReference.geometryReference.finding, /odd/);
  assert.match(sourceReference.geometryReference.finding, /positive clearance/);

  assert.equal(geometry.toothCount, 13);
  assert.equal(geometry.toothCount % 2, 1);
  near(geometry.toothPitch, FULL_TURN / 13, 0,
    'thirteen-tooth pitch');
  near(
    geometry.palletIncludedAngle,
    THREE.MathUtils.degToRad(70),
    0,
    'pallet included angle for Brown\'s steeply hanging flags',
  );
  // A 13-degree half swing on a 70-degree verge hangs Brown's flags steeply
  // (0.88 long, S 0.59 above the tips).
  near(geometry.vergeAmplitude, THREE.MathUtils.degToRad(13), 0,
    'verge half swing');
  near(geometry.dropFractionOfPitch, 0.1, 0,
    'positive drop is one tenth pitch');
  near(
    geometry.contactAdvance + geometry.dropAngle,
    geometry.toothPitch / 2,
    0,
    'contact lift plus drop advances exactly one beat',
  );
  near(
    geometry.releaseContactAngle - geometry.dropContactAngle,
    geometry.contactAdvance,
    3e-17,
    'root-to-tip wheel travel solves the verge equation',
  );
  const solvedTravel = Math.asin(
    geometry.heightToRadiusRatio * Math.tan(
      geometry.palletHalfAngle + geometry.vergeAmplitude,
    ),
  ) - Math.asin(
    geometry.heightToRadiusRatio * Math.tan(
      geometry.palletHalfAngle - geometry.vergeAmplitude,
    ),
  );
  near(solvedTravel, geometry.targetContactTravel, 3e-17,
    'height ratio satisfies the exact trigonometric design equation');
  near(geometry.firstDropClearanceAngle, geometry.dropAngle, 2e-16,
    'opposite tooth has positive angular clearance at release');
  assert.ok(geometry.firstDropClearanceAngle > 0);
  near(
    geometry.vergeAxisZ - geometry.toothTipZ,
    geometry.heightDrop,
    2e-16,
    'verge height above the crown tooth tips',
  );
  near(
    geometry.palletRootDistance,
    geometry.heightDrop / Math.cos(
      geometry.palletHalfAngle - geometry.vergeAmplitude,
    ),
    0,
    'pallet root radius',
  );
  near(
    geometry.palletTipDistance,
    geometry.heightDrop / Math.cos(
      geometry.palletHalfAngle + geometry.vergeAmplitude,
    ),
    0,
    'pallet release-tip radius',
  );
  assert.ok(geometry.palletTipDistance > geometry.palletRootDistance);

  const cycleStart = stateAtCycleCoordinate(0);
  assert.equal(cycleStart.activePallet, 'right');
  assert.equal(cycleStart.activeToothIndex, 0);
  assert.equal(cycleStart.dwell, true);
  near(cycleStart.vergeAngle, -geometry.vergeAmplitude, 0,
    'cycle-start verge angle');
  near(cycleStart.wheelAngle, 0, 0, 'cycle-start crown-wheel angle');
  near(cycleStart.contact.contactCoordinate, 0, 4e-16,
    'cycle-start tooth rests at the pallet root');
  // Brown's pose, with both flags hanging in view, is mid-impulse of the
  // right flag; the display clock starts there.
  near(geometry.displayCycleOffset, 0.22, 0, 'display cycle offset');
  const source = stateAtCycleCoordinate(geometry.displayCycleOffset);
  assert.equal(source.sourcePose, true);
  assert.equal(cycleStart.sourcePose, false);
  assert.equal(source.activePallet, 'right');
  assert.equal(source.drivingContact, true);
  near(source.vergeAngle, 0, 1e-15, 'source verge angle at mid-swing');
  near(model.root.userData.stateAtTime(0).wheelAngle, source.wheelAngle, 0,
    'display clock starts at the source pose');
  disposeModel(model.root);
});

test('movement 234 alternates lock, impulse, and positive drop through 65,537 states', () => {
  const model = createMovementModel(catalog.movements[233]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  let previousWheelAngle = -Infinity;
  let rightContacts = 0;
  let leftContacts = 0;
  let freeDrops = 0;
  let driveStates = 0;
  let dwellStates = 0;
  for (let index = 0; index <= 65536; index += 1) {
    const state = stateAtCycleCoordinate(index / 65536);
    for (const value of [
      state.vergeAngle,
      state.vergeAngularSpeed,
      state.vergeAngularAcceleration,
      state.wheelAngle,
      state.wheelAngularSpeed,
      state.wheelAngularAcceleration,
      state.teethAdvanced,
    ]) assert.ok(Number.isFinite(value));
    assert.ok(state.wheelAngle >= previousWheelAngle - 3e-15);
    previousWheelAngle = state.wheelAngle;
    assert.ok(state.wheelAngle >= -3e-15);
    assert.ok(state.wheelAngle <= geometry.toothPitch + 3e-15);
    assert.equal(state.contact !== null, state.activePallet !== null);
    assert.equal(state.freeDrop, state.activePallet === null);
    assert.equal(state.freeDrop, state.freeDropState !== null);
    assert.equal(state.drivingContact && state.dwell, false);
    assert.equal(state.drivingContact && state.freeDrop, false);
    assert.equal(state.dwell && state.freeDrop, false);
    assert.ok(state.wheelAngularSpeed >= -2e-14);
    if (state.activePallet === 'right') rightContacts += 1;
    if (state.activePallet === 'left') leftContacts += 1;
    if (state.freeDrop) freeDrops += 1;
    if (state.drivingContact) driveStates += 1;
    if (state.dwell) {
      dwellStates += 1;
      near(state.wheelAngularSpeed, 0, 0, 'locked wheel is stationary');
      near(state.vergeAngularSpeed, 0, 0, 'locked verge is stationary');
    }
  }
  assert.ok(rightContacts > 20000);
  assert.ok(leftContacts > 20000);
  assert.ok(freeDrops > 7000);
  assert.ok(driveStates > 30000);
  assert.ok(dwellStates > 18000);

  near(stateAtCycleCoordinate(0.1).wheelAngle, 0, 0,
    'right impulse begins at its pallet root');
  near(
    stateAtCycleCoordinate(0.34).wheelAngle,
    geometry.contactAdvance,
    0,
    'right pallet releases after the contact lift',
  );
  near(
    stateAtCycleCoordinate(0.4).wheelAngle,
    geometry.toothPitch / 2,
    3e-16,
    'first drop completes one half-pitch beat',
  );
  near(
    stateAtCycleCoordinate(0.58).wheelAngle,
    geometry.toothPitch / 2,
    3e-16,
    'left impulse starts after a true dwell',
  );
  near(
    stateAtCycleCoordinate(0.82).wheelAngle,
    geometry.toothPitch - geometry.dropAngle,
    6e-16,
    'left pallet releases before the second drop',
  );
  near(
    stateAtCycleCoordinate(0.88).wheelAngle,
    geometry.toothPitch,
    0,
    'second drop completes one tooth per oscillation',
  );
  const closure = stateAtCycleCoordinate(1);
  near(closure.wheelAngle, geometry.toothPitch, 0,
    'one-cycle crown-wheel advance');
  near(closure.vergeAngle, -geometry.vergeAmplitude, 0,
    'verge completes one oscillation');
  near(closure.teethAdvanced, 1, 0, 'one tooth advanced per cycle');
  assert.equal(closure.activePallet, 'right');
  assert.equal(closure.activeToothIndex, 12);
  disposeModel(model.root);
});

test('movement 234 keeps each active tooth exactly on its pallet face', () => {
  const model = createMovementModel(catalog.movements[233]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  let maximumSeparation = 0;
  let maximumPhaseError = 0;
  let maximumNormalVelocityError = 0;
  let maximumSlidingSpeed = 0;
  for (let index = 0; index <= 32768; index += 1) {
    const state = stateAtCycleCoordinate(index / 32768);
    if (!state.contact) continue;
    const { contact } = state;
    near(
      Math.hypot(contact.point.x, contact.point.y),
      geometry.contactRadius,
      5e-16,
      'contact ridge stays on the crown circle',
    );
    near(contact.point.z, geometry.toothTipZ, 0,
      'contact ridge stays at tooth-tip height');
    near(contact.palletPlaneSeparation, 0, 5e-15,
      'tooth ridge lies on the pallet plane');
    near(contact.toothPhaseError, 0, 1.3e-15,
      'the published tooth is the geometrically active tooth');
    near(contact.normalVelocityError, 0, 2.6e-15,
      'tooth and pallet have no normal separation velocity');
    near(contact.faceNormal.length(), 1, 2e-16,
      'pallet face normal is unit length');
    near(contact.faceDirection.length(), 1, 2e-16,
      'pallet face direction is unit length');
    near(contact.faceNormal.dot(contact.faceDirection), 0, 2e-16,
      'pallet face basis is orthogonal');
    assert.ok(contact.contactCoordinate >= -3e-14);
    assert.ok(contact.contactCoordinate <= 1 + 3e-14);
    assert.ok(
      Math.abs(contact.palletWidthOffset)
        <= geometry.palletWidth / 2 + 2e-14,
    );
    maximumSeparation = Math.max(
      maximumSeparation,
      Math.abs(contact.palletPlaneSeparation),
    );
    maximumPhaseError = Math.max(
      maximumPhaseError,
      Math.abs(contact.toothPhaseError),
    );
    maximumNormalVelocityError = Math.max(
      maximumNormalVelocityError,
      Math.abs(contact.normalVelocityError),
    );
    maximumSlidingSpeed = Math.max(
      maximumSlidingSpeed,
      Math.abs(contact.slidingVelocity),
    );
  }
  assert.ok(maximumSeparation < 5e-15);
  assert.ok(maximumPhaseError < 1.3e-15);
  assert.ok(maximumNormalVelocityError < 2.6e-15);
  assert.ok(maximumSlidingSpeed > 0.18);

  for (const [phase, side, coordinate] of [
    [0.1, 'right', 0],
    [0.34 - 1e-9, 'right', 1],
    [0.4, 'left', 0],
    [0.58, 'left', 0],
    [0.82 - 1e-9, 'left', 1],
    [0.88, 'right', 0],
  ]) {
    const state = stateAtCycleCoordinate(phase);
    assert.equal(state.activePallet, side);
    near(state.contact.contactCoordinate, coordinate, 3e-13,
      `${side} pallet root-or-tip coordinate`);
  }
  disposeModel(model.root);
});

test('movement 234 free drops clear the releasing tip before the opposite root', () => {
  const model = createMovementModel(catalog.movements[233]);
  const {
    geometry,
    palletMetrics,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const firstRelease = stateAtCycleCoordinate(geometry.phases.firstDrop.start);
  const firstMiddle = stateAtCycleCoordinate(
    (geometry.phases.firstDrop.start + geometry.phases.firstDrop.end) / 2,
  );
  const firstArrival = stateAtCycleCoordinate(
    geometry.phases.firstDrop.end - 1e-9,
  );
  assert.equal(firstRelease.freeDrop, true);
  assert.equal(firstRelease.activePallet, null);
  assert.equal(firstRelease.freeDropState.escaping.side, 'right');
  assert.equal(firstRelease.freeDropState.approaching.side, 'left');
  assert.ok(firstRelease.freeDropState.approachingPlaneClearance > 0.08);
  assert.ok(firstRelease.freeDropState.approachingLongitudinalShortfall > 0.035);
  near(firstRelease.freeDropState.escapingLongitudinalOverrun, 0, 6e-17,
    'release tooth begins at the pallet tip');
  assert.ok(firstMiddle.freeDropState.approachingPlaneClearance > 0.04);
  assert.ok(firstMiddle.freeDropState.approachingLongitudinalShortfall > 0.018);
  assert.ok(firstMiddle.freeDropState.escapingLongitudinalOverrun > 0.035);
  assert.ok(firstArrival.freeDropState.approachingPlaneClearance < 2e-14);
  assert.ok(
    firstArrival.freeDropState.approachingLongitudinalShortfall < 1e-14,
  );
  assert.ok(firstArrival.freeDropState.escapingLongitudinalOverrun > 0.07);

  const secondMiddle = stateAtCycleCoordinate(
    (geometry.phases.secondDrop.start + geometry.phases.secondDrop.end) / 2,
  );
  assert.equal(secondMiddle.freeDropState.escaping.side, 'left');
  assert.equal(secondMiddle.freeDropState.approaching.side, 'right');
  near(
    secondMiddle.freeDropState.approachingPlaneClearance,
    firstMiddle.freeDropState.approachingPlaneClearance,
    3e-16,
    'opposed drops have symmetric plane clearance',
  );
  near(
    secondMiddle.freeDropState.escapingLongitudinalOverrun,
    firstMiddle.freeDropState.escapingLongitudinalOverrun,
    2e-15,
    'opposed drops have symmetric release overrun',
  );

  for (const segment of [geometry.phases.firstDrop, geometry.phases.secondDrop]) {
    const start = stateAtCycleCoordinate(segment.start);
    const end = stateAtCycleCoordinate(segment.end);
    near(end.wheelAngle - start.wheelAngle, geometry.dropAngle, 4e-16,
      'free interval advances exactly the positive drop');
    near(end.vergeAngle, start.vergeAngle, 0,
      'verge holds still throughout free drop');
    for (let sample = 1; sample < 4096; sample += 1) {
      const phase = THREE.MathUtils.lerp(
        segment.start,
        segment.end,
        sample / 4096,
      );
      const state = stateAtCycleCoordinate(phase);
      assert.equal(state.contact, null);
      for (const side of ['left', 'right']) {
        for (let toothIndex = 0; toothIndex < geometry.toothCount; toothIndex += 1) {
          const metrics = palletMetrics(
            side,
            toothIndex,
            state.vergeAngle,
            state.wheelAngle,
          );
          const insideWidth = Math.abs(metrics.palletWidthOffset)
            < geometry.palletWidth / 2 - 1e-10;
          const insideLength = metrics.longitudinalDistance
            > geometry.palletRootDistance + 1e-10
            && metrics.longitudinalDistance
              < geometry.palletTipDistance - 1e-10;
          assert.equal(insideWidth && insideLength, false,
            `drop phase ${phase} tooth ${toothIndex} misses ${side} face`);
        }
      }
    }
  }
  disposeModel(model.root);
});

test('movement 234 analytic speeds and accelerations match finite differences', () => {
  const model = createMovementModel(catalog.movements[233]);
  const { geometry, stateAtTime } = model.root.userData;
  const h = 2e-5;
  for (const cyclePhase of [
    0.14, 0.19, 0.24, 0.3,
    0.35, 0.37, 0.39,
    0.62, 0.68, 0.74, 0.79,
    0.83, 0.85, 0.87,
  ]) {
    const time = cyclePhase * geometry.cyclePeriod;
    const before = stateAtTime(time - h);
    const state = stateAtTime(time);
    const after = stateAtTime(time + h);
    const wheelSpeed = (after.wheelAngle - before.wheelAngle) / (2 * h);
    const wheelAcceleration = (
      after.wheelAngle - 2 * state.wheelAngle + before.wheelAngle
    ) / h ** 2;
    const vergeSpeed = (after.vergeAngle - before.vergeAngle) / (2 * h);
    const vergeAcceleration = (
      after.vergeAngle - 2 * state.vergeAngle + before.vergeAngle
    ) / h ** 2;
    near(wheelSpeed, state.wheelAngularSpeed, 8e-9,
      'crown-wheel angular speed finite difference');
    near(wheelAcceleration, state.wheelAngularAcceleration, 2e-6,
      'crown-wheel angular acceleration finite difference');
    near(vergeSpeed, state.vergeAngularSpeed, 2e-9,
      'verge angular speed finite difference');
    near(vergeAcceleration, state.vergeAngularAcceleration, 2e-6,
      'verge angular acceleration finite difference');
  }
  disposeModel(model.root);
});

test('movement 234 renderer binds the wheel, verge, pallets, and contacts', () => {
  const model = createMovementModel(catalog.movements[233]);
  const {
    blocks,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const wheelRotor = blocks.crownWheel.userData.rotor;
  const shaftRotor = blocks.crownShaft.userData.rotor;
  for (let index = 0; index <= 4096; index += 1) {
    const time = geometry.cyclePeriod * index / 4096;
    model.update(time);
    const state = stateAtTime(time);
    near(wheelRotor.rotation.z, state.wheelAngle, 2e-15,
      'rendered crown-wheel angle');
    near(shaftRotor.rotation.z, state.wheelAngle, 2e-15,
      'rendered crown-arbor angle');
    near(blocks.verge.rotation.x, state.vergeAngle, 0,
      'rendered verge angle');
    assert.equal(blocks.rightContactMarker.visible, false);
    assert.equal(
      blocks.rightContactMarker.userData.active,
      state.activePallet === 'right',
    );
    assert.equal(blocks.leftContactMarker.visible, false);
    assert.equal(
      blocks.leftContactMarker.userData.active,
      state.activePallet === 'left',
    );
    if (state.contact) {
      const marker = state.activePallet === 'right'
        ? blocks.rightContactMarker
        : blocks.leftContactMarker;
      vectorNear(marker.position, state.contact.point, 0,
        'rendered contact marker');
    }
    assert.equal(
      model.root.userData.contacts.rightPalletToCrownTooth !== null,
      state.activePallet === 'right',
    );
    assert.equal(
      model.root.userData.contacts.leftPalletToCrownTooth !== null,
      state.activePallet === 'left',
    );
    assert.equal(
      model.root.userData.contacts.freeDrop !== null,
      state.freeDrop,
    );
  }
  assert.equal(blocks.spindle.userData.role, 'oscillating-spindle-S');
  assert.equal(blocks.vergeWitness.userData.role, 'verge-rotation-witness');
  assert.equal(
    blocks.crownWheel.userData.indicator.userData.role,
    'crown-wheel-rotation-witness',
  );
  // Measure the assembly in its own frame, before the source presentation
  // turns it upright.
  const presented = model.root.quaternion.clone();
  model.root.quaternion.identity();
  model.root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model.root)
    .getSize(new THREE.Vector3());
  model.root.quaternion.copy(presented);
  assert.ok(size.x > 7.2);
  assert.ok(size.y > 5);
  assert.ok(size.z > 4.2);
  let meshCount = 0;
  model.root.traverse((object) => { if (object.isMesh) meshCount += 1; });
  // Brown's plain flags carry no dark lips, and the presentation drops the
  // undrawn journal caps and witness marks.
  assert.ok(meshCount >= 20);
  disposeModel(model.root);
});

test('movement 234 closes after thirteen teeth and leaves 269 authored', () => {
  const model = createMovementModel(catalog.movements[233]);
  const {
    animationTiming,
    geometry,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const source = stateAtCycleCoordinate(0);
  for (let cycle = 1; cycle <= geometry.toothCount; cycle += 1) {
    const closure = stateAtCycleCoordinate(cycle);
    near(
      closure.wheelAngle - source.wheelAngle,
      cycle * geometry.toothPitch,
      3e-15,
      `crown wheel advances ${cycle} tooth pitches`,
    );
    near(closure.vergeAngle, source.vergeAngle, 0,
      `verge closes oscillation ${cycle}`);
    assert.equal(
      closure.activeToothIndex,
      (geometry.toothCount - cycle) % geometry.toothCount,
    );
  }
  const fullClosure = stateAtCycleCoordinate(geometry.toothCount);
  near(fullClosure.wheelAngle, FULL_TURN, 1e-15,
    'thirteen oscillations make one crown-wheel revolution');
  assert.equal(fullClosure.activeToothIndex, 0);
  assert.equal(animationTiming.authoredCyclePeriod, geometry.cyclePeriod);
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

test('p93: the toothed cup is one wall between true circles with the saw cut into its top edge', () => {
  const model = createMovementModel(catalog.movements[233]);
  let wall = null;
  const teeth = [];
  model.root.traverse((object) => {
    if (object.userData.role === 'crown-wheel-toothed-cup-wall') wall = object;
    if (object.userData.role === 'axial-saw-tooth') teeth.push(object);
  });
  assert.ok(wall, 'one toothed cup wall');
  assert.equal(teeth.length, 13);
  assert.ok(teeth.every((tooth) => tooth.visible === false), 'separate teeth hidden');
  const { toothTipZ, toothBaseZ, bodyDepth } = model.root.userData.geometry;
  const position = wall.geometry.attributes.position;
  const radii = new Set();
  let top = -Infinity, bottom = Infinity;
  for (let i = 0; i < position.count; i += 1) {
    radii.add(Math.hypot(position.getX(i), position.getY(i)).toFixed(4));
    top = Math.max(top, position.getZ(i));
    bottom = Math.min(bottom, position.getZ(i));
  }
  assert.deepEqual([...radii].sort(), ['2.0600', '2.2000'], 'inner and outer faces are true circles');
  near(top, toothTipZ, 1e-6, 'tooth tips');
  near(bottom, toothBaseZ - bodyDepth, 1e-6, 'cup bottom');
  disposeModel(model.root);
});
