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

test('movement 270 is one belt-driven pulley on a six-roller bearing', () => {
  const movement = catalog.movements[269];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
  } = model.root.userData;

  assert.equal(movement.id, 270);
  assert.equal(movement.number, '270');
  assert.equal(movement.title,
    'Six-Roller Anti-Friction Pulley Bearing');
  assert.equal(movement.category, 'Ropes, belts & pulleys');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'belt-driven-pulley-six-roller-bearing-fixed-inner-race-rotating-outer-race',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /six-equally-spaced-cylindrical-elements/);
  assert.match(mechanism, /fourteen-nineteenths/);
  assert.match(mechanism, /fourteen-ninths/);
  assert.equal(blocks.pulley.parent, model.root);
  assert.equal(blocks.pulleyRotor.parent, blocks.pulley);
  assert.equal(blocks.pulleyWeb.parent, blocks.pulleyRotor);
  assert.equal(blocks.pulleyRim.parent, blocks.pulleyRotor);
  assert.equal(blocks.outerRaceSurface.parent, blocks.pulleyRotor);
  assert.equal(blocks.pulleyIndex.parent, blocks.pulleyRotor);
  assert.equal(blocks.rollerCarrier.parent, model.root);
  assert.equal(blocks.cagePlate.parent, blocks.rollerCarrier);
  assert.equal(blocks.cageIndex.parent, blocks.rollerCarrier);
  assert.equal(blocks.innerRace.parent, model.root);
  assert.equal(blocks.innerRaceIndex.parent, model.root);
  assert.equal(blocks.belt.parent, model.root);
  assert.ok(blocks.beltMarkers.every((marker) => marker.parent === model.root));
  assert.equal(blocks.rollerAssemblies.length, 6);
  for (const assembly of blocks.rollerAssemblies) {
    assert.equal(assembly.positionGroup.parent, blocks.rollerCarrier);
    assert.equal(assembly.rotor.parent, assembly.positionGroup);
    assert.equal(assembly.body.parent, assembly.rotor);
    assert.equal(assembly.hub.parent, assembly.rotor);
    assert.equal(assembly.faceIndex.parent, assembly.rotor);
  }
  assert.notEqual(blocks.pulleyRotor, blocks.rollerCarrier);
  assert.notEqual(blocks.innerRace, blocks.pulleyRotor);
  disposeModel(model.root);
});

