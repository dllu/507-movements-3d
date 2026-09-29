import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const ARCHETYPE =
  'thermal-air-circulation-proposal-with-reversed-archimedean-screw-bubble-wheel-exact-gearing-and-unmaintained-temperature-gradient';
const FULL_TURN = Math.PI * 2;

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

function movementModel() {
  const movement = catalog.movements[468];
  return { model: createMovementModel(movement), movement };
}

test('movement 469 is the two-temperature cistern proposal with one reversed screw, air path, geared wheel, and explicit energy caveat', () => {
  const { model, movement } = movementModel();
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, energyAudit } = data;

  assert.equal(movement.id, 469);
  assert.equal(movement.number, '469');
  assert.equal(movement.title, 'French temperature-difference air machine');
  assert.equal(movement.category, 'Pumps & pneumatics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.coldTank.parent, model.root);
  assert.equal(blocks.warmTank.parent, model.root);
  assert.notEqual(blocks.coldTank, blocks.warmTank);
  assert.equal(blocks.screwRotor.parent, blocks.screwMount);
  assert.equal(blocks.screwFlight.parent, blocks.screwRotor);
  assert.equal(blocks.inputBevel.parent, blocks.screwRotor);
  assert.equal(blocks.transferShaftRotor.parent.parent, model.root);
  assert.equal(blocks.outputBevel.parent, blocks.transferShaftRotor);
  assert.equal(blocks.facePinion.parent, blocks.transferShaftRotor);
  assert.equal(blocks.transferShaft.parent, blocks.transferShaftRotor);
  assert.equal(blocks.waterWheelRotor.parent, blocks.waterWheelAssembly);
  assert.equal(blocks.faceGear.parent, blocks.waterWheelRotor);
  assert.equal(blocks.wheelHood.parent, model.root);
  assert.equal(blocks.airConduit.parent, model.root);
  assert.equal(blocks.airBubbles.length, data.geometry.bubbleCount);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.screwAndWheelIndependent, false);
  assert.equal(degreesOfFreedom.transferShaftAndWheelIndependent, false);
  assert.equal(energyAudit.selfSustainingClaimAccepted, false);
  assert.equal(energyAudit.externalHeatRequiredToRestoreGradient, true);
  assert.equal(energyAudit.thermalResetIsPartOfHistoricalMachine, false);
  disposeModel(model.root);
});

test('movement 469 source record preserves Brown’s screw direction, full air route, temperature claim, and stated missing heat source', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.brownPlate469;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_469.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.plate, 'Brown 1868, Movement 469');
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(sourceAnimation.sourcePrescribedNormalizedTiming, false);
  assert.deepEqual(plate.approximateInclinedScrewBoundsPixels,
    [102, 245, 194, 174]);
  assert.deepEqual(plate.approximateWaterWheelBoundsPixels,
    [286, 246, 123, 126]);
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('opposite its water-raising direction')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('rises through a tube, crosses, descends')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('air-volume increase with temperature')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('maintaining the temperature difference is not given')));
  assert.match(evidence.engravingEvidence, /two open cisterns/i);
  assert.match(evidence.reconstructionDisclosure, /a pair of 24-tooth shared-apex mitre bevels.*48-tooth face gear/i);
  assert.match(evidence.reconstructionDisclosure, /explicitly adds external heat/i);
  disposeModel(model.root);
});

