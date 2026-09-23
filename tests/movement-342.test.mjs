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

function vector2Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function vector3Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function worldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
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

test('movement 342 is the atmospheric single-acting chain beam engine', () => {
  const movement = catalog.movements[341];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    contacts,
    degreesOfFreedom,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 342);
  assert.equal(movement.number, '342');
  assert.equal(movement.title,
    'Old-fashioned single-acting beam pumping engine on the atmospheric…');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'atmospheric-single-acting-rocking-beam-chain-pumping-engine');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /open-top-cylinder-piston/);
  assert.match(mechanism, /constant-length-chain/);
  assert.match(mechanism, /opposite-weighted-pump-rod/);
  assert.match(transmission.exactConstraint, /y=-6-12\*theta/);
  assert.match(transmission.input, /condensation creates a vacuum/);
  assert.match(transmission.input, /pump-rod weight/);
  assert.equal(degreesOfFreedom.mechanism, 1);

  assert.ok(blocks.fixedFrame.parent === model.root, 'fixed frame on root');
  assert.ok(blocks.beam.parent === model.root, 'beam on root');
  assert.ok(blocks.piston.parent === model.root, 'piston on root');
  assert.ok(blocks.chainTerminalConnector.parent === model.root,
    'terminal connector on root');
  assert.ok(blocks.chainShoe.parent === blocks.beam, 'segment head on beam');
  assert.ok(blocks.kingPost.parent === blocks.beam, 'king post on beam');
  assert.ok(blocks.stays.every(({ stay }) => stay.parent === blocks.beam),
    'three stays ride on the beam');
  assert.equal(blocks.stays.length, 3);
  assert.ok(blocks.chainAttachmentAnchor.parent === blocks.beam,
    'chain anchor on beam');
  assert.ok(blocks.pistonTopAnchor.parent === blocks.piston,
    'piston anchor on piston');
  assert.equal(blocks.chainLinks.length, 10);
  assert.ok(blocks.chainLinks.every(({ link }) => link.parent === model.root),
    'chain links on root');
  assert.ok(contacts.beamPivot.fixedMember === blocks.fixedFrame, 'pivot fixed member');
  assert.ok(contacts.beamPivot.movingMember === blocks.beam, 'pivot moving member');
  assert.ok(contacts.chainAtPiston.members[0] === blocks.piston, 'chain at piston');
  assert.ok(contacts.chainAtBeam.members[0] === blocks.beam, 'chain at beam');
  assert.equal(contacts.pumpRodAtBeam, undefined);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'one-piece-rocking-atmospheric-beam-with-twelve-unit-chain-segment')
    .length, 1);
  assert.equal(roles.filter((role) => role ===
    'vertical-piston-and-rod-in-open-top-atmospheric-cylinder').length, 1);
  assert.equal(roles.filter((role) =>
    /pump-rod|pump-weight|pressure|steam|support-column|foundation|piston-rod-guide/
      .test(role)).length, 0, 'plate-undrawn engine parts are absent');
  assert.equal(roles.filter((role) => role ===
    'articulated-atmospheric-engine-chain-link').length, 10);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 342 preserves the official source transforms, timing, and view', () => {
  const movement = catalog.movements[341];
  const model = createMovementModel(movement);
  const {
    geometry,
    modelPointToOfficialAnimationRaster,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const official = sourceAnimation.officialGeometry;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.durationSeconds, 4);
  assert.deepEqual(sourceAnimation.officialFunctionChain, [
    'add_stat',
    'add_pos_interp',
    'add_pos_interp',
    'add_belt',
    'add_text',
  ]);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_342.html');
  assert.match(sourceAnimation.referenceScope, /trussed rocking beam/);
  assert.match(sourceAnimation.referenceScope, /open cylinder/);

  assert.deepEqual(official.beamPivot, new THREE.Vector2(0, 0));
  assert.deepEqual(official.beamStartRay,
    new THREE.Vector2(1.879385, -0.68404));
  assert.deepEqual(official.beamEndRay,
    new THREE.Vector2(1.879385, 0.68404));
  near(official.beamHalfSwing, 0.34906575702799114, 0,
    'official beam half swing');
  assert.deepEqual(official.canvasPistonStartLine, [
    new THREE.Vector2(-12, -1.811),
    new THREE.Vector2(-11, -1.811),
  ]);
  assert.deepEqual(official.canvasPistonEndLine, [
    new THREE.Vector2(-12, -10.189),
    new THREE.Vector2(-11, -10.189),
  ]);
  assert.deepEqual(official.chainAttachment,
    new THREE.Vector2(-10.879452, 5.073172));
  assert.equal(official.pitchRadius, 12);
  assert.equal(official.chainLinkPitch, 1);
  assert.equal(official.pistonRodLength, 11.181114);
  assert.equal(official.pistonHeadCenterOffset, -11.681114);
  assert.equal(official.shoeInnerRadius, 10.2);
  assert.equal(official.shoeOuterRadius, 11.7);
  assert.equal(official.shoeStartAngle, 2.70526);
  assert.equal(official.shoeEndAngle, 3.577925);

  near(geometry.pitchRadius, 12 * geometry.sourceScale, 0,
    'scaled circular segment pitch radius');
  vector2Near(geometry.rawChainAttachment,
    official.chainAttachment.clone().multiplyScalar(geometry.sourceScale),
    0, 'scaled chain attachment');
  near(geometry.canvasPistonStartY,
    -1.811 * geometry.sourceScale, 0, 'scaled canvas upper position');
  near(geometry.canvasPistonEndY,
    -10.189 * geometry.sourceScale, 0, 'scaled canvas lower position');
  near(geometry.pistonRodLength,
    official.pistonRodLength * geometry.sourceScale, 0,
  'scaled piston rod');

  assert.equal(sourceReference.brownPlate342.imageWidth, 525);
  assert.equal(sourceReference.brownPlate342.imageHeight, 525);
  assert.match(sourceReference.brownPlate342.inferredTopology,
    /chain suspends the piston rod/);
  assert.deepEqual(sourceReference.officialAnimationView, {
    canvasHeight: 525,
    canvasWidth: 525,
    minimum: new THREE.Vector2(-17.402965, -14.011987),
    viewHeight: 22,
    viewWidth: 22,
  });
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    edition: 21,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.officialDescription, movement.description);
  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(-17.402965, -14.011987)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(0, 525), 0, 'official lower-left view corner');
  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(4.597035, 7.988013)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(525, 0), 1.2e-13,
  'official upper-right view corner');
  disposeModel(model.root);
});

