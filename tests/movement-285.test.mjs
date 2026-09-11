import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
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

test('movement 285 separates the retained handwheel screw from the keyed traveling quill', () => {
  const movement = catalog.movements[284];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 285);
  assert.equal(movement.number, '285');
  assert.equal(movement.title,
    'Handwheel Leadscrew Tailstock Center Feed');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'handwheel-retained-leadscrew-keyed-tailstock-quill-center-feed');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /handwheel is rigidly fixed/);
  assert.match(mechanism, /axially retained right-hand leadscrew/);
  assert.match(mechanism, /nonrotating nut/);
  assert.match(mechanism, /neither the quill nor center rotates/);
  assert.equal(transmission.handwheelAndScrewRigidlyCoaxial, true);
  assert.equal(transmission.screwAxiallyRetained, true);
  assert.equal(transmission.quillRotation, 0);

  assert.equal(blocks.screw.parent, model.root);
  assert.equal(blocks.handwheel.parent, blocks.screw);
  assert.equal(blocks.externalThread.parent, blocks.screw);
  assert.equal(blocks.thrustCollar.parent, blocks.screw);
  assert.equal(blocks.quill.parent, model.root);
  assert.equal(blocks.nut.parent, blocks.quill);
  assert.equal(blocks.internalThread.parent, blocks.quill);
  assert.equal(blocks.centerCone.parent, blocks.quill);
  assert.equal(blocks.centerShank.parent, blocks.quill);
  assert.equal(blocks.quillKey.parent, blocks.quill);
  assert.equal(blocks.fixedKeyGuide.parent, blocks.frame);
  vectorNear(blocks.screw.userData.axis, X_AXIS, 0, 'screw axis');
  vectorNear(blocks.handwheel.userData.axis, X_AXIS, 0,
    'handwheel axis');
  vectorNear(blocks.quill.userData.axis, X_AXIS, 0, 'quill axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'one-continuous-visible-right-hand-leadscrew-thread').length,
  1);
  assert.equal(roles.filter((role) =>
    role === 'matching-internal-thread-rigid-with-quill-nut').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'pointed-lathe-center-fixed-in-quill').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 285 records its cutaway measurements and unavailable source animation', () => {
  const movement = catalog.movements[284];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate285;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /marks its animation unavailable/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_285.html');
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 6);
  assert.deepEqual(plate.rasterAxisOrigin, { x: 282, y: 219 });
  assert.deepEqual(plate.rasterCenterTip, { x: 39, y: 219 });
  assert.deepEqual(plate.rasterQuillNose, { x: 147, y: 219 });
  assert.deepEqual(plate.rasterThreadLeft, { x: 169, y: 219 });
  assert.deepEqual(plate.rasterThreadRight, { x: 397, y: 219 });
  assert.deepEqual(plate.rasterHandwheelCenter, { x: 443, y: 219 });
  assert.deepEqual(plate.rasterHandwheelTop, { x: 443, y: 119 });
  assert.deepEqual(plate.rasterHandwheelBottom, { x: 443, y: 320 });
  assert.match(plate.inferredTopology, /edge-view rear handwheel/);
  assert.match(plate.inferredTopology, /axially retained screw/);
  assert.match(plate.inferredTopology, /keyed cylindrical quill/);
  vectorNear(sourcePointToModel(plate.rasterAxisOrigin),
    new THREE.Vector2(0, 0), 0, 'source axis origin');
  near(geometry.handwheelRadius / geometry.sourceScale, 100.5, 0,
    'measured handwheel radius');
  near(geometry.threadLength / geometry.sourceScale, 228, 0,
    'measured visible thread length');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 75,
    edition: 21,
    illustrationPage: 74,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 285 builds one continuous twenty-three-turn thread with positive clearance', () => {
  const model = createMovementModel(catalog.movements[284]);
  const {
    curves,
    geometry,
  } = model.root.userData;

  assert.equal(geometry.threadStarts, 1);
  assert.equal(geometry.threadTurnCount, 23);
  near(geometry.threadLength,
    geometry.threadPitch * geometry.threadTurnCount, 0,
    'thread turns fill measured length');
  near(geometry.threadLead, geometry.threadPitch, 0,
    'single-start lead');
  assert.ok(geometry.threadRadialClearance > 0.025);
  assert.ok(geometry.threadRadialClearance < 0.035);
  assert.ok(geometry.threadSegments >= 23 * 24);

  const start = curves.externalThread.getPoint(0);
  const end = curves.externalThread.getPoint(1);
  near(start.x, geometry.threadMinimumX, 0, 'thread start x');
  near(end.x, geometry.threadMaximumX, 0, 'thread end x');
  near(Math.hypot(start.y, start.z), geometry.externalThreadRadius, 0,
    'thread start radius');
  near(Math.hypot(end.y, end.z), geometry.externalThreadRadius, 3e-16,
    'thread end radius');
  vectorNear(new THREE.Vector2(end.y, end.z),
    new THREE.Vector2(start.y, start.z), 5e-15,
    'twenty-three-turn phase closure');
  let previousX = -Infinity;
  for (let index = 0; index <= 2300; index += 1) {
    const point = curves.externalThread.getPoint(index / 2300);
    assert.ok(point.x >= previousX,
      `right-hand helix remains single-valued at ${index}`);
    near(Math.hypot(point.y, point.z), geometry.externalThreadRadius,
      3e-16, `thread radius at ${index}`);
    previousX = point.x;
  }
  disposeModel(model.root);
});