test('movement 270 records the source ambiguity and both engraved views', () => {
  const model = createMovementModel(catalog.movements[269]);
  const {
    bearingInterpretation,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate270;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.match(sourceAnimation.officialNote, /not completely clear/);
  assert.match(sourceAnimation.referenceScope, /qualitative directions only/);
  assert.match(sourceAnimation.referenceScope, /independently derived/);
  assert.equal(bearingInterpretation.sourceAmbiguityAcknowledged, true);
  assert.equal(bearingInterpretation.interpretation,
    'six-cylindrical-roller-radial-bearing');
  assert.match(bearingInterpretation.certainty, /under-specified/);
  assert.match(bearingInterpretation.consolidatedView, /assembled left view/);
  assert.match(bearingInterpretation.consolidatedView, /exposed right view/);
  assert.equal(sourceReference.officialDescription,
    catalog.movements[269].description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 6);
  assert.equal(plate.officialAnimationAvailable, true);
  assert.deepEqual(plate.assembledView, {
    centerX: 145,
    centerY: 266,
    coverRadius: 63,
    holeCircleRadius: 44,
    holeRadius: 6,
    pulleyOuterRadius: 113,
  });
  assert.equal(plate.cutawayView.centerX, 391);
  assert.equal(plate.cutawayView.centerY, 267);
  assert.equal(plate.cutawayView.innerRaceRadius, 25);
  assert.equal(plate.cutawayView.pulleyOuterRadius, 112);
  assert.equal(plate.cutawayView.rollerRadius, 25);
  assert.deepEqual(plate.cutawayView.rollerCenters, [
    { x: 390, y: 219 },
    { x: 435, y: 244 },
    { x: 436, y: 296 },
    { x: 391, y: 322 },
    { x: 346, y: 297 },
    { x: 345, y: 245 },
  ]);
  assert.match(plate.inferredTopology, /two views of one pulley bearing/);
  assert.match(plate.inferredTopology, /six equally spaced rolling elements/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 69,
    edition: 21,
    illustrationPage: 68,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 270 matches the measured pulley, journal, and roller proportions', () => {
  const model = createMovementModel(catalog.movements[269]);
  const {
    geometry,
    sourceReference,
  } = model.root.userData;
  const cutaway = sourceReference.plate270.cutawayView;
  const rasterCenterDistances = cutaway.rollerCenters.map(({ x, y }) => (
    Math.hypot(x - cutaway.centerX, y - cutaway.centerY)
  ));
  const rasterMeanCenterDistance = rasterCenterDistances.reduce(
    (sum, value) => sum + value,
    0,
  ) / rasterCenterDistances.length;
  const rasterBearingOuterRadius = rasterMeanCenterDistance
    + cutaway.rollerRadius;

  assert.equal(geometry.rollerCount, cutaway.rollerCenters.length);
  near(
    geometry.pulleyOuterRadius / geometry.rollerPitchRadius,
    cutaway.pulleyOuterRadius / cutaway.rollerRadius,
    0.12,
    'pulley-to-roller radius ratio',
  );
  near(
    geometry.innerRaceRadius / geometry.rollerPitchRadius,
    cutaway.innerRaceRadius / cutaway.rollerRadius,
    0.12,
    'journal-to-roller radius ratio',
  );
  near(
    geometry.rollerCenterRadius / geometry.rollerPitchRadius,
    rasterMeanCenterDistance / cutaway.rollerRadius,
    0.17,
    'roller-center orbit ratio',
  );
  near(
    geometry.outerRaceInnerRadius / geometry.pulleyOuterRadius,
    rasterBearingOuterRadius / cutaway.pulleyOuterRadius,
    0.025,
    'bearing-to-pulley radius ratio',
  );
  assert.ok(geometry.beltHiddenReturnLength > 0);
  assert.ok(geometry.beltHiddenReturnLength < geometry.beltThickness * 2);
  near(
    geometry.beltCenterlineRadius - geometry.beltThickness / 2,
    geometry.pulleyOuterRadius,
    1e-15,
    'belt inner face touches the pulley tread',
  );
  disposeModel(model.root);
});

test('movement 270 has six exact, separated rollers tangent to both races', () => {
  const model = createMovementModel(catalog.movements[269]);
  const {
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;

  near(
    geometry.rollerCenterRadius,
    geometry.innerRaceRadius + geometry.rollerPitchRadius,
    1e-15,
    'inner radial tangency',
  );
  near(
    geometry.outerRaceInnerRadius,
    geometry.rollerCenterRadius + geometry.rollerPitchRadius,
    1e-15,
    'outer radial tangency',
  );
  near(
    geometry.adjacentRollerCenterDistance,
    2 * geometry.rollerCenterRadius * Math.sin(Math.PI / 6),
    1e-15,
    'adjacent center chord',
  );
  near(
    geometry.adjacentRollerClearance,
    geometry.adjacentRollerCenterDistance
      - 2 * geometry.rollerBodyRadius,
    1e-15,
    'adjacent roller clearance',
  );
  assert.ok(geometry.adjacentRollerClearance > 0.049);
  near(transmission.cageToOuterSpeedRatio, 14 / 19, 1e-15,
    'cage ratio');
  near(transmission.rollerToOuterSpeedRatio, 14 / 9, 1e-15,
    'roller spin ratio');

  for (let sample = 0; sample <= 2048; sample += 1) {
    const time = 6 * sample / 2048;
    const state = stateAtTime(time);
    assert.equal(state.rollers.length, 6);
    for (const [index, roller] of state.rollers.entries()) {
      near(roller.center.length(), geometry.rollerCenterRadius,
        2e-15, `roller ${index} center orbit`);
      near(roller.innerContactPoint.length(), geometry.innerRaceRadius,
        2e-15, `roller ${index} inner contact radius`);
      near(roller.outerContactPoint.length(), geometry.outerRaceInnerRadius,
        2e-15, `roller ${index} outer contact radius`);
      near(roller.innerContactGap, 0, 2e-15,
        `roller ${index} inner contact gap`);
      near(roller.outerContactGap, 0, 2e-15,
        `roller ${index} outer contact gap`);
      near(roller.innerNoSlipVelocityError.length(), 0, 5e-16,
        `roller ${index} fixed-inner-race no slip`);
      near(roller.outerNoSlipVelocityError.length(), 0, 5e-16,
        `roller ${index} rotating-outer-race no slip`);
      near(roller.innerContactPhaseError, 0, 2e-15,
        `roller ${index} integrated inner rolling phase`);
      near(roller.outerContactPhaseError, 0, 6e-15,
        `roller ${index} integrated outer rolling phase`);
      const next = state.rollers[(index + 1) % state.rollers.length];
      near(
        roller.center.distanceTo(next.center),
        geometry.adjacentRollerCenterDistance,
        3e-15,
        `roller ${index} adjacent center separation`,
      );
    }
  }
  disposeModel(model.root);
});

test('movement 270 derives all race, cage, and roller rates from no slip', () => {
  const model = createMovementModel(catalog.movements[269]);
  const {
    geometry,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;
  const state = stateAtTime(1.37);

  near(
    transmission.cageAngularSpeed,
    transmission.outerRaceAngularSpeed
      * geometry.outerRaceInnerRadius
      / (geometry.innerRaceRadius + geometry.outerRaceInnerRadius),
    1e-15,
    'cage angular speed law',
  );
  near(
    transmission.rollerAngularSpeed,
    transmission.outerRaceAngularSpeed
      * geometry.outerRaceInnerRadius
      / (geometry.outerRaceInnerRadius - geometry.innerRaceRadius),
    1e-15,
    'roller angular speed law',
  );
  near(
    geometry.rollerCenterRadius * transmission.cageAngularSpeed,
    geometry.rollerPitchRadius * transmission.rollerAngularSpeed,
    3e-16,
    'inner contact speed identity',
  );
  near(
    geometry.rollerCenterRadius * transmission.cageAngularSpeed
      + geometry.rollerPitchRadius * transmission.rollerAngularSpeed,
    geometry.outerRaceInnerRadius * transmission.outerRaceAngularSpeed,
    3e-16,
    'outer contact speed identity',
  );
  // Brown's arrow runs anticlockwise (pass 91).
  assert.ok(state.outerRaceAngularSpeed > 0);
  assert.ok(state.cageAngularSpeed > 0);
  assert.ok(state.rollerAngularSpeed > 0);
  assert.ok(Math.abs(state.cageAngularSpeed)
    < Math.abs(state.outerRaceAngularSpeed));
  assert.ok(Math.abs(state.rollerAngularSpeed)
    > Math.abs(state.outerRaceAngularSpeed));
  assert.equal(transmission.innerRaceAngularSpeed, 0);
  assert.equal(transmission.contactCount, 12);
  assert.equal(transmission.fullClosureOuterTurns, 171);
  assert.equal(transmission.fullClosureCageTurns, 126);
  assert.equal(transmission.fullClosureRollerTurns, 266);
  assert.equal(timeline.demonstrationPeriod, 6);
  assert.equal(timeline.fullMarkedAssemblyClosure, 1026);
  disposeModel(model.root);
});

test('movement 270 belt and white markers traverse tangent-continuously', () => {
  const model = createMovementModel(catalog.movements[269]);
  const {
    geometry,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;
  const leftTransition = geometry.beltLegLength;
  const rightTransition = geometry.beltLegLength
    + Math.PI * geometry.beltCenterlineRadius;
  const epsilon = 1e-8;
  const leftBefore = transmission.beltPointAtVisibleDistance(
    leftTransition - epsilon,
  );
  const leftAt = transmission.beltPointAtVisibleDistance(leftTransition);
  const leftAfter = transmission.beltPointAtVisibleDistance(
    leftTransition + epsilon,
  );
  const rightBefore = transmission.beltPointAtVisibleDistance(
    rightTransition - epsilon,
  );
  const rightAt = transmission.beltPointAtVisibleDistance(rightTransition);
  const rightAfter = transmission.beltPointAtVisibleDistance(
    rightTransition + epsilon,
  );

  vectorNear(leftAt.position,
    new THREE.Vector2(-geometry.beltCenterlineRadius, 0),
    1e-15, 'left tangent point');
  vectorNear(rightAt.position,
    new THREE.Vector2(geometry.beltCenterlineRadius, 0),
    2e-15, 'right tangent point');
  vectorNear(leftBefore.tangent, leftAfter.tangent, 1e-8,
    'left straight-to-arc tangent continuity');
  vectorNear(rightBefore.tangent, rightAfter.tangent, 1e-8,
    'right arc-to-straight tangent continuity');
  vectorNear(leftAt.tangent, new THREE.Vector2(0, 1), 1e-15,
    'left belt direction');
  vectorNear(rightAt.tangent, new THREE.Vector2(0, -1), 1e-15,
    'right belt direction');
  assert.equal(leftBefore.pathStage, 'left-straight-rising');
  assert.equal(leftAfter.pathStage, 'upper-semicircular-pulley-wrap');
  assert.equal(rightBefore.pathStage, 'upper-semicircular-pulley-wrap');
  assert.equal(rightAfter.pathStage, 'right-straight-falling');

  for (let sample = 0; sample <= 4096; sample += 1) {
    const state = stateAtTime(
      timeline.demonstrationPeriod * sample / 4096,
    );
    near(state.beltToPulleyNoSlipError.length(), 0, 3e-16,
      'belt/pulley tread no slip');
    for (const marker of state.beltMarkers) {
      if (!marker.visible) continue;
      near(marker.velocity.length(), Math.abs(transmission.beltLinearSpeed),
        6e-16, 'constant marker material speed');
      near(marker.tangent.length(), 1, 2e-15,
        'unit marker tangent');
    }
  }

  const source = stateAtTime(0);
  const onePulleyTurn = stateAtTime(timeline.demonstrationPeriod);
  for (let index = 0; index < geometry.beltMarkerCount; index += 1) {
    const sourceMarker = source.beltMarkers[index];
    const closureMarker = onePulleyTurn.beltMarkers[index];
    near(closureMarker.routeDistance, sourceMarker.routeDistance,
      3e-15, `belt marker ${index} one-turn phase closure`);
    vectorNear(closureMarker.position, sourceMarker.position, 5e-14,
      `belt marker ${index} one-turn position closure`);
    assert.equal(closureMarker.visible, sourceMarker.visible);
  }
  disposeModel(model.root);
});

test('movement 270 renderer exposes every moving rate and keeps the journal fixed', () => {
  const model = createMovementModel(catalog.movements[269]);
  const {
    blocks,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const innerRacePosition = blocks.innerRace.position.clone();
  const supportPostPosition = blocks.supportPost.position.clone();
  const sampleTimes = [0, 0.73, 2.21, 5.44];

  for (const time of sampleTimes) {
    const state = stateAtTime(time);
    model.update(time, 0.016);
    model.root.updateMatrixWorld(true);
    near(blocks.pulleyRotor.rotation.z, state.outerRaceAngleUnwrapped,
      2e-15, 'rendered outer-race angle');
    near(blocks.rollerCarrier.rotation.z, state.cageAngleUnwrapped,
      2e-15, 'rendered cage angle');
    vectorNear(blocks.innerRace.position, innerRacePosition, 0,
      'stationary inner race');
    vectorNear(blocks.supportPost.position, supportPostPosition, 0,
      'stationary bearing post');
    for (const [index, assembly] of blocks.rollerAssemblies.entries()) {
      near(
        assembly.rotor.rotation.z,
        assembly.initialAngle + state.rollerSpinAngleUnwrapped
          - state.cageAngleUnwrapped,
        3e-15,
        `roller ${index} local rendered spin`,
      );
      const centerWorld = assembly.positionGroup.getWorldPosition(
        new THREE.Vector3(),
      );
      const centerInRoot = model.root.worldToLocal(centerWorld.clone());
      vectorNear(
        new THREE.Vector2(centerInRoot.x, centerInRoot.y),
        state.rollers[index].center,
        3e-15,
        `roller ${index} rendered orbit center`,
      );
    }
    const innerContactInRoot = model.root.worldToLocal(
      blocks.innerContactMarker.getWorldPosition(new THREE.Vector3()),
    );
    const outerContactInRoot = model.root.worldToLocal(
      blocks.outerContactMarker.getWorldPosition(new THREE.Vector3()),
    );
    vectorNear(
      new THREE.Vector2(innerContactInRoot.x, innerContactInRoot.y),
      state.rollers[0].innerContactPoint,
      3e-15,
      'reference inner contact marker',
    );
    vectorNear(
      new THREE.Vector2(outerContactInRoot.x, outerContactInRoot.y),
      state.rollers[0].outerContactPoint,
      3e-15,
      'reference outer contact marker',
    );
    const { contacts } = model.root.userData;
    assert.equal(contacts.innerRaceToRollers.length, 6);
    assert.equal(contacts.outerRaceToRollers.length, 6);
    near(contacts.beltOnPulleyTread.noSlipVelocityError.length(), 0,
      3e-16, 'rendered belt contact');
    for (const contact of contacts.innerRaceToRollers) {
      near(contact.gap, 0, 2e-15, 'rendered inner race gap');
      near(contact.noSlipVelocityError.length(), 0, 5e-16,
        'rendered inner race no slip');
    }
    for (const contact of contacts.outerRaceToRollers) {
      near(contact.gap, 0, 2e-15, 'rendered outer race gap');
      near(contact.noSlipVelocityError.length(), 0, 5e-16,
        'rendered outer race no slip');
    }
  }

  assert.equal(blocks.belt.userData.innerWorkingRadius,
    geometry.pulleyOuterRadius);
  assert.equal(blocks.beltMarkers.length, geometry.beltMarkerCount);
  assert.equal(blocks.rollerBodies.length, geometry.rollerCount);
  assert.equal(blocks.rollerIndices.length, geometry.rollerCount);
  disposeModel(model.root);
});

test('movement 270 closes all marked members and leaves movement 507 authored', () => {
  const movement = catalog.movements[269];
  const model = createMovementModel(movement);
  const {
    animationTiming,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const source = stateAtTime(0);
  const closure = stateAtTime(timeline.fullMarkedAssemblyClosure);

  near(closure.outerRaceAngle, 0, 2e-14,
    'full-closure outer-race mark');
  near(closure.cageAngle, 0, 2e-14,
    'full-closure cage mark');
  near(closure.rollerSpinAngle, 0, 4e-14,
    'full-closure roller spin mark');
  for (let index = 0; index < geometry.rollerCount; index += 1) {
    vectorNear(closure.rollers[index].center, source.rollers[index].center,
      1e-12, `roller ${index} full-closure center`);
    near(
      Math.abs(Math.atan2(
        Math.sin(
          closure.rollers[index].rollerMaterialAngleUnwrapped
            - source.rollers[index].rollerMaterialAngleUnwrapped
        ),
        Math.cos(
          closure.rollers[index].rollerMaterialAngleUnwrapped
            - source.rollers[index].rollerMaterialAngleUnwrapped
        ),
      )),
      0,
      7e-14,
      `roller ${index} full-closure material mark`,
    );
  }
  for (let index = 0; index < geometry.beltMarkerCount; index += 1) {
    const loop = geometry.beltMarkerLoopLength;
    const drift = closure.beltMarkers[index].routeDistance
      - source.beltMarkers[index].routeDistance;
    near(drift - loop * Math.round(drift / loop), 0,
      4.5e-13, `belt marker ${index} full closure`);
  }
  assert.equal(timeline.fullMarkedAssemblyClosure, 1026);
  assert.equal(animationTiming.authoredCyclePeriod, 6);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);

  model.update(0, 0.016);
  const sourcePulleyAngle = model.root.userData.blocks.pulleyRotor.rotation.z;
  model.update(timeline.fullMarkedAssemblyClosure, 0.016);
  near(
    Math.abs(Math.atan2(
      Math.sin(
        model.root.userData.blocks.pulleyRotor.rotation.z
          - sourcePulleyAngle
      ),
      Math.cos(
        model.root.userData.blocks.pulleyRotor.rotation.z
          - sourcePulleyAngle
      ),
    )),
    0,
    6e-14,
    'rendered pulley full closure',
  );

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});

test('movement 270 closes the bearing behind the rollers and shows both engraved views as one model', () => {
  const model = createMovementModel(catalog.movements[269]);
  const { blocks, geometry } = model.root.userData;
  const plateBox = new THREE.Box3().setFromObject(blocks.cagePlate);
  const webBox = new THREE.Box3().setFromObject(blocks.pulleyWeb);
  // The rear retaining plate lies behind the web and spans past the bore.
  assert.ok(plateBox.max.z < webBox.min.z, 'the retaining plate stays behind the turning web');
  model.root.updateMatrixWorld(true);
  assert.ok(plateBox.max.x > (geometry.outerRaceInnerRadius + 0.05) * model.root.scale.x, 'the plate covers the pulley bore');
  const roles = [];
  let pulleyRims = 0;
  model.root.traverse((object) => {
    roles.push(object.userData.role ?? '');
    let lower = false;
    for (let p = object; p; p = p.parent) if (p === blocks.lowerReturnAssembly) lower = true;
    if (!lower && object.isMesh && object.userData.role === 'wide-belt-pulley-rim-and-working-tread') pulleyRims += 1;
  });
  // Paired views of one mechanism share one model: one pulley (plus the
  // rope's lower return sheave below the crop), one rope.
  assert.equal(pulleyRims, 1);
  assert.equal(roles.filter((role) => /assembled-left-view|assembled-view-pulley-rotor/.test(role)).length, 0);
  assert.equal(roles.filter((role) => /^single-laid-three-strand-rope/.test(role)).length, 1);
  // The assembled view's cover rides with the retainer, see-through over the rollers.
  const { assembledCover: cover, assembledFace: face } = blocks;
  assert.equal(cover.parent, blocks.rollerCarrier);
  assert.equal(face.parent, blocks.pulleyRotor);
  assert.equal(cover.userData.seeThrough, true);
  assert.equal(face.userData.seeThrough, true);
  const coverBox = new THREE.Box3().setFromObject(cover);
  for (const assembly of blocks.rollerAssemblies) {
    const hubBox = new THREE.Box3().setFromObject(assembly.hub);
    const bodyBox = new THREE.Box3().setFromObject(assembly.body);
    assert.ok(coverBox.min.z > hubBox.max.z + 0.005, 'the cover clears the roller hubs');
    assert.ok(coverBox.min.z > bodyBox.max.z + 0.005, 'the cover clears the rollers');
  }
  for (const pin of blocks.cagePins) {
    const pinBox = new THREE.Box3().setFromObject(pin);
    assert.ok(pinBox.max.z > coverBox.min.z && pinBox.max.z < coverBox.max.z - 0.005,
      'each retainer pin ends recessed inside its cover hole');
  }
  assert.equal(roles.filter((role) => role === 'assembled-view-fluted-journal-end').length, 1);
  disposeModel(model.root);
});
