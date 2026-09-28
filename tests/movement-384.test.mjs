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

function angleNear(actual, expected, tolerance, message) {
  const error = THREE.MathUtils.euclideanModulo(
    actual - expected + Math.PI,
    FULL_TURN,
  ) - Math.PI;
  near(error, 0, tolerance, message);
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

test('movement 384 is one fixed-centre screw helicograph with one threaded rolling wheel and transfer paper', () => {
  const movement = catalog.movements[383];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 384);
  assert.equal(movement.number, '384');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(
    movement.archetype,
    'fixed-center-threaded-rolling-wheel-logarithmic-helicograph',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-fixed-centre/);
  assert.match(data.mechanism, /one-radial-right-hand-screw/);
  assert.match(data.mechanism, /one-internally-threaded-paper-contact-wheel/);
  assert.match(data.mechanism, /one-transfer-paper-logarithmic-spiral/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(degreesOfFreedom.inputs.length, 1);
  assert.match(degreesOfFreedom.note, /rolling/);
  assert.match(degreesOfFreedom.note, /single-start screw lead/);

  for (const component of [
    blocks.fixedPivot,
    blocks.orbitingArm,
  ]) assert.ok(component.parent === model.root, `${component.userData.role} parent`);
  assert.ok(blocks.paperAssembly.parent === null, 'source presentation removes paperAssembly');
  for (const component of [
    blocks.centerMark,
    blocks.drawingPaper,
    blocks.liveContact,
    blocks.transferredTrace,
    blocks.transferPaper,
  ]) assert.ok(component.parent === blocks.paperAssembly, `${component.userData.role} parent`);
  for (const component of [
    blocks.needle,
    blocks.pivotKnob,
    blocks.pivotSleeve,
  ]) assert.ok(component.parent === blocks.fixedPivot, `${component.userData.role} parent`);
  for (const component of [
    blocks.bridge,
    blocks.screwCore,
    blocks.screwThread,
    blocks.shaftEnd,
    blocks.threadedWheel,
  ]) assert.ok(component.parent === blocks.orbitingArm, `${component.userData.role} parent`);
  assert.ok(blocks.wheelRotor.parent === blocks.threadedWheel, 'blocks.wheelRotor parent');
  assert.equal(blocks.wheelSpokes.length, 16); // pass 90: sixteen face ribs
  assert.equal(blocks.fixedPivot.userData.fixed, true);
  assert.equal(blocks.paperAssembly.userData.fixed, true);
  assert.equal(blocks.transferredTrace.userData.isOutcomeTrace, true);

  const roles = [];
  const belts = [];
  const gears = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.isGear) gears.push(object);
  });
  assert.deepEqual(belts, []);
  assert.deepEqual(gears, []);
  for (const role of [
    'needle-point-fixed-in-paper-centre',
    'fixed-radial-screw-core',
    'single-start-right-hand-external-thread',
    'female-threaded-wheel-hub',
    'visible-edge-of-single-start-female-hub-thread',
    'paper-contacting-milled-wheel-rim',
  ]) assert.ok(roles.includes(role), role);
  for (const role of [
    'white-wheel-spin-index-on-near-face',
    'white-wheel-spin-index-on-tread',
    'stationary-reference-index',
    'transfer-paper-colored-side-downward',
    'drawing-paper-receiving-transferred-line',
    'completed-logarithmic-spiral-transferred-to-drawing-paper',
  ]) assert.ok(!roles.includes(role), `source presentation removes ${role}`);
  disposeModel(model.root);
});

test('movement 384 preserves Brown\'s topology, transfer process, measured plate, and absence of an official animation', () => {
  const movement = catalog.movements[383];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate384;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_384.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Helicograph/);
  assert.match(movement.description, /fixed central point/);
  assert.match(movement.description, /screw-threaded axle either way/);
  assert.match(movement.description, /transfer-paper/);
  assert.match(movement.description, /colored side downward/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(
    dynamics.sourceSpecifiesDimensionsTimingLeadWheelRadiusOrSweep,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);
  assert.match(dynamics.treatment, /right-hand constant-lead screw/);
  assert.match(dynamics.treatment, /logarithmic-spiral/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 9);
  assert.deepEqual(plate.fixedCentrePixels.toArray(), [66, 373]);
  assert.deepEqual(plate.radialScrewAxisPixels.start.toArray(), [92, 273]);
  assert.deepEqual(plate.radialScrewAxisPixels.end.toArray(), [501, 273]);
  assert.deepEqual(
    plate.rollingWheelPixels.apparentCenter.toArray(),
    [390, 274],
  );
  assert.equal(plate.rollingWheelPixels.apparentRadius, 80);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.historicalCorroboration, /Stanley/);
  assert.match(evidence.historicalCorroboration, /geometrical proportion/);
  assert.match(evidence.kinematicInference, /dr\/dtheta/);
  assert.match(evidence.kinematicInference, /logarithmic spiral/);
  assert.match(evidence.reconstructionDisclosure, /independently engineered/);
  disposeModel(model.root);
});

