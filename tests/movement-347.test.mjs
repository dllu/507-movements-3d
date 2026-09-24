import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
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

function vector2Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function vector3Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function quaternionNear(actual, expected, tolerance, message) {
  near(1 - Math.abs(actual.dot(expected)), 0, tolerance, message);
}

function worldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
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

test('movement 347 is the slotted nutating-disk steam engine', () => {
  const movement = catalog.movements[346];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    contacts,
    degreesOfFreedom,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 347);
  assert.equal(movement.number, '347');
  assert.equal(movement.title,
    'Section of disk engine. Disk piston, seen edgewise…');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'nutating-disc-steam-engine-ball-joint-crank');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /central-ball-B/);
  assert.match(mechanism, /slotted-nutating-disc/);
  assert.match(mechanism, /opposed-conical-heads/);
  assert.match(mechanism, /fixed-radial-diaphragm/);
  assert.match(transmission.crankConstraint, /L\^2=D\^2\+r\^2/);
  assert.match(transmission.diaphragmConstraint,
    /intersection of the disk plane/);
  assert.equal(degreesOfFreedom.mechanism, 1);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.inputCrank.parent, model.root);
  assert.equal(blocks.diskAssembly.parent, model.root);
  assert.equal(blocks.fixedChamber.parent, blocks.fixedFrame);
  assert.equal(blocks.fixedPartition.parent, blocks.fixedChamber);
  assert.equal(blocks.pistonDisc.parent, blocks.diskAssembly);
  assert.equal(blocks.pistonBall.parent, blocks.diskAssembly);
  assert.equal(blocks.crankSideRod.parent, blocks.diskAssembly);
  assert.equal(blocks.counterSideRod.parent, blocks.diskAssembly);
  assert.equal(blocks.crankEndAnchor.parent, blocks.diskAssembly);
  assert.equal(blocks.slotOuterAnchor.parent, blocks.diskAssembly);
  assert.equal(blocks.conicalHeads.length, 2);
  assert.equal(blocks.centralSeatRings.length, 2);
  assert.equal(blocks.chamberJunctionRings.length, 2);
  assert.equal(blocks.slotLips.length, 2);
  assert.equal(blocks.coneContactMarkers.length, 2);
  assert.equal(blocks.flywheelSpokes.length, 6);
  assert.equal(blocks.crankBearings.length, 2);

  assert.equal(contacts.centralBallInConcentricSeats.fixedMember,
    blocks.fixedChamber);
  assert.equal(contacts.centralBallInConcentricSeats.movingMember,
    blocks.diskAssembly);
  assert.equal(contacts.pistonRodAtCrankSocket.members[0],
    blocks.diskAssembly);
  assert.equal(contacts.pistonRodAtCrankSocket.members[1],
    blocks.inputCrank);
  assert.equal(contacts.radialSlotOnFixedDiaphragm.fixedMember,
    blocks.fixedPartition);
  assert.equal(contacts.radialSlotOnFixedDiaphragm.movingMember,
    blocks.diskAssembly);
  assert.equal(contacts.diskRimInSphericalZone.fixedMember,
    blocks.fixedChamber);
  assert.equal(contacts.diskRimInSphericalZone.movingMember,
    blocks.diskAssembly);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'nutating-circular-piston-disc-with-one-radial-slot').length, 1);
  assert.equal(roles.filter((role) => role ===
    'moving-central-ball-attached-to-piston-disc').length, 1);
  assert.equal(roles.filter((role) => role ===
    'fixed-radial-diaphragm-through-piston-disc-slot').length, 1);
  assert.equal(roles.filter((role) =>
    /^fixed-opposed-conical-cylinder-head-[12]$/.test(role)).length, 2);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 347 records its unavailable animation and scan-derived proportions honestly', () => {
  const model = createMovementModel(catalog.movements[346]);
  const {
    geometry,
    modelPointToReferenceRaster,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.brownPlate347;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.demonstrationCyclesPerMinute, 15);
  assert.equal(sourceAnimation.demonstrationDurationSeconds, 4);
  assert.match(sourceAnimation.reason, /no canvas model/);
  assert.match(sourceAnimation.reason, /demonstration tempo/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_347.html');

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 20);
  assert.deepEqual(plate.rasterBallCenter, new THREE.Vector2(321, 257));
  assert.deepEqual(plate.rasterCrankPin, new THREE.Vector2(115, 155));
  assert.deepEqual(plate.rasterDiscUpperRim,
    new THREE.Vector2(370, 130));
  assert.deepEqual(plate.rasterDiscLowerRim,
    new THREE.Vector2(277, 388));
  assert.match(sourceReference.reconstruction.dimensionalStatus,
    /Brown supplies no dimensions/);
  assert.match(sourceReference.reuleauxConicDoubleSlider.construction,
    /conic turning double-slider/);
  assert.match(sourceReference.reuleauxConicDoubleSlider.construction,
    /radial slit/);
  assert.equal(sourceReference.reuleauxConicDoubleSlider.plate,
    'XXVIII, figures 1–3');
  assert.equal(sourceReference.scienceMuseumDakeyneModel.collectionNumber,
    '1893-172');
  assert.match(sourceReference.scienceMuseumDakeyneModel.construction,
    /fixed radial partition/);

  const rasterRodVector = new THREE.Vector2(
    plate.rasterCrankPin.x - plate.rasterBallCenter.x,
    plate.rasterBallCenter.y - plate.rasterCrankPin.y,
  );
  near(geometry.nutationHalfAngle,
    Math.atan2(Math.abs(rasterRodVector.y),
      Math.abs(rasterRodVector.x)),
    0, 'scan-derived nutation angle');
  near(geometry.pistonRodCrankLength,
    rasterRodVector.length() / geometry.sourcePixelsPerModelUnit,
    0, 'scan-derived ball-to-crank length');
  near(geometry.crankPlaneDistance,
    geometry.pistonRodCrankLength * Math.cos(geometry.nutationHalfAngle),
    5e-16, 'derived axial crank distance');
  near(geometry.crankRadius,
    geometry.pistonRodCrankLength * Math.sin(geometry.nutationHalfAngle),
    5e-16, 'derived crank radius');
  near(geometry.chamberAxialHalfLength,
    geometry.chamberRadius * Math.sin(geometry.nutationHalfAngle),
    5e-16, 'cone-to-sphere axial junction');
  near(geometry.chamberJunctionRadius,
    geometry.chamberRadius * Math.cos(geometry.nutationHalfAngle),
    5e-16, 'cone-to-sphere radial junction');
  near(geometry.crankPlaneDistance ** 2 + geometry.crankRadius ** 2,
    geometry.pistonRodCrankLength ** 2, 4e-15,
    'constant crank-socket rod triangle');
  vector2Near(modelPointToReferenceRaster(geometry.ballCenter),
    plate.rasterBallCenter, 0, 'ball-center raster registration');
  vector2Near(
    modelPointToReferenceRaster(
      model.root.userData.canonicalStates.engravingPhase.pointP,
    ),
    plate.rasterCrankPin,
    4e-14,
    'engraving-phase crank-pin raster registration',
  );
  disposeModel(model.root);
});