test('movement 469 screw flight has a consistent pitch and operates opposite the declared water-raising direction', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;

  near(geometry.screwLowerPoint.distanceTo(geometry.screwUpperPoint),
    geometry.screwLength, 1e-12, 'screw endpoint length');
  vectorNear(geometry.screwAxis,
    geometry.screwUpperPoint.clone().sub(geometry.screwLowerPoint).normalize(),
    1e-12, 'screw axis');
  near(geometry.screwPitch * geometry.screwFlightTurns,
    geometry.screwLength, 1e-12, 'flight pitch closure');
  near(geometry.screwAxis.dot(new THREE.Vector3(0, 0, 1)),
    0, 1e-12, 'screw lies in engraving plane');
  assert.equal(geometry.waterRaisingRotationSign, 1);
  assert.equal(geometry.operatingScrewRotationSign, -1);

  for (const phase of [0.08, 0.21, 0.39, 0.57]) {
    const state = stateAtPhase(phase);
    assert.ok(state.screwAngularVelocity < 0,
      `screw must reverse water raising at ${phase}`);
    assert.ok(state.airAxialVelocity < 0,
      `air must move toward lower receiver at ${phase}`);
    near(state.airAxialDisplacement,
      geometry.screwPitch * state.screwAngle / FULL_TURN,
      1e-12, `screw axial displacement at ${phase}`);
    near(state.airTransportDistance, -state.airAxialDisplacement,
      1e-12, `positive conduit transport at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 469 head mitre and wheel face gear on the inclined shaft derive every wheel speed from the screw', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;

  // Head apex, shaft S and hub apex: S is perpendicular to the screw, lies
  // in the engraving plane and meets the wheel axis at the hub apex.
  near(geometry.transferShaftDirection.dot(geometry.screwAxis), 0, 1e-12, 'S perpendicular to screw');
  near(geometry.transferShaftDirection.z, 0, 1e-12, 'S in engraving plane');
  vectorNear(geometry.transferCenter.clone().addScaledVector(geometry.transferShaftDirection, geometry.transferShaftLength),
    geometry.wheelCenter, 1e-12, 'S reaches the wheel axis');
  vectorNear(geometry.screwUpperPoint.clone().addScaledVector(geometry.screwAxis, geometry.bevelApexExtension),
    geometry.transferCenter, 1e-12, 'head apex on the screw axis');
  near(geometry.screwAxis.dot(new THREE.Vector3(0, 0, 1)),
    0, 1e-12, 'screw and wheel axes are perpendicular');

  for (const phase of [0.07, 0.19, 0.36, 0.52, 0.64]) {
    const state = stateAtPhase(phase);
    near(
      state.screwAngularVelocity * geometry.screwBevelPitchRadius
        - state.bevelOutputAngularVelocity
          * geometry.outputBevelPitchRadius,
      0,
      2e-12,
      `head mitre no slip at ${phase}`,
    );
    near(state.bevelOutputAngularVelocity * geometry.facePinionPitchRadius
      + state.waterWheelAngularVelocity * geometry.faceGearPitchRadius,
    0, 2e-12, `face gear no slip at ${phase}`);
    near(state.waterWheelAngularVelocity / state.screwAngularVelocity,
      -geometry.facePinionTeeth / geometry.faceGearTeeth, 1e-12,
      `complete train ratio at ${phase}`);
    assert.ok(state.waterWheelAngularVelocity > 0,
      `right-side bubbles require counterclockwise wheel motion at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 469 analytic screw, bevel, and water-wheel rates match finite differences', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const timeStep = 1e-4;

  for (const phase of [0.09, 0.22, 0.38, 0.55, 0.64]) {
    const time = phase * geometry.cycleDuration;
    const center = stateAtTime(time);
    const before = stateAtTime(time - timeStep);
    const after = stateAtTime(time + timeStep);
    for (const [angleField, velocityField, accelerationField] of [
      ['screwAngle', 'screwAngularVelocity', 'screwAngularAcceleration'],
      ['bevelOutputAngle', 'bevelOutputAngularVelocity',
        'bevelOutputAngularAcceleration'],
      ['waterWheelAngle', 'waterWheelAngularVelocity',
        'waterWheelAngularAcceleration'],
    ]) {
      near((after[angleField] - before[angleField]) / (2 * timeStep),
        center[velocityField], 2e-8,
        `${velocityField} at ${phase}`);
      near((after[angleField] - 2 * center[angleField]
        + before[angleField]) / timeStep ** 2,
      center[accelerationField], 5e-6,
      `${accelerationField} at ${phase}`);
    }
  }
  disposeModel(model.root);
});

test('movement 469 ideal-gas bubble volume and radius use absolute temperature without exaggeration', () => {
  const { model } = movementModel();
  const { bubbleStateAt, geometry, stateAtPhase } = model.root.userData;

  for (const phase of [0, 0.12, 0.31, 0.53, 0.68, 0.90, 0.999]) {
    const state = stateAtPhase(phase);
    near(state.warmToColdAbsoluteTemperatureRatio,
      state.warmTemperatureKelvin / state.coldTemperatureKelvin,
      1e-14, `temperature ratio at ${phase}`);
    near(state.warmedAirVolumeCubicMeter / geometry.referenceAirVolumeCubicMeter,
      state.warmToColdAbsoluteTemperatureRatio, 1e-14,
      `constant-pressure ideal-gas volume at ${phase}`);
    near(state.expansionBoundaryWorkJoule,
      geometry.ambientPressurePascal
        * (state.warmedAirVolumeCubicMeter
          - geometry.referenceAirVolumeCubicMeter),
      1e-12, `expansion boundary work at ${phase}`);
    for (let index = 0; index < geometry.bubbleCount; index += 1) {
      const bubble = bubbleStateAt(index, state);
      near(bubble.volumeRatio,
        bubble.localAirTemperatureKelvin / state.coldTemperatureKelvin,
        1e-13, `bubble ${index} volume at ${phase}`);
      near(bubble.radiusScale ** 3, bubble.volumeRatio, 2e-14,
        `bubble ${index} radius at ${phase}`);
    }
  }
  disposeModel(model.root);
});

test('movement 469 air path joins the pressure tube to the free rise tangentially and advances at screw-derived arc speed', () => {
  const { model } = movementModel();
  const {
    airPath,
    bubbleRiseCurve,
    bubbleStateAt,
    geometry,
    pressurePipeCurve,
    stateAtTime,
  } = model.root.userData;
  const pipeExitTangent = pressurePipeCurve.getTangent(1).normalize();
  const riseEntryTangent = bubbleRiseCurve.getTangent(0).normalize();
  assert.ok(pipeExitTangent.dot(riseEntryTangent) > 0.999999,
    'bubble trajectory must not kink at the pipe exit');
  near(airPath.getLength(), geometry.airPathLength, 1e-9,
    'combined air path length');
  near(geometry.pressurePipeLength + geometry.bubbleRiseLength,
    geometry.airPathLength, 1e-9, 'pipe plus rise lengths');

  const timeStep = 1e-4;
  for (const phase of [0.16, 0.28, 0.45, 0.58]) {
    const time = phase * geometry.cycleDuration;
    const centerState = stateAtTime(time);
    const beforeState = stateAtTime(time - timeStep);
    const afterState = stateAtTime(time + timeStep);
    for (let index = 0; index < geometry.bubbleCount; index += 1) {
      const center = bubbleStateAt(index, centerState);
      const before = bubbleStateAt(index, beforeState);
      const after = bubbleStateAt(index, afterState);
      const rawDifference = after.pathDistance - before.pathDistance;
      if (Math.abs(rawDifference) < geometry.airPathLength / 2) {
        near(rawDifference / (2 * timeStep), centerState.airPathSpeed,
          2e-8, `bubble ${index} arc speed at ${phase}`);
      }
      vectorNear(center.position, airPath.getPointAt(center.pathFraction),
        2e-12, `bubble ${index} lies on path at ${phase}`);
    }
  }
  disposeModel(model.root);
});

test('movement 469 finite temperature gradient decays to equilibrium and cannot sustain the stopped machine', () => {
  const { model } = movementModel();
  const { energyAudit, geometry, stateAtPhase } = model.root.userData;
  const initial = stateAtPhase(0);
  const moving = stateAtPhase(0.34);
  const exhausted = stateAtPhase(geometry.operationEndPhase);
  const stopped = stateAtPhase(0.75);
  const externalReset = stateAtPhase(0.92);

  near(initial.temperatureDifferenceKelvin,
    geometry.initialTemperatureDifferenceKelvin, 1e-12,
    'initial temperature difference');
  near(initial.screwAngularVelocity, 0, 1e-12, 'initial rest');
  assert.ok(moving.temperatureDifferenceKelvin > 0);
  assert.ok(Math.abs(moving.screwAngularVelocity) > 0);
  near(exhausted.temperatureDifferenceKelvin, 0, 1e-12,
    'equilibrated baths');
  near(exhausted.screwAngularVelocity, 0, 1e-12,
    'machine stops at equilibrium');
  near(stopped.temperatureDifferenceKelvin, 0, 1e-12,
    'stopped hold has no gradient');
  near(stopped.screwAngularVelocity, 0, 1e-12,
    'stopped hold has no motion');
  assert.ok(externalReset.temperatureDifferenceKelvin > 0);
  near(externalReset.screwAngularVelocity, 0, 1e-12,
    'external thermal reset does not drive shaft');
  assert.match(externalReset.regime, /external-heat-reset/i);
  assert.equal(energyAudit.brownIdentifiesMissingTemperatureMaintenance,
    true);
  assert.equal(energyAudit.lossesWouldReduceAvailableOutput, true);
  disposeModel(model.root);
});

test('movement 469 renderer applies all constrained rotor angles, smooth bubble states, bath colors, and thermometers', () => {
  const { model } = movementModel();
  const { blocks, bubbleStateAt, geometry, stateAtPhase } =
    model.root.userData;

  for (const phase of [0, 0.11, 0.29, 0.52, 0.68, 0.76, 0.91, 0.999]) {
    const state = stateAtPhase(phase);
    model.update(phase * geometry.cycleDuration);
    near(blocks.screwRotor.rotation.y, state.screwAngle, 1e-12,
      `screw render angle at ${phase}`);
    near(blocks.transferShaftRotor.rotation.z, state.bevelOutputAngle, 1e-12,
      `shaft S render angle at ${phase}`);
    near(blocks.waterWheelRotor.rotation.z, state.waterWheelAngle, 1e-12,
      `wheel render angle at ${phase}`);
    blocks.airBubbles.forEach((bubble, index) => {
      const bubbleState = bubbleStateAt(index, state);
      vectorNear(bubble.position, bubbleState.position, 2e-12,
        `bubble ${index} position at ${phase}`);
      near(bubble.scale.x,
        bubbleState.radiusScale * bubbleState.fade, 1e-12,
        `bubble ${index} scale at ${phase}`);
      assert.equal(bubble.visible, bubbleState.visible);
    });
    assert.ok(blocks.thermometerColumns[0].scale.y > 0);
    assert.ok(blocks.thermometerColumns[1].scale.y > 0);
    if (state.temperatureContrast === 0) {
      near(blocks.coldWater.material.color.r,
        blocks.warmWater.material.color.r, 1e-12,
      `equilibrium water red channel at ${phase}`);
      near(blocks.coldWater.material.color.g,
        blocks.warmWater.material.color.g, 1e-12,
      `equilibrium water green channel at ${phase}`);
      near(blocks.coldWater.material.color.b,
        blocks.warmWater.material.color.b, 1e-12,
      `equilibrium water blue channel at ${phase}`);
    }
  }
  disposeModel(model.root);
});

test('movement 469 whole screw turns close both mitre pairs and the wheel without an orientation jump', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;
  const start = stateAtPhase(0);
  const completed = stateAtPhase(geometry.operationEndPhase);

  near(geometry.totalScrewTurns % 1, 0, 1e-12,
    'integer screw turns');
  near(Math.abs(completed.waterWheelAngle - start.waterWheelAngle) / FULL_TURN,
    geometry.totalScrewTurns * geometry.faceGearRatio, 1e-9,
    'integer water-wheel turns');
  near((geometry.totalScrewTurns * geometry.faceGearRatio) % 1, 0, 1e-12,
    'the wheel makes whole turns per loop');
  near(Math.sin(completed.screwAngle), Math.sin(start.screwAngle),
    1e-12, 'screw sine closes');
  near(Math.cos(completed.screwAngle), Math.cos(start.screwAngle),
    1e-12, 'screw cosine closes');
  near(Math.sin(completed.waterWheelAngle),
    Math.sin(start.waterWheelAngle), 1e-12, 'wheel sine closes');
  near(Math.cos(completed.waterWheelAngle),
    Math.cos(start.waterWheelAngle), 1e-12, 'wheel cosine closes');
  disposeModel(model.root);
});

