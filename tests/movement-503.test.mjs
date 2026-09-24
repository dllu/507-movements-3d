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
    '../src/simulation/authored-epicyclic-trains.js',
    import.meta.url,
  ),
  'utf8',
);

const ARCHETYPE =
  'two-input-equal-miter-bevel-differential-with-radial-planet-carrier-output';
const FULL_TURN = Math.PI * 2;

function movementModel() {
  const movement = catalog.movements[502];
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

test('movement 503 has loose bevel inputs C and D, free planet B, and shaft-arm assembly A-F-G', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, meshes } = model.root.userData;

  assert.equal(movement.id, 503);
  assert.equal(movement.number, '503');
  assert.match(movement.title, /simple form of the epicyclic train/);
  assert.equal(movement.category, 'Epicyclic trains');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(blocks.lowerC.userData.sourceLabel, 'C');
  assert.equal(blocks.lowerC.userData.independentInput, true);
  assert.equal(blocks.upperD.userData.sourceLabel, 'D');
  assert.equal(blocks.upperD.userData.independentInput, true);
  assert.equal(blocks.planetB.userData.sourceLabel, 'B');
  assert.equal(blocks.planetB.userData.freeOnCarrierAxle, true);
  assert.equal(blocks.carrierShaftA.userData.sourceLabel, 'A');
  assert.equal(blocks.carrierShaftA.userData.rigidAssembly, 'A-F-G');
  assert.equal(blocks.carrierFG.userData.rigidAssembly, 'A-F-G');
  assert.equal(blocks.carrierFG.userData.aggregateOutput, true);
  assert.equal(blocks.carrierShaftA.parent, blocks.carrierFG);
  assert.equal(blocks.planetB.parent, blocks.carrierFG);
  assert.equal(blocks.lowerC.parent, model.root);
  assert.equal(blocks.upperD.parent, model.root);
  assert.deepEqual(Object.keys(blocks.labels).sort(),
    ['A', 'B', 'C', 'D', 'F', 'G']);
  assert.deepEqual(meshes.map(({ first, second }) => `${first}-${second}`),
    ['C-B', 'D-B']);
  assert.equal(degreesOfFreedom.independentBevelWheelInputs, 2);
  assert.equal(degreesOfFreedom.dependentCarrierCoordinates, 1);
  assert.equal(degreesOfFreedom.dependentPlanetCoordinates, 1);
  const gears = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.isGear) gears.push(object);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.equal(gears.length, 3);
  assert.deepEqual(belts, []);
  assert.doesNotMatch(sourceText, /makeMovingBelt|makeDynamicMovingBelt/);
  disposeModel(model.root);
});

test('movement 503 records the unavailable official animation and selected two-input mode', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_503.html');
  assert.match(movement.description,
    /F, G, is the arm.*central shaft, A.*bevel-wheels, C, D.*bevel-wheel, B.*two wheels, C, D.*aggregate motion of the arm/is);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.match(sourceReference.officialEngraving,
    /engravings\/mm_503\.png$/);
  assert.match(sourceReference.reconstructionDisclosure,
    /official page marks Animated unavailable.*two-wheel-input mode.*equal 48-tooth side wheels C and D and a 28-tooth planet B.*engraving/is);
  assert.match(sourceReference.reconstructionDisclosure,
    /exact average\/difference law.*common pitch apex.*both contact velocities.*constraints/is);
  assert.match(sourceReference.engineeringCorroboration.report,
    /NASA SP-8100.*Dynamics of Planetary Gear Trains.*1984/);
  assert.match(sourceReference.engineeringCorroboration.detail,
    /removes carrier rotation.*fixed-axis gear train.*carrier-average.*planet-half-difference/is);
  disposeModel(model.root);
});

