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

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vector2Near(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function vector3Near(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

test('movement 220 is two offset parallel shafts joined only by one wrist and radial slot', () => {
  const movement = catalog.movements[219];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    geometry,
    mechanism,
    sourceAnimation,
  } = model.root.userData;

  assert.equal(movement.id, 220);
  assert.equal(movement.number, '220');
  assert.equal(
    movement.title,
    'Offset Parallel-Shaft Slotted-Crank Coupling',
  );
  assert.equal(movement.category, 'Cranks & reciprocation');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'offset-parallel-shaft-wrist-pin-radial-slot-coupling',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'parallel-offset-shafts-coupled-by-wrist-in-radial-slot',
  );
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.sourceUrl, movement.sourceUrl);

  assert.equal(blocks.inputArm.parent, blocks.inputCrank.userData.rotor);
  assert.equal(blocks.inputHub.parent, blocks.inputCrank.userData.rotor);
  assert.equal(blocks.inputWristBoss.parent, blocks.inputCrank.userData.rotor);
  assert.equal(blocks.wristPin.parent, blocks.inputCrank.userData.rotor);
  assert.equal(blocks.slotFollowerRoller.parent, blocks.inputCrank.userData.rotor);
  assert.equal(blocks.inputWristAnchor.parent, blocks.inputCrank.userData.rotor);
  assert.equal(blocks.outputSlottedArm.parent, blocks.outputCrank.userData.rotor);
  assert.equal(blocks.outputHub.parent, blocks.outputCrank.userData.rotor);
  assert.equal(blocks.outputIndex.parent, blocks.outputCrank.userData.rotor);
  assert.equal(blocks.outputSlotAnchor.parent, blocks.outputCrank.userData.rotor);
  assert.equal(blocks.inputShaft.parent, model.root);
  assert.equal(blocks.outputShaft.parent, model.root);
  assert.equal(blocks.wristPin.userData.parallelCouplingWrist, true);

  for (const object of [
    blocks.inputCrank,
    blocks.inputShaft,
    blocks.outputCrank,
    blocks.outputShaft,
    blocks.wristPin,
  ]) {
    assert.ok(object.userData.axis.distanceTo(Z_AXIS) < 1e-12);
  }
  assert.ok(Math.abs(
    blocks.inputShaft.userData.axis.dot(blocks.outputShaft.userData.axis) - 1,
  ) < 1e-12, 'the two shaft directions are parallel');
  near(
    geometry.inputCenter.distanceTo(geometry.outputCenter),
    geometry.centerDistance,
    0,
    'the two parallel shaft centerlines are not coincident',
  );
  assert.ok(geometry.centerDistance > 0);
  assert.ok(geometry.inputCrankRadius > geometry.centerDistance,
    'the wrist orbit encloses the output center for continuous one-way rotation');

  const inventedFrames = [];
  model.root.traverse((object) => {
    if (/frame|rail|backdrop/.test(object.userData.role ?? '')) {
      inventedFrames.push(object);
    }
  });
  assert.deepEqual(inventedFrames, []);
  assert.ok(model.root.userData.cameraFitBounds?.isBox3);
  disposeModel(model.root);
});

