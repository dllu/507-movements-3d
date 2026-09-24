import { correctDifferentialThreads } from './differential-thread-solids.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeGear,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function wrappedAngle(unwrappedAngle) {
  const turns = unwrappedAngle / FULL_TURN;
  if (Math.abs(turns - Math.round(turns)) < 1e-12) return 0;
  return positiveModulo(unwrappedAngle, FULL_TURN);
}

function makeAxialCylinder({
  depth,
  material,
  radius,
  role,
  segments = 52,
}) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    X_AXIS,
  );
  cylinder.userData.axis = X_AXIS.clone();
  cylinder.userData.role = role;
  return cylinder;
}

function makeAxialHelix({
  lead,
  material,
  phase = 0,
  radius,
  role,
  tubeRadius,
  turnCount,
  xStart,
}) {
  class AxialHelixCurve extends THREE.Curve {
    getPoint(progress, target = new THREE.Vector3()) {
      const angle = phase + FULL_TURN * turnCount * progress;
      return target.set(
        xStart + lead * turnCount * progress,
        radius * Math.cos(angle),
        radius * Math.sin(angle),
      );
    }
  }

  const curve = new AxialHelixCurve();
  const helix = new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      Math.ceil(turnCount * 48),
      tubeRadius,
      9,
      false,
    ),
    material,
  );
  helix.userData.lead = lead;
  helix.userData.phase = phase;
  helix.userData.radius = radius;
  helix.userData.rightHanded = true;
  helix.userData.role = role;
  helix.userData.turnCount = turnCount;
  helix.userData.xEnd = xStart + lead * turnCount;
  helix.userData.xStart = xStart;
  return helix;
}

function makeBearingRing({ material, radius, role, tubeRadius = 0.11, x }) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 12, 64),
    material,
  );
  ring.rotation.y = Math.PI / 2;
  ring.position.x = x;
  ring.userData.role = role;
  return ring;
}

