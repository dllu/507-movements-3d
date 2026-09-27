import * as THREE from 'three';
import {horizontalVane,horizontalRing,horizontalPlate,horizontalTurned} from './horizontal-turbine-solids.js';
import {poly,circle,polygonClipping} from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';
import {WaterStream,ballisticPath,collectWaterStreams,guidedPath,joinPaths} from './water-stream.js';

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
  // Brown's plan: eight curved guides A inside the heavy ring and eighteen
  // buckets on the outer wheel B, the guides to about seven-tenths of the
  // wheel's radius (plate radii 72-142 px and 142-205 px).
  const fixedGuideCount = 8;
  const runnerBucketCount = 18;
  const runnerBucketPitch = FULL_TURN / runnerBucketCount;
  const guideInnerRadius = 1.07;
  const guideOuterRadius = 2.02;
  const guideBoundaryRadius = 2.10;
  const runnerInnerRadius = 2.19;
  const runnerOuterRadius = 3.05;
  // Plate-measured vane turn (radians) from root to tip: the guides sweep
  // clockwise outward (about 40 degrees), the buckets the opposite way
  // (about 17 degrees, mostly near the rim).
  const guideSweep = 0.70;
  const bucketSweep = 0.30;
  const guideAngleAt = (base, progress) => base + guideSweep * (1 - (0.92 * progress + 0.08 * progress ** 2));
  const bucketAngleAt = (base, progress) => base + bucketSweep * (0.3 * progress + 0.7 * progress ** 2);
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
  guideFloor.geometry.dispose();guideFloor.geometry=horizontalRing(.40,guideBoundaryRadius+.045,-.24,-.10);guideFloor.position.y=0;
  guideFloor.userData.role = 'fixed-floor-beneath-inner-guide-passages';
  fixedGuideAssembly.add(guideFloor);
  const centralInlet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 0.68, 40),
    waterMaterial,
  );
  centralInlet.position.y = 0.22;
  centralInlet.userData.role = 'central-water-inlet-to-fixed-guides';
  fixedGuideAssembly.add(centralInlet);
  // The water enters as the continuous sheets below; the shaft fills the centre.
  centralInlet.visible = false;
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
      return polarPoint(radius, guideAngleAt(baseAngle, progress), 0.18);
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
      `fixed-curved-guide-shute-${guideIndex + 1}-of-eight`,
    );
    vane.geometry.dispose();vane.geometry=horizontalVane(points,.038,-.10,.45);
    fixedGuideAssembly.add(vane);
    fixedGuideVanes.push(vane);
  }
  // The boundary ring belongs to guide assembly A: its colour, not ink.
  const guideBoundary = new THREE.Mesh(
    new THREE.TorusGeometry(guideOuterRadius, 0.09, 10, 96),
    guideMaterial,
  );
  guideBoundary.geometry.dispose();guideBoundary.geometry=horizontalRing(guideBoundaryRadius-.045,guideBoundaryRadius+.045,-.10,-.04);guideBoundary.rotation.set(0,0,0);guideBoundary.position.y=0;
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
    innerRing.geometry.dispose();innerRing.geometry=horizontalRing(runnerInnerRadius-.035,runnerInnerRadius+.035,height-.04,height+.04);innerRing.rotation.set(0,0,0);innerRing.position.y=0;
    innerRing.userData.role =
      `runner-inner-ring-at-y-${height.toFixed(2)}`;
    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(runnerOuterRadius, 0.09, 9, 112),
      runnerMaterial,
    );
    outerRing.geometry.dispose();outerRing.geometry=horizontalRing(runnerOuterRadius-.035,runnerOuterRadius+.035,height-.04,height+.04);outerRing.rotation.set(0,0,0);outerRing.position.y=0;
    outerRing.userData.role =
      `runner-outer-ring-at-y-${height.toFixed(2)}`;
    runner.add(innerRing, outerRing);
  }
  const runnerBackplate=new THREE.Mesh(horizontalRing(runnerInnerRadius-.04,runnerOuterRadius+.045,-.14,-.05),runnerMaterial);runnerBackplate.userData.role='annular-runner-backplate-joining-working-vanes';runner.add(runnerBackplate);
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
      return polarPoint(radius, bucketAngleAt(localAngle, progress), 0.21);
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
      `curved-outer-runner-bucket-${bucketIndex + 1}-of-eighteen`,
    );
    bucket.geometry.dispose();bucket.geometry=horizontalVane(points,.032,-.05,.45);
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
    new THREE.CylinderGeometry(shaftRadius, shaftRadius, 1.18, 32),
    runnerMaterial,
  );
  // The shaft rises through the guides' open centre: Brown's small circle.
  runnerShaft.position.y = -0.29;
  runnerShaft.userData.role = 'vertical-output-shaft-of-outer-runner';
  runner.add(runnerShaft);
  const runnerSupportArms = [];
  for (let armIndex = 0; armIndex < 4; armIndex += 1) {
    const angle = armIndex * Math.PI / 2;
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(3.05, 0.12, 0.14),
      runnerMaterial,
    );
    arm.position.copy(horizontalRadial(angle).multiplyScalar(1.525));
    arm.position.y = -0.36;
    arm.rotation.y = angle;
    arm.userData.role =
      `concealed-lower-runner-support-arm-${armIndex + 1}-of-four`;
    runner.add(arm);
    runnerSupportArms.push(arm);
  }
  const runnerRisers=[];for(let i=0;i<4;i++){const angle=i*Math.PI/2,post=new THREE.Mesh(new THREE.BoxGeometry(.16,.22,.16),runnerMaterial);post.position.copy(horizontalRadial(angle).multiplyScalar(2.50));post.position.y=-.24;post.userData.role='runner-spider-to-backplate-riser';runner.add(post);runnerRisers.push(post);}
  const rotationMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.10, 0.12),
    whiteMaterial,
  );
  rotationMarker.position.set(2.58, 0.59, 0);
  rotationMarker.userData.role =
    'visible-clockwise-marker-on-outer-runner-B';
  runner.add(rotationMarker);
  rotationMarker.visible = false; // Brown draws no index stripe on the runner.

  const flowCurves = [];
  const flowPathTubes = [];
  for (let pathIndex = 0; pathIndex < fixedGuideCount; pathIndex += 1) {
    const baseAngle = pathIndex * FULL_TURN / fixedGuideCount;
    // Mid-passage streamline: down from the centre, out between two guides,
    // on through the turning buckets with its whirl reduced, off the rim.
    const passage = baseAngle + FULL_TURN / fixedGuideCount / 2;
    const points = [
      polarPoint(0.36, passage + guideSweep + 0.45, 0.52),
      polarPoint(0.72, passage + guideSweep + 0.2, 0.26),
      polarPoint(guideInnerRadius, guideAngleAt(passage, 0), 0.17),
      polarPoint((guideInnerRadius + guideOuterRadius) / 2, guideAngleAt(passage, 0.5), 0.17),
      polarPoint(guideOuterRadius, guideAngleAt(passage, 1), 0.17),
      polarPoint(2.62, passage - 0.13, 0.17),
      polarPoint(runnerOuterRadius, passage - 0.2, 0.17),
      polarPoint(3.48, passage - 0.24, 0.02),
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
  // Pass 69: the water is drawn as one continuous sheet per guide passage
  // (water-stream.js), along the streamline above to the rim, where it is
  // thrown off with its exit speed and falls; streaks scroll with the flow.
  const flowSpeed = 2.2;
  const flowSheets = flowCurves.map((curve, index) => {
    const along = guidedPath(new THREE.CatmullRomCurve3(curve.points.slice(0, -1), false, 'centripetal'),
      {speed: flowSpeed, samples: 36});
    const n = along.points.length;
    const exit = along.points[n - 1].clone().sub(along.points[n - 2]).normalize().multiplyScalar(flowSpeed);
    const sheet = new WaterStream(joinPaths(along, ballisticPath({
      origin: along.points[n - 1], velocity: exit, endY: -0.6, samples: 10,
    })), {
      width: 0.22, thickness: 0.05, widthAxis: 'horizontal', widthExponent: 0.5,
      fadeIn: 0.06, fadeOut: 0.14, cyclePeriod: cycleDuration, streakRate: 1.4,
      opacity: 0.32,
    });
    sheet.userData.role = `water-sheet-through-guide-passage-${index + 1}`;
    root.add(sheet);
    return sheet;
  });
  const updateWater = collectWaterStreams(root);
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
  casingFloor.geometry.dispose();casingFloor.geometry=horizontalRing(.344,3.62,-.63,-.45);casingFloor.position.y=0;
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

  // The short shaft runs in a bored bush fixed to the foundation's underside;
  // no separate under-floor bridge is needed (Brown draws only the plan).
  const shaftBearing=new THREE.Mesh(horizontalRing(.224,.40,-.84,-.63),frameMaterial);shaftBearing.userData.role='bored-output-shaft-bush-bolted-under-foundation';root.add(shaftBearing);
  const update = (time) => {
    const state = stateAtTime(time);
    runner.rotation.y = state.runnerAngle;
    updateWater(time);
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
      targetCycleDuration: cycleDuration,
    },
    archetype:
      'fourneyron-outward-flow-turbine-with-fixed-inner-curved-guides-and-clockwise-outer-runner',
    blocks: {
      shaftBearing,
      runnerBackplate,
      runnerRisers,
      casingFloor,
      centralInlet,
      dischargeRing,
      fixedGuideAssembly,
      fixedGuideVanes,
      flowMarkers: flowMarkers.map(({ marker }) => marker),
      flowPathTubes,
      flowSheets,
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
      'Water enters centrally and passes outward through eight stationary curved shutes in guide assembly A. The guides give the water clockwise whirl before it meets eighteen oppositely curved buckets in the separate outer runner B. The runner turns clockwise as it removes most of that whirl, and the water then discharges radially around the circumference. The inner guide disk, guide vanes, inlet, floor, and flow field remain fixed; only the outer bucket ring, its concealed support arms, output hub, shaft, and marker rotate together.',
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
        approximateFixedGuideCount: 8,
        approximateGuideOuterRadiusPixels: 142,
        approximateOuterRunnerBucketCount: 18,
        approximateRunnerOuterRadiusPixels: 205,
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
          'Brown’s plan shows eight curved guides (plate radii 72-136 px) inside a heavy fixed boundary (142 px), a distinct annular outer runner (to 205 px) with eighteen oppositely curved buckets, outward flow arrows, and clockwise arrows at the right-hand circumference.',
        reconstructionDisclosure:
          'Brown gives no dimensions, exact guide or bucket counts, vane profiles, height, flow rate, head, velocity triangles, shaft arrangement, rotational speed, materials, losses, leakage, efficiency, inertia, or load. The plate-measured counts and vane sweeps are kept; blade thickness and height, velocity values, lower support arms, dimensions, colors, and a 5.6-second cycle are independently engineered; the fixed inner guides A, separate revolving outer runner B, central-to-circumferential flow, and clockwise direction are source-grounded.',
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
  root.userData.hideGround=true;
  root.userData.solidReview={qualification:'Finite vanes, shaft clearances and open water passages; flow paths and angular-momentum diagnostics remain prescribed illustrations, not solved pressure, efficiency or load response.'};
  root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])material.fog=false;});
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
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
