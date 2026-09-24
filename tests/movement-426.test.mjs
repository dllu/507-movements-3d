import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const ARCHETYPE =
  'two-opposed-rounded-pistons-sliding-radially-in-rotating-hub-against-two-stationary-port-abutments';
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

function sameAngle(actual, expected, tolerance, message) {
  near(Math.sin(actual), Math.sin(expected), tolerance, `${message} sine`);
  near(Math.cos(actual), Math.cos(expected), tolerance, `${message} cosine`);
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

test('movement 426 has two stationary abutments D and exactly two opposed pistons A sliding in rotating hub C', () => {
  const movement = catalog.movements[425];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 426);
  assert.equal(movement.number, '426');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /Two stationary abutments D remain fixed/);
  assert.match(data.mechanism, /exactly two opposed radial grooves/);
  assert.match(data.mechanism, /official fixed multi-arc cam envelope/);
  assert.match(data.mechanism, /both receive steam action together/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.positivePistonRadialPositionIndependent,
    false);
  assert.equal(degreesOfFreedom.negativePistonRadialPositionIndependent,
    false);
  assert.equal(blocks.hubC.parent, blocks.rotor);
  assert.equal(blocks.groove.parent, blocks.rotor);
  assert.equal(blocks.positivePiston.parent, blocks.rotor);
  assert.equal(blocks.negativePiston.parent, blocks.rotor);
  assert.equal(blocks.positivePistonBody.parent, blocks.positivePiston);
  assert.equal(blocks.negativePistonBody.parent, blocks.negativePiston);
  assert.equal(blocks.leftAbutment.parent, model.root);
  assert.equal(blocks.rightAbutment.parent, model.root);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.filter((role) => /stationary-abutment-D$/.test(role))
    .length, 2);
  assert.equal(roles.filter((role) => /radial-sliding-piston-A$/.test(role))
    .length, 2);
  for (const role of [
    'main-shaft-B-through-hub-C',
    'hub-C-fast-on-main-shaft-B',
    'rotating-hub-C-with-two-opposed-radial-grooves',
    'diametral-guide-groove-in-hub-C',
    'left-stationary-abutment-D',
    'right-stationary-abutment-D',
    'positive-rounded-cam-nose-of-piston-A',
    'negative-rounded-cam-nose-of-piston-A',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 426 records Brown’s A–D topology and the exact official two-profile cam construction', () => {
  const movement = catalog.movements[425];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate426;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_426.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /two stationary abutments, D, D/);
  assert.match(movement.description, /two pistons, A, A/);
  assert.match(movement.description, /slide radially in grooves in the hub, C/);
  assert.match(movement.description, /main shaft, B/);
  assert.match(movement.description, /steam acts on both pistons at once/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.officialCanvasControlPeriod, 4);
  assert.equal(sourceAnimation.officialCanvasCyclesPerMinute, 15);
  assert.equal(sourceAnimation.officialHubAdvancePerControlPeriod,
    1.5 * Math.PI);
  near(sourceAnimation.officialShaftRevolutionPeriod, 16 / 3, 0,
    'official-rate shaft period');
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(dynamics.bothPistonsActTogether, true);
  assert.equal(dynamics.pressureExpansionCutoffLeakageFrictionInertiaAndLoadsModeled,
    false);
  assert.match(dynamics.camFollowerAssumption,
    /massless radial follower.*fixed arc profile/);
  assert.match(dynamics.sourceCoordinateRegularization,
    /averaged.*exact 180-degree symmetry/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.mainShaftBApproximateCenterPixels, [264, 268]);
  assert.deepEqual(plate.pistonAApproximateTipPixels,
    [[243, 94], [280, 438]]);
  assert.equal(evidence.explicitInBrownDescription.length, 8);
  assert.match(evidence.officialCanvasEvidence,
    /hub radius 4.*shaft radius 1/);
  assert.match(evidence.officialCanvasEvidence,
    /nose centered at x=2\.5 with radius 0\.5/);
  assert.match(evidence.officialCanvasEvidence,
    /five circular arcs for each piston/);
  assert.match(evidence.reconstructionDisclosure,
    /direct port of the official arc-contact construction/);
  disposeModel(model.root);
});