test('movement 285 performs four turns outward, dwells, reverses, and dwells', () => {
  const model = createMovementModel(catalog.movements[284]);
  const {
    geometry,
    stateAtCyclePhase,
    timeline,
  } = model.root.userData;
  const start = stateAtCyclePhase(0);
  const outerStart = stateAtCyclePhase(0.42);
  const outerMiddle = stateAtCyclePhase(0.46);
  const returnStart = stateAtCyclePhase(0.5);
  const innerStart = stateAtCyclePhase(0.92);
  const innerMiddle = stateAtCyclePhase(0.96);
  const closure = stateAtCyclePhase(1);

  assert.equal(timeline.outwardStrokeFraction, 0.42);
  assert.equal(timeline.outerDwellFraction, 0.08);
  assert.equal(timeline.inwardStrokeFraction, 0.42);
  assert.equal(timeline.innerDwellFraction, 0.08);
  assert.deepEqual(timeline.schedule, [
    'four-turn-outward-feed',
    'outer-end-dwell',
    'four-turn-inward-return',
    'inner-end-dwell',
  ]);
  near(start.driverAngle, 0, 0, 'initial handwheel angle');
  near(outerStart.driverAngle, geometry.screwAngularTravel, 0,
    'four-turn outer endpoint');
  near(outerMiddle.driverAngle, geometry.screwAngularTravel, 0,
    'outer dwell angle');
  near(returnStart.driverAngle, geometry.screwAngularTravel, 0,
    'return start angle');
  near(innerStart.driverAngle, 0, 0, 'inner endpoint angle');
  near(innerMiddle.driverAngle, 0, 0, 'inner dwell angle');
  near(closure.driverAngle, start.driverAngle, 0,
    'handwheel cycle closure');
  for (const state of [start, outerStart, outerMiddle, returnStart,
    innerStart, innerMiddle, closure]) {
    near(state.driverAngularSpeed, 0, 0,
      `${state.stage} endpoint speed`);
    near(state.driverAngularAcceleration, 0, 1e-13,
      `${state.stage} endpoint acceleration`);
  }
  assert.ok(stateAtCyclePhase(0.21).driverAngularSpeed > 0);
  assert.ok(stateAtCyclePhase(0.71).driverAngularSpeed < 0);
  disposeModel(model.root);
});

test('movement 285 enforces exact lead, phase, bearing, and keyed-guide constraints', () => {
  const model = createMovementModel(catalog.movements[284]);
  const {
    geometry,
    stateAtCyclePhase,
    transmission,
  } = model.root.userData;

  assert.equal(transmission.threadHand, 'right-hand');
  near(transmission.axialTravelPerHandwheelTurn, geometry.threadLead, 0,
    'declared travel per turn');
  assert.match(transmission.screwLaw,
    /quill-displacement = -driver-angle/);
  for (let index = 0; index <= 4000; index += 1) {
    const state = stateAtCyclePhase(index / 1000);
    near(state.quillDisplacement,
      -geometry.threadLeadPerRadian * state.driverAngle, 0,
    `lead law at ${index}`);
    near(state.axialConstraintError, 0, 0,
      `axial error at ${index}`);
    near(state.phaseConstraintError, 0, 4e-15,
      `phase error at ${index}`);
    near(state.screwAxialDisplacement, 0, 0,
      `retained screw at ${index}`);
    near(state.spindleAngularSpeed, 0, 0,
      `keyed quill rotation at ${index}`);
    near(state.threadFlankNormalVelocityError, 0, 2e-15,
      `flank normal velocity at ${index}`);
    near(state.threadRadialNormalVelocityError, 0, 2e-15,
      `radial normal velocity at ${index}`);
    near(state.centerTipX - state.quillDisplacement, -3.402, 8e-16,
      `center rigid with quill at ${index}`);
  }
  const outer = stateAtCyclePhase(0.42);
  near(outer.quillDisplacement, -geometry.quillTravel, 0,
    'four-lead outward travel');
  near(outer.quillX, geometry.quillMinimumX, 0,
    'outer quill limit');
  disposeModel(model.root);
});

