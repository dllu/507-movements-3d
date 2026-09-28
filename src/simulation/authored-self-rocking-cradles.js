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
import {replaceWithLaidRope} from './laid-rope.js';
import {groundBlock} from './ground-block.js';

const FULL_TURN = Math.PI * 2;

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
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

// Brown draws C and D as plain cord lines: one continuous shared laid rope
// each, rebuilt along the sampled wrap-and-tangent path.
function makeSegmentedBand(segmentCount, radius, material, role, { anchorAtEnd = false } = {}) {
  const band = new THREE.Group();
  band.userData.isBelt = true;
  band.userData.role = role;
  band.userData.segmentCount = segmentCount;
  band.userData.crossSection = 'laid-rope';
  const rope = new THREE.Mesh(new THREE.BufferGeometry(), material);
  rope.userData.role = `${role}-laid-cord`;
  band.add(rope);
  band.userData.mesh = rope;
  band.userData.setPoints = (points) => {
    const path = new THREE.CurvePath();
    for (let index = 0; index < points.length - 1; index += 1) {
      path.add(new THREE.LineCurve3(points[index], points[index + 1]));
    }
    // The cord is tied at its post, so the lay stays fixed at that end while
    // more or less of it lies wound on wheel B.
    const length = path.getLength();
    replaceWithLaidRope(rope, path, { radius, travel: anchorAtEnd ? length : 0 });
    band.userData.curve = path;
    band.userData.length = length;
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
  // Brown's rocker top lies at A's lowest point (A radius 0.59, half of B),
  // so the cradle sits 0.12 lower than the p62 build and the standards are
  // 0.12 taller to keep the band attachments C and D where Brown draws them.
  const groundY = -2.72;
  const cradleCenterY = groundY + rockerRollRadius;
  const bandZ = .42;
  const leftPostLocal = new THREE.Vector2(-2.02, 1.17);
  const rightPostLocal = new THREE.Vector2(2.02, 1.17);

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
  // Brown draws the crank pins as small ringed circles and the band ends as
  // small caps on the post heads: no white index dots.
  const pinMaterial = matte(PALETTE.ink, { metalness: 0.28, roughness: 0.44 });

  // Brown's floor is a hatched ground line: notation for the solid floor.
  // Model the floor itself as a plain ground block under the rocking cradle E.
  const groundDepth = 0.24;
  const ground = groundBlock(6.8, groundDepth, 1.40,
    { name: 'fixed-floor-beneath-rocking-cradle-E' });
  ground.position.set(0, groundY - groundDepth / 2, -0.44);
  ground.userData.role = 'fixed-floor-beneath-rocking-cradle-E';
  root.add(ground);

  // Brown draws no support for the fixed A and B axes. As in the gear
  // family they end as plain stubs just behind the discs; the p57 rear mast
  // down to the floor showed below A and is not built (p62 support policy).
  const fixedAxleFrame = new THREE.Group();
  fixedAxleFrame.userData.role =
    'fixed-rear-frame-carrying-A-and-B-axes';
  // Each stub meets the back face of its plain wheel (its journal is not
  // shown), so the wheel faces stay plain as Brown draws them.
  const axleBack = -.33;
  for (const [center, wheelWidth] of [[inputCenter, .34], [outputCenter, .42]]) {
    const axleFront = center.z - wheelWidth / 2 - .002;
    const axle = cylinderAlongZ(.11,axleFront-axleBack,groundMaterial,28);
    axle.position.copy(center);
    axle.position.z = (axleFront+axleBack)/2;
    axle.userData.role = center === inputCenter
      ? 'fixed-axis-of-continuously-rotating-wheel-A'
      : 'fixed-axis-of-oscillating-wheel-B';
    fixedAxleFrame.add(axle);
  }
  root.add(fixedAxleFrame);

  // Brown draws A and B as plain wheels, each carrying only the crank pin
  // on which the connecting rod rides: no hub, crank arm or face marks.
  const rodPlaneZ = .76, pinOuterZ = .87;
  const plainWheel = (color, radius, width, role) => {
    const wheel = makePulley({ color, grooves: 0, radius, spokes: 0, width,
      rotationIndicator: false });
    wheel.userData.hub.removeFromParent();
    wheel.userData.role = role;
    return wheel;
  };
  const crankPin = (wheel, radius, width, role) => {
    const faceZ = width / 2, outerZ = pinOuterZ - wheel.position.z;
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(.07,.07,outerZ-faceZ,32),
      pinMaterial,
    );
    pin.rotation.x=Math.PI/2;
    pin.position.set(radius, 0, (faceZ+outerZ)/2);
    pin.userData.role = role;
    wheel.userData.rotor.add(pin);
    return pin;
  };
  const inputWheelA = plainWheel(PALETTE.driver, 0.59, 0.34,
    'continuously-rotating-crank-wheel-A');
  inputWheelA.position.copy(inputCenter);
  const inputPinMarker = crankPin(inputWheelA, inputCrankRadius, 0.34,
    'crank-pin-of-wheel-A');
  root.add(inputWheelA);

  const outputWheelB = plainWheel(PALETTE.driven, outputWheelRadius, 0.42,
    'larger-fixed-axis-oscillating-wheel-B');
  outputWheelB.position.copy(outputCenter);
  const outputPinMarker = crankPin(outputWheelB, outputPinRadius, 0.42,
    'oscillating-pin-of-wheel-B');
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

  const cradleE = new THREE.Group();
  cradleE.userData.role = 'rolling-self-rocking-cradle-E';
  // Brown draws rocker E as one solid circular segment: a flat top (the
  // bed the standards stand on) over a rolling arc of the roll radius. It is
  // one extruded outline, behind wheel A.
  const rockerTopY = -2.66;
  const rockerHalfChord = Math.sqrt(rockerRollRadius ** 2 - rockerTopY ** 2);
  const rockerShape = new THREE.Shape();
  rockerShape.moveTo(-rockerHalfChord, rockerTopY);
  rockerShape.absarc(0, 0, rockerRollRadius,
    Math.atan2(rockerTopY, -rockerHalfChord), Math.atan2(rockerTopY, rockerHalfChord), false);
  rockerShape.closePath();
  const rockerDepth = 0.82;
  const rockerShoe = new THREE.Mesh(
    new THREE.ExtrudeGeometry(rockerShape, { depth: rockerDepth, bevelEnabled: false, curveSegments: 96 })
      .translate(0, 0, -.25 - rockerDepth / 2),
    cradleMaterial,
  );
  rockerShoe.userData.role = 'solid-circular-segment-rocker-E';
  cradleE.add(rockerShoe);
  // The segment's flat top is the cradle's bed.
  const cradleBed = rockerShoe;
  for (const side of [-1, 1]) {
    // Each standard is one flat extrusion: a straight post whose inner
    // edge sweeps into E's bed on a fillet, as Brown's U-shaped standards do.
    const postHalf = 0.1, filletRadius = 0.42, postTop = 1.17, bedY = rockerTopY;
    const inner = side * (2.02 - postHalf), outer = side * (2.02 + postHalf);
    const postShape = new THREE.Shape();
    postShape.moveTo(outer, bedY - 0.04);
    postShape.lineTo(inner - side * filletRadius, bedY - 0.04);
    postShape.lineTo(inner - side * filletRadius, bedY);
    postShape.absarc(inner - side * filletRadius, bedY + filletRadius, filletRadius,
      -Math.PI / 2, side < 0 ? Math.PI : 0, side < 0);
    postShape.lineTo(inner, postTop);
    postShape.lineTo(outer, postTop);
    postShape.closePath();
    const standard = new THREE.Mesh(
      new THREE.ExtrudeGeometry(postShape, { depth: 0.26, bevelEnabled: false, curveSegments: 24 })
        .translate(0, 0, -.25 - 0.13),
      cradleMaterial,
    );
    standard.userData.role = side < 0
      ? 'left-band-standard-attached-to-rocker-E'
      : 'right-band-standard-attached-to-rocker-E';
    cradleE.add(standard);
    const anchor = cylinderAlongZ(.115, .88, cradleMaterial, 24);
    anchor.position.set(side * 2.02, 1.17, .05);
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
    { anchorAtEnd: true },
  );
  root.add(flexibleBandC, flexibleBandD);

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(inputWheelA, state.inputAngle);
    setSpin(outputWheelB, state.outputAngle);
    connectingRod.userData.setEndpoints(
      state.inputPin.clone().setZ(rodPlaneZ),
      state.outputPin.clone().setZ(rodPlaneZ),
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
      ground, cradleLoad,
      inputPinMarker,
      inputWheelA,
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
  root.userData.groundFloorY = groundY - groundDepth - 0.01;
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
