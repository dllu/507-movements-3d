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

test('movement 305 is one tiny single-pin disc inside one pendulum-carried Z-slot pallet plate', () => {
  const movement = catalog.movements[304];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    presentation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 305);
  assert.equal(movement.number, '305');
  assert.equal(movement.title,
    'Macdowall single-pin pendulum escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'clockwise-macdowall-single-ruby-pin-deadbeat-pendulum-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(presentation, /front elevation/);
  assert.match(mechanism, /one ruby pin/);
  assert.match(mechanism, /ceiling and the floor of the Z opening/);
  assert.match(mechanism, /one clockwise half-turn per pendulum beat/);
  assert.equal(transmission.pinCount, 1);
  assert.equal(transmission.discAdvancePerBeatRadians, Math.PI);
  assert.equal(transmission.discTurnsPerPendulumCycle, 1);
  assert.match(transmission.direction, /clockwise/);
  assert.match(transmission.recoil, /^none/);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.palletAssembly.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.contactMarker.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.rubyPin.parent, blocks.wheelRotor);
  assert.equal(blocks.plate.parent, blocks.palletAssembly);
  assert.equal(blocks.upperPallet, undefined, 'no pallet pieces are added into the opening');
  assert.equal(blocks.lowerPallet, undefined);
  // The plate is one part: its only meshes are the plate and the two
  // adjusting bushes with their screws.
  const plateMeshes = [];
  blocks.palletAssembly.traverse((object) => { if (object.isMesh && object.visible) plateMeshes.push(object.userData.role); });
  assert.deepEqual(plateMeshes.sort(), [
    'eccentric-adjusting-bush', 'eccentric-adjusting-bush',
    'eccentric-bush-screw-head', 'eccentric-bush-screw-head',
    'macdowall-bottle-profile-pallet-plate',
  ]);
  assert.equal(blocks.upperDeadEdge.parent, blocks.palletAssembly);
  assert.equal(blocks.lowerDeadEdge.parent, blocks.palletAssembly);
  assert.equal(blocks.upperImpulseEdge.parent, blocks.palletAssembly);
  assert.equal(blocks.lowerImpulseEdge.parent, blocks.palletAssembly);
  assert.equal(blocks.adjustmentScrews.length, 2);
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'disc axis');
  vectorNear(blocks.palletAssembly.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'pendulum-pallet axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'single-eccentric-ruby-pin').length, 1);
  assert.equal(roles.filter((role) =>
    /^(ceiling|floor)-concentric-horizontal-dead-face$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /upright-impulse-face$/.test(role)).length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 305 records Brown, Macdowall, the period figure, and the surviving demonstrator', () => {
  const movement = catalog.movements[304];
  const model = createMovementModel(movement);
  const {
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate305;
  const period = sourceReference.periodConstructionReference;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.match(sourceAnimation.referenceScope, /one-half-turn-per-beat/);
  assert.match(sourceAnimation.referenceScope, /1:60 eccentricity limit is not followed/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_305.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 5);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterPendulumPivot,
    new THREE.Vector2(264, 35));
  assert.deepEqual(plate.rasterOpeningCenter,
    new THREE.Vector2(264, 380));
  assert.deepEqual(plate.rasterDiskCenter,
    new THREE.Vector2(240, 380));
  assert.deepEqual(plate.rasterRubyPin,
    new THREE.Vector2(261, 380));
  assert.deepEqual(plate.rasterUpperPalletCorner,
    new THREE.Vector2(270, 370));
  assert.deepEqual(plate.rasterLowerPalletCorner,
    new THREE.Vector2(259, 388));
  assert.deepEqual(plate.rasterLeftAdjustment,
    new THREE.Vector2(224, 479));
  assert.deepEqual(plate.rasterRightAdjustment,
    new THREE.Vector2(297, 479));
  assert.match(plate.inferredTopology, /Z-like opening/);
  assert.match(plate.sourceDirection, /clockwise/);

  assert.equal(period.inventor, 'C. Macdowall');
  assert.equal(period.patentYear, 1851);
  assert.equal(period.publicationYear, 1878);
  assert.equal(period.figure, 7);
  assert.match(period.publication, /Encyclopaedia Britannica/);
  assert.match(period.description, /half a revolution at every beat/);
  assert.match(period.constructionRule, /one-sixtieth/);
  assert.match(period.url, /wikisource\.org/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 75,
    edition: 21,
    illustrationPage: 74,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.survivingModelReference.collection,
    'Franklin Institute escapement collection');
  assert.match(sourceReference.survivingModelReference.credit,
    /Macdowall/);
  assert.match(sourceReference.survivingModelReference.url,
    /commons\.wikimedia\.org/);
  disposeModel(model.root);
});

