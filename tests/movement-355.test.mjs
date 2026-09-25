import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
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

test('movement 355 is Brown’s point-supported single-ring gyroscope', () => {
  const movement = catalog.movements[354];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    degreesOfFreedom,
    fidelity,
    mechanism,
    sourceReference,
  } = model.root.userData;

  assert.equal(movement.id, 355);
  assert.equal(movement.number, '355');
  assert.equal(movement.category, 'Governors & flywheels');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype, 'single-support-steady-precession-gyroscope');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /rapid-metallic-disk-C/);
  assert.match(mechanism, /spindle-in-bearings-in-ring-A/);
  assert.match(mechanism, /single-pointed-pintle-F/);
  assert.match(mechanism, /pillar-G/);
  assert.match(mechanism, /torque-divided-by-spin-angular-momentum/);
  assert.match(mechanism, /no-drop-or-nutation/);
  assert.equal(degreesOfFreedom.mechanism, 2);
  assert.match(degreesOfFreedom.input, /rapid rotor spin/);
  assert.match(degreesOfFreedom.output, /gravity-driven precession/);
  assert.match(degreesOfFreedom.output, /zero nutation/);

  assert.equal(blocks.precessionAssembly.parent, model.root);
  assert.equal(blocks.pintle.parent, blocks.precessionAssembly);
  assert.equal(blocks.curvedNeck.parent, blocks.precessionAssembly);
  assert.equal(blocks.ringBody.parent, blocks.precessionAssembly);
  assert.equal(blocks.bearingHousings.length, 2);
  assert.equal(blocks.bearingRims, undefined, 'no dark ink rims outline the bearings');
  blocks.bearingHousings.forEach((bearing) => {
    assert.equal(bearing.parent, blocks.precessionAssembly);
  });
  assert.equal(blocks.spinRotor.parent, blocks.precessionAssembly);
  assert.equal(blocks.diskBody.parent, blocks.spinRotor);
  assert.equal(blocks.spindle.parent, blocks.spinRotor);
  assert.equal(blocks.hub.parent, blocks.spinRotor);
  assert.equal(blocks.rightSpindleKnob.parent, blocks.spinRotor);
  assert.equal(blocks.spinIndexes.length, 4);
  blocks.spinIndexes.forEach((index) => {
    assert.equal(index.parent, blocks.spinRotor);
  });
  assert.equal(blocks.pillar.parent, model.root);
  assert.equal(blocks.supportCup.parent, model.root);

  assert.deepEqual(sourceReference.labels, {
    A: 'horizontal ring carrying both spindle bearings',
    C: 'rapidly spinning metallic disk',
    F: 'single pointed moving pintle at one side of ring A',
    G: 'fixed pillar with a top seat providing the point support',
  });
  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.ok(roles.some((role) => /pointed-pintle-F/.test(role)));
  assert.ok(roles.some((role) => /horizontal-bearing-ring-A/.test(role)));
  assert.ok(roles.some((role) => /metallic-disk-C/.test(role)));
  assert.equal(roles.some((role) => /belt|pulley/.test(role)), false);
  disposeModel(model.root);
});

test('movement 355 records the engraving honestly and invents no source animation', () => {
  const movement = catalog.movements[354];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.brownPlate355;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_355.html');
  assert.match(movement.description, /gyroscope or rotascope/);
  assert.match(movement.description, /preserve their plane of rotation/);
  assert.match(movement.description, /pintle, F/);
  assert.match(movement.description, /pillar, G/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.deepEqual(plate.supportPivotF.toArray(), [109, 206]);
  assert.deepEqual(plate.rotorCenter.toArray(), [291, 205]);
  assert.deepEqual(plate.ringLeft.toArray(), [149, 204]);
  assert.deepEqual(plate.ringRight.toArray(), [452, 207]);
  assert.deepEqual(plate.diskTop.toArray(), [291, 56]);
  assert.deepEqual(plate.diskBottom.toArray(), [291, 345]);
  assert.deepEqual(plate.pillarBase.toArray(), [110, 422]);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 10);
  near(geometry.sourceSupportToCenterPixels, 182, 0,
    'support-to-center raster span');
  near(geometry.sourceRingRadiusPixels, 151.5, 0,
    'ring raster radius');
  near(geometry.sourceDiskRadiusPixels, 144.5, 0,
    'disk raster radius');
  near(geometry.supportToCenter / geometry.sourceScale, 182, 2e-14,
    'scaled support-to-center span');
  near(geometry.ringRadius / geometry.sourceScale, 151.5, 2e-14,
    'scaled ring radius');
  near(geometry.diskRadius / geometry.sourceScale, 144.5, 2e-14,
    'scaled disk radius');
  assert.ok(geometry.diskRadius < geometry.ringRadius,
    'disk C clears its surrounding bearing ring A');
  disposeModel(model.root);
});

