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
  'screw-adjusted-variable-depth-elastic-arched-bar-cyclograph-confined-by-two-fixed-end-rollers-and-circular-at-maximum-bend';

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function polylineLength(points) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += points[index].distanceTo(points[index - 1]);
  }
  return length;
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

test('movement 404 is one tapered elastic cyclograph bar, two fixed rollers, and one screw', () => {
  const movement = catalog.movements[403];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 404);
  assert.equal(movement.number, '404');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /one tapered elastic arched template/);
  assert.match(data.mechanism, /two small rollers fixed/);
  assert.match(data.mechanism, /one central screw/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.deepEqual(degreesOfFreedom.inputs, ['central screw rotation']);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(blocks.elasticBar.parent, model.root);
  assert.equal(blocks.rollerAssemblies.length, 2);
  assert.equal(blocks.rollerAssemblies[0].roller.parent, model.root);
  assert.equal(blocks.rollerAssemblies[1].roller.parent, model.root);
  assert.equal(blocks.screw.parent, model.root);
  assert.equal(blocks.handwheel.handwheel.parent,
    blocks.screw.userData.rotor);
  assert.equal(blocks.thrustPad.parent, model.root);

  const roles = [];
  const belts = [];
  const toothedObjects = [];
  const elasticBars = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.teeth) toothedObjects.push(object);
    if (object.userData.role?.startsWith('single-continuous-elastic')) {
      elasticBars.push(object);
    }
  });
  assert.deepEqual(belts, []);
  assert.deepEqual(toothedObjects, []);
  assert.equal(elasticBars.length, 1);
  for (const role of [
    'single-continuous-elastic-arched-bar-tapered-to-half-depth-at-ends',
    'left-small-confining-roller',
    'right-small-confining-roller',
    'single-right-hand-central-adjusting-screw',
    'fixed-threaded-nut-in-straight-bar',
    'nonrotating-swivel-thrust-pad-at-inner-arched-bar-midpoint',
    'three-lobed-handwheel-rigid-on-adjusting-screw',
    'working-outer-edge-that-is-circular-at-maximum-bend',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 404 records Brown’s plate, written construction, and unavailable-animation boundary', () => {
  const movement = catalog.movements[403];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate404;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_404.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /half the depth at the ends/);
  assert.match(movement.description, /true circular arc/);
  assert.match(movement.description, /bent to them by means of the screw/);
  assert.match(movement.description, /small roller/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.leftRollerCenterApproximatePixels, [82, 220]);
  assert.deepEqual(plate.rightRollerCenterApproximatePixels, [452, 230]);
  assert.deepEqual(plate.outerApexApproximatePixels, [267, 173]);
  assert.deepEqual(plate.innerApexApproximatePixels, [268, 204]);
  assert.equal(plate.screwAxisXApproximatePixels, 269);
  assert.deepEqual(plate.straightBarApproximateBoundsPixels,
    [18, 290, 514, 342]);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence, /central vertical screw/);
  assert.match(evidence.reconstructionDisclosure,
    /intermediate deformation.*independently synthesized/);
  disposeModel(model.root);
});

