import * as THREE from 'three';
import {ring,plate,poly,sector,polygonClipping} from './finite-plate-geometry.js';
import {wheelBearings,makeCellWaterGeometry,updateCellWater} from './water-wheel-solids.js';
import {waterVolumeMaterial} from './water-volume.js';
import {WaterStream,collectWaterStreams,guidedPath} from './water-stream.js';
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

function undershotWaterWheel(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const wheelRimRadius = 2.25;
  const paddleCenterRadius = 2.58;
  const paddleRadialLength = 0.76;
  const paddleAxialWidth = 1.02;
  const paddleCount = 16;
  const spokeCount = 8;
  const hubRadius = 0.42;
  const shaftRadius = 0.22;
  const waterSurfaceY = -1.94;
  const channelBottomY = -3.18;
  const waterDepth = waterSurfaceY - channelBottomY;
  const flowSpeed = 4.25;
  const dragCoefficientNormalized = 1;
  const sourcePosePaddleOffset = Math.PI / 2;

  const immersionAtPaddleCenterY = (centerY) => smoothStep5(
    (waterSurfaceY - centerY) / paddleRadialLength,
  );

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const wheelAngle = inputAngle;
    const wheelAngularSpeed = inputSpeed;
    const wheelAngularAcceleration = inputAcceleration;
    const paddles = [];
    let totalImpulseTorqueNormalized = 0;
    let totalDragForceNormalized = 0;
    for (let paddleIndex = 0; paddleIndex < paddleCount;
      paddleIndex += 1) {
      const localAngle = sourcePosePaddleOffset
        + paddleIndex * FULL_TURN / paddleCount;
      const worldAngle = localAngle + wheelAngle;
      const radial = new THREE.Vector3(
        Math.cos(worldAngle),
        Math.sin(worldAngle),
        0,
      );
      const tangent = new THREE.Vector3(-radial.y, radial.x, 0);
      const center = radial.clone().multiplyScalar(paddleCenterRadius);
      const centerVelocity = tangent.clone().multiplyScalar(
        paddleCenterRadius * wheelAngularSpeed,
      );
      const centerAcceleration = tangent.clone().multiplyScalar(
        paddleCenterRadius * wheelAngularAcceleration,
      ).addScaledVector(
        radial,
        -paddleCenterRadius * wheelAngularSpeed ** 2,
      );
      const immersion = immersionAtPaddleCenterY(center.y);
      const relativeFlowSpeed = Math.max(
        0,
        flowSpeed - centerVelocity.x,
      );
      const dragForceX = dragCoefficientNormalized
        * immersion * relativeFlowSpeed ** 2;
      const impulseTorque = -center.y * dragForceX;
      totalDragForceNormalized += dragForceX;
      totalImpulseTorqueNormalized += impulseTorque;
      paddles.push({
        center,
        centerAcceleration,
        centerVelocity,
        dragForce: new THREE.Vector3(dragForceX, 0, 0),
        dragForceX,
        immersion,
        impulseTorque,
        index: paddleIndex,
        localAngle,
        radial,
        relativeFlowSpeed,
        tangent,
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
      .multiplyScalar(wheelRimRadius);
    const rimReferenceVelocity = rimReferenceTangent.clone()
      .multiplyScalar(wheelRimRadius * wheelAngularSpeed);
    const rimReferenceAcceleration = rimReferenceTangent.clone()
      .multiplyScalar(wheelRimRadius * wheelAngularAcceleration)
      .addScaledVector(
        rimReferenceRadial,
        -wheelRimRadius * wheelAngularSpeed ** 2,
      );
    return {
      inputAcceleration,
      inputAngle,
      inputSpeed,
      paddles,
      rimReferenceAcceleration,
      rimReferencePoint,
      rimReferenceVelocity,
      totalDragForceNormalized,
      totalImpulseTorqueNormalized,
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
    channelBottomY,
    cycleDuration,
    dragCoefficientNormalized,
    flowSpeed,
    hubRadius,
    inputAngularSpeed,
    paddleAxialWidth,
    paddleCenterRadius,
    paddleCount,
    paddleRadialLength,
    shaftRadius,
    sourcePosePaddleOffset,
    spokeCount,
    waterDepth,
    waterSurfaceY,
    wheelRimRadius,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.59,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.47,
  });
  const wheelMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.52,
  });
  const paddleMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.54,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.66,
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
    'counterclockwise-undershot-wheel-with-radial-float-boards';
  root.add(rotor);
  for (const face of [-1, 1]) {
    const z = face * paddleAxialWidth / 2;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(wheelRimRadius, 0.105, 10, 96),
      wheelMaterial,
    );
    rim.position.z = z;
    rim.userData.role = face < 0
      ? 'rear-undershot-wheel-rim'
      : 'front-undershot-wheel-rim';
    rotor.add(rim);
  }
  const hub = cylinderAlongZ(hubRadius, 1.25, wheelMaterial, 40);
  hub.userData.role = 'undershot-wheel-hub-fast-on-shaft';
  rotor.add(hub);
  for (let spokeIndex = 0; spokeIndex < spokeCount; spokeIndex += 1) {
    const angle = spokeIndex * FULL_TURN / spokeCount;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(2.26, 0.13, 0.26),
      wheelMaterial,
    );
    spoke.position.set(
      1.13 * Math.cos(angle),
      1.13 * Math.sin(angle),
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `undershot-wheel-spoke-${spokeIndex + 1}-of-eight`;
    rotor.add(spoke);
  }
  const paddleBoards = [];
  for (let paddleIndex = 0; paddleIndex < paddleCount;
    paddleIndex += 1) {
    const localAngle = sourcePosePaddleOffset
      + paddleIndex * FULL_TURN / paddleCount;
    const paddle = new THREE.Mesh(
      new THREE.BoxGeometry(
        paddleRadialLength,
        0.105,
        paddleAxialWidth,
      ),
      paddleMaterial,
    );
    paddle.position.set(
      paddleCenterRadius * Math.cos(localAngle),
      paddleCenterRadius * Math.sin(localAngle),
      0,
    );
    paddle.rotation.z = localAngle;
    paddle.userData.role =
      `radial-float-board-${paddleIndex + 1}-of-sixteen`;
    rotor.add(paddle);
    paddleBoards.push(paddle);
  }
  const rotationMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.57, 0.09, 0.10),
    whiteMaterial,
  );
  rotationMarker.position.set(0.27, 0, 0.68);
  rotationMarker.userData.role =
    'visible-counterclockwise-wheel-rotation-marker';
  rotor.add(rotationMarker);
  rotationMarker.visible = false; // Brown draws no index on the wheel.

  const shaft = cylinderAlongZ(shaftRadius, 1.68, darkMaterial, 36);
  shaft.userData.role = 'undershot-wheel-main-shaft-in-fixed-bearings';
  root.add(shaft);
  const bearingParts=wheelBearings(root,shaft,frameMaterial,-3.2);
  // The front pedestal stands beyond the race bed's front edge on its own
  // footing at bed level.
  const frontPedestalFooting = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.28, 0.56), frameMaterial);
  frontPedestalFooting.position.set(0, -3.34, 0.94);
  frontPedestalFooting.userData.role = 'front-bearing-pedestal-footing';
  root.add(frontPedestalFooting);

  // Pass 69 (p69-w1): Brown's section, not a flat box. The headwater stands
  // at axle level behind the sluice leaf, runs out beneath its lower edge and
  // drops down the curved apron into the tail race under the wheel, where the
  // tail surface lies well below the axle and the floats dip into it. The bed
  // is one extruded profile (flat head floor, curved apron, deeper tail floor)
  // and the water is one continuous extruded body over it: head pond, the
  // opening under the leaf and the tail race share one outline, so no water
  // stands on both sides of the leaf at one level and none leaks round it.
  const channelHalfWidth = 0.62;
  const headFloorY = -2.57;
  const headSurfaceY = -0.04;
  const gateX = -4.0;
  const gateHalfThickness = 0.29;
  const leafBottomY = -1.66;
  const leafTopY = 0.59;
  const raceLeftX = -6.0, raceRightX = 4.0;
  const apronStartX = -3.0, apronEndX = -1.2;
  const bedY = (x) => {
    if (x <= apronStartX) return headFloorY;
    if (x <= apronEndX) {
      const u = (x - apronStartX) / (apronEndX - apronStartX);
      return headFloorY + (channelBottomY - 0.52 - headFloorY) * (1 - Math.cos(Math.PI * u)) / 2;
    }
    return channelBottomY - 0.52 - 0.18 * (x - apronEndX) / (raceRightX - apronEndX);
  };
  const tailSurfaceY = (x) => {
    const x0 = gateX + gateHalfThickness, x1 = -1.3;
    if (x >= x1) return waterSurfaceY;
    const u = (x - x0) / (x1 - x0);
    return leafBottomY - 0.02 + (waterSurfaceY - leafBottomY + 0.02) * (1 - Math.cos(Math.PI * u)) / 2;
  };
  const sampleXs = (x0, x1, count) => Array.from({length: count + 1}, (_, i) => x0 + (x1 - x0) * i / count);
  const bedProfile = [
    ...sampleXs(raceLeftX, raceRightX, 72).map((x) => [x, bedY(x)]),
    [raceRightX, -4.32], [raceLeftX, -4.32],
  ];
  const channelBed = new THREE.Mesh(plate([[bedProfile.slice().reverse()]], -1.0, 1.0), frameMaterial);
  channelBed.userData.role = 'fixed-bottom-sluice-channel-bed';
  root.add(channelBed);
  const waterOutline = [
    ...sampleXs(raceLeftX, raceRightX, 72).map((x) => [x, bedY(x) + 0.004]),
    [raceRightX, waterSurfaceY],
    ...sampleXs(raceRightX, gateX + gateHalfThickness, 36).slice(1).map((x) => [x, tailSurfaceY(x)]),
    [gateX + gateHalfThickness, leafBottomY - 0.004],
    [gateX - gateHalfThickness, leafBottomY - 0.004],
    [gateX - gateHalfThickness, headSurfaceY],
    [raceLeftX, headSurfaceY],
  ];
  const channelWater = new THREE.Mesh(
    plate([[waterOutline]], -channelHalfWidth, channelHalfWidth),
    waterVolumeMaterial({opacity: 0.42}),
  );
  channelWater.renderOrder = 1;
  channelWater.userData.role =
    'left-to-right-lower-stream-driving-paddle-bottoms';
  root.add(channelWater);
  // The same water moving: one continuous guided sheet just under the free
  // surface, from the head pond, down through the opening under the leaf and
  // along the tail race past the dipping floats. Its streaks carry the flow.
  const streamPoints = [
    new THREE.Vector3(gateX - 0.9, leafBottomY - 0.3, 0),
    new THREE.Vector3(gateX, leafBottomY - 0.34, 0),
    ...sampleXs(gateX + 0.6, raceRightX - 0.08, 12).map((x) => new THREE.Vector3(x, tailSurfaceY(x) - 0.2, 0)),
  ];
  const flowSheet = new WaterStream(guidedPath(streamPoints, {
    speedAt: (u) => 1.2 + 3.4 * Math.min(1, u * 3), samples: 60,
  }), {
    width: channelHalfWidth - 0.03, thickness: 0.16, widthAxis: new THREE.Vector3(0, 0, 1),
    widthExponent: 0, fadeIn: 0.1, fadeOut: 0.05, cyclePeriod: cycleDuration, streakRate: 0.8, opacity: 0.32,
  });
  flowSheet.userData.role = 'flow-under-sluice-leaf-down-apron-to-tail-race';
  root.add(flowSheet);
  const updateWater = collectWaterStreams(root);

  // Sluice: Brown draws two slotted posts with the leaf sliding between them,
  // its lower edge raised to meter the flow, and the lifting screw rising in
  // the slot through a cap to the curved double handle. Each side of the race
  // carries a pair of posts (upstream and downstream of the leaf); the leaf's
  // edges run in the slot between them, which is why the leaf shows between
  // the posts in elevation.
  const postTopY = 4.0;
  const postWidth = 0.32;
  const gatePosts = [];
  for (const zSide of [-1, 1]) for (const xSide of [-1, 1]) {
    const x0 = gateX + xSide * (gateHalfThickness + 0.01), x1 = x0 + xSide * postWidth;
    const post = new THREE.Mesh(plate([[[[Math.min(x0, x1), headFloorY], [Math.max(x0, x1), headFloorY],
      [Math.max(x0, x1), postTopY], [Math.min(x0, x1), postTopY]]]], zSide < 0 ? -0.98 : channelHalfWidth,
    zSide < 0 ? -channelHalfWidth : 0.98), frameMaterial);
    post.userData.role = 'sluice-side-jamb';
    root.add(post);
    gatePosts.push(post);
  }
  const gateTower = new THREE.Mesh(plate([[[[gateX - 0.64, postTopY], [gateX + 0.64, postTopY],
    [gateX + 0.64, postTopY + 0.36], [gateX - 0.64, postTopY + 0.36]]]], -0.98, 0.98), frameMaterial);
  gateTower.userData.role = 'fixed-vertical-sluice-gate-frame';
  root.add(gateTower);
  const gateLeaf = new THREE.Mesh(plate([[[[gateX - gateHalfThickness, leafBottomY], [gateX + gateHalfThickness, leafBottomY],
    [gateX + gateHalfThickness, leafTopY], [gateX - gateHalfThickness, leafTopY]]]], -0.97, 0.97),
  matte(PALETTE.muted, {metalness: 0.12, roughness: 0.6}));
  gateLeaf.userData.role = 'raised-sluice-gate-metering-bottom-flow';
  root.add(gateLeaf);
  const gateScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.02 - leafTopY, 20), darkMaterial);
  gateScrew.position.set(gateX, (5.02 + leafTopY) / 2, 0);
  gateScrew.userData.role = 'vertical-sluice-gate-lifting-screw';
  root.add(gateScrew);
  const handleY = postTopY + 0.5;
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.26, 32), paddleMaterial);
  nut.position.set(gateX, postTopY + 0.49, 0);
  nut.userData.role = 'sluice-handle-nut-on-lifting-screw';
  root.add(nut);
  const handleCurve = new THREE.CatmullRomCurve3([
    [-1.95, 0.62], [-1.55, 0.72], [-1.1, 0.52], [-0.6, 0.2], [-0.25, 0.02],
    [0.25, 0.02], [0.6, 0.2], [1.1, 0.52], [1.55, 0.72], [1.95, 0.62],
  ].map(([x, y]) => new THREE.Vector3(gateX + x * 0.9, handleY - 0.02 + y * 0.9, 0)), false, 'centripetal');
  const gateHandle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 64, 0.075, 12, false), paddleMaterial);
  gateHandle.userData.role = 'sluice-gate-handwheel-cross-handle';
  root.add(gateHandle);
  for (const side of [-1, 1]) {
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 20, 12),
      paddleMaterial,
    );
    knob.position.copy(handleCurve.getPoint(side < 0 ? 0 : 1));
    knob.userData.role = `sluice-handle-${side < 0 ? 'left' : 'right'}-knob`;
    root.add(knob);
  }

  const flowMarkers = [];
  for (let markerIndex = 0; markerIndex < 10; markerIndex += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.10, 18, 12),
      paleWaterMaterial,
    );
    marker.userData.role = `bottom-stream-flow-marker-${markerIndex + 1}`;
    root.add(marker);
    flowMarkers.push(marker);
  }

  const impulseIndicators = [];
  for (let indicatorIndex = 0; indicatorIndex < 3;
    indicatorIndex += 1) {
    const indicator = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 18, 12),
      whiteMaterial,
    );
    indicator.userData.role =
      `submerged-paddle-impulse-indicator-${indicatorIndex + 1}`;
    root.add(indicator);
    impulseIndicators.push(indicator);
  }

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.z = state.wheelAngle;
    updateWater(time);
    const flowPhase = THREE.MathUtils.euclideanModulo(time / 1.18, 1);
    for (let markerIndex = 0; markerIndex < flowMarkers.length;
      markerIndex += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        flowPhase + markerIndex / flowMarkers.length,
        1,
      );
      flowMarkers[markerIndex].position.set(
        -4.20 + progress * 8.40,
        waterSurfaceY - 0.22 - 0.10 * Math.sin(progress * Math.PI),
        0.76,
      );
      const endFade = Math.min(progress / 0.06, (1 - progress) / 0.06, 1);
      flowMarkers[markerIndex].scale.setScalar(0.38 + 0.62 * endFade);
    }
    const activePaddles = [...state.paddles]
      .sort((left, right) => right.immersion - left.immersion)
      .slice(0, impulseIndicators.length);
    for (let index = 0; index < impulseIndicators.length; index += 1) {
      const paddle = activePaddles[index];
      impulseIndicators[index].position.copy(paddle.center);
      impulseIndicators[index].position.z = 0.76;
      impulseIndicators[index].scale.setScalar(
        0.40 + 0.60 * paddle.immersion,
      );
    }
  };

  const sourceState = stateAtInputAngle(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 6,
    },
    archetype:
      'undershot-water-wheel-with-bottom-stream-impulse-on-radial-float-boards-turning-counterclockwise',
    blocks: {
      ...bearingParts,
      channelBed,
      channelWater,
      gateHandle,
      gateLeaf,
      gateScrew,
      gateTower,
      hub,
      flowMarkers,
      impulseIndicators,
      paddleBoards,
      rotationMarker,
      rotor,
      shaft,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      paddleImpulseIndependent: false,
      sluiceGateOpeningAnimated: false,
    },
    dynamics: {
      dragModel:
        'The diagnostic stream force is proportional to smooth paddle immersion and the square of positive stream speed relative to the paddle’s horizontal velocity.',
      fluidPressureViscosityTurbulenceSplashLeakageImpactBearingFrictionWheelInertiaGeneratorLoadAndSpeedResponseModeled:
        false,
      impulseTorqueDiagnostic:
        'Each submerged radial float receives a downstream +x force, and its exact moment -y*F_x about the shaft is summed. Wheel speed is prescribed rather than dynamically integrated.',
    },
    fidelity: 'authored',
    geometry,
    immersionAtPaddleCenterY,
    mechanism:
      'A raised sluice gate admits a shallow left-to-right stream beneath the wheel. The stream strikes only the immersed radial float-boards below the shaft. Downstream force on those lower paddles produces positive, counterclockwise torque, matching Brown’s arrow at the wheel crown. The paddles, eight spokes, rims, hub, and marker form one rigid rotor; unlike the overshot wheel, no water is carried in buckets around the descending side.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      paddlePitch: FULL_TURN / paddleCount,
      wheelDirection: 'counterclockwise',
      wheelRevolutionsPerCycle: 1,
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 431 page provides Brown’s static engraving and two-word caption but contains no Canvas construction or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      paddles: sourceState.paddles.map((paddle) => ({
        center: paddle.center.clone(),
        immersion: paddle.immersion,
        worldAngle: paddle.worldAngle,
      })),
      totalImpulseTorqueNormalized:
        sourceState.totalImpulseTorqueNormalized,
      wheelAngle: sourceState.wheelAngle,
    },
    sourceReference: {
      brownPlate431: {
        approximateFloatBoardCount: 16,
        approximateRimRadiusPixels: 116,
        approximateSpokeCount: 8,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 14,
        shaftApproximateCenterPixels: [345, 302],
        sluiceGateApproximateCenterPixels: [153, 303],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the mechanism is an undershot water-wheel',
        ],
        engravingEvidence:
          'Brown’s engraving shows a vertical lifting sluice at left, a shallow left-to-right stream below the axle, radial float-boards projecting beyond the rim, eight spokes, and a leftward crown arrow that denotes counterclockwise rotation.',
        reconstructionDisclosure:
          'Brown gives no dimensions, exact float count, float width, gate opening, flow rate or speed, water depth, rotational speed, materials, drag law, efficiency, losses, bearing friction, inertia, or load. Sixteen equal floats, dimensions, water speed, smooth immersion law, normalized drag diagnostic, colors, axial construction, and six-second demonstration cycle are independently engineered; the undershot topology, bottom stream, sluice, counterclockwise direction, and eight visible spokes are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 431',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      impulseTorque:
        'tau_z=sum(-paddleCenter.y*dragForceX)>0',
      paddleAttachment:
        'paddleWorldAngle=paddleLocalAngle+wheelAngle',
      relativeStreamSpeed:
        'max(0,waterFlowSpeed-paddleCenterVelocity.x)',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-6.0, -4.32, -1.08),
    new THREE.Vector3(4.0, 5.1, 1.08),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(5.1, 3.7, 12.0);
  root.userData.groundFloorY = -4.32;
  root.userData.hideGround=true;
  root.userData.solidReview={qualification:'Finite supports and water-path geometry; water is a prescribed visual envelope. No free-surface flow, sealing, energy balance or speed response is solved.'};
  root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])material.fog=false;});
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
  markShadows(root);
  channelBed.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredUndershotWaterWheelMovement(movement) {
  if (movement.id !== 431) return null;
  return undershotWaterWheel(movement);
}