test('movement 342 reconstructs the official rocking-beam and rounded piston law', () => {
  const model = createMovementModel(catalog.movements[341]);
  const {
    geometry,
    sourceStateAtTime,
  } = model.root.userData;
  let maximumSourceChainLength = -Infinity;
  let minimumSourceChainLength = Infinity;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const time = geometry.cyclePeriod * sample / 8192;
    const inputAngle = geometry.inputAngularSpeed * time;
    const source = sourceStateAtTime(time);
    const progress = 0.5 * (1 - Math.cos(inputAngle));
    const expectedBeamAngle = geometry.beamStartAngle + (
      geometry.beamEndAngle - geometry.beamStartAngle
    ) * progress;
    const expectedPistonY = geometry.canvasPistonStartY + (
      geometry.canvasPistonEndY - geometry.canvasPistonStartY
    ) * progress;
    near(source.beamAngle, expectedBeamAngle, 2e-16,
      `source beam interpolation at ${sample}`);
    near(source.pistonTop.x, geometry.pistonLineX, 0,
      `source piston line at ${sample}`);
    near(source.pistonTop.y, expectedPistonY, 5e-16,
      `source piston interpolation at ${sample}`);
    near(source.chain.attachmentPoint.length(),
      geometry.chainAttachmentRadius, 9e-16,
    `source rotating chain attachment at ${sample}`);
    near(source.chain.terminalTangentPoint.length(),
      geometry.pitchRadius, 9e-16,
    `source chain pitch tangent at ${sample}`);
    near(source.chain.attachmentPoint.clone()
      .sub(source.chain.terminalTangentPoint)
      .dot(source.chain.terminalTangentPoint), 0, 8e-15,
    `source terminal tangency at ${sample}`);
    near(source.chain.pathLength,
      source.chain.straightLength + source.chain.arcLength
        + source.chain.terminalLength,
    0, `source chain segment sum at ${sample}`);
    maximumSourceChainLength = Math.max(maximumSourceChainLength,
      source.chain.pathLength);
    minimumSourceChainLength = Math.min(minimumSourceChainLength,
      source.chain.pathLength);
  }

  near(minimumSourceChainLength, geometry.minimumCanvasChainLength, 0,
    'stored minimum source chain length');
  near(maximumSourceChainLength, geometry.maximumCanvasChainLength, 0,
    'stored maximum source chain length');
  near(maximumSourceChainLength - minimumSourceChainLength,
    geometry.maximumCanvasChainLengthDrift, 0,
  'stored source chain drift');
  const start = sourceStateAtTime(0);
  const quarter = sourceStateAtTime(1);
  const half = sourceStateAtTime(2);
  const threeQuarter = sourceStateAtTime(3);
  near(start.beamAngle, geometry.beamStartAngle, 0,
    'source start beam angle');
  near(half.beamAngle, geometry.beamEndAngle, 0,
    'source half-cycle beam angle');
  near(start.pistonTop.y, geometry.canvasPistonStartY, 0,
    'source upper piston position');
  near(half.pistonTop.y, geometry.canvasPistonEndY, 0,
    'source lower piston position');
  vector2Near(quarter.pistonTop, threeQuarter.pistonTop, 6e-16,
    'source reciprocal mid-strokes');
  near(angleDifference(quarter.beamAngle, threeQuarter.beamAngle),
    0, 1.2e-16, 'source reciprocal beam mid-strokes');
  disposeModel(model.root);
});

