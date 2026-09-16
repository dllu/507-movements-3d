import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import {boredCylinderGeometry,fitPistonGuide} from './piston-guide-parts.js';
import {plate,poly,polygonClipping as clip} from './finite-plate-geometry.js';
import {helicalThread,threadAngles} from './mujoco-screw/thread-geometry.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function makeHalfCurve(legSpacing, archSpringY, archCrownY, sign) {
  const leftEnd = new THREE.Vector3(-legSpacing / 2, 0, 0);
  const leftSpring = new THREE.Vector3(
    -legSpacing / 2,
    sign * archSpringY,
    0,
  );
  const rightSpring = new THREE.Vector3(
    legSpacing / 2,
    sign * archSpringY,
    0,
  );
  const rightEnd = new THREE.Vector3(legSpacing / 2, 0, 0);
  const curve = new THREE.CurvePath();
  curve.add(new THREE.LineCurve3(leftEnd, leftSpring));
  curve.add(new THREE.CubicBezierCurve3(
    leftSpring,
    new THREE.Vector3(-legSpacing / 2, sign * archCrownY, 0),
    new THREE.Vector3(legSpacing / 2, sign * archCrownY, 0),
    rightSpring,
  ));
  curve.add(new THREE.LineCurve3(rightSpring, rightEnd));
  return curve;
}

function makeThreadedScrew({
  direction,
  length,
  material,
  pitch,
  rolePrefix,
  threadMaterial,
}) {
  const screw = new THREE.Group();
  screw.userData.role = `${rolePrefix}-male-screw-fixed-to-link-half`;

  const shank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, length, 30),
    material,
  );
  shank.position.y = direction * length / 2;
  shank.userData.role = `${rolePrefix}-screw-core`;
  screw.add(shank);

  const thread = new THREE.Mesh(
    helicalThread({inner:.14,outer:.19,low:Math.min(0,direction*length),high:Math.max(0,direction*length),width:pitch/2-.003,lead:-pitch/FULL_TURN,phase:0},
      threadAngles({low:Math.min(0,direction*length),high:Math.max(0,direction*length),width:pitch/2-.003,lead:-pitch/FULL_TURN,phase:0},64)).rotateX(-Math.PI/2),
    threadMaterial,
  );
  thread.userData.threadProfile={inner:.14,outer:.19,low:Math.min(0,direction*length),high:Math.max(0,direction*length),width:pitch/2-.003,lead:-pitch/FULL_TURN,phase:0};
  thread.userData.role = `${rolePrefix}-visible-helical-male-thread`;
  screw.add(thread);

  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 24, 14),
    material,
  );
  tip.scale.y = 0.40;
  tip.position.y = direction * length;
  tip.userData.role = `${rolePrefix}-screw-tip`;
  screw.add(tip);

  screw.userData.shank = shank;
  screw.userData.thread = thread;
  screw.userData.tip = tip;
  return markShadows(screw);
}

function makeLinkHalf({
  archCrownY,
  archSpringY,
  colorMaterial,
  darkMaterial,
  halfName,
  legSpacing,
  sign,
  screwLength,
  threadMaterial,
  threadPitch,
}) {
  const half = new THREE.Group();
  half.userData.role = `${halfName}-rigid-u-shaped-link-half`;
  const curve = makeHalfCurve(
    legSpacing,
    archSpringY,
    archCrownY,
    sign,
  );
  const body = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 112, 0.18, 16, false),
    colorMaterial,
  );
  body.userData.role = `${halfName}-unbroken-u-shaped-body`;
  half.add(body);

  const screwSide = sign > 0 ? 'right' : 'left';
  const swivelSide = sign > 0 ? 'left' : 'right';
  const screwX = (sign > 0 ? 1 : -1) * legSpacing / 2;
  const swivelX = -screwX;
  const screw = makeThreadedScrew({
    direction: -sign,
    length: screwLength,
    material: colorMaterial,
    pitch: threadPitch,
    rolePrefix: `${halfName}-${screwSide}`,
    threadMaterial,
  });
  screw.position.x = screwX;
  half.add(screw);

  const swivelJournal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.145, 0.38, 28),
    darkMaterial,
  );
  swivelJournal.position.set(swivelX, -sign * 0.19, 0);
  swivelJournal.userData.role =
    `${halfName}-${swivelSide}-captive-swivel-journal`;
  half.add(swivelJournal);
  const swivelHead = new THREE.Mesh(
    new THREE.CylinderGeometry(.215,.215,.07,32),
    colorMaterial,
  );

  swivelHead.position.set(swivelX, -sign*.375, 0);
  swivelHead.userData.role =
    `${halfName}-${swivelSide}-axial-swivel-retaining-head`;
  half.add(swivelHead);

  half.userData.body = body;
  half.userData.curve = curve;
  half.userData.screw = screw;
  half.userData.screwSide = screwSide;
  half.userData.swivelHead = swivelHead;
  half.userData.swivelJournal = swivelJournal;
  half.userData.swivelSide = swivelSide;
  return markShadows(half);
}