test('movement 426 exact cam solver reproduces official source radial positions and active features', () => {
  const model = createMovementModel(catalog.movements[425]);
  const { sourceRadialRootAtInputAngle } = model.root.userData;
  const samples = [
    [0, 1.0354956435333476],
    [5, 1.5346718230435457],
    [11.25, 2.006729878402383],
    [22.5, 2.439278342815605],
    [45, 2.841598370946328],
    [67.5, 3.0962531317422535],
    [90, 3.1447604730695318],
    [112.5, 2.975719466472314],
    [135, 2.499648367349472],
    [150, 1.7181357915166169],
    [160, 1.035492148945985],
    [165, 1],
    [175, 1],
    [179, 1.0143783514544826],
  ];
  for (const [degrees, expected] of samples) {
    const source = sourceRadialRootAtInputAngle(
      THREE.MathUtils.degToRad(degrees),
    );
    near(source.sourceRoot, expected, 2e-15,
      `source radial root at ${degrees} degrees`);
    assert.match(source.activePositiveConstraint,
      /(?:arc|tangency)/);
    assert.match(source.activeNegativeConstraint,
      /(?:arc|tangency)/);
  }
  assert.match(sourceRadialRootAtInputAngle(
    THREE.MathUtils.degToRad(45),
  ).activePositiveConstraint, /internal-arc-tangency/);
  assert.match(sourceRadialRootAtInputAngle(
    THREE.MathUtils.degToRad(5),
  ).activePositiveConstraint, /follower-start-on-fixed-arc/);
  disposeModel(model.root);
});

test('movement 426 piston roots remain exactly opposite with one shared radial cam coordinate', () => {
  const model = createMovementModel(catalog.movements[425]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let minimumRadialPosition = Infinity;
  let maximumRadialPosition = -Infinity;
  let maximumSymmetryRoundingDifference = 0;

  for (let sample = -50000; sample <= 100000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 50000);
    vectorNear(state.negativePistonRoot,
      state.positivePistonRoot.clone().multiplyScalar(-1), 0,
      'opposed piston roots');
    vectorNear(state.negativeNoseCenter,
      state.positiveNoseCenter.clone().multiplyScalar(-1), 0,
      'opposed rounded-nose centers');
    vectorNear(state.negativeOuterTip,
      state.positiveOuterTip.clone().multiplyScalar(-1), 0,
      'opposed outer tips');
    near(state.positivePistonRoot.length(), state.radialPosition, 4.5e-16,
      'positive root radial guide');
    near(state.negativePistonRoot.length(), state.radialPosition, 4.5e-16,
      'negative root radial guide');
    near(state.positiveNoseCenter.length(), state.noseCenterRadius, 8.9e-16,
      'positive nose-center radius');
    near(state.positiveOuterTip.length(), state.noseOuterRadius, 8.9e-16,
      'positive outer-tip radius');
    assert.equal(state.bothPistonsPressurized, true);
    minimumRadialPosition = Math.min(minimumRadialPosition,
      state.radialPosition);
    maximumRadialPosition = Math.max(maximumRadialPosition,
      state.radialPosition);
    maximumSymmetryRoundingDifference = Math.max(
      maximumSymmetryRoundingDifference,
      Math.abs(state.sourceSymmetryRoundingDifference),
    );
  }
  near(minimumRadialPosition, geometry.sourceScale, 3e-9,
    'flush retracted root');
  assert.ok(maximumRadialPosition > 1.5137);
  assert.ok(maximumRadialPosition < 1.5138);
  assert.ok(maximumSymmetryRoundingDifference < 1.1e-6);
  near(geometry.sourceMinimumRoot, 1, 0,
    'clamped intended source minimum');
  disposeModel(model.root);
});