test('movement 305 takes the pin orbit, pin and disc from Brown\'s plate, with exactly one working pin', () => {
  const model = createMovementModel(catalog.movements[304]);
  const { blocks, geometry } = model.root.userData;
  const px = geometry.sourceScale;

  assert.equal(geometry.pinCount, 1);
  // Brown: the pin 21 px from the arbor ring, 17 px across; the disc 36 px.
  near(geometry.pinOrbitRadius, 21 * px, 1e-15, 'pin orbit from the plate');
  near(geometry.pinRadius, 8.7 * px, 1e-15, 'pin radius from the plate');
  near(geometry.diskRadius, 36 * px, 1e-15, 'disc radius from the plate');
  near(geometry.eccentricityRatio,
    geometry.pinOrbitRadius / geometry.centerDistance, 1e-15, 'ratio');
  assert.ok(geometry.eccentricityRatio > 3 / 60,
    'Brown\'s pin is several times the 1:60 rule');
  near(geometry.escapeAngle, Math.atan(geometry.eccentricityRatio), 1e-15,
    'escape angle');
  assert.ok(geometry.pendulumAmplitude > geometry.escapeAngle,
    'the pendulum swings beyond the escape angle');
  assert.ok(geometry.pendulumAmplitude < THREE.MathUtils.degToRad(6),
    'a plausible clock pendulum arc');
  assert.ok(geometry.pinOrbitRadius + geometry.pinRadius < geometry.diskRadius,
    'the pin stands within the disc face');
  // The neck is narrower than Brown's 11 px so the pin lands clear over the
  // opposite dead face; it stays within the engraving's line tolerance.
  assert.ok(geometry.neckHalfWidth > 0 && geometry.neckHalfWidth <= 5.5 * px);
  near(blocks.rubyPin.position.x, geometry.pinOrbitRadius, 0,
    'single pin radial location');
  near(blocks.rubyPin.userData.eccentricity,
    geometry.pinOrbitRadius, 0, 'pin eccentricity');
  assert.equal(blocks.rubyPin.userData.material, 'ruby');
  disposeModel(model.root);
});

test('movement 305 advances clockwise by exactly one half-turn per beat and one turn per pendulum cycle', () => {
  const model = createMovementModel(catalog.movements[304]);
  const { geometry, stateAtTime } = model.root.userData;

  const beatStart = (halfBeat) => halfBeat * geometry.halfBeatDuration
    - geometry.timeOrigin;
  for (let halfBeat = -2; halfBeat <= 4; halfBeat += 1) {
    const start = stateAtTime(beatStart(halfBeat));
    const end = stateAtTime(beatStart(halfBeat + 1));
    near(end.wheelAngle - start.wheelAngle, -Math.PI, 1e-12,
      `half-turn at beat ${halfBeat}`);
    vectorNear(end.pinCenter,
      model.root.userData.pinCenterAtWheelAngle(start.wheelAngle - Math.PI),
      1e-14, `opposite pin location at beat ${halfBeat}`);
  }
  const cycleStart = stateAtTime(0);
  const cycleEnd = stateAtTime(geometry.pendulumPeriod);
  near(cycleEnd.wheelAngle - cycleStart.wheelAngle,
    -FULL_TURN, 1e-12, 'one clockwise disc turn per cycle');
  vectorNear(cycleEnd.pinCenter, cycleStart.pinCenter, 1e-14,
    'single pin closes spatially');
  near(cycleEnd.pendulumAngle, cycleStart.pendulumAngle, 1e-14,
    'pendulum closes spatially');
  disposeModel(model.root);
});

