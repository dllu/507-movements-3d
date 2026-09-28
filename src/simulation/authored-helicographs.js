import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { plate, poly, circle, polygonClipping } from './finite-plate-geometry.js';
import { helicographThreadGeometry, helicographPivotBridge, helicographTraceGeometry } from './helicograph-working-parts.js';

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
  const geometry = boredLatheGeometry([
    { axial: -width / 2, radial: outerRadius },
    { axial: width / 2, radial: outerRadius },
  ], innerRadius, 96).rotateZ(Math.PI / 2);
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

function makeThreadedRollingWheel({
  axleRadius,
  screwCoreRadius,
  screwMinimumX,
  initialRadius,
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

  // Pass 90: Brown's milled wheel is one solid disc: a knurled rim (fine V
  // ridges whose tips lie on the rolling radius), a thinner web with radial
  // face ribs, and a long cylindrical nut on the side away from the point.
  const rimWidth = 0.22, rimInner = radius * 0.80, knurls = 240, knurlDepth = 0.022;
  const alongX = geometry => geometry.rotateY(Math.PI / 2);
  const knurled = [];
  for (let i = 0; i < 2 * knurls; i += 1) {
    const angle = Math.PI * i / knurls, r = i % 2 ? radius - knurlDepth : radius;
    knurled.push([r * Math.cos(angle), r * Math.sin(angle)]);
  }
  const rim = new THREE.Mesh(alongX(plate(polygonClipping.difference(poly(knurled),
    poly(circle([0, 0], rimInner, 240))), -rimWidth / 2, rimWidth / 2)), material);
  rim.userData.role = 'paper-contacting-milled-wheel-rim';
  rotor.add(rim);

  const nutRadius = radius * 0.36;
  const face = new THREE.Mesh(alongX(plate(polygonClipping.difference(poly(circle([0, 0], rimInner + 0.02, 240)),
    poly(circle([0, 0], nutRadius - 0.02, 120))), -0.035, 0.035)), material);
  face.userData.role = 'milled-wheel-web';
  rotor.add(face);

  // Sixteen radial ribs standing proud of both web faces, rim to nut.
  const spokeCount = 16;
  const spokeInner = nutRadius - 0.01, spokeOuter = rimInner + 0.01;
  const spokeLength = spokeOuter - spokeInner;
  const spokeCenter = (spokeOuter + spokeInner) / 2;
  const spokes = [];
  for (let index = 0; index < spokeCount; index += 1) {
    const angle = index / spokeCount * FULL_TURN;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, spokeLength, 0.035),
      material,
    );
    spoke.position.set(
      0,
      spokeCenter * Math.cos(angle),
      spokeCenter * Math.sin(angle),
    );
    spoke.rotation.x = angle;
    spoke.userData.role = 'one-of-sixteen-wheel-face-ribs';
    rotor.add(spoke);
    spokes.push(spoke);
  }

  // Long nut: from just behind the web out along the screw (away from the
  // point), 0.36 of the wheel radius round and 0.55 of it long.
  const nutLength = radius * 0.55;
  const hub = new THREE.Mesh(
    boredLatheGeometry([
      { axial: -nutLength, radial: nutRadius },
      { axial: 0.07, radial: nutRadius },
    ], axleRadius + 0.004, 96).rotateZ(Math.PI / 2),
    material,
  );
  hub.userData.role = 'female-threaded-wheel-hub';
  rotor.add(hub);

  const internalThreadCurve = new RadialScrewHelix({
    maximumX: hubWidth * 0.56,
    minimumX: -hubWidth * 0.56,
    phase: internalThreadPhase + Math.PI,
    pitch: threadLead,
    radius: axleRadius + 0.018,
  });
  const internalThread = new THREE.Mesh(
    helicographThreadGeometry({ minimum: screwMinimumX, lead: threadLead,
      core: screwCoreRadius, crest: axleRadius, initialRadius, nutWidth: hubWidth }),
    material,
  );
  internalThread.userData.role =
    'visible-edge-of-single-start-female-hub-thread';
  internalThread.userData.curve = internalThreadCurve;
  rotor.add(internalThread);

  const faceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.025,
      radius * 0.50,
      Math.max(0.055, radius * 0.085),
    ),
    whiteMaterial,
  );
  faceIndex.position.set(
    0.08,
    radius * 0.53,
    0,
  );
  faceIndex.userData.role = 'white-wheel-spin-index-on-near-face';
  rotor.add(faceIndex);

  const treadIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      hubWidth * 0.48,
      0.1,
      0.14,
    ),
    whiteMaterial,
  );
  treadIndex.position.y = radius - 0.034;
  treadIndex.userData.role = 'white-wheel-spin-index-on-tread';
  rotor.add(treadIndex);

  assembly.userData.rim = rim;
  assembly.userData.hub = hub;
  assembly.userData.face = face;
  treadIndex.visible = false;
  assembly.userData.rotor = rotor;
  assembly.userData.spokes = spokes;
  assembly.userData.faceIndex = faceIndex;
  assembly.userData.hubBoreRadius = axleRadius + 0.004;
  assembly.userData.internalThread = internalThread;
  assembly.userData.internalThreadPhase = internalThreadPhase + Math.PI;
  assembly.userData.treadIndex = treadIndex;
  return assembly;
}