test('movement 342 closes one exactly constant chain around the beam segment', () => {
  const model = createMovementModel(catalog.movements[341]);
  const { geometry, stateAtTime } = model.root.userData;
  const terminalStart = stateAtTime(0).chain.terminalStartDistance;

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 16384);
    near(state.pistonTop.x, geometry.pistonLineX, 0,
      `vertical piston line at ${sample}`);
    near(state.pistonTop.y,
      geometry.pistonMidY - geometry.pitchRadius * state.beam.angle,
    5e-16, `exact piston/beam payout law at ${sample}`);
    near(state.chain.pathLength, geometry.constantChainPathLength,
      1.4e-15, `constant chain path at ${sample}`);
    near(state.chain.lengthResidual, 0, 1.4e-15,
      `chain length residual at ${sample}`);
    near(state.chain.pathLength,
      state.chain.straightLength + state.chain.arcLength
        + state.chain.terminalLength,
    0, `chain segment sum at ${sample}`);
    near(state.chain.terminalStartDistance, terminalStart, 1.8e-15,
      `fixed material coordinate at terminal tangent ${sample}`);
    near(state.chain.straightTangentPoint.x, -geometry.pitchRadius, 0,
      `fixed vertical tangent x at ${sample}`);
    near(state.chain.straightTangentPoint.y, 0, 0,
      `fixed vertical tangent y at ${sample}`);
    near(state.chain.terminalTangentPoint.length(), geometry.pitchRadius,
      9e-16, `beam-segment pitch radius at ${sample}`);
    near(state.chain.terminalLength, geometry.terminalTangentLength,
      1.2e-14, `terminal tangent length at ${sample}`);
    near(state.chain.attachmentPoint.length(),
      geometry.chainAttachmentRadius, 9e-16,
    `beam attachment radius at ${sample}`);
    near(state.pistonVelocityY,
      -geometry.pitchRadius * state.beam.angularVelocity, 0,
    `no-slip chain velocity at ${sample}`);
    near(state.pistonAccelerationY,
      -geometry.pitchRadius * state.beam.angularAcceleration, 0,
    `no-slip chain acceleration at ${sample}`);
    near(state.pumpRodTop.length(), geometry.pumpRodJoint.length(),
      5e-16, `opposite beam-end radius at ${sample}`);
  }
  assert.ok(geometry.maximumChainLengthResidual < 1.4e-15);
  disposeModel(model.root);
});

