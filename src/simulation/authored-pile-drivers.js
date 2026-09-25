import * as THREE from 'three';
import { correctPileHookSurfaces, pileHeadOffset, pileLatch } from './lifting-check-hook-parts.js';
import {
  PALETTE,
  makeDynamicCable,
  markShadows,
  matte,
} from './primitives.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cycleTime(time, period) {
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

function extrudedPolygon(points, depth, material, role) {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.045,
    bevelThickness: 0.045,
    curveSegments: 12,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.role = role;
  return mesh;
}

function cylinderAlongZ(radius, length, material, role, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  cylinder.userData.role = role;
  return cylinder;
}

function tubeAlongPoints(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, point.y, 0)),
    false,
    'centripetal',
  );
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 72, radius, 14, false),
    material,
  );
  tube.userData.centerlinePoints = points.map((point) => point.clone());
  tube.userData.role = role;
  return tube;
}

function beamAlongSurface({
  depth,
  end,
  inwardNormal,
  material,
  role,
  start,
  thickness,
}) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  const surfaceMiddle = start.clone().add(end).multiplyScalar(0.5);
  const bodyMiddle = surfaceMiddle.clone().addScaledVector(
    inwardNormal,
    -thickness / 2,
  );
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(thickness, length, depth),
    material,
  );
  beam.position.set(bodyMiddle.x, bodyMiddle.y, 0);
  beam.rotation.z = -Math.atan2(direction.x, direction.y);
  beam.userData.inwardNormal = inwardNormal.clone();
  beam.userData.role = role;
  beam.userData.surfaceEnd = end.clone();
  beam.userData.surfaceStart = start.clone();
  return beam;
}