test('movement 384 external and female thread reference helices have one lead and remain half-pitch interleaved through travel', () => {
  const model = createMovementModel(catalog.movements[383]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const external = blocks.screwThread.userData.curve;
  const internal = blocks.wheelInternalThread.userData.curve;

  const externalParameterPerLead = geometry.threadLead
    / geometry.screwLength;
  for (let index = 0; index <= 500; index += 1) {
    const parameter = index / 500;
    const point = external.getPoint(parameter);
    near(Math.hypot(point.y, point.z),
      geometry.screwThreadRadius, 2e-16,
      'external helix centerline radius');
    if (parameter + externalParameterPerLead <= 1) {
      const oneLeadLater = external.getPoint(
        parameter + externalParameterPerLead,
      );
      near(oneLeadLater.x - point.x,
        geometry.threadLead, 2e-15,
        'external helix advances one lead');
      vectorNear(
        new THREE.Vector2(oneLeadLater.y, oneLeadLater.z),
        new THREE.Vector2(point.y, point.z),
        2e-14,
        'external helix phase repeats after one lead',
      );
    }
  }

  for (let sample = -600; sample <= 1200; sample += 1) {
    const state = stateAtTime(
      data.timeline.cycleDuration * sample / 600,
    );
    for (const parameter of [0, 0.2, 0.5, 0.8, 1]) {
      const localPoint = internal.getPoint(parameter);
      const internalWorldPhase = Math.atan2(localPoint.z, localPoint.y)
        + state.wheelAngle;
      const globalX = state.radius + localPoint.x;
      const externalPhase = (globalX - geometry.screwMinimumX)
        / geometry.threadLead * FULL_TURN;
      angleNear(internalWorldPhase, externalPhase + Math.PI, 8e-14,
        'female tooth lies between adjacent male turns');
    }
  }
  near(
    geometry.wheelHubBoreRadius
      - (geometry.screwThreadRadius + geometry.threadTubeRadius),
    0.004,
    2e-17,
    'threaded hub radial running clearance',
  );
  disposeModel(model.root);
});

test('movement 384 screw advance and wheel rolling constraints produce only the intrinsic axial contact scrub', () => {
  const model = createMovementModel(catalog.movements[383]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;

  assert.match(transmission.screwConstraint, /threadLead/);
  assert.match(transmission.rollingConstraint, /wheelRadius/);
  assert.match(transmission.traceMechanism, /circumferential slip is zero/);
  assert.match(transmission.traceMechanism, /axial wheel scrub/);
  near(transmission.axialAdvancePerWheelRadian,
    geometry.threadLead / FULL_TURN, 0,
    'screw advance per wheel radian');

  for (let sample = -2400; sample <= 4800; sample += 1) {
    const state = stateAtTime(
      data.timeline.cycleDuration * sample / 2400,
    );
    near(
      state.radius - geometry.outerRadius
        - geometry.threadLead / FULL_TURN * state.wheelAngle,
      0,
      2e-15,
      'finite screw displacement constraint',
    );
    near(
      state.radius * state.orbitAngularSpeed
        + geometry.wheelRadius * state.wheelAngularSpeed,
      0,
      5e-15,
      'differential circumferential rolling constraint',
    );
    vectorNear(
      state.spinVelocityAtContact.clone().add(state.orbitalVelocity),
      new THREE.Vector3(),
      5e-15,
      'wheel spin cancels orbital contact velocity',
    );
    vectorNear(
      state.wheelMaterialVelocityAtContact,
      state.radialVelocity,
      5e-15,
      'remaining contact motion is solely axial scrub',
    );
    near(state.wheelMaterialVelocityAtContact.dot(
      state.tangentialDirection,
    ), 0, 5e-15, 'zero circumferential slip');
    near(state.wheelMaterialVelocityAtContact.dot(
      state.radialDirection,
    ), state.radialSpeed, 3e-15, 'axial scrub equals screw advance rate');
  }
  disposeModel(model.root);
});

test('movement 384 wheel contact follows the exact constant-angle logarithmic spiral implied by rolling and screw lead', () => {
  const model = createMovementModel(catalog.movements[383]);
  const data = model.root.userData;
  const { geometry, spiralPath, stateAtTime, transmission } = data;
  const expectedRate = geometry.threadLead
    / (FULL_TURN * geometry.wheelRadius);

  near(geometry.logarithmicRate, expectedRate, 0,
    'logarithmic radial rate');
  assert.match(transmission.logarithmicSpiralLaw, /exp/);
  near(geometry.innerRadius,
    geometry.outerRadius * Math.exp(
      -geometry.logarithmicRate * geometry.sweepAngle,
    ), 0, 'inner radius after inward sweep');
  near(geometry.radialTravel,
    geometry.outerRadius - geometry.innerRadius, 0,
    'wheel travel range');
  near(geometry.wheelTurnsInward,
    geometry.radialTravel / geometry.threadLead, 0,
    'wheel turns implied by screw travel');

  for (let index = 0; index <= 1500; index += 1) {
    const parameter = index / 1500;
    const angle = geometry.sweepAngle * parameter;
    const expectedRadius = geometry.outerRadius * Math.exp(
      -geometry.logarithmicRate * angle,
    );
    const point = spiralPath.getPoint(parameter);
    near(Math.hypot(point.x, point.z), expectedRadius, 9e-16,
      'trace logarithmic radius');
    near(point.x, expectedRadius * Math.cos(angle), 0,
      'trace x coordinate');
    near(point.z, -expectedRadius * Math.sin(angle), 0,
      'trace z coordinate');

    const state = stateAtTime(
      data.timeline.cycleDuration * parameter / 2,
    );
    const stateTracePoint = spiralPath.getPoint(state.excursion);
    near(state.contactPoint.x, stateTracePoint.x, 2e-15,
      'inward contact lies over trace x');
    near(state.contactPoint.z, stateTracePoint.z, 2e-15,
      'inward contact lies over trace z');
    near(state.contactPoint.y - stateTracePoint.y, 0.006, 2e-17,
      'rendered trace is just below physical contact');
    const tangentScale = Math.sqrt(
      1 + geometry.logarithmicRate ** 2,
    );
    near(state.spiralTangent.dot(state.tangentialDirection),
      1 / tangentScale, 4e-16,
      'constant spiral tangent angle to circumferential direction');
    near(state.spiralTangent.dot(state.radialDirection),
      -geometry.logarithmicRate / tangentScale, 3e-16,
      'constant inward radial component of spiral tangent');
  }

  const afterOneOrbit = spiralPath.getPoint(1 / geometry.orbitTurns);
  near(Math.hypot(afterOneOrbit.x, afterOneOrbit.z)
    / geometry.outerRadius,
  Math.exp(-geometry.threadLead / geometry.wheelRadius), 4e-16,
  'each orbit multiplies radius by one constant factor');
  disposeModel(model.root);
});

test('movement 384 reverses smoothly at both radial limits and exactly retraces the same spiral either way', () => {
  const model = createMovementModel(catalog.movements[383]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const inner = stateAtTime(timeline.events.inwardEnd);
  const closure = stateAtTime(timeline.events.outwardReturnEnd);

  near(start.radius, geometry.outerRadius, 0, 'starts at outer radius');
  near(start.orbitAngle, 0, 0, 'starts on source radial');
  near(start.wheelAngle, 0, 0, 'starts at wheel phase datum');
  near(inner.radius, geometry.innerRadius, 0, 'inward reversal radius');
  near(inner.orbitAngle, geometry.sweepAngle, 0,
    'inward reversal orbit sweep');
  near(inner.wheelAngle,
    -geometry.wheelTurnsInward * FULL_TURN, 8e-15,
    'inward reversal wheel turns');
  for (const state of [start, inner, closure]) {
    near(state.orbitAngularSpeed, 0, 9e-16,
      'orbit stops smoothly at reversal');
    near(state.radialSpeed, 0, 2e-16,
      'radial feed stops smoothly at reversal');
    near(state.wheelAngularSpeed, 0, 2e-15,
      'wheel stops smoothly at reversal');
  }

  for (let sample = 0; sample <= 1200; sample += 1) {
    const inwardTime = timeline.cycleDuration * sample / 2400;
    const outwardTime = timeline.cycleDuration - inwardTime;
    const inward = stateAtTime(inwardTime);
    const outward = stateAtTime(outwardTime);
    near(outward.radius, inward.radius, 3e-15,
      'return pass retraces radius');
    near(outward.orbitAngle, inward.orbitAngle, 1e-14,
      'return pass retraces angle');
    near(outward.wheelAngle, inward.wheelAngle, 5e-14,
      'return pass restores matching wheel phase');
    vectorNear(outward.contactPoint, inward.contactPoint, 3e-14,
      'return pass retraces contact locus');
    near(outward.orbitAngularSpeed, -inward.orbitAngularSpeed, 2e-14,
      'orbit velocity reverses');
    near(outward.radialSpeed, -inward.radialSpeed, 3e-15,
      'screw feed velocity reverses');
    near(outward.wheelAngularSpeed, -inward.wheelAngularSpeed, 3e-14,
      'wheel rolling direction reverses');
  }
  disposeModel(model.root);
});

test('movement 384 renderer binds the orbit, screw carriage, wheel phase, and paper contact exactly', () => {
  const model = createMovementModel(catalog.movements[383]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime, timeline } = data;
  const fixedPivotPosition = blocks.fixedPivot.position.clone();
  const paperPosition = blocks.paperAssembly.position.clone();
  const tracePosition = blocks.transferredTrace.position.clone();

  for (let frame = 0; frame <= 1440; frame += 1) {
    const time = timeline.cycleDuration * 2 * frame / 1440;
    const expected = stateAtTime(time);
    model.update(time, 0.016);
    near(blocks.orbitingArm.rotation.y,
      expected.orbitAngle, 0, 'rendered arm orbit');
    near(blocks.threadedWheel.position.x,
      expected.radius, 0, 'rendered wheel screw station');
    near(blocks.threadedWheel.position.y,
      geometry.wheelAxisY, 0, 'constant wheel axle height');
    near(blocks.wheelRotor.rotation.x,
      expected.wheelAngle, 0, 'rendered wheel spin');
    const expectedMarker = expected.contactPoint.clone();
    expectedMarker.y += 0.008;
    vectorNear(blocks.liveContact.position,
      expectedMarker, 0, 'rendered live contact marker');
    const renderedWheelCenter = new THREE.Vector3();
    blocks.threadedWheel.getWorldPosition(renderedWheelCenter);
    vectorNear(renderedWheelCenter,
      expected.wheelCenter, 2e-15, 'rendered wheel center');
    const renderedBottom = renderedWheelCenter.clone();
    renderedBottom.y -= geometry.wheelRadius;
    vectorNear(renderedBottom,
      expected.contactPoint, 2e-15, 'wheel remains tangent to paper');
    vectorNear(blocks.fixedPivot.position,
      fixedPivotPosition, 0, 'fixed centre does not move');
    vectorNear(blocks.paperAssembly.position,
      paperPosition, 0, 'paper does not move');
    vectorNear(blocks.transferredTrace.position,
      tracePosition, 0, 'completed trace remains on paper');
    near(data.contacts.threadedHubToScrew.leadRelationResidual,
      0, 2e-15, 'runtime screw engagement residual');
    vectorNear(
      data.contacts.wheelRimToTransferPaper
        .rollingDirectionSlipVelocity,
      new THREE.Vector3(),
      6e-15,
      'runtime rolling-direction slip residual',
    );
  }
  disposeModel(model.root);
});

test('movement 384 closes every pose exactly before movement 507 remains the next authored draft', () => {
  const movement = catalog.movements[383];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.cycleDuration);

  near(closure.radius, start.radius, 0, 'wheel radius closes');
  near(closure.orbitAngle, start.orbitAngle, 0, 'arm angle closes');
  near(closure.wheelAngle, start.wheelAngle, 0, 'wheel phase closes');
  vectorNear(closure.contactPoint, start.contactPoint, 0,
    'paper contact closes');
  vectorNear(closure.wheelCenterVelocity,
    start.wheelCenterVelocity, 0, 'velocity closes');
  assert.equal(data.animationTiming.authoredCyclePeriod,
    timeline.cycleDuration);
  assert.equal(data.animationTiming.targetCycleDuration, 2);
  assertReadableTiming(data.animationTiming);
  assert.ok(data.cameraFitBounds instanceof THREE.Box3);
  assert.ok(Number.isFinite(data.groundFloorY));
  for (const residual of Object.values(data.constraintResiduals)) {
    near(residual, 0, 8e-16, 'static constraint residual');
  }

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model507.root);
});