test('movement 342 repairs source rounding and moves every chain node smoothly through tangency', () => {
  const model = createMovementModel(catalog.movements[341]);
  const {
    chainPointAtDistance,
    geometry,
    sourceAnimation,
    stateAtTime,
  } = model.root.userData;
  const correction = sourceAnimation.physicalCorrection;

  assert.match(correction.reason, /endpoints are rounded to three decimals/);
  assert.equal(correction.correctedPistonLaw,
    'y=-6-12*beamAngle in source units');
  assert.ok(correction.canvasChainLengthDriftSource > 0.0004217);
  assert.ok(correction.canvasChainLengthDriftSource < 0.0004220);
  assert.ok(correction.maximumPistonEndpointCorrectionSource > 0.0002108);
  assert.ok(correction.maximumPistonEndpointCorrectionSource < 0.0002111);
  near(correction.canvasChainLengthDriftModel,
    geometry.maximumCanvasChainLengthDrift, 0,
  'stored model-unit canvas drift');
  near(correction.maximumPistonEndpointCorrectionModel,
    geometry.maximumPistonCorrectionFromCanvas, 0,
  'stored model-unit piston correction');
  assert.ok(geometry.outputStroke / geometry.sourceScale > 8.37757);
  assert.ok(geometry.outputStroke / geometry.sourceScale < 8.37759);
  assert.ok(8.378 - geometry.outputStroke / geometry.sourceScale > 0.00041);

  for (const time of [0, 1, 2, 3, 4]) {
    const state = stateAtTime(time);
    const beginning = chainPointAtDistance(state, 0);
    const straightTangent = chainPointAtDistance(
      state,
      state.chain.straightLength,
    );
    const terminalTangent = chainPointAtDistance(
      state,
      state.chain.terminalStartDistance,
    );
    const ending = chainPointAtDistance(state, state.chain.pathLength);
    vector2Near(beginning.point, state.pistonTop, 0,
      `material chain start at ${time}`);
    vector2Near(ending.point, state.chain.attachmentPoint, 2e-15,
      `material chain end at ${time}`);
    vector2Near(straightTangent.point,
      new THREE.Vector2(-geometry.pitchRadius, 0), 8e-16,
    `straight/arc position continuity at ${time}`);
    vector2Near(straightTangent.velocity,
      new THREE.Vector2(0, state.pistonVelocityY), 8e-16,
    `straight/arc velocity continuity at ${time}`);
    near(angleDifference(straightTangent.pathAngle, Math.PI / 2),
      0, 2e-16, `straight/arc tangent continuity at ${time}`);
    vector2Near(terminalTangent.point,
      state.chain.terminalTangentPoint, 9e-16,
    `arc/terminal position continuity at ${time}`);
    vector2Near(terminalTangent.velocity,
      state.chain.terminalTangentVelocity, 9e-16,
    `arc/terminal velocity continuity at ${time}`);
    near(angleDifference(terminalTangent.pathAngle,
      Math.atan2(state.chain.terminalDirection.y,
        state.chain.terminalDirection.x)),
    0, 8e-15, `arc/terminal tangent continuity at ${time}`);

    let previous = beginning;
    for (let index = 1; index <= geometry.chainLinkCount; index += 1) {
      const point = chainPointAtDistance(
        state,
        index * geometry.chainLinkPitch,
      );
      assert.ok(point.point.distanceTo(previous.point)
        <= geometry.chainLinkPitch + 2e-15,
      `chain node ${index} has no positional jump at ${time}`);
      previous = point;
    }
  }

  const halfStroke = geometry.pitchRadius * geometry.beamHalfSwing;
  const transitionStep = 1e-6;
  for (let index = 2; index <= 10; index += 1) {
    const distance = index * geometry.chainLinkPitch;
    const cosine = (-geometry.pistonMidY - distance) / halfStroke;
    const crossingTime = Math.acos(cosine) / geometry.inputAngularSpeed;
    const previous = chainPointAtDistance(
      stateAtTime(crossingTime - transitionStep),
      distance,
    );
    const state = stateAtTime(crossingTime);
    const crossing = chainPointAtDistance(state, distance);
    const next = chainPointAtDistance(
      stateAtTime(crossingTime + transitionStep),
      distance,
    );
    const finiteVelocity = next.point.clone().sub(previous.point)
      .multiplyScalar(1 / (2 * transitionStep));
    vector2Near(crossing.velocity, finiteVelocity, 3e-7,
      `chain material node ${index} crosses tangency without jerk`);
  }
  disposeModel(model.root);
});