test('movement 469 geometric motion and temperature reset are C2 at all schedule boundaries', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;
  const boundaries = [
    0,
    geometry.operationEndPhase,
    geometry.thermalResetStartPhase,
  ];
  const step = 1e-6;
  const sampleField = (phase, field) => {
    const state = stateAtPhase(phase);
    if (field === 'temperature') return state.temperatureContrast;
    if (field === 'screwX') return Math.cos(state.screwAngle);
    if (field === 'screwY') return Math.sin(state.screwAngle);
    if (field === 'wheelX') return Math.cos(state.waterWheelAngle);
    return Math.sin(state.waterWheelAngle);
  };

  for (const boundary of boundaries) {
    for (const field of ['temperature', 'screwX', 'screwY',
      'wheelX', 'wheelY']) {
      const minusTwo = sampleField(boundary - 2 * step, field);
      const minusOne = sampleField(boundary - step, field);
      const center = sampleField(boundary, field);
      const plusOne = sampleField(boundary + step, field);
      const plusTwo = sampleField(boundary + 2 * step, field);
      const leftVelocity = (center - minusOne) / step;
      const rightVelocity = (plusOne - center) / step;
      near(leftVelocity, rightVelocity, 0.0002,
        `${field} velocity continuity at ${boundary}`);
      const leftAcceleration = (center - 2 * minusOne + minusTwo)
        / step ** 2;
      const rightAcceleration = (plusTwo - 2 * plusOne + center)
        / step ** 2;
      near(leftAcceleration, rightAcceleration, 0.08,
        `${field} acceleration continuity at ${boundary}`);
    }
  }
  disposeModel(model.root);
});

