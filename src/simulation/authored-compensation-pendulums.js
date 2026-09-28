import { correctCompensationJournals } from './pendulum-journal-parts.js';
import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongX(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongY(radius, length, material, segments = 36) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function torusAroundY(majorRadius, tubeRadius, material, segments = 64) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(majorRadius, tubeRadius, 10, segments),
    material,
  );
  torus.rotation.x = Math.PI / 2;
  return torus;
}

function tubeThrough(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 48, radius, 10, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function mercurialCompensationPendulum(movement) {
  const root = new THREE.Group();

  // Brown's drawing gives the topology but no material dimensions. The
  // static plate is measured here to retain its proportions. Thermal travel
  // is deliberately magnified, while the mercury level is solved from a
  // transparent three-body physical-pendulum model so I/(M d), the distance
  // to the center of oscillation, remains exactly constant at every shown
  // temperature.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterSuspension = new THREE.Vector2(265, 11);
  const sourceRasterAdjusterCenter = new THREE.Vector2(266, 82);
  const sourceRasterJarTop = new THREE.Vector2(264, 121);
  const sourceRasterJarBottom = new THREE.Vector2(264, 496);
  const sourceRasterJarLeft = new THREE.Vector2(177, 310);
  const sourceRasterJarRight = new THREE.Vector2(350, 310);
  const sourceRasterMercuryTop = new THREE.Vector2(264, 230);
  const sourceRasterMercuryBottom = new THREE.Vector2(264, 480);
  const sourceRasterRodEnd = new THREE.Vector2(265, 444);
  const sourceRasterLeftClamp = new THREE.Vector2(178, 169);
  const sourceRasterRightClamp = new THREE.Vector2(350, 169);

  const pivot = new THREE.Vector3(0, 4.80, 0);
  const jarLength = 7.30;
  const sourceScale = jarLength / (
    sourceRasterJarBottom.y - sourceRasterJarTop.y
  );
  const referenceJarCenterDistance = (
    (sourceRasterJarTop.y + sourceRasterJarBottom.y) / 2
      - sourceRasterSuspension.y
  ) * sourceScale;
  const referenceRodLength = (
    sourceRasterRodEnd.y - sourceRasterSuspension.y
  ) * sourceScale;
  const referenceMercuryBottomDistance = (
    sourceRasterMercuryBottom.y - sourceRasterSuspension.y
  ) * sourceScale;
  const referenceFillHeight = (
    sourceRasterMercuryBottom.y - sourceRasterMercuryTop.y
  ) * sourceScale;
  const jarOuterRadius = (
    sourceRasterJarRight.x - sourceRasterJarLeft.x
  ) * sourceScale / 2;
  const jarInnerRadius = jarOuterRadius * 0.88;
  const jarIntrinsicRadiusOfGyrationSquared = jarLength ** 2 / 12
    + jarOuterRadius ** 2 / 2;

  const rodMass = 0.55;
  const jarMass = 1.40;
  const mercuryMass = 9.50;
  const totalMass = rodMass + jarMass + mercuryMass;
  const maximumRodExtension = 0.22;
  const nominalTemperature = 20;
  const temperatureAmplitude = 30;
  const thermalCyclePeriod = 4;
  const thermalAngularFrequency = FULL_TURN / thermalCyclePeriod;
  const swingPeriod = thermalCyclePeriod / 2;
  const swingAngularFrequency = FULL_TURN / swingPeriod;
  const swingAmplitude = THREE.MathUtils.degToRad(14);

  const massProperties = (rodExtension, fillHeight) => {
    const rodLength = referenceRodLength + rodExtension;
    const jarCenterDistance = referenceJarCenterDistance + rodExtension;
    const mercuryBottomDistance = referenceMercuryBottomDistance
      + rodExtension;
    const mercuryCenterDistance = mercuryBottomDistance - fillHeight / 2;
    const firstMoment = rodMass * rodLength / 2
      + jarMass * jarCenterDistance
      + mercuryMass * mercuryCenterDistance;
    const rodInertia = rodMass * rodLength ** 2 / 3;
    const jarInertia = jarMass * (
      jarCenterDistance ** 2
      + jarIntrinsicRadiusOfGyrationSquared
    );
    const mercuryIntrinsicInertia = mercuryMass * (
      fillHeight ** 2 / 12
      + jarInnerRadius ** 2 / 4
    );
    const mercuryInertia = mercuryMass * mercuryCenterDistance ** 2
      + mercuryIntrinsicInertia;
    const inertia = rodInertia + jarInertia + mercuryInertia;
    return {
      centerOfMassDistance: firstMoment / totalMass,
      effectiveLength: inertia / firstMoment,
      firstMoment,
      inertia,
      jarCenterDistance,
      jarInertia,
      mercuryBottomDistance,
      mercuryCenterDistance,
      mercuryInertia,
      mercuryIntrinsicInertia,
      rodInertia,
      rodLength,
      totalMass,
    };
  };

  const referenceMassProperties = massProperties(0, referenceFillHeight);
  const referenceEffectiveLength = referenceMassProperties.effectiveLength;

  const fillStateAtRodExtension = (rodExtension) => {
    const rodLength = referenceRodLength + rodExtension;
    const jarCenterDistance = referenceJarCenterDistance + rodExtension;
    const mercuryBottomDistance = referenceMercuryBottomDistance
      + rodExtension;
    const otherFirstMoment = rodMass * rodLength / 2
      + jarMass * jarCenterDistance;
    const otherInertia = rodMass * rodLength ** 2 / 3
      + jarMass * (
        jarCenterDistance ** 2
        + jarIntrinsicRadiusOfGyrationSquared
      );
    const quadraticA = mercuryMass / 3;
    const quadraticB = mercuryMass * (
      -mercuryBottomDistance + referenceEffectiveLength / 2
    );
    const quadraticC = otherInertia + mercuryMass * (
      mercuryBottomDistance ** 2 + jarInnerRadius ** 2 / 4
    ) - referenceEffectiveLength * (
      otherFirstMoment + mercuryMass * mercuryBottomDistance
    );
    const discriminant = quadraticB ** 2
      - 4 * quadraticA * quadraticC;
    const squareRoot = Math.sqrt(Math.max(0, discriminant));
    const lowerRoot = (-quadraticB - squareRoot) / (2 * quadraticA);
    const upperRoot = (-quadraticB + squareRoot) / (2 * quadraticA);
    const fillHeight = lowerRoot;

    const partialFill = mercuryMass * (
      -mercuryBottomDistance
      + 2 * fillHeight / 3
      + referenceEffectiveLength / 2
    );
    const partialExtension = 2 * rodMass * rodLength / 3
      + 2 * jarMass * jarCenterDistance
      + mercuryMass * (2 * mercuryBottomDistance - fillHeight)
      - referenceEffectiveLength * (
        rodMass / 2 + jarMass + mercuryMass
      );
    const fillDerivative = -partialExtension / partialFill;
    const partialFillFill = 2 * mercuryMass / 3;
    const partialFillExtension = -mercuryMass;
    const partialExtensionExtension = 2 * rodMass / 3
      + 2 * jarMass + 2 * mercuryMass;
    const fillSecondDerivative = -(
      partialExtensionExtension
      + 2 * partialFillExtension * fillDerivative
      + partialFillFill * fillDerivative ** 2
    ) / partialFill;

    return {
      discriminant,
      fillDerivative,
      fillHeight,
      fillSecondDerivative,
      lowerRoot,
      quadraticA,
      quadraticB,
      quadraticC,
      upperRoot,
    };
  };

  const pointKinematics = ({
    distance,
    distanceAcceleration = 0,
    distanceVelocity = 0,
    swingAngle,
    swingAngularAcceleration,
    swingAngularVelocity,
  }) => {
    const rotation = new THREE.Quaternion().setFromAxisAngle(
      Z_AXIS,
      swingAngle,
    );
    const localPosition = new THREE.Vector3(0, -distance, 0);
    const localVelocity = new THREE.Vector3(0, -distanceVelocity, 0);
    const localAcceleration = new THREE.Vector3(
      0,
      -distanceAcceleration,
      0,
    );
    const angularVelocity = new THREE.Vector3(
      0,
      0,
      swingAngularVelocity,
    );
    const angularAcceleration = new THREE.Vector3(
      0,
      0,
      swingAngularAcceleration,
    );
    const rotationalVelocity = angularVelocity.clone().cross(
      localPosition,
    );
    const velocity = localVelocity.clone().add(rotationalVelocity)
      .applyQuaternion(rotation);
    const acceleration = localAcceleration.clone()
      .add(angularAcceleration.clone().cross(localPosition))
      .add(angularVelocity.clone().cross(localVelocity)
        .multiplyScalar(2))
      .add(angularVelocity.clone().cross(
        angularVelocity.clone().cross(localPosition),
      ))
      .applyQuaternion(rotation);
    const position = localPosition.applyQuaternion(rotation).add(pivot);
    return { acceleration, position, velocity };
  };

  const stateAtTime = (time) => {
    const unwrappedThermalAngle = thermalAngularFrequency * time;
    const thermalAngle = positiveModulo(unwrappedThermalAngle, FULL_TURN);
    const temperatureCoordinate = Math.sin(thermalAngle);
    const temperatureCoordinateVelocity = thermalAngularFrequency
      * Math.cos(thermalAngle);
    const temperatureCoordinateAcceleration = -(thermalAngularFrequency ** 2)
      * Math.sin(thermalAngle);
    const rodExtension = maximumRodExtension * temperatureCoordinate;
    const rodExtensionVelocity = maximumRodExtension
      * temperatureCoordinateVelocity;
    const rodExtensionAcceleration = maximumRodExtension
      * temperatureCoordinateAcceleration;
    const fill = fillStateAtRodExtension(rodExtension);
    const fillHeightVelocity = fill.fillDerivative
      * rodExtensionVelocity;
    const fillHeightAcceleration = fill.fillSecondDerivative
      * rodExtensionVelocity ** 2
      + fill.fillDerivative * rodExtensionAcceleration;
    const properties = massProperties(rodExtension, fill.fillHeight);

    const swingArgument = swingAngularFrequency * time;
    const swingAngle = swingAmplitude * Math.sin(swingArgument);
    const swingAngularVelocity = swingAmplitude * swingAngularFrequency
      * Math.cos(swingArgument);
    const swingAngularAcceleration = -swingAmplitude
      * swingAngularFrequency ** 2 * Math.sin(swingArgument);

    const jarCenterVelocity = rodExtensionVelocity;
    const jarCenterAcceleration = rodExtensionAcceleration;
    const mercuryBottomVelocity = rodExtensionVelocity;
    const mercuryBottomAcceleration = rodExtensionAcceleration;
    const mercuryCenterVelocity = rodExtensionVelocity
      - fillHeightVelocity / 2;
    const mercuryCenterAcceleration = rodExtensionAcceleration
      - fillHeightAcceleration / 2;
    const mercuryTopDistance = properties.mercuryBottomDistance
      - fill.fillHeight;
    const mercuryTopVelocity = rodExtensionVelocity
      - fillHeightVelocity;
    const mercuryTopAcceleration = rodExtensionAcceleration
      - fillHeightAcceleration;

    const commonPointArguments = {
      swingAngle,
      swingAngularAcceleration,
      swingAngularVelocity,
    };
    const rodEnd = pointKinematics({
      ...commonPointArguments,
      distance: properties.rodLength,
      distanceAcceleration: rodExtensionAcceleration,
      distanceVelocity: rodExtensionVelocity,
    });
    const jarCenter = pointKinematics({
      ...commonPointArguments,
      distance: properties.jarCenterDistance,
      distanceAcceleration: jarCenterAcceleration,
      distanceVelocity: jarCenterVelocity,
    });
    const mercuryBottom = pointKinematics({
      ...commonPointArguments,
      distance: properties.mercuryBottomDistance,
      distanceAcceleration: mercuryBottomAcceleration,
      distanceVelocity: mercuryBottomVelocity,
    });
    const mercuryCenter = pointKinematics({
      ...commonPointArguments,
      distance: properties.mercuryCenterDistance,
      distanceAcceleration: mercuryCenterAcceleration,
      distanceVelocity: mercuryCenterVelocity,
    });
    const mercuryTop = pointKinematics({
      ...commonPointArguments,
      distance: mercuryTopDistance,
      distanceAcceleration: mercuryTopAcceleration,
      distanceVelocity: mercuryTopVelocity,
    });
    const centerOfOscillation = pointKinematics({
      ...commonPointArguments,
      distance: referenceEffectiveLength,
    });
    const pendulumQuaternion = new THREE.Quaternion().setFromAxisAngle(
      Z_AXIS,
      swingAngle,
    );
    const mercuryVolume = Math.PI * jarInnerRadius ** 2
      * fill.fillHeight;
    const referenceMercuryVolume = Math.PI * jarInnerRadius ** 2
      * referenceFillHeight;

    return {
      centerOfOscillation,
      centerOfOscillationDistance: properties.effectiveLength,
      centerOfOscillationError: properties.effectiveLength
        - referenceEffectiveLength,
      centerOfMassDistance: properties.centerOfMassDistance,
      cycleIndex: Math.floor(unwrappedThermalAngle / FULL_TURN),
      cyclePhase: thermalAngle / FULL_TURN,
      fillDiscriminant: fill.discriminant,
      fillHeight: fill.fillHeight,
      fillHeightAcceleration,
      fillHeightDerivativePerRodExtension: fill.fillDerivative,
      fillHeightSecondDerivativePerRodExtension:
        fill.fillSecondDerivative,
      fillHeightVelocity,
      glassJarCenter: jarCenter,
      massProperties: properties,
      mercuryBottom,
      mercuryCenter,
      mercuryDensityRatio: referenceMercuryVolume / mercuryVolume,
      mercuryTop,
      mercuryTopDistance,
      mercuryVolume,
      mercuryVolumeRatio: mercuryVolume / referenceMercuryVolume,
      pendulumQuaternion,
      rodEnd,
      rodExtension,
      rodExtensionAcceleration,
      rodExtensionVelocity,
      swingAngle,
      swingAngularAcceleration,
      swingAngularVelocity,
      temperature: nominalTemperature
        + temperatureAmplitude * temperatureCoordinate,
      temperatureCoordinate,
      temperatureCoordinateAcceleration,
      temperatureCoordinateVelocity,
      temperatureState: temperatureCoordinate > 0.02
        ? 'warming-expanded'
        : temperatureCoordinate < -0.02
          ? 'cooling-contracted'
          : 'neutral',
      thermalAngle,
      unwrappedThermalAngle,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.16,
    roughness: 0.66,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.46,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.60,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.25,
    roughness: 0.50,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.48,
  });
  const mercuryMaterial = matte(PALETTE.fluid, {
    metalness: 0.32,
    opacity: 0.86,
    roughness: 0.34,
    transparent: true,
  });
  mercuryMaterial.depthWrite = true;
  const glassMaterial = matte(0x9fc4cc, {
    metalness: 0.02,
    opacity: 0.25,
    roughness: 0.23,
    side: THREE.DoubleSide,
    transparent: true,
  });
  glassMaterial.depthWrite = false;

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-mercurial-pendulum-suspension-frame';
  const ceilingPlate = new THREE.Mesh(
    new THREE.BoxGeometry(2.30, 0.28, 1.36),
    frameMaterial,
  );
  ceilingPlate.position.set(0, 5.25, 0);
  ceilingPlate.userData.role = 'fixed-upper-suspension-plate';
  const bracketSides = [-0.48, 0.48].map((x) => {
    const side = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.66, 0.42),
      frameMaterial,
    );
    side.position.set(x, 4.97, 0);
    side.userData.role = 'fixed-pendulum-pivot-bracket';
    return side;
  });
  const fixedPivotShaft = cylinderAlongZ(0.18, 1.25, darkMaterial, 36);
  fixedPivotShaft.position.copy(pivot);
  fixedPivotShaft.userData.role = 'fixed-horizontal-pendulum-pivot';
  fixedFrame.add(ceilingPlate, ...bracketSides, fixedPivotShaft);

  const pendulumCarrier = new THREE.Group();
  pendulumCarrier.position.copy(pivot);
  pendulumCarrier.userData.axis = Z_AXIS.clone();
  pendulumCarrier.userData.role = 'thermally-compensated-swinging-pendulum';

  const movingPivotHub = cylinderAlongZ(0.30, 0.74, driverMaterial, 36);
  movingPivotHub.userData.role = 'moving-pendulum-pivot-hub';
  const rod = cylinderAlongY(0.095, 1, darkMaterial, 32);
  rod.userData.role = 'thermally-expanding-steel-pendulum-rod';
  const rodIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.62, 0.055),
    whiteMaterial,
  );
  rodIndex.position.set(0.10, -1.02, 0);
  rodIndex.userData.role = 'white-pendulum-swing-index';

  // A clean helical ridge on the rod: 14 turns, finely sampled, its round
  // section sunk 0.008 into the rod so it sits on it (it floated 0.013 off
  // and 48 segments for 14 turns made lumpy blobs).
  const threadTurns = 14;
  const threadRidgeRadius = 0.024;
  const threadHelixRadius = 0.095 + threadRidgeRadius - 0.008;
  const threadPoints = Array.from({ length: threadTurns * 32 + 1 }, (_, index) => {
    const progress = index / (threadTurns * 32);
    const angle = progress * FULL_TURN * threadTurns;
    return new THREE.Vector3(
      threadHelixRadius * Math.cos(angle),
      -(1.18 + progress * 2.05),
      threadHelixRadius * Math.sin(angle),
    );
  });
  const threadHelix = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(threadPoints, false, 'centripetal'),
      threadTurns * 40, threadRidgeRadius, 10, false),
    brassMaterial,
  );
  threadHelix.userData.role = 'visible-thread-on-pendulum-adjustment-rod';

  const jarAssembly = new THREE.Group();
  jarAssembly.userData.role = 'thermally-translated-mercury-jar-assembly';
  const bottleProfile = [
    [jarOuterRadius * 0.78, -jarLength / 2],
    [jarOuterRadius * 0.91, -jarLength / 2 + 0.10],
    [jarOuterRadius, -jarLength / 2 + 0.34],
    [jarOuterRadius, jarLength / 2 - 1.15],
    [jarOuterRadius * 0.94, jarLength / 2 - 0.78],
    [jarOuterRadius * 0.76, jarLength / 2 - 0.37],
    [jarOuterRadius * 0.58, jarLength / 2 - 0.20],
    [jarOuterRadius * 0.58, jarLength / 2],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));
  const glassJar = new THREE.Mesh(
    new THREE.LatheGeometry(bottleProfile, 72),
    glassMaterial,
  );
  glassJar.renderOrder = 3;
  glassJar.userData.role = 'transparent-glass-mercury-jar';
  const glassBottom = cylinderAlongY(
    jarOuterRadius * 0.88,
    0.12,
    glassMaterial,
    64,
  );
  glassBottom.position.y = -jarLength / 2 + 0.10;
  glassBottom.renderOrder = 3;
  glassBottom.userData.role = 'thick-rounded-glass-jar-bottom';
  const jarRims = [
    { radius: jarOuterRadius * 0.59, y: jarLength / 2 - 0.05 },
    { radius: jarOuterRadius * 0.94, y: -jarLength / 2 + 0.22 },
  ].map(({ radius, y }) => {
    const rim = torusAroundY(radius, 0.055, darkMaterial, 64);
    rim.position.y = y;
    rim.userData.role = 'glass-jar-protective-rim';
    // Brown's ink edge of the glass/mercury only: kept, not drawn.
    rim.visible = false;
    rim.userData.retiredInkOutline = true;
    return rim;
  });

  const mercuryColumn = cylinderAlongY(
    jarInnerRadius,
    1,
    mercuryMaterial,
    64,
  );
  mercuryColumn.renderOrder = 1;
  mercuryColumn.userData.role = 'constant-mass-expanding-mercury-column';
  const mercurySurface = cylinderAlongY(
    jarInnerRadius,
    0.055,
    whiteMaterial,
    64,
  );
  mercurySurface.renderOrder = 2;
  mercurySurface.userData.role = 'white-mercury-level-motion-index';
  const mercuryMeniscus = torusAroundY(
    jarInnerRadius * 0.95,
    0.040,
    darkMaterial,
    64,
  );
  mercuryMeniscus.renderOrder = 2;
  mercuryMeniscus.userData.role = 'mercury-meniscus-rim';
  // Brown's ink edge of the glass/mercury only: kept, not drawn.
  mercuryMeniscus.visible = false;
  mercuryMeniscus.userData.retiredInkOutline = true;

  const hangerCrossbar = makeBeam(
    new THREE.Vector3(-1.34, jarLength / 2 + 0.20, 0),
    new THREE.Vector3(1.34, jarLength / 2 + 0.20, 0),
    {
      color: PALETTE.driver,
      depth: 0.32,
      thickness: 0.20,
    },
  );
  hangerCrossbar.userData.role = 'jar-support-crossbar-on-adjustment-rod';
  const adjusterBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.58, 0.58),
    driverMaterial,
  );
  adjusterBlock.position.y = jarLength / 2 + 0.20;
  adjusterBlock.userData.role = 'threaded-jar-height-adjuster-block';
  const adjusterHandle = new THREE.Mesh(
    new THREE.BoxGeometry(2.85, 0.17, 0.24),
    driverMaterial,
  );
  adjusterHandle.position.y = jarLength / 2 + 0.20;
  adjusterHandle.userData.role = 'jar-adjustment-cross-handle';
  const handleEnds = [-1, 1].map((side) => {
    const end = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 24, 16),
      driverMaterial,
    );
    end.position.set(side * 1.43, jarLength / 2 + 0.20, 0);
    end.userData.role = 'jar-adjustment-handle-end';
    return end;
  });
  const shoulderHangers = [-1, 1].map((side) => tubeThrough(
    [
      new THREE.Vector3(side * 0.90, jarLength / 2 + 0.12, 0),
      new THREE.Vector3(side * 1.18, jarLength / 2 - 0.35, 0),
      new THREE.Vector3(side * 1.43, jarLength / 2 - 0.92, 0),
      new THREE.Vector3(side * 1.49, jarLength / 2 - 1.34, 0),
    ],
    0.070,
    frameMaterial,
    'curved-glass-jar-shoulder-hanger',
  ));
  const sideClamps = [-1, 1].map((side) => {
    const clamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.62, 0.58),
      frameMaterial,
    );
    clamp.position.set(
      side * 1.52,
      jarLength / 2 - 1.35,
      0,
    );
    clamp.userData.role = 'glass-jar-side-clamp';
    return clamp;
  });
  const clampPins = [-1, 1].map((side) => {
    const pin = cylinderAlongX(0.11, 0.45, darkMaterial, 24);
    pin.position.set(
      side * 1.66,
      jarLength / 2 - 1.35,
      0,
    );
    pin.userData.role = 'jar-clamp-fastener';
    return pin;
  });
  jarAssembly.add(
    mercuryColumn,
    mercurySurface,
    mercuryMeniscus,
    glassJar,
    glassBottom,
    ...jarRims,
    hangerCrossbar,
    adjusterBlock,
    adjusterHandle,
    ...handleEnds,
    ...shoulderHangers,
    ...sideClamps,
    ...clampPins,
  );

  const compensationDatumRing = torusAroundY(
    jarOuterRadius + 0.12,
    0.035,
    matte(PALETTE.white, {
      opacity: 0.76,
      roughness: 0.50,
      transparent: true,
    }),
    72,
  );
  compensationDatumRing.position.y = -referenceEffectiveLength;
  compensationDatumRing.userData.nonPhysicalReference = true;
  compensationDatumRing.userData.role =
    'nonphysical-fixed-center-of-oscillation-datum-ring';
  const centerOfOscillationMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 24, 16),
    whiteMaterial,
  );
  centerOfOscillationMarker.position.y = -referenceEffectiveLength;
  centerOfOscillationMarker.userData.nonPhysicalReference = true;
  centerOfOscillationMarker.userData.role =
    'white-fixed-center-of-oscillation-marker';

  pendulumCarrier.add(
    movingPivotHub,
    rod,
    rodIndex,
    threadHelix,
    jarAssembly,
    compensationDatumRing,
    centerOfOscillationMarker,
  );
  root.add(fixedFrame, pendulumCarrier);

  const update = (time) => {
    const state = stateAtTime(time);
    pendulumCarrier.rotation.z = state.swingAngle;
    rod.scale.y = state.massProperties.rodLength - 0.25;
    rod.position.y = -(state.massProperties.rodLength + 0.25) / 2;
    rodIndex.position.y = -1.02
      * state.massProperties.rodLength / referenceRodLength;
    threadHelix.scale.y = state.massProperties.rodLength
      / referenceRodLength;
    jarAssembly.position.y = -state.massProperties.jarCenterDistance;
    mercuryColumn.scale.y = state.fillHeight;
    mercuryColumn.position.y = state.massProperties.jarCenterDistance
      - state.massProperties.mercuryCenterDistance;
    mercurySurface.position.y = state.massProperties.jarCenterDistance
      - state.mercuryTopDistance;
    mercuryMeniscus.position.y = mercurySurface.position.y;
    root.userData.compensationState = {
      centerOfOscillationError: state.centerOfOscillationError,
      effectiveLength: state.centerOfOscillationDistance,
      fillHeight: state.fillHeight,
      rodExtension: state.rodExtension,
      temperature: state.temperature,
    };
    root.userData.renderState = state;
  };

  const sourcePointToNeutralFront = (point) => new THREE.Vector3(
    (point.x - sourceRasterSuspension.x) * sourceScale,
    pivot.y - (point.y - sourceRasterSuspension.y) * sourceScale,
    0,
  );

  root.userData.archetype =
    'mercurial-compensation-pendulum-constant-center-of-oscillation';
  root.userData.blocks = {
    adjusterBlock,
    adjusterHandle,
    centerOfOscillationMarker,
    ceilingPlate,
    clampPins,
    compensationDatumRing,
    fixedFrame,
    fixedPivotShaft,
    glassBottom,
    glassJar,
    hangerCrossbar,
    jarAssembly,
    jarRims,
    mercuryColumn,
    mercuryMeniscus,
    mercurySurface,
    movingPivotHub,
    pendulumCarrier,
    rod,
    rodIndex,
    shoulderHangers,
    sideClamps,
    threadHelix,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.35, -5.30, -2.15),
    new THREE.Vector3(4.35, 5.62, 2.15),
  );
  root.userData.canonicalTimes = {
    cold: thermalCyclePeriod * 0.75,
    cycleClosure: thermalCyclePeriod,
    hot: thermalCyclePeriod * 0.25,
    neutralCooling: thermalCyclePeriod * 0.50,
    neutralHeating: 0,
  };
  root.userData.fillStateAtRodExtension = fillStateAtRodExtension;
  root.userData.geometry = {
    jarInnerRadius,
    jarLength,
    jarOuterRadius,
    maximumRodExtension,
    nominalTemperature,
    pivot: pivot.clone(),
    referenceEffectiveLength,
    referenceFillHeight,
    referenceJarCenterDistance,
    referenceMercuryBottomDistance,
    referenceRodLength,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    swingAmplitude,
    swingAngularFrequency,
    swingPeriod,
    temperatureAmplitude,
    thermalAngularFrequency,
    thermalCyclePeriod,
  };
  root.userData.groundFloorY = -5.30;
  root.userData.massModel = {
    glassJar: {
      intrinsicRadiusOfGyrationSquared:
        jarIntrinsicRadiusOfGyrationSquared,
      mass: jarMass,
    },
    mercury: {
      constantMass: true,
      mass: mercuryMass,
      referenceVolume: Math.PI * jarInnerRadius ** 2
        * referenceFillHeight,
    },
    reference: referenceMassProperties,
    rod: {
      mass: rodMass,
      model: 'uniform-slender-rod-about-upper-pivot',
    },
    totalMass,
  };
  root.userData.massProperties = massProperties;
  root.userData.mechanism =
    'a glass-jar mercury bob moves downward as its steel pendulum rod expands, while the constant mercury mass expands upward inside the jar by the calibrated amount that keeps I divided by total first moment—and therefore the center of oscillation—constant';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'Brown supplies the threaded central rod, cross-handle adjuster, two-sided jar hanger, glass vessel, mercury level, and immersed rod. The thermal amplitude, masses, material coefficients, depth, and operating cadence are not dimensioned.',
    sourceUrl: 'https://507movements.com/mm_316.html',
  };
  root.userData.sourcePointToNeutralFront = sourcePointToNeutralFront;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    brownPlate316: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one suspended steel rod, one threaded adjuster and cross-handle, one two-sided hanger, one glass jar bob, and one constant mercury charge',
      measurementUncertaintyPixels: 10,
      rasterAdjusterCenter: sourceRasterAdjusterCenter.clone(),
      rasterJarBottom: sourceRasterJarBottom.clone(),
      rasterJarLeft: sourceRasterJarLeft.clone(),
      rasterJarRight: sourceRasterJarRight.clone(),
      rasterJarTop: sourceRasterJarTop.clone(),
      rasterLeftClamp: sourceRasterLeftClamp.clone(),
      rasterMercuryBottom: sourceRasterMercuryBottom.clone(),
      rasterMercuryTop: sourceRasterMercuryTop.clone(),
      rasterRightClamp: sourceRasterRightClamp.clone(),
      rasterRodEnd: sourceRasterRodEnd.clone(),
      rasterSuspension: sourceRasterSuspension.clone(),
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: thermalCyclePeriod,
    schedule: [
      'neutral-rod-and-reference-mercury-level',
      'warming-elongates-rod-and-lowers-glass-jar',
      'mercury-expansion-raises-fluid-level-and-aggregate-center',
      'center-of-oscillation-remains-at-fixed-effective-length',
      'cooling-contracts-rod-and-lowers-mercury-relative-to-jar',
      'pendulum-completes-two-visible-swings-per-thermal-cycle',
    ],
  };
  root.userData.transmission = {
    compensationTarget: 'constant physical-pendulum effective length I/(M d)',
    glassJarThermalTravelPerRodExtension: 1,
    mercuryMassConstant: true,
    output: 'temperature-compensated pendulum oscillation',
    thermalInput: 'exaggerated cyclic temperature applied to steel rod and mercury',
  };

  correctCompensationJournals(root, movement.id);
  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  for (const object of [
    compensationDatumRing,
    centerOfOscillationMarker,
    glassBottom,
    glassJar,
    mercuryMeniscus,
    mercurySurface,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';

  return {
    cameraDirection: new THREE.Vector3(1.2, .6, 16),
    root,
    update,
  };
}

function compoundBarCompensationPendulum(movement) {
  const root = new THREE.Group();

  // Brown crops the suspension above the plate: the visible vertical rod
  // begins at the top edge, but it is not a pivot.  The extra upper length is
  // therefore explicit instead of silently treating the crop as the bearing.
  // Plate distances determine the neutral proportions.  The thermal strain
  // is magnified for legibility; at every temperature the required end-weight
  // height is solved from I/Q, rather than prescribed as decorative motion.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterVisibleRodTop = new THREE.Vector2(265, 15);
  const sourceRasterBarCenter = new THREE.Vector2(265, 200);
  const sourceRasterLeftWeightCenter = new THREE.Vector2(60, 177);
  const sourceRasterRightWeightCenter = new THREE.Vector2(464, 177);
  const sourceRasterMainBobTopLeft = new THREE.Vector2(169, 214);
  const sourceRasterMainBobBottomRight = new THREE.Vector2(360, 460);
  const sourceRasterRodEnd = new THREE.Vector2(264, 520);
  const sourceRasterLeftBarTip = new THREE.Vector2(11, 164);
  const sourceRasterRightBarTip = new THREE.Vector2(516, 164);

  const pivot = new THREE.Vector3(0, 5.20, 0);
  const mainBobHeight = 4.45;
  const sourceScale = mainBobHeight / (
    sourceRasterMainBobBottomRight.y - sourceRasterMainBobTopLeft.y
  );
  const unshownUpperRodLength = 3.20;
  const sourceDistanceFromPivot = (rasterY) => (
    unshownUpperRodLength
      + (rasterY - sourceRasterVisibleRodTop.y) * sourceScale
  );
  const referenceRodLength = sourceDistanceFromPivot(
    sourceRasterRodEnd.y,
  );
  const referenceBarCenterDistance = sourceDistanceFromPivot(
    sourceRasterBarCenter.y,
  );
  const referenceMainBobCenterDistance = sourceDistanceFromPivot(
    (sourceRasterMainBobTopLeft.y
      + sourceRasterMainBobBottomRight.y) / 2,
  );
  const referenceWeightDistance = sourceDistanceFromPivot(
    (sourceRasterLeftWeightCenter.y
      + sourceRasterRightWeightCenter.y) / 2,
  );
  const barHalfSpan = (
    sourceRasterRightWeightCenter.x - sourceRasterLeftWeightCenter.x
  ) * sourceScale / 2;
  const referenceBarEndLift = referenceBarCenterDistance
    - referenceWeightDistance;
  const mainBobWidth = (
    sourceRasterMainBobBottomRight.x - sourceRasterMainBobTopLeft.x
  ) * sourceScale;
  const mainBobDepth = 0.86;
  const weightWidth = 1.16;
  const weightHeight = 1.01;
  const weightDepth = 0.80;
  const mainBobIntrinsicRadiusOfGyrationSquared = (
    mainBobWidth ** 2 + mainBobHeight ** 2
  ) / 12;
  const weightIntrinsicRadiusOfGyrationSquared = (
    weightWidth ** 2 + weightHeight ** 2
  ) / 12;

  const rodMass = 0.60;
  const mainBobMass = 8.00;
  const eachWeightMass = 1.40;
  const totalMass = rodMass + mainBobMass + 2 * eachWeightMass;
  const maximumRodExtension = 0.04;
  const nominalTemperature = 20;
  const temperatureAmplitude = 30;
  const thermalCyclePeriod = 4;
  const thermalAngularFrequency = FULL_TURN / thermalCyclePeriod;
  const swingPeriod = thermalCyclePeriod / 2;
  const swingAngularFrequency = FULL_TURN / swingPeriod;
  const swingAmplitude = THREE.MathUtils.degToRad(13);

  const massProperties = (rodExtension, weightDistance) => {
    const rodLength = referenceRodLength + rodExtension;
    const mainBobCenterDistance = referenceMainBobCenterDistance
      + rodExtension;
    const rodFirstMoment = rodMass * rodLength / 2;
    const mainBobFirstMoment = mainBobMass * mainBobCenterDistance;
    const weightsFirstMoment = 2 * eachWeightMass * weightDistance;
    const firstMoment = rodFirstMoment + mainBobFirstMoment
      + weightsFirstMoment;
    const rodInertia = rodMass * rodLength ** 2 / 3;
    const mainBobInertia = mainBobMass * (
      mainBobCenterDistance ** 2
        + mainBobIntrinsicRadiusOfGyrationSquared
    );
    const weightsInertia = 2 * eachWeightMass * (
      barHalfSpan ** 2 + weightDistance ** 2
        + weightIntrinsicRadiusOfGyrationSquared
    );
    const inertia = rodInertia + mainBobInertia + weightsInertia;
    return {
      centerOfMassDistance: firstMoment / totalMass,
      effectiveLength: inertia / firstMoment,
      firstMoment,
      inertia,
      mainBobCenterDistance,
      mainBobFirstMoment,
      mainBobInertia,
      rodFirstMoment,
      rodInertia,
      rodLength,
      totalMass,
      weightDistance,
      weightsFirstMoment,
      weightsInertia,
    };
  };

  const referenceMassProperties = massProperties(
    0,
    referenceWeightDistance,
  );
  const referenceEffectiveLength =
    referenceMassProperties.effectiveLength;

  const weightStateAtRodExtension = (rodExtension) => {
    const rodLength = referenceRodLength + rodExtension;
    const mainBobCenterDistance = referenceMainBobCenterDistance
      + rodExtension;
    const otherFirstMoment = rodMass * rodLength / 2
      + mainBobMass * mainBobCenterDistance;
    const otherInertia = rodMass * rodLength ** 2 / 3
      + mainBobMass * (
        mainBobCenterDistance ** 2
          + mainBobIntrinsicRadiusOfGyrationSquared
      );
    const quadraticA = 2 * eachWeightMass;
    const quadraticB = -2 * eachWeightMass
      * referenceEffectiveLength;
    const quadraticC = otherInertia + 2 * eachWeightMass * (
      barHalfSpan ** 2 + weightIntrinsicRadiusOfGyrationSquared
    ) - referenceEffectiveLength * otherFirstMoment;
    const discriminant = quadraticB ** 2
      - 4 * quadraticA * quadraticC;
    const squareRoot = Math.sqrt(Math.max(0, discriminant));
    const lowerRoot = (-quadraticB - squareRoot)
      / (2 * quadraticA);
    const upperRoot = (-quadraticB + squareRoot)
      / (2 * quadraticA);

    // Brown's weights lie on the lower, long-radius branch.  The other root
    // is the mathematically valid but physically different short pendulum.
    const weightDistance = upperRoot;
    const partialWeight = 2 * eachWeightMass * (
      2 * weightDistance - referenceEffectiveLength
    );
    const partialExtension = 2 * rodMass * rodLength / 3
      + 2 * mainBobMass * mainBobCenterDistance
      - referenceEffectiveLength * (rodMass / 2 + mainBobMass);
    const weightDistanceDerivative = -partialExtension / partialWeight;
    const partialExtensionExtension = 2 * rodMass / 3
      + 2 * mainBobMass;
    const partialWeightWeight = 4 * eachWeightMass;
    const weightDistanceSecondDerivative = -(
      partialExtensionExtension
        + partialWeightWeight * weightDistanceDerivative ** 2
    ) / partialWeight;
    const barCenterDistance = referenceBarCenterDistance + rodExtension;
    const barEndLift = barCenterDistance - weightDistance;

    return {
      barCenterDistance,
      barEndLift,
      barEndLiftDerivative: 1 - weightDistanceDerivative,
      barEndLiftSecondDerivative: -weightDistanceSecondDerivative,
      discriminant,
      lowerRoot,
      quadraticA,
      quadraticB,
      quadraticC,
      upperRoot,
      weightDistance,
      weightDistanceDerivative,
      weightDistanceSecondDerivative,
    };
  };

  const pointKinematics = ({
    distance,
    distanceAcceleration = 0,
    distanceVelocity = 0,
    horizontal = 0,
    swingAngle,
    swingAngularAcceleration,
    swingAngularVelocity,
  }) => {
    const rotation = new THREE.Quaternion().setFromAxisAngle(
      Z_AXIS,
      swingAngle,
    );
    const localPosition = new THREE.Vector3(horizontal, -distance, 0);
    const localVelocity = new THREE.Vector3(0, -distanceVelocity, 0);
    const localAcceleration = new THREE.Vector3(
      0,
      -distanceAcceleration,
      0,
    );
    const angularVelocity = new THREE.Vector3(
      0,
      0,
      swingAngularVelocity,
    );
    const angularAcceleration = new THREE.Vector3(
      0,
      0,
      swingAngularAcceleration,
    );
    const velocity = localVelocity.clone()
      .add(angularVelocity.clone().cross(localPosition))
      .applyQuaternion(rotation);
    const acceleration = localAcceleration.clone()
      .add(angularAcceleration.clone().cross(localPosition))
      .add(angularVelocity.clone().cross(localVelocity)
        .multiplyScalar(2))
      .add(angularVelocity.clone().cross(
        angularVelocity.clone().cross(localPosition),
      ))
      .applyQuaternion(rotation);
    const position = localPosition.applyQuaternion(rotation).add(pivot);
    return { acceleration, position, velocity };
  };

  const stateAtTime = (time) => {
    const unwrappedThermalAngle = thermalAngularFrequency * time;
    const thermalAngle = positiveModulo(unwrappedThermalAngle, FULL_TURN);
    const temperatureCoordinate = Math.sin(thermalAngle);
    const temperatureCoordinateVelocity = thermalAngularFrequency
      * Math.cos(thermalAngle);
    const temperatureCoordinateAcceleration = -(thermalAngularFrequency ** 2)
      * Math.sin(thermalAngle);
    const rodExtension = maximumRodExtension * temperatureCoordinate;
    const rodExtensionVelocity = maximumRodExtension
      * temperatureCoordinateVelocity;
    const rodExtensionAcceleration = maximumRodExtension
      * temperatureCoordinateAcceleration;
    const weightState = weightStateAtRodExtension(rodExtension);
    const weightDistanceVelocity = weightState.weightDistanceDerivative
      * rodExtensionVelocity;
    const weightDistanceAcceleration =
      weightState.weightDistanceSecondDerivative
        * rodExtensionVelocity ** 2
      + weightState.weightDistanceDerivative * rodExtensionAcceleration;
    const barEndLiftVelocity = weightState.barEndLiftDerivative
      * rodExtensionVelocity;
    const barEndLiftAcceleration = weightState.barEndLiftSecondDerivative
      * rodExtensionVelocity ** 2
      + weightState.barEndLiftDerivative * rodExtensionAcceleration;
    const properties = massProperties(
      rodExtension,
      weightState.weightDistance,
    );

    const swingArgument = swingAngularFrequency * time;
    const swingAngle = swingAmplitude * Math.sin(swingArgument);
    const swingAngularVelocity = swingAmplitude * swingAngularFrequency
      * Math.cos(swingArgument);
    const swingAngularAcceleration = -swingAmplitude
      * swingAngularFrequency ** 2 * Math.sin(swingArgument);
    const commonPointArguments = {
      swingAngle,
      swingAngularAcceleration,
      swingAngularVelocity,
    };
    const rodEnd = pointKinematics({
      ...commonPointArguments,
      distance: properties.rodLength,
      distanceAcceleration: rodExtensionAcceleration,
      distanceVelocity: rodExtensionVelocity,
    });
    const mainBobCenter = pointKinematics({
      ...commonPointArguments,
      distance: properties.mainBobCenterDistance,
      distanceAcceleration: rodExtensionAcceleration,
      distanceVelocity: rodExtensionVelocity,
    });
    const barCenter = pointKinematics({
      ...commonPointArguments,
      distance: weightState.barCenterDistance,
      distanceAcceleration: rodExtensionAcceleration,
      distanceVelocity: rodExtensionVelocity,
    });
    const leftWeight = pointKinematics({
      ...commonPointArguments,
      distance: weightState.weightDistance,
      distanceAcceleration: weightDistanceAcceleration,
      distanceVelocity: weightDistanceVelocity,
      horizontal: -barHalfSpan,
    });
    const rightWeight = pointKinematics({
      ...commonPointArguments,
      distance: weightState.weightDistance,
      distanceAcceleration: weightDistanceAcceleration,
      distanceVelocity: weightDistanceVelocity,
      horizontal: barHalfSpan,
    });
    const centerOfMassDistanceDerivative = (
      rodMass / 2 + mainBobMass
        + 2 * eachWeightMass
          * weightState.weightDistanceDerivative
    ) / totalMass;
    const centerOfMassDistanceSecondDerivative = (
      2 * eachWeightMass
        * weightState.weightDistanceSecondDerivative
    ) / totalMass;
    const centerOfMassDistanceVelocity =
      centerOfMassDistanceDerivative * rodExtensionVelocity;
    const centerOfMassDistanceAcceleration =
      centerOfMassDistanceSecondDerivative * rodExtensionVelocity ** 2
        + centerOfMassDistanceDerivative * rodExtensionAcceleration;
    const centerOfMass = pointKinematics({
      ...commonPointArguments,
      distance: properties.centerOfMassDistance,
      distanceAcceleration: centerOfMassDistanceAcceleration,
      distanceVelocity: centerOfMassDistanceVelocity,
    });
    const centerOfOscillation = pointKinematics({
      ...commonPointArguments,
      distance: referenceEffectiveLength,
    });
    const pendulumQuaternion = new THREE.Quaternion().setFromAxisAngle(
      Z_AXIS,
      swingAngle,
    );

    const barPointAtNormalizedX = (normalizedX) => {
      const normalizedSquared = normalizedX ** 2;
      const distance = weightState.barCenterDistance
        - weightState.barEndLift * normalizedSquared;
      const distanceVelocity = rodExtensionVelocity
        - barEndLiftVelocity * normalizedSquared;
      const distanceAcceleration = rodExtensionAcceleration
        - barEndLiftAcceleration * normalizedSquared;
      const localSlope = 2 * weightState.barEndLift
        * normalizedX / barHalfSpan;
      const localSlopeVelocity = 2 * barEndLiftVelocity
        * normalizedX / barHalfSpan;
      const localSlopeAcceleration = 2 * barEndLiftAcceleration
        * normalizedX / barHalfSpan;
      const tangentAngle = Math.atan(localSlope);
      const tangentAngularVelocity = localSlopeVelocity
        / (1 + localSlope ** 2);
      const tangentAngularAcceleration = localSlopeAcceleration
          / (1 + localSlope ** 2)
        - 2 * localSlope * localSlopeVelocity ** 2
          / (1 + localSlope ** 2) ** 2;
      return {
        ...pointKinematics({
          ...commonPointArguments,
          distance,
          distanceAcceleration,
          distanceVelocity,
          horizontal: normalizedX * barHalfSpan,
        }),
        distance,
        distanceAcceleration,
        distanceVelocity,
        localSlope,
        tangentAngle,
        tangentAngularAcceleration,
        tangentAngularVelocity,
        worldTangentAngle: swingAngle + tangentAngle,
      };
    };

    return {
      barCenter,
      barCenterDistance: weightState.barCenterDistance,
      barEndLift: weightState.barEndLift,
      barEndLiftAcceleration,
      barEndLiftVelocity,
      barPointAtNormalizedX,
      centerOfMass,
      centerOfMassDistance: properties.centerOfMassDistance,
      centerOfMassDistanceAcceleration,
      centerOfMassDistanceDerivative,
      centerOfMassDistanceSecondDerivative,
      centerOfMassDistanceVelocity,
      centerOfOscillation,
      centerOfOscillationDistance: properties.effectiveLength,
      centerOfOscillationError: properties.effectiveLength
        - referenceEffectiveLength,
      cycleIndex: Math.floor(unwrappedThermalAngle / FULL_TURN),
      cyclePhase: thermalAngle / FULL_TURN,
      leftWeight,
      massProperties: properties,
      mainBobCenter,
      pendulumQuaternion,
      rightWeight,
      rodEnd,
      rodExtension,
      rodExtensionAcceleration,
      rodExtensionVelocity,
      swingAngle,
      swingAngularAcceleration,
      swingAngularVelocity,
      temperature: nominalTemperature
        + temperatureAmplitude * temperatureCoordinate,
      temperatureCoordinate,
      temperatureCoordinateAcceleration,
      temperatureCoordinateVelocity,
      temperatureState: temperatureCoordinate > 0.02
        ? 'hot-bar-curved-upward'
        : temperatureCoordinate < -0.02
          ? 'cold-bar-relaxed-downward'
          : 'neutral',
      thermalAngle,
      unwrappedThermalAngle,
      weightDistance: weightState.weightDistance,
      weightDistanceAcceleration,
      weightDistanceVelocity,
      weightState,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.62,
  });
  const steelMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.42,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.30,
    roughness: 0.46,
  });
  const bobMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.58,
  });
  const weightMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    roughness: 0.52,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.45,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-compound-pendulum-suspension-frame';
  const ceilingPlate = new THREE.Mesh(
    new THREE.BoxGeometry(2.15, 0.26, 1.25),
    frameMaterial,
  );
  ceilingPlate.position.set(0, 5.62, 0);
  ceilingPlate.userData.role = 'fixed-upper-suspension-plate';
  const pivotBrackets = [-0.47, 0.47].map((x) => {
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.68, 0.38),
      frameMaterial,
    );
    bracket.position.set(x, 5.30, 0);
    bracket.userData.role = 'fixed-pendulum-pivot-bracket';
    return bracket;
  });
  const fixedPivotShaft = cylinderAlongZ(0.17, 1.20, steelMaterial, 36);
  fixedPivotShaft.position.copy(pivot);
  fixedPivotShaft.userData.role = 'fixed-horizontal-pendulum-pivot';
  fixedFrame.add(ceilingPlate, ...pivotBrackets, fixedPivotShaft);

  const pendulumCarrier = new THREE.Group();
  pendulumCarrier.position.copy(pivot);
  pendulumCarrier.userData.axis = Z_AXIS.clone();
  pendulumCarrier.userData.role = 'compound-bar-compensated-pendulum';
  const movingPivotHub = cylinderAlongZ(0.28, 0.72, bobMaterial, 36);
  movingPivotHub.userData.role = 'moving-pendulum-pivot-hub';
  const rod = cylinderAlongY(0.085, 1, steelMaterial, 28);
  rod.position.z = -0.16;
  rod.userData.role = 'thermally-expanding-steel-pendulum-rod';

  const mainBobShape = new THREE.Shape();
  const halfBobWidth = mainBobWidth / 2;
  const halfBobHeight = mainBobHeight / 2;
  const shoulderRadius = 0.52;
  mainBobShape.moveTo(-halfBobWidth, -halfBobHeight);
  mainBobShape.lineTo(halfBobWidth, -halfBobHeight);
  mainBobShape.lineTo(halfBobWidth, halfBobHeight - shoulderRadius);
  mainBobShape.quadraticCurveTo(
    halfBobWidth,
    halfBobHeight,
    halfBobWidth - shoulderRadius,
    halfBobHeight,
  );
  mainBobShape.lineTo(-halfBobWidth + shoulderRadius, halfBobHeight);
  mainBobShape.quadraticCurveTo(
    -halfBobWidth,
    halfBobHeight,
    -halfBobWidth,
    halfBobHeight - shoulderRadius,
  );
  mainBobShape.closePath();
  const mainBobGeometry = new THREE.ExtrudeGeometry(mainBobShape, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.08,
    bevelThickness: 0.06,
    curveSegments: 18,
    depth: mainBobDepth,
    steps: 1,
  });
  mainBobGeometry.translate(0, 0, -mainBobDepth / 2);
  const mainBob = new THREE.Mesh(mainBobGeometry, bobMaterial);
  mainBob.userData.role = 'central-main-pendulum-weight-M';
  const mainBobHub = cylinderAlongZ(0.30, mainBobDepth + 0.20,
    steelMaterial, 36);
  mainBobHub.userData.role = 'main-bob-central-rod-hub';
  const mainBobWitness = torusAroundY(0.34, 0.045, whiteMaterial, 40);
  mainBobWitness.rotation.x = 0;
  mainBobWitness.rotation.z = 0;
  mainBobWitness.position.z = mainBobDepth / 2 + 0.08;
  mainBobWitness.userData.role = 'white-main-weight-motion-index';
  mainBob.add(mainBobWitness);

  const threadPoints = Array.from({ length: 145 }, (_, index) => {
    const progress = index / 144;
    const angle = progress * FULL_TURN * 10;
    return new THREE.Vector3(
      0.12 * Math.cos(angle),
      -progress * 0.78,
      0.12 * Math.sin(angle),
    );
  });
  const lowerThread = tubeThrough(
    threadPoints,
    0.022,
    brassMaterial,
    'visible-lower-bob-adjustment-thread',
  );
  const lowerAdjuster = cylinderAlongY(0.31, 0.34, bobMaterial, 36);
  lowerAdjuster.userData.role = 'main-bob-lower-adjusting-nut';

  const compoundBar = new THREE.Group();
  compoundBar.userData.role = 'compound-bimetallic-bar-C';
  const barSegmentCount = 40;
  const segmentMeshes = [];
  const layerThickness = 0.105;
  const layerDepth = 1.02;
  for (let index = 0; index < barSegmentCount; index += 1) {
    const steel = new THREE.Mesh(
      new THREE.BoxGeometry(1, layerThickness, layerDepth),
      steelMaterial,
    );
    steel.userData.layer = 'iron-or-steel-upper';
    steel.userData.role = 'upper-iron-or-steel-layer-of-compound-bar';
    const brass = new THREE.Mesh(
      new THREE.BoxGeometry(1, layerThickness, layerDepth),
      brassMaterial,
    );
    brass.userData.layer = 'brass-lower';
    brass.userData.role = 'lower-brass-layer-of-compound-bar';
    segmentMeshes.push({ brass, steel });
    compoundBar.add(brass, steel);
  }
  const centerClamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.58, 1.12),
    bobMaterial,
  );
  centerClamp.userData.role = 'center-clamp-C-brazed-to-pendulum-rod';
  compoundBar.add(centerClamp);

  const makeEndWeight = (side) => {
    const group = new THREE.Group();
    group.userData.role = side < 0
      ? 'left-adjustable-end-weight-W'
      : 'right-adjustable-end-weight-W';
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(weightWidth, weightHeight, weightDepth),
      weightMaterial,
    );
    block.userData.role = 'adjustable-compensation-weight-W';
    const bore = cylinderAlongZ(0.16, weightDepth + 0.14,
      steelMaterial, 28);
    bore.position.y = 0.08;
    bore.userData.role = 'end-weight-bar-bore';
    const setScrew = cylinderAlongY(0.09, 0.47, brassMaterial, 24);
    setScrew.position.y = weightHeight / 2 + 0.18;
    setScrew.userData.role = 'end-weight-W-set-screw';
    const screwHead = cylinderAlongY(0.16, 0.10, brassMaterial, 24);
    screwHead.position.y = weightHeight / 2 + 0.43;
    screwHead.userData.role = 'end-weight-W-set-screw-head';
    const outerStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.72, 24),
      steelMaterial,
    );
    outerStem.rotation.z = Math.PI / 2;
    outerStem.position.x = side * (weightWidth / 2 + 0.34);
    outerStem.userData.role = 'compound-bar-projecting-end';
    const witness = new THREE.Mesh(
      new THREE.SphereGeometry(0.10, 20, 14),
      whiteMaterial,
    );
    witness.position.set(0, 0, weightDepth / 2 + 0.08);
    witness.userData.role = 'white-end-weight-motion-index';
    group.add(block, bore, setScrew, screwHead, outerStem, witness);
    return { block, bore, group, outerStem, setScrew, witness };
  };
  const leftEndWeight = makeEndWeight(-1);
  const rightEndWeight = makeEndWeight(1);

  const centerOfOscillationMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 24, 16),
    whiteMaterial,
  );
  centerOfOscillationMarker.position.set(
    0,
    -referenceEffectiveLength,
    mainBobDepth / 2 + 0.20,
  );
  centerOfOscillationMarker.userData.nonPhysicalReference = true;
  centerOfOscillationMarker.userData.role =
    'white-fixed-center-of-oscillation-marker';
  const compensationDatum = new THREE.Mesh(
    new THREE.BoxGeometry(mainBobWidth + 0.65, 0.035, 0.035),
    whiteMaterial,
  );
  compensationDatum.position.set(
    0,
    -referenceEffectiveLength,
    mainBobDepth / 2 + 0.19,
  );
  compensationDatum.userData.nonPhysicalReference = true;
  compensationDatum.userData.role =
    'nonphysical-fixed-center-of-oscillation-datum';

  pendulumCarrier.add(
    movingPivotHub,
    rod,
    mainBob,
    mainBobHub,
    lowerThread,
    lowerAdjuster,
    compoundBar,
    leftEndWeight.group,
    rightEndWeight.group,
    compensationDatum,
    centerOfOscillationMarker,
  );
  root.add(fixedFrame, pendulumCarrier);

  const setBarLayerSegment = (mesh, start, end, normalOffset) => {
    const delta = end.clone().sub(start);
    const length = delta.length();
    const tangentAngle = Math.atan2(delta.y, delta.x);
    const normal = new THREE.Vector3(
      -Math.sin(tangentAngle),
      Math.cos(tangentAngle),
      0,
    );
    mesh.position.copy(start).add(end).multiplyScalar(0.5)
      .addScaledVector(normal, normalOffset);
    mesh.rotation.z = tangentAngle;
    mesh.scale.x = length;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    pendulumCarrier.rotation.z = state.swingAngle;
    rod.scale.y = state.massProperties.rodLength - 0.25;
    rod.position.y = -(state.massProperties.rodLength + 0.25) / 2;
    mainBob.position.y = -state.massProperties.mainBobCenterDistance;
    mainBobHub.position.y = mainBob.position.y;
    compoundBar.position.y = -state.barCenterDistance;
    centerClamp.position.y = 0;
    for (let index = 0; index < barSegmentCount; index += 1) {
      const normalizedStart = -1 + 2 * index / barSegmentCount;
      const normalizedEnd = -1 + 2 * (index + 1) / barSegmentCount;
      const start = new THREE.Vector3(
        normalizedStart * barHalfSpan,
        state.barEndLift * normalizedStart ** 2,
        0,
      );
      const end = new THREE.Vector3(
        normalizedEnd * barHalfSpan,
        state.barEndLift * normalizedEnd ** 2,
        0,
      );
      setBarLayerSegment(
        segmentMeshes[index].steel,
        start,
        end,
        layerThickness / 2,
      );
      setBarLayerSegment(
        segmentMeshes[index].brass,
        start,
        end,
        -layerThickness / 2,
      );
    }
    const leftBarPoint = state.barPointAtNormalizedX(-1);
    const rightBarPoint = state.barPointAtNormalizedX(1);
    leftEndWeight.group.position.set(
      -barHalfSpan,
      -state.weightDistance,
      0,
    );
    leftEndWeight.group.rotation.z = leftBarPoint.tangentAngle;
    rightEndWeight.group.position.set(
      barHalfSpan,
      -state.weightDistance,
      0,
    );
    rightEndWeight.group.rotation.z = rightBarPoint.tangentAngle;
    const bobBottomDistance = state.massProperties.mainBobCenterDistance
      + mainBobHeight / 2;
    lowerAdjuster.position.y = -bobBottomDistance - 0.14;
    lowerThread.position.y = -bobBottomDistance - 0.30;
    root.userData.compensationState = {
      barEndLift: state.barEndLift,
      centerOfOscillationError: state.centerOfOscillationError,
      effectiveLength: state.centerOfOscillationDistance,
      rodExtension: state.rodExtension,
      temperature: state.temperature,
      weightDistance: state.weightDistance,
    };
    root.userData.renderState = state;
  };

  const sourcePointToNeutralFront = (point) => new THREE.Vector3(
    (point.x - sourceRasterVisibleRodTop.x) * sourceScale,
    pivot.y - unshownUpperRodLength
      - (point.y - sourceRasterVisibleRodTop.y) * sourceScale,
    0,
  );

  root.userData.archetype =
    'compound-bimetal-bar-constant-center-of-oscillation-pendulum';
  root.userData.blocks = {
    ceilingPlate,
    centerClamp,
    centerOfOscillationMarker,
    compensationDatum,
    compoundBar,
    fixedFrame,
    fixedPivotShaft,
    leftEndWeight,
    lowerAdjuster,
    lowerThread,
    mainBob,
    mainBobHub,
    mainBobWitness,
    movingPivotHub,
    pendulumCarrier,
    pivotBrackets,
    rightEndWeight,
    rod,
    segmentMeshes,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.15, -7.55, -2.10),
    new THREE.Vector3(5.15, 5.95, 2.10),
  );
  root.userData.canonicalTimes = {
    cold: thermalCyclePeriod * 0.75,
    cycleClosure: thermalCyclePeriod,
    hot: thermalCyclePeriod * 0.25,
    neutralCooling: thermalCyclePeriod * 0.50,
    neutralHeating: 0,
  };
  root.userData.geometry = {
    barHalfSpan,
    layerDepth,
    layerThickness,
    mainBobDepth,
    mainBobHeight,
    mainBobWidth,
    maximumRodExtension,
    nominalTemperature,
    pivot: pivot.clone(),
    referenceBarCenterDistance,
    referenceBarEndLift,
    referenceEffectiveLength,
    referenceMainBobCenterDistance,
    referenceRodLength,
    referenceWeightDistance,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    swingAmplitude,
    swingAngularFrequency,
    swingPeriod,
    temperatureAmplitude,
    thermalAngularFrequency,
    thermalCyclePeriod,
    unshownUpperRodLength,
    weightDepth,
    weightHeight,
    weightWidth,
  };
  root.userData.groundFloorY = -7.55;
  root.userData.massModel = {
    compoundBar: {
      assumption: 'negligible mass relative to M and the two W weights',
      brassLayerBelowSteel: true,
    },
    eachEndWeight: {
      count: 2,
      intrinsicRadiusOfGyrationSquared:
        weightIntrinsicRadiusOfGyrationSquared,
      mass: eachWeightMass,
    },
    mainBob: {
      intrinsicRadiusOfGyrationSquared:
        mainBobIntrinsicRadiusOfGyrationSquared,
      mass: mainBobMass,
    },
    reference: referenceMassProperties,
    rod: {
      mass: rodMass,
      model: 'uniform-slender-rod-about-unshown-upper-pivot',
    },
    totalMass,
  };
  root.userData.massProperties = massProperties;
  root.userData.mechanism =
    'the lower brass layer expands more than the upper iron-or-steel layer, bending compound bar C upward and lifting both W weights; their solved rise offsets steel-rod elongation so I divided by total first moment—and therefore the center of oscillation—remains constant';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'Brown supplies the cropped central rod, compound two-layer bar C with brass downward, symmetric adjustable weights W, central weight M, and lower adjuster. The true upper suspension, material coefficients, masses, depth, thermal magnitude, and cadence are not dimensioned.',
    sourceUrl: 'https://507movements.com/mm_317.html',
  };
  root.userData.sourcePointToNeutralFront = sourcePointToNeutralFront;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    brownPlate317: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one cropped pendulum rod, one center-fastened brass-under-steel compound bar C, two symmetric adjustable weights W, one main weight M, and one lower threaded adjuster',
      measurementUncertaintyPixels: 10,
      rasterBarCenter: sourceRasterBarCenter.clone(),
      rasterLeftBarTip: sourceRasterLeftBarTip.clone(),
      rasterLeftWeightCenter: sourceRasterLeftWeightCenter.clone(),
      rasterMainBobBottomRight:
        sourceRasterMainBobBottomRight.clone(),
      rasterMainBobTopLeft: sourceRasterMainBobTopLeft.clone(),
      rasterRightBarTip: sourceRasterRightBarTip.clone(),
      rasterRightWeightCenter: sourceRasterRightWeightCenter.clone(),
      rasterRodEnd: sourceRasterRodEnd.clone(),
      rasterVisibleRodTop: sourceRasterVisibleRodTop.clone(),
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: thermalCyclePeriod,
    schedule: [
      'neutral-compound-bar-matches-Brown-plate',
      'warming-elongates-the-steel-pendulum-rod',
      'brass-underlayer-expands-more-and-curves-bar-C-upward',
      'both-W-weights-rise-to-hold-the-effective-length-fixed',
      'cooling-relaxes-the-bar-and-lowers-both-W-weights',
      'pendulum-completes-two-visible-swings-per-thermal-cycle',
    ],
  };
  root.userData.transmission = {
    brassLayer: 'lower high-expansion layer',
    compensationTarget: 'constant physical-pendulum effective length I/(M d)',
    ironOrSteelLayer: 'upper low-expansion layer',
    output: 'temperature-compensated pendulum oscillation',
    symmetricEndWeights: 2,
    thermalInput: 'exaggerated cyclic temperature applied to rod and bimetal bar',
  };
  root.userData.weightStateAtRodExtension = weightStateAtRodExtension;

  correctCompensationJournals(root, movement.id);
  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  for (const object of [
    centerOfOscillationMarker,
    compensationDatum,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';

  return {
    cameraDirection: new THREE.Vector3(1.2, .6, 16),
    root,
    update,
  };
}

export function createAuthoredCompensationPendulumMovement(movement) {
  if (movement.id === 316) {
    // The mercury is a full column inside the clear glass (it was a
    // half-cylinder section, so the jar looked half empty when turned).
    return applyCutawayFor(mercurialCompensationPendulum(movement), 316);
  }
  if (movement.id === 317) {
    return compoundBarCompensationPendulum(movement);
  }
  return null;
}