test('movement 342 analytic beam, piston, pump-rod, and chain rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[341]);
  const { stateAtTime } = model.root.userData;
  const h = 2e-4;

  for (const time of [0.13, 0.61, 1.0, 1.53, 2.18, 2.70, 3.53]) {
    const previous = stateAtTime(time - h);
    const state = stateAtTime(time);
    const next = stateAtTime(time + h);
    for (const [pointName, velocityName, accelerationName] of [
      ['pistonTop', 'pistonTopVelocity', 'pistonTopAcceleration'],
      ['pistonHead', 'pistonTopVelocity', 'pistonTopAcceleration'],
      ['pumpRodTop', 'pumpRodVelocity', 'pumpRodAcceleration'],
      ['pumpRodBottom', 'pumpRodVelocity', 'pumpRodAcceleration'],
    ]) {
      const finiteVelocity = next[pointName].clone()
        .sub(previous[pointName]).multiplyScalar(1 / (2 * h));
      const finiteAcceleration = next[pointName].clone()
        .add(previous[pointName])
        .addScaledVector(state[pointName], -2)
        .multiplyScalar(1 / h ** 2);
      vector2Near(state[velocityName], finiteVelocity, 5e-8,
        `${pointName} velocity at ${time}`);
      vector2Near(state[accelerationName], finiteAcceleration, 8e-8,
        `${pointName} acceleration at ${time}`);
    }
    const finiteBeamVelocity = angleDifference(
      next.beam.angle,
      previous.beam.angle,
    ) / (2 * h);
    const finiteBeamAcceleration = (
      next.beam.angularVelocity - previous.beam.angularVelocity
    ) / (2 * h);
    near(state.beam.angularVelocity, finiteBeamVelocity, 1e-8,
      `beam angular velocity at ${time}`);
    near(state.beam.angularAcceleration, finiteBeamAcceleration, 2e-8,
      `beam angular acceleration at ${time}`);
  }

  assert.equal(stateAtTime(0).cycleStage,
    'upper-reversal-condensation-begins');
  assert.equal(stateAtTime(0.5).cycleStage,
    'atmospheric-power-stroke-drawing-pump-rod-up');
  assert.equal(stateAtTime(2).cycleStage,
    'lower-reversal-low-pressure-steam-admission-begins');
  assert.equal(stateAtTime(2.5).cycleStage,
    'weighted-pump-rod-return-lifting-piston');
  assert.ok(stateAtTime(2).pumpRodTop.y > stateAtTime(0).pumpRodTop.y);
  assert.ok(stateAtTime(2).pistonTop.y < stateAtTime(0).pistonTop.y);
  disposeModel(model.root);
});

