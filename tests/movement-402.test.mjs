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

test('movement 402 is one Guernsey anchor lever, two opposed rack sectors, two balances, and one escape wheel', () => {
  const movement = catalog.movements[401];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 402);
  assert.equal(movement.number, '402');
  assert.equal(movement.category, 'Rack & pinion');
  assert.equal(movement.archetype,
    'guernsey-single-anchor-lever-with-external-and-internal-toothed-sectors-driving-two-counter-oscillating-balance-wheels');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one powered escape wheel/);
  assert.match(data.mechanism, /anchor A rigidly fixed to lever B/);
  assert.match(data.mechanism, /one external and one internal/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(blocks.compoundLever.parent, model.root);
  assert.equal(blocks.externalRack.parent, blocks.compoundLever);
  assert.equal(blocks.internalRack.parent, blocks.compoundLever);
  // Anchor A with both pallets is one plate on lever B.
  assert.equal(blocks.anchorArms.length, 0);
  assert.deepEqual(blocks.palletBodies, [blocks.anchorPlate]);
  assert.equal(blocks.anchorPlate.parent, blocks.compoundLever);
  assert.equal(blocks.upperBalance.balance.parent, model.root);
  assert.equal(blocks.leftBalance.balance.parent, model.root);
  assert.equal(blocks.escapeWheel.parent, model.root);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'single-powered-watch-escape-wheel',
    'single-rigid-pivoted-lever-B-carrying-anchor-A-and-both-toothed-sectors',
    'external-toothed-sector-on-B-driving-upper-balance-pinion',
    'internal-toothed-sector-on-B-driving-left-balance-pinion',
    'upper-external-mesh-counter-oscillating-balance-wheel',
    'left-internal-mesh-counter-oscillating-balance-wheel',
    'anchor-A-single-plate-with-both-pallets',
    'escape-wheel-single-plate-with-fifteen-teeth',
  ]) assert.ok(roles.includes(role), role);
  assert.match(data.constraints.sharedDrive, /no independent second drive/);
  disposeModel(model.root);
});

test('movement 402 records Brown’s static plate and Guernsey’s original 1862 patent', () => {
  const movement = catalog.movements[401];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate402;
  const evidence = sourceReference.constructionEvidence;
  const patent = sourceReference.usPatent35373;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_402.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /two balance-wheels/);
  assert.match(movement.description, /oscillating in opposite directions/);
  assert.match(movement.description, /interior and exterior toothed segment/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /Animated as unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.upperBalanceCenterApproximatePixels, [263, 229]);
  assert.deepEqual(plate.leftBalanceCenterApproximatePixels, [159, 299]);
  assert.deepEqual(plate.leverPivotBApproximatePixels, [303, 328]);
  assert.deepEqual(plate.escapeWheelCenterApproximatePixels, [385, 384]);
  assert.equal(plate.sourceCountedEscapeToothCount, 15);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence, /two opposed curved rack flanks/);
  assert.match(evidence.reconstructionDisclosure,
    /independently synthesized/);
  assert.equal(patent.number, 'US35373A');
  assert.equal(patent.inventor, 'Calvin O. Guernsey');
  assert.equal(patent.date, '1862-05-27');
  assert.equal(patent.figureUsed, 6);
  assert.match(patent.nameDiscrepancy, /Brown’s caption prints “G\. O\./);
  assert.match(patent.nameDiscrepancy, /Calvin O\. Guernsey/);
  assert.match(patent.operationalEvidence, /same driving power/);
  assert.match(patent.operationalEvidence, /opposite directions/);
  assert.equal(patent.url,
    'https://patents.google.com/patent/US35373A/en');
  disposeModel(model.root);
});

