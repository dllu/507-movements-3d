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

test('movement 366 contains the full hand-crank, unequal bevel pair, keyed sliding drillshaft, and two-lever treadle feed', () => {
  const movement = catalog.movements[365];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 366);
  assert.equal(movement.number, '366');
  assert.equal(movement.category, 'Bevel gearing');
  assert.equal(
    movement.archetype,
    'hand-crank-bevel-keyed-sliding-spindle-treadle-feed-drill',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /hand-cranked-large-bevel-gear/);
  assert.match(data.mechanism, /fixed-height-keyed-bore-pinion/);
  assert.match(data.mechanism, /treadle-vertical-link-upper-lever/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 2);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.deepEqual(degreesOfFreedom.inputs, [
    'continuous hand-crank rotation',
    'operator treadle depression and release',
  ]);
  assert.match(degreesOfFreedom.note, /permits axial sliding/);
  assert.match(degreesOfFreedom.note, /removes relative rotation/);

  for (const component of [
    blocks.driverGear,
    blocks.pinionGear,
    blocks.inputRotor,
    blocks.drillSlide,
    blocks.lowerLeverRotor,
    blocks.upperLeverRotor,
    blocks.verticalConnector,
    blocks.frame,
  ]) assert.equal(component.parent, model.root);
  assert.equal(blocks.frame.userData.fixed, true);
  assert.equal(blocks.shaftSpinRotor.parent, blocks.drillSlide);
  for (const component of [
    blocks.drillShaft,
    blocks.shaftFeather,
    blocks.shaftSpinIndex,
    blocks.chuck,
    blocks.drillBit,
    ...blocks.bitFlutes,
  ]) assert.equal(component.parent, blocks.shaftSpinRotor);
  assert.equal(blocks.thrustCollar.parent, blocks.drillSlide);
  assert.equal(blocks.collarPin.parent, blocks.drillSlide);
  assert.equal(blocks.pinionKeyway.parent,
    blocks.pinionGear.userData.rotor);
  assert.equal(blocks.inputShaft.parent, blocks.inputRotor);
  assert.equal(blocks.crankArm.parent, blocks.inputRotor);
  assert.equal(blocks.crankHandle.parent, blocks.inputRotor);
  assert.equal(blocks.crankIndex.parent, blocks.inputRotor);
  assert.equal(blocks.driverGear.userData.toothMeshes.length, 32);
  assert.equal(blocks.pinionGear.userData.toothMeshes.length, 16);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt || object.userData.mechanismBelt
      || object.userData.selectorBelt) belts.push(object);
  });
  for (const role of [
    'large-hand-crank-driven-horizontal-axis-bevel-gear',
    'small-axially-fixed-keyed-bore-bevel-pinion',
    'horizontal-hand-crank-input-shaft',
    'vertical-drillshaft-sliding-through-small-bevel-pinion',
    'longitudinal-feather-key-sliding-in-pinion-groove',
    'nonrotating-thrust-collar-translating-with-drillshaft',
    'long-two-sided-foot-treadle-lever',
    'rigid-vertical-link-joining-left-ends-of-treadle-and-upper-lever',
    'thrust-collar-pin-riding-in-upper-lever-slot',
    'rotating-pointed-drill-bit',
  ]) assert.ok(roles.includes(role), role);
  assert.equal(belts.length, 0);
  disposeModel(model.root);
});

