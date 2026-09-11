import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const ORIGIN_2D = new THREE.Vector2();
const LOCAL_DOWN = new THREE.Vector3(0, -1, 0);
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

function vector2Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function vector3Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function cross2(a, b) {
  return a.x * b.y - a.y * b.x;
}

function worldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
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

test('movement 350 is the corrected two-slot traverse mechanism', () => {
  const movement = catalog.movements[349];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    contacts,
    degreesOfFreedom,
    fidelity,
    mechanism,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 350);
  assert.equal(movement.number, '350');
  assert.equal(movement.title, 'Traverse or to-and-fro motion');
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'two-slotted-lever-reduced-horizontal-traverse');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /stationary-upper-pin-O/);
  assert.match(mechanism, /lower-pin-D-in-horizontal-guide/);
  assert.match(mechanism, /output-joint-C-on-horizontal-guided-bar/);
  assert.match(mechanism, /source-corrected-clearance-riser/);
  assert.equal(degreesOfFreedom.mechanism, 1);
  assert.match(degreesOfFreedom.input, /lower pin D/);
  assert.match(degreesOfFreedom.output, /guides a,a/);
  assert.match(transmission.collinearityConstraint,
    /cross\(O-C,D-C\)=0/);
  assert.equal(transmission.displacementRatio,
    1.06066 / 4.81066);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.outputBar.parent, model.root);
  assert.equal(blocks.leverAssembly.parent, model.root);
  assert.equal(blocks.movingInput.parent, model.root);
  assert.equal(blocks.fixedPinO.parent, model.root);
  assert.equal(blocks.centralJointPin.parent, model.root);
  assert.equal(blocks.upperSlottedEnd.parent, blocks.leverAssembly);
  assert.equal(blocks.lowerSlottedEnd.parent, blocks.leverAssembly);
  assert.equal(blocks.upperSlottedEnd.userData.actualThroughSlot, true);
  assert.equal(blocks.lowerSlottedEnd.userData.actualThroughSlot, true);
  assert.equal(blocks.outputJointAnchor.parent, blocks.outputBar);
  assert.equal(blocks.leverJointAnchor.parent, blocks.leverAssembly);
  assert.equal(blocks.fixedPinSlotAnchor.parent, blocks.leverAssembly);
  assert.equal(blocks.movingPinSlotAnchor.parent, blocks.leverAssembly);
  assert.equal(blocks.movingPinAnchor.parent, blocks.movingInput);
  assert.equal(blocks.outputGuideAssemblies.length, 2);
  assert.equal(blocks.inputGuideDashes.length, 23);
  assert.equal(blocks.railIndexes.length, 4);
  assert.ok(blocks.outputRiser.position.x > 0,
    'the official corrected riser is offset from the fixed pin line');

  assert.equal(contacts.fixedPinOInUpperLeverSlot.fixedMember,
    blocks.fixedFrame);
  assert.equal(contacts.fixedPinOInUpperLeverSlot.movingMember,
    blocks.leverAssembly);
  assert.equal(contacts.movingPinDInLowerLeverSlot.members[0],
    blocks.movingInput);
  assert.equal(contacts.movingPinDInLowerLeverSlot.members[1],
    blocks.leverAssembly);
  assert.equal(contacts.movingPinDInHorizontalGuide.fixedMember,
    blocks.fixedFrame);
  assert.equal(contacts.movingPinDInHorizontalGuide.movingMember,
    blocks.movingInput);
  assert.equal(contacts.leverAtOutputBarC.members[0],
    blocks.leverAssembly);
  assert.equal(contacts.leverAtOutputBarC.members[1], blocks.outputBar);
  assert.equal(contacts.outputBarInGuidesAA.fixedMembers.length, 2);
  assert.equal(contacts.outputBarInGuidesAA.movingMember,
    blocks.outputBar);
  assert.equal(sourceAnimation.officialWebsiteCorrection.applied, true);
  assert.match(sourceAnimation.officialWebsiteCorrection.note,
    /reroutes the riser/);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'upper-actual-slot-for-fixed-pin-O').length, 1);
  assert.equal(roles.filter((role) => role ===
    'lower-actual-slot-for-moving-pin-D').length, 1);
  assert.equal(roles.filter((role) => /^fixed-output-guide-a-/.test(role))
    .length, 2);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)),
    false);
  disposeModel(model.root);
});

