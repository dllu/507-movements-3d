import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevel = 0.012) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 32,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function horizontalCapsuleRingShape(
  innerRadius,
  outerRadius,
  straightHalfLength,
) {
  const shape = new THREE.Shape();
  shape.moveTo(-straightHalfLength, -outerRadius);
  shape.lineTo(straightHalfLength, -outerRadius);
  shape.absarc(
    straightHalfLength,
    0,
    outerRadius,
    -Math.PI / 2,
    Math.PI / 2,
    false,
  );
  shape.lineTo(-straightHalfLength, outerRadius);
  shape.absarc(
    -straightHalfLength,
    0,
    outerRadius,
    Math.PI / 2,
    Math.PI * 1.5,
    false,
  );
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(straightHalfLength, -innerRadius);
  hole.lineTo(-straightHalfLength, -innerRadius);
  hole.absarc(
    -straightHalfLength,
    0,
    innerRadius,
    -Math.PI / 2,
    Math.PI / 2,
    true,
  );
  hole.lineTo(straightHalfLength, innerRadius);
  hole.absarc(
    straightHalfLength,
    0,
    innerRadius,
    Math.PI / 2,
    -Math.PI / 2,
    true,
  );
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function wavedSkirtGeometry({
  angularSegments,
  innerRadius,
  lowerYAtAngle,
  maximumLowerY,
  outerRadius,
}) {
  const positions = [];
  const point = (radius, y, angle) => new THREE.Vector3(
    radius * Math.sin(angle),
    y,
    radius * Math.cos(angle),
  );
  const triangle = (first, second, third) => {
    positions.push(
      ...first.toArray(),
      ...second.toArray(),
      ...third.toArray(),
    );
  };
  const quad = (first, second, third, fourth) => {
    triangle(first, second, third);
    triangle(first, third, fourth);
  };

  for (let index = 0; index < angularSegments; index += 1) {
    const firstAngle = index / angularSegments * Math.PI * 2;
    const secondAngle = (index + 1) / angularSegments * Math.PI * 2;
    const firstLowerY = lowerYAtAngle(firstAngle);
    const secondLowerY = lowerYAtAngle(secondAngle);
    const upperOuterFirst = point(outerRadius, maximumLowerY, firstAngle);
    const upperOuterSecond = point(outerRadius, maximumLowerY, secondAngle);
    const upperInnerFirst = point(innerRadius, maximumLowerY, firstAngle);
    const upperInnerSecond = point(innerRadius, maximumLowerY, secondAngle);
    const lowerOuterFirst = point(outerRadius, firstLowerY, firstAngle);
    const lowerOuterSecond = point(outerRadius, secondLowerY, secondAngle);
    const lowerInnerFirst = point(innerRadius, firstLowerY, firstAngle);
    const lowerInnerSecond = point(innerRadius, secondLowerY, secondAngle);

    quad(
      lowerInnerFirst,
      lowerOuterFirst,
      lowerOuterSecond,
      lowerInnerSecond,
    );
    quad(
      upperOuterFirst,
      lowerOuterFirst,
      lowerOuterSecond,
      upperOuterSecond,
    );
    quad(
      lowerInnerFirst,
      upperInnerFirst,
      upperInnerSecond,
      lowerInnerSecond,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.angularSegments = angularSegments;
  return geometry;
}

function sixWaveFaceCamRockerMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Measurements from Brown's 525 px engraving. The illustrated pose puts
  // the large follower wheel beneath the middle crest of the waved face.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceCamLeftX = 188;
  const sourceCamRightX = 494;
  const sourceCamTopY = 177;
  const sourceProfileCrestY = 222;
  const sourceProfileValleyY = 266;
  const sourceCamAxisX = 336;
  const sourceFollowerCenter = new THREE.Vector2(336, 271);
  const sourceFollowerRadius = 49;
  const sourceRockerPivot = new THREE.Vector2(168, 322);
  const sourceOutputPin = new THREE.Vector2(44, 362);
  const sourceUpperShaftTopY = 63;
  const sourceUpperCollarTopY = 156;
  const sourceLowerShaftTipY = 437;
  const sourceVisibleWaveCount = 3;
  const camWaveCount = sourceVisibleWaveCount * 2;
  const wavePitch = fullTurn / camWaveCount;
  const camOuterRadius = 2.65;
  const sourceCamRadius = (sourceCamRightX - sourceCamLeftX) / 2;
  const sourceUnitsPerPixel = camOuterRadius / sourceCamRadius;

  const rockerPivot = new THREE.Vector3(0, 0.15, 0);
  const sourceRightVector = new THREE.Vector2(
    sourceFollowerCenter.x - sourceRockerPivot.x,
    sourceRockerPivot.y - sourceFollowerCenter.y,
  );
  const sourceLeftVector = new THREE.Vector2(
    sourceRockerPivot.x - sourceOutputPin.x,
    sourceOutputPin.y - sourceRockerPivot.y,
  );
  const sourceRockerAngle = Math.atan2(
    sourceRightVector.y,
    sourceRightVector.x,
  );
  const rightRockerLength = sourceRightVector.length()
    * sourceUnitsPerPixel;
  const leftRockerLength = sourceLeftVector.length()
    * sourceUnitsPerPixel;
  const camAxisX = rockerPivot.x
    + rightRockerLength * Math.cos(sourceRockerAngle);
  const sourceFollowerCenterY = rockerPivot.y
    + rightRockerLength * Math.sin(sourceRockerAngle);
  const followerRadius = sourceFollowerRadius * sourceUnitsPerPixel;
  const maximumLowerFaceY = sourceFollowerCenterY + followerRadius;
  const faceStroke = (
    sourceProfileValleyY - sourceProfileCrestY
  ) * sourceUnitsPerPixel;
  const faceAmplitude = faceStroke / 2;
  const meanLowerFaceY = maximumLowerFaceY - faceAmplitude;
  const minimumLowerFaceY = maximumLowerFaceY - faceStroke;
  const camTopY = maximumLowerFaceY
    + (sourceProfileCrestY - sourceCamTopY) * sourceUnitsPerPixel;
  const contactTrackRadius = 2.25;
  const rockerPlaneZ = 2.86;
  const followerPlaneZ = contactTrackRadius;
  const followerDepth = 1.20;
  const sourceOutputGuideX = rockerPivot.x
    - leftRockerLength * Math.cos(sourceRockerAngle);
  const sourceOutputY = rockerPivot.y
    - leftRockerLength * Math.sin(sourceRockerAngle);
  const inputAngularSpeed = 0.42;
  const rotationPeriod = fullTurn / inputAngularSpeed;
  const outputCyclePeriod = wavePitch / inputAngularSpeed;

  const positiveModulo = (value, modulus) => {
    const remainder = value % modulus;
    if (remainder === 0) return 0;
    return remainder < 0 ? remainder + modulus : remainder;
  };
  const localProfileAtAngle = (localAngle) => {
    const waveArgument = camWaveCount * localAngle;
    return {
      firstDerivativeByAngle: -faceAmplitude
        * camWaveCount * Math.sin(waveArgument),
      lowerY: meanLowerFaceY + faceAmplitude * Math.cos(waveArgument),
      secondDerivativeByAngle: -faceAmplitude
        * camWaveCount ** 2 * Math.cos(waveArgument),
      waveArgument,
    };
  };
  const profileAtWorldX = (worldX, driverAngle) => {
    const tangentialOffset = worldX - camAxisX;
    if (Math.abs(tangentialOffset) >= contactTrackRadius) {
      throw new RangeError('Follower left the annular waved-cam contact track.');
    }
    const radialProjection = Math.sqrt(
      contactTrackRadius ** 2 - tangentialOffset ** 2,
    );
    const worldTrackAngle = Math.asin(
      tangentialOffset / contactTrackRadius,
    );
    const localAngle = worldTrackAngle - driverAngle;
    const localProfile = localProfileAtAngle(localAngle);
    const worldAngleSlope = 1 / radialProjection;
    const worldAngleCurvature = tangentialOffset
      / radialProjection ** 3;
    return {
      ...localProfile,
      localAngle,
      lowerYDerivativeByX: localProfile.firstDerivativeByAngle
        * worldAngleSlope,
      lowerYSecondDerivativeByX:
        localProfile.secondDerivativeByAngle * worldAngleSlope ** 2
        + localProfile.firstDerivativeByAngle * worldAngleCurvature,
      radialProjection,
      tangentialOffset,
      worldAngleCurvature,
      worldAngleSlope,
      worldTrackAngle,
    };
  };

  const closureAtDriverAngle = (driverAngle) => {
    const axialProfile = localProfileAtAngle(-driverAngle);
    const approximateSine = THREE.MathUtils.clamp(
      (
        axialProfile.lowerY - followerRadius - rockerPivot.y
      ) / rightRockerLength,
      -0.98,
      0.98,
    );
    let rockerAngle = Math.asin(approximateSine);
    let closureResidual = Infinity;
    let iterationCount = 0;
    for (; iterationCount < 12; iterationCount += 1) {
      const followerX = rockerPivot.x
        + rightRockerLength * Math.cos(rockerAngle);
      const profile = profileAtWorldX(followerX, driverAngle);
      const horizontalSlope = -rightRockerLength * Math.sin(rockerAngle);
      const angleSlope = horizontalSlope * profile.worldAngleSlope;
      closureResidual = rockerPivot.y
        + rightRockerLength * Math.sin(rockerAngle)
        + followerRadius - profile.lowerY;
      const residualSlope = rightRockerLength * Math.cos(rockerAngle)
        - profile.firstDerivativeByAngle * angleSlope;
      const correction = closureResidual / residualSlope;
      rockerAngle -= correction;
      if (Math.abs(correction) < 1e-14) break;
    }

    const followerCenter = new THREE.Vector3(
      rockerPivot.x + rightRockerLength * Math.cos(rockerAngle),
      rockerPivot.y + rightRockerLength * Math.sin(rockerAngle),
      followerPlaneZ,
    );
    const leftPinPosition = new THREE.Vector3(
      rockerPivot.x - leftRockerLength * Math.cos(rockerAngle),
      rockerPivot.y - leftRockerLength * Math.sin(rockerAngle),
      rockerPlaneZ,
    );
    const profile = profileAtWorldX(followerCenter.x, driverAngle);
    const contactPoint = new THREE.Vector3(
      followerCenter.x,
      profile.lowerY,
      profile.radialProjection,
    );
    closureResidual = followerCenter.y + followerRadius - profile.lowerY;
    return {
      closureResidual,
      contactPoint,
      followerCenter,
      iterationCount,
      leftPinPosition,
      profile,
      rockerAngle,
    };
  };

  const sourceClosure = closureAtDriverAngle(0);
  const minimumFaceRockerAngle = Math.asin(
    (
      minimumLowerFaceY - followerRadius - rockerPivot.y
    ) / rightRockerLength,
  );
  const minimumFaceFollowerX = rockerPivot.x
    + rightRockerLength * Math.cos(minimumFaceRockerAngle);
  const minimumFaceWorldAngle = Math.asin(
    (minimumFaceFollowerX - camAxisX) / contactTrackRadius,
  );
  const valleyAngleWithinWave = minimumFaceWorldAngle + wavePitch / 2;
  const valleyClosure = closureAtDriverAngle(valleyAngleWithinWave);
  const outputStroke = valleyClosure.leftPinPosition.y
    - sourceClosure.leftPinPosition.y;
  const maximumSlotOffset = valleyClosure.leftPinPosition.x
    - sourceOutputGuideX;
  const outputMidY = sourceOutputY + outputStroke / 2;
  const driverAngleForOutputY = (targetY, lowerAngle, upperAngle) => {
    let low = lowerAngle;
    let high = upperAngle;
    const increasing = closureAtDriverAngle(high).leftPinPosition.y
      > closureAtDriverAngle(low).leftPinPosition.y;
    for (let iteration = 0; iteration < 64; iteration += 1) {
      const midpoint = (low + high) / 2;
      const midpointY = closureAtDriverAngle(midpoint).leftPinPosition.y;
      if ((midpointY < targetY) === increasing) low = midpoint;
      else high = midpoint;
    }
    return (low + high) / 2;
  };
  const liftingMidpointAngle = driverAngleForOutputY(
    outputMidY,
    0,
    valleyAngleWithinWave,
  );
  const returningMidpointAngle = driverAngleForOutputY(
    outputMidY,
    valleyAngleWithinWave,
    wavePitch,
  );

  const linkageAtDriverMotion = (
    driverAngle,
    driverAngularSpeed = inputAngularSpeed,
    driverAngularAcceleration = 0,
  ) => {
    const closure = closureAtDriverAngle(driverAngle);
    const {
      followerCenter,
      leftPinPosition,
      profile,
      rockerAngle,
    } = closure;
    const horizontalSlope = -rightRockerLength * Math.sin(rockerAngle);
    const horizontalCurvature = -rightRockerLength * Math.cos(rockerAngle);
    const betaSlope = horizontalSlope * profile.worldAngleSlope;
    const betaCurvature = profile.worldAngleCurvature * horizontalSlope ** 2
      + profile.worldAngleSlope * horizontalCurvature;
    const residualSlope = rightRockerLength * Math.cos(rockerAngle)
      - profile.firstDerivativeByAngle * betaSlope;
    const residualDriverSlope = profile.firstDerivativeByAngle;
    const rockerDerivativeByDriver = -residualDriverSlope / residualSlope;
    const residualAngleCurvature = -rightRockerLength
      * Math.sin(rockerAngle)
      - (
        profile.secondDerivativeByAngle * betaSlope ** 2
        + profile.firstDerivativeByAngle * betaCurvature
      );
    const residualMixedDerivative = profile.secondDerivativeByAngle
      * betaSlope;
    const residualDriverCurvature = -profile.secondDerivativeByAngle;
    const rockerSecondDerivativeByDriver = -(
      residualAngleCurvature * rockerDerivativeByDriver ** 2
      + 2 * residualMixedDerivative * rockerDerivativeByDriver
      + residualDriverCurvature
    ) / residualSlope;
    const rockerAngularSpeed = rockerDerivativeByDriver
      * driverAngularSpeed;
    const rockerAngularAcceleration = rockerSecondDerivativeByDriver
      * driverAngularSpeed ** 2
      + rockerDerivativeByDriver * driverAngularAcceleration;

    const rightSlope = new THREE.Vector3(
      -rightRockerLength * Math.sin(rockerAngle),
      rightRockerLength * Math.cos(rockerAngle),
      0,
    );
    const rightCurvature = new THREE.Vector3(
      -rightRockerLength * Math.cos(rockerAngle),
      -rightRockerLength * Math.sin(rockerAngle),
      0,
    );
    const followerVelocity = rightSlope.clone().multiplyScalar(
      rockerAngularSpeed,
    );
    const followerAcceleration = rightCurvature.clone().multiplyScalar(
      rockerAngularSpeed ** 2,
    ).addScaledVector(rightSlope, rockerAngularAcceleration);
    const leftSlope = new THREE.Vector3(
      leftRockerLength * Math.sin(rockerAngle),
      -leftRockerLength * Math.cos(rockerAngle),
      0,
    );
    const leftCurvature = new THREE.Vector3(
      leftRockerLength * Math.cos(rockerAngle),
      leftRockerLength * Math.sin(rockerAngle),
      0,
    );
    const leftPinVelocity = leftSlope.clone().multiplyScalar(
      rockerAngularSpeed,
    );
    const leftPinAcceleration = leftCurvature.clone().multiplyScalar(
      rockerAngularSpeed ** 2,
    ).addScaledVector(leftSlope, rockerAngularAcceleration);
    const outputPosition = new THREE.Vector3(
      sourceOutputGuideX,
      leftPinPosition.y,
      rockerPlaneZ,
    );
    const outputVelocity = new THREE.Vector3(0, leftPinVelocity.y, 0);
    const outputAcceleration = new THREE.Vector3(
      0,
      leftPinAcceleration.y,
      0,
    );

    const localAngleVelocity = profile.worldAngleSlope
      * followerVelocity.x - driverAngularSpeed;
    const localAngleAcceleration = profile.worldAngleCurvature
      * followerVelocity.x ** 2
      + profile.worldAngleSlope * followerAcceleration.x
      - driverAngularAcceleration;
    const faceVelocityY = profile.firstDerivativeByAngle
      * localAngleVelocity;
    const faceAccelerationY = profile.secondDerivativeByAngle
      * localAngleVelocity ** 2
      + profile.firstDerivativeByAngle * localAngleAcceleration;
    const contactZVelocity = -profile.tangentialOffset
      / profile.radialProjection * followerVelocity.x;
    const contactZAcceleration = -(contactTrackRadius ** 2)
      / profile.radialProjection ** 3 * followerVelocity.x ** 2
      - profile.tangentialOffset / profile.radialProjection
        * followerAcceleration.x;
    const contactVelocity = new THREE.Vector3(
      followerVelocity.x,
      faceVelocityY,
      contactZVelocity,
    );
    const contactAcceleration = new THREE.Vector3(
      followerAcceleration.x,
      faceAccelerationY,
      contactZAcceleration,
    );
    const faceTangent = new THREE.Vector3(
      1,
      profile.lowerYDerivativeByX,
      0,
    ).normalize();
    const faceNormal = new THREE.Vector3(
      -profile.lowerYDerivativeByX,
      1,
      0,
    ).normalize();

    const rollerAngle = -(
      contactTrackRadius * driverAngle
        - (followerCenter.x - sourceClosure.followerCenter.x)
    ) / followerRadius;
    const rollerAngularSpeed = -(
      contactTrackRadius * driverAngularSpeed - followerVelocity.x
    ) / followerRadius;
    const rollerAngularAcceleration = followerAcceleration.x
      / followerRadius;
    const rollingSurfaceSpeed = contactTrackRadius * driverAngularSpeed
      - followerVelocity.x;
    const noSlipSpeedError = rollingSurfaceSpeed
      + followerRadius * rollerAngularSpeed;
    const rightVector = new THREE.Vector3(
      followerCenter.x - rockerPivot.x,
      followerCenter.y - rockerPivot.y,
      0,
    );
    const leftVector = new THREE.Vector3(
      leftPinPosition.x - rockerPivot.x,
      leftPinPosition.y - rockerPivot.y,
      0,
    );
    const rightLengthRate = rightVector.dot(followerVelocity)
      / rightRockerLength;
    const rightLengthAcceleration = (
      followerVelocity.lengthSq()
        + rightVector.dot(followerAcceleration)
    ) / rightRockerLength;
    const leftLengthRate = leftVector.dot(leftPinVelocity)
      / leftRockerLength;
    const leftLengthAcceleration = (
      leftPinVelocity.lengthSq()
        + leftVector.dot(leftPinAcceleration)
    ) / leftRockerLength;
    return {
      ...closure,
      contactAcceleration,
      contactGap: followerCenter.y + followerRadius - profile.lowerY,
      contactNormalAccelerationError:
        followerAcceleration.y - faceAccelerationY,
      contactNormalVelocityError: followerVelocity.y - faceVelocityY,
      contactVelocity,
      driverAngle,
      driverAngularAcceleration,
      driverAngularSpeed,
      faceAccelerationY,
      faceNormal,
      faceTangent,
      faceVelocityY,
      followerAcceleration,
      followerVelocity,
      leftLengthAccelerationError: leftLengthAcceleration,
      leftLengthError: leftVector.length() - leftRockerLength,
      leftLengthRateError: leftLengthRate,
      leftPinAcceleration,
      leftPinVelocity,
      leftVector,
      localAngleAcceleration,
      localAngleVelocity,
      noSlipSpeedError,
      outputAcceleration,
      outputDisplacement: outputPosition.y - sourceOutputY,
      outputPosition,
      outputVelocity,
      rightLengthAccelerationError: rightLengthAcceleration,
      rightLengthError: rightVector.length() - rightRockerLength,
      rightLengthRateError: rightLengthRate,
      rightVector,
      rockerAngularAcceleration,
      rockerAngularSpeed,
      rockerDerivativeByDriver,
      rockerSecondDerivativeByDriver,
      rollerAngle,
      rollerAngularAcceleration,
      rollerAngularSpeed,
      rollingSurfaceSpeed,
      slotAcceleration: leftPinAcceleration.x,
      slotOffset: leftPinPosition.x - sourceOutputGuideX,
      slotSpeed: leftPinVelocity.x,
    };
  };

  const stateAtTime = (time) => {
    const driverAngle = inputAngularSpeed * time;
    const state = linkageAtDriverMotion(driverAngle);
    let wavePhase = positiveModulo(driverAngle, wavePitch);
    for (const boundary of [0, valleyAngleWithinWave, wavePitch]) {
      if (Math.abs(wavePhase - boundary) < 1e-12) wavePhase = boundary;
    }
    const crestDistance = Math.min(wavePhase, wavePitch - wavePhase);
    let stage;
    if (crestDistance < 1e-11) {
      stage = 'cam-crest-output-lower-reversal';
    } else if (Math.abs(wavePhase - valleyAngleWithinWave) < 1e-11) {
      stage = 'cam-valley-output-upper-reversal';
    } else if (state.outputVelocity.y > 0) {
      stage = 'waved-face-lifts-upright-bar-through-rocker';
    } else {
      stage = 'weighted-upright-bar-returns-follower-to-cam';
    }
    return {
      ...state,
      completedOutputCycles: driverAngle / wavePitch,
      inputRevolutions: driverAngle / fullTurn,
      stage,
      wavePhase,
    };
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.59,
  });
  const driverSideMaterial = matte(0xd75a31, {
    metalness: 0.16,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.60,
  });
  const drivenDarkMaterial = matte(0x174f69, {
    metalness: 0.18,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.70,
  });
  const weightMaterial = matte(PALETTE.brass, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const witnessMaterial = matte(PALETTE.white, { roughness: 0.45 });

  const input = new THREE.Group();
  const inputRotor = new THREE.Group();
  input.position.x = camAxisX;
  input.userData.axis = Y_AXIS.clone();
  input.userData.role = 'continuous-upright-shaft-with-six-wave-face-cam';
  input.userData.rotor = inputRotor;
  input.add(inputRotor);

  const baseDiskHeight = camTopY - maximumLowerFaceY;
  const camBaseDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(
      camOuterRadius,
      camOuterRadius,
      baseDiskHeight,
      144,
    ),
    driverMaterial,
  );
  camBaseDisk.position.y = (camTopY + maximumLowerFaceY) / 2;
  camBaseDisk.userData.role = 'flat-topped-base-of-waved-wheel';

  const camSkirtInnerRadius = 0.66;
  const camAngularSegments = camWaveCount * 96;
  const wavedSkirt = new THREE.Mesh(
    wavedSkirtGeometry({
      angularSegments: camAngularSegments,
      innerRadius: camSkirtInnerRadius,
      lowerYAtAngle: (angle) => localProfileAtAngle(angle).lowerY,
      maximumLowerY: maximumLowerFaceY,
      outerRadius: camOuterRadius,
    }),
    driverSideMaterial,
  );
  wavedSkirt.userData.role = 'six-wave-lower-face-of-upright-shaft-cam';
  wavedSkirt.userData.waveCount = camWaveCount;

  const wavedOutlinePoints = Array.from(
    { length: camAngularSegments },
    (_, index) => {
      const angle = index / camAngularSegments * fullTurn;
      return new THREE.Vector3(
        camOuterRadius * Math.sin(angle),
        localProfileAtAngle(angle).lowerY - 0.014,
        camOuterRadius * Math.cos(angle),
      );
    },
  );
  const wavedOutline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(wavedOutlinePoints),
    new THREE.LineBasicMaterial({ color: PALETTE.ink }),
  );
  wavedOutline.userData.role = 'dark-outline-of-six-wave-cam-face';
  // Brown's ink edge only: kept for references, not drawn.
  wavedOutline.visible = false;
  wavedOutline.userData.retiredInkOutline = true;

  const camHubHeight = camTopY - minimumLowerFaceY + 0.16;
  const camHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.63, 0.63, camHubHeight, 46),
    driverMaterial,
  );
  camHub.position.y = camTopY - camHubHeight / 2;
  camHub.userData.role = 'central-hub-rigid-with-waved-wheel';

  const upperShaftLength = (
    sourceCamTopY - sourceUpperShaftTopY
  ) * sourceUnitsPerPixel;
  const upperShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, upperShaftLength, 34),
    darkMaterial,
  );
  upperShaft.position.y = camTopY + upperShaftLength / 2;
  upperShaft.userData.role = 'upper-visible-section-of-upright-input-shaft';

  const collarHeight = (
    sourceCamTopY - sourceUpperCollarTopY
  ) * sourceUnitsPerPixel;
  const upperCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.66, 0.66, collarHeight, 42),
    driverMaterial,
  );
  upperCollar.position.y = camTopY + collarHeight / 2;
  upperCollar.userData.role = 'source-proportioned-collar-above-waved-wheel';

  const lowerShaftBottomY = rockerPivot.y - (
    sourceLowerShaftTipY - sourceRockerPivot.y
  ) * sourceUnitsPerPixel;
  const lowerShaftLength = minimumLowerFaceY - lowerShaftBottomY;
  const lowerShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.23, lowerShaftLength, 30),
    darkMaterial,
  );
  lowerShaft.position.y = minimumLowerFaceY - lowerShaftLength / 2;
  lowerShaft.userData.role = 'lower-visible-section-of-upright-input-shaft';

  const lowerSpade = new THREE.Group();
  lowerSpade.position.y = lowerShaftBottomY + 0.34;
  lowerSpade.userData.role = 'source-shaped-lower-hand-grip-on-input-shaft';
  const lowerSpadeStem = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.82, 0.68),
    driverMaterial,
  );
  const lowerSpadeEnd = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 24, 16),
    driverMaterial,
  );
  lowerSpadeEnd.scale.y = 1.25;
  lowerSpadeEnd.position.y = -0.48;
  lowerSpade.add(lowerSpadeStem, lowerSpadeEnd);

  const camFaceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.07, camOuterRadius * 1.22),
    witnessMaterial,
  );
  camFaceIndex.position.set(0, camTopY + 0.045, camOuterRadius * 0.34);
  camFaceIndex.userData.role = 'white-radial-index-on-waved-wheel-top';
  const shaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.42, 0.055),
    witnessMaterial,
  );
  shaftIndex.position.set(0.27, camTopY + upperShaftLength * 0.55, 0);
  shaftIndex.userData.role = 'white-index-on-upright-input-shaft';
  inputRotor.add(
    camBaseDisk,
    wavedSkirt,
    wavedOutline,
    camHub,
    upperShaft,
    upperCollar,
    lowerShaft,
    lowerSpade,
    camFaceIndex,
    shaftIndex,
  );

  const rockerAssembly = new THREE.Group();
  rockerAssembly.position.set(rockerPivot.x, rockerPivot.y, rockerPlaneZ);
  rockerAssembly.rotation.z = sourceRockerAngle;
  rockerAssembly.userData.axis = Z_AXIS.clone();
  rockerAssembly.userData.role =
    'single-rigid-oscillating-rod-between-output-pin-and-follower-wheel';
  const rockerBeam = makeBeam(
    new THREE.Vector3(-leftRockerLength, 0, 0),
    new THREE.Vector3(rightRockerLength, 0, 0),
    {
      color: PALETTE.driven,
      depth: 0.30,
      jointRadius: 0.26,
      thickness: 0.22,
    },
  );
  rockerBeam.userData.role = 'straight-source-proportioned-oscillating-rod';
  const rockerPivotRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.075, 10, 42),
    drivenDarkMaterial,
  );
  rockerPivotRing.position.z = 0.18;
  rockerPivotRing.userData.role = 'moving-eye-around-fixed-rocker-fulcrum';
  // Brown's ink edge only: kept for references, not drawn.
  rockerPivotRing.visible = false;
  rockerPivotRing.userData.retiredInkOutline = true;
  const leftJointPinRadius = 0.14;
  const leftJointPin = cylinderAlongZ(
    leftJointPinRadius,
    0.92,
    darkMaterial,
    30,
  );
  leftJointPin.position.set(-leftRockerLength, 0, -0.03);
  leftJointPin.userData.role = 'pin-sliding-in-horizontal-output-crosshead-slot';

  const followerAssembly = new THREE.Group();
  followerAssembly.position.set(
    rightRockerLength,
    0,
    followerPlaneZ - rockerPlaneZ,
  );
  followerAssembly.userData.role = 'large-wheel-follower-carried-by-rocker-end';
  const followerRotor = new THREE.Group();
  followerRotor.userData.axis = Z_AXIS.clone();
  followerRotor.userData.role = 'freely-rolling-face-cam-follower';
  const followerWheel = cylinderAlongZ(
    followerRadius,
    followerDepth,
    drivenMaterial,
    64,
  );
  followerWheel.userData.role = 'source-size-roller-held-against-waved-face';
  const followerRim = new THREE.Mesh(
    new THREE.TorusGeometry(followerRadius * 0.82, 0.065, 10, 56),
    darkMaterial,
  );
  followerRim.position.z = followerDepth / 2 + 0.018;
  followerRim.userData.role = 'dark-rim-on-rolling-follower-face';
  // Brown's ink edge only: kept for references, not drawn.
  followerRim.visible = false;
  followerRim.userData.retiredInkOutline = true;
  const followerIndex = new THREE.Mesh(
    new THREE.BoxGeometry(followerRadius * 0.78, 0.10, 0.05),
    witnessMaterial,
  );
  followerIndex.position.set(
    followerRadius * 0.43,
    0,
    followerDepth / 2 + 0.07,
  );
  followerIndex.userData.role = 'white-spin-index-on-large-follower-wheel';
  const followerHub = cylinderAlongZ(0.23, followerDepth + 0.24, darkMaterial, 34);
  followerHub.userData.role = 'through-hub-of-rocker-carried-follower-wheel';
  followerRotor.add(followerWheel, followerRim, followerIndex, followerHub);
  followerAssembly.add(followerRotor);
  rockerAssembly.add(
    rockerBeam,
    rockerPivotRing,
    leftJointPin,
    followerAssembly,
  );

  const fixedRockerPivot = cylinderAlongZ(0.14, 1.18, darkMaterial, 32);
  fixedRockerPivot.position.set(rockerPivot.x, rockerPivot.y, 2.53);
  fixedRockerPivot.userData.role = 'fixed-through-pin-of-oscillating-rod';
  const fixedPivotBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.08, 10, 40),
    frameMaterial,
  );
  fixedPivotBearing.position.set(rockerPivot.x, rockerPivot.y, 2.12);
  fixedPivotBearing.userData.role = 'fixed-bearing-behind-rocker-fulcrum';

  const outputSlide = new THREE.Group();
  outputSlide.position.set(sourceOutputGuideX, sourceOutputY, rockerPlaneZ);
  outputSlide.userData.role = 'purely-vertical-weighted-upright-output-bar';
  outputSlide.userData.translationAxis = Y_AXIS.clone();
  const slotStraightHalfLength = 0.23;
  const slotInnerRadius = 0.17;
  const slotOuterRadius = 0.31;
  const outputSlot = new THREE.Mesh(
    centeredExtrusion(
      horizontalCapsuleRingShape(
        slotInnerRadius,
        slotOuterRadius,
        slotStraightHalfLength,
      ),
      0.34,
      0.009,
    ),
    drivenDarkMaterial,
  );
  outputSlot.userData.role =
    'horizontal-slot-removing-rocker-pin-side-motion-from-upright-bar';
  const outputRodLength = 3.25;
  const outputRod = new THREE.Mesh(
    new THREE.BoxGeometry(0.27, outputRodLength, 0.34),
    drivenMaterial,
  );
  outputRod.position.y = -outputRodLength / 2 - 0.24;
  outputRod.userData.role = 'guided-rectilinear-upright-output-bar';
  const outputWeight = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.58, 0.66),
    weightMaterial,
  );
  outputWeight.position.y = -outputRodLength - 0.50;
  outputWeight.userData.role =
    'weight-that-keeps-large-follower-against-cam-underside';
  const outputIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.36, 0.04),
    witnessMaterial,
  );
  outputIndex.position.set(0.16, -1.05, 0.20);
  outputIndex.userData.role = 'white-translation-index-on-upright-output-bar';
  outputSlide.add(outputSlot, outputRod, outputWeight, outputIndex);

  const framePlaneZ = -0.90;
  const baseY = -4.05;
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-bearings-and-guides-for-cam-rocker-and-output-bar';
  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(9.5, 0.34, 1.55),
    frameMaterial,
  );
  baseRail.position.set(0.65, baseY, framePlaneZ);
  baseRail.userData.role = 'fixed-base-under-waved-cam-mechanism';
  const rearColumnHeight = 7.25;
  const rearColumn = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, rearColumnHeight, 0.52),
    frameMaterial,
  );
  rearColumn.position.set(
    camAxisX + 3.05,
    baseY + rearColumnHeight / 2,
    framePlaneZ,
  );
  rearColumn.userData.role = 'rear-standard-supporting-upright-shaft-bearings';
  const upperBearingY = camTopY + upperShaftLength * 0.76;
  const lowerBearingY = lowerShaftBottomY + 0.32;
  const shaftBearing = (y, index) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(0.37, 0.095, 10, 42),
      frameMaterial,
    );
    bearing.rotation.x = Math.PI / 2;
    bearing.position.set(camAxisX, y, 0);
    bearing.userData.role = `fixed-upright-input-shaft-bearing-${index}`;
    return bearing;
  };
  const upperShaftBearing = shaftBearing(upperBearingY, 1);
  const lowerShaftBearing = shaftBearing(lowerBearingY, 2);
  const upperBearingArm = makeBeam(
    new THREE.Vector3(camAxisX + 3.05, upperBearingY, framePlaneZ),
    new THREE.Vector3(camAxisX, upperBearingY, 0),
    { color: PALETTE.frame, depth: 0.28, thickness: 0.19 },
  );
  upperBearingArm.userData.role = 'upper-depth-arm-to-upright-shaft-bearing';
  const lowerBearingArm = makeBeam(
    new THREE.Vector3(camAxisX + 3.05, lowerBearingY, framePlaneZ),
    new THREE.Vector3(camAxisX, lowerBearingY, 0),
    { color: PALETTE.frame, depth: 0.28, thickness: 0.19 },
  );
  lowerBearingArm.userData.role = 'lower-depth-arm-to-upright-shaft-bearing';
  const pivotSupport = makeBeam(
    new THREE.Vector3(rockerPivot.x, baseY + 0.18, framePlaneZ),
    new THREE.Vector3(rockerPivot.x, rockerPivot.y, 2.10),
    { color: PALETTE.frame, depth: 0.32, thickness: 0.24 },
  );
  pivotSupport.userData.role = 'depth-braced-standard-of-fixed-rocker-pivot';

  const outputGuideYs = [-1.10, -2.35];
  const outputGuideCheeks = [];
  const outputGuideBridges = [];
  for (const [guideIndex, guideY] of outputGuideYs.entries()) {
    for (const sign of [-1, 1]) {
      const cheek = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.48, 0.54),
        frameMaterial,
      );
      cheek.position.set(
        sourceOutputGuideX + sign * 0.24,
        guideY,
        rockerPlaneZ - 0.06,
      );
      cheek.userData.role =
        `fixed-output-guide-${guideIndex + 1}-cheek-${sign < 0 ? 'left' : 'right'}`;
      outputGuideCheeks.push(cheek);
    }
    const bridge = makeBeam(
      new THREE.Vector3(sourceOutputGuideX, guideY, framePlaneZ),
      new THREE.Vector3(sourceOutputGuideX, guideY, rockerPlaneZ - 0.34),
      { color: PALETTE.frame, depth: 0.25, thickness: 0.18 },
    );
    bridge.userData.role = `depth-bridge-to-output-guide-${guideIndex + 1}`;
    outputGuideBridges.push(bridge);
  }
  fixedFrame.add(
    baseRail,
    rearColumn,
    upperShaftBearing,
    lowerShaftBearing,
    upperBearingArm,
    lowerBearingArm,
    pivotSupport,
    fixedRockerPivot,
    fixedPivotBearing,
    ...outputGuideCheeks,
    ...outputGuideBridges,
  );

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 18, 12),
    witnessMaterial,
  );
  contactMarker.userData.role = 'white-witness-of-zero-gap-cam-roller-contact';
  contactMarker.userData.witnessOffsetZ = followerDepth / 2 + 0.08;

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(10.8, 10.0, 7.4),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0.75, 0.18, 0.52);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-of-upright-cam-rocker-and-weighted-output';

  root.add(
    cameraEnvelope,
    fixedFrame,
    input,
    rockerAssembly,
    outputSlide,
    contactMarker,
  );

  const canonicalTimes = {
    sourceCrest: 0,
    liftingMidpoint: liftingMidpointAngle / inputAngularSpeed,
    camValley: valleyAngleWithinWave / inputAngularSpeed,
    returningMidpoint: returningMidpointAngle / inputAngularSpeed,
    nextCrest: wavePitch / inputAngularSpeed,
    halfRotation: Math.PI / inputAngularSpeed,
    fullRotation: rotationPeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.y = state.driverAngle;
    input.userData.angularSpeed = state.driverAngularSpeed;
    inputRotor.userData.angularSpeed = state.driverAngularSpeed;
    rockerAssembly.rotation.z = state.rockerAngle;
    rockerAssembly.userData.angularSpeed = state.rockerAngularSpeed;
    rockerAssembly.userData.angularAcceleration =
      state.rockerAngularAcceleration;
    followerRotor.rotation.z = state.rollerAngle - state.rockerAngle;
    followerRotor.userData.angularSpeed = state.rollerAngularSpeed;
    followerRotor.userData.angularAcceleration =
      state.rollerAngularAcceleration;
    outputSlide.position.y = state.outputPosition.y;
    outputSlide.userData.velocityY = state.outputVelocity.y;
    outputSlide.userData.accelerationY = state.outputAcceleration.y;
    contactMarker.position.set(
      state.contactPoint.x,
      state.contactPoint.y,
      followerPlaneZ + contactMarker.userData.witnessOffsetZ,
    );
    root.userData.contacts = {
      camRoller: {
        accelerationError: state.contactNormalAccelerationError,
        camPoint: state.contactPoint.clone(),
        faceNormal: state.faceNormal.clone(),
        faceTangent: state.faceTangent.clone(),
        gap: state.contactGap,
        rollerPoint: new THREE.Vector3(
          state.followerCenter.x,
          state.followerCenter.y + followerRadius,
          state.contactPoint.z,
        ),
        velocityError: state.contactNormalVelocityError,
      },
      outputSlot: {
        captured: Math.abs(state.slotOffset) + leftJointPinRadius
          < slotStraightHalfLength + slotInnerRadius,
        offset: state.slotOffset,
        speed: state.slotSpeed,
      },
      outputVerticalGuides: {
        axis: Y_AXIS.clone(),
        horizontalError: Math.abs(outputSlide.position.x - sourceOutputGuideX),
        rotationError: Math.hypot(
          outputSlide.rotation.x,
          outputSlide.rotation.y,
          outputSlide.rotation.z,
        ),
      },
      rollingFollower: {
        angularSpeed: state.rollerAngularSpeed,
        noSlipSpeedError: state.noSlipSpeedError,
        surfaceSpeed: state.rollingSurfaceSpeed,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData.mechanism =
    'six-wave-upright-face-cam-roller-rocker-rectilinear-output';
  root.userData.cameraDistanceScale = 1.01;
  root.userData.blocks = {
    baseRail,
    camBaseDisk,
    camFaceIndex,
    camHub,
    cameraEnvelope,
    contactMarker,
    fixedFrame,
    fixedPivotBearing,
    fixedRockerPivot,
    followerAssembly,
    followerHub,
    followerIndex,
    followerRim,
    followerRotor,
    followerWheel,
    input,
    inputRotor,
    leftJointPin,
    lowerBearingArm,
    lowerShaft,
    lowerShaftBearing,
    lowerSpade,
    lowerSpadeEnd,
    lowerSpadeStem,
    outputGuideBridges,
    outputGuideCheeks,
    outputIndex,
    outputRod,
    outputSlide,
    outputSlot,
    outputWeight,
    pivotSupport,
    rearColumn,
    rockerAssembly,
    rockerBeam,
    rockerPivotRing,
    shaftIndex,
    upperBearingArm,
    upperCollar,
    upperShaft,
    upperShaftBearing,
    wavedOutline,
    wavedSkirt,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.closureAtDriverAngle = closureAtDriverAngle;
  root.userData.geometry = {
    baseDiskHeight,
    baseY,
    camAngularSegments,
    camAxisX,
    camOuterRadius,
    camSkirtInnerRadius,
    camTopY,
    camWaveCount,
    collarHeight,
    contactTrackRadius,
    faceAmplitude,
    faceStroke,
    fixedFramePlaneZ: framePlaneZ,
    followerDepth,
    followerPlaneZ,
    followerRadius,
    fullTurn,
    inputAngularSpeed,
    leftRockerLength,
    leftJointPinRadius,
    liftingMidpointAngle,
    lowerShaftBottomY,
    lowerShaftLength,
    maximumLowerFaceY,
    maximumSlotOffset,
    meanLowerFaceY,
    minimumFaceFollowerX,
    minimumFaceRockerAngle,
    minimumFaceWorldAngle,
    minimumLowerFaceY,
    outputCyclePeriod,
    outputGuideYs,
    outputMidY,
    outputRodLength,
    outputStroke,
    rearColumnHeight,
    returningMidpointAngle,
    rightRockerLength,
    rockerPivot: rockerPivot.clone(),
    rockerPlaneZ,
    rotationPeriod,
    slotInnerRadius,
    slotOuterRadius,
    slotStraightHalfLength,
    sourceCamAxisX,
    sourceCamLeftX,
    sourceCamRadius,
    sourceCamRightX,
    sourceCamTopY,
    sourceFollowerCenter: sourceFollowerCenter.clone(),
    sourceFollowerRadius,
    sourceImageHeight,
    sourceImageWidth,
    sourceLeftVector: sourceLeftVector.clone(),
    sourceLowerShaftTipY,
    sourceOutputGuideX,
    sourceOutputPin: sourceOutputPin.clone(),
    sourceOutputY,
    sourceProfileCrestY,
    sourceProfileValleyY,
    sourceRightVector: sourceRightVector.clone(),
    sourceRockerAngle,
    sourceRockerPivot: sourceRockerPivot.clone(),
    sourceUnitsPerPixel,
    sourceUpperCollarTopY,
    sourceUpperShaftTopY,
    sourceVisibleWaveCount,
    upperShaftLength,
    valleyAngleWithinWave,
    wavePitch,
  };
  root.userData.linkageAtDriverMotion = linkageAtDriverMotion;
  root.userData.localProfileAtAngle = localProfileAtAngle;
  root.userData.profileAtWorldX = profileAtWorldX;
  root.userData.stateAtTime = stateAtTime;

  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  for (const object of [
    cameraEnvelope,
    camFaceIndex,
    contactMarker,
    followerIndex,
    outputIndex,
    shaftIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';
  return {
    cameraDirection: new THREE.Vector3(8.4, 5.4, 13.8),
    root,
    update,
  };
}

export function createAuthoredWaveCamMovement(movement) {
  switch (movement.id) {
    case 165: return sixWaveFaceCamRockerMotion();
    default: return null;
  }
}
