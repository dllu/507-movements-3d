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
const Y_AXIS = new THREE.Vector3(0, 1, 0);

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

function unwrapSocketAngle(angle, domainStart) {
  let result = angle;
  while (result < domainStart) result += FULL_TURN;
  while (result >= domainStart + FULL_TURN) result -= FULL_TURN;
  return result;
}

test('movement 245 is one radial-pin bayonet joint in one L-shaped socket slot', () => {
  const movement = catalog.movements[244];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 245);
  assert.equal(movement.number, '245');
  assert.equal(movement.title, 'Bayonet Joint');
  assert.equal(movement.category, 'Clutches & couplings');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'axial-bayonet-joint-with-radial-pin-and-l-shaped-socket-slot',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'turn-part-A-until-its-single-radial-pin-reaches-the-axial-leg-of-the-L-slot-in-socket-B-then-withdraw-it',
  );
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.connectionType, 'bayonet-joint');
  assert.equal(
    transmission.constrainedPair,
    'cylindrical-pair-with-radial-pin-in-L-slot',
  );
  assert.equal(transmission.pinCount, 1);
  assert.equal(transmission.slotCount, 1);
  assert.equal(transmission.rotationAllowedOnlyAtLockingDepth, true);
  assert.equal(transmission.translationAllowedOnlyAtReleasedAngle, true);
  assert.equal(blocks.socket.userData.role, 'fixed-cylindrical-socket-B');
  assert.equal(blocks.socket.userData.fixed, true);
  assert.equal(blocks.maleBody.userData.role, 'male-cylindrical-plug-A');
  assert.equal(
    blocks.lockingPin.userData.role,
    'single-radial-bayonet-locking-pin',
  );
  disposeModel(model.root);
});

test('movement 245 preserves the measured unavailable source plate', () => {
  const movement = catalog.movements[244];
  const model = createMovementModel(movement);
  const { sourceReference, stateAtTime } = model.root.userData;
  const plate = sourceReference.plate245;

  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 3);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterSocketBounds, {
    bottom: 452,
    left: 184,
    right: 319,
    top: 253,
  });
  assert.deepEqual(plate.rasterMaleBounds, {
    bottom: 370,
    left: 197,
    right: 317,
    top: 92,
  });
  assert.deepEqual(plate.rasterAxialSlotCorner.toArray(), [228, 306]);
  assert.deepEqual(plate.rasterSlotEnd.toArray(), [287, 306]);
  assert.deepEqual(plate.rasterLockingPinCenter.toArray(), [261, 310]);
  assert.equal(plate.rasterHiddenMaleBottomY, 370);
  assert.match(plate.inferredTopology, /one radial stud/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 63,
    edition: 21,
    illustrationPage: 62,
    publicationYear: 1908,
  });
  const source = stateAtTime(0);
  assert.equal(source.sourcePose, true);
  assert.equal(source.stage, 'locked-dwell');
  assert.equal(source.locked, true);
  assert.equal(source.engaged, true);
  disposeModel(model.root);
});

