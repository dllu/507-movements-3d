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
  'fixed-sun-carried-compound-planet-two-free-output-branches-epicyclic';
const FULL_TURN = Math.PI * 2;

function movementModel() {
  const movement = catalog.movements[501];
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

test('movement 502 is fixed A, carrier C, rigid compound F-E, and two unconstrained output branches', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, meshes, transmission } =
    model.root.userData;

  assert.equal(movement.id, 502);
  assert.equal(movement.number, '502');
  assert.match(movement.title, /epicyclic train/);
  assert.equal(movement.category, 'Epicyclic trains');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(blocks.fixedSunA.userData.sourceLabel, 'A');
  assert.equal(blocks.fixedSunA.userData.fixed, true);
  assert.equal(blocks.carrierC.userData.input, true);
  assert.equal(blocks.compoundF.userData.rigidPair, 'F-E');
  assert.equal(blocks.compoundE.userData.rigidPair, 'F-E');
  assert.equal(blocks.outputB.userData.looseOnCarrierPin, true);
  assert.equal(blocks.outputD.userData.looseOnCentralAxis, true);
  assert.deepEqual(Object.keys(blocks.labels).sort(),
    ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.equal(meshes.length, 3);
  assert.deepEqual(meshes.map(({ first, second }) => `${first}-${second}`),
    ['A-F', 'D-E', 'E-B']);
  assert.deepEqual(transmission.teeth,
    { A: 23, B: 15, D: 17, E: 23, F: 17 });
  assert.equal(degreesOfFreedom.independentCarrierInputs, 1);
  assert.equal(degreesOfFreedom.independentCompoundCoordinates, 0);
  assert.equal(degreesOfFreedom.dependentOutputCoordinates, 2);
  const gears = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.isGear) gears.push(object);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.equal(gears.length, 5);
  assert.deepEqual(belts, []);
  assert.doesNotMatch(sourceText, /makeMovingBelt|makeDynamicMovingBelt/);
  disposeModel(model.root);
});

test('movement 502 records the official canvas factors without importing its geometry', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference, transmission } =
    model.root.userData;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_502.html');
  assert.match(movement.description,
    /A.*gears with a pinion, F.*wheel, E.*gears with a wheel, B.*wheel, D/s);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.usedAsMotionValidationOnly, true);
  assert.match(sourceReference.officialEngraving,
    /engravings\/mm_502\.png$/);
  assert.match(sourceReference.reconstructionDisclosure,
    /exact displayed angular factors C=1.*F\/E=1\+23\/17.*B=1-529\/255.*D=1-529\/289/is);
  assert.match(sourceReference.reconstructionDisclosure,
    /Geometry is independently authored.*nine-second carrier period.*reconstruction choices/is);
  assert.match(sourceReference.reconstructionDisclosure,
    /both freely rotating output branches.*only A is fixed.*do not impose competing input constraints/is);
  assert.match(sourceReference.engineeringCorroboration.report,
    /NASA SP-8100.*Dynamics of Planetary Gear Trains.*1984/);
  assert.match(sourceReference.engineeringCorroboration.detail,
    /subtracting the carrier angular velocity.*fixed-axis train.*equal pitch-line velocities/is);
  assert.match(sourceReference.engineeringCorroboration.url,
    /ntrs\.nasa\.gov.*19840017959.*pdf/i);
  near(transmission.sourceCanvasRatios.C, 1, 0, 'source carrier ratio');
  near(transmission.sourceCanvasRatios.E_F, 40 / 17, 0,
    'source compound ratio');
  near(transmission.sourceCanvasRatios.B, -274 / 255, 0,
    'source output B ratio');
  near(transmission.sourceCanvasRatios.D, -240 / 289, 0,
    'source output D ratio');
  disposeModel(model.root);
});

