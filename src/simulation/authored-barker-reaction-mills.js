import * as THREE from 'three';
import {horizontalRing,horizontalPlate,horizontalVane,horizontalTurned} from './horizontal-turbine-solids.js';
import {poly,circle,polygonClipping,rotate} from './finite-plate-geometry.js';
import {mergePassageParts,curvedPipeWall} from './finite-fluid-passages.js';
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

function makeTube(curve, radius, material, role) {
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 64, radius, 10, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function boxBetween(start, end, width, height, material, role) {
  const direction = end.clone().sub(start);
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(direction.length(), height, width),
    material,
  );
  box.position.copy(start).add(end).multiplyScalar(0.5);
  box.quaternion.setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    direction.normalize(),
  );
  box.userData.role = role;
  return box;
}

function barkerReactionMill(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const armCount = 4;
  const armPitch = FULL_TURN / armCount;
  const armRadius = 2.42;
  const armHeight = 0.10;
  const nozzleTangentialOffset = 0.30;
  const sourcePoseArmOffset = Math.PI / 4;
  const shaftRadius = 0.30;
  const shaftLength = 4.55;
  const shaftCenterY = 1.74;
  const relativeJetSpeed = 5.0;
  const massFlowPerNozzleNormalized = 0.25;
  const jetVisibleLength = 1.30;
  const jetDrop = 0.82;

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const runnerAngle = -inputAngle;
    const runnerAngularSpeed = -inputSpeed;
    const runnerAngularAcceleration = -inputAcceleration;
    const nozzles = [];
    let totalReactionTorqueNormalized = 0;
    for (let armIndex = 0; armIndex < armCount; armIndex += 1) {
      const localAngle = sourcePoseArmOffset + armIndex * armPitch;
      const worldAngle = localAngle + runnerAngle;
      const radial = horizontalRadial(worldAngle);
      const tangent = horizontalTangent(worldAngle);
      const nozzlePoint = radial.clone().multiplyScalar(armRadius)
        .addScaledVector(tangent, nozzleTangentialOffset);
      nozzlePoint.y = armHeight;
      const angleDerivative = tangent.clone().multiplyScalar(armRadius)
        .addScaledVector(radial, -nozzleTangentialOffset);
      const nozzleVelocity = angleDerivative.clone()
        .multiplyScalar(runnerAngularSpeed);
      const nozzleAcceleration = angleDerivative.clone()
        .multiplyScalar(runnerAngularAcceleration)
        .addScaledVector(
          new THREE.Vector3(nozzlePoint.x, 0, nozzlePoint.z),
          -(runnerAngularSpeed ** 2),
        );
      const relativeJetVelocity = tangent.clone()
        .multiplyScalar(relativeJetSpeed);
      const absoluteJetVelocity = nozzleVelocity.clone()
        .add(relativeJetVelocity);
      const reactionForce = relativeJetVelocity.clone()
        .multiplyScalar(-massFlowPerNozzleNormalized);
      const reactionTorque = new THREE.Vector3()
        .crossVectors(nozzlePoint, reactionForce).y;
      totalReactionTorqueNormalized += reactionTorque;
      nozzles.push({
        absoluteJetVelocity,
        angleDerivative,
        index: armIndex,
        jetDirection: tangent.clone(),
        localAngle,
        nozzleAcceleration,
        nozzlePoint,
        nozzleVelocity,
        radial,
        reactionForce,
        reactionTorque,
        relativeJetVelocity,
        tangent,
        worldAngle,
      });
    }
    const shaftReferenceRadial = horizontalRadial(runnerAngle);
    const shaftReferenceTangent = horizontalTangent(runnerAngle);
    const shaftReferencePoint = shaftReferenceRadial.clone()
      .multiplyScalar(shaftRadius);
    shaftReferencePoint.y = shaftCenterY + shaftLength / 2 - 0.32;
    const shaftReferenceVelocity = shaftReferenceTangent.clone()
      .multiplyScalar(shaftRadius * runnerAngularSpeed);
    const shaftReferenceAcceleration = shaftReferenceTangent.clone()
      .multiplyScalar(shaftRadius * runnerAngularAcceleration)
      .addScaledVector(
        shaftReferenceRadial,
        -shaftRadius * runnerAngularSpeed ** 2,
      );
    return {
      inputAcceleration,
      inputAngle,
      inputSpeed,
      nozzles,
      runnerAngle,
      runnerAngularAcceleration,
      runnerAngularSpeed,
      shaftReferenceAcceleration,
      shaftReferencePoint,
      shaftReferenceVelocity,
      totalReactionTorqueNormalized,
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
    armCount,
    armHeight,
    armPitch,
    armRadius,
    cycleDuration,
    inputAngularSpeed,
    jetDrop,
    jetVisibleLength,
    massFlowPerNozzleNormalized,
    nozzleTangentialOffset,
    relativeJetSpeed,
    shaftCenterY,
    shaftLength,
    shaftRadius,
    sourcePoseArmOffset,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.59,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.31,
    roughness: 0.46,
  });
  const runnerMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    roughness: 0.47,
  });
  const nozzleMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.49,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.67,
    roughness: 0.31,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const paleWaterMaterial = matte(0x75c7d7, {
    opacity: 0.52,
    roughness: 0.29,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const runner = new THREE.Group();
  runner.userData.role =
    'reaction-mill-runner-rotating-opposite-four-exhaust-jets';
  root.add(runner);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 40),
    runnerMaterial,
  );
  const shaftPorts=Array.from({length:armCount},(_,i)=>poly([[0,-.09],[.40,-.09],[.40,.09],[0,.09]].map(p=>rotate(p,sourcePoseArmOffset+i*armPitch))));
  const portSection=polygonClipping.difference(polygonClipping.difference(poly(circle([0,0],shaftRadius)),poly(circle([0,0],.20))),...shaftPorts);
  shaft.geometry.dispose();shaft.geometry=mergePassageParts([horizontalRing(.20,shaftRadius,-shaftLength/2,armHeight-shaftCenterY-.09),horizontalPlate(portSection,armHeight-shaftCenterY-.09,armHeight-shaftCenterY+.09),horizontalRing(.20,shaftRadius,armHeight-shaftCenterY+.09,shaftLength/2)]);
  shaft.position.y = shaftCenterY;
  shaft.userData.role = 'central-rotating-hollow-water-supply-shaft';
  runner.add(shaft);
  const shaftWater = new THREE.Mesh(
    new THREE.CylinderGeometry(
      shaftRadius * 0.58,
      shaftRadius * 0.58,
      shaftLength - 0.42,
      32,
    ),
    waterMaterial,
  );
  shaftWater.position.y = shaftCenterY;
  shaftWater.userData.role = 'water-column-inside-hollow-rotating-shaft';
  runner.add(shaftWater);
  const lowerShaftCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.34, 0.70, 36),
    runnerMaterial,
  );
  lowerShaftCone.position.y = -0.86;
  lowerShaftCone.rotation.z = Math.PI;
  lowerShaftCone.userData.role = 'closed-lower-end-of-hollow-shaft';
  runner.add(lowerShaftCone);

  const armPipes = [];
  const nozzleCollars = [];
  for (let armIndex = 0; armIndex < armCount; armIndex += 1) {
    const angle = sourcePoseArmOffset + armIndex * armPitch;
    const radial = horizontalRadial(angle);
    const tangent = horizontalTangent(angle);
    const points = [
      radial.clone().multiplyScalar(shaftRadius * 0.62)
        .add(new THREE.Vector3(0, armHeight, 0)),
      radial.clone().multiplyScalar(1.42)
        .add(new THREE.Vector3(0, armHeight, 0)),
      radial.clone().multiplyScalar(armRadius)
        .addScaledVector(tangent, 0.05)
        .add(new THREE.Vector3(0, armHeight, 0)),
      radial.clone().multiplyScalar(armRadius)
        .addScaledVector(tangent, nozzleTangentialOffset)
        .add(new THREE.Vector3(0, armHeight, 0)),
    ];
    const curve = new THREE.CatmullRomCurve3(
      points,
      false,
      'centripetal',
    );
    const arm = makeTube(
      curve,
      0.13,
      runnerMaterial,
      `hollow-radial-arm-with-bent-nozzle-${armIndex + 1}-of-four`,
    );
    arm.geometry.dispose();arm.geometry=curvedPipeWall(curve,.085,.13);
    runner.add(arm);
    armPipes.push(arm);
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.045, 8, 28),
      nozzleMaterial,
    );
    collar.position.copy(points.at(-1));
    collar.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),tangent);
    collar.userData.role =
      `tangential-outlet-collar-${armIndex + 1}-of-four`;
    runner.add(collar);
    nozzleCollars.push(collar);
  }
  const rotationMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.74, 0.10, 0.12),
    whiteMaterial,
  );
  rotationMarker.position.set(0.42, 3.14, 0);
  rotationMarker.userData.role =
    'visible-reaction-mill-shaft-rotation-marker';
  runner.add(rotationMarker);

  const inletHopper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.84, 0.28, 0.76, 44, 1, true),
    frameMaterial,
  );
  inletHopper.geometry.dispose();inletHopper.geometry=horizontalTurned([[-.38,.304],[-.38,.36],[.38,.84],[.38,.78]]);
  inletHopper.position.y = 4.04;
  inletHopper.userData.role =
    'fixed-open-hopper-feeding-central-hollow-shaft';
  root.add(inletHopper);
  const inletWaterBowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.70, 0.24, 0.46, 40, 1, true),
    waterMaterial,
  );
  inletWaterBowl.position.y = 4.05;
  inletWaterBowl.userData.role = 'water-in-fixed-inlet-hopper';
  root.add(inletWaterBowl);
  const upperBearing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.34, 40),
    frameMaterial,
  );
  upperBearing.geometry.dispose();upperBearing.geometry=horizontalRing(shaftRadius+.004,.45,-.17,.17);
  upperBearing.position.y = 3.54;
  upperBearing.userData.role = 'fixed-upper-bearing-around-hollow-shaft';
  root.add(upperBearing);
  const lowerBearing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.32, 36),
    frameMaterial,
  );
  lowerBearing.geometry.dispose();lowerBearing.geometry=horizontalTurned([[-.16,0],[-.16,.42],[.16,.42],[.16,.10],[-.032,0]]);
  lowerBearing.position.y = -1.18;
  lowerBearing.userData.role = 'fixed-lower-bearing-below-reaction-arms';
  root.add(lowerBearing);

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 6.18, 1.64),
    frameMaterial,
  );
  wall.position.set(3.58, 1.65, -0.48);
  wall.userData.role = 'fixed-wall-support-for-reaction-mill-bearing';
  root.add(wall);
  const bearingBracket = new THREE.Mesh(
    new THREE.BoxGeometry(3.36, 0.18, 0.40),
    frameMaterial,
  );
  bearingBracket.geometry.dispose();bearingBracket.geometry=horizontalPlate(polygonClipping.difference(poly([[-1.68,-.20],[1.68,-.20],[1.68,.20],[-1.68,.20]]),poly(circle([-1.76,-.32],shaftRadius+.004,128))),-.09,.09);
  bearingBracket.position.set(1.76, 3.54, -0.32);
  bearingBracket.userData.role = 'fixed-horizontal-upper-bearing-bracket';
  root.add(bearingBracket);
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(7.72, 0.24, 6.72),
    frameMaterial,
  );
  foundation.position.set(0, -1.52, -0.16);
  foundation.userData.role = 'fixed-reaction-mill-foundation';
  root.add(foundation);
  const catchBasin = new THREE.Mesh(
    new THREE.CylinderGeometry(3.18, 3.18, 0.18, 80),
    waterMaterial,
  );
  catchBasin.position.y = -1.35;
  catchBasin.userData.role = 'basin-receiving-four-tangential-exhaust-jets';
  root.add(catchBasin);

  const flumeStart = new THREE.Vector3(3.54, 5.42, 0.28);
  const flumeEnd = new THREE.Vector3(0.52, 4.58, 0.10);
  const inletFlume = boxBetween(
    flumeStart,
    flumeEnd,
    0.78,
    0.20,
    frameMaterial,
    'fixed-elevated-flume-pouring-into-hopper',
  );
  root.add(inletFlume);
  const inletStreamCurve = new THREE.QuadraticBezierCurve3(
    flumeEnd,
    new THREE.Vector3(0.32, 4.42, 0.08),
    new THREE.Vector3(0, 4.13, 0),
  );
  const inletStream = makeTube(
    inletStreamCurve,
    0.13,
    waterMaterial,
    'water-falling-from-flume-into-shaft-hopper',
  );
  root.add(inletStream);
  const inletMarkers = [];
  for (let markerIndex = 0; markerIndex < 5; markerIndex += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 16, 11),
      paleWaterMaterial,
    );
    marker.userData.role = `inlet-water-marker-${markerIndex + 1}`;
    root.add(marker);
    inletMarkers.push(marker);
  }

  const jetMarkers = [];
  const markersPerJet = 6;
  for (let armIndex = 0; armIndex < armCount; armIndex += 1) {
    for (let markerIndex = 0; markerIndex < markersPerJet;
      markerIndex += 1) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.082, 16, 11),
        paleWaterMaterial,
      );
      marker.userData.role =
        `tangential-exhaust-marker-arm-${armIndex + 1}-particle-${markerIndex + 1}`;
      root.add(marker);
      jetMarkers.push({ armIndex, marker, markerIndex });
    }
  }

  const update = (time) => {
    const state = stateAtTime(time);
    runner.rotation.y = state.runnerAngle;
    const inletPhase = THREE.MathUtils.euclideanModulo(time / 0.68, 1);
    for (let markerIndex = 0; markerIndex < inletMarkers.length;
      markerIndex += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        inletPhase + markerIndex / inletMarkers.length,
        1,
      );
      inletMarkers[markerIndex].position.copy(
        inletStreamCurve.getPoint(progress),
      );
      const endpointFade = Math.sin(Math.PI * progress);
      inletMarkers[markerIndex].scale.setScalar(
        Math.sqrt(Math.max(0, endpointFade)),
      );
    }
    const jetPhase = THREE.MathUtils.euclideanModulo(time / 0.74, 1);
    for (const entry of jetMarkers) {
      const progress = THREE.MathUtils.euclideanModulo(
        jetPhase + entry.markerIndex / markersPerJet,
        1,
      );
      const nozzle = state.nozzles[entry.armIndex];
      entry.marker.position.copy(nozzle.nozzlePoint)
        .addScaledVector(
          nozzle.jetDirection,
          jetVisibleLength * progress,
        );
      entry.marker.position.y -= jetDrop * progress ** 2;
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
      'barker-reaction-mill-with-four-tangential-nozzles-fed-through-central-hollow-shaft-rotating-opposite-exhaust',
    blocks: {
      armPipes,
      bearingBracket,
      catchBasin,
      foundation,
      inletFlume,
      inletHopper,
      inletMarkers,
      inletStream,
      inletWaterBowl,
      jetMarkers: jetMarkers.map(({ marker }) => marker),
      lowerBearing,
      lowerShaftCone,
      nozzleCollars,
      rotationMarker,
      runner,
      shaft,
      shaftWater,
      upperBearing,
      wall,
    },
    degreesOfFreedom: {
      armAndShaftIndependent: false,
      independentPrescribedInputs: 1,
      jetFlowIndependent: false,
      operatingDegreesOfFreedom: 1,
    },
    dynamics: {
      fluidPressureViscosityTurbulenceLeakageNozzleLossBearingFrictionRunnerInertiaLoadAndSpeedResponseModeled:
        false,
      markerContinuity:
        'Each exhaust marker follows a smooth quasi-steady tangent-plus-gravity path from its current moving nozzle and fades to zero at the recycling endpoint.',
      reactionDiagnostic:
        'At each nozzle the normalized reaction force is exactly minus mass flow times the water velocity relative to that nozzle. All four exact moments about y are equal, negative, and additive; prescribed runner speed is not dynamically integrated.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'A fixed flume supplies a hopper over the central hollow shaft. Water descends inside the rotating shaft, divides equally among four hollow radial arms, follows each bent end, and escapes tangentially from four equally handed nozzles. Every nozzle reaction is opposite its local exhaust direction, so the four moments reinforce and rotate the shaft and arm assembly in the reverse, clockwise direction. The shaft, arms, collars, closed lower cone, internal water column, and marker are one rigid runner; the hopper, inlet, bearings, bracket, wall, and catch basin remain fixed.',
    motion: {
      armPitch,
      cycleDuration,
      exhaustDirectionRelativeToRunner: 'opposite',
      inputAngularSpeed,
      runnerDirectionViewedFromAbove: 'clockwise',
      runnerRevolutionsPerCycle: 1,
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 438 page provides Brown’s static engraving and caption but contains no Canvas construction or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      nozzles: sourceState.nozzles.map((nozzle) => ({
        jetDirection: nozzle.jetDirection.clone(),
        nozzlePoint: nozzle.nozzlePoint.clone(),
        worldAngle: nozzle.worldAngle,
      })),
      runnerAngle: sourceState.runnerAngle,
      totalReactionTorqueNormalized:
        sourceState.totalReactionTorqueNormalized,
    },
    sourceReference: {
      brownPlate438: {
        approximateArmCount: 4,
        approximateHopperCenterPixels: [222, 124],
        approximateNozzlePixels: [
          [64, 368],
          [111, 449],
          [316, 347],
          [396, 415],
        ],
        approximateShaftCenterXPixels: 216,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the mechanism is Barker’s or reaction mill',
          'the central shaft is hollow',
          'water escapes at the ends of the arms',
          'rotation is opposite the direction of escape',
        ],
        engravingEvidence:
          'Brown’s perspective engraving shows an elevated flume feeding an open hopper atop a vertical hollow shaft, four curved radial outlet arms with visible terminal jets, upper and lower shaft support, and a wall-mounted bearing bracket.',
        reconstructionDisclosure:
          'Brown gives no dimensions, bore, exact arm levels, nozzle diameter or angle, flow rate, head, jet speed, rotational speed, materials, losses, bearing friction, inertia, or load. Four equally spaced coplanar arms, tangent bends, velocities, equal normalized flow split, clockwise handedness, dimensions, colors, basin, and a six-second cycle are independently engineered; the hollow central shaft, water supply, arm-end exhaust, reaction drive, and opposite rotation are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 438',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      equalFlowSplit:
        'each of four nozzles receives one quarter of normalized mass flow',
      reactionTorque:
        'tau_y=sum(cross(nozzlePoint,-massFlowPerNozzle*relativeJetVelocity).y)<0',
      reverseDirection:
        'relative jet direction is positive local tangent while runner angular velocity is negative about y',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.16, -1.80, -3.66),
    new THREE.Vector3(4.36, 5.70, 3.66),
  );
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraDirection = new THREE.Vector3(6.2, 4.6, 10.6);
  root.userData.groundFloorY = -1.80;
  root.userData.hideGround=true;
  root.userData.solidReview={qualification:'Finite working passages and shaft supports; water paths, nozzle flow and torque remain prescribed illustrations, without pressure, leakage, efficiency or load-response validation.'};
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

export function createAuthoredBarkerReactionMillMovement(movement) {
  if (movement.id !== 438) return null;
  return barkerReactionMill(movement);
}
