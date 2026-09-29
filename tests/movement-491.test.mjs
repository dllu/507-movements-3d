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
  new URL('../src/simulation/authored-capstans.js', import.meta.url),
  'utf8',
);

const ARCHETYPE =
  'handspike-driven-capstan-with-rotating-pawl-on-fixed-crown-ratchet';

function movementModel() {
  const movement = catalog.movements[490];
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

test('movement 491 is one rigid capstan with one cable and a moving pawl over a fixed circular ratchet', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom } = model.root.userData;

  assert.equal(movement.id, 491);
  assert.equal(movement.number, '491');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');

  for (const rotatingPart of [
    blocks.barrelBody,
    blocks.drumHead,
    blocks.handSpike,
    blocks.lowerCollar,
    blocks.pawlPivotAssembly,
  ]) {
    assert.equal(rotatingPart.parent, blocks.capstanRotor);
  }
  assert.equal(blocks.pawl.parent, blocks.pawlPivotAssembly);
  assert.equal(blocks.ratchet.parent, blocks.fixedBase);
  assert.notEqual(blocks.ratchet.parent, blocks.capstanRotor);
  // Brown draws the ratchet on the ground line; source presentation removes the plinth.
  assert.equal(blocks.basePlinth.parent, null);
  assert.ok(model.root.userData.sourcePresentation.removedRoles.includes('fixed-circular-base-plinth'));
  assert.equal(blocks.handSpikeEndCaps.length, 0);
  assert.equal(blocks.socketMarkers.length, 8);
  assert.equal(degreesOfFreedom.capstanOperatingCoordinates, 1);
  assert.equal(degreesOfFreedom.headBarrelAndHandspikeRelativeMotion, 0);
  assert.equal(degreesOfFreedom.ratchetBaseCoordinates, 0);
  assert.equal(degreesOfFreedom.cableMotionIndependent, 0);

  const cables = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.isSingleContinuousCable) cables.push(object);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(cables, [blocks.cable]);
  assert.deepEqual(belts, []);
  assert.equal(blocks.cable.geometry.type, 'LaidRopeGeometry');
  disposeModel(model.root);
});

test('movement 491 records Brown, the unavailable official animation, and period capstan evidence', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate491;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_491.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /Capstan.*cable or rope wound on the barrel.*hand-spikes or bars.*pawl attached to its lower part.*circular ratchet on the base/s);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /no canvas model or animation library.*Animated unavailable/s);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateHandSpikeEndpointsPixels, [14, 510]);
  assert.deepEqual(plate.approximatePawlPivotPixels, [263, 386]);
  assert.deepEqual(plate.approximatePawlTipPixels, [322, 424]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.engravingEvidence,
    /one waisted vertical barrel.*one diametral through hand-spike.*one pawl pivot.*upward-facing circular sawtooth ring/s);
  assert.match(evidence.britannicaCorroboration,
    /vertical capstan.*drum-head holes.*two-and-a-half or three rope turns.*pawls preventing recoil/s);
  assert.match(evidence.knowltonPatentCorroboration,
    /ratchet around the top of the fixed capstan base.*pawls on the outside of the barrel.*moving-pawl\/fixed-ratchet topology/s);
  assert.match(evidence.reconstructionDisclosure,
    /Exact dimensions.*eighteen-tooth count.*three-turn display.*independently engineered/s);
  disposeModel(model.root);
});

