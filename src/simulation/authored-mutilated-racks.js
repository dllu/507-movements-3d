import * as THREE from 'three';
import { circle, plate, poly, polygonClipping } from './finite-plate-geometry.js';
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

// Rack-tooth relief outlines baked offline by computeRackReliefOutlines;
// the signature pins every parameter they depend on.
const BAKED_269_RACK_RELIEF = {
  signature: '[0.307177948351,0.88,18,0.3,-2.457423586808,2.457423586808,0.172019651077,0.48,1.06,0.129014738307,0.002,0.006,0.008]',
  outlines: [
    [[[[-0.0645074,0.8109882],[-0.0640795,0.809712],[-0.0625679,0.8053364],[-0.0609707,0.8008453],[-0.0592856,0.7962404],[-0.0575108,0.7915234],[-0.0556441,0.786696],[-0.0536836,0.7817599],[-0.0516274,0.7767169],[-0.0494735,0.7715687],[-0.0494377,0.7714853],[0.0309735,0.9982513],[0.0382167,0.9961172],[0.0389735,0.9982513],[0.0462167,0.9961172],[0.0469735,0.9982513],[0.0503691,0.9972509],[0.0516909,0.9976203],[0.0512343,0.9997709],[0.0527576,1.0001818],[0.0523345,1.0022675],[0.0538478,1.002661],[0.0534571,1.0046813],[0.0549608,1.0050577],[0.0546012,1.007012],[0.0560958,1.0073718],[0.0557661,1.0092596],[0.0645074,1.0112797],[0.0645074,1.08],[-0.0645074,1.08],[-0.0645074,0.8109882]]]],
    [[[[-0.0645074,0.8109807],[-0.0631785,0.8070885],[-0.0616156,0.802643],[-0.0599656,0.7980832],[-0.0582267,0.7934105],[-0.0563967,0.7886268],[-0.0544738,0.7837336],[-0.0524558,0.7787329],[-0.050341,0.7736263],[-0.0481273,0.7684156],[-0.0458131,0.7631029],[-0.0444278,0.76],[-0.0185448,0.76],[0.0395261,0.8303843],[0.0371999,0.8339763],[0.0383029,0.8347787],[0.0357494,0.8387902],[0.0371017,0.8397579],[0.0346077,0.8437473],[0.0361754,0.8448499],[0.0337429,0.848815],[0.0354894,0.8500215],[0.0331199,0.8539601],[0.0350057,0.8552388],[0.0327002,0.8591489],[0.034683,0.8604679],[0.0324421,0.8643476],[0.0344763,0.8656746],[0.0323003,0.8695221],[0.0343392,0.8708259],[0.0322278,0.8746396],[0.0342493,0.8759067],[0.032202,0.8796853],[0.0342057,0.8809159],[0.0322218,0.8846583],[0.0342076,0.8858531],[0.0322865,0.8895581],[0.0342544,0.890718],[0.0323954,0.8943844],[0.0343455,0.89551],[0.0325478,0.8991368],[0.0344801,0.9002289],[0.0327431,0.9038149],[0.0346577,0.9048742],[0.0329806,0.9084183],[0.0348776,0.9094454],[0.0332596,0.9129467],[0.0351391,0.9139423],[0.0335794,0.9173995],[0.0354416,0.9183644],[0.0339394,0.9217766],[0.0357843,0.9227114],[0.0343388,0.9260775],[0.0361666,0.9269828],[0.0347769,0.9303018],[0.0365879,0.9311784],[0.0352531,0.9344493],[0.0370473,0.9352977],[0.0357667,0.9385195],[0.0375444,0.9393404],[0.0363169,0.9425122],[0.0380783,0.9433062],[0.036903,0.946427],[0.0386483,0.9471948],[0.0375244,0.9502636],[0.0392539,0.9510057],[0.0381803,0.9540216],[0.0398942,0.9547386],[0.03887,0.9577008],[0.0405686,0.9583933],[0.0395928,0.9613008],[0.0412763,0.9619695],[0.0403479,0.9648214],[0.0420168,0.9654667],[0.0411348,0.9682623],[0.0427891,0.9688848],[0.0419525,0.9716231],[0.0435928,0.9722233],[0.0428004,0.9749037],[0.0444269,0.9754821],[0.0436777,0.9781036],[0.0452908,0.9786608],[0.0445838,0.9812228],[0.0461838,0.9817592],[0.0455179,0.9842608],[0.0471052,0.984777],[0.0464792,0.9872175],[0.0480542,0.9877139],[0.0474671,0.9900926],[0.0490301,0.9905697],[0.0484807,0.9928859],[0.0500321,0.993344],[0.0495193,0.9955971],[0.0510596,0.9960368],[0.0505822,0.9982261],[0.0521118,0.9986477],[0.0516686,1.0007725],[0.0531879,1.0011765],[0.0527778,1.0032363],[0.0542872,1.0036229],[0.053909,1.0056171],[0.055409,1.0059869],[0.0550615,1.0079148],[0.0565526,1.008268],[0.0562345,1.0101292],[0.0645074,1.0120097],[0.0645074,1.08],[-0.0645074,1.08],[-0.0645074,1.0116587],[-0.056008,1.0097111],[-0.0563317,1.0078371],[-0.0548389,1.0074807],[-0.0551923,1.00554],[-0.0536905,1.0051671],[-0.0540747,1.0031603],[-0.0525634,1.0027703],[-0.0529798,1.000698],[-0.0514585,1.0002907],[-0.0519082,0.9981535],[-0.0503766,0.9977284],[-0.0508607,0.9955269],[-0.0493183,0.9950837],[-0.049838,0.9928184],[-0.0482844,0.9923567],[-0.0488409,0.9900284],[-0.0472757,0.9895477],[-0.0478701,0.9871571],[-0.0462929,0.9866569],[-0.0469264,0.9842047],[-0.0453367,0.9836846],[-0.0460104,0.9811714],[-0.0444079,0.980631],[-0.0451229,0.9780576],[-0.0435073,0.9774964],[-0.0442646,0.9748635],[-0.0426355,0.9742809],[-0.0434363,0.9715894],[-0.0417933,0.970985],[-0.0426386,0.9682356],[-0.0409815,0.9676088],[-0.0418723,0.9648023],[-0.0402007,0.9641526],[-0.0411381,0.9612899],[-0.0394517,0.9606167],[-0.0404367,0.9576987],[-0.0387352,0.9570015],[-0.0397688,0.954029],[-0.0380519,0.9533072],[-0.0391351,0.950281],[-0.0374025,0.9495341],[-0.0645074,0.875925],[-0.0645074,0.8109807]]]],
    [[[[-0.0645074,1.0109237],[-0.0555412,1.0088351],[-0.0558765,1.0069345],[-0.0543802,1.0065716],[-0.0547457,1.0046046],[-0.0532401,1.0042249],[-0.053637,1.002192],[-0.0521218,1.0017952],[-0.0525512,0.999697],[-0.0510259,0.9992827],[-0.0514891,0.9971199],[-0.0499533,0.9966877],[-0.0504514,0.9944607],[-0.0489046,0.9940102],[-0.0494388,0.9917199],[-0.0478806,0.9912506],[-0.0484521,0.9888975],[-0.0468821,0.9884091],[-0.047492,0.9859939],[-0.0459098,0.9854859],[-0.0465592,0.9830094],[-0.0449644,0.9824813],[-0.0456544,0.9799441],[-0.0440467,0.9793955],[-0.0447784,0.9767984],[-0.0431575,0.9762287],[-0.043932,0.9735724],[-0.0422974,0.9729812],[-0.0431157,0.9702666],[-0.0414672,0.9696534],[-0.0423304,0.9668812],[-0.0406676,0.9662454],[-0.0415768,0.9634165],[-0.0398993,0.9627575],[-0.0408555,0.9598728],[-0.0391631,0.9591901],[-0.0401673,0.9562503],[-0.0384597,0.9555434],[-0.0395129,0.9525495],[-0.0377898,0.9518177],[-0.038893,0.9487706],[-0.0371542,0.9480134],[-0.0383082,0.9449139],[-0.0365535,0.9441307],[-0.0377594,0.9409798],[-0.0359884,0.94017],[-0.0372471,0.9369687],[-0.0354597,0.9361317],[-0.0367721,0.9328808],[-0.0349681,0.9320159],[-0.0363351,0.9287165],[-0.0345142,0.9278231],[-0.0359367,0.9244762],[-0.0340988,0.9235536],[-0.0355776,0.9201602],[-0.0337225,0.9192078],[-0.0352585,0.915769],[-0.0333861,0.9147861],[-0.0349801,0.9113028],[-0.0330903,0.9102887],[-0.034743,0.906762],[-0.0328357,0.9057161],[-0.034548,0.9021472],[-0.032623,0.9010687],[-0.0343956,0.8974585],[-0.0324528,0.8963468],[-0.0342865,0.8926965],[-0.032326,0.8915508],[-0.0342214,0.8878615],[-0.032243,0.8866811],[-0.0325546,0.8860881],[-0.0278673,0.8889705],[-0.0254771,0.8855183],[-0.0163566,0.8910775],[-0.0139959,0.8876391],[-0.0043298,0.8934712],[-0.0020029,0.8900489],[0.0081988,0.8961339],[0.0104881,0.8927301],[0.0212129,0.8990462],[0.0234607,0.8956634],[0.0346934,0.9021869],[0.0368964,0.8988274],[0.0486191,0.9055331],[0.0507741,0.9021992],[0.062966,0.9090605],[0.0645074,0.906639],[0.0645074,0.9423259],[0.0610755,0.9578334],[0.0525306,0.9950611],[0.0528186,0.9951439],[0.0523316,0.9973448],[0.0529283,0.9975112],[0.0524717,0.9996572],[0.0533358,0.9998907],[0.0529099,1.0019789],[0.053997,1.0022628],[0.0536017,1.0042906],[0.0548646,1.0046088],[0.0544995,1.0065739],[0.0558881,1.0069106],[0.0555526,1.0088111],[0.0645074,1.010898],[0.0645074,1.08],[-0.0645074,1.08],[-0.0645074,1.0109237]]]],
    [[[[-0.0645074,1.0149615],[-0.0578084,1.0164118],[-0.0573602,1.0147765],[-0.0495435,1.0164667],[-0.0490962,1.0148327],[-0.0406353,1.0166543],[-0.0401913,1.0150265],[-0.0310874,1.0169721],[-0.030649,1.0153554],[-0.0209059,1.0174157],[-0.0204755,1.0158151],[-0.0100994,1.0179793],[-0.0096793,1.0163994],[0.0013206,1.0186553],[0.0017283,1.0171008],[0.0133402,1.0194345],[0.0137337,1.0179101],[0.0259429,1.0203066],[0.0263202,1.0188168],[0.0391091,1.0212598],[0.0394688,1.0198089],[0.0528169,1.0222816],[0.0531575,1.0208738],[0.0645074,1.022905],[0.0645074,1.08],[-0.0645074,1.08],[-0.0645074,1.0149615]]]],
    [[[[-0.0645074,-1.08],[0.0645074,-1.08],[0.0645074,-1.0163829],[0.0641199,-1.0164667],[0.063673,-1.0148339],[0.0563848,-1.0164118],[0.0559366,-1.0147764],[0.0480053,-1.0164904],[0.0475584,-1.0148572],[0.0389829,-1.0167014],[0.0385397,-1.0150753],[0.0293217,-1.0170419],[0.0288846,-1.0154278],[0.0190283,-1.0175074],[0.0185996,-1.0159101],[0.0081118,-1.0180916],[0.0076937,-1.0165159],[-0.0034161,-1.0187867],[-0.0038214,-1.0172372],[-0.0155407,-1.0195832],[-0.0159314,-1.0180647],[-0.0282452,-1.0204706],[-0.0286195,-1.0189874],[-0.0415095,-1.021437],[-0.0418659,-1.0199935],[-0.055311,-1.0224696],[-0.0556482,-1.0210699],[-0.0645074,-1.022645],[-0.0645074,-1.08]]]],
    [[[[-0.0645074,-1.08],[0.0645074,-1.08],[0.0645074,-1.0112542],[0.0557499,-1.0092292],[0.05608,-1.0073404],[0.0545853,-1.0069805],[0.0549453,-1.0050252],[0.0534414,-1.0046486],[0.0538326,-1.0026274],[0.0523192,-1.0022336],[0.0527427,-1.000147],[0.0512193,-0.9997359],[0.0516764,-0.9975845],[0.0501424,-0.9971555],[0.0506343,-0.9949399],[0.0490894,-0.9944927],[0.0496171,-0.9922136],[0.048061,-0.9917477],[0.0486258,-0.9894057],[0.0470579,-0.9889208],[0.0476608,-0.9865166],[0.0460809,-0.9860121],[0.0467231,-0.9835464],[0.0451306,-0.9830219],[0.0458133,-0.9804954],[0.044208,-0.9799505],[0.0449322,-0.977364],[0.0433136,-0.9767981],[0.0440804,-0.9741523],[0.0424483,-0.973565],[0.0432587,-0.9708607],[0.0416127,-0.9702514],[0.0424679,-0.9674895],[0.0408076,-0.9668577],[0.0417085,-0.9640388],[0.0400337,-0.963384],[0.0409814,-0.9605091],[0.0392917,-0.9598307],[0.0402873,-0.9569007],[0.0385825,-0.9561981],[0.0396268,-0.9532137],[0.0379066,-0.9524865],[0.0390007,-0.9494487],[0.0372648,-0.9486961],[0.0384097,-0.9456059],[0.0366578,-0.9448274],[0.0378544,-0.9416855],[0.0360863,-0.9408805],[0.0373356,-0.9376881],[0.0355511,-0.9368559],[0.0368539,-0.9336138],[0.0350528,-0.9327539],[0.03641,-0.9294631],[0.0345922,-0.9285748],[0.0360047,-0.9252363],[0.0341699,-0.924319],[0.0356386,-0.9209338],[0.0337866,-0.9199867],[0.0353123,-0.9165559],[0.0334431,-0.9155785],[0.0350266,-0.912103],[0.0331399,-0.9110945],[0.0347822,-0.9075755],[0.0328779,-0.9065353],[0.0345796,-0.9029738],[0.0326577,-0.9019011],[0.0344195,-0.8982982],[0.03248,-0.8971924],[0.0343027,-0.8935492],[0.0323453,-0.8924096],[0.0342298,-0.8887272],[0.0322545,-0.887553],[0.0339179,-0.8843742],[0.0258573,-0.8893237],[0.0234721,-0.8858738],[0.0142538,-0.891483],[0.0118989,-0.8880472],[0.0021366,-0.8939259],[-0.0001839,-0.8905067],[-0.0104797,-0.8966345],[-0.0127618,-0.8932343],[-0.0235782,-0.899589],[-0.0258183,-0.8962102],[-0.0371396,-0.902768],[-0.0393342,-0.8994129],[-0.051142,-0.9061482],[-0.0532882,-0.9028192],[-0.0645074,-0.9091141],[-0.0645074,-0.9423268],[-0.0594944,-0.9648278],[-0.0526045,-0.9946593],[-0.0528335,-0.9947254],[-0.052341,-0.9969357],[-0.0528858,-0.9970885],[-0.0524237,-0.9992445],[-0.0532434,-0.9994672],[-0.052812,-1.0015659],[-0.0538628,-1.0018421],[-0.0534621,-1.0038808],[-0.0546974,-1.004194],[-0.0543269,-1.0061705],[-0.0556969,-1.006505],[-0.0553562,-1.0084171],[-0.0645074,-1.0105653],[-0.0645074,-1.08]]]],
    [[[[-0.0645074,-1.08],[0.0645074,-1.08],[0.0645074,-1.0119845],[0.0562237,-1.0101006],[0.0565421,-1.0082389],[0.0551044,-1.0078982],[0.0554519,-1.005971],[0.0541087,-1.00564],[0.0544862,-1.0036489],[0.0532896,-1.0033428],[0.0536975,-1.0012899],[0.0526965,-1.0010247],[0.053135,-0.9989124],[0.0523756,-0.9987045],[0.0528448,-0.9965356],[0.0523701,-0.9964015],[0.0528695,-0.994179],[0.0527197,-0.9941355],[0.0573128,-0.9744071],[0.0645074,-0.9423918],[0.0645074,-0.9080583],[0.056601,-0.9036398],[0.0544665,-0.9069624],[0.0425483,-0.9001895],[0.0403647,-0.9035387],[0.0289282,-0.8969372],[0.0266984,-0.9003107],[0.0157629,-0.8939064],[0.0134902,-0.8973019],[0.0030718,-0.8911191],[0.0007599,-0.8945341],[-0.0091277,-0.8885955],[-0.011475,-0.8920276],[-0.0208208,-0.886354],[-0.0231994,-0.8898008],[-0.0319949,-0.8844108],[-0.0334276,-0.8864711],[-0.0322718,-0.8886915],[-0.0342428,-0.8898576],[-0.0323728,-0.893531],[-0.0343261,-0.8946627],[-0.0325176,-0.8982966],[-0.034453,-0.8993946],[-0.0327053,-0.9029879],[-0.034623,-0.9040529],[-0.0329353,-0.9076046],[-0.0348354,-0.9086374],[-0.0332069,-0.9121464],[-0.0350896,-0.9131475],[-0.0335195,-0.9166127],[-0.0353848,-0.917583],[-0.0338724,-0.9210033],[-0.0357204,-0.9219433],[-0.0342648,-0.9253177],[-0.0360957,-0.9262283],[-0.0346961,-0.9295557],[-0.0365101,-0.9304373],[-0.0351656,-0.9337169],[-0.0369628,-0.9345703],[-0.0356726,-0.9378009],[-0.0374532,-0.9386267],[-0.0362163,-0.9418074],[-0.0379806,-0.9426062],[-0.0367961,-0.9457361],[-0.0385443,-0.9465085],[-0.0374113,-0.9495866],[-0.0391436,-0.9503332],[-0.0380611,-0.9533586],[-0.0397777,-0.9540801],[-0.0387448,-0.9570519],[-0.0404461,-0.9577487],[-0.0394618,-0.960666],[-0.041148,-0.9613389],[-0.0402112,-0.9642008],[-0.0418827,-0.9648502],[-0.0409925,-0.9676558],[-0.0426494,-0.9682823],[-0.0418047,-0.9710309],[-0.0434475,-0.9716351],[-0.0426473,-0.9743258],[-0.0442763,-0.9749081],[-0.0435195,-0.9775401],[-0.0451349,-0.9781011],[-0.0444205,-0.9806736],[-0.0460228,-0.9812138],[-0.0453497,-0.9837261],[-0.0469392,-0.9842459],[-0.0463062,-0.9866973],[-0.0478833,-0.9871972],[-0.0472894,-0.989587],[-0.0488545,-0.9900674],[-0.0482985,-0.9923948],[-0.0498519,-0.9928563],[-0.0493327,-0.9951207],[-0.050875,-0.9955636],[-0.0503913,-0.9977643],[-0.0519228,-0.9981891],[-0.0514736,-1.0003254],[-0.0529947,-1.0007325],[-0.0525788,-1.0028039],[-0.05409,-1.0031936],[-0.0537061,-1.0051995],[-0.0552078,-1.0055723],[-0.0548549,-1.007512],[-0.0563475,-1.0078682],[-0.0560243,-1.0097413],[-0.0645074,-1.011684],[-0.0645074,-1.08]]]],
    [[[[-0.0645074,-1.08],[0.0645074,-1.08],[0.0645074,-1.0223115],[0.0589349,-1.0213294],[0.0586024,-1.0227183],[0.0450312,-1.0202386],[0.0446792,-1.0216723],[0.0316578,-1.0192149],[0.0312875,-1.0206893],[0.0188377,-1.0182716],[0.0184507,-1.0197824],[0.0065914,-1.017421],[0.0061893,-1.0189636],[-0.0050638,-1.016674],[-0.005479,-1.018244],[-0.0161128,-1.0160405],[-0.0165392,-1.0176333],[-0.0265434,-1.0155288],[-0.0269788,-1.0171395],[-0.036346,-1.0151456],[-0.036788,-1.0167693],[-0.0455135,-1.0148958],[-0.0459597,-1.0165278],[-0.0540412,-1.0147828],[-0.0544893,-1.0164182],[-0.0619271,-1.0148081],[-0.0623746,-1.016442],[-0.0645074,-1.0159806],[-0.0645074,-1.08]]]],
    [[[[-0.0645074,1.0218183],[-0.0640063,1.0217312],[-0.063681,1.0231032],[-0.04992,1.0206198],[-0.0495748,1.022038],[-0.0363551,1.0195707],[-0.0359911,1.021031],[-0.0233356,1.0185973],[-0.0229544,1.0200956],[-0.0108829,1.0177124],[-0.010486,1.0192442],[0.0009845,1.0169273],[0.0013953,1.0184881],[0.0122508,1.0162524],[0.0126735,1.0178376],[0.0229027,1.0156965],[0.0233352,1.0173014],[0.0329298,1.0152669],[0.0333697,1.0168865],[0.042324,1.0149691],[0.042769,1.0165988],[0.0510797,1.0148072],[0.0515274,1.016442],[0.0591942,1.0147833],[0.0596421,1.0164182],[0.0645074,1.015365],[0.0645074,1.08],[-0.0645074,1.08],[-0.0645074,1.0218183]]]],
    [[[[-0.0645074,0.906469],[-0.061702,0.904911],[-0.0595858,0.9082235],[-0.0475012,0.901396],[-0.0453348,0.904736],[-0.0337245,0.8980705],[-0.0315108,0.9014356],[-0.020395,0.8949583],[-0.0181372,0.8983462],[-0.007533,0.8920819],[-0.0052347,0.8954902],[0.0048432,0.8894623],[0.0071784,0.8928885],[0.0167182,0.8871183],[0.0190861,0.8905602],[0.0280783,0.8850672],[0.0304747,0.8885223],[0.0337974,0.8864752],[0.0342127,0.8867241],[0.0323027,0.8904223],[0.0342674,0.8915761],[0.0324194,0.8952355],[0.0343663,0.8963551],[0.0325795,0.8999747],[0.0345086,0.9010609],[0.0327823,0.9046396],[0.0346938,0.905693],[0.0330272,0.9092296],[0.0349211,0.9102511],[0.0333135,0.9137446],[0.03519,0.9147347],[0.0336405,0.918184],[0.0354996,0.9191434],[0.0340076,0.9225475],[0.0358494,0.923477],[0.0344139,0.9268348],[0.0362387,0.927735],[0.0348589,0.9310455],[0.0366668,0.931917],[0.0353418,0.9351793],[0.0371331,0.9360227],[0.0358619,0.9392357],[0.0376367,0.9400518],[0.0364185,0.9432146],[0.0381771,0.9440039],[0.037011,0.9471154],[0.0387535,0.9478786],[0.0376386,0.9509381],[0.0393653,0.9516757],[0.0383006,0.9546821],[0.0400117,0.9553947],[0.0389962,0.9583472],[0.0406921,0.9590355],[0.0397248,0.9619331],[0.0414057,0.9625976],[0.0404857,0.9654396],[0.0421519,0.9660807],[0.041278,0.9688662],[0.0429299,0.9694847],[0.0421012,0.9722128],[0.043739,0.9728091],[0.0429544,0.975479],[0.0445785,0.9760536],[0.0438369,0.9786646],[0.0454476,0.9792181],[0.044748,0.9817693],[0.0463457,0.9823021],[0.045687,0.9847929],[0.0472721,0.9853055],[0.0466531,0.9877351],[0.0482259,0.988228],[0.0476456,0.9905957],[0.0492065,0.9910693],[0.0486637,0.9933744],[0.0502131,0.9938292],[0.0497067,0.996071],[0.0512451,0.9965074],[0.0507738,0.9986852],[0.0523016,0.9991037],[0.0518644,1.001217],[0.0533819,1.0016179],[0.0529775,1.003666],[0.0544852,1.0040496],[0.0541126,1.0060321],[0.055611,1.0063989],[0.0552688,1.008315],[0.0645074,1.0104877],[0.0645074,1.08],[-0.0645074,1.08],[-0.0645074,1.0113307],[-0.0558146,1.0093242],[-0.0561433,1.007439],[-0.0547331,1.0071001],[-0.0550912,1.0051499],[-0.0537943,1.004826],[-0.0541826,1.0028126],[-0.0530501,1.0025193],[-0.0534689,1.0004449],[-0.0525488,1.0001982],[-0.0529982,0.9980655],[-0.0523354,0.9978819],[-0.0528153,0.9956936],[-0.0524518,0.9955898],[-0.0529619,0.993349],[-0.0529369,0.9933417],[-0.0537265,0.9899903],[-0.0630405,0.9490752],[-0.0645074,0.9423877],[-0.0645074,0.906469]]]],
    [[[[-0.0645074,1.0105911],[-0.0553331,1.0084384],[-0.0556737,1.006526],[-0.0541758,1.0061601],[-0.0545467,1.0041813],[-0.0530395,1.0037986],[-0.0534421,1.0017541],[-0.0519251,1.0013542],[-0.0523605,0.9992444],[-0.0508333,0.998827],[-0.0513027,0.9966527],[-0.0497649,0.9962172],[-0.0502694,0.993979],[-0.0487205,0.9935252],[-0.0492613,0.9912236],[-0.0477011,0.990751],[-0.0482793,0.9883868],[-0.0467071,0.9878949],[-0.047324,0.9854688],[-0.0457396,0.9849572],[-0.0463961,0.9824698],[-0.0447991,0.9819381],[-0.0454964,0.9793902],[-0.0438864,0.9788379],[-0.0446256,0.9762302],[-0.0430023,0.9756567],[-0.0437845,0.97299],[-0.0421474,0.9723949],[-0.0429737,0.96967],[-0.0413226,0.9690528],[-0.042194,0.9662705],[-0.0405285,0.9656306],[-0.041446,0.9627917],[-0.0397659,0.9621285],[-0.0407306,0.9592339],[-0.0390355,0.958547],[-0.0400484,0.9555975],[-0.038338,0.9548862],[-0.0394,0.9518827],[-0.0376742,0.9511465],[-0.0387863,0.9480899],[-0.0370447,0.9473282],[-0.0382079,0.9442195],[-0.0364503,0.9434316],[-0.0376655,0.9402717],[-0.0358916,0.9394571],[-0.0371598,0.9362468],[-0.0353695,0.9354049],[-0.0366916,0.9321453],[-0.0348845,0.9312754],[-0.0362613,0.9279675],[-0.0344374,0.9270689],[-0.0358699,0.9237137],[-0.0340289,0.9227859],[-0.0355179,0.9193843],[-0.0336597,0.9184265],[-0.035206,0.9149797],[-0.0333305,0.9139913],[-0.0349349,0.9105002],[-0.0330419,0.9094805],[-0.0347052,0.9059462],[-0.0327947,0.9048946],[-0.0345177,0.9013182],[-0.0325895,0.9002338],[-0.034373,0.8966165],[-0.0324271,0.8954987],[-0.0342717,0.8918414],[-0.032308,0.8906896],[-0.0342145,0.8869935],[-0.0322329,0.8858068],[-0.0342021,0.8820731],[-0.0322026,0.8808509],[-0.0342351,0.8770806],[-0.0322177,0.8758221],[-0.0343141,0.8720165],[-0.0322788,0.8707211],[-0.0344397,0.8668813],[-0.0324004,0.8655571],[-0.0346262,0.8616847],[-0.0326272,0.860361],[-0.0349177,0.8564578],[-0.0330054,0.8551668],[-0.0353601,0.8512347],[-0.0335774,0.8500085],[-0.0359954,0.8460494],[-0.0343826,0.8449198],[-0.0368624,0.8409359],[-0.0354568,0.839934],[-0.0379966,0.8359274],[-0.0368326,0.8350838],[-0.0394303,0.8310568],[-0.0385398,0.830401],[-0.0411928,0.8263558],[-0.040605,0.8259165],[-0.0433103,0.8218551],[-0.0430523,0.8216595],[-0.059618,0.7971499],[-0.0592379,0.7961119],[-0.0574606,0.7913918],[-0.0555913,0.7865614],[-0.0536282,0.7816223],[-0.0515694,0.7765764],[-0.0494128,0.7714254],[-0.0471566,0.7661711],[-0.0447991,0.7608155],[-0.0444312,0.76],[0.0444304,0.76],[0.0446221,0.7604317],[0.0426692,0.7628358],[0.0450149,0.7649624],[0.041633,0.7692038],[0.0439642,0.771279],[0.0406545,0.7755083],[0.0429709,0.7775328],[0.039733,0.7817487],[0.0420342,0.7837233],[0.0388679,0.7879244],[0.0411536,0.78985],[0.0380587,0.7940351],[0.0403286,0.7959124],[0.0373047,0.8000801],[0.0395586,0.8019099],[0.0366054,0.8060591],[0.038843,0.8078421],[0.0359601,0.8119714],[0.0381812,0.8137085],[0.0353683,0.8178166],[0.0375726,0.8195085],[0.0348293,0.8235942],[0.0370167,0.8252417],[0.0343425,0.8293037],[0.0365128,0.8309077],[0.0339074,0.8349447],[0.0360603,0.8365058],[0.0335231,0.8405167],[0.0356587,0.8420358],[0.0331893,0.8460193],[0.0353073,0.847497],[0.0329051,0.8514519],[0.0350055,0.8528891],[0.03267,0.8568141],[0.0347527,0.8582116],[0.0324833,0.8621056],[0.0345482,0.8634641],[0.0323444,0.8673258],[0.0343915,0.868646],[0.0322527,0.8724743],[0.0342818,0.873757],[0.0322074,0.8775507],[0.0342186,0.8787967],[0.0322079,0.8825546],[0.0342013,0.8837646],[0.0322536,0.8874856],[0.0342291,0.8886602],[0.0323438,0.8923432],[0.0343014,0.8934833],[0.0324778,0.897127],[0.0344176,0.8982333],[0.032655,0.9018367],[0.0345771,0.9029098],[0.0328746,0.9064719],[0.0347791,0.9075126],[0.0331361,0.9110322],[0.035023,0.9120411],[0.0334386,0.9155172],[0.0353081,0.916495],[0.0337816,0.9199265],[0.0356338,0.9208739],[0.0341643,0.9242598],[0.0359994,0.9251775],[0.0345861,0.9285167],[0.0364042,0.9294054],[0.0350462,0.9326968],[0.0368475,0.9335571],[0.035544,0.9367999],[0.0373287,0.9376324],[0.0360787,0.9408256],[0.037847,0.941631],[0.0366497,0.9447735],[0.0384018,0.9455523],[0.0372562,0.9486433],[0.0389923,0.9493963],[0.0378975,0.9524348],[0.039618,0.9531624],[0.0385729,0.9561475],[0.040278,0.9568504],[0.0392817,0.9597812],[0.0409717,0.9604599],[0.0400232,0.9633356],[0.0416983,0.9639907],[0.0407967,0.9668103],[0.0424572,0.9674424],[0.0416014,0.9702052],[0.0432476,0.9708148],[0.0424365,0.9735199],[0.0440689,0.9741075],[0.0433015,0.9767541],[0.0449202,0.9773203],[0.0441955,0.9799076],[0.045801,0.9804528],[0.0451177,0.9829801],[0.0467104,0.9835049],[0.0460676,0.9859714],[0.0476477,0.9864762],[0.0470442,0.9888812],[0.0486123,0.9893664],[0.048047,0.9917093],[0.0496033,0.9921754],[0.0490751,0.9944554],[0.0506201,0.9949029],[0.0501278,0.9971193],[0.0516619,0.9975486],[0.0512043,0.9997009],[0.0527279,1.0001123],[0.0523039,1.0021998],[0.0538175,1.0025937],[0.0534258,1.0046158],[0.0549298,1.0049927],[0.0545694,1.0069489],[0.0560642,1.0073091],[0.0557337,1.0091987],[0.0645074,1.0112287],[0.0645074,1.08],[-0.0645074,1.08],[-0.0645074,1.0105911]]]],
    [[[[-0.0645074,1.0117093],[-0.0560406,1.0097714],[-0.0563634,1.0078992],[-0.0548709,1.0075433],[-0.0552234,1.0056045],[-0.0537218,1.0052319],[-0.0541052,1.003227],[-0.0525942,1.0028375],[-0.0530096,1.000767],[-0.0514887,1.0003602],[-0.0519374,0.9982247],[-0.0504061,0.9978001],[-0.0508892,0.9956004],[-0.0493471,0.9951577],[-0.0498659,0.9928942],[-0.0483125,0.992433],[-0.0488681,0.9901064],[-0.0473031,0.9896262],[-0.0478965,0.9872373],[-0.0463196,0.9867377],[-0.046952,0.9842871],[-0.0453627,0.9837676],[-0.0460353,0.9812561],[-0.0444332,0.9807163],[-0.045147,0.9781445],[-0.0435317,0.9775838],[-0.0442879,0.9749526],[-0.0426591,0.9743706],[-0.0434587,0.9716807],[-0.0418161,0.9710769],[-0.0426602,0.9683291],[-0.0410034,0.9677029],[-0.041893,0.964898],[-0.0402218,0.9642489],[-0.0411579,0.9613878],[-0.0394719,0.9607153],[-0.0404556,0.9577987],[-0.0387545,0.9571022],[-0.0397867,0.9541312],[-0.0380703,0.9534101],[-0.0391521,0.9503854],[-0.03742,0.9496391],[-0.0385523,0.9465617],[-0.0368043,0.9457897],[-0.0379881,0.9426605],[-0.036224,0.9418621],[-0.0374602,0.938682],[-0.0356798,0.9378567],[-0.0369693,0.9346267],[-0.0351723,0.9337737],[-0.0365161,0.9304948],[-0.0347023,0.9296136],[-0.0361012,0.9262868],[-0.0342705,0.9253767],[-0.0357253,0.9220029],[-0.0338775,0.9210633],[-0.0353891,0.9176436],[-0.0335241,0.9166737],[-0.0350934,0.9132092],[-0.033211,0.9122084],[-0.0348387,0.9087001],[-0.0329388,0.9076678],[-0.0346257,0.9041166],[-0.0327082,0.9030521],[-0.0344551,0.8994593],[-0.0325199,0.8983617],[-0.0343275,0.8947284],[-0.0323745,0.8935972],[-0.0342437,0.8899243],[-0.0322729,0.8887587],[-0.0342042,0.8850476],[-0.0322155,0.8838469],[-0.0342097,0.8800985],[-0.0322031,0.8788619],[-0.0342609,0.8750775],[-0.0322364,0.8738044],[-0.0343584,0.869985],[-0.032316,0.8686746],[-0.0345028,0.8648215],[-0.0324425,0.8634731],[-0.0346947,0.8595874],[-0.0326167,0.8582002],[-0.0349349,0.8542831],[-0.0328391,0.8528563],[-0.0352239,0.8489091],[-0.0331104,0.847442],[-0.0355623,0.8434659],[-0.0334313,0.8419576],[-0.0359508,0.8379538],[-0.0338023,0.8364037],[-0.0363899,0.8323733],[-0.0342242,0.8307806],[-0.0368804,0.826725],[-0.0346974,0.8250889],[-0.0374227,0.8210093],[-0.0352228,0.819329],[-0.0380175,0.8152266],[-0.0358007,0.8135014],[-0.0386653,0.8093775],[-0.036432,0.8076065],[-0.0393669,0.8034624],[-0.0371172,0.8016449],[-0.0401226,0.7974819],[-0.0378569,0.795617],[-0.0409332,0.7914364],[-0.0386516,0.7895234],[-0.0417993,0.7853264],[-0.0395021,0.7833646],[-0.0427213,0.7791525],[-0.0404088,0.777141],[-0.0436998,0.7729151],[-0.0413725,0.7708532],[-0.0447355,0.7666148],[-0.0423935,0.7645016],[-0.0449989,0.7612787],[-0.0444277,0.76],[0.0444278,0.76],[0.0454234,0.7622211],[0.0477544,0.7675504],[0.0499844,0.7727779],[0.0521153,0.7779018],[0.054149,0.78292],[0.0560875,0.787831],[0.0579326,0.7926328],[0.0596339,0.7971834],[0.0437556,0.8205909],[0.0439236,0.8207187],[0.0412052,0.8247838],[0.0417095,0.8251622],[0.0390426,0.8292119],[0.0398569,0.8298139],[0.0372445,0.8338459],[0.0383402,0.8346433],[0.0357851,0.8386555],[0.0371309,0.839619],[0.0346353,0.8436091],[0.0361975,0.8447084],[0.0337633,0.8486741],[0.0355054,0.8498782],[0.0331342,0.8538175],[0.0350167,0.8550947],[0.0327094,0.8590056],[0.0346901,0.8603239],[0.0324475,0.8642045],[0.0344809,0.8655317],[0.0323031,0.8693801],[0.0343423,0.8706849],[0.0322291,0.8744995],[0.0342512,0.8757676],[0.0322021,0.8795472],[0.0342063,0.8807788],[0.0322207,0.8845222],[0.0342069,0.885718],[0.0322841,0.889424],[0.0342525,0.8905849],[0.0323918,0.8942524],[0.0343424,0.8953789],[0.0325431,0.8990068],[0.0344758,0.9000998],[0.0327372,0.903687],[0.0346523,0.9047471],[0.0329735,0.9082924],[0.034871,0.9093204],[0.0332514,0.9128229],[0.0351314,0.9138193],[0.0335701,0.9172778],[0.0354327,0.9182435],[0.0339289,0.921657],[0.0357743,0.9225926],[0.0343272,0.92596],[0.0361555,0.9268661],[0.0347643,0.9301864],[0.0365757,0.9310637],[0.0352395,0.934336],[0.0370342,0.9351852],[0.035752,0.9384084],[0.0375302,0.93923],[0.0363012,0.9424032],[0.0380631,0.943198],[0.0368864,0.9463201],[0.0386321,0.9470886],[0.0375068,0.9501589],[0.0392367,0.9509017],[0.0381617,0.9539191],[0.0398761,0.9546368],[0.0388505,0.9576004],[0.0405495,0.9582937],[0.0395724,0.9612027],[0.0412564,0.961872],[0.0403267,0.9647255],[0.0419959,0.9653714],[0.0411126,0.9681685],[0.0427674,0.9687916],[0.0419295,0.9715316],[0.0435702,0.9721324],[0.0427766,0.9748143],[0.0444035,0.9753934],[0.0436532,0.9780165],[0.0452666,0.9785743],[0.0445585,0.9811379],[0.0461588,0.9816749],[0.0454918,0.9841782],[0.0470794,0.9846949],[0.0464524,0.9871371],[0.0480277,0.987634],[0.0474395,0.9900145],[0.0490028,0.990492],[0.0484524,0.99281],[0.0500042,0.9932687],[0.0494903,0.9955235],[0.051031,0.9959637],[0.0505526,0.9981547],[0.0520825,0.9985768],[0.0516384,1.0007034],[0.0531579,1.0011079],[0.0527469,1.0031695],[0.0542566,1.0035566],[0.0538776,1.0055526],[0.0553778,1.0059228],[0.0550295,1.0078526],[0.0565208,1.0082063],[0.0562019,1.0100693],[0.0645074,1.0119594],[0.0645074,1.08],[-0.0645074,1.08],[-0.0645074,1.0117093]]]],
    [[[[-0.0645074,1.010975],[-0.0555735,1.0088963],[-0.055908,1.0069976],[-0.0544119,1.0066351],[-0.0547765,1.0046699],[-0.0532713,1.0042907],[-0.0536673,1.0022596],[-0.0521523,1.0018633],[-0.0525809,0.9997669],[-0.0510558,0.9993531],[-0.0515181,0.997192],[-0.0499825,0.9967603],[-0.0504797,0.9945351],[-0.0489332,0.9940851],[-0.0494664,0.9917965],[-0.0479085,0.9913278],[-0.0484789,0.9889764],[-0.0469093,0.9884886],[-0.0475181,0.9860751],[-0.0459362,0.9855676],[-0.0465845,0.9830927],[-0.0449901,0.9825652],[-0.045679,0.9800297],[-0.0440717,0.9794816],[-0.0448022,0.9768861],[-0.0431816,0.9763171],[-0.0439549,0.9736624],[-0.0423207,0.9730718],[-0.0431378,0.9703588],[-0.0414896,0.9697462],[-0.0423516,0.9669756],[-0.0406892,0.9663404],[-0.0415971,0.9635131],[-0.03992,0.9628547],[-0.0408749,0.9599715],[-0.039183,0.9592895],[-0.0401858,0.9563512],[-0.0384787,0.955645],[-0.0395305,0.9526525],[-0.0378078,0.9519215],[-0.0389096,0.9488758],[-0.0371712,0.9481193],[-0.0383239,0.9450212],[-0.0365695,0.9442388],[-0.037774,0.9410893],[-0.0360035,0.9402803],[-0.0372607,0.9370803],[-0.0354738,0.936244],[-0.0367847,0.9329945],[-0.0349811,0.9321304],[-0.0363466,0.9288323],[-0.0345262,0.9279397],[-0.0359471,0.9245941],[-0.0341097,0.9236723],[-0.035587,0.9202802],[-0.0337324,0.9193286],[-0.0352668,0.915891],[-0.0333949,0.914909],[-0.0349872,0.9114269],[-0.0330979,0.9104137],[-0.034749,0.9068882],[-0.0328421,0.9058432],[-0.0345528,0.9022754],[-0.0326282,0.9011978],[-0.0343992,0.8975887],[-0.0324569,0.8964779],[-0.0342889,0.8928287],[-0.0323289,0.8916839],[-0.0342226,0.8879957],[-0.0322447,0.8868163],[-0.032767,0.8858214],[-0.0275571,0.8890246],[-0.0251676,0.8855727],[-0.016032,0.8911397],[-0.0136722,0.8877017],[-0.0039911,0.8935411],[-0.0016652,0.8901192],[0.0085511,0.8962109],[0.0108393,0.8928077],[0.0215783,0.8991298],[0.0238249,0.8957476],[0.0350714,0.9022765],[0.0372731,0.8989176],[0.049009,0.905628],[0.0511627,0.9022949],[0.0633671,0.9091601],[0.0645074,0.907368],[0.0645074,0.9423233],[0.0608352,0.9588992],[0.0525413,0.9949988],[0.0528202,0.995079],[0.0523323,0.9972813],[0.0529211,0.9974457],[0.0524636,0.9995932],[0.0533209,0.9998251],[0.0528942,1.0019149],[0.0539758,1.0021977],[0.0535796,1.0042272],[0.0548384,1.0045446],[0.0544725,1.0065115],[0.0558582,1.0068479],[0.055522,1.0087502],[0.0645074,1.0108466],[0.0645074,1.08],[-0.0645074,1.08],[-0.0645074,1.010975]]]],
    [[[[-0.0645074,1.0149137],[-0.0575892,1.0164116],[-0.0571411,1.0147762],[-0.0493066,1.0164701],[-0.0488593,1.0148362],[-0.0403807,1.0166613],[-0.0399368,1.0150338],[-0.0308152,1.0169826],[-0.030377,1.0153664],[-0.0206163,1.0174297],[-0.0201862,1.0158295],[-0.0097928,1.0179965],[-0.009373,1.0164172],[0.0016439,1.0186754],[0.0020513,1.0171217],[0.0136799,1.0194574],[0.0140729,1.0179339],[0.0262983,1.0203318],[0.0266752,1.018843],[0.0394798,1.0212871],[0.039839,1.0198374],[0.0532021,1.0223106],[0.0535423,1.0209041],[0.0645074,1.0228644],[0.0645074,1.08],[-0.0645074,1.08],[-0.0645074,1.0149137]]]],
    [[[[-0.0645074,-1.08],[0.0645074,-1.08],[0.0645074,-1.0164305],[0.064324,-1.0164701],[0.0638771,-1.0148375],[0.0566066,-1.0164116],[0.0561585,-1.0147761],[0.0482449,-1.0164865],[0.0477979,-1.0148531],[0.0392402,-1.0166938],[0.0387969,-1.0150674],[0.0295965,-1.0170309],[0.0291592,-1.0154163],[0.0193204,-1.017493],[0.0188915,-1.0158951],[0.0084209,-1.018074],[0.0080026,-1.0164976],[-0.0030902,-1.0187661],[-0.0034959,-1.0172159],[-0.0151987,-1.01956],[-0.0155898,-1.0180405],[-0.0278874,-1.020445],[-0.0282622,-1.0189608],[-0.0411365,-1.0214094],[-0.0414935,-1.0199647],[-0.0549236,-1.0224404],[-0.0552613,-1.0210394],[-0.0645074,-1.0226849],[-0.0645074,-1.08]]]],
    [[[[-0.0645074,-1.08],[0.0645074,-1.08],[0.0645074,-0.8804299],[0.0577392,-0.8846667],[0.0552896,-0.8811884],[0.0477584,-0.8858795],[0.0453253,-0.8824081],[0.0372325,-0.8874172],[0.0348206,-0.8839552],[0.0261698,-0.8892684],[0.0237837,-0.8858181],[0.0145806,-0.8914196],[0.0122248,-0.8879834],[0.0033941,-0.8933027],[-0.0338206,-0.9982513],[-0.0410639,-0.9961172],[-0.0418206,-0.9982513],[-0.0490639,-0.9961172],[-0.0498206,-0.9982513],[-0.0528477,-0.9973594],[-0.0524305,-0.9993084],[-0.0532572,-0.9995328],[-0.0528266,-1.0016299],[-0.0538832,-1.0019073],[-0.0534833,-1.0039443],[-0.0547229,-1.0042584],[-0.0543533,-1.006233],[-0.0557263,-1.006568],[-0.0553864,-1.0084783],[-0.0645074,-1.010617],[-0.0645074,-1.08]]]],
  ],
};

function convexHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const out = [];
    for (const point of list) {
      while (out.length > 1 && cross(out.at(-2), out.at(-1), point) <= 0) out.pop();
      out.push(point);
    }
    return out.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.reverse())];
}

// Signed distance from a point to a closed ring ([x, y] points).
function ringSignedDistance([px, py], ring) {
  let best = Infinity;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const ax = ring[j][0];
    const ay = ring[j][1];
    const bx = ring[i][0];
    const by = ring[i][1];
    if ((by > py) !== (ay > py) && px < (ax - bx) * (py - by) / (ay - by) + bx) inside = !inside;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    let t = lengthSquared > 0 ? ((px - ax) * dx + (py - ay) * dy) / lengthSquared : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = px - ax - t * dx;
    const ey = py - ay - t * dy;
    const squared = ex * ex + ey * ey;
    if (squared < best) best = squared;
  }
  best = Math.sqrt(best);
  return inside ? -best : best;
}

// The straight-flank source-style teeth are not conjugate: even in plain
// rolling they cut each other by about 0.04, and the prescribed reversals
// by about 0.069. Keep Brown's pinion tooth and generate each rack tooth:
// relieve its straight outline by the pinion teeth swept through the whole
// prescribed stroke, leaving running clearance in rolling and reversal.
function installConjugateReliefTeeth(root) {
  const d = root.userData;
  const b = d.blocks;
  const g = d.geometry;
  const profileAt = d.transmission.profileAtContactCoordinate;
  const addendum = g.pinionToothHeight / 2;
  // Relieve wherever the swept pinion comes within the trigger distance;
  // grow those cutters enough to cover the motion between samples.
  const reliefTrigger = 0.002;
  const reliefClearance = 0.006;
  const growthAngle = reliefClearance / (g.pinionRootRadius - 0.05);
  // Brown draws square, parallel-sided teeth on both members. The pinion
  // tooth is unbevelled so the rendered solid is the outline used below.
  const toothWidth = g.circularPitch * 0.42;
  const gearRoot = g.pinionRootRadius;
  const inner = gearRoot - 0.02;
  const toothPolygons = poly([
    [inner, -toothWidth / 2],
    [g.pinionOuterRadius, -toothWidth / 2],
    [g.pinionOuterRadius, toothWidth / 2],
    [inner, toothWidth / 2],
  ]);
  const toothRing = toothPolygons[0][0].slice(0, -1);
  const toothGeometry = plate(toothPolygons, -g.pinionDepth / 2, g.pinionDepth / 2);
  for (const tooth of b.pinionToothMeshes) {
    tooth.geometry.dispose();
    tooth.geometry = toothGeometry;
  }
  b.pinionRim.geometry.dispose();
  b.pinionRim.geometry = plate(polygonClipping.difference(
    poly(circle([0, 0], gearRoot, 192)),
    poly(circle([0, 0], g.pinionRimInnerRadius, 192)),
  ), -g.pinionDepth / 2, g.pinionDepth / 2);

  // Pinion teeth in pinion coordinates, and each rack tooth's nominal
  // straight-sided outline in frame coordinates.
  const cutterRing = toothRing;
  const turnRing = (ring, angle) => ring.map(([x, y]) => [
    x * Math.cos(angle) - y * Math.sin(angle),
    x * Math.sin(angle) + y * Math.cos(angle),
  ]);
  const pinionTeethRings = b.pinionToothMeshes.map((tooth) => ({
    cutter: turnRing(cutterRing, tooth.rotation.z),
    full: turnRing(toothRing, tooth.rotation.z),
  }));
  const rootDepth = g.rackToothRootY - g.pinionPitchRadius + 0.02;
  const reliefSamples = [];
  const coordinateStep = 0.008;
  for (let c = g.contactCoordinateMinimum - 0.1; c <= g.contactCoordinateMaximum + 0.1; c += coordinateStep) {
    const angle = profileAt(c).value;
    reliefSamples.push({ angle, c });
  }
  for (const sample of reliefSamples) {
    sample.cos = Math.cos(sample.angle);
    sample.sin = Math.sin(sample.angle);
  }
  const worldTooth = (ring, sample) => ring.map(([x, y]) => [
    x * sample.cos - y * sample.sin + sample.c,
    x * sample.sin + y * sample.cos,
  ]);
  const reliefSignature = JSON.stringify([
    g.circularPitch, g.pinionPitchRadius, g.pinionTeeth, g.pinionToothHeight,
    g.contactCoordinateMinimum, g.contactCoordinateMaximum, g.handoffHalfWidth,
    g.relievedToothHeightScale, g.rackToothRootY, toothWidth,
    reliefTrigger, reliefClearance, coordinateStep,
  ].map((value) => Number(value.toFixed(12))));
  const computeOutlines = () => b.rackTeeth.map((tooth) => {
    const side = tooth.userData.rack === 'upper' ? 1 : -1;
    // Brown's straight rack tooth; transition teeth are also shortened.
    const heightScale = tooth.userData.relievedForHandoff ? g.relievedToothHeightScale : 1;
    const tipY = g.rackToothRootY - g.pinionToothHeight * heightScale;
    const tipHalf = toothWidth / 2;
    const nominal = [
      [-toothWidth / 2, side * (g.rackToothRootY + 0.02)],
      [toothWidth / 2, side * (g.rackToothRootY + 0.02)],
      [tipHalf, side * tipY],
      [-tipHalf, side * tipY],
    ].map(([x, y]) => [x + tooth.position.x, y]);
    const nominalBox = {
      maxX: Math.max(...nominal.map(([x]) => x)),
      maxY: Math.max(...nominal.map(([, y]) => y)),
      minX: Math.min(...nominal.map(([x]) => x)),
      minY: Math.min(...nominal.map(([, y]) => y)),
    };
    const cutters = [];
    for (const sample of reliefSamples) {
      if (Math.abs(sample.c - tooth.position.x) > g.pinionOuterRadius + 0.2) continue;
      for (const [toothIndex, rings] of pinionTeethRings.entries()) {
        // Only teeth facing this rack can reach it.
        const facing = Math.sin(b.pinionToothMeshes[toothIndex].rotation.z + sample.angle);
        if (side * facing < 0.7) continue;
        const world = worldTooth(rings.cutter, sample);
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const [x, y] of world) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
        const margin = reliefTrigger + 0.002;
        if (minX > nominalBox.maxX + margin || maxX < nominalBox.minX - margin
          || minY > nominalBox.maxY + margin || maxY < nominalBox.minY - margin) continue;
        const exact = worldTooth(rings.full, sample);
        let gap = Infinity;
        for (const point of exact) gap = Math.min(gap, ringSignedDistance(point, nominal));
        for (const point of nominal) gap = Math.min(gap, ringSignedDistance(point, exact));
        if (gap < reliefTrigger) {
          // Grow the cutter for clearance: the hull of the tooth turned by
          // +-delta (flank offset) and scaled radially (tip offset).
          const grown = [];
          for (const turn of [-growthAngle, growthAngle]) {
            for (const [x, y] of world) {
              const dx = x - sample.c;
              const length = Math.hypot(dx, y);
              const scale = (length + reliefClearance) / length;
              const cos = Math.cos(turn);
              const sin = Math.sin(turn);
              grown.push([
                sample.c + (dx * cos - y * sin) * scale,
                (dx * sin + y * cos) * scale,
              ]);
            }
          }
          cutters.push(convexHull(grown));
        }
      }
    }
    let shape = poly(nominal);
    if (cutters.length) {
      shape = polygonClipping.difference(shape, ...cutters.map((ring) => [[...ring, ring[0]]]));
    }
    // Keep the piece still joined to the rail.
    const rail = side * (g.rackToothRootY + 0.02);
    const kept = shape.filter((polygon) => polygon[0].some(([, y]) => Math.abs(y - rail) < 1e-9));
    return kept.map((polygon) => polygon.map((ring) => ring.map(
      ([x, y]) => [Number((x - tooth.position.x).toFixed(7)), Number(y.toFixed(7))],
    )));
  });
  const baked = BAKED_269_RACK_RELIEF.signature === reliefSignature
    ? BAKED_269_RACK_RELIEF.outlines
    : null;
  const outlines = baked ?? computeOutlines();
  let reliefCount = 0;
  b.rackTeeth.forEach((tooth, index) => {
    tooth.geometry = plate(outlines[index], -g.rackDepth / 2, g.rackDepth / 2);
    if (outlines[index].flat(2).length > 5) reliefCount += 1;
  });
  d.computeRackReliefOutlines = computeOutlines;
  d.rackReliefSignature = reliefSignature;
  d.conjugateTeeth = {
    addendum,
    rackTeethRelieved: reliefCount,
    bakedRelief: Boolean(baked),
    reliefClearance,
    reliefTrigger,
    toothProfile: 'Brown-style straight-flanked pinion teeth; every rack tooth is generated by relieving its straight outline with the pinion swept through the prescribed stroke',
  };
}

export function createAuthoredMutilatedRackMovement(movement) {
  if (movement.id !== 269) return null;
  const result = mutilatedRackFrameAlternatingSpurGear(movement);
  installConjugateReliefTeeth(result.root);
  result.update(0);
  result.root.userData.fidelity = 'authored';
  return result;
}
