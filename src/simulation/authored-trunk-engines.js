import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import {
  PALETTE,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

import { boredCylinderGeometry, fitPistonGuide } from './piston-guide-parts.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { engineRod, annularSector } from './steam-engine-parts.js';
import { circle, plate, poly, polygonClipping } from './finite-plate-geometry.js';
import { cutFaceMaterial, latheSectionGeometry } from './cutaway-section.js';
import { STEAM_COLORS, STEAM_OPACITY, steamMaterial } from './steam-section-kit.js';

const FULL_TURN = Math.PI * 2;

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function trunkEngine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const crankCenter = new THREE.Vector3(0, 2.78, 0);
  const crankRadius = 0.48;
  const pitmanLength = crankRadius * (7.45 / 1.5);
  const sourceCrankAngle = 0;
  const pistonRadius = 1.115;
  // Brown's piston is a deep hollow casting: its top ledge is level with the
  // pitman pin, which lies in a closed round socket at the foot of the trunk,
  // and the body runs 0.55 below the pin.
  const pistonTopAbovePin = 0.05;
  const pistonBottomBelowPin = 0.55;
  const pistonThickness = pistonTopAbovePin + pistonBottomBelowPin;
  const trunkOuterRadius = 0.65;
  const trunkInnerRadius = 0.53;
  const socketRadius = 0.40;
  const trunkLength = 1.72;
  const cylinderHeadY = 1.12;
  const headUndersideY = cylinderHeadY - 0.11;
  const cylinderBottomY = -0.90;
  const cylinderRadius = 1.20;
  const lowerEffectiveArea = Math.PI * pistonRadius ** 2;
  const trunkCrossSectionArea = Math.PI * trunkOuterRadius ** 2;
  const upperEffectiveArea = Math.PI * (
    pistonRadius ** 2 - trunkOuterRadius ** 2
  );
  const equalForceHighToExpansivePressureRatio = lowerEffectiveArea
    / upperEffectiveArea;

  const stateAtCrankAngle = (
    crankAngle,
    crankSpeed = inputAngularSpeed,
    crankAcceleration = 0,
  ) => {
    const cosine = Math.cos(crankAngle);
    const sine = Math.sin(crankAngle);
    const underRoot = pitmanLength ** 2
      - crankRadius ** 2 * cosine ** 2;
    const rootDistance = Math.sqrt(underRoot);
    const sliderOffset = crankRadius * sine - rootDistance;
    const firstDerivative = crankRadius * cosine
      - crankRadius ** 2 * cosine * sine / rootDistance;
    const secondDerivative = -crankRadius * sine
      - crankRadius ** 2 * (
        (cosine ** 2 - sine ** 2) / rootDistance
          - crankRadius ** 2 * cosine ** 2 * sine ** 2
            / rootDistance ** 3
      );
    const pistonY = crankCenter.y + sliderOffset;
    const pistonSpeed = firstDerivative * crankSpeed;
    const pistonAcceleration = secondDerivative * crankSpeed ** 2
      + firstDerivative * crankAcceleration;
    const crankRadial = new THREE.Vector3(cosine, sine, 0);
    const crankTangent = new THREE.Vector3(-sine, cosine, 0);
    const crankPin = crankCenter.clone().addScaledVector(
      crankRadial,
      crankRadius,
    );
    const pistonPin = new THREE.Vector3(0, pistonY, crankCenter.z);
    const crankPinVelocity = crankTangent.clone().multiplyScalar(
      crankRadius * crankSpeed,
    );
    const crankPinAcceleration = crankTangent.clone().multiplyScalar(
      crankRadius * crankAcceleration,
    ).addScaledVector(
      crankRadial,
      -crankRadius * crankSpeed ** 2,
    );
    const pistonPinVelocity = new THREE.Vector3(0, pistonSpeed, 0);
    const pistonPinAcceleration = new THREE.Vector3(
      0,
      pistonAcceleration,
      0,
    );
    const pitmanVector = pistonPin.clone().sub(crankPin);
    const relativePinVelocity = pistonPinVelocity.clone()
      .sub(crankPinVelocity);
    const relativePinAcceleration = pistonPinAcceleration.clone()
      .sub(crankPinAcceleration);
    const upperChamberHeight = headUndersideY - pistonTopAbovePin - pistonY;
    const lowerChamberHeight = pistonY - pistonBottomBelowPin - cylinderBottomY;
    return {
      crankAcceleration,
      crankAngle,
      crankPin,
      crankPinAcceleration,
      crankPinVelocity,
      crankSpeed,
      lowerChamberHeight,
      lowerChamberVolume: lowerEffectiveArea * lowerChamberHeight,
      lowerChamberVolumeRate: lowerEffectiveArea * pistonSpeed,
      pistonAcceleration,
      pistonPin,
      pistonPinAcceleration,
      pistonPinVelocity,
      pistonSpeed,
      pistonY,
      pitmanAccelerationConstraintResidual:
        relativePinVelocity.lengthSq()
          + pitmanVector.dot(relativePinAcceleration),
      pitmanLengthResidual: pitmanVector.length() - pitmanLength,
      pitmanVector,
      pitmanVelocityConstraintResidual:
        pitmanVector.dot(relativePinVelocity),
      relativePinAcceleration,
      relativePinVelocity,
      trunkBottomY: pistonY,
      trunkTopY: pistonY + trunkLength,
      upperChamberHeight,
      upperChamberVolume: upperEffectiveArea * upperChamberHeight,
      upperChamberVolumeRate: -upperEffectiveArea * pistonSpeed,
      combinedChamberVolumeRate:
        upperEffectiveArea * -pistonSpeed
          + lowerEffectiveArea * pistonSpeed,
      trunkDisplacementVolumeRateResidual:
        upperEffectiveArea * -pistonSpeed
          + lowerEffectiveArea * pistonSpeed
          - trunkCrossSectionArea * pistonSpeed,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...stateAtCrankAngle(
        sourceCrankAngle + inputAngularSpeed * cycleTime,
      ),
      cycleTime,
      phase: cycleTime / cycleDuration,
    };
  };

  const bottomDeadCenter = stateAtCrankAngle(-Math.PI / 2);
  const topDeadCenter = stateAtCrankAngle(Math.PI / 2);
  const pistonStroke = topDeadCenter.pistonY - bottomDeadCenter.pistonY;
  const geometry = {
    crankCenter: crankCenter.clone(),
    crankRadius,
    cycleDuration,
    cylinderBottomY,
    cylinderHeadY,
    cylinderRadius,
    equalForceHighToExpansivePressureRatio,
    inputAngularSpeed,
    lowerEffectiveArea,
    pistonRadius,
    pistonMaximumY: topDeadCenter.pistonY,
    pistonMinimumY: bottomDeadCenter.pistonY,
    pistonStroke,
    pistonThickness,
    pitmanLength,
    sourceCrankAngle,
    trunkLength,
    trunkCrossSectionArea,
    trunkOuterRadius,
    trunkInnerRadius,
    socketRadius,
    upperEffectiveArea,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.23,
    roughness: 0.55,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const pistonMaterial = matte(PALETTE.driven, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const pitmanMaterial = matte(PALETTE.accent, {
    metalness: 0.23,
    roughness: 0.43,
  });

  const fixedCylinder = new THREE.Group();
  fixedCylinder.userData.role = 'fixed-cutaway-steam-cylinder';
  const cylinderHeight = cylinderHeadY - cylinderBottomY;
  // A round cast barrel, sectioned on the camera plane.
  const barrelInnerRadius = pistonRadius + 0.015;
  const barrelOuterRadius = cylinderRadius + 0.14;
  const sectionHalfAngle = THREE.MathUtils.degToRad(64);
  const frontAngle = -Math.PI / 2;
  const barrelAlongY = (inner, start, end, depth) => {
    const geometry = annularSector(inner, barrelOuterRadius, start, end, depth);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  };
  const backShell = new THREE.Mesh(
    barrelAlongY(barrelInnerRadius, frontAngle + sectionHalfAngle,
      frontAngle + FULL_TURN - sectionHalfAngle, cylinderHeight),
    frameMaterial,
  );
  backShell.position.set(0, (cylinderHeadY + cylinderBottomY) / 2, 0);
  backShell.userData.role = 'sectioned-back-half-cylinder-wall';
  fixedCylinder.add(backShell);
  // Heads in plan (x, -z) extruded up y, each with one steam port on the
  // section plane: the upper port admits the high-pressure steam above the
  // piston, the lower one takes it below and exhausts it. Brown draws no
  // valve gear or pipes, so none is built beyond the ports.
  const portX = 0.93;
  const portRadius = 0.1;
  const headPlan = (outerPolygon, holes) => {
    const geometry = plate(polygonClipping.difference(outerPolygon, ...holes), 0, 1);
    geometry.rotateX(-Math.PI / 2); // plan y -> world -z, extrusion z -> world y
    return geometry;
  };
  const upperHead = new THREE.Mesh(headPlan(
    poly(circle([0, 0], barrelOuterRadius, 128)),
    [poly(circle([0, 0], trunkOuterRadius + 0.07, 96)), poly(circle([portX, 0], portRadius, 40))],
  ), frameMaterial);
  upperHead.scale.y = 0.22;
  upperHead.position.y = cylinderHeadY - 0.11;
  upperHead.userData.role = 'fixed-cylinder-head-half-around-trunk-opening';
  fixedCylinder.add(upperHead);
  const lowerFlange = new THREE.Mesh(headPlan(
    poly([[-1.42, -1.42], [1.42, -1.42], [1.42, 1.42], [-1.42, 1.42]]),
    [poly(circle([portX, 0], portRadius, 40))],
  ), frameMaterial);
  lowerFlange.scale.y = 0.2;
  lowerFlange.position.y = cylinderBottomY - 0.2;
  lowerFlange.userData.role = 'lower-cylinder-flange';
  fixedCylinder.add(lowerFlange);
  // Pass 90: Brown's stuffing box is a raised gland boss round the trunk,
  // standing on a flange with a round packing groove, lathed as one casting
  // that sits on the head (its foot 0.005 into the head's top face).
  const glandProfile = [[0, 1.20], [0.10, 1.20], [0.10, 1.105]];
  for (let k = 1; k < 12; k += 1) {
    const a = Math.PI * k / 12;
    glandProfile.push([0.10 - 0.095 * Math.sin(a), 1.01 + 0.095 * Math.cos(a)]);
  }
  glandProfile.push([0.10, 0.915], [0.10, 0.885], [0.20, 0.885], [0.24, 0.84]);
  const stuffingBox = new THREE.Mesh(
    boredLatheGeometry(glandProfile.map(([axial, radial]) => ({ axial, radial })), trunkOuterRadius + 0.008, 128),
    frameMaterial,
  );
  stuffingBox.position.set(0, cylinderHeadY + 0.105, 0);
  stuffingBox.userData.role =
    'fixed-annular-stuffing-box-around-moving-trunk';
  fixedCylinder.add(stuffingBox);
  root.add(fixedCylinder);

  const crankWheel = new THREE.Group();
  crankWheel.userData.rotor = new THREE.Group();
  crankWheel.add(crankWheel.userData.rotor);
  crankWheel.position.copy(crankCenter);
  crankWheel.userData.role = 'continuously-rotating-upper-crank';
  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.11, 0.19),
    pitmanMaterial,
  );
  crankArm.position.set(crankRadius / 2, 0, -0.20);
  crankArm.userData.role = 'crank-throw-to-pitman';
  crankWheel.userData.rotor.add(crankArm);
  // The crankshaft turns with its throw and ends behind the pitman's plane.
  const crankAxle = cylinderAlongZ(0.12, 0.84, darkMaterial, 30);
  crankAxle.position.z = -0.50;
  crankAxle.userData.role = 'horizontal-crankshaft-turning-with-crank';
  crankWheel.userData.rotor.add(crankAxle);
  const crankPinMarker = cylinderAlongZ(0.085, 0.43, darkMaterial);
  crankPinMarker.position.set(crankRadius, 0, -0.12);
  crankPinMarker.userData.role = 'upper-crank-pin';
  crankWheel.userData.rotor.add(crankPinMarker);
  root.add(crankWheel);

  // Piston and trunk: one casting, turned, sectioned on the camera plane.
  // Its profile (radius, height above the pin) closes under the pin in a
  // round socket, with Brown's annular core pocket inside the body; the
  // profile is split at the pocket so each half is a simple ring.
  const pistonAndTrunk = new THREE.Group();
  pistonAndTrunk.userData.role =
    'single-translating-piston-and-attached-hollow-trunk';
  const socket = Array.from({ length: 17 }, (_, i) => {
    const a = -Math.PI / 2 * i / 16;
    return [socketRadius * Math.cos(a), socketRadius * Math.sin(a)];
  });
  const pistonProfile = poly([
    [0, -pistonBottomBelowPin], [pistonRadius, -pistonBottomBelowPin], [pistonRadius, pistonTopAbovePin],
    [trunkOuterRadius, pistonTopAbovePin], [trunkOuterRadius, trunkLength], [trunkInnerRadius, trunkLength],
    [trunkInnerRadius, 0.02], [socketRadius, 0.02], ...socket.slice(1),
  ]);
  const pocket = poly([[0.72, -0.40], [0.95, -0.40], [0.95, -0.10], [0.72, -0.10]]);
  const split = 0.835;
  const innerHalf = polygonClipping.difference(polygonClipping.intersection(pistonProfile,
    poly([[0, -2], [split, -2], [split, 3], [0, 3]])), pocket);
  const outerHalf = polygonClipping.difference(polygonClipping.intersection(pistonProfile,
    poly([[split, -2], [2, -2], [2, 3], [split, 3]])), pocket);
  const pistonCut = cutFaceMaterial(pistonMaterial);
  for (const [half, role] of [[innerHalf, 'trunk-and-closed-pin-socket-of-piston'], [outerHalf, 'vertical-sliding-piston']]) {
    for (const [ring] of half) {
      const mesh = new THREE.Mesh(latheSectionGeometry(ring.slice(0, -1), { segments: 96 }), [pistonMaterial, pistonCut]);
      mesh.userData.role = role;
      mesh.userData.cutawaySection = true;
      pistonAndTrunk.add(mesh);
    }
  }
  const piston = pistonAndTrunk.children.find((child) => child.userData.role === 'vertical-sliding-piston');
  const trunkBack = pistonAndTrunk.children.find((child) => child.userData.role === 'trunk-and-closed-pin-socket-of-piston');
  // Gudgeon pin across the socket, held in the trunk's back wall.
  const pistonPinMarker = cylinderAlongZ(0.085, trunkInnerRadius + 0.06, darkMaterial, 28);
  pistonPinMarker.position.z = -(trunkInnerRadius + 0.06) / 2;
  pistonPinMarker.userData.role = 'pitman-pin-in-piston-socket';
  pistonAndTrunk.add(pistonPinMarker);
  root.add(pistonAndTrunk);

  const pitman = engineRod(pitmanLength, 0.10, 0.145, 0.088, 0.12,
    pitmanMaterial, 'constant-length-pitman-entering-hollow-trunk');
  root.add(pitman);

  // ---- steam: back-half lathe volumes of the two working spaces and ports --
  const steamLathe = (profile, role) => {
    const mesh = new THREE.Mesh(latheSectionGeometry(profile, { segments: 64 }), steamMaterial('live'));
    mesh.userData.role = role;
    mesh.userData.steamVolume = true;
    mesh.renderOrder = 2;
    return mesh;
  };
  const upperSteam = steamLathe([[trunkOuterRadius + 0.012, 0], [barrelInnerRadius - 0.004, 0],
    [barrelInnerRadius - 0.004, 1], [trunkOuterRadius + 0.012, 1]], 'steam-above-piston-round-the-trunk');
  const lowerSteam = steamLathe([[0, 0], [barrelInnerRadius - 0.004, 0], [barrelInnerRadius - 0.004, 1], [0, 1]],
    'steam-below-piston');
  const portSteam = (y0, y1, role) => {
    const r = portRadius - 0.006;
    const mesh = new THREE.Mesh(latheSectionGeometry([[0, 0], [r, 0], [r, y1 - y0], [0, y1 - y0]], { segments: 24 }),
      steamMaterial('live'));
    mesh.position.set(portX, y0, 0);
    mesh.userData.role = role;
    mesh.userData.steamVolume = true;
    mesh.renderOrder = 2;
    return mesh;
  };
  const upperPortSteam = portSteam(headUndersideY, cylinderHeadY + 0.11, 'steam-in-upper-port');
  const lowerPortSteam = portSteam(cylinderBottomY - 0.2, cylinderBottomY, 'steam-in-lower-port');
  root.add(upperSteam, lowerSteam, upperPortSteam, lowerPortSteam);
  const live = new THREE.Color(STEAM_COLORS.live);
  const exhausted = new THREE.Color(STEAM_COLORS.exhaust);
  const setPressure = (mesh, pressure) => {
    mesh.material.color.copy(exhausted).lerp(live, pressure);
    mesh.material.opacity = THREE.MathUtils.lerp(STEAM_OPACITY.exhaust, STEAM_OPACITY.live, pressure);
    mesh.userData.pressure = pressure;
  };
  // Steam cycle (Brown's caption): on the down-stroke high-pressure steam
  // fills the annulus above the piston while the space below exhausts; on
  // the up-stroke that steam passes below and works expansively on the full
  // area, the two spaces together growing as the piston rises.
  const bdc = stateAtCrankAngle(-Math.PI / 2);
  const expansionStartVolume = bdc.upperChamberVolume + bdc.lowerChamberVolume;
  const steamStateAt = (state) => {
    const upstroke = state.pistonSpeed > 0;
    const expansive = Math.min(1, expansionStartVolume / (state.upperChamberVolume + state.lowerChamberVolume));
    // soften the valve events over about 12 degrees of crank either side of
    // the dead centres
    const fromDead = Math.abs(Math.cos(state.crankAngle));
    const blend = THREE.MathUtils.smoothstep(fromDead, 0, Math.sin(THREE.MathUtils.degToRad(12)));
    const upper = upstroke ? THREE.MathUtils.lerp(1, expansive, blend) : 1;
    const lower = upstroke ? expansive * blend : 0;
    return {
      stroke: upstroke ? 'up-expansive-below' : 'down-high-pressure-above',
      upperPressure: upper,
      lowerPressure: lower,
      expansionRatio: 1 / expansive,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(crankWheel, state.crankAngle);
    pistonAndTrunk.position.set(0, state.pistonY, crankCenter.z);
    pitman.userData.setEndpoints(
      state.crankPin.clone().setZ(0),
      state.pistonPin.clone().setZ(0),
    );
    upperSteam.position.y = state.pistonY + pistonTopAbovePin;
    upperSteam.scale.y = Math.max(1e-3, state.upperChamberHeight);
    lowerSteam.position.y = cylinderBottomY;
    lowerSteam.scale.y = Math.max(1e-3, state.lowerChamberHeight);
    const steam = steamStateAt(state);
    setPressure(upperSteam, steam.upperPressure);
    setPressure(upperPortSteam, steam.upperPressure);
    setPressure(lowerSteam, steam.lowerPressure);
    setPressure(lowerPortSteam, steam.lowerPressure);
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'vertical-in-line-trunk-engine-slider-crank-with-hollow-piston-trunk-through-head-stuffing-box-and-area-staged-steam',
    blocks: {
      backShell,
      crankArm,
      crankPinMarker,
      crankWheel,
      fixedCylinder,
      lowerFlange,
      lowerPortSteam,
      lowerSteam,
      piston,
      pistonAndTrunk,
      pistonPinMarker,
      pitman,
      stuffingBox,
      trunkBack,
      upperHead,
      upperPortSteam,
      upperSteam,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      pistonPositionIndependent: false,
      pitmanAngleIndependent: false,
      trunkPositionIndependent: false,
    },
    dynamics: {
      connectingRodSideThrustBearingFrictionInertiaLeakageAndValveTimingModeled:
        false,
      effectiveAreasAndEqualForcePressureRatioModeled: true,
      expansiveThermodynamicPressureCurveModeled: false,
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsPressuresOrLoads: false,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'A continuously rotating upper crank drives one exact in-line slider-crank pitman. The pitman descends inside the hollow trunk and pins directly to the piston in a closed round socket at the trunk’s foot. Piston and trunk are one casting and translate together; the trunk passes through the fixed annular stuffing box in the cylinder head. High-pressure steam enters by the port in the head and drives the piston down on the annulus round the trunk; on the up-stroke it passes by the port in the bottom to the space below and works expansively on the full area.',
    motion: {
      crankSpeed: inputAngularSpeed,
      cycleDuration,
      pistonStroke,
    },
    pressureStaging: {
      equalForceCondition:
        'highPressure*upperAnnularArea=expansivePressure*lowerFullArea',
      highPressureAdmissionSide: 'upper annular piston face',
      highToExpansivePressureRatio:
        equalForceHighToExpansivePressureRatio,
      lowerExpansiveSide: 'lower full piston face',
      lowerFullArea: lowerEffectiveArea,
      upperAnnularArea: upperEffectiveArea,
    },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      officialCanvasCyclePeriod: 4,
      officialCanvasCyclesPerMinute: 15,
      officialCanvasModelPresent: true,
      reason:
        'The official Movement 421 page embeds a four-part Canvas construction showing a 1.5-radius upper crank, 7.45-length pitman, centerline piston pin, cutaway trunk, fixed head, and stuffing box. It was inspected for topology and relative proportions only.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      crankAngle: sourceState.crankAngle,
      crankPin: sourceState.crankPin.clone(),
      pistonPin: sourceState.pistonPin.clone(),
    },
    sourceReference: {
      brownPlate421: {
        crankApproximateCenterPixels: [262, 95],
        cylinderApproximateBoundsPixels: [125, 247, 403, 523],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 12,
        pistonPinApproximateCenterPixels: [264, 371],
        trunkApproximateBoundsPixels: [204, 246, 325, 398],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the engine is a marine trunk engine',
          'the trunk is attached to the piston',
          'the pitman connects at the trunk’s lower end directly with the piston',
          'the trunk passes through a stuffing box in the cylinder head',
          'the trunk reduces the effective upper piston area',
          'high-pressure steam first acts above the piston',
          'that steam is exhausted below and used expansively',
        ],
        engravingEvidence:
          'Brown’s cutaway plate shows the crank above the cylinder, an oblique pitman entering a wide open trunk, its lower pin centered directly in the piston, and the trunk sliding through an annular head gland.',
        officialCanvasEvidence:
          'The official embedded construction uses a 1.5-unit crank throw, a 7.45-unit pitman, one vertical centerline slider, a three-unit-wide cutaway trunk, and a four-second display cycle at 15 cycles per minute.',
        reconstructionDisclosure:
          'Brown gives no absolute dimensions, crank speed, piston and trunk diameters, clearance volumes, pressures, cutoff, valve timing, materials, or loads. The scaled geometry, exact analytic slider law, the two head ports (Brown draws no valve gear or pipes, so none is built), the isothermal expansion shading of the steam, and display timing are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 421',
    },
    stateAtCrankAngle,
    stateAtTime,
    steamStateAt,
    transmission: {
      pistonGuide: 'pistonPin=(0,pistonY)',
      pitmanConstraint: '|pistonPin-crankPin|=pitmanLength',
      sliderLaw:
        'pistonY=crankCenterY+r*sin(theta)-sqrt(L^2-r^2*cos(theta)^2)',
      trunkConstraint: 'trunkBottomY=pistonY; trunkTopY=pistonY+trunkLength',
    },
    update,
  };
  root.userData.cameraDirection = new THREE.Vector3(0.8, 0.4, 14);
  markShadows(root);
  for (const steam of [upperSteam, lowerSteam, upperPortSteam, lowerPortSteam]) {
    steam.castShadow = false;
    steam.receiveShadow = false;
  }
  root.userData.cameraFov = 8;
  fitPistonGuide(root, update, cycleDuration);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredTrunkEngineMovement(movement) {
  if (movement.id !== 421) return null;
  return applyCutawayFor(trunkEngine(movement), movement.id);
}
