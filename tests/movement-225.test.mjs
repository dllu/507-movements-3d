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
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 225 is one vibrating carrier with one separately hinged pawl', () => {
  const movement = catalog.movements[224];
  const model = createMovementModel(movement);
  const { archetype, blocks, fidelity, mechanism, sourceAnimation } =
    model.root.userData;

  assert.equal(movement.id, 225);
  assert.equal(movement.number, '225');
  assert.equal(movement.title, 'Vibrating-Carrier Single-Pawl Ratchet');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'floor-pivoted-vibrating-carrier-single-hinged-pawl-ratchet',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'vibrating-floor-carrier-hinges-one-pawl-for-drive-and-click-return',
  );
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(blocks.carrier.parent, model.root);
  assert.equal(blocks.pawl.parent, model.root);
  assert.equal(blocks.pawlNose.parent, blocks.pawl);
  assert.notEqual(blocks.pawl, blocks.carrier);
  assert.equal(blocks.holdingPawl, undefined);
  assert.equal(blocks.secondPawl, undefined);
  assert.ok(blocks.ratchet.userData.axis.distanceTo(Z_AXIS) < 1e-12);
  disposeModel(model.root);
});

test('movement 225 preserves the engraving pivots and one-tooth geometry', () => {
  const model = createMovementModel(catalog.movements[224]);
  const {
    contactGeometryAtCarrierAngle,
    geometry,
    sourceReference,
    transmission,
  } = model.root.userData;
  const plate = sourceReference.plate225;

  assert.deepEqual(plate.rasterRatchetCenter.toArray(), [208, 271]);
  assert.deepEqual(plate.rasterCarrierFloorPivot.toArray(), [409, 464]);
  assert.deepEqual(plate.rasterPawlHinge.toArray(), [409, 57]);
  assert.equal(plate.inferredRatchetTeeth, 20);
  near(geometry.carrierPivot.x, (409 - 208) * 0.0108, 1e-15,
    'floor pivot x');
  near(geometry.carrierPivot.y, (271 - 464) * 0.0108, 1e-15,
    'floor pivot y');
  near(geometry.carrierLength, (464 - 57) * 0.0108, 1e-15,
    'carrier length');
  near(geometry.toothPitch, FULL_TURN / 20, 0, 'twenty-tooth pitch');
  near(
    geometry.driveEndContactAngle - geometry.driveStartContactAngle,
    geometry.toothPitch,
    1e-15,
    'one drive stroke contact travel',
  );
  assert.ok(transmission.carrierSwingDegrees > 6 && transmission.carrierSwingDegrees < 8, 'source-sized carrier swing');
  near(transmission.outputTeethPerCarrierCycle, 1, 2e-15, 'one-tooth advance');
  for (const angle of [geometry.carrierStartAngle, geometry.carrierEndAngle]) {
    const contact = contactGeometryAtCarrierAngle(angle);
    near(contact.pawlVector.length(), geometry.pawlLength, 5e-16,
      'fixed pawl length');
    near(
      contact.pawlContactCenter.length(),
      geometry.pawlContactCenterRadius,
      3e-16,
      'pawl-nose center orbit',
    );
  }
  disposeModel(model.root);
});

test('movement 225 maintains drive contact and return clearance for 32,769 states', () => {
  const model = createMovementModel(catalog.movements[224]);
  const { stateAtCycleCoordinate } = model.root.userData;
  let lastWheelAngle = -Infinity;
  let maximumContactError = 0;
  let maximumNormalVelocityError = 0;
  let maximumTangentialSliding = 0;
  let maximumReturnClearance = 0;
  for (let index = 0; index <= 32768; index += 1) {
    const coordinate = index / 32768;
    const state = stateAtCycleCoordinate(coordinate);
    assert.ok(state.wheelAngle >= lastWheelAngle - 2e-15,
      `wheel reverses at state ${index}`);
    lastWheelAngle = state.wheelAngle;
    if (state.driving) {
      maximumContactError = Math.max(
        maximumContactError,
        state.pawlContactError,
      );
      maximumNormalVelocityError = Math.max(
        maximumNormalVelocityError,
        state.pawlToothNormalVelocityError,
      );
      maximumTangentialSliding = Math.max(
        maximumTangentialSliding,
        state.pawlToothSurfaceVelocityError,
      );
      assert.ok(state.wheelAngularSpeed >= -2e-16);
      assert.equal(state.returnClearance, 0);
    } else {
      assert.equal(state.wheelAngularSpeed, 0);
      assert.equal(state.pawlContactError, null);
      assert.ok(state.returnClearance >= -1.2e-15,
        `negative return clearance at state ${index}`);
      maximumReturnClearance = Math.max(
        maximumReturnClearance,
        state.returnClearance,
      );
    }
  }
  near(maximumContactError, model.root.userData.geometry.workingFlank.clearance, 1e-15, 'finite flank running clearance');
  assert.ok(maximumNormalVelocityError < 1e-15);
  assert.ok(maximumTangentialSliding > 0.022);
  assert.ok(maximumReturnClearance > 0.45);
  near(lastWheelAngle, Math.PI / 10, 0, 'one-cycle index');
  disposeModel(model.root);
});

