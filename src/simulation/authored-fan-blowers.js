import * as THREE from 'three';
import {
  PALETTE,
  makeShaft,
  markShadows,
  matte,
} from './primitives.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function centeredExtrusion(shape, depth, bevel = 0.018) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevel > 0,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 42,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function voluteSidePlateGeometry(depth, inletRadius) {
  const shape = new THREE.Shape();
  shape.moveTo(4.72, -1.54);
  shape.lineTo(3.18, -1.54);
  shape.bezierCurveTo(3.48, -0.75, 3.67, 0.28, 3.48, 1.35);
  shape.bezierCurveTo(3.18, 3.0, 1.72, 3.96, -0.1, 4.0);
  shape.bezierCurveTo(-2.32, 4.04, -4.02, 2.46, -4.08, 0.27);
  shape.bezierCurveTo(-4.14, -1.93, -2.71, -3.57, -0.59, -3.76);
  shape.lineTo(4.72, -3.76);
  shape.closePath();
  const inlet = new THREE.Path();
  inlet.absarc(0, 0, inletRadius, 0, Math.PI * 2, true);
  shape.holes.push(inlet);
  return centeredExtrusion(shape, depth, 0.025);
}

function bladeGeometry(depth) {
  const shape = new THREE.Shape();
  shape.moveTo(0.48, -0.16);
  shape.bezierCurveTo(1.02, -0.15, 1.43, -0.45, 1.66, -0.93);
  shape.bezierCurveTo(1.94, -1.52, 2.34, -1.98, 2.9, -2.18);
  shape.lineTo(3.05, -1.82);
  shape.bezierCurveTo(2.59, -1.53, 2.31, -1.08, 2.08, -0.5);
  shape.bezierCurveTo(1.84, 0.1, 1.26, 0.36, 0.57, 0.24);
  shape.closePath();
  return centeredExtrusion(shape, depth, 0.025);
}

function makeOpenVoluteWall(material, depth) {
  const guide = new THREE.CatmullRomCurve3([
    new THREE.Vector3(4.72, -1.54, 0),
    new THREE.Vector3(3.18, -1.54, 0),
    new THREE.Vector3(3.53, 0.0, 0),
    new THREE.Vector3(3.04, 2.55, 0),
    new THREE.Vector3(0.72, 3.93, 0),
    new THREE.Vector3(-2.15, 3.35, 0),
    new THREE.Vector3(-4.06, 1.03, 0),
    new THREE.Vector3(-3.53, -2.1, 0),
    new THREE.Vector3(-0.59, -3.76, 0),
    new THREE.Vector3(2.2, -3.76, 0),
    new THREE.Vector3(4.72, -3.76, 0),
  ], false, 'centripetal');
  const points = guide.getSpacedPoints(108);
  const wall = addRole(new THREE.Group(),
    'open-peripheral-wall-of-volute-and-spout');
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const direction = end.clone().sub(start);
    const panel = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(direction.length() + 0.025, 0.14, depth),
      material,
    ), 'short-panel-of-continuous-volute-wall');
    panel.position.copy(start).add(end).multiplyScalar(0.5);
    panel.rotation.z = Math.atan2(direction.y, direction.x);
    wall.add(panel);
  }
  wall.userData.centerline = guide;
  wall.userData.centerlinePoints = points;
  return wall;
}

function makeAirflowCurve(side, lane) {
  const startAngle = -Math.PI / 2 + lane * 0.22;
  const offset = lane * 0.08;
  const points = [
    new THREE.Vector3(
      Math.cos(startAngle) * (0.36 + Math.abs(lane) * 0.12),
      Math.sin(startAngle) * (0.36 + Math.abs(lane) * 0.12),
      side * 2.05,
    ),
    new THREE.Vector3(
      Math.cos(startAngle) * 0.28,
      Math.sin(startAngle) * 0.28,
      side * 0.72,
    ),
    new THREE.Vector3(0, -0.28 + offset, side * 0.12),
  ];
  const spiralAngles = [
    -Math.PI * 2.5,
    -Math.PI * 2,
    -Math.PI * 1.5,
    -Math.PI,
    -Math.PI / 2,
  ];
  const radii = [0.34, 0.82, 1.38, 2.04, 2.68];
  for (let index = 0; index < radii.length; index += 1) {
    const angle = spiralAngles[index] + lane * 0.035;
    points.push(new THREE.Vector3(
      Math.cos(angle) * radii[index],
      Math.sin(angle) * radii[index],
      side * 0.08,
    ));
  }
  points.push(
    new THREE.Vector3(3.18, -2.62 + offset, side * 0.08),
    new THREE.Vector3(4.98, -2.62 + offset, side * 0.08),
  );
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  curve.arcLengthDivisions = 4096;
  curve.updateArcLengths();
  return curve;
}

