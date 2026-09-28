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

function rotate([x, y], angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c * x - s * y, s * x + c * y];
}

function worldBox(object) {
  object.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(object);
}

test('movement 304 is one thirty-pin wheel and a broad pallet plate hung from a round collet', () => {
  const movement = catalog.movements[303];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    presentation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 304);
  assert.equal(movement.number, '304');
  assert.equal(movement.title,
    'Le Paute pin-wheel escapement with replaceable A/B pins');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'thirty-replaceable-single-plane-le-paute-pin-wheel-deadbeat-with-a-b-profiles');
  assert.equal(archetype, movement.archetype);
  assert.match(presentation, /flat front elevation/);
  assert.match(mechanism, /thirty replaceable single-plane pins/);
  assert.match(mechanism, /half-round A/);
  assert.match(mechanism, /undercut B/);
  assert.match(mechanism, /broad plate hung from the round collet/);
  assert.match(mechanism, /higher-outer and lower-inner pallets/);
  assert.match(mechanism, /concentric resting arcs/);
  assert.equal(transmission.pinCount, 30);
  assert.match(transmission.direction, /clockwise/);
  assert.match(transmission.impulse, /both pallet impulses act downward/);
  assert.match(transmission.deadbeat, /exactly zero/);
  assert.equal(transmission.recoil, 'none');

  assert.ok(blocks.escapeWheel.parent === model.root, 'escapeWheel parent');
  assert.ok(blocks.palletAssembly.parent === model.root, 'palletAssembly parent');
  assert.ok(blocks.fixedFrame.parent === model.root, 'fixedFrame parent');
  assert.ok(blocks.wheelRotor.parent === blocks.escapeWheel, 'wheelRotor parent');
  assert.ok(blocks.wheelRim.parent === blocks.wheelRotor, 'wheelRim parent');
  for (const name of ['outerPallet', 'innerPallet', 'broadPlate', 'collet',
    'colletRing', 'palletPivotHub', 'sidePlate']) {
    assert.ok(blocks[name].parent === blocks.palletAssembly, `${name} parent`);
  }
  assert.equal(blocks.pinMeshes.length, 30);
  assert.equal(blocks.preferredPins.length, 15);
  assert.equal(blocks.legacyPins.length, 15);
  assert.equal(blocks.spokeMeshes.length, 5);
  assert.equal(blocks.hubBoltMeshes.length, 7, 'Brown draws seven hub bolts');
  assert.equal(blocks.colletScrews.length, 2);
  assert.equal(blocks.sidePlateScrews.length, 2);
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'pin-wheel axis');
  vectorNear(blocks.palletAssembly.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'pallet axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'replaceable-pin-rivet-stem').length, 30);
  assert.equal(roles.filter((role) =>
    role === 'five-arm-pin-wheel-spoke').length, 5);
  assert.equal(roles.filter((role) =>
    /pallet-working-bit$/.test(role)).length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  // Brown draws no frame standard, bracket, base, index or contact marker.
  assert.equal(roles.some((role) =>
    /standard|bracket|base|white-|contact/.test(role)), false);
  disposeModel(model.root);
});

test('movement 304 opens as Brown’s flat front elevation with the plate in front of the pin ends', () => {
  const model = createMovementModel(catalog.movements[303]);
  const { blocks, geometry, sourcePresentation } = model.root.userData;

  assert.equal(model.root.userData.cameraFov, 8);
  assert.equal(model.root.userData.hideGround, true);
  assert.deepEqual(model.cameraDirection.toArray(), [0.05, 0.05, 1]);
  assert.deepEqual(sourcePresentation.removedRoles, []);

  near(geometry.pinFrontZ, geometry.wheelDepth / 2 + geometry.pinLength,
    1e-15, 'pin front');
  assert.ok(geometry.plateBackZ >= geometry.pinFrontZ + 0.04,
    'broad plate clears the pin ends');
  const pinFront = Math.max(...blocks.pinMeshes.map((pin) =>
    worldBox(pin).max.z));
  for (const name of ['broadPlate', 'collet', 'colletRing', 'sidePlate']) {
    assert.ok(worldBox(blocks[name]).min.z > pinFront + 0.03,
      `${name} lies in front of every pin and stem`);
  }
  // The collet is centred on the arbor and as wide as the hanging plate.
  const plate = worldBox(blocks.broadPlate);
  assert.ok(plate.max.x - plate.min.x >= 2 * geometry.colletRadius - 0.1,
    'plate is as wide as the collet');
  assert.ok(plate.max.x - plate.min.x <= 2 * geometry.colletRadius + 0.45,
    'only the outer pallet tooth projects beyond it');
  assert.ok(plate.min.y < geometry.wheelCenter.y,
    'plate hangs down past the wheel centre line');
  // Both working bits lie in the one pin working plane and reach the plate.
  for (const body of [blocks.outerPalletBody, blocks.innerPalletBody]) {
    const box = worldBox(body);
    assert.ok(box.min.z <= geometry.workingPlaneZ - geometry.palletDepth / 2 + 1e-6);
    assert.ok(box.max.z >= geometry.plateBackZ);
  }
  disposeModel(model.root);
});