test('movement 225 has smooth drive, dwell, click-over, and accumulated indexing', () => {
  const model = createMovementModel(catalog.movements[224]);
  const {
    canonicalTimes,
    geometry,
    stateAtCycleCoordinate,
    stateAtTime,
  } = model.root.userData;
  const driveStart = stateAtCycleCoordinate(0);
  const driveEnd = stateAtCycleCoordinate(0.5);
  const returnMiddle = stateAtCycleCoordinate(0.75);
  const nextDrive = stateAtCycleCoordinate(1);

  assert.equal(driveStart.driving, true);
  assert.equal(driveEnd.driving, false);
  assert.equal(returnMiddle.wheelDwelling, true);
  near(driveStart.carrierAngularSpeed, 0, 0, 'drive-start dwell');
  near(driveEnd.carrierAngularSpeed, 0, 0, 'drive-end dwell');
  near(nextDrive.carrierAngularSpeed, 0, 0, 'cycle-boundary dwell');
  near(driveEnd.wheelAngle, geometry.toothPitch, 0, 'indexed tooth');
  near(returnMiddle.wheelAngle, driveEnd.wheelAngle, 0,
    'return-stroke wheel dwell');
  assert.ok(returnMiddle.returnClearance > 0.45);
  near(nextDrive.returnClearance, 0, 0, 'pawl reseated at closure');
  const oneBefore = stateAtCycleCoordinate(0.25);
  const threeAfter = stateAtCycleCoordinate(3.25);
  near(
    threeAfter.wheelAngle - oneBefore.wheelAngle,
    3 * geometry.toothPitch,
    5e-16,
    'three accumulated indexes',
  );
  assert.equal(canonicalTimes.cycleClosure, 4);
  near(
    stateAtTime(canonicalTimes.cycleClosure).wheelAngle
      - stateAtTime(canonicalTimes.sourcePose).wheelAngle,
    geometry.toothPitch,
    5e-16,
    'one authored time-cycle index',
  );
  disposeModel(model.root);
});

test('movement 225 pawl nose crosses the ratchet plane and meets a real driving flank', () => {
  const model = createMovementModel(catalog.movements[224]);
  const { blocks, geometry } = model.root.userData;
  const ratchetBack = -geometry.ratchetDepth / 2;
  const ratchetFront = geometry.ratchetDepth / 2;
  const noseBack = geometry.pawlPlaneZ - geometry.pawlNoseDepth / 2;
  const noseFront = geometry.pawlPlaneZ + geometry.pawlNoseDepth / 2;

  assert.equal(blocks.ratchet.userData.teeth, 20);
  assert.equal(blocks.ratchet.userData.toothFaces.length, 20);
  assert.equal(blocks.ratchet.userData.profilePoints.length, 60);
  assert.equal(blocks.ratchet.userData.body.geometry.type, 'ExtrudeGeometry');
  assert.equal(blocks.pawlNose.geometry.parameters.height, 0.46);
  assert.ok(noseBack < ratchetFront);
  assert.ok(noseFront > ratchetBack);
  assert.ok(
    Math.min(noseFront, ratchetFront) - Math.max(noseBack, ratchetBack) > 0.13,
    'working nose must pass through the ratchet axial layer',
  );
  let meshCount = 0;
  model.root.traverse((object) => { if (object.isMesh) meshCount += 1; });
  assert.ok(meshCount >= 13);
  assert.ok(model.cameraDirection.z > 4 * Math.abs(model.cameraDirection.x));
  disposeModel(model.root);
});

test('movement 225 runtime binds the carrier, pawl, and ratchet while 262 stays authored', () => {
  const model = createMovementModel(catalog.movements[224]);
  const { blocks, canonicalTimes, geometry, stateAtTime } = model.root.userData;
  for (const time of [
    0,
    canonicalTimes.driveEnd,
    2,
    canonicalTimes.returnEnd,
    canonicalTimes.cycleClosure,
  ]) {
    model.update(time);
    const state = stateAtTime(time);
    const carrierBottom = blocks.carrier.children[1].getWorldPosition(
      new THREE.Vector3(),
    );
    const carrierTop = blocks.carrier.children[2].getWorldPosition(
      new THREE.Vector3(),
    );
    const pawlNose = blocks.pawlNose.getWorldPosition(new THREE.Vector3());
    near(carrierBottom.x, geometry.carrierPivot.x, 1e-15,
      `time ${time} carrier bottom x`);
    near(carrierBottom.y, geometry.carrierPivot.y, 1e-15,
      `time ${time} carrier bottom y`);
    near(carrierTop.x, state.pawlPivot.x, 1e-15,
      `time ${time} carrier top x`);
    near(carrierTop.y, state.pawlPivot.y, 1e-15,
      `time ${time} carrier top y`);
    near(pawlNose.x, state.pawlContactCenter.x, 1e-15,
      `time ${time} pawl nose x`);
    near(pawlNose.y, state.pawlContactCenter.y, 1e-15,
      `time ${time} pawl nose y`);
    near(pawlNose.z, geometry.pawlPlaneZ, 1e-15,
      `time ${time} pawl plane`);
    near(blocks.ratchet.userData.rotor.rotation.z, state.wheelAngle, 1e-15,
      `time ${time} ratchet rotation`);
    assert.equal(blocks.contactMarker.visible, state.driving);
  }

  const movement507 = createMovementModel(catalog.movements[506]);
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(catalog.movements[506].fidelity, 'authored');
  assert.equal(movement507.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement507.root.userData.archetype,
    model.root.userData.archetype,
  );
  disposeModel(movement507.root);
  disposeModel(model.root);
});