test('movement 502 puts all three external meshes at exact pitch-center distances in separate planes', () => {
  const { model } = movementModel();
  const { geometry, meshes, stateAtTime, transmission } = model.root.userData;

  for (const [label, count] of Object.entries(transmission.teeth)) {
    near(geometry.pitchRadii[label], geometry.module * count / 2, 0,
      `pitch radius ${label}`);
  }
  for (const mesh of meshes) {
    near(mesh.centerDistance,
      mesh.firstPitchRadius + mesh.secondPitchRadius,
      2e-16, `${mesh.first}-${mesh.second} center distance`);
    assert.equal(mesh.external, true);
  }
  assert.equal(meshes[0].planeZ, geometry.backPlaneZ);
  assert.equal(meshes[1].planeZ, geometry.frontPlaneZ);
  assert.equal(meshes[2].planeZ, geometry.frontPlaneZ);
  assert.notEqual(geometry.backPlaneZ, geometry.frontPlaneZ);
  for (let sample = 0; sample <= 1440; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * sample / 1440,
    );
    near(state.compoundCenter.length(), geometry.compoundCenterRadius,
      5e-16, `compound orbit radius ${sample}`);
    near(state.outputBCenter.length(), geometry.outerOutputCenterRadius,
      9e-16, `B orbit radius ${sample}`);
    near(state.compoundCenter.distanceTo(state.outputBCenter),
      geometry.pitchRadii.E + geometry.pitchRadii.B,
      9e-16, `E-B center distance ${sample}`);
    near(state.afContactPositionResidual, 0, 3e-16,
      `A-F tangency ${sample}`);
    near(state.deContactPositionResidual, 0, 3e-16,
      `D-E tangency ${sample}`);
    near(state.ebContactPositionResidual, 0, 5e-16,
      `E-B tangency ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 502 obeys all three carrier-frame gear equations and the rigid F-E constraint', () => {
  const { model } = movementModel();
  const { stateAtTime, transmission } = model.root.userData;
  const { teeth } = transmission;

  for (let sample = 0; sample <= 4000; sample += 1) {
    const time = transmission.nominalCarrierPeriod * 20 * sample / 4000;
    const state = stateAtTime(time);
    const carrierSpeed = state.carrierAngularSpeed;
    const compoundSpeed = state.compoundAbsoluteAngularSpeed;
    const outputBSpeed = state.outputBAbsoluteAngularSpeed;
    const outputDSpeed = state.outputDAbsoluteAngularSpeed;
    near((0 - carrierSpeed) * teeth.A
      + (compoundSpeed - carrierSpeed) * teeth.F,
    0, 4e-15, `A-F Willis equation ${sample}`);
    near((outputDSpeed - carrierSpeed) * teeth.D
      + (compoundSpeed - carrierSpeed) * teeth.E,
    0, 4e-15, `D-E Willis equation ${sample}`);
    near((compoundSpeed - carrierSpeed) * teeth.E
      + (outputBSpeed - carrierSpeed) * teeth.B,
    0, 4e-15, `E-B Willis equation ${sample}`);
    near(compoundSpeed / carrierSpeed,
      transmission.compoundAbsoluteRatio, 0,
      `compound ratio ${sample}`);
    near(outputBSpeed / carrierSpeed,
      transmission.outputBAbsoluteRatio, 0,
      `B ratio ${sample}`);
    near(outputDSpeed / carrierSpeed,
      transmission.outputDAbsoluteRatio, 0,
      `D ratio ${sample}`);
    near(state.compoundRigidAngleResidual, 0, 4e-13,
      `rigid F-E phase ${sample}`);
    near(state.meshPhaseResiduals.AF, 0, 2e-11,
      `A-F tooth phase ${sample}`);
    near(state.meshPhaseResiduals.DE, 0, 2e-11,
      `D-E tooth phase ${sample}`);
    near(state.meshPhaseResiduals.EB, 0, 2e-11,
      `E-B tooth phase ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 502 has equal pitch-point velocity at every displayed contact', () => {
  const { model } = movementModel();
  const { stateAtTime, transmission } = model.root.userData;

  for (let sample = 0; sample <= 2400; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * 8 * sample / 2400,
    );
    near(state.afPitchVelocityResidual, 0, 8e-16,
      `A-F pitch speed ${sample}`);
    near(state.dePitchVelocityResidual, 0, 8e-16,
      `D-E pitch speed ${sample}`);
    near(state.ebPitchVelocityResidual, 0, 1.2e-15,
      `E-B pitch speed ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 502 renderer follows the unwrapped carrier, compound, and both outputs', () => {
  const { model } = movementModel();
  const { blocks, stateAtTime, transmission } = model.root.userData;

  for (let sample = 0; sample <= 720; sample += 1) {
    const time = transmission.nominalCarrierPeriod * 3 * sample / 720;
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.carrierC.rotation.z, state.carrierAngle, 0,
      `carrier render angle ${sample}`);
    near(blocks.compoundF.userData.rotor.rotation.z,
      state.compoundFAbsoluteAngle - state.carrierAngle,
      4e-14, `F local render angle ${sample}`);
    near(blocks.compoundE.userData.rotor.rotation.z,
      state.compoundEAbsoluteAngle - state.carrierAngle,
      4e-14, `E local render angle ${sample}`);
    near(blocks.outputB.userData.rotor.rotation.z,
      state.outputBAbsoluteAngle - state.carrierAngle,
      4e-14, `B local render angle ${sample}`);
    near(blocks.outputD.userData.rotor.rotation.z,
      state.outputDAbsoluteAngle, 0,
      `D render angle ${sample}`);
    model.root.updateMatrixWorld(true);
    vectorNear(blocks.compoundF.getWorldPosition(new THREE.Vector3()),
      state.compoundCenter.clone().setZ(
        model.root.userData.geometry.backPlaneZ,
      ), 8e-15, `F center ${sample}`);
    vectorNear(blocks.compoundE.getWorldPosition(new THREE.Vector3()),
      state.compoundCenter.clone().setZ(
        model.root.userData.geometry.frontPlaneZ,
      ), 8e-15, `E center ${sample}`);
    vectorNear(blocks.outputB.getWorldPosition(new THREE.Vector3()),
      state.outputBCenter.clone().setZ(
        model.root.userData.geometry.frontPlaneZ,
      ), 1.2e-14, `B center ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 502 runs continuously through carrier revolutions, fits its orbit, and leaves 505 next', () => {
  const { model } = movementModel();
  const { stateAtTime, transmission } = model.root.userData;
  const period = transmission.nominalCarrierPeriod;
  const initial = stateAtTime(0);
  const oneTurn = stateAtTime(period);
  const before = stateAtTime(period - 1e-8);
  const after = stateAtTime(period + 1e-8);

  assert.equal(transmission.continuousUnwrappedRotation, true);
  near(oneTurn.carrierAngle - initial.carrierAngle, FULL_TURN, 0,
    'one carrier revolution');
  near(oneTurn.compoundFAbsoluteAngle - initial.compoundFAbsoluteAngle,
    FULL_TURN * transmission.compoundAbsoluteRatio, 4e-15,
    'continuous compound advance');
  near(oneTurn.outputBAbsoluteAngle - initial.outputBAbsoluteAngle,
    FULL_TURN * transmission.outputBAbsoluteRatio, 2e-15,
    'continuous B advance');
  near(oneTurn.outputDAbsoluteAngle - initial.outputDAbsoluteAngle,
    FULL_TURN * transmission.outputDAbsoluteRatio, 2e-15,
    'continuous D advance');
  near(after.carrierAngle - before.carrierAngle,
    2e-8 * transmission.carrierAngularSpeed, 2e-15,
    'no carrier reset at nominal period');
  assert.ok(after.compoundFAbsoluteAngle > before.compoundFAbsoluteAngle);
  assert.ok(after.outputBAbsoluteAngle < before.outputBAbsoluteAngle);
  assert.ok(after.outputDAbsoluteAngle < before.outputDAbsoluteAngle);

  const swept = new THREE.Box3();
  for (let sample = 0; sample <= 1080; sample += 1) {
    model.update(period * sample / 1080);
    model.root.updateMatrixWorld(true);
    // Precise: the actual surfaces, not per-mesh boxes of rotated parts.
    swept.union(new THREE.Box3().setFromObject(model.root, true));
  }
  // The default view frames the carrier's full turn (recorded as
  // sweptBounds) so B and F never leave it.
  assert.ok(model.root.userData.sweptBounds.containsBox(swept));
  assert.ok(model.root.userData.cameraFitBounds.containsBox(swept));
  model.update(0);
  model.root.updateMatrixWorld(true);
  const pose = new THREE.Box3();
  model.root.traverseVisible((object) => {
    if (!object.isMesh) return;
    // Actual vertices: rotated gears' box corners overstate the pose.
    pose.union(new THREE.Box3().setFromObject(object, true));
  });
  assert.ok(model.root.userData.cameraFitBounds.containsBox(pose));
  assert.ok(model.root.userData.cameraFitBounds.getSize(new THREE.Vector3()).x < 1.05 * (swept.max.x - swept.min.x));
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
