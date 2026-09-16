import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
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

test('movement 357 is Anderson’s crown-driven gyroscope governor', () => {
  const movement = catalog.movements[356];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 357);
  assert.equal(movement.number, '357');
  assert.equal(movement.category, 'Universal joints');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(movement.archetype,
    'anderson-gyroscope-spring-governor');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /revolving-frame-H/);
  assert.match(data.mechanism, /pinion-I-around-stationary-toothed-circle-G/);
  assert.match(data.mechanism, /heavy-wheel-A-through-one-universal-joint/);
  assert.match(data.mechanism, /piece-B-hinges-in-H/);
  assert.match(data.mechanism, /spring-L/);
  assert.match(data.mechanism, /valve-rod-D/);

  assert.equal(degreesOfFreedom.mechanism, 2);
  assert.match(degreesOfFreedom.input, /engine rotation/);
  assert.match(degreesOfFreedom.spin, /pinion I rolling/);
  assert.match(degreesOfFreedom.output, /spring-balanced tilt/);

  assert.equal(blocks.crownGear.parent, model.root);
  assert.equal(blocks.carrierGroup.parent, model.root);
  assert.equal(blocks.pinion.parent, blocks.carrierGroup);
  assert.equal(blocks.inputRotor.parent, blocks.carrierGroup);
  assert.equal(blocks.tiltGroup.parent, blocks.carrierGroup);
  assert.equal(blocks.outputRotor.parent, blocks.tiltGroup);
  assert.equal(blocks.rotorDisk.parent, blocks.outputRotor);
  assert.equal(blocks.outputBearingCollar.parent, blocks.tiltGroup);
  assert.equal(blocks.cardanSpider.parent, blocks.carrierGroup);
  assert.equal(blocks.connectingForkC.length, 2);
  blocks.connectingForkC.forEach((rod) => {
    assert.equal(rod.parent, blocks.carrierGroup);
  });
  assert.equal(blocks.rotatingSwivel.parent, blocks.carrierGroup);
  assert.equal(blocks.valveRodD.parent, model.root);
  assert.equal(blocks.springL.parent, model.root);
  assert.equal(blocks.rodP.parent, model.root);
  assert.equal(blocks.hingeBearings.length, 2);
  assert.equal(blocks.hingePins.length, 2);
  assert.equal(blocks.inputYokeEyes.length, 2);
  assert.equal(blocks.outputYokeEyes.length, 2);
  assert.equal(blocks.rotorFaceIndexes.length, 2);
  assert.equal(blocks.crownGear.userData.toothMeshes.length, 60);
  assert.equal(blocks.pinion.userData.teeth, 12);

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  for (const role of [
    'stationary-toothed-circle-G-body',
    'orbiting-bevel-pinion-I',
    'shaft-B1-between-pinion-I-and-universal-joint',
    'cross-spider-of-single-universal-joint-between-B1-and-B',
    'heavy-gyroscope-wheel-A',
    'revolving-frame-H',
    'nonrotating-vertically-moving-valve-rod-D',
    'spring-L-opposing-gyroscope-rise',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 357 records both historical engravings without inventing timing', () => {
  const movement = catalog.movements[356];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.brownPlate357;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_357.html');
  assert.match(movement.description, /patented by Alban Anderson in 1858/);
  assert.match(movement.description, /axle, B, B1/);
  assert.match(movement.description, /universal joint/);
  assert.match(movement.description, /stationary toothed circle, G/);
  assert.match(movement.description, /tendency of the wheel, A, is to assume a vertical position/);
  assert.match(movement.description, /opposed by a spring, L/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 12);
  assert.deepEqual(plate.ringCenterG.toArray(), [270, 258]);
  assert.deepEqual(plate.ringLeftG.toArray(), [48, 226]);
  assert.deepEqual(plate.ringRightG.toArray(), [487, 252]);
  assert.deepEqual(plate.pinionCenterI.toArray(), [89, 217]);
  assert.deepEqual(plate.universalJointBB1.toArray(), [194, 210]);
  assert.deepEqual(plate.rotorHinge.toArray(), [272, 226]);
  assert.deepEqual(plate.outputBearing.toArray(), [349, 240]);
  assert.deepEqual(plate.diskTop.toArray(), [282, 119]);
  assert.deepEqual(plate.diskBottom.toArray(), [247, 323]);
  assert.deepEqual(plate.valveSwivelD.toArray(), [278, 92]);
  assert.deepEqual(plate.springTopL.toArray(), [66, 53]);
  assert.deepEqual(plate.springBottomL.toArray(), [49, 318]);
  assert.deepEqual(plate.driveAxis.toArray(), [283, 437]);
  assert.deepEqual(plate.floor.toArray(), [271, 513]);

  assert.equal(sourceReference.contemporaryDetail.publication,
    'Scientific American, New Series, volume III, number 13');
  assert.equal(sourceReference.contemporaryDetail.publicationDate,
    '1860-09-22');
  assert.match(sourceReference.contemporaryDetail.title,
    /Improved Gyrascope Steam Engine Governor/);
  assert.match(sourceReference.contemporaryDetail.use,
    /fixed crown ring/);
  assert.match(sourceReference.contemporaryDetail.use,
    /lower bevel input/);
  assert.deepEqual(sourceReference.labels, {
    A: 'heavy gyroscope wheel or disk',
    B: 'tilting wheel axle hinged at its middle to revolving frame H',
    B1: 'pinion axle joined to B by a universal joint',
    C: 'paired rotating rods from axle B to the valve-rod swivel',
    D: 'nonrotating vertically moving valve rod',
    G: 'stationary toothed circle',
    H: 'revolving frame driven by the engine bevel gears',
    I: 'pinion carried around stationary circle G',
    L: 'spring opposing the wheel’s tendency to rise',
    N: 'spring lever',
    P: 'rod connecting lever N to valve rod D',
  });
  disposeModel(model.root);
});