test('movement 304 records Brown’s plate and the period thirty-pin construction evidence', () => {
  const movement = catalog.movements[303];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate304;
  const construction = sourceReference.constructionReference;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.match(sourceAnimation.referenceScope, /broad pallet plate/);
  assert.match(sourceAnimation.referenceScope, /downward action/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_304.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.equal(plate.modeledPinCount, 30);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterWheelCenter, new THREE.Vector2(190, 333));
  assert.equal(plate.rasterWheelOuterRadius, 171);
  assert.equal(plate.rasterWheelInnerRadius, 129);
  assert.equal(plate.rasterPinOrbitRadius, 149);
  assert.deepEqual(plate.rasterWheelBounds, {
    bottom: 506,
    left: 19,
    right: 385,
    top: 164,
  });
  assert.deepEqual(plate.rasterPalletPivot, new THREE.Vector2(359, 101));
  assert.equal(plate.rasterColletRadius, 72);
  assert.deepEqual(plate.rasterOuterPalletTip, new THREE.Vector2(352, 352));
  assert.deepEqual(plate.rasterInnerPalletTip, new THREE.Vector2(340, 386));
  assert.deepEqual(plate.rasterLegacyPinA, new THREE.Vector2(47, 318));
  assert.deepEqual(plate.rasterPreferredPinB,
    new THREE.Vector2(321, 429));
  assert.equal(plate.rasterHubBoltCircleRadius, 31);
  assert.match(plate.inferredTopology, /single working plane/);
  assert.match(plate.inferredTopology, /broad plate/);
  assert.match(plate.sourceDirection, /clockwise/);
  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 0, 'source wheel center');
  vectorNear(sourcePointToModel(plate.rasterPalletPivot),
    geometry.palletPivot, 0, 'source pallet pivot');
  near(geometry.wheelOuterRadius,
    plate.rasterWheelOuterRadius * geometry.sourceScale, 0,
  'source wheel radius');
  near(geometry.pinOrbitRadius,
    plate.rasterPinOrbitRadius * geometry.sourceScale, 0,
  'source pin circle');
  near(geometry.colletRadius,
    plate.rasterColletRadius * geometry.sourceScale, 0,
  'source collet radius');

  assert.equal(construction.author, 'Ward L. Goodrich');
  assert.equal(construction.publicationYear, 1905);
  assert.equal(construction.title, 'The Modern Clock');
  assert.match(construction.chapter, /Le Paute/);
  assert.deepEqual(construction.figures, [39, 40]);
  assert.match(construction.details, /Thirty pins at twelve-degree spacing/);
  assert.match(construction.details, /four-degree pallet swing/);
  assert.match(construction.details, /same plane/);
  assert.match(construction.url, /gutenberg\.org/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 75,
    edition: 21,
    illustrationPage: 74,
    publicationYear: 1908,
  });
  assert.match(model.root.userData.reconstructionNote, /prescribed kinematics/);
  disposeModel(model.root);
});

