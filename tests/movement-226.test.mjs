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
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function nearVector(actual, expected, tolerance, message) {
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
    } else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 226 is the source two-stage train of exactly six equal miter gears', () => {
  const movement = catalog.movements[225];
  const model = createMovementModel(movement);
  const { archetype, blocks, fidelity, mechanism, sourceAnimation } =
    model.root.userData;

  assert.equal(movement.id, 226);
  assert.equal(movement.number, '226');
  assert.equal(movement.title, 'Six-Equal-Bevel Accumulative Gear Train');
  assert.equal(movement.category, 'Bevel gearing');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'six-equal-miter-gears-two-stage-accumulative-train',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'B-counterrotates-F-and-hollow-C-then-A-D-C-E-differential-accumulates',
  );
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(blocks.gears.length, 6);
  assert.equal(new Set(blocks.gears).size, 6);
  blocks.gears.forEach((gear) => {
    assert.equal(gear.userData.teeth, 20);
    assert.equal(gear.userData.pitchConeAngle, Math.PI / 4);
    assert.equal(gear.userData.toothMeshes.length, 20);
  });
  assert.equal(blocks.inputGearB.parent, blocks.inputAssembly);
  assert.equal(blocks.shaftGearF.parent, blocks.carrierAssembly);
  assert.equal(blocks.planetGearD.parent, blocks.carrierAssembly);
  assert.equal(blocks.hollowDriveGear.parent, blocks.hollowAssembly);
  assert.equal(blocks.sideGearC.parent, blocks.hollowAssembly);
  assert.equal(blocks.hollowSleeve.parent, blocks.hollowAssembly);
  assert.equal(blocks.outputGearE.parent, blocks.outputAssembly);
  assert.equal(blocks.outputSleeve.parent, blocks.outputAssembly);
  disposeModel(model.root);
});

test('movement 226 preserves the engraving centers, carrier bounds, and axes', () => {
  const model = createMovementModel(catalog.movements[225]);
  const { blocks, geometry, sourceReference } = model.root.userData;
  const plate = sourceReference.plate226;

  assert.deepEqual(plate.rasterDifferentialApex.toArray(), [169, 274]);
  assert.deepEqual(plate.rasterInputStageApex.toArray(), [369, 274]);
  assert.deepEqual(plate.rasterCarrierFrameBounds, {
    bottom: 371,
    left: 51,
    right: 207,
    top: 179,
  });
  assert.equal(plate.sourceGearCount, 6);
  assert.equal(plate.sourceRequiresEqualDiametersAndToothCounts, true);
  nearVector(geometry.stageTwoApex, new THREE.Vector3(-1.4, 0, 0), 3e-16,
    'differential apex');
  nearVector(geometry.stageOneApex, new THREE.Vector3(1.4, 0, 0), 3e-16,
    'input-stage apex');
  near(
    geometry.stageOneApex.distanceTo(geometry.stageTwoApex),
    200 * geometry.sourceScale,
    5e-16,
    'source-scaled stage separation',
  );
  near(geometry.frameLeftX, (51 - 269) * 0.014, 5e-16,
    'carrier frame left');
  near(geometry.frameRightX, (207 - 269) * 0.014, 5e-16,
    'carrier frame right');
  near(geometry.frameTopY, (274 - 179) * 0.014, 5e-16,
    'carrier frame top');
  near(geometry.frameBottomY, (274 - 371) * 0.014, 5e-16,
    'carrier frame bottom');
  nearVector(blocks.inputGearB.userData.axis, Y_AXIS, 0, 'B axis');
  nearVector(blocks.shaftGearF.userData.axis, X_AXIS, 0, 'F axis');
  nearVector(blocks.hollowDriveGear.userData.axis, X_AXIS.clone().negate(),
    0, 'right hollow-gear axis');
  nearVector(blocks.sideGearC.userData.axis, X_AXIS, 0, 'C axis');
  nearVector(blocks.planetGearD.userData.axis, Z_AXIS, 0, 'source D axis');
  nearVector(blocks.outputGearE.userData.axis, X_AXIS.clone().negate(),
    0, 'E axis');
  disposeModel(model.root);
});

