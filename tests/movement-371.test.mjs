import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
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

function angleNear(actual, expected, tolerance, message) {
  const error = THREE.MathUtils.euclideanModulo(
    actual - expected + Math.PI,
    FULL_TURN,
  ) - Math.PI;
  near(error, 0, tolerance, message);
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

test('movement 371 contains one open four-spoke wheel, opposed face teeth, one radial pinion, and a mobile transfer carrier', () => {
  const movement = catalog.movements[370];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 371);
  assert.equal(movement.number, '371');
  assert.equal(movement.category, 'Rack & pinion');
  assert.equal(
    movement.archetype,
    'dual-face-gap-transfer-mangle-wheel',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /uniform-radial-pinion/);
  assert.match(data.mechanism, /front-face-tooth-row/);
  assert.match(data.mechanism, /rear-face/);
  assert.match(data.mechanism, /left-opening/);
  assert.match(data.mechanism, /alternating-wheel-rotation/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.input, /uniformly increasing angle/);
  assert.match(degreesOfFreedom.note, /exact dependent coordinates/);

  assert.equal(blocks.frontFaceTeeth.length,
    geometry.mainToothIntervals + 1);
  assert.equal(blocks.rearFaceTeeth.length,
    geometry.mainToothIntervals + 1);
  assert.equal(blocks.terminalPairs.length, 2);
  assert.equal(blocks.guideRails.length, 2);
  assert.equal(blocks.guideCrossbars.length, 2);
  assert.equal(blocks.wheelWeb.userData.lobeCount, 4);
  for (const component of [
    blocks.outputRotor,
    blocks.pinionCarrier,
    blocks.base,
    blocks.bearingPost,
    blocks.fixedBearing,
    blocks.frontContactMarker,
    blocks.rearContactMarker,
    blocks.terminalContactMarker,
    ...blocks.guideRails,
    ...blocks.guideCrossbars,
  ]) assert.equal(component.parent, model.root);
  for (const component of [
    blocks.wheelBody,
    blocks.wheelWeb,
    blocks.wheelHub,
    blocks.hubFace,
    blocks.outputShaft,
    blocks.outputIndex,
    ...blocks.frontFaceTeeth,
    ...blocks.rearFaceTeeth,
  ]) assert.equal(component.parent, blocks.outputRotor);
  for (const component of [
    blocks.pinion,
    blocks.inputShaftRotor,
    blocks.carrierCollar,
    blocks.carrierBridge,
  ]) assert.equal(component.parent, blocks.pinionCarrier);
  assert.equal(blocks.inputShaft.parent, blocks.inputShaftRotor);
  assert.equal(blocks.shaftIndex.parent, blocks.inputShaftRotor);
  assert.equal(blocks.pinion.userData.teeth, geometry.pinionTeeth);
  assert.equal(blocks.pinion.userData.axis.distanceTo(X_AXIS), 0);

  const roles = [];
  const belts = [];
  const racks = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt || object.userData.mechanismBelt
      || object.userData.selectorBelt) belts.push(object);
    if (object.userData.isRack || object.userData.rack) racks.push(object);
  });
  for (const role of [
    'open-annular-body-carrying-two-opposed-face-tooth-rows',
    'four-broad-spoke-web-of-open-mangle-wheel',
    'front-face-radial-tooth-of-mangle-wheel',
    'rear-face-radial-tooth-of-mangle-wheel',
    'front-face-terminal-tooth-for-pinion-crossover',
    'rear-face-terminal-tooth-for-pinion-crossover',
    'uniformly-rotating-radial-axis-pinion-working-on-both-wheel-faces',
    'front-rear-and-radially-mobile-uniform-pinion-carrier',
    'white-input-shaft-index-proving-uniform-spin',
    'white-output-index-making-alternating-wheel-angle-legible',
  ]) assert.ok(roles.includes(role), role);
  assert.equal(belts.length, 0);
  assert.equal(racks.length, 0);
  disposeModel(model.root);
});

