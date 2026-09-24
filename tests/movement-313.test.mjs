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
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function rotate2(point, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
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

test('movement 313 is the common Earnshaw spring-detent chronometer escapement', () => {
  const movement = catalog.movements[312];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    presentation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 313);
  assert.equal(movement.number, '313');
  assert.equal(movement.title,
    'Chronometer escapement, the form now commonly constructed');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'earnshaw-fifteen-tooth-spring-detent-radial-pallet-single-impulse-chronometer-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /fixed without a pivot at block D/);
  assert.match(mechanism, /jewel V backs gold passing spring TV/);
  assert.match(mechanism, /only impulse directly to radial jewel pallet P/);
  assert.match(mechanism, /successor tooth B locks at T/);
  assert.match(mechanism, /return vibration V bends the passing spring/);
  assert.match(presentation, /no separate inner impulse pins/);
  assert.equal(transmission.toothCount, 15);
  assert.equal(transmission.impulsesPerBalanceCycle, 1);
  assert.equal(transmission.vibrationsPerImpulse, 2);
  assert.match(transmission.direction, /clockwise/);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.balanceRotor.parent, model.root);
  // Brown draws the roller as a plain notched disc; the open ring is kept
  // for metadata but not presented.
  assert.equal(blocks.impulseRollerRim.parent, null);
  assert.equal(blocks.impulsePallet.parent, blocks.balanceRotor);
  assert.equal(blocks.impulsePalletArm.parent, blocks.impulsePallet);
  assert.equal(blocks.dischargingRoller.parent, blocks.balanceRotor);
  assert.equal(blocks.unlockingJewelV.parent, blocks.balanceRotor);
  assert.equal(blocks.mainDetentSpring.parent, model.root);
  assert.equal(blocks.detentBody.parent, model.root);
  assert.equal(blocks.passingSpring.parent, model.root);
  assert.equal(blocks.bankingPinE.parent, model.root);
  assert.equal(blocks.fixedBlockD.parent, model.root);
  assert.equal(blocks.escapeTeeth.length, 15);
  assert.equal(blocks.mainDetentSpring.userData.segments.length, 22);
  assert.equal(blocks.passingSpring.userData.segments.length, 16);
  assert.equal(blocks.impulsePallet.userData.faceIsRadial, true);
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'escape-wheel axis');
  vectorNear(blocks.balanceRotor.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'balance axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    /^common-long-escape-tooth-\d+-of-15$/.test(role)).length, 15);
  assert.equal(roles.filter((role) =>
    role === 'sole-radial-jewel-impulse-pallet-P').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'gold-one-way-passing-spring-TV').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'undercut-ten-degree-jewel-locking-pallet-T').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 313 preserves Brown landmarks and documented chronometer proportions', () => {
  const movement = catalog.movements[312];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.brownPlate313;
  const denison = sourceReference.denisonTreatise;
  const fritts = sourceReference.frittsManual;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /Animated tab unavailable/);
  assert.match(sourceAnimation.referenceScope, /C2 flight timing/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_313.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.equal(plate.countedToothCount, 15);
  assert.deepEqual(plate.rasterWheelCenter, new THREE.Vector2(221, 310));
  assert.deepEqual(plate.rasterBalanceCenter,
    new THREE.Vector2(371, 109));
  assert.deepEqual(plate.rasterImpulsePalletP,
    new THREE.Vector2(320, 160));
  assert.deepEqual(plate.rasterUnlockingJewelV,
    new THREE.Vector2(401, 143));
  assert.deepEqual(plate.rasterLockingPalletT,
    new THREE.Vector2(382, 262));
  assert.deepEqual(plate.rasterBankingPinE,
    new THREE.Vector2(380, 290));
  assert.deepEqual(plate.rasterFixedBlockD,
    new THREE.Vector2(396, 498));
  assert.match(plate.inferredTopology, /T is presently locked/);
  assert.match(plate.inferredTopology, /B is the next locking tooth/);
  assert.match(plate.inferredTopology, /A is the following impulse tooth/);
  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.escapeWheelCenter, 0, 'mapped wheel center');
  vectorNear(sourcePointToModel(plate.rasterBalanceCenter),
    geometry.balanceCenter, 0, 'mapped balance center');

  near(geometry.toothTipRadius / geometry.centerDistance,
    0.65, 1e-15, 'Fritts 65:100 wheel-radius ratio');
  near(geometry.impulseRollerRadius / geometry.toothTipRadius,
    0.5, 1e-15, 'half-diameter impulse roller ratio');
  near(geometry.documentedVibrationArc / THREE.MathUtils.DEG2RAD,
    430, 2e-13, '430-degree full balance vibration');
  near(geometry.balanceAmplitude / THREE.MathUtils.DEG2RAD,
    215, 1e-13, 'half-amplitude of the documented vibration');
  near(geometry.unlockingTravelAngle / THREE.MathUtils.DEG2RAD,
    5, 2e-15, 'five-degree unlocking travel');
  near(geometry.engagingDropBalanceAngle / THREE.MathUtils.DEG2RAD,
    10, 2e-15, 'ten-degree engaging drop');
  near(geometry.impulseBalanceAngle / THREE.MathUtils.DEG2RAD,
    15, 2e-15, 'fifteen-degree direct impulse');
  near(geometry.disengagingDropBalanceAngle / THREE.MathUtils.DEG2RAD,
    5, 2e-15, 'five-degree disengaging allowance');
  near(geometry.lockingDrawAngle / THREE.MathUtils.DEG2RAD,
    10, 2e-15, 'ten-degree marine locking draw');
  near(geometry.balancePeriod, 0.5, 0,
    'two vibrations at four vibrations per second');
  assert.equal(geometry.physicalVibrationsPerSecond, 4);

  assert.equal(denison.author, 'Edmund Beckett Denison');
  assert.equal(denison.publicationYear, 1857);
  assert.equal(denison.figure, 32);
  assert.deepEqual(denison.pages, [165, 166, 167, 168]);
  assert.match(denison.timingEvidence, /starts from rest/);
  assert.match(denison.topologyEvidence, /TV yields only on the return/);
  assert.equal(fritts.author, 'Charles Edgar Fritts');
  assert.equal(fritts.publicationYear, 1904);
  assert.match(fritts.verifiedConstruction, /fifteen-tooth wheel/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 313 passing spring transmits acting motion but yields alone on return', () => {
  const model = createMovementModel(catalog.movements[312]);
  const {
    canonicalStates,
    geometry,
    mainDetentPointsAtLift,
    passingSpringPointsAtState,
    stateAtCyclePhase,
  } = model.root.userData;
  const acting = stateAtCyclePhase(
    (geometry.unlockContactStartPhase + geometry.releasePhase) / 2,
  );
  const released = canonicalStates.toothRelease;
  const banked = canonicalStates.detentBanked;
  const returning = canonicalStates.returnPassing;
  const detached = canonicalStates.detachedAtPositiveExtreme;

  assert.equal(acting.actingUnlockContact, true);
  assert.equal(acting.wheelLocked, true);
  assert.ok(acting.detentLift > 0);
  assert.match(acting.stage, /V-backs-passing-spring/);
  assert.equal(released.actingUnlockContact, true);
  assert.equal(released.wheelUnlocked, true);
  near(released.detentLift, geometry.maximumDetentLift, 0,
    'V carries the detent through full lift');
  assert.equal(banked.detentLift, 0);
  assert.equal(banked.detentAgainstBankingPin, true);
  assert.equal(banked.wheelUnlocked, true);

  assert.equal(returning.returnPassing, true);
  near(returning.returnPassingDeflection,
    geometry.maximumReturnPassingDeflection, 0,
    'maximum independent gold-spring flex');
  assert.equal(returning.detentLift, 0);
  assert.equal(returning.detentAgainstBankingPin, true);
  assert.equal(returning.wheelLocked, true);
  assert.equal(returning.impulseContactActive, false);
  assert.match(returning.stage, /flexes-gold-spring-without-moving-detent/);
  assert.equal(detached.balanceDetached, true);
  assert.equal(detached.wheelLocked, true);

  const restMain = mainDetentPointsAtLift(0);
  const returnMain = mainDetentPointsAtLift(returning.detentLift);
  for (let index = 0; index < restMain.length; index += 1) {
    vectorNear(returnMain[index], restMain[index], 0,
      `return leaves main detent point ${index} fixed`);
  }
  const restPassing = passingSpringPointsAtState({
    balanceAngle: 0,
    detentLift: 0,
    returnPassingDeflection: 0,
  });
  const returnPassing = passingSpringPointsAtState(returning);
  assert.ok(returnPassing.at(-1).distanceTo(restPassing.at(-1)) > 0.12);
  near(returning.unlockingJewelPoint.distanceTo(returnPassing.at(-1)),
    0.12, 2e-15, 'return jewel remains beside yielded spring tip');
  const releasePassing = passingSpringPointsAtState(released);
  assert.ok(released.unlockingJewelPoint.distanceTo(
    releasePassing.at(-1),
  ) < 0.12, 'acting jewel remains against backed spring');
  disposeModel(model.root);
});

