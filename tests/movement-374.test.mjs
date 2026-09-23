import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
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

test('movement 374 is one right-pivoted treadle roller driving one round shaft eccentric through one endless band', () => {
  const movement = catalog.movements[373];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 374);
  assert.equal(movement.number, '374');
  assert.equal(movement.category, 'Cams & followers');
  assert.equal(
    movement.archetype,
    'treadle-roller-endless-band-eccentric-shaft-drive',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-foot-treadle/);
  assert.match(data.mechanism, /one-free-roller/);
  assert.match(data.mechanism, /one-constant-length-endless-band/);
  assert.match(data.mechanism, /one-round-pulley-mounted-eccentrically/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.input, /foot treadle/);
  assert.match(degreesOfFreedom.input, /parameterized by continuous shaft angle/);

  for (const component of [
    blocks.belt,
    blocks.shaftBearing,
    blocks.shaftRotor,
    blocks.treadle,
    blocks.treadlePivotBearing,
    blocks.treadlePivotPin,
  ]) assert.ok(component.parent === model.root, `${component.userData.role} parent`);
  assert.ok(blocks.base.parent === null, 'source presentation removes base');
  assert.ok(blocks.shaftPost.parent === null, 'source presentation removes shaftPost');
  assert.ok(blocks.pivotPost.parent === null, 'source presentation removes pivotPost');
  for (const component of [
    blocks.eccentricPulley,
    blocks.shaftIndex,
    blocks.shaftPin,
  ]) assert.ok(component.parent === blocks.shaftRotor, `${component.userData.role} parent`);
  for (const component of [
    blocks.footPad,
    blocks.rollerAxle,
    blocks.treadleBeam,
    blocks.treadleRoller,
  ]) assert.ok(component.parent === blocks.treadle, `${component.userData.role} parent`);
  for (const component of [
    blocks.eccentricWrap,
    blocks.lowerStraightRun,
    blocks.rollerWrap,
    blocks.upperStraightRun,
  ]) assert.ok(component.parent === blocks.belt, `${component.userData.role} parent`);

  const belts = [];
  const beltBeads = [];
  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.beltBead) beltBeads.push(object);
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.deepEqual(belts, [blocks.belt]);
  assert.deepEqual(beltBeads, []);
  assert.equal(blocks.belt.children.length, 4);
  for (const role of [
    'circular-pulley-mounted-eccentrically-on-output-shaft',
    'free-spinning-belt-roller-carried-on-moving-treadle',
    'oscillating-treadle-pivoted-at-right-hand-fixed-fulcrum',
    'one-constant-length-endless-band-linking-treadle-roller-and-eccentric',
    'white-index-showing-continuous-output-shaft-rotation',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 374 records Brown\'s description, measured plate, and the official animation geometry without claiming physical timing', () => {
  const movement = catalog.movements[373];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate374;
  const evidence = sourceReference.constructionEvidence;
  const animation = sourceReference.officialAnimationGeometry;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_374.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Rotary motion of shaft from treadle/);
  assert.match(movement.description, /endless band/);
  assert.match(movement.description, /roller on the treadle/);
  assert.match(movement.description, /eccentric on the shaft/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.sourcePrescribesRelativeGeometryAndPhase, true);
  assert.equal(sourceAnimation.sourcePrescribedPhysicalTiming, false);
  assert.equal(
    dynamics.sourceSpecifiesPhysicalScaleSpeedBeltThicknessOrInertia,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);
  assert.match(dynamics.treatment, /moving-belt transport/);
  assert.match(dynamics.treatment, /analytically/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.deepEqual(plate.shaftCenter.toArray(), [293, 101]);
  assert.deepEqual(plate.eccentricPulleyCenter.toArray(), [251, 101]);
  assert.deepEqual(plate.alternateEccentricCenter.toArray(), [341, 106]);
  assert.equal(plate.eccentricPulleyRadiusPixels, 89);
  assert.deepEqual(plate.treadleRollerCenter.toArray(), [238, 386]);
  assert.equal(plate.treadleRollerRadiusPixels, 27);
  assert.deepEqual(plate.treadlePivot.toArray(), [417, 425]);
  assert.deepEqual(animation.shaftCenter.toArray(), [0, 0]);
  assert.deepEqual(animation.eccentricCenterAtZero.toArray(), [-2.5, 0]);
  assert.equal(animation.eccentricity, 2.5);
  assert.equal(animation.eccentricPulleyRadius, 5);
  assert.equal(animation.lowerRollerRadius, 1.5);
  assert.deepEqual(animation.lowerRollerRestCenter.toArray(),
    [0, -16.60615]);
  assert.deepEqual(animation.treadlePivot.toArray(),
    [14.469675, -16.60615]);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.engravingEvidence, /two runs of the same band/);
  assert.match(evidence.reconstructionDisclosure, /no belt beads/);
  assert.match(evidence.reconstructionDisclosure, /rather than copied/);
  disposeModel(model.root);
});