test('movement 304 builds replaceable half-round A and thin-slip B pins whose arcs carry every contact', () => {
  const model = createMovementModel(catalog.movements[303]);
  const {
    blocks,
    geometry,
    pinProfileForIndex,
    pinProfiles,
    stateAtCyclePhase,
    stateAtTime,
  } = model.root.userData;

  assert.equal(geometry.pinCount, 30);
  near(geometry.pinPitch, THREE.MathUtils.degToRad(12), 1e-15,
    'pin pitch');
  near(geometry.halfPinPitch, THREE.MathUtils.degToRad(6), 1e-15,
    'half-pitch beat');
  near(geometry.sourcePinAngularDiameter,
    THREE.MathUtils.degToRad(4), 0, 'source pin angular diameter');
  near(geometry.sourcePendulumTotalSwing,
    THREE.MathUtils.degToRad(4), 0, 'source total swing');
  near(geometry.palletAmplitude,
    geometry.sourcePendulumTotalSwing / 2, 0, 'swing amplitude');
  near(geometry.pinRadius,
    geometry.meanPalletRadius
      * Math.sin(geometry.sourcePinAngularDiameter / 2),
    1e-15, 'pin size from four-degree construction');
  near(geometry.legacyPinWorkingArc, Math.PI, 0,
    'legacy half-round working arc');
  // B's curved leading face is the arc the pallets touch.
  assert.ok(geometry.preferredArcStart > -Math.PI);
  assert.ok(geometry.preferredArcEnd < 0);
  assert.ok(geometry.preferredPinWorkingArc < 0.65 * Math.PI);
  assert.ok(geometry.preferredPinWorkingArc > 0.4 * Math.PI);
  assert.deepEqual(pinProfiles.legacyA, {
    count: 15,
    profile: 'one-half circular cylinder retained; inactive upper half removed',
    sourceLabel: 'A',
    workingArcRadians: Math.PI,
  });
  assert.equal(pinProfiles.preferredB.count, 15);
  assert.equal(pinProfiles.preferredB.sourceLabel, 'B');
  assert.equal(pinProfiles.preferredB.workingArcRadians,
    geometry.preferredPinWorkingArc);

  let minimumMargin = Infinity;
  for (let sample = 0; sample <= 6000; sample += 1) {
    const state = stateAtCyclePhase(sample / 6000);
    if (!state.contactActive) continue;
    const angle = state.contact.pinContactAngle;
    minimumMargin = Math.min(minimumMargin,
      angle - geometry.preferredArcStart,
      geometry.preferredArcEnd - angle);
  }
  assert.ok(minimumMargin > THREE.MathUtils.degToRad(5),
    `every contact lies on the B arc (${minimumMargin})`);

  for (let index = 0; index < blocks.pinMeshes.length; index += 1) {
    const pin = blocks.pinMeshes[index];
    const expectedProfile = pinProfileForIndex(index);
    assert.equal(pin.userData.index, index);
    assert.equal(pin.userData.profile, expectedProfile);
    assert.equal(pin.userData.replaceable, true);
    assert.equal(pin.children.length, 2);
    const stem = pin.children.find(({ userData }) =>
      userData.role === 'replaceable-pin-rivet-stem');
    assert.ok(stem, 'replaceable stem');
    // The stem is screwed into a blind hole in the rim, so the rim's back
    // face stays plain (no ring of stem ends).
    const stemBox = worldBox(stem);
    assert.ok(stemBox.min.z > -geometry.wheelDepth / 2 + 0.02);
    assert.ok(stemBox.min.z < geometry.wheelDepth / 2 - 0.1, 'stem seated deep in the rim');
    assert.ok(stemBox.max.z < geometry.workingPlaneZ - geometry.palletDepth / 2);
    assert.equal(pin.userData.role, expectedProfile === 'preferred-B'
      ? 'replaceable-preferred-slip-B-pin'
      : 'replaceable-legacy-half-round-A-pin');
  }
  assert.equal(stateAtTime(0).activePinProfile, 'preferred-B');
  assert.equal(stateAtTime(4).activePinProfile, 'preferred-B');
  disposeModel(model.root);
});