test('movement 402 derives both circular sector pitch radii from the four source centers', () => {
  const model = createMovementModel(catalog.movements[401]);
  const data = model.root.userData;
  const { blocks, geometry, sourcePointToModel } = data;

  near(
    geometry.externalSectorPitchRadius + geometry.pinionPitchRadius,
    geometry.upperCenterDistance,
    0,
    'external center-distance closure',
  );
  near(
    geometry.internalSectorPitchRadius - geometry.pinionPitchRadius,
    geometry.leftCenterDistance,
    0,
    'internal center-distance closure',
  );
  near(geometry.pinionPitchRadius,
    geometry.gearModule * geometry.pinionTeeth / 2, 0,
    'pinion module closure');
  near(geometry.externalRatio,
    geometry.externalSectorPitchRadius / geometry.pinionPitchRadius, 0,
    'external mesh ratio');
  near(geometry.internalRatio,
    geometry.internalSectorPitchRadius / geometry.pinionPitchRadius, 0,
    'internal mesh ratio');
  near(geometry.upperBalanceCenter.distanceTo(
    sourcePointToModel(new THREE.Vector2(263, 229))), 0, 0,
  'upper source center mapping');
  near(geometry.leftBalanceCenter.distanceTo(
    sourcePointToModel(new THREE.Vector2(159, 299))), 0, 0,
  'left source center mapping');
  near(geometry.escapeWheelCenter.distanceTo(
    sourcePointToModel(new THREE.Vector2(385, 384))), 0, 0,
  'escape source center mapping');
  assert.equal(blocks.externalRack.userData.internal, false);
  assert.equal(blocks.internalRack.userData.internal, true);
  assert.equal(blocks.externalRack.userData.toothCount, 9);
  assert.equal(blocks.internalRack.userData.toothCount, 15);
  assert.equal(blocks.externalRack.userData.teeth.length, 9);
  assert.equal(blocks.internalRack.userData.teeth.length, 15);
  disposeModel(model.root);
});

