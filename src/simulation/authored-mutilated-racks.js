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

// The 14.5 degree angle of Brown's day keeps the teeth nearly square as drawn.
const PRESSURE_ANGLE = THREE.MathUtils.degToRad(14.5);
const involuteFunction = (angle) => Math.tan(angle) - angle;

// Pinion tooth centred on +x: involute flanks conjugate to the straight-flanked
// rack below, parallel-sided below the base circle, backlash split on both flanks.
function involutePinionTooth({ pitchRadius, teeth, rootRadius, outerRadius, backlash }) {
  const baseRadius = pitchRadius * Math.cos(PRESSURE_ANGLE);
  const pitchHalfAngle = Math.PI / (2 * teeth) - backlash / (2 * pitchRadius);
  const involuteHalfAngle = (radius) => pitchHalfAngle + involuteFunction(PRESSURE_ANGLE)
    - involuteFunction(Math.acos(baseRadius / radius));
  const baseHalfWidth = baseRadius * Math.sin(involuteHalfAngle(baseRadius));
  const halfAngle = (radius) => (radius >= baseRadius
    ? involuteHalfAngle(radius)
    : Math.asin(Math.min(1, baseHalfWidth / radius)));
  const radii = [rootRadius - 0.02];
  const start = Math.max(rootRadius, baseRadius);
  for (let i = 0; i <= 10; i += 1) radii.push(start + (outerRadius - start) * i / 10);
  const flank = radii.map((radius) => [radius, halfAngle(radius)]);
  return [
    ...flank.map(([r, a]) => [r * Math.cos(a), -r * Math.sin(a)]),
    ...flank.reverse().map(([r, a]) => [r * Math.cos(a), r * Math.sin(a)]),
  ];
}