test('movement 491 head, barrel, hand-spike, and pawl carrier share one angle while the base remains stationary', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime, transmission } =
    model.root.userData;
  model.root.updateMatrixWorld(true);
  const fixedMatrices = [
    blocks.fixedBase,
    blocks.basePlinth,
    blocks.baseFoot,
    blocks.ratchet,
    blocks.fixedSpindle,
  ].map((object) => object.matrixWorld.clone());

  for (const time of [0, 0.17, 0.83, 1.92, 3.44, 6.71, 8, 12.37]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.capstanRotor.rotation.y, state.capstanRotationY, 0,
      `rendered rigid capstan ${time}`);
    near(state.capstanRotationY, -state.operatingAngleRadian, 0,
      `capstan working direction ${time}`);
    near(state.pawlWorldAzimuthRadian,
      geometry.pawlPivotAzimuth + state.operatingAngleRadian, 0,
      `carried pawl azimuth ${time}`);
    near(blocks.pawl.rotation.z,
      state.pawlClosure.pawlPitchAngleRadian, 0,
      `rendered pawl pitch ${time}`);
    [
      blocks.fixedBase,
      blocks.basePlinth,
      blocks.baseFoot,
      blocks.ratchet,
      blocks.fixedSpindle,
    ].forEach((object, index) => {
      assert.ok(object.matrixWorld.equals(fixedMatrices[index]),
        `fixed object ${index} moved at ${time}`);
    });
  }
  assert.match(transmission.rigidCapstanConstraint,
    /theta_hand_spike=theta_head=theta_barrel/);
  assert.match(transmission.pawlCarrierConstraint,
    /theta_pawl_carrier=theta_head=theta_barrel/);
  assert.match(transmission.stationaryRatchetConstraint,
    /theta_circular_ratchet=theta_base=0/);
  disposeModel(model.root);
});

test('movement 491 pawl has rigid closure to the finite contact profile and a continuous drop after each edge', () => {
  const { model } = movementModel();
  const {
    geometry,
    pawlClosureAtAzimuth,
    toothSurfaceAtAzimuth,
  } = model.root.userData;

  for (let sample = -360; sample <= 720; sample += 1) {
    const azimuth = sample * geometry.ratchetToothPitch / 137;
    const closure = pawlClosureAtAzimuth(azimuth);
    const surface = toothSurfaceAtAzimuth(azimuth);
    near(closure.toothSurface.height, surface.height, 0,
      `shared tooth surface ${sample}`);
    near(closure.verticalDifference,
      closure.pawlTipHeight - geometry.pawlPivotHeight, 2e-16,
      `vertical closure ${sample}`);
    // The pawl swings in the tangent plane about its radial pin.
    near(Math.hypot(
      closure.tangentialProjection,
      closure.verticalDifference,
    ), geometry.pawlLength, 2e-15, `rigid pawl length ${sample}`);
    assert.ok(closure.tangentialProjection > 0, 'nose trails toward recoil');
    near(closure.pawlTipRadius,
      Math.hypot(geometry.pawlPlaneRadius, closure.tangentialProjection), 0,
      `tip radius ${sample}`);
    assert.ok(closure.pawlTipRadius >= geometry.ratchetInnerRadius);
    assert.ok(closure.pawlTipRadius <= geometry.ratchetOuterRadius);
    assert.ok(closure.airborneClearance >= -2e-16);
    if (closure.contactingRamp) {
      // Resting means within the model's own 1e-7 airborne threshold (the
      // baked table lifts a few rows by nanometres so playback never cuts a crest).
      near(closure.airborneClearance, 0, 1e-7,
        `pawl-to-ramp contact ${sample}`);
    }
  }

  const phaseEpsilon = 1e-8;
  const toothStart = geometry.ratchetPhaseOffset
    + geometry.pawlReleasePhase * geometry.ratchetToothPitch;
  const beforeEdge = pawlClosureAtAzimuth(
    toothStart - phaseEpsilon * geometry.ratchetToothPitch,
  );
  const atEdge = pawlClosureAtAzimuth(toothStart);
  const afterEdge = pawlClosureAtAzimuth(
    toothStart + phaseEpsilon * geometry.ratchetToothPitch,
  );
  // The tip leaves the crest: its sharp construction point (the reference)
  // is released level with the crest, within the tip's small round.
  assert.ok(atEdge.pawlTipHeight > geometry.ratchetHighHeight - 0.01);
  assert.ok(atEdge.pawlTipHeight < geometry.ratchetHighHeight + geometry.pawlTipRadius);
  near(beforeEdge.pawlTipHeight, atEdge.pawlTipHeight, 3e-6, 'approach high edge');
  near(afterEdge.pawlTipHeight, atEdge.pawlTipHeight, 3e-6,
    'continuous freefall after high edge');
  // Approaching the crest the nose rides it (within the sub-millimetre
  // playback lift that keeps interpolation off the rolling crest).
  assert.ok(beforeEdge.airborneClearance < 1e-3);
  assert.equal(afterEdge.falling, true);
  const landing = pawlClosureAtAzimuth(
    toothStart
      + (geometry.pawlFreefallFraction + 1e-10)
        * geometry.ratchetToothPitch,
  );
  near(landing.airborneClearance, 0, 1e-8,
    'pawl lands on the finite next ramp envelope');
  assert.equal(landing.contactingRamp, true);
  disposeModel(model.root);
});

