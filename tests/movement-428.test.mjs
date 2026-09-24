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
  'three-arm-clockwise-rotor-with-counterspinning-rollers-deforming-fixed-material-rubber-liner';
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

test('movement 428 has one flexible liner E, exactly three visible rollers A, three radial arms, and main shaft B', () => {
  const movement = catalog.movements[427];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 428);
  assert.equal(movement.number, '428');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /Three rollers A replace rigid pistons/);
  assert.match(data.mechanism, /carried clockwise on three arms fast to main shaft B/);
  assert.match(data.mechanism, /fixed-material india-rubber cylinder lining E deforms radially/);
  assert.match(data.mechanism, /roller counterspins at arm-radius divided by roller-radius/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.linerMaterialNodeRadiiIndependent, false);
  assert.equal(degreesOfFreedom.rollerSpinIndependent, false);
  assert.equal(blocks.rollerArms.length, 3);
  assert.equal(blocks.rollerGroups.length, 3);
  assert.equal(blocks.rollersA.length, 3);
  assert.equal(blocks.spinMarkers.length, 3);
  assert.equal(blocks.rotor.parent, model.root);
  // Arms and hub are fast on B, so B turns in the rotor with them.
  assert.equal(blocks.shaftB.parent, blocks.rotor);
  assert.equal(blocks.linerE.parent, model.root);
  for (let index = 0; index < 3; index += 1) {
    assert.equal(blocks.rollerArms[index].parent, blocks.rotor);
    assert.equal(blocks.rollerGroups[index].parent, blocks.rotor);
    assert.equal(blocks.rollersA[index].parent,
      blocks.rollerGroups[index]);
  }

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.filter((role) => /^working-roller-A-\d$/.test(role))
    .length, 3);
  assert.equal(roles.filter((role) => /^radial-arm-\d-from-B-to-A$/.test(role))
    .length, 3);
  for (const role of [
    'flexible-india-rubber-cylinder-lining-E-with-fixed-material-angles',
    'fixed-rigid-cylinder-surrounding-flexible-lining',
    'main-shaft-B-in-fixed-cylinder-bearings',
    'left-induction-port-to-space-outside-rubber-liner',
    'right-eduction-port-from-space-outside-rubber-liner',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 428 records Brown’s pressure-side rubber-liner topology and explicitly discloses the absent animation and inferred dimensions', () => {
  const movement = catalog.movements[427];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate428;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_428.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /flexible lining, E, of india-rubber/);
  assert.match(movement.description, /rollers, A, A, are substituted for pistons/);
  assert.match(movement.description, /arms radiating from the main shaft, B/);
  assert.match(movement.description, /steam acting between the india-rubber and the surrounding rigid portion/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /static engraving and description.*no Canvas construction or source timing/);
  assert.equal(dynamics.elasticConstitutiveLawMembraneTensionPressureFlowCutoffLeakageFrictionInertiaAndLoadsModeled,
    false);
  assert.match(dynamics.linerModel,
    /fixed angular nodes.*smooth compact-support radial indentation/);
  assert.match(dynamics.rollingContact,
    /exact no-slip angular speed/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.mainShaftBApproximateCenterPixels, [260, 282]);
  assert.deepEqual(plate.rollerAApproximateCentersPixels,
    [[145, 259], [319, 148], [329, 369]]);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence,
    /three circular rollers labeled A.*three arms.*shaft B/);
  assert.match(evidence.engravingEvidence,
    /clockwise rotor arrow/);
  assert.match(evidence.reconstructionDisclosure,
    /Equal 120-degree arms, a 4:1 ideal rolling ratio/);
  assert.match(evidence.reconstructionDisclosure,
    /independently engineered/);
  disposeModel(model.root);
});

test('movement 428 reconstructed source pose places three equal-radius roller centers 120 degrees apart', () => {
  const model = createMovementModel(catalog.movements[427]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);
  const expected = [
    new THREE.Vector3(-2, 0, 0),
    new THREE.Vector3(1, -Math.sqrt(3), 0),
    new THREE.Vector3(1, Math.sqrt(3), 0),
  ];

  near(sourcePose.carrierAngle, 0, 0, 'source carrier angle');
  assert.equal(sourcePose.rollerCenters.length, 3);
  assert.equal(sourcePose.rollerContactPoints.length, 3);
  for (let index = 0; index < 3; index += 1) {
    vectorNear(sourcePose.rollerCenters[index], expected[index], 2e-15,
      `source roller ${index + 1} center`);
    vectorNear(source.rollers[index].center, expected[index], 2e-15,
      `state roller ${index + 1} center`);
    near(source.rollers[index].center.length(), geometry.armRadius, 2e-16,
      `source arm ${index + 1} radius`);
    near(source.rollers[index].contactPoint.length(),
      geometry.linerContactRadius, 4.5e-16,
      `source roller ${index + 1} contact radius`);
  }
  near(geometry.rollerSpinRatio, 4, 0, 'chosen visible no-slip ratio');
  disposeModel(model.root);
});