const FULL_TURN = Math.PI * 2;

test('movement 305 dead faces are concentric with the pendulum pivot and produce exactly zero recoil', () => {
  const model = createMovementModel(catalog.movements[304]);
  const {
    geometry,
    palletFaces,
    stateAtTime,
  } = model.root.userData;

  near(palletFaces.upper.deadFaceRadius,
    geometry.lockCenterRadius - geometry.pinRadius, 0, 'ceiling radius');
  near(palletFaces.lower.deadFaceRadius,
    geometry.lockCenterRadius + geometry.pinRadius, 0, 'floor radius');
  for (const face of [palletFaces.upper, palletFaces.lower]) {
    for (const point of face.deadFacePoints) {
      near(point.length(), face.deadFaceRadius, 1e-12,
        `${face.position} rest is concentric`);
    }
    near(face.corner.length(), face.deadFaceRadius, 1e-12, 'neck corner on the dead face');
  }

  // Every dead rest: the disc is stationary, the pin centre is under the
  // ceiling (x >= c) or over the floor (x <= -c) and touches it exactly.
  const rests = new Set();
  let run = null;
  for (let index = 0; index <= 4000; index += 1) {
    const state = stateAtTime(geometry.pendulumPeriod * index / 4000);
    if (state.contactKind !== 'dead-rest') { run = null; continue; }
    rests.add(state.restFace);
    if (run && run.face === state.restFace) {
      near(state.wheelAngle, run.wheelAngle, 0, 'dead-rest disc is stationary');
    }
    run = { face: state.restFace, wheelAngle: state.wheelAngle };
    assert.ok(state.contactError < 1e-12, 'pin touches the dead face');
    // Just past the neck corner the pin is held on the corner edge for a
    // moment (at most 0.002) until it has room to turn.
    const x = state.pinCenterLocal.x;
    if (state.restFace === 'ceiling') assert.ok(x >= geometry.neckHalfWidth - 0.002, `pin under the ceiling (${x})`);
    else assert.ok(x <= -geometry.neckHalfWidth + 0.002, `pin over the floor (${x})`);
  }
  assert.deepEqual([...rests].sort(), ['ceiling', 'floor']);
  // The pin lands with a clear margin over the dead face.
  for (const side of ['upper', 'lower']) {
    const halfBeat = side === 'upper' ? 0 : 1;
    const landing = (halfBeat + geometry.events[side].drop + geometry.dropSpan)
      * geometry.halfBeatDuration - geometry.timeOrigin;
    const state = stateAtTime(landing + 1e-6);
    assert.equal(state.contactKind, 'dead-rest');
    const margin = Math.abs(state.pinCenterLocal.x) - geometry.neckHalfWidth;
    assert.ok(margin > 0.02, `${side} landing margin ${margin}`);
  }
  disposeModel(model.root);
});