test('movement 245 socket wall has a real curved open L and physical pin clearance', () => {
  const model = createMovementModel(catalog.movements[244]);
  const { blocks, geometry } = model.root.userData;
  const positions = blocks.socketWall.geometry.getAttribute('position');

  assert.equal(blocks.socketWall.geometry.userData.slotOpeningIsBooleanCut, true);
  assert.equal(blocks.socketWall.userData.role,
    'socket-wall-with-one-open-L-shaped-slot');
  assert.ok(blocks.socketWall.geometry.userData.triangleCount >= 3000);
  assert.equal(positions.count / 3,
    blocks.socketWall.geometry.userData.triangleCount);
  assert.equal(blocks.slotOutline.userData.points.length, 92);
  assert.equal(
    blocks.slotOutline.userData.role,
    'visible-boundary-of-open-L-shaped-slot',
  );
  assert.ok(geometry.maleRadius < geometry.socketInnerRadius);
  near(
    geometry.socketInnerRadius - geometry.maleRadius,
    geometry.boreRadialClearance,
    0,
    'plug-to-bore radial clearance',
  );
  assert.ok(geometry.pinEnvelopeRadius < geometry.slotHalfHeight);
  assert.ok(geometry.pinAngularHalfWidth < geometry.axialHalfAngle);
  near(
    geometry.lockedAngle + geometry.pinAngularHalfWidth,
    geometry.slotEndAngle,
    0,
    'pin envelope touches the closed slot end',
  );

  let curvedSurfaceTriangleCount = 0;
  let forbiddenSurfaceTriangleCount = 0;
  const angleDomainStart = -geometry.axialHalfAngle;
  for (let index = 0; index < positions.count; index += 3) {
    let allOuter = true;
    let allInner = true;
    let centroidAngle = 0;
    let centroidY = 0;
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = index + corner;
      const x = positions.getX(vertex);
      const y = positions.getY(vertex);
      const z = positions.getZ(vertex);
      const radius = Math.hypot(x, z);
      allOuter &&= Math.abs(radius - geometry.socketOuterRadius) < 2e-6;
      allInner &&= Math.abs(radius - geometry.socketInnerRadius) < 2e-6;
      centroidAngle += unwrapSocketAngle(
        Math.atan2(x, z),
        angleDomainStart,
      ) / 3;
      centroidY += y / 3;
    }
    if (!allOuter && !allInner) continue;
    curvedSurfaceTriangleCount += 1;
    const strictlyInAxialOpening = (
      centroidAngle > -geometry.axialHalfAngle + 1e-6
      && centroidAngle < geometry.axialHalfAngle - 1e-6
      && centroidY > geometry.slotBottomY + 1e-6
    );
    const strictlyInCircumferentialOpening = (
      centroidAngle > -geometry.axialHalfAngle + 1e-6
      && centroidAngle < geometry.slotEndAngle - 1e-6
      && centroidY > geometry.slotBottomY + 1e-6
      && centroidY < geometry.slotTopY - 1e-6
    );
    if (strictlyInAxialOpening || strictlyInCircumferentialOpening) {
      forbiddenSurfaceTriangleCount += 1;
    }
  }
  assert.ok(curvedSurfaceTriangleCount >= 2000);
  assert.equal(forbiddenSurfaceTriangleCount, 0);
  disposeModel(model.root);
});

test('movement 245 follows turn, withdraw, insert, and lock in that exact order', () => {
  const model = createMovementModel(catalog.movements[244]);
  const { geometry, stateAtCycleCoordinate, timeline } = model.root.userData;
  assert.deepEqual(timeline.map(({ stage }) => stage), [
    'locked-dwell',
    'turn-to-release',
    'withdraw-through-axial-leg',
    'withdrawn-dwell',
    'insert-through-axial-leg',
    'turn-to-lock',
    'locked-dwell',
  ]);
  assert.deepEqual(timeline.map(({ start, end }) => [start, end]), [
    [0, 0.08],
    [0.08, 0.24],
    [0.24, 0.48],
    [0.48, 0.52],
    [0.52, 0.76],
    [0.76, 0.92],
    [0.92, 1],
  ]);

  const locked = stateAtCycleCoordinate(0);
  const released = stateAtCycleCoordinate(0.24);
  const withdrawn = stateAtCycleCoordinate(0.48);
  const inserted = stateAtCycleCoordinate(0.76);
  const relocked = stateAtCycleCoordinate(0.92);
  near(locked.maleRotation, geometry.lockedAngle, 0, 'source lock angle');
  near(locked.axialOffset, 0, 0, 'source insertion depth');
  near(released.maleRotation, 0, 0, 'released angle');
  near(released.axialOffset, 0, 0, 'depth held through release turn');
  near(withdrawn.maleRotation, 0, 0, 'angle held through withdrawal');
  near(withdrawn.axialOffset, geometry.withdrawalDistance, 0,
    'full withdrawal');
  assert.equal(withdrawn.pinClearOfSocket, true);
  assert.equal(withdrawn.maleClearOfSocket, true);
  near(
    withdrawn.maleBottomY - geometry.socketTopY,
    geometry.withdrawnClearance,
    3e-16,
    'fully separated plug clearance',
  );
  near(inserted.maleRotation, 0, 0, 'released insertion angle');
  near(inserted.axialOffset, 0, 0, 'fully reinserted depth');
  near(relocked.maleRotation, geometry.lockedAngle, 2e-15,
    'restored lock angle');
  assert.equal(relocked.locked, true);
  disposeModel(model.root);
});

