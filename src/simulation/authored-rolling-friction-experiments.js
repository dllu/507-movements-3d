import * as THREE from 'three';
import {correctRollerParts} from './roller-working-parts.js';
import {flatBeltGeometry} from './belt-geometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {
  PALETTE,
  makePulley,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function beamBetween(start, end, width, depth, material) {
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.copy(midpoint);
  beam.rotation.z = Math.atan2(delta.y, delta.x);
  return beam;
}

function tubeBetween(start, end, radius, material) {
  return new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.LineCurve3(start, end),
      1,
      radius,
      10,
      false,
    ),
    material,
  );
}

function makeIndexedWheel({
  color,
  radius,
  rimTubeRadius,
  spokes,
  width,
}) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.userData.axis = Z_AXIS.clone();
  root.userData.radius = radius;
  root.userData.rotor = rotor;
  root.userData.width = width;

  const wheelMaterial = matte(color, {
    metalness: 0.12,
    roughness: 0.60,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });
  const rimCenterRadius = radius - rimTubeRadius;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(
      rimCenterRadius,
      rimTubeRadius,
      12,
      80,
    ),
    darkMaterial,
  );
  rim.userData.role = 'circular-wheel-tread-at-authored-contact-radius';
  rotor.add(rim);

  const hubRadius = Math.max(radius * 0.13, 0.08);
  const hub = cylinderAlongZ(hubRadius, width * 1.22, darkMaterial, 28);
  hub.userData.role = 'wheel-hub-on-fixed-axis';
  rotor.add(hub);
  for (let index = 0; index < spokes; index += 1) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(
        rimCenterRadius * 1.72,
        Math.max(radius * 0.065, 0.045),
        width * 0.58,
      ),
      wheelMaterial,
    );
    spoke.rotation.z = index * Math.PI / spokes;
    spoke.userData.role = 'radial-wheel-spoke';
    rotor.add(spoke);
  }
  const faceRing = new THREE.Mesh(
    new THREE.TorusGeometry(
      radius * 0.64,
      Math.max(radius * 0.027, 0.018),
      8,
      64,
    ),
    wheelMaterial,
  );
  faceRing.position.z = width * 0.54;
  rotor.add(faceRing);
  const indexMark = new THREE.Mesh(
    new THREE.BoxGeometry(
      radius * 0.58,
      Math.max(radius * 0.055, 0.035),
      Math.max(width * 0.08, 0.018),
    ),
    whiteMaterial,
  );
  indexMark.position.set(
    radius * 0.36,
    0,
    width * 0.60,
  );
  indexMark.userData.role = 'white-index-showing-wheel-spin-rate';
  rotor.add(indexMark);
  root.userData.indexMark = indexMark;
  return markShadows(root);
}

