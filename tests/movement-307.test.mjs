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
const FULL_TURN = Math.PI * 2;

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
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

test('movement 307 separates its three long locking teeth from three inner impulse pins and four pendulum pallets', () => {
  const movement = catalog.movements[306];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    presentation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 307);
  assert.equal(movement.number, '307');
  assert.equal(movement.title,
    'Beckett three-legged dead escapement with separate locking teeth and impulse pins');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'clockwise-three-leg-two-plane-long-dead-lock-teeth-and-inner-impulse-pins');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /three long front teeth lock alternately/);
  assert.match(mechanism, /three short sharp-edged pins pointing backward/);
  assert.match(mechanism, /dead stops D and E concentric with the pendulum pivot/);
  assert.match(mechanism, /pallets A and B at the steps of the plate opening/);
  assert.match(presentation, /long-tooth wheel in front and its pins reaching back into the opening/);
  assert.equal(transmission.lockingToothCount, 3);
  assert.equal(transmission.impulsePinCount, 3);
  assert.equal(transmission.axialSystems, 2);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.palletAssembly.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.plate.parent, blocks.palletAssembly);
  assert.equal(blocks.plateCarrier.parent, blocks.palletAssembly);
  assert.equal(blocks.stopD.parent, blocks.plateCarrier);
  assert.equal(blocks.stopE.parent, blocks.plateCarrier);
  assert.equal(blocks.palletA.parent, blocks.plateCarrier);
  assert.equal(blocks.palletB.parent, blocks.plateCarrier);
  assert.equal(blocks.longToothMeshes.length, 3);
  assert.equal(blocks.impulsePins.length, 3);
  assert.equal(blocks.faceEdges.length, 4);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'long-outer-locking-tooth-only').length, 3);
  assert.equal(roles.filter((role) =>
    role === 'short-inner-backward-pointing-impulse-pin').length, 3);
  assert.equal(roles.filter((role) =>
    /concentric-dead-stop$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /impulse-pallet-face$/.test(role)).length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 307 records Brown, Beckett figure 18, and the contemporary construction description', () => {
  const movement = catalog.movements[306];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate307;
  const construction = sourceReference.periodConstructionReference;
  const britannica = sourceReference.britannicaConstructionReference;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.match(sourceAnimation.referenceScope, /long outer locking teeth/);
  assert.match(sourceAnimation.referenceScope, /backward-pointing inner impulse pins/);
  assert.match(sourceAnimation.referenceScope, /D\/E in the front locking plane/);
  assert.match(sourceAnimation.sourceUrl,
    /507movements\.com\/mm_307\.html/);
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterPendulumPivot,
    new THREE.Vector2(291, 28));
  assert.deepEqual(plate.rasterWheelCenter,
    new THREE.Vector2(263, 359));
  assert.deepEqual(plate.rasterPalletA,
    new THREE.Vector2(307, 333));
  assert.deepEqual(plate.rasterPalletB,
    new THREE.Vector2(254, 397));
  assert.deepEqual(plate.rasterStopD,
    new THREE.Vector2(79, 355));
  assert.deepEqual(plate.rasterStopE,
    new THREE.Vector2(452, 351));
  assert.deepEqual(plate.rasterOpeningBounds, {
    bottom: 404,
    left: 113,
    right: 428,
    top: 307,
  });
  assert.match(plate.inferredTopology, /two axial working planes/);
  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 1e-14, 'source wheel center');

  assert.equal(construction.author,
    'Edmund Beckett, Lord Grimthorpe');
  assert.equal(construction.figure, 18);
  assert.equal(construction.page, 72);
  assert.equal(construction.publicationEdition, 8);
  assert.equal(construction.publicationYear, 1903);
  assert.match(construction.benefits, /reduce pallet friction/);
  assert.match(construction.benefits, /longer pendulum swing/);
  assert.match(construction.url, /campaners\.com/);
  assert.equal(britannica.figure, 8);
  assert.equal(britannica.publicationYear, 1878);
  assert.match(britannica.details, /lock only on dead pallets D and E/);
  assert.match(britannica.details, /pins set in the wheel and pointing backward/);
  assert.match(britannica.url, /wikisource\.org/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 307 keeps the outer dead-lock and inner impulse systems radially and axially distinct', () => {
  const model = createMovementModel(catalog.movements[306]);
  const { blocks, geometry, palletFaces, transmission } = model.root.userData;

  assert.equal(geometry.toothCount, 3);
  near(geometry.toothPitch, FULL_TURN / 3, 1e-15,
    'three-leg pitch');
  assert.ok(geometry.longToothRadius
    > 4 * geometry.impulsePinOrbitRadius);
  assert.ok(geometry.lockPlaneZ - geometry.wheelDepth / 2
    > geometry.palletDepth / 2, 'long teeth run in front of the plate');
  assert.ok(geometry.impulsePinBackZ < -geometry.palletDepth / 2,
    'backward pins reach through the plate opening');
  assert.ok(blocks.longToothMeshes.every((tooth, index) =>
    tooth.parent === blocks.wheelRotor
      && tooth.userData.index === index));
  assert.ok(blocks.impulsePins.every((pin, index) =>
    pin.parent === blocks.wheelRotor
      && pin.userData.index === index
      && pin.userData.pointsBackward === true));
  for (const pin of blocks.impulsePins) {
    pin.geometry.computeBoundingSphere();
    const outer = Math.max(...pin.geometry.userData.plate.polygons[0][0]
      .map(([x, y]) => Math.hypot(x, y)));
    near(outer, geometry.impulsePinOrbitRadius, 1e-6,
      'pin working edge is its outermost point');
  }
  assert.equal(palletFaces.D.function, 'dead locking only');
  assert.equal(palletFaces.E.function, 'dead locking only');
  assert.equal(palletFaces.A.function, 'impulse only');
  assert.equal(palletFaces.B.function, 'impulse only');
  assert.equal(palletFaces.D.axialPlaneZ, geometry.lockPlaneZ);
  assert.equal(palletFaces.E.axialPlaneZ, geometry.lockPlaneZ);
  assert.equal(palletFaces.A.axialPlaneZ, geometry.impulsePlaneZ);
  assert.equal(palletFaces.B.axialPlaneZ, geometry.impulsePlaneZ);
  assert.match(transmission.lockSystem, /long outer teeth.*D\/E/);
  assert.match(transmission.impulseSystem, /pins.*A\/B/);
  disposeModel(model.root);
});