test('movement 469 has finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement469 = catalog.movements[468];
  const movement507 = catalog.movements[506];
  const model469 = createMovementModel(movement469);
  const model507 = createMovementModel(movement507);
  const fitBounds = model469.root.userData.cameraFitBounds;

  for (const phase of [0, 0.18, 0.37, 0.61, 0.74, 0.91, 0.99]) {
    model469.update(phase * model469.root.userData.geometry.cycleDuration);
    model469.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model469.root);
    for (const value of [bounds.min.x, bounds.min.y, bounds.min.z,
      bounds.max.x, bounds.max.y, bounds.max.z]) {
      assert.ok(Number.isFinite(value));
    }
    assert.ok(bounds.max.x > bounds.min.x);
    assert.ok(bounds.max.y > bounds.min.y);
    assert.ok(bounds.max.z > bounds.min.z);
    assert.ok(fitBounds.min.x <= bounds.min.x);
    assert.ok(fitBounds.min.y <= bounds.min.y);
    assert.ok(fitBounds.min.z <= bounds.min.z);
    assert.ok(fitBounds.max.x >= bounds.max.x);
    assert.ok(fitBounds.max.y >= bounds.max.y);
    assert.ok(fitBounds.max.z >= bounds.max.z);
  }
  assert.equal(movement469.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model469.root);
  disposeModel(model507.root);
});