test('movement 304 pallets are finite bits with concentric rests, rounded lifting tips and the right hands', () => {
  const model = createMovementModel(catalog.movements[303]);
  const {
    blocks,
    geometry,
    lockFacePoints,
    palletMaterialDistance,
    palletProfiles,
    tipCenterLocal,
  } = model.root.userData;

  near(worldBox(blocks.outerPalletBody).min.z,
    geometry.workingPlaneZ - geometry.palletDepth / 2, 1e-6,
  'outer pallet working plane');
  near(worldBox(blocks.innerPalletBody).min.z,
    geometry.workingPlaneZ - geometry.palletDepth / 2, 1e-6,
  'inner pallet working plane');
  assert.match(palletProfiles.outer.position, /higher pallet on the right leg/);
  assert.match(palletProfiles.inner.position, /lower pallet on the left leg/);
  assert.equal(palletProfiles.outer.impulseDirection, 'downward');
  assert.equal(palletProfiles.inner.impulseDirection, 'downward');
  assert.equal(palletProfiles.outer.lockPoints.length, 49);
  assert.equal(palletProfiles.inner.lockPoints.length, 49);
  assert.equal(palletProfiles.outer.impulsePoints.length, 37);
  assert.equal(palletProfiles.inner.impulsePoints.length, 37);
  assert.ok(palletProfiles.outer.lockConcentricRadiusRange < 4e-15);
  assert.ok(palletProfiles.inner.lockConcentricRadiusRange < 4e-15);

  for (const [name, side] of [['outer', 1], ['inner', -1]]) {
    const outline = palletProfiles[name].finiteOutline;
    assert.equal(outline.length, 1, `${name} bit is one piece`);
    assert.equal(outline[0].length, 1, `${name} bit has no holes`);
    const lockPoints = lockFacePoints(side, 121);
    const lockRadii = lockPoints.map((point) => point.length());
    near(Math.max(...lockRadii) - Math.min(...lockRadii), 0, 4e-15,
      `${name} concentric pallet rest`);
    vectorNear(lockPoints[0], palletProfiles[name].impulsePoints[0], 6e-15,
      `${name} rest/tip join`);
    // Every lift contact lies on the small tip rounding.
    const tip = tipCenterLocal(side);
    for (const point of palletProfiles[name].impulsePoints) {
      near(point.distanceTo(tip), geometry.tipRoundingRadius, 1e-12,
        `${name} lift point on tip rounding`);
    }
    // The finished bit keeps every working face, a working clearance away.
    for (const point of [...lockPoints, ...palletProfiles[name].impulsePoints]) {
      const distance = palletMaterialDistance(side, point);
      assert.ok(distance >= -1e-9, `${name} face point is not buried`);
      assert.ok(distance <= geometry.workingClearance + 5e-4,
        `${name} face point is carried by the bit (${distance})`);
    }
    // Outer bit reaches in from outside the pin circle, inner from inside.
    const ring = outline[0][0];
    const centroidX = ring.reduce((sum, [x]) => sum + x, 0) / ring.length;
    const worldCentroid = centroidX + geometry.palletPivot.x;
    if (side > 0) assert.ok(worldCentroid > geometry.pinOrbitRadius);
    else assert.ok(worldCentroid < geometry.pinOrbitRadius);
  }
  // Outer rest is the higher one.
  assert.ok(palletProfiles.outer.lockPoints[0].y
    > palletProfiles.inner.lockPoints[0].y + 0.15);
  disposeModel(model.root);
});

test('movement 304 finite pins never enter the finite pallet bits over a whole cycle', () => {
  const model = createMovementModel(catalog.movements[303]);
  const {
    geometry,
    palletMaterialDistance,
    palletProfiles,
    stateAtCyclePhase,
  } = model.root.userData;
  const boxes = [[1, palletProfiles.outer], [-1, palletProfiles.inner]]
    .map(([side, profile]) => {
      const ring = profile.finiteOutline[0][0];
      return {
        maxX: Math.max(...ring.map(([x]) => x)) + 0.01,
        maxY: Math.max(...ring.map(([, y]) => y)) + 0.01,
        minX: Math.min(...ring.map(([x]) => x)) - 0.01,
        minY: Math.min(...ring.map(([, y]) => y)) - 0.01,
        side,
      };
    });
  let checked = 0;
  const outlineFor = (profile) => {
    const [start, end] = profile === 'preferred-B'
      ? [geometry.preferredArcStart, geometry.preferredArcEnd]
      : [Math.PI, 2 * Math.PI];
    const points = [];
    for (let index = 0; index <= 32; index += 1) {
      const angle = start + (end - start) * index / 32;
      points.push([Math.cos(angle) * geometry.pinRadius,
        Math.sin(angle) * geometry.pinRadius]);
    }
    if (profile === 'preferred-B') {
      // Trapezoid: chord flanks down to the full-width trailing base.
      points.unshift([-geometry.pinRadius, 0]);
      points.push([geometry.pinRadius, 0]);
    }
    const first = points[0];
    const last = points.at(-1);
    for (let index = 1; index < 8; index += 1) {
      points.push([
        last[0] + (first[0] - last[0]) * index / 8,
        last[1] + (first[1] - last[1]) * index / 8,
      ]);
    }
    return points;
  };
  const outlines = {
    'legacy-A': outlineFor('legacy-A'),
    'preferred-B': outlineFor('preferred-B'),
  };
  let worst = Infinity;
  for (let sample = 0; sample < 1600; sample += 1) {
    const state = stateAtCyclePhase(sample / 1600);
    for (let pinIndex = 0; pinIndex < geometry.pinCount; pinIndex += 1) {
      const pinAngle = state.wheelAngle + pinIndex * geometry.pinPitch;
      if (Math.cos(pinAngle) < 0.7) continue;
      for (const profile of ['legacy-A', 'preferred-B']) {
        for (const point of outlines[profile]) {
          const [wx, wy] = rotate(
            [point[0] + geometry.pinOrbitRadius, point[1]],
            pinAngle,
          );
          const local = new THREE.Vector2(
            ...rotate([
              wx - geometry.palletPivot.x,
              wy - geometry.palletPivot.y,
            ], -state.palletAngle),
          );
          for (const box of boxes) {
            if (local.x < box.minX || local.x > box.maxX
              || local.y < box.minY || local.y > box.maxY) continue;
            checked += 1;
            worst = Math.min(worst, palletMaterialDistance(box.side, local));
          }
        }
      }
    }
  }
  assert.ok(checked > 10000, `pins sampled near the bits (${checked})`);
  assert.ok(worst >= -1e-6, `no pin enters a pallet bit (${worst})`);
  assert.ok(worst < 0.01, 'pins do reach the working faces');
  disposeModel(model.root);
});