// Straight-flanked rack tooth outline in frame coordinates.
function straightRackTooth({ x, side, pitchY, rootY, tipY, circularPitch, backlash }) {
  const pitchHalf = circularPitch / 4 - backlash / 2;
  const half = (y) => pitchHalf + (Math.abs(y) - Math.abs(pitchY)) * Math.tan(PRESSURE_ANGLE);
  return [
    [x - half(rootY), side * Math.abs(rootY)],
    [x + half(rootY), side * Math.abs(rootY)],
    [x + half(tipY), side * Math.abs(tipY)],
    [x - half(tipY), side * Math.abs(tipY)],
  ];
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
  // Standard-proportion teeth (plate: rack teeth 0.64 pitch tall, tapered).
  const pinionToothHeight = 0.2;
  const toothBacklash = 0.012;
  const pinionRootRadius = pinionPitchRadius - pinionToothHeight / 2;
  const pinionOuterRadius = pinionPitchRadius + pinionToothHeight / 2;
  const pinionDepth = 0.46;
  const pinionRimInnerRadius = pinionRootRadius - 0.18;
  // Plate: a small boss with the shaft end showing as a dot.
  const pinionHubRadius = 0.13;

  const rackGroupSpecifications = [
    { id: 'upper-left-four', rack: 'upper', sign: 1, toothCount: 4 },
    { id: 'lower-left-four', rack: 'lower', sign: -1, toothCount: 4 },
    { id: 'upper-central-seven', rack: 'upper', sign: 1, toothCount: 7 },
    { id: 'lower-right-two', rack: 'lower', sign: -1, toothCount: 2 },
  ];
  const installedRackToothCount = rackGroupSpecifications.reduce(
    (sum, group) => sum + group.toothCount,
    0,
  );
  const contactCoordinateMinimum = -8.5 * circularPitch;
  const contactCoordinateMaximum = 8.5 * circularPitch;
  const contactCoordinateAmplitude = (
    contactCoordinateMaximum - contactCoordinateMinimum
  ) / 2;
  const handoffHalfWidth = circularPitch * 0.56;
  const rackToothRootHalfWidth = circularPitch * 0.34;
  const rackToothTipHalfWidth = circularPitch * 0.12;
  const rackRadialClearance = 0.02;
  const rackToothRootY = pinionOuterRadius + rackRadialClearance;
  const rackToothTipY = pinionRootRadius + rackRadialClearance;
  const relievedToothHeightScale = 1;
  const rackDepth = 0.38;

  // Plate: the open left end is flush with the first tooth.
  const frameLeft = contactCoordinateMinimum - circularPitch * 0.15;
  const frameRightBridgeClearance = 0.06;
  const frameRightBridgeWidth = 0.45;
  // Brown closes the frame one tooth past the last rack; the gear needs its full tip radius.
  const frameRight = contactCoordinateMaximum + pinionOuterRadius
    + frameRightBridgeClearance + frameRightBridgeWidth;
  // Plate frame half-height is 1.6 gear tip radii (102.5 px vs 64 px).
  const frameOuterHalfHeight = 1.58;
  const frameRailHeight = frameOuterHalfHeight - rackToothRootY;
  const frameRailCenterY = (
    frameOuterHalfHeight + rackToothRootY
  ) / 2;
  const frameDepth = 0.42;
  // Plate rod, collar and collar station, scaled by the 20.3 px tooth pitch.
  const driveRodLength = 1.8;
  const driveRodRadius = 0.35;
  const driveCollarRadius = 0.9;
  const driveCollarWidth = 0.41;

  // Plate: a gear tooth sits in the third space of the seven-tooth rack.
  const sourceContactCoordinate = 2.5 * circularPitch;
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
    const outline = straightRackTooth({
      x: 0, side, pitchY: pinionPitchRadius, rootY, tipY, circularPitch, backlash: toothBacklash,
    });
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
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
  const transitionAdjacentIndices = new Set([3, 4, 7, 8, 14, 15]);
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
        // Brown does not mark the handoff teeth; they share the rack colour.
        driverMaterial,
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
  driveCollar.position.x = frameRight + 1.02;
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

  const baseToothShape = new THREE.Shape();
  const baseToothPoints = involutePinionTooth({
    pitchRadius: pinionPitchRadius, teeth: pinionTeeth, rootRadius: pinionRootRadius,
    outerRadius: pinionOuterRadius, backlash: toothBacklash,
  }).map(([x, y]) => new THREE.Vector2(x, y));
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
    drivenMaterial,
    32,
  );
  pinionHub.userData.role = 'hub-fixed-to-alternating-output-shaft';
  const pinionShaft = cylinderAlongZ(0.06, 0.86, darkMaterial, 30);
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
    'one-continued-rectilinearly-reciprocating-frame-carries-four-staggered-mutilated-rack-groups-upper-four-lower-four-upper-seven-lower-two-that-alternately-mesh-with-one-complete-fixed-axis-spur-gear-through-three-relieved-tooth-handoffs';
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
  // Fit the racked frame and gear over the whole stroke, but not the rod and
  // collar at the far stroke limit: they leave the view briefly there, so the
  // subject is not shrunk to a strip as it was when every part was fitted.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.9, -1.7, -0.82),
    new THREE.Vector3(6.2, 1.7, 0.82),
  );
  root.userData.hideGround = true;
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
    toothBacklash,
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
        'one horizontally translating open-left frame surrounds one complete fixed-axis spur gear and carries four successive inward-facing rack groups: upper four, lower four, upper seven, and lower two teeth',
      // Remeasured pass 51 from dark pixels of public/engravings/mm_269.png.
      measurementUncertaintyPixels: 3,
      officialAnimationAvailable: true,
      rasterDriveRodEnd: { x: 505, y: 242 },
      rasterFrameInnerRightX: 340,
      rasterFrameOuterBounds: {
        bottom: 348,
        left: 32,
        right: 388,
        top: 143,
      },
      rasterPinionCenter: { x: 246, y: 243 },
      rasterPinionOuterRadius: 64,
      rasterRackPitch: 20.3,
      rasterPinionToothCount: 18,
      rasterRackGroupOrder: [
        'upper-four',
        'lower-four',
        'upper-seven',
        'lower-two',
      ],
      rasterRackPitchLines: { lowerY: 302, upperY: 184 },
      rasterRackToothCounts: [4, 4, 7, 2],
      sourceEngagement: 'upper-central-seven-tooth-group',
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
    cameraDirection: new THREE.Vector3(0.03, 0.05, 1),
  };
}

