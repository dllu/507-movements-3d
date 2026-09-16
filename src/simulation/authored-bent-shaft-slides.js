import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import {boredCylinderGeometry, fitPistonGuide} from './piston-guide-parts.js';

// Closed lathed spherical seats; the upper bearing retains the journal bore.
function sphericalSeat(inner, outer, halfSpan) {
  const points=[];
  for(let i=0;i<=48;i++){const y=-halfSpan+2*halfSpan*i/48;points.push(new THREE.Vector2(Math.sqrt(outer*outer-y*y),y));}
  for(let i=48;i>=0;i--){const y=-halfSpan+2*halfSpan*i/48;points.push(new THREE.Vector2(Math.sqrt(inner*inner-y*y),y));}
  points.push(points[0].clone());
  return new THREE.LatheGeometry(points,64);
}
function lowerSeatGeometry() {
 const p=[];
 for(let i=0;i<=32;i++){const a=Math.PI/2+Math.PI/2*i/32;p.push(new THREE.Vector2(.205*Math.sin(a),.205*Math.cos(a)));}
 for(let i=32;i>=0;i--){const a=Math.PI/2+Math.PI/2*i/32;p.push(new THREE.Vector2(.166*Math.sin(a),.166*Math.cos(a)));}
 p.push(p[0].clone());return new THREE.LatheGeometry(p,64);
}

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function cylinderAlongX(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongZ(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function cylinderBetween(start, end, radius, material, segments = 20) {
  const delta = end.clone().sub(start);
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, delta.length(), segments),
    material,
  );
  cylinder.position.copy(start).add(end).multiplyScalar(0.5);
  cylinder.quaternion.setFromUnitVectors(Y_AXIS, delta.clone().normalize());
  return cylinder;
}

function updateCylinderBetween(cylinder, start, end) {
  const delta = end.clone().sub(start);
  const length = delta.length();
  cylinder.position.copy(start).add(end).multiplyScalar(0.5);
  cylinder.quaternion.setFromUnitVectors(
    Y_AXIS,
    delta.clone().multiplyScalar(1 / length),
  );
  cylinder.scale.set(1, length, 1);
}

function makeDynamicRod(radius, material, role) {
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 1, 22),
    material,
  );
  rod.userData.role = role;
  rod.userData.setEndpoints = (start, end) => {
    updateCylinderBetween(rod, start, end);
  };
  return rod;
}

function torusNormalToX(majorRadius, tubeRadius, material, segments = 80) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(majorRadius, tubeRadius, 12, segments),
    material,
  );
  torus.rotation.y = Math.PI / 2;
  return torus;
}

