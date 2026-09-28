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
    '../src/simulation/authored-entwistle-gearing.js',
    import.meta.url,
  ),
  'utf8',
);

const ARCHETYPE =
  'entwistle-fixed-side-equal-miter-planetary-speed-doubler';

function movementModel() {
  const movement = catalog.movements[494];
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

test('movement 495 is exactly fixed A, carried B, loose C, shaft D, and stud E', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, transmission } = model.root.userData;

  assert.equal(movement.id, 495);
  assert.equal(movement.number, '495');
  assert.equal(movement.title, 'Entwistle’s patent gearing');
  assert.equal(movement.category, 'Bevel gearing');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.deepEqual(blocks.gears, [
    blocks.fixedGearA,
    blocks.planetGearB,
    blocks.outputGearC,
  ]);
  assert.equal(blocks.fixedGearA.parent, model.root);
  assert.equal(blocks.fixedGearA.userData.fixed, true);
  assert.equal(blocks.planetGearB.parent, blocks.carrierAssembly);
  assert.equal(blocks.studE.parent, blocks.carrierAssembly);
  assert.equal(blocks.shaftD.parent, blocks.carrierAssembly);
  assert.equal(blocks.outputGearC.parent, blocks.outputAssembly);
  assert.equal(blocks.outputDrum.parent, blocks.outputAssembly);
  assert.equal(blocks.outputGearC.userData.looseOnShaftD, true);
  assert.equal(transmission.allGearDiametersEqual, true);
  assert.equal(transmission.allGearToothCountsEqual, true);
  assert.equal(degreesOfFreedom.independentCarrierInputs, 1);
  assert.equal(degreesOfFreedom.independentOutputCoordinates, 0);
  assert.equal(degreesOfFreedom.independentPlanetSpinCoordinates, 0);

  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.doesNotMatch(sourceText, /makeMovingBelt|makeDynamicMovingBelt/);
  disposeModel(model.root);
});

test('movement 495 records the unavailable official animation and the 1889 explanation', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_495.html');
  assert.match(movement.description,
    /Bevel-gear, A, is fixed.*B, gearing with A.*stud, E.*shaft, D.*bevel-gear, C, loose.*three gears of equal size.*C, makes two revolutions for every one of the shaft, D.*applying power to C, action may be reversed/s);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /official Movement 495.*unavailable/i);
  assert.equal(sourceReference.sourceUrl, movement.sourceUrl);
  assert.deepEqual(sourceReference.officialEngraving.labels, {
    fixedBevel: 'A',
    planet: 'B',
    outputBevel: 'C',
    outputDrum: 'C-prime',
    shaft: 'D',
    stud: 'E',
  });
  assert.equal(sourceReference.historicalCorroboration.page, 26);
  assert.match(sourceReference.historicalCorroboration.title,
    /Inventor’s Universal Educator.*1889/);
  assert.match(sourceReference.historicalCorroboration.url,
    /archive\.org\/details\/inventorsunivers01diet\/page\/26/);
  assert.match(sourceReference.historicalCorroboration.detail,
    /carrying B about fixed A.*both revolution and axial rotation.*C two revolutions/i);
  assert.match(sourceReference.reconstructionDisclosure,
    /dimensions and cycle speed are presentation choices.*0:1:2 equal-miter velocity relation/i);
  disposeModel(model.root);
});

