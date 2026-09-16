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

  const shaft = cylinderAlongZ(shaftRadius, 1.68, darkMaterial, 36);
  shaft.userData.role = 'undershot-wheel-main-shaft-in-fixed-bearings';
  root.add(shaft);
  const bearingParts=wheelBearings(root,shaft,frameMaterial,-3.2);

  const channelBed = new THREE.Mesh(
    new THREE.BoxGeometry(9.05, 0.28, 1.72),
    frameMaterial,
  );
  channelBed.position.set(0, channelBottomY - 0.16, -0.25);
  channelBed.userData.role = 'fixed-bottom-sluice-channel-bed';
  root.add(channelBed);
  const channelWater = new THREE.Mesh(
    new THREE.BoxGeometry(8.90, waterDepth, 1.22),
    waterMaterial,
  );
  channelWater.position.set(
    0,
    (waterSurfaceY + channelBottomY) / 2,
    0.05,
  );
  channelWater.userData.role =
    'left-to-right-lower-stream-driving-paddle-bottoms';
  root.add(channelWater);

  const gateTower = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 5.74, 1.42),
    frameMaterial,
  );
  gateTower.position.set(-3.62, -0.25, -0.20);
  gateTower.userData.role = 'fixed-vertical-sluice-gate-frame';
  gateTower.geometry.dispose();gateTower.geometry=plate(polygonClipping.difference(poly([[-.31,-2.87],[.31,-2.87],[.31,2.87],[-.31,2.87]]),poly([[-.4,-2.86],[.4,-2.86],[.4,2.4],[-.4,2.4]])),-.71,.71);
  root.add(gateTower);
  for(const z of[-.86,.86]){const jamb=new THREE.Mesh(new THREE.BoxGeometry(.62,5.74,.18),frameMaterial);jamb.position.set(-3.62,-.25,z);jamb.userData.role='sluice-side-jamb';root.add(jamb);}
  const gateLeaf = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 1.42, 1.12),
    darkMaterial,
  );
  gateLeaf.position.set(-3.61, -1.26, 0.02);
  gateLeaf.userData.role = 'raised-sluice-gate-metering-bottom-flow';
  root.add(gateLeaf);
  const gateScrew = cylinderAlongZ(0.10, 3.28, darkMaterial, 20);
  gateScrew.rotation.set(0, 0, 0);
  gateScrew.position.set(-3.61, 1.19, 0.55);
  gateScrew.userData.role = 'vertical-sluice-gate-lifting-screw';
  root.add(gateScrew);
  const gateHandle = new THREE.Mesh(
    new THREE.BoxGeometry(1.38, 0.11, 0.11),
    paddleMaterial,
  );
  gateHandle.position.set(-3.61, 2.67, 0.56);
  gateHandle.userData.role = 'sluice-gate-handwheel-cross-handle';
  root.add(gateHandle);
  for (const side of [-1, 1]) {
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 20, 12),
      paddleMaterial,
    );
    knob.position.set(-3.61 + side * 0.68, 2.67, 0.56);
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
    new THREE.Vector3(-4.62, -3.56, -1.08),
    new THREE.Vector3(4.62, 3.02, 1.50),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(5.1, 3.7, 12.0);
  root.userData.groundFloorY = -3.56;
  root.userData.hideGround=true;
  root.userData.solidReview={qualification:'Finite supports and water-path geometry; water is a prescribed visual envelope. No free-surface flow, sealing, energy balance or speed response is solved.'};
  root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])material.fog=false;});
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