function differentialScrewDrive(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.71);

  const commonModule = 5.4 / 112;
  const pinionFTeeth = 10;
  const wheelDTeeth = 102;
  const pinionBTeeth = 19;
  const wheelETeeth = 93;
  const pinionFRadius = commonModule * pinionFTeeth / 2;
  const wheelDRadius = commonModule * wheelDTeeth / 2;
  const pinionBRadius = commonModule * pinionBTeeth / 2;
  const wheelERadius = commonModule * wheelETeeth / 2;
  const toothHeight = commonModule * 2;
  const commonCenterDistance = pinionFRadius + wheelDRadius;
  const upperAxisY = 2.15;
  const lowerAxisY = upperAxisY - commonCenterDistance;
  const longPinionStationX = -1.1;
  const longPinionFaceWidth = 2.98;
  const wheelDNominalX = -0.9;
  const fixedGearStationX = 1.65;
  const narrowGearFaceWidth = 0.58;
  const wheelDFaceWidth = 0.5;
  const inputShaftRadius = 0.14;
  const inputShaftLength = 6.95;
  const screwCoreRadius = 0.235;
  const externalThreadRadius = 0.315;
  const internalThreadRadius = 0.348;
  const threadRadialClearance = internalThreadRadius - externalThreadRadius;
  const screwLead = 0.48;
  const screwLeadPerRadian = screwLead / FULL_TURN;
  const externalThreadTurnCount = 9;
  const externalThreadStartX = wheelDNominalX
    + wheelDFaceWidth / 2 + 0.08;
  const externalThreadEndX = externalThreadStartX
    + screwLead * externalThreadTurnCount;
  const screwCoreLength = 7.75;
  const screwCoreCenterX = 0.125;
  const nutWidth = 0.82;
  const nutOuterRadius = 0.51;
  const nutThreadTurnCount = nutWidth / screwLead;
  const nutThreadStartX = fixedGearStationX - nutWidth / 2;
  const nutThreadPhase = FULL_TURN * (
    nutThreadStartX - externalThreadStartX
  ) / screwLead;
  const leftStandardX = -3.05;
  const rightStandardX = 2.36;
  const demonstrationPeriod = 12;
  const peakInputTurns = 8;
  const inputHalfExcursionAngle = peakInputTurns * Math.PI;
  const pinionFPhase = 0;
  const wheelDPhase = Math.PI / wheelDTeeth;
  const pinionBPhase = 0;
  const wheelEPhase = 0; // Odd/odd pair on the vertical centerline.
  const externalMeshPhaseConstantFD = Math.PI;
  const externalMeshPhaseConstantBE = 0;
  const wheelDRatio = -pinionFTeeth / wheelDTeeth;
  const wheelERatio = -pinionBTeeth / wheelETeeth;
  const maximumRelativeThreadRotation = (
    wheelDRatio - wheelERatio
  ) * peakInputTurns * FULL_TURN;
  const maximumScrewTravel = screwLeadPerRadian
    * maximumRelativeThreadRotation;

  const inputMaterial = matte(PALETTE.driver, {
    metalness: 0.15,
    roughness: 0.55,
  });
  const screwMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.5,
  });
  const nutMaterial = matte(PALETTE.accent, {
    metalness: 0.18,
    roughness: 0.5,
  });
  const nutSleeveMaterial = matte(PALETTE.brass, {
    metalness: 0.22,
    opacity: 0.7,
    roughness: 0.43,
    transparent: true,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const frame = new THREE.Group();
  frame.userData.role = 'fixed-two-standard-differential-drive-frame';
  root.add(frame);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(7.55, 0.18, 1.5),
    frameMaterial,
  );
  base.position.set(0.15, -3.3, 0);
  base.userData.role = 'fixed-base-bed';
  frame.add(base);

  const tallStandardBars = [-1, 1].map((side) => {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 5.45, 0.3),
      frameMaterial,
    );
    bar.position.set(leftStandardX, -0.52, side * 0.59);
    bar.userData.role = 'left-tall-standard-side-bar';
    frame.add(bar);
    return bar;
  });
  const tallStandardTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.24, 1.48),
    frameMaterial,
  );
  tallStandardTop.position.set(leftStandardX, 2.16, 0);
  tallStandardTop.userData.role = 'left-tall-standard-top-bridge';
  frame.add(tallStandardTop);

  const rightStandardBars = [-1, 1].map((side) => {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 2.9, 0.3),
      frameMaterial,
    );
    bar.position.set(rightStandardX, -1.82, side * 0.59);
    bar.userData.role = 'right-short-standard-side-bar';
    frame.add(bar);
    return bar;
  });
  const rightStandardTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.24, 1.48),
    frameMaterial,
  );
  rightStandardTop.position.set(rightStandardX, lowerAxisY, 0);
  rightStandardTop.userData.role = 'right-short-standard-bearing-bridge';
  frame.add(rightStandardTop);

  const leftInputBearing = makeBearingRing({
    material: frameMaterial,
    radius: 0.29,
    role: 'fixed-left-input-shaft-bearing',
    tubeRadius: 0.095,
    x: leftStandardX - 0.135,
  });
  leftInputBearing.position.y = upperAxisY;
  frame.add(leftInputBearing);

  const leftScrewGuide = makeBearingRing({
    material: frameMaterial,
    radius: 0.39,
    role: 'fixed-left-translating-screw-guide',
    tubeRadius: 0.105,
    x: leftStandardX - 0.135,
  });
  leftScrewGuide.position.y = lowerAxisY;
  frame.add(leftScrewGuide);

  const fixedNutBearing = makeBearingRing({
    material: frameMaterial,
    radius: 0.65,
    role: 'fixed-bearing-preventing-nut-wheel-lateral-motion',
    tubeRadius: 0.13,
    x: rightStandardX - 0.145,
  });
  fixedNutBearing.position.y = lowerAxisY;
  frame.add(fixedNutBearing);

  const inputAssembly = new THREE.Group();
  inputAssembly.position.y = upperAxisY;
  inputAssembly.userData.axis = X_AXIS.clone();
  inputAssembly.userData.rigidMember = true;
  inputAssembly.userData.role = 'driving-shaft-A-with-rigid-pinions-F-and-B';
  root.add(inputAssembly);

  const inputShaft = makeAxialCylinder({
    depth: inputShaftLength,
    material: darkMaterial,
    radius: inputShaftRadius,
    role: 'driving-shaft-A',
  });
  inputShaft.position.x = 0.15;
  inputAssembly.add(inputShaft);

  const longPinionF = makeGear({
    axis: X_AXIS,
    color: PALETTE.driver,
    depth: longPinionFaceWidth,
    radius: pinionFRadius,
    teeth: pinionFTeeth,
    toothHeight,
    pressureAngle: Math.PI / 6,
  });
  longPinionF.position.x = longPinionStationX;
  longPinionF.userData.role = 'long-faced-pinion-F-accommodating-wheel-D-travel';
  longPinionF.userData.rotor.rotation.z = pinionFPhase;
  inputAssembly.add(longPinionF);

  const pinionB = makeGear({
    axis: X_AXIS,
    color: PALETTE.driver,
    depth: narrowGearFaceWidth,
    radius: pinionBRadius,
    teeth: pinionBTeeth,
    toothHeight,
    pressureAngle: Math.PI / 6,
  });
  pinionB.position.x = fixedGearStationX;
  pinionB.userData.role = 'fixed-station-pinion-B';
  pinionB.userData.rotor.rotation.z = pinionBPhase;
  inputAssembly.add(pinionB);

  const inputShaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.07, 0.11),
    whiteMaterial,
  );
  inputShaftIndex.position.set(3.1, inputShaftRadius + 0.035, 0);
  inputShaftIndex.userData.role = 'white-driving-shaft-A-speed-index';
  inputAssembly.add(inputShaftIndex);

  const screwAssembly = new THREE.Group();
  screwAssembly.position.y = lowerAxisY;
  screwAssembly.userData.axis = X_AXIS.clone();
  screwAssembly.userData.rigidMember = true;
  screwAssembly.userData.role =
    'translating-screw-C-rigidly-secured-to-wheel-D';
  root.add(screwAssembly);

  const wheelD = makeGear({
    axis: X_AXIS,
    color: PALETTE.driven,
    depth: wheelDFaceWidth,
    radius: wheelDRadius,
    teeth: wheelDTeeth,
    toothHeight,
    pressureAngle: Math.PI / 6,
  });
  wheelD.position.x = wheelDNominalX;
  wheelD.userData.role = 'translating-wheel-D-rigid-with-screw-C';
  wheelD.userData.rotor.rotation.z = wheelDPhase;
  screwAssembly.add(wheelD);

  const screwCore = makeAxialCylinder({
    depth: screwCoreLength,
    material: darkMaterial,
    radius: screwCoreRadius,
    role: 'threaded-screw-shaft-C-core',
  });
  screwCore.position.x = screwCoreCenterX;
  screwAssembly.add(screwCore);

  const externalThread = makeAxialHelix({
    lead: screwLead,
    material: screwMaterial,
    radius: externalThreadRadius,
    role: 'continuous-right-hand-external-thread-on-screw-C',
    tubeRadius: 0.052,
    turnCount: externalThreadTurnCount,
    xStart: externalThreadStartX,
  });
  screwAssembly.add(externalThread);

  const screwEndIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.065, 0.1),
    whiteMaterial,
  );
  screwEndIndex.position.set(3.55, screwCoreRadius + 0.035, 0);
  screwEndIndex.userData.role = 'white-screw-C-speed-and-travel-index';
  screwAssembly.add(screwEndIndex);

  const nutAssembly = new THREE.Group();
  nutAssembly.position.y = lowerAxisY;
  nutAssembly.userData.axis = X_AXIS.clone();
  nutAssembly.userData.axiallyFixed = true;
  nutAssembly.userData.rigidMember = true;
  nutAssembly.userData.role = 'axially-fixed-wheel-E-and-threaded-nut';
  root.add(nutAssembly);

  const wheelE = makeGear({
    axis: X_AXIS,
    color: PALETTE.accent,
    depth: narrowGearFaceWidth,
    radius: wheelERadius,
    teeth: wheelETeeth,
    toothHeight,
    pressureAngle: Math.PI / 6,
  });
  wheelE.position.x = fixedGearStationX;
  wheelE.userData.role = 'axially-fixed-wheel-E-carrying-rotating-nut';
  wheelE.userData.rotor.rotation.z = wheelEPhase;
  nutAssembly.add(wheelE);

  const nutSleeve = makeAxialCylinder({
    depth: nutWidth,
    material: nutSleeveMaterial,
    radius: nutOuterRadius,
    role: 'transparent-rotating-nut-secured-in-wheel-E-hub',
  });
  nutSleeve.position.x = fixedGearStationX;
  nutAssembly.add(nutSleeve);

  const nutEndRings = [-1, 1].map((side) => {
    const ring = makeBearingRing({
      material: nutMaterial,
      radius: nutOuterRadius,
      role: `${side < 0 ? 'left' : 'right'}-nut-end-ring`,
      tubeRadius: 0.055,
      x: fixedGearStationX + side * nutWidth / 2,
    });
    nutAssembly.add(ring);
    return ring;
  });

  const internalThread = makeAxialHelix({
    lead: screwLead,
    material: nutMaterial,
    phase: nutThreadPhase,
    radius: internalThreadRadius,
    role: 'matching-right-hand-internal-thread-in-wheel-E-nut',
    tubeRadius: 0.035,
    turnCount: nutThreadTurnCount,
    xStart: nutThreadStartX,
  });
  nutAssembly.add(internalThread);

  const contactMarkerFD = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 24, 16),
    whiteMaterial,
  );
  contactMarkerFD.position.set(
    wheelDNominalX,
    lowerAxisY + wheelDRadius,
    0,
  );
  contactMarkerFD.userData.role = 'moving-pitch-contact-F-to-D';
  root.add(contactMarkerFD);

  const contactMarkerBE = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 24, 16),
    whiteMaterial,
  );
  contactMarkerBE.position.set(
    fixedGearStationX,
    lowerAxisY + wheelERadius,
    0,
  );
  contactMarkerBE.userData.role = 'fixed-pitch-contact-B-to-E';
  root.add(contactMarkerBE);

  const differentialTravelRateForAngularSpeeds = (
    screwAngularSpeed,
    nutAngularSpeed,
  ) => screwLeadPerRadian * (screwAngularSpeed - nutAngularSpeed);

  const stateAtTime = (time) => {
    const wrappedTime = positiveModulo(time, demonstrationPeriod);
    const phase = FULL_TURN * wrappedTime / demonstrationPeriod;
    const phaseRate = FULL_TURN / demonstrationPeriod;
    const inputUnwrappedAngle = inputHalfExcursionAngle
      * (1 - Math.cos(phase));
    const inputAngularSpeed = inputHalfExcursionAngle
      * phaseRate * Math.sin(phase);
    const inputAngularAcceleration = inputHalfExcursionAngle
      * phaseRate ** 2 * Math.cos(phase);
    const wheelDUnwrappedAngle = wheelDRatio * inputUnwrappedAngle;
    const wheelDUnwrappedAngularSpeed = wheelDRatio * inputAngularSpeed;
    const wheelDUnwrappedAngularAcceleration =
      wheelDRatio * inputAngularAcceleration;
    const wheelEUnwrappedAngle = wheelERatio * inputUnwrappedAngle;
    const wheelEUnwrappedAngularSpeed = wheelERatio * inputAngularSpeed;
    const wheelEUnwrappedAngularAcceleration =
      wheelERatio * inputAngularAcceleration;
    const relativeThreadRotation =
      wheelDUnwrappedAngle - wheelEUnwrappedAngle;
    const differentialAngularSpeed =
      wheelDUnwrappedAngularSpeed - wheelEUnwrappedAngularSpeed;
    const differentialAngularAcceleration =
      wheelDUnwrappedAngularAcceleration - wheelEUnwrappedAngularAcceleration;
    const screwTranslation = screwLeadPerRadian * relativeThreadRotation;
    const screwAxialVelocity = differentialTravelRateForAngularSpeeds(
      wheelDUnwrappedAngularSpeed,
      wheelEUnwrappedAngularSpeed,
    );
    const screwAxialAcceleration = screwLeadPerRadian
      * differentialAngularAcceleration;
    const wheelDAxialPosition = wheelDNominalX + screwTranslation;
    const longPinionMinimumX =
      longPinionStationX - longPinionFaceWidth / 2;
    const longPinionMaximumX =
      longPinionStationX + longPinionFaceWidth / 2;
    const wheelDMinimumX = wheelDAxialPosition - wheelDFaceWidth / 2;
    const wheelDMaximumX = wheelDAxialPosition + wheelDFaceWidth / 2;
    const longPinionFaceOverlap = Math.max(
      0,
      Math.min(longPinionMaximumX, wheelDMaximumX)
        - Math.max(longPinionMinimumX, wheelDMinimumX),
    );
    const translatedExternalThreadMinimumX =
      externalThreadStartX + screwTranslation;
    const translatedExternalThreadMaximumX =
      externalThreadEndX + screwTranslation;
    const nutMinimumX = fixedGearStationX - nutWidth / 2;
    const nutMaximumX = fixedGearStationX + nutWidth / 2;
    const threadEngagementLength = Math.max(
      0,
      Math.min(translatedExternalThreadMaximumX, nutMaximumX)
        - Math.max(translatedExternalThreadMinimumX, nutMinimumX),
    );
    const pinionFGearAngle = inputUnwrappedAngle + pinionFPhase;
    const wheelDGearAngle = wheelDUnwrappedAngle + wheelDPhase;
    const pinionBGearAngle = inputUnwrappedAngle + pinionBPhase;
    const wheelEGearAngle = wheelEUnwrappedAngle + wheelEPhase;
    return {
      differentialAngularAcceleration,
      differentialAngularSpeed,
      externalMeshPhaseErrorBE:
        pinionBTeeth * pinionBGearAngle
          + wheelETeeth * wheelEGearAngle
          - externalMeshPhaseConstantBE,
      externalMeshPhaseErrorFD:
        pinionFTeeth * pinionFGearAngle
          + wheelDTeeth * wheelDGearAngle
          - externalMeshPhaseConstantFD,
      inputAngle: wrappedAngle(inputUnwrappedAngle),
      inputAngularAcceleration,
      inputAngularSpeed,
      inputUnwrappedAngle,
      longPinionFaceOverlap,
      nutAngle: wrappedAngle(wheelEUnwrappedAngle),
      nutAngularSpeed: wheelEUnwrappedAngularSpeed,
      nutAxialPosition: fixedGearStationX,
      phase,
      relativeThreadRotation,
      screwAngle: wrappedAngle(wheelDUnwrappedAngle),
      screwAngularSpeed: wheelDUnwrappedAngularSpeed,
      screwAxialAcceleration,
      screwAxialVelocity,
      screwTranslation,
      threadEngagementLength,
      threadPhaseError:
        screwTranslation / screwLeadPerRadian - relativeThreadRotation,
      wheelDAngle: wrappedAngle(wheelDGearAngle),
      wheelDAxialPosition,
      wheelDMeshPitchSpeedError:
        inputAngularSpeed * pinionFRadius
          + wheelDUnwrappedAngularSpeed * wheelDRadius,
      wheelDUnwrappedAngle,
      wheelDUnwrappedAngularSpeed,
      wheelEAngle: wrappedAngle(wheelEGearAngle),
      wheelEAxialPosition: fixedGearStationX,
      wheelEMeshPitchSpeedError:
        inputAngularSpeed * pinionBRadius
          + wheelEUnwrappedAngularSpeed * wheelERadius,
      wheelEUnwrappedAngle,
      wheelEUnwrappedAngularSpeed,
      wrappedTime,
    };
  };

  root.userData.archetype =
    'common-input-twin-spur-reductions-driving-rotating-nut-differential-screw-translation';
  root.userData.blocks = {
    base,
    contactMarkerBE,
    contactMarkerFD,
    externalThread,
    fixedNutBearing,
    frame,
    inputAssembly,
    inputShaft,
    inputShaftIndex,
    internalThread,
    leftInputBearing,
    leftScrewGuide,
    longPinionF,
    nutAssembly,
    nutEndRings,
    nutSleeve,
    pinionB,
    rightStandardBars,
    rightStandardTop,
    screwAssembly,
    screwCore,
    screwEndIndex,
    tallStandardBars,
    tallStandardTop,
    wheelD,
    wheelE,
  };
  root.userData.cameraDistanceScale = 0.84;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.55, -3.45, -0.9),
    new THREE.Vector3(4.25, 2.65, 0.9),
  );
  root.userData.canonicalTimes = {
    closure: demonstrationPeriod,
    maximumTravel: demonstrationPeriod / 2,
    start: 0,
  };
  root.userData.driveSchedule = {
    inputExcursion:
      'smooth-forward-eight-turn-excursion-followed-by-smooth-reversal',
    peakInputTurns,
    sourcePrescribesDriveSchedule: false,
    purpose:
      'finite-reversible-demonstration-without-teleporting-the-continuously-traveling-screw',
  };
  root.userData.geometry = {
    commonCenterDistance,
    commonModule,
    externalThreadEndX,
    externalThreadStartX,
    externalThreadTurnCount,
    fixedGearStationX,
    inputShaftLength,
    inputShaftRadius,
    internalThreadRadius,
    leftStandardX,
    longPinionFaceWidth,
    longPinionStationX,
    maximumScrewTravel,
    narrowGearFaceWidth,
    nutOuterRadius,
    nutWidth,
    pinionBRadius,
    pinionBTeeth,
    pinionFRadius,
    pinionFTeeth,
    rightStandardX,
    screwCoreLength,
    screwCoreRadius,
    screwLead,
    screwLeadPerRadian,
    threadRadialClearance,
    toothHeight,
    upperAxisY,
    lowerAxisY,
    wheelDFaceWidth,
    wheelDNominalX,
    wheelDRadius,
    wheelDTeeth,
    wheelERadius,
    wheelETeeth,
  };
  root.userData.mechanism =
    'shaft-A-rigidly-carries-long-pinion-F-and-pinion-B-F-drives-translating-wheel-D-rigid-with-screw-C-while-B-drives-axially-fixed-wheel-E-and-its-rotating-nut';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official movement page marks its animation unavailable',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate260: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'two external spur reductions on one input shaft drive a translating screw wheel and an axially fixed rotating nut wheel on a common lower axis',
      measurementUncertaintyPixels: 6,
      officialAnimationAvailable: false,
      rasterAxisY: {
        input: 94,
        screw: 301,
      },
      rasterPinionBBounds: {
        bottom: 129,
        left: 394,
        right: 438,
        top: 62,
      },
      rasterPinionFBounds: {
        bottom: 111,
        left: 98,
        right: 327,
        top: 76,
      },
      rasterWheelDBounds: {
        bottom: 490,
        left: 241,
        right: 280,
        top: 112,
      },
      rasterWheelEBounds: {
        bottom: 466,
        left: 393,
        right: 438,
        top: 130,
      },
      view:
        'side-elevation-with-shaft-axis-horizontal-and-gear-planes-seen-edge-on',
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
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cycleClosure: demonstrationPeriod,
    demonstrationPeriod,
  };
  root.userData.transmission = {
    differentialTravelLaw:
      'x=(screw-lead/(2*pi))*(wheel-D-angle-wheel-E-nut-angle)',
    differentialTravelRateForAngularSpeeds,
    externalMeshPhaseConstantBE,
    externalMeshPhaseConstantFD,
    pinionBToWheelERatio: wheelERatio,
    pinionFToWheelDRatio: wheelDRatio,
    rightHandThreadAssumption: true,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    inputAssembly.rotation.x = state.inputAngle;
    screwAssembly.position.x = state.screwTranslation;
    screwAssembly.rotation.x = state.screwAngle;
    nutAssembly.rotation.x = state.nutAngle;
    contactMarkerFD.position.x = state.wheelDAxialPosition;
    root.userData.kinematics = state;
  };
  correctDifferentialThreads(root, 260);
  // Brown draws the short standard as a knee bracket whose outboard edge
  // sweeps out to the bed below the screw, not a flat post. Each side bar
  // gets a concave flared web on its outboard face.
  {
    const bars = root.userData.blocks.rightStandardBars;
    const barBox = new THREE.Box3().setFromObject(bars[0]);
    const inverse = root.matrixWorld.clone().invert();
    barBox.applyMatrix4(inverse);
    const x0 = barBox.max.x;
    const top = barBox.max.y;
    const bottom = barBox.min.y;
    const flare = new THREE.Shape();
    flare.moveTo(x0, top);
    flare.quadraticCurveTo(x0 + 0.04, bottom + 0.18, x0 + 0.86, bottom);
    flare.lineTo(x0 - 0.004, bottom);
    flare.lineTo(x0 - 0.004, top);
    root.userData.blocks.rightStandardFlares = bars.map((bar) => {
      const web = new THREE.Mesh(
        new THREE.ExtrudeGeometry(flare, {
          bevelEnabled: false,
          curveSegments: 24,
          depth: 0.3,
        }).translate(0, 0, bar.position.z - 0.15),
        bar.material,
      );
      web.userData.role = 'right-short-standard-flared-knee';
      bar.parent.add(web);
      return web;
    });
  }
  // Brown draws neither shaft index bar; keep the roles for the kinematic
  // tests but do not render them.
  inputShaftIndex.visible = false;
  screwEndIndex.visible = false;
  update(0);
  markShadows(root);
  return {
    root,
    update,
    // Plate 260 is a side elevation with both shafts horizontal and every
    // gear plane seen edge-on.
    cameraDirection: new THREE.Vector3(0, 0.02, 1),
  };
}

export function createAuthoredDifferentialDriveMovement(movement) {
  if (movement.id !== 260) return null;
  const result = differentialScrewDrive(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