test('movement 305 pin rolls round the neck corner and drives the upright face, with positive work', () => {
  const model = createMovementModel(catalog.movements[304]);
  const {
    geometry,
    palletFaces,
    pinClearanceAt,
    stateAtTime,
  } = model.root.userData;

  near(palletFaces.upper.impulseFaceX, geometry.neckHalfWidth, 0, 'upper face');
  near(palletFaces.lower.impulseFaceX, -geometry.neckHalfWidth, 0, 'lower face');
  const counts = {};
  let worstClearance = Infinity;
  for (let index = 0; index <= 8000; index += 1) {
    const state = stateAtTime(geometry.pendulumPeriod * index / 8000);
    worstClearance = Math.min(worstClearance,
      pinClearanceAt(state.wheelAngle, state.pendulumAngle));
    if (!/impulse/.test(state.contactKind)) continue;
    counts[state.mode] = (counts[state.mode] ?? 0) + 1;
    assert.ok(state.contactError < 1e-9, `${state.mode} contact ${state.contactError}`);
    if (state.contactKind === 'upright-impulse') {
      const side = palletFaces[state.impulseSide];
      near(state.pinCenterLocal.x, side.impulseCenterlineX, 1e-9, 'pin on the upright face');
      if (state.impulseSide === 'upper') assert.ok(state.pinCenterLocal.y >= side.corner.y - 1e-9);
      else assert.ok(state.pinCenterLocal.y <= side.corner.y + 1e-9);
    }
    // The pin pushes the plate from the pin centre towards the contact; the
    // torque about the pivot has the sign of the pendulum's swing.
    const push = state.contactPoint.clone().sub(state.pinCenter);
    const arm = state.contactPoint.clone().sub(geometry.palletPivot);
    const torque = arm.x * push.y - arm.y * push.x;
    assert.ok(torque * state.pendulumAngularSpeed > 0, `positive work at ${state.mode}`);
    // The driven disc turns clockwise while it gives impulse.
    assert.ok(state.wheelAngularSpeed < 0);
  }
  for (const mode of ['upper-corner-impulse', 'upper-upright-impulse',
    'lower-corner-impulse', 'lower-upright-impulse']) {
    assert.ok(counts[mode] > 20, `${mode} sampled (${counts[mode]})`);
  }
  assert.ok(worstClearance > -1e-9, `the pin never enters the plate (${worstClearance})`);
  const upright = stateAtTime(0);
  assert.equal(upright.mode, 'upper-upright-impulse', 'Brown\'s upright pendulum is mid-impulse');
  near(upright.pendulumAngle, 0, 1e-12, 'upright pendulum at time zero');
  disposeModel(model.root);
});

