import * as THREE from 'three';
import {
  PALETTE,
  makePulley,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

import {boredJournal, fitPistonGuide} from './piston-guide-parts.js';
import {makeBoredLinkRod} from './bored-link-rod.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function beamBetween(start, end, width, depth, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(delta.y, delta.x);
  return beam;
}

function updateCylinderBetween(cylinder, start, end) {
  const delta = end.clone().sub(start);
  const length = delta.length();
  cylinder.position.copy(start).add(end).multiplyScalar(0.5);
  cylinder.quaternion.setFromUnitVectors(
    Y_AXIS,
    delta.clone().multiplyScalar(1 / length),
  );
  cylinder.scale.set(1, length, 1);
}

function makeTubeThrough(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, points.length * 3, radius, 10, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function makeSegmentedBand(segmentCount, radius, material, role) {
  const band = new THREE.Group();
  band.userData.isBelt = true;
  band.userData.role = role;
  band.userData.segmentCount = segmentCount;
  const segments = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const segment = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 1, 10),
      material,
    );
    segment.userData.role = `${role}-flexible-segment`;
    band.add(segment);
    segments.push(segment);
  }
  band.userData.setPoints = (points) => {
    for (let index = 0; index < segmentCount; index += 1) {
      updateCylinderBetween(segments[index], points[index], points[index + 1]);
    }
  };
  return band;
}

function transformCradlePoint(localPoint, center, angle, z) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector3(
    center.x + localPoint.x * cosine - localPoint.y * sine,
    center.y + localPoint.x * sine + localPoint.y * cosine,
    z,
  );
}

function upperTangentPoint(point, center, radius, z) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const distanceSquared = dx ** 2 + dy ** 2;
  const baseScale = radius ** 2 / distanceSquared;
  const offsetScale = radius
    * Math.sqrt(distanceSquared - radius ** 2)
    / distanceSquared;
  const baseX = center.x + baseScale * dx;
  const baseY = center.y + baseScale * dy;
  const candidateA = new THREE.Vector3(
    baseX - offsetScale * dy,
    baseY + offsetScale * dx,
    z,
  );
  const candidateB = new THREE.Vector3(
    baseX + offsetScale * dy,
    baseY - offsetScale * dx,
    z,
  );
  return candidateA.y > candidateB.y ? candidateA : candidateB;
}

function sampleLeftBand(anchor, tangent, center, radius, segmentCount) {
  const tangentAngle = Math.atan2(
    tangent.y - center.y,
    tangent.x - center.x,
  );
  const topAngle = Math.PI / 2;
  const straightLength = anchor.distanceTo(tangent);
  const arcLength = radius * Math.abs(tangentAngle - topAngle);
  const totalLength = straightLength + arcLength;
  const points = [];
  for (let index = 0; index <= segmentCount; index += 1) {
    const pathDistance = totalLength * index / segmentCount;
    if (pathDistance <= straightLength) {
      points.push(anchor.clone().lerp(
        tangent,
        pathDistance / straightLength,
      ));
    } else {
      const angle = tangentAngle
        + Math.sign(topAngle-tangentAngle)*(pathDistance - straightLength) / radius;
      points.push(new THREE.Vector3(
        center.x + radius * Math.cos(angle),
        center.y + radius * Math.sin(angle),
        anchor.z,
      ));
    }
  }
  return points;
}

function sampleRightBand(tangent, anchor, center, radius, segmentCount) {
  const tangentAngle = Math.atan2(
    tangent.y - center.y,
    tangent.x - center.x,
  );
  const topAngle = Math.PI / 2;
  const arcLength = radius * Math.abs(topAngle - tangentAngle);
  const straightLength = tangent.distanceTo(anchor);
  const totalLength = arcLength + straightLength;
  const points = [];
  for (let index = 0; index <= segmentCount; index += 1) {
    const pathDistance = totalLength * index / segmentCount;
    if (pathDistance <= arcLength) {
      const angle = topAngle + Math.sign(tangentAngle-topAngle)*pathDistance / radius;
      points.push(new THREE.Vector3(
        center.x + radius * Math.cos(angle),
        center.y + radius * Math.sin(angle),
        anchor.z,
      ));
    } else {
      points.push(tangent.clone().lerp(
        anchor,
        (pathDistance - arcLength) / straightLength,
      ));
    }
  }
  return points;
}