test('movement 350 preserves the official canvas geometry, phase, and timing', () => {
  const model = createMovementModel(catalog.movements[349]);
  const {
    canonicalStates,
    geometry,
    modelPointToOfficialAnimationRaster,
    officialTravelAtPhase,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const official = sourceAnimation.officialGeometry;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.durationSeconds, 4);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_350.html');
  assert.deepEqual(sourceAnimation.officialFunctionChain, [
    'add_pos_interp-guided-output-bar-C',
    'add_pos_interp-horizontal-input-pin-D',
    'add_rot_to-two-slotted-lever-from-C-toward-D',
  ]);
  assert.deepEqual(sourceAnimation.officialKeyframePhases,
    [0, 0.4, 0.5, 0.9]);
  vector2Near(official.fixedPinO, new THREE.Vector2(0, 0), 0,
    'official fixed pin O');
  assert.equal(official.inputGuideY, -4.81066);
  assert.equal(official.inputHalfStroke, 4.81066);
  assert.equal(official.outputGuideY, -1.06066);
  assert.equal(official.outputHalfStroke, 1.06066);
  assert.equal(official.upperSlotMinimum, 0.93566);
  assert.equal(official.upperSlotMaximum, 1.625);
  assert.equal(official.lowerSlotMinimumMagnitude, 3.625);
  assert.equal(official.lowerSlotMaximumMagnitude, 5.428301);
  assert.equal(official.slotHalfWidth, 0.25);
  assert.equal(official.outputRailYFromC, -2.5);
  assert.equal(official.outputRailHalfLength, 7.75);
  assert.deepEqual(official.guideXs, [-6, 6]);
  assert.deepEqual(official.view, [-6.5, -8.90533, 13, 13]);
  vector2Near(official.leverOrientationReference,
    new THREE.Vector2(0, -5.428301), 0,
    'official lever orientation reference');
  assert.equal(geometry.cyclePeriod, 4);
  near(geometry.sourceDisplacementRatio, 1.06066 / 4.81066,
    0, 'source displacement ratio');

  const officialSamples = [
    [0, 0],
    [0.1, 0.25],
    [0.2, 0.5],
    [0.3, 0.75],
    [0.4, 1],
    [0.45, 1],
    [0.5, 1],
    [0.6, 0.75],
    [0.7, 0.5],
    [0.8, 0.25],
    [0.9, 0],
    [0.95, 0],
    [1, 0],
  ];
  for (const [phase, expected] of officialSamples) {
    near(officialTravelAtPhase(phase).value, expected, 4e-16,
      `official travel ${phase}`);
  }

  const view = sourceReference.officialAnimationView;
  assert.equal(view.canvasWidth, 525);
  assert.equal(view.canvasHeight, 525);
  assert.equal(view.viewWidth, 13);
  assert.equal(view.viewHeight, 13);
  const fixedPinRaster = modelPointToOfficialAnimationRaster(
    canonicalStates.sourceStart.fixedPin.pointO,
  );
  vector2Near(fixedPinRaster, new THREE.Vector2(
    (0 + 6.5) * 525 / 13,
    525 - (0 + 8.90533) * 525 / 13,
  ), 6e-14, 'official fixed pin raster position');
  const plate = sourceReference.brownPlate350;
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 10);
  assert.match(plate.inferredTopology, /two-slotted rocking lever/);
  disposeModel(model.root);
});