test('movement 371 records Brown\'s two-face topology, unavailable animation, and measured engraving', () => {
  const movement = catalog.movements[370];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate371;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_371.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /large wheel is toothed on both faces/);
  assert.match(movement.description, /alternating circular motion/);
  assert.match(movement.description, /uniform revolution of the pinion/);
  assert.match(movement.description, /passes from one side.*to the other/);
  assert.match(movement.description, /opening on the left/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(
    data.dynamics.sourceSpecifiesDimensionsTimingBacklashOrCarrierGuide,
    false,
  );
  assert.equal(data.dynamics.idealizations.length, 4);
  assert.match(data.dynamics.treatment, /no dimensions/);
  assert.match(data.dynamics.treatment, /exact no-slip pitch contact/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.wheelCenter.toArray(), [289, 253]);
  assert.deepEqual(plate.outerRimTop.toArray(), [289, 50]);
  assert.deepEqual(plate.outerRimRight.toArray(), [493, 253]);
  assert.deepEqual(plate.outerRimBottom.toArray(), [289, 456]);
  assert.deepEqual(plate.openingUpperEndpoint.toArray(), [99, 218]);
  assert.deepEqual(plate.openingLowerEndpoint.toArray(), [136, 382]);
  assert.deepEqual(plate.pinionCenter.toArray(), [102, 253]);
  assert.deepEqual(plate.shaftLeftEnd.toArray(), [14, 253]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence, /four-broad-spoke/);
  assert.match(evidence.engravingEvidence, /interrupted only at the left/);
  assert.match(evidence.engravingEvidence, /edge-on pinion/);
  assert.match(evidence.reconstructionDisclosure, /48-position wheel/);
  assert.match(evidence.reconstructionDisclosure, /median pitch plane/);
  assert.match(evidence.reconstructionDisclosure, /no canvas animation/);
  disposeModel(model.root);
});

test('movement 371 uses one common module and exactly omits eight pitch intervals at the left opening on both faces', () => {
  const model = createMovementModel(catalog.movements[370]);
  const { blocks, geometry } = model.root.userData;

  near(
    2 * geometry.wheelPitchRadius / geometry.wheelPositionCount,
    geometry.module,
    0,
    'wheel module',
  );
  near(
    2 * geometry.pinionPitchRadius / geometry.pinionTeeth,
    geometry.module,
    0,
    'pinion module',
  );
  near(
    geometry.wheelAngularPitch * geometry.wheelPitchRadius,
    geometry.circularPitch,
    3e-17,
    'wheel circular pitch',
  );
  near(
    geometry.pinionAngularPitch * geometry.pinionPitchRadius,
    geometry.circularPitch,
    3e-17,
    'pinion circular pitch',
  );
  near(
    geometry.pinionPitchRadius / geometry.wheelPitchRadius,
    geometry.pinionTeeth / geometry.wheelPositionCount,
    0,
    'pitch-radius ratio equals tooth-count ratio',
  );
  assert.equal(
    geometry.mainToothIntervals + geometry.openingIntervals,
    geometry.wheelPositionCount,
  );
  near(
    geometry.openingAngle,
    geometry.openingIntervals * geometry.wheelAngularPitch,
    0,
    'opening spans exactly eight pitches',
  );
  near(
    geometry.mainArcSweep,
    geometry.mainToothIntervals * geometry.wheelAngularPitch,
    0,
    'toothed arc spans remaining pitches',
  );
  assert.ok(geometry.openingRadialClearance > 0.4,
    'pinion pitch body fits through opening');
  assert.equal(blocks.wheelBody.userData.openingPreserved, true);
  near(blocks.wheelBody.userData.startAngle,
    geometry.firstTerminalAngle, 0, 'open rim starts at first terminal');
  near(blocks.wheelBody.userData.sweep,
    geometry.mainArcSweep, 0, 'open rim follows toothed arc');

  for (let index = 0; index <= geometry.mainToothIntervals; index += 1) {
    const front = blocks.frontFaceTeeth[index];
    const rear = blocks.rearFaceTeeth[index];
    const expectedAngle = geometry.firstTerminalAngle
      + index * geometry.wheelAngularPitch;
    assert.equal(front.userData.face, 'front');
    assert.equal(rear.userData.face, 'rear');
    assert.equal(front.userData.index, index);
    assert.equal(rear.userData.index, index);
    near(front.userData.nominalAngle, expectedAngle, 0,
      `front tooth ${index} pitch angle`);
    near(rear.userData.nominalAngle, expectedAngle, 0,
      `rear tooth ${index} pitch angle`);
    near(front.position.z, geometry.faceToothOffset, 0,
      `front tooth ${index} lies on front face`);
    near(rear.position.z, -geometry.faceToothOffset, 0,
      `rear tooth ${index} lies on rear face`);
    near(Math.hypot(front.position.x, front.position.y),
      geometry.toothCenterRadius, 5e-16,
      `front tooth ${index} radial station`);
    vectorNear(
      new THREE.Vector3(front.position.x, front.position.y, 0),
      new THREE.Vector3(rear.position.x, rear.position.y, 0),
      0,
      `face tooth pair ${index} is aligned`,
    );
  }
  for (const pair of blocks.terminalPairs) {
    assert.equal(pair.length, 2);
    assert.equal(pair[0].userData.terminal, true);
    assert.equal(pair[1].userData.terminal, true);
  }
  disposeModel(model.root);
});

