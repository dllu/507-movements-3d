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
  const knob = poly([
    [rodX - 0.20, baseY + 0.60], [rodX + 0.20, baseY + 0.60],
    [rodX + 0.20, knobTop - 0.10], [rodX + 0.10, knobTop],
    [rodX - 0.10, knobTop], [rodX - 0.20, knobTop - 0.10],
  ]);
  const slot = poly([
    [rodX - 0.095, baseY - 0.1], [rodX + 0.095, baseY - 0.1],
    [rodX + 0.095, knobTop + 0.1], [rodX - 0.095, knobTop + 0.1],
  ]);
  const outline = polygonClipping.difference(polygonClipping.union(shell, knob), slot);
  const cover = new THREE.Mesh(plate(outline, -1.20, 1.20), material);
  cover.userData.role = 'fixed-domed-cover-with-rod-knob';
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

  const leverPivot = new THREE.Vector3(0.25, 0.95, .70);
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
  // Brown's regulator is a flat section; view it square to the cut.
  root.userData.cameraDirection.set(0.05, 0.08, 15);
  root.userData.cameraFov = 10;
  addDomedCover(root, frameMaterial, cupConnectorX);
  markShadows(root);
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
