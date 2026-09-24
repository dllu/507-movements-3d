import * as THREE from 'three';
import { correctCheckHookJournals } from './lifting-check-hook-parts.js';
import {
  PALETTE,
  makeDynamicCable,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function wrappedCycleTime(time, period) {
  const cycles = time / period;
  if (Math.abs(cycles - Math.round(cycles)) < 1e-12) return 0;
  return positiveModulo(time, period);
}

function smootherStep01(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return u ** 3 * (u * (u * 6 - 15) + 10);
}

function smootherStepFirstDerivative(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * u ** 2 * (u - 1) ** 2;
}

function smootherStepSecondDerivative(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * u * (u - 1) * (2 * u - 1);
}

function integratedSmootherStep01(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return u ** 6 - 3 * u ** 5 + 2.5 * u ** 4;
}

function transitionState(time, start, end, from, to) {
  if (time <= start) return { acceleration: 0, value: from, velocity: 0 };
  if (time >= end) return { acceleration: 0, value: to, velocity: 0 };
  const duration = end - start;
  const u = (time - start) / duration;
  const travel = to - from;
  return {
    acceleration:
      travel * smootherStepSecondDerivative(u) / duration ** 2,
    value: from + travel * smootherStep01(u),
    velocity: travel * smootherStepFirstDerivative(u) / duration,
  };
}

function rotateVector2(vector, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    vector.x * cosine - vector.y * sine,
    vector.x * sine + vector.y * cosine,
  );
}

function makeAxialCylinder({
  depth,
  material,
  radius,
  role,
  segments = 56,
}) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  cylinder.userData.role = role;
  return cylinder;
}

function makeRadialBeam({
  angle,
  depth,
  endRadius,
  material,
  role,
  startRadius,
  thickness,
  z,
}) {
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(endRadius - startRadius, thickness, depth),
    material,
  );
  const middleRadius = (startRadius + endRadius) / 2;
  beam.position.set(
    Math.cos(angle) * middleRadius,
    Math.sin(angle) * middleRadius,
    z,
  );
  beam.rotation.z = angle;
  beam.userData.role = role;
  return beam;
}

function makePolylineHook({
  centerline,
  contactIndex,
  material,
  radius,
  role,
  whiteMaterial,
}) {
  const hook = new THREE.Group();
  const up = new THREE.Vector3(0, 1, 0);
  hook.userData.centerline = centerline.map((point) => point.clone());
  hook.userData.contactIndex = contactIndex;
  hook.userData.radius = radius;
  hook.userData.role = role;

  for (let index = 0; index < centerline.length - 1; index += 1) {
    const start = new THREE.Vector3(centerline[index].x, centerline[index].y, 0);
    const end = new THREE.Vector3(
      centerline[index + 1].x,
      centerline[index + 1].y,
      0,
    );
    const direction = end.clone().sub(start);
    const segment = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, direction.length(), 18),
      material,
    );
    segment.position.copy(start).add(end).multiplyScalar(0.5);
    segment.quaternion.setFromUnitVectors(up, direction.normalize());
    segment.userData.role = `${role}-bar-segment-${index + 1}`;
    hook.add(segment);
  }

  centerline.forEach((point, index) => {
    const joint = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 24, 16),
      material,
    );
    joint.position.set(point.x, point.y, 0);
    joint.userData.role = `${role}-rounded-joint-${index + 1}`;
    hook.add(joint);
  });

  const contactIndexMarker = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.42, 20, 14),
    whiteMaterial,
  );
  contactIndexMarker.position.set(
    centerline[contactIndex].x,
    centerline[contactIndex].y,
    radius * 0.82,
  );
  contactIndexMarker.userData.role = `${role}-white-stud-contact-index`;
  hook.add(contactIndexMarker);
  hook.userData.contactIndexMarker = contactIndexMarker;
  return hook;
}

function distancePointToSegment(point, start, end) {
  const direction = end.clone().sub(start);
  const lengthSquared = direction.lengthSq();
  if (lengthSquared <= 1e-18) return point.distanceTo(start);
  const parameter = THREE.MathUtils.clamp(
    point.clone().sub(start).dot(direction) / lengthSquared,
    0,
    1,
  );
  return point.distanceTo(start.clone().addScaledVector(direction, parameter));
}

function signedDistanceToPolygon(point, polygon) {
  let distance = Infinity;
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[previous];
    const b = polygon[index];
    distance = Math.min(distance, distancePointToSegment(point, a, b));
    if ((b.y > point.y) !== (a.y > point.y)
      && point.x < (a.x - b.x) * (point.y - b.y) / (a.y - b.y) + b.x) inside = !inside;
  }
  return inside ? -distance : distance;
}

