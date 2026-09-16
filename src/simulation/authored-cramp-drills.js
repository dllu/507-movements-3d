import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import {boredCylinderGeometry,fitPistonGuide} from './piston-guide-parts.js';
import {boreBoxY,replaceYJournal,closeFeedThread} from './drill-feed-parts.js';

const FULL_TURN = Math.PI * 2;

class VerticalHelixCurve extends THREE.Curve {
  constructor({ maximumY, minimumY, phase = 0, radius, turns }) {
    super();
    this.maximumY = maximumY;
    this.minimumY = minimumY;
    this.phase = phase;
    this.radius = radius;
    this.turns = turns;
  }

  getPoint(progress, target = new THREE.Vector3()) {
    const angle = this.phase + FULL_TURN * this.turns * progress;
    return target.set(
      this.radius * Math.cos(angle),
      THREE.MathUtils.lerp(this.minimumY, this.maximumY, progress),
      this.radius * Math.sin(angle),
    );
  }
}

function cylinderAlongY(radius, length, material, segments = 32) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function tubeBetween(start, end, radius, material) {
  return new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.LineCurve3(start, end),
      1,
      radius,
      10,
      false,
    ),
    material,
  );
}

function opposingFeedScrewCrampDrill(movement) {
  const root = new THREE.Group();

  const commonAxisX = 0.76;
  const commonAxisZ = 0;
  const drillRotorOrigin = new THREE.Vector3(
    commonAxisX,
    2.18,
    commonAxisZ,
  );
  const drillTipLocalY = -1.24;
  const drillTipY = drillRotorOrigin.y + drillTipLocalY;
  const demonstrationPeriod = 4.0;
  const drillTurnsPerDemonstration = 4;
  const drillAngularSpeed = drillTurnsPerDemonstration
    * FULL_TURN / demonstrationPeriod;
  const drillStartAngle = THREE.MathUtils.degToRad(12);
  const feedTurnAmplitude = 1.25;
  const feedAngularFrequency = FULL_TURN / demonstrationPeriod;
  const threadLead = 0.28;
  const feedBaseY = -1.19;
  const feedRotorOrigin = new THREE.Vector3(
    commonAxisX,
    feedBaseY,
    commonAxisZ,
  );
  const workRestLocalY = 1.55;
  const workRestHalfHeight=.085;
  const maximumFeedTravel = threadLead * feedTurnAmplitude;
  const minimumClearance = drillTipY
    - (feedBaseY + workRestLocalY + workRestHalfHeight + maximumFeedTravel);
  const threadMinimumY = 0.31;
  const threadMaximumY = 1.46;
  const threadTurns = (threadMaximumY - threadMinimumY) / threadLead;
  const nutCenterY = -0.30;
  const handwheelRadius = 0.71;

  const stateAtTime = (time) => {
    const drillAngle = drillStartAngle + drillAngularSpeed * time;
    const feedPhase = feedAngularFrequency * time;
    const feedTurns = 0.5 * feedTurnAmplitude
      * (1 - Math.cos(feedPhase));
    const feedTurnsRate = 0.5 * feedTurnAmplitude
      * feedAngularFrequency * Math.sin(feedPhase);
    const feedTurnsAcceleration = 0.5 * feedTurnAmplitude
      * feedAngularFrequency ** 2 * Math.cos(feedPhase);
    const feedScrewAngle = -FULL_TURN * feedTurns;
    const feedScrewAngularSpeed = -FULL_TURN * feedTurnsRate;
    const feedScrewAngularAcceleration = -FULL_TURN
      * feedTurnsAcceleration;
    const axialTravel = threadLead * feedTurns;
    const axialSpeed = threadLead * feedTurnsRate;
    const axialAcceleration = threadLead * feedTurnsAcceleration;
    const feedRotorY = feedBaseY + axialTravel;
    const workRestY = feedRotorY + workRestLocalY;
    const workRestTopY=workRestY+workRestHalfHeight;
    const clearance = drillTipY - workRestTopY;
    return {
      axialAcceleration,
      axialSpeed,
      axialTravel,
      clearance,
      drillAngle,
      drillAngularSpeed,
      drillTipY,
      feedPhase,
      feedRotorY,
      feedScrewAngle,
      feedScrewAngularAcceleration,
      feedScrewAngularSpeed,
      feedTurns,
      feedTurnsAcceleration,
      feedTurnsRate,
      threadAdvanceResidual: axialTravel
        + threadLead * feedScrewAngle / FULL_TURN,
      workRestY, workRestTopY,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.57,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const drillMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const feedMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.53,
  });
  const threadMaterial = matte(PALETTE.accent, {
    metalness: 0.20,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const crampFrame = new THREE.Group();
  crampFrame.userData.fixed = true;
  crampFrame.userData.role =
    'fixed-c-shaped-portable-cramp-drill-frame';
  root.add(crampFrame);
  const frameBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 2.66, 0.52),
    frameMaterial,
  );
  frameBack.position.set(-1.48, 1.02, 0);
  frameBack.userData.role = 'fixed-c-frame-back';
  crampFrame.add(frameBack);
  const frameTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.40, 0.32, 0.52),
    frameMaterial,
  );
  frameTop.position.set(-0.44, 2.33, 0);
  frameTop.userData.role = 'fixed-c-frame-upper-arm';
  crampFrame.add(frameTop);
  const frameBottom = new THREE.Mesh(
    new THREE.BoxGeometry(2.40, 0.34, 0.62),
    frameMaterial,
  );
  frameBottom.position.set(-0.44, nutCenterY, 0);
  frameBottom.userData.role = 'fixed-c-frame-lower-arm';
  crampFrame.add(frameBottom);
  const drillHousing = cylinderAlongY(
    0.34,
    0.72,
    frameMaterial,
    36,
  );
  drillHousing.position.set(commonAxisX, 2.15, commonAxisZ);
  drillHousing.userData.role = 'fixed-upper-drill-spindle-bearing';
  crampFrame.add(drillHousing);
  const fixedFeedNut = cylinderAlongY(
    0.31,
    0.40,
    frameMaterial,
    36,
  );
  fixedFeedNut.position.set(commonAxisX, nutCenterY, commonAxisZ);
  fixedFeedNut.userData.fixedAgainstRotationAndTranslation = true;
  fixedFeedNut.userData.role =
    'fixed-lower-frame-nut-guiding-opposed-feed-screw';
  crampFrame.add(fixedFeedNut);

  const drillRotor = new THREE.Group();
  drillRotor.position.copy(drillRotorOrigin);
  drillRotor.userData.axis = new THREE.Vector3(0, 1, 0);
  drillRotor.userData.role =
    'upper-hand-crank-drill-spindle-rigid-rotor';
  root.add(drillRotor);
  const drillSpindle = cylinderAlongY(
    0.105,
    1.66,
    darkMaterial,
    28,
  );
  drillSpindle.position.y = -.27;
  drillSpindle.userData.role = 'fixed-height-rotating-drill-spindle';
  drillRotor.add(drillSpindle);
  const drillChuck = cylinderAlongY(
    0.22,
    0.34,
    drillMaterial,
    32,
  );
  drillChuck.position.y = -0.77;
  drillChuck.userData.role = 'drill-chuck-rigid-with-upper-spindle';
  drillRotor.add(drillChuck);
  const drillBit = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.54, 5),
    darkMaterial,
  );
  drillBit.position.y = drillTipLocalY+.54/2;
  drillBit.rotation.x=Math.PI;
  drillBit.rotation.y = Math.PI / 5;
  drillBit.userData.role = 'downward-pointing-drill-bit';
  drillRotor.add(drillBit);
  const drillCrankArm = new THREE.Mesh(
    new THREE.BoxGeometry(1.76, 0.11, 0.14),
    drillMaterial,
  );
  drillCrankArm.position.set(-0.78, 0.56, 0);
  drillCrankArm.userData.role =
    'radial-upper-hand-crank-rigid-with-drill-spindle';
  drillRotor.add(drillCrankArm);
  const drillCrankHub = cylinderAlongY(
    0.18,
    0.25,
    darkMaterial,
    28,
  );
  drillCrankHub.position.y = 0.52;
  drillCrankHub.userData.role = 'upper-crank-axis-hub';
  drillRotor.add(drillCrankHub);
  const drillCrankKnob = cylinderAlongY(
    0.17,
    0.54,
    drillMaterial,
    24,
  );
  drillCrankKnob.position.set(-1.60, 0.79, 0);
  drillCrankKnob.userData.role = 'free-turning-upper-crank-hand-knob';
  drillRotor.add(drillCrankKnob);
  const drillIndex = new THREE.Mesh(
    new THREE.BoxGeometry(.08,.12,.012),
    whiteMaterial,
  );
  drillIndex.position.set(0,-.77,.222);
  drillIndex.userData.role = 'white-drill-spindle-rotation-index';
  drillRotor.add(drillIndex);

  const feedScrewRotor = new THREE.Group();
  feedScrewRotor.position.copy(feedRotorOrigin);
  feedScrewRotor.userData.axis = new THREE.Vector3(0, 1, 0);
  feedScrewRotor.userData.role =
    'lower-feed-screw-rest-and-handwheel-rigid-rotor';
  root.add(feedScrewRotor);
  const feedScrewCore = cylinderAlongY(
    0.13,
    1.52,
    feedMaterial,
    28,
  );
  feedScrewCore.position.y = 0.85;
  feedScrewCore.userData.role = 'opposed-vertical-feed-screw-core';
  feedScrewRotor.add(feedScrewCore);
  const feedThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      new VerticalHelixCurve({
        maximumY: threadMaximumY,
        minimumY: threadMinimumY,
        radius: 0.155,
        turns: threadTurns,
      }),
      150,
      0.030,
      8,
      false,
    ),
    threadMaterial,
  );
  feedThread.userData.handedness = 'right-hand-about-positive-Y';
  feedThread.userData.lead = threadLead;
  feedThread.userData.role = 'visible-helical-feed-screw-thread';
  feedScrewRotor.add(feedThread);
  const workRest = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.17, 0.70),
    feedMaterial,
  );
  workRest.position.y = workRestLocalY;
  workRest.userData.role =
    'flat-work-rest-opposite-and-coaxial-with-drill';
  feedScrewRotor.add(workRest);
  const handwheelHub = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 28, 18),
    feedMaterial,
  );
  handwheelHub.position.y = -0.04;
  handwheelHub.userData.role = 'lower-feed-handwheel-center';
  feedScrewRotor.add(handwheelHub);
  const handwheelArms = [];
  const handwheelKnobs = [];
  for (let index = 0; index < 3; index += 1) {
    const angle = index * FULL_TURN / 3;
    const radial = new THREE.Vector3(
      Math.cos(angle) * handwheelRadius,
      -0.04,
      Math.sin(angle) * handwheelRadius,
    );
    const arm = tubeBetween(
      new THREE.Vector3(0, -0.04, 0),
      radial,
      0.075,
      feedMaterial,
    );
    arm.userData.index = index;
    arm.userData.role = 'one-of-three-feed-handwheel-arms';
    handwheelArms.push(arm);
    feedScrewRotor.add(arm);
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 22, 14),
      darkMaterial,
    );
    knob.position.copy(radial);
    knob.userData.index = index;
    knob.userData.role = 'one-of-three-feed-handwheel-knobs';
    handwheelKnobs.push(knob);
    feedScrewRotor.add(knob);
  }
  const feedIndex = new THREE.Mesh(
    new THREE.BoxGeometry(.24,.055,.055),
    whiteMaterial,
  );
  feedIndex.position.set(.35,.045,0);
  feedIndex.userData.role = 'white-feed-screw-rotation-index';
  feedScrewRotor.add(feedIndex);

  replaceYJournal(drillHousing,.34,.109,.72);
  replaceYJournal(fixedFeedNut,.31,.189,.40);
  boreBoxY(frameTop,.115,commonAxisX-frameTop.position.x);
  boreBoxY(frameBottom,.195,commonAxisX-frameBottom.position.x);
  const nutThread=closeFeedThread(feedThread,fixedFeedNut,{inner:.13,outer:.185,
    low:threadMinimumY,high:threadMaximumY,lead:threadLead,feedBaseY,nutY:nutCenterY,nutLength:.40});

  const update = (time) => {
    const state = stateAtTime(time);
    drillRotor.rotation.y = state.drillAngle;
    feedScrewRotor.position.y = state.feedRotorY;
    feedScrewRotor.rotation.y = state.feedScrewAngle;
    root.userData.currentState = state;
    root.userData.constraintResiduals = {
      axisX: drillRotor.position.x - feedScrewRotor.position.x,
      axisZ: drillRotor.position.z - feedScrewRotor.position.z,
      threadAdvance: state.threadAdvanceResidual,
      workRestHeight:
        feedScrewRotor.position.y + workRestLocalY - state.workRestY,
    };
  };

  root.userData = {
    archetype: movement.archetype,
    blocks: {
      crampFrame,
      drillBit,
      drillChuck,
      drillCrankArm,
      drillCrankHub,
      drillCrankKnob,
      drillHousing,
      drillIndex,
      drillRotor,
      drillSpindle,
      feedIndex,
      feedScrewCore,
      feedScrewRotor,
      feedThread,
      fixedFeedNut, nutThread,
      frameBack,
      frameBottom,
      frameTop,
      handwheelArms,
      handwheelHub,
      handwheelKnobs,
      workRest,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 2,
      inputs: [
        'continuous upper hand crank and drill-spindle rotation',
        'reversing lower handwheel and feed-screw rotation',
      ],
      note:
        'the drill spindle is axially fixed; the separate lower handwheel, feed screw, and work rest rotate and translate together through one fixed frame nut',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid C-shaped cramp frame and fixed drill and feed bearings',
        'constant-speed hand-driven drill rotation',
        'rigid right-hand feed screw with exact lead and no backlash',
        'smooth forward-and-reverse feed schedule for a closed demonstration',
        'no workpiece or drilling-force model because neither is specified in the plate',
      ],
      sourceSpecifiesDimensionsTimingLeadOrSpeed: false,
      treatment:
        'Brown distinguishes the first portable cramp drill by placing its feed screw opposite the drill; the model preserves that coaxial opposed layout and applies an analytic screw-lead constraint while dimensions, lead, speed, and feed schedule are engineered',
    },
    fidelity: 'authored',
    geometry: {
      commonAxisX,
      commonAxisZ,
      demonstrationPeriod,
      drillRotorOrigin,
      drillStartAngle,
      drillTipLocalY,
      drillTipY,
      drillTurnsPerDemonstration,
      feedAngularFrequency,
      feedBaseY,
      feedRotorOrigin,
      feedTurnAmplitude,
      handwheelRadius,
      maximumFeedTravel,
      minimumClearance,
      nutCenterY,
      threadLead,
      threadMaximumY,
      threadMinimumY,
      threadTurns,
      workRestLocalY, workRestHalfHeight,
    },
    mechanism:
      'one-fixed-c-cramp-carries-one-axially-fixed-upper-hand-crank-drill-and-one-separate-coaxial-opposed-lower-feed-screw-whose-handwheel-raises-the-work-rest-through-a-fixed-nut',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate379: {
        cFrameBottomLeft: new THREE.Vector2(158, 410),
        cFrameBottomRight: new THREE.Vector2(390, 412),
        cFrameTopLeft: new THREE.Vector2(159, 140),
        drillAxisX: 338,
        drillBitTip: new THREE.Vector2(338, 279),
        feedHandwheelCenter: new THREE.Vector2(337, 480),
        feedRestCenter: new THREE.Vector2(338, 324),
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 7,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the tool is a portable cramp drill',
          'movement 379 places the feed screw opposite the drill',
        ],
        engravingEvidence:
          'the plate shows one C-shaped frame, an upper drill spindle and crank, a lower coaxial threaded feed screw with flat work rest, and a three-knob handwheel below the fixed lower frame arm',
        reconstructionDisclosure:
          'frame depth, colors, four drill turns, 0.28-unit screw lead, 1.25-turn reversible feed excursion, and four-second cycle are engineered because Brown supplies no dimensions or timing and the official page has no canvas animation',
      },
      officialPage: 'https://507movements.com/mm_379.html',
      pairedMovement: 380,
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod,
      note:
        'the drill makes four continuous turns while the independent feed screw advances 1.25 turns and reverses to its exact starting pose',
    },
    transmission: {
      drillAngularSpeed,
      feedLeadLaw:
        'axial travel = -(thread lead / 2π) times the rendered feed-screw angle; the negative sign follows Three.js positive-Y rotation convention for the modeled right-hand helix',
      maximumFeedTravel,
      minimumClearance,
      opposedAxisLaw:
        'the upper drill tip and lower feed screw/work rest share exactly one vertical axis but remain separate independently operated rotors',
      threadLead,
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.58, -1.96, -1.18),
    new THREE.Vector3(2.42, 3.46, 1.18),
  );
  root.userData.groundFloorY = -1.90;
  root.userData.cameraDirection=new THREE.Vector3(1.1,.6,14);
  fitPistonGuide(root,update,demonstrationPeriod);
  markShadows(root);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