test('movement 491 ratchet rises only in the hauling direction and presents a high face to reverse travel', () => {
  const { model } = movementModel();
  const { dynamics, geometry, toothSurfaceAtAzimuth, transmission } =
    model.root.userData;
  const toothStart = geometry.ratchetPhaseOffset;
  let previousHeight = -Infinity;
  for (let sample = 0; sample < 1000; sample += 1) {
    const phase = sample / 1000;
    const surface = toothSurfaceAtAzimuth(
      toothStart + phase * geometry.ratchetToothPitch,
    );
    assert.ok(surface.height > previousHeight,
      `allowed-direction ramp rises at ${sample}`);
    previousHeight = surface.height;
  }
  const justBeforeStart = toothSurfaceAtAzimuth(
    toothStart - 1e-9 * geometry.ratchetToothPitch,
  );
  const atStart = toothSurfaceAtAzimuth(toothStart);
  near(justBeforeStart.height, geometry.ratchetHighHeight,
    3e-10, 'preceding reverse-blocking face height');
  near(atStart.height, geometry.ratchetLowHeight, 0,
    'new tooth foot');
  near(justBeforeStart.height - atStart.height,
    geometry.ratchetHighHeight - geometry.ratchetLowHeight,
    3e-10, 'vertical reverse-blocking face');
  assert.match(transmission.oneWayConstraint,
    /forward pawl azimuth rises.*reverse travel is arrested.*vertical tooth face/s);
  assert.match(dynamics.idealRatchetContact,
    /climbs each fixed tooth ramp.*falls continuously.*seats in the root against the tooth face/s);
  disposeModel(model.root);
});

test('movement 491 hauls its one laid cable at barrel surface speed smoothly through the straight-to-wrap tangent', () => {
  const { model } = movementModel();
  const { blocks, cableRoute, dynamics, geometry, stateAtTime,
    transmission } = model.root.userData;

  for (const time of [0, 0.19, 0.83, 1.77, 3.15, 5.62, 7.1, 7.8, 8.29]) {
    const state = stateAtTime(time);
    near(state.cableDistanceHauled,
      geometry.barrelRadius * state.operatingAngleRadian, 1e-12,
      `hauled distance ${time}`);
    const h = 1e-6;
    near(state.cableSpeed, (stateAtTime(time + h).cableDistanceHauled
      - stateAtTime(time - h).cableDistanceHauled) / (2 * h), 1e-6,
    `cable surface speed ${time}`);
    model.update(time);
    near(blocks.cable.geometry.userData.travel, state.cableDistanceHauled,
      0, `laid cable travel ${time}`);
  }
  assert.ok(cableRoute.curve instanceof THREE.Curve);
  assert.equal(blocks.cable.geometry.type, 'LaidRopeGeometry');
  assert.equal(blocks.cableMarkers, undefined);
  assert.ok(geometry.maximumHelixArcSpeedRatio < 1.0009);
  assert.match(transmission.cableHaulConstraint,
    /v_cable=r_barrel\*abs\(omega_capstan\)/);
  assert.match(dynamics.helixPackingDisclosure,
    /translation is exactly r_barrel.*less than 0\.09 percent/s);

  const contactProgress = geometry.freeCableEndX
    / cableRoute.curve.parameterLength;
  const before = cableRoute.curve.getPoint(contactProgress - 1e-7);
  const contact = cableRoute.curve.getPoint(contactProgress);
  const after = cableRoute.curve.getPoint(contactProgress + 1e-7);
  const incoming = contact.clone().sub(before).normalize();
  const outgoing = after.clone().sub(contact).normalize();
  assert.ok(incoming.dot(outgoing) > 0.999999999,
    'free cable and first wrap share a tangent');
  assert.ok(incoming.dot(new THREE.Vector3(-1, 0, 0))
    > 0.999999999);
  assert.match(sourceText,
    /cable\.geometry\.setTravel\(state\.cableDistanceHauled\)/);
  assert.match(dynamics.cableLayContinuity,
    /one arc-length Curve3.*share position and tangent.*barrel surface speed/s);
  disposeModel(model.root);
});

