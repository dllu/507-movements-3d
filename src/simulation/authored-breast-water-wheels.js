import * as THREE from 'three';
import {ring,plate,poly,sector,polygonClipping} from './finite-plate-geometry.js';
import {wheelBearings,makeCellWaterGeometry,updateCellWater} from './water-wheel-solids.js';
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
    const angle = THREE.MathUtils.lerp(startAngle, endAngle, index / count);
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

function breastWaterWheel(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const wheelOuterRadius = 2.75;
  const wheelInnerRadius = 1.78;
  const floatCenterRadius = (wheelOuterRadius + wheelInnerRadius) / 2;
  const floatRadialLength = wheelOuterRadius - wheelInnerRadius;
  const floatAxialWidth = 1.02;
  const floatCount = 16;
  const spokeCount = 8;
  const hubRadius = 0.43;
  const shaftRadius = 0.22;
  const inletAngle = THREE.MathUtils.degToRad(8);
  const fillTravelAngle = THREE.MathUtils.degToRad(18);
  const drainStartTravelAngle = THREE.MathUtils.degToRad(86);
  const drainEndTravelAngle = THREE.MathUtils.degToRad(112);
  const breastStartAngle = THREE.MathUtils.degToRad(13);
  const breastEndAngle = THREE.MathUtils.degToRad(-110);
  const breastInnerRadius = 2.78;
  const breastOuterRadius = 3.22;
  const sourcePoseFloatOffset = Math.PI / 2;
  const bucketAngularOffset = Math.PI / floatCount;
  const bucketCenterRadius = 2.35;
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
    const floatBoards = [];
    const bucketCells = [];
    let retainedWaterMassNormalized = 0;
    let gravityTorqueNormalized = 0;
    let retainedWaterPotentialNormalized = 0;

    for (let floatIndex = 0; floatIndex < floatCount; floatIndex += 1) {
      const localAngle = sourcePoseFloatOffset
        + floatIndex * FULL_TURN / floatCount;
      const worldAngle = localAngle + wheelAngle;
      const radial = new THREE.Vector3(
        Math.cos(worldAngle),
        Math.sin(worldAngle),
        0,
      );
      const tangent = new THREE.Vector3(-radial.y, radial.x, 0);
      const center = radial.clone().multiplyScalar(floatCenterRadius);
      const centerVelocity = tangent.clone().multiplyScalar(
        floatCenterRadius * wheelAngularSpeed,
      );
      const centerAcceleration = tangent.clone().multiplyScalar(
        floatCenterRadius * wheelAngularAcceleration,
      ).addScaledVector(
        radial,
        -floatCenterRadius * wheelAngularSpeed ** 2,
      );
      floatBoards.push({
        center,
        centerAcceleration,
        centerVelocity,
        index: floatIndex,
        localAngle,
        radial,
        tangent,
        worldAngle,
      });

      const bucketLocalAngle = localAngle + bucketAngularOffset;
      const bucketWorldAngle = bucketLocalAngle + wheelAngle;
      const bucketRadial = new THREE.Vector3(
        Math.cos(bucketWorldAngle),
        Math.sin(bucketWorldAngle),
        0,
      );
      const bucketTangent = new THREE.Vector3(
        -bucketRadial.y,
        bucketRadial.x,
        0,
      );
      const bucketCenter = bucketRadial.clone()
        .multiplyScalar(bucketCenterRadius);
      const bucketCenterVelocity = bucketTangent.clone().multiplyScalar(
        bucketCenterRadius * wheelAngularSpeed,
      );
      const bucketCenterAcceleration = bucketTangent.clone()
        .multiplyScalar(bucketCenterRadius * wheelAngularAcceleration)
        .addScaledVector(
          bucketRadial,
          -bucketCenterRadius * wheelAngularSpeed ** 2,
        );
      const waterFill = waterFillAtWorldAngle(bucketWorldAngle);
      const gravityTorque = -waterFill * gravity * bucketCenter.x;
      retainedWaterMassNormalized += waterFill;
      gravityTorqueNormalized += gravityTorque;
      retainedWaterPotentialNormalized += waterFill * gravity
        * bucketCenter.y;
      bucketCells.push({
        center: bucketCenter,
        centerAcceleration: bucketCenterAcceleration,
        centerVelocity: bucketCenterVelocity,
        gravityTorque,
        index: floatIndex,
        localAngle: bucketLocalAngle,
        radial: bucketRadial,
        tangent: bucketTangent,
        waterFill,
        waterSurfaceWorldAngle: 0,
        worldAngle: bucketWorldAngle,
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
      .multiplyScalar(wheelOuterRadius);
    const rimReferenceVelocity = rimReferenceTangent.clone()
      .multiplyScalar(wheelOuterRadius * wheelAngularSpeed);
    const rimReferenceAcceleration = rimReferenceTangent.clone()
      .multiplyScalar(wheelOuterRadius * wheelAngularAcceleration)
      .addScaledVector(
        rimReferenceRadial,
        -wheelOuterRadius * wheelAngularSpeed ** 2,
      );
    return {
      bucketCells,
      floatBoards,
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
    breastEndAngle,
    breastInnerRadius,
    breastOuterRadius,
    breastStartAngle,
    bucketAngularOffset,
    bucketCenterRadius,
    cycleDuration,
    drainEndTravelAngle,
    drainStartTravelAngle,
    fillTravelAngle,
    floatAxialWidth,
    floatCenterRadius,
    floatCount,
    floatRadialLength,
    gravity,
    hubRadius,
    inletAngle,
    inputAngularSpeed,
    shaftRadius,
    sourcePoseFloatOffset,
    spokeCount,
    wheelInnerRadius,
    wheelOuterRadius,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.47,
  });
  const wheelMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.52,
  });
  const floatMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.54,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.70,
    roughness: 0.34,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const paleWaterMaterial = matte(0x72c2d0, {
    opacity: 0.48,
    roughness: 0.31,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const rotor = new THREE.Group();
  rotor.userData.role =
    'clockwise-breast-wheel-with-float-board-cells';
  root.add(rotor);
  for (const face of [-1, 1]) {
    const z = face * floatAxialWidth / 2;
    const outerRim = new THREE.Mesh(
      new THREE.TorusGeometry(wheelOuterRadius, 0.095, 10, 96),
      wheelMaterial,
    );
    outerRim.geometry.dispose();outerRim.geometry=ring(2.69,2.77,-.04,.04,256);
    outerRim.position.z = z;
    outerRim.userData.role = face < 0
      ? 'rear-breast-wheel-outer-rim'
      : 'front-breast-wheel-outer-rim';
    const innerRim = new THREE.Mesh(
      new THREE.TorusGeometry(wheelInnerRadius, 0.085, 10, 96),
      wheelMaterial,
    );
    innerRim.position.z = z;
    innerRim.userData.role = face < 0
      ? 'rear-breast-wheel-inner-rim'
      : 'front-breast-wheel-inner-rim';
    rotor.add(outerRim, innerRim);
  }

  const innerDrum=new THREE.Mesh(ring(1.73,1.82,-.51,.51,256),wheelMaterial);innerDrum.userData.role='closed-inner-bucket-drum';rotor.add(innerDrum);
  const hub = cylinderAlongZ(hubRadius, 1.28, wheelMaterial, 40);
  hub.userData.role = 'breast-wheel-hub-fast-on-main-shaft';
  rotor.add(hub);
  for (let spokeIndex = 0; spokeIndex < spokeCount; spokeIndex += 1) {
    const angle = spokeIndex * FULL_TURN / spokeCount;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(1.80, 0.13, 0.24),
      wheelMaterial,
    );
    spoke.position.set(
      0.90 * Math.cos(angle),
      0.90 * Math.sin(angle),
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `breast-wheel-spoke-${spokeIndex + 1}-of-eight`;
    rotor.add(spoke);
  }

  const floatBoards = [];
  const bucketWaterBodies = [];
  const bucketWaterLoads = [];
  for (let floatIndex = 0; floatIndex < floatCount; floatIndex += 1) {
    const localAngle = sourcePoseFloatOffset
      + floatIndex * FULL_TURN / floatCount;
    const floatBoard = new THREE.Mesh(
      new THREE.BoxGeometry(
        floatRadialLength,
        0.095,
        floatAxialWidth,
      ),
      floatMaterial,
    );
    floatBoard.position.set(
      floatCenterRadius * Math.cos(localAngle),
      floatCenterRadius * Math.sin(localAngle),
      0,
    );
    floatBoard.rotation.z = localAngle;
    floatBoard.userData.role =
      `breast-wheel-float-board-${floatIndex + 1}-of-sixteen`;
    rotor.add(floatBoard);
    floatBoards.push(floatBoard);

    const bucketLocalAngle = localAngle + bucketAngularOffset;
    const waterLoad = new THREE.Group();
    waterLoad.position.set(
      bucketCenterRadius * Math.cos(bucketLocalAngle),
      bucketCenterRadius * Math.sin(bucketLocalAngle),
      0,
    );
    waterLoad.userData.role =
      `gravity-level-water-load-in-breast-cell-${floatIndex + 1}`;
    const waterBody = new THREE.Mesh(
      makeCellWaterGeometry(),
      waterMaterial,
    );
    waterBody.position.z = 0.02;
    waterBody.userData.role =
      `retained-water-in-channel-closed-cell-${floatIndex + 1}`;
    waterLoad.add(waterBody);
    rotor.add(waterLoad);
    bucketWaterBodies.push(waterBody);
    bucketWaterLoads.push(waterLoad);
  }

  const rotationMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.09, 0.10),
    whiteMaterial,
  );
  rotationMarker.position.set(0.27, 0, 0.68);
  rotationMarker.userData.role =
    'visible-clockwise-breast-wheel-rotation-marker';
  rotor.add(rotationMarker);

  const shaft = cylinderAlongZ(shaftRadius, 1.72, darkMaterial, 36);
  shaft.userData.role = 'breast-wheel-main-shaft-in-fixed-bearings';
  root.add(shaft);
  const bearingParts=wheelBearings(root,shaft,frameMaterial,-3.29);

  const breastChannelRails = [];
  const channelSegmentCount = 24;
  const segmentAngle = (breastEndAngle - breastStartAngle)
    / channelSegmentCount;
  const channelCenterRadius = (breastInnerRadius + breastOuterRadius) / 2;
  const channelRadialThickness = breastOuterRadius - breastInnerRadius;
  for (const face of [-1, 1]) {
    for (let segmentIndex = 0; segmentIndex < channelSegmentCount;
      segmentIndex += 1) {
      const angle = breastStartAngle
        + (segmentIndex + 0.5) * segmentAngle;
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(
          Math.abs(segmentAngle) * channelCenterRadius * 1.08,
          channelRadialThickness,
          0.18,
        ),
        frameMaterial,
      );
      rail.position.set(
        channelCenterRadius * Math.cos(angle),
        channelCenterRadius * Math.sin(angle),
        face * 0.64,
      );
      rail.rotation.z = angle + Math.PI / 2;
      rail.userData.role =
        `fixed-${face < 0 ? 'rear' : 'front'}-breast-channel-segment-${segmentIndex + 1}`;
      root.add(rail);
      breastChannelRails.push(rail);
    }
  }
  const breastFloor=new THREE.Mesh(plate(sector(breastInnerRadius,breastOuterRadius,breastEndAngle,0,256),-.55,.55),frameMaterial);breastFloor.userData.role='full-width-curved-breast-floor';root.add(breastFloor);
  const innerCheeks=[];for(const face of[-1,1]){const material=frameMaterial.clone();if(face>0){material.transparent=true;material.opacity=.24;material.depthWrite=false;}const cheek=new THREE.Mesh(plate(sector(1.80,breastOuterRadius,breastEndAngle,breastStartAngle,256),face<0?-.69:.60,face<0?-.60:.69),material);cheek.userData.role='stationary-breast-side-cheek';root.add(cheek);innerCheeks.push(cheek);}
  const channelWater = makeTube(
    arcPoints(
      wheelOuterRadius + 0.08,
      inletAngle,
      inletAngle - drainEndTravelAngle,
      0.06,
      72,
    ),
    0.13,
    waterMaterial,
    'water-confined-between-wheel-floats-and-close-fitting-breast-channel',
  );
  channelWater.visible=false;root.add(channelWater);

  const headrace = new THREE.Mesh(
    new THREE.BoxGeometry(2.56, 0.24, 1.42),
    frameMaterial,
  );
  headrace.position.set(4.28, -0.03, -0.18);
  headrace.rotation.z = 0.035;
  headrace.userData.role = 'fixed-headrace-nearly-level-with-wheel-axle';
  root.add(headrace);
  const headraceWater = new THREE.Mesh(
    new THREE.BoxGeometry(2.44, 0.16, 1.04),
    paleWaterMaterial,
  );
  headraceWater.position.set(4.28, 0.14, 0.03);
  headraceWater.rotation.z = 0.035;
  headraceWater.userData.role =
    'headwater-entering-breast-wheel-nearly-at-axle-level';
  root.add(headraceWater);

  const gateTower = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 4.58, 1.40),
    frameMaterial,
  );
  gateTower.position.set(4.02, 1.47, -0.20);
  gateTower.userData.role = 'fixed-breast-wheel-inlet-sluice-frame';
  gateTower.geometry.dispose();gateTower.geometry=new THREE.BoxGeometry(.58,.30,1.78);gateTower.position.y=3.61;
  root.add(gateTower);
  for(const z of[-.84,.84]){const jamb=new THREE.Mesh(new THREE.BoxGeometry(.58,4.58,.18),frameMaterial);jamb.position.set(4.02,1.47,z);jamb.userData.role='sluice-side-jamb';root.add(jamb);}
  const gateLeaf = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 1.64, 1.12),
    darkMaterial,
  );
  gateLeaf.position.set(4.01, 1.24, 0.03);
  gateLeaf.userData.role = 'partly-raised-breast-wheel-inlet-gate';
  root.add(gateLeaf);
  const gateStem = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 3.68, 0.13),
    darkMaterial,
  );
  gateStem.position.set(4.01, 2.42, 0.56);
  gateStem.userData.role = 'vertical-breast-wheel-gate-stem';
  root.add(gateStem);

  const feedPathPoints = [
    new THREE.Vector3(4.46, 0.16, 0.16),
    new THREE.Vector3(3.74, 0.13, 0.16),
    new THREE.Vector3(3.18, 0.19, 0.16),
    new THREE.Vector3(
      (wheelOuterRadius + 0.03) * Math.cos(inletAngle),
      (wheelOuterRadius + 0.03) * Math.sin(inletAngle),
      0.16,
    ),
  ];
  const feedWater = makeTube(
    feedPathPoints,
    0.13,
    waterMaterial,
    'inlet-stream-turning-from-headrace-into-breast-cells',
  );
  root.add(feedWater);
  const feedCurve = new THREE.CatmullRomCurve3(
    feedPathPoints,
    false,
    'centripetal',
  );
  const flowMarkers = [];
  for (let markerIndex = 0; markerIndex < 8; markerIndex += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.10, 18, 12),
      whiteMaterial,
    );
    marker.userData.role = `breast-wheel-inlet-flow-marker-${markerIndex + 1}`;
    root.add(marker);
    flowMarkers.push(marker);
  }

  const tailrace = makeTube(
    [
      new THREE.Vector3(-1.12, -2.92, 0.06),
      new THREE.Vector3(-1.64, -3.08, 0.06),
      new THREE.Vector3(-2.86, -3.10, 0.06),
      new THREE.Vector3(-4.34, -3.00, 0.06),
    ],
    0.20,
    waterMaterial,
    'free-tailwater-after-breast-cell-discharge',
  );
  root.add(tailrace);
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(9.20, 0.30, 1.82),
    frameMaterial,
  );
  foundation.position.set(0.16, -3.44, -0.27);
  foundation.userData.role = 'fixed-breast-wheel-race-foundation';
  root.add(foundation);

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.z = state.wheelAngle;
    for (let bucketIndex = 0; bucketIndex < floatCount;
      bucketIndex += 1) {
      const bucketState = state.bucketCells[bucketIndex];
      const waterLoad = bucketWaterLoads[bucketIndex];
      const waterBody = bucketWaterBodies[bucketIndex];
      waterLoad.rotation.z = -state.wheelAngle;
      updateCellWater(waterBody,{angle:bucketState.worldAngle,halfAngle:Math.PI/floatCount-.035,inner:1.87,outer:2.72,fill:bucketState.waterFill,origin:bucketState.center,width:.96});
    }
    const flowPhase = THREE.MathUtils.euclideanModulo(time / 0.72, 1);
    for (let markerIndex = 0; markerIndex < flowMarkers.length;
      markerIndex += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        flowPhase + markerIndex / flowMarkers.length,
        1,
      );
      flowMarkers[markerIndex].position.copy(feedCurve.getPoint(progress));
      const endFade = Math.min(progress / 0.08, (1 - progress) / 0.08, 1);
      flowMarkers[markerIndex].scale.setScalar(0.42 + 0.58 * endFade);
    }
  };

  const sourceState = stateAtInputAngle(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 6,
    },
    archetype:
      'breast-water-wheel-with-axle-level-inlet-and-fixed-close-fitting-channel-forming-moving-buckets',
    blocks: {
      innerDrum,
      ...bearingParts,
      breastChannelRails,
      breastFloor,
      innerCheeks,
      bucketWaterBodies,
      bucketWaterLoads,
      channelWater,
      feedWater,
      floatBoards,
      flowMarkers,
      foundation,
      gateLeaf,
      gateStem,
      gateTower,
      headrace,
      headraceWater,
      hub,
      rotationMarker,
      rotor,
      shaft,
      tailrace,
    },
    degreesOfFreedom: {
      bucketWaterFillIndependent: false,
      independentPrescribedInputs: 1,
      inletGateOpeningAnimated: false,
      operatingDegreesOfFreedom: 1,
      wheelRotationIndependent: true,
    },
    dynamics: {
      bucketFillModel:
        'Each inter-float cavity fills smoothly as it passes the fixed inlet near axle level, remains closed radially by the stationary close-fitting breast, and drains smoothly near the bottom. Displayed water surfaces remain horizontal in world space.',
      fluidPressureViscosityTurbulenceSplashLeakageImpactBearingFrictionWheelInertiaGeneratorLoadAndSpeedResponseModeled:
        false,
      gravityTorqueDiagnostic:
        'The normalized torque is the exact moment of each prescribed cell-water weight about the shaft. The wheel speed is prescribed; inlet momentum and full channel hydrodynamics are not integrated.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Water enters from the fixed headrace almost level with the axle and fills the spaces between successive radial float-boards. While each space traverses the right-hand breast, the stationary channel fitted closely to the wheel circumference and width supplies its missing outer wall, converting that moving cavity into a temporary bucket. The retained water weights the descending side and produces clockwise torque; it drains into the lower left tailrace before the floats rise. Both rims, all sixteen float-boards, eight spokes, hub, and rotation marker are one rigid rotor, whereas the breast, inlet gate, and race remain fixed.',
    motion: {
      bucketPitch: FULL_TURN / floatCount,
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
        'The official Movement 432 page provides Brown’s static engraving and caption but contains no Canvas construction or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      bucketCells: sourceState.bucketCells.map((bucket) => ({
        center: bucket.center.clone(),
        waterFill: bucket.waterFill,
        worldAngle: bucket.worldAngle,
      })),
      floatBoards: sourceState.floatBoards.map((floatBoard) => ({
        center: floatBoard.center.clone(),
        worldAngle: floatBoard.worldAngle,
      })),
      gravityTorqueNormalized: sourceState.gravityTorqueNormalized,
      wheelAngle: sourceState.wheelAngle,
    },
    sourceReference: {
      brownPlate432: {
        approximateFloatBoardCount: 16,
        approximateOuterWheelRadiusPixels: 157,
        approximateSpokeCount: 8,
        imageHeight: 525,
        imageWidth: 525,
        inletApproximatePixels: [347, 288],
        measurementUncertaintyPixels: 15,
        shaftApproximateCenterPixels: [187, 269],
        sluiceApproximateCenterPixels: [424, 189],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the breast-wheel is intermediate between overshot and undershot wheels',
          'it has float-boards',
          'a channel adapted to the wheel circumference and width converts the cavities between floats into buckets',
          'water enters nearly at axle level',
        ],
        engravingEvidence:
          'Brown’s engraving shows sixteen approximate radial float-board divisions between concentric rims, eight spokes, a right-side sluice and headwater at about shaft height, a close curved breast around the lower wheel, leftward tailwater, and a rightward crown arrow denoting clockwise rotation.',
        reconstructionDisclosure:
          'Brown gives no dimensions, exact float count, gate opening, inlet speed, discharge point, water depth, rotational speed, materials, losses, efficiency, bearing friction, inertia, or load. Sixteen equal floats, the fill and drain angles, dimensions, normalized gravity-load diagnostic, colors, axial construction, and six-second demonstration cycle are independently engineered; the axle-level inlet, float-board cavities, close stationary breast, lower discharge, and clockwise direction are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 432',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      bucketClosure:
        'successive radial floats plus the fixed close-fitting breast form each moving water cell',
      gravityTorque:
        'tau_z=sum(-waterFill*gravity*bucketCenter.x)<0',
      waterSchedule:
        'fill at the fixed axle-level inlet, retain through the descending breast, drain near the bottom',
    },
    update,
    waterFillAtWorldAngle,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.76, -3.66, -1.10),
    new THREE.Vector3(5.65, 4.32, 1.52),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(5.0, 3.6, 12.2);
  root.userData.groundFloorY = -3.66;
  root.userData.hideGround=true;
  root.userData.solidReview={qualification:'Finite supports and water-path geometry; water is a prescribed visual envelope. No free-surface flow, sealing, energy balance or speed response is solved.'};
  root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])material.fog=false;});
  markShadows(root);
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredBreastWaterWheelMovement(movement) {
  if (movement.id !== 432) return null;
  return breastWaterWheel(movement);
}