function rollingCarriageFrictionExperiment(movement) {
  const root = new THREE.Group();

  const demonstrationPeriod = 8;
  const drumTurnsPerCycle = 2;
  const meanDrumAngularSpeed = (
    drumTurnsPerCycle * FULL_TURN / demonstrationPeriod
  );
  const speedModulationAmplitude = 0.65;
  const speedModulationAngularFrequency = (
    2 * FULL_TURN / demonstrationPeriod
  );
  const drumStartAngle = THREE.MathUtils.degToRad(11);
  const carriageWheelStartAngle = THREE.MathUtils.degToRad(17);
  const carriageWheelRadius = 0.28;
  const wheelRadiusRatio = 5;
  const largeWheelRadius = wheelRadiusRatio * carriageWheelRadius;
  const carriageHalfSpacing = 0.56;
  const axleCenterDistance = largeWheelRadius + carriageWheelRadius;
  const carriageAxleHeight = Math.sqrt(
    axleCenterDistance ** 2 - carriageHalfSpacing ** 2,
  );
  const wheelPlaneZ = 0.18;
  const largeWheelCenter = new THREE.Vector3(-0.82, -0.48, wheelPlaneZ);
  const leftCarriageWheelCenter = new THREE.Vector3(
    largeWheelCenter.x - carriageHalfSpacing,
    largeWheelCenter.y + carriageAxleHeight,
    wheelPlaneZ,
  );
  const rightCarriageWheelCenter = new THREE.Vector3(
    largeWheelCenter.x + carriageHalfSpacing,
    largeWheelCenter.y + carriageAxleHeight,
    wheelPlaneZ,
  );
  const carriageWheelCenters = [
    leftCarriageWheelCenter,
    rightCarriageWheelCenter,
  ];
  const contactNormals = carriageWheelCenters.map((center) => (
    center.clone().sub(largeWheelCenter).normalize()
  ));
  const contactPoints = contactNormals.map((normal, index) => {
    const fromDrum = largeWheelCenter.clone()
      .addScaledVector(normal, largeWheelRadius);
    const fromCarriageWheel = carriageWheelCenters[index].clone()
      .addScaledVector(normal, -carriageWheelRadius);
    if (fromDrum.distanceTo(fromCarriageWheel) > 1e-12) {
      throw new Error('Movement 373 rolling-contact construction failed.');
    }
    return fromDrum;
  });

  const drivePulleyRadius = 0.50;
  const drivePulleyCenter = new THREE.Vector3(
    largeWheelCenter.x,
    largeWheelCenter.y,
    0.52,
  );
  const beltPlaneZ = 0.70;
  const drivePulleyPitchPlaneCenter = new THREE.Vector3(
    drivePulleyCenter.x,
    drivePulleyCenter.y,
    beltPlaneZ,
  );
  const beltDirectionAngle = THREE.MathUtils.degToRad(-25);
  const beltDirection = new THREE.Vector2(
    Math.cos(beltDirectionAngle),
    Math.sin(beltDirectionAngle),
  );
  const beltNormal = new THREE.Vector2(
    -beltDirection.y,
    beltDirection.x,
  );
  const pulleyCenter2 = new THREE.Vector2(
    drivePulleyCenter.x,
    drivePulleyCenter.y,
  );
  const upperTangent2 = pulleyCenter2.clone()
    .addScaledVector(beltNormal, drivePulleyRadius);
  const lowerTangent2 = pulleyCenter2.clone()
    .addScaledVector(beltNormal, -drivePulleyRadius);
  const beltFreeLength = 1.72;
  const upperFreeEnd2 = upperTangent2.clone()
    .addScaledVector(beltDirection, -beltFreeLength);
  const lowerFreeEnd2 = lowerTangent2.clone()
    .addScaledVector(beltDirection, -beltFreeLength);
  const point3 = (point) => new THREE.Vector3(point.x, point.y, beltPlaneZ);
  const upperTangent = point3(upperTangent2);
  const lowerTangent = point3(lowerTangent2);
  const upperFreeEnd = point3(upperFreeEnd2);
  const lowerFreeEnd = point3(lowerFreeEnd2);
  const beltWrapStartAngle = Math.atan2(
    lowerTangent2.y - pulleyCenter2.y,
    lowerTangent2.x - pulleyCenter2.x,
  );
  const beltWrapAngle = Math.PI;

  const baseNormalLoad = 1.60;
  const addedNormalLoad = 1.40;
  const rollingResistanceCoefficient = 0.08;
  const indicatorCenter = new THREE.Vector3(2.03, 1.10, 0.32);
  const indicatorMomentArm = 0.24;
  const spiralSpringStiffness = 0.05;
  const pointerReferenceAngle = THREE.MathUtils.degToRad(-120);
  const spiralInnerRadius = 0.075;
  const spiralOuterRadius = 0.46;
  const spiralTurns = 3;
  const springSampleCount = 121;
  const spiralPlaneZ = indicatorCenter.z + 0.20;
  const spiralCenter = new THREE.Vector3(
    indicatorCenter.x,
    indicatorCenter.y,
    spiralPlaneZ,
  );
  const testWeightLoadedY = 1.78;
  const testWeightHoistedY = 2.55;

  const quinticStep = (progress) => {
    const bounded = THREE.MathUtils.clamp(progress, 0, 1);
    return bounded ** 3 * (
      10 - 15 * bounded + 6 * bounded ** 2
    );
  };
  const quinticStepDerivative = (progress) => {
    if (progress <= 0 || progress >= 1) return 0;
    return 30 * progress ** 2 * (1 - progress) ** 2;
  };
  const loadStateAtPhase = (phase) => {
    if (phase < 0.30) return { fraction: 0, phaseRate: 0 };
    if (phase < 0.38) {
      const local = (phase - 0.30) / 0.08;
      return {
        fraction: quinticStep(local),
        phaseRate: quinticStepDerivative(local) / 0.08,
      };
    }
    if (phase < 0.80) return { fraction: 1, phaseRate: 0 };
    if (phase < 0.88) {
      const local = (phase - 0.80) / 0.08;
      return {
        fraction: 1 - quinticStep(local),
        phaseRate: -quinticStepDerivative(local) / 0.08,
      };
    }
    return { fraction: 0, phaseRate: 0 };
  };
  const springPointsAtDeflection = (deflection) => {
    const points = [];
    for (let index = 0; index < springSampleCount; index += 1) {
      const progress = index / (springSampleCount - 1);
      const radius = THREE.MathUtils.lerp(
        spiralInnerRadius,
        spiralOuterRadius,
        progress,
      );
      const angle = pointerReferenceAngle
        + spiralTurns * FULL_TURN * progress
        + deflection * (1 - progress);
      points.push(new THREE.Vector3(
        indicatorCenter.x + Math.cos(angle) * radius,
        indicatorCenter.y + Math.sin(angle) * radius,
        spiralPlaneZ,
      ));
    }
    return points;
  };

  const stateAtTime = (time) => {
    const periodicTime = THREE.MathUtils.euclideanModulo(
      time,
      demonstrationPeriod,
    );
    const phase = periodicTime / demonstrationPeriod;
    const modulationPhase = speedModulationAngularFrequency * periodicTime;
    const drumAngularSpeed = meanDrumAngularSpeed * (
      1 + speedModulationAmplitude * Math.sin(modulationPhase)
    );
    const drumAngularAcceleration = meanDrumAngularSpeed
      * speedModulationAmplitude
      * speedModulationAngularFrequency
      * Math.cos(modulationPhase);
    const drumTravel = meanDrumAngularSpeed * time
      + meanDrumAngularSpeed * speedModulationAmplitude
        * (1 - Math.cos(modulationPhase))
        / speedModulationAngularFrequency;
    const drumAngle = drumStartAngle + drumTravel;
    const carriageWheelAngle = carriageWheelStartAngle
      - wheelRadiusRatio * drumTravel;
    const carriageWheelAngularSpeed = -wheelRadiusRatio
      * drumAngularSpeed;
    const loadState = loadStateAtPhase(phase);
    const loadFraction = loadState.fraction;
    const loadFractionRate = loadState.phaseRate / demonstrationPeriod;
    const totalNormalLoad = baseNormalLoad
      + addedNormalLoad * loadFraction;
    const rollingResistanceForce = rollingResistanceCoefficient
      * totalNormalLoad;
    const forcePerWheel = rollingResistanceForce / 2;
    const normalForcePerWheel = totalNormalLoad / 2;
    const indicatorDeflection = rollingResistanceForce
      * indicatorMomentArm / spiralSpringStiffness;
    const pointerAngle = pointerReferenceAngle + indicatorDeflection;
    const springTorque = spiralSpringStiffness * indicatorDeflection;
    const tetherMoment = rollingResistanceForce * indicatorMomentArm;
    const drumResistanceTorque = rollingResistanceForce
      * largeWheelRadius;
    const inputPower = drumResistanceTorque
      * Math.abs(drumAngularSpeed);
    const drumAngularVelocity = Z_AXIS.clone()
      .multiplyScalar(drumAngularSpeed);
    const carriageWheelAngularVelocity = Z_AXIS.clone()
      .multiplyScalar(carriageWheelAngularSpeed);
    const contacts = contactPoints.map((point, index) => {
      const drumMaterialVelocity = new THREE.Vector3().crossVectors(
        drumAngularVelocity,
        point.clone().sub(largeWheelCenter),
      );
      const carriageMaterialVelocity = new THREE.Vector3().crossVectors(
        carriageWheelAngularVelocity,
        point.clone().sub(carriageWheelCenters[index]),
      );
      return {
        carriageMaterialVelocity,
        drumMaterialVelocity,
        forcePerWheel,
        normal: contactNormals[index].clone(),
        normalForce: normalForcePerWheel,
        point: point.clone(),
        rollingSlipVelocity: carriageMaterialVelocity.clone()
          .sub(drumMaterialVelocity),
      };
    });
    return {
      addedNormalLoad: addedNormalLoad * loadFraction,
      beltLinearSpeed: drivePulleyRadius * drumAngularSpeed,
      carriageWheelAngle,
      carriageWheelAngularSpeed,
      contacts,
      drivePulleyAngle: drumAngle,
      drivePulleyAngularSpeed: drumAngularSpeed,
      drumAngle,
      drumAngularAcceleration,
      drumAngularSpeed,
      drumResistanceTorque,
      inputPower,
      indicatorDeflection,
      loadFraction,
      loadFractionRate,
      periodicTime,
      phase,
      pointerAngle,
      rollingResistanceForce,
      springPoints: springPointsAtDeflection(indicatorDeflection),
      springTorque,
      testWeightY: THREE.MathUtils.lerp(
        testWeightHoistedY,
        testWeightLoadedY,
        loadFraction,
      ),
      tetherForce: new THREE.Vector3(rollingResistanceForce, 0, 0),
      tetherMoment,
      totalNormalLoad,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const wagonMaterial = matte(PALETTE.driver, {
    metalness: 0.06,
    roughness: 0.68,
  });
  const drumMaterial = matte(PALETTE.driven, {
    metalness: 0.11,
    roughness: 0.60,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.20,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const largeWheel = makeIndexedWheel({
    color: PALETTE.driven,
    radius: largeWheelRadius,
    rimTubeRadius: 0.075,
    spokes: 7,
    width: 0.42,
  });
  largeWheel.position.copy(largeWheelCenter);
  largeWheel.userData.role =
    'large-driven-test-wheel-supporting-both-carriage-wheels';
  root.add(largeWheel);

  const drivePulley = makePulley({
    radius: drivePulleyRadius,
    width: 0.22,
    color: PALETTE.brass,
    grooves: 1,
    spokes: 5,
  });
  drivePulley.position.copy(drivePulleyCenter);
  drivePulley.userData.role =
    'single-coaxial-belt-pulley-rigid-with-large-test-wheel';
  root.add(drivePulley);

  const belt = new THREE.Group();
  belt.userData.isBelt = true;
  belt.userData.role =
    'one-source-visible-endless-drive-belt-on-coaxial-pulley';
  // Brown draws a thin flat band (double line) round the pulley: the shared
  // flat-belt section, sitting in the pulley's channel.
  const beltPath = new THREE.CurvePath();
  beltPath.add(new THREE.LineCurve3(upperFreeEnd, upperTangent));
  const upperAngle = beltWrapStartAngle + beltWrapAngle;
  const wrapSteps = 96;
  let previous = upperTangent.clone();
  for (let step = 1; step <= wrapSteps; step += 1) {
    const angle = upperAngle - beltWrapAngle * step / wrapSteps;
    const next = step === wrapSteps ? lowerTangent.clone() : new THREE.Vector3(
      drivePulleyCenter.x + drivePulleyRadius * Math.cos(angle),
      drivePulleyCenter.y + drivePulleyRadius * Math.sin(angle),
      beltPlaneZ,
    );
    beltPath.add(new THREE.LineCurve3(previous, next));
    previous = next;
  }
  beltPath.add(new THREE.LineCurve3(lowerTangent, lowerFreeEnd));
  // A true flat belt: broad across the pulley face (0.22), thin radially.
  const beltWidth = 0.16;
  const beltThickness = 0.03;
  const beltBand = new THREE.Mesh(
    flatBeltGeometry(beltPath, {
      width: beltWidth,
      thickness: beltThickness,
      closed: false,
      segments: 512,
    }),
    matte(PALETTE.belt, { roughness: 0.76 }),
  );
  beltBand.userData.role = 'one-flat-belt-entering-from-left-with-half-wrap';
  beltBand.userData.crossSection = 'flat';
  belt.add(beltBand);
  // Brown crops the belt at the plate's left edge; its driving pulley is not
  // drawn, so both strands run straight on up-left past the crop and end
  // cleanly there (no remote pulley, standard or foot; p62 support rule).
  const runOn = 2.6;
  const runPath = new THREE.CurvePath();
  runPath.add(new THREE.LineCurve3(
    lowerFreeEnd,
    lowerFreeEnd.clone().add(new THREE.Vector3(-beltDirection.x * runOn, -beltDirection.y * runOn, 0)),
  ));
  const upperRunPath = new THREE.CurvePath();
  upperRunPath.add(new THREE.LineCurve3(
    upperFreeEnd.clone().add(new THREE.Vector3(-beltDirection.x * runOn, -beltDirection.y * runOn, 0)),
    upperFreeEnd,
  ));
  for (const [path, which] of [[runPath, 'lower'], [upperRunPath, 'upper']]) {
    const run = new THREE.Mesh(
      flatBeltGeometry(path, { width: beltWidth, thickness: beltThickness, closed: false, segments: 8 }),
      beltBand.material,
    );
    run.userData.role = `${which}-belt-strand-running-past-plate-crop`;
    run.userData.beyondPlateCrop = true;
    belt.add(run);
  }
  belt.userData.crossSection = 'flat';
  belt.userData.width = beltWidth;
  belt.userData.thickness = beltThickness;
  root.add(belt);

  const carriageWheels = carriageWheelCenters.map((center, index) => {
    const wheel = makeIndexedWheel({
      color: PALETTE.driver,
      radius: carriageWheelRadius,
      rimTubeRadius: 0.040,
      spokes: 5,
      width: 0.17,
    });
    wheel.position.copy(center);
    wheel.userData.index = index;
    wheel.userData.role =
      'stationary-axle-carriage-wheel-rolling-without-slip-on-drum';
    root.add(wheel);
    return wheel;
  });

  const wagon = new THREE.Group();
  wagon.userData.fixed = true;
  wagon.userData.role =
    'loaded-wagon-held-stationary-above-moving-test-wheel';
  root.add(wagon);
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(1.62, 0.13, 0.52),
    darkMaterial,
  );
  chassis.position.set(
    largeWheelCenter.x,
    leftCarriageWheelCenter.y + 0.22,
    0.08,
  );
  chassis.userData.role = 'fixed-wagon-chassis-joining-two-wheel-axles';
  wagon.add(chassis);
  const wagonBed = new THREE.Mesh(
    new THREE.BoxGeometry(1.68, 0.18, 0.58),
    wagonMaterial,
  );
  wagonBed.position.set(
    largeWheelCenter.x,
    leftCarriageWheelCenter.y + 0.42,
    0.08,
  );
  wagonBed.userData.role = 'wagon-load-bed';
  wagon.add(wagonBed);
  const wagonSides = [];
  for (const x of [largeWheelCenter.x - 0.79, largeWheelCenter.x + 0.79]) {
    const side = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.55, 0.58),
      wagonMaterial,
    );
    side.position.set(x, leftCarriageWheelCenter.y + 0.68, 0.08);
    side.rotation.z = x < largeWheelCenter.x ? -0.10 : 0.10;
    side.userData.role = 'raised-side-of-loaded-wagon';
    wagonSides.push(side);
    wagon.add(side);
  }
  const fixedLoads = [];
  for (const [index, x, y, width, height, rotation] of [
    [0, -1.28, 1.67, 0.50, 0.40, -0.10],
    [1, -0.78, 1.68, 0.43, 0.43, 0.08],
    [2, -0.35, 1.66, 0.35, 0.38, -0.07],
    [3, -0.93, 2.04, 0.47, 0.30, 0.04],
  ]) {
    const load = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 0.43),
      index % 2 === 0 ? drumMaterial : brassMaterial,
    );
    load.position.set(x, y, 0.10);
    load.rotation.z = rotation;
    load.userData.index = index;
    load.userData.role = 'fixed-base-load-in-source-loaded-wagon';
    fixedLoads.push(load);
    wagon.add(load);
  }
  const carriageAxlePins = carriageWheelCenters.map((center, index) => {
    const axlePin = cylinderAlongZ(0.060, 0.38, darkMaterial, 24);
    axlePin.position.copy(center);
    axlePin.userData.fixed = true;
    axlePin.userData.index = index;
    axlePin.userData.role = 'fixed-carriage-wheel-axle-pin';
    wagon.add(axlePin);
    return axlePin;
  });

  const testWeight = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.32, 0.45),
    brassMaterial,
  );
  testWeight.position.set(largeWheelCenter.x, testWeightHoistedY, 0.12);
  testWeight.userData.role =
    'didactic-removable-test-weight-showing-load-change';
  root.add(testWeight);
  const weightGuide = tubeBetween(
    new THREE.Vector3(largeWheelCenter.x, 2.78, 0.10),
    new THREE.Vector3(largeWheelCenter.x, 2.30, 0.10),
    0.012,
    darkMaterial,
  );
  weightGuide.userData.role =
    'didactic-guide-showing-removable-test-weight-motion';
  root.add(weightGuide);

  const dialFace = cylinderAlongZ(0.54, 0.10, whiteMaterial, 64);
  dialFace.position.copy(indicatorCenter);
  dialFace.userData.fixed = true;
  dialFace.userData.role = 'fixed-face-of-spiral-spring-force-indicator';
  root.add(dialFace);
  const dialRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.57, 0.045, 10, 80),
    darkMaterial,
  );
  dialRim.position.set(
    indicatorCenter.x,
    indicatorCenter.y,
    indicatorCenter.z + 0.08,
  );
  dialRim.userData.fixed = true;
  dialRim.userData.role = 'graduated-indicator-dial-rim';
  root.add(dialRim);
  const dialTicks = [];
  for (let index = 0; index < 24; index += 1) {
    const angle = index / 24 * FULL_TURN;
    const tick = new THREE.Mesh(
      // Brown graduates a band between two circles, each division
      // crossing the whole band.
      new THREE.BoxGeometry(0.13, 0.022, 0.026),
      darkMaterial,
    );
    tick.position.set(
      indicatorCenter.x + Math.cos(angle) * 0.47,
      indicatorCenter.y + Math.sin(angle) * 0.47,
      indicatorCenter.z + 0.15,
    );
    tick.rotation.z = angle;
    tick.userData.index = index;
    tick.userData.role = 'force-indicator-graduation';
    dialTicks.push(tick);
    root.add(tick);
  }
  const pointerPivot = new THREE.Group();
  pointerPivot.position.set(
    indicatorCenter.x,
    indicatorCenter.y,
    indicatorCenter.z + 0.19,
  );
  pointerPivot.userData.role =
    'spring-loaded-pointer-indicating-carriage-holding-force';
  root.add(pointerPivot);
  const pointer = new THREE.Mesh(
    new THREE.BoxGeometry(0.41, 0.050, 0.030),
    matte(PALETTE.driver, { roughness: 0.50 }),
  );
  pointer.position.x = 0.20;
  pointer.userData.role = 'force-indicator-pointer';
  pointerPivot.add(pointer);
  const pointerPin = cylinderAlongZ(0.075, 0.20, darkMaterial, 28);
  pointerPin.position.copy(indicatorCenter);
  pointerPin.position.z += 0.20;
  pointerPin.userData.role = 'indicator-pointer-pivot';
  root.add(pointerPin);

  const initialSpringPoints = springPointsAtDeflection(
    stateAtTime(0).indicatorDeflection,
  );
  const spiralGeometry = new THREE.BufferGeometry().setFromPoints(
    initialSpringPoints,
  );
  const spiralSpring = new THREE.Line(
    spiralGeometry,
    new THREE.LineBasicMaterial({ color: PALETTE.brass }),
  );
  spiralSpring.userData.role =
    'visible-spiral-spring-whose-inner-end-turns-with-pointer';
  root.add(spiralSpring);

  const tetherStart = new THREE.Vector3(
    largeWheelCenter.x + 0.84,
    indicatorCenter.y,
    0.36,
  );
  const tetherEnd = new THREE.Vector3(
    indicatorCenter.x - 0.10,
    indicatorCenter.y,
    0.36,
  );
  const tether = tubeBetween(
    tetherStart,
    tetherEnd,
    0.025,
    darkMaterial,
  );
  tether.userData.role =
    'horizontal-tether-holding-wagon-stationary-and-loading-indicator';
  root.add(tether);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(6.20, 0.16, 0.72),
    frameMaterial,
  );
  base.position.set(-0.10, -1.98, -0.08);
  base.userData.fixed = true;
  base.userData.role = 'fixed-test-rig-base';
  root.add(base);
  const supportBeams = [];
  for (const [start, end] of [
    [new THREE.Vector3(-2.03, -1.95, -0.16),
      new THREE.Vector3(-1.13, -0.55, -0.16)],
    [new THREE.Vector3(0.35, -1.95, -0.16),
      new THREE.Vector3(-0.51, -0.55, -0.16)],
    [new THREE.Vector3(1.18, -1.95, -0.16),
      new THREE.Vector3(2.58, -0.02, -0.16)],
  ]) {
    const support = beamBetween(start, end, 0.16, 0.30, frameMaterial);
    support.userData.fixed = true;
    support.userData.role = 'fixed-diagonal-test-rig-support';
    supportBeams.push(support);
    root.add(support);
  }
  const largeAxle = cylinderAlongZ(0.11, 0.50, darkMaterial, 28);
  largeAxle.position.copy(largeWheelCenter);
  largeAxle.userData.fixed = true;
  largeAxle.userData.role = 'fixed-axis-of-driven-test-wheel';
  root.add(largeAxle);
  const indicatorPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 3.04, 0.34),
    frameMaterial,
  );
  indicatorPost.position.set(2.77, -0.45, -0.08);
  indicatorPost.userData.fixed = true;
  indicatorPost.userData.role = 'fixed-indicator-support-standard';
  root.add(indicatorPost);
  const indicatorShelf = new THREE.Mesh(
    new THREE.BoxGeometry(1.48, 0.12, 0.43),
    frameMaterial,
  );
  indicatorShelf.position.set(2.05, 0.46, 0.03);
  indicatorShelf.userData.fixed = true;
  indicatorShelf.userData.role = 'fixed-shelf-beneath-spring-indicator';
  root.add(indicatorShelf);

  const contactMarkers = contactPoints.map((point, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 10),
      whiteMaterial,
    );
    marker.position.copy(point);
    marker.position.z += 0.25;
    marker.userData.index = index;
    marker.userData.role = 'one-of-two-exact-rolling-contact-markers';
    root.add(marker);
    return marker;
  });

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(largeWheel, state.drumAngle);
    setSpin(drivePulley, state.drivePulleyAngle);
    for (const wheel of carriageWheels) {
      setSpin(wheel, state.carriageWheelAngle);
    }
    testWeight.position.y = state.testWeightY;
    pointerPivot.rotation.z = state.pointerAngle;
    const springPosition = spiralSpring.geometry.attributes.position;
    for (let index = 0; index < state.springPoints.length; index += 1) {
      const point = state.springPoints[index];
      springPosition.setXYZ(index, point.x, point.y, point.z);
    }
    springPosition.needsUpdate = true;
    root.userData.currentState = state;
    root.userData.rollingContacts = state.contacts;
  };

  root.userData = {
    archetype: movement.archetype,
    blocks: {
      base,
      belt,
      beltBand,
      carriageAxlePins,
      carriageWheels,
      chassis,
      contactMarkers,
      dialFace,
      dialRim,
      dialTicks,
      drivePulley,
      fixedLoads,
      indicatorPost,
      indicatorShelf,
      largeAxle,
      largeWheel,
      pointer,
      pointerPin,
      pointerPivot,
      spiralSpring,
      supportBeams,
      testWeight,
      tether,
      wagon,
      wagonBed,
      wagonSides,
      weightGuide,
    },
    contactPoints,
    degreesOfFreedom: {
      independentPrescribedInputs: 2,
      input:
        'independently prescribed large-wheel speed and removable carriage load',
      note:
        'both wagon-wheel spins follow from two no-slip rolling constraints; the tether, wagon axes, and dial housing remain stationary, while the spiral spring follows force rather than speed',
      storedEnergyStates: 0,
    },
    dynamics: {
      empiricalLaw:
        'the reconstructed holding force equals an engineered rolling-resistance coefficient times total normal load and contains no velocity term',
      idealizations: [
        'rigid circular test and carriage wheels',
        'exact no-slip rolling at both visible contacts',
        'stationary carriage axles maintained by a massless horizontal tether',
        'quasi-static linear spiral-spring indication',
        'rolling resistance proportional to load and independent of speed, reproducing Robert’s reported observation',
      ],
      sourceSpecifiesDimensionsTimingSpringRateFrictionOrLoad: false,
      treatment:
        'Brown specifies the apparatus and qualitative result but no dimensions, timing, spring rate, friction coefficient, or test loads; the geometry and smooth demonstration schedule are engineered, while rolling rates are analytic and the force indication uses a prescribed empirical calibration; the internal indicator transmission and carriage reaction forces are not solved',
    },
    experiment: {
      addedNormalLoad,
      baseNormalLoad,
      indicatorMomentArm,
      rollingResistanceCoefficient,
      spiralSpringStiffness,
      speedIndependenceResidualAt: (timeA, timeB) => {
        const first = stateAtTime(timeA);
        const second = stateAtTime(timeB);
        if (Math.abs(first.loadFraction - second.loadFraction) > 1e-12) {
          return null;
        }
        return first.rollingResistanceForce
          - second.rollingResistanceForce;
      },
    },
    fidelity: 'authored',
    geometry: {
      axleCenterDistance,
      beltDirection,
      beltFreeLength,
      beltNormal,
      beltPlaneZ,
      beltWrapAngle,
      beltWrapStartAngle,
      carriageAxleHeight,
      carriageHalfSpacing,
      carriageWheelCenters,
      carriageWheelRadius,
      contactNormals,
      demonstrationPeriod,
      drivePulleyCenter,
      drivePulleyPitchPlaneCenter,
      drivePulleyRadius,
      drumStartAngle,
      drumTurnsPerCycle,
      indicatorCenter,
      largeWheelCenter,
      largeWheelRadius,
      lowerFreeEnd,
      lowerTangent,
      meanDrumAngularSpeed,
      pointerReferenceAngle,
      speedModulationAmplitude,
      speedModulationAngularFrequency,
      spiralInnerRadius,
      spiralCenter,
      spiralOuterRadius,
      spiralPlaneZ,
      spiralTurns,
      springSampleCount,
      testWeightHoistedY,
      testWeightLoadedY,
      upperFreeEnd,
      upperTangent,
      wheelPlaneZ,
      wheelRadiusRatio,
    },
    loadStateAtPhase,
    mechanism:
      'one-coaxially-belt-driven-large-test-wheel-supports-two-stationary-axle-wagon-wheels-in-exact-rolling-contact-while-one-horizontal-tether-loads-one-spiral-spring-force-indicator',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate373: {
        beltPulleyCenter: new THREE.Vector2(159, 289),
        dialCenter: new THREE.Vector2(360, 148),
        imageHeight: 525,
        imageWidth: 525,
        largeWheelCenter: new THREE.Vector2(151, 286),
        largeWheelTop: new THREE.Vector2(151, 160),
        leftWagonWheelCenter: new THREE.Vector2(111, 147),
        measurementUncertaintyPixels: 9,
        rightAnchorPostX: 463,
        rightWagonWheelCenter: new THREE.Vector2(206, 147),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'a loaded wagon is supported on the surface of a large wheel',
          'the wagon is connected to an indicator constructed with a spiral spring',
          'the indicator shows the force required to keep the carriage stationary',
          'the large wheel is put in motion',
          'changing velocity produced no indicator variation',
          'changing weight immediately changed the indication',
        ],
        engravingEvidence:
          'the plate shows two wagon wheels on one large wheel, a smaller coaxial drive pulley with a single belt entering from the left, a horizontal wagon tether, and one circular spring indicator fixed to a right-hand standard',
        reconstructionDisclosure:
          'wheel diameters, belt entry angle, colors, speed sweep, loads, rolling-resistance coefficient, spring rate, and display period are engineered because Brown gives no numerical values and the official page has no canvas animation; the vertically separated brass test weight is a disclosed didactic aid for making the load change visible and is not claimed as source hardware',
      },
      officialPage: 'https://507movements.com/mm_373.html',
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    springPointsAtDeflection,
    stateAtTime,
    timeline: {
      demonstrationPeriod,
      note:
        'one exact eight-second cycle contains two independently varying speed sweeps and one smooth add-remove load trial; the drum closes after two turns and the 5:1 wagon-wheel ratio closes after ten counter-turns',
      phases: {
        unloadedSpeedTrial: [0, 0.30],
        addLoad: [0.30, 0.38],
        loadedSpeedTrial: [0.38, 0.80],
        removeLoad: [0.80, 0.88],
        unloadedClosure: [0.88, 1],
      },
    },
    transmission: {
      beltLaw:
        'single belt linear speed equals coaxial pulley pitch radius times large-wheel angular speed',
      drivePulleyRatio: 1,
      rollingLaw:
        'omega_wagon = -(R_large/r_wagon) omega_large at both external rolling contacts',
      wagonWheelRatio: -wheelRadiusRatio,
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.00, -2.22, -0.55),
    new THREE.Vector3(3.04, 2.86, 0.92),
  );
  root.userData.groundFloorY = -2.07;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(3.2, 2.4, 11.5),
    root,
    update,
  };
}

