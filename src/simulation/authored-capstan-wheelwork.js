import { correctCapstanWheelwork } from './capstan-entwistle-corrections.js';
import * as THREE from 'three';
import { plate, poly, circle, capsule, polygonClipping as clip } from './finite-plate-geometry.js';
import {
  PALETTE,
  makeGear,
  makeInvoluteInternalGear,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherStep(value) {
  const bounded = THREE.MathUtils.clamp(value, 0, 1);
  return bounded * bounded * bounded
    * (bounded * (bounded * 6 - 15) + 10);
}

function smootherStepDerivative(value) {
  const bounded = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * bounded * bounded
    * (bounded - 1) * (bounded - 1);
}

function smootherStepSecondDerivative(value) {
  const bounded = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * bounded
    * (2 * bounded * bounded - 3 * bounded + 1);
}

function signedAngleError(angle) {
  return positiveModulo(angle + Math.PI, FULL_TURN) - Math.PI;
}

function cylinderAlongY(radius, height, material, segments = 48) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, segments),
    material,
  );
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = cylinderAlongY(radius, length, material, segments);
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function torusNormalToY(majorRadius, tubeRadius, material, segments = 72) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(majorRadius, tubeRadius, 12, segments),
    material,
  );
  torus.rotation.x = Math.PI / 2;
  return torus;
}

function annularDiskNormalToY({
  depth,
  innerRadius,
  material,
  outerRadius,
}) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: Math.min(0.018, depth * 0.08),
    bevelThickness: Math.min(0.018, depth * 0.08),
    curveSegments: 64,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  const disk = new THREE.Mesh(geometry, material);
  disk.rotation.x = Math.PI / 2;
  return disk;
}

function beamBetweenXZ(start, end, width, height, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(
      Math.hypot(delta.x, delta.z),
      height,
      width,
    ),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.y = -Math.atan2(delta.z, delta.x);
  return beam;
}

function beamBetweenXY(start, end, width, depth, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(
      Math.hypot(delta.x, delta.y),
      width,
      depth,
    ),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(delta.y, delta.x);
  return beam;
}

function profile(span, duration, elapsed) {
  const unitTime = THREE.MathUtils.clamp(elapsed / duration, 0, 1);
  return {
    acceleration: span * smootherStepSecondDerivative(unitTime)
      / (duration * duration),
    displacement: span * smootherStep(unitTime),
    speed: span * smootherStepDerivative(unitTime) / duration,
    unitTime,
  };
}

