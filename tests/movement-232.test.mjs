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

function nearVector2(actual, expected, tolerance, message) {
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

test('movement 232 is the engraved A-B-C parallelogram ratchet with a retaining click', () => {
  const movement = catalog.movements[231];
  const model = createMovementModel(movement);
  const { archetype, blocks, fidelity, sourceAnimation } = model.root.userData;

  assert.equal(movement.id, 232);
  assert.equal(movement.number, '232');
  assert.equal(movement.title, 'Parallelogram Lift-and-Draw Pawl Ratchet');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'parallelogram-lift-and-draw-pawl-ratchet-with-retaining-click',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(blocks.framePlate.parent, model.root);
  assert.equal(blocks.inputLever.parent, model.root);
  assert.equal(blocks.pawl.parent, model.root);
  assert.equal(blocks.coupler.parent, model.root);
  assert.equal(blocks.retainingClick.parent, model.root);
  assert.equal(blocks.wheel.parent, model.root);
  assert.notEqual(blocks.inputLever, blocks.pawl);
  assert.notEqual(blocks.pawl, blocks.retainingClick);
  assert.equal(blocks.inputLeverBody.parent, blocks.inputLever);
  assert.equal(blocks.pawlBody.parent, blocks.pawl);
  assert.equal(blocks.retainingBody.parent, blocks.retainingClick);
  assert.equal(blocks.wheel.userData.teeth, 20);
  assert.equal(blocks.wheel.userData.gapCenters.length, 20);
  assert.equal(blocks.wheel.userData.trailingCorners.length, 20);
  disposeModel(model.root);
});

test('movement 232 preserves Brown’s measured pivots, source pose, and axial stack', () => {
  const model = createMovementModel(catalog.movements[231]);
  const {
    geometry,
    sourceReference,
    stateAtCycleCoordinate,
    transmission,
  } = model.root.userData;
  const plate = sourceReference.plate232;

  assert.deepEqual(plate.rasterWheelCenter.toArray(), [208, 261]);
  assert.deepEqual(plate.rasterUpperGroundPivot.toArray(), [210, 52]);
  assert.deepEqual(plate.rasterInputCouplerPivot.toArray(), [269, 260]);
  assert.deepEqual(plate.rasterPawlCouplerPivot.toArray(), [269, 58]);
  assert.deepEqual(plate.rasterRetainingClickPivot.toArray(), [320, 220]);
  assert.deepEqual(plate.rasterFrameMountHole.toArray(), [307, 281]);
  assert.equal(plate.frameLabel, 'A');
  assert.equal(plate.inputLabel, 'B');
  assert.equal(plate.pawlLabel, 'C');
  assert.equal(plate.inferredToothCount, 20);
  assert.equal(plate.visibleRetainingClick, true);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(sourceReference.primaryScan, {
    bookPage: 58,
    edition: 21,
    publicationYear: 1908,
  });
  near(geometry.toothPitch, FULL_TURN / 20, 0, 'twenty-tooth pitch');
  near(geometry.upperGroundPivot.length(), geometry.groundLength, 0,
    'fixed A pivot spacing');
  near(
    geometry.liftedHookPolarAngle - geometry.sourceHookPolarAngle,
    geometry.toothPitch,
    1.2e-16,
    'C travels backward exactly one tooth space',
  );
  assert.ok(geometry.liftedHookRadius > geometry.wheelOuterRadius + 0.94);
  assert.equal(transmission.outputTeethPerCycle, 1);
  assert.equal(transmission.pawlBackwardTravelDegrees, 17.999999999999993);
  assert.equal(transmission.returnStrokeWheelDwell, true);
  assert.equal(transmission.retainingClick, true);

  const source = stateAtCycleCoordinate(0);
  near(source.inputAngle, 0, 0, 'B is horizontal in the source pose');
  near(source.pawlAngle, 0, 0, 'C source orientation');
  nearVector2(
    source.inputCouplerPivot,
    new THREE.Vector2(geometry.shortLinkLength, 0),
    0,
    'lower coupler pivot',
  );
  nearVector2(
    source.pawlCouplerPivot,
    new THREE.Vector2(geometry.shortLinkLength, geometry.groundLength),
    0,
    'upper coupler pivot',
  );
  near(source.hookRadius, geometry.sourceHookRadius, 0,
    'C hook seated between teeth');
  near(source.hookPolarAngle, geometry.sourceHookPolarAngle, 0,
    'C hook source polar angle');

  const layers = geometry.axialLayers;
  const front = (layer) => layer.center + layer.depth / 2;
  const rear = (layer) => layer.center - layer.depth / 2;
  assert.ok(front(layers.wheel) - rear(layers.pawlC) > 0,
    'C overlaps the wheel axially at its working face');
  assert.ok(front(layers.wheel) - rear(layers.retainingClick) > 0,
    'retaining click overlaps the wheel axially');
  assert.ok(rear(layers.frameA) - front(layers.pawlC) > 0,
    'A clears the moving C body');
  assert.ok(rear(layers.inputB) - front(layers.frameA) > 0,
    'B clears fixed A');
  assert.ok(rear(layers.coupler) - front(layers.inputB) > 0,
    'front coupler clears B');
  disposeModel(model.root);
});

test('movement 232 holds on lift and indexes monotonically through 65,537 states', () => {
  const model = createMovementModel(catalog.movements[231]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  let previousWheelAngle = Infinity;
  let maximumClosureError = 0;
  let maximumCouplerError = 0;
  let maximumInputLinkError = 0;
  let maximumOutputLinkError = 0;
  let maximumContactError = 0;
  let maximumNormalVelocityError = 0;
  let maximumSlidingSpeed = 0;
  let maximumClickLift = 0;
  let minimumHookClearance = Infinity;
  let minimumClickLift = Infinity;
  let minimumWheelSpeed = Infinity;
  let maximumWheelSpeed = -Infinity;

  for (let index = 0; index <= 65_536; index += 1) {
    const state = stateAtCycleCoordinate(index / 65_536);
    assert.ok(state.wheelAngle <= previousWheelAngle + 7e-16,
      `wheel reversed at state ${index}`);
    previousWheelAngle = state.wheelAngle;
    maximumClosureError = Math.max(
      maximumClosureError,
      Math.abs(state.fourBarClosureError),
    );
    maximumCouplerError = Math.max(
      maximumCouplerError,
      Math.abs(state.couplerLengthError),
    );
    maximumInputLinkError = Math.max(
      maximumInputLinkError,
      Math.abs(state.inputShortLinkLengthError),
    );
    maximumOutputLinkError = Math.max(
      maximumOutputLinkError,
      Math.abs(state.outputShortLinkLengthError),
    );
    minimumHookClearance = Math.min(
      minimumHookClearance,
      state.pawlLiftClearance,
    );
    minimumClickLift = Math.min(
      minimumClickLift,
      state.retainingNoseRadialLift,
    );
    maximumClickLift = Math.max(
      maximumClickLift,
      state.retainingNoseRadialLift,
    );
    minimumWheelSpeed = Math.min(minimumWheelSpeed, state.wheelAngularSpeed);
    maximumWheelSpeed = Math.max(maximumWheelSpeed, state.wheelAngularSpeed);
    if (state.lifting) {
      assert.equal(state.wheelDwelling, true);
      assert.equal(state.wheelAngularSpeed, 0);
      assert.equal(state.wheelAngularAcceleration, 0);
      assert.equal(state.contact, null);
      assert.equal(state.retainingClickEngaged, true);
    } else {
      assert.equal(state.driving, true);
      assert.ok(state.contact);
      maximumContactError = Math.max(
        maximumContactError,
        state.contact.positionError,
      );
      maximumNormalVelocityError = Math.max(
        maximumNormalVelocityError,
        state.contact.normalVelocityError,
      );
      maximumSlidingSpeed = Math.max(
        maximumSlidingSpeed,
        state.contact.slidingSpeed,
      );
    }
  }
  const finish = stateAtCycleCoordinate(1);
  assert.equal(maximumClosureError, 0);
  assert.equal(maximumCouplerError, 0);
  assert.ok(maximumInputLinkError <= 1.2e-16);
  assert.ok(maximumOutputLinkError <= 3.4e-16);
  assert.ok(maximumContactError <= 6.3e-16);
  assert.ok(maximumNormalVelocityError <= 4.5e-16);
  assert.ok(maximumSlidingSpeed > 1.18);
  assert.ok(minimumHookClearance >= -2.3e-16);
  assert.ok(minimumClickLift >= -2.3e-16);
  assert.ok(maximumClickLift > 0.1);
  assert.ok(minimumWheelSpeed < -0.302);
  assert.equal(maximumWheelSpeed, 0);
  near(finish.wheelAngle, -geometry.toothPitch, 0, 'one clockwise index');
  near(finish.teethAdvanced, 1, 0, 'one tooth advanced');
  disposeModel(model.root);
});

test('movement 232 tooth corner slides on C without separation or normal slip', () => {
  const model = createMovementModel(catalog.movements[231]);
  const {
    contactSurfaceAtPawlAngle,
    geometry,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const firstSurface = contactSurfaceAtPawlAngle(0).contactLocal;
  const lastSurface = contactSurfaceAtPawlAngle(
    geometry.inputSwing,
  ).contactLocal;
  nearVector2(geometry.pawlSurfaceSamples[0], firstSurface, 0,
    'rendered C curve low endpoint');
  nearVector2(geometry.pawlSurfaceSamples.at(-1), lastSurface, 0,
    'rendered C curve lifted endpoint');

  let maximumPositionError = 0;
  let maximumNormalVelocityError = 0;
  let minimumTangentLength = Infinity;
  for (let index = 0; index <= 32_768; index += 1) {
    const coordinate = 0.5 + index / 32_768 * 0.5;
    const state = stateAtCycleCoordinate(coordinate);
    if (coordinate === 1) continue;
    const contact = state.contact;
    assert.ok(contact);
    maximumPositionError = Math.max(maximumPositionError, contact.positionError);
    maximumNormalVelocityError = Math.max(
      maximumNormalVelocityError,
      contact.normalVelocityError,
    );
    minimumTangentLength = Math.min(
      minimumTangentLength,
      contact.surfaceTangent.length(),
    );
    near(contact.surfaceTangent.dot(contact.surfaceNormal), 0, 1.2e-16,
      'contact tangent-normal orthogonality');
    near(contact.wheelPoint.length(), geometry.wheelOuterRadius, 4.5e-16,
      'active tooth corner remains on outer radius');
  }
  assert.ok(maximumPositionError <= 6.3e-16);
  assert.ok(maximumNormalVelocityError <= 4.5e-16);
  near(minimumTangentLength, 1, 3.4e-16, 'normalized C contact tangent');
  disposeModel(model.root);
});

test('movement 232 analytic speeds and accelerations match finite differences', () => {
  const model = createMovementModel(catalog.movements[231]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  const coordinateStep = 1e-5;
  const timeStep = coordinateStep / geometry.cyclesPerSecond;
  const samples = [0.08, 0.2, 0.35, 0.58, 0.68, 0.82, 0.94, 1.18];
  const triplets = [
    ['inputAngle', 'inputAngularSpeed', 'inputAngularAcceleration'],
    ['pawlAngle', 'pawlAngularSpeed', 'pawlAngularAcceleration'],
    ['wheelAngle', 'wheelAngularSpeed', 'wheelAngularAcceleration'],
    ['clickAngle', 'clickAngularSpeed', 'clickAngularAcceleration'],
  ];
  for (const coordinate of samples) {
    const before = stateAtCycleCoordinate(coordinate - coordinateStep);
    const state = stateAtCycleCoordinate(coordinate);
    const after = stateAtCycleCoordinate(coordinate + coordinateStep);
    for (const [position, velocity, acceleration] of triplets) {
      const numericalVelocity = (after[position] - before[position])
        / (2 * timeStep);
      const numericalAcceleration = (
        after[position] - 2 * state[position] + before[position]
      ) / timeStep ** 2;
      near(numericalVelocity, state[velocity], 3e-9,
        `${position} finite-difference velocity at ${coordinate}`);
      near(numericalAcceleration, state[acceleration], 3e-6,
        `${position} finite-difference acceleration at ${coordinate}`);
    }
  }
  disposeModel(model.root);
});

test('movement 232 retaining click locks successive gaps and clears during drive', () => {
  const model = createMovementModel(catalog.movements[231]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  const source = stateAtCycleCoordinate(0);
  const lifted = stateAtCycleCoordinate(0.5);
  const driveMiddle = stateAtCycleCoordinate(0.75);
  const finish = stateAtCycleCoordinate(1);

  near(source.clickAngle, geometry.retainingRestAngle, 0,
    'source click seated');
  near(lifted.clickAngle, geometry.retainingRestAngle, 0,
    'click holds throughout lift');
  near(driveMiddle.clickAngle,
    geometry.retainingRestAngle + geometry.retainingLift, 0,
    'click rides over the passing tooth');
  near(finish.clickAngle, geometry.retainingRestAngle, 0,
    'click reseats after index');
  nearVector2(source.retainingNosePoint, geometry.retainingNoseAtRest, 3e-16,
    'source retaining nose');
  nearVector2(finish.retainingNosePoint, geometry.retainingNoseAtRest, 3e-16,
    'next-gap retaining nose');
  assert.ok(driveMiddle.retainingNoseRadialLift > 0.1);
  assert.equal(source.retainingClickEngaged, true);
  assert.equal(driveMiddle.retainingClickEngaged, false);
  assert.equal(finish.retainingClickEngaged, true);
  const sourceHoldingGap = geometry.gapMountPhase - 2 * geometry.toothPitch;
  const nextHoldingGap = geometry.gapMountPhase - geometry.toothPitch
    + finish.wheelAngle;
  near(sourceHoldingGap, 0, 0, 'source holding gap at click');
  near(nextHoldingGap, 0, 0, 'next holding gap at click');
  disposeModel(model.root);
});

test('movement 232 renderer binds every link, pin, contact, and index for 4,097 frames', () => {
  const model = createMovementModel(catalog.movements[231]);
  const { blocks, geometry, stateAtCycleCoordinate } = model.root.userData;
  let maximumLowerPinError = 0;
  let maximumUpperPinError = 0;

  for (let index = 0; index <= 4_096; index += 1) {
    const coordinate = index / 4_096;
    const time = coordinate / geometry.cyclesPerSecond;
    const state = stateAtCycleCoordinate(coordinate);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.inputLever.rotation.z, state.inputAngle, 0,
      'rendered B angle');
    near(blocks.pawl.rotation.z, state.pawlAngle, 0,
      'rendered C angle');
    near(blocks.retainingClick.rotation.z, state.clickAngle, 0,
      'rendered click angle');
    near(blocks.wheel.userData.rotor.rotation.z, state.wheelAngle, 0,
      'rendered wheel angle');
    maximumLowerPinError = Math.max(
      maximumLowerPinError,
      new THREE.Vector2(
        blocks.inputCouplerPin.position.x,
        blocks.inputCouplerPin.position.y,
      ).distanceTo(state.inputCouplerPivot),
    );
    maximumUpperPinError = Math.max(
      maximumUpperPinError,
      new THREE.Vector2(
        blocks.pawlCouplerPin.position.x,
        blocks.pawlCouplerPin.position.y,
      ).distanceTo(state.pawlCouplerPivot),
    );
    assert.equal(blocks.contactMarker.visible, state.driving);
    assert.ok(Number.isFinite(model.root.userData.kinematics.wheelAngle));
    assert.ok(Number.isFinite(model.root.userData.kinematics.inputAngle));
    if (state.driving) {
      near(
        blocks.contactMarker.position.x,
        state.contact.wheelPoint.x,
        0,
        'rendered contact x',
      );
      near(
        blocks.contactMarker.position.y,
        state.contact.wheelPoint.y,
        0,
        'rendered contact y',
      );
    }
  }
  assert.equal(maximumLowerPinError, 0);
  assert.equal(maximumUpperPinError, 0);
  disposeModel(model.root);
});

test('movement 232 advances one tooth in four seconds, closes in twenty cycles, and leaves 269 authored', () => {
  const model = createMovementModel(catalog.movements[231]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const source = stateAtTime(0);
  const oneCycle = stateAtTime(geometry.cyclePeriod);
  const fullWheelTurn = stateAtTime(geometry.cyclePeriod * geometry.toothCount);
  near(oneCycle.wheelAngle - source.wheelAngle, -geometry.toothPitch, 0,
    'one four-second tooth index');
  near(oneCycle.teethAdvanced - source.teethAdvanced, 1, 0,
    'one tooth per B vibration');
  near(fullWheelTurn.wheelAngle - source.wheelAngle, -FULL_TURN, 0,
    'twenty-cycle wheel revolution');
  near(fullWheelTurn.inputAngle, source.inputAngle, 0,
    'B full demonstration closure');
  near(fullWheelTurn.pawlAngle, source.pawlAngle, 0,
    'C full demonstration closure');
  near(fullWheelTurn.clickAngle, source.clickAngle, 0,
    'retaining click full demonstration closure');

  model.update(0);
  const sourceWheelRotation = blocks.wheel.userData.rotor.rotation.z;
  model.update(geometry.cyclePeriod * geometry.toothCount);
  near(
    blocks.wheel.userData.rotor.rotation.z - sourceWheelRotation,
    -FULL_TURN,
    0,
    'rendered wheel full turn',
  );

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model289.root);
});
