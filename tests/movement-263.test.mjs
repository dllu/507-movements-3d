import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
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

test('movement 263 is the side view of the paired eccentric cone reverser', () => {
  const movement = catalog.movements[262];
  const model = createMovementModel(movement);
  const {
    archetype,
    fidelity,
    mechanism,
    pairedMechanismKey,
    presentationView,
  } = model.root.userData;

  assert.equal(movement.id, 263);
  assert.equal(movement.number, '263');
  assert.equal(
    movement.title,
    'Eccentric Screw-Cone Friction Reverser — Side View',
  );
  assert.equal(movement.category, 'Friction drives');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'fixed-nut-screw-translated-eccentric-cone-edge-contact-friction-roller-reverser',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(presentationView, 'side-view');
  assert.equal(
    pairedMechanismKey,
    'movements-262-263-eccentric-screw-cone-friction-reverser',
  );
  assert.match(mechanism, /one-lead-per-turn-translation/);
  assert.match(mechanism, /reciprocates-it-with-unequal-rise-and-fall/);
  disposeModel(model.root);
});

test('movements 262 and 263 share one mechanism but use distinct source views', () => {
  const endView = createMovementModel(catalog.movements[261]);
  const sideView = createMovementModel(catalog.movements[262]);
  const endData = endView.root.userData;
  const sideData = sideView.root.userData;

  assert.equal(endData.presentationView, 'end-view');
  assert.equal(sideData.presentationView, 'side-view');
  assert.equal(endData.pairedMechanismKey, sideData.pairedMechanismKey);
  assert.equal(endData.archetype, sideData.archetype);
  assert.deepEqual(endData.geometry, sideData.geometry);
  assert.deepEqual(endData.sourceReference, sideData.sourceReference);
  assert.deepEqual(endData.contactDefinition, sideData.contactDefinition);
  assert.ok(Math.abs(endView.cameraDirection.x)
    > Math.abs(endView.cameraDirection.z));
  assert.ok(Math.abs(sideView.cameraDirection.z)
    > Math.abs(sideView.cameraDirection.x) * 4);
  // 262 looks along the screw at B's large end: D's boss on B's face and
  // standard E behind B with only its feet showing, as Brown draws them.
  assert.ok(endView.cameraDirection.x < 0);
  assert.ok(sideView.cameraDirection.z > 0);
  disposeModel(sideView.root);
  disposeModel(endView.root);
});

test('movement 263 reproduces the measured side-view taper and axial stack', () => {
  const model = createMovementModel(catalog.movements[262]);
  const { geometry, sourceReference } = model.root.userData;
  const side = sourceReference.plate262263.rasterSideView;
  const rasterConeLength = side.coneSmallEndX - side.coneLargeEndX;
  const rasterContactFraction = (
    side.rollerCenterX - side.coneLargeEndX
  ) / rasterConeLength;

  near(
    geometry.coneSmallRadius / geometry.coneLargeRadius,
    side.coneSmallRadius / side.coneLargeRadius,
    0.02,
    'side-view cone taper',
  );
  near(
    geometry.rollerRadius / geometry.coneLargeRadius,
    side.rollerOuterRadius / side.coneLargeRadius,
    0.003,
    'side-view roller scale',
  );
  near(
    geometry.screwLead / geometry.coneLength,
    side.screwThreadPitch / rasterConeLength,
    0.001,
    'side-view screw pitch',
  );
  near(
    model.root.userData.driveSchedule.sourceIllustratedContactAxialFraction,
    rasterContactFraction,
    0,
    'engraved contact station',
  );
  assert.ok(side.fixedNutCenterX > side.coneSmallEndX);
  assert.ok(geometry.nutAxialPosition > geometry.coneLength / 2);
  assert.ok(geometry.screwThreadXStart > geometry.coneLength / 2);
  disposeModel(model.root);
});