test('movement 313 advances one clockwise tooth per two balance vibrations', () => {
  const model = createMovementModel(catalog.movements[312]);
  const {
    geometry,
    stateAtTime,
    transmission,
    wheelMotionAtCyclePhase,
  } = model.root.userData;

  near(geometry.toothPitch, FULL_TURN / 15, 0,
    'fifteen-tooth pitch');
  assert.equal(transmission.wheelAdvancePerBalanceCycleDegrees, 24);
  assert.equal(transmission.wheelRevolutionsPerBalanceCycle, 1 / 15);
  for (let cycle = -3; cycle <= 18; cycle += 1) {
    const start = stateAtTime(cycle * geometry.balancePeriod);
    const middle = stateAtTime(
      (cycle + 0.5) * geometry.balancePeriod,
    );
    const end = stateAtTime((cycle + 1) * geometry.balancePeriod);
    near(end.wheelAngle - start.wheelAngle,
      -geometry.toothPitch, 2e-15,
      `cycle ${cycle} clockwise tooth step`);
    assert.equal(start.lockingToothIndex,
      positiveModulo(cycle, 15));
    assert.equal(middle.lockingToothIndex,
      positiveModulo(cycle + 1, 15));
    near(start.lockingPointError, 0, 5e-15,
      `cycle ${cycle} starting lock`);
    near(middle.lockingPointError, 0, 5e-15,
      `cycle ${cycle} successor lock`);
  }
  const start = stateAtTime(0);
  const closure = stateAtTime(15 * geometry.balancePeriod);
  near(closure.wheelAngle - start.wheelAngle, -FULL_TURN, 2e-15,
    'fifteen cycles close one clockwise wheel revolution');
  near(closure.balanceAngle, start.balanceAngle, 0,
    'balance closes with wheel after fifteen cycles');

  let previous = wheelMotionAtCyclePhase(0, 0).angle;
  let movingSamples = 0;
  for (let sample = 1; sample <= 20000; sample += 1) {
    const phase = sample / 20000;
    const state = wheelMotionAtCyclePhase(0, phase);
    assert.ok(state.angle <= previous + 2e-13,
      `wheel never reverses at phase ${phase}`);
    assert.ok(state.angularSpeed <= 2e-9,
      `clockwise or stationary at phase ${phase}`);
    if (state.angularSpeed < -1e-8) movingSamples += 1;
    previous = state.angle;
  }
  assert.ok(movingSamples > 350);
  assert.ok(movingSamples < 500);
  disposeModel(model.root);
});