test('movement 342 renderer binds the beam, chain, and piston in the plate crop', () => {
  const model = createMovementModel(catalog.movements[341]);
  const {
    blocks,
    canonicalTimes,
    chainPointAtDistance,
    contacts,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const terminalNominalLength =
    blocks.chainTerminalConnector.userData.nominalLength;

  for (const time of Object.values(canonicalTimes)) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    vector3Near(worldPosition(blocks.chainAttachmentAnchor),
      new THREE.Vector3(state.chain.attachmentPoint.x,
        state.chain.attachmentPoint.y, 0.76), 3e-15,
    `rendered chain attachment at ${time}`);
    vector3Near(worldPosition(blocks.pistonTopAnchor),
      new THREE.Vector3(state.pistonTop.x, state.pistonTop.y, 0.42),
      1e-15, `rendered piston-chain pin at ${time}`);
    vector3Near(worldPosition(blocks.pistonHeadAnchor),
      new THREE.Vector3(state.pistonHead.x, state.pistonHead.y, .42),
      1e-15, `rendered piston head at ${time}`);

    blocks.chainLinks.forEach((parts, index) => {
      const expectedStart = chainPointAtDistance(
        state,
        index * geometry.chainLinkPitch,
      ).point;
      const expectedEnd = chainPointAtDistance(
        state,
        (index + 1) * geometry.chainLinkPitch,
      ).point;
      vector3Near(worldPosition(parts.startAnchor),
        new THREE.Vector3(expectedStart.x, expectedStart.y, 0.76), 2e-15,
      `rendered chain link ${index} start at ${time}`);
      vector3Near(worldPosition(parts.endAnchor),
        new THREE.Vector3(expectedEnd.x, expectedEnd.y, 0.76), 3e-15,
      `rendered chain link ${index} end at ${time}`);
    });
    const lastPoint = chainPointAtDistance(
      state,
      geometry.chainLinkCount * geometry.chainLinkPitch,
    ).point;
    const renderedTerminalStart = blocks.chainTerminalConnector.localToWorld(
      new THREE.Vector3(-terminalNominalLength / 2, 0, 0),
    );
    const renderedTerminalEnd = blocks.chainTerminalConnector.localToWorld(
      new THREE.Vector3(terminalNominalLength / 2, 0, 0),
    );
    vector3Near(renderedTerminalStart,
      new THREE.Vector3(lastPoint.x, lastPoint.y, 0.76), 3e-15,
    `rendered terminal connector start at ${time}`);
    vector3Near(renderedTerminalEnd,
      new THREE.Vector3(state.chain.attachmentPoint.x,
        state.chain.attachmentPoint.y, 0.76), 3e-15,
    `rendered terminal connector end at ${time}`);
    vector3Near(contacts.chainAtPiston.point,
      new THREE.Vector3(state.pistonTop.x, state.pistonTop.y, 0.76), 0,
    `piston-chain contact at ${time}`);
    vector3Near(contacts.chainAtBeam.point,
      new THREE.Vector3(state.chain.attachmentPoint.x,
        state.chain.attachmentPoint.y, 0.76), 0,
    `beam-chain contact at ${time}`);
    vector3Near(contacts.chainAtShoeTangent.surfaceVelocityError,
      new THREE.Vector3(), 0, `rendered no-slip tangent at ${time}`);
    near(contacts.chainAtShoeTangent.pathLength,
      geometry.constantChainPathLength, 1.4e-15,
    `rendered constant chain at ${time}`);
  }

  assert.equal(blocks.shoeIndexBosses.length, 4);
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 6.4);
  assert.ok(size.y > 8.6);
  assert.ok(size.z > 2.0,
    'pier, floor beam, beam, chain and open cylinder have depth');
  const crop = model.root.userData.cameraFitBounds;
  assert.ok(crop.containsPoint(new THREE.Vector3(geometry.pistonLineX, -2, 0.4)),
    'plate crop contains the chain line');
  assert.ok(crop.max.x < 0.3 * geometry.pitchRadius,
    'plate crop stops just past the king post');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);
  disposeModel(model.root);
});

test('movement 342 closes exactly and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[341]);
  const {
    blocks,
    canonicalTimes,
    sourceStateAtTime,
    stateAtTime,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);
  const sourceStart = sourceStateAtTime(0);
  const sourceClosure = sourceStateAtTime(canonicalTimes.cycleClosure);

  near(closure.phase, start.phase, 0, 'source phase closure');
  near(closure.unwrappedInputAngle - start.unwrappedInputAngle,
    Math.PI * 2, 0, 'one unwrapped source cycle');
  near(angleDifference(closure.beam.angle, start.beam.angle), 0, 0,
    'beam closure');
  vector2Near(closure.pistonTop, start.pistonTop, 0, 'piston closure');
  vector2Near(closure.pistonHead, start.pistonHead, 0,
    'piston-head closure');
  vector2Near(closure.chain.attachmentPoint,
    start.chain.attachmentPoint, 0, 'chain attachment closure');
  vector2Near(closure.chain.terminalTangentPoint,
    start.chain.terminalTangentPoint, 0, 'chain tangent closure');
  vector2Near(closure.pumpRodTop, start.pumpRodTop, 0,
    'weighted pump-rod closure');
  vector2Near(sourceClosure.pistonTop, sourceStart.pistonTop, 0,
    'official canvas piston closure');
  near(angleDifference(sourceClosure.beamAngle, sourceStart.beamAngle),
    0, 0, 'official canvas beam closure');
  model.update(canonicalTimes.cycleClosure);
  model.root.updateMatrixWorld(true);
  vector3Near(worldPosition(blocks.pistonTopAnchor),
    new THREE.Vector3(start.pistonTop.x, start.pistonTop.y, 0.42), 0,
  'rendered piston closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