test('movement 245 never rotates and translates together or intersects the socket wall', () => {
  const model = createMovementModel(catalog.movements[244]);
  const {
    geometry,
    slotClearancesAtPose,
    stateAtCycleCoordinate,
  } = model.root.userData;
  let minimumAxialClearance = Infinity;
  let minimumHorizontalClearance = Infinity;

  for (let sample = 0; sample <= 65536; sample += 1) {
    const state = stateAtCycleCoordinate(sample / 65536);
    assert.equal(state.validConstraint, true,
      `valid L-slot containment at sample ${sample}`);
    assert.equal(
      Math.abs(state.maleAngularSpeed) > 1e-10
        && Math.abs(state.axialSpeed) > 1e-10,
      false,
      `sequenced degrees of freedom at sample ${sample}`,
    );
    if (Math.abs(state.maleAngularSpeed) > 1e-10) {
      near(state.axialOffset, 0, 0,
        `rotation occurs only at locking depth at sample ${sample}`);
    }
    if (Math.abs(state.axialSpeed) > 1e-10) {
      near(state.maleRotation, 0, 0,
        `translation occurs only at released angle at sample ${sample}`);
    }
    if (state.constraintBranch === 'axial-leg') {
      minimumAxialClearance = Math.min(
        minimumAxialClearance,
        state.clearances.axialAngularClearance,
      );
    }
    if (state.constraintBranch === 'circumferential-leg') {
      minimumHorizontalClearance = Math.min(
        minimumHorizontalClearance,
        state.clearances.horizontalVerticalClearance,
      );
    }
  }
  assert.ok(minimumAxialClearance > 0.049);
  assert.ok(minimumHorizontalClearance > 0.029);
  assert.equal(slotClearancesAtPose(geometry.lockedAngle, 0).valid, true);
  assert.equal(slotClearancesAtPose(0, 0.2).valid, true);
  assert.equal(
    slotClearancesAtPose(geometry.lockedAngle, 0.2).valid,
    false,
    'the socket wall blocks axial motion before release rotation',
  );
  assert.equal(
    slotClearancesAtPose(geometry.lockedAngle / 2, 0.2).valid,
    false,
    'the socket wall blocks mixed screw-like motion',
  );
  assert.equal(
    slotClearancesAtPose(0, geometry.withdrawalDistance).pinClearOfSocket,
    true,
  );
  disposeModel(model.root);
});