test('movement 402 nominal external/internal pitch constraints prescribe opposite-signed balance motion', () => {
  const model = createMovementModel(catalog.movements[401]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  let movingSamples = 0;
  let maximumExternalPhaseError = 0;
  let maximumInternalPhaseError = 0;
  let maximumExternalVelocityError = 0;
  let maximumInternalVelocityError = 0;

  for (let sample = -50000; sample <= 100000; sample += 1) {
    const state = stateAtTime(
      geometry.balancePeriod * sample / 50000,
    );
    maximumExternalPhaseError = Math.max(
      maximumExternalPhaseError,
      Math.abs(state.externalGearPhaseResidual),
    );
    maximumInternalPhaseError = Math.max(
      maximumInternalPhaseError,
      Math.abs(state.internalGearPhaseResidual),
    );
    maximumExternalVelocityError = Math.max(
      maximumExternalVelocityError,
      state.externalPitchVelocityError.length(),
    );
    maximumInternalVelocityError = Math.max(
      maximumInternalVelocityError,
      state.internalPitchVelocityError.length(),
    );
    assert.ok(state.counterRotationProduct <= 2e-30);
    if (Math.abs(state.leverAngularSpeed) > 1e-10) {
      movingSamples += 1;
      near(state.upperBalanceAngularSpeed / state.leverAngularSpeed,
        -geometry.externalRatio, 2e-15, 'external speed ratio');
      near(state.leftBalanceAngularSpeed / state.leverAngularSpeed,
        geometry.internalRatio, 2e-15, 'internal speed ratio');
      assert.equal(
        Math.sign(state.upperBalanceAngularSpeed),
        -Math.sign(state.leftBalanceAngularSpeed),
      );
    }
  }
  assert.ok(movingSamples > 100000);
  assert.ok(maximumExternalPhaseError < 1.4e-17);
  assert.ok(maximumInternalPhaseError < 1.4e-17);
  assert.ok(maximumExternalVelocityError < 8.5e-17);
  assert.ok(maximumInternalVelocityError < 5.1e-16);
  disposeModel(model.root);
});

test('movement 402 phases each balance-pinion gap opposite a rack tooth at both fixed pitch points', () => {
  const model = createMovementModel(catalog.movements[401]);
  const { geometry, stateAtTime } = model.root.userData;
  const circularPitch = Math.PI * geometry.gearModule;

  for (let sample = 0; sample <= 20000; sample += 1) {
    const state = stateAtTime(
      geometry.balancePeriod * sample / 20000,
    );
    const externalRackCoordinate = -geometry.externalSectorPitchRadius
      * state.leverAngle / circularPitch;
    const upperPinionCoordinate = (
      geometry.upperCenterAngle + Math.PI - state.upperBalanceAngle
    ) / geometry.pinionAngularPitch;
    const internalRackCoordinate = -geometry.internalSectorPitchRadius
      * state.leverAngle / circularPitch;
    const leftPinionCoordinate = (
      geometry.leftCenterAngle - state.leftBalanceAngle
    ) / geometry.pinionAngularPitch;
    near(
      Math.abs((upperPinionCoordinate + externalRackCoordinate) % 1),
      0.5,
      2e-15,
      'external tooth-to-gap phase',
    );
    near(
      Math.abs((leftPinionCoordinate - internalRackCoordinate) % 1),
      0.5,
      2e-15,
      'internal tooth-to-gap phase',
    );
  }
  disposeModel(model.root);
});

test('movement 402 escape wheel advances one tooth per balance cycle, recoiling only slightly', () => {
  const model = createMovementModel(catalog.movements[401]);
  const { geometry, stateAtTime } = model.root.userData;
  let previousAngle = null, maximumRecoil = 0, forward = 0;
  for (let sample = -4000; sample <= 16000; sample += 1) {
    const state = stateAtTime(geometry.halfBeatDuration * sample / 2000);
    if (previousAngle !== null) {
      maximumRecoil = Math.max(maximumRecoil, state.wheelAngle - previousAngle);
      if (state.wheelAngle < previousAngle - 1e-9) forward += 1;
    }
    previousAngle = state.wheelAngle;
  }
  assert.ok(maximumRecoil < 0.002, `recoil step ${maximumRecoil}`);
  assert.ok(forward > 2000);
  for (const halfBeatCoordinate of [-7.31, -0.4, 0, 0.47, 2.8, 19.2]) {
    const start = stateAtTime(geometry.halfBeatDuration * halfBeatCoordinate);
    const nextCycle = stateAtTime(geometry.halfBeatDuration * (halfBeatCoordinate + 2));
    const oneWheelTurn = stateAtTime(geometry.halfBeatDuration * (halfBeatCoordinate + 2 * geometry.escapeToothCount));
    near(nextCycle.wheelAngle - start.wheelAngle, -geometry.escapeToothPitch, 1e-9, 'one-tooth balance-cycle advance');
    near(oneWheelTurn.wheelAngle - start.wheelAngle, -FULL_TURN, 1e-8, 'fifteen-cycle escape-wheel turn');
  }
  disposeModel(model.root);
});

test('movement 402 alternates lock and impulse on each pallet with a free drop between', () => {
  const model = createMovementModel(catalog.movements[401]);
  const { geometry, stateAtTime } = model.root.userData;
  const sequence = [];
  for (let sample = 0; sample <= 4000; sample += 1) {
    const state = stateAtTime(geometry.balancePeriod * sample / 4000);
    const key = state.activePalletContact ? `${state.activePalletContact.side}:${state.activePalletContact.mode}` : 'free-drop';
    if (key !== sequence.at(-1)) sequence.push(key);
  }
  for (const side of ['upper', 'lower']) {
    assert.ok(sequence.includes(`${side}:lock`), `${side} locks: ${sequence}`);
    assert.ok(sequence.includes(`${side}:impulse`), `${side} impulses: ${sequence}`);
  }
  assert.ok(sequence.filter((key) => key === 'free-drop').length >= 2, `${sequence}`);
  disposeModel(model.root);
});

test('movement 402 update binds all four moving bodies and exposes the live contacts', () => {
  const model = createMovementModel(catalog.movements[401]);
  const data = model.root.userData;
  const { blocks, geometry } = data;

  for (const halfBeatCoordinate of [0, 0.24, 0.46, 0.56, 0.72, 1.2, 1.48]) {
    const time = geometry.halfBeatDuration * halfBeatCoordinate;
    const expected = data.stateAtTime(time);
    model.update(time, 0);
    near(blocks.compoundLever.rotation.z, expected.leverAngle, 0, 'rendered lever angle');
    near(blocks.upperBalance.balance.rotation.z, expected.upperBalanceAngle, 0, 'rendered upper balance angle');
    near(blocks.leftBalance.balance.rotation.z, expected.leftBalanceAngle, 0, 'rendered left balance angle');
    near(blocks.escapeWheelRotor.rotation.z, expected.wheelAngle, 0, 'rendered escape-wheel angle');
    near(data.contacts.externalSectorToUpperPinion.phaseResidual, expected.externalGearPhaseResidual, 0, 'reported external phase closure');
    if (expected.activePalletContact) {
      assert.equal(data.contacts.escapeWheelToAnchorPallet.pallet, expected.activePalletContact.side);
      assert.equal(data.contacts.escapeWheelToAnchorPallet.mode, expected.activePalletContact.mode);
    } else {
      assert.equal(data.contacts.escapeWheelToAnchorPallet, null);
    }
  }
  disposeModel(model.root);
});

test('movement 507 remains the next authored review frontier', () => {
  const movement402 = catalog.movements[401];
  const movement507 = catalog.movements[506];
  const model402 = createMovementModel(movement402);
  const model507 = createMovementModel(movement507);

  assert.equal(movement402.id, 402);
  assert.equal(movement402.fidelity, 'authored');
  assert.equal(model402.root.userData.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype,
    model402.root.userData.archetype);
  disposeModel(model402.root);
  disposeModel(model507.root);
});
