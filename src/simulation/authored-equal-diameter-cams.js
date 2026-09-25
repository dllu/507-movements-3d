import * as THREE from 'three';
import {capsule, plate, poly, polygonClipping, ring} from './finite-plate-geometry.js';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function centeredExtrusion(shape, depth, bevel = 0.018) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevel > 0,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 1,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function cylinderAlongZ(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function rotatePlanar(vector, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector3(
    cosine * vector.x - sine * vector.y,
    sine * vector.x + cosine * vector.y,
    vector.z,
  );
}

function makeRoller({
  depth,
  darkMaterial,
  drivenMaterial,
  radius,
  role,
  whiteMaterial,
}) {
  const roller = new THREE.Group();
  roller.userData.axis = Z_AXIS.clone();
  roller.userData.radius = radius;
  roller.userData.role = role;

  const rotor = new THREE.Group();
  rotor.userData.axis = Z_AXIS.clone();
  rotor.userData.role = `${role}-free-rolling-rotor`;
  roller.add(rotor);

  const tread = new THREE.Mesh(ring(radius * 0.4, radius, -depth / 2, depth / 2, 96), drivenMaterial);
  tread.userData.role = `${role}-tread`;
  rotor.add(tread);

  // Brown inks the roller's edge; it has no separate face ring.
  const faceRings = [];

  const rotationIndices = [-1, 1].map((side) => {
    const index = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.44, radius * 0.13, 0.025),
      whiteMaterial,
    );
    index.position.set(
      radius * 0.65,
      0,
      side * (depth / 2 + 0.025),
    );
    index.userData.role = `${role}-white-rolling-index`;
    rotor.add(index);
    return index;
  });

  const axle = cylinderAlongZ(radius * 0.34, depth * 1.54, darkMaterial, 32);
  axle.userData.role = `${role}-fixed-to-yoke-axle`;
  roller.add(axle);

  roller.userData.blocks = {
    axle,
    faceRings,
    rotationIndices,
    rotor,
    tread,
  };
  roller.userData.rotor = rotor;
  return roller;
}

function makeStraightGuide({
  barDepth,
  barHalfHeight,
  clearance,
  frameMaterial,
  role,
  x,
  z,
}) {
  const guide = new THREE.Group();
  guide.position.set(x, 0, z);
  guide.userData.clearance = clearance;
  guide.userData.role = role;

  const shoeHeight = 0.15;
  const shoeWidth = 0.52;
  const shoes = [-1, 1].map((side) => {
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(shoeWidth, shoeHeight, barDepth + 0.16),
      frameMaterial,
    );
    shoe.position.y = side * (
      barHalfHeight + clearance + shoeHeight / 2
    );
    shoe.userData.role = `${role}-${side > 0 ? 'upper' : 'lower'}-shoe`;
    guide.add(shoe);
    return shoe;
  });

  const rearBridge = new THREE.Mesh(
    new THREE.BoxGeometry(
      shoeWidth,
      barHalfHeight * 2 + clearance * 2 + shoeHeight * 2,
      0.13,
    ),
    frameMaterial,
  );
  rearBridge.position.z = -(barDepth + 0.16) / 2 - 0.065;
  rearBridge.userData.role = `${role}-rear-bridge`;
  guide.add(rearBridge);
  guide.userData.blocks = { rearBridge, shoes };
  return guide;
}

function buildArcLengthPrimitive(speedAt, sampleCount) {
  const step = FULL_TURN / sampleCount;
  const cumulative = new Float64Array(sampleCount + 1);
  let priorSpeed = speedAt(0);
  for (let index = 1; index <= sampleCount; index += 1) {
    const speed = speedAt(index * step);
    cumulative[index] = cumulative[index - 1]
      + (priorSpeed + speed) * step / 2;
    priorSpeed = speed;
  }
  const perimeter = cumulative[sampleCount];

  const primitive = (angle) => {
    const turns = Math.floor(angle / FULL_TURN);
    const remainder = angle - turns * FULL_TURN;
    const tablePosition = remainder / step;
    const lowerIndex = Math.floor(tablePosition);
    const fraction = tablePosition - lowerIndex;
    const upperIndex = Math.min(lowerIndex + 1, sampleCount);
    return turns * perimeter + THREE.MathUtils.lerp(
      cumulative[lowerIndex],
      cumulative[upperIndex],
      fraction,
    );
  };
  return { perimeter, primitive, sampleCount, step };
}