function pileDriverReleasingHooks(movement) {
  const root = new THREE.Group();
  const renderScale = 0.76;
  root.scale.setScalar(renderScale);

  // Brown's front elevation gives a symmetric pair of hooks on the hammer,
  // a rope-carried lifting head between them, and a slot that narrows upward.
  // The dimensions below preserve those measured proportions. The straight
  // guide faces are constructed as exact offsets from the path of each round
  // hook tip, so the tip-to-wall gap is identically zero during squeezing.
  const cycleDuration = 10;
  const lowDwellEnd = 0.75;
  const guideEngagementTime = 2.05;
  const releaseTime = 3.45;
  const impactTime = 4.45;
  const impactDwellEnd = 5.15;
  const headLoweringEnd = 6.25;
  const relatchEnd = 6.95;
  const recoveryEnd = 8.75;
  const initialPivotY = -2;
  const guideEngagementPivotY = -0.35;
  const releasePivotY = 1.45;
  const impactPivotY = -2.75;
  const dropDistance = releasePivotY - impactPivotY;
  const freeFallDuration = impactTime - releaseTime;
  const gravitationalAcceleration =
    2 * dropDistance / freeFallDuration ** 2;
  const hookPivotHalfSpacing = 1.35;
  const hookTubeRadius = 0.24;
  const releaseHookAngle = 0.24;
  const headRelativeY = 2.19;
  const headBarHalfWidth = 2.64;
  const headBarHalfHeight = 0.19;
  // Brown's W is a tall block filling the space between the guide rails,
  // with rounded side notches; its top stays just below the hook pivots.
  const hammerHalfWidth = 3.12;
  // Plate W is about 1.2 times as tall as it is wide.
  const hammerHeight = 7.4;
  const hammerCenterBelowPivot = 0.45 + hammerHeight / 2;
  const hammerBottomBelowPivot =
    hammerCenterBelowPivot + hammerHeight / 2;
  const pileHeadTopY = impactPivotY - hammerBottomBelowPivot;
  const frameRailInnerHalfWidth = 3.45;
  const ropeTopY = 7.2;
  const leftHookTipLocal = new THREE.Vector2(-1.15, 4.2);
  const rightHookTipLocal = new THREE.Vector2(1.15, 4.2);
  const leftLatchBearingLocal = new THREE.Vector2(-1.29, 2);
  const rightLatchBearingLocal = new THREE.Vector2(1.29, 2);
  const latchArcRadius = leftLatchBearingLocal.length();

  const leftPivot = (pivotY) => new THREE.Vector2(
    -hookPivotHalfSpacing,
    pivotY,
  );
  const rightPivot = (pivotY) => new THREE.Vector2(
    hookPivotHalfSpacing,
    pivotY,
  );
  const leftTipAt = (pivotY, hookAngle) => leftPivot(pivotY).add(
    rotateVector2(leftHookTipLocal, -hookAngle),
  );
  const rightTipAt = (pivotY, hookAngle) => rightPivot(pivotY).add(
    rotateVector2(rightHookTipLocal, hookAngle),
  );
  const guidePathStart = leftTipAt(guideEngagementPivotY, 0);
  const guidePathEnd = leftTipAt(releasePivotY, releaseHookAngle);
  const guidePathSlope =
    (guidePathEnd.x - guidePathStart.x)
    / (guidePathEnd.y - guidePathStart.y);
  const guidePathIntercept =
    guidePathStart.x - guidePathSlope * guidePathStart.y;
  const guideNormalScale = Math.hypot(1, guidePathSlope);
  const leftGuideInwardNormal = new THREE.Vector2(
    1 / guideNormalScale,
    -guidePathSlope / guideNormalScale,
  );
  const rightGuideInwardNormal = new THREE.Vector2(
    -leftGuideInwardNormal.x,
    leftGuideInwardNormal.y,
  );
  const guideSurfaceStart = guidePathStart.clone().addScaledVector(
    leftGuideInwardNormal,
    -hookTubeRadius,
  );
  const guideSurfaceEnd = guidePathEnd.clone().addScaledVector(
    leftGuideInwardNormal,
    -hookTubeRadius,
  );
  const guideSurfaceIntercept =
    guidePathIntercept - hookTubeRadius * guideNormalScale;

  const solveGuideAngle = (pivotY) => {
    if (pivotY <= guideEngagementPivotY + 1e-14) return 0;
    if (pivotY >= releasePivotY - 1e-14) return releaseHookAngle;
    let lower = 0;
    let upper = releaseHookAngle;
    for (let iteration = 0; iteration < 56; iteration += 1) {
      const middle = (lower + upper) / 2;
      const tip = leftTipAt(pivotY, middle);
      const residual = tip.x
        - guidePathSlope * tip.y - guidePathIntercept;
      if (residual < 0) lower = middle;
      else upper = middle;
    }
    return (lower + upper) / 2;
  };

  const hookMaterial = matte(PALETTE.driven, {
    metalness: 0.2,
    roughness: 0.48,
  });
  const hammerMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.55,
  });
  const headMaterial = matte(PALETTE.accent, {
    metalness: 0.24,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.15,
    roughness: 0.68,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const frame = new THREE.Group();
  frame.userData.fixed = true;
  frame.userData.role = 'fixed-pile-driver-frame-with-converging-slot-b';
  // The rails run from the top frame down to the pile-head level.
  const railTopY = 6.15;
  const railHeight = railTopY - pileHeadTopY;
  const railWidth = 0.58;
  const rails = [-1, 1].map((side) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(railWidth, railHeight, 1.25),
      frameMaterial,
    );
    rail.position.set(
      side * (frameRailInnerHalfWidth + railWidth / 2),
      railTopY - railHeight / 2,
      -0.32,
    );
    rail.userData.fixed = true;
    rail.userData.role = `${side < 0 ? 'left' : 'right'}-hammer-guide-rail`;
    return rail;
  });
  frame.add(...rails);

  const leftTopBeam = extrudedPolygon([
    // Brown draws one plain top beam pierced by the tapered slot B; its
    // depth only spans the squeezing stroke of the hook tips.
    new THREE.Vector2(-4.3, guideSurfaceEnd.y + 0.45),
    guideSurfaceEnd.clone().add(new THREE.Vector2(0, 0.45)),
    guideSurfaceStart.clone().add(new THREE.Vector2(-0.12, -0.45)),
    new THREE.Vector2(-4.3, guideSurfaceStart.y - 0.45),
  ], 1.32, frameMaterial, 'left-half-of-top-frame-around-slot-b');
  // Set the cheeks behind the lifting-head plane so the rising head passes
  // in front of them; the dark guide faces still reach the hook plane.
  leftTopBeam.position.z = -1.25;
  leftTopBeam.userData.fixed = true;
  const rightTopBeam = leftTopBeam.clone();
  rightTopBeam.scale.x = -1;
  rightTopBeam.userData.role = 'right-half-of-top-frame-around-slot-b';
  const guideThickness = 0.34;
  const leftGuide = beamAlongSurface({
    depth: 1.46,
    end: guideSurfaceEnd,
    inwardNormal: leftGuideInwardNormal,
    material: darkMaterial,
    role: 'left-straight-inward-squeezing-face-of-slot-b',
    start: guideSurfaceStart,
    thickness: guideThickness,
  });
  leftGuide.position.z = 0.05;
  leftGuide.userData.fixed = true;
  const rightGuide = leftGuide.clone();
  rightGuide.position.x *= -1;
  rightGuide.rotation.z *= -1;
  rightGuide.userData.inwardNormal = rightGuideInwardNormal.clone();
  rightGuide.userData.role = 'right-straight-inward-squeezing-face-of-slot-b';
  rightGuide.userData.surfaceStart = new THREE.Vector2(
    -guideSurfaceStart.x,
    guideSurfaceStart.y,
  );
  rightGuide.userData.surfaceEnd = new THREE.Vector2(
    -guideSurfaceEnd.x,
    guideSurfaceEnd.y,
  );
  // The tie carries slot B, a real passage for the hoisting rope.
  const tieShapes = [-1, 1].map((side) => {
    const shape = new THREE.Shape();
    shape.moveTo(side * 0.13, -0.3);
    shape.lineTo(side * 4.3, -0.3);
    shape.lineTo(side * 4.3, 0.3);
    shape.lineTo(side * 0.13, 0.3);
    shape.closePath();
    return shape;
  });
  const tieGeometry = new THREE.ExtrudeGeometry(tieShapes, {
    bevelEnabled: false,
    depth: 1.32,
  });
  tieGeometry.translate(0, 0, -0.66);
  const upperTie = new THREE.Mesh(tieGeometry, frameMaterial);
  // Brown's beam B runs unbroken across both posts: this cap closes the top
  // of the slotted cheeks so the beam reads as one bar, leaving only a
  // narrow bore for the hoisting rope. The hook tips stop below the cheek
  // tops (the release point), so the cap never meets them.
  upperTie.position.set(0, guideSurfaceEnd.y + 0.45 + 0.3 - 0.02, -1.25);
  upperTie.userData.fixed = true;
  upperTie.userData.role = 'fixed-upper-frame-tie-above-slot-b';
  frame.add(leftTopBeam, rightTopBeam, leftGuide, rightGuide, upperTie);

  const pileHead = new THREE.Group();
  pileHead.userData.fixed = true;
  pileHead.userData.role = 'fixed-pile-head-and-anvil';
  const anvil = new THREE.Mesh(
    new THREE.BoxGeometry(5.1, 0.45, 2.05),
    darkMaterial,
  );
  anvil.position.y = pileHeadTopY - 0.225;
  anvil.userData.fixed = true;
  anvil.userData.role = 'pile-head-impact-anvil';
  const pile = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 1.45, 1.65),
    frameMaterial,
  );
  pile.position.y = pileHeadTopY - 1.175;
  pile.userData.fixed = true;
  pile.userData.role = 'pile-below-impact-head';
  // Brown's plate is cropped through W; the pile and its head lie below the
  // crop, so they stay as the impact reference but are not displayed.
  anvil.visible = false;
  pile.visible = false;
  pileHead.add(anvil, pile);
  root.add(frame, pileHead);

  const liftHead = new THREE.Group();
  liftHead.userData.role = 'rope-carried-lifting-head-released-by-hooks-a';
  const headBar = new THREE.Mesh(
    new THREE.BoxGeometry(
      2 * headBarHalfWidth,
      2 * headBarHalfHeight,
      1.05,
    ),
    headMaterial,
  );
  headBar.position.z = 0.08;
  headBar.userData.role = 'horizontal-lifting-head-gripped-by-hooks';
  const headStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 1.18, 28),
    headMaterial,
  );
  headStem.position.set(0, 0.72, 0.08);
  headStem.userData.role = 'lifting-head-rope-stem';
  const centeringWedge = extrudedPolygon([
    new THREE.Vector2(-0.72, -headBarHalfHeight),
    new THREE.Vector2(0.72, -headBarHalfHeight),
    new THREE.Vector2(0.34, -0.76),
    new THREE.Vector2(0, -1.08),
    new THREE.Vector2(-0.34, -0.76),
  ], 0.88, headMaterial, 'lifting-head-centering-wedge');
  centeringWedge.position.z = 0.08;
  const ropeEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.085, 12, 40),
    darkMaterial,
  );
  ropeEye.position.set(0, 1.24, 0.62);
  ropeEye.userData.role = 'lifting-rope-eye';

  const headArcForSide = (side) => {
    const pivotInHead = new THREE.Vector2(
      side * hookPivotHalfSpacing,
      -headRelativeY,
    );
    const bearing = side < 0
      ? leftLatchBearingLocal
      : rightLatchBearingLocal;
    const points = [];
    for (let index = 0; index <= 32; index += 1) {
      const hookAngle = releaseHookAngle * index / 32;
      const rigidAngle = side < 0 ? -hookAngle : hookAngle;
      points.push(pivotInHead.clone().add(
        rotateVector2(bearing, rigidAngle),
      ));
    }
    const arc = tubeAlongPoints(
      points,
      0.105,
      darkMaterial,
      `${side < 0 ? 'left' : 'right'}-concentric-hook-bearing-arc`,
    );
    arc.position.z = 0.18;
    return arc;
  };
  const leftHeadArc = headArcForSide(-1);
  const rightHeadArc = headArcForSide(1);
  liftHead.add(
    headBar,
    headStem,
    centeringWedge,
    ropeEye,
    leftHeadArc,
    rightHeadArc,
  );
  root.add(liftHead);

  const weightAssembly = new THREE.Group();
  weightAssembly.userData.role = 'falling-hammer-w-with-two-pivoted-hooks-a';
  const notchRadius = 0.3;
  const notchCenters = [hammerHeight / 2 - 1.05, -hammerHeight / 2 + 1.05];
  const sideProfile = (side) => {
    const points = [];
    const ordered = side > 0 ? notchCenters : [...notchCenters].reverse();
    for (const centerY of ordered) {
      for (let index = 0; index <= 12; index += 1) {
        const angle = Math.PI / 2 - Math.PI * index / 12;
        const y = centerY + notchRadius * Math.sin(angle) * (side > 0 ? 1 : -1);
        points.push(new THREE.Vector2(
          side * (hammerHalfWidth - notchRadius * Math.cos(angle)),
          y,
        ));
      }
    }
    return points;
  };
  const hammerProfile = [
    new THREE.Vector2(-hammerHalfWidth, hammerHeight / 2),
    new THREE.Vector2(hammerHalfWidth, hammerHeight / 2),
    ...sideProfile(1),
    new THREE.Vector2(hammerHalfWidth, -hammerHeight / 2),
    new THREE.Vector2(-hammerHalfWidth, -hammerHeight / 2),
    ...sideProfile(-1),
  ];
  const hammer = extrudedPolygon(
    hammerProfile,
    1.72,
    hammerMaterial,
    'drop-hammer-weight-w-with-side-guide-notches',
  );
  // Front bevel face (z 0.835) stays behind the flat hook cheeks (z 0.85).
  hammer.position.set(0, -hammerCenterBelowPivot, -0.07);
  const hammerIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 1.2, 0.05),
    whiteMaterial,
  );
  hammerIndex.position.set(0.9, -hammerCenterBelowPivot, 0.86);
  hammerIndex.userData.role = 'white-falling-weight-motion-index';
  // Brown draws W plain, without a motion index.
  hammerIndex.visible = false;
  const yoke = extrudedPolygon([
    new THREE.Vector2(-1.72, 0.24),
    new THREE.Vector2(1.72, 0.24),
    new THREE.Vector2(1.52, -0.64),
    new THREE.Vector2(0.55, -0.72),
    new THREE.Vector2(0.45, -1.12),
    new THREE.Vector2(-0.45, -1.12),
    new THREE.Vector2(-0.55, -0.72),
    new THREE.Vector2(-1.52, -0.64),
  ], 1.18, hammerMaterial, 'hammer-top-yoke-carrying-both-hook-pivots');
  yoke.position.z = 0.14;
  weightAssembly.add(hammer, hammerIndex, yoke);

  const leftHook = new THREE.Group();
  leftHook.position.x = -hookPivotHalfSpacing;
  leftHook.userData.axis = Z_AXIS.clone();
  leftHook.userData.role = 'left-pivoted-releasing-hook-a';
  // Brown's horns A bulge well outward toward the rails above the toe and
  // curl back inward to the tips that enter slot B.
  const leftHookPoints = [
    new THREE.Vector2(0, 0.04),
    new THREE.Vector2(-0.48, 0.28),
    new THREE.Vector2(-1.15, 1),
    new THREE.Vector2(-1.45, 1.6),
    new THREE.Vector2(-1.53, 2),
    new THREE.Vector2(-1.68, 2.6),
    new THREE.Vector2(-1.68, 3.14),
    new THREE.Vector2(-1.58, 3.7),
    new THREE.Vector2(-1.4, 4.08),
    leftHookTipLocal.clone(),
  ];
  const leftHookBody = tubeAlongPoints(
    leftHookPoints,
    hookTubeRadius,
    hookMaterial,
    'left-source-curved-hook-body-a',
  );
  leftHookBody.position.z = 0.48;
  const leftBearing = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 24, 16),
    whiteMaterial,
  );
  leftBearing.position.set(
    leftLatchBearingLocal.x,
    leftLatchBearingLocal.y,
    0.48,
  );
  leftBearing.userData.role = 'left-white-lifting-head-bearing-index';
  const leftTipIndex = new THREE.Mesh(
    new THREE.SphereGeometry(hookTubeRadius, 24, 16),
    hookMaterial,
  );
  leftTipIndex.position.set(leftHookTipLocal.x, leftHookTipLocal.y, 0.48);
  leftTipIndex.userData.role = 'left-rounded-guide-contact-tip';
  leftHook.add(leftHookBody, leftBearing, leftTipIndex);

  const rightHook = new THREE.Group();
  rightHook.position.x = hookPivotHalfSpacing;
  rightHook.userData.axis = Z_AXIS.clone();
  rightHook.userData.role = 'right-pivoted-releasing-hook-a';
  const rightHookPoints = leftHookPoints.map(
    (point) => new THREE.Vector2(-point.x, point.y),
  );
  const rightHookBody = tubeAlongPoints(
    rightHookPoints,
    hookTubeRadius,
    hookMaterial,
    'right-source-curved-hook-body-a',
  );
  rightHookBody.position.z = 0.48;
  const rightBearing = leftBearing.clone();
  rightBearing.position.x *= -1;
  rightBearing.userData.role = 'right-white-lifting-head-bearing-index';
  const rightTipIndex = leftTipIndex.clone();
  rightTipIndex.position.x *= -1;
  rightTipIndex.userData.role = 'right-rounded-guide-contact-tip';
  rightHook.add(rightHookBody, rightBearing, rightTipIndex);
  weightAssembly.add(leftHook, rightHook);

  const pivotPins = [-1, 1].map((side) => {
    const pin = cylinderAlongZ(
      0.31,
      1.42,
      darkMaterial,
      `${side < 0 ? 'left' : 'right'}-hook-pivot-pin`,
    );
    pin.position.set(side * hookPivotHalfSpacing, 0, 0.48);
    return pin;
  });
  const pivotIndexes = [-1, 1].map((side) => {
    const index = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.08, 0.05),
      whiteMaterial,
    );
    index.position.set(side * hookPivotHalfSpacing, 0, 1.21);
    index.userData.role =
      `${side < 0 ? 'left' : 'right'}-white-hook-angle-index`;
    // Brown draws plain pivot pins, without angle indices.
    index.visible = false;
    return index;
  });
  weightAssembly.add(...pivotPins, ...pivotIndexes);
  root.add(weightAssembly);

  // Brown draws the hoisting rope as a plain cord: the shared laid rope.
  const rope = makeDynamicCable({
    color: PALETTE.ink,
    laid: true,
    maxSegments: 2,
    radius: 0.075,
  });
  rope.userData.role = 'vertical-hoisting-rope-through-slot-b';
  root.add(rope);

  const guideContactMarkers = [-1, 1].map((side) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 20, 14),
      matte(PALETTE.accent, { metalness: 0.22, roughness: 0.43 }),
    );
    marker.userData.role =
      `${side < 0 ? 'left' : 'right'}-exact-hook-tip-to-slot-contact-marker`;
    root.add(marker);
    return marker;
  });
  const latchContactMarkers = [-1, 1].map((side) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 20, 14),
      whiteMaterial,
    );
    marker.userData.role =
      `${side < 0 ? 'left' : 'right'}-hook-to-lifting-head-contact-marker`;
    root.add(marker);
    return marker;
  });
  const impactMarker = new THREE.Mesh(
    new THREE.TorusGeometry(0.52, 0.07, 10, 40),
    matte(PALETTE.accent, { metalness: 0.18, roughness: 0.5 }),
  );
  impactMarker.rotation.x = Math.PI / 2;
  impactMarker.position.set(0, pileHeadTopY + 0.03, 1.05);
  impactMarker.userData.fixed = true;
  impactMarker.userData.role = 'pile-head-impact-contact-marker';
  root.add(impactMarker);

  const guideAngleState = (pivotState) => {
    const value = solveGuideAngle(pivotState.value);
    if (value === 0 || value === releaseHookAngle) {
      return { acceleration: 0, value, velocity: 0 };
    }
    const rotatedTip = rotateVector2(leftHookTipLocal, -value);
    const coefficientA =
      leftHookTipLocal.x - guidePathSlope * leftHookTipLocal.y;
    const coefficientB =
      leftHookTipLocal.y + guidePathSlope * leftHookTipLocal.x;
    const denominator =
      -coefficientA * Math.sin(value)
      + coefficientB * Math.cos(value);
    const secondAngleDerivative =
      -coefficientA * Math.cos(value)
      - coefficientB * Math.sin(value);
    const velocity = guidePathSlope * pivotState.velocity / denominator;
    const acceleration = (
      guidePathSlope * pivotState.acceleration
      - secondAngleDerivative * velocity ** 2
    ) / denominator;
    // Keep the evaluated tip available to make the dependency explicit and
    // guard against future changes that accidentally switch the rotation hand.
    void rotatedTip;
    return { acceleration, value, velocity };
  };

  const latchContactState = ({
    bearingLocal,
    headY,
    hookAngle,
    pivot,
    side,
  }) => {
    const rigidAngle = side < 0 ? -hookAngle : hookAngle;
    const rotatedBearing = rotateVector2(bearingLocal, rigidAngle);
    const hookPoint = pivot.clone().add(rotatedBearing);
    const mirroredX = side < 0 ? hookPoint.x : -hookPoint.x;
    const corner = new THREE.Vector2(pileLatch.edgeX, headY + pileLatch.shelfTop);
    const along = Math.min(0, ((mirroredX - corner.x) + (hookPoint.y - corner.y)) / 2);
    const headPoint = new THREE.Vector2(side < 0 ? corner.x + along : -corner.x - along, corner.y + along);
    const normal = hookPoint.clone().sub(headPoint).normalize();
    return {
      arcCoordinate: hookAngle / releaseHookAngle,
      gap: hookPoint.distanceTo(headPoint) - pileLatch.toeRadius,
      normal,
      headPoint,
      hookPoint,
      radialError: rotatedBearing.length() - latchArcRadius,
      remainingRetainingAngle: releaseHookAngle - hookAngle,
    };
  };

  const stateAtTime = (time) => {
    const unsnappedLocalTime = cycleTime(time, cycleDuration);
    const localTime = [
      lowDwellEnd,
      guideEngagementTime,
      releaseTime,
      impactTime,
      impactDwellEnd,
      headLoweringEnd,
      relatchEnd,
      recoveryEnd,
    ].find((boundary) => (
      Math.abs(unsnappedLocalTime - boundary) < 1e-12
    )) ?? unsnappedLocalTime;
    let stage = 'latched-low-source-dwell';
    let pivotState = { acceleration: 0, value: initialPivotY, velocity: 0 };
    let headState = {
      acceleration: 0,
      value: initialPivotY + headRelativeY,
      velocity: 0,
    };
    let hookState = { acceleration: 0, value: 0, velocity: 0 };
    let freeFallElapsed = 0;
    let externalReload = false;

    if (localTime >= lowDwellEnd && localTime < guideEngagementTime) {
      stage = 'raising-latched-weight-to-slot';
      pivotState = transitionState(
        localTime,
        lowDwellEnd,
        guideEngagementTime,
        initialPivotY,
        guideEngagementPivotY,
      );
      headState = {
        acceleration: pivotState.acceleration,
        value: pivotState.value + headRelativeY,
        velocity: pivotState.velocity,
      };
    } else if (
      localTime >= guideEngagementTime && localTime < releaseTime
    ) {
      stage = 'slot-b-squeezing-hooks-inward';
      pivotState = transitionState(
        localTime,
        guideEngagementTime,
        releaseTime,
        guideEngagementPivotY,
        releasePivotY,
      );
      headState = {
        acceleration: pivotState.acceleration,
        value: pivotState.value + headRelativeY,
        velocity: pivotState.velocity,
      };
      hookState = guideAngleState(pivotState);
    } else if (localTime >= releaseTime && localTime < impactTime) {
      stage = 'released-weight-in-gravity-only-fall';
      freeFallElapsed = localTime - releaseTime;
      pivotState = {
        acceleration: -gravitationalAcceleration,
        value:
          releasePivotY
          - 0.5 * gravitationalAcceleration * freeFallElapsed ** 2,
        velocity: -gravitationalAcceleration * freeFallElapsed,
      };
      headState = {
        acceleration: 0,
        value: releasePivotY + headRelativeY,
        velocity: 0,
      };
      hookState = { acceleration: 0, value: releaseHookAngle, velocity: 0 };
    } else if (localTime >= impactTime && localTime < impactDwellEnd) {
      stage = 'weight-stopped-on-pile-head';
      pivotState = { acceleration: 0, value: impactPivotY, velocity: 0 };
      headState = {
        acceleration: 0,
        value: releasePivotY + headRelativeY,
        velocity: 0,
      };
      hookState = { acceleration: 0, value: releaseHookAngle, velocity: 0 };
    } else if (
      localTime >= impactDwellEnd && localTime < headLoweringEnd
    ) {
      stage = 'external-reset-lowering-lifting-head';
      externalReload = true;
      pivotState = { acceleration: 0, value: impactPivotY, velocity: 0 };
      headState = transitionState(
        localTime,
        impactDwellEnd,
        headLoweringEnd,
        releasePivotY + headRelativeY,
        impactPivotY + headRelativeY,
      );
      hookState = { acceleration: 0, value: releaseHookAngle, velocity: 0 };
    } else if (localTime >= headLoweringEnd && localTime < relatchEnd) {
      stage = 'external-reset-relatching-hooks';
      externalReload = true;
      pivotState = { acceleration: 0, value: impactPivotY, velocity: 0 };
      headState = {
        acceleration: 0,
        value: impactPivotY + headRelativeY,
        velocity: 0,
      };
      hookState = transitionState(
        localTime,
        headLoweringEnd,
        relatchEnd,
        releaseHookAngle,
        0,
      );
    } else if (localTime >= relatchEnd && localTime < recoveryEnd) {
      stage = 'external-reset-recovering-latched-weight';
      externalReload = true;
      pivotState = transitionState(
        localTime,
        relatchEnd,
        recoveryEnd,
        impactPivotY,
        initialPivotY,
      );
      headState = {
        acceleration: pivotState.acceleration,
        value: pivotState.value + headRelativeY,
        velocity: pivotState.velocity,
      };
    } else if (localTime >= recoveryEnd) {
      stage = 'latched-low-cycle-end-dwell';
    }

    const headOffset = pileHeadOffset(hookState.value);
    // Position contact law is authoritative. Derivatives are reported only for
    // the interior smooth portion; the final shelf-edge force singularity is
    // explicitly outside this prescribed demonstration's dynamic validation.
    const epsilon = 1e-6;
    const lo = Math.max(0, hookState.value - epsilon);
    const hi = Math.min(releaseHookAngle, hookState.value + epsilon);
    const derivative = (pileHeadOffset(hi) - pileHeadOffset(lo)) / (hi - lo || 1);
    headState.value += headOffset;
    headState.velocity += derivative * hookState.velocity;
    headState.acceleration = null;
    const leftPivotPoint = leftPivot(pivotState.value);
    const rightPivotPoint = rightPivot(pivotState.value);
    const leftHookAngle = -hookState.value;
    const rightHookAngle = hookState.value;
    const leftHookTip = leftTipAt(pivotState.value, hookState.value);
    const rightHookTip = rightTipAt(pivotState.value, hookState.value);
    const leftGuideCenterResidual =
      leftHookTip.x
      - guidePathSlope * leftHookTip.y - guidePathIntercept;
    const mirroredRightTip = new THREE.Vector2(
      -rightHookTip.x,
      rightHookTip.y,
    );
    const rightGuideCenterResidual =
      mirroredRightTip.x
      - guidePathSlope * mirroredRightTip.y - guidePathIntercept;
    const leftGuideClearance = (
      leftHookTip.x
      - guidePathSlope * leftHookTip.y - guideSurfaceIntercept
    ) / guideNormalScale - hookTubeRadius;
    const rightGuideClearance = (
      mirroredRightTip.x
      - guidePathSlope * mirroredRightTip.y - guideSurfaceIntercept
    ) / guideNormalScale - hookTubeRadius;
    const leftGuideContactPoint = leftHookTip.clone().addScaledVector(
      leftGuideInwardNormal,
      -hookTubeRadius,
    );
    const rightGuideContactPoint = rightHookTip.clone().addScaledVector(
      rightGuideInwardNormal,
      -hookTubeRadius,
    );
    const leftLatchContact = latchContactState({
      bearingLocal: leftLatchBearingLocal,
      headY: headState.value,
      hookAngle: hookState.value,
      pivot: leftPivotPoint,
      side: -1,
    });
    const rightLatchContact = latchContactState({
      bearingLocal: rightLatchBearingLocal,
      headY: headState.value,
      hookAngle: hookState.value,
      pivot: rightPivotPoint,
      side: 1,
    });
    const guideContactActive =
      localTime >= guideEngagementTime && localTime <= releaseTime;
    const alignedForLatch =
      leftLatchContact.gap < 1e-12 && rightLatchContact.gap < 1e-12;
    const retainingArcRemaining = hookState.value < releaseHookAngle;
    const weightSupported = alignedForLatch && retainingArcRemaining;
    const released =
      localTime >= releaseTime && localTime < headLoweringEnd;
    const fallDistance = releasePivotY - pivotState.value;
    const hammerBottomY = pivotState.value - hammerBottomBelowPivot;
    const pileHeadGap = hammerBottomY - pileHeadTopY;
    return {
      cycleCoordinate: localTime / cycleDuration,
      externalReload,
      freeFallElapsed,
      freeFallIdentityError:
        pivotState.velocity ** 2
        - 2 * gravitationalAcceleration * Math.max(0, fallDistance),
      guideContactActive,
      guideContactClearances: {
        left: leftGuideClearance,
        right: rightGuideClearance,
      },
      guideContactPoints: {
        left: leftGuideContactPoint,
        right: rightGuideContactPoint,
      },
      guidePathResiduals: {
        left: leftGuideCenterResidual,
        right: rightGuideCenterResidual,
      },
      hammerBottomY,
      headLatched: weightSupported,
      hookAngularAcceleration: hookState.acceleration,
      hookAngularSpeed: hookState.velocity,
      hookOpeningAngle: hookState.value,
      impactContact: pileHeadGap < 1e-12,
      impactSpeed: gravitationalAcceleration * freeFallDuration,
      kineticEnergyPerUnitMass: 0.5 * pivotState.velocity ** 2,
      leftHookAngle,
      leftHookAngularAcceleration: -hookState.acceleration,
      leftHookAngularSpeed: -hookState.velocity,
      leftHookPivot: leftPivotPoint,
      leftHookTip,
      leftLatchContact,
      liftHeadAcceleration: headState.acceleration,
      liftHeadVelocity: headState.velocity,
      liftHeadY: headState.value,
      localTime,
      pileHeadGap,
      potentialEnergyLostPerUnitMass:
        gravitationalAcceleration * Math.max(0, fallDistance),
      released,
      rightHookAngle,
      rightHookAngularAcceleration: hookState.acceleration,
      rightHookAngularSpeed: hookState.velocity,
      rightHookPivot: rightPivotPoint,
      rightHookTip,
      rightLatchContact,
      sourcePose: localTime === 0,
      stage,
      weightAcceleration: pivotState.acceleration,
      weightPivotY: pivotState.value,
      weightSupported,
      weightVelocity: pivotState.velocity,
    };
  };

  root.userData.archetype =
    'slot-triggered-twin-pivot-releasing-hooks-with-ballistic-pile-driver-drop';
  root.userData.blocks = {
    anvil,
    frame,
    guideContactMarkers,
    hammer,
    hammerIndex,
    headBar,
    impactMarker,
    latchContactMarkers,
    leftBearing,
    leftGuide,
    leftHeadArc,
    leftHook,
    leftHookBody,
    leftTipIndex,
    liftHead,
    pile,
    pileHead,
    pivotIndexes,
    pivotPins,
    rails,
    rightGuide,
    rightHeadArc,
    rightHook,
    rightHookBody,
    rightBearing,
    rightTipIndex,
    rope,
    weightAssembly,
    yoke,
  };
  root.userData.cameraDistanceScale = 0.88;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.2, -8.7, -1.1),
    new THREE.Vector3(5.2, 8.35, 1.25),
  );
  root.userData.geometry = {
    dropDistance,
    frameRailInnerHalfWidth,
    gravitationalAcceleration,
    guideEngagementPivotY,
    guideNormalScale,
    guidePathEnd: guidePathEnd.clone(),
    guidePathIntercept,
    guidePathSlope,
    guidePathStart: guidePathStart.clone(),
    guideSurfaceEnd: guideSurfaceEnd.clone(),
    guideSurfaceIntercept,
    guideSurfaceStart: guideSurfaceStart.clone(),
    hammerBottomBelowPivot,
    hammerHalfWidth,
    hammerHeight,
    headBarHalfHeight,
    headBarHalfWidth,
    headRelativeY,
    hookPivotHalfSpacing,
    hookTubeRadius,
    impactPivotY,
    initialPivotY,
    latchArcRadius,
    leftGuideInwardNormal: leftGuideInwardNormal.clone(),
    leftHookCenterline: leftHookPoints.map((point) => point.clone()),
    leftHookTipLocal: leftHookTipLocal.clone(),
    leftLatchBearingLocal: leftLatchBearingLocal.clone(),
    pileHeadTopY,
    releaseHookAngle,
    releasePivotY,
    renderScale,
    rightGuideInwardNormal: rightGuideInwardNormal.clone(),
    rightHookCenterline: rightHookPoints.map((point) => point.clone()),
    rightHookTipLocal: rightHookTipLocal.clone(),
    rightLatchBearingLocal: rightLatchBearingLocal.clone(),
    ropeTopY,
  };
  root.userData.mechanism =
    'rope-lifts-head-and-latched-hammer-until-converging-slot-b-squeezes-both-hook-tips-inward-and-the-unretained-weight-falls-freely';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official page marks movement 251 animation unavailable',
    referenceScope:
      'static engraving and public-domain description only; no official motion data exists',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate251: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'two mirror-image hooks pivot on the weight yoke, embrace one rope-carried lifting head, and enter one upward-converging slot in the fixed pile-driver frame',
      measurementUncertaintyPixels: 5,
      officialAnimationAvailable: false,
      rasterFrameBounds: {
        bottom: 524,
        left: 137,
        right: 396,
        top: 9,
      },
      rasterGuideSlot: {
        bottomHalfWidth: 40,
        centerX: 266,
        lowerY: 42,
        topHalfWidth: 28,
        upperY: 10,
      },
      rasterHookBounds: [
        { bottom: 228, left: 183, right: 260, top: 67 },
        { bottom: 228, left: 269, right: 348, top: 67 },
      ],
      rasterHookPivots: [
        { centerX: 238, centerY: 215, radius: 10 },
        { centerX: 294, centerY: 215, radius: 10 },
      ],
      rasterLiftingHeadBounds: {
        bottom: 188,
        left: 192,
        right: 336,
        top: 88,
      },
      rasterWeightBounds: {
        bottom: 480,
        left: 151,
        right: 380,
        top: 230,
      },
      view: 'front-elevation-through-rope-hook-pivots-weight-and-guide-slot',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 63,
      edition: 21,
      illustrationPage: 62,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cycleDuration,
    demonstrationPeriod: cycleDuration,
    guideEngagementTime,
    headLoweringEnd,
    impactDwellEnd,
    impactTime,
    lowDwellEnd,
    recoveryEnd,
    relatchEnd,
    releaseTime,
  };
  root.userData.transmission = {
    externalReloadRequired: true,
    guideCount: 2,
    hookCount: 2,
    latchContactCount: 2,
    releaseType: 'symmetric-slot-triggered-hook-release',
    releasedBody: 'pile-driver-weight-w',
    trigger: 'upper-hook-tips-enter-upward-converging-slot-b',
  };

  const update = (time) => {
    const state = stateAtTime(time);
    weightAssembly.position.y = state.weightPivotY;
    leftHook.rotation.z = state.leftHookAngle;
    rightHook.rotation.z = state.rightHookAngle;
    liftHead.position.y = state.liftHeadY;
    // The rope ends on top of its eye ring (0.34 ring + 0.085 tube). Its lay
    // is fixed to that lower end, so it rises with the head.
    const ropeEndY = state.liftHeadY + 1.24 + 0.425;
    rope.userData.setPoints([
      new THREE.Vector3(0, ropeTopY, 0.08),
      new THREE.Vector3(0, ropeEndY, 0.08),
    ], ropeTopY - ropeEndY);
    const guidePoints = [
      state.guideContactPoints.left,
      state.guideContactPoints.right,
    ];
    guideContactMarkers.forEach((marker, index) => {
      marker.position.set(guidePoints[index].x, guidePoints[index].y, 0.98);
      // Contact points stay in userData; Brown draws no marker spheres.
      marker.visible = false;
    });
    const latchPoints = [
      state.leftLatchContact.hookPoint,
      state.rightLatchContact.hookPoint,
    ];
    latchContactMarkers.forEach((marker, index) => {
      marker.position.set(latchPoints[index].x, latchPoints[index].y, 1.02);
      marker.visible = false;
    });
    // The pile head lies below the plate crop, so its impact ring stays hidden.
    impactMarker.visible = false;
    root.userData.contacts = {
      guideSlotB: {
        active: state.guideContactActive,
        leftClearance: state.guideContactClearances.left,
        rightClearance: state.guideContactClearances.right,
      },
      hooksToLiftingHead: {
        leftGap: state.leftLatchContact.gap,
        rightGap: state.rightLatchContact.gap,
        weightSupported: state.weightSupported,
      },
      weightToPileHead: {
        active: state.impactContact,
        gap: state.pileHeadGap,
      },
    };
    root.userData.kinematics = state;
  };
  correctPileHookSurfaces(root);
  // Fit the displayed parts over the whole cycle; the undrawn pile below the
  // plate's crop is excluded.
  const fitBounds = new THREE.Box3();
  for (let sample = 0; sample <= 64; sample += 1) {
    update(cycleDuration * sample / 64);
    root.updateMatrixWorld(true);
    root.traverseVisible((object) => {
      if (!object.isMesh) return;
      object.geometry.computeBoundingBox();
      fitBounds.union(object.geometry.boundingBox.clone()
        .applyMatrix4(object.matrixWorld));
    });
  }
  root.userData.cameraFitBounds = fitBounds.expandByScalar(0.02);
  update(0);
  markShadows(root);
  return {
    root,
    update,
    // Brown draws a flat front elevation.
    cameraDirection: new THREE.Vector3(0, 0, 1),
  };
}

export function createAuthoredPileDriverMovement(movement) {
  let result;
  switch (movement.id) {
    case 251: result = pileDriverReleasingHooks(movement); break;
    default: return null;
  }
  result.root.userData.fidelity = 'authored';
  return result;
}
