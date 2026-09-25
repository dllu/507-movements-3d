import * as THREE from 'three';
import {plate, poly, circle, capsule, sector, polygonClipping as clip} from './finite-plate-geometry.js';
import {
  PALETTE,
  makeBeam,
  makeDynamicLink,
  markShadows,
  matte,
} from './primitives.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const FULL_TURN = Math.PI * 2;

function cylinderAlongY(radius, length, material, segments = 28) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function cylinderAlongZ(radius, length, material, segments = 28) {
  const cylinder = cylinderAlongY(radius, length, material, segments);
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function finiteMarineOutputRod(length, tailLength) {
  const root = new THREE.Group();
  const hole = (center, radius) => poly(circle(center, radius, 96));
  const shape = clip.difference(clip.union(capsule([-tailLength, 0], [length, 0], .045),
    hole([0, 0], .13), hole([length, 0], .12)), hole([0, 0], .049), hole([length, 0], .079));
  root.add(new THREE.Mesh(plate(shape, -.05, .05), matte(PALETTE.driven)));
  root.userData.setEndpoints = (start, end) => {
    root.position.set(start.x, start.y, .52);
    root.rotation.z = Math.atan2(end.y - start.y, end.x - start.x);
  };
  return root;
}

function rotate2(angle, point) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
}

function rotationDerivative2(angle, point) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    -sine * point.x - cosine * point.y,
    cosine * point.x - sine * point.y,
  );
}

function pointInPose(position, angle, localPoint) {
  return rotate2(angle, localPoint).add(position);
}

function wrapAngle(angle) {
  return THREE.MathUtils.euclideanModulo(angle + Math.PI, FULL_TURN)
    - Math.PI;
}

function solveLinear3(matrix, rightHandSide) {
  const [a, b, c, d, e, f, g, h, i] = matrix;
  const [u, v, w] = rightHandSide;
  const determinant = a * (e * i - f * h)
    - b * (d * i - f * g)
    + c * (d * h - e * g);
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    throw new RangeError(
      'Movement 171 reached a singular Stephenson-link assembly.',
    );
  }
  return new THREE.Vector3(
    (
      u * (e * i - f * h)
        - b * (v * i - f * w)
        + c * (v * h - e * w)
    ) / determinant,
    (
      a * (v * i - f * w)
        - u * (d * i - f * g)
        + c * (d * w - v * g)
    ) / determinant,
    (
      a * (e * w - v * h)
        - b * (d * w - v * g)
        + u * (d * h - e * g)
    ) / determinant,
  );
}

function linkSlotPoint(radius, angle) {
  return new THREE.Vector2(
    radius * Math.sin(angle),
    radius * (1 - Math.cos(angle)),
  );
}

function makeTrunnionArcCurve({ radius, halfAngle, z = 0 }) {
  const points = Array.from({ length: 73 }, (_, index) => {
    const angle = -halfAngle + 2 * halfAngle * index / 72;
    return new THREE.Vector3(
      radius * Math.sin(angle),
      radius * Math.cos(angle),
      z,
    );
  });
  return new THREE.CatmullRomCurve3(points, false, 'centripetal');
}

function makeArcRail(curve, radius, material) {
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, 96, radius, 12, false),
    material,
  );
}

function setDynamicLinkEndpoints(link, start, end) {
  link.userData.setEndpoints(
    new THREE.Vector3(start.x, start.y, start.z ?? 0),
    new THREE.Vector3(end.x, end.y, end.z ?? 0),
  );
}

function makeEye(radius, tubeRadius, material, z = 0) {
  const eye = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 12, 40),
    material,
  );
  eye.position.z = z;
  return eye;
}

function makeIndexedEccentricSheave({
  material,
  radius,
  rimMaterial,
  width,
  z,
}) {
  const group = new THREE.Group();
  const body = cylinderAlongZ(radius, width, material, 52);
  body.position.z = z;
  body.userData.role = 'eccentric-sheave-fast-on-common-crankshaft';
  const rim = new THREE.Mesh(
    plate(clip.difference(poly(circle([0, 0], radius, 192)),
      poly(circle([0, 0], radius - .055, 192))), 0, .02),
    rimMaterial,
  );
  rim.position.z = z + width * 0.52;
  rim.userData.role = 'working-rim-under-eccentric-strap';
  // Only the sheave's drawn edge: hidden reference, not a dark rim band.
  rim.visible = false;
  rim.userData.retiredInkOutline = true;
  const index = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 0.62, 0.075, 0.035),
    matte(PALETTE.white, { roughness: 0.43 }),
  );
  index.position.set(radius * 0.34, 0, z + width * 0.57);
  index.userData.role = 'white-index-on-eccentric-sheave';
  group.add(body, rim, index);
  group.userData.body = body;
  group.userData.index = index;
  group.userData.rim = rim;
  return group;
}

function makeEccentricStrap({ radius, sheaveRadius, length, material, z }) {
  const group = new THREE.Group();
  // A single rigid outline joins the bored strap to the tapered rod and eye.
  const outerRadius = radius + .075;
  const shoulder = outerRadius / Math.sqrt(2);
  const shank = new THREE.Shape();
  shank.moveTo(shoulder, -shoulder);
  shank.bezierCurveTo(shoulder + .15, -shoulder + .15, .78, -.14, .95, -.14);
  shank.lineTo(length, -.06);
  shank.lineTo(length, .06);
  shank.lineTo(.95, .14);
  shank.bezierCurveTo(.78, .14, shoulder + .15, shoulder - .15, shoulder, shoulder);
  shank.closePath();
  const outline = clip.union(poly(circle([0, 0], outerRadius, 192)),
    poly(shank.getPoints(64).map(point => point.toArray())),
    ...[-1, 1].map(sign => poly([[-.07, sign * (outerRadius - .08)],
      [.07, sign * (outerRadius - .08)], [.07, sign * (outerRadius + .23)],
      [-.07, sign * (outerRadius + .23)]])),
    poly(circle([length, 0], .13, 96)));
  const shape = clip.difference(outline,
    poly(circle([0, 0], sheaveRadius + .006, 192)),
    poly(circle([length, 0], .074, 96)));
  const body = new THREE.Mesh(plate(shape, -.08, .08), material);
  body.userData.role = 'integral-bored-eccentric-strap-tapered-rod-and-pin-eye';
  group.add(body);
  group.userData.ring = body;
  group.userData.setEndpoints = (start, end) => {
    group.position.set(start.x, start.y, z);
    group.rotation.z = Math.atan2(end.y - start.y, end.x - start.x);
  };
  return group;
}

