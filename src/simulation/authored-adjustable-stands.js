import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import {boredCylinderGeometry,fitPistonGuide} from './piston-guide-parts.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate,poly,polygonClipping,sector} from './finite-plate-geometry.js';
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

function roundedRectangle(width, height, radius, count = 16) {
  const points = [];
  const corners = [
    [width / 2 - radius, height / 2 - radius, 0],
    [-width / 2 + radius, height / 2 - radius, Math.PI / 2],
    [-width / 2 + radius, -height / 2 + radius, Math.PI],
    [width / 2 - radius, -height / 2 + radius, 1.5 * Math.PI],
  ];
  for (const [x, y, start] of corners) {
    for (let index = 0; index <= count; index += 1) {
      const angle = start + Math.PI / 2 * index / count;
      points.push([x + radius * Math.cos(angle), y + radius * Math.sin(angle)]);
    }
  }
  return poly(points);
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
  // The cycle starts at full back tilt with the stem fully yawed, the pose
  // Brown engraves: the frame leans with its top edge rising to the right.
  const tiltPhaseOffset = -Math.PI / 2;
  // The frame stands far enough behind the hinge that its lower edge clears
  // the socket collar and set screw at full inclination.
  const mirrorCenterLocal = new THREE.Vector3(0, 0.62, -0.90);
  const mirrorOuterWidth = 2.48;
  const mirrorOuterHeight = 2.86;
  // The glass fills the broad frame's rounded opening (0.30 border).
  const mirrorGlassWidth = 1.876;
  const mirrorGlassHeight = 2.256;
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
  // Opaque silvered glass: a cool grey, highly metallic face.
  const glassMaterial = matte(0xc3ced2, {
    metalness: 0.78,
    roughness: 0.14,
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
  // Brown's foot is a broad thin rim sweeping up in a concave flared cone
  // to the baluster's foot, not stepped discs: a rim disc, the flare and a
  // small fillet ring under the pillar.
  const flareBottomY = -1.335;
  const flareTopY = -1.075;
  const flareProfile = [new THREE.Vector2(0, flareBottomY)];
  for (let index = 0; index <= 32; index += 1) {
    const t = index / 32;
    flareProfile.push(new THREE.Vector2(
      0.44 + 0.80 * (1 - t) ** 1.7,
      flareBottomY + (flareTopY - flareBottomY) * t,
    ));
  }
  flareProfile.push(new THREE.Vector2(0, flareTopY));
  const tierGeometries = [
    new THREE.CylinderGeometry(1.27, 1.31, 0.06, 64)
      .translate(0, flareBottomY - 0.03, 0),
    new THREE.LatheGeometry(flareProfile, 64),
    new THREE.CylinderGeometry(0.45, 0.46, 0.06, 48)
      .translate(0, flareTopY + 0.03, 0),
  ];
  for (const geometry of tierGeometries) {
    const tier = new THREE.Mesh(geometry, frameMaterial);
    tier.userData.role = 'one-of-source-stepped-stand-base-tiers';
    baseTiers.push(tier);
    base.add(tier);
  }
  const pillar = new THREE.Mesh(
    // Brown's pillar is a turned baluster: a foot, a swelling vase and a
    // slender neck rising to the socket collar.
    boredLatheGeometry(new THREE.SplineCurve([
      [-1.015,.40],[-.93,.29],[-.78,.33],[-.52,.44],
      [-.24,.38],[.02,.27],[.30,.235],[.51,.24],
    ].map(([axial,radial])=>new THREE.Vector2(axial,radial)))
      .getPoints(48).map(({x,y})=>({axial:x,radial:y})),socketBoreRadius,64),
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
  // The side opening, the boss and the set screw share one yaw: the screw
  // was turned 0.5 rad toward the front (pass 54), so the bored boss and
  // the collar opening turn with it and the screw stays in its bore.
  const socketScrewYaw = -0.5;
  socketCollar.geometry = plate(sector(socketBoreRadius,.38,.44,2*Math.PI-.44,96),-.12,.12).rotateX(-Math.PI/2).rotateY(socketScrewYaw);
  const socketBoss = new THREE.Mesh(boredCylinderGeometry(.14,.081,.32),frameMaterial);
  socketBoss.rotation.set(0,socketScrewYaw,Math.PI/2);
  socketBoss.position.set(.34*Math.cos(socketScrewYaw),.63,-.34*Math.sin(socketScrewYaw));
  socketBoss.userData.role='bored-radial-set-screw-boss';
  base.add(socketBoss);
  const socketBoreWitness = new THREE.Mesh(
    new THREE.TorusGeometry(socketBoreRadius, 0.025, 8, 40),
    darkMaterial,
  );
  socketBoreWitness.rotation.x = Math.PI / 2;
  socketBoreWitness.position.y = socketTopY + 0.035;
  socketBoreWitness.userData.role = 'visible-annular-stem-socket-bore';
  // Traced a drawn edge only: hidden reference, not a dark rim.
  socketBoreWitness.visible = false;
  socketBoreWitness.userData.retiredInkOutline = true;
  base.add(socketBoreWitness);

  const socketSetScrew = new THREE.Group();
  socketSetScrew.position.set(0, 0.63, 0);
  // Turned a little toward the front (still on Brown's right-hand side) so
  // the frame's lower edge swings well clear of the knob at mid-tilt.
  socketSetScrew.rotation.y = socketScrewYaw;
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
  // The hinge is on the back of the mirror (the glass faces away from the
  // stand). A short neck of the frame casting runs from the hinge barrel
  // to Brown's raised rounded plate on the frame's back; it stands the
  // frame off far enough that its lower edge swings clear of the socket
  // collar and screw.
  const mirrorBackPocketFloor = 0.0;
  const mirrorBackBossFront = 0.30;
  const mirrorBackBracket = new THREE.Mesh(
    new THREE.BoxGeometry(.30,.22,mirrorCenterLocal.z*-1-mirrorBackBossFront-.135),
    mirrorFrameMaterial,
  );
  mirrorBackBracket.position.z=(mirrorCenterLocal.z+mirrorBackBossFront-.135)/2;
  mirrorBackBracket.userData.role='mirror-back-neck-to-hinge-barrel';
  mirrorTiltPivot.add(mirrorBackBracket);
  centerHingeBarrel.userData.role =
    'mirror-side-center-hinge-barrel';
  mirrorTiltPivot.add(centerHingeBarrel);

  const mirrorAssembly = new THREE.Group();
  mirrorAssembly.position.copy(mirrorCenterLocal);
  mirrorAssembly.userData.role =
    'tilting-rectangular-framed-mirror-or-camera-platform';
  mirrorTiltPivot.add(mirrorAssembly);
  // Brown draws a broad flat rounded frame round the glass, not a thin
  // tubular rim; the glass fills the frame's rounded opening.
  const mirrorFrameBorder = 0.30;
  const mirrorOpeningWidth = mirrorOuterWidth - 2 * mirrorFrameBorder;
  const mirrorOpeningHeight = mirrorOuterHeight - 2 * mirrorFrameBorder;
  const mirrorFrame = new THREE.Mesh(
    plate(
      polygonClipping.difference(
        roundedRectangle(mirrorOuterWidth, mirrorOuterHeight, 0.42),
        roundedRectangle(mirrorOpeningWidth, mirrorOpeningHeight, 0.18),
      ),
      -0.12,
      0.12,
    ),
    mirrorFrameMaterial,
  );
  mirrorFrame.userData.role = 'broad-rounded-mirror-frame';
  mirrorAssembly.add(mirrorFrame);
  const mirrorFrameBars = [mirrorFrame];
  const mirrorGlass = new THREE.Mesh(
    plate(
      roundedRectangle(mirrorGlassWidth, mirrorGlassHeight, 0.176),
      -0.10,
      -0.03,
    ),
    glassMaterial,
  );
  mirrorGlass.userData.role = 'glass-or-camera-mounting-plane';
  mirrorAssembly.add(mirrorGlass);
  // Brown's frame back: the broad rim stands round a recessed rounded
  // pocket (the back board, sunk below the rim), and a raised vertical bar
  // with a rounded lower end runs down the pocket right of centre. The
  // hinge lug is cast on that bar.
  const mirrorBackBoard = new THREE.Mesh(
    plate(roundedRectangle(mirrorGlassWidth, mirrorGlassHeight, 0.176),
      -0.03, mirrorBackPocketFloor),
    mirrorFrameMaterial,
  );
  mirrorBackBoard.userData.role = 'mirror-back-board-recessed-pocket-floor';
  mirrorAssembly.add(mirrorBackBoard);
  const barTop = mirrorGlassHeight / 2 - 0.13;
  const barBottom = -mirrorGlassHeight / 2 + 0.34;
  const barHalfWidth = 0.34;
  const barCenterX = 0.18;
  const barOutline = [];
  barOutline.push([barCenterX + barHalfWidth, barTop - 0.10]);
  for (let index = 0; index <= 8; index += 1) {
    const angle = Math.PI / 2 * index / 8;
    barOutline.push([
      barCenterX + barHalfWidth - 0.10 + 0.10 * Math.cos(angle),
      barTop - 0.10 + 0.10 * Math.sin(angle),
    ]);
  }
  for (let index = 0; index <= 8; index += 1) {
    const angle = Math.PI / 2 + Math.PI / 2 * index / 8;
    barOutline.push([
      barCenterX - barHalfWidth + 0.10 + 0.10 * Math.cos(angle),
      barTop - 0.10 + 0.10 * Math.sin(angle),
    ]);
  }
  for (let index = 0; index <= 24; index += 1) {
    const angle = Math.PI + Math.PI * index / 24;
    barOutline.push([
      barCenterX + barHalfWidth * Math.cos(angle),
      barBottom + barHalfWidth + barHalfWidth * Math.sin(angle),
    ]);
  }
  const mirrorBackBoss = new THREE.Mesh(
    plate(poly(barOutline), mirrorBackPocketFloor, mirrorBackBossFront),
    mirrorFrameMaterial,
  );
  mirrorBackBoss.userData.role = 'raised-rounded-end-bar-on-mirror-back';
  mirrorAssembly.add(mirrorBackBoss);
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
  // Brown's elevation is nearly level: the foot's rim reads as a line and
  // its flared cone in profile, so keep perspective from tipping it open.
  root.userData.cameraFov = 14;
  fitPistonGuide(root, update, demonstrationPeriod);
  markShadows(root);
  // The hinge bracket's shadow aliased into stair-stepped patches on the
  // glass and frame face; the mirror assembly takes no cast shadow.
  mirrorAssembly.traverse((object) => { object.receiveShadow = false; });
  return {
    cameraDirection: new THREE.Vector3(-1.6, 0.4, 10.2),
    root,
    update,
  };
}

export function createAuthoredAdjustableStandMovement(movement) {
  if (movement.id !== 382) return null;
  return adjustableMirrorStand(movement);
}