function screwHelicograph(movement) {
  const root = new THREE.Group();

  // Brown's plate fixes the topology but gives no dimensions or timing.  The
  // selected scale keeps the same long radial screw, thin rolling wheel, and
  // compact centre pivot proportions while leaving the generated spiral
  // unobstructed in an oblique three-dimensional view.
  const drawingPlaneY = 0.008;
  const paperTopY = 0;
  const paperThickness = 0.10;
  const paperSize = 10.6;
  const transferPaperSize = 10.1;
  const wheelRadius = 1.00;
  const wheelAxisY = drawingPlaneY + wheelRadius;
  const wheelWidth = 0.25;
  // A solid threaded rod: the core is 0.8 of the thread's major diameter.
  const screwCoreRadius = 0.128;
  const screwThreadRadius = 0.135;
  const threadTubeRadius = 0.024;
  const threadLead = 0.36;
  const screwMinimumX = 0.42;
  const screwMaximumX = 5.20;
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
  const armWidth = 0.50;
  const armThickness = 0.28; // pass 90: thicker than the 0.8-core screw it carries

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
    helicographTraceGeometry(spiralPath, 0.045),
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

  const bridge = new THREE.Group();
  const boredBridge = new THREE.Mesh(helicographPivotBridge({ length: .74,
    width: armWidth, depth: armThickness, bore: pivotSleeveRadius + .004 }), driverMaterial);
  boredBridge.userData.role = 'bored-orbiting-pivot-eye-and-screw-bridge';
  bridge.add(boredBridge);
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
    helicographThreadGeometry({ minimum: screwMinimumX, maximum: screwMaximumX,
      lead: threadLead, core: screwCoreRadius, crest: screwThreadRadius + threadTubeRadius }),
    // Thread and core are one rod: the same steel.
    frameMaterial,
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
    screwCoreRadius,
    screwMinimumX,
    initialRadius: outerRadius,
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
  needle.rotation.z = Math.PI;
  needle.position.y = drawingPlaneY + needleHeight / 2;
  needle.userData.role = 'needle-point-fixed-in-paper-centre';
  fixedPivot.add(needle);

  const pivotSleeve = cylinderAlongY(
    pivotSleeveRadius,
    1.08,
    frameMaterial,
    36,
  );
  pivotSleeve.position.y = drawingPlaneY + needleHeight + 0.54;
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
      boredBridge,
      wheelRim: threadedWheel.userData.rim,
      wheelHub: threadedWheel.userData.hub,
      wheelFace: threadedWheel.userData.face,
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

  liveContact.visible = false;
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
  root.userData.cameraFov = 8;
  root.userData.reconstructionNote = 'An ideal constant-lead screw and circumferential rolling give the logarithmic spiral. The wheel necessarily scrubs axially as it advances. The hand-driven return retraces the curve; friction, thread load, paper deformation and pigment transfer are not simulated.';
  root.userData.workingInterfaces = { maleThread: screwThread.geometry.userData.thread,
    femaleThread: threadedWheel.userData.internalThread.geometry.userData.thread,
    idealPaperContactY: drawingPlaneY, radialThreadClearance: .004, axialFlankClearance: .003 };
  root.traverse(object => { for (const material of [].concat(object.material ?? [])) material.fog = false; });
  update(0);
  // The whole revolution, so the screw and wheel stay in view as the arm
  // turns round the point (Brown draws one pose: point left, screw right).
  root.userData.sweptBounds = new THREE.Box3(
    new THREE.Vector3(-5.6, -0.12, -5.6),
    new THREE.Vector3(5.6, 2.18, 5.6),
  );
  // The view frames Brown's pose (point left, screw and wheel right) whole,
  // plus 2.8 of the sweep to the point's left, so the wheel leaves the frame
  // only near the far side of the turn. In the near-orthographic side view
  // the sweep's depth does not project; a shallow depth proxy keeps the box
  // corners from inflating the fit.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.8, -0.12, -1.05),
    new THREE.Vector3(5.6, 2.18, 1.05),
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
