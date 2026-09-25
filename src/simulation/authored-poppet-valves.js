import * as THREE from 'three';
import {ring} from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function centeredExtrusion(shape, depth, bevelSize = 0.006) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevelSize > 0,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 12,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function cylinderAlongZ(radius, length, material, segments = 34) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function rotate2(point, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
}

function septicSmoothstep(normalized) {
  const u = THREE.MathUtils.clamp(normalized, 0, 1);
  const u2 = u * u;
  const u3 = u2 * u;
  const oneMinusU = 1 - u;
  return {
    firstDerivative: 140 * u3 * oneMinusU ** 3,
    secondDerivative: 420 * u2 * oneMinusU ** 2 * (1 - 2 * u),
    value: 35 * u ** 4 - 84 * u ** 5 + 70 * u ** 6 - 20 * u ** 7,
  };
}

function circleThroughThreePoints(first, second, third) {
  const denominator = 2 * (
    first.x * (second.y - third.y)
    + second.x * (third.y - first.y)
    + third.x * (first.y - second.y)
  );
  const firstSquared = first.lengthSq();
  const secondSquared = second.lengthSq();
  const thirdSquared = third.lengthSq();
  const center = new THREE.Vector2(
    (
      firstSquared * (second.y - third.y)
      + secondSquared * (third.y - first.y)
      + thirdSquared * (first.y - second.y)
    ) / denominator,
    (
      firstSquared * (third.x - second.x)
      + secondSquared * (first.x - third.x)
      + thirdSquared * (second.x - first.x)
    ) / denominator,
  );
  return {
    center,
    radius: center.distanceTo(first),
  };
}

