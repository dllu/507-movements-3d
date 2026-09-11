import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

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

function vectorNear(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function vector2Near(actual, expected, tolerance, message) {
  vectorNear(
    new THREE.Vector2(actual.x, actual.y),
    new THREE.Vector2(expected.x, expected.y),
    tolerance,
    message,
  );
}

function wrappedAngleDifference(left, right) {
  return Math.atan2(Math.sin(left - right), Math.cos(left - right));
}

test('movement 175 transfers continuously between tangent slider branches for two crank turns per piston cycle', () => {
  const movement = catalog.movements[174];
  const model = createMovementModel(movement);
  const {
    blocks,
    canonicalStates,
    geometry,
    modelPointToAnimationRaster,
    pistonPositionAndDerivatives,
    stateAtCrankTurnCoordinate,
    stateAtTime,
  } = model.root.userData;
  const {
    crank,
    crankArm,
    crankCenterAnchor,
    crankFixedBoss,
    crankMovingBoss,
    crankOrbitWitness,
    crankPinAnchor,
    crankPinShaft,
    crankRotationIndex,
    fixedFrame,
    fixedShaft,
    framePlate,
    guideBottomAnchor,
    guideOutline,
    guideTopAnchor,
    rearShaftCollar,
    rod,
    rodBody,
    rodCrankEye,
    rodCrankEyeAnchor,
    rodSliderEye,
    rodSliderEyeAnchor,
    shaftBoreOutline,
    slider,
    sliderBody,
    sliderIndex,
    sliderPinAnchor,
    sliderPinShaft,
  } = blocks;

  assert.equal(movement.id, 175);
  assert.equal(movement.number, '175');
  assert.equal(
    movement.title,
    'One-Revolution-Per-Piston-Stroke Branch-Transfer Crank',
  );
  assert.equal(movement.category, 'Steam engines');
  assert.equal(
    movement.description,
    '175. A means of giving one complete revolution to the crank of an engine to each stroke of the piston.',
  );
  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_175.html');
  assert.equal(
    movement.archetype,
    'tangent-branch-transfer-slider-crank-one-revolution-per-piston-stroke',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'tangent-branch-transfer-radius-five-guide-seven-rod-twelve-two-crank-turn-piston-cycle',
  );
  assert.equal(typeof modelPointToAnimationRaster, 'function');
  assert.equal(typeof pistonPositionAndDerivatives, 'function');
  assert.equal(typeof stateAtCrankTurnCoordinate, 'function');
  assert.equal(typeof stateAtTime, 'function');

  // The topology is exactly one fixed frame, one output crank, one rigid
  // connecting rod, and one translating crosshead.  Nothing else secretly
  // performs the branch change.
  for (const object of [
    crank,
    crankArm,
    crankCenterAnchor,
    crankFixedBoss,
    crankMovingBoss,
    crankOrbitWitness,
    crankPinAnchor,
    crankPinShaft,
    crankRotationIndex,
    fixedFrame,
    fixedShaft,
    framePlate,
    guideBottomAnchor,
    guideOutline,
    guideTopAnchor,
    rearShaftCollar,
    rod,
    rodBody,
    rodCrankEye,
    rodCrankEyeAnchor,
    rodSliderEye,
    rodSliderEyeAnchor,
    shaftBoreOutline,
    slider,
    sliderBody,
    sliderIndex,
    sliderPinAnchor,
    sliderPinShaft,
  ]) assert.ok(object?.isObject3D);
  assert.equal(fixedFrame.userData.fixed, true);
  assert.equal(fixedShaft.userData.fixed, true);
  assert.equal(crank.parent, model.root);
  assert.equal(rod.parent, model.root);
  assert.equal(slider.parent, model.root);
  assert.equal(crankPinShaft.parent, model.root);
  assert.equal(sliderPinShaft.parent, model.root);
  vectorNear(crank.userData.axis, Z_AXIS, 0,
    'output crank rotates about the fixed shaft axis');
  vectorNear(fixedShaft.userData.axis, Z_AXIS, 0,
    'fixed crank shaft is normal to the mechanism plane');
  vectorNear(slider.userData.translationAxis, Y_AXIS, 0,
    'crosshead has one vertical translation axis');
  assert.equal(crankOrbitWitness.userData.witnessOnly, true);

  const forbiddenStandIns = [];
  const topologyCounts = {
    crank: 0,
    rod: 0,
    slider: 0,
  };
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (role === 'single-output-crank-rotor') topologyCounts.crank += 1;
    if (role === 'single-rigid-piston-connecting-rod') {
      topologyCounts.rod += 1;
    }
    if (role === 'piston-crosshead-constrained-to-vertical-slot') {
      topologyCounts.slider += 1;
    }
    if (
      object.userData.mechanismBelt
      || object.userData.selectorBelt
      || object.userData.camProfile
      || object.userData.screwThread
      || object.userData.teeth
      || /(?:^|-)(?:belt|chain|cam|gear|rack|ratchet|screw)(?:-|$)/i
        .test(role)
    ) forbiddenStandIns.push(role || object.type);
  });
  assert.deepEqual(topologyCounts, { crank: 1, rod: 1, slider: 1 });
  assert.deepEqual(forbiddenStandIns, []);

  // The executable construction is the source's 5:7:12 geometry.  L=g+r
  // makes the two circle-line solutions tangent when the crank pin is at
  // (-r, 0), which is what makes a continuous branch transfer possible.
  near(geometry.sourceAnimationScale, 0.20, 0,
    'reference construction scale');
  near(geometry.sourceAnimationCrankRadius, 5, 0,
    'reference crank radius');
  near(geometry.sourceAnimationGuideOffset, 7, 0,
    'reference guide offset');
  near(geometry.sourceAnimationRodLength, 12, 0,
    'reference rod length');
  near(geometry.sourceAnimationGuideHalfLength, 16, 0,
    'reference guide half-length');
  near(geometry.crankRadius, 1, 0, 'scaled crank radius');
  near(geometry.guideOffset, 1.4, 3e-16, 'scaled guide offset');
  near(geometry.rodLength, 2.4, 5e-16, 'scaled rod length');
  near(geometry.guideHalfLength, 3.2, 5e-16,
    'scaled guide half-length');
  near(
    geometry.rodLength,
    geometry.guideOffset + geometry.crankRadius,
    0,
    'tangent branch-transfer equality L=g+r',
  );
  near(geometry.crankTurnsPerSecond, 0.25, 0,
    'reference crank speed');
  near(geometry.cyclePeriod, 8, 0,
    'two-turn piston-cycle period');
  assert.equal(geometry.crankRevolutionsPerPistonCycle, 2);
  assert.equal(geometry.pistonStrokesPerCycle, 2);
  near(
    geometry.crankRevolutionsPerPistonCycle
      / geometry.pistonStrokesPerCycle,
    1,
    0,
    'one crank revolution per piston stroke as a cycle ratio',
  );

  // The three openings in the frame are actual holes in its extrusion, not
  // dark decals placed over a solid plate.
  assert.equal(framePlate.userData.openingCount, 3);
  assert.equal(framePlate.geometry.parameters.shapes.holes.length, 3);
  vector2Near(guideTopAnchor.position,
    new THREE.Vector2(geometry.guideOffset, geometry.guideHalfLength),
    0, 'fixed guide top');
  vector2Near(guideBottomAnchor.position,
    new THREE.Vector2(geometry.guideOffset, -geometry.guideHalfLength),
    0, 'fixed guide bottom');

  // Exact animation view-box mapping gives independent raster locks for the
  // fixed shaft, guide endpoints, and tangent crank-pin pose.
  assert.equal(geometry.sourceAnimationCanvasWidth, 525);
  assert.equal(geometry.sourceAnimationCanvasHeight, 525);
  vectorNear(
    geometry.sourceAnimationViewMinimum,
    new THREE.Vector2(-14.998778, -19.531094),
    0,
    'reference animation view minimum',
  );
  near(geometry.sourceAnimationViewWidth, 38, 0,
    'reference animation view width');
  near(geometry.sourceAnimationViewHeight, 38, 0,
    'reference animation view height');
  vectorNear(
    modelPointToAnimationRaster(new THREE.Vector2(0, 0)),
    new THREE.Vector2(207.2199592105263, 255.1625171052632),
    1e-12,
    'fixed crank center raster lock',
  );
  vectorNear(
    modelPointToAnimationRaster(new THREE.Vector2(
      geometry.guideOffset,
      geometry.guideHalfLength,
    )),
    new THREE.Vector2(303.9304855263158, 34.10988552631579),
    1e-12,
    'guide top raster lock',
  );
  vectorNear(
    modelPointToAnimationRaster(new THREE.Vector2(
      geometry.guideOffset,
      -geometry.guideHalfLength,
    )),
    new THREE.Vector2(303.9304855263158, 476.21514868421053),
    1e-12,
    'guide bottom raster lock',
  );
  vectorNear(
    modelPointToAnimationRaster(new THREE.Vector2(
      -geometry.crankRadius,
      0,
    )),
    new THREE.Vector2(138.14101184210526, 255.1625171052632),
    1e-12,
    'tangent crank-pin raster lock',
  );
  assert.equal(geometry.sourceImageWidth, 525);
  assert.equal(geometry.sourceImageHeight, 525);
  vectorNear(
    geometry.sourceRasterCrankCenter,
    new THREE.Vector2(199, 235),
    0,
    'engraving crank-center landmark',
  );
  vectorNear(
    geometry.sourceRasterCrankPin,
    new THREE.Vector2(246, 296),
    0,
    'engraving crank-pin landmark',
  );
  vectorNear(
    geometry.sourceRasterSliderPin,
    new THREE.Vector2(354, 419),
    0,
    'engraving slider-pin landmark',
  );
  near(geometry.sourcePoseTurn, 0.35448321346870204, 1e-15,
    'engraving phase');
  vectorNear(
    canonicalStates.sourceEngraving.crankPin.clone().normalize(),
    geometry.sourcePoseCrankDirection,
    2e-15,
    'source pose crank direction',
  );

  // Both branch changes occur at the same tangent configuration, with a
  // horizontal length-12 rod.  Position, velocity, and acceleration remain
  // continuous even though the selected intersection changes identity.
  const slowTransfer = canonicalStates.slowBranchTransfer;
  const fastTransfer = canonicalStates.fastBranchTransfer;
  for (const [transfer, expectedTurn, expectedBranch] of [
    [slowTransfer, 1, 'upper'],
    [fastTransfer, 2, 'lower'],
  ]) {
    near(transfer.crankTurnCoordinate, expectedTurn, 0,
      'branch-transfer turn coordinate');
    assert.equal(transfer.branch, expectedBranch);
    assert.equal(transfer.branchTransfer, true);
    near(transfer.circleLineDiscriminant, 0, 1e-15,
      'tangent circle-line discriminant');
    near(transfer.circleLineRoot, 0, 1e-15,
      'coalesced branch separation');
    near(transfer.lowerIntersectionY, 0, 2e-15,
      'lower intersection at tangent transfer');
    near(transfer.upperIntersectionY, 0, 2e-15,
      'upper intersection at tangent transfer');
    near(transfer.pistonPosition, 0, 2e-15,
      'piston at tangent transfer');
    near(transfer.crankPin.x, -geometry.crankRadius, 0,
      'crank pin at far left');
    near(transfer.crankPin.y, 0, 3e-16,
      'crank pin on center line');
    near(transfer.rodAngle, 0, 2e-16,
      'rod horizontal at transfer');
    near(transfer.rodLengthError, 0, 0,
      'rod closes exactly at transfer');
  }
  assert.ok(slowTransfer.pistonVelocity > 0,
    'the slow transfer continues upward');
  assert.ok(fastTransfer.pistonVelocity < 0,
    'the fast transfer continues downward');
  near(slowTransfer.pistonAcceleration, 0, 2e-15,
    'slow transfer acceleration');
  near(fastTransfer.pistonAcceleration, 0, 2e-15,
    'fast transfer acceleration');
  for (const transferTurn of [1, 2]) {
    const epsilon = 1e-7;
    const before = stateAtCrankTurnCoordinate(transferTurn - epsilon);
    const at = stateAtCrankTurnCoordinate(transferTurn);
    const after = stateAtCrankTurnCoordinate(transferTurn + epsilon);
    near(
      (after.pistonPosition - before.pistonPosition) / (2 * epsilon),
      at.pistonVelocityPerTurn,
      3e-9,
      `continuous transfer velocity at turn ${transferTurn}`,
    );
    near(
      (after.pistonVelocityPerTurn - before.pistonVelocityPerTurn)
        / (2 * epsilon),
      at.pistonAccelerationPerTurnSquared,
      2e-8,
      `continuous transfer acceleration at turn ${transferTurn}`,
    );
    assert.notEqual(before.branch, after.branch);
  }

  // True piston reversals are derived from dy/du=0.  Unequal guide offset
  // means the two half-strokes take unequal fractions of the two-turn cycle;
  // their sum, not each individual duration, is exactly two turns.
  const lowerDeadCenter = canonicalStates.lowerDeadCenter;
  const upperDeadCenter = canonicalStates.upperDeadCenter;
  const nextLowerDeadCenter = canonicalStates.nextLowerDeadCenter;
  near(lowerDeadCenter.crankTurnCoordinate,
    0.3175437199199347, 2e-15,
    'lower dead-center turn');
  near(upperDeadCenter.crankTurnCoordinate,
    1.6824562800800653, 2e-15,
    'upper dead-center turn');
  near(lowerDeadCenter.pistonVelocityPerTurn, 0, 2e-14,
    'lower dead-center velocity');
  near(upperDeadCenter.pistonVelocityPerTurn, 0, 2e-14,
    'upper dead-center velocity');
  assert.ok(lowerDeadCenter.pistonAccelerationPerTurnSquared > 0);
  assert.ok(upperDeadCenter.pistonAccelerationPerTurnSquared < 0);
  near(
    upperDeadCenter.pistonPosition,
    -lowerDeadCenter.pistonPosition,
    2e-15,
    'symmetric piston limits',
  );
  near(
    geometry.pistonStroke,
    upperDeadCenter.pistonPosition - lowerDeadCenter.pistonPosition,
    0,
    'full piston stroke',
  );
  near(
    nextLowerDeadCenter.pistonPosition,
    lowerDeadCenter.pistonPosition,
    0,
    'next lower dead center',
  );
  const risingStrokeTurns = upperDeadCenter.crankTurnCoordinate
    - lowerDeadCenter.crankTurnCoordinate;
  const fallingStrokeTurns = nextLowerDeadCenter.crankTurnCoordinate
    - upperDeadCenter.crankTurnCoordinate;
  assert.ok(risingStrokeTurns > 1);
  assert.ok(fallingStrokeTurns < 1);
  near(risingStrokeTurns + fallingStrokeTurns, 2, 4e-16,
    'two turns span both piston strokes');
  near((risingStrokeTurns + fallingStrokeTurns) / 2, 1, 2e-16,
    'mean crank count is one revolution per stroke');

  const monotonicSamples = 8192;
  let previousPosition = lowerDeadCenter.pistonPosition;
  for (let index = 1; index <= monotonicSamples; index += 1) {
    const turn = THREE.MathUtils.lerp(
      lowerDeadCenter.crankTurnCoordinate,
      upperDeadCenter.crankTurnCoordinate,
      index / monotonicSamples,
    );
    const position = stateAtCrankTurnCoordinate(turn).pistonPosition;
    assert.ok(position >= previousPosition - 2e-15,
      'piston rises monotonically over its upward stroke');
    previousPosition = position;
  }
  previousPosition = upperDeadCenter.pistonPosition;
  for (let index = 1; index <= monotonicSamples; index += 1) {
    const turn = THREE.MathUtils.lerp(
      upperDeadCenter.crankTurnCoordinate,
      nextLowerDeadCenter.crankTurnCoordinate,
      index / monotonicSamples,
    );
    const position = stateAtCrankTurnCoordinate(turn).pistonPosition;
    assert.ok(position <= previousPosition + 2e-15,
      'piston falls monotonically over its downward stroke');
    previousPosition = position;
  }

  // Dense independent closure checks enforce the selected circle-line root,
  // fixed guide coordinate, rigid rod length, and two-turn periodicity.
  const denseSampleCount = 32768;
  let maximumRodLengthError = 0;
  let maximumBranchSelectionError = 0;
  let maximumPositionStep = 0;
  let maximumVelocityStep = 0;
  let previousState = stateAtCrankTurnCoordinate(0);
  const branches = new Set();
  for (let index = 0; index <= denseSampleCount; index += 1) {
    const turn = 2 * index / denseSampleCount;
    const state = stateAtCrankTurnCoordinate(turn);
    maximumRodLengthError = Math.max(
      maximumRodLengthError,
      Math.abs(state.rodLengthError),
    );
    maximumBranchSelectionError = Math.max(
      maximumBranchSelectionError,
      Math.abs(state.branchSelectionError),
    );
    maximumPositionStep = Math.max(
      maximumPositionStep,
      Math.abs(state.pistonPosition - previousState.pistonPosition),
    );
    maximumVelocityStep = Math.max(
      maximumVelocityStep,
      Math.abs(
        state.pistonVelocityPerTurn
          - previousState.pistonVelocityPerTurn,
      ),
    );
    assert.equal(state.guideError, 0);
    assert.ok(state.circleLineDiscriminant >= 0);
    assert.ok(state.pistonPosition >= -geometry.guideHalfLength - 1e-14);
    assert.ok(state.pistonPosition <= geometry.guideHalfLength + 1e-14);
    branches.add(state.branch);
    previousState = state;
  }
  assert.ok(maximumRodLengthError < 2.5e-15);
  assert.ok(maximumBranchSelectionError < 2.5e-14);
  assert.ok(maximumPositionStep < 0.0011,
    'branch transfer has no piston-position jump');
  assert.ok(maximumVelocityStep < 0.007,
    'branch transfer has no piston-velocity jump');
  assert.deepEqual(branches, new Set(['lower', 'upper']));
  const cycleStart = stateAtCrankTurnCoordinate(0);
  const cycleEnd = stateAtCrankTurnCoordinate(2);
  vectorNear(cycleEnd.crankPin, cycleStart.crankPin, 0,
    'crank pin closes after two revolutions');
  vectorNear(cycleEnd.sliderPin, cycleStart.sliderPin, 0,
    'piston closes after two revolutions');
  near(cycleEnd.rodAngle, cycleStart.rodAngle, 0,
    'rod pose closes after two revolutions');
  near(
    cycleEnd.crankUnwrappedAngle - cycleStart.crankUnwrappedAngle,
    Math.PI * 4,
    0,
    'unwrapped crank advances two complete revolutions',
  );

  // Analytical derivatives independently match finite differences away from
  // the two branch handoffs and the wrapped angle representation.
  const derivativeStep = 2e-5;
  for (const turn of [0.11, 0.44, 0.82, 1.18, 1.52, 1.87]) {
    const before = stateAtCrankTurnCoordinate(turn - derivativeStep);
    const state = stateAtCrankTurnCoordinate(turn);
    const after = stateAtCrankTurnCoordinate(turn + derivativeStep);
    near(
      (after.pistonPosition - before.pistonPosition)
        / (2 * derivativeStep),
      state.pistonVelocityPerTurn,
      3e-8,
      'analytic piston velocity per crank turn',
    );
    near(
      (after.pistonPosition + before.pistonPosition
        - 2 * state.pistonPosition) / derivativeStep ** 2,
      state.pistonAccelerationPerTurnSquared,
      3e-6,
      'analytic piston acceleration per crank turn squared',
    );
    const numericalCrankPinVelocity = after.crankPin.clone()
      .sub(before.crankPin)
      .multiplyScalar(1 / (2 * derivativeStep));
    vectorNear(
      numericalCrankPinVelocity,
      state.crankPinVelocityPerTurn,
      2e-8,
      'analytic crank-pin velocity per turn',
    );
    const numericalCrankPinAcceleration = after.crankPin.clone()
      .add(before.crankPin)
      .addScaledVector(state.crankPin, -2)
      .multiplyScalar(1 / derivativeStep ** 2);
    vectorNear(
      numericalCrankPinAcceleration,
      state.crankPinAccelerationPerTurnSquared,
      3e-5,
      'analytic crank-pin acceleration per turn squared',
    );
    near(
      wrappedAngleDifference(after.rodAngle, before.rodAngle)
        / (2 * derivativeStep),
      state.rodAngularVelocityPerTurn,
      5e-9,
      'analytic rod angular velocity per turn',
    );
    const numericalRodAngularAcceleration = (
      wrappedAngleDifference(after.rodAngle, state.rodAngle)
        - wrappedAngleDifference(state.rodAngle, before.rodAngle)
    ) / derivativeStep ** 2;
    near(
      numericalRodAngularAcceleration,
      state.rodAngularAccelerationPerTurnSquared,
      3e-6,
      'analytic rod angular acceleration per turn squared',
    );
    const direct = pistonPositionAndDerivatives(turn);
    near(direct.position, state.pistonPosition, 0,
      'standalone piston position law');
    near(direct.velocityPerTurn, state.pistonVelocityPerTurn, 0,
      'standalone piston velocity law');
  }

  // One full 8 s animation cycle returns every visible moving point to its
  // initial pose while retaining the two-turn unwrapped crank count.
  const initialTimeState = stateAtTime(0);
  const periodicTimeState = stateAtTime(geometry.cyclePeriod);
  vectorNear(periodicTimeState.crankPin, initialTimeState.crankPin, 2e-15,
    'timed crank-pin periodicity');
  vectorNear(periodicTimeState.sliderPin, initialTimeState.sliderPin, 2e-15,
    'timed piston periodicity');
  near(
    periodicTimeState.crankUnwrappedAngle
      - initialTimeState.crankUnwrappedAngle,
    Math.PI * 4,
    2e-15,
    'timed two-revolution count',
  );

  // Rendered pivots and eyes close the same analytical chain in their three
  // separate depth layers.  The fixed frame and shaft do not move with it.
  model.update(0, 0.016);
  model.root.updateMatrixWorld(true);
  const fixedFrameMatrix = fixedFrame.matrixWorld.clone();
  const fixedShaftMatrix = fixedShaft.matrixWorld.clone();
  for (const time of [0, 0.7, 1.9, 3.1, 4.8, 6.2, 8]) {
    model.update(time, 0.016);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    near(crank.rotation.z, state.crankAngle, 0,
      'rendered crank angle');
    near(rod.rotation.z, state.rodAngle, 0,
      'rendered connecting-rod angle');
    vector2Near(
      crankPinAnchor.getWorldPosition(new THREE.Vector3()),
      state.crankPin,
      4e-16,
      'rendered output crank pin',
    );
    vector2Near(
      rodCrankEyeAnchor.getWorldPosition(new THREE.Vector3()),
      state.crankPin,
      4e-16,
      'rendered rod crank eye',
    );
    vector2Near(
      rodSliderEyeAnchor.getWorldPosition(new THREE.Vector3()),
      state.sliderPin,
      1.5e-15,
      'rendered rod slider eye',
    );
    vector2Near(
      sliderPinAnchor.getWorldPosition(new THREE.Vector3()),
      state.sliderPin,
      4e-16,
      'rendered crosshead pin',
    );
    vector2Near(crankPinShaft.position, state.crankPin, 0,
      'rendered crank-pin shaft center line');
    vector2Near(sliderPinShaft.position, state.sliderPin, 0,
      'rendered slider-pin shaft center line');
    near(
      rodCrankEyeAnchor.getWorldPosition(new THREE.Vector3()).z,
      geometry.rodPlaneZ,
      0,
      'rod crank eye occupies front link plane',
    );
    near(
      crankPinAnchor.getWorldPosition(new THREE.Vector3()).z,
      geometry.crankPlaneZ,
      0,
      'crank pin occupies rear link plane',
    );
    assert.ok(fixedFrame.matrixWorld.equals(fixedFrameMatrix));
    assert.ok(fixedShaft.matrixWorld.equals(fixedShaftMatrix));
  }

  assert.ok(geometry.frameCenterZ < geometry.crankPlaneZ);
  assert.ok(geometry.crankPlaneZ < geometry.rodPlaneZ);
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 3.3);
  assert.ok(size.y > 7.3);
  assert.ok(size.z > 1.2,
    'frame, crank, crosshead, pins, and rod occupy real depth');
  assert.ok(bounds.min.z < -0.62);
  assert.ok(bounds.max.z > 0.64);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  // The next sequential model is now independently authored as Movement 176.
  const movement174 = createMovementModel(catalog.movements[173]);
  const movement176 = createMovementModel(catalog.movements[175]);
  assert.equal(movement174.root.userData.fidelity, 'authored');
  assert.equal(
    movement174.root.userData.mechanism,
    'fixed-vertical-screw-pivots-opposed-eccentric-jaws-friction-self-clamping-board',
  );
  assert.equal(catalog.movements[175].fidelity, 'authored');
  assert.equal(movement176.root.userData.fidelity, 'authored');
  assert.equal(
    movement176.root.userData.mechanism,
    'coaxial-equal-radius-driver-driven-cranks-radial-slot-wall-engaged-wrist-pin-one-to-one',
  );
  assert.notEqual(movement176.root.userData.mechanism,
    model.root.userData.mechanism);

  disposeModel(movement174.root);
  disposeModel(movement176.root);
  disposeModel(model.root);
});
