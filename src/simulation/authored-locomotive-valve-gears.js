import { plate, poly, circle, capsule, sector, ring, polygonClipping as clip } from './finite-plate-geometry.js';
import { boredPlanarLinkGeometry } from './bored-planar-link.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeDynamicLink,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongZ(radius, length, material, segments = 28) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function cylinderAlongX(radius, length, material, segments = 28) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
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
    return null;
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

function circleCircleIntersections(centerA, radiusA, centerB, radiusB) {
  const centers = centerB.clone().sub(centerA);
  const distance = centers.length();
  if (
    distance < 1e-12
      || distance > radiusA + radiusB + 1e-10
      || distance < Math.abs(radiusA - radiusB) - 1e-10
  ) return [];

  const along = (
    radiusA ** 2 - radiusB ** 2 + distance ** 2
  ) / (2 * distance);
  const perpendicular = Math.sqrt(Math.max(0, radiusA ** 2 - along ** 2));
  const direction = centers.multiplyScalar(1 / distance);
  const middle = centerA.clone().addScaledVector(direction, along);
  const normal = new THREE.Vector2(-direction.y, direction.x);
  return [
    middle.clone().addScaledVector(normal, perpendicular),
    middle.clone().addScaledVector(normal, -perpendicular),
  ];
}

function smootherstepLaw(normalized) {
  const value = normalized ** 3 * (
    normalized * (normalized * 6 - 15) + 10
  );
  const firstDerivative = 30 * normalized ** 2 * (1 - normalized) ** 2;
  const secondDerivative = 60 * normalized
    * (1 - normalized)
    * (1 - 2 * normalized);
  return { firstDerivative, secondDerivative, value };
}

function makeEye(radius, tubeRadius, material, z = 0) {
  const eye = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 12, 40),
    material,
  );
  eye.position.z = z;
  return eye;
}

function makeArcRail({
  center,
  halfAngle,
  material,
  radius,
  tubeRadius,
  z,
}) {
  const points = Array.from({ length: 73 }, (_, index) => {
    const angle = -halfAngle + 2 * halfAngle * index / 72;
    return new THREE.Vector3(
      center.x - radius * Math.cos(angle),
      center.y + radius * Math.sin(angle),
      z,
    );
  });
  return new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points, false, 'centripetal'),
      112,
      tubeRadius,
      12,
      false,
    ),
    material,
  );
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
  body.userData.role = 'eccentric-sheave-fast-on-common-locomotive-shaft';
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.94, 0.055, 10, 56),
    rimMaterial,
  );
  rim.position.z = z + width * 0.52;
  rim.userData.role = 'working-face-beneath-free-eccentric-strap';
  const index = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 0.62, 0.075, 0.035),
    matte(PALETTE.white, { roughness: 0.42 }),
  );
  index.position.set(radius * 0.34, 0, z + width * 0.57);
  index.userData.role = 'white-index-on-eccentric-sheave';
  group.add(body, rim, index);
  group.userData.body = body;
  group.userData.index = index;
  group.userData.rim = rim;
  return group;
}

function makeEccentricStrap({ material, radius, z }) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.072, 12, 64),
    material,
  );
  ring.position.z = z;
  ring.userData.role = 'free-strap-following-one-eccentric-center';
  const tailBoss = cylinderAlongZ(0.12, 0.20, material, 24);
  tailBoss.position.set(-radius * 0.88, 0, z);
  tailBoss.userData.role = 'eccentric-rod-eye-on-free-strap';
  group.add(ring, tailBoss);
  group.userData.ring = ring;
  group.userData.tailBoss = tailBoss;
  return group;
}

function setDynamicLinkEndpoints(link, start, end) {
  link.userData.setEndpoints(
    new THREE.Vector3(start.x, start.y, start.z ?? 0),
    new THREE.Vector3(end.x, end.y, end.z ?? 0),
  );
}