test('movement 313 keeps one fixed no-recoil lock station T and catches B after A', () => {
  const model = createMovementModel(catalog.movements[312]);
  const {
    blocks,
    geometry,
    stateAtCyclePhase,
    toothTipAt,
  } = model.root.userData;

  for (const phase of [0, 0.10, 0.20, 0.50, 0.75, 0.95]) {
    const state = stateAtCyclePhase(phase);
    assert.equal(state.wheelLocked, true);
    near(state.wheelAngularSpeed, 0, 0,
      `no recoil at phase ${phase}`);
    near(state.lockingPointError, 0, 3e-15,
      `fixed T lock at phase ${phase}`);
    vectorNear(state.lockingToothPoint, geometry.lockingPoint,
      3e-15, `lock station at phase ${phase}`);
    vectorNear(
      toothTipAt(state.wheelAngle, state.lockingToothIndex),
      geometry.lockingPoint,
      3e-15,
      `indexed tooth at T at phase ${phase}`,
    );
  }
  for (const phase of [
    geometry.releasePhase,
    (geometry.releasePhase + geometry.impulseStartPhase) / 2,
    (geometry.impulseStartPhase + geometry.impulseEndPhase) / 2,
    (geometry.impulseEndPhase + geometry.relockPhase) / 2,
  ]) {
    const state = stateAtCyclePhase(phase);
    assert.equal(state.wheelUnlocked, true);
    assert.equal(state.lockingToothIndex, null);
    assert.equal(state.lockingToothPoint, null);
  }
  const impulse = stateAtCyclePhase(
    (geometry.impulseStartPhase + geometry.impulseEndPhase) / 2,
  );
  const after = stateAtCyclePhase(geometry.relockPhase);
  assert.equal(impulse.impulseToothIndex, 2);
  assert.equal(after.lockingToothIndex, 1);
  assert.equal(positiveModulo(
    impulse.impulseToothIndex - after.lockingToothIndex,
    15,
  ), 1, 'A is immediately ahead of successor locking tooth B');

  model.update(geometry.releasePhase * geometry.balancePeriod);
  const expectedReleasedLock = geometry.lockingPoint.clone().add(
      new THREE.Vector2(
        Math.cos(geometry.lockAngle),
        Math.sin(geometry.lockAngle),
      ).multiplyScalar(geometry.maximumDetentLift),
    );
  near(new THREE.Vector2(
    blocks.lockingStoneT.position.x,
    blocks.lockingStoneT.position.y,
  ).distanceTo(expectedReleasedLock), 0, 2e-15,
  'locking stone moves radially clear at release');
  model.update(geometry.detentBankPhase * geometry.balancePeriod);
  const heel = new THREE.Vector2(
    blocks.bankingHeel.position.x,
    blocks.bankingHeel.position.y,
  );
  near(heel.distanceTo(geometry.bankingPinCenter),
    geometry.bankingHeelRadius + geometry.bankingPinRadius,
    2e-15, 'detent heel rests exactly against bank E');
  disposeModel(model.root);
});