test('movement 350 closes both finite slots throughout the full input stroke', () => {
  const model = createMovementModel(catalog.movements[349]);
  const { geometry, sourceStateAtTravel } = model.root.userData;
  const ratio = geometry.sourceDisplacementRatio;

  for (let sample = 0; sample <= 32768; sample += 1) {
    const travel = sample / 32768;
    const state = sourceStateAtTravel(travel);
    const fromCToO = state.fixedPinO.clone().sub(state.outputJointC);
    const fromCToD = state.movingPinD.clone().sub(state.outputJointC);
    near(cross2(fromCToO, fromCToD), 0, 8e-15,
      `O-C-D collinearity ${sample}`);
    near(state.outputJointC.x, ratio * state.movingPinD.x, 9e-16,
      `output/input abscissa ratio ${sample}`);
    near(state.outputJointC.y, ratio * state.movingPinD.y, 9e-16,
      `output/input ordinate ratio ${sample}`);
    near(state.outputJointC.y, geometry.sourceOutputGuideY, 0,
      `C remains on output guide ${sample}`);
    near(state.movingPinD.y, geometry.sourceInputGuideY, 0,
      `D remains on input guide ${sample}`);
    near(fromCToO.length(), state.fixedPinCoordinate, 9e-16,
      `upper-slot coordinate ${sample}`);
    near(fromCToD.length(), state.movingPinCoordinate, 2e-15,
      `lower-slot coordinate ${sample}`);
    near(state.fixedPinCoordinate + state.movingPinCoordinate,
      state.radialDistance, 2e-15,
    `slot-coordinate partition ${sample}`);

    const reconstructedO = new THREE.Vector2(0,
      state.fixedPinCoordinate)
      .rotateAround(ORIGIN_2D, state.leverAngle)
      .add(state.outputJointC);
    const reconstructedD = new THREE.Vector2(0,
      -state.movingPinCoordinate)
      .rotateAround(ORIGIN_2D, state.leverAngle)
      .add(state.outputJointC);
    vector2Near(reconstructedO, state.fixedPinO, 1e-15,
      `fixed pin lies in upper slot ${sample}`);
    vector2Near(reconstructedD, state.movingPinD, 2e-15,
      `moving pin lies in lower slot ${sample}`);

    assert.ok(state.fixedPinCoordinate
      >= geometry.sourceUpperSlotMinimum);
    assert.ok(state.fixedPinCoordinate
      <= geometry.sourceUpperSlotMaximum);
    assert.ok(state.movingPinCoordinate
      >= geometry.sourceLowerSlotMinimumMagnitude);
    assert.ok(state.movingPinCoordinate
      <= geometry.sourceLowerSlotMaximumMagnitude);
    assert.ok(state.fixedPinCoordinate
      - geometry.sourceUpperSlotMinimum >= 0.125 - 2e-15);
    assert.ok(geometry.sourceUpperSlotMaximum
      - state.fixedPinCoordinate >= 0.125 - 3e-7);
    assert.ok(state.movingPinCoordinate
      - geometry.sourceLowerSlotMinimumMagnitude >= 0.125 - 2e-15);
    assert.ok(geometry.sourceLowerSlotMaximumMagnitude
      - state.movingPinCoordinate >= 0.125 - 2e-7);
    assert.ok(Math.abs(state.leverAngle) <= Math.PI / 4 + 2e-16);
  }
  disposeModel(model.root);
});