test('movement 285 analytic screw and quill rates agree with finite differences', () => {
  const model = createMovementModel(catalog.movements[284]);
  const {
    geometry,
    stateAtTime,
  } = model.root.userData;
  const step = 1e-5;
  for (const time of [0.4, 1.2, 2.3, 4.4, 5.4, 6.7]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    near((after.driverAngle - before.driverAngle) / (2 * step),
      state.driverAngularSpeed, 2e-8,
    `driver rate at ${time}`);
    near((after.quillX - before.quillX) / (2 * step),
      state.quillVelocity, 7e-10,
    `quill rate at ${time}`);
    near((after.quillVelocity - before.quillVelocity) / (2 * step),
      state.quillAcceleration, 3e-8,
    `quill acceleration at ${time}`);
    near(state.quillVelocity,
      -geometry.threadLeadPerRadian * state.driverAngularSpeed, 0,
    `instantaneous lead rate at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 285 rendered handwheel, screw, quill, nut, and center follow one state', () => {
  const model = createMovementModel(catalog.movements[284]);
  const {
    blocks,
    stateAtTime,
  } = model.root.userData;
  for (const time of [0, 0.8, 2.4, 3.6, 4.8, 6.4, 8]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.screw.rotation.x, expected.driverAngle, 0,
      `rendered screw at ${time}`);
    near(blocks.quill.position.x, expected.quillX, 0,
      `rendered quill at ${time}`);
    near(blocks.quill.rotation.x, 0, 0,
      `rendered keyed rotation at ${time}`);
    vectorNear(blocks.quill.userData.velocity,
      new THREE.Vector3(expected.quillVelocity, 0, 0), 0,
    `rendered quill velocity at ${time}`);
    near(blocks.screw.userData.axialDisplacement, 0, 0,
      `rendered screw retention at ${time}`);
    vectorNear(blocks.threadContactMarker.position,
      expected.threadContactPoint, 0,
    `rendered thread contact at ${time}`);
    near(model.root.userData.contacts.screwThread.axialConstraintError,
      0, 0, `rendered thread axial error at ${time}`);
    near(model.root.userData.contacts.quillKeyGuide.lineError,
      0, 0, `rendered key line error at ${time}`);
    near(model.root.userData.contacts.quillKeyGuide.rotationError,
      0, 0, `rendered key rotation error at ${time}`);
    model.root.updateMatrixWorld(true);
    const renderedTip = blocks.centerCone.localToWorld(
      new THREE.Vector3(0, 0.52, 0),
    );
    const localTip = model.root.worldToLocal(renderedTip);
    near(localTip.x, expected.centerTipX, 8e-16,
      `rendered center tip at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 285 closes exactly while movement 339 remains the next authored draft', () => {
  const model = createMovementModel(catalog.movements[284]);
  const {
    blocks,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.cyclePeriod);
  assert.equal(closure.cycleIndex, 1);
  assert.equal(closure.cyclePhase, 0);
  assert.equal(closure.stage, start.stage);
  near(closure.driverAngle, start.driverAngle, 0,
    'driver cycle closure');
  near(closure.quillX, start.quillX, 0, 'quill cycle closure');
  near(closure.centerTipX, start.centerTipX, 0,
    'center cycle closure');

  model.update(0);
  const startScrew = blocks.screw.quaternion.clone();
  const startQuill = blocks.quill.position.clone();
  model.update(timeline.cyclePeriod);
  near(blocks.screw.quaternion.angleTo(startScrew), 0, 0,
    'rendered screw closure');
  vectorNear(blocks.quill.position, startQuill, 0,
    'rendered quill closure');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