test('movement 313 constrains A exactly to the sole radial impulse face P', () => {
  const model = createMovementModel(catalog.movements[312]);
  const {
    contactGeometryAtPhase,
    geometry,
    stateAtCyclePhase,
  } = model.root.userData;
  const localPalletDirection = new THREE.Vector2(
    Math.cos(geometry.impulsePalletLocalAngle),
    Math.sin(geometry.impulsePalletLocalAngle),
  );
  const localPalletNormal = new THREE.Vector2(
    -localPalletDirection.y,
    localPalletDirection.x,
  );

  for (let sample = 0; sample <= 300; sample += 1) {
    const phase = THREE.MathUtils.lerp(
      geometry.impulseStartPhase,
      geometry.impulseEndPhase,
      sample / 300,
    );
    const state = stateAtCyclePhase(phase);
    const expected = contactGeometryAtPhase(phase);
    assert.equal(state.impulseContactActive, true);
    assert.equal(state.soleImpulsePallet, 'P');
    assert.equal(state.impulseToothIndex, 2);
    near(state.impulseContact.pointError, 0, 3e-15,
      `tooth-to-P point at sample ${sample}`);
    near(state.impulseContact.normalVelocityError, 0, 3e-8,
      `no normal separation at sample ${sample}`);
    assert.ok(state.impulseContact.relativeSlipSpeed > 0,
      `forward sliding impulse at sample ${sample}`);
    vectorNear(state.impulseToothPoint, expected.point, 3e-15,
      `ray-circle intersection at sample ${sample}`);
    const localPoint = rotate2(
      state.impulseToothPoint.clone().sub(geometry.balanceCenter),
      -state.balanceAngle,
    );
    near(localPoint.dot(localPalletNormal), 0, 2e-15,
      `P working face is radial at sample ${sample}`);
    assert.ok(localPoint.length() >= geometry.palletInnerRadius - 1e-12);
    assert.ok(localPoint.length() <= geometry.palletOuterRadius + 1e-12);
  }
  for (const phase of [0, 0.20, geometry.releasePhase, 0.50, 0.75]) {
    const state = stateAtCyclePhase(phase);
    assert.equal(state.impulseContactActive, false);
    assert.equal(state.impulseContact, null);
    assert.equal(state.soleImpulsePallet, null);
  }
  disposeModel(model.root);
});

