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

function vector2Near(actual, expected, tolerance, message) {
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

test('movement 391 is two weighted pivoted racks on one crosshead, two fixed guide grooves, and one output cog wheel', () => {
  const movement = catalog.movements[390];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 391);
  assert.equal(movement.number, '391');
  assert.equal(movement.category, 'Rack & pinion');
  assert.equal(
    movement.archetype,
    'dual-weighted-pivoted-racks-closed-guide-grooves-alternating-stroke-unidirectional-pinion',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-piston-rod-crosshead/);
  assert.match(data.mechanism, /two-weighted-pivoted-racks-A-and-A1/);
  assert.match(data.mechanism, /opposed-fixed-closed-guide-grooves-b/);
  assert.match(data.mechanism, /A1-meshes-on-ascent/);
  assert.match(data.mechanism, /A-meshes-on-descent/);
  assert.match(data.mechanism, /elbow-lever-C/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.inputs[0], /piston-rod stroke/);
  assert.match(degreesOfFreedom.note, /passive branch dynamics are not solved/);

  for (const component of [
    blocks.crosshead,
    blocks.elbowLever,
    blocks.leftGuide,
    blocks.leftRack,
    blocks.outputGear,
    blocks.rightGuide,
    blocks.rightRack,
    blocks.spring,
    blocks.springAnchorBoss,
  ]) assert.ok(component.parent === model.root, `${component.userData.role} parent`);
  assert.ok(blocks.fixedFrame.parent === null, 'source presentation removes fixedFrame');
  assert.ok(blocks.crossheadBeam.parent === blocks.crosshead, 'blocks.crossheadBeam parent');
  // Brown's plate stops at the crosshead; the presentation detaches the input rod.
  assert.ok(blocks.pistonRod.parent === null, 'source presentation removes pistonRod');
  assert.equal(blocks.leftRack.userData.teeth.length, 17);
  assert.equal(blocks.rightRack.userData.teeth.length, 17);
  assert.equal(blocks.outputGear.userData.toothCount, 20);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'left-rack-A-weighted-pivoted-rack',
    'right-rack-A1-weighted-pivoted-rack',
    'left-fixed-closed-guide-groove-b',
    'right-fixed-closed-guide-groove-b',
    'continuous-counterclockwise-fixed-axis-output-cog-wheel',
    'one-reciprocating-piston-rod-crosshead-carrying-both-rack-pivots',
    'spring-returned-elbow-lever-C-for-right-upper-guide-angle',
    'tension-spring-d-returning-elbow-lever-C',
  ]) assert.ok(roles.includes(role), role);
  assert.ok(!roles.some((role) => /(?:^|-)white-/.test(role)), 'no white indices remain');
  disposeModel(model.root);
});

test('movement 391 records source topology and explicitly discloses its unavailable source animation', () => {
  const movement = catalog.movements[390];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate391;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_391.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /weighted racks, A, A1/);
  assert.match(movement.description, /one rack operates.*ascending/i);
  assert.match(movement.description, /other in descending/i);
  assert.match(movement.description, /elbow lever, C, and spring/i);
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
  assert.deepEqual(plate.gearCenterPixels, [249, 287]);
  assert.equal(plate.gearOuterRadiusPixels, 62);
  assert.deepEqual(plate.leftLowerPivotPixels, [170, 480]);
  assert.deepEqual(plate.rightLowerPivotPixels, [321, 480]);
  assert.deepEqual(plate.leftGuidePinPixels, [117, 193]);
  assert.deepEqual(plate.rightGuidePinPixels, [419, 174]);
  assert.deepEqual(plate.elbowLeverUpperPivotPixels, [379, 26]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence, /D-shaped guide grooves/);
  assert.match(evidence.reconstructionDisclosure, /no official animation/);
  assert.match(evidence.reconstructionDisclosure, /independently engineered/);
  disposeModel(model.root);
});

