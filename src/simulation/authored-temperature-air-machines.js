import {makeTemperatureBevel,temperatureBevelPhases} from './temperature-bevel-pair.js';
import { correctTemperatureAirMachine } from './thermal-steam-working-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeGear,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (10 + x * (-15 + 6 * x));
}

function smootherStepDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * x ** 2 * (1 - x) ** 2;
}

function smootherStepSecondDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * x * (1 - x) * (1 - 2 * x);
}

function cylinderAlongZ(radius, length, material, segments = 30) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function createTank({
  centerX,
  tankWidth,
  tankDepth,
  tankBottomY,
  tankTopY,
  waterTopY,
  waterMaterial,
  wallMaterial,
  rolePrefix,
}) {
  const tank = addRole(new THREE.Group(), `${rolePrefix}-cistern`);
  const wallThickness = 0.14;
  const tankHeight = tankTopY - tankBottomY;
  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(tankWidth, wallThickness, tankDepth),
    wallMaterial,
  ), `${rolePrefix}-cistern-base`);
  base.position.set(centerX, tankBottomY, 0);
  tank.add(base);

  for (const side of [-1, 1]) {
    const endWall = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, tankHeight, tankDepth),
      wallMaterial,
    ), `${rolePrefix}-cistern-end-wall-${side < 0 ? 'left' : 'right'}`);
    endWall.position.set(
      centerX + side * (tankWidth / 2 - wallThickness / 2),
      tankBottomY + tankHeight / 2,
      0,
    );
    tank.add(endWall);
  }

  const backWall = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(tankWidth, tankHeight, wallThickness),
    wallMaterial,
  ), `${rolePrefix}-cistern-back-wall`);
  backWall.position.set(
    centerX,
    tankBottomY + tankHeight / 2,
    -tankDepth / 2 + wallThickness / 2,
  );
  tank.add(backWall);

  const cutawayFront = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(tankWidth, 0.34, wallThickness),
    wallMaterial,
  ), `${rolePrefix}-cistern-cutaway-front`);
  cutawayFront.position.set(
    centerX,
    tankBottomY + 0.17,
    tankDepth / 2 - wallThickness / 2,
  );
  tank.add(cutawayFront);

  const waterHeight = waterTopY - tankBottomY - wallThickness;
  const water = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(
      tankWidth - 2 * wallThickness,
      waterHeight,
      tankDepth - 2 * wallThickness,
    ),
    waterMaterial,
  ), `${rolePrefix}-water-body`);
  water.position.set(
    centerX,
    tankBottomY + wallThickness / 2 + waterHeight / 2,
    0,
  );
  tank.add(water);
  return {
    base,
    cutawayFront,
    tank,
    water,
  };
}