test('movement 313 wheel flight joins lock and radial contact with C2 continuity', () => {
  const model = createMovementModel(catalog.movements[312]);
  const {
    geometry,
    wheelMotionAtCyclePhase,
  } = model.root.userData;
  const epsilon = 1e-9;
  for (const [name, phase] of [
    ['release', geometry.releasePhase],
    ['impulse start', geometry.impulseStartPhase],
    ['impulse end', geometry.impulseEndPhase],
    ['relock', geometry.relockPhase],
  ]) {
    const left = wheelMotionAtCyclePhase(0, phase - epsilon);
    const at = wheelMotionAtCyclePhase(0, phase);
    const right = wheelMotionAtCyclePhase(0, phase + epsilon);
    assert.ok(Number.isFinite(at.angle));
    assert.ok(Number.isFinite(at.phaseRate));
    assert.ok(Number.isFinite(at.phaseAcceleration));
    near(left.phaseRate, right.phaseRate, 1e-6,
      `${name} has continuous angular rate`);
    near(left.phaseAcceleration, right.phaseAcceleration, 0.04,
      `${name} has continuous angular acceleration`);
    const extrapolatedLeft = at.angle - at.phaseRate * epsilon;
    const extrapolatedRight = at.angle + at.phaseRate * epsilon;
    near(left.angle, extrapolatedLeft, 2e-14,
      `${name} left position joins tangent`);
    near(right.angle, extrapolatedRight, 2e-14,
      `${name} right position joins tangent`);
  }
  const release = wheelMotionAtCyclePhase(0, geometry.releasePhase);
  const relock = wheelMotionAtCyclePhase(0, geometry.relockPhase);
  near(release.phaseRate, 0, 0, 'wheel starts from rest');
  near(release.phaseAcceleration, 0, 0,
    'wheel starts without acceleration jump');
  near(relock.phaseRate, 0, 0, 'wheel lands at rest');
  near(relock.phaseAcceleration, 0, 0,
    'wheel lands without acceleration jump');
  near(relock.angle - release.angle, -geometry.toothPitch, 2e-15,
    'smooth flight still advances exactly one pitch');
  disposeModel(model.root);
});

test('movement 313 update keeps its two working planes finite and visibly layered', () => {
  const model = createMovementModel(catalog.movements[312]);
  const { blocks, geometry } = model.root.userData;

  assert.ok(blocks.dischargingRoller.position.z
    < geometry.escapeWheelPlaneZ);
  assert.ok(blocks.impulseRollerRim.position.z
    > geometry.escapeWheelPlaneZ);
  near(blocks.dischargingRoller.position.z,
    geometry.dischargingPlaneZ, 0, 'discharging plane');
  near(blocks.impulseRollerRim.position.z,
    geometry.impulsePlaneZ, 0, 'impulse plane');
  assert.notEqual(blocks.impulseRollerRim, blocks.dischargingRoller);
  assert.equal(blocks.balanceShaft.parent, blocks.balanceRotor);

  for (let sample = 0; sample <= 600; sample += 1) {
    const time = sample / 600 * geometry.balancePeriod;
    model.update(time);
    model.root.updateMatrixWorld(true);
    model.root.traverse((object) => {
      for (const value of object.matrixWorld.elements) {
        assert.ok(Number.isFinite(value),
          `${object.userData.role ?? object.type} remains finite`);
      }
    });
  }
  const bounds = new THREE.Box3().setFromObject(model.root);
  assert.equal(bounds.isEmpty(), false);
  assert.ok(bounds.min.x < -4);
  assert.ok(bounds.max.y > 3.8);
  assert.ok(bounds.min.y < -4.3);
  model.root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) assert.equal(material.fog, false);
  });
  assert.equal(model.root.userData.materialsIgnoreSceneFog, true);
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 0.5);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  assertReadableTiming(model.root.userData.animationTiming);
  disposeModel(model.root);
});
