import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongX(radius, length, material, segments = 36) {
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

function annulusAlongX({
  innerRadius,
  material,
  outerRadius,
  width,
}) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const bore = new THREE.Path();
  bore.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  bore.closePath();
  shape.holes.push(bore);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    curveSegments: 48,
    depth: width,
  });
  geometry.translate(0, 0, -width / 2);
  geometry.rotateY(Math.PI / 2);
  return new THREE.Mesh(geometry, material);
}

class RadialScrewHelix extends THREE.Curve {
  constructor({ maximumX, minimumX, phase, pitch, radius }) {
    super();
    this.maximumX = maximumX;
    this.minimumX = minimumX;
    this.phase = phase;
    this.pitch = pitch;
    this.radius = radius;
  }

  getPoint(parameter, target = new THREE.Vector3()) {
    const x = THREE.MathUtils.lerp(
      this.minimumX,
      this.maximumX,
      parameter,
    );
    const angle = this.phase
      + (x - this.minimumX) / this.pitch * FULL_TURN;
    return target.set(
      x,
      this.radius * Math.cos(angle),
      this.radius * Math.sin(angle),
    );
  }
}

class LogarithmicSpiralOnPaper extends THREE.Curve {
  constructor({
    drawingPlaneY,
    logarithmicRate,
    outerRadius,
    sweepAngle,
  }) {
    super();
    this.drawingPlaneY = drawingPlaneY;
    this.logarithmicRate = logarithmicRate;
    this.outerRadius = outerRadius;
    this.sweepAngle = sweepAngle;
  }

  getPoint(parameter, target = new THREE.Vector3()) {
    const angle = this.sweepAngle * parameter;
    const radius = this.outerRadius * Math.exp(
      -this.logarithmicRate * angle,
    );
    return target.set(
      radius * Math.cos(angle),
      this.drawingPlaneY,
      -radius * Math.sin(angle),
    );
  }
}

function makeRoundedBar({ length, material, thickness, width }) {
  const group = new THREE.Group();
  const middleLength = Math.max(0, length - width);
  const middle = new THREE.Mesh(
    new THREE.BoxGeometry(middleLength, thickness, width),
    material,
  );
  middle.position.x = length / 2;
  group.add(middle);
  for (const x of [width / 2, length - width / 2]) {
    const end = cylinderAlongY(width / 2, thickness, material, 36);
    end.position.x = x;
    group.add(end);
  }
  return group;
}

