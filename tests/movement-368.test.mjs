import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
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

function radialDistanceToAxis(point, origin, axis) {
  const offset = point.clone().sub(origin);
  return offset.addScaledVector(axis, -offset.dot(axis)).length();
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

test('movement 368 contains one shared crank shaft, a spur-and-rack feed, a true bevel pair, and the cylinder-mounted spiral', () => {
  const movement = catalog.movements[367];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 368);
  assert.equal(movement.number, '368');
  assert.equal(movement.category, 'Bevel gearing');
  assert.equal(
    movement.archetype,
    'shared-shaft-spur-rack-bevel-cylinder-helix-scriber',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-hand-cranked-horizontal-shaft/);
  assert.match(data.mechanism, /bevel-pinion-and-spur-pinion/);
  assert.match(data.mechanism, /vertical-cylinder/);
  assert.match(data.mechanism, /vertical-rack-and-scribing-point/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.input, /hand-crank angle/);
  assert.match(degreesOfFreedom.note, /helix pitch is not an independent/);

  for (const component of [
    blocks.driverBevel,
    blocks.drivenBevel,
    blocks.spurGear,
    blocks.inputShaft,
    blocks.crankRotor,
    blocks.rackAssembly,
    blocks.cylinderRotor,
    blocks.table,
    blocks.verticalBearing,
  ]) assert.equal(component.parent, model.root);
  assert.equal(blocks.rack.parent, blocks.rackAssembly);
  for (const component of [
    blocks.rackCarrier,
    blocks.carriageBridge,
    blocks.stylusArm,
    blocks.stylusTip,
    blocks.contactBead,
  ]) assert.equal(component.parent, blocks.rackAssembly);
  for (const component of [
    blocks.cylinder,
    blocks.cylinderShaft,
    blocks.spiralTrace,
    ...blocks.cylinderRims,
    ...blocks.cylinderIndexes,
  ]) assert.equal(component.parent, blocks.cylinderRotor);
  assert.equal(blocks.driverBevel.userData.toothMeshes.length,
    geometry.driverTeeth);
  assert.equal(blocks.drivenBevel.userData.toothMeshes.length,
    geometry.drivenTeeth);
  assert.equal(blocks.spurGear.userData.teeth, geometry.spurTeeth);
  assert.ok(blocks.rack.userData.toothCount > geometry.spurTeeth);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt || object.userData.mechanismBelt
      || object.userData.selectorBelt) belts.push(object);
  });
  for (const role of [
    'single-keyed-horizontal-shaft-for-crank-spur-and-bevel-pinion',
    'input-shaft-bevel-pinion-driving-cylinder-shaft',
    'vertical-shaft-bevel-wheel-driving-cylinder',
    'same-input-shaft-spur-pinion-driving-vertical-rack',
    'finite-toothed-rack-sliding-through-guides',
    'rigid-horizontal-marking-point-arm',
    'marking-point-touching-cylinder-surface',
    'cylinder-receiving-described-spiral-line',
    'mechanically-derived-spiral-line-fixed-on-cylinder-surface',
    'hand-crank-keyed-to-input-shaft',
  ]) assert.ok(roles.includes(role), role);
  assert.equal(belts.length, 0);
  disposeModel(model.root);
});

test('movement 368 records the unavailable animation, complete Brown drive chain, and measured source engraving', () => {
  const movement = catalog.movements[367];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate368;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_368.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Describing spiral line on a cylinder/);
  assert.match(movement.description, /spur-gear which drives the bevel-gears/);
  assert.match(movement.description, /also gears into the toothed rack/);
  assert.match(movement.description, /marking point to traverse from end to end/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(data.dynamics.sourceSpecifiesTimingMassOrFriction, false);
  assert.match(data.dynamics.treatment, /quintic hand-cranked pass/);
  assert.match(data.dynamics.treatment, /neither speed nor automatic reversal/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.bevelPinionCenter.toArray(), [251, 106]);
  assert.deepEqual(plate.bevelWheelCenter.toArray(), [168, 174]);
  assert.deepEqual(plate.crankHandle.toArray(), [496, 138]);
  assert.deepEqual(plate.cylinderTop.toArray(), [162, 283]);
  assert.deepEqual(plate.cylinderBottom.toArray(), [162, 520]);
  assert.deepEqual(plate.markingPoint.toArray(), [250, 402]);
  assert.deepEqual(plate.rackCenterline.toArray(), [385, 361]);
  assert.deepEqual(plate.spurCenter.toArray(), [386, 117]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence, /hand crank and horizontal common shaft/);
  assert.match(evidence.engravingEvidence, /vertical rack/);
  assert.match(evidence.engravingEvidence, /point touching the cylinder/);
  assert.match(evidence.reconstructionDisclosure, /tooth counts/);
  assert.match(evidence.reconstructionDisclosure, /no numerical values/);
  assert.match(evidence.reconstructionDisclosure, /no canvas animation/);
  disposeModel(model.root);
});

