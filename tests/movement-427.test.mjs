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
  'eccentric-shaft-hub-with-two-orbiting-rolling-packings-guiding-cylinder-radial-sliding-pistons';
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

test('movement 427 has eccentric shaft B, concentric hub C, two rolling packings a, and exactly two cylinder-radial pistons A', () => {
  const movement = catalog.movements[426];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 427);
  assert.equal(movement.number, '427');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /shaft B runs in fixed bearings one unit eccentric/);
  assert.match(data.mechanism, /Two rolling packings a occupy diametrically opposed/);
  assert.match(data.mechanism, /piston A passes through one packing/);
  assert.match(data.mechanism, /continually turn onto the ray from the fixed cylinder center/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.leftPistonAngleAndSlideIndependent, false);
  assert.equal(degreesOfFreedom.rightPistonAngleAndSlideIndependent, false);
  assert.equal(blocks.hubC.parent, blocks.hubRotor);
  assert.equal(blocks.hubRotationMarker.parent, blocks.hubRotor);
  assert.equal(blocks.shaftB.parent, model.root);
  assert.equal(blocks.rightPiston.parent, model.root);
  assert.equal(blocks.leftPiston.parent, model.root);
  assert.equal(blocks.rightPacking.parent, model.root);
  assert.equal(blocks.leftPacking.parent, model.root);
  assert.equal(blocks.guideRingInner.parent, model.root);
  assert.equal(blocks.guideRingOuter.parent, model.root);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.filter((role) =>
    /piston-A-always-radial-to-cylinder$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /rolling-packing-a-in-hub-C$/.test(role)).length, 2);
  for (const role of [
    'main-shaft-B-in-fixed-eccentric-bearings',
    'hub-C-concentric-with-eccentric-shaft-B',
    'rotating-circular-hub-C',
    'inner-fixed-head-ring-keeping-pistons-radial',
    'outer-fixed-head-ring-keeping-pistons-radial',
    'right-orbit-piston-slot-through-packing-a',
    'left-orbit-piston-slot-through-packing-a',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 427 records Brown’s A–C topology and the exact official eccentric construction', () => {
  const movement = catalog.movements[426];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate427;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_427.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /shaft, B, works in fixed bearings eccentric/);
  assert.match(movement.description, /pistons, A, A/);
  assert.match(movement.description, /hub, C, which is concentric with the shaft/);
  assert.match(movement.description, /always radial to the cylinder/);
  assert.match(movement.description, /rolling packings, a, a/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.officialCanvasCyclePeriod, 4);
  assert.equal(sourceAnimation.officialCanvasCyclesPerMinute, 15);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(dynamics.pressureExpansionCutoffLeakageFrictionPackingForcesInertiaAndLoadsModeled,
    false);
  assert.match(dynamics.rollingPackingModel,
    /packing center is fixed in hub C.*slotted body turns/);
  assert.match(dynamics.guideRingConstraint,
    /fixed head rings.*orientation constraints/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.mainShaftBApproximateCenterPixels, [274, 246]);
  assert.deepEqual(plate.packingAApproximateCentersPixels,
    [[191, 187], [338, 343]]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.officialCanvasEvidence,
    /cylinder center at \(0,0\), shaft and hub center at \(0,1\)/);
  assert.match(evidence.officialCanvasEvidence,
    /C radius 5.*packing pivots at local \(\+\/-4,0\)/);
  assert.match(evidence.officialCanvasEvidence,
    /guide-ring radii 2\.25 and 2\.75/);
  assert.match(evidence.officialCanvasEvidence,
    /2\.234313\+1\.765687\+2=6/);
  assert.match(evidence.reconstructionDisclosure,
    /complete planar constraint and timing come from the official model/);
  disposeModel(model.root);
});

