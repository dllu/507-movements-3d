import * as THREE from 'three';
import {
  PALETTE,
  makeDynamicLink,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function torusAboutY(radius, tube, material, radialSegments = 64) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 12, radialSegments),
    material,
  );
  torus.rotation.x = Math.PI / 2;
  return torus;
}

function makeStationaryLens({
  darkMaterial,
  lensMaterial,
  lensRadius,
  whiteMaterial,
}) {
  const lens = new THREE.Group();
  lens.userData.role =
    'stationary-spherical-lens-concentric-with-upright-shaft';
  const hemisphere = new THREE.Mesh(
    new THREE.SphereGeometry(
      lensRadius,
      64,
      28,
      0,
      FULL_TURN,
      0,
      Math.PI / 2,
    ),
    lensMaterial,
  );
  hemisphere.userData.role = 'fixed-convex-spherical-work-surface';
  lens.add(hemisphere);
  const equator = torusAboutY(lensRadius, 0.055, darkMaterial, 72);
  equator.userData.role = 'fixed-lens-equator-and-work-holder-rim';
  lens.add(equator);

  const fixedSurfaceIndexes = [];
  for (const [azimuth, colatitude] of [
    [-1.70, 0.93],
    [0.20, 1.03],
    [2.45, 0.84],
  ]) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 10),
      whiteMaterial,
    );
    marker.position.set(
      lensRadius * Math.sin(colatitude) * Math.cos(azimuth),
      lensRadius * Math.cos(colatitude),
      lensRadius * Math.sin(colatitude) * Math.sin(azimuth),
    );
    marker.userData.role = 'white-fixed-index-on-stationary-lens';
    lens.add(marker);
    fixedSurfaceIndexes.push(marker);
  }
  lens.userData.equator = equator;
  lens.userData.fixedSurfaceIndexes = fixedSurfaceIndexes;
  lens.userData.hemisphere = hemisphere;
  return markShadows(lens);
}

function makePolishingCup({
  capAngle,
  cupMaterial,
  darkMaterial,
  lensRadius,
  outerRadius,
  polishingMaterial,
  renderContactGap,
  whiteMaterial,
}) {
  const cupRotor = new THREE.Group();
  cupRotor.userData.role =
    'freely-spinning-eccentric-polishing-cup-on-ball-and-socket';

  const outerShell = new THREE.Mesh(
    new THREE.SphereGeometry(
      outerRadius,
      64,
      26,
      0,
      FULL_TURN,
      0,
      capAngle,
    ),
    cupMaterial,
  );
  outerShell.position.y = -outerRadius;
  outerShell.userData.role = 'convex-outer-shell-of-polishing-cup';
  cupRotor.add(outerShell);

  const polishingRadius = lensRadius + renderContactGap;
  const polishingLayer = new THREE.Mesh(
    new THREE.SphereGeometry(
      polishingRadius,
      64,
      24,
      0,
      FULL_TURN,
      0,
      capAngle,
    ),
    polishingMaterial,
  );
  polishingLayer.position.y = -outerRadius;
  polishingLayer.userData.role =
    'inner-polishing-material-facing-stationary-lens';
  cupRotor.add(polishingLayer);

  const rimRadius = outerRadius * Math.sin(capAngle);
  const rimY = outerRadius * (Math.cos(capAngle) - 1);
  const rim = torusAboutY(rimRadius, 0.075, darkMaterial, 72);
  rim.position.y = rimY;
  rim.userData.role = 'circular-mouth-rim-of-eccentric-polishing-cup';
  cupRotor.add(rim);

  const socket = torusAboutY(0.18, 0.065, darkMaterial, 36);
  socket.position.y = -0.055;
  socket.userData.role =
    'socket-ring-free-to-turn-about-ball-joint-axis';
  cupRotor.add(socket);
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.17, 0.23, 28),
    cupMaterial,
  );
  neck.position.y = -0.15;
  neck.userData.role = 'short-cup-neck-below-ball-socket';
  cupRotor.add(neck);

  const materialIndexColatitude = capAngle * 0.73;
  const materialIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.080, 18, 12),
    whiteMaterial,
  );
  materialIndex.position.set(
    outerRadius * Math.sin(materialIndexColatitude),
    outerRadius * (Math.cos(materialIndexColatitude) - 1),
    0,
  );
  materialIndex.userData.role =
    'white-material-index-exposing-cup-spin-about-own-axis';
  cupRotor.add(materialIndex);
  const radialIndex = new THREE.Mesh(
    new THREE.BoxGeometry(rimRadius * 0.62, 0.038, 0.055),
    whiteMaterial,
  );
  radialIndex.position.set(rimRadius * 0.34, rimY - 0.015, 0);
  radialIndex.userData.role = 'white-radial-index-on-spinning-cup-rim';
  cupRotor.add(radialIndex);

  cupRotor.userData.capAngle = capAngle;
  cupRotor.userData.materialIndex = materialIndex;
  cupRotor.userData.materialIndexColatitude = materialIndexColatitude;
  cupRotor.userData.outerShell = outerShell;
  cupRotor.userData.polishingLayer = polishingLayer;
  cupRotor.userData.polishingRadius = polishingRadius;
  cupRotor.userData.radialIndex = radialIndex;
  cupRotor.userData.rim = rim;
  cupRotor.userData.rimRadius = rimRadius;
  cupRotor.userData.rimY = rimY;
  cupRotor.userData.socket = socket;
  return markShadows(cupRotor);
}