test('movement 428 carrier keeps all three rollers on rigid 120-degree radial arms through a clockwise revolution', () => {
  const model = createMovementModel(catalog.movements[427]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = -20000; sample <= 40000; sample += 1) {
    const inputAngle = FULL_TURN * sample / 20000;
    const state = stateAtInputAngle(inputAngle);
    sameAngle(state.carrierAngle, -inputAngle, 2.5e-15,
      'clockwise carrier angle');
    for (const roller of state.rollers) {
      near(roller.center.length(), geometry.armRadius, 4.5e-16,
        'constant arm radius');
      vectorNear(roller.center,
        roller.radial.clone().multiplyScalar(geometry.armRadius),
        0, 'roller center lies on its radial arm');
    }
    for (let index = 0; index < 3; index += 1) {
      const next = (index + 1) % 3;
      near(state.rollers[index].center.distanceTo(
        state.rollers[next].center,
      ), Math.sqrt(3) * geometry.armRadius, 2.7e-15,
      'equilateral carrier spacing');
    }
  }
  disposeModel(model.root);
});

test('movement 428 liner has fixed material angles, exact roller tangency, and no penetration anywhere on the sampled inner surface', () => {
  const model = createMovementModel(catalog.movements[427]);
  const data = model.root.userData;
  const { geometry, linerRadiusAtWorldAngle, stateAtInputAngle } = data;
  let minimumClearance = Infinity;

  for (let phaseIndex = 0; phaseIndex < 360; phaseIndex += 1) {
    const inputAngle = FULL_TURN * phaseIndex / 360;
    const state = stateAtInputAngle(inputAngle);
    for (const roller of state.rollers) {
      near(roller.linerContactResidual, 0, 4.5e-16,
        'liner tangent at roller outer point');
      vectorNear(roller.contactPoint,
        roller.radial.clone().multiplyScalar(
          geometry.armRadius + geometry.rollerRadius,
        ), 0, 'radial contact construction');
    }
    for (let angleIndex = 0; angleIndex < 360; angleIndex += 1) {
      const materialAngle = FULL_TURN * angleIndex / 360;
      const linerRadius = linerRadiusAtWorldAngle(
        materialAngle,
        inputAngle,
      );
      assert.ok(linerRadius >= geometry.linerContactRadius - 5e-16);
      assert.ok(linerRadius <= geometry.linerRestRadius + 5e-16);
      const linerPoint = new THREE.Vector3(
        Math.cos(materialAngle) * linerRadius,
        Math.sin(materialAngle) * linerRadius,
        0,
      );
      for (const roller of state.rollers) {
        minimumClearance = Math.min(
          minimumClearance,
          linerPoint.distanceTo(roller.center) - geometry.rollerRadius,
        );
      }
    }
  }
  assert.ok(minimumClearance >= -7e-16);
  disposeModel(model.root);
});

test('movement 428 compact-support rubber deformation is smooth, periodic, and returns every material node to its rest radius between rollers', () => {
  const model = createMovementModel(catalog.movements[427]);
  const data = model.root.userData;
  const { geometry, linerIndentationWeight, linerRadiusAtWorldAngle } = data;
  const materialAngle = 0.371;
  const sampleCount = 60000;
  let previous = linerRadiusAtWorldAngle(materialAngle, 0);
  let minimum = previous;
  let maximum = previous;
  let maximumStep = 0;

  near(linerIndentationWeight(0), 1, 0, 'indentation center weight');
  near(linerIndentationWeight(geometry.linerInfluenceHalfAngle), 0, 0,
    'compact-support edge');
  near(linerIndentationWeight(
    geometry.linerInfluenceHalfAngle + 0.01,
  ), 0, 0, 'outside compact support');
  for (let sample = 1; sample <= sampleCount; sample += 1) {
    const inputAngle = FULL_TURN * sample / sampleCount;
    const current = linerRadiusAtWorldAngle(materialAngle, inputAngle);
    maximumStep = Math.max(maximumStep, Math.abs(current - previous));
    minimum = Math.min(minimum, current);
    maximum = Math.max(maximum, current);
    previous = current;
  }
  near(minimum, geometry.linerContactRadius, 3e-9,
    'material-node deepest deflection');
  near(maximum, geometry.linerRestRadius, 0,
    'material-node rest radius');
  assert.ok(maximumStep < 1.2e-4);
  near(linerRadiusAtWorldAngle(materialAngle, 0),
    linerRadiusAtWorldAngle(materialAngle, FULL_TURN), 4.5e-16,
    'material-node full-cycle closure');
  disposeModel(model.root);
});

