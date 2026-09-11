import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

function cylinderAlongX(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function fixedSleeveAlongY({
  length,
  material,
  outerRadius,
  role,
}) {
  const sleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(
      outerRadius,
      outerRadius,
      length,
      36,
    ),
    material,
  );
  sleeve.userData.role = role;
  return sleeve;
}

function harmonicInputInverseGrooveDrum() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Measurements from Brown's 525 px engraving. The drum is unusually tall,
  // and only the near half of its one closed reversing groove is visible.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceDrumCenter = new THREE.Vector2(252, 272);
  const sourceDrumLeftX = 212;
  const sourceDrumRightX = 292;
  const sourceDrumTopY = 102;
  const sourceDrumBottomY = 442;
  const sourceShaftTopY = 73;
  const sourceShaftBottomY = 475;
  const sourceVisibleGrooveUpperCenter = new THREE.Vector2(214, 170);
  const sourceVisibleGrooveLowerCenter = new THREE.Vector2(290, 344);
  const sourceRodLeftX = 319;
  const sourceRodRightX = 335;
  const sourceRodTopY = 79;
  const sourceRodBottomY = 464;
  const sourceStudTip = new THREE.Vector2(291, 354);
  const sourceScale = 0.014;
  const sourceDrumRadius = (
    sourceDrumRightX - sourceDrumLeftX
  ) / 2;
  const sourceDrumLength = sourceDrumBottomY - sourceDrumTopY;
  const sourceShaftLength = sourceShaftBottomY - sourceShaftTopY;
  const sourceVisibleGrooveStroke = sourceVisibleGrooveLowerCenter.y
    - sourceVisibleGrooveUpperCenter.y;
  const sourceVisibleGrooveCenterY = (
    sourceVisibleGrooveUpperCenter.y
      + sourceVisibleGrooveLowerCenter.y
  ) / 2;
  const sourceRodRadius = (sourceRodRightX - sourceRodLeftX) / 2;
  const sourceRodLength = sourceRodBottomY - sourceRodTopY;
  const sourceRodCenterX = (sourceRodLeftX + sourceRodRightX) / 2;

  const drumRadius = sourceDrumRadius * sourceScale;
  const drumLength = sourceDrumLength * sourceScale;
  const drumHalfLength = drumLength / 2;
  const shaftLength = sourceShaftLength * sourceScale;
  const shaftRadius = 0.105;
  const grooveCenterY = (
    sourceDrumCenter.y - sourceVisibleGrooveCenterY
  ) * sourceScale;
  const followerAmplitude = sourceVisibleGrooveStroke / 2 * sourceScale;
  const outputStroke = followerAmplitude * 2;
  const grooveSlopeMagnitude = outputStroke / Math.PI;
  const grooveCenterRadius = drumRadius + 0.018;
  const grooveTubeRadius = 0.055;
  const grooveSegments = 768;
  const grooveRadialSegments = 9;
  const rodRadius = sourceRodRadius * sourceScale;
  const rodLength = sourceRodLength * sourceScale;
  const rodLocalCenterY = (
    sourceDrumCenter.y - (sourceRodTopY + sourceRodBottomY) / 2
  ) * sourceScale - (grooveCenterY - followerAmplitude);
  const rodCenterX = (
    sourceRodCenterX - sourceDrumCenter.x
  ) * sourceScale;
  const studLength = rodCenterX - grooveCenterRadius;
  const studRadius = 0.075;
  const studTipRadius = 0.105;
  const guideRailX = rodCenterX + 0.34;
  const guideRailRadius = 0.075;
  const guideRailLength = drumLength + 0.94;
  const guideSleeveInnerRadius = guideRailRadius + 0.025;
  const guideSleeveOuterRadius = 0.205;
  const guideSleeveLength = 0.30;
  const crossheadHalfWidth = 0.29;
  const crossheadHalfHeight = 0.19;
  const crossheadDepth = 0.44;
  const drumEndCapRadius = drumRadius + 0.07;
  const drumEndCapHeight = 0.12;
  const upperEndCapY = drumHalfLength + drumEndCapHeight / 2;
  const lowerEndCapY = -upperEndCapY;
  const bearingCenterY = drumHalfLength + drumEndCapHeight + 0.16;
  const bearingInnerRadius = shaftRadius + 0.025;
  const bearingOuterRadius = 0.27;
  const bearingLength = 0.24;
  const frameMinimumY = -shaftLength / 2 - 0.28;
  const frameMaximumY = shaftLength / 2 + 0.28;
  const frameRailHeight = 0.20;
  const frameRailDepth = 0.72;
  const frameMinimumX = -drumRadius - 0.52;
  const frameMaximumX = guideRailX + 0.42;
  const frameCenterX = (frameMinimumX + frameMaximumX) / 2;
  const frameWidth = frameMaximumX - frameMinimumX;
  const framePlaneZ = -0.52;
  const rearColumnX = frameMaximumX - 0.12;
  const rearColumnHeight = frameMaximumY - frameMinimumY;
  const rearColumnWidth = 0.20;
  const inputAngularFrequency = 0.66;
  const inputCyclePeriod = fullTurn / inputAngularFrequency;
  const outputAverageAngularSpeed = -inputAngularFrequency;

  const positiveModulo = (value, modulus) => {
    const remainder = value % modulus;
    if (remainder === 0) return 0;
    return remainder < 0 ? remainder + modulus : remainder;
  };
  const angularDistance = (left, right) => Math.abs(Math.atan2(
    Math.sin(left - right),
    Math.cos(left - right),
  ));

  const grooveYAtLocalAngle = (localAngle) => {
    const normalizedLocalAngle = positiveModulo(localAngle, fullTurn);
    if (normalizedLocalAngle <= Math.PI) {
      return grooveCenterY - followerAmplitude
        + grooveSlopeMagnitude * normalizedLocalAngle;
    }
    return grooveCenterY + followerAmplitude
      - grooveSlopeMagnitude * (normalizedLocalAngle - Math.PI);
  };

  const grooveCurve = new class extends THREE.Curve {
    getPoint(parameter, target = new THREE.Vector3()) {
      const localAngle = parameter * fullTurn;
      return target.set(
        grooveCenterRadius * Math.cos(localAngle),
        grooveYAtLocalAngle(localAngle),
        -grooveCenterRadius * Math.sin(localAngle),
      );
    }
  }();
  grooveCurve.arcLengthDivisions = grooveSegments;

  const motionAtInputPhase = (
    inputPhase,
    inputPhaseSpeed = inputAngularFrequency,
    inputPhaseAcceleration = 0,
  ) => {
    const cycleIndex = Math.floor(inputPhase / fullTurn);
    const normalizedInputPhase = positiveModulo(inputPhase, fullTurn);
    const sine = Math.sin(normalizedInputPhase);
    const cosine = Math.cos(normalizedInputPhase);
    const atLowerReversal = angularDistance(normalizedInputPhase, 0) < 1e-10;
    const atUpperReversal = angularDistance(
      normalizedInputPhase,
      Math.PI,
    ) < 1e-10;
    const risingStroke = normalizedInputPhase < Math.PI;
    const rodY = grooveCenterY - followerAmplitude * cosine;
    const rodFirstDerivativeByInputPhase = followerAmplitude * sine;
    const rodSecondDerivativeByInputPhase = followerAmplitude * cosine;
    let localAngleWithinCycle;
    let localAngleFirstDerivativeByInputPhase;
    let localAngleSecondDerivativeByInputPhase;
    let grooveSlope;
    let grooveHand;
    if (risingStroke) {
      localAngleWithinCycle = Math.PI / 2 * (1 - cosine);
      localAngleFirstDerivativeByInputPhase = Math.PI / 2 * sine;
      localAngleSecondDerivativeByInputPhase = Math.PI / 2 * cosine;
      grooveSlope = grooveSlopeMagnitude;
      grooveHand = 'positive-pitch-rising-half-turn';
    } else {
      localAngleWithinCycle = Math.PI * 1.5 + Math.PI / 2 * cosine;
      localAngleFirstDerivativeByInputPhase = -Math.PI / 2 * sine;
      localAngleSecondDerivativeByInputPhase = -Math.PI / 2 * cosine;
      grooveSlope = -grooveSlopeMagnitude;
      grooveHand = 'negative-pitch-falling-half-turn';
    }
    const unwrappedLocalAngle = cycleIndex * fullTurn
      + localAngleWithinCycle;
    const localAngleSpeed = localAngleFirstDerivativeByInputPhase
      * inputPhaseSpeed;
    const localAngleAcceleration = localAngleSecondDerivativeByInputPhase
        * inputPhaseSpeed ** 2
      + localAngleFirstDerivativeByInputPhase * inputPhaseAcceleration;
    const drumAngle = -unwrappedLocalAngle;
    const drumAngularSpeed = -localAngleSpeed;
    const drumAngularAcceleration = -localAngleAcceleration;
    const rodVelocity = new THREE.Vector3(
      0,
      rodFirstDerivativeByInputPhase * inputPhaseSpeed,
      0,
    );
    const rodAcceleration = new THREE.Vector3(
      0,
      rodSecondDerivativeByInputPhase * inputPhaseSpeed ** 2
        + rodFirstDerivativeByInputPhase * inputPhaseAcceleration,
      0,
    );
    const grooveLocalPoint = grooveCurve.getPoint(
      localAngleWithinCycle / fullTurn,
    );
    const grooveWorldPoint = grooveLocalPoint.clone().applyAxisAngle(
      Y_AXIS,
      drumAngle,
    );
    const contactPoint = new THREE.Vector3(
      grooveCenterRadius,
      rodY,
      0,
    );
    const grooveTangent = new THREE.Vector3(
      0,
      grooveSlope,
      -grooveCenterRadius,
    ).normalize();
    const radialNormal = new THREE.Vector3(1, 0, 0);
    const flankNormal = new THREE.Vector3().crossVectors(
      radialNormal,
      grooveTangent,
    ).normalize();
    const drumSurfaceVelocity = new THREE.Vector3(
      0,
      0,
      -drumAngularSpeed * grooveCenterRadius,
    );
    const relativeGrooveVelocity = rodVelocity.clone().sub(
      drumSurfaceVelocity,
    );
    const drumSurfaceAcceleration = new THREE.Vector3(
      -(drumAngularSpeed ** 2) * grooveCenterRadius,
      0,
      -drumAngularAcceleration * grooveCenterRadius,
    );
    const relativeGrooveAcceleration = rodAcceleration.clone().sub(
      drumSurfaceAcceleration,
    );
    const phaseConstraintError = rodY - grooveYAtLocalAngle(
      localAngleWithinCycle,
    );
    const phaseConstraintVelocityError = rodVelocity.y
      - grooveSlope * localAngleSpeed;
    const phaseConstraintAccelerationError = rodAcceleration.y
      - grooveSlope * localAngleAcceleration;
    const stage = atLowerReversal
      ? 'lower-rod-reversal-and-drum-dead-center'
      : atUpperReversal
        ? 'upper-rod-reversal-and-drum-dead-center'
        : risingStroke
          ? 'rising-rod-turns-positive-pitch-half'
          : 'falling-rod-turns-negative-pitch-half';

    return {
      accelerationDiscontinuousAtGrooveJunction:
        atLowerReversal || atUpperReversal,
      atLowerReversal,
      atUpperReversal,
      completedReciprocations: inputPhase / fullTurn,
      contactPoint,
      cycleIndex,
      drumAngle,
      drumAngularAcceleration,
      drumAngularSpeed,
      drumSurfaceAcceleration,
      drumSurfaceVelocity,
      flankNormal,
      flankNormalVelocityError: relativeGrooveVelocity.dot(flankNormal),
      grooveHand,
      grooveLocalPoint,
      grooveSlidingSpeed: relativeGrooveVelocity.dot(grooveTangent),
      grooveSlope,
      grooveTangent,
      grooveWorldPoint,
      inputPhase,
      inputPhaseAcceleration,
      inputPhaseSpeed,
      localAngleAcceleration,
      localAngleFirstDerivativeByInputPhase,
      localAngleSecondDerivativeByInputPhase,
      localAngleSpeed,
      localAngleWithinCycle,
      normalizedInputPhase,
      outputRevolutions: drumAngle / fullTurn,
      phaseConstraintAccelerationError,
      phaseConstraintError,
      phaseConstraintVelocityError,
      radialNormal,
      radialNormalVelocityError: relativeGrooveVelocity.dot(radialNormal),
      relativeGrooveAcceleration,
      relativeGrooveVelocity,
      risingStroke,
      rodAcceleration,
      rodFirstDerivativeByInputPhase,
      rodSecondDerivativeByInputPhase,
      rodVelocity,
      rodY,
      stage,
      surfacePointError: grooveWorldPoint.distanceTo(contactPoint),
      unwrappedLocalAngle,
      velocityContinuousAtGrooveJunction:
        atLowerReversal || atUpperReversal,
    };
  };
  const stateAtInputPhase = (inputPhase) => motionAtInputPhase(
    inputPhase,
    inputAngularFrequency,
    0,
  );
  const stateAtTime = (time) => stateAtInputPhase(
    inputAngularFrequency * time,
  );

  const driverMaterial = matte(PALETTE.driven, {
    metalness: 0.11,
    roughness: 0.65,
  });
  const outputMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.64,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.12,
    roughness: 0.60,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const grooveMaterial = matte(0x20282c, {
    metalness: 0.18,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.72,
  });
  const witnessMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const output = new THREE.Group();
  const outputRotor = new THREE.Group();
  output.add(outputRotor);
  output.userData.axis = Y_AXIS.clone();
  output.userData.role =
    'vertical-output-shaft-with-one-tall-reversing-groove-drum';
  output.userData.rotor = outputRotor;

  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(
      drumRadius,
      drumRadius,
      drumLength,
      72,
    ),
    outputMaterial,
  );
  drum.userData.role = 'single-tall-cylinder-carrying-one-endless-groove';
  const grooveTrack = new THREE.Mesh(
    new THREE.TubeGeometry(
      grooveCurve,
      grooveSegments,
      grooveTubeRadius,
      grooveRadialSegments,
      true,
    ),
    grooveMaterial,
  );
  grooveTrack.userData.role =
    'one-closed-two-half-turn-opposite-hand-groove';
  const grooveReversalPockets = [0, 0.5].map((parameter, index) => {
    const pocket = new THREE.Mesh(
      new THREE.SphereGeometry(grooveTubeRadius * 1.16, 20, 14),
      grooveMaterial,
    );
    pocket.position.copy(grooveCurve.getPoint(parameter));
    pocket.userData.role = 'joined-end-of-opposite-hand-groove-halves';
    pocket.userData.end = index === 0 ? 'lower' : 'upper';
    return pocket;
  });
  const outputShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(
      shaftRadius,
      shaftRadius,
      shaftLength,
      30,
    ),
    darkMaterial,
  );
  outputShaft.userData.role = 'continuous-vertical-output-shaft-through-drum';
  const endCaps = [
    { centerY: lowerEndCapY, side: 'lower' },
    { centerY: upperEndCapY, side: 'upper' },
  ].map(({ centerY, side }) => {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(
        drumEndCapRadius,
        drumEndCapRadius,
        drumEndCapHeight,
        64,
      ),
      outputMaterial,
    );
    cap.position.y = centerY;
    cap.userData.role = 'rotating-end-cap-on-groove-drum';
    cap.userData.side = side;
    return cap;
  });
  const endRims = [lowerEndCapY, upperEndCapY].map((centerY, index) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(drumRadius, 0.038, 9, 64),
      darkMaterial,
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = centerY;
    rim.userData.role = 'dark-rim-on-end-of-groove-drum';
    rim.userData.side = index === 0 ? 'lower' : 'upper';
    return rim;
  });
  const drumRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.035, drumRadius * 0.88),
    witnessMaterial,
  );
  drumRotationIndex.position.set(
    0,
    upperEndCapY + drumEndCapHeight / 2 + 0.025,
    drumRadius * 0.43,
  );
  drumRotationIndex.userData.role =
    'white-top-cap-index-showing-output-angle-and-rate';
  outputRotor.add(
    drum,
    grooveTrack,
    ...grooveReversalPockets,
    outputShaft,
    ...endCaps,
    ...endRims,
    drumRotationIndex,
  );

  const input = new THREE.Group();
  input.position.set(rodCenterX, grooveCenterY - followerAmplitude, 0);
  input.userData.role =
    'harmonically-reciprocating-vertical-rod-that-drives-the-drum';
  input.userData.translationAxis = Y_AXIS.clone();
  const reciprocatingRod = new THREE.Mesh(
    new THREE.CylinderGeometry(
      rodRadius,
      rodRadius,
      rodLength,
      28,
    ),
    driverMaterial,
  );
  reciprocatingRod.position.y = rodLocalCenterY;
  reciprocatingRod.userData.role = 'source-long-rectilinearly-moving-rod';
  const crosshead = new THREE.Mesh(
    new THREE.BoxGeometry(
      crossheadHalfWidth * 2,
      crossheadHalfHeight * 2,
      crossheadDepth,
    ),
    accentMaterial,
  );
  crosshead.position.x = (guideRailX - rodCenterX) / 2;
  crosshead.userData.role = 'rigid-crosshead-carrying-the-horizontal-stud';
  const guideSleeve = fixedSleeveAlongY({
    length: guideSleeveLength,
    material: accentMaterial,
    outerRadius: guideSleeveOuterRadius,
    role: 'moving-bored-sleeve-on-fixed-vertical-guide',
  });
  guideSleeve.position.x = guideRailX - rodCenterX;
  guideSleeve.userData.innerRadius = guideSleeveInnerRadius;
  const studBody = cylinderAlongX(
    studRadius,
    studLength,
    darkMaterial,
    28,
  );
  studBody.position.x = -studLength / 2;
  studBody.userData.role = 'horizontal-stud-fixed-to-reciprocating-rod';
  const studTip = new THREE.Mesh(
    new THREE.SphereGeometry(studTipRadius, 28, 18),
    witnessMaterial,
  );
  studTip.scale.x = 0.74;
  studTip.position.x = -studLength;
  studTip.userData.role = 'rounded-stud-tip-centered-in-the-endless-groove';
  const inputTranslationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.22, 0.05),
    witnessMaterial,
  );
  inputTranslationIndex.position.set(
    (guideRailX - rodCenterX) / 2,
    0,
    crossheadDepth / 2 + 0.035,
  );
  inputTranslationIndex.userData.role =
    'white-index-showing-the-smooth-input-reciprocation';
  input.add(
    reciprocatingRod,
    crosshead,
    guideSleeve,
    studBody,
    studTip,
    inputTranslationIndex,
  );

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-drum-bearings-and-vertical-input-guide';
  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(frameWidth, frameRailHeight, frameRailDepth),
    frameMaterial,
  );
  baseRail.position.set(frameCenterX, frameMinimumY, framePlaneZ);
  baseRail.userData.role = 'fixed-lower-frame-rail';
  const topRail = baseRail.clone();
  topRail.position.y = frameMaximumY;
  topRail.userData.role = 'fixed-upper-frame-rail';
  const rearColumn = new THREE.Mesh(
    new THREE.BoxGeometry(
      rearColumnWidth,
      rearColumnHeight,
      frameRailDepth * 0.72,
    ),
    frameMaterial,
  );
  rearColumn.position.set(
    rearColumnX,
    (frameMinimumY + frameMaximumY) / 2,
    framePlaneZ,
  );
  rearColumn.userData.role = 'rear-column-joining-upper-and-lower-rails';
  const guideRail = new THREE.Mesh(
    new THREE.CylinderGeometry(
      guideRailRadius,
      guideRailRadius,
      guideRailLength,
      28,
    ),
    darkMaterial,
  );
  guideRail.position.set(guideRailX, grooveCenterY, 0);
  guideRail.userData.role = 'fixed-vertical-guide-for-input-crosshead';
  const guideRailSupports = [frameMinimumY, frameMaximumY].map((y, index) => {
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(
        rearColumnX - guideRailX + 0.12,
        0.15,
        0.30,
      ),
      frameMaterial,
    );
    support.position.set((rearColumnX + guideRailX) / 2, y, -0.11);
    support.userData.role = 'fixed-bracket-holding-input-guide';
    support.userData.side = index === 0 ? 'lower' : 'upper';
    return support;
  });
  const shaftBearings = [-1, 1].map((sideSign) => {
    const bearing = fixedSleeveAlongY({
      length: bearingLength,
      material: frameMaterial,
      outerRadius: bearingOuterRadius,
      role: 'fixed-bearing-around-vertical-output-shaft',
    });
    bearing.position.set(0, sideSign * bearingCenterY, framePlaneZ * 0.22);
    bearing.userData.innerRadius = bearingInnerRadius;
    bearing.userData.side = sideSign < 0 ? 'lower' : 'upper';
    return bearing;
  });
  const bearingBrackets = [-1, 1].map((sideSign, index) => {
    const y = sideSign * bearingCenterY;
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(
        rearColumnX,
        0.17,
        0.32,
      ),
      frameMaterial,
    );
    bracket.position.set(rearColumnX / 2, y, framePlaneZ);
    bracket.userData.role = 'fixed-arm-supporting-drum-shaft-bearing';
    bracket.userData.side = index === 0 ? 'lower' : 'upper';
    return bracket;
  });
  fixedFrame.add(
    baseRail,
    topRail,
    rearColumn,
    guideRail,
    ...guideRailSupports,
    ...shaftBearings,
    ...bearingBrackets,
  );

  // The source shows the rod near its lower reversal. Its upper end therefore
  // rises by the full output stroke in the opposite canonical pose. Include
  // both extrema in the fit guide so that the moving input never clips out of
  // the canvas while the camera itself remains fixed.
  const cameraEnvelopePaddingY = 0.62;
  const cameraEnvelopeMinimumY = Math.min(
    frameMinimumY - frameRailHeight / 2,
    grooveCenterY - followerAmplitude + rodLocalCenterY - rodLength / 2,
  ) - cameraEnvelopePaddingY;
  const cameraEnvelopeMaximumY = Math.max(
    frameMaximumY + frameRailHeight / 2,
    grooveCenterY + followerAmplitude + rodLocalCenterY + rodLength / 2,
  ) + cameraEnvelopePaddingY;
  const cameraEnvelopeHeight = cameraEnvelopeMaximumY
    - cameraEnvelopeMinimumY;
  const cameraEnvelopeCenterY = (
    cameraEnvelopeMinimumY + cameraEnvelopeMaximumY
  ) / 2;
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, cameraEnvelopeHeight, 4.6),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0.45, cameraEnvelopeCenterY, 0.18);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-of-tall-drum-reciprocating-rod-and-frame';

  root.add(cameraEnvelope, fixedFrame, output, input);

  const canonicalTimes = {
    lowerReversal: 0,
    risingMidstroke: Math.PI / 2 / inputAngularFrequency,
    upperReversal: Math.PI / inputAngularFrequency,
    fallingMidstroke: Math.PI * 1.5 / inputAngularFrequency,
    fullCycle: inputCyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    input.position.y = state.rodY;
    input.userData.velocity = state.rodVelocity.clone();
    input.userData.acceleration = state.rodAcceleration.clone();
    outputRotor.rotation.y = state.drumAngle;
    output.userData.angularSpeed = state.drumAngularSpeed;
    output.userData.angularAcceleration = state.drumAngularAcceleration;
    root.userData.contacts = {
      endlessGroove: {
        accelerationConstraintError: state.phaseConstraintAccelerationError,
        contactPoint: state.contactPoint.clone(),
        flankNormal: state.flankNormal.clone(),
        flankNormalVelocityError: state.flankNormalVelocityError,
        hand: state.grooveHand,
        oneContinuousClosedGroove: true,
        phaseConstraintError: state.phaseConstraintError,
        radialNormal: state.radialNormal.clone(),
        radialNormalVelocityError: state.radialNormalVelocityError,
        slidingSpeed: state.grooveSlidingSpeed,
        surfacePointError: state.surfacePointError,
        tangent: state.grooveTangent.clone(),
        velocityConstraintError: state.phaseConstraintVelocityError,
      },
      inputGuide: {
        axis: Y_AXIS.clone(),
        boreClearance: guideSleeveInnerRadius - guideRailRadius,
        lateralError: Math.hypot(
          input.position.x - rodCenterX,
          input.position.z,
        ),
        rotationError: Math.hypot(
          input.rotation.x,
          input.rotation.y,
          input.rotation.z,
        ),
      },
      outputShaftBearings: {
        axis: Y_AXIS.clone(),
        radialClearance: bearingInnerRadius - shaftRadius,
      },
      stud: {
        captured: true,
        centerError: studTip.getWorldPosition(new THREE.Vector3())
          .distanceTo(state.contactPoint),
      },
    };
    root.userData.kinematics = state;
  };

  root.userData.mechanism =
    'reciprocating-rod-inverse-opposite-hand-endless-groove-drum';
  root.userData.cameraDistanceScale = 1.02;
  root.userData.blocks = {
    baseRail,
    bearingBrackets,
    cameraEnvelope,
    crosshead,
    drum,
    drumRotationIndex,
    endCaps,
    endRims,
    fixedFrame,
    grooveReversalPockets,
    grooveTrack,
    guideRail,
    guideRailSupports,
    guideSleeve,
    input,
    inputTranslationIndex,
    output,
    outputRotor,
    outputShaft,
    rearColumn,
    reciprocatingRod,
    shaftBearings,
    studBody,
    studTip,
    topRail,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.curves = { groove: grooveCurve };
  root.userData.geometry = {
    bearingCenterY,
    bearingInnerRadius,
    bearingLength,
    bearingOuterRadius,
    cameraEnvelopeCenterY,
    cameraEnvelopeHeight,
    cameraEnvelopeMaximumY,
    cameraEnvelopeMinimumY,
    cameraEnvelopePaddingY,
    crossheadDepth,
    crossheadHalfHeight,
    crossheadHalfWidth,
    drumEndCapHeight,
    drumEndCapRadius,
    drumHalfLength,
    drumLength,
    drumRadius,
    followerAmplitude,
    frameMaximumX,
    frameMaximumY,
    frameMinimumX,
    frameMinimumY,
    framePlaneZ,
    frameRailDepth,
    frameRailHeight,
    frameWidth,
    fullTurn,
    grooveCenterRadius,
    grooveCenterY,
    grooveRadialSegments,
    grooveSegments,
    grooveSlopeMagnitude,
    grooveTubeRadius,
    guideRailLength,
    guideRailRadius,
    guideRailX,
    guideSleeveInnerRadius,
    guideSleeveLength,
    guideSleeveOuterRadius,
    inputAngularFrequency,
    inputCyclePeriod,
    lowerEndCapY,
    outputAverageAngularSpeed,
    outputStroke,
    rearColumnHeight,
    rearColumnWidth,
    rodCenterX,
    rodLength,
    rodLocalCenterY,
    rodRadius,
    shaftLength,
    shaftRadius,
    sourceDrumBottomY,
    sourceDrumCenter: sourceDrumCenter.clone(),
    sourceDrumLeftX,
    sourceDrumLength,
    sourceDrumRadius,
    sourceDrumRightX,
    sourceDrumTopY,
    sourceImageHeight,
    sourceImageWidth,
    sourceRodBottomY,
    sourceRodCenterX,
    sourceRodLeftX,
    sourceRodLength,
    sourceRodRadius,
    sourceRodRightX,
    sourceRodTopY,
    sourceScale,
    sourceShaftBottomY,
    sourceShaftLength,
    sourceShaftTopY,
    sourceStudTip: sourceStudTip.clone(),
    sourceVisibleGrooveCenterY,
    sourceVisibleGrooveLowerCenter:
      sourceVisibleGrooveLowerCenter.clone(),
    sourceVisibleGrooveStroke,
    sourceVisibleGrooveUpperCenter:
      sourceVisibleGrooveUpperCenter.clone(),
    studLength,
    studRadius,
    studTipRadius,
    upperEndCapY,
  };
  root.userData.grooveYAtLocalAngle = grooveYAtLocalAngle;
  root.userData.motionAtInputPhase = motionAtInputPhase;
  root.userData.stateAtInputPhase = stateAtInputPhase;
  root.userData.stateAtTime = stateAtTime;

  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  for (const object of [
    cameraEnvelope,
    drumRotationIndex,
    inputTranslationIndex,
    studTip,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';
  return {
    cameraDirection: new THREE.Vector3(7.2, 4.3, 15.2),
    root,
    update,
  };
}

export function createAuthoredGrooveDrumMovement(movement) {
  switch (movement.id) {
    case 167: return harmonicInputInverseGrooveDrum();
    default: return null;
  }
}