function temperatureAirMachine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 13.8;
  const operationEndPhase = 0.68;
  const thermalResetStartPhase = 0.82;
  const totalScrewTurns = 6;
  const initialColdTemperatureKelvin = 293.15;
  const initialWarmTemperatureKelvin = 313.15;
  const equilibriumTemperatureKelvin = (
    initialColdTemperatureKelvin + initialWarmTemperatureKelvin
  ) / 2;
  const initialTemperatureDifferenceKelvin =
    initialWarmTemperatureKelvin - initialColdTemperatureKelvin;
  const ambientPressurePascal = 101325;
  const referenceAirVolumeCubicMeter = 0.0001;
  const tankBottomY = -1.18;
  const tankTopY = 0.74;
  const waterTopY = 0.54;
  const tankDepth = 1.74;
  const coldTankCenterX = -2.15;
  const warmTankCenterX = 1.55;
  const coldTankWidth = 3.35;
  const warmTankWidth = 3.25;
  const screwLowerPoint = new THREE.Vector3(-2.72, -0.76, 0);
  const screwUpperPoint = new THREE.Vector3(0.10, 1.10, 0);
  const screwAxis = screwUpperPoint.clone().sub(screwLowerPoint).normalize();
  const screwLength = screwLowerPoint.distanceTo(screwUpperPoint);
  const screwFlightTurns = 6;
  const screwPitch = screwLength / screwFlightTurns;
  const screwRadius = 0.30;
  const screwBevelPitchRadius = 0.32;
  const outputBevelPitchRadius = 0.32;
  const transferPinionTeeth = 18;
  const wheelGearTeeth = 54;
  const transferPinionPitchRadius = 0.34;
  const wheelGearPitchRadius = transferPinionPitchRadius
    * wheelGearTeeth / transferPinionTeeth;
  const gearCenterDirection = new THREE.Vector3(0.74, -0.673, 0)
    .normalize();
  const bevelApexExtension = .56;
  const transferCenter = screwUpperPoint.clone().addScaledVector(screwAxis,bevelApexExtension);
  const wheelCenter = transferCenter.clone().addScaledVector(
    gearCenterDirection,
    transferPinionPitchRadius + wheelGearPitchRadius,
  );
  const waterWheelRadius = 0.84;
  const waterWheelBladeCount = 14;
  const wheelMeshPhase = Math.PI / wheelGearTeeth;
  const waterRaisingRotationSign = 1;
  const operatingScrewRotationSign = -1;
  const bubbleCount = 14;
  const bubbleBaseRadius = 0.055;
  const groundY = tankBottomY - 0.09;

  const wallMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.72,
  });
  const coldInitialColor = new THREE.Color(0x3e83a4);
  const warmInitialColor = new THREE.Color(0xd57949);
  const equilibriumColor = new THREE.Color(0x6c9297);
  const coldWaterMaterial = matte(coldInitialColor, {
    transparent: true,
    opacity: 0.43,
    roughness: 0.24,
  });
  const warmWaterMaterial = matte(warmInitialColor, {
    transparent: true,
    opacity: 0.43,
    roughness: 0.24,
  });
  coldWaterMaterial.depthWrite = false;
  warmWaterMaterial.depthWrite = false;

  const coldTankParts = createTank({
    centerX: coldTankCenterX,
    rolePrefix: 'natural-temperature-left',
    tankBottomY,
    tankDepth,
    tankTopY,
    tankWidth: coldTankWidth,
    wallMaterial,
    waterMaterial: coldWaterMaterial,
    waterTopY,
  });
  const warmTankParts = createTank({
    centerX: warmTankCenterX,
    rolePrefix: 'higher-temperature-right',
    tankBottomY,
    tankDepth,
    tankTopY,
    tankWidth: warmTankWidth,
    wallMaterial,
    waterMaterial: warmWaterMaterial,
    waterTopY,
  });
  root.add(coldTankParts.tank, warmTankParts.tank);

  const screwMount = addRole(new THREE.Group(),
    'inclined-archimedean-screw-mount');
  screwMount.position.copy(screwLowerPoint).add(screwUpperPoint)
    .multiplyScalar(0.5);
  screwMount.quaternion.setFromUnitVectors(Y_AXIS, screwAxis);
  root.add(screwMount);

  const screwBarrelMaterial = matte(PALETTE.white, {
    transparent: true,
    opacity: 0.29,
    roughness: 0.24,
    side: THREE.DoubleSide,
  });
  screwBarrelMaterial.depthWrite = false;
  const screwBarrel = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      screwRadius + 0.055,
      screwRadius + 0.055,
      screwLength,
      42,
      1,
      true,
    ),
    screwBarrelMaterial,
  ), 'transparent-inclined-screw-barrel');
  screwMount.add(screwBarrel);

  const screwRotor = addRole(new THREE.Group(),
    'reversed-archimedean-screw-rotor');
  screwMount.add(screwRotor);
  const screwShaftMaterial = matte(PALETTE.ink, {
    metalness: 0.44,
    roughness: 0.38,
  });
  const screwShaft = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, screwLength + 0.62, 48),
    screwShaftMaterial,
  ), 'archimedean-screw-shaft');
  screwShaft.position.y = .10;
  screwRotor.add(screwShaft);

  const helixPoints = [];
  const helixSamples = 220;
  for (let sample = 0; sample <= helixSamples; sample += 1) {
    const fraction = sample / helixSamples;
    const angle = FULL_TURN * screwFlightTurns * fraction;
    helixPoints.push(new THREE.Vector3(
      screwRadius * Math.cos(angle),
      -screwLength / 2 + screwLength * fraction,
      screwRadius * Math.sin(angle),
    ));
  }
  const screwHelixCurve = new THREE.CatmullRomCurve3(
    helixPoints,
    false,
    'centripetal',
  );
  const screwFlight = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(screwHelixCurve, 300, 0.047, 11, false),
    matte(PALETTE.accent, { metalness: 0.36, roughness: 0.42 }),
  ), 'right-handed-air-conveying-screw-flight');
  screwRotor.add(screwFlight);

  const bevelLayout=temperatureBevelPhases(screwAxis,screwMount.quaternion);
  const inputBevel=makeTemperatureBevel({axis:bevelLayout.inputAxis,phase:bevelLayout.inputPhase,color:PALETTE.driver,role:'screw-shaft-input-bevel'});
  inputBevel.position.y=screwLength/2+bevelApexExtension;
  screwRotor.add(inputBevel);

  const receiver = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 38, 24),
    matte(PALETTE.driven, {
      metalness: 0.18,
      roughness: 0.52,
      transparent: true,
      opacity: 0.64,
    }),
  ), 'submerged-air-receiver-at-lower-screw-end');
  receiver.position.copy(screwLowerPoint);
  root.add(receiver);

  const outputShaftRotor = addRole(new THREE.Group(),
    'orthogonal-bevel-output-and-transfer-pinion');
  outputShaftRotor.position.copy(transferCenter);
  root.add(outputShaftRotor);
  const outputBevel=makeTemperatureBevel({axis:bevelLayout.outputAxis,phase:bevelLayout.outputPhase,color:PALETTE.driven,role:'orthogonal-output-bevel'});
  outputShaftRotor.add(outputBevel);

  const transferPinion = addRole(makeGear({
    color: PALETTE.accent,
    depth: 0.22,
    radius: transferPinionPitchRadius,
    teeth: transferPinionTeeth,
    addendum: 2*transferPinionPitchRadius/transferPinionTeeth,
    dedendum: 2.5*transferPinionPitchRadius/transferPinionTeeth,
  }), 'bevel-output-transfer-pinion');
  transferPinion.position.z = 0.18;
  outputShaftRotor.add(transferPinion);

  const outputAxle = cylinderAlongZ(
    0.065,
    0.68,
    screwShaftMaterial,
    22,
  );
  outputAxle.position.z=-.48;
  outputShaftRotor.add(outputAxle);

  const waterWheelAssembly = addRole(new THREE.Group(),
    'warm-cistern-water-wheel-assembly');
  waterWheelAssembly.position.copy(wheelCenter);
  root.add(waterWheelAssembly);
  const waterWheelRotor = addRole(new THREE.Group(),
    'geared-bubble-driven-water-wheel-rotor');
  waterWheelAssembly.add(waterWheelRotor);

  const wheelGear = addRole(makeGear({
    color: PALETTE.brass,
    depth: 0.24,
    radius: wheelGearPitchRadius,
    teeth: wheelGearTeeth,
    addendum: 2*transferPinionPitchRadius/transferPinionTeeth,
    dedendum: 2.5*transferPinionPitchRadius/transferPinionTeeth,
  }), 'water-wheel-ring-gear');
  wheelGear.position.z = -0.56;
  waterWheelRotor.add(wheelGear);

  const wheelMaterial = matte(PALETTE.driver, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const wheelRims = [0.08, 0.48].map((z, index) => {
    const rim = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(waterWheelRadius, 0.064, 10, 72),
      wheelMaterial,
    ), `water-wheel-rim-${index + 1}`);
    rim.position.z = z;
    waterWheelRotor.add(rim);
    return rim;
  });
  const wheelBlades = [];
  for (let index = 0; index < waterWheelBladeCount; index += 1) {
    const angle = index * FULL_TURN / waterWheelBladeCount;
    const blade = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.12, 0.42),
      wheelMaterial,
    ), `water-wheel-bubble-blade-${index + 1}`);
    blade.position.set(
      Math.cos(angle) * waterWheelRadius * 0.76,
      Math.sin(angle) * waterWheelRadius * 0.76,
      0.28,
    );
    blade.rotation.z = angle;
    waterWheelRotor.add(blade);
    wheelBlades.push(blade);
  }
  const wheelHub = cylinderAlongZ(0.16, 0.70, screwShaftMaterial, 30);
  waterWheelRotor.add(wheelHub);
  const fixedWheelAxle = addRole(cylinderAlongZ(
    0.068,
    tankDepth + 0.28,
    screwShaftMaterial,
    24,
  ), 'fixed-water-wheel-horizontal-axle');
  waterWheelAssembly.add(fixedWheelAxle);

  const outletPoint = new THREE.Vector3(
    wheelCenter.x - 0.56,
    -0.70,
    0.54,
  );
  const pipePoints = [
    screwLowerPoint.clone().addScaledVector(screwAxis,-.22),
    screwLowerPoint.clone().addScaledVector(screwAxis,-.32),
    new THREE.Vector3(-3.18, -0.38, -0.30),
    new THREE.Vector3(-3.22, 0.72, -0.38),
    new THREE.Vector3(-2.92, 1.73, -0.38),
    new THREE.Vector3(-2.45, 1.92, -0.38),
    new THREE.Vector3(0.10, 1.92, -0.38),
    new THREE.Vector3(2.56, 1.86, -0.38),
    new THREE.Vector3(2.86, 1.52, -0.32),
    new THREE.Vector3(2.88, 0.28, -0.18),
    new THREE.Vector3(2.70, -0.68, 0.02),
    new THREE.Vector3(1.82, -0.88, 0.36),
    new THREE.Vector3(outletPoint.x, -0.89, outletPoint.z),
    outletPoint.clone(),
  ];
  const pressurePipeCurve = new THREE.CatmullRomCurve3(
    pipePoints,
    false,
    'centripetal',
  );
  const bubbleRiseEnd = new THREE.Vector3(
    wheelCenter.x - 0.44,
    waterTopY + 0.32,
    0.24,
  );
  const bubbleRiseCurve = new THREE.CubicBezierCurve3(
    outletPoint.clone(),
    outletPoint.clone().add(new THREE.Vector3(0, 0.38, 0)),
    bubbleRiseEnd.clone().add(new THREE.Vector3(-0.02, -0.40, 0)),
    bubbleRiseEnd.clone(),
  );
  const airPath = new THREE.CurvePath();
  airPath.add(pressurePipeCurve);
  airPath.add(bubbleRiseCurve);
  const pressurePipeLength = pressurePipeCurve.getLength();
  const bubbleRiseLength = bubbleRiseCurve.getLength();
  const airPathLength = pressurePipeLength + bubbleRiseLength;
  const warmBathEntryDistance = pressurePipeLength;

  const conduitMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.45,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
  });
  conduitMaterial.depthWrite = false;
  const airConduit = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(pressurePipeCurve, 260, 0.090, 14, false),
    conduitMaterial,
  ), 'air-pipe-ascending-crossing-descending-to-wheel-underside');
  root.add(airConduit);

  const airBubbleMaterial = new THREE.MeshBasicMaterial({
    color: 0xbfefff,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.96,
  });
  const airBubbles = Array.from({ length: bubbleCount }, (_, index) => {
    const bubble = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(bubbleBaseRadius, 20, 14),
      airBubbleMaterial,
    ), `smooth-air-bubble-${index + 1}`);
    bubble.renderOrder = 4;
    root.add(bubble);
    return bubble;
  });

  const thermometerMaterial = matte(PALETTE.white, {
    transparent: true,
    opacity: 0.38,
    roughness: 0.18,
    side: THREE.DoubleSide,
  });
  thermometerMaterial.depthWrite = false;
  const thermometerColumns = [];
  const thermometerGroups = [
    { color: 0x3d88ad, x: -3.45, role: 'cold' },
    { color: 0xd55f3f, x: 3.02, role: 'warm' },
  ].map(({ color, x, role }) => {
    const group = addRole(new THREE.Group(), `${role}-bath-thermometer`);
    group.position.set(x, 0.87, 0.70);
    root.add(group);
    const casing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.92, 18, 1, true),
      thermometerMaterial,
    );
    group.add(casing);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 20, 14),
      matte(color, { roughness: 0.34 }),
    );
    bulb.position.y = -0.48;
    group.add(bulb);
    const column = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1, 14),
      matte(color, { roughness: 0.34 }),
    ), `${role}-temperature-column`);
    group.add(column);
    thermometerColumns.push(column);
    return group;
  });

  const stateAtPhase = (unwrappedPhase) => {
    const rawPhase = positiveModulo(unwrappedPhase, 1);
    const phase = [0, operationEndPhase, thermalResetStartPhase]
      .find((boundary) => Math.abs(rawPhase - boundary) < 1e-12)
      ?? rawPhase;
    let rotationProgress = 1;
    let rotationProgressRate = 0;
    let rotationProgressAcceleration = 0;
    let temperatureContrast = 0;
    let temperatureContrastRate = 0;
    let regime;

    if (phase < operationEndPhase) {
      const local = phase / operationEndPhase;
      const intervalTime = operationEndPhase * cycleDuration;
      rotationProgress = smootherStep(local);
      rotationProgressRate = smootherStepDerivative(local) / intervalTime;
      rotationProgressAcceleration = smootherStepSecondDerivative(local)
        / intervalTime ** 2;
      temperatureContrast = 1 - rotationProgress;
      temperatureContrastRate = -rotationProgressRate;
      regime = local < 0.32
        ? 'external-start-turns-screw-opposite-water-raising-direction'
        : 'proposed-expanded-air-drive-runs-down-as-baths-equilibrate';
    } else if (phase < thermalResetStartPhase) {
      temperatureContrast = 0;
      regime = 'equal-temperature-baths-and-geared-machine-stopped';
    } else {
      const local = (phase - thermalResetStartPhase)
        / (1 - thermalResetStartPhase);
      const intervalTime = (1 - thermalResetStartPhase) * cycleDuration;
      temperatureContrast = smootherStep(local);
      temperatureContrastRate = smootherStepDerivative(local) / intervalTime;
      regime = 'explicit-external-heat-reset-restores-temperature-gradient';
    }

    const coldTemperatureKelvin = equilibriumTemperatureKelvin
      - initialTemperatureDifferenceKelvin * temperatureContrast / 2;
    const warmTemperatureKelvin = equilibriumTemperatureKelvin
      + initialTemperatureDifferenceKelvin * temperatureContrast / 2;
    const temperatureDifferenceKelvin = warmTemperatureKelvin
      - coldTemperatureKelvin;
    const screwAngle = operatingScrewRotationSign * totalScrewTurns
      * FULL_TURN * rotationProgress;
    const screwAngularVelocity = operatingScrewRotationSign
      * totalScrewTurns * FULL_TURN * rotationProgressRate;
    const screwAngularAcceleration = operatingScrewRotationSign
      * totalScrewTurns * FULL_TURN * rotationProgressAcceleration;
    const bevelOutputAngle = -screwAngle
      * screwBevelPitchRadius / outputBevelPitchRadius;
    const bevelOutputAngularVelocity = -screwAngularVelocity
      * screwBevelPitchRadius / outputBevelPitchRadius;
    const bevelOutputAngularAcceleration = -screwAngularAcceleration
      * screwBevelPitchRadius / outputBevelPitchRadius;
    const waterWheelAngle = wheelMeshPhase - bevelOutputAngle
      * transferPinionPitchRadius / wheelGearPitchRadius;
    const waterWheelAngularVelocity = -bevelOutputAngularVelocity
      * transferPinionPitchRadius / wheelGearPitchRadius;
    const waterWheelAngularAcceleration = -bevelOutputAngularAcceleration
      * transferPinionPitchRadius / wheelGearPitchRadius;
    const airAxialDisplacement = screwPitch * screwAngle / FULL_TURN;
    const airAxialVelocity = screwPitch * screwAngularVelocity / FULL_TURN;
    const airTransportDistance = -airAxialDisplacement;
    const airPathSpeed = -airAxialVelocity;
    const warmToColdAbsoluteTemperatureRatio = warmTemperatureKelvin
      / coldTemperatureKelvin;
    const warmedAirVolumeCubicMeter = referenceAirVolumeCubicMeter
      * warmToColdAbsoluteTemperatureRatio;
    const expansionBoundaryWorkJoule = ambientPressurePascal
      * (warmedAirVolumeCubicMeter - referenceAirVolumeCubicMeter);
    return {
      airAxialDisplacement,
      airAxialVelocity,
      airPathSpeed,
      airTransportDistance,
      bevelOutputAngle,
      bevelOutputAngularAcceleration,
      bevelOutputAngularVelocity,
      coldTemperatureKelvin,
      expansionBoundaryWorkJoule,
      phase,
      regime,
      rotationProgress,
      rotationProgressAcceleration,
      rotationProgressRate,
      screwAngle,
      screwAngularAcceleration,
      screwAngularVelocity,
      temperatureContrast,
      temperatureContrastRate,
      temperatureDifferenceKelvin,
      warmedAirVolumeCubicMeter,
      warmTemperatureKelvin,
      warmToColdAbsoluteTemperatureRatio,
      waterWheelAngle,
      waterWheelAngularAcceleration,
      waterWheelAngularVelocity,
    };
  };

  const stateAtTime = (time) => stateAtPhase(time / cycleDuration);

  const bubbleStateAt = (index, state) => {
    const spacing = airPathLength / bubbleCount;
    const pathDistance = positiveModulo(
      state.airTransportDistance + index * spacing,
      airPathLength,
    );
    const pathFraction = pathDistance / airPathLength;
    const position = airPath.getPointAt(pathFraction);
    const warmProgress = pathDistance <= warmBathEntryDistance
      ? 0
      : smootherStep((pathDistance - warmBathEntryDistance)
        / bubbleRiseLength);
    const localAirTemperatureKelvin = THREE.MathUtils.lerp(
      state.coldTemperatureKelvin,
      state.warmTemperatureKelvin,
      warmProgress,
    );
    const volumeRatio = localAirTemperatureKelvin
      / state.coldTemperatureKelvin;
    const radiusScale = Math.cbrt(volumeRatio);
    const endFadeDistance = airPathLength * 0.045;
    const fade = smootherStep(Math.min(
      pathDistance / endFadeDistance,
      (airPathLength - pathDistance) / endFadeDistance,
      1,
    ));
    return {
      fade,
      localAirTemperatureKelvin,
      pathDistance,
      pathFraction,
      position,
      radiusScale,
      visible: Math.abs(state.screwAngularVelocity) > 0.018
        && fade > 0.015,
      volumeRatio,
      warmProgress,
    };
  };

  const updateThermometer = (column, temperatureKelvin) => {
    const minimumKelvin = 288;
    const maximumKelvin = 318;
    const height = THREE.MathUtils.lerp(
      0.20,
      0.75,
      THREE.MathUtils.clamp(
        (temperatureKelvin - minimumKelvin)
          / (maximumKelvin - minimumKelvin),
        0,
        1,
      ),
    );
    column.scale.y = height;
    column.position.y = -0.45 + height / 2;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    screwRotor.rotation.y = state.screwAngle;
    outputShaftRotor.rotation.z = state.bevelOutputAngle;
    waterWheelRotor.rotation.z = state.waterWheelAngle;
    airBubbles.forEach((bubble, index) => {
      const bubbleState = bubbleStateAt(index, state);
      bubble.position.copy(bubbleState.position);
      const scale = bubbleState.radiusScale * bubbleState.fade;
      bubble.scale.setScalar(scale);
      bubble.visible = bubbleState.visible;
    });
    coldWaterMaterial.color.copy(equilibriumColor)
      .lerp(coldInitialColor, state.temperatureContrast);
    warmWaterMaterial.color.copy(equilibriumColor)
      .lerp(warmInitialColor, state.temperatureContrast);
    updateThermometer(
      thermometerColumns[0],
      state.coldTemperatureKelvin,
    );
    updateThermometer(
      thermometerColumns[1],
      state.warmTemperatureKelvin,
    );
  };

  const sourceState = stateAtPhase(0.24);
  const geometry = {
    airPathLength,
    bevelApexExtension,
    bevelApex: transferCenter.clone(),
    bevelLayout,
    ambientPressurePascal,
    bubbleBaseRadius,
    bubbleCount,
    bubbleRiseLength,
    coldTankCenterX,
    coldTankWidth,
    cycleDuration,
    equilibriumTemperatureKelvin,
    gearCenterDirection: gearCenterDirection.clone(),
    initialColdTemperatureKelvin,
    initialTemperatureDifferenceKelvin,
    initialWarmTemperatureKelvin,
    operationEndPhase,
    operatingScrewRotationSign,
    outputBevelPitchRadius,
    pressurePipeLength,
    referenceAirVolumeCubicMeter,
    screwAxis: screwAxis.clone(),
    screwBevelPitchRadius,
    screwFlightTurns,
    screwLength,
    screwLowerPoint: screwLowerPoint.clone(),
    screwPitch,
    screwRadius,
    screwUpperPoint: screwUpperPoint.clone(),
    tankBottomY,
    tankDepth,
    tankTopY,
    thermalResetStartPhase,
    totalScrewTurns,
    transferCenter: transferCenter.clone(),
    transferPinionPitchRadius,
    transferPinionTeeth,
    warmBathEntryDistance,
    warmTankCenterX,
    warmTankWidth,
    waterRaisingRotationSign,
    waterTopY,
    waterWheelBladeCount,
    waterWheelRadius,
    wheelCenter: wheelCenter.clone(),
    wheelGearPitchRadius,
    wheelGearTeeth,
    wheelMeshPhase,
  };

  root.userData = {
    airPath,
    archetype:
      'thermal-air-circulation-proposal-with-reversed-archimedean-screw-bubble-wheel-exact-gearing-and-unmaintained-temperature-gradient',
    blocks: {
      airBubbles,
      airConduit,
      coldTank: coldTankParts.tank,
      coldWater: coldTankParts.water,
      fixedWheelAxle,
      inputBevel,
      outputBevel,
      outputAxle,
      outputShaftRotor,
      receiver,
      screwBarrel,
      screwFlight,
      screwMount,
      screwRotor,
      screwShaft,
      thermometerColumns,
      thermometerGroups,
      transferPinion,
      warmTank: warmTankParts.tank,
      warmWater: warmTankParts.water,
      waterWheelAssembly,
      waterWheelRotor,
      wheelBlades,
      wheelGear,
      wheelRims,
    },
    bubbleRiseCurve,
    bubbleStateAt,
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      screwAndWheelIndependent: false,
      thermalGradientIsMechanicalDegreeOfFreedom: false,
      transferPinionAndWheelIndependent: false,
      wheelOperatingDegreesOfFreedom: 1,
    },
    dynamics: {
      airCompressibilityHydrostaticHeadBubbleSlipBladeDragGearFrictionHeatTransferRatesAndTankMixingSolved:
        false,
      airVolumeModel:
        'Displayed bubble volume follows V_warm/V_cold=T_warm/T_cold at common pressure; marker radius therefore follows the exact cube root of absolute-temperature ratio.',
      transientModel:
        'A prescribed C2 start turns the screw in the direction opposite water raising. The proposed coupled train then runs down while the finite bath temperature difference is driven to zero. No positive speed remains after equilibration.',
    },
    energyAudit: {
      brownIdentifiesMissingTemperatureMaintenance: true,
      externalHeatRequiredToRestoreGradient: true,
      lossesWouldReduceAvailableOutput: true,
      selfSustainingClaimAccepted: false,
      thermalResetIsPartOfHistoricalMachine: false,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'The inclined right-handed Archimedean screw is first turned opposite its water-raising direction, carrying air downward into a submerged receiver. Pressurized air rises through the external tube, crosses above the cisterns, descends to the underside of the warm-bath wheel, and bubbles upward on the wheel’s left side. A right-angle bevel pair and an external 18:54 gear mesh constrain wheel and screw speeds. The displayed temperature difference is finite and must be restored by an external heat source.',
    motion: {
      cycleDuration,
      motionType:
        'six-turn-c2-reversed-screw-start-geared-bubble-wheel-run-down-equilibrium-hold-and-explicit-external-thermal-reset',
    },
    pressurePipeCurve,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      sourcePrescribedAbsoluteTiming: false,
      sourcePrescribedNormalizedTiming: false,
    },
    sourcePose: {
      bubblePathPositions: Array.from({ length: bubbleCount }, (_, index) =>
        bubbleStateAt(index, sourceState).position.clone()),
      screwAngle: sourceState.screwAngle,
      waterWheelAngle: sourceState.waterWheelAngle,
    },
    sourceReference: {
      brownPlate469: {
        approximateAirPipeBoundsPixels: [82, 157, 357, 289],
        approximateApparatusBoundsPixels: [54, 154, 407, 307],
        approximateInclinedScrewBoundsPixels: [102, 245, 194, 174],
        approximateWaterWheelBoundsPixels: [286, 246, 123, 126],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 15,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the left cistern contains water at natural temperature',
          'the right cistern contains water at a higher temperature',
          'a water-wheel in the right cistern is geared to an Archimedean screw in the left',
          'the screw is started opposite its water-raising direction to force air downward',
          'air rises through a tube, crosses, descends, and reaches the underside of the wheel',
          'the claimed continuation relies on air-volume increase with temperature',
          'Brown states that the means of maintaining the temperature difference is not given',
        ],
        engravingEvidence:
          'Brown shows two open cisterns, an inclined enclosed screw at left, intersecting geared members above, a bladed wheel in the right bath, and one high external air conduit descending beneath that wheel.',
        reconstructionDisclosure:
          'Brown gives no screw hand, pitch, gear tooth counts, bath temperatures, air quantity, pressure, conduit section, heat-transfer law, torque, loss data or timing. A right-handed six-flight screw, two 24-tooth shared-apex bevels with Tredgold profiles, an exact 18:54 spur stage, 293.15/313.15 K initial baths, ideal-gas marker expansion, finite-gradient run-down, colors and a 13.8-second loop are independently engineered. The last loop branch explicitly adds external heat and is not attributed to the historical proposal.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 469',
    },
    stateAtPhase,
    stateAtTime,
    transmission: {
      airTransport:
        'axial air displacement=pitch*screw angle/(2*pi); negative operating screw angle carries air toward the submerged lower receiver',
      bevelMesh:
        'screw omega*input bevel pitch radius + output omega*output bevel pitch radius = 0',
      bubbleTorque:
        'air exits below the left side of the warm-bath wheel; upward buoyancy there has the same negative-z torque sign as the constrained wheel rotation',
      spurMesh:
        'output omega*18 + wheel omega*54 = 0, equivalently equal and opposite pitch-line velocities',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.86, -1.39, -1.10),
    new THREE.Vector3(3.30, 2.12, 1.10),
  );
  root.userData.cameraDistanceScale = 1.00;
  root.userData.cameraDirection = new THREE.Vector3(6.8, 4.4, 11.8);
  root.userData.groundFloorY = groundY;

  correctTemperatureAirMachine(root);
  markShadows(root);
  for (const object of [coldTankParts.water, warmTankParts.water,
    screwBarrel, airConduit, ...airBubbles]) {
    object.castShadow = false;
  }
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredTemperatureAirMachineMovement(movement) {
  if (movement.id !== 469) return null;
  return temperatureAirMachine(movement);
}
