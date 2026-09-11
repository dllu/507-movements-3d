import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function horizontalRadial(angle) {
  return new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
}

function horizontalTangent(angle) {
  return new THREE.Vector3(-Math.sin(angle), 0, -Math.cos(angle));
}

function polarPoint(radius, angle, height) {
  return horizontalRadial(angle).multiplyScalar(radius)
    .add(new THREE.Vector3(0, height, 0));
}

function makeTube(curve, radius, material, role) {
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 72, radius, 9, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function fourneyronTurbine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 5.6;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const fixedGuideCount = 6;
  const runnerBucketCount = 16;
  const runnerBucketPitch = FULL_TURN / runnerBucketCount;
  const guideInnerRadius = 0.56;
  const guideOuterRadius = 1.72;
  const runnerInnerRadius = 1.84;
  const runnerOuterRadius = 3.05;
  const runnerBucketCenterRadius =
    (runnerInnerRadius + runnerOuterRadius) / 2;
  const sourcePoseBucketOffset = 0;
  const shaftRadius = 0.22;
  const massFlowNormalized = 1;
  const guideExitRadialSpeed = 2.55;
  const guideExitWhirlSpeed = 3.35;
  const dischargeRadialSpeed = 4.40;
  const dischargeWhirlSpeed = 0.32;

  const guideExitPoint = horizontalRadial(0)
    .multiplyScalar(runnerInnerRadius);
  const guideExitVelocity = horizontalRadial(0)
    .multiplyScalar(guideExitRadialSpeed)
    .addScaledVector(horizontalTangent(0), -guideExitWhirlSpeed);
  const dischargePoint = horizontalRadial(0)
    .multiplyScalar(runnerOuterRadius);
  const dischargeVelocity = horizontalRadial(0)
    .multiplyScalar(dischargeRadialSpeed)
    .addScaledVector(horizontalTangent(0), -dischargeWhirlSpeed);
  const inletSpecificAngularMomentumY = new THREE.Vector3()
    .crossVectors(guideExitPoint, guideExitVelocity).y;
  const outletSpecificAngularMomentumY = new THREE.Vector3()
    .crossVectors(dischargePoint, dischargeVelocity).y;
  const runnerTorqueNormalized = massFlowNormalized
    * (inletSpecificAngularMomentumY - outletSpecificAngularMomentumY);

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const runnerAngle = -inputAngle;
    const runnerAngularSpeed = -inputSpeed;
    const runnerAngularAcceleration = -inputAcceleration;
    const runnerBuckets = [];
    for (let bucketIndex = 0; bucketIndex < runnerBucketCount;
      bucketIndex += 1) {
      const localAngle = sourcePoseBucketOffset
        + bucketIndex * runnerBucketPitch;
      const worldAngle = localAngle + runnerAngle;
      const radial = horizontalRadial(worldAngle);
      const tangent = horizontalTangent(worldAngle);
      const center = radial.clone()
        .multiplyScalar(runnerBucketCenterRadius);
      const centerVelocity = tangent.clone().multiplyScalar(
        runnerBucketCenterRadius * runnerAngularSpeed,
      );
      const centerAcceleration = tangent.clone().multiplyScalar(
        runnerBucketCenterRadius * runnerAngularAcceleration,
      ).addScaledVector(
        radial,
        -runnerBucketCenterRadius * runnerAngularSpeed ** 2,
      );
      runnerBuckets.push({
        center,
        centerAcceleration,
        centerVelocity,
        index: bucketIndex,
        localAngle,
        radial,
        tangent,
        worldAngle,
      });
    }
    const rimReferenceRadial = horizontalRadial(runnerAngle);
    const rimReferenceTangent = horizontalTangent(runnerAngle);
    const rimReferencePoint = rimReferenceRadial.clone()
      .multiplyScalar(runnerOuterRadius);
    const rimReferenceVelocity = rimReferenceTangent.clone()
      .multiplyScalar(runnerOuterRadius * runnerAngularSpeed);
    const rimReferenceAcceleration = rimReferenceTangent.clone()
      .multiplyScalar(runnerOuterRadius * runnerAngularAcceleration)
      .addScaledVector(
        rimReferenceRadial,
        -runnerOuterRadius * runnerAngularSpeed ** 2,
      );
    return {
      dischargePoint: dischargePoint.clone(),
      dischargeVelocity: dischargeVelocity.clone(),
      guideExitPoint: guideExitPoint.clone(),
      guideExitVelocity: guideExitVelocity.clone(),
      inletSpecificAngularMomentumY,
      inputAcceleration,
      inputAngle,
      inputSpeed,
      outletSpecificAngularMomentumY,
      rimReferenceAcceleration,
      rimReferencePoint,
      rimReferenceVelocity,
      runnerAngle,
      runnerAngularAcceleration,
      runnerAngularSpeed,
      runnerBuckets,
      runnerTorqueNormalized,
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

  const geometry = {
    cycleDuration,
    dischargeRadialSpeed,
    dischargeVelocity: dischargeVelocity.clone(),
    dischargeWhirlSpeed,
    fixedGuideCount,
    guideExitRadialSpeed,
    guideExitVelocity: guideExitVelocity.clone(),
    guideExitWhirlSpeed,
    guideInnerRadius,
    guideOuterRadius,
    inputAngularSpeed,
    massFlowNormalized,
    runnerBucketCenterRadius,
    runnerBucketCount,
    runnerBucketPitch,
    runnerInnerRadius,
    runnerOuterRadius,
    shaftRadius,
    sourcePoseBucketOffset,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.59,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.31,
    roughness: 0.46,
  });
  const guideMaterial = matte(PALETTE.driver, {
    metalness: 0.15,
    roughness: 0.52,
  });
  const runnerMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.49,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.65,
    roughness: 0.32,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const paleWaterMaterial = matte(0x75c7d7, {
    opacity: 0.50,
    roughness: 0.30,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const fixedGuideAssembly = new THREE.Group();
  fixedGuideAssembly.userData.role =
    'fixed-inner-fourneyron-guide-assembly-A';
  root.add(fixedGuideAssembly);
  const guideFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(guideOuterRadius, guideOuterRadius, 0.14, 72),
    frameMaterial,
  );
  guideFloor.position.y = -0.17;
  guideFloor.userData.role = 'fixed-floor-beneath-inner-guide-passages';
  fixedGuideAssembly.add(guideFloor);
  const centralInlet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 0.68, 40),
    waterMaterial,
  );
  centralInlet.position.y = 0.22;
  centralInlet.userData.role = 'central-water-inlet-to-fixed-guides';
  fixedGuideAssembly.add(centralInlet);
  const fixedGuideVanes = [];
  for (let guideIndex = 0; guideIndex < fixedGuideCount; guideIndex += 1) {
    const baseAngle = guideIndex * FULL_TURN / fixedGuideCount;
    const points = Array.from({ length: 25 }, (_, pointIndex) => {
      const progress = pointIndex / 24;
      const radius = THREE.MathUtils.lerp(
        guideInnerRadius,
        guideOuterRadius,
        progress,
      );
      const angle = baseAngle + 0.58 * (1 - progress) ** 1.25;
      return polarPoint(radius, angle, 0.18);
    });
    const curve = new THREE.CatmullRomCurve3(
      points,
      false,
      'centripetal',
    );
    const vane = makeTube(
      curve,
      0.075,
      guideMaterial,
      `fixed-curved-guide-shute-${guideIndex + 1}-of-six`,
    );
    fixedGuideAssembly.add(vane);
    fixedGuideVanes.push(vane);
  }
  const guideBoundary = new THREE.Mesh(
    new THREE.TorusGeometry(guideOuterRadius, 0.09, 10, 96),
    darkMaterial,
  );
  guideBoundary.rotation.x = Math.PI / 2;
  guideBoundary.position.y = 0.18;
  guideBoundary.userData.role = 'fixed-outer-boundary-of-guide-ring-A';
  fixedGuideAssembly.add(guideBoundary);

  const runner = new THREE.Group();
  runner.userData.role =
    'clockwise-outer-fourneyron-runner-B';
  root.add(runner);
  for (const height of [-0.05, 0.45]) {
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(runnerInnerRadius, 0.08, 9, 96),
      runnerMaterial,
    );
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = height;
    innerRing.userData.role =
      `runner-inner-ring-at-y-${height.toFixed(2)}`;
    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(runnerOuterRadius, 0.09, 9, 112),
      runnerMaterial,
    );
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = height;
    outerRing.userData.role =
      `runner-outer-ring-at-y-${height.toFixed(2)}`;
    runner.add(innerRing, outerRing);
  }
  const runnerBuckets = [];
  for (let bucketIndex = 0; bucketIndex < runnerBucketCount;
    bucketIndex += 1) {
    const localAngle = sourcePoseBucketOffset
      + bucketIndex * runnerBucketPitch;
    const points = Array.from({ length: 21 }, (_, pointIndex) => {
      const progress = pointIndex / 20;
      const radius = THREE.MathUtils.lerp(
        runnerInnerRadius,
        runnerOuterRadius,
        progress,
      );
      const angle = localAngle + 0.24 * (1 - progress) ** 1.2
        - 0.07 * progress;
      return polarPoint(radius, angle, 0.21);
    });
    const curve = new THREE.CatmullRomCurve3(
      points,
      false,
      'centripetal',
    );
    const bucket = makeTube(
      curve,
      0.070,
      runnerMaterial,
      `curved-outer-runner-bucket-${bucketIndex + 1}-of-sixteen`,
    );
    runner.add(bucket);
    runnerBuckets.push(bucket);
  }
  const runnerHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.36, 36),
    runnerMaterial,
  );
  runnerHub.position.y = -0.38;
  runnerHub.userData.role = 'rotating-runner-output-hub-below-fixed-guides';
  runner.add(runnerHub);
  const runnerShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(shaftRadius, shaftRadius, 1.86, 32),
    runnerMaterial,
  );
  runnerShaft.position.y = -1.12;
  runnerShaft.userData.role = 'vertical-output-shaft-of-outer-runner';
  runner.add(runnerShaft);
  const runnerSupportArms = [];
  for (let armIndex = 0; armIndex < 4; armIndex += 1) {
    const angle = armIndex * Math.PI / 2;
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(3.98, 0.12, 0.12),
      runnerMaterial,
    );
    arm.position.copy(horizontalRadial(angle).multiplyScalar(1.04));
    arm.position.y = -0.36;
    arm.rotation.y = angle;
    arm.userData.role =
      `concealed-lower-runner-support-arm-${armIndex + 1}-of-four`;
    runner.add(arm);
    runnerSupportArms.push(arm);
  }
  const rotationMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.10, 0.12),
    whiteMaterial,
  );
  rotationMarker.position.set(2.58, 0.59, 0);
  rotationMarker.userData.role =
    'visible-clockwise-marker-on-outer-runner-B';
  runner.add(rotationMarker);

  const flowCurves = [];
  const flowPathTubes = [];
  for (let pathIndex = 0; pathIndex < fixedGuideCount; pathIndex += 1) {
    const baseAngle = pathIndex * FULL_TURN / fixedGuideCount;
    const points = [
      polarPoint(0.34, baseAngle + 0.70, 0.58),
      polarPoint(0.78, baseAngle + 0.53, 0.38),
      polarPoint(1.35, baseAngle + 0.24, 0.27),
      polarPoint(1.79, baseAngle, 0.22),
      polarPoint(2.36, baseAngle - 0.12, 0.20),
      polarPoint(3.10, baseAngle - 0.16, 0.18),
      polarPoint(3.48, baseAngle - 0.14, 0.08),
    ];
    const curve = new THREE.CatmullRomCurve3(
      points,
      false,
      'centripetal',
    );
    flowCurves.push(curve);
    const tube = makeTube(
      curve,
      0.065,
      waterMaterial,
      `continuous-center-to-circumference-water-path-${pathIndex + 1}`,
    );
    root.add(tube);
    flowPathTubes.push(tube);
  }
  const flowMarkers = [];
  const markersPerPath = 4;
  for (let pathIndex = 0; pathIndex < fixedGuideCount; pathIndex += 1) {
    for (let markerIndex = 0; markerIndex < markersPerPath;
      markerIndex += 1) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 16, 11),
        paleWaterMaterial,
      );
      marker.userData.role =
        `outward-flow-marker-path-${pathIndex + 1}-particle-${markerIndex + 1}`;
      root.add(marker);
      flowMarkers.push({ marker, markerIndex, pathIndex });
    }
  }

  const casingFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(3.62, 3.62, 0.18, 84),
    frameMaterial,
  );
  casingFloor.position.y = -0.54;
  casingFloor.userData.role =
    'fixed-foundation-below-plan-view-turbine';
  root.add(casingFloor);
  const dischargeRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.43, 0.13, 10, 112),
    waterMaterial,
  );
  dischargeRing.rotation.x = Math.PI / 2;
  dischargeRing.position.y = 0.07;
  dischargeRing.userData.role =
    'circumferential-outward-water-discharge';
  root.add(dischargeRing);

  const update = (time) => {
    const state = stateAtTime(time);
    runner.rotation.y = state.runnerAngle;
    const flowPhase = THREE.MathUtils.euclideanModulo(time / 1.24, 1);
    for (const entry of flowMarkers) {
      const progress = THREE.MathUtils.euclideanModulo(
        flowPhase + entry.markerIndex / markersPerPath,
        1,
      );
      entry.marker.position.copy(
        flowCurves[entry.pathIndex].getPoint(progress),
      );
      const endpointFade = Math.sin(Math.PI * progress);
      entry.marker.scale.setScalar(Math.sqrt(Math.max(0, endpointFade)));
    }
  };

  const sourceState = stateAtInputAngle(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'fourneyron-outward-flow-turbine-with-fixed-inner-curved-guides-and-clockwise-outer-runner',
    blocks: {
      casingFloor,
      centralInlet,
      dischargeRing,
      fixedGuideAssembly,
      fixedGuideVanes,
      flowMarkers: flowMarkers.map(({ marker }) => marker),
      flowPathTubes,
      guideBoundary,
      guideFloor,
      rotationMarker,
      runner,
      runnerBuckets,
      runnerHub,
      runnerShaft,
      runnerSupportArms,
    },
    degreesOfFreedom: {
      fixedGuideVanesRotate: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      runnerAndOutputShaftIndependent: false,
    },
    dynamics: {
      angularMomentumDiagnostic:
        'Normalized runner torque equals mass flow times inlet-minus-outlet specific angular momentum about y. Fixed guides impart clockwise whirl; the runner reduces that whirl before radial discharge, so the exact diagnostic torque is negative (clockwise).',
      fluidPressureViscosityTurbulenceLeakageCavitationBladeLoadingBearingFrictionRunnerInertiaGeneratorLoadAndSpeedResponseModeled:
        false,
      markerContinuity:
        'Each visible water marker follows one centripetal Catmull-Rom curve continuously from central inlet through the fixed guide and outer runner to the circumference; it fades to zero at recycling endpoints.',
    },
    fidelity: 'authored',
    flowCurves,
    geometry,
    mechanism:
      'Water enters centrally and passes outward through six stationary curved shutes in guide assembly A. The guides give the water clockwise whirl before it meets sixteen curved buckets in the separate outer runner B. The runner turns clockwise as it removes most of that whirl, and the water then discharges radially around the circumference. The inner guide disk, guide vanes, inlet, floor, and flow field remain fixed; only the outer bucket ring, its concealed support arms, output hub, shaft, and marker rotate together.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      runnerBucketPitch,
      runnerDirectionViewedInBrownPlan: 'clockwise',
      runnerRevolutionsPerCycle: 1,
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 434 page provides Brown’s static plan-view engraving and caption but contains no Canvas construction or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      fixedGuideAngle: 0,
      guideExitPoint: guideExitPoint.clone(),
      runnerAngle: sourceState.runnerAngle,
      runnerBuckets: sourceState.runnerBuckets.map((bucket) => ({
        center: bucket.center.clone(),
        worldAngle: bucket.worldAngle,
      })),
    },
    sourceReference: {
      brownPlate434: {
        approximateFixedGuideCount: 6,
        approximateGuideOuterRadiusPixels: 143,
        approximateOuterRunnerBucketCount: 16,
        approximateRunnerOuterRadiusPixels: 207,
        centerApproximatePixels: [252, 255],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 16,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the drawing is a plan view of the Fourneyron turbine water-wheel',
          'curved central shutes or guides A are fixed',
          'the guides direct water against the outer wheel B, which revolves',
          'water discharges at the circumference',
        ],
        engravingEvidence:
          'Brown’s plan shows about six broad curved guide passages inside a heavy fixed boundary, a distinct annular outer runner with about sixteen oppositely curved bucket passages, outward flow arrows, and clockwise arrows at the right-hand circumference.',
        reconstructionDisclosure:
          'Brown gives no dimensions, exact guide or bucket counts, vane profiles, height, flow rate, head, velocity triangles, shaft arrangement, rotational speed, materials, losses, leakage, efficiency, inertia, or load. Six fixed guides, sixteen runner buckets, blade curves, velocity values, lower support arms, dimensions, colors, and a 5.6-second cycle are independently engineered; the fixed inner guides A, separate revolving outer runner B, central-to-circumferential flow, and clockwise direction are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 434',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      angularMomentum:
        'tau_y=massFlow*(cross(r_in,v_in).y-cross(r_out,v_out).y)<0',
      fixedGuideAction:
        'stationary curved shutes impart clockwise tangential velocity to outward flow',
      runnerAttachment:
        'bucketWorldAngle=bucketLocalAngle+runnerAngle; output shaft shares runnerAngle',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.84, -2.15, -3.84),
    new THREE.Vector3(3.84, 1.06, 3.84),
  );
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraDirection = new THREE.Vector3(4.9, 8.6, 6.4);
  root.userData.groundFloorY = -2.15;
  markShadows(root);
  casingFloor.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredFourneyronTurbineMovement(movement) {
  if (movement.id !== 434) return null;
  return fourneyronTurbine(movement);
}