test('movement 245 stage handoffs are C2 and analytic rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[244]);
  const { geometry, stateAtTime } = model.root.userData;

  for (const coordinate of [0, 0.08, 0.24, 0.48, 0.52, 0.76, 0.92, 1]) {
    const state = stateAtTime(coordinate * geometry.cyclePeriod);
    near(state.maleAngularSpeed, 0, 2e-14,
      `zero angular speed at boundary ${coordinate}`);
    near(state.axialSpeed, 0, 2e-14,
      `zero axial speed at boundary ${coordinate}`);
    near(state.maleAngularAcceleration, 0, 3e-13,
      `zero angular acceleration at boundary ${coordinate}`);
    near(state.axialAcceleration, 0, 3e-13,
      `zero axial acceleration at boundary ${coordinate}`);
  }

  const step = 1e-5;
  for (const coordinate of [
    0.12, 0.16, 0.20,
    0.28, 0.34, 0.42,
    0.56, 0.64, 0.72,
    0.80, 0.84, 0.88,
  ]) {
    const time = coordinate * geometry.cyclePeriod;
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    near(
      (after.maleRotation - before.maleRotation) / (2 * step),
      state.maleAngularSpeed,
      2e-9,
      `angular velocity at coordinate ${coordinate}`,
    );
    near(
      (after.axialOffset - before.axialOffset) / (2 * step),
      state.axialSpeed,
      2e-9,
      `axial velocity at coordinate ${coordinate}`,
    );
    near(
      (after.maleAngularSpeed - before.maleAngularSpeed) / (2 * step),
      state.maleAngularAcceleration,
      2e-8,
      `angular acceleration at coordinate ${coordinate}`,
    );
    near(
      (after.axialSpeed - before.axialSpeed) / (2 * step),
      state.axialAcceleration,
      2e-8,
      `axial acceleration at coordinate ${coordinate}`,
    );
  }
  disposeModel(model.root);
});

test('movement 245 renderer binds the rigid pin to A and exposes each slot constraint', () => {
  const model = createMovementModel(catalog.movements[244]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const initialSocketPosition = blocks.socket.position.clone();
  const initialSocketQuaternion = blocks.socket.quaternion.clone();
  const pinCenterLocal = new THREE.Vector3(
    0,
    geometry.pinLocalY,
    geometry.pinCenterlineRadius,
  );

  vectorNear(blocks.maleAssembly.userData.axis, Y_AXIS, 0,
    'male cylindrical-pair axis');
  vectorNear(blocks.socket.userData.axis, Y_AXIS, 0,
    'socket cylindrical-pair axis');
  for (let sample = 0; sample <= 4096; sample += 1) {
    const time = geometry.cyclePeriod * 4 * sample / 4096;
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    near(blocks.maleAssembly.position.y, state.maleCenterY, 0,
      `rendered axial position at sample ${sample}`);
    near(blocks.maleAssembly.rotation.y, state.maleRotation, 2e-15,
      `rendered rotation at sample ${sample}`);
    vectorNear(
      pinCenterLocal.clone().applyMatrix4(blocks.maleAssembly.matrixWorld),
      state.pinPosition,
      4e-15,
      `rigid pin center at sample ${sample}`,
    );
    vectorNear(blocks.socket.position, initialSocketPosition, 0,
      `fixed socket position at sample ${sample}`);
    near(blocks.socket.quaternion.angleTo(initialSocketQuaternion), 0, 0,
      `fixed socket orientation at sample ${sample}`);
    const contacts = model.root.userData.contacts;
    assert.equal(contacts.pinToSocketWall.interference, false);
    assert.equal(contacts.malePlugToSocketBore.active, state.engaged);
    assert.equal(
      contacts.pinInAxialLeg.active,
      state.constraintBranch === 'axial-leg',
    );
    assert.equal(
      contacts.pinInCircumferentialLeg.active,
      state.constraintBranch === 'circumferential-leg',
    );
    assert.equal(contacts.lockingEndToPin.active, state.locked);
  }
  disposeModel(model.root);
});

test('movement 245 closes exactly and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[244]);
  const {
    animationTiming,
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const start = stateAtTime(0);
  const end = stateAtTime(geometry.cyclePeriod);

  near(end.maleRotation, start.maleRotation, 0, 'closed male rotation');
  near(end.axialOffset, start.axialOffset, 0, 'closed axial position');
  vectorNear(end.pinPosition, start.pinPosition, 0, 'closed pin position');
  assert.equal(end.stage, start.stage);
  assert.equal(end.locked, true);
  near(transmission.releaseRotation, geometry.lockedAngle, 0,
    'authored release rotation');
  near(animationTiming.authoredCyclePeriod, 8, 0,
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
