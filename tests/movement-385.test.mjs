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

test('movement 385 is one real door hinge with door and frame socket pins, a two-link toggle, and one hanging weight', () => {
  const movement = catalog.movements[384];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 385);
  assert.equal(movement.number, '385');
  assert.equal(movement.category, 'Universal joints');
  assert.equal(
    movement.archetype,
    'socketed-door-frame-pins-weighted-spatial-toggle-door-closer',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-fixed-frame-socket-pin/);
  assert.match(data.mechanism, /one-door-socket-pin/);
  assert.match(data.mechanism, /two-equal-toggle-links/);
  assert.match(data.mechanism, /one-weighted-apex/);
  assert.match(data.mechanism, /one-vertical-door-hinge/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 1);
  assert.equal(degreesOfFreedom.inputs.length, 1);
  assert.match(degreesOfFreedom.note, /one door angle/);

  for (const component of [
    blocks.doorAssembly,
    blocks.doorToggleLink,
    blocks.fixedFrame,
    blocks.framePinAssembly,
    blocks.frameToggleLink,
    blocks.suspension,
    blocks.toggleJoint,
    blocks.weight,
  ]) assert.ok(component.parent === model.root, `${component.userData.role} parent`);
  assert.ok(blocks.doorPinAssembly.parent === blocks.doorAssembly, 'door pin parent');
  // Pass 93: Brown draws no door or wall. The door, wall, hinges and socket
  // blocks are not presented; each pin turns in one plain bearing boss.
  for (const component of [
    blocks.doorPanel,
    blocks.doorSocketBracket,
    ...blocks.hingeBarrels,
    blocks.doorHandle,
    ...blocks.doorTrim,
  ]) assert.ok(component.parent === null, `source presentation removes ${component.userData.role}`);
  for (const prefix of ['frame-side', 'door-side']) {
    let socket, pin;
    model.root.traverse((o) => {
      if (o.userData.role === `${prefix}-socket-fixed-to-support`) socket = o;
      if (o.userData.role === `${prefix}-vertical-turning-pin`) pin = o;
    });
    socket.geometry.computeBoundingBox();
    pin.geometry.computeBoundingBox();
    const socketBox = socket.geometry.boundingBox.clone().translate(socket.position);
    const pinBottom = pin.geometry.boundingBox.min.y + pin.position.y;
    assert.ok(Math.abs(socketBox.max.y - socketBox.min.y - 0.55) < 1e-6, `${prefix} boss is 0.55 tall`);
    assert.ok(pinBottom > socketBox.min.y + 0.05 && pinBottom < socketBox.max.y - 0.2, `${prefix} pin stands in its boss`);
  }
  assert.ok(blocks.doorPinRotor.parent === blocks.doorPinAssembly, 'blocks.doorPinRotor parent');
  assert.ok(blocks.framePinRotor.parent === blocks.framePinAssembly, 'blocks.framePinRotor parent');
  assert.equal(blocks.doorTrim.length, 4);
  assert.equal(blocks.hingeBarrels.length, 3);
  assert.equal(blocks.fixedFrame.userData.fixed, true);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'door-turning-about-fixed-vertical-hinge',
    'frame-side-pin-turning-in-socket',
    'door-side-pin-turning-in-socket',
    'fixed-frame-pin-to-weighted-toggle-link',
    'door-pin-to-weighted-toggle-link',
    'weighted-central-toggle-joint',
    'gravity-closing-suspended-weight',
    'vertical-link-from-toggle-joint-to-weight-eye',
  ]) assert.ok(roles.includes(role), role);
  for (const role of [
    'frame-side-socket-fixed-to-support',
    'door-side-socket-fixed-to-support',
  ]) assert.ok(roles.includes(role), `${role} supports the pins`);
  for (const role of [
    'moving-door-panel',
    'fixed-wall-beside-door-opening',
    'one-of-three-fixed-axis-door-hinge-barrels',
    'fixed-door-frame-lintel',
    'white-toggle-height-index',
    'white-weight-height-index',
  ]) assert.ok(!roles.includes(role), `source presentation removes ${role}`);
  disposeModel(model.root);
});