test('movement 426 radial cam motion is continuous through all fixed-profile feature changes and the half-turn seam', () => {
  const model = createMovementModel(catalog.movements[425]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const sampleCount = 60000;
  let previous = stateAtInputAngle(-HALF_STEP()).radialPosition;
  let maximumStep = 0;

  function HALF_STEP() {
    return Math.PI / sampleCount;
  }

  for (let sample = 0; sample <= sampleCount; sample += 1) {
    const angle = Math.PI * sample / sampleCount;
    const current = stateAtInputAngle(angle).radialPosition;
    maximumStep = Math.max(maximumStep, Math.abs(current - previous));
    previous = current;
  }
  assert.ok(maximumStep / HALF_STEP() < 4);
  near(stateAtInputAngle(0).radialPosition,
    stateAtInputAngle(Math.PI).radialPosition, 0,
    'half-turn radial-law closure');
  near(stateAtInputAngle(Math.PI).radialPosition,
    stateAtInputAngle(FULL_TURN).radialPosition, 0,
    'full-turn radial-law closure');
  assert.ok(geometry.sourceMaximumRoot > 3.1535);
  assert.ok(geometry.sourceMaximumRoot < 3.1537);
  disposeModel(model.root);
});

test('movement 426 differentiated radial-guide kinematics remain opposed and tangent to the rotating guide', () => {
  const model = createMovementModel(catalog.movements[425]);
  const { stateAtInputAngle } = model.root.userData;

  for (const angle of [0.19, 0.37, 0.68, 0.94, 1.21, 1.48, 1.73,
    2.02, 2.28, 2.51, 2.73, 2.94]) {
    const speed = 1.31 + 0.17 * Math.cos(angle * 0.79);
    const acceleration = -0.24 * Math.sin(angle * 0.67);
    const state = stateAtInputAngle(angle, speed, acceleration);
    vectorNear(state.negativePistonRootVelocity,
      state.positivePistonRootVelocity.clone().multiplyScalar(-1), 0,
      'opposed root velocities');
    vectorNear(state.negativePistonRootAcceleration,
      state.positivePistonRootAcceleration.clone().multiplyScalar(-1), 0,
      'opposed root accelerations');
    near(state.positivePistonRootVelocity.dot(state.unitRadial),
      state.relativeRadialSpeed, 8.9e-16,
      'radial slide-speed component');
    near(state.positivePistonRootVelocity.dot(state.unitTangent),
      state.radialPosition * speed, 8.9e-16,
      'hub-rotation speed component');
    near(state.relativeRadialAcceleration,
      state.radialPositionSecond * speed ** 2
        + state.radialPositionPrime * acceleration,
      0, 'radial slide acceleration chain rule');
  }
  disposeModel(model.root);
});

test('movement 426 numerical derivatives of the exact cam law match piston-root finite differences away from profile corners', () => {
  const model = createMovementModel(catalog.movements[425]);
  const { stateAtInputAngle } = model.root.userData;
  const angleStep = 1e-5;

  for (const angle of [0.30, 0.60, 0.90, 1.20, 1.50, 1.80, 2.10,
    2.40, 2.70, 3.00]) {
    const state = stateAtInputAngle(angle);
    const timeStep = angleStep / state.inputSpeed;
    const before = stateAtInputAngle(angle - angleStep);
    const after = stateAtInputAngle(angle + angleStep);
    const numericalVelocity = after.positivePistonRoot.clone()
      .sub(before.positivePistonRoot)
      .multiplyScalar(1 / (2 * timeStep));
    const numericalAcceleration = after.positivePistonRootVelocity.clone()
      .sub(before.positivePistonRootVelocity)
      .multiplyScalar(1 / (2 * timeStep));
    vectorNear(numericalVelocity, state.positivePistonRootVelocity, 1e-8,
      `positive-piston velocity at ${angle}`);
    vectorNear(numericalAcceleration,
      state.positivePistonRootAcceleration, 1e-5,
      `positive-piston acceleration at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 426 source rate maps four control seconds to 1.5 pi hub advance and one shaft turn to 16/3 seconds', () => {
  const model = createMovementModel(catalog.movements[425]);
  const { geometry, stateAtTime } = model.root.userData;
  const sourceControlEnd = stateAtTime(4);
  const fullTurn = stateAtTime(geometry.cycleDuration);

  const start = stateAtTime(0);
  near(start.inputAngle, geometry.sourceRotorAngle, 0,
    'cycle starts at Brown’s upright piston pose');
  near(sourceControlEnd.inputAngle - start.inputAngle, 1.5 * Math.PI, 9e-16,
    'four-second source hub advance');
  near(sourceControlEnd.sourceCamControlPhase - start.sourceCamControlPhase,
    1, 5e-16, 'source control phase');
  near(geometry.cycleDuration, 16 / 3, 0,
    'one-shaft-turn cycle duration');
  near(fullTurn.inputAngle, geometry.sourceRotorAngle, 0,
    'stateAtTime full-turn modulo closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.cycleDuration);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 426 update rotates hub C, slides both A pistons oppositely, and leaves both D abutments fixed', () => {
  const model = createMovementModel(catalog.movements[425]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const leftInitial = blocks.leftAbutment.position.clone();
  const rightInitial = blocks.rightAbutment.position.clone();

  for (const time of [0, 0.34, 0.82, 1.37, 1.94, 2.51, 3.08, 3.67,
    4.24, 4.83, 5.21, 5.77]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.rotor.rotation.z, state.rotorAngle, 1.2e-16,
      'hub rotation update');
    near(blocks.positivePiston.position.x, state.radialPosition, 0,
      'positive piston radial update');
    near(blocks.negativePiston.position.x, -state.radialPosition, 0,
      'negative piston radial update');
    vectorNear(blocks.positivePowerIndicator.position,
      new THREE.Vector3(
        state.positiveOuterTip.x,
        state.positiveOuterTip.y,
        0.78,
      ), 0, 'positive simultaneous-action marker');
    vectorNear(blocks.negativePowerIndicator.position,
      new THREE.Vector3(
        state.negativeOuterTip.x,
        state.negativeOuterTip.y,
        0.78,
      ), 0, 'negative simultaneous-action marker');
    vectorNear(blocks.leftAbutment.position, leftInitial, 0,
      'left D stays stationary');
    vectorNear(blocks.rightAbutment.position, rightInitial, 0,
      'right D stays stationary');
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  vectorNear(closure.positivePistonRoot, source.positivePistonRoot, 0,
    'positive A full-turn closure');
  vectorNear(closure.negativePistonRoot, source.negativePistonRoot, 0,
    'negative A full-turn closure');
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 426 fixed-abutment geometry', () => {
  const movement426 = catalog.movements[425];
  const movement507 = catalog.movements[506];
  const model426 = createMovementModel(movement426);
  const model507 = createMovementModel(movement507);

  assert.equal(movement426.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model426.root);
  disposeModel(model507.root);
});
