import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
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

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
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

test('movement 363 is one rigid seesaw on one fixed central transverse axle', () => {
  const movement = catalog.movements[362];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 363);
  assert.equal(movement.number, '363');
  assert.equal(movement.category, 'Miscellaneous mechanisms');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(movement.archetype, 'single-pivot-rigid-seesaw');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-rigid-seesaw-beam/);
  assert.match(data.mechanism, /one-fixed-central-fulcrum/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.input, /one limited rocking angle/);
  assert.match(degreesOfFreedom.note, /no crank, belt, cam/);

  assert.equal(blocks.frame.parent, model.root);
  assert.equal(blocks.beamRotor.parent, model.root);
  assert.equal(blocks.pivotAxle.parent, model.root);
  assert.equal(blocks.frame.userData.fixed, true);
  assert.ok(blocks.beamRotor.userData.axis.distanceTo(Z_AXIS) < 1e-15);
  for (const component of [
    blocks.plank,
    blocks.pivotBoss,
    ...blocks.plankEdgeRails,
    ...blocks.seats,
    ...blocks.handlePosts,
    ...blocks.handleBars,
    ...blocks.endpointIndexes,
  ]) assert.equal(component.parent, blocks.beamRotor);
  assert.equal(blocks.seats.length, 2);
  assert.equal(blocks.handlePosts.length, 2);
  assert.equal(blocks.handleBars.length, 2);
  assert.equal(blocks.endpointIndexes.length, 2);
  assert.equal(blocks.frameLegs.length, 4);
  assert.equal(blocks.apexCaps.length, 2);
  assert.equal(blocks.axleCaps.length, 2);

  const roles = [];
  const belts = [];
  const toothedObjects = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt || object.userData.mechanismBelt
      || object.userData.selectorBelt) belts.push(object);
    if (Number.isInteger(object.userData.teeth)) toothedObjects.push(object);
  });
  for (const role of [
    'single-straight-balanced-seesaw-plank',
    'end-seat-rigidly-fastened-to-seesaw-beam',
    'upright-handhold-post-on-moving-beam',
    'transverse-handgrip-on-moving-beam',
    'fixed-fulcrum-axle-through-moving-beam',
    'inclined-leg-of-fixed-a-frame',
    'white-index-at-seesaw-beam-end',
  ]) assert.ok(roles.includes(role), role);
  assert.equal(belts.length, 0);
  assert.equal(toothedObjects.length, 0);
  disposeModel(model.root);
});

test('movement 363 preserves the official ±30-degree cosine animation and public engraving evidence', () => {
  const movement = catalog.movements[362];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { sourceAnimation, sourceReference } = data;
  const official = sourceAnimation.officialGeometry;
  const plate = sourceReference.brownPlate363;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_363.html');
  assert.match(movement.description, /See-saw/);
  assert.match(movement.description, /limited oscillating/);
  assert.match(movement.description, /alternate circular motion/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, false);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.durationSeconds, 4);
  assert.deepEqual(sourceAnimation.officialFunctionChain, [
    'add_stat',
    'add_pos_interp',
    'add_text',
  ]);
  assert.deepEqual(official.view, [-5, -4.75, 10, 10]);
  near(official.beamHalfSwing, Math.PI / 6, 0,
    'official half swing');
  assert.deepEqual(official.beamStartRay.map((point) => point.toArray()), [
    [0, 0],
    [0.866026, -0.500002],
  ]);
  assert.deepEqual(official.beamEndRay.map((point) => point.toArray()), [
    [-0.000002, 0],
    [0.866025, 0.5],
  ]);
  assert.equal(official.pivotRadius, 0.125);
  assert.match(sourceAnimation.officialInterpolationLaw, /cos\(2\*pi/);
  assert.match(sourceAnimation.referenceScope, /15-cycle-per-minute/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.fulcrumPivot.toArray(), [239, 270]);
  assert.deepEqual(plate.leftBeamEnd.toArray(), [23, 104]);
  assert.deepEqual(plate.rightBeamEnd.toArray(), [469, 393]);
  assert.deepEqual(plate.baseLeft.toArray(), [46, 490]);
  assert.deepEqual(plate.baseRight.toArray(), [431, 490]);
  assert.equal(plate.engravingBeamAngleDegrees, -33);
  assert.deepEqual(
    sourceReference.constructionEvidence.explicitInBrownDescription,
    [
      'the device is a see-saw',
      'its motion is limited oscillating or alternate circular motion',
    ],
  );
  assert.match(
    sourceReference.constructionEvidence.engravingEvidence,
    /one long rigid plank/,
  );
  assert.match(
    sourceReference.constructionEvidence.officialAnimationEvidence,
    /30-degree.*cosine.*15 cycles per minute/,
  );
  disposeModel(model.root);
});

