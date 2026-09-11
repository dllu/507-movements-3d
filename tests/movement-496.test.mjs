import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const sourceText = await readFile(
  new URL(
    '../src/simulation/authored-throstle-spinning.js',
    import.meta.url,
  ),
  'utf8',
);

const ARCHETYPE =
  'differential-drawing-rolls-feeding-flyer-around-slower-bobbin';

function movementModel() {
  const movement = catalog.movements[495];
  return { model: createMovementModel(movement), movement };
}

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function dynamicCableEndpoints(cable) {
  const visible = cable.children.filter((segment) => segment.visible);
  assert.ok(visible.length > 1);
  cable.updateWorldMatrix(true, true);
  return {
    end: new THREE.Vector3(0, 0.5, 0)
      .applyMatrix4(visible.at(-1).matrixWorld),
    start: new THREE.Vector3(0, -0.5, 0)
      .applyMatrix4(visible[0].matrixWorld),
    visible,
  };
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

test('movement 496 has two A rolls, two B rolls, one flyer, and one bobbin', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom } = model.root.userData;

  assert.equal(movement.id, 496);
  assert.equal(movement.number, '496');
  assert.equal(movement.title,
    'Drawing and twisting in spinning cotton, wool, etc');
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.deepEqual(blocks.backRollsA, [
    blocks.backTopRoll,
    blocks.backBottomRoll,
  ]);
  assert.deepEqual(blocks.frontRollsB, [
    blocks.frontTopRoll,
    blocks.frontBottomRoll,
  ]);
  assert.equal(blocks.drawingRolls.length, 4);
  assert.ok(blocks.drawingRolls.every((roll) => roll.parent === model.root));
  assert.equal(blocks.flyerArms.length, 2);
  assert.ok(blocks.flyerArms.every(
    (arm) => arm.parent === blocks.flyerAssembly,
  ));
  assert.equal(blocks.flyerArmEye.parent, blocks.flyerAssembly);
  assert.equal(blocks.flyerTopEye.parent, blocks.flyerAssembly);
  assert.equal(blocks.bobbinBarrel.parent, blocks.bobbinAssembly);
  assert.equal(blocks.woundYarn.parent, blocks.bobbinAssembly);
  assert.equal(blocks.liveYarn.parent, model.root);
  assert.equal(blocks.liveYarn.userData.isYarn, true);
  assert.equal(degreesOfFreedom.independentDriveInputs, 1);
  assert.equal(degreesOfFreedom.independentRollCoordinates, 0);
  assert.equal(degreesOfFreedom.independentFlyerCoordinates, 0);
  assert.equal(degreesOfFreedom.independentBobbinCoordinates, 0);
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.doesNotMatch(sourceText, /makeMovingBelt|makeDynamicMovingBelt/);
  disposeModel(model.root);
});

test('movement 496 records Brown’s unavailable animation and Ure’s throstle account', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_496.html');
  assert.match(movement.description,
    /front drawing-rolls, B, rotate faster than the back ones, A.*produce a draught.*draw out the fibers.*passes from the front drawing-rolls to throstle.*rotation around the bobbin.*twists and winds the yarn/s);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /Movement 496.*unavailable/i);
  assert.deepEqual(sourceReference.officialEngraving.labels, {
    backDrawingRolls: 'A',
    frontDrawingRolls: 'B',
  });
  assert.deepEqual(sourceReference.historicalCorroboration.pages,
    [97, 98, 99, 100, 101]);
  assert.match(sourceReference.historicalCorroboration.title,
    /Cotton Manufacture of Great Britain.*Andrew Ure.*1836/);
  assert.match(sourceReference.historicalCorroboration.url,
    /archive\.org\/details\/cottonmanufactur02urea\/page\/n119/);
  assert.match(sourceReference.historicalCorroboration.detail,
    /drawing roving into slender thread.*rotating the spindle or flyer.*flyer eye.*bobbin drag.*wind/i);
  assert.match(sourceReference.reconstructionDisclosure,
    /no numerical ratios.*1:2 A-to-B.*6:4 flyer-to-bobbin.*equal front delivery and differential take-up/i);
  disposeModel(model.root);
});