test('movement 371 front and rear face runs have equal opposite ratios, exact tooth phase, and zero pitch slip', () => {
  const model = createMovementModel(catalog.movements[370]);
  const data = model.root.userData;
  const { geometry, stateAtInputTravel } = data;
  const expectedContact = new THREE.Vector3(
    -geometry.wheelPitchRadius,
    0,
    0,
  );

  for (const [face, start, sign] of [
    ['front', 0, -1],
    ['rear', geometry.rearRunStart, 1],
  ]) {
    for (let sample = 0; sample < 500; sample += 1) {
      const runInput = geometry.mainRunInputAngle
        * (sample + 0.25) / 500;
      const state = stateAtInputTravel(start + runInput);
      assert.equal(state.activeFace, face);
      assert.equal(state.branch, `${face}-face-tooth-run`);
      near(state.branchProgress,
        runInput / geometry.mainRunInputAngle, 1e-15,
        `${face} branch progress`);
      vectorNear(state.pinionCenter, new THREE.Vector3(
        -geometry.wheelPitchRadius,
        0,
        sign === -1
          ? geometry.pinionPitchRadius
          : -geometry.pinionPitchRadius,
      ), 0, `${face} fixed carrier station`);
      vectorNear(state.contactPoint, expectedContact, 0,
        `${face} contact point`);
      near(state.wheelToPinionRatio,
        sign * geometry.pitchRatio, 0,
        `${face} signed ratio`);
      near(state.wheelAngularSpeed,
        sign * geometry.pitchRatio * geometry.inputAngularSpeed, 0,
        `${face} output speed`);
      near(state.faceToothCoordinate,
        runInput / geometry.pinionAngularPitch, 4e-14,
        `${face} wheel tooth travel`);
      near(state.pinionToothCoordinate,
        runInput / geometry.pinionAngularPitch, 2e-14,
        `${face} pinion tooth travel`);
      near(state.meshPhaseError, 0, 4e-14,
        `${face} tooth phase`);
      vectorNear(state.pinionCenterVelocity, new THREE.Vector3(), 0,
        `${face} carrier dwell`);
      vectorNear(
        state.pinionPitchVelocity,
        state.wheelPitchVelocity,
        2e-15,
        `${face} equal pitch velocities`,
      );
      near(state.rollingVelocityError, 0, 2e-15,
        `${face} no pitch slip`);
    }
  }
  disposeModel(model.root);
});

