import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeDynamicLink,
  makeGear,
  markShadows,
  matte,
} from './primitives.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function finish(root, update, cameraDirection = new THREE.Vector3(7, 4, 9)) {
  root.userData.fidelity = 'authored';
  markShadows(root);
  return { root, update, cameraDirection };
}

function centeredExtrusion(shape, depth, bevel = 0.01) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 48,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function cylinderAlongY(radius, length, material, segments = 32) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function cylinderAlongX(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function planarHexAnnularShape(innerRadius, outerRadius) {
  const shape = new THREE.Shape();
  for (let vertex = 0; vertex < 6; vertex += 1) {
    const angle = Math.PI / 6 + vertex / 6 * Math.PI * 2;
    const x = outerRadius * Math.cos(angle);
    const y = outerRadius * Math.sin(angle);
    if (vertex === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function planarAnnularShape(innerRadius, outerRadius) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function helixCurve({
  maximumY,
  minimumY,
  phase = 0,
  pitch,
  radius,
}) {
  const height = maximumY - minimumY;
  return new class extends THREE.Curve {
    getPoint(parameter, target = new THREE.Vector3()) {
      const y = minimumY + height * parameter;
      const angle = phase + (y - minimumY) / pitch * Math.PI * 2;
      return target.set(
        radius * Math.cos(angle),
        y,
        radius * Math.sin(angle),
      );
    }
  }();
}

function horizontalHelixCurve({
  centerY = 0,
  maximumX,
  minimumX,
  phase = 0,
  pitch,
  radius,
}) {
  const length = maximumX - minimumX;
  return new class extends THREE.Curve {
    getPoint(parameter, target = new THREE.Vector3()) {
      const x = minimumX + length * parameter;
      const angle = phase + (x - minimumX) / pitch * Math.PI * 2;
      return target.set(
        x,
        centerY + radius * Math.cos(angle),
        radius * Math.sin(angle),
      );
    }
  }();
}

function rectangularPlateWithBore({
  boreCenterY,
  boreRadius,
  halfDepth,
  maximumY,
  minimumY,
}) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfDepth, minimumY);
  shape.lineTo(halfDepth, minimumY);
  shape.lineTo(halfDepth, maximumY);
  shape.lineTo(-halfDepth, maximumY);
  shape.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, boreCenterY, boreRadius, 0, Math.PI * 2, true);
  bore.closePath();
  shape.holes.push(bore);
  return shape;
}

function commonScrewBoltAndNutMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const threadStarts = 1;
  const threadPitch = 0.38;
  const threadLead = threadPitch * threadStarts;
  const threadLeadPerRadian = threadLead / fullTurn;
  const threadTurnCount = 12;
  const threadMinimumY = -2.28;
  const threadMaximumY = threadMinimumY
    + threadTurnCount * threadPitch;
  const threadLength = threadMaximumY - threadMinimumY;
  const threadCoreRadius = 0.39;
  const externalThreadRadius = 0.47;
  const externalThreadTubeRadius = 0.09;
  const internalThreadRadius = 0.64;
  const internalThreadTubeRadius = 0.03;
  const threadPitchRadius = 0.585;
  const threadRadialClearance = internalThreadRadius
    - internalThreadTubeRadius
    - externalThreadRadius
    - externalThreadTubeRadius;
  const threadWaveNumber = fullTurn / threadPitch;
  const threadSegmentsPerTurn = 48;
  const threadSegments = threadTurnCount * threadSegmentsPerTurn;

  const sourceThreadDiameter = 1;
  const sourceHeadAcrossCorners = 1.92;
  const sourceNutAcrossCorners = 2;
  const sourceHeadHeight = 0.62;
  const sourceNutHeight = 0.66;
  const sourceThreadedLength = 4.18;
  const sourceVisibleThreadTurns = 11;

  const screwHeadRadius = 1.05;
  const screwHeadHeight = 0.68;
  const screwHeadCenterY = 2.77;
  const screwCollarRadius = 0.68;
  const screwCollarHeight = 0.18;
  const screwCollarCenterY = 2.36;
  const screwCoreMinimumY = -2.68;
  const screwCoreMaximumY = 2.43;
  const screwCoreLength = screwCoreMaximumY - screwCoreMinimumY;
  const screwCoreCenterY = (
    screwCoreMinimumY + screwCoreMaximumY
  ) / 2;
  const nutOuterRadius = 1.08;
  const nutAcrossFlatsRadius = nutOuterRadius * Math.cos(Math.PI / 6);
  const nutHoleRadius = 0.7;
  const nutHeight = 0.72;
  const lowerNutY = -2.05;
  const screwTravelTurns = 5;
  const screwRotationTravel = screwTravelTurns * fullTurn;
  const nutTravel = screwTravelTurns * threadLead;
  const upperNutY = lowerNutY + nutTravel;
  const nutMidpointY = (lowerNutY + upperNutY) / 2;

  const cyclePeriod = 16;
  const upwardPhaseEnd = 0.4;
  const upperDwellPhaseEnd = 0.5;
  const downwardPhaseEnd = 0.9;
  const guideClearance = 0.08;
  const guideRailThickness = 0.12;
  const guideRailCenterX = nutAcrossFlatsRadius
    + guideClearance + guideRailThickness / 2;
  const guideMinimumY = lowerNutY - nutHeight / 2 - 0.38;
  const guideMaximumY = upperNutY + nutHeight / 2 + 0.38;
  const guideRailZ = -0.72;
  const guideRailDepth = 0.2;
  const frameHalfWidth = 1.62;
  const topFrameY = 2.38;
  const bottomFrameY = guideMinimumY - 0.12;
  const frameZ = -0.76;
  const shaftBearingY = 2.35;
  const shaftBearingInnerRadius = threadCoreRadius + 0.055;
  const shaftBearingOuterRadius = 0.72;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.2,
    roughness: 0.52,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.17,
    roughness: 0.56,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.26,
    roughness: 0.48,
  });
  const threadMaterial = matte(0xb64b36, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const internalThreadMaterial = matte(PALETTE.brass, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const smootherStep = (value) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return clamped ** 3 * (
      clamped * (clamped * 6 - 15) + 10
    );
  };
  const smootherStepDerivative = (value) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return 30 * clamped ** 2 * (1 - clamped) ** 2;
  };
  const smootherStepSecondDerivative = (value) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return 60 * clamped * (1 - clamped) * (1 - 2 * clamped);
  };

  const screw = new THREE.Group();
  screw.userData.axis = Y_AXIS.clone();
  screw.userData.role = 'axially-fixed-rotating-right-hand-screw-bolt';
  const screwRotor = new THREE.Group();
  screw.add(screwRotor);
  screw.userData.rotor = screwRotor;

  const screwCore = cylinderAlongY(
    threadCoreRadius,
    screwCoreLength,
    driverMaterial,
    48,
  );
  screwCore.position.y = screwCoreCenterY;
  screwCore.userData.role = 'solid-core-of-common-screw-bolt';
  screwRotor.add(screwCore);

  const externalThreadCurve = helixCurve({
    maximumY: threadMaximumY,
    minimumY: threadMinimumY,
    pitch: threadPitch,
    radius: externalThreadRadius,
  });
  const externalThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      externalThreadCurve,
      threadSegments,
      externalThreadTubeRadius,
      8,
      false,
    ),
    threadMaterial,
  );
  externalThread.userData.role = 'one-continuous-twelve-turn-right-hand-thread';
  screwRotor.add(externalThread);

  const externalThreadStartCap = new THREE.Mesh(
    new THREE.SphereGeometry(externalThreadTubeRadius, 14, 10),
    threadMaterial,
  );
  externalThreadStartCap.position.copy(externalThreadCurve.getPoint(0));
  externalThreadStartCap.userData.role = 'rounded-lower-end-of-single-thread';
  screwRotor.add(externalThreadStartCap);

  const externalThreadEndCap = new THREE.Mesh(
    new THREE.SphereGeometry(externalThreadTubeRadius, 14, 10),
    threadMaterial,
  );
  externalThreadEndCap.position.copy(externalThreadCurve.getPoint(1));
  externalThreadEndCap.userData.role = 'rounded-upper-end-of-single-thread';
  screwRotor.add(externalThreadEndCap);

  const screwHead = cylinderAlongY(
    screwHeadRadius,
    screwHeadHeight,
    driverMaterial,
    6,
  );
  screwHead.position.y = screwHeadCenterY;
  screwHead.rotation.y = Math.PI / 6;
  screwHead.userData.role = 'source-proportioned-hexagonal-bolt-head';
  screwRotor.add(screwHead);

  const screwCollar = cylinderAlongY(
    screwCollarRadius,
    screwCollarHeight,
    darkMaterial,
    48,
  );
  screwCollar.position.y = screwCollarCenterY;
  screwCollar.userData.role = 'bearing-collar-below-bolt-head';
  screwRotor.add(screwCollar);

  const screwTip = new THREE.Mesh(
    new THREE.SphereGeometry(threadCoreRadius, 28, 16),
    driverMaterial,
  );
  screwTip.scale.y = 0.62;
  screwTip.position.y = screwCoreMinimumY;
  screwTip.userData.role = 'rounded-lower-tip-visible-below-nut';
  screwRotor.add(screwTip);

  const headRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(screwHeadRadius * 0.88, 0.04, 0.09),
    indexMaterial,
  );
  headRotationIndex.position.set(
    screwHeadRadius * 0.32,
    screwHeadCenterY + screwHeadHeight / 2 + 0.035,
    0,
  );
  headRotationIndex.userData.role = 'visible-index-on-rotating-bolt-head';
  screwRotor.add(headRotationIndex);

  const nut = new THREE.Group();
  nut.position.y = lowerNutY;
  nut.userData.role = 'nonrotating-nut-with-pure-axial-travel';

  const nutBody = new THREE.Mesh(
    centeredExtrusion(
      planarHexAnnularShape(nutHoleRadius, nutOuterRadius),
      nutHeight,
      0.035,
    ),
    drivenMaterial,
  );
  nutBody.rotation.x = -Math.PI / 2;
  nutBody.userData.role = 'source-proportioned-hexagonal-nut-with-real-bore';
  nut.add(nutBody);

  const nutFaceRings = [-1, 1].map((sideSign) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(nutHoleRadius + 0.035, 0.035, 9, 48),
      darkMaterial,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = sideSign * (nutHeight / 2 + 0.018);
    ring.userData.role = 'dark-rim-around-threaded-nut-bore';
    ring.userData.side = sideSign < 0 ? 'lower' : 'upper';
    nut.add(ring);
    return ring;
  });

  const internalThreadCurve = helixCurve({
    maximumY: nutHeight / 2,
    minimumY: -nutHeight / 2,
    phase: (lowerNutY - nutHeight / 2 - threadMinimumY)
      / threadPitch * fullTurn,
    pitch: threadPitch,
    radius: internalThreadRadius,
  });
  const internalThreadSegments = Math.ceil(
    nutHeight / threadPitch * threadSegmentsPerTurn,
  );
  const internalThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      internalThreadCurve,
      internalThreadSegments,
      internalThreadTubeRadius,
      7,
      false,
    ),
    internalThreadMaterial,
  );
  internalThread.userData.role = 'matching-nonrotating-internal-nut-thread';
  nut.add(internalThread);

  const nutTranslationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(nutOuterRadius * 0.7, 0.038, 0.08),
    indexMaterial,
  );
  nutTranslationIndex.position.set(
    nutOuterRadius * 0.26,
    nutHeight / 2 + 0.055,
    0,
  );
  nutTranslationIndex.userData.role = 'visible-index-showing-nut-does-not-rotate';
  nut.add(nutTranslationIndex);

  const guideRails = [-1, 1].map((sideSign) => {
    const rail = makeBeam(
      new THREE.Vector3(
        sideSign * guideRailCenterX,
        guideMinimumY,
        guideRailZ,
      ),
      new THREE.Vector3(
        sideSign * guideRailCenterX,
        guideMaximumY,
        guideRailZ,
      ),
      {
        thickness: guideRailThickness,
        depth: guideRailDepth,
        color: PALETTE.frame,
      },
    );
    rail.userData.role = 'fixed-vertical-antirotation-way-for-nut';
    rail.userData.side = sideSign < 0 ? 'left' : 'right';
    return rail;
  });

  const topFrameRail = makeBeam(
    new THREE.Vector3(-frameHalfWidth, topFrameY, frameZ),
    new THREE.Vector3(frameHalfWidth, topFrameY, frameZ),
    { thickness: 0.16, depth: 0.25, color: PALETTE.frame },
  );
  topFrameRail.userData.role = 'fixed-top-support-of-screw-bearing';

  const bottomFrameRail = makeBeam(
    new THREE.Vector3(-frameHalfWidth, bottomFrameY, frameZ),
    new THREE.Vector3(frameHalfWidth, bottomFrameY, frameZ),
    { thickness: 0.17, depth: 0.27, color: PALETTE.frame },
  );
  bottomFrameRail.userData.role = 'fixed-base-of-screw-and-nut-demonstrator';

  const bearingBrackets = [-1, 1].map((sideSign) => {
    const bracket = makeBeam(
      new THREE.Vector3(
        sideSign * frameHalfWidth,
        topFrameY,
        frameZ,
      ),
      new THREE.Vector3(
        sideSign * shaftBearingOuterRadius * 0.8,
        shaftBearingY,
        -0.08,
      ),
      { thickness: 0.11, depth: 0.18, color: PALETTE.frame },
    );
    bracket.userData.role = 'fixed-bracket-supporting-axial-screw-bearing';
    return bracket;
  });

  const shaftBearing = new THREE.Mesh(
    new THREE.TorusGeometry(
      (shaftBearingInnerRadius + shaftBearingOuterRadius) / 2,
      (shaftBearingOuterRadius - shaftBearingInnerRadius) / 2,
      10,
      52,
    ),
    frameMaterial,
  );
  shaftBearing.rotation.x = Math.PI / 2;
  shaftBearing.position.y = shaftBearingY;
  shaftBearing.userData.role = 'fixed-thrust-bearing-holding-screw-axially';

  root.add(
    bottomFrameRail,
    ...guideRails,
    topFrameRail,
    ...bearingBrackets,
    shaftBearing,
    screw,
    nut,
  );

  const motionAtTime = (time) => {
    const cycleIndex = Math.floor(time / cyclePeriod);
    const cycleTime = time - cycleIndex * cyclePeriod;
    const phase = cycleTime / cyclePeriod;
    let driverAngle;
    let driverAngularSpeed;
    let driverAngularAcceleration;
    let stage;
    if (phase < upwardPhaseEnd) {
      const duration = cyclePeriod * upwardPhaseEnd;
      const progress = phase / upwardPhaseEnd;
      driverAngle = -screwRotationTravel * smootherStep(progress);
      driverAngularSpeed = -screwRotationTravel
        * smootherStepDerivative(progress) / duration;
      driverAngularAcceleration = -screwRotationTravel
        * smootherStepSecondDerivative(progress) / duration ** 2;
      stage = 'raising-nut';
    } else if (phase < upperDwellPhaseEnd) {
      driverAngle = -screwRotationTravel;
      driverAngularSpeed = 0;
      driverAngularAcceleration = 0;
      stage = 'upper-nut-dwell';
    } else if (phase < downwardPhaseEnd) {
      const duration = cyclePeriod * (downwardPhaseEnd - upperDwellPhaseEnd);
      const progress = (phase - upperDwellPhaseEnd)
        / (downwardPhaseEnd - upperDwellPhaseEnd);
      driverAngle = -screwRotationTravel * (1 - smootherStep(progress));
      driverAngularSpeed = screwRotationTravel
        * smootherStepDerivative(progress) / duration;
      driverAngularAcceleration = screwRotationTravel
        * smootherStepSecondDerivative(progress) / duration ** 2;
      stage = 'lowering-nut';
    } else {
      driverAngle = 0;
      driverAngularSpeed = 0;
      driverAngularAcceleration = 0;
      stage = 'lower-nut-dwell';
    }
    return {
      cycleIndex,
      cycleTime,
      driverAngle,
      driverAngularAcceleration,
      driverAngularSpeed,
      phase,
      stage,
    };
  };

  const stateAtDriverAngle = (
    driverAngle,
    driverAngularSpeed = 0,
    driverAngularAcceleration = 0,
    stage = 'angle-query',
  ) => {
    const nutY = lowerNutY - threadLeadPerRadian * driverAngle;
    const nutVelocity = -threadLeadPerRadian * driverAngularSpeed;
    const nutAcceleration = -threadLeadPerRadian
      * driverAngularAcceleration;
    const contactPhase = threadWaveNumber * (nutY - threadMinimumY)
      + driverAngle;
    const contactCosine = Math.cos(contactPhase);
    const contactSine = Math.sin(contactPhase);
    const threadContactPoint = new THREE.Vector3(
      threadPitchRadius * contactCosine,
      nutY,
      threadPitchRadius * contactSine,
    );
    const screwSurfaceVelocity = new THREE.Vector3(
      driverAngularSpeed * threadContactPoint.z,
      0,
      -driverAngularSpeed * threadContactPoint.x,
    );
    const nutSurfaceVelocity = new THREE.Vector3(0, nutVelocity, 0);
    const relativeThreadVelocity = nutSurfaceVelocity.clone()
      .sub(screwSurfaceVelocity);
    const radialNormal = new THREE.Vector3(
      contactCosine,
      0,
      contactSine,
    );
    const helixTangent = new THREE.Vector3(
      threadWaveNumber * threadContactPoint.z,
      1,
      -threadWaveNumber * threadContactPoint.x,
    ).normalize();
    const flankNormal = new THREE.Vector3().crossVectors(
      radialNormal,
      helixTangent,
    ).normalize();
    const initialContactPhase = threadWaveNumber
      * (lowerNutY - threadMinimumY);
    return {
      axialConstraintError: nutY - lowerNutY
        + threadLeadPerRadian * driverAngle,
      contactPhase,
      driverAngle,
      driverAngularAcceleration,
      driverAngularSpeed,
      flankNormal,
      helixTangent,
      inputRevolutions: driverAngle / fullTurn,
      nutAcceleration,
      nutDisplacement: nutY - lowerNutY,
      nutRotation: 0,
      nutSurfaceVelocity,
      nutVelocity,
      nutY,
      phaseConstraintError: contactPhase - initialContactPhase,
      radialNormal,
      relativeThreadVelocity,
      screwAxialDisplacement: 0,
      screwSurfaceVelocity,
      stage,
      threadContactPoint,
      threadFlankNormalVelocityError: relativeThreadVelocity.dot(flankNormal),
      threadRadialNormalVelocityError: relativeThreadVelocity.dot(radialNormal),
      threadSlidingSpeed: relativeThreadVelocity.dot(helixTangent),
    };
  };

  const stateAtTime = (time) => {
    const motion = motionAtTime(time);
    return {
      ...stateAtDriverAngle(
        motion.driverAngle,
        motion.driverAngularSpeed,
        motion.driverAngularAcceleration,
        motion.stage,
      ),
      cycleIndex: motion.cycleIndex,
      cycleTime: motion.cycleTime,
      phase: motion.phase,
    };
  };

  root.userData.mechanism = 'single-start-right-hand-screw-nonrotating-traveling-nut';
  root.userData.cameraDistanceScale = 1.2;
  root.userData.blocks = {
    bearingBrackets,
    bottomFrameRail,
    externalThread,
    externalThreadEndCap,
    externalThreadStartCap,
    guideRails,
    headRotationIndex,
    internalThread,
    nut,
    nutBody,
    nutFaceRings,
    nutTranslationIndex,
    screw,
    screwCollar,
    screwCore,
    screwHead,
    screwRotor,
    screwTip,
    shaftBearing,
    topFrameRail,
  };
  root.userData.geometry = {
    axis: Y_AXIS.clone(),
    bottomFrameY,
    cyclePeriod,
    downwardPhaseEnd,
    externalThreadRadius,
    externalThreadTubeRadius,
    frameHalfWidth,
    frameZ,
    fullTurn,
    guideClearance,
    guideMaximumY,
    guideMinimumY,
    guideRailCenterX,
    guideRailDepth,
    guideRailThickness,
    guideRailZ,
    internalThreadRadius,
    internalThreadSegments,
    internalThreadTubeRadius,
    lowerNutY,
    nutAcrossFlatsRadius,
    nutHeight,
    nutHoleRadius,
    nutMidpointY,
    nutOuterRadius,
    nutTravel,
    screwCollarCenterY,
    screwCollarHeight,
    screwCollarRadius,
    screwCoreCenterY,
    screwCoreLength,
    screwCoreMaximumY,
    screwCoreMinimumY,
    screwHeadCenterY,
    screwHeadHeight,
    screwHeadRadius,
    screwRotationTravel,
    screwTravelTurns,
    shaftBearingInnerRadius,
    shaftBearingOuterRadius,
    shaftBearingY,
    sourceHeadAcrossCorners,
    sourceHeadHeight,
    sourceNutAcrossCorners,
    sourceNutHeight,
    sourceThreadDiameter,
    sourceThreadedLength,
    sourceVisibleThreadTurns,
    threadCoreRadius,
    threadLead,
    threadLeadPerRadian,
    threadLength,
    threadMaximumY,
    threadMinimumY,
    threadPitch,
    threadPitchRadius,
    threadRadialClearance,
    threadSegments,
    threadSegmentsPerTurn,
    threadStarts,
    threadTurnCount,
    threadWaveNumber,
    topFrameY,
    upperDwellPhaseEnd,
    upperNutY,
    upwardPhaseEnd,
  };
  root.userData.curves = {
    externalThread: externalThreadCurve,
    internalThread: internalThreadCurve,
  };
  root.userData.motionAtTime = motionAtTime;
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    screwRotor.rotation.set(0, state.driverAngle, 0);
    screw.userData.angularSpeed = state.driverAngularSpeed;
    nut.position.set(0, state.nutY, 0);
    nut.rotation.set(0, 0, 0);
    nut.userData.velocity = new THREE.Vector3(0, state.nutVelocity, 0);
    root.userData.contacts = {
      nutGuides: {
        axis: Y_AXIS.clone(),
        lateralClearance: guideClearance,
        lineError: Math.hypot(nut.position.x, nut.position.z),
        rotationError: 0,
      },
      screwBearing: {
        axialDisplacementError: state.screwAxialDisplacement,
        axis: Y_AXIS.clone(),
        radialClearance: shaftBearingInnerRadius - threadCoreRadius,
      },
      screwThread: {
        axialConstraintError: state.axialConstraintError,
        contactPoint: state.threadContactPoint.clone(),
        flankNormal: state.flankNormal.clone(),
        flankNormalVelocityError: state.threadFlankNormalVelocityError,
        lead: threadLead,
        phaseConstraintError: state.phaseConstraintError,
        pitch: threadPitch,
        radialClearance: threadRadialClearance,
        radialNormal: state.radialNormal.clone(),
        radialNormalVelocityError: state.threadRadialNormalVelocityError,
        singleStart: threadStarts === 1,
        slidingSpeed: state.threadSlidingSpeed,
        tangent: state.helixTangent.clone(),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(6.4, 4.2, 10.8));
}

function screwDrivenGuidedSlideMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const threadStarts = 1;
  const threadPitch = 0.68;
  const threadLead = threadPitch * threadStarts;
  const threadLeadPerRadian = threadLead / fullTurn;
  const threadTurnCount = 8;
  const threadMinimumX = -2.56;
  const threadMaximumX = threadMinimumX
    + threadTurnCount * threadPitch;
  const threadLength = threadMaximumX - threadMinimumX;
  const threadCoreRadius = 0.42;
  const externalThreadRadius = 0.49;
  const externalThreadTubeRadius = 0.1;
  const internalThreadRadius = 0.66;
  const internalThreadTubeRadius = 0.03;
  const threadPitchRadius = 0.605;
  const threadRadialClearance = internalThreadRadius
    - internalThreadTubeRadius
    - externalThreadRadius
    - externalThreadTubeRadius;
  const threadWaveNumber = fullTurn / threadPitch;
  const threadSegmentsPerTurn = 64;
  const threadSegments = threadTurnCount * threadSegmentsPerTurn;

  // Measurements are in engraving pixels and are retained so the tests can
  // guard the characteristic proportions of Brown's drawing.
  const sourceThreadOuterDiameter = 58;
  const sourceThreadPitch = 34;
  const sourceThreadedLength = 258;
  const sourceHeadstockThickness = 59;
  const sourceHeadstockHeight = 216;
  const sourceCarriageFootLength = 105;
  const sourceCarriageFootHeight = 30;
  const sourceCarriageNeckThickness = 38;
  const sourceScrewAxisToBedTop = 75;

  const screwAxisY = 1.05;
  const screwCoreMinimumX = -4.36;
  const screwCoreMaximumX = 3.05;
  const screwCoreLength = screwCoreMaximumX - screwCoreMinimumX;
  const screwCoreCenterX = (
    screwCoreMinimumX + screwCoreMaximumX
  ) / 2;
  const inputSquareLength = 0.42;
  const inputSquareCenterX = -4.13;
  const inputSquareSize = 0.56;
  const leftCollarX = -3.92;
  const rightCollarX = -2.57;
  const collarRadius = 0.64;
  const collarLength = 0.16;
  const bearingInnerRadius = threadCoreRadius + 0.035;
  const bearingOuterRadius = 0.7;

  const bedMinimumX = -3.88;
  const bedMaximumX = 3.38;
  const bedLength = bedMaximumX - bedMinimumX;
  const bedCenterX = (bedMinimumX + bedMaximumX) / 2;
  const bedDepth = 2;
  const bedHeight = 0.64;
  const bedTopY = -0.62;
  const bedCenterY = bedTopY - bedHeight / 2;
  const slidewayRailCenterZ = 0.7;
  const slidewayRailDepth = 0.18;
  const slidewayRailHeight = 0.16;
  const slidewayRailLength = bedLength - 0.4;
  const slidewayVerticalClearance = 0.02;
  const slidewayLateralClearance = 0.025;

  const headstockCenterX = -3.25;
  const headstockThickness = 1.2;
  const headstockMinimumY = -1.38;
  const headstockMaximumY = 2.36;
  const headstockHalfDepth = 0.96;
  const headstockBoreRadius = 0.72;
  const leftBearingX = headstockCenterX - headstockThickness / 2 - 0.025;
  const rightBearingX = headstockCenterX + headstockThickness / 2 + 0.025;

  const carriageBaseLength = 2.18;
  const carriageBaseDepth = 1.88;
  const carriageBaseHeight = 0.42;
  const carriageWearPlateHeight = 0.055;
  const carriageBaseBottomY = bedTopY + slidewayRailHeight
    + slidewayVerticalClearance + carriageWearPlateHeight;
  const carriageBaseTopY = carriageBaseBottomY + carriageBaseHeight;
  const carriageNeckThickness = 0.66;
  const carriageNeckHalfDepth = 0.82;
  const carriageNeckMinimumY = carriageBaseTopY - 0.05;
  const carriageNeckMaximumY = 1.83;
  const carriageBoreRadius = 0.72;
  const carriageBossOuterRadius = 0.79;
  const carriageNearX = -0.35;
  const screwTravelTurns = 3;
  const screwRotationTravel = screwTravelTurns * fullTurn;
  const carriageTravel = screwTravelTurns * threadLead;
  const carriageFarX = carriageNearX + carriageTravel;
  const carriageMidpointX = (carriageNearX + carriageFarX) / 2;
  const guideShoeDepth = 0.08;
  const guideShoeCenterZ = slidewayRailCenterZ
    + slidewayRailDepth / 2
    + slidewayLateralClearance
    + guideShoeDepth / 2;
  const guideShoeHeight = 0.15;
  const guideShoeCenterY = carriageBaseBottomY - guideShoeHeight / 2;

  const cyclePeriod = 16;
  const outwardPhaseEnd = 0.4;
  const farDwellPhaseEnd = 0.5;
  const inwardPhaseEnd = 0.9;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.2,
    roughness: 0.5,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.17,
    roughness: 0.55,
  });
  const threadMaterial = matte(0xb64b36, {
    metalness: 0.22,
    roughness: 0.47,
  });
  const internalThreadMaterial = matte(PALETTE.brass, {
    metalness: 0.28,
    roughness: 0.43,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.69,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.48,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const smootherStep = (value) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return clamped ** 3 * (
      clamped * (clamped * 6 - 15) + 10
    );
  };
  const smootherStepDerivative = (value) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return 30 * clamped ** 2 * (1 - clamped) ** 2;
  };
  const smootherStepSecondDerivative = (value) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return 60 * clamped * (1 - clamped) * (1 - 2 * clamped);
  };

  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(bedLength, bedHeight, bedDepth),
    frameMaterial,
  );
  bed.position.set(bedCenterX, bedCenterY, 0);
  bed.userData.role = 'source-horizontal-bed-supporting-the-slide';

  const slidewayRails = [-1, 1].map((sideSign) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(
        slidewayRailLength,
        slidewayRailHeight,
        slidewayRailDepth,
      ),
      darkMaterial,
    );
    rail.position.set(
      bedCenterX + 0.2,
      bedTopY + slidewayRailHeight / 2,
      sideSign * slidewayRailCenterZ,
    );
    rail.userData.role = 'fixed-straight-slideway-rail';
    rail.userData.side = sideSign < 0 ? 'rear' : 'front';
    return rail;
  });

  const headstock = new THREE.Mesh(
    centeredExtrusion(
      rectangularPlateWithBore({
        boreCenterY: screwAxisY,
        boreRadius: headstockBoreRadius,
        halfDepth: headstockHalfDepth,
        maximumY: headstockMaximumY,
        minimumY: headstockMinimumY,
      }),
      headstockThickness,
      0.025,
    ),
    frameMaterial,
  );
  headstock.rotation.y = Math.PI / 2;
  headstock.position.x = headstockCenterX;
  headstock.userData.role = 'source-left-headstock-with-real-through-bore';
  headstock.userData.hasBore = true;

  const screwBearings = [leftBearingX, rightBearingX].map((x, index) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(
        (bearingInnerRadius + bearingOuterRadius) / 2,
        (bearingOuterRadius - bearingInnerRadius) / 2,
        10,
        52,
      ),
      darkMaterial,
    );
    bearing.rotation.y = Math.PI / 2;
    bearing.position.set(x, screwAxisY, 0);
    bearing.userData.role = 'headstock-bearing-holding-screw-axially';
    bearing.userData.side = index === 0 ? 'left' : 'right';
    return bearing;
  });

  const screw = new THREE.Group();
  screw.position.y = screwAxisY;
  screw.userData.axis = X_AXIS.clone();
  screw.userData.role = 'axially-fixed-rotating-horizontal-right-hand-screw';
  const screwRotor = new THREE.Group();
  screw.add(screwRotor);
  screw.userData.rotor = screwRotor;

  const screwCore = cylinderAlongX(
    threadCoreRadius,
    screwCoreLength,
    driverMaterial,
    48,
  );
  screwCore.position.x = screwCoreCenterX;
  screwCore.userData.role = 'solid-core-of-horizontal-leadscrew';
  screwRotor.add(screwCore);

  const externalThreadCurve = horizontalHelixCurve({
    maximumX: threadMaximumX,
    minimumX: threadMinimumX,
    pitch: threadPitch,
    radius: externalThreadRadius,
  });
  const externalThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      externalThreadCurve,
      threadSegments,
      externalThreadTubeRadius,
      8,
      false,
    ),
    threadMaterial,
  );
  externalThread.userData.role = 'one-continuous-eight-turn-right-hand-leadscrew-thread';
  screwRotor.add(externalThread);

  const axialCollars = [leftCollarX, rightCollarX].map((x, index) => {
    const collar = cylinderAlongX(
      collarRadius,
      collarLength,
      darkMaterial,
      48,
    );
    collar.position.x = x;
    collar.userData.role = 'rotating-thrust-collar-against-headstock-bearing';
    collar.userData.side = index === 0 ? 'left' : 'right';
    screwRotor.add(collar);
    return collar;
  });

  const inputSquare = new THREE.Mesh(
    new THREE.BoxGeometry(
      inputSquareLength,
      inputSquareSize,
      inputSquareSize,
    ),
    driverMaterial,
  );
  inputSquare.position.x = inputSquareCenterX;
  inputSquare.userData.role = 'source-square-input-end-of-the-screw';
  screwRotor.add(inputSquare);

  const inputRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.16, 0.24),
    indexMaterial,
  );
  inputRotationIndex.position.set(
    inputSquareCenterX - inputSquareLength / 2 - 0.025,
    inputSquareSize * 0.22,
    0,
  );
  inputRotationIndex.userData.role = 'visible-index-on-rotating-square-input';
  screwRotor.add(inputRotationIndex);

  const screwTip = new THREE.Mesh(
    new THREE.SphereGeometry(threadCoreRadius, 28, 16),
    driverMaterial,
  );
  screwTip.scale.x = 0.58;
  screwTip.position.x = screwCoreMaximumX;
  screwTip.userData.role = 'rounded-unsupported-right-end-of-source-screw';
  screwRotor.add(screwTip);

  const carriage = new THREE.Group();
  carriage.position.x = carriageNearX;
  carriage.userData.role = 'nonrotating-threaded-carriage-on-straight-bed';

  const carriageBase = new THREE.Mesh(
    new THREE.BoxGeometry(
      carriageBaseLength,
      carriageBaseHeight,
      carriageBaseDepth,
    ),
    drivenMaterial,
  );
  carriageBase.position.y = (
    carriageBaseBottomY + carriageBaseTopY
  ) / 2;
  carriageBase.userData.role = 'source-wide-T-foot-of-guided-slide';
  carriage.add(carriageBase);

  const carriageWearPlate = new THREE.Mesh(
    new THREE.BoxGeometry(
      carriageBaseLength * 0.92,
      carriageWearPlateHeight,
      carriageBaseDepth * 0.9,
    ),
    darkMaterial,
  );
  carriageWearPlate.position.y = carriageBaseBottomY
    - carriageWearPlateHeight / 2;
  carriageWearPlate.userData.role = 'flat-bearing-surface-on-the-slideway';
  carriage.add(carriageWearPlate);

  const carriageNeck = new THREE.Mesh(
    centeredExtrusion(
      rectangularPlateWithBore({
        boreCenterY: screwAxisY,
        boreRadius: carriageBoreRadius,
        halfDepth: carriageNeckHalfDepth,
        maximumY: carriageNeckMaximumY,
        minimumY: carriageNeckMinimumY,
      }),
      carriageNeckThickness,
      0.025,
    ),
    drivenMaterial,
  );
  carriageNeck.rotation.y = Math.PI / 2;
  carriageNeck.userData.role = 'upright-integral-nut-body-with-real-screw-bore';
  carriageNeck.userData.hasBore = true;
  carriage.add(carriageNeck);

  const carriageBossRings = [-1, 1].map((sideSign) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        (carriageBoreRadius + carriageBossOuterRadius) / 2,
        (carriageBossOuterRadius - carriageBoreRadius) / 2,
        9,
        48,
      ),
      darkMaterial,
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.set(
      sideSign * (carriageNeckThickness / 2 + 0.02),
      screwAxisY,
      0,
    );
    ring.userData.role = 'dark-rim-around-threaded-carriage-bore';
    ring.userData.side = sideSign < 0 ? 'left' : 'right';
    carriage.add(ring);
    return ring;
  });

  const internalThreadMinimumX = -carriageNeckThickness / 2;
  const internalThreadMaximumX = carriageNeckThickness / 2;
  const internalThreadPhase = threadWaveNumber * (
    carriageNearX + internalThreadMinimumX - threadMinimumX
  );
  const internalThreadCurve = horizontalHelixCurve({
    centerY: screwAxisY,
    maximumX: internalThreadMaximumX,
    minimumX: internalThreadMinimumX,
    phase: internalThreadPhase,
    pitch: threadPitch,
    radius: internalThreadRadius,
  });
  const internalThreadSegments = Math.ceil(
    carriageNeckThickness / threadPitch * threadSegmentsPerTurn,
  );
  const internalThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      internalThreadCurve,
      internalThreadSegments,
      internalThreadTubeRadius,
      7,
      false,
    ),
    internalThreadMaterial,
  );
  internalThread.userData.role = 'matching-internal-thread-fixed-in-the-slide';
  carriage.add(internalThread);

  const carriageGussets = [-1, 1].map((sideSign) => {
    const gusset = makeBeam(
      new THREE.Vector3(
        sideSign * carriageBaseLength * 0.38,
        carriageBaseTopY - 0.01,
        0,
      ),
      new THREE.Vector3(
        sideSign * carriageNeckThickness * 0.43,
        carriageNeckMinimumY + 0.4,
        0,
      ),
      {
        thickness: 0.17,
        depth: carriageBaseDepth * 0.62,
        color: PALETTE.driven,
      },
    );
    gusset.userData.role = 'flared-support-between-slide-foot-and-nut-body';
    gusset.userData.side = sideSign < 0 ? 'left' : 'right';
    carriage.add(gusset);
    return gusset;
  });

  const guideShoes = [-1, 1].map((sideSign) => {
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(
        carriageBaseLength * 0.76,
        guideShoeHeight,
        guideShoeDepth,
      ),
      darkMaterial,
    );
    shoe.position.set(
      0,
      guideShoeCenterY,
      sideSign * guideShoeCenterZ,
    );
    shoe.userData.role = 'moving-guide-shoe-capturing-straight-rail';
    shoe.userData.side = sideSign < 0 ? 'rear' : 'front';
    carriage.add(shoe);
    return shoe;
  });

  const carriageTranslationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.045, 0.13),
    indexMaterial,
  );
  carriageTranslationIndex.position.set(
    0.5,
    carriageBaseTopY + 0.035,
    carriageBaseDepth / 2 + 0.015,
  );
  carriageTranslationIndex.userData.role = 'fixed-orientation-index-on-translating-slide';
  carriage.add(carriageTranslationIndex);

  root.add(
    bed,
    ...slidewayRails,
    headstock,
    ...screwBearings,
    screw,
    carriage,
  );

  const motionAtTime = (time) => {
    const cycleIndex = Math.floor(time / cyclePeriod);
    const cycleTime = time - cycleIndex * cyclePeriod;
    const phase = cycleTime / cyclePeriod;
    let driverAngle;
    let driverAngularSpeed;
    let driverAngularAcceleration;
    let stage;
    if (phase < outwardPhaseEnd) {
      const duration = cyclePeriod * outwardPhaseEnd;
      const progress = phase / outwardPhaseEnd;
      driverAngle = -screwRotationTravel * smootherStep(progress);
      driverAngularSpeed = -screwRotationTravel
        * smootherStepDerivative(progress) / duration;
      driverAngularAcceleration = -screwRotationTravel
        * smootherStepSecondDerivative(progress) / duration ** 2;
      stage = 'advancing-carriage';
    } else if (phase < farDwellPhaseEnd) {
      driverAngle = -screwRotationTravel;
      driverAngularSpeed = 0;
      driverAngularAcceleration = 0;
      stage = 'far-carriage-dwell';
    } else if (phase < inwardPhaseEnd) {
      const duration = cyclePeriod * (inwardPhaseEnd - farDwellPhaseEnd);
      const progress = (phase - farDwellPhaseEnd)
        / (inwardPhaseEnd - farDwellPhaseEnd);
      driverAngle = -screwRotationTravel * (1 - smootherStep(progress));
      driverAngularSpeed = screwRotationTravel
        * smootherStepDerivative(progress) / duration;
      driverAngularAcceleration = screwRotationTravel
        * smootherStepSecondDerivative(progress) / duration ** 2;
      stage = 'returning-carriage';
    } else {
      driverAngle = 0;
      driverAngularSpeed = 0;
      driverAngularAcceleration = 0;
      stage = 'near-carriage-dwell';
    }
    return {
      cycleIndex,
      cycleTime,
      driverAngle,
      driverAngularAcceleration,
      driverAngularSpeed,
      phase,
      stage,
    };
  };

  const stateAtDriverAngle = (
    driverAngle,
    driverAngularSpeed = 0,
    driverAngularAcceleration = 0,
    stage = 'angle-query',
  ) => {
    const carriageX = carriageNearX
      - threadLeadPerRadian * driverAngle;
    const carriageVelocity = -threadLeadPerRadian
      * driverAngularSpeed;
    const carriageAcceleration = -threadLeadPerRadian
      * driverAngularAcceleration;
    const contactPhase = threadWaveNumber
      * (carriageX - threadMinimumX) + driverAngle;
    const contactCosine = Math.cos(contactPhase);
    const contactSine = Math.sin(contactPhase);
    const radialY = threadPitchRadius * contactCosine;
    const radialZ = threadPitchRadius * contactSine;
    const threadContactPoint = new THREE.Vector3(
      carriageX,
      screwAxisY + radialY,
      radialZ,
    );
    const screwSurfaceVelocity = new THREE.Vector3(
      0,
      -driverAngularSpeed * radialZ,
      driverAngularSpeed * radialY,
    );
    const carriageSurfaceVelocity = new THREE.Vector3(
      carriageVelocity,
      0,
      0,
    );
    const relativeThreadVelocity = carriageSurfaceVelocity.clone()
      .sub(screwSurfaceVelocity);
    const radialNormal = new THREE.Vector3(
      0,
      contactCosine,
      contactSine,
    );
    const helixTangent = new THREE.Vector3(
      1,
      -threadWaveNumber * radialZ,
      threadWaveNumber * radialY,
    ).normalize();
    const flankNormal = new THREE.Vector3().crossVectors(
      radialNormal,
      helixTangent,
    ).normalize();
    const initialContactPhase = threadWaveNumber
      * (carriageNearX - threadMinimumX);
    return {
      axialConstraintError: carriageX - carriageNearX
        + threadLeadPerRadian * driverAngle,
      carriageAcceleration,
      carriageDisplacement: carriageX - carriageNearX,
      carriageRotation: 0,
      carriageSurfaceVelocity,
      carriageVelocity,
      carriageX,
      contactPhase,
      driverAngle,
      driverAngularAcceleration,
      driverAngularSpeed,
      flankNormal,
      helixTangent,
      inputRevolutions: driverAngle / fullTurn,
      phaseConstraintError: contactPhase - initialContactPhase,
      radialNormal,
      relativeThreadVelocity,
      screwAxialDisplacement: 0,
      screwSurfaceVelocity,
      stage,
      threadContactPoint,
      threadFlankNormalVelocityError: relativeThreadVelocity.dot(flankNormal),
      threadRadialNormalVelocityError: relativeThreadVelocity.dot(radialNormal),
      threadSlidingSpeed: relativeThreadVelocity.dot(helixTangent),
    };
  };

  const stateAtTime = (time) => {
    const motion = motionAtTime(time);
    return {
      ...stateAtDriverAngle(
        motion.driverAngle,
        motion.driverAngularSpeed,
        motion.driverAngularAcceleration,
        motion.stage,
      ),
      cycleIndex: motion.cycleIndex,
      cycleTime: motion.cycleTime,
      phase: motion.phase,
    };
  };

  root.userData.mechanism = 'horizontal-leadscrew-integral-nut-guided-slide';
  root.userData.cameraDistanceScale = 1.08;
  root.userData.blocks = {
    axialCollars,
    bed,
    carriage,
    carriageBase,
    carriageBossRings,
    carriageGussets,
    carriageNeck,
    carriageTranslationIndex,
    carriageWearPlate,
    externalThread,
    guideShoes,
    headstock,
    inputRotationIndex,
    inputSquare,
    internalThread,
    screw,
    screwBearings,
    screwCore,
    screwRotor,
    screwTip,
    slidewayRails,
  };
  root.userData.geometry = {
    axis: X_AXIS.clone(),
    bearingInnerRadius,
    bearingOuterRadius,
    bedCenterX,
    bedCenterY,
    bedDepth,
    bedHeight,
    bedLength,
    bedMaximumX,
    bedMinimumX,
    bedTopY,
    carriageBaseBottomY,
    carriageBaseDepth,
    carriageBaseHeight,
    carriageBaseLength,
    carriageBaseTopY,
    carriageBoreRadius,
    carriageBossOuterRadius,
    carriageFarX,
    carriageMidpointX,
    carriageNearX,
    carriageNeckHalfDepth,
    carriageNeckMaximumY,
    carriageNeckMinimumY,
    carriageNeckThickness,
    carriageTravel,
    carriageWearPlateHeight,
    collarLength,
    collarRadius,
    cyclePeriod,
    externalThreadRadius,
    externalThreadTubeRadius,
    farDwellPhaseEnd,
    fullTurn,
    guideShoeCenterY,
    guideShoeCenterZ,
    guideShoeDepth,
    guideShoeHeight,
    headstockBoreRadius,
    headstockCenterX,
    headstockHalfDepth,
    headstockMaximumY,
    headstockMinimumY,
    headstockThickness,
    inputSquareCenterX,
    inputSquareLength,
    inputSquareSize,
    internalThreadMaximumX,
    internalThreadMinimumX,
    internalThreadPhase,
    internalThreadRadius,
    internalThreadSegments,
    internalThreadTubeRadius,
    inwardPhaseEnd,
    leftBearingX,
    leftCollarX,
    outwardPhaseEnd,
    rightBearingX,
    rightCollarX,
    screwAxisY,
    screwCoreCenterX,
    screwCoreLength,
    screwCoreMaximumX,
    screwCoreMinimumX,
    screwRotationTravel,
    screwTravelTurns,
    slidewayLateralClearance,
    slidewayRailCenterZ,
    slidewayRailDepth,
    slidewayRailHeight,
    slidewayRailLength,
    slidewayVerticalClearance,
    sourceCarriageFootHeight,
    sourceCarriageFootLength,
    sourceCarriageNeckThickness,
    sourceHeadstockHeight,
    sourceHeadstockThickness,
    sourceScrewAxisToBedTop,
    sourceThreadOuterDiameter,
    sourceThreadPitch,
    sourceThreadedLength,
    threadCoreRadius,
    threadLead,
    threadLeadPerRadian,
    threadLength,
    threadMaximumX,
    threadMinimumX,
    threadPitch,
    threadPitchRadius,
    threadRadialClearance,
    threadSegments,
    threadSegmentsPerTurn,
    threadStarts,
    threadTurnCount,
    threadWaveNumber,
  };
  root.userData.curves = {
    externalThread: externalThreadCurve,
    internalThread: internalThreadCurve,
  };
  root.userData.motionAtTime = motionAtTime;
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    screwRotor.rotation.set(state.driverAngle, 0, 0);
    screw.userData.angularSpeed = state.driverAngularSpeed;
    carriage.position.set(state.carriageX, 0, 0);
    carriage.rotation.set(0, 0, 0);
    carriage.userData.velocity = new THREE.Vector3(
      state.carriageVelocity,
      0,
      0,
    );
    root.userData.contacts = {
      screwBearing: {
        axialDisplacementError: state.screwAxialDisplacement,
        axis: X_AXIS.clone(),
        radialClearance: bearingInnerRadius - threadCoreRadius,
      },
      screwThread: {
        axialConstraintError: state.axialConstraintError,
        contactPoint: state.threadContactPoint.clone(),
        flankNormal: state.flankNormal.clone(),
        flankNormalVelocityError: state.threadFlankNormalVelocityError,
        lead: threadLead,
        phaseConstraintError: state.phaseConstraintError,
        pitch: threadPitch,
        radialClearance: threadRadialClearance,
        radialNormal: state.radialNormal.clone(),
        radialNormalVelocityError: state.threadRadialNormalVelocityError,
        singleStart: threadStarts === 1,
        slidingSpeed: state.threadSlidingSpeed,
        tangent: state.helixTangent.clone(),
      },
      slideWays: {
        axis: X_AXIS.clone(),
        lateralClearance: slidewayLateralClearance,
        lineError: Math.hypot(carriage.position.y, carriage.position.z),
        rotationError: 0,
        verticalClearance: slidewayVerticalClearance,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(-6.8, 4.4, 11.5));
}

function wormWheelSlidingCarriageMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const wormStarts = 1;
  const wormPitch = 0.6;
  const wormLead = wormPitch * wormStarts;
  const wormLeadPerRadian = wormLead / fullTurn;
  const wormWaveNumber = fullTurn / wormLead;
  const wormTurnCount = 12;
  const wormThreadMinimumX = -3.6;
  const wormThreadMaximumX = wormThreadMinimumX
    + wormTurnCount * wormPitch;
  const wormThreadLength = wormThreadMaximumX - wormThreadMinimumX;
  const wormCoreRadius = 0.4;
  const wormThreadRadius = 0.48;
  const wormThreadTubeRadius = 0.09;
  const wormPitchRadius = 0.54;
  const wormSegmentsPerTurn = 56;
  const wormThreadSegments = wormTurnCount * wormSegmentsPerTurn;

  const wheelTeeth = 20;
  const wheelPitchRadius = 1.55;
  const wheelToothHeight = 0.21;
  const wheelOuterRadius = wheelPitchRadius + wheelToothHeight / 2;
  const wheelRootRadius = wheelPitchRadius - wheelToothHeight / 2;
  const wheelDepth = 0.42;
  const wheelReferenceAngle = -0.75 * Math.PI / wheelTeeth;
  const wheelToothPitchAngle = fullTurn / wheelTeeth;

  const sourceWormOuterDiameter = 58;
  const sourceWormPitch = 30;
  const sourceThreadedLength = 360;
  const sourceWheelOuterDiameter = 180;
  const sourceWheelTeeth = 20;
  const sourceWormToWheelCenterDistance = 118;
  const sourceCarriageFootLength = 130;
  const sourceWheelCenterToFootTop = 86;

  const screwAxisY = 1.55;
  const wheelCenterY = screwAxisY
    - wormPitchRadius - wheelPitchRadius;
  const pitchContactY = screwAxisY - wormPitchRadius;
  const wormCoreMinimumX = -4.62;
  const wormCoreMaximumX = 4.22;
  const wormCoreLength = wormCoreMaximumX - wormCoreMinimumX;
  const wormCoreCenterX = (wormCoreMinimumX + wormCoreMaximumX) / 2;
  const wormThreadPhase = Math.PI - wormWaveNumber * (
    -0.8 - wormThreadMinimumX
  );

  const bedMinimumX = -4.55;
  const bedMaximumX = 4.55;
  const bedLength = bedMaximumX - bedMinimumX;
  const bedDepth = 1.7;
  const bedHeight = 0.58;
  const bedTopY = -2.84;
  const bedCenterY = bedTopY - bedHeight / 2;
  const slidewayRailCenterZ = 0.55;
  const slidewayRailDepth = 0.16;
  const slidewayRailHeight = 0.16;
  const slidewayVerticalClearance = 0.02;
  const slidewayLateralClearance = 0.025;

  const carriageOriginX = -0.8;
  const carriageTravelLeads = 2;
  const carriageTravel = carriageTravelLeads * wormLead;
  const carriageFarX = carriageOriginX + carriageTravel;
  const carriageMidpointX = (carriageOriginX + carriageFarX) / 2;
  const carriageBaseLength = 2.45;
  const carriageBaseDepth = 1.5;
  const carriageBaseHeight = 0.38;
  const carriageWearPlateHeight = 0.05;
  const carriageBaseBottomY = bedTopY + slidewayRailHeight
    + slidewayVerticalClearance + carriageWearPlateHeight;
  const carriageBaseTopY = carriageBaseBottomY + carriageBaseHeight;
  const guideShoeDepth = 0.075;
  const guideShoeCenterZ = slidewayRailCenterZ
    + slidewayRailDepth / 2
    + slidewayLateralClearance
    + guideShoeDepth / 2;
  const guideShoeHeight = 0.15;
  const guideShoeCenterY = carriageBaseBottomY - guideShoeHeight / 2;
  const pedestalBaseHalfWidth = 0.58;
  const pedestalTopHalfWidth = 0.13;
  const pedestalDepth = 0.28;
  const pedestalZ = -0.36;

  const bearingX = 4.02;
  const bearingInnerRadius = wormCoreRadius + 0.035;
  const bearingOuterRadius = 0.67;
  const supportPostZ = -0.75;
  const supportPostBottomY = bedTopY - 0.05;
  const inputSquareLength = 0.42;
  const inputSquareSize = 0.54;
  const inputSquareCenterX = -4.43;

  const wormDriveTurns = 4;
  const wormRotationTravel = wormDriveTurns * fullTurn;
  const cyclePeriod = 20;
  const wormDrivePhaseEnd = 0.25;
  const wormDriveDwellPhaseEnd = 0.3;
  const slideOutPhaseEnd = 0.5;
  const farDwellPhaseEnd = 0.55;
  const slideInPhaseEnd = 0.75;
  const fixedScrewDwellPhaseEnd = 0.8;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.21,
    roughness: 0.49,
  });
  const threadMaterial = matte(0xb64b36, {
    metalness: 0.23,
    roughness: 0.46,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.17,
    roughness: 0.55,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.69,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.48,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const smootherStep = (value) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return clamped ** 3 * (
      clamped * (clamped * 6 - 15) + 10
    );
  };
  const smootherStepDerivative = (value) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return 30 * clamped ** 2 * (1 - clamped) ** 2;
  };
  const smootherStepSecondDerivative = (value) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return 60 * clamped * (1 - clamped) * (1 - 2 * clamped);
  };

  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(bedLength, bedHeight, bedDepth),
    frameMaterial,
  );
  bed.position.set(0, bedCenterY, 0);
  bed.userData.role = 'source-straight-bed-for-worm-wheel-slide';

  const slidewayRails = [-1, 1].map((sideSign) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(
        bedLength - 0.35,
        slidewayRailHeight,
        slidewayRailDepth,
      ),
      darkMaterial,
    );
    rail.position.set(
      0,
      bedTopY + slidewayRailHeight / 2,
      sideSign * slidewayRailCenterZ,
    );
    rail.userData.role = 'fixed-rail-parallel-to-worm-axis';
    rail.userData.side = sideSign < 0 ? 'rear' : 'front';
    return rail;
  });

  const screwSupports = [-1, 1].map((sideSign) => {
    const x = sideSign * bearingX;
    const post = makeBeam(
      new THREE.Vector3(x, supportPostBottomY, supportPostZ),
      new THREE.Vector3(x, screwAxisY, supportPostZ),
      { thickness: 0.14, depth: 0.2, color: PALETTE.frame },
    );
    post.userData.role = 'fixed-end-post-supporting-worm-bearing';
    post.userData.side = sideSign < 0 ? 'left' : 'right';
    const arm = makeBeam(
      new THREE.Vector3(x, screwAxisY, supportPostZ),
      new THREE.Vector3(x, screwAxisY, -0.12),
      { thickness: 0.13, depth: 0.18, color: PALETTE.frame },
    );
    arm.userData.role = 'fixed-bearing-arm-behind-the-worm';
    arm.userData.side = sideSign < 0 ? 'left' : 'right';
    return { arm, post };
  });

  const wormBearings = [-1, 1].map((sideSign) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(
        (bearingInnerRadius + bearingOuterRadius) / 2,
        (bearingOuterRadius - bearingInnerRadius) / 2,
        10,
        52,
      ),
      darkMaterial,
    );
    bearing.rotation.y = Math.PI / 2;
    bearing.position.set(sideSign * bearingX, screwAxisY, 0);
    bearing.userData.role = 'fixed-radial-and-thrust-bearing-for-worm';
    bearing.userData.side = sideSign < 0 ? 'left' : 'right';
    return bearing;
  });

  const worm = new THREE.Group();
  worm.position.y = screwAxisY;
  worm.userData.axis = X_AXIS.clone();
  worm.userData.role = 'axially-fixed-single-start-horizontal-worm';
  const wormRotor = new THREE.Group();
  worm.add(wormRotor);
  worm.userData.rotor = wormRotor;

  const wormCore = cylinderAlongX(
    wormCoreRadius,
    wormCoreLength,
    driverMaterial,
    48,
  );
  wormCore.position.x = wormCoreCenterX;
  wormCore.userData.role = 'solid-core-of-overhead-worm';
  wormRotor.add(wormCore);

  const wormThreadCurve = horizontalHelixCurve({
    maximumX: wormThreadMaximumX,
    minimumX: wormThreadMinimumX,
    phase: wormThreadPhase,
    pitch: wormPitch,
    radius: wormThreadRadius,
  });
  const wormThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      wormThreadCurve,
      wormThreadSegments,
      wormThreadTubeRadius,
      8,
      false,
    ),
    threadMaterial,
  );
  wormThread.userData.role = 'one-continuous-twelve-turn-worm-thread';
  wormRotor.add(wormThread);

  const inputSquare = new THREE.Mesh(
    new THREE.BoxGeometry(
      inputSquareLength,
      inputSquareSize,
      inputSquareSize,
    ),
    driverMaterial,
  );
  inputSquare.position.x = inputSquareCenterX;
  inputSquare.userData.role = 'square-rotary-input-on-worm-shaft';
  wormRotor.add(inputSquare);

  const wormRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.15, 0.23),
    indexMaterial,
  );
  wormRotationIndex.position.set(
    inputSquareCenterX - inputSquareLength / 2 - 0.024,
    inputSquareSize * 0.22,
    0,
  );
  wormRotationIndex.userData.role = 'visible-index-on-rotating-worm-input';
  wormRotor.add(wormRotationIndex);

  const carriage = new THREE.Group();
  carriage.position.x = carriageOriginX;
  carriage.userData.role = 'wheel-bearing-saddle-sliding-parallel-to-worm';

  const carriageBase = new THREE.Mesh(
    new THREE.BoxGeometry(
      carriageBaseLength,
      carriageBaseHeight,
      carriageBaseDepth,
    ),
    drivenMaterial,
  );
  carriageBase.position.y = (
    carriageBaseBottomY + carriageBaseTopY
  ) / 2;
  carriageBase.userData.role = 'source-wide-foot-of-worm-wheel-slide';
  carriage.add(carriageBase);

  const carriageWearPlate = new THREE.Mesh(
    new THREE.BoxGeometry(
      carriageBaseLength * 0.92,
      carriageWearPlateHeight,
      carriageBaseDepth * 0.88,
    ),
    darkMaterial,
  );
  carriageWearPlate.position.y = carriageBaseBottomY
    - carriageWearPlateHeight / 2;
  carriageWearPlate.userData.role = 'flat-wear-surface-on-slide-bed';
  carriage.add(carriageWearPlate);

  const guideShoes = [-1, 1].map((sideSign) => {
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(
        carriageBaseLength * 0.76,
        guideShoeHeight,
        guideShoeDepth,
      ),
      darkMaterial,
    );
    shoe.position.set(
      0,
      guideShoeCenterY,
      sideSign * guideShoeCenterZ,
    );
    shoe.userData.role = 'moving-shoe-capturing-worm-parallel-rail';
    shoe.userData.side = sideSign < 0 ? 'rear' : 'front';
    carriage.add(shoe);
    return shoe;
  });

  const pedestalLegs = [-1, 1].map((sideSign) => {
    const leg = makeBeam(
      new THREE.Vector3(
        sideSign * pedestalBaseHalfWidth,
        carriageBaseTopY,
        pedestalZ,
      ),
      new THREE.Vector3(
        sideSign * pedestalTopHalfWidth,
        wheelCenterY,
        pedestalZ,
      ),
      {
        thickness: 0.2,
        depth: pedestalDepth,
        color: PALETTE.driven,
      },
    );
    leg.userData.role = 'source-flared-pedestal-leg-under-wheel-hub';
    leg.userData.side = sideSign < 0 ? 'left' : 'right';
    carriage.add(leg);
    return leg;
  });

  const pedestalBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.075, 10, 44),
    darkMaterial,
  );
  pedestalBearing.position.set(0, wheelCenterY, pedestalZ + 0.16);
  pedestalBearing.userData.role = 'fixed-bearing-in-moving-wheel-pedestal';
  carriage.add(pedestalBearing);

  const wheelShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 1.08, 32),
    darkMaterial,
  );
  wheelShaft.rotation.x = Math.PI / 2;
  wheelShaft.position.set(0, wheelCenterY, 0);
  wheelShaft.userData.role = 'wheel-shaft-carried-by-sliding-pedestal';
  carriage.add(wheelShaft);

  const wheel = makeGear({
    teeth: wheelTeeth,
    radius: wheelPitchRadius,
    depth: wheelDepth,
    color: PALETTE.driven,
    toothHeight: wheelToothHeight,
  });
  wheel.position.set(0, wheelCenterY, 0);
  wheel.userData.role = 'twenty-tooth-wheel-meshing-with-overhead-worm';
  const wheelRotor = wheel.userData.rotor;
  const wheelRotationIndex = wheelRotor.children.at(-1);
  wheelRotationIndex.userData.role = 'visible-index-on-worm-wheel-face';
  carriage.add(wheel);

  const carriageTranslationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.045, 0.12),
    indexMaterial,
  );
  carriageTranslationIndex.position.set(
    0.53,
    carriageBaseTopY + 0.035,
    carriageBaseDepth / 2 + 0.015,
  );
  carriageTranslationIndex.userData.role = 'fixed-orientation-index-on-wheel-saddle';
  carriage.add(carriageTranslationIndex);

  root.add(
    bed,
    ...slidewayRails,
    ...screwSupports.flatMap(({ arm, post }) => [post, arm]),
    ...wormBearings,
    worm,
    carriage,
  );

  const motionAtTime = (time) => {
    const cycleIndex = Math.floor(time / cyclePeriod);
    const cycleTime = time - cycleIndex * cyclePeriod;
    const phase = cycleTime / cyclePeriod;
    let screwAngle;
    let screwAngularSpeed;
    let screwAngularAcceleration;
    let carriageDisplacement;
    let carriageVelocity;
    let carriageAcceleration;
    let stage;
    let operatingCase;

    if (phase < wormDrivePhaseEnd) {
      const duration = cyclePeriod * wormDrivePhaseEnd;
      const progress = phase / wormDrivePhaseEnd;
      screwAngle = -wormRotationTravel * smootherStep(progress);
      screwAngularSpeed = -wormRotationTravel
        * smootherStepDerivative(progress) / duration;
      screwAngularAcceleration = -wormRotationTravel
        * smootherStepSecondDerivative(progress) / duration ** 2;
      carriageDisplacement = 0;
      carriageVelocity = 0;
      carriageAcceleration = 0;
      stage = 'worm-driving-held-wheel-saddle';
      operatingCase = 'worm-input-wheel-output';
    } else if (phase < wormDriveDwellPhaseEnd) {
      screwAngle = -wormRotationTravel;
      screwAngularSpeed = 0;
      screwAngularAcceleration = 0;
      carriageDisplacement = 0;
      carriageVelocity = 0;
      carriageAcceleration = 0;
      stage = 'held-saddle-dwell';
      operatingCase = 'all-held';
    } else if (phase < slideOutPhaseEnd) {
      const duration = cyclePeriod * (
        slideOutPhaseEnd - wormDriveDwellPhaseEnd
      );
      const progress = (phase - wormDriveDwellPhaseEnd)
        / (slideOutPhaseEnd - wormDriveDwellPhaseEnd);
      screwAngle = -wormRotationTravel;
      screwAngularSpeed = 0;
      screwAngularAcceleration = 0;
      carriageDisplacement = carriageTravel * smootherStep(progress);
      carriageVelocity = carriageTravel
        * smootherStepDerivative(progress) / duration;
      carriageAcceleration = carriageTravel
        * smootherStepSecondDerivative(progress) / duration ** 2;
      stage = 'wheel-driving-slide-out';
      operatingCase = 'wheel-input-slide-output';
    } else if (phase < farDwellPhaseEnd) {
      screwAngle = -wormRotationTravel;
      screwAngularSpeed = 0;
      screwAngularAcceleration = 0;
      carriageDisplacement = carriageTravel;
      carriageVelocity = 0;
      carriageAcceleration = 0;
      stage = 'far-slide-dwell';
      operatingCase = 'all-held';
    } else if (phase < slideInPhaseEnd) {
      const duration = cyclePeriod * (slideInPhaseEnd - farDwellPhaseEnd);
      const progress = (phase - farDwellPhaseEnd)
        / (slideInPhaseEnd - farDwellPhaseEnd);
      screwAngle = -wormRotationTravel;
      screwAngularSpeed = 0;
      screwAngularAcceleration = 0;
      carriageDisplacement = carriageTravel * (1 - smootherStep(progress));
      carriageVelocity = -carriageTravel
        * smootherStepDerivative(progress) / duration;
      carriageAcceleration = -carriageTravel
        * smootherStepSecondDerivative(progress) / duration ** 2;
      stage = 'wheel-driving-slide-in';
      operatingCase = 'wheel-input-slide-output';
    } else if (phase < fixedScrewDwellPhaseEnd) {
      screwAngle = -wormRotationTravel;
      screwAngularSpeed = 0;
      screwAngularAcceleration = 0;
      carriageDisplacement = 0;
      carriageVelocity = 0;
      carriageAcceleration = 0;
      stage = 'held-screw-dwell';
      operatingCase = 'all-held';
    } else {
      const duration = cyclePeriod * (1 - fixedScrewDwellPhaseEnd);
      const progress = (phase - fixedScrewDwellPhaseEnd)
        / (1 - fixedScrewDwellPhaseEnd);
      screwAngle = -wormRotationTravel * (1 - smootherStep(progress));
      screwAngularSpeed = wormRotationTravel
        * smootherStepDerivative(progress) / duration;
      screwAngularAcceleration = wormRotationTravel
        * smootherStepSecondDerivative(progress) / duration ** 2;
      carriageDisplacement = 0;
      carriageVelocity = 0;
      carriageAcceleration = 0;
      stage = 'worm-returning-held-wheel-saddle';
      operatingCase = 'worm-input-wheel-output';
    }

    return {
      carriageAcceleration,
      carriageDisplacement,
      carriageVelocity,
      cycleIndex,
      cycleTime,
      operatingCase,
      phase,
      screwAngle,
      screwAngularAcceleration,
      screwAngularSpeed,
      stage,
    };
  };

  const stateFromMotion = (motion) => {
    const carriageX = carriageOriginX + motion.carriageDisplacement;
    const wheelAngle = wheelReferenceAngle - (
      wormWaveNumber * motion.carriageDisplacement + motion.screwAngle
    ) / wheelTeeth;
    const wheelAngularSpeed = -(
      wormWaveNumber * motion.carriageVelocity + motion.screwAngularSpeed
    ) / wheelTeeth;
    const wheelAngularAcceleration = -(
      wormWaveNumber * motion.carriageAcceleration
        + motion.screwAngularAcceleration
    ) / wheelTeeth;
    const wheelDeltaAngle = wheelAngle - wheelReferenceAngle;
    const meshPhase = wormWaveNumber * motion.carriageDisplacement
      + motion.screwAngle + wheelTeeth * wheelDeltaAngle;
    const meshPhaseVelocity = wormWaveNumber * motion.carriageVelocity
      + motion.screwAngularSpeed + wheelTeeth * wheelAngularSpeed;
    const meshPhaseAcceleration = wormWaveNumber * motion.carriageAcceleration
      + motion.screwAngularAcceleration
      + wheelTeeth * wheelAngularAcceleration;
    return {
      ...motion,
      carriageRotation: 0,
      carriageX,
      contactPoint: new THREE.Vector3(carriageX, pitchContactY, 0),
      meshPhase,
      meshPhaseAcceleration,
      meshPhaseVelocity,
      screwAxialDisplacement: 0,
      screwRevolutions: motion.screwAngle / fullTurn,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
      wheelDeltaAngle,
      wheelToothAdvance: wheelDeltaAngle / wheelToothPitchAngle,
    };
  };

  const stateAtTime = (time) => stateFromMotion(motionAtTime(time));

  root.userData.mechanism = 'bidirectional-worm-wheel-on-guided-sliding-saddle';
  root.userData.cameraDistanceScale = 1.09;
  root.userData.blocks = {
    bed,
    carriage,
    carriageBase,
    carriageTranslationIndex,
    carriageWearPlate,
    guideShoes,
    inputSquare,
    pedestalBearing,
    pedestalLegs,
    screwSupports,
    slidewayRails,
    wheel,
    wheelRotationIndex,
    wheelRotor,
    wheelShaft,
    worm,
    wormBearings,
    wormCore,
    wormRotationIndex,
    wormRotor,
    wormThread,
  };
  root.userData.geometry = {
    axis: X_AXIS.clone(),
    bearingInnerRadius,
    bearingOuterRadius,
    bearingX,
    bedDepth,
    bedHeight,
    bedLength,
    bedMaximumX,
    bedMinimumX,
    bedTopY,
    carriageBaseBottomY,
    carriageBaseDepth,
    carriageBaseHeight,
    carriageBaseLength,
    carriageBaseTopY,
    carriageFarX,
    carriageMidpointX,
    carriageOriginX,
    carriageTravel,
    carriageTravelLeads,
    carriageWearPlateHeight,
    cyclePeriod,
    farDwellPhaseEnd,
    fixedScrewDwellPhaseEnd,
    fullTurn,
    guideShoeCenterY,
    guideShoeCenterZ,
    guideShoeDepth,
    guideShoeHeight,
    inputSquareCenterX,
    inputSquareLength,
    inputSquareSize,
    pedestalBaseHalfWidth,
    pedestalDepth,
    pedestalTopHalfWidth,
    pedestalZ,
    pitchContactY,
    screwAxisY,
    slideInPhaseEnd,
    slideOutPhaseEnd,
    slidewayLateralClearance,
    slidewayRailCenterZ,
    slidewayRailDepth,
    slidewayRailHeight,
    slidewayVerticalClearance,
    sourceCarriageFootLength,
    sourceThreadedLength,
    sourceWheelCenterToFootTop,
    sourceWheelOuterDiameter,
    sourceWheelTeeth,
    sourceWormOuterDiameter,
    sourceWormPitch,
    sourceWormToWheelCenterDistance,
    supportPostBottomY,
    supportPostZ,
    wheelCenterY,
    wheelDepth,
    wheelOuterRadius,
    wheelPitchRadius,
    wheelReferenceAngle,
    wheelRootRadius,
    wheelTeeth,
    wheelToothHeight,
    wheelToothPitchAngle,
    wormCoreCenterX,
    wormCoreLength,
    wormCoreMaximumX,
    wormCoreMinimumX,
    wormCoreRadius,
    wormDriveDwellPhaseEnd,
    wormDrivePhaseEnd,
    wormDriveTurns,
    wormLead,
    wormLeadPerRadian,
    wormPitch,
    wormPitchRadius,
    wormRotationTravel,
    wormSegmentsPerTurn,
    wormStarts,
    wormThreadLength,
    wormThreadMaximumX,
    wormThreadMinimumX,
    wormThreadPhase,
    wormThreadRadius,
    wormThreadSegments,
    wormThreadTubeRadius,
    wormTurnCount,
    wormWaveNumber,
  };
  root.userData.curves = { wormThread: wormThreadCurve };
  root.userData.motionAtTime = motionAtTime;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    wormRotor.rotation.set(state.screwAngle, 0, 0);
    worm.userData.angularSpeed = state.screwAngularSpeed;
    carriage.position.set(state.carriageX, 0, 0);
    carriage.rotation.set(0, 0, 0);
    carriage.userData.velocity = new THREE.Vector3(
      state.carriageVelocity,
      0,
      0,
    );
    wheelRotor.rotation.set(0, 0, state.wheelAngle);
    wheel.userData.angularSpeed = state.wheelAngularSpeed;
    root.userData.contacts = {
      screwBearing: {
        axialDisplacementError: state.screwAxialDisplacement,
        axis: X_AXIS.clone(),
        radialClearance: bearingInnerRadius - wormCoreRadius,
      },
      slideWays: {
        axis: X_AXIS.clone(),
        lateralClearance: slidewayLateralClearance,
        lineError: Math.hypot(carriage.position.y, carriage.position.z),
        rotationError: 0,
        verticalClearance: slidewayVerticalClearance,
      },
      wormWheelMesh: {
        centerDistanceError: screwAxisY - wheelCenterY
          - wormPitchRadius - wheelPitchRadius,
        contactPoint: state.contactPoint.clone(),
        lead: wormLead,
        operatingCase: state.operatingCase,
        phaseAccelerationError: state.meshPhaseAcceleration,
        phaseConstraintError: state.meshPhase,
        phaseVelocityError: state.meshPhaseVelocity,
        starts: wormStarts,
        teeth: wheelTeeth,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(-6.8, 4.8, 11.8));
}

function screwStampingPressMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const threadStarts = 1;
  const threadPitch = 0.55;
  const threadLead = threadPitch * threadStarts;
  const threadLeadPerRadian = threadLead / fullTurn;
  const threadWaveNumber = fullTurn / threadPitch;
  const threadTurnCount = 7;
  const threadMinimumY = -1.6;
  const threadMaximumY = threadMinimumY
    + threadTurnCount * threadPitch;
  const threadLength = threadMaximumY - threadMinimumY;
  const threadCoreRadius = 0.39;
  const externalThreadRadius = 0.47;
  const externalThreadTubeRadius = 0.08;
  const internalThreadRadius = 0.62;
  const internalThreadTubeRadius = 0.03;
  const threadPitchRadius = 0.56;
  const threadRadialClearance = internalThreadRadius
    - internalThreadTubeRadius
    - externalThreadRadius
    - externalThreadTubeRadius;
  const threadSegmentsPerTurn = 64;
  const threadSegments = threadTurnCount * threadSegmentsPerTurn;

  const sourceHandleSpan = 360;
  const sourceHandleBallDiameter = 58;
  const sourceThreadOuterDiameter = 50;
  const sourceThreadPitch = 29;
  const sourceFixedHeadHeight = 80;
  const sourceFixedHeadWidth = 60;
  const sourceRamDiameter = 58;
  const sourceFrameBackToScrew = 115;

  const fixedNutCenterY = 0.72;
  const fixedNutHeight = 0.88;
  const fixedNutMinimumY = fixedNutCenterY - fixedNutHeight / 2;
  const fixedNutMaximumY = fixedNutCenterY + fixedNutHeight / 2;
  const fixedNutOuterRadius = 0.8;
  const fixedNutBoreRadius = 0.68;
  const fixedNutFlangeRadius = 0.9;
  const fixedNutFlangeHeight = 0.12;
  const fixedHeadTopY = fixedNutMaximumY + fixedNutFlangeHeight;
  const internalThreadPhase = threadWaveNumber * (
    fixedNutMinimumY - threadMinimumY
  );
  const internalThreadSegments = Math.ceil(
    fixedNutHeight / threadPitch * threadSegmentsPerTurn,
  );

  const screwCoreMinimumY = -1.82;
  const screwCoreMaximumY = 2.34;
  const screwCoreLength = screwCoreMaximumY - screwCoreMinimumY;
  const screwCoreCenterY = (screwCoreMinimumY + screwCoreMaximumY) / 2;
  const handleY = 2.52;
  const handleBarLength = 7.9;
  const handleBarRadius = 0.1;
  const handleBallCenterX = 3.3;
  const handleBallRadius = 0.57;
  const handleHubRadius = 0.49;
  const handleHubHeight = 0.56;
  const swivelCenterY = -1.76;
  const swivelBallRadius = 0.37;

  const ramSwivelCupRadius = 0.49;
  const ramSwivelCupTubeRadius = 0.075;
  const ramBodyRadius = 0.46;
  const ramBodyLength = 0.9;
  const ramBodyCenterY = -2.25;
  const stampRadius = 0.7;
  const stampHeight = 0.3;
  const stampCenterY = -2.78;
  const initialStampFaceY = stampCenterY - stampHeight / 2;
  const ramKeyX = 0.52;
  const ramKeyZ = -0.37;
  const ramKeyHeight = 0.72;
  const ramKeyWidth = 0.12;
  const ramKeyDepth = 0.12;
  const ramGuideX = 0.66;
  const ramGuideZ = -0.43;
  const ramGuideMinimumY = -4.2;
  const ramGuideMaximumY = -1.55;
  const ramGuideThickness = 0.11;
  const ramGuideDepth = 0.16;
  const ramGuideClearance = ramGuideX - ramGuideThickness / 2
    - ramKeyX - ramKeyWidth / 2;

  const screwTravelTurns = 1.5;
  const screwRotationTravel = screwTravelTurns * fullTurn;
  const pressTravel = screwTravelTurns * threadLead;
  const lowerScrewTranslation = -pressTravel;
  const workpieceTopY = initialStampFaceY + lowerScrewTranslation;
  const workpieceHeight = 0.145;
  const anvilTopY = workpieceTopY - workpieceHeight;
  const anvilHeight = 0.25;
  const anvilCenterY = anvilTopY - anvilHeight / 2;
  const anvilRadius = 0.84;

  const frameDepth = 0.72;
  const frameZ = -0.42;
  const frameUpperOuterY = 1.14;
  const frameUpperInnerY = 0.42;
  const frameBackOuterX = 2.88;
  const frameBackInnerX = 2.24;
  const frameLowerOuterY = -4.75;
  const frameLowerInnerY = -4.15;
  const frameLowerLeftX = -0.88;
  const frameUpperLeftX = 0.72;

  const cyclePeriod = 16;
  const downwardPhaseEnd = 0.4;
  const bottomDwellPhaseEnd = 0.5;
  const upwardPhaseEnd = 0.9;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.21,
    roughness: 0.49,
  });
  const threadMaterial = matte(0xb64b36, {
    metalness: 0.23,
    roughness: 0.46,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.17,
    roughness: 0.55,
  });
  const internalThreadMaterial = matte(PALETTE.brass, {
    metalness: 0.28,
    roughness: 0.43,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.69,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.48,
  });
  const workpieceMaterial = matte(PALETTE.accent, {
    metalness: 0.2,
    roughness: 0.52,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const smootherStep = (value) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return clamped ** 3 * (
      clamped * (clamped * 6 - 15) + 10
    );
  };
  const smootherStepDerivative = (value) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return 30 * clamped ** 2 * (1 - clamped) ** 2;
  };
  const smootherStepSecondDerivative = (value) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return 60 * clamped * (1 - clamped) * (1 - 2 * clamped);
  };

  const frameShape = new THREE.Shape();
  frameShape.moveTo(frameUpperLeftX, frameUpperOuterY);
  frameShape.lineTo(1.98, frameUpperOuterY);
  frameShape.quadraticCurveTo(
    frameBackOuterX,
    frameUpperOuterY,
    frameBackOuterX,
    0.2,
  );
  frameShape.lineTo(frameBackOuterX, -4.28);
  frameShape.quadraticCurveTo(
    frameBackOuterX,
    frameLowerOuterY,
    1.98,
    frameLowerOuterY,
  );
  frameShape.lineTo(frameLowerLeftX, frameLowerOuterY);
  frameShape.lineTo(frameLowerLeftX, frameLowerInnerY);
  frameShape.lineTo(1.7, frameLowerInnerY);
  frameShape.quadraticCurveTo(
    frameBackInnerX,
    frameLowerInnerY,
    frameBackInnerX,
    -4.04,
  );
  frameShape.lineTo(frameBackInnerX, -0.06);
  frameShape.quadraticCurveTo(
    frameBackInnerX,
    frameUpperInnerY,
    1.7,
    frameUpperInnerY,
  );
  frameShape.lineTo(frameUpperLeftX, frameUpperInnerY);
  frameShape.closePath();

  const frame = new THREE.Mesh(
    centeredExtrusion(frameShape, frameDepth, 0.035),
    frameMaterial,
  );
  frame.position.z = frameZ;
  frame.userData.role = 'source-rigid-C-frame-of-stamping-press';

  const fixedNutBody = new THREE.Mesh(
    centeredExtrusion(
      planarAnnularShape(fixedNutBoreRadius, fixedNutOuterRadius),
      fixedNutHeight,
      0.02,
    ),
    frameMaterial,
  );
  fixedNutBody.rotation.x = Math.PI / 2;
  fixedNutBody.position.y = fixedNutCenterY;
  fixedNutBody.userData.role = 'fixed-threaded-upper-head-with-real-bore';
  fixedNutBody.userData.hasBore = true;

  const fixedNutFlanges = [-1, 1].map((sideSign) => {
    const flange = new THREE.Mesh(
      centeredExtrusion(
        planarAnnularShape(fixedNutBoreRadius, fixedNutFlangeRadius),
        fixedNutFlangeHeight,
        0.018,
      ),
      frameMaterial,
    );
    flange.rotation.x = Math.PI / 2;
    flange.position.y = fixedNutCenterY
      + sideSign * (fixedNutHeight + fixedNutFlangeHeight) / 2;
    flange.userData.role = 'fixed-flange-on-threaded-press-head';
    flange.userData.side = sideSign < 0 ? 'lower' : 'upper';
    return flange;
  });

  const ramGuideBracket = new THREE.Mesh(
    new THREE.BoxGeometry(
      frameBackInnerX - ramGuideX + 0.18,
      0.24,
      0.2,
    ),
    frameMaterial,
  );
  ramGuideBracket.position.set(
    (frameBackInnerX + ramGuideX) / 2,
    ramGuideMaximumY - 0.1,
    frameZ,
  );
  ramGuideBracket.userData.role = 'fixed-bracket-tying-ram-keyway-to-frame';

  const internalThreadCurve = helixCurve({
    maximumY: fixedNutMaximumY,
    minimumY: fixedNutMinimumY,
    phase: internalThreadPhase,
    pitch: threadPitch,
    radius: internalThreadRadius,
  });
  const internalThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      internalThreadCurve,
      internalThreadSegments,
      internalThreadTubeRadius,
      7,
      false,
    ),
    internalThreadMaterial,
  );
  internalThread.userData.role = 'stationary-internal-thread-of-press-head';

  const ramGuide = makeBeam(
    new THREE.Vector3(ramGuideX, ramGuideMinimumY, ramGuideZ),
    new THREE.Vector3(ramGuideX, ramGuideMaximumY, ramGuideZ),
    {
      color: PALETTE.frame,
      depth: ramGuideDepth,
      thickness: ramGuideThickness,
    },
  );
  ramGuide.userData.role = 'fixed-keyway-guide-preventing-ram-rotation';

  const anvil = cylinderAlongY(
    anvilRadius,
    anvilHeight,
    darkMaterial,
    48,
  );
  anvil.position.y = anvilCenterY;
  anvil.userData.role = 'stationary-lower-anvil-on-C-frame';

  const workpiece = new THREE.Mesh(
    new THREE.CylinderGeometry(
      stampRadius * 0.72,
      stampRadius * 0.72,
      workpieceHeight,
      36,
    ),
    workpieceMaterial,
  );
  workpiece.position.y = anvilTopY + workpieceHeight / 2;
  workpiece.userData.role = 'fixed-workpiece-on-anvil-at-bottom-contact';

  const movingScrew = new THREE.Group();
  movingScrew.userData.axis = Y_AXIS.clone();
  movingScrew.userData.role = 'rotating-and-translating-right-hand-press-screw';
  const screwRotor = new THREE.Group();
  movingScrew.add(screwRotor);
  movingScrew.userData.rotor = screwRotor;

  const screwCore = cylinderAlongY(
    threadCoreRadius,
    screwCoreLength,
    driverMaterial,
    48,
  );
  screwCore.position.y = screwCoreCenterY;
  screwCore.userData.role = 'solid-core-of-stamping-press-screw';
  screwRotor.add(screwCore);

  const externalThreadCurve = helixCurve({
    maximumY: threadMaximumY,
    minimumY: threadMinimumY,
    pitch: threadPitch,
    radius: externalThreadRadius,
  });
  const externalThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      externalThreadCurve,
      threadSegments,
      externalThreadTubeRadius,
      8,
      false,
    ),
    threadMaterial,
  );
  externalThread.userData.role = 'one-continuous-seven-turn-right-hand-press-thread';
  screwRotor.add(externalThread);

  const handleHub = cylinderAlongY(
    handleHubRadius,
    handleHubHeight,
    driverMaterial,
    8,
  );
  handleHub.position.y = handleY;
  handleHub.userData.role = 'rotating-central-hub-of-weighted-T-handle';
  screwRotor.add(handleHub);

  const handleBar = cylinderAlongX(
    handleBarRadius,
    handleBarLength,
    darkMaterial,
    28,
  );
  handleBar.position.y = handleY;
  handleBar.userData.role = 'rigid-horizontal-T-handle-through-screw-head';
  screwRotor.add(handleBar);

  const handleBalls = [-1, 1].map((sideSign) => {
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(handleBallRadius, 32, 20),
      driverMaterial,
    );
    ball.scale.set(0.92, 1.12, 0.84);
    ball.position.set(sideSign * handleBallCenterX, handleY, 0);
    ball.userData.role = 'heavy-ball-on-end-of-press-handle';
    ball.userData.side = sideSign < 0 ? 'left' : 'right';
    screwRotor.add(ball);
    return ball;
  });

  const handleRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.18, 0.16),
    indexMaterial,
  );
  handleRotationIndex.position.set(
    handleBallCenterX + handleBallRadius * 0.72,
    handleY + 0.13,
    0,
  );
  handleRotationIndex.userData.role = 'visible-index-on-right-handle-weight';
  screwRotor.add(handleRotationIndex);

  const swivelBall = new THREE.Mesh(
    new THREE.SphereGeometry(swivelBallRadius, 28, 18),
    darkMaterial,
  );
  swivelBall.scale.y = 0.65;
  swivelBall.position.y = swivelCenterY;
  swivelBall.userData.role = 'rotating-thrust-ball-at-lower-end-of-screw';
  screwRotor.add(swivelBall);

  const ram = new THREE.Group();
  ram.userData.role = 'nonrotating-keyed-stamping-ram';

  const ramSwivelCup = new THREE.Mesh(
    new THREE.TorusGeometry(
      ramSwivelCupRadius,
      ramSwivelCupTubeRadius,
      10,
      48,
    ),
    drivenMaterial,
  );
  ramSwivelCup.rotation.x = Math.PI / 2;
  ramSwivelCup.position.y = swivelCenterY;
  ramSwivelCup.userData.role = 'nonrotating-cup-capturing-screw-thrust-ball';
  ram.add(ramSwivelCup);

  const ramBody = cylinderAlongY(
    ramBodyRadius,
    ramBodyLength,
    drivenMaterial,
    40,
  );
  ramBody.position.y = ramBodyCenterY;
  ramBody.userData.role = 'guided-cylindrical-body-of-stamping-ram';
  ram.add(ramBody);

  const stamp = cylinderAlongY(
    stampRadius,
    stampHeight,
    drivenMaterial,
    48,
  );
  stamp.position.y = stampCenterY;
  stamp.userData.role = 'flat-lower-stamping-platen';
  ram.add(stamp);

  const ramKey = new THREE.Mesh(
    new THREE.BoxGeometry(ramKeyWidth, ramKeyHeight, ramKeyDepth),
    darkMaterial,
  );
  ramKey.position.set(ramKeyX, ramBodyCenterY, ramKeyZ);
  ramKey.userData.role = 'moving-key-that-blocks-ram-rotation';
  ram.add(ramKey);

  const ramTranslationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.045, 0.12),
    indexMaterial,
  );
  ramTranslationIndex.position.set(
    0.18,
    stampCenterY + stampHeight / 2 + 0.035,
    stampRadius * 0.7,
  );
  ramTranslationIndex.userData.role = 'fixed-orientation-index-on-stamping-ram';
  ram.add(ramTranslationIndex);

  root.add(
    frame,
    fixedNutBody,
    ...fixedNutFlanges,
    internalThread,
    ramGuide,
    ramGuideBracket,
    anvil,
    workpiece,
    movingScrew,
    ram,
  );

  const motionAtTime = (time) => {
    const cycleIndex = Math.floor(time / cyclePeriod);
    const cycleTime = time - cycleIndex * cyclePeriod;
    const phase = cycleTime / cyclePeriod;
    let screwAngle;
    let screwAngularSpeed;
    let screwAngularAcceleration;
    let stage;
    if (phase < downwardPhaseEnd) {
      const duration = cyclePeriod * downwardPhaseEnd;
      const progress = phase / downwardPhaseEnd;
      screwAngle = screwRotationTravel * smootherStep(progress);
      screwAngularSpeed = screwRotationTravel
        * smootherStepDerivative(progress) / duration;
      screwAngularAcceleration = screwRotationTravel
        * smootherStepSecondDerivative(progress) / duration ** 2;
      stage = 'pressing-down';
    } else if (phase < bottomDwellPhaseEnd) {
      screwAngle = screwRotationTravel;
      screwAngularSpeed = 0;
      screwAngularAcceleration = 0;
      stage = 'bottom-press-dwell';
    } else if (phase < upwardPhaseEnd) {
      const duration = cyclePeriod * (upwardPhaseEnd - bottomDwellPhaseEnd);
      const progress = (phase - bottomDwellPhaseEnd)
        / (upwardPhaseEnd - bottomDwellPhaseEnd);
      screwAngle = screwRotationTravel * (1 - smootherStep(progress));
      screwAngularSpeed = -screwRotationTravel
        * smootherStepDerivative(progress) / duration;
      screwAngularAcceleration = -screwRotationTravel
        * smootherStepSecondDerivative(progress) / duration ** 2;
      stage = 'raising-ram';
    } else {
      screwAngle = 0;
      screwAngularSpeed = 0;
      screwAngularAcceleration = 0;
      stage = 'top-ram-dwell';
    }
    return {
      cycleIndex,
      cycleTime,
      phase,
      screwAngle,
      screwAngularAcceleration,
      screwAngularSpeed,
      stage,
    };
  };

  const stateFromMotion = (motion) => {
    const screwTranslation = -threadLeadPerRadian * motion.screwAngle;
    const screwTranslationVelocity = -threadLeadPerRadian
      * motion.screwAngularSpeed;
    const screwTranslationAcceleration = -threadLeadPerRadian
      * motion.screwAngularAcceleration;
    const initialContactPhase = threadWaveNumber * (
      fixedNutCenterY - threadMinimumY
    );
    const contactCosine = Math.cos(initialContactPhase);
    const contactSine = Math.sin(initialContactPhase);
    const radialX = threadPitchRadius * contactCosine;
    const radialZ = threadPitchRadius * contactSine;
    const contactPoint = new THREE.Vector3(
      radialX,
      fixedNutCenterY,
      radialZ,
    );
    const screwSurfaceVelocity = new THREE.Vector3(
      motion.screwAngularSpeed * radialZ,
      screwTranslationVelocity,
      -motion.screwAngularSpeed * radialX,
    );
    const relativeThreadVelocity = screwSurfaceVelocity.clone().negate();
    const radialNormal = new THREE.Vector3(
      contactCosine,
      0,
      contactSine,
    );
    const helixTangent = new THREE.Vector3(
      -threadWaveNumber * radialZ,
      1,
      threadWaveNumber * radialX,
    ).normalize();
    const flankNormal = new THREE.Vector3().crossVectors(
      radialNormal,
      helixTangent,
    ).normalize();
    const phaseConstraintError = -threadWaveNumber * screwTranslation
      - motion.screwAngle;
    const stampFaceY = initialStampFaceY + screwTranslation;
    const workpieceClearance = stampFaceY - workpieceTopY;
    const handleHeadClearance = handleY + screwTranslation
      - handleHubHeight / 2 - fixedHeadTopY;
    return {
      ...motion,
      contactPoint,
      flankNormal,
      handleY: handleY + screwTranslation,
      handleHeadClearance,
      helixTangent,
      inputRevolutions: motion.screwAngle / fullTurn,
      phaseConstraintError,
      radialNormal,
      ramRotation: 0,
      relativeThreadVelocity,
      screwSurfaceVelocity,
      screwTranslation,
      screwTranslationAcceleration,
      screwTranslationVelocity,
      stampContact: Math.abs(workpieceClearance) < 1e-12,
      stampFaceY,
      threadFlankNormalVelocityError: relativeThreadVelocity.dot(flankNormal),
      threadRadialNormalVelocityError: relativeThreadVelocity.dot(radialNormal),
      threadSlidingSpeed: relativeThreadVelocity.dot(helixTangent),
      workpieceClearance,
    };
  };

  const stateAtTime = (time) => stateFromMotion(motionAtTime(time));

  root.userData.mechanism = 'weighted-T-handle-screw-press-with-keyed-swivel-ram';
  root.userData.cameraDistanceScale = 1.12;
  root.userData.blocks = {
    anvil,
    externalThread,
    fixedNutBody,
    fixedNutFlanges,
    frame,
    handleBalls,
    handleBar,
    handleHub,
    handleRotationIndex,
    internalThread,
    movingScrew,
    ram,
    ramBody,
    ramGuide,
    ramGuideBracket,
    ramKey,
    ramSwivelCup,
    ramTranslationIndex,
    screwCore,
    screwRotor,
    stamp,
    swivelBall,
    workpiece,
  };
  root.userData.geometry = {
    anvilCenterY,
    anvilHeight,
    anvilRadius,
    anvilTopY,
    bottomDwellPhaseEnd,
    cyclePeriod,
    downwardPhaseEnd,
    externalThreadRadius,
    externalThreadTubeRadius,
    fixedNutBoreRadius,
    fixedNutCenterY,
    fixedNutFlangeHeight,
    fixedNutFlangeRadius,
    fixedNutHeight,
    fixedHeadTopY,
    fixedNutMaximumY,
    fixedNutMinimumY,
    fixedNutOuterRadius,
    frameBackInnerX,
    frameBackOuterX,
    frameDepth,
    frameLowerInnerY,
    frameLowerLeftX,
    frameLowerOuterY,
    frameUpperInnerY,
    frameUpperLeftX,
    frameUpperOuterY,
    frameZ,
    fullTurn,
    handleBallCenterX,
    handleBallRadius,
    handleBarLength,
    handleBarRadius,
    handleHubHeight,
    handleHubRadius,
    handleY,
    minimumHandleHeadClearance: handleY + lowerScrewTranslation
      - handleHubHeight / 2 - fixedHeadTopY,
    initialStampFaceY,
    internalThreadPhase,
    internalThreadRadius,
    internalThreadSegments,
    internalThreadTubeRadius,
    lowerScrewTranslation,
    pressTravel,
    ramBodyCenterY,
    ramBodyLength,
    ramBodyRadius,
    ramGuideClearance,
    ramGuideDepth,
    ramGuideMaximumY,
    ramGuideMinimumY,
    ramGuideThickness,
    ramGuideX,
    ramGuideZ,
    ramKeyDepth,
    ramKeyHeight,
    ramKeyWidth,
    ramKeyX,
    ramKeyZ,
    ramSwivelCupRadius,
    ramSwivelCupTubeRadius,
    screwCoreCenterY,
    screwCoreLength,
    screwCoreMaximumY,
    screwCoreMinimumY,
    screwRotationTravel,
    screwTravelTurns,
    sourceFixedHeadHeight,
    sourceFixedHeadWidth,
    sourceFrameBackToScrew,
    sourceHandleBallDiameter,
    sourceHandleSpan,
    sourceRamDiameter,
    sourceThreadOuterDiameter,
    sourceThreadPitch,
    stampCenterY,
    stampHeight,
    stampRadius,
    swivelBallRadius,
    swivelCenterY,
    threadCoreRadius,
    threadLead,
    threadLeadPerRadian,
    threadLength,
    threadMaximumY,
    threadMinimumY,
    threadPitch,
    threadPitchRadius,
    threadRadialClearance,
    threadSegments,
    threadSegmentsPerTurn,
    threadStarts,
    threadTurnCount,
    threadWaveNumber,
    upwardPhaseEnd,
    workpieceHeight,
    workpieceTopY,
  };
  root.userData.curves = {
    externalThread: externalThreadCurve,
    internalThread: internalThreadCurve,
  };
  root.userData.motionAtTime = motionAtTime;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    movingScrew.position.set(0, state.screwTranslation, 0);
    screwRotor.rotation.set(0, state.screwAngle, 0);
    movingScrew.userData.angularSpeed = state.screwAngularSpeed;
    movingScrew.userData.velocity = new THREE.Vector3(
      0,
      state.screwTranslationVelocity,
      0,
    );
    ram.position.set(0, state.screwTranslation, 0);
    ram.rotation.set(0, 0, 0);
    ram.userData.velocity = new THREE.Vector3(
      0,
      state.screwTranslationVelocity,
      0,
    );
    root.userData.contacts = {
      fixedNutThread: {
        contactPoint: state.contactPoint.clone(),
        flankNormal: state.flankNormal.clone(),
        flankNormalVelocityError: state.threadFlankNormalVelocityError,
        lead: threadLead,
        phaseConstraintError: state.phaseConstraintError,
        pitch: threadPitch,
        radialClearance: threadRadialClearance,
        radialNormal: state.radialNormal.clone(),
        radialNormalVelocityError: state.threadRadialNormalVelocityError,
        singleStart: threadStarts === 1,
        slidingSpeed: state.threadSlidingSpeed,
        tangent: state.helixTangent.clone(),
      },
      ramGuide: {
        axis: Y_AXIS.clone(),
        lateralClearance: ramGuideClearance,
        lineError: Math.hypot(ram.position.x, ram.position.z),
        rotationError: 0,
      },
      stamp: {
        clearance: state.workpieceClearance,
        engaged: state.stampContact,
        normal: Y_AXIS.clone(),
      },
      swivel: {
        centerError: Math.abs(
          swivelCenterY + state.screwTranslation
            - (swivelCenterY + ram.position.y)
        ),
        rotationIsolationError: state.ramRotation,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(-6.8, 5.1, 11.8));
}

function intersectingReverseThreadTraverseMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const reverseThreadTurns = 3;
  const crossingsPerInputRevolution = 2;
  const interiorIntersectionCount = reverseThreadTurns
    * crossingsPerInputRevolution - 1;
  const inputAngularSpeed = 0.68;
  const sourceDriverAngle = 0;
  const sourceTraversalRevolutions = reverseThreadTurns / 2;
  const inputRevolutionPeriod = fullTurn / inputAngularSpeed;
  const outputCycleInputRevolutions = reverseThreadTurns * 2;
  const cyclePeriod = inputRevolutionPeriod
    * outputCycleInputRevolutions;

  const cylinderRadius = 0.68;
  const cylinderMinimumY = -1.675;
  const cylinderMaximumY = 1.675;
  const cylinderLength = cylinderMaximumY - cylinderMinimumY;
  const cylinderBodyMinimumY = -1.83;
  const cylinderBodyMaximumY = 1.83;
  const cylinderBodyLength = cylinderBodyMaximumY - cylinderBodyMinimumY;
  const grooveCenterRadius = cylinderRadius - 0.018;
  const grooveTubeRadius = 0.05;
  const grooveLead = cylinderLength / reverseThreadTurns;
  const grooveWaveNumber = fullTurn / grooveLead;
  const uniformFollowerSpeed = inputAngularSpeed / grooveWaveNumber;
  const grooveSegmentsPerTurn = 128;
  const grooveSegments = reverseThreadTurns * grooveSegmentsPerTurn;
  const grooveRadialSegments = 8;

  const sourceCylinderDiameter = 99;
  const sourceGroovedLength = 244;
  const sourceGuideOffset = 137;
  const sourceFrameSpan = 205;
  const sourceFrameHeight = 326;
  const sourceVisibleInteriorIntersections = 5;

  const frameMinimumX = -2.2;
  const frameMaximumX = 0.62;
  const frameLength = frameMaximumX - frameMinimumX;
  const topRailY = 2.24;
  const bottomRailY = -2.24;
  const frameHeight = topRailY - bottomRailY;
  const railHeight = 0.25;
  const railDepth = 0.46;
  const frameZ = -0.24;
  const guideCenterX = -1.88;
  const guideRodRadius = 0.09;
  const guideBearingClearance = 0.025;
  const guideRodLength = frameHeight - railHeight;
  const guideCarriageHalfWidth = 0.28;
  const guideCarriageHalfDepth = 0.25;
  const guideCarriageLength = 0.38;
  const guideCarriageBoreRadius = guideRodRadius
    + guideBearingClearance;

  const shaftRadius = 0.11;
  const shaftLength = 4.86;
  const shaftBearingInnerRadius = shaftRadius + 0.025;
  const shaftBearingOuterRadius = 0.285;
  const shaftBearingLength = 0.25;
  const endCapRadius = 0.76;
  const endCapHeight = 0.11;
  const upperEndCapY = cylinderBodyMaximumY + endCapHeight / 2;
  const lowerEndCapY = cylinderBodyMinimumY - endCapHeight / 2;
  const inputGearRadius = 1.03;
  const inputGearDepth = 0.15;
  const inputGearCenterY = -2.04;
  const inputGearTeeth = 44;
  const followerTipRadius = 0.072;
  const followerContactX = -grooveCenterRadius;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.55,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.6,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const grooveMaterial = matte(0x252a2d, {
    metalness: 0.18,
    roughness: 0.5,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.45 });

  const positiveModulo = (value, modulus) => (
    ((value % modulus) + modulus) % modulus
  );
  const angularDistance = (left, right) => Math.abs(Math.atan2(
    Math.sin(left - right),
    Math.cos(left - right),
  ));
  const makeReverseThreadCurve = (hand) => new class extends THREE.Curve {
    getPoint(parameter, target = new THREE.Vector3()) {
      const y = cylinderMinimumY + cylinderLength * parameter;
      const turns = hand === 'positive'
        ? reverseThreadTurns * parameter
        : reverseThreadTurns * (1 - parameter);
      const angle = fullTurn * turns;
      return target.set(
        grooveCenterRadius * Math.cos(angle),
        y,
        -grooveCenterRadius * Math.sin(angle),
      );
    }
  }();
  const positivePitchCurve = makeReverseThreadCurve('positive');
  const negativePitchCurve = makeReverseThreadCurve('negative');
  positivePitchCurve.arcLengthDivisions = grooveSegments;
  negativePitchCurve.arcLengthDivisions = grooveSegments;

  const input = new THREE.Group();
  const inputRotor = new THREE.Group();
  input.userData.axis = Y_AXIS.clone();
  input.userData.rotor = inputRotor;
  input.userData.role = 'uniformly-rotating-vertical-reverse-thread-cylinder';
  input.add(inputRotor);

  const cylinder = cylinderAlongY(
    cylinderRadius,
    cylinderBodyLength,
    driverMaterial,
    64,
  );
  cylinder.userData.role = 'vertical-cylinder-carrying-opposite-hand-grooves';

  const positivePitchGroove = new THREE.Mesh(
    new THREE.TubeGeometry(
      positivePitchCurve,
      grooveSegments,
      grooveTubeRadius,
      grooveRadialSegments,
      false,
    ),
    grooveMaterial,
  );
  positivePitchGroove.userData.role = 'constant-lead-positive-pitch-groove';
  positivePitchGroove.userData.hand = 'positive';

  const negativePitchGroove = new THREE.Mesh(
    new THREE.TubeGeometry(
      negativePitchCurve,
      grooveSegments,
      grooveTubeRadius,
      grooveRadialSegments,
      false,
    ),
    grooveMaterial,
  );
  negativePitchGroove.userData.role = 'constant-lead-negative-pitch-groove';
  negativePitchGroove.userData.hand = 'negative';

  const grooveIntersections = Array.from(
    { length: interiorIntersectionCount },
    (_, index) => {
      const intersectionIndex = index + 1;
      const parameter = intersectionIndex
        / (reverseThreadTurns * crossingsPerInputRevolution);
      const intersection = new THREE.Mesh(
        new THREE.SphereGeometry(grooveTubeRadius * 1.03, 16, 10),
        grooveMaterial,
      );
      intersection.position.copy(positivePitchCurve.getPoint(parameter));
      intersection.userData.role = 'interior-crossing-of-reverse-grooves';
      intersection.userData.intersectionIndex = intersectionIndex;
      intersection.userData.parameter = parameter;
      return intersection;
    },
  );

  const endReversalPockets = [0, 1].map((parameter, index) => {
    const pocket = new THREE.Mesh(
      new THREE.SphereGeometry(grooveTubeRadius * 1.22, 18, 12),
      grooveMaterial,
    );
    pocket.position.copy(positivePitchCurve.getPoint(parameter));
    pocket.userData.role = 'joined-end-reversal-of-opposite-hand-grooves';
    pocket.userData.end = index === 0 ? 'lower' : 'upper';
    return pocket;
  });

  const endCaps = [
    { centerY: lowerEndCapY, side: 'lower' },
    { centerY: upperEndCapY, side: 'upper' },
  ].map(({ centerY, side }) => {
    const cap = cylinderAlongY(
      endCapRadius,
      endCapHeight,
      driverMaterial,
      56,
    );
    cap.position.y = centerY;
    cap.userData.role = 'rotating-end-cap-on-reverse-thread-cylinder';
    cap.userData.side = side;
    return cap;
  });

  const inputShaft = cylinderAlongY(
    shaftRadius,
    shaftLength,
    darkMaterial,
    32,
  );
  inputShaft.userData.role = 'vertical-shaft-through-grooved-cylinder';

  const inputGear = makeGear({
    axis: Y_AXIS,
    color: PALETTE.driver,
    depth: inputGearDepth,
    radius: inputGearRadius,
    teeth: inputGearTeeth,
    toothHeight: 0.075,
  });
  inputGear.position.y = inputGearCenterY;
  inputGear.userData.role = 'lower-input-gear-fixed-to-cylinder-shaft';

  const inputRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.075, 0.03),
    indexMaterial,
  );
  inputRotationIndex.position.set(
    0,
    upperEndCapY,
    endCapRadius + 0.016,
  );
  inputRotationIndex.userData.role = 'visible-index-on-rotating-cylinder-cap-rim';

  inputRotor.add(
    cylinder,
    positivePitchGroove,
    negativePitchGroove,
    ...grooveIntersections,
    ...endReversalPockets,
    ...endCaps,
    inputShaft,
    inputGear,
    inputRotationIndex,
  );

  const makeVerticalAnnulus = ({
    innerRadius,
    length,
    material,
    outerRadius,
  }) => {
    const annulus = new THREE.Mesh(
      centeredExtrusion(
        planarAnnularShape(innerRadius, outerRadius),
        length,
        0.008,
      ),
      material,
    );
    annulus.rotation.x = Math.PI / 2;
    return annulus;
  };

  const topRail = new THREE.Mesh(
    new THREE.BoxGeometry(frameLength, railHeight, railDepth),
    frameMaterial,
  );
  topRail.position.set(
    (frameMinimumX + frameMaximumX) / 2,
    topRailY,
    frameZ,
  );
  topRail.userData.role = 'fixed-top-frame-carrying-guide-and-shaft-bearing';

  const bottomRail = new THREE.Mesh(
    new THREE.BoxGeometry(frameLength, railHeight, railDepth),
    frameMaterial,
  );
  bottomRail.position.set(
    (frameMinimumX + frameMaximumX) / 2,
    bottomRailY,
    frameZ,
  );
  bottomRail.userData.role = 'fixed-bottom-frame-carrying-guide-and-shaft-bearing';

  const guideRod = cylinderAlongY(
    guideRodRadius,
    guideRodLength,
    darkMaterial,
    28,
  );
  guideRod.position.x = guideCenterX;
  guideRod.userData.role = 'fixed-vertical-follower-guide-rod';

  const shaftBearings = [
    { centerY: bottomRailY, side: 'lower' },
    { centerY: topRailY, side: 'upper' },
  ].map(({ centerY, side }) => {
    const bearing = makeVerticalAnnulus({
      innerRadius: shaftBearingInnerRadius,
      length: shaftBearingLength,
      material: frameMaterial,
      outerRadius: shaftBearingOuterRadius,
    });
    bearing.position.set(0, centerY, 0);
    bearing.userData.role = 'fixed-bored-bearing-for-cylinder-shaft';
    bearing.userData.side = side;
    return bearing;
  });

  const follower = new THREE.Group();
  follower.userData.role = 'nonrotating-point-follower-on-vertical-guide';

  const carriageShape = new THREE.Shape();
  carriageShape.moveTo(-guideCarriageHalfWidth, -guideCarriageHalfDepth);
  carriageShape.lineTo(guideCarriageHalfWidth, -guideCarriageHalfDepth);
  carriageShape.lineTo(guideCarriageHalfWidth, guideCarriageHalfDepth);
  carriageShape.lineTo(-guideCarriageHalfWidth, guideCarriageHalfDepth);
  carriageShape.closePath();
  const carriageBore = new THREE.Path();
  carriageBore.absarc(
    0,
    0,
    guideCarriageBoreRadius,
    0,
    fullTurn,
    true,
  );
  carriageBore.closePath();
  carriageShape.holes.push(carriageBore);
  const followerCarriage = new THREE.Mesh(
    centeredExtrusion(carriageShape, guideCarriageLength, 0.012),
    drivenMaterial,
  );
  followerCarriage.rotation.x = Math.PI / 2;
  followerCarriage.position.x = guideCenterX;
  followerCarriage.userData.role = 'moving-bored-block-on-fixed-vertical-guide';

  const followerArmShape = new THREE.Shape();
  followerArmShape.moveTo(guideCenterX + 0.1, -0.14);
  followerArmShape.lineTo(followerContactX, 0);
  followerArmShape.lineTo(guideCenterX + 0.1, 0.14);
  followerArmShape.closePath();
  const followerArm = new THREE.Mesh(
    centeredExtrusion(followerArmShape, 0.18, 0.012),
    drivenMaterial,
  );
  followerArm.userData.role = 'tapered-arm-carrying-groove-follower-point';

  const followerTip = new THREE.Mesh(
    new THREE.SphereGeometry(followerTipRadius, 24, 16),
    drivenMaterial,
  );
  followerTip.position.x = followerContactX;
  followerTip.scale.x = 0.72;
  followerTip.userData.role = 'point-inserted-in-intersecting-reverse-grooves';

  const followerTranslationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.16, 0.035),
    indexMaterial,
  );
  followerTranslationIndex.position.set(
    guideCenterX,
    0,
    guideCarriageHalfDepth + 0.03,
  );
  followerTranslationIndex.userData.role = 'fixed-orientation-index-on-follower-block';
  follower.add(
    followerCarriage,
    followerArm,
    followerTip,
    followerTranslationIndex,
  );

  root.add(
    input,
    topRail,
    bottomRail,
    guideRod,
    ...shaftBearings,
    follower,
  );

  const stateAtDriverAngle = (driverAngle) => {
    const inputRevolutions = (
      driverAngle - sourceDriverAngle
    ) / fullTurn;
    const cycleCoordinate = positiveModulo(
      sourceTraversalRevolutions + inputRevolutions,
      outputCycleInputRevolutions,
    );
    const atUpperReversal = Math.min(
      cycleCoordinate,
      outputCycleInputRevolutions - cycleCoordinate,
    ) < 1e-10;
    const atLowerReversal = Math.abs(
      cycleCoordinate - reverseThreadTurns
    ) < 1e-10;
    const descending = cycleCoordinate < reverseThreadTurns;
    const followerY = descending
      ? cylinderMaximumY - grooveLead * cycleCoordinate
      : cylinderMinimumY + grooveLead * (
        cycleCoordinate - reverseThreadTurns
      );
    const followerVelocityY = descending
      ? -uniformFollowerSpeed
      : uniformFollowerSpeed;
    const followerFraction = (
      followerY - cylinderMinimumY
    ) / cylinderLength;
    const positivePitchAngle = fullTurn
      * reverseThreadTurns * followerFraction;
    const negativePitchAngle = fullTurn
      * reverseThreadTurns * (1 - followerFraction);
    const branch = descending ? 'positive-pitch' : 'negative-pitch';
    const selectedLocalAngle = branch === 'positive-pitch'
      ? positivePitchAngle
      : negativePitchAngle;
    const alternateLocalAngle = branch === 'positive-pitch'
      ? negativePitchAngle
      : positivePitchAngle;
    const contactLocalAngle = positiveModulo(
      Math.PI - driverAngle,
      fullTurn,
    );
    const groovePhaseConstraintError = angularDistance(
      selectedLocalAngle,
      contactLocalAngle,
    );
    const atGrooveIntersection = angularDistance(
      selectedLocalAngle,
      alternateLocalAngle,
    ) < 1e-10;
    const atEndReversal = atUpperReversal || atLowerReversal;
    const atInteriorIntersection = atGrooveIntersection && !atEndReversal;
    const crossingSequence = positiveModulo(
      Math.round(cycleCoordinate * crossingsPerInputRevolution),
      outputCycleInputRevolutions * crossingsPerInputRevolution,
    );
    const contactPoint = new THREE.Vector3(
      followerContactX,
      followerY,
      0,
    );
    const camSurfaceVelocity = new THREE.Vector3(
      0,
      0,
      inputAngularSpeed * grooveCenterRadius,
    );
    const followerVelocity = new THREE.Vector3(
      0,
      followerVelocityY,
      0,
    );
    const relativeGrooveVelocity = followerVelocity.clone()
      .sub(camSurfaceVelocity);
    const grooveTangent = new THREE.Vector3(
      0,
      1,
      branch === 'positive-pitch'
        ? grooveCenterRadius * grooveWaveNumber
        : -grooveCenterRadius * grooveWaveNumber,
    ).normalize();
    const alternateGrooveTangent = new THREE.Vector3(
      0,
      1,
      branch === 'positive-pitch'
        ? -grooveCenterRadius * grooveWaveNumber
        : grooveCenterRadius * grooveWaveNumber,
    ).normalize();
    const radialNormal = new THREE.Vector3(-1, 0, 0);
    const flankNormal = new THREE.Vector3().crossVectors(
      radialNormal,
      grooveTangent,
    ).normalize();
    const stage = atUpperReversal
      ? 'upper-end-instantaneous-thread-reversal'
      : atLowerReversal
        ? 'lower-end-instantaneous-thread-reversal'
        : atInteriorIntersection
          ? descending
            ? 'uniform-downward-through-thread-intersection'
            : 'uniform-upward-through-thread-intersection'
          : descending
            ? 'uniform-downward-positive-pitch-traverse'
            : 'uniform-upward-negative-pitch-traverse';
    return {
      alternateGrooveTangent,
      alternateLocalAngle: positiveModulo(alternateLocalAngle, fullTurn),
      atEndReversal,
      atGrooveIntersection,
      atInteriorIntersection,
      atLowerReversal,
      atUpperReversal,
      branch,
      camSurfaceVelocity,
      contactLocalAngle,
      contactPoint,
      crossingSequence,
      cycleCoordinate,
      cyclePhase: positiveModulo(
        inputRevolutions,
        outputCycleInputRevolutions,
      ) / outputCycleInputRevolutions,
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      flankNormal,
      flankNormalVelocityError: relativeGrooveVelocity.dot(flankNormal),
      followerAcceleration: new THREE.Vector3(0, 0, 0),
      followerFraction,
      followerRotation: 0,
      followerVelocity,
      followerY,
      groovePhaseConstraintError,
      grooveSlidingSpeed: relativeGrooveVelocity.dot(grooveTangent),
      grooveTangent,
      inputRevolutions,
      normalizedDriverAngle: positiveModulo(driverAngle, fullTurn),
      outputCycles: inputRevolutions / outputCycleInputRevolutions,
      radialNormal,
      radialNormalVelocityError: relativeGrooveVelocity.dot(radialNormal),
      relativeGrooveVelocity,
      selectedLocalAngle: positiveModulo(selectedLocalAngle, fullTurn),
      stage,
      surfaceRadiusError: Math.abs(
        Math.hypot(contactPoint.x, contactPoint.z) - grooveCenterRadius
      ),
      uniformSpeedError: Math.abs(followerVelocityY)
        - uniformFollowerSpeed,
      velocityDiscontinuousAtReversal: atEndReversal,
    };
  };
  const stateAtTime = (time) => stateAtDriverAngle(
    sourceDriverAngle + inputAngularSpeed * time,
  );

  root.userData.mechanism = 'intersecting-opposite-hand-thread-traverse-cylinder';
  root.userData.cameraDistanceScale = 1.06;
  root.userData.blocks = {
    bottomRail,
    cylinder,
    endCaps,
    endReversalPockets,
    follower,
    followerArm,
    followerCarriage,
    followerTip,
    followerTranslationIndex,
    grooveIntersections,
    guideRod,
    input,
    inputGear,
    inputRotationIndex,
    inputRotor,
    inputShaft,
    negativePitchGroove,
    positivePitchGroove,
    shaftBearings,
    topRail,
  };
  root.userData.curves = {
    negativePitch: negativePitchCurve,
    positivePitch: positivePitchCurve,
  };
  root.userData.geometry = {
    axis: Y_AXIS.clone(),
    bottomRailY,
    crossingsPerInputRevolution,
    cyclePeriod,
    cylinderBodyLength,
    cylinderBodyMaximumY,
    cylinderBodyMinimumY,
    cylinderLength,
    cylinderMaximumY,
    cylinderMinimumY,
    cylinderRadius,
    endCapHeight,
    endCapRadius,
    lowerEndCapY,
    upperEndCapY,
    followerContactX,
    followerTipRadius,
    frameHeight,
    frameLength,
    frameMaximumX,
    frameMinimumX,
    fullTurn,
    grooveCenterRadius,
    grooveLead,
    grooveRadialSegments,
    grooveSegments,
    grooveSegmentsPerTurn,
    grooveTubeRadius,
    grooveWaveNumber,
    guideBearingClearance,
    guideCarriageBoreRadius,
    guideCarriageHalfDepth,
    guideCarriageHalfWidth,
    guideCarriageLength,
    guideCenterX,
    guideRodLength,
    guideRodRadius,
    inputAngularSpeed,
    inputGearCenterY,
    inputGearDepth,
    inputGearRadius,
    inputGearTeeth,
    inputRevolutionPeriod,
    interiorIntersectionCount,
    outputCycleInputRevolutions,
    railDepth,
    railHeight,
    reverseThreadTurns,
    shaftBearingInnerRadius,
    shaftBearingLength,
    shaftBearingOuterRadius,
    shaftLength,
    shaftRadius,
    sourceCylinderDiameter,
    sourceDriverAngle,
    sourceFrameHeight,
    sourceFrameSpan,
    sourceGroovedLength,
    sourceGuideOffset,
    sourceTraversalRevolutions,
    sourceVisibleInteriorIntersections,
    topRailY,
    uniformFollowerSpeed,
  };
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.set(0, state.driverAngle, 0);
    input.userData.angularSpeed = state.driverAngularSpeed;
    follower.position.set(0, state.followerY, 0);
    follower.rotation.set(0, 0, 0);
    follower.userData.velocity = state.followerVelocity.clone();
    root.userData.contacts = {
      followerPoint: {
        branch: state.branch,
        centerError: new THREE.Vector3(
          followerTip.position.x,
          follower.position.y + followerTip.position.y,
          followerTip.position.z,
        ).distanceTo(state.contactPoint),
        contactPoint: state.contactPoint.clone(),
        inserted: true,
      },
      reverseGrooves: {
        alternateTangent: state.alternateGrooveTangent.clone(),
        atEndReversal: state.atEndReversal,
        atInteriorIntersection: state.atInteriorIntersection,
        branchContinuityAtCrossing: state.atInteriorIntersection,
        crossingsPerInputRevolution,
        flankNormal: state.flankNormal.clone(),
        flankNormalVelocityError: state.flankNormalVelocityError,
        oppositeHands: true,
        phaseConstraintError: state.groovePhaseConstraintError,
        radialNormal: state.radialNormal.clone(),
        radialNormalVelocityError: state.radialNormalVelocityError,
        selectedTangent: state.grooveTangent.clone(),
        slidingSpeed: state.grooveSlidingSpeed,
        surfaceRadiusError: state.surfaceRadiusError,
      },
      shaftBearings: {
        axis: Y_AXIS.clone(),
        radialClearance: shaftBearingInnerRadius - shaftRadius,
      },
      verticalGuide: {
        axis: Y_AXIS.clone(),
        boreClearance: guideBearingClearance,
        lineError: Math.hypot(follower.position.x, follower.position.z),
        rotationError: 0,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(7.8, 3.6, 10.8));
}

function changeGearScrewCuttingMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const leadGearTeeth = 24;
  const workGearTeeth = 32;
  const gearModule = 0.025;
  const leadGearPitchRadius = leadGearTeeth * gearModule;
  const workGearPitchRadius = workGearTeeth * gearModule;
  const workToLeadAngularRatio = -leadGearTeeth / workGearTeeth;
  const axisSpacing = leadGearPitchRadius + workGearPitchRadius;
  const leadAxisX = -axisSpacing / 2;
  const workAxisX = axisSpacing / 2;

  const leadScrewPitch = 0.4;
  const leadScrewLead = leadScrewPitch;
  const leadWaveNumber = fullTurn / leadScrewLead;
  const leadPerRadian = leadScrewLead / fullTurn;
  const leadThreadMinimumY = -1.62;
  const leadThreadMaximumY = 1.62;
  const leadThreadLength = leadThreadMaximumY - leadThreadMinimumY;
  const leadThreadTurnCount = leadThreadLength / leadScrewPitch;
  const leadCoreRadius = 0.225;
  const leadExternalThreadRadius = 0.3;
  const leadExternalThreadTubeRadius = 0.04;
  const leadInternalThreadRadius = 0.385;
  const leadInternalThreadTubeRadius = 0.025;
  const leadThreadPitchRadius = (
    leadExternalThreadRadius + leadExternalThreadTubeRadius
      + leadInternalThreadRadius - leadInternalThreadTubeRadius
  ) / 2;
  const leadThreadRadialClearance = leadInternalThreadRadius
    - leadInternalThreadTubeRadius
    - leadExternalThreadRadius
    - leadExternalThreadTubeRadius;
  const leadThreadSegmentsPerTurn = 64;
  const leadThreadSegments = Math.ceil(
    leadThreadTurnCount * leadThreadSegmentsPerTurn
  );

  const cutterTopY = 1.45;
  const cutterBottomY = -1.45;
  const cutterTravel = cutterTopY - cutterBottomY;
  const leadScrewTravelRevolutions = cutterTravel / leadScrewLead;
  const leadScrewTravelAngle = leadScrewTravelRevolutions * fullTurn;
  const inputAngularSpeed = 1.55;
  const halfCyclePeriod = leadScrewTravelAngle / inputAngularSpeed;
  const cyclePeriod = halfCyclePeriod * 2;
  const sourceCutterY = 0.15;
  const sourceCutProgress = (
    cutterTopY - sourceCutterY
  ) / cutterTravel;
  const sourceCycleTime = sourceCutProgress * halfCyclePeriod;
  const uniformCutterSpeed = leadPerRadian * inputAngularSpeed;

  const cutThreadPitch = leadScrewLead
    * workGearTeeth / leadGearTeeth;
  const cutThreadWaveNumber = fullTurn / cutThreadPitch;
  const cutThreadTurnCount = cutterTravel / cutThreadPitch;
  const workCoreRadius = 0.235;
  const cutThreadRadius = 0.3;
  const cutThreadTubeRadius = 0.04;
  const futureThreadTubeRadius = 0.018;
  const cutThreadSegmentCount = 72;
  const cutThreadPhase = Math.PI + cutThreadWaveNumber
    * (cutterTopY - cutterBottomY);

  const topRailY = 2.08;
  const bottomRailY = -2.17;
  const railHeight = 0.24;
  const railDepth = 0.5;
  const topRailLength = 2.65;
  const bottomRailLength = 3.02;
  const frameZ = -0.24;
  const shaftRadius = 0.105;
  const shaftLength = 4.62;
  const shaftBearingInnerRadius = shaftRadius + 0.025;
  const shaftBearingOuterRadius = 0.27;
  const shaftBearingLength = 0.24;
  const gearCenterY = -1.91;
  const gearDepth = 0.16;
  const upperCollarY = 1.77;
  const collarRadius = 0.36;
  const collarHeight = 0.11;
  const antiRotationRailZ = -0.44;
  const antiRotationRailWidth = 0.16;
  const antiRotationRailDepth = 0.14;
  const antiRotationRailLength = 3.55;
  const nutLength = 0.38;
  const nutBoreRadius = 0.36;
  const nutOuterRadius = 0.52;
  const nutGuideClearance = 0.025;
  const cutterContactX = workAxisX - cutThreadRadius;
  const cutterTipRadius = 0.07;
  const cutterTipLength = 0.18;

  const sourceThreadOuterDiameter = 42;
  const sourceAxisSpacing = 101;
  const sourceLeadThreadedLength = 227;
  const sourceFrameHeight = 315;
  const sourceTopFrameSpan = 190;
  const sourceCutterFraction = 0.46;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.2,
    roughness: 0.52,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.58,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.48,
  });
  const leadThreadMaterial = matte(0xb64b36, {
    metalness: 0.2,
    roughness: 0.48,
  });
  const cutThreadMaterial = matte(0x183d50, {
    metalness: 0.24,
    roughness: 0.45,
  });
  const futureThreadMaterial = matte(PALETTE.ink, {
    opacity: 0.16,
    roughness: 0.55,
    transparent: true,
  });
  futureThreadMaterial.depthWrite = false;
  const internalThreadMaterial = matte(PALETTE.brass, {
    metalness: 0.3,
    roughness: 0.42,
  });
  const cutterMaterial = matte(PALETTE.brass, {
    metalness: 0.38,
    roughness: 0.4,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const positiveModulo = (value, modulus) => (
    ((value % modulus) + modulus) % modulus
  );
  const angularDistance = (left, right) => Math.abs(Math.atan2(
    Math.sin(left - right),
    Math.cos(left - right),
  ));
  const makeVerticalHelix = ({
    maximumY,
    minimumY,
    phase,
    radius,
    waveNumber,
  }) => new class extends THREE.Curve {
    getPoint(parameter, target = new THREE.Vector3()) {
      const y = minimumY + (maximumY - minimumY) * parameter;
      const angle = phase + waveNumber * (y - minimumY);
      return target.set(
        radius * Math.cos(angle),
        y,
        -radius * Math.sin(angle),
      );
    }
  }();
  const makeVerticalAnnulus = ({
    innerRadius,
    length,
    material,
    outerRadius,
  }) => {
    const annulus = new THREE.Mesh(
      centeredExtrusion(
        planarAnnularShape(innerRadius, outerRadius),
        length,
        0.008,
      ),
      material,
    );
    annulus.rotation.x = Math.PI / 2;
    return annulus;
  };

  const topRail = new THREE.Mesh(
    new THREE.BoxGeometry(topRailLength, railHeight, railDepth),
    frameMaterial,
  );
  topRail.position.set(0, topRailY, frameZ);
  topRail.userData.role = 'fixed-top-frame-supporting-both-vertical-shafts';

  const bottomRail = new THREE.Mesh(
    new THREE.BoxGeometry(bottomRailLength, railHeight, railDepth),
    frameMaterial,
  );
  bottomRail.position.set(0, bottomRailY, frameZ);
  bottomRail.userData.role = 'fixed-bottom-frame-beneath-change-gears';

  const antiRotationRail = new THREE.Mesh(
    new THREE.BoxGeometry(
      antiRotationRailWidth,
      antiRotationRailLength,
      antiRotationRailDepth,
    ),
    frameMaterial,
  );
  antiRotationRail.position.set(
    leadAxisX,
    0,
    antiRotationRailZ,
  );
  antiRotationRail.userData.role = 'fixed-hidden-keyway-preventing-cutter-nut-rotation';

  const leadScrew = new THREE.Group();
  const leadScrewRotor = new THREE.Group();
  leadScrew.position.x = leadAxisX;
  leadScrew.userData.axis = Y_AXIS.clone();
  leadScrew.userData.rotor = leadScrewRotor;
  leadScrew.userData.role = 'left-uniformly-rotating-lead-screw';
  leadScrew.add(leadScrewRotor);

  const leadShaft = cylinderAlongY(
    shaftRadius,
    shaftLength,
    darkMaterial,
    32,
  );
  leadShaft.userData.role = 'lead-screw-shaft-through-fixed-bearings';

  const leadCore = cylinderAlongY(
    leadCoreRadius,
    leadThreadLength + 0.18,
    driverMaterial,
    48,
  );
  leadCore.userData.role = 'solid-core-of-left-lead-screw';

  const leadExternalThreadPhase = -leadWaveNumber
    * (cutterTopY - leadThreadMinimumY);
  const leadExternalThreadCurve = makeVerticalHelix({
    maximumY: leadThreadMaximumY,
    minimumY: leadThreadMinimumY,
    phase: leadExternalThreadPhase,
    radius: leadExternalThreadRadius,
    waveNumber: leadWaveNumber,
  });
  leadExternalThreadCurve.arcLengthDivisions = leadThreadSegments;
  const leadExternalThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      leadExternalThreadCurve,
      leadThreadSegments,
      leadExternalThreadTubeRadius,
      8,
      false,
    ),
    leadThreadMaterial,
  );
  leadExternalThread.userData.role = 'single-start-constant-lead-driver-thread';

  const leadGear = makeGear({
    axis: Y_AXIS,
    color: PALETTE.driver,
    depth: gearDepth,
    radius: leadGearPitchRadius,
    teeth: leadGearTeeth,
    toothHeight: 0.075,
  });
  leadGear.position.y = gearCenterY;
  leadGear.userData.role = 'replaceable-lead-screw-change-gear';

  const leadUpperCollar = cylinderAlongY(
    collarRadius,
    collarHeight,
    driverMaterial,
    42,
  );
  leadUpperCollar.position.y = upperCollarY;
  leadUpperCollar.userData.role = 'upper-collar-fixed-to-lead-screw';

  const leadRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.075, 0.028),
    indexMaterial,
  );
  leadRotationIndex.position.set(
    0,
    upperCollarY,
    collarRadius + 0.015,
  );
  leadRotationIndex.userData.role = 'visible-index-on-lead-screw-collar';
  leadScrewRotor.add(
    leadShaft,
    leadCore,
    leadExternalThread,
    leadGear,
    leadUpperCollar,
    leadRotationIndex,
  );

  const workpiece = new THREE.Group();
  const workpieceRotor = new THREE.Group();
  workpiece.position.x = workAxisX;
  workpiece.userData.axis = Y_AXIS.clone();
  workpiece.userData.rotor = workpieceRotor;
  workpiece.userData.role = 'right-workpiece-rotating-from-change-gears';
  workpiece.add(workpieceRotor);

  const workShaft = cylinderAlongY(
    shaftRadius,
    shaftLength,
    darkMaterial,
    32,
  );
  workShaft.userData.role = 'workpiece-shaft-through-fixed-bearings';

  const workCore = cylinderAlongY(
    workCoreRadius,
    leadThreadLength + 0.18,
    drivenMaterial,
    48,
  );
  workCore.userData.role = 'blank-cylinder-being-cut-by-the-tool';

  const cutThreadCurve = makeVerticalHelix({
    maximumY: cutterTopY,
    minimumY: cutterBottomY,
    phase: cutThreadPhase,
    radius: cutThreadRadius,
    waveNumber: -cutThreadWaveNumber,
  });
  cutThreadCurve.arcLengthDivisions = cutThreadSegmentCount * 4;
  const futureThreadPath = new THREE.Mesh(
    new THREE.TubeGeometry(
      cutThreadCurve,
      cutThreadSegmentCount * 4,
      futureThreadTubeRadius,
      7,
      false,
    ),
    futureThreadMaterial,
  );
  futureThreadPath.userData.role = 'faint-full-path-of-thread-to-be-cut';

  const cutThreadSegments = Array.from(
    { length: cutThreadSegmentCount },
    (_, segmentIndex) => {
      const minimumParameter = segmentIndex / cutThreadSegmentCount;
      const maximumParameter = (segmentIndex + 1) / cutThreadSegmentCount;
      const segmentCurve = new class extends THREE.Curve {
        getPoint(parameter, target = new THREE.Vector3()) {
          return cutThreadCurve.getPoint(
            THREE.MathUtils.lerp(
              minimumParameter,
              maximumParameter,
              parameter,
            ),
            target,
          );
        }
      }();
      const segment = new THREE.Mesh(
        new THREE.TubeGeometry(segmentCurve, 5, cutThreadTubeRadius, 7, false),
        cutThreadMaterial,
      );
      segment.userData.role = 'progressively-revealed-cut-thread-segment';
      segment.userData.segmentIndex = segmentIndex;
      segment.userData.midpointY = cutterBottomY
        + cutterTravel * (segmentIndex + 0.5) / cutThreadSegmentCount;
      return segment;
    },
  );

  const workGear = makeGear({
    axis: Y_AXIS,
    color: PALETTE.driven,
    depth: gearDepth,
    radius: workGearPitchRadius,
    teeth: workGearTeeth,
    toothHeight: 0.075,
  });
  workGear.position.y = gearCenterY;
  workGear.userData.role = 'replaceable-workpiece-change-gear';

  const workUpperCollar = cylinderAlongY(
    collarRadius,
    collarHeight,
    drivenMaterial,
    42,
  );
  workUpperCollar.position.y = upperCollarY;
  workUpperCollar.userData.role = 'upper-collar-fixed-to-workpiece';

  const workRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.075, 0.028),
    indexMaterial,
  );
  workRotationIndex.position.set(
    0,
    upperCollarY,
    collarRadius + 0.015,
  );
  workRotationIndex.userData.role = 'visible-index-on-workpiece-collar';
  workpieceRotor.add(
    workShaft,
    workCore,
    futureThreadPath,
    ...cutThreadSegments,
    workGear,
    workUpperCollar,
    workRotationIndex,
  );

  const shaftBearings = [
    { axisX: leadAxisX, member: 'lead-screw', side: 'lower', y: bottomRailY },
    { axisX: leadAxisX, member: 'lead-screw', side: 'upper', y: topRailY },
    { axisX: workAxisX, member: 'workpiece', side: 'lower', y: bottomRailY },
    { axisX: workAxisX, member: 'workpiece', side: 'upper', y: topRailY },
  ].map(({ axisX, member, side, y }) => {
    const bearing = makeVerticalAnnulus({
      innerRadius: shaftBearingInnerRadius,
      length: shaftBearingLength,
      material: frameMaterial,
      outerRadius: shaftBearingOuterRadius,
    });
    bearing.position.set(axisX, y, 0);
    bearing.userData.role = 'fixed-bored-bearing-for-screw-cutting-shaft';
    bearing.userData.member = member;
    bearing.userData.side = side;
    return bearing;
  });

  const cutterCarriage = new THREE.Group();
  cutterCarriage.userData.role = 'nonrotating-threaded-cutter-carriage';

  const carriageNut = makeVerticalAnnulus({
    innerRadius: nutBoreRadius,
    length: nutLength,
    material: drivenMaterial,
    outerRadius: nutOuterRadius,
  });
  carriageNut.position.x = leadAxisX;
  carriageNut.userData.role = 'bored-cutter-nut-surrounding-left-lead-screw';

  const leadInternalThreadCurve = makeVerticalHelix({
    maximumY: nutLength / 2,
    minimumY: -nutLength / 2,
    phase: -leadWaveNumber * nutLength / 2,
    radius: leadInternalThreadRadius,
    waveNumber: leadWaveNumber,
  });
  const leadInternalThreadSegments = Math.ceil(
    nutLength / leadScrewPitch * leadThreadSegmentsPerTurn
  );
  const leadInternalThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      leadInternalThreadCurve,
      leadInternalThreadSegments,
      leadInternalThreadTubeRadius,
      7,
      false,
    ),
    internalThreadMaterial,
  );
  leadInternalThread.position.x = leadAxisX;
  leadInternalThread.userData.role = 'matching-internal-thread-in-cutter-nut';

  const cutterArm = makeBeam(
    new THREE.Vector3(leadAxisX + nutOuterRadius * 0.55, 0, 0),
    new THREE.Vector3(cutterContactX - cutterTipLength - 0.05, 0, 0),
    {
      color: PALETTE.driven,
      depth: 0.2,
      thickness: 0.17,
    },
  );
  cutterArm.userData.role = 'rigid-horizontal-arm-from-nut-to-cutter';

  const cutterHolder = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.25, 0.24),
    darkMaterial,
  );
  cutterHolder.position.x = cutterContactX - cutterTipLength - 0.11;
  cutterHolder.userData.role = 'tool-holder-on-translating-carriage';

  const cutterTip = new THREE.Mesh(
    new THREE.ConeGeometry(cutterTipRadius, cutterTipLength, 24),
    cutterMaterial,
  );
  cutterTip.position.x = cutterContactX - cutterTipLength / 2;
  cutterTip.rotation.z = -Math.PI / 2;
  cutterTip.userData.role = 'single-point-cutter-at-workpiece-thread-path';
  cutterTip.userData.contactPointLocal = new THREE.Vector3(
    0,
    cutterTipLength / 2,
    0,
  );

  const antiRotationShoe = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.22, 0.2),
    drivenMaterial,
  );
  antiRotationShoe.position.set(
    leadAxisX,
    0,
    antiRotationRailZ + antiRotationRailDepth / 2
      + nutGuideClearance + 0.1,
  );
  antiRotationShoe.userData.role = 'carriage-shoe-sliding-on-hidden-fixed-keyway';

  const cutterTranslationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.16, 0.035),
    indexMaterial,
  );
  cutterTranslationIndex.position.set(
    leadAxisX - nutOuterRadius * 0.42,
    0,
    nutOuterRadius + 0.03,
  );
  cutterTranslationIndex.userData.role = 'fixed-orientation-index-on-cutter-carriage';
  cutterCarriage.add(
    carriageNut,
    leadInternalThread,
    cutterArm,
    cutterHolder,
    cutterTip,
    antiRotationShoe,
    cutterTranslationIndex,
  );

  root.add(
    topRail,
    bottomRail,
    antiRotationRail,
    ...shaftBearings,
    leadScrew,
    workpiece,
    cutterCarriage,
  );

  const motionAtTime = (time) => {
    const cycleTime = positiveModulo(time + sourceCycleTime, cyclePeriod);
    const atTopReversal = Math.min(
      cycleTime,
      cyclePeriod - cycleTime,
    ) < 1e-10;
    const atBottomReversal = Math.abs(
      cycleTime - halfCyclePeriod
    ) < 1e-10;
    const cuttingPass = atTopReversal
      || (!atBottomReversal && cycleTime < halfCyclePeriod);
    const leadScrewAngle = atTopReversal
      ? 0
      : atBottomReversal
        ? leadScrewTravelAngle
        : cuttingPass
          ? inputAngularSpeed * cycleTime
          : inputAngularSpeed * (cyclePeriod - cycleTime);
    const leadScrewAngularSpeed = cuttingPass
      ? inputAngularSpeed
      : -inputAngularSpeed;
    const stage = atTopReversal
      ? 'top-instantaneous-change-gear-reversal'
      : atBottomReversal
        ? 'bottom-instantaneous-change-gear-reversal'
        : cuttingPass
          ? 'uniform-downward-screw-cutting-pass'
          : 'uniform-upward-thread-retracing-pass';
    return {
      atBottomReversal,
      atTopReversal,
      cuttingPass,
      cycleTime,
      leadScrewAngle,
      leadScrewAngularSpeed,
      phase: cycleTime / cyclePeriod,
      stage,
    };
  };

  const stateAtLeadScrewAngle = (
    leadScrewAngle,
    leadScrewAngularSpeed = inputAngularSpeed,
    stage = 'angle-query',
  ) => {
    const cutterY = cutterTopY - leadPerRadian * leadScrewAngle;
    const cutterVelocityY = -leadPerRadian * leadScrewAngularSpeed;
    const workpieceAngle = workToLeadAngularRatio * leadScrewAngle;
    const workpieceAngularSpeed = workToLeadAngularRatio
      * leadScrewAngularSpeed;
    const cuttingPass = leadScrewAngularSpeed > 0;
    const atTopReversal = Math.abs(leadScrewAngle) < 1e-10;
    const atBottomReversal = Math.abs(
      leadScrewAngle - leadScrewTravelAngle
    ) < 1e-10;
    const atEndReversal = atTopReversal || atBottomReversal;
    const cutProgress = THREE.MathUtils.clamp(
      (cutterTopY - cutterY) / cutterTravel,
      0,
      1,
    );
    const visibleCutFraction = cuttingPass ? cutProgress : 1;

    const leadSelectedLocalAngle = leadExternalThreadPhase
      + leadWaveNumber * (cutterY - leadThreadMinimumY);
    const leadContactLocalAngle = -leadScrewAngle;
    const leadThreadPhaseError = angularDistance(
      leadSelectedLocalAngle,
      leadContactLocalAngle,
    );
    const leadThreadContactPoint = new THREE.Vector3(
      leadAxisX + leadThreadPitchRadius,
      cutterY,
      0,
    );
    const leadSurfaceVelocity = new THREE.Vector3(
      0,
      0,
      -leadScrewAngularSpeed * leadThreadPitchRadius,
    );
    const cutterVelocity = new THREE.Vector3(0, cutterVelocityY, 0);
    const relativeLeadThreadVelocity = cutterVelocity.clone()
      .sub(leadSurfaceVelocity);
    const leadThreadTangent = new THREE.Vector3(
      0,
      1,
      -leadThreadPitchRadius * leadWaveNumber,
    ).normalize();
    const leadRadialNormal = X_AXIS.clone();
    const leadFlankNormal = new THREE.Vector3().crossVectors(
      leadRadialNormal,
      leadThreadTangent,
    ).normalize();

    const cutSelectedLocalAngle = cutThreadPhase
      - cutThreadWaveNumber * (cutterY - cutterBottomY);
    const cutContactLocalAngle = Math.PI - workpieceAngle;
    const cutThreadPhaseError = angularDistance(
      cutSelectedLocalAngle,
      cutContactLocalAngle,
    );
    const cutterContactPoint = new THREE.Vector3(
      cutterContactX,
      cutterY,
      0,
    );
    const workSurfaceVelocity = new THREE.Vector3(
      0,
      0,
      workpieceAngularSpeed * cutThreadRadius,
    );
    const relativeCuttingVelocity = cutterVelocity.clone()
      .sub(workSurfaceVelocity);
    const cutThreadTangent = new THREE.Vector3(
      0,
      1,
      -cutThreadRadius * cutThreadWaveNumber,
    ).normalize();
    const cutRadialNormal = new THREE.Vector3(-1, 0, 0);
    const cutFlankNormal = new THREE.Vector3().crossVectors(
      cutRadialNormal,
      cutThreadTangent,
    ).normalize();
    const gearPitchContactPoint = new THREE.Vector3(0, gearCenterY, 0);
    const gearTangentialVelocityError = leadScrewAngularSpeed
      * leadGearPitchRadius + workpieceAngularSpeed
        * workGearPitchRadius;
    const gearMeshPhaseError = leadGearTeeth * leadScrewAngle
      + workGearTeeth * workpieceAngle;
    return {
      atBottomReversal,
      atEndReversal,
      atTopReversal,
      cutFlankNormal,
      cutFlankNormalVelocityError: relativeCuttingVelocity.dot(
        cutFlankNormal
      ),
      cutProgress,
      cutRadialNormal,
      cutRadialNormalVelocityError: relativeCuttingVelocity.dot(
        cutRadialNormal
      ),
      cutThreadPhaseError,
      cutThreadPitch,
      cutThreadSlidingSpeed: relativeCuttingVelocity.dot(cutThreadTangent),
      cutThreadTangent,
      cutterContactPoint,
      cutterRotation: 0,
      cutterVelocity,
      cutterVelocityY,
      cutterY,
      cuttingPass,
      gearMeshPhaseError,
      gearPitchContactPoint,
      gearTangentialVelocityError,
      leadFlankNormal,
      leadRadialNormal,
      leadScrewAngle,
      leadScrewAngularSpeed,
      leadScrewAxialDisplacement: 0,
      leadSurfaceVelocity,
      leadThreadContactPoint,
      leadThreadFlankNormalVelocityError: relativeLeadThreadVelocity.dot(
        leadFlankNormal
      ),
      leadThreadPhaseError,
      leadThreadRadialNormalVelocityError: relativeLeadThreadVelocity.dot(
        leadRadialNormal
      ),
      leadThreadSlidingSpeed: relativeLeadThreadVelocity.dot(
        leadThreadTangent
      ),
      leadThreadTangent,
      relativeCuttingVelocity,
      relativeLeadThreadVelocity,
      stage,
      visibleCutFraction,
      workSurfaceVelocity,
      workpieceAngle,
      workpieceAngularSpeed,
    };
  };

  const stateAtTime = (time) => {
    const motion = motionAtTime(time);
    return {
      ...stateAtLeadScrewAngle(
        motion.leadScrewAngle,
        motion.leadScrewAngularSpeed,
        motion.stage,
      ),
      atBottomReversal: motion.atBottomReversal,
      atTopReversal: motion.atTopReversal,
      cycleTime: motion.cycleTime,
      phase: motion.phase,
    };
  };

  root.userData.mechanism = 'change-gear-coupled-leadscrew-thread-cutting-frame';
  root.userData.cameraDistanceScale = 1.07;
  root.userData.blocks = {
    antiRotationRail,
    antiRotationShoe,
    bottomRail,
    carriageNut,
    cutThreadSegments,
    cutterArm,
    cutterCarriage,
    cutterHolder,
    cutterTip,
    cutterTranslationIndex,
    futureThreadPath,
    leadCore,
    leadExternalThread,
    leadGear,
    leadInternalThread,
    leadRotationIndex,
    leadScrew,
    leadScrewRotor,
    leadShaft,
    leadUpperCollar,
    shaftBearings,
    topRail,
    workCore,
    workGear,
    workpiece,
    workpieceRotor,
    workRotationIndex,
    workShaft,
    workUpperCollar,
  };
  root.userData.curves = {
    cutThread: cutThreadCurve,
    leadExternalThread: leadExternalThreadCurve,
    leadInternalThread: leadInternalThreadCurve,
  };
  root.userData.geometry = {
    antiRotationRailDepth,
    antiRotationRailLength,
    antiRotationRailWidth,
    antiRotationRailZ,
    axisSpacing,
    bottomRailLength,
    bottomRailY,
    collarHeight,
    collarRadius,
    cutThreadPhase,
    cutThreadPitch,
    cutThreadRadius,
    cutThreadSegmentCount,
    cutThreadTubeRadius,
    cutThreadTurnCount,
    cutThreadWaveNumber,
    cutterBottomY,
    cutterContactX,
    cutterTipLength,
    cutterTipRadius,
    cutterTopY,
    cutterTravel,
    cyclePeriod,
    frameZ,
    fullTurn,
    futureThreadTubeRadius,
    gearCenterY,
    gearDepth,
    gearModule,
    halfCyclePeriod,
    inputAngularSpeed,
    leadAxisX,
    leadCoreRadius,
    leadExternalThreadPhase,
    leadExternalThreadRadius,
    leadExternalThreadTubeRadius,
    leadGearPitchRadius,
    leadGearTeeth,
    leadInternalThreadRadius,
    leadInternalThreadSegments,
    leadInternalThreadTubeRadius,
    leadPerRadian,
    leadScrewLead,
    leadScrewPitch,
    leadScrewTravelAngle,
    leadScrewTravelRevolutions,
    leadThreadLength,
    leadThreadMaximumY,
    leadThreadMinimumY,
    leadThreadPitchRadius,
    leadThreadRadialClearance,
    leadThreadSegments,
    leadThreadSegmentsPerTurn,
    leadThreadTurnCount,
    leadWaveNumber,
    nutBoreRadius,
    nutGuideClearance,
    nutLength,
    nutOuterRadius,
    railDepth,
    railHeight,
    shaftBearingInnerRadius,
    shaftBearingLength,
    shaftBearingOuterRadius,
    shaftLength,
    shaftRadius,
    sourceAxisSpacing,
    sourceCutterFraction,
    sourceCutterY,
    sourceCutProgress,
    sourceCycleTime,
    sourceFrameHeight,
    sourceLeadThreadedLength,
    sourceThreadOuterDiameter,
    sourceTopFrameSpan,
    topRailLength,
    topRailY,
    uniformCutterSpeed,
    upperCollarY,
    workAxisX,
    workCoreRadius,
    workGearPitchRadius,
    workGearTeeth,
    workToLeadAngularRatio,
  };
  root.userData.motionAtTime = motionAtTime;
  root.userData.stateAtLeadScrewAngle = stateAtLeadScrewAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    leadScrewRotor.rotation.set(0, state.leadScrewAngle, 0);
    leadScrew.userData.angularSpeed = state.leadScrewAngularSpeed;
    workpieceRotor.rotation.set(0, state.workpieceAngle, 0);
    workpiece.userData.angularSpeed = state.workpieceAngularSpeed;
    cutterCarriage.position.set(0, state.cutterY, 0);
    cutterCarriage.rotation.set(0, 0, 0);
    cutterCarriage.userData.velocity = state.cutterVelocity.clone();
    for (const segment of cutThreadSegments) {
      segment.visible = !state.cuttingPass
        || segment.userData.midpointY >= state.cutterY;
    }
    root.userData.contacts = {
      changeGears: {
        centerDistanceError: Math.abs(workAxisX - leadAxisX)
          - leadGearPitchRadius - workGearPitchRadius,
        driverTeeth: leadGearTeeth,
        drivenTeeth: workGearTeeth,
        meshPhaseError: state.gearMeshPhaseError,
        pitchContactPoint: state.gearPitchContactPoint.clone(),
        ratio: workToLeadAngularRatio,
        tangentialVelocityError: state.gearTangentialVelocityError,
      },
      cutThread: {
        contactPoint: state.cutterContactPoint.clone(),
        flankNormal: state.cutFlankNormal.clone(),
        flankNormalVelocityError: state.cutFlankNormalVelocityError,
        phaseConstraintError: state.cutThreadPhaseError,
        pitch: cutThreadPitch,
        pitchFromChangeGears: leadScrewLead
          * workGearTeeth / leadGearTeeth,
        radialNormal: state.cutRadialNormal.clone(),
        radialNormalVelocityError: state.cutRadialNormalVelocityError,
        slidingSpeed: state.cutThreadSlidingSpeed,
        tangent: state.cutThreadTangent.clone(),
        visibleFraction: state.visibleCutFraction,
      },
      cutterGuide: {
        axis: Y_AXIS.clone(),
        lateralClearance: nutGuideClearance,
        lineError: Math.hypot(
          cutterCarriage.position.x,
          cutterCarriage.position.z,
        ),
        rotationError: 0,
      },
      cutterTip: {
        centerError: new THREE.Vector3(
          cutterContactX,
          cutterCarriage.position.y,
          0,
        ).distanceTo(state.cutterContactPoint),
        engaged: true,
      },
      leadThread: {
        contactPoint: state.leadThreadContactPoint.clone(),
        flankNormal: state.leadFlankNormal.clone(),
        flankNormalVelocityError: state.leadThreadFlankNormalVelocityError,
        lead: leadScrewLead,
        phaseConstraintError: state.leadThreadPhaseError,
        radialClearance: leadThreadRadialClearance,
        radialNormal: state.leadRadialNormal.clone(),
        radialNormalVelocityError: state.leadThreadRadialNormalVelocityError,
        singleStart: true,
        slidingSpeed: state.leadThreadSlidingSpeed,
        tangent: state.leadThreadTangent.clone(),
      },
      shaftBearings: {
        axis: Y_AXIS.clone(),
        count: shaftBearings.length,
        radialClearance: shaftBearingInnerRadius - shaftRadius,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(7.2, 3.7, 11.4));
}

function selectableHalfNutTraverseMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const rollerAxisY = 0.9;
  const spindleAxisY = -1.2;
  const axisSpacing = rollerAxisY - spindleAxisY;
  const rollerShaftRadius = 0.105;
  const rollerShaftLength = 6.35;
  const rollerCoreRadius = 0.28;
  const rollerCoreMinimumX = -2.36;
  const rollerCoreMaximumX = 2.36;
  const rollerCoreLength = rollerCoreMaximumX - rollerCoreMinimumX;
  const threadLead = 0.15;
  const threadWaveNumber = fullTurn / threadLead;
  const threadCenterRadius = 0.36;
  const externalThreadTubeRadius = 0.025;
  const leftThreadMinimumX = -2.28;
  const leftThreadMaximumX = -0.28;
  const rightThreadMinimumX = 0.28;
  const rightThreadMaximumX = 2.28;
  const threadHalfLength = leftThreadMaximumX - leftThreadMinimumX;
  const threadHalfTurnCount = threadHalfLength / threadLead;
  const threadSegmentsPerTurn = 48;
  const threadSegments = Math.ceil(
    threadHalfTurnCount * threadSegmentsPerTurn
  );

  const supportX = 2.72;
  const supportThickness = 0.68;
  const supportMinimumY = -1.75;
  const supportMaximumY = 1.75;
  const supportHalfDepth = 0.52;
  const rollerBearingInnerRadius = rollerShaftRadius + 0.025;
  const rollerBearingOuterRadius = 0.25;
  const spindleRadius = 0.13;
  const spindleBearingInnerRadius = spindleRadius + 0.025;
  const spindleBearingOuterRadius = 0.27;
  const bearingTubeRadius = 0.055;

  const carriageMinimumX = -0.45;
  const carriageMaximumX = 0.45;
  const carriageTravel = carriageMaximumX - carriageMinimumX;
  const leftArmOffsetX = -1.42;
  const rightArmOffsetX = 1.42;
  const armSpacing = rightArmOffsetX - leftArmOffsetX;
  const spindleLength = 7.95;
  const spindleCenterX = 0.43;
  const selectorAngle = 0.22;
  const halfNutLength = 0.44;
  const halfNutInnerRadius = 0.435;
  const halfNutOuterRadius = 0.56;
  const halfNutAngularHalfSpan = Math.PI * 0.43;
  const internalThreadRadius = 0.405;
  const internalThreadTubeRadius = 0.018;
  const armThickness = 0.18;
  const armDepth = 0.18;
  const threadPitchRadius = (
    threadCenterRadius + externalThreadTubeRadius
      + internalThreadRadius - internalThreadTubeRadius
  ) / 2;
  const threadRadialClearance = internalThreadRadius
    - internalThreadTubeRadius
    - threadCenterRadius
    - externalThreadTubeRadius;
  const selectorLeverX = 4.0;
  const selectorLeverHalfLength = 0.92;
  const leftArmCenterlineClearance = axisSpacing * halfNutOuterRadius
    * Math.sin(halfNutAngularHalfSpan) / Math.hypot(
      axisSpacing + halfNutOuterRadius * Math.cos(halfNutAngularHalfSpan),
      halfNutOuterRadius * Math.sin(halfNutAngularHalfSpan),
    );
  const leftArmSurfaceClearance = leftArmCenterlineClearance
    - Math.max(armThickness, armDepth) / 2
    - threadCenterRadius - externalThreadTubeRadius;
  const rightArmSurfaceClearance = halfNutOuterRadius - 0.03
    - armThickness / 2
    - threadCenterRadius - externalThreadTubeRadius;

  const inputAngularSpeed = 4;
  const traverseInputAngle = carriageTravel / threadLead * fullTurn;
  const traverseInputRevolutions = traverseInputAngle / fullTurn;
  const selectorShiftInputAngle = fullTurn;
  const firstShiftStartAngle = traverseInputAngle;
  const rightTraverseStartAngle = firstShiftStartAngle
    + selectorShiftInputAngle;
  const secondShiftStartAngle = rightTraverseStartAngle
    + traverseInputAngle;
  const cycleInputAngle = secondShiftStartAngle
    + selectorShiftInputAngle;
  const cycleInputRevolutions = cycleInputAngle / fullTurn;
  const cyclePeriod = cycleInputAngle / inputAngularSpeed;
  const sourceInputAngle = traverseInputAngle / 2;
  const sourceCycleTime = sourceInputAngle / inputAngularSpeed;
  const uniformTraverseSpeed = threadLead / fullTurn * inputAngularSpeed;

  const leftThreadHand = 1;
  const rightThreadHand = -1;
  const upperContactAngle = 0;
  const lowerContactAngle = Math.PI;
  const leftThreadPhase = -threadWaveNumber
    * (carriageMaximumX + leftArmOffsetX);
  const rightThreadPhase = lowerContactAngle
    + threadWaveNumber * (carriageMinimumX + rightArmOffsetX)
    - rightTraverseStartAngle;

  const sourceSupportSpacing = 306;
  const sourceThreadHalfLength = 110;
  const sourceAxisSpacing = 119;
  const sourceSupportHeight = 199;
  const sourceArmSpacing = 161;
  const sourceSupportThickness = 39;
  const sourceSpindleExtension = 54;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.19,
    roughness: 0.5,
  });
  const driverThreadMaterial = matte(0xb64b36, {
    metalness: 0.23,
    roughness: 0.45,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.17,
    roughness: 0.56,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.48,
  });
  const halfNutMaterial = matte(PALETTE.brass, {
    metalness: 0.31,
    roughness: 0.42,
  });
  const internalThreadMaterial = matte(0x72501f, {
    metalness: 0.34,
    roughness: 0.39,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const positiveModulo = (value, modulus) => (
    ((value % modulus) + modulus) % modulus
  );
  const smootherStep = (value) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return clamped ** 3 * (
      clamped * (clamped * 6 - 15) + 10
    );
  };
  const smootherStepDerivative = (value) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return 30 * clamped ** 2 * (1 - clamped) ** 2;
  };
  const angularDistance = (left, right) => Math.abs(Math.atan2(
    Math.sin(left - right),
    Math.cos(left - right),
  ));
  const makeSignedHorizontalHelix = ({
    hand,
    maximumX,
    minimumX,
    phase,
    radius,
  }) => new class extends THREE.Curve {
    getPoint(parameter, target = new THREE.Vector3()) {
      const x = THREE.MathUtils.lerp(minimumX, maximumX, parameter);
      const angle = phase + hand * threadWaveNumber * x;
      return target.set(
        x,
        radius * Math.cos(angle),
        radius * Math.sin(angle),
      );
    }
  }();
  const makeSupportShape = () => {
    const shape = new THREE.Shape();
    shape.moveTo(-supportHalfDepth, supportMinimumY);
    shape.lineTo(supportHalfDepth, supportMinimumY);
    shape.lineTo(supportHalfDepth, supportMaximumY);
    shape.lineTo(-supportHalfDepth, supportMaximumY);
    shape.closePath();
    for (const { y, radius } of [
      { y: rollerAxisY, radius: rollerBearingInnerRadius },
      { y: spindleAxisY, radius: spindleBearingInnerRadius },
    ]) {
      const bore = new THREE.Path();
      bore.absarc(0, y, radius, 0, fullTurn, true);
      bore.closePath();
      shape.holes.push(bore);
    }
    return shape;
  };
  const makeHalfNutBody = (centerAngle, side) => {
    const shape = new THREE.Shape();
    const segmentCount = 36;
    const minimumAngle = centerAngle - halfNutAngularHalfSpan;
    const maximumAngle = centerAngle + halfNutAngularHalfSpan;
    for (let index = 0; index <= segmentCount; index += 1) {
      const angle = THREE.MathUtils.lerp(
        minimumAngle,
        maximumAngle,
        index / segmentCount,
      );
      const shapeX = -halfNutOuterRadius * Math.sin(angle);
      const shapeY = halfNutOuterRadius * Math.cos(angle);
      if (index === 0) shape.moveTo(shapeX, shapeY);
      else shape.lineTo(shapeX, shapeY);
    }
    for (let index = segmentCount; index >= 0; index -= 1) {
      const angle = THREE.MathUtils.lerp(
        minimumAngle,
        maximumAngle,
        index / segmentCount,
      );
      shape.lineTo(
        -halfNutInnerRadius * Math.sin(angle),
        halfNutInnerRadius * Math.cos(angle),
      );
    }
    shape.closePath();
    const body = new THREE.Mesh(
      centeredExtrusion(shape, halfNutLength, 0.008),
      halfNutMaterial,
    );
    body.rotation.y = Math.PI / 2;
    body.userData.role = 'real-concave-threaded-half-nut-body';
    body.userData.side = side;
    body.userData.boreRadius = halfNutInnerRadius;
    body.userData.angularSpan = halfNutAngularHalfSpan * 2;
    body.userData.centerAngle = centerAngle;
    return body;
  };
  const makeInternalThreadSegments = ({ centerAngle, hand, side }) => {
    const ridgeHalfWidth = halfNutAngularHalfSpan
      / threadWaveNumber * 0.92;
    const segments = [];
    const curves = [];
    for (let turnIndex = -2; turnIndex <= 2; turnIndex += 1) {
      const centerX = turnIndex * threadLead;
      const minimumX = Math.max(
        -halfNutLength / 2,
        centerX - ridgeHalfWidth,
      );
      const maximumX = Math.min(
        halfNutLength / 2,
        centerX + ridgeHalfWidth,
      );
      if (maximumX - minimumX < 0.006) continue;
      const curve = new class extends THREE.Curve {
        getPoint(parameter, target = new THREE.Vector3()) {
          const x = THREE.MathUtils.lerp(minimumX, maximumX, parameter);
          const angle = centerAngle + hand * threadWaveNumber * x;
          return target.set(
            x,
            internalThreadRadius * Math.cos(angle),
            internalThreadRadius * Math.sin(angle),
          );
        }
      }();
      curve.arcLengthDivisions = 24;
      const ridge = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 18, internalThreadTubeRadius, 7, false),
        internalThreadMaterial,
      );
      ridge.userData.role = 'clipped-helical-ridge-inside-half-nut';
      ridge.userData.side = side;
      ridge.userData.turnIndex = turnIndex;
      segments.push(ridge);
      curves.push(curve);
    }
    return {
      contactCurve: curves.find((_, index) => (
        segments[index].userData.turnIndex === 0
      )),
      curves,
      segments,
    };
  };

  const supports = [-1, 1].map((sideSign) => {
    const support = new THREE.Mesh(
      centeredExtrusion(makeSupportShape(), supportThickness, 0.018),
      frameMaterial,
    );
    support.rotation.y = Math.PI / 2;
    support.position.x = sideSign * supportX;
    support.userData.role = 'fixed-source-upright-with-two-real-shaft-bores';
    support.userData.side = sideSign < 0 ? 'left' : 'right';
    return support;
  });

  const rollerBearings = [-1, 1].map((sideSign) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(
        (rollerBearingInnerRadius + rollerBearingOuterRadius) / 2,
        bearingTubeRadius,
        10,
        44,
      ),
      darkMaterial,
    );
    bearing.rotation.y = Math.PI / 2;
    bearing.position.set(sideSign * supportX, rollerAxisY, 0);
    bearing.userData.role = 'fixed-bored-bearing-for-threaded-roller';
    bearing.userData.side = sideSign < 0 ? 'left' : 'right';
    return bearing;
  });

  const spindleBearings = [-1, 1].map((sideSign) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(
        (spindleBearingInnerRadius + spindleBearingOuterRadius) / 2,
        bearingTubeRadius,
        10,
        44,
      ),
      darkMaterial,
    );
    bearing.rotation.y = Math.PI / 2;
    bearing.position.set(sideSign * supportX, spindleAxisY, 0);
    bearing.userData.role = 'fixed-bored-guide-for-translating-rockshaft';
    bearing.userData.side = sideSign < 0 ? 'left' : 'right';
    return bearing;
  });

  const roller = new THREE.Group();
  roller.position.y = rollerAxisY;
  roller.userData.axis = X_AXIS.clone();
  roller.userData.role = 'uniformly-rotating-opposite-hand-threaded-roller';
  const rollerRotor = new THREE.Group();
  roller.add(rollerRotor);
  roller.userData.rotor = rollerRotor;

  const rollerShaft = cylinderAlongX(
    rollerShaftRadius,
    rollerShaftLength,
    darkMaterial,
    32,
  );
  rollerShaft.userData.role = 'roller-shaft-through-both-fixed-uprights';

  const rollerCore = cylinderAlongX(
    rollerCoreRadius,
    rollerCoreLength,
    driverMaterial,
    48,
  );
  rollerCore.userData.role = 'single-core-divided-into-two-threaded-halves';

  const leftThreadCurve = makeSignedHorizontalHelix({
    hand: leftThreadHand,
    maximumX: leftThreadMaximumX,
    minimumX: leftThreadMinimumX,
    phase: leftThreadPhase,
    radius: threadCenterRadius,
  });
  leftThreadCurve.arcLengthDivisions = threadSegments;
  const leftThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      leftThreadCurve,
      threadSegments,
      externalThreadTubeRadius,
      7,
      false,
    ),
    driverThreadMaterial,
  );
  leftThread.userData.role = 'left-half-positive-hand-fine-thread';
  leftThread.userData.hand = leftThreadHand;

  const rightThreadCurve = makeSignedHorizontalHelix({
    hand: rightThreadHand,
    maximumX: rightThreadMaximumX,
    minimumX: rightThreadMinimumX,
    phase: rightThreadPhase,
    radius: threadCenterRadius,
  });
  rightThreadCurve.arcLengthDivisions = threadSegments;
  const rightThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      rightThreadCurve,
      threadSegments,
      externalThreadTubeRadius,
      7,
      false,
    ),
    driverThreadMaterial,
  );
  rightThread.userData.role = 'right-half-negative-hand-fine-thread';
  rightThread.userData.hand = rightThreadHand;

  const rollerEndCollars = [-1, 1].map((sideSign) => {
    const collar = cylinderAlongX(0.43, 0.11, driverMaterial, 42);
    collar.position.x = sideSign * 2.34;
    collar.userData.role = 'roller-thrust-collar-inside-fixed-upright';
    collar.userData.side = sideSign < 0 ? 'left' : 'right';
    return collar;
  });

  const rollerRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.12, 0.04),
    indexMaterial,
  );
  rollerRotationIndex.position.set(
    0,
    rollerCoreRadius + 0.055,
    0,
  );
  rollerRotationIndex.userData.role = 'white-index-on-plain-center-of-roller';
  rollerRotor.add(
    rollerShaft,
    rollerCore,
    leftThread,
    rightThread,
    ...rollerEndCollars,
    rollerRotationIndex,
  );

  const selectorCarriage = new THREE.Group();
  selectorCarriage.userData.role = 'axially-translating-half-nut-spindle';
  const selectorRotor = new THREE.Group();
  selectorRotor.position.y = spindleAxisY;
  selectorRotor.userData.axis = X_AXIS.clone();
  selectorRotor.userData.role = 'lever-rocked-selector-spindle-and-arms';
  selectorCarriage.add(selectorRotor);

  const selectorShaft = cylinderAlongX(
    spindleRadius,
    spindleLength,
    drivenMaterial,
    36,
  );
  selectorShaft.position.x = spindleCenterX;
  selectorShaft.userData.role = 'sliding-rockshaft-through-both-lower-bores';

  const leftHalfNutCenterLocal = new THREE.Vector3(
    0,
    axisSpacing,
    0,
  ).applyAxisAngle(X_AXIS, selectorAngle);
  const rightHalfNutCenterLocal = new THREE.Vector3(
    0,
    axisSpacing,
    0,
  ).applyAxisAngle(X_AXIS, -selectorAngle);

  const leftArm = new THREE.Group();
  leftArm.userData.role = 'arm-carrying-upper-left-half-nut';
  const leftArmAttachmentLocal = new THREE.Vector3(
    0,
    axisSpacing + halfNutOuterRadius
      * Math.cos(halfNutAngularHalfSpan),
    halfNutOuterRadius * Math.sin(halfNutAngularHalfSpan),
  ).applyAxisAngle(X_AXIS, selectorAngle);
  leftArmAttachmentLocal.x = leftArmOffsetX;
  const leftArmSegments = [makeBeam(
    new THREE.Vector3(leftArmOffsetX, 0, 0),
    leftArmAttachmentLocal,
    { color: PALETTE.driven, depth: armDepth, thickness: armThickness },
  )];
  for (const [index, segment] of leftArmSegments.entries()) {
    segment.userData.role = 'side-attached-arm-clearing-the-roller';
    segment.userData.segment = index;
  }
  leftArm.add(...leftArmSegments);

  const rightArm = new THREE.Group();
  rightArm.userData.role = 'arm-carrying-lower-right-half-nut';
  const rightArmAttachmentLocal = new THREE.Vector3(
    0,
    axisSpacing - halfNutOuterRadius + 0.03,
    0,
  ).applyAxisAngle(X_AXIS, -selectorAngle);
  rightArmAttachmentLocal.x = rightArmOffsetX;
  const rightArmSegments = [makeBeam(
    new THREE.Vector3(rightArmOffsetX, 0, 0),
    rightArmAttachmentLocal,
    { color: PALETTE.driven, depth: armDepth, thickness: armThickness },
  )];
  rightArmSegments[0].userData.role = 'direct-arm-to-lower-half-nut-crown';
  rightArm.add(...rightArmSegments);

  const armBaseCollars = [leftArmOffsetX, rightArmOffsetX].map((x, index) => {
    const collar = cylinderAlongX(0.28, 0.34, drivenMaterial, 36);
    collar.position.x = x;
    collar.userData.role = 'arm-base-fixed-to-translating-rockshaft';
    collar.userData.side = index === 0 ? 'left' : 'right';
    return collar;
  });

  const leftHalfNut = new THREE.Group();
  leftHalfNut.position.set(
    leftArmOffsetX,
    leftHalfNutCenterLocal.y,
    leftHalfNutCenterLocal.z,
  );
  leftHalfNut.rotation.x = selectorAngle;
  leftHalfNut.userData.role = 'upper-half-nut-for-left-thread-hand';
  const leftHalfNutBody = makeHalfNutBody(
    upperContactAngle,
    'left-upper',
  );
  const leftInternal = makeInternalThreadSegments({
    centerAngle: upperContactAngle,
    hand: leftThreadHand,
    side: 'left-upper',
  });
  const leftContactIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 18, 12),
    indexMaterial,
  );
  leftContactIndex.position.y = halfNutOuterRadius + 0.035;
  leftContactIndex.userData.role = 'visible-selected-upper-half-nut-index';
  leftHalfNut.add(
    leftHalfNutBody,
    ...leftInternal.segments,
    leftContactIndex,
  );

  const rightHalfNut = new THREE.Group();
  rightHalfNut.position.set(
    rightArmOffsetX,
    rightHalfNutCenterLocal.y,
    rightHalfNutCenterLocal.z,
  );
  rightHalfNut.rotation.x = -selectorAngle;
  rightHalfNut.userData.role = 'lower-half-nut-for-right-thread-hand';
  const rightHalfNutBody = makeHalfNutBody(
    lowerContactAngle,
    'right-lower',
  );
  const rightInternal = makeInternalThreadSegments({
    centerAngle: lowerContactAngle,
    hand: rightThreadHand,
    side: 'right-lower',
  });
  const rightContactIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 18, 12),
    indexMaterial,
  );
  rightContactIndex.position.y = -halfNutOuterRadius - 0.035;
  rightContactIndex.userData.role = 'visible-selected-lower-half-nut-index';
  rightHalfNut.add(
    rightHalfNutBody,
    ...rightInternal.segments,
    rightContactIndex,
  );

  const selectorCollar = cylinderAlongX(
    0.29,
    0.34,
    drivenMaterial,
    38,
  );
  selectorCollar.position.x = selectorLeverX;
  selectorCollar.userData.role = 'lever-collar-fixed-to-sliding-rockshaft';

  const selectorLever = makeBeam(
    new THREE.Vector3(
      selectorLeverX,
      -selectorLeverHalfLength,
      0,
    ),
    new THREE.Vector3(
      selectorLeverX,
      selectorLeverHalfLength,
      0,
    ),
    { color: PALETTE.driven, depth: 0.14, thickness: 0.11 },
  );
  selectorLever.userData.role = 'source-right-left-half-nut-selector-lever';
  const selectorHandles = [-1, 1].map((sideSign) => {
    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 22, 14),
      darkMaterial,
    );
    handle.scale.y = 1.35;
    handle.position.set(
      selectorLeverX,
      sideSign * selectorLeverHalfLength,
      0,
    );
    handle.userData.role = 'rounded-end-of-half-nut-selector-lever';
    handle.userData.side = sideSign < 0 ? 'lower' : 'upper';
    return handle;
  });
  const selectorIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.18, 0.035),
    indexMaterial,
  );
  selectorIndex.position.set(selectorLeverX + 0.2, 0, 0.29);
  selectorIndex.userData.role = 'white-index-showing-rockshaft-selection';

  selectorRotor.add(
    selectorShaft,
    leftArm,
    rightArm,
    ...armBaseCollars,
    leftHalfNut,
    rightHalfNut,
    selectorCollar,
    selectorLever,
    ...selectorHandles,
    selectorIndex,
  );

  root.add(
    ...supports,
    ...rollerBearings,
    ...spindleBearings,
    roller,
    selectorCarriage,
  );

  const snappedCycleAngle = (inputAngle) => {
    let cycleAngle = positiveModulo(inputAngle, cycleInputAngle);
    const boundaries = [
      0,
      firstShiftStartAngle,
      rightTraverseStartAngle,
      secondShiftStartAngle,
      cycleInputAngle,
    ];
    for (const boundary of boundaries) {
      if (Math.abs(cycleAngle - boundary) < 1e-10
        || Math.abs(cycleAngle - boundary + cycleInputAngle) < 1e-10
        || Math.abs(cycleAngle - boundary - cycleInputAngle) < 1e-10) {
        cycleAngle = boundary === cycleInputAngle ? 0 : boundary;
        break;
      }
    }
    return cycleAngle;
  };

  const motionAtInputAngle = (
    inputAngle,
    rollerAngularSpeed = inputAngularSpeed,
  ) => {
    const cycleAngle = snappedCycleAngle(inputAngle);
    let carriageX;
    let carriageVelocityX;
    let engagedHalfNut;
    let selectorRockAngle;
    let selectorAngularSpeed;
    let selectorProgress;
    let stage;
    if (cycleAngle < firstShiftStartAngle) {
      carriageX = carriageMaximumX
        - cycleAngle / threadWaveNumber;
      carriageVelocityX = -rollerAngularSpeed / threadWaveNumber;
      engagedHalfNut = 'left-upper';
      selectorRockAngle = -selectorAngle;
      selectorAngularSpeed = 0;
      selectorProgress = 0;
      stage = 'uniform-leftward-upper-half-nut-traverse';
    } else if (cycleAngle < rightTraverseStartAngle) {
      const linearProgress = (
        cycleAngle - firstShiftStartAngle
      ) / selectorShiftInputAngle;
      const easedProgress = smootherStep(linearProgress);
      carriageX = carriageMinimumX;
      carriageVelocityX = 0;
      engagedHalfNut = 'none';
      selectorRockAngle = THREE.MathUtils.lerp(
        -selectorAngle,
        selectorAngle,
        easedProgress,
      );
      selectorAngularSpeed = 2 * selectorAngle
        * smootherStepDerivative(linearProgress)
        * rollerAngularSpeed / selectorShiftInputAngle;
      selectorProgress = linearProgress;
      stage = 'rocking-selector-from-upper-to-lower-half-nut';
    } else if (cycleAngle < secondShiftStartAngle) {
      const traverseAngle = cycleAngle - rightTraverseStartAngle;
      carriageX = carriageMinimumX
        + traverseAngle / threadWaveNumber;
      carriageVelocityX = rollerAngularSpeed / threadWaveNumber;
      engagedHalfNut = 'right-lower';
      selectorRockAngle = selectorAngle;
      selectorAngularSpeed = 0;
      selectorProgress = 1;
      stage = 'uniform-rightward-lower-half-nut-traverse';
    } else {
      const linearProgress = (
        cycleAngle - secondShiftStartAngle
      ) / selectorShiftInputAngle;
      const easedProgress = smootherStep(linearProgress);
      carriageX = carriageMaximumX;
      carriageVelocityX = 0;
      engagedHalfNut = 'none';
      selectorRockAngle = THREE.MathUtils.lerp(
        selectorAngle,
        -selectorAngle,
        easedProgress,
      );
      selectorAngularSpeed = -2 * selectorAngle
        * smootherStepDerivative(linearProgress)
        * rollerAngularSpeed / selectorShiftInputAngle;
      selectorProgress = 1 - linearProgress;
      stage = 'rocking-selector-from-lower-to-upper-half-nut';
    }
    return {
      carriageVelocityX,
      carriageX,
      cycleAngle,
      cyclePhase: cycleAngle / cycleInputAngle,
      engagedHalfNut,
      inputAngle,
      rollerAngularSpeed,
      selectorAngularSpeed,
      selectorProgress,
      selectorRockAngle,
      stage,
    };
  };

  const stateFromMotion = (motion) => {
    const leftNutX = motion.carriageX + leftArmOffsetX;
    const rightNutX = motion.carriageX + rightArmOffsetX;
    const leftSelectedAngle = leftThreadPhase
      + leftThreadHand * threadWaveNumber * leftNutX
      + motion.inputAngle;
    const rightSelectedAngle = rightThreadPhase
      + rightThreadHand * threadWaveNumber * rightNutX
      + motion.inputAngle;
    const leftThreadPhaseError = angularDistance(
      leftSelectedAngle,
      upperContactAngle,
    );
    const rightThreadPhaseError = angularDistance(
      rightSelectedAngle,
      lowerContactAngle,
    );
    const targetCenter = new THREE.Vector3(0, axisSpacing, 0);
    const renderedLeftCenter = leftHalfNutCenterLocal.clone()
      .applyAxisAngle(X_AXIS, motion.selectorRockAngle);
    const renderedRightCenter = rightHalfNutCenterLocal.clone()
      .applyAxisAngle(X_AXIS, motion.selectorRockAngle);
    const leftHalfNutAlignmentError = renderedLeftCenter.distanceTo(
      targetCenter
    );
    const rightHalfNutAlignmentError = renderedRightCenter.distanceTo(
      targetCenter
    );
    const engagedCount = motion.engagedHalfNut === 'none' ? 0 : 1;
    const carriageVelocity = new THREE.Vector3(
      motion.carriageVelocityX,
      0,
      0,
    );

    let contact = null;
    if (motion.engagedHalfNut !== 'none') {
      const usesLeft = motion.engagedHalfNut === 'left-upper';
      const contactAngle = usesLeft
        ? upperContactAngle
        : lowerContactAngle;
      const hand = usesLeft ? leftThreadHand : rightThreadHand;
      const contactX = usesLeft ? leftNutX : rightNutX;
      const radialNormal = new THREE.Vector3(
        0,
        Math.cos(contactAngle),
        Math.sin(contactAngle),
      );
      const contactPoint = new THREE.Vector3(
        contactX,
        rollerAxisY + threadPitchRadius * Math.cos(contactAngle),
        threadPitchRadius * Math.sin(contactAngle),
      );
      const rollerSurfaceVelocity = new THREE.Vector3().crossVectors(
        X_AXIS,
        radialNormal,
      ).multiplyScalar(motion.rollerAngularSpeed * threadPitchRadius);
      const relativeThreadVelocity = carriageVelocity.clone()
        .sub(rollerSurfaceVelocity);
      const threadTangent = new THREE.Vector3(
        1,
        -hand * threadPitchRadius * threadWaveNumber
          * Math.sin(contactAngle),
        hand * threadPitchRadius * threadWaveNumber
          * Math.cos(contactAngle),
      ).normalize();
      const flankNormal = new THREE.Vector3().crossVectors(
        radialNormal,
        threadTangent,
      ).normalize();
      contact = {
        centerAlignmentError: usesLeft
          ? leftHalfNutAlignmentError
          : rightHalfNutAlignmentError,
        contactAngle,
        contactPoint,
        flankNormal,
        flankNormalVelocityError: relativeThreadVelocity.dot(flankNormal),
        hand,
        phaseConstraintError: usesLeft
          ? leftThreadPhaseError
          : rightThreadPhaseError,
        radialNormal,
        radialNormalVelocityError: relativeThreadVelocity.dot(radialNormal),
        relativeThreadVelocity,
        rollerSurfaceVelocity,
        slidingSpeed: relativeThreadVelocity.dot(threadTangent),
        threadTangent,
      };
    }
    return {
      ...motion,
      carriageVelocity,
      contact,
      engagedCount,
      leftHalfNutAlignmentError,
      leftNutX,
      leftThreadPhaseError,
      rightHalfNutAlignmentError,
      rightNutX,
      rightThreadPhaseError,
      simultaneousEngagement: false,
    };
  };

  const stateAtInputAngle = (
    inputAngle,
    rollerAngularSpeed = inputAngularSpeed,
  ) => stateFromMotion(motionAtInputAngle(
    inputAngle,
    rollerAngularSpeed,
  ));
  const stateAtTime = (time) => stateAtInputAngle(
    sourceInputAngle + inputAngularSpeed * time,
    inputAngularSpeed,
  );

  root.userData.mechanism = 'selectable-opposite-hand-half-nut-spool-traverse';
  root.userData.cameraDistanceScale = 1.03;
  root.userData.blocks = {
    armBaseCollars,
    leftArm,
    leftArmSegments,
    leftContactIndex,
    leftHalfNut,
    leftHalfNutBody,
    leftInternalThreadSegments: leftInternal.segments,
    leftThread,
    rightArm,
    rightArmSegments,
    rightContactIndex,
    rightHalfNut,
    rightHalfNutBody,
    rightInternalThreadSegments: rightInternal.segments,
    rightThread,
    roller,
    rollerBearings,
    rollerCore,
    rollerEndCollars,
    rollerRotationIndex,
    rollerRotor,
    rollerShaft,
    selectorCarriage,
    selectorCollar,
    selectorHandles,
    selectorIndex,
    selectorLever,
    selectorRotor,
    selectorShaft,
    spindleBearings,
    supports,
  };
  root.userData.curves = {
    leftInternalContact: leftInternal.contactCurve,
    leftInternalThreads: leftInternal.curves,
    leftThread: leftThreadCurve,
    rightInternalContact: rightInternal.contactCurve,
    rightInternalThreads: rightInternal.curves,
    rightThread: rightThreadCurve,
  };
  root.userData.geometry = {
    armSpacing,
    armDepth,
    armThickness,
    axisSpacing,
    bearingTubeRadius,
    carriageMaximumX,
    carriageMinimumX,
    carriageTravel,
    cycleInputAngle,
    cycleInputRevolutions,
    cyclePeriod,
    externalThreadTubeRadius,
    firstShiftStartAngle,
    fullTurn,
    halfNutAngularHalfSpan,
    halfNutInnerRadius,
    halfNutLength,
    halfNutOuterRadius,
    inputAngularSpeed,
    internalThreadRadius,
    internalThreadTubeRadius,
    leftArmOffsetX,
    leftArmCenterlineClearance,
    leftArmSurfaceClearance,
    leftThreadHand,
    leftThreadMaximumX,
    leftThreadMinimumX,
    leftThreadPhase,
    lowerContactAngle,
    rightArmOffsetX,
    rightArmSurfaceClearance,
    rightThreadHand,
    rightThreadMaximumX,
    rightThreadMinimumX,
    rightThreadPhase,
    rightTraverseStartAngle,
    rollerAxisY,
    rollerBearingInnerRadius,
    rollerBearingOuterRadius,
    rollerCoreLength,
    rollerCoreMaximumX,
    rollerCoreMinimumX,
    rollerCoreRadius,
    rollerShaftLength,
    rollerShaftRadius,
    secondShiftStartAngle,
    selectorAngle,
    selectorLeverHalfLength,
    selectorLeverX,
    selectorShiftInputAngle,
    sourceArmSpacing,
    sourceAxisSpacing,
    sourceCycleTime,
    sourceInputAngle,
    sourceSpindleExtension,
    sourceSupportHeight,
    sourceSupportSpacing,
    sourceSupportThickness,
    sourceThreadHalfLength,
    spindleAxisY,
    spindleBearingInnerRadius,
    spindleBearingOuterRadius,
    spindleCenterX,
    spindleLength,
    spindleRadius,
    supportHalfDepth,
    supportMaximumY,
    supportMinimumY,
    supportThickness,
    supportX,
    threadCenterRadius,
    threadHalfLength,
    threadHalfTurnCount,
    threadLead,
    threadPitchRadius,
    threadRadialClearance,
    threadSegments,
    threadSegmentsPerTurn,
    threadWaveNumber,
    traverseInputAngle,
    traverseInputRevolutions,
    uniformTraverseSpeed,
    upperContactAngle,
  };
  root.userData.motionAtInputAngle = motionAtInputAngle;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    rollerRotor.rotation.set(state.inputAngle, 0, 0);
    roller.userData.angularSpeed = state.rollerAngularSpeed;
    selectorCarriage.position.set(state.carriageX, 0, 0);
    selectorCarriage.userData.velocity = state.carriageVelocity.clone();
    selectorRotor.rotation.set(state.selectorRockAngle, 0, 0);
    selectorRotor.userData.angularSpeed = state.selectorAngularSpeed;
    leftContactIndex.visible = state.engagedHalfNut === 'left-upper';
    rightContactIndex.visible = state.engagedHalfNut === 'right-lower';
    root.userData.contacts = {
      halfNutSelection: {
        engagedCount: state.engagedCount,
        engagedHalfNut: state.engagedHalfNut,
        leftAlignmentError: state.leftHalfNutAlignmentError,
        rightAlignmentError: state.rightHalfNutAlignmentError,
        simultaneousEngagement: state.simultaneousEngagement,
      },
      selectedThread: state.contact ? {
        centerAlignmentError: state.contact.centerAlignmentError,
        contactPoint: state.contact.contactPoint.clone(),
        flankNormal: state.contact.flankNormal.clone(),
        flankNormalVelocityError: state.contact.flankNormalVelocityError,
        hand: state.contact.hand,
        phaseConstraintError: state.contact.phaseConstraintError,
        radialClearance: threadRadialClearance,
        radialNormal: state.contact.radialNormal.clone(),
        radialNormalVelocityError: state.contact.radialNormalVelocityError,
        slidingSpeed: state.contact.slidingSpeed,
        tangent: state.contact.threadTangent.clone(),
      } : null,
      shaftBearings: {
        rollerAxis: X_AXIS.clone(),
        rollerCount: rollerBearings.length,
        rollerRadialClearance: rollerBearingInnerRadius
          - rollerShaftRadius,
        spindleAxis: X_AXIS.clone(),
        spindleCount: spindleBearings.length,
        spindleRadialClearance: spindleBearingInnerRadius
          - spindleRadius,
      },
      traverse: {
        axis: X_AXIS.clone(),
        lineError: Math.hypot(
          selectorCarriage.position.y,
          selectorCarriage.position.z,
        ),
        uniformSpeed: uniformTraverseSpeed,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(7.4, 3.5, 11.8));
}

function differentialMicrometerScrewMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const outerLead = 0.44;
  const innerLead = 0.335;
  const differentialLead = outerLead - innerLead;
  const outerLeadPerRadian = outerLead / fullTurn;
  const innerLeadPerRadian = innerLead / fullTurn;
  const differentialLeadPerRadian = differentialLead / fullTurn;
  const outerThreadWaveNumber = fullTurn / outerLead;
  const innerThreadWaveNumber = fullTurn / innerLead;
  const outerThreadHand = -1;
  const innerThreadHand = 1;

  const outerCoreRadius = 0.76;
  const outerBoreRadius = 0.68;
  const outerThreadRadius = 0.81;
  const outerThreadTubeRadius = 0.075;
  const outerThreadMinimumY = 0.15;
  const outerThreadMaximumY = 2.35;
  const outerThreadLength = outerThreadMaximumY - outerThreadMinimumY;
  const outerThreadTurnCount = outerThreadLength / outerLead;
  const outerThreadSegmentsPerTurn = 52;
  const outerThreadSegments = Math.ceil(
    outerThreadTurnCount * outerThreadSegmentsPerTurn
  );
  const upperSleeveMinimumY = 0.31;
  const upperSleeveMaximumY = 2.48;
  const lowerSleeveMinimumY = -1.12;
  const lowerSleeveMaximumY = 0.36;
  const lowerSleeveLength = lowerSleeveMaximumY - lowerSleeveMinimumY;
  const topCapRadius = 0.8;
  const topCapHeight = 0.14;
  const topCapY = upperSleeveMaximumY + topCapHeight / 2;

  const innerCoreRadius = 0.46;
  const innerThreadRadius = 0.56;
  const innerThreadTubeRadius = 0.06;
  const innerThreadMinimumY = -2.3;
  const innerThreadMaximumY = 0.35;
  const innerThreadLength = innerThreadMaximumY - innerThreadMinimumY;
  const innerThreadTurnCount = innerThreadLength / innerLead;
  const innerThreadSegmentsPerTurn = 52;
  const innerThreadSegments = Math.ceil(
    innerThreadTurnCount * innerThreadSegmentsPerTurn
  );
  const innerCoreMinimumY = -2.48;
  const innerCoreMaximumY = 0.48;
  const innerCoreLength = innerCoreMaximumY - innerCoreMinimumY;
  const innerCoreCenterY = (
    innerCoreMinimumY + innerCoreMaximumY
  ) / 2;

  const nestedInternalThreadRadius = 0.645;
  const nestedInternalThreadTubeRadius = 0.015;
  const nestedThreadPitchRadius = (
    innerThreadRadius + innerThreadTubeRadius
      + nestedInternalThreadRadius - nestedInternalThreadTubeRadius
  ) / 2;
  const nestedThreadRadialClearance = nestedInternalThreadRadius
    - nestedInternalThreadTubeRadius
    - innerThreadRadius
    - innerThreadTubeRadius;
  const nestedInternalMinimumY = lowerSleeveMinimumY + 0.12;
  const nestedInternalMaximumY = lowerSleeveMaximumY - 0.1;
  const nestedContactLocalY = (
    nestedInternalMinimumY + nestedInternalMaximumY
  ) / 2;

  const fixedNutY = 1.25;
  const fixedNutHeight = 0.42;
  const fixedNutMinimumY = fixedNutY - fixedNutHeight / 2;
  const fixedNutMaximumY = fixedNutY + fixedNutHeight / 2;
  const fixedNutBoreRadius = 0.92;
  const fixedNutOuterRadius = 1.13;
  const fixedInternalThreadRadius = 0.902;
  const fixedInternalThreadTubeRadius = 0.014;
  const outerThreadPitchRadius = (
    outerThreadRadius + outerThreadTubeRadius
      + fixedInternalThreadRadius - fixedInternalThreadTubeRadius
  ) / 2;
  const outerThreadRadialClearance = fixedInternalThreadRadius
    - fixedInternalThreadTubeRadius
    - outerThreadRadius
    - outerThreadTubeRadius;
  const outerNutContactAngle = Math.PI + 0.32;
  const nestedContactAngle = 0.7;

  const sourceInputAngle = 0.36;
  const inputTravelRevolutions = 1.8;
  const inputTravelAngle = inputTravelRevolutions * fullTurn;
  const cyclePeriod = 18;
  const cycleAngularFrequency = fullTurn / cyclePeriod;
  const maximumInputAngularSpeed = inputTravelAngle
    * cycleAngularFrequency;
  const maximumOuterTravel = inputTravelRevolutions * outerLead;
  const maximumOutputTravel = inputTravelRevolutions * differentialLead;
  const maximumRelativeTravel = inputTravelRevolutions * innerLead;
  const displacementRatio = differentialLead / outerLead;
  const mechanicalAdvantage = outerLead / differentialLead;

  const cameraFrontAngle = Math.atan2(11.4, 7.2);
  const cutawayAngularHalfWidth = 0.72;
  const fixedCutawayCenterAngle = cameraFrontAngle;
  const rotatingCutawayCenterAngle = cameraFrontAngle + sourceInputAngle;
  const retainedAngularSpan = fullTurn - 2 * cutawayAngularHalfWidth;

  const framePostX = 1.43;
  const frameZ = -0.88;
  const frameMinimumY = -2.64;
  const frameMaximumY = fixedNutY;
  const framePostThickness = 0.14;
  const frameDepth = 0.14;
  const guideRailMinimumY = -2.3;
  const guideRailMaximumY = -0.72;
  const guideRailLength = guideRailMaximumY - guideRailMinimumY;
  const guideShoeWidth = 0.22;
  const guideRailWidth = 0.075;
  const guideRailClearance = 0.035;
  const guideRailX = guideShoeWidth / 2
    + guideRailClearance + guideRailWidth / 2;
  const guideRailZ = -0.93;
  const guideRailDepth = 0.17;
  const guideShoeY = -1.55;
  const guideShoeHeight = 0.18;
  const guideShoeDepth = 0.76;
  const guideShoeZ = -0.55;
  const guideShoeLateralClearance = guideRailX
    - guideRailWidth / 2 - guideShoeWidth / 2;

  const sourceOuterThreadDiameter = 72;
  const sourceInnerThreadDiameter = 52;
  const sourceOuterThreadLength = 132;
  const sourceInnerThreadLength = 161;
  const sourceOuterThreadPitch = 26.4;
  const sourceInnerThreadPitch = 20.1;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.2,
    roughness: 0.49,
  });
  const driverThreadMaterial = matte(0xb64b36, {
    metalness: 0.24,
    roughness: 0.44,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.54,
  });
  const drivenThreadMaterial = matte(0x244f67, {
    metalness: 0.22,
    roughness: 0.45,
  });
  const fixedNutMaterial = matte(PALETTE.brass, {
    metalness: 0.29,
    roughness: 0.43,
  });
  const internalThreadMaterial = matte(0x765122, {
    metalness: 0.33,
    roughness: 0.39,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.49,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const positiveModulo = (value, modulus) => (
    ((value % modulus) + modulus) % modulus
  );
  const angularDistance = (left, right) => Math.abs(Math.atan2(
    Math.sin(left - right),
    Math.cos(left - right),
  ));
  const makeSignedVerticalHelix = ({
    hand,
    maximumY,
    minimumY,
    phase,
    pitch,
    radius,
  }) => new class extends THREE.Curve {
    getPoint(parameter, target = new THREE.Vector3()) {
      const y = THREE.MathUtils.lerp(minimumY, maximumY, parameter);
      const angle = phase + hand * fullTurn / pitch * y;
      return target.set(
        radius * Math.cos(angle),
        y,
        radius * Math.sin(angle),
      );
    }
  }();
  const makeAnnularSleeve = ({
    cutawayCenterAngle,
    innerRadius,
    material,
    maximumY,
    minimumY,
    role,
  }) => {
    const group = new THREE.Group();
    group.userData.role = role;
    group.userData.innerRadius = innerRadius;
    group.userData.outerRadius = outerCoreRadius;
    group.userData.cutaway = cutawayCenterAngle !== null;
    const profile = [
      new THREE.Vector2(innerRadius, minimumY),
      new THREE.Vector2(outerCoreRadius, minimumY),
      new THREE.Vector2(outerCoreRadius, maximumY),
      new THREE.Vector2(innerRadius, maximumY),
      new THREE.Vector2(innerRadius, minimumY),
    ];
    if (cutawayCenterAngle === null) {
      const shell = new THREE.Mesh(
        new THREE.LatheGeometry(profile, 64, 0, fullTurn),
        material,
      );
      shell.userData.role = `${role}-closed-annular-shell`;
      group.add(shell);
      group.userData.shell = shell;
      group.userData.cutFaces = [];
      return group;
    }
    const removedPhiCenter = Math.PI / 2 - cutawayCenterAngle;
    const phiStart = removedPhiCenter + cutawayAngularHalfWidth;
    const shell = new THREE.Mesh(
      new THREE.LatheGeometry(
        profile,
        64,
        phiStart,
        retainedAngularSpan,
      ),
      material,
    );
    shell.userData.role = `${role}-sectioned-annular-shell`;
    shell.userData.phiStart = phiStart;
    shell.userData.phiLength = retainedAngularSpan;
    const shellThickness = outerCoreRadius - innerRadius;
    const shellHeight = maximumY - minimumY;
    const shellMidY = (minimumY + maximumY) / 2;
    const radialMidpoint = (innerRadius + outerCoreRadius) / 2;
    const boundaryAngles = [
      cutawayCenterAngle - cutawayAngularHalfWidth,
      cutawayCenterAngle + cutawayAngularHalfWidth,
    ];
    const cutFaces = boundaryAngles.map((angle, index) => {
      const face = new THREE.Mesh(
        new THREE.BoxGeometry(shellThickness, shellHeight, 0.018),
        material,
      );
      face.rotation.y = -angle;
      face.position.set(
        radialMidpoint * Math.cos(angle),
        shellMidY,
        radialMidpoint * Math.sin(angle),
      );
      face.userData.role = `${role}-solid-cut-face`;
      face.userData.side = index === 0 ? 'clockwise' : 'counterclockwise';
      return face;
    });
    group.add(shell, ...cutFaces);
    group.userData.shell = shell;
    group.userData.cutFaces = cutFaces;
    return group;
  };
  const makeCutawayRing = ({
    cutawayCenterAngle,
    innerRadius,
    material,
    maximumY,
    minimumY,
    outerRadius,
    role,
  }) => {
    const group = new THREE.Group();
    group.userData.role = role;
    group.userData.innerRadius = innerRadius;
    group.userData.outerRadius = outerRadius;
    const profile = [
      new THREE.Vector2(innerRadius, minimumY),
      new THREE.Vector2(outerRadius, minimumY),
      new THREE.Vector2(outerRadius, maximumY),
      new THREE.Vector2(innerRadius, maximumY),
      new THREE.Vector2(innerRadius, minimumY),
    ];
    const removedPhiCenter = Math.PI / 2 - cutawayCenterAngle;
    const phiStart = removedPhiCenter + cutawayAngularHalfWidth;
    const shell = new THREE.Mesh(
      new THREE.LatheGeometry(
        profile,
        72,
        phiStart,
        retainedAngularSpan,
      ),
      material,
    );
    shell.userData.role = `${role}-sectioned-ring`;
    shell.userData.phiStart = phiStart;
    shell.userData.phiLength = retainedAngularSpan;
    const ringThickness = outerRadius - innerRadius;
    const ringHeight = maximumY - minimumY;
    const ringMidY = (minimumY + maximumY) / 2;
    const radialMidpoint = (innerRadius + outerRadius) / 2;
    const cutFaces = [
      cutawayCenterAngle - cutawayAngularHalfWidth,
      cutawayCenterAngle + cutawayAngularHalfWidth,
    ].map((angle, index) => {
      const face = new THREE.Mesh(
        new THREE.BoxGeometry(ringThickness, ringHeight, 0.018),
        material,
      );
      face.rotation.y = -angle;
      face.position.set(
        radialMidpoint * Math.cos(angle),
        ringMidY,
        radialMidpoint * Math.sin(angle),
      );
      face.userData.role = `${role}-solid-cut-face`;
      face.userData.side = index === 0 ? 'clockwise' : 'counterclockwise';
      return face;
    });
    group.add(shell, ...cutFaces);
    group.userData.shell = shell;
    group.userData.cutFaces = cutFaces;
    return group;
  };
  const makeClippedThread = ({
    cutawayCenterAngle,
    hand,
    material,
    maximumY,
    minimumY,
    phase,
    pitch,
    radius,
    role,
    tubeRadius,
  }) => {
    const turns = (maximumY - minimumY) / pitch;
    const sampleCount = Math.max(96, Math.ceil(turns * 120));
    const intervals = [];
    let intervalStart = null;
    for (let index = 0; index <= sampleCount; index += 1) {
      const y = THREE.MathUtils.lerp(
        minimumY,
        maximumY,
        index / sampleCount,
      );
      const angle = phase + hand * fullTurn / pitch * y;
      const retained = angularDistance(
        angle,
        cutawayCenterAngle,
      ) >= cutawayAngularHalfWidth;
      if (retained && intervalStart === null) intervalStart = y;
      if ((!retained || index === sampleCount) && intervalStart !== null) {
        const intervalEnd = retained ? y : THREE.MathUtils.lerp(
          minimumY,
          maximumY,
          (index - 1) / sampleCount,
        );
        if (intervalEnd - intervalStart > 0.008) {
          intervals.push([intervalStart, intervalEnd]);
        }
        intervalStart = null;
      }
    }
    const curves = [];
    const segments = intervals.map(([segmentMinimumY, segmentMaximumY], index) => {
      const curve = makeSignedVerticalHelix({
        hand,
        maximumY: segmentMaximumY,
        minimumY: segmentMinimumY,
        phase,
        pitch,
        radius,
      });
      const tubularSegments = Math.max(
        5,
        Math.ceil(
          (segmentMaximumY - segmentMinimumY) / pitch
            * outerThreadSegmentsPerTurn
        ),
      );
      curve.arcLengthDivisions = tubularSegments;
      const ridge = new THREE.Mesh(
        new THREE.TubeGeometry(
          curve,
          tubularSegments,
          tubeRadius,
          7,
          false,
        ),
        material,
      );
      ridge.userData.role = role;
      ridge.userData.segment = index;
      ridge.userData.minimumY = segmentMinimumY;
      ridge.userData.maximumY = segmentMaximumY;
      curves.push(curve);
      return ridge;
    });
    return { curves, intervals, segments };
  };

  const outerThreadPhase = 0.44;
  const fixedInternalThreadPhase = outerThreadPhase - sourceInputAngle;
  const innerThreadPhase = 2.22;
  const nestedInternalThreadHand = -innerThreadHand;
  const nestedInternalThreadPhase = innerThreadPhase + sourceInputAngle;

  const outerAssembly = new THREE.Group();
  outerAssembly.userData.axis = Y_AXIS.clone();
  outerAssembly.userData.role = 'coarse-lead-translating-hollow-input-screw';
  const outerRotor = new THREE.Group();
  outerRotor.userData.axis = Y_AXIS.clone();
  outerRotor.userData.role = 'reversing-axis-rotor-of-hollow-input-screw';
  outerAssembly.add(outerRotor);

  const upperSleeve = makeAnnularSleeve({
    cutawayCenterAngle: null,
    innerRadius: outerBoreRadius,
    material: driverMaterial,
    maximumY: upperSleeveMaximumY,
    minimumY: upperSleeveMinimumY,
    role: 'full-thick-walled-upper-hollow-screw-sleeve',
  });
  const lowerCutawaySleeve = makeAnnularSleeve({
    cutawayCenterAngle: rotatingCutawayCenterAngle,
    innerRadius: outerBoreRadius,
    material: driverMaterial,
    maximumY: lowerSleeveMaximumY,
    minimumY: lowerSleeveMinimumY,
    role: 'sectioned-lower-hollow-screw-sleeve',
  });

  const outerThreadCurve = makeSignedVerticalHelix({
    hand: outerThreadHand,
    maximumY: outerThreadMaximumY,
    minimumY: outerThreadMinimumY,
    phase: outerThreadPhase,
    pitch: outerLead,
    radius: outerThreadRadius,
  });
  outerThreadCurve.arcLengthDivisions = outerThreadSegments;
  const outerThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      outerThreadCurve,
      outerThreadSegments,
      outerThreadTubeRadius,
      8,
      false,
    ),
    driverThreadMaterial,
  );
  outerThread.userData.role = 'coarse-opposite-slope-external-thread';
  outerThread.userData.hand = outerThreadHand;
  outerThread.userData.lead = outerLead;

  const nestedInternal = makeClippedThread({
    cutawayCenterAngle: rotatingCutawayCenterAngle,
    hand: nestedInternalThreadHand,
    material: internalThreadMaterial,
    maximumY: nestedInternalMaximumY,
    minimumY: nestedInternalMinimumY,
    phase: nestedInternalThreadPhase,
    pitch: innerLead,
    radius: nestedInternalThreadRadius,
    role: 'clipped-fine-internal-thread-inside-hollow-screw',
    tubeRadius: nestedInternalThreadTubeRadius,
  });

  const topCap = cylinderAlongY(
    topCapRadius,
    topCapHeight,
    driverMaterial,
    52,
  );
  topCap.position.y = topCapY;
  topCap.userData.role = 'input-head-integral-with-hollow-screw';
  const topCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.69, 0.055, 10, 52),
    darkMaterial,
  );
  topCollar.rotation.x = Math.PI / 2;
  topCollar.position.y = topCapY + topCapHeight / 2;
  topCollar.userData.role = 'input-head-edge-making-rotation-legible';
  const inputRotationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 20, 14),
    indexMaterial,
  );
  inputRotationIndex.position.set(
    topCapRadius * Math.cos(rotatingCutawayCenterAngle + 1.1),
    topCapY + topCapHeight / 2 + 0.01,
    topCapRadius * Math.sin(rotatingCutawayCenterAngle + 1.1),
  );
  inputRotationIndex.userData.role = 'white-index-on-rotating-hollow-screw-head';

  outerRotor.add(
    upperSleeve,
    lowerCutawaySleeve,
    outerThread,
    ...nestedInternal.segments,
    topCap,
    topCollar,
    inputRotationIndex,
  );

  const innerScrew = new THREE.Group();
  innerScrew.userData.axis = Y_AXIS.clone();
  innerScrew.userData.role = 'nonrotating-fine-lead-differential-output-screw';
  const innerCore = cylinderAlongY(
    innerCoreRadius,
    innerCoreLength,
    drivenMaterial,
    46,
  );
  innerCore.position.y = innerCoreCenterY;
  innerCore.userData.role = 'smaller-inner-screw-core-nested-in-hollow-input';
  const innerThreadCurve = makeSignedVerticalHelix({
    hand: innerThreadHand,
    maximumY: innerThreadMaximumY,
    minimumY: innerThreadMinimumY,
    phase: innerThreadPhase,
    pitch: innerLead,
    radius: innerThreadRadius,
  });
  innerThreadCurve.arcLengthDivisions = innerThreadSegments;
  const innerThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      innerThreadCurve,
      innerThreadSegments,
      innerThreadTubeRadius,
      8,
      false,
    ),
    drivenThreadMaterial,
  );
  innerThread.userData.role = 'fine-opposite-hand-thread-on-smaller-inner-screw';
  innerThread.userData.hand = innerThreadHand;
  innerThread.userData.lead = innerLead;

  const outputTip = cylinderAlongY(0.3, 0.22, drivenMaterial, 38);
  outputTip.position.y = innerCoreMinimumY - 0.09;
  outputTip.userData.role = 'differential-micrometer-output-die';
  const outputTipEnd = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 32, 18),
    drivenMaterial,
  );
  outputTipEnd.scale.y = 0.45;
  outputTipEnd.position.y = innerCoreMinimumY - 0.2;
  outputTipEnd.userData.role = 'rounded-working-end-of-output-die';
  const outputTranslationIndex = new THREE.Mesh(
    new THREE.TorusGeometry(innerCoreRadius + 0.025, 0.026, 8, 42),
    indexMaterial,
  );
  outputTranslationIndex.rotation.x = Math.PI / 2;
  outputTranslationIndex.position.y = -2.08;
  outputTranslationIndex.userData.role = 'white-ring-showing-small-net-output-travel';

  const guideShoe = new THREE.Mesh(
    new THREE.BoxGeometry(
      guideShoeWidth,
      guideShoeHeight,
      guideShoeDepth,
    ),
    drivenMaterial,
  );
  guideShoe.position.set(0, guideShoeY, guideShoeZ);
  guideShoe.userData.role = 'output-key-sliding-without-rotation-between-rails';
  const guideShoeIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      guideShoeWidth * 0.72,
      guideShoeHeight * 0.62,
      0.025,
    ),
    indexMaterial,
  );
  guideShoeIndex.position.set(
    0,
    guideShoeY,
    guideShoeZ + guideShoeDepth / 2 + 0.015,
  );
  guideShoeIndex.userData.role = 'white-output-index-against-fixed-scale';
  const guideCollar = cylinderAlongY(0.51, 0.15, drivenMaterial, 42);
  guideCollar.position.y = guideShoeY;
  guideCollar.userData.role = 'collar-joining-inner-screw-to-antirotation-key';

  innerScrew.add(
    innerCore,
    innerThread,
    outputTip,
    outputTipEnd,
    outputTranslationIndex,
    guideShoe,
    guideShoeIndex,
    guideCollar,
  );

  const fixedNut = makeCutawayRing({
    cutawayCenterAngle: fixedCutawayCenterAngle,
    innerRadius: fixedNutBoreRadius,
    material: fixedNutMaterial,
    maximumY: fixedNutMaximumY,
    minimumY: fixedNutMinimumY,
    outerRadius: fixedNutOuterRadius,
    role: 'fixed-sectioned-nut-with-real-coarse-threaded-bore',
  });
  const fixedInternalThread = makeClippedThread({
    cutawayCenterAngle: fixedCutawayCenterAngle,
    hand: outerThreadHand,
    material: internalThreadMaterial,
    maximumY: fixedNutMaximumY - 0.035,
    minimumY: fixedNutMinimumY + 0.035,
    phase: fixedInternalThreadPhase,
    pitch: outerLead,
    radius: fixedInternalThreadRadius,
    role: 'clipped-coarse-internal-thread-inside-fixed-nut',
    tubeRadius: fixedInternalThreadTubeRadius,
  });
  fixedNut.add(...fixedInternalThread.segments);

  const framePosts = [-1, 1].map((sideSign) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(
        framePostThickness,
        frameMaximumY - frameMinimumY,
        frameDepth,
      ),
      frameMaterial,
    );
    post.position.set(
      sideSign * framePostX,
      (frameMinimumY + frameMaximumY) / 2,
      frameZ,
    );
    post.userData.role = 'fixed-upright-supporting-nut-and-output-guide';
    post.userData.side = sideSign < 0 ? 'left' : 'right';
    return post;
  });
  const frameBase = new THREE.Mesh(
    new THREE.BoxGeometry(
      framePostX * 2 + framePostThickness,
      framePostThickness,
      frameDepth,
    ),
    frameMaterial,
  );
  frameBase.position.set(0, frameMinimumY, frameZ);
  frameBase.userData.role = 'fixed-base-joining-micrometer-frame-uprights';
  const nutSupportArms = [-1, 1].map((sideSign) => {
    const arm = makeBeam(
      new THREE.Vector3(
        sideSign * fixedNutOuterRadius * 0.94,
        fixedNutY,
        -0.12,
      ),
      new THREE.Vector3(
        sideSign * framePostX,
        fixedNutY,
        frameZ,
      ),
      { color: PALETTE.frame, depth: 0.13, thickness: 0.13 },
    );
    arm.userData.role = 'rigid-arm-preventing-fixed-nut-rotation';
    arm.userData.side = sideSign < 0 ? 'left' : 'right';
    return arm;
  });
  const guideRails = [-1, 1].map((sideSign) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(
        guideRailWidth,
        guideRailLength,
        guideRailDepth,
      ),
      darkMaterial,
    );
    rail.position.set(
      sideSign * guideRailX,
      (guideRailMinimumY + guideRailMaximumY) / 2,
      guideRailZ,
    );
    rail.userData.role = 'fixed-side-of-output-antirotation-keyway';
    rail.userData.side = sideSign < 0 ? 'left' : 'right';
    return rail;
  });
  const outputScaleTicks = Array.from({ length: 7 }, (_, index) => {
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.018, 0.025),
      index % 3 === 0 ? indexMaterial : frameMaterial,
    );
    tick.position.set(
      0.34,
      guideShoeY + (index - 3) * differentialLead,
      guideRailZ + guideRailDepth / 2 + 0.02,
    );
    tick.userData.role = 'fixed-one-differential-lead-scale-division';
    tick.userData.index = index;
    return tick;
  });

  root.add(
    ...framePosts,
    frameBase,
    ...nutSupportArms,
    ...guideRails,
    ...outputScaleTicks,
    fixedNut,
    outerAssembly,
    innerScrew,
  );

  const stateAtInputAngle = (
    inputAngle,
    inputAngularSpeed = maximumInputAngularSpeed,
  ) => {
    const inputAngleFromSource = inputAngle - sourceInputAngle;
    const inputRevolutionsFromSource = inputAngleFromSource / fullTurn;
    const outerDisplacement = outerLeadPerRadian
      * inputAngleFromSource;
    const relativeInnerDisplacement = -innerLeadPerRadian
      * inputAngleFromSource;
    const outputDisplacement = outerDisplacement
      + relativeInnerDisplacement;
    const outerVelocityY = outerLeadPerRadian * inputAngularSpeed;
    const relativeInnerVelocityY = -innerLeadPerRadian
      * inputAngularSpeed;
    const outputVelocityY = differentialLeadPerRadian
      * inputAngularSpeed;

    const outerThreadMinimumWorldY = outerThreadMinimumY
      + outerDisplacement;
    const outerThreadMaximumWorldY = outerThreadMaximumY
      + outerDisplacement;
    const outerNutOverlapLength = Math.max(0, Math.min(
      fixedNutMaximumY,
      outerThreadMaximumWorldY,
    ) - Math.max(
      fixedNutMinimumY,
      outerThreadMinimumWorldY,
    ));
    const nestedInternalMinimumWorldY = nestedInternalMinimumY
      + outerDisplacement;
    const nestedInternalMaximumWorldY = nestedInternalMaximumY
      + outerDisplacement;
    const innerThreadMinimumWorldY = innerThreadMinimumY
      + outputDisplacement;
    const innerThreadMaximumWorldY = innerThreadMaximumY
      + outputDisplacement;
    const nestedOverlapMinimumY = Math.max(
      nestedInternalMinimumWorldY,
      innerThreadMinimumWorldY,
    );
    const nestedOverlapMaximumY = Math.min(
      nestedInternalMaximumWorldY,
      innerThreadMaximumWorldY,
    );
    const nestedOverlapLength = Math.max(
      0,
      nestedOverlapMaximumY - nestedOverlapMinimumY,
    );

    const outerRadialNormal = new THREE.Vector3(
      Math.cos(outerNutContactAngle),
      0,
      Math.sin(outerNutContactAngle),
    );
    const outerNutContactPoint = outerRadialNormal.clone()
      .multiplyScalar(outerThreadPitchRadius);
    outerNutContactPoint.y = fixedNutY;
    const outerRotationalVelocity = new THREE.Vector3().crossVectors(
      Y_AXIS,
      outerRadialNormal,
    ).multiplyScalar(inputAngularSpeed * outerThreadPitchRadius);
    const outerSurfaceVelocity = outerRotationalVelocity.clone().add(
      new THREE.Vector3(0, outerVelocityY, 0)
    );
    const outerThreadTangent = new THREE.Vector3().crossVectors(
      Y_AXIS,
      outerRadialNormal,
    ).multiplyScalar(outerThreadPitchRadius).add(
      new THREE.Vector3(0, outerLeadPerRadian, 0)
    ).normalize();
    const outerThreadFlankNormal = new THREE.Vector3().crossVectors(
      outerRadialNormal,
      outerThreadTangent,
    ).normalize();

    const nestedRadialNormal = new THREE.Vector3(
      Math.cos(nestedContactAngle),
      0,
      Math.sin(nestedContactAngle),
    );
    const nestedContactPoint = nestedRadialNormal.clone()
      .multiplyScalar(nestedThreadPitchRadius);
    nestedContactPoint.y = THREE.MathUtils.clamp(
      nestedContactLocalY + outerDisplacement,
      nestedOverlapMinimumY,
      nestedOverlapMaximumY,
    );
    const outerInternalSurfaceVelocity = new THREE.Vector3().crossVectors(
      Y_AXIS,
      nestedRadialNormal,
    ).multiplyScalar(inputAngularSpeed * nestedThreadPitchRadius).add(
      new THREE.Vector3(0, outerVelocityY, 0)
    );
    const innerSurfaceVelocity = new THREE.Vector3(
      0,
      outputVelocityY,
      0,
    );
    const relativeNestedThreadVelocity = innerSurfaceVelocity.clone().sub(
      outerInternalSurfaceVelocity
    );
    const nestedThreadTangent = new THREE.Vector3().crossVectors(
      Y_AXIS,
      nestedRadialNormal,
    ).multiplyScalar(-nestedThreadPitchRadius).add(
      new THREE.Vector3(0, -innerLeadPerRadian, 0)
    ).normalize();
    const nestedThreadFlankNormal = new THREE.Vector3().crossVectors(
      nestedRadialNormal,
      nestedThreadTangent,
    ).normalize();

    const outerThreadPhaseConstraintError = angularDistance(
      inputAngleFromSource
        - outerThreadWaveNumber * outerDisplacement,
      0,
    );
    const nestedThreadPhaseConstraintError = angularDistance(
      inputAngleFromSource
        + innerThreadWaveNumber * relativeInnerDisplacement,
      0,
    );
    const leadDifferenceError = outputDisplacement
      - differentialLeadPerRadian * inputAngleFromSource;
    let stage = 'turning-point';
    if (inputAngularSpeed > 1e-10) stage = 'advancing-by-lead-difference';
    if (inputAngularSpeed < -1e-10) stage = 'returning-by-lead-difference';

    return {
      differentialLead,
      inputAngle,
      inputAngleFromSource,
      inputAngularSpeed,
      inputRevolutionsFromSource,
      innerRotation: 0,
      innerSurfaceVelocity,
      leadDifferenceError,
      nestedContactPoint,
      nestedFlankNormalVelocityError: relativeNestedThreadVelocity.dot(
        nestedThreadFlankNormal
      ),
      nestedOverlapLength,
      nestedRadialNormalVelocityError: relativeNestedThreadVelocity.dot(
        nestedRadialNormal
      ),
      nestedThreadFlankNormal,
      nestedThreadPhaseConstraintError,
      nestedThreadRadialNormal: nestedRadialNormal,
      nestedThreadSlidingSpeed: relativeNestedThreadVelocity.dot(
        nestedThreadTangent
      ),
      nestedThreadTangent,
      outerDisplacement,
      outerInternalSurfaceVelocity,
      outerNutContactPoint,
      outerNutFlankNormalVelocityError: outerSurfaceVelocity.dot(
        outerThreadFlankNormal
      ),
      outerNutOverlapLength,
      outerNutRadialNormalVelocityError: outerSurfaceVelocity.dot(
        outerRadialNormal
      ),
      outerSurfaceVelocity,
      outerThreadFlankNormal,
      outerThreadPhaseConstraintError,
      outerThreadRadialNormal: outerRadialNormal,
      outerThreadSlidingSpeed: outerSurfaceVelocity.dot(
        outerThreadTangent
      ),
      outerThreadTangent,
      outerVelocity: new THREE.Vector3(0, outerVelocityY, 0),
      outerVelocityY,
      outputDisplacement,
      outputVelocity: new THREE.Vector3(0, outputVelocityY, 0),
      outputVelocityY,
      relativeInnerDisplacement,
      relativeInnerVelocityY,
      relativeNestedThreadVelocity,
      stage,
    };
  };
  const stateAtTime = (time) => {
    const cycleAngle = cycleAngularFrequency * time;
    const inputAngle = sourceInputAngle
      + inputTravelAngle * Math.sin(cycleAngle);
    const inputAngularSpeed = inputTravelAngle
      * cycleAngularFrequency * Math.cos(cycleAngle);
    return {
      ...stateAtInputAngle(inputAngle, inputAngularSpeed),
      cycleAngle: positiveModulo(cycleAngle, fullTurn),
      cyclePhase: positiveModulo(cycleAngle, fullTurn) / fullTurn,
      time,
    };
  };

  root.userData.mechanism = 'opposite-hand-differential-micrometer-hollow-screw';
  root.userData.cameraDistanceScale = 1.4;
  root.userData.blocks = {
    fixedInternalThreadSegments: fixedInternalThread.segments,
    fixedNut,
    frameBase,
    framePosts,
    guideCollar,
    guideRails,
    guideShoe,
    guideShoeIndex,
    innerCore,
    innerScrew,
    innerThread,
    inputRotationIndex,
    lowerCutawaySleeve,
    nestedInternalThreadSegments: nestedInternal.segments,
    nutSupportArms,
    outerAssembly,
    outerRotor,
    outerThread,
    outputScaleTicks,
    outputTip,
    outputTipEnd,
    outputTranslationIndex,
    topCap,
    topCollar,
    upperSleeve,
  };
  root.userData.curves = {
    fixedInternalThreads: fixedInternalThread.curves,
    innerThread: innerThreadCurve,
    nestedInternalThreads: nestedInternal.curves,
    outerThread: outerThreadCurve,
  };
  root.userData.geometry = {
    cameraFrontAngle,
    cutawayAngularHalfWidth,
    cycleAngularFrequency,
    cyclePeriod,
    differentialLead,
    differentialLeadPerRadian,
    displacementRatio,
    fixedCutawayCenterAngle,
    fixedInternalThreadPhase,
    fixedInternalThreadRadius,
    fixedInternalThreadTubeRadius,
    fixedNutBoreRadius,
    fixedNutHeight,
    fixedNutMaximumY,
    fixedNutMinimumY,
    fixedNutOuterRadius,
    fixedNutY,
    frameDepth,
    frameMaximumY,
    frameMinimumY,
    framePostThickness,
    framePostX,
    frameZ,
    fullTurn,
    guideRailClearance,
    guideRailDepth,
    guideRailLength,
    guideRailMaximumY,
    guideRailMinimumY,
    guideRailWidth,
    guideRailX,
    guideRailZ,
    guideShoeDepth,
    guideShoeHeight,
    guideShoeLateralClearance,
    guideShoeWidth,
    guideShoeY,
    guideShoeZ,
    innerCoreLength,
    innerCoreMaximumY,
    innerCoreMinimumY,
    innerCoreRadius,
    innerLead,
    innerLeadPerRadian,
    innerThreadHand,
    innerThreadLength,
    innerThreadMaximumY,
    innerThreadMinimumY,
    innerThreadPhase,
    innerThreadRadius,
    innerThreadSegments,
    innerThreadSegmentsPerTurn,
    innerThreadTubeRadius,
    innerThreadTurnCount,
    innerThreadWaveNumber,
    inputTravelAngle,
    inputTravelRevolutions,
    lowerSleeveLength,
    lowerSleeveMaximumY,
    lowerSleeveMinimumY,
    maximumInputAngularSpeed,
    maximumOuterTravel,
    maximumOutputTravel,
    maximumRelativeTravel,
    mechanicalAdvantage,
    nestedContactAngle,
    nestedContactLocalY,
    nestedInternalMaximumY,
    nestedInternalMinimumY,
    nestedInternalThreadHand,
    nestedInternalThreadPhase,
    nestedInternalThreadRadius,
    nestedInternalThreadTubeRadius,
    nestedThreadPitchRadius,
    nestedThreadRadialClearance,
    outerBoreRadius,
    outerCoreRadius,
    outerLead,
    outerLeadPerRadian,
    outerNutContactAngle,
    outerThreadHand,
    outerThreadLength,
    outerThreadMaximumY,
    outerThreadMinimumY,
    outerThreadPhase,
    outerThreadPitchRadius,
    outerThreadRadialClearance,
    outerThreadRadius,
    outerThreadSegments,
    outerThreadSegmentsPerTurn,
    outerThreadTubeRadius,
    outerThreadTurnCount,
    outerThreadWaveNumber,
    retainedAngularSpan,
    rotatingCutawayCenterAngle,
    sourceInnerThreadDiameter,
    sourceInnerThreadLength,
    sourceInnerThreadPitch,
    sourceInputAngle,
    sourceOuterThreadDiameter,
    sourceOuterThreadLength,
    sourceOuterThreadPitch,
    topCapHeight,
    topCapRadius,
    topCapY,
    upperSleeveMaximumY,
    upperSleeveMinimumY,
  };
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    outerAssembly.position.set(0, state.outerDisplacement, 0);
    outerAssembly.userData.velocity = state.outerVelocity.clone();
    outerRotor.rotation.set(0, state.inputAngle, 0);
    outerRotor.userData.angularSpeed = state.inputAngularSpeed;
    innerScrew.position.set(0, state.outputDisplacement, 0);
    innerScrew.rotation.set(0, 0, 0);
    innerScrew.userData.velocity = state.outputVelocity.clone();
    innerScrew.userData.angularSpeed = 0;
    root.userData.contacts = {
      differentialOutput: {
        coarseAdvance: state.outerDisplacement,
        effectiveLead: differentialLead,
        fineBackoff: state.relativeInnerDisplacement,
        leadDifferenceError: state.leadDifferenceError,
        mechanicalAdvantage,
        netAdvance: state.outputDisplacement,
      },
      fixedOuterNutThread: {
        contactPoint: state.outerNutContactPoint.clone(),
        engagedOverlapLength: state.outerNutOverlapLength,
        flankNormal: state.outerThreadFlankNormal.clone(),
        flankNormalVelocityError: state.outerNutFlankNormalVelocityError,
        lead: outerLead,
        phaseConstraintError: state.outerThreadPhaseConstraintError,
        radialClearance: outerThreadRadialClearance,
        radialNormal: state.outerThreadRadialNormal.clone(),
        radialNormalVelocityError: state.outerNutRadialNormalVelocityError,
        slidingSpeed: state.outerThreadSlidingSpeed,
        tangent: state.outerThreadTangent.clone(),
      },
      innerOutputGuide: {
        axis: Y_AXIS.clone(),
        lateralClearance: guideShoeLateralClearance,
        lineError: Math.hypot(innerScrew.position.x, innerScrew.position.z),
        rotationError: Math.hypot(
          innerScrew.rotation.x,
          innerScrew.rotation.y,
          innerScrew.rotation.z,
        ),
      },
      nestedFineThread: {
        contactPoint: state.nestedContactPoint.clone(),
        engagedOverlapLength: state.nestedOverlapLength,
        flankNormal: state.nestedThreadFlankNormal.clone(),
        flankNormalVelocityError: state.nestedFlankNormalVelocityError,
        lead: innerLead,
        phaseConstraintError: state.nestedThreadPhaseConstraintError,
        radialClearance: nestedThreadRadialClearance,
        radialNormal: state.nestedThreadRadialNormal.clone(),
        radialNormalVelocityError: state.nestedRadialNormalVelocityError,
        relativeAxialDisplacement: state.relativeInnerDisplacement,
        slidingSpeed: state.nestedThreadSlidingSpeed,
        tangent: state.nestedThreadTangent.clone(),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(7.2, 3.7, 11.4));
}

function persianQuickThreadDrillMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const threadHand = 1;
  const threadStarts = 3;
  const threadLead = 0.96;
  const threadPitch = threadLead / threadStarts;
  const threadLeadPerRadian = threadLead / fullTurn;
  const threadWaveNumber = fullTurn / threadLead;
  const stockCoreRadius = 0.16;
  const externalThreadRadius = 0.215;
  const externalThreadTubeRadius = 0.02;
  const threadMinimumY = -2.32;
  const threadMaximumY = 2.32;
  const threadLength = threadMaximumY - threadMinimumY;
  const turnsPerStart = threadLength / threadLead;
  const threadSegmentsPerTurn = 64;
  const threadSegments = Math.ceil(
    turnsPerStart * threadSegmentsPerTurn
  );
  const stockCoreMinimumY = -2.48;
  const stockCoreMaximumY = 2.82;
  const stockCoreLength = stockCoreMaximumY - stockCoreMinimumY;
  const stockCoreCenterY = (
    stockCoreMinimumY + stockCoreMaximumY
  ) / 2;

  const travellerBoreRadius = 0.285;
  const internalThreadRadius = 0.255;
  const internalThreadTubeRadius = 0.012;
  const threadPitchRadius = (
    externalThreadRadius + externalThreadTubeRadius
      + internalThreadRadius - internalThreadTubeRadius
  ) / 2;
  const threadRadialClearance = internalThreadRadius
    - internalThreadTubeRadius
    - externalThreadRadius
    - externalThreadTubeRadius;
  const travellerInternalMinimumY = -0.36;
  const travellerInternalMaximumY = 0.36;
  const travellerInternalLength = travellerInternalMaximumY
    - travellerInternalMinimumY;
  const travellerWaistMinimumY = -0.4;
  const travellerWaistMaximumY = 0.4;
  const travellerWaistRadius = 0.6;
  const travellerShoulderRadius = 0.72;
  const travellerFlangeRadius = 0.86;
  const travellerFlangeHeight = 0.16;
  const travellerFlangeOffsetY = 0.48;
  const travellerTotalHeight = travellerFlangeOffsetY * 2
    + travellerFlangeHeight;
  const travellerMinimumY = -1.15;
  const travellerMaximumY = 1.15;
  const travellerStroke = travellerMaximumY - travellerMinimumY;
  const travellerStrokeAmplitude = travellerStroke / 2;
  const revolutionsPerStroke = travellerStroke / threadLead;

  const sourceStockAngle = 0.42;
  const sourceTravellerY = 0;
  const cyclePeriod = 6.8;
  const cycleAngularFrequency = fullTurn / cyclePeriod;
  const maximumTravellerSpeed = travellerStrokeAmplitude
    * cycleAngularFrequency;
  const maximumStockAngularSpeed = threadWaveNumber
    * maximumTravellerSpeed;
  const contactAngle = Math.atan2(11.2, 7.1);

  const headBearingInnerRadius = 0.18;
  const headBearingOuterRadius = 0.39;
  const headBearingHeight = 0.16;
  const headBearingY = 2.69;
  const headBearingMinimumY = headBearingY - headBearingHeight / 2;
  const headBearingMaximumY = headBearingY + headBearingHeight / 2;
  const bearingRadialClearance = headBearingInnerRadius - stockCoreRadius;
  const thrustCollarRadius = 0.31;
  const thrustCollarHeight = 0.12;
  const thrustCollarY = headBearingMinimumY - thrustCollarHeight / 2;
  const thrustContactY = headBearingMinimumY;
  const headMinimumY = headBearingMaximumY;
  const headMaximumY = 3.36;
  const headMaximumRadius = 0.92;
  const bodyContactRadius = 0.2;

  const chuckRadius = 0.34;
  const chuckHeight = 0.46;
  const chuckY = -2.63;
  const chuckMaximumY = chuckY + chuckHeight / 2;
  const chuckMinimumY = chuckY - chuckHeight / 2;
  const bitRadius = 0.065;
  const bitBodyMaximumY = chuckMinimumY + 0.04;
  const bitBodyMinimumY = -3.52;
  const bitBodyLength = bitBodyMaximumY - bitBodyMinimumY;
  const bitPointOverlap = 0.006;
  const bitPointLength = 0.2 + bitPointOverlap;
  const bitPointY = bitBodyMinimumY - bitPointLength / 2
    + bitPointOverlap;
  const bitMinimumY = bitPointY - bitPointLength / 2;
  const bitFluteRadius = bitRadius * 0.9;
  const bitFluteTubeRadius = 0.009;
  const bitFluteLead = 0.26;
  const bitFluteTurns = bitBodyLength / bitFluteLead;
  const bitFluteSegments = Math.ceil(bitFluteTurns * 40);

  const sourceTotalHeight = 414;
  const sourceHeadWidth = 107;
  const sourceStockDiameter = 27;
  const sourceTravellerWidth = 100;
  const sourceTravellerHeight = 59;
  const sourceChuckWidth = 43;
  const sourceBitLength = 56;
  const sourceUpperExposedThreadLength = 102;
  const sourceLowerExposedThreadLength = 110;
  const sourceThreadStripePitch = 17;
  const modeledTotalHeight = headMaximumY - bitMinimumY;
  const modeledThreadDiameter = 2 * (
    externalThreadRadius + externalThreadTubeRadius
  );
  const modeledUpperExposedThreadLength = threadMaximumY
    - (travellerFlangeOffsetY + travellerFlangeHeight / 2);
  const modeledLowerExposedThreadLength = (
    -travellerFlangeOffsetY - travellerFlangeHeight / 2
  ) - threadMinimumY;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.19,
    roughness: 0.49,
  });
  const driverDarkMaterial = matte(0xb64b36, {
    metalness: 0.24,
    roughness: 0.43,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.2,
    roughness: 0.5,
  });
  const drivenThreadMaterial = matte(0x244f67, {
    metalness: 0.24,
    roughness: 0.43,
  });
  const internalThreadMaterial = matte(PALETTE.brass, {
    metalness: 0.31,
    roughness: 0.4,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.67,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.47,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const positiveModulo = (value, modulus) => (
    ((value % modulus) + modulus) % modulus
  );
  const angularDistance = (left, right) => Math.abs(Math.atan2(
    Math.sin(left - right),
    Math.cos(left - right),
  ));
  const makeAnnularPlate = ({
    height,
    innerRadius,
    material,
    outerRadius,
    role,
    y,
  }) => {
    const plate = new THREE.Mesh(
      centeredExtrusion(
        planarAnnularShape(innerRadius, outerRadius),
        height,
        0.008,
      ),
      material,
    );
    plate.rotation.x = Math.PI / 2;
    plate.position.y = y;
    plate.userData.role = role;
    plate.userData.innerRadius = innerRadius;
    plate.userData.outerRadius = outerRadius;
    return plate;
  };

  const stock = new THREE.Group();
  stock.userData.axis = Y_AXIS.clone();
  stock.userData.role = 'axially-fixed-alternating-rotary-drill-stock';
  const stockRotor = new THREE.Group();
  stockRotor.userData.axis = Y_AXIS.clone();
  stockRotor.userData.role = 'quick-thread-driven-stock-chuck-and-bit-rotor';
  stock.add(stockRotor);

  const stockCore = cylinderAlongY(
    stockCoreRadius,
    stockCoreLength,
    drivenMaterial,
    38,
  );
  stockCore.position.y = stockCoreCenterY;
  stockCore.userData.role = 'continuous-stock-core-through-head-and-chuck';

  const externalThreadPhases = Array.from(
    { length: threadStarts },
    (_, startIndex) => 0.34 + startIndex / threadStarts * fullTurn,
  );
  const externalThreadCurves = externalThreadPhases.map((phase) => {
    const curve = helixCurve({
      maximumY: threadMaximumY,
      minimumY: threadMinimumY,
      phase,
      pitch: threadLead,
      radius: externalThreadRadius,
    });
    curve.arcLengthDivisions = threadSegments;
    return curve;
  });
  const externalThreads = externalThreadCurves.map((curve, startIndex) => {
    const thread = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        threadSegments,
        externalThreadTubeRadius,
        7,
        false,
      ),
      drivenThreadMaterial,
    );
    thread.userData.role = 'steep-external-ridge-of-three-start-quick-thread';
    thread.userData.startIndex = startIndex;
    thread.userData.startCount = threadStarts;
    thread.userData.lead = threadLead;
    thread.userData.pitch = threadPitch;
    return thread;
  });

  const thrustCollar = cylinderAlongY(
    thrustCollarRadius,
    thrustCollarHeight,
    drivenMaterial,
    40,
  );
  thrustCollar.position.y = thrustCollarY;
  thrustCollar.userData.role = 'rotating-thrust-collar-under-stationary-head';
  const thrustCollarRing = new THREE.Mesh(
    new THREE.TorusGeometry(
      thrustCollarRadius * 0.85,
      0.028,
      8,
      40,
    ),
    darkMaterial,
  );
  thrustCollarRing.rotation.x = Math.PI / 2;
  thrustCollarRing.position.y = thrustCollarY - thrustCollarHeight / 2;
  thrustCollarRing.userData.role = 'rotating-edge-of-stock-thrust-collar';
  const stockRotationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 18, 12),
    indexMaterial,
  );
  const stockIndexLocalAngle = contactAngle + sourceStockAngle;
  stockRotationIndex.position.set(
    thrustCollarRadius * 0.82 * Math.cos(stockIndexLocalAngle),
    thrustCollarY - thrustCollarHeight / 2 - 0.005,
    thrustCollarRadius * 0.82 * Math.sin(stockIndexLocalAngle),
  );
  stockRotationIndex.userData.role = 'white-index-on-alternating-stock-rotor';

  const chuck = new THREE.Mesh(
    new THREE.CylinderGeometry(
      chuckRadius * 0.78,
      chuckRadius,
      chuckHeight,
      6,
    ),
    drivenMaterial,
  );
  chuck.position.y = chuckY;
  chuck.userData.role = 'hexagonal-chuck-rigid-with-drill-stock';
  const chuckCollars = [-1, 1].map((sideSign) => {
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(chuckRadius * 0.82, 0.032, 8, 30),
      darkMaterial,
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = chuckY + sideSign * chuckHeight * 0.36;
    collar.userData.role = 'chuck-jaw-clamping-collar';
    collar.userData.side = sideSign < 0 ? 'lower' : 'upper';
    return collar;
  });
  const chuckRotationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 18, 12),
    indexMaterial,
  );
  chuckRotationIndex.position.set(
    chuckRadius * 0.82 * Math.cos(stockIndexLocalAngle),
    chuckY,
    chuckRadius * 0.82 * Math.sin(stockIndexLocalAngle),
  );
  chuckRotationIndex.userData.role = 'white-index-on-rotating-drill-chuck';

  const bitBody = cylinderAlongY(
    bitRadius,
    bitBodyLength,
    darkMaterial,
    24,
  );
  bitBody.position.y = (bitBodyMinimumY + bitBodyMaximumY) / 2;
  bitBody.userData.role = 'straight-shank-of-drill-bit';
  const bitFluteCurves = [0, Math.PI].map((phase) => {
    const curve = helixCurve({
      maximumY: bitBodyMaximumY - 0.025,
      minimumY: bitBodyMinimumY + 0.02,
      phase,
      pitch: bitFluteLead,
      radius: bitFluteRadius,
    });
    curve.arcLengthDivisions = bitFluteSegments;
    return curve;
  });
  const bitFlutes = bitFluteCurves.map((curve, index) => {
    const flute = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        bitFluteSegments,
        bitFluteTubeRadius,
        6,
        false,
      ),
      drivenMaterial,
    );
    flute.userData.role = 'helical-cutting-edge-on-drill-bit';
    flute.userData.index = index;
    return flute;
  });
  const bitPoint = new THREE.Mesh(
    new THREE.CylinderGeometry(
      bitRadius,
      0,
      bitPointLength,
      18,
    ),
    darkMaterial,
  );
  bitPoint.position.y = bitPointY;
  bitPoint.userData.role = 'pointed-cutting-tip-of-drill-bit';

  stockRotor.add(
    stockCore,
    ...externalThreads,
    thrustCollar,
    thrustCollarRing,
    stockRotationIndex,
    chuck,
    ...chuckCollars,
    chuckRotationIndex,
    bitBody,
    ...bitFlutes,
    bitPoint,
  );

  const stationaryHead = new THREE.Group();
  stationaryHead.userData.role = 'stationary-swivel-head-resting-against-body';
  const headProfile = [
    new THREE.Vector2(0, headMinimumY),
    new THREE.Vector2(0.39, headMinimumY),
    new THREE.Vector2(0.4, 2.84),
    new THREE.Vector2(0.5, 2.98),
    new THREE.Vector2(0.78, 3.1),
    new THREE.Vector2(headMaximumRadius, 3.2),
    new THREE.Vector2(0.82, 3.29),
    new THREE.Vector2(0.56, 3.34),
    new THREE.Vector2(0, headMaximumY),
  ];
  const headBody = new THREE.Mesh(
    new THREE.LatheGeometry(headProfile, 64),
    frameMaterial,
  );
  headBody.userData.role = 'fixed-mushroom-shaped-palm-and-body-rest';
  const headBearing = makeAnnularPlate({
    height: headBearingHeight,
    innerRadius: headBearingInnerRadius,
    material: frameMaterial,
    outerRadius: headBearingOuterRadius,
    role: 'real-bored-bearing-supporting-the-rotating-stock',
    y: headBearingY,
  });
  const bearingRaces = [-1, 1].map((sideSign) => {
    const race = new THREE.Mesh(
      new THREE.TorusGeometry(
        (headBearingInnerRadius + headBearingOuterRadius) / 2,
        0.035,
        9,
        42,
      ),
      darkMaterial,
    );
    race.rotation.x = Math.PI / 2;
    race.position.y = headBearingY
      + sideSign * (headBearingHeight / 2 - 0.018);
    race.userData.role = 'stationary-race-of-stock-head-bearing';
    race.userData.side = sideSign < 0 ? 'lower' : 'upper';
    return race;
  });
  const bodyContactPatch = cylinderAlongY(
    bodyContactRadius,
    0.022,
    indexMaterial,
    32,
  );
  bodyContactPatch.position.y = headMaximumY + 0.006;
  bodyContactPatch.userData.role = 'stationary-contact-patch-against-operator-body';
  stationaryHead.add(
    headBody,
    headBearing,
    ...bearingRaces,
    bodyContactPatch,
  );

  const traveller = new THREE.Group();
  traveller.userData.axis = Y_AXIS.clone();
  traveller.userData.role = 'hand-held-nonrotating-reciprocating-threaded-button';
  const travellerProfile = [
    new THREE.Vector2(travellerBoreRadius, travellerWaistMinimumY),
    new THREE.Vector2(travellerShoulderRadius, travellerWaistMinimumY),
    new THREE.Vector2(travellerShoulderRadius, -0.3),
    new THREE.Vector2(travellerWaistRadius, -0.13),
    new THREE.Vector2(travellerWaistRadius, 0.13),
    new THREE.Vector2(travellerShoulderRadius, 0.3),
    new THREE.Vector2(travellerShoulderRadius, travellerWaistMaximumY),
    new THREE.Vector2(travellerBoreRadius, travellerWaistMaximumY),
    new THREE.Vector2(travellerBoreRadius, travellerWaistMinimumY),
  ];
  const travellerWaist = new THREE.Mesh(
    new THREE.LatheGeometry(travellerProfile, 64),
    driverMaterial,
  );
  travellerWaist.userData.role = 'waisted-hand-grip-with-real-central-bore';
  travellerWaist.userData.boreRadius = travellerBoreRadius;
  const travellerFlanges = [-1, 1].map((sideSign) => makeAnnularPlate({
    height: travellerFlangeHeight,
    innerRadius: travellerBoreRadius,
    material: driverMaterial,
    outerRadius: travellerFlangeRadius,
    role: 'broad-flange-of-hand-held-traveller-nut',
    y: sideSign * travellerFlangeOffsetY,
  }));
  for (const [index, flange] of travellerFlanges.entries()) {
    flange.userData.side = index === 0 ? 'lower' : 'upper';
  }
  const travellerRings = [-1, 1].map((sideSign) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        travellerShoulderRadius,
        0.045,
        9,
        48,
      ),
      driverDarkMaterial,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = sideSign * 0.34;
    ring.userData.role = 'rounded-edge-of-reciprocating-hand-grip';
    ring.userData.side = sideSign < 0 ? 'lower' : 'upper';
    return ring;
  });
  const internalThreadPhases = externalThreadPhases.map(
    (phase) => phase - sourceStockAngle
      + threadWaveNumber * (
        travellerInternalMinimumY - threadMinimumY
      )
  );
  const internalThreadCurves = internalThreadPhases.map((phase) => {
    const curve = helixCurve({
      maximumY: travellerInternalMaximumY,
      minimumY: travellerInternalMinimumY,
      phase,
      pitch: threadLead,
      radius: internalThreadRadius,
    });
    curve.arcLengthDivisions = 56;
    return curve;
  });
  const internalThreads = internalThreadCurves.map((curve, startIndex) => {
    const thread = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        56,
        internalThreadTubeRadius,
        7,
        false,
      ),
      internalThreadMaterial,
    );
    thread.userData.role = 'matching-internal-ridge-in-traveller-nut';
    thread.userData.startIndex = startIndex;
    thread.userData.startCount = threadStarts;
    return thread;
  });
  const travellerIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 18, 12),
    indexMaterial,
  );
  travellerIndex.position.set(
    (travellerWaistRadius + 0.025) * Math.cos(contactAngle),
    0,
    (travellerWaistRadius + 0.025) * Math.sin(contactAngle),
  );
  travellerIndex.userData.role = 'white-index-showing-that-input-nut-does-not-rotate';
  traveller.add(
    travellerWaist,
    ...travellerFlanges,
    ...travellerRings,
    ...internalThreads,
    travellerIndex,
  );

  root.add(stock, stationaryHead, traveller);

  const stateAtTravellerPosition = (
    travellerY,
    travellerVelocityY = 0,
    travellerAccelerationY = 0,
  ) => {
    const travellerDisplacement = travellerY - sourceTravellerY;
    const stockAngle = sourceStockAngle
      + threadHand * threadWaveNumber * travellerDisplacement;
    const stockAngularSpeed = threadHand * threadWaveNumber
      * travellerVelocityY;
    const stockAngularAcceleration = threadHand * threadWaveNumber
      * travellerAccelerationY;
    const stockRevolutionsFromSource = (
      stockAngle - sourceStockAngle
    ) / fullTurn;
    const phaseConstraintError = angularDistance(
      stockAngle - sourceStockAngle
        - threadHand * threadWaveNumber * travellerDisplacement,
      0,
    );
    const axialConstraintError = travellerDisplacement
      - threadHand * threadLeadPerRadian
        * (stockAngle - sourceStockAngle);
    const internalMinimumWorldY = travellerY
      + travellerInternalMinimumY;
    const internalMaximumWorldY = travellerY
      + travellerInternalMaximumY;
    const engagementMinimumY = Math.max(
      threadMinimumY,
      internalMinimumWorldY,
    );
    const engagementMaximumY = Math.min(
      threadMaximumY,
      internalMaximumWorldY,
    );
    const engagementLength = Math.max(
      0,
      engagementMaximumY - engagementMinimumY,
    );

    const radialNormal = new THREE.Vector3(
      Math.cos(contactAngle),
      0,
      Math.sin(contactAngle),
    );
    const contactPoint = radialNormal.clone().multiplyScalar(
      threadPitchRadius
    );
    contactPoint.y = travellerY;
    const stockSurfaceVelocity = new THREE.Vector3().crossVectors(
      Y_AXIS,
      radialNormal,
    ).multiplyScalar(stockAngularSpeed * threadPitchRadius);
    const travellerSurfaceVelocity = new THREE.Vector3(
      0,
      travellerVelocityY,
      0,
    );
    const relativeThreadVelocity = travellerSurfaceVelocity.clone().sub(
      stockSurfaceVelocity
    );
    const threadTangent = new THREE.Vector3().crossVectors(
      Y_AXIS,
      radialNormal,
    ).multiplyScalar(-threadPitchRadius).add(
      new THREE.Vector3(0, threadLeadPerRadian, 0)
    ).normalize();
    const threadFlankNormal = new THREE.Vector3().crossVectors(
      radialNormal,
      threadTangent,
    ).normalize();
    let stage = 'stroke-reversal';
    if (travellerVelocityY > 1e-10) {
      stage = 'pulling-nut-upward-spinning-stock-forward';
    }
    if (travellerVelocityY < -1e-10) {
      stage = 'pushing-nut-downward-spinning-stock-reverse';
    }
    return {
      axialConstraintError,
      bitAngle: stockAngle,
      bitAngularSpeed: stockAngularSpeed,
      contactPoint,
      engagementLength,
      headAxialDisplacement: 0,
      headRotation: 0,
      phaseConstraintError,
      radialNormal,
      radialNormalVelocityError: relativeThreadVelocity.dot(radialNormal),
      relativeThreadVelocity,
      stage,
      stockAngle,
      stockAngularAcceleration,
      stockAngularSpeed,
      stockAxialDisplacement: 0,
      stockRevolutionsFromSource,
      stockSurfaceVelocity,
      threadFlankNormal,
      threadFlankNormalVelocityError: relativeThreadVelocity.dot(
        threadFlankNormal
      ),
      threadSlidingSpeed: relativeThreadVelocity.dot(threadTangent),
      threadTangent,
      travellerAccelerationY,
      travellerDisplacement,
      travellerRotation: 0,
      travellerSurfaceVelocity,
      travellerVelocity: new THREE.Vector3(0, travellerVelocityY, 0),
      travellerVelocityY,
      travellerY,
    };
  };
  const stateAtTime = (time) => {
    const rawCycleAngle = cycleAngularFrequency * time;
    const travellerY = sourceTravellerY
      + travellerStrokeAmplitude * Math.sin(rawCycleAngle);
    const travellerVelocityY = travellerStrokeAmplitude
      * cycleAngularFrequency * Math.cos(rawCycleAngle);
    const travellerAccelerationY = -travellerStrokeAmplitude
      * cycleAngularFrequency ** 2 * Math.sin(rawCycleAngle);
    return {
      ...stateAtTravellerPosition(
        travellerY,
        travellerVelocityY,
        travellerAccelerationY,
      ),
      cycleAngle: positiveModulo(rawCycleAngle, fullTurn),
      cyclePhase: positiveModulo(rawCycleAngle, fullTurn) / fullTurn,
      time,
    };
  };

  root.userData.mechanism = 'hand-reciprocated-three-start-persian-drill';
  root.userData.cameraDistanceScale = 1.35;
  root.userData.blocks = {
    bearingRaces,
    bitBody,
    bitFlutes,
    bitPoint,
    bodyContactPatch,
    chuck,
    chuckCollars,
    chuckRotationIndex,
    externalThreads,
    headBearing,
    headBody,
    internalThreads,
    stationaryHead,
    stock,
    stockCore,
    stockRotationIndex,
    stockRotor,
    thrustCollar,
    thrustCollarRing,
    traveller,
    travellerFlanges,
    travellerIndex,
    travellerRings,
    travellerWaist,
  };
  root.userData.curves = {
    bitFlutes: bitFluteCurves,
    externalThreads: externalThreadCurves,
    internalThreads: internalThreadCurves,
  };
  root.userData.geometry = {
    bearingRadialClearance,
    bitBodyLength,
    bitBodyMaximumY,
    bitBodyMinimumY,
    bitFluteLead,
    bitFluteRadius,
    bitFluteSegments,
    bitFluteTubeRadius,
    bitFluteTurns,
    bitMinimumY,
    bitPointLength,
    bitPointOverlap,
    bitPointY,
    bitRadius,
    bodyContactRadius,
    chuckHeight,
    chuckMaximumY,
    chuckMinimumY,
    chuckRadius,
    chuckY,
    contactAngle,
    cycleAngularFrequency,
    cyclePeriod,
    externalThreadPhases,
    externalThreadRadius,
    externalThreadTubeRadius,
    fullTurn,
    headBearingHeight,
    headBearingInnerRadius,
    headBearingMaximumY,
    headBearingMinimumY,
    headBearingOuterRadius,
    headBearingY,
    headMaximumRadius,
    headMaximumY,
    headMinimumY,
    internalThreadPhases,
    internalThreadRadius,
    internalThreadTubeRadius,
    maximumStockAngularSpeed,
    maximumTravellerSpeed,
    modeledLowerExposedThreadLength,
    modeledThreadDiameter,
    modeledTotalHeight,
    modeledUpperExposedThreadLength,
    revolutionsPerStroke,
    sourceBitLength,
    sourceChuckWidth,
    sourceHeadWidth,
    sourceLowerExposedThreadLength,
    sourceStockAngle,
    sourceStockDiameter,
    sourceThreadStripePitch,
    sourceTotalHeight,
    sourceTravellerHeight,
    sourceTravellerWidth,
    sourceTravellerY,
    sourceUpperExposedThreadLength,
    stockCoreLength,
    stockCoreMaximumY,
    stockCoreMinimumY,
    stockCoreRadius,
    stockIndexLocalAngle,
    threadHand,
    threadLead,
    threadLeadPerRadian,
    threadLength,
    threadMaximumY,
    threadMinimumY,
    threadPitch,
    threadPitchRadius,
    threadRadialClearance,
    threadSegments,
    threadSegmentsPerTurn,
    threadStarts,
    threadWaveNumber,
    thrustCollarHeight,
    thrustCollarRadius,
    thrustCollarY,
    thrustContactY,
    travellerBoreRadius,
    travellerFlangeHeight,
    travellerFlangeOffsetY,
    travellerFlangeRadius,
    travellerInternalLength,
    travellerInternalMaximumY,
    travellerInternalMinimumY,
    travellerMaximumY,
    travellerMinimumY,
    travellerShoulderRadius,
    travellerStroke,
    travellerStrokeAmplitude,
    travellerTotalHeight,
    travellerWaistMaximumY,
    travellerWaistMinimumY,
    travellerWaistRadius,
    turnsPerStart,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.stateAtTravellerPosition = stateAtTravellerPosition;

  const update = (time) => {
    const state = stateAtTime(time);
    stock.position.set(0, 0, 0);
    stock.rotation.set(0, 0, 0);
    stockRotor.rotation.set(0, state.stockAngle, 0);
    stockRotor.userData.angularSpeed = state.stockAngularSpeed;
    stockRotor.userData.angularAcceleration = state.stockAngularAcceleration;
    traveller.position.set(0, state.travellerY, 0);
    traveller.rotation.set(0, 0, 0);
    traveller.userData.velocity = state.travellerVelocity.clone();
    stationaryHead.position.set(0, 0, 0);
    stationaryHead.rotation.set(0, 0, 0);
    root.userData.contacts = {
      drillAxis: {
        axialRunout: Math.hypot(stock.position.x, stock.position.z),
        bitToStockAngularError: angularDistance(
          state.bitAngle,
          state.stockAngle,
        ),
        stockAxialDisplacement: state.stockAxialDisplacement,
      },
      operatorGrip: {
        nonrotationError: Math.hypot(
          traveller.rotation.x,
          traveller.rotation.y,
          traveller.rotation.z,
        ),
        strokeMaximumY: travellerMaximumY,
        strokeMinimumY: travellerMinimumY,
        travellerY: state.travellerY,
      },
      quickThread: {
        axialConstraintError: state.axialConstraintError,
        contactPoint: state.contactPoint.clone(),
        engagedLength: state.engagementLength,
        flankNormal: state.threadFlankNormal.clone(),
        flankNormalVelocityError: state.threadFlankNormalVelocityError,
        hand: threadHand,
        lead: threadLead,
        phaseConstraintError: state.phaseConstraintError,
        pitch: threadPitch,
        radialClearance: threadRadialClearance,
        radialNormal: state.radialNormal.clone(),
        radialNormalVelocityError: state.radialNormalVelocityError,
        slidingSpeed: state.threadSlidingSpeed,
        startCount: threadStarts,
        tangent: state.threadTangent.clone(),
      },
      swivelHeadBearing: {
        axialContactError: thrustCollarY + thrustCollarHeight / 2
          - thrustContactY,
        bearingRotation: 0,
        boreAxis: Y_AXIS.clone(),
        radialClearance: bearingRadialClearance,
        stockAxialVelocity: 0,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(7.1, 3.7, 11.2));
}

function keyedSlidingWormTraversingFrame() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Movement 143 has no published animation. These dimensions are measured
  // from its 525 px public-domain engraving. The caption defines the missing
  // depth/topology: a fixed rotating shaft passes through a keyed worm, while
  // one nonrotating frame carries that axially sliding worm and its wheel.
  const sourceScale = 0.015;
  const sourceWheelCenter = new THREE.Vector2(269.5, 338.75);
  const sourceWormAxisPoint = new THREE.Vector2(269.5, 273.5);
  const sourceCrankWrist = new THREE.Vector2(251, 364.25);
  const sourceFixedRodPivot = new THREE.Vector2(472.5, 332.5);
  const sourceWheelPitchRadius = 55;
  const sourceWheelToothHeight = 10;
  const sourceWheelTeeth = 22;
  const sourceGuideBarLeftX = 75;
  const sourceGuideBarRightX = 459;
  const sourceGuideBarTopY = 326;
  const sourceGuideBarBottomY = 355;
  const sourceLeftPostCenterX = 61.5;
  const sourceRightPostCenterX = 472.5;
  const sourceBaseY = 414;
  const sourceInputPulleyCenterX = 25;
  const sourceInputPulleyRadius = 52;
  const sourceTraversingFrameWidth = 132;
  const sourceWormThreadTurns = 4;

  const sourceWheelCenterX = -0.55;
  const sourcePointToWorld = (point) => new THREE.Vector3(
    sourceWheelCenterX
      + (point.x - sourceWheelCenter.x) * sourceScale,
    -(point.y - sourceWheelCenter.y) * sourceScale,
    0,
  );
  const sourceWheelCenterWorld = new THREE.Vector3(
    sourceWheelCenterX,
    0,
    0,
  );
  const sourceCrankWristWorld = sourcePointToWorld(sourceCrankWrist);
  const fixedRodPivot = sourcePointToWorld(sourceFixedRodPivot);
  const sourceCrankVector = sourceCrankWristWorld.clone().sub(
    sourceWheelCenterWorld,
  );
  const crankRadius = sourceCrankVector.length();
  const connectingRodLength = fixedRodPivot.distanceTo(
    sourceCrankWristWorld,
  );

  const wheelTeeth = sourceWheelTeeth;
  const wheelPitchRadius = sourceWheelPitchRadius * sourceScale;
  const wheelToothHeight = sourceWheelToothHeight * sourceScale;
  const wheelOuterRadius = wheelPitchRadius + wheelToothHeight / 2;
  const wheelRootRadius = wheelPitchRadius - wheelToothHeight / 2;
  const wheelToothPitchAngle = fullTurn / wheelTeeth;
  const wheelGapCenterPhase = wheelToothPitchAngle * 7 / 8;
  const wheelReferenceAngle = Math.PI / 2 - wheelGapCenterPhase;
  const wormAxisY = (
    sourceWheelCenter.y - sourceWormAxisPoint.y
  ) * sourceScale;
  const wormPitchRadius = wormAxisY - wheelPitchRadius;
  const wormStarts = 1;
  const wormHandedness = 1;
  const wormAxialPitch = fullTurn * wheelPitchRadius / wheelTeeth;
  const wormLead = wormAxialPitch * wormStarts;
  const wormLeadPerRadian = wormLead / fullTurn;
  const wormThreadTurns = sourceWormThreadTurns;
  const wormThreadLength = wormThreadTurns * wormAxialPitch;
  const wormThreadMinimumX = -wormThreadLength / 2;
  const wormThreadMaximumX = wormThreadLength / 2;
  const wormCoreRadius = 0.135;
  const wormThreadRadius = 0.225;
  const wormThreadTubeRadius = 0.045;
  const wormThreadPhase = Math.PI;
  const wormReferenceAngle = 0;
  const wheelToWormRatio = wormHandedness * wormStarts / wheelTeeth;

  const inputTurnsPerSecond = 1;
  const inputAngularSpeed = inputTurnsPerSecond * fullTurn;
  const inputRotationPeriod = 1 / inputTurnsPerSecond;
  const completePatternInputTurns = wheelTeeth / wormStarts;
  const completePatternPeriod = completePatternInputTurns
    / inputTurnsPerSecond;

  const rotatePlanar = (vector, angle) => vector.clone().applyAxisAngle(
    Z_AXIS,
    angle,
  );
  const zCross = (vector) => new THREE.Vector3(
    -vector.y,
    vector.x,
    0,
  );

  const stateAtInputKinematics = ({
    inputAngle,
    inputAngularAcceleration,
    inputAngularSpeed: currentInputAngularSpeed,
    time = null,
  }) => {
    const wheelDeltaAngle = wheelToWormRatio * inputAngle;
    const wheelAngle = wheelReferenceAngle + wheelDeltaAngle;
    const wheelAngularSpeed = wheelToWormRatio
      * currentInputAngularSpeed;
    const wheelAngularAcceleration = wheelToWormRatio
      * inputAngularAcceleration;
    const crankVector = rotatePlanar(
      sourceCrankVector,
      wheelDeltaAngle,
    );
    const crankRelativeVelocity = zCross(crankVector).multiplyScalar(
      wheelAngularSpeed,
    );
    const crankRelativeAcceleration = zCross(crankVector).multiplyScalar(
      wheelAngularAcceleration,
    ).addScaledVector(crankVector, -(wheelAngularSpeed ** 2));

    const crankWristY = sourceWheelCenterWorld.y + crankVector.y;
    const rodVerticalOffset = fixedRodPivot.y - crankWristY;
    const rodRadicand = connectingRodLength ** 2
      - rodVerticalOffset ** 2;
    if (rodRadicand <= 0) {
      throw new RangeError(
        'Movement 143 connecting rod cannot reach the horizontal guide.',
      );
    }
    const rodHorizontalProjection = Math.sqrt(rodRadicand);
    const carriageX = fixedRodPivot.x
      - crankVector.x - rodHorizontalProjection;
    const wheelCenter = new THREE.Vector3(
      carriageX,
      sourceWheelCenterWorld.y,
      0,
    );
    const wormCenter = new THREE.Vector3(
      carriageX,
      wormAxisY,
      0,
    );
    const crankWrist = wheelCenter.clone().add(crankVector);
    const connectingRodVector = fixedRodPivot.clone().sub(crankWrist);

    const carriageVelocityX = -crankRelativeVelocity.x
      - connectingRodVector.y * crankRelativeVelocity.y
        / connectingRodVector.x;
    const carriageVelocity = new THREE.Vector3(
      carriageVelocityX,
      0,
      0,
    );
    const crankWristVelocity = carriageVelocity.clone().add(
      crankRelativeVelocity,
    );
    const carriageAccelerationX = (
      crankWristVelocity.lengthSq()
        - connectingRodVector.y * crankRelativeAcceleration.y
    ) / connectingRodVector.x - crankRelativeAcceleration.x;
    const carriageAcceleration = new THREE.Vector3(
      carriageAccelerationX,
      0,
      0,
    );
    const crankWristAcceleration = carriageAcceleration.clone().add(
      crankRelativeAcceleration,
    );

    const centerDirection = Y_AXIS.clone();
    const wheelPitchPoint = wheelCenter.clone().addScaledVector(
      centerDirection,
      wheelPitchRadius,
    );
    const wormPitchPoint = wormCenter.clone().addScaledVector(
      centerDirection,
      -wormPitchRadius,
    );
    const contactPoint = wheelPitchPoint.clone();
    const wormThreadAdvanceSpeed = carriageVelocityX
      - wormHandedness * currentInputAngularSpeed
        * wormLeadPerRadian;
    const wheelContactTangentialSpeed = carriageVelocityX
      - wheelAngularSpeed * wheelPitchRadius;
    const wormThreadAdvanceAcceleration = carriageAccelerationX
      - wormHandedness * inputAngularAcceleration
        * wormLeadPerRadian;
    const wheelContactTangentialAcceleration = carriageAccelerationX
      - wheelAngularAcceleration * wheelPitchRadius;
    const wormThreadVelocity = X_AXIS.clone().multiplyScalar(
      wormThreadAdvanceSpeed,
    );
    const wheelContactVelocity = X_AXIS.clone().multiplyScalar(
      wheelContactTangentialSpeed,
    );
    const meshPhaseError = wormHandedness * wormStarts * inputAngle
      - wheelTeeth * wheelDeltaAngle;
    const meshPhaseVelocityError = wormHandedness * wormStarts
      * currentInputAngularSpeed - wheelTeeth * wheelAngularSpeed;
    const meshPhaseAccelerationError = wormHandedness * wormStarts
      * inputAngularAcceleration - wheelTeeth * wheelAngularAcceleration;
    const velocityEpsilon = 1e-9;
    const traverseStage = carriageVelocityX < -velocityEpsilon
      ? 'traversing-frame-moves-left-under-fixed-rod'
      : carriageVelocityX > velocityEpsilon
        ? 'traversing-frame-moves-right-under-fixed-rod'
        : 'traversing-frame-at-stroke-reversal';

    return {
      carriageAcceleration,
      carriageAccelerationX,
      carriageGuideAccelerationError: Math.hypot(
        carriageAcceleration.y,
        carriageAcceleration.z,
      ),
      carriageGuidePositionError: Math.hypot(
        wheelCenter.y - sourceWheelCenterWorld.y,
        wheelCenter.z,
      ),
      carriageGuideVelocityError: Math.hypot(
        carriageVelocity.y,
        carriageVelocity.z,
      ),
      carriageRotation: 0,
      carriageVelocity,
      carriageVelocityX,
      carriageX,
      completePatternPhase: THREE.MathUtils.euclideanModulo(
        inputAngle / fullTurn,
        completePatternInputTurns,
      ) / completePatternInputTurns,
      connectingRodLengthAccelerationError: (
        connectingRodVector.dot(crankWristAcceleration)
          - crankWristVelocity.lengthSq()
      ) / connectingRodLength,
      connectingRodLengthError: connectingRodVector.length()
        - connectingRodLength,
      connectingRodLengthRateError: connectingRodVector.dot(
        crankWristVelocity,
      ) / connectingRodLength,
      connectingRodVector,
      contactPoint,
      crankRadiusError: crankVector.length() - crankRadius,
      crankRelativeAcceleration,
      crankRelativeVelocity,
      crankVector,
      crankWrist,
      crankWristAcceleration,
      crankWristVelocity,
      fixedRodPivot: fixedRodPivot.clone(),
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: currentInputAngularSpeed,
      inputRevolutions: inputAngle / fullTurn,
      inputShaftAxialDisplacement: 0,
      keyedAngularAccelerationError: inputAngularAcceleration
        - inputAngularAcceleration,
      keyedAngularPositionError: inputAngle - inputAngle,
      keyedAngularVelocityError: currentInputAngularSpeed
        - currentInputAngularSpeed,
      keyedAxialSlide: carriageX - sourceWheelCenterWorld.x,
      keyedAxialSlideAcceleration: carriageAccelerationX,
      keyedAxialSlideSpeed: carriageVelocityX,
      meshCenterDistanceError: wormCenter.distanceTo(wheelCenter)
        - wormPitchRadius - wheelPitchRadius,
      meshNormalRelativeVelocityError: 0,
      meshPhaseAccelerationError,
      meshPhaseError,
      meshPhaseVelocityError,
      meshPointError: wormPitchPoint.distanceTo(wheelPitchPoint),
      meshTangentialAccelerationError:
        wormThreadAdvanceAcceleration
          - wheelContactTangentialAcceleration,
      meshTangentialVelocityError: wormThreadAdvanceSpeed
        - wheelContactTangentialSpeed,
      rodHorizontalProjection,
      rodRadicand,
      rodVerticalOffset,
      time,
      traverseStage,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
      wheelCenter,
      wheelContactTangentialAcceleration,
      wheelContactTangentialSpeed,
      wheelContactVelocity,
      wheelDeltaAngle,
      wheelPitchPoint,
      wheelRotationPhase: THREE.MathUtils.euclideanModulo(
        wheelDeltaAngle / fullTurn,
        1,
      ),
      wheelToothAdvance: wheelDeltaAngle / wheelToothPitchAngle,
      wormAngle: wormReferenceAngle + inputAngle,
      wormAngularAcceleration: inputAngularAcceleration,
      wormAngularSpeed: currentInputAngularSpeed,
      wormCenter,
      wormPitchPoint,
      wormThreadAdvanceAcceleration,
      wormThreadAdvanceSpeed,
      wormThreadVelocity,
      wormWheelSharedTranslationError: wormCenter.x - wheelCenter.x,
    };
  };
  const stateAtTime = (time) => stateAtInputKinematics({
    inputAngle: inputAngularSpeed * time,
    inputAngularAcceleration: 0,
    inputAngularSpeed,
    time,
  });

  const carriageVelocityPerWheelRadian = (wheelDeltaAngle) => (
    stateAtInputKinematics({
      inputAngle: wheelDeltaAngle / wheelToWormRatio,
      inputAngularAcceleration: 0,
      inputAngularSpeed: 1 / wheelToWormRatio,
    }).carriageVelocityX
  );
  const reversalWheelAngles = [];
  const reversalSearchSegments = 4096;
  let previousAngle = 0;
  let previousVelocity = carriageVelocityPerWheelRadian(previousAngle);
  for (let segment = 1; segment <= reversalSearchSegments; segment += 1) {
    const angle = segment * fullTurn / reversalSearchSegments;
    const velocity = carriageVelocityPerWheelRadian(angle);
    if (previousVelocity * velocity < 0) {
      let lower = previousAngle;
      let upper = angle;
      let lowerVelocity = previousVelocity;
      for (let iteration = 0; iteration < 60; iteration += 1) {
        const middle = (lower + upper) / 2;
        const middleVelocity = carriageVelocityPerWheelRadian(middle);
        if (lowerVelocity * middleVelocity <= 0) {
          upper = middle;
        } else {
          lower = middle;
          lowerVelocity = middleVelocity;
        }
      }
      reversalWheelAngles.push((lower + upper) / 2);
    }
    previousAngle = angle;
    previousVelocity = velocity;
  }
  if (reversalWheelAngles.length !== 2) {
    throw new Error('Movement 143 must have exactly two carriage reversals.');
  }
  const reversalStates = reversalWheelAngles.map((wheelDeltaAngle) => (
    stateAtInputKinematics({
      inputAngle: wheelDeltaAngle / wheelToWormRatio,
      inputAngularAcceleration: 0,
      inputAngularSpeed,
    })
  ));
  const carriageMinimumX = Math.min(
    ...reversalStates.map(({ carriageX }) => carriageX),
  );
  const carriageMaximumX = Math.max(
    ...reversalStates.map(({ carriageX }) => carriageX),
  );
  const carriageStroke = carriageMaximumX - carriageMinimumX;
  const maximumRodVerticalOffset = Math.abs(
    fixedRodPivot.y - sourceWheelCenterWorld.y,
  ) + crankRadius;
  const minimumRodRadicand = connectingRodLength ** 2
    - maximumRodVerticalOffset ** 2;
  const minimumRodHorizontalProjection = Math.sqrt(
    minimumRodRadicand,
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.57,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.2,
    roughness: 0.51,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.69,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.26,
    roughness: 0.47,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const cylinderAlongZ = (radius, length, material, segments = 36) => {
    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, length, segments),
      material,
    );
    cylinder.rotation.x = Math.PI / 2;
    return cylinder;
  };
  const torusAroundX = (radius, tube, material, segments = 44) => {
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 10, segments),
      material,
    );
    torus.rotation.y = Math.PI / 2;
    return torus;
  };

  const leftPostX = sourceWheelCenterX + (
    sourceLeftPostCenterX - sourceWheelCenter.x
  ) * sourceScale;
  const rightPostX = sourceWheelCenterX + (
    sourceRightPostCenterX - sourceWheelCenter.x
  ) * sourceScale;
  const baseTopY = -(
    sourceBaseY - sourceWheelCenter.y
  ) * sourceScale;
  const guideBarMinimumX = sourceWheelCenterX + (
    sourceGuideBarLeftX - sourceWheelCenter.x
  ) * sourceScale;
  const guideBarMaximumX = sourceWheelCenterX + (
    sourceGuideBarRightX - sourceWheelCenter.x
  ) * sourceScale;
  const guideBarLength = guideBarMaximumX - guideBarMinimumX;
  const guideBarTopY = -(
    sourceGuideBarTopY - sourceWheelCenter.y
  ) * sourceScale;
  const guideBarBottomY = -(
    sourceGuideBarBottomY - sourceWheelCenter.y
  ) * sourceScale;
  const guideBarCenterY = (guideBarTopY + guideBarBottomY) / 2;
  const guideBarHeight = guideBarTopY - guideBarBottomY;
  const rearFrameZ = -0.68;
  const frameTopY = wormAxisY + 0.36;
  const baseHeight = 0.16;
  const baseDepth = 1.05;
  const baseMinimumX = leftPostX - 0.48;
  const baseMaximumX = rightPostX + 0.48;
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-two-post-frame-and-horizontal-guide-bar';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(
      baseMaximumX - baseMinimumX,
      baseHeight,
      baseDepth,
    ),
    frameMaterial,
  );
  base.position.set(
    (baseMinimumX + baseMaximumX) / 2,
    baseTopY - baseHeight / 2,
    rearFrameZ,
  );
  base.userData.role = 'source-fixed-hatched-base';
  const framePosts = [leftPostX, rightPostX].map((x, index) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(
        index === 0 ? 0.32 : 0.3,
        frameTopY - baseTopY,
        0.38,
      ),
      frameMaterial,
    );
    post.position.set(x, (frameTopY + baseTopY) / 2, rearFrameZ);
    post.userData.side = index === 0 ? 'left' : 'right';
    post.userData.role = 'fixed-upright-supporting-shaft-and-guide';
    return post;
  });
  const fixedGuideBar = new THREE.Mesh(
    new THREE.BoxGeometry(guideBarLength, guideBarHeight, 0.26),
    frameMaterial,
  );
  fixedGuideBar.position.set(
    (guideBarMinimumX + guideBarMaximumX) / 2,
    guideBarCenterY,
    rearFrameZ + 0.08,
  );
  fixedGuideBar.userData.axis = X_AXIS.clone();
  fixedGuideBar.userData.role = 'single-fixed-horizontal-bar-guiding-frame';
  const leftBrace = makeBeam(
    new THREE.Vector3(leftPostX - 0.34, baseTopY, rearFrameZ),
    new THREE.Vector3(leftPostX, baseTopY + 0.52, rearFrameZ),
    { color: PALETTE.frame, depth: 0.24, thickness: 0.13 },
  );
  leftBrace.userData.role = 'source-triangular-brace-on-left-standard';
  const shaftBearingRadius = 0.18;
  const shaftBearingTube = 0.055;
  const inputShaftBearings = [leftPostX, rightPostX].map((x, index) => {
    const bearing = torusAroundX(
      shaftBearingRadius,
      shaftBearingTube,
      darkMaterial,
    );
    bearing.position.set(x, wormAxisY, 0);
    bearing.userData.side = index === 0 ? 'left' : 'right';
    bearing.userData.role = 'fixed-bearing-for-keyed-input-shaft';
    return bearing;
  });
  const bearingStandoffs = [leftPostX, rightPostX].map((x, index) => {
    const standoff = makeBeam(
      new THREE.Vector3(x, wormAxisY, rearFrameZ + 0.18),
      new THREE.Vector3(x, wormAxisY, -0.12),
      { color: PALETTE.frame, depth: 0.16, thickness: 0.12 },
    );
    standoff.userData.side = index === 0 ? 'left' : 'right';
    standoff.userData.role = 'fixed-standoff-to-input-shaft-bearing';
    return standoff;
  });

  const fixedPivotPin = cylinderAlongZ(0.085, 0.86, darkMaterial, 34);
  fixedPivotPin.position.set(fixedRodPivot.x, fixedRodPivot.y, 0.16);
  fixedPivotPin.userData.axis = Z_AXIS.clone();
  fixedPivotPin.userData.role = 'fixed-right-hand-connecting-rod-pivot';
  const fixedPivotRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.045, 10, 40),
    accentMaterial,
  );
  const rodPlaneZ = 0.56;
  fixedPivotRing.position.set(
    fixedRodPivot.x,
    fixedRodPivot.y,
    rodPlaneZ + 0.01,
  );
  fixedPivotRing.userData.role = 'fixed-eye-at-right-end-of-connecting-rod';
  const fixedPivotIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 16, 11),
    indexMaterial,
  );
  fixedPivotIndex.position.set(
    fixedRodPivot.x,
    fixedRodPivot.y,
    rodPlaneZ + 0.075,
  );
  fixedPivotIndex.userData.role = 'white-index-on-fixed-rod-pivot';
  fixedFrame.add(
    base,
    ...framePosts,
    fixedGuideBar,
    leftBrace,
    ...inputShaftBearings,
    ...bearingStandoffs,
    fixedPivotPin,
    fixedPivotRing,
    fixedPivotIndex,
  );

  const inputShaft = new THREE.Group();
  inputShaft.position.set(0, wormAxisY, 0);
  inputShaft.userData.axis = X_AXIS.clone();
  inputShaft.userData.fixedAxially = true;
  inputShaft.userData.role = 'fixed-axis-keyed-shaft-rotated-by-left-pulley';
  const inputShaftRotor = new THREE.Group();
  inputShaft.add(inputShaftRotor);
  inputShaft.userData.rotor = inputShaftRotor;
  const inputPulleyX = sourceWheelCenterX + (
    sourceInputPulleyCenterX - sourceWheelCenter.x
  ) * sourceScale;
  const inputPulleyRadius = sourceInputPulleyRadius * sourceScale;
  const inputPulleyWidth = 0.28;
  const shaftMinimumX = inputPulleyX - inputPulleyWidth / 2 - 0.16;
  const shaftMaximumX = rightPostX + 0.36;
  const shaftLength = shaftMaximumX - shaftMinimumX;
  const shaftRadius = 0.055;
  const shaftCore = cylinderAlongX(
    shaftRadius,
    shaftLength,
    darkMaterial,
    34,
  );
  shaftCore.position.x = (shaftMinimumX + shaftMaximumX) / 2;
  shaftCore.userData.role = 'long-fixed-axial-position-input-shaft';
  const keyHeight = 0.035;
  const keyWidth = 0.045;
  const longitudinalKeyway = new THREE.Mesh(
    new THREE.BoxGeometry(
      rightPostX - leftPostX + 0.28,
      keyHeight,
      keyWidth,
    ),
    accentMaterial,
  );
  longitudinalKeyway.position.set(
    (leftPostX + rightPostX) / 2,
    shaftRadius + keyHeight / 2,
    0,
  );
  longitudinalKeyway.userData.role =
    'longitudinal-rotating-groove-and-key-track-on-shaft';
  const inputPulleyDisk = cylinderAlongX(
    inputPulleyRadius * 0.93,
    inputPulleyWidth,
    driverMaterial,
    64,
  );
  inputPulleyDisk.position.x = inputPulleyX;
  inputPulleyDisk.userData.role = 'left-input-pulley-fast-to-keyed-shaft';
  const inputPulleyRim = torusAroundX(
    inputPulleyRadius,
    0.055,
    driverMaterial,
    72,
  );
  inputPulleyRim.position.x = inputPulleyX - inputPulleyWidth / 2 - 0.015;
  inputPulleyRim.userData.role = 'outer-rim-of-left-input-pulley';
  const pulleySpokes = Array.from({ length: 4 }, (_, index) => {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(
        inputPulleyWidth * 0.45,
        inputPulleyRadius * 1.55,
        0.09,
      ),
      darkMaterial,
    );
    spoke.position.x = inputPulleyX - inputPulleyWidth / 2 - 0.018;
    spoke.rotation.x = index * Math.PI / 4;
    spoke.userData.index = index;
    spoke.userData.role = 'input-pulley-spoke';
    return spoke;
  });
  const inputPulleyIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.13, inputPulleyRadius * 0.58),
    indexMaterial,
  );
  inputPulleyIndex.position.set(
    inputPulleyX - inputPulleyWidth / 2 - 0.05,
    inputPulleyRadius * 0.56,
    0,
  );
  inputPulleyIndex.userData.role = 'white-index-showing-input-pulley-spin';
  inputShaftRotor.add(
    shaftCore,
    longitudinalKeyway,
    inputPulleyDisk,
    inputPulleyRim,
    ...pulleySpokes,
    inputPulleyIndex,
  );

  const carriage = new THREE.Group();
  carriage.position.x = sourceWheelCenterWorld.x;
  carriage.userData.role =
    'one-nonrotating-frame-carrying-sliding-worm-and-wheel';
  carriage.userData.translationAxis = X_AXIS.clone();
  const carriageFrameWidth = sourceTraversingFrameWidth * sourceScale;
  const carriageBackplateHeight = guideBarHeight + 0.19;
  const carriageBackplate = new THREE.Mesh(
    new THREE.BoxGeometry(carriageFrameWidth, carriageBackplateHeight, 0.2),
    drivenMaterial,
  );
  carriageBackplate.position.set(0, guideBarCenterY, rearFrameZ + 0.27);
  carriageBackplate.userData.role = 'source-rectangular-slide-behind-wheel';
  const guideClearance = 0.025;
  const guideShoeHeight = 0.11;
  const guideShoeWidth = carriageFrameWidth * 0.88;
  const guideShoes = [-1, 1].map((sideSign) => {
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(guideShoeWidth, guideShoeHeight, 0.34),
      darkMaterial,
    );
    shoe.position.set(
      0,
      guideBarCenterY + sideSign * (
        guideBarHeight / 2 + guideClearance + guideShoeHeight / 2
      ),
      rearFrameZ + 0.27,
    );
    shoe.userData.side = sideSign < 0 ? 'lower' : 'upper';
    shoe.userData.role = 'moving-shoe-capturing-fixed-horizontal-bar';
    return shoe;
  });
  const sideRetainers = [-1, 1].map((sideSign) => {
    const retainer = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.13,
        carriageBackplateHeight + 0.26,
        0.3,
      ),
      drivenMaterial,
    );
    retainer.position.set(
      sideSign * (carriageFrameWidth / 2 - 0.07),
      guideBarCenterY,
      rearFrameZ + 0.36,
    );
    retainer.userData.side = sideSign < 0 ? 'left' : 'right';
    retainer.userData.role = 'side-of-moving-guide-sleeve';
    return retainer;
  });
  const upperCheekX = 0.64;
  const upperCheekBottomY = guideBarTopY + 0.09;
  const upperCheekTopY = wormAxisY + 0.29;
  const upperCheeks = [-1, 1].map((sideSign) => {
    const cheek = makeBeam(
      new THREE.Vector3(
        sideSign * upperCheekX,
        upperCheekBottomY,
        rearFrameZ + 0.35,
      ),
      new THREE.Vector3(
        sideSign * upperCheekX,
        upperCheekTopY,
        rearFrameZ + 0.35,
      ),
      { color: PALETTE.driven, depth: 0.2, thickness: 0.16 },
    );
    cheek.userData.side = sideSign < 0 ? 'left' : 'right';
    cheek.userData.role = 'moving-upright-carrying-worm-bearing';
    return cheek;
  });
  const upperTie = makeBeam(
    new THREE.Vector3(-upperCheekX, upperCheekTopY, rearFrameZ + 0.35),
    new THREE.Vector3(upperCheekX, upperCheekTopY, rearFrameZ + 0.35),
    { color: PALETTE.driven, depth: 0.2, thickness: 0.14 },
  );
  upperTie.userData.role = 'moving-tie-between-worm-bearing-cheeks';
  const wormBearingOffsetX = wormThreadLength / 2 + 0.1;
  const wormCarriageBearings = [-1, 1].map((sideSign) => {
    const bearing = torusAroundX(0.205, 0.055, drivenMaterial, 42);
    bearing.position.set(
      sideSign * wormBearingOffsetX,
      wormAxisY,
      0,
    );
    bearing.userData.side = sideSign < 0 ? 'left' : 'right';
    bearing.userData.role = 'bearing-in-moving-frame-carrying-sliding-worm';
    return bearing;
  });

  const wheelPlaneZ = 0;
  const wheelDepth = 0.3;
  const wheelAxle = cylinderAlongZ(0.13, 0.88, darkMaterial, 36);
  wheelAxle.position.set(0, sourceWheelCenterWorld.y, -0.06);
  wheelAxle.userData.axis = Z_AXIS.clone();
  wheelAxle.userData.role = 'wheel-axle-carried-by-traversing-frame';
  const wheel = makeGear({
    teeth: wheelTeeth,
    radius: wheelPitchRadius,
    depth: wheelDepth,
    color: PALETTE.driven,
    toothHeight: wheelToothHeight,
  });
  wheel.position.set(0, sourceWheelCenterWorld.y, wheelPlaneZ);
  wheel.userData.role = 'twenty-two-tooth-wheel-carried-with-sliding-worm';
  const wheelRotor = wheel.userData.rotor;
  const wheelRotationIndex = wheelRotor.children.at(-1);
  wheelRotationIndex.userData.role = 'white-index-showing-slow-wheel-spin';

  const crankPlaneZ = 0.31;
  const crankRotorLocalVector = rotatePlanar(
    sourceCrankVector,
    -wheelReferenceAngle,
  );
  const wheelCrank = makeBeam(
    new THREE.Vector3(0, 0, crankPlaneZ - wheelPlaneZ),
    new THREE.Vector3(
      crankRotorLocalVector.x,
      crankRotorLocalVector.y,
      crankPlaneZ - wheelPlaneZ,
    ),
    {
      color: PALETTE.accent,
      depth: 0.12,
      jointRadius: 0.105,
      thickness: 0.12,
    },
  );
  wheelCrank.userData.role = 'crank-fast-to-worm-wheel';
  const crankWristPin = cylinderAlongZ(0.075, 0.62, darkMaterial, 32);
  crankWristPin.position.set(
    crankRotorLocalVector.x,
    crankRotorLocalVector.y,
    rodPlaneZ - wheelPlaneZ - 0.11,
  );
  crankWristPin.userData.axis = Z_AXIS.clone();
  crankWristPin.userData.role = 'wrist-secured-in-worm-wheel-crank';
  const crankWristRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.125, 0.04, 10, 38),
    accentMaterial,
  );
  crankWristRing.position.set(
    crankRotorLocalVector.x,
    crankRotorLocalVector.y,
    rodPlaneZ - wheelPlaneZ + 0.01,
  );
  crankWristRing.userData.role = 'front-eye-joining-crank-and-fixed-pivot-rod';
  const crankWristIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.047, 16, 11),
    indexMaterial,
  );
  crankWristIndex.position.copy(crankWristRing.position);
  crankWristIndex.position.z += 0.06;
  crankWristIndex.userData.role = 'white-index-on-wheel-crank-wrist';
  wheelRotor.add(
    wheelCrank,
    crankWristPin,
    crankWristRing,
    crankWristIndex,
  );

  const worm = new THREE.Group();
  worm.position.set(0, wormAxisY, 0);
  worm.userData.axis = X_AXIS.clone();
  worm.userData.role = 'keyed-worm-sliding-axially-with-traversing-frame';
  worm.userData.slidesOnInputShaft = true;
  const wormRotor = new THREE.Group();
  worm.add(wormRotor);
  worm.userData.rotor = wormRotor;
  const wormCoreLength = wormThreadLength + 0.34;
  const wormCore = cylinderAlongX(
    wormCoreRadius,
    wormCoreLength,
    driverMaterial,
    42,
  );
  wormCore.userData.role = 'short-core-of-axially-sliding-worm';
  const wormThreadCurve = horizontalHelixCurve({
    maximumX: wormThreadMaximumX,
    minimumX: wormThreadMinimumX,
    phase: wormThreadPhase,
    pitch: wormAxialPitch,
    radius: wormThreadRadius,
  });
  const wormThreadSegments = wormThreadTurns * 64;
  const wormThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      wormThreadCurve,
      wormThreadSegments,
      wormThreadTubeRadius,
      8,
      false,
    ),
    darkMaterial,
  );
  wormThread.userData.role = 'one-continuous-four-turn-worm-thread';
  const wormHubCollars = [-1, 1].map((sideSign) => {
    const collar = cylinderAlongX(0.22, 0.15, driverMaterial, 38);
    collar.position.x = sideSign * (wormThreadLength / 2 + 0.095);
    collar.userData.side = sideSign < 0 ? 'left' : 'right';
    collar.userData.role = 'hub-of-keyed-sliding-worm';
    return collar;
  });
  const wormKey = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, keyHeight + 0.035, keyWidth + 0.025),
    accentMaterial,
  );
  wormKey.position.set(0, shaftRadius + (keyHeight + 0.035) / 2, 0);
  wormKey.userData.role = 'key-in-worm-hub-sliding-along-shaft-groove';
  const wormRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.045, 0.11),
    indexMaterial,
  );
  wormRotationIndex.position.set(
    wormThreadLength / 2 + 0.1,
    0.18,
    0,
  );
  wormRotationIndex.userData.role = 'white-index-showing-worm-keyed-rotation';
  wormRotor.add(
    wormCore,
    wormThread,
    ...wormHubCollars,
    wormKey,
    wormRotationIndex,
  );

  const carriageTranslationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.04, 0.035),
    indexMaterial,
  );
  carriageTranslationIndex.position.set(
    -0.54,
    guideBarBottomY - 0.16,
    -0.17,
  );
  carriageTranslationIndex.userData.role =
    'white-index-on-nonrotating-traversing-frame';
  carriage.add(
    carriageBackplate,
    ...guideShoes,
    ...sideRetainers,
    ...upperCheeks,
    upperTie,
    ...wormCarriageBearings,
    wheelAxle,
    wheel,
    worm,
    carriageTranslationIndex,
  );

  const connectingRod = makeDynamicLink({
    color: PALETTE.driven,
    depth: 0.14,
    jointRadius: 0.125,
    thickness: 0.09,
  });
  connectingRod.userData.role =
    'finite-rod-from-wheel-wrist-to-fixed-right-frame-pivot';
  const meshContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 16, 11),
    indexMaterial,
  );
  meshContactMarker.userData.noShadow = true;
  meshContactMarker.userData.role = 'white-marker-at-worm-wheel-pitch-contact';
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(8.3, 3.75, 0.01),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-0.8, 0.25, -1.05);
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.noShadow = true;
  cameraEnvelope.userData.role = 'invisible-complete-traverse-camera-envelope';
  root.add(
    cameraEnvelope,
    fixedFrame,
    inputShaft,
    carriage,
    connectingRod,
    meshContactMarker,
  );

  root.userData.mechanism =
    'keyed-axially-sliding-worm-carried-wheel-fixed-rod-traverse';
  root.userData.cameraDistanceScale = 1.02;
  root.userData.blocks = {
    base,
    bearingStandoffs,
    cameraEnvelope,
    carriage,
    carriageBackplate,
    carriageTranslationIndex,
    connectingRod,
    crankWristIndex,
    crankWristPin,
    crankWristRing,
    fixedFrame,
    fixedGuideBar,
    fixedPivotIndex,
    fixedPivotPin,
    fixedPivotRing,
    framePosts,
    guideShoes,
    inputPulleyDisk,
    inputPulleyIndex,
    inputPulleyRim,
    inputShaft,
    inputShaftBearings,
    inputShaftRotor,
    leftBrace,
    longitudinalKeyway,
    meshContactMarker,
    pulleySpokes,
    shaftCore,
    sideRetainers,
    upperCheeks,
    upperTie,
    wheel,
    wheelAxle,
    wheelCrank,
    wheelRotationIndex,
    wheelRotor,
    worm,
    wormCarriageBearings,
    wormCore,
    wormHubCollars,
    wormKey,
    wormRotationIndex,
    wormRotor,
    wormThread,
  };
  root.userData.geometry = {
    baseHeight,
    baseMaximumX,
    baseMinimumX,
    baseTopY,
    carriageBackplateHeight,
    carriageFrameWidth,
    carriageMaximumX,
    carriageMinimumX,
    carriageStroke,
    completePatternInputTurns,
    completePatternPeriod,
    connectingRodLength,
    crankPlaneZ,
    crankRadius,
    fixedRodPivot: fixedRodPivot.clone(),
    frameTopY,
    fullTurn,
    guideBarBottomY,
    guideBarCenterY,
    guideBarHeight,
    guideBarLength,
    guideBarMaximumX,
    guideBarMinimumX,
    guideBarTopY,
    guideClearance,
    guideShoeHeight,
    guideShoeWidth,
    inputAngularSpeed,
    inputPulleyRadius,
    inputPulleyWidth,
    inputPulleyX,
    inputRotationPeriod,
    inputTurnsPerSecond,
    leftPostX,
    maximumRodVerticalOffset,
    minimumRodHorizontalProjection,
    minimumRodRadicand,
    rearFrameZ,
    reversalWheelAngles,
    rightPostX,
    rodPlaneZ,
    shaftLength,
    shaftMaximumX,
    shaftMinimumX,
    shaftRadius,
    sourceBaseY,
    sourceCrankVector: sourceCrankVector.clone(),
    sourceCrankWrist: sourceCrankWrist.clone(),
    sourceCrankWristWorld: sourceCrankWristWorld.clone(),
    sourceFixedRodPivot: sourceFixedRodPivot.clone(),
    sourceGuideBarBottomY,
    sourceGuideBarLeftX,
    sourceGuideBarRightX,
    sourceGuideBarTopY,
    sourceInputPulleyCenterX,
    sourceInputPulleyRadius,
    sourceLeftPostCenterX,
    sourceRightPostCenterX,
    sourceScale,
    sourceTraversingFrameWidth,
    sourceWheelCenter: sourceWheelCenter.clone(),
    sourceWheelCenterWorld: sourceWheelCenterWorld.clone(),
    sourceWheelPitchRadius,
    sourceWheelTeeth,
    sourceWheelToothHeight,
    sourceWheelToWormCenterDistance:
      sourceWheelCenter.y - sourceWormAxisPoint.y,
    sourceWormAxisPoint: sourceWormAxisPoint.clone(),
    sourceWormThreadTurns,
    upperCheekBottomY,
    upperCheekTopY,
    upperCheekX,
    wheelDepth,
    wheelGapCenterPhase,
    wheelOuterRadius,
    wheelPitchRadius,
    wheelPlaneZ,
    wheelReferenceAngle,
    wheelRootRadius,
    wheelTeeth,
    wheelToothHeight,
    wheelToothPitchAngle,
    wheelToWormRatio,
    wormAxialPitch,
    wormAxisY,
    wormCoreLength,
    wormCoreRadius,
    wormHandedness,
    wormLead,
    wormLeadPerRadian,
    wormPitchRadius,
    wormReferenceAngle,
    wormStarts,
    wormThreadLength,
    wormThreadMaximumX,
    wormThreadMinimumX,
    wormThreadPhase,
    wormThreadRadius,
    wormThreadSegments,
    wormThreadTubeRadius,
    wormThreadTurns,
  };
  root.userData.curves = { wormThread: wormThreadCurve };
  root.userData.reversalStates = reversalStates;
  root.userData.stateAtInputKinematics = stateAtInputKinematics;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputShaftRotor.rotation.set(state.inputAngle, 0, 0);
    wormRotor.rotation.set(state.wormAngle, 0, 0);
    carriage.position.set(state.carriageX, 0, 0);
    carriage.rotation.set(0, 0, 0);
    wheelRotor.rotation.set(0, 0, state.wheelAngle);
    connectingRod.userData.setEndpoints(
      new THREE.Vector3(
        state.crankWrist.x,
        state.crankWrist.y,
        rodPlaneZ,
      ),
      new THREE.Vector3(
        fixedRodPivot.x,
        fixedRodPivot.y,
        rodPlaneZ,
      ),
    );
    meshContactMarker.position.set(
      state.contactPoint.x,
      state.contactPoint.y,
      wheelPlaneZ + wheelDepth / 2 + 0.055,
    );
    inputShaft.userData.angularSpeed = state.inputAngularSpeed;
    worm.userData.angularSpeed = state.wormAngularSpeed;
    worm.userData.axialSpeed = state.keyedAxialSlideSpeed;
    wheel.userData.angularSpeed = state.wheelAngularSpeed;
    carriage.userData.velocity = state.carriageVelocity.clone();
    carriage.userData.acceleration = state.carriageAcceleration.clone();
    root.userData.contacts = {
      connectingRodClosure: {
        accelerationError: state.connectingRodLengthAccelerationError,
        fixedPivot: fixedRodPivot.clone(),
        lengthError: state.connectingRodLengthError,
        rateError: state.connectingRodLengthRateError,
        wrist: state.crankWrist.clone(),
      },
      horizontalGuide: {
        accelerationError: state.carriageGuideAccelerationError,
        axis: X_AXIS.clone(),
        positionError: state.carriageGuidePositionError,
        rotationError: state.carriageRotation,
        velocityError: state.carriageGuideVelocityError,
      },
      keyedSlidingWorm: {
        angularAccelerationError: state.keyedAngularAccelerationError,
        angularPositionError: state.keyedAngularPositionError,
        angularVelocityError: state.keyedAngularVelocityError,
        axialSlide: state.keyedAxialSlide,
        axialSlideAcceleration: state.keyedAxialSlideAcceleration,
        axialSlideSpeed: state.keyedAxialSlideSpeed,
      },
      wormWheelMesh: {
        centerDistanceError: state.meshCenterDistanceError,
        contactPoint: state.contactPoint.clone(),
        normalRelativeVelocityError: state.meshNormalRelativeVelocityError,
        phaseAccelerationError: state.meshPhaseAccelerationError,
        phaseError: state.meshPhaseError,
        phaseVelocityError: state.meshPhaseVelocityError,
        pointError: state.meshPointError,
        sharedTranslationError: state.wormWheelSharedTranslationError,
        tangentialAccelerationError: state.meshTangentialAccelerationError,
        tangentialVelocityError: state.meshTangentialVelocityError,
        wheelVelocity: state.wheelContactVelocity.clone(),
        wormVelocity: state.wormThreadVelocity.clone(),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  const model = finish(root, update, new THREE.Vector3(7.2, 4.4, 12.2));
  cameraEnvelope.castShadow = false;
  cameraEnvelope.receiveShadow = false;
  meshContactMarker.castShadow = false;
  meshContactMarker.receiveShadow = false;
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  return model;
}

export function createAuthoredScrewMovement(movement) {
  switch (movement.id) {
    case 102: return commonScrewBoltAndNutMotion();
    case 103: return screwDrivenGuidedSlideMotion();
    case 104: return wormWheelSlidingCarriageMotion();
    case 105: return screwStampingPressMotion();
    case 108: return intersectingReverseThreadTraverseMotion();
    case 109: return changeGearScrewCuttingMotion();
    case 110: return selectableHalfNutTraverseMotion();
    case 111: return differentialMicrometerScrewMotion();
    case 112: return persianQuickThreadDrillMotion();
    case 143: return keyedSlidingWormTraversingFrame();
    default: return null;
  }
}