test('movement 496 counterrotates each nip pair while B drafts at twice A’s speed', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, transmission } = model.root.userData;

  assert.equal(transmission.topAndBottomRollsCounterrotate, true);
  assert.equal(transmission.backTurnsPerCycle, 1);
  assert.equal(transmission.frontTurnsPerCycle, 2);
  assert.equal(transmission.draftRatio, 2);
  near(transmission.frontDeliverySpeed,
    2 * transmission.backDeliverySpeed, 2e-16,
    'front delivery is twice back delivery');
  for (let sample = -360; sample <= 720; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 360);
    near(state.backBottomRollAngle, -state.backTopRollAngle, 0,
      `A opposed rotation ${sample}`);
    near(state.frontBottomRollAngle, -state.frontTopRollAngle, 0,
      `B opposed rotation ${sample}`);
    vectorNear(state.backTopNipVelocity,
      state.backBottomNipVelocity, 0,
      `A matching nip velocity ${sample}`);
    vectorNear(state.frontTopNipVelocity,
      state.frontBottomNipVelocity, 0,
      `B matching nip velocity ${sample}`);
    near(state.backTopNipVelocity.x, state.backDeliverySpeed, 0,
      `A advances right ${sample}`);
    near(state.frontTopNipVelocity.x, state.frontDeliverySpeed, 0,
      `B advances right ${sample}`);
    near(state.draftRatio, 2, 0, `draft ratio ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 496 matches front-roll delivery to flyer-minus-bobbin take-up exactly', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, transmission } = model.root.userData;

  assert.equal(transmission.flyerTurnsPerCycle, 6);
  assert.equal(transmission.bobbinTurnsPerCycle, 4);
  near(transmission.flyerBobbinRelativeAngularSpeed,
    transmission.frontAngularSpeed, 5e-16,
    'relative flyer speed equals two-turn front-roll speed');
  near(transmission.windingTakeUpSpeed,
    transmission.frontDeliverySpeed, 3e-16,
    'differential winding take-up closes front feed');
  near(transmission.windingSpeedClosureError, 0, 3e-16,
    'published winding speed closure');
  for (let sample = 0; sample <= 720; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 720);
    near(state.relativeWindingAngle,
      state.flyerAngle - state.bobbinAngle, 0,
      `relative angle ${sample}`);
    near(state.windingContactAngleInBobbinFrame,
      state.relativeWindingAngle, 0,
      `contact traverses bobbin frame ${sample}`);
    near(state.windingTakeUpSpeed, state.frontDeliverySpeed, 3e-16,
      `take-up speed ${sample}`);
    near(state.windingSpeedClosureError, 0, 3e-16,
      `take-up closure ${sample}`);
    near(state.windingContact.clone().sub(geometry.spindleOrigin)
      .setY(0).length(), geometry.windingRadius, 2e-15,
    `contact stays on bobbin cylinder ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 496 live yarn is a smooth closed-cycle path fixed to both guides', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;

  const initialPoints = stateAtTime(0).liveYarnPoints;
  const closurePoints = stateAtTime(geometry.cycleDuration).liveYarnPoints;
  assert.equal(initialPoints.length, 37);
  assert.equal(closurePoints.length, 37);
  initialPoints.forEach((point, index) => {
    vectorNear(closurePoints[index], point, 4e-14,
      `yarn cycle closure point ${index}`);
  });
  let previousEye = null;
  let previousContact = null;
  const timeStep = geometry.cycleDuration / 3600;
  for (let sample = 0; sample <= 3600; sample += 1) {
    const time = timeStep * sample;
    const state = stateAtTime(time);
    vectorNear(state.liveYarnPoints[0], geometry.frontNip, 0,
      `yarn begins at B nip ${sample}`);
    vectorNear(state.liveYarnPoints.at(-1), state.windingContact, 5e-15,
      `yarn ends on bobbin ${sample}`);
    assert.ok(state.liveYarnCurve.getLength() > 4.0);
    assert.ok(state.liveYarnCurve.getLength() < 4.3);
    if (previousEye) {
      assert.ok(state.flyerEye.distanceTo(previousEye) < 0.009,
        `flyer eye motion is continuous ${sample}`);
      assert.ok(state.windingContact.distanceTo(previousContact) < 0.006,
        `winding contact motion is continuous ${sample}`);
    }
    previousEye = state.flyerEye;
    previousContact = state.windingContact;
  }

  for (const time of [0, 0.31, 1.27, 2.73, 4.49, 5.99]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    const endpoints = dynamicCableEndpoints(blocks.liveYarn);
    vectorNear(endpoints.start, geometry.frontNip, 2e-14,
      `rendered yarn starts at B nip ${time}`);
    vectorNear(endpoints.end, state.windingContact, 2e-14,
      `rendered yarn reaches bobbin ${time}`);
    assert.equal(endpoints.visible.length, 36);
  }
  disposeModel(model.root);
});

