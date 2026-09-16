import * as THREE from 'three';
import {horizontalVane,horizontalRing,horizontalPlate,horizontalTurned} from './horizontal-turbine-solids.js';
import {poly,circle,polygonClipping} from './finite-plate-geometry.js';
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

function warrenCentralDischargeTurbine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 5.8;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const fixedGuideCount = 16;
  const runnerBucketCount = 20;
  const runnerBucketPitch = FULL_TURN / runnerBucketCount;
  const guideInnerRadius = 2.26;
  const guideOuterRadius = 3.45;
  const runnerInnerRadius = 1.45;
  const runnerOuterRadius = 2.14;
  const runnerBucketCenterRadius =
    (runnerInnerRadius + runnerOuterRadius) / 2;
  const sourcePoseBucketOffset = 0;
  const shaftRadius = 0.23;
  const massFlowNormalized = 1;
  const guideExitInwardSpeed = 2.72;
  const guideExitClockwiseWhirlSpeed = 3.10;
  const centralDischargeInwardSpeed = 4.35;
  const centralDischargeCounterclockwiseWhirlSpeed = 0.55;

  const guideExitPoint = horizontalRadial(0)
    .multiplyScalar(runnerOuterRadius);
  const guideExitVelocity = horizontalRadial(0)
    .multiplyScalar(-guideExitInwardSpeed)
    .addScaledVector(
      horizontalTangent(0),
      -guideExitClockwiseWhirlSpeed,
    );
  const centralDischargePoint = horizontalRadial(0)
    .multiplyScalar(runnerInnerRadius);
  const centralDischargeVelocity = horizontalRadial(0)
    .multiplyScalar(-centralDischargeInwardSpeed)
    .addScaledVector(
      horizontalTangent(0),
      centralDischargeCounterclockwiseWhirlSpeed,
    );
  const inletSpecificAngularMomentumY = new THREE.Vector3()
    .crossVectors(guideExitPoint, guideExitVelocity).y;
  const outletSpecificAngularMomentumY = new THREE.Vector3()
    .crossVectors(centralDischargePoint, centralDischargeVelocity).y;
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
      centralDischargePoint: centralDischargePoint.clone(),
      centralDischargeVelocity: centralDischargeVelocity.clone(),
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
    centralDischargeCounterclockwiseWhirlSpeed,
    centralDischargeInwardSpeed,
    centralDischargeVelocity: centralDischargeVelocity.clone(),
    cycleDuration,
    fixedGuideCount,
    guideExitClockwiseWhirlSpeed,
    guideExitInwardSpeed,
    guideExitVelocity: guideExitVelocity.clone(),
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
    opacity: 0.64,
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
    'fixed-outer-warren-guide-assembly-a';
  root.add(fixedGuideAssembly);
  for (const height of [-0.04, 0.47]) {
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(guideInnerRadius, 0.09, 9, 104),
      frameMaterial,
    );
    innerRing.geometry.dispose();innerRing.geometry=horizontalRing(guideInnerRadius-.035,guideInnerRadius+.035,height-.04,height+.04);innerRing.rotation.set(0,0,0);innerRing.position.y=0;
    innerRing.userData.role =
      `fixed-guide-inner-boundary-at-y-${height.toFixed(2)}`;
    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(guideOuterRadius, 0.10, 9, 120),
      frameMaterial,
    );
    outerRing.geometry.dispose();outerRing.geometry=horizontalRing(guideOuterRadius-.035,guideOuterRadius+.035,height-.04,height+.04);outerRing.rotation.set(0,0,0);outerRing.position.y=0;
    outerRing.userData.role =
      `fixed-guide-outer-boundary-at-y-${height.toFixed(2)}`;
    fixedGuideAssembly.add(innerRing, outerRing);
  }
  const guideFloor=new THREE.Mesh(horizontalRing(guideInnerRadius-.045,guideOuterRadius+.045,-.18,-.10),frameMaterial);guideFloor.userData.role='stationary-annular-guide-floor';fixedGuideAssembly.add(guideFloor);
  const fixedGuideVanes = [];
  for (let guideIndex = 0; guideIndex < fixedGuideCount; guideIndex += 1) {
    const baseAngle = guideIndex * FULL_TURN / fixedGuideCount;
    const points = Array.from({ length: 25 }, (_, pointIndex) => {
      const progress = pointIndex / 24;
      const radius = THREE.MathUtils.lerp(
        guideOuterRadius,
        guideInnerRadius,
        progress,
      );
      const angle = baseAngle + 0.43 * (1 - progress) ** 1.1;
      return polarPoint(radius, angle, 0.21);
    });
    const curve = new THREE.CatmullRomCurve3(
      points,
      false,
      'centripetal',
    );
    const vane = makeTube(
      curve,
      0.070,
      guideMaterial,
      `fixed-outer-curved-guide-${guideIndex + 1}-of-sixteen`,
    );
    vane.geometry.dispose();vane.geometry=horizontalVane(points,.038,-.10,.45);
    fixedGuideAssembly.add(vane);
    fixedGuideVanes.push(vane);
  }

  const runner = new THREE.Group();
  runner.userData.role =
    'clockwise-inner-warren-runner-b';
  root.add(runner);
  for (const height of [-0.05, 0.45]) {
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(runnerInnerRadius, 0.08, 9, 72),
      runnerMaterial,
    );
    innerRing.geometry.dispose();innerRing.geometry=horizontalRing(runnerInnerRadius-.035,runnerInnerRadius+.035,height-.04,height+.04);innerRing.rotation.set(0,0,0);innerRing.position.y=0;
    innerRing.userData.role =
      `runner-inner-discharge-ring-at-y-${height.toFixed(2)}`;
    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(runnerOuterRadius, 0.09, 9, 96),
      runnerMaterial,
    );
    outerRing.geometry.dispose();outerRing.geometry=horizontalRing(runnerOuterRadius-.035,runnerOuterRadius+.035,height-.04,height+.04);outerRing.rotation.set(0,0,0);outerRing.position.y=0;
    outerRing.userData.role =
      `runner-outer-inlet-ring-at-y-${height.toFixed(2)}`;
    runner.add(innerRing, outerRing);
  }
  const runnerBackplate=new THREE.Mesh(horizontalRing(runnerInnerRadius-.04,runnerOuterRadius+.045,-.14,-.05),runnerMaterial);runnerBackplate.userData.role='annular-runner-backplate-joining-working-vanes';runner.add(runnerBackplate);
  const runnerBuckets = [];
  for (let bucketIndex = 0; bucketIndex < runnerBucketCount;
    bucketIndex += 1) {
    const localAngle = sourcePoseBucketOffset
      + bucketIndex * runnerBucketPitch;
    const points = Array.from({ length: 23 }, (_, pointIndex) => {
      const progress = pointIndex / 22;
      const radius = THREE.MathUtils.lerp(
        runnerOuterRadius,
        runnerInnerRadius,
        progress,
      );
      const angle = localAngle - 0.09 * (1 - progress)
        + 0.34 * progress ** 1.25;
      return polarPoint(radius, angle, 0.20);
    });
    const curve = new THREE.CatmullRomCurve3(
      points,
      false,
      'centripetal',
    );
    const bucket = makeTube(
      curve,
      0.064,
      runnerMaterial,
      `curved-inner-runner-bucket-${bucketIndex + 1}-of-twenty`,
    );
    bucket.geometry.dispose();bucket.geometry=horizontalVane(points,.032,-.05,.45);
    runner.add(bucket);
    runnerBuckets.push(bucket);
  }
  const runnerDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.59, 0.59, 0.26, 48),
    runnerMaterial,
  );
  runnerDisk.position.y = 0.08;
  runnerDisk.userData.role = 'solid-central-runner-disk-b';
  runner.add(runnerDisk);
  const runnerHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.34, 40),
    runnerMaterial,
  );
  runnerHub.position.y = -0.34;
  runnerHub.userData.role = 'warren-runner-output-hub-below-disk';
  runner.add(runnerHub);
  const runnerShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(shaftRadius, shaftRadius, 1.84, 32),
    darkMaterial,
  );
  runnerShaft.position.y = -1.10;
  runnerShaft.userData.role = 'vertical-output-shaft-of-inner-runner-b';
  runner.add(runnerShaft);
  const runnerSupportArms = [];
  for (let armIndex = 0; armIndex < 4; armIndex += 1) {
    const angle = Math.PI / 4 + armIndex * Math.PI / 2;
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(1.56, 0.28, 0.15),
      runnerMaterial,
    );
    arm.position.copy(horizontalRadial(angle).multiplyScalar(.78));
    arm.position.y = -.12;
    arm.rotation.y = angle;
    arm.userData.role =
      `runner-b-lower-support-arm-${armIndex + 1}-of-four`;
    runner.add(arm);
    runnerSupportArms.push(arm);
  }
  const rotationMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.10, 0.12),
    whiteMaterial,
  );
  rotationMarker.position.set(1.72, 0.59, 0);
  rotationMarker.userData.role =
    'visible-clockwise-marker-on-inner-runner-b';
  runner.add(rotationMarker);

  const flowCurves = [];
  const flowPathTubes = [];
  const representativePathCount = 8;
  for (let pathIndex = 0; pathIndex < representativePathCount;
    pathIndex += 1) {
    const baseAngle = pathIndex * FULL_TURN / representativePathCount;
    const points = [
      polarPoint(3.72, baseAngle + 0.58, 0.38),
      polarPoint(3.30, baseAngle + 0.41, 0.29),
      polarPoint(2.64, baseAngle + 0.18, 0.23),
      polarPoint(2.20, baseAngle, 0.21),
      polarPoint(1.70, baseAngle - 0.06, 0.20),
      polarPoint(1.18, baseAngle + 0.10, 0.18),
      polarPoint(1.08, baseAngle + 0.34, -0.12),
      polarPoint(.98, baseAngle + 0.38, -1.10),
    ];
    const curve = new THREE.CatmullRomCurve3(
      points,
      false,
      'centripetal',
    );
    flowCurves.push(curve);
    const tube = makeTube(
      curve,
      0.060,
      waterMaterial,
      `continuous-outer-guide-to-central-discharge-path-${pathIndex + 1}`,
    );
    root.add(tube);
    flowPathTubes.push(tube);
  }
  const flowMarkers = [];
  const markersPerPath = 3;
  for (let pathIndex = 0; pathIndex < representativePathCount;
    pathIndex += 1) {
    for (let markerIndex = 0; markerIndex < markersPerPath;
      markerIndex += 1) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.082, 16, 11),
        paleWaterMaterial,
      );
      marker.userData.role =
        `inward-flow-marker-path-${pathIndex + 1}-particle-${markerIndex + 1}`;
      root.add(marker);
      flowMarkers.push({ marker, markerIndex, pathIndex });
    }
  }
  const outerSupplyRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.69, 0.14, 10, 120),
    waterMaterial,
  );
  outerSupplyRing.rotation.x = Math.PI / 2;
  outerSupplyRing.position.y = 0.29;
  outerSupplyRing.userData.role =
    'circumferential-water-supply-to-fixed-outer-guides';
  root.add(outerSupplyRing);
  const centralDischarge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 1.34, 40),
    waterMaterial,
  );
  centralDischarge.geometry.dispose();centralDischarge.geometry=horizontalRing(.64,1.30,-1.25,-.50);centralDischarge.position.y=0;
  centralDischarge.userData.role =
    'water-discharging-downward-at-turbine-center';
  root.add(centralDischarge);
  const casingFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(3.86, 3.86, 0.18, 88),
    frameMaterial,
  );
  casingFloor.geometry.dispose();casingFloor.geometry=horizontalRing(1.38,3.86,-.63,-.45);casingFloor.position.y=0;
  casingFloor.userData.role =
    'fixed-foundation-below-warren-plan-view-turbine';
  root.add(casingFloor);

  const shaftBearing=new THREE.Mesh(horizontalRing(.234,.36,-1.98,-1.78),frameMaterial);shaftBearing.userData.role='bored-output-shaft-lower-bearing';root.add(shaftBearing);
  const bearingBridge=new THREE.Mesh(horizontalPlate(polygonClipping.difference(poly([[-3.4,-.16],[3.4,-.16],[3.4,.16],[-3.4,.16]]),poly(circle([0,0],.234,128))),-1.98,-1.82),frameMaterial);bearingBridge.userData.role='lower-shaft-bearing-support-bridge';root.add(bearingBridge);
  for(const x of[-3.35,3.35]){const post=new THREE.Mesh(new THREE.BoxGeometry(.16,1.23,.25),frameMaterial);post.position.set(x,-1.225,0);post.userData.role='lower-bearing-bridge-support-post';root.add(post);}
  const update = (time) => {
    const state = stateAtTime(time);
    runner.rotation.y = state.runnerAngle;
    const flowPhase = THREE.MathUtils.euclideanModulo(time / 1.30, 1);
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
      'warren-inward-flow-turbine-with-fixed-outer-guides-and-clockwise-inner-runner-discharging-centrally',
    blocks: {
      shaftBearing,
      bearingBridge,
      runnerBackplate,
      guideFloor,
      casingFloor,
      centralDischarge,
      fixedGuideAssembly,
      fixedGuideVanes,
      flowMarkers: flowMarkers.map(({ marker }) => marker),
      flowPathTubes,
      outerSupplyRing,
      rotationMarker,
      runner,
      runnerBuckets,
      runnerDisk,
      runnerHub,
      runnerShaft,
      runnerSupportArms,
    },
    degreesOfFreedom: {
      fixedOuterGuideVanesRotate: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      runnerAndOutputShaftIndependent: false,
    },
    dynamics: {
      angularMomentumDiagnostic:
        'Normalized runner torque equals mass flow times guide-exit minus central-discharge specific angular momentum about y. The fixed outer guides supply clockwise inlet whirl and the runner turns the residual flow slightly counterclockwise, producing an exact negative (clockwise) torque.',
      fluidPressureViscosityTurbulenceLeakageCavitationBladeLoadingBearingFrictionRunnerInertiaGeneratorLoadAndSpeedResponseModeled:
        false,
      markerContinuity:
        'Each visible water marker follows one centripetal Catmull-Rom curve continuously from the outer supply through guide a and runner b to the central outlet, fading to zero at recycling endpoints.',
    },
    fidelity: 'authored',
    flowCurves,
    geometry,
    mechanism:
      'Water arrives around the circumference and moves inward through sixteen stationary curved passages in the outer guide assembly a. It then enters twenty oppositely curved passages in the separate inner runner b, whose change of water angular momentum produces clockwise torque. Water leaves at the center and falls through the outlet. The outer guide rings, their vanes, supply annulus, foundation, and flow field remain fixed; only runner b, its concealed support arms, output hub, shaft, and marker rotate together.',
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
        'The official Movement 435 page provides Brown’s static plan-view engraving and caption but contains no Canvas construction or source timing.',
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
      brownPlate435: {
        approximateFixedOuterGuideCount: 16,
        approximateGuideInnerRadiusPixels: 157,
        approximateInnerRunnerBucketCount: 20,
        approximateRunnerInnerDiskRadiusPixels: 111,
        centerApproximatePixels: [267, 261],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 17,
        outerGuideRadiusPixels: 220,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the drawing is a plan view of Warren’s central-discharge turbine',
          'guides a are outside',
          'wheel b revolves within the guides',
          'water discharges at the center',
        ],
        engravingEvidence:
          'Brown’s plan shows about sixteen broad curved fixed passages in outer annulus a, about twenty finer oppositely curved passages in inner annular runner b, four arms on b, inward arrows through a, a reversed-whirl arrow in b, and a central outlet.',
        reconstructionDisclosure:
          'Brown gives no dimensions, exact guide or bucket counts, vane profiles, height, flow rate, head, velocity triangles, shaft arrangement, rotational speed, materials, losses, leakage, efficiency, inertia, or load. Sixteen fixed guides, twenty runner buckets, curves, velocity values, hidden lower support and shaft, dimensions, colors, and a 5.8-second cycle are independently engineered; the fixed outer guides a, separate revolving inner wheel b, inward flow, and central discharge are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 435',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      angularMomentum:
        'tau_y=massFlow*(cross(r_guideExit,v_guideExit).y-cross(r_center,v_center).y)<0',
      fixedGuideAction:
        'stationary outer guides turn circumferential supply into inward flow with clockwise whirl',
      runnerAttachment:
        'bucketWorldAngle=bucketLocalAngle+runnerAngle; output shaft shares runnerAngle',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.08, -2.12, -4.08),
    new THREE.Vector3(4.08, 1.02, 4.08),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(4.9, 8.8, 6.5);
  root.userData.groundFloorY = -2.12;
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

export function createAuthoredWarrenCentralDischargeTurbineMovement(movement) {
  if (movement.id !== 435) return null;
  return warrenCentralDischargeTurbine(movement);
}