test('movement 368 complementary pitch cones have equal module, exact tooth ratio, and zero velocity mismatch at their common pitch point', () => {
  const model = createMovementModel(catalog.movements[367]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const driverAxis = blocks.driverBevel.userData.axis;
  const drivenAxis = blocks.drivenBevel.userData.axis;

  vectorNear(driverAxis, X_AXIS, 0, 'driver bevel axis');
  vectorNear(drivenAxis, Y_AXIS.clone().negate(), 0,
    'downward driven bevel axis');
  near(Math.abs(driverAxis.dot(drivenAxis)), 0, 0,
    'perpendicular bevel axes');
  vectorNear(blocks.driverBevel.position, geometry.apex, 0,
    'driver cone apex');
  vectorNear(blocks.drivenBevel.position, geometry.apex, 0,
    'driven cone apex');
  near(
    geometry.driverPitchConeAngle + geometry.drivenPitchConeAngle,
    Math.PI / 2,
    2e-16,
    'complementary pitch-cone angles',
  );
  near(
    geometry.driverOuterPitchRadius / geometry.drivenOuterPitchRadius,
    geometry.driverTeeth / geometry.drivenTeeth,
    2e-16,
    'pitch-radius and tooth-count ratios',
  );
  near(
    2 * geometry.driverOuterPitchRadius / geometry.driverTeeth,
    2 * geometry.drivenOuterPitchRadius / geometry.drivenTeeth,
    2e-17,
    'equal bevel module',
  );
  near(
    radialDistanceToAxis(
      geometry.bevelContactPoint,
      geometry.apex,
      driverAxis,
    ),
    geometry.driverOuterPitchRadius,
    2e-16,
    'driver pitch radius at contact',
  );
  near(
    radialDistanceToAxis(
      geometry.bevelContactPoint,
      geometry.apex,
      drivenAxis,
    ),
    geometry.drivenOuterPitchRadius,
    2e-16,
    'driven pitch radius at contact',
  );

  let maximumSlip = 0;
  for (let sample = 0; sample <= 1400; sample += 1) {
    const state = stateAtTime(
      geometry.demonstrationPeriod * 2 * sample / 1400,
    );
    near(
      state.drivenBevelLocalAngularSpeed,
      -geometry.bevelRatio * state.inputAngularSpeed,
      2e-15,
      'bevel angular-speed ratio',
    );
    maximumSlip = Math.max(
      maximumSlip,
      state.driverBevelPitchVelocity.distanceTo(
        state.drivenBevelPitchVelocity,
      ),
    );
  }
  assert.ok(maximumSlip < 8e-16);
  assert.match(data.transmission.bevelLaw, /18\/30/);
  assert.match(data.transmission.bevelLaw, /zero pitch-line slip/);
  disposeModel(model.root);
});

test('movement 368 the common input angle gives exact spur pitch travel and rack velocity in both cranking directions', () => {
  const model = createMovementModel(catalog.movements[367]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  const initial = stateAtTime(0);
  let minimumY = Infinity;
  let maximumY = -Infinity;
  let maximumSlip = 0;
  let sawPositiveVelocity = false;
  let sawNegativeVelocity = false;

  for (let sample = 0; sample <= 1800; sample += 1) {
    const state = stateAtTime(
      geometry.demonstrationPeriod * 2 * sample / 1800,
    );
    near(
      state.rackDisplacement,
      geometry.spurPitchRadius
        * (state.inputAngle - initial.inputAngle),
      9e-16,
      'spur angle to rack displacement',
    );
    near(
      state.rackVelocity,
      geometry.spurPitchRadius * state.inputAngularSpeed,
      5e-16,
      'spur angular speed to rack velocity',
    );
    maximumSlip = Math.max(
      maximumSlip,
      state.spurPitchVelocity.distanceTo(state.rackPitchVelocity),
    );
    minimumY = Math.min(minimumY, state.scriberY);
    maximumY = Math.max(maximumY, state.scriberY);
    if (state.rackVelocity > 0.05) sawPositiveVelocity = true;
    if (state.rackVelocity < -0.05) sawNegativeVelocity = true;
  }
  near(minimumY, geometry.scribingBottomY, 0, 'lower cylinder end');
  near(maximumY, geometry.scribingTopY, 0, 'upper cylinder end');
  near(maximumY - minimumY, geometry.rackStroke, 0,
    'full end-to-end stroke');
  assert.ok(maximumSlip < 2e-16);
  assert.equal(sawPositiveVelocity, true);
  assert.equal(sawNegativeVelocity, true);
  assert.match(data.transmission.sharedShaftLaw,
    /one identical unwrapped input angle/);
  assert.match(data.transmission.rackLaw,
    /rack displacement = spur pitch radius/);
  disposeModel(model.root);
});

test('movement 368 cylinder-mounted curve is the exact helix eliminated from rack travel and bevel rotation and remains under the stylus', () => {
  const model = createMovementModel(catalog.movements[367]);
  const data = model.root.userData;
  const { geometry, helixCurve, stateAtTime } = data;

  near(
    geometry.helixAxialPitch,
    FULL_TURN * geometry.spurPitchRadius
      * geometry.drivenTeeth / geometry.driverTeeth,
    9e-16,
    'derived axial pitch per cylinder turn',
  );
  near(
    geometry.helixTurns,
    geometry.cylinderAngularTravel / FULL_TURN,
    0,
    'helix turn count',
  );
  assert.ok(geometry.helixTurns > 0.5);
  assert.ok(geometry.helixTurns < 0.51);

  let maximumContactError = 0;
  for (let sample = 0; sample <= 1600; sample += 1) {
    const state = stateAtTime(
      geometry.demonstrationPeriod * 2 * sample / 1600,
    );
    const curvePoint = helixCurve.getPoint(state.progress);
    vectorNear(curvePoint, state.helixLocalPoint, 1e-15,
      'state lies on exact cylinder helix');
    near(
      Math.hypot(curvePoint.x, curvePoint.z),
      geometry.cylinderRadius,
      5e-16,
      'helix lies on cylinder radius',
    );
    near(curvePoint.y, state.scriberY, 0,
      'helix and rack have identical axial coordinate');
    near(
      state.cylinderAngle - geometry.cylinderStartAngle,
      geometry.bevelRatio * state.rackDisplacement
        / geometry.spurPitchRadius,
      5e-16,
      'eliminated rack-bevel helix angle',
    );
    const transformed = curvePoint.clone()
      .applyAxisAngle(Y_AXIS, state.cylinderAngle)
      .add(new THREE.Vector3(
        geometry.cylinderCenter.x,
        0,
        geometry.cylinderCenter.z,
      ));
    vectorNear(transformed, state.stylusContactPoint, 1.2e-15,
      'rotated material helix meets stationary radial stylus');
    maximumContactError = Math.max(
      maximumContactError,
      state.helixWorldPoint.distanceTo(state.stylusContactPoint),
    );
  }
  assert.ok(maximumContactError < 7e-16);
  assert.match(data.transmission.helixLaw, /eliminating input angle/);
  assert.match(data.transmission.helixPitchLaw, /2\*pi\*spur pitch radius/);
  disposeModel(model.root);
});

test('movement 368 reconstructed hand operation dwells and reverses smoothly while analytic rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[367]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const period = geometry.demonstrationPeriod;
  const { schedule } = geometry;

  const boundaryExpectations = [
    [0, 0],
    [schedule.bottomDwellEnd, 0],
    [schedule.forwardEnd, 1],
    [schedule.topDwellEnd, 1],
    [schedule.returnEnd, 0],
    [1, 0],
  ];
  for (const [phase, expectedProgress] of boundaryExpectations) {
    const state = stateAtTime(period * phase);
    near(state.progress, expectedProgress, 0,
      `boundary progress at ${phase}`);
    near(state.progressRate, 0, 0,
      `boundary speed at ${phase}`);
    near(state.rackVelocity, 0, 0,
      `boundary rack speed at ${phase}`);
  }

  const h = 1e-5;
  for (const phase of [0.19, 0.31, 0.65, 0.79]) {
    const time = period * phase;
    const before = stateAtTime(time - h);
    const state = stateAtTime(time);
    const after = stateAtTime(time + h);
    near(
      (after.scriberY - before.scriberY) / (2 * h),
      state.rackVelocity,
      3e-9,
      'analytic rack velocity',
    );
    near(
      (after.inputAngle - before.inputAngle) / (2 * h),
      state.inputAngularSpeed,
      7e-9,
      'analytic input angular speed',
    );
    near(
      (after.cylinderAngle - before.cylinderAngle) / (2 * h),
      state.cylinderAngularSpeed,
      5e-9,
      'analytic cylinder angular speed',
    );
  }

  const stages = new Set();
  for (let sample = 0; sample <= 800; sample += 1) {
    stages.add(stateAtTime(period * sample / 800).stage);
  }
  assert.deepEqual(stages, new Set([
    'lower-end-dwell-before-forward-scribing-pass',
    'forward-cranking-and-scribing-bottom-to-top',
    'upper-end-dwell-before-manual-reversal',
    'reverse-cranking-and-retracing-top-to-bottom',
  ]));
  assert.deepEqual(timeline.schedule, schedule);
  assert.match(timeline.note, /reverses along the identical constrained helix/);
  disposeModel(model.root);
});

test('movement 368 renderer keeps every shared-shaft angle, pitch contact, rack position, and scribing contact exact over 1,200 frames', () => {
  const model = createMovementModel(catalog.movements[367]);
  const data = model.root.userData;
  const { animationTiming, blocks, geometry } = data;
  let maximumBevelSlip = 0;
  let maximumRackSlip = 0;
  let maximumScribingError = 0;
  let largestRackStep = 0;
  let previousRackY = null;
  const stages = new Set();

  assert.equal(animationTiming.authoredCyclePeriod,
    geometry.demonstrationPeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  for (let frame = 0; frame <= 1200; frame += 1) {
    const time = geometry.demonstrationPeriod * frame / 1200;
    model.update(time);
    const state = data.currentState;
    stages.add(state.stage);
    near(blocks.driverBevel.userData.rotor.rotation.z,
      state.inputAngle, 0, 'rendered driver bevel angle');
    near(blocks.spurGear.userData.rotor.rotation.z,
      state.inputAngle, 0, 'rendered common-shaft spur angle');
    near(blocks.crankRotor.rotation.x,
      state.inputAngle, 0, 'rendered crank angle');
    near(blocks.drivenBevel.userData.rotor.rotation.z,
      state.drivenBevelLocalAngle, 0, 'rendered driven bevel angle');
    near(blocks.cylinderRotor.rotation.y,
      state.cylinderAngle, 0, 'rendered cylinder angle');
    near(blocks.rackAssembly.position.y,
      state.scriberY, 0, 'rendered rack position');
    maximumBevelSlip = Math.max(
      maximumBevelSlip,
      data.constraints.bevelPitchContact.slipVelocity.length(),
    );
    maximumRackSlip = Math.max(
      maximumRackSlip,
      data.constraints.rackPitchContact.slipVelocity.length(),
    );
    maximumScribingError = Math.max(
      maximumScribingError,
      data.constraints.scribingContact.contactError,
    );
    near(data.constraints.coaxialOutput.keyedAngleDifference, 0, 0,
      'keyed bevel-wheel/cylinder angle');
    near(data.constraints.rackPitchContact.pitchPhaseResidual, 0,
      9e-16, 'rack pitch phase');
    if (previousRackY !== null) {
      largestRackStep = Math.max(
        largestRackStep,
        Math.abs(blocks.rackAssembly.position.y - previousRackY),
      );
    }
    previousRackY = blocks.rackAssembly.position.y;
    if (frame % 100 === 0) {
      model.root.updateMatrixWorld(true);
      model.root.traverse((object) => {
        assert.ok(object.matrixWorld.elements.every(Number.isFinite));
      });
    }
  }
  assert.ok(maximumBevelSlip < 8e-16);
  assert.ok(maximumRackSlip < 2e-16);
  assert.ok(maximumScribingError < 5e-16);
  assert.ok(largestRackStep < 0.0106);
  assert.equal(stages.size, 4);
  disposeModel(model.root);
});

test('movement 368 closes its complete pass and reverse exactly before movement 507', () => {
  const movement368 = catalog.movements[367];
  const movement507 = catalog.movements[506];
  const model368 = createMovementModel(movement368);
  const data = model368.root.userData;
  const { geometry, stateAtTime } = data;
  const start = stateAtTime(0);
  const top = stateAtTime(
    geometry.demonstrationPeriod * geometry.schedule.forwardEnd,
  );
  const closure = stateAtTime(geometry.demonstrationPeriod);

  near(top.scriberY - start.scriberY, geometry.rackStroke, 0,
    'one full rack pass');
  near(top.inputAngle - start.inputAngle,
    geometry.inputAngularTravel, 9e-16, 'input angular travel');
  near(top.cylinderAngle - start.cylinderAngle,
    geometry.cylinderAngularTravel, 5e-16,
    'cylinder angular travel');
  near(top.drivenBevelLocalAngle - start.drivenBevelLocalAngle,
    -geometry.cylinderAngularTravel, 5e-16,
    'driven bevel local angular travel');
  near(closure.inputAngle, start.inputAngle, 0,
    'input-angle closure');
  near(closure.inputAngularSpeed, start.inputAngularSpeed, 0,
    'input-speed closure');
  near(closure.rackDisplacement, start.rackDisplacement, 0,
    'rack closure');
  near(closure.scriberY, start.scriberY, 0,
    'scriber closure');
  near(closure.cylinderAngle, start.cylinderAngle, 0,
    'cylinder closure');
  vectorNear(closure.stylusContactPoint,
    start.stylusContactPoint, 0, 'contact closure');

  const model507 = createMovementModel(movement507);
  assert.equal(movement368.id, 368);
  assert.equal(movement368.fidelity, 'authored');
  assert.equal(model368.root.userData.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model368.root);
});
