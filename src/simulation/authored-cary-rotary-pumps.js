import * as THREE from 'three';
import { latheSectionGeometry } from './cutaway-section.js';
import { caryFollowerLaw, caryWallRadius, correctCaryPump } from './rotary-pump-contact.js';
import { circle, plate, poly, polygonClipping } from './finite-plate-geometry.js';
import { waterVolumeMaterial } from './water-volume.js';
import { WaterStream, ballisticPath, guidedPath, joinPaths } from './water-stream.js';
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
  const camMeanRadius = 0.89;
  const camLiftAmplitude = 0.36;
  const camMinimumRadius = camMeanRadius - camLiftAmplitude;
  const camMaximumRadius = camMeanRadius + camLiftAmplitude;
  const pistonLength = casingInnerRadius - camMaximumRadius;
  const pistonCount = 2;
  const separatorCenterAngle = -Math.PI / 2;
  const separatorHalfAngle = THREE.MathUtils.degToRad(18);
  // The chamber wall's running clearance over the retracted bar end at E.
  const separatorClearance = 0.003;
  const groundY = -3.78;

  const camRadiusAtAngle = (angle) => caryFollowerLaw(angle).radius;

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
      const camRadiusVelocity = caryFollowerLaw(absoluteAngle).first * rotorAngularSpeed;
      const camRadiusAcceleration = caryFollowerLaw(absoluteAngle).second * rotorAngularSpeed ** 2
        + caryFollowerLaw(absoluteAngle).first * rotorAngularAcceleration;
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
    foot.userData.role = 'fixed-casing-foot-not-drawn-by-brown';
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
  axleIndex.userData.role = 'white-rotor-rotation-index';
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
      drum,
      drumShell,
      fixedHeartCam,
      frontCover,
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
        'Each finite roller of the one rigid bar c-c follows a reconstructed constant-width heart cam with an extended working dwell at the top and a retracted dwell around E. Harmonic flanks keep velocity continuous (acceleration steps at the dwell ends, as a heart cam\u2019s do); the opposite end stays extended while one crosses E.',
      flowModel:
        'The source arrows establish F-to-L suction and M-to-H discharge. The displayed swept-rate is only an ideal annular geometric diagnostic; pressure, leakage, port timing, trapped volume and hydraulic efficiency are not predicted.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Axle A and annular drum B rotate clockwise together around a stationary heart-shaped cam a. The pistons c, c are the two ends of one rigid bar sliding in opposite radial guides of the drum; its two rollers bear on opposite sides of the constant-width cam, so at bottom E one end retracts to its drum seat while the other reaches the far side of the eccentric chamber, whose wall is the curve the bar ends trace. Repetition draws supply from pipe F through port L behind a passing piston and drives captured water ahead through port M into discharge pipe H.',
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
          'Brown gives no cam equation, casing depth, drum speed, slider length, separator clearance, port timing, pressure, leakage, friction, torque or absolute timing. Those values, the finite-roller offset constant-width cam with 20-degree dwells and harmonic flanks, the chamber curve derived from it, cutaway, colors and 6.2-second cycle are independently engineered. Fixed cam a, rotating A/B assembly, one rigid bar with opposed pistons c, c, the eccentric chamber, bottom retraction/opposite wall contact, separator E and F-L/M-H routing are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 456',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      camLaw:
        'Roller-center radius r has 20-degree half-width dwells at E and opposite it joined by harmonic flanks, with r(t)+r(t+pi) constant so both rollers of the rigid bar stay on the cam; the solid cam is its inward normal offset by the 0.11 roller radius.',
      conjugateOpposition:
        'When either piston retracts at bottom E, the opposite piston stays at its maximum working radius; both piston radii follow the same stationary cam.',
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
  root.userData.cameraDistanceScale = 1.14;
  root.userData.cameraDirection = new THREE.Vector3(5.9, 4.7, 11.7);
  root.userData.groundFloorY = groundY;
  correctCaryPump(root);
  // Brown's section is drawn clear: no water or front cover washes over the
  // cam and sliders. Drum B, pipe H and the rear spider carrying the drum
  // are solid (opaque) parts; Brown's flow arrows are not modelled.
  for (const object of [frontCover, annularWater, inletWater, dischargeH.water]) {
    object.visible = false;
  }
  drumMaterial.transparent = false;
  drumMaterial.opacity = 1;
  drumMaterial.depthWrite = true;
  drumMaterial.side = THREE.FrontSide;
  dischargeH.shell.material = frameMaterial;
  // The flattened black face rings would paint the drum face black.
  for (const ring of drum.children.filter((child) => child.geometry?.type === 'TorusGeometry')) {
    ring.visible = false;
  }
  inletShell.geometry.dispose();
  inletShell.geometry = new THREE.BoxGeometry(0.66, 1.58, 0.06)
    .translate(0, 0, -0.3834);
  // Pass 55: pipe F is a whole round pipe matching pipe H, not a three-sided
  // section trough (back plate plus two side walls).
  {
    const [, , wallA, wallB] = inletF.children;
    const box = new THREE.Box3();
    for (const wall of [wallA, wallB]) {
      wall.geometry.computeBoundingBox();
      box.union(wall.geometry.boundingBox.clone().translate(wall.position));
    }
    const center = box.getCenter(new THREE.Vector3()), height = box.max.y - box.min.y;
    for (const child of inletF.children) child.visible = false;
    // Pass 57: the pipe runs up into the casing wall; its top face lies
    // inside the wall across the whole pipe (outer surface above it, bore
    // below), so the joint is closed and its bore meets the wall's port hole.
    const bottom = center.y - height / 2, top = -1.51 - inletF.position.y;
    const pipe = new THREE.Mesh(latheSectionGeometry([
      [0.25, bottom], [0.34, bottom], [0.34, top], [0.25, top],
    ], { phiStart: 0, phiLength: Math.PI * 2, segments: 48 }), frameMaterial);
    pipe.position.set(center.x, 0, 0);
    pipe.userData.role = 'whole-round-suction-pipe-F';
    inletF.add(pipe);
  }
  // Pass 69: the working water. The crescent between drum B and the chamber
  // wall is always full (a primed pump); the pistons sweep it from L round
  // the top to M. Suction pipe F and discharge pipe H run full, and H spills
  // from its gooseneck in a falling stream (Brown's downward arrow).
  const liveWater = [];
  {
    const g = root.userData.geometry;
    const wall = Array.from({ length: 720 }, (_, i) => {
      const a = i * FULL_TURN / 720, r = caryWallRadius(a, g.pistonLength);
      return [r * Math.cos(a), r * Math.sin(a)];
    });
    const packing = root.userData.blocks.portSeparatorE.geometry.userData.plate.polygons;
    const chamber = polygonClipping.difference(poly(wall), poly(circle([0, 0], g.drumOuterRadius, 720)), packing)
      .filter(polygon => Math.abs(polygon[0].reduce((sum, p, i, ring) => {
        const q = ring[(i + 1) % ring.length]; return sum + p[0] * q[1] - q[0] * p[1];
      }, 0)) > 0.02);
    const chamberWater = addRole(new THREE.Mesh(plate(chamber, -g.casingDepth / 2 + 0.004, g.casingDepth / 2 - 0.004),
      waterVolumeMaterial({ opacity: 0.34 })), 'water-filling-crescent-chamber-between-drum-B-and-casing');
    chamberWater.renderOrder = 1;
    root.add(chamberWater);
    liveWater.push(chamberWater);
    const flow = { radialSegments: 20, cyclePeriod: g.cycleDuration, streakRate: 1, opacity: 0.34 };
    const inlet = new WaterStream(guidedPath([new THREE.Vector3(-0.85, -3.05, 0), new THREE.Vector3(-0.85, -1.58, 0)],
      { speed: 1, samples: 6 }), { ...flow, width: 0.245, thickness: 0.245 });
    inlet.userData.role = 'water-rising-in-suction-pipe-F-to-port-L';
    const pipeCurve = dischargeH.shell.userData.curve;
    const outletAngle = -Math.PI / 3;
    const throat = new THREE.Vector3(1.68 * Math.cos(outletAngle), 1.68 * Math.sin(outletAngle), 0);
    const spout = pipeCurve.getPointAt(1), spoutDirection = pipeCurve.getTangentAt(1);
    const inPipe = joinPaths(guidedPath([throat, pipeCurve.getPointAt(0)], { speed: 1.4, samples: 2 }),
      guidedPath(pipeCurve, { speed: 1.4, samples: 96 }));
    const fall = ballisticPath({ origin: spout, velocity: spoutDirection.clone().multiplyScalar(1.4), duration: 0.42, samples: 16 });
    const discharge = new WaterStream(joinPaths(inPipe, fall), {
      ...flow, width: 0.28, thickness: 0.28, widthExponent: 0.5, fadeOut: 0.06,
    });
    discharge.userData.role = 'water-driven-from-port-M-through-H-and-falling-from-its-spout';
    root.add(inlet, discharge);
    liveWater.push(inlet, discharge);
  }
  const drive = update;
  const updateWithWater = (time) => {
    drive(time);
    for (const stream of liveWater) stream.update?.(time);
  };
  root.userData.update = updateWithWater;

  markShadows(root);
  for (const object of liveWater) { object.castShadow = false; object.receiveShadow = false; }
  base.receiveShadow = true;
  updateWithWater(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update: updateWithWater,
  };
}

export function createAuthoredCaryRotaryPumpMovement(movement) {
  if (movement.id !== 456) return null;
  return caryRotaryPump(movement);
}