test('movement 305 state remains monotone, finite, periodic, and exposes both free drops', () => {
  const model = createMovementModel(catalog.movements[304]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  const modes = new Set();
  let previousAngle = stateAtTime(0).wheelAngle;

  for (let index = 1; index <= 20_000; index += 1) {
    const time = geometry.pendulumPeriod * index / 20_000;
    const state = stateAtTime(time);
    modes.add(state.mode);
    assert.ok(state.wheelAngle <= previousAngle + 1e-12,
      `disc never reverses at sample ${index}`);
    previousAngle = state.wheelAngle;
    for (const value of [
      state.beatAdvance,
      state.halfPhase,
      state.pendulumAngle,
      state.pendulumAngularSpeed,
      state.wheelAngle,
      state.wheelAngularSpeed,
    ]) assert.equal(Number.isFinite(value), true);
  }
  assert.deepEqual([...modes].sort(), [
    'ceiling-dead-rest',
    'ceiling-landing-drop',
    'floor-dead-rest',
    'floor-landing-drop',
    'lower-corner-impulse',
    'lower-upright-impulse',
    'upper-corner-impulse',
    'upper-upright-impulse',
  ]);
  assert.equal(timeline.demonstrationPeriod, geometry.pendulumPeriod);
  assert.equal(timeline.schedule.length, 8);
  assert.deepEqual(timeline.schedule.filter((entry) =>
    entry.includes('upright-face-impulse')), [
    'upper-upright-face-impulse',
    'lower-upright-face-impulse',
  ]);
  disposeModel(model.root);
});

test('movement 305 renderer follows the exact state and leaves movement 507 authored', () => {
  const movement = catalog.movements[304];
  const model = createMovementModel(movement);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.83, 1, 1.17, 2, 2.83, 3, 3.17, 4]) {
    model.update(time, 0.016);
    const state = stateAtTime(time);
    near(blocks.palletAssembly.rotation.z,
      state.pendulumAngle, 0, `pallet angle at ${time}`);
    near(blocks.wheelRotor.rotation.z,
      state.wheelAngle, 0, `disc angle at ${time}`);
    assert.equal(blocks.contactMarker.visible,false, 'unqualified global contact marker is suppressed');
    assert.equal(blocks.contactMarker.userData.activeFace,
      state.activeFace);
    blocks.rubyPin.updateWorldMatrix(true, false);
    const pinWorld = blocks.rubyPin.getWorldPosition(new THREE.Vector3());
    vectorNear(new THREE.Vector2(pinWorld.x, pinWorld.y),
      state.pinCenter, 1e-12, `rendered pin center at ${time}`);
    if (state.contactPoint) {
      vectorNear(new THREE.Vector2(
        blocks.contactMarker.position.x,
        blocks.contactMarker.position.y,
      ), state.contactPoint, 1e-12, `contact marker at ${time}`);
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

test('movement 305 cuts the opening to Brown\'s shape with the working faces as its own edges', () => {
  const model = createMovementModel(catalog.movements[304]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const ring = blocks.plate.userData.escapementOpening;
  const inside = ([x, y]) => {
    let result = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) result = !result;
    }
    return result;
  };
  const edgeDistance = (point) => {
    let best = Infinity;
    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy));
    }
    return best;
  };
  // Brown's two D windows: upper-left and lower-right of the arbor.
  const cy = geometry.diskCenter.y - geometry.palletPivot.y;
  assert.ok(inside([-0.5, cy + 0.3]) && inside([0.5, cy - 0.3]), 'upper-left and lower-right windows');
  assert.ok(!inside([-0.5, cy - 0.3]) && !inside([0.5, cy + 0.3]), 'solid lower-left and upper-right');
  // One outline: the band at the arbor is open from end to end, the windows
  // reach Brown's 74.5 px either side and 40 px above/below, and the neck is
  // bounded by the two upright faces at x = +-c.
  const px = geometry.sourceScale;
  for (const x of [-0.9, -0.5, 0, 0.5, 0.9]) assert.ok(inside([x, cy]), `band open at ${x}`);
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  near(Math.max(...xs), 74.5 * px, 1e-12, 'right reach');
  near(Math.min(...xs), -74.5 * px, 1e-12, 'left reach');
  near(Math.max(...ys) - cy, 40 * px, 1e-12, 'upper-left window top');
  near(cy - Math.min(...ys), 40 * px, 1e-12, 'lower-right window bottom');
  const c = geometry.neckHalfWidth;
  assert.ok(inside([c - 0.01, cy + 0.3]) && !inside([c + 0.01, cy + 0.3]), 'upper upright face at +c');
  assert.ok(inside([-c + 0.01, cy - 0.3]) && !inside([-c - 0.01, cy - 0.3]), 'lower upright face at -c');
  assert.equal(ring.length, new Set(ring.map((point) => point.join())).size, 'no repeated vertices');
  // The pin stays in the opening through the whole cycle, touching its edges
  // at the dead rests and impulses.
  let worst = Infinity;
  for (let index = 0; index <= 2000; index += 1) {
    const { pinCenterLocal } = stateAtTime(geometry.pendulumPeriod * index / 2000);
    const point = [pinCenterLocal.x, pinCenterLocal.y];
    assert.ok(inside(point), 'pin centre in the opening');
    worst = Math.min(worst, edgeDistance(point) - geometry.pinRadius);
  }
  assert.ok(worst > -0.001 && worst < 1e-6, `pin works on the edges (${worst})`);
  const plateBack = geometry.plateZ - geometry.palletDepth / 2;
  assert.ok(geometry.diskZ + geometry.diskDepth / 2 < plateBack, 'the disc runs behind the plate');
  assert.ok(blocks.disk.parent === blocks.wheelRotor);
});