function capstanWheelwork(movement) {
  const root = new THREE.Group();
  const cycleDuration = 12;
  const directDriveDuration = 3;
  const directClutchReleaseDuration = 1;
  const carrierBrakeEngagementDuration = 1;
  const compoundDriveDuration = 5;
  const carrierBrakeReleaseDuration = 1;
  const directClutchEngagementDuration = 1;
  const module = 0.12;
  const sunTeeth = 15;
  const planetTeeth = 15;
  const annulusTeeth = 45;
  const sunPitchRadius = sunTeeth * module / 2;
  const planetPitchRadius = planetTeeth * module / 2;
  const annulusPitchRadius = annulusTeeth * module / 2;
  const planetCenterRadius = sunPitchRadius + planetPitchRadius;
  const internalCenterRadius = annulusPitchRadius - planetPitchRadius;
  const annulusOuterRadius = annulusPitchRadius + module * 2.75;
  const gearDepth = 0.32;
  const gearPlaneY = 0.72;
  const planetAngles = [0, FULL_TURN / 3, FULL_TURN * 2 / 3];
  const directInputTurns = 1;
  const compoundInputTurns = 3;
  const compoundOutputTurns = -1;
  const directClutchEngagedY = 3.08;
  const directClutchReleasedY = 3.48;
  const carrierBrakeEngagedY = 0.49;
  const carrierBrakeReleasedY = 1.20;
  const clutchDogCount = 6;
  const geometry = {
    annulusOuterRadius,
    annulusPitchRadius,
    annulusTeeth,
    carrierBrakeEngagedY,
    carrierBrakeReleasedY,
    clutchDogCount,
    compoundInputTurns,
    compoundOutputTurns,
    cycleDuration,
    directClutchEngagedY,
    directClutchReleasedY,
    directInputTurns,
    gearDepth,
    gearPlaneY,
    internalCenterRadius,
    module,
    planetAngles,
    planetCenterRadius,
    planetPitchRadius,
    planetTeeth,
    sunPitchRadius,
    sunTeeth,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.30,
    roughness: 0.48,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.42,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.50,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    roughness: 0.48,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.38 });
  const barrelSkinMaterial = matte(PALETTE.driven, {
    metalness: 0.06,
    opacity: 0.14,
    roughness: 0.58,
    transparent: true,
  });
  barrelSkinMaterial.depthWrite = false;
  barrelSkinMaterial.side = THREE.DoubleSide;

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'stationary-capstan-base-and-selector-frame';
  root.add(fixedFrame);
  const foundation = cylinderAlongY(3.72, 0.26, frameMaterial, 72);
  foundation.position.y = 0.13;
  foundation.userData.role = 'fixed-circular-capstan-foundation';
  fixedFrame.add(foundation);
  const centerBearing = cylinderAlongY(0.40, 0.62, darkMaterial, 40);
  centerBearing.position.y = 0.48;
  centerBearing.userData.role =
    'fixed-central-spindle-bearing-in-capstan-base';
  fixedFrame.add(centerBearing);

  const carrierRotor = new THREE.Group();
  carrierRotor.userData.role =
    'three-planet-carrier-free-in-direct-mode-and-base-braked-in-compound-mode';
  root.add(carrierRotor);
  const carrierHub = cylinderAlongY(0.52, 0.20, accentMaterial, 42);
  carrierHub.position.y = 0.43;
  carrierHub.userData.role = 'planet-carrier-central-web-hub';
  carrierRotor.add(carrierHub);
  const carrierArms = planetAngles.map((angle, index) => {
    const end = new THREE.Vector3(
      Math.cos(angle) * (planetCenterRadius + 0.30),
      0.43,
      Math.sin(angle) * (planetCenterRadius + 0.30),
    );
    const arm = beamBetweenXZ(
      new THREE.Vector3(0, 0.43, 0),
      end,
      0.34,
      0.16,
      accentMaterial,
    );
    arm.userData.role = `carrier-arm-to-planet-${index + 1}`;
    carrierRotor.add(arm);
    return arm;
  });
  const carrierLugs = [-1, 1].map((side) => {
    const lug = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.18, 0.72),
      accentMaterial,
    );
    lug.position.set(side * 3.27, 0.43, 0);
    lug.userData.role = side < 0
      ? 'left-carrier-brake-lug-with-pin-hole'
      : 'right-carrier-brake-lug-with-pin-hole';
    carrierRotor.add(lug);
    const hole = cylinderAlongY(0.11, 0.20, darkMaterial, 24);
    hole.position.set(side * 3.27, 0.44, 0);
    hole.userData.role = `${lug.userData.role}-dark-bore`;
    carrierRotor.add(hole);
    return { hole, lug };
  });
  const carrierIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 0.035, 0.52),
    whiteMaterial,
  );
  carrierIndex.position.set(0, 0.535, 2.08);
  carrierIndex.userData.role = 'white-planet-carrier-rotation-index';
  carrierRotor.add(carrierIndex);

  const planets = planetAngles.map((angle, index) => {
    const planet = makeGear({
      axis: Y_AXIS,
      color: PALETTE.accent,
      depth: gearDepth,
      radius: planetPitchRadius,
      teeth: planetTeeth,
      toothHeight: module * 2,
      pressureAngle: 25 * Math.PI / 180,
    });
    planet.position.set(
      Math.cos(angle) * planetCenterRadius,
      gearPlaneY,
      Math.sin(angle) * planetCenterRadius,
    );
    planet.userData.role =
      `equal-fixed-axis-idler-pinion-${index + 1}-on-carrier`;
    carrierRotor.add(planet);
    return planet;
  });

  const spindleRotor = new THREE.Group();
  spindleRotor.userData.role =
    'drumhead-central-spindle-and-fifteen-tooth-sun-input';
  root.add(spindleRotor);
  const spindle = cylinderAlongY(0.23, 4.30, darkMaterial, 40);
  spindle.position.y = 2.21;
  spindle.userData.role = 'central-spindle-rigidly-fixed-to-drumhead';
  spindleRotor.add(spindle);
  const sunGear = makeGear({
    axis: Y_AXIS,
    color: PALETTE.driver,
    depth: gearDepth,
    radius: sunPitchRadius,
    teeth: sunTeeth,
    toothHeight: module * 2,
    pressureAngle: 25 * Math.PI / 180,
  });
  sunGear.position.y = gearPlaneY;
  sunGear.userData.role = 'fifteen-tooth-central-sun-on-spindle';
  spindleRotor.add(sunGear);

  const drumhead = cylinderAlongY(2.32, 0.46, driverMaterial, 64);
  drumhead.position.y = 3.76;
  drumhead.userData.role = 'input-drumhead-rigidly-fixed-on-spindle';
  spindleRotor.add(drumhead);
  const drumheadLowerRim = torusNormalToY(2.24, 0.12, darkMaterial, 88);
  drumheadLowerRim.position.y = 3.53;
  drumheadLowerRim.userData.role = 'drumhead-lower-rim';
  spindleRotor.add(drumheadLowerRim);
  const drumheadUpperRim = torusNormalToY(2.24, 0.12, darkMaterial, 88);
  drumheadUpperRim.position.y = 3.99;
  drumheadUpperRim.userData.role = 'drumhead-upper-rim';
  spindleRotor.add(drumheadUpperRim);
  const capstanBars = Array.from({ length: 3 }, (_, index) => {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(5.72, 0.16, 0.18),
      darkMaterial,
    );
    bar.position.y = 3.80 + index * 0.012;
    bar.rotation.y = index * Math.PI / 3;
    bar.userData.role = `drumhead-handspike-${index + 1}`;
    spindleRotor.add(bar);
    return bar;
  });
  const drumheadIndex = new THREE.Mesh(
    new THREE.BoxGeometry(1.52, 0.035, 0.13),
    whiteMaterial,
  );
  drumheadIndex.position.set(1.08, 4.006, 0);
  drumheadIndex.userData.role = 'white-drumhead-input-rotation-index';
  spindleRotor.add(drumheadIndex);

  const barrelRotor = new THREE.Group();
  barrelRotor.userData.role =
    'independent-barrel-and-forty-five-tooth-internal-annulus-output';
  root.add(barrelRotor);
  const annulusGear = makeInvoluteInternalGear({
    axis: Y_AXIS,
    color: PALETTE.driven,
    depth: gearDepth,
    module,
    outerRadius: annulusOuterRadius,
    pitchRadius: annulusPitchRadius,
    teeth: annulusTeeth,
    toothIndexOffset: Math.PI / annulusTeeth,
    pressureAngle: 25 * Math.PI / 180,
    backlash: .001,
  });
  annulusGear.position.y = gearPlaneY;
  annulusGear.userData.role =
    'forty-five-tooth-internal-annulus-rigid-with-barrel';
  barrelRotor.add(annulusGear);
  const annulusIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.035, 0.15),
    whiteMaterial,
  );
  // On the plain rim outside the tooth roots, clear of the carried pinions.
  annulusIndex.position.set(0, gearPlaneY + gearDepth / 2 + 0.05,
    (annulusPitchRadius + module * 1.25 + annulusOuterRadius) / 2);
  annulusIndex.userData.role = 'white-annulus-output-rotation-index';
  barrelRotor.add(annulusIndex);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(1.51, 1.82, 1.66, 64, 1, true),
    barrelSkinMaterial,
  );
  barrel.position.y = 1.97;
  barrel.userData.role =
    'independent-rope-barrel-transparent-display-skin';
  barrelRotor.add(barrel);
  const barrelLowerRim = torusNormalToY(1.83, 0.10, darkMaterial, 72);
  barrelLowerRim.position.y = 1.13;
  barrelLowerRim.userData.role = 'barrel-lower-flange';
  barrelRotor.add(barrelLowerRim);
  const barrelUpperRim = torusNormalToY(1.65, 0.11, darkMaterial, 72);
  barrelUpperRim.position.y = 2.80;
  barrelUpperRim.userData.role = 'barrel-upper-flange';
  barrelRotor.add(barrelUpperRim);
  const barrelWhelps = Array.from({ length: 8 }, (_, index) => {
    const angle = FULL_TURN * index / 8;
    const radius = 1.66;
    const whelp = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 1.38, 0.20),
      drivenMaterial,
    );
    whelp.position.set(
      Math.cos(angle) * radius,
      1.97,
      Math.sin(angle) * radius,
    );
    whelp.rotation.y = -angle;
    whelp.userData.role = `barrel-whelp-${index + 1}`;
    barrelRotor.add(whelp);
    return whelp;
  });
  const barrelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 1.22, 0.06),
    whiteMaterial,
  );
  barrelIndex.position.set(1.69, 1.98, 0);
  barrelIndex.rotation.y = Math.PI / 2;
  barrelIndex.userData.role = 'white-barrel-output-rotation-index';
  barrelRotor.add(barrelIndex);
  const barrelIndexBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 20, 14),
    whiteMaterial,
  );
  barrelIndexBall.position.set(1.20, 2.47, 1.20);
  barrelIndexBall.userData.role =
    'white-barrel-whelp-output-rotation-index-ball';
  barrelRotor.add(barrelIndexBall);

  const barrelClutchCrown = new THREE.Group();
  barrelClutchCrown.userData.role =
    'barrel-side-six-dog-direct-clutch-crown';
  barrelRotor.add(barrelClutchCrown);
  const barrelCrownRing = annularDiskNormalToY({
    depth: 0.12,
    innerRadius: 0.45,
    material: drivenMaterial,
    outerRadius: 0.88,
  });
  barrelCrownRing.position.y = 2.94;
  barrelClutchCrown.add(barrelCrownRing);
  const barrelCrownDogs = Array.from({ length: clutchDogCount }, (_, index) => {
    const angle = FULL_TURN * (index + 0.5) / clutchDogCount;
    const dog = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.25, 0.22),
      drivenMaterial,
    );
    dog.position.set(
      Math.cos(angle) * 0.68,
      3.02,
      Math.sin(angle) * 0.68,
    );
    dog.rotation.y = -angle;
    dog.userData.role = `barrel-direct-clutch-dog-${index + 1}`;
    barrelClutchCrown.add(dog);
    return dog;
  });

  const directClutch = new THREE.Group();
  directClutch.userData.role =
    'axially-sliding-dog-clutch-locking-drumhead-to-barrel';
  spindleRotor.add(directClutch);
  const directClutchCollar = annularDiskNormalToY({
    depth: 0.18,
    innerRadius: 0.27,
    material: driverMaterial,
    outerRadius: 0.84,
  });
  directClutchCollar.userData.role = 'spindle-keyed-direct-clutch-collar';
  directClutch.add(directClutchCollar);
  const directClutchDogs = Array.from(
    { length: clutchDogCount },
    (_, index) => {
      const angle = FULL_TURN * index / clutchDogCount;
      const dog = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.29, 0.22),
        driverMaterial,
      );
      dog.position.set(
        Math.cos(angle) * 0.68,
        -0.12,
        Math.sin(angle) * 0.68,
      );
      dog.rotation.y = -angle;
      dog.userData.role = `spindle-direct-clutch-dog-${index + 1}`;
      directClutch.add(dog);
      return dog;
    },
  );
  const clutchWhiteIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.04, 0.09),
    whiteMaterial,
  );
  clutchWhiteIndex.position.set(0.61, 0.11, 0);
  clutchWhiteIndex.userData.role = 'white-direct-clutch-engagement-index';
  directClutch.add(clutchWhiteIndex);
  const clutchWhiteRing = torusNormalToY(0.82, 0.032, whiteMaterial, 56);
  clutchWhiteRing.position.y = 0.11;
  clutchWhiteRing.userData.role =
    'white-ring-following-axial-direct-clutch-position';
  directClutch.add(clutchWhiteRing);

  const carrierBrake = new THREE.Group();
  carrierBrake.userData.role =
    'two-pin-base-brake-fixing-planet-carrier-for-triple-purchase';
  fixedFrame.add(carrierBrake);
  const carrierBrakePins = [-1, 1].map((side) => {
    const guidePost = cylinderAlongY(0.24, 0.54, frameMaterial, 28);
    guidePost.position.set(side * 3.27, 0.98, 0);
    guidePost.userData.role = side < 0
      ? 'left-fixed-carrier-brake-guide'
      : 'right-fixed-carrier-brake-guide';
    carrierBrake.add(guidePost);
    const pin = cylinderAlongY(0.095, 0.62, accentMaterial, 28);
    pin.position.set(side * 3.27, carrierBrakeReleasedY, 0);
    pin.userData.role = side < 0
      ? 'left-sliding-carrier-brake-pin'
      : 'right-sliding-carrier-brake-pin';
    carrierBrake.add(pin);
    const whiteBand = torusNormalToY(0.10, 0.024, whiteMaterial, 32);
    whiteBand.position.set(side * 3.27, carrierBrakeReleasedY + 0.18, 0);
    whiteBand.userData.role = `${pin.userData.role}-white-position-band`;
    carrierBrake.add(whiteBand);
    return { pin, whiteBand };
  });

  const selector = new THREE.Group();
  selector.position.set(3.50, 1.44, -0.52);
  selector.userData.role =
    'coordinated-direct-clutch-and-carrier-brake-selector';
  fixedFrame.add(selector);
  const selectorPivot = cylinderAlongZ(0.19, 0.42, darkMaterial, 30);
  selectorPivot.userData.role = 'selector-hand-lever-fixed-pivot';
  selector.add(selectorPivot);
  const selectorLever = beamBetweenXY(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1.02, 0, 0),
    0.16,
    0.18,
    accentMaterial,
  );
  selectorLever.userData.role =
    'selector-lever-direct-left-neutral-center-compound-right';
  selector.add(selectorLever);
  const selectorHandle = new THREE.Mesh(
    new THREE.SphereGeometry(0.20, 24, 16),
    darkMaterial,
  );
  selectorHandle.position.x = 1.04;
  selectorHandle.userData.role = 'selector-lever-handle';
  selector.add(selectorHandle);

  function stateAtTime(time) {
    const cycleTime = positiveModulo(time, cycleDuration);
    let stage;
    let sunAngle;
    let sunAngularSpeed = 0;
    let sunAngularAcceleration = 0;
    let carrierAngle;
    let carrierAngularSpeed = 0;
    let carrierAngularAcceleration = 0;
    let annulusAngle;
    let annulusAngularSpeed = 0;
    let annulusAngularAcceleration = 0;
    let directClutchEngagement;
    let directClutchEngagementSpeed = 0;
    let carrierBrakeEngagement;
    let carrierBrakeEngagementSpeed = 0;

    if (cycleTime < directDriveDuration) {
      stage = 'locked-single-purchase-direct-drive';
      const drive = profile(
        directInputTurns * FULL_TURN,
        directDriveDuration,
        cycleTime,
      );
      sunAngle = drive.displacement;
      sunAngularSpeed = drive.speed;
      sunAngularAcceleration = drive.acceleration;
      carrierAngle = sunAngle;
      carrierAngularSpeed = sunAngularSpeed;
      carrierAngularAcceleration = sunAngularAcceleration;
      annulusAngle = sunAngle;
      annulusAngularSpeed = sunAngularSpeed;
      annulusAngularAcceleration = sunAngularAcceleration;
      directClutchEngagement = 1;
      carrierBrakeEngagement = 0;
    } else if (
      cycleTime < directDriveDuration + directClutchReleaseDuration
    ) {
      stage = 'stationary-direct-clutch-release';
      const shift = profile(
        1,
        directClutchReleaseDuration,
        cycleTime - directDriveDuration,
      );
      sunAngle = directInputTurns * FULL_TURN;
      carrierAngle = sunAngle;
      annulusAngle = sunAngle;
      directClutchEngagement = 1 - shift.displacement;
      directClutchEngagementSpeed = -shift.speed;
      carrierBrakeEngagement = 0;
    } else if (
      cycleTime < directDriveDuration
        + directClutchReleaseDuration
        + carrierBrakeEngagementDuration
    ) {
      stage = 'stationary-carrier-brake-engagement';
      const shift = profile(
        1,
        carrierBrakeEngagementDuration,
        cycleTime - directDriveDuration - directClutchReleaseDuration,
      );
      sunAngle = directInputTurns * FULL_TURN;
      carrierAngle = sunAngle;
      annulusAngle = sunAngle;
      directClutchEngagement = 0;
      carrierBrakeEngagement = shift.displacement;
      carrierBrakeEngagementSpeed = shift.speed;
    } else if (
      cycleTime < directDriveDuration
        + directClutchReleaseDuration
        + carrierBrakeEngagementDuration
        + compoundDriveDuration
    ) {
      stage = 'unlocked-triple-purchase-compound-drive';
      const compoundStart = directDriveDuration
        + directClutchReleaseDuration
        + carrierBrakeEngagementDuration;
      const drive = profile(
        compoundInputTurns * FULL_TURN,
        compoundDriveDuration,
        cycleTime - compoundStart,
      );
      sunAngle = directInputTurns * FULL_TURN + drive.displacement;
      sunAngularSpeed = drive.speed;
      sunAngularAcceleration = drive.acceleration;
      carrierAngle = directInputTurns * FULL_TURN;
      annulusAngle = directInputTurns * FULL_TURN
        - drive.displacement * sunTeeth / annulusTeeth;
      annulusAngularSpeed = -drive.speed * sunTeeth / annulusTeeth;
      annulusAngularAcceleration = -drive.acceleration
        * sunTeeth / annulusTeeth;
      directClutchEngagement = 0;
      carrierBrakeEngagement = 1;
    } else if (
      cycleTime < cycleDuration - directClutchEngagementDuration
    ) {
      stage = 'stationary-carrier-brake-release';
      const releaseStart = directDriveDuration
        + directClutchReleaseDuration
        + carrierBrakeEngagementDuration
        + compoundDriveDuration;
      const shift = profile(
        1,
        carrierBrakeReleaseDuration,
        cycleTime - releaseStart,
      );
      sunAngle = (directInputTurns + compoundInputTurns) * FULL_TURN;
      carrierAngle = directInputTurns * FULL_TURN;
      annulusAngle = (directInputTurns + compoundOutputTurns) * FULL_TURN;
      directClutchEngagement = 0;
      carrierBrakeEngagement = 1 - shift.displacement;
      carrierBrakeEngagementSpeed = -shift.speed;
    } else {
      stage = 'stationary-direct-clutch-engagement';
      const shift = profile(
        1,
        directClutchEngagementDuration,
        cycleTime - cycleDuration + directClutchEngagementDuration,
      );
      sunAngle = (directInputTurns + compoundInputTurns) * FULL_TURN;
      carrierAngle = directInputTurns * FULL_TURN;
      annulusAngle = (directInputTurns + compoundOutputTurns) * FULL_TURN;
      directClutchEngagement = shift.displacement;
      directClutchEngagementSpeed = shift.speed;
      carrierBrakeEngagement = 0;
    }

    const planetRelativeAngle = -sunTeeth / planetTeeth
      * (sunAngle - carrierAngle);
    const planetRelativeAngularSpeed = -sunTeeth / planetTeeth
      * (sunAngularSpeed - carrierAngularSpeed);
    const planetRelativeAngularAcceleration = -sunTeeth / planetTeeth
      * (sunAngularAcceleration - carrierAngularAcceleration);
    const planetAngle = carrierAngle + planetRelativeAngle;
    const planetAngularSpeed = carrierAngularSpeed
      + planetRelativeAngularSpeed;
    const planetAngularAcceleration = carrierAngularAcceleration
      + planetRelativeAngularAcceleration;
    const directClutchY = THREE.MathUtils.lerp(
      directClutchReleasedY,
      directClutchEngagedY,
      directClutchEngagement,
    );
    const carrierBrakeY = THREE.MathUtils.lerp(
      carrierBrakeReleasedY,
      carrierBrakeEngagedY,
      carrierBrakeEngagement,
    );
    const selectorPosition = (
      1 - directClutchEngagement + carrierBrakeEngagement
    ) / 2;
    const willisAngleResidual = sunTeeth * (sunAngle - carrierAngle)
      + annulusTeeth * (annulusAngle - carrierAngle);
    const willisSpeedResidual = sunTeeth
      * (sunAngularSpeed - carrierAngularSpeed)
      + annulusTeeth
      * (annulusAngularSpeed - carrierAngularSpeed);
    const externalMeshAngleResidual = sunTeeth
      * (sunAngle - carrierAngle)
      + planetTeeth * planetRelativeAngle;
    const internalMeshAngleResidual = annulusTeeth
      * (annulusAngle - carrierAngle)
      - planetTeeth * planetRelativeAngle;

    return {
      activeDriveCoordinates: [
        Math.abs(sunAngularSpeed) > 1e-12,
        Math.abs(directClutchEngagementSpeed) > 1e-12,
        Math.abs(carrierBrakeEngagementSpeed) > 1e-12,
      ].filter(Boolean).length,
      annulusAngle,
      annulusAngularAcceleration,
      annulusAngularSpeed,
      carrierAngle,
      carrierAngularAcceleration,
      carrierAngularSpeed,
      carrierBrakeEngagement,
      carrierBrakeEngagementSpeed,
      carrierBrakeY,
      compoundVelocityRatio: stage
        === 'unlocked-triple-purchase-compound-drive'
        && Math.abs(annulusAngularSpeed) > 1e-12
        ? sunAngularSpeed / annulusAngularSpeed
        : null,
      cyclePhase: cycleTime / cycleDuration,
      cycleTime,
      directClutchAngularAlignmentResidual:
        signedAngleError(sunAngle - annulusAngle),
      directClutchEngagement,
      directClutchEngagementSpeed,
      directClutchY,
      externalMeshAngleResidual,
      internalMeshAngleResidual,
      planetAngle,
      planetAngularAcceleration,
      planetAngularSpeed,
      planetRelativeAngle,
      planetRelativeAngularAcceleration,
      planetRelativeAngularSpeed,
      selectorPosition,
      stage,
      sunAngle,
      sunAngularAcceleration,
      sunAngularSpeed,
      willisAngleResidual,
      willisSpeedResidual,
    };
  }

  let afterUpdate = null;
  function update(time) {
    const state = stateAtTime(time);
    afterUpdate?.(state);
    spindleRotor.rotation.y = state.sunAngle;
    barrelRotor.rotation.y = state.annulusAngle;
    carrierRotor.rotation.y = state.carrierAngle;
    planets.forEach((planet) => {
      planet.userData.rotor.rotation.z = state.planetRelativeAngle;
    });
    directClutch.position.y = state.directClutchY;
    carrierBrakePins.forEach(({ pin, whiteBand }) => {
      pin.position.y = state.carrierBrakeY;
      whiteBand.position.y = state.carrierBrakeY + 0.18;
    });
    selector.rotation.z = THREE.MathUtils.lerp(
      -0.48,
      0.48,
      state.selectorPosition,
    );
  }

  const sourceState = stateAtTime(
    directDriveDuration
      + directClutchReleaseDuration
      + carrierBrakeEngagementDuration,
  );
  const archetype =
    'selectable-direct-or-fixed-carrier-three-planet-capstan-with-opposed-three-to-one-annulus-output';
  root.userData = {
    archetype,
    blocks: {
      annulusGear,
      annulusIndex,
      barrel,
      barrelClutchCrown,
      barrelCrownDogs,
      barrelIndex,
      barrelIndexBall,
      barrelRotor,
      barrelWhelps,
      capstanBars,
      carrierArms,
      carrierBrake,
      carrierBrakePins,
      carrierIndex,
      carrierLugs,
      carrierRotor,
      directClutch,
      directClutchCollar,
      directClutchDogs,
      drumhead,
      drumheadIndex,
      fixedFrame,
      foundation,
      planets,
      selector,
      selectorLever,
      spindle,
      spindleRotor,
      sunGear,
    },
    degreesOfFreedom: {
      compoundModeConstraint:
        'planet carrier is braked to the fixed base; sun input determines annulus output',
      directModeConstraint:
        'dog clutch locks spindle/drumhead to barrel/annulus; the unbraked train revolves as one',
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      selectorCoordinatesAtRest: 2,
      simultaneouslyActiveCoordinates: 1,
      storedEnergyStates: 0,
    },
    dynamics: {
      idealCompoundMechanicalAdvantage: annulusTeeth / sunTeeth,
      lossesBacklashElasticityAndInertiaModeled: false,
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
    },
    fidelity: 'authored',
    displayTreatment: {
      function:
        'the continuous rope-bearing barrel skin is translucent so the concentric base wheel-work remains inspectable; all eight opaque driven whelps and both flanges remain present',
      mechanicalGeometryOmitted: false,
      skinOpacity: 0.14,
    },
    geometry,
    mechanism:
      'The drumhead is rigid with the central spindle and fifteen-tooth sun; the independent barrel is rigid with a forty-five-tooth internal annulus. Three equal fifteen-tooth idlers run on one carrier. With the axial dog clutch engaged and carrier brake released, sun, planets, carrier, annulus, barrel, and drumhead revolve together for single purchase. With that clutch released and the carrier braked to the base, the annulus and barrel turn opposite the drumhead at one-third its speed for triple purchase.',
    selector: {
      carrierBrakeEngagementDuration,
      carrierBrakeReleaseDuration,
      compoundDriveDuration,
      coordinatedInterlock:
        'rotation occurs only at either fully engaged end state; the direct clutch and base brake are never engaged together',
      cycleDuration,
      directClutchEngagementDuration,
      directClutchReleaseDuration,
      directDriveDuration,
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 412 page marks its Animated control unavailable and supplies only Brown’s static plate.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      annulusAngle: sourceState.annulusAngle,
      carrierAngle: sourceState.carrierAngle,
      setting:
        'plan view of one central gear, three equally spaced idlers, the surrounding internal wheel, and two external locking levers as in Brown’s plate',
      sunAngle: sourceState.sunAngle,
    },
    sourceReference: {
      brownPlate412: {
        annulusApproximateBoundsPixels: [70, 73, 454, 464],
        imageHeight: 525,
        imageWidth: 525,
        lowerLockingLeverApproximateBoundsPixels: [204, 421, 463, 499],
        measurementUncertaintyPixels: 12,
        planetApproximateCentersPixels: [
          [164, 205],
          [355, 205],
          [258, 356],
        ],
        sunApproximateCenterPixels: [258, 259],
        upperLockingLeverApproximateBoundsPixels: [256, 28, 461, 101],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'wheel-work is in the base of a capstan',
          'the capstan can work as a simple or compound machine',
          'the two purchases are single and triple',
          'drumhead and barrel can rotate independently',
          'the drumhead is fixed on the spindle',
          'locking drumhead to barrel forms single purchase',
          'unlocking makes the wheel-work act',
          'unlocked drumhead and barrel rotate oppositely',
          'their unlocked velocity magnitudes are three to one',
        ],
        engravingEvidence:
          'The plate shows one central external gear, three equal and equally spaced surrounding idlers on a common three-lobed web, one concentric internal-tooth annulus approximately three times the central pitch radius, and opposed external locking levers.',
        reconstructionDisclosure:
          'Brown fixes the topology, two operating modes, direction reversal, and three-to-one velocity magnitude but gives no section view, selector interlock, dimensions, tooth labels, timing, materials, backlash, or loads. Representative 15/15/45 tooth counts make the pictured equal-pinion and exact 3:1 relations explicit; the coordinated axial clutch and carrier brake are an independently engineered physically compatible interpretation of the stated lock/unlock modes.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 412',
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      sourcePoseTime:
        directDriveDuration
        + directClutchReleaseDuration
        + carrierBrakeEngagementDuration,
    },
    transmission: {
      annulusToSunToothRatio: annulusTeeth / sunTeeth,
      compoundRelation:
        'with carrier speed zero: annulus speed=-(sunTeeth/annulusTeeth)*sun speed=-sun speed/3',
      directRelation:
        'with sun locked to annulus: sun=annulus=carrier=planet absolute speed',
      externalMeshRelation:
        'sunTeeth*(sun-carrier)+planetTeeth*(planet-carrier)=0',
      internalMeshRelation:
        'annulusTeeth*(annulus-carrier)-planetTeeth*(planet-carrier)=0',
      willisRelation:
        'sunTeeth*(sun-carrier)+annulusTeeth*(annulus-carrier)=0',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.62, 0, -3.88),
    new THREE.Vector3(4.80, 4.22, 3.88),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(7.8, 6.2, 10.4);
  root.userData.groundFloorY = 0;
  correctCapstanWheelwork(root);
  broadenCarrierWeb(root);
  afterUpdate = addNotchedRimAndLockingPawls(root, matte(PALETTE.brass, {
    metalness: 0.24,
    roughness: 0.45,
  }), darkMaterial);
  // Brown draws no white rotation indices on the wheels.
  const blocks = root.userData.blocks;
  blocks.annulusIndex.visible = false;
  for (const gear of [blocks.sunGear, ...blocks.planets]) {
    gear.userData.rotor.children[3].visible = false;
  }
  markShadows(root);
  foundation.receiveShadow = true;
  update(0);
  return { root, update, cameraDirection: root.userData.cameraDirection };
}

