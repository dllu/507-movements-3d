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
  // his frame. The frame is then lengthened by the three handoff gaps below.
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
  // Brown's groups abut, so the reversing gear would have to turn back
  // while meshed with both racks and his handoff teeth would jam. A short
  // two-pitch toothless gap between successive groups (the frame lengthened
  // by three gaps) lets the gear reverse between the groups: eleven teeth
  // stay full and the six beside the gaps keep 0.11-0.13 of their 0.20
  // height (with abutting groups six were 0.02-0.04 stubs and six more cut).
  const handoffGap = 2 * circularPitch;
  const rackLayoutLength = installedRackToothCount * circularPitch
    + (rackGroupSpecifications.length - 1) * handoffGap;
  const rackLayoutMinimum = -rackLayoutLength / 2;
  const rackLayoutMaximum = rackLayoutLength / 2;
  // The gear reverses across exactly the gap (a quintic from the last upper
  // conjugate position to the first lower one): a pitch sweep (gaps 1–3,
  // half-widths 0.75–2 pitches) found this the least relief for its length.
  const handoffHalfWidth = handoffGap / 2;
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
  const sourceContactCoordinate = rackLayoutMinimum + 11 * circularPitch
    + 2 * handoffGap;
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
    groupStart = groupEnd + handoffGap;
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
    const center = (group.end + nextGroup.start) / 2;
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
      tooth.position.x = group.start
        + (groupToothIndex + 0.5) * circularPitch;
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
  // Pass 104: fit the frame, rod and collar over the whole stroke (root
  // scale 0.92): the closed end at the left stroke limit to the rod's end
  // at the right one, so the input rod and collar never leave the view.
  const frameSweepMinimumX = 0.92 * (frameLeft - contactCoordinateMaximum) - 0.01;
  const frameSweepMaximumX = 0.92 * (driveRodEnd - contactCoordinateMinimum) + 0.01;
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
    handoffGap,
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
  signature: "[0.276460153516,0.88,20,0.2,-2.239327243479,2.792247550511,0.276460153516,0.552920307032,1,1,0.012,0.002,0.006,0.008]",
  outlines: [
    [[[[-0.0993215,1.02],[0.0993215,1.02],[0.0424256,0.8],[-0.0424256,0.8],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[0.0993215,1.02],[0.0424256,0.8],[-0.0424256,0.8],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[0.0993215,1.02],[0.0424256,0.8],[-0.0424256,0.8],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[-0.0618544,0.8751256],[-0.0586155,0.8768253],[-0.0551104,0.8744701],[-0.0514071,0.8764177],[-0.0478925,0.8740607],[-0.0438536,0.8761873],[-0.0403331,0.873829],[-0.0359546,0.8761352],[-0.0324319,0.8737761],[-0.0277099,0.8762615],[-0.0241888,0.873902],[-0.0191197,0.8765657],[-0.0156039,0.8742063],[-0.0101848,0.8770466],[-0.006678,0.8746878],[-0.0009061,0.8777023],[0.0025881,0.8753446],[0.0087151,0.8785302],[0.0121928,0.8761742],[0.0186768,0.8795271],[0.0221346,0.8771733],[0.028977,0.8806888],[0.0324112,0.878338],[0.039613,0.882011],[0.0430201,0.8796637],[0.0505819,0.8834883],[0.0539584,0.8811453],[0.0618801,0.8851149],[0.064046,0.8835999],[0.0993215,1.02],[-0.0993215,1.02]]]],
    [[[[-0.0993215,-1.02],[0.0993215,-1.02],[0.0622511,-0.8766594],[0.0615123,-0.8770466],[0.0580122,-0.8746924],[0.0544472,-0.8765657],[0.0509361,-0.8742094],[0.0470374,-0.8762615],[0.0435189,-0.8739037],[0.0392821,-0.8761352],[0.0357599,-0.8737764],[0.0311812,-0.8761873],[0.027659,-0.8738279],[0.0227346,-0.8764177],[0.0192162,-0.8740581],[0.013943,-0.8768253],[0.010432,-0.8744661],[0.0048071,-0.8774085],[0.0013073,-0.8750503],[-0.0046718,-0.8781652],[-0.0081568,-0.8758084],[-0.0144921,-0.8790922],[-0.0179586,-0.8767374],[-0.0246518,-0.8801859],[-0.0280962,-0.8778337],[-0.0351485,-0.8814419],[-0.0385673,-0.879093],[-0.0459793,-0.8828554],[-0.0493689,-0.8805105],[-0.057141,-0.8844206],[-0.060498,-0.8820805],[-0.0641197,-0.8838847],[-0.0993215,-1.02]]]],
    [[[[-0.0993215,-1.02],[0.0993215,-1.02],[0.0424256,-0.8],[-0.0424256,-0.8],[-0.0993215,-1.02]]]],
    [[[[-0.0993215,-1.02],[0.0993215,-1.02],[0.0424256,-0.8],[-0.0424256,-0.8],[-0.0993215,-1.02]]]],
    [[[[-0.0993215,-1.02],[0.0993215,-1.02],[0.0640357,-0.8835599],[0.0612985,-0.8821973],[0.0579439,-0.8845371],[0.0501464,-0.8806167],[0.046759,-0.8829613],[0.0393215,-0.8791883],[0.0359046,-0.8815369],[0.0288269,-0.8779176],[0.0253842,-0.8802695],[0.0186656,-0.8768096],[0.0152005,-0.8791642],[0.0088399,-0.8758686],[0.0053561,-0.8782253],[-0.0006481,-0.8750983],[-0.0041471,-0.8774565],[-0.009797,-0.8745017],[-0.0133073,-0.8768608],[-0.0186053,-0.8740812],[-0.0221233,-0.8764407],[-0.0270723,-0.8738383],[-0.0305943,-0.8761978],[-0.0351974,-0.8737741],[-0.0387197,-0.8761331],[-0.0429806,-0.8738888],[-0.0464995,-0.8762467],[-0.050422,-0.8741819],[-0.0539338,-0.8765384],[-0.0575223,-0.8746524],[-0.0610232,-0.8770068],[-0.0621836,-0.8763985],[-0.0993215,-1.02]]]],
    [[[[-0.0993215,1.02],[-0.0638958,0.883019],[-0.0610692,0.8849949],[-0.0531729,0.8810354],[-0.0497942,0.8833787],[-0.0422579,0.8795646],[-0.0388488,0.8819122],[-0.0316724,0.8782501],[-0.0282364,0.8806012],[-0.0214194,0.877097],[-0.0179601,0.879451],[-0.0115015,0.8761098],[-0.0080224,0.878466],[-0.0019206,0.8752924],[0.0015745,0.8776502],[0.0073214,0.8746479],[0.0108289,0.8770068],[0.0162232,0.8741789],[0.0197395,0.8765384],[0.0247838,0.8738872],[0.0283052,0.8762467],[0.0330028,0.8737739],[0.0365254,0.8761331],[0.0408798,0.8738395],[0.0444,0.8761978],[0.0484149,0.8740838],[0.051929,0.8764407],[0.0556087,0.8745058],[0.0591129,0.8768608],[0.061922,0.875387],[0.0993215,1.02],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[0.0993215,1.02],[0.0424256,0.8],[-0.0424256,0.8],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[0.0993215,1.02],[0.0424256,0.8],[-0.0424256,0.8],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[0.0993215,1.02],[0.0424256,0.8],[-0.0424256,0.8],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[0.0993215,1.02],[0.0424256,0.8],[-0.0424256,0.8],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[0.0993215,1.02],[0.0424256,0.8],[-0.0424256,0.8],[-0.0993215,1.02]]]],
    [[[[-0.0993215,1.02],[-0.0622005,0.8764636],[-0.0611454,0.8770167],[-0.0576447,0.8746623],[-0.0540621,0.8765451],[-0.0505505,0.8741887],[-0.0466339,0.8762503],[-0.0431151,0.8738924],[-0.0388602,0.8761335],[-0.0353379,0.8737746],[-0.0307409,0.8761951],[-0.0272188,0.8738356],[-0.022276,0.8764349],[-0.0187579,0.8740753],[-0.0134661,0.8768519],[-0.0099556,0.8744927],[-0.0043119,0.8774444],[-0.0008128,0.8750862],[0.0051852,0.8782102],[0.0086693,0.8758535],[0.0150236,0.8791461],[0.018489,0.8767915],[0.0252012,0.8802486],[0.0286444,0.8778966],[0.0357158,0.8815131],[0.0391331,0.8791644],[0.0465643,0.8829348],[0.0499523,0.8805901],[0.0577434,0.8845079],[0.0610986,0.8821681],[0.0640566,0.8836409],[0.0993215,1.02],[-0.0993215,1.02]]]],
    [[[[-0.0993215,-1.02],[0.0993215,-1.02],[0.0619052,-0.8753218],[0.058989,-0.8768519],[0.0554845,-0.8744968],[0.0517989,-0.8764349],[0.0482847,-0.874078],[0.0442638,-0.8761951],[0.0407435,-0.8738368],[0.0363831,-0.8761335],[0.0328605,-0.8737744],[0.0281568,-0.8762503],[0.0246355,-0.8738908],[0.019585,-0.8765451],[0.0160688,-0.8741856],[0.0106683,-0.8770167],[0.007161,-0.8746578],[0.0014079,-0.8776631],[-0.002087,-0.8753054],[-0.0081951,-0.878482],[-0.0116738,-0.8761258],[-0.0181388,-0.8794699],[-0.0215977,-0.877116],[-0.0284211,-0.880623],[-0.0318566,-0.878272],[-0.0390393,-0.8819368],[-0.0424479,-0.8795893],[-0.0499906,-0.883406],[-0.0533688,-0.8810627],[-0.0612714,-0.8850248],[-0.0639332,-0.8831638],[-0.0993215,-1.02]]]],
    [[[[-0.0993215,-1.02],[0.0993215,-1.02],[0.0424256,-0.8],[-0.0424256,-0.8],[-0.0993215,-1.02]]]],
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
    g.contactCoordinateMinimum, g.contactCoordinateMaximum, g.handoffHalfWidth, g.handoffGap,
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
  // Every rack tooth is one full-depth extrusion of its relieved outline.
  // The relief is cut in the plane only (no depth-split webs or backing
  // strips): the handoff teeth show honestly shortened flanks where the
  // reversing pinion sweeps through them.
  // The swept relief itself is ragged. Each relieved tooth is instead
  // Brown's straight-flanked tooth with its tip cut by one straight chamfer
  // line: the largest such tooth lying wholly inside its relieved outline,
  // so it keeps the same in-plane clearance from the reversing pinion.
  const area = (polygons) => polygons.reduce((sum, polygon) => sum + polygon.reduce((ringSum, ring, ringIndex) => {
    let a = 0;
    for (let i = 0; i < ring.length - 1; i += 1) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    return ringSum + (ringIndex ? -1 : 1) * Math.abs(a / 2);
  }, 0), 0);
  const toothHeights = [];
  b.rackTeeth.forEach((tooth, index) => {
    const side = tooth.userData.rack === 'upper' ? 1 : -1;
    const rootY = g.rackToothRootY + 0.02;
    const nominal = poly(straightRackTooth({
      x: 0, side, pitchY: g.pinionPitchRadius, rootY,
      tipY: g.rackToothRootY - g.pinionToothHeight, circularPitch: g.circularPitch, backlash: g.toothBacklash,
    }));
    // Chamfered tooth: the nominal tooth below the line through heights
    // left and right (measured from the rail face) at x = -/+ w.
    const w = g.circularPitch / 2;
    const chamfered = (left, right) => polygonClipping.intersection(nominal, poly([
      [-w, side * rootY], [w, side * rootY],
      [w, side * (g.rackToothRootY - right)], [-w, side * (g.rackToothRootY - left)],
    ]));
    const inside = (candidate) => area(polygonClipping.difference(candidate, outlines[index])) < 1e-7;
    let shape = nominal;
    let height = [g.pinionToothHeight, g.pinionToothHeight];
    if (outlines[index].flat(2).length > 5) {
      reliefCount += 1;
      let best = null;
      for (let k = -12; k <= 12; k += 1) {
        const slope = k * 0.05;
        // Heights at -w and +w are h - slope w and h + slope w.
        let low = 0;
        let high = 0.4;
        for (let step = 0; step < 20; step += 1) {
          const middle = (low + high) / 2;
          if (inside(chamfered(middle - slope * w, middle + slope * w))) low = middle; else high = middle;
        }
        const candidate = chamfered(low - slope * w, low + slope * w);
        const candidateArea = area(candidate);
        if (!best || candidateArea > best.area) best = { area: candidateArea, shape: candidate, height: [low - slope * w, low + slope * w] };
      }
      shape = best.shape;
      height = best.height.map((value) => Math.min(g.pinionToothHeight, Math.max(0, value)));
    }
    toothHeights.push(height.map((value) => Number(value.toFixed(4))));
    tooth.userData.reliefChamferHeights = height;
    tooth.geometry = plate(shape, -g.rackDepth / 2, g.rackDepth / 2);
  });
  d.computeRackReliefOutlines = computeOutlines;
  d.rackReliefOutlines = outlines;
  d.rackReliefSignature = reliefSignature;
  d.conjugateTeeth = {
    addendum,
    rackTeethRelieved: reliefCount,
    rackToothWorkingHeights: toothHeights,
    bakedRelief: Boolean(baked),
    reliefClearance,
    reliefTrigger,
    toothProfile: 'Brown-style tapered teeth: 14.5-degree involute pinion and straight-flanked rack, conjugate in rolling; each rack tooth the reversing pinion sweeps at a handoff keeps Brown’s flanks with its tip cut by one straight chamfer inside its swept relief, one full-depth extrusion with no depth-split webs',
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