function oscillatingMarineEngineStephensonValveGear() {
  const root = new THREE.Group();

  // Brown's engraving supplies a front elevation. These anchors are measured
  // from the 263 x 525 public-domain raster. Its large upper circle is the
  // crankshaft/eccentric center and the hatched lower circle is the cylinder
  // trunnion; their separation establishes the scale used below.
  const sourceImageWidth = 263;
  const sourceImageHeight = 525;
  const sourceRasterAxisX = 134;
  const sourceRasterShaftCenter = new THREE.Vector2(134, 52);
  const sourceRasterAheadLinkPin = new THREE.Vector2(76, 278);
  const sourceRasterAsternLinkPin = new THREE.Vector2(167, 278);
  const sourceRasterLinkDie = new THREE.Vector2(134, 300);
  const sourceRasterSlideEye = new THREE.Vector2(134, 361);
  const sourceRasterFollowerPin = new THREE.Vector2(134, 382);
  const sourceRasterTrunnion = new THREE.Vector2(134, 468);

  const shaftCenter = new THREE.Vector2(0, 4.7);
  const trunnionCenter = new THREE.Vector2(0, -2.05);
  const sourceUnitsPerPixel = (
    shaftCenter.y - trunnionCenter.y
  ) / (
    sourceRasterTrunnion.y - sourceRasterShaftCenter.y
  );
  const sourcePointFromRaster = (point) => new THREE.Vector2(
    (point.x - sourceRasterAxisX) * sourceUnitsPerPixel,
    shaftCenter.y
      - (point.y - sourceRasterShaftCenter.y) * sourceUnitsPerPixel,
  );

  // One crankshaft carries the two equal and exactly opposite eccentric
  // throws. The launch-link pins sit behind the curved slot, as in Brown's
  // marine form of the Stephenson gear. Prescribing which point of the rigid
  // slot crosses the fixed valve-guide line is the reversing control: the two
  // finite eccentric rods then determine the remaining link pose exactly.
  const eccentricity = 0.13;
  const sheaveRadius = 0.57;
  const strapPitchRadius = sheaveRadius + 0.09;
  const sheaveWidth = 0.24;
  const aheadLayerZ = -0.27;
  const asternLayerZ = 0.27;
  // The engraving's rod pins are asymmetric about the die guide. Preserve
  // those measured positions instead of centering an arbitrary equal span.
  const linkCenterAtSource = sourcePointFromRaster(sourceRasterLinkDie);
  const aheadLinkPinLocal = sourcePointFromRaster(sourceRasterAheadLinkPin)
    .sub(linkCenterAtSource);
  const asternLinkPinLocal = sourcePointFromRaster(sourceRasterAsternLinkPin)
    .sub(linkCenterAtSource);
  const linkPinSpacing = aheadLinkPinLocal.distanceTo(asternLinkPinLocal);
  const linkSlotRadius = 2.8;
  const selectorHalfAngle = 0.25;
  const selectorAsymmetry = 0.06;
  const visibleLinkHalfAngle = 0.405;
  const visibleLinkRightAngle = 0.27;
  const dieGuideX = 0;
  const sourceSelector = 0;
  const sourceInputAngle = 0;

  const eccentricCenterAt = (inputAngle, sign) => shaftCenter.clone().add(
    rotate2(inputAngle, new THREE.Vector2(sign * eccentricity, 0)),
  );
  const sourceAheadEccentricCenter = eccentricCenterAt(
    sourceInputAngle,
    -1,
  );
  const sourceAsternEccentricCenter = eccentricCenterAt(
    sourceInputAngle,
    1,
  );
  const sourceAheadLinkPin = linkCenterAtSource.clone().add(
    aheadLinkPinLocal,
  );
  const sourceAsternLinkPin = linkCenterAtSource.clone().add(
    asternLinkPinLocal,
  );
  const aheadEccentricRodLength = sourceAheadEccentricCenter.distanceTo(
    sourceAheadLinkPin,
  );
  const asternEccentricRodLength = sourceAsternEccentricCenter.distanceTo(
    sourceAsternLinkPin,
  );

  const solveLinkPose = (inputAngle, selector) => {
    const resolvedAngle = wrapAngle(inputAngle);
    const resolvedSelector = THREE.MathUtils.clamp(selector, -1, 1);
    const dieSlotAngle = resolvedSelector * selectorHalfAngle
      - selectorAsymmetry * resolvedSelector ** 2;
    const dieLocalPoint = linkSlotPoint(linkSlotRadius, dieSlotAngle);
    const aheadEccentricCenter = eccentricCenterAt(resolvedAngle, -1);
    const asternEccentricCenter = eccentricCenterAt(resolvedAngle, 1);
    const pose = new THREE.Vector3(
      dieGuideX - dieLocalPoint.x,
      linkCenterAtSource.y,
      0,
    );
    let iterations = 0;
    let maximumSquaredResidual = Infinity;

    for (let iteration = 0; iteration < 18; iteration += 1) {
      iterations = iteration + 1;
      const position = new THREE.Vector2(pose.x, pose.y);
      const aheadLinkPin = pointInPose(
        position,
        pose.z,
        aheadLinkPinLocal,
      );
      const asternLinkPin = pointInPose(
        position,
        pose.z,
        asternLinkPinLocal,
      );
      const diePoint = pointInPose(position, pose.z, dieLocalPoint);
      const aheadDifference = aheadLinkPin.clone().sub(
        aheadEccentricCenter,
      );
      const asternDifference = asternLinkPin.clone().sub(
        asternEccentricCenter,
      );
      const residual = [
        aheadDifference.lengthSq() - aheadEccentricRodLength ** 2,
        asternDifference.lengthSq() - asternEccentricRodLength ** 2,
        diePoint.x - dieGuideX,
      ];
      maximumSquaredResidual = Math.max(...residual.map(Math.abs));
      if (maximumSquaredResidual < 1e-13) break;

      const aheadAngularDerivative = rotationDerivative2(
        pose.z,
        aheadLinkPinLocal,
      );
      const asternAngularDerivative = rotationDerivative2(
        pose.z,
        asternLinkPinLocal,
      );
      const dieAngularDerivative = rotationDerivative2(
        pose.z,
        dieLocalPoint,
      );
      const correction = solveLinear3([
        2 * aheadDifference.x,
        2 * aheadDifference.y,
        2 * aheadDifference.dot(aheadAngularDerivative),
        2 * asternDifference.x,
        2 * asternDifference.y,
        2 * asternDifference.dot(asternAngularDerivative),
        1,
        0,
        dieAngularDerivative.x,
      ], residual.map((value) => -value));
      const correctionLength = correction.length();
      if (correctionLength > 0.72) correction.multiplyScalar(
        0.72 / correctionLength,
      );
      pose.add(correction);
    }

    if (maximumSquaredResidual >= 1e-10) {
      throw new RangeError(
        'Movement 171 could not close both eccentric rods and its die guide.',
      );
    }

    const position = new THREE.Vector2(pose.x, pose.y);
    const aheadLinkPin = pointInPose(
      position,
      pose.z,
      aheadLinkPinLocal,
    );
    const asternLinkPin = pointInPose(
      position,
      pose.z,
      asternLinkPinLocal,
    );
    const diePoint = pointInPose(position, pose.z, dieLocalPoint);
    return {
      aheadEccentricCenter,
      aheadLinkPin,
      asternEccentricCenter,
      asternLinkPin,
      dieGuideError: Math.abs(diePoint.x - dieGuideX),
      dieLocalPoint,
      diePoint,
      dieSlotAngle,
      eccentricOppositionError: aheadEccentricCenter.clone()
        .add(asternEccentricCenter)
        .sub(shaftCenter.clone().multiplyScalar(2))
        .length(),
      aheadRodLengthError: Math.abs(
        aheadEccentricCenter.distanceTo(aheadLinkPin)
          - aheadEccentricRodLength
      ),
      asternRodLengthError: Math.abs(
        asternEccentricCenter.distanceTo(asternLinkPin)
          - asternEccentricRodLength
      ),
      inputAngle: resolvedAngle,
      iterations,
      linkAngle: pose.z,
      linkPinSpacingError: Math.abs(
        aheadLinkPin.distanceTo(asternLinkPin) - linkPinSpacing
      ),
      linkPosition: position,
      selector: resolvedSelector,
    };
  };

  // The rear crank is fast on the same shaft as both eccentrics. Its pin and
  // the trunnion determine the instantaneous cylinder axis, so the cylinder's
  // rocking is not an unrelated decorative sine wave.
  const mainCrankRadius = 0.72;
  const mainCrankPinLocal = new THREE.Vector2(0, -mainCrankRadius);
  const slotRadius = (sourceRasterTrunnion.y - sourceRasterFollowerPin.y) * sourceUnitsPerPixel;
  const slideEyeRadius = (sourceRasterTrunnion.y - sourceRasterSlideEye.y) * sourceUnitsPerPixel;
  const sourceSlideStroke = 0;
  const lowerHalfAngle = 1.14;
  const lowerGuideHalfX = 87.5 * sourceUnitsPerPixel;
  const lowerGuideCenterY = (468 - 428) * sourceUnitsPerPixel;
  const lowerGuideLength = (507 - 349) * sourceUnitsPerPixel;
  const sourceRasterBlockBounds = [[35, 406, 64, 457], [207, 404, 234, 455]];
  const rockshaftPivotLocal = new THREE.Vector2(-0.55, 0.62);
  const sourceFollowerPinLocal = new THREE.Vector2(0, slotRadius);
  const followerArmLocal = sourceFollowerPinLocal.clone().sub(
    rockshaftPivotLocal,
  );
  const followerArmLength = followerArmLocal.length();
  const sourceFollowerArmAngle = Math.atan2(
    followerArmLocal.y,
    followerArmLocal.x,
  );
  const valveArmLocal = new THREE.Vector2(-0.50, -0.30);
  const valveGuideX = -1.36;
  // Unillustrated diagnostic output linkage: allow the full rockshaft arm
  // sweep without constraining the source-measured slide geometry.
  const valveLinkLength = Math.abs(rockshaftPivotLocal.x - valveGuideX)
    + valveArmLocal.length() + .01;

  const lowerStateAtSlideStroke = (slideStroke, cylinderAngle = 0) => {
    const slotCenterFixed = new THREE.Vector2(0, slideStroke);
    const pivotFixed = rotate2(cylinderAngle, rockshaftPivotLocal);
    const centerDifference = slotCenterFixed.clone().sub(
      pivotFixed,
    );
    const centerDistance = centerDifference.length();
    const minimumDistance = Math.abs(followerArmLength - slotRadius);
    const maximumDistance = followerArmLength + slotRadius;
    if (
      centerDistance < minimumDistance - 1e-10
        || centerDistance > maximumDistance + 1e-10
    ) {
      throw new RangeError(
        'Movement 171 follower pin left its trunnion-centered slide.',
      );
    }
    const alongCenters = (
      followerArmLength ** 2
        - slotRadius ** 2
        + centerDistance ** 2
    ) / (2 * centerDistance);
    const perpendicularDistance = Math.sqrt(Math.max(
      0,
      followerArmLength ** 2 - alongCenters ** 2,
    ));
    const centerDirection = centerDifference.clone().multiplyScalar(
      1 / centerDistance,
    );
    const perpendicularDirection = new THREE.Vector2(
      -centerDirection.y,
      centerDirection.x,
    );
    const intersectionMiddle = pivotFixed.clone().addScaledVector(
      centerDirection,
      alongCenters,
    );
    const candidateA = intersectionMiddle.clone().addScaledVector(
      perpendicularDirection,
      perpendicularDistance,
    );
    const candidateB = intersectionMiddle.clone().addScaledVector(
      perpendicularDirection,
      -perpendicularDistance,
    );
    const followerPinFixed = candidateA.y > candidateB.y ? candidateA : candidateB;
    const followerPinLocal = rotate2(-cylinderAngle, followerPinFixed);
    const slotCenterLocal = rotate2(-cylinderAngle, slotCenterFixed);
    const followerVector = followerPinLocal.clone().sub(
      rockshaftPivotLocal,
    );
    const rockshaftAngle = wrapAngle(
      Math.atan2(followerVector.y, followerVector.x)
        - sourceFollowerArmAngle,
    );
    const slotParameterAngle = Math.atan2(
      followerPinFixed.x - slotCenterFixed.x,
      followerPinFixed.y - slotCenterFixed.y,
    );

    const valveArmPointLocal = rockshaftPivotLocal.clone().add(
      rotate2(rockshaftAngle, valveArmLocal),
    );
    const valveHorizontalDifference = valveGuideX
      - valveArmPointLocal.x;
    const valveVerticalReachSquared = valveLinkLength ** 2
      - valveHorizontalDifference ** 2;
    if (valveVerticalReachSquared < 0) {
      throw new RangeError(
        'Movement 171 rockshaft-to-valve link left its guided branch.',
      );
    }
    const valveStemPointLocal = new THREE.Vector2(
      valveGuideX,
      valveArmPointLocal.y - Math.sqrt(valveVerticalReachSquared),
    );

    const worldFromCylinder = (point) => trunnionCenter.clone().add(
      rotate2(cylinderAngle, point),
    );
    const followerPinWorld = worldFromCylinder(followerPinLocal);
    const rockshaftPivotWorld = worldFromCylinder(rockshaftPivotLocal);
    const slotCenterWorld = trunnionCenter.clone().add(slotCenterFixed);
    const valveArmPointWorld = worldFromCylinder(valveArmPointLocal);
    const valveStemPointWorld = worldFromCylinder(valveStemPointLocal);

    return {
      absoluteRockshaftAngle: wrapAngle(cylinderAngle + rockshaftAngle),
      cylinderAngle,
      followerArmLengthError: Math.abs(
        followerPinLocal.distanceTo(rockshaftPivotLocal)
          - followerArmLength
      ),
      followerPinLocal,
      followerPinWorld,
      rockshaftAngle,
      rockshaftPivotWorld,
      slideStroke,
      slotCenterLocal,
      slotCenterWorld,
      slotContactError: Math.abs(
        followerPinLocal.distanceTo(slotCenterLocal) - slotRadius
      ),
      slotParameterAngle,
      valveArmPointLocal,
      valveArmPointWorld,
      valveLinkLengthError: Math.abs(
        valveArmPointLocal.distanceTo(valveStemPointLocal)
          - valveLinkLength
      ),
      valveStemGuideError: Math.abs(
        valveStemPointLocal.x - valveGuideX
      ),
      valveStemPointLocal,
      valveStemPointWorld,
    };
  };

  const sourceTopState = solveLinkPose(sourceInputAngle, sourceSelector);
  const sourceCrankPin = shaftCenter.clone().add(
    rotate2(sourceInputAngle, mainCrankPinLocal),
  );
  const sourceCylinderAxis = sourceCrankPin.clone().sub(
    trunnionCenter,
  ).normalize();
  const sourceSlideEyeWorld = trunnionCenter.clone().addScaledVector(
    sourceCylinderAxis,
    slideEyeRadius + sourceSlideStroke,
  );
  const outputRodLength = sourceTopState.diePoint.distanceTo(
    sourceSlideEyeWorld,
  );

  const stateAtInputAngle = (inputAngle, selector = 0) => {
    const top = solveLinkPose(inputAngle, selector);
    const crankPin = shaftCenter.clone().add(
      rotate2(top.inputAngle, mainCrankPinLocal),
    );
    const cylinderAxisVector = crankPin.clone().sub(trunnionCenter);
    const pistonDistance = cylinderAxisVector.length();
    const cylinderAxis = cylinderAxisVector.clone().multiplyScalar(
      1 / pistonDistance,
    );
    const cylinderAngle = Math.atan2(-cylinderAxis.x, cylinderAxis.y);
    // The sector follows a vertical frame guide (Bourne, section 630).
    // Its connecting rod translates with the upper die; cylinder rocking
    // acts through the separate follower arm, not through the guide columns.
    const slideEyeWorld = new THREE.Vector2(top.diePoint.x, top.diePoint.y - outputRodLength);
    const slideEyeDistanceFromTrunnion = slideEyeWorld.y - trunnionCenter.y;
    const slideStroke = slideEyeDistanceFromTrunnion - slideEyeRadius;
    const lower = lowerStateAtSlideStroke(slideStroke, cylinderAngle);
    const crankRadialError = Math.abs(
      crankPin.distanceTo(shaftCenter) - mainCrankRadius
    );
    const crankAxisCrossError = Math.abs(
      cylinderAxis.x * cylinderAxisVector.y
        - cylinderAxis.y * cylinderAxisVector.x
    );
    return {
      ...top,
      ...lower,
      crankAxisCrossError,
      crankPin,
      crankRadialError,
      cylinderAxis,
      outputRodLengthError: Math.abs(
        top.diePoint.distanceTo(slideEyeWorld) - outputRodLength
      ),
      pistonDistance,
      slideEyeDistanceFromTrunnion,
      slideEyeWorld,
      stage: top.selector < -0.72
        ? 'ahead-eccentric-in-full-gear'
        : top.selector > 0.72
          ? 'astern-eccentric-in-full-gear'
          : Math.abs(top.selector) < 0.12
            ? 'mid-gear-reduced-valve-travel'
            : 'reversing-link-between-notches',
    };
  };

  const selectorPeriod = 18;
  // Three six-second crank revolutions close with one reversing traversal.
  const inputAngularSpeed = 3 * FULL_TURN / selectorPeriod;
  const selectorAtTime = (time) => Math.sin(
    FULL_TURN * time / selectorPeriod,
  );
  const stateAtTime = (time) => {
    const state = stateAtInputAngle(
      inputAngularSpeed * time,
      selectorAtTime(time),
    );
    state.inputAngularSpeed = inputAngularSpeed;
    state.selectorRate = FULL_TURN / selectorPeriod * Math.cos(
      FULL_TURN * time / selectorPeriod,
    );
    state.time = time;
    return state;
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.6,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.59,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.17,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.26,
    roughness: 0.45,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.69,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.2,
    roughness: 0.5,
  });

  const inputRotor = new THREE.Group();
  inputRotor.position.set(shaftCenter.x, shaftCenter.y, 0);
  inputRotor.userData.axis = Z_AXIS.clone();
  inputRotor.userData.role =
    'one-crankshaft-carrying-both-eccentrics-and-main-crank';
  const inputShaft = cylinderAlongZ(0.23, 1.10, darkMaterial, 38);
  inputShaft.userData.role = 'common-crankshaft-through-both-eccentrics';
  inputRotor.add(inputShaft);

  const aheadSheave = makeIndexedEccentricSheave({
    material: driverMaterial,
    radius: sheaveRadius,
    rimMaterial: darkMaterial,
    width: sheaveWidth,
    z: aheadLayerZ,
  });
  aheadSheave.position.x = -eccentricity;
  aheadSheave.userData.role = 'ahead-eccentric-sheave';
  const asternSheave = makeIndexedEccentricSheave({
    material: driverMaterial,
    radius: sheaveRadius,
    rimMaterial: darkMaterial,
    width: sheaveWidth,
    z: asternLayerZ,
  });
  asternSheave.position.x = eccentricity;
  asternSheave.userData.role = 'astern-eccentric-sheave';
  inputRotor.add(aheadSheave, asternSheave);

  root.add(inputRotor);

  const aheadStrap = makeEccentricStrap({
    material: brassMaterial,
    radius: strapPitchRadius,
    sheaveRadius,
    length: aheadEccentricRodLength,
    z: aheadLayerZ,
  });
  aheadStrap.userData.role = 'ahead-eccentric-strap';
  const asternStrap = makeEccentricStrap({
    material: brassMaterial,
    radius: strapPitchRadius,
    sheaveRadius,
    length: asternEccentricRodLength,
    z: asternLayerZ,
  });
  asternStrap.userData.role = 'astern-eccentric-strap';
  const aheadEccentricRod = aheadStrap;
  const asternEccentricRod = asternStrap;
  root.add(aheadStrap, asternStrap);

  const linkGroup = new THREE.Group();
  linkGroup.userData.role =
    'single-rigid-curved-slotted-stephenson-launch-link';
  const translateProfile = (shape, x, y) => shape.map(polygon =>
    polygon.map(ring => ring.map(point => [point[0] + x, point[1] + y])));
  const upperArc = (halfWidth, halfAngle, rightAngle = halfAngle) => translateProfile(
    sector(linkSlotRadius - halfWidth, linkSlotRadius + halfWidth,
      -Math.PI / 2 - halfAngle, -Math.PI / 2 + rightAngle, 192), 0, linkSlotRadius);
  const reachLugLocal = sourcePointFromRaster(new THREE.Vector2(60, 298)).sub(linkCenterAtSource);
  const upperPinPoints = [aheadLinkPinLocal, asternLinkPinLocal, reachLugLocal];
  const upperOutline = clip.union(upperArc(.17, visibleLinkHalfAngle, visibleLinkRightAngle),
    ...upperPinPoints.map(point => poly(circle(point.toArray(), .13, 96))));
  const upperLinkPlate = new THREE.Mesh(plate(clip.difference(upperOutline,
    upperArc(.06, visibleLinkHalfAngle - .035, visibleLinkRightAngle - .035),
    ...upperPinPoints.map(point => poly(circle(point.toArray(), .074, 96)))), -.10, .10), accentMaterial);
  upperLinkPlate.userData.role = 'finite-stephenson-link-with-through-slot-and-pin-bores';
  linkGroup.add(upperLinkPlate);
  const linkEndBridges = []; // Closed ends are integral to the plate.
  const linkPinAssemblies = [
    {
      localPoint: aheadLinkPinLocal,
      role: 'ahead-eccentric-rod-pin-behind-link-slot',
      z: aheadLayerZ,
    },
    {
      localPoint: asternLinkPinLocal,
      role: 'astern-eccentric-rod-pin-behind-link-slot',
      z: asternLayerZ,
    },
  ].map(({ localPoint, role, z }) => {
    const group = new THREE.Group();
    group.position.set(localPoint.x, localPoint.y, 0);
    group.userData.role = role;
    const eye = makeEye(0.13, 0.055, drivenMaterial, z + Math.sign(z) * .14);
    const pin = cylinderAlongZ(0.07, 0.72, darkMaterial, 24);
    pin.position.z = z;
    group.add(eye, pin);
    linkGroup.add(group);
    return group;
  });
  const reachLug = new THREE.Group();
  reachLug.position.set(reachLugLocal.x, reachLugLocal.y, 0.32);
  reachLug.userData.role = 'source-visible-link-lifting-reach-lug';
  const reachLugPin = cylinderAlongZ(0.07, 0.72, darkMaterial, 24);
  reachLugPin.position.z = -0.12;
  reachLug.add(
    makeEye(0.13, 0.052, accentMaterial, 0),
    reachLugPin,
  );
  linkGroup.add(reachLug);
  root.add(linkGroup);

  const reversingReachRod = new THREE.Group();
  const reachLength = (sourceRasterAxisX - 6) * sourceUnitsPerPixel + reachLugLocal.x - .045;
  const reachOutline = clip.union(capsule([0, 0], [reachLength, 0], .045),
    poly(circle([0, 0], .12, 96)));
  reversingReachRod.add(new THREE.Mesh(plate(clip.difference(reachOutline,
    poly(circle([0, 0], .074, 96))), -.05, .05), driverMaterial));
  reversingReachRod.userData.setEndpoints = (start, end) => {
    reversingReachRod.position.set(start.x, start.y, .50);
    reversingReachRod.rotation.z = Math.atan2(end.y - start.y, end.x - start.x);
  };
  reversingReachRod.userData.kinematicConstraint = 'operator-prescribes-selected-die-point';
  reversingReachRod.userData.role = 'source-visible-off-frame-reversing-reach-rod';
  root.add(reversingReachRod);

  const dieBlock = new THREE.Group();
  dieBlock.userData.role =
    'guided-die-block-sliding-inside-stephenson-link-slot';
  const dieBody = new THREE.Mesh(
    plate(clip.difference(upperArc(.055, .03),
      poly(circle([0, 0], .049, 96))), -.39, -.21),
    darkMaterial,
  );
  dieBody.userData.role = 'curved-link-die-with-pin-bore';
  const diePin = cylinderAlongZ(0.045, 0.88, brassMaterial, 28);
  diePin.userData.role = 'die-pin-to-output-radius-rod';
  const dieIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 20, 14),
    whiteMaterial,
  );
  dieIndex.position.z = 0.49;
  dieIndex.userData.role = 'white-index-on-link-die';
  dieBlock.add(dieBody, diePin, dieIndex);
  const dieGuide = new THREE.Group();
  dieGuide.userData.role = 'fixed-upper-bearing-for-vertical-guide-tail';
  const guideBody = new THREE.Mesh(plate(clip.difference(
    poly([[-.15, -.10], [.15, -.10], [.15, .10], [-.15, .10]]),
    poly([[-.052, -.057], [.052, -.057], [.052, .057], [-.052, .057]])),
    -.13, .13).rotateX(Math.PI / 2), frameMaterial);
  guideBody.position.set(0, shaftCenter.y - (146 - 52) * sourceUnitsPerPixel, .52);
  dieGuide.add(guideBody);
  root.add(dieGuide, dieBlock);

  const cylinderCarrier = new THREE.Group();
  cylinderCarrier.position.set(trunnionCenter.x, trunnionCenter.y, 0);
  cylinderCarrier.userData.axis = Z_AXIS.clone();
  cylinderCarrier.userData.role =
    'cylinder-carried-follower-rockshaft';
  const slideCarrier = new THREE.Group();
  slideCarrier.position.set(trunnionCenter.x, trunnionCenter.y, 0);
  slideCarrier.userData.role = 'frame-fixed-slide-guide-columns';
  root.add(slideCarrier);

  const slideGuidePosts = [-1, 1].map((sign) => {
    const post = cylinderAlongY(0.055, lowerGuideLength, darkMaterial, 22);
    post.position.set(sign * lowerGuideHalfX, lowerGuideCenterY, -0.05);
    post.userData.role = `${sign < 0 ? 'left' : 'right'}-frame-fixed-slide-guide`;
    slideCarrier.add(post);
    return post;
  });

  const curvedSlide = new THREE.Group();
  curvedSlide.userData.role =
    'rigid-curved-slide-translating-in-frame-fixed-guides';
  const lowerInnerRail = new THREE.Mesh(plate(sector(slotRadius - .13, slotRadius - .051,
    Math.PI / 2 - lowerHalfAngle, Math.PI / 2 + lowerHalfAngle, 192), .085, .235), drivenMaterial);
  lowerInnerRail.userData.role = 'inner-edge-of-trunnion-centered-slot';
  const lowerOuterRail = new THREE.Mesh(plate(sector(slotRadius + .051, slotRadius + .13,
    Math.PI / 2 - lowerHalfAngle, Math.PI / 2 + lowerHalfAngle, 192), .085, .235), drivenMaterial);
  lowerOuterRail.userData.role = 'outer-edge-of-trunnion-centered-slot';
  const lowerEndBridges = [-1, 1].map(sign => new THREE.Mesh(plate(
    sector(slotRadius - .13, slotRadius + .13,
      Math.PI / 2 + sign * lowerHalfAngle - .025,
      Math.PI / 2 + sign * lowerHalfAngle + .025, 24), .085, .235), drivenMaterial));
  curvedSlide.add(lowerInnerRail, lowerOuterRail, ...lowerEndBridges);
  const slideBlocks = [-1, 1].map((sign, index) => {
    const [left, top, right, bottom] = sourceRasterBlockBounds[index];
    const guideX = sourceRasterAxisX + sign * lowerGuideHalfX / sourceUnitsPerPixel;
    const x0 = (left - guideX) * sourceUnitsPerPixel;
    const x1 = (right - guideX) * sourceUnitsPerPixel;
    const halfHeight = (bottom - top) * sourceUnitsPerPixel / 2;
    const block = new THREE.Mesh(
      plate(clip.difference(poly([[x0, -.25], [x1, -.25], [x1, .25], [x0, .25]]),
        poly(circle([0, -.03], .059, 96))), -halfHeight, halfHeight).rotateX(Math.PI / 2),
      drivenMaterial,
    );
    block.position.set(
      sign * lowerGuideHalfX,
      (sourceRasterTrunnion.y - (top + bottom) / 2) * sourceUnitsPerPixel,
      -0.02,
    );
    block.userData.role = `${sign < 0 ? 'left' : 'right'}-moving-curved-slide-guide-block`;
    curvedSlide.add(block);
    return block;
  });
  const slideEye = new THREE.Group();
  slideEye.position.set(0, slideEyeRadius, 0.16);
  slideEye.userData.role = 'upper-eye-of-curved-slide';
  const slideEyeRing = new THREE.Mesh(plate(clip.difference(clip.union(
    poly(circle([0, 0], .21, 96)), capsule([0, slotRadius + .18 - slideEyeRadius], [0, 0], .10)),
    poly(circle([0, 0], .079, 96))), -.075, .075), drivenMaterial);
  const slideEyePin = cylinderAlongZ(0.075, 0.90, darkMaterial, 24);
  slideEye.add(slideEyeRing, slideEyePin);
  curvedSlide.add(slideEye);
  slideCarrier.add(curvedSlide);

  const rockshaftRotor = new THREE.Group();
  rockshaftRotor.position.set(
    rockshaftPivotLocal.x,
    rockshaftPivotLocal.y,
    0.34,
  );
  rockshaftRotor.userData.axis = Z_AXIS.clone();
  rockshaftRotor.userData.role =
    'valve-rockshaft-with-slot-follower-and-opposite-valve-arm';
  const followerPin = cylinderAlongZ(0.045, 0.68, whiteMaterial, 28);
  followerPin.position.set(followerArmLocal.x, followerArmLocal.y, 0);
  followerPin.userData.role = 'white-pin-captured-within-curved-slide-slot';
  rockshaftRotor.add(followerPin);
  cylinderCarrier.add(rockshaftRotor);
  root.add(cylinderCarrier);

  const outputRadiusRod = finiteMarineOutputRod(outputRodLength, (300 - 117) * sourceUnitsPerPixel - .045);
  outputRadiusRod.userData.role =
    'finite-die-output-rod-to-vertically-guided-curved-slide';
  root.add(outputRadiusRod);

  const trunnionShaft = cylinderAlongZ(0.33, 0.64, darkMaterial, 38);
  trunnionShaft.position.set(trunnionCenter.x, trunnionCenter.y, -0.05);
  trunnionShaft.userData.role = 'fixed-axis-through-oscillating-cylinder-trunnion';
  const trunnionFace = new THREE.Mesh(plate(clip.difference(
    poly(circle([0, 0], .44, 128)), poly(circle([0, 0], .336, 128))), -.12, .12), frameMaterial);
  trunnionFace.position.set(trunnionCenter.x, trunnionCenter.y, 0);
  trunnionFace.userData.role = 'front-trunnion-bearing-face';
  root.add(trunnionShaft, trunnionFace);

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 9.4, 3.4),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0, 0.45, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.role = 'invisible-full-motion-camera-envelope';
  root.add(cameraEnvelope);

  const blocks = {
    aheadEccentricRod,
    aheadSheave,
    aheadStrap,
    asternEccentricRod,
    asternSheave,
    asternStrap,
    cameraEnvelope,
    curvedSlide,
    cylinderCarrier,
    slideCarrier,
    dieBlock,
    dieBody,
    dieGuide,
    dieIndex,
    diePin,
    followerPin,
    inputRotor,
    inputShaft,
    linkEndBridges,
    linkGroup,
    upperLinkPlate,
    linkPinAssemblies,
    lowerInnerRail,
    lowerOuterRail,
    lowerEndBridges,
    outputRadiusRod,
    reachLug,
    reversingReachRod,
    rockshaftRotor,
    slideBlocks,
    slideEye,
    slideEyePin,
    slideEyeRing,
    slideGuidePosts,
    trunnionFace,
    trunnionShaft,
  };

  const geometry = {
    aheadEccentricRodLength,
    aheadLayerZ,
    aheadLinkPinLocal: aheadLinkPinLocal.clone(),
    asternEccentricRodLength,
    asternLayerZ,
    asternLinkPinLocal: asternLinkPinLocal.clone(),
    dieGuideX,
    eccentricity,
    followerArmLength,
    linkCenterAtSource: linkCenterAtSource.clone(),
    linkPinSpacing,
    linkSlotRadius,
    lowerHalfAngle,
    lowerGuideHalfX,
    lowerGuideCenterY,
    lowerGuideLength,
    sourceRasterBlockBounds,
    mainCrankPinLocal: mainCrankPinLocal.clone(),
    mainCrankRadius,
    outputRodLength,
    rockshaftPivotLocal: rockshaftPivotLocal.clone(),
    selectorHalfAngle,
    selectorAsymmetry,
    selectorPeriod,
    shaftCenter: shaftCenter.clone(),
    slideEyeRadius,
    slotRadius,
    sourceFollowerPinLocal: sourceFollowerPinLocal.clone(),
    sourceImageHeight,
    sourceImageWidth,
    sourceInputAngle,
    sourceRasterAheadLinkPin: sourceRasterAheadLinkPin.clone(),
    sourceRasterAsternLinkPin: sourceRasterAsternLinkPin.clone(),
    sourceRasterFollowerPin: sourceRasterFollowerPin.clone(),
    sourceRasterLinkDie: sourceRasterLinkDie.clone(),
    sourceRasterShaftCenter: sourceRasterShaftCenter.clone(),
    sourceRasterSlideEye: sourceRasterSlideEye.clone(),
    sourceRasterTrunnion: sourceRasterTrunnion.clone(),
    sourceSelector,
    sourceSlideStroke,
    sourceUnitsPerPixel,
    strapPitchRadius,
    trunnionCenter: trunnionCenter.clone(),
    valveArmLocal: valveArmLocal.clone(),
    valveGuideX,
    valveLinkLength,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.inputAngle;
    aheadStrap.position.set(
      state.aheadEccentricCenter.x,
      state.aheadEccentricCenter.y,
      0,
    );
    asternStrap.position.set(
      state.asternEccentricCenter.x,
      state.asternEccentricCenter.y,
      0,
    );
    setDynamicLinkEndpoints(
      aheadEccentricRod,
      new THREE.Vector3(
        state.aheadEccentricCenter.x,
        state.aheadEccentricCenter.y,
        aheadLayerZ,
      ),
      new THREE.Vector3(
        state.aheadLinkPin.x,
        state.aheadLinkPin.y,
        aheadLayerZ,
      ),
    );
    setDynamicLinkEndpoints(
      asternEccentricRod,
      new THREE.Vector3(
        state.asternEccentricCenter.x,
        state.asternEccentricCenter.y,
        asternLayerZ,
      ),
      new THREE.Vector3(
        state.asternLinkPin.x,
        state.asternLinkPin.y,
        asternLayerZ,
      ),
    );
    linkGroup.position.set(
      state.linkPosition.x,
      state.linkPosition.y,
      0,
    );
    linkGroup.rotation.z = state.linkAngle;
    dieBlock.position.set(state.diePoint.x, state.diePoint.y, 0.30);
    dieBlock.rotation.z = state.linkAngle + state.dieSlotAngle;

    const reachLugWorld = pointInPose(
      state.linkPosition,
      state.linkAngle,
      reachLugLocal,
    );
    const reachHandleWorld = reachLugWorld.clone().add(
      new THREE.Vector2(-reachLength, 0),
    );
    setDynamicLinkEndpoints(
      reversingReachRod,
      new THREE.Vector3(reachLugWorld.x, reachLugWorld.y, 0.32),
      new THREE.Vector3(reachHandleWorld.x, reachHandleWorld.y, 0.32),
    );

    cylinderCarrier.rotation.z = state.cylinderAngle;
    curvedSlide.position.set(0, state.slideStroke, 0);
    rockshaftRotor.rotation.z = state.rockshaftAngle;
    setDynamicLinkEndpoints(
      outputRadiusRod,
      new THREE.Vector3(state.diePoint.x, state.diePoint.y, 0.50),
      new THREE.Vector3(
        state.slideEyeWorld.x,
        state.slideEyeWorld.y,
        0.50,
      ),
    );
    root.userData.kinematics = state;
  };

  const canonicalTimes = {
    sourceMidGear: 0,
    aheadFullGear: selectorPeriod * 0.75,
    nextSourceMidGear: selectorPeriod,
    asternFullGear: selectorPeriod * 0.25,
  };
  const canonicalStates = {
    aheadAtQuarterTurn: stateAtInputAngle(Math.PI / 2, -1),
    asternAtQuarterTurn: stateAtInputAngle(Math.PI / 2, 1),
    midGearAtQuarterTurn: stateAtInputAngle(Math.PI / 2, 0),
    sourceMidGear: stateAtInputAngle(sourceInputAngle, sourceSelector),
  };

  root.userData.archetype =
    'opposed-eccentric-stephenson-link-trunnion-centered-oscillating-cylinder-valve-gear';
  root.userData.blocks = blocks;
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = geometry;
  root.userData.linkSlotPoint = linkSlotPoint;
  root.userData.lowerStateAtSlideStroke = lowerStateAtSlideStroke;
  root.userData.mechanism =
    'opposed-eccentric-stephenson-link-trunnion-centered-oscillating-cylinder-valve-gear';
  root.userData.selectorAtTime = selectorAtTime;
  root.userData.sourcePointFromRaster = sourcePointFromRaster;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.cameraDistanceScale = 1.04;
  root.userData.fidelity = 'authored';
  root.userData.hideGround = true;
  root.userData.supportsRestart = true;
  root.userData.materialsIgnoreSceneFog = true;

  // Fit the moving hardware, excluding the old oversized invisible envelope.
  root.remove(cameraEnvelope);
  const motionBounds = new THREE.Box3();
  for (let i = 0; i <= 180; i++) {
    update(selectorPeriod * i / 180);
    root.updateMatrixWorld(true);
    motionBounds.union(new THREE.Box3().setFromObject(root, true));
  }
  root.userData.cameraFitBounds = motionBounds.expandByScalar(.06);
  root.userData.cameraFov = 8;
  cameraEnvelope.geometry.dispose();
  cameraEnvelope.material.dispose();
  update(0);
  root.traverse(object => {
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) material.fog = false;
  });
  markShadows(root);
  for (const object of [
    cameraEnvelope,
    dieIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(0, 0, 1),
    root,
    update,
    reset: () => update(0),
  };
}

export function createAuthoredMarineValveGearMovement(movement) {
  if (movement.id !== 171) return null;
  return oscillatingMarineEngineStephensonValveGear();
}
