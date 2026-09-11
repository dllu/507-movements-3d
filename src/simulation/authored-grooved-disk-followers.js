import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongZ(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function rotate2(point, angle, target = new THREE.Vector2()) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return target.set(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
}

class AnalyticGrooveCurve extends THREE.Curve {
  constructor(pointAtDiskAngle) {
    super();
    this.pointAtDiskAngle = pointAtDiskAngle;
  }

  getPoint(parameter, target = new THREE.Vector3()) {
    const point = this.pointAtDiskAngle(FULL_TURN * parameter);
    return target.set(point.x, point.y, 0);
  }
}

function groovedDiskFollower(movement) {
  const root = new THREE.Group();

  // The official page has no animation. Brown's groove centerline was
  // independently measured at eleven points and fitted with the smallest
  // periodic Fourier law that stays within the six-pixel plate uncertainty
  // while retaining exactly one lever maximum and one minimum per disk turn.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.012;
  const sourceRasterDiskCenter = new THREE.Vector2(256, 238);
  const sourceRasterDiskTop = new THREE.Vector2(256, 109);
  const sourceRasterDiskBottom = new THREE.Vector2(256, 367);
  const sourceRasterLeverPivot = new THREE.Vector2(348, 65);
  const sourceRasterFollowerPin = new THREE.Vector2(361, 238);
  const sourceRasterLeverGrip = new THREE.Vector2(438, 438);
  const sourceRasterBaseLeft = new THREE.Vector2(69, 470);
  const sourceRasterBaseRight = new THREE.Vector2(422, 470);
  const sourceRasterGrooveCenterline = [
    new THREE.Vector2(361, 238),
    new THREE.Vector2(357, 282),
    new THREE.Vector2(309, 331),
    new THREE.Vector2(253, 351),
    new THREE.Vector2(215, 330),
    new THREE.Vector2(204, 278),
    new THREE.Vector2(211, 210),
    new THREE.Vector2(226, 176),
    new THREE.Vector2(255, 159),
    new THREE.Vector2(330, 176),
    new THREE.Vector2(356, 218),
  ];
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterDiskCenter.x) * sourceScale,
    (sourceRasterDiskCenter.y - y) * sourceScale,
  );
  const diskCenter = new THREE.Vector2(0, 0);
  const leverPivot = sourcePointToModel(sourceRasterLeverPivot);
  const sourceFollowerPin = sourcePointToModel(sourceRasterFollowerPin);
  const followerArmLength = sourceFollowerPin.distanceTo(leverPivot);
  const sourceLeverAngle = Math.atan2(
    sourceFollowerPin.y - leverPivot.y,
    sourceFollowerPin.x - leverPivot.x,
  );
  const sourceLeverGrip = sourcePointToModel(sourceRasterLeverGrip);
  const localLeverGrip = rotate2(
    sourceLeverGrip.clone().sub(leverPivot),
    -sourceLeverAngle,
  );
  const diskRadius = sourcePointToModel(sourceRasterDiskBottom).distanceTo(
    diskCenter,
  );
  const grooveHalfWidth = 0.11;
  const followerPinRadius = 0.075;
  const diskHubRadius = 0.20;
  const cyclePeriod = 4;
  const diskAngularSpeed = FULL_TURN / cyclePeriod;

  // Least-squares coefficients of the closed constraint fitted to the
  // measured public-domain groove. Three harmonics reproduce all eleven
  // measured centerline points within 3.82 px and avoid spurious reversals.
  const leverCosineCoefficients = [
    -1.611817613773575,
    0.14975457970993988,
    -0.05019698720293685,
    0.01818719405930787,
  ];
  const leverSineCoefficients = [
    0,
    0.08162942572087575,
    -0.005399287266358147,
    -0.012847346944809756,
  ];
  const sourcePhaseCorrection = -0.001719953070554947;

  const leverLawAtDiskAngle = (diskAngle) => {
    let leverAngle = leverCosineCoefficients[0] + sourcePhaseCorrection;
    let firstDerivative = 0;
    let secondDerivative = 0;
    for (let harmonic = 1;
      harmonic < leverCosineCoefficients.length;
      harmonic += 1) {
      const phase = harmonic * diskAngle;
      const cosine = Math.cos(phase);
      const sine = Math.sin(phase);
      const cosineCoefficient = leverCosineCoefficients[harmonic];
      const sineCoefficient = leverSineCoefficients[harmonic];
      leverAngle += cosineCoefficient * cosine
        + sineCoefficient * sine;
      firstDerivative += harmonic * (
        -cosineCoefficient * sine + sineCoefficient * cosine
      );
      secondDerivative -= harmonic ** 2 * (
        cosineCoefficient * cosine + sineCoefficient * sine
      );
    }
    return { firstDerivative, leverAngle, secondDerivative };
  };

  const groovePointAtDiskAngle = (diskAngle) => {
    const { leverAngle } = leverLawAtDiskAngle(diskAngle);
    const worldPin = leverPivot.clone().add(new THREE.Vector2(
      followerArmLength * Math.cos(leverAngle),
      followerArmLength * Math.sin(leverAngle),
    ));
    return rotate2(worldPin, -diskAngle);
  };

  const stateAtDiskAngle = (
    diskAngle,
    angularSpeed = diskAngularSpeed,
    angularAcceleration = 0,
  ) => {
    const law = leverLawAtDiskAngle(diskAngle);
    const leverAngularSpeed = law.firstDerivative * angularSpeed;
    const leverAngularAcceleration = law.secondDerivative
      * angularSpeed ** 2 + law.firstDerivative * angularAcceleration;
    const leverDirection = new THREE.Vector2(
      Math.cos(law.leverAngle),
      Math.sin(law.leverAngle),
    );
    const leverTangent = new THREE.Vector2(
      -Math.sin(law.leverAngle),
      Math.cos(law.leverAngle),
    );
    const followerPin = leverPivot.clone().addScaledVector(
      leverDirection,
      followerArmLength,
    );
    const followerPinVelocity = leverTangent.clone().multiplyScalar(
      followerArmLength * leverAngularSpeed,
    );
    const followerPinAcceleration = leverTangent.clone().multiplyScalar(
      followerArmLength * leverAngularAcceleration,
    ).addScaledVector(
      leverDirection,
      -followerArmLength * leverAngularSpeed ** 2,
    );
    const groovePointLocal = rotate2(followerPin, -diskAngle);
    const groovePointWorld = rotate2(groovePointLocal, diskAngle);
    const quarterTurnPin = new THREE.Vector2(-followerPin.y, followerPin.x);
    const relativeWorldVelocity = followerPinVelocity.clone()
      .addScaledVector(quarterTurnPin, -angularSpeed);
    const grooveSlidingVelocityLocal = rotate2(
      relativeWorldVelocity,
      -diskAngle,
    );
    const quarterTurnVelocity = new THREE.Vector2(
      -followerPinVelocity.y,
      followerPinVelocity.x,
    );
    const grooveSlidingAccelerationLocal = rotate2(
      followerPinAcceleration.clone()
        .addScaledVector(quarterTurnVelocity, -2 * angularSpeed)
        .addScaledVector(quarterTurnPin, -angularAcceleration)
        .addScaledVector(followerPin, -(angularSpeed ** 2)),
      -diskAngle,
    );
    const grooveRadius = groovePointLocal.length();
    let stage;
    if (Math.abs(leverAngularSpeed) < 1e-10) {
      stage = leverAngularAcceleration < 0
        ? 'lever-at-clockwise-extreme'
        : 'lever-at-counterclockwise-extreme';
    } else {
      stage = leverAngularSpeed > 0
        ? 'lever-vibrating-counterclockwise'
        : 'lever-vibrating-clockwise';
    }

    return {
      angularAcceleration,
      angularSpeed,
      diskAngle,
      diskOuterGrooveClearance: diskRadius - grooveRadius - grooveHalfWidth,
      followerArmLengthError: followerPin.distanceTo(leverPivot)
        - followerArmLength,
      followerPin: new THREE.Vector3(followerPin.x, followerPin.y, 0),
      followerPinAcceleration: new THREE.Vector3(
        followerPinAcceleration.x,
        followerPinAcceleration.y,
        0,
      ),
      followerPinVelocity: new THREE.Vector3(
        followerPinVelocity.x,
        followerPinVelocity.y,
        0,
      ),
      grooveCenterlineError: groovePointWorld.distanceTo(followerPin),
      grooveHubClearance: grooveRadius - grooveHalfWidth - diskHubRadius,
      groovePointLocal: new THREE.Vector3(
        groovePointLocal.x,
        groovePointLocal.y,
        0,
      ),
      groovePointWorld: new THREE.Vector3(
        groovePointWorld.x,
        groovePointWorld.y,
        0,
      ),
      grooveSlidingAccelerationLocal: new THREE.Vector3(
        grooveSlidingAccelerationLocal.x,
        grooveSlidingAccelerationLocal.y,
        0,
      ),
      grooveSlidingSpeed: grooveSlidingVelocityLocal.length(),
      grooveSlidingVelocityLocal: new THREE.Vector3(
        grooveSlidingVelocityLocal.x,
        grooveSlidingVelocityLocal.y,
        0,
      ),
      leverAngle: law.leverAngle,
      leverAngularAcceleration,
      leverAngularSpeed,
      pinRadialClearance: grooveHalfWidth - followerPinRadius,
      stage,
    };
  };

  const stateAtTime = (time) => {
    const diskAngle = diskAngularSpeed * time;
    return {
      ...stateAtDiskAngle(diskAngle),
      cycleIndex: Math.floor(time / cyclePeriod),
      cycleTime: THREE.MathUtils.euclideanModulo(time, cyclePeriod),
    };
  };

  const derivativeRoots = [];
  const rootSamples = 4096;
  let previousAngle = 0;
  let previousDerivative = leverLawAtDiskAngle(0).firstDerivative;
  for (let sample = 1; sample <= rootSamples; sample += 1) {
    const angle = FULL_TURN * sample / rootSamples;
    const derivative = leverLawAtDiskAngle(angle).firstDerivative;
    if (previousDerivative * derivative < 0) {
      let lower = previousAngle;
      let upper = angle;
      let lowerValue = previousDerivative;
      for (let iteration = 0; iteration < 60; iteration += 1) {
        const midpoint = (lower + upper) / 2;
        const midpointValue = leverLawAtDiskAngle(midpoint).firstDerivative;
        if (lowerValue * midpointValue <= 0) {
          upper = midpoint;
        } else {
          lower = midpoint;
          lowerValue = midpointValue;
        }
      }
      derivativeRoots.push((lower + upper) / 2);
    }
    previousAngle = angle;
    previousDerivative = derivative;
  }
  const leverTurningStates = derivativeRoots.map((angle) =>
    stateAtDiskAngle(angle, 0, 0));
  const minimumLeverAngle = Math.min(...leverTurningStates.map(
    (state) => state.leverAngle,
  ));
  const maximumLeverAngle = Math.max(...leverTurningStates.map(
    (state) => state.leverAngle,
  ));

  const grooveCurve = new AnalyticGrooveCurve(groovePointAtDiskAngle);
  const grooveFitPixelErrors = {};
  for (let index = 0;
    index < sourceRasterGrooveCenterline.length;
    index += 1) {
    const measured = sourcePointToModel(sourceRasterGrooveCenterline[index]);
    let minimumError = Infinity;
    for (let sample = 0; sample < 8192; sample += 1) {
      const modeled = groovePointAtDiskAngle(FULL_TURN * sample / 8192);
      minimumError = Math.min(minimumError, measured.distanceTo(modeled));
    }
    grooveFitPixelErrors[`point${index}`] = minimumError / sourceScale;
  }

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.47,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.28,
    roughness: 0.50,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const disk = new THREE.Group();
  disk.userData.axis = Z_AXIS.clone();
  disk.userData.role = 'fixed-axis-revolving-grooved-disk';
  const diskRotor = new THREE.Group();
  diskRotor.userData.role = 'rigid-disk-and-face-groove';
  disk.add(diskRotor);
  root.add(disk);
  const diskBody = cylinderAlongZ(diskRadius, 0.36,
    driverMaterial, 72);
  diskBody.userData.role = 'solid-driver-disk';
  diskRotor.add(diskBody);
  const diskRim = new THREE.Mesh(
    new THREE.TorusGeometry(diskRadius * 0.965, diskRadius * 0.035, 10, 80),
    darkMaterial,
  );
  diskRim.userData.role = 'dark-disk-rim';
  diskRotor.add(diskRim);
  const grooveOuter = new THREE.Mesh(
    new THREE.TubeGeometry(grooveCurve, 360, grooveHalfWidth, 8, true),
    darkMaterial,
  );
  grooveOuter.position.z = 0.23;
  grooveOuter.userData.role = 'closed-face-groove-outer-walls';
  const grooveFloor = new THREE.Mesh(
    new THREE.TubeGeometry(
      grooveCurve,
      360,
      followerPinRadius + 0.004,
      8,
      true,
    ),
    driverMaterial,
  );
  grooveFloor.position.z = 0.246;
  grooveFloor.userData.role = 'recessed-face-groove-floor';
  diskRotor.add(grooveOuter, grooveFloor);
  const diskHub = cylinderAlongZ(diskHubRadius, 0.72,
    darkMaterial, 36);
  diskHub.userData.role = 'fixed-center-disk-shaft-hub';
  diskRotor.add(diskHub);
  const diskIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.065, 0.035),
    whiteMaterial,
  );
  diskIndex.position.set(diskRadius * 0.68, 0, 0.42);
  diskIndex.userData.role = 'white-disk-rotation-index';
  diskRotor.add(diskIndex);

  const lever = new THREE.Group();
  lever.position.set(leverPivot.x, leverPivot.y, 0.67);
  lever.userData.axis = Z_AXIS.clone();
  lever.userData.role = 'fixed-pivot-groove-driven-vibrating-lever';
  root.add(lever);
  const leverBody = makeBeam(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(localLeverGrip.x, localLeverGrip.y, 0),
    { color: PALETTE.driven, depth: 0.26, thickness: 0.25 },
  );
  leverBody.userData.role = 'long-rigid-output-lever';
  lever.add(leverBody);
  const bodyYAtPin = localLeverGrip.y * followerArmLength
    / localLeverGrip.x;
  const followerBracket = makeBeam(
    new THREE.Vector3(followerArmLength, bodyYAtPin, 0),
    new THREE.Vector3(followerArmLength, 0, 0),
    { color: PALETTE.driven, depth: 0.24, thickness: 0.13 },
  );
  followerBracket.userData.role = 'rigid-offset-pin-bracket-on-lever';
  lever.add(followerBracket);
  const followerPin = cylinderAlongZ(followerPinRadius, 0.78,
    brassMaterial, 28);
  followerPin.position.set(followerArmLength, 0, -0.28);
  followerPin.userData.role = 'fixed-pin-sliding-in-disk-face-groove';
  lever.add(followerPin);
  const followerHead = cylinderAlongZ(0.14, 0.12,
    whiteMaterial, 28);
  followerHead.position.set(followerArmLength, 0, 0.19);
  followerHead.userData.role = 'white-visible-groove-follower-head';
  lever.add(followerHead);
  const leverIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.055, 0.035),
    whiteMaterial,
  );
  leverIndex.position.set(
    localLeverGrip.x * 0.68,
    localLeverGrip.y * 0.68,
    0.18,
  );
  leverIndex.rotation.z = Math.atan2(localLeverGrip.y, localLeverGrip.x);
  leverIndex.userData.role = 'white-lever-vibration-index';
  lever.add(leverIndex);
  const leverPivotPin = cylinderAlongZ(0.24, 0.88,
    darkMaterial, 36);
  leverPivotPin.position.set(leverPivot.x, leverPivot.y, 0.32);
  leverPivotPin.userData.role = 'fixed-output-lever-fulcrum';
  root.add(leverPivotPin);

  const baseY = sourcePointToModel(sourceRasterBaseLeft).y;
  const baseLeftX = sourcePointToModel(sourceRasterBaseLeft).x;
  const baseRightX = sourcePointToModel(sourceRasterBaseRight).x;
  const base = makeBeam(
    new THREE.Vector3(baseLeftX, baseY, -0.66),
    new THREE.Vector3(baseRightX, baseY, -0.66),
    { color: PALETTE.frame, depth: 0.38, thickness: 0.27 },
  );
  base.userData.role = 'fixed-display-base';
  const leftDiskBrace = makeBeam(
    new THREE.Vector3(-1.72, baseY + 0.13, -0.64),
    new THREE.Vector3(-0.47, -0.28, -0.64),
    { color: PALETTE.frame, depth: 0.32, thickness: 0.24 },
  );
  leftDiskBrace.userData.role = 'fixed-left-disk-bearing-brace';
  const rightDiskBrace = makeBeam(
    new THREE.Vector3(1.42, baseY + 0.13, -0.64),
    new THREE.Vector3(0.47, -0.28, -0.64),
    { color: PALETTE.frame, depth: 0.32, thickness: 0.24 },
  );
  rightDiskBrace.userData.role = 'fixed-right-disk-bearing-brace';
  const leverSupport = makeBeam(
    new THREE.Vector3(2.02, baseY + 0.13, -0.72),
    new THREE.Vector3(leverPivot.x, leverPivot.y, -0.72),
    { color: PALETTE.frame, depth: 0.34, thickness: 0.27 },
  );
  leverSupport.userData.role = 'fixed-output-lever-support';
  const upperCrossBrace = makeBeam(
    new THREE.Vector3(0.64, 0.62, -0.70),
    new THREE.Vector3(leverPivot.x, leverPivot.y, -0.70),
    { color: PALETTE.frame, depth: 0.30, thickness: 0.22 },
  );
  upperCrossBrace.userData.role = 'fixed-upper-triangular-brace';
  root.add(base, leftDiskBrace, rightDiskBrace, leverSupport,
    upperCrossBrace);

  const sourceIdealizationPixelErrors = {
    diskBottom: sourcePointToModel(sourceRasterDiskBottom).distanceTo(
      new THREE.Vector2(0, -diskRadius),
    ) / sourceScale,
    diskCenter: 0,
    diskTop: sourcePointToModel(sourceRasterDiskTop).distanceTo(
      new THREE.Vector2(0, diskRadius),
    ) / sourceScale,
    followerPin: stateAtTime(0).followerPin.distanceTo(new THREE.Vector3(
      sourceFollowerPin.x,
      sourceFollowerPin.y,
      0,
    )) / sourceScale,
    leverGrip: rotate2(localLeverGrip, sourceLeverAngle)
      .add(leverPivot).distanceTo(sourceLeverGrip) / sourceScale,
    leverPivot: 0,
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    base,
    disk,
    diskBody,
    diskHub,
    diskIndex,
    diskRim,
    diskRotor,
    followerBracket,
    followerHead,
    followerPin,
    grooveFloor,
    grooveOuter,
    leftDiskBrace,
    lever,
    leverBody,
    leverIndex,
    leverPivotPin,
    leverSupport,
    rightDiskBrace,
    upperCrossBrace,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.35, baseY - 0.24, -1.30),
    new THREE.Vector3(2.55, 2.48, 1.35),
  );
  root.userData.geometry = {
    cyclePeriod,
    diskAngularSpeed,
    diskHubRadius,
    diskRadius,
    followerArmLength,
    followerPinRadius,
    grooveHalfWidth,
    leverCosineCoefficients: [...leverCosineCoefficients],
    leverSineCoefficients: [...leverSineCoefficients],
    maximumLeverAngle,
    minimumLeverAngle,
    sourceLeverAngle,
    sourcePhaseCorrection,
    sourceScale,
  };
  root.userData.grooveCurve = grooveCurve;
  root.userData.groovePointAtDiskAngle = groovePointAtDiskAngle;
  root.userData.leverLawAtDiskAngle = leverLawAtDiskAngle;
  root.userData.mechanism =
    'one rigid disk revolves about one fixed shaft while one pin fixed to the long right-hand lever remains inside one closed groove in the disk face; the groove is the exact disk-frame trajectory of that pin, so one disk revolution produces one smooth angular vibration of the lever about its fixed upper fulcrum';
  root.userData.movement = movement;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason:
      'The official Movement 281 page marks its animation unavailable. The motion is reconstructed from Brown’s public-domain plate by fitting one smooth periodic closed constraint to the measured groove centerline.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate281: {
      fitMethod:
        'three-harmonic periodic lever law fitted to an eleven-point centripetal spline of the engraved groove; higher harmonics were deliberately rejected because they introduced false lever reversals',
      grooveFitPixelErrors,
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'one fixed-axis revolving disk, one closed face groove, one fixed-radius follower pin carried rigidly by one long lever, and one fixed lever fulcrum above and to the right of the disk',
      measurementUncertaintyPixels: 6,
      rasterBaseLeft: {
        x: sourceRasterBaseLeft.x,
        y: sourceRasterBaseLeft.y,
      },
      rasterBaseRight: {
        x: sourceRasterBaseRight.x,
        y: sourceRasterBaseRight.y,
      },
      rasterDiskBottom: {
        x: sourceRasterDiskBottom.x,
        y: sourceRasterDiskBottom.y,
      },
      rasterDiskCenter: {
        x: sourceRasterDiskCenter.x,
        y: sourceRasterDiskCenter.y,
      },
      rasterDiskTop: {
        x: sourceRasterDiskTop.x,
        y: sourceRasterDiskTop.y,
      },
      rasterFollowerPin: {
        x: sourceRasterFollowerPin.x,
        y: sourceRasterFollowerPin.y,
      },
      rasterGrooveCenterline: sourceRasterGrooveCenterline.map((point) => ({
        x: point.x,
        y: point.y,
      })),
      rasterLeverGrip: {
        x: sourceRasterLeverGrip.x,
        y: sourceRasterLeverGrip.y,
      },
      rasterLeverPivot: {
        x: sourceRasterLeverPivot.x,
        y: sourceRasterLeverPivot.y,
      },
      sourceIdealizationPixelErrors,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 75,
      edition: 21,
      illustrationPage: 74,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtDiskAngle = stateAtDiskAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cyclePeriod,
    diskTurnsPerCycle: 1,
    leverTurningAngles: [...derivativeRoots],
    sourceTime: 0,
  };
  root.userData.transmission = {
    closedGrooveConstraint:
      'grooveWorld(diskAngle, same parameter) = followerPinWorld with zero centerline error',
    input: 'one continuously counterclockwise revolving disk',
    leverAngularStroke: maximumLeverAngle - minimumLeverAngle,
    output: 'one smooth fixed-pivot angular lever vibration per disk turn',
    pinSlotRadialClearance: grooveHalfWidth - followerPinRadius,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    diskRotor.rotation.z = state.diskAngle;
    disk.userData.angularAcceleration = state.angularAcceleration;
    disk.userData.angularSpeed = state.angularSpeed;
    lever.rotation.z = state.leverAngle;
    lever.userData.angularAcceleration = state.leverAngularAcceleration;
    lever.userData.angularSpeed = state.leverAngularSpeed;
    root.userData.contacts = {
      followerGroove: {
        active: true,
        centerlineError: state.grooveCenterlineError,
        radialClearance: state.pinRadialClearance,
        slidingSpeed: state.grooveSlidingSpeed,
      },
    };
    root.userData.kinematics = state;
  };

  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(4.8, 3.5, 10.8),
  };
}

export function createAuthoredGroovedDiskFollowerMovement(movement) {
  if (movement.id !== 281) return null;
  const result = groovedDiskFollower(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