// An angular stone: an icosahedron with deterministic radial jitter,
// scaled to width, height and depth, as Brown heaps rough stones.
function stoneGeometry(width, height, depth, seed, tilt = 0) {
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  const jitter = new Map();
  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i);
    const key = vertex.toArray().map((v) => v.toFixed(4)).join(',');
    if (!jitter.has(key)) {
      const n = jitter.size + 1;
      jitter.set(key, 0.80 + 0.30 * Math.abs(Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453 % 1));
    }
    vertex.multiplyScalar(jitter.get(key));
    position.setXYZ(i, vertex.x * width / 2, vertex.y * height / 2, vertex.z * depth / 2);
  }
  geometry.rotateZ(tilt);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

export function createAuthoredRollingFrictionExperimentMovement(movement) {
  if (movement.id !== 373) return null;
  const model = rollingCarriageFrictionExperiment(movement);
  correctRollerParts(model, 373);
  const {root} = model;
  const {blocks: b, geometry: g} = root.userData;
  const center = g.indicatorCenter;
  const dark = b.dialRim.material;
  // Brown's hand is an eyed pointer with a tapering blade; the eye rings the
  // pivot pin instead of the pin passing through a solid bar.
  const handShape = new THREE.Shape();
  handShape.absarc(0, 0, 0.13, 0.5, Math.PI * 2 - 0.5, false);
  handShape.lineTo(0.40, -0.012);
  handShape.lineTo(0.43, 0);
  handShape.lineTo(0.40, 0.012);
  handShape.closePath();
  const eye = new THREE.Path();
  eye.absarc(0, 0, 0.082, 0, Math.PI * 2, true);
  handShape.holes.push(eye);
  b.pointer.geometry.dispose();
  b.pointer.geometry = new THREE.ExtrudeGeometry(handShape, {
    bevelEnabled: false,
    curveSegments: 40,
    depth: 0.03,
  }).translate(0, 0, -0.015);
  b.pointer.position.x = 0;
  // The spring case is held to the standard by a threaded rod from a boss on
  // its right side through a lug behind the post, as Brown draws it.
  const screwZ = 0.34;
  const addFixed = (geometry, role, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, dark);
    mesh.position.set(x, y, z);
    mesh.userData.fixed = true;
    mesh.userData.role = role;
    root.add(mesh);
    return mesh;
  };
  const housingRight = center.x + 0.55;
  addFixed(new THREE.BoxGeometry(0.10, 0.18, 0.16),
    'indicator-case-boss-for-anchor-screw', housingRight + 0.03, center.y, screwZ);
  const screwEnd = 3.38;
  const screw = addFixed(
    new THREE.CylinderGeometry(0.045, 0.045, screwEnd - housingRight, 24)
      .rotateZ(Math.PI / 2),
    'threaded-anchor-screw-from-case-to-standard',
    (housingRight + screwEnd) / 2, center.y, screwZ);
  for (let x = housingRight + 0.12; x < screwEnd - 0.02; x += 0.045) {
    const thread = new THREE.Mesh(
      new THREE.TorusGeometry(0.047, 0.011, 6, 20).rotateY(Math.PI / 2),
      dark,
    );
    thread.position.set(x - screw.position.x, 0, 0);
    thread.userData.role = 'anchor-screw-thread-ridge';
    screw.add(thread);
  }
  const post = b.indicatorPost;
  const postBack = post.position.z - post.geometry.parameters.depth / 2;
  addFixed(new THREE.BoxGeometry(post.geometry.parameters.width, 0.24, postBack - (screwZ - 0.10)),
    'anchor-screw-lug-behind-standard', post.position.x, center.y,
    (postBack + screwZ - 0.10) / 2);
  addFixed(new THREE.BoxGeometry(0.07, 0.16, 0.16),
    'anchor-screw-nut', post.position.x + post.geometry.parameters.width / 2 + 0.035,
    center.y, screwZ);
  // The test load is shown heaped in the wagon in proportion to the added
  // load, never hanging in the air above it (Brown draws a loaded wagon).
  const bedTop = b.wagonBed.position.y + 0.09;
  root.userData.testLoadHeap = {bedTop, law: 'heap top = bed top + load fraction * full heap height; hidden when unloaded'};
  const heapHeight = b.testWeight.geometry.parameters.height;
  // Brown heaps rough stones in the wagon, not boards: the four fixed loads
  // become angular stones standing on the bed on either side of the centre,
  // with smaller stones packed between them, and the added test load is a
  // heap of stones in the centre.
  const stoneSpecs = [
    // x, width, height, depth, tilt
    [-1.38, 0.26, 0.78, 0.36, -0.28],
    [-1.16, 0.25, 0.92, 0.38, 0.16],
    [-0.46, 0.25, 0.88, 0.36, -0.20],
    [-0.24, 0.26, 0.74, 0.38, 0.30],
  ];
  const settle = (mesh, x) => {
    const box = mesh.geometry.boundingBox;
    mesh.position.set(x - (box.min.x + box.max.x) / 2,
      bedTop - box.min.y + 0.003, 0.10);
    mesh.rotation.set(0, 0, 0);
  };
  b.fixedLoads.forEach((load, index) => {
    const [x, width, height, depth, tilt] = stoneSpecs[index];
    load.geometry.dispose();
    load.geometry = stoneGeometry(width, height, depth, index + 1, tilt);
    settle(load, x);
    load.userData.role = 'fixed-base-load-in-source-loaded-wagon';
  });
  b.packedStones = [
    [-1.27, 0.22, 0.46, 0.30, 0.6],
    [-0.35, 0.22, 0.50, 0.30, -0.5],
  ].map(([x, width, height, depth, tilt], index) => {
    const stone = new THREE.Mesh(
      stoneGeometry(width, height, depth, index + 11, tilt),
      b.fixedLoads[index * 2].material,
    );
    settle(stone, x);
    stone.position.z = 0.02;
    stone.userData.role = 'fixed-stone-packed-in-loaded-wagon';
    b.wagon.add(stone);
    return stone;
  });
  {
    const weightWidth = b.testWeight.geometry.parameters.width;
    const weightDepth = b.testWeight.geometry.parameters.depth;
    const parts = [
      [-0.11, 0.20, 1.00, 0.9, 0.25],
      [0.10, 0.19, 0.86, 0.9, -0.20],
      [0.00, 0.16, 0.62, 0.8, 0.05],
    ].map(([cx, width, height, depth, tilt], index) => {
      const geometry = stoneGeometry(width, height * heapHeight,
        depth * weightDepth, index + 21, tilt);
      const box = geometry.boundingBox;
      geometry.translate(cx - (box.min.x + box.max.x) / 2,
        -heapHeight / 2 - box.min.y, 0);
      return geometry;
    });
    const heap = mergeGeometries(parts);
    heap.computeBoundingBox();
    const box = heap.boundingBox;
    const sx = weightWidth / (box.max.x - box.min.x);
    const sy = heapHeight / (box.max.y - box.min.y);
    heap.translate(-(box.min.x + box.max.x) / 2, 0, 0);
    heap.scale(Math.min(1, sx), Math.min(1, sy), 1);
    heap.computeBoundingBox();
    heap.translate(0, -heapHeight / 2 - heap.boundingBox.min.y, 0);
    heap.parameters = { depth: weightDepth, height: heapHeight, width: weightWidth };
    b.testWeight.geometry.dispose();
    b.testWeight.geometry = heap;
  }
  // Brown crops the belt at the plate's left edge. A belt is endless, so
  // past that crop it wraps a plain driving pulley of the same size (the
  // strands are parallel), cloned from the drawn pulley and carried on a bare
  // shaft stub: no post, standard or base. It lies wholly beyond the plate.
  {
    for (const run of [...b.belt.children]) {
      if (!run.userData.beyondPlateCrop) continue;
      b.belt.remove(run);
      run.geometry.dispose();
    }
    const direction = g.beltDirection, normal = g.beltNormal, radius = g.drivePulleyRadius;
    const reach = g.beltFreeLength + 3.2;
    const remoteCenter = new THREE.Vector3(
      b.drivePulley.position.x - direction.x * reach,
      b.drivePulley.position.y - direction.y * reach,
      b.drivePulley.position.z,
    );
    const at = (angle) => new THREE.Vector3(
      remoteCenter.x + radius * Math.cos(angle), remoteCenter.y + radius * Math.sin(angle), g.beltPlaneZ);
    const lowerFree = g.lowerFreeEnd.clone(), upperFree = g.upperFreeEnd.clone();
    const path = new THREE.CurvePath();
    const directionAngle = Math.atan2(direction.y, direction.x);
    let previous = at(directionAngle - Math.PI / 2);
    path.add(new THREE.LineCurve3(lowerFree, previous));
    const wrapSteps = 96;
    for (let step = 1; step <= wrapSteps; step += 1) {
      const next = at(directionAngle - Math.PI / 2 - Math.PI * step / wrapSteps);
      path.add(new THREE.LineCurve3(previous, next));
      previous = next;
    }
    path.add(new THREE.LineCurve3(previous, upperFree));
    const loop = new THREE.Mesh(
      flatBeltGeometry(path, { width: b.belt.userData.width, thickness: b.belt.userData.thickness, closed: false, segments: 256 }),
      b.beltBand.material,
    );
    loop.userData.role = 'belt-running-on-past-plate-crop-round-driving-pulley';
    loop.userData.beyondPlateCrop = true;
    b.belt.add(loop);
    const rotorPath = [];
    for (let o = b.drivePulley.userData.rotor; o && o !== b.drivePulley; o = o.parent) rotorPath.unshift(o.parent.children.indexOf(o));
    const remotePulley = b.drivePulley.clone(true);
    remotePulley.position.copy(remoteCenter);
    remotePulley.userData = { role: 'plain-driving-pulley-beyond-plate-crop', beyondPlateCrop: true };
    remotePulley.userData.rotor = rotorPath.reduce((o, i) => o.children[i], remotePulley);
    remotePulley.traverse((o) => {
      o.userData.beyondPlateCrop = true;
      if (o !== remotePulley && o.userData.role) o.userData.role = `driving-pulley-${o.userData.role}`;
    });
    root.add(remotePulley);
    const stub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.62, 24).rotateX(Math.PI / 2),
      b.largeAxle.material,
    );
    stub.position.set(remoteCenter.x, remoteCenter.y, g.beltPlaneZ - 0.12);
    stub.userData = { role: 'bare-driving-shaft-stub-beyond-plate-crop', fixed: true, beyondPlateCrop: true };
    root.add(stub);
    b.remotePulley = remotePulley;
    b.remoteShaftStub = stub;
    g.remotePulleyCenter = remoteCenter.clone();
  }
  const baseUpdate = model.update;
  model.update = (time) => {
    baseUpdate(time);
    setSpin(b.remotePulley, root.userData.currentState?.drivePulleyAngle ?? 0);
    const fraction = root.userData.currentState?.loadFraction
      ?? root.userData.stateAtTime(time).loadFraction;
    // With no added load the heap is hidden, parked at its seated pose.
    const shown = fraction > 1e-4 ? fraction : 1;
    b.testWeight.visible = fraction > 1e-4;
    b.testWeight.scale.y = shown;
    b.testWeight.position.y = bedTop + shown * heapHeight / 2;
  };
  const bounds = new THREE.Box3();
  for (let i = 0; i <= 64; i += 1) {
    model.update(root.userData.minimumDisplayCycleSeconds * i / 64);
    root.updateMatrixWorld(true);
    root.traverseVisible((o) => {
      if (!o.geometry || o.userData.beyondPlateCrop) return;
      o.geometry.computeBoundingBox();
      bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
    });
  }
  root.userData.cameraFitBounds = bounds.expandByScalar(0.04);
  model.update(0);
  return model;
}
