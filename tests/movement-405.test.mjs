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
  'two-focus-taut-thread-and-pivoted-rule-hyperbola-drawing-instrument-with-pencil-in-bight';

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
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

test('movement 405 is one pivoted rule, one two-segment thread, two fixed foci, and one pencil', () => {
  const movement = catalog.movements[404];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 405);
  assert.equal(movement.number, '405');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /one rigid rule pivots/);
  assert.match(data.mechanism, /one constant-length thread/);
  assert.match(data.mechanism, /pencil constrained to the rule/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.deepEqual(degreesOfFreedom.inputs,
    ['manual angular sweep of the rule about the upper focus']);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(blocks.rule.parent, model.root);
  assert.equal(blocks.ruleBody.parent, blocks.rule);
  assert.equal(blocks.threadAnchor.parent, blocks.rule);
  assert.equal(blocks.focusCord.parent, model.root);
  assert.equal(blocks.ruleCord.parent, model.root);
  assert.equal(blocks.pencil.parent, model.root);
  assert.equal(blocks.upperFocusPin.group.parent, model.root);
  assert.equal(blocks.lowerFocusPin.group.parent, model.root);

  const roles = [];
  const belts = [];
  const gears = [];
  const threadSegments = [];
  const rules = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.teeth) gears.push(object);
    if (object.userData.role?.startsWith('taut-thread-segment')) {
      threadSegments.push(object);
    }
    if (object.userData.role ===
      'single-straight-rule-pivoted-at-upper-focus') rules.push(object);
  });
  assert.deepEqual(belts, []);
  assert.deepEqual(gears, []);
  assert.equal(threadSegments.length, 2);
  assert.equal(rules.length, 1);
  for (const role of [
    'upper-focus-rule-pivot',
    'lower-focus-fixed-thread-loop-pin',
    'thread-end-looped-around-lower-focus-pin',
    'single-straight-rule-pivoted-at-upper-focus',
    'thread-end-fixed-to-free-end-of-rule',
    'pencil-held-in-thread-bight-and-against-rule',
    'white-thread-bight-around-pencil',
    'required-lower-hyperbola-branch-traced-by-instrument',
    'opposite-hyperbola-branch-shown-in-brown-engraving',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 405 records Brown’s plate, unavailable animation, and printed parabola erratum without altering the catalog', () => {
  const movement = catalog.movements[404];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate405;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_405.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /describing hyperbolas/);
  assert.match(movement.description, /their foci and vertices being given/);
  assert.match(movement.description, /One end of rule turns on one focus/);
  assert.match(movement.description, /thread being looped.*other focus/);
  assert.match(movement.description, /describes one-half of parabola/);
  assert.equal(sourceReference.textualErratum.printedWord, 'parabola');
  assert.match(sourceReference.textualErratum.interpretation,
    /constant difference of focal distances.*hyperbola/);
  assert.match(sourceReference.textualErratum.treatment,
    /catalog preserves Brown’s printed wording/);
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
  assert.deepEqual(plate.upperFocusApproximatePixels, [292, 168]);
  assert.deepEqual(plate.lowerFocusApproximatePixels, [290, 379]);
  assert.deepEqual(plate.upperVertexApproximatePixels, [292, 200]);
  assert.deepEqual(plate.lowerVertexApproximatePixels, [291, 345]);
  assert.deepEqual(plate.ruleEndApproximatePixels, [166, 503]);
  assert.equal(plate.horizontalAxisYApproximatePixels, 273);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.engravingEvidence, /two opposite vertical hyperbola/);
  assert.match(evidence.reconstructionDisclosure,
    /focal-distance and thread-length constraints are exact/);
  disposeModel(model.root);
});

