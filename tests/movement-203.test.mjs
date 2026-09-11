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

function finiteStateNumbers(value, path = 'state') {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} is finite`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (value.isVector2 || value.isVector3) {
    value.toArray().forEach((coordinate, index) => {
      assert.ok(Number.isFinite(coordinate), `${path}[${index}] is finite`);
    });
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    finiteStateNumbers(child, `${path}.${key}`);
  }
}

test('movement 203 is one curved circular-slot input arm driving one straight output arm', () => {
  const movement = catalog.movements[202];
  const model = createMovementModel(movement);
  const {
    blocks,
    sourceAnimation,
    sourceRaster,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 203);
  assert.equal(movement.number, '203');
  assert.equal(
    movement.title,
    'Curved Slotted Arm and Variable Straight-Arm Vibration',
  );
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(
    movement.description,
    '203. A regular vibrating movement of the curved slotted arm gives a variable vibration to the straight arm.',
  );
  assert.equal(
    movement.archetype,
    'regular-rocking-circular-slot-variable-output-straight-arm',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'one-curved-arm-carries-one-circular-slot-constraining-one-pin-on-one-fixed-pivot-straight-arm',
  );
  assert.equal(
    model.root.userData.variant,
    'clockwise-218-degree-regular-input-stroke-with-upper-circle-intersection-and-variable-output-gain',
  );

  assert.equal(blocks.inputArm.parent, model.root);
  assert.equal(blocks.outputArm.parent, model.root);
  assert.equal(blocks.inputShaft.parent, model.root);
  assert.equal(blocks.outputShaft.parent, model.root);
  assert.equal(blocks.curvedPlate.parent, blocks.inputArm);
  assert.equal(blocks.inputBoss.parent, blocks.inputArm);
  assert.equal(blocks.slotInnerEdge.parent, blocks.inputArm);
  assert.equal(blocks.slotOuterEdge.parent, blocks.inputArm);
  assert.equal(blocks.outputArmBody.parent, blocks.outputArm);
  assert.equal(blocks.outputPivotBoss.parent, blocks.outputArm);
  assert.equal(blocks.followerBoss.parent, blocks.outputArm);
  assert.equal(blocks.followerPin.parent, blocks.outputArm);
  assert.equal(blocks.followerPinRim.parent, blocks.outputArm);
  assert.equal(blocks.curvedPlate.userData.actualThroughSlot, true);
  assert.equal(blocks.inputArm.userData.regularVibration, true);
  assert.equal(blocks.followerPin.userData.fitsCircularSlot, true);
  assert.equal(blocks.inputShaft.userData.keyedToInputArm, true);
  assert.equal(blocks.outputShaft.userData.keyedToOutputArm, true);

  assert.equal(transmission.circularSlotCount, 1);
  assert.equal(transmission.followerPinCount, 1);
  assert.equal(transmission.outputArmCount, 1);
  assert.equal(transmission.variableOutputGain, true);
  assert.equal(sourceAnimation.selectedIntersectionBranch, 'greatest-y');
  assert.equal(sourceAnimation.slotRadius, 6);
  assert.equal(sourceAnimation.outputArmLength, 12);
  assert.deepEqual(sourceRaster.imageSize.toArray(), [525, 525]);
  assert.equal(sourceRaster.sourceUrl, movement.sourceUrl);

  const roleCounts = {
    belt: 0,
    curvedInputArm: 0,
    followerPin: 0,
    gear: 0,
    pulley: 0,
    straightOutputArm: 0,
    throughSlot: 0,
  };
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (/belt/i.test(role)) roleCounts.belt += 1;
    if (role === 'regularly-vibrating-curved-slotted-input-arm') {
      roleCounts.curvedInputArm += 1;
    }
    if (role === 'single-pin-sliding-in-curved-arm-slot') {
      roleCounts.followerPin += 1;
    }
    if (/gear/i.test(role)) roleCounts.gear += 1;
    if (/pulley/i.test(role)) roleCounts.pulley += 1;
    if (role === 'single-straight-variable-vibration-output-arm') {
      roleCounts.straightOutputArm += 1;
    }
    if (role === 'one-piece-curved-input-arm-with-one-circular-through-slot') {
      roleCounts.throughSlot += 1;
    }
  });
  assert.deepEqual(roleCounts, {
    belt: 0,
    curvedInputArm: 1,
    followerPin: 1,
    gear: 0,
    pulley: 0,
    straightOutputArm: 1,
    throughSlot: 1,
  });
  disposeModel(model.root);
});

test('movement 203 preserves the reference construction, clockwise branch, and 40-10-40-10 regular drive', () => {
  const model = createMovementModel(catalog.movements[202]);
  const {
    driveAtCyclePhase,
    geometry,
    sourceAnimation,
    stateAtInputAngle,
    transmission,
  } = model.root.userData;

  vector2Near(geometry.sourceInputPivot, new THREE.Vector2(0, 0), 0, 'source input pivot');
  vector2Near(
    geometry.sourceSlotCenter,
    new THREE.Vector2(-0.052357, 2.999543),
    0,
    'source slot center',
  );
  vector2Near(
    geometry.sourceOutputPivot,
    new THREE.Vector2(11.842928, 8.998629),
    0,
    'source output pivot',
  );
  vector2Near(
    geometry.sourceInputCam0,
    new THREE.Vector2(3, 0),
    0,
    'source input cam zero vector',
  );
  vector2Near(
    geometry.sourceInputCam1,
    new THREE.Vector2(-2.336648, 1.881509),
    0,
    'source input cam far vector',
  );
  near(geometry.sourceInputCam0.length(), 3, 0, 'source cam-0 radius');
  near(geometry.sourceInputCam1.length(), 3, 2e-9, 'source cam-1 radius');
  near(
    geometry.inputStrokeAngle,
    geometry.sourceInputEndpointAngle - FULL_TURN,
    1e-15,
    'clockwise interpolation branch',
  );
  assert.ok(geometry.inputStrokeAngle < -Math.PI);
  near(
    THREE.MathUtils.radToDeg(geometry.inputStrokeMagnitude),
    218.841613,
    1e-6,
    'clockwise stroke magnitude in degrees',
  );
  near(
    geometry.slotCenterLocal.length(),
    geometry.sourceSlotCenter.length() * geometry.sourceScale,
    1e-15,
    'scaled slot-center offset',
  );
  near(
    geometry.slotRadius,
    geometry.sourceSlotRadius * geometry.sourceScale,
    1e-15,
    'scaled slot radius',
  );
  near(
    geometry.outputArmLength,
    geometry.sourceOutputArmLength * geometry.sourceScale,
    1e-15,
    'scaled output arm length',
  );
  near(
    geometry.followerPinRadius,
    geometry.sourceFollowerPinRadius * geometry.sourceScale,
    1e-15,
    'scaled follower-pin radius',
  );

  assert.deepEqual(
    sourceAnimation.inputCamKeyframes.map(({ cyclePosition }) => cyclePosition),
    [0, 0.4, 0.5, 0.9],
  );
  assert.deepEqual(
    sourceAnimation.inputCamKeyframes.map(({ clockwise }) => clockwise),
    [true, true, false, false],
  );
  assert.deepEqual(sourceAnimation.boundingBox, [-9.504714, -9.500457, 25, 25]);
  vector2Near(sourceAnimation.slotCenter, geometry.sourceSlotCenter, 0, 'source animation slot center');
  vector2Near(sourceAnimation.outputPivot, geometry.sourceOutputPivot, 0, 'source animation output pivot');

  const sourcePose = stateAtInputAngle(0);
  const farPose = stateAtInputAngle(geometry.inputStrokeAngle);
  vector2Near(
    sourcePose.followerPoint.clone().divideScalar(geometry.sourceScale),
    new THREE.Vector2(-0.157072, 8.998629161139462),
    2e-6,
    'source-pose follower anchor',
  );
  vector2Near(
    farPose.followerPoint.clone().divideScalar(geometry.sourceScale),
    new THREE.Vector2(1.8404411818614324, 2.3691299651585123),
    2e-6,
    'far-pose follower anchor',
  );
  near(
    farPose.localSlotAngle - sourcePose.localSlotAngle,
    Math.PI,
    2e-6,
    'follower traverses the semicircular slot',
  );
  near(
    farPose.outputAngle - sourcePose.outputAngle,
    geometry.outputSwingAngle,
    1e-15,
    'straight-arm output swing',
  );
  near(
    THREE.MathUtils.radToDeg(geometry.outputSwingAngle),
    33.535824,
    2e-6,
    'straight-arm output swing in degrees',
  );
  assert.ok(geometry.outputSwingAngle < geometry.inputStrokeMagnitude / 6);

  const scheduled = new Map([
    [0, [0, 0, 'source-end-dwell']],
    [0.1, [geometry.inputStrokeAngle * 0.25, transmission.movingInputAngularSpeed, 'regular-clockwise-input-stroke']],
    [0.2, [geometry.inputStrokeAngle * 0.5, transmission.movingInputAngularSpeed, 'regular-clockwise-input-stroke']],
    [0.3, [geometry.inputStrokeAngle * 0.75, transmission.movingInputAngularSpeed, 'regular-clockwise-input-stroke']],
    [0.4, [geometry.inputStrokeAngle, 0, 'far-end-dwell']],
    [0.45, [geometry.inputStrokeAngle, 0, 'far-end-dwell']],
    [0.5, [geometry.inputStrokeAngle, 0, 'far-end-dwell']],
    [0.6, [geometry.inputStrokeAngle * 0.75, -transmission.movingInputAngularSpeed, 'regular-counter-clockwise-return-stroke']],
    [0.7, [geometry.inputStrokeAngle * 0.5, -transmission.movingInputAngularSpeed, 'regular-counter-clockwise-return-stroke']],
    [0.8, [geometry.inputStrokeAngle * 0.25, -transmission.movingInputAngularSpeed, 'regular-counter-clockwise-return-stroke']],
    [0.9, [0, 0, 'source-end-dwell']],
    [0.95, [0, 0, 'source-end-dwell']],
    [1, [0, 0, 'source-end-dwell']],
  ]);
  for (const [phase, [angle, speed, stage]] of scheduled) {
    const drive = driveAtCyclePhase(phase);
    near(drive.inputAngle, angle, 2e-15, `input angle at phase ${phase}`);
    near(drive.inputAngularSpeed, speed, 2e-15, `input speed at phase ${phase}`);
    assert.equal(drive.stage, stage);
    assert.equal(drive.dwell, speed === 0);
  }
  for (const phase of [0, 0.4, 0.5, 0.9, 1]) {
    assert.equal(driveAtCyclePhase(phase).velocityDiscontinuous, true);
  }
  for (const phase of [0.1, 0.2, 0.3, 0.45, 0.6, 0.7, 0.8, 0.95]) {
    assert.equal(driveAtCyclePhase(phase).velocityDiscontinuous, false);
  }
  near(
    driveAtCyclePhase(-0.3).inputAngle,
    driveAtCyclePhase(0.7).inputAngle,
    1e-15,
    'negative phase periodicity',
  );
  near(
    driveAtCyclePhase(17.2).inputAngle,
    driveAtCyclePhase(0.2).inputAngle,
    2e-14,
    'multi-cycle phase periodicity',
  );
  disposeModel(model.root);
});

test('movement 203 closes both circle constraints and the selected slot branch through 32,769 input poses', () => {
  const model = createMovementModel(catalog.movements[202]);
  const {
    geometry,
    geometryAtInputAngle,
    stateAtInputAngle,
    transmission,
  } = model.root.userData;
  const sampleCount = 32768;
  let previousState = null;
  let minimumGain = Infinity;
  let maximumGain = -Infinity;
  let minimumDeterminant = Infinity;
  let minimumEndpointMargin = Infinity;
  let minimumIntersectionAcross = Infinity;
  let maximumFollowerStep = 0;

  for (let index = 0; index <= sampleCount; index += 1) {
    const inputAngle = geometry.inputStrokeAngle * index / sampleCount;
    const state = stateAtInputAngle(inputAngle, -0.83, 0.17);
    finiteStateNumbers(state, `state[${index}]`);
    near(state.inputAngle, inputAngle, 0, `input angle ${index}`);
    near(
      state.followerPoint.distanceTo(state.slotCenter),
      geometry.slotRadius,
      2e-15,
      `slot-circle closure ${index}`,
    );
    near(
      state.followerPoint.distanceTo(geometry.outputPivot),
      geometry.outputArmLength,
      3e-15,
      `straight-arm closure ${index}`,
    );
    near(state.slotRadiusError, 0, 2e-15, `slot radius residual ${index}`);
    near(state.outputArmLengthError, 0, 3e-15, `arm length residual ${index}`);
    assert.equal(state.branch, 'upper-y-circle-intersection');
    assert.ok(
      state.candidateUpper.y >= state.candidateLower.y - 1e-15,
      `upper intersection remains selected at ${index}`,
    );
    vector2Near(
      state.followerPoint,
      state.candidateUpper,
      1e-15,
      `selected upper intersection ${index}`,
    );
    assert.ok(
      state.localSlotAngle >= geometry.slotStartAngle - 2e-12,
      `pin remains after slot start at ${index}`,
    );
    assert.ok(
      state.localSlotAngle <= geometry.slotEndAngle + 2e-12,
      `pin remains before slot end at ${index}`,
    );
    assert.ok(state.slotEndpointMargin > 0.032, `slot endpoint margin ${index}`);
    assert.ok(state.intersectionAcross > 0.4, `circle branch separation ${index}`);
    assert.ok(
      Math.abs(state.constraintDeterminant) > 2.2,
      `constraint Jacobian remains nonsingular at ${index}`,
    );
    assert.ok(state.outputAngularGain <= 3e-7, `signed output gain ${index}`);
    assert.ok(state.outputAngularGain >= -0.26, `bounded output gain ${index}`);
    minimumGain = Math.min(minimumGain, state.outputAngularGain);
    maximumGain = Math.max(maximumGain, state.outputAngularGain);
    minimumDeterminant = Math.min(
      minimumDeterminant,
      Math.abs(state.constraintDeterminant),
    );
    minimumEndpointMargin = Math.min(
      minimumEndpointMargin,
      state.slotEndpointMargin,
    );
    minimumIntersectionAcross = Math.min(
      minimumIntersectionAcross,
      state.intersectionAcross,
    );
    if (previousState) {
      assert.ok(
        state.outputAngle >= previousState.outputAngle - 2e-14,
        `output angle is continuous and monotone at ${index}`,
      );
      assert.ok(
        state.localSlotAngle >= previousState.localSlotAngle - 2e-14,
        `pin advances continuously along slot at ${index}`,
      );
      maximumFollowerStep = Math.max(
        maximumFollowerStep,
        state.followerPoint.distanceTo(previousState.followerPoint),
      );
    }
    previousState = state;
  }

  near(minimumGain, transmission.gainExtrema.minimum, 2e-8, 'sampled minimum geometric gain');
  near(maximumGain, transmission.gainExtrema.maximum, 2e-8, 'sampled maximum geometric gain');
  assert.ok(minimumGain < -0.258, 'output reaches a substantially different speed ratio');
  assert.ok(Math.abs(maximumGain) < 3e-7, 'output reaches dead center');
  assert.ok(minimumDeterminant > 2.2);
  assert.ok(minimumEndpointMargin > 0.032);
  assert.ok(minimumIntersectionAcross > 0.4);
  assert.ok(maximumFollowerStep < 0.0003, 'no spatial jump along the slot');

  const sourceState = geometryAtInputAngle(0);
  const farState = geometryAtInputAngle(geometry.inputStrokeAngle);
  assert.ok(Math.abs(sourceState.outputAngularGain) < 3e-7);
  assert.ok(Math.abs(farState.outputAngularGain) < 3e-7);
  near(
    farState.localSlotAngle - sourceState.localSlotAngle,
    Math.PI,
    2e-6,
    'one half-circle of pin travel',
  );
  near(
    farState.outputAngle - sourceState.outputAngle,
    transmission.outputSwingAngle,
    1e-15,
    'full output swing',
  );
  disposeModel(model.root);
});

test('movement 203 analytic follower and output derivatives match finite differences throughout the stroke', () => {
  const model = createMovementModel(catalog.movements[202]);
  const {
    geometry,
    geometryAtInputAngle,
    stateAtInputAngle,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const angleStep = 2e-5;

  for (const fraction of [0.04, 0.13, 0.27, 0.41, 0.58, 0.73, 0.88, 0.96]) {
    const angle = geometry.inputStrokeAngle * fraction;
    const state = geometryAtInputAngle(angle);
    const previous = geometryAtInputAngle(angle - angleStep);
    const next = geometryAtInputAngle(angle + angleStep);
    const numericalFirst = next.followerPoint.clone()
      .sub(previous.followerPoint)
      .multiplyScalar(1 / (2 * angleStep));
    const numericalSecond = next.followerPoint.clone()
      .add(previous.followerPoint)
      .addScaledVector(state.followerPoint, -2)
      .multiplyScalar(1 / angleStep ** 2);
    vector2Near(
      state.followerDerivative,
      numericalFirst,
      2e-9,
      `follower first derivative at ${fraction}`,
    );
    vector2Near(
      state.followerSecondDerivative,
      numericalSecond,
      8e-6,
      `follower second derivative at ${fraction}`,
    );
    near(
      (next.outputAngle - previous.outputAngle) / (2 * angleStep),
      state.outputAngularGain,
      2e-9,
      `output angular gain at ${fraction}`,
    );
    near(
      (next.localSlotAngle - previous.localSlotAngle) / (2 * angleStep),
      state.localSlotAngularGain,
      2e-9,
      `slot angular gain at ${fraction}`,
    );
  }

  const timeStep = 2e-5;
  const inputSpeed = -0.91;
  const inputAcceleration = 0.23;
  for (const fraction of [0.08, 0.23, 0.39, 0.55, 0.71, 0.86, 0.94]) {
    const angle = geometry.inputStrokeAngle * fraction;
    const state = stateAtInputAngle(angle, inputSpeed, inputAcceleration);
    const angleBefore = angle - inputSpeed * timeStep
      + 0.5 * inputAcceleration * timeStep ** 2;
    const angleAfter = angle + inputSpeed * timeStep
      + 0.5 * inputAcceleration * timeStep ** 2;
    const previous = stateAtInputAngle(angleBefore);
    const next = stateAtInputAngle(angleAfter);
    const numericalVelocity = next.followerPoint.clone()
      .sub(previous.followerPoint)
      .multiplyScalar(1 / (2 * timeStep));
    const numericalAcceleration = next.followerPoint.clone()
      .add(previous.followerPoint)
      .addScaledVector(state.followerPoint, -2)
      .multiplyScalar(1 / timeStep ** 2);
    vector2Near(
      state.followerVelocity,
      numericalVelocity,
      3e-9,
      `follower time velocity at ${fraction}`,
    );
    vector2Near(
      state.followerAcceleration,
      numericalAcceleration,
      1e-5,
      `follower time acceleration at ${fraction}`,
    );
    near(
      state.slotRadiusVector.dot(
        state.followerVelocity.clone().sub(state.slotCenterVelocity),
      ),
      0,
      2e-15,
      `slot velocity closure at ${fraction}`,
    );
    near(
      state.outputRadiusVector.dot(state.followerVelocity),
      0,
      2e-15,
      `output-arm velocity closure at ${fraction}`,
    );
    near(
      state.slotRadiusVector.dot(
        state.followerAcceleration.clone().sub(
          state.slotCenterAcceleration,
        ),
      ) + state.followerVelocity.clone().sub(
        state.slotCenterVelocity,
      ).lengthSq(),
      0,
      3e-15,
      `slot acceleration closure at ${fraction}`,
    );
    near(
      state.outputRadiusVector.dot(state.followerAcceleration)
        + state.followerVelocity.lengthSq(),
      0,
      3e-15,
      `output-arm acceleration closure at ${fraction}`,
    );
  }

  for (const phase of [0.06, 0.17, 0.31, 0.57, 0.72, 0.84]) {
    const time = phase * transmission.cyclePeriod;
    const state = stateAtTime(time);
    const previous = stateAtTime(time - timeStep);
    const next = stateAtTime(time + timeStep);
    const followerVelocity = next.followerPoint.clone()
      .sub(previous.followerPoint)
      .multiplyScalar(1 / (2 * timeStep));
    vector2Near(
      state.followerVelocity,
      followerVelocity,
      3e-9,
      `runtime follower velocity at phase ${phase}`,
    );
    near(
      (next.outputAngle - previous.outputAngle) / (2 * timeStep),
      state.outputAngularSpeed,
      3e-9,
      `runtime output speed at phase ${phase}`,
    );
    near(
      Math.abs(state.inputAngularSpeed),
      Math.abs(transmission.movingInputAngularSpeed),
      1e-15,
      `regular input speed at phase ${phase}`,
    );
  }
  disposeModel(model.root);
});

test('movement 203 runtime transforms keep the pin in the moving slot as the queue advances through 204', () => {
  const model = createMovementModel(catalog.movements[202]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const sweptBounds = new THREE.Box3();

  for (const time of [
    ...Object.values(canonicalTimes),
    transmission.cyclePeriod * 0.083,
    transmission.cyclePeriod * 0.337,
    transmission.cyclePeriod * 0.614,
    transmission.cyclePeriod * 1.783,
  ]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    near(blocks.inputArm.rotation.z, state.inputAngle, 1e-15, 'runtime input-arm angle');
    near(blocks.outputArm.rotation.z, state.outputRotation, 1e-15, 'runtime output-arm angle');
    near(
      blocks.inputShaft.userData.rotor.rotation.z,
      state.inputAngle,
      1e-15,
      'runtime input-shaft angle',
    );
    near(
      blocks.outputShaft.userData.rotor.rotation.z,
      state.outputRotation,
      1e-15,
      'runtime output-shaft angle',
    );

    const pinWorld = blocks.followerPin.getWorldPosition(new THREE.Vector3());
    vector2Near(
      new THREE.Vector2(pinWorld.x, pinWorld.y),
      state.followerPoint,
      2e-15,
      'runtime follower-pin center',
    );
    const slotCenterWorld = blocks.inputArm.localToWorld(new THREE.Vector3(
      geometry.slotCenterLocal.x,
      geometry.slotCenterLocal.y,
      0,
    ));
    vector2Near(
      new THREE.Vector2(slotCenterWorld.x, slotCenterWorld.y),
      state.slotCenter,
      2e-15,
      'runtime moving slot center',
    );
    near(
      new THREE.Vector2(pinWorld.x, pinWorld.y).distanceTo(
        new THREE.Vector2(slotCenterWorld.x, slotCenterWorld.y),
      ),
      geometry.slotRadius,
      2e-15,
      'runtime pin remains on slot pitch curve',
    );
    near(
      new THREE.Vector2(pinWorld.x, pinWorld.y).distanceTo(
        geometry.outputPivot,
      ),
      geometry.outputArmLength,
      3e-15,
      'runtime straight arm remains rigid',
    );
    assert.equal(
      model.root.userData.contacts.circularSlotFollower.branch,
      state.branch,
    );
    near(
      model.root.userData.contacts.circularSlotFollower.slotRadiusError,
      0,
      2e-15,
      'stored slot contact residual',
    );
    near(
      blocks.followerPin.userData.slidingSpeed,
      state.slotSlidingSpeed,
      1e-15,
      'runtime slot sliding speed',
    );
    for (const object of [
      blocks.curvedPlate,
      blocks.outputArmBody,
      blocks.followerPin,
      blocks.inputShaft,
      blocks.outputShaft,
      blocks.baseRail,
      blocks.inputPost,
      blocks.outputPost,
      blocks.inputBridge,
      blocks.outputBridge,
      ...blocks.bearingRings,
    ]) sweptBounds.expandByObject(object);
  }
  const sweptSize = sweptBounds.getSize(new THREE.Vector3());
  assert.ok(sweptSize.x > 6.1, `full-stroke x envelope ${sweptSize.x}`);
  assert.ok(sweptSize.y > 6.1, `full-stroke y envelope ${sweptSize.y}`);
  assert.ok(sweptSize.z > 1.2, `three-dimensional depth ${sweptSize.z}`);
  assert.ok(sweptSize.x < 10);
  assert.ok(sweptSize.y < 10);

  const sourceTime = canonicalTimes.sourcePose;
  const closureTime = sourceTime + transmission.cyclePeriod;
  model.update(sourceTime);
  const sourceState = model.root.userData.kinematics;
  model.update(closureTime);
  const closureState = model.root.userData.kinematics;
  vector2Near(
    closureState.followerPoint,
    sourceState.followerPoint,
    2e-15,
    'one-cycle follower closure',
  );
  near(
    closureState.outputRotation,
    sourceState.outputRotation,
    1e-15,
    'one-cycle output closure',
  );

  const movement204 = catalog.movements[203];
  const model204 = createMovementModel(movement204);
  const movement205 = catalog.movements[204];
  const model205 = createMovementModel(movement205);
  assert.equal(movement204.id, 204);
  assert.equal(movement204.fidelity, 'authored');
  assert.equal(model204.root.userData.fidelity, 'authored');
  assert.notEqual(model204.root.userData.archetype, model.root.userData.archetype);
  assert.notEqual(model204.root.userData.mechanism, model.root.userData.mechanism);
  assert.equal(movement205.id, 205);
  assert.equal(movement205.fidelity, 'authored');
  assert.equal(model205.root.userData.fidelity, 'authored');
  disposeModel(model205.root);
  disposeModel(model204.root);
  disposeModel(model.root);
});