test('movement 307 advances exactly sixty clockwise degrees per beat while alternating all three wheel members', () => {
  const model = createMovementModel(catalog.movements[306]);
  const { geometry, stateAtTime } = model.root.userData;
  const indices = [];

  for (let beat = -2; beat <= 6; beat += 1) {
    const start = stateAtTime(beat * geometry.halfBeatDuration);
    const end = stateAtTime((beat + 1) * geometry.halfBeatDuration);
    near(end.wheelAngle - start.wheelAngle,
      -geometry.wheelAdvancePerBeat, 1e-12,
      `clockwise sixty-degree advance at beat ${beat}`);
    assert.equal(start.contactKind, 'dead-lock');
    assert.equal(start.activeSide,
      positiveModulo(beat, 2) === 0 ? 'D' : 'E');
    indices.push(start.activeIndex);
  }
  assert.deepEqual(indices.slice(2, 8), [1, 0, 2, 1, 0, 2]);
  near(geometry.wheelAdvancePerBeat, Math.PI / 3, 1e-15,
    'one half pitch per beat');
  const start = stateAtTime(0);
  const end = stateAtTime(6 * geometry.halfBeatDuration);
  near(end.wheelAngle - start.wheelAngle,
    -FULL_TURN, 1e-12, 'one clockwise wheel turn in six beats');
  disposeModel(model.root);
});

test('movement 307 opens on Brown’s drawn pose and holds each long tooth without recoil on D or E', () => {
  const model = createMovementModel(catalog.movements[306]);
  const {
    geometry,
    palletFaces,
    stateAtTime,
  } = model.root.userData;

  const drawn = stateAtTime(0);
  assert.equal(drawn.activeSide, 'D', 'the left long tooth is locked on D');
  assert.ok(drawn.palletAngle > 0.99 * geometry.pendulumAmplitude, 'plate at its right extreme');
  for (let beat = 0; beat < 4; beat += 1) {
    const expectedSide = beat % 2 === 0 ? 'D' : 'E';
    const radius = expectedSide === 'D' ? geometry.deadStopRadius : geometry.deadStopRadiusE;
    const samples = [-0.25, 0, 0.25, 0.45].map((offset) =>
      stateAtTime(beat * geometry.halfBeatDuration + offset));
    for (const state of samples) {
      assert.equal(state.activeSystem, 'outer-lock');
      assert.equal(state.contactKind, 'dead-lock');
      assert.equal(state.activeSide, expectedSide);
      assert.match(state.activeFace, /concentric-dead-stop$/);
      near(state.contactError, 0, 1e-12, `exact ${expectedSide} contact`);
      near(state.wheelAngularSpeed, 0, 1e-9, `${expectedSide} has no recoil`);
      near(state.activePoint.distanceTo(geometry.palletPivot), radius, 1e-12,
        `${expectedSide} constant dead-face radius`);
    }
    for (const state of samples.slice(1)) {
      near(state.wheelAngle, samples[0].wheelAngle, 1e-12,
        `${expectedSide} wheel remains stationary`);
    }
  }
  near(palletFaces.D.radiusFromPalletPivot, geometry.deadStopRadius, 0, 'D dead radius');
  near(palletFaces.E.radiusFromPalletPivot, geometry.deadStopRadiusE, 0, 'E dead radius');
  assert.match(model.root.userData.transmission.recoil,
    /none while D or E is engaged/);
  disposeModel(model.root);
});