test('movement 371 terminal teeth carry the pinion continuously between faces with exact circle rollover and no slip', () => {
  const model = createMovementModel(catalog.movements[370]);
  const data = model.root.userData;
  const { geometry, stateAtInputTravel } = data;

  for (const [branch, start, direction, terminalIndex] of [
    [
      'second-terminal-front-to-rear-crossover',
      geometry.mainRunInputAngle,
      -1,
      geometry.mainToothIntervals,
    ],
    [
      'first-terminal-rear-to-front-crossover',
      geometry.firstTerminalCrossoverStart,
      1,
      0,
    ],
  ]) {
    for (let sample = 0; sample < 800; sample += 1) {
      const alpha = Math.PI * sample / 800;
      const state = stateAtInputTravel(start + alpha);
      const sine = Math.sin(alpha);
      const cosine = Math.cos(alpha);
      const radialDistance = Math.sqrt(
        geometry.wheelPitchRadius ** 2
          - (geometry.pinionPitchRadius * sine) ** 2,
      );
      const expectedCenter = new THREE.Vector3(
        -radialDistance,
        0,
        direction === -1
          ? geometry.pinionPitchRadius * cosine
          : -geometry.pinionPitchRadius * cosine,
      );
      const expectedContact = new THREE.Vector3(
        -radialDistance,
        direction === -1
          ? geometry.pinionPitchRadius * sine
          : -geometry.pinionPitchRadius * sine,
        0,
      );
      assert.equal(state.branch, branch);
      assert.equal(state.activeFace, null);
      assert.equal(state.terminalIndex, terminalIndex);
      near(state.branchProgress, alpha / Math.PI, 7e-15,
        `${branch} progress`);
      vectorNear(state.pinionCenter, expectedCenter, 2e-14,
        `${branch} center path`);
      vectorNear(state.contactPoint, expectedContact, 2e-14,
        `${branch} contact path`);
      near(state.contactPoint.length(), geometry.wheelPitchRadius,
        5e-16, `${branch} contact stays on wheel pitch circle`);
      near(
        state.contactPoint.distanceTo(state.pinionCenter),
        geometry.pinionPitchRadius,
        5e-16,
        `${branch} contact stays on pinion pitch circle`,
      );
      vectorNear(
        state.pinionPitchVelocity,
        state.wheelPitchVelocity,
        2e-15,
        `${branch} exact rolling velocity`,
      );
      near(state.rollingVelocityError, 0, 2e-15,
        `${branch} no terminal slip`);
    }
  }

  const epsilon = 1e-8;
  for (const boundary of [
    geometry.mainRunInputAngle,
    geometry.rearRunStart,
    geometry.firstTerminalCrossoverStart,
    geometry.mechanismCycleInputAngle,
  ]) {
    const before = stateAtInputTravel(boundary - epsilon);
    const after = stateAtInputTravel(boundary + epsilon);
    vectorNear(before.pinionCenter, after.pinionCenter, 2e-8,
      `carrier position is continuous at ${boundary}`);
    vectorNear(before.pinionCenterVelocity, after.pinionCenterVelocity,
      2e-8, `carrier velocity is continuous at ${boundary}`);
    angleNear(before.wheelAngle, after.wheelAngle, 2e-8,
      `wheel angle is continuous at ${boundary}`);
    near(before.wheelAngularSpeed, after.wheelAngularSpeed, 2e-8,
      `wheel velocity is continuous at ${boundary}`);
  }
  disposeModel(model.root);
});

test('movement 371 one uniform pinion input produces equal alternating wheel sweeps and closes after exactly nine turns', () => {
  const model = createMovementModel(catalog.movements[370]);
  const data = model.root.userData;
  const { geometry, stateAtInputTravel, stateAtTime, transmission } = data;

  near(geometry.mainRunInputAngle / FULL_TURN, 4, 8e-16,
    'each face run consumes four pinion turns');
  near(geometry.terminalCrossoverInputAngle / FULL_TURN, 0.5, 0,
    'each crossover consumes half a pinion turn');
  near(geometry.mechanismCycleInputAngle / FULL_TURN, 9, 3e-15,
    'full mechanism consumes nine turns');
  near(transmission.fullCycleInputRevolutions, 9, 3e-15,
    'published cycle turn count');
  near(geometry.mechanismCyclePeriod,
    9 * geometry.inputRevolutionPeriod, 0,
    'full cycle timing');

  const frontStart = stateAtInputTravel(0);
  const frontEnd = stateAtInputTravel(
    geometry.mainRunInputAngle - 1e-10,
  );
  const rearStart = stateAtInputTravel(geometry.rearRunStart);
  const rearEnd = stateAtInputTravel(
    geometry.firstTerminalCrossoverStart - 1e-10,
  );
  near(
    frontEnd.wheelAngle - frontStart.wheelAngle,
    -geometry.mainArcSweep,
    3e-11,
    'front face drives one long negative sweep',
  );
  near(
    rearEnd.wheelAngle - rearStart.wheelAngle,
    geometry.mainArcSweep,
    3e-11,
    'rear face drives equal positive sweep',
  );

  for (let sample = 0; sample <= 3600; sample += 1) {
    const time = geometry.mechanismCyclePeriod * sample / 3600;
    const state = stateAtTime(time);
    near(state.inputAngle,
      geometry.inputStartAngle + geometry.inputAngularSpeed * time,
      2e-14, 'input angle remains uniform and unwrapped');
    near(state.inputAngularSpeed, geometry.inputAngularSpeed, 0,
      'input angular speed remains constant');
    near(state.rollingVelocityError, 0, 3e-15,
      'all four branches maintain rolling contact');
  }

  const start = stateAtTime(0);
  const closure = stateAtTime(geometry.mechanismCyclePeriod);
  vectorNear(closure.pinionCenter, start.pinionCenter, 0,
    'carrier closes');
  vectorNear(closure.contactPoint, start.contactPoint, 0,
    'contact closes');
  angleNear(closure.wheelAngle, start.wheelAngle, 0,
    'wheel closes');
  angleNear(closure.pinionAngle, start.pinionAngle, 5e-15,
    'pinion index closes after nine whole turns');
  near(
    closure.pinionAngle - start.pinionAngle,
    geometry.mechanismCycleInputAngle,
    2e-14,
    'unwrapped input advances nine turns',
  );
  const negative = stateAtTime(-geometry.mechanismCyclePeriod / 7);
  const positive = stateAtTime(
    geometry.mechanismCyclePeriod * 6 / 7,
  );
  vectorNear(negative.pinionCenter, positive.pinionCenter, 2e-15,
    'carrier state is periodic for negative time');
  angleNear(negative.wheelAngle, positive.wheelAngle, 2e-15,
    'wheel state is periodic for negative time');
  disposeModel(model.root);
});