// Brown draws the carrier as a broad three-lobed plate: each lobe carries a
// planet and scalloped concave edges run between neighbouring planets close
// to the sun, so the web shows in the gaps. Replace the shared helper's small
// hub-and-bar web (hidden under the gears) with that outline, same plane and
// bores.
function broadenCarrierWeb(root) {
  const b = root.userData.blocks, g = root.userData.geometry;
  const centers = g.planetAngles.map(a =>
    [g.planetCenterRadius * Math.cos(a), g.planetCenterRadius * Math.sin(a)]);
  const lobeRadius = g.planetPitchRadius;
  const points = centers.flatMap(([x, z]) => Array.from({ length: 72 }, (_, i) => {
    const a = 2 * Math.PI * i / 72;
    return [x + lobeRadius * Math.cos(a), z + lobeRadius * Math.sin(a)];
  })).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
  const half = list => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out.at(-2), out.at(-1), p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  const hull = [...half(points), ...half([...points].reverse())];
  const sunTip = g.sunPitchRadius + g.module;
  const scallopRadius = 1.05, scallopReach = sunTip + 0.24;
  const scallops = g.planetAngles.map(a => {
    const m = a + Math.PI / 3, d = scallopReach + scallopRadius;
    return poly(circle([d * Math.cos(m), d * Math.sin(m)], scallopRadius, 96));
  });
  const web = clip.difference(poly(hull), ...scallops,
    poly(circle([0, 0], .232, 64)), ...centers.map(c => poly(circle(c, .112, 48))));
  const arm = b.carrierArms[0];
  arm.geometry.dispose();
  arm.geometry = plate(web, -.07, .07).rotateX(Math.PI / 2);
  arm.userData.role = 'three-lobed-bored-common-planet-carrier';
}

