import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

import { rackPinionGeometry, rackToothGeometry } from './rack-pinion-parts.js';
import { plate, poly, capsule, circle, sector as sectorPolygon, polygonClipping as clip } from './finite-plate-geometry.js';
import { boredJournal, fitPistonGuide } from './piston-guide-parts.js';
import { replaceWithLaidRope } from './laid-rope.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function cross2(left, right) {
  return left.x * right.y - left.y * right.x;
}

function positiveAngle(angle) {
  return ((angle % FULL_TURN) + FULL_TURN) % FULL_TURN;
}

function vector3From2(point, z = 0) {
  return new THREE.Vector3(point.x, point.y, z);
}

function slottedDiskLeverRackAndWeight(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.92);

  // Brown's plate is the only motion source: the official page explicitly
  // marks its animation unavailable. Coordinates below were measured on the
  // 525 px engraving. Its disk center is the model origin and y is inverted.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.012;
  const sourceRasterDiskCenter = new THREE.Vector2(256, 269);
  const sourceRasterDiskTop = new THREE.Vector2(256, 166);
  const sourceRasterDiskBottom = new THREE.Vector2(256, 365);
  const sourceRasterDiskLeft = new THREE.Vector2(161, 269);
  const sourceRasterDiskRight = new THREE.Vector2(355, 269);
  const sourceRasterDrivePin = new THREE.Vector2(300, 215);
  const sourceRasterLeverPivot = new THREE.Vector2(259, 422);
  const sourceRasterSlotTop = new THREE.Vector2(304, 168);
  const sourceRasterSlotBottom = new THREE.Vector2(271, 362);
  const sourceRasterGuidePin = new THREE.Vector2(319, 96);
  const sourceRasterCordAttachment = new THREE.Vector2(325, 69);
  const sourceRasterSectorPitchContact = new THREE.Vector2(259, 465);
  const sourceRasterRackPitchLeft = new THREE.Vector2(81, 465);
  const sourceRasterRackPitchRight = new THREE.Vector2(442, 465);
  const sourceRasterPulleyCenter = new THREE.Vector2(455, 52);
  const sourceRasterPulleyRunningPoint = new THREE.Vector2(472, 52);
  const sourceRasterWeightTop = new THREE.Vector2(472, 267);
  const sourceRasterWeightBottom = new THREE.Vector2(472, 342);
  const sourceRasterFrameLeftFoot = new THREE.Vector2(119, 491);
  const sourceRasterFrameRightFoot = new THREE.Vector2(386, 491);

  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterDiskCenter.x) * sourceScale,
    (sourceRasterDiskCenter.y - y) * sourceScale,
  );
  const diskCenter = sourcePointToModel(sourceRasterDiskCenter);
  const leverPivot = sourcePointToModel(sourceRasterLeverPivot);
  const sourceDrivePin = sourcePointToModel(sourceRasterDrivePin);
  const sourceGuidePin = sourcePointToModel(sourceRasterGuidePin);
  const sourceCordAttachment = sourcePointToModel(
    sourceRasterCordAttachment,
  );
  const pulleyCenter = sourcePointToModel(sourceRasterPulleyCenter);
  const sourceWeightTop = sourcePointToModel(sourceRasterWeightTop);
  const crankRadius = sourceDrivePin.distanceTo(diskCenter);
  const diskCenterDistance = leverPivot.distanceTo(diskCenter);
  const sourceDiskAngle = Math.atan2(
    sourceDrivePin.y - diskCenter.y,
    sourceDrivePin.x - diskCenter.x,
  );
  const sourceLeverAngle = Math.atan2(
    sourceDrivePin.y - leverPivot.y,
    sourceDrivePin.x - leverPivot.x,
  );
  const guideRadius = sourceGuidePin.distanceTo(leverPivot);
  const cordAttachmentRadius = sourceCordAttachment.distanceTo(leverPivot);
  const slotMinimumRadius = sourcePointToModel(sourceRasterSlotBottom)
    .distanceTo(leverPivot);
  const slotMaximumRadius = sourcePointToModel(sourceRasterSlotTop)
    .distanceTo(leverPivot);
  const sectorPitchRadius = sourcePointToModel(
    sourceRasterSectorPitchContact,
  ).distanceTo(leverPivot);
  const pulleyRunningRadius = sourcePointToModel(
    sourceRasterPulleyRunningPoint,
  ).distanceTo(pulleyCenter);
  const weightHeight = sourcePointToModel(sourceRasterWeightBottom)
    .distanceTo(sourceWeightTop);
  const measuredDiskRadiiPixels = {
    bottom: sourceRasterDiskBottom.distanceTo(sourceRasterDiskCenter),
    left: sourceRasterDiskLeft.distanceTo(sourceRasterDiskCenter),
    right: sourceRasterDiskRight.distanceTo(sourceRasterDiskCenter),
    top: sourceRasterDiskTop.distanceTo(sourceRasterDiskCenter),
  };
  const fittedDiskRadiusPixels = Object.values(measuredDiskRadiiPixels)
    .reduce((sum, radius) => sum + radius, 0)
    / Object.keys(measuredDiskRadiiPixels).length;
  const diskRadius = fittedDiskRadiusPixels * sourceScale;
  const diskRadiusFitPixelErrors = Object.fromEntries(
    Object.entries(measuredDiskRadiiPixels).map(([side, radius]) => [
      side,
      Math.abs(radius - fittedDiskRadiusPixels),
    ]),
  );

  const cyclePeriod = 4;
  const diskAngularSpeed = FULL_TURN / cyclePeriod;
  const drivePinRadius = 0.075;
  const slotHalfWidth = drivePinRadius + .003;
  const slotEndClearance = 0.12;
  const sectorEquivalentToothCount = 16;
  const sectorAngularPitch = FULL_TURN / sectorEquivalentToothCount;
  const rackPitch = sectorPitchRadius * sectorAngularPitch;
  const sectorToothCount = 7;
  // Brown cuts only a short run of teeth into the middle of the long guided
  // bar; the run is set below from the rack's stroke (the teeth the sector
  // can reach), which gives his seven.
  // Brown's sector and rack teeth are short and square-topped: stub teeth
  // (addendum 0.8 module) on one 20-degree rack profile shared by both, so
  // the sector teeth are not undercut petals and the rack teeth keep flat
  // tops.
  const toothModule = rackPitch / Math.PI;
  const toothHeight = 1.6 * toothModule;
  const toothPressureAngle = THREE.MathUtils.degToRad(20);
  const rackLength = rackPitch * 23.4;
  const rackDepth = 0.32;
  const rackBodyHeight = 0.24;
  const rackPitchY = leverPivot.y - sectorPitchRadius;
  const rackToothRootY = rackPitchY - toothHeight / 2 - .006;
  const sourceRackX = 0;
  const pulleySourceAngle = 0;
  const pulleyFlangeMajorRadius = pulleyRunningRadius * 1.10;
  const pulleyFlangeTubeRadius = 0.045;
  const pulleyOuterRadius = pulleyFlangeMajorRadius
    + pulleyFlangeTubeRadius;
  const weightWidth = 0.48;

  const centerDirection = Math.atan2(
    diskCenter.y - leverPivot.y,
    diskCenter.x - leverPivot.x,
  );
  const leverHalfStroke = Math.asin(crankRadius / diskCenterDistance);
  const minimumLeverAngle = centerDirection - leverHalfStroke;
  const maximumLeverAngle = centerDirection + leverHalfStroke;
  const diskCenterToPivotAngle = Math.atan2(
    leverPivot.y - diskCenter.y,
    leverPivot.x - diskCenter.x,
  );
  const tangentDiskOffset = Math.acos(crankRadius / diskCenterDistance);
  const leverTurningDiskAngles = [
    positiveAngle(diskCenterToPivotAngle - tangentDiskOffset),
    positiveAngle(diskCenterToPivotAngle + tangentDiskOffset),
  ].sort((left, right) => left - right);

  const cableGeometryForLever = (
    leverAngle,
    leverAngleFirstDerivative = 0,
    leverAngleSecondDerivative = 0,
  ) => {
    const radial = new THREE.Vector2(
      Math.cos(leverAngle),
      Math.sin(leverAngle),
    );
    const tangent = new THREE.Vector2(-radial.y, radial.x);
    const attachment = leverPivot.clone().addScaledVector(
      radial,
      cordAttachmentRadius,
    );
    const attachmentFirstDerivative = tangent.clone().multiplyScalar(
      cordAttachmentRadius * leverAngleFirstDerivative,
    );
    const attachmentSecondDerivative = tangent.clone().multiplyScalar(
      cordAttachmentRadius * leverAngleSecondDerivative,
    ).addScaledVector(
      radial,
      -cordAttachmentRadius * leverAngleFirstDerivative ** 2,
    );
    const centerToAttachment = attachment.clone().sub(pulleyCenter);
    const centerDistance = centerToAttachment.length();
    const centerDistanceFirstDerivative = centerToAttachment.dot(
      attachmentFirstDerivative,
    ) / centerDistance;
    const centerDistanceSecondDerivative = (
      attachmentFirstDerivative.lengthSq()
      + centerToAttachment.dot(attachmentSecondDerivative)
      - centerDistanceFirstDerivative ** 2
    ) / centerDistance;
    const straightLength = Math.sqrt(
      centerDistance ** 2 - pulleyRunningRadius ** 2,
    );
    const straightLengthFirstDerivative = centerDistance
      * centerDistanceFirstDerivative / straightLength;
    const straightLengthSecondDerivative = (
      centerDistanceFirstDerivative ** 2
      + centerDistance * centerDistanceSecondDerivative
    ) / straightLength - (
      centerDistance * centerDistanceFirstDerivative
      * straightLengthFirstDerivative / straightLength ** 2
    );
    const attachmentBearing = Math.atan2(
      centerToAttachment.y,
      centerToAttachment.x,
    );
    const bearingFirstDerivative = cross2(
      centerToAttachment,
      attachmentFirstDerivative,
    ) / centerDistance ** 2;
    const bearingSecondDerivative = cross2(
      centerToAttachment,
      attachmentSecondDerivative,
    ) / centerDistance ** 2 - 2 * cross2(
      centerToAttachment,
      attachmentFirstDerivative,
    ) * centerToAttachment.dot(attachmentFirstDerivative)
      / centerDistance ** 4;
    const tangentOffset = Math.acos(
      pulleyRunningRadius / centerDistance,
    );
    const tangentOffsetFirstDerivative = pulleyRunningRadius
      * centerDistanceFirstDerivative
      / (centerDistance * straightLength);
    const tangentOffsetDenominator = centerDistance * straightLength;
    const tangentOffsetDenominatorFirstDerivative =
      centerDistanceFirstDerivative * straightLength
      + centerDistance * straightLengthFirstDerivative;
    const tangentOffsetSecondDerivative = pulleyRunningRadius * (
      centerDistanceSecondDerivative * tangentOffsetDenominator
      - centerDistanceFirstDerivative
        * tangentOffsetDenominatorFirstDerivative
    ) / tangentOffsetDenominator ** 2;
    const incomingTangentAngle = positiveAngle(
      attachmentBearing - tangentOffset,
    );
    const tangentAngleFirstDerivative = bearingFirstDerivative
      - tangentOffsetFirstDerivative;
    const tangentAngleSecondDerivative = bearingSecondDerivative
      - tangentOffsetSecondDerivative;
    const tangentPoint = pulleyCenter.clone().add(new THREE.Vector2(
      Math.cos(incomingTangentAngle) * pulleyRunningRadius,
      Math.sin(incomingTangentAngle) * pulleyRunningRadius,
    ));
    const exitTangentPoint = pulleyCenter.clone().add(
      new THREE.Vector2(pulleyRunningRadius, 0),
    );
    const wrapAngle = incomingTangentAngle;
    const upperPathLength = straightLength
      + pulleyRunningRadius * wrapAngle;
    const upperPathFirstDerivative = straightLengthFirstDerivative
      + pulleyRunningRadius * tangentAngleFirstDerivative;
    const upperPathSecondDerivative = straightLengthSecondDerivative
      + pulleyRunningRadius * tangentAngleSecondDerivative;
    return {
      attachment,
      attachmentFirstDerivative,
      attachmentSecondDerivative,
      attachmentBearing,
      centerDistance,
      exitTangentPoint,
      incomingTangentAngle,
      straightLength,
      tangentPoint,
      upperPathFirstDerivative,
      upperPathLength,
      upperPathSecondDerivative,
      wrapAngle,
    };
  };

  const sourceCable = cableGeometryForLever(sourceLeverAngle);
  const sourceVerticalCableLength = pulleyCenter.y - sourceWeightTop.y;
  const engravedTotalCableLength = sourceCable.upperPathLength
    + sourceVerticalCableLength;
  // Brown draws the hanging weight at a schematic height that would carry it
  // through the pulley before the disk reaches its far turning point. Cord
  // length does not affect the motion law, so the working model adds enough
  // tail to keep the full-sized weight below the flange for the whole turn.
  const minimumVerticalCableLength = 0.44;
  const maximumExtremeUpperPathLength = Math.max(
    cableGeometryForLever(minimumLeverAngle).upperPathLength,
    cableGeometryForLever(maximumLeverAngle).upperPathLength,
  );
  const totalCableLength = maximumExtremeUpperPathLength
    + minimumVerticalCableLength;
  const cableLengthExtension = totalCableLength - engravedTotalCableLength;

  const stateAtDiskAngle = (diskAngle) => {
    const cosine = Math.cos(diskAngle);
    const sine = Math.sin(diskAngle);
    const drivePin = new THREE.Vector2(
      diskCenter.x + crankRadius * cosine,
      diskCenter.y + crankRadius * sine,
    );
    const drivePinFirstDerivative = new THREE.Vector2(
      -crankRadius * sine,
      crankRadius * cosine,
    );
    const drivePinSecondDerivative = new THREE.Vector2(
      -crankRadius * cosine,
      -crankRadius * sine,
    );
    const pivotToPin = drivePin.clone().sub(leverPivot);
    const slotCoordinate = pivotToPin.length();
    const slotCoordinateFirstDerivative = pivotToPin.dot(
      drivePinFirstDerivative,
    ) / slotCoordinate;
    const slotCoordinateSecondDerivative = (
      drivePinFirstDerivative.lengthSq()
      + pivotToPin.dot(drivePinSecondDerivative)
      - slotCoordinateFirstDerivative ** 2
    ) / slotCoordinate;
    const leverAngle = Math.atan2(pivotToPin.y, pivotToPin.x);
    const angleNumerator = cross2(pivotToPin, drivePinFirstDerivative);
    const leverAngleFirstDerivative = angleNumerator / slotCoordinate ** 2;
    const leverAngleSecondDerivative = cross2(
      pivotToPin,
      drivePinSecondDerivative,
    ) / slotCoordinate ** 2 - 2 * angleNumerator
      * pivotToPin.dot(drivePinFirstDerivative) / slotCoordinate ** 4;
    const leverRadial = new THREE.Vector2(
      Math.cos(leverAngle),
      Math.sin(leverAngle),
    );
    const reconstructedDrivePin = leverPivot.clone().addScaledVector(
      leverRadial,
      slotCoordinate,
    );
    const guidePin = leverPivot.clone().addScaledVector(
      leverRadial,
      guideRadius,
    );
    const leverAngularSpeed = leverAngleFirstDerivative * diskAngularSpeed;
    const leverAngularAcceleration = leverAngleSecondDerivative
      * diskAngularSpeed ** 2;
    const rackX = sourceRackX + sectorPitchRadius
      * (leverAngle - sourceLeverAngle);
    const rackSpeed = sectorPitchRadius * leverAngularSpeed;
    const rackAcceleration = sectorPitchRadius * leverAngularAcceleration;
    const cable = cableGeometryForLever(
      leverAngle,
      leverAngleFirstDerivative,
      leverAngleSecondDerivative,
    );
    const weightTopY = pulleyCenter.y + cable.upperPathLength
      - totalCableLength;
    const weightVerticalSpeed = cable.upperPathFirstDerivative
      * diskAngularSpeed;
    const weightVerticalAcceleration = cable.upperPathSecondDerivative
      * diskAngularSpeed ** 2;
    const weightTop = new THREE.Vector2(
      cable.exitTangentPoint.x,
      weightTopY,
    );
    const weightCenter = weightTop.clone().add(
      new THREE.Vector2(0, -weightHeight / 2),
    );
    const pulleyAngle = pulleySourceAngle
      + (weightTopY - sourceWeightTop.y) / pulleyRunningRadius;
    const pulleyAngularSpeed = weightVerticalSpeed / pulleyRunningRadius;
    const pulleyAngularAcceleration = weightVerticalAcceleration
      / pulleyRunningRadius;
    const currentCableLength = cable.upperPathLength
      + pulleyCenter.y - weightTopY;
    const tangentRadius = cable.tangentPoint.clone().sub(pulleyCenter);
    const tangentSegment = cable.attachment.clone().sub(
      cable.tangentPoint,
    );

    return {
      cableAttachment: vector3From2(cable.attachment),
      cableAttachmentAcceleration: vector3From2(
        cable.attachmentSecondDerivative.clone().multiplyScalar(
          diskAngularSpeed ** 2,
        ),
      ),
      cableAttachmentVelocity: vector3From2(
        cable.attachmentFirstDerivative.clone().multiplyScalar(
          diskAngularSpeed,
        ),
      ),
      cableIncomingLength: cable.straightLength,
      cableLength: currentCableLength,
      cableLengthError: currentCableLength - totalCableLength,
      cableTangentPoint: vector3From2(cable.tangentPoint),
      cableTangencyError: tangentRadius.dot(tangentSegment),
      cableUpperPathLength: cable.upperPathLength,
      cableWrapAngle: cable.wrapAngle,
      diskAngle,
      diskAngleWrapped: positiveAngle(diskAngle),
      diskAngularAcceleration: 0,
      diskAngularSpeed,
      drivePin: vector3From2(drivePin),
      drivePinAcceleration: vector3From2(
        drivePinSecondDerivative.clone().multiplyScalar(
          diskAngularSpeed ** 2,
        ),
      ),
      drivePinVelocity: vector3From2(
        drivePinFirstDerivative.clone().multiplyScalar(diskAngularSpeed),
      ),
      exitTangentPoint: vector3From2(cable.exitTangentPoint),
      guideArcError: Math.abs(guidePin.distanceTo(leverPivot) - guideRadius),
      guidePin: vector3From2(guidePin),
      leverAngle,
      leverAngleFromSource: leverAngle - sourceLeverAngle,
      leverAngularAcceleration,
      leverAngularSpeed,
      pulleyAngle,
      pulleyAngularAcceleration,
      pulleyAngularSpeed,
      pulleyNoSlipError:
        pulleyAngularSpeed * pulleyRunningRadius - weightVerticalSpeed,
      rackAcceleration: new THREE.Vector3(rackAcceleration, 0, 0),
      rackNoSlipError: rackSpeed
        - sectorPitchRadius * leverAngularSpeed,
      rackPitchTangentialSpeed: sectorPitchRadius * leverAngularSpeed,
      rackVelocity: new THREE.Vector3(rackSpeed, 0, 0),
      rackX,
      reconstructedDrivePin: vector3From2(reconstructedDrivePin),
      slotCenterlineError: reconstructedDrivePin.distanceTo(drivePin),
      slotCoordinate,
      slotEndClearance: Math.min(
        slotCoordinate - slotMinimumRadius,
        slotMaximumRadius - slotCoordinate,
      ) - drivePinRadius - slotEndClearance,
      slotSlidingAcceleration: slotCoordinateSecondDerivative
        * diskAngularSpeed ** 2,
      slotSlidingSpeed: slotCoordinateFirstDerivative * diskAngularSpeed,
      totalCableLength,
      weightAcceleration: new THREE.Vector3(
        0,
        weightVerticalAcceleration,
        0,
      ),
      weightCenter: vector3From2(weightCenter),
      weightTop: vector3From2(weightTop),
      weightVelocity: new THREE.Vector3(0, weightVerticalSpeed, 0),
      weightVerticalAcceleration,
      weightVerticalSpeed,
    };
  };

  const stateAtTime = (time) => stateAtDiskAngle(
    sourceDiskAngle + diskAngularSpeed * time,
  );

  const sourceState = stateAtTime(0);
  const sourceSlotTop = sourcePointToModel(sourceRasterSlotTop);
  const sourceSlotBottom = sourcePointToModel(sourceRasterSlotBottom);
  const sourceLeverDirection = new THREE.Vector2(
    Math.cos(sourceLeverAngle),
    Math.sin(sourceLeverAngle),
  );
  const sourcePoseFitPixelErrors = {
    cordAttachment: sourceState.cableAttachment.distanceTo(
      vector3From2(sourceCordAttachment),
    ) / sourceScale,
    drivePin: sourceState.drivePin.distanceTo(vector3From2(sourceDrivePin))
      / sourceScale,
    guidePin: sourceState.guidePin.distanceTo(vector3From2(sourceGuidePin))
      / sourceScale,
    slotBottom: leverPivot.clone().addScaledVector(
      sourceLeverDirection,
      slotMinimumRadius,
    ).distanceTo(sourceSlotBottom) / sourceScale,
    slotTop: leverPivot.clone().addScaledVector(
      sourceLeverDirection,
      slotMaximumRadius,
    ).distanceTo(sourceSlotTop) / sourceScale,
    weightTop: sourceState.weightTop.distanceTo(vector3From2(sourceWeightTop))
      / sourceScale,
  };

  let minimumUpperPathLength = Infinity;
  let maximumUpperPathLength = -Infinity;
  let minimumSlotEndClearance = Infinity;
  let minimumRackX = Infinity;
  let maximumRackX = -Infinity;
  for (let index = 0; index <= 4096; index += 1) {
    const state = stateAtDiskAngle(FULL_TURN * index / 4096);
    minimumUpperPathLength = Math.min(
      minimumUpperPathLength,
      state.cableUpperPathLength,
    );
    maximumUpperPathLength = Math.max(
      maximumUpperPathLength,
      state.cableUpperPathLength,
    );
    minimumSlotEndClearance = Math.min(
      minimumSlotEndClearance,
      state.slotEndClearance,
    );
    minimumRackX = Math.min(minimumRackX, state.rackX);
    maximumRackX = Math.max(maximumRackX, state.rackX);
  }
  // A rack tooth is cut only where the sector can reach it: within two
  // pitches of the pitch point (where the sector's teeth stand in the rack's
  // tooth band) at some point of the stroke. Offsets are in pitches from the
  // lever pivot at the source pose, half-way between sector teeth.
  const rackReachPitches = 2;
  const rackToothOffsets = [];
  for (let step = -12; step <= 11; step += 1) {
    const offset = step + 0.5;
    if (offset * rackPitch + maximumRackX >= -rackReachPitches * rackPitch - 1e-9
      && offset * rackPitch + minimumRackX <= rackReachPitches * rackPitch + 1e-9) {
      rackToothOffsets.push(offset);
    }
  }
  const rackToothCount = rackToothOffsets.length;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.6,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.14,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.2,
    roughness: 0.5,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });
  const cordMaterial = matte(PALETTE.rope, {
    metalness: 0.02,
    roughness: 0.82,
  });

  const frame = new THREE.Group();
  frame.userData.role = 'fixed-two-post-machine-frame';
  root.add(frame);
  const leftFoot = sourcePointToModel(sourceRasterFrameLeftFoot);
  const rightFoot = sourcePointToModel(sourceRasterFrameRightFoot);
  const frameTopY = 1.58;
  for (const x of [leftFoot.x, rightFoot.x]) {
    frame.add(makeBeam(
      new THREE.Vector3(x, leftFoot.y, -0.42),
      new THREE.Vector3(x, frameTopY, -0.42),
      { color: PALETTE.frame, radius: 0.105 },
    ));
  }
  // Brown's lower rails (raster y 370 and 400): both pass outside the sweep
  // of the hand crank behind the disk.
  for (const y of [-1.55, -1.21]) {
    frame.add(makeBeam(
      new THREE.Vector3(leftFoot.x, y, -0.44),
      new THREE.Vector3(rightFoot.x, y, -0.44),
      { color: PALETTE.frame, radius: 0.085 },
    ));
  }
  const pulleyBracePoint = new THREE.Vector3(
    rightFoot.x,
    1.55,
    -0.38,
  );
  frame.add(makeBeam(
    pulleyBracePoint,
    new THREE.Vector3(pulleyCenter.x, pulleyCenter.y, -0.38),
    { color: PALETTE.frame, radius: 0.11 },
  ));

  const disk = new THREE.Group();
  disk.position.set(diskCenter.x, diskCenter.y, -0.12);
  disk.userData.axis = Z_AXIS.clone();
  disk.userData.role = 'continuously-revolving-eccentric-pin-disk';
  root.add(disk);
  const diskRotor = new THREE.Group();
  diskRotor.userData.role = 'disk-and-fixed-drive-pin-rigid-rotor';
  disk.add(diskRotor);
  const diskBody = cylinderAlongZ(diskRadius, 0.3, driverMaterial, 72);
  diskBody.userData.role = 'solid-driving-disk';
  diskRotor.add(diskBody);
  // The hub stands a little proud of both disk faces (a hub flush with the
  // disk, and the axle end, shared their face planes and z-fought).
  const diskHub = cylinderAlongZ(0.14, 0.38, darkMaterial, 32);
  diskHub.userData.role = 'fixed-disk-axis-hub';
  diskRotor.add(diskHub);
  const diskAxle=cylinderAlongZ(.07,.86,darkMaterial);
  diskAxle.position.z=-.25;
  diskAxle.userData.role='rear-disk-axle';diskRotor.add(diskAxle);
  // Brown dashes a hand crank behind the disk, from the axle down-left to
  // the rim (raster 200,325 at the source phase): a plain arm keyed on the
  // axle against the disk's back face, with a short rearward handle that
  // stops in front of the bearing stays.
  const rearCrankTip = sourcePointToModel(new THREE.Vector2(200, 325))
    .sub(diskCenter).rotateAround(new THREE.Vector2(), -sourceDiskAngle);
  const rearCrankArm = new THREE.Mesh(plate(clip.difference(
    clip.union(capsule([0, 0], [rearCrankTip.x, rearCrankTip.y], .085, 24),
      poly(circle([0, 0], .20, 48))),
    poly(circle([0, 0], .143, 48))), -.21, -.15), driverMaterial);
  rearCrankArm.userData.role = 'rear-hand-crank-arm-keyed-on-disk-axle';
  diskRotor.add(rearCrankArm);
  // Pass 98: the handle runs on through the arm's round end and stops 0.005
  // inside its front face (z -0.15), so it is flush with the arm's front
  // rather than butting on its back face; its rear end is unchanged (z -0.39).
  const rearCrankHandle = cylinderAlongZ(.06, .235, darkMaterial, 32);
  rearCrankHandle.position.set(rearCrankTip.x, rearCrankTip.y, -.2725);
  rearCrankHandle.userData.role = 'rear-hand-crank-handle';
  diskRotor.add(rearCrankHandle);
  // The bearing and its stays sit behind the posts, clear of the handle.
  const diskBearing=boredJournal(.18,.073,.20,frameMaterial);
  diskBearing.position.set(diskCenter.x,diskCenter.y,-.64);
  diskBearing.userData.role='bored-disk-bearing';root.add(diskBearing);
  for(const x of [leftFoot.x,rightFoot.x]) {
    frame.add(makeBeam(new THREE.Vector3(x,0,-.64),new THREE.Vector3(Math.sign(x)*.18,0,-.64),
      {color:PALETTE.frame,radius:.085}));
    // Strut meets the guide's inner rim behind the plate, clear of the slot.
    const y=leverPivot.y+Math.sqrt((guideRadius-.19)**2-(x-leverPivot.x)**2);
    frame.add(makeBeam(new THREE.Vector3(x,frameTopY,-.42),new THREE.Vector3(x,y,-.2),
      {color:PALETTE.frame,radius:.08}));
  }
  const diskIndex = makeBeam(
    new THREE.Vector3(0, 0, 0.19),
    new THREE.Vector3(crankRadius, 0, 0.19),
    { color: PALETTE.white, radius: 0.035 },
  );
  diskIndex.userData.role = 'white-disk-phase-and-crank-radius-index';
  diskIndex.position.z=-.04;
  // Brown draws the crank radius only dashed behind the disk; no front index.
  const drivePin = cylinderAlongZ(drivePinRadius, 0.62, accentMaterial, 32);
  drivePin.position.set(crankRadius, 0, 0.27);
  drivePin.userData.role = 'disk-fixed-pin-sliding-in-lever-slot';
  diskRotor.add(drivePin);
  const drivePinHead = cylinderAlongZ(0.105, 0.06, darkMaterial, 32);
  drivePinHead.position.set(crankRadius, 0, 0.61);
  drivePinHead.userData.role = 'visible-drive-pin-head';
  diskRotor.add(drivePinHead);

  const lever = new THREE.Group();
  lever.position.set(leverPivot.x, leverPivot.y, 0.18);
  lever.userData.axis = Z_AXIS.clone();
  lever.userData.role =
    'single-pivoted-slotted-bar-with-rack-sector-and-cord-eye';
  root.add(lever);
  const leverBody = new THREE.Mesh(plate(clip.difference(
    capsule([0,0],[cordAttachmentRadius+.12,0],.19,32),
    capsule([slotMinimumRadius,0],[slotMaximumRadius,0],slotHalfWidth,32),
    poly(circle([0,0],.133,64))
  ),-.09,.09), drivenMaterial);
  leverBody.userData.role = 'upright-slotted-vibrating-bar';
  lever.add(leverBody);
  const slotFloor = new THREE.Object3D();
  slotFloor.userData.role='single-straight-recessed-lever-slot';
  slotFloor.visible=false;
  const slotHighlight = new THREE.Object3D();
  slotHighlight.visible=false;

  const sectorContactAngle = -Math.PI / 2 - sourceLeverAngle;
  const sectorHalfSpan = sectorAngularPitch * sectorToothCount / 2;
  const wholePinion = rackPinionGeometry({radius:sectorPitchRadius, teeth:sectorEquivalentToothCount,
    addendum:toothHeight/2, depth:rackDepth, bore:.133, pressureAngle:toothPressureAngle});
  const sectorOutline=wholePinion.userData.outline.map(p=>[
    p.x*Math.cos(sectorContactAngle)-p.y*Math.sin(sectorContactAngle),
    p.x*Math.sin(sectorContactAngle)+p.y*Math.cos(sectorContactAngle)]);
  const sector = new THREE.Mesh(plate(clip.difference(clip.union(
    clip.intersection(poly(sectorOutline),sectorPolygon(0,sectorPitchRadius+toothHeight,
      sectorContactAngle-sectorHalfSpan,sectorContactAngle+sectorHalfSpan)),
    poly(circle([0,0],.19,64))),poly(circle([0,0],.133,64))),-rackDepth/2,rackDepth/2), drivenMaterial);
  wholePinion.dispose();
  sector.position.z = 0;
  sector.userData.role = 'lever-rigid-lower-toothed-sector-body';
  lever.add(sector);
  const sectorTeeth = [];
  for (let index = 0; index < sectorToothCount; index += 1) {
    const offset = index - (sectorToothCount - 1) / 2;
    const angle = sectorContactAngle + offset * sectorAngularPitch;
    const tooth = new THREE.Object3D();
    tooth.position.set(
      Math.cos(angle) * sectorPitchRadius,
      Math.sin(angle) * sectorPitchRadius,
      0,
    );
    tooth.rotation.z = angle - Math.PI / 2;
    tooth.userData.index = index;
    tooth.userData.role = 'sector-rack-working-tooth';
    sectorTeeth.push(tooth);
    tooth.visible = false;
  }
  const pivotPin = cylinderAlongZ(0.13, 1.00, darkMaterial, 32);
  pivotPin.position.set(leverPivot.x, leverPivot.y, 0.12);
  pivotPin.userData.role = 'fixed-lower-lever-fulcrum';
  root.add(pivotPin);
  const pivotBearing=boredJournal(.23,.133,.20,frameMaterial);
  pivotBearing.position.set(leverPivot.x,leverPivot.y,-.27);root.add(pivotBearing);
  for(const x of [leftFoot.x,rightFoot.x])frame.add(makeBeam(
    new THREE.Vector3(x,leverPivot.y,-.33),new THREE.Vector3(leverPivot.x+Math.sign(x)*.23,leverPivot.y,-.33),
    {color:PALETTE.frame,radius:.085}));
  const pivotCap = cylinderAlongZ(0.075, 0.07, darkMaterial, 30);
  pivotCap.position.set(leverPivot.x, leverPivot.y, 0.58);
  pivotCap.userData.role = 'fixed-lever-pivot-cap';
  root.add(pivotCap);

  const guideMinimumAngle = minimumLeverAngle - 0.09;
  const guideMaximumAngle = maximumLeverAngle + 0.09;
  const guideOutline=sectorPolygon(guideRadius-.17,guideRadius+.17,guideMinimumAngle,guideMaximumAngle);
  const guideOpening=sectorPolygon(guideRadius-.088,guideRadius+.088,
    guideMinimumAngle+.02,guideMaximumAngle-.02);
  const topGuide = new THREE.Mesh(plate(clip.difference(guideOutline,guideOpening),-.17,-.05), frameMaterial);
  topGuide.position.set(leverPivot.x,leverPivot.y,0);
  topGuide.userData.role = 'fixed-concentric-upper-lever-guide';
  root.add(topGuide);
  const guideSlot = new THREE.Object3D();
  guideSlot.userData.role='upper-guide-arcuate-slot';
  // Runs from inside the guide plate (world z -0.15) through the lever face.
  const guidePin = cylinderAlongZ(0.085, 0.43, darkMaterial, 30);
  guidePin.position.set(guideRadius, 0, -.115);
  guidePin.userData.role = 'lever-pin-traversing-concentric-guide';
  lever.add(guidePin);
  const cordEye = cylinderAlongZ(.045,.32,darkMaterial);
  cordEye.position.set(cordAttachmentRadius, 0, .25);
  cordEye.userData.role = 'cord-eye-on-upper-end-of-lever';
  lever.add(cordEye);

  const rack = new THREE.Group();
  rack.userData.role = 'horizontal-reciprocating-rack';
  root.add(rack);
  // A deeper blue than the lever's sector, so the mesh at the base reads.
  const rackMaterial = drivenMaterial.clone();
  rackMaterial.color.multiplyScalar(0.62);
  const rackBody = new THREE.Mesh(
    new THREE.BoxGeometry(rackLength, rackBodyHeight, rackDepth),
    rackMaterial,
  );
  rackBody.position.set(
    0,
    rackToothRootY - rackBodyHeight / 2,
    0.18,
  );
  rackBody.userData.role = 'guided-horizontal-rack-body';
  rack.add(rackBody);
  const rackToothSolid = rackToothGeometry({pitch:rackPitch,addendum:toothHeight/2,depth:rackDepth,pressureAngle:toothPressureAngle});
  const rackTeeth = [];
  for (let index = 0; index < rackToothCount; index += 1) {
    const tooth = new THREE.Mesh(rackToothSolid, rackMaterial);
    tooth.position.set(
      leverPivot.x + rackToothOffsets[index] * rackPitch,
      rackPitchY,
      0.18,
    );
    tooth.userData.index = index;
    tooth.userData.role = 'rack-working-tooth';
    rackTeeth.push(tooth);
    rack.add(tooth);
  }
  const rackIndex = new THREE.Mesh(
    new THREE.BoxGeometry(rackPitch * 0.52, 0.035, rackDepth + 0.035),
    whiteMaterial,
  );
  rackIndex.position.set(rackPitch / 2, rackToothRootY - 0.08, 0.18);
  rackIndex.userData.role = 'white-rack-translation-index';
  // Each rack guide is one C-section extrusion carried by its frame post:
  // a rear upright enclosing the post's foot (post radius 0.105 at z -0.42), a bridge under the rack and a
  // front upright, as Brown draws the posts standing past the rack.
  const rackBodyBottomY = rackToothRootY - rackBodyHeight;
  const guideClearance = 0.03;
  const guideBottomY = rackBodyBottomY - guideClearance - 0.06;
  const guideTopY = rackToothRootY + 0.13;
  const rackBackZ = 0.18 - rackDepth / 2;
  const rackFrontZ = 0.18 + rackDepth / 2;
  const guideSection = poly([
    [-0.56, guideBottomY], [rackFrontZ + guideClearance + 0.1, guideBottomY],
    [rackFrontZ + guideClearance + 0.1, guideTopY], [rackFrontZ + guideClearance, guideTopY],
    [rackFrontZ + guideClearance, rackBodyBottomY - guideClearance],
    [rackBackZ - guideClearance, rackBodyBottomY - guideClearance],
    [rackBackZ - guideClearance, guideTopY], [-0.56, guideTopY],
  ]);
  for (const x of [leftFoot.x, rightFoot.x]) {
    const guide = new THREE.Group();
    guide.userData.role = 'fixed-rack-slide-guide';
    const body = new THREE.Mesh(plate(guideSection, -0.12, 0.12).rotateY(-Math.PI / 2), frameMaterial);
    body.position.x = x;
    body.userData.role = 'one-piece-C-section-rack-guide-on-frame-post';
    guide.add(body);
    root.add(guide);
  }

  const pulley = new THREE.Group();
  pulley.position.set(pulleyCenter.x, pulleyCenter.y, 0.59);
  pulley.userData.axis = Z_AXIS.clone();
  pulley.userData.role = 'fixed-axis-cord-redirect-pulley';
  root.add(pulley);
  const pulleyRotor = new THREE.Group();
  pulleyRotor.userData.role = 'no-slip-cord-pulley-rotor';
  pulley.add(pulleyRotor);
  // Sheave and flanges are bored 0.003 over the hub's own bore, inside the
  // hub's wall, so the bores do not coincide (they flickered).
  const pulleySheave = boredJournal(pulleyRunningRadius-.029, .051, .08, accentMaterial);
  pulleySheave.userData.role = 'cord-running-sheave';
  pulleyRotor.add(pulleySheave);
  const pulleyFlanges = [-1, 1].map((side) => {
    const flange = boredJournal(pulleyOuterRadius,.051,.055,darkMaterial);
    flange.position.z=side*.0675;
    flange.userData.role = 'pulley-retaining-flange';
    pulleyRotor.add(flange);
    return flange;
  });
  const pulleyHub = boredJournal(0.075,.048,.48,darkMaterial);
  pulleyHub.userData.role = 'pulley-hub';
  pulleyRotor.add(pulleyHub);
  const pulleyAxle=cylinderAlongZ(.045,1.20,darkMaterial);
  pulleyAxle.position.set(pulleyCenter.x,pulleyCenter.y,.05);
  pulleyAxle.userData.role='fixed-pulley-axle-reaching-frame';
  root.add(pulleyAxle);
  const pulleyIndex = new THREE.Mesh(
    new THREE.BoxGeometry(pulleyRunningRadius * 0.95, 0.045, 0.035),
    whiteMaterial,
  );
  pulleyIndex.position.set(pulleyRunningRadius * 0.46, 0, 0.105);
  pulleyIndex.userData.role = 'white-pulley-no-slip-speed-index';

  const ropePlaneZ = 0.59;
  const cord = new THREE.Group();
  cord.userData.role = 'single-inextensible-cord-over-fixed-pulley';
  root.add(cord);
  // Brown draws one plain cord; it is the shared three-strand laid rope,
  // one continuous piece from the lever eye over the sheave to the weight.
  const cordRadius = 0.028;
  const cordPath = (state) => {
    const at = (point) => new THREE.Vector3(point.x, point.y, ropePlaneZ);
    const path = new THREE.CurvePath();
    path.add(new THREE.LineCurve3(at(state.cableAttachment), at(state.cableTangentPoint)));
    const wrap = state.cableWrapAngle, arcPoints = [];
    const arcSteps = Math.max(2, Math.ceil(Math.abs(wrap) / (Math.PI / 48)));
    for (let index = 0; index <= arcSteps; index += 1) {
      const angle = wrap * (1 - index / arcSteps);
      arcPoints.push(new THREE.Vector3(
        pulleyCenter.x + Math.cos(angle) * pulleyRunningRadius,
        pulleyCenter.y + Math.sin(angle) * pulleyRunningRadius,
        ropePlaneZ,
      ));
    }
    for (let index = 1; index < arcPoints.length; index += 1) {
      path.add(new THREE.LineCurve3(arcPoints[index - 1], arcPoints[index]));
    }
    path.add(new THREE.LineCurve3(at(state.exitTangentPoint), at(state.weightTop)));
    return path;
  };
  const cordRope = new THREE.Mesh(new THREE.BufferGeometry(), cordMaterial);
  cordRope.userData.role = 'single-laid-cord-from-lever-eye-over-pulley-to-weight';
  cordRope.userData.crossSection = 'laid-rope';
  cordRope.userData.radius = cordRadius;
  cord.add(cordRope);

  const weight = new THREE.Group();
  weight.userData.role = 'purely-vertical-reciprocating-weight';
  root.add(weight);
  const weightBody = new THREE.Mesh(
    new THREE.BoxGeometry(weightWidth, weightHeight, 0.34),
    drivenMaterial,
  );
  weightBody.userData.role = 'hanging-weight-body';
  weight.add(weightBody);
  const weightTopEye = new THREE.Mesh(
    new THREE.SphereGeometry(.035,12,8),
    darkMaterial,
  );
  weightTopEye.position.y = weightHeight / 2;
  weightTopEye.userData.role = 'weight-cord-eye';
  weight.add(weightTopEye);
  const weightIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.045, 0.365),
    whiteMaterial,
  );
  weightIndex.position.set(0, 0, 0.01);
  weightIndex.userData.role = 'white-weight-translation-index';

  root.userData.archetype =
    'eccentric-disk-pin-slotted-lever-sector-rack-cord-weight';
  root.userData.blocks = {
    cord,
    cordEye,
    disk,
    diskBody,
    diskHub,
    diskIndex,
    diskRotor,
    drivePin,
    drivePinHead,
    frame,
    guidePin,
    guideSlot,
    cordRope,
    lever,
    leverBody,
    pivotCap,
    pivotPin,
    pulley,
    pulleyFlanges,
    pulleyHub,
    pulleyIndex,
    pulleyRotor,
    pulleySheave,
    rack,
    rackBody,
    rackIndex,
    rackTeeth,
    sector,
    sectorTeeth,
    slotFloor,
    slotHighlight,
    topGuide,
    weight,
    weightBody,
    weightIndex,
    weightTopEye,
  };
  root.userData.geometry = {
    cableLengthExtension,
    cordAttachmentRadius,
    crankRadius,
    cyclePeriod,
    diskAngularSpeed,
    diskCenterDistance,
    diskRadius,
    drivePinRadius,
    guideRadius,
    maximumLeverAngle,
    minimumLeverAngle,
    minimumSlotEndClearance,
    minimumVerticalCableLength,
    pulleyRunningRadius,
    pulleyOuterRadius,
    rackLength,
    rackPitch,
    rackPitchY,
    rackToothCount,
    rackToothOffsets,
    sectorAngularPitch,
    sectorEquivalentToothCount,
    sectorPitchRadius,
    sectorToothCount,
    slotHalfWidth,
    slotMaximumRadius,
    slotMinimumRadius,
    sourceDiskAngle,
    sourceLeverAngle,
    sourceScale,
    toothHeight,
    totalCableLength,
    weightHeight,
    weightWidth,
  };
  root.userData.mechanism =
    'one continuously revolving disk carries one eccentric fixed pin in the single straight slot of one lower-pivoted upright bar; that exact pin-slot constraint vibrates the whole bar, whose rigid lower toothed sector drives one horizontal rack without slip while its upper cord eye pays one inextensible cord over one fixed pulley to give the hanging weight perpendicular vertical reciprocation';
  root.userData.movement = movement;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason:
      'The official Movement 282 page marks its animation unavailable. All motion is independently reconstructed from the exact crank-pin/straight-slot constraint and the two output constraints described in Brown’s public-domain plate.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate282: {
      diskRadiusFitPixelErrors,
      engravedCableLength: engravedTotalCableLength,
      fittedDiskRadiusPixels,
      fullStrokeCableLengthExtension: cableLengthExtension,
      fullStrokeCableLengthExtensionPixels:
        cableLengthExtension / sourceScale,
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'one fixed-axis disk with one eccentric pin, one straight-slotted bar pivoted near its lower end, one rigid lower sector meshing one horizontal rack, one concentric upper guide, and one cord from the upper bar over one fixed pulley to one weight',
      measurementUncertaintyPixels: 6,
      rasterCordAttachment: {
        x: sourceRasterCordAttachment.x,
        y: sourceRasterCordAttachment.y,
      },
      rasterDiskBottom: {
        x: sourceRasterDiskBottom.x,
        y: sourceRasterDiskBottom.y,
      },
      rasterDiskCenter: {
        x: sourceRasterDiskCenter.x,
        y: sourceRasterDiskCenter.y,
      },
      rasterDiskLeft: {
        x: sourceRasterDiskLeft.x,
        y: sourceRasterDiskLeft.y,
      },
      rasterDiskRight: {
        x: sourceRasterDiskRight.x,
        y: sourceRasterDiskRight.y,
      },
      rasterDiskTop: {
        x: sourceRasterDiskTop.x,
        y: sourceRasterDiskTop.y,
      },
      rasterDrivePin: {
        x: sourceRasterDrivePin.x,
        y: sourceRasterDrivePin.y,
      },
      rasterFrameLeftFoot: {
        x: sourceRasterFrameLeftFoot.x,
        y: sourceRasterFrameLeftFoot.y,
      },
      rasterFrameRightFoot: {
        x: sourceRasterFrameRightFoot.x,
        y: sourceRasterFrameRightFoot.y,
      },
      rasterGuidePin: {
        x: sourceRasterGuidePin.x,
        y: sourceRasterGuidePin.y,
      },
      rasterLeverPivot: {
        x: sourceRasterLeverPivot.x,
        y: sourceRasterLeverPivot.y,
      },
      rasterPulleyCenter: {
        x: sourceRasterPulleyCenter.x,
        y: sourceRasterPulleyCenter.y,
      },
      rasterPulleyRunningPoint: {
        x: sourceRasterPulleyRunningPoint.x,
        y: sourceRasterPulleyRunningPoint.y,
      },
      rasterRackPitchLeft: {
        x: sourceRasterRackPitchLeft.x,
        y: sourceRasterRackPitchLeft.y,
      },
      rasterRackPitchRight: {
        x: sourceRasterRackPitchRight.x,
        y: sourceRasterRackPitchRight.y,
      },
      rasterSectorPitchContact: {
        x: sourceRasterSectorPitchContact.x,
        y: sourceRasterSectorPitchContact.y,
      },
      rasterSlotBottom: {
        x: sourceRasterSlotBottom.x,
        y: sourceRasterSlotBottom.y,
      },
      rasterSlotTop: {
        x: sourceRasterSlotTop.x,
        y: sourceRasterSlotTop.y,
      },
      rasterWeightBottom: {
        x: sourceRasterWeightBottom.x,
        y: sourceRasterWeightBottom.y,
      },
      rasterWeightTop: {
        x: sourceRasterWeightTop.x,
        y: sourceRasterWeightTop.y,
      },
      sourcePoseFitPixelErrors,
      sourcePoseFit:
        'the exact rigid-bar centerline is fixed by the engraved pivot and drive pin; the slot ends, upper guide pin, and cord eye are projected to that line within the six-pixel plate uncertainty, and the disk pin reproduces its measured source coordinate exactly',
      weightPlacementNote:
        'Brown’s drawn weight height leaves less cord than the upper lever consumes before its far turning point; the 3D model preserves the exact weight stroke but lengthens the cord so the weight remains below the pulley throughout a complete disk revolution',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 75,
      edition: 21,
      illustrationPage: 74,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtDiskAngle = stateAtDiskAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cyclePeriod,
    diskTurnsPerCycle: 1,
    leverTurningDiskAngles,
    sourceTime: 0,
  };
  root.userData.transmission = {
    cableConstraint:
      'incoming tangent length + clockwise pulley wrap + vertical hanging length is constant',
    input: 'one constant-speed revolving disk and its one fixed eccentric pin',
    leverAngularStroke: maximumLeverAngle - minimumLeverAngle,
    outputs: [
      'alternate horizontal rectilinear rack motion',
      'alternate perpendicular vertical weight motion',
    ],
    pulleyNoSlipLaw:
      'pulley-angular-speed = vertical-cord-speed / running-radius',
    rackNoSlipLaw:
      'rack-speed = sector-pitch-radius * lever-angular-speed',
    rackStroke: sectorPitchRadius
      * (maximumLeverAngle - minimumLeverAngle),
    minimumVerticalCableLength,
    slotConstraint:
      'disk-fixed pin = lever pivot + instantaneous slot coordinate times lever direction',
    slotRadialClearance: slotHalfWidth - drivePinRadius,
    weightStroke: maximumUpperPathLength - minimumUpperPathLength,
  };

  const updateCord = (state) => {
    // The cord is tied at the lever eye, so its lay is anchored there.
    const path = cordPath(state);
    replaceWithLaidRope(cordRope, path, { radius: cordRadius, travel: 0 });
    cordRope.userData.curve = path;
    cordRope.userData.incomingLength = path.curves[0].getLength();
  };

  const update = (time) => {
    const state = stateAtTime(time);
    diskRotor.rotation.z = state.diskAngle;
    disk.userData.angularAcceleration = state.diskAngularAcceleration;
    disk.userData.angularSpeed = state.diskAngularSpeed;
    lever.rotation.z = state.leverAngle;
    lever.userData.angularAcceleration = state.leverAngularAcceleration;
    lever.userData.angularSpeed = state.leverAngularSpeed;
    rack.position.x = state.rackX;
    rack.userData.acceleration = state.rackAcceleration.clone();
    rack.userData.velocity = state.rackVelocity.clone();
    pulleyRotor.rotation.z = state.pulleyAngle;
    pulley.userData.angularAcceleration = state.pulleyAngularAcceleration;
    pulley.userData.angularSpeed = state.pulleyAngularSpeed;
    weight.position.copy(state.weightCenter);
    weight.position.z = ropePlaneZ;
    weight.userData.acceleration = state.weightAcceleration.clone();
    weight.userData.velocity = state.weightVelocity.clone();
    updateCord(state);
    root.userData.contacts = {
      drivePinSlot: {
        active: true,
        centerlineError: state.slotCenterlineError,
        endClearance: state.slotEndClearance,
        radialClearance: slotHalfWidth - drivePinRadius,
        slidingSpeed: state.slotSlidingSpeed,
      },
      rackSector: {
        active: true,
        noSlipError: state.rackNoSlipError,
        pitchPoint: new THREE.Vector3(
          leverPivot.x,
          rackPitchY,
          0.36,
        ),
        tangentialSpeed: state.rackPitchTangentialSpeed,
      },
      ropePulley: {
        active: true,
        cableLengthError: state.cableLengthError,
        noSlipError: state.pulleyNoSlipError,
        tangencyError: state.cableTangencyError,
      },
      upperGuide: {
        active: true,
        radialError: state.guideArcError,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData.cameraFov=8;
  fitPistonGuide(root,update,cyclePeriod);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(.5,.25,14),
  };
}

export function createAuthoredSlottedDiskLeverMovement(movement) {
  if (movement.id !== 282) return null;
  const result = slottedDiskLeverRackAndWeight(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
