import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import {boredCylinderGeometry,fitPistonGuide} from './piston-guide-parts.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate,sector} from './finite-plate-geometry.js';
import {helicalThread,threadAngles} from './mujoco-screw/thread-geometry.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongX(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function adjustableMirrorStand(movement) {
  const root = new THREE.Group();

  const demonstrationPeriod = 6.0;
  const adjustmentAngularFrequency = FULL_TURN / demonstrationPeriod;
  const stemExtensionMean = 0.42;
  const stemExtensionAmplitude = 0.25;
  const stemBottomLocalY = -0.50;
  const stemTopLocalY = 1.47;
  const socketBottomY = -0.75;
  const socketTopY = 0.75;
  const yawAmplitude = THREE.MathUtils.degToRad(32);
  const tiltAmplitude = THREE.MathUtils.degToRad(22);
  const yawPhaseOffset = Math.PI / 2;
  const tiltFrequencyRatio = 2;
  const tiltPhaseOffset = -Math.PI / 4;
  const mirrorCenterLocal = new THREE.Vector3(0, 0.28, -0.82);
  const mirrorOuterWidth = 2.48;
  const mirrorOuterHeight = 2.86;
  const mirrorGlassWidth = 2.28;
  const mirrorGlassHeight = 2.66;
  const socketRadialClearance = 0.055;
  const stemRadius = 0.145;
  const socketBoreRadius = stemRadius + socketRadialClearance;

  const stateAtTime = (time) => {
    const adjustmentPhase = adjustmentAngularFrequency * time;
    const stemExtension = stemExtensionMean
      + stemExtensionAmplitude * Math.sin(adjustmentPhase);
    const stemVerticalSpeed = stemExtensionAmplitude
      * adjustmentAngularFrequency * Math.cos(adjustmentPhase);
    const stemVerticalAcceleration = -stemExtensionAmplitude
      * adjustmentAngularFrequency ** 2 * Math.sin(adjustmentPhase);
    const yawPhase = adjustmentPhase + yawPhaseOffset;
    const yawAngle = yawAmplitude * Math.sin(yawPhase);
    const yawAngularSpeed = yawAmplitude
      * adjustmentAngularFrequency * Math.cos(yawPhase);
    const yawAngularAcceleration = -yawAmplitude
      * adjustmentAngularFrequency ** 2 * Math.sin(yawPhase);
    const tiltPhase = tiltFrequencyRatio * adjustmentPhase
      + tiltPhaseOffset;
    const tiltAngle = tiltAmplitude * Math.sin(tiltPhase);
    const tiltAngularSpeed = tiltAmplitude * tiltFrequencyRatio
      * adjustmentAngularFrequency * Math.cos(tiltPhase);
    const tiltAngularAcceleration = -tiltAmplitude
      * (tiltFrequencyRatio * adjustmentAngularFrequency) ** 2
      * Math.sin(tiltPhase);
    const stemBottomY = stemExtension + stemBottomLocalY;
    const stemInsertionLength = socketTopY - stemBottomY;
    const hingeCenter = new THREE.Vector3(
      0,
      stemExtension + stemTopLocalY,
      0,
    );
    const yawQuaternion = new THREE.Quaternion().setFromAxisAngle(
      Y_AXIS,
      yawAngle,
    );
    const tiltQuaternion = new THREE.Quaternion().setFromAxisAngle(
      X_AXIS,
      tiltAngle,
    );
    const mirrorQuaternion = yawQuaternion.clone().multiply(
      tiltQuaternion,
    );
    const mirrorCenter = mirrorCenterLocal.clone()
      .applyQuaternion(mirrorQuaternion)
      .add(hingeCenter);
    const mirrorNormal = Z_AXIS.clone().applyQuaternion(
      mirrorQuaternion,
    );
    const hingeAxis = X_AXIS.clone().applyQuaternion(yawQuaternion);
    return {
      adjustmentPhase,
      hingeAxis,
      hingeCenter,
      mirrorCenter,
      mirrorNormal,
      mirrorQuaternion,
      stemBottomY,
      stemExtension,
      stemInsertionLength,
      stemVerticalAcceleration,
      stemVerticalSpeed,
      tiltAngle,
      tiltAngularAcceleration,
      tiltAngularSpeed,
      tiltPhase,
      yawAngle,
      yawAngularAcceleration,
      yawAngularSpeed,
      yawPhase,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.57,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.46,
  });
  const stemMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const mirrorFrameMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.58,
  });
  const glassMaterial = matte(0xa8d7e0, {
    metalness: 0.58,
    roughness: 0.19,
  });
  const screwMaterial = matte(PALETTE.accent, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const base = new THREE.Group();
  base.userData.fixed = true;
  base.userData.role = 'fixed-stepped-pedestal-and-socket-pillar';
  root.add(base);
  const baseTiers = [];
  const tierDefinitions = [
    { height: 0.15, radius: 1.32, y: -1.32 },
    { height: 0.18, radius: 0.98, y: -1.18 },
    { height: 0.20, radius: 0.68, y: -1.00 },
  ];
  for (const definition of tierDefinitions) {
    const tier = new THREE.Mesh(
      new THREE.CylinderGeometry(
        definition.radius * 1.12,
        definition.radius,
        definition.height,
        48,
      ),
      frameMaterial,
    );
    tier.position.y = definition.y;
    tier.userData.role = 'one-of-source-stepped-stand-base-tiers';
    baseTiers.push(tier);
    base.add(tier);
  }
  const pillar = new THREE.Mesh(
    boredLatheGeometry([
      {axial:-1.015,radial:.62},{axial:-.75,radial:.46},
      {axial:0,radial:.27},{axial:.51,radial:.38},
    ],socketBoreRadius,64),
    frameMaterial,
  );
  pillar.position.y = 0;
  pillar.userData.role = 'fixed-hollow-socket-pillar';
  base.add(pillar);
  const socketCollar = new THREE.Mesh(
    boredCylinderGeometry(.38,socketBoreRadius,.24),
    frameMaterial,
  );
  socketCollar.position.y = socketTopY - 0.12;
  socketCollar.userData.boreRadius = socketBoreRadius;
  socketCollar.userData.role = 'fixed-upper-stem-socket-collar';
  base.add(socketCollar);
  // A finite side opening connects the bored socket to its radial screw boss.
  socketCollar.geometry.dispose();
  socketCollar.geometry = plate(sector(socketBoreRadius,.38,.44,2*Math.PI-.44,96),-.12,.12).rotateX(-Math.PI/2);
  const socketBoss = new THREE.Mesh(boredCylinderGeometry(.14,.081,.32),frameMaterial);
  socketBoss.rotation.z = Math.PI/2;
  socketBoss.position.set(.34,.63,0);
  socketBoss.userData.role='bored-radial-set-screw-boss';
  base.add(socketBoss);
  const socketBoreWitness = new THREE.Mesh(
    new THREE.TorusGeometry(socketBoreRadius, 0.025, 8, 40),
    darkMaterial,
  );
  socketBoreWitness.rotation.x = Math.PI / 2;
  socketBoreWitness.position.y = socketTopY + 0.035;
  socketBoreWitness.userData.role = 'visible-annular-stem-socket-bore';
  base.add(socketBoreWitness);

  const socketSetScrew = new THREE.Group();
  socketSetScrew.position.set(0, 0.63, 0);
  socketSetScrew.userData.fixed = true;
  socketSetScrew.userData.lockedDegreesOfFreedom = [
    'stem vertical translation',
    'stem yaw rotation',
  ];
  socketSetScrew.userData.role =
    'source-side-set-screw-locking-stem-height-and-yaw';
  root.add(socketSetScrew);
  const socketScrewCore = cylinderAlongX(
    0.075,
    0.75,
    screwMaterial,
    22,
  );
  socketScrewCore.position.x = 0.535;
  socketScrewCore.userData.role = 'socket-lock-screw-core';
  socketSetScrew.add(socketScrewCore);
  const socketScrewKnob = cylinderAlongX(
    0.18,
    0.12,
    screwMaterial,
    28,
  );
  socketScrewKnob.position.x = .97;
  const screwProfile={inner:.074,outer:.079,low:.20,high:.90,width:.025,lead:.05/(2*Math.PI),phase:0};
  const socketThread=new THREE.Mesh(helicalThread(screwProfile,threadAngles(screwProfile,40)).rotateY(Math.PI/2),screwMaterial);
  socketThread.userData.role='closed-socket-set-screw-thread';
  socketSetScrew.add(socketThread);
  socketScrewKnob.userData.role = 'socket-lock-screw-knob';
  socketSetScrew.add(socketScrewKnob);

  const stem = new THREE.Group();
  stem.userData.axis = Y_AXIS.clone();
  stem.userData.role =
    'sliding-and-yawing-inner-stem-released-by-socket-set-screw';
  root.add(stem);
  const stemCore = new THREE.Mesh(
    new THREE.CylinderGeometry(
      stemRadius,
      stemRadius,
      stemTopLocalY - .23 - stemBottomLocalY,
      30,
    ),
    stemMaterial,
  );
  stemCore.position.y = (stemTopLocalY - .23 + stemBottomLocalY) / 2;
  stemCore.userData.role = 'inner-stem-inside-pillar-socket';
  stem.add(stemCore);
  const stemHeightIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 0.24, 0.018),
    whiteMaterial,
  );
  stemHeightIndex.position.set(stemRadius - .004, .85, 0);
  stemHeightIndex.userData.role = 'white-stem-height-and-yaw-index';
  stem.add(stemHeightIndex);

  const hingeYoke = new THREE.Group();
  hingeYoke.position.y = stemTopLocalY;
  hingeYoke.userData.role = 'stem-mounted-fixed-half-of-tilt-hinge';
  stem.add(hingeYoke);
  const yokeBridge = new THREE.Mesh(new THREE.BoxGeometry(.76,.12,.22),stemMaterial);
  yokeBridge.position.y=-.26;
  hingeYoke.add(yokeBridge);
  const hingeOuterBarrels = [];
  for (const x of [-0.31, 0.31]) {
    const barrel = cylinderAlongX(0.20, 0.28, stemMaterial, 28);
    barrel.geometry.dispose();
    barrel.geometry=boredCylinderGeometry(.20,.080,.28);
    barrel.position.x = x;
    barrel.userData.role = 'one-of-two-stem-side-hinge-barrels';
    hingeOuterBarrels.push(barrel);
    hingeYoke.add(barrel);
  }
  const hingeSetScrew = new THREE.Group();
  hingeSetScrew.position.x = 0;
  hingeSetScrew.userData.lockedDegreesOfFreedom = [
    'mirror inclination about horizontal hinge',
  ];
  hingeSetScrew.userData.role =
    'source-hinge-set-screw-locking-mirror-inclination';
  hingeYoke.add(hingeSetScrew);
  const hingeScrewCore = cylinderAlongX(
    0.072,
    1.30,
    screwMaterial,
    22,
  );
  hingeScrewCore.position.x = -.20;
  hingeScrewCore.userData.role = 'hinge-lock-screw-core';
  hingeSetScrew.add(hingeScrewCore);
  const hingeScrewKnob = cylinderAlongX(
    0.17,
    0.12,
    screwMaterial,
    28,
  );
  hingeScrewKnob.position.x = -.91;
  const hingeProfile={inner:.071,outer:.077,low:-.85,high:-.17,width:.025,lead:.05/(2*Math.PI),phase:0};
  const hingeThread=new THREE.Mesh(helicalThread(hingeProfile,threadAngles(hingeProfile,40)).rotateY(Math.PI/2),screwMaterial);
  hingeThread.userData.role='closed-hinge-lock-screw-thread';
  hingeSetScrew.add(hingeThread);
  hingeScrewKnob.userData.role = 'hinge-lock-screw-knob';
  hingeSetScrew.add(hingeScrewKnob);

  const mirrorTiltPivot = new THREE.Group();
  mirrorTiltPivot.userData.axis = X_AXIS.clone();
  mirrorTiltPivot.userData.role =
    'horizontal-hinge-pivot-varying-mirror-inclination';
  hingeYoke.add(mirrorTiltPivot);
  const centerHingeBarrel = cylinderAlongX(
    0.155,
    0.32,
    mirrorFrameMaterial,
    28,
  );
  centerHingeBarrel.geometry.dispose();
  centerHingeBarrel.geometry=boredCylinderGeometry(.155,.080,.32);
  const mirrorBackBracket = new THREE.Mesh(new THREE.BoxGeometry(.28,.14,.67),mirrorFrameMaterial);
  mirrorBackBracket.position.z=-.485;
  mirrorTiltPivot.add(mirrorBackBracket);
  centerHingeBarrel.userData.role =
    'mirror-side-center-hinge-barrel';
  mirrorTiltPivot.add(centerHingeBarrel);

  const mirrorAssembly = new THREE.Group();
  mirrorAssembly.position.copy(mirrorCenterLocal);
  mirrorAssembly.userData.role =
    'tilting-rectangular-framed-mirror-or-camera-platform';
  mirrorTiltPivot.add(mirrorAssembly);
  const mirrorFrameBars = [];
  for (const x of [-mirrorOuterWidth / 2, mirrorOuterWidth / 2]) {
    const side = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.13, mirrorOuterHeight - 0.26, 8, 20),
      mirrorFrameMaterial,
    );
    side.position.x = x;
    side.userData.role = 'rounded-mirror-frame-side';
    mirrorFrameBars.push(side);
    mirrorAssembly.add(side);
  }
  for (const y of [-mirrorOuterHeight / 2, mirrorOuterHeight / 2]) {
    const edge = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.13, mirrorOuterWidth - 0.26, 8, 20),
      mirrorFrameMaterial,
    );
    edge.position.y = y;
    edge.rotation.z = Math.PI / 2;
    edge.userData.role = 'rounded-mirror-frame-horizontal-edge';
    mirrorFrameBars.push(edge);
    mirrorAssembly.add(edge);
  }
  const mirrorGlass = new THREE.Mesh(
    new THREE.BoxGeometry(mirrorGlassWidth, mirrorGlassHeight, 0.075),
    glassMaterial,
  );
  mirrorGlass.position.z = -0.015;
  mirrorGlass.userData.role = 'glass-or-camera-mounting-plane';
  mirrorAssembly.add(mirrorGlass);
  const mirrorNormalIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.64, 0.055),
    whiteMaterial,
  );
  mirrorNormalIndex.position.set(0, 0.73, 0.075);
  mirrorNormalIndex.userData.role = 'white-mirror-orientation-index';
  mirrorAssembly.add(mirrorNormalIndex);

  const update = (time) => {
    const state = stateAtTime(time);
    stem.position.y = state.stemExtension;
    stem.rotation.y = state.yawAngle;
    mirrorTiltPivot.rotation.x = state.tiltAngle;
    root.userData.currentState = state;
    root.userData.constraintResiduals = {
      hingeHeight:
        stem.position.y + hingeYoke.position.y - state.hingeCenter.y,
      hingeX: state.hingeCenter.x,
      hingeZ: state.hingeCenter.z,
      socketRadial:
        Math.hypot(stem.position.x, stem.position.z),
    };
  };

  root.userData = {
    archetype: movement.archetype,
    blocks: {
      base,
      baseTiers,
      socketBoss,
      socketThread,
      hingeThread,
      yokeBridge,
      mirrorBackBracket,
      centerHingeBarrel,
      hingeOuterBarrels,
      hingeScrewCore,
      hingeScrewKnob,
      hingeSetScrew,
      hingeYoke,
      mirrorAssembly,
      mirrorFrameBars,
      mirrorGlass,
      mirrorNormalIndex,
      mirrorTiltPivot,
      pillar,
      socketBoreWitness,
      socketCollar,
      socketScrewCore,
      socketScrewKnob,
      socketSetScrew,
      stem,
      stemCore,
      stemHeightIndex,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 3,
      inputs: [
        'stem translation along the vertical socket axis',
        'stem yaw rotation about that same vertical axis',
        'mirror inclination about the stem-top horizontal hinge',
      ],
      lockedDegreesOfFreedom: 0,
      note:
        'with both set screws tightened all three adjustments lock; the animation represents both screws loosened and uses rationally related smooth schedules only to display the full adjustment envelope',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid pedestal, socket, stem, hinge, and framed mirror',
        'frictionless unlocked stem translation and yaw',
        'frictionless unlocked hinge inclination',
        'set screws represented as binary friction locks rather than threaded-force solvers',
        'smooth periodic adjustment schedules without gravity or operator-force dynamics',
      ],
      sourceSpecifiesDimensionsTimingRangesOrScrewPitch: false,
      treatment:
        'Brown explicitly supplies elevation, yaw, inclination, socket, stem, hinge, and both set-screw locks but no values; the three rigid transforms and insertion bounds are analytic while ranges and timing are engineered',
    },
    fidelity: 'authored',
    geometry: {
      adjustmentAngularFrequency,
      demonstrationPeriod,
      mirrorCenterLocal,
      mirrorGlassHeight,
      mirrorGlassWidth,
      mirrorOuterHeight,
      mirrorOuterWidth,
      socketBoreRadius,
      socketBottomY,
      socketRadialClearance,
      socketTopY,
      stemBottomLocalY,
      stemExtensionAmplitude,
      stemExtensionMean,
      stemRadius,
      stemTopLocalY,
      tiltAmplitude,
      tiltFrequencyRatio,
      tiltPhaseOffset,
      yawAmplitude,
      yawPhaseOffset,
    },
    locking: {
      hingeSetScrew:
        'tightening removes the one inclination degree of freedom at the horizontal hinge',
      releasedForDemonstration: true,
      socketSetScrew:
        'tightening removes both axial translation and yaw rotation of the stem in its socket',
      tightenedSystemDegreesOfFreedom: 0,
    },
    mechanism:
      'one-stem-slides-and-yaws-inside-one-pillar-socket-locked-by-one-side-set-screw-and-carries-one-framed-mirror-on-one-horizontal-inclination-hinge-locked-by-a-second-set-screw',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate382: {
        baseLeft: new THREE.Vector2(144, 497),
        baseRight: new THREE.Vector2(373, 498),
        hingeCenter: new THREE.Vector2(260, 178),
        hingeSetScrewEnd: new THREE.Vector2(220, 179),
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 8,
        mirrorFrameBottom: new THREE.Vector2(236, 317),
        mirrorFrameLeft: new THREE.Vector2(132, 111),
        mirrorFrameRight: new THREE.Vector2(406, 257),
        mirrorFrameTop: new THREE.Vector2(286, 16),
        socketSetScrewEnd: new THREE.Vector2(323, 315),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the stand supports mirrors or other articles',
          'the article can be raised or lowered',
          'the article can be turned right or left',
          'its inclination can be varied',
          'the stem fits a pillar socket and is secured by a set screw',
          'the glass is hinged to the stem and the hinge has a tightening set screw',
          'the same arrangement is used for photographic camera stands',
        ],
        engravingEvidence:
          'the plate shows a broad stepped base, hollow-shaped pillar, vertical inner stem, side socket screw, horizontal hinge barrel and screw, and a rounded rectangular framed glass',
        reconstructionDisclosure:
          'frame depth, glass material, 0.25-unit elevation range, 32-degree yaw, 22-degree tilt, phase relationship, colors, and six-second cycle are engineered because Brown gives no dimensions or timing and the official page has no canvas animation',
      },
      officialPage: 'https://507movements.com/mm_382.html',
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod,
      note:
        'one elevation and yaw cycle plus two inclination cycles close every rigid transform smoothly in six authored seconds',
    },
    transmission: {
      hingeAxisLaw:
        'the horizontal hinge axis yaws rigidly with the stem, and mirror inclination is a pure rotation about that moving axis',
      mirrorTransformLaw:
        'world mirror transform equals stem vertical translation followed by stem yaw, hinge offset, and local hinge tilt',
      socketConstraint:
        'the cylindrical stem center remains exactly on the socket Y axis while retaining positive radial and axial insertion clearances',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.88, -1.62, -1.82),
    new THREE.Vector3(1.88, 4.22, 1.82),
  );
  root.userData.groundFloorY = -1.42;
  fitPistonGuide(root, update, demonstrationPeriod);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(3.2, 1.7, 10.2),
    root,
    update,
  };
}

export function createAuthoredAdjustableStandMovement(movement) {
  if (movement.id !== 382) return null;
  return adjustableMirrorStand(movement);
}