test('movement 355 derives spin and precession from one audited mass model', () => {
  const model = createMovementModel(catalog.movements[354]);
  const { animationTiming, dynamics, geometry, transmission } =
    model.root.userData;
  const componentMass = dynamics.physicalComponents.reduce(
    (sum, component) => sum + component.mass,
    0,
  );
  const componentFirstMoment = dynamics.physicalComponents.reduce(
    (sum, component) => sum + component.mass * component.centerOffset,
    0,
  );
  const componentSpinInertia = dynamics.physicalComponents.reduce(
    (sum, component) => sum + component.spinInertia,
    0,
  );

  near(dynamics.totalMovingMass, componentMass, 0,
    'complete moving mass sum');
  near(dynamics.firstMassMoment, componentFirstMoment, 0,
    'complete first mass moment');
  near(dynamics.rotorSpinInertia, componentSpinInertia, 0,
    'rotor-only axial inertia sum');
  near(dynamics.centerOfMassOffset,
    dynamics.firstMassMoment / dynamics.totalMovingMass, 0,
    'center-of-mass offset');
  near(dynamics.gravityTorqueMagnitude,
    dynamics.gravity * dynamics.firstMassMoment, 0,
    'gravity moment about F');
  near(dynamics.spinAngularMomentumMagnitude,
    dynamics.rotorSpinInertia * dynamics.spinAngularSpeed, 0,
    'spin angular momentum');
  near(dynamics.precessionAngularSpeed,
    dynamics.gravityTorqueMagnitude
      / dynamics.spinAngularMomentumMagnitude,
    0,
    'steady precession rate');
  near(dynamics.spinAngularSpeed / dynamics.precessionAngularSpeed,
    dynamics.spinTurnsPerPrecession, 2e-15,
    'integer spin-to-precession ratio');
  assert.equal(dynamics.spinTurnsPerPrecession, 12);
  near(dynamics.precessionCyclePeriod / dynamics.spinCyclePeriod,
    12, 2e-15, 'twelve disk turns per precession circuit');
  near(dynamics.spinKineticEnergy,
    0.5 * dynamics.rotorSpinInertia * dynamics.spinAngularSpeed ** 2,
    0, 'disk spin kinetic energy');
  near(geometry.cyclePeriod, dynamics.precessionCyclePeriod, 0,
    'one animation cycle is one precession circuit');
  near(animationTiming.authoredCyclePeriod,
    dynamics.precessionCyclePeriod, 0,
    'registry selects the physical precession period');
  near(animationTiming.targetCycleDuration, 2, 0,
    'standard display period');
  assert.match(transmission.steadyPrecessionLaw,
    /Omega = tau\/L/);
  assert.match(transmission.steadyPrecessionLaw,
    /M g l.*I_spin omega_spin/);
  disposeModel(model.root);
});

