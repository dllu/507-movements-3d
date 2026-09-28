import {correctGasMeterParts} from './gas-meter-working-parts.js';
import {capsule, circle, plate, poly, polygonClipping} from './finite-plate-geometry.js';
import {curvedPipeWall, mergePassageParts} from './finite-fluid-passages.js';
import {latheSectionGeometry} from './cutaway-section.js';
import {horizontalPlate, horizontalRing} from './horizontal-turbine-solids.js';
import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

// Brown covers the regulator with a round domed lid whose edge laps down
// over the case wall, the rod of cup H rising through its crown into a
// turned knob. The lid is one solid of revolution about the case axis,
// bored for the rod, seated on the top of the case wall.
function addDomedCover(root, material, rodX, round) {
  const baseY = round.caseTop;
  const outer = { rx: round.caseOuter + 0.12, ry: 0.78 };
  const inner = { rx: round.caseOuter - 0.06, ry: 0.60 };
  // The bore is a running fit on the 0.075 rod, which it guides.
  const hole = 0.079;
  const lap = 0.18;
  const arc = ({ rx, ry }, from, to, count = 64) => Array.from({ length: count + 1 }, (_, i) => {
    const r = from + (to - from) * i / count;
    return [r, baseY + ry * Math.sqrt(Math.max(0, 1 - (r / rx) ** 2))];
  });
  const profile = [
    ...arc(inner, hole, inner.rx),
    [round.caseOuter, baseY], [round.caseOuter, baseY - lap],
    [outer.rx, baseY - lap],
    ...arc(outer, outer.rx, hole),
  ];
  const cover = new THREE.Group();
  const shell = new THREE.Mesh(latheSectionGeometry(profile, { phiStart: 0, phiLength: FULL_TURN, segments: 192 }), material);
  shell.userData.role = 'round-domed-lid-shell';
  cover.add(shell);
  cover.userData.role = 'fixed-domed-cover-with-rod-knob';
  const crownOuter = baseY + outer.ry * Math.sqrt(Math.max(0, 1 - (rodX / outer.rx) ** 2));
  const knobTop = crownOuter + 0.30;
  const knob = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(hole, crownOuter - 0.01),
    new THREE.Vector2(0.20, crownOuter - 0.01),
    new THREE.Vector2(0.20, knobTop - 0.10),
    new THREE.Vector2(0.10, knobTop),
    new THREE.Vector2(hole, knobTop),
    new THREE.Vector2(hole, crownOuter - 0.01),
  ], 48), material);
  knob.position.x = rodX;
  knob.userData.role = 'fixed-turned-knob-on-cover-crown';
  cover.add(knob);
  root.add(cover);
  root.userData.blocks.domedCover = cover;
}

function cylinderBetween(start, end, radius, material, role, sides = 24) {
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), sides),
    material,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  mesh.userData.role = role;
  return mesh;
}

function setUnitCylinderBetween(mesh, start, end) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.set(1, length, 1);
  if (length > 1e-12) {
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.multiplyScalar(1 / length),
    );
  }
}

function triangularNotchPlane({
  center,
  halfWidth,
  bottomY,
  apexY,
  z,
  material,
  role,
  reverse = false,
}) {
  const geometry = new THREE.BufferGeometry();
  const zOffset = reverse ? -z : z;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    center - halfWidth, bottomY, zOffset,
    center + halfWidth, bottomY, zOffset,
    center, apexY, zOffset,
  ], 3));
  geometry.setIndex(reverse ? [0, 2, 1] : [0, 1, 2]);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.role = role;
  return mesh;
}

function notchedSkirtFace({
  apexY,
  bottomY,
  faceOffset,
  halfWidth,
  material,
  notchHalfWidth,
  role,
  rotationY = 0,
  topY,
}) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, bottomY);
  shape.lineTo(-halfWidth, topY);
  shape.lineTo(halfWidth, topY);
  shape.lineTo(halfWidth, bottomY);
  shape.lineTo(notchHalfWidth, bottomY);
  shape.lineTo(0, apexY);
  shape.lineTo(-notchHalfWidth, bottomY);
  shape.closePath();
  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    material,
  );
  mesh.position.set(
    Math.sin(rotationY) * faceOffset,
    0,
    Math.cos(rotationY) * faceOffset,
  );
  mesh.rotation.y = rotationY;
  mesh.userData.role = role;
  return mesh;
}