test('movement 350 retains the exact reduction and canonical traverses', () => {
  const model = createMovementModel(catalog.movements[349]);
  const {
    canonicalStates,
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const left = canonicalStates.sourceStart;
  const centerOut = canonicalStates.outwardMidpoint;
  const right = canonicalStates.rightExtreme;
  const rightDwellEnd = canonicalStates.rightDwellEnd;
  const centerBack = canonicalStates.returnMidpoint;
  const leftAgain = canonicalStates.leftExtreme;

  near(left.source.inputX, -4.81066, 0, 'left input extreme');
  near(left.source.outputX, -1.06066, 0, 'left output extreme');
  near(centerOut.source.inputX, 0, 0, 'outward center input');
  near(centerOut.source.outputX, 0, 0, 'outward center output');
  near(right.source.inputX, 4.81066, 0, 'right input extreme');
  near(right.source.outputX, 1.06066, 0, 'right output extreme');
  near(rightDwellEnd.source.inputX, right.source.inputX, 0,
    'right dwell input position');
  near(rightDwellEnd.source.outputX, right.source.outputX, 0,
    'right dwell output position');
  near(centerBack.source.inputX, 0, 1e-15, 'return center input');
  near(centerBack.source.outputX, 0, 3e-16, 'return center output');
  near(leftAgain.source.inputX, left.source.inputX, 0,
    'left extreme repeats');
  near(leftAgain.source.outputX, left.source.outputX, 0,
    'left output repeats');
  near(right.source.inputX - left.source.inputX,
    2 * geometry.sourceInputHalfStroke, 0, 'input stroke');
  near(right.source.outputX - left.source.outputX,
    2 * geometry.sourceOutputHalfStroke, 0, 'output stroke');
  near(
    (right.source.outputX - left.source.outputX)
      / (right.source.inputX - left.source.inputX),
    geometry.sourceDisplacementRatio,
    3e-17,
    'output/input stroke ratio',
  );
  near(left.lever.angle, -Math.PI / 4, 0, 'left lever extreme');
  near(right.lever.angle, Math.PI / 4, 0, 'right lever extreme');
  near(centerOut.lever.angle, 0, 0, 'center lever pose');
  assert.deepEqual(canonicalTimes, {
    sourceStart: 0,
    outwardMidpoint: 0.8,
    rightExtreme: 1.6,
    rightDwellEnd: 2,
    returnMidpoint: 2.8,
    leftExtreme: 3.6,
    cycleClosure: 4,
  });
  near(stateAtTime(1.8).source.inputX, 4.81066, 0,
    'input stationary during outer dwell');
  near(stateAtTime(3.8).source.inputX, -4.81066, 0,
    'input stationary during inner dwell');
  disposeModel(model.root);
});

test('movement 350 smooths both source reversals without altering dwells or extrema', () => {
  const model = createMovementModel(catalog.movements[349]);
  const {
    geometry,
    officialTravelAtPhase,
    smoothTravelAtPhase,
    sourceAnimation,
    stateAtTime,
  } = model.root.userData;

  for (const phase of [0, 0.4, 0.5, 0.9, 1]) {
    const smooth = smoothTravelAtPhase(phase);
    near(smooth.velocityPerPhase, 0, 0,
      `smooth boundary velocity ${phase}`);
    near(smooth.accelerationPerPhaseSquared, 0, 0,
      `smooth boundary acceleration ${phase}`);
    near(smooth.value, officialTravelAtPhase(phase).value, 0,
      `source boundary pose retained ${phase}`);
  }
  for (const [start, end] of [[0.4, 0.5], [0.9, 1]]) {
    for (let sample = 0; sample <= 64; sample += 1) {
      const phase = THREE.MathUtils.lerp(start, end, sample / 64);
      near(smoothTravelAtPhase(phase).value,
        officialTravelAtPhase(phase).value, 0,
      `official dwell retained ${phase}`);
      near(smoothTravelAtPhase(phase).velocityPerPhase, 0, 0,
        `zero dwell speed ${phase}`);
    }
  }
  assert.equal(sourceAnimation.timingRefinement.interpolation,
    'quintic smootherstep');
  assert.equal(sourceAnimation.timingRefinement.changesExtremaOrDwells,
    false);
  assert.match(sourceAnimation.timingRefinement.reason,
    /removes endpoint jerk/);
  for (const time of [0, 1.6, 2, 3.6, 4]) {
    const state = stateAtTime(time);
    near(state.input.velocity.length(), 0, 0,
      `input stationary at boundary ${time}`);
    near(state.input.acceleration.length(), 0, 0,
      `input acceleration vanishes at boundary ${time}`);
    near(state.output.velocity.length(), 0, 0,
      `output stationary at boundary ${time}`);
    near(state.lever.angularVelocity, 0, 0,
      `lever stationary at boundary ${time}`);
    near(state.lever.angularAcceleration, 0, 0,
      `lever acceleration vanishes at boundary ${time}`);
  }
  near(geometry.cyclePeriod, 4, 0,
    'official four-second period retained');
  disposeModel(model.root);
});

test('movement 350 analytic translations, slot sliding, and rocking rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[349]);
  const { stateAtTime } = model.root.userData;
  const velocityStep = 2e-6;
  const accelerationStep = 1e-4;
  const sampleTimes = [0.09, 0.31, 0.67, 1.13, 1.49,
    2.09, 2.37, 2.83, 3.31];

  for (const time of sampleTimes) {
    const state = stateAtTime(time);
    const beforeV = stateAtTime(time - velocityStep);
    const afterV = stateAtTime(time + velocityStep);
    for (const [name, analytic, beforePoint, afterPoint] of [
      ['input D', state.input.velocity,
        beforeV.input.pointD, afterV.input.pointD],
      ['output C', state.output.velocity,
        beforeV.output.jointC, afterV.output.jointC],
    ]) {
      const numerical = afterPoint.clone().sub(beforePoint)
        .multiplyScalar(1 / (2 * velocityStep));
      vector3Near(analytic, numerical, 2e-9,
        `${name} analytic velocity ${time}`);
    }
    near(state.lever.angularVelocity,
      (afterV.lever.angle - beforeV.lever.angle)
        / (2 * velocityStep),
      2e-9, `lever analytic angular velocity ${time}`);
    near(state.fixedPin.coordinateVelocity,
      (afterV.fixedPin.coordinate - beforeV.fixedPin.coordinate)
        / (2 * velocityStep),
      2e-9, `upper-slot analytic sliding velocity ${time}`);
    near(state.movingPin.coordinateVelocity,
      (afterV.movingPin.coordinate - beforeV.movingPin.coordinate)
        / (2 * velocityStep),
      2e-9, `lower-slot analytic sliding velocity ${time}`);

    const beforeA = stateAtTime(time - accelerationStep);
    const afterA = stateAtTime(time + accelerationStep);
    for (const [name, analytic, beforeVelocity, afterVelocity] of [
      ['input D', state.input.acceleration,
        beforeA.input.velocity, afterA.input.velocity],
      ['output C', state.output.acceleration,
        beforeA.output.velocity, afterA.output.velocity],
    ]) {
      const numerical = afterVelocity.clone().sub(beforeVelocity)
        .multiplyScalar(1 / (2 * accelerationStep));
      vector3Near(analytic, numerical, 5e-7,
        `${name} analytic acceleration ${time}`);
    }
    near(state.lever.angularAcceleration,
      (afterA.lever.angularVelocity - beforeA.lever.angularVelocity)
        / (2 * accelerationStep),
      7e-7, `lever analytic angular acceleration ${time}`);
    near(state.fixedPin.coordinateAcceleration,
      (afterA.fixedPin.coordinateVelocity
        - beforeA.fixedPin.coordinateVelocity)
        / (2 * accelerationStep),
      7e-7, `upper-slot analytic sliding acceleration ${time}`);
    near(state.movingPin.coordinateAcceleration,
      (afterA.movingPin.coordinateVelocity
        - beforeA.movingPin.coordinateVelocity)
        / (2 * accelerationStep),
      1e-6, `lower-slot analytic sliding acceleration ${time}`);
  }
  disposeModel(model.root);
});

