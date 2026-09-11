import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function makeAnnularExtrusion(innerRadius, outerRadius, depth) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 96,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function makePolarExtrusion(radiusAtAngle, depth, samples = 128) {
  const shape = new THREE.Shape();
  for (let sample = 0; sample <= samples; sample += 1) {
    const angle = FULL_TURN * sample / samples;
    const radius = radiusAtAngle(angle);
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (sample === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function makeTube(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const tube = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(curve, 88, radius, 18, false),
    material,
  ), role);
  tube.userData.curve = curve;
  return tube;
}

function caryRotaryPump(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6.2;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const sourceRotorAngle = Math.PI / 4;
  const casingInnerRadius = 2.30;
  const casingOuterRadius = 2.58;
  const casingDepth = 0.78;
  const drumInnerRadius = 1.20;
  const drumOuterRadius = 1.58;
  const camMeanRadius = 0.78;
  const camLiftAmplitude = 0.36;
  const camMinimumRadius = camMeanRadius - camLiftAmplitude;
  const camMaximumRadius = camMeanRadius + camLiftAmplitude;
  const pistonLength = casingInnerRadius - camMaximumRadius;
  const pistonCount = 2;
  const separatorCenterAngle = -Math.PI / 2;
  const separatorHalfAngle = THREE.MathUtils.degToRad(18);
  const separatorClearance = 0.035;
  const groundY = -3.78;

  const camRadiusAtAngle = (angle) => camMeanRadius
    + camLiftAmplitude * Math.sin(angle);

  const pistonTipRadiusAtAngle = (angle) => camRadiusAtAngle(angle)
    + pistonLength;

  const angularDistance = (left, right) => Math.abs(
    THREE.MathUtils.euclideanModulo(left - right + Math.PI, FULL_TURN)
      - Math.PI,
  );

  const separatorInnerRadiusAtAngle = (angle) => {
    if (angularDistance(angle, separatorCenterAngle)
      > separatorHalfAngle) return casingInnerRadius;
    return Math.min(
      casingInnerRadius,
      pistonTipRadiusAtAngle(angle) + separatorClearance,
    );
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const phase = THREE.MathUtils.euclideanModulo(
      inputAngle / FULL_TURN,
      1,
    );
    const cycleAngle = FULL_TURN * phase;
    const rotorAngle = sourceRotorAngle - cycleAngle;
    const rotorAngularSpeed = -inputSpeed;
    const rotorAngularAcceleration = -inputAcceleration;
    const pistons = Array.from({ length: pistonCount }, (_, index) => {
      const absoluteAngle = rotorAngle + index * Math.PI;
      const camRadius = camRadiusAtAngle(absoluteAngle);
      const camRadiusVelocity = camLiftAmplitude
        * Math.cos(absoluteAngle) * rotorAngularSpeed;
      const camRadiusAcceleration = camLiftAmplitude * (
        -Math.sin(absoluteAngle) * rotorAngularSpeed ** 2
          + Math.cos(absoluteAngle) * rotorAngularAcceleration
      );
      const tipRadius = camRadius + pistonLength;
      const extensionFromSeat = tipRadius - drumOuterRadius;
      const followerPoint = new THREE.Vector3(
        camRadius * Math.cos(absoluteAngle),
        camRadius * Math.sin(absoluteAngle),
        0,
      );
      const tipPoint = new THREE.Vector3(
        tipRadius * Math.cos(absoluteAngle),
        tipRadius * Math.sin(absoluteAngle),
        0,
      );
      const separatorInnerRadius = separatorInnerRadiusAtAngle(
        absoluteAngle,
      );
      const oppositePortSeparator = angularDistance(
        absoluteAngle,
        separatorCenterAngle,
      ) <= separatorHalfAngle;
      return {
        absoluteAngle,
        camRadius,
        camRadiusAcceleration,
        camRadiusVelocity,
        extensionFromSeat,
        followerPoint,
        index,
        oppositePortSeparator,
        separatorInnerRadius,
        tipPoint,
        tipRadius,
        touchesCasing: Math.abs(tipRadius - casingInnerRadius) < 1e-12,
      };
    });
    const retractedPistonIndex = pistons[0].tipRadius
      <= pistons[1].tipRadius ? 0 : 1;
    const extendedPistonIndex = 1 - retractedPistonIndex;
    const idealAnnularAreaPerRadian = 0.5 * (
      casingInnerRadius ** 2 - drumOuterRadius ** 2
    );
    const schematicSweptFlowRate = idealAnnularAreaPerRadian
      * casingDepth * Math.max(0, -rotorAngularSpeed);
    return {
      clockwise: rotorAngularSpeed < 0,
      dischargeEntryPort: 'M',
      dischargePipe: 'H',
      extendedPistonIndex,
      inletChamberPort: 'L',
      inputAcceleration,
      inputAngle: cycleAngle,
      inputSpeed,
      phase,
      pistons,
      retractedPistonIndex,
      rotorAngle,
      rotorAngularAcceleration,
      rotorAngularSpeed,
      schematicSweptFlowRate,
      suctionPipe: 'F',
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
    inputAngularSpeed,
    0,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.24,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const drumMaterial = matte(PALETTE.driver, {
    opacity: 0.50,
    roughness: 0.54,
    side: THREE.DoubleSide,
    transparent: true,
  });
  drumMaterial.depthWrite = false;
  const camMaterial = matte(PALETTE.brass, {
    metalness: 0.18,
    roughness: 0.50,
  });
  const pistonMaterial = matte(PALETTE.accent, {
    metalness: 0.14,
    roughness: 0.50,
  });
  const shellMaterial = matte(PALETTE.muted, {
    opacity: 0.25,
    roughness: 0.72,
    side: THREE.DoubleSide,
    transparent: true,
  });
  shellMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.34,
    roughness: 0.30,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.16, 2.9),
    frameMaterial,
  ), 'fixed-cary-pump-foundation');
  base.position.set(0.35, groundY + 0.08, 0);
  root.add(base);
  for (const x of [-1.42, 1.42]) {
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 1.18, 0.84),
      frameMaterial,
    );
    foot.position.set(x, -3.14, -0.18);
    root.add(foot);
  }

  const casing = addRole(new THREE.Mesh(
    makeAnnularExtrusion(
      casingInnerRadius,
      casingOuterRadius,
      casingDepth,
    ),
    frameMaterial,
  ), 'fixed-outer-cylinder-of-cary-rotary-pump');
  root.add(casing);
  const frontCover = addRole(new THREE.Mesh(
    new THREE.CircleGeometry(casingInnerRadius, 96),
    shellMaterial,
  ), 'transparent-front-cover-showing-fixed-cam-and-sliders');
  frontCover.position.z = casingDepth / 2 + 0.012;
  root.add(frontCover);
  const annularWater = addRole(new THREE.Mesh(
    makeAnnularExtrusion(
      drumOuterRadius + 0.03,
      casingInnerRadius - 0.04,
      casingDepth * 0.70,
    ),
    waterMaterial,
  ), 'water-in-working-annulus-around-revolving-drum-B');
  root.add(annularWater);

  const fixedHeartCam = addRole(new THREE.Mesh(
    makePolarExtrusion(
      camRadiusAtAngle,
      casingDepth * 0.76,
      160,
    ),
    camMaterial,
  ), 'fixed-heart-shaped-cam-a-surrounding-axle-A');
  root.add(fixedHeartCam);
  const camFrontOutline = addRole(new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 161 }, (_, index) => {
        const angle = FULL_TURN * index / 160;
        const radius = camRadiusAtAngle(angle);
        return new THREE.Vector3(
          radius * Math.cos(angle),
          radius * Math.sin(angle),
          casingDepth * 0.39,
        );
      }),
    ),
    new THREE.LineBasicMaterial({ color: PALETTE.ink }),
  ), 'fixed-heart-cam-contact-outline');
  root.add(camFrontOutline);

  const drum = addRole(new THREE.Group(),
    'revolving-drum-B-rigidly-attached-to-axle-A');
  root.add(drum);
  const drumShell = addRole(new THREE.Mesh(
    makeAnnularExtrusion(
      drumInnerRadius,
      drumOuterRadius,
      casingDepth * 0.83,
    ),
    drumMaterial,
  ), 'rotating-annular-drum-B');
  drum.add(drumShell);
  for (const z of [-casingDepth * 0.42, casingDepth * 0.42]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        (drumInnerRadius + drumOuterRadius) / 2,
        (drumOuterRadius - drumInnerRadius) / 2,
        12,
        72,
      ),
      darkMaterial,
    );
    ring.scale.set(1, 1, 0.24);
    ring.position.z = z;
    drum.add(ring);
  }
  const axle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.23, 1.48, 32),
    darkMaterial,
  ), 'rotating-axle-A');
  axle.rotation.x = Math.PI / 2;
  drum.add(axle);
  const axleIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.09, 0.10),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  axleIndex.position.set(0.38, 0, casingDepth * 0.57);
  drum.add(axleIndex);

  const pistons = Array.from({ length: pistonCount }, (_, index) => {
    const carrier = addRole(new THREE.Group(),
      `drum-B-radial-guide-for-sliding-piston-c-${index + 1}`);
    carrier.rotation.z = index * Math.PI;
    drum.add(carrier);
    const piston = addRole(new THREE.Group(),
      `cam-driven-sliding-piston-c-${index + 1}`);
    carrier.add(piston);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(
        pistonLength,
        0.17,
        casingDepth * 0.63,
      ),
      pistonMaterial,
    );
    piston.add(blade);
    const follower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, casingDepth * 0.77, 26),
      darkMaterial,
    );
    follower.rotation.x = Math.PI / 2;
    follower.position.x = -pistonLength / 2;
    piston.add(follower);
    const sealingHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.27, casingDepth * 0.68),
      darkMaterial,
    );
    sealingHead.position.x = pistonLength / 2 - 0.065;
    piston.add(sealingHead);
    return { blade, carrier, follower, piston, sealingHead };
  });

  const separatorSamples = 48;
  const separatorShape = new THREE.Shape();
  for (let sample = 0; sample <= separatorSamples; sample += 1) {
    const angle = separatorCenterAngle - separatorHalfAngle
      + 2 * separatorHalfAngle * sample / separatorSamples;
    const x = casingInnerRadius * Math.cos(angle);
    const y = casingInnerRadius * Math.sin(angle);
    if (sample === 0) separatorShape.moveTo(x, y);
    else separatorShape.lineTo(x, y);
  }
  for (let sample = separatorSamples; sample >= 0; sample -= 1) {
    const angle = separatorCenterAngle - separatorHalfAngle
      + 2 * separatorHalfAngle * sample / separatorSamples;
    const radius = separatorInnerRadiusAtAngle(angle);
    separatorShape.lineTo(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
    );
  }
  separatorShape.closePath();
  const separatorGeometry = new THREE.ExtrudeGeometry(separatorShape, {
    bevelEnabled: false,
    depth: casingDepth * 0.90,
    steps: 1,
  });
  separatorGeometry.translate(0, 0, -casingDepth * 0.45);
  const portSeparatorE = addRole(new THREE.Mesh(
    separatorGeometry,
    camMaterial,
  ), 'fixed-port-separator-E-cleared-by-retracted-piston');
  root.add(portSeparatorE);

  const inletF = addRole(new THREE.Group(),
    'fixed-suction-pipe-F-feeding-port-L');
  root.add(inletF);
  const inletShell = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 1.42, casingDepth * 1.06),
    shellMaterial,
  );
  inletShell.position.set(-0.72, -3.08, 0);
  inletF.add(inletShell);
  const inletWater = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 1.40, casingDepth * 0.66),
    waterMaterial,
  );
  inletWater.position.copy(inletShell.position);
  inletF.add(inletWater);
  for (const x of [-1.10, -0.34]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 1.45, casingDepth * 1.10),
      frameMaterial,
    );
    wall.position.set(x, -3.08, 0);
    inletF.add(wall);
  }

  const addPipePair = (points, role, waterRole, radius = 0.34) => {
    const shell = makeTube(points, radius, shellMaterial, role);
    const water = makeTube(
      points,
      radius * 0.62,
      waterMaterial,
      waterRole,
    );
    root.add(shell, water);
    return { shell, water };
  };
  const dischargeH = addPipePair([
    new THREE.Vector3(0.72, -2.18, 0),
    new THREE.Vector3(1.75, -1.66, 0),
    new THREE.Vector3(2.47, -0.65, 0),
    new THREE.Vector3(2.58, 0.72, 0),
    new THREE.Vector3(2.72, 1.78, 0),
    new THREE.Vector3(3.22, 2.27, 0),
    new THREE.Vector3(3.76, 2.05, 0),
    new THREE.Vector3(3.86, 1.30, 0),
  ], 'fixed-discharge-pipe-H-connected-from-port-M',
  'water-routed-from-port-M-through-discharge-H', 0.35);

  const inletArrow = addRole(new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(-0.72, -3.57, casingDepth * 0.57),
    0.82,
    PALETTE.white,
    0.24,
    0.15,
  ), 'source-direction-up-suction-F-to-port-L');
  root.add(inletArrow);
  const dischargeArrow = addRole(new THREE.ArrowHelper(
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(3.86, 1.89, casingDepth * 0.57),
    0.76,
    PALETTE.white,
    0.24,
    0.15,
  ), 'source-direction-down-outlet-of-discharge-H');
  root.add(dischargeArrow);

  const update = (time) => {
    const state = stateAtTime(time);
    drum.rotation.z = state.rotorAngle;
    state.pistons.forEach((pistonState, index) => {
      pistons[index].piston.position.x = pistonState.camRadius
        + pistonLength / 2;
    });
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    camLiftAmplitude,
    camMaximumRadius,
    camMeanRadius,
    camMinimumRadius,
    casingDepth,
    casingInnerRadius,
    casingOuterRadius,
    cycleDuration,
    drumInnerRadius,
    drumOuterRadius,
    groundY,
    inputAngularSpeed,
    pistonCount,
    pistonLength,
    separatorCenterAngle,
    separatorClearance,
    separatorHalfAngle,
    sourceRotorAngle,
  };
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'cary-fixed-heart-cam-two-opposed-radial-sliding-piston-rotary-pump',
    blocks: {
      annularWater,
      axle,
      base,
      casing,
      dischargeH,
      dischargeArrow,
      drum,
      drumShell,
      fixedHeartCam,
      frontCover,
      inletArrow,
      inletF,
      pistons,
      portSeparatorE,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      piston1Independent: false,
      piston2Independent: false,
    },
    dynamics: {
      fullFluidPressureLeakagePistonSealFrictionCamContactForceTorqueAndCavitationModeled:
        false,
      camContactModel:
        'Each piston inner end is constrained directly to the fixed single-valued heart-cam radius r=a+b sin(theta). Its constant body length makes the outer tip retract to the drum seat at bottom E and reach the casing exactly at the diametrically opposite top point.',
      flowModel:
        'The source arrows establish F-to-L suction and M-to-H discharge. The displayed swept-rate is only an ideal annular geometric diagnostic; pressure, leakage, port timing, trapped volume and hydraulic efficiency are not predicted.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Axle A and annular drum B rotate clockwise together around a stationary heart-shaped cam a. Two rigid pistons c, c slide in opposite radial guides carried by the drum. Each inner follower stays on the fixed cam, so at bottom port separator E that piston retracts to its drum seat while the opposite piston reaches the inner casing wall. Repetition draws supply from pipe F through port L behind a passing piston and drives captured water ahead through port M into discharge pipe H.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'uniform-clockwise-drum-with-two-opposed-heart-cam-constrained-radial-sliders',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 456 page supplies Brown\'s static engraving and caption; its Animated control is unavailable and the page contains no Canvas mechanism or timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      clockwise: sourceState.clockwise,
      pistonCamRadii: sourceState.pistons.map(({ camRadius }) => camRadius),
      pistonTipRadii: sourceState.pistons.map(({ tipRadius }) => tipRadius),
      rotorAngle: sourceState.rotorAngle,
    },
    sourceReference: {
      brownPlate456: {
        approximateAxleACenterPixels: [197, 210],
        approximateDischargeHCenterPixels: [399, 207],
        approximateDrumBCenterPixels: [197, 210],
        approximateHeartCamCenterPixels: [199, 213],
        approximatePortEPixels: [207, 350],
        approximatePortLPixels: [119, 346],
        approximatePortMPixels: [270, 337],
        approximateSuctionFCenterPixels: [113, 425],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the outer cylinder and heart-shaped cam a are fixed',
          'drum B is attached to axle A and revolves',
          'two sliding pistons c, c move in and out in obedience to the cam',
          'water enters and leaves through ports L and M in the arrowed directions',
          'at E each piston retracts to its seat while the opposite piston reaches the chamber wall',
          'the pump draws through suction F and drives water through exit H',
        ],
        engravingEvidence:
          'Brown’s section shows clockwise arrows on drum B, a stationary heart profile around axle A, two collinear opposed piston blades through rotating radial guides, inlet F rising into L on the lower-left, fixed separator E below the cam, port M on the lower-right, and the curved H discharge passage ending in a downward arrow.',
        reconstructionDisclosure:
          'Brown gives no cam equation, casing depth, drum speed, slider length, separator clearance, port timing, pressure, leakage, friction, torque or absolute timing. Those values, the r=a+b sin(theta) conjugate-radius cam, transparent cutaway, colors and 6.2-second cycle are independently engineered. Fixed cam a, rotating A/B assembly, two opposed radial pistons, bottom retraction/opposite wall contact, separator E and F-L/M-H routing are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 456',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      camLaw:
        'r_c(theta)=r_mean+r_lift sin(theta), r_tip=r_c+L, with L=R_casing-r_c,max.',
      conjugateOpposition:
        'r_c(theta)+r_c(theta+pi)=2 r_mean exactly: when one piston retracts at bottom E, the other reaches its maximum at top.',
      separatorConstraint:
        'Across the fixed E sector, the separator inner contour remains outside the contemporaneous piston tip by the stated positive clearance.',
    },
    update,
  };
  root.userData.camRadiusAtAngle = camRadiusAtAngle;
  root.userData.pistonTipRadiusAtAngle = pistonTipRadiusAtAngle;
  root.userData.separatorInnerRadiusAtAngle = separatorInnerRadiusAtAngle;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.40, groundY, -1.48),
    new THREE.Vector3(4.35, 3.20, 1.48),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(5.9, 4.7, 11.7);
  root.userData.groundFloorY = groundY;
  markShadows(root);
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredCaryRotaryPumpMovement(movement) {
  if (movement.id !== 456) return null;
  return caryRotaryPump(movement);
}
