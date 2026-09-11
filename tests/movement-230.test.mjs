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

function nearVector(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function angularError(actual, expected) {
  return Math.atan2(
    Math.sin(actual - expected),
    Math.cos(actual - expected),
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

test('movement 230 is the source two-plane quadrature crank coupling', () => {
  const movement = catalog.movements[229];
  const model = createMovementModel(movement);
  const { blocks, fidelity, mechanism } = model.root.userData;

  assert.equal(movement.id, 230);
  assert.equal(movement.number, '230');
  assert.equal(movement.title, 'Quadrature Twin-Crank Shaft Coupling');
  assert.equal(movement.category, 'Cranks & reciprocation');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'quadrature-two-plane-parallelogram-crank-coupling',
  );
  assert.equal(mechanism, movement.archetype);
  assert.equal(blocks.shafts.length, 2);
  assert.equal(blocks.frontCrankDisks.length, 2);
  assert.equal(blocks.rearCrankArms.length, 2);
  assert.equal(blocks.connectingRods.length, 2);
  assert.equal(blocks.frontCrankPins.length, 2);
  assert.equal(blocks.rearCrankPins.length, 2);
  assert.equal(blocks.rotationIndexes.length, 2);

  assert.equal(
    blocks.inputShaft.userData.parts.frontDisk.parent,
    blocks.inputRotor,
  );
  assert.equal(
    blocks.inputShaft.userData.parts.rearCrank.parent,
    blocks.inputRotor,
  );
  assert.equal(
    blocks.outputShaft.userData.parts.frontDisk.parent,
    blocks.outputRotor,
  );
  assert.equal(
    blocks.outputShaft.userData.parts.rearCrank.parent,
    blocks.outputRotor,
  );
  disposeModel(model.root);
});

test('movement 230 preserves Brown’s depicted topology and quarter-phase safeguard', () => {
  const model = createMovementModel(catalog.movements[229]);
  const {
    blocks,
    geometry,
    sourceReference,
    transmission,
  } = model.root.userData;

  assert.deepEqual(sourceReference.plate230, {
    connectedRodCount: 2,
    crankPairsInSeparateAxialPlanes: true,
    crankPairsQuarterTurnApart: true,
    frontCrankDisks: 2,
    officialAnimationAvailable: false,
    parallelShaftCount: 2,
    rearExposedCrankArms: 2,
    statedFlywheelRequired: false,
    statedOutputMotion: 'circular',
  });
  assert.deepEqual(transmission, {
    connectedRodCount: 2,
    crankPairPhaseOffset: Math.PI / 2,
    flywheelRequired: false,
    inputOutputAngularRatio: 1,
    inputOutputDirection: 'same',
    simultaneousDeadCentersPerTurn: 0,
    singlePairDeadCentersPerTurn: 2,
    topology: 'two-quarter-phased-parallelogram-four-bars',
  });
  assert.equal(geometry.sourceImageWidth, 525);
  assert.equal(geometry.sourceImageHeight, 525);
  near(geometry.quarterTurn, Math.PI / 2, 0, 'exact quadrature');
  near(
    geometry.upperShaftCenter.distanceTo(geometry.lowerShaftCenter),
    geometry.centerDistance,
    0,
    'shaft-center separation',
  );
  near(geometry.upperShaftCenter.x, geometry.lowerShaftCenter.x, 0,
    'parallel shaft center x');
  near(geometry.upperShaftCenter.z, geometry.lowerShaftCenter.z, 0,
    'parallel shaft center z');
  assert.ok(geometry.frontRodPlaneZ > geometry.frontDiskCenterZ);
  assert.ok(geometry.rearRodPlaneZ < geometry.rearCrankPlaneZ);
  assert.ok(geometry.frontRodPlaneZ > geometry.rearRodPlaneZ);
  for (const rod of blocks.connectingRods) {
    near(rod.userData.nominalLength, geometry.centerDistance, 0,
      'parallelogram rod equals center spacing');
  }
  for (const pin of blocks.frontCrankPins) {
    near(pin.userData.localPhase, 0, 0, 'front crank phase');
  }
  for (const pin of blocks.rearCrankPins) {
    near(pin.userData.localPhase, geometry.quarterTurn, 0,
      'rear crank phase');
  }
  for (const contact of [
    model.root.userData.contacts.frontUpperPin,
    model.root.userData.contacts.frontLowerPin,
    model.root.userData.contacts.rearUpperPin,
    model.root.userData.contacts.rearLowerPin,
  ]) {
    assert.ok(contact.axialCaptureMargin > 0);
    near(contact.centerError, 0, 0, 'pin and rod-eye center coincidence');
  }
  disposeModel(model.root);
});

test('movement 230 closes every rigid and velocity constraint through 65,537 states', () => {
  const model = createMovementModel(catalog.movements[229]);
  const { geometry, stateAtDriverAngle } = model.root.userData;
  const maxima = {
    acceleration: 0,
    combinedLeverage: 0,
    phase: 0,
    radius: 0,
    rodLength: 0,
    rodVector: 0,
    velocity: 0,
  };
  let minimumStrongestPairLeverage = Infinity;

  for (let step = 0; step <= 65_536; step += 1) {
    const angle = geometry.sourcePoseAngle
      + step / 65_536 * geometry.fullTurn;
    const state = stateAtDriverAngle(angle);
    const pointCenters = [
      [state.frontUpper, geometry.upperShaftCenter],
      [state.frontLower, geometry.lowerShaftCenter],
      [state.rearUpper, geometry.upperShaftCenter],
      [state.rearLower, geometry.lowerShaftCenter],
    ];
    for (const [pointState, center] of pointCenters) {
      const planarRadius = Math.hypot(
        pointState.point.x - center.x,
        pointState.point.y - center.y,
      );
      maxima.radius = Math.max(
        maxima.radius,
        Math.abs(planarRadius - geometry.crankRadius),
      );
    }
    maxima.rodLength = Math.max(
      maxima.rodLength,
      state.frontRodLengthError,
      state.rearRodLengthError,
    );
    for (const rodVector of [state.frontRodVector, state.rearRodVector]) {
      maxima.rodVector = Math.max(
        maxima.rodVector,
        Math.abs(rodVector.x),
        Math.abs(rodVector.y + geometry.centerDistance),
        Math.abs(rodVector.z),
      );
    }
    maxima.velocity = Math.max(
      maxima.velocity,
      state.frontPinRelativeVelocityError,
      state.rearPinRelativeVelocityError,
    );
    maxima.acceleration = Math.max(
      maxima.acceleration,
      state.frontPinRelativeAccelerationError,
      state.rearPinRelativeAccelerationError,
    );
    maxima.combinedLeverage = Math.max(
      maxima.combinedLeverage,
      Math.abs(state.combinedNormalizedLeverage - 1),
      Math.abs(
        state.frontNormalizedLeverage ** 2
          + state.rearNormalizedLeverage ** 2 - 1,
      ),
    );
    maxima.phase = Math.max(
      maxima.phase,
      Math.abs(state.inputOutputPhaseError),
      Math.abs(angularError(
        state.rearPhase - state.frontPhase,
        geometry.quarterTurn,
      )),
    );
    minimumStrongestPairLeverage = Math.min(
      minimumStrongestPairLeverage,
      state.strongestPairNormalizedLeverage,
    );
    assert.equal(state.shaftAngularRatio, 1);
    assert.equal(state.drivenAngle, state.driverAngle);
    assert.equal(state.drivenAngularSpeed, state.driverAngularSpeed);
    assert.equal(state.simultaneousDeadCenter, false);
  }

  assert.ok(maxima.radius <= 4.5e-16, `maximum crank-radius error ${maxima.radius}`);
  assert.ok(maxima.rodLength <= 1e-15,
    `maximum connecting-rod error ${maxima.rodLength}`);
  assert.ok(maxima.rodVector <= 1e-15,
    `maximum parallelogram-vector error ${maxima.rodVector}`);
  assert.ok(maxima.velocity <= 1e-15,
    `maximum pin velocity mismatch ${maxima.velocity}`);
  assert.ok(maxima.acceleration <= 1e-15,
    `maximum pin acceleration mismatch ${maxima.acceleration}`);
  assert.ok(maxima.combinedLeverage <= 6.7e-16,
    `maximum quadrature leverage error ${maxima.combinedLeverage}`);
  assert.ok(maxima.phase <= 4.5e-16,
    `maximum shaft/crank phase error ${maxima.phase}`);
  assert.ok(
    minimumStrongestPairLeverage >= Math.SQRT1_2 - 1e-15,
    `minimum available leverage ${minimumStrongestPairLeverage}`,
  );
  disposeModel(model.root);
});

test('movement 230 hands torque to the other crank plane at every dead center', () => {
  const model = createMovementModel(catalog.movements[229]);
  const { stateAtDriverAngle } = model.root.userData;
  const cases = [
    {
      angle: 0,
      dead: 'rear',
      stage: 'rear-pair-at-dead-center-front-pair-at-quadrature',
    },
    {
      angle: Math.PI / 2,
      dead: 'front',
      stage: 'front-pair-at-dead-center-rear-pair-at-quadrature',
    },
    {
      angle: Math.PI,
      dead: 'rear',
      stage: 'rear-pair-at-dead-center-front-pair-at-quadrature',
    },
    {
      angle: Math.PI * 1.5,
      dead: 'front',
      stage: 'front-pair-at-dead-center-rear-pair-at-quadrature',
    },
  ];

  for (const expected of cases) {
    const state = stateAtDriverAngle(expected.angle);
    assert.equal(state.stage, expected.stage);
    assert.equal(state.simultaneousDeadCenter, false);
    near(state.combinedNormalizedLeverage, 1, 2.3e-16,
      'unit combined leverage at handoff');
    near(state.strongestPairNormalizedLeverage, 1, 0,
      'other plane has maximum leverage');
    if (expected.dead === 'front') {
      assert.equal(state.frontAtDeadCenter, true);
      assert.equal(state.rearAtDeadCenter, false);
      near(state.frontNormalizedLeverage, 0, 2e-16,
        'front dead-center leverage');
      near(state.rearNormalizedLeverage, 1, 0,
        'rear quadrature leverage');
    } else {
      assert.equal(state.rearAtDeadCenter, true);
      assert.equal(state.frontAtDeadCenter, false);
      near(state.rearNormalizedLeverage, 0, 2e-16,
        'rear dead-center leverage');
      near(state.frontNormalizedLeverage, 1, 0,
        'front quadrature leverage');
    }
  }
  disposeModel(model.root);
});

test('movement 230 analytic pin velocities and accelerations match finite differences', () => {
  const model = createMovementModel(catalog.movements[229]);
  const { geometry, stateAtTime } = model.root.userData;
  const timeStep = 3e-4;
  let maximumVelocityError = 0;
  let maximumAccelerationError = 0;

  for (let step = 0; step <= 512; step += 1) {
    const time = step / 512 * geometry.cyclePeriod;
    const previous = stateAtTime(time - timeStep);
    const current = stateAtTime(time);
    const next = stateAtTime(time + timeStep);
    for (const key of ['frontUpper', 'frontLower', 'rearUpper', 'rearLower']) {
      const numericalVelocity = next[key].point.clone()
        .sub(previous[key].point)
        .multiplyScalar(1 / (2 * timeStep));
      const numericalAcceleration = next[key].point.clone()
        .add(previous[key].point)
        .addScaledVector(current[key].point, -2)
        .multiplyScalar(1 / timeStep ** 2);
      maximumVelocityError = Math.max(
        maximumVelocityError,
        numericalVelocity.distanceTo(current[key].velocity),
      );
      maximumAccelerationError = Math.max(
        maximumAccelerationError,
        numericalAcceleration.distanceTo(current[key].acceleration),
      );
    }
  }
  assert.ok(maximumVelocityError <= 6.3e-8,
    `maximum finite-difference velocity error ${maximumVelocityError}`);
  assert.ok(maximumAccelerationError <= 6.7e-8,
    `maximum finite-difference acceleration error ${maximumAccelerationError}`);
  disposeModel(model.root);
});

test('movement 230 renders every pin and rigid rod at the solved state', () => {
  const model = createMovementModel(catalog.movements[229]);
  const { blocks, geometry } = model.root.userData;
  const localUpperEye = new THREE.Vector3(-geometry.centerDistance / 2, 0, 0);
  const localLowerEye = new THREE.Vector3(geometry.centerDistance / 2, 0, 0);
  let maximumPinError = 0;
  let maximumRodEndpointError = 0;

  for (let step = 0; step <= 4096; step += 1) {
    const time = step / 4096 * geometry.cyclePeriod;
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    const rodCases = [
      [blocks.frontRod, state.frontUpper.point, state.frontLower.point],
      [blocks.rearRod, state.rearUpper.point, state.rearLower.point],
    ];
    for (const [rod, expectedUpper, expectedLower] of rodCases) {
      maximumRodEndpointError = Math.max(
        maximumRodEndpointError,
        localUpperEye.clone().applyMatrix4(rod.matrixWorld)
          .distanceTo(expectedUpper),
        localLowerEye.clone().applyMatrix4(rod.matrixWorld)
          .distanceTo(expectedLower),
      );
      near(rod.userData.lengthError, 0, 1e-15,
        'rendered rod length closure');
    }
    const pinCases = [
      [blocks.frontCrankPins[0], state.frontUpper.point, geometry.frontPinCenterZ],
      [blocks.frontCrankPins[1], state.frontLower.point, geometry.frontPinCenterZ],
      [blocks.rearCrankPins[0], state.rearUpper.point, geometry.rearPinCenterZ],
      [blocks.rearCrankPins[1], state.rearLower.point, geometry.rearPinCenterZ],
    ];
    for (const [pin, expectedPoint, expectedZ] of pinCases) {
      const renderedPin = new THREE.Vector3().applyMatrix4(pin.matrixWorld);
      maximumPinError = Math.max(
        maximumPinError,
        renderedPin.distanceTo(expectedPoint.clone().setZ(expectedZ)),
      );
    }
    near(blocks.inputRotor.rotation.z, state.driverAngle, 0,
      'rendered input angle');
    near(blocks.outputRotor.rotation.z, state.drivenAngle, 0,
      'rendered output angle');
    for (const contact of Object.values(model.root.userData.contacts)) {
      if ('centerError' in contact) {
        near(contact.centerError, 0, 0, 'runtime joint coincidence');
        assert.ok(contact.axialCaptureMargin > 0);
      }
    }
  }
  assert.ok(maximumPinError <= 9e-16,
    `maximum rendered crank-pin error ${maximumPinError}`);
  assert.ok(maximumRodEndpointError <= 7.1e-16,
    `maximum rendered rod-eye error ${maximumRodEndpointError}`);
  disposeModel(model.root);
});

test('movement 230 closes in four authored seconds while movement 507 stays authored', () => {
  const model = createMovementModel(catalog.movements[229]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const finish = stateAtTime(geometry.cyclePeriod);
  for (const key of ['frontUpper', 'frontLower', 'rearUpper', 'rearLower']) {
    nearVector(finish[key].point, start[key].point, 1.4e-15,
      `${key} full-cycle point closure`);
    nearVector(finish[key].velocity, start[key].velocity, 2.3e-15,
      `${key} full-cycle velocity closure`);
    nearVector(finish[key].acceleration, start[key].acceleration, 3.6e-15,
      `${key} full-cycle acceleration closure`);
  }
  near(angularError(finish.drivenAngle, start.drivenAngle), 0, 2.5e-16,
    'output full-turn closure');
  near(finish.driverRevolutions, -1, 0, 'one input revolution per cycle');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 4);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  assertReadableTiming(model.root.userData.animationTiming);

  model.update(0);
  model.root.updateMatrixWorld(true);
  const indexStart = blocks.rotationIndexes.map((index) => (
    new THREE.Vector3().applyMatrix4(index.matrixWorld)
  ));
  model.update(geometry.cyclePeriod);
  model.root.updateMatrixWorld(true);
  blocks.rotationIndexes.forEach((index, indexNumber) => {
    nearVector(
      new THREE.Vector3().applyMatrix4(index.matrixWorld),
      indexStart[indexNumber],
      9e-16,
      'visible rotation index full-cycle closure',
    );
  });

  const movement507 = createMovementModel(catalog.movements[506]);
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(catalog.movements[506].fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(movement507.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(movement507.root);
});