test('movement 405 derives one exact vertical hyperbola from the prescribed foci, vertices, rule, and thread', () => {
  const model = createMovementModel(catalog.movements[404]);
  const data = model.root.userData;
  const { geometry, sourcePose } = data;

  near(geometry.semiConjugateAxis ** 2,
    geometry.focalHalfDistance ** 2
      - geometry.semiTransverseAxis ** 2,
  2.3e-16, 'hyperbola b squared');
  near(geometry.upperFocus.distanceTo(geometry.lowerFocus),
    geometry.focusSeparation, 0, 'focus separation');
  near(geometry.distanceDifference,
    2 * geometry.semiTransverseAxis, 0,
    'constant focal-distance difference');
  near(geometry.threadLength,
    geometry.ruleLength - geometry.distanceDifference, 0,
    'thread chosen from ruler length and focal difference');
  near(geometry.asymptoteAngle,
    Math.acos(geometry.semiTransverseAxis
      / geometry.focalHalfDistance), 0, 'asymptote angle');
  assert.ok(geometry.maximumRuleAngle < geometry.asymptoteAngle);
  near(data.hyperbolaY(0, -1), -geometry.semiTransverseAxis, 0,
    'lower vertex');
  near(data.hyperbolaY(0, 1), geometry.semiTransverseAxis, 0,
    'upper vertex');

  for (let sample = 0; sample <= 10000; sample += 1) {
    const x = THREE.MathUtils.lerp(
      -geometry.targetHalfWidth,
      geometry.targetHalfWidth,
      sample / 10000,
    );
    for (const branchSign of [-1, 1]) {
      const point = new THREE.Vector2(x, data.hyperbolaY(x, branchSign));
      const focalDifference = Math.abs(
        point.distanceTo(geometry.upperFocus)
          - point.distanceTo(geometry.lowerFocus),
      );
      near(focalDifference, geometry.distanceDifference, 2.7e-15,
        'target branch focal-distance difference');
    }
  }
  near(sourcePose.ruleAngle, geometry.sourceRuleAngle, 4e-16,
    'source raster rule angle');
  assert.equal(sourcePose.branchHalf, 'left');
  assert.match(sourcePose.setting, /leaning down-left/);
  disposeModel(model.root);
});

test('movement 405 closes the rule, hyperbola, focal difference, and constant thread at every pose', () => {
  const model = createMovementModel(catalog.movements[404]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  let maximumEquationResidual = 0;
  let maximumDifferenceResidual = 0;
  let maximumThreadResidual = 0;
  let maximumRuleResidual = 0;
  let minimumRuleSegmentLength = Infinity;
  let minimumPencilDistance = Infinity;
  let maximumPencilDistance = -Infinity;

  for (let sample = -10000; sample <= 20000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 10000);
    maximumEquationResidual = Math.max(maximumEquationResidual,
      Math.abs(state.hyperbolaEquationResidual));
    maximumDifferenceResidual = Math.max(maximumDifferenceResidual,
      Math.abs(state.distanceDifferenceResidual));
    maximumThreadResidual = Math.max(maximumThreadResidual,
      Math.abs(state.threadLengthResidual));
    maximumRuleResidual = Math.max(maximumRuleResidual,
      Math.abs(state.pencilRuleCrossResidual));
    minimumRuleSegmentLength = Math.min(minimumRuleSegmentLength,
      state.ruleSegmentLength);
    minimumPencilDistance = Math.min(minimumPencilDistance,
      state.pencilDistanceAlongRule);
    maximumPencilDistance = Math.max(maximumPencilDistance,
      state.pencilDistanceAlongRule);
    assert.ok(state.pencilPoint.y < 0);
    assert.ok(state.focusSegmentLength > 0);
    assert.ok(state.pencilDistanceAlongRule < geometry.ruleLength);
    near(state.focusSegmentLength + state.ruleSegmentLength,
      geometry.threadLength, 2.3e-15, 'thread closure');
  }
  assert.ok(maximumEquationResidual < 7.2e-15);
  assert.ok(maximumDifferenceResidual < 2.3e-15);
  assert.ok(maximumThreadResidual < 2.3e-15);
  assert.ok(maximumRuleResidual < 4.5e-16);
  assert.ok(minimumRuleSegmentLength > 0.61);
  near(minimumPencilDistance,
    geometry.focalHalfDistance + geometry.semiTransverseAxis,
  9e-8, 'pencil distance at vertex');
  assert.ok(maximumPencilDistance < 3.835);
  disposeModel(model.root);
});

test('movement 405 thread segment rates cancel and analytic pencil kinematics match finite differences', () => {
  const model = createMovementModel(catalog.movements[404]);
  const { stateAtTime } = model.root.userData;
  let maximumRateResidual = 0;
  for (let sample = -10000; sample <= 20000; sample += 1) {
    const state = stateAtTime(8 * sample / 10000);
    maximumRateResidual = Math.max(maximumRateResidual,
      Math.abs(state.segmentRateCancellationResidual));
  }
  assert.ok(maximumRateResidual < 1.6e-15);

  const velocityEpsilon = 1e-6;
  const accelerationEpsilon = 1e-4;
  for (const time of [0.17, 0.9, 1.8, 3.05, 4.2, 5.7, 7.4]) {
    const before = stateAtTime(time - velocityEpsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + velocityEpsilon);
    const beforeAcceleration = stateAtTime(time - accelerationEpsilon);
    const afterAcceleration = stateAtTime(time + accelerationEpsilon);
    near(state.ruleAngularSpeed,
      (after.ruleAngle - before.ruleAngle) / (2 * velocityEpsilon),
      2e-10, 'rule angular speed');
    near(state.pencilSlidingSpeed,
      (after.pencilDistanceAlongRule
        - before.pencilDistanceAlongRule) / (2 * velocityEpsilon),
      1.2e-9, 'pencil sliding speed');
    const finitePencilVelocity = after.pencilPoint.clone()
      .sub(before.pencilPoint)
      .multiplyScalar(1 / (2 * velocityEpsilon));
    vectorNear(state.pencilVelocity, finitePencilVelocity, 1.3e-9,
      'pencil velocity');
    const finitePencilAcceleration = afterAcceleration.pencilVelocity
      .clone()
      .sub(beforeAcceleration.pencilVelocity)
      .multiplyScalar(1 / (2 * accelerationEpsilon));
    vectorNear(state.pencilAcceleration, finitePencilAcceleration, 4.1e-8,
      'pencil acceleration');
    near(state.focusSegmentRate,
      (after.focusSegmentLength
        - before.focusSegmentLength) / (2 * velocityEpsilon),
      1.1e-9, 'focus-side thread rate');
  }
  disposeModel(model.root);
});

