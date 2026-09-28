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
const Z_AXIS = new THREE.Vector3(0, 0, 1);

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

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function vector2Near(actual, expected, tolerance, message) {
  vectorNear(
    new THREE.Vector2(actual.x, actual.y),
    new THREE.Vector2(expected.x, expected.y),
    tolerance,
    message,
  );
}

test('movement 177 lets the rear wrist clear a quarter-turned curved slot while the coaxial output remains stopped', () => {
  const movement = catalog.movements[176];
  const model = createMovementModel(movement);
  const {
    blocks,
    canonicalStates,
    geometry,
    modelPointToSourceRaster,
    passageCenterlineY,
    sourcePointToModel,
    stateAtInputAngle,
    stateAtTime,
  } = model.root.userData;
  const {
    fixedFrontBearing,
    fixedFrontBearingRing,
    fixedRearBearing,
    fixedRearBearingRing,
    inputCrank,
    inputCrankArm,
    inputShaft,
    inputShaftBoss,
    inputShaftIndex,
    inputWristAnchor,
    inputWristBoss,
    motionEnvelope,
    outputCrank,
    outputCrankPlate,
    outputRingCenterAnchor,
    outputRotationIndex,
    outputShaft,
    outputShaftCap,
    outputShaftOutline,
    selectorBearingOutline,
    selectorBottomGroove,
    selectorCenterAnchor,
    selectorIndex,
    selectorLowerLobe,
    selectorLowerWall,
    selectorRing,
    selectorSlotAxisAnchor,
    selectorTopGroove,
    selectorUpperLobe,
    selectorUpperWall,
    wristCenterAnchor,
    wristFaceIndex,
    wristFaceOutline,
    wristPin,
    wristPinAssembly,
  } = blocks;

  assert.equal(movement.id, 177);
  assert.equal(movement.number, '177');
  assert.equal(
    movement.title,
    'Released Tangential-Slot Engine Uncoupling',
  );
  assert.equal(movement.category, 'Cranks & reciprocation');
  assert.equal(
    movement.description,
    '176 and 177. Contrivance for uncoupling engines. The wrist which is fixed on one arm of the crank (not shown) will communicate motion to the arm of the crank which is represented, when the ring on the latter has its slot in the position shown in 176. But when the ring is turned to bring the slot in the position shown in 177, the wrist passes through the slot without turning the crank to which said ring is attached.',
  );
  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_177.html');
  assert.equal(
    movement.archetype,
    'coaxial-equal-throw-cranks-quarter-turned-tangential-slotted-ring-disengaged-wrist-pass-through',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'coaxial-equal-radius-input-crank-fixed-output-quarter-turned-curved-tangential-slot-wrist-clearance',
  );
  assert.equal(typeof modelPointToSourceRaster, 'function');
  assert.equal(typeof passageCenterlineY, 'function');
  assert.equal(typeof sourcePointToModel, 'function');
  assert.equal(typeof stateAtInputAngle, 'function');
  assert.equal(typeof stateAtTime, 'function');

  // This is the same two-plane coupling as 176, but its selector has made one
  // permanent 90-degree shift and there is deliberately no contact marker or
  // transmitting wall. The rear crank remains the sole moving rotor.
  for (const object of [
    fixedFrontBearing,
    fixedFrontBearingRing,
    fixedRearBearing,
    fixedRearBearingRing,
    inputCrank,
    inputCrankArm,
    inputShaft,
    inputShaftBoss,
    inputShaftIndex,
    inputWristAnchor,
    inputWristBoss,
    motionEnvelope,
    outputCrank,
    outputCrankPlate,
    outputRingCenterAnchor,
    outputRotationIndex,
    outputShaft,
    outputShaftCap,
    outputShaftOutline,
    selectorBearingOutline,
    selectorBottomGroove,
    selectorCenterAnchor,
    selectorIndex,
    selectorLowerLobe,
    selectorLowerWall,
    selectorRing,
    selectorSlotAxisAnchor,
    selectorTopGroove,
    selectorUpperLobe,
    selectorUpperWall,
    wristCenterAnchor,
    wristFaceIndex,
    wristFaceOutline,
    wristPin,
    wristPinAssembly,
  ]) assert.ok(object?.isObject3D);
  assert.equal(blocks.contactMarker, undefined);
  assert.equal(blocks.selectorLeftLobe, undefined);
  assert.equal(blocks.selectorRightLobe, undefined);
  assert.equal(inputCrank.parent, model.root);
  assert.equal(outputCrank.parent, model.root);
  assert.equal(wristPinAssembly.parent, model.root);
  assert.equal(selectorRing.parent, outputCrank);
  assert.equal(inputWristAnchor.parent, inputCrank);
  assert.equal(outputRingCenterAnchor.parent, outputCrank);
  assert.equal(selectorUpperWall.userData.contactSurface, false);
  assert.equal(selectorLowerWall.userData.contactSurface, false);
  assert.equal(fixedFrontBearing.userData.fixed, true);
  assert.equal(fixedRearBearing.userData.fixed, true);
  assert.equal(motionEnvelope.userData.witnessOnly, true);
  vectorNear(inputCrank.userData.axis, Z_AXIS, 0,
    'rear input crank axis');
  vectorNear(outputCrank.userData.axis, Z_AXIS, 0,
    'stationary front output axis');
  vectorNear(inputShaft.userData.axis, Z_AXIS, 0,
    'independent input shaft axis');
  vectorNear(outputShaft.userData.axis, Z_AXIS, 0,
    'independent output shaft axis');
  vectorNear(wristPinAssembly.userData.axis, Z_AXIS, 0,
    'projecting input wrist axis');
  vectorNear(selectorRing.userData.slotAxisLocal,
    new THREE.Vector3(0, 1, 0), 0,
    'selector retains its local slot axis');
  near(selectorRing.userData.relativeAngle, -Math.PI / 2, 0,
    'selector is manually quarter-turned');
  assert.equal(selectorRing.userData.role,
    'quarter-turned-tangential-slot-released-selector-ring');
  assert.equal(outputCrankPlate.userData.openingCount, 2);
  assert.equal(outputCrankPlate.geometry.parameters.shapes.holes.length, 2,
    'front shaft and selector openings remain real bores');

  const forbiddenStandIns = [];
  const topologyCounts = {
    inputCrank: 0,
    outputCrank: 0,
    releasedSelector: 0,
    wrist: 0,
  };
  let contactSurfaceCount = 0;
  let contactMarkerCount = 0;
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (role === 'rear-input-crank-with-fixed-wrist') {
      topologyCounts.inputCrank += 1;
    }
    if (role === 'front-output-crank-carrying-selector-ring') {
      topologyCounts.outputCrank += 1;
    }
    if (role === 'quarter-turned-tangential-slot-released-selector-ring') {
      topologyCounts.releasedSelector += 1;
    }
    if (role === 'input-fixed-wrist-spanning-the-selector-plane') {
      topologyCounts.wrist += 1;
    }
    if (object.userData.contactSurface) contactSurfaceCount += 1;
    if (/contact-marker/i.test(role)) contactMarkerCount += 1;
    if (
      object.userData.mechanismBelt
      || object.userData.selectorBelt
      || object.userData.camProfile
      || object.userData.screwThread
      || object.userData.teeth
      || /(?:^|-)(?:belt|chain|cam|gear|rack|ratchet|screw)(?:-|$)/i
        .test(role)
    ) forbiddenStandIns.push(role || object.type);
  });
  assert.deepEqual(topologyCounts, {
    inputCrank: 1,
    outputCrank: 1,
    releasedSelector: 1,
    wrist: 1,
  });
  assert.equal(contactSurfaceCount, 0);
  assert.equal(contactMarkerCount, 0);
  assert.deepEqual(forbiddenStandIns, []);

  // Independent raster measurements retain the second engraving's slightly
  // shorter arm and larger head rather than reusing 176's drawing lock.
  assert.equal(geometry.sourceImageWidth, 525);
  assert.equal(geometry.sourceImageHeight, 525);
  near(geometry.sourceScale, 0.010, 0, 'source raster scale');
  vectorNear(geometry.sourceMainShaftCenter,
    new THREE.Vector2(258, 426), 0,
    'source output-shaft center');
  vectorNear(geometry.sourceRingCenter,
    new THREE.Vector2(258, 96), 0,
    'source released-ring center');
  vectorNear(geometry.sourceWristCenter,
    new THREE.Vector2(258, 96), 0,
    'source passing wrist center');
  assert.equal(geometry.sourceBottomOuterRadius, 80);
  assert.equal(geometry.sourceTopOuterRadius, 76);
  assert.equal(geometry.sourceWristRadius, 28);
  assert.equal(geometry.sourceSlotHalfWidth, 29);
  near(geometry.crankRadius, 3.30, 5e-16,
    'source crank throw');
  near(geometry.bottomOuterRadius, 0.80, 0,
    'source lower-hub radius');
  near(geometry.topOuterRadius, 0.76, 0,
    'source selector-head radius');
  near(geometry.wristPinRadius, 0.28, 0,
    'source wrist radius');
  near(geometry.slotHalfWidth, 0.29, 0,
    'source slot half-width');
  near(geometry.slotClearance, 0.01, 5e-17,
    'pin-to-each-wall running clearance');
  near(geometry.selectorAngleRelativeToOutput, -Math.PI / 2, 0,
    'ring quarter-turn');
  near(geometry.selectorZoneRadius, 0.90, 2e-16,
    'selector collision-zone radius');
  vectorNear(sourcePointToModel(geometry.sourceMainShaftCenter),
    new THREE.Vector2(0, 0), 0,
    'source shaft maps to model origin');
  vectorNear(sourcePointToModel(geometry.sourceRingCenter),
    new THREE.Vector2(0, geometry.crankRadius), 0,
    'source ring maps to equal throw');
  vectorNear(sourcePointToModel(geometry.sourceWristCenter),
    new THREE.Vector2(0, geometry.crankRadius), 0,
    'source wrist lies at passage center');
  vectorNear(modelPointToSourceRaster(new THREE.Vector2(0, 0)),
    geometry.sourceMainShaftCenter, 0,
    'model shaft returns to source raster');
  vectorNear(modelPointToSourceRaster(
    new THREE.Vector2(0, geometry.crankRadius)),
  geometry.sourceRingCenter, 0,
  'model ring returns to source raster');

  // The passage is a concentric band around the input-shaft center. Its two
  // curved walls are exact normal offsets from the wrist orbit, so a radius
  // 0.28 wrist retains 0.01 clearance at every point of the crossing.
  near(geometry.passageUpperBoundaryRadius,
    geometry.crankRadius + geometry.slotHalfWidth, 0,
    'outer curved passage-wall radius');
  near(geometry.passageLowerBoundaryRadius,
    geometry.crankRadius - geometry.slotHalfWidth, 0,
    'inner curved passage-wall radius');
  near(
    geometry.passageUpperBoundaryRadius
      - (geometry.crankRadius + geometry.wristPinRadius),
    geometry.slotClearance,
    4e-16,
    'wrist-to-outer-wall normal clearance',
  );
  near(
    geometry.crankRadius - geometry.wristPinRadius
      - geometry.passageLowerBoundaryRadius,
    geometry.slotClearance,
    4e-16,
    'wrist-to-inner-wall normal clearance',
  );
  near(passageCenterlineY(0), 0, 0,
    'passage center at top dead center');
  assert.ok(passageCenterlineY(0.5) < -0.037,
    'passage visibly follows the circular wrist path');
  assert.ok(geometry.passageUpperLimit > 0.56);
  assert.ok(geometry.passageUpperLimit < geometry.selectorOuterRadius);
  assert.ok(geometry.passageLowerLimit > 0.51);
  assert.ok(geometry.passageLowerLimit < geometry.selectorOuterRadius);
  near(
    geometry.passageEntryAngle,
    2 * Math.asin(
      geometry.selectorZoneRadius / (2 * geometry.crankRadius),
    ),
    0,
    'entry angle from circle-circle contact',
  );

  // At the engraved pose the wrist is centered in the horizontal passage,
  // while the blue output arm and shaft are exactly stationary.
  const source = canonicalStates.sourceDisengaged;
  near(source.inputAngle, 0, 0, 'source input angle');
  near(source.outputAngle, 0, 0, 'source output angle');
  vectorNear(source.inputWrist,
    new THREE.Vector2(0, geometry.crankRadius), 0,
    'source wrist position');
  vectorNear(source.outputRingCenter,
    new THREE.Vector2(0, geometry.crankRadius), 0,
    'source ring position');
  vectorNear(source.inputWrist, source.outputRingCenter, 0,
    'wrist centered inside ring');
  assert.equal(source.selectorEngaged, false);
  assert.equal(source.selectorContact, false);
  assert.equal(source.outputStopped, true);
  assert.equal(source.selectorSlotOrientation,
    'tangential-to-input-wrist-orbit');
  near(source.selectorAngleRelativeToOutput, -Math.PI / 2, 0,
    'source selector quarter-turn');
  near(source.inputAngularSpeed, geometry.inputAngularSpeed, 0,
    'source input runs');
  near(source.outputAngularSpeed, 0, 0,
    'source output stopped');
  near(source.inputOutputAngularSpeedRatio, 0, 0,
    'source uncoupled speed ratio');
  near(source.passageNormalOffset, 0, 0,
    'wrist lies on curved passage centerline');
  near(source.passageClearance, geometry.slotClearance, 0,
    'source wrist running clearance');
  near(source.materialClearance, geometry.slotClearance, 0,
    'source nearest selector clearance');
  assert.equal(source.wristWithinSelectorZone, true);
  assert.equal(source.wristClearOfSelector, true);

  const rightEntry = canonicalStates.rightPassageEntry;
  const leftExit = canonicalStates.leftPassageExit;
  for (const [state, label, xSign] of [
    [rightEntry, 'right entry', 1],
    [leftExit, 'left exit', -1],
  ]) {
    near(state.wristDistanceFromRing,
      geometry.selectorZoneRadius, 8e-16,
      `${label} selector-zone boundary`);
    assert.equal(state.wristWithinSelectorZone, true);
    assert.equal(Math.sign(state.inputWrist.x), xSign);
    near(state.passageNormalOffset, 0, 5e-16,
      `${label} curved centerline`);
    near(state.passageClearance, geometry.slotClearance, 6e-16,
      `${label} wall clearance`);
    assert.equal(state.selectorContact, false);
    assert.equal(state.outputStopped, true);
  }
  const opposite = canonicalStates.oppositeOutput;
  vectorNear(opposite.inputWrist,
    new THREE.Vector2(0, -geometry.crankRadius), 6e-16,
    'input wrist opposite the stationary ring');
  vectorNear(opposite.outputRingCenter,
    source.outputRingCenter, 0,
    'output ring remains at source position');
  assert.equal(opposite.wristWithinSelectorZone, false);
  assert.ok(opposite.materialClearance > 5.69);

  // Dense sampling proves that the moving rear wrist never contacts either
  // lobe, while the front crank, ring center, selector angle, and output shaft
  // remain absolutely fixed for the complete input revolution.
  const denseSampleCount = 65536;
  let minimumMaterialClearance = Infinity;
  let minimumPassageClearance = Infinity;
  let maximumPassageCenterlineError = 0;
  let maximumInputStep = 0;
  let passageSampleCount = 0;
  let previousState = stateAtInputAngle(0);
  for (let index = 0; index <= denseSampleCount; index += 1) {
    const inputAngle = FULL_TURN * index / denseSampleCount;
    const state = stateAtInputAngle(inputAngle);
    minimumMaterialClearance = Math.min(
      minimumMaterialClearance,
      state.materialClearance,
    );
    maximumInputStep = Math.max(
      maximumInputStep,
      state.inputWrist.distanceTo(previousState.inputWrist),
    );
    near(state.inputWrist.length(), geometry.crankRadius, 1e-15,
      'dense equal input throw');
    vectorNear(state.outputRingCenter, source.outputRingCenter, 0,
      'dense stopped output-ring center');
    near(state.outputAngle, 0, 0, 'dense stopped output angle');
    near(state.outputAngularSpeed, 0, 0,
      'dense stopped output speed');
    near(state.outputRingCenterVelocity.length(), 0, 0,
      'dense stopped output velocity');
    near(state.outputRingCenterAcceleration.length(), 0, 0,
      'dense stopped output acceleration');
    near(state.selectorAngleRelativeToOutput, -Math.PI / 2, 0,
      'dense quarter-turned selector');
    assert.equal(state.selectorEngaged, false);
    assert.equal(state.selectorContact, false);
    assert.equal(state.outputStopped, true);
    assert.equal(state.wristClearOfSelector, true);
    if (state.wristWithinSelectorZone) {
      passageSampleCount += 1;
      minimumPassageClearance = Math.min(
        minimumPassageClearance,
        state.passageClearance,
      );
      maximumPassageCenterlineError = Math.max(
        maximumPassageCenterlineError,
        state.inputWrist.distanceTo(state.passageCenterlinePoint),
      );
      near(state.passageNormalOffset, 0, 1e-15,
        'dense wrist follows curved slot centerline');
    }
    previousState = state;
  }
  assert.ok(passageSampleCount > 5700);
  assert.ok(passageSampleCount < 5800);
  assert.ok(minimumMaterialClearance >= -1e-12);
  near(minimumPassageClearance, geometry.slotClearance, 1.2e-15,
    'dense minimum passage clearance');
  assert.ok(maximumPassageCenterlineError < 1.4e-15);
  assert.ok(maximumInputStep < 0.000317,
    'rear wrist advances continuously through the released ring');

  // The rear wrist retains exact uniform circular derivatives; every output
  // derivative is identically zero rather than merely visually slow.
  const derivativeStep = 2e-5;
  for (const inputAngle of [0.11, 0.24, 1.18, 2.73, 4.61, 6.11]) {
    const before = stateAtInputAngle(inputAngle - derivativeStep);
    const state = stateAtInputAngle(inputAngle);
    const after = stateAtInputAngle(inputAngle + derivativeStep);
    const numericalInputVelocity = after.inputWrist.clone()
      .sub(before.inputWrist)
      .multiplyScalar(
        geometry.inputAngularSpeed / (2 * derivativeStep),
      );
    vectorNear(numericalInputVelocity, state.inputWristVelocity,
      2e-9, 'analytic running-wrist velocity');
    const numericalInputAcceleration = after.inputWrist.clone()
      .add(before.inputWrist)
      .addScaledVector(state.inputWrist, -2)
      .multiplyScalar(
        geometry.inputAngularSpeed ** 2 / derivativeStep ** 2,
      );
    vectorNear(numericalInputAcceleration,
      state.inputWristAcceleration, 2e-6,
      'analytic running-wrist acceleration');
    vectorNear(state.outputRingCenterVelocity,
      new THREE.Vector2(0, 0), 0,
      'analytic stopped-output velocity');
    vectorNear(state.outputRingCenterAcceleration,
      new THREE.Vector2(0, 0), 0,
      'analytic stopped-output acceleration');
  }

  // One timed input revolution closes only the rear crank. The output has no
  // unwrapped angular advance at all.
  const timedStart = stateAtTime(0);
  const timedEnd = stateAtTime(geometry.cyclePeriod);
  vectorNear(timedEnd.inputWrist, timedStart.inputWrist, 2e-15,
    'timed input periodicity');
  vectorNear(timedEnd.outputRingCenter,
    timedStart.outputRingCenter, 0,
    'timed stopped-output periodicity');
  near(
    timedEnd.inputUnwrappedAngle - timedStart.inputUnwrappedAngle,
    FULL_TURN,
    2e-15,
    'input completes one timed revolution',
  );
  near(timedEnd.outputUnwrappedAngle, 0, 0,
    'output accumulates no angle');

  // The pin reaches through the rear crank and recessed selector, but not the
  // stationary front cheek. The input and output shaft bodies stay separated.
  const inputCrankFrontZ = geometry.inputPlaneZ
    + geometry.inputCrankDepth / 2;
  const selectorBackZ = geometry.selectorPlaneZ
    - geometry.selectorDepth / 2;
  const selectorFrontZ = geometry.selectorPlaneZ
    + geometry.selectorDepth / 2;
  const outputCrankBackZ = geometry.outputPlaneZ
    - geometry.outputCrankDepth / 2;
  const inputShaftFrontZ = geometry.inputShaftCenterZ
    + geometry.inputShaftLength / 2;
  const outputShaftBackZ = geometry.outputShaftCenterZ
    - geometry.outputShaftLength / 2;
  assert.ok(inputCrankFrontZ < selectorBackZ);
  assert.ok(selectorFrontZ < outputCrankBackZ);
  assert.ok(geometry.wristPinRearZ < inputCrankFrontZ);
  assert.ok(geometry.wristPinFrontZ > selectorFrontZ);
  assert.ok(geometry.wristPinFrontZ < outputCrankBackZ);
  assert.ok(inputShaftFrontZ < outputShaftBackZ);
  near(geometry.axialPlaneSeparation,
    source.axialPlaneSeparation, 0,
    'reported rear/front crank-plane separation');

  // Rendered transforms prove that only the orange rear crank and wrist move.
  // The blue crank, selector center, front shaft index, and bearings are fixed.
  model.update(0, 0.016);
  model.root.updateMatrixWorld(true);
  const fixedOutputMatrix = outputCrank.matrixWorld.clone();
  const fixedOutputIndexMatrix = outputRotationIndex.matrixWorld.clone();
  const frontBearingMatrix = fixedFrontBearing.matrixWorld.clone();
  const rearBearingMatrix = fixedRearBearing.matrixWorld.clone();
  for (const time of [0, 0.6, 1.8, 3.4, 5.9, 8.2, 11.7]) {
    model.update(time, 0.016);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    near(inputCrank.rotation.z, state.inputAngle, 0,
      'rendered running input angle');
    near(outputCrank.rotation.z, 0, 0,
      'rendered stopped output angle');
    near(selectorRing.rotation.z, -Math.PI / 2, 0,
      'rendered tangential selector orientation');
    vector2Near(inputWristAnchor.getWorldPosition(new THREE.Vector3()),
      state.inputWrist, 1.5e-15,
      'rendered wrist fixed to rear input crank');
    vector2Near(wristCenterAnchor.getWorldPosition(new THREE.Vector3()),
      state.inputWrist, 0,
      'rendered projecting wrist center');
    vector2Near(outputRingCenterAnchor.getWorldPosition(
      new THREE.Vector3()), state.outputRingCenter, 0,
    'rendered stationary output-ring center');
    vector2Near(selectorCenterAnchor.getWorldPosition(
      new THREE.Vector3()), state.outputRingCenter, 0,
    'rendered stationary selector center');
    const renderedNominalSlotAxis = selectorSlotAxisAnchor
      .getWorldPosition(new THREE.Vector3())
      .sub(selectorCenterAnchor.getWorldPosition(new THREE.Vector3()))
      .setZ(0)
      .normalize();
    vector2Near(renderedNominalSlotAxis,
      new THREE.Vector2(1, 0), 3e-16,
      'rendered nominal slot axis is horizontal');
    assert.ok(outputCrank.matrixWorld.equals(fixedOutputMatrix));
    assert.ok(outputRotationIndex.matrixWorld.equals(
      fixedOutputIndexMatrix));
    assert.ok(fixedFrontBearing.matrixWorld.equals(frontBearingMatrix));
    assert.ok(fixedRearBearing.matrixWorld.equals(rearBearingMatrix));
  }

  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x >= 2 * (geometry.crankRadius + geometry.topOuterRadius));
  assert.ok(size.y >= 2 * (geometry.crankRadius + geometry.topOuterRadius),
    'motion witness contains the running rear crank at every phase');
  // Pass 93: the rear bearing is a bored ring seated on the input shaft (no
  // loose torus past its end), so the shaft's end sets the rear depth.
  assert.ok(size.z > 2.3,
    'rear input, recessed passage, front output, and bearings occupy real depth');
  assert.ok(bounds.min.z < -1.12);
  const rearRing = fixedRearBearingRing.geometry;
  rearRing.computeBoundingBox();
  assert.ok(rearRing.type !== 'TorusGeometry' && rearRing.boundingBox.max.z - rearRing.boundingBox.min.z < 0.16);
  assert.ok(bounds.max.z > 1.17);
  assert.equal(model.cameraDirection.x, 0);
  assert.equal(model.cameraDirection.y, 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  // The next sequential model is now independently authored as Movement 178.
  const movement176 = createMovementModel(catalog.movements[175]);
  const movement178 = createMovementModel(catalog.movements[177]);
  assert.equal(movement176.root.userData.fidelity, 'authored');
  assert.equal(
    movement176.root.userData.mechanism,
    'coaxial-equal-radius-driver-driven-cranks-radial-slot-wall-engaged-wrist-pin-one-to-one',
  );
  assert.equal(catalog.movements[177].fidelity, 'authored');
  assert.equal(movement178.root.userData.fidelity, 'authored');
  assert.equal(
    movement178.root.userData.mechanism,
    'clockwise-eccentric-circular-groove-variable-radius-slotted-crank-finite-rod-horizontal-shaper-slide',
  );

  disposeModel(movement176.root);
  disposeModel(movement178.root);
  disposeModel(model.root);
});