test('movement 347 closes the crank, ball, disk, sphere, cones, and diaphragm constraints', () => {
  const model = createMovementModel(catalog.movements[346]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const minusX = new THREE.Vector3(-1, 0, 0);

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 16384);
    const crankRadial = state.pointP.clone().sub(geometry.crankCenter);
    const ballToPin = state.pointP.clone().sub(geometry.ballCenter);
    near(crankRadial.x, 0, 0, `crank plane ${sample}`);
    near(Math.hypot(crankRadial.y, crankRadial.z),
      geometry.crankRadius, 9e-16, `crank circle ${sample}`);
    near(ballToPin.length(), geometry.pistonRodCrankLength, 9e-16,
      `ball-to-crank rod length ${sample}`);
    near(state.pistonRod.lengthError, 0, 9e-16,
      `reported piston-rod error ${sample}`);
    near(state.disk.normal.length(), 1, 4e-16,
      `unit disk normal ${sample}`);
    near(state.disk.normal.dot(minusX),
      Math.cos(geometry.nutationHalfAngle), 4e-16,
      `constant nutation half-angle ${sample}`);
    near(state.disk.slotDirection.length(), 1, 4e-16,
      `unit radial slot ${sample}`);
    near(state.disk.transverseDirection.length(), 1, 5e-16,
      `unit transverse direction ${sample}`);
    near(state.disk.normal.dot(state.disk.slotDirection), 0, 3e-16,
      `slot lies in disk ${sample}`);
    near(state.disk.slotDirection.z, 0, 0,
      `slot lies in fixed diaphragm plane ${sample}`);
    assert.ok(state.disk.slotDirection.y > 0,
      `one-sided slot points into the fixed diaphragm at ${sample}`);
    vector3Near(
      new THREE.Vector3().crossVectors(
        state.disk.normal,
        state.disk.slotDirection,
      ),
      state.disk.transverseDirection,
      5e-16,
      `right-handed disk frame ${sample}`,
    );
    near(state.disk.slotOuterPoint.distanceTo(geometry.ballCenter),
      geometry.chamberRadius, 2e-15,
      `slot end remains on sphere ${sample}`);
    near(state.disk.slotOuterPoint.z, geometry.ballCenter.z, 0,
      `slot end remains on diaphragm ${sample}`);

    for (const [name, point, side] of [
      ['minus', state.disk.coneContactMinus, -1],
      ['plus', state.disk.coneContactPlus, 1],
    ]) {
      const radial = point.clone().sub(geometry.ballCenter);
      near(radial.length(), geometry.chamberRadius, 2e-15,
        `${name} cone contact sphere ${sample}`);
      near(radial.dot(state.disk.normal), 0, 2e-15,
        `${name} cone generator lies in disk ${sample}`);
      near(radial.x, side * geometry.chamberAxialHalfLength, 2e-15,
        `${name} cone axial junction ${sample}`);
      near(Math.hypot(radial.y, radial.z),
        geometry.chamberJunctionRadius, 2e-15,
        `${name} cone radial junction ${sample}`);
    }

    const mappedX = X_AXIS.clone().applyQuaternion(state.disk.orientation);
    const mappedY = Y_AXIS.clone().applyQuaternion(state.disk.orientation);
    const mappedZ = Z_AXIS.clone().applyQuaternion(state.disk.orientation);
    vector3Near(mappedX, state.disk.normal, 2e-15,
      `orientation maps disk normal ${sample}`);
    vector3Near(mappedY, state.disk.slotDirection, 2e-15,
      `orientation maps radial slot ${sample}`);
    vector3Near(mappedZ, state.disk.transverseDirection, 2e-15,
      `orientation maps transverse axis ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 347 exhibits the four canonical nutation orientations without free roll', () => {
  const model = createMovementModel(catalog.movements[346]);
  const { canonicalStates, geometry } = model.root.userData;
  const sine = Math.sin(geometry.nutationHalfAngle);
  const cosine = Math.cos(geometry.nutationHalfAngle);

  vector3Near(canonicalStates.engravingPhase.disk.normal,
    new THREE.Vector3(-cosine, sine, 0), 4e-16,
    'engraving-phase disk normal');
  vector3Near(canonicalStates.quarterTurn.disk.normal,
    new THREE.Vector3(-cosine, 0, sine), 4e-16,
    'quarter-turn disk normal');
  vector3Near(canonicalStates.halfTurn.disk.normal,
    new THREE.Vector3(-cosine, -sine, 0), 4e-16,
    'half-turn disk normal');
  vector3Near(canonicalStates.threeQuarterTurn.disk.normal,
    new THREE.Vector3(-cosine, 0, -sine), 6e-16,
    'three-quarter-turn disk normal');
  vector3Near(canonicalStates.engravingPhase.disk.slotDirection,
    new THREE.Vector3(sine, cosine, 0), 4e-16,
    'engraving-phase slot direction');
  vector3Near(canonicalStates.halfTurn.disk.slotDirection,
    new THREE.Vector3(-sine, cosine, 0), 4e-16,
    'half-turn slot direction');
  vector3Near(canonicalStates.quarterTurn.disk.slotDirection,
    Y_AXIS, 4e-16, 'quarter-turn slot remains on diaphragm');
  vector3Near(canonicalStates.threeQuarterTurn.disk.slotDirection,
    Y_AXIS, 4e-16, 'three-quarter slot remains on diaphragm');
  quaternionNear(canonicalStates.cycleClosure.disk.orientation,
    canonicalStates.engravingPhase.disk.orientation, 5e-16,
    'one-cycle disk orientation closure');
  assert.notEqual(
    canonicalStates.quarterTurn.disk.orientation.dot(
      canonicalStates.engravingPhase.disk.orientation,
    ),
    1,
  );
  disposeModel(model.root);
});

test('movement 347 analytic basis and angular rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[346]);
  const { stateAtTime } = model.root.userData;
  const velocityStep = 2e-6;
  const accelerationStep = 2e-4;

  for (const time of [0.11, 0.48, 0.93, 1.37, 1.91, 2.46, 3.14, 3.73]) {
    const state = stateAtTime(time);
    const beforeV = stateAtTime(time - velocityStep);
    const afterV = stateAtTime(time + velocityStep);
    const numericalPointPVelocity = afterV.pointP.clone()
      .sub(beforeV.pointP).multiplyScalar(1 / (2 * velocityStep));
    const numericalNormalVelocity = afterV.disk.normal.clone()
      .sub(beforeV.disk.normal).multiplyScalar(1 / (2 * velocityStep));
    const numericalSlotVelocity = afterV.disk.slotDirection.clone()
      .sub(beforeV.disk.slotDirection)
      .multiplyScalar(1 / (2 * velocityStep));
    const numericalTransverseVelocity =
      afterV.disk.transverseDirection.clone()
        .sub(beforeV.disk.transverseDirection)
        .multiplyScalar(1 / (2 * velocityStep));
    vector3Near(state.pointPVelocity, numericalPointPVelocity, 9e-10,
      `crank-pin velocity ${time}`);
    vector3Near(state.disk.normalVelocity, numericalNormalVelocity, 4e-10,
      `normal velocity ${time}`);
    vector3Near(state.disk.slotDirectionVelocity,
      numericalSlotVelocity, 5e-10, `slot velocity ${time}`);
    vector3Near(state.disk.transverseDirectionVelocity,
      numericalTransverseVelocity, 6e-10,
      `transverse velocity ${time}`);

    const beforeA = stateAtTime(time - accelerationStep);
    const afterA = stateAtTime(time + accelerationStep);
    const numericalPointPAcceleration = afterA.pointPVelocity.clone()
      .sub(beforeA.pointPVelocity).multiplyScalar(1 / (2 * accelerationStep));
    const numericalNormalAcceleration = afterA.disk.normalVelocity.clone()
      .sub(beforeA.disk.normalVelocity)
      .multiplyScalar(1 / (2 * accelerationStep));
    const numericalSlotAcceleration =
      afterA.disk.slotDirectionVelocity.clone()
        .sub(beforeA.disk.slotDirectionVelocity)
        .multiplyScalar(1 / (2 * accelerationStep));
    const numericalTransverseAcceleration =
      afterA.disk.transverseDirectionVelocity.clone()
        .sub(beforeA.disk.transverseDirectionVelocity)
        .multiplyScalar(1 / (2 * accelerationStep));
    const numericalAngularAcceleration =
      afterA.disk.angularVelocity.clone()
        .sub(beforeA.disk.angularVelocity)
        .multiplyScalar(1 / (2 * accelerationStep));
    vector3Near(state.pointPAcceleration,
      numericalPointPAcceleration, 2e-7,
      `crank-pin acceleration ${time}`);
    vector3Near(state.disk.normalAcceleration,
      numericalNormalAcceleration, 8e-8,
      `normal acceleration ${time}`);
    vector3Near(state.disk.slotDirectionAcceleration,
      numericalSlotAcceleration, 1.5e-7,
      `slot acceleration ${time}`);
    vector3Near(state.disk.transverseDirectionAcceleration,
      numericalTransverseAcceleration, 1.5e-7,
      `transverse acceleration ${time}`);
    vector3Near(state.disk.angularAcceleration,
      numericalAngularAcceleration, 1.5e-7,
      `disk angular acceleration ${time}`);

    for (const [name, direction, directionVelocity,
      directionAcceleration] of [
      ['normal', state.disk.normal, state.disk.normalVelocity,
        state.disk.normalAcceleration],
      ['slot', state.disk.slotDirection,
        state.disk.slotDirectionVelocity,
        state.disk.slotDirectionAcceleration],
      ['transverse', state.disk.transverseDirection,
        state.disk.transverseDirectionVelocity,
        state.disk.transverseDirectionAcceleration],
    ]) {
      const velocityFromAngularRate = new THREE.Vector3()
        .crossVectors(state.disk.angularVelocity, direction);
      const accelerationFromAngularRate = new THREE.Vector3()
        .crossVectors(state.disk.angularAcceleration, direction)
        .add(new THREE.Vector3().crossVectors(
          state.disk.angularVelocity,
          velocityFromAngularRate,
        ));
      vector3Near(directionVelocity, velocityFromAngularRate, 8e-16,
        `${name} velocity from angular rate ${time}`);
      vector3Near(directionAcceleration, accelerationFromAngularRate,
        2e-15, `${name} acceleration from angular rate ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 347 renderer joins the nutating rod to the rotating crank socket', () => {
  const model = createMovementModel(catalog.movements[346]);
  const { blocks, contacts, geometry } = model.root.userData;

  for (const time of [0, 0.37, 1, 1.62, 2, 2.71, 3, 3.58, 4]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    near(blocks.inputCrank.rotation.x, state.inputAngle, 0,
      `rendered crank angle ${time}`);
    quaternionNear(blocks.diskAssembly.quaternion,
      state.disk.orientation, 5e-16,
      `rendered disk orientation ${time}`);
    vector3Near(worldPosition(blocks.centralBallAnchor),
      geometry.ballCenter, 3e-15,
      `rendered central ball B ${time}`);
    vector3Near(worldPosition(blocks.crankEndAnchor),
      state.pointP, 5e-15,
      `rendered piston-rod crank end P ${time}`);
    vector3Near(worldPosition(blocks.crankPinAnchor),
      state.pointP, 2e-15,
      `rendered crank pin P ${time}`);
    vector3Near(worldPosition(blocks.slotOuterAnchor),
      state.disk.slotOuterPoint, 4e-15,
      `rendered radial slot outer end ${time}`);
    vector3Near(blocks.coneContactMarkers[0].position,
      state.disk.coneContactMinus, 0,
      `rendered minus cone contact ${time}`);
    vector3Near(blocks.coneContactMarkers[1].position,
      state.disk.coneContactPlus, 0,
      `rendered plus cone contact ${time}`);
    vector3Near(contacts.pistonRodAtCrankSocket.point,
      state.pointP, 0, `crank socket contact ${time}`);
    vector3Near(contacts.radialSlotOnFixedDiaphragm.outerPoint,
      state.disk.slotOuterPoint, 0,
      `fixed diaphragm contact ${time}`);
    vector3Near(contacts.diskFacesAtConicalHeads.points[0],
      state.disk.coneContactMinus, 0,
      `minus conical-head contact ${time}`);
    vector3Near(contacts.diskFacesAtConicalHeads.points[1],
      state.disk.coneContactPlus, 0,
      `plus conical-head contact ${time}`);
  }
  assert.equal(blocks.fixedPartition.quaternion.equals(
    new THREE.Quaternion()), true);
  assert.equal(contacts.radialSlotOnFixedDiaphragm.planeNormal.equals(
    Z_AXIS), true);
  disposeModel(model.root);
});

test('movement 347 closes continuously after one complete crankshaft turn', () => {
  const model = createMovementModel(catalog.movements[346]);
  const { canonicalStates, stateAtInputAngle, stateAtTime } =
    model.root.userData;
  const start = stateAtTime(0);
  const finish = stateAtTime(4);

  vector3Near(finish.pointP, start.pointP, 0,
    'cycle crank-pin closure');
  vector3Near(finish.disk.normal, start.disk.normal, 0,
    'cycle disk-normal closure');
  vector3Near(finish.disk.slotDirection, start.disk.slotDirection, 0,
    'cycle radial-slot closure');
  vector3Near(finish.disk.transverseDirection,
    start.disk.transverseDirection, 0,
    'cycle transverse-axis closure');
  quaternionNear(finish.disk.orientation, start.disk.orientation, 5e-16,
    'cycle orientation closure');
  vector3Near(finish.disk.angularVelocity,
    start.disk.angularVelocity, 0,
    'cycle angular-velocity closure');
  vector3Near(finish.disk.angularAcceleration,
    start.disk.angularAcceleration, 0,
    'cycle angular-acceleration closure');
  assert.equal(canonicalStates.cycleClosure.phase, 0);

  for (let sample = 0; sample <= 4096; sample += 1) {
    const angle = -12 * FULL_TURN + sample * 24 * FULL_TURN / 4096;
    const state = stateAtInputAngle(angle);
    for (const value of [
      ...state.pointP.toArray(),
      ...state.disk.normal.toArray(),
      ...state.disk.slotDirection.toArray(),
      ...state.disk.angularVelocity.toArray(),
      ...state.disk.angularAcceleration.toArray(),
    ]) assert.ok(Number.isFinite(value));
    near(state.pistonRod.lengthError, 0, 9e-16,
      `multi-turn piston-rod closure ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 347 leaves movement 507 as the next authored draft', () => {
  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
});

test('movement 347 presents Brown\'s section: a closed rear-half casing and a real rod-end socket', () => {
  const model = createMovementModel(catalog.movements[346]);
  const { blocks, geometry } = model.root.userData;
  for (const part of [...blocks.conicalHeads, blocks.sphericalZone]) {
    const positions = part.geometry.attributes.position;
    let maximumZ = -Infinity;
    for (let i = 0; i < positions.count; i++) maximumZ = Math.max(maximumZ, positions.getZ(i));
    assert.ok(maximumZ < 1e-6, `${part.userData.role} lies behind the section plane`);
    assert.equal(part.geometry.groups.length, 2, 'revolved surface and cut face');
  }
  assert.ok(geometry.casingOuterRadius > geometry.chamberRadius);
  assert.ok(geometry.coneOffset * Math.cos(geometry.nutationHalfAngle)
    >= geometry.pistonDiscThickness / 2, 'disk faces clear the conical heads');
  model.update(1.3);
  model.root.updateMatrixWorld(true);
  const socket = blocks.inputCrank.children.find((object) =>
    /cup-socket/.test(object.userData.role));
  const ballCenter = blocks.crankEndBall.getWorldPosition(new THREE.Vector3());
  const local = socket.worldToLocal(ballCenter.clone());
  near(local.length(), 0, 1e-12, 'rod-end ball centred in its socket cavity');
  disposeModel(model.root);
});
