import {createAuthoredVariableCrankMovement} from '../src/simulation/authored-variable-cranks.js';
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

function vector2Near(actual, expected, tolerance, message) {
  const actual2 = new THREE.Vector2(actual.x, actual.y);
  const expected2 = new THREE.Vector2(expected.x, expected.y);
  assert.ok(
    actual2.distanceTo(expected2) <= tolerance,
    `${message}: expected ${expected2.toArray()}, received ${actual2.toArray()}`,
  );
}

function vector3Near(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function modulo(value, modulus) {
  const remainder = value % modulus;
  return remainder < 0 ? remainder + modulus : remainder;
}

test('movement 178 closes one rotating radial slot through a fixed eccentric circular groove and finite shaper rod', () => {
  const movement = catalog.movements[177];
  const model = createAuthoredVariableCrankMovement(movement, {reference:true});
  const {
    animationPointToModel,
    blocks,
    canonicalStates,
    geometry,
    modelPointToAnimation,
    modelPointToSourceRaster,
    sourceRasterPointToModel,
    stateAtCyclePhase,
    stateAtInputAngle,
    stateAtTime,
  } = model.root.userData;
  const {
    cameraEnvelope,
    circularGrooveShoe,
    connectingRod,
    connectingRodBeam,
    connectingRodOutputEye,
    connectingRodSliderEye,
    crankBody,
    crankHub,
    crankHubOutline,
    crankSlotFarAnchor,
    crankSlotNearAnchor,
    crankSlotOutline,
    cuttingToolBar,
    cuttingToolTip,
    fixedDiskCenterAnchor,
    fixedShaftBearing,
    grooveCenterlineWitness,
    grooveInnerWall,
    grooveOuterWall,
    innerBossInnerOutline,
    innerBossOuterOutline,
    innerPlate,
    inputCrank,
    inputRotationIndex,
    inputShaft,
    inputSliderAnchor,
    outerDiskOutline,
    outerPlate,
    outputGuideEndAnchor,
    outputGuideEndStops,
    outputGuideRails,
    outputGuideStartAnchor,
    outputPin,
    outputPinAnchor,
    outputPinOutline,
    outputSlide,
    outputSlideBody,
    outputSlideIndex,
    outputStrokeWitness,
    radialSlotShoe,
    shaftCenterAnchor,
    sliderAssembly,
    sliderBlock,
    sliderCenterAnchor,
    sliderFrontBoss,
    sliderFrontOutline,
    sliderRotationIndex,
  } = blocks;

  assert.equal(movement.id, 178);
  assert.equal(movement.number, '178');
  assert.equal(
    movement.title,
    'Eccentric Circular-Groove Variable-Speed Shaper Drive',
  );
  assert.equal(movement.category, 'Cams & followers');
  assert.equal(
    movement.description,
    '178. Contrivance for varying the speed of the slide carrying the cutting tool in slotting and shaping machines, etc. The driving-shaft works through an opening in a fixed disk, in which is a circular slot. At the end of the said shaft is a slotted crank. A slide fits in the slot of the crank and in the circular slot; and to the outward extremity of this slide is attached the connecting-rod which works the slide carrying the cutting tool. When the driving-shaft rotates the crank is carried round, and the slide carrying the end of the connecting-rod is guided by the circular slot, which is placed eccentrically to the shaft; therefore, as the slide approaches the bottom, the length of the crank is shortened and the speed of the connecting-rod is diminished.',
  );
  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_178.html');
  assert.equal(
    movement.archetype,
    'eccentric-fixed-circular-groove-variable-radius-slotted-crank-finite-rod-horizontal-shaper-slide',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'clockwise-eccentric-circular-groove-variable-radius-slotted-crank-finite-rod-horizontal-shaper-slide',
  );
  for (const fn of [
    animationPointToModel,
    modelPointToAnimation,
    modelPointToSourceRaster,
    sourceRasterPointToModel,
    stateAtCyclePhase,
    stateAtInputAngle,
    stateAtTime,
  ]) {
    assert.equal(typeof fn, 'function');
  }

  // The assembly exposes every physical layer separately: a genuinely open
  // annular groove, one rotating slotted crank, one dual-constrained slide,
  // one finite rod, and one nonrotating horizontal output crosshead.
  for (const object of [
    cameraEnvelope,
    circularGrooveShoe,
    connectingRod,
    connectingRodBeam,
    connectingRodOutputEye,
    connectingRodSliderEye,
    crankBody,
    crankHub,
    crankHubOutline,
    crankSlotFarAnchor,
    crankSlotNearAnchor,
    crankSlotOutline,
    cuttingToolBar,
    cuttingToolTip,
    fixedDiskCenterAnchor,
    fixedShaftBearing,
    grooveCenterlineWitness,
    grooveInnerWall,
    grooveOuterWall,
    innerBossInnerOutline,
    innerBossOuterOutline,
    innerPlate,
    inputCrank,
    inputRotationIndex,
    inputShaft,
    inputSliderAnchor,
    outerDiskOutline,
    outerPlate,
    outputGuideEndAnchor,
    outputGuideStartAnchor,
    outputPin,
    outputPinAnchor,
    outputPinOutline,
    outputSlide,
    outputSlideBody,
    outputSlideIndex,
    outputStrokeWitness,
    radialSlotShoe,
    shaftCenterAnchor,
    sliderAssembly,
    sliderBlock,
    sliderCenterAnchor,
    sliderFrontBoss,
    sliderFrontOutline,
    sliderRotationIndex,
  ]) {
    assert.ok(object?.isObject3D, `${object?.userData?.role ?? 'block'} is 3D`);
  }
  assert.equal(outputGuideRails.length, 2);
  assert.equal(outputGuideEndStops.length, 2);
  assert.ok(outputGuideRails.every(({ parent }) => parent === model.root));
  assert.ok(outputGuideEndStops.every(({ parent }) => parent === model.root));
  assert.equal(inputCrank.parent, model.root);
  assert.equal(sliderAssembly.parent, model.root);
  assert.equal(connectingRod.parent, model.root);
  assert.equal(outputSlide.parent, model.root);
  assert.equal(circularGrooveShoe.parent, sliderAssembly);
  assert.equal(radialSlotShoe.parent, sliderAssembly);
  assert.equal(inputShaft.parent, inputCrank);
  assert.equal(crankBody.parent, inputCrank);
  assert.equal(outputPin.parent, outputSlide);
  assert.equal(outerPlate.material.transparent, false);
  assert.equal(innerPlate.material.transparent, false);
  assert.equal(outerPlate.material.depthWrite, true);
  assert.equal(innerPlate.material.depthWrite, true);
  assert.equal(grooveInnerWall.userData.contactSurface, true);
  assert.equal(grooveOuterWall.userData.contactSurface, true);
  assert.equal(crankSlotOutline.userData.contactSurface, true);
  assert.equal(cameraEnvelope.material.colorWrite, false);
  assert.equal(cameraEnvelope.userData.cameraFramingEnvelope, true);
  assert.equal(cameraEnvelope.userData.cameraFitGuide, true);
  assert.equal(model.root.userData.materialsIgnoreSceneFog, true);
  model.root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) assert.equal(material.fog, false);
  });

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.equal(
    roles.filter((role) => role
      === 'clockwise-input-shaft-and-radially-slotted-crank').length,
    1,
  );
  assert.equal(
    roles.filter((role) => role
      === 'single-slide-fitting-radial-crank-slot-and-fixed-circular-groove')
      .length,
    1,
  );
  assert.equal(
    roles.filter((role) => role
      === 'finite-connecting-rod-from-dual-slide-to-horizontal-tool-slide')
      .length,
    1,
  );
  assert.equal(
    roles.filter((role) => role
      === 'nonrotating-horizontal-cutting-tool-slide').length,
    1,
  );

  // Exact locks from the reference animation establish the ideal closure.
  assert.deepEqual(geometry.sourceAnimationViewMinimum.toArray(), [-9, -9]);
  assert.deepEqual(geometry.sourceAnimationViewSize.toArray(), [18, 18]);
  near(geometry.sourceAnimationGrooveInnerRadius, 5, 0,
    'reference inner groove radius');
  near(geometry.sourceAnimationGrooveOuterRadius, 5.5, 0,
    'reference outer groove radius');
  near(geometry.sourceAnimationGrooveCenterRadius, 5.25, 0,
    'reference block-center path radius');
  near(geometry.sourceAnimationOuterDiskRadius, 6.25, 0,
    'reference fixed disk radius');
  near(geometry.sourceAnimationInnerBossOuterRadius, 3, 0,
    'reference inner-disk outer outline');
  near(geometry.sourceAnimationInnerBossInnerRadius, 2.75, 0,
    'reference inner-disk inner outline');
  assert.deepEqual(geometry.sourceAnimationShaftCenter.toArray(), [0, -2]);
  near(geometry.sourceAnimationCrankReach, 8, 0,
    'reference radial crank reach');
  near(geometry.sourceAnimationCrankBodyHalfWidth, 0.75, 0,
    'reference crank-body half width');
  near(geometry.sourceAnimationCrankSlotHalfWidth, 0.25, 0,
    'reference crank-slot half width');
  near(geometry.sourceAnimationSliderShoeRadius, 0.25, 0,
    'reference circular guide shoe radius');
  near(geometry.sourceAnimationConnectingRodLength, 25, 0,
    'reference finite rod length');
  assert.deepEqual(
    geometry.sourceAnimationOutputGuideStart.toArray(),
    [-17.5, 0],
  );
  assert.deepEqual(
    geometry.sourceAnimationOutputGuideEnd.toArray(),
    [-31.5, 0],
  );
  near(geometry.sourceAnimationSourceCycle, 0, 0,
    'reference source cycle');
  near(geometry.sourceAnimationInputTurnsPerCycle, -1, 0,
    'reference clockwise turn per cycle');

  // The hand-drawn source locks preserve Brown's source pose and proportions
  // without pretending its irregular ink circles are an exact construction.
  assert.equal(geometry.sourceImageWidth, 525);
  assert.equal(geometry.sourceImageHeight, 525);
  assert.deepEqual(geometry.sourceRasterDiskCenter.toArray(), [295, 245]);
  near(geometry.sourceRasterOuterDiskRadius, 205, 0,
    'engraving outer disk radius');
  near(geometry.sourceRasterGrooveInnerRadius, 160, 0,
    'engraving groove inner radius');
  near(geometry.sourceRasterGrooveOuterRadius, 181, 0,
    'engraving groove outer radius');
  assert.deepEqual(geometry.sourceRasterShaftCenter.toArray(), [295, 321]);
  assert.deepEqual(geometry.sourceRasterSliderCenter.toArray(), [295, 77]);
  assert.deepEqual(
    geometry.sourceRasterConnectingRodCropPoint.toArray(),
    [39, 154],
  );
  assert.equal(geometry.sourceRasterCrankBodyLeftX, 270);
  assert.equal(geometry.sourceRasterCrankBodyRightX, 320);
  assert.equal(geometry.sourceRasterCrankBodyTopY, 7);
  assert.equal(geometry.sourceRasterCrankBodyBottomY, 358);

  vector2Near(
    animationPointToModel(new THREE.Vector2(0, 0)),
    geometry.fixedDiskCenter,
    0,
    'reference origin maps to fixed disk center',
  );
  vector2Near(
    animationPointToModel(geometry.sourceAnimationShaftCenter),
    geometry.shaftCenter,
    0,
    'reference eccentric shaft maps into the model',
  );
  vector2Near(
    modelPointToAnimation(geometry.fixedDiskCenter),
    new THREE.Vector2(0, 0),
    0,
    'model fixed center maps back to reference origin',
  );
  vector2Near(
    modelPointToAnimation(geometry.shaftCenter),
    geometry.sourceAnimationShaftCenter,
    1e-15,
    'model shaft maps back to reference eccentricity',
  );
  vector2Near(
    modelPointToSourceRaster(geometry.fixedDiskCenter),
    geometry.sourceRasterDiskCenter,
    0,
    'model fixed center maps to engraving center',
  );
  vector2Near(
    sourceRasterPointToModel(geometry.sourceRasterDiskCenter),
    geometry.fixedDiskCenter,
    0,
    'engraving center maps back to model center',
  );
  const predictedRasterShaft = modelPointToSourceRaster(geometry.shaftCenter);
  assert.ok(predictedRasterShaft.distanceTo(
    geometry.sourceRasterShaftCenter) < 12);
  const predictedRasterTopSlider = modelPointToSourceRaster(
    canonicalStates.sourceTopMaximumRadius.sliderPoint,
  );
  assert.ok(predictedRasterTopSlider.distanceTo(
    geometry.sourceRasterSliderCenter) < 6);
  const predictedRasterOuterRight = modelPointToSourceRaster(
    geometry.fixedDiskCenter.clone().add(
      new THREE.Vector2(geometry.outerDiskRadius, 0),
    ),
  );
  near(
    predictedRasterOuterRight.x,
    geometry.sourceRasterDiskCenter.x + geometry.sourceRasterOuterDiskRadius,
    1e-12,
    'engraving outer-right lock',
  );

  // All model dimensions retain the exact ideal ratios.
  near(
    geometry.grooveInnerRadius,
    geometry.sourceAnimationGrooveInnerRadius * geometry.sourceScale,
    0,
    'scaled inner groove radius',
  );
  near(
    geometry.grooveOuterRadius,
    geometry.sourceAnimationGrooveOuterRadius * geometry.sourceScale,
    0,
    'scaled outer groove radius',
  );
  near(
    geometry.grooveCenterRadius,
    (geometry.grooveInnerRadius + geometry.grooveOuterRadius) / 2,
    4e-16,
    'shoe center follows middle of annular groove',
  );
  near(
    geometry.grooveHalfWidth,
    (geometry.grooveOuterRadius - geometry.grooveInnerRadius) / 2,
    0,
    'annular groove half width',
  );
  near(
    geometry.shaftEccentricity,
    2 * geometry.sourceScale,
    4e-16,
    'scaled shaft eccentricity',
  );
  near(
    geometry.connectingRodLength,
    25 * geometry.sourceScale,
    0,
    'scaled finite rod length',
  );
  near(
    geometry.crankReach,
    8 * geometry.sourceScale,
    0,
    'scaled crank reach',
  );
  near(
    geometry.minimumCrankRadius,
    geometry.grooveCenterRadius - geometry.shaftEccentricity,
    0,
    'minimum variable crank radius',
  );
  near(
    geometry.maximumCrankRadius,
    geometry.grooveCenterRadius + geometry.shaftEccentricity,
    0,
    'maximum variable crank radius',
  );
  near(
    geometry.outputStroke,
    2 * geometry.grooveCenterRadius,
    0,
    'horizontal stroke is the circular path diameter',
  );
  near(
    geometry.idealTopBottomSpeedRatio,
    geometry.maximumCrankRadius / geometry.minimumCrankRadius,
    0,
    'ideal source top-to-bottom speed ratio',
  );
  assert.ok(geometry.inputAngularSpeed < 0,
    'the input crank rotates clockwise');
  near(
    geometry.cyclePeriod,
    FULL_TURN / Math.abs(geometry.inputAngularSpeed),
    0,
    'one clockwise input revolution per cycle',
  );
  near(
    geometry.crankSlotHalfWidth - geometry.radialSlotShoeRadius,
    geometry.sliderFitClearance,
    3e-17,
    'radial shoe has explicit running clearance',
  );
  near(
    geometry.grooveHalfWidth - geometry.circularGrooveShoeRadius,
    geometry.sliderFitClearance,
    3e-17,
    'circular shoe has explicit running clearance',
  );

  // These points are the exact output of the reference construction at each
  // eighth-turn. They prove the selected outer ray/circle intersection and
  // the left-hand finite-rod branch, not merely a similar-looking ellipse.
  const referencePhaseStates = [
    [0, [0, 5.25], [-24.44253464761787, 0]],
    [0.125, [4.575087411518774, 2.575087411518773],
      [-20.29193743712441, 0]],
    [0.25, [4.8541219597369, -2], [-20.065749629017326, 0]],
    [0.375, [2.575087411518773, -4.575087411518773],
      [-22.002719145962356, 0]],
    [0.5, [0, -5.25], [-24.44253464761787, 0]],
    [0.625, [-2.575087411518773, -4.575087411518773],
      [-27.1528939689999, 0]],
    [0.75, [-4.8541219597369, -2], [-29.773993548491127, 0]],
    [0.875, [-4.575087411518774, 2.575087411518773],
      [-29.442112260161956, 0]],
    [1, [0, 5.25], [-24.44253464761787, 0]],
  ];
  for (const [phase, expectedSlider, expectedOutput] of referencePhaseStates) {
    const state = stateAtCyclePhase(phase);
    vector2Near(
      modelPointToAnimation(state.sliderPoint),
      new THREE.Vector2(...expectedSlider),
      2e-14,
      `reference slider point at cycle ${phase}`,
    );
    vector2Near(
      modelPointToAnimation(state.outputPoint),
      new THREE.Vector2(...expectedOutput),
      2e-14,
      `reference output point at cycle ${phase}`,
    );
    near(
      state.inputAngle,
      modulo(geometry.sourceInputAngle - phase * FULL_TURN, FULL_TURN),
      7e-16,
      `clockwise input angle at cycle ${phase}`,
    );
    near(
      state.connectingRodLength,
      geometry.connectingRodLength,
      4e-15,
      `finite rod length at cycle ${phase}`,
    );
  }

  const top = canonicalStates.sourceTopMaximumRadius;
  const rightExtreme = canonicalStates.maximumRightOutput;
  const right = canonicalStates.rightGrooveSide;
  const bottom = canonicalStates.bottomMinimumRadius;
  const left = canonicalStates.leftGrooveSide;
  const leftExtreme = canonicalStates.minimumLeftOutput;
  const nextTop = canonicalStates.nextSourceTopMaximumRadius;
  vector2Near(
    top.sliderPoint,
    geometry.fixedDiskCenter.clone().add(
      new THREE.Vector2(0, geometry.grooveCenterRadius),
    ),
    5e-16,
    'source slider is at the top of the fixed groove',
  );
  vector2Near(
    bottom.sliderPoint,
    geometry.fixedDiskCenter.clone().add(
      new THREE.Vector2(0, -geometry.grooveCenterRadius),
    ),
    5e-16,
    'half-cycle slider is at the bottom of the fixed groove',
  );
  near(top.variableCrankRadius, geometry.maximumCrankRadius, 0,
    'top crank radius is maximum');
  near(bottom.variableCrankRadius, geometry.minimumCrankRadius, 5e-16,
    'bottom crank radius is minimum');
  assert.equal(
    top.stage,
    'top-maximum-crank-radius-fastest-horizontal-slide-speed',
  );
  assert.equal(
    bottom.stage,
    'bottom-minimum-crank-radius-diminished-horizontal-slide-speed',
  );
  assert.ok(top.outputVelocity.x > 0);
  assert.ok(bottom.outputVelocity.x < 0);
  near(
    Math.abs(top.outputVelocity.x / bottom.outputVelocity.x),
    geometry.idealTopBottomSpeedRatio,
    2e-15,
    'horizontal slide has the exact top-to-bottom speed ratio',
  );
  vector2Near(
    right.sliderPoint,
    animationPointToModel(new THREE.Vector2(4.8541219597369, -2)),
    1e-15,
    'right cardinal guide point',
  );
  vector2Near(
    left.sliderPoint,
    animationPointToModel(new THREE.Vector2(-4.8541219597369, -2)),
    1e-15,
    'left cardinal guide point',
  );
  vector2Near(
    rightExtreme.sliderPoint,
    geometry.fixedDiskCenter.clone().add(
      new THREE.Vector2(geometry.grooveCenterRadius, 0),
    ),
    1e-15,
    'right output reversal occurs at right guide-axis crossing',
  );
  vector2Near(
    leftExtreme.sliderPoint,
    geometry.fixedDiskCenter.clone().add(
      new THREE.Vector2(-geometry.grooveCenterRadius, 0),
    ),
    2e-15,
    'left output reversal occurs at left guide-axis crossing',
  );
  near(
    rightExtreme.outputPosition,
    geometry.fixedDiskCenter.x + geometry.grooveCenterRadius
      - geometry.connectingRodLength,
    2e-15,
    'rightmost horizontal output coordinate',
  );
  near(
    leftExtreme.outputPosition,
    geometry.fixedDiskCenter.x - geometry.grooveCenterRadius
      - geometry.connectingRodLength,
    2e-15,
    'leftmost horizontal output coordinate',
  );
  near(rightExtreme.outputVelocity.x, 0, 2e-15,
    'rightmost output reversal speed');
  near(leftExtreme.outputVelocity.x, 0, 2e-15,
    'leftmost output reversal speed');
  assert.ok(rightExtreme.outputAcceleration.x < 0);
  assert.ok(leftExtreme.outputAcceleration.x > 0);
  assert.equal(rightExtreme.outputDirection, 'stroke-reversal');
  assert.equal(leftExtreme.outputDirection, 'stroke-reversal');
  near(
    rightExtreme.outputPosition - leftExtreme.outputPosition,
    geometry.outputStroke,
    3e-15,
    'exact full output stroke',
  );
  vector2Near(nextTop.sliderPoint, top.sliderPoint, 2e-15,
    'closed slider cycle');
  vector2Near(nextTop.outputPoint, top.outputPoint, 2e-15,
    'closed output cycle');

  // Exhaust every part of the closed path. The block must simultaneously
  // stay on the fixed circle, on the rotating slot centerline, within both
  // finite slot ends, and attached to a constant-length rod and guided output.
  const denseSamples = 32768;
  let sampledMinimumRadius = Number.POSITIVE_INFINITY;
  let sampledMaximumRadius = Number.NEGATIVE_INFINITY;
  let sampledMinimumOutput = Number.POSITIVE_INFINITY;
  let sampledMaximumOutput = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < denseSamples; index += 1) {
    const phase = index / denseSamples;
    const state = stateAtCyclePhase(phase);
    for (const value of [
      state.inputAngle,
      state.variableCrankRadius,
      state.variableCrankRadiusDerivative,
      state.variableCrankRadiusSecondDerivative,
      state.sliderPoint.x,
      state.sliderPoint.y,
      state.sliderVelocity.x,
      state.sliderVelocity.y,
      state.sliderAcceleration.x,
      state.sliderAcceleration.y,
      state.outputPosition,
      state.outputVelocity.x,
      state.outputAcceleration.x,
      state.connectingRodAngle,
      state.connectingRodAngularSpeed,
      state.connectingRodAngularAcceleration,
    ]) {
      assert.equal(Number.isFinite(value), true);
    }
    near(state.grooveRadiusVector.length(), geometry.grooveCenterRadius,
      2e-15, 'dense fixed circular-guide constraint');
    near(state.grooveRadiusError, 0, 2e-15,
      'dense circular-guide radius error');
    near(state.crankSlotCenterlineError, 0, 2e-15,
      'dense rotating radial-slot centerline');
    near(state.sliderPoint.clone().sub(geometry.shaftCenter).length(),
      state.variableCrankRadius, 2e-15,
      'dense variable crank radius');
    assert.ok(
      state.variableCrankRadius - geometry.radialSlotShoeRadius
        > geometry.crankSlotNearRadius,
      'slider shoe clears the near closed slot end',
    );
    assert.ok(
      state.variableCrankRadius + geometry.radialSlotShoeRadius
        < geometry.crankSlotFarRadius,
      'slider shoe clears the far closed slot end',
    );
    near(state.connectingRodLength, geometry.connectingRodLength, 6e-15,
      'dense finite connecting-rod closure');
    near(state.outputPoint.y, geometry.outputGuideY, 0,
      'dense horizontal output position constraint');
    near(state.outputVelocity.y, 0, 0,
      'dense horizontal output velocity constraint');
    near(state.outputAcceleration.y, 0, 0,
      'dense horizontal output acceleration constraint');
    assert.ok(
      state.outputPosition - geometry.outputSlideWidth / 2
        > geometry.outputGuideMinimumX,
      'crosshead clears the left guide end',
    );
    assert.ok(
      state.outputPosition + geometry.outputSlideWidth / 2
        < geometry.outputGuideMaximumX,
      'crosshead clears the right guide end',
    );
    near(state.crankSlotSurfaceClearance, geometry.sliderFitClearance,
      3e-17, 'equal radial-slot running clearance');
    near(state.grooveInnerSurfaceClearance, geometry.sliderFitClearance,
      3e-16, 'inner circular-groove running clearance');
    near(state.grooveOuterSurfaceClearance, geometry.sliderFitClearance,
      6e-16, 'outer circular-groove running clearance');
    near(state.crankSlotNormalVelocityError, 0, 2e-15,
      'dense radial slot normal velocity');
    near(state.grooveNormalVelocityError, 0, 3e-15,
      'dense circular groove normal velocity');
    near(state.grooveNormalAccelerationError, 0, 6e-15,
      'dense circular groove normal acceleration');
    near(state.connectingRodLengthRateError, 0, 4e-14,
      'dense rod length-rate closure');
    near(state.connectingRodLengthAccelerationError, 0, 7e-14,
      'dense rod length-acceleration closure');
    near(state.slotAxis.length(), 1, 3e-16,
      'dense radial slot unit axis');
    near(state.slotNormal.length(), 1, 3e-16,
      'dense radial slot unit normal');
    near(state.slotAxis.dot(state.slotNormal), 0, 2e-16,
      'dense orthogonal slot basis');
    sampledMinimumRadius = Math.min(
      sampledMinimumRadius,
      state.variableCrankRadius,
    );
    sampledMaximumRadius = Math.max(
      sampledMaximumRadius,
      state.variableCrankRadius,
    );
    sampledMinimumOutput = Math.min(
      sampledMinimumOutput,
      state.outputPosition,
    );
    sampledMaximumOutput = Math.max(
      sampledMaximumOutput,
      state.outputPosition,
    );
  }
  near(sampledMinimumRadius, geometry.minimumCrankRadius, 5e-15,
    'dense minimum variable crank radius');
  near(sampledMaximumRadius, geometry.maximumCrankRadius, 5e-15,
    'dense maximum variable crank radius');
  near(sampledMinimumOutput, leftExtreme.outputPosition, 3e-8,
    'dense left output extreme');
  near(sampledMaximumOutput, rightExtreme.outputPosition, 3e-8,
    'dense right output extreme');

  // Analytic first and second derivatives are audited independently against
  // central differences throughout the circle, then mapped through the
  // signed constant input speed into velocity and acceleration.
  const derivativeStep = 5e-5;
  for (let index = 0; index < 256; index += 1) {
    const angle = -Math.PI * 1.7 + index / 255 * FULL_TURN;
    const before = stateAtInputAngle(angle - derivativeStep);
    const state = stateAtInputAngle(angle);
    const after = stateAtInputAngle(angle + derivativeStep);
    const numericSliderDerivative = after.sliderPoint.clone()
      .sub(before.sliderPoint)
      .multiplyScalar(1 / (2 * derivativeStep));
    const numericSliderSecondDerivative = after.sliderPoint.clone()
      .add(before.sliderPoint)
      .addScaledVector(state.sliderPoint, -2)
      .multiplyScalar(1 / derivativeStep ** 2);
    vector2Near(
      numericSliderDerivative,
      state.sliderPointDerivative,
      6e-9,
      'analytic slider first derivative',
    );
    vector2Near(
      numericSliderSecondDerivative,
      state.sliderPointSecondDerivative,
      2e-6,
      'analytic slider second derivative',
    );
    near(
      (after.variableCrankRadius - before.variableCrankRadius)
        / (2 * derivativeStep),
      state.variableCrankRadiusDerivative,
      6e-9,
      'analytic variable-radius first derivative',
    );
    near(
      (after.variableCrankRadius - 2 * state.variableCrankRadius
        + before.variableCrankRadius) / derivativeStep ** 2,
      state.variableCrankRadiusSecondDerivative,
      2e-6,
      'analytic variable-radius second derivative',
    );
    near(
      (after.outputPosition - before.outputPosition)
        / (2 * derivativeStep),
      state.outputPositionDerivative,
      6e-9,
      'analytic output first derivative',
    );
    near(
      (after.outputPosition - 2 * state.outputPosition
        + before.outputPosition) / derivativeStep ** 2,
      state.outputPositionSecondDerivative,
      3e-6,
      'analytic output second derivative',
    );
    vector2Near(
      state.sliderVelocity,
      state.sliderPointDerivative.clone().multiplyScalar(
        geometry.inputAngularSpeed,
      ),
      1e-15,
      'slider velocity from signed input speed',
    );
    vector2Near(
      state.sliderAcceleration,
      state.sliderPointSecondDerivative.clone().multiplyScalar(
        geometry.inputAngularSpeed ** 2,
      ),
      1e-15,
      'slider acceleration from constant input speed',
    );
    near(
      state.outputVelocity.x,
      state.outputPositionDerivative * geometry.inputAngularSpeed,
      0,
      'output velocity from signed input speed',
    );
    near(
      state.outputAcceleration.x,
      state.outputPositionSecondDerivative
        * geometry.inputAngularSpeed ** 2,
      0,
      'output acceleration from constant input speed',
    );
  }

  // Time is periodic, clockwise, and starts at Brown's engraved top pose.
  vector2Near(stateAtTime(-4).sliderPoint, top.sliderPoint, 0,
    'negative time clamps to source pose');
  for (const time of [0, 0.17, 1.2, 3.8, 7.4, geometry.cyclePeriod]) {
    const state = stateAtTime(time);
    const repeated = stateAtTime(time + geometry.cyclePeriod);
    vector2Near(repeated.sliderPoint, state.sliderPoint, 5e-15,
      'periodic slider point');
    vector2Near(repeated.outputPoint, state.outputPoint, 6e-15,
      'periodic output point');
    vector2Near(repeated.sliderVelocity, state.sliderVelocity, 5e-15,
      'periodic slider velocity');
    vector2Near(repeated.outputVelocity, state.outputVelocity, 5e-15,
      'periodic output velocity');
    near(repeated.inputAngularSpeed, geometry.inputAngularSpeed, 0,
      'constant clockwise input speed');
    near(
      repeated.inputUnwrappedAngle,
      state.inputUnwrappedAngle - FULL_TURN,
      3e-15,
      'unwrapped clockwise input advances one turn',
    );
  }

  // Axial ordering makes the two constraints visible and physically
  // intelligible: fixed plate and annular shoe at the rear, radial crank and
  // pin in front, rectangular slide above it, and the rod/output pin foremost.
  const plateBackZ = geometry.plateCenterZ - geometry.plateDepth / 2;
  const crankBackZ = geometry.crankPlaneZ - geometry.crankDepth / 2;
  const sliderBlockBackZ = geometry.sliderBlockCenterZ
    - geometry.sliderBlockDepth / 2;
  const sliderBlockFrontZ = geometry.sliderBlockCenterZ
    + geometry.sliderBlockDepth / 2;
  const grooveShoeBackZ = geometry.grooveShoeCenterZ
    - geometry.grooveShoeDepth / 2;
  const grooveShoeFrontZ = geometry.grooveShoeCenterZ
    + geometry.grooveShoeDepth / 2;
  const radialShoeBackZ = geometry.radialShoeCenterZ
    - geometry.radialShoeDepth / 2;
  const radialShoeFrontZ = geometry.radialShoeCenterZ
    + geometry.radialShoeDepth / 2;
  const rodBackZ = geometry.connectingRodPlaneZ
    - geometry.connectingRodDepth / 2;
  const sliderBossFrontZ = geometry.sliderFrontBossCenterZ
    + geometry.sliderFrontBossDepth / 2;
  assert.ok(plateBackZ < geometry.plateFrontZ);
  assert.ok(geometry.plateFrontZ < crankBackZ,
    'moving crank lies fully in front of fixed plate');
  assert.ok(grooveShoeBackZ < plateBackZ);
  assert.ok(grooveShoeFrontZ > geometry.plateFrontZ,
    'circular shoe spans the open annular plate groove');
  assert.ok(radialShoeBackZ < crankBackZ);
  assert.ok(radialShoeFrontZ > geometry.crankFrontZ,
    'radial shoe pin spans the open crank slot');
  assert.ok(sliderBlockBackZ > geometry.crankFrontZ, 'slider body clears crank face');
  assert.ok(sliderBlockFrontZ < rodBackZ);
  assert.ok(sliderBossFrontZ >= rodBackZ,
    'front wrist boss reaches the connecting-rod plane');
  assert.ok(geometry.shaftRadius < geometry.shaftOpeningRadius);
  assert.ok(geometry.grooveInnerRadius < geometry.grooveCenterRadius);
  assert.ok(geometry.grooveCenterRadius < geometry.grooveOuterRadius);
  assert.ok(geometry.circularGrooveShoeRadius < geometry.grooveHalfWidth);
  assert.ok(geometry.radialSlotShoeRadius < geometry.crankSlotHalfWidth);

  // Rendered transforms must implement the analytic closure at every phase.
  model.update(0, 0.016);
  model.root.updateMatrixWorld(true);
  const fixedOuterPlateMatrix = outerPlate.matrixWorld.clone();
  const fixedInnerWallMatrix = grooveInnerWall.matrixWorld.clone();
  const fixedOuterWallMatrix = grooveOuterWall.matrixWorld.clone();
  const fixedBearingMatrix = fixedShaftBearing.matrixWorld.clone();
  for (const phase of [0, 0.07, 0.19207094989006016, 0.25, 0.5,
    0.75, 0.8079290501099399, 0.94, 1]) {
    const time = phase * geometry.cyclePeriod;
    model.update(time, 0.016);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    near(inputCrank.rotation.z, state.inputAngle, 0,
      'rendered clockwise crank angle');
    near(sliderAssembly.rotation.z, state.inputAngle, 0,
      'rendered slide block aligns to crank slot');
    near(outputSlide.rotation.z, 0, 0,
      'rendered output crosshead never rotates');
    vector2Near(
      inputSliderAnchor.getWorldPosition(new THREE.Vector3()),
      state.sliderPoint,
      2e-15,
      'rendered variable-radius crank anchor',
    );
    vector2Near(
      sliderCenterAnchor.getWorldPosition(new THREE.Vector3()),
      state.sliderPoint,
      0,
      'rendered dual-constrained slider center',
    );
    vector2Near(
      circularGrooveShoe.getWorldPosition(new THREE.Vector3()),
      state.sliderPoint,
      0,
      'rendered circular-groove shoe center',
    );
    vector2Near(
      outputPinAnchor.getWorldPosition(new THREE.Vector3()),
      state.outputPoint,
      0,
      'rendered guided output pin',
    );
    vector3Near(
      connectingRodSliderEye.position,
      new THREE.Vector3(
        state.sliderPoint.x,
        state.sliderPoint.y,
        geometry.connectingRodPlaneZ,
      ),
      0,
      'rendered connecting-rod slider eye',
    );
    vector3Near(
      connectingRodOutputEye.position,
      new THREE.Vector3(
        state.outputPoint.x,
        state.outputPoint.y,
        geometry.connectingRodPlaneZ,
      ),
      0,
      'rendered connecting-rod output eye',
    );
    near(connectingRodBeam.scale.x, geometry.connectingRodLength, 4e-15,
      'rendered finite connecting-rod length');
    const renderedRodAxis = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(connectingRodBeam.quaternion)
      .setZ(0)
      .normalize();
    vector2Near(
      renderedRodAxis,
      state.connectingRodVector.clone().normalize(),
      2e-15,
      'rendered connecting-rod direction',
    );
    assert.ok(outerPlate.matrixWorld.equals(fixedOuterPlateMatrix));
    assert.ok(grooveInnerWall.matrixWorld.equals(fixedInnerWallMatrix));
    assert.ok(grooveOuterWall.matrixWorld.equals(fixedOuterWallMatrix));
    assert.ok(fixedShaftBearing.matrixWorld.equals(fixedBearingMatrix));
    near(model.root.userData.contacts.circularGroove.centerlineRadiusError,
      0, 2e-15, 'rendered circular-groove contact');
    near(model.root.userData.contacts.radialCrankSlot.centerlineError,
      0, 2e-15, 'rendered radial-slot contact');
    near(model.root.userData.contacts.connectingRod.lengthError,
      0, 6e-15, 'rendered finite-rod closure');
    near(
      model.root.userData.contacts.horizontalOutputGuide
        .verticalPositionError,
      0,
      0,
      'rendered horizontal-guide closure',
    );
  }

  vector2Near(
    fixedDiskCenterAnchor.getWorldPosition(new THREE.Vector3()),
    geometry.fixedDiskCenter,
    0,
    'fixed guide center anchor',
  );
  vector2Near(
    shaftCenterAnchor.getWorldPosition(new THREE.Vector3()),
    geometry.shaftCenter,
    0,
    'fixed eccentric shaft center anchor',
  );
  vector2Near(
    outputGuideStartAnchor.getWorldPosition(new THREE.Vector3()),
    new THREE.Vector2(geometry.outputGuideMinimumX, geometry.outputGuideY),
    0,
    'left output guide anchor',
  );
  vector2Near(
    outputGuideEndAnchor.getWorldPosition(new THREE.Vector3()),
    new THREE.Vector2(geometry.outputGuideMaximumX, geometry.outputGuideY),
    0,
    'right output guide anchor',
  );

  // The invisible envelope covers the complete moving crank and tool stroke,
  // while the visible assembly itself occupies real depth in five planes.
  model.update(0, 0.016);
  model.root.updateMatrixWorld(true);
  const fullBounds = new THREE.Box3().setFromObject(model.root);
  const fullSize = fullBounds.getSize(new THREE.Vector3());
  assert.ok(fullBounds.min.x <= geometry.motionMinimumX - 0.17);
  assert.ok(fullBounds.max.x >= geometry.motionMaximumX + 0.17);
  assert.ok(fullBounds.min.y <= geometry.motionMinimumY - 0.17);
  assert.ok(fullBounds.max.y >= geometry.motionMaximumY + 0.17);
  assert.ok(fullSize.x > 26.3);
  assert.ok(fullSize.y > 11.2);
  assert.ok(fullSize.z > 2.19);
  const visibleBounds = new THREE.Box3();
  model.root.traverse((object) => {
    if (!object.isMesh || object === cameraEnvelope) return;
    visibleBounds.union(new THREE.Box3().setFromObject(object));
  });
  const visibleSize = visibleBounds.getSize(new THREE.Vector3());
  // The retired ink ring stood 0.025 units proud of the disk rim.
  assert.ok(visibleSize.x > 23.4,
    'full finite rod, disk, guide, and cutting tool are visible');
  assert.ok(visibleSize.y > 7.8,
    'source-pose disk and vertical crank occupy full height');
  assert.ok(visibleSize.z > 1.70,
    'plate, two shoes, crank, slide, rod, and pins occupy real depth');
  assert.ok(visibleBounds.min.z < -0.73);
  assert.ok(visibleBounds.max.z > .96);
  near(model.root.userData.cameraDistanceScale, 0.98, 0,
    'source-complete wide-mechanism camera scale');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 3);

  // The next sequential mechanism is now independently authored as 179.
  const movement177 = createMovementModel(catalog.movements[176]);
  const movement179 = createMovementModel(catalog.movements[178]);
  assert.equal(movement177.root.userData.fidelity, 'authored');
  assert.equal(
    movement177.root.userData.mechanism,
    'coaxial-equal-radius-input-crank-fixed-output-quarter-turned-curved-tangential-slot-wrist-clearance',
  );
  assert.equal(catalog.movements[178].fidelity, 'authored');
  assert.equal(movement179.root.userData.fidelity, 'authored');
  assert.equal(
    movement179.root.userData.mechanism,
    'liftable-gab-manual-valve-spindle-reversal-with-loose-eccentric-and-exact-half-turn-shaft-stop-takeup',
  );
  assert.notEqual(
    movement179.root.userData.mechanism,
    model.root.userData.mechanism,
  );

  disposeModel(movement177.root);
  disposeModel(movement179.root);
  disposeModel(model.root);
});

test('178 (pass 93): no undrawn rear flange, and the rod ends plainly past the plate', () => {
  const model = createMovementModel(catalog.movements[177]);
  const roles = [];
  model.root.traverse((o) => { if (o.isMesh) roles.push(o.userData.role ?? ''); });
  assert.ok(!roles.some((r) => /flange/.test(r)), roles.filter((r) => /flange/.test(r)).join());
  assert.equal(model.root.userData.blocks.guideFlange, undefined);
  assert.ok(!roles.includes('connecting-rod-eye-on-horizontal-output-slide'), 'no empty eye at the unshown slide');
});