test('movement 374 solves the eccentric-center link and treadle arc as the correct continuous circle-circle branch', () => {
  const model = createMovementModel(catalog.movements[373]);
  const data = model.root.userData;
  const { circleIntersections, geometry, stateAtTime } = data;
  const start = stateAtTime(0);

  vectorNear(start.eccentricCenter, geometry.restEccentricCenter, 0,
    'source rest eccentric center');
  vectorNear(start.rollerCenter, geometry.restRollerCenter, 8e-16,
    'source rest roller center');
  near(start.centerlineAngle, geometry.restCenterlineAngle, 0,
    'rest belt centerline angle');
  near(start.treadleAngle, geometry.restTreadleAngle, 0,
    'rest treadle angle');
  for (let sample = -1200; sample <= 2400; sample += 1) {
    const time = geometry.shaftPeriod * sample / 600;
    const state = stateAtTime(time);
    near(state.eccentricCenter.distanceTo(geometry.shaftCenter),
      geometry.eccentricity, 4e-16, 'eccentric orbit radius');
    near(state.eccentricCenter.distanceTo(state.rollerCenter),
      geometry.pulleyCenterDistance, 2e-15,
      'constant pulley-center distance');
    near(state.rollerCenter.distanceTo(geometry.treadlePivot),
      geometry.treadleRadius, 2.5e-15,
      'roller center stays on treadle arc');
    near(state.centerDistanceResidual, 0, 2e-15,
      'published center-distance residual');
    near(state.treadleRadiusResidual, 0, 2.5e-15,
      'published treadle-radius residual');
    const intersections = circleIntersections(
      state.eccentricCenter,
      geometry.pulleyCenterDistance,
      geometry.treadlePivot,
      geometry.treadleRadius,
    );
    assert.ok(intersections.some((point) => (
      point.distanceTo(state.rollerCenter) < 2e-15
    )));
    assert.ok(state.rollerCenter.distanceTo(geometry.restRollerCenter)
      <= intersections.find((point) => (
        point.distanceTo(state.rollerCenter) > 2e-15
      )).distanceTo(geometry.restRollerCenter));
  }
  disposeModel(model.root);
});