function makeOvalNutShape() {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, 0.52, 0.92, 0, FULL_TURN, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, 0.29, 0.66, 0, FULL_TURN, true, 0);
  shape.holes.push(hole);
  return shape;
}

function makeSwivelNut({
  brassMaterial,
  captiveSign,
  darkMaterial,
  name,
  whiteMaterial,
}) {
  const nut = new THREE.Group();
  nut.userData.role = `${name}-captured-rotating-swivel-nut`;

  const outline=makeOvalNutShape();
  const outer=poly(outline.getPoints(64).map(p=>[p.x,p.y]));
  const inner=poly(outline.holes[0].getPoints(64).map(p=>[p.x,p.y]));
  const handleGeometry=plate(clip.difference(outer,inner,poly([[-.195,-1],[.195,-1],[.195,1],[-.195,1]])),-.11,.11);
  const handle = new THREE.Mesh(handleGeometry, brassMaterial);
  handle.userData.role = `${name}-oval-hand-grip-and-nut-cage`;
  nut.add(handle);

  const captiveOffset = captiveSign * 0.68;
  const bearingOffset = captiveSign * .49;
  const receiverOffset = -captiveSign * 0.50;
  const captiveBearing = new THREE.Mesh(
    boredCylinderGeometry(.30,.149,.26),
    brassMaterial,
  );
  captiveBearing.position.y = bearingOffset;
  captiveBearing.userData.role = `${name}-swivel-bearing-captured-on-own-half`;
  nut.add(captiveBearing);
  const captiveBore = new THREE.Mesh(
    boredCylinderGeometry(.151,.149,.25),
    darkMaterial,
  );
  captiveBore.position.y = bearingOffset;
  captiveBore.userData.role = `${name}-visible-captive-journal-bore`;
  nut.add(captiveBore);

  const threadedBarrel = new THREE.Mesh(
    boredCylinderGeometry(.30,.194,.50),
    brassMaterial,
  );
  threadedBarrel.position.y = receiverOffset;
  threadedBarrel.userData.role = `${name}-internally-threaded-receiver-barrel`;
  nut.add(threadedBarrel);
  const threadedBore = new THREE.Mesh(
    helicalThread({inner:.144,outer:.194,low:-.25,high:.25,width:.091,lead:-.20/FULL_TURN,phase:-captiveSign*.48+.10},
      threadAngles({low:-.25,high:.25,width:.091,lead:-.20/FULL_TURN,phase:-captiveSign*.48+.10},64)).rotateX(-Math.PI/2),
    darkMaterial,
  );
  threadedBore.position.y = receiverOffset;
  threadedBore.userData.threadProfile={inner:.144,outer:.194,low:-.25,high:.25,width:.091,lead:-.20/FULL_TURN,phase:-captiveSign*.48+.10};
  threadedBore.userData.role = `${name}-visible-female-thread-bore`;
  nut.add(threadedBore);

  const index = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 18, 12),
    whiteMaterial,
  );
  index.position.set(0.48, 0, 0.16);
  index.userData.role = `${name}-white-swivel-nut-rotation-index`;
  nut.add(index);

  nut.userData.captiveBearing = captiveBearing;
  nut.userData.captiveBore = captiveBore;
  nut.userData.captiveOffset = captiveOffset;
  nut.userData.handle = handle;
  nut.userData.index = index;
  nut.userData.receiverOffset = receiverOffset;
  nut.userData.threadedBarrel = threadedBarrel;
  nut.userData.threadedBore = threadedBore;
  return markShadows(nut);
}