test('movement 427 exact source pose matches the official packing pivots and constant-radius piston roots', () => {
  const model = createMovementModel(catalog.movements[426]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  vectorNear(sourcePose.rightPackingCenter,
    new THREE.Vector3(2, 0.5, 0), 0, 'right packing source pose');
  vectorNear(sourcePose.leftPackingCenter,
    new THREE.Vector3(-2, 0.5, 0), 0, 'left packing source pose');
  vectorNear(sourcePose.rightPistonRoot,
    new THREE.Vector3(1.0838009999636085, 0.2709502499909021, 0),
    2e-16, 'right piston source root');
  vectorNear(sourcePose.leftPistonRoot,
    new THREE.Vector3(-1.0838009999636085, 0.2709502499909021, 0),
    2e-16, 'left piston source root');
  sameAngle(sourcePose.rightPistonAngle, Math.atan2(1, 4), 2e-16,
    'right piston source angle');
  sameAngle(sourcePose.leftPistonAngle, Math.atan2(1, -4), 2e-16,
    'left piston source angle');
  near(sourcePose.rotorAngle, 0, 0, 'source rotor angle');
  near(source.rightPiston.pistonRoot.length(), geometry.pistonRootRadius,
    2.3e-16, 'right root guide radius');
  near(geometry.pistonRootRadius, 1.1171565, 0,
    'scaled exact source root radius');
  // Playback opens on Brown's plate pose: the pistons on the upper-left /
  // lower-right diagonal, the lower-right one about 38 degrees down.
  const display = model.root.userData.stateAtTime(0);
  near(display.inputAngle, geometry.plateDisplayInputAngle, 1e-15, 'plate display input');
  assert.ok(display.rightPiston.pistonAngle < -0.55 && display.rightPiston.pistonAngle > -0.75);
  assert.ok(display.leftPiston.pistonAngle > 1.9 && display.leftPiston.pistonAngle < 2.4);
  disposeModel(model.root);
});

test('movement 427 packings remain opposed on a radius-4 source orbit about eccentric shaft B', () => {
  const model = createMovementModel(catalog.movements[426]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = -20000; sample <= 40000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    near(state.rightPiston.packingOrbitResidual, 0, 6.7e-16,
      'right packing orbit');
    near(state.leftPiston.packingOrbitResidual, 0, 6.7e-16,
      'left packing orbit');
    vectorNear(state.packingAntipodalAboutShaftResidual,
      new THREE.Vector3(), 8.9e-16, 'opposed packing centers about B');
    vectorNear(state.rightPiston.packingCenter.clone()
      .sub(geometry.shaftCenter),
    state.leftPiston.packingCenter.clone()
      .sub(geometry.shaftCenter).multiplyScalar(-1),
    8.9e-16, 'packing diametric opposition');
  }
  near(geometry.shaftCenter.distanceTo(geometry.cylinderCenter),
    geometry.shaftEccentricity, 0, 'shaft eccentricity');
  near(geometry.hubRadius + geometry.shaftEccentricity,
    geometry.cylinderRadius, 0, 'hub internal tangency');
  disposeModel(model.root);
});

test('movement 427 both piston axes stay cylinder-radial and their outer seals remain exactly on the fixed wall', () => {
  const model = createMovementModel(catalog.movements[426]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = 0; sample <= 50000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 50000);
    for (const piston of [state.rightPiston, state.leftPiston]) {
      near(piston.cylinderRadialAlignmentResidual, 0, 2.3e-16,
        'piston radial alignment');
      near(piston.outerSealRadiusResidual, 0, 1.4e-15,
        'outer seal on cylinder');
      near(piston.pistonRoot.length(), geometry.pistonRootRadius, 4.5e-16,
        'constant-radius piston root');
      vectorNear(piston.pistonOuterTip,
        piston.pistonRadial.clone().multiplyScalar(geometry.cylinderRadius),
        0, 'outer seal radial construction');
      vectorNear(piston.packingCenter,
        piston.pistonRoot.clone().addScaledVector(
          piston.pistonRadial,
          piston.slideThroughPacking,
        ), 8.9e-16, 'piston slides through packing on one radial line');
    }
  }
  disposeModel(model.root);
});

test('movement 427 rolling-packing slide follows the eccentric distance law and reaches both exact extrema', () => {
  const model = createMovementModel(catalog.movements[426]);
  const { geometry, motion, stateAtInputAngle } = model.root.userData;
  let minimum = Infinity;
  let maximum = -Infinity;

  for (let sample = 0; sample <= 50000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 50000);
    for (const piston of [state.rightPiston, state.leftPiston]) {
      near(piston.slideThroughPacking,
        piston.packingCylinderRadius - geometry.pistonRootRadius,
        0, 'eccentric distance slide law');
      minimum = Math.min(minimum, piston.slideThroughPacking);
      maximum = Math.max(maximum, piston.slideThroughPacking);
    }
  }
  near(minimum, 0.3828435, 2e-8, 'minimum slide');
  near(maximum, 1.3828435, 2e-8, 'maximum slide');
  near(motion.slideMinimum, minimum, 2e-8, 'recorded minimum slide');
  near(motion.slideMaximum, maximum, 2e-8, 'recorded maximum slide');
  disposeModel(model.root);
});