function makeThreadedRollingWheel({
  axleRadius,
  hubWidth,
  internalThreadPhase,
  material,
  radius,
  rimMaterial,
  threadLead,
  whiteMaterial,
}) {
  const assembly = new THREE.Group();
  assembly.userData.role = 'threaded-wheel-carriage-on-radial-screw';

  const rotor = new THREE.Group();
  rotor.userData.role = 'rolling-and-thread-advancing-wheel-rotor';
  assembly.add(rotor);

  const rimTube = 0.075;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius - rimTube, rimTube, 12, 72),
    rimMaterial,
  );
  rim.rotation.y = Math.PI / 2;
  rim.userData.role = 'paper-contacting-milled-wheel-rim';
  rotor.add(rim);

  const faceRadius = radius - rimTube * 1.35;
  const face = annulusAlongX({
    innerRadius: radius * 0.70,
    material,
    outerRadius: faceRadius,
    width: 0.09,
  });
  face.userData.role = 'thin-wheel-face-retaining-ring';
  rotor.add(face);

  const spokeCount = 8;
  const spokeLength = radius * 0.68;
  const spokeCenter = radius * 0.54;
  const spokes = [];
  for (let index = 0; index < spokeCount; index += 1) {
    const angle = index / spokeCount * FULL_TURN;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, spokeLength, 0.055),
      rimMaterial,
    );
    spoke.position.set(
      0,
      spokeCenter * Math.cos(angle),
      spokeCenter * Math.sin(angle),
    );
    spoke.rotation.x = -angle;
    spoke.userData.role = 'one-of-eight-wheel-spokes';
    rotor.add(spoke);
    spokes.push(spoke);
  }

  const hub = annulusAlongX({
    innerRadius: axleRadius + 0.035,
    material: rimMaterial,
    outerRadius: radius * 0.27,
    width: hubWidth,
  });
  hub.userData.role = 'female-threaded-wheel-hub';
  rotor.add(hub);

  const internalThreadCurve = new RadialScrewHelix({
    maximumX: hubWidth * 0.56,
    minimumX: -hubWidth * 0.56,
    phase: internalThreadPhase,
    pitch: threadLead,
    radius: axleRadius + 0.018,
  });
  const internalThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      internalThreadCurve,
      48,
      0.008,
      6,
      false,
    ),
    material,
  );
  internalThread.userData.role =
    'visible-edge-of-single-start-female-hub-thread';
  internalThread.userData.curve = internalThreadCurve;
  rotor.add(internalThread);

  const faceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.025,
      radius * 0.57,
      Math.max(0.055, radius * 0.085),
    ),
    whiteMaterial,
  );
  faceIndex.position.set(
    hubWidth / 2 + 0.025,
    radius * 0.48,
    0,
  );
  faceIndex.userData.role = 'white-wheel-spin-index-on-near-face';
  rotor.add(faceIndex);

  const treadIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      hubWidth * 0.48,
      rimTube * 1.35,
      rimTube * 1.9,
    ),
    whiteMaterial,
  );
  treadIndex.position.y = radius - rimTube * 0.45;
  treadIndex.userData.role = 'white-wheel-spin-index-on-tread';
  rotor.add(treadIndex);

  assembly.userData.rotor = rotor;
  assembly.userData.spokes = spokes;
  assembly.userData.faceIndex = faceIndex;
  assembly.userData.hubBoreRadius = axleRadius + 0.035;
  assembly.userData.internalThread = internalThread;
  assembly.userData.internalThreadPhase = internalThreadPhase;
  assembly.userData.treadIndex = treadIndex;
  return assembly;
}