function chainRepairLink(movement) {
  const root = new THREE.Group();

  // Brown supplies construction only.  This reversible demonstration uses
  // equal-pitch right-hand threads referred to their opposite insertion axes.
  // Consequently the two captured swivel nuts counter-rotate in world space
  // while advancing the same amount and preserving a compatible separation.
  const legSpacing = 2.32;
  const archSpringY = 1.18;
  const archCrownY = 2.08;
  const looseSeparation = 1.66;
  const threadPitch = 0.20;
  const maximumAdjustmentTurns = 2;
  const tightSeparation = looseSeparation
    - threadPitch * maximumAdjustmentTurns;
  const screwLength = .78;
  const cycleDuration = 8;
  const nutCaptureOffset = 0.68;
  const nutReceiverOffsetMagnitude = 0.50;
  const barrelLength = 0.50;

  const topMaterial = matte(PALETTE.driver, {
    metalness: 0.24,
    roughness: 0.49,
  });
  const bottomMaterial = matte(PALETTE.driven, {
    metalness: 0.22,
    roughness: 0.52,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.35,
    roughness: 0.42,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.40,
  });
  const threadMaterial = matte(0xc8c4b7, {
    metalness: 0.42,
    roughness: 0.34,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.45 });

  const topHalf = makeLinkHalf({
    archCrownY,
    archSpringY,
    colorMaterial: topMaterial,
    darkMaterial,
    halfName: 'upper',
    legSpacing,
    sign: 1,
    screwLength,
    threadMaterial,
    threadPitch,
  });
  const bottomHalf = makeLinkHalf({
    archCrownY,
    archSpringY,
    colorMaterial: bottomMaterial,
    darkMaterial,
    halfName: 'lower',
    legSpacing,
    sign: -1,
    screwLength,
    threadMaterial,
    threadPitch,
  });
  root.add(topHalf, bottomHalf);

  const leftNut = makeSwivelNut({
    brassMaterial,
    captiveSign: 1,
    darkMaterial,
    name: 'left-upper-carried',
    whiteMaterial,
  });
  const rightNut = makeSwivelNut({
    brassMaterial,
    captiveSign: -1,
    darkMaterial,
    name: 'right-lower-carried',
    whiteMaterial,
  });
  leftNut.position.x = -legSpacing / 2;
  rightNut.position.x = legSpacing / 2;
  root.add(leftNut, rightNut);

  const stateAtTime = (time) => {
    const cycleCoordinate = time / cycleDuration;
    const cyclePhase = positiveModulo(cycleCoordinate, 1);
    const adjustmentTurns = maximumAdjustmentTurns * 0.5
      * (1 - Math.cos(FULL_TURN * cycleCoordinate));
    const adjustmentTurnRate = maximumAdjustmentTurns * Math.PI
      * Math.sin(FULL_TURN * cycleCoordinate) / cycleDuration;
    const halfSeparation = looseSeparation
      - threadPitch * adjustmentTurns;
    const separationRate = -threadPitch * adjustmentTurnRate;
    const upperEndY = halfSeparation / 2;
    const lowerEndY = -halfSeparation / 2;
    const leftNutAngle = FULL_TURN * adjustmentTurns;
    const rightNutAngle = -FULL_TURN * adjustmentTurns;
    const leftNutCenterY = upperEndY - nutCaptureOffset;
    const rightNutCenterY = lowerEndY + nutCaptureOffset;
    const leftReceiverY = leftNutCenterY
      - nutReceiverOffsetMagnitude;
    const rightReceiverY = rightNutCenterY
      + nutReceiverOffsetMagnitude;
    const lowerLeftScrewTipY = lowerEndY + screwLength;
    const upperRightScrewTipY = upperEndY - screwLength;
    const leftThreadEngagement = lowerLeftScrewTipY
      - (leftReceiverY - barrelLength / 2);
    const rightThreadEngagement = (rightReceiverY + barrelLength / 2)
      - upperRightScrewTipY;
    return {
      adjustmentTurnRate,
      adjustmentTurns,
      cycleCoordinate,
      cyclePhase,
      halfSeparation,
      leftNutAngle,
      leftNutCenterY,
      leftReceiverY,
      leftThreadEngagement,
      lowerEndY,
      lowerLeftScrewTipY,
      lowerHalfVelocity: -separationRate / 2,
      rightNutAngle,
      rightNutCenterY,
      rightReceiverY,
      rightThreadEngagement,
      separationRate,
      tightening: adjustmentTurnRate > 1e-12,
      upperEndY,
      upperHalfVelocity: separationRate / 2,
      upperRightScrewTipY,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    topHalf.position.y = state.upperEndY;
    bottomHalf.position.y = state.lowerEndY;
    leftNut.position.y = state.leftNutCenterY;
    rightNut.position.y = state.rightNutCenterY;
    leftNut.rotation.y = state.leftNutAngle;
    rightNut.rotation.y = state.rightNutAngle;
    root.userData.contacts = {
      leftCaptiveSwivel: {
        active: true,
        axialError:
          leftNut.position.y + leftNut.userData.captiveOffset
          - topHalf.position.y,
        carriedBy: 'upper half',
      },
      leftThreadPair: {
        active: true,
        engagement: state.leftThreadEngagement,
        femaleMember: 'upper-carried left swivel nut',
        maleMember: 'lower-half left screw',
      },
      rightCaptiveSwivel: {
        active: true,
        axialError:
          rightNut.position.y + rightNut.userData.captiveOffset
          - bottomHalf.position.y,
        carriedBy: 'lower half',
      },
      rightThreadPair: {
        active: true,
        engagement: state.rightThreadEngagement,
        femaleMember: 'lower-carried right swivel nut',
        maleMember: 'upper-half right screw',
      },
    };
    root.userData.kinematics = state;
  };

  const looseState = stateAtTime(0);
  const tightState = stateAtTime(cycleDuration / 2);
  root.userData = {
    archetype:
      'two-piece-chain-repair-link-with-cross-coupled-opposed-screws-and-captured-swivel-nuts',
    blocks: {
      bottomHalf,
      leftNut,
      rightNut,
      topHalf,
    },
    constraintResiduals: {
      equalLooseEngagement:
        looseState.leftThreadEngagement
        - looseState.rightThreadEngagement,
      equalTightEngagement:
        tightState.leftThreadEngagement
        - tightState.rightThreadEngagement,
      tighteningIdentity:
        looseState.halfSeparation - tightState.halfSeparation
        - threadPitch * maximumAdjustmentTurns,
    },
    constraints: {
      crossCoupling:
        'The upper half carries the left swivel nut and right male screw; the lower half carries the right swivel nut and left male screw, so each screw enters the other half’s nut.',
      rigidHalves:
        'Each U-shaped half translates without changing its arch, leg spacing, or end alignment.',
      swivelCapture:
        'Each nut rotates about the common screw axis but is axially captured to the end of its own U-shaped half.',
      threads:
        'Both demonstrated thread pairs have equal pitch and matched advance; opposite insertion axes make their visible world rotations opposite.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'upper and lower half separation',
        'equal left and right screw engagement',
      ],
      independentPrescribedInputs: 1,
      inputs: ['matched manual swivel-nut adjustment coordinate'],
      note:
        'The source permits manual adjustment of the two nuts; the animation synchronizes their equal advances to keep the ideal rigid double-thread assembly compatible.',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid U-shaped halves, screws, and swivel-nut bodies',
        'equal-pitch right-hand demonstration threads referred to their insertion axes',
        'zero backlash and perfectly synchronized manual adjustment',
        'thread friction, elastic strain, chain load, and strength omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless reversible screw-adjustment demonstration',
    },
    fidelity: 'authored',
    geometry: {
      archCrownY,
      archSpringY,
      barrelLength,
      legSpacing,
      looseSeparation,
      maximumAdjustmentTurns,
      nutCaptureOffset,
      nutReceiverOffsetMagnitude,
      screwLength,
      threadPitch,
      tightSeparation,
    },
    mechanism:
      'two-rigid-opposed-u-shaped-chain-link-halves-cross-connect-through-two-male-screws-and-two-axially-captured-swivel-nuts-which-counter-rotate-to-tighten-or-loosen-the-link',
    motion: {
      cycleDuration,
      demonstration:
        'loose -> two matched tightening turns -> tight -> two matched loosening turns -> loose',
      sourcePrescribesMotion: false,
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 399 page marks Animated unavailable and provides only Brown’s static construction engraving.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate399: {
        bottomArchApproximatePixels: [194, 353, 288, 451],
        imageHeight: 525,
        imageWidth: 525,
        leftNutApproximatePixels: [166, 242, 201, 353],
        measurementUncertaintyPixels: 6,
        rightNutApproximatePixels: [298, 374, 202, 356],
        topArchApproximatePixels: [194, 353, 86, 239],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'used to repair chains or tighten chain guys or braces',
          'the link is made in two parts',
          'one end of each part has a swivel nut',
          'the other end of each part has a screw',
          'each screw fits the nut of the other part',
        ],
        engravingEvidence:
          'The plate shows opposed upper and lower U-shaped halves, a left oblong nut body captured at the upper end, a right oblong nut body captured at the lower end, and the two shaded screw engagements on diagonally opposite ends.',
        reconstructionDisclosure:
          'Brown supplies no animation, dimensions, pitch, handedness, adjustment range, nut operating sequence, load, or material. The equal 0.20-unit pitch, two-turn synchronized counter-rotation, reversible cosine schedule, scale, depth, and colors are explanatory choices.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 399',
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      loosePoses: [0, 1],
      tightPose: 0.5,
    },
    transmission: {
      axialLaw:
        'looseSeparation-halfSeparation=threadPitch*adjustmentTurns',
      matchedNutLaw:
        'leftNutAngle=+2*pi*turns; rightNutAngle=-2*pi*turns',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.05, -3.30, -1.05),
    new THREE.Vector3(2.05, 3.30, 1.05),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(6.8, 4.5, 10.5);
  root.userData.groundFloorY = -3.20;
  update(0);
  fitPistonGuide(root, update, cycleDuration);
  root.userData.cameraDirection = new THREE.Vector3(1.7,1.1,11);
  return { root, update, cameraDirection:root.userData.cameraDirection };
}

export function createAuthoredChainRepairLinkMovement(movement) {
  if (movement.id !== 399) return null;
  return chainRepairLink(movement);
}