test('movement 355 balances gravity torque with the turning spin momentum', () => {
  const model = createMovementModel(catalog.movements[354]);
  const { dynamics, geometry, stateAtTime } = model.root.userData;

  for (let index = 0; index <= 4096; index += 1) {
    const time = geometry.precessionCyclePeriod * index / 4096;
    const state = stateAtTime(time);
    near(state.spinAxis.length(), 1, 3e-16,
      `unit spin axis ${index}`);
    near(state.precessionTangent.length(), 1, 3e-16,
      `unit precession tangent ${index}`);
    near(state.spinAxis.dot(Y_AXIS), 0, 3e-16,
      `horizontal spin axis ${index}`);
    near(state.ringPlaneNormal.dot(Y_AXIS), 1, 0,
      `horizontal ring A ${index}`);
    near(state.planePreservationError, 0, 3e-16,
      `preserved rotor plane ${index}`);
    near(state.nutationAngle, 0, 0,
      `zero nutation ${index}`);
    near(state.tiltFromVertical, Math.PI / 2, 0,
      `horizontal regular-precession tilt ${index}`);
    near(state.diskCenter.distanceTo(state.supportPivot),
      geometry.supportToCenter, 9e-16,
      `fixed F-to-C distance ${index}`);
    near(state.centerOfMass.distanceTo(state.supportPivot),
      dynamics.centerOfMassOffset, 9e-16,
      `fixed center-of-mass lever ${index}`);
    near(state.centerOfMass.y, geometry.supportPivot.y, 0,
      `no gravitational drop ${index}`);
    near(state.gravityTorque.length(), dynamics.gravityTorqueMagnitude,
      5e-14, `gravity torque magnitude ${index}`);
    near(state.spinAngularMomentum.length(),
      dynamics.spinAngularMomentumMagnitude, 3e-14,
      `spin momentum magnitude ${index}`);
    vectorNear(state.spinAngularMomentumRate, state.gravityTorque,
      5e-14, `vector torque balance ${index}`);
    near(state.gyroscopicBalanceError.length(), 0, 5e-14,
      `gyroscopic residual ${index}`);
    near(state.torqueAngularMomentumOrthogonality, 0, 2e-12,
      `torque perpendicular to spin momentum ${index}`);
    near(state.bearingAxisError, 0, 2e-15,
      `two spindle bearings coaxial ${index}`);
    near(state.centerVelocity.dot(state.spinAxis), 0, 2e-15,
      `precession velocity tangent to orbit ${index}`);
    near(state.centerAcceleration.clone().cross(state.spinAxis).length(),
      0, 3e-15, `centripetal acceleration is radial ${index}`);
  }
  disposeModel(model.root);
});

test('movement 355 precession direction and inverse-spin law are correct', () => {
  const model = createMovementModel(catalog.movements[354]);
  const data = model.root.userData;
  const { dynamics, steadyPrecessionRateForSpin, transmission } = data;
  const spin = dynamics.spinAngularSpeed;
  const precession = dynamics.precessionAngularSpeed;

  near(steadyPrecessionRateForSpin(spin), precession, 0,
    'configured positive-spin precession');
  near(steadyPrecessionRateForSpin(-spin), -precession, 0,
    'reversed spin reverses precession');
  near(steadyPrecessionRateForSpin(spin * 2), precession / 2, 0,
    'doubling spin halves steady precession');
  near(steadyPrecessionRateForSpin(spin / 2), precession * 2, 0,
    'halving spin doubles steady precession');
  assert.equal(steadyPrecessionRateForSpin(0), Number.POSITIVE_INFINITY);

  const source = data.stateAtTime(0);
  const expectedTangent = Y_AXIS.clone().cross(source.spinAxis).normalize();
  vectorNear(source.precessionTangent, expectedTangent, 0,
    'positive precession tangent');
  vectorNear(
    source.gravityLeverArm.clone().cross(source.gravityForce),
    source.gravityTorque,
    0,
    'right-hand gravity torque direction',
  );
  vectorNear(
    Y_AXIS.clone().multiplyScalar(precession)
      .cross(source.spinAngularMomentum),
    source.gravityTorque,
    0,
    'right-hand angular-momentum turning direction',
  );
  assert.match(transmission.angularMomentumDirection,
    /from support F through disk C/);
  assert.match(transmission.precessionDirection,
    /reversing spin reverses precession/);
  disposeModel(model.root);
});