// Rack-tooth relief outlines baked offline by computeRackReliefOutlines;
// the signature pins every parameter they depend on.
const BAKED_269_RACK_RELIEF = {
  signature: '[0.307177948351,0.88,18,0.2,-2.611012560984,2.611012560984,0.172019651077,1,1,0.012,0.002,0.006,0.008]',
  outlines: [
    [[[[-0.1070009,1.02],[0.1070009,1.02],[0.0501051,0.8],[-0.0501051,0.8],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[0.1070009,1.02],[0.0501051,0.8],[-0.0501051,0.8],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[-0.0564745,0.8246287],[-0.0558745,0.8250285],[-0.0514121,0.8226644],[-0.0461039,0.8261845],[-0.0416601,0.8238181],[-0.0358235,0.8276654],[-0.0314043,0.8252964],[-0.0250408,0.8294605],[-0.020652,0.8270888],[-0.0137648,0.8315569],[-0.0094122,0.8291824],[-0.0020067,0.8339394],[0.0023043,0.8315624],[0.0102207,0.8365912],[0.0144847,0.8342118],[0.0229021,0.8394931],[0.027114,0.8371119],[0.0360202,0.8426246],[0.0401753,0.840242],[0.0495554,0.8459634],[0.0536492,0.8435801],[0.0627959,0.8490717],[0.1070009,1.02],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[-0.0912835,0.9592252],[-0.0895595,0.959647],[-0.0881101,0.9580463],[-0.0825245,0.9594188],[-0.0810665,0.9578119],[-0.0748827,0.9593339],[-0.0734212,0.9577243],[-0.0666327,0.9593932],[-0.0651728,0.9577845],[-0.0577754,0.9595961],[-0.0563222,0.9579919],[-0.0483144,0.95994],[-0.0468728,0.9583438],[-0.0382551,0.9604207],[-0.0368302,0.9588361],[-0.0276058,0.9610324],[-0.0262023,0.959463],[-0.0163769,0.9617675],[-0.0149995,0.9602168],[-0.0045815,0.9626169],[-0.0032347,0.9610885],[0.0077649,0.9635705],[0.009077,0.9620679],[0.0206442,0.9646165],[0.0219176,0.9631432],[0.0340358,0.9657423],[0.0352669,0.9643018],[0.0479163,0.9669344],[0.0491017,0.9655301],[0.0622596,0.9681786],[0.0633964,0.9668139],[0.0770368,0.9694604],[0.0781225,0.9681383],[0.0922163,0.9707648],[0.0932486,0.9694885],[0.0939711,0.9696174],[0.1070009,1.02],[-0.1070009,1.02]]]],
    [[[[-0.1070009,-1.02],[0.1070009,-1.02],[0.0911991,-0.9588988],[0.0883519,-0.9595961],[0.0869006,-0.957994],[0.0812091,-0.9593932],[0.0797501,-0.9577855],[0.0734591,-0.9593339],[0.0719975,-0.9577242],[0.0651009,-0.9594188],[0.0636418,-0.9578107],[0.0561359,-0.959647],[0.0546844,-0.958044],[0.0465679,-0.9600157],[0.0451289,-0.9584213],[0.036403,-0.9605202],[0.0349815,-0.958938],[0.0256497,-0.9611544],[0.0242505,-0.9595881],[0.014319,-0.9619105],[0.0129467,-0.9603635],[0.0024243,-0.9627793],[0.0010833,-0.9612553],[-0.0100183,-0.9637502],[-0.0113238,-0.9622526],[-0.0229904,-0.9648113],[-0.0242565,-0.9633436],[-0.0364708,-0.9659499],[-0.037694,-0.9645157],[-0.0504356,-0.9671524],[-0.0516126,-0.9657549],[-0.0648583,-0.9684044],[-0.0659862,-0.967047],[-0.0797095,-0.9696913],[-0.0807859,-0.9683772],[-0.0942966,-0.970876],[-0.1070009,-1.02]]]],
    [[[[-0.1070009,-1.02],[0.1070009,-1.02],[0.0562648,-0.8238177],[0.0541734,-0.82521],[0.0497139,-0.8228455],[0.0443116,-0.8264246],[0.0398717,-0.8240577],[0.0339413,-0.8279622],[0.029527,-0.8255927],[0.02307,-0.8298119],[0.0186872,-0.8274397],[0.0117074,-0.8319604],[0.0073617,-0.8295854],[-0.0001353,-0.8343921],[-0.0044383,-0.8320147],[-0.0124446,-0.8370898],[-0.0166997,-0.8347101],[-0.025205,-0.8400342],[-0.0294072,-0.8376527],[-0.0383988,-0.8432042],[-0.0425434,-0.8408215],[-0.052006,-0.8465774],[-0.0560884,-0.8441942],[-0.0625321,-0.8480516],[-0.1070009,-1.02]]]],
    [[[[-0.1070009,-1.02],[0.1070009,-1.02],[0.0621901,-0.8467293],[0.0593019,-0.8450071],[0.0552346,-0.8473903],[0.0456646,-0.8415902],[0.0415342,-0.8439731],[0.0324313,-0.8383718],[0.0282422,-0.8407537],[0.0196222,-0.8353746],[0.015379,-0.8377548],[0.0072554,-0.8326198],[0.0029631,-0.8349978],[-0.0046534,-0.8301269],[-0.0089896,-0.8325024],[-0.0160906,-0.8279136],[-0.0204652,-0.8302865],[-0.0270444,-0.8259958],[-0.0314519,-0.8283659],[-0.0375053,-0.824387],[-0.0419397,-0.8267545],[-0.0474651,-0.8230987],[-0.0519206,-0.8254637],[-0.0559904,-0.822757],[-0.1070009,-1.02]]]],
    [[[[-0.1070009,-1.02],[0.1070009,-1.02],[0.0942007,-0.9705051],[0.0842932,-0.9686911],[0.0832292,-0.9699946],[0.0693987,-0.9673542],[0.0682826,-0.9687018],[0.0549231,-0.9660519],[0.0537573,-0.9674403],[0.040896,-0.964799],[0.0396833,-0.966225],[0.0273442,-0.9636101],[0.0260878,-0.9650703],[0.0142919,-0.9624989],[0.0129952,-0.9639899],[0.0017605,-0.9614787],[0.0004274,-0.9629969],[-0.0102311,-0.9605614],[-0.0115965,-0.9621033],[-0.0216666,-0.9597579],[-0.0230599,-0.9613201],[-0.0325321,-0.9590779],[-0.0339488,-0.9606567],[-0.0428164,-0.9585295],[-0.0442517,-0.9601213],[-0.0525105,-0.9581192],[-0.0539595,-0.9597205],[-0.0616077,-0.957852],[-0.0630655,-0.9594593],[-0.0701039,-0.9577312],[-0.0715653,-0.9593408],[-0.077997,-0.957758],[-0.0794571,-0.9593665],[-0.0852876,-0.9579324],[-0.0867412,-0.959536],[-0.0910883,-0.9584703],[-0.1070009,-1.02]]]],
    [[[[-0.1070009,1.02],[-0.0940597,0.96996],[-0.0896891,0.9691723],[-0.0886441,0.9704595],[-0.0746532,0.9678268],[-0.0735554,0.9691591],[-0.060025,0.9665105],[-0.0588766,0.9678847],[-0.0458351,0.9652383],[-0.0446387,0.9666513],[-0.0321112,0.964025],[-0.0308699,0.9654734],[-0.0188785,0.9628846],[-0.0175958,0.964365],[-0.0061594,0.9618306],[-0.0048389,0.9633395],[0.0060263,0.9608753],[0.0073806,0.9624092],[0.0176614,0.9600302],[0.0190453,0.9615856],[0.0287312,0.9593052],[0.0301401,0.9608785],[0.0392235,0.9587091],[0.0406528,0.9602967],[0.0491285,0.958249],[0.0505732,0.9598474],[0.0584388,0.9579305],[0.059894,0.959536],[0.0671492,0.9577573],[0.0686099,0.9593665],[0.075257,0.9577315],[0.0767181,0.9593408],[0.0827619,0.9578535],[0.0842183,0.9594593],[0.0896657,0.9581218],[0.0911123,0.9597205],[0.0913938,0.9596518],[0.1070009,1.02],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[-0.0623585,0.8473804],[-0.0602047,0.8486496],[-0.0504729,0.8427847],[-0.0463645,0.8451679],[-0.0370934,0.839493],[-0.0329246,0.8418754],[-0.0241311,0.8364146],[-0.0199066,0.8387954],[-0.011605,0.8335712],[-0.0073296,0.83595],[0.0004685,0.830983],[0.0047897,0.8333594],[0.0120749,0.8286683],[0.0164365,0.8310421],[0.023202,0.8266436],[0.0275984,0.8290147],[0.0338393,0.8249233],[0.0382648,0.8272918],[0.0439783,0.8235198],[0.048427,0.8258857],[0.0536121,0.8224431],[0.0562735,0.8238516],[0.1070009,1.02],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[0.1070009,1.02],[0.0501051,0.8],[-0.0501051,0.8],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[0.1070009,1.02],[0.0501051,0.8],[-0.0501051,0.8],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[0.1070009,1.02],[0.0501051,0.8],[-0.0501051,0.8],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[-0.0560347,0.822928],[-0.0548886,0.8223218],[-0.0497756,0.8257188],[-0.0453242,0.8233533],[-0.0396829,0.8270808],[-0.0352539,0.8247127],[-0.0290849,0.8287611],[-0.0246842,0.8263903],[-0.0179901,0.8307477],[-0.0136234,0.8283742],[-0.0064088,0.8330263],[-0.0020818,0.8306502],[0.0056467,0.8355807],[0.0099287,0.8332022],[0.0181622,0.8383925],[0.0223939,0.8360119],[0.031121,0.8414416],[0.0352977,0.8390594],[0.0445044,0.8447064],[0.0486214,0.8423233],[0.0582913,0.8481637],[0.0619975,0.8459845],[0.1070009,1.02],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[-0.09119,0.9588637],[-0.0905623,0.9581697],[-0.0851957,0.9594866],[-0.0837403,0.9578816],[-0.0777785,0.9593485],[-0.0763177,0.9577395],[-0.0697534,0.9593544],[-0.0682923,0.957745],[-0.0611204,0.9595045],[-0.0596641,0.9578982],[-0.051882,0.9597966],[-0.0504355,0.9581971],[-0.042043,0.9602274],[-0.0406114,0.9586381],[-0.0316107,0.9607915],[-0.0301988,0.959216],[-0.0205947,0.9614819],[-0.0192072,0.9599239],[-0.0090071,0.9622902],[-0.0076485,0.9607531],[0.0031376,0.9632066],[0.004463,0.961694],[0.0158222,0.9642198],[0.0171103,0.9627353],[0.029027,0.9653176],[0.0302741,0.9638646],[0.0427296,0.9664868],[0.0439323,0.9650688],[0.056905,0.9677135],[0.0580602,0.9663338],[0.0715254,0.9689831],[0.0726302,0.9676449],[0.08656,0.9702809],[0.0876123,0.9689874],[0.094113,0.9701661],[0.1070009,1.02],[-0.1070009,1.02]]]],
    [[[[-0.1070009,-1.02],[0.1070009,-1.02],[0.0910232,-0.9582187],[0.0857819,-0.9595045],[0.0843272,-0.9578999],[0.0784149,-0.9593544],[0.0769544,-0.9577457],[0.0704401,-0.9593485],[0.0689788,-0.957739],[0.0618573,-0.9594866],[0.0604004,-0.95788],[0.0526688,-0.9597672],[0.0512213,-0.9581669],[0.0428793,-0.9601866],[0.0414462,-0.9585964],[0.0324957,-0.9607399],[0.0310819,-0.9591632],[0.0215276,-0.9614202],[0.0201378,-0.9598606],[0.0099867,-0.9622191],[0.0086255,-0.9606802],[-0.0021125,-0.9631269],[-0.0034409,-0.9616122],[-0.0147532,-0.9641326],[-0.0160446,-0.9626456],[-0.0279158,-0.9652239],[-0.0291665,-0.9637682],[-0.0415782,-0.9663878],[-0.0427847,-0.9649667],[-0.0557155,-0.9676102],[-0.0568747,-0.9662272],[-0.0703002,-0.9688769],[-0.0714093,-0.9675351],[-0.0853018,-0.9701729],[-0.0863585,-0.9688755],[-0.0941458,-0.9702928],[-0.1070009,-1.02]]]],
    [[[[-0.1070009,-1.02],[0.1070009,-1.02],[0.0558919,-0.8223758],[0.0556567,-0.8222514],[0.0505873,-0.8256208],[0.0461344,-0.8232554],[0.0405368,-0.8269559],[0.0361057,-0.824588],[0.0299803,-0.8286103],[0.025577,-0.8262398],[0.0189262,-0.8305721],[0.0145565,-0.8281989],[0.0073847,-0.8328272],[0.0030542,-0.8304513],[-0.0046322,-0.8353594],[-0.0089181,-0.8329811],[-0.0171102,-0.8381507],[-0.0213463,-0.8357702],[-0.030033,-0.841181],[-0.0342144,-0.8387989],[-0.0433821,-0.8444288],[-0.0475042,-0.8420458],[-0.0571365,-0.8478711],[-0.0611949,-0.8454879],[-0.0619916,-0.8459619],[-0.1070009,-1.02]]]],
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
  // Brown draws tapered teeth on both members: involute pinion teeth and
  // straight-flanked rack teeth, conjugate in rolling, so only the teeth the
  // prescribed handoff reversals sweep need relief. The pinion tooth is
  // unbevelled so the rendered solid is the outline used below.
  const gearRoot = g.pinionRootRadius;
  const toothPolygons = poly(involutePinionTooth({
    pitchRadius: g.pinionPitchRadius, teeth: g.pinionTeeth, rootRadius: gearRoot,
    outerRadius: g.pinionOuterRadius, backlash: g.toothBacklash,
  }));
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
    // The stroke is clamped at its limits: sweep the pinion where it really is.
    const profile = profileAt(c);
    reliefSamples.push({ angle: profile.value, c: profile.contactCoordinate });
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
    g.relievedToothHeightScale, g.rackToothRootY, g.toothBacklash,
    reliefTrigger, reliefClearance, coordinateStep,
  ].map((value) => Number(value.toFixed(12))));
  const computeOutlines = () => b.rackTeeth.map((tooth) => {
    const side = tooth.userData.rack === 'upper' ? 1 : -1;
    // Brown's straight rack tooth; transition teeth are also shortened.
    const heightScale = tooth.userData.relievedForHandoff ? g.relievedToothHeightScale : 1;
    const tipY = g.rackToothRootY - g.pinionToothHeight * heightScale;
    const nominal = straightRackTooth({
      x: tooth.position.x, side, pitchY: g.pinionPitchRadius, rootY: g.rackToothRootY + 0.02,
      tipY, circularPitch: g.circularPitch, backlash: g.toothBacklash,
    });
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
  // Relief in depth: behind the pinion's rear face each relieved tooth keeps
  // Brown's full straight-flanked outline as a web on a backing strip behind
  // the rail. From the front every tooth reads full, as drawn; the swept
  // pinion teeth pass in front of these webs at the handoffs and never reach
  // the working (front) depth of the relieved outline.
  const webFront = -g.pinionDepth / 2 - 0.012;
  const webBack = webFront - 0.05;
  const backingTop = g.rackToothRootY + 0.12;
  const reliefWebs = [];
  b.rackTeeth.forEach((tooth, index) => {
    tooth.geometry = plate(outlines[index], -g.rackDepth / 2, g.rackDepth / 2);
    if (outlines[index].flat(2).length <= 5) return;
    reliefCount += 1;
    const side = tooth.userData.rack === 'upper' ? 1 : -1;
    const full = straightRackTooth({
      x: 0, side, pitchY: g.pinionPitchRadius, rootY: g.rackToothRootY + 0.02,
      tipY: g.rackToothRootY - g.pinionToothHeight, circularPitch: g.circularPitch, backlash: g.toothBacklash,
    });
    const half = g.circularPitch / 2;
    const web = new THREE.Mesh(plate(polygonClipping.union(poly(full)), webBack, webFront), tooth.material);
    const strip = new THREE.Mesh(plate(poly([[-half, side * (g.rackToothRootY + 0.01)], [half, side * (g.rackToothRootY + 0.01)],
      [half, side * backingTop], [-half, side * backingTop]]), webBack, -g.rackDepth / 2 + 0.01), tooth.material);
    web.userData.role = `${tooth.userData.rack}-rack-relieved-tooth-full-outline-web-behind-pinion`;
    strip.userData.role = `${tooth.userData.rack}-rack-relieved-tooth-web-backing-strip`;
    tooth.add(web, strip);
    reliefWebs.push(web, strip);
  });
  b.rackReliefWebs = reliefWebs;
  d.computeRackReliefOutlines = computeOutlines;
  d.rackReliefSignature = reliefSignature;
  d.conjugateTeeth = {
    addendum,
    rackTeethRelieved: reliefCount,
    bakedRelief: Boolean(baked),
    reliefClearance,
    reliefTrigger,
    toothProfile: 'Brown-style tapered teeth: 14.5-degree involute pinion and straight-flanked rack, conjugate in rolling; each rack tooth outline is still relieved wherever the pinion swept through the prescribed stroke (handoff reversals) comes within the trigger distance',
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