test('movement 226 keeps all four equal-miter contacts exact through 32,769 states', () => {
  const model = createMovementModel(catalog.movements[225]);
  const { stateAtInputAngle } = model.root.userData;
  let maximumNoSlipError = 0;
  let maximumPhaseError = 0;
  let maximumWillisError = 0;
  for (let index = 0; index <= 32768; index += 1) {
    const inputAngle = index / 32768 * FULL_TURN;
    const state = stateAtInputAngle(inputAngle);
    for (const value of [
      state.stageOneFMeshNoSlipError,
      state.stageOneHollowMeshNoSlipError,
      state.stageTwoCMeshNoSlipError,
      state.stageTwoEMeshNoSlipError,
    ]) maximumNoSlipError = Math.max(maximumNoSlipError, value);
    for (const value of [
      state.stageOneFMeshPhaseError,
      state.stageOneHollowMeshPhaseError,
      state.stageTwoCMeshPhaseError,
      state.stageTwoEMeshPhaseError,
    ]) maximumPhaseError = Math.max(maximumPhaseError, Math.abs(value));
    maximumWillisError = Math.max(
      maximumWillisError,
      Math.abs(state.willisAngleInvariant),
      Math.abs(state.willisVelocityInvariant),
    );
    near(state.carrierAngle, -inputAngle, 0,
      `state ${index} F/A rotation`);
    near(state.hollowAngle, inputAngle, 0,
      `state ${index} hollow C rotation`);
    near(state.outputAngle, -3 * inputAngle, 0,
      `state ${index} E rotation`);
    near(state.planetRelativeAngle, -2 * inputAngle, 0,
      `state ${index} D relative rotation`);
    near(
      state.stageTwoCContact.clone().sub(
        model.root.userData.geometry.stageTwoApex,
      ).length(),
      Math.SQRT2 * model.root.userData.geometry.contactDistance,
      4e-16,
      `state ${index} C-D pitch point`,
    );
  }
  assert.ok(maximumNoSlipError < 1e-15);
  assert.ok(maximumPhaseError < 9e-16);
  assert.ok(maximumWillisError < 1.8e-15);
  disposeModel(model.root);
});