test('movement 374 analytic centerline and treadle rates satisfy both moving-center velocity constraints', () => {
  const model = createMovementModel(catalog.movements[373]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  const step = 1e-6;

  for (let sample = 0; sample <= 480; sample += 1) {
    const time = geometry.shaftPeriod * 2 * sample / 480 + 0.003;
    const state = stateAtTime(time);
    const before = stateAtTime(time - step);
    const after = stateAtTime(time + step);
    const numericalEccentricVelocity = after.eccentricCenter.clone()
      .sub(before.eccentricCenter).multiplyScalar(1 / (2 * step));
    const numericalRollerVelocity = after.rollerCenter.clone()
      .sub(before.rollerCenter).multiplyScalar(1 / (2 * step));
    const numericalCenterlineRate = (
      after.centerlineAngle - before.centerlineAngle
    ) / (2 * step);
    const numericalTreadleRate = (
      after.treadleAngle - before.treadleAngle
    ) / (2 * step);
    vectorNear(numericalEccentricVelocity,
      state.eccentricCenterVelocity, 3e-9,
      'analytic eccentric-center velocity');
    vectorNear(numericalRollerVelocity,
      state.rollerCenterVelocity, 3e-9,
      'analytic roller-center velocity');
    near(numericalCenterlineRate,
      state.centerlineAngularSpeed, 3e-9,
      'analytic centerline angular rate');
    near(numericalTreadleRate,
      state.treadleAngularSpeed, 3e-9,
      'analytic treadle angular rate');
    near(state.rollerVelocityClosureError.length(), 0, 8e-16,
      'belt-link and treadle velocities close');
  }
  const quarter = stateAtTime(geometry.shaftPeriod / 4);
  const threeQuarter = stateAtTime(3 * geometry.shaftPeriod / 4);
  assert.ok(quarter.treadleAngle > geometry.restTreadleAngle);
  assert.ok(threeQuarter.treadleAngle < geometry.restTreadleAngle);
  disposeModel(model.root);
});

test('movement 374 one constant-length belt has exact unequal-pulley external tangents and complementary wraps', () => {
  const model = createMovementModel(catalog.movements[373]);
  const data = model.root.userData;
  const { beltPath, blocks, geometry } = data;
  const upperRun = beltPath.rollerUpperTangentLocal.clone()
    .sub(beltPath.eccentricUpperTangentLocal);
  const lowerRun = beltPath.eccentricLowerTangentLocal.clone()
    .sub(beltPath.rollerLowerTangentLocal);

  near(beltPath.upperNormalLocal.length(), 1, 0,
    'first tangent normal');
  near(beltPath.lowerNormalLocal.length(), 1, 0,
    'second tangent normal');
  near(beltPath.eccentricUpperTangentLocal.length(),
    geometry.eccentricPulleyRadius, 0,
    'upper eccentric tangent radius');
  near(beltPath.eccentricLowerTangentLocal.length(),
    geometry.eccentricPulleyRadius, 0,
    'lower eccentric tangent radius');
  near(beltPath.rollerUpperTangentLocal.clone()
    .sub(new THREE.Vector2(geometry.pulleyCenterDistance, 0)).length(),
  geometry.treadleRollerRadius, 1e-16,
  'upper roller tangent radius');
  near(beltPath.rollerLowerTangentLocal.clone()
    .sub(new THREE.Vector2(geometry.pulleyCenterDistance, 0)).length(),
  geometry.treadleRollerRadius, 1e-16,
  'lower roller tangent radius');
  near(upperRun.dot(beltPath.upperNormalLocal), 0, 5e-16,
    'first run tangent to both pulleys');
  near(lowerRun.dot(beltPath.lowerNormalLocal), 0, 5e-16,
    'second run tangent to both pulleys');
  near(upperRun.length(), beltPath.straightRunLength, 9e-16,
    'first exact straight-run length');
  near(lowerRun.length(), beltPath.straightRunLength, 9e-16,
    'second exact straight-run length');
  near(beltPath.eccentricWrapAngle + beltPath.rollerWrapAngle,
    FULL_TURN, 0, 'complementary open-belt wraps');
  near(
    2 * beltPath.straightRunLength
      + geometry.eccentricPulleyRadius * beltPath.eccentricWrapAngle
      + geometry.treadleRollerRadius * beltPath.rollerWrapAngle,
    beltPath.beltLength,
    0,
    'constant total belt centerline length',
  );
  assert.equal(blocks.belt.userData.isBelt, true);
  disposeModel(model.root);
});

test('movement 374 moving belt has zero slip at all four tangencies and gives the treadle roller its carrier-corrected speed', () => {
  const model = createMovementModel(catalog.movements[373]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;
  assert.equal(transmission.pulleyRadiusRatio, 10 / 3);
  assert.match(transmission.lowerRollerLaw, /omega_centerline/);
  assert.match(transmission.beltTransportLaw, /circulation speed/);

  for (let sample = -1500; sample <= 3000; sample += 1) {
    const time = geometry.shaftPeriod * sample / 750;
    const state = stateAtTime(time);
    near(state.rollerAngularSpeed,
      state.centerlineAngularSpeed
        + geometry.eccentricRadiusRatio * (
          geometry.shaftAngularSpeed - state.centerlineAngularSpeed
        ),
      0, 'carrier-corrected lower roller speed');
    near(state.beltCirculationSpeed,
      -geometry.eccentricPulleyRadius * (
        geometry.shaftAngularSpeed - state.centerlineAngularSpeed
      ),
      0, 'moving-frame belt circulation speed');
    for (const [name, contact] of Object.entries(state.contacts)) {
      near(contact.normal.length(), 1, 6e-16,
        `${name} unit radius normal`);
      near(contact.positivePathTangent.length(), 1, 6e-16,
        `${name} unit path tangent`);
      near(contact.normal.dot(contact.positivePathTangent),
        0, 4e-16, `${name} tangent perpendicular to radius`);
      vectorNear(contact.beltVelocity, contact.pulleyVelocity,
        2.5e-14, `${name} no-slip material velocity`);
      near(contact.noSlipError, 0, 2.5e-14,
        `${name} published no-slip error`);
    }
    near(state.maximumNoSlipError, 0, 2.5e-14,
      'maximum four-contact no-slip error');
  }
  const start = stateAtTime(0);
  const oneTurn = stateAtTime(geometry.shaftPeriod);
  near(oneTurn.rollerAngle - start.rollerAngle,
    geometry.eccentricRadiusRatio * FULL_TURN, 4e-15,
    'one shaft turn advances roller by the pulley radius ratio');
  disposeModel(model.root);
});

test('movement 374 renderer binds the shaft, treadle, free roller, and rigidly moving one-piece belt without path jumps', () => {
  const model = createMovementModel(catalog.movements[373]);
  const data = model.root.userData;
  const { beltPath, blocks, geometry, stateAtTime } = data;
  const fixedPivot = blocks.treadlePivotPin.position.clone();
  const fixedBearing = blocks.shaftBearing.position.clone();
  let previousRollerCenter = stateAtTime(0).rollerCenter;

  for (let frame = 0; frame <= 900; frame += 1) {
    const time = geometry.demonstrationPeriod * 2 * frame / 900;
    const expected = stateAtTime(time);
    model.update(time, 0.016);
    near(blocks.shaftRotor.rotation.z, expected.shaftAngle, 0,
      'rendered shaft angle');
    near(blocks.treadle.rotation.z, expected.treadleAngle, 0,
      'rendered treadle angle');
    near(blocks.treadleRoller.userData.rotor.rotation.z,
      expected.rollerAngle - expected.treadleAngle, 0,
      'rendered roller local angle gives exact global spin');
    near(blocks.belt.position.x, expected.eccentricCenter.x, 0,
      'rendered belt upper-center X');
    near(blocks.belt.position.y, expected.eccentricCenter.y, 0,
      'rendered belt upper-center Y');
    near(blocks.belt.position.z, geometry.beltPlaneZ, 0,
      'rendered belt plane');
    near(blocks.belt.rotation.z, expected.centerlineAngle, 0,
      'rendered belt centerline angle');
    blocks.belt.updateMatrixWorld(true);
    const renderedTopTangent = blocks.belt.localToWorld(
      new THREE.Vector3(
        beltPath.eccentricUpperTangentLocal.x,
        beltPath.eccentricUpperTangentLocal.y,
        0,
      ),
    );
    vectorNear(
      new THREE.Vector2(renderedTopTangent.x, renderedTopTangent.y),
      expected.contacts.eccentricUpper.point,
      3e-15,
      'rendered upper tangent follows solved belt pose',
    );
    vectorNear(blocks.treadlePivotPin.position, fixedPivot, 0,
      'treadle pivot fixed');
    vectorNear(blocks.shaftBearing.position, fixedBearing, 0,
      'shaft bearing fixed');
    if (frame > 0) {
      assert.ok(expected.rollerCenter.distanceTo(previousRollerCenter)
        < 0.16, 'roller path has no branch jump');
    }
    previousRollerCenter = expected.rollerCenter;
    assert.deepEqual(
      Object.keys(data.beltContacts),
      Object.keys(expected.contacts),
    );
    for (const name of Object.keys(expected.contacts)) {
      vectorNear(data.beltContacts[name].point,
        expected.contacts[name].point, 0,
        `${name} published rendered contact`);
    }
  }
  disposeModel(model.root);
});

test('movement 374 closes three shaft turns, ten roller turns, and three treadle oscillations before movement 507 remains authored', () => {
  const movement = catalog.movements[373];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { beltPath, geometry, stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(geometry.demonstrationPeriod);

  near(closure.shaftAngle - start.shaftAngle,
    3 * FULL_TURN, 0, 'three unwrapped shaft turns');
  near(closure.rollerAngle - start.rollerAngle,
    10 * FULL_TURN, 1e-14, 'ten unwrapped roller turns');
  near(closure.beltTravel - start.beltTravel,
    -geometry.eccentricPulleyRadius * 3 * FULL_TURN,
    4e-15, 'unwrapped belt material travel');
  angleNear(closure.shaftAngle, start.shaftAngle, 0,
    'shaft index closes');
  angleNear(closure.rollerAngle, start.rollerAngle, 2e-14,
    'roller index closes');
  angleNear(closure.treadleAngle, start.treadleAngle, 0,
    'treadle pose closes');
  angleNear(closure.centerlineAngle, start.centerlineAngle, 0,
    'belt path angle closes');
  vectorNear(closure.eccentricCenter, start.eccentricCenter, 6e-16,
    'eccentric center closes');
  vectorNear(closure.rollerCenter, start.rollerCenter, 8e-16,
    'treadle roller center closes');
  assert.match(timeline.note, /no artificial bead or texture phase/);
  assert.ok(beltPath.beltLength > 0);
  assert.equal(timeline.demonstrationPeriod,
    geometry.demonstrationPeriod);
  assert.equal(data.animationTiming.authoredCyclePeriod,
    geometry.demonstrationPeriod);
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