function centrifugalMineDrumCheckHooks(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.72);

  const hookCount = 3;
  const sectorPitch = FULL_TURN / hookCount;
  const cycleDuration = 12;
  const readyDwellEnd = 0.6;
  const normalAccelerationEnd = 1.4;
  const catchTime = 4.6;
  const loadArrestEnd = 5.05;
  const caughtDwellEnd = 6.2;
  const springUnloadEnd = 7;
  const hookRetractionEnd = 8.1;
  const hookReleaseClearanceTime = 7.5;
  // The flange backs off far enough that each stud D lies clear of the arc
  // its hook sweeps while folding forward (counter-clockwise) again.
  const reliefAngle = -.9;
  const externalReturnEnd = 10.8;
  const normalAccelerationDuration = normalAccelerationEnd - readyDwellEnd;
  const runawayDuration = catchTime - normalAccelerationEnd;
  const normalAngularSpeed = 0.6;
  const tripAngularSpeed = 2;
  const centrifugalReleaseSpeed = 1.75;
  // Brown's hooks lean and barb forward (counter-clockwise, the runaway
  // direction); at rest they fold forward along the hub, and centrifugal
  // force swings them back out to the stop that the stud reaction seats.
  const retractedHookAngle = 1.4;
  const deployedHookAngle = 0;
  const normalAccelerationTravel =
    normalAngularSpeed * normalAccelerationDuration / 2;
  const runawayTravel =
    (normalAngularSpeed + tripAngularSpeed) * runawayDuration / 2;
  const readyFlangeAngle = -(normalAccelerationTravel + runawayTravel);
  const runawayStartAngle = readyFlangeAngle + normalAccelerationTravel;
  const hookPivotRadius = 2;
  // Brown's long straight hook bars (about 0.57 of A's radius) lean 14
  // degrees forward of radial and end in a forward barb. Stud D is caught in
  // the crook between the bar's forward face and the barb.
  const hookBarRadius = 0.14;
  const studRadius = 0.48;
  const hookLean = THREE.MathUtils.degToRad(14);
  const hookBarDirection = new THREE.Vector2(Math.cos(hookLean), Math.sin(hookLean));
  const hookForwardNormal = new THREE.Vector2(-Math.sin(hookLean), Math.cos(hookLean));
  const hookBarLength = 2.86;
  const hookContactAlong = 2.25;
  // The outer bar carries a 2 degree backward set at the stud contact, so the
  // contact is a real outline vertex whose normal bisects the two faces.
  const hookSet = THREE.MathUtils.degToRad(2);
  const contactVertex = hookBarDirection.clone().multiplyScalar(hookContactAlong);
  const outerBarDirection = rotateVector2(hookBarDirection, -hookSet);
  const outerForwardNormal = rotateVector2(hookForwardNormal, -hookSet);
  const barPoint = (along, offset) => contactVertex.clone()
    .addScaledVector(outerBarDirection, along - hookContactAlong)
    .addScaledVector(outerForwardNormal, offset);
  const hookCenterline = [
    new THREE.Vector2(0, 0),
    contactVertex.clone(),
    barPoint(hookBarLength, 0),
  ];
  // Pointed barb: square outer end, then a forward point whose inner edge
  // raked back toward the pivot forms the crook that holds stud D.
  const hookBarbOutline = [
    barPoint(2.6, -hookBarRadius),
    barPoint(3.0, -hookBarRadius),
    barPoint(2.8, 1.0),
    barPoint(2.75, hookBarRadius),
    barPoint(2.6, hookBarRadius),
  ];
  const hookContactIndex = 1;
  const hookContactLocal = hookCenterline[hookContactIndex];
  const contactCenterAtCatch = new THREE.Vector2(
    hookPivotRadius + hookContactLocal.x,
    hookContactLocal.y,
  );
  const contactNormalAtCatch = rotateVector2(hookForwardNormal, -hookSet / 2);
  const baseStudCenter = contactCenterAtCatch.clone().addScaledVector(
    contactNormalAtCatch,
    hookBarRadius + studRadius,
  );
  const studOrbitRadius = baseStudCenter.length();
  // Brown's studs D stand at 0, 120 and 240 degrees (right, upper left,
  // lower left), so the whole hook/stud pattern is phased to put them there.
  const patternPhase = -Math.atan2(baseStudCenter.y, baseStudCenter.x);
  const fixedFrameRadius = 5.3;
  const arrestFlangeRadius = 2.35;
  const ropeDrumRadius = 1.02;
  const fixedBackingZ = -0.78;
  const fixedBackingDepth = 0.14;
  const flangePlaneZ = -0.42;
  const flangeDepth = 0.38;
  const hookPlaneZ = 0.12;
  const ropeDrumPlaneZ = 0.44;
  const loadSideInertia = 0.85;
  const loadArrestDuration = loadArrestEnd - catchTime;
  const shockNaturalFrequency = Math.PI / (2 * loadArrestDuration);
  const shockSpringStiffness =
    loadSideInertia * shockNaturalFrequency ** 2;
  const maximumSpringDeflection =
    tripAngularSpeed / shockNaturalFrequency;
  const initialLoadKineticEnergy =
    loadSideInertia * tripAngularSpeed ** 2 / 2;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  // Brown draws framework A as a plain opaque plate.
  const backingMaterial = matte(0xd8d2c4, {
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  const flangeMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.52,
  });
  const drumMaterial = matte(PALETTE.driver, {
    metalness: 0.17,
    roughness: 0.49,
  });
  const studMaterial = matte(PALETTE.accent, {
    metalness: 0.2,
    roughness: 0.46,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.45,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'mine-shaft-side-framework-a';
  root.add(fixedFrame);

  const fixedBacking = makeAxialCylinder({
    depth: fixedBackingDepth,
    material: backingMaterial,
    radius: fixedFrameRadius,
    role: 'opaque-fixed-framework-a-backing-plate',
    segments: 96,
  });
  fixedBacking.position.z = fixedBackingZ;
  fixedFrame.add(fixedBacking);

  const frameRim = new THREE.Mesh(
    new THREE.TorusGeometry(fixedFrameRadius, 0.14, 16, 144),
    frameMaterial,
  );
  frameRim.position.z = fixedBackingZ + fixedBackingDepth / 2 + 0.035;
  frameRim.userData.role = 'fixed-circular-rim-of-framework-a';
  fixedFrame.add(frameRim);

  const studCenters = [];
  const studs = [];
  for (let index = 0; index < hookCount; index += 1) {
    const sectorAngle = patternPhase + sectorPitch * index;
    const studCenter = rotateVector2(baseStudCenter, sectorAngle);
    studCenters.push(studCenter);
    const support = makeRadialBeam({
      angle: studCenter.angle(),
      depth: 0.18,
      endRadius: fixedFrameRadius - 0.14,
      material: frameMaterial,
      role: `framework-a-stud-d-${index + 1}-radial-support`,
      startRadius: 2.75,
      thickness: 0.28,
      z: fixedBackingZ + 0.11,
    });
    fixedFrame.add(support);
    // Brown's studs stand directly on framework A, so each stud runs back
    // to the plate instead of relying on the undrawn radial support.
    const studBackZ = fixedBackingZ + fixedBackingDepth / 2;
    const studFrontZ = 0.52;
    const stud = makeAxialCylinder({
      depth: studFrontZ - studBackZ,
      material: studMaterial,
      radius: studRadius,
      role: `fixed-stud-d-${index + 1}`,
      segments: 48,
    });
    stud.position.set(studCenter.x, studCenter.y, (studFrontZ + studBackZ) / 2);
    stud.userData.fixedCenter = studCenter.clone();
    studs.push(stud);
    fixedFrame.add(stud);
  }

  const arrestFlange = new THREE.Group();
  arrestFlange.userData.role = 'catch-hook-flange-b';
  root.add(arrestFlange);

  const flangeDisk = makeAxialCylinder({
    depth: flangeDepth,
    material: flangeMaterial,
    radius: arrestFlangeRadius,
    role: 'rotating-circular-flange-b-carrying-three-hooks',
    segments: 96,
  });
  flangeDisk.position.z = flangePlaneZ;
  arrestFlange.add(flangeDisk);

  const flangeIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.13, 0.065),
    whiteMaterial,
  );
  flangeIndex.position.set(1.82, 0, flangePlaneZ + flangeDepth / 2 + 0.055);
  flangeIndex.userData.role = 'white-flange-b-speed-index';
  arrestFlange.add(flangeIndex);

  const hookPivots = [];
  const hooks = [];
  for (let index = 0; index < hookCount; index += 1) {
    const sectorAngle = patternPhase + sectorPitch * index;
    const pivotCarrier = new THREE.Group();
    pivotCarrier.position.set(
      Math.cos(sectorAngle) * hookPivotRadius,
      Math.sin(sectorAngle) * hookPivotRadius,
      hookPlaneZ,
    );
    pivotCarrier.rotation.z = sectorAngle;
    pivotCarrier.userData.flangeFixedPivot = true;
    pivotCarrier.userData.role = `check-hook-${index + 1}-pivot-carrier`;
    arrestFlange.add(pivotCarrier);

    const hook = makePolylineHook({
      centerline: hookCenterline,
      contactIndex: hookContactIndex,
      material: flangeMaterial,
      radius: hookBarRadius,
      role: `centrifugal-check-hook-${index + 1}`,
      whiteMaterial,
    });
    pivotCarrier.add(hook);

    const pivotBoss = makeAxialCylinder({
      depth: 0.58,
      material: inkMaterial,
      radius: 0.3,
      role: `check-hook-${index + 1}-pivot-pin`,
      segments: 40,
    });
    pivotBoss.position.z = 0;
    pivotCarrier.add(pivotBoss);

    const returnSpring = new THREE.Mesh(
      new THREE.TorusGeometry(0.39, 0.055, 10, 42, Math.PI * 1.72),
      studMaterial,
    );
    returnSpring.position.z = 0.17;
    returnSpring.userData.role = `check-hook-${index + 1}-torsion-return-spring`;
    pivotCarrier.add(returnSpring);

    hookPivots.push(pivotCarrier);
    hooks.push(hook);
  }

  const ropeDrum = new THREE.Group();
  ropeDrum.userData.role =
    'spring-isolated-load-side-rope-drum-recommended-by-brown';
  root.add(ropeDrum);

  const ropeDrumBody = makeAxialCylinder({
    depth: 0.7,
    material: drumMaterial,
    radius: ropeDrumRadius,
    role: 'load-side-rope-drum',
    segments: 72,
  });
  ropeDrumBody.position.z = ropeDrumPlaneZ;
  ropeDrum.add(ropeDrumBody);

  const ropeDrumRims = [-1, 1].map((side) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(ropeDrumRadius + 0.08, 0.075, 12, 72),
      inkMaterial,
    );
    rim.position.z = ropeDrumPlaneZ + side * 0.33;
    rim.userData.role = `rope-drum-${side < 0 ? 'rear' : 'front'}-rim`;
    ropeDrum.add(rim);
    return rim;
  });

  const ropeDrumIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.13, 0.07),
    whiteMaterial,
  );
  ropeDrumIndex.position.set(
    0.55,
    0,
    ropeDrumPlaneZ + 0.41,
  );
  ropeDrumIndex.userData.role = 'white-load-side-drum-speed-index';
  ropeDrum.add(ropeDrumIndex);

  const centerShaft = makeAxialCylinder({
    depth: 1.65,
    material: inkMaterial,
    radius: 0.3,
    role: 'coaxial-drum-shaft',
    segments: 40,
  });
  centerShaft.position.z = -0.02;
  root.add(centerShaft);

  const ropeWeb = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 4.75, 0.045),
    matte(PALETTE.ink, {
      opacity: 0.2,
      roughness: 0.76,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  );
  ropeWeb.position.set(0, -3.15, ropeDrumPlaneZ + 0.5);
  ropeWeb.userData.role = 'translucent-flat-hoisting-rope-web';
  root.add(ropeWeb);

  const ropeEdges = [-1, 1].map((side) => {
    const edge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 4.75, 16),
      inkMaterial,
    );
    edge.position.set(
      side * 0.38,
      -3.15,
      ropeDrumPlaneZ + 0.55,
    );
    edge.userData.role =
      `flat-hoisting-rope-${side < 0 ? 'left' : 'right'}-edge-cord`;
    root.add(edge);
    return edge;
  });

  const shockSpring = makeDynamicCable({
    color: PALETTE.accent,
    maxSegments: 56,
    radius: 0.055,
  });
  shockSpring.userData.role =
    'visible-torsional-shock-spring-between-flange-and-load-side-drum';
  root.add(shockSpring);

  const contactMarkers = studCenters.map((studCenter, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 20, 14),
      whiteMaterial,
    );
    marker.position.set(studCenter.x, studCenter.y, 0.3);
    marker.userData.role = `hook-${index + 1}-to-stud-d-contact-marker`;
    root.add(marker);
    return marker;
  });

  const hookAngleAtAngularSpeed = (angularSpeed) => {
    const squaredProgress = THREE.MathUtils.clamp(
      (angularSpeed ** 2 - centrifugalReleaseSpeed ** 2)
        / (tripAngularSpeed ** 2 - centrifugalReleaseSpeed ** 2),
      0,
      1,
    );
    return {
      angle: THREE.MathUtils.lerp(
        retractedHookAngle,
        deployedHookAngle,
        smootherStep01(squaredProgress),
      ),
      deploymentProgress: smootherStep01(squaredProgress),
      squaredSpeedProgress: squaredProgress,
    };
  };

  const rotatingRunState = (cycleTime) => {
    if (cycleTime <= readyDwellEnd) {
      return {
        angularAcceleration: 0,
        angularSpeed: 0,
        flangeAngle: readyFlangeAngle,
        phase: 'ready-dwell',
      };
    }
    if (cycleTime <= normalAccelerationEnd) {
      const u = (cycleTime - readyDwellEnd) / normalAccelerationDuration;
      return {
        angularAcceleration:
          normalAngularSpeed * smootherStepFirstDerivative(u)
          / normalAccelerationDuration,
        angularSpeed: normalAngularSpeed * smootherStep01(u),
        flangeAngle: readyFlangeAngle
          + normalAngularSpeed * normalAccelerationDuration
          * integratedSmootherStep01(u),
        phase: 'normal-startup',
      };
    }
    const u = (cycleTime - normalAccelerationEnd) / runawayDuration;
    return {
      angularAcceleration:
        (tripAngularSpeed - normalAngularSpeed)
        * smootherStepFirstDerivative(u) / runawayDuration,
      angularSpeed: normalAngularSpeed
        + (tripAngularSpeed - normalAngularSpeed) * smootherStep01(u),
      flangeAngle: runawayStartAngle
        + normalAngularSpeed * runawayDuration * u
        + (tripAngularSpeed - normalAngularSpeed) * runawayDuration
        * integratedSmootherStep01(u),
      phase: 'runaway-acceleration',
    };
  };

  const hookCentersAtPose = (flangeAngle, hookAngle) => Array.from(
    { length: hookCount },
    (_, index) => {
      const pivotAngle = flangeAngle + patternPhase + sectorPitch * index;
      const pivotCenter = new THREE.Vector2(
        Math.cos(pivotAngle) * hookPivotRadius,
        Math.sin(pivotAngle) * hookPivotRadius,
      );
      const contactCenter = pivotCenter.clone().add(
        rotateVector2(hookContactLocal, pivotAngle + hookAngle),
      );
      return { contactCenter, pivotCenter };
    },
  );

  const minimumHookStudGapAtPose = (flangeAngle, hookAngle) => {
    let minimumGap = Infinity;
    for (let hookIndex = 0; hookIndex < hookCount; hookIndex += 1) {
      const pivotAngle = flangeAngle + patternPhase + sectorPitch * hookIndex;
      const pivotCenter = new THREE.Vector2(
        Math.cos(pivotAngle) * hookPivotRadius,
        Math.sin(pivotAngle) * hookPivotRadius,
      );
      const worldPoints = hookCenterline.map((point) => pivotCenter.clone().add(
        rotateVector2(point, pivotAngle + hookAngle),
      ));
      const worldBarb = hookBarbOutline.map((point) => pivotCenter.clone().add(
        rotateVector2(point, pivotAngle + hookAngle),
      ));
      for (const studCenter of studCenters) {
        for (let segment = 0; segment < worldPoints.length - 1; segment += 1) {
          const gap = distancePointToSegment(
            studCenter,
            worldPoints[segment],
            worldPoints[segment + 1],
          ) - hookBarRadius - studRadius;
          minimumGap = Math.min(minimumGap, gap);
        }
        minimumGap = Math.min(
          minimumGap,
          signedDistanceToPolygon(studCenter, worldBarb) - studRadius,
        );
      }
    }
    return minimumGap;
  };

  const springPointsAtPose = (flangeAngle, ropeDrumAngle) => {
    const pointCount = 57;
    const springTurns = 3;
    const innerRadius = 0.7;
    const outerRadius = 1.7;
    return Array.from({ length: pointCount }, (_, index) => {
      const progress = index / (pointCount - 1);
      const radius = THREE.MathUtils.lerp(innerRadius, outerRadius, progress);
      const angle = THREE.MathUtils.lerp(
        ropeDrumAngle,
        flangeAngle + springTurns * FULL_TURN,
        progress,
      );
      return new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        0.68,
      );
    });
  };

  const stateAtTime = (time) => {
    const cycleTime = wrappedCycleTime(time, cycleDuration);
    let flangeAngle;
    let flangeAngularAcceleration;
    let flangeAngularSpeed;
    let hookAngle;
    let hookDeploymentProgress;
    let loadAngularAcceleration;
    let loadAngularSpeed;
    let phase;
    let ropeDrumAngle;
    let springDeflection;
    let springPotentialEnergy;

    if (cycleTime < catchTime) {
      const run = rotatingRunState(cycleTime);
      const hook = hookAngleAtAngularSpeed(run.angularSpeed);
      flangeAngle = run.flangeAngle;
      flangeAngularAcceleration = run.angularAcceleration;
      flangeAngularSpeed = run.angularSpeed;
      hookAngle = hook.angle;
      hookDeploymentProgress = hook.deploymentProgress;
      loadAngularAcceleration = run.angularAcceleration;
      loadAngularSpeed = run.angularSpeed;
      phase = run.phase;
      ropeDrumAngle = run.flangeAngle;
      springDeflection = 0;
      springPotentialEnergy = 0;
    } else if (cycleTime <= loadArrestEnd) {
      const arrestTime = cycleTime - catchTime;
      const springPhase = shockNaturalFrequency * arrestTime;
      springDeflection =
        tripAngularSpeed / shockNaturalFrequency * Math.sin(springPhase);
      loadAngularSpeed = tripAngularSpeed * Math.cos(springPhase);
      loadAngularAcceleration =
        -tripAngularSpeed * shockNaturalFrequency * Math.sin(springPhase);
      flangeAngle = 0;
      flangeAngularAcceleration = 0;
      flangeAngularSpeed = 0;
      hookAngle = deployedHookAngle;
      hookDeploymentProgress = 1;
      phase = arrestTime <= 1e-14 ? 'catch-impact' : 'spring-cushioned-arrest';
      ropeDrumAngle = springDeflection;
      springPotentialEnergy =
        shockSpringStiffness * springDeflection ** 2 / 2;
    } else if (cycleTime <= caughtDwellEnd) {
      flangeAngle = 0;
      flangeAngularAcceleration = 0;
      flangeAngularSpeed = 0;
      hookAngle = deployedHookAngle;
      hookDeploymentProgress = 1;
      loadAngularAcceleration = 0;
      loadAngularSpeed = 0;
      phase = 'caught-load-held-on-spring';
      ropeDrumAngle = maximumSpringDeflection;
      springDeflection = maximumSpringDeflection;
      springPotentialEnergy = initialLoadKineticEnergy;
    } else if (cycleTime <= springUnloadEnd) {
      const unload = transitionState(
        cycleTime,
        caughtDwellEnd,
        springUnloadEnd,
        maximumSpringDeflection,
        0,
      );
      flangeAngle = 0;
      flangeAngularAcceleration = 0;
      flangeAngularSpeed = 0;
      hookAngle = deployedHookAngle;
      hookDeploymentProgress = 1;
      loadAngularAcceleration = unload.acceleration;
      loadAngularSpeed = unload.velocity;
      phase = 'external-spring-unload';
      ropeDrumAngle = unload.value;
      springDeflection = unload.value;
      springPotentialEnergy =
        shockSpringStiffness * unload.value ** 2 / 2;
    } else if (cycleTime <= hookRetractionEnd) {
      const retraction = transitionState(
        cycleTime,
        hookReleaseClearanceTime,
        hookRetractionEnd,
        deployedHookAngle,
        retractedHookAngle,
      );
      const relief = transitionState(cycleTime, springUnloadEnd, hookReleaseClearanceTime, 0, reliefAngle);
      flangeAngle = relief.value;
      flangeAngularAcceleration = relief.acceleration;
      flangeAngularSpeed = relief.velocity;
      hookAngle = retraction.value;
      hookDeploymentProgress = THREE.MathUtils.clamp(
        (retraction.value - retractedHookAngle)
          / (deployedHookAngle - retractedHookAngle),
        0,
        1,
      );
      loadAngularAcceleration = relief.acceleration;
      loadAngularSpeed = relief.velocity;
      phase = 'external-hook-retraction';
      ropeDrumAngle = flangeAngle;
      springDeflection = 0;
      springPotentialEnergy = 0;
    } else if (cycleTime <= externalReturnEnd) {
      const reset = transitionState(
        cycleTime,
        hookRetractionEnd,
        externalReturnEnd,
        reliefAngle,
        readyFlangeAngle,
      );
      flangeAngle = reset.value;
      flangeAngularAcceleration = reset.acceleration;
      flangeAngularSpeed = reset.velocity;
      hookAngle = retractedHookAngle;
      hookDeploymentProgress = 0;
      loadAngularAcceleration = reset.acceleration;
      loadAngularSpeed = reset.velocity;
      phase = 'external-rewind-and-reset';
      ropeDrumAngle = reset.value;
      springDeflection = 0;
      springPotentialEnergy = 0;
    } else {
      flangeAngle = readyFlangeAngle;
      flangeAngularAcceleration = 0;
      flangeAngularSpeed = 0;
      hookAngle = retractedHookAngle;
      hookDeploymentProgress = 0;
      loadAngularAcceleration = 0;
      loadAngularSpeed = 0;
      phase = 'ready-dwell';
      ropeDrumAngle = readyFlangeAngle;
      springDeflection = 0;
      springPotentialEnergy = 0;
    }

    const hookCenters = hookCentersAtPose(flangeAngle, hookAngle);
    const contactActive = cycleTime >= catchTime
      && cycleTime <= springUnloadEnd + 1e-14;
    const pairedContactClearances = hookCenters.map((hookCenter, index) => (
      hookCenter.contactCenter.distanceTo(studCenters[index])
        - hookBarRadius - studRadius
    ));
    const springPoints = springPointsAtPose(flangeAngle, ropeDrumAngle);
    const loadKineticEnergy =
      loadSideInertia * loadAngularSpeed ** 2 / 2;

    return {
      catchImpactVelocityJump: phase === 'catch-impact'
        ? -tripAngularSpeed
        : 0,
      contactActive,
      cycleTime,
      flangeAngle,
      flangeAngularAcceleration,
      flangeAngularSpeed,
      hookAngle,
      hookCenters,
      hookDeploymentProgress,
      loadAngularAcceleration,
      loadAngularSpeed,
      loadKineticEnergy,
      minimumHookStudGap: minimumHookStudGapAtPose(flangeAngle, hookAngle),
      pairedContactClearances,
      phase,
      ropeDrumAngle,
      ropePayout: ropeDrumRadius * (ropeDrumAngle - readyFlangeAngle),
      springDeflection,
      springPoints,
      springPotentialEnergy,
    };
  };

  const solidClearanceAtTime = (time) => {
    const state = stateAtTime(time);
    return {
      flangeToFixedBackingAxialClearance:
        flangePlaneZ - flangeDepth / 2
        - (fixedBackingZ + fixedBackingDepth / 2),
      hookToStudMinimumGap: state.minimumHookStudGap,
      studToFrameRimRadialClearance:
        fixedFrameRadius - 0.14 - studOrbitRadius - studRadius,
    };
  };

  root.userData.archetype =
    'threefold-centrifugal-check-hooks-latching-fixed-studs-with-spring-isolated-rope-drum';
  root.userData.blocks = {
    arrestFlange,
    centerShaft,
    contactMarkers,
    fixedBacking,
    fixedFrame,
    flangeDisk,
    flangeIndex,
    frameRim,
    hookPivots,
    hooks,
    ropeDrum,
    ropeDrumBody,
    ropeDrumIndex,
    ropeDrumRims,
    ropeEdges,
    ropeWeb,
    shockSpring,
    studs,
  };
  root.userData.cameraDistanceScale = 0.94;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.2, -4.45, -1),
    new THREE.Vector3(4.2, 4.05, 1),
  );
  root.userData.canonicalTimes = {
    catchImpact: catchTime,
    fullyArrestedLoad: loadArrestEnd,
    hooksRetracted: hookRetractionEnd,
    sourcePose: catchTime,
    springFullyUnloaded: springUnloadEnd,
  };
  root.userData.geometry = {
    arrestFlangeRadius,
    baseStudCenter,
    contactCenterAtCatch,
    contactNormalAtCatch,
    fixedBackingDepth,
    fixedBackingZ,
    fixedFrameRadius,
    flangeDepth,
    flangePlaneZ,
    hookBarbOutline,
    hookBarLength,
    hookBarRadius,
    hookCenterline,
    hookLean,
    patternPhase,
    hookContactIndex,
    hookContactLocal,
    hookCount,
    hookPivotRadius,
    retractedHookAngle,
    ropeDrumPlaneZ,
    ropeDrumRadius,
    sectorPitch,
    studCenters,
    studOrbitRadius,
    studRadius,
  };
  root.userData.mechanism =
    'runaway-drum-centrifugally-deploys-three-flange-b-hooks-into-fixed-studs-d-on-framework-a-while-a-load-side-spring-limits-shock';
  root.userData.safetyFunction = {
    arrestMember: 'catch-hook-flange-b',
    catchImpactIsIntentionalVelocityDiscontinuity: true,
    externalResetRequired: true,
    fixedMember: 'mine-shaft-side-framework-a-and-three-studs-d',
    idealSymmetricContactCount: 3,
    loadMember: 'spring-isolated-rope-drum',
    shockProtectionRequiredBySource: true,
  };
  root.userData.shockIsolation = {
    initialLoadKineticEnergy,
    loadArrestDuration,
    loadSideInertia,
    maximumSpringDeflection,
    model: 'lossless-quarter-cycle-torsional-spring-arrest-followed-by-held-load',
    naturalFrequency: shockNaturalFrequency,
    springStiffness: shockSpringStiffness,
  };
  root.userData.solidClearanceAtTime = solidClearanceAtTime;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official movement page marks its animation unavailable',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate253: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'three equally spaced check-hooks pivot on flange B inside fixed circular framework A and face three fixed studs D',
      measurementUncertaintyPixels: 5,
      officialAnimationAvailable: false,
      rasterDrumFlangeB: {
        centerX: 266,
        centerY: 281,
        radius: 103,
      },
      rasterFixedFrameA: {
        centerX: 263,
        centerY: 260,
        radius: 232,
      },
      rasterHookPivots: [
        { centerX: 260, centerY: 178, radius: 15 },
        { centerX: 343, centerY: 284, radius: 16 },
        { centerX: 202, centerY: 308, radius: 15 },
      ],
      rasterRopeBounds: {
        bottom: 524,
        left: 210,
        right: 318,
        top: 205,
      },
      rasterStudsD: [
        { centerX: 171, centerY: 95, radius: 21 },
        { centerX: 455, centerY: 250, radius: 22 },
        { centerX: 165, centerY: 424, radius: 22 },
      ],
      view:
        'front-elevation-through-fixed-frame-studs-hook-pivots-drum-flange-and-rope',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 65,
      edition: 21,
      illustrationPage: 64,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    catchTime,
    caughtDwellEnd,
    cycleClosure: cycleDuration,
    demonstrationPeriod: cycleDuration,
    externalReturnEnd,
    hookRetractionEnd,
    hookReleaseClearanceTime,
    reliefAngle,
    loadArrestEnd,
    normalAccelerationEnd,
    readyDwellEnd,
    springUnloadEnd,
  };
  root.userData.transmission = {
    centrifugalDemandLaw: 'proportional-to-omega-squared',
    centrifugalReleaseSpeed,
    deployedHookAngle,
    hookCount,
    normalAngularSpeed,
    studCount: hookCount,
    tripAngularSpeed,
  };

  // Brown draws the hooks deployed just before the studs reach them, so the
  // displayed clock opens at that instant (4.45 s of the canonical cycle);
  // stateAtTime and the timeline stay in canonical cycle time.
  const displayTimeOffset = 4.45;
  root.userData.displayTimeOffset = displayTimeOffset;
  const update = (time) => {
    const state = stateAtTime(time + displayTimeOffset);
    arrestFlange.rotation.z = state.flangeAngle;
    ropeDrum.rotation.z = state.ropeDrumAngle;
    hooks.forEach((hook) => {
      hook.rotation.z = state.hookAngle;
    });
    shockSpring.userData.setPoints(state.springPoints);
    shockSpring.userData.currentPoints = state.springPoints.map(
      (point) => point.clone(),
    );
    contactMarkers.forEach((marker, index) => {
      const hookCenter = state.hookCenters[index].contactCenter;
      const studCenter = studCenters[index];
      const normal = studCenter.clone().sub(hookCenter).normalize();
      marker.position.set(
        hookCenter.x + normal.x * hookBarRadius,
        hookCenter.y + normal.y * hookBarRadius,
        0.3,
      );
      // Contacts stay in userData; Brown draws no contact markers.
      marker.visible = false;
    });
    root.userData.contacts = {
      active: state.contactActive,
      pairedClearances: state.pairedContactClearances,
      simultaneousIdealContacts: state.contactActive ? hookCount : 0,
    };
    root.userData.kinematics = state;
  };
  correctCheckHookJournals(root);
  update(0);
  markShadows(root);
  return {
    root,
    update,
    // Brown draws a flat face view of framework A and flange B.
    cameraDirection: new THREE.Vector3(0, 0, 1),
  };
}

export function createAuthoredCheckHookMovement(movement) {
  if (movement.id !== 253) return null;
  const result = centrifugalMineDrumCheckHooks(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