// Pass 74: the pipe ends in a hood fitted closely under the wheel: its lips
// are arcs concentric with the wheel 0.02 outside the rims, it spans the
// rims, and the pipe's end meets its right wall at the bored hole.
test('movement 469 air pipe ends in a hood fitted closely under the wheel', () => {
  const { model } = movementModel();
  const { blocks, geometry, pressurePipeCurve } = model.root.userData;
  blocks.wheelHood.geometry.computeBoundingBox();
  const box = blocks.wheelHood.geometry.boundingBox;
  const rimOuter = geometry.waterWheelRadius + 0.064;
  const c = geometry.wheelCenter;
  const positions = blocks.wheelHood.geometry.attributes.position;
  let nearest = Infinity;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i), y = positions.getY(i);
    nearest = Math.min(nearest, Math.hypot(x - c.x, y - c.y) - rimOuter);
  }
  assert.ok(nearest > 0.015 && nearest < 0.025, `hood lip clearance ${nearest}`);
  assert.ok(box.min.z < geometry.wheelPlaneZ - 0.2 - 0.064 && box.max.z > geometry.wheelPlaneZ + 0.2 + 0.064,
    'hood spans both rims');
  const end = pressurePipeCurve.getPointAt(1);
  near(end.x, box.max.x, 1e-6, 'pipe meets the hood wall');
  assert.ok(end.y > box.min.y + geometry.airDuctRadius && end.z > box.min.z && end.z < box.max.z);
  assert.ok(box.max.z < -geometry.tankDepth / 2 + 0.14 + 0.2 + 1 && box.min.z > -geometry.tankDepth / 2 + 0.14,
    'hood clears the back wall');
  disposeModel(model.root);
});