test('movement 350 renderer binds every pin to its solved slot and guide', () => {
  const model = createMovementModel(catalog.movements[349]);
  const { blocks, contacts, geometry } = model.root.userData;

  for (const time of [0, 0.23, 0.8, 1.27, 1.6, 1.83,
    2.19, 2.8, 3.34, 3.6, 3.87, 4]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    vector3Near(worldPosition(blocks.outputJointAnchor),
      state.output.jointC, 1e-16,
    `output-bar joint anchor C ${time}`);
    vector3Near(worldPosition(blocks.leverJointAnchor),
      state.output.jointC, 1e-16,
    `lever joint anchor C ${time}`);
    vector3Near(worldPosition(blocks.fixedPinSlotAnchor),
      state.fixedPin.pointO, 9e-16,
    `fixed pin O in rendered upper slot ${time}`);
    vector3Near(worldPosition(blocks.movingPinSlotAnchor),
      state.input.pointD, 2e-15,
    `moving pin D in rendered lower slot ${time}`);
    vector3Near(worldPosition(blocks.movingPinAnchor),
      state.input.pointD, 0,
    `moving input anchor D ${time}`);

    const renderedDown = LOCAL_DOWN.clone().applyQuaternion(
      blocks.leverAssembly.getWorldQuaternion(new THREE.Quaternion()),
    );
    const solvedDown = state.input.pointD.clone()
      .sub(state.output.jointC).normalize();
    vector3Near(renderedDown, solvedDown, 4e-16,
      `rendered lever direction C-to-D ${time}`);
    near(blocks.outputBar.position.x, state.output.jointC.x, 0,
      `guided bar translation ${time}`);
    near(blocks.outputBar.rotation.z, 0, 0,
      `guided bar does not rock ${time}`);
    near(blocks.movingInput.position.y, state.input.pointD.y, 0,
      `input shoe remains on horizontal guide ${time}`);
    near(blocks.leverAssembly.rotation.z, state.lever.angle, 0,
      `lever angle ${time}`);

    vector3Near(contacts.fixedPinOInUpperLeverSlot.point,
      state.fixedPin.pointO, 0, `upper-slot contact ${time}`);
    vector3Near(contacts.movingPinDInLowerLeverSlot.point,
      state.input.pointD, 0, `lower-slot contact ${time}`);
    vector3Near(contacts.movingPinDInHorizontalGuide.point,
      state.input.pointD, 0, `input-guide contact ${time}`);
    vector3Near(contacts.leverAtOutputBarC.point,
      state.output.jointC, 0, `bar-joint contact ${time}`);
    near(contacts.fixedPinOInUpperLeverSlot.slotCoordinate,
      state.fixedPin.coordinate, 0,
    `upper rendered slot coordinate ${time}`);
    near(contacts.movingPinDInLowerLeverSlot.slotCoordinate,
      -state.movingPin.coordinate, 0,
    `lower rendered slot coordinate ${time}`);
    contacts.outputBarInGuidesAA.points.forEach((point, index) => {
      near(point.x, [-6, 6][index] * geometry.sourceScale, 0,
        `fixed guide a x ${index} ${time}`);
      near(point.y,
        geometry.worldOffsetY + (
          geometry.sourceOutputGuideY
            + geometry.sourceOutputRailYFromC
        ) * geometry.sourceScale,
        0, `fixed guide a y ${index} ${time}`);
    });
  }
  disposeModel(model.root);
});