test('movement 428 roller spin obeys the arm-radius ratio and cancels tangential velocity at every rubber contact', () => {
  const model = createMovementModel(catalog.movements[427]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (const angle of [0, 0.23, 0.59, 1.07, 1.64, 2.21,
    2.88, 3.47, 4.12, 4.79, 5.36, 6.02]) {
    const inputSpeed = 1.13 + 0.31 * Math.cos(angle * 0.73);
    const inputAcceleration = -0.27 * Math.sin(angle * 0.61);
    const state = stateAtInputAngle(
      angle,
      inputSpeed,
      inputAcceleration,
    );
    near(state.rollerAngularSpeed,
      -state.carrierAngularSpeed * geometry.armRadius
        / geometry.rollerRadius,
      0, 'roller no-slip speed ratio');
    near(state.rollerAngularAcceleration,
      -state.carrierAngularAcceleration * geometry.armRadius
        / geometry.rollerRadius,
      0, 'roller no-slip acceleration ratio');
    assert.ok(state.carrierAngularSpeed < 0);
    assert.ok(state.rollerAngularSpeed > 0);
    for (const roller of state.rollers) {
      vectorNear(roller.rollingContactVelocity, new THREE.Vector3(), 0,
        'stationary rubber contact velocity');
      near(roller.rollingWithoutSlipResidual, 0, 0,
        'zero no-slip residual');
      vectorNear(roller.centerVelocity.clone().add(
        roller.rollerSurfaceVelocityAtContact,
      ), new THREE.Vector3(), 0, 'surface speed cancellation');
    }
  }
  disposeModel(model.root);
});

test('movement 428 analytic carrier velocities and accelerations match finite differences', () => {
  const model = createMovementModel(catalog.movements[427]);
  const { stateAtInputAngle } = model.root.userData;
  const angleStep = 1e-5;

  for (const angle of [0.17, 0.51, 0.94, 1.38, 1.81, 2.26,
    2.73, 3.19, 3.66, 4.14, 4.61, 5.08, 5.54, 6.01]) {
    const state = stateAtInputAngle(angle);
    const timeStep = angleStep / state.inputSpeed;
    const before = stateAtInputAngle(angle - angleStep);
    const after = stateAtInputAngle(angle + angleStep);
    for (let index = 0; index < 3; index += 1) {
      const numericalVelocity = after.rollers[index].center.clone()
        .sub(before.rollers[index].center)
        .multiplyScalar(1 / (2 * timeStep));
      const numericalAcceleration = after.rollers[index].centerVelocity
        .clone().sub(before.rollers[index].centerVelocity)
        .multiplyScalar(1 / (2 * timeStep));
      vectorNear(numericalVelocity, state.rollers[index].centerVelocity,
        3e-10, `roller ${index + 1} velocity at ${angle}`);
      vectorNear(numericalAcceleration,
        state.rollers[index].centerAcceleration,
        5e-10, `roller ${index + 1} acceleration at ${angle}`);
    }
  }
  disposeModel(model.root);
});

test('movement 428 renderer rotates the carrier and roller markers at different rates while liner witnesses only move radially', () => {
  const model = createMovementModel(catalog.movements[427]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const witnessAngles = blocks.materialWitnesses.map((witness) =>
    Math.atan2(witness.position.y, witness.position.x));
  const witnessRotations = blocks.materialWitnesses.map((witness) =>
    witness.rotation.z);

  for (const time of [0, 0.19, 0.47, 0.83, 1.24, 1.69, 2.13,
    2.57, 3.04, 3.48, 3.87]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.rotor.rotation.z, state.carrierAngle, 1.2e-16,
      'carrier update');
    for (let index = 0; index < 3; index += 1) {
      sameAngle(blocks.rollerGroups[index].rotation.z,
        state.rollers[index].localSpinAngle, 1.2e-15,
        `roller ${index + 1} local spin update`);
      sameAngle(blocks.rotor.rotation.z
        + blocks.rollerGroups[index].rotation.z,
      state.rollers[index].worldSpinAngle, 2.5e-15,
      `roller ${index + 1} visible world spin`);
    }
    for (let index = 0; index < blocks.materialWitnesses.length;
      index += 1) {
      const witness = blocks.materialWitnesses[index];
      sameAngle(Math.atan2(witness.position.y, witness.position.x),
        witnessAngles[index], 7e-16,
        `liner witness ${index + 1} fixed material angle`);
      near(witness.rotation.z, witnessRotations[index], 0,
        `liner witness ${index + 1} does not rotate`);
    }
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  near(closure.carrierAngle, source.carrierAngle, 0,
    'carrier full-cycle closure');
  near(closure.rollers[0].worldSpinAngle,
    source.rollers[0].worldSpinAngle, 0,
    'marked roller full-cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 4);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 428 rubber-liner geometry', () => {
  const movement428 = catalog.movements[427];
  const movement507 = catalog.movements[506];
  const model428 = createMovementModel(movement428);
  const model507 = createMovementModel(movement507);

  assert.equal(movement428.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model428.root);
  disposeModel(model507.root);
});