test('movement 404 has exactly half-depth ends and an exact circular outer edge only at greatest bend', () => {
  const model = createMovementModel(catalog.movements[403]);
  const data = model.root.userData;
  const { geometry, sourcePose } = data;
  const maximumPath = data.pathAtBend(1);
  const minimumPath = data.pathAtBend(0);
  const firstCentralIndex = geometry.overhangSampleCount - 1;
  const middleIndex = firstCentralIndex
    + (geometry.centralSampleCount - 1) / 2;
  const lastCentralIndex = firstCentralIndex
    + geometry.centralSampleCount - 1;

  near(geometry.endBarDepth * 2, geometry.middleBarDepth, 0,
    'Brown two-to-one bar depth');
  near(data.depthAtNormalizedSpan(-1), geometry.endBarDepth, 0,
    'left end depth');
  near(data.depthAtNormalizedSpan(0), geometry.middleBarDepth, 0,
    'middle depth');
  near(data.depthAtNormalizedSpan(1), geometry.endBarDepth, 0,
    'right end depth');
  near(maximumPath.outerPoints[firstCentralIndex].distanceTo(
    maximumPath.innerPoints[firstCentralIndex]), geometry.endBarDepth,
  2e-15, 'left modeled depth');
  near(maximumPath.outerPoints[middleIndex].distanceTo(
    maximumPath.innerPoints[middleIndex]), geometry.middleBarDepth,
  2e-15, 'middle modeled depth');
  near(maximumPath.outerPoints[lastCentralIndex].distanceTo(
    maximumPath.innerPoints[lastCentralIndex]), geometry.endBarDepth,
  2e-15, 'right modeled depth');

  let maximumCircleResidual = 0;
  let minimumAgainstMaximumCircleResidual = 0;
  for (let index = firstCentralIndex;
    index <= lastCentralIndex; index += 1) {
    const maximumPoint = maximumPath.outerPoints[index];
    const minimumPoint = minimumPath.outerPoints[index];
    maximumCircleResidual = Math.max(
      maximumCircleResidual,
      Math.abs(maximumPoint.distanceTo(geometry.maximumCircleCenter)
        - geometry.maximumCircleRadius),
    );
    minimumAgainstMaximumCircleResidual = Math.max(
      minimumAgainstMaximumCircleResidual,
      Math.abs(minimumPoint.distanceTo(geometry.maximumCircleCenter)
        - geometry.maximumCircleRadius),
    );
  }
  assert.ok(maximumCircleResidual < 9e-16);
  assert.ok(minimumAgainstMaximumCircleResidual > 0.66);
  near(maximumPath.outerPoints[firstCentralIndex].y,
    geometry.supportY, 5e-16, 'left prescribed point');
  near(maximumPath.outerPoints[middleIndex].y,
    geometry.supportY + geometry.maximumSagitta, 5e-16,
    'central prescribed point');
  near(maximumPath.outerPoints[lastCentralIndex].y,
    geometry.supportY, 5e-16, 'right prescribed point');
  assert.equal(sourcePose.setting,
    'greatest bend with true circular outer edge');
  near(sourcePose.bend, 1, 0, 'source pose greatest bend');
  disposeModel(model.root);
});

test('movement 404 conserves one continuous outer-edge material length as both ends feed', () => {
  const model = createMovementModel(catalog.movements[403]);
  const data = model.root.userData;
  const { geometry } = data;
  let maximumLengthResidual = 0;
  let minimumOverhang = Infinity;
  let maximumOverhang = -Infinity;
  let previousCentralLength = -Infinity;
  let previousOverhang = Infinity;

  for (let sample = 0; sample <= 1000; sample += 1) {
    const bend = sample / 1000;
    const path = data.pathAtBend(bend);
    const length = polylineLength(path.outerPoints);
    maximumLengthResidual = Math.max(
      maximumLengthResidual,
      Math.abs(length - geometry.totalOuterEdgeLength),
    );
    minimumOverhang = Math.min(minimumOverhang, path.overhangLength);
    maximumOverhang = Math.max(maximumOverhang, path.overhangLength);
    assert.ok(path.centralArcLength >= previousCentralLength - 2e-15);
    assert.ok(path.overhangLength <= previousOverhang + 2e-15);
    previousCentralLength = path.centralArcLength;
    previousOverhang = path.overhangLength;
  }
  assert.ok(maximumLengthResidual < 8e-15);
  near(minimumOverhang, geometry.terminalOverhangAtMaximum, 2e-16,
    'terminal overhang at maximum bend');
  assert.ok(maximumOverhang - minimumOverhang > 0.31);
  near(geometry.maximumCentralArcLength + 2 * minimumOverhang,
    geometry.totalOuterEdgeLength, 2e-15, 'maximum-bend length closure');
  near(geometry.minimumCentralArcLength + 2 * maximumOverhang,
    geometry.totalOuterEdgeLength, 2e-15, 'minimum-bend length closure');
  disposeModel(model.root);
});

test('movement 404 closes screw lead, pad contact, and opposite no-slip roller motion throughout the cycle', () => {
  const model = createMovementModel(catalog.movements[403]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  let maximumLeadResidual = 0;
  let maximumPadResidual = 0;
  let maximumLeftResidual = 0;
  let maximumRightResidual = 0;
  let minimumDisplacement = Infinity;
  let maximumDisplacement = -Infinity;

  for (let sample = -10000; sample <= 20000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 10000);
    maximumLeadResidual = Math.max(maximumLeadResidual,
      Math.abs(state.screwLeadResidual));
    maximumPadResidual = Math.max(maximumPadResidual,
      Math.abs(state.screwPadContactResidual));
    maximumLeftResidual = Math.max(maximumLeftResidual,
      Math.abs(state.leftRollerNoSlipResidual));
    maximumRightResidual = Math.max(maximumRightResidual,
      Math.abs(state.rightRollerNoSlipResidual));
    minimumDisplacement = Math.min(minimumDisplacement,
      state.screwDisplacement);
    maximumDisplacement = Math.max(maximumDisplacement,
      state.screwDisplacement);
    near(state.leftRollerAngle, -state.rightRollerAngle, 0,
      'opposite roller angles');
    near(state.leftRollerAngularSpeed,
      -state.rightRollerAngularSpeed, 0, 'opposite roller speeds');
    near(state.centralArcLength + 2 * state.overhangLength,
      geometry.totalOuterEdgeLength, 2e-15, 'state length closure');
  }
  assert.ok(maximumLeadResidual < 1.2e-16);
  assert.ok(maximumPadResidual < 4.5e-16);
  assert.ok(maximumLeftResidual < 2.8e-17);
  assert.ok(maximumRightResidual < 2.8e-17);
  near(minimumDisplacement, 0, 0, 'minimum screw displacement');
  near(maximumDisplacement, geometry.screwStroke, 0,
    'maximum screw displacement');
  near(stateAtTime(0).screwAngle / (Math.PI * 2),
    geometry.screwStroke / geometry.threadLead, 5e-16,
    'maximum adjustment turns');
  disposeModel(model.root);
});