test('movement 304 alternates the same pin outer-to-inner and the succeeding pin back to outer with exact contact', () => {
  const model = createMovementModel(catalog.movements[303]);
  const {
    lockPinCenterForSide,
    palletFaceFrame,
    stateAtCyclePhase,
  } = model.root.userData;
  const contactSpells = [];
  const lockCounts = new Map([[-1, 0], [1, 0]]);
  const impulseCounts = new Map([[-1, 0], [1, 0]]);
  let previousContact = false;

  for (let sample = 0; sample <= 14000; sample += 1) {
    const state = stateAtCyclePhase(sample / 14000);
    if (state.contactActive && !previousContact) {
      contactSpells.push({
        index: state.activePinIndex,
        profile: state.activePinProfile,
        side: state.activeSide,
      });
    }
    previousContact = state.contactActive;
    if (!state.contactActive) continue;

    near(state.contact.pointError, 0, 4e-15,
      `pin/pallet point closure at ${sample}`);
    near(state.contact.normalVelocityError, 0, 2e-15,
      `pin/pallet normal velocity at ${sample}`);
    near(state.contact.radialClearanceError, 0, 1e-15,
      `pin surface radius at ${sample}`);
    assert.ok(Number.isFinite(state.contact.relativeSlipSpeed));
    assert.equal(state.contact.pinProfile, state.activePinProfile);
    // The pallet is pressed downward and so opposes the clockwise drive.
    assert.ok(state.contact.faceNormal.y < -0.5,
      `downward contact normal at ${sample}`);
    const drive = new THREE.Vector2(
      state.activePinCenter.y,
      -state.activePinCenter.x,
    ).normalize();
    assert.ok(state.contact.faceNormal.dot(drive) > 0.5,
      `pallet reaction opposes drive at ${sample}`);
    const mode = state.lockActive ? 'lock' : 'impulse';
    const frame = palletFaceFrame(
      state.activeSide,
      state.palletAngle,
      mode,
    );
    vectorNear(state.contact.localPoint, frame.point, 0,
      `pallet material point at ${sample}`);
    if (state.lockActive) {
      lockCounts.set(state.activeSide, lockCounts.get(state.activeSide) + 1);
      assert.equal(state.contactMode, 'concentric-rest');
      assert.equal(state.wheelAngularSpeed, 0);
      assert.equal(state.wheelAngularAcceleration, 0);
      near(state.contact.concentricRadiusError, 0, 4e-15,
        `deadbeat radius at ${sample}`);
      vectorNear(state.activePinCenter,
        lockPinCenterForSide(state.activeSide), 4e-15,
      `stationary pin center at ${sample}`);
    } else {
      impulseCounts.set(state.activeSide,
        impulseCounts.get(state.activeSide) + 1);
      assert.equal(state.contactMode, 'downward-impulse');
      assert.ok(state.contact.pinMaterialVelocity.y <= 1e-14);
      assert.ok(state.impulseProgress >= 0);
      assert.ok(state.impulseProgress <= 1);
    }
  }
  assert.deepEqual(contactSpells, [
    { index: 0, profile: 'preferred-B', side: 1 },
    { index: 0, profile: 'preferred-B', side: -1 },
    { index: 1, profile: 'preferred-B', side: 1 },
  ]);
  assert.ok(lockCounts.get(1) > 2400);
  assert.ok(lockCounts.get(-1) > 2400);
  assert.ok(impulseCounts.get(1) > 1800);
  assert.ok(impulseCounts.get(-1) > 1800);
  disposeModel(model.root);
});

