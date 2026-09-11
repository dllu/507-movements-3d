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

test('movement 394 is one closed endless rack, one fixed-axis pinion, two side grooves, and two unequal concentric flanges', () => {
  const movement = catalog.movements[393];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 394);
  assert.equal(movement.number, '394');
  assert.equal(movement.category, 'Rack & pinion');
  assert.equal(
    movement.archetype,
    'parsons-oblong-endless-internal-rack-pinion-with-unequal-concentric-flange-groove-handoffs',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-oblong-endless-internal-rack/);
  assert.match(data.mechanism, /one-fixed-axis-fourteen-tooth-pinion/);
  assert.match(data.mechanism, /upper-and-lower-straight-meshes-alternating/);
  assert.match(data.mechanism, /two-side-groove-handoffs/);
  assert.match(data.mechanism, /two-fast-concentric-flanges-of-different-diameters/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.inputs[0], /rack input rod/);
  assert.match(degreesOfFreedom.note, /exactly one upper mesh/);

  for (const component of [
    blocks.fixedFrame,
    blocks.outputRotor,
    blocks.rackCarrier,
  ]) assert.equal(component.parent, model.root);
  assert.equal(blocks.largeGroove.parent, blocks.rackCarrier);
  assert.equal(blocks.smallGroove.parent, blocks.rackCarrier);
  assert.equal(blocks.rackCarrier.userData.teeth.length, 46);
  assert.equal(blocks.outputRotor.userData.toothCount, 14);
  assert.notEqual(
    blocks.outputRotor.userData.largeFlange.geometry,
    blocks.outputRotor.userData.smallFlange.geometry,
  );

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'rigid-reciprocating-oblong-endless-internal-rack',
    'closed-oblong-body-of-endless-rack',
    'inward-facing-tooth-of-closed-endless-rack',
    'fixed-axis-pinion-with-two-fast-concentric-unequal-guide-flanges',
    'fourteen-tooth-output-pinion',
    'larger-concentric-flange-driving-one-pitch-right-handoff',
    'smaller-concentric-flange-driving-three-pitch-left-handoff',
    'right-large-flange-side-groove-for-concentric-flange',
    'left-small-flange-side-groove-for-concentric-flange',
    'white-index-making-unidirectional-pinion-spin-legible',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 394 preserves Brown topology and explicitly discloses unavailable animation and engineered groove phases', () => {
  const movement = catalog.movements[393];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate394;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_394.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /C\. Parsons.*patent device/);
  assert.match(movement.description, /reciprocating motion into rotary/);
  assert.match(movement.description, /endless rack provided with grooves/);
  assert.match(movement.description, /two concentric flanges of different diameters/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 10);
  assert.deepEqual(plate.endlessRackApproximateBoundsPixels,
    [39, 199, 384, 328]);
  assert.deepEqual(plate.pinionCenterPixels, [244, 254]);
  assert.equal(plate.pinionOuterRadiusPixels, 43);
  assert.equal(plate.inputRodCenterlinePixelsY, 271);
  assert.equal(plate.visibleInnerRackToothCountApproximate, 44);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence, /oblong closed inward-toothed rack/);
  assert.match(evidence.reconstructionDisclosure, /No official animation/);
  assert.match(evidence.reconstructionDisclosure, /one-plus-three-pitch/);
  disposeModel(model.root);
});

test('movement 394 gives its endless rack one exact common pitch around the complete oblong', () => {
  const model = createMovementModel(catalog.movements[393]);
  const data = model.root.userData;
  const { geometry } = data;
  const rack = data.blocks.rackCarrier;
  const pitchCurve = rack.userData.pitchCurve;

  near(pitchCurve.getLength(),
    geometry.endlessRackToothCount * geometry.circularPitch,
    2e-15, 'closed rack pitch perimeter');
  near(geometry.circularPitch,
    geometry.pinionPitchRadius * geometry.pinionAngularPitch,
    0, 'rack-pinion common circular pitch');
  for (let index = 1; index < rack.userData.teeth.length; index += 1) {
    near(
      rack.userData.teeth[index].userData.pitchDistance
        - rack.userData.teeth[index - 1].userData.pitchDistance,
      geometry.circularPitch,
      2e-15,
      'successive endless-rack tooth pitch',
    );
  }
  near(
    pitchCurve.getLength()
      - rack.userData.teeth.at(-1).userData.pitchDistance
      + rack.userData.teeth[0].userData.pitchDistance,
    geometry.circularPitch,
    2e-15,
    'closing tooth pitch',
  );
  disposeModel(model.root);
});