test('movements 262 and 263 produce identical exact states at every input pose', () => {
  const endView = createMovementModel(catalog.movements[261]);
  const sideView = createMovementModel(catalog.movements[262]);
  const endTransmission = endView.root.userData.transmission;
  const sideTransmission = sideView.root.userData.transmission;
  const maximumInputAngle = endView.root.userData.geometry.maximumInputAngle;

  for (let sample = 0; sample <= 4096; sample += 1) {
    const inputAngle = maximumInputAngle * sample / 4096;
    const endState = endTransmission.configurationAtInputAngle(inputAngle);
    const sideState = sideTransmission.configurationAtInputAngle(inputAngle);
    for (const key of [
      'bodyContactAngle',
      'circumferentialNoSlipResidual',
      'coneRadiusAtContact',
      'contactAxialFraction',
      'contactNormalAngle',
      'localContactAxialPosition',
      'rollerAngleUnwrapped',
      'rollerAngularRatio',
      'rollerCenterY',
      'screwTranslation',
      'screwThreadPhaseAtNut',
    ]) {
      near(sideState[key], endState[key], 0,
        `${key} paired identity at ${sample}`);
    }
    for (const key of [
      'coneAxisCenterAtContact',
      'coneContactPoint',
      'contactNormal',
      'localConeContactPoint',
      'rollerCenter',
      'rollerContactPoint',
    ]) {
      near(sideState[key].distanceTo(endState[key]), 0, 0,
        `${key} paired identity at ${sample}`);
    }
  }
  disposeModel(sideView.root);
  disposeModel(endView.root);
});

test('movement 263 side view exposes the parallel axes and clear contact edge', () => {
  const model = createMovementModel(catalog.movements[262]);
  const { blocks, geometry } = model.root.userData;

  assert.deepEqual(blocks.screwConeAssembly.userData.axis.toArray(), [1, 0, 0]);
  assert.deepEqual(blocks.rollerRotor.userData.axis.toArray(), [1, 0, 0]);
  assert.equal(blocks.coneBody.rotation.z, Math.PI / 2);
  assert.equal(
    blocks.coneBody.userData.axisOffsetFromScrew,
    geometry.coneEccentricity,
  );
  assert.equal(
    blocks.rollerBody.userData.contactEdgeLocalX,
    -geometry.rollerWidth / 2,
  );
  assert.ok(geometry.minimumRollerFaceClearance > 0);
  assert.ok(geometry.minimumThreadToConeAxialGap > 0);
  assert.ok(geometry.minimumScrewCoreToRollerAxialClearance > 0);
  assert.equal(blocks.leftInputJournal.parent, blocks.screwCore);
  assert.equal(blocks.rightScrewCore.parent, blocks.screwCore);
  assert.equal(blocks.nut.parent, blocks.frame);
  assert.notEqual(blocks.nut.parent, blocks.screwConeAssembly);
  disposeModel(model.root);
});

test('movement 263 keeps six reversals of the roller\'s rise and fall', () => {
  const model = createMovementModel(catalog.movements[262]);
  const {
    geometry,
    strokeAnalysis,
    transmission,
  } = model.root.userData;
  let maximumNoSlipError = 0;
  let minimumRatio = Infinity;
  let maximumRatio = -Infinity;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const inputAngle = geometry.maximumInputAngle * sample / 8192;
    const configuration = transmission.configurationAtInputAngle(inputAngle);
    maximumNoSlipError = Math.max(
      maximumNoSlipError,
      Math.abs(configuration.circumferentialNoSlipResidual),
    );
    minimumRatio = Math.min(minimumRatio, configuration.rollerAngularRatio);
    maximumRatio = Math.max(maximumRatio, configuration.rollerAngularRatio);
  }
  assert.ok(maximumNoSlipError < 7e-16);
  assert.ok(minimumRatio < -3.6);
  assert.ok(maximumRatio < -1.8);
  assert.equal(strokeAnalysis.directionChangeAngles.length, 6);
  for (let turn = 0; turn < 3; turn += 1) {
    const roots = strokeAnalysis.directionChangeAngles.filter((angle) => (
      angle > turn * FULL_TURN && angle < (turn + 1) * FULL_TURN
    ));
    assert.equal(roots.length, 2);
  }
  assert.ok(
    strokeAnalysis.shorterDirectionTravel
      < strokeAnalysis.longerDirectionTravel,
  );
  disposeModel(model.root);
});

