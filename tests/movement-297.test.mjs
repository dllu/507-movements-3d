import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

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

test('movement 297 is one eight-trundle lantern cage controlled by one two-pallet arm', () => {
  const movement = catalog.movements[296];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 297);
  assert.equal(movement.number, '297');
  assert.equal(movement.title, 'Lantern-wheel escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'eight-trundle-single-arm-two-pallet-lantern-wheel-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one counter-clockwise eight-trundle lantern cage/);
  assert.match(mechanism, /one rocking arm A carrying exactly two/);
  assert.match(mechanism, /one cylindrical trundle contacts one pallet/);
  assert.equal(transmission.trundleCount, 8);
  assert.equal(transmission.palletCount, 2);
  assert.equal(transmission.activeContactsAtOnce, 1);
  assert.match(transmission.direction, /counter-clockwise/);

  assert.equal(blocks.lanternWheel.parent, model.root);
  assert.equal(blocks.armAssembly.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.lanternWheel);
  assert.equal(blocks.armA.parent, blocks.armAssembly);
  assert.equal(blocks.palletB.parent, blocks.armAssembly);
  assert.equal(blocks.palletC.parent, blocks.armAssembly);
  assert.equal(blocks.palletBBody.parent, blocks.palletB);
  assert.equal(blocks.palletCBody.parent, blocks.palletC);
  assert.equal(blocks.sidePlates.length, 2);
  assert.equal(blocks.sidePlateSpokes.length, 0, 'Brown draws plain discs without spokes');
  assert.equal(blocks.trundles.length, 8);
  assert.equal(blocks.wheelHubs.length, 2);
  vectorNear(blocks.lanternWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'lantern-wheel axis');
  vectorNear(blocks.armAssembly.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'arm A axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'axial-cylindrical-lantern-trundle').length, 8);
  assert.equal(roles.filter((role) =>
    /^complete-lantern-pallet-[BC]$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    role === 'one-piece-rocking-arm-A').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'one-white-active-trundle-contact-marker').length, 1);
  assert.equal(roles.some((role) => /escape-wheel-tooth/.test(role)), false);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 297 records Brown’s eight circles, A–C layout, arrow, and unavailable animation', () => {
  const movement = catalog.movements[296];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate297;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /eight-position lantern wheel/);
  assert.match(sourceAnimation.referenceScope, /arm A/);
  assert.match(sourceAnimation.referenceScope, /pallets B and C/);
  assert.match(sourceAnimation.referenceScope, /one-pitch-per-oscillation/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_297.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.rasterWheelCenter, new THREE.Vector2(272, 315));
  assert.deepEqual(plate.rasterArmPivotA, new THREE.Vector2(385, 76));
  assert.deepEqual(plate.rasterPalletB, new THREE.Vector2(405, 203));
  assert.deepEqual(plate.rasterPalletC, new THREE.Vector2(355, 270));
  assert.deepEqual(plate.rasterDirectionArrow,
    new THREE.Vector2(145, 264));
  assert.equal(plate.rasterWheelOuterRadius, 190);
  assert.equal(plate.rasterTrundleOrbitRadius, 151);
  assert.equal(plate.rasterTrundleRadius, 22);
  assert.equal(plate.visibleTrundleCount, 8);
  assert.equal(plate.rasterTrundleCenters.length, 8);
  assert.deepEqual(plate.rasterTrundleCenters, [
    new THREE.Vector2(258, 157),
    new THREE.Vector2(157, 226),
    new THREE.Vector2(113, 316),
    new THREE.Vector2(163, 423),
    new THREE.Vector2(289, 462),
    new THREE.Vector2(382, 413),
    new THREE.Vector2(424, 306),
    new THREE.Vector2(369, 195),
  ]);
  assert.match(plate.inferredTopology, /eight axial round trundles/);
  assert.match(plate.inferredTopology, /one pivoted arm A/);

  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 0, 'source wheel center');
  vectorNear(sourcePointToModel(plate.rasterArmPivotA),
    geometry.armPivot, 0, 'source arm pivot A');
  near(plate.rasterWheelOuterRadius * geometry.sourceScale,
    geometry.wheelOuterRadius, 0, 'source outer radius');
  near(plate.rasterTrundleOrbitRadius * geometry.sourceScale,
    geometry.trundleOrbitRadius, 0, 'source trundle orbit');
  near(plate.rasterTrundleRadius * geometry.sourceScale,
    geometry.trundleRadius, 0, 'source trundle radius');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.periodReference.publicationYear, 1904);
  assert.equal(sourceReference.periodReference.entry, 107);
  assert.match(sourceReference.periodReference.description,
    /two plates set at angles/);
  disposeModel(model.root);
});