function eccentricLensPolisher(movement) {
  const root = new THREE.Group();

  // Brown specifies the topology but supplies no animation, dimensions, or
  // passive cup-spin rate.  The cup is modeled as a conformal spherical cap.
  // Its free axial spin uses rotation-minimizing (zero-twist) transport:
  // omega_cup dot n = Omega*cos(beta) + psiDot = 0.
  const lensCenter = new THREE.Vector3(0, 0, 0);
  const lensRadius = 1.38;
  const cupOuterRadius = 1.50;
  const cupCapAngle = 0.72;
  const eccentricTilt = 0.34;
  const renderContactGap = 0.028;
  const carrierOrbitRadius = cupOuterRadius * Math.sin(eccentricTilt);
  const ballJointHeight = cupOuterRadius * Math.cos(eccentricTilt);
  const shaftOrbitDuration = 6;
  const shaftAngularSpeed = FULL_TURN / shaftOrbitDuration;
  const cupRelativeSpinRatio = -Math.cos(eccentricTilt);
  const cupRelativeSpinRate = cupRelativeSpinRatio * shaftAngularSpeed;
  const maximumSurfaceColatitude = eccentricTilt + cupCapAngle;
  const tableTopY = -0.10;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.56,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.54,
    side: THREE.DoubleSide,
  });
  const polishingMaterial = matte(PALETTE.brass, {
    metalness: 0.12,
    roughness: 0.66,
    side: THREE.DoubleSide,
  });
  const lensMaterial = matte(0x91b8c3, {
    metalness: 0.05,
    opacity: 0.84,
    roughness: 0.34,
    transparent: true,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.45,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const frame = new THREE.Group();
  frame.userData.role =
    'fixed-table-lens-holder-and-upright-shaft-bearing-frame';
  const table = new THREE.Mesh(
    new THREE.BoxGeometry(5.35, 0.24, 3.35),
    frameMaterial,
  );
  table.position.set(0, tableTopY - 0.12, 0);
  table.userData.role = 'fixed-polishing-machine-work-table';
  frame.add(table);
  const rearPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 4.35, 0.40),
    frameMaterial,
  );
  rearPost.position.set(-2.12, 1.77, -0.83);
  rearPost.userData.role = 'fixed-overhead-bearing-standard';
  frame.add(rearPost);
  const overhead = new THREE.Mesh(
    new THREE.BoxGeometry(2.28, 0.25, 0.40),
    frameMaterial,
  );
  overhead.position.set(-1.10, 3.86, -0.83);
  overhead.userData.role = 'fixed-overhead-shaft-bearing-arm';
  frame.add(overhead);
  const upperBearing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.32, 32),
    darkMaterial,
  );
  upperBearing.position.set(0, 3.82, -0.01);
  upperBearing.userData.role = 'fixed-bearing-around-upright-rotating-shaft';
  frame.add(upperBearing);
  root.add(markShadows(frame));

  const lens = makeStationaryLens({
    darkMaterial,
    lensMaterial,
    lensRadius,
    whiteMaterial,
  });
  lens.position.copy(lensCenter);
  root.add(lens);

  const shaftRotor = new THREE.Group();
  shaftRotor.userData.role =
    'rotating-upright-shaft-concentric-with-lens-and-work-body';
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 2.34, 28),
    darkMaterial,
  );
  shaft.position.y = 3.03;
  shaft.userData.role = 'upright-input-shaft';
  shaftRotor.add(shaft);
  const handwheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.72, 0.23, 48),
    driverMaterial,
  );
  handwheel.position.y = 4.28;
  handwheel.userData.role = 'input-handwheel-fast-on-upright-shaft';
  shaftRotor.add(handwheel);
  const handwheelRim = torusAboutY(0.72, 0.055, darkMaterial, 64);
  handwheelRim.position.y = 4.39;
  handwheelRim.userData.role = 'upright-shaft-handwheel-rim';
  shaftRotor.add(handwheelRim);
  const shaftIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 16, 10),
    whiteMaterial,
  );
  shaftIndex.position.set(0.52, 4.41, 0);
  shaftIndex.userData.role = 'white-upright-shaft-orbit-index';
  shaftRotor.add(shaftIndex);

  const ballLocal = new THREE.Vector3(
    carrierOrbitRadius,
    ballJointHeight,
    0,
  );
  const upperBend = new THREE.Vector3(0, 2.70, 0);
  const lowerBend = new THREE.Vector3(0.44, 2.24, 0);
  const bentArmUpper = makeDynamicLink({
    color: PALETTE.driver,
    depth: 0.24,
    jointRadius: 0.055,
    thickness: 0.16,
  });
  bentArmUpper.userData.setEndpoints(upperBend, lowerBend);
  bentArmUpper.userData.role =
    'upper-leg-of-bent-metal-carrier-piece';
  shaftRotor.add(bentArmUpper);
  const bentArmLower = makeDynamicLink({
    color: PALETTE.driver,
    depth: 0.24,
    jointRadius: 0.055,
    thickness: 0.16,
  });
  bentArmLower.userData.setEndpoints(lowerBend, ballLocal);
  bentArmLower.userData.role =
    'lower-leg-of-bent-metal-carrier-to-ball-joint';
  shaftRotor.add(bentArmLower);
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 28, 18),
    darkMaterial,
  );
  ball.position.copy(ballLocal);
  ball.userData.role = 'ball-fast-with-bent-carrier-piece';
  shaftRotor.add(ball);
  root.add(markShadows(shaftRotor));

  const tiltFrame = new THREE.Group();
  tiltFrame.position.copy(ballLocal);
  tiltFrame.rotation.z = -eccentricTilt;
  tiltFrame.userData.role =
    'ball-and-socket-axis-kept-radial-to-spherical-work';
  shaftRotor.add(tiltFrame);
  const cupRotor = makePolishingCup({
    capAngle: cupCapAngle,
    cupMaterial: drivenMaterial,
    darkMaterial,
    lensRadius,
    outerRadius: cupOuterRadius,
    polishingMaterial,
    renderContactGap,
    whiteMaterial,
  });
  tiltFrame.add(cupRotor);

  const carrierQuaternionAt = (carrierAngle) => new THREE.Quaternion()
    .setFromAxisAngle(Y_AXIS, carrierAngle);
  const tiltQuaternion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    -eccentricTilt,
  );
  const stateAtTime = (time) => {
    const carrierAngle = shaftAngularSpeed * time;
    const relativeCupSpin = cupRelativeSpinRatio * carrierAngle;
    const carrierQuaternion = carrierQuaternionAt(carrierAngle);
    const axis = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(tiltQuaternion)
      .applyQuaternion(carrierQuaternion)
      .normalize();
    const ballCenter = lensCenter.clone()
      .addScaledVector(axis, cupOuterRadius);
    const cupQuaternion = carrierQuaternion.clone()
      .multiply(tiltQuaternion)
      .multiply(new THREE.Quaternion().setFromAxisAngle(
        Y_AXIS,
        relativeCupSpin,
      ));
    const materialIndexLocal = cupRotor.userData.materialIndex.position;
    const materialIndexWorld = materialIndexLocal.clone()
      .applyQuaternion(cupQuaternion)
      .add(ballCenter);
    const totalAngularVelocity = Y_AXIS.clone()
      .multiplyScalar(shaftAngularSpeed)
      .addScaledVector(axis, cupRelativeSpinRate);
    return {
      ballCenter,
      carrierAngle,
      carrierOrbitRadius,
      cupAxis: axis,
      cupQuaternion,
      cupRelativeSpin: relativeCupSpin,
      cupRelativeSpinRate,
      cycleTime: positiveModulo(time, shaftOrbitDuration),
      materialIndexWorld,
      orbitPhase: positiveModulo(carrierAngle / FULL_TURN, 1),
      polishingSurfaceCenter: lensCenter.clone(),
      surfaceNormalSpinRate: totalAngularVelocity.dot(axis),
      totalCupAngularVelocity: totalAngularVelocity,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    shaftRotor.rotation.y = state.carrierAngle;
    cupRotor.rotation.y = state.cupRelativeSpin;
    root.updateMatrixWorld(true);
    root.userData.contacts = {
      ballAndSocket: {
        ballCenterError: ball.getWorldPosition(new THREE.Vector3())
          .distanceTo(state.ballCenter),
        closed: true,
        cupAxis: state.cupAxis.clone(),
      },
      polishingCupToSphericalLens: {
        idealNormalGap: 0,
        renderSeparation: renderContactGap,
        rotationMinimizingResidual: state.surfaceNormalSpinRate,
        sphericalCenterError: state.polishingSurfaceCenter
          .distanceTo(lensCenter),
      },
    };
    root.userData.kinematics = state;
  };

  root.userData = {
    archetype:
      'eccentric-ball-and-socket-spherical-lens-polishing-cup-orbit-with-passive-zero-twist-spin',
    blocks: {
      ball,
      bentArmLower,
      bentArmUpper,
      cupRotor,
      frame,
      handwheel,
      lens,
      shaft,
      shaftIndex,
      shaftRotor,
      tiltFrame,
    },
    constraintResiduals: {
      capRemainsAboveTable:
        Math.max(0, maximumSurfaceColatitude - Math.PI / 2),
      conformalCupCenter:
        cupOuterRadius - ballLocal.length(),
      orbitRadius:
        carrierOrbitRadius
          - cupOuterRadius * Math.sin(eccentricTilt),
      zeroTwistRate:
        shaftAngularSpeed * Math.cos(eccentricTilt)
          + cupRelativeSpinRate,
    },
    constraints: {
      ballOrbit:
        'The carrier ball remains at fixed radius on a latitude about the upright shaft and stationary spherical lens center.',
      cupAxis:
        'The ball-and-socket cup axis is the radial unit vector from the lens center to the orbiting ball.',
      sphericalConformity:
        'The cup shell and polishing layer are spherical caps centered on the same point as the stationary lens; a small radial render gap exposes both surfaces.',
      zeroTwistTransport:
        'Passive cup spin cancels the upright-shaft angular-velocity component along the instantaneous cup axis.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'ball-joint azimuth about lens axis',
        'radial cup-axis orientation',
        'passive cup spin about ball-and-socket axis',
        'polishing material index trajectory',
      ],
      independentPrescribedInputs: 1,
      inputs: ['uniform rotation of the upright concentric shaft'],
      note:
        'Cup axial rotation is not a second motor input; it is the passive zero-twist response of the freely turning ball-and-socket cup.',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid upright shaft and bent carrier',
        'perfect spherical work and conformal polishing cup',
        'clearance-free ball-and-socket orientation with free axial rotation',
        'distributed friction replaced by rotation-minimizing zero-twist transport',
        'contact pressure, abrasive wear, slip, compliance, and inertia omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless kinematic reconstruction',
    },
    fidelity: 'authored',
    geometry: {
      ballJointHeight,
      carrierOrbitRadius,
      cupCapAngle,
      cupOuterRadius,
      eccentricTilt,
      lensCenter: lensCenter.clone(),
      lensRadius,
      maximumSurfaceColatitude,
      polishingRadius: cupRotor.userData.polishingRadius,
      renderContactGap,
      tableTopY,
    },
    mechanism:
      'one-upright-shaft-concentric-with-a-stationary-spherical-lens-rotates-one-bent-carrier-and-eccentric-ball-joint-so-one-conformal-polishing-cup-both-revolves-about-the-common-axis-and-passively-spins-about-its-own-radial-axis',
    motion: {
      carrierOrbitDuration: shaftOrbitDuration,
      cupRelativeSpinRate,
      cupSpinLaw: 'psi=-cos(beta)*phi',
      inputCycleDuration: shaftOrbitDuration,
      shaftAngularSpeed,
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 393 page marks Animated unavailable and contains no canvas model.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate393: {
        ballJointPixels: [233, 222],
        cupApproximateMouthRadiusPixels: 79,
        imageHeight: 525,
        imageWidth: 525,
        lensAxisPixelsX: 260,
        measurementUncertaintyPixels: 11,
        shaftLowerPivotPixels: [260, 139],
        tableSurfacePixelsY: 344,
        topHandwheelCenterPixels: [260, 35],
      },
      constructionEvidence: {
        engravingEvidence:
          'The side plate shows the upright shaft over the spherical work axis, an offset bent carrier ending in a ball joint, a domed cup set obliquely on the lens, and a fixed work table.',
        explicitInBrownDescription: [
          'polishing material carried in a cup',
          'cup connected by ball-and-socket joint and bent metal piece',
          'upright shaft concentric with the body being polished',
          'eccentric cup revolves about the common shaft/work axis',
          'cup also rotates independently about its own universal-joint axis',
          'changing material-to-work contact prevents repeated paths',
        ],
        reconstructionDisclosure:
          'No official animation or spin ratio is supplied. Dimensions and timing are independently scaled from the engraving; passive spin uses an explicit rotation-minimizing zero-twist idealization rather than an unsupported arbitrary rate.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 393',
    },
    stateAtTime,
    timeline: {
      carrierOrbitDuration: shaftOrbitDuration,
      cupRelativeSpinPerOrbit: FULL_TURN * cupRelativeSpinRatio,
    },
    transmission: {
      axisLaw:
        'n=Ry(phi)*Rz(-beta)*vertical and B=O+R_cup*n',
      orbitLaw:
        'rho=R_cup*sin(beta), with the upright shaft and work sharing centerline O',
      passiveSpinLaw:
        'psiDot=-Omega*cos(beta), hence (Omega*vertical+psiDot*n) dot n=0',
      surfaceCoverage:
        'after each carrier orbit the cup material index advances by -2*pi*cos(beta) relative to the cup axis frame',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.85, -0.62, -2.05),
    new THREE.Vector3(2.85, 4.65, 2.05),
  );
  root.userData.cameraDistanceScale = 1.12;
  root.userData.cameraDirection = new THREE.Vector3(7.8, 4.1, 9.8);
  root.userData.groundFloorY = -0.43;
  update(0);
  return { root, update };
}

export function createAuthoredLensPolisherMovement(movement) {
  if (movement.id !== 393) return null;
  return eccentricLensPolisher(movement);
}