test('movement 366 records the unavailable source animation, complete Brown caption chain, and measured drill engraving', () => {
  const movement = catalog.movements[365];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate366;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_366.html');
  assert.match(movement.description, /Drilling machine/);
  assert.match(movement.description, /large bevel-gear/);
  assert.match(movement.description, /vertical drillshaft/);
  assert.match(movement.description, /slides through small bevel-gear/);
  assert.match(movement.description, /feather and groove/);
  assert.match(movement.description, /depressed by treadle/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(data.dynamics.returnForceSpecifiedBySource, false);
  assert.equal(data.dynamics.sourceSpecifiesGearSpeedInertiaOrDrillingLoad,
    false);
  assert.match(data.dynamics.treadleSchedule, /without claiming/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 10);
  assert.equal(plate.drillAxisX, 213);
  assert.deepEqual(plate.drillBitTip.toArray(), [216, 507]);
  assert.deepEqual(plate.crankHandle.toArray(), [386, 119]);
  assert.deepEqual(plate.lowerLeverPivot.toArray(), [130, 457]);
  assert.deepEqual(plate.treadleFootEnd.toArray(), [459, 365]);
  assert.deepEqual(plate.upperLeverLeftJoint.toArray(), [63, 75]);
  assert.deepEqual(plate.upperLeverPivot.toArray(), [135, 53]);
  assert.deepEqual(plate.upperLeverRightJoint.toArray(), [214, 31]);
  assert.deepEqual(plate.verticalLinkBottomJoint.toArray(), [55, 481]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence, /right-hand crank/);
  assert.match(evidence.engravingEvidence, /unequal right-angle bevel pair/);
  assert.match(evidence.engravingEvidence, /far-left vertical link/);
  assert.match(evidence.reconstructionDisclosure, /tooth counts/);
  assert.match(evidence.reconstructionDisclosure, /no dimensions or timing/);
  disposeModel(model.root);
});

test('movement 366 unequal bevel pitch cones share one apex, oppose normals, and have an exact 2:1 speed ratio with zero pitch-line slip', () => {
  const model = createMovementModel(catalog.movements[365]);
  const data = model.root.userData;
  const { gearContact, geometry, stateAtTime } = data;

  vectorNear(gearContact.driverAxis, X_AXIS, 0, 'driver axis');
  vectorNear(gearContact.pinionAxis, Y_AXIS, 0,
    'upward pinion axis');
  near(Math.abs(gearContact.driverAxis.dot(gearContact.pinionAxis)),
    0, 0, 'right-angle gear axes');
  near(
    geometry.driverPitchConeAngle + geometry.pinionPitchConeAngle,
    Math.PI / 2,
    0,
    'complementary pitch-cone angles',
  );
  near(Math.tan(geometry.driverPitchConeAngle),
    geometry.bevelRatio, 6e-16, 'large-gear pitch tangent');
  near(Math.tan(geometry.pinionPitchConeAngle),
    1 / geometry.bevelRatio, 1e-16, 'pinion pitch tangent');
  near(geometry.driverOuterPitchRadius / geometry.pinionOuterPitchRadius,
    geometry.bevelRatio, 4e-16, 'pitch-radius ratio');
  near(
    geometry.driverOuterPitchRadius / geometry.driverTeeth,
    geometry.pinionOuterPitchRadius / geometry.pinionTeeth,
    2e-17,
    'equal pitch module',
  );
  near(
    gearContact.contactPoint.clone().sub(gearContact.apex)
      .dot(gearContact.driverAxis),
    geometry.driverOuterDistance,
    2e-16,
    'driver axial contact distance',
  );
  near(
    gearContact.contactPoint.clone().sub(gearContact.apex)
      .dot(gearContact.pinionAxis),
    geometry.pinionOuterDistance,
    3e-16,
    'pinion axial contact distance',
  );
  near(radialDistanceToAxis(gearContact.contactPoint,
    gearContact.apex, gearContact.driverAxis),
  geometry.driverOuterPitchRadius, 5e-16,
  'driver contact pitch radius');
  near(radialDistanceToAxis(gearContact.contactPoint,
    gearContact.apex, gearContact.pinionAxis),
  geometry.pinionOuterPitchRadius, 5e-16,
  'pinion contact pitch radius');
  assert.ok(gearContact.driverPitchConeNormal.clone()
    .add(gearContact.pinionPitchConeNormal).length() < 2e-16);

  const start = stateAtTime(0);
  for (const time of [-16.3, -1, 0, 0.83, 3.2, 8, 19.4]) {
    const state = stateAtTime(time);
    near(
      state.pinionLocalAngle - start.pinionLocalAngle,
      -geometry.bevelRatio
        * (state.driverAngle - start.driverAngle),
      7e-15,
      `bevel angle ratio at ${time}`,
    );
    near(state.pinionLocalAngularSpeed,
      -geometry.bevelRatio * state.driverAngularSpeed, 0,
      `bevel speed ratio at ${time}`);
    assert.ok(state.gearPitchLineSlipVelocity.length() < 3e-16);
    assert.ok(Math.abs(state.gearMeshPhaseInvariant) < 3e-14);
    vectorNear(state.driverSurfaceVelocity,
      state.pinionSurfaceVelocity, 3e-16,
      `pitch-line surface velocity at ${time}`);
  }
  assert.match(data.transmission.bevelLaw, /-\(32\/16\)/);
  assert.match(data.transmission.bevelLaw, /identical/);
  disposeModel(model.root);
});

test('movement 366 fixed-height pinion and feathered drillshaft keep identical physical rotation through every axial feed position', () => {
  const model = createMovementModel(catalog.movements[365]);
  const data = model.root.userData;
  const { blocks, gearContact, geometry, stateAtTime } = data;
  const physicalPinionAngularVelocity = gearContact.pinionAxis.clone()
    .multiplyScalar(geometry.pinionLocalAngularSpeed);
  const physicalShaftAngularVelocity = Y_AXIS.clone()
    .multiplyScalar(geometry.drillShaftAngularSpeed);
  vectorNear(physicalPinionAngularVelocity,
    physicalShaftAngularVelocity, 0,
    'pinion and shaft physical angular velocity');

  const pinionInitialPosition = blocks.pinionGear.position.clone();
  for (let sample = 0; sample <= 400; sample += 1) {
    const time = geometry.demonstrationPeriod * sample / 400;
    const state = stateAtTime(time);
    near(state.drillShaftAngle, state.pinionLocalAngle, 0,
      'world/local shaft angle conversion');
    near(state.drillShaftAngularSpeed,
      state.pinionLocalAngularSpeed, 0,
      'world/local shaft speed conversion');
    near(state.featherPhaseError, 0, 0,
      'feather angular lock');
    model.update(time);
    vectorNear(blocks.pinionGear.position, pinionInitialPosition, 0,
      'pinion stays axially fixed');
    vectorNear(blocks.pinionGear.position, gearContact.apex, 0,
      'pinion remains on common apex');
    near(blocks.drillSlide.position.y, -state.feedDown, 0,
      'shaft axial slide');
    near(blocks.shaftSpinRotor.rotation.y, state.drillShaftAngle, 0,
      'shaft rendered spin');
    near(data.contacts.featherAndGroove.angularPhaseError, 0, 0,
      'rendered key phase');
    near(data.contacts.featherAndGroove.pinionAxialPositionError, 0, 0,
      'rendered fixed pinion');
  }
  assert.match(data.transmission.featherLaw, /equals pinion local angle/);
  assert.match(data.transmission.featherLaw, /identical/);
  assert.match(data.transmission.motionSuperposition,
    /continues rotating/);
  disposeModel(model.root);
});

test('movement 366 treadle and upper lever preserve the vertical connector and finite thrust-link lengths throughout the exact feed schedule', () => {
  const model = createMovementModel(catalog.movements[365]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  const stateAtPhase = (phase) => stateAtTime(
    phase * geometry.demonstrationPeriod,
  );
  const canonical = [
    [0, 0, 'treadle-raised-feed-dwell'],
    [0.08, 0, 'treadle-raised-feed-dwell'],
    [0.12, 0, 'operator-pressing-treadle-and-feeding-drill-down'],
    [0.245, 0.5, 'operator-pressing-treadle-and-feeding-drill-down'],
    [0.37, 1, 'drill-held-at-full-depth'],
    [0.50, 1, 'drill-held-at-full-depth'],
    [0.63, 1, 'operator-releasing-treadle-and-withdrawing-drill'],
    [0.755, 0.5, 'operator-releasing-treadle-and-withdrawing-drill'],
    [0.88, 0, 'treadle-raised-feed-dwell'],
    [0.96, 0, 'treadle-raised-feed-dwell'],
  ];
  for (const [phase, expectedFraction, expectedStage] of canonical) {
    const state = stateAtPhase(phase);
    near(state.depressionFraction, expectedFraction, 3e-15,
      `depression at ${phase}`);
    assert.equal(state.stage, expectedStage);
    assert.ok(Math.abs(state.verticalConnectorLengthError) < 5e-16);
    assert.ok(state.slotLineError < 1e-15);
    assert.equal(state.slotTravelExcess, 0);
    near(
      state.upperLeftPoint.x - state.lowerLeftPoint.x,
      geometry.upperLeverPivot.x - geometry.lowerLeverPivot.x,
      3e-16,
      'connector remains vertical in x',
    );
    near(
      state.upperLeftPoint.y - state.lowerLeftPoint.y,
      geometry.upperLeverPivot.y - geometry.lowerLeverPivot.y,
      5e-16,
      'connector fixed length in y',
    );
  }
  const raised = stateAtPhase(0);
  const halfPress = stateAtPhase(0.245);
  const depressed = stateAtPhase(0.5);
  near(raised.feedDown, 0, 0, 'raised feed');
  near(depressed.feedDown, geometry.maximumFeedDown, 0,
    'maximum feed');
  assert.ok(halfPress.feedDown > 0);
  assert.ok(halfPress.feedDown < geometry.maximumFeedDown);
  assert.ok(depressed.footPoint.y < raised.footPoint.y);
  near(raised.leverAngle, geometry.restLeverAngle, 0,
    'raised common lever angle');
  near(depressed.leverAngle, geometry.depressedLeverAngle, 0,
    'depressed common lever angle');
  near(stateAtPhase(0.5).feedVelocityDown, 0, 0,
    'lower dwell feed speed');
  near(stateAtPhase(0.95).feedVelocityDown, 0, 0,
    'upper dwell feed speed');
  assert.ok(stateAtPhase(0.245).feedVelocityDown > 0);
  assert.ok(stateAtPhase(0.755).feedVelocityDown < 0);

  const time = 0.245 * geometry.demonstrationPeriod;
  const step = 1e-6;
  const numericalFeedVelocity = (
    stateAtTime(time + step).feedDown
      - stateAtTime(time - step).feedDown
  ) / (2 * step);
  near(numericalFeedVelocity, stateAtTime(time).feedVelocityDown,
    5e-10, 'analytic feed velocity');
  assert.match(data.transmission.feedLaw, /keep.*connector rigid/);
  assert.match(data.transmission.feedLaw, /exact vertical/);
  disposeModel(model.root);
});

test('movement 366 renderer follows both independent inputs with exact contacts and no feed discontinuity over 1,200 frames', () => {
  const model = createMovementModel(catalog.movements[365]);
  const data = model.root.userData;
  const { animationTiming, blocks, geometry } = data;
  let maximumBevelSlip = 0;
  let maximumFeatherError = 0;
  let maximumVerticalLinkError = 0;
  let maximumThrustLinkError = 0;
  let largestFeedStep = 0;
  let previousFeed = null;
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
    near(blocks.inputRotor.rotation.x, state.driverAngle, 0,
      'rendered hand-crank angle');
    near(blocks.driverGear.userData.rotor.rotation.z,
      state.driverAngle, 0, 'rendered large bevel angle');
    near(blocks.pinionGear.userData.rotor.rotation.z,
      state.pinionLocalAngle, 0, 'rendered pinion angle');
    near(blocks.shaftSpinRotor.rotation.y,
      state.drillShaftAngle, 0, 'rendered drill spin');
    near(blocks.drillSlide.position.y,
      -state.feedDown, 0, 'rendered drill feed');
    near(blocks.lowerLeverRotor.rotation.z,
      state.leverAngle, 0, 'rendered treadle angle');
    near(blocks.upperLeverRotor.rotation.z,
      state.leverAngle, 0, 'rendered upper lever angle');
    maximumBevelSlip = Math.max(maximumBevelSlip,
      data.contacts.bevelMesh.pitchLineSlipSpeed);
    maximumFeatherError = Math.max(maximumFeatherError,
      Math.abs(data.contacts.featherAndGroove.angularPhaseError));
    maximumVerticalLinkError = Math.max(maximumVerticalLinkError,
      Math.abs(data.contacts.feedLinkage.verticalConnectorLengthError));
    maximumThrustLinkError = Math.max(maximumThrustLinkError,
      data.contacts.feedLinkage.slotLineError + data.contacts.feedLinkage.slotTravelExcess);
    if (previousFeed !== null) {
      largestFeedStep = Math.max(
        largestFeedStep,
        Math.abs(state.feedDown - previousFeed),
      );
    }
    previousFeed = state.feedDown;
    if (frame % 100 === 0) {
      model.root.updateMatrixWorld(true);
      model.root.traverse((object) => {
        assert.ok(object.matrixWorld.elements.every(Number.isFinite));
      });
    }
  }
  assert.ok(maximumBevelSlip < 3e-16);
  assert.equal(maximumFeatherError, 0);
  assert.ok(maximumVerticalLinkError < 5e-16);
  assert.ok(maximumThrustLinkError < 4e-16);
  assert.ok(largestFeedStep < 0.0022);
  assert.deepEqual([...stages].sort(), [
    'drill-held-at-full-depth',
    'operator-pressing-treadle-and-feeding-drill-down',
    'operator-releasing-treadle-and-withdrawing-drill',
    'treadle-raised-feed-dwell',
  ]);
  disposeModel(model.root);
});

test('movement 366 closes one crank turn, two drill turns, and one complete treadle cycle before movement 507', () => {
  const movement366 = catalog.movements[365];
  const movement507 = catalog.movements[506];
  const model366 = createMovementModel(movement366);
  const data = model366.root.userData;
  const { geometry, stateAtTime } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(geometry.demonstrationPeriod);

  near(closure.driverAngle - start.driverAngle, FULL_TURN, 0,
    'one hand-crank turn');
  near(closure.pinionLocalAngle - start.pinionLocalAngle,
    -FULL_TURN * geometry.bevelRatio, 0,
    'two opposite local pinion turns');
  near(closure.drillShaftAngle - start.drillShaftAngle,
    -FULL_TURN * geometry.bevelRatio, 0,
    'two physical drillshaft turns');
  near(closure.feedDown, start.feedDown, 0, 'feed closure');
  near(closure.leverAngle, start.leverAngle, 0, 'lever closure');
  near(closure.depressionFraction, start.depressionFraction, 0,
    'treadle closure');
  assert.equal(closure.stage, start.stage);

  const model507 = createMovementModel(movement507);
  assert.equal(movement366.id, 366);
  assert.equal(movement366.fidelity, 'authored');
  assert.equal(model366.root.userData.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model366.root);
});
