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

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function planarNear(actual, expected, tolerance, message) {
  near(Math.hypot(actual.x - expected.x, actual.z - expected.z),
    0, tolerance, message);
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

test('movement 325 is the two-ruler, two-arm four-revolute parallelogram', () => {
  const movement = catalog.movements[324];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 325);
  assert.equal(movement.number, '325');
  assert.match(movement.title, /^Parallel ruler composed/);
  assert.equal(movement.category, 'Miscellaneous mechanisms');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'equal-swinging-arm-parallelogram-parallel-ruler');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /simple rulers A and B/);
  assert.match(mechanism, /exact parallelogram/);
  assert.match(mechanism, /two equal, parallel, pivoted swinging arms C, C/);
  assert.match(mechanism, /four revolute joints/);
  assert.equal(transmission.relativeArmAngularRatio, 1);
  assert.match(transmission.input, /either equal arm C/);
  assert.match(transmission.output, /parallel translation/);

  assert.equal(blocks.upperRulerA.parent, model.root);
  assert.equal(blocks.lowerRulerB.parent, model.root);
  assert.equal(blocks.leftArmC.parent, model.root);
  assert.equal(blocks.rightArmC.parent, model.root);
  assert.equal(blocks.upperRulerA.userData.body.parent,
    blocks.upperRulerA);
  assert.equal(blocks.lowerRulerB.userData.body.parent,
    blocks.lowerRulerB);
  assert.equal(Object.keys(blocks.jointPins).length, 4);
  for (const pin of Object.values(blocks.jointPins)) {
    assert.equal(pin.parent, model.root);
  }

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role === 'upper-simple-ruler-A').length,
    1);
  assert.equal(roles.filter((role) => role === 'lower-simple-ruler-B').length,
    1);
  assert.equal(roles.filter((role) =>
    role.endsWith('pivoted-swinging-arm-C')).length, 2);
  assert.equal(roles.filter((role) =>
    role.endsWith('revolute-joint-A-to-C')).length, 2);
  assert.equal(roles.filter((role) =>
    role.endsWith('revolute-joint-B-to-C')).length, 2);
  assert.equal(roles.some((role) => /slot|slider/.test(role)), false);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 325 preserves Brown’s A, B, C, C landmarks and official 30-degree swing', () => {
  const movement = catalog.movements[324];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToReferenceFront,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.brownPlate325;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.deepEqual(sourceAnimation.officialGeometry, {
    armCenterHalfSpacing: 1.968871,
    armEndpointRadius: 0.25,
    armHalfLength: 4.5,
    rulerMaximumX: 1,
    rulerMinimumX: -14,
    rulerWidth: 2,
  });
  assert.deepEqual(sourceAnimation.officialKeyframes.map(({ phase }) => phase),
    [0, 0.4, 0.5, 0.9, 1]);
  assert.deepEqual(sourceAnimation.officialKeyframes[0].rightPin,
    new THREE.Vector2(6, -2));
  assert.deepEqual(sourceAnimation.officialKeyframes[1].rightPin,
    new THREE.Vector2(4.459931, -3.747615));
  assert.deepEqual(sourceAnimation.officialKeyframes[0].leftPin,
    new THREE.Vector2(-6, 2));
  assert.match(sourceAnimation.referenceScope, /equal 9-unit arms C/);
  assert.match(sourceAnimation.referenceScope, /30-degree arm swing/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_325.html');

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 26);
  assert.deepEqual(plate.rasterJointCentroid,
    new THREE.Vector2(258.25, 243.75));
  assert.deepEqual(plate.rasterUpperLeftPivot,
    new THREE.Vector2(68, 170));
  assert.deepEqual(plate.rasterUpperRightPivot,
    new THREE.Vector2(210, 169));
  assert.deepEqual(plate.rasterLowerLeftPivot,
    new THREE.Vector2(301, 317));
  assert.deepEqual(plate.rasterLowerRightPivot,
    new THREE.Vector2(454, 319));
  assert.match(plate.inferredTopology, /upper ruler A/);
  assert.match(plate.inferredTopology, /lower ruler B/);
  assert.match(plate.inferredTopology, /four revolute pins/);
  assert.equal(sourceReference.officialDescription, movement.description);

  const reference = stateAtTime(0);
  const jointCentroid = Object.values(reference.joints)
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .multiplyScalar(0.25);
  const tolerance = plate.measurementUncertaintyPixels
    * Math.max(geometry.sourceScaleX, geometry.sourceScaleZ);
  planarNear(sourcePointToReferenceFront(plate.rasterJointCentroid),
    jointCentroid, 0, 'source four-joint centroid');
  planarNear(sourcePointToReferenceFront(plate.rasterUpperLeftPivot),
    reference.joints.upperLeft, tolerance, 'source upper-left pivot');
  planarNear(sourcePointToReferenceFront(plate.rasterUpperRightPivot),
    reference.joints.upperRight, tolerance, 'source upper-right pivot');
  planarNear(sourcePointToReferenceFront(plate.rasterLowerLeftPivot),
    reference.joints.lowerLeft, tolerance, 'source lower-left pivot');
  planarNear(sourcePointToReferenceFront(plate.rasterLowerRightPivot),
    reference.joints.lowerRight, tolerance, 'source lower-right pivot');
  planarNear(sourcePointToReferenceFront(plate.rasterUpperRuler.topLeft),
    reference.rulerA.translation.clone().add(
      new THREE.Vector3(-geometry.rulerLength / 2, 0,
        geometry.rulerWidth / 2),
    ),
  tolerance, 'source upper ruler outer corner');
  planarNear(sourcePointToReferenceFront(
    plate.rasterLowerRuler.bottomRight,
  ), reference.rulerB.translation.clone().add(
    new THREE.Vector3(geometry.rulerLength / 2, 0,
      -geometry.rulerWidth / 2),
  ), tolerance, 'source lower ruler outer corner');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 325 is an exact parallelogram with two equal rigid C arms', () => {
  const model = createMovementModel(catalog.movements[324]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 2048; sample += 1) {
    const state = stateAtTime(
      geometry.demonstrationPeriod * sample / 2048,
    );
    near(state.arms.leftC.length, geometry.armLength, 2e-15,
      `left arm length at ${sample}`);
    near(state.arms.rightC.length, geometry.armLength, 2e-15,
      `right arm length at ${sample}`);
    vectorNear(state.parallelogram.spanClosureResidual,
      new THREE.Vector3(), 0, `ruler-span closure at ${sample}`);
    vectorNear(state.parallelogram.connectorEqualityResidual,
      new THREE.Vector3(), 0, `C-arm equality at ${sample}`);
    near(state.parallelogram.parallelCrossResidual, 0, 0,
      `ruler spans parallel at ${sample}`);
    near(state.parallelogram.upperSpan.length(),
      geometry.rulerPivotSpacing, 3e-16,
    `upper pivot spacing at ${sample}`);
    near(state.parallelogram.lowerSpan.length(),
      geometry.rulerPivotSpacing, 3e-16,
    `lower pivot spacing at ${sample}`);
    vectorNear(state.arms.leftC.center,
      state.joints.upperLeft.clone().add(state.joints.lowerLeft)
        .multiplyScalar(0.5),
    3e-16, `left C midpoint at ${sample}`);
    vectorNear(state.arms.rightC.center,
      state.joints.upperRight.clone().add(state.joints.lowerRight)
        .multiplyScalar(0.5),
    3e-16, `right C midpoint at ${sample}`);
    near(state.arms.rightC.center.x - state.arms.leftC.center.x,
      geometry.rulerPivotSpacing, 0,
    `equal arm-center spacing at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 325 keeps A and B rigid, parallel, and symmetrically translated', () => {
  const model = createMovementModel(catalog.movements[324]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 1024; sample += 1) {
    const state = stateAtTime(
      geometry.demonstrationPeriod * sample / 1024,
    );
    vectorNear(state.rulerA.translation.clone().add(
      state.rulerB.translation,
    ), new THREE.Vector3(), 1e-15,
    `symmetric ruler centers at ${sample}`);
    vectorNear(state.rulerA.velocity.clone().add(state.rulerB.velocity),
      new THREE.Vector3(), 0, `symmetric ruler velocities at ${sample}`);
    vectorNear(state.rulerA.acceleration.clone().add(
      state.rulerB.acceleration,
    ), new THREE.Vector3(), 0,
    `symmetric ruler accelerations at ${sample}`);
    near(state.rulerA.rotation, 0, 0,
      `A does not rotate at ${sample}`);
    near(state.rulerB.rotation, 0, 0,
      `B does not rotate at ${sample}`);
    vectorNear(state.rulerA.longEdgeDirection,
      state.rulerB.longEdgeDirection, 0,
    `A and B long edges remain parallel at ${sample}`);
    vectorNear(state.rulerA.endEdgeDirection,
      state.rulerB.endEdgeDirection, 0,
    `A and B ends remain parallel at ${sample}`);
    near(state.joints.upperLeft.x - state.rulerA.translation.x,
      geometry.upperLeftPivotOffsetX, 3e-16,
    `upper-left pin rigid in A at ${sample}`);
    near(state.joints.upperRight.x - state.rulerA.translation.x,
      geometry.upperRightPivotOffsetX, 5e-16,
    `upper-right pin rigid in A at ${sample}`);
    near(state.joints.lowerLeft.x - state.rulerB.translation.x,
      geometry.lowerLeftPivotOffsetX, 5e-16,
    `lower-left pin rigid in B at ${sample}`);
    near(state.joints.lowerRight.x - state.rulerB.translation.x,
      geometry.lowerRightPivotOffsetX, 3e-16,
    `lower-right pin rigid in B at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 325 gives both C arms the same angle and exact analytic ruler rates', () => {
  const model = createMovementModel(catalog.movements[324]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 1024; sample += 1) {
    const state = stateAtTime(
      geometry.demonstrationPeriod * sample / 1024,
    );
    const left = state.arms.leftC.end.clone().sub(state.arms.leftC.start);
    const right = state.arms.rightC.end.clone()
      .sub(state.arms.rightC.start);
    vectorNear(left, right, 0, `equal oriented C arms at ${sample}`);
    near(Math.atan2(left.z, left.x), state.armAngle, 5e-16,
      `left C angle at ${sample}`);
    near(Math.atan2(right.z, right.x), state.armAngle, 5e-16,
      `right C angle at ${sample}`);
    assert.ok(Number.isFinite(state.armAngularVelocity));
    assert.ok(Number.isFinite(state.armAngularAcceleration));
  }

  const step = 1e-5;
  for (const time of [0.35, 0.9, 1.55, 2.9, 3.45, 4.15]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    near((after.rulerA.translation.x - before.rulerA.translation.x)
      / (2 * step), state.rulerA.velocity.x, 1.1e-10,
    `A x velocity at ${time}`);
    near((after.rulerA.translation.z - before.rulerA.translation.z)
      / (2 * step), state.rulerA.velocity.z, 1.1e-10,
    `A z velocity at ${time}`);
    near((after.rulerA.velocity.x - before.rulerA.velocity.x)
      / (2 * step), state.rulerA.acceleration.x, 2.0e-9,
    `A x acceleration at ${time}`);
    near((after.rulerA.velocity.z - before.rulerA.velocity.z)
      / (2 * step), state.rulerA.acceleration.z, 2.0e-9,
    `A z acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 325 follows the official 30-degree move-hold-return-hold schedule smoothly', () => {
  const model = createMovementModel(catalog.movements[324]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  const period = geometry.demonstrationPeriod;
  const outwardEnd = period * geometry.outwardEndPhase;
  const holdEnd = period * geometry.outwardHoldEndPhase;
  const returnEnd = period * geometry.returnEndPhase;

  for (const time of [0, outwardEnd, holdEnd, returnEnd, period]) {
    const state = stateAtTime(time);
    near(state.armAngularVelocity, 0, 0,
      `zero keyframe angular speed at ${time}`);
    near(state.armAngularAcceleration, 0, 0,
      `zero keyframe angular acceleration at ${time}`);
  }
  near(stateAtTime(0).armAngle, geometry.startAngle, 0,
    'source start angle');
  near(stateAtTime(outwardEnd).armAngle, geometry.endAngle, 0,
    'source end angle');
  near(geometry.endAngle - geometry.startAngle, -Math.PI / 6, 0,
    'exact 30-degree swing');
  for (const phase of [0.41, 0.45, 0.49]) {
    assert.equal(stateAtTime(period * phase).mode,
      'holding-wider-parallel-offset');
  }
  for (const phase of [0.91, 0.95, 0.99]) {
    assert.equal(stateAtTime(period * phase).mode,
      'holding-nearer-parallel-offset');
  }
  const outwardMid = stateAtTime(period * 0.2);
  const returnMid = stateAtTime(period * 0.7);
  near(outwardMid.armAngle, returnMid.armAngle, 2e-16,
    'symmetric angular path');
  near(outwardMid.armAngularVelocity,
    -returnMid.armAngularVelocity, 4e-16,
  'symmetric angular velocity');
  assert.deepEqual(timeline.schedule.map(({ phase }) => phase),
    [0, 0.4, 0.5, 0.9, 1]);
  disposeModel(model.root);
});

test('movement 325 renderer binds both rulers, both C arms, and all four revolute pins', () => {
  const model = createMovementModel(catalog.movements[324]);
  const {
    animationTiming,
    blocks,
    geometry,
    stateAtTime,
  } = model.root.userData;

  assert.equal(animationTiming.authoredCyclePeriod, geometry.demonstrationPeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(blocks.upperRulerA.userData.solidDepth,
    geometry.rulerDepth);
  assert.equal(blocks.lowerRulerB.userData.solidDepth,
    geometry.rulerDepth);
  assert.equal(blocks.leftArmC.userData.nominalLength,
    geometry.armLength);
  assert.equal(blocks.rightArmC.userData.nominalLength,
    geometry.armLength);
  assert.equal(blocks.guideLines.length, 4);

  for (const time of [0, 0.7, 1.5, 2, 2.3, 2.5, 3.4, 4.5, 4.8, 5]) {
    const state = stateAtTime(time);
    model.update(time);
    vectorNear(blocks.upperRulerA.position,
      state.rulerA.translation, 0, `rendered ruler A at ${time}`);
    vectorNear(blocks.lowerRulerB.position,
      state.rulerB.translation, 0, `rendered ruler B at ${time}`);
    vectorNear(blocks.leftArmC.userData.renderedStart,
      new THREE.Vector3(state.joints.upperLeft.x,
        geometry.armLayerY, state.joints.upperLeft.z),
    0, `rendered left C start at ${time}`);
    vectorNear(blocks.leftArmC.userData.renderedEnd,
      new THREE.Vector3(state.joints.lowerLeft.x,
        geometry.armLayerY, state.joints.lowerLeft.z),
    0, `rendered left C end at ${time}`);
    vectorNear(blocks.rightArmC.userData.renderedStart,
      new THREE.Vector3(state.joints.upperRight.x,
        geometry.armLayerY, state.joints.upperRight.z),
    0, `rendered right C start at ${time}`);
    near(blocks.leftArmC.children[0].scale.x,
      geometry.armLength, 2e-15, `rendered left C length at ${time}`);
    near(blocks.rightArmC.children[0].scale.x,
      geometry.armLength, 2e-15, `rendered right C length at ${time}`);
    for (const [name, pin] of Object.entries(blocks.jointPins)) {
      vectorNear(pin.position, state.joints[name], 0,
        `rendered ${name} pin at ${time}`);
    }
    assert.equal(Object.keys(model.root.userData.contacts).length, 4);
    model.root.traverse((object) => {
      for (const value of object.position.toArray()) {
        assert.ok(Number.isFinite(value), `finite position at ${time}`);
      }
      for (const value of object.quaternion.toArray()) {
        assert.ok(Number.isFinite(value), `finite quaternion at ${time}`);
      }
    });
  }
  disposeModel(model.root);
});

test('movement 325 closes exactly and leaves movement 339 as the next authored draft', () => {
  const model = createMovementModel(catalog.movements[324]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(geometry.demonstrationPeriod);

  near(closure.phase, start.phase, 0, 'phase closure');
  near(closure.armAngle, start.armAngle, 0, 'arm-angle closure');
  near(closure.armAngularVelocity, start.armAngularVelocity, 0,
    'arm-speed closure');
  near(closure.armAngularAcceleration, start.armAngularAcceleration, 0,
    'arm-acceleration closure');
  vectorNear(closure.rulerA.translation,
    start.rulerA.translation, 0, 'ruler A closure');
  vectorNear(closure.rulerB.translation,
    start.rulerB.translation, 0, 'ruler B closure');
  for (const name of Object.keys(start.joints)) {
    vectorNear(closure.joints[name], start.joints[name], 0,
      `${name} closure`);
  }
  model.update(geometry.demonstrationPeriod);
  vectorNear(blocks.upperRulerA.position,
    start.rulerA.translation, 0, 'rendered A closure');
  vectorNear(blocks.lowerRulerB.position,
    start.rulerB.translation, 0, 'rendered B closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