test('movement 371 renderer follows the exact wheel, uniform pinion, carrier, and active-face state', () => {
  const model = createMovementModel(catalog.movements[370]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const probeTimes = [
    0.37,
    geometry.mainRunInputAngle / geometry.inputAngularSpeed + 0.41,
    geometry.rearRunStart / geometry.inputAngularSpeed + 0.73,
    geometry.firstTerminalCrossoverStart / geometry.inputAngularSpeed
      + 0.52,
  ];

  for (const time of probeTimes) {
    const expected = stateAtTime(time);
    model.update(time, 0.016);
    near(blocks.outputRotor.rotation.z, expected.wheelAngle, 0,
      'rendered output wheel angle');
    vectorNear(blocks.pinionCarrier.position, expected.pinionCenter, 0,
      'rendered pinion carrier position');
    near(blocks.pinion.userData.rotor.rotation.z,
      expected.pinionAngle, 0, 'rendered pinion spin');
    near(blocks.inputShaftRotor.rotation.x,
      expected.pinionAngle, 0, 'rendered shaft spin');
    assert.equal(blocks.frontContactMarker.visible,
      expected.activeFace === 'front');
    assert.equal(blocks.rearContactMarker.visible,
      expected.activeFace === 'rear');
    assert.equal(blocks.terminalContactMarker.visible,
      expected.activeFace === null);
    vectorNear(data.kinematics.pinionCenter, expected.pinionCenter, 0,
      'published kinematics');
    vectorNear(data.activeContact.point, expected.contactPoint, 0,
      'published active contact');
    assert.equal(data.activeContact.face, expected.activeFace);
    assert.equal(data.activeContact.terminalIndex, expected.terminalIndex);
    near(data.activeContact.rollingVelocityError,
      expected.rollingVelocityError, 0,
      'published rolling error');
  }
  disposeModel(model.root);
});

test('movement 371 publishes one-revolution display timing while retaining its full alternating cycle and leaves 373 next', () => {
  const movement = catalog.movements[370];
  const model = createMovementModel(movement);
  const data = model.root.userData;

  assert.equal(data.timeline.demonstrationPeriod,
    data.geometry.inputRevolutionPeriod);
  assert.equal(data.timeline.fullAlternatingMechanismPeriod,
    data.geometry.mechanismCyclePeriod);
  assert.match(data.timeline.note, /one uniform pinion revolution/);
  assert.match(data.timeline.note, /exactly nine/);
  assert.equal(data.animationTiming.authoredCyclePeriod,
    data.geometry.inputRevolutionPeriod);
  assert.equal(data.animationTiming.targetCycleDuration, 2);
  assertReadableTiming(data.animationTiming);
  assert.ok(data.cameraFitBounds instanceof THREE.Box3);
  assert.ok(Number.isFinite(data.groundFloorY));

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model507.root);
});