test('movement 357 rolls pinion I exactly around stationary circle G', () => {
  const model = createMovementModel(catalog.movements[356]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;
  const ratio = geometry.crownTeeth / geometry.pinionTeeth;

  near(ratio, 5, 0, 'tooth-count ratio');
  near(geometry.crownPitchRadius / geometry.pinionPitchRadius,
    ratio, 0, 'pitch-radius ratio');
  assert.match(transmission.crownMesh,
    /omega_I\/Omega_H = teeth_G\/teeth_I/);

  for (let index = 0; index <= 4096; index += 1) {
    const time = geometry.cyclePeriod * index / 4096;
    const state = stateAtTime(time);
    near(state.inputAngularSpeed / state.carrierAngularSpeed,
      ratio, 2e-15, `pinion speed ratio ${index}`);
    near(state.crownContactPoint.clone().sub(state.carrierOrigin).length(),
      geometry.crownPitchRadius, 2e-15,
      `stationary crown pitch radius ${index}`);
    near(state.crownContactPoint.distanceTo(state.pinionCenter),
      geometry.pinionPitchRadius, 2e-15,
      `pinion pitch radius ${index}`);
    near(state.inputAxis.dot(
      state.crownContactPoint.clone().sub(state.pinionCenter)),
    0, 8e-16, `pinion radial contact is normal to shaft ${index}`);
    vectorNear(state.pinionContactVelocity, new THREE.Vector3(),
      5e-15, `zero fixed-ring slip ${index}`);
  }

  const differenceStep = 1e-6;
  for (const fraction of [0.04, 0.17, 0.32, 0.54, 0.69, 0.91]) {
    const time = fraction * geometry.cyclePeriod;
    const previous = stateAtTime(time - differenceStep);
    const next = stateAtTime(time + differenceStep);
    const state = stateAtTime(time);
    near((next.carrierAngle - previous.carrierAngle)
      / (2 * differenceStep), state.carrierAngularSpeed, 2e-9,
    `carrier-angle derivative ${fraction}`);
    near((next.inputAngle - previous.inputAngle)
      / (2 * differenceStep), state.inputAngularSpeed, 9e-9,
    `pinion-angle derivative ${fraction}`);
  }

  for (const fraction of [0, 0.11, 0.37, 0.73, 0.999]) {
    const time = fraction * geometry.cyclePeriod;
    model.update(time);
    near(data.contacts.crownGearMesh.velocityError, 0, 2e-15,
      `reported crown rolling ${fraction}`);
    near(data.contacts.engineBevelMesh.ratioError, 0, 0,
      `lower bevel ratio ${fraction}`);
    near(data.contacts.engineBevelMesh.velocityError, 0, 4e-16,
      `lower bevel rolling ${fraction}`);
  }
  disposeModel(model.root);
});

test('movement 357 transmits spin through one exact variable-angle Cardan joint', () => {
  const model = createMovementModel(catalog.movements[356]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;
  let minimumInstantaneousRatio = Infinity;
  let maximumInstantaneousRatio = -Infinity;

  assert.match(transmission.cardanLaw, /single Hooke joint/);
  assert.match(transmission.cardanLaw, /twice-per-turn velocity ripple/);
  for (let index = 0; index <= 8192; index += 1) {
    const state = stateAtTime(geometry.cyclePeriod * index / 8192);
    near(state.inputAxis.length(), 1, 3e-16,
      `unit B1 axis ${index}`);
    near(state.outputAxis.length(), 1, 3e-16,
      `unit B axis ${index}`);
    near(state.hingeAxis.length(), 1, 3e-16,
      `unit B hinge axis ${index}`);
    near(state.inputAxis.dot(state.outputAxis),
      Math.cos(state.tiltAngle), 5e-16,
      `shaft included angle ${index}`);
    near(state.hingeAxis.dot(state.inputAxis), 0, 4e-16,
      `hinge normal to input shaft ${index}`);
    near(state.hingeAxis.dot(state.outputAxis), 0, 4e-16,
      `hinge normal to output shaft ${index}`);
    near(state.inputTrunnionAxis.dot(state.inputAxis), 0, 5e-16,
      `input trunnion in B1 yoke ${index}`);
    near(state.outputTrunnionAxis.dot(state.outputAxis), 0, 5e-16,
      `output trunnion in B yoke ${index}`);
    near(state.inputTrunnionAxis.dot(state.outputTrunnionAxis),
      0, 6e-16, `perpendicular spider trunnions ${index}`);
    near(state.trunnionOrthogonalityError, 0, 6e-16,
      `reported spider orthogonality ${index}`);

    const cardanEquation = Math.sin(state.outputAngle)
      * Math.cos(state.inputAngle)
      - Math.cos(state.tiltAngle)
        * Math.cos(state.outputAngle)
        * Math.sin(state.inputAngle);
    near(cardanEquation, 0, 7e-15,
      `Hooke-joint phase equation ${index}`);
    const instantaneousRatio =
      state.outputAngularSpeed / state.inputAngularSpeed;
    minimumInstantaneousRatio = Math.min(
      minimumInstantaneousRatio,
      instantaneousRatio,
    );
    maximumInstantaneousRatio = Math.max(
      maximumInstantaneousRatio,
      instantaneousRatio,
    );
  }
  assert.ok(maximumInstantaneousRatio - minimumInstantaneousRatio > 0.2,
    'one Cardan joint retains its real angular-speed ripple');

  const differenceStep = 1e-6;
  for (const fraction of [0.03, 0.12, 0.27, 0.41, 0.59, 0.73, 0.92]) {
    const time = fraction * geometry.cyclePeriod;
    const previous = stateAtTime(time - differenceStep);
    const next = stateAtTime(time + differenceStep);
    const state = stateAtTime(time);
    near((next.tiltAngle - previous.tiltAngle)
      / (2 * differenceStep), state.tiltAngularSpeed, 2e-9,
    `tilt-angle derivative ${fraction}`);
    near((next.outputAngle - previous.outputAngle)
      / (2 * differenceStep), state.outputAngularSpeed, 6e-9,
    `Cardan output derivative ${fraction}`);
  }
  disposeModel(model.root);
});

test('movement 357 balances speed-squared gyroscopic torque against spring L', () => {
  const model = createMovementModel(catalog.movements[356]);
  const data = model.root.userData;
  const { dynamics, geometry, stateAtTime, transmission } = data;
  const nominal = dynamics.equilibriumTiltAtCarrierSpeed(
    geometry.meanCarrierAngularSpeed,
  );
  const slowSpeed = geometry.meanCarrierAngularSpeed
    - geometry.carrierSpeedAmplitude;
  const fastSpeed = geometry.meanCarrierAngularSpeed
    + geometry.carrierSpeedAmplitude;
  const slowTilt = dynamics.equilibriumTiltAtCarrierSpeed(slowSpeed);
  const fastTilt = dynamics.equilibriumTiltAtCarrierSpeed(fastSpeed);

  near(dynamics.rotorSpinInertia,
    0.5 * dynamics.rotorMass * geometry.rotorRadius ** 2,
    0, 'solid-disk polar inertia');
  near(nominal, geometry.nominalTiltAngle, 2e-16,
    'spring calibrated at nominal speed');
  assert.ok(slowTilt < nominal);
  assert.ok(nominal < fastTilt);
  assert.ok(slowTilt > geometry.restTiltAngle);
  assert.ok(fastTilt < geometry.maximumTiltAngle);
  near(dynamics.gyroscopicTorqueAt(
    geometry.meanCarrierAngularSpeed * 2,
    geometry.nominalTiltAngle,
  ), 4 * dynamics.gyroscopicTorqueAt(
    geometry.meanCarrierAngularSpeed,
    geometry.nominalTiltAngle,
  ), 2e-13, 'gyroscopic moment follows engine speed squared');
  assert.match(transmission.governorBalance,
    /I_spin\*\(5 Omega_H\)\*Omega_H\*cos\(tilt\)/);
  assert.match(transmission.governorBalance, /virtual work/);

  for (let index = 0; index <= 4096; index += 1) {
    const state = stateAtTime(geometry.cyclePeriod * index / 4096);
    near(state.equilibriumError, 0, 1.2e-13,
      `spring/gyroscope balance ${index}`);
    near(state.springTorque, state.gyroscopicTorque, 1.2e-13,
      `equal opposing moments ${index}`);
    near(state.springTorque,
      state.effectiveSpringForce
        * state.outputGeometry.swivelRatePerTilt,
    4e-14, `virtual-work spring moment ${index}`);
    near(state.meanRotorSpinAngularSpeed,
      geometry.crownTeeth / geometry.pinionTeeth
        * state.carrierAngularSpeed,
    2e-15, `cycle-mean rotor spin ${index}`);
    near(state.valveRodTravel,
      state.outputGeometry.swivelY
        - geometry.nominalOutputGeometry.swivelY,
    0, `valve travel ${index}`);
  }

  const fast = stateAtTime(geometry.cyclePeriod / 4);
  const nominalState = stateAtTime(0);
  const slow = stateAtTime(geometry.cyclePeriod * 3 / 4);
  assert.ok(fast.carrierAngularSpeed > nominalState.carrierAngularSpeed);
  assert.ok(nominalState.carrierAngularSpeed > slow.carrierAngularSpeed);
  assert.ok(fast.tiltAngle > nominalState.tiltAngle);
  assert.ok(nominalState.tiltAngle > slow.tiltAngle);
  assert.ok(fast.valveRodTravel > nominalState.valveRodTravel);
  assert.ok(nominalState.valveRodTravel > slow.valveRodTravel);
  disposeModel(model.root);
});

test('movement 357 renderer closes every rotating and stationary linkage', () => {
  const model = createMovementModel(catalog.movements[356]);
  const data = model.root.userData;
  const { blocks, geometry } = data;

  for (const fraction of [0, 0.07, 0.19, 0.34, 0.51, 0.72, 0.91, 0.999]) {
    const time = fraction * geometry.cyclePeriod;
    const state = data.stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);

    near(blocks.carrierGroup.rotation.y, state.carrierAngle, 2e-15,
      `rendered frame-H angle ${fraction}`);
    near(blocks.inputRotor.rotation.x, state.inputAngle, 2e-14,
      `rendered B1 angle ${fraction}`);
    near(blocks.tiltGroup.rotation.z, state.tiltAngle, 0,
      `rendered B tilt ${fraction}`);
    near(blocks.outputRotor.rotation.x, state.outputAngle, 2e-14,
      `rendered wheel-A angle ${fraction}`);
    near(blocks.pinion.userData.rotor.rotation.z,
      state.inputAngle, 2e-14, `rendered pinion-I spin ${fraction}`);
    near(blocks.carrierDriveGear.userData.rotor.rotation.z, 0, 0,
      `carrier bevel rigid with H ${fraction}`);
    near(blocks.engineInputRotor.rotation.z,
      state.engineInputAngle, 2e-15,
      `rendered engine shaft spin ${fraction}`);

    vectorNear(blocks.pinion.getWorldPosition(new THREE.Vector3()),
      state.pinionCenter, 2e-15, `rendered pinion center ${fraction}`);
    vectorNear(blocks.cardanSpider.getWorldPosition(new THREE.Vector3()),
      state.jointCenter, 2e-15, `rendered Cardan center ${fraction}`);
    vectorNear(blocks.rotorDisk.getWorldPosition(new THREE.Vector3()),
      state.rotorCenter, 2e-15, `rendered disk center ${fraction}`);
    vectorNear(
      blocks.outputBearingCollar.getWorldPosition(new THREE.Vector3()),
      state.outputBearingCenter,
      2e-15,
      `rendered outer B bearing ${fraction}`,
    );
    vectorNear(blocks.rotatingSwivel.getWorldPosition(new THREE.Vector3()),
      state.valveSwivelCenter, 2e-15,
      `rotating half of C-D swivel ${fraction}`);
    vectorNear(blocks.fixedSwivelRace.getWorldPosition(new THREE.Vector3()),
      state.valveSwivelCenter, 2e-15,
      `stationary half of C-D swivel ${fraction}`);
    near(blocks.valveRodD.getWorldPosition(new THREE.Vector3()).y,
      (state.valveRodBottomY + state.valveRodTopY) / 2,
    2e-15, `rendered valve rod D ${fraction}`);

    blocks.inputYokeEyes.forEach((eye, index) => {
      vectorNear(eye.getWorldPosition(new THREE.Vector3()),
        state.inputBearingCenters[index], 2e-15,
        `input-yoke bearing ${index} ${fraction}`);
    });
    blocks.outputYokeEyes.forEach((eye, index) => {
      vectorNear(eye.getWorldPosition(new THREE.Vector3()),
        state.outputBearingCenters[index], 2e-15,
        `output-yoke bearing ${index} ${fraction}`);
    });
    state.connectingRodEndpointsLocal.forEach(({ start, end }, index) => {
      vectorNear(blocks.connectingForkC[index].children[1].position,
        start, 0, `rod-C start ${index} ${fraction}`);
      vectorNear(blocks.connectingForkC[index].children[2].position,
        end, 0, `rod-C end ${index} ${fraction}`);
      near(start.distanceTo(end), geometry.outputLinkLength, 5e-16,
        `rod-C length ${index} ${fraction}`);
    });
    near(state.leverConnection.distanceTo(state.valveRodPin),
      geometry.rodPLength, 5e-16, `rod-P length ${fraction}`);
    near(state.rodPLengthError, 0, 5e-16,
      `reported rod-P closure ${fraction}`);
    vectorNear(blocks.springL.position, geometry.springLowerAnchor,
      0, `spring-L fixed anchor ${fraction}`);
    near(blocks.springL.children[0].geometry.parameters.path.getPoint(1).distanceTo(
      blocks.springL.children[0].geometry.parameters.path.getPoint(0)), state.springVisualLength, 2e-15,
      `rendered spring-L length ${fraction}`);
    near(data.contacts.universalJoint.centerError, 0, 2e-15,
      `reported Cardan center ${fraction}`);
    near(data.contacts.universalJoint.trunnionOrthogonalityError,
      0, 6e-16, `reported Cardan cross ${fraction}`);
    data.contacts.outputFork.lengthErrors.forEach((error, index) => {
      near(error, 0, 5e-16,
        `reported rod-C ${index} ${fraction}`);
    });
  }

  let meshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  assert.equal(meshCount, 204); // Conical bodies, open hinge support and lower frame struts.
  disposeModel(model.root);
});

test('movement 357 closes two carrier turns and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[356]);
  const data = model.root.userData;
  const { animationTiming, geometry } = data;
  const start = data.stateAtTime(0);
  const finish = data.stateAtTime(geometry.cyclePeriod);

  near(animationTiming.authoredCyclePeriod, 8, 0,
    'eight-second governor demonstration');
  near(animationTiming.targetCycleDuration, 2, 0,
    'standard display cycle');
  assertReadableTiming(animationTiming);
  near(finish.cycleCoordinate - start.cycleCoordinate, 1, 0,
    'one speed sweep');
  near(finish.carrierAngle - start.carrierAngle,
    Math.PI * 4, 2e-15, 'two frame-H turns');
  near(finish.inputAngle - start.inputAngle,
    Math.PI * 20, 2e-14, 'ten pinion-I turns');
  near(finish.outputAngle - start.outputAngle,
    Math.PI * 20, 2e-14, 'ten wheel-A turns');
  near(finish.carrierAngularSpeed, start.carrierAngularSpeed,
    3e-16, 'carrier speed closure');
  near(finish.tiltAngle, start.tiltAngle, 3e-16,
    'governor tilt closure');
  near(finish.tiltAngularSpeed, start.tiltAngularSpeed, 3e-16,
    'governor tilt-rate closure');
  near(finish.valveRodTravel, start.valveRodTravel, 5e-16,
    'valve-rod closure');
  vectorNear(finish.outputAxis, start.outputAxis, 2e-15,
    'wheel-axis closure');
  vectorNear(finish.valveSwivelCenter, start.valveSwivelCenter,
    5e-16, 'C-D swivel closure');

  model.update(0);
  model.root.updateMatrixWorld(true);
  const startIndexes = [
    ...data.blocks.rotorFaceIndexes,
    data.blocks.rotorIndexBead,
    data.blocks.inputShaftIndex,
  ].map((index) => index.getWorldPosition(new THREE.Vector3()));
  model.update(geometry.cyclePeriod);
  model.root.updateMatrixWorld(true);
  [
    ...data.blocks.rotorFaceIndexes,
    data.blocks.rotorIndexBead,
    data.blocks.inputShaftIndex,
  ].forEach((index, indexNumber) => {
    vectorNear(index.getWorldPosition(new THREE.Vector3()),
      startIndexes[indexNumber], 2e-14,
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