test('movement 405 sweeps both halves, passes the vertex, and reverses short of the asymptote', () => {
  const model = createMovementModel(catalog.movements[404]);
  const { geometry, stateAtTime } = model.root.userData;
  const phaseTime = (targetPhase) => geometry.cycleDuration
    * positiveModulo(targetPhase - geometry.sourcePhaseOffset, 1);
  const leftExtreme = stateAtTime(phaseTime(0.75));
  const rightExtreme = stateAtTime(phaseTime(0.25));
  const firstVertex = stateAtTime(phaseTime(0));
  const secondVertex = stateAtTime(phaseTime(0.5));

  near(leftExtreme.ruleAngle, -geometry.maximumRuleAngle, 0,
    'left extreme angle');
  near(rightExtreme.ruleAngle, geometry.maximumRuleAngle, 0,
    'right extreme angle');
  near(leftExtreme.ruleAngularSpeed, 0, 1.3e-16,
    'left smooth reversal');
  near(rightExtreme.ruleAngularSpeed, 0, 3e-17,
    'right smooth reversal');
  assert.equal(leftExtreme.branchHalf, 'left');
  assert.equal(rightExtreme.branchHalf, 'right');
  for (const vertex of [firstVertex, secondVertex]) {
    near(vertex.ruleAngle, 0, 1.3e-16, 'vertex rule angle');
    near(vertex.pencilPoint.x, 0, 3e-16, 'vertex x');
    near(vertex.pencilPoint.y, -geometry.semiTransverseAxis,
      3e-16, 'vertex y');
  }
  assert.ok(Math.abs(leftExtreme.ruleAngle) < geometry.asymptoteAngle);
  assert.ok(Math.abs(rightExtreme.ruleAngle) < geometry.asymptoteAngle);
  disposeModel(model.root);
});

test('movement 405 renders finite tangent endpoints while retaining the ideal string constraint', () => {
  const model = createMovementModel(catalog.movements[404]);
  const data = model.root.userData, { blocks, geometry, stateAtTime } = data;
  for (const cycleFraction of [0, .11, .27, .49, .72, .93, 1]) {
    const time = geometry.cycleDuration * cycleFraction, state = stateAtTime(time);
    model.update(time); model.root.updateMatrixWorld(true);
    near(blocks.rule.rotation.z, state.ruleAngle, 0, 'rendered rule angle');
    vectorNear(blocks.pencil.position, new THREE.Vector3(state.pencilPoint.x, state.pencilPoint.y, 0), 0, 'pencil location');
    const path = data.finiteCord;
    for (const [cord, start, end] of [[blocks.focusCord, path.start, path.entry], [blocks.ruleCord, path.exit, path.end]]) {
      vectorNear(cord.localToWorld(new THREE.Vector3(0, -.5, 0)), start, 1e-13, 'finite cord start');
      vectorNear(cord.localToWorld(new THREE.Vector3(0, .5, 0)), end, 1e-13, 'finite cord end');
    }
    vectorNear(blocks.threadAnchor.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(state.ruleEnd.x, state.ruleEnd.y, .36), 1e-13, 'rule anchor');
    near(blocks.pencilPoint.getWorldPosition(new THREE.Vector3()).z, -.145, 0, 'graphite on trace');
    near(data.contacts.threadAtRuleEnd.totalLengthResidual, state.threadLengthResidual, 0, 'ideal thread law');
    assert.ok(path.lengthResidual > 0, 'finite visual winding is explicitly distinct from the ideal length');
  }
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier', () => {
  const movement507 = catalog.movements[506];
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
});

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}