test('movement 226 corrects Brown’s 2× claim to the constrained 3× result', () => {
  const movement = catalog.movements[225];
  const model = createMovementModel(movement);
  const {
    canonicalTimes,
    sourceClaimAudit,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const state = stateAtTime(1.234);

  assert.match(movement.mechanicalNote, /3× result/);
  assert.match(movement.mechanicalNote, /ωE = 2ωA − ωC/);
  assert.equal(sourceClaimAudit.sourceClaimedOutputTurnsPerInputTurn, 2);
  assert.equal(sourceClaimAudit.physicalOutputTurnsPerInputTurn, 3);
  assert.equal(sourceClaimAudit.independentlyCrossCheckedPhysicalRatio, 3);
  assert.match(sourceClaimAudit.reason, /three turns/);
  assert.equal(transmission.sourceClaimedOutputSpeedMagnitudeRatio, 2);
  assert.equal(transmission.outputSpeedMagnitudeRatio, 3);
  assert.equal(transmission.outputTurnsPerInputTurn, -3);
  assert.equal(transmission.carrierTurnsPerInputTurn, -1);
  assert.equal(transmission.hollowTurnsPerInputTurn, 1);
  assert.equal(transmission.planetRelativeTurnsPerInputTurn, -2);
  near(state.hollowAngularSpeed + state.outputAngularSpeed,
    2 * state.carrierAngularSpeed, 5e-16, 'equal bevel Willis law');
  near(
    Math.abs(state.outputAngularSpeed / state.inputAngularSpeed),
    3,
    0,
    'physical speed magnitude',
  );
  assert.equal(canonicalTimes.cycleClosure, 6);
  const closure = stateAtTime(canonicalTimes.cycleClosure);
  near(closure.inputAngle / FULL_TURN, 1, 0, 'input closure turns');
  near(closure.carrierAngle / FULL_TURN, -1, 0, 'carrier closure turns');
  near(closure.hollowAngle / FULL_TURN, 1, 0, 'hollow closure turns');
  near(closure.outputAngle / FULL_TURN, -3, 0, 'output closure turns');
  near(closure.planetRelativeAngle / FULL_TURN, -2, 0,
    'planet closure turns');
  disposeModel(model.root);
});

test('movement 226 has nested shafts, six complete tooth sets, and carrier clearance', () => {
  const model = createMovementModel(catalog.movements[225]);
  const { blocks, geometry } = model.root.userData;

  assert.ok(geometry.looseBoreRadius > geometry.centralShaftRadius * 2.5);
  assert.ok(blocks.hollowSleeve.userData.boreRadius
    > geometry.centralShaftRadius);
  assert.ok(blocks.outputSleeve.userData.boreRadius
    > geometry.centralShaftRadius);
  assert.ok(blocks.hollowSleeve.userData.startX
    < geometry.stageTwoApex.x + geometry.innerDistance);
  assert.ok(blocks.hollowSleeve.userData.endX
    > geometry.stageOneApex.x - geometry.innerDistance);
  assert.ok(blocks.outputSleeve.userData.endX
    > geometry.stageTwoApex.x - geometry.innerDistance);
  const shaftBounds = new THREE.Box3().setFromObject(blocks.shaftF);
  assert.ok(shaftBounds.min.x <= -3.49);
  assert.ok(shaftBounds.max.x >= 3.49);
  const maximumGearRadius = geometry.outerDistance
    + geometry.toothHeight * 0.55;
  assert.ok(Math.abs(geometry.frameRearZ) > maximumGearRadius + 0.17);
  blocks.carrierFrameA.forEach((member) => {
    assert.equal(member.parent, blocks.carrierAssembly);
    assert.equal(member.userData.carrierFrameMember, true);
  });
  blocks.gears.forEach((gear) => {
    assert.equal(gear.userData.mutilated, false);
    assert.equal(gear.userData.missingToothIndices.length, 0);
  });
  let meshCount = 0;
  model.root.traverse((object) => { if (object.isMesh) meshCount += 1; });
  assert.ok(meshCount >= 170);
  disposeModel(model.root);
});

test('movement 226 runtime binds all rigid assemblies while 262 stays authored', () => {
  const model = createMovementModel(catalog.movements[225]);
  const { blocks, canonicalTimes, geometry, stateAtTime } = model.root.userData;
  const [stageOneFMarker, stageOneHollowMarker, stageTwoCMarker,
    stageTwoEMarker] = blocks.contactMarkers;
  for (const time of [
    0,
    canonicalTimes.quarterTurn,
    canonicalTimes.halfTurn,
    4.5,
    canonicalTimes.cycleClosure,
  ]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    near(blocks.inputAssembly.rotation.y, state.inputAngle, 1e-15,
      `time ${time} input transform`);
    near(blocks.carrierAssembly.rotation.x, state.carrierAngle, 1e-15,
      `time ${time} carrier transform`);
    near(blocks.hollowAssembly.rotation.x, state.hollowAngle, 1e-15,
      `time ${time} hollow transform`);
    near(blocks.outputAssembly.rotation.x, state.outputAngle, 1e-15,
      `time ${time} output transform`);
    near(
      blocks.planetGearD.userData.rotor.rotation.z,
      geometry.planetDMountPhase + state.planetRelativeAngle,
      1e-15,
      `time ${time} planet relative spin`,
    );
    const renderedPlanetAxis = Z_AXIS.clone().applyQuaternion(
      blocks.planetGearD.getWorldQuaternion(new THREE.Quaternion()),
    );
    nearVector(renderedPlanetAxis, state.planetAxis, 8e-16,
      `time ${time} carried planet axis`);
    nearVector(stageOneFMarker.position, state.stageOneFContact, 0,
      `time ${time} B-F marker`);
    nearVector(stageOneHollowMarker.position, state.stageOneHollowContact, 0,
      `time ${time} B-hollow marker`);
    nearVector(stageTwoCMarker.position, state.stageTwoCContact, 0,
      `time ${time} C-D marker`);
    nearVector(stageTwoEMarker.position, state.stageTwoEContact, 0,
      `time ${time} D-E marker`);
    assert.ok(model.root.userData.contacts.inputBToF.noSlipError < 2e-16);
    assert.ok(model.root.userData.contacts.planetDToOutputE.noSlipError
      < 1e-15);
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