test('movement 491 remains in finite swept bounds and leaves spinning movement 507 as the next draft', () => {
  const { model } = movementModel();
  const { blocks, geometry } = model.root.userData;
  const union = new THREE.Box3();
  for (let sample = 0; sample <= 720; sample += 1) {
    model.update(geometry.operatingPeriod * sample / 720);
    model.root.updateMatrixWorld(true);
    // The cable lead and deck pipe beyond Brown's crop are outside the plate frame.
    model.root.traverse((object) => {
      if (!object.isMesh) return;
      for (let parent = object; parent; parent = parent.parent) if (parent.userData.beyondPlateCrop) return;
      union.union(new THREE.Box3().setFromObject(object));
    });
  }
  assert.ok(model.root.userData.cameraFitBounds.containsBox(union));
  assert.ok(Number.isFinite(union.min.x));
  assert.ok(Number.isFinite(union.max.z));
  assert.ok(model.root.userData.cameraDistanceScale >= 1);
  const footBounds = new THREE.Box3().setFromObject(blocks.baseFoot);
  assert.ok(model.root.userData.groundFloorY <= footBounds.min.y);

  const next = catalog.movements[506];
  assert.equal(next.id, 507);
  assert.equal(next.number, '507');
  assert.equal(next.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(next.fidelity, 'authored');
  disposeModel(model.root);
});

test('movement 491 hauls one turn per cycle, then eases back until the pawl seats in a tooth root as Brown draws it', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const period = geometry.operatingPeriod;
  // One net turn per cycle; the capstan only turns back in the short recoil.
  near(stateAtTime(period).operatingAngleRadian - stateAtTime(0).operatingAngleRadian, 2 * Math.PI, 1e-9, 'one turn');
  let previous = stateAtTime(0), backward = 0;
  for (let i = 1; i <= 8000; i++) {
    const state = stateAtTime(period * i / 8000);
    const step = state.operatingAngleRadian - previous.operatingAngleRadian;
    if (step < -1e-12) { backward -= step; assert.equal(state.stage, 'recoil'); }
    // The pose is continuous through every stage change and the loop seam.
    assert.ok(Math.abs(state.pawlClosure.pawlPitchAngleRadian - previous.pawlClosure.pawlPitchAngleRadian) < 0.03,
      `pawl jump at ${i}`);
    previous = state;
  }
  near(backward, geometry.recoilAngle, 1e-6, 'recoil angle');
  assert.ok(geometry.recoilAngle < geometry.ratchetToothPitch * 0.5, 'recoil is less than half a tooth');
  const start = stateAtTime(0), end = stateAtTime(period - 1e-9);
  near(end.pawlClosure.pawlPitchAngleRadian, start.pawlClosure.pawlPitchAngleRadian, 1e-6, 'loop seam pawl');
  near(end.operatingAngleRadian - 2 * Math.PI, start.operatingAngleRadian, 1e-6, 'loop seam capstan');
  assert.equal(stateAtTime(period - 0.1).stage, 'held');
  // Held (and at the displayed start) the nose is seated at the root.
  for (const time of [0, period - 0.1]) {
    const state = stateAtTime(time);
    const surface = model.root.userData.toothSurfaceAtAzimuth(state.pawlWorldAzimuthRadian);
    const offset = ((surface.toothPhase - geometry.pawlReleasePhase - geometry.pawlSeatPhase) % 1 + 1.5) % 1 - 0.5;
    near(offset, 0, 1e-6, `seat phase ${time}`);
    const noseBottom = state.pawlClosure.pawlTipHeight - geometry.pawlTipRadius;
    assert.ok(noseBottom - geometry.ratchetLowHeight < 0.05, `nose down in the root ${noseBottom}`);
  }
  disposeModel(model.root);
});
