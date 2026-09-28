import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
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

test('movement 375 is a vertical-shaft carrier with one cross-axle, two opposed edge runners, one annular pan, and the source-visible right-angle drive', () => {
  const movement = catalog.movements[374];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 375);
  assert.equal(movement.number, '375');
  assert.equal(movement.category, 'Miscellaneous mechanisms');
  assert.equal(
    movement.archetype,
    'paired-edge-runners-annular-pan-bevel-drive',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-horizontal-input-bevel-pinion/);
  assert.match(data.mechanism, /one-horizontal-cross-axle/);
  assert.match(data.mechanism, /two-opposed-edge-runners/);
  assert.match(data.mechanism, /one-fixed-annular-pan/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.input, /horizontal bevel pinion/);
  assert.match(degreesOfFreedom.note, /2:1 bevel reduction/);
  assert.match(degreesOfFreedom.note, /no-slip rolling constraints/);

  for (const component of [
    blocks.carrier,
    blocks.innerLip,
    blocks.inputPinion,
    blocks.inputShaftRotor,
    blocks.largeBevelGear,
    blocks.outerLip,
    blocks.pan,
    blocks.upperFrame,
  ]) assert.equal(component.parent, model.root);
  for (const component of [
    blocks.centralHub,
    blocks.crossAxle,
    ...blocks.edgeRunners,
    blocks.verticalShaft,
  ]) assert.equal(component.parent, blocks.carrier);
  for (const component of [
    ...blocks.framePosts,
    blocks.frameTop,
    blocks.inputBearing,
  ]) assert.equal(component.parent, blocks.upperFrame);
  assert.equal(blocks.inputShaft.parent, blocks.inputShaftRotor);
  // Brown draws no foundation slab, lower bearing or white indices.
  for (const component of [
    blocks.lowerBase,
    blocks.lowerBearing,
    blocks.shaftIndex,
    blocks.inputShaftIndex,
  ]) assert.equal(component.parent, null);
  assert.equal(blocks.edgeRunners.length, 2);
  assert.equal(blocks.framePosts.length, 2);
  assert.equal(blocks.pan.userData.fixed, true);
  assert.equal(blocks.upperFrame.userData.fixed, true);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'vertical-shaft-rigidly-connected-to-both-runner-axles',
    'single-horizontal-cross-axle-connecting-opposed-edge-runners',
    'one-of-paired-opposed-edge-runners-rolling-in-annular-pan',
    'fixed-annular-pan-with-flat-circular-grinding-track',
    'large-horizontal-bevel-gear-fast-on-vertical-runner-shaft',
    'small-horizontal-input-pinion-driving-vertical-shaft-at-right-angle',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 375 preserves Brown\'s three-part description and measured engraving while disclosing the unanimated reconstruction', () => {
  const movement = catalog.movements[374];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate375;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_375.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Pair of edge runners or chasers/);
  assert.match(movement.description, /crushing or grinding/);
  assert.match(movement.description, /axles are connected with vertical shaft/);
  assert.match(movement.description, /annular pan or trough/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(
    dynamics.sourceSpecifiesDimensionsTimingTeethMaterialOrLoad,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);
  assert.match(dynamics.treatment, /right-angle bevel/);
  assert.match(dynamics.treatment, /analytically/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 9);
  assert.equal(plate.frameLeft, 43);
  assert.equal(plate.frameRight, 501);
  assert.equal(plate.frameTopY, 179);
  assert.equal(plate.verticalShaftX, 268);
  assert.deepEqual(plate.leftRunnerCenter.toArray(), [170, 334]);
  assert.deepEqual(plate.rightRunnerCenter.toArray(), [390, 334]);
  assert.deepEqual(plate.annularPanLeftLip.toArray(), [85, 430]);
  assert.deepEqual(plate.annularPanRightLip.toArray(), [454, 430]);
  assert.deepEqual(plate.annularPanBottom.toArray(), [277, 484]);
  assert.deepEqual(plate.inputPinionCenter.toArray(), [450, 83]);
  assert.equal(evidence.explicitInBrownDescription.length, 3);
  assert.match(evidence.engravingEvidence, /two opposed upright/);
  assert.match(evidence.engravingEvidence, /right-angle gear drive/);
  assert.match(evidence.reconstructionDisclosure, /36:18/);
  assert.match(evidence.reconstructionDisclosure, /no canvas animation/);
  disposeModel(model.root);
});

