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

test('movement 176 keeps one rear wrist engaged with the radial slot of one coaxial output crank', () => {
  const movement = catalog.movements[175];
  const model = createMovementModel(movement);
  const {
    blocks,
    canonicalStates,
    geometry,
    modelPointToSourceRaster,
    sourcePointToModel,
    stateAtInputAngle,
    stateAtTime,
  } = model.root.userData;
  const {
    contactMarker,
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
    selectorCenterAnchor,
    selectorIndex,
    selectorLeftGroove,
    selectorLeftLobe,
    selectorLeftWall,
    selectorRightGroove,
    selectorRightLobe,
    selectorRightWall,
    selectorRing,
    selectorSlotAxisAnchor,
    wristCenterAnchor,
    wristFaceIndex,
    wristFaceOutline,
    wristPin,
    wristPinAssembly,
  } = blocks;

  assert.equal(movement.id, 176);
  assert.equal(movement.number, '176');
  assert.equal(
    movement.title,
    'Engaged Rotatable-Slotted-Ring Engine Coupling',
  );
  assert.equal(movement.category, 'Cranks & reciprocation');
  assert.equal(
    movement.description,
    '176 and 177. Contrivance for uncoupling engines. The wrist which is fixed on one arm of the crank (not shown) will communicate motion to the arm of the crank which is represented, when the ring on the latter has its slot in the position shown in 176. But when the ring is turned to bring the slot in the position shown in 177, the wrist passes through the slot without turning the crank to which said ring is attached.',
  );
  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_176.html');
  assert.equal(
    movement.archetype,
    'coaxial-equal-throw-cranks-radial-slotted-ring-engaged-wrist-pin-coupling',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'coaxial-equal-radius-driver-driven-cranks-radial-slot-wall-engaged-wrist-pin-one-to-one',
  );
  assert.equal(typeof modelPointToSourceRaster, 'function');
  assert.equal(typeof sourcePointToModel, 'function');
  assert.equal(typeof stateAtInputAngle, 'function');
  assert.equal(typeof stateAtTime, 'function');

  // The omitted source arm is made explicit behind the depicted output arm.
  // These remain separate coaxial rotors; only one wrist-to-wall contact
  // transfers motion between them.
  for (const object of [
    contactMarker,
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
    selectorCenterAnchor,
    selectorIndex,
    selectorLeftGroove,
    selectorLeftLobe,
    selectorLeftWall,
    selectorRightGroove,
    selectorRightLobe,
    selectorRightWall,
    selectorRing,
    selectorSlotAxisAnchor,
    wristCenterAnchor,
    wristFaceIndex,
    wristFaceOutline,
    wristPin,
    wristPinAssembly,
  ]) assert.ok(object?.isObject3D);
  assert.equal(inputCrank.parent, model.root);
  assert.equal(outputCrank.parent, model.root);
  assert.equal(wristPinAssembly.parent, model.root);
  assert.notEqual(inputCrank, outputCrank);
  assert.notEqual(inputShaft, outputShaft);
  assert.equal(inputWristAnchor.parent, inputCrank);
  assert.equal(selectorRing.parent, outputCrank);
  assert.equal(outputRingCenterAnchor.parent, outputCrank);
  assert.equal(selectorLeftWall.userData.contactSurface, true);
  assert.equal(selectorRightWall.userData.contactSurface, true);
  assert.equal(fixedFrontBearing.userData.fixed, true);
  assert.equal(fixedRearBearing.userData.fixed, true);
  assert.equal(motionEnvelope.userData.witnessOnly, true);
  vectorNear(inputCrank.userData.axis, Z_AXIS, 0,
    'rear input crank axis');
  vectorNear(outputCrank.userData.axis, Z_AXIS, 0,
    'front output crank axis');
  vectorNear(inputShaft.userData.axis, Z_AXIS, 0,
    'rear input shaft axis');
  vectorNear(outputShaft.userData.axis, Z_AXIS, 0,
    'front output shaft axis');
  vectorNear(wristPinAssembly.userData.axis, Z_AXIS, 0,
    'projecting wrist axis');
  vectorNear(selectorRing.userData.slotAxisLocal,
    new THREE.Vector3(0, 1, 0), 0,
    'engaged selector slot is radial in output coordinates');
  assert.equal(selectorRing.userData.relativeAngle, 0);
  assert.equal(outputCrankPlate.userData.openingCount, 2);
  assert.equal(outputCrankPlate.geometry.parameters.shapes.holes.length, 2,
    'shaft and selector openings are real holes');

  const forbiddenStandIns = [];
  const topologyCounts = {
    inputCrank: 0,
    outputCrank: 0,
    selectorRing: 0,
    wrist: 0,
  };
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (role === 'rear-input-crank-with-fixed-wrist') {
      topologyCounts.inputCrank += 1;
    }
    if (role === 'front-output-crank-carrying-selector-ring') {
      topologyCounts.outputCrank += 1;
    }
    if (role === 'radially-oriented-engaged-slotted-selector-ring') {
      topologyCounts.selectorRing += 1;
    }
    if (role === 'input-fixed-wrist-spanning-the-selector-plane') {
      topologyCounts.wrist += 1;
    }
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
    selectorRing: 1,
    wrist: 1,
  });
  assert.deepEqual(forbiddenStandIns, []);

  // The source elevation is locked to measured centers and radii. The lower
  // shaft is the origin; the upper ring and wrist share the equal throw.
  assert.equal(geometry.sourceImageWidth, 525);
  assert.equal(geometry.sourceImageHeight, 525);
  near(geometry.sourceScale, 0.010, 0, 'source raster scale');
  vectorNear(geometry.sourceMainShaftCenter,
    new THREE.Vector2(278, 430), 0,
    'source lower shaft center');
  vectorNear(geometry.sourceRingCenter,
    new THREE.Vector2(278, 91), 0,
    'source selector-ring center');
  vectorNear(geometry.sourceWristCenter,
    new THREE.Vector2(277, 91), 0,
    'source input-wrist center');
  assert.equal(geometry.sourceBottomOuterRadius, 80);
  assert.equal(geometry.sourceTopOuterRadius, 76);
  assert.equal(geometry.sourceWristRadius, 28);
  assert.equal(geometry.sourceSlotHalfWidth, 29);
  near(geometry.crankRadius, 3.39, 0, 'equal crank throw');
  near(geometry.bottomOuterRadius, 0.80, 0,
    'source-scaled lower hub radius');
  near(geometry.topOuterRadius, 0.76, 0,
    'source-scaled selector-head radius');
  near(geometry.wristPinRadius, 0.28, 0,
    'source-scaled wrist radius');
  near(geometry.slotHalfWidth, 0.29, 0,
    'source-scaled slot half-width');
  near(geometry.contactOffset, 0.01, 5e-17,
    'source backlash taken up at one wall');
  near(
    Math.sin(geometry.contactLag) * geometry.crankRadius,
    geometry.contactOffset,
    2e-18,
    'phase lag exactly takes up tangential slot clearance',
  );
  vectorNear(sourcePointToModel(geometry.sourceMainShaftCenter),
    new THREE.Vector2(0, 0), 0,
    'source lower shaft maps to model origin');
  vectorNear(sourcePointToModel(geometry.sourceRingCenter),
    new THREE.Vector2(0, geometry.crankRadius), 0,
    'source head maps to the output throw');
  vectorNear(sourcePointToModel(geometry.sourceWristCenter),
    new THREE.Vector2(-geometry.contactOffset, geometry.crankRadius),
    1e-16,
    'source wrist maps one raster pixel toward the contact wall');
  vectorNear(modelPointToSourceRaster(new THREE.Vector2(0, 0)),
    geometry.sourceMainShaftCenter, 0,
    'model origin returns to source lower shaft');
  vectorNear(modelPointToSourceRaster(
    new THREE.Vector2(0, geometry.crankRadius)),
  geometry.sourceRingCenter, 0,
  'model output head returns to source center');

  // At Brown's pose the depicted output arm is exactly upright, while the
  // hidden input leads only by the amount needed to put its wrist on the
  // trailing wall of the radial slot.
  const source = canonicalStates.sourceEngaged;
  near(source.outputAngle, 0, 0, 'source output angle');
  near(source.inputAngle, geometry.contactLag, 0,
    'source input backlash-lead angle');
  near(source.phaseLag, geometry.contactLag, 0,
    'source input/output phase lag');
  vectorNear(source.outputRingCenter,
    new THREE.Vector2(0, geometry.crankRadius), 0,
    'source output-ring position');
  near(source.inputWrist.x, -geometry.contactOffset, 2e-17,
    'source wrist tangential contact offset');
  near(
    modelPointToSourceRaster(source.inputWrist).x,
    geometry.sourceWristCenter.x,
    3e-14,
    'rendered wrist source-raster x lock',
  );
  near(
    modelPointToSourceRaster(source.inputWrist).y,
    91.00147492946226,
    2e-12,
    'rendered wrist source-raster y lock',
  );
  assert.equal(source.selectorEngaged, true);
  assert.equal(source.selectorSlotOrientation,
    'radial-to-output-crank');
  assert.equal(source.selectorAngleRelativeToOutput, 0);
  assert.equal(source.contactSide, 'left-trailing-slot-wall');
  near(source.tangentialOffset, -geometry.contactOffset, 2e-17,
    'source tangential wrist offset');
  assert.ok(source.radialOffset < 0);
  assert.ok(Math.abs(source.radialOffset) < 1.5e-5);
  near(source.contactGap, 0, 0,
    'source pin surface touches its slot wall');
  near(source.contactError, 0, 0,
    'source pin and wall contact points coincide');
  assert.ok(source.radialEndClearance > 0.267,
    'wrist clears both radial slot ends');

  // Every quarter turn preserves equal throw, radial slot orientation, exact
  // wall contact, and 1:1 angular speed between the independent shafts.
  for (const [name, state, expectedOutputAngle] of [
    ['source', canonicalStates.sourceEngaged, 0],
    ['quarter', canonicalStates.quarterTurn, Math.PI / 2],
    ['half', canonicalStates.halfTurn, Math.PI],
    ['three-quarter', canonicalStates.threeQuarterTurn, Math.PI * 1.5],
    ['full', canonicalStates.fullTurn, 0],
  ]) {
    near(state.outputAngle, expectedOutputAngle, 2e-15,
      `${name} output angle`);
    near(state.inputWrist.length(), geometry.crankRadius, 5e-16,
      `${name} input throw`);
    near(state.outputRingCenter.length(), geometry.crankRadius, 5e-16,
      `${name} output throw`);
    near(state.phaseLag, geometry.contactLag, 5e-16,
      `${name} constant contact phase lag`);
    near(state.inputAngularSpeed, geometry.inputAngularSpeed, 0,
      `${name} input angular speed`);
    near(state.outputAngularSpeed, geometry.inputAngularSpeed, 0,
      `${name} output angular speed`);
    near(state.inputOutputAngularSpeedRatio, 1, 0,
      `${name} direct speed ratio`);
    near(state.inputAngularAcceleration, 0, 0,
      `${name} uniform input rotation`);
    near(state.outputAngularAcceleration, 0, 0,
      `${name} uniform output rotation`);
    near(state.contactGap, 0, 2e-15,
      `${name} wall contact gap`);
    near(state.contactError, 0, 2e-15,
      `${name} coincident contact points`);
    near(state.tangentialOffset, -geometry.contactOffset, 1.2e-15,
      `${name} tangential backlash take-up`);
    assert.ok(state.radialEndClearance > 0.267);
    near(state.slotRadialAxis.dot(state.slotTangentialAxis), 0, 2e-16,
      `${name} orthogonal slot frame`);
    near(state.slotRadialAxis.length(), 1, 2e-16,
      `${name} unit radial slot axis`);
    near(state.slotTangentialAxis.length(), 1, 2e-16,
      `${name} unit slot-wall normal`);
    vectorNear(state.pinContactPoint, state.wallContactPoint, 2e-15,
      `${name} unique wrist-to-wall contact`);
  }

  // Dense sampling independently checks the complete engaged revolution. A
  // disconnected or generic coaxial pair would fail either the contact or
  // constant-phase conditions even if it happened to spin at the same rate.
  const denseSampleCount = 65536;
  let maximumContactError = 0;
  let maximumContactGap = 0;
  let maximumPhaseError = 0;
  let minimumEndClearance = Infinity;
  let maximumInputStep = 0;
  let maximumOutputStep = 0;
  let previousState = stateAtInputAngle(geometry.sourceInputAngle);
  for (let index = 0; index <= denseSampleCount; index += 1) {
    const inputAngle = geometry.sourceInputAngle
      + FULL_TURN * index / denseSampleCount;
    const state = stateAtInputAngle(inputAngle);
    maximumContactError = Math.max(
      maximumContactError,
      Math.abs(state.contactError),
    );
    maximumContactGap = Math.max(
      maximumContactGap,
      Math.abs(state.contactGap),
    );
    maximumPhaseError = Math.max(
      maximumPhaseError,
      Math.abs(state.phaseLag - geometry.contactLag),
    );
    minimumEndClearance = Math.min(
      minimumEndClearance,
      state.radialEndClearance,
    );
    maximumInputStep = Math.max(
      maximumInputStep,
      state.inputWrist.distanceTo(previousState.inputWrist),
    );
    maximumOutputStep = Math.max(
      maximumOutputStep,
      state.outputRingCenter.distanceTo(
        previousState.outputRingCenter,
      ),
    );
    near(state.inputWrist.length(), geometry.crankRadius, 1e-15,
      'dense constant input throw');
    near(state.outputRingCenter.length(), geometry.crankRadius, 1e-15,
      'dense constant output throw');
    assert.equal(state.selectorEngaged, true);
    assert.equal(state.selectorAngleRelativeToOutput, 0);
    assert.equal(state.inputOutputAngularSpeedRatio, 1);
    previousState = state;
  }
  assert.ok(maximumContactError < 3.2e-15);
  assert.ok(maximumContactGap < 3.2e-15);
  assert.ok(maximumPhaseError < 8.9e-16);
  assert.ok(minimumEndClearance > 0.267);
  assert.ok(maximumInputStep < 0.000326,
    'input wrist advances continuously');
  assert.ok(maximumOutputStep < 0.000326,
    'engaged output advances continuously');

  // Analytical uniform-circular velocities and accelerations agree with
  // independent angle-domain finite differences for both coaxial cranks.
  const derivativeStep = 2e-5;
  for (const inputAngle of [0.27, 1.16, 2.31, 3.76, 5.42]) {
    const before = stateAtInputAngle(inputAngle - derivativeStep);
    const state = stateAtInputAngle(inputAngle);
    const after = stateAtInputAngle(inputAngle + derivativeStep);
    const numericalInputVelocity = after.inputWrist.clone()
      .sub(before.inputWrist)
      .multiplyScalar(
        geometry.inputAngularSpeed / (2 * derivativeStep),
      );
    const numericalOutputVelocity = after.outputRingCenter.clone()
      .sub(before.outputRingCenter)
      .multiplyScalar(
        geometry.inputAngularSpeed / (2 * derivativeStep),
      );
    vectorNear(numericalInputVelocity, state.inputWristVelocity,
      2e-9, 'analytic input-wrist velocity');
    vectorNear(numericalOutputVelocity,
      state.outputRingCenterVelocity, 2e-9,
      'analytic output-ring velocity');
    const numericalInputAcceleration = after.inputWrist.clone()
      .add(before.inputWrist)
      .addScaledVector(state.inputWrist, -2)
      .multiplyScalar(
        geometry.inputAngularSpeed ** 2 / derivativeStep ** 2,
      );
    const numericalOutputAcceleration = after.outputRingCenter.clone()
      .add(before.outputRingCenter)
      .addScaledVector(state.outputRingCenter, -2)
      .multiplyScalar(
        geometry.inputAngularSpeed ** 2 / derivativeStep ** 2,
      );
    vectorNear(numericalInputAcceleration,
      state.inputWristAcceleration, 1.1e-6,
      'analytic input-wrist acceleration');
    vectorNear(numericalOutputAcceleration,
      state.outputRingCenterAcceleration, 1.1e-6,
      'analytic output-ring acceleration');
  }

  // A complete timed revolution returns both rotors and their one contact to
  // the source pose without rotating the selector relative to its crank.
  const timedStart = stateAtTime(0);
  const timedEnd = stateAtTime(geometry.cyclePeriod);
  vectorNear(timedEnd.inputWrist, timedStart.inputWrist, 2e-15,
    'timed input periodicity');
  vectorNear(timedEnd.outputRingCenter,
    timedStart.outputRingCenter, 2e-15,
    'timed output periodicity');
  vectorNear(timedEnd.pinContactPoint,
    timedStart.pinContactPoint, 2e-15,
    'timed contact periodicity');
  near(
    timedEnd.inputUnwrappedAngle - timedStart.inputUnwrappedAngle,
    FULL_TURN,
    2e-15,
    'one full input revolution per cycle',
  );
  near(
    timedEnd.outputUnwrappedAngle - timedStart.outputUnwrappedAngle,
    FULL_TURN,
    2e-15,
    'one full output revolution per cycle',
  );

  // The wrist bridges the rear crank and recessed selector planes but stops
  // before the front cheek. The two coaxial shafts remain physically split.
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
  assert.ok(inputShaftFrontZ < outputShaftBackZ,
    'input and output shafts are separate coaxial members');
  near(inputCrank.position.x, 0, 0, 'input shaft center x');
  near(inputCrank.position.y, 0, 0, 'input shaft center y');
  near(outputCrank.position.x, 0, 0, 'output shaft center x');
  near(outputCrank.position.y, 0, 0, 'output shaft center y');
  near(geometry.axialPlaneSeparation,
    source.axialPlaneSeparation, 0,
    'reported axial plane separation');

  // Rendered anchors close the analytical chain, including the radial slot
  // direction and exact contact point, while both bearing rings stay fixed.
  model.update(0, 0.016);
  model.root.updateMatrixWorld(true);
  const frontBearingMatrix = fixedFrontBearing.matrixWorld.clone();
  const rearBearingMatrix = fixedRearBearing.matrixWorld.clone();
  for (const time of [0, 0.8, 2.1, 4.0, 6.7, 9.2, 12.8]) {
    model.update(time, 0.016);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    near(inputCrank.rotation.z, state.inputAngle, 0,
      'rendered input angle');
    near(outputCrank.rotation.z, state.outputAngle, 0,
      'rendered output angle');
    near(selectorRing.rotation.z, 0, 0,
      'selector stays radial to output crank');
    vector2Near(inputWristAnchor.getWorldPosition(new THREE.Vector3()),
      state.inputWrist, 1.5e-15,
      'rendered wrist anchor fixed to input crank');
    vector2Near(wristCenterAnchor.getWorldPosition(new THREE.Vector3()),
      state.inputWrist, 0,
      'rendered projecting wrist center');
    vector2Near(outputRingCenterAnchor.getWorldPosition(
      new THREE.Vector3()), state.outputRingCenter, 1.5e-15,
    'rendered output-ring center');
    vector2Near(selectorCenterAnchor.getWorldPosition(
      new THREE.Vector3()), state.outputRingCenter, 1.5e-15,
    'rendered selector center');
    vector2Near(contactMarker.getWorldPosition(new THREE.Vector3()),
      state.pinContactPoint, 0,
      'rendered wrist-to-wall contact');
    const renderedSlotAxis = selectorSlotAxisAnchor
      .getWorldPosition(new THREE.Vector3())
      .sub(selectorCenterAnchor.getWorldPosition(new THREE.Vector3()))
      .setZ(0)
      .normalize();
    vector2Near(renderedSlotAxis, state.slotRadialAxis, 8e-16,
      'rendered selector slot remains radial');
    assert.ok(fixedFrontBearing.matrixWorld.equals(frontBearingMatrix));
    assert.ok(fixedRearBearing.matrixWorld.equals(rearBearingMatrix));
  }

  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 8.31);
  assert.ok(size.y > 8.31,
    'full crank witness keeps every rotated pose in the camera envelope');
  // Pass 93: the rear bearing is a bored ring seated on the input shaft (no
  // loose torus past its end), so the shaft's end sets the rear depth.
  assert.ok(size.z > 2.3,
    'rear input, selector, front output, shafts, and bearings occupy real depth');
  assert.ok(bounds.min.z < -1.12);
  assert.ok(fixedRearBearingRing.geometry.type !== 'TorusGeometry');
  assert.ok(bounds.max.z > 1.17);
  assert.equal(model.cameraDirection.x, 0);
  assert.equal(model.cameraDirection.y, 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  // The paired next model is now independently authored as Movement 177.
  const movement175 = createMovementModel(catalog.movements[174]);
  const movement177 = createMovementModel(catalog.movements[176]);
  assert.equal(movement175.root.userData.fidelity, 'authored');
  assert.equal(
    movement175.root.userData.mechanism,
    'tangent-branch-transfer-engraving-fit-two-crank-turn-piston-cycle',
  );
  assert.equal(catalog.movements[176].fidelity, 'authored');
  assert.equal(movement177.root.userData.fidelity, 'authored');
  assert.equal(
    movement177.root.userData.mechanism,
    'coaxial-equal-radius-input-crank-fixed-output-quarter-turned-curved-tangential-slot-wrist-clearance',
  );
  assert.notEqual(movement177.root.userData.mechanism,
    model.root.userData.mechanism);

  disposeModel(movement175.root);
  disposeModel(movement177.root);
  disposeModel(model.root);
});