test('movement 469 water bodies share no face plane with their cistern walls or floor', () => {
  const { model } = movementModel();
  const { root } = model;
  root.updateMatrixWorld(true);
  const boxOf = (role) => {
    let found = null;
    root.traverse((o) => { if (o.userData?.role === role) found = o; });
    assert.ok(found, role);
    return new THREE.Box3().setFromObject(found);
  };
  const planes = (box) => [
    ['x', box.min.x], ['x', box.max.x], ['y', box.min.y], ['y', box.max.y],
    ['z', box.min.z], ['z', box.max.z]];
  for (const prefix of ['natural-temperature-left', 'higher-temperature-right']) {
    const water = boxOf(`${prefix}-water-body`);
    // Pass 101: one common base slab under both cisterns.
    const walls = ['cistern-end-wall-left', 'cistern-end-wall-right',
      'cistern-back-wall', 'cistern-cutaway-front'].map((w) => boxOf(`${prefix}-${w}`));
    walls.push(boxOf('common-base-under-both-cisterns'));
    for (const [axis, value] of planes(water)) {
      for (const wall of walls) {
        for (const [wallAxis, wallValue] of planes(wall)) {
          if (axis !== wallAxis) continue;
          assert.ok(Math.abs(value - wallValue) > 0.005,
            `${prefix} water ${axis}=${value} is off every wall face (${wallValue})`);
        }
      }
    }
    // Sunk into the floor and the end and back walls; front face just
    // behind the z = 0.6 section plane.
    const base = boxOf('common-base-under-both-cisterns');
    assert.ok(water.min.y < base.max.y - 0.02, 'water bottom sunk into the floor');
    const left = boxOf(`${prefix}-cistern-end-wall-left`);
    const right = boxOf(`${prefix}-cistern-end-wall-right`);
    assert.ok(water.min.x < left.max.x - 0.02 && water.max.x > right.min.x + 0.02, 'water sides sunk into the end walls');
    const back = boxOf(`${prefix}-cistern-back-wall`);
    assert.ok(water.min.z < back.max.z - 0.02, 'water back sunk into the back wall');
    assert.ok(water.max.z < 0.6 && water.max.z > 0.58, 'water front just behind the section plane');
  }
});
