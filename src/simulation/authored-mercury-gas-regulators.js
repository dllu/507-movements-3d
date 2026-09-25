import {correctGasMeterParts} from './gas-meter-working-parts.js';
import {plate, poly, polygonClipping} from './finite-plate-geometry.js';
import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

// Brown covers the regulator with a domed lid whose flange overhangs the
// walls, the rod of cup H rising into a knob at its crown. The lid is one
// section plate in the elevation plane, slotted where the rod passes.
function addDomedCover(root, material, rodX) {
  const baseY = 1.84;
  const arc = (rx, ry, count = 96) => Array.from({ length: count + 1 }, (_, i) => {
    const angle = Math.PI * i / count;
    return [rx * Math.cos(angle), baseY + ry * Math.sin(angle)];
  });
  const shell = polygonClipping.difference(
    poly([[3.02, baseY - 0.06], ...arc(2.98, 0.78), [-3.02, baseY - 0.06]]),
    poly([...arc(2.80, 0.60)].reverse()),
  );
  const knobTop = baseY + 0.78 + 0.30;
  // Only a square rod passage is cut through the crown; the rest of the
  // lid is unbroken across its depth.
  const hole = 0.095;
  const slot = poly([
    [rodX - hole, baseY - 0.1], [rodX + hole, baseY - 0.1],
    [rodX + hole, knobTop + 0.1], [rodX - hole, knobTop + 0.1],
  ]);
  // Each slab is built as closed left and right halves meeting at the rod.
  const halves = [
    polygonClipping.intersection(shell, poly([[-4, 0], [rodX, 0], [rodX, 5], [-4, 5]])),
    polygonClipping.intersection(shell, poly([[rodX, 0], [4, 0], [4, 5], [rodX, 5]])),
  ];
  const geometries = [
    ...halves.map(half => plate(half, -1.20, -hole)),
    plate(polygonClipping.difference(shell, slot), -hole, hole),
    ...halves.map(half => plate(half, hole, 1.20)),
  ];
  const cover = new THREE.Group();
  geometries.forEach(geometry => cover.add(new THREE.Mesh(geometry, material)));
  cover.userData.role = 'fixed-domed-cover-with-rod-knob';
  // Brown's knob is a small turned boss on the crown, bored for the rod.
  const crownOuter = baseY + 0.78 * Math.sqrt(Math.max(0, 1 - (rodX / 2.98) ** 2));
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
  const bounds = root.userData.cameraFitBounds;
  cover.updateMatrixWorld(true);
  bounds.union(new THREE.Box3().setFromObject(cover));
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
  addDomedCover(root, frameMaterial, cupConnectorX);
  // Brown cuts the regulator through its middle: cup H is a thin inverted U
  // whose two rims dip into the left and right quicksilver channels, and
  // valve D's skirt dips into the channel round E. The finite ring troughs,
  // their quicksilver and cup H stay whole (they are what the contact checks
  // use) but are drawn cut at the section plane z = SECTION_Z: the troughs
  // and quicksilver show only their section faces, so their front and rear
  // runs no longer read as one dark slab, and cup H shows its cut top and
  // rims without a tinted front skirt. The quicksilver is a light, visible
  // liquid, and the back of the section is left plain paper-white.
  const SECTION_Z = 0.30;
  const frontCut = [new THREE.Plane(new THREE.Vector3(0, 0, -1), SECTION_Z)];
  const blocks = root.userData.blocks;
  const box = (x0, x1, y0, y1) =>
    poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const mirrored = (x0, x1, y0, y1, cx = 0) =>
    [box(cx - x1, cx - x0, y0, y1), box(cx + x0, cx + x1, y0, y1)];
  const sectionFace = (parts, material, role) => {
    const face = new THREE.Mesh(
      plate(polygonClipping.union(...parts), SECTION_Z - 0.006, SECTION_Z),
      material,
    );
    face.userData.role = role;
    root.add(face);
    return face;
  };
  // Outer ring trough (walls 2.14-2.26 and 1.75-1.80, floor below) and its
  // quicksilver (1.80-2.14), as rebuilt by correctGasMeterParts.
  const troughFaceMaterial = matte(PALETTE.frame, { roughness: 0.6 });
  const troughFace = sectionFace([
    ...mirrored(2.14, 2.26, -0.96, -0.16),
    ...mirrored(1.75, 1.80, -0.96, -0.16),
    ...mirrored(1.75, 2.26, -1.02, -0.96),
    // Channel round E: walls 0.72-0.815 and 0.335-0.395 about D's axis.
    ...mirrored(0.72, 0.815, -0.95, -0.24, valveCenterX),
    ...mirrored(0.335, 0.395, -0.95, -0.24, valveCenterX),
  ], troughFaceMaterial, 'section-face-of-fixed-quicksilver-troughs');
  const quicksilverFaceMaterial = matte(0xb9c3c6, {
    metalness: 0.3,
    opacity: 0.55,
    roughness: 0.3,
    transparent: true,
  });
  quicksilverFaceMaterial.depthWrite = false;
  const quicksilverFace = sectionFace([
    ...mirrored(1.80, 2.14, -0.955, -0.205),
    ...mirrored(0.395, 0.72, -0.94, innerMercurySurfaceY, valveCenterX),
  ], quicksilverFaceMaterial, 'section-face-of-quicksilver-seals');
  blocks.sectionFaces = [troughFace, quicksilverFace];
  const trough = blocks.outerMercuryChannels[0].trough;
  trough.material.clippingPlanes = frontCut;
  mercuryMaterial.color.setHex(0xb9c3c6);
  mercuryMaterial.opacity = 0.55;
  mercuryMaterial.clippingPlanes = frontCut;
  cupMaterial.clippingPlanes = frontCut;
  for (const skirt of blocks.cupCrossSkirts ?? []) {
    skirt.material.clippingPlanes = frontCut;
    skirt.material.opacity = 0.02;
  }
  cupHPressureVolume.material.clippingPlanes = frontCut;
  cupHPressureVolume.material.opacity = 0.012;
  housingShell.material = matte(PALETTE.paper, {
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  // Brown's case is a solid hatched section: thick walls running down from
  // the dome into the outer quicksilver channels, and a floor. Show the cut
  // faces of the walls (trough wall to case wall) and floor.
  sectionFace([
    ...mirrored(2.14, 2.86, -1.98, 1.84),
    box(-2.86, 2.86, -1.98, -1.78),
  ], troughFaceMaterial, 'section-face-of-solid-regulator-case');
  // The outlet chamber inside cup H: open at the top above the quicksilver,
  // its round outlet F in the back wall and the delivery pipe leaving its
  // left side under the outer channel, as Brown draws it.
  const chamberX0 = -1.70, chamberX1 = 0.12, chamberTop = 0.0;
  const chamberFloor = -1.78, chamberBack = -0.72, chamberWall = 0.12;
  const outletY = -1.30, outletX = -1.22;
  const chamberMaterial = matte(PALETTE.frame, { roughness: 0.6 });
  const chamberBackWall = new THREE.Mesh(plate(polygonClipping.difference(
    box(chamberX0, chamberX1, chamberFloor, chamberTop),
    poly(Array.from({ length: 48 }, (_, i) => [
      outletX + 0.13 * Math.cos(i * Math.PI / 24),
      outletY + 0.24 * Math.sin(i * Math.PI / 24)]))),
  chamberBack, chamberBack + chamberWall), housingShell.material);
  chamberBackWall.userData.role = 'fixed-outlet-chamber-back-wall-with-round-outlet-F';
  const chamberSides = new THREE.Mesh(plate(polygonClipping.union(
    box(chamberX0, chamberX0 + chamberWall, chamberFloor, chamberTop),
    box(chamberX1 - chamberWall, chamberX1, chamberFloor, chamberTop),
    box(chamberX0, chamberX1, chamberFloor, chamberFloor + chamberWall),
  ), chamberBack, SECTION_Z - 0.006), chamberMaterial);
  chamberSides.userData.role = 'fixed-outlet-chamber-side-walls-and-bottom';
  // Dark passage seen through F.
  const outletPassage = new THREE.Mesh(plate(poly(Array.from({ length: 48 }, (_, i) => [
    outletX + 0.14 * Math.cos(i * Math.PI / 24),
    outletY + 0.25 * Math.sin(i * Math.PI / 24)])), chamberBack - 0.10, chamberBack - 0.04), darkMaterial);
  outletPassage.userData.role = 'dark-passage-behind-round-outlet-F';
  root.add(chamberBackWall, chamberSides, outletPassage);
  sectionFace([
    box(chamberX0, chamberX0 + chamberWall, chamberFloor, chamberTop),
    box(chamberX1 - chamberWall, chamberX1, chamberFloor, chamberTop),
    box(chamberX0, chamberX1, chamberFloor, chamberFloor + chamberWall),
  ], troughFaceMaterial, 'section-face-of-outlet-chamber');
  blocks.outletChamber = { back: chamberBackWall, sides: chamberSides, passage: outletPassage };
  // The delivery pipe runs from the chamber's left wall out through the case
  // wall below the outer channel (the case wall's pipe hole moves with it).
  {
    const pipeStart = -3.22, pipeEnd = chamberX0;
    outletPipeF.position.set((pipeStart + pipeEnd) / 2, outletY, 0);
    outletPipeF.scale.y = (pipeEnd - pipeStart) / 0.84;
    outletFlangeF.position.set(-3.19, outletY, 0);
    const left = blocks.housingPosts[0];
    left.geometry.dispose();
    left.geometry = plate(polygonClipping.difference(
      box(-1.20, 1.20, -1.84, 1.84),
      poly(Array.from({ length: 64 }, (_, i) => [
        0.275 * Math.cos(i * Math.PI / 32), outletY + 0.275 * Math.sin(i * Math.PI / 32)]))),
    -0.09, 0.09).rotateY(Math.PI / 2);
  }
  root.userData.localClippingEnabled = true;
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
  return powersMercuryRegulator(movement);
}