test('movement 304 partitions each clockwise beat into lift over the tip and an accelerating drop without recoil', () => {
  const model = createMovementModel(catalog.movements[303]);
  const { canonicalTimes, geometry, stateAtCyclePhase, stateAtTime } =
    model.root.userData;

  for (const release of [geometry.outerRelease, geometry.innerRelease]) {
    assert.ok(release.impulseAdvance > THREE.MathUtils.degToRad(0.8));
    assert.ok(release.impulseAdvance < THREE.MathUtils.degToRad(1.6));
    near(release.impulseAdvance + release.freeDropAdvance,
      geometry.halfPinPitch, 1e-15, 'half-pitch partition');
    assert.ok(release.wheelSpeed < 0, 'still turning clockwise at release');
    assert.ok(release.dropAcceleration < 0, 'drop accelerates clockwise');
    assert.ok(release.landingWheelSpeed < release.wheelSpeed);
  }
  assert.ok(geometry.landingAmplitudeFraction > geometry.lockingAmplitudeFraction,
    'pins land on the rest, not on the tip');

  let dropEntries = 0;
  let previousDrop = false;
  let previousAngle = stateAtTime(0).wheelAngle;
  for (let sample = 0; sample <= 14000; sample += 1) {
    const state = stateAtCyclePhase(sample / 14000);
    assert.ok(state.wheelAngularSpeed <= 1e-14,
      `clockwise/no recoil at ${sample}`);
    assert.ok(state.wheelAngle <= previousAngle + 1e-13,
      `monotone wheel at ${sample}`);
    const dropping = state.dropProgress !== null;
    if (dropping && !previousDrop) dropEntries += 1;
    if (dropping) {
      assert.ok(state.dropProgress >= 0);
      assert.ok(state.dropProgress <= 1);
      assert.ok(state.wheelAngularAcceleration < 0);
    }
    previousDrop = dropping;
    previousAngle = state.wheelAngle;
  }
  assert.equal(dropEntries, 2);

  for (const [releaseName, landingName, release] of [
    ['outerRelease', 'innerLanding', geometry.outerRelease],
    ['innerRelease', 'outerLanding', geometry.innerRelease],
  ]) {
    const releaseTime = canonicalTimes[releaseName];
    const beforeRelease = stateAtTime(releaseTime - 1e-9);
    const afterRelease = stateAtTime(releaseTime + 1e-9);
    near(beforeRelease.wheelAngle, afterRelease.wheelAngle, 1e-9,
      `${releaseName} position continuity`);
    near(beforeRelease.wheelAngularSpeed, afterRelease.wheelAngularSpeed,
      1e-8, `${releaseName} speed continuity`);
    near(afterRelease.wheelAngularSpeed, release.wheelSpeed, 1e-8,
      `${releaseName} speed`);
    const landingTime = canonicalTimes[landingName];
    const beforeLanding = stateAtTime(landingTime - 1e-9);
    const landing = stateAtTime(landingTime);
    near(beforeLanding.wheelAngle, landing.wheelAngle, 1e-9,
      `${landingName} position continuity`);
    near(beforeLanding.wheelAngularSpeed, release.landingWheelSpeed, 4e-8,
      `${landingName} impact speed`);
    assert.equal(landing.wheelAngularSpeed, 0);
  }

  const start = stateAtTime(0.40);
  const nextBeat = stateAtTime(0.40 + geometry.halfBeatDuration);
  const nextCycle = stateAtTime(0.40 + geometry.pendulumPeriod);
  near(nextBeat.wheelAngle - start.wheelAngle,
    -geometry.halfPinPitch, 8e-16, 'one half-pitch per beat');
  near(nextCycle.wheelAngle - start.wheelAngle,
    -geometry.pinPitch, 9e-16, 'one pin pitch per oscillation');
  assert.equal(start.activePinIndex, nextBeat.activePinIndex);
  assert.equal(nextCycle.activePinIndex,
    (start.activePinIndex + 1) % geometry.pinCount);
  near(nextCycle.palletAngle, start.palletAngle, 5e-16,
    'pallet closure');
  disposeModel(model.root);
});