function selfRockingCradle(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const inputCenter = new THREE.Vector3(0, -1.02, 0.42);
  const outputCenter = new THREE.Vector3(0, 1.15, 0.42);
  const groundPivotDistance = outputCenter.y - inputCenter.y;
  const inputCrankRadius = 0.37;
  const outputPinRadius = 0.94;
  const outputWheelRadius = 1.18;
  const outerDeadCenterDistance = Math.hypot(
    groundPivotDistance,
    outputPinRadius,
  );
  const connectingRodLength = outerDeadCenterDistance - inputCrankRadius;
  const sourceInputAngle = Math.atan2(
    groundPivotDistance,
    outputPinRadius,
  );
  const outputMaximumAngle = 0;
  const outputMinimumAngle = Math.asin((
    (connectingRodLength - inputCrankRadius) ** 2
      - groundPivotDistance ** 2
      - outputPinRadius ** 2
  ) / (2 * groundPivotDistance * outputPinRadius));
  const outputCenterAngle = (
    outputMinimumAngle + outputMaximumAngle
  ) / 2;
  const innerDeadCenterInputAngle = Math.atan2(
    groundPivotDistance
      + outputPinRadius * Math.sin(outputMinimumAngle),
    outputPinRadius * Math.cos(outputMinimumAngle),
  ) + Math.PI;
  const outputAngularStroke = outputMaximumAngle - outputMinimumAngle;
  const cradleAngularAmplitude = THREE.MathUtils.degToRad(6);
  const cradlePerOutputRatio = 2 * cradleAngularAmplitude
    / outputAngularStroke;
  const bandPitchRadius = outputWheelRadius + .042;
  const cradleBandEffectiveRadius = bandPitchRadius
    / cradlePerOutputRatio;
  const rockerRollRadius = 3.68;
  const rockerTubeRadius = .13;
  const groundY = -2.60;
  const cradleCenterY = groundY + rockerRollRadius;
  const bandZ = .42;
  const leftPostLocal = new THREE.Vector2(-2.02, 1.05);
  const rightPostLocal = new THREE.Vector2(2.02, 1.05);

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const inputRadial = new THREE.Vector3(
      Math.cos(inputAngle),
      Math.sin(inputAngle),
      0,
    );
    const inputTangent = new THREE.Vector3(
      -inputRadial.y,
      inputRadial.x,
      0,
    );
    const inputPin = inputCenter.clone().addScaledVector(
      inputRadial,
      inputCrankRadius,
    );
    const inputPinVelocity = inputTangent.clone().multiplyScalar(
      inputCrankRadius * inputSpeed,
    );
    const inputPinAcceleration = inputTangent.clone().multiplyScalar(
      inputCrankRadius * inputAcceleration,
    ).addScaledVector(
      inputRadial,
      -inputCrankRadius * inputSpeed ** 2,
    );

    const centerToInput = inputPin.clone().sub(outputCenter);
    const centerDistance = centerToInput.length();
    const centerDirection = centerToInput.clone().multiplyScalar(
      1 / centerDistance,
    );
    const circleAlong = (
      outputPinRadius ** 2
        - connectingRodLength ** 2
        + centerDistance ** 2
    ) / (2 * centerDistance);
    const circleHeight = Math.sqrt(Math.max(
      0,
      outputPinRadius ** 2 - circleAlong ** 2,
    ));
    const circleBase = outputCenter.clone().addScaledVector(
      centerDirection,
      circleAlong,
    );
    const circleNormal = new THREE.Vector3(
      -centerDirection.y,
      centerDirection.x,
      0,
    );
    const candidateA = circleBase.clone().addScaledVector(
      circleNormal,
      circleHeight,
    );
    const candidateB = circleBase.clone().addScaledVector(
      circleNormal,
      -circleHeight,
    );
    const outputPin = candidateA.x > candidateB.x
      ? candidateA
      : candidateB;
    const outputRadial = outputPin.clone().sub(outputCenter)
      .multiplyScalar(1 / outputPinRadius);
    const outputTangent = new THREE.Vector3(
      -outputRadial.y,
      outputRadial.x,
      0,
    );
    const outputAngle = Math.atan2(outputRadial.y, outputRadial.x);
    const connectingRodVector = outputPin.clone().sub(inputPin);
    const outputVelocityCoefficient = connectingRodVector.dot(
      outputTangent,
    ) * outputPinRadius;
    const outputAngularSpeed = connectingRodVector.dot(inputPinVelocity)
      / outputVelocityCoefficient;
    const outputPinVelocity = outputTangent.clone().multiplyScalar(
      outputPinRadius * outputAngularSpeed,
    );
    const relativePinVelocity = outputPinVelocity.clone()
      .sub(inputPinVelocity);
    const outputAngularAcceleration = (
      connectingRodVector.dot(inputPinAcceleration)
        + connectingRodVector.dot(outputRadial)
          * outputPinRadius * outputAngularSpeed ** 2
        - relativePinVelocity.lengthSq()
    ) / outputVelocityCoefficient;
    const outputPinAcceleration = outputTangent.clone().multiplyScalar(
      outputPinRadius * outputAngularAcceleration,
    ).addScaledVector(
      outputRadial,
      -outputPinRadius * outputAngularSpeed ** 2,
    );
    const relativePinAcceleration = outputPinAcceleration.clone()
      .sub(inputPinAcceleration);

    const cradleAngle = cradlePerOutputRatio
      * (outputAngle - outputCenterAngle);
    const cradleAngularSpeed = cradlePerOutputRatio
      * outputAngularSpeed;
    const cradleAngularAcceleration = cradlePerOutputRatio
      * outputAngularAcceleration;
    const cradleCenter = new THREE.Vector3(
      -rockerRollRadius * cradleAngle,
      cradleCenterY,
      0,
    );
    const cradleCenterVelocity = new THREE.Vector3(
      -rockerRollRadius * cradleAngularSpeed,
      0,
      0,
    );
    const cradleCenterAcceleration = new THREE.Vector3(
      -rockerRollRadius * cradleAngularAcceleration,
      0,
      0,
    );
    const leftBandAnchor = transformCradlePoint(
      leftPostLocal,
      cradleCenter,
      cradleAngle,
      bandZ,
    );
    const rightBandAnchor = transformCradlePoint(
      rightPostLocal,
      cradleCenter,
      cradleAngle,
      bandZ,
    );
    const bandCenter = new THREE.Vector3(
      outputCenter.x,
      outputCenter.y,
      bandZ,
    );
    const leftBandTangent = upperTangentPoint(
      leftBandAnchor,
      bandCenter,
      bandPitchRadius,
      bandZ,
    );
    const rightBandTangent = upperTangentPoint(
      rightBandAnchor,
      bandCenter,
      bandPitchRadius,
      bandZ,
    );
    const bandDisplacement = bandPitchRadius
      * (outputAngle - outputCenterAngle);
    return {
      antagonisticTakeUpSum: bandDisplacement + -bandDisplacement,
      bandAccelerationConstraintResidual:
        cradleBandEffectiveRadius * cradleAngularAcceleration
          - bandPitchRadius * outputAngularAcceleration,
      bandCDrumTakeUp: bandDisplacement,
      bandDDrumTakeUp: -bandDisplacement,
      bandDisplacement,
      bandNoSlipResidual:
        cradleBandEffectiveRadius * cradleAngularSpeed
          - bandPitchRadius * outputAngularSpeed,
      connectingRodAccelerationConstraintResidual:
        relativePinVelocity.lengthSq()
          + connectingRodVector.dot(relativePinAcceleration),
      connectingRodLengthResidual:
        connectingRodVector.length() - connectingRodLength,
      connectingRodVector,
      connectingRodVelocityConstraintResidual:
        connectingRodVector.dot(relativePinVelocity),
      cradleAngle,
      cradleAngularAcceleration,
      cradleAngularSpeed,
      cradleCenter,
      cradleCenterAcceleration,
      cradleCenterVelocity,
      cradleRollingAccelerationResidual:
        cradleCenterAcceleration.x
          + rockerRollRadius * cradleAngularAcceleration,
      cradleRollingSpeedResidual:
        cradleCenterVelocity.x
          + rockerRollRadius * cradleAngularSpeed,
      inputAcceleration,
      inputAngle,
      inputPin,
      inputPinAcceleration,
      inputPinVelocity,
      inputSpeed,
      leftBandAnchor,
      leftBandTangent,
      outputAngle,
      outputAngularAcceleration,
      outputAngularSpeed,
      outputPin,
      outputPinAcceleration,
      outputPinVelocity,
      relativePinAcceleration,
      relativePinVelocity,
      rightBandAnchor,
      rightBandTangent,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...stateAtInputAngle(
        sourceInputAngle + inputAngularSpeed * cycleTime,
      ),
      cycleTime,
      phase: cycleTime / cycleDuration,
    };
  };

  const geometry = {
    bandPitchRadius,
    bandZ,
    connectingRodLength,
    cradleAngularAmplitude,
    cradleBandEffectiveRadius,
    cradleCenterY,
    cradlePerOutputRatio,
    cycleDuration,
    groundPivotDistance,
    groundY,
    innerDeadCenterInputAngle,
    inputAngularSpeed,
    inputCenter: inputCenter.clone(),
    inputCrankRadius,
    leftPostLocal: leftPostLocal.clone(),
    outputAngularStroke,
    outputCenter: outputCenter.clone(),
    outputCenterAngle,
    outputMaximumAngle,
    outputMinimumAngle,
    outputPinRadius,
    outputWheelRadius,
    rightPostLocal: rightPostLocal.clone(),
    rockerRollRadius,
    sourceInputAngle,
  };

  const groundMaterial = matte(PALETTE.ink, {
    metalness: 0.16,
    roughness: 0.62,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.54,
  });
  const cradleMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.55,
  });
  const rodMaterial = matte(PALETTE.accent, {
    metalness: 0.22,
    roughness: 0.46,
  });
  const bandMaterial = matte(0x477b5c, {
    metalness: 0.08,
    roughness: 0.63,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 0.18, 1.65),
    groundMaterial,
  );
  ground.position.set(0, groundY - .09, -0.24);
  ground.userData.role = 'fixed-floor-beneath-rocking-cradle-E';
  root.add(ground);

  const fixedAxleFrame = new THREE.Group();
  fixedAxleFrame.userData.role =
    'fixed-rear-frame-carrying-A-and-B-axes';
  const rearMast = new THREE.Mesh(
    new THREE.BoxGeometry(.20,4.28,.24),
    frameMaterial,
  );
  rearMast.position.set(0,-.475,-.94);
  rearMast.userData.role = 'rear-grounded-drive-bearing-standard';
  fixedAxleFrame.add(rearMast);
  for (const center of [inputCenter, outputCenter]) {
    const axle = cylinderAlongZ(.11,1.50,groundMaterial,28);
    axle.position.copy(center);
    axle.position.z = -.21;
    axle.userData.role = center === inputCenter
      ? 'fixed-axis-of-continuously-rotating-wheel-A'
      : 'fixed-axis-of-oscillating-wheel-B';
    fixedAxleFrame.add(axle);
  }
  root.add(fixedAxleFrame);

  const inputWheelA = makePulley({
    color: PALETTE.driver,
    grooves: 0,
    radius: 0.66,
    spokes: 4,
    width: 0.34,
  });
  inputWheelA.position.copy(inputCenter);
  inputWheelA.userData.role = 'continuously-rotating-crank-wheel-A';
  const inputCrankArm = new THREE.Mesh(
    new THREE.BoxGeometry(inputCrankRadius, 0.11, 0.19),
    rodMaterial,
  );
  inputCrankArm.position.x = inputCrankRadius / 2;
  inputCrankArm.position.z = 0.24;
  inputCrankArm.userData.role = 'eccentric-crank-arm-on-wheel-A';
  inputWheelA.userData.rotor.add(inputCrankArm);
  const inputPinMarker = new THREE.Mesh(
    new THREE.CylinderGeometry(.07,.07,.48,32),
    whiteMaterial,
  );
  inputPinMarker.rotation.x=Math.PI/2;
  inputPinMarker.position.set(inputCrankRadius, 0, .39);
  inputPinMarker.userData.role = 'white-crank-pin-of-wheel-A';
  inputWheelA.userData.rotor.add(inputPinMarker);
  root.add(inputWheelA);

  const outputWheelB = makePulley({
    color: PALETTE.driven,
    grooves: 1,
    radius: outputWheelRadius,
    spokes: 6,
    width: 0.42,
  });
  outputWheelB.position.copy(outputCenter);
  outputWheelB.userData.role =
    'larger-fixed-axis-oscillating-wheel-B';
  const outputCrankArm = new THREE.Mesh(
    new THREE.BoxGeometry(outputPinRadius, 0.12, 0.21),
    rodMaterial,
  );
  outputCrankArm.position.set(outputPinRadius / 2, 0, 0.29);
  outputCrankArm.userData.role = 'eccentric-output-arm-on-wheel-B';
  outputWheelB.userData.rotor.add(outputCrankArm);
  const outputPinMarker = new THREE.Mesh(
    new THREE.CylinderGeometry(.07,.07,.48,32),
    whiteMaterial,
  );
  outputPinMarker.rotation.x=Math.PI/2;
  outputPinMarker.position.set(outputPinRadius, 0, .39);
  outputPinMarker.userData.role = 'white-oscillating-pin-of-wheel-B';
  outputWheelB.userData.rotor.add(outputPinMarker);
  root.add(outputWheelB);

  const {rod:connectingRod,body:connectingRodBody,startAnchor:rodStart,endAnchor:rodEnd}=makeBoredLinkRod({
    bodyMaterial:rodMaterial,depth:.12,length:connectingRodLength,planeZ:0,
    width:.15,boreRadius:.074,role:'constant-length-link-from-A-to-B',
  });
  connectingRod.userData.setEndpoints=(a,b)=>{
    connectingRod.position.copy(a);
    connectingRod.rotation.z=Math.atan2(b.y-a.y,b.x-a.x);
  };
  root.add(connectingRod);
  // Pulley hubs rotate around the fixed axles rather than filling them.
  for(const wheel of [inputWheelA,outputWheelB]){
    const hub=wheel.userData.rotor.children.find(o=>o.geometry?.type==='CylinderGeometry');
    if(hub){const p=hub.geometry.parameters;hub.geometry.dispose();hub.geometry=boredJournal(p.radiusTop,.114,p.height,hub.material).geometry;}
  }

  const cradleE = new THREE.Group();
  cradleE.userData.role = 'rolling-self-rocking-cradle-E';
  const rockerPoints = [];
  for (let index = 0; index <= 72; index += 1) {
    const angle = THREE.MathUtils.lerp(-2.15, -0.99, index / 72);
    rockerPoints.push(new THREE.Vector3(
      (rockerRollRadius-rockerTubeRadius) * Math.cos(angle),
      (rockerRollRadius-rockerTubeRadius) * Math.sin(angle),
      -0.02,
    ));
  }
  const rockerShoe = makeTubeThrough(
    rockerPoints,
    0.13,
    cradleMaterial,
    'circular-rocker-shoe-of-cradle-E',
  );
  cradleE.add(rockerShoe);
  const cradleBed = new THREE.Mesh(
    new THREE.BoxGeometry(4.55, 0.18, 0.82),
    cradleMaterial,
  );
  cradleBed.position.set(0, -2.75, -.25);
  cradleBed.userData.role = 'rigid-bed-of-cradle-E';
  cradleE.add(cradleBed);
  for (const side of [-1, 1]) {
    const standard = beamBetween(
      new THREE.Vector3(side * 2.02, -2.68, -.25),
      new THREE.Vector3(side * 2.02, 1.05, -.25),
      0.15,
      0.26,
      cradleMaterial,
    );
    standard.userData.role = side < 0
      ? 'left-band-standard-attached-to-rocker-E'
      : 'right-band-standard-attached-to-rocker-E';
    cradleE.add(standard);
    const anchor = cylinderAlongZ(.115, .88, whiteMaterial, 24);
    anchor.position.set(side * 2.02, 1.05, .05);
    anchor.userData.role = side < 0
      ? 'attachment-of-flexible-band-C-to-E'
      : 'attachment-of-flexible-band-D-to-E';
    cradleE.add(anchor);
  }
  const cradleLoad = new THREE.Mesh(
    new THREE.BoxGeometry(2.15, 0.42, 0.72),
    cradleMaterial,
  );
  cradleLoad.position.set(0, -2.50, -.25);
  cradleLoad.userData.role = 'representative-cradle-body-on-rocker-E';
  cradleE.add(cradleLoad);
  root.add(cradleE);

  const flexibleBandC = makeSegmentedBand(
    30,
    0.038,
    bandMaterial,
    'flexible-band-C-left-limb-over-wheel-B',
  );
  const flexibleBandD = makeSegmentedBand(
    30,
    0.038,
    bandMaterial,
    'flexible-band-D-right-limb-over-wheel-B',
  );
  root.add(flexibleBandC, flexibleBandD);

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(inputWheelA, state.inputAngle);
    setSpin(outputWheelB, state.outputAngle);
    connectingRod.userData.setEndpoints(
      state.inputPin.clone().setZ(.94),
      state.outputPin.clone().setZ(.94),
    );
    cradleE.position.copy(state.cradleCenter);
    cradleE.rotation.z = state.cradleAngle;
    const bandCenter = new THREE.Vector3(
      outputCenter.x,
      outputCenter.y,
      bandZ,
    );
    flexibleBandC.userData.setPoints(sampleLeftBand(
      state.leftBandAnchor,
      state.leftBandTangent,
      bandCenter,
      bandPitchRadius,
      flexibleBandC.userData.segmentCount,
    ));
    flexibleBandD.userData.setPoints(sampleRightBand(
      state.rightBandTangent,
      state.rightBandAnchor,
      bandCenter,
      bandPitchRadius,
      flexibleBandD.userData.segmentCount,
    ));
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 4,
    },
    archetype:
      'continuous-crank-four-bar-oscillating-drum-antagonistic-band-driven-rolling-cradle',
    blocks: {
      connectingRod, connectingRodBody, rodStart, rodEnd,
      cradleBed,
      cradleE,
      fixedAxleFrame,
      flexibleBandC,
      flexibleBandD,
      ground, rearMast, cradleLoad,
      inputCrankArm,
      inputPinMarker,
      inputWheelA,
      outputCrankArm,
      outputPinMarker,
      outputWheelB,
      rockerShoe,
    },
    degreesOfFreedom: {
      cradleAngleIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      outputWheelAngleIndependent: false,
      storedBandElasticStates: 0,
    },
    dynamics: {
      bandElasticityBacklashBearingFrictionInertiaAndLoadsModeled: false,
      finiteBandLengthClosureValidated: false,
      bandApproximation: 'Cradle angle uses the disclosed effective-radius law; tangent routes are visual geometry and do not conserve both finite band lengths.',
      sourceSpecifiesAbsoluteDimensionsMaterialsLoadsOrForces: false,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Continuously rotating crank wheel A drives an eccentric pin on the larger fixed-axis wheel B through one constant-length four-bar link, so B oscillates. The two simultaneously present source-required flexible bands C and D exchange equal take-up at B and impose the ideal no-slip rocking displacement of cradle E. E rolls on its circular shoe without slipping on the floor.',
    motion: {
      cradleAngularStroke: cradleAngularAmplitude * 2,
      cycleDuration,
      inputAngularSpeed,
      outputAngularStroke,
    },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      officialCanvasCyclePeriod: 4,
      officialCanvasCyclesPerMinute: 15,
      officialCanvasModelPresent: true,
      reason:
        'The official Movement 419 page embeds a six-part Canvas construction showing fixed-axis A and B, their crank link, a single routed band graphic with C/D limbs, and a rolling cradle E. It was inspected for topology and relative proportions only.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      cradleAngle: sourceState.cradleAngle,
      inputAngle: sourceState.inputAngle,
      outputAngle: sourceState.outputAngle,
    },
    sourceReference: {
      brownPlate419: {
        cradleEApproximateBoundsPixels: [75, 38, 441, 477],
        imageHeight: 525,
        imageWidth: 525,
        inputWheelAApproximateCenterPixels: [254, 352],
        measurementUncertaintyPixels: 12,
        outputWheelBApproximateCenterPixels: [260, 167],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'A revolves continuously',
          'A is connected to the greater-radius wheel B',
          'B receives oscillating motion',
          'B carries two flexible bands C and D',
          'each band connects to a standard attached to rocker E',
          'the mechanism is used for self-rocking cradles',
        ],
        engravingEvidence:
          'Brown’s plate shows small lower crank wheel A linked to an eccentric pin on larger upper wheel B, two opposed flexible limbs passing over B to tall standards, and those standards rigidly joined to curved rocker E.',
        officialCanvasEvidence:
          'The official embedded construction uses relative radii 2.5 for A and 5 for B, crank radii 1.5 and 4, pivot spacing 9, a roughly 8.35 connecting rod, a 15-radius rocker shoe, and approximately six degrees of cradle swing on either side.',
        reconstructionDisclosure:
          'Brown gives no dimensions, exact link branch, band attachment law, rocker radius, elasticity, loads, friction, or timing. This model preserves the official relative four-bar proportions in a clean exact dead-center construction, idealizes opposed C/D take-up as a no-slip effective-radius relation, and renders their tangent routes without animated belt beads.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 419',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      cradleRollingConstraint:
        'cradleCenterX=-rockerRollRadius*cradleAngle',
      fourBarConstraint:
        '|outputPin-inputPin|=connectingRodLength',
      opposedBandTakeUp:
        'bandCDrumTakeUp=-bandDDrumTakeUp',
      outputToCradleNoSlip:
        'bandPitchRadius*d(outputAngle)=cradleBandEffectiveRadius*d(cradleAngle)',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.35, -2.84, -1.05),
    new THREE.Vector3(3.35, 3.03, 1.15),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(1.1, .6, 14);
  root.userData.groundFloorY = groundY - 0.23;
  markShadows(root);
  ground.receiveShadow = true;
  fitPistonGuide(root, update, cycleDuration);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredSelfRockingCradleMovement(movement) {
  if (movement.id !== 419) return null;
  return selfRockingCradle(movement);
}