function bentShaftSlide(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6;
  const shaftAngularSpeed = FULL_TURN / cycleDuration;
  const shaftAxisY = 1.25;
  const shaftAxisZ = 0;
  const bentJournalX = -0.65;
  const crankRadius = 0.52;
  const slideAxisY = -1.25;
  const slideAxisZ = 0;
  const socketRodLength = 3.20;
  const sourceShaftAngle = 0;
  const transverseCenterDistance = shaftAxisY - slideAxisY;
  const minimumTransverseDistance = transverseCenterDistance - crankRadius;
  const maximumTransverseDistance = transverseCenterDistance + crankRadius;
  const slideMaximumX = bentJournalX + Math.sqrt(
    socketRodLength ** 2 - minimumTransverseDistance ** 2,
  );
  const slideMinimumX = bentJournalX + Math.sqrt(
    socketRodLength ** 2 - maximumTransverseDistance ** 2,
  );
  const slideStroke = slideMaximumX - slideMinimumX;

  const stateAtShaftAngle = (
    shaftAngle,
    shaftSpeed = shaftAngularSpeed,
    shaftAcceleration = 0,
  ) => {
    const cosine = Math.cos(shaftAngle);
    const sine = Math.sin(shaftAngle);
    const upperSocket = new THREE.Vector3(
      bentJournalX,
      shaftAxisY - crankRadius * cosine,
      shaftAxisZ - crankRadius * sine,
    );
    const upperSocketVelocity = new THREE.Vector3(
      0,
      crankRadius * shaftSpeed * sine,
      -crankRadius * shaftSpeed * cosine,
    );
    const upperSocketAcceleration = new THREE.Vector3(
      0,
      crankRadius * (
        shaftAcceleration * sine + shaftSpeed ** 2 * cosine
      ),
      crankRadius * (
        -shaftAcceleration * cosine + shaftSpeed ** 2 * sine
      ),
    );
    const transverseY = slideAxisY - upperSocket.y;
    const transverseZ = slideAxisZ - upperSocket.z;
    const transverseDistanceSquared = transverseY ** 2
      + transverseZ ** 2;
    const longitudinalSeparation = Math.sqrt(
      socketRodLength ** 2 - transverseDistanceSquared,
    );
    const slideX = bentJournalX + longitudinalSeparation;
    const lowerSocket = new THREE.Vector3(
      slideX,
      slideAxisY,
      slideAxisZ,
    );
    const slideSpeed = (
      transverseY * upperSocketVelocity.y
      + transverseZ * upperSocketVelocity.z
    ) / longitudinalSeparation;
    const slideAcceleration = (
      -(slideSpeed ** 2)
      - upperSocketVelocity.y ** 2
      - upperSocketVelocity.z ** 2
      + transverseY * upperSocketAcceleration.y
      + transverseZ * upperSocketAcceleration.z
    ) / longitudinalSeparation;
    const lowerSocketVelocity = new THREE.Vector3(slideSpeed, 0, 0);
    const lowerSocketAcceleration = new THREE.Vector3(
      slideAcceleration,
      0,
      0,
    );
    const rodVector = lowerSocket.clone().sub(upperSocket);
    const relativeSocketVelocity = lowerSocketVelocity.clone()
      .sub(upperSocketVelocity);
    const relativeSocketAcceleration = lowerSocketAcceleration.clone()
      .sub(upperSocketAcceleration);
    return {
      halfTurnPose: Math.cos(shaftAngle - sourceShaftAngle) >= 0
        ? 'near-bold-source-half'
        : 'near-dotted-opposite-half',
      longitudinalSeparation,
      lowerSocket,
      lowerSocketAcceleration,
      lowerSocketVelocity,
      relativeSocketAcceleration,
      relativeSocketVelocity,
      rodLengthResidual: rodVector.length() - socketRodLength,
      rodPositionConstraintResidual:
        longitudinalSeparation ** 2 + transverseDistanceSquared
          - socketRodLength ** 2,
      rodVector,
      rodVelocityConstraintResidual: rodVector.dot(
        relativeSocketVelocity,
      ),
      rodAccelerationConstraintResidual:
        relativeSocketVelocity.lengthSq()
          + rodVector.dot(relativeSocketAcceleration),
      shaftAcceleration,
      shaftAngle,
      shaftSpeed,
      slideAcceleration,
      slideDirection: slideSpeed > 1e-10
        ? 'positive-x'
        : slideSpeed < -1e-10
          ? 'negative-x'
          : 'reversal',
      slideDisplacement: slideX - slideMinimumX,
      slideSpeed,
      slideX,
      transverseDistance: Math.sqrt(transverseDistanceSquared),
      transverseDistanceSquared,
      transverseY,
      transverseZ,
      upperSocket,
      upperSocketAcceleration,
      upperSocketVelocity,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...stateAtShaftAngle(
        sourceShaftAngle + shaftAngularSpeed * cycleTime,
      ),
      cycleTime,
      phase: cycleTime / cycleDuration,
    };
  };

  const geometry = {
    bentJournalX,
    crankRadius,
    cycleDuration,
    maximumTransverseDistance,
    minimumTransverseDistance,
    shaftAngularSpeed,
    shaftAxisY,
    shaftAxisZ,
    slideAxisY,
    slideAxisZ,
    slideMaximumX,
    slideMinimumX,
    slideStroke,
    socketRodLength,
    sourceShaftAngle,
    transverseCenterDistance,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.27,
    roughness: 0.52,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.31,
    roughness: 0.42,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.50,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.21,
    roughness: 0.48,
  });
  const socketMaterial = matte(PALETTE.accent, {
    metalness: 0.28,
    roughness: 0.43,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.39 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-bearing-D-and-slide-C-guide-frame';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(6.55, 0.20, 1.42),
    frameMaterial,
  );
  base.position.set(0.10, -2.12, -0.35);
  base.userData.role = 'fixed-machine-foundation';
  fixedFrame.add(base);
  const bearingPost = new THREE.Mesh(
    new THREE.BoxGeometry(.30,2.97,.62),
    frameMaterial,
  );
  bearingPost.position.set(1.35,-.535,-.75);
  bearingPost.userData.role = 'fixed-upright-of-bearing-D';
  fixedFrame.add(bearingPost);
  const bearingSaddle=new THREE.Mesh(new THREE.BoxGeometry(.42,.20,.82),frameMaterial);
  bearingSaddle.position.set(1.35,.90,-.40);
  bearingSaddle.userData.role='rear-bearing-saddle-clear-of-spatial-rod-and-slide';
  fixedFrame.add(bearingSaddle);
  const bearingD = new THREE.Mesh(boredCylinderGeometry(.34,.153,.66),frameMaterial);
  bearingD.rotation.z=Math.PI/2;
  bearingD.position.set(1.35, shaftAxisY, shaftAxisZ);
  bearingD.userData.role = 'fixed-bearing-D-around-shaft-A';
  fixedFrame.add(bearingD);
  const bearingBore = new THREE.Mesh(boredCylinderGeometry(.15,.134,.76),darkMaterial);
  bearingBore.rotation.z=Math.PI/2;
  bearingBore.position.copy(bearingD.position);
  bearingBore.userData.role = 'dark-bearing-D-bore-and-bushing';
  fixedFrame.add(bearingBore);
  const slideRail = new THREE.Mesh(
    new THREE.BoxGeometry(5.15, 0.16, 0.90),
    frameMaterial,
  );
  slideRail.position.set(0.18, slideAxisY - .67, slideAxisZ);
  slideRail.userData.role = 'fixed-single-axis-horizontal-guide-for-C';
  fixedFrame.add(slideRail);
  const guideLipFront = new THREE.Mesh(
    new THREE.BoxGeometry(5.15, .39, .12),
    darkMaterial,
  );
  guideLipFront.position.set(0.18, slideAxisY - .405, .46);
  guideLipFront.userData.role = 'fixed-front-guide-lip-for-slide-C';
  const guideLipRear = guideLipFront.clone();
  guideLipRear.position.z = -.46;
  guideLipRear.userData.role = 'fixed-rear-guide-lip-for-slide-C';
  fixedFrame.add(guideLipFront, guideLipRear);
  const guideKeepers = [-1,1].map(side=>{
    const keeper=new THREE.Mesh(new THREE.BoxGeometry(5.15,.08,.12),darkMaterial);
    keeper.position.set(.18,slideAxisY-.17,side*.38);fixedFrame.add(keeper);return keeper;
  });
  root.add(fixedFrame);

  const shaftRotor = new THREE.Group();
  shaftRotor.position.set(0, shaftAxisY, shaftAxisZ);
  shaftRotor.userData.role = 'continuous-horizontal-shaft-A-rotor';
  const mainShaft = cylinderAlongX(0.13, 3.10, driverMaterial, 38);
  mainShaft.position.x = 1.02;
  mainShaft.userData.role = 'straight-bearing-portion-of-shaft-A';
  shaftRotor.add(mainShaft);
  const inputWheel = torusNormalToX(1.05, 0.10, driverMaterial, 88);
  inputWheel.position.x = 0.42;
  inputWheel.userData.role = 'input-wheel-fast-on-shaft-A';
  shaftRotor.add(inputWheel);
  for (let index = 0; index < 4; index += 1) {
    const phase = index * Math.PI / 4;
    const end = new THREE.Vector3(
      0.42,
      0.91 * Math.cos(phase),
      0.91 * Math.sin(phase),
    );
    const start = new THREE.Vector3(0.42, 0, 0);
    const spoke = cylinderBetween(start, end, 0.045, driverMaterial, 14);
    const opposite = cylinderBetween(
      start,
      end.clone().multiplyScalar(-1).setX(0.42),
      0.045,
      driverMaterial,
      14,
    );
    spoke.userData.role = 'input-wheel-spoke-fast-on-A';
    opposite.userData.role = 'input-wheel-spoke-fast-on-A';
    shaftRotor.add(spoke, opposite);
  }
  const bentWeb = cylinderBetween(
    new THREE.Vector3(-0.20, 0, 0),
    new THREE.Vector3(-0.20, -crankRadius, 0),
    0.12,
    driverMaterial,
    24,
  );
  bentWeb.userData.role = 'radial-bend-at-end-of-shaft-A';
  shaftRotor.add(bentWeb);
  const bentJournal = cylinderAlongX(0.12, 0.90, darkMaterial, 32);
  bentJournal.position.set(bentJournalX, -crankRadius, 0);
  bentJournal.userData.role = 'offset-parallel-bent-journal-of-shaft-A';
  shaftRotor.add(bentJournal);
  const shaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.11, 0.48),
    whiteMaterial,
  );
  shaftIndex.position.set(0.43, -0.82, 0);
  shaftIndex.userData.role = 'white-shaft-A-rotation-index';
  shaftRotor.add(shaftIndex);
  root.add(shaftRotor);

  const slideC = new THREE.Group();
  slideC.position.set(slideMaximumX, slideAxisY, slideAxisZ);
  slideC.userData.role = 'rectilinearly-reciprocating-slide-C';
  const slideBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.36, 0.78),
    drivenMaterial,
  );
  slideBody.position.y = -.40;
  slideBody.userData.role = 'rigid-body-of-slide-C';
  slideC.add(slideBody);
  const lowerBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 24, 18),
    whiteMaterial,
  );
  lowerBall.position.y = 0;
  lowerBall.userData.role = 'white-lower-ball-in-slide-C-socket';
  slideC.add(lowerBall);
  const lowerSocketCup = new THREE.Mesh(lowerSeatGeometry(),socketMaterial);
  lowerSocketCup.userData.role = 'lower-universal-socket-in-slide-C';
  slideC.add(lowerSocketCup);
  const socketFoot=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,.10,32),socketMaterial);
  socketFoot.position.y=-.225;slideC.add(socketFoot);
  const slideIndex = new THREE.Mesh(
    new THREE.BoxGeometry(.20,.012,.44),
    whiteMaterial,
  );
  slideIndex.position.set(.38,-.214,0);
  slideIndex.userData.role = 'white-slide-C-linear-position-index';
  slideC.add(slideIndex);
  root.add(slideC);

  const rodB = makeDynamicRod(
    0.085,
    drivenMaterial,
    'constant-length-oblique-double-socket-rod-B',
  );
  // Only the exposed shank is drawn; the analytic center-to-center length is unchanged.
  rodB.geometry.dispose();
  rodB.geometry = new THREE.CylinderGeometry(.085,.085,1-.30/socketRodLength,32);
  rodB.geometry.translate(0,.05/socketRodLength,0);
  root.add(rodB);
  const ballProfile=[];
  const ballHalfSpan=Math.sqrt(.16**2-.124**2);
  for(let i=0;i<=48;i++){const y=-ballHalfSpan+2*ballHalfSpan*i/48;ballProfile.push(new THREE.Vector2(Math.sqrt(.16**2-y*y),y));}
  ballProfile.push(new THREE.Vector2(.124,ballHalfSpan),new THREE.Vector2(.124,-ballHalfSpan),ballProfile[0].clone());
  const upperBall = new THREE.Mesh(new THREE.LatheGeometry(ballProfile,64),whiteMaterial);
  upperBall.rotation.z=Math.PI/2;
  upperBall.userData.role='white-upper-ball-turning-on-bent-journal-of-A';
  root.add(upperBall);
  const upperSocketCup = new THREE.Mesh(sphericalSeat(.166,.215,.09),socketMaterial);
  upperSocketCup.rotation.z=Math.PI/2;
  upperSocketCup.userData.role='upper-universal-socket-of-rod-B';
  root.add(upperSocketCup);

  const update = (time) => {
    const state = stateAtTime(time);
    shaftRotor.rotation.x = state.shaftAngle;
    slideC.position.x = state.slideX;
    const rodStart = state.upperSocket.clone();
    const rodEnd = state.lowerSocket.clone();
    rodB.userData.setEndpoints(rodStart, rodEnd);
    upperBall.position.copy(state.upperSocket);
    upperSocketCup.position.copy(state.upperSocket);

  };

  const sourceState = stateAtTime(0);
  const oppositeState = stateAtTime(cycleDuration / 2);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 6,
    },
    archetype:
      'horizontal-bent-shaft-transverse-crank-journal-double-ball-socket-oblique-rod-to-single-axis-slide',
    blocks: {
      bearingD, bearingBore, bearingPost, bearingSaddle, slideRail, guideLipFront, guideLipRear, guideKeepers, slideBody, socketFoot,
      bentJournal,
      bentWeb,
      fixedFrame,
      inputWheel,
      lowerBall,
      lowerSocketCup,
      mainShaft,
      rodB,
      shaftRotor,
      slideC,
      upperBall,
      upperSocketCup,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      lowerSocketRotationIndependent: false,
      operatingDegreesOfFreedom: 1,
      rodOrientationIndependent: false,
      slidePositionIndependent: false,
      storedEnergyStates: 0,
      upperSocketRotationIndependent: false,
    },
    dynamics: {
      backlashClearanceElasticityInertiaLoadsAndForcesModeled: false,
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Horizontal shaft A rotates in fixed bearing D. Its bent end carries a parallel offset journal whose center travels in the transverse YZ circle. The upper end of constant-length rod B turns and swivels on that journal; B’s lower end swivels in slide C. Constraining C to one X-directed guide gives exact rectilinear reciprocation from the spatial square-root closure.',
    motion: {
      cycleDuration,
      shaftAngularSpeed,
      shaftTurnsPerCycle: 1,
      slideStroke,
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 417 page marks its Animated control unavailable and supplies only Brown’s static bold/dotted plate.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      bold: {
        shaftAngle: sourceState.shaftAngle,
        slideX: sourceState.slideX,
        upperSocket: sourceState.upperSocket.clone(),
      },
      dottedAfterHalfRevolution: {
        shaftAngle: oppositeState.shaftAngle,
        slideX: oppositeState.slideX,
        upperSocket: oppositeState.upperSocket.clone(),
      },
    },
    sourceReference: {
      brownPlate417: {
        bearingDApproximateBoundsPixels: [290, 115, 457, 395],
        bentShaftAApproximateBoundsPixels: [123, 80, 294, 218],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 12,
        rodBApproximateBoldEndpointsPixels: [[159, 169], [241, 388]],
        slideCApproximateBoldBoundsPixels: [91, 372, 312, 407],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the input is continuous circular motion',
          'shaft A works in fixed bearing D',
          'one end of A is bent',
          'the bent end turns in a socket at the upper end of rod B',
          'the lower end of B works in a socket in slide C',
          'the output of C is rectilinear reciprocation',
          'the dotted pose is exactly half a shaft revolution from the bold pose',
        ],
        engravingEvidence:
          'Brown’s bold view shows a horizontal shaft in the upright bearing D, an offset parallel journal at its left bent end, an oblique rod B descending to slide C, and one horizontal guide. The dotted overlay moves the journal through the opposite transverse half-turn and places B and C in the other extreme pose.',
        reconstructionDisclosure:
          'Brown fixes the spatial topology and half-turn pose relation but gives no dimensions, socket clearances, speed, stroke, or proportions. The shaft height, 0.52 crank radius, 3.20 rod length, guide placement, input wheel, frame, and six-second uniform source cycle are independently engineered; exact three-dimensional rod closure determines C.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 417',
    },
    stateAtShaftAngle,
    stateAtTime,
    transmission: {
      positionConstraint:
        '(slideX-journalX)^2+(slideY-upperY)^2+(slideZ-upperZ)^2=rodLength^2',
      slideLaw:
        'slideX=journalX+sqrt(rodLength^2-transverseDistance^2)',
      socketConstraint:
        'both ends of B are spherical sockets, so B changes spatial orientation without constraining A or C to a common plane',
      velocityConstraint:
        'rodVector dot (lowerSocketVelocity-upperSocketVelocity)=0',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.55, -2.28, -1.48),
    new THREE.Vector3(2.75, 2.55, 1.48),
  );
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraDirection = new THREE.Vector3(6, 2.8, 12);
  root.userData.groundFloorY = -2.28;
  markShadows(root);
  base.receiveShadow = true;
  fitPistonGuide(root, update, cycleDuration);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredBentShaftSlideMovement(movement) {
  if (movement.id !== 417) return null;
  return bentShaftSlide(movement);
}
