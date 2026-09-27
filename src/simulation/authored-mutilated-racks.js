import * as THREE from 'three';
import { circle, plate, poly, polygonClipping } from './finite-plate-geometry.js';
import { spokedWheelGeometry } from './spoked-wheel.js';
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

  // Brown draws an 18-tooth gear, but his 17 rack teeth run only about 15
  // of that gear's pitches from the open end to the closed end (the seven-
  // and two-tooth groups are drawn at about 17.5 px against 20.3 px). With
  // the gear's size fixed by the rack pitch lines (118 px apart), a
  // 20-tooth gear has the rack pitch (18.3 px) at which Brown's 17 teeth fit
  // his frame, so the frame keeps Brown's length and every tooth engages.
  const pinionTeeth = 20;
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
  // closed end. The gear's tip radius is 3.5 pitches, so teeth within about
  // three pitches of either end cannot mesh unless the gear leaves the open
  // end or crosses the closed end. The stroke therefore spans the two middle
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
  // Brown closes the frame a quarter pitch past the last rack tooth. The
  // closed end is flush with the rails, as drawn, and it stands clear of the
  // gear tips at the stroke limit (0.05 running clearance), so in the front
  // view the gear never crosses it. That clearance, set by the gear's
  // radius, is what still makes the frame longer than Brown's.
  const pinionShaftRadius = 0.06;
  const frameRightBridgeClearance = Math.max(
    circularPitch * 0.25,
    contactCoordinateMaximum + pinionOuterRadius + 0.05 - rackLayoutMaximum,
  );
  // Plate: the closed end is 48 px wide (raster 340...388); the rack pitch
  // lines are 118 px apart, i.e. 59 px per 0.88 pitch radius.
  const rasterPixelsPerUnit = 59 / pinionPitchRadius;
  const frameRightBridgeWidth = 48 / rasterPixelsPerUnit;
  const frameRight = rackLayoutMaximum + frameRightBridgeClearance
    + frameRightBridgeWidth;
  // Plate: the rod leaves the closed end's outer face; it is buried 0.01
  // in the bridge so no end face is coplanar with the bridge's.
  const driveRodStart = frameRight - 0.01;
  // Plate frame half-height is 1.6 gear tip radii (102.5 px vs 64 px).
  const frameOuterHalfHeight = 1.58;
  const frameRailHeight = frameOuterHalfHeight - rackToothRootY;
  const frameRailCenterY = (
    frameOuterHalfHeight + rackToothRootY
  ) / 2;
  const frameDepth = 0.42;
  const frameRightBridgeFront = frameDepth / 2;
  const frameRightBridgeBack = -frameDepth / 2;
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

  // The rails stop a hair inside the closed end's outer face, so the two
  // are not coplanar there.
  const frameRailLength = frameRight - 0.002 - frameLeft;
  const topRail = new THREE.Mesh(
    new THREE.BoxGeometry(
      frameRailLength,
      frameRailHeight,
      frameDepth,
    ),
    driverMaterial,
  );
  topRail.position.set(
    (frameLeft + frameRight - 0.002) / 2,
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
      // A hair inside the rails' outer and front/back faces, so the
      // overlapping faces are not coplanar (no z-fighting).
      frameOuterHalfHeight * 2 - 0.004,
      frameRightBridgeDepth - 0.004,
    ),
    driverMaterial,
  );
  rightBridge.position.set(
    frameRight - frameRightBridgeWidth / 2,
    0,
    (frameRightBridgeFront + frameRightBridgeBack) / 2,
  );
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

  // Brown draws the rod and frame as one outline: the rod is part of the
  // frame and shares its material.
  const driveRod = cylinderAlongX(
    driveRodRadius,
    driveRodLength,
    driverMaterial,
    32,
  );
  const driveRodEnd = frameRight + driveRodLength - 0.04;
  driveRod.scale.y = (driveRodEnd - driveRodStart) / driveRodLength;
  driveRod.position.x = (driveRodStart + driveRodEnd) / 2;
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
    'fixed-axis-complete-twenty-tooth-alternating-output-spur-gear';


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
  // At zero rotation a tooth space faces each rack's pitch line, so the
  // teeth are centred half a pitch either side of the vertical.
  const pinionToothPhase = modulo(
    Math.PI / 2 + pinionAngularPitch / 2,
    pinionAngularPitch,
  );
  const pinionToothMeshes = Array.from({ length: pinionTeeth }, (_, index) => {
    const tooth = new THREE.Mesh(pinionToothGeometry, drivenMaterial);
    tooth.rotation.z = index * pinionAngularPitch + pinionToothPhase;
    tooth.userData.centerAngle = index * pinionAngularPitch + pinionToothPhase;
    tooth.userData.index = index;
    tooth.userData.role = 'working-tooth-of-complete-output-spur-gear';
    return tooth;
  });

  const sourcePinionAngle = profileAtContactCoordinate(
    sourceContactCoordinate,
  ).value;
  const spokeLocalPhase = -sourcePinionAngle;
  // Brown draws the pinion as one flat web: a rim under the teeth and four
  // square quadrant windows between the arms. One plate (spoked-wheel.js),
  // each window two arm edges and an arc concentric with the gear, rounded
  // slightly more at the hub than at the rim; bored for the hub boss.
  const pinionRim = new THREE.Mesh(
    spokedWheelGeometry({
      outerRadius: pinionRootRadius,
      rimInnerRadius: pinionRimInnerRadius,
      spokes: 4,
      spokeWidth: 0.13,
      hubRadius: pinionHubRadius + 0.05,
      rimFillet: 0.02,
      boreRadius: pinionHubRadius,
      thickness: pinionDepth + 0.018,
      phase: spokeLocalPhase,
    }),
    drivenMaterial,
  );
  pinionRim.userData.noRotationIndicator = true;
  pinionRim.userData.role = 'annular-root-rim-of-complete-output-pinion';
  // The arms are part of the one-piece web.
  const pinionSpokes = [];
  // The boss stands proud in front and a little behind the web.
  const pinionHubFront = pinionDepth * 0.71;
  const pinionHubBack = -pinionDepth / 2 - 0.04;
  const pinionHub = cylinderAlongZ(
    pinionHubRadius,
    pinionHubFront - pinionHubBack,
    drivenMaterial,
    32,
  );
  pinionHub.position.z = (pinionHubFront + pinionHubBack) / 2;
  pinionHub.userData.role = 'hub-fixed-to-alternating-output-shaft';
  // The shaft runs back behind the frame (the closed end never reaches it)
  // to the undrawn bearing behind the rack reliefs.
  const pinionShaftFront = 0.43;
  const pinionShaftBack = -0.56;
  const pinionShaft = cylinderAlongZ(
    pinionShaftRadius,
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
  // frame and its rack reliefs so the frame can pass in front of it.
  const bearingZ = -0.5;
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
  signature: "[0.276460153516,0.88,20,0.2,-1.409946782931,1.962867089963,0.154817685969,1,1,0.012,0.002,0.006,0.008]",
  outlines: [
    [[[[-0.0993215,1.02],[0.0993215,1.02],[0.0424256,0.8],[-0.0424256,0.8],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[0.0993215,1.02],[0.0424256,0.8],[-0.0424256,0.8],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[-0.0557429,0.851494],[-0.0540278,0.8504637],[-0.0480564,0.8539758],[-0.0441034,0.8515888],[-0.0375296,0.8554291],[-0.0336035,0.8530425],[-0.0264316,0.8571975],[-0.0225388,0.8548119],[-0.0147758,0.8592653],[-0.0109226,0.8568812],[-0.0025786,0.8616139],[0.001229,0.8592323],[0.0101405,0.8642227],[0.0138969,0.8618445],[0.023359,0.8670686],[0.0270589,0.8646948],[0.0370513,0.8701265],[0.0406898,0.8677583],[0.0511882,0.8733696],[0.0547608,0.8710083],[0.0617366,0.87467],[0.0993215,1.02],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[-0.084509,0.9627242],[-0.0807689,0.9635682],[-0.0794525,0.9620608],[-0.0732672,0.9634599],[-0.0719463,0.9619489],[-0.065087,0.9634991],[-0.0637671,0.9619886],[-0.0562292,0.9636852],[-0.0549158,0.9621795],[-0.0466979,0.9640153],[-0.0453965,0.9625186],[-0.0365007,0.9644846],[-0.0352167,0.963001],[-0.0256485,0.965086],[-0.0243871,0.9636198],[-0.0141556,0.9658105],[-0.0129217,0.9643657],[-0.0020398,0.9666473],[-0.0008382,0.9652281],[0.0106777,0.9675841],[0.0118427,0.9661945],[0.023972,0.9686069],[0.0250962,0.9672509],[0.0378146,0.9697008],[0.0388944,0.9683823],[0.0521732,0.97085],[0.0532054,0.9695727],[0.0670119,0.9720381],[0.0679937,0.9708054],[0.0822908,0.9732482],[0.0832198,0.9720637],[0.0870871,0.9726931],[0.0993215,1.02],[-0.0993215,1.02]]]],
    [[[[-0.0993215,-1.02],[0.0993215,-1.02],[0.0847421,-0.9636255],[0.084477,-0.9636852],[0.0831653,-0.9621814],[0.0773348,-0.9634991],[0.0760157,-0.9619895],[0.069515,-0.9634599],[0.0681939,-0.9619486],[0.0610167,-0.9635682],[0.0596992,-0.9620594],[0.0518423,-0.9638223],[0.0505339,-0.9623203],[0.0419975,-0.9642185],[0.0407037,-0.9627274],[0.0314915,-0.9647507],[0.0302175,-0.9632748],[0.0203369,-0.9654111],[0.0190877,-0.9639544],[0.0085494,-0.9661897],[0.00733,-0.9647565],[-0.0038515,-0.967075],[-0.0050365,-0.9656693],[-0.0168429,-0.968054],[-0.0179892,-0.9666797],[-0.0303981,-0.9691121],[-0.0315019,-0.9677732],[-0.044487,-0.9702339],[-0.0455448,-0.9689343],[-0.0590755,-0.9714034],[-0.0600843,-0.9701466],[-0.0741258,-0.9726039],[-0.0750831,-0.9713934],[-0.087278,-0.9734312],[-0.0993215,-1.02]]]],
    [[[[-0.0993215,-1.02],[0.0993215,-1.02],[0.0558475,-0.8518987],[0.0534098,-0.8533367],[0.0494452,-0.8509498],[0.043191,-0.8546173],[0.0392497,-0.8522305],[0.0323948,-0.8562202],[0.0284835,-0.853834],[0.0210333,-0.8581311],[0.0171583,-0.8557462],[0.0091213,-0.8603331],[0.0052888,-0.8579501],[-0.0033232,-0.8628065],[-0.0071075,-0.8604263],[-0.0162796,-0.8655294],[-0.0200101,-0.8631531],[-0.0297238,-0.868478],[-0.0333954,-0.8661066],[-0.0436284,-0.8716262],[-0.0472365,-0.8692611],[-0.0579627,-0.8749466],[-0.0612432,-0.8727621],[-0.0993215,-1.02]]]],
    [[[[-0.0993215,-1.02],[0.0993215,-1.02],[0.0620298,-0.8758037],[0.0514861,-0.8702455],[0.0478979,-0.8726085],[0.0375136,-0.8670359],[0.0338606,-0.8694055],[0.0239882,-0.8640192],[0.0202748,-0.8663941],[0.0109377,-0.8612215],[0.007169,-0.8636006],[-0.0016133,-0.8586675],[-0.0054319,-0.8610497],[-0.0136432,-0.8563795],[-0.0175061,-0.8587639],[-0.0251339,-0.8543776],[-0.0290349,-0.8567635],[-0.0360697,-0.8526796],[-0.0400026,-0.8550663],[-0.046438,-0.8513005],[-0.0503963,-0.8536874],[-0.0555285,-0.8506649],[-0.0993215,-1.02]]]],
    [[[[-0.0993215,-1.02],[0.0993215,-1.02],[0.0871679,-0.9730057],[0.0796801,-0.9717728],[0.0787387,-0.9729687],[0.064551,-0.9705189],[0.0635574,-0.9717622],[0.0498692,-0.9692944],[0.0488257,-0.9705816],[0.0356731,-0.9681162],[0.0345828,-0.9694436],[0.0219976,-0.9670006],[0.0208636,-0.9683647],[0.0088734,-0.9659637],[0.0076997,-0.9673604],[-0.003672,-0.96502],[-0.0048815,-0.9664455],[-0.0156151,-0.9641834],[-0.0168557,-0.9656334],[-0.0269356,-0.9634658],[-0.0282027,-0.9649364],[-0.0376169,-0.9628777],[-0.0389053,-0.9643646],[-0.0476455,-0.9624277],[-0.0489501,-0.9639268],[-0.0570117,-0.9621223],[-0.058327,-0.9636294],[-0.0657086,-0.961966],[-0.0670292,-0.963477],[-0.0737329,-0.9619612],[-0.0750532,-0.9634718],[-0.0810845,-0.9621079],[-0.082399,-0.9636138],[-0.0846101,-0.9631154],[-0.0993215,-1.02]]]],
    [[[[-0.0993215,1.02],[-0.0871934,0.9731042],[-0.0785947,0.9716834],[-0.0776496,0.9728827],[-0.063496,0.9704311],[-0.0624987,0.9716775],[-0.0488473,0.9692093],[-0.0478005,0.9704994],[-0.0346871,0.9680349],[-0.0335935,0.9693651],[-0.0210496,0.9669244],[-0.0199127,0.9682909],[-0.0079656,0.9658936],[-0.0067891,0.9672925],[0.004538,0.9649571],[0.0057498,0.9663844],[0.0164376,0.9641285],[0.0176802,0.9655802],[0.0277133,0.9634198],[0.028982,0.9648916],[0.0383487,0.9628412],[0.0396385,0.9643291],[0.0483308,0.9624012],[0.0496363,0.9639011],[0.0576497,0.9621063],[0.0589656,0.9636138],[0.0662991,0.9619607],[0.0676198,0.9634718],[0.0742757,0.9619666],[0.0755958,0.963477],[0.0815797,0.962124],[0.0828936,0.9636294],[0.0846412,0.9632356],[0.0993215,1.02],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[-0.0619091,0.8753368],[-0.0613179,0.8757319],[-0.0504824,0.8700124],[-0.0468895,0.8723759],[-0.0365406,0.8668156],[-0.0328832,0.8691856],[-0.0230479,0.8638135],[-0.0193305,0.8661888],[-0.0100321,0.8610324],[-0.0062597,0.8634117],[0.0024826,0.8584964],[0.0063046,0.8608789],[0.014475,0.8562281],[0.0183407,0.8586126],[0.0259268,0.8542472],[0.0298303,0.8566332],[0.0368228,0.8525713],[0.0407578,0.854958],[0.0471506,0.8512152],[0.0511104,0.8536022],[0.0556035,0.8509549],[0.0993215,1.02],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[0.0993215,1.02],[0.0424256,0.8],[-0.0424256,0.8],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[0.0993215,1.02],[0.0424256,0.8],[-0.0424256,0.8],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[0.0993215,1.02],[0.0424256,0.8],[-0.0424256,0.8],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[-0.0554707,0.8504414],[-0.0553011,0.8503396],[-0.0494098,0.8538073],[-0.0454538,0.8514204],[-0.0389598,0.8552178],[-0.0350297,0.8528311],[-0.0279368,0.8569453],[-0.0240392,0.8545594],[-0.0163542,0.8589743],[-0.0124953,0.85659],[-0.0042278,0.8612868],[-0.0004138,0.8589048],[0.0084232,0.8638623],[0.0121868,0.8614836],[0.0215769,0.8666781],[0.0252846,0.8643037],[0.035208,0.8697094],[0.0388549,0.8673404],[0.0492876,0.8729296],[0.0528692,0.8705672],[0.0619053,0.8753221],[0.0993215,1.02],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[-0.0845674,0.96295],[-0.0817135,0.9635936],[-0.0803982,0.962087],[-0.0743018,0.9634658],[-0.0729812,0.961955],[-0.0662117,0.9634854],[-0.0648913,0.9619746],[-0.0574436,0.9636521],[-0.0561291,0.9621455],[-0.0480013,0.9639634],[-0.0466981,0.9624652],[-0.0378919,0.9644146],[-0.0366054,0.962929],[-0.0271259,0.9649989],[-0.0258612,0.9635301],[-0.0157171,0.9657076],[-0.0144793,0.9642598],[-0.0036828,0.9665302],[-0.0024766,0.9651074],[0.0089562,0.9674545],[0.0101262,0.9660607],[0.0221755,0.9684667],[0.0233053,0.967106],[0.0359471,0.9695521],[0.037033,0.9682284],[0.0502392,0.9706949],[0.0512779,0.9694119],[0.0650164,0.9718788],[0.066005,0.97064],[0.0802393,0.9730869],[0.0811755,0.9718958],[0.0871334,0.972872],[0.0993215,1.02],[-0.0993215,1.02]]]],
    [[[[-0.0993215,-1.02],[0.0993215,-1.02],[0.0846839,-0.9634007],[0.083568,-0.9636521],[0.082255,-0.9621473],[0.0763361,-0.9634854],[0.0750164,-0.9619753],[0.0684262,-0.9634658],[0.0671053,-0.9619546],[0.0598379,-0.9635936],[0.0585213,-0.9620855],[0.0505742,-0.9638668],[0.0492674,-0.962366],[0.0406411,-0.9642814],[0.0393495,-0.9627921],[0.0300482,-0.9648312],[0.0287772,-0.9633576],[0.0188086,-0.9655079],[0.0175631,-0.9640541],[0.0069385,-0.9663014],[0.0057235,-0.9648715],[-0.0055422,-0.9671999],[-0.0067222,-0.965798],[-0.01861,-0.9681901],[-0.0197509,-0.9668203],[-0.0322378,-0.9692576],[-0.0333358,-0.9679237],[-0.046395,-0.9703868],[-0.0474466,-0.9690926],[-0.0610471,-0.9715613],[-0.0620493,-0.9703105],[-0.0761557,-0.9727647],[-0.077106,-0.9715606],[-0.0872289,-0.9732412],[-0.0993215,-1.02]]]],
    [[[[-0.0993215,-1.02],[0.0993215,-1.02],[0.0557067,-0.8513541],[0.0520873,-0.8534877],[0.0481254,-0.8511007],[0.0417912,-0.8548118],[0.0378536,-0.852425],[0.0309192,-0.8564564],[0.0270124,-0.8540703],[0.0194837,-0.858407],[0.015614,-0.8560222],[0.0075,-0.8606462],[0.0036735,-0.8582635],[-0.0050137,-0.863154],[-0.0087912,-0.8607743],[-0.0180363,-0.8659083],[-0.0217593,-0.8635326],[-0.0315432,-0.8688849],[-0.0352067,-0.8665143],[-0.0455067,-0.8720576],[-0.0491061,-0.8696933],[-0.0598955,-0.8753987],[-0.0616263,-0.8742436],[-0.0993215,-1.02]]]],
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
  // The web keeps its spoked outline, unbevelled at the teeth's depth.
  const web = b.pinionRim.geometry.userData.spokedWheel;
  b.pinionRim.geometry.dispose();
  b.pinionRim.geometry = spokedWheelGeometry({
    ...web, outline: undefined, outerRadius: gearRoot, rimInnerRadius: g.pinionRimInnerRadius,
    hubFillet: web.hubFillet ?? undefined, hubArcRadius: web.hubArcRadius ?? undefined,
    thickness: g.pinionDepth, arcSegments: 192,
  });

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