test('movement 307 gives alternating A/B direct impulses from the sharp inner pins', () => {
  const model = createMovementModel(catalog.movements[306]);
  const {
    geometry,
    impulsePinCenterAt,
    stateAtTime,
  } = model.root.userData;

  for (let beat = 0; beat < 4; beat += 1) {
    const expected = beat % 2 === 0 ? 'A' : 'B';
    const speedSign = beat % 2 === 0 ? 1 : -1;
    for (const offset of [-0.3, 0, 0.3, 0.5]) {
      const state = stateAtTime(beat * geometry.halfBeatDuration - 1 + offset);
      assert.equal(state.activeSystem, 'inner-impulse');
      assert.equal(state.contactKind, 'direct-impulse');
      assert.equal(state.activeSide, expected);
      assert.match(state.activeFace, new RegExp(`^${expected}-(upper|lower)-impulse-pallet-face$`));
      near(state.contactError, 0, 1e-12, `exact ${expected} contact`);
      vectorNear(state.activePoint,
        impulsePinCenterAt(state.wheelAngle, state.activeIndex),
        1e-12, `${expected} active pin edge`);
      near(state.contactPointLocal.x, 0, 1e-12, 'pin edge on the vertical step');
      assert.equal(Math.sign(state.palletAngularSpeed), speedSign);
    }
    const midpoint = stateAtTime(beat * geometry.halfBeatDuration - 1);
    assert.ok(midpoint.wheelAngularSpeed < 0,
      `${expected} receives clockwise wheel impulse`);
  }
  disposeModel(model.root);
});

test('movement 307 falls freely from each impulse to the next lock and from each unlocking to the next impulse', () => {
  const model = createMovementModel(catalog.movements[306]);
  const {
    beatEvents,
    geometry,
    lawTimeOrigin,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;

  for (let beat = 0; beat < 4; beat += 1) {
    const events = beatEvents[beat % 2];
    const base = beat * geometry.halfBeatDuration - lawTimeOrigin;
    const impulseEnd = stateAtTime(base + events.impulseEnd - 1e-6);
    const drop = stateAtTime(base + (events.impulseEnd + events.landing) / 2);
    const landing = stateAtTime(base + events.landing + 1e-6);
    const unlockDrop = stateAtTime(base + (events.restRelease + events.contact) / 2);
    assert.equal(impulseEnd.activeSystem, 'inner-impulse');
    assert.equal(drop.activeSystem, null);
    assert.equal(drop.activeIndex, null);
    assert.equal(drop.activePoint, null);
    assert.equal(drop.contactKind, 'free-drop');
    assert.match(drop.mode, /^free-drop-to-[DE]$/);
    assert.equal(unlockDrop.contactKind, 'free-drop');
    assert.equal(landing.activeSystem, 'outer-lock');
    assert.ok(landing.wheelAngle < impulseEnd.wheelAngle, 'finite clockwise drop');
    assert.ok(events.landingCover > 0.02, 'stop covers the landing tooth');
  }
  assert.match(transmission.clearance, /falls freely/);
  assert.equal(timeline.demonstrationPeriod, geometry.pendulumPeriod);
  assert.equal(timeline.schedule.filter((entry) =>
    entry.includes('free-drop')).length, 4);
  disposeModel(model.root);
});

test('movement 307 renderer follows the prescribed two-system state and leaves movement 339 as the next authored frontier', () => {
  const movement = catalog.movements[306];
  const model = createMovementModel(movement);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const phaseSamples = Array.from({ length: 17 }, (_, index) => index / 8);

  for (const halfCoordinate of phaseSamples) {
    const time = halfCoordinate * geometry.halfBeatDuration;
    model.update(time, 0.016);
    const state = stateAtTime(time);
    near(blocks.palletAssembly.rotation.z,
      state.palletAngle, 0, `pallet angle at ${time}`);
    near(blocks.wheelRotor.rotation.z,
      state.wheelAngle, 0, `wheel angle at ${time}`);
    assert.equal(blocks.contactMarker.visible,false, 'unqualified global contact marker is suppressed');
    assert.equal(blocks.contactMarker.userData.activeFace,
      state.activeFace);
    assert.equal(blocks.contactMarker.userData.activeIndex,
      state.activeIndex);
    assert.equal(blocks.contactMarker.userData.activeSystem,
      state.activeSystem);
    if (state.contactPoint) {
      vectorNear(new THREE.Vector2(
        blocks.contactMarker.position.x,
        blocks.contactMarker.position.y,
      ), state.contactPoint, 1e-12, `contact marker at ${time}`);
      near(blocks.contactMarker.position.z,
        state.activeSystem === 'outer-lock'
          ? geometry.contactMarkerZ.lock
          : geometry.contactMarkerZ.impulse,
        0, `contact marker plane at ${time}`);
    }
  }
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, geometry.pendulumPeriod);
  assert.ok(model.root.userData.animationTiming.displayCycleDuration >= 6);
  assertReadableTiming(model.root.userData.animationTiming);

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});