test('movement 355 renderer keeps the ring level and both bearings on the spin axis', () => {
  const model = createMovementModel(catalog.movements[354]);
  const data = model.root.userData;
  const { blocks, contacts, geometry } = data;

  for (const fraction of [0, 0.125, 0.25, 0.5, 0.75, 0.999]) {
    const time = fraction * geometry.precessionCyclePeriod;
    const state = data.stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);

    near(blocks.precessionAssembly.rotation.y,
      state.precessionAngle, 2e-15,
      `rendered precession angle ${fraction}`);
    near(blocks.spinRotor.rotation.x, state.diskSpinAngle, 2e-14,
      `rendered disk spin ${fraction}`);
    vectorNear(
      blocks.precessionAssembly.getWorldPosition(new THREE.Vector3()),
      state.supportPivot,
      0,
      `fixed point support ${fraction}`,
    );
    vectorNear(
      blocks.spinRotor.getWorldPosition(new THREE.Vector3()),
      state.diskCenter,
      2e-15,
      `rendered disk center ${fraction}`,
    );
    vectorNear(
      blocks.ringBody.getWorldPosition(new THREE.Vector3()),
      state.diskCenter,
      2e-15,
      `ring centered on disk ${fraction}`,
    );
    blocks.bearingHousings.forEach((bearing, index) => {
      vectorNear(
        bearing.getWorldPosition(new THREE.Vector3()),
        state.bearingCenters[index],
        2e-15,
        `rendered spindle bearing ${index} ${fraction}`,
      );
    });
    vectorNear(contacts.pintlePointSupport.contactPoint,
      state.supportPivot, 0, `reported point support ${fraction}`);
    vectorNear(contacts.rotorBearings.axis, state.spinAxis, 0,
      `reported bearing axis ${fraction}`);
    near(contacts.rotorBearings.axisError, 0, 2e-15,
      `reported bearing coaxiality ${fraction}`);
    assert.equal(contacts.rotorBearings.centers.length, 2);
  }

  assert.ok(blocks.spinIndexes.some((object) => object.isMesh),
    'asymmetric disk indexes make the rapid spin visible');
  assert.ok(blocks.ringIndex.isMesh,
    'the ring has a separate precession index');
  let meshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  assert.ok(meshCount >= 22); // ink rims and face lines are gone
  disposeModel(model.root);
});

test('movement 355 closes one precession circuit and leaves 364 authored', () => {
  const model = createMovementModel(catalog.movements[354]);
  const data = model.root.userData;
  const start = data.stateAtTime(0);
  const finish = data.stateAtTime(data.geometry.precessionCyclePeriod);
  near(finish.precessionAngle - start.precessionAngle,
    Math.PI * 2, 9e-16, 'one precession turn');
  near(finish.diskSpinAngle - start.diskSpinAngle,
    Math.PI * 2 * 12, 2e-14, 'twelve disk turns');
  near(finish.precessionTurns, 1, 0, 'precession turn count');
  near(finish.diskSpinTurns, 12, 0, 'disk turn count');
  vectorNear(finish.spinAxis, start.spinAxis, 9e-16,
    'spin-axis closure');
  vectorNear(finish.diskCenter, start.diskCenter, 2e-15,
    'disk-center closure');
  vectorNear(finish.gravityTorque, start.gravityTorque, 9e-14,
    'gravity-torque closure');
  vectorNear(finish.spinAngularMomentum, start.spinAngularMomentum, 9e-14,
    'spin-momentum closure');

  model.update(0);
  model.root.updateMatrixWorld(true);
  const startIndexPositions = data.blocks.spinIndexes.map((index) => (
    index.getWorldPosition(new THREE.Vector3())
  ));
  model.update(data.geometry.precessionCyclePeriod);
  model.root.updateMatrixWorld(true);
  data.blocks.spinIndexes.forEach((index, indexNumber) => {
    vectorNear(index.getWorldPosition(new THREE.Vector3()),
      startIndexPositions[indexNumber], 3e-14,
      `rendered spin-index closure ${indexNumber}`);
  });

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