test('movement 495 enforces Brown’s zero-to-one-to-two equal-miter velocity relation', () => {
  const { model } = movementModel();
  const { geometry, stateAtCarrierAngle, transmission } =
    model.root.userData;

  assert.equal(transmission.fixedSideWillisEquation,
    'omega_A + omega_C = 2 * omega_D');
  assert.equal(transmission.outputSpeedRatioToCarrier, 2);
  assert.equal(transmission.planetRelativeSpeedRatioToCarrier, 1);
  assert.equal(transmission.reverseDriveCarrierRatioToOutput, 0.5);
  for (let sample = -720; sample <= 720; sample += 1) {
    const carrierAngle = sample / 97;
    const carrierSpeed = 0.17 + (sample + 720) / 1440 * 2.31;
    const state = stateAtCarrierAngle(carrierAngle, carrierSpeed);
    near(state.fixedGearAngle, 0, 0, `fixed A angle ${sample}`);
    near(state.fixedGearAngularSpeed, 0, 0, `fixed A speed ${sample}`);
    near(state.outputAngle, 2 * carrierAngle, 0,
      `C angle is twice D ${sample}`);
    near(state.outputAngularSpeed, 2 * carrierSpeed, 0,
      `C speed is twice D ${sample}`);
    near(state.planetRelativeAngle, carrierAngle, 0,
      `B relative spin equals D revolution ${sample}`);
    near(state.planetRelativeAngularSpeed, carrierSpeed, 0,
      `B relative speed equals D speed ${sample}`);
    near(state.willisAngleInvariant, 0, 0,
      `Willis angle invariant ${sample}`);
    near(state.willisVelocityInvariant, 0, 0,
      `Willis speed invariant ${sample}`);
    vectorNear(state.planetAxis,
      geometry.planetAxisAtSource.clone().applyAxisAngle(
        geometry.carrierAxis,
        carrierAngle,
      ), 2e-15, `carried B axis ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 495 has zero pitch-point slip at both bevel meshes throughout a turn', () => {
  const { model } = movementModel();
  const { geometry, stateAtCarrierAngle } = model.root.userData;

  for (let sample = 0; sample <= 1440; sample += 1) {
    const angle = Math.PI * 2 * sample / 1440;
    const speed = 0.23 + 1.4 * sample / 1440;
    const state = stateAtCarrierAngle(angle, speed);
    near(state.fixedMeshNoSlipError, 0, 8e-15,
      `A-B no-slip ${sample}`);
    near(state.outputMeshNoSlipError, 0, 8e-15,
      `B-C no-slip ${sample}`);
    vectorNear(state.fixedGearContactVelocity,
      state.planetAtFixedVelocity, 8e-15,
      `A-B contact velocity ${sample}`);
    vectorNear(state.outputGearContactVelocity,
      state.planetAtOutputVelocity, 8e-15,
      `B-C contact velocity ${sample}`);
    near(state.fixedContact.clone().sub(geometry.apex)
      .dot(geometry.fixedGearAxis), geometry.contactDistance, 2e-15,
    `A pitch-cone distance ${sample}`);
    near(state.outputContact.clone().sub(geometry.apex)
      .dot(geometry.outputGearAxis), geometry.contactDistance, 2e-15,
    `C pitch-cone distance ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 495 keeps all three bevel axes at one fixed apex while B revolves', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 360; sample += 1) {
    const time = geometry.cycleDuration * sample / 360;
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const gear of blocks.gears) {
      vectorNear(gear.getWorldPosition(new THREE.Vector3()), geometry.apex,
        2e-14, `${gear.userData.role} apex ${sample}`);
    }
    vectorNear(
      blocks.planetGearB.userData.axis.clone()
        .applyQuaternion(blocks.carrierAssembly.quaternion),
      state.planetAxis,
      2e-14,
      `B world axis ${sample}`,
    );
    near(blocks.carrierAssembly.rotation.x, state.carrierAngle, 2e-15,
      `D renderer angle ${sample}`);
    near(blocks.outputAssembly.rotation.x, state.outputAngle, 2e-15,
      `C renderer angle ${sample}`);
    near(blocks.planetGearB.userData.rotor.rotation.z,
      geometry.planetMountPhase + state.planetRelativeAngle, 2e-15,
    `B renderer relative angle ${sample}`);
    vectorNear(blocks.contactMarkers[0].position, state.fixedContact,
      2e-15, `A-B marker ${sample}`);
    vectorNear(blocks.contactMarkers[1].position, state.outputContact,
      2e-15, `B-C marker ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 495 closes one D turn, two C turns, and leaves movement 507 next', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, transmission } = model.root.userData;
  const initial = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  near((closure.carrierAngle - initial.carrierAngle) / (Math.PI * 2),
    1, 2e-16, 'one shaft-D turn');
  near((closure.outputAngle - initial.outputAngle) / (Math.PI * 2),
    2, 4e-16, 'two output-C turns');
  near((closure.planetRelativeAngle - initial.planetRelativeAngle)
    / (Math.PI * 2), 1, 2e-16, 'one relative planet-B turn');
  near(transmission.verifiedCarrierClosure, 1, 2e-16,
    'published carrier closure');
  near(transmission.verifiedOutputClosure, 2, 4e-16,
    'published output closure');

  const swept = new THREE.Box3();
  // p94: precise vertex bounds; the loose box of each wide back disc's
  // local bounding box overstates its reach once the planet turns.
  for (let sample = 0; sample <= 240; sample += 1) {
    model.update(geometry.cycleDuration * sample / 240);
    model.root.updateMatrixWorld(true);
    swept.union(new THREE.Box3().setFromObject(model.root, true));
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

test('movement 495 bevels have plain flat backs out to the tooth tips that clear the mating wheels', () => {
  const { model } = movementModel();
  const { fixedGearA, outputGearC, planetGearB } = model.root.userData.blocks;
  for (const gear of [fixedGearA, outputGearC, planetGearB]) {
    const { backZ, tipLimit, backThickness } = gear.userData.toothFace;
    const back = gear.userData.back;
    assert.ok(back.visible && back.parent === gear.userData.rotor, 'plain back disc on the rotor');
    assert.ok(backZ >= tipLimit + 0.02 - 1e-9, 'back plane stands beyond every mating tooth');
    back.geometry.computeBoundingBox();
    near(back.geometry.boundingBox.max.x, tipLimit, 1e-3, 'back disc reaches the tooth tips');
    near(back.geometry.boundingBox.max.z - back.geometry.boundingBox.min.z, backThickness, 1e-6, 'back thickness');
    const tooth = gear.userData.toothMeshes[0].geometry.attributes.position;
    let reach = 0;
    for (let i = 0; i < tooth.count; i += 1) reach = Math.max(reach, Math.hypot(tooth.getX(i), tooth.getY(i)));
    assert.ok(reach <= tipLimit + 1e-6, 'teeth stay inside the tip cylinder');
  }
  disposeModel(model.root);
});