test('movement 404 analytic bend, screw, and roller rates match finite differences and reverse smoothly', () => {
  const model = createMovementModel(catalog.movements[403]);
  const { geometry, stateAtTime } = model.root.userData;
  const epsilon = 1e-5;

  for (const time of [0.31, 0.7, 1.5, 2.4, 3.8, 5.1, 5.71]) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near(state.bendRate, (after.bend - before.bend) / (2 * epsilon),
      6e-11, 'bend rate');
    near(state.screwAngularSpeed,
      (after.screwAngle - before.screwAngle) / (2 * epsilon),
      7e-10, 'screw angular speed');
    near(state.leftRollerAngularSpeed,
      (after.leftRollerAngle - before.leftRollerAngle) / (2 * epsilon),
      6e-10, 'left roller angular speed');
    near(state.rightRollerAngularSpeed,
      (after.rightRollerAngle - before.rightRollerAngle) / (2 * epsilon),
      6e-10, 'right roller angular speed');
  }
  for (const time of [0, geometry.cycleDuration / 2,
    geometry.cycleDuration]) {
    const state = stateAtTime(time);
    near(state.bendRate, 0, 0, 'reversal bend rate');
    near(state.bendAcceleration, 0, 0, 'reversal bend acceleration');
    near(state.screwAngularSpeed, 0, 0, 'reversal screw speed');
    near(state.leftRollerAngularSpeed, 0, 0,
      'reversal roller speed');
  }
  assert.ok(stateAtTime(0.7).screwAngularSpeed < 0);
  assert.ok(stateAtTime(3.8).screwAngularSpeed > 0);
  disposeModel(model.root);
});

test('movement 404 update binds the computed path, screw, pad, rollers, and contacts to rendered objects', () => {
  const model = createMovementModel(catalog.movements[403]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const position = blocks.elasticBar.geometry.getAttribute('position');
  const sourcePositions = Array.from(position.array);

  assert.equal(position.usage, THREE.DynamicDrawUsage);
  assert.equal(position.count, geometry.totalPathSampleCount * 4);
  assert.equal(blocks.outerEdgeHighlight.geometry
    .getAttribute('position').count, geometry.totalPathSampleCount);
  model.update(geometry.cycleDuration / 2);
  const relaxedPositions = Array.from(position.array);
  assert.notDeepEqual(relaxedPositions, sourcePositions);
  const relaxed = stateAtTime(geometry.cycleDuration / 2);
  near(data.kinematics.bend, relaxed.bend, 0,
    'published relaxed kinematics');
  near(blocks.rollerAssemblies[0].roller.rotation.z,
    relaxed.leftRollerAngle, 0, 'rendered left roller angle');
  near(blocks.rollerAssemblies[1].roller.rotation.z,
    relaxed.rightRollerAngle, 0, 'rendered right roller angle');
  near(blocks.screw.userData.rotor.rotation.z, relaxed.screwAngle, 0,
    'rendered screw angle');
  near(blocks.thrustPad.position.y, relaxed.innerApex.y - 0.075, 0,
    'rendered pad translation');
  assert.equal(data.contacts.leftRollerToElasticBar.active, true);
  assert.equal(data.contacts.rightRollerToElasticBar.active, true);
  assert.equal(data.contacts.screwToFixedNut.active, true);
  assert.equal(data.contacts.thrustPadToBarMidpoint.active, true);
  near(data.contacts.leftRollerToElasticBar.noSlipResidual, 0, 0,
    'left rendered contact');
  near(data.contacts.rightRollerToElasticBar.noSlipResidual, 0, 0,
    'right rendered contact');
  model.update(geometry.cycleDuration);
  assert.deepEqual(Array.from(position.array), sourcePositions);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier', () => {
  const movement507 = catalog.movements[506];
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
});
