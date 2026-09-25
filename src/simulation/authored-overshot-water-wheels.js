import * as THREE from 'three';
import {ring,plate,poly,sector,polygonClipping} from './finite-plate-geometry.js';
import {wheelBearings,makeCellWaterGeometry,updateCellWater} from './water-wheel-solids.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';
import {waterJetGeometry, waterJetMaterial} from './water-volume.js';

const FULL_TURN = Math.PI * 2;

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function smoothStep5(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return THREE.MathUtils.clamp(
    clamped ** 3 * (clamped * (clamped * 6 - 15) + 10),
    0,
    1,
  );
}

function arcPoints(radius, startAngle, endAngle, z, count = 64) {
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = THREE.MathUtils.lerp(
      startAngle,
      endAngle,
      index / count,
    );
    return new THREE.Vector3(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
      z,
    );
  });
}

function makeTube(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, points.length * 3, radius, 9, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function overshotWaterWheel(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const wheelRadius = 2.72;
  const bucketCenterRadius = 2.35;
  const bucketRadialDepth = 0.74;
  const bucketAxialWidth = 1.02;
  const bucketCount = 12;
  const spokeCount = 6;
  const hubRadius = 0.43;
  const shaftRadius = 0.22;
  const inletAngle = THREE.MathUtils.degToRad(67);
  const fillTravelAngle = THREE.MathUtils.degToRad(16);
  const drainStartTravelAngle = THREE.MathUtils.degToRad(137);
  const drainEndTravelAngle = THREE.MathUtils.degToRad(164);
  const sourcePoseBucketOffset = inletAngle;
  const gravity = 9.81;

  const waterFillAtWorldAngle = (worldAngle) => {
    const clockwiseTravel = THREE.MathUtils.euclideanModulo(
      inletAngle - worldAngle,
      FULL_TURN,
    );
    if (clockwiseTravel < fillTravelAngle) {
      return smoothStep5(clockwiseTravel / fillTravelAngle);
    }
    if (clockwiseTravel < drainStartTravelAngle) return 1;
    if (clockwiseTravel < drainEndTravelAngle) {
      return 1 - smoothStep5(
        (clockwiseTravel - drainStartTravelAngle)
          / (drainEndTravelAngle - drainStartTravelAngle),
      );
    }
    return 0;
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const wheelAngle = -inputAngle;
    const wheelAngularSpeed = -inputSpeed;
    const wheelAngularAcceleration = -inputAcceleration;
    const buckets = [];
    let retainedWaterMassNormalized = 0;
    let gravityTorqueNormalized = 0;
    let retainedWaterPotentialNormalized = 0;
    for (let bucketIndex = 0; bucketIndex < bucketCount;
      bucketIndex += 1) {
      const localAngle = sourcePoseBucketOffset
        + bucketIndex * FULL_TURN / bucketCount;
      const worldAngle = localAngle + wheelAngle;
      const radial = new THREE.Vector3(
        Math.cos(worldAngle),
        Math.sin(worldAngle),
        0,
      );
      const tangent = new THREE.Vector3(-radial.y, radial.x, 0);
      const center = radial.clone().multiplyScalar(bucketCenterRadius);
      const centerVelocity = tangent.clone().multiplyScalar(
        bucketCenterRadius * wheelAngularSpeed,
      );
      const centerAcceleration = tangent.clone().multiplyScalar(
        bucketCenterRadius * wheelAngularAcceleration,
      ).addScaledVector(
        radial,
        -bucketCenterRadius * wheelAngularSpeed ** 2,
      );
      const waterFill = waterFillAtWorldAngle(worldAngle);
      const gravityTorque = -waterFill * gravity * center.x;
      retainedWaterMassNormalized += waterFill;
      gravityTorqueNormalized += gravityTorque;
      retainedWaterPotentialNormalized += waterFill * gravity * center.y;
      buckets.push({
        center,
        centerAcceleration,
        centerVelocity,
        gravityTorque,
        index: bucketIndex,
        localAngle,
        radial,
        tangent,
        waterFill,
        waterSurfaceWorldAngle: 0,
        worldAngle,
      });
    }
    const rimReferenceRadial = new THREE.Vector3(
      Math.cos(wheelAngle),
      Math.sin(wheelAngle),
      0,
    );
    const rimReferenceTangent = new THREE.Vector3(
      -rimReferenceRadial.y,
      rimReferenceRadial.x,
      0,
    );
    const rimReferencePoint = rimReferenceRadial.clone()
      .multiplyScalar(wheelRadius);
    const rimReferenceVelocity = rimReferenceTangent.clone()
      .multiplyScalar(wheelRadius * wheelAngularSpeed);
    const rimReferenceAcceleration = rimReferenceTangent.clone()
      .multiplyScalar(wheelRadius * wheelAngularAcceleration)
      .addScaledVector(
        rimReferenceRadial,
        -wheelRadius * wheelAngularSpeed ** 2,
      );
    return {
      buckets,
      gravityTorqueNormalized,
      inputAcceleration,
      inputAngle,
      inputSpeed,
      retainedWaterMassNormalized,
      retainedWaterPotentialNormalized,
      rimReferenceAcceleration,
      rimReferencePoint,
      rimReferenceVelocity,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
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
    bucketAxialWidth,
    bucketCenterRadius,
    bucketCount,
    bucketRadialDepth,
    cycleDuration,
    drainEndTravelAngle,
    drainStartTravelAngle,
    fillTravelAngle,
    gravity,
    hubRadius,
    inletAngle,
    inputAngularSpeed,
    shaftRadius,
    sourcePoseBucketOffset,
    spokeCount,
    wheelRadius,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.47,
  });
  const wheelMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.55,
  });
  const bucketMaterial = matte(PALETTE.brass, {
    metalness: 0.20,
    roughness: 0.48,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.74,
    roughness: 0.35,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const paleWaterMaterial = matte(0x70bfd0, {
    opacity: 0.46,
    roughness: 0.32,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const rotor = new THREE.Group();
  rotor.userData.role =
    'clockwise-overshot-water-wheel-rotor-with-retaining-buckets';
  root.add(rotor);
  for (const face of [-1, 1]) {
    const z = face * bucketAxialWidth / 2;
    const outerRim = new THREE.Mesh(
      new THREE.TorusGeometry(wheelRadius, 0.105, 10, 96),
      wheelMaterial,
    );
    outerRim.position.z = z;
    outerRim.userData.role = face < 0
      ? 'rear-outer-wheel-rim'
      : 'front-outer-wheel-rim';
    const innerRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.91, 0.075, 9, 96),
      wheelMaterial,
    );
    innerRim.position.z = z;
    innerRim.userData.role = face < 0
      ? 'rear-inner-wheel-rim'
      : 'front-inner-wheel-rim';
    rotor.add(outerRim, innerRim);
  }

  const innerDrum=new THREE.Mesh(ring(1.91,2.02,-.51,.51,256),wheelMaterial);innerDrum.userData.role='closed-inner-bucket-drum';rotor.add(innerDrum);
  const bucketCheeks=[];
  for(const side of[-1,1]){const material=wheelMaterial.clone();if(side>0){material.transparent=true;material.opacity=.24;material.depthWrite=false;}const cheek=new THREE.Mesh(ring(1.91,2.77,side<0?-.59:.51,side<0?-.51:.59,256),material);cheek.userData.role='bucket-side-cheek';rotor.add(cheek);bucketCheeks.push(cheek);}
  const hub = cylinderAlongZ(hubRadius, 1.26, wheelMaterial, 40);
  hub.position.z = 0;
  hub.userData.role = 'water-wheel-hub-fast-on-main-shaft';
  rotor.add(hub);
  for (let spokeIndex = 0; spokeIndex < spokeCount; spokeIndex += 1) {
    const angle = spokeIndex * FULL_TURN / spokeCount;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(1.96, 0.15, 0.26),
      wheelMaterial,
    );
    spoke.position.set(
      0.98 * Math.cos(angle),
      0.98 * Math.sin(angle),
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `wheel-spoke-${spokeIndex + 1}-of-six`;
    rotor.add(spoke);
  }

  const bucketParts = [];
  for (let bucketIndex = 0; bucketIndex < bucketCount;
    bucketIndex += 1) {
    const localAngle = sourcePoseBucketOffset
      + bucketIndex * FULL_TURN / bucketCount;
    const bucket = new THREE.Group();
    bucket.position.set(
      bucketCenterRadius * Math.cos(localAngle),
      bucketCenterRadius * Math.sin(localAngle),
      0,
    );
    bucket.rotation.z = localAngle;
    bucket.userData.role =
      `overshot-retaining-bucket-${bucketIndex + 1}-of-twelve`;
    const divider = new THREE.Mesh(
      new THREE.BoxGeometry(
        bucketRadialDepth,
        0.09,
        bucketAxialWidth,
      ),
      bucketMaterial,
    );
    divider.userData.role =
      `radial-divider-of-bucket-${bucketIndex + 1}`;
    bucket.add(divider);
    const hookedLip = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.38, bucketAxialWidth),
      bucketMaterial,
    );
    hookedLip.position.set(bucketRadialDepth / 2 - 0.04, -0.15, 0);
    hookedLip.rotation.z = -0.16;
    hookedLip.userData.role =
      `outer-retaining-lip-of-bucket-${bucketIndex + 1}`;
    bucket.add(hookedLip);
    rotor.add(bucket);

    const waterLoad = new THREE.Group();
    waterLoad.position.set(
      bucketCenterRadius * Math.cos(localAngle),
      bucketCenterRadius * Math.sin(localAngle),
      0,
    );
    waterLoad.userData.role =
      `gravity-level-water-load-in-bucket-${bucketIndex + 1}`;
    const waterBody = new THREE.Mesh(
      makeCellWaterGeometry(),
      waterMaterial,
    );
    waterBody.position.z = 0.02;
    waterBody.userData.role =
      `retained-water-body-${bucketIndex + 1}`;
    waterLoad.add(waterBody);
    rotor.add(waterLoad);
    bucketParts.push({
      bucket,
      divider,
      hookedLip,
      waterBody,
      waterLoad,
    });
  }
  const rotationMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.09, 0.10),
    whiteMaterial,
  );
  rotationMarker.position.set(0.27, 0, 0.68);
  rotationMarker.userData.role = 'visible-clockwise-wheel-rotation-marker';
  rotationMarker.visible = false; // Brown draws no index on the wheel.
  rotor.add(rotationMarker);

  const shaft = cylinderAlongZ(shaftRadius, 1.70, darkMaterial, 36);
  shaft.position.z = 0;
  shaft.userData.role = 'main-water-wheel-shaft-in-fixed-bearings';
  root.add(shaft);
  const bearingParts=wheelBearings(root,shaft,frameMaterial,-3.85);
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(8.20, 0.30, 1.72),
    frameMaterial,
  );
  foundation.position.set(0, -4.00, -0.32);
  foundation.userData.role = 'fixed-overshot-wheel-foundation';
  root.add(foundation);

  const flume = new THREE.Mesh(
    new THREE.BoxGeometry(5.45, 0.22, 1.40),
    frameMaterial,
  );
  flume.position.set(-1.55, 3.43, -0.18);
  flume.rotation.z = -0.045;
  flume.userData.role = 'fixed-top-feed-headrace-flume';
  root.add(flume);
  const flumeWater = new THREE.Mesh(
    new THREE.BoxGeometry(5.15, 0.12, 1.02),
    paleWaterMaterial,
  );
  flumeWater.position.set(-1.60, 3.54, 0.04);
  flumeWater.rotation.z = -0.045;
  flumeWater.userData.role = 'water-flowing-along-top-headrace';
  root.add(flumeWater);

  const feedPathPoints = [
    new THREE.Vector3(1.10, 3.46, 0.14),
    new THREE.Vector3(1.34, 3.21, 0.14),
    new THREE.Vector3(1.50, 2.86, 0.14),
    new THREE.Vector3(
      bucketCenterRadius * Math.cos(inletAngle),
      bucketCenterRadius * Math.sin(inletAngle),
      0.14,
    ),
  ];
  // The feed is one translucent sheet of water the width of the flume water
  // pouring off its end into the buckets (not a round hose).
  const feedWater = new THREE.Mesh(
    waterJetGeometry(new THREE.CatmullRomCurve3(
      feedPathPoints.map((point) => point.clone().setZ(0)), false, 'centripetal'), {
      radius: 0.07, endRadius: 0.09, width: 0.44, endWidth: 0.46,
      widthAxis: new THREE.Vector3(0, 0, 1), segments: 48, fadeStart: 0.88, flare: 1.15,
    }).translate(0, 0, 0.14),
    waterJetMaterial(),
  );
  feedWater.renderOrder = 2;
  feedWater.userData.role = 'continuous-top-fed-water-stream-onto-wheel';
  root.add(feedWater);
  const feedCurve = new THREE.CatmullRomCurve3(
    feedPathPoints,
    false,
    'centripetal',
  );
  const droplets = [];
  for (let dropletIndex = 0; dropletIndex < 7; dropletIndex += 1) {
    const droplet = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 18, 12),
      paleWaterMaterial,
    );
    droplet.userData.role = `falling-feed-water-droplet-${dropletIndex + 1}`;
    root.add(droplet);
    droplets.push(droplet);
  }

  const tailrace = makeTube(
    [
      new THREE.Vector3(0.25, -3.03, 0.08),
      new THREE.Vector3(1.35, -3.18, 0.08),
      new THREE.Vector3(2.70, -3.31, 0.08),
      new THREE.Vector3(4.05, -3.30, 0.08),
    ],
    0.19,
    waterMaterial,
    'bottom-tailrace-carrying-discharged-water-away',
  );
  // The plate shows the spent water falling on the pit floor, not a pipe.
  tailrace.visible = false;
  root.add(tailrace);
  const masonryRace = makeTube(
    arcPoints(3.18, THREE.MathUtils.degToRad(188),
      THREE.MathUtils.degToRad(342), -0.56, 80),
    0.16,
    frameMaterial,
    'fixed-curved-masonry-wheel-race',
  );
  // Brown's wheel pit: a hatched masonry breast falling straight from the
  // headrace, curving close round the lower left of the wheel and running
  // out as the tail floor to the right.
  {
    const inner = 3.07, outer = 3.67, top = 3.32, floorEnd = 3.9;
    const arc = (radius, from, to, count = 96) => Array.from({length: count + 1},
      (_, i) => { const a = from + (to - from) * i / count; return [radius * Math.cos(a), radius * Math.sin(a)]; });
    const outline = [[-inner, top], ...arc(inner, Math.PI, 1.5 * Math.PI), [floorEnd, -inner],
      [floorEnd, -outer], ...arc(outer, 1.5 * Math.PI, Math.PI), [-outer, top]];
    masonryRace.geometry.dispose();
    masonryRace.geometry = plate(poly(outline), -0.75, 0.75);
  }
  root.add(masonryRace);

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.z = state.wheelAngle;
    for (let bucketIndex = 0; bucketIndex < bucketCount;
      bucketIndex += 1) {
      const bucketState = state.buckets[bucketIndex];
      const parts = bucketParts[bucketIndex];
      parts.waterLoad.rotation.z = -state.wheelAngle;
      updateCellWater(parts.waterBody,{angle:bucketState.worldAngle-Math.PI/bucketCount,halfAngle:Math.PI/bucketCount-.035,inner:2.09,outer:2.57,fill:bucketState.waterFill,origin:bucketState.center,width:.96});
    }
    const flowPhase = THREE.MathUtils.euclideanModulo(
      time / 0.82,
      1,
    );
    for (let dropletIndex = 0; dropletIndex < droplets.length;
      dropletIndex += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        flowPhase + dropletIndex / droplets.length,
        1,
      );
      droplets[dropletIndex].position.copy(feedCurve.getPoint(progress));
      const endFade = Math.min(progress / 0.08, (1 - progress) / 0.08, 1);
      droplets[dropletIndex].scale.setScalar(0.45 + 0.55 * endFade);
    }
  };

  const sourceState = stateAtInputAngle(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 6,
    },
    archetype:
      'overshot-water-wheel-with-top-fed-retaining-buckets-weighting-clockwise-descending-side',
    blocks: {
      innerDrum,
      bucketCheeks,
      ...bearingParts,
      bucketGroups: bucketParts.map(({ bucket }) => bucket),
      bucketWaterBodies: bucketParts.map(({ waterBody }) => waterBody),
      bucketWaterLoads: bucketParts.map(({ waterLoad }) => waterLoad),
      feedWater,
      flume,
      flumeWater,
      foundation,
      hub,
      masonryRace,
      rotationMarker,
      rotor,
      shaft,
      tailrace,
    },
    degreesOfFreedom: {
      bucketWaterFillIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      wheelRotationIndependent: true,
    },
    dynamics: {
      bucketFillModel:
        'Each wheel-fixed bucket receives a smooth fill ramp beneath the stationary top flume, retains its load down the descending side, and drains smoothly near the bottom. Water surfaces remain horizontal in world space.',
      fluidPressureViscositySplashLeakageImpactBearingFrictionWheelInertiaGeneratorLoadAndSpeedResponseModeled:
        false,
      gravityTorqueDiagnostic:
        'The displayed normalized torque is the exact moment of each prescribed bucket water weight about the shaft; wheel speed remains prescribed rather than dynamically integrated.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'A fixed elevated headrace delivers water over the crown into retaining buckets fixed around the wheel rim. The filled buckets remain on the right-hand descending side, so their weight produces clockwise torque about the shaft. Each load drains before rising on the left, and the discharged water leaves through the bottom tailrace. All buckets, rims, spokes, hub, and the visible rotation marker are one rigid rotor; only the water surfaces counter-rotate locally to remain level under gravity.',
    motion: {
      bucketPitch: FULL_TURN / bucketCount,
      cycleDuration,
      inputAngularSpeed,
      wheelDirection: 'clockwise',
      wheelRevolutionsPerCycle: 1,
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 430 page provides Brown’s single static engraving and two-word caption but contains no Canvas construction or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      buckets: sourceState.buckets.map((bucket) => ({
        center: bucket.center.clone(),
        waterFill: bucket.waterFill,
        worldAngle: bucket.worldAngle,
      })),
      gravityTorqueNormalized: sourceState.gravityTorqueNormalized,
      wheelAngle: sourceState.wheelAngle,
    },
    sourceReference: {
      brownPlate430: {
        approximateBucketCount: 12,
        approximateOuterWheelRadiusPixels: 166,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 15,
        shaftApproximateCenterPixels: [315, 293],
        topFlumeOutletApproximatePixels: [357, 119],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the mechanism is an overshot water-wheel',
        ],
        engravingEvidence:
          'Brown’s engraving shows an elevated left-to-right headrace discharging above the wheel, bucket pockets around the rim, six spokes, a clockwise/downward arrow on the right, retained water on the descending side, a close masonry race, and bottom discharge.',
        reconstructionDisclosure:
          'Brown gives no dimensions, bucket count, bucket profile, width, flow rate, head, speed, materials, efficiency, losses, bearing friction, wheel inertia, or load. Twelve equal buckets, dimensions, smooth fill/hold/drain schedule, water amount, colors, axial construction, and six-second demonstration cycle are independently engineered; the overshot topology, top feed, gravity-loaded descending side, clockwise direction, six visible spokes, and bottom tailrace are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 430',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      bucketAttachment:
        'bucketWorldAngle=bucketLocalAngle+wheelAngle',
      gravityTorque:
        'tau_z=sum(-waterFill*g*bucketCenter.x)',
      waterLevelConstraint:
        'waterLoadWorldAngle=wheelAngle+waterLoadLocalAngle=0',
    },
    update,
    waterFillAtWorldAngle,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.30, -4.16, -1.08),
    new THREE.Vector3(4.30, 3.72, 1.48),
  );
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraDirection = new THREE.Vector3(5.1, 3.8, 12.0);
  root.userData.groundFloorY = -4.16;
  root.userData.hideGround=true;
  root.userData.solidReview={qualification:'Finite supports and water-path geometry; water is a prescribed visual envelope. No free-surface flow, sealing, energy balance or speed response is solved.'};
  root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])material.fog=false;});
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
  markShadows(root);
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredOvershotWaterWheelMovement(movement) {
  if (movement.id !== 430) return null;
  return overshotWaterWheel(movement);
}