test('movement 427 pistons are generally not antipodal because each follows a ray from the offset cylinder center', () => {
  const model = createMovementModel(catalog.movements[426]);
  const { stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);
  const quarter = stateAtInputAngle(Math.PI / 2);

  assert.ok(Math.abs(
    Math.abs(source.leftPiston.pistonAngle - source.rightPiston.pistonAngle)
      - Math.PI,
  ) > 0.45);
  near(Math.abs(quarter.leftPiston.pistonAngle
    - quarter.rightPiston.pistonAngle), Math.PI, 4.5e-16,
  'vertical alignment is the isolated antipodal pose');
  assert.notEqual(source.rightPiston.packingRelativeAngleToHub,
    source.leftPiston.packingRelativeAngleToHub);
  disposeModel(model.root);
});

test('movement 427 analytic velocities and accelerations match finite differences of the constrained piston motion', () => {
  const model = createMovementModel(catalog.movements[426]);
  const { stateAtInputAngle } = model.root.userData;
  const angleStep = 1e-5;

  for (const angle of [0.17, 0.46, 0.79, 1.13, 1.47, 1.91,
    2.28, 2.67, 3.12, 3.58, 4.09, 4.63, 5.17, 5.72, 6.08]) {
    const state = stateAtInputAngle(angle);
    const timeStep = angleStep / state.inputSpeed;
    const before = stateAtInputAngle(angle - angleStep);
    const after = stateAtInputAngle(angle + angleStep);
    for (const key of ['rightPiston', 'leftPiston']) {
      const piston = state[key];
      const numericalPackingVelocity = after[key].packingCenter.clone()
        .sub(before[key].packingCenter).multiplyScalar(1 / (2 * timeStep));
      const numericalRootVelocity = after[key].pistonRoot.clone()
        .sub(before[key].pistonRoot).multiplyScalar(1 / (2 * timeStep));
      const numericalRootAcceleration = after[key].pistonRootVelocity.clone()
        .sub(before[key].pistonRootVelocity)
        .multiplyScalar(1 / (2 * timeStep));
      const numericalSlideSpeed = (after[key].slideThroughPacking
        - before[key].slideThroughPacking) / (2 * timeStep);
      vectorNear(numericalPackingVelocity, piston.packingCenterVelocity,
        6e-10, `${key} packing velocity at ${angle}`);
      vectorNear(numericalRootVelocity, piston.pistonRootVelocity,
        3e-10, `${key} root velocity at ${angle}`);
      vectorNear(numericalRootAcceleration, piston.pistonRootAcceleration,
        2e-9, `${key} root acceleration at ${angle}`);
      near(numericalSlideSpeed, piston.slideThroughPackingSpeed, 3e-10,
        `${key} slide speed at ${angle}`);
    }
  }
  disposeModel(model.root);
});

test('movement 427 update rotates hub C clockwise while separately aligning every piston and packing to the fixed cylinder', () => {
  const model = createMovementModel(catalog.movements[426]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const shaftPosition = blocks.shaftB.position.clone();
  const innerRingPosition = blocks.guideRingInner.position.clone();
  const outerRingPosition = blocks.guideRingOuter.position.clone();

  for (const time of [0, 0.21, 0.58, 0.97, 1.34, 1.83, 2.27,
    2.71, 3.16, 3.62, 3.91]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.hubRotor.rotation.z, state.rotorAngle, 1.2e-16,
      'hub C clockwise update');
    for (const [prefix, piston] of [
      ['right', state.rightPiston],
      ['left', state.leftPiston],
    ]) {
      vectorNear(blocks[`${prefix}Piston`].position, piston.pistonRoot, 0,
        `${prefix} piston position update`);
      vectorNear(blocks[`${prefix}Packing`].position,
        piston.packingCenter, 0, `${prefix} packing position update`);
      sameAngle(blocks[`${prefix}Piston`].rotation.z, piston.pistonAngle,
        1.2e-16, `${prefix} piston radial update`);
      sameAngle(blocks[`${prefix}Packing`].rotation.z, piston.pistonAngle,
        1.2e-16, `${prefix} packing-slot radial update`);
    }
    vectorNear(blocks.shaftB.position, shaftPosition, 0,
      'shaft bearing remains fixed');
    vectorNear(blocks.guideRingInner.position, innerRingPosition, 0,
      'inner guide ring remains fixed');
    vectorNear(blocks.guideRingOuter.position, outerRingPosition, 0,
      'outer guide ring remains fixed');
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  vectorNear(closure.rightPiston.packingCenter,
    source.rightPiston.packingCenter, 0, 'right packing cycle closure');
  vectorNear(closure.leftPiston.pistonRoot,
    source.leftPiston.pistonRoot, 0, 'left piston cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 4);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 427 eccentric-packing geometry', () => {
  const movement427 = catalog.movements[426];
  const movement507 = catalog.movements[506];
  const model427 = createMovementModel(movement427);
  const model507 = createMovementModel(movement507);

  assert.equal(movement427.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model427.root);
  disposeModel(model507.root);
});