test('movement 391 guide grooves are the exact closed loci of the two rigid rack pins', () => {
  const model = createMovementModel(catalog.movements[390]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const rigidPinRadius = Math.hypot(geometry.guideArm, geometry.guideY);

  for (let sample = -2400; sample <= 4800; sample += 1) {
    const phase = sample / 2400;
    const state = stateAtTime(timeline.cycleDuration * phase);
    const curvePhase = ((phase % 1) + 1) % 1;
    const leftCurvePoint = data.blocks.guideCurves.left.getPoint(curvePhase);
    const rightCurvePoint = data.blocks.guideCurves.right.getPoint(curvePhase);
    vector2Near(
      state.leftRack.guidePin,
      new THREE.Vector2(leftCurvePoint.x, leftCurvePoint.y),
      0,
      'left pin lies on left fixed guide centerline',
    );
    vector2Near(
      state.rightRack.guidePin,
      new THREE.Vector2(rightCurvePoint.x, rightCurvePoint.y),
      0,
      'right pin lies on right fixed guide centerline',
    );
    near(
      state.leftRack.guidePin.distanceTo(state.leftRack.pivot),
      rigidPinRadius,
      3e-15,
      'left rack pin radius is rigid',
    );
    near(
      state.rightRack.guidePin.distanceTo(state.rightRack.pivot),
      rigidPinRadius,
      3e-15,
      'right rack pin radius is rigid',
    );
    near(state.leftRack.pivot.y, state.crossheadY, 0,
      'left lower pivot follows crosshead');
    near(state.rightRack.pivot.y, state.crossheadY, 0,
      'right lower pivot follows crosshead');
  }

  for (const curve of Object.values(data.blocks.guideCurves)) {
    near(curve.getPoint(0).distanceTo(curve.getPoint(1)), 0, 0,
      'guide centerline closes');
  }
  disposeModel(model.root);
});

test('movement 391 alternates exactly one working rack and exchanges mesh only at zero-speed guide corners', () => {
  const model = createMovementModel(catalog.movements[390]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;

  for (let sample = 0; sample < 12000; sample += 1) {
    const phase = (sample + 0.5) / 12000;
    const state = stateAtTime(timeline.cycleDuration * phase);
    assert.equal(
      Number(state.leftRack.engaged) + Number(state.rightRack.engaged),
      state.activeDrive.includes('working') ? 1 : 0,
    );
    if (state.leftRack.engaged) {
      near(state.leftRack.rackAngle, 0, 0,
        'rack A vertical on working descent');
      near(state.rightRack.rackAngle, -geometry.outwardRackAngle, 0,
        'rack A1 on outer return branch during descent');
      assert.ok(state.crossheadVelocity < 0);
    } else if (state.rightRack.engaged) {
      near(state.rightRack.rackAngle, 0, 0,
        'rack A1 vertical on working ascent');
      near(state.leftRack.rackAngle, geometry.outwardRackAngle, 0,
        'rack A on outer return branch during ascent');
      assert.ok(state.crossheadVelocity > 0);
    } else {
      near(state.crossheadVelocity, 0, 0,
        'piston stationary throughout guide crossover');
      near(state.outputAngularSpeed, 0, 0,
        'cog wheel stationary throughout guide crossover');
    }
  }

  const topMiddle = stateAtTime(
    timeline.cycleDuration
      * (geometry.ascentEnd + geometry.topCrossoverEnd) / 2,
  );
  // C's link carries the pin past the crossover midpoint and lets go before
  // the crossover ends.
  assert.equal(topMiddle.elbowAssist.active, true);
  assert.equal(stateAtTime(timeline.cycleDuration * geometry.topCrossoverEnd).elbowAssist.contact, false);
  near(topMiddle.leftRack.outwardFraction, 0.5, 4e-15,
    'left top crossover midpoint');
  near(topMiddle.rightRack.outwardFraction, 0.5, 4e-15,
    'right top crossover midpoint');
  const bottomMiddle = stateAtTime(
    timeline.cycleDuration * (geometry.descentEnd + 1) / 2,
  );
  assert.equal(bottomMiddle.elbowAssist.active, false);
  near(bottomMiddle.leftRack.outwardFraction, 0.5, 4e-15,
    'left bottom crossover midpoint');
  near(bottomMiddle.rightRack.outwardFraction, 0.5, 4e-15,
    'right bottom crossover midpoint');
  disposeModel(model.root);
});

test('movement 391 active rack pitch-line velocity and tooth phase close exactly on both strokes', () => {
  const model = createMovementModel(catalog.movements[390]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;
  assert.match(transmission.activeMeshLaw, /theta=DeltaY\/R/);
  assert.match(transmission.activeMeshLaw, /rack A descent/);

  for (let cycle = -4; cycle <= 4; cycle += 1) {
    for (let sample = 1; sample < 1000; sample += 1) {
      const ascentPhase = geometry.ascentEnd * sample / 1000;
      const ascent = stateAtTime(
        timeline.cycleDuration * (cycle + ascentPhase),
      );
      near(ascent.rightRack.toothPhaseError, 0, 4e-15,
        'rack A tooth phase');
      near(
        ascent.crossheadVelocity
          - geometry.pinionPitchRadius * ascent.outputAngularSpeed,
        0,
        5e-16,
        'rack A pitch-line velocity closure',
      );

      const descentPhase = geometry.topCrossoverEnd
        + (geometry.descentEnd - geometry.topCrossoverEnd)
          * sample / 1000;
      const descent = stateAtTime(
        timeline.cycleDuration * (cycle + descentPhase),
      );
      near(descent.leftRack.toothPhaseError, 0, 6e-15,
        'rack A1 tooth phase');
      near(
        descent.crossheadVelocity
          + geometry.pinionPitchRadius * descent.outputAngularSpeed,
        0,
        5e-16,
        'rack A1 pitch-line velocity closure',
      );
    }
  }
  disposeModel(model.root);
});

test('movement 391 advances eight tenths of a counterclockwise output turn per piston cycle without reversal', () => {
  const model = createMovementModel(catalog.movements[390]);
  const data = model.root.userData;
  const { constraintResiduals, geometry, stateAtTime, timeline,
    transmission } = data;

  for (const [name, residual] of Object.entries(constraintResiduals)) {
    near(residual, 0, 0, name);
  }
  near(geometry.rackPitchesPerStroke, 8, 0,
    'eight exact rack pitches per half-cycle');
  near(geometry.stroke / geometry.pinionPitchRadius, .8*Math.PI, 0,
    'four tenths of a turn per working stroke');
  assert.match(transmission.fullCycleLaw, /1.6 pi/);
  assert.match(transmission.pitchLaw, /stroke=8\*p/);

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
    near(end.outputAngle - start.outputAngle, .8*FULL_TURN, 1e-14,
      'eight tenths of a counterclockwise output turn per cycle');
    near(end.crossheadY, start.crossheadY, 4e-15,
      'crosshead repeats after one cycle');
    near(end.leftRack.rackAngle, start.leftRack.rackAngle, 1e-15,
      'left guide state repeats');
    near(end.rightRack.rackAngle, start.rightRack.rackAngle, 1e-15,
      'right guide state repeats');
  }
  disposeModel(model.root);
});

test('movement 391 elbow lever C loads on approach, assists the upper corner, then releases', () => {
  const model = createMovementModel(catalog.movements[390]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime, timeline } = data;
  const topMiddlePhase = geometry.ascentEnd + .25*(geometry.topCrossoverEnd-geometry.ascentEnd);
  const inactive = stateAtTime(timeline.cycleDuration * 0.20);
  const active = stateAtTime(timeline.cycleDuration * topMiddlePhase);
  const bottom = stateAtTime(
    timeline.cycleDuration * (geometry.descentEnd + 1) / 2,
  );
  assert.equal(inactive.elbowAssist.active, false);
  assert.equal(active.elbowAssist.active, true);
  assert.equal(bottom.elbowAssist.active, false);
  assert.ok(active.elbowAssist.springDeflection > 0);
  assert.ok(active.rightRack.outwardFraction > 0 && active.rightRack.outwardFraction < .5, 'assistance precedes release');

  model.update(timeline.cycleDuration * topMiddlePhase);
  assert.equal(blocks.leverContactIndex.visible, true);
  near(blocks.elbowLever.rotation.z, active.elbowAssist.leverAngle, 0,
    'lever update');
  assert.ok(blocks.spring.userData.currentLength > 0);
  const activeSpringLength = blocks.spring.userData.currentLength;
  model.update(timeline.cycleDuration * 0.20);
  assert.equal(blocks.leverContactIndex.visible, false);
  assert.notEqual(blocks.spring.userData.currentLength, activeSpringLength);
  disposeModel(model.root);
});

test('movement 391 update places both guide-pin axes through their fixed slots and exposes active contacts', () => {
  const model = createMovementModel(catalog.movements[390]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime, timeline } = data;

  for (const phase of [0.12, 0.46, 0.67, 0.96]) {
    const time = timeline.cycleDuration * phase;
    const expected = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.crosshead.position.y, expected.crossheadY, 0,
      'crosshead visual update');
    near(blocks.outputGear.rotation.z, expected.outputAngle, 0,
      'output wheel visual update');
    for (const [rack, expectedRack, curve] of [
      [blocks.leftRack, expected.leftRack, blocks.guideCurves.left],
      [blocks.rightRack, expected.rightRack, blocks.guideCurves.right],
    ]) {
      const worldPin = rack.userData.guidePin.getWorldPosition(
        new THREE.Vector3(),
      );
      const slotPoint = curve.getPoint(phase);
      near(worldPin.x, slotPoint.x, 2e-15, 'pin x on slot');
      near(worldPin.y, slotPoint.y, 2e-15, 'pin y on slot');
      assert.ok(
        Math.abs(worldPin.z - geometry.guidePlaneZ)
          < 1.05 / 2,
        'guide plane intersects pin axis',
      );
      near(rack.rotation.z, expectedRack.rackAngle, 0,
        'rack-angle visual update');
    }
    assert.equal(
      data.contacts.leftRackAToCogWheel.active,
      expected.leftRack.engaged,
    );
    assert.equal(
      data.contacts.rightRackA1ToCogWheel.active,
      expected.rightRack.engaged,
    );
    if (expected.leftRack.engaged) {
      near(data.contacts.leftRackAToCogWheel.pitchLineVelocityError,
        0, 5e-16, 'updated left contact velocity');
    }
    if (expected.rightRack.engaged) {
      near(data.contacts.rightRackA1ToCogWheel.pitchLineVelocityError,
        0, 5e-16, 'updated right contact velocity');
    }
  }
  disposeModel(model.root);
});

test('movement 391 factory is isolated to its catalog ID', () => {
  const model391 = createMovementModel(catalog.movements[390]);
  const model507 = createMovementModel(catalog.movements[506]);
  assert.equal(model391.root.userData.fidelity, 'authored');
  assert.equal(
    model391.root.userData.archetype,
    'dual-weighted-pivoted-racks-closed-guide-grooves-alternating-stroke-unidirectional-pinion',
  );
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  disposeModel(model391.root);
  disposeModel(model507.root);
});