test('movement 307 p89: the plate is pocketed 0.003 inside pallets A and B, which alone carry the step faces', async () => {
  const { polygonClipping: clip } = await import('../src/simulation/finite-plate-geometry.js');
  const model = createMovementModel(catalog.movements[306]);
  const { plate, plateCarrier, palletA, palletB } = model.root.userData.blocks;
  const polygons = plate.geometry.userData.plate.polygons;
  const area = mp => mp.reduce((s, poly) => s + poly.reduce((t, ring, k) => {
    let a = 0; for (let i = 0; i < ring.length; i += 1) { const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % ring.length]; a += x0 * y1 - x1 * y0; }
    return t + (k ? -1 : 1) * Math.abs(a) / 2; }, 0), 0);
  const square = (x, y, s = 0.001) => [[[x - s, y - s], [x + s, y - s], [x + s, y + s], [x - s, y + s]]];
  const offset = plateCarrier.position;
  palletA.geometry.computeBoundingBox(); palletB.geometry.computeBoundingBox();
  const a = palletA.geometry.boundingBox, b = palletB.geometry.boundingBox;
  // Just inside A's working corner and B's: no plate material (the pocket).
  assert.equal(area(clip.intersection(polygons, square(a.min.x + offset.x + 0.0015, a.min.y + offset.y + 0.0015, 0.0005))), 0);
  assert.equal(area(clip.intersection(polygons, square(b.max.x + offset.x - 0.0015, b.max.y + offset.y - 0.0015, 0.0005))), 0);
  // The plate still fills A's footprint up to 0.003 of its inner faces,
  // and runs on along the opening edge beyond A's end.
  assert.ok(area(clip.intersection(polygons, square(a.max.x + offset.x - 0.0015, a.min.y + offset.y + 0.05, 0.001))) > 3.9e-6);
  assert.ok(area(clip.intersection(polygons, square(a.max.x + offset.x + 0.01, a.min.y + offset.y + 0.002, 0.001))) > 3.9e-6);
  disposeModel(model.root);
});

test('movement 307 p93: impulse pins are Brown’s crescents, seated within their legs and seen on the front face', () => {
  const model = createMovementModel(catalog.movements[306]);
  const { blocks, geometry } = model.root.userData;
  for (const pin of blocks.impulsePins) {
    const ring = pin.geometry.userData.plate.polygons[0][0];
    const base = pin.userData.index * geometry.toothPitch + geometry.impulsePinPhaseOffset;
    for (const [x, y] of ring) {
      let angle = Math.atan2(y, x) - base;
      angle = Math.atan2(Math.sin(angle), Math.cos(angle));
      assert.ok(angle > -1e-6, 'nothing trails ahead of the working edge');
    }
    pin.geometry.computeBoundingBox();
    assert.ok(pin.geometry.boundingBox.max.z > geometry.lockPlaneZ + geometry.wheelDepth / 2,
      'crescent end stands just proud of the leg face');
    assert.ok(pin.geometry.boundingBox.max.z < geometry.lockPlaneZ + geometry.wheelDepth / 2 + 0.02);
  }
  disposeModel(model.root);
});
