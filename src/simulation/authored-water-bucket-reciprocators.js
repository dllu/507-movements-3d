import * as THREE from 'three';
import {replaceWithLaidRope} from './laid-rope.js';
import {horizontalRing,horizontalTurned} from './horizontal-turbine-solids.js';
import {poly,circle,plate,ring,turned,polygonClipping} from './finite-plate-geometry.js';
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

function makeTube(curve, radius, material, role) {
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 96, radius, 9, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function smoothStep5(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return THREE.MathUtils.clamp(
    clamped ** 3 * (clamped * (clamped * 6 - 15) + 10),
    0,
    1,
  );
}

function smoothStep5First(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  if (clamped === 0 || clamped === 1) return 0;
  return 30 * clamped ** 2 * (clamped - 1) ** 2;
}

function smoothStep5Second(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  if (clamped === 0 || clamped === 1) return 0;
  return 60 * clamped * (2 * clamped ** 2 - 3 * clamped + 1);
}

function segmentKinematics(
  phase,
  startPhase,
  endPhase,
  startValue,
  endValue,
) {
  if (phase <= startPhase) {
    return { first: 0, second: 0, value: startValue };
  }
  if (phase >= endPhase) {
    return { first: 0, second: 0, value: endValue };
  }
  const duration = endPhase - startPhase;
  const progress = (phase - startPhase) / duration;
  const delta = endValue - startValue;
  return {
    first: delta * smoothStep5First(progress) / duration,
    second: delta * smoothStep5Second(progress) / duration ** 2,
    value: startValue + delta * smoothStep5(progress),
  };
}

function waterBucketReciprocator(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const pulleyCenter = new THREE.Vector3(0, 3.15, 0);
  const pulleyPitchRadius = 0.92;
  const pulleyOuterRadius = 1.03;
  const bucketRopeX = pulleyPitchRadius;
  const counterweightRopeX = -pulleyPitchRadius;
  const topAttachmentY = 1.50;
  const bottomAttachmentY = -2.00;
  const attachmentHeightSum = topAttachmentY + bottomAttachmentY;
  const bucketValveTipOffset = -1.20;
  const valveMaximumLift = 0.24;
  const strikeAnvilY = bottomAttachmentY + bucketValveTipOffset + valveMaximumLift;
  const fillStartPhase = 0.02;
  const fillEndPhase = 0.25;
  const descendStartPhase = 0.25;
  const descendEndPhase = 0.52;
  const valveOpenStartPhase = 0.515;
  const valveFullyOpenPhase = 0.55;
  const drainEndPhase = 0.66;
  const valveCloseStartPhase = 0.64;
  const riseStartPhase = 0.68;
  const riseEndPhase = 0.93;
  const ropeArcLength = Math.PI * pulleyPitchRadius;
  const ropeMarkerDistanceFromCounter =
    pulleyCenter.y - bottomAttachmentY + 0.22 * ropeArcLength;

  const waterFillAtPhase = (phaseValue) => {
    const phase = THREE.MathUtils.euclideanModulo(phaseValue, 1);
    if (phase < fillStartPhase) return 0;
    if (phase < fillEndPhase) {
      return smoothStep5(
        (phase - fillStartPhase) / (fillEndPhase - fillStartPhase),
      );
    }
    if (phase < descendEndPhase) return 1;
    if (phase < drainEndPhase) {
      return 1 - smoothStep5(
        (phase - descendEndPhase) / (drainEndPhase - descendEndPhase),
      );
    }
    return 0;
  };

  const valveLiftAtPhase = (phaseValue) => Math.max(0,
    strikeAnvilY - bucketAttachmentKinematicsAtPhase(phaseValue).value - bucketValveTipOffset);

  const bucketAttachmentKinematicsAtPhase = (phaseValue) => {
    const phase = THREE.MathUtils.euclideanModulo(phaseValue, 1);
    if (phase < descendStartPhase) {
      return { first: 0, second: 0, value: topAttachmentY };
    }
    if (phase < descendEndPhase) {
      return segmentKinematics(
        phase,
        descendStartPhase,
        descendEndPhase,
        topAttachmentY,
        bottomAttachmentY,
      );
    }
    if (phase < riseStartPhase) {
      return { first: 0, second: 0, value: bottomAttachmentY };
    }
    if (phase < riseEndPhase) {
      return segmentKinematics(
        phase,
        riseStartPhase,
        riseEndPhase,
        bottomAttachmentY,
        topAttachmentY,
      );
    }
    return { first: 0, second: 0, value: topAttachmentY };
  };

  const ropePointAtDistance = (
    counterweightAttachmentY,
    bucketAttachmentY,
    distanceValue,
  ) => {
    const leftLength = pulleyCenter.y - counterweightAttachmentY;
    const rightLength = pulleyCenter.y - bucketAttachmentY;
    const totalLength = leftLength + ropeArcLength + rightLength;
    const distance = THREE.MathUtils.clamp(distanceValue, 0, totalLength);
    if (distance <= leftLength) {
      return {
        position: new THREE.Vector3(
          counterweightRopeX,
          counterweightAttachmentY + distance,
          0,
        ),
        region: 'left-straight',
        tangent: new THREE.Vector3(0, 1, 0),
      };
    }
    if (distance <= leftLength + ropeArcLength) {
      const arcDistance = distance - leftLength;
      const angle = Math.PI - arcDistance / pulleyPitchRadius;
      return {
        angle,
        position: new THREE.Vector3(
          pulleyCenter.x + pulleyPitchRadius * Math.cos(angle),
          pulleyCenter.y + pulleyPitchRadius * Math.sin(angle),
          0,
        ),
        region: 'upper-pulley-arc',
        tangent: new THREE.Vector3(
          Math.sin(angle),
          -Math.cos(angle),
          0,
        ),
      };
    }
    const rightDistance = distance - leftLength - ropeArcLength;
    return {
      position: new THREE.Vector3(
        bucketRopeX,
        pulleyCenter.y - rightDistance,
        0,
      ),
      region: 'right-straight',
      tangent: new THREE.Vector3(0, -1, 0),
    };
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const phase = THREE.MathUtils.euclideanModulo(
      inputAngle / FULL_TURN,
      1,
    );
    const phaseSpeed = inputSpeed / FULL_TURN;
    const phaseAcceleration = inputAcceleration / FULL_TURN;
    const bucketPhaseKinematics = bucketAttachmentKinematicsAtPhase(phase);
    const bucketAttachmentY = bucketPhaseKinematics.value;
    const bucketVelocityY = bucketPhaseKinematics.first * phaseSpeed;
    const bucketAccelerationY = bucketPhaseKinematics.second
      * phaseSpeed ** 2
      + bucketPhaseKinematics.first * phaseAcceleration;
    const counterweightAttachmentY =
      attachmentHeightSum - bucketAttachmentY;
    const counterweightVelocityY = -bucketVelocityY;
    const counterweightAccelerationY = -bucketAccelerationY;
    const pulleyAngle = (bucketAttachmentY - topAttachmentY)
      / pulleyPitchRadius;
    const pulleyAngularSpeed = bucketVelocityY / pulleyPitchRadius;
    const pulleyAngularAcceleration =
      bucketAccelerationY / pulleyPitchRadius;
    const leftRopeLength = pulleyCenter.y - counterweightAttachmentY;
    const rightRopeLength = pulleyCenter.y - bucketAttachmentY;
    const totalRopeLength = leftRopeLength + ropeArcLength + rightRopeLength;
    const valveLift = valveLiftAtPhase(phase);
    const valveTipY = bucketAttachmentY + bucketValveTipOffset + valveLift;
    const ropeMarker = ropePointAtDistance(
      counterweightAttachmentY,
      bucketAttachmentY,
      ropeMarkerDistanceFromCounter,
    );
    return {
      bucketAccelerationY,
      bucketAttachmentY,
      bucketVelocityY,
      counterweightAccelerationY,
      counterweightAttachmentY,
      counterweightVelocityY,
      inputAcceleration,
      inputAngle,
      inputSpeed,
      leftRopeLength,
      phase,
      phaseAcceleration,
      phaseSpeed,
      pulleyAngle,
      pulleyAngularAcceleration,
      pulleyAngularSpeed,
      rightRopeLength,
      ropeMarker,
      totalRopeLength,
      valveLift,
      valveTipY,
      waterFill: waterFillAtPhase(phase),
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...stateAtInputAngle(inputAngularSpeed * cycleTime),
      cycleTime,
    };
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    attachmentHeightSum,
    bottomAttachmentY,
    bucketRopeX,
    bucketValveTipOffset,
    counterweightRopeX,
    cycleDuration,
    descendEndPhase,
    descendStartPhase,
    drainEndPhase,
    fillEndPhase,
    fillStartPhase,
    inputAngularSpeed,
    pulleyCenter: pulleyCenter.clone(),
    pulleyOuterRadius,
    pulleyPitchRadius,
    riseEndPhase,
    riseStartPhase,
    ropeArcLength,
    ropeMarkerDistanceFromCounter,
    sourceTotalRopeLength: sourceState.totalRopeLength,
    strikeAnvilY,
    topAttachmentY,
    valveCloseStartPhase,
    valveFullyOpenPhase,
    valveMaximumLift,
    valveOpenStartPhase,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.59,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.31,
    roughness: 0.46,
  });
  const pulleyMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    roughness: 0.47,
  });
  const bucketMaterial = matte(PALETTE.driver, {
    metalness: 0.17,
    roughness: 0.52,
  });
  const ropeMaterial = matte(0x283035, {
    metalness: 0.04,
    roughness: 0.72,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.68,
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

  const pulley = new THREE.Group();
  pulley.position.copy(pulleyCenter);
  pulley.userData.role = 'single-fixed-axis-rope-pulley';
  root.add(pulley);
  const pulleyDisk = cylinderAlongZ(pulleyOuterRadius, 0.42,
    pulleyMaterial, 48);
  pulleyDisk.geometry.dispose();pulleyDisk.geometry=turned([[-.21,.224],[-.21,pulleyOuterRadius],[-.10,pulleyOuterRadius],[-.055,pulleyPitchRadius-.045],[.055,pulleyPitchRadius-.045],[.10,pulleyOuterRadius],[.21,pulleyOuterRadius],[.21,.224]]);pulleyDisk.rotation.set(0,0,0);
  pulleyDisk.userData.role = 'grooved-pulley-wheel';
  pulley.add(pulleyDisk);
  const pulleyGroove = new THREE.Mesh(
    new THREE.TorusGeometry(pulleyPitchRadius, 0.07, 9, 96),
    darkMaterial,
  );
  pulleyGroove.geometry.dispose();pulleyGroove.geometry=ring(pulleyPitchRadius-.051,pulleyPitchRadius-.045,-.05,.05);
  pulleyGroove.userData.role = 'single-rope-pitch-groove';
  pulley.add(pulleyGroove);
  const pulleyMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.09, 0.10),
    whiteMaterial,
  );
  pulleyMarker.position.set(0.60, 0, 0.27);
  pulleyMarker.userData.role = 'visible-oscillating-pulley-rotation-marker';
  pulley.add(pulleyMarker);
  const pulleyShaft = cylinderAlongZ(0.22, 1.02, darkMaterial, 36);
  pulleyShaft.position.copy(pulleyCenter);
  pulleyShaft.userData.role = 'fixed-pulley-shaft';
  root.add(pulleyShaft);

  const ropeAssembly = new THREE.Group();
  ropeAssembly.userData.isRope = true;
  ropeAssembly.userData.role =
    'one-continuous-open-rope-counterweight-to-bucket-over-pulley';
  ropeAssembly.userData.ropePathId = 'movement-439-single-rope';
  root.add(ropeAssembly);
  const leftRopeStrand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1, 14),
    ropeMaterial,
  );
  leftRopeStrand.userData.role = 'left-straight-part-of-single-rope';
  ropeAssembly.add(leftRopeStrand);
  const rightRopeStrand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1, 14),
    ropeMaterial,
  );
  rightRopeStrand.userData.role = 'right-straight-part-of-single-rope';
  ropeAssembly.add(rightRopeStrand);
  const ropeArcPoints = Array.from({ length: 65 }, (_, index) => {
    const angle = Math.PI - Math.PI * index / 64;
    return new THREE.Vector3(
      pulleyCenter.x + pulleyPitchRadius * Math.cos(angle),
      pulleyCenter.y + pulleyPitchRadius * Math.sin(angle),
      0,
    );
  });
  const ropeArcCurve = new THREE.CatmullRomCurve3(
    ropeArcPoints,
    false,
    'centripetal',
  );
  const upperRopeArc = makeTube(
    ropeArcCurve,
    0.045,
    ropeMaterial,
    'upper-semicircular-part-of-single-rope',
  );
  ropeAssembly.add(upperRopeArc);
  // Brown draws one rope; render it as the shared three-strand laid rope from
  // the counterweight eye, over the pulley, to the bucket bail. The straight
  // and arc pieces stay as hidden references for the contact checks.
  const laidRope = new THREE.Mesh(new THREE.BufferGeometry(), matte(PALETTE.belt, {roughness: 0.78}));
  laidRope.userData.role = 'single-laid-rope-counterweight-over-pulley-to-bucket';
  ropeAssembly.add(laidRope);
  for (const piece of [leftRopeStrand, rightRopeStrand, upperRopeArc]) piece.visible = false;
  // The rope is tied to the top of the bucket's bail, a fixed rise above
  // the attachment reference the kinematics carry.
  const bailRise = 0.30;
  const layRope = (counterweightY, bucketY) => {
    const path = new THREE.CurvePath();
    path.add(new THREE.LineCurve3(
      new THREE.Vector3(counterweightRopeX, counterweightY, 0), ropeArcPoints[0].clone()));
    path.add(ropeArcCurve);
    path.add(new THREE.LineCurve3(
      ropeArcPoints.at(-1).clone(), new THREE.Vector3(bucketRopeX, bucketY + bailRise, 0)));
    replaceWithLaidRope(laidRope, path, {radius: 0.045, tubularSegments: 256});
  };
  const ropeMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 20, 14),
    whiteMaterial,
  );
  ropeMarker.userData.role =
    'material-marker-moving-continuously-on-single-rope';
  root.add(ropeMarker);

  const bucket = new THREE.Group();
  bucket.position.set(bucketRopeX, topAttachmentY, 0);
  bucket.userData.role = 'water-filled-reciprocating-bucket';
  root.add(bucket);
  const bucketShell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.48, 1.00, 36, 1, true),
    bucketMaterial,
  );
  bucketShell.geometry.dispose();bucketShell.geometry=horizontalTurned([[-.5,.45],[-.5,.48],[.5,.62],[.5,.59]]);
  bucketShell.position.y = -0.55;
  bucketShell.userData.role = 'open-bucket-shell';
  bucket.add(bucketShell);
  const bucketBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 0.10, 36),
    bucketMaterial,
  );
  bucketBottom.geometry.dispose();bucketBottom.geometry=horizontalRing(.18,.48,-.05,.05);
  bucketBottom.position.y = -1.03;
  bucketBottom.userData.role = 'bucket-bottom-around-lifting-valve';
  bucket.add(bucketBottom);
  const bucketWater = new THREE.Mesh(
    new THREE.CylinderGeometry(0.54, 0.42, 0.76, 34),
    waterMaterial,
  );
  bucketWater.position.y = -0.57;
  bucketWater.userData.role = 'variable-water-load-in-bucket';
  bucket.add(bucketWater);
  // Brown's bail: an arched iron handle from two ears on the shell up to the
  // rope's end. Its plane is turned 50 degrees from the drawing plane so the
  // falling stream beside the rope clears the wire.
  {
    const bailDirection = new THREE.Vector3(Math.cos(0.87), 0, Math.sin(0.87));
    const earY = -0.25, earRadius = 0.62;
    const bailPoints = Array.from({length: 33}, (_, index) => {
      const angle = Math.PI * index / 32;
      return bailDirection.clone().multiplyScalar(earRadius * Math.cos(angle))
        .setY(earY + (bailRise - earY) * Math.sin(angle));
    });
    const bail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bailPoints), 48, 0.035, 8, false), darkMaterial);
    bail.userData.role = 'bucket-bail-carrying-rope-end';
    bucket.add(bail);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), bucketMaterial);
      ear.position.copy(bailDirection).multiplyScalar(side * earRadius).setY(earY);
      ear.userData.role = 'bucket-bail-ear';
      bucket.add(ear);
    }
  }
  const valve = new THREE.Group();
  valve.userData.role = 'bottom-valve-opened-by-ground-contact';
  bucket.add(valve);
  const valveDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.10, 28),
    darkMaterial,
  );
  valveDisk.position.y = -.93;
  valveDisk.userData.role = 'lifting-bottom-valve-disk';
  valve.add(valveDisk);
  const valveStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.30, 24),
    darkMaterial,
  );
  valveStem.position.y = -1.05;
  valveStem.userData.role = 'ground-striking-valve-stem';
  valve.add(valveStem);

  const counterweight = new THREE.Group();
  counterweight.position.set(counterweightRopeX, bottomAttachmentY, 0);
  counterweight.userData.role = 'bucket-return-counterweight';
  root.add(counterweight);
  const counterweightBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.72, 0.52),
    pulleyMaterial,
  );
  counterweightBody.position.y = -0.39;
  counterweightBody.userData.role = 'counterweight-body';
  counterweight.add(counterweightBody);
  const counterweightEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.045, 8, 28),
    darkMaterial,
  );
  counterweightEye.position.y = -0.02;
  counterweightEye.userData.role = 'counterweight-rope-eye';
  counterweight.add(counterweightEye);

  const frameBeam = new THREE.Mesh(
    new THREE.BoxGeometry(5.20, 0.26, 0.48),
    frameMaterial,
  );
  frameBeam.position.set(0, 4.42, -0.44);
  frameBeam.userData.role = 'fixed-overhead-pulley-support-beam';
  root.add(frameBeam);
  const hanger=new THREE.Mesh(plate(polygonClipping.difference(poly([[-.35,3.0],[.35,3.0],[.35,4.43],[-.35,4.43]]),poly(circle([0,pulleyCenter.y],.224,128))),-.56,-.31),frameMaterial);hanger.userData.role='bored-pulley-shaft-hanger';root.add(hanger);
  const framePost = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 7.64, 0.46),
    frameMaterial,
  );
  framePost.position.set(-2.42, 0.72, -0.44);
  framePost.userData.role = 'fixed-pulley-support-post';
  root.add(framePost);
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(6.30, 0.24, 3.28),
    frameMaterial,
  );
  ground.position.set(0, strikeAnvilY - valveMaximumLift - 0.16, -0.22);
  ground.userData.role = 'fixed-ground-beneath-bucket';
  root.add(ground);
  const strikeAnvil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.14, 0.30, 32),
    darkMaterial,
  );
  strikeAnvil.position.set(bucketRopeX, strikeAnvilY - 0.15, 0);
  strikeAnvil.userData.role = 'ground-anvil-opening-bucket-valve';
  root.add(strikeAnvil);

  const flume = new THREE.Mesh(
    new THREE.BoxGeometry(3.30, 0.22, 0.82),
    frameMaterial,
  );
  flume.position.set(bucketRopeX+.33+1.65*Math.cos(.30),1.80+1.65*Math.sin(.30),0.02);
  flume.rotation.z = 0.30;
  flume.userData.role = 'fixed-flume-providing-continuous-water-fall';
  root.add(flume);
  // The fall from the flume lip is one translucent stream narrowing as it
  // speeds up (unit length along y, stretched to the bucket's water).
  const fallingWater = new THREE.Mesh(
    waterJetGeometry(new THREE.LineCurve3(new THREE.Vector3(0, 2.35, 0),
      new THREE.Vector3(0, -2.35, 0)), { radius: 0.13, endRadius: 0.09, segments: 12 }),
    waterJetMaterial(),
  );
  fallingWater.renderOrder = 2;
  fallingWater.position.set(bucketRopeX+.33, -.55, 0.06);
  fallingWater.userData.role =
    'continuous-vertical-water-stream-through-bucket-station';
  root.add(fallingWater);
  const flowMarkers = [];
  for (let markerIndex = 0; markerIndex < 12; markerIndex += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 16, 11),
      paleWaterMaterial,
    );
    marker.userData.role =
      `continuous-fall-water-marker-${markerIndex + 1}`;
    root.add(marker);
    flowMarkers.push(marker);
  }

  const updateStrand = (strand, x, upperY, lowerY) => {
    const length = upperY - lowerY;
    strand.position.set(x, (upperY + lowerY) / 2, 0);
    strand.scale.set(1, length, 1);
  };

  const update = (time) => {
    const state = stateAtTime(time);
    pulley.rotation.z = state.pulleyAngle;
    bucket.position.y = state.bucketAttachmentY;
    counterweight.position.y = state.counterweightAttachmentY;
    valve.position.y = state.valveLift;
    bucketWater.visible = state.waterFill > 0.002;
    bucketWater.scale.set(
      0.72 + 0.28 * state.waterFill,
      0.06 + 0.94 * state.waterFill,
      0.72 + 0.28 * state.waterFill,
    );
    bucketWater.position.y = -0.94 + 0.37 * state.waterFill;
    updateStrand(
      leftRopeStrand,
      counterweightRopeX,
      pulleyCenter.y,
      state.counterweightAttachmentY,
    );
    updateStrand(
      rightRopeStrand,
      bucketRopeX,
      pulleyCenter.y,
      state.bucketAttachmentY,
    );
    ropeMarker.position.copy(state.ropeMarker.position);
    layRope(state.counterweightAttachmentY, state.bucketAttachmentY);
    const streamBottom = state.bucketAttachmentY - .90 + .70 * state.waterFill;
    const streamLength = 1.80 - streamBottom;
    fallingWater.position.y = (1.80 + streamBottom) / 2;
    fallingWater.scale.y = streamLength / 4.70;
    const flowPhase = THREE.MathUtils.euclideanModulo(time / 0.92, 1);
    for (let markerIndex = 0; markerIndex < flowMarkers.length;
      markerIndex += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        flowPhase + markerIndex / flowMarkers.length,
        1,
      );
      flowMarkers[markerIndex].position.set(
        bucketRopeX+.33,
        1.80 - streamLength * progress,
        0.06,
      );
      const endpointFade = Math.sin(Math.PI * progress);
      flowMarkers[markerIndex].scale.setScalar(
        Math.sqrt(Math.max(0, endpointFade)),
      );
    }
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: cycleDuration,
    },
    archetype:
      'water-filled-bucket-reciprocator-with-ground-opened-bottom-valve-single-rope-pulley-and-return-counterweight',
    blocks: {
      hanger,
      bucket,
      bucketBottom,
      bucketShell,
      bucketWater,
      counterweight,
      fallingWater,
      flowMarkers,
      flume,
      frameBeam,
      framePost,
      ground,
      leftRopeStrand,
      pulley,
      pulleyDisk,
      pulleyMarker,
      pulleyShaft,
      rightRopeStrand,
      ropeAssembly,
      ropeMarker,
      strikeAnvil,
      upperRopeArc,
      valve,
      valveDisk,
      valveStem,
    },
    bucketAttachmentKinematicsAtPhase,
    degreesOfFreedom: {
      bucketAndCounterweightIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      pulleySlipIndependent: false,
      valveLiftIndependent: false,
    },
    dynamics: {
      fillDrainMotionSchedule:
        'The demonstration uses quintic zero-velocity, zero-acceleration ramps: fill at the top, loaded descent, ground-triggered valve opening and drain at the bottom, counterweight return, then top dwell. Valve lift is derived from finite stem contact with the anvil; threshold impact and coupled rigid-body dynamics are not integrated.',
      fluidPressureSplashLeakageValveImpactRopeElasticityPulleyInertiaBearingFrictionBucketMassCounterweightMassAndDynamicAccelerationModeled:
        false,
      ropeMarkerContinuity:
        'The visible material marker is evaluated on one analytic rope path whose straight-to-arc tangents match exactly, so it crosses both pulley tangencies without a position or direction jump.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'One continuous rope runs from the counterweight up the left tangent, over the upper half of one fixed-axis pulley, and down the right tangent to the water bucket. A continuous fall fills the bucket at its upper station; the loaded bucket descends while lifting the counterweight by exactly the same distance. At the lower station its projecting valve stem meets the fixed anvil, raises the bottom valve, and empties the bucket. The counterweight then raises the empty bucket. Rope length is constant, the two suspended attachments always move equally and oppositely, and pulley rotation follows the single rope without slip.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType: 'reciprocating-fill-descend-drain-rise-cycle',
      pulleyMotion: 'oscillating',
      pulleyRevolutionsPerCycle: 0,
    },
    ropePointAtDistance,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 439 page provides Brown’s static engraving and caption but contains no Canvas construction or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      bucketAttachmentY: sourceState.bucketAttachmentY,
      counterweightAttachmentY: sourceState.counterweightAttachmentY,
      pulleyAngle: sourceState.pulleyAngle,
      totalRopeLength: sourceState.totalRopeLength,
      valveLift: sourceState.valveLift,
      waterFill: sourceState.waterFill,
    },
    sourceReference: {
      brownPlate439: {
        approximateBucketCenterPixels: [287, 199],
        approximateCounterweightCenterPixels: [177, 447],
        approximatePulleyCenterPixels: [233, 73],
        approximatePulleyRadiusPixels: 54,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 15,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'continuous falling water produces reciprocating motion',
          'a valve in the bucket bottom opens by striking the ground and empties the bucket',
          'a counterweight on the opposite side raises the bucket again',
          'bucket and counterweight are suspended over one pulley',
        ],
        engravingEvidence:
          'Brown’s engraving shows one upper pulley with a single rope descending on its two sides, a bucket under a right-hand flume, a projecting bottom-valve stem, and a compact counterweight on the left strand.',
        reconstructionDisclosure:
          'Brown gives no dimensions, rope length, masses, pulley inertia, valve travel, ground height, flow rate, fill threshold, stroke timing, acceleration, materials, losses, or cycle duration. Dimensions, smooth phase schedule, fill and valve ramps, fixed anvil, rope tracer, colors, and eight-second cycle are independently engineered; the single-rope pulley topology, opposed bucket and counterweight motion, continuous water fall, ground-opened bottom valve, drain, and counterweight return are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 439',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      constantRopeLength:
        'L=(pulleyY-counterweightY)+pi*pitchRadius+(pulleyY-bucketY)=constant',
      opposedTravel:
        'counterweightY=constantAttachmentSum-bucketY',
      pulleyNoSlip:
        'pulleyAngle=(bucketY-topBucketY)/pitchRadius and pulleyOmega=bucketVelocity/pitchRadius',
    },
    update,
    valveLiftAtPhase,
    waterFillAtPhase,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.12, -3.56, -1.72),
    new THREE.Vector3(4.54, 4.72, 1.72),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(5.6, 3.7, 11.2);
  root.userData.groundFloorY = -3.56;
  root.userData.hideGround=true;
  root.userData.solidReview={qualification:'Finite passages, water envelopes and contact geometry; bucket/trough motion and fill remain prescribed, without validated passive dynamics or fluid loads.'};
  root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])material.fog=false;});
  root.userData.minimumDisplayCycleSeconds=cycleDuration;
  markShadows(root);
  ground.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredWaterBucketReciprocatorMovement(movement) {
  if (movement.id !== 439) return null;
  return waterBucketReciprocator(movement);
}