test('movement 220 preserves the proportions and projected parallel axes of plate 220', () => {
  const model = createMovementModel(catalog.movements[219]);
  const {
    canonicalTimes,
    geometry,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate220;

  assert.equal(
    sourceReference.sourceUrl,
    'https://507movements.com/mm_220.html',
  );
  assert.match(
    sourceReference.officialDescription,
    /parallel in direction, but not in line/i,
  );
  assert.match(sourceReference.officialDescription, /varying velocity/i);
  assert.deepEqual(plate.rasterInputCrankCenter.toArray(), [196, 311]);
  assert.deepEqual(plate.rasterOutputCrankCenter.toArray(), [315, 315]);
  assert.deepEqual(plate.rasterWristAtInputPlane.toArray(), [263, 185]);
  assert.deepEqual(plate.rasterWristAtSlotPlane.toArray(), [313, 151]);
  assert.deepEqual(plate.rasterSlotFarEnd.toArray(), [310, 84]);

  const inputShaftProjection = plate.rasterInputCrankCenter.clone().sub(
    plate.rasterInputShaftFarPoint,
  ).normalize();
  const outputShaftProjection = plate.rasterOutputShaftFarPoint.clone().sub(
    plate.rasterOutputCrankCenter,
  ).normalize();
  const wristProjection = plate.rasterWristAtSlotPlane.clone().sub(
    plate.rasterWristAtInputPlane,
  ).normalize();
  assert.ok(inputShaftProjection.dot(outputShaftProjection) > 0.999,
    'the two engraved shaft projections are parallel');
  assert.ok(wristProjection.dot(outputShaftProjection) > 0.997,
    'the wrist pin projects in the same axial direction');
  const rasterCenterDistance = plate.rasterInputCrankCenter.distanceTo(
    plate.rasterOutputCrankCenter,
  );
  const rasterInputRadius = plate.rasterInputCrankCenter.distanceTo(
    plate.rasterWristAtInputPlane,
  );
  near(
    geometry.centerDistance / geometry.inputCrankRadius,
    rasterCenterDistance / rasterInputRadius,
    0.05,
    'source shaft-offset to crank-radius ratio',
  );

  model.update(canonicalTimes.sourcePose);
  const source = model.root.userData.kinematics;
  near(source.inputAngle, geometry.sourceInputAngle, 0,
    'source input-crank angle');
  near(source.outputAngle, geometry.sourceOutputAngle, 0,
    'source slotted-crank angle');
  assert.ok(source.inputAngle > 0 && source.inputAngle < Math.PI / 2);
  assert.ok(source.outputAngle > Math.PI / 2 && source.outputAngle < Math.PI,
    'the source input points up-right while the slotted crank stands up-left');
  assert.ok(source.slotRadius > geometry.minimumSlotRadius);
  assert.ok(source.slotRadius < geometry.maximumSlotRadius);
  disposeModel(model.root);
});

test('movement 220 keeps the wrist exactly in the radial slot through 32,769 states', () => {
  const model = createMovementModel(catalog.movements[219]);
  const {
    geometry,
    solidClearanceAtInputTravel,
    stateAtInputTravel,
    transmission,
  } = model.root.userData;
  let previousOutputAngle = -Infinity;
  let minimumSlotRadius = Infinity;
  let maximumSlotRadius = -Infinity;
  let minimumRatio = Infinity;
  let maximumRatio = -Infinity;
  let maximumPositionError = 0;
  let maximumVelocityError = 0;
  let maximumAccelerationError = 0;

  for (let index = 0; index <= 32768; index += 1) {
    const inputTravel = index / 32768 * FULL_TURN;
    const state = stateAtInputTravel(inputTravel);
    assert.ok(state.outputAngle > previousOutputAngle || index === 0,
      'the enclosed output center produces continuous one-way rotation');
    previousOutputAngle = state.outputAngle;
    minimumSlotRadius = Math.min(minimumSlotRadius, state.slotRadius);
    maximumSlotRadius = Math.max(maximumSlotRadius, state.slotRadius);
    minimumRatio = Math.min(minimumRatio, state.outputToInputSpeedRatio);
    maximumRatio = Math.max(maximumRatio, state.outputToInputSpeedRatio);

    const expectedWrist = geometry.inputCenter.clone().add(
      new THREE.Vector2(
        Math.cos(state.inputAngle),
        Math.sin(state.inputAngle),
      ).multiplyScalar(geometry.inputCrankRadius),
    );
    vector2Near(state.wristPoint, expectedWrist, 0,
      `fixed-radius input wrist ${index}`);
    const expectedFromOutput = geometry.outputCenter.clone().add(
      new THREE.Vector2(
        Math.cos(state.outputAngle),
        Math.sin(state.outputAngle),
      ).multiplyScalar(state.slotRadius),
    );
    vector2Near(state.wristPoint, expectedFromOutput, 2.2e-15,
      `same wrist in output slot ${index}`);
    near(
      state.outputToInputSpeedRatio,
      geometry.inputCrankRadius * (
        geometry.inputCrankRadius
          - geometry.centerDistance * Math.cos(state.inputAngle)
      ) / state.slotRadius ** 2,
      1.8e-15,
      `instantaneous angular ratio ${index}`,
    );
    assert.ok(state.outputToInputSpeedRatio > 0);
    maximumPositionError = Math.max(maximumPositionError, state.wristPositionError);
    maximumVelocityError = Math.max(maximumVelocityError, state.wristVelocityError);
    maximumAccelerationError = Math.max(
      maximumAccelerationError,
      state.wristAccelerationError,
    );
    const clearances = solidClearanceAtInputTravel(inputTravel);
    assert.ok(clearances.crankPlaneClearance > 0.41);
    assert.ok(clearances.innerSlotTravelMargin > 0.199);
    assert.ok(clearances.outerSlotTravelMargin > 0.199);
    assert.ok(clearances.wristToSlotSideClearance > 0.059);
  }

  // The source phase is not a binary subdivision of the exhaustive grid, so
  // evaluate the two analytic extrema separately as well.
  const nearest = stateAtInputTravel(FULL_TURN - geometry.sourceInputAngle);
  const farthest = stateAtInputTravel(Math.PI - geometry.sourceInputAngle);
  near(nearest.slotRadius, geometry.minimumSlotRadius, 2e-16,
    'nearest wrist radius');
  near(farthest.slotRadius, geometry.maximumSlotRadius, 0,
    'farthest wrist radius');
  near(nearest.outputToInputSpeedRatio,
    transmission.maximumOutputToInputSpeedRatio, 9e-15,
    'maximum output ratio');
  near(farthest.outputToInputSpeedRatio,
    transmission.minimumOutputToInputSpeedRatio, 2e-16,
    'minimum output ratio');
  assert.ok(minimumSlotRadius > geometry.minimumSlotRadius);
  assert.ok(maximumSlotRadius < geometry.maximumSlotRadius);
  assert.ok(minimumRatio > transmission.minimumOutputToInputSpeedRatio);
  assert.ok(maximumRatio < transmission.maximumOutputToInputSpeedRatio);
  assert.ok(maximumPositionError < 2.2e-15);
  assert.ok(maximumVelocityError < 2.1e-15);
  assert.ok(maximumAccelerationError < 1.4e-14);
  disposeModel(model.root);
});

test('movement 220 analytic rates and reverse drive agree over both full turns', () => {
  const model = createMovementModel(catalog.movements[219]);
  const {
    driverAngleAtOutputAngle,
    geometry,
    outputAngleAtInputAngle,
    stateAtInputTravel,
    transmission,
  } = model.root.userData;
  const step = 1e-5;
  let maximumOutputRateError = 0;
  let maximumOutputAccelerationError = 0;
  let maximumSlotRateError = 0;
  let maximumSlotAccelerationError = 0;
  for (let index = 0; index < 4096; index += 1) {
    const inputTravel = (index + 0.31) / 4096 * FULL_TURN;
    const before = stateAtInputTravel(inputTravel - step);
    const state = stateAtInputTravel(inputTravel);
    const after = stateAtInputTravel(inputTravel + step);
    const timeStep = step / transmission.inputAngularSpeed;
    const finiteOutputRate = (after.outputAngle - before.outputAngle)
      / (2 * timeStep);
    const finiteOutputAcceleration = (
      after.outputAngularSpeed - before.outputAngularSpeed
    ) / (2 * timeStep);
    const finiteSlotRate = (after.slotRadius - before.slotRadius)
      / (2 * timeStep);
    const finiteSlotAcceleration = (
      after.slotRadialSpeed - before.slotRadialSpeed
    ) / (2 * timeStep);
    maximumOutputRateError = Math.max(
      maximumOutputRateError,
      Math.abs(finiteOutputRate - state.outputAngularSpeed),
    );
    maximumOutputAccelerationError = Math.max(
      maximumOutputAccelerationError,
      Math.abs(finiteOutputAcceleration - state.outputAngularAcceleration),
    );
    maximumSlotRateError = Math.max(
      maximumSlotRateError,
      Math.abs(finiteSlotRate - state.slotRadialSpeed),
    );
    maximumSlotAccelerationError = Math.max(
      maximumSlotAccelerationError,
      Math.abs(finiteSlotAcceleration - state.slotRadialAcceleration),
    );
  }
  assert.ok(maximumOutputRateError < 3e-9);
  assert.ok(maximumOutputAccelerationError < 2e-8);
  assert.ok(maximumSlotRateError < 4e-10);
  assert.ok(maximumSlotAccelerationError < 5e-9);

  let maximumInverseAngleError = 0;
  let maximumInverseRadiusError = 0;
  for (let index = 0; index <= 32768; index += 1) {
    const outputAngle = geometry.sourceOutputAngle
      + index / 32768 * FULL_TURN;
    const inverse = driverAngleAtOutputAngle(outputAngle);
    maximumInverseAngleError = Math.max(
      maximumInverseAngleError,
      Math.abs(outputAngleAtInputAngle(inverse.inputAngle) - outputAngle),
    );
    const state = stateAtInputTravel(
      inverse.inputAngle - geometry.sourceInputAngle,
    );
    maximumInverseRadiusError = Math.max(
      maximumInverseRadiusError,
      Math.abs(state.slotRadius - inverse.slotRadius),
    );
  }
  assert.ok(maximumInverseAngleError < 4e-15,
    'either shaft can drive the other without a branch ambiguity');
  assert.ok(maximumInverseRadiusError < 1.8e-15);

  const source = stateAtInputTravel(0);
  const closure = stateAtInputTravel(FULL_TURN);
  near(closure.inputAngle - source.inputAngle, FULL_TURN, 0,
    'input full-turn closure');
  near(closure.outputAngle - source.outputAngle, FULL_TURN, 9e-16,
    'output full-turn closure');
  near(closure.slotRadius, source.slotRadius, 7e-16,
    'slot-radius closure');
  near(transmission.outputTurnsPerInputTurn, 1, 0,
    'one output turn per input turn');
  disposeModel(model.root);
});

test('movement 220 has one real open radial slot with safe axial and lateral clearance', () => {
  const model = createMovementModel(catalog.movements[219]);
  const {
    blocks,
    geometry,
    solidClearanceAtInputTravel,
  } = model.root.userData;

  assert.equal(blocks.outputSlottedArm.geometry.type, 'ExtrudeGeometry');
  assert.equal(
    blocks.outputSlottedArm.geometry.parameters.shapes.holes.length,
    1,
    'the blue crank contains a true open slot, not a painted groove',
  );
  assert.ok(geometry.slotStartRadius < geometry.minimumSlotRadius);
  assert.ok(geometry.slotEndRadius > geometry.maximumSlotRadius);
  near(
    geometry.minimumSlotRadius,
    geometry.inputCrankRadius - geometry.centerDistance,
    0,
    'inner radial limit',
  );
  near(
    geometry.maximumSlotRadius,
    geometry.inputCrankRadius + geometry.centerDistance,
    0,
    'outer radial limit',
  );
  assert.ok(geometry.slotHalfWidth > geometry.wristPinRadius);
  assert.ok(geometry.outputPlaneZ > geometry.inputPlaneZ);
  const clearance = solidClearanceAtInputTravel(0);
  near(clearance.crankPlaneClearance, 0.42, 0,
    'two crank-arm planes stay disjoint');
  near(clearance.wristToSlotSideClearance, 0.06, 0,
    'wrist has visible lateral running clearance');
  assert.ok(geometry.wristPinLength
    > geometry.outputPlaneZ - geometry.inputPlaneZ + geometry.crankDepth,
  'the one axial wrist physically reaches through both crank planes');
  disposeModel(model.root);
});

test('movement 220 runtime keeps both rendered wrist anchors coincident while 262 stays authored', () => {
  const model = createMovementModel(catalog.movements[219]);
  const {
    blocks,
    canonicalTimes,
  } = model.root.userData;
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    near(blocks.inputCrank.userData.rotor.rotation.z, state.inputAngle, 0,
      'rendered input crank angle');
    near(blocks.inputShaft.userData.rotor.rotation.z, state.inputAngle, 0,
      'rendered input shaft angle');
    near(blocks.outputCrank.userData.rotor.rotation.z, state.outputAngle, 0,
      'rendered output crank angle');
    near(blocks.outputShaft.userData.rotor.rotation.z, state.outputAngle, 0,
      'rendered output shaft angle');
    near(blocks.outputSlotAnchor.position.x, state.slotRadius, 0,
      'rendered slot coordinate');
    const inputAnchorWorld = blocks.inputWristAnchor.getWorldPosition(
      new THREE.Vector3(),
    );
    const outputAnchorWorld = blocks.outputSlotAnchor.getWorldPosition(
      new THREE.Vector3(),
    );
    const rollerWorld = blocks.slotFollowerRoller.getWorldPosition(
      new THREE.Vector3(),
    );
    vector3Near(inputAnchorWorld, outputAnchorWorld, 2.2e-15,
      'input wrist and output slot describe one physical point');
    vector3Near(inputAnchorWorld, rollerWorld, 0,
      'visible roller is centered at that wrist');
    vector2Near(
      new THREE.Vector2(inputAnchorWorld.x, inputAnchorWorld.y),
      state.wristPoint,
      9e-16,
      'rendered wrist follows the analytic crank circle',
    );
    assert.ok(model.root.userData.constraint.positionError < 2.2e-15);
    assert.ok(model.root.userData.constraint.velocityError < 2.1e-15);
    assert.ok(model.root.userData.constraint.accelerationError < 1.4e-14);
  }

  model.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 2.4);
  assert.ok(size.y > 4.3);
  assert.ok(size.z > 3.7);
  let meshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  assert.ok(meshCount >= 10);

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