test('movement 304 analytic rates and renderer bindings agree in locks, lifts, and drops', () => {
  const model = createMovementModel(catalog.movements[303]);
  const { blocks, stateAtTime } = model.root.userData;
  const epsilon = 2e-5;
  const sampleTimes = [0.2, 0.8, 0.95, 1.1, 1.8, 2.8, 2.95, 3.1, 3.7];
  const stages = new Set();

  for (const time of sampleTimes) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    stages.add(/drop/.test(state.stage) ? 'drop'
      : /impulse/.test(state.stage) ? 'impulse' : 'lock');
    near((after.palletAngle - before.palletAngle) / (2 * epsilon),
      state.palletAngularSpeed, 5e-10,
    `pallet speed at ${time}`);
    near((after.palletAngularSpeed - before.palletAngularSpeed)
        / (2 * epsilon),
    state.palletAngularAcceleration, 5e-10,
    `pallet acceleration at ${time}`);
    near((after.wheelAngle - before.wheelAngle) / (2 * epsilon),
      state.wheelAngularSpeed, 2e-9,
    `wheel speed at ${time}`);
    near((after.wheelAngularSpeed - before.wheelAngularSpeed)
        / (2 * epsilon),
    state.wheelAngularAcceleration, 5e-8,
    `wheel acceleration at ${time}`);

    model.update(time);
    near(blocks.palletAssembly.rotation.z, state.palletAngle, 0,
      `rendered pallets at ${time}`);
    near(blocks.wheelRotor.rotation.z, state.wheelAngle, 0,
      `rendered wheel at ${time}`);
    near(blocks.wheelRotor.userData.angularSpeed,
      state.wheelAngularSpeed, 0, `rendered wheel speed at ${time}`);
    assert.equal(model.root.userData.contacts.mode, state.contactMode);
    if (state.contactActive) {
      vectorNear(model.root.userData.contacts.expectedPoint,
        state.contact.expectedPoint, 0, `reported contact at ${time}`);
      near(model.root.userData.contacts.pointError, 0, 4e-15,
        `rendered contact closure at ${time}`);
    } else {
      assert.equal(model.root.userData.contacts.activePallet, null);
      assert.ok(model.root.userData.contacts.dropProgress >= 0);
      assert.ok(model.root.userData.contacts.dropProgress <= 1);
    }
  }
  assert.deepEqual([...stages].sort(), ['drop', 'impulse', 'lock']);
  disposeModel(model.root);
});

test('movement 304 closes one pin pitch, remains distinct from 292, and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[303]);
  const {
    animationTiming,
    canonicalTimes,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;

  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(timeline.demonstrationPeriod, 4);
  assert.equal(canonicalTimes.sourcePose, 0);
  assert.equal(canonicalTimes.outerMaximumLock, 0);
  const start = stateAtTime(0);
  const end = stateAtTime(4);
  assert.equal(start.sourcePose, true);
  assert.equal(end.sourcePose, true);
  assert.equal(start.stage, 'higher-outer-maximum-deadbeat-lock');
  assert.equal(end.stage, start.stage);
  assert.equal(start.activePinIndex, 0);
  assert.equal(end.activePinIndex, 1);
  assert.equal(start.activePinProfile, 'preferred-B');
  near(end.wheelAngle - start.wheelAngle,
    -geometry.pinPitch, 9e-16, 'clockwise cycle advance');
  near(end.pinsAdvanced, 1, 2e-15, 'one pin advanced');

  // 292 is a different mechanism: 48 studs alternately on the front and
  // back faces of its rim (authored-plate-escapements.js).
  const stud292 = createMovementModel(catalog.movements[291]);
  const studRoles = [];
  stud292.root.traverse((object) => { if (/^(front|back)-stud$/.test(object.userData.role ?? '')) studRoles.push(object.userData.role); });
  assert.equal(studRoles.filter((role) => role === 'front-stud').length, 24);
  assert.equal(studRoles.filter((role) => role === 'back-stud').length, 24);
  assert.equal(model.root.userData.blocks.pinMeshes.some((pin) =>
    'axialPlane' in pin.userData), false);

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(stud292.root);
  disposeModel(model.root);
});