function screwHelicograph(movement) {
  const root = new THREE.Group();

  // Brown's plate fixes the topology but gives no dimensions or timing.  The
  // selected scale keeps the same long radial screw, thin rolling wheel, and
  // compact centre pivot proportions while leaving the generated spiral
  // unobstructed in an oblique three-dimensional view.
  const drawingPlaneY = 0.04;
  const paperTopY = 0;
  const paperThickness = 0.10;
  const paperSize = 10.6;
  const transferPaperSize = 10.1;
  const wheelRadius = 1.00;
  const wheelAxisY = drawingPlaneY + wheelRadius;
  const wheelWidth = 0.25;
  const screwCoreRadius = 0.085;
  const screwThreadRadius = 0.135;
  const threadTubeRadius = 0.024;
  const threadLead = 0.36;
  const screwMinimumX = 0.42;
  const screwMaximumX = 4.78;
  const screwLength = screwMaximumX - screwMinimumX;
  const outerRadius = 4.20;
  const orbitTurns = 1.5;
  const sweepAngle = orbitTurns * FULL_TURN;
  const logarithmicRate = threadLead / (FULL_TURN * wheelRadius);
  const innerRadius = outerRadius * Math.exp(
    -logarithmicRate * sweepAngle,
  );
  const radialTravel = outerRadius - innerRadius;
  const wheelTurnsInward = radialTravel / threadLead;
  const cycleDuration = 12;
  const pivotNeedleRadius = 0.075;
  const pivotSleeveRadius = 0.20;
  const armWidth = 0.42;
  const armThickness = 0.17;

  const paperMaterial = matte(PALETTE.paper, {
    metalness: 0,
    roughness: 0.98,
  });
  const transferMaterial = matte(0x9eb9bd, {
    metalness: 0,
    opacity: 0.12,
    roughness: 0.88,
    side: THREE.DoubleSide,
    transparent: true,
  });
  transferMaterial.depthWrite = false;
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.16,
    roughness: 0.61,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.30,
    roughness: 0.44,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.55,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0,
    roughness: 0.46,
  });

  const paperAssembly = new THREE.Group();
  paperAssembly.userData.role = 'stationary-drawing-and-transfer-paper';
  paperAssembly.userData.fixed = true;
  root.add(paperAssembly);

  const drawingPaper = new THREE.Mesh(
    new THREE.BoxGeometry(paperSize, paperThickness, paperSize),
    paperMaterial,
  );
  drawingPaper.position.y = paperTopY - paperThickness / 2;
  drawingPaper.userData.role = 'drawing-paper-receiving-transferred-line';
  paperAssembly.add(drawingPaper);

  const transferPaper = new THREE.Mesh(
    new THREE.PlaneGeometry(transferPaperSize, transferPaperSize),
    transferMaterial,
  );
  transferPaper.rotation.x = -Math.PI / 2;
  transferPaper.position.y = paperTopY + 0.008;
  transferPaper.userData.role = 'transfer-paper-colored-side-downward';
  paperAssembly.add(transferPaper);

  const spiralPath = new LogarithmicSpiralOnPaper({
    drawingPlaneY: drawingPlaneY - 0.006,
    logarithmicRate,
    outerRadius,
    sweepAngle,
  });
  const transferredTrace = new THREE.Mesh(
    new THREE.TubeGeometry(spiralPath, 560, 0.026, 8, false),
    darkMaterial,
  );
  transferredTrace.userData.role =
    'completed-logarithmic-spiral-transferred-to-drawing-paper';
  transferredTrace.userData.isOutcomeTrace = true;
  paperAssembly.add(transferredTrace);

  const centerMark = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.16, 40),
    darkMaterial,
  );
  centerMark.rotation.x = -Math.PI / 2;
  centerMark.position.y = drawingPlaneY - 0.004;
  centerMark.userData.role = 'fixed-centre-mark-on-paper';
  paperAssembly.add(centerMark);

  const orbitingArm = new THREE.Group();
  orbitingArm.userData.role = 'radial-screw-arm-revolving-about-fixed-centre';
  root.add(orbitingArm);

  const bridge = makeRoundedBar({
    length: 0.74,
    material: driverMaterial,
    thickness: armThickness,
    width: armWidth,
  });
  bridge.position.set(-armWidth / 2, wheelAxisY, 0);
  bridge.userData.role = 'pivot-to-screw-bearing-arm';
  orbitingArm.add(bridge);

  const screwCore = cylinderAlongX(
    screwCoreRadius,
    screwLength + 0.34,
    frameMaterial,
    28,
  );
  screwCore.position.set(
    (screwMinimumX + screwMaximumX) / 2,
    wheelAxisY,
    0,
  );
  screwCore.userData.role = 'fixed-radial-screw-core';
  orbitingArm.add(screwCore);

  const screwThreadCurve = new RadialScrewHelix({
    maximumX: screwMaximumX,
    minimumX: screwMinimumX,
    phase: 0,
    pitch: threadLead,
    radius: screwThreadRadius,
  });
  const screwThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      screwThreadCurve,
      Math.ceil(screwLength / threadLead) * 40,
      threadTubeRadius,
      8,
      false,
    ),
    darkMaterial,
  );
  screwThread.position.y = wheelAxisY;
  screwThread.userData.role = 'single-start-right-hand-external-thread';
  screwThread.userData.curve = screwThreadCurve;
  orbitingArm.add(screwThread);

  const shaftEnd = cylinderAlongX(0.15, 0.16, darkMaterial, 28);
  shaftEnd.position.set(screwMaximumX + 0.17, wheelAxisY, 0);
  shaftEnd.userData.role = 'screw-end-stop';
  orbitingArm.add(shaftEnd);

  const threadedWheel = makeThreadedRollingWheel({
    axleRadius: screwThreadRadius + threadTubeRadius,
    hubWidth: wheelWidth,
    internalThreadPhase: (
      outerRadius - screwMinimumX - wheelWidth * 0.56
    ) / threadLead * FULL_TURN,
    material: brassMaterial,
    radius: wheelRadius,
    rimMaterial: darkMaterial,
    threadLead,
    whiteMaterial,
  });
  threadedWheel.position.set(outerRadius, wheelAxisY, 0);
  orbitingArm.add(threadedWheel);
  const wheelRotor = threadedWheel.userData.rotor;

  const fixedPivot = new THREE.Group();
  fixedPivot.userData.role = 'fixed-central-point-and-holding-knob';
  fixedPivot.userData.fixed = true;
  root.add(fixedPivot);

  const needleHeight = 0.70;
  const needle = new THREE.Mesh(
    new THREE.ConeGeometry(
      pivotNeedleRadius * 1.7,
      needleHeight,
      32,
    ),
    darkMaterial,
  );
  needle.position.y = drawingPlaneY + needleHeight / 2;
  needle.userData.role = 'needle-point-fixed-in-paper-centre';
  fixedPivot.add(needle);

  const pivotSleeve = cylinderAlongY(
    pivotSleeveRadius,
    1.04,
    frameMaterial,
    36,
  );
  pivotSleeve.position.y = drawingPlaneY + needleHeight + 0.52;
  pivotSleeve.userData.role = 'central-pivot-sleeve';
  fixedPivot.add(pivotSleeve);

  const pivotKnob = cylinderAlongY(0.36, 0.13, driverMaterial, 48);
  pivotKnob.position.y = drawingPlaneY + needleHeight + 1.14;
  pivotKnob.userData.role = 'fixed-centre-holding-knob';
  fixedPivot.add(pivotKnob);

  const pivotKnobIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.018, 0.07),
    whiteMaterial,
  );
  pivotKnobIndex.position.set(
    0.10,
    drawingPlaneY + needleHeight + 1.214,
    0,
  );
  pivotKnobIndex.userData.role = 'stationary-reference-index';
  fixedPivot.add(pivotKnobIndex);

  const liveContact = cylinderAlongY(0.085, 0.022, driverMaterial, 32);
  liveContact.position.set(outerRadius, drawingPlaneY + 0.006, 0);
  liveContact.userData.role = 'instantaneous-wheel-paper-contact-marker';
  paperAssembly.add(liveContact);

  const stateAtTime = (time) => {
    const wrappedTime = positiveModulo(time, cycleDuration);
    const cyclePhase = wrappedTime / cycleDuration;
    const phaseAngle = FULL_TURN * cyclePhase;
    const excursion = 0.5 * (1 - Math.cos(phaseAngle));
    const excursionRate = Math.PI / cycleDuration
      * Math.sin(phaseAngle);
    const orbitAngle = sweepAngle * excursion;
    const orbitAngularSpeed = sweepAngle * excursionRate;
    const radius = outerRadius * Math.exp(
      -logarithmicRate * orbitAngle,
    );
    const radialSpeed = -logarithmicRate
      * radius * orbitAngularSpeed;
    const wheelAngle = (radius - outerRadius)
      * FULL_TURN / threadLead;
    const wheelAngularSpeed = radialSpeed
      * FULL_TURN / threadLead;
    const radialDirection = new THREE.Vector3(
      Math.cos(orbitAngle),
      0,
      -Math.sin(orbitAngle),
    );
    const tangentialDirection = new THREE.Vector3(
      -Math.sin(orbitAngle),
      0,
      -Math.cos(orbitAngle),
    );
    const contactPoint = radialDirection.clone().multiplyScalar(radius);
    contactPoint.y = drawingPlaneY;
    const wheelCenter = contactPoint.clone();
    wheelCenter.y += wheelRadius;
    const radialVelocity = radialDirection.clone()
      .multiplyScalar(radialSpeed);
    const orbitalVelocity = tangentialDirection.clone()
      .multiplyScalar(radius * orbitAngularSpeed);
    const wheelCenterVelocity = radialVelocity.clone()
      .add(orbitalVelocity);
    const spinVelocityAtContact = tangentialDirection.clone()
      .multiplyScalar(wheelRadius * wheelAngularSpeed);
    const wheelMaterialVelocityAtContact = wheelCenterVelocity.clone()
      .add(spinVelocityAtContact);
    const spiralTangent = radialDirection.clone()
      .multiplyScalar(-logarithmicRate)
      .add(tangentialDirection)
      .normalize();
    return {
      contactPoint,
      cyclePhase,
      excursion,
      inwardPass: cyclePhase < 0.5,
      orbitAngle,
      orbitAngularSpeed,
      orbitalVelocity,
      radialDirection,
      radialSpeed,
      radialVelocity,
      radius,
      spinVelocityAtContact,
      spiralTangent,
      tangentialDirection,
      wheelAngle,
      wheelAngularSpeed,
      wheelCenter,
      wheelCenterVelocity,
      wheelMaterialVelocityAtContact,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    orbitingArm.rotation.y = state.orbitAngle;
    threadedWheel.position.x = state.radius;
    wheelRotor.rotation.x = state.wheelAngle;
    liveContact.position.copy(state.contactPoint);
    liveContact.position.y += 0.008;
    orbitingArm.userData.angularSpeed = state.orbitAngularSpeed;
    threadedWheel.userData.radialSpeed = state.radialSpeed;
    wheelRotor.userData.angularSpeed = state.wheelAngularSpeed;
    root.userData.contacts = {
      fixedNeedleToPaper: {
        active: true,
        point: new THREE.Vector3(0, drawingPlaneY, 0),
        velocity: new THREE.Vector3(),
      },
      threadedHubToScrew: {
        active: true,
        axialPosition: state.radius,
        leadRelationResidual: (
          state.radius - outerRadius
          - threadLead / FULL_TURN * state.wheelAngle
        ),
      },
      wheelRimToTransferPaper: {
        active: true,
        axialScrubVelocity: state.radialVelocity,
        materialVelocity: state.wheelMaterialVelocityAtContact,
        point: state.contactPoint,
        rollingDirectionSlipVelocity: state.tangentialDirection.clone()
          .multiplyScalar(
            state.wheelMaterialVelocityAtContact.dot(
              state.tangentialDirection,
            ),
          ),
      },
    };
    root.userData.kinematics = state;
  };

  root.userData = {
    archetype:
      'fixed-center-threaded-rolling-wheel-logarithmic-helicograph',
    blocks: {
      bridge,
      centerMark,
      drawingPaper,
      fixedPivot,
      liveContact,
      needle,
      orbitingArm,
      paperAssembly,
      pivotKnob,
      pivotKnobIndex,
      pivotSleeve,
      screwCore,
      screwThread,
      shaftEnd,
      threadedWheel,
      transferredTrace,
      transferPaper,
      wheelFaceIndex: threadedWheel.userData.faceIndex,
      wheelInternalThread: threadedWheel.userData.internalThread,
      wheelRotor,
      wheelSpokes: threadedWheel.userData.spokes,
      wheelTreadIndex: threadedWheel.userData.treadIndex,
    },
    constraintResiduals: {
      innerRadiusDefinition: innerRadius
        - outerRadius * Math.exp(-logarithmicRate * sweepAngle),
      logarithmicRateFromThreadAndWheel: logarithmicRate
        - threadLead / (FULL_TURN * wheelRadius),
      spiralEndRadius: spiralPath.getPoint(1).length()
        - Math.hypot(innerRadius, drawingPlaneY - 0.006),
      wheelBottomToDrawingPlane: wheelAxisY - wheelRadius
        - drawingPlaneY,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      inputs: [
        'manual revolution of the radial screw arm about the fixed centre; direction reverses smoothly at each end of this demonstration',
      ],
      note:
        'the wheel spin and its radial advance are both constrained by rim rolling and the single-start screw lead, leaving one independent coordinate',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'the screw and internally threaded wheel hub are rigid and backlash-free',
        'the wheel has exact rolling contact in its circumferential direction',
        'axial rim scrub is retained because it is intrinsic to screw advance and makes the transfer-paper trace',
        'the completed trace is displayed throughout the cyclic demonstration instead of modeling irreversible pigment history',
        'dimensions, lead, sweep, speed law, materials, and colors are reconstruction choices because Brown specifies none',
      ],
      sourceSpecifiesDimensionsTimingLeadWheelRadiusOrSweep: false,
      treatment:
        'quasistatic ideal constraint model: a right-hand constant-lead screw plus circumferential rolling produces the exact logarithmic-spiral radius law',
    },
    fidelity: 'authored',
    geometry: {
      drawingPlaneY,
      innerRadius,
      logarithmicRate,
      orbitTurns,
      outerRadius,
      paperSize,
      radialTravel,
      screwCoreRadius,
      screwLength,
      screwMaximumX,
      screwMinimumX,
      screwThreadRadius,
      sweepAngle,
      threadLead,
      threadTubeRadius,
      transferPaperSize,
      wheelAxisY,
      wheelHubBoreRadius: threadedWheel.userData.hubBoreRadius,
      wheelInternalThreadPhase:
        threadedWheel.userData.internalThreadPhase,
      wheelRadius,
      wheelTurnsInward,
      wheelWidth,
    },
    mechanism:
      'one-fixed-centre-one-radial-right-hand-screw-one-internally-threaded-paper-contact-wheel-one-transfer-paper-logarithmic-spiral',
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate384: {
        fixedCentrePixels: new THREE.Vector2(66, 373),
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 9,
        radialScrewAxisPixels: {
          end: new THREE.Vector2(501, 273),
          start: new THREE.Vector2(92, 273),
        },
        rollingWheelPixels: {
          apparentCenter: new THREE.Vector2(390, 274),
          apparentRadius: 80,
        },
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'one small wheel revolves about one fixed central point',
          'the wheel moves either way along a screw-threaded axle',
          'the wheel describes a volute or spiral',
          'transfer-paper is laid colored side downward over the drawing paper',
        ],
        historicalCorroboration:
          'William Ford Stanley (1868), Mathematical Drawing Instruments, describes this screw helicograph as a screw forming the axis of a milled-edge wheel whose paper contact rotates it; the text says the arrangement produces spirals in geometrical proportion',
        kinematicInference:
          'combining constant screw lead dr=(lead/2pi)dphi with circumferential rolling R dphi=-r dtheta gives dr/dtheta=-(lead/2piR)r and therefore a logarithmic spiral',
        reconstructionDisclosure:
          'all metric dimensions, 0.36-unit lead, one-and-a-half-turn excursion, twelve-second smooth reciprocal schedule, full pre-rendered outcome trace, colors, and camera are independently engineered',
      },
      officialPage: movement.sourceUrl,
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
      secondaryHistoricalReference:
        'https://archive.org/details/descriptivetreat00stan/page/72/mode/2up',
    },
    spiralPath,
    stateAtTime,
    timeline: {
      cycleDuration,
      demonstrationPeriod: cycleDuration,
      events: {
        inwardEnd: cycleDuration / 2,
        outwardReturnEnd: cycleDuration,
        startOuter: 0,
      },
      note:
        'the first half makes one-and-a-half revolutions inward; the second half reverses along the same spiral, with zero velocity at both reversals and exact pose closure',
    },
    transmission: {
      axialAdvancePerWheelRadian: threadLead / FULL_TURN,
      logarithmicSpiralLaw:
        'r(theta)=outerRadius*exp[-threadLead*theta/(2pi*wheelRadius)]',
      rollingConstraint:
        'radius*orbitAngularSpeed + wheelRadius*wheelAngularSpeed = 0',
      screwConstraint:
        'radius-outerRadius = threadLead*wheelAngle/(2pi)',
      traceMechanism:
        'circumferential slip is zero while unavoidable axial wheel scrub equals radial carriage speed and transfers the spiral through colored-side-down paper',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.35, -0.12, -5.35),
    new THREE.Vector3(5.35, 2.18, 5.35),
  );
  root.userData.groundFloorY = -0.10;
  markShadows(root);
  for (const object of [centerMark, transferPaper, transferredTrace]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(5.5, 8.0, 10.5),
    root,
    update,
  };
}

export function createAuthoredHelicographMovement(movement) {
  if (movement.id !== 384) return null;
  return screwHelicograph(movement);
}