// Brown's plan: the barrel's wheel has an outer rim with six notches, and two
// pawls with eyed ends lie along it, the upper one's nose in the top notch,
// the lower (hooked) one's nose in the bottom notch. Each nose bears on the
// steep face of a ratchet-shaped notch and the two faces are opposed, so the
// pair locks the barrel to the drumhead that carries their eye pins: single
// purchase. Lifted clear, they unlock it and the wheel-work acts. The pawls
// therefore ride the drumhead (spindle); the drumhead itself is omitted.
export const CAPSTAN_PLATE = Object.freeze({
  center: [262, 272],
  rimRadiusPixels: 192,
  upperEye: [438, 68],
  lowerEye: [424, 477],
  eyeRadiusPixels: 19,
  pinRadiusPixels: 7,
});
function addNotchedRimAndLockingPawls(root, pawlMaterial, pinMaterial) {
  const g = root.userData.geometry, b = root.userData.blocks;
  pawlMaterial.fog = false;
  const rimInner = g.annulusOuterRadius;
  const rimOuter = 3.13;
  const scale = rimOuter / CAPSTAN_PLATE.rimRadiusPixels;
  // The notches are cut in the rim ring only, clear of the annulus body.
  const notchDepth = rimOuter - rimInner - 0.008;
  const notchWidth = 10 * Math.PI / 180;
  const clearance = 0.006;
  const liftAngle = 0.09;
  const deg = Math.PI / 180;
  // Plate (right, up) about Brown's centre in model units; polar angle psi
  // counterclockwise on the plate, which is positive barrel rotation.
  const polar = (radius, psi) => [radius * Math.cos(psi), radius * Math.sin(psi)];
  const platePoint = ([x, y]) => [(x - CAPSTAN_PLATE.center[0]) * scale, (CAPSTAN_PLATE.center[1] - y) * scale];
  // Plate (right, up) -> root-local (x, z) through the plan camera (1, 12, 3)
  // and the root's -90 degree turn (see correctCapstanWheelwork).
  const view = Math.hypot(1, 3);
  const toLocal = ([right, up]) => {
    const down = -up, X = (3 * right + down) / view, Z = (-right + 3 * down) / view;
    return [Z, -X];
  };
  const localPolygons = (polygons) => polygons.map((polygon) => polygon.map((ring) => ring.map(toLocal)));
  const extrude = (polygons, low, high) => plate(localPolygons(polygons), low, high).rotateX(Math.PI / 2);
  // A notch: a steep radial face at psiStep, a short floor, then a ramp back
  // to the rim; `toward` is the side (+1 or -1 in psi) the ramp runs to.
  const notch = (psiStep, toward, radialScale = 1, turn = 0) => {
    const s = (psi) => psiStep + toward * psi + turn;
    const outside = rimOuter + 0.4;
    return [
      polar(outside * radialScale, s(0)),
      polar((rimOuter - notchDepth) * radialScale, s(0)),
      polar((rimOuter - notchDepth) * radialScale, s(0.35 * notchWidth)),
      polar(rimOuter * radialScale, s(notchWidth)),
      polar(outside * radialScale, s(notchWidth)),
    ];
  };
  // Six notches, 60 degrees apart, alternately facing: the top one's steep
  // face is on its left, the bottom one's on its left as seen on the plate.
  const notches = Array.from({length: 6}, (_, k) => {
    const center = (90 + 60 * k) * deg, even = k % 2 === 0;
    return {center, step: center + (even ? 1 : -1) * notchWidth / 2, toward: even ? -1 : 1};
  });
  const rimShape = clip.difference(
    clip.difference(poly(circle([0, 0], rimOuter, 360)), poly(circle([0, 0], rimInner, 360))),
    ...notches.map((n) => poly(notch(n.step, n.toward))),
  );
  let rimMaterial = pawlMaterial;
  b.annulusGear.traverse((o) => { if (o.isMesh && rimMaterial === pawlMaterial) rimMaterial = o.material; });
  const rim = new THREE.Mesh(extrude(rimShape, -g.gearDepth / 2, g.gearDepth / 2), rimMaterial);
  rim.position.y = g.gearPlaneY;
  rim.userData.role = 'barrel-wheel-rim-with-six-locking-notches';
  b.barrelRotor.add(rim);

  const makePawl = (name, eyePixels, notchSpec, bladeEdges, extra) => {
    const pivot = platePoint(eyePixels);
    const eyeRadius = CAPSTAN_PLATE.eyeRadiusPixels * scale, pinRadius = CAPSTAN_PLATE.pinRadiusPixels * scale;
    // The nose fills its notch less a running clearance on every face.
    const eps = clearance / rimOuter;
    const nose = clip.intersection(
      poly(notch(notchSpec.step, notchSpec.toward, 1, -notchSpec.toward * eps)),
      poly(notch(notchSpec.step, notchSpec.toward, 1, notchSpec.toward * eps)),
      poly(notch(notchSpec.step, notchSpec.toward, (rimOuter + clearance) / rimOuter)),
      poly(circle([0, 0], rimOuter + 0.2, 360)),
    );
    const blade = poly(bladeEdges.map(platePoint));
    const outline = clip.difference(
      clip.union(nose, clip.difference(
        clip.union(blade, poly(circle(pivot, eyeRadius, 64)), ...(extra ?? []).map((part) => part(platePoint, scale))),
        poly(circle([0, 0], rimOuter + clearance, 360)),
      )),
      poly(circle(pivot, pinRadius + 0.004, 48)),
    );
    const group = new THREE.Group();
    const [px, pz] = toLocal(pivot);
    group.position.set(px, g.gearPlaneY, pz);
    // Pivot-relative outline, so the group turns the pawl about its eye.
    const mesh = new THREE.Mesh(
      extrude(outline.map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [x - pivot[0], y - pivot[1]]))),
        -g.gearDepth / 2 + 0.04, g.gearDepth / 2 - 0.04),
      pawlMaterial,
    );
    mesh.userData.role = `${name}-locking-pawl-riding-the-drumhead`;
    group.add(mesh);
    // The drumhead that carries the pin is omitted from Brown's plan, so the
    // pin ends flush with the pawl's eye faces rather than standing proud.
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(pinRadius, pinRadius, g.gearDepth - 0.08, 32), pinMaterial);
    pin.userData.role = `${name}-pawl-eye-pin-flush-in-eye`;
    b.spindleRotor.add(pin);
    pin.position.set(px, g.gearPlaneY, pz);
    group.userData.role = `${name}-locking-pawl`;
    b.spindleRotor.add(group);
    return {group, mesh, pin, pivot};
  };
  // Upper pawl: flat blade from its eye to a nose in the top notch.
  const upper = makePawl('upper', CAPSTAN_PLATE.upperEye, notches[0],
    [[266, 70], [276, 63], [424, 58], [436, 86], [415, 77], [300, 86]]);
  // Lower pawl: blade from its eye to a nose in the bottom notch, then the
  // hooked tail curving down to the left.
  const hook = (pt, sc) => {
    const path = [[268, 478], [248, 478], [233, 484], [222, 493], [214, 504]].map(pt);
    return clip.union(...path.slice(1).map((q, i) => capsule(path[i], q, 6.5 * sc, 16)));
  };
  const lower = makePawl('lower', CAPSTAN_PLATE.lowerEye, notches[3],
    [[252, 470], [300, 466], [412, 458], [428, 497], [300, 490], [262, 486]], [hook]);
  const pawls = [
    {...upper, liftSign: -1},
    {...lower, liftSign: 1},
  ];
  b.lockingPawls = pawls.map((p) => p.group);
  // The pawls orbit with the drumhead during the wheel-work, so the view
  // frames their eyes' circle.
  const reach = Math.max(...pawls.map((p) => Math.hypot(...p.pivot))) + CAPSTAN_PLATE.eyeRadiusPixels * scale + 0.05;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-reach, 0.25, -reach),
    new THREE.Vector3(reach, 1.14, reach),
  );
  b.notchedRim = rim;
  g.lockingPawls = {rimOuter, rimInner, notchDepth, notchWidth, clearance, liftAngle, notches: notches.map((n) => ({...n}))};
  const pawlLiftAt = (state) => liftAngle * (1 - state.directClutchEngagement);
  const baseState = root.userData.stateAtTime;
  root.userData.stateAtTime = (time) => {
    const state = baseState(time);
    state.pawlLift = pawlLiftAt(state);
    state.pawlsLocked = state.directClutchEngagement === 1;
    return state;
  };
  return (state) => {
    // The pawls are the lock: engaged with the direct (single-purchase)
    // coupling, lifted clear of the rim for the wheel-work.
    const lift = pawlLiftAt(state);
    for (const pawl of pawls) pawl.group.rotation.y = pawl.liftSign * lift;
  };
}

export function createAuthoredCapstanWheelworkMovement(movement) {
  if (movement.id !== 412) return null;
  return capstanWheelwork(movement);
}