function powersMercuryRegulator(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8;
  const angularFrequencyRadianPerSecond = FULL_TURN / cycleDuration;

  // A quasi-static operating point makes Brown's qualitative feedback
  // explicit. Brown gives no dimensions, pressure, flow, or timing values.
  const targetOutletGaugePressurePascal = 1200;
  const inletPressureMeanAboveTargetPascal = 1600;
  const inletPressureAmplitudePascal = 650;
  const meanDemandFlowCubicMetrePerSecond = 0.018;
  const demandFlowAmplitudeCubicMetrePerSecond = 0.005;
  const demandPhaseRadian = -0.60;
  const gasDensityKilogramPerCubicMetre = 0.80;
  const dischargeCoefficient = 0.72;
  const notchCount = 4;
  const notchMaximumWidthMetre = 0.025;
  const notchMaximumHeightMetre = 0.015;
  const nominalNotchExposedHeightMetre = 0.0108;
  const notchHeightFeedbackMetrePerPascal = 2.4e-5;
  const minimumNotchExposedHeightMetre = 0.001;
  const valveMotionDisplayScaleSceneUnitPerMetre = 70;
  const leverCupArmSceneUnit = 1.00;
  const leverValveArmSceneUnit = 0.75;
  const leverMotionRatio = leverValveArmSceneUnit
    / leverCupArmSceneUnit;
  const cupHEffectiveAreaSquareMetre = 0.085;
  const valveDEffectiveAreaSquareMetre = 0.0125;
  const mercuryDensityKilogramPerCubicMetre = 13546;
  const gravityMetrePerSecondSquared = 9.80665;
  const baseCupHImmersionMetre = 0.022;
  const baseValveDImmersionMetre = 0.026;
  const markerPacketVolumeCubicMetre = 0.004;

  const triangularNotchArea = (height) => notchCount * 0.5
    * (notchMaximumWidthMetre / notchMaximumHeightMetre)
    * height ** 2;
  const nominalValveOpenAreaSquareMetre = triangularNotchArea(
    nominalNotchExposedHeightMetre,
  );
  const notchHeightAtPressure = (outletPressure) =>
    THREE.MathUtils.clamp(
      nominalNotchExposedHeightMetre
        - notchHeightFeedbackMetrePerPascal
          * (outletPressure - targetOutletGaugePressurePascal),
      minimumNotchExposedHeightMetre,
      notchMaximumHeightMetre,
    );
  const valveAreaAtPressure = (outletPressure) =>
    triangularNotchArea(notchHeightAtPressure(outletPressure));
  const valveFlowAtPressures = (inletPressure, outletPressure) =>
    dischargeCoefficient * valveAreaAtPressure(outletPressure)
      * Math.sqrt(Math.max(
        0,
        2 * (inletPressure - outletPressure)
          / gasDensityKilogramPerCubicMetre,
      ));

  const solveOutletPressure = (inletPressure, demandedFlow) => {
    let lowerPressure = targetOutletGaugePressurePascal - 500;
    let upperPressure = Math.min(
      targetOutletGaugePressurePascal + 500,
      inletPressure - 1,
    );
    for (let iteration = 0; iteration < 72; iteration += 1) {
      const pressure = (lowerPressure + upperPressure) / 2;
      if (valveFlowAtPressures(inletPressure, pressure) > demandedFlow) {
        lowerPressure = pressure;
      } else {
        upperPressure = pressure;
      }
    }
    return (lowerPressure + upperPressure) / 2;
  };

  // The lever works in a plane just in front of valve D (front face z 0.60):
  // its bored stand and the pin seats of H and D sit at z 0.61-0.73, the lever
  // at 0.74-0.88, clear of both D and the front skirt of H (z 0.90).
  const leverPivot = new THREE.Vector3(0.25, 0.95, 0.81);
  const cupConnectorX = -0.90;
  const valveCenterX = 1.0;
  const innerMercurySurfaceY = -0.33;
  const valveNotchApexLocalY = innerMercurySurfaceY
    + nominalNotchExposedHeightMetre
      * valveMotionDisplayScaleSceneUnitPerMetre;
  const valveNotchBottomLocalY = -0.76;

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    const phaseAngle = FULL_TURN * phase;
    const inletGaugePressurePascal = targetOutletGaugePressurePascal
      + inletPressureMeanAboveTargetPascal
      + inletPressureAmplitudePascal * Math.sin(phaseAngle);
    const demandedFlowCubicMetrePerSecond =
      meanDemandFlowCubicMetrePerSecond
      + demandFlowAmplitudeCubicMetrePerSecond
        * Math.sin(phaseAngle + demandPhaseRadian);
    const outletGaugePressurePascal = solveOutletPressure(
      inletGaugePressurePascal,
      demandedFlowCubicMetrePerSecond,
    );
    const pressureErrorPascal = outletGaugePressurePascal
      - targetOutletGaugePressurePascal;
    const notchExposedHeightMetre = notchHeightAtPressure(
      outletGaugePressurePascal,
    );
    const valveOpenAreaSquareMetre = triangularNotchArea(
      notchExposedHeightMetre,
    );
    const regulatedFlowCubicMetrePerSecond = valveFlowAtPressures(
      inletGaugePressurePascal,
      outletGaugePressurePascal,
    );
    const valveDepressionMetre = nominalNotchExposedHeightMetre
      - notchExposedHeightMetre;
    const valveDepressionSceneUnit = valveDepressionMetre
      * valveMotionDisplayScaleSceneUnitPerMetre;
    const valveVerticalDisplacementSceneUnit = -valveDepressionSceneUnit;
    const cupHLiftSceneUnit = valveDepressionSceneUnit
      / leverMotionRatio;
    const cupHPhysicalLiftMetre = cupHLiftSceneUnit
      / valveMotionDisplayScaleSceneUnitPerMetre;
    const leverAngleRadian = -Math.asin(
      THREE.MathUtils.clamp(
        cupHLiftSceneUnit / leverCupArmSceneUnit,
        -1,
        1,
      ),
    );
    const leverCupEndpoint = new THREE.Vector3(
      leverPivot.x - leverCupArmSceneUnit * Math.cos(leverAngleRadian),
      leverPivot.y - leverCupArmSceneUnit * Math.sin(leverAngleRadian),
      leverPivot.z,
    );
    const leverValveEndpoint = new THREE.Vector3(
      leverPivot.x
        + leverValveArmSceneUnit * Math.cos(leverAngleRadian),
      leverPivot.y
        + leverValveArmSceneUnit * Math.sin(leverAngleRadian),
      leverPivot.z,
    );
    const cupHImmersionMetre = baseCupHImmersionMetre
      - cupHPhysicalLiftMetre;
    const valveDImmersionMetre = baseValveDImmersionMetre
      + valveDepressionMetre;
    const outletPressureSealCapacityPascal = mercuryDensityKilogramPerCubicMetre
      * gravityMetrePerSecondSquared * cupHImmersionMetre;
    const valveDifferentialSealCapacityPascal =
      mercuryDensityKilogramPerCubicMetre
      * gravityMetrePerSecondSquared * valveDImmersionMetre;
    const effectiveCupRestoringStiffnessNewtonPerMetre =
      cupHEffectiveAreaSquareMetre
      / (notchHeightFeedbackMetrePerPascal / leverMotionRatio);
    const cupPressureForceNewton = pressureErrorPascal
      * cupHEffectiveAreaSquareMetre;
    const cupRestoringForceNewton =
      effectiveCupRestoringStiffnessNewtonPerMetre
      * cupHPhysicalLiftMetre;
    const cumulativeDemandVolumeCubicMetre =
      meanDemandFlowCubicMetrePerSecond * time
      + demandFlowAmplitudeCubicMetrePerSecond
        / angularFrequencyRadianPerSecond
        * (
          Math.cos(demandPhaseRadian)
          - Math.cos(
            angularFrequencyRadianPerSecond * time
              + demandPhaseRadian,
          )
        );
    return {
      cumulativeDemandVolumeCubicMetre,
      cupHImmersionMetre,
      cupHLiftSceneUnit,
      cupHPhysicalLiftMetre,
      cupPressureForceNewton,
      cupRestoringForceNewton,
      cycleTime,
      demandedFlowCubicMetrePerSecond,
      flowBalanceResidualCubicMetrePerSecond:
        regulatedFlowCubicMetrePerSecond
          - demandedFlowCubicMetrePerSecond,
      inletGaugePressurePascal,
      leverAngleRadian,
      leverCupEndpoint,
      leverValveEndpoint,
      markerTravelTurns: cumulativeDemandVolumeCubicMetre
        / markerPacketVolumeCubicMetre,
      notchExposedHeightMetre,
      outletGaugePressurePascal,
      outletPressureSealCapacityPascal,
      phase,
      pressureErrorPascal,
      regulatedFlowCubicMetrePerSecond,
      valveDImmersionMetre,
      valveDepressionMetre,
      valveDepressionSceneUnit,
      valveDifferentialSealCapacityPascal,
      valveOpenAreaSquareMetre,
      valveVerticalDisplacementSceneUnit,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.25,
    roughness: 0.46,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.31,
    roughness: 0.40,
  });
  const housingMaterial = matte(PALETTE.frame, {
    metalness: 0.16,
    opacity: 0.17,
    roughness: 0.42,
    side: THREE.DoubleSide,
    transparent: true,
  });
  housingMaterial.depthWrite = false;
  const cupMaterial = matte(PALETTE.driven, {
    metalness: 0.19,
    opacity: 0.57,
    roughness: 0.35,
    side: THREE.DoubleSide,
    transparent: true,
  });
  cupMaterial.depthWrite = false;
  const valveMaterial = matte(PALETTE.accent, {
    metalness: 0.25,
    roughness: 0.39,
    side: THREE.DoubleSide,
  });
  const leverMaterial = matte(PALETTE.driver, {
    metalness: 0.24,
    roughness: 0.42,
  });
  const mercuryMaterial = matte(PALETTE.muted, {
    metalness: 0.82,
    opacity: 0.84,
    roughness: 0.17,
    transparent: true,
  });
  mercuryMaterial.depthWrite = false;
  const gasMaterial = matte(PALETTE.driver, {
    opacity: 0.14,
    roughness: 0.24,
    side: THREE.DoubleSide,
    transparent: true,
  });
  gasMaterial.depthWrite = false;
  const markerMaterial = matte(PALETTE.white, {
    opacity: 0.94,
    roughness: 0.22,
    transparent: true,
  });
  markerMaterial.depthWrite = false;

  const fixedHousing = new THREE.Group();
  fixedHousing.userData.role = 'fixed-pressure-regulator-housing';
  const housingShell = new THREE.Mesh(
    new THREE.BoxGeometry(5.70, 3.75, 1.78),
    housingMaterial,
  );
  housingShell.position.y = 0.02;
  housingShell.userData.role = 'transparent-fixed-outer-case';
  const housingFloor = new THREE.Mesh(
    new THREE.BoxGeometry(5.72, 0.20, 1.82),
    frameMaterial,
  );
  housingFloor.position.y = -1.88;
  housingFloor.userData.role = 'fixed-regulator-case-floor';
  const housingRoof = new THREE.Mesh(
    new THREE.BoxGeometry(5.45, 0.18, 1.66),
    frameMaterial,
  );
  housingRoof.position.y = 1.90;
  housingRoof.userData.role = 'fixed-domed-case-roof-reconstruction';
  const housingPosts = [-1, 1].map((side, index) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 3.68, 1.72),
      frameMaterial,
    );
    post.position.set(side * 2.76, 0, 0);
    post.userData.role = `fixed-side-wall-${index + 1}`;
    fixedHousing.add(post);
    return post;
  });
  fixedHousing.add(housingShell, housingFloor, housingRoof);
  root.add(fixedHousing);

  const inletPipeE = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 2.28, 36),
    frameMaterial,
  );
  inletPipeE.position.set(valveCenterX, -1.28, 0);
  inletPipeE.userData.role = 'fixed-vertical-inlet-pipe-E';
  const inletFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.47, 0.47, 0.24, 40),
    darkMaterial,
  );
  inletFlange.position.set(valveCenterX, -2.34, 0);
  inletFlange.userData.role = 'fixed-bottom-inlet-flange-E';
  root.add(inletPipeE, inletFlange);

  const outletPipeF = cylinderBetween(
    new THREE.Vector3(-3.22, -0.69, 0),
    new THREE.Vector3(-2.38, -0.69, 0),
    0.27,
    frameMaterial,
    'fixed-left-outlet-F-to-burners',
    36,
  );
  const outletFlangeF = cylinderBetween(
    new THREE.Vector3(-3.30, -0.69, 0),
    new THREE.Vector3(-3.08, -0.69, 0),
    0.40,
    darkMaterial,
    'fixed-outlet-flange-F',
    36,
  );
  root.add(outletPipeF, outletFlangeF);

  const outerMercuryChannels = [-1, 1].map((side, index) => {
    const channel = new THREE.Group();
    channel.userData.role =
      `outer-quicksilver-channel-sealing-cup-H-${index + 1}`;
    const trough = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.75, 1.42),
      darkMaterial,
    );
    trough.position.set(side * 2.08, -0.54, 0);
    const mercury = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.45, 1.23),
      mercuryMaterial,
    );
    mercury.position.set(side * 2.08, -0.43, 0);
    mercury.userData.role =
      `quicksilver-volume-for-cup-H-rim-${index + 1}`;
    channel.add(trough, mercury);
    root.add(channel);
    return { channel, mercury, trough };
  });

  const innerMercuryChannel = new THREE.Group();
  innerMercuryChannel.userData.role =
    'inner-quicksilver-channel-forming-seat-for-valve-D';
  const innerMercuryBlocks = [];
  for (const side of [-1, 1]) {
    const mercury = new THREE.Mesh(
      new THREE.BoxGeometry(0.30, 0.43, 1.08),
      mercuryMaterial,
    );
    mercury.position.set(valveCenterX + side * 0.58, -0.50, 0);
    mercury.userData.role = side < 0
      ? 'left-quicksilver-seat-volume-for-D'
      : 'right-quicksilver-seat-volume-for-D';
    innerMercuryChannel.add(mercury);
    innerMercuryBlocks.push(mercury);
  }
  for (const side of [-1, 1]) {
    const mercury = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.43, 0.25),
      mercuryMaterial,
    );
    mercury.position.set(valveCenterX, -0.50, side * 0.53);
    mercury.userData.role = side < 0
      ? 'rear-quicksilver-seat-volume-for-D'
      : 'front-quicksilver-seat-volume-for-D';
    innerMercuryChannel.add(mercury);
    innerMercuryBlocks.push(mercury);
  }
  const innerTroughBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.20, 1.55),
    darkMaterial,
  );
  innerTroughBase.position.set(valveCenterX, -0.77, 0);
  innerTroughBase.userData.role = 'fixed-base-of-valve-D-mercury-seat';
  innerMercuryChannel.add(innerTroughBase);
  root.add(innerMercuryChannel);

  const cupH = new THREE.Group();
  cupH.userData.role =
    'large-area-inverted-pressure-cup-H-with-mercury-sealed-rims';
  const cupHTop = new THREE.Mesh(
    new THREE.BoxGeometry(4.02, 0.18, 1.27),
    cupMaterial,
  );
  cupHTop.position.y = 1.46;
  cupHTop.userData.role = 'closed-top-of-inverted-cup-H';
  const cupHSkirts = [-1, 1].map((side, index) => {
    const skirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 2.22, 1.27),
      cupMaterial,
    );
    skirt.position.set(side * 1.91, 0.35, 0);
    skirt.userData.role =
      `lower-rim-${index + 1}-of-H-dipping-in-quicksilver`;
    cupH.add(skirt);
    return skirt;
  });
  const cupHPressureVolume = new THREE.Mesh(
    new THREE.BoxGeometry(3.62, 1.76, 1.04),
    gasMaterial,
  );
  cupHPressureVolume.position.y = 0.52;
  cupHPressureVolume.userData.role =
    'regulated-outlet-gas-acting-on-inner-surface-of-H';
  const cupHGuideRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 1.35, 24),
    darkMaterial,
  );
  cupHGuideRod.position.set(cupConnectorX, 2.04, 0);
  cupHGuideRod.userData.role = 'vertical-guide-rod-rigid-with-cup-H';
  cupH.add(cupHTop, cupHPressureVolume, cupHGuideRod);
  root.add(cupH);

  const guideBushing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.33, 28),
    frameMaterial,
  );
  guideBushing.position.set(cupConnectorX, 2.19, 0);
  guideBushing.userData.role = 'fixed-top-guide-for-cup-H-rod';
  root.add(guideBushing);

  const valveD = new THREE.Group();
  valveD.position.x = valveCenterX;
  valveD.userData.role =
    'inverted-regulator-valve-D-over-inlet-E';
  const valveTop = new THREE.Mesh(
    new THREE.BoxGeometry(1.16, 0.24, 1.16),
    valveMaterial,
  );
  valveTop.position.y = 0.83;
  valveTop.userData.role = 'closed-top-of-inverted-valve-D';
  valveD.add(valveTop);
  const valveCornerPosts = [];
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.17, 1.50, 0.17),
        valveMaterial,
      );
      post.position.set(x * 0.49, -0.01, z * 0.49);
      post.userData.role =
        `valve-D-skirt-corner-${valveCornerPosts.length + 1}`;
      valveD.add(post);
      valveCornerPosts.push(post);
    }
  }
  const valveSkirtFaces = [
    { rotationY: 0, role: 'front-skirt-of-D-around-notch-b-1' },
    { rotationY: Math.PI, role: 'rear-skirt-of-D-around-notch-b-2' },
    {
      rotationY: Math.PI / 2,
      role: 'right-skirt-of-D-around-notch-b-3',
    },
    {
      rotationY: -Math.PI / 2,
      role: 'left-skirt-of-D-around-notch-b-4',
    },
  ].map(({ rotationY, role }) => {
    const face = notchedSkirtFace({
      apexY: valveNotchApexLocalY,
      bottomY: valveNotchBottomLocalY,
      faceOffset: 0.575,
      halfWidth: 0.58,
      material: valveMaterial,
      notchHalfWidth: 0.28,
      role,
      rotationY,
      topY: 0.74,
    });
    valveD.add(face);
    return face;
  });
  const notchMaterial = matte(PALETTE.ink, {
    opacity: 0.78,
    roughness: 0.55,
    side: THREE.DoubleSide,
    transparent: true,
  });
  notchMaterial.depthWrite = false;
  const valveNotches = [
    triangularNotchPlane({
      apexY: valveNotchApexLocalY,
      bottomY: valveNotchBottomLocalY,
      center: 0,
      halfWidth: 0.28,
      material: notchMaterial,
      role: 'front-inverted-V-notch-b-1',
      z: 0.585,
    }),
    triangularNotchPlane({
      apexY: valveNotchApexLocalY,
      bottomY: valveNotchBottomLocalY,
      center: 0,
      halfWidth: 0.28,
      material: notchMaterial,
      reverse: true,
      role: 'rear-inverted-V-notch-b-2',
      z: 0.585,
    }),
  ];
  for (const notch of valveNotches) valveD.add(notch);
  const sideNotchIndicators = [-1, 1].map((side, index) => {
    const notch = triangularNotchPlane({
      apexY: valveNotchApexLocalY,
      bottomY: valveNotchBottomLocalY,
      center: 0,
      halfWidth: 0.28,
      material: notchMaterial,
      role: `side-inverted-V-notch-b-${index + 3}-on-valve-D`,
      z: 0.585,
    });
    notch.rotation.y = side * Math.PI / 2;
    valveD.add(notch);
    return notch;
  });
  const valveGuideStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.58, 22),
    darkMaterial,
  );
  valveGuideStem.position.y = 1.12;
  valveGuideStem.userData.role = 'vertical-guide-stem-of-valve-D';
  valveD.add(valveGuideStem);
  root.add(valveD);

  const valveGuide = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.28, 24),
    frameMaterial,
  );
  valveGuide.position.set(valveCenterX, 1.39, 0);
  valveGuide.userData.role = 'fixed-guide-for-valve-D-stem';
  root.add(valveGuide);

  const leverD = new THREE.Group();
  leverD.position.copy(leverPivot);
  leverD.userData.role =
    'rigid-reversing-lever-d-between-cup-H-and-valve-D';
  const leverBar = new THREE.Mesh(
    new THREE.BoxGeometry(
      leverCupArmSceneUnit + leverValveArmSceneUnit,
      0.13,
      0.14,
    ),
    leverMaterial,
  );
  leverBar.position.x = (
    leverValveArmSceneUnit - leverCupArmSceneUnit
  ) / 2;
  leverBar.userData.role = 'rigid-body-of-lever-d';
  leverD.add(leverBar);
  root.add(leverD);
  const leverFulcrum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.27, 28),
    darkMaterial,
  );
  leverFulcrum.rotation.x = Math.PI / 2;
  leverFulcrum.position.copy(leverPivot);
  leverFulcrum.userData.role = 'fixed-fulcrum-of-lever-d';
  root.add(leverFulcrum);

  const cupConnector = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 1, 18),
    leverMaterial,
  );
  cupConnector.userData.role = 'short-link-from-H-to-left-end-of-d';
  const valveConnector = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 1, 18),
    leverMaterial,
  );
  valveConnector.userData.role = 'short-link-from-right-end-of-d-to-D';
  const cupLeverPin = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 20, 14),
    darkMaterial,
  );
  cupLeverPin.userData.role = 'moving-pin-at-cup-H-end-of-lever-d';
  const valveLeverPin = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 20, 14),
    darkMaterial,
  );
  valveLeverPin.userData.role = 'moving-pin-at-valve-D-end-of-lever-d';
  root.add(cupConnector, valveConnector, cupLeverPin, valveLeverPin);

  const flowCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(valveCenterX, -2.62, 0.16),
    new THREE.Vector3(valveCenterX, -1.22, 0.16),
    new THREE.Vector3(valveCenterX, -0.27, 0.18),
    new THREE.Vector3(0.62, valveNotchApexLocalY - 0.20, 0.23),
    new THREE.Vector3(-0.10, 0.42, 0.18),
    new THREE.Vector3(-1.34, -0.18, 0.10),
    new THREE.Vector3(-2.48, -0.69, 0.04),
    new THREE.Vector3(-3.28, -0.69, 0.02),
  ], false, 'centripetal');
  const flowMarkers = [];
  const markersPerPath = 10;
  for (let index = 0; index < markersPerPath; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 18, 12),
      markerMaterial,
    );
    marker.userData.role = `regulated-gas-flow-marker-${index + 1}`;
    root.add(marker);
    flowMarkers.push(marker);
  }
  const markerProgress = (turns, markerIndex) =>
    THREE.MathUtils.euclideanModulo(
      turns + markerIndex / markersPerPath,
      1,
    );

  const update = (time) => {
    const state = stateAtTime(time);
    cupH.position.y = state.cupHLiftSceneUnit;
    valveD.position.y = state.valveVerticalDisplacementSceneUnit;
    leverD.rotation.z = state.leverAngleRadian;
    cupLeverPin.position.copy(state.leverCupEndpoint);
    valveLeverPin.position.copy(state.leverValveEndpoint);
    const cupAttachment = new THREE.Vector3(
      cupConnectorX,
      leverPivot.y + state.cupHLiftSceneUnit,
      leverPivot.z,
    );
    const valveAttachment = new THREE.Vector3(
      valveCenterX,
      leverPivot.y + state.valveVerticalDisplacementSceneUnit,
      leverPivot.z,
    );
    setUnitCylinderBetween(
      cupConnector,
      cupAttachment,
      state.leverCupEndpoint,
    );
    setUnitCylinderBetween(
      valveConnector,
      state.leverValveEndpoint,
      valveAttachment,
    );

    flowCurve.points[3].y = valveNotchApexLocalY
      + state.valveVerticalDisplacementSceneUnit - 0.20;
    flowCurve.updateArcLengths();
    const flowFraction = state.demandedFlowCubicMetrePerSecond
      / (meanDemandFlowCubicMetrePerSecond
        + demandFlowAmplitudeCubicMetrePerSecond);
    for (let index = 0; index < markersPerPath; index += 1) {
      const progress = markerProgress(state.markerTravelTurns, index);
      flowMarkers[index].position.copy(flowCurve.getPointAt(progress));
      const fade = Math.sin(Math.PI * progress) ** 0.52
        * Math.sqrt(flowFraction);
      flowMarkers[index].scale.setScalar(fade);
    }
  };

  const geometry = {
    angularFrequencyRadianPerSecond,
    baseCupHImmersionMetre,
    baseValveDImmersionMetre,
    cupHEffectiveAreaSquareMetre,
    cupConnectorX,
    cycleDuration,
    demandFlowAmplitudeCubicMetrePerSecond,
    demandPhaseRadian,
    dischargeCoefficient,
    gasDensityKilogramPerCubicMetre,
    gravityMetrePerSecondSquared,
    inletPressureAmplitudePascal,
    inletPressureMeanAboveTargetPascal,
    innerMercurySurfaceY,
    leverCupArmSceneUnit,
    leverMotionRatio,
    leverPivot: leverPivot.clone(),
    leverValveArmSceneUnit,
    markerPacketVolumeCubicMetre,
    markersPerPath,
    meanDemandFlowCubicMetrePerSecond,
    mercuryDensityKilogramPerCubicMetre,
    minimumNotchExposedHeightMetre,
    nominalNotchExposedHeightMetre,
    nominalValveOpenAreaSquareMetre,
    notchCount,
    notchHeightFeedbackMetrePerPascal,
    notchMaximumHeightMetre,
    notchMaximumWidthMetre,
    targetOutletGaugePressurePascal,
    valveCenterX,
    valveDEffectiveAreaSquareMetre,
    valveMotionDisplayScaleSceneUnitPerMetre,
    valveNotchApexLocalY,
    valveNotchBottomLocalY,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'powers-mercury-sealed-large-area-cup-H-lever-reversed-notched-inverted-valve-D-over-inlet-E-to-outlet-F-pressure-regulator',
    blocks: {
      cupConnector,
      cupH,
      cupHGuideRod,
      cupHPressureVolume,
      cupHSkirts,
      cupHTop,
      cupLeverPin,
      fixedHousing,
      flowMarkers,
      guideBushing,
      housingFloor,
      housingPosts,
      housingRoof,
      housingShell,
      inletFlange,
      inletPipeE,
      innerMercuryBlocks,
      innerMercuryChannel,
      leverBar,
      leverD,
      leverFulcrum,
      outerMercuryChannels,
      outletFlangeF,
      outletPipeF,
      sideNotchIndicators,
      valveConnector,
      valveCornerPosts,
      valveD,
      valveGuide,
      valveGuideStem,
      valveLeverPin,
      valveNotches,
      valveSkirtFaces,
      valveTop,
    },
    degreesOfFreedom: {
      cupHVerticalTranslation: 1,
      independentOperatingCoordinates: 1,
      leverRotationSlavedToCupH: 1,
      valveDVerticalTranslationSlavedByLever: 1,
    },
    dynamics: {
      assumptionScope:
        'The model solves a quasi-static downstream-pressure equilibrium for smooth prescribed inlet-pressure and burner-demand disturbances. Gas and mercury inertia, turbulence, hysteresis, linkage friction, capillary effects, and exact historical weights and dimensions are not integrated.',
      feedbackLaw:
        'Higher regulated pressure raises H in Brown’s stated motion, the reversing lever d depresses D, the exposed height of each inverted-V notch b decreases, and valve area and gas flow fall. Lower pressure reverses every motion.',
      flowEquilibrium:
        'At every pose, C_d*A_b(p_out)*sqrt(2*(p_in-p_out)/rho_gas)=Q_demand. A monotone bisection solves p_out, with the V-notch area computed from its exposed height.',
      markerContinuity:
        'Markers advance from the analytic integral of demanded gas volume, follow the dynamically updated E-to-b-to-F route with getPointAt arc-length sampling, and fade at both endpoints.',
      mercurySeals:
        'Both H rims and the D skirt remain immersed. Their rho_Hg*g*h seal capacities exceed the modeled outlet gauge pressure and inlet-to-outlet differential throughout the cycle.',
      pressureAttenuation:
        'The wide inlet-pressure disturbance is reduced to a much smaller outlet-pressure excursion by the negative-feedback notch motion; exact values and residuals are exposed in stateAtTime.',
    },
    fidelity: 'authored',
    flowPath: {
      flowCurve,
      markerProgress,
    },
    geometry,
    mechanism:
      'Gas enters through fixed inlet E beneath inverted cup valve D, crosses the portions of four notches b exposed above the inner quicksilver seat, fills the regulator body, and leaves through outlet F to the burners. The much larger inverted pressure cup H has both lower rims sealed in separate quicksilver channels and is guided vertically. Increasing regulated pressure raises H; rigid reversing lever d then depresses D into its mercury seat, reducing the exposed V-notch height and throttling flow. Decreasing pressure lowers H, raises D, and opens the notches. H, d, and D form one feedback coordinate; the housing, E, F, mercury channels, and both guides remain fixed.',
    motion: {
      cupHDirectionForIncreasingPressure: new THREE.Vector3(0, 1, 0),
      leverSenseForIncreasingPressure: 'clockwise',
      valveDDirectionForIncreasingPressure: new THREE.Vector3(0, -1, 0),
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 482 HTML marks Animated unavailable and supplies only Brown’s engraving and caption.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate482: {
        approximateCupHLinkPixels: [272, 179],
        approximateInletEPixels: [351, 286],
        approximateLeverDPixels: [293, 198],
        approximateOutletFPixels: [176, 312],
        approximateValveDPixels: [365, 176],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 16,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the regulator equalizes supply despite main-pressure and burner-demand changes',
          'inverted valve D stands over inlet E',
          'lever d connects D to larger inverted cup H',
          'the lower edges of H and D dip into quicksilver channels',
          'notches b pass gas above the quicksilver surface',
          'higher pressure raises H and depresses D to contract b',
          'lower pressure produces the opposite action',
          'regulated gas leaves through F to the burners',
        ],
        engravingEvidence:
          'Brown’s section shows the large guided cup H, fixed-pivot reversing lever d, smaller notched valve D over vertical inlet E, separate mercury wells, left outlet F, and a separate exterior view of D and notch b.',
        patentCorroboration:
          'John H. Powers’s U.S. Patent 21,022, issued July 27, 1858, explicitly describes an inverted cup valve with inverted-V side notches working in quicksilver, a larger annular pressure cup in a double annular quicksilver basin, and pressure-dependent regulation. Henry T. Brown is listed as a witness.',
        patentDrawingDisclosure:
          'The patent confirms the Powers identity and mercury/notch principle, but its letter scheme and linkage presentation are not silently substituted for Brown’s Movement 482 plate. The rendered H-d-D kinematics follow Brown’s caption and engraving.',
        reconstructionDisclosure:
          'H, d, D, E, F, both mercury seals, four notches, and their directions are source-grounded. Dimensions, pressure and demand waves, gas properties, V-notch dimensions, compliance, housing depth, colors, and timing are independently engineered and exposed.',
      },
      officialPage: movement.sourceUrl,
      powersPatentUrl: 'https://patents.google.com/patent/US21022A/en',
      plate: 'Brown 1868, Movement 482',
    },
    stateAtTime,
    transmission: {
      leverConstraint:
        'theta_d=-asin(y_H/L_H); y_D=L_D*sin(theta_d)=-(L_D/L_H)*y_H',
      triangularNotchAreaEquation:
        'A_b=N_b*(w_b/(2*h_b_max))*h_exposed^2',
      valveHeightFeedbackEquation:
        'h_exposed=clamp(h_nominal-k_h*(p_out-p_target),h_min,h_max)',
    },
    update,
    valveAreaAtPressure,
    valveFlowAtPressures,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.55, -2.70, -1.35),
    new THREE.Vector3(3.10, 3.00, 1.35),
  );
  root.userData.cameraDistanceScale = 1.10;
  root.userData.cameraDirection = new THREE.Vector3(8.6, 4.5, 12.2);
  root.userData.groundFloorY = -2.70;
  correctGasMeterParts(root,482,update);
  {
    // Move the stand, pin seats and tie of the finite correction into the
    // lever's plane and shorten the pins and fulcrum to span it, so neither
    // strikes the front of valve D nor the front skirt of cup H.
    const b = root.userData.blocks;
    const seatZ = 0.67;
    b.leverStand.position.z = seatZ;
    for (const seat of b.sliderSeats) seat.position.z = seatZ;
    // Valve D's seat is its hanger: the slotted plate runs back from the
    // lever's plane into D's round top, to the section plane (z 0.29) where
    // D is cut, so D visibly hangs from lever d's pin (the pin rides only in
    // the front of the slot).
    {
      const hanger = b.sliderSeats[1];
      hanger.geometry.dispose();
      hanger.geometry = plate(polygonClipping.difference(poly([[-0.30, -0.12], [0.30, -0.12], [0.30, 0.12], [-0.30, 0.12]]),
        capsule([-0.22, 0], [0.22, 0], 0.074, 32)),
      0.28 - seatZ, 0.04);
      hanger.userData.role = 'finite-horizontal-pin-slot-hanger-of-valve-D';
    }
    b.cupH.traverse((object) => {
      if (object.userData.role === 'rigid-cup-roof-to-sliding-pin-seat') {
        object.position.z = seatZ;
      }
    });
    for (const pin of [b.cupLeverPin, b.valveLeverPin]) {
      pin.geometry.dispose();
      pin.geometry = new THREE.CylinderGeometry(0.070, 0.070, 0.25, 48)
        .translate(0, -0.055, 0);
    }
    b.leverFulcrum.geometry.dispose();
    b.leverFulcrum.geometry = new THREE.CylinderGeometry(0.16, 0.16, 0.26, 28)
      .translate(0, -0.06, 0);
  }
  // Brown's regulator is a flat section; view it square to the cut.
  root.userData.cameraDirection.set(0.05, 0.08, 15);
  root.userData.cameraFov = 10;
  // Pass 84: Brown's regulator is round. His section cuts a round cast case
  // whose own wall forms the outer quicksilver channel: the thick outer wall
  // rises from the channel floor to the domed lid, and the channel's inner
  // wall is the wall of the deep round well (the chamber) under cup H. Valve
  // D's channel is a round cup round inlet E standing in the well, its outer
  // wall merged with the well wall as Brown draws it, and E itself its inner
  // wall. Cup H and valve D are round inverted cups. The outlet F is a round
  // port in the back of the well wall, from which the delivery pipe runs out
  // under the channel floor to the burners. (Before, a square box case stood
  // round free-standing rectangular troughs.)
  const blocks = root.userData.blocks;
  const ROUND = {
    wellInner: 1.78, wellOuter: 1.96, wellBottom: -1.98, wellTop: 0.0,
    floorTop: -1.78, channelFloorBottom: -1.08, channelFloorTop: -0.96,
    caseInner: 2.30, caseOuter: 2.55, caseTop: 1.84, seatBottom: 1.72,
    rimInner: 2.00, rimOuter: 2.16, cupTopRadius: 2.18,
    mercuryTop: -0.205, mercuryBottom: -0.955,
    dCupWallInner: 0.70, dCupWallOuter: 0.81, dCupWallTop: -0.24, dBaseTop: -0.95,
    dBaseBottom: -1.15, inletOuter: 0.24,
    valveSkirtInner: 0.555, valveSkirtOuter: 0.595,
    outletY: -1.50, outletBore: 0.20, outletWall: 0.27,
  };
  root.userData.geometry.roundCase = ROUND;
  const replaceGeometry = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
  const fullLathe = (profile, segments = 160) =>
    latheSectionGeometry(profile, { phiStart: 0, phiLength: FULL_TURN, segments });
  // A curved wall (or skirt) about a vertical axis, built from a flat
  // (s, y) outline: s is arc length on the inner radius about the centre
  // angle phi0, and the wall runs radially outward by `thickness`. The
  // outline is cut into narrow columns so that the flat triangles hug the
  // curve; the inner and outer faces get radial normals.
  const bentWall = (polygons, { inner, thickness, phi0, column = 0.03 }) => {
    const bounds = polygons.flat(2).reduce((b, [s]) => [Math.min(b[0], s), Math.max(b[1], s)], [Infinity, -Infinity]);
    const count = Math.max(1, Math.ceil((bounds[1] - bounds[0]) / column));
    const parts = [];
    for (let i = 0; i < count; i += 1) {
      const s0 = bounds[0] + (bounds[1] - bounds[0]) * i / count;
      const s1 = bounds[0] + (bounds[1] - bounds[0]) * (i + 1) / count;
      const piece = polygonClipping.intersection(polygons, poly([[s0, -99], [s1, -99], [s1, 99], [s0, 99]]));
      if (piece.length) parts.push(plate(piece, 0, thickness));
    }
    const merged = mergePassageParts(parts);
    const position = merged.attributes.position, normal = merged.attributes.normal;
    const radialFaces = [];
    for (let i = 0; i < position.count; i += 1) {
      const s = position.getX(i), y = position.getY(i), w = position.getZ(i);
      const phi = phi0 + s / inner, radius = inner + w;
      radialFaces.push(Math.abs(normal.getZ(i)) > 0.99 ? Math.sign(normal.getZ(i)) : 0);
      position.setXYZ(i, radius * Math.sin(phi), y, radius * Math.cos(phi));
    }
    merged.computeVertexNormals();
    for (let i = 0; i < position.count; i += 1) {
      if (!radialFaces[i]) continue;
      const length = Math.hypot(position.getX(i), position.getZ(i));
      normal.setXYZ(i, radialFaces[i] * position.getX(i) / length, 0, radialFaces[i] * position.getZ(i) / length);
    }
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    return merged;
  };
  const circlePoly = (cx, cy, radius, count = 64) => poly(Array.from({ length: count },
    (_, i) => [cx + radius * Math.cos(FULL_TURN * i / count), cy + radius * Math.sin(FULL_TURN * i / count)]));

  // The case casting: the outer wall and channel floor.
  const caseBody = blocks.outerMercuryChannels[0].trough;
  replaceGeometry(caseBody, fullLathe([
    [ROUND.wellOuter, ROUND.channelFloorBottom], [ROUND.caseOuter, ROUND.channelFloorBottom],
    [ROUND.caseOuter, ROUND.seatBottom], [ROUND.caseInner, ROUND.seatBottom],
    [ROUND.caseInner, ROUND.channelFloorTop], [ROUND.wellOuter, ROUND.channelFloorTop],
  ]));
  caseBody.position.set(0, 0, 0);
  // The top of the case wall, on which the lid seats.
  replaceGeometry(housingRoof, fullLathe([[ROUND.caseInner, ROUND.seatBottom], [ROUND.caseOuter, ROUND.seatBottom],
    [ROUND.caseOuter, ROUND.caseTop], [ROUND.caseInner, ROUND.caseTop]]));
  housingRoof.position.set(0, 0, 0);
  housingRoof.userData.role = 'fixed-domed-case-roof-reconstruction';
  // The well wall (the channel's inner wall), with the round outlet port F in
  // its back: a revolved wall with a narrow window, and the window's panel
  // bored for F.
  const outletPhi = Math.atan2(-1.30, -Math.sqrt(ROUND.wellInner ** 2 - 1.30 ** 2));
  const windowHalf = THREE.MathUtils.degToRad(12);
  const [wellWall, wellPanel] = housingPosts;
  replaceGeometry(wellWall, latheSectionGeometry([[ROUND.wellInner, ROUND.wellBottom], [ROUND.wellOuter, ROUND.wellBottom],
    [ROUND.wellOuter, ROUND.wellTop], [ROUND.wellInner, ROUND.wellTop]],
  { phiStart: outletPhi + windowHalf, phiLength: FULL_TURN - 2 * windowHalf, segments: 160 }));
  const panelHalf = ROUND.wellInner * windowHalf;
  replaceGeometry(wellPanel, bentWall(polygonClipping.difference(
    poly([[-panelHalf, ROUND.wellBottom], [panelHalf, ROUND.wellBottom], [panelHalf, ROUND.wellTop], [-panelHalf, ROUND.wellTop]]),
    circlePoly(0, ROUND.outletY, ROUND.outletBore)),
  { inner: ROUND.wellInner, thickness: ROUND.wellOuter - ROUND.wellInner, phi0: outletPhi, column: 0.025 }));
  for (const wall of [wellWall, wellPanel]) {
    wall.position.set(0, 0, 0);
    wall.rotation.set(0, 0, 0);
  }
  wellWall.userData.role = 'fixed-side-wall-1';
  wellPanel.userData.role = 'fixed-side-wall-2-bored-for-outlet-F';
  // The well floor: whole, carrying the lever stand in front of the cut.
  replaceGeometry(housingFloor, horizontalPlate(polygonClipping.difference(
    poly(circle([0, 0], ROUND.wellInner, 160)), poly(circle([valveCenterX, 0], ROUND.inletOuter, 64))), -0.10, 0.10));
  // No box case: no back panel.
  housingShell.removeFromParent();
  delete blocks.housingShell;
  // Quicksilver in the outer channel.
  const outerMercury = blocks.outerMercuryChannels[0].mercury;
  replaceGeometry(outerMercury, fullLathe([[ROUND.wellOuter + 0.001, ROUND.mercuryBottom], [ROUND.caseInner - 0.001, ROUND.mercuryBottom],
    [ROUND.caseInner - 0.001, ROUND.mercuryTop], [ROUND.wellOuter + 0.001, ROUND.mercuryTop]]));
  outerMercury.position.set(0, 0, 0);
  // Valve D's channel: a round cup on a pedestal from the well floor, E its
  // inner wall (the cup is cast round E, so the quicksilver cannot leak).
  const dBase = blocks.innerMercuryChannel.children.find(o => o.userData.role === 'fixed-base-of-valve-D-mercury-seat');
  replaceGeometry(dBase, fullLathe([[ROUND.inletOuter, -0.10], [ROUND.dCupWallOuter, -0.10],
    [ROUND.dCupWallOuter, 0.10], [ROUND.inletOuter, 0.10]], 96));
  dBase.position.set(valveCenterX, (ROUND.dBaseTop + ROUND.dBaseBottom) / 2, 0);
  replaceGeometry(blocks.innerTroughWalls, mergePassageParts([
    fullLathe([[ROUND.dCupWallInner, ROUND.dBaseTop], [ROUND.dCupWallOuter, ROUND.dBaseTop],
      [ROUND.dCupWallOuter, ROUND.dCupWallTop], [ROUND.dCupWallInner, ROUND.dCupWallTop]], 96),
    fullLathe([[ROUND.inletOuter, ROUND.floorTop], [ROUND.dCupWallOuter, ROUND.floorTop],
      [ROUND.dCupWallOuter, ROUND.dBaseBottom], [ROUND.inletOuter, ROUND.dBaseBottom]], 96),
  ]));
  blocks.innerTroughWalls.position.set(valveCenterX, 0, 0);
  replaceGeometry(blocks.innerMercuryBlocks[0], fullLathe([[ROUND.inletOuter + 0.001, ROUND.dBaseTop + 0.01],
    [ROUND.dCupWallInner - 0.001, ROUND.dBaseTop + 0.01], [ROUND.dCupWallInner - 0.001, innerMercurySurfaceY],
    [ROUND.inletOuter + 0.001, innerMercurySurfaceY]], 96));
  blocks.innerMercuryBlocks[0].position.set(valveCenterX, 0, 0);
  // Cup H: a round inverted cup; its rim is one round skirt, kept as two
  // halves.
  replaceGeometry(cupHTop, new THREE.CylinderGeometry(ROUND.cupTopRadius, ROUND.cupTopRadius, 0.18, 160));
  cupHSkirts.forEach((skirt, index) => {
    replaceGeometry(skirt, latheSectionGeometry([[ROUND.rimInner, -0.76], [ROUND.rimOuter, -0.76],
      [ROUND.rimOuter, 1.46], [ROUND.rimInner, 1.46]], { phiStart: index * Math.PI, phiLength: Math.PI, segments: 160 }));
    skirt.position.set(0, 0, 0);
  });
  for (const skirt of blocks.cupCrossSkirts ?? []) {
    skirt.removeFromParent();
    skirt.geometry.dispose();
  }
  blocks.cupCrossSkirts = [];
  // H's guide rod rises on the case axis, through the lid's crown and knob,
  // as Brown draws it; the knob's bore guides it.
  cupHGuideRod.position.x = 0;
  guideBushing.visible = false;
  guideBushing.position.x = 0;
  // Valve D: a round inverted cup; its skirt carries the four notches b.
  replaceGeometry(valveTop, new THREE.CylinderGeometry(ROUND.valveSkirtOuter, ROUND.valveSkirtOuter, 0.24, 96));
  const skirtHalf = ROUND.valveSkirtInner * Math.PI / 4;
  const notchHalf = 0.28 * ROUND.valveSkirtInner / 0.575;
  const skirtOutline = polygonClipping.difference(
    poly([[-skirtHalf, valveNotchBottomLocalY], [skirtHalf, valveNotchBottomLocalY], [skirtHalf, 0.74], [-skirtHalf, 0.74]]),
    poly([[-notchHalf, valveNotchBottomLocalY - 0.01], [notchHalf, valveNotchBottomLocalY - 0.01], [0, valveNotchApexLocalY]]));
  const skirtPhi = {
    'front-skirt-of-D-around-notch-b-1': 0,
    'rear-skirt-of-D-around-notch-b-2': Math.PI,
    'right-skirt-of-D-around-notch-b-3': Math.PI / 2,
    'left-skirt-of-D-around-notch-b-4': -Math.PI / 2,
  };
  for (const face of valveSkirtFaces) {
    replaceGeometry(face, bentWall(skirtOutline, { inner: ROUND.valveSkirtInner,
      thickness: ROUND.valveSkirtOuter - ROUND.valveSkirtInner, phi0: skirtPhi[face.userData.role], column: 0.02 }));
    face.position.set(0, 0, 0);
    face.rotation.set(0, 0, 0);
  }
  for (const post of valveCornerPosts) {
    post.removeFromParent();
    post.geometry.dispose();
  }
  valveCornerPosts.length = 0;
  addDomedCover(root, frameMaterial, 0, ROUND);
  // Delivery pipe F: from the port in the back of the well wall it runs out
  // radially, turns to the left under the channel floor (clear below it)
  // and leaves the case's side, ending in the flange for the burners' pipe.
  {
    const radial = new THREE.Vector3(Math.sin(outletPhi), 0, Math.cos(outletPhi));
    const at = (radius) => radial.clone().multiplyScalar(radius).setY(ROUND.outletY);
    const corner = at(ROUND.caseOuter);
    const turned = corner.clone().add(new THREE.Vector3(-0.30, 0, 0));
    const path = new THREE.CurvePath();
    // Pass 90: the pipe starts 0.01 inside the flange's outer face and the
    // flange is bored 0.003 over the pipe (their bores had lain on each
    // other and flickered).
    path.add(new THREE.LineCurve3(new THREE.Vector3(-3.29, ROUND.outletY, corner.z), turned));
    path.add(new THREE.QuadraticBezierCurve3(turned, corner, at(2.20)));
    // The pipe's end sits 0.02 into the wall's outer face, round the port.
    path.add(new THREE.LineCurve3(at(2.20), at(ROUND.wellOuter - 0.02)));
    outletPipeF.geometry.dispose();
    outletPipeF.geometry = curvedPipeWall(path, ROUND.outletBore, ROUND.outletWall, 128, 36);
    outletPipeF.position.set(0, 0, 0);
    outletPipeF.quaternion.identity();
    outletPipeF.scale.set(1, 1, 1);
    outletFlangeF.position.set(-3.19, ROUND.outletY, corner.z);
    outletFlangeF.geometry.dispose();
    outletFlangeF.geometry = horizontalRing(ROUND.outletWall + 0.003, 0.40, -0.11, 0.11, 64);
    // Inlet E likewise: the flange is bored over the pipe, which runs down
    // through it to 0.01 short of its lower face.
    {
      const flangeBottom = inletFlange.position.y - 0.12, top = inletPipeE.position.y + 1.14;
      const bottom = flangeBottom + 0.01;
      inletFlange.geometry.dispose();
      inletFlange.geometry = horizontalRing(0.243, 0.47, -0.12, 0.12, 64);
      inletPipeE.geometry.dispose();
      inletPipeE.geometry = horizontalRing(0.18, 0.24, -(top - bottom) / 2, (top - bottom) / 2, 64);
      inletPipeE.position.y = (top + bottom) / 2;
    }
    blocks.outletChamber = { wall: wellWall, port: wellPanel, pipe: outletPipeF, portCentre: at(ROUND.wellInner) };
    // The gas path from E through a notch b, over the well under H, down to
    // the port F and out along the delivery pipe.
    const flowPoints = [
      new THREE.Vector3(-0.10, 0.42, 0.18),
      new THREE.Vector3(-0.85, -0.55, -0.35),
      at(ROUND.wellInner - 0.25),
      at(ROUND.wellInner + 0.10),
      path.getPointAt(0.80),
      path.getPointAt(0.55),
      path.getPointAt(0.25),
      new THREE.Vector3(-3.28, ROUND.outletY, corner.z),
    ];
    flowCurve.points.splice(4, flowCurve.points.length - 4, ...flowPoints);
    flowCurve.updateArcLengths();
  }
  markShadows(root);
  housingShell.receiveShadow = false;
  housingShell.castShadow = false;
  cupHPressureVolume.castShadow = false;
  for (const channel of outerMercuryChannels) {
    channel.mercury.castShadow = false;
  }
  for (const mercury of innerMercuryBlocks) mercury.castShadow = false;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredMercuryGasRegulatorMovement(movement) {
  if (movement.id !== 482) return null;
  const model = applyCutawayFor(powersMercuryRegulator(movement), movement.id);
  // Fit what remains after the cut (the round case's front half is gone),
  // over the whole cycle.
  const { root, update } = model;
  const period = root.userData.geometry.cycleDuration;
  const bounds = new THREE.Box3();
  for (let i = 0; i <= 64; i += 1) {
    update(period * i / 64);
    root.updateMatrixWorld(true);
    bounds.union(new THREE.Box3().setFromObject(root));
  }
  update(0);
  root.userData.cameraFitBounds = bounds.expandByScalar(0.03);
  return model;
}
