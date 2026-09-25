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
  // Brown's four groups (4, 4, 7, 2 teeth) run from the open end to the
  // closed end. Rolling all 17 pitches would carry the gear out of the open
  // end and into the closed end, so the stroke only spans the two middle
  // groups plus 0.6 pitch into each end group (enough to be fully engaged
  // there at reversal); the outer teeth of the end groups stay as drawn.
  const rackLayoutMinimum = -8.5 * circularPitch;
  const rackLayoutMaximum = 8.5 * circularPitch;
  const handoffHalfWidth = circularPitch * 0.56;
  const strokeEndEngagement = circularPitch * 0.6;
  const contactCoordinateMinimum = rackLayoutMinimum
    + rackGroupSpecifications[0].toothCount * circularPitch - strokeEndEngagement;
  const contactCoordinateMaximum = rackLayoutMaximum
    - rackGroupSpecifications.at(-1).toothCount * circularPitch + strokeEndEngagement;
  const contactCoordinateAmplitude = (
    contactCoordinateMaximum - contactCoordinateMinimum
  ) / 2;
  const contactCoordinateCenter = (
    contactCoordinateMaximum + contactCoordinateMinimum
  ) / 2;
  const rackToothRootHalfWidth = circularPitch * 0.34;
  const rackToothTipHalfWidth = circularPitch * 0.12;
  const rackRadialClearance = 0.02;
  const rackToothRootY = pinionOuterRadius + rackRadialClearance;
  const rackToothTipY = pinionRootRadius + rackRadialClearance;
  const relievedToothHeightScale = 1;
  const rackDepth = 0.38;

  // Plate: the open left end is flush with the first tooth.
  const frameLeft = rackLayoutMinimum - circularPitch * 0.15;
  // Brown closes the frame a quarter pitch past the last rack tooth. Rolling
  // the last lower pair carries the gear tips a tip radius past that tooth, so
  // the closed end is joggled back behind the pinion's rear face: at the
  // stroke limit the tips pass in front of it, as the front view allows.
  // The closed end now stands clear of the gear tips at the stroke limit
  // (0.05 running clearance), a little beyond the last rack tooth.
  const frameRightBridgeClearance = Math.max(
    circularPitch * 0.25,
    contactCoordinateMaximum + pinionOuterRadius + 0.05 - rackLayoutMaximum,
  );
  // Plate: the closed end is 48 px wide (raster 340...388) at 20.3 px a pitch.
  const frameRightBridgeWidth = circularPitch * 48 / 20.3;
  const frameRight = rackLayoutMaximum + frameRightBridgeClearance
    + frameRightBridgeWidth;
  const frameRightBridgeFront = -0.3;
  const frameRightBridgeBack = -0.42;
  // Clearance of the rod cylinder past the gear tips at the stroke limit; the
  // rod's joggled flat end bridges the gap behind the pinion.
  const driveRodStart = contactCoordinateMaximum + pinionOuterRadius + 0.04;
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
    (sourceContactCoordinate - contactCoordinateCenter) / contactCoordinateAmplitude,
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
  let groupStart = rackLayoutMinimum;
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
  const frameRightBridgeDepth = frameRightBridgeFront - frameRightBridgeBack;
  const rightBridge = new THREE.Mesh(
    new THREE.BoxGeometry(
      frameRightBridgeWidth,
      frameOuterHalfHeight * 2,
      frameRightBridgeDepth,
    ),
    driverMaterial,
  );
  rightBridge.position.set(
    frameRight - frameRightBridgeWidth / 2,
    0,
    (frameRightBridgeFront + frameRightBridgeBack) / 2,
  );
  rightBridge.userData.role = 'closed-right-end-of-translating-rack-frame';
  // Joggles: each rail's end steps back from its own depth to the bridge's.
  // They lie outside the gear's tip circle (|y| >= rack root line).
  const joggleDepth = -frameDepth / 2 - frameRightBridgeFront + 0.01;
  const rightJoggles = [1, -1].map((side) => {
    const joggle = new THREE.Mesh(
      new THREE.BoxGeometry(frameRightBridgeWidth, frameRailHeight, joggleDepth),
      driverMaterial,
    );
    joggle.position.set(
      frameRight - frameRightBridgeWidth / 2,
      side * frameRailCenterY,
      frameRightBridgeFront + joggleDepth / 2 - 0.005,
    );
    joggle.userData.role = 'joggle-stepping-rail-back-to-closed-end';
    return joggle;
  });

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
      tooth.position.x = rackLayoutMinimum
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
  // Same visible rod end as before (frameRight + length - 0.04); the round
  // rod begins only past the gear tips' reach at the stroke limit.
  const driveRodEnd = frameRight + driveRodLength - 0.04;
  driveRod.scale.y = (driveRodEnd - driveRodStart) / driveRodLength;
  driveRod.position.x = (driveRodStart + driveRodEnd) / 2;
  driveRod.userData.role = 'rectilinear-input-rod-rigid-with-rack-frame';
  // The rod's flat end, joggled back like the bridge, joins it behind the
  // gear; from the front it reads as the rod leaving the closed end.
  const driveRodNeckLength = driveRodStart + 0.05 - (frameRight - 0.02);
  const driveRodNeck = new THREE.Mesh(
    new THREE.BoxGeometry(
      driveRodNeckLength,
      driveRodRadius * 2,
      frameRightBridgeDepth,
    ),
    darkMaterial,
  );
  driveRodNeck.position.set(
    frameRight - 0.02 + driveRodNeckLength / 2,
    0,
    (frameRightBridgeFront + frameRightBridgeBack) / 2,
  );
  driveRodNeck.userData.role = 'joggled-flat-end-of-input-rod-behind-gear';
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
    ...rightJoggles,
    ...rackTeeth,
    driveRodNeck,
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
  // The boss stands proud in front; behind, it stops short of the joggled
  // closed end, which the hub overhangs at the stroke limit.
  const pinionHubFront = pinionDepth * 0.71;
  const pinionHubBack = frameRightBridgeFront + 0.03;
  const pinionHub = cylinderAlongZ(
    pinionHubRadius,
    pinionHubFront - pinionHubBack,
    drivenMaterial,
    32,
  );
  pinionHub.position.z = (pinionHubFront + pinionHubBack) / 2;
  pinionHub.userData.role = 'hub-fixed-to-alternating-output-shaft';
  // The shaft runs back past the joggled closed end (its radius clears the
  // bridge's inner face at the stroke limit) to the bearing behind it.
  const pinionShaftFront = 0.43;
  const pinionShaftBack = frameRightBridgeBack - 0.14;
  const pinionShaft = cylinderAlongZ(
    0.06,
    pinionShaftFront - pinionShaftBack,
    darkMaterial,
    30,
  );
  pinionShaft.position.z = (pinionShaftFront + pinionShaftBack) / 2;
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
  // Undrawn (hidden by source presentation): the bearing sits behind the
  // joggled closed end so the frame can pass in front of it.
  const bearingZ = frameRightBridgeBack - 0.08;
  bearingPost.position.set(0, -1.82 / 2, bearingZ - 0.17);
  bearingPost.userData.role = 'fixed-post-behind-moving-frame-holding-pinion';
  const bearingFoot = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.16, 0.32),
    frameMaterial,
  );
  bearingFoot.position.set(0, -1.9, bearingZ - 0.17);
  bearingFoot.userData.role = 'fixed-base-of-output-shaft-bearing';
  const pinionBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.055, 9, 40),
    frameMaterial,
  );
  pinionBearing.position.z = bearingZ;
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
    const contactCoordinate = contactCoordinateCenter + contactCoordinateAmplitude
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
      (contactCoordinate - contactCoordinateCenter) / contactCoordinateAmplitude,
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
    rightJoggles,
    driveRodNeck,
    topRail,
    upperContactMarker,
    upperRackTeeth,
  };
  root.userData.cameraDistanceScale = 0.92;
  // Fit the racked frame and gear over the whole stroke, but not the rod and
  // collar at the far stroke limit: they leave the view briefly there, so the
  // subject is not shrunk to a strip as it was when every part was fitted.
  // The box is the frame's swept silhouette (root scale 0.92): open end at
  // the right stroke limit to closed end at the left one.
  const frameSweepMinimumX = 0.92 * (frameLeft - contactCoordinateMaximum) - 0.01;
  const frameSweepMaximumX = 0.92 * (frameRight - contactCoordinateMinimum) + 0.01;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(frameSweepMinimumX, -1.7, -0.82),
    new THREE.Vector3(frameSweepMaximumX, 1.7, 0.82),
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
    contactCoordinateCenter,
    contactCoordinateMaximum,
    contactCoordinateMinimum,
    rackLayoutMaximum,
    rackLayoutMinimum,
    strokeEndEngagement,
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
    frameRightBridgeBack,
    frameRightBridgeClearance,
    frameRightBridgeFront,
    frameRightBridgeWidth,
    driveRodStart,
    pinionHubBack,
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
  signature: '[0.307177948351,0.88,18,0.2,-1.56660753659,2.180963433292,0.172019651077,1,1,0.012,0.002,0.006,0.008]',
  outlines: [
    [[[[-0.1070009,1.02],[0.1070009,1.02],[0.0501051,0.8],[-0.0501051,0.8],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[0.1070009,1.02],[0.0501051,0.8],[-0.0501051,0.8],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[-0.055897,0.8223957],[-0.0556289,0.8222539],[-0.050558,0.8256243],[-0.0461051,0.8232589],[-0.0405058,0.8269604],[-0.0360748,0.8245925],[-0.0299479,0.8286158],[-0.0255447,0.8262452],[-0.0188923,0.8305785],[-0.0145227,0.8282052],[-0.0073493,0.8328344],[-0.0030189,0.8304585],[0.0046689,0.8353674],[0.0089547,0.8329891],[0.0171483,0.8381594],[0.0213842,0.835779],[0.0300724,0.8411904],[0.0342537,0.8388083],[0.0434228,0.8444388],[0.0475447,0.8420558],[0.0571783,0.8478817],[0.0612366,0.8454985],[0.0619873,0.8459451],[0.1070009,1.02],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[-0.0910218,0.9582131],[-0.0857607,0.9595038],[-0.084306,0.9578992],[-0.0783919,0.9593542],[-0.0769314,0.9577454],[-0.0704152,0.9593487],[-0.068954,0.9577392],[-0.0618306,0.9594872],[-0.0603737,0.9578806],[-0.0526403,0.9597682],[-0.0511929,0.958168],[-0.042849,0.9601881],[-0.041416,0.9585979],[-0.0324637,0.9607418],[-0.03105,0.9591651],[-0.0214938,0.9614224],[-0.0201041,0.9598629],[-0.0099512,0.9622217],[-0.0085901,0.9606828],[0.0021497,0.9631298],[0.0034779,0.9616152],[0.0147919,0.9641358],[0.0160832,0.9626489],[0.0279561,0.9652273],[0.0292066,0.9637717],[0.0416199,0.9663914],[0.0428263,0.9649704],[0.0557586,0.967614],[0.0569177,0.9662311],[0.0703446,0.9688807],[0.0714536,0.9675391],[0.0853475,0.9701768],[0.086404,0.9688796],[0.0941446,0.9702882],[0.1070009,1.02],[-0.1070009,1.02]]]],
    [[[[-0.1070009,-1.02],[0.1070009,-1.02],[0.0911826,-0.9588349],[0.0905818,-0.9581707],[0.0852171,-0.9594872],[0.0837617,-0.9578822],[0.0778017,-0.9593487],[0.0763409,-0.9577397],[0.0697783,-0.9593542],[0.0683173,-0.9577448],[0.0611472,-0.9595038],[0.0596909,-0.9578975],[0.0519106,-0.9597955],[0.0504641,-0.958196],[0.0420734,-0.9602259],[0.0406417,-0.9586366],[0.0316429,-0.9607896],[0.0302309,-0.9592141],[0.0206287,-0.9614796],[0.019241,-0.9599215],[0.0090427,-0.9622876],[0.007684,-0.9607505],[-0.0031003,-0.9632037],[-0.0044258,-0.961691],[-0.0157833,-0.9642166],[-0.0170716,-0.962732],[-0.0289866,-0.9653142],[-0.0302338,-0.9638611],[-0.0426878,-0.9664832],[-0.0438906,-0.9650651],[-0.0568618,-0.9677098],[-0.0580171,-0.9663299],[-0.0714809,-0.9689793],[-0.0725859,-0.9676409],[-0.0865143,-0.9702769],[-0.0875668,-0.9689833],[-0.0941142,-0.9701707],[-0.1070009,-1.02]]]],
    [[[[-0.1070009,-1.02],[0.1070009,-1.02],[0.0560295,-0.8229079],[0.0549165,-0.8223192],[0.0498051,-0.8257152],[0.0453537,-0.8233497],[0.0397139,-0.8270762],[0.0352849,-0.8247081],[0.0291175,-0.8287556],[0.0247167,-0.8263848],[0.0180241,-0.8307413],[0.0136574,-0.8283678],[0.0064443,-0.8330191],[0.0021171,-0.830643],[-0.0056099,-0.8355726],[-0.009892,-0.8331941],[-0.0181239,-0.8383837],[-0.0223559,-0.8360031],[-0.0310815,-0.8414321],[-0.0352583,-0.8390499],[-0.0444637,-0.8446963],[-0.0485808,-0.8423132],[-0.0582494,-0.8481531],[-0.0619896,-0.8459539],[-0.1070009,-1.02]]]],
    [[[[-0.1070009,-1.02],[0.1070009,-1.02],[0.0628531,-0.8492928],[0.0531251,-0.8434486],[0.0490289,-0.8458318],[0.0396667,-0.840118],[0.0355093,-0.8425006],[0.0266217,-0.8369963],[0.0224076,-0.8393775],[0.0140092,-0.8341055],[0.0097433,-0.8364848],[0.0018464,-0.8314661],[-0.0024663,-0.833843],[-0.009852,-0.8290967],[-0.0142062,-0.8314711],[-0.0210733,-0.8270144],[-0.0254634,-0.829386],[-0.0318068,-0.8252338],[-0.036227,-0.8276028],[-0.0420433,-0.8237678],[-0.046488,-0.8261342],[-0.051776,-0.8226267],[-0.0562389,-0.8249907],[-0.0565197,-0.8248036],[-0.1070009,-1.02]]]],
    [[[[-0.1070009,-1.02],[0.1070009,-1.02],[0.0939855,-0.9696729],[0.0926616,-0.9694365],[0.0916272,-0.9707145],[0.0775502,-0.968087],[0.0764626,-0.9694107],[0.0628401,-0.9667638],[0.0617014,-0.9681301],[0.0485626,-0.9654819],[0.0473753,-0.9668876],[0.0347459,-0.964256],[0.0335131,-0.9656978],[0.0214157,-0.9631003],[0.0201408,-0.9645748],[0.008595,-0.9620285],[0.0072815,-0.9635321],[-0.003696,-0.961053],[-0.0050441,-0.9625824],[-0.0154396,-0.9601856],[-0.016818,-0.9617371],[-0.0266205,-0.9594365],[-0.0280249,-0.9610066],[-0.0372261,-0.9588147],[-0.0386518,-0.9603998],[-0.0472461,-0.9583277],[-0.0486882,-0.9599242],[-0.0566727,-0.9579812],[-0.0581263,-0.9595857],[-0.0655002,-0.9577795],[-0.0669602,-0.9593882],[-0.0737255,-0.9577249],[-0.0751869,-0.9593345],[-0.0813477,-0.9578182],[-0.0828054,-0.959425],[-0.0883682,-0.9580582],[-0.0898172,-0.9596586],[-0.0913017,-0.9592955],[-0.1070009,-1.02]]]],
    [[[[-0.1070009,1.02],[-0.0942806,0.9708142],[-0.0813614,0.9684287],[-0.0802871,0.9697411],[-0.0665461,0.9670974],[-0.0654201,0.9684532],[-0.0521556,0.9658036],[-0.0509804,0.9671996],[-0.038219,0.964562],[-0.0369975,0.965995],[-0.0247626,0.9633872],[-0.0234981,0.9648536],[-0.0118102,0.9622927],[-0.0105061,0.9637893],[0.0006175,0.9612916],[0.0019572,0.9628147],[0.012502,0.9603957],[0.0138732,0.9619418],[0.0238275,0.9596155],[0.0252257,0.9611812],[0.0345807,0.9589606],[0.0360014,0.9605422],[0.0447507,0.9584386],[0.0461891,0.9600325],[0.054329,0.9580558],[0.0557801,0.9596586],[0.0633094,0.957817],[0.0647683,0.959425],[0.0716882,0.9577248],[0.0731498,0.9593345],[0.0794639,0.9577805],[0.0809231,0.9593882],[0.0866374,0.9579833],[0.0880891,0.9595857],[0.0911809,0.9588284],[0.1070009,1.02],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[-0.0624755,0.8478329],[-0.0566157,0.8443272],[-0.0525357,0.8467105],[-0.0430554,0.8409472],[-0.0389131,0.84333],[-0.0299031,0.8377701],[-0.0257031,0.8401517],[-0.0171788,0.8348185],[-0.0129257,0.8371983],[-0.0049,0.8321132],[-0.0005988,0.8344908],[0.0069179,0.8296735],[0.0112621,0.8320485],[0.0182618,0.8275166],[0.0226433,0.8298889],[0.0291204,0.8256579],[0.0335336,0.8280275],[0.0394843,0.8241106],[0.0439233,0.8264777],[0.0493458,0.8228859],[0.0538047,0.8252505],[0.0562196,0.8236431],[0.1070009,1.02],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[0.1070009,1.02],[0.0501051,0.8],[-0.0501051,0.8],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[0.1070009,1.02],[0.0501051,0.8],[-0.0501051,0.8],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[0.1070009,1.02],[0.0501051,0.8],[-0.0501051,0.8],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[-0.0562612,0.823804],[-0.0541446,0.8252132],[-0.0496851,0.8228487],[-0.0442812,0.8264287],[-0.0398414,0.8240618],[-0.0339094,0.8279673],[-0.0294952,0.8255978],[-0.0230367,0.8298179],[-0.018654,0.8274457],[-0.0116726,0.8319672],[-0.007327,0.8295923],[0.0001715,0.8343999],[0.0044744,0.8320224],[0.0124822,0.8370983],[0.0167371,0.8347186],[0.025244,0.8400434],[0.029446,0.8376619],[0.0384391,0.8432141],[0.0425834,0.8408313],[0.0520474,0.8465878],[0.0561297,0.8442046],[0.0625276,0.8480344],[0.1070009,1.02],[-0.1070009,1.02]]]],
    [[[[-0.1070009,1.02],[-0.0911977,0.9588933],[-0.0883313,0.9595952],[-0.08688,0.9579932],[-0.0811867,0.9593928],[-0.0797277,0.9577851],[-0.0734349,0.9593339],[-0.0719733,0.9577242],[-0.0650749,0.9594193],[-0.0636158,0.9578112],[-0.0561081,0.9596479],[-0.0546566,0.9580449],[-0.0465383,0.960017],[-0.0450994,0.9584226],[-0.0363716,0.9605219],[-0.0349502,0.9589398],[-0.0256165,0.9611565],[-0.0242174,0.9595902],[-0.0142841,0.961913],[-0.0129119,0.9603661],[-0.0023878,0.9627821],[-0.0010469,0.9612581],[0.0100565,0.9637532],[0.0113618,0.9622557],[0.0230301,0.9648146],[0.0242961,0.963347],[0.036512,0.9659535],[0.037735,0.9645193],[0.0504782,0.9671561],[0.0516551,0.9657587],[0.0649023,0.9684082],[0.06603,0.967051],[0.0797547,0.9696952],[0.0808309,0.9683812],[0.0942954,0.9708711],[0.1070009,1.02],[-0.1070009,1.02]]]],
    [[[[-0.1070009,-1.02],[0.1070009,-1.02],[0.091285,-0.9592307],[0.0895797,-0.9596479],[0.0881303,-0.9580473],[0.0825465,-0.9594193],[0.0810885,-0.9578124],[0.0749065,-0.9593339],[0.073445,-0.9577243],[0.0666583,-0.9593928],[0.0651984,-0.9577841],[0.0578029,-0.9595952],[0.0563497,-0.957991],[0.0483436,-0.9599387],[0.0469021,-0.9583425],[0.0382862,-0.9604191],[0.0368612,-0.9588345],[0.0276386,-0.9610304],[0.026235,-0.9594609],[0.0164115,-0.9617651],[0.015034,-0.9602143],[0.0046178,-0.9626142],[0.0032708,-0.9610857],[-0.007727,-0.9635675],[-0.0090392,-0.9620648],[-0.0206048,-0.9646132],[-0.0218783,-0.9631398],[-0.0339949,-0.9657388],[-0.0352261,-0.9642982],[-0.047874,-0.9669307],[-0.0490595,-0.9655263],[-0.0622159,-0.9681748],[-0.0633529,-0.9668099],[-0.0769919,-0.9694565],[-0.0780777,-0.9681343],[-0.0921702,-0.9707608],[-0.0932027,-0.9694844],[-0.0939722,-0.9696217],[-0.1070009,-1.02]]]],
    [[[[-0.1070009,-1.02],[0.1070009,-1.02],[0.056478,-0.8246424],[0.0559031,-0.8250255],[0.0514406,-0.8226614],[0.046134,-0.8261806],[0.0416901,-0.8238141],[0.0358551,-0.8276605],[0.0314358,-0.8252915],[0.0250739,-0.8294547],[0.020685,-0.8270829],[0.0137994,-0.8315501],[0.0094466,-0.8291757],[0.0020427,-0.8339319],[-0.0022685,-0.8315549],[-0.0101833,-0.8365828],[-0.0144475,-0.8342035],[-0.0228633,-0.8394841],[-0.0270755,-0.8371028],[-0.0359802,-0.8426149],[-0.0401355,-0.8402323],[-0.0495141,-0.845953],[-0.0536081,-0.8435698],[-0.0628004,-0.849089],[-0.1070009,-1.02]]]],
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