function centrifugalFanBlower(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const officialCyclesPerMinute = 15;
  const cycleDuration = 60 / officialCyclesPerMinute;
  const rotorAngularSpeed = fullTurn / cycleDuration;
  const bladeCount = 3;
  const bladeDepth = 0.72;
  const casingDepth = 1.28;
  const inletRadius = 1.18;
  const hubRadius = 0.57;
  const impellerOuterRadius = 3.05;
  const flowCyclesPerRotorCycle = 2;
  const flowCyclesPerSecond = flowCyclesPerRotorCycle / cycleDuration;

  const impeller = addRole(new THREE.Group(),
    'three-curved-blade-impeller-fast-with-shaft');
  const bladeMaterial = matte(PALETTE.driver, {
    metalness: 0.2,
    roughness: 0.46,
  });
  const oneBladeGeometry = bladeGeometry(bladeDepth);
  const blades = [];
  for (let index = 0; index < bladeCount; index += 1) {
    const blade = addRole(new THREE.Mesh(oneBladeGeometry, bladeMaterial),
      `backward-curved-impeller-blade-${index + 1}`);
    blade.rotation.z = index / bladeCount * fullTurn;
    blade.userData.bladeIndex = index;
    blades.push(blade);
    impeller.add(blade);
  }
  const hub = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(hubRadius, hubRadius, bladeDepth + 0.26, 46),
    matte(PALETTE.brass, { metalness: 0.3, roughness: 0.39 }),
  ), 'impeller-hub-fixed-to-shaft');
  hub.rotation.x = Math.PI / 2;
  const hubIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(hubRadius * 0.72, 0.065, bladeDepth + 0.3),
    matte(PALETTE.white, { roughness: 0.38 }),
  ), 'visible-impeller-rotation-index');
  hubIndex.position.x = hubRadius * 0.48;
  const shaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 3.65,
    radius: 0.13,
  });
  shaft.userData.role = 'fan-driving-shaft';
  impeller.add(hub, hubIndex, shaft);

  const rearCasingMaterial = matte(PALETTE.frame, {
    metalness: 0.11,
    opacity: 0.76,
    roughness: 0.69,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const frontCasingMaterial = matte(PALETTE.frame, {
    depthWrite: false,
    metalness: 0.08,
    opacity: 0.24,
    roughness: 0.72,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const wallMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    opacity: 0.64,
    roughness: 0.66,
    transparent: true,
  });
  const plateGeometry = voluteSidePlateGeometry(0.12, inletRadius);
  const rearPlate = addRole(new THREE.Mesh(
    plateGeometry,
    rearCasingMaterial,
  ), 'rear-volute-side-with-circular-inlet-opening');
  rearPlate.position.z = -casingDepth / 2;
  rearPlate.userData.fixed = true;
  const frontPlate = addRole(new THREE.Mesh(
    plateGeometry,
    frontCasingMaterial,
  ), 'transparent-front-volute-side-with-circular-inlet-opening');
  frontPlate.position.z = casingDepth / 2;
  frontPlate.userData.fixed = true;
  frontPlate.renderOrder = 4;
  const voluteWall = makeOpenVoluteWall(wallMaterial, casingDepth);
  voluteWall.userData.fixed = true;
  const inletRimMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.46,
  });
  const inletRims = [-1, 1].map((side, index) => {
    const rim = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(inletRadius, 0.085, 12, 72),
      inletRimMaterial,
    ), `${side > 0 ? 'front' : 'rear'}-circular-air-inlet-rim`);
    rim.position.z = side * (casingDepth / 2 + 0.08);
    rim.userData.fixed = true;
    rim.userData.inletIndex = index;
    return rim;
  });

  const outletLipMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const outletLips = [-1.54, -3.76].map((y, index) => {
    const lip = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, casingDepth + 0.28),
      outletLipMaterial,
    ), `open-spout-lip-${index + 1}`);
    lip.position.set(4.72, y, 0);
    lip.userData.fixed = true;
    return lip;
  });

  const bearingMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.43,
  });
  const bearings = [-1.22, 1.22].map((z, index) => {
    const bearing = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.07, 10, 40),
      bearingMaterial,
    ), `fixed-fan-shaft-bearing-${index + 1}`);
    bearing.position.z = z;
    bearing.userData.fixed = true;
    return bearing;
  });

  const airflowCurves = [];
  for (const side of [-1, 1]) {
    for (const lane of [-1, 0, 1]) {
      airflowCurves.push(makeAirflowCurve(side, lane));
    }
  }
  const airflowMaterial = matte(PALETTE.white, {
    depthWrite: false,
    opacity: 0.88,
    roughness: 0.22,
    transparent: true,
  });
  const airflowParticles = [];
  const particlesPerCurve = 4;
  for (let curveIndex = 0; curveIndex < airflowCurves.length; curveIndex += 1) {
    for (let index = 0; index < particlesPerCurve; index += 1) {
      const particle = addRole(new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 12, 9),
        airflowMaterial,
      ), 'arc-length-sampled-intake-radial-discharge-air-particle');
      particle.userData.curveIndex = curveIndex;
      particle.userData.phaseOffset =
        (index + curveIndex / airflowCurves.length) / particlesPerCurve;
      particle.renderOrder = 3;
      airflowParticles.push(particle);
    }
  }

  root.add(
    rearPlate,
    voluteWall,
    ...inletRims,
    ...outletLips,
    ...bearings,
    impeller,
    ...airflowParticles,
    frontPlate,
  );

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const cyclePosition = cycleTime / cycleDuration;
    const rotorAngle = fullTurn * cyclePosition;
    const particleStates = airflowParticles.map((particle) => {
      const progress = THREE.MathUtils.euclideanModulo(
        time * flowCyclesPerSecond + particle.userData.phaseOffset,
        1,
      );
      return {
        curveIndex: particle.userData.curveIndex,
        position: airflowCurves[particle.userData.curveIndex]
          .getPointAt(progress),
        progress,
        visibilityScale: Math.sin(Math.PI * progress),
      };
    });
    return {
      cyclePosition,
      cycleTime,
      particleStates,
      rotorAngle,
      rotorAngularSpeed,
      rotationDirection: 'counterclockwise-viewed-from-front-positive-z',
    };
  };

  root.userData.archetype =
    'three-backward-curved-blade-centrifugal-fan-in-double-inlet-volute';
  root.userData.mechanism =
    'shaft-rotates-three-vane-impeller-counterclockwise-air-enters-both-side-eyes-turns-radially-and-leaves-tangential-spout-under-pressure';
  root.userData.blocks = {
    airflowCurves,
    airflowParticles,
    bearings,
    blades,
    frontPlate,
    hub,
    hubIndex,
    impeller,
    inletRims,
    outletLips,
    rearPlate,
    shaft,
    voluteWall,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.35, -4.05, -2.18),
    new THREE.Vector3(5.18, 4.25, 2.18),
  );
  root.userData.canonicalTimes = {
    cycleClosure: cycleDuration,
    halfTurn: cycleDuration / 2,
    quarterTurn: cycleDuration / 4,
    sourcePose: 0,
  };
  root.userData.degreesOfFreedom = {
    independentShaftInputs: 1,
    independentBladeCoordinates: 0,
  };
  root.userData.geometry = {
    bladeCount,
    bladeDepth,
    casingDepth,
    cycleDuration,
    hubRadius,
    impellerOuterRadius,
    inletRadius,
    outletBounds: {
      bottom: -3.76,
      left: 3.18,
      right: 4.72,
      top: -1.54,
    },
    shaftAxis: Z_AXIS.clone(),
  };
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: officialCyclesPerMinute,
    durationSeconds: cycleDuration,
    officialCanvasModelPresent: true,
    rotatingDefinition:
      'one three-blade group add_rot about source [0,0] by cyclePos',
    rotationDirection: 'counterclockwise',
    sourceBounds: [-9, -9, 18, 18],
    sourceUrl: movement.sourceUrl,
    staticDefinition:
      'one casing group with paired side-opening circles, volute, and right spout',
  };
  root.userData.sourceReference = {
    historicalCorroboration: {
      detail:
        'Innes treats centrifugal-fan construction as a rotating wheel within a casing and documents inlet, impeller, and delivery arrangements for centrifugal fans.',
      title:
        'The Fan: Including the Theory and Practice of Centrifugal and Axial Fans (2nd ed., 1916)',
      url:
        'https://archive.org/details/fanincludingtheo00innerich',
    },
    modernTerminologyCheck: {
      detail:
        'AMCA defines a centrifugal fan as receiving air essentially axially and discharging it perpendicular to the axis, with one or two inlets and a scroll casing.',
      standard: 'ANSI/AMCA Standard 99-16',
      url:
        'https://www.amca.org/assets/resources/public/Standards%20for%20Member%20Download/amca-99-16.pdf',
    },
    officialDescription: movement.description,
    officialInlineModelUrl: movement.sourceUrl,
    reconstructionDisclosure:
      'The impeller count, counterclockwise direction, fixed volute, double side inlets, source center, and 15-cpm cycle are explicit in the official canvas; depth, transparency, and airflow tracers are explanatory 3D choices.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    flowCyclesPerRotorCycle,
    flowCyclesPerSecond,
    officialCyclesPerMinute,
    rotorAngularSpeed,
    rotorTurnsPerCycle: 1,
    shaftToImpellerRatio: 1,
  };
  root.userData.cameraDistanceScale = 1.04;

  const update = (time) => {
    const state = stateAtTime(time);
    impeller.rotation.z = state.rotorAngle;
    airflowParticles.forEach((particle, index) => {
      const particleState = state.particleStates[index];
      particle.position.copy(particleState.position);
      particle.scale.setScalar(particleState.visibilityScale);
    });
    impeller.userData.angularSpeed = rotorAngularSpeed;
    shaft.userData.angularSpeed = rotorAngularSpeed;
    root.userData.flow = {
      direction:
        'axial-in-through-both-circular-side-openings-radial-outward-through-impeller-tangential-out-through-spout',
      particleStates: state.particleStates,
    };
    root.userData.kinematics = state;
  };
  update(0);
  root.userData.fidelity = 'authored';
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(6.3, 4.8, 10.3),
  };
}

export function createAuthoredFanBlowerMovement(movement) {
  if (movement.id !== 497) return null;
  return centrifugalFanBlower(movement);
}
