import { correctWatchRegulator } from './watch-balance-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

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

function torusAroundZ(majorRadius, tubeRadius, material, segments = 72) {
  return new THREE.Mesh(
    new THREE.TorusGeometry(majorRadius, tubeRadius, 12, segments),
    material,
  );
}

function tubeThrough(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(24, points.length * 3),
      radius, 10, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function watchRegulator(movement) {
  const root = new THREE.Group();

  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterCenter = new THREE.Vector2(260, 207);
  const sourceRasterBalanceTop = new THREE.Vector2(260, 5);
  const sourceRasterBalanceBottom = new THREE.Vector2(260, 409);
  const sourceRasterBalanceLeft = new THREE.Vector2(59, 207);
  const sourceRasterBalanceRight = new THREE.Vector2(464, 207);
  const sourceRasterStudR = new THREE.Vector2(172, 199);
  const sourceRasterCurbP = new THREE.Vector2(268, 293);
  const sourceRasterPointerTip = new THREE.Vector2(260, 486);
  const sourceRasterSlowEnd = new THREE.Vector2(82, 405);
  const sourceRasterFastEnd = new THREE.Vector2(438, 405);

  const balanceOuterRadius = 3.35;
  const sourceScale = balanceOuterRadius / (
    sourceRasterBalanceBottom.y - sourceRasterBalanceTop.y
  ) * 2;
  const springOuterRadius = sourceRasterCurbP.distanceTo(
    sourceRasterCenter,
  ) * sourceScale;
  const springInnerRadius = 0.43;
  const balanceRimTubeRadius = 0.19;
  const balanceHubRadius = 0.53;
  const fixedRingInnerRadius = 0.77;
  const fixedRingOuterRadius = 1.06;
  const pointerRadius = (
    sourceRasterPointerTip.y - sourceRasterCenter.y
  ) * sourceScale;
  const springPlaneZ = 0.73;
  const regulatorPlaneZ = 0.98;

  // Three inner turns lead to a near-circular terminal half-coil.  The
  // terminal coil is precisely circular over the regulator's travel, so the
  // two rigid curb pins can select a different arc length without sliding
  // radially on their lever.
  const innerSpiralTurns = 3;
  const innerSpiralAngleSpan = innerSpiralTurns * FULL_TURN;
  const innerSpiralJoinAngle = -innerSpiralAngleSpan;
  const referenceCurbAngle = innerSpiralJoinAngle - Math.PI / 2;
  const outerStudAngle = innerSpiralJoinAngle - Math.PI;
  const radialGrowthPerRadian = (
    springOuterRadius - springInnerRadius
  ) / innerSpiralAngleSpan;
  const spiralPrimitive = (radius) => (
    radius * Math.sqrt(radius ** 2 + radialGrowthPerRadian ** 2)
      + radialGrowthPerRadian ** 2 * Math.asinh(
        radius / radialGrowthPerRadian,
      )
  ) / (2 * radialGrowthPerRadian);
  const innerSpiralLength = spiralPrimitive(springOuterRadius)
    - spiralPrimitive(springInnerRadius);
  const referenceActiveLength = innerSpiralLength
    + springOuterRadius * (
      innerSpiralJoinAngle - referenceCurbAngle
    );
  const totalSpringLength = innerSpiralLength
    + springOuterRadius * (
      innerSpiralJoinAngle - outerStudAngle
    );

  // Frequency is proportional to sqrt(stiffness), while a uniform strip's
  // torsional stiffness is inversely proportional to its active length.  The
  // prescribed small rate excursion therefore determines the exact curb
  // angle needed on the terminal coil.  This makes the integrated oscillator
  // phase analytic and closes after ten vibrations.
  const frequencyExcursion = 0.025;
  const adjustmentCyclePeriod = 20;
  const adjustmentAngularFrequency = FULL_TURN / adjustmentCyclePeriod;
  const balanceCyclesPerAdjustmentCycle = 10;
  const referenceBalanceAngularFrequency = FULL_TURN
    * balanceCyclesPerAdjustmentCycle / adjustmentCyclePeriod;
  const balanceAmplitude = THREE.MathUtils.degToRad(24);

  const balanceRimMass = 5.0;
  const balanceSpokeMass = 0.42;
  const balanceHubMass = 0.80;
  const spokeInnerRadius = balanceHubRadius;
  const spokeOuterRadius = balanceOuterRadius - balanceRimTubeRadius;
  const balanceInertia = balanceRimMass * balanceOuterRadius ** 2
    + 3 * balanceSpokeMass * (
      spokeInnerRadius ** 2
        + spokeInnerRadius * spokeOuterRadius
        + spokeOuterRadius ** 2
    ) / 3
    + balanceHubMass * balanceHubRadius ** 2 / 2;
  const referenceSpringStiffness = balanceInertia
    * referenceBalanceAngularFrequency ** 2;

  const spiralArcLengthAtParameter = (parameter) => {
    const radius = springInnerRadius + (
      springOuterRadius - springInnerRadius
    ) * parameter;
    return spiralPrimitive(radius) - spiralPrimitive(springInnerRadius);
  };

  const innerSpiralParameterAtArcLength = (arcLength) => {
    let lower = 0;
    let upper = 1;
    for (let iteration = 0; iteration < 48; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (spiralArcLengthAtParameter(middle) < arcLength) {
        lower = middle;
      } else {
        upper = middle;
      }
    }
    return (lower + upper) / 2;
  };

  const baselinePolarAtArcLength = (arcLength) => {
    const boundedArcLength = THREE.MathUtils.clamp(
      arcLength,
      0,
      totalSpringLength,
    );
    if (boundedArcLength === 0) {
      return { angle: 0, radius: springInnerRadius };
    }
    if (boundedArcLength < innerSpiralLength) {
      const parameter = innerSpiralParameterAtArcLength(
        boundedArcLength,
      );
      return {
        angle: -innerSpiralAngleSpan * parameter,
        radius: springInnerRadius + (
          springOuterRadius - springInnerRadius
        ) * parameter,
      };
    }
    return {
      angle: innerSpiralJoinAngle - (
        boundedArcLength - innerSpiralLength
      ) / springOuterRadius,
      radius: springOuterRadius,
    };
  };

  const rotatingPoint = ({
    angle,
    angularAcceleration = 0,
    angularVelocity = 0,
    radius,
    z = 0,
  }) => {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const position = new THREE.Vector3(
      radius * cosine,
      radius * sine,
      z,
    );
    const velocity = new THREE.Vector3(
      -radius * sine * angularVelocity,
      radius * cosine * angularVelocity,
      0,
    );
    const acceleration = new THREE.Vector3(
      -radius * (
        cosine * angularVelocity ** 2
          + sine * angularAcceleration
      ),
      radius * (
        -sine * angularVelocity ** 2
          + cosine * angularAcceleration
      ),
      0,
    );
    return { acceleration, position, velocity };
  };

  const stateAtTime = (time) => {
    const unwrappedAdjustmentAngle = adjustmentAngularFrequency * time;
    const adjustmentCycleAngle = positiveModulo(
      unwrappedAdjustmentAngle,
      FULL_TURN,
    );
    const rateCoordinate = Math.sin(adjustmentCycleAngle);
    const rateCoordinateVelocity = adjustmentAngularFrequency
      * Math.cos(adjustmentCycleAngle);
    const rateCoordinateAcceleration = -(adjustmentAngularFrequency ** 2)
      * Math.sin(adjustmentCycleAngle);
    const frequencyRatio = 1 + frequencyExcursion * rateCoordinate;
    const frequencyRatioVelocity = frequencyExcursion
      * rateCoordinateVelocity;
    const frequencyRatioAcceleration = frequencyExcursion
      * rateCoordinateAcceleration;
    const activeSpringLength = referenceActiveLength
      / frequencyRatio ** 2;
    const activeSpringLengthVelocity = -2 * referenceActiveLength
      * frequencyRatioVelocity / frequencyRatio ** 3;
    const activeSpringLengthAcceleration =
      6 * referenceActiveLength * frequencyRatioVelocity ** 2
        / frequencyRatio ** 4
      - 2 * referenceActiveLength * frequencyRatioAcceleration
        / frequencyRatio ** 3;
    const regulatorAngle = (
      referenceActiveLength - activeSpringLength
    ) / springOuterRadius;
    const regulatorAngularVelocity = -activeSpringLengthVelocity
      / springOuterRadius;
    const regulatorAngularAcceleration = -activeSpringLengthAcceleration
      / springOuterRadius;
    const curbAngle = referenceCurbAngle + regulatorAngle;
    const springStiffness = referenceSpringStiffness
      * referenceActiveLength / activeSpringLength;
    const naturalAngularFrequency = Math.sqrt(
      springStiffness / balanceInertia,
    );

    const unwrappedBalancePhase = referenceBalanceAngularFrequency * (
      time + frequencyExcursion * (
        1 - Math.cos(unwrappedAdjustmentAngle)
      ) / adjustmentAngularFrequency
    );
    const balancePhase = positiveModulo(unwrappedBalancePhase, FULL_TURN);
    const balancePhaseRate = referenceBalanceAngularFrequency
      * frequencyRatio;
    const balancePhaseAcceleration = referenceBalanceAngularFrequency
      * frequencyRatioVelocity;
    const balanceAngle = balanceAmplitude * Math.sin(balancePhase);
    const balanceAngularVelocity = balanceAmplitude
      * Math.cos(balancePhase) * balancePhaseRate;
    const balanceAngularAcceleration = balanceAmplitude * (
      -Math.sin(balancePhase) * balancePhaseRate ** 2
        + Math.cos(balancePhase) * balancePhaseAcceleration
    );

    const curbCenter = rotatingPoint({
      angle: curbAngle,
      angularAcceleration: regulatorAngularAcceleration,
      angularVelocity: regulatorAngularVelocity,
      radius: springOuterRadius,
      z: springPlaneZ,
    });
    const pointerTip = rotatingPoint({
      angle: -Math.PI / 2 + regulatorAngle,
      angularAcceleration: regulatorAngularAcceleration,
      angularVelocity: regulatorAngularVelocity,
      radius: pointerRadius,
      z: regulatorPlaneZ,
    });
    const balanceIndex = rotatingPoint({
      angle: Math.PI / 2 + balanceAngle,
      angularAcceleration: balanceAngularAcceleration,
      angularVelocity: balanceAngularVelocity,
      radius: balanceOuterRadius,
      z: 0.28,
    });
    const springInnerAttachment = rotatingPoint({
      angle: balanceAngle,
      angularAcceleration: balanceAngularAcceleration,
      angularVelocity: balanceAngularVelocity,
      radius: springInnerRadius,
      z: springPlaneZ,
    });
    const fixedOuterStud = rotatingPoint({
      angle: outerStudAngle,
      radius: springOuterRadius,
      z: springPlaneZ,
    });

    const springPointAtArcLength = (arcLength) => {
      const boundedArcLength = THREE.MathUtils.clamp(
        arcLength,
        0,
        totalSpringLength,
      );
      const baseline = baselinePolarAtArcLength(boundedArcLength);
      const active = boundedArcLength <= activeSpringLength;
      const elasticTwist = active
        ? balanceAngle * (1 - boundedArcLength / activeSpringLength)
        : 0;
      const angle = baseline.angle + elasticTwist;
      return {
        active,
        angle,
        arcLength: boundedArcLength,
        baselineAngle: baseline.angle,
        elasticTwist,
        position: new THREE.Vector3(
          baseline.radius * Math.cos(angle),
          baseline.radius * Math.sin(angle),
          springPlaneZ,
        ),
        radius: baseline.radius,
      };
    };

    return {
      activeSpringFraction: activeSpringLength / totalSpringLength,
      activeSpringLength,
      activeSpringLengthAcceleration,
      activeSpringLengthVelocity,
      adjustmentCycleAngle,
      balanceAngle,
      balanceAngularAcceleration,
      balanceAngularVelocity,
      balanceIndex,
      balancePhase,
      balancePhaseAcceleration,
      balancePhaseRate,
      curbAngle,
      curbCenter,
      cycleIndex: Math.floor(unwrappedAdjustmentAngle / FULL_TURN),
      cyclePhase: adjustmentCycleAngle / FULL_TURN,
      fixedOuterStud,
      frequencyRatio,
      frequencyRatioAcceleration,
      frequencyRatioVelocity,
      naturalAngularFrequency,
      pointerTip,
      rateCoordinate,
      rateCoordinateAcceleration,
      rateCoordinateVelocity,
      regulatorAngle,
      regulatorAngularAcceleration,
      regulatorAngularVelocity,
      regulatorSetting: rateCoordinate > 0.02
        ? 'toward-fast-shorter-active-spring'
        : rateCoordinate < -0.02
          ? 'toward-slow-longer-active-spring'
          : 'neutral',
      springInnerAttachment,
      springPointAtArcLength,
      springStiffness,
      unwrappedAdjustmentAngle,
      unwrappedBalancePhase,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.44,
  });
  const balanceMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.55,
  });
  const activeSpringMaterial = matte(PALETTE.driven, {
    metalness: 0.28,
    roughness: 0.42,
  });
  const inactiveSpringMaterial = matte(0x59676b, {
    metalness: 0.32,
    roughness: 0.48,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.30,
    roughness: 0.46,
  });
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-watch-regulator-frame';
  const backPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(3.88, 3.88, 0.16, 96),
    matte(PALETTE.paper, {
      metalness: 0.04,
      roughness: 0.82,
    }),
  );
  backPlate.rotation.x = Math.PI / 2;
  backPlate.position.z = -0.30;
  backPlate.userData.role = 'fixed-watch-movement-backplate';
  const fixedRing = new THREE.Mesh(
    new THREE.RingGeometry(
      fixedRingInnerRadius,
      fixedRingOuterRadius,
      72,
    ),
    frameMaterial,
  );
  fixedRing.position.z = regulatorPlaneZ - 0.16;
  fixedRing.userData.role = 'fixed-ring-concentric-with-balance-staff';
  const lowerBearing = cylinderAlongZ(
    balanceHubRadius * 0.72,
    0.52,
    darkMaterial,
    40,
  );
  lowerBearing.position.z = -0.12;
  lowerBearing.userData.role = 'fixed-balance-staff-bearing';
  fixedFrame.add(backPlate, fixedRing, lowerBearing);

  const balanceAssembly = new THREE.Group();
  balanceAssembly.userData.axis = Z_AXIS.clone();
  balanceAssembly.userData.role = 'oscillating-watch-balance';
  const balanceRim = torusAroundZ(
    balanceOuterRadius,
    balanceRimTubeRadius,
    balanceMaterial,
    96,
  );
  balanceRim.userData.role = 'balance-wheel-rim';
  const spokeAngles = [
    THREE.MathUtils.degToRad(130),
    THREE.MathUtils.degToRad(250),
    THREE.MathUtils.degToRad(10),
  ];
  const balanceSpokes = spokeAngles.map((angle) => {
    const spoke = makeBeam(
      new THREE.Vector3(
        balanceHubRadius * Math.cos(angle),
        balanceHubRadius * Math.sin(angle),
        0,
      ),
      new THREE.Vector3(
        (balanceOuterRadius - balanceRimTubeRadius)
          * Math.cos(angle),
        (balanceOuterRadius - balanceRimTubeRadius)
          * Math.sin(angle),
        0,
      ),
      {
        color: PALETTE.driver,
        depth: 0.28,
        thickness: 0.16,
      },
    );
    spoke.userData.role = 'balance-wheel-spoke';
    return spoke;
  });
  const balanceHub = cylinderAlongZ(
    balanceHubRadius,
    0.52,
    balanceMaterial,
    48,
  );
  balanceHub.position.z = 0.04;
  balanceHub.userData.role = 'balance-wheel-hub';
  const balanceStaff = cylinderAlongZ(0.15, 1.65, darkMaterial, 32);
  balanceStaff.position.z = 0.42;
  balanceStaff.userData.role = 'balance-wheel-staff';
  balanceAssembly.add(
    balanceRim,
    ...balanceSpokes,
    balanceHub,
    balanceStaff,
  );

  const regulatorCarrier = new THREE.Group();
  regulatorCarrier.position.z = regulatorPlaneZ;
  regulatorCarrier.userData.axis = Z_AXIS.clone();
  regulatorCarrier.userData.role = 'concentric-regulator-lever';
  const regulatorRing = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 1.13, 64),
    brassMaterial,
  );
  regulatorRing.userData.role = 'regulator-lever-ring-on-fixed-ring';
  const regulatorArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, pointerRadius - 0.91, 0.16),
    frameMaterial,
  );
  regulatorArm.position.y = -(pointerRadius + 0.91) / 2;
  regulatorArm.userData.role = 'regulator-lever-pointer-arm';
  const pointerShape = new THREE.Shape();
  pointerShape.moveTo(-0.20, 0.64);
  pointerShape.lineTo(0.20, 0.64);
  pointerShape.lineTo(0, 0);
  pointerShape.closePath();
  const pointerGeometry = new THREE.ExtrudeGeometry(pointerShape, {
    bevelEnabled: false,
    depth: 0.16,
  });
  pointerGeometry.translate(0, 0, -0.08);
  const pointer = new THREE.Mesh(pointerGeometry, balanceMaterial);
  pointer.position.y = -pointerRadius;
  pointer.userData.role = 'regulator-scale-pointer';
  const curbPinGap = 0.19;
  const curbPins = [-1, 1].map((radialSide) => {
    const pin = cylinderAlongZ(0.085, 0.58, brassMaterial, 24);
    pin.position.set(
      0,
      -(springOuterRadius + radialSide * curbPinGap / 2),
      springPlaneZ - regulatorPlaneZ,
    );
    pin.userData.radialSide = radialSide;
    pin.userData.role = 'curb-pin-forming-neutral-point-P';
    return pin;
  });
  const curbBridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, curbPinGap + 0.30, 0.12),
    balanceMaterial,
  );
  curbBridge.position.set(
    0,
    -springOuterRadius,
    springPlaneZ - regulatorPlaneZ - 0.24,
  );
  curbBridge.userData.role = 'curb-pin-carrier-on-regulator-lever';
  regulatorCarrier.add(
    regulatorRing,
    regulatorArm,
    pointer,
    curbBridge,
    ...curbPins,
  );

  const springSegmentCount = 180;
  const springSamples = [];
  const innerSampleCount = 154;
  for (let index = 0; index <= innerSampleCount; index += 1) {
    const parameter = index / innerSampleCount;
    springSamples.push({
      arcLength: spiralArcLengthAtParameter(parameter),
      ...baselinePolarAtArcLength(
        spiralArcLengthAtParameter(parameter),
      ),
    });
  }
  const outerSampleCount = springSegmentCount - innerSampleCount;
  for (let index = 1; index <= outerSampleCount; index += 1) {
    const parameter = index / outerSampleCount;
    const arcLength = innerSpiralLength + parameter * (
      totalSpringLength - innerSpiralLength
    );
    springSamples.push({
      arcLength,
      ...baselinePolarAtArcLength(arcLength),
    });
  }
  const springSegments = Array.from(
    { length: springSamples.length - 1 },
    (_, index) => {
      const segment = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 1, 10),
        activeSpringMaterial,
      );
      segment.userData.arcEnd = springSamples[index + 1].arcLength;
      segment.userData.arcStart = springSamples[index].arcLength;
      segment.userData.role = 'flat-spiral-balance-spring-segment';
      root.add(segment);
      return segment;
    },
  );

  // The spring is drawn as one continuous flat ribbon swept through every
  // sample, collet to stud R, so it reads as a single spiral rather than a
  // chain of separate straight pieces. The per-sample segments stay as
  // hidden interface proxies for the curb-pin checks.
  const springRibbonCount = springSamples.length;
  const springRibbonGeometry = new THREE.BufferGeometry();
  springRibbonGeometry.setAttribute('position', new THREE.BufferAttribute(
    new Float32Array(springRibbonCount * 4 * 3), 3));
  {
    const index = [];
    for (let i = 0; i < springRibbonCount - 1; i += 1) {
      for (let k = 0; k < 4; k += 1) {
        const a0 = i * 4 + k, a1 = i * 4 + (k + 1) % 4;
        const b0 = a0 + 4, b1 = a1 + 4;
        index.push(a0, b0, a1, a1, b0, b1);
      }
    }
    const last = (springRibbonCount - 1) * 4;
    index.push(0, 1, 2, 0, 2, 3, last, last + 2, last + 1, last, last + 3, last + 2);
    springRibbonGeometry.setIndex(index);
  }
  const springRibbon = new THREE.Mesh(springRibbonGeometry, activeSpringMaterial);
  springRibbon.userData.role = 'continuous-flat-spiral-balance-spring';
  springRibbon.frustumCulled = false;
  root.add(springRibbon);
  // The inner coils carry a heavier section (Brown's bold spiral), easing to
  // the 0.014 strip on the terminal coil that must pass between the curb pins.
  const ribbonHalfWidths = springSamples.map((sample) => {
    const toJoin = (innerSpiralLength - sample.arcLength) / (0.12 * innerSpiralLength);
    // It also eases back to the plain strip where it is pinned in the collet.
    const fromCollet = sample.arcLength / 0.6;
    return 0.007 + 0.009 * THREE.MathUtils.clamp(Math.min(toJoin, fromCollet), 0, 1);
  });
  const setSpringRibbon = (points, halfHeight = 0.06) => {
    const array = springRibbonGeometry.attributes.position.array;
    for (let i = 0; i < points.length; i += 1) {
      const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
      const tx = after.x - before.x, ty = after.y - before.y;
      const length = Math.hypot(tx, ty) || 1;
      const nx = -ty / length, ny = tx / length;
      const p = points[i];
      const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
      for (let k = 0; k < 4; k += 1) {
        const o = (i * 4 + k) * 3;
        array[o] = p.x + corners[k][0] * ribbonHalfWidths[i] * nx;
        array[o + 1] = p.y + corners[k][0] * ribbonHalfWidths[i] * ny;
        array[o + 2] = p.z + corners[k][1] * halfHeight;
      }
    }
    springRibbonGeometry.attributes.position.needsUpdate = true;
    springRibbonGeometry.computeVertexNormals();
    springRibbonGeometry.computeBoundingBox();
    springRibbonGeometry.computeBoundingSphere();
  };

  const outerStudPosition = new THREE.Vector3(
    springOuterRadius * Math.cos(outerStudAngle),
    springOuterRadius * Math.sin(outerStudAngle),
    springPlaneZ,
  );
  const fixedStudR = cylinderAlongZ(0.13, 0.72, brassMaterial, 28);
  fixedStudR.position.copy(outerStudPosition);
  fixedStudR.userData.role = 'fixed-outer-balance-spring-stud-R';
  const studBracket = makeBeam(
    outerStudPosition.clone().setZ(springPlaneZ - 0.25),
    new THREE.Vector3(
      -(springOuterRadius + 0.48),
      0,
      springPlaneZ - 0.25,
    ),
    {
      color: PALETTE.frame,
      depth: 0.22,
      thickness: 0.16,
    },
  );
  studBracket.userData.role = 'fixed-stud-R-support';

  // Brown draws the rate scale as a graduated band: three concentric arcs
  // from SLOW to FAST crossed by radial divisions, the pointer tip T reaching
  // the outer arc.  It is a solid graduated plate standing on the movement
  // plate behind the balance (the rim passes in front of its upper arc, as
  // Brown draws); the arcs and divisions are shallow dark engraved lines on
  // its face.  No end balls or separate tick heads are drawn.
  const dialStartAngle = -Math.PI / 2 - 0.79;
  const dialEndAngle = -Math.PI / 2 + 0.79;
  const dialInnerRadius = pointerRadius - 0.98;
  const dialRadius = pointerRadius + 0.10;
  const dialPlateBack = backPlate.position.z;
  const dialPlateFront = -balanceRimTubeRadius - 0.025;
  const dialLineHeight = 0.012;
  const sectorGeometry = (inner, outer, start, end, low, high) => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, start, end, false);
    shape.absarc(0, 0, inner, end, start, true);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: false,
      curveSegments: 64,
      depth: high - low,
    });
    geometry.translate(0, 0, low);
    return geometry;
  };
  const scaleLineMaterial = matte(PALETTE.ink, {
    metalness: 0.2,
    roughness: 0.6,
  });
  const dialPlate = new THREE.Mesh(
    sectorGeometry(dialInnerRadius - 0.06, dialRadius + 0.06,
      dialStartAngle - 0.03, dialEndAngle + 0.03,
      dialPlateBack, dialPlateFront),
    // A silvered scale plate so the engraved lines read.
    matte(0xc8c4ba, { metalness: 0.25, roughness: 0.55 }),
  );
  dialPlate.userData.role = 'fixed-slow-fast-regulator-scale-plate';
  const dialArcRadii = [dialInnerRadius, pointerRadius - 0.48, dialRadius];
  const dialArcs = dialArcRadii.map((radius) => {
    const arc = new THREE.Mesh(
      sectorGeometry(radius - 0.02, radius + 0.02, dialStartAngle,
        dialEndAngle, dialPlateFront - 0.004,
        dialPlateFront + dialLineHeight),
      scaleLineMaterial,
    );
    arc.userData.role = 'fixed-slow-fast-regulator-scale-arc';
    return arc;
  });
  const dialArc = dialArcs.at(-1);
  const dialTicks = Array.from({ length: 13 }, (_, index) => {
    const angle = THREE.MathUtils.lerp(
      dialStartAngle,
      dialEndAngle,
      index / 12,
    );
    const tickRadius = (dialInnerRadius + dialRadius) / 2;
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, dialRadius - dialInnerRadius,
        dialLineHeight + 0.004),
      scaleLineMaterial,
    );
    tick.position.set(
      tickRadius * Math.cos(angle),
      tickRadius * Math.sin(angle),
      dialPlateFront + (dialLineHeight - 0.004) / 2,
    );
    tick.rotation.z = angle - Math.PI / 2;
    tick.userData.setting = index === 0
      ? 'SLOW'
      : index === 12
        ? 'FAST'
        : 'graduation';
    tick.userData.role = 'fixed-regulator-rate-scale-tick';
    return tick;
  });

  root.add(
    fixedFrame,
    balanceAssembly,
    regulatorCarrier,
    fixedStudR,
    studBracket,
    dialPlate,
    ...dialArcs,
    ...dialTicks,
  );

  const setSpringSegment = (segment, start, end) => {
    const delta = end.clone().sub(start);
    const length = delta.length();
    segment.position.copy(start).add(end).multiplyScalar(0.5);
    segment.quaternion.setFromUnitVectors(
      Y_AXIS,
      delta.clone().normalize(),
    );
    segment.scale.y = length;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    balanceAssembly.rotation.z = state.balanceAngle;
    regulatorCarrier.rotation.z = state.regulatorAngle;
    const renderedSpringPoint = (sample) => {
      const elasticTwist = sample.arcLength <= state.activeSpringLength
        ? state.balanceAngle * (
          1 - sample.arcLength / state.activeSpringLength
        )
        : 0;
      const angle = sample.angle + elasticTwist;
      return new THREE.Vector3(
        sample.radius * Math.cos(angle),
        sample.radius * Math.sin(angle),
        springPlaneZ,
      );
    };
    for (let index = 0; index < springSegments.length; index += 1) {
      const segment = springSegments[index];
      const sampleStart = springSamples[index];
      const sampleEnd = springSamples[index + 1];
      const start = renderedSpringPoint(sampleStart);
      const end = renderedSpringPoint(sampleEnd);
      setSpringSegment(segment, start, end);
      const midpointArcLength = (
        sampleStart.arcLength + sampleEnd.arcLength
      ) / 2;
      const isActive = midpointArcLength <= state.activeSpringLength;
      // One spring, one material: the active length is not colour-coded.
      segment.material = activeSpringMaterial;
      segment.userData.active = isActive;
      segment.visible = false;
    }
    setSpringRibbon(springSamples.map(renderedSpringPoint));
    root.userData.regulatorState = {
      activeSpringLength: state.activeSpringLength,
      balanceAngularFrequency: state.naturalAngularFrequency,
      curbAngle: state.curbAngle,
      frequencyRatio: state.frequencyRatio,
      regulatorAngle: state.regulatorAngle,
      setting: state.regulatorSetting,
    };
    root.userData.renderState = state;
  };

  const sourcePointToNeutralFront = (point) => new THREE.Vector3(
    (point.x - sourceRasterCenter.x) * sourceScale,
    -(point.y - sourceRasterCenter.y) * sourceScale,
    0,
  );

  root.userData.archetype =
    'adjustable-curb-pin-watch-balance-spring-regulator';
  root.userData.blocks = {
    backPlate,
    balanceAssembly,
    balanceHub,
    balanceRim,
    balanceSpokes,
    balanceStaff,
    curbBridge,
    curbPins,
    dialArc,
    dialPlate,
    dialArcs,
    dialTicks,
    fixedFrame,
    fixedRing,
    fixedStudR,
    lowerBearing,
    pointer,
    regulatorArm,
    regulatorCarrier,
    regulatorRing,
    springSamples,
    springRibbon,
    springSegments,
    studBracket,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.45, -5.65, -1.45),
    new THREE.Vector3(5.45, 4.15, 1.80),
  );
  root.userData.canonicalTimes = {
    cycleClosure: adjustmentCyclePeriod,
    fast: adjustmentCyclePeriod * 0.25,
    neutralFalling: adjustmentCyclePeriod * 0.50,
    neutralRising: 0,
    slow: adjustmentCyclePeriod * 0.75,
  };
  root.userData.geometry = {
    adjustmentAngularFrequency,
    adjustmentCyclePeriod,
    balanceAmplitude,
    balanceCyclesPerAdjustmentCycle,
    balanceHubRadius,
    balanceOuterRadius,
    balanceRimTubeRadius,
    curbPinGap,
    dialEndAngle,
    dialRadius,
    dialStartAngle,
    fixedRingInnerRadius,
    fixedRingOuterRadius,
    frequencyExcursion,
    innerSpiralAngleSpan,
    innerSpiralJoinAngle,
    innerSpiralLength,
    innerSpiralTurns,
    outerStudAngle,
    pointerRadius,
    radialGrowthPerRadian,
    referenceActiveLength,
    referenceBalanceAngularFrequency,
    referenceCurbAngle,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    springInnerRadius,
    springOuterRadius,
    springPlaneZ,
    totalSpringLength,
  };
  root.userData.groundFloorY = -5.65;
  root.userData.massModel = {
    balance: {
      hubMass: balanceHubMass,
      inertia: balanceInertia,
      rimMass: balanceRimMass,
      spokeCount: 3,
      spokeMass: balanceSpokeMass,
    },
    spring: {
      referenceActiveLength,
      referenceStiffness: referenceSpringStiffness,
      stiffnessLaw: 'kappa = kappa_reference * L_reference / L_active',
      uniformStrip: true,
    },
  };
  root.userData.mechanism =
    'the regulator lever turns concentrically with the balance staff and carries two curb pins along the circular outer coil; toward FAST they create neutral point P closer to the staff, shortening the vibrating spring, increasing torsional stiffness in inverse proportion to active length, and raising balance frequency by the square-root stiffness law';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'Brown supplies the three-spoke balance, concentric fixed ring and regulator lever, paired curb pins at P, fixed outer stud R, flat spiral spring, pointer, and SLOW–FAST scale. Dimensions, masses, spring section, rate range, depth, and cadence are not dimensioned.',
    sourceUrl: 'https://507movements.com/mm_318.html',
  };
  root.userData.sourcePointToNeutralFront = sourcePointToNeutralFront;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    brownPlate318: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one three-spoke balance and staff, one inner-attached flat spiral spring, one fixed outer stud R, one concentric regulator lever, two curb pins defining P, and one graduated SLOW–FAST scale',
      measurementUncertaintyPixels: 11,
      rasterBalanceBottom: sourceRasterBalanceBottom.clone(),
      rasterBalanceLeft: sourceRasterBalanceLeft.clone(),
      rasterBalanceRight: sourceRasterBalanceRight.clone(),
      rasterBalanceTop: sourceRasterBalanceTop.clone(),
      rasterCenter: sourceRasterCenter.clone(),
      rasterCurbP: sourceRasterCurbP.clone(),
      rasterFastEnd: sourceRasterFastEnd.clone(),
      rasterPointerTip: sourceRasterPointerTip.clone(),
      rasterSlowEnd: sourceRasterSlowEnd.clone(),
      rasterStudR: sourceRasterStudR.clone(),
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
  };
  root.userData.spiralArcLengthAtParameter =
    spiralArcLengthAtParameter;
  root.userData.baselinePolarAtArcLength = baselinePolarAtArcLength;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: adjustmentCyclePeriod,
    schedule: [
      'neutral-source-setting-with-inner-spring-flexing',
      'lever-and-curb-pins-move-right-toward-FAST',
      'shorter-active-spring-increases-balance-frequency',
      'lever-crosses-neutral-and-moves-left-toward-SLOW',
      'longer-active-spring-decreases-balance-frequency',
      'ten-balance-vibrations-and-one-regulator-cycle-close-exactly',
    ],
  };
  root.userData.transmission = {
    activeLengthLaw: 'L_active = L_reference / frequencyRatio^2',
    curbPinCount: 2,
    fastDirection: 'right on Brown’s scale',
    frequencyLaw: 'omega = sqrt(kappa / I)',
    neutralPoint: 'P between the two regulator-lever curb pins',
    output: 'adjustable balance-wheel vibration frequency',
    slowDirection: 'left on Brown’s scale',
    springStiffnessLaw: 'kappa is inversely proportional to active length',
  };

  correctWatchRegulator(root);
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
  for (const object of [...springSegments, springRibbon]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';

  return {
    cameraDirection: new THREE.Vector3(.6, .7, 14),
    root,
    update,
  };
}

export function createAuthoredWatchRegulatorMovement(movement) {
  if (movement.id !== 318) return null;
  return watchRegulator(movement);
}