test('movement 394 selects exactly one upper mesh, large-flange groove, lower mesh, or small-flange groove', () => {
  const model = createMovementModel(catalog.movements[393]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;
  assert.match(transmission.activeSequence,
    /upper rack:5 pitches.*large flange:1 pitch.*lower rack:5 pitches.*small flange:3 pitches/);

  for (let sample = 0; sample < 16000; sample += 1) {
    const state = stateAtTime(
      timeline.cycleDuration * (sample + 0.5) / 16000,
    );
    assert.equal([
      state.upperMeshActive,
      state.largeFlangeActive,
      state.lowerMeshActive,
      state.smallFlangeActive,
    ].filter(Boolean).length, 1);
    if (state.upperMeshActive) {
      near(state.rackPosition.y, -geometry.crossShiftRadius, 0,
        'upper working rack level');
      assert.ok(state.rackVelocity.x <= 0);
    } else if (state.lowerMeshActive) {
      near(state.rackPosition.y, geometry.crossShiftRadius, 0,
        'lower working rack level');
      assert.ok(state.rackVelocity.x >= 0);
    } else if (state.largeFlangeActive) {
      assert.match(state.stage, /right-groove-large-flange/);
    } else assert.match(state.stage, /left-groove-small-flange/);
  }
  disposeModel(model.root);
});

test('movement 394 closes both rack meshes and both unequal-flange rolling handoffs without slip', () => {
  const model = createMovementModel(catalog.movements[393]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;
  assert.match(transmission.rackMeshLaw, /upper: omega=-xDot\/R/);
  assert.match(transmission.flangeLaw, /pi\*delta\/r_flange/);

  for (let sample = -12000; sample <= 24000; sample += 1) {
    const state = stateAtTime(
      timeline.cycleDuration * sample / 12000,
    );
    near(state.activeRollingResidual, 0, 5e-16,
      'active pitch/flange rolling residual');
    if (state.upperMeshActive) {
      near(
        state.rackVelocity.x
          + geometry.pinionPitchRadius * state.outputAngularSpeed,
        0,
        5e-16,
        'upper rack no-slip velocity',
      );
    } else if (state.lowerMeshActive) {
      near(
        state.rackVelocity.x
          - geometry.pinionPitchRadius * state.outputAngularSpeed,
        0,
        5e-16,
        'lower rack no-slip velocity',
      );
    } else if (state.largeFlangeActive) {
      near(
        state.relativeCenterSpeed,
        geometry.largeFlangeRadius * state.outputAngularSpeed,
        5e-16,
        'large flange no-slip velocity',
      );
    } else {
      near(
        state.relativeCenterSpeed,
        geometry.smallFlangeRadius * state.outputAngularSpeed,
        5e-16,
        'small flange no-slip velocity',
      );
    }
  }
  disposeModel(model.root);
});

test('movement 394 unequal flange radii produce their exact one- and three-tooth crossover advances', () => {
  const model = createMovementModel(catalog.movements[393]);
  const data = model.root.userData;
  const { blocks, constraintResiduals, geometry, transmission } = data;
  assert.ok(geometry.largeFlangeRadius > geometry.smallFlangeRadius);
  near(
    geometry.largeFlangeRadius / geometry.smallFlangeRadius,
    3,
    5e-16,
    'three-to-one flange diameter ratio',
  );
  near(
    Math.PI * geometry.crossShiftRadius / geometry.largeFlangeRadius,
    geometry.largeHandoffPitches * geometry.pinionAngularPitch,
    6e-17,
    'large flange one-pitch handoff',
  );
  near(
    Math.PI * geometry.crossShiftRadius / geometry.smallFlangeRadius,
    geometry.smallHandoffPitches * geometry.pinionAngularPitch,
    3e-16,
    'small flange three-pitch handoff',
  );
  assert.equal(blocks.largeGroove.userData.flangeRadius,
    geometry.largeFlangeRadius);
  assert.equal(blocks.smallGroove.userData.flangeRadius,
    geometry.smallFlangeRadius);
  near(
    blocks.largeGroove.userData.outerRadius
      - blocks.largeGroove.userData.centerRadius,
    geometry.largeFlangeRadius,
    2e-16,
    'large groove outer-wall offset',
  );
  near(
    blocks.smallGroove.userData.outerRadius
      - blocks.smallGroove.userData.centerRadius,
    geometry.smallFlangeRadius,
    2e-16,
    'small groove outer-wall offset',
  );
  near(constraintResiduals.largeFlangePitchHandoff, 0, 6e-17,
    'reported large-flange closure');
  near(constraintResiduals.smallFlangePitchHandoff, 0, 3e-16,
    'reported small-flange closure');
  assert.match(transmission.outputClosure, /5\+1\+5\+3/);
  disposeModel(model.root);
});

test('movement 394 converts one rack reciprocation into exactly one nonreversing pinion turn', () => {
  const model = createMovementModel(catalog.movements[393]);
  const data = model.root.userData;
  const { constraintResiduals, stateAtTime, timeline } = data;
  for (const [name, residual] of Object.entries(constraintResiduals)) {
    near(residual, 0, 3e-16, name);
  }

  let previousAngle = -Infinity;
  for (let sample = -16000; sample <= 32000; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 16000);
    assert.ok(state.outputAngle >= previousAngle - 4e-15);
    assert.ok(state.outputAngularSpeed >= -1e-15);
    previousAngle = state.outputAngle;
  }
  for (let cycle = -8; cycle <= 8; cycle += 1) {
    const start = stateAtTime(timeline.cycleDuration * (cycle + 0.137));
    const end = stateAtTime(timeline.cycleDuration * (cycle + 1.137));
    near(end.outputAngle - start.outputAngle, FULL_TURN, 5e-15,
      'one output turn per rack cycle');
    near(end.rackPosition.distanceTo(start.rackPosition), 0, 3e-15,
      'rack trajectory closes');
    near(end.rackVelocity.distanceTo(start.rackVelocity), 0, 4e-15,
      'rack velocity closes');
  }
  disposeModel(model.root);
});

test('movement 394 update keeps the fixed shaft at the active groove center and reports only the active contact', () => {
  const model = createMovementModel(catalog.movements[393]);
  const data = model.root.userData;
  const { blocks, stateAtTime, timeline } = data;

  for (const phase of [0.17, 0.44, 0.68, 0.94]) {
    const time = timeline.cycleDuration * phase;
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.rackCarrier.position.x, expected.rackPosition.x, 0,
      'rack x visual update');
    near(blocks.rackCarrier.position.y, expected.rackPosition.y, 0,
      'rack y visual update');
    near(blocks.outputRotor.rotation.z, expected.outputAngle, 0,
      'pinion angle visual update');
    near(
      expected.relativeShaftCenter.clone()
        .add(expected.rackPosition).length(),
      0,
      0,
      'fixed shaft expressed in moving-rack coordinates',
    );
    const contacts = [
      data.contacts.upperRackToPinion,
      data.contacts.largeFlangeToRightSideGroove,
      data.contacts.lowerRackToPinion,
      data.contacts.smallFlangeToLeftSideGroove,
    ];
    assert.equal(contacts.filter(({ active }) => active).length, 1);
    for (const contact of contacts) {
      if (!contact.active) continue;
      if ('pitchLineVelocityError' in contact) {
        near(contact.pitchLineVelocityError, 0, 5e-16,
          'updated rack mesh closure');
      } else {
        near(contact.centerError, 0, 0,
          'updated flange groove center closure');
        near(contact.rollingSpeedError, 0, 5e-16,
          'updated flange rolling closure');
      }
    }
  }
  disposeModel(model.root);
});

test('movement 394 factory is isolated before movement 507', () => {
  const model394 = createMovementModel(catalog.movements[393]);
  const model507 = createMovementModel(catalog.movements[506]);
  assert.equal(model394.root.userData.fidelity, 'authored');
  assert.equal(
    model394.root.userData.archetype,
    'parsons-oblong-endless-internal-rack-pinion-with-unequal-concentric-flange-groove-handoffs',
  );
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(catalog.movements[506].fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model394.root);
  disposeModel(model507.root);
});