test('movement 385 preserves Brown\'s stated action, measured plate, and verified official animation event proportions', () => {
  const movement = catalog.movements[384];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference, timeline } = data;
  const plate = sourceReference.brownPlate385;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_385.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /employed in Russia/);
  assert.match(movement.description, /socket attached to door/);
  assert.match(movement.description, /similarly attached to frame/);
  assert.match(movement.description, /pins are brought together/);
  assert.match(movement.description, /weight is raised/);
  assert.match(movement.description, /widening the space between the pins/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(sourceAnimation.officialCanvasModelId, 'mm_385');
  assert.deepEqual(sourceAnimation.sourceViewBox, [0, 0, 42, 42]);
  assert.deepEqual(sourceAnimation.normalizedEventPhases, timeline.normalizedEventPhases);
  assert.deepEqual(timeline.normalizedEventPhases, [0, 0.4, 0.5, 0.9, 1]);
  assert.equal(
    dynamics.sourceSpecifiesDimensionsMassGravityAbsoluteTimingOrDoorAngle,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 6);
  assert.deepEqual(plate.framePinPixels.toArray(), [34, 372]);
  assert.deepEqual(plate.centralJointPixels.toArray(), [263, 180]);
  assert.deepEqual(plate.movingPinPixels.toArray(), [491, 372]);
  assert.deepEqual(plate.weightCenterPixels.toArray(), [264, 291]);
  assert.equal(plate.halfEndpointSpanPixels, 228.5);
  assert.equal(plate.jointRisePixels, 192);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.officialAnimationEvidence, /inline mm_385 canvas model/);
  assert.match(evidence.officialAnimationEvidence, /0\.4, 0\.5, and 0\.9/);
  assert.match(evidence.plateProportionUse, /192 pixels/);
  assert.match(evidence.reconstructionDisclosure, /independently engineered/);
  disposeModel(model.root);
});