test('movement 496 renderer binds every roll, flyer, and bobbin to the exact state', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 240; sample += 1) {
    const time = geometry.cycleDuration * sample / 240;
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.backTopRoll.rotation.z, state.backTopRollAngle, 0,
      `back top render ${sample}`);
    near(blocks.backBottomRoll.rotation.z, state.backBottomRollAngle, 0,
      `back bottom render ${sample}`);
    near(blocks.frontTopRoll.rotation.z, state.frontTopRollAngle, 0,
      `front top render ${sample}`);
    near(blocks.frontBottomRoll.rotation.z, state.frontBottomRollAngle, 0,
      `front bottom render ${sample}`);
    near(blocks.flyerAssembly.rotation.y, state.flyerAngle, 0,
      `flyer render ${sample}`);
    near(blocks.bobbinAssembly.rotation.y, state.bobbinAngle, 0,
      `bobbin render ${sample}`);
    assert.equal(model.root.userData.contacts.backNip.point,
      geometry.backNip);
    assert.equal(model.root.userData.contacts.frontNip.point,
      geometry.frontNip);
    near(model.root.userData.contacts.windingContact.speedClosureError,
      0, 3e-16, `rendered winding closure ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 496 closes all integer turns, fits all poses, and leaves movement 507 next', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, transmission } = model.root.userData;
  const initial = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  near((closure.backTopRollAngle - initial.backTopRollAngle)
    / (Math.PI * 2), 1, 2e-16, 'one back-roll turn');
  near((closure.frontTopRollAngle - initial.frontTopRollAngle)
    / (Math.PI * 2), 2, 4e-16, 'two front-roll turns');
  near((closure.flyerAngle - initial.flyerAngle)
    / (Math.PI * 2), 6, 9e-16, 'six flyer turns');
  near((closure.bobbinAngle - initial.bobbinAngle)
    / (Math.PI * 2), 4, 8e-16, 'four bobbin turns');
  near(transmission.verifiedRelativeWindingTurns, 2, 5e-16,
    'two relative winding turns');

  const swept = new THREE.Box3();
  for (let sample = 0; sample <= 480; sample += 1) {
    model.update(geometry.cycleDuration * sample / 480);
    model.root.updateMatrixWorld(true);
    swept.union(new THREE.Box3().setFromObject(model.root));
  }
  assert.ok(model.root.userData.cameraFitBounds.containsBox(swept));
  assert.ok(Number.isFinite(swept.min.x));
  assert.ok(Number.isFinite(swept.max.z));
  assert.ok(model.root.userData.groundFloorY <= swept.min.y + 1e-12);

  const next = catalog.movements[506];
  const nextModel = createMovementModel(next);
  assert.equal(next.id, 507);
  assert.equal(next.number, '507');
  assert.match(next.title, /very slow motion/);
  assert.equal(next.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(next.fidelity, 'authored');
  assert.equal(nextModel.root.userData.fidelity, 'authored');
  assert.notEqual(nextModel.root.userData.archetype, ARCHETYPE);
  disposeModel(nextModel.root);
  disposeModel(model.root);
});