test('movement 503 gives the source-sized side wheels and planet one common apex and orthogonal axes', () => {
  const { model } = movementModel();
  const { geometry, meshes, stateAtTime, transmission } = model.root.userData;

  assert.equal(geometry.sideTeeth, 48);
  assert.equal(geometry.planetTeeth, 28);
  near(geometry.planetPitchRadius / geometry.bevelPitchRadius, 28 / 48,
    1e-15, 'equal module');
  near(Math.tan(geometry.pitchConeHalfAngle), 48 / 28, 1e-14,
    'side pitch cone from tooth ratio');
  near(geometry.pitchConeHalfAngle + geometry.planetPitchConeHalfAngle,
    Math.PI / 2, 1e-15, 'complementary pitch cones');
  // Common heel pitch point: each wheel's pitch radius is the other's
  // heel distance from the apex.
  near(2 * geometry.bevelDepth, geometry.planetPitchRadius, 1e-15,
    'side heel distance');
  near(2 * geometry.planetBevelDepth, geometry.bevelPitchRadius, 1e-15,
    'planet heel distance');
  near(geometry.pitchApexOffset, 1.5 * geometry.bevelDepth, 0,
    'cone apex offset');
  near(geometry.planetApexOffset, 1.5 * geometry.planetBevelDepth, 0,
    'planet cone apex offset');
  for (const mesh of meshes) {
    near(mesh.axesAngle, Math.PI / 2, 1e-15,
      `${mesh.first}-${mesh.second} orthogonal axes`);
    vectorNear(mesh.pitchConeApex, new THREE.Vector3(), 0,
      `${mesh.first}-${mesh.second} common apex`);
    assert.deepEqual(mesh.teeth, [48, 28]);
  }
  for (let sample = 0; sample <= 1440; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * sample / 1440,
    );
    near(state.planetCenter.length(), geometry.planetApexOffset,
      4e-16, `planet center radius ${sample}`);
    near(state.planetAxisDirection.length(), 1, 2e-16,
      `planet unit axis ${sample}`);
    near(state.planetCenter.clone().normalize()
      .dot(state.planetAxisDirection), -1, 3e-16,
    `planet axis points to apex ${sample}`);
    near(state.lowerPitchApexResidual, 0, 0,
      `lower apex ${sample}`);
    near(state.upperPitchApexResidual, 0, 0,
      `upper apex ${sample}`);
    near(state.planetPitchApexResidual, 0, 3e-16,
      `planet apex ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 503 carrier is the exact average and planet is the exact half-difference', () => {
  const { model } = movementModel();
  const { stateAtTime, transmission } = model.root.userData;
  const expectedCarrierSpeed = (
    transmission.lowerCInputAngularSpeed
      + transmission.upperDInputAngularSpeed
  ) / 2;
  const { geometry } = model.root.userData;
  const expectedPlanetSpeed = geometry.sideTeeth / geometry.planetTeeth * (
    transmission.lowerCInputAngularSpeed
      - transmission.upperDInputAngularSpeed
  ) / 2;

  assert.equal(transmission.constraintLaw,
    '2 * carrierAngularSpeed = lowerCInputAngularSpeed + upperDInputAngularSpeed');
  assert.equal(transmission.planetDifferenceLaw,
    'planetAngularSpeed = sideTeeth / planetTeeth * (C - D) / 2');
  near(transmission.carrierAngularSpeed, expectedCarrierSpeed, 0,
    'published carrier average');
  near(transmission.planetAngularSpeedAboutOutwardRadial,
    expectedPlanetSpeed, 0, 'published planet half-difference');
  for (let sample = 0; sample <= 3000; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * 12 * sample / 3000,
    );
    near(state.differentialEquationResidual, 0, 0,
      `differential equation ${sample}`);
    near(state.carrierAngularSpeed, expectedCarrierSpeed, 0,
      `carrier speed ${sample}`);
    near(state.planetAngularSpeedAboutOutwardRadial,
      expectedPlanetSpeed, 0, `planet speed ${sample}`);
    near(state.meshPhaseResiduals.CB, 0, 7e-14,
      `C-B phase invariant ${sample}`);
    near(state.meshPhaseResiduals.DB, 0, 7e-14,
      `D-B phase invariant ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 503 matches 3D pitch-point velocity at both bevel contacts', () => {
  const { model } = movementModel();
  const { stateAtTime, transmission } = model.root.userData;

  for (let sample = 0; sample <= 2400; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * 8 * sample / 2400,
    );
    // tan(59.7 degrees) contact radius: rounding, not slip.
    near(state.lowerPitchVelocityResidual, 0, 1e-15,
      `C-B pitch velocity ${sample}`);
    near(state.upperPitchVelocityResidual, 0, 1e-15,
      `D-B pitch velocity ${sample}`);
    near(state.lowerContact.length(),
      state.upperContact.length(), 3e-16,
      `symmetric pitch generators ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 503 renderer keeps A-F-G rigid while C, D, and B follow their signed axes', () => {
  const { model } = movementModel();
  const { blocks, stateAtTime, transmission } = model.root.userData;

  for (let sample = 0; sample <= 720; sample += 1) {
    const time = transmission.nominalCarrierPeriod * 3 * sample / 720;
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.carrierFG.rotation.y, state.carrierAngle, 0,
      `carrier A-F-G angle ${sample}`);
    near(blocks.lowerC.userData.rotor.rotation.z,
      state.lowerCCommonAxisAngle, 0,
      `lower C render angle ${sample}`);
    near(blocks.upperD.userData.rotor.rotation.z,
      -state.upperDCommonAxisAngle, 0,
      `upper D signed-axis angle ${sample}`);
    near(blocks.planetB.userData.rotor.rotation.z,
      -state.planetSpinAngleAboutOutwardRadial, 0,
      `planet B signed-axis angle ${sample}`);
    assert.equal(blocks.carrierShaftA.parent, blocks.carrierFG);
    // Brown draws no index marks; source presentation removes them.
    assert.equal(blocks.carrierIndex.parent, null);
    assert.equal(blocks.shaftAIndex.parent, null);
    model.root.updateMatrixWorld(true);
    vectorNear(blocks.planetB.getWorldPosition(new THREE.Vector3()),
      state.planetCenter, 8e-16, `planet center ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 503 is continuous through carrier turns, fits all orientations, and leaves movement 507 next', () => {
  const { model } = movementModel();
  const { stateAtTime, transmission } = model.root.userData;
  const period = transmission.nominalCarrierPeriod;
  const initial = stateAtTime(0);
  const oneTurn = stateAtTime(period);
  const before = stateAtTime(period - 1e-8);
  const after = stateAtTime(period + 1e-8);

  assert.equal(transmission.continuousUnwrappedRotation, true);
  near(oneTurn.carrierAngle - initial.carrierAngle, FULL_TURN, 0,
    'one carrier turn');
  near(after.carrierAngle - before.carrierAngle,
    2e-8 * transmission.carrierAngularSpeed, 2e-15,
    'no carrier reset');
  assert.ok(after.lowerCCommonAxisAngle > before.lowerCCommonAxisAngle);
  assert.ok(after.upperDCommonAxisAngle > before.upperDCommonAxisAngle);
  assert.ok(after.planetSpinAngleAboutOutwardRadial
    > before.planetSpinAngleAboutOutwardRadial);

  const swept = new THREE.Box3();
  for (let sample = 0; sample <= 1080; sample += 1) {
    model.update(period * sample / 1080);
    model.root.updateMatrixWorld(true);
    swept.union(new THREE.Box3().setFromObject(model.root, true));
  }
  assert.ok(model.root.userData.cameraFitBounds.containsBox(swept));
  assert.ok(Number.isFinite(swept.min.x));
  assert.ok(Number.isFinite(swept.max.z));

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