test('movement 375 places both identical runner treads exactly on the flat centerline of the fixed annular pan', () => {
  const model = createMovementModel(catalog.movements[374]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;

  near(geometry.runnerRadiusRatio, 1, 0,
    'track-to-runner radius ratio');
  near(geometry.runnerCenterY - geometry.runnerRadius,
    geometry.panFloorY, 0, 'runner bottom at pan floor');
  assert.ok(geometry.trackRadius - geometry.runnerWidth / 2
    > geometry.panInnerRadius);
  assert.ok(geometry.trackRadius + geometry.runnerWidth / 2
    < geometry.panOuterRadius);
  assert.deepEqual(blocks.edgeRunners.map((runner) => runner.userData.index),
    [0, 1]);
  assert.deepEqual(blocks.edgeRunners.map((runner) => runner.userData.axis.x),
    [-1, 1]);
  for (const runner of blocks.edgeRunners) {
    assert.equal(runner.userData.radius, geometry.runnerRadius);
    assert.equal(runner.userData.width, geometry.runnerWidth);
    assert.equal(runner.userData.faceIndices.length, 2);
  }

  for (let sample = -720; sample <= 1440; sample += 1) {
    const state = stateAtTime(geometry.carrierPeriod * sample / 720);
    assert.equal(state.runners.length, 2);
    for (const runner of state.runners) {
      near(Math.hypot(runner.center.x, runner.center.z),
        geometry.trackRadius, 5e-16,
        'runner center follows annular track centerline');
      near(runner.center.y, geometry.runnerCenterY, 0,
        'runner axle remains level');
      near(runner.contactPoint.y, geometry.panFloorY, 0,
        'runner contact lies on pan floor');
      near(Math.hypot(runner.contactPoint.x, runner.contactPoint.z),
        geometry.trackRadius, 5e-16,
        'contact follows annular centerline');
      near(runner.outwardAxis.length(), 1, 3e-16,
        'runner axis remains unit radial');
      near(runner.outwardAxis.y, 0, 0,
        'runner axis remains horizontal');
    }
    vectorNear(state.runners[0].center,
      state.runners[1].center.clone().negate().setY(
        geometry.runnerCenterY,
      ), 8e-16, 'opposed runner centers');
  }
  disposeModel(model.root);
});

test('movement 375 both outward-axis runner spins cancel carrier translation exactly at the two pan contacts', () => {
  const model = createMovementModel(catalog.movements[374]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;

  assert.equal(transmission.runnerSpinRatio, -1);
  assert.match(transmission.runnerSpinLaw, /outward radial axis/);
  for (let sample = -1600; sample <= 3200; sample += 1) {
    const time = geometry.carrierPeriod * sample / 800;
    const state = stateAtTime(time);
    near(state.runnerLocalAngularSpeed,
      -geometry.runnerRadiusRatio * geometry.carrierAngularSpeed,
      0, 'exact outward-axis spin rate');
    near(state.runnerSpinAngle,
      geometry.runnerStartAngle
        - geometry.runnerRadiusRatio * state.carrierTravel,
      0, 'exact unwrapped runner angle');
    for (const runner of state.runners) {
      vectorNear(runner.spinAngularVelocity,
        runner.outwardAxis.clone().multiplyScalar(
          state.runnerLocalAngularSpeed,
        ), 0, 'runner spin vector follows rotating radial axle');
      vectorNear(runner.totalAngularVelocity,
        Y_AXIS.clone().multiplyScalar(state.carrierAngularSpeed)
          .add(runner.spinAngularVelocity),
        0, 'carrier and local spin angular velocities combine');
      near(runner.centerVelocity.dot(runner.outwardAxis), 0, 6e-16,
        'center velocity tangent to annulus');
      near(runner.contactVelocity.length(), 0, 2e-15,
        'instantaneously stationary no-slip pan contact');
    }
  }
  disposeModel(model.root);
});

test('movement 375 upper 36:18 bevel pair uses complementary true pitch cones with one module and one common apex', () => {
  const model = createMovementModel(catalog.movements[374]);
  const data = model.root.userData;
  const { blocks, geometry } = data;
  const large = blocks.largeBevelGear;
  const pinion = blocks.inputPinion;

  assert.equal(geometry.largeGearTeeth, 36);
  assert.equal(geometry.inputPinionTeeth, 18);
  near(geometry.largePitchConeAngle + geometry.pinionPitchConeAngle,
    Math.PI / 2, 0, 'complementary pitch-cone angles');
  near(2 * geometry.largeGearPitchRadius / geometry.largeGearTeeth,
    geometry.bevelModule, 0, 'large gear module');
  near(2 * geometry.inputPinionPitchRadius / geometry.inputPinionTeeth,
    geometry.bevelModule, 0, 'input pinion module');
  near(Math.hypot(geometry.largeGearPitchRadius,
    geometry.largeOuterAxialDistance),
  geometry.commonConeDistance, 3e-16,
  'large cone slant distance');
  near(Math.hypot(geometry.inputPinionPitchRadius,
    geometry.pinionOuterAxialDistance),
  geometry.commonConeDistance, 3e-16,
  'pinion cone slant distance');
  vectorNear(large.position, geometry.bevelApex, 0,
    'large gear common apex');
  vectorNear(pinion.position, geometry.bevelApex, 0,
    'pinion common apex');
  vectorNear(large.userData.axis, Y_AXIS.clone().negate(), 0,
    'large downward cone axis');
  vectorNear(pinion.userData.axis, X_AXIS, 0,
    'horizontal pinion cone axis');
  assert.equal(large.userData.teeth, geometry.largeGearTeeth);
  assert.equal(pinion.userData.teeth, geometry.inputPinionTeeth);
  assert.equal(large.userData.toothMeshes.length,
    geometry.largeGearTeeth);
  assert.equal(pinion.userData.toothMeshes.length,
    geometry.inputPinionTeeth);
  near(geometry.bevelContactPoint.x - geometry.bevelApex.x,
    geometry.pinionOuterAxialDistance, 0,
    'contact pinion axial coordinate');
  near(geometry.bevelApex.y - geometry.bevelContactPoint.y,
    geometry.largeOuterAxialDistance, 0,
    'contact large-gear axial coordinate');
  disposeModel(model.root);
});

test('movement 375 right-angle pinion speed is exactly twice carrier speed and has zero pitch slip', () => {
  const model = createMovementModel(catalog.movements[374]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;

  assert.equal(transmission.bevelRatio, 1 / 2);
  near(geometry.inputAngularSpeed,
    2 * geometry.carrierAngularSpeed, 0,
    'two-to-one pinion speed');
  assert.match(transmission.bevelVelocityLaw, /18-tooth/);
  assert.match(transmission.bevelVelocityLaw, /36-tooth/);
  for (let sample = -900; sample <= 1800; sample += 1) {
    const time = geometry.carrierPeriod * sample / 900;
    const state = stateAtTime(time);
    near(state.inputAngle,
      geometry.inputStartAngle + geometry.inputAngularSpeed * time,
      0, 'uniform input-pinion angle');
    near(state.largeBevelLocalAngle, -state.carrierAngle, 0,
      'large downward-axis local angle gives positive Y rotation');
    vectorNear(state.bevelContact.inputPitchVelocity,
      state.bevelContact.largeGearPitchVelocity, 0,
      'equal bevel pitch velocities');
    near(state.bevelContact.noSlipError, 0, 0,
      'zero bevel pitch slip');
    vectorNear(state.bevelContact.point,
      geometry.bevelContactPoint, 0,
      'fixed common bevel contact point');
  }
  disposeModel(model.root);
});

test('movement 375 renderer binds the bevel input, vertical carrier, opposed radial runners, and all visible indices', () => {
  const model = createMovementModel(catalog.movements[374]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const fixedPanPosition = blocks.pan.position.clone();
  const fixedUpperFramePosition = blocks.upperFrame.position.clone();

  for (let frame = 0; frame <= 960; frame += 1) {
    const time = geometry.carrierPeriod * 3 * frame / 960;
    const expected = stateAtTime(time);
    model.update(time, 0.016);
    near(blocks.carrier.rotation.y, expected.carrierAngle, 0,
      'rendered carrier angle');
    for (const runner of blocks.edgeRunners) {
      near(runner.userData.rotor.rotation.z,
        expected.runnerSpinAngle, 0,
        'rendered runner local spin');
    }
    near(blocks.largeBevelGear.userData.rotor.rotation.z,
      expected.largeBevelLocalAngle, 0,
      'rendered large bevel local angle');
    near(blocks.inputPinion.userData.rotor.rotation.z,
      expected.inputAngle, 0,
      'rendered input pinion angle');
    near(blocks.inputShaftRotor.rotation.x,
      expected.inputAngle, 0,
      'rendered input shaft index angle');
    blocks.carrier.updateMatrixWorld(true);
    for (let index = 0; index < 2; index += 1) {
      const renderedCenter = blocks.edgeRunners[index]
        .getWorldPosition(new THREE.Vector3());
      vectorNear(renderedCenter, expected.runners[index].center,
        9e-16, `rendered runner ${index} center`);
    }
    vectorNear(blocks.pan.position, fixedPanPosition, 0,
      'pan remains fixed');
    vectorNear(blocks.upperFrame.position, fixedUpperFramePosition, 0,
      'upper frame remains fixed');
    assert.equal(data.rollingContacts.length, 2);
    near(data.bevelContact.noSlipError, 0, 0,
      'published renderer bevel contact');
  }
  disposeModel(model.root);
});

test('movement 375 closes two pinion turns, one carrier revolution, and one runner counter-turn before movement 507 remains authored', () => {
  const movement = catalog.movements[374];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(geometry.carrierPeriod);

  near(closure.inputAngle - start.inputAngle,
    2 * FULL_TURN, 0, 'two unwrapped pinion turns');
  near(closure.carrierAngle - start.carrierAngle,
    FULL_TURN, 0, 'one unwrapped carrier turn');
  near(closure.runnerSpinAngle - start.runnerSpinAngle,
    -FULL_TURN, 0, 'one unwrapped runner counter-turn');
  angleNear(closure.inputAngle, start.inputAngle, 0,
    'input pinion closes');
  angleNear(closure.carrierAngle, start.carrierAngle, 0,
    'carrier closes');
  angleNear(closure.runnerSpinAngle, start.runnerSpinAngle, 0,
    'both runner indices close');
  for (let index = 0; index < 2; index += 1) {
    vectorNear(closure.runners[index].center,
      start.runners[index].center, 3e-16,
      `runner ${index} center closes`);
    vectorNear(closure.runners[index].outwardAxis,
      start.runners[index].outwardAxis, 3e-16,
      `runner ${index} axis closes`);
  }
  assert.equal(timeline.demonstrationPeriod, geometry.carrierPeriod);
  assert.equal(data.animationTiming.authoredCyclePeriod,
    geometry.carrierPeriod);
  assert.ok(data.animationTiming.displayCycleDuration >= 6);
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
