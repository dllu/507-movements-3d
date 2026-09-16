import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {plate,poly,circle,polygonClipping,ring} from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const HALF_TURN = Math.PI;

const FOLLOWER_NOSE_ARC = [
  4,
  2.5,
  0,
  0.5,
  5.759587,
  0.523599,
];

const POSITIVE_FIXED_PROFILE = [
  [4, 0.127285, 1.149067, 4.997495, 0.147787, 2.297989],
  [4, -1.200599, 2.641283, 3, 2.297989, 3.649761],
  [4, 3.092475, 1.587961, 2.000003, 5.180658, 0.149044],
  [4, -3.092475, -1.587961, 2.000003, 2.039065, 3.290637],
  [4, 0, 0, 4, 2.841732, 3.092387],
];

const NEGATIVE_FIXED_PROFILE = [
  [4, -0.127285, -1.149067, 4.997495, 3.28938, 5.439581],
  [4, 1.200599, -2.641283, 3, 5.439581, 0.508169],
  [4, -3.092475, -1.587961, 2.000003, 2.039065, 3.290637],
  [4, 3.092475, 1.587961, 2.000003, 5.180658, 0.149044],
  [4, 0, 0, 4, 5.983325, 6.23398],
];

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
    new THREE.TubeGeometry(curve, points.length * 4, radius, 10, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function arcPoints(radius, startAngle, endAngle, z, count = 72) {
  const points = [];
  for (let index = 0; index <= count; index += 1) {
    const angle = THREE.MathUtils.lerp(
      startAngle,
      endAngle,
      index / count,
    );
    points.push(new THREE.Vector3(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
      z,
    ));
  }
  return points;
}

function normalizedAngle(angle) {
  return THREE.MathUtils.euclideanModulo(angle, FULL_TURN);
}

function angleInArc(angle, arc) {
  if (arc[0] === 6) return true;
  const candidate = normalizedAngle(angle);
  const start = normalizedAngle(arc[4]);
  const end = normalizedAngle(arc[5]);
  if (candidate === start || candidate === end) return true;
  const between = start > end
    ? candidate > start || candidate < end
    : candidate > start && candidate < end;
  return arc[0] === 2 ? !between : between;
}

function pointOnArc(arc, angle) {
  return new THREE.Vector2(
    arc[1] + Math.cos(angle) * arc[3],
    arc[2] + Math.sin(angle) * arc[3],
  );
}

function arcStartPoint(arc) {
  return pointOnArc(arc, arc[4]);
}

function arcEndPoint(arc) {
  return pointOnArc(arc, arc[5]);
}

function transformArcToRadialGuide(arc, guideAngle) {
  const cosine = Math.cos(guideAngle);
  const sine = Math.sin(guideAngle);
  return [
    arc[0],
    arc[1] * cosine + arc[2] * sine,
    -arc[1] * sine + arc[2] * cosine,
    arc[3],
    arc[4] - guideAngle,
    arc[5] - guideAngle,
  ];
}

function xIntersectionAtY(y, arc, chooseMinimum) {
  const offsetY = y - arc[2];
  const radicand = arc[3] ** 2 - offsetY ** 2;
  if (radicand < 0) return Number.NaN;
  const offsetX = Math.sqrt(Math.max(0, radicand));
  const candidates = [
    new THREE.Vector2(arc[1] - offsetX, y),
    new THREE.Vector2(arc[1] + offsetX, y),
  ].filter((point) => angleInArc(
    Math.atan2(point.y - arc[2], point.x - arc[1]),
    arc,
  ));
  if (candidates.length === 0) return Number.NaN;
  if (candidates.length === 1) return candidates[0].x;
  return chooseMinimum
    ? Math.min(candidates[0].x, candidates[1].x)
    : Math.max(candidates[0].x, candidates[1].x);
}

function exactSourceCamRoot(guideAngle, fixedProfile) {
  const follower = FOLLOWER_NOSE_ARC;
  let rootDistance = 5;
  let activeConstraint = 'guide-limit';
  const restrict = (candidate, label) => {
    if (candidate > 0 && candidate < rootDistance) {
      rootDistance = candidate;
      activeConstraint = label;
    }
  };

  for (let index = 0; index < fixedProfile.length; index += 1) {
    const fixed = transformArcToRadialGuide(
      fixedProfile[index],
      guideAngle,
    );
    for (const [endpointName, endpoint] of [
      ['follower-start', arcStartPoint(follower)],
      ['follower-end', arcEndPoint(follower)],
    ]) {
      const fixedX = xIntersectionAtY(endpoint.y, fixed, true);
      if (Number.isFinite(fixedX)) {
        restrict(
          fixedX - endpoint.x,
          `${index}:${endpointName}-on-fixed-arc`,
        );
      }
    }
    for (const [endpointName, endpoint] of [
      ['fixed-start', arcStartPoint(fixed)],
      ['fixed-end', arcEndPoint(fixed)],
    ]) {
      const followerX = xIntersectionAtY(endpoint.y, follower, false);
      if (Number.isFinite(followerX)) {
        restrict(
          endpoint.x - followerX,
          `${index}:${endpointName}-on-follower-arc`,
        );
      }
    }

    if (follower[3] < fixed[3]) {
      const radiusDifference = fixed[3] - follower[3];
      const centerYDifference = follower[2] - fixed[2];
      if (Math.abs(centerYDifference) <= radiusDifference) {
        const contactAngle = Math.asin(
          centerYDifference / radiusDifference,
        );
        if (angleInArc(contactAngle, follower)
          && angleInArc(contactAngle, fixed)) {
          restrict(
            fixed[1] + radiusDifference * Math.cos(contactAngle)
              - follower[1],
            `${index}:internal-arc-tangency`,
          );
        }
      }
    }

    const centerYDifference = follower[2] - fixed[2];
    const radiusSum = follower[3] + fixed[3];
    if (Math.abs(centerYDifference) <= radiusSum) {
      const contactAngle = Math.asin(centerYDifference / radiusSum);
      if (angleInArc(Math.PI - contactAngle, fixed)
        && angleInArc(FULL_TURN - contactAngle, follower)) {
        restrict(
          fixed[1] - radiusSum * Math.cos(contactAngle) - follower[1],
          `${index}:external-arc-tangency`,
        );
      }
    }
  }
  return { activeConstraint, rootDistance };
}

function radialPistonRotaryEngine(movement) {
  const root = new THREE.Group();
  const sourceCanvasControlPeriod = 4;
  const sourceHubAdvancePerControlPeriod = 1.5 * Math.PI;
  const inputAngularSpeed = sourceHubAdvancePerControlPeriod
    / sourceCanvasControlPeriod;
  const cycleDuration = FULL_TURN / inputAngularSpeed;
  const sourceScale = 0.48;
  const sourceHubRadius = 4;
  const sourceFollowerNoseCenter = 2.5;
  const sourceFollowerNoseRadius = 0.5;
  const sourcePistonBodyEnd = 2.933013;
  const sourcePistonHalfWidth = 0.25;
  const hubRadius = sourceHubRadius * sourceScale;
  const followerNoseCenter = sourceFollowerNoseCenter * sourceScale;
  const followerNoseRadius = sourceFollowerNoseRadius * sourceScale;
  const pistonBodyEnd = sourcePistonBodyEnd * sourceScale;
  const pistonHalfWidth = sourcePistonHalfWidth * sourceScale;
  const shaftRadius = sourceScale;
  const cylinderInnerRadius = 7 * sourceScale;
  const cylinderOuterRadius = 7 * sourceScale;

  const sourceRadialRootAtInputAngle = (inputAngle) => {
    const canonicalAngle = THREE.MathUtils.euclideanModulo(
      inputAngle,
      HALF_TURN,
    );
    const positive = exactSourceCamRoot(
      canonicalAngle,
      POSITIVE_FIXED_PROFILE,
    );
    const negative = exactSourceCamRoot(
      canonicalAngle + HALF_TURN,
      NEGATIVE_FIXED_PROFILE,
    );
    const averagedSourceRoot = (
      positive.rootDistance + negative.rootDistance
    ) / 2;
    return {
      activeNegativeConstraint: negative.activeConstraint,
      activePositiveConstraint: positive.activeConstraint,
      canonicalAngle,
      negativeSourceRoot: negative.rootDistance,
      positiveSourceRoot: positive.rootDistance,
      sourceRoot: Math.max(1, averagedSourceRoot),
      sourceSymmetryRoundingDifference:
        positive.rootDistance - negative.rootDistance,
    };
  };

  const radialRootAtInputAngle = (inputAngle) => (
    sourceRadialRootAtInputAngle(inputAngle).sourceRoot * sourceScale
  );

  const derivativeStep = 2e-5;
  const radialDerivativesAtInputAngle = (inputAngle) => {
    const center = radialRootAtInputAngle(inputAngle);
    const before = radialRootAtInputAngle(inputAngle - derivativeStep);
    const after = radialRootAtInputAngle(inputAngle + derivativeStep);
    return {
      radialPosition: center,
      radialPositionPrime: (after - before) / (2 * derivativeStep),
      radialPositionSecond: (after - 2 * center + before)
        / derivativeStep ** 2,
    };
  };

  let sourceMinimumRoot = Infinity;
  let sourceMaximumRoot = -Infinity;
  let sourceMaximumSymmetryRoundingDifference = 0;
  for (let sample = 0; sample < 8192; sample += 1) {
    const sourceState = sourceRadialRootAtInputAngle(
      HALF_TURN * sample / 8192,
    );
    sourceMinimumRoot = Math.min(
      sourceMinimumRoot,
      sourceState.sourceRoot,
    );
    sourceMaximumRoot = Math.max(
      sourceMaximumRoot,
      sourceState.sourceRoot,
    );
    sourceMaximumSymmetryRoundingDifference = Math.max(
      sourceMaximumSymmetryRoundingDifference,
      Math.abs(sourceState.sourceSymmetryRoundingDifference),
    );
  }

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const sourceCam = sourceRadialRootAtInputAngle(inputAngle);
    const radial = radialDerivativesAtInputAngle(inputAngle);
    const cosine = Math.cos(inputAngle);
    const sine = Math.sin(inputAngle);
    const unitRadial = new THREE.Vector3(cosine, sine, 0);
    const unitTangent = new THREE.Vector3(-sine, cosine, 0);
    const positivePistonRoot = unitRadial.clone().multiplyScalar(
      radial.radialPosition,
    );
    const positivePistonRootPrime = unitTangent.clone().multiplyScalar(
      radial.radialPosition,
    ).addScaledVector(unitRadial, radial.radialPositionPrime);
    const positivePistonRootSecond = unitRadial.clone().multiplyScalar(
      radial.radialPositionSecond - radial.radialPosition,
    ).addScaledVector(
      unitTangent,
      2 * radial.radialPositionPrime,
    );
    const positivePistonRootVelocity = positivePistonRootPrime.clone()
      .multiplyScalar(inputSpeed);
    const positivePistonRootAcceleration = positivePistonRootSecond.clone()
      .multiplyScalar(inputSpeed ** 2)
      .addScaledVector(positivePistonRootPrime, inputAcceleration);
    const negativePistonRoot = positivePistonRoot.clone().multiplyScalar(-1);
    const negativePistonRootPrime = positivePistonRootPrime.clone()
      .multiplyScalar(-1);
    const negativePistonRootSecond = positivePistonRootSecond.clone()
      .multiplyScalar(-1);
    const negativePistonRootVelocity = positivePistonRootVelocity.clone()
      .multiplyScalar(-1);
    const negativePistonRootAcceleration = positivePistonRootAcceleration
      .clone().multiplyScalar(-1);
    const noseCenterRadius = radial.radialPosition + followerNoseCenter;
    const noseOuterRadius = noseCenterRadius + followerNoseRadius;
    const positiveNoseCenter = unitRadial.clone().multiplyScalar(
      noseCenterRadius,
    );
    const negativeNoseCenter = positiveNoseCenter.clone().multiplyScalar(-1);
    const positiveOuterTip = unitRadial.clone().multiplyScalar(
      noseOuterRadius,
    );
    const negativeOuterTip = positiveOuterTip.clone().multiplyScalar(-1);
    const relativeRadialSpeed = radial.radialPositionPrime * inputSpeed;
    const relativeRadialAcceleration = radial.radialPositionSecond
      * inputSpeed ** 2
      + radial.radialPositionPrime * inputAcceleration;

    return {
      activeNegativeConstraint: sourceCam.activeNegativeConstraint,
      activePositiveConstraint: sourceCam.activePositiveConstraint,
      bothPistonsPressurized: true,
      canonicalCamAngle: sourceCam.canonicalAngle,
      inputAcceleration,
      inputAngle,
      inputSpeed,
      negativeNoseCenter,
      negativeOuterTip,
      negativePistonRoot,
      negativePistonRootAcceleration,
      negativePistonRootPrime,
      negativePistonRootSecond,
      negativePistonRootVelocity,
      negativeSourceRoot: sourceCam.negativeSourceRoot,
      noseCenterRadius,
      noseOuterRadius,
      positiveNoseCenter,
      positiveOuterTip,
      positivePistonRoot,
      positivePistonRootAcceleration,
      positivePistonRootPrime,
      positivePistonRootSecond,
      positivePistonRootVelocity,
      positiveSourceRoot: sourceCam.positiveSourceRoot,
      radialPosition: radial.radialPosition,
      radialPositionPrime: radial.radialPositionPrime,
      radialPositionSecond: radial.radialPositionSecond,
      relativeRadialAcceleration,
      relativeRadialSpeed,
      rotorAngle: inputAngle,
      rotorAngularAcceleration: inputAcceleration,
      rotorAngularSpeed: inputSpeed,
      sourceCamControlPhase:
        inputAngle / sourceHubAdvancePerControlPeriod,
      sourceRadialPosition: sourceCam.sourceRoot,
      sourceSymmetryRoundingDifference:
        sourceCam.sourceSymmetryRoundingDifference,
      unitRadial,
      unitTangent,
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
    cycleDuration,
    cylinderInnerRadius,
    cylinderOuterRadius,
    derivativeStep,
    followerNoseCenter,
    followerNoseRadius,
    hubRadius,
    inputAngularSpeed,
    pistonBodyEnd,
    pistonHalfWidth,
    shaftRadius,
    sourceCanvasControlPeriod,
    sourceFollowerNoseCenter,
    sourceFollowerNoseRadius,
    sourceHubAdvancePerControlPeriod,
    sourceHubRadius,
    sourceMaximumRoot,
    sourceMaximumSymmetryRoundingDifference,
    sourceMinimumRoot,
    sourcePistonBodyEnd,
    sourcePistonHalfWidth,
    sourceScale,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.24,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.41,
  });
  const hubMaterial = matte(PALETTE.driven, {
    metalness: 0.21,
    roughness: 0.46,
  });
  const pistonMaterial = matte(PALETTE.driver, {
    metalness: 0.20,
    roughness: 0.46,
  });
  const steamMaterial = matte(0xe66f4a, {
    opacity: 0.21,
    roughness: 0.60,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const exhaustMaterial = matte(0x4a93a8, {
    opacity: 0.18,
    roughness: 0.64,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  // Join the same source arcs used by the radial solver into the actual
  // closed chamber. Their printed endpoints differ by source rounding only.
  const chamberArcs = [POSITIVE_FIXED_PROFILE[2], POSITIVE_FIXED_PROFILE[0],
    POSITIVE_FIXED_PROFILE[1], POSITIVE_FIXED_PROFILE[4], POSITIVE_FIXED_PROFILE[3],
    NEGATIVE_FIXED_PROFILE[0], NEGATIVE_FIXED_PROFILE[1], NEGATIVE_FIXED_PROFILE[4]];
  const chamberClearanceScale = 1.00002;
  const chamberOutline = chamberArcs.flatMap(arc => {
    const sweep = normalizedAngle(arc[5]-arc[4]), count=Math.ceil(sweep/0.004);
    return Array.from({length:count},(_,i)=>pointOnArc(arc,arc[4]+sweep*i/count)
      .multiplyScalar(sourceScale*chamberClearanceScale).toArray());
  });
  const rectangle = (left,bottom,right,top)=>poly([[left,bottom],[right,bottom],[right,top],[left,top]]);
  const shell = polygonClipping.difference(poly(circle([0,0],cylinderOuterRadius,512)),poly(chamberOutline));
  const leftRegion = rectangle(-5,-0.9,-1.8,0.9), rightRegion = rectangle(1.8,-0.9,5,0.9);
  const abutmentSections = {left:polygonClipping.intersection(shell,leftRegion),right:polygonClipping.intersection(shell,rightRegion)};
  const remainingShell = polygonClipping.difference(shell,leftRegion,rightRegion);
  const topSection = polygonClipping.intersection(remainingShell,rectangle(-5,0,5,5));
  const bottomSection = polygonClipping.intersection(remainingShell,rectangle(-5,-5,5,0));
  const topHousingBack = new THREE.Mesh(plate(topSection,-0.24,0.83),frameMaterial);
  topHousingBack.userData.role = 'fixed-upper-body-of-cylinder';
  const bottomHousingBack = new THREE.Mesh(plate(bottomSection,-0.24,0.83),frameMaterial);
  bottomHousingBack.userData.role = 'fixed-lower-body-of-cylinder';
  const upperInnerWall = new THREE.Mesh(plate(topSection,0.83,0.87),frameMaterial);
  upperInnerWall.userData.role = 'fixed-upper-inner-wall-of-cylinder';
  const lowerInnerWall = new THREE.Mesh(plate(bottomSection,0.83,0.87),frameMaterial);
  lowerInnerWall.userData.role = 'fixed-lower-inner-wall-of-cylinder';
  root.add(topHousingBack,bottomHousingBack,upperInnerWall,lowerInnerWall);

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(6.40, 0.28, 1.44),
    frameMaterial,
  );
  foundation.position.set(0, -cylinderOuterRadius-0.14, -0.14);
  foundation.userData.role = 'fixed-foundation-of-radial-piston-engine';
  root.add(foundation);

  const makeStationaryAbutment = (side) => {
    const group = new THREE.Group();
    group.userData.role = side < 0
      ? 'left-stationary-abutment-D'
      : 'right-stationary-abutment-D';
    const section=side<0?abutmentSections.left:abutmentSections.right;
    const body = new THREE.Mesh(plate(section,-0.24,0.83),frameMaterial);
    body.userData.role = side < 0 ? 'left-fixed-port-body' : 'right-fixed-port-body';
    const nose = new THREE.Mesh(plate(section,0.83,0.87),frameMaterial);
    nose.userData.role = side < 0 ? 'left-inward-contact-nose-of-D' : 'right-inward-contact-nose-of-D';
    group.add(body,nose);
    return { body, group, nose };
  };
  const leftAbutment = makeStationaryAbutment(-1);
  const rightAbutment = makeStationaryAbutment(1);
  root.add(leftAbutment.group, rightAbutment.group);

  const rotor = new THREE.Group();
  rotor.userData.role = 'hub-C-fast-on-main-shaft-B';
  const hubC = cylinderAlongZ(hubRadius, 0.64, hubMaterial, 72);
  const hubBore=shaftRadius+0.004, grooveHalfWidth=pistonHalfWidth+0.004;
  const hubFront=plate(polygonClipping.difference(poly(circle([0,0],hubRadius,512)),
    poly(circle([0,0],hubBore,128)),rectangle(-hubRadius-0.01,-grooveHalfWidth,hubRadius+0.01,grooveHalfWidth)),0.18,0.42);
  const hubBack=ring(hubBore,hubRadius,-0.22,0.18,512);
  hubFront.deleteAttribute('uv');hubBack.deleteAttribute('color');
  hubC.geometry.dispose();hubC.geometry=mergeGeometries([hubBack,hubFront]);hubBack.dispose();hubFront.dispose();
  hubC.rotation.set(0,0,0);hubC.position.z = 0;
  hubC.userData.role = 'rotating-hub-C-with-two-opposed-radial-grooves';
  rotor.add(hubC);
  const groove = new THREE.Mesh(
    new THREE.BoxGeometry(2 * hubRadius - 0.10, 0.25, 0.12),
    darkMaterial,
  );
  groove.geometry.dispose();
  groove.geometry=plate(polygonClipping.difference(rectangle(-hubRadius+0.05,-grooveHalfWidth,hubRadius-0.05,grooveHalfWidth),
    poly(circle([0,0],hubBore,128))),0.17,0.18);
  groove.position.z = 0;
  groove.userData.role = 'diametral-guide-groove-in-hub-C';
  rotor.add(groove);

  const makeRadialPiston = (side) => {
    const group = new THREE.Group();
    group.rotation.z = side < 0 ? Math.PI : 0;
    group.userData.role = side < 0
      ? 'negative-radial-sliding-piston-A'
      : 'positive-radial-sliding-piston-A';
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(pistonBodyEnd, 2 * pistonHalfWidth, 0.54),
      pistonMaterial,
    );
    body.position.set(pistonBodyEnd / 2, 0, 0.46);
    body.userData.role = side < 0
      ? 'negative-guided-body-of-piston-A'
      : 'positive-guided-body-of-piston-A';
    group.add(body);
    const nose = cylinderAlongZ(
      followerNoseRadius,
      0.68,
      pistonMaterial,
      30,
    );
    const noseArc=Array.from({length:129},(_,i)=>{
      const angle=-Math.PI/6+i*Math.PI/3/128;
      return [followerNoseRadius*Math.cos(angle),followerNoseRadius*Math.sin(angle)];
    });
    nose.geometry.dispose();nose.geometry=plate(poly(noseArc),0.19,0.73);
    nose.rotation.set(0,0,0);nose.position.set(followerNoseCenter, 0, 0);
    nose.userData.role = side < 0
      ? 'negative-rounded-cam-nose-of-piston-A'
      : 'positive-rounded-cam-nose-of-piston-A';
    group.add(nose);
    const marker = cylinderAlongZ(0.07, 0.012, whiteMaterial, 20);
    marker.position.set(pistonBodyEnd - 0.08, 0, 0.736);
    marker.userData.role = side < 0
      ? 'negative-piston-A-motion-marker'
      : 'positive-piston-A-motion-marker';
    group.add(marker);
    rotor.add(group);
    return { body, group, marker, nose };
  };
  const positivePiston = makeRadialPiston(1);
  const negativePiston = makeRadialPiston(-1);
  root.add(rotor);

  const shaftB = cylinderAlongZ(shaftRadius, 1.22, darkMaterial, 36);
  shaftB.position.z = 0.42;
  shaftB.userData.role = 'main-shaft-B-through-hub-C';
  root.add(shaftB);

  const positivePowerIndicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 22, 14),
    steamMaterial,
  );
  positivePowerIndicator.userData.role =
    'simultaneous-steam-action-indicator-on-positive-piston-A';
  const negativePowerIndicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 22, 14),
    steamMaterial,
  );
  negativePowerIndicator.userData.role =
    'simultaneous-steam-action-indicator-on-negative-piston-A';
  root.add(positivePowerIndicator, negativePowerIndicator);

  const inductionIndicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 22, 14),
    steamMaterial,
  );
  inductionIndicator.position.set(-3.85, 0.66, 0.42);
  inductionIndicator.userData.role = 'induction-arrow-side-indicator';
  const eductionIndicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 22, 14),
    exhaustMaterial,
  );
  eductionIndicator.position.set(3.85, -0.66, 0.42);
  eductionIndicator.userData.role = 'eduction-arrow-side-indicator';
  root.add(inductionIndicator, eductionIndicator);

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.z = state.rotorAngle;
    positivePiston.group.position.x = state.radialPosition;
    negativePiston.group.position.x = -state.radialPosition;
    positivePowerIndicator.position.copy(state.positiveOuterTip);
    positivePowerIndicator.position.z = 0.78;
    negativePowerIndicator.position.copy(state.negativeOuterTip);
    negativePowerIndicator.position.z = 0.78;
    const simultaneousPulse = 0.82 + 0.10 * Math.cos(2 * state.inputAngle);
    positivePowerIndicator.scale.setScalar(simultaneousPulse);
    negativePowerIndicator.scale.setScalar(simultaneousPulse);
  };

  const sourceState = stateAtInputAngle(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'two-opposed-rounded-pistons-sliding-radially-in-rotating-hub-against-two-stationary-port-abutments',
    blocks: {
      bottomHousingBack,
      leftAbutmentBody: leftAbutment.body,
      rightAbutmentBody: rightAbutment.body,
      eductionIndicator,
      foundation,
      groove,
      hubC,
      inductionIndicator,
      leftAbutment: leftAbutment.group,
      leftAbutmentNose: leftAbutment.nose,
      lowerInnerWall,
      negativePiston: negativePiston.group,
      negativePistonBody: negativePiston.body,
      negativePistonNose: negativePiston.nose,
      negativePowerIndicator,
      positivePiston: positivePiston.group,
      positivePistonBody: positivePiston.body,
      positivePistonNose: positivePiston.nose,
      positivePowerIndicator,
      rightAbutment: rightAbutment.group,
      rightAbutmentNose: rightAbutment.nose,
      rotor,
      shaftB,
      topHousingBack,
      upperInnerWall,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      negativePistonRadialPositionIndependent: false,
      operatingDegreesOfFreedom: 1,
      positivePistonRadialPositionIndependent: false,
    },
    dynamics: {
      bothPistonsActTogether: true,
      camFollowerAssumption:
        'Each A is a massless radial follower constrained by the fixed arc profile; contact force, leakage, and impact are not solved.',
      pressureExpansionCutoffLeakageFrictionInertiaAndLoadsModeled: false,
      sourceCoordinateRegularization:
        'The two source cam solutions are averaged to enforce the intended exact 180-degree symmetry, and a sub-microunit undershoot is clamped at the radius-1 retracted stop; their maximum disagreement is about one source microunit of coordinate rounding.',
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsPressuresOrLoads: false,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Two stationary abutments D remain fixed at the opposed cylinder ports. Hub C rotates with main shaft B and carries exactly two opposed radial grooves. The two pistons A slide in those grooves; each rounded nose is placed by the official fixed multi-arc cam envelope, not a sinusoidal approximation. Their equal radial positions and 180-degree separation enforce the intended symmetry, and both receive steam action together while retracting far enough to pass the fixed abutments.',
    motion: {
      cycleDuration,
      hubDirection: 'counterclockwise',
      inputAngularSpeed,
      radialMaximum: sourceMaximumRoot * sourceScale,
      radialMinimum: sourceMinimumRoot * sourceScale,
      shaftRevolutionsPerCycle: 1,
    },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      officialCanvasControlPeriod: sourceCanvasControlPeriod,
      officialCanvasCyclesPerMinute: 15,
      officialCanvasModelPresent: true,
      officialHubAdvancePerControlPeriod: sourceHubAdvancePerControlPeriod,
      officialShaftRevolutionPeriod: cycleDuration,
      reason:
        'The official Movement 426 page embeds an eight-part Canvas construction. Its radius-4 hub, opposed radial guide lines, rounded piston profile, two multi-arc fixed cam envelopes, stationary abutments, and 1.5-pi shaft advance per four-second control interval were extracted and independently reconstructed.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      negativeOuterTip: sourceState.negativeOuterTip.clone(),
      negativePistonRoot: sourceState.negativePistonRoot.clone(),
      positiveOuterTip: sourceState.positiveOuterTip.clone(),
      positivePistonRoot: sourceState.positivePistonRoot.clone(),
      radialPosition: sourceState.radialPosition,
      rotorAngle: sourceState.rotorAngle,
      sourceRadialPosition: sourceState.sourceRadialPosition,
    },
    sourceReference: {
      brownPlate426: {
        cylinderApproximateCenterPixels: [265, 267],
        hubCApproximateRadiusPixels: 107,
        imageHeight: 525,
        imageWidth: 525,
        leftAbutmentDApproximateTipPixels: [158, 273],
        mainShaftBApproximateCenterPixels: [264, 268],
        measurementUncertaintyPixels: 12,
        pistonAApproximateTipPixels: [[243, 94], [280, 438]],
        rightAbutmentDApproximateTipPixels: [369, 264],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'there are two stationary abutments D, D',
          'there are two pistons A, A',
          'the pistons slide radially',
          'the radial grooves are in hub C',
          'hub C is on main shaft B',
          'radial sliding lets A pass the fixed abutments',
          'steam acts on both pistons at once',
          'the arrows indicate induction and eduction',
        ],
        engravingEvidence:
          'Brown’s cutaway shows central shaft B, circular hub C, two diametrically opposed radial piston blades A, fixed inward abutments D at the left and right ports, and paired flow arrows around the chamber.',
        officialCanvasEvidence:
          'The official model gives hub radius 4, shaft radius 1, piston body coordinates x=0..2.933013 and y=+/-0.25, a rounded nose centered at x=2.5 with radius 0.5, two exact opposed rotating guide lines, and fixed cam envelopes composed of five circular arcs for each piston. The hub advances 1.5*pi radians per Canvas control cycle.',
        reconstructionDisclosure:
          'Brown gives no absolute scale, axial depth, port timing, pressure cycle, speed, materials, contact loading, sealing clearance, inertia, or loads. Housing depth, supports, colors, and flow indicators are independently engineered. The radial displacement comes from a direct port of the official arc-contact construction, with only the roughly one-microunit mirrored-coordinate discrepancy averaged and the equally tiny retracted-stop undershoot clamped.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 426',
    },
    sourceRadialRootAtInputAngle,
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      opposedSymmetry:
        'negativePistonRoot=-positivePistonRoot and both use one common radial cam coordinate',
      radialCamClosure:
        'the rounded 0.5-radius A nose advances along the rotating radial guide to the first positive endpoint or arc-tangency constraint of the fixed five-arc envelope',
      sourceSpeedLaw:
        'hubAngle=(1.5*pi/4)*time, so one shaft revolution takes 16/3 seconds at the official control rate',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.15, -3.70, -1.00),
    new THREE.Vector3(4.15, 3.56, 1.40),
  );
  root.userData.cameraDistanceScale = 1.01;
  root.userData.cameraDirection = new THREE.Vector3(5.2, 3.8, 12.4);
  root.userData.groundFloorY = -4.46;
  root.userData.hideGround = true;
  root.userData.solidReview = { chamberOutline, chamberArcs, chamberClearanceScale, hubBore, grooveHalfWidth,
    qualification: 'The source solver arcs now bound the closed working chamber; source 60-degree nose caps replace full rollers and actual radial hub slots receive the blades. Small geometric running clearance is inferred. Passive outward loading, sealing, steam pressure and friction remain unmodeled.' };
  root.traverse(object=>{for(const material of object.material?[].concat(object.material):[]) material.fog=false;});
  markShadows(root);
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredRadialPistonRotaryEngineMovement(movement) {
  if (movement.id !== 426) return null;
  return radialPistonRotaryEngine(movement);
}