test('movement 363 follows the exact harmonic angle, speed, and acceleration at all canonical phases', () => {
  const model = createMovementModel(catalog.movements[362]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const states = [0, 1, 2, 3, 4].map(stateAtTime);

  assert.deepEqual(states.map(({ officialInterpolation }) => (
    Math.round(officialInterpolation * 1e12) / 1e12
  )), [1, 0.5, 0, 0.5, 1]);
  near(states[0].beamAngle, geometry.beamAmplitude, 2e-15,
    'positive reversal angle');
  near(states[1].beamAngle, 0, 2e-15, 'first level crossing');
  near(states[2].beamAngle, -geometry.beamAmplitude, 2e-15,
    'negative reversal angle');
  near(states[3].beamAngle, 0, 2e-15, 'second level crossing');
  near(states[4].beamAngle, geometry.beamAmplitude, 2e-15,
    'angle closure');
  near(states[0].beamAngularSpeed, 0, 2e-15,
    'positive reversal speed');
  near(states[1].beamAngularSpeed,
    -geometry.beamAmplitude * geometry.angularFrequency,
    2e-15, 'maximum clockwise speed');
  near(states[2].beamAngularSpeed, 0, 2e-15,
    'negative reversal speed');
  near(states[3].beamAngularSpeed,
    geometry.beamAmplitude * geometry.angularFrequency,
    2e-15, 'maximum counterclockwise speed');
  near(states[0].beamAngularAcceleration,
    -geometry.beamAmplitude * geometry.angularFrequency ** 2,
    2e-15, 'positive reversal acceleration');
  near(states[2].beamAngularAcceleration,
    geometry.beamAmplitude * geometry.angularFrequency ** 2,
    2e-15, 'negative reversal acceleration');
  assert.deepEqual(states.map(({ stage }) => stage), [
    'positive-angle-reversal',
    'clockwise-swing',
    'negative-angle-reversal',
    'counterclockwise-swing',
    'positive-angle-reversal',
  ]);
  assert.deepEqual(timeline.quarterCycleLevelCrossings, [1, 3]);
  assert.equal(timeline.negativeReversal, 2);
  assert.equal(timeline.positiveReversal, 0);

  for (let index = 0; index <= 720; index += 1) {
    const time = geometry.cyclePeriod * index / 720;
    const expectedAngle = geometry.beamAmplitude * Math.cos(
      geometry.angularFrequency * time,
    );
    near(stateAtTime(time).beamAngle, expectedAngle, 4e-15,
      `harmonic angle at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 363 keeps both beam ends diametrically opposite on equal circular arcs', () => {
  const model = createMovementModel(catalog.movements[362]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;

  for (let index = 0; index <= 1440; index += 1) {
    const time = geometry.cyclePeriod * 2 * index / 1440;
    const state = stateAtTime(time);
    const leftRadius = state.leftEndpoint.position.clone()
      .sub(geometry.pivot);
    const rightRadius = state.rightEndpoint.position.clone()
      .sub(geometry.pivot);
    near(leftRadius.length(), geometry.beamHalfLength, 2e-15,
      `left circular radius at ${time}`);
    near(rightRadius.length(), geometry.beamHalfLength, 2e-15,
      `right circular radius at ${time}`);
    vectorNear(leftRadius, rightRadius.clone().negate(), 2e-15,
      `diametrically opposite ends at ${time}`);
    near(
      state.leftEndpoint.position.distanceTo(
        state.rightEndpoint.position,
      ),
      geometry.beamLength,
      3e-15,
      `constant endpoint separation at ${time}`,
    );
    vectorNear(
      state.leftEndpoint.position.clone()
        .add(state.rightEndpoint.position)
        .multiplyScalar(0.5),
      geometry.pivot,
      2e-15,
      `fixed midpoint at ${time}`,
    );
    vectorNear(state.leftEndpoint.velocity,
      state.rightEndpoint.velocity.clone().negate(), 2e-15,
      `opposite endpoint velocities at ${time}`);
    vectorNear(state.leftEndpoint.acceleration,
      state.rightEndpoint.acceleration.clone().negate(), 4e-15,
      `opposite endpoint accelerations at ${time}`);
  }
  assert.match(transmission.endpointLaw, /equal-radius circular arcs/);
  assert.match(transmission.motionClass, /total angular range pi\/3/);
  assert.match(transmission.rigidBodyLaw, /endpoint separation is constant/);
  disposeModel(model.root);
});

test('movement 363 analytic beam and endpoint rates agree with finite differences', () => {
  const model = createMovementModel(catalog.movements[362]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  const epsilon = 1e-5;

  for (const time of [0.17, 0.61, 1.13, 1.74, 2.27, 2.89, 3.48, 3.91]) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near(
      (after.beamAngle - before.beamAngle) / (2 * epsilon),
      state.beamAngularSpeed,
      2e-10,
      `angular speed at ${time}`,
    );
    near(
      (after.beamAngularSpeed - before.beamAngularSpeed) / (2 * epsilon),
      state.beamAngularAcceleration,
      3e-10,
      `angular acceleration at ${time}`,
    );
    for (const endpoint of ['leftEndpoint', 'rightEndpoint']) {
      const finiteVelocity = after[endpoint].position.clone()
        .sub(before[endpoint].position)
        .multiplyScalar(1 / (2 * epsilon));
      vectorNear(finiteVelocity, state[endpoint].velocity, 7e-10,
        `${endpoint} velocity at ${time}`);
    }
  }
  near(geometry.angularFrequency, FULL_TURN / geometry.cyclePeriod, 0,
    'cycle angular frequency');
  disposeModel(model.root);
});

test('movement 363 renderer keeps the axle fixed and every moving accessory on one rotor for 1,200 frames', () => {
  const model = createMovementModel(catalog.movements[362]);
  const data = model.root.userData;
  const { blocks, geometry } = data;
  const axlePosition = blocks.pivotAxle.position.clone();
  const frameMatrix = blocks.frame.matrix.clone();

  for (const time of [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]) {
    const expected = data.stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.beamRotor.rotation.z, expected.beamAngle, 2e-15,
      `rendered beam angle at ${time}`);
    vectorNear(blocks.beamRotor.position, geometry.pivot, 0,
      `rendered pivot at ${time}`);
    vectorNear(blocks.pivotAxle.position, axlePosition, 0,
      `fixed axle at ${time}`);
    assert.ok(blocks.frame.matrix.equals(frameMatrix));
    near(data.constraints.fixedPivot.centerError, 0, 0,
      `fixed-pivot closure at ${time}`);
    near(data.constraints.rigidBeam.endpointDistance,
      geometry.beamLength, 3e-15,
      `rigid-beam length at ${time}`);
    near(data.constraints.rigidBeam.midpointError, 0, 2e-15,
      `rigid-beam midpoint at ${time}`);
  }

  let previousAngle;
  let largestAngleStep = 0;
  for (let index = 0; index <= 1200; index += 1) {
    model.update(geometry.cyclePeriod * 2 * index / 1200);
    model.root.updateMatrixWorld(true);
    if (previousAngle !== undefined) {
      largestAngleStep = Math.max(
        largestAngleStep,
        Math.abs(blocks.beamRotor.rotation.z - previousAngle),
      );
    }
    previousAngle = blocks.beamRotor.rotation.z;
    model.root.traverse((object) => {
      assert.ok(object.position.toArray().every(Number.isFinite));
      assert.ok(object.quaternion.toArray().every(Number.isFinite));
      if (object.geometry?.attributes?.position) {
        const values = object.geometry.attributes.position.array;
        for (let valueIndex = 0; valueIndex < values.length;
          valueIndex += 1) assert.ok(Number.isFinite(values[valueIndex]));
      }
    });
  }
  assert.ok(largestAngleStep < 0.0056,
    `largest per-frame beam-angle step was ${largestAngleStep}`);
  disposeModel(model.root);
});

test('movement 363 closes one official cycle while movement 507 remains the next authored draft', () => {
  const movement363 = catalog.movements[362];
  const model363 = createMovementModel(movement363);
  const data = model363.root.userData;
  const start = data.stateAtTime(0);
  const closure = data.stateAtTime(data.geometry.cyclePeriod);

  near(positiveModulo(closure.beamAngle - start.beamAngle, FULL_TURN),
    0, 2e-15, 'beam-angle closure');
  vectorNear(closure.leftEndpoint.position,
    start.leftEndpoint.position, 2e-15, 'left-end closure');
  vectorNear(closure.rightEndpoint.position,
    start.rightEndpoint.position, 2e-15, 'right-end closure');
  near(closure.beamAngularSpeed, start.beamAngularSpeed, 3e-15,
    'angular-speed closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model363.root);
  disposeModel(model507.root);
});
