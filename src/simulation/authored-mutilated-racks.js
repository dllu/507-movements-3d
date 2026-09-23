import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function modulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function wrappedAngle(angle) {
  const turns = angle / FULL_TURN;
  if (Math.abs(turns - Math.round(turns)) < 1e-12) return 0;
  return modulo(angle, FULL_TURN);
}

function centeredExtrusion(shape, depth, bevelSize = 0.008) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 16,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function cylinderAlongX(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function quinticHermite({
  endSecondDerivative = 0,
  endSlope,
  endValue,
  startSecondDerivative = 0,
  startSlope,
  startValue,
  u,
  width,
}) {
  const derivative0 = startSlope * width;
  const derivative1 = endSlope * width;
  const secondDerivative0 = startSecondDerivative * width ** 2;
  const secondDerivative1 = endSecondDerivative * width ** 2;
  const coefficient0 = startValue;
  const coefficient1 = derivative0;
  const coefficient2 = secondDerivative0 / 2;
  const residualValue = endValue
    - coefficient0 - coefficient1 - coefficient2;
  const residualSlope = derivative1
    - coefficient1 - 2 * coefficient2;
  const residualCurvature = secondDerivative1 - 2 * coefficient2;
  const coefficient3 = 10 * residualValue
    - 4 * residualSlope + residualCurvature / 2;
  const coefficient4 = -15 * residualValue
    + 7 * residualSlope - residualCurvature;
  const coefficient5 = 6 * residualValue
    - 3 * residualSlope + residualCurvature / 2;
  const u2 = u * u;
  const u3 = u2 * u;
  const u4 = u3 * u;
  const u5 = u4 * u;
  const value = coefficient0 + coefficient1 * u
    + coefficient2 * u2 + coefficient3 * u3
    + coefficient4 * u4 + coefficient5 * u5;
  const firstDerivativeU = coefficient1 + 2 * coefficient2 * u
    + 3 * coefficient3 * u2 + 4 * coefficient4 * u3
    + 5 * coefficient5 * u4;
  const secondDerivativeU = 2 * coefficient2
    + 6 * coefficient3 * u + 12 * coefficient4 * u2
    + 20 * coefficient5 * u3;
  return {
    firstDerivative: firstDerivativeU / width,
    secondDerivative: secondDerivativeU / width ** 2,
    value,
  };
}

function mutilatedRackFrameAlternatingSpurGear(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.92);

  const pinionTeeth = 18;
  const pinionPitchRadius = 0.88;
  const pinionAngularPitch = FULL_TURN / pinionTeeth;
  const circularPitch = pinionPitchRadius * pinionAngularPitch;
  const pinionToothHeight = 0.3;
  const pinionRootRadius = pinionPitchRadius - pinionToothHeight / 2;
  const pinionOuterRadius = pinionPitchRadius + pinionToothHeight / 2;
  const pinionDepth = 0.46;
  const pinionRimInnerRadius = pinionRootRadius - 0.18;
  const pinionHubRadius = 0.18;

  const rackGroupSpecifications = [
    { id: 'upper-left-four', rack: 'upper', sign: 1, toothCount: 4 },
    { id: 'lower-left-four', rack: 'lower', sign: -1, toothCount: 4 },
    { id: 'upper-central-six', rack: 'upper', sign: 1, toothCount: 6 },
    { id: 'lower-right-two', rack: 'lower', sign: -1, toothCount: 2 },
  ];
  const installedRackToothCount = rackGroupSpecifications.reduce(
    (sum, group) => sum + group.toothCount,
    0,
  );
  const contactCoordinateMinimum = -8 * circularPitch;
  const contactCoordinateMaximum = 8 * circularPitch;
  const contactCoordinateAmplitude = (
    contactCoordinateMaximum - contactCoordinateMinimum
  ) / 2;
  const handoffHalfWidth = circularPitch * 0.56;
  const rackToothRootHalfWidth = circularPitch * 0.34;
  const rackToothTipHalfWidth = circularPitch * 0.12;
  const rackRadialClearance = 0.03;
  const rackToothRootY = pinionOuterRadius + rackRadialClearance;
  const rackToothTipY = pinionRootRadius + rackRadialClearance;
  const relievedToothHeightScale = 0.48;
  const rackDepth = 0.38;

  const frameLeft = contactCoordinateMinimum - circularPitch * 0.45;
  const frameRightBridgeClearance = 0.06;
  const frameRightBridgeWidth = 0.24;
  // Brown closes the frame one tooth past the last rack; the gear needs its full tip radius.
  const frameRight = contactCoordinateMaximum + pinionOuterRadius
    + frameRightBridgeClearance + frameRightBridgeWidth;
  const frameOuterHalfHeight = 1.46;
  const frameRailHeight = frameOuterHalfHeight - rackToothRootY;
  const frameRailCenterY = (
    frameOuterHalfHeight + rackToothRootY
  ) / 2;
  const frameDepth = 0.42;
  const driveRodLength = 1.18;
  const driveRodRadius = 0.24;
  const driveCollarRadius = 0.78;
  const driveCollarWidth = 0.34;

  const sourceContactCoordinate = 3 * circularPitch;
  const sourceFrameX = -sourceContactCoordinate;
  const demonstrationPeriod = 8;
  const inputAngularFrequency = FULL_TURN / demonstrationPeriod;
  const sourceMotionAngle = Math.PI - Math.asin(
    sourceContactCoordinate / contactCoordinateAmplitude,
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const driverDarkMaterial = matte(0xb94733, {
    metalness: 0.17,
    roughness: 0.53,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.57,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });
  const handoffMaterial = matte(PALETTE.accent, {
    metalness: 0.12,
    roughness: 0.54,
  });

  const rackGroups = [];
  let groupStart = contactCoordinateMinimum;
  let groupStartTheta = -pinionAngularPitch / 2;
  for (const specification of rackGroupSpecifications) {
    const groupEnd = groupStart
      + specification.toothCount * circularPitch;
    const groupEndTheta = groupStartTheta
      + specification.sign * specification.toothCount
        * pinionAngularPitch;
    rackGroups.push({
      ...specification,
      end: groupEnd,
      endTheta: groupEndTheta,
      start: groupStart,
      startTheta: groupStartTheta,
    });
    groupStart = groupEnd;
    groupStartTheta = groupEndTheta;
  }

  const rawProfileForGroup = (group, contactCoordinate) => ({
    firstDerivative: group.sign / pinionPitchRadius,
    secondDerivative: 0,
    value: group.startTheta + group.sign
      * (contactCoordinate - group.start) / pinionPitchRadius,
  });

  const handoffs = rackGroups.slice(0, -1).map((group, index) => {
    const nextGroup = rackGroups[index + 1];
    const center = group.end;
    const left = center - handoffHalfWidth;
    const right = center + handoffHalfWidth;
    const leftProfile = rawProfileForGroup(group, left);
    const rightProfile = rawProfileForGroup(nextGroup, right);
    return {
      center,
      fromRackWhenIncreasing: group.rack,
      index,
      left,
      leftProfile,
      nextGroup,
      previousGroup: group,
      right,
      rightProfile,
      toRackWhenIncreasing: nextGroup.rack,
      width: right - left,
    };
  });

  const profileAtContactCoordinate = (unclampedContactCoordinate) => {
    const contactCoordinate = THREE.MathUtils.clamp(
      unclampedContactCoordinate,
      contactCoordinateMinimum,
      contactCoordinateMaximum,
    );
    for (const handoff of handoffs) {
      if (
        contactCoordinate >= handoff.left
        && contactCoordinate <= handoff.right
      ) {
        const u = (contactCoordinate - handoff.left) / handoff.width;
        const profile = quinticHermite({
          endSecondDerivative: handoff.rightProfile.secondDerivative,
          endSlope: handoff.rightProfile.firstDerivative,
          endValue: handoff.rightProfile.value,
          startSecondDerivative: handoff.leftProfile.secondDerivative,
          startSlope: handoff.leftProfile.firstDerivative,
          startValue: handoff.leftProfile.value,
          u,
          width: handoff.width,
        });
        return {
          ...profile,
          activeRack: null,
          activeSegment: null,
          contactCoordinate,
          handoff,
          handoffProgress: u,
          mode: 'relieved-tooth-handoff',
        };
      }
    }
    const activeSegment = rackGroups.find((group) => (
      contactCoordinate >= group.start
      && contactCoordinate <= group.end
    )) ?? rackGroups[rackGroups.length - 1];
    return {
      ...rawProfileForGroup(activeSegment, contactCoordinate),
      activeRack: activeSegment.rack,
      activeSegment,
      contactCoordinate,
      handoff: null,
      handoffProgress: null,
      mode: 'full-depth-rack-mesh',
    };
  };

  const rackFrame = new THREE.Group();
  rackFrame.userData.axis = new THREE.Vector3(1, 0, 0);
  rackFrame.userData.role =
    'continued-horizontal-reciprocating-frame-with-four-mutilated-rack-groups';

  const frameRailLength = frameRight - frameLeft;
  const topRail = new THREE.Mesh(
    new THREE.BoxGeometry(
      frameRailLength,
      frameRailHeight,
      frameDepth,
    ),
    driverMaterial,
  );
  topRail.position.set(
    (frameLeft + frameRight) / 2,
    frameRailCenterY,
    0,
  );
  topRail.userData.role = 'upper-member-of-translating-rack-frame';
  const bottomRail = topRail.clone();
  bottomRail.position.y = -frameRailCenterY;
  bottomRail.userData.role = 'lower-member-of-translating-rack-frame';
  const rightBridge = new THREE.Mesh(
    new THREE.BoxGeometry(
      frameRightBridgeWidth,
      frameOuterHalfHeight * 2,
      frameDepth,
    ),
    driverMaterial,
  );
  rightBridge.position.x = frameRight - frameRightBridgeWidth / 2;
  rightBridge.userData.role = 'closed-right-end-of-translating-rack-frame';

  const makeRackToothGeometry = (rack, heightScale) => {
    const side = rack === 'upper' ? 1 : -1;
    const rootY = side * rackToothRootY;
    const tipY = side * (
      rackToothRootY - pinionToothHeight * heightScale
    );
    const tipHalfWidth = rackToothTipHalfWidth
      * (heightScale < 1 ? 0.72 : 1);
    const shape = new THREE.Shape();
    shape.moveTo(-rackToothRootHalfWidth, rootY);
    shape.lineTo(-tipHalfWidth, tipY);
    shape.lineTo(tipHalfWidth, tipY);
    shape.lineTo(rackToothRootHalfWidth, rootY);
    shape.closePath();
    return centeredExtrusion(shape, rackDepth, 0.006);
  };
  const upperRackToothGeometry = makeRackToothGeometry('upper', 1);
  const lowerRackToothGeometry = makeRackToothGeometry('lower', 1);
  const upperRelievedToothGeometry = makeRackToothGeometry(
    'upper',
    relievedToothHeightScale,
  );
  const lowerRelievedToothGeometry = makeRackToothGeometry(
    'lower',
    relievedToothHeightScale,
  );
  const transitionAdjacentIndices = new Set([3, 4, 7, 8, 13, 14]);
  const rackTeeth = [];
  const upperRackTeeth = [];
  const lowerRackTeeth = [];
  let toothIndex = 0;
  for (const group of rackGroups) {
    for (let groupToothIndex = 0;
      groupToothIndex < group.toothCount;
      groupToothIndex += 1) {
      const relieved = transitionAdjacentIndices.has(toothIndex);
      const geometry = group.rack === 'upper'
        ? relieved ? upperRelievedToothGeometry : upperRackToothGeometry
        : relieved ? lowerRelievedToothGeometry : lowerRackToothGeometry;
      const tooth = new THREE.Mesh(
        geometry,
        relieved ? driverDarkMaterial : driverMaterial,
      );
      tooth.position.x = contactCoordinateMinimum
        + (toothIndex + 0.5) * circularPitch;
      tooth.userData.groupId = group.id;
      tooth.userData.groupToothIndex = groupToothIndex;
      tooth.userData.index = toothIndex;
      tooth.userData.pitch = circularPitch;
      tooth.userData.rack = group.rack;
      tooth.userData.relievedForHandoff = relieved;
      tooth.userData.role = relieved
        ? `${group.rack}-rack-relieved-transition-tooth`
        : `${group.rack}-rack-full-depth-working-tooth`;
      rackTeeth.push(tooth);
      if (group.rack === 'upper') upperRackTeeth.push(tooth);
      else lowerRackTeeth.push(tooth);
      toothIndex += 1;
    }
  }

  const driveRod = cylinderAlongX(
    driveRodRadius,
    driveRodLength,
    darkMaterial,
    32,
  );
  driveRod.position.x = frameRight + driveRodLength / 2 - 0.04;
  driveRod.userData.role = 'rectilinear-input-rod-rigid-with-rack-frame';
  const driveCollar = cylinderAlongX(
    driveCollarRadius,
    driveCollarWidth,
    driverMaterial,
    44,
  );
  driveCollar.position.x = frameRight + driveRodLength * 0.54;
  driveCollar.userData.role = 'source-style-collar-on-rectilinear-input-rod';
  const frameTranslationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.06, 0.045),
    whiteMaterial,
  );
  frameTranslationIndex.position.set(
    frameRight - 0.48,
    frameOuterHalfHeight + 0.045,
    frameDepth / 2 + 0.035,
  );
  frameTranslationIndex.userData.role =
    'white-index-showing-frame-translation-without-rotation';
  rackFrame.add(
    topRail,
    bottomRail,
    rightBridge,
    ...rackTeeth,
    driveRod,
    driveCollar,
    frameTranslationIndex,
  );

  const pinion = new THREE.Group();
  const pinionRotor = new THREE.Group();
  pinion.add(pinionRotor);
  pinion.userData.axis = new THREE.Vector3(0, 0, 1);
  pinion.userData.rotor = pinionRotor;
  pinion.userData.role =
    'fixed-axis-complete-eighteen-tooth-alternating-output-spur-gear';

  const rimShape = new THREE.Shape();
  rimShape.absarc(0, 0, pinionRootRadius, 0, FULL_TURN, false);
  const rimHole = new THREE.Path();
  rimHole.absarc(0, 0, pinionRimInnerRadius, 0, FULL_TURN, true);
  rimShape.holes.push(rimHole);
  const pinionRim = new THREE.Mesh(
    centeredExtrusion(rimShape, pinionDepth, 0.009),
    drivenMaterial,
  );
  pinionRim.userData.role = 'annular-root-rim-of-complete-output-pinion';

  const toothRootHalfAngle = pinionAngularPitch * 0.34;
  const toothTipHalfAngle = pinionAngularPitch * 0.14;
  const pointAt = (radius, angle) => new THREE.Vector2(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
  );
  const baseToothShape = new THREE.Shape();
  const baseToothPoints = [
    pointAt(pinionRootRadius - 0.012, -toothRootHalfAngle),
    pointAt(pinionOuterRadius, -toothTipHalfAngle),
    pointAt(pinionOuterRadius, toothTipHalfAngle),
    pointAt(pinionRootRadius - 0.012, toothRootHalfAngle),
  ];
  for (const [index, point] of baseToothPoints.entries()) {
    if (index === 0) baseToothShape.moveTo(point.x, point.y);
    else baseToothShape.lineTo(point.x, point.y);
  }
  baseToothShape.closePath();
  const pinionToothGeometry = centeredExtrusion(
    baseToothShape,
    pinionDepth,
    0.006,
  );
  const pinionToothMeshes = Array.from({ length: pinionTeeth }, (_, index) => {
    const tooth = new THREE.Mesh(pinionToothGeometry, drivenMaterial);
    tooth.rotation.z = index * pinionAngularPitch;
    tooth.userData.centerAngle = index * pinionAngularPitch;
    tooth.userData.index = index;
    tooth.userData.role = 'working-tooth-of-complete-output-spur-gear';
    return tooth;
  });

  const sourcePinionAngle = profileAtContactCoordinate(
    sourceContactCoordinate,
  ).value;
  const spokeLocalPhase = -sourcePinionAngle;
  const spokeLength = pinionRimInnerRadius - pinionHubRadius - 0.04;
  const spokeCenterRadius = (
    pinionRimInnerRadius + pinionHubRadius + 0.04
  ) / 2;
  const pinionSpokes = Array.from({ length: 4 }, (_, index) => {
    const angle = spokeLocalPhase + index * Math.PI / 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(spokeLength, 0.13, pinionDepth * 0.68),
      drivenMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * spokeCenterRadius,
      Math.sin(angle) * spokeCenterRadius,
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.index = index;
    spoke.userData.role = 'source-four-spoke-output-gear-web';
    return spoke;
  });
  const pinionHub = cylinderAlongZ(
    pinionHubRadius,
    pinionDepth * 1.42,
    darkMaterial,
    32,
  );
  pinionHub.userData.role = 'hub-fixed-to-alternating-output-shaft';
  const pinionShaft = cylinderAlongZ(0.105, 0.86, darkMaterial, 30);
  pinionShaft.userData.role = 'alternating-output-shaft-fixed-to-pinion';
  const pinionIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 18, 12),
    whiteMaterial,
  );
  pinionIndex.position.set(
    Math.cos(spokeLocalPhase) * pinionPitchRadius * 0.68,
    Math.sin(spokeLocalPhase) * pinionPitchRadius * 0.68,
    pinionDepth / 2 + 0.055,
  );
  pinionIndex.userData.role = 'white-index-exposing-output-reversals';
  pinionRotor.add(
    pinionRim,
    ...pinionToothMeshes,
    ...pinionSpokes,
    pinionHub,
    pinionShaft,
    pinionIndex,
  );
  pinion.userData.circularPitch = circularPitch;
  pinion.userData.mutilated = false;
  pinion.userData.pitchRadius = pinionPitchRadius;
  pinion.userData.teeth = pinionTeeth;
  pinion.userData.toothProfile =
    'source-style-straight-flank-teeth-on-an-exact-circular-pitch';

  const bearingPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 1.82, 0.22),
    frameMaterial,
  );
  bearingPost.position.set(0, -1.82 / 2, -0.55);
  bearingPost.userData.role = 'fixed-post-behind-moving-frame-holding-pinion';
  const bearingFoot = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.16, 0.32),
    frameMaterial,
  );
  bearingFoot.position.set(0, -1.9, -0.55);
  bearingFoot.userData.role = 'fixed-base-of-output-shaft-bearing';
  const pinionBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.055, 9, 40),
    frameMaterial,
  );
  pinionBearing.position.z = -0.38;
  pinionBearing.userData.role = 'stationary-bearing-around-output-shaft';

  const upperContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 18, 12),
    whiteMaterial,
  );
  upperContactMarker.position.set(
    0,
    pinionPitchRadius,
    pinionDepth / 2 + 0.07,
  );
  upperContactMarker.userData.role = 'upper-rack-active-pitch-contact';
  const lowerContactMarker = upperContactMarker.clone();
  lowerContactMarker.position.y = -pinionPitchRadius;
  lowerContactMarker.userData.role = 'lower-rack-active-pitch-contact';
  const handoffMarker = new THREE.Mesh(
    new THREE.TorusGeometry(0.1, 0.025, 8, 28),
    handoffMaterial,
  );
  handoffMarker.position.z = pinionDepth / 2 + 0.075;
  handoffMarker.userData.role =
    'visible-no-full-depth-contact-marker-during-relieved-tooth-handoff';

  root.add(
    bearingFoot,
    bearingPost,
    pinionBearing,
    rackFrame,
    pinion,
    upperContactMarker,
    lowerContactMarker,
    handoffMarker,
  );

  const stateAtContactCoordinate = (
    contactCoordinate,
    contactCoordinateVelocity = 0,
    contactCoordinateAcceleration = 0,
  ) => {
    const profile = profileAtContactCoordinate(contactCoordinate);
    const frameX = -profile.contactCoordinate;
    const frameVelocityX = -contactCoordinateVelocity;
    const frameAccelerationX = -contactCoordinateAcceleration;
    const pinionAngleUnwrapped = profile.value;
    const pinionAngularSpeed = profile.firstDerivative
      * contactCoordinateVelocity;
    const pinionAngularAcceleration = profile.secondDerivative
      * contactCoordinateVelocity ** 2
      + profile.firstDerivative * contactCoordinateAcceleration;
    const activeContactY = profile.activeRack === 'upper'
      ? pinionPitchRadius
      : profile.activeRack === 'lower'
        ? -pinionPitchRadius
        : null;
    const activeContactPoint = activeContactY === null
      ? null
      : new THREE.Vector3(0, activeContactY, 0);
    const activeContactRadius = activeContactPoint?.clone() ?? null;
    const rackSurfaceVelocity = new THREE.Vector3(
      frameVelocityX,
      0,
      0,
    );
    const pinionSurfaceVelocity = activeContactRadius
      ? new THREE.Vector3().crossVectors(
        new THREE.Vector3(0, 0, pinionAngularSpeed),
        activeContactRadius,
      )
      : null;
    const relativePitchVelocity = pinionSurfaceVelocity
      ? rackSurfaceVelocity.clone().sub(pinionSurfaceVelocity)
      : null;
    const expectedActiveAngle = profile.activeSegment
      ? rawProfileForGroup(
        profile.activeSegment,
        profile.contactCoordinate,
      ).value
      : null;
    const increasing = contactCoordinateVelocity >= 0;
    const handoffFromRack = profile.handoff
      ? increasing
        ? profile.handoff.fromRackWhenIncreasing
        : profile.handoff.toRackWhenIncreasing
      : null;
    const handoffToRack = profile.handoff
      ? increasing
        ? profile.handoff.toRackWhenIncreasing
        : profile.handoff.fromRackWhenIncreasing
      : null;
    let stage = `${profile.activeRack}-rack-full-depth-mesh`;
    if (profile.handoff) {
      stage = `relieved-${handoffFromRack}-to-${handoffToRack}-handoff`;
    }
    return {
      activeContactPoint,
      activeContactRadius,
      activeFullDepthContactCount: profile.activeRack ? 1 : 0,
      activeRack: profile.activeRack,
      activeRackGroupId: profile.activeSegment?.id ?? null,
      contactCoordinate: profile.contactCoordinate,
      contactCoordinateAcceleration,
      contactCoordinateVelocity,
      frameAcceleration: new THREE.Vector3(frameAccelerationX, 0, 0),
      frameAccelerationX,
      frameRotation: 0,
      frameVelocity: rackSurfaceVelocity.clone(),
      frameVelocityX,
      frameX,
      handoffActive: Boolean(profile.handoff),
      handoffFromRack,
      handoffIndex: profile.handoff?.index ?? null,
      handoffProgress: profile.handoffProgress,
      handoffToRack,
      meshPhaseError: expectedActiveAngle === null
        ? null
        : pinionAngleUnwrapped - expectedActiveAngle,
      mode: profile.mode,
      normalVelocityError: relativePitchVelocity
        ? relativePitchVelocity.y
        : null,
      pinionAngle: wrappedAngle(pinionAngleUnwrapped),
      pinionAngleUnwrapped,
      pinionAngularAcceleration,
      pinionAngularSpeed,
      pinionAxialDisplacement: 0,
      pinionSurfaceVelocity,
      profileFirstDerivative: profile.firstDerivative,
      profileSecondDerivative: profile.secondDerivative,
      rackSurfaceVelocity,
      relievedTransitionContactCount: profile.handoff ? 2 : 0,
      relativePitchVelocity,
      simultaneousFullDepthEngagement: false,
      stage,
      tangentialVelocityError: relativePitchVelocity
        ? relativePitchVelocity.x
        : null,
    };
  };

  const stateAtTime = (time) => {
    const motionAngle = sourceMotionAngle + inputAngularFrequency * time;
    const contactCoordinate = contactCoordinateAmplitude
      * Math.sin(motionAngle);
    const contactCoordinateVelocity = contactCoordinateAmplitude
      * inputAngularFrequency * Math.cos(motionAngle);
    const contactCoordinateAcceleration = -contactCoordinateAmplitude
      * inputAngularFrequency ** 2 * Math.sin(motionAngle);
    return {
      ...stateAtContactCoordinate(
        contactCoordinate,
        contactCoordinateVelocity,
        contactCoordinateAcceleration,
      ),
      cyclePhase: modulo(time, demonstrationPeriod) / demonstrationPeriod,
      motionAngle: wrappedAngle(motionAngle),
      motionAngleUnwrapped: motionAngle,
      time,
    };
  };

  const timeForMotionAngle = (targetAngle) => modulo(
    targetAngle - sourceMotionAngle,
    FULL_TURN,
  ) / inputAngularFrequency;
  const timeForContactCoordinate = (
    contactCoordinate,
    velocityDirection = 'decreasing',
  ) => {
    const ratio = THREE.MathUtils.clamp(
      contactCoordinate / contactCoordinateAmplitude,
      -1,
      1,
    );
    const principalAngle = Math.asin(ratio);
    const targetAngle = velocityDirection === 'increasing'
      ? principalAngle
      : Math.PI - principalAngle;
    return timeForMotionAngle(targetAngle);
  };

  root.userData.archetype =
    'reciprocating-mutilated-alternating-upper-lower-rack-frame-driving-fixed-spur-gear';
  root.userData.mechanism =
    'one-continued-rectilinearly-reciprocating-frame-carries-four-staggered-mutilated-rack-groups-upper-four-lower-four-upper-six-lower-two-that-alternately-mesh-with-one-complete-fixed-axis-spur-gear-through-three-relieved-tooth-handoffs';
  root.userData.blocks = {
    bearingFoot,
    bearingPost,
    bottomRail,
    driveCollar,
    driveRod,
    frameTranslationIndex,
    handoffMarker,
    lowerContactMarker,
    lowerRackTeeth,
    pinion,
    pinionBearing,
    pinionHub,
    pinionIndex,
    pinionRim,
    pinionRotor,
    pinionShaft,
    pinionSpokes,
    pinionToothMeshes,
    rackFrame,
    rackTeeth,
    rightBridge,
    topRail,
    upperContactMarker,
    upperRackTeeth,
  };
  root.userData.cameraDistanceScale = 0.92;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.9, -2.05, -0.82),
    new THREE.Vector3(6.95, 1.62, 0.82),
  );
  root.userData.canonicalTimes = {
    cycleClosure: demonstrationPeriod,
    frameAtLeftLimit: timeForMotionAngle(Math.PI / 2),
    frameAtRightLimit: timeForMotionAngle(Math.PI * 1.5),
    sourcePose: 0,
  };
  root.userData.geometry = {
    circularPitch,
    contactCoordinateAmplitude,
    contactCoordinateMaximum,
    contactCoordinateMinimum,
    driveCollarRadius,
    driveCollarWidth,
    driveRodLength,
    driveRodRadius,
    frameDepth,
    frameLeft,
    frameOuterHalfHeight,
    frameRailCenterY,
    frameRailHeight,
    frameRailLength,
    frameRight,
    frameRightBridgeClearance,
    frameRightBridgeWidth,
    handoffHalfWidth,
    installedRackToothCount,
    pinionAngularPitch,
    pinionDepth,
    pinionHubRadius,
    pinionOuterRadius,
    pinionPitchRadius,
    pinionRimInnerRadius,
    pinionRootRadius,
    pinionTeeth,
    pinionToothHeight,
    rackDepth,
    rackRadialClearance,
    rackToothRootHalfWidth,
    rackToothRootY,
    rackToothTipHalfWidth,
    rackToothTipY,
    relievedToothHeightScale,
    sourceContactCoordinate,
    sourceFrameX,
    sourcePinionAngle,
  };
  root.userData.handoffDesign = {
    boundaryAdjacentToothIndices: [...transitionAdjacentIndices],
    fullDepthContactsDuringHandoff: 0,
    handoffCount: handoffs.length,
    handoffHalfWidth,
    interpolation:
      'quintic-Hermite-with-matched-position-slope-and-zero-boundary-curvature',
    purpose:
      'relieved boundary teeth and a zero-full-depth-contact interval prevent upper and lower racks from jamming the pinion simultaneously',
    relievedTransitionTeethPerHandoff: 2,
  };
  root.userData.rackSequence = rackGroups.map((group) => ({
    end: group.end,
    endTheta: group.endTheta,
    id: group.id,
    rack: group.rack,
    sign: group.sign,
    start: group.start,
    startTheta: group.startTheta,
    toothCount: group.toothCount,
  }));
  root.userData.sourceAnimation = {
    available: true,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialNote:
      'the source animation alters several rack teeth to avoid jamming at transition points',
    referenceScope:
      'availability, qualitative traversal, and upper/lower engagement order only; rack pitch, relieved handoffs, analytic derivatives, and output phase were independently derived from the public-domain engraving and description',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate269: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one horizontally translating open-left frame surrounds one complete fixed-axis spur gear and carries four successive inward-facing rack groups: upper four, lower four, upper six, and lower two teeth',
      measurementUncertaintyPixels: 6,
      officialAnimationAvailable: true,
      rasterDriveRodEnd: { x: 511, y: 253 },
      rasterFrameOuterBounds: {
        bottom: 349,
        left: 31,
        right: 390,
        top: 143,
      },
      rasterPinionCenter: { x: 249, y: 250 },
      rasterPinionOuterRadius: 72,
      rasterPinionToothCount: 18,
      rasterRackGroupOrder: [
        'upper-four',
        'lower-four',
        'upper-six',
        'lower-two',
      ],
      rasterRackPitchLines: { lowerY: 310, upperY: 190 },
      rasterRackToothCounts: [4, 4, 6, 2],
      sourceEngagement: 'upper-central-six-tooth-group',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 67,
      edition: 21,
      illustrationPage: 66,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtContactCoordinate = stateAtContactCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod,
    inputAngularFrequency,
    sourceMotionAngle,
  };
  root.userData.transmission = {
    contactCoordinateConvention:
      'q is the fixed pinion center expressed in the translating frame, so frame-x=-q',
    frameStroke: contactCoordinateMaximum - contactCoordinateMinimum,
    handoffs,
    noSlipLaws: {
      lowerRack: 'pinion-angular-speed=frame-x-speed/pitch-radius',
      upperRack: 'pinion-angular-speed=-frame-x-speed/pitch-radius',
    },
    profileAtContactCoordinate,
    signedSlopeSequence: rackGroups.map(
      (group) => group.sign / pinionPitchRadius,
    ),
    timeForContactCoordinate,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    rackFrame.position.set(state.frameX, 0, 0);
    rackFrame.rotation.set(0, 0, 0);
    rackFrame.userData.velocity = state.frameVelocity.clone();
    pinionRotor.rotation.z = state.pinionAngleUnwrapped;
    pinionRotor.userData.angularSpeed = state.pinionAngularSpeed;
    pinionRotor.userData.angularAcceleration = state.pinionAngularAcceleration;
    upperContactMarker.visible = state.activeRack === 'upper';
    lowerContactMarker.visible = state.activeRack === 'lower';
    handoffMarker.visible = state.handoffActive;
    handoffMarker.rotation.z = state.pinionAngleUnwrapped;
    root.userData.contacts = {
      activeRackToPinion: {
        activeRack: state.activeRack,
        fullDepthContactCount: state.activeFullDepthContactCount,
        meshPhaseError: state.meshPhaseError,
        normalVelocityError: state.normalVelocityError,
        point: state.activeContactPoint?.clone() ?? null,
        tangentialVelocityError: state.tangentialVelocityError,
      },
      relievedHandoff: {
        active: state.handoffActive,
        fromRack: state.handoffFromRack,
        fullDepthContactCount: 0,
        relievedTransitionContactCount: state.relievedTransitionContactCount,
        simultaneousFullDepthEngagement:
          state.simultaneousFullDepthEngagement,
        toRack: state.handoffToRack,
      },
      shaftBearing: {
        axialDisplacement: state.pinionAxialDisplacement,
        center: new THREE.Vector3(0, 0, 0),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(0.9, 1.8, 12.8),
  };
}

export function createAuthoredMutilatedRackMovement(movement) {
  if (movement.id !== 269) return null;
  const result = mutilatedRackFrameAlternatingSpurGear(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