test('movement 385 follows its prescribed open-dwell-close-dwell phases with smooth zero-rate boundaries', () => {
  const model = createMovementModel(catalog.movements[384]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;

  const samples = [
    [0, 'external-opening-raises-weight', 0],
    [timeline.events.openDwellStarts, 'open-dwell-weight-raised', 1],
    [timeline.events.closingStarts, 'gravity-weight-closes-door', 1],
    [timeline.events.closedDwellStarts, 'closed-dwell-against-stop', 0],
    [timeline.cycleDuration, 'external-opening-raises-weight', 0],
  ];
  for (const [time, stage, fraction] of samples) {
    const state = stateAtTime(time);
    assert.equal(state.stage, stage);
    near(state.openFraction, fraction, 0, `${stage} fraction`);
    near(state.doorAngularSpeed, 0, 3e-15, `${stage} speed`);
    near(state.doorAngularAcceleration, 0, 3e-15,
      `${stage} acceleration`);
  }

  for (const time of [0.4, 1.2, 2.0, 2.8, 3.6]) {
    const opening = stateAtTime(time);
    const closing = stateAtTime(
      timeline.events.closingStarts
        + timeline.events.openDwellStarts - time,
    );
    near(closing.openFraction, opening.openFraction, 3e-15,
      'opening and closing position symmetry');
    near(closing.doorAngularSpeed, -opening.doorAngularSpeed, 4e-15,
      'opening and closing speed reversal');
    near(closing.doorAngularAcceleration,
      opening.doorAngularAcceleration, 8e-15,
      'time-mirrored opening and closing acceleration');
  }
  near(stateAtTime(timeline.events.openDwellStarts).doorAngle,
    geometry.maximumDoorAngle, 0, 'fully open dwell angle');
  disposeModel(model.root);
});

test('movement 385 door-side pin follows its hinge circle while opening strictly brings the two socket pins together', () => {
  const model = createMovementModel(catalog.movements[384]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;
  const hinge = geometry.hingeAxis;
  let priorDistance = Number.POSITIVE_INFINITY;

  assert.match(transmission.endpointDistanceLaw, /cos/);
  for (let sample = 0; sample <= 1600; sample += 1) {
    const time = timeline.events.openDwellStarts * sample / 1600;
    const state = stateAtTime(time);
    const radial = state.doorAnchor.clone().sub(hinge);
    radial.y = 0;
    near(radial.length(), geometry.doorPinRadius, 7e-16,
      'door pin stays on hinge circle');
    vectorNear(state.frameAnchor,
      new THREE.Vector3(-geometry.framePinOffset, geometry.endpointY, 0),
      0, 'frame pin remains fixed');
    const expectedDoorAnchor = new THREE.Vector3(
      geometry.doorPinRadius * Math.cos(state.doorAngle),
      geometry.endpointY,
      -geometry.doorPinRadius * Math.sin(state.doorAngle),
    );
    vectorNear(state.doorAnchor, expectedDoorAnchor, 0,
      'door pin exact hinge pose');
    near(state.endpointDistance,
      Math.sqrt(
        geometry.framePinOffset ** 2 + geometry.doorPinRadius ** 2
          + 2 * geometry.framePinOffset * geometry.doorPinRadius
            * Math.cos(state.doorAngle),
      ), 2e-15, 'endpoint chord law');
    assert.ok(state.endpointDistance <= priorDistance + 2e-15,
      'opening never widens the pins');
    priorDistance = state.endpointDistance;
    if (state.doorAngularSpeed > 1e-12) {
      assert.ok(state.endpointDistanceRate < 0,
        'moving opening phase brings pins together');
    }
  }
  near(geometry.closedEndpointDistance,
    geometry.framePinOffset + geometry.doorPinRadius, 0,
    'closed pin separation is maximum');
  assert.ok(geometry.openEndpointDistance < geometry.closedEndpointDistance);
  disposeModel(model.root);
});

test('movement 385 equal rigid links place the weighted apex exactly over the pin-chord midpoint and raise it on opening', () => {
  const model = createMovementModel(catalog.movements[384]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;

  assert.match(transmission.toggleHeightLaw, /sqrt/);
  for (let sample = -1400; sample <= 2800; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 1400);
    near(state.apex.distanceTo(state.frameAnchor),
      geometry.linkLength, 2e-15, 'frame-side rigid link length');
    near(state.apex.distanceTo(state.doorAnchor),
      geometry.linkLength, 2e-15, 'door-side rigid link length');
    near(state.apex.x, state.midpoint.x, 0,
      'apex above chord midpoint x');
    near(state.apex.z, state.midpoint.z, 0,
      'apex above chord midpoint z');
    near(state.apex.y - geometry.endpointY,
      Math.sqrt(
        geometry.linkLength ** 2 - (state.endpointDistance / 2) ** 2,
      ), 2e-15, 'exact isosceles-toggle rise');
    near(state.weightEye.y - state.weightCenter.y,
      geometry.weightEyeOffsetY, 1e-15, 'weight eye offset');
    near(state.apex.y - state.weightEye.y,
      geometry.weightSuspensionLength, 2e-15,
      'fixed vertical weight suspension');
    near(state.weightCenter.x, state.apex.x, 0,
      'weight hangs vertically beneath apex x');
    near(state.weightCenter.z, state.apex.z, 0,
      'weight hangs vertically beneath apex z');
  }
  assert.ok(geometry.openToggleRise > geometry.closedToggleRise,
    'opening raises toggle and weight');
  disposeModel(model.root);
});

test('movement 385 gravity potential produces the exact closing torque and outward pin force', () => {
  const model = createMovementModel(catalog.movements[384]);
  const data = model.root.userData;
  const { dynamics, geometry, stateAtTime, timeline, transmission } = data;
  const { weightForce } = dynamics;

  assert.match(dynamics.energyLaw, /U=m\*g/);
  assert.match(dynamics.energyLaw, /-dU\/dDoorAngle/);
  assert.match(transmission.gravityClosingTorqueLaw, /sin/);
  for (let sample = 0; sample <= 1800; sample += 1) {
    const time = timeline.events.openDwellStarts * sample / 1800;
    const state = stateAtTime(time);
    near(state.potentialEnergy,
      weightForce * state.weightCenter.y, 0,
      'gravitational potential energy');
    near(state.closingTorque,
      -weightForce * state.toggleRisePerDoorRadian, 0,
      'gravity generalized torque');
    near(state.gravityPower + state.potentialEnergyRate,
      0, 2e-15, 'gravity power is negative potential-energy rate');
    near(
      2 * state.linkCompressionForce
        * state.toggleRise / geometry.linkLength,
      weightForce,
      4e-15,
      'two link vertical components support weight',
    );
    near(state.endpointSeparatingForce,
      weightForce * state.endpointDistance / (4 * state.toggleRise),
      0, 'toggle horizontal force widens pins');
    if (state.doorAngle > 1e-8) {
      assert.ok(state.closingTorque < 0,
        'raised weight torque always acts toward closed stop');
    }
  }
  assert.ok(stateAtTime(2).potentialEnergy
    > stateAtTime(1).potentialEnergy,
  'opening work raises gravitational energy');
  assert.ok(stateAtTime(7).gravityPower > 0,
    'descending weight delivers positive closing power');
  disposeModel(model.root);
});

test('movement 385 renderer keeps both pin yokes aligned to their links while binding every moving body exactly', () => {
  const model = createMovementModel(catalog.movements[384]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime, timeline } = data;
  const fixedFramePosition = blocks.fixedFrame.position.clone();
  const hingePositions = blocks.hingeBarrels.map((barrel) => (
    barrel.position.clone()
  ));

  for (let frame = 0; frame <= 1200; frame += 1) {
    const time = timeline.cycleDuration * 2 * frame / 1200;
    const expected = stateAtTime(time);
    model.update(time, 0.016);
    near(blocks.doorAssembly.rotation.y,
      expected.doorAngle, 0, 'rendered door angle');
    near(blocks.framePinRotor.rotation.y,
      expected.framePinYaw, 0, 'rendered frame pin yaw');
    near(blocks.doorAssembly.rotation.y + blocks.doorPinRotor.rotation.y,
      expected.doorPinWorldYaw, 6e-16, 'rendered door pin world yaw');
    vectorNear(blocks.toggleJoint.position,
      expected.apex, 0, 'rendered toggle apex');
    vectorNear(blocks.weight.position,
      expected.weightCenter, 0, 'rendered weight center');
    vectorNear(blocks.frameToggleLink.userData.endpoints.start,
      expected.frameAnchor, 0, 'frame link start');
    vectorNear(blocks.frameToggleLink.userData.endpoints.end,
      expected.apex, 0, 'frame link end');
    vectorNear(blocks.doorToggleLink.userData.endpoints.start,
      expected.doorAnchor, 0, 'door link start');
    vectorNear(blocks.doorToggleLink.userData.endpoints.end,
      expected.apex, 0, 'door link end');
    vectorNear(blocks.suspension.userData.endpoints.start,
      expected.apex, 0, 'suspension top');
    vectorNear(blocks.suspension.userData.endpoints.end,
      expected.weightEye, 0, 'suspension bottom');

    const frameDirection = new THREE.Vector3(
      Math.cos(blocks.framePinRotor.rotation.y),
      0,
      -Math.sin(blocks.framePinRotor.rotation.y),
    );
    const frameToDoor = expected.doorAnchor.clone()
      .sub(expected.frameAnchor).setY(0).normalize();
    vectorNear(frameDirection, frameToDoor, 2e-15,
      'frame pin yoke aims along toggle chord');
    const doorWorldDirection = new THREE.Vector3(
      Math.cos(expected.doorPinWorldYaw),
      0,
      -Math.sin(expected.doorPinWorldYaw),
    );
    vectorNear(doorWorldDirection, frameToDoor.clone().negate(), 4e-16,
      'door pin yoke aims back along toggle chord');
    vectorNear(blocks.fixedFrame.position,
      fixedFramePosition, 0, 'fixed frame remains fixed');
    blocks.hingeBarrels.forEach((barrel, index) => {
      vectorNear(barrel.position, hingePositions[index], 0,
        `fixed hinge barrel ${index}`);
    });
    near(data.contacts.toggleJoint.leftLinkClosure,
      0, 2e-15, 'runtime left link closure');
    near(data.contacts.toggleJoint.rightLinkClosure,
      0, 2e-15, 'runtime right link closure');
    near(expected.doorAnchor.y, geometry.endpointY, 0,
      'door pin height');
  }
  disposeModel(model.root);
});

test('movement 385 closes exactly after one prescribed cycle before movement 507 remains authored', () => {
  const movement = catalog.movements[384];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.cycleDuration);

  near(closure.doorAngle, start.doorAngle, 0, 'door angle closes');
  near(closure.openFraction, start.openFraction, 0,
    'schedule fraction closes');
  vectorNear(closure.doorAnchor, start.doorAnchor, 0,
    'door pin closes');
  vectorNear(closure.apex, start.apex, 0, 'toggle apex closes');
  vectorNear(closure.weightCenter, start.weightCenter, 0,
    'weight closes');
  vectorNear(closure.apexVelocity, start.apexVelocity, 0,
    'velocity closes');
  assert.equal(data.animationTiming.authoredCyclePeriod,
    timeline.cycleDuration);
  assert.equal(data.animationTiming.targetCycleDuration, 2);
  assertReadableTiming(data.animationTiming);
  assert.ok(data.cameraFitBounds instanceof THREE.Box3);
  assert.ok(Number.isFinite(data.groundFloorY));
  for (const residual of Object.values(data.constraintResiduals)) {
    near(residual, 0, 2e-15, 'static closure residual');
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