test('movement 350 closes in four seconds and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[349]);
  const { geometry, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const finish = stateAtTime(geometry.cyclePeriod);
  for (const [name, first, last] of [
    ['fixed pin O', start.fixedPin.pointO, finish.fixedPin.pointO],
    ['input pin D', start.input.pointD, finish.input.pointD],
    ['input velocity', start.input.velocity, finish.input.velocity],
    ['input acceleration', start.input.acceleration,
      finish.input.acceleration],
    ['output joint C', start.output.jointC, finish.output.jointC],
    ['output velocity', start.output.velocity, finish.output.velocity],
    ['output acceleration', start.output.acceleration,
      finish.output.acceleration],
  ]) vector3Near(last, first, 0, `${name} cycle closure`);
  near(finish.travel, start.travel, 0, 'travel closure');
  near(finish.travelRate, start.travelRate, 0, 'travel-rate closure');
  near(finish.travelAcceleration, start.travelAcceleration, 0,
    'travel-acceleration closure');
  near(finish.lever.angle, start.lever.angle, 0,
    'lever-angle closure');
  near(finish.lever.angularVelocity, start.lever.angularVelocity, 0,
    'lever-rate closure');
  near(finish.lever.angularAcceleration,
    start.lever.angularAcceleration, 0,
    'lever-acceleration closure');
  near(finish.fixedPin.coordinate, start.fixedPin.coordinate, 0,
    'upper-slot-coordinate closure');
  near(finish.movingPin.coordinate, start.movingPin.coordinate, 0,
    'lower-slot-coordinate closure');
  assert.equal(finish.phase, 0);

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model507.root);
});
