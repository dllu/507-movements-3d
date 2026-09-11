import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeGear,
  makeScrew,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function wrapAngle(angle) {
  return THREE.MathUtils.euclideanModulo(angle + Math.PI, FULL_TURN)
    - Math.PI;
}

function cylinderAlongX(radius, length, material, segments = 28) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongZ(radius, length, material, segments = 28) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function ringAroundX(radius, tubeRadius, material, segments = 36) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 10, segments),
    material,
  );
  ring.rotation.y = Math.PI / 2;
  return ring;
}

function setBeamEndpoints(beam, start, end) {
  beam.userData.setEndpoints(start, end);
  return beam;
}

function smootherStep01(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t ** 3 * (t * (t * 6 - 15) + 10);
}

function smootherStepFirstDerivative(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * t ** 2 * (t - 1) ** 2;
}

function smootherStepSecondDerivative(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * t * (t - 1) * (2 * t - 1);
}

function tappetIndexedSilkTraverse() {
  const root = new THREE.Group();

  // Brown's engraving is an elevation with no printed dimensions.  These
  // centers are measured from the public-domain 525 px plate.  The screw is
  // carried across the rotating disk, its nut wrist lies on the opposite
  // radius, and the fixed silk-guide rod passes through the long vertical
  // slot.  Scaling from the disk radius retains the source proportions.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceDiskCenter = new THREE.Vector2(207, 286);
  const sourceDiskOuterRadius = 156;
  const sourceScrewLowerBearing = new THREE.Vector2(75, 365);
  const sourceScrewUpperBearing = new THREE.Vector2(320, 200);
  const sourceTappetWheelCenter = new THREE.Vector2(351, 179);
  const sourceTappetSupportTip = new THREE.Vector2(389, 179);
  const sourceNutWrist = new THREE.Vector2(159, 310);
  const sourceSlotTop = new THREE.Vector2(160, 169);
  const sourceSlotBottom = new THREE.Vector2(160, 407);
  const sourceVisibleGuideEnd = new THREE.Vector2(499, 307);
  const sourceGuideY = 307;
  const diskOuterRadius = 2.2;
  const sourceScale = diskOuterRadius / sourceDiskOuterRadius;
  const sourceVector = (from, to) => new THREE.Vector2(
    to.x - from.x,
    from.y - to.y,
  );
  const sourceScrewVector = sourceVector(
    sourceScrewLowerBearing,
    sourceScrewUpperBearing,
  );
  const sourceCarrierAngle = Math.atan2(
    sourceScrewVector.y,
    sourceScrewVector.x,
  );
  const screwLength = sourceScrewVector.length() * sourceScale;
  const sourceWheelVector = sourceVector(
    sourceDiskCenter,
    sourceTappetWheelCenter,
  );
  const tappetWheelStation = sourceWheelVector.length() * sourceScale;
  const sourceNutVector = sourceVector(sourceDiskCenter, sourceNutWrist);
  const sourceNutStation = sourceNutVector.dot(
    new THREE.Vector2(
      Math.cos(sourceCarrierAngle),
      Math.sin(sourceCarrierAngle),
    ),
  ) * sourceScale;
  const slotHalfLength = sourceSlotTop.distanceTo(sourceSlotBottom)
    * sourceScale / 2;
  const guideRodLength = (sourceVisibleGuideEnd.x - sourceSlotTop.x)
    * sourceScale;
  const guideY = -(sourceGuideY - sourceDiskCenter.y) * sourceScale;
  const sourcePointFromRaster = (point) => new THREE.Vector2(
    (point.x - sourceDiskCenter.x) * sourceScale,
    (sourceDiskCenter.y - point.y) * sourceScale,
  );
  const modelPointToSourceRaster = (point) => new THREE.Vector2(
    sourceDiskCenter.x + point.x / sourceScale,
    sourceDiskCenter.y - point.y / sourceScale,
  );

  const tappetWheelTeeth = 18;
  const screwLead = 0.45;
  const wheelAngularPitch = FULL_TURN / tappetWheelTeeth;
  const nutAdvancePerIndex = screwLead / tappetWheelTeeth;
  const adjustmentStepCount = tappetWheelTeeth;
  const initialNutStation = sourceNutStation;
  const finalNutStation = initialNutStation
    - adjustmentStepCount * nutAdvancePerIndex;
  const contactHalfAngle = 0.14;
  const contactHalfWidthTurns = contactHalfAngle / FULL_TURN;
  const contactBoundaryTolerance = 1e-12;
  const tappetContactAngle = sourceCarrierAngle + contactHalfAngle;
  const sourceCarrierTurnCoordinate = -contactHalfWidthTurns;
  const completionCarrierTurnCoordinate = adjustmentStepCount - 1
    + contactHalfWidthTurns;
  const carrierTurnsPerSecond = 0.24;
  const carrierAngularSpeed = FULL_TURN * carrierTurnsPerSecond;
  const carrierRotationPeriod = 1 / carrierTurnsPerSecond;
  const adjustmentDuration = (
    completionCarrierTurnCoordinate - sourceCarrierTurnCoordinate
  ) / carrierTurnsPerSecond;

  const diskPlaneZ = -0.25;
  const diskDepth = 0.12;
  const screwPlaneZ = -0.47;
  const slotPlaneZ = 0.48;
  const tappetWheelPitchRadius = 0.40;
  const tappetWheelToothHeight = 0.16;
  const tappetWheelOuterRadius = tappetWheelPitchRadius
    + tappetWheelToothHeight / 2;
  const wristRadius = 0.10;
  const slotHalfWidth = 0.22;

  const indexLawAtCarrierTurn = (carrierTurnCoordinate) => {
    const eventIndex = Math.floor(carrierTurnCoordinate + 0.5);
    const eventPhase = carrierTurnCoordinate - eventIndex;
    let rawIndexPosition;
    let derivativePerCarrierTurn = 0;
    let secondDerivativePerCarrierTurnSquared = 0;
    let contactFraction = eventPhase < 0 ? 0 : 1;

    if (
      eventPhase <= -contactHalfWidthTurns + contactBoundaryTolerance
    ) {
      rawIndexPosition = eventIndex;
      contactFraction = 0;
    } else if (
      eventPhase >= contactHalfWidthTurns - contactBoundaryTolerance
    ) {
      rawIndexPosition = eventIndex + 1;
      contactFraction = 1;
    } else {
      contactFraction = (
        eventPhase + contactHalfWidthTurns
      ) / (2 * contactHalfWidthTurns);
      rawIndexPosition = eventIndex + smootherStep01(contactFraction);
      derivativePerCarrierTurn = smootherStepFirstDerivative(
        contactFraction,
      ) / (2 * contactHalfWidthTurns);
      secondDerivativePerCarrierTurnSquared =
        smootherStepSecondDerivative(contactFraction)
          / (2 * contactHalfWidthTurns) ** 2;
    }

    const indexPosition = THREE.MathUtils.clamp(
      rawIndexPosition,
      0,
      adjustmentStepCount,
    );
    if (
      rawIndexPosition <= 0
      || rawIndexPosition >= adjustmentStepCount
    ) {
      derivativePerCarrierTurn = 0;
      secondDerivativePerCarrierTurnSquared = 0;
    }
    const contactActive = (
      eventPhase > -contactHalfWidthTurns + contactBoundaryTolerance
      && eventPhase < contactHalfWidthTurns - contactBoundaryTolerance
      && rawIndexPosition > 0
      && rawIndexPosition < adjustmentStepCount
    );
    const completedIndexCount = Math.min(
      adjustmentStepCount,
      Math.floor(indexPosition + 1e-12),
    );
    return {
      completedIndexCount,
      contactActive,
      contactFraction,
      derivativePerCarrierTurn,
      eventIndex,
      eventPhase,
      fractionalIndex: indexPosition - completedIndexCount,
      indexPosition,
      rawIndexPosition,
      secondDerivativePerCarrierTurnSquared,
    };
  };

  const stateAtCarrierTurnCoordinate = (
    carrierTurnCoordinate,
    inputTurnsPerSecond = carrierTurnsPerSecond,
  ) => {
    const law = indexLawAtCarrierTurn(carrierTurnCoordinate);
    const carrierAngle = tappetContactAngle
      + FULL_TURN * carrierTurnCoordinate;
    const carrierVisualAngle = wrapAngle(carrierAngle);
    const inputAngularSpeed = FULL_TURN * inputTurnsPerSecond;
    const indexVelocity = law.derivativePerCarrierTurn
      * inputTurnsPerSecond;
    const indexAcceleration = law.secondDerivativePerCarrierTurnSquared
      * inputTurnsPerSecond ** 2;
    const screwAngle = -law.indexPosition * wheelAngularPitch;
    const screwVisualAngle = wrapAngle(screwAngle);
    const screwAngularSpeed = -indexVelocity * wheelAngularPitch;
    const screwAngularAcceleration = -indexAcceleration
      * wheelAngularPitch;
    const nutStation = initialNutStation
      + screwAngle / FULL_TURN * screwLead;
    const nutRadialVelocity = screwAngularSpeed / FULL_TURN * screwLead;
    const nutRadialAcceleration = screwAngularAcceleration
      / FULL_TURN * screwLead;
    const cosine = Math.cos(carrierVisualAngle);
    const sine = Math.sin(carrierVisualAngle);
    const radialDirection = new THREE.Vector3(cosine, sine, 0);
    const tangentialDirection = new THREE.Vector3(-sine, cosine, 0);
    const nutWristWorld = radialDirection.clone().multiplyScalar(
      nutStation,
    );
    nutWristWorld.z = slotPlaneZ;
    const nutWristVelocity = radialDirection.clone().multiplyScalar(
      nutRadialVelocity,
    ).addScaledVector(
      tangentialDirection,
      nutStation * inputAngularSpeed,
    );
    const nutWristAcceleration = radialDirection.clone().multiplyScalar(
      nutRadialAcceleration - nutStation * inputAngularSpeed ** 2,
    ).addScaledVector(
      tangentialDirection,
      2 * nutRadialVelocity * inputAngularSpeed,
    );
    const tappetWheelCenterWorld = radialDirection.clone().multiplyScalar(
      tappetWheelStation,
    );
    tappetWheelCenterWorld.z = screwPlaneZ;
    const tappetWheelAxisWorld = radialDirection.clone();
    const fixedTappetTipWorld = new THREE.Vector3(
      Math.cos(tappetContactAngle) * tappetWheelStation,
      Math.sin(tappetContactAngle) * tappetWheelStation,
      screwPlaneZ + tappetWheelOuterRadius,
    );
    const tappetOffset = fixedTappetTipWorld.clone().sub(
      tappetWheelCenterWorld,
    );
    const tappetAxialOffset = tappetOffset.dot(tappetWheelAxisWorld);
    const tappetPlaneVector = tappetOffset.clone().addScaledVector(
      tappetWheelAxisWorld,
      -tappetAxialOffset,
    );
    const tappetPlaneRadius = tappetPlaneVector.length();
    const adjustmentComplete = law.indexPosition
      >= adjustmentStepCount - 1e-12;
    const settingStage = adjustmentComplete
      ? 'full-adjustment-complete-and-input-stopped'
      : law.contactActive
        ? 'fixed-tappet-indexes-wheel-screw-and-nut'
        : 'screw-and-nut-dwell-between-tappet-contacts';
    const outputVelocityX = nutWristVelocity.x;
    const outputYokeX = nutWristWorld.x;
    const outputStage = Math.abs(outputVelocityX) < 1e-10
      ? 'silk-guide-at-stroke-reversal'
      : outputVelocityX > 0
        ? 'silk-guide-traverses-right'
        : 'silk-guide-traverses-left';

    return {
      adjustmentComplete,
      carrierAngle,
      carrierAngularSpeed: inputAngularSpeed,
      carrierTurnCoordinate,
      carrierVisualAngle,
      completedIndexCount: law.completedIndexCount,
      contactActive: law.contactActive,
      contactFraction: law.contactFraction,
      eventIndex: law.eventIndex,
      eventPhase: law.eventPhase,
      finalNutStation,
      fractionalIndex: law.fractionalIndex,
      guideStrokeLength: 2 * Math.abs(nutStation),
      indexAcceleration,
      indexPosition: law.indexPosition,
      indexVelocity,
      initialNutStation,
      nutRadialAcceleration,
      nutRadialVelocity,
      nutStation,
      nutWristAcceleration,
      nutWristVelocity,
      nutWristWorld,
      outputAccelerationX: nutWristAcceleration.x,
      outputStage,
      outputVelocityX,
      outputYokeX,
      radialDirection,
      screwAngle,
      screwAngularAcceleration,
      screwAngularSpeed,
      screwLeadError: Math.abs(
        nutStation - initialNutStation
          - screwAngle / FULL_TURN * screwLead
      ),
      screwVisualAngle,
      settingStage,
      slotEndClearance: slotHalfLength
        - Math.abs(nutWristWorld.y) - wristRadius,
      slotPinCoordinateY: nutWristWorld.y,
      slotPositionError: Math.abs(nutWristWorld.x - outputYokeX),
      tangentialDirection,
      tappetAxialOffset,
      tappetContactGap: tappetPlaneRadius - tappetWheelOuterRadius,
      tappetOffset,
      tappetPlaneRadius,
      tappetWheelAxisWorld,
      tappetWheelCenterWorld,
      wheelScrewAngleError: 0,
    };
  };

  const stateAtTime = (time) => {
    const rawTurnCoordinate = sourceCarrierTurnCoordinate
      + Math.max(0, time) * carrierTurnsPerSecond;
    const adjustmentComplete = rawTurnCoordinate
      >= completionCarrierTurnCoordinate;
    const effectiveTurnCoordinate = Math.min(
      rawTurnCoordinate,
      completionCarrierTurnCoordinate,
    );
    const state = stateAtCarrierTurnCoordinate(
      effectiveTurnCoordinate,
      adjustmentComplete ? 0 : carrierTurnsPerSecond,
    );
    return {
      ...state,
      adjustmentComplete,
      elapsedAdjustmentTime: Math.min(
        Math.max(0, time),
        adjustmentDuration,
      ),
      rawTurnCoordinate,
      time,
    };
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.08,
    roughness: 0.66,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.11,
    roughness: 0.61,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.13,
    roughness: 0.55,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.67,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.50,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });
  const diskFaceMaterial = matte(PALETTE.driver, {
    metalness: 0.02,
    opacity: 0.22,
    roughness: 0.82,
    side: THREE.DoubleSide,
    transparent: true,
  });
  diskFaceMaterial.depthWrite = false;

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-disk-bearing-tappet-and-horizontal-silk-guide-frame';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(7.75, 0.20, 1.48),
    frameMaterial,
  );
  base.position.set(0.75, -2.55, -0.32);
  base.userData.role = 'fixed-wide-silk-machine-base';
  fixedFrame.add(base);

  const rearFrameZ = -0.76;
  const bearingBraces = [];
  for (const side of [-1, 1]) {
    const brace = setBeamEndpoints(
      makeBeam(
        new THREE.Vector3(),
        new THREE.Vector3(1, 0, 0),
        { thickness: 0.18, depth: 0.22, color: PALETTE.frame },
      ),
      new THREE.Vector3(side * 0.92, -2.44, rearFrameZ),
      new THREE.Vector3(side * 0.18, -0.28, rearFrameZ),
    );
    brace.userData.role = 'fixed-carrier-bearing-a-frame-brace';
    bearingBraces.push(brace);
    fixedFrame.add(brace);
  }
  const centralBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.40, 0.095, 10, 42),
    frameMaterial,
  );
  centralBearing.position.z = rearFrameZ;
  centralBearing.userData.role = 'fixed-central-carrier-shaft-bearing';
  fixedFrame.add(centralBearing);

  const guideBushingStations = [2.55, 3.46];
  const guideBushings = [];
  const guidePosts = [];
  for (const x of guideBushingStations) {
    const bushing = ringAroundX(0.20, 0.068, frameMaterial, 36);
    bushing.position.set(x, guideY, slotPlaneZ);
    bushing.userData.role = 'fixed-horizontal-silk-guide-rod-bushing';
    const post = setBeamEndpoints(
      makeBeam(
        new THREE.Vector3(),
        new THREE.Vector3(1, 0, 0),
        { thickness: 0.15, depth: 0.20, color: PALETTE.frame },
      ),
      new THREE.Vector3(x, -2.45, 0.02),
      new THREE.Vector3(x, guideY - 0.22, 0.02),
    );
    post.userData.role = 'fixed-horizontal-guide-bushing-post';
    guideBushings.push(bushing);
    guidePosts.push(post);
    fixedFrame.add(bushing, post);
  }

  const contactWheelCenter = new THREE.Vector3(
    Math.cos(tappetContactAngle) * tappetWheelStation,
    Math.sin(tappetContactAngle) * tappetWheelStation,
    screwPlaneZ,
  );
  const fixedTappetTipPosition = contactWheelCenter.clone();
  fixedTappetTipPosition.z += tappetWheelOuterRadius;
  const fixedTappetTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 18, 12),
    whiteMaterial,
  );
  fixedTappetTip.position.copy(fixedTappetTipPosition);
  fixedTappetTip.userData.role = 'fixed-tappet-contact-tip';
  const fixedTappetPinLength = 0.36;
  const fixedTappetPin = cylinderAlongZ(
    0.070,
    fixedTappetPinLength,
    accentMaterial,
    20,
  );
  fixedTappetPin.position.copy(fixedTappetTipPosition);
  fixedTappetPin.position.z += fixedTappetPinLength / 2;
  fixedTappetPin.userData.role = 'fixed-axial-tappet-pin';
  const tappetBracketEnd = new THREE.Vector3(
    3.62,
    fixedTappetTipPosition.y,
    fixedTappetTipPosition.z + fixedTappetPinLength,
  );
  const tappetBracket = setBeamEndpoints(
    makeBeam(
      new THREE.Vector3(),
      new THREE.Vector3(1, 0, 0),
      { thickness: 0.15, depth: 0.17, color: PALETTE.frame },
    ),
    new THREE.Vector3(
      fixedTappetTipPosition.x,
      fixedTappetTipPosition.y,
      tappetBracketEnd.z,
    ),
    tappetBracketEnd,
  );
  tappetBracket.userData.role = 'fixed-overhung-tappet-support-arm';
  const tappetPost = setBeamEndpoints(
    makeBeam(
      new THREE.Vector3(),
      new THREE.Vector3(1, 0, 0),
      { thickness: 0.18, depth: 0.21, color: PALETTE.frame },
    ),
    new THREE.Vector3(3.62, -2.44, rearFrameZ),
    tappetBracketEnd,
  );
  tappetPost.userData.role = 'fixed-tappet-support-post';
  fixedFrame.add(
    fixedTappetTip,
    fixedTappetPin,
    tappetBracket,
    tappetPost,
  );
  root.add(fixedFrame);

  const carrier = new THREE.Group();
  carrier.userData.axis = Z_AXIS.clone();
  carrier.userData.role = 'large-input-disk-carrying-one-radial-screw';
  const diskFace = cylinderAlongZ(
    diskOuterRadius,
    diskDepth,
    diskFaceMaterial,
    96,
  );
  diskFace.position.z = diskPlaneZ;
  diskFace.userData.role = 'translucent-source-sized-carrier-disk';
  const diskOuterRim = new THREE.Mesh(
    new THREE.TorusGeometry(diskOuterRadius, 0.060, 10, 96),
    driverMaterial,
  );
  diskOuterRim.position.z = diskPlaneZ + diskDepth / 2 + 0.012;
  diskOuterRim.userData.role = 'solid-carrier-disk-outer-rim';
  const carrierInputIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.070, 0.040),
    whiteMaterial,
  );
  carrierInputIndex.position.set(
    diskOuterRadius * 0.66,
    0,
    diskPlaneZ + diskDepth / 2 + 0.045,
  );
  carrierInputIndex.userData.role = 'white-carrier-angle-index';
  const centralShaft = cylinderAlongZ(0.13, 1.68, darkMaterial, 28);
  centralShaft.position.z = -0.30;
  centralShaft.userData.axis = Z_AXIS.clone();
  centralShaft.userData.role = 'single-central-input-shaft';
  carrier.add(diskFace, diskOuterRim, carrierInputIndex, centralShaft);

  const screwChannel = new THREE.Group();
  screwChannel.userData.role = 'disk-fixed-open-radial-screw-channel';
  const screwChannelRails = [];
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(screwLength - 0.34, 0.11, 0.11),
      frameMaterial,
    );
    rail.position.set(0, side * 0.22, screwPlaneZ);
    rail.userData.role = 'disk-fixed-screw-channel-side-rail';
    screwChannelRails.push(rail);
    screwChannel.add(rail);
  }
  const screwEndBearings = [];
  for (const side of [-1, 1]) {
    const bearing = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.57, 0.34),
      frameMaterial,
    );
    bearing.position.set(
      side * (screwLength / 2 - 0.06),
      0,
      screwPlaneZ,
    );
    bearing.userData.role = 'disk-fixed-lead-screw-end-bearing';
    screwEndBearings.push(bearing);
    screwChannel.add(bearing);
  }
  carrier.add(screwChannel);

  const leadScrew = makeScrew({
    axis: X_AXIS,
    color: PALETTE.accent,
    handedness: 1,
    length: screwLength,
    pitch: screwLead,
    radius: 0.105,
    threadRadius: 0.026,
  });
  leadScrew.position.z = screwPlaneZ;
  leadScrew.userData.role = 'single-right-hand-lead-screw-carried-by-disk';
  const leadScrewRotor = leadScrew.userData.rotor;
  carrier.add(leadScrew);

  const wheelShaftExtension = cylinderAlongX(
    0.095,
    tappetWheelStation - screwLength / 2 + 0.22,
    darkMaterial,
    24,
  );
  wheelShaftExtension.position.set(
    (tappetWheelStation + screwLength / 2) / 2 - 0.11,
    0,
    screwPlaneZ,
  );
  wheelShaftExtension.userData.role =
    'lead-screw-shaft-extension-to-tappet-wheel';
  carrier.add(wheelShaftExtension);

  const tappetWheel = makeGear({
    axis: X_AXIS,
    color: PALETTE.accent,
    depth: 0.22,
    radius: tappetWheelPitchRadius,
    teeth: tappetWheelTeeth,
    toothHeight: tappetWheelToothHeight,
  });
  tappetWheel.position.set(tappetWheelStation, 0, screwPlaneZ);
  tappetWheel.userData.role =
    'eighteen-tooth-tappet-wheel-keyed-to-lead-screw';
  const tappetWheelRotor = tappetWheel.userData.rotor;
  const tappetWheelCenterAnchor = new THREE.Object3D();
  tappetWheelCenterAnchor.position.set(
    tappetWheelStation,
    0,
    screwPlaneZ,
  );
  tappetWheelCenterAnchor.userData.role =
    'analytic-tappet-wheel-center-anchor';
  carrier.add(tappetWheel, tappetWheelCenterAnchor);

  const nutCarriage = new THREE.Group();
  nutCarriage.position.set(initialNutStation, 0, screwPlaneZ);
  nutCarriage.userData.antiRotationConstraint = 'disk-fixed-screw-channel';
  nutCarriage.userData.role =
    'nonrotating-traveling-nut-and-slot-wrist-carriage';
  const nutFrameBlocks = [];
  for (const side of [-1, 1]) {
    const sideBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.13, 0.38),
      drivenMaterial,
    );
    sideBlock.position.y = side * 0.20;
    sideBlock.userData.role = 'traveling-nut-side-cheek';
    nutFrameBlocks.push(sideBlock);
    nutCarriage.add(sideBlock);
    const faceBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.27, 0.10),
      drivenMaterial,
    );
    faceBlock.position.z = side * 0.19;
    faceBlock.userData.role = 'traveling-nut-front-or-rear-bridge';
    nutFrameBlocks.push(faceBlock);
    nutCarriage.add(faceBlock);
  }
  const nutIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.10, 0.045),
    whiteMaterial,
  );
  nutIndex.position.set(0, 0.24, 0.23);
  nutIndex.userData.role = 'white-index-on-traveling-screw-nut';
  const wristPinLength = slotPlaneZ - screwPlaneZ + 0.20;
  const nutWristPin = cylinderAlongZ(
    wristRadius,
    wristPinLength,
    darkMaterial,
    24,
  );
  nutWristPin.position.z = (slotPlaneZ - screwPlaneZ) / 2;
  nutWristPin.userData.role = 'nut-fixed-wrist-pin-through-yoke-slot';
  const nutWristIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 20, 14),
    whiteMaterial,
  );
  nutWristIndex.position.z = slotPlaneZ - screwPlaneZ + 0.035;
  nutWristIndex.userData.role = 'visible-white-wrist-in-vertical-slot';
  const nutWristAnchor = new THREE.Object3D();
  nutWristAnchor.position.z = slotPlaneZ - screwPlaneZ;
  nutWristAnchor.userData.role = 'analytic-nut-wrist-center-anchor';
  nutCarriage.add(
    nutIndex,
    nutWristPin,
    nutWristIndex,
    nutWristAnchor,
  );
  carrier.add(nutCarriage);
  root.add(carrier);

  const outputYoke = new THREE.Group();
  outputYoke.userData.role =
    'nonrotating-horizontal-silk-guide-with-vertical-wrist-slot';
  outputYoke.userData.translationAxis = X_AXIS.clone();
  const slotRails = [];
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, slotHalfLength * 2, 0.18),
      drivenMaterial,
    );
    rail.position.set(side * slotHalfWidth, 0, slotPlaneZ);
    rail.userData.role = 'vertical-yoke-slot-side-rail';
    slotRails.push(rail);
    outputYoke.add(rail);
  }
  const slotEndBridges = [];
  for (const side of [-1, 1]) {
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(slotHalfWidth * 2 + 0.15, 0.16, 0.18),
      drivenMaterial,
    );
    bridge.position.set(0, side * slotHalfLength, slotPlaneZ);
    bridge.userData.role = 'rounded-source-yoke-slot-end-bridge';
    slotEndBridges.push(bridge);
    outputYoke.add(bridge);
  }
  const guideRod = new THREE.Mesh(
    new THREE.BoxGeometry(guideRodLength, 0.13, 0.18),
    drivenMaterial,
  );
  guideRod.position.set(
    guideRodLength / 2,
    guideY,
    slotPlaneZ,
  );
  guideRod.userData.role = 'horizontal-rod-guiding-silk-on-bobbins';
  const silkGuideEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.055, 10, 36),
    accentMaterial,
  );
  silkGuideEye.position.set(
    guideRodLength,
    guideY,
    slotPlaneZ,
  );
  silkGuideEye.userData.role = 'working-silk-guide-eye-at-output-rod-end';
  const guideMotionIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.25, 0.045),
    whiteMaterial,
  );
  guideMotionIndex.position.set(
    guideRodLength * 0.72,
    guideY,
    slotPlaneZ + 0.115,
  );
  guideMotionIndex.userData.role = 'white-index-on-silk-guide-traverse';
  const yokeSlotCenterAnchor = new THREE.Object3D();
  yokeSlotCenterAnchor.position.z = slotPlaneZ;
  yokeSlotCenterAnchor.userData.role = 'analytic-yoke-slot-center-anchor';
  outputYoke.add(
    guideRod,
    silkGuideEye,
    guideMotionIndex,
    yokeSlotCenterAnchor,
  );
  root.add(outputYoke);

  const canonicalStates = {
    adjustmentComplete: {
      ...stateAtCarrierTurnCoordinate(
        completionCarrierTurnCoordinate,
        0,
      ),
      stage: 'completed-eighteen-step-adjustment',
    },
    firstContactEnd: {
      ...stateAtCarrierTurnCoordinate(contactHalfWidthTurns),
      stage: 'first-tappet-contact-complete',
    },
    firstContactMidpoint: {
      ...stateAtCarrierTurnCoordinate(0),
      stage: 'source-contact-midpoint',
    },
    firstContactStart: {
      ...stateAtCarrierTurnCoordinate(-contactHalfWidthTurns),
      stage: 'source-engraving-and-first-contact-start',
    },
    firstDwell: {
      ...stateAtCarrierTurnCoordinate(0.25),
      stage: 'first-indexed-setting-dwell',
    },
    oneCarrierTurnLater: {
      ...stateAtCarrierTurnCoordinate(1 - contactHalfWidthTurns),
      stage: 'one-turn-one-index-later',
    },
  };

  const geometry = {
    adjustmentDuration,
    adjustmentStepCount,
    carrierAngularSpeed,
    carrierRotationPeriod,
    carrierTurnsPerSecond,
    completionCarrierTurnCoordinate,
    contactHalfAngle,
    contactHalfWidthTurns,
    contactBoundaryTolerance,
    diskDepth,
    diskOuterRadius,
    diskPlaneZ,
    finalNutStation,
    fixedTappetTipPosition,
    guideBushingStations,
    guideRodLength,
    guideY,
    initialNutStation,
    nutAdvancePerIndex,
    rearFrameZ,
    screwLead,
    screwLength,
    screwPlaneZ,
    slotHalfLength,
    slotHalfWidth,
    slotPlaneZ,
    sourceCarrierAngle,
    sourceCarrierTurnCoordinate,
    sourceDiskCenter,
    sourceDiskOuterRadius,
    sourceGuideY,
    sourceImageHeight,
    sourceImageWidth,
    sourceNutStation,
    sourceNutWrist,
    sourcePointFromRaster,
    sourceScale,
    sourceScrewLowerBearing,
    sourceScrewUpperBearing,
    sourceScrewVector,
    sourceSlotBottom,
    sourceSlotTop,
    sourceTappetSupportTip,
    sourceTappetWheelCenter,
    sourceVisibleGuideEnd,
    tappetContactAngle,
    tappetWheelOuterRadius,
    tappetWheelPitchRadius,
    tappetWheelStation,
    tappetWheelTeeth,
    tappetWheelToothHeight,
    wheelAngularPitch,
    wristRadius,
  };

  root.userData.archetype =
    'disk-carried-tappet-indexed-lead-screw-nut-slotted-yoke-silk-traverse';
  root.userData.blocks = {
    base,
    bearingBraces,
    carrier,
    carrierInputIndex,
    centralBearing,
    centralShaft,
    diskFace,
    diskOuterRim,
    fixedFrame,
    fixedTappetPin,
    fixedTappetTip,
    guideBushings,
    guideMotionIndex,
    guidePosts,
    guideRod,
    leadScrew,
    leadScrewRotor,
    nutCarriage,
    nutFrameBlocks,
    nutIndex,
    nutWristAnchor,
    nutWristIndex,
    nutWristPin,
    outputYoke,
    screwChannel,
    screwChannelRails,
    screwEndBearings,
    silkGuideEye,
    slotEndBridges,
    slotRails,
    tappetBracket,
    tappetPost,
    tappetWheel,
    tappetWheelCenterAnchor,
    tappetWheelRotor,
    wheelShaftExtension,
    yokeSlotCenterAnchor,
  };
  root.userData.cameraDistanceScale = 1.03;
  root.userData.canonicalStates = canonicalStates;
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.indexLawAtCarrierTurn = indexLawAtCarrierTurn;
  root.userData.mechanism =
    'rotating-disk-carried-tappet-wheel-indexed-screw-variable-radius-slotted-yoke-silk-traverse';
  root.userData.modelPointToSourceRaster = modelPointToSourceRaster;
  root.userData.sourcePointFromRaster = sourcePointFromRaster;
  root.userData.stateAtCarrierTurnCoordinate =
    stateAtCarrierTurnCoordinate;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    carrier.rotation.z = state.carrierVisualAngle;
    leadScrewRotor.rotation.z = state.screwVisualAngle;
    tappetWheelRotor.rotation.z = state.screwVisualAngle;
    nutCarriage.position.x = state.nutStation;
    outputYoke.position.x = state.outputYokeX;
    root.userData.kinematics = state;
  };
  update(0);

  markShadows(root);
  diskFace.castShadow = false;
  diskFace.receiveShadow = false;
  return {
    cameraDirection: new THREE.Vector3(7.6, 5.2, 12.8),
    root,
    update,
  };
}

export function createAuthoredSilkTraverseMovement(movement) {
  if (movement.id !== 173) return null;
  return tappetIndexedSilkTraverse();
}