function locomotiveStephensonExpansionLinkValveGear() {
  const root = new THREE.Group();

  // Brown's front elevation is 525 x 263 pixels. The common shaft, expansion
  // link, lifting gear, rockshaft, and valve stem establish one shared scale;
  // the small departures below are depth separations needed to make the
  // overlapped engraving readable as a real assembly.
  const sourceImageWidth = 525;
  const sourceImageHeight = 263;
  const sourceRasterShaftCenter = new THREE.Vector2(478, 191);
  const sourceRasterLinkCenter = new THREE.Vector2(280, 181);
  const sourceRasterAheadLinkPin = new THREE.Vector2(284, 167);
  const sourceRasterAsternLinkPin = new THREE.Vector2(297, 235);
  const sourceRasterReversingPivot = new THREE.Vector2(181, 64);
  const sourceRasterValveJoint = new THREE.Vector2(234, 101);

  const scale = 0.16;
  const shaftCenter = new THREE.Vector2(4.30, -0.20);
  const eccentricity = 2 * scale;
  const linkSlotCenterLocal = new THREE.Vector2(29 * scale, 0);
  const linkPositionAtNeutral = shaftCenter.clone().sub(linkSlotCenterLocal);
  const aheadLinkPinLocal = new THREE.Vector2(
    5.091327 * scale,
    4.091738 * scale,
  );
  const asternLinkPinLocal = new THREE.Vector2(
    5.091327 * scale,
    -4.091738 * scale,
  );
  const linkSuspensionPinLocal = new THREE.Vector2(0, 0);
  const linkPinSpacing = aheadLinkPinLocal.distanceTo(asternLinkPinLocal);
  const linkSlotRadius = 26 * scale;
  // Pass 72: Brown's link is about 1.29 times its pin spacing overall (85
  // px against 66 px). The slot's closed ends are centred at this half-angle
  // and are linkEndThickness thick; the die is a short square block.
  const linkEndThickness = 0.13;
  const dieHalfLength = 0.10;
  const visibleLinkHalfAngle = (1.29 * 8.183476 * scale / 2 - linkEndThickness / 2) / (26 * scale);
  // Largest die-centre slot angle that keeps the die block clear of the
  // closed ends (with 0.004 running clearance).
  const freeDieHalfAngle = visibleLinkHalfAngle
    - (linkEndThickness / 2 + dieHalfLength + 0.004) / (26 * scale);
  const linkSlotHalfWidth = 0.115;
  const reversingPivot = shaftCenter.clone().add(
    new THREE.Vector2(-38.5 * scale, 15 * scale),
  );
  const reversingShortArmLength = 9.5 * scale;
  const reversingLongArmLength = 20.8 * scale;
  // Pass 72: the die slips about +-0.06 rad in the slot (the lifting lug
  // sits 0.48 left of the slot, as Brown draws it), so full gear stops short
  // of the rod pins and the die stays between them and inside the shorter
  // slot. Brown's notched quadrant is correspondingly short.
  const maximumReversingAngle = 0.22;
  // Brown's lever pose: the same reversing-arm angle (-0.081 rad) as before
  // pass 72, now a larger fraction of the shorter quadrant.
  const sourceSelector = -0.081 / 0.22;
  const sourceInputAngle = 0;
  const sourceUnitsPerPixel = linkSlotRadius / (
    sourceRasterShaftCenter.x - sourceRasterLinkCenter.x
  );

  const sourcePointFromRaster = (point) => new THREE.Vector2(
    shaftCenter.x
      + (point.x - sourceRasterShaftCenter.x) * sourceUnitsPerPixel,
    shaftCenter.y
      - (point.y - sourceRasterShaftCenter.y) * sourceUnitsPerPixel,
  );

  const eccentricCenterAt = (inputAngle, sign) => shaftCenter.clone().add(
    rotate2(inputAngle, new THREE.Vector2(0, sign * eccentricity)),
  );
  const reversingAnchorAt = (selector) => reversingPivot.clone().add(
    rotate2(
      THREE.MathUtils.clamp(selector, -1, 1) * maximumReversingAngle,
      new THREE.Vector2(reversingShortArmLength, 0),
    ),
  );
  const sourceAheadCenter = eccentricCenterAt(sourceInputAngle, 1);
  const sourceAsternCenter = eccentricCenterAt(sourceInputAngle, -1);
  const aheadEccentricRodLength = sourceAheadCenter.distanceTo(
    pointInPose(linkPositionAtNeutral, 0, aheadLinkPinLocal),
  );
  const asternEccentricRodLength = sourceAsternCenter.distanceTo(
    pointInPose(linkPositionAtNeutral, 0, asternLinkPinLocal),
  );
  const suspensionRodLength = linkPositionAtNeutral.distanceTo(
    reversingAnchorAt(0),
  );

  const attemptLinkPose = (inputAngle, selector, seed) => {
    const aheadEccentricCenter = eccentricCenterAt(inputAngle, 1);
    const asternEccentricCenter = eccentricCenterAt(inputAngle, -1);
    const reversingAnchor = reversingAnchorAt(selector);
    const pose = seed.clone();
    let iterations = 0;
    let maximumResidual = Infinity;

    for (let iteration = 0; iteration < 24; iteration += 1) {
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
      const suspensionPin = pointInPose(
        position,
        pose.z,
        linkSuspensionPinLocal,
      );
      const aheadDifference = aheadLinkPin.clone().sub(
        aheadEccentricCenter,
      );
      const asternDifference = asternLinkPin.clone().sub(
        asternEccentricCenter,
      );
      const suspensionDifference = suspensionPin.clone().sub(
        reversingAnchor,
      );
      const residual = [
        aheadDifference.lengthSq() - aheadEccentricRodLength ** 2,
        asternDifference.lengthSq() - asternEccentricRodLength ** 2,
        suspensionDifference.lengthSq() - suspensionRodLength ** 2,
      ];
      maximumResidual = Math.max(...residual.map(Math.abs));
      if (maximumResidual < 1e-13) break;

      const aheadAngularDerivative = rotationDerivative2(
        pose.z,
        aheadLinkPinLocal,
      );
      const asternAngularDerivative = rotationDerivative2(
        pose.z,
        asternLinkPinLocal,
      );
      const suspensionAngularDerivative = rotationDerivative2(
        pose.z,
        linkSuspensionPinLocal,
      );
      const correction = solveLinear3([
        2 * aheadDifference.x,
        2 * aheadDifference.y,
        2 * aheadDifference.dot(aheadAngularDerivative),
        2 * asternDifference.x,
        2 * asternDifference.y,
        2 * asternDifference.dot(asternAngularDerivative),
        2 * suspensionDifference.x,
        2 * suspensionDifference.y,
        2 * suspensionDifference.dot(suspensionAngularDerivative),
      ], residual.map((value) => -value));
      if (correction === null) return null;
      const correctionLength = correction.length();
      if (correctionLength > 0.55) correction.multiplyScalar(
        0.55 / correctionLength,
      );
      pose.add(correction);
      pose.z = wrapAngle(pose.z);
    }

    if (maximumResidual >= 1e-10) return null;
    return { iterations, pose };
  };

  const solveLinkPose = (inputAngle, selector) => {
    const resolvedInputAngle = wrapAngle(inputAngle);
    const resolvedSelector = THREE.MathUtils.clamp(selector, -1, 1);
    const seeds = [
      new THREE.Vector3(
        linkPositionAtNeutral.x,
        linkPositionAtNeutral.y,
        0,
      ),
      new THREE.Vector3(
        linkPositionAtNeutral.x,
        linkPositionAtNeutral.y,
        0.32,
      ),
      new THREE.Vector3(
        linkPositionAtNeutral.x,
        linkPositionAtNeutral.y,
        -0.32,
      ),
    ];
    let solution = null;
    for (const seed of seeds) {
      solution = attemptLinkPose(
        resolvedInputAngle,
        resolvedSelector,
        seed,
      );
      if (solution !== null) break;
    }
    if (solution === null) {
      throw new RangeError(
        'Movement 185 could not close its two eccentric rods and suspension rod.',
      );
    }

    const linkPosition = new THREE.Vector2(
      solution.pose.x,
      solution.pose.y,
    );
    const linkAngle = solution.pose.z;
    const aheadEccentricCenter = eccentricCenterAt(resolvedInputAngle, 1);
    const asternEccentricCenter = eccentricCenterAt(resolvedInputAngle, -1);
    const aheadLinkPin = pointInPose(
      linkPosition,
      linkAngle,
      aheadLinkPinLocal,
    );
    const asternLinkPin = pointInPose(
      linkPosition,
      linkAngle,
      asternLinkPinLocal,
    );
    const suspensionPin = pointInPose(
      linkPosition,
      linkAngle,
      linkSuspensionPinLocal,
    );
    const reversingAnchor = reversingAnchorAt(resolvedSelector);

    return {
      aheadEccentricCenter,
      aheadLinkPin,
      aheadRodLengthError: Math.abs(
        aheadEccentricCenter.distanceTo(aheadLinkPin)
          - aheadEccentricRodLength
      ),
      asternEccentricCenter,
      asternLinkPin,
      asternRodLengthError: Math.abs(
        asternEccentricCenter.distanceTo(asternLinkPin)
          - asternEccentricRodLength
      ),
      eccentricOppositionError: aheadEccentricCenter.clone()
        .add(asternEccentricCenter)
        .sub(shaftCenter.clone().multiplyScalar(2))
        .length(),
      inputAngle: resolvedInputAngle,
      iterations: solution.iterations,
      linkAngle,
      linkPinSpacingError: Math.abs(
        aheadLinkPin.distanceTo(asternLinkPin) - linkPinSpacing
      ),
      linkPosition,
      reversingAnchor,
      reversingAngle: resolvedSelector * maximumReversingAngle,
      selector: resolvedSelector,
      suspensionPin,
      suspensionRodLengthError: Math.abs(
        suspensionPin.distanceTo(reversingAnchor) - suspensionRodLength
      ),
    };
  };

  const outputRockerPivot = shaftCenter.clone().add(
    new THREE.Vector2(-26 * scale, 7 * scale),
  );
  const outputRockerLowerArmLength = 7 * scale;
  const outputRockerLowerArmAtSource = new THREE.Vector2(
    0,
    -outputRockerLowerArmLength,
  );
  const outputRockerUpperArmAtSource = new THREE.Vector2(-0.08, 0.80);
  const sourceRockerLowerAngle = Math.atan2(
    outputRockerLowerArmAtSource.y,
    outputRockerLowerArmAtSource.x,
  );
  const valveGuideY = 1.69;
  const valveRodLength = 0.74;

  const stateAtInputAngle = (inputAngle, selector = sourceSelector) => {
    const state = solveLinkPose(inputAngle, selector);
    const slotCenter = pointInPose(
      state.linkPosition,
      state.linkAngle,
      linkSlotCenterLocal,
    );
    const dieCandidates = circleCircleIntersections(
      slotCenter,
      linkSlotRadius,
      outputRockerPivot,
      outputRockerLowerArmLength,
    ).map((point) => {
      const localPoint = rotate2(
        -state.linkAngle,
        point.clone().sub(state.linkPosition),
      );
      const slotParameter = Math.atan2(
        localPoint.y - linkSlotCenterLocal.y,
        -(localPoint.x - linkSlotCenterLocal.x),
      );
      return { localPoint, point, slotParameter };
    }).sort(
      (left, right) => Math.abs(left.slotParameter)
        - Math.abs(right.slotParameter),
    );
    if (dieCandidates.length !== 2) {
      throw new RangeError(
        'Movement 185 die left either its expansion-link slot or output rocker.',
      );
    }
    const die = dieCandidates[0];
    if (Math.abs(die.slotParameter) > freeDieHalfAngle) {
      throw new RangeError('Movement 185 die left the visible slotted link.');
    }
    const rockerAngle = wrapAngle(
      Math.atan2(
        die.point.y - outputRockerPivot.y,
        die.point.x - outputRockerPivot.x,
      ) - sourceRockerLowerAngle,
    );
    const rockerUpperPoint = outputRockerPivot.clone().add(
      rotate2(rockerAngle, outputRockerUpperArmAtSource),
    );
    const valveVerticalDifference = valveGuideY - rockerUpperPoint.y;
    const valveHorizontalReachSquared = valveRodLength ** 2
      - valveVerticalDifference ** 2;
    if (valveHorizontalReachSquared < -1e-12) {
      throw new RangeError(
        'Movement 185 output rocker cannot reach its guided valve stem.',
      );
    }
    const valveStemPoint = new THREE.Vector2(
      rockerUpperPoint.x - Math.sqrt(Math.max(0, valveHorizontalReachSquared)),
      valveGuideY,
    );
    return {
      ...state,
      alternateDieSlotParameter: dieCandidates[1].slotParameter,
      dieBranchSeparation: Math.abs(dieCandidates[1].slotParameter)
        - Math.abs(die.slotParameter),
      dieLocalPoint: die.localPoint,
      diePoint: die.point,
      dieSlotContactError: Math.abs(
        die.point.distanceTo(slotCenter) - linkSlotRadius
      ),
      dieSlotParameter: die.slotParameter,
      outputRockerLowerArmError: Math.abs(
        die.point.distanceTo(outputRockerPivot)
          - outputRockerLowerArmLength
      ),
      outputRockerPivot: outputRockerPivot.clone(),
      rockerAngle,
      rockerUpperPoint,
      slotCenter,
      stage: state.selector < -0.82
        ? 'forward-eccentric-in-full-gear'
        : state.selector > 0.82
          ? 'backward-eccentric-in-full-gear'
          : Math.abs(state.selector) < 0.08
            ? 'mid-gear-with-only-link-slip'
            : 'partial-gear-expansive-cutoff',
      valveGuideError: Math.abs(valveStemPoint.y - valveGuideY),
      valveRodLengthError: Math.abs(
        rockerUpperPoint.distanceTo(valveStemPoint) - valveRodLength
      ),
      valveStemPoint,
    };
  };

  const selectorPeriod = 24;
  const inputTurnsPerSelectorCycle = 1; // net forward turns (pass 71: the shaft reverses with the gear)
  const selectorBreaks = Object.freeze({
    sourceHoldEnd: 0.08,
    forwardTransitionEnd: 0.17,
    forwardHoldEnd: 0.30,
    midTransitionEnd: 0.40,
    midHoldEnd: 0.53,
    backwardTransitionEnd: 0.63,
    backwardHoldEnd: 0.76,
    sourceTransitionEnd: 0.90,
  });

  const transitionLaw = (phase, start, end, from, to, stage) => {
    const duration = end - start;
    const normalized = THREE.MathUtils.clamp(
      (phase - start) / duration,
      0,
      1,
    );
    const smooth = smootherstepLaw(normalized);
    return {
      accelerationPerPhaseSquared:
        (to - from) * smooth.secondDerivative / duration ** 2,
      ratePerPhase: (to - from) * smooth.firstDerivative / duration,
      stage,
      value: THREE.MathUtils.lerp(from, to, smooth.value),
    };
  };

  const selectorLawAtCyclePhase = (cyclePhase) => {
    // Preserve exact in-cycle breakpoints. Applying modulo to a value such as
    // 0.17 can round it just below the boundary and leak a tiny non-zero
    // acceleration out of an otherwise C2 transition.
    const phase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    if (phase < selectorBreaks.sourceHoldEnd) {
      return {
        accelerationPerPhaseSquared: 0,
        ratePerPhase: 0,
        stage: 'source-partial-forward-hold',
        value: sourceSelector,
      };
    }
    if (phase < selectorBreaks.forwardTransitionEnd) {
      return transitionLaw(
        phase,
        selectorBreaks.sourceHoldEnd,
        selectorBreaks.forwardTransitionEnd,
        sourceSelector,
        -1,
        'moving-reversing-lever-to-full-forward',
      );
    }
    if (phase < selectorBreaks.forwardHoldEnd) {
      return {
        accelerationPerPhaseSquared: 0,
        ratePerPhase: 0,
        stage: 'full-forward-hold',
        value: -1,
      };
    }
    if (phase < selectorBreaks.midTransitionEnd) {
      return transitionLaw(
        phase,
        selectorBreaks.forwardHoldEnd,
        selectorBreaks.midTransitionEnd,
        -1,
        0,
        'moving-reversing-lever-to-mid-gear',
      );
    }
    if (phase < selectorBreaks.midHoldEnd) {
      return {
        accelerationPerPhaseSquared: 0,
        ratePerPhase: 0,
        stage: 'mid-gear-hold',
        value: 0,
      };
    }
    if (phase < selectorBreaks.backwardTransitionEnd) {
      return transitionLaw(
        phase,
        selectorBreaks.midHoldEnd,
        selectorBreaks.backwardTransitionEnd,
        0,
        1,
        'moving-reversing-lever-to-full-backward',
      );
    }
    if (phase < selectorBreaks.backwardHoldEnd) {
      return {
        accelerationPerPhaseSquared: 0,
        ratePerPhase: 0,
        stage: 'full-backward-hold',
        value: 1,
      };
    }
    if (phase < selectorBreaks.sourceTransitionEnd) {
      return transitionLaw(
        phase,
        selectorBreaks.backwardHoldEnd,
        selectorBreaks.sourceTransitionEnd,
        1,
        sourceSelector,
        'returning-reversing-lever-to-source-setting',
      );
    }
    return {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      stage: 'source-partial-forward-return-hold',
      value: sourceSelector,
    };
  };

  const selectorAtTime = (time) => selectorLawAtCyclePhase(
    time / selectorPeriod,
  ).value;
  // Pass 71: the lever reverses the engine. The shaft turns forward in
  // forward gear and backward in backward gear, and stops in mid gear; its
  // speed follows the gear as tanh(-selector / 0.1), so partial forward gear
  // (Brown's setting) runs at nearly full speed. The speed is scaled so the
  // loop nets exactly one forward turn and closes seamlessly.
  const gearSpeed = (selector) => -Math.tanh(selector / 0.1);
  const angleTableSize = 9600;
  const rawAngle = new Float64Array(angleTableSize + 1);
  for (let i = 1; i <= angleTableSize; i += 1) {
    const p0 = (i - 1) / angleTableSize;
    const p1 = i / angleTableSize;
    rawAngle[i] = rawAngle[i - 1] + (p1 - p0) / 6 * (
      gearSpeed(selectorLawAtCyclePhase(p0).value)
      + 4 * gearSpeed(selectorLawAtCyclePhase((p0 + p1) / 2).value)
      + gearSpeed(selectorLawAtCyclePhase(p1 === 1 ? 0.999999999 : p1).value));
  }
  const netForwardTurns = inputTurnsPerSelectorCycle;
  const angleScale = FULL_TURN * netForwardTurns / rawAngle[angleTableSize];
  const inputAngleAtPhase = (phase) => {
    const x = phase * angleTableSize;
    const i = Math.min(angleTableSize - 1, Math.floor(x));
    const f = x - i;
    return angleScale * (rawAngle[i] * (1 - f) + rawAngle[i + 1] * f);
  };
  const stateAtTime = (time) => {
    const cyclePhase = THREE.MathUtils.euclideanModulo(
      time / selectorPeriod,
      1,
    );
    const selectorLaw = selectorLawAtCyclePhase(cyclePhase);
    const state = stateAtInputAngle(
      inputAngleAtPhase(cyclePhase),
      selectorLaw.value,
    );
    state.inputAngularSpeed = angleScale * gearSpeed(selectorLaw.value) / selectorPeriod;
    state.shaftDirection = state.inputAngularSpeed > 1e-6 ? 'forward'
      : state.inputAngularSpeed < -1e-6 ? 'backward' : 'stopped';
    state.cyclePhase = cyclePhase;
    state.selectorAcceleration = selectorLaw.accelerationPerPhaseSquared
      / selectorPeriod ** 2;
    state.selectorRate = selectorLaw.ratePerPhase / selectorPeriod;
    state.selectorStage = selectorLaw.stage;
    state.time = time;
    return state;
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.18,
    roughness: 0.53,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.22,
    roughness: 0.49,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.41 });

  const forwardLayerZ = 0.24;
  const backwardLayerZ = -0.24;
  const sheaveRadius = 0.68;
  const strapPitchRadius = sheaveRadius + 0.085;
  const sheaveWidth = 0.22;

  const inputRotor = new THREE.Group();
  inputRotor.position.set(shaftCenter.x, shaftCenter.y, 0);
  inputRotor.userData.axis = Z_AXIS.clone();
  inputRotor.userData.role =
    'one-locomotive-shaft-carrying-two-opposed-eccentrics';
  const inputShaft = cylinderAlongZ(0.135, 2.65, darkMaterial, 38);
  inputShaft.userData.role = 'common-shaft-through-both-eccentrics';
  const forwardSheave = makeIndexedEccentricSheave({
    material: driverMaterial,
    radius: sheaveRadius,
    rimMaterial: darkMaterial,
    width: sheaveWidth,
    z: forwardLayerZ,
  });
  forwardSheave.position.y = eccentricity;
  forwardSheave.userData.role = 'forward-eccentric-sheave';
  const backwardSheave = makeIndexedEccentricSheave({
    material: driverMaterial,
    radius: sheaveRadius,
    rimMaterial: darkMaterial,
    width: sheaveWidth,
    z: backwardLayerZ,
  });
  backwardSheave.position.y = -eccentricity;
  backwardSheave.userData.role = 'backward-eccentric-sheave';
  const shaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.54, 0.045),
    whiteMaterial,
  );
  shaftIndex.position.set(0.20, 0, 1.25);
  shaftIndex.userData.role = 'white-index-on-common-input-shaft';
  inputRotor.add(inputShaft, forwardSheave, backwardSheave, shaftIndex);
  root.add(inputRotor);

  const forwardStrap = makeEccentricStrap({
    material: brassMaterial,
    radius: strapPitchRadius,
    z: forwardLayerZ,
  });
  forwardStrap.userData.role = 'forward-eccentric-strap';
  const backwardStrap = makeEccentricStrap({
    material: brassMaterial,
    radius: strapPitchRadius,
    z: backwardLayerZ,
  });
  backwardStrap.userData.role = 'backward-eccentric-strap';
  const makeStrapRod = (length, role) => {
    // Rod starts at the strap rim: it must not sweep through its rotating sheave.
    const outline = clip.union(poly([[strapPitchRadius - 0.02, -0.0625],
      [length, -0.0625], [length, 0.0625], [strapPitchRadius - 0.02, 0.0625]]),
      poly(circle([length, 0], 0.13, 64)));
    const body = new THREE.Mesh(plate(clip.difference(outline,
      poly(circle([length, 0], 0.075, 64))), -0.065, 0.065), drivenMaterial);
    body.userData.role = role;
    body.userData.setEndpoints = (start, end) => {
      body.position.copy(start);
      body.rotation.z = Math.atan2(end.y - start.y, end.x - start.x);
    };
    return body;
  };
  const forwardEccentricRod = makeStrapRod(aheadEccentricRodLength,
    'finite-forward-eccentric-rod-to-upper-link-pin');
  const backwardEccentricRod = makeStrapRod(asternEccentricRodLength,
    'finite-backward-eccentric-rod-to-lower-link-pin');
  forwardStrap.remove(forwardStrap.userData.tailBoss);
  backwardStrap.remove(backwardStrap.userData.tailBoss);
  root.add(
    forwardStrap,
    backwardStrap,
    forwardEccentricRod,
    backwardEccentricRod,
  );

  const expansionLink = new THREE.Group();
  expansionLink.userData.role =
    'single-rigid-curved-slotted-stephenson-expansion-link';
  const innerLinkRail = makeArcRail({
    center: linkSlotCenterLocal,
    halfAngle: visibleLinkHalfAngle,
    material: accentMaterial,
    radius: linkSlotRadius - linkSlotHalfWidth - 0.072,
    tubeRadius: 0.072,
    z: 0,
  });
  innerLinkRail.userData.role = 'inner-rail-of-expansion-link-slot';
  const outerLinkRail = makeArcRail({
    center: linkSlotCenterLocal,
    halfAngle: visibleLinkHalfAngle,
    material: accentMaterial,
    radius: linkSlotRadius + linkSlotHalfWidth + 0.072,
    tubeRadius: 0.072,
    z: 0,
  });
  outerLinkRail.userData.role = 'outer-rail-of-expansion-link-slot';
  // The pin lugs and lifting lug belong to the slotted member, with real
  // holes and finite webs joining them to the corresponding wall.
  const wallPolygon = (low, high) => sector(low, high,
    Math.PI - visibleLinkHalfAngle, Math.PI + visibleLinkHalfAngle, 128)
    .map(polygon => polygon.map(ring => ring.map(([x, y]) =>
      [x + linkSlotCenterLocal.x, y + linkSlotCenterLocal.y])));
  const innerWall = clip.union(wallPolygon(linkSlotRadius - linkSlotHalfWidth - 0.144,
    linkSlotRadius - linkSlotHalfWidth),
    ...[aheadLinkPinLocal, asternLinkPinLocal].map(point => poly(circle(point.toArray(), 0.15, 64))));
  innerLinkRail.geometry.dispose();
  innerLinkRail.geometry = plate(clip.difference(innerWall,
    ...[aheadLinkPinLocal, asternLinkPinLocal].map(point => poly(circle(point.toArray(), 0.075, 64)))), -0.10, 0.10);
  const outerWall = clip.union(wallPolygon(linkSlotRadius + linkSlotHalfWidth,
    linkSlotRadius + linkSlotHalfWidth + 0.144),
    capsule([0, 0], [0.30, 0], 0.075, 32), poly(circle([0, 0], 0.15, 64)));
  outerLinkRail.geometry.dispose();
  outerLinkRail.geometry = plate(clip.difference(outerWall,
    poly(circle([0, 0], 0.08, 64))), -0.10, 0.10);
  expansionLink.add(innerLinkRail, outerLinkRail);
  const linkEndBridges = [-1, 1].map((sign) => {
    const angle = sign * visibleLinkHalfAngle;
    const inner = new THREE.Vector3(
      linkSlotCenterLocal.x
        - (linkSlotRadius - linkSlotHalfWidth - 0.072) * Math.cos(angle),
      (linkSlotRadius - linkSlotHalfWidth - 0.072) * Math.sin(angle),
      0,
    );
    const outer = new THREE.Vector3(
      linkSlotCenterLocal.x
        - (linkSlotRadius + linkSlotHalfWidth + 0.072) * Math.cos(angle),
      (linkSlotRadius + linkSlotHalfWidth + 0.072) * Math.sin(angle),
      0,
    );
    const bridge = makeBeam(inner, outer, {
      color: PALETTE.accent,
      depth: 0.18,
      jointRadius: 0.001,
      thickness: linkEndThickness,
    });
    bridge.userData.role = `${sign < 0 ? 'lower' : 'upper'}-closed-slot-end`;
    expansionLink.add(bridge);
    return bridge;
  });
  const linkPinAssemblies = [
    {
      localPoint: aheadLinkPinLocal,
      role: 'upper-forward-eccentric-rod-pin',
      z: forwardLayerZ,
    },
    {
      localPoint: asternLinkPinLocal,
      role: 'lower-backward-eccentric-rod-pin',
      z: backwardLayerZ,
    },
  ].map(({ localPoint, role, z }) => {
    const group = new THREE.Group();
    group.position.set(localPoint.x, localPoint.y, 0);
    group.userData.role = role;
    const eye = makeEye(0.13, 0.052, drivenMaterial, z);
    const pin = cylinderAlongZ(0.07, 0.72, darkMaterial, 24);
    pin.position.z = z;
    group.add(eye, pin);
    expansionLink.add(group);
    return group;
  });
  const suspensionLug = new THREE.Group();
  suspensionLug.position.set(
    linkSuspensionPinLocal.x,
    linkSuspensionPinLocal.y,
    0.55,
  );
  suspensionLug.userData.role = 'central-link-lifting-lug';
  const suspensionLugEye = makeEye(0.14, 0.054, driverMaterial);
  const suspensionLugPin = cylinderAlongZ(0.075, 1.30, darkMaterial, 24);
  suspensionLug.add(suspensionLugEye, suspensionLugPin);
  expansionLink.add(suspensionLug);
  root.add(expansionLink);

  const reversingHandle = new THREE.Group();
  reversingHandle.position.set(reversingPivot.x, reversingPivot.y, 0.68);
  reversingHandle.userData.axis = Z_AXIS.clone();
  reversingHandle.userData.role =
    'notched-reversing-handle-and-short-lifting-arm';
  const reversingHandleBeam = makeBeam(
    new THREE.Vector3(-reversingLongArmLength, 0, 0),
    new THREE.Vector3(reversingShortArmLength, 0, 0),
    {
      color: PALETTE.driver,
      depth: 0.15,
      jointRadius: 0.001,
      thickness: 0.105,
    },
  );
  // The axis stops just proud of the handle hub instead of standing well
  // out in front; its back end is carried by a lug on the wall.
  const reversingPivotShaft = cylinderAlongZ(0.14, 0.88, darkMaterial, 30);
  reversingPivotShaft.position.z = -0.22;
  reversingPivotShaft.userData.role = 'fixed-reversing-handle-axis';
  const reversingAnchorPin = cylinderAlongZ(0.095, 0.46, darkMaterial, 26);
  reversingAnchorPin.position.x = reversingShortArmLength;
  reversingAnchorPin.userData.role = 'moving-upper-suspension-rod-pin';
  const handleKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 22, 15),
    darkMaterial,
  );
  handleKnob.position.x = -reversingLongArmLength;
  handleKnob.userData.role = 'operator-reversing-handle-knob';
  const handleIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 20, 14),
    whiteMaterial,
  );
  handleIndex.position.set(reversingShortArmLength, 0, 0.25);
  handleIndex.userData.role = 'white-index-on-reversing-arm';
  reversingHandle.add(
    reversingHandleBeam,
    reversingPivotShaft,
    reversingAnchorPin,
    handleKnob,
    handleIndex,
  );
  root.add(reversingHandle);

  const reversingQuadrant = new THREE.Group();
  reversingQuadrant.position.set(
    reversingPivot.x,
    reversingPivot.y,
    -0.34,
  );
  reversingQuadrant.userData.role = 'fixed-notched-reversing-quadrant';
  const quadrantRadius = reversingLongArmLength * 0.88;
  const quadrantHalfAngle = maximumReversingAngle + 0.10;
  const quadrantCurvePoints = Array.from({ length: 49 }, (_, index) => {
    const angle = Math.PI - quadrantHalfAngle
      + 2 * quadrantHalfAngle * index / 48;
    return new THREE.Vector3(
      quadrantRadius * Math.cos(angle),
      quadrantRadius * Math.sin(angle),
      0,
    );
  });
  const quadrantBand = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(quadrantCurvePoints),
      72,
      0.075,
      10,
      false,
    ),
    frameMaterial,
  );
  quadrantBand.userData.role = 'curved-reversing-sector-band';
  reversingQuadrant.add(quadrantBand);
  const quadrantNotches = Array.from({ length: 9 }, (_, index) => {
    const angle = -maximumReversingAngle
      + 2 * maximumReversingAngle * index / 8;
    const start = rotate2(
      angle,
      new THREE.Vector2(-quadrantRadius + 0.12, 0),
    );
    const end = rotate2(
      angle,
      new THREE.Vector2(-quadrantRadius - 0.12, 0),
    );
    const notch = makeBeam(
      new THREE.Vector3(start.x, start.y, 0),
      new THREE.Vector3(end.x, end.y, 0),
      {
        color: PALETTE.frame,
        depth: 0.13,
        jointRadius: 0.001,
        thickness: 0.055,
      },
    );
    notch.userData.role = `reversing-quadrant-notch-${index + 1}`;
    reversingQuadrant.add(notch);
    return notch;
  });
  // Brown draws the quadrant as a broad curved plate with rectangular notches
  // cut into its outer edge, not a rod with ticks: cut the nine notches into
  // one finite sector plate and keep the notch records as cut positions.
  {
    const bandOuter = quadrantRadius + 0.08;
    const bandInner = quadrantRadius - 0.14;
    let bandOutline = sector(
      bandInner,
      bandOuter,
      Math.PI - quadrantHalfAngle,
      Math.PI + quadrantHalfAngle,
      160,
    );
    for (let index = 0; index < 9; index += 1) {
      const angle = Math.PI - maximumReversingAngle
        + 2 * maximumReversingAngle * index / 8;
      const cut = [
        [bandOuter - 0.075, -0.035],
        [bandOuter + 0.05, -0.035],
        [bandOuter + 0.05, 0.035],
        [bandOuter - 0.075, 0.035],
      ].map((point) => [
        point[0] * Math.cos(angle) - point[1] * Math.sin(angle),
        point[0] * Math.sin(angle) + point[1] * Math.cos(angle),
      ]);
      bandOutline = clip.difference(bandOutline, poly(cut));
    }
    quadrantBand.geometry.dispose();
    // The plate is carried by the engine wall: it runs back to seat on the
    // wall's front face (z = -0.5), which it overlaps across the top band.
    quadrantBand.geometry = plate(bandOutline, -0.16, 0.07);
    for (const notch of quadrantNotches) {
      notch.removeFromParent();
      notch.userData.role += '-cut-into-quadrant-plate';
    }
  }
  root.add(reversingQuadrant);

  // Brown sections the engine wall under the reversing handle: a hatched
  // top band and a hatched right-hand band, open inside. The hatching is
  // notation for the cut solid; the wall is modelled as plain solid bands
  // standing behind every moving part.
  const sectionedWall = new THREE.Group();
  sectionedWall.userData.role = 'fixed-sectioned-engine-wall';
  {
    const wallFrontZ = -0.5;
    const wallBackZ = -1.0;
    const wallMaterial = matte(0xcfcabf, { roughness: 0.8 });
    const topLeft = sourcePointFromRaster(new THREE.Vector2(60, 86));
    const bottomRight = sourcePointFromRaster(new THREE.Vector2(187, 220));
    const bandBottom = sourcePointFromRaster(new THREE.Vector2(0, 105)).y;
    const bandLeft = sourcePointFromRaster(new THREE.Vector2(165, 0)).x;
    const bands = [
      [topLeft.x, bandBottom, bottomRight.x, topLeft.y],
      [bandLeft, bottomRight.y, bottomRight.x, bandBottom],
    ];
    bands.forEach(([x0, y0, x1, y1], bandIndex) => {
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(x1 - x0, y1 - y0, wallFrontZ - wallBackZ),
        wallMaterial,
      );
      band.position.set((x0 + x1) / 2, (y0 + y1) / 2, (wallFrontZ + wallBackZ) / 2);
      band.userData.role = bandIndex === 0
        ? 'top-band-of-sectioned-wall'
        : 'right-band-of-sectioned-wall';
      sectionedWall.add(band);
    });
  }
  root.add(sectionedWall);

  const suspensionRod = makeDynamicLink({
    color: PALETTE.driver,
    depth: 0.12,
    jointRadius: 0.085,
    thickness: 0.105,
  });
  suspensionRod.userData.kinematicConstraint =
    'fixed-length-reversing-anchor-to-rigid-link-lifting-lug';
  suspensionRod.userData.role =
    'finite-link-lifting-suspension-rod';
  root.add(suspensionRod);

  const outputRocker = new THREE.Group();
  outputRocker.position.set(
    outputRockerPivot.x,
    outputRockerPivot.y,
    0.96,
  );
  outputRocker.userData.axis = Z_AXIS.clone();
  outputRocker.userData.role =
    'fixed-axis-two-arm-rocker-from-die-to-valve-rod';
  // The fixed rockshaft is a plain stub from z 0.62 (in front of the
  // eccentric-rod pin that swings close by) to just proud of the rocker arms
  // and die pin, not far out in front of them.
  const outputRockerShaft = cylinderAlongZ(0.13, 0.58, darkMaterial, 30);
  outputRockerShaft.position.z = -0.05;
  outputRockerShaft.userData.role = 'fixed-output-rockshaft';
  const lowerRockerArm = makeBeam(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(
      outputRockerLowerArmAtSource.x,
      outputRockerLowerArmAtSource.y,
      0,
    ),
    {
      color: PALETTE.accent,
      depth: 0.16,
      jointRadius: 0.001,
      thickness: 0.12,
    },
  );
  lowerRockerArm.userData.role = 'rocker-lower-arm-to-link-die';
  const upperRockerArm = makeBeam(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(
      outputRockerUpperArmAtSource.x,
      outputRockerUpperArmAtSource.y,
      0,
    ),
    {
      color: PALETTE.accent,
      depth: 0.16,
      jointRadius: 0.001,
      thickness: 0.12,
    },
  );
  upperRockerArm.userData.role = 'rocker-upper-arm-to-valve-link';
  const rockerIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 20, 14),
    whiteMaterial,
  );
  rockerIndex.position.set(
    outputRockerLowerArmAtSource.x,
    outputRockerLowerArmAtSource.y,
    0.18,
  );
  rockerIndex.userData.role = 'white-index-on-die-rocker-pin';
  outputRocker.add(
    outputRockerShaft,
    lowerRockerArm,
    upperRockerArm,
    rockerIndex,
  );
  root.add(outputRocker);

  const dieBlock = new THREE.Group();
  dieBlock.userData.role =
    'rectangular-die-block-captured-inside-curved-link-slot';
  const dieBody = new THREE.Mesh(
    plate(clip.difference(poly([[-0.10, -dieHalfLength], [0.10, -dieHalfLength],
      [0.10, dieHalfLength], [-0.10, dieHalfLength]]), poly(circle([0, 0], 0.09, 64))), -0.10, 0.10),
    darkMaterial,
  );
  dieBody.position.z = -0.44;
  dieBody.userData.role = 'working-link-die-body';
  const diePin = cylinderAlongZ(0.085, 1.50, brassMaterial, 28);
  diePin.userData.role = 'die-pin-through-link-and-output-rocker';
  const dieIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 20, 14),
    whiteMaterial,
  );
  dieIndex.position.z = 0.78;
  dieIndex.userData.role = 'white-index-on-captured-die';
  dieBlock.add(dieBody, diePin, dieIndex);
  root.add(dieBlock);

  const valveLink = makeDynamicLink({
    color: PALETTE.driven,
    depth: 0.12,
    jointRadius: 0.075,
    thickness: 0.10,
  });
  valveLink.userData.role =
    'finite-output-rocker-link-to-horizontal-valve-stem';
  root.add(valveLink);

  const valveSlider = new THREE.Group();
  valveSlider.userData.role = 'horizontally-guided-locomotive-slide-valve';
  const valveStem = cylinderAlongX(0.055, 1.30, brassMaterial, 24);
  valveStem.position.x = -0.55;
  valveStem.userData.role = 'horizontal-valve-stem';
  const valveHead = new THREE.Mesh(
    new THREE.BoxGeometry(0.31, 0.36, 0.34),
    drivenMaterial,
  );
  valveHead.position.x = -1.16;
  valveHead.userData.role = 'moving-slide-valve-head';
  const valveIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.075, 0.04),
    whiteMaterial,
  );
  valveIndex.position.set(-1.16, 0, 0.20);
  valveIndex.userData.role = 'white-index-on-moving-valve';
  valveSlider.add(valveStem, valveHead, valveIndex);
  root.add(valveSlider);

  const valveGuide = new THREE.Group();
  valveGuide.userData.role = 'fixed-horizontal-valve-guide-and-steam-chest';
  const guideBarrel = new THREE.Mesh(boredPlanarLinkGeometry({ length: 0, width: 0,
    eyeRadius: 0.18, boreRadius: 0.063, depth: 0.30 }), frameMaterial);
  guideBarrel.rotation.y = Math.PI / 2;
  guideBarrel.position.set(-1.28, valveGuideY, 0.96);
  guideBarrel.userData.role = 'valve-stem-guide-barrel';
  const steamChest = new THREE.Mesh(
    new THREE.BoxGeometry(1.30, 1.20, 0.78),
    frameMaterial,
  );
  steamChest.position.set(-2.92, valveGuideY, -0.48);
  steamChest.userData.role = 'sectioned-locomotive-steam-chest';
  const chestOpening = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.48, 0.08),
    darkMaterial,
  );
  chestOpening.position.set(-2.52, valveGuideY, -0.04);
  chestOpening.userData.role = 'visible-valve-chest-opening';
  // The hatched wall replaces the invented steam-chest box; only the gland
  // barrel on the wall face is drawn.
  valveGuide.add(guideBarrel);
  root.add(valveGuide);

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'fixed-locomotive-frame-carrying-three-shafts-and-valve-guide';
  const frameBeams = [
    [new THREE.Vector3(-3.70, -1.65, -0.93), new THREE.Vector3(5.35, -1.65, -0.93)],
    [new THREE.Vector3(5.10, -1.65, -0.93), new THREE.Vector3(4.30, -0.20, -0.93)],
    [new THREE.Vector3(-2.48, -1.65, -0.93), new THREE.Vector3(-1.86, 2.20, -0.93)],
    [new THREE.Vector3(-1.86, 2.20, -0.93), new THREE.Vector3(0.14, 0.92, -0.93)],
    [new THREE.Vector3(-3.30, 1.08, -0.93), new THREE.Vector3(0.14, 0.92, -0.93)],
  ].map(([start, end], index) => {
    const beam = makeBeam(start, end, {
      color: PALETTE.frame,
      depth: 0.20,
      jointRadius: 0.001,
      thickness: index === 0 ? 0.20 : 0.16,
    });
    beam.userData.role = `fixed-locomotive-frame-member-${index + 1}`;
    fixedFrame.add(beam);
    return beam;
  });
  const bearings = [
    { center: shaftCenter, radius: 0.23, role: 'common-eccentric-shaft-bearing' },
    { center: outputRockerPivot, radius: 0.20, role: 'output-rockshaft-bearing' },
    { center: reversingPivot, radius: 0.20, role: 'reversing-handle-bearing' },
  ].map(({ center, radius, role }) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.075, 10, 36),
      frameMaterial,
    );
    bearing.position.set(center.x, center.y, -0.80);
    bearing.userData.role = role;
    fixedFrame.add(bearing);
    return bearing;
  });
  root.add(fixedFrame);

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(10.4, 5.6, 2.9),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0.05, 0.30, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.role = 'invisible-full-motion-camera-envelope';
  root.add(cameraEnvelope);

  const blocks = {
    backwardEccentricRod,
    backwardSheave,
    backwardStrap,
    bearings,
    cameraEnvelope,
    chestOpening,
    dieBlock,
    dieBody,
    dieIndex,
    diePin,
    expansionLink,
    fixedFrame,
    forwardEccentricRod,
    forwardSheave,
    forwardStrap,
    frameBeams,
    guideBarrel,
    handleIndex,
    handleKnob,
    innerLinkRail,
    inputRotor,
    inputShaft,
    linkEndBridges,
    linkPinAssemblies,
    lowerRockerArm,
    outerLinkRail,
    outputRocker,
    outputRockerShaft,
    quadrantBand,
    quadrantNotches,
    reversingAnchorPin,
    reversingHandle,
    reversingPivotShaft,
    reversingQuadrant,
    rockerIndex,
    sectionedWall,
    shaftIndex,
    steamChest,
    suspensionLug,
    suspensionLugEye,
    suspensionLugPin,
    suspensionRod,
    upperRockerArm,
    valveGuide,
    valveHead,
    valveIndex,
    valveLink,
    valveSlider,
    valveStem,
  };

  const geometry = {
    aheadEccentricRodLength,
    aheadLinkPinLocal: aheadLinkPinLocal.clone(),
    asternEccentricRodLength,
    asternLinkPinLocal: asternLinkPinLocal.clone(),
    backwardLayerZ,
    eccentricity,
    forwardLayerZ,
    inputTurnsPerSelectorCycle,
    linkPinSpacing,
    linkPositionAtNeutral: linkPositionAtNeutral.clone(),
    linkSlotCenterLocal: linkSlotCenterLocal.clone(),
    linkSlotHalfWidth,
    linkSlotRadius,
    linkSuspensionPinLocal: linkSuspensionPinLocal.clone(),
    maximumReversingAngle,
    outputRockerLowerArmAtSource: outputRockerLowerArmAtSource.clone(),
    outputRockerLowerArmLength,
    outputRockerPivot: outputRockerPivot.clone(),
    outputRockerUpperArmAtSource: outputRockerUpperArmAtSource.clone(),
    reversingLongArmLength,
    reversingPivot: reversingPivot.clone(),
    reversingShortArmLength,
    scale,
    selectorBreaks,
    selectorPeriod,
    shaftCenter: shaftCenter.clone(),
    sheaveRadius,
    sourceImageHeight,
    sourceImageWidth,
    sourceInputAngle,
    sourceRasterAheadLinkPin: sourceRasterAheadLinkPin.clone(),
    sourceRasterAsternLinkPin: sourceRasterAsternLinkPin.clone(),
    sourceRasterLinkCenter: sourceRasterLinkCenter.clone(),
    sourceRasterReversingPivot: sourceRasterReversingPivot.clone(),
    sourceRasterShaftCenter: sourceRasterShaftCenter.clone(),
    sourceRasterValveJoint: sourceRasterValveJoint.clone(),
    sourceSelector,
    sourceUnitsPerPixel,
    strapPitchRadius,
    suspensionRodLength,
    valveGuideY,
    valveRodLength,
    visibleLinkHalfAngle,
    freeDieHalfAngle,
    linkEndThickness,
    dieHalfLength,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.inputAngle;
    forwardStrap.position.set(
      state.aheadEccentricCenter.x,
      state.aheadEccentricCenter.y,
      0,
    );
    backwardStrap.position.set(
      state.asternEccentricCenter.x,
      state.asternEccentricCenter.y,
      0,
    );
    setDynamicLinkEndpoints(
      forwardEccentricRod,
      new THREE.Vector3(
        state.aheadEccentricCenter.x,
        state.aheadEccentricCenter.y,
        forwardLayerZ,
      ),
      new THREE.Vector3(
        state.aheadLinkPin.x,
        state.aheadLinkPin.y,
        forwardLayerZ,
      ),
    );
    setDynamicLinkEndpoints(
      backwardEccentricRod,
      new THREE.Vector3(
        state.asternEccentricCenter.x,
        state.asternEccentricCenter.y,
        backwardLayerZ,
      ),
      new THREE.Vector3(
        state.asternLinkPin.x,
        state.asternLinkPin.y,
        backwardLayerZ,
      ),
    );
    expansionLink.position.set(
      state.linkPosition.x,
      state.linkPosition.y,
      0,
    );
    expansionLink.rotation.z = state.linkAngle;
    reversingHandle.rotation.z = state.reversingAngle;
    setDynamicLinkEndpoints(
      suspensionRod,
      new THREE.Vector3(
        state.reversingAnchor.x,
        state.reversingAnchor.y,
        0.68,
      ),
      new THREE.Vector3(
        state.suspensionPin.x,
        state.suspensionPin.y,
        0.55,
      ),
    );
    dieBlock.position.set(state.diePoint.x, state.diePoint.y, 0.44);
    dieBlock.rotation.z = state.linkAngle - state.dieSlotParameter;
    outputRocker.rotation.z = state.rockerAngle;
    setDynamicLinkEndpoints(
      valveLink,
      new THREE.Vector3(
        state.rockerUpperPoint.x,
        state.rockerUpperPoint.y,
        0.96,
      ),
      new THREE.Vector3(
        state.valveStemPoint.x,
        state.valveStemPoint.y,
        0.96,
      ),
    );
    valveSlider.position.set(
      state.valveStemPoint.x,
      state.valveStemPoint.y,
      0.96,
    );
    root.userData.contacts = {
      dieInExpansionLink: {
        contactError: state.dieSlotContactError,
        point: state.diePoint.clone(),
        slotParameter: state.dieSlotParameter,
      },
    };
    root.userData.kinematics = state;
  };

  const canonicalTimes = {
    backwardFullGear: selectorPeriod * 0.695,
    forwardFullGear: selectorPeriod * 0.235,
    midGear: selectorPeriod * 0.465,
    nextSourcePartialGear: selectorPeriod,
    sourcePartialGear: 0,
  };
  const canonicalStates = {
    backwardAtQuarterTurn: stateAtInputAngle(Math.PI / 2, 1),
    forwardAtQuarterTurn: stateAtInputAngle(Math.PI / 2, -1),
    midGearAtQuarterTurn: stateAtInputAngle(Math.PI / 2, 0),
    sourcePartialGear: stateAtInputAngle(sourceInputAngle, sourceSelector),
  };

  root.userData.archetype =
    'locomotive-opposed-eccentric-suspended-stephenson-expansion-link-die-rocker-valve-gear';
  root.userData.blocks = blocks;
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = geometry;
  root.userData.mechanism =
    'two-opposed-eccentrics-finite-rods-suspended-curved-slotted-link-captured-die-rocker-guided-valve';
  root.userData.reversingAnchorAt = reversingAnchorAt;
  root.userData.selectorAtTime = selectorAtTime;
  root.userData.inputAngleAtPhase = inputAngleAtPhase;
  root.userData.animationTiming = { authoredCyclePeriod: selectorPeriod };
  root.userData.selectorLawAtCyclePhase = selectorLawAtCyclePhase;
  root.userData.solveLinkPose = solveLinkPose;
  root.userData.sourceAnimation = {
    available: true,
    sourceUrl: 'https://507movements.com/mm_185.html',
    inspectedConstruction: 'Two eccentric rods, suspended link, radius-26 slot, radius-7 output rocker, and horizontal valve slider.',
    timingDifference: 'Official selector follows a four-input-cycle interpolated sequence; this demonstration retains eight turns over 24 seconds, with separate smooth transitions and dwells.'
  };
  root.userData.sourcePointFromRaster = sourcePointFromRaster;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.remove(fixedFrame, cameraEnvelope);
  // Minimal supports on Brown's sectioned wall: a bed under the slide valve
  // standing out from the wall face (the valve head slides on it and the
  // gland barrel sits on it) and a lug on the wall carrying the reversing-
  // handle axis. The output rockshaft and the common eccentric shaft end as
  // plain stubs (p62): the undrawn tie bar, bearings and flange are removed.
  // Brown's rocker pedestal on its frame line is not reproduced: behind the
  // rocker the link sweeps the rockshaft axis, and in the free front layer
  // the lifting rod crosses that line, so no pedestal can reach it cleanly.
  const wallSupports = new THREE.Group();
  wallSupports.userData.role = 'minimal-supports-on-sectioned-wall';
  const supportBox = (role, [x0, y0, z0], [x1, y1, z1]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), frameMaterial);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    mesh.userData.role = role;
    wallSupports.add(mesh);
    return mesh;
  };
  supportBox('slide-valve-bed-on-wall', [-2.25, 1.405, -0.5], [-1.13, 1.505, 1.14]);
  supportBox('reversing-axis-lug-on-wall', [-2.08, 1.61, -0.5], [-1.64, 2.44, 0.02]);
  root.add(wallSupports);
  // Brown draws no index marks, and each eccentric shows one strap outline
  // over its sheave, not a second painted rim.
  for (const mark of [
    forwardSheave.userData.index,
    backwardSheave.userData.index,
    forwardSheave.userData.rim,
    backwardSheave.userData.rim,
    shaftIndex,
    handleIndex,
    rockerIndex,
    dieIndex,
    valveIndex,
  ]) mark.removeFromParent();
  root.userData.hideGround = true;
  root.userData.reconstruction = {
    correctedFiniteParts: ['die within free slot', 'die axle bore', 'eccentric rods terminate at straps', 'coaxial bored valve guide'],
    remaining: 'Other shaft/lever joints and reconstructed source proportions still need a finite-solid qualification.'
  };
  root.traverse(object => { for (const material of [].concat(object.material ?? [])) material.fog = false; });
  root.userData.cameraDistanceScale = 1.03;
  root.userData.fidelity = 'authored';

  const sweptBounds = new THREE.Box3();
  for (let i = 0; i <= 96; i += 1) {
    update(selectorPeriod * i / 96);
    root.updateMatrixWorld(true);
    sweptBounds.union(new THREE.Box3().setFromObject(root));
  }
  root.userData.cameraFitBounds = sweptBounds.expandByScalar(0.03);
  update(0);
  markShadows(root);
  for (const object of [
    cameraEnvelope,
    dieIndex,
    handleIndex,
    rockerIndex,
    shaftIndex,
    valveIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(1.2, 0.6, 16.0),
    root,
    update,
  };
}

export function createAuthoredLocomotiveValveGearMovement(movement) {
  if (movement.id !== 185) return null;
  return locomotiveStephensonExpansionLinkValveGear();
}