function throughFeedScrewCrampDrill(movement) {
  const root = new THREE.Group();

  const commonAxisX = 0.72;
  const commonAxisZ = 0;
  const feedBaseY = 1.33;
  const demonstrationPeriod = 4.0;
  const drillTurnsPerDemonstration = 4;
  const drillAngularSpeed = drillTurnsPerDemonstration
    * FULL_TURN / demonstrationPeriod;
  const drillStartAngle = THREE.MathUtils.degToRad(10);
  const feedTurnAmplitude = 1.25;
  const feedAngularFrequency = FULL_TURN / demonstrationPeriod;
  const threadLead = 0.22;
  const maximumDownFeed = threadLead * feedTurnAmplitude;
  const outerSleeveRadius = 0.255;
  const innerBoreRadius = 0.155;
  const drillSpindleRadius = 0.090;
  const radialBoreClearance = innerBoreRadius - drillSpindleRadius;
  const sleeveMinimumY = -0.72;
  const sleeveMaximumY = 0.72;
  const sleeveLength = sleeveMaximumY - sleeveMinimumY;
  const threadTurns = sleeveLength / threadLead;
  const drillTipLocalY = -1.73;
  const fixedWorkRestTopY = -0.81;
  const minimumClearance = feedBaseY - maximumDownFeed
    + drillTipLocalY - fixedWorkRestTopY;

  const stateAtTime = (time) => {
    const drillAngle = drillStartAngle + drillAngularSpeed * time;
    const feedPhase = feedAngularFrequency * time;
    const feedTurns = 0.5 * feedTurnAmplitude
      * (1 - Math.cos(feedPhase));
    const feedTurnsRate = 0.5 * feedTurnAmplitude
      * feedAngularFrequency * Math.sin(feedPhase);
    const feedTurnsAcceleration = 0.5 * feedTurnAmplitude
      * feedAngularFrequency ** 2 * Math.cos(feedPhase);
    const feedScrewAngle = FULL_TURN * feedTurns;
    const feedScrewAngularSpeed = FULL_TURN * feedTurnsRate;
    const feedScrewAngularAcceleration = FULL_TURN
      * feedTurnsAcceleration;
    const axialTravel = -threadLead * feedTurns;
    const axialSpeed = -threadLead * feedTurnsRate;
    const axialAcceleration = -threadLead * feedTurnsAcceleration;
    const sharedRotorY = feedBaseY + axialTravel;
    const drillTipY = sharedRotorY + drillTipLocalY;
    const clearance = drillTipY - fixedWorkRestTopY;
    const relativeDrillAngle = drillAngle - feedScrewAngle;
    const relativeDrillAngularSpeed = drillAngularSpeed
      - feedScrewAngularSpeed;
    return {
      axialAcceleration,
      axialSpeed,
      axialTravel,
      clearance,
      drillAngle,
      drillAngularSpeed,
      drillTipY,
      feedPhase,
      feedScrewAngle,
      feedScrewAngularAcceleration,
      feedScrewAngularSpeed,
      feedTurns,
      feedTurnsAcceleration,
      feedTurnsRate,
      relativeDrillAngle,
      relativeDrillAngularSpeed,
      sharedRotorY,
      threadAdvanceResidual: axialTravel
        + threadLead * feedScrewAngle / FULL_TURN,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.57,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const drillMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const feedMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.53,
    side: THREE.DoubleSide,
  });
  const threadMaterial = matte(PALETTE.accent, {
    metalness: 0.20,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const crampFrame = new THREE.Group();
  crampFrame.userData.fixed = true;
  crampFrame.userData.role =
    'fixed-c-shaped-through-feed-screw-cramp-frame';
  root.add(crampFrame);
  const frameBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 2.78, 0.54),
    frameMaterial,
  );
  frameBack.position.set(-1.39, 0.05, 0);
  frameBack.userData.role = 'fixed-c-frame-back';
  crampFrame.add(frameBack);
  const frameTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.26, 0.34, 0.54),
    frameMaterial,
  );
  frameTop.position.set(-0.34, 1.34, 0);
  frameTop.userData.role = 'fixed-c-frame-threaded-upper-arm';
  crampFrame.add(frameTop);
  const frameBottom = new THREE.Mesh(
    new THREE.BoxGeometry(2.36, 0.34, 0.64),
    frameMaterial,
  );
  frameBottom.position.set(-0.29, -1.16, 0);
  frameBottom.userData.role = 'fixed-c-frame-lower-anvil-arm';
  crampFrame.add(frameBottom);
  const fixedFeedNut = cylinderAlongY(
    0.39,
    0.70,
    frameMaterial,
    40,
  );
  fixedFeedNut.position.set(commonAxisX, 1.33, commonAxisZ);
  fixedFeedNut.userData.fixedAgainstRotationAndTranslation = true;
  fixedFeedNut.userData.role =
    'fixed-upper-frame-nut-around-hollow-feed-screw';
  crampFrame.add(fixedFeedNut);
  const fixedWorkRest = new THREE.Mesh(
    new THREE.BoxGeometry(0.88, 0.19, 0.76),
    frameMaterial,
  );
  fixedWorkRest.position.set(
    commonAxisX,
    fixedWorkRestTopY - 0.095,
    commonAxisZ,
  );
  fixedWorkRest.userData.role =
    'fixed-lower-work-rest-beneath-through-feed-drill';
  crampFrame.add(fixedWorkRest);

  const feedSleeveRotor = new THREE.Group();
  feedSleeveRotor.position.set(commonAxisX, feedBaseY, commonAxisZ);
  feedSleeveRotor.userData.axis = new THREE.Vector3(0, 1, 0);
  feedSleeveRotor.userData.innerBoreRadius = innerBoreRadius;
  feedSleeveRotor.userData.role =
    'rotating-translating-hollow-feed-screw-and-cross-handle';
  root.add(feedSleeveRotor);
  const hollowSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(
      outerSleeveRadius,
      outerSleeveRadius,
      sleeveLength,
      40,
      1,
      true,
    ),
    feedMaterial,
  );
  hollowSleeve.userData.innerBoreRadius = innerBoreRadius;
  hollowSleeve.userData.role =
    'open-ended-hollow-feed-screw-sleeve';
  feedSleeveRotor.add(hollowSleeve);
  const sleeveEndRings = [];
  for (const y of [sleeveMinimumY, sleeveMaximumY]) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(
        innerBoreRadius,
        outerSleeveRadius,
        40,
      ),
      feedMaterial,
    );
    ring.position.y = y;
    ring.rotation.x = -Math.PI / 2;
    ring.userData.role = 'annular-end-face-showing-feed-screw-bore';
    sleeveEndRings.push(ring);
    feedSleeveRotor.add(ring);
  }
  const feedThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      new VerticalHelixCurve({
        maximumY: sleeveMaximumY,
        minimumY: sleeveMinimumY,
        radius: outerSleeveRadius + 0.035,
        turns: threadTurns,
      }),
      180,
      0.031,
      8,
      false,
    ),
    threadMaterial,
  );
  feedThread.userData.handedness = 'right-hand-about-positive-Y';
  feedThread.userData.lead = threadLead;
  feedThread.userData.role = 'external-thread-on-hollow-feed-screw';
  feedSleeveRotor.add(feedThread);
  const feedHandleHub = cylinderAlongY(
    0.34,
    0.22,
    feedMaterial,
    32,
  );
  feedHandleHub.position.y = 0.91;
  feedHandleHub.userData.role = 'hollow-feed-screw-cross-handle-hub';
  feedSleeveRotor.add(feedHandleHub);
  const feedHandleBar = new THREE.Mesh(
    new THREE.BoxGeometry(2.08, 0.095, 0.11),
    feedMaterial,
  );
  feedHandleBar.position.y = 0.91;
  feedHandleBar.userData.role =
    'two-ended-cross-handle-rigid-with-hollow-feed-screw';
  feedSleeveRotor.add(feedHandleBar);
  const feedHandleKnobs = [];
  for (const x of [-1.08, 1.08]) {
    const knob = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.14, 0.34, 7, 16),
      feedMaterial,
    );
    knob.position.set(x, 0.91, 0);
    knob.rotation.z = Math.PI / 2;
    knob.userData.role = 'one-of-two-hollow-feed-cross-handle-grips';
    feedHandleKnobs.push(knob);
    feedSleeveRotor.add(knob);
  }
  const thrustCollar = cylinderAlongY(
    0.32,
    0.28,
    feedMaterial,
    34,
  );
  thrustCollar.position.y = -0.88;
  thrustCollar.userData.role =
    'feed-sleeve-thrust-collar-capturing-inner-drill-axially';
  feedSleeveRotor.add(thrustCollar);
  const feedIndex = new THREE.Mesh(
    new THREE.BoxGeometry(.35,.012,.115),
    whiteMaterial,
  );
  feedIndex.position.set(.45,.96,0);
  feedIndex.userData.role = 'white-hollow-feed-screw-rotation-index';
  feedSleeveRotor.add(feedIndex);

  const drillRotor = new THREE.Group();
  drillRotor.position.set(commonAxisX, feedBaseY, commonAxisZ);
  drillRotor.userData.axis = new THREE.Vector3(0, 1, 0);
  drillRotor.userData.role =
    'inner-drill-spindle-passing-coaxially-through-feed-screw-bore';
  root.add(drillRotor);
  const drillSpindle = cylinderAlongY(
    drillSpindleRadius,
    2.78,
    darkMaterial,
    28,
  );
  drillSpindle.position.y = -0.02;
  drillSpindle.userData.role =
    'continuous-inner-spindle-through-hollow-feed-screw';
  drillRotor.add(drillSpindle);
  const drillChuck = cylinderAlongY(
    0.22,
    0.35,
    drillMaterial,
    32,
  );
  drillChuck.position.y = -1.26;
  drillChuck.userData.role =
    'lower-drill-chuck-rigid-with-through-spindle';
  drillRotor.add(drillChuck);
  const drillBit = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.58, 5),
    darkMaterial,
  );
  drillBit.position.y = drillTipLocalY+.58/2;
  drillBit.rotation.x=Math.PI;
  drillBit.rotation.y = Math.PI / 5;
  drillBit.userData.role = 'downward-bit-on-through-spindle';
  drillRotor.add(drillBit);
  const drillCrankHub = cylinderAlongY(
    0.18,
    0.26,
    darkMaterial,
    28,
  );
  drillCrankHub.position.y = 1.43;
  drillCrankHub.userData.role = 'upper-through-spindle-crank-hub';
  drillRotor.add(drillCrankHub);
  const drillCrankArm = new THREE.Mesh(
    new THREE.BoxGeometry(1.84, 0.11, 0.14),
    drillMaterial,
  );
  drillCrankArm.position.set(-0.82, 1.50, 0);
  drillCrankArm.userData.role =
    'upper-hand-crank-rigid-with-inner-drill-spindle';
  drillRotor.add(drillCrankArm);
  const drillCrankKnob = cylinderAlongY(
    0.17,
    0.55,
    drillMaterial,
    24,
  );
  drillCrankKnob.position.set(-1.68, 1.73, 0);
  drillCrankKnob.userData.role = 'upper-drill-crank-hand-knob';
  drillRotor.add(drillCrankKnob);
  const drillIndex = new THREE.Mesh(
    new THREE.BoxGeometry(.08,.12,.012),
    whiteMaterial,
  );
  drillIndex.position.set(0,-1.26,.222);
  drillIndex.userData.role = 'white-inner-drill-spindle-rotation-index';
  drillRotor.add(drillIndex);

  replaceYJournal(hollowSleeve,outerSleeveRadius,innerBoreRadius,sleeveLength);
  // End rings remain inspection faces; the sleeve itself now includes its inner wall.
  replaceYJournal(fixedFeedNut,.39,.325,.70);
  replaceYJournal(feedHandleHub,.34,innerBoreRadius,.22);
  replaceYJournal(thrustCollar,.32,.095,.28);
  boreBoxY(feedHandleBar,innerBoreRadius);
  boreBoxY(frameTop,.331,commonAxisX-frameTop.position.x);
  const nutThread=closeFeedThread(feedThread,fixedFeedNut,{inner:outerSleeveRadius,outer:.321,
    low:sleeveMinimumY,high:sleeveMaximumY,lead:threadLead,feedBaseY,nutY:1.33,nutLength:.70});
  // A hollow neck connects the cross handle to the sleeve; opposed rotating
  // thrust rings capture the independently spinning inner drill shaft.
  const sleeveNeck=new THREE.Mesh(boredCylinderGeometry(.255,innerBoreRadius,.16),feedMaterial);
  sleeveNeck.position.y=.76;feedSleeveRotor.add(sleeveNeck);
  const lowerSleeveNeck=new THREE.Mesh(boredCylinderGeometry(.23,innerBoreRadius,.08),feedMaterial);
  lowerSleeveNeck.position.y=-.73;feedSleeveRotor.add(lowerSleeveNeck);
  const thrustRings=[-.88-.18,-.88+.18].map(y=>{
    const ring=cylinderAlongY(.14,.06,drillMaterial);ring.position.y=y;drillRotor.add(ring);return ring;
  });

  const update = (time) => {
    const state = stateAtTime(time);
    feedSleeveRotor.position.y = state.sharedRotorY;
    feedSleeveRotor.rotation.y = state.feedScrewAngle;
    drillRotor.position.y = state.sharedRotorY;
    drillRotor.rotation.y = state.drillAngle;
    root.userData.currentState = state;
    root.userData.constraintResiduals = {
      axialCapture: drillRotor.position.y
        - feedSleeveRotor.position.y,
      axisX: drillRotor.position.x - feedSleeveRotor.position.x,
      axisZ: drillRotor.position.z - feedSleeveRotor.position.z,
      threadAdvance: state.threadAdvanceResidual,
    };
  };

  root.userData = {
    archetype: movement.archetype,
    blocks: {
      crampFrame,
      drillBit,
      drillChuck,
      drillCrankArm,
      drillCrankHub,
      drillCrankKnob,
      drillIndex,
      drillRotor,
      drillSpindle,
      feedHandleBar,
      feedHandleHub,
      feedHandleKnobs,
      feedIndex,
      feedSleeveRotor,
      feedThread,
      fixedFeedNut, nutThread,
      fixedWorkRest,
      frameBack,
      frameBottom,
      frameTop,
      hollowSleeve, sleeveNeck, lowerSleeveNeck, thrustRings,
      sleeveEndRings,
      thrustCollar,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 2,
      inputs: [
        'continuous upper crank rotation of the inner drill spindle',
        'reversing cross-handle rotation of the outer hollow feed screw',
      ],
      note:
        'the inner drill spindle rotates independently inside the outer screw bore but is axially captured by its thrust collar, so both members share feed translation while retaining distinct angles',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid C-shaped cramp frame and fixed lower work rest',
        'constant-speed hand-driven inner drill spindle',
        'rigid hollow right-hand feed screw with exact lead and no backlash',
        'frictionless coaxial journal and thrust capture between spindle and feed sleeve',
        'smooth down-and-up feed schedule for a closed demonstration',
      ],
      sourceSpecifiesDimensionsTimingLeadClearanceOrSpeed: false,
      treatment:
        'Brown distinguishes movement 380 by passing the drill spindle through the center of its feed screw; the model represents a genuinely hollow threaded sleeve, an independently rotating inner spindle, common axial feed through a thrust collar, and an analytic lead constraint',
    },
    fidelity: 'authored',
    geometry: {
      commonAxisX,
      commonAxisZ,
      demonstrationPeriod,
      drillSpindleRadius,
      drillStartAngle,
      drillTipLocalY,
      drillTurnsPerDemonstration,
      feedAngularFrequency,
      feedBaseY,
      feedTurnAmplitude,
      fixedWorkRestTopY,
      innerBoreRadius,
      maximumDownFeed,
      minimumClearance,
      outerSleeveRadius,
      radialBoreClearance,
      sleeveLength,
      sleeveMaximumY,
      sleeveMinimumY,
      threadLead,
      threadTurns,
    },
    mechanism:
      'one-upper-crank-turns-one-inner-drill-spindle-through-the-center-bore-of-one-separately-cross-handle-turned-hollow-feed-screw-whose-fixed-nut-and-thrust-collar-feed-the-spindle-toward-one-fixed-lower-rest',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate380: {
        cFrameBottomLeft: new THREE.Vector2(153, 478),
        cFrameBottomRestCenter: new THREE.Vector2(354, 432),
        cFrameTopLeft: new THREE.Vector2(153, 170),
        drillBitTip: new THREE.Vector2(354, 359),
        drillCrankHandleCenter: new THREE.Vector2(171, 66),
        feedCrossHandleY: 127,
        feedThreadAxisX: 354,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 7,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the tool is a portable cramp drill',
          'movement 380 passes the drill spindle through the center of the feed screw',
        ],
        engravingEvidence:
          'the plate shows one C-shaped frame with fixed lower rest, an externally threaded upper feed member with a two-ended cross handle, a narrower continuous drill spindle through its center, an upper drill crank, and a lower chuck and bit',
        reconstructionDisclosure:
          'frame depth, bore and spindle radii, thrust-collar interpretation, colors, four drill turns, 0.22-unit screw lead, 1.25-turn reversible feed excursion, and four-second cycle are engineered because Brown supplies no dimensions or timing and the official page has no canvas animation',
      },
      officialPage: 'https://507movements.com/mm_380.html',
      pairedMovement: 379,
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod,
      note:
        'the inner drill makes four continuous turns while the hollow outer feed screw advances 1.25 turns, carries both axial members downward, and reverses smoothly to the start',
    },
    transmission: {
      axialCaptureLaw:
        'the thrust collar makes inner spindle and outer hollow feed screw share exactly one axial translation while allowing their relative rotation',
      boreClearanceLaw:
        'inner drill radius remains smaller than the hollow feed-screw bore radius by one fixed radial clearance',
      drillAngularSpeed,
      feedLeadLaw:
        'axial travel = -(thread lead / 2π) times outer feed-screw angle for the modeled positive-Y right-hand helix',
      maximumDownFeed,
      minimumClearance,
      relativeRotationLaw:
        'inner-spindle angle relative to the hollow feed screw equals drill angle minus feed-screw angle',
      threadLead,
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.54, -1.55, -1.22),
    new THREE.Vector3(2.50, 3.52, 1.22),
  );
  root.userData.groundFloorY = -1.50;
  root.userData.cameraDirection=new THREE.Vector3(1.1,.6,14);
  fitPistonGuide(root,update,demonstrationPeriod);
  markShadows(root);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredCrampDrillMovement(movement) {
  if (movement.id === 379) return opposingFeedScrewCrampDrill(movement);
  if (movement.id === 380) return throughFeedScrewCrampDrill(movement);
  return null;
}