function equalDiameterCam(movement) {
  const root = new THREE.Group();

  // Measurements from the 525 px public-domain engraving. At its illustrated
  // reversal, the opposed roller centers lie at x=191 and x=464 about the
  // cam center x=272. Their half-separation is R and their common midpoint
  // offset is A, which independently determines the equal-diameter pitch law
  // r(theta) = R + A cos(3 theta).
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.014;
  const sourceRasterCamCenter = new THREE.Vector2(272, 266);
  const sourceRasterLeftRollerCenter = new THREE.Vector2(191, 266);
  const sourceRasterRightRollerCenter = new THREE.Vector2(464, 266);
  const sourceRasterLeftContact = new THREE.Vector2(209, 266);
  const sourceRasterRightContact = new THREE.Vector2(446, 266);
  const sourceRasterBarTop = new THREE.Vector2(327.5, 246);
  const sourceRasterBarBottom = new THREE.Vector2(327.5, 286);

  const pitchMeanRadius = (
    sourceRasterRightRollerCenter.x - sourceRasterLeftRollerCenter.x
  ) * sourceScale / 2;
  const pitchAmplitude = (
    (sourceRasterRightRollerCenter.x + sourceRasterLeftRollerCenter.x) / 2
      - sourceRasterCamCenter.x
  ) * sourceScale;
  const rollerRadius = (
    sourceRasterRightRollerCenter.x - sourceRasterRightContact.x
  ) * sourceScale;
  const equalDiameter = pitchMeanRadius * 2;
  const lobeCount = 3;
  const camDepth = 0.52;
  const rollerDepth = 0.72;
  const barHalfHeight = (
    sourceRasterBarBottom.y - sourceRasterBarTop.y
  ) * sourceScale / 2;
  const barDepth = 0.25;
  const barHalfLength = 4.62;
  // Brown ends the rod just past the right roller (x=510 at the drawn
  // rightward reversal) with a slightly convex end; the left end is broken
  // off beyond the plate, so only the left side keeps the long run.
  const sourceRasterBarRightEnd = 510;
  const barRightEnd = (sourceRasterBarRightEnd - sourceRasterCamCenter.x)
    * sourceScale - pitchAmplitude;
  // The round rod runs just behind the rollers (whose axles seat in it).
  const barZ = -0.665;
  // A slim eye just clear of the shaft, barely wider than the round rod, so
  // the glimpses between the cam lobes read as the rod itself.
  const bearingReliefRadius = 0.24;
  const yokeEyeOuterRadius = 0.34;
  const camBearingZ = -1.02;
  const guideClearance = 0.035;
  // Only the long broken-off left run can carry a (hidden) straight guide.
  const guideXs = [-3.52];
  const cyclePeriod = 4;
  const camAngularFrequency = FULL_TURN / cyclePeriod;

  const pitchRadiusAt = (theta) => (
    pitchMeanRadius + pitchAmplitude * Math.cos(lobeCount * theta)
  );
  const pitchRadiusDerivativeAt = (theta) => (
    -lobeCount * pitchAmplitude * Math.sin(lobeCount * theta)
  );
  const pitchRadiusSecondDerivativeAt = (theta) => (
    -(lobeCount ** 2) * pitchAmplitude * Math.cos(lobeCount * theta)
  );
  const pitchPointAt = (theta) => {
    const radius = pitchRadiusAt(theta);
    return new THREE.Vector3(
      radius * Math.cos(theta),
      radius * Math.sin(theta),
      0,
    );
  };
  const pitchDerivativeAt = (theta) => {
    const radius = pitchRadiusAt(theta);
    const derivative = pitchRadiusDerivativeAt(theta);
    const cosine = Math.cos(theta);
    const sine = Math.sin(theta);
    return new THREE.Vector3(
      derivative * cosine - radius * sine,
      derivative * sine + radius * cosine,
      0,
    );
  };
  const pitchSpeedAt = (theta) => pitchDerivativeAt(theta).length();
  const pitchSpeedDerivativeAt = (theta) => {
    const radius = pitchRadiusAt(theta);
    const first = pitchRadiusDerivativeAt(theta);
    const second = pitchRadiusSecondDerivativeAt(theta);
    return first * (radius + second) / pitchSpeedAt(theta);
  };
  const outwardNormalAt = (theta) => {
    const derivative = pitchDerivativeAt(theta);
    return new THREE.Vector3(
      derivative.y,
      -derivative.x,
      0,
    ).normalize();
  };
  const camProfilePointAt = (theta) => pitchPointAt(theta).addScaledVector(
    outwardNormalAt(theta),
    -rollerRadius,
  );

  const arcLength = buildArcLengthPrimitive(pitchSpeedAt, 16384);

  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterCamCenter.x) * sourceScale,
    (sourceRasterCamCenter.y - y) * sourceScale,
  );

  const stateAtCamAngle = (
    camAngle,
    camAngularSpeed = -camAngularFrequency,
    camAngularAcceleration = 0,
  ) => {
    const rightTheta = -camAngle;
    const leftTheta = Math.PI - camAngle;
    const rightPitchRadius = pitchRadiusAt(rightTheta);
    const leftPitchRadius = pitchRadiusAt(leftTheta);
    const yokeDisplacement = (
      rightPitchRadius - leftPitchRadius
    ) / 2;
    const displacementDerivative = -lobeCount * pitchAmplitude
      * Math.sin(lobeCount * camAngle);
    const displacementSecondDerivative = -(lobeCount ** 2)
      * pitchAmplitude * Math.cos(lobeCount * camAngle);
    const yokeSpeed = displacementDerivative * camAngularSpeed;
    const yokeAcceleration = displacementSecondDerivative
      * camAngularSpeed ** 2
      + displacementDerivative * camAngularAcceleration;
    const rightRollerCenter = new THREE.Vector3(
      yokeDisplacement + pitchMeanRadius,
      0,
      0,
    );
    const leftRollerCenter = new THREE.Vector3(
      yokeDisplacement - pitchMeanRadius,
      0,
      0,
    );

    const makeContact = (side, theta, rollerCenter, initialTheta) => {
      const localPitchPoint = pitchPointAt(theta);
      const localCamPoint = camProfilePointAt(theta);
      const localNormal = outwardNormalAt(theta);
      const pitchPoint = rotatePlanar(localPitchPoint, camAngle);
      const contactPoint = rotatePlanar(localCamPoint, camAngle);
      const outwardNormal = rotatePlanar(localNormal, camAngle);
      const tangent = new THREE.Vector3(
        -outwardNormal.y,
        outwardNormal.x,
        0,
      );
      const pitchSpeed = pitchSpeedAt(theta);
      const pitchSpeedDerivative = pitchSpeedDerivativeAt(theta);
      const rollerAngle = camAngle + (
        arcLength.primitive(theta) - arcLength.primitive(initialTheta)
      ) / rollerRadius;
      const rollerAngularSpeed = camAngularSpeed
        * (1 - pitchSpeed / rollerRadius);
      const rollerAngularAcceleration = camAngularAcceleration
        * (1 - pitchSpeed / rollerRadius)
        + camAngularSpeed ** 2 * pitchSpeedDerivative / rollerRadius;
      const camContactVelocity = new THREE.Vector3(
        -contactPoint.y * camAngularSpeed,
        contactPoint.x * camAngularSpeed,
        0,
      );
      const rollerCenterVelocity = new THREE.Vector3(yokeSpeed, 0, 0);
      const rollerRadiusVector = contactPoint.clone().sub(rollerCenter);
      const rollerContactVelocity = rollerCenterVelocity.clone().add(
        new THREE.Vector3(
          -rollerRadiusVector.y * rollerAngularSpeed,
          rollerRadiusVector.x * rollerAngularSpeed,
          0,
        ),
      );
      const velocityError = rollerContactVelocity.clone()
        .sub(camContactVelocity);
      return {
        camContactVelocity,
        contactGap: contactPoint.distanceTo(rollerCenter) - rollerRadius,
        contactPoint,
        localCamPoint,
        localNormal,
        localPitchPoint,
        normalVelocityError: velocityError.dot(outwardNormal),
        outwardNormal,
        pitchPoint,
        pitchPointClosureError: pitchPoint.distanceTo(rollerCenter),
        pitchSpeed,
        rollerAngle,
        rollerAngularAcceleration,
        rollerAngularSpeed,
        rollerCenter: rollerCenter.clone(),
        rollerCenterVelocity,
        rollerContactVelocity,
        side,
        tangent,
        tangentialVelocityError: velocityError.dot(tangent),
        theta,
        velocityError,
      };
    };

    const rightContact = makeContact(
      'right',
      rightTheta,
      rightRollerCenter,
      0,
    );
    const leftContact = makeContact(
      'left',
      leftTheta,
      leftRollerCenter,
      Math.PI,
    );
    const rollerCenterSeparation = rightRollerCenter.distanceTo(
      leftRollerCenter,
    );
    const minimumGuideCoverage = Math.min(...guideXs.map((guideX) => (
      guideX < 0
        ? barHalfLength - Math.abs(guideX - yokeDisplacement)
        : barRightEnd - Math.abs(guideX - yokeDisplacement)
    )));

    let stage;
    if (Math.abs(yokeSpeed) < 1e-10) {
      stage = yokeDisplacement > 0
        ? 'source-rightward-bar-reversal'
        : 'leftward-bar-reversal';
    } else {
      stage = yokeSpeed > 0
        ? 'cam-rotating-clockwise-bar-translating-right'
        : 'cam-rotating-clockwise-bar-translating-left';
    }

    return {
      barOffsetClosureError: yokeDisplacement
        - pitchAmplitude * Math.cos(lobeCount * camAngle),
      camAngle,
      camAngularAcceleration,
      camAngularSpeed,
      cyclePhase: THREE.MathUtils.euclideanModulo(-camAngle, FULL_TURN)
        / FULL_TURN,
      equalDiameterError: rightPitchRadius + leftPitchRadius
        - equalDiameter,
      leftContact,
      leftPitchRadius,
      leftRollerAngle: leftContact.rollerAngle,
      leftRollerAngularAcceleration: leftContact.rollerAngularAcceleration,
      leftRollerAngularSpeed: leftContact.rollerAngularSpeed,
      leftRollerCenter,
      minimumGuideCoverage,
      rightContact,
      rightPitchRadius,
      rightRollerAngle: rightContact.rollerAngle,
      rightRollerAngularAcceleration: rightContact.rollerAngularAcceleration,
      rightRollerAngularSpeed: rightContact.rollerAngularSpeed,
      rightRollerCenter,
      rollerCenterSeparation,
      rollerCenterSeparationError: rollerCenterSeparation - equalDiameter,
      stage,
      yokeAcceleration,
      yokeDisplacement,
      yokeSpeed,
    };
  };
  const stateAtPhase = (phase) => stateAtCamAngle(
    -phase,
    -camAngularFrequency,
    0,
  );
  const stateAtTime = (time) => stateAtPhase(
    camAngularFrequency * time,
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.61,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.6,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const cam = new THREE.Group();
  cam.userData.axis = Z_AXIS.clone();
  cam.userData.role = 'fixed-axis-equal-diameter-three-lobe-cam';
  const camRotor = new THREE.Group();
  camRotor.userData.axis = Z_AXIS.clone();
  camRotor.userData.role = 'clockwise-three-lobe-cam-rotor';
  cam.add(camRotor);
  root.add(cam);

  const camShape = new THREE.Shape();
  const profileSegments = 540;
  // A tiny machining allowance bounds the chord error of the finite mesh.
  const profileMeshAllowance = 0.00023;
  for (let index = 0; index < profileSegments; index += 1) {
    const theta = index / profileSegments * FULL_TURN;
    const point = camProfilePointAt(theta);
    const finitePoint = point.clone().addScaledVector(outwardNormalAt(theta), -profileMeshAllowance);
    if (index === 0) camShape.moveTo(finitePoint.x, finitePoint.y);
    else camShape.lineTo(finitePoint.x, finitePoint.y);
  }
  camShape.closePath();
  const camBody = new THREE.Mesh(
    centeredExtrusion(camShape, camDepth, 0),
    driverMaterial,
  );
  camBody.userData.role =
    'roller-radius-inward-offset-of-equal-diameter-pitch-curve';
  camRotor.add(camBody);

  // The cam's inked edge is the plate's outline of the solid cam, not a
  // separate dark band, so no outline tube is added.

  const camHub = cylinderAlongZ(0.62, camDepth * 1.22, driverMaterial, 48);
  camHub.userData.role = 'cam-hub-fixed-to-input-shaft';
  const camShaft = cylinderAlongZ(0.21, 0.71 - camBearingZ + 0.04, darkMaterial, 36);
  camShaft.position.z = (0.71 + camBearingZ - 0.04) / 2;
  camShaft.userData.role = 'rotating-cam-input-shaft';
  const camRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.075, 0.03),
    whiteMaterial,
  );
  camRotationIndex.position.set(0.91, 0, camDepth / 2 + 0.06);
  camRotationIndex.userData.role = 'white-cam-rotation-index';
  camRotor.add(camHub, camRotationIndex, camShaft);

  const yoke = new THREE.Group();
  yoke.userData.axis = X_AXIS.clone();
  yoke.userData.role =
    'single-rigid-horizontal-bar-with-two-opposed-rollers';
  root.add(yoke);
  // Brown draws a round rod. Its two runs are cylinders; the middle is a
  // flat yoke plate with a real oblong eye around the fixed input bearing,
  // hidden behind the cam in the source view and seated inside both runs.
  const yokePlateHalfLength = pitchAmplitude + yokeEyeOuterRadius + 0.1;
  const yokePlateHalfHeight = barHalfHeight * 0.86;
  const yokeOuter = polygonClipping.union(
    poly([
      [-yokePlateHalfLength, -yokePlateHalfHeight],
      [yokePlateHalfLength, -yokePlateHalfHeight],
      [yokePlateHalfLength, yokePlateHalfHeight],
      [-yokePlateHalfLength, yokePlateHalfHeight],
    ]),
    capsule([-pitchAmplitude, 0], [pitchAmplitude, 0], yokeEyeOuterRadius, 48),
  );
  const yokeSection = polygonClipping.difference(yokeOuter,
    capsule([-pitchAmplitude, 0], [pitchAmplitude, 0], bearingReliefRadius, 48));
  const bar = new THREE.Mesh(plate(yokeSection, -barDepth / 2, barDepth / 2), drivenMaterial);
  bar.position.z = barZ;
  bar.userData.role = 'reciprocating-rectilinear-bar';
  yoke.add(bar);
  const rodInnerX = pitchAmplitude + bearingReliefRadius + 0.02;
  const makeRodRun = (fromX, toX, role) => {
    const run = new THREE.Mesh(
      new THREE.CylinderGeometry(barHalfHeight, barHalfHeight, toX - fromX, 40),
      drivenMaterial,
    );
    run.rotation.z = Math.PI / 2;
    run.position.set((fromX + toX) / 2, 0, barZ);
    run.userData.role = role;
    yoke.add(run);
    return run;
  };
  const rodRuns = [
    makeRodRun(-barHalfLength, -rodInnerX, 'reciprocating-round-rod-left-run'),
    makeRodRun(rodInnerX, barRightEnd, 'reciprocating-round-rod-right-run'),
  ];

  const translationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.055, 0.035),
    whiteMaterial,
  );
  translationIndex.position.set(
    -3.05,
    barHalfHeight + 0.045,
    barZ + barDepth / 2 + 0.035,
  );
  translationIndex.userData.role = 'white-bar-translation-index';
  yoke.add(translationIndex);

  const leftRoller = makeRoller({
    darkMaterial,
    depth: rollerDepth,
    drivenMaterial,
    radius: rollerRadius,
    role: 'left-captive-follower-roller',
    whiteMaterial,
  });
  leftRoller.position.x = -pitchMeanRadius;
  const rightRoller = makeRoller({
    darkMaterial,
    depth: rollerDepth,
    drivenMaterial,
    radius: rollerRadius,
    role: 'right-captive-follower-roller',
    whiteMaterial,
  });
  rightRoller.position.x = pitchMeanRadius;
  yoke.add(leftRoller, rightRoller);

  const straightGuides = guideXs.map((x, index) => {
    const guide = makeStraightGuide({
      barDepth: barHalfHeight * 2,
      barHalfHeight,
      clearance: guideClearance,
      frameMaterial,
      role: index === 0
        ? 'fixed-left-straight-bar-guide'
        : 'fixed-right-straight-bar-guide',
      x,
      z: barZ,
    });
    root.add(guide);
    return guide;
  });

  const baseY = -3.18;
  const frameZ = -1.2;
  const base = makeBeam(
    new THREE.Vector3(-4.30, baseY, frameZ),
    new THREE.Vector3(4.30, baseY, frameZ),
    { color: PALETTE.frame, depth: 0.28, thickness: 0.20 },
  );
  base.userData.role = 'fixed-equal-diameter-cam-display-base';
  const camBearingPost = makeBeam(
    new THREE.Vector3(0, baseY, frameZ),
    new THREE.Vector3(0, 0, frameZ),
    { color: PALETTE.frame, depth: 0.24, thickness: 0.18 },
  );
  camBearingPost.userData.role = 'fixed-rear-cam-bearing-post';
  const camBearingArm = new THREE.Mesh(
    ring(0.235, 0.345, frameZ, camBearingZ, 64), frameMaterial,
  );
  camBearingArm.userData.role = 'fixed-cam-bearing-arm';
  const camBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.29, 0.055, 10, 40),
    frameMaterial,
  );
  camBearing.position.z = camBearingZ;
  camBearing.userData.role = 'fixed-rear-cam-shaft-bearing';
  const guidePosts = guideXs.map((x, index) => {
    const post = makeBeam(
      new THREE.Vector3(x, baseY, frameZ),
      new THREE.Vector3(x, -0.58, frameZ),
      { color: PALETTE.frame, depth: 0.21, thickness: 0.16 },
    );
    post.userData.role = index === 0
      ? 'fixed-left-guide-support-post'
      : 'fixed-right-guide-support-post';
    root.add(post);
    return post;
  });
  root.add(base, camBearing, camBearingArm, camBearingPost);

  const sourceState = stateAtCamAngle(0, -camAngularFrequency, 0);
  const sourceIdealizationPixelErrors = {
    barBottom: new THREE.Vector2(
      sourceState.yokeDisplacement,
      -barHalfHeight,
    ).distanceTo(sourcePointToModel(sourceRasterBarBottom)) / sourceScale,
    barTop: new THREE.Vector2(
      sourceState.yokeDisplacement,
      barHalfHeight,
    ).distanceTo(sourcePointToModel(sourceRasterBarTop)) / sourceScale,
    camCenter: new THREE.Vector2(0, 0).distanceTo(
      sourcePointToModel(sourceRasterCamCenter),
    ) / sourceScale,
    leftContact: new THREE.Vector2(
      sourceState.leftContact.contactPoint.x,
      sourceState.leftContact.contactPoint.y,
    ).distanceTo(sourcePointToModel(sourceRasterLeftContact)) / sourceScale,
    leftRollerCenter: new THREE.Vector2(
      sourceState.leftRollerCenter.x,
      sourceState.leftRollerCenter.y,
    ).distanceTo(sourcePointToModel(sourceRasterLeftRollerCenter))
      / sourceScale,
    rightContact: new THREE.Vector2(
      sourceState.rightContact.contactPoint.x,
      sourceState.rightContact.contactPoint.y,
    ).distanceTo(sourcePointToModel(sourceRasterRightContact)) / sourceScale,
    rightRollerCenter: new THREE.Vector2(
      sourceState.rightRollerCenter.x,
      sourceState.rightRollerCenter.y,
    ).distanceTo(sourcePointToModel(sourceRasterRightRollerCenter))
      / sourceScale,
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    bar,
    base,
    cam,
    camBearing,
    camBearingArm,
    camBearingPost,
    camBody,
    camHub,
    camRotationIndex,
    camRotor,
    camShaft,
    guidePosts,
    leftRoller,
    rightRoller,
    rodRuns,
    straightGuides,
    translationIndex,
    yoke,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.48, -3.48, -1.24),
    new THREE.Vector3(5.48, 3.08, 1.06),
  );
  root.userData.geometry = {
    arcLengthSampleCount: arcLength.sampleCount,
    barDepth,
    barHalfHeight,
    barHalfLength,
    barRightEnd,
    barZ,
    bearingReliefRadius,
    yokeEyeOuterRadius,
    camDepth,
    cyclePeriod,
    equalDiameter,
    guideClearance,
    guideXs: [...guideXs],
    lobeCount,
    pitchAmplitude,
    pitchMeanRadius,
    pitchPerimeter: arcLength.perimeter,
    profileSegments,
    profileMeshAllowance,
    rollerDepth,
    rollerRadius,
    sourceScale,
  };
  root.userData.mechanism =
    'one fixed-axis three-lobe cam rotates inside one rigid rectilinear yoke carrying exactly two opposed rollers; the opposite pitch radii always sum to one equal diameter, so both rollers remain simultaneously engaged and the bar completes three smooth reciprocations per cam revolution';
  root.userData.movement = movement;
  root.userData.profile = {
    camProfilePointAt,
    constantDiameterLaw:
      'r(theta) + r(theta + pi) = 2R for r(theta) = R + A cos(3 theta)',
    outwardNormalAt,
    pitchDerivativeAt,
    pitchPointAt,
    pitchRadiusAt,
    pitchRadiusDerivativeAt,
    pitchRadiusSecondDerivativeAt,
    pitchSpeedAt,
    pitchSpeedDerivativeAt,
    rollerOffsetLaw:
      'camProfile(theta) = pitchPoint(theta) - rollerRadius * outwardNormal(theta)',
  };
  root.userData.sourceAnimation = {
    available: true,
    behaviorReferenced: true,
    cyclesPerMinute: 15,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    referenceScope:
      'Used only to confirm one clockwise cam turn, a single translating two-roller yoke, continuous bilateral contact, and three bar reciprocations; no proprietary curve coordinates or drawing code were copied.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate276: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'one fixed-axis three-lobe cam, one rigid horizontal bar, two opposed follower rollers on that bar, and no belt or second cam',
      measurementUncertaintyPixels: 3,
      profileShapeUncertaintyPixels: 18,
      rasterBarBottom: {
        x: sourceRasterBarBottom.x,
        y: sourceRasterBarBottom.y,
      },
      rasterBarTop: {
        x: sourceRasterBarTop.x,
        y: sourceRasterBarTop.y,
      },
      rasterCamCenter: {
        x: sourceRasterCamCenter.x,
        y: sourceRasterCamCenter.y,
      },
      rasterLeftContact: {
        x: sourceRasterLeftContact.x,
        y: sourceRasterLeftContact.y,
      },
      rasterLeftRollerCenter: {
        x: sourceRasterLeftRollerCenter.x,
        y: sourceRasterLeftRollerCenter.y,
      },
      rasterRightContact: {
        x: sourceRasterRightContact.x,
        y: sourceRasterRightContact.y,
      },
      rasterRightRollerCenter: {
        x: sourceRasterRightRollerCenter.x,
        y: sourceRasterRightRollerCenter.y,
      },
      sourceIdealizationPixelErrors,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 69,
      edition: 21,
      illustrationPage: 68,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCamAngle = stateAtCamAngle;
  root.userData.stateAtPhase = stateAtPhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    camAngularFrequency,
    camTurnsPerCycle: 1,
    cyclePeriod,
    sourcePhase: 0,
  };
  root.userData.transmission = {
    camTurnsPerCycle: 1,
    constraintLaw:
      'yokeDisplacement = A cos(3*camAngle), with fixed roller-center separation 2R',
    cyclePeriod,
    equalDiameter,
    noSlipRollerLaw:
      'rollerAngle = camAngle + signedPitchArcLength/rollerRadius',
    reciprocationsPerCamTurn: lobeCount,
    rollerCenterSeparation: equalDiameter,
    simultaneousContact: true,
    stateAtCamAngle,
    stateAtPhase,
    stateAtTime,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    camRotor.rotation.z = state.camAngle;
    cam.userData.angularAcceleration = state.camAngularAcceleration;
    cam.userData.angularSpeed = state.camAngularSpeed;
    yoke.position.x = state.yokeDisplacement;
    yoke.userData.acceleration = new THREE.Vector3(
      state.yokeAcceleration,
      0,
      0,
    );
    yoke.userData.velocity = new THREE.Vector3(state.yokeSpeed, 0, 0);
    leftRoller.userData.rotor.rotation.z = state.leftRollerAngle;
    leftRoller.userData.angularAcceleration =
      state.leftRollerAngularAcceleration;
    leftRoller.userData.angularSpeed = state.leftRollerAngularSpeed;
    rightRoller.userData.rotor.rotation.z = state.rightRollerAngle;
    rightRoller.userData.angularAcceleration =
      state.rightRollerAngularAcceleration;
    rightRoller.userData.angularSpeed = state.rightRollerAngularSpeed;
    root.userData.contacts = {
      leftRollerCam: state.leftContact,
      rightRollerCam: state.rightContact,
    };
    root.userData.kinematics = state;
  };
  update(0);
  root.userData.hideGround = true;
  // Brown draws no phase indices on the cam, bar or rollers.
  const whiteIndices = [];
  root.traverse((object) => {
    if (/^white-|-white-/.test(object.userData.role ?? '')) whiteIndices.push(object);
  });
  for (const object of whiteIndices) object.removeFromParent();
  root.traverse(object => {
    for (const material of object.material ? [].concat(object.material) : []) material.fog = false;
  });
  markShadows(root);
  return {
    root,
    update,
    // Brown's figure is a face-on elevation with the bar level.
    cameraDirection: new THREE.Vector3(0.3, 0.2, 12),
  };
}

export function createAuthoredEqualDiameterCamMovement(movement) {
  if (movement.id !== 276) return null;
  const result = equalDiameterCam(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
