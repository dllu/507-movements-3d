import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function makeTubeThrough(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, points.length * 4, radius, 10, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function arcPoints(radius, startAngle, endAngle, z, count = 88) {
  const points = [];
  for (let index = 0; index <= count; index += 1) {
    const angle = THREE.MathUtils.lerp(
      startAngle,
      endAngle,
      index / count,
    );
    points.push(new THREE.Vector3(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
      z,
    ));
  }
  return points;
}

function eccentricRotaryEngine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const sourceScale = 0.42;
  const sourceEccentricity = 2;
  const sourcePistonRadius = 5;
  const sourceCylinderInnerRadius = 7;
  const sourceCylinderOuterRadius = 8;
  const sourceAbutmentNoseRadius = 1;
  const sourceAbutmentLocalNoseCenter = 5.133975;
  const sourceSealShoeInnerRadius = 6;
  const sourceSealShoeOuterRadius = 6.974937;
  const sourceSealShoeHalfWidth = 0.5;
  const eccentricity = sourceEccentricity * sourceScale;
  const pistonRadius = sourcePistonRadius * sourceScale;
  const cylinderInnerRadius = sourceCylinderInnerRadius * sourceScale;
  const cylinderOuterRadius = sourceCylinderOuterRadius * sourceScale;
  const abutmentNoseRadius = sourceAbutmentNoseRadius * sourceScale;
  const abutmentLocalNoseCenter = sourceAbutmentLocalNoseCenter
    * sourceScale;
  const sealShoeInnerRadius = sourceSealShoeInnerRadius * sourceScale;
  const sealShoeOuterRadius = sourceSealShoeOuterRadius * sourceScale;
  const sealShoeHalfWidth = sourceSealShoeHalfWidth * sourceScale;
  const contactCenterDistance = pistonRadius + abutmentNoseRadius;
  const shaftCenter = new THREE.Vector3(0, 0, 0);
  const passClearance = cylinderInnerRadius - sealShoeOuterRadius;

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const cosine = Math.cos(inputAngle);
    const sine = Math.sin(inputAngle);
    const rotorAngle = -inputAngle;
    const rotorAngularSpeed = -inputSpeed;
    const rotorAngularAcceleration = -inputAcceleration;
    const eccentricCenter = new THREE.Vector3(
      -eccentricity * sine,
      -eccentricity * cosine,
      0,
    );
    const eccentricCenterPrime = new THREE.Vector3(
      -eccentricity * cosine,
      eccentricity * sine,
      0,
    );
    const eccentricCenterSecond = new THREE.Vector3(
      eccentricity * sine,
      eccentricity * cosine,
      0,
    );
    const eccentricCenterVelocity = eccentricCenterPrime.clone()
      .multiplyScalar(inputSpeed);
    const eccentricCenterAcceleration = eccentricCenterSecond.clone()
      .multiplyScalar(inputSpeed ** 2)
      .addScaledVector(eccentricCenterPrime, inputAcceleration);

    const contactRadicand = contactCenterDistance ** 2
      - eccentricCenter.x ** 2;
    const verticalContactSeparation = Math.sqrt(contactRadicand);
    const verticalContactSeparationPrime = -eccentricCenter.x
      * eccentricCenterPrime.x / verticalContactSeparation;
    const verticalContactSeparationSecond = -(
      eccentricCenterPrime.x ** 2
        + eccentricCenter.x * eccentricCenterSecond.x
    ) / verticalContactSeparation - (
      eccentricCenter.x * eccentricCenterPrime.x
    ) ** 2 / verticalContactSeparation ** 3;
    const abutmentNoseCenter = new THREE.Vector3(
      0,
      eccentricCenter.y + verticalContactSeparation,
      0,
    );
    const abutmentNoseCenterPrime = new THREE.Vector3(
      0,
      eccentricCenterPrime.y + verticalContactSeparationPrime,
      0,
    );
    const abutmentNoseCenterSecond = new THREE.Vector3(
      0,
      eccentricCenterSecond.y + verticalContactSeparationSecond,
      0,
    );
    const abutmentVelocity = abutmentNoseCenterPrime.clone()
      .multiplyScalar(inputSpeed);
    const abutmentAcceleration = abutmentNoseCenterSecond.clone()
      .multiplyScalar(inputSpeed ** 2)
      .addScaledVector(abutmentNoseCenterPrime, inputAcceleration);
    const abutmentSourceGroupY = abutmentNoseCenter.y
      + abutmentLocalNoseCenter;
    const centerLine = abutmentNoseCenter.clone().sub(eccentricCenter);
    const contactNormal = centerLine.clone().multiplyScalar(
      1 / contactCenterDistance,
    );
    const pistonAbutmentContactPoint = eccentricCenter.clone()
      .addScaledVector(contactNormal, pistonRadius);
    const abutmentContactPoint = abutmentNoseCenter.clone()
      .addScaledVector(contactNormal, -abutmentNoseRadius);

    const cylinderContactDirection = eccentricCenter.clone()
      .multiplyScalar(1 / eccentricity);
    const pistonCylinderContactPoint = eccentricCenter.clone()
      .addScaledVector(cylinderContactDirection, pistonRadius);
    const cylinderInnerContactPoint = cylinderContactDirection.clone()
      .multiplyScalar(cylinderInnerRadius);
    const sealShoeOuterPoint = cylinderContactDirection.clone()
      .multiplyScalar(sealShoeOuterRadius);
    const pistonCylinderTangencyResidual = pistonCylinderContactPoint
      .distanceTo(cylinderInnerContactPoint);
    const pistonAbutmentContactResidual = pistonAbutmentContactPoint
      .distanceTo(abutmentContactPoint);
    const abutmentCenterDistanceResidual = centerLine.length()
      - contactCenterDistance;
    const sealShoePassVerticalClearance = inputAngle === Math.PI
      ? abutmentNoseCenter.y - abutmentNoseRadius
        - sealShoeOuterPoint.y
      : null;

    return {
      abutmentAcceleration,
      abutmentCenterDistanceResidual,
      abutmentContactPoint,
      abutmentGuideResidual: abutmentNoseCenter.x,
      abutmentNoseCenter,
      abutmentNoseCenterPrime,
      abutmentNoseCenterSecond,
      abutmentSourceGroupY,
      abutmentVelocity,
      contactNormal,
      contactRadicand,
      cylinderInnerContactPoint,
      eccentricCenter,
      eccentricCenterAcceleration,
      eccentricCenterPrime,
      eccentricCenterSecond,
      eccentricCenterVelocity,
      inductionSide: 'right-of-abutment-D',
      inputAcceleration,
      inputAngle,
      inputSpeed,
      pistonAbutmentContactPoint,
      pistonAbutmentContactResidual,
      pistonCylinderContactPoint,
      pistonCylinderTangencyResidual,
      rotorAngle,
      rotorAngularAcceleration,
      rotorAngularSpeed,
      sealShoeOuterPoint,
      sealShoePassVerticalClearance,
      steamFlowDirection: 'right-port-to-chamber-to-left-port',
      verticalContactSeparation,
      verticalContactSeparationPrime,
      verticalContactSeparationSecond,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...stateAtInputAngle(inputAngularSpeed * cycleTime),
      cycleTime,
      phase: cycleTime / cycleDuration,
    };
  };

  const lowAbutmentState = stateAtInputAngle(0);
  const highAbutmentState = stateAtInputAngle(Math.PI);
  const abutmentMinimumNoseCenterY = lowAbutmentState.abutmentNoseCenter.y;
  const abutmentMaximumNoseCenterY = highAbutmentState.abutmentNoseCenter.y;
  const abutmentStroke = abutmentMaximumNoseCenterY
    - abutmentMinimumNoseCenterY;

  const geometry = {
    abutmentLocalNoseCenter,
    abutmentMaximumNoseCenterY,
    abutmentMinimumNoseCenterY,
    abutmentNoseRadius,
    abutmentStroke,
    contactCenterDistance,
    cycleDuration,
    cylinderInnerRadius,
    cylinderOuterRadius,
    eccentricity,
    inputAngularSpeed,
    passClearance,
    pistonRadius,
    sealShoeHalfWidth,
    sealShoeInnerRadius,
    sealShoeOuterRadius,
    shaftCenter: shaftCenter.clone(),
    sourceAbutmentLocalNoseCenter,
    sourceAbutmentNoseRadius,
    sourceCylinderInnerRadius,
    sourceCylinderOuterRadius,
    sourceEccentricity,
    sourcePistonRadius,
    sourceScale,
    sourceSealShoeHalfWidth,
    sourceSealShoeInnerRadius,
    sourceSealShoeOuterRadius,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.24,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.41,
  });
  const pistonMaterial = matte(PALETTE.driver, {
    metalness: 0.20,
    roughness: 0.46,
  });
  const abutmentMaterial = matte(PALETTE.driven, {
    metalness: 0.21,
    roughness: 0.46,
  });
  const steamMaterial = matte(0xe66f4a, {
    opacity: 0.21,
    roughness: 0.60,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const exhaustMaterial = matte(0x4a93a8, {
    opacity: 0.19,
    roughness: 0.64,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const topGapHalfAngle = THREE.MathUtils.degToRad(20.5);
  const housingArcStart = Math.PI / 2 + topGapHalfAngle;
  const housingArcEnd = Math.PI / 2 + FULL_TURN - topGapHalfAngle;
  const housingBack = new THREE.Mesh(
    new THREE.RingGeometry(
      cylinderInnerRadius,
      cylinderOuterRadius,
      104,
      1,
      housingArcStart,
      housingArcEnd - housingArcStart,
    ),
    frameMaterial,
  );
  housingBack.position.z = -0.40;
  housingBack.userData.role = 'fixed-annular-cutaway-body-of-cylinder-A';
  root.add(housingBack);
  const innerCylinderWall = makeTubeThrough(
    arcPoints(
      cylinderInnerRadius,
      housingArcStart,
      housingArcEnd,
      -0.04,
    ),
    0.12,
    frameMaterial,
    'fixed-inner-circular-wall-of-cylinder-A',
  );
  const outerCylinderWall = makeTubeThrough(
    arcPoints(
      cylinderOuterRadius,
      housingArcStart,
      housingArcEnd,
      -0.04,
    ),
    0.12,
    frameMaterial,
    'fixed-outer-circular-wall-of-cylinder-A',
  );
  root.add(innerCylinderWall, outerCylinderWall);

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(8.10, 0.28, 1.42),
    frameMaterial,
  );
  foundation.position.set(0, -3.62, -0.14);
  foundation.userData.role = 'fixed-foundation-of-rotary-engine-A';
  root.add(foundation);

  const neckLeft = makeTubeThrough([
    new THREE.Vector3(-1.12, 2.66, -0.04),
    new THREE.Vector3(-1.46, 3.18, -0.04),
    new THREE.Vector3(-1.46, 4.20, -0.04),
  ], 0.17, frameMaterial, 'left-eduction-neck-of-cylinder-A');
  const neckRight = makeTubeThrough([
    new THREE.Vector3(1.12, 2.66, -0.04),
    new THREE.Vector3(1.46, 3.18, -0.04),
    new THREE.Vector3(1.46, 4.20, -0.04),
  ], 0.17, frameMaterial, 'right-induction-neck-of-cylinder-A');
  root.add(neckLeft, neckRight);

  const guideTower = new THREE.Group();
  guideTower.userData.role = 'fixed-vertical-guide-for-sliding-abutment-D';
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 3.18, 0.62),
      frameMaterial,
    );
    rail.position.set(side * 0.56, 4.13, -0.02);
    rail.userData.role = side < 0
      ? 'left-guide-rail-for-abutment-D'
      : 'right-guide-rail-for-abutment-D';
    guideTower.add(rail);
  }
  const guideCap = new THREE.Mesh(
    new THREE.BoxGeometry(1.34, 0.24, 0.72),
    frameMaterial,
  );
  guideCap.position.set(0, 5.66, -0.02);
  guideCap.userData.role = 'cap-of-abutment-D-guide';
  guideTower.add(guideCap);
  root.add(guideTower);

  const rotor = new THREE.Group();
  rotor.userData.role = 'eccentric-piston-C-fast-on-shaft-B';
  const eccentricPiston = cylinderAlongZ(
    pistonRadius,
    0.70,
    pistonMaterial,
    72,
  );
  eccentricPiston.position.set(0, -eccentricity, 0.22);
  eccentricPiston.userData.role = 'circular-body-of-eccentric-piston-C';
  rotor.add(eccentricPiston);
  const eccentricMarker = cylinderAlongZ(0.17, 0.82, whiteMaterial, 24);
  eccentricMarker.position.set(0, -eccentricity, 0.31);
  eccentricMarker.userData.role = 'visible-center-marker-of-eccentric-piston-C';
  rotor.add(eccentricMarker);
  const sealShoe = new THREE.Mesh(
    new THREE.BoxGeometry(
      2 * sealShoeHalfWidth,
      sealShoeOuterRadius - sealShoeInnerRadius,
      0.80,
    ),
    pistonMaterial,
  );
  sealShoe.position.set(
    0,
    -(sealShoeInnerRadius + sealShoeOuterRadius) / 2,
    0.24,
  );
  sealShoe.userData.role =
    'outer-sealing-tongue-of-piston-C-that-passes-abutment-D';
  rotor.add(sealShoe);
  const shaftToEccentricCenter = new THREE.Mesh(
    new THREE.BoxGeometry(eccentricity, 0.16, 0.34),
    darkMaterial,
  );
  shaftToEccentricCenter.position.set(0, -eccentricity / 2, 0.62);
  shaftToEccentricCenter.rotation.z = Math.PI / 2;
  shaftToEccentricCenter.userData.role =
    'rigid-eccentric-offset-from-shaft-B-to-piston-C-center';
  rotor.add(shaftToEccentricCenter);
  root.add(rotor);

  const shaftB = cylinderAlongZ(0.30, 1.24, darkMaterial, 36);
  shaftB.position.z = 0.34;
  shaftB.userData.role = 'central-main-shaft-B';
  root.add(shaftB);

  const abutmentD = new THREE.Group();
  abutmentD.userData.role =
    'single-vertically-sliding-abutment-D-between-induction-and-eduction';
  const abutmentNose = cylinderAlongZ(
    abutmentNoseRadius,
    0.74,
    abutmentMaterial,
    40,
  );
  abutmentNose.position.z = 0.26;
  abutmentNose.userData.role =
    'radius-one-contact-nose-of-sliding-abutment-D';
  abutmentD.add(abutmentNose);
  const abutmentStem = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 2.42, 0.62),
    abutmentMaterial,
  );
  abutmentStem.position.set(0, 1.47, 0.25);
  abutmentStem.userData.role = 'guided-stem-of-sliding-abutment-D';
  abutmentD.add(abutmentStem);
  root.add(abutmentD);

  const pistonAbutmentContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 22, 14),
    whiteMaterial,
  );
  pistonAbutmentContactMarker.userData.role =
    'instantaneous-sealing-contact-between-C-and-D';
  root.add(pistonAbutmentContactMarker);

  const inductionPort = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 1.08, 0.16),
    darkMaterial,
  );
  inductionPort.position.set(1.23, 3.46, 0.30);
  inductionPort.userData.role = 'right-induction-port';
  const eductionPort = inductionPort.clone();
  eductionPort.position.x = -1.23;
  eductionPort.userData.role = 'left-eduction-port';
  root.add(inductionPort, eductionPort);
  const inductionIndicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 22, 14),
    steamMaterial,
  );
  inductionIndicator.position.set(1.23, 3.10, 0.45);
  inductionIndicator.userData.role =
    'right-to-chamber-induction-flow-indicator';
  const eductionIndicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 22, 14),
    exhaustMaterial,
  );
  eductionIndicator.position.set(-1.23, 3.10, 0.45);
  eductionIndicator.userData.role =
    'chamber-to-left-eduction-flow-indicator';
  root.add(inductionIndicator, eductionIndicator);

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.z = state.rotorAngle;
    abutmentD.position.set(0, state.abutmentNoseCenter.y, 0);
    pistonAbutmentContactMarker.position.copy(
      state.pistonAbutmentContactPoint,
    );
    pistonAbutmentContactMarker.position.z = 0.72;
    const liftFraction = (
      state.abutmentNoseCenter.y - abutmentMinimumNoseCenterY
    ) / abutmentStroke;
    inductionIndicator.scale.setScalar(0.72 + 0.20 * (1 - liftFraction));
    eductionIndicator.scale.setScalar(0.72 + 0.20 * liftFraction);
  };

  const sourceState = stateAtInputAngle(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'shaft-fast-eccentric-circular-piston-tangent-to-fixed-cylinder-with-cam-lifted-sliding-port-abutment',
    blocks: {
      abutmentD,
      abutmentNose,
      abutmentStem,
      eccentricMarker,
      eccentricPiston,
      eductionIndicator,
      eductionPort,
      foundation,
      guideCap,
      guideTower,
      housingBack,
      inductionIndicator,
      inductionPort,
      innerCylinderWall,
      neckLeft,
      neckRight,
      outerCylinderWall,
      pistonAbutmentContactMarker,
      rotor,
      sealShoe,
      shaftB,
      shaftToEccentricCenter,
    },
    degreesOfFreedom: {
      abutmentVerticalPositionIndependent: false,
      eccentricPistonRotationIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
    },
    dynamics: {
      abutmentConstraint:
        'D is treated as a massless translating cam follower held tangent to C; spring force and impact are not solved.',
      portIndicators:
        'The right induction and left eduction markers reproduce Brown’s arrows; they are not pressure or mass-flow solutions.',
      pressureExpansionCutoffLeakageFrictionInertiaAndLoadsModeled: false,
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsPressuresOrLoads: false,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Fixed cylinder A has a central shaft B and a 7-unit inner radius. Circular piston C is fast on B with a 2-unit eccentricity and 5-unit radius, so C remains internally tangent to A at exactly one point while rotating with the shaft. The single abutment D slides only on the vertical centerline between the right induction and left eduction ports. Its radius-1 nose remains externally tangent to C by exact circle-line cam closure, lifting four units as C approaches the top so the outer sealing tongue can pass.',
    motion: {
      abutmentStroke,
      crankDirection: 'clockwise',
      cycleDuration,
      inputAngularSpeed,
      pistonRevolutionsPerCycle: 1,
    },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      officialCanvasCyclePeriod: 4,
      officialCanvasCyclesPerMinute: 15,
      officialCanvasModelPresent: true,
      reason:
        'The official Movement 425 page embeds a five-part Canvas construction. Its clockwise eccentric, radii 5/7/8, eccentricity 2, sealing tongue dimensions, vertical D guide, radius-1 follower nose, and exact cam-contact lift were extracted and independently reconstructed.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      abutmentNoseCenter: sourceState.abutmentNoseCenter.clone(),
      abutmentSourceGroupY: sourceState.abutmentSourceGroupY,
      eccentricCenter: sourceState.eccentricCenter.clone(),
      pistonAbutmentContactPoint:
        sourceState.pistonAbutmentContactPoint.clone(),
      pistonCylinderContactPoint:
        sourceState.pistonCylinderContactPoint.clone(),
      rotorAngle: sourceState.rotorAngle,
    },
    sourceReference: {
      brownPlate425: {
        abutmentDApproximateBoundsPixels: [258, 43, 301, 255],
        cylinderAApproximateCenterPixels: [271, 336],
        cylinderAApproximateInnerRadiusPixels: 145,
        eccentricPistonCApproximateCenterPixels: [272, 356],
        imageHeight: 525,
        imageWidth: 525,
        mainShaftBApproximateCenterPixels: [271, 320],
        measurementUncertaintyPixels: 12,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'A is the cylinder',
          'shaft B passes centrally through A',
          'piston C is an eccentric fast on B',
          'C contacts the cylinder at one point',
          'steam induction and eduction follow the arrows',
          'steam pressure on one side rotates C and B',
          'sliding abutment D lies between the ports',
          'D moves out of the way to let C pass',
        ],
        engravingEvidence:
          'Brown’s cutaway shows a circular housing A, central shaft B, eccentric circular piston C with an outer sealing tongue, a vertical top abutment D, and opposed flow arrows at the two top ports.',
        officialCanvasEvidence:
          'The official model uses eccentricity 2, piston radius 5, cylinder inner/outer radii 7/8, a sealing tongue from radius 6 to 6.974937 with half-width 0.5, and a radius-1 D nose. D’s source transform rises from y=9.133975 to 13.133975 while maintaining exact external tangency to C.',
        reconstructionDisclosure:
          'Brown gives no absolute scale, axial depth, abutment loading, seal force, valve timing, pressure cycle, speed, materials, inertia, or loads. The cutaway depth, guide construction, colors, and flow markers are independently engineered; all planar contact dimensions and motion laws come from the official model.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 425',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      abutmentCamLaw:
        'DnoseY=CcenterY+sqrt((pistonRadius+noseRadius)^2-CcenterX^2)',
      eccentricCenterLaw:
        'Ccenter=[-eccentricity*sin(inputAngle),-eccentricity*cos(inputAngle)]',
      externalAbutmentTangency:
        '|DnoseCenter-Ccenter|=pistonRadius+noseRadius',
      internalCylinderTangency:
        'eccentricity+pistonRadius=cylinderInnerRadius',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.15, -3.78, -1.00),
    new THREE.Vector3(4.15, 6.14, 1.38),
  );
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraDirection = new THREE.Vector3(5.0, 3.8, 12.8);
  root.userData.groundFloorY = -3.78;
  markShadows(root);
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredEccentricRotaryEngineMovement(movement) {
  if (movement.id !== 425) return null;
  return eccentricRotaryEngine(movement);
}