test('movement 263 renderer binds the shared side-view assembly exactly', () => {
  const model = createMovementModel(catalog.movements[262]);
  const { blocks, stateAtTime, timeline } = model.root.userData;

  for (const time of [0, 0.8, 2.4, 4.8, 6, 7.2, 9.6, 11.2, 12]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.screwConeAssembly.position.x, state.screwTranslation, 0,
      `side-view screw translation at ${time}`);
    near(blocks.screwConeAssembly.rotation.x, state.inputAngle, 0,
      `side-view cone rotation at ${time}`);
    near(blocks.rollerCarriage.position.y, state.rollerCenter.y, 0,
      `side-view roller height at ${time}`);
    near(blocks.rollerRotor.rotation.x, state.rollerAngle, 0,
      `side-view roller phase at ${time}`);
    near(blocks.contactMarker.position.distanceTo(state.contactPoint), 0, 0,
      `side-view contact marker at ${time}`);
    assert.equal(blocks.contactSpring, undefined);
  }
  assert.equal(timeline.forwardTraverseEnd, 6);
  assert.equal(timeline.reverseReturnEnd, 12);
  disposeModel(model.root);
});

test('movement 263 closes with 262 and leaves movement 507 authored', () => {
  const endView = createMovementModel(catalog.movements[261]);
  const sideView = createMovementModel(catalog.movements[262]);
  const sideData = sideView.root.userData;
  const start = sideData.stateAtTime(0);
  const closure = sideData.stateAtTime(sideData.timeline.cycleClosure);

  for (const key of [
    'inputAngleUnwrapped',
    'inputAngularSpeed',
    'rollerAngleUnwrapped',
    'rollerAngularSpeed',
    'screwTranslation',
    'screwTranslationSpeed',
  ]) {
    near(closure[key], start[key], 0, `${key} side-view closure`);
  }
  near(closure.rollerCenter.distanceTo(start.rollerCenter), 0, 0,
    'side-view roller center closure');
  assert.deepEqual(
    endView.root.userData.strokeAnalysis.directionChangeAngles,
    sideData.strokeAnalysis.directionChangeAngles,
  );
  near(sideData.animationTiming.authoredCyclePeriod, 12, 0,
    'authored cycle period');
  near(sideData.animationTiming.targetCycleDuration, 2, 0,
    'display period');
  assertReadableTiming(sideData.animationTiming);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(sideView.root);
  disposeModel(endView.root);
});

test('p106: standard E has one round boss head concentric with screw D with nut E seated in it', () => {
  const model = createMovementModel(catalog.movements.find((entry) => entry.id === 263));
  try {
    let post = null;
    let nut = null;
    model.root.traverse((object) => {
      if (object.userData.role === 'source-footed-standard-E-carrying-nut') post = object;
      if (object.userData.role === 'fixed-threaded-nut-E') nut = object;
    });
    assert.ok(post && nut);
    post.geometry.computeBoundingBox();
    const box = post.geometry.boundingBox;
    near(box.max.y, 0.42, 1e-3, 'boss crown on the screw axis');
    // No material inside the bore (radius 0.306) near the screw axis.
    const position = post.geometry.getAttribute('position');
    let insideBore = 0;
    for (let index = 0; index < position.count; index += 1) {
      const y = position.getY(index), z = position.getZ(index);
      if (Math.hypot(y, z) < 0.3 && Math.abs(position.getX(index)) < 0.12) insideBore += 1;
    }
    assert.equal(insideBore, 0);
  } finally {
    disposeModel(model.root);
  }
});
