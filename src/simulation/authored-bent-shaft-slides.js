import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import {boredCylinderGeometry, fitPistonGuide} from './piston-guide-parts.js';

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

  // Brown's side elevation: a plank bed, the T standard D carrying the long
  // bearing sleeve at the crank end, and slide C as a sectioned bar lying on
  // the plank with B's socket between its two blocks. No rails are drawn.
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-bearing-D-and-slide-C-guide-frame';
  const plankTopY = slideAxisY - .25;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(6.10, 0.30, 1.10),
    frameMaterial,
  );
  base.position.set(0.95, plankTopY - .15, 0);
  base.userData.role = 'fixed-plank-bed-and-guide-for-slide-C';
  fixedFrame.add(base);
  const bearingX = 3.20;
  const bearingHalfLength = .75;
  const bearingOuterRadius = .30;
  const standardShape = new THREE.Shape();
  const standardTop = shaftAxisY - bearingOuterRadius + .02;
  standardShape.moveTo(bearingX - .42, plankTopY);
  standardShape.lineTo(bearingX + .42, plankTopY);
  standardShape.lineTo(bearingX + .42, plankTopY + .14);
  standardShape.lineTo(bearingX + .22, plankTopY + .20);
  standardShape.lineTo(bearingX + .22, standardTop - .75);
  standardShape.quadraticCurveTo(bearingX + .22, standardTop - .10, bearingX + .70, standardTop);
  standardShape.lineTo(bearingX - .70, standardTop);
  standardShape.quadraticCurveTo(bearingX - .22, standardTop - .10, bearingX - .22, standardTop - .75);
  standardShape.lineTo(bearingX - .22, plankTopY + .20);
  standardShape.lineTo(bearingX - .42, plankTopY + .14);
  standardShape.closePath();
  const standardGeometry = new THREE.ExtrudeGeometry(standardShape, {depth: .50, bevelEnabled: false, curveSegments: 16});
  standardGeometry.translate(0, 0, -.25);
  const bearingPost = new THREE.Mesh(standardGeometry, frameMaterial);
  bearingPost.userData.role = 'fixed-T-standard-D-under-bearing';
  fixedFrame.add(bearingPost);
  const bearingD = new THREE.Mesh(boredCylinderGeometry(bearingOuterRadius,.153,2*bearingHalfLength),frameMaterial);
  bearingD.rotation.z=Math.PI/2;
  bearingD.position.set(bearingX, shaftAxisY, shaftAxisZ);
  bearingD.userData.role = 'fixed-bearing-D-around-shaft-A';
  fixedFrame.add(bearingD);
  const bearingBore = new THREE.Mesh(boredCylinderGeometry(.15,.134,2*bearingHalfLength+.04),darkMaterial);
  bearingBore.rotation.z=Math.PI/2;
  bearingBore.position.copy(bearingD.position);
  bearingBore.userData.role = 'dark-bearing-D-bore-and-bushing';
  fixedFrame.add(bearingBore);
  root.add(fixedFrame);

  const shaftRotor = new THREE.Group();
  shaftRotor.position.set(0, shaftAxisY, shaftAxisZ);
  shaftRotor.userData.role = 'continuous-horizontal-shaft-A-rotor';
  const shaftLeft = -0.20;
  const shaftRight = bearingX + bearingHalfLength + .38;
  const mainShaft = cylinderAlongX(0.13, shaftRight - shaftLeft, driverMaterial, 38);
  mainShaft.position.x = (shaftLeft + shaftRight) / 2;
  mainShaft.userData.role = 'straight-bearing-portion-of-shaft-A';
  shaftRotor.add(mainShaft);
  // Brown's crank handle on the outer end of A (in place of an input wheel).
  const crankArmLength = .78;
  const crankX = shaftRight - .06;
  const inputWheel = new THREE.Mesh(new THREE.BoxGeometry(.12, crankArmLength + .22, .20), driverMaterial);
  inputWheel.position.set(crankX + .12, crankArmLength / 2, 0);
  inputWheel.userData.role = 'input-crank-arm-fast-on-shaft-A';
  shaftRotor.add(inputWheel);
  const crankHandle = cylinderAlongX(.055, .42, darkMaterial, 20);
  crankHandle.position.set(crankX + .39, crankArmLength, 0);
  crankHandle.userData.role = 'input-crank-handle-on-arm';
  shaftRotor.add(crankHandle);
  const crankKnob = new THREE.Mesh(new THREE.SphereGeometry(.10, 20, 14), darkMaterial);
  crankKnob.scale.set(1.5, 1, 1);
  crankKnob.position.set(crankX + .62, crankArmLength, 0);
  crankKnob.userData.role = 'input-crank-handle-knob';
  shaftRotor.add(crankKnob);
  const bentWeb = cylinderBetween(
    new THREE.Vector3(-0.20, 0, 0),
    new THREE.Vector3(-0.20, -crankRadius, 0),
    0.12,
    driverMaterial,
    24,
  );
  bentWeb.userData.role = 'radial-bend-at-end-of-shaft-A';
  shaftRotor.add(bentWeb);
  // The journal runs on through the full length of head A to its washer.
  const journalLeft = bentJournalX - .62, journalRight = -.20;
  const bentJournal = cylinderAlongX(0.12, journalRight - journalLeft, darkMaterial, 32);
  bentJournal.position.set((journalLeft + journalRight) / 2, -crankRadius, 0);
  bentJournal.userData.role = 'offset-parallel-bent-journal-of-shaft-A';
  shaftRotor.add(bentJournal);
  root.add(shaftRotor);

  // Slide C: Brown's sectioned bar, two blocks either side of B's socket,
  // joined under the seat; it lies on the plank bed.
  const slideC = new THREE.Group();
  slideC.position.set(slideMaximumX, slideAxisY, slideAxisZ);
  slideC.userData.role = 'rectilinearly-reciprocating-slide-C';
  const slideTop = .20;
  const slideBottom = -.25;
  const slideBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, slideTop - slideBottom, 0.70),
    drivenMaterial,
  );
  slideBody.position.set(-.45 - 1.55 / 2, (slideTop + slideBottom) / 2, 0);
  slideBody.userData.role = 'rigid-body-of-slide-C';
  const slideFront = new THREE.Mesh(
    new THREE.BoxGeometry(.62, slideTop - slideBottom, 0.70),
    drivenMaterial,
  );
  slideFront.position.set(.23 + .31, (slideTop + slideBottom) / 2, 0);
  slideFront.userData.role = 'rigid-body-of-slide-C';
  const slideBridge = new THREE.Mesh(
    new THREE.BoxGeometry(.68, .045, 0.70),
    drivenMaterial,
  );
  slideBridge.position.set((-.45 + .23) / 2, slideBottom + .0225, 0);
  slideBridge.userData.role = 'rigid-body-of-slide-C';
  slideC.add(slideBody, slideFront, slideBridge);
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
  root.add(slideC);

  const rodB = makeDynamicRod(
    0.085,
    drivenMaterial,
    'constant-length-oblique-double-socket-rod-B',
  );
  // Only the exposed shank is drawn; the analytic center-to-center length is
  // unchanged. It starts inside head A's boss, clear of the bent journal.
  const shankStart = .40, shankEnd = .10;
  rodB.geometry.dispose();
  rodB.geometry = new THREE.CylinderGeometry(.085,.085,1-(shankStart+shankEnd)/socketRodLength,32);
  rodB.geometry.translate(0,(shankStart-shankEnd)/2/socketRodLength,0);
  root.add(rodB);
  // Rod B keeps its local X in the plane of B and the bent journal, so the
  // journal only swings about B's local Z inside head A (by ±half the range
  // of B's inclination to the shaft) and never twists across it.
  const inclination = (distance) => Math.acos(Math.sqrt(socketRodLength ** 2 - distance ** 2) / socketRodLength);
  const minimumInclination = inclination(minimumTransverseDistance);
  const maximumInclination = inclination(maximumTransverseDistance);
  const meanInclination = (minimumInclination + maximumInclination) / 2;
  const headSwing = (maximumInclination - minimumInclination) / 2;
  geometry.headAxisInclinationToRodB = meanInclination;
  geometry.journalSwingInHeadA = headSwing;
  // Brown's head A: the thick, tapered socket block at B's upper end turning
  // on the bent end of A, with a collar towards D and a washer at its outer
  // end. Its hourglass bore clears the journal through the whole swing.
  const boreAt = (axial) => .14 + Math.tan(headSwing) * 1.03 * Math.abs(axial);
  const headProfile = [
    [.40,-.62],[.40,-.55],[.36,-.54],[.42,.06],[.44,.07],[.44,.20],
  ].map(([r,y])=>new THREE.Vector2(r,y));
  for (let i = 0; i <= 32; i += 1) {
    const axial = .20 - .82 * i / 32;
    headProfile.push(new THREE.Vector2(boreAt(axial), axial));
  }
  headProfile.push(headProfile[0].clone());
  const headGeometry = new THREE.LatheGeometry(headProfile, 64);
  headGeometry.rotateZ(-meanInclination);
  const upperSocketCup = new THREE.Mesh(headGeometry, drivenMaterial);
  upperSocketCup.userData.role='upper-universal-socket-of-rod-B';
  root.add(upperSocketCup);
  // The boss joining head A to B's shank; it starts far enough down B to
  // clear the journal at B's steepest inclination to it.
  const bossGeometry = new THREE.CylinderGeometry(.095, .15, .29, 32);
  bossGeometry.translate(0, .41 + .145, 0);
  const headBoss = new THREE.Mesh(bossGeometry, drivenMaterial);
  headBoss.userData.role = 'boss-of-head-A-joining-rod-B';
  root.add(headBoss);
  // The journal's bearing bush inside head A (hidden by the head).
  const upperBall = new THREE.Mesh(boredCylinderGeometry(.128,.124,.07),darkMaterial);
  upperBall.rotation.z=Math.PI/2;
  upperBall.userData.role='bearing-bush-of-head-A-on-bent-journal';

  root.add(upperBall);
  const rodBasis = new THREE.Matrix4();
  const rodAxis = new THREE.Vector3();
  const rodSide = new THREE.Vector3();
  const rodNormal = new THREE.Vector3();

  const update = (time) => {
    const state = stateAtTime(time);
    shaftRotor.rotation.x = state.shaftAngle;
    slideC.position.x = state.slideX;
    const rodStart = state.upperSocket.clone();
    const rodEnd = state.lowerSocket.clone();
    rodB.userData.setEndpoints(rodStart, rodEnd);
    rodAxis.copy(rodEnd).sub(rodStart).normalize();
    rodSide.set(1, 0, 0).addScaledVector(rodAxis, -rodAxis.x).normalize();
    rodNormal.crossVectors(rodSide, rodAxis);
    rodB.quaternion.setFromRotationMatrix(rodBasis.makeBasis(rodSide, rodAxis, rodNormal));
    upperBall.position.copy(state.upperSocket);
    upperSocketCup.position.copy(state.upperSocket);
    upperSocketCup.quaternion.copy(rodB.quaternion);
    headBoss.position.copy(state.upperSocket);
    headBoss.quaternion.copy(rodB.quaternion);
    // The lower ball is forged on rod B's end: it turns with the rod in its
    // socket in C (slide C does not rotate, so the local turn is the rod's).
    lowerBall.quaternion.copy(rodB.quaternion);
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
      bearingD, bearingBore, bearingPost, base, slideBody, slideFront, slideBridge, crankHandle, crankKnob,
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
      headBoss,
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
          'Brown fixes the spatial topology and half-turn pose relation but gives no dimensions, socket clearances, speed, stroke, or proportions. The shaft height, 0.52 crank radius, 3.20 rod length, plank and T-standard proportions, crank handle, and six-second uniform source cycle are independently engineered; exact three-dimensional rod closure determines C.',
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
  // Brown draws a flat side elevation.
  root.userData.cameraDirection = new THREE.Vector3(0, 0.06, 1);
  root.userData.groundFloorY = slideAxisY - .55;
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