test('movement 297 builds a real two-plate lantern cage with eight axial trundles', () => {
  const model = createMovementModel(catalog.movements[296]);
  const { blocks, geometry } = model.root.userData;

  assert.deepEqual(blocks.sidePlates.map((plate) => plate.userData.axialSide),
    ['rear', 'front']);
  near(blocks.sidePlates[0].position.z,
    -geometry.sidePlateOffset, 0, 'rear plate z');
  near(blocks.sidePlates[1].position.z,
    geometry.sidePlateOffset, 0, 'front plate z');
  assert.ok(geometry.trundleLength
    > 2 * geometry.sidePlateOffset + geometry.sidePlateDepth,
  'trundles bridge and project beyond both end plates');

  const measuredAngles = [];
  blocks.trundles.forEach((trundle, index) => {
    assert.equal(trundle.parent, blocks.wheelRotor);
    assert.equal(trundle.userData.index, index);
    vectorNear(trundle.userData.axis,
      new THREE.Vector3(0, 0, 1), 0, `trundle ${index} axis`);
    near(Math.hypot(trundle.position.x, trundle.position.y),
      geometry.trundleOrbitRadius, 4e-16, `trundle ${index} orbit`);
    near(trundle.position.z, geometry.trundleAxialCenter, 0, `trundle ${index} projects to the pallet plane`);
    measuredAngles.push(Math.atan2(trundle.position.y, trundle.position.x));
  });
  for (let index = 0; index < measuredAngles.length; index += 1) {
    near(measuredAngles[index], index * geometry.trundlePitch > Math.PI
      ? index * geometry.trundlePitch - Math.PI * 2
      : index * geometry.trundlePitch,
    5e-16, `trundle ${index} angular station`);
  }
  near(geometry.trundlePitch, Math.PI / 4, 0, 'eight-position pitch');
  near(geometry.halfTrundlePitch, Math.PI / 8, 0, 'half pitch');
  assert.equal(blocks.wheelIndex.parent, blocks.wheelRotor);
  assert.equal(blocks.rimIndex.parent, blocks.wheelRotor);
  disposeModel(model.root);
});

test('movement 297 keeps B and C as two source-angle plates on the same rigid arm A', () => {
  const model = createMovementModel(catalog.movements[296]);
  const {
    blocks,
    palletProfiles,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate297;

  assert.equal(Object.keys(palletProfiles).length, 2);
  assert.deepEqual(Object.keys(palletProfiles), ['B', 'C']);
  for (const [name, sourceCenter, sourceAngle] of [
    ['B', plate.rasterPalletB, plate.rasterPalletBLongAxisDegrees],
    ['C', plate.rasterPalletC, plate.rasterPalletCLongAxisDegrees],
  ]) {
    const profile = palletProfiles[name];
    assert.equal(profile.name, name);
    near(profile.longAxisDegrees, sourceAngle, 0,
      `pallet ${name} source angle`);
    vectorNear(profile.sourceCenterWorld,
      sourcePointToModel(sourceCenter), 0, `pallet ${name} source center`);
    near(profile.tangent.length(), 1, 2e-16,
      `pallet ${name} unit tangent`);
    near(profile.normal.length(), 1, 2e-16,
      `pallet ${name} unit normal`);
    near(profile.tangent.dot(profile.normal), 0, 6e-17,
      `pallet ${name} perpendicular frame`);
    assert.equal(profile.workingFaceLocalPoints.length, 2);
    assert.ok(profile.workingFaceLocalPoints[0].distanceTo(
      profile.workingFaceLocalPoints[1],
    ) > 0.30, `pallet ${name} has a finite working plate`);
  }
  assert.equal(blocks.palletB.userData.sourceName, 'B');
  assert.equal(blocks.palletC.userData.sourceName, 'C');
  assert.equal(blocks.palletB.parent, blocks.armAssembly);
  assert.equal(blocks.palletC.parent, blocks.armAssembly);
  assert.equal(blocks.palletBFace.parent, blocks.palletB);
  assert.equal(blocks.palletCFace.parent, blocks.palletC);
  assert.equal(blocks.armAssembly.children.filter((child) =>
    /^complete-lantern-pallet-/.test(child.userData.role ?? '')).length, 2);
  disposeModel(model.root);
});

test('movement 297 plays a native-derived one-pitch orbit without the obsolete point-contact law', () => {
  const model = createMovementModel(catalog.movements[296]), d = model.root.userData;
  assert.equal(d.contactPinAngle, undefined);
  assert.equal(d.dropState, undefined);
  assert.match(d.lanternFiniteContact.bake.method, /offline soft-overlap projection/);
  assert.match(d.reconstructionNote, /prescribed assumptions/);
  for (const time of [0, .173, 1.731, 2.834, 3.93]) {
    const before = d.stateAtTime(time), after = d.stateAtTime(time + 4);
    near(after.wheelAngle - before.wheelAngle, Math.PI / 4, 2e-12, 'one pitch per cycle');
    near(after.armAngle, before.armAngle, 2e-15, 'arm closure');
    model.update(time);
    near(d.blocks.wheelRotor.rotation.z, before.wheelAngle, 0, 'rendered wheel');
    near(d.blocks.armAssembly.rotation.z, before.armAngle, 0, 'rendered arm');
    assert.equal(d.blocks.contactMarker.visible, false);
  }
  disposeModel(model.root);
});

test('movement 297 keeps readable four-second playback and source-angle initial arm', () => {
  const model = createMovementModel(catalog.movements[296]), d = model.root.userData;
  assert.equal(d.animationTiming.authoredCyclePeriod, 4);
  assert.equal(d.minimumDisplayCycleSeconds, 4);
  assertReadableTiming(d.animationTiming);
  near(d.stateAtTime(0).armAngle, 0, 1e-15, 'source arm angle');
  assert.equal(d.timeline.demonstrationPeriod, 4);
  disposeModel(model.root);
});
