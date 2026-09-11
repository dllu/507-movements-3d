import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function horizontalRing(radius, tubeRadius, material) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 12, 48),
    material,
  );
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function setCylinderBetween(mesh, start, end) {
  const delta = end.clone().sub(start);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    delta.clone().normalize(),
  );
  mesh.scale.set(1, delta.length(), 1);
}

function positiveC2Lobe(value) {
  return Math.max(0, value) ** 3;
}

function makeTube(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const tube = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(curve, 72, radius, 16, false),
    material,
  ), role);
  tube.userData.curve = curve;
  return tube;
}

function doubleLanternBellowsPump(movement) {
  const root = new THREE.Group();
  const cycleDuration = 5.4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const beamPivot = new THREE.Vector3(0, 3.20, 0);
  const beamPinHalfSpan = 1.75;
  const beamAmplitude = THREE.MathUtils.degToRad(18);
  const connectingRodLength = 1.18;
  const topPlateHalfThickness = 0.07;
  const bellowsFloorY = -0.11;
  const bellowsCenterXs = Object.freeze({ left: -1.75, right: 1.75 });
  const bellowsWaterRadius = 0.67;
  const bellowsEffectiveArea = Math.PI * bellowsWaterRadius ** 2;
  const maximumValveLift = 0.15;
  const groundY = -2.26;
  const valveSeats = Object.freeze({
    leftDelivery: new THREE.Vector3(-0.70, -0.10, 0.55),
    leftSuction: new THREE.Vector3(-1.25, -0.64, 0.55),
    rightDelivery: new THREE.Vector3(0.70, -0.10, 0.55),
    rightSuction: new THREE.Vector3(1.25, -0.64, 0.55),
  });

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const phase = THREE.MathUtils.euclideanModulo(
      inputAngle / FULL_TURN,
      1,
    );
    const cycleAngle = FULL_TURN * phase;
    const sine = Math.sin(cycleAngle);
    const cosine = Math.cos(cycleAngle);
    const strokeSine = Math.abs(sine) < 1e-12 ? 0 : sine;
    const beamAngle = -beamAmplitude * cosine;
    const beamAngularSpeed = beamAmplitude * strokeSine * inputSpeed;
    const beamAngularAcceleration = beamAmplitude * (
      cosine * inputSpeed ** 2 + sine * inputAcceleration
    );
    const pinCosine = Math.cos(beamAngle);
    const pinSine = Math.sin(beamAngle);
    const leftBeamPin = new THREE.Vector3(
      beamPivot.x - beamPinHalfSpan * pinCosine,
      beamPivot.y - beamPinHalfSpan * pinSine,
      0,
    );
    const rightBeamPin = new THREE.Vector3(
      beamPivot.x + beamPinHalfSpan * pinCosine,
      beamPivot.y + beamPinHalfSpan * pinSine,
      0,
    );
    const leftPinVelocity = new THREE.Vector3(
      beamPinHalfSpan * pinSine * beamAngularSpeed,
      -beamPinHalfSpan * pinCosine * beamAngularSpeed,
      0,
    );
    const rightPinVelocity = leftPinVelocity.clone().multiplyScalar(-1);
    const leftPinAcceleration = new THREE.Vector3(
      beamPinHalfSpan * (
        pinCosine * beamAngularSpeed ** 2
          + pinSine * beamAngularAcceleration
      ),
      beamPinHalfSpan * (
        pinSine * beamAngularSpeed ** 2
          - pinCosine * beamAngularAcceleration
      ),
      0,
    );
    const rightPinAcceleration = leftPinAcceleration
      .clone()
      .multiplyScalar(-1);
    const leftTopPlateCenter = leftBeamPin.clone();
    leftTopPlateCenter.y -= connectingRodLength;
    const rightTopPlateCenter = rightBeamPin.clone();
    rightTopPlateCenter.y -= connectingRodLength;
    const leftBellowsTopY = leftTopPlateCenter.y
      - topPlateHalfThickness;
    const rightBellowsTopY = rightTopPlateCenter.y
      - topPlateHalfThickness;
    const leftBellowsHeight = leftBellowsTopY - bellowsFloorY;
    const rightBellowsHeight = rightBellowsTopY - bellowsFloorY;
    const leftBellowsVelocity = leftPinVelocity.y;
    const rightBellowsVelocity = -leftBellowsVelocity;
    const leftBellowsAcceleration = leftPinAcceleration.y;
    const rightBellowsAcceleration = -leftBellowsAcceleration;
    const leftBellowsWaterVolume = bellowsEffectiveArea
      * leftBellowsHeight;
    const rightBellowsWaterVolume = bellowsEffectiveArea
      * rightBellowsHeight;
    const leftBellowsWaterVolumeRate = bellowsEffectiveArea
      * leftBellowsVelocity;
    const rightBellowsWaterVolumeRate = -leftBellowsWaterVolumeRate;
    const leftSuctionFlowRate = Math.max(
      0,
      leftBellowsWaterVolumeRate,
    );
    const leftDeliveryFlowRate = Math.max(
      0,
      -leftBellowsWaterVolumeRate,
    );
    const rightSuctionFlowRate = Math.max(
      0,
      rightBellowsWaterVolumeRate,
    );
    const rightDeliveryFlowRate = Math.max(
      0,
      -rightBellowsWaterVolumeRate,
    );
    const leftCompressingOpen = positiveC2Lobe(strokeSine);
    const leftExpandingOpen = positiveC2Lobe(-strokeSine);
    let mode;
    if (strokeSine === 0) {
      mode = cosine >= 0
        ? 'left-distended-right-compressed-dead-center-all-checks-seated'
        : 'right-distended-left-compressed-dead-center-all-checks-seated';
    } else if (strokeSine > 0) {
      mode = 'left-compressing-to-discharge-right-expanding-from-suction';
    } else {
      mode = 'right-compressing-to-discharge-left-expanding-from-suction';
    }
    return {
      beamAngle,
      beamAngularAcceleration,
      beamAngularSpeed,
      bellowsEffectiveArea,
      inputAcceleration,
      inputAngle: cycleAngle,
      inputSpeed,
      leftBeamPin,
      leftBellowsAcceleration,
      leftBellowsHeight,
      leftBellowsTopY,
      leftBellowsVelocity,
      leftBellowsWaterVolume,
      leftBellowsWaterVolumeRate,
      leftDeliveryFlowRate,
      leftDeliveryValveLift: maximumValveLift * leftCompressingOpen,
      leftDeliveryValveOpen: leftCompressingOpen,
      leftPinAcceleration,
      leftPinVelocity,
      leftSuctionFlowRate,
      leftSuctionValveLift: maximumValveLift * leftExpandingOpen,
      leftSuctionValveOpen: leftExpandingOpen,
      leftTopPlateCenter,
      mode,
      phase,
      rightBeamPin,
      rightBellowsAcceleration,
      rightBellowsHeight,
      rightBellowsTopY,
      rightBellowsVelocity,
      rightBellowsWaterVolume,
      rightBellowsWaterVolumeRate,
      rightDeliveryFlowRate,
      rightDeliveryValveLift: maximumValveLift * leftExpandingOpen,
      rightDeliveryValveOpen: leftExpandingOpen,
      rightPinAcceleration,
      rightPinVelocity,
      rightSuctionFlowRate,
      rightSuctionValveLift: maximumValveLift * leftCompressingOpen,
      rightSuctionValveOpen: leftCompressingOpen,
      rightTopPlateCenter,
      totalDeliveryFlowRate:
        leftDeliveryFlowRate + rightDeliveryFlowRate,
      totalSuctionFlowRate: leftSuctionFlowRate + rightSuctionFlowRate,
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
    inputAngularSpeed,
    0,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.60,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.20,
    roughness: 0.50,
  });
  const beamMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.56,
  });
  const bellowsMaterial = matte(PALETTE.driven, {
    opacity: 0.86,
    roughness: 0.56,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const shellMaterial = matte(PALETTE.muted, {
    opacity: 0.28,
    roughness: 0.72,
    side: THREE.DoubleSide,
    transparent: true,
  });
  shellMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.68,
    roughness: 0.30,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const suctionValveMaterial = matte(PALETTE.accent, {
    metalness: 0.12,
    roughness: 0.48,
  });
  const deliveryValveMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.48,
  });

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.15, 3.0),
    frameMaterial,
  ), 'fixed-double-bellows-pump-foundation');
  base.position.set(0, groundY + 0.075, 0);
  root.add(base);

  const valveChest = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(5.25, 0.76, 1.72),
    shellMaterial,
  ), 'fixed-common-valve-chest-beneath-both-bellows');
  valveChest.position.set(0, -0.55, 0.02);
  root.add(valveChest);
  const chestBottom = new THREE.Mesh(
    new THREE.BoxGeometry(5.34, 0.12, 1.84),
    frameMaterial,
  );
  chestBottom.position.set(0, -0.96, 0.02);
  root.add(chestBottom);

  const standard = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 4.15, 0.34),
    frameMaterial,
  ), 'fixed-central-standard-carrying-rocking-beam-pivot');
  standard.position.set(0, 1.14, -0.72);
  root.add(standard);

  const beam = addRole(new THREE.Group(),
    'single-common-rocking-lever-driving-bellows-in-opposition');
  beam.position.copy(beamPivot);
  root.add(beam);
  const beamBody = new THREE.Mesh(
    new THREE.BoxGeometry(6.55, 0.22, 0.38),
    beamMaterial,
  );
  beamBody.position.x = 0.32;
  beam.add(beamBody);
  const handleGrip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.88, 24),
    darkMaterial,
  );
  handleGrip.rotation.z = Math.PI / 2;
  handleGrip.position.x = 3.58;
  beam.add(handleGrip);

  const pivotAxle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.74, 32),
    darkMaterial,
  ), 'fixed-rocking-beam-fulcrum');
  pivotAxle.rotation.x = Math.PI / 2;
  pivotAxle.position.copy(beamPivot);
  root.add(pivotAxle);
  const pivotCollar = horizontalRing(0.24, 0.055, suctionValveMaterial);
  pivotCollar.position.copy(beamPivot);
  root.add(pivotCollar);

  const makeBeamPin = (x) => {
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.58, 24),
      darkMaterial,
    );
    pin.rotation.x = Math.PI / 2;
    pin.position.x = x;
    beam.add(pin);
    return pin;
  };
  makeBeamPin(-beamPinHalfSpan);
  makeBeamPin(beamPinHalfSpan);

  const topPlateGeometry = new THREE.CylinderGeometry(
    0.97,
    0.97,
    topPlateHalfThickness * 2,
    48,
  );
  const leftTopPlate = addRole(new THREE.Mesh(
    topPlateGeometry,
    beamMaterial,
  ), 'left-moving-lantern-bellows-top-plate');
  const rightTopPlate = addRole(new THREE.Mesh(
    topPlateGeometry,
    beamMaterial,
  ), 'right-moving-lantern-bellows-top-plate');
  root.add(leftTopPlate, rightTopPlate);

  const bottomPlateGeometry = new THREE.CylinderGeometry(
    0.97,
    0.97,
    0.14,
    48,
  );
  const leftBottomPlate = addRole(new THREE.Mesh(
    bottomPlateGeometry,
    frameMaterial,
  ), 'fixed-left-lantern-bellows-bottom-plate');
  leftBottomPlate.position.set(bellowsCenterXs.left, -0.18, 0);
  root.add(leftBottomPlate);
  const rightBottomPlate = addRole(new THREE.Mesh(
    bottomPlateGeometry,
    frameMaterial,
  ), 'fixed-right-lantern-bellows-bottom-plate');
  rightBottomPlate.position.set(bellowsCenterXs.right, -0.18, 0);
  root.add(rightBottomPlate);

  const rodGeometry = new THREE.CylinderGeometry(0.085, 0.085, 1, 24);
  const leftConnectingRod = addRole(new THREE.Mesh(
    rodGeometry,
    darkMaterial,
  ), 'left-constant-length-vertical-beam-to-bellows-rod');
  const rightConnectingRod = addRole(new THREE.Mesh(
    rodGeometry,
    darkMaterial,
  ), 'right-constant-length-vertical-beam-to-bellows-rod');
  root.add(leftConnectingRod, rightConnectingRod);

  const pleatRadii = [0.76, 0.93, 0.73, 0.93, 0.73,
    0.93, 0.73, 0.93, 0.76];
  const makeBellows = (side) => {
    const group = addRole(new THREE.Group(),
      `${side}-flexible-lantern-bellows-with-eight-visible-pleats`);
    root.add(group);
    const rings = pleatRadii.map((radius, index) => {
      const ring = addRole(horizontalRing(
        radius,
        index === 0 || index === pleatRadii.length - 1 ? 0.055 : 0.07,
        darkMaterial,
      ), `${side}-bellows-pleat-ring-${index + 1}`);
      group.add(ring);
      return ring;
    });
    const skins = Array.from(
      { length: pleatRadii.length - 1 },
      (_, index) => {
        const skin = new THREE.Mesh(
          new THREE.CylinderGeometry(
            pleatRadii[index + 1],
            pleatRadii[index],
            1,
            40,
            1,
            true,
          ),
          bellowsMaterial,
        );
        group.add(skin);
        return skin;
      },
    );
    const water = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(
        bellowsWaterRadius,
        bellowsWaterRadius,
        1,
        40,
      ),
      waterMaterial,
    ), `${side}-water-volume-inside-lantern-bellows`);
    group.add(water);
    return { group, rings, skins, water };
  };
  const leftBellows = makeBellows('left');
  const rightBellows = makeBellows('right');

  const addPipePair = (points, role, waterRole, outerRadius = 0.24) => {
    const shell = makeTube(points, outerRadius, shellMaterial, role);
    const water = makeTube(
      points,
      outerRadius * 0.60,
      waterMaterial,
      waterRole,
    );
    root.add(shell, water);
    return { shell, water };
  };
  const commonSuction = addPipePair([
    new THREE.Vector3(0, -2.16, 0.55),
    new THREE.Vector3(0, -1.52, 0.55),
    new THREE.Vector3(0, -1.05, 0.55),
  ], 'common-suction-pipe-below-valve-chest',
  'water-in-common-suction-pipe', 0.29);
  const leftSuctionBranch = addPipePair([
    new THREE.Vector3(0, -1.05, 0.55),
    new THREE.Vector3(-0.68, -0.91, 0.55),
    valveSeats.leftSuction,
    new THREE.Vector3(-1.73, -0.24, 0.34),
  ], 'left-suction-branch-through-left-inlet-check',
  'water-passing-to-left-bellows-on-expansion', 0.22);
  const rightSuctionBranch = addPipePair([
    new THREE.Vector3(0, -1.05, 0.55),
    new THREE.Vector3(0.68, -0.91, 0.55),
    valveSeats.rightSuction,
    new THREE.Vector3(1.73, -0.24, 0.34),
  ], 'right-suction-branch-through-right-inlet-check',
  'water-passing-to-right-bellows-on-expansion', 0.22);
  const leftDeliveryBranch = addPipePair([
    new THREE.Vector3(-1.73, -0.24, -0.20),
    new THREE.Vector3(-1.15, -0.02, 0.20),
    valveSeats.leftDelivery,
    new THREE.Vector3(0, 0.43, 0.20),
  ], 'left-delivery-branch-through-left-outlet-check',
  'water-expelled-from-left-bellows-on-compression', 0.22);
  const rightDeliveryBranch = addPipePair([
    new THREE.Vector3(1.73, -0.24, -0.20),
    new THREE.Vector3(1.15, -0.02, 0.20),
    valveSeats.rightDelivery,
    new THREE.Vector3(0, 0.43, 0.20),
  ], 'right-delivery-branch-through-right-outlet-check',
  'water-expelled-from-right-bellows-on-compression', 0.22);
  const commonDischarge = addPipePair([
    new THREE.Vector3(0, 0.43, 0.20),
    new THREE.Vector3(0, 1.40, 0.08),
    new THREE.Vector3(0, 2.72, -0.12),
    new THREE.Vector3(0, 4.12, -0.12),
  ], 'common-upright-discharge-pipe-behind-rocking-beam',
  'water-in-common-discharge-riser', 0.29);

  const suctionMouth = horizontalRing(0.30, 0.055, darkMaterial);
  suctionMouth.position.set(0, -2.16, 0.55);
  root.add(suctionMouth);
  const dischargeMouth = horizontalRing(0.30, 0.055, darkMaterial);
  dischargeMouth.position.set(0, 4.12, -0.12);
  root.add(dischargeMouth);

  const valveBodyMaterial = shellMaterial.clone();
  valveBodyMaterial.opacity = 0.42;
  const makeCheckValve = (position, material, role) => {
    const valve = addRole(new THREE.Group(), role);
    valve.position.copy(position);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.31, 0.42, 32, 1, true),
      valveBodyMaterial,
    );
    valve.add(body);
    const seat = horizontalRing(0.23, 0.045, darkMaterial);
    seat.position.y = -0.10;
    valve.add(seat);
    const disk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.07, 30),
      material,
    );
    disk.position.y = -0.05;
    valve.add(disk);
    valve.userData.disk = disk;
    valve.userData.closedDiskY = -0.05;
    root.add(valve);
    return valve;
  };
  const leftSuctionValve = makeCheckValve(
    valveSeats.leftSuction,
    suctionValveMaterial,
    'left-suction-check-opening-only-while-left-bellows-expands',
  );
  const rightSuctionValve = makeCheckValve(
    valveSeats.rightSuction,
    suctionValveMaterial,
    'right-suction-check-opening-only-while-right-bellows-expands',
  );
  const leftDeliveryValve = makeCheckValve(
    valveSeats.leftDelivery,
    deliveryValveMaterial,
    'left-delivery-check-opening-only-while-left-bellows-compresses',
  );
  const rightDeliveryValve = makeCheckValve(
    valveSeats.rightDelivery,
    deliveryValveMaterial,
    'right-delivery-check-opening-only-while-right-bellows-compresses',
  );

  const updateBellows = (bellows, fixedX, topCenter, topY) => {
    const bottom = new THREE.Vector3(fixedX, bellowsFloorY, 0);
    const top = new THREE.Vector3(topCenter.x, topY, 0);
    const ringPoints = bellows.rings.map((ring, index) => {
      const fraction = index / (bellows.rings.length - 1);
      const point = bottom.clone().lerp(top, fraction);
      ring.position.copy(point);
      return point;
    });
    bellows.skins.forEach((skin, index) => {
      setCylinderBetween(skin, ringPoints[index], ringPoints[index + 1]);
    });
    const waterBottom = bottom.clone();
    waterBottom.y += 0.05;
    const waterTop = top.clone();
    waterTop.y -= 0.05;
    setCylinderBetween(bellows.water, waterBottom, waterTop);
  };

  const update = (time) => {
    const state = stateAtTime(time);
    beam.rotation.z = state.beamAngle;
    leftTopPlate.position.copy(state.leftTopPlateCenter);
    rightTopPlate.position.copy(state.rightTopPlateCenter);
    setCylinderBetween(
      leftConnectingRod,
      state.leftTopPlateCenter,
      state.leftBeamPin,
    );
    setCylinderBetween(
      rightConnectingRod,
      state.rightTopPlateCenter,
      state.rightBeamPin,
    );
    updateBellows(
      leftBellows,
      bellowsCenterXs.left,
      state.leftTopPlateCenter,
      state.leftBellowsTopY,
    );
    updateBellows(
      rightBellows,
      bellowsCenterXs.right,
      state.rightTopPlateCenter,
      state.rightBellowsTopY,
    );
    leftSuctionValve.userData.disk.position.y =
      leftSuctionValve.userData.closedDiskY
        + state.leftSuctionValveLift;
    rightSuctionValve.userData.disk.position.y =
      rightSuctionValve.userData.closedDiskY
        + state.rightSuctionValveLift;
    leftDeliveryValve.userData.disk.position.y =
      leftDeliveryValve.userData.closedDiskY
        + state.leftDeliveryValveLift;
    rightDeliveryValve.userData.disk.position.y =
      rightDeliveryValve.userData.closedDiskY
        + state.rightDeliveryValveLift;
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    beamAmplitude,
    beamPinHalfSpan,
    beamPivot,
    bellowsCenterXs,
    bellowsEffectiveArea,
    bellowsFloorY,
    bellowsWaterRadius,
    connectingRodLength,
    cycleDuration,
    groundY,
    inputAngularSpeed,
    maximumValveLift,
    topPlateHalfThickness,
    valveSeats,
  };
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'double-lantern-bellows-pump-with-common-rocking-lever-opposed-strokes-four-checks-and-shared-suction-discharge',
    blocks: {
      base,
      beam,
      commonDischarge,
      commonSuction,
      leftBellows,
      leftBottomPlate,
      leftConnectingRod,
      leftDeliveryBranch,
      leftDeliveryValve,
      leftSuctionBranch,
      leftSuctionValve,
      leftTopPlate,
      pivotAxle,
      rightBellows,
      rightBottomPlate,
      rightConnectingRod,
      rightDeliveryBranch,
      rightDeliveryValve,
      rightSuctionBranch,
      rightSuctionValve,
      rightTopPlate,
      standard,
      valveChest,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      leftBellowsIndependent: false,
      leftDeliveryCheckIndependent: false,
      leftSuctionCheckIndependent: false,
      operatingDegreesOfFreedom: 1,
      rightBellowsIndependent: false,
      rightDeliveryCheckIndependent: false,
      rightSuctionCheckIndependent: false,
    },
    dynamics: {
      fullAirRarefactionWaterPressureValveImpactLeakageBellowsElasticityAndLeverForceModeled:
        false,
      checkValveModel:
        'Four reconstructed vertical lift checks use disjoint C2 cubic stroke lobes. Each bellows suction check opens only while its volume increases, its delivery check opens only while volume decreases, and every disk is seated at reversal.',
      flowModel:
        'Both primed bellows use the same effective area. The central beam gives exactly opposite vertical plate velocities, so at every moving instant the expanding side suction flow exactly equals the compressing side delivery flow. Pressure losses, leakage, trapped air and pipe compliance are omitted.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'One centrally pivoted hand lever carries equal-radius pins on opposite sides. Equal vertical rods hold the two lantern-bellows top plates at opposite heights: as one pleated chamber distends and fills through its own suction check, the other compresses and expels through its own delivery check. The two inlet branches share one suction pipe, the two outlet branches share one upright discharge pipe, and all four checks seat together at each reversal.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'single-rocking-beam-with-opposed-lantern-bellows-expansion-and-compression',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 453 page supplies Brown\'s static engraving and caption; its Animated control is unavailable and the page contains no Canvas mechanism or timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      beamAngle: sourceState.beamAngle,
      leftBellowsHeight: sourceState.leftBellowsHeight,
      leftDeliveryValveOpen: sourceState.leftDeliveryValveOpen,
      leftSuctionValveOpen: sourceState.leftSuctionValveOpen,
      mode: sourceState.mode,
      rightBellowsHeight: sourceState.rightBellowsHeight,
      rightDeliveryValveOpen: sourceState.rightDeliveryValveOpen,
      rightSuctionValveOpen: sourceState.rightSuctionValveOpen,
    },
    sourceReference: {
      brownPlate453: {
        approximateBeamPivotPixels: [239, 117],
        approximateCommonDischargePixels: [252, 82],
        approximateCommonSuctionPixels: [253, 468],
        approximateLeftBellowsCenterPixels: [137, 270],
        approximateRightBellowsCenterPixels: [352, 298],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the machine is a double lantern-bellows pump',
          'one common lever distends one bellows while compressing the other',
          'distension rarefies the enclosed air and admits water through the suction pipe',
          'simultaneous compression expels the other bellows contents through the discharge pipe',
          'the valves work as in the ordinary force pump',
        ],
        engravingEvidence:
          'Brown’s section shows one centrally pivoted beam with a vertical rod to each bellows top, a tall distended left bellows, a short compressed right bellows, a shared lower valve chest and suction stem, and a central upright discharge passage.',
        reconstructionDisclosure:
          'Brown gives no bellows diameter, stroke, pleat count, rod length, valve lift, exact flap geometry, water pressure, leakage, elasticity, applied force or timing. Those dimensions, vertical poppet-style checks, transparent cutaway, colors and 5.4-second harmonic beam cycle are independently engineered. The single beam, opposed bellows states, two checks per chamber, common suction and common discharge are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 453',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      chamberBalance:
        'For each bellows dV/dt=Q_suction-Q_delivery exactly; because v_right=-v_left, total suction equals total delivery at every instant.',
      leverConstraint:
        'The two beam pins lie at equal opposite radii and both connecting rods remain vertical with constant length, making the two top-plate vertical displacements exactly equal and opposite.',
      valveSequence:
        'sin(phi)>0 opens left delivery plus right suction; sin(phi)<0 opens left suction plus right delivery; sin(phi)=0 seats all four checks.',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.65, groundY, -1.55),
    new THREE.Vector3(3.90, 4.25, 1.55),
  );
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraDirection = new THREE.Vector3(6.8, 4.8, 10.8);
  root.userData.groundFloorY = groundY;
  markShadows(root);
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredLanternBellowsPumpMovement(movement) {
  if (movement.id !== 453) return null;
  return doubleLanternBellowsPump(movement);
}