function rockShaftToeAndPoppetLifter(movement) {
  const root = new THREE.Group();

  // Geometry is independently measured from Brown's public-domain plate.
  // The official canvas is consulted only for the observable low-clearance /
  // lift / high-dwell / return sequence and its 40/10/40/10 timing.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.016;
  const sourceRasterRockShaftCenter = new THREE.Vector2(381, 265);
  const sourceRasterToeNose = new THREE.Vector2(77, 177);
  const sourceRasterToeArcMiddle = new THREE.Vector2(220, 199);
  const sourceRasterToeArcInner = new THREE.Vector2(331, 224);
  const sourceRasterLifterLeft = new THREE.Vector2(56, 177);
  const sourceRasterLifterBlockLeft = new THREE.Vector2(405, 177);
  const sourceRasterLifterBlockRight = new THREE.Vector2(470, 177);
  const sourceRasterLifterTopLeft = new THREE.Vector2(56, 164);
  const sourceRasterLifterBlockTop = new THREE.Vector2(405, 91);
  // Brown's rod runs through the middle of the lifter block (425-455 px).
  const sourceRasterValveRodTop = new THREE.Vector2(440, 36);
  const sourceRasterValveRodBottom = new THREE.Vector2(440, 476);
  const sourceRasterUpperGuideCenter = new THREE.Vector2(424, 86);
  const sourceRasterLowerGuideCenter = new THREE.Vector2(424, 454);
  const observedCanvasLiftPixels = 40;

  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterRockShaftCenter.x) * sourceScale,
    (sourceRasterRockShaftCenter.y - y) * sourceScale,
  );
  const sourceToeNose = sourcePointToModel(sourceRasterToeNose);
  const sourceToeArcMiddle = sourcePointToModel(sourceRasterToeArcMiddle);
  const sourceToeArcInner = sourcePointToModel(sourceRasterToeArcInner);
  const fittedWorkingCircle = circleThroughThreePoints(
    sourceToeNose,
    sourceToeArcMiddle,
    sourceToeArcInner,
  );
  const workingCircleCenter = fittedWorkingCircle.center;
  const workingCircleRadius = fittedWorkingCircle.radius;
  const workingArcOuterAngle = Math.atan2(
    sourceToeNose.y - workingCircleCenter.y,
    sourceToeNose.x - workingCircleCenter.x,
  );
  const workingArcInnerAngle = Math.atan2(
    sourceToeArcInner.y - workingCircleCenter.y,
    sourceToeArcInner.x - workingCircleCenter.x,
  );
  const highToeAngle = 0;
  const lowToeAngle = Math.PI - Math.atan2(
    sourceToeNose.y,
    sourceToeNose.x,
  );
  const observedFollowerLift = observedCanvasLiftPixels * sourceScale;
  const sourceFollowerBottomY = sourcePointToModel(
    sourceRasterLifterLeft,
  ).y;
  const followerRestBottomY = sourceFollowerBottomY
    - observedFollowerLift;

  const supportAtToeAngle = (toeAngle) => {
    const idealLocalAngle = Math.PI / 2 - toeAngle;
    const contactLocalAngle = THREE.MathUtils.clamp(
      idealLocalAngle,
      workingArcInnerAngle,
      workingArcOuterAngle,
    );
    const localPoint = new THREE.Vector2(
      workingCircleCenter.x
        + workingCircleRadius * Math.cos(contactLocalAngle),
      workingCircleCenter.y
        + workingCircleRadius * Math.sin(contactLocalAngle),
    );
    const point = rotate2(localPoint, toeAngle);
    const center = rotate2(workingCircleCenter, toeAngle);
    const tangentOnArc = contactLocalAngle > workingArcInnerAngle + 1e-12
      && contactLocalAngle < workingArcOuterAngle - 1e-12;
    return {
      contactLocalAngle,
      contactPoint: point,
      localPoint,
      supportFirstDerivative: point.x,
      supportSecondDerivative: tangentOnArc ? -center.y : -point.y,
      supportY: point.y,
      workingRegion: tangentOnArc
        ? 'curved-toe-flank-tangent'
        : contactLocalAngle >= workingArcOuterAngle - 1e-12
          ? 'rounded-outer-toe-tip'
          : 'inner-toe-flank-terminal',
    };
  };

  let lowerContactAngle = highToeAngle;
  let upperContactAngle = lowToeAngle;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (lowerContactAngle + upperContactAngle) / 2;
    if (supportAtToeAngle(middle).supportY > followerRestBottomY) {
      lowerContactAngle = middle;
    } else {
      upperContactAngle = middle;
    }
  }
  const contactStartToeAngle = (
    lowerContactAngle + upperContactAngle
  ) / 2;

  const cyclePeriod = 4;
  const liftStrokeFraction = 0.4;
  const highDwellFraction = 0.1;
  const returnStrokeFraction = 0.4;
  const lowDwellFraction = 0.1;
  const liftEndPhase = liftStrokeFraction;
  const highDwellEndPhase = liftEndPhase + highDwellFraction;
  const returnEndPhase = highDwellEndPhase + returnStrokeFraction;

  const inputMotionAtCyclePhase = (unwrappedPhase) => {
    const cycleIndex = Math.floor(unwrappedPhase);
    const cyclePhase = unwrappedPhase - cycleIndex;
    let toeAngle = lowToeAngle;
    let firstDerivativeByPhase = 0;
    let secondDerivativeByPhase = 0;
    let stage = 'low-clearance-dwell';
    if (cyclePhase < liftEndPhase) {
      const normalized = cyclePhase / liftStrokeFraction;
      const law = septicSmoothstep(normalized);
      toeAngle = THREE.MathUtils.lerp(
        lowToeAngle,
        highToeAngle,
        law.value,
      );
      firstDerivativeByPhase = (highToeAngle - lowToeAngle)
        * law.firstDerivative / liftStrokeFraction;
      secondDerivativeByPhase = (highToeAngle - lowToeAngle)
        * law.secondDerivative / liftStrokeFraction ** 2;
      stage = 'toe-rocking-clockwise-to-lift';
    } else if (cyclePhase < highDwellEndPhase) {
      toeAngle = highToeAngle;
      stage = 'raised-valve-dwell';
    } else if (cyclePhase < returnEndPhase) {
      const normalized = (
        cyclePhase - highDwellEndPhase
      ) / returnStrokeFraction;
      const law = septicSmoothstep(normalized);
      toeAngle = THREE.MathUtils.lerp(
        highToeAngle,
        lowToeAngle,
        law.value,
      );
      firstDerivativeByPhase = (lowToeAngle - highToeAngle)
        * law.firstDerivative / returnStrokeFraction;
      secondDerivativeByPhase = (lowToeAngle - highToeAngle)
        * law.secondDerivative / returnStrokeFraction ** 2;
      stage = 'toe-rocking-counterclockwise-to-release';
    }
    return {
      cycleIndex,
      cyclePhase,
      stage,
      toeAngle,
      toeAngularAcceleration: secondDerivativeByPhase / cyclePeriod ** 2,
      toeAngularSpeed: firstDerivativeByPhase / cyclePeriod,
    };
  };

  const stateAtCyclePhase = (cyclePhase) => {
    const input = inputMotionAtCyclePhase(cyclePhase);
    const support = supportAtToeAngle(input.toeAngle);
    const contactActive = support.supportY >= followerRestBottomY - 1e-12;
    const followerLift = contactActive
      ? Math.max(0, support.supportY - followerRestBottomY)
      : 0;
    const followerVelocity = contactActive
      ? support.supportFirstDerivative * input.toeAngularSpeed
      : 0;
    const followerAcceleration = contactActive
      ? support.supportSecondDerivative * input.toeAngularSpeed ** 2
        + support.supportFirstDerivative * input.toeAngularAcceleration
      : 0;
    const toePointVelocity = new THREE.Vector2(
      -support.contactPoint.y * input.toeAngularSpeed,
      support.contactPoint.x * input.toeAngularSpeed,
    );
    const followerSurfaceVelocity = new THREE.Vector2(0, followerVelocity);
    const contactGap = contactActive
      ? followerRestBottomY + followerLift - support.supportY
      : followerRestBottomY - support.supportY;
    return {
      ...input,
      contactActive,
      contactGap,
      contactLocalAngle: support.contactLocalAngle,
      contactPoint: support.contactPoint,
      followerAcceleration,
      followerBottomY: followerRestBottomY + followerLift,
      followerLift,
      followerSurfaceVelocity,
      followerVelocity,
      normalVelocityError: contactActive
        ? followerVelocity - toePointVelocity.y
        : null,
      slidingSpeed: contactActive ? -toePointVelocity.x : 0,
      supportY: support.supportY,
      toePointVelocity,
      valveLift: followerLift,
      valveRodVelocity: new THREE.Vector3(0, followerVelocity, 0),
      workingRegion: support.workingRegion,
    };
  };
  const stateAtTime = (time) => stateAtCyclePhase(time / cyclePeriod);

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.61,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.15,
    roughness: 0.55,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.45 });

  const toe = new THREE.Group();
  toe.userData.axis = Z_AXIS.clone();
  toe.userData.role = 'curved-toe-rigid-on-rock-shaft';
  root.add(toe);
  const toeShape = new THREE.Shape();
  const workingArcSamples = 128;
  for (let index = 0; index <= workingArcSamples; index += 1) {
    const angle = THREE.MathUtils.lerp(
      workingArcOuterAngle,
      workingArcInnerAngle,
      index / workingArcSamples,
    );
    const x = workingCircleCenter.x
      + workingCircleRadius * Math.cos(angle);
    const y = workingCircleCenter.y
      + workingCircleRadius * Math.sin(angle);
    if (index === 0) toeShape.moveTo(x, y);
    else toeShape.lineTo(x, y);
  }
  toeShape.bezierCurveTo(-0.30, 0.62, 0.45, 0.48, 0.55, 0.08);
  toeShape.bezierCurveTo(0.62, -0.44, 0.18, -0.73, -0.42, -0.66);
  toeShape.bezierCurveTo(-1.35, -0.56, -2.58, 0.22,
    sourceToeNose.x, sourceToeNose.y - 0.16);
  toeShape.quadraticCurveTo(sourceToeNose.x - 0.10,
    sourceToeNose.y - 0.02, sourceToeNose.x, sourceToeNose.y);
  toeShape.closePath();
  const toeBody = new THREE.Mesh(
    centeredExtrusion(toeShape, 0.38, 0),
    driverMaterial,
  );
  toeBody.userData.role = 'engraving-proportioned-rocking-toe-body';
  toe.add(toeBody);
  const workingArcCurve = new class extends THREE.Curve {
    getPoint(parameter, target = new THREE.Vector3()) {
      const angle = THREE.MathUtils.lerp(
        workingArcOuterAngle,
        workingArcInnerAngle,
        parameter,
      );
      return target.set(
        workingCircleCenter.x + (workingCircleRadius - 0.055) * Math.cos(angle),
        workingCircleCenter.y + (workingCircleRadius - 0.055) * Math.sin(angle),
        0.22,
      );
    }
  }();
  const workingFlank = new THREE.Mesh(
    new THREE.TubeGeometry(workingArcCurve, 64, 0.045, 9, false),
    accentMaterial,
  );
  workingFlank.userData.role = 'curved-toe-working-flank';
  // The toe's own edge is its working flank; the proud accent tube read as a
  // marker line along it and is not drawn.
  workingFlank.visible = false;
  toe.add(workingFlank);
  const toeNoseIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 18, 12),
    whiteMaterial,
  );
  toeNoseIndex.position.set(sourceToeNose.x + 0.08, sourceToeNose.y - 0.085, 0.27);
  toeNoseIndex.userData.role = 'white-toe-nose-index';
  const rockShaft = cylinderAlongZ(0.31, 1.06, darkMaterial, 38);
  rockShaft.position.z = 0.04;
  rockShaft.userData.role = 'fixed-axis-rock-shaft';
  toe.add(rockShaft);
  const shaftCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.43, 0.075, 11, 46),
    driverMaterial,
  );
  shaftCollar.position.z = 0.27;
  shaftCollar.userData.role = 'toe-rock-shaft-driver-collar';
  toe.add(shaftCollar);

  const lifter = new THREE.Group();
  lifter.userData.role = 'nonrotating-lifter-valve-rod-and-poppet-assembly';
  root.add(lifter);
  const lifterLeft = sourcePointToModel(sourceRasterLifterLeft);
  const lifterBlockLeft = sourcePointToModel(sourceRasterLifterBlockLeft);
  const lifterBlockRight = sourcePointToModel(sourceRasterLifterBlockRight);
  const lifterTopLeft = sourcePointToModel(sourceRasterLifterTopLeft);
  const lifterBlockTop = sourcePointToModel(sourceRasterLifterBlockTop);
  const highPoseOffset = observedFollowerLift;
  const lifterShape = new THREE.Shape();
  lifterShape.moveTo(lifterLeft.x, lifterLeft.y - highPoseOffset);
  lifterShape.lineTo(lifterBlockRight.x,
    lifterBlockRight.y - highPoseOffset);
  lifterShape.lineTo(lifterBlockRight.x,
    lifterBlockTop.y - highPoseOffset);
  lifterShape.lineTo(lifterBlockLeft.x,
    lifterBlockTop.y - highPoseOffset);
  lifterShape.lineTo(lifterTopLeft.x,
    lifterTopLeft.y - highPoseOffset);
  lifterShape.quadraticCurveTo(
    lifterLeft.x - 0.10,
    lifterLeft.y - highPoseOffset + 0.03,
    lifterLeft.x,
    lifterLeft.y - highPoseOffset,
  );
  lifterShape.closePath();
  const lifterBody = new THREE.Mesh(
    centeredExtrusion(lifterShape, 0.34, 0),
    drivenMaterial,
  );
  lifterBody.userData.role = 'flat-bottomed-valve-lifter-attached-to-rod';
  lifter.add(lifterBody);
  const followerShoe = new THREE.Mesh(
    new THREE.BoxGeometry(
      lifterBlockRight.x - lifterLeft.x,
      0.045,
      0.34,
    ),
    // The flat underside of the lifter itself: same material and depth, not
    // a dark outline strip standing out past its faces.
    drivenMaterial,
  );
  followerShoe.position.set(
    (lifterLeft.x + lifterBlockRight.x) / 2,
    followerRestBottomY + 0.045 / 2,
    0.01,
  );
  followerShoe.userData.role = 'flat-horizontal-toe-contact-shoe';
  lifter.add(followerShoe);
  const valveRodX = sourcePointToModel(sourceRasterValveRodTop).x;
  const sourceRodTopY = sourcePointToModel(sourceRasterValveRodTop).y;
  const sourceRodBottomY = sourcePointToModel(sourceRasterValveRodBottom).y;
  const rodTopY = sourceRodTopY - highPoseOffset;
  const rodBottomY = sourceRodBottomY - highPoseOffset;
  const valveRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21,
      rodTopY - rodBottomY, 40),
    drivenMaterial,
  );
  // Set back so the lifter block is drawn over the rod, as on the plate.
  valveRod.position.set(valveRodX, (rodTopY + rodBottomY) / 2, -0.08);
  valveRod.userData.role = 'vertical-poppet-valve-lifting-rod';
  lifter.add(valveRod);
  const poppetHead = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.50, 0.18, 38),
    drivenMaterial,
  );
  poppetHead.position.set(valveRodX, rodBottomY - 0.12, 0);
  poppetHead.userData.role = 'poppet-valve-head-rigid-with-lifting-rod';
  lifter.add(poppetHead);
  const valveIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.28, 0.18),
    whiteMaterial,
  );
  valveIndex.position.set(valveRodX, 2.30 - highPoseOffset, 0.24);
  valveIndex.userData.role = 'white-valve-lift-index';

  const fixedGuides = new THREE.Group();
  fixedGuides.userData.role = 'fixed-collinear-valve-rod-guides-and-seat';
  root.add(fixedGuides);
  for (const [role, sourceCenter] of [
    ['upper-fixed-valve-rod-guide', sourceRasterUpperGuideCenter],
    ['lower-fixed-valve-rod-guide', sourceRasterLowerGuideCenter],
  ]) {
    const center = sourcePointToModel(sourceCenter);
    const guide = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.07, 10, 38),
      frameMaterial,
    );
    guide.rotation.x = Math.PI / 2;
    // Fixed guides must lie on the rod axis and outside the moving lifter.
    const guideY = role.startsWith('upper') ? rodTopY - 0.08 : center.y - highPoseOffset / 2 + 0.08;
    guide.position.set(valveRodX, guideY, 0);
    guide.userData.role = role;
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.75), frameMaterial);
    bracket.position.set(valveRodX + 0.20, guideY, -0.375);
    bracket.userData.role = `${role}-rear-bracket`;
    // Brown draws the lifting rod alone, broken off above and below; its
    // guides and standard are off the plate, so they are not rendered.
  }
  const guidePost = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 8.4, 0.44),
    frameMaterial,
  );
  guidePost.position.set(valveRodX + 0.34, -0.80, -0.75);
  guidePost.userData.role = 'fixed-valve-rod-guide-standard';
  const valveSeat = new THREE.Mesh(
    ring(0.44, 0.62, 0, 0.12, 96),
    frameMaterial,
  );
  valveSeat.rotation.x = Math.PI / 2;
  valveSeat.position.set(valveRodX, rodBottomY - 0.21, 0);
  valveSeat.userData.role = 'fixed-poppet-valve-seat';
  fixedGuides.add(valveSeat);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.20, 1.12),
    frameMaterial,
  );
  base.position.set(valveRodX, rodBottomY - 0.92, -0.16);
  base.userData.role = 'fixed-valve-guide-base';
  fixedGuides.add(base);
  for (const side of [-1, 1]) {
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.49, 0.18), frameMaterial);
    support.position.set(valveRodX + side * 0.56, rodBottomY - 0.575, 0);
    support.userData.role = 'fixed-seat-support-outside-poppet-sweep';
    fixedGuides.add(support);
  }

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 20, 13),
    whiteMaterial,
  );
  contactMarker.position.z = 0.48;
  contactMarker.userData.role = 'active-toe-lifter-contact-marker';

  root.userData.archetype =
    'rockshaft-curved-toe-clearance-lifter-guided-poppet-valve';
  root.userData.blocks = {
    base,
    contactMarker,
    fixedGuides,
    followerShoe,
    guidePost,
    lifter,
    lifterBody,
    poppetHead,
    rockShaft,
    shaftCollar,
    toe,
    toeBody,
    toeNoseIndex,
    valveIndex,
    valveRod,
    valveSeat,
    workingFlank,
  };
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraFov = 8;
  // Crop at Brown's lower break of the lifting rod; the inferred valve, seat
  // and base below it stay out of view as on the plate.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.75, -3.2, -0.9),
    new THREE.Vector3(2.25, 3.95, 0.9),
  );
  root.userData.geometry = {
    contactStartToeAngle,
    cyclePeriod,
    followerRestBottomY,
    highToeAngle,
    lowToeAngle,
    observedFollowerLift,
    sourceFollowerBottomY,
    sourceScale,
    sourceToeNose,
    workingArcInnerAngle,
    workingArcOuterAngle,
    workingCircleCenter,
    workingCircleRadius,
  };
  root.userData.mechanism =
    'one curved toe is rigid on a fixed-axis rock-shaft; its low position has intentional clearance below the flat lifter, its clockwise power swing first takes up that clearance and then raises the nonrotating lifter, lifting rod, and poppet valve together, and its reverse swing releases them to the fixed low stop';
  root.userData.movement = movement;
  root.userData.sourceAnimation = {
    available: true,
    independentlyReconstructed: true,
    observedCycleFractions: [0, 0.4, 0.5, 0.9, 1],
    observedFollowerLiftPixels: observedCanvasLiftPixels,
    observedLowPoseHasClearance: true,
    observedToeStrokeDegrees: THREE.MathUtils.radToDeg(lowToeAngle),
    officialCanvasModelPresent: true,
    referenceScope:
      'the official canvas is used only to confirm the low-pose clearance, clockwise lift and reverse release, approximate forty-pixel follower stroke, and 40/10/40/10 timing; the fitted working arc, contact solver, 3D parts, derivatives, and rendering are independent',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate286: {
      fittedWorkingCircleCenterPixels: {
        x: workingCircleCenter.x / sourceScale
          + sourceRasterRockShaftCenter.x,
        y: sourceRasterRockShaftCenter.y
          - workingCircleCenter.y / sourceScale,
      },
      fittedWorkingCircleRadiusPixels: workingCircleRadius / sourceScale,
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'one toe and circular hub rock about the shaded shaft; a separate flat-bottomed lifter is rigid with the vertical lifting rod, remains keyed against rotation, and raises the poppet valve',
      measurementUncertaintyPixels: 7,
      rasterLifterBlockLeft: {
        x: sourceRasterLifterBlockLeft.x,
        y: sourceRasterLifterBlockLeft.y,
      },
      rasterLifterBlockRight: {
        x: sourceRasterLifterBlockRight.x,
        y: sourceRasterLifterBlockRight.y,
      },
      rasterLifterLeft: {
        x: sourceRasterLifterLeft.x,
        y: sourceRasterLifterLeft.y,
      },
      rasterRockShaftCenter: {
        x: sourceRasterRockShaftCenter.x,
        y: sourceRasterRockShaftCenter.y,
      },
      rasterToeArcInner: {
        x: sourceRasterToeArcInner.x,
        y: sourceRasterToeArcInner.y,
      },
      rasterToeArcMiddle: {
        x: sourceRasterToeArcMiddle.x,
        y: sourceRasterToeArcMiddle.y,
      },
      rasterToeNose: {
        x: sourceRasterToeNose.x,
        y: sourceRasterToeNose.y,
      },
      rasterValveRodBottom: {
        x: sourceRasterValveRodBottom.x,
        y: sourceRasterValveRodBottom.y,
      },
      rasterValveRodTop: {
        x: sourceRasterValveRodTop.x,
        y: sourceRasterValveRodTop.y,
      },
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 75,
      edition: 21,
      illustrationPage: 74,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.supportAtToeAngle = supportAtToeAngle;
  root.userData.timeline = {
    cyclePeriod,
    highDwellEndPhase,
    highDwellFraction,
    liftEndPhase,
    liftStrokeFraction,
    lowDwellFraction,
    returnEndPhase,
    returnStrokeFraction,
    schedule: [
      'clockwise-clearance-takeup-and-valve-lift',
      'raised-valve-dwell',
      'counterclockwise-valve-release-and-clearance-opening',
      'low-clearance-dwell',
    ],
  };
  root.userData.transmission = {
    contactLaw:
      'when active, lifter-bottom-y equals the vertical support of the rotated curved toe profile',
    followerRotation: 0,
    lowPoseClearance: followerRestBottomY
      - supportAtToeAngle(lowToeAngle).supportY,
    maximumValveLift: stateAtCyclePhase(liftEndPhase).valveLift,
    output:
      'one guided vertical lift shared rigidly by lifter, lifting rod, and poppet valve',
    toeAngularStroke: lowToeAngle - highToeAngle,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    toe.rotation.z = state.toeAngle;
    toe.userData.angularAcceleration = state.toeAngularAcceleration;
    toe.userData.angularSpeed = state.toeAngularSpeed;
    lifter.position.set(0, state.followerLift, 0);
    lifter.rotation.set(0, 0, 0);
    lifter.userData.acceleration = new THREE.Vector3(
      0,
      state.followerAcceleration,
      0,
    );
    lifter.userData.velocity = state.valveRodVelocity.clone();
    contactMarker.visible = state.contactActive;
    contactMarker.position.x = state.contactPoint.x;
    contactMarker.position.y = state.followerBottomY;
    root.userData.contacts = {
      toeLifter: state.contactActive ? {
        gap: state.contactGap,
        normalVelocityError: state.normalVelocityError,
        point: new THREE.Vector3(
          state.contactPoint.x,
          state.followerBottomY,
          0,
        ),
        slidingSpeed: state.slidingSpeed,
        workingRegion: state.workingRegion,
      } : null,
      toeLifterClearance: state.contactActive ? 0 : state.contactGap,
      valveRodGuides: {
        axis: new THREE.Vector3(0, 1, 0),
        lineError: Math.hypot(lifter.position.x, lifter.position.z),
        rotationError: lifter.rotation.z,
      },
    };
    root.userData.kinematics = state;
  };

  update(0);
  root.userData.hideGround = true;
  root.traverse(object => {
    for (const material of object.material ? [].concat(object.material) : []) material.fog = false;
  });
  markShadows(root);
  return {
    root,
    update,
    // Brown draws a flat elevation along the rock-shaft axis.
    cameraDirection: new THREE.Vector3(0, 0, 14),
  };
}

export function createAuthoredPoppetValveMovement(movement) {
  if (movement.id !== 286) return null;
  const result = rockShaftToeAndPoppetLifter(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
