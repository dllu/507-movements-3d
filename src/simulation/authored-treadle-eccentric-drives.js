import * as THREE from 'three';
import {
  PALETTE,
  makePulley,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function cross2(first, second) {
  return first.x * second.y - first.y * second.x;
}

function rotateQuarter(vector) {
  return new THREE.Vector2(-vector.y, vector.x);
}

function unwrapNear(angle, reference) {
  return reference + THREE.MathUtils.euclideanModulo(
    angle - reference + Math.PI,
    FULL_TURN,
  ) - Math.PI;
}

function circleIntersections(firstCenter, firstRadius, secondCenter,
  secondRadius) {
  const centerVector = secondCenter.clone().sub(firstCenter);
  const centerDistance = centerVector.length();
  if (centerDistance > firstRadius + secondRadius
    || centerDistance < Math.abs(firstRadius - secondRadius)
    || centerDistance === 0) {
    throw new RangeError('Movement 374 circle constraints do not intersect.');
  }
  const along = (
    firstRadius ** 2 - secondRadius ** 2 + centerDistance ** 2
  ) / (2 * centerDistance);
  const transverse = Math.sqrt(Math.max(
    0,
    firstRadius ** 2 - along ** 2,
  ));
  const direction = centerVector.multiplyScalar(1 / centerDistance);
  const base = firstCenter.clone().addScaledVector(direction, along);
  const perpendicular = rotateQuarter(direction);
  return [
    base.clone().addScaledVector(perpendicular, transverse),
    base.clone().addScaledVector(perpendicular, -transverse),
  ];
}

function tubeBetween(start, end, radius, material) {
  return new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.LineCurve3(start, end),
      1,
      radius,
      10,
      false,
    ),
    material,
  );
}

function treadleEccentricBandDrive(movement) {
  const root = new THREE.Group();

  const sourceScale = 0.22;
  const sourceEccentricity = 2.5;
  const sourceEccentricRadius = 5;
  const sourceTreadleRollerRadius = 1.5;
  const sourceTreadlePivot = new THREE.Vector2(14.469675, -16.60615);
  const sourceRestRollerCenter = new THREE.Vector2(0, -16.60615);
  const sourceRestEccentricCenter = new THREE.Vector2(-2.5, 0);
  const shaftCenter = new THREE.Vector2(-0.64, 1.54);
  const eccentricity = sourceEccentricity * sourceScale;
  const eccentricPulleyRadius = sourceEccentricRadius * sourceScale;
  const treadleRollerRadius = sourceTreadleRollerRadius * sourceScale;
  const treadlePivot = shaftCenter.clone().addScaledVector(
    sourceTreadlePivot,
    sourceScale,
  );
  const restRollerCenter = shaftCenter.clone().addScaledVector(
    sourceRestRollerCenter,
    sourceScale,
  );
  const restEccentricCenter = shaftCenter.clone().addScaledVector(
    sourceRestEccentricCenter,
    sourceScale,
  );
  const treadleRadius = treadlePivot.distanceTo(restRollerCenter);
  const pulleyCenterDistance = restEccentricCenter.distanceTo(
    restRollerCenter,
  );
  const eccentricRadiusRatio = eccentricPulleyRadius
    / treadleRollerRadius;
  const shaftPeriod = 2;
  const shaftAngularSpeed = FULL_TURN / shaftPeriod;
  const shaftTurnsPerDemonstration = 3;
  const demonstrationPeriod = shaftPeriod * shaftTurnsPerDemonstration;
  const shaftStartAngle = 0;
  const rollerStartAngle = THREE.MathUtils.degToRad(13);
  const wheelPlaneZ = 0.18;
  const beltPlaneZ = 0.34;

  const radiusDifference = eccentricPulleyRadius
    - treadleRollerRadius;
  const tangentNormalAlong = radiusDifference / pulleyCenterDistance;
  const tangentNormalAcross = Math.sqrt(
    1 - tangentNormalAlong ** 2,
  );
  const upperNormalLocal = new THREE.Vector2(
    tangentNormalAlong,
    tangentNormalAcross,
  );
  const lowerNormalLocal = new THREE.Vector2(
    tangentNormalAlong,
    -tangentNormalAcross,
  );
  const upperRunTangentLocal = new THREE.Vector2(
    tangentNormalAcross,
    -tangentNormalAlong,
  );
  const lowerRunTangentLocal = new THREE.Vector2(
    -tangentNormalAcross,
    -tangentNormalAlong,
  );
  const eccentricUpperTangentLocal = upperNormalLocal.clone()
    .multiplyScalar(eccentricPulleyRadius);
  const rollerUpperTangentLocal = new THREE.Vector2(
    pulleyCenterDistance,
    0,
  ).addScaledVector(upperNormalLocal, treadleRollerRadius);
  const eccentricLowerTangentLocal = lowerNormalLocal.clone()
    .multiplyScalar(eccentricPulleyRadius);
  const rollerLowerTangentLocal = new THREE.Vector2(
    pulleyCenterDistance,
    0,
  ).addScaledVector(lowerNormalLocal, treadleRollerRadius);
  const straightRunLength = Math.sqrt(
    pulleyCenterDistance ** 2 - radiusDifference ** 2,
  );
  const tangentNormalAngle = Math.acos(tangentNormalAlong);
  const rollerWrapAngle = 2 * tangentNormalAngle;
  const eccentricWrapAngle = FULL_TURN - rollerWrapAngle;
  const beltLength = 2 * straightRunLength
    + eccentricPulleyRadius * eccentricWrapAngle
    + treadleRollerRadius * rollerWrapAngle;

  const restCenterlineAngle = Math.atan2(
    restRollerCenter.y - restEccentricCenter.y,
    restRollerCenter.x - restEccentricCenter.x,
  );
  const restTreadleAngle = Math.atan2(
    restRollerCenter.y - treadlePivot.y,
    restRollerCenter.x - treadlePivot.x,
  );

  const stateAtTime = (time) => {
    const shaftTravel = shaftAngularSpeed * time;
    const shaftAngle = shaftStartAngle + shaftTravel;
    const eccentricOffset = new THREE.Vector2(
      -eccentricity * Math.cos(shaftAngle),
      -eccentricity * Math.sin(shaftAngle),
    );
    const eccentricCenter = shaftCenter.clone().add(eccentricOffset);
    const candidates = circleIntersections(
      eccentricCenter,
      pulleyCenterDistance,
      treadlePivot,
      treadleRadius,
    );
    const rollerCenter = candidates[0].distanceTo(restRollerCenter)
      <= candidates[1].distanceTo(restRollerCenter)
      ? candidates[0] : candidates[1];
    const centerline = rollerCenter.clone().sub(eccentricCenter);
    const centerlineUnit = centerline.clone()
      .multiplyScalar(1 / pulleyCenterDistance);
    const centerlineTangent = rotateQuarter(centerlineUnit);
    const centerlineAngle = unwrapNear(
      Math.atan2(centerline.y, centerline.x),
      restCenterlineAngle,
    );
    const treadleVector = rollerCenter.clone().sub(treadlePivot);
    const treadleUnit = treadleVector.clone()
      .multiplyScalar(1 / treadleRadius);
    const treadleTangent = rotateQuarter(treadleUnit);
    const treadleAngle = unwrapNear(
      Math.atan2(treadleVector.y, treadleVector.x),
      restTreadleAngle,
    );
    const eccentricCenterVelocity = rotateQuarter(eccentricOffset)
      .multiplyScalar(shaftAngularSpeed);
    const velocityDenominator = cross2(
      centerlineTangent,
      treadleTangent,
    );
    const centerlineAngularSpeed = -cross2(
      eccentricCenterVelocity,
      treadleTangent,
    ) / (pulleyCenterDistance * velocityDenominator);
    const treadleAngularSpeed = -cross2(
      eccentricCenterVelocity,
      centerlineTangent,
    ) / (treadleRadius * velocityDenominator);
    const rollerCenterVelocityFromBelt = eccentricCenterVelocity.clone()
      .addScaledVector(
        centerlineTangent,
        pulleyCenterDistance * centerlineAngularSpeed,
      );
    const rollerCenterVelocityFromTreadle = treadleTangent.clone()
      .multiplyScalar(treadleRadius * treadleAngularSpeed);
    const rollerAngularSpeed = centerlineAngularSpeed
      + eccentricRadiusRatio * (
        shaftAngularSpeed - centerlineAngularSpeed
      );
    const rollerAngle = rollerStartAngle
      + eccentricRadiusRatio * shaftTravel
      + (1 - eccentricRadiusRatio) * (
        centerlineAngle - restCenterlineAngle
      );
    const beltCirculationSpeed = -eccentricPulleyRadius * (
      shaftAngularSpeed - centerlineAngularSpeed
    );
    const beltTravel = -eccentricPulleyRadius * (
      shaftTravel - (centerlineAngle - restCenterlineAngle)
    );
    const toWorldVector = (local) => centerlineUnit.clone()
      .multiplyScalar(local.x)
      .addScaledVector(centerlineTangent, local.y);
    const toWorldPoint = (local) => eccentricCenter.clone()
      .add(toWorldVector(local));
    const topUpperPoint = toWorldPoint(eccentricUpperTangentLocal);
    const bottomUpperPoint = toWorldPoint(rollerUpperTangentLocal);
    const topLowerPoint = toWorldPoint(eccentricLowerTangentLocal);
    const bottomLowerPoint = toWorldPoint(rollerLowerTangentLocal);
    const upperNormal = toWorldVector(upperNormalLocal);
    const lowerNormal = toWorldVector(lowerNormalLocal);
    const upperPositiveTangent = toWorldVector(upperRunTangentLocal);
    const lowerPositiveTangent = toWorldVector(lowerRunTangentLocal);
    const transportVelocityAt = (point) => eccentricCenterVelocity.clone()
      .addScaledVector(
        rotateQuarter(point.clone().sub(eccentricCenter)),
        centerlineAngularSpeed,
      );
    const upperPulleyVelocityAt = (point) => (
      eccentricCenterVelocity.clone().addScaledVector(
        rotateQuarter(point.clone().sub(eccentricCenter)),
        shaftAngularSpeed,
      )
    );
    const rollerVelocityAt = (point) => (
      rollerCenterVelocityFromTreadle.clone().addScaledVector(
        rotateQuarter(point.clone().sub(rollerCenter)),
        rollerAngularSpeed,
      )
    );
    const beltVelocityAt = (point, positiveTangent) => (
      transportVelocityAt(point).addScaledVector(
        positiveTangent,
        beltCirculationSpeed,
      )
    );
    const contacts = {
      eccentricLower: {
        beltVelocity: beltVelocityAt(
          topLowerPoint,
          lowerPositiveTangent,
        ),
        normal: lowerNormal.clone(),
        point: topLowerPoint,
        positivePathTangent: lowerPositiveTangent.clone(),
        pulleyVelocity: upperPulleyVelocityAt(topLowerPoint),
      },
      eccentricUpper: {
        beltVelocity: beltVelocityAt(
          topUpperPoint,
          upperPositiveTangent,
        ),
        normal: upperNormal.clone(),
        point: topUpperPoint,
        positivePathTangent: upperPositiveTangent.clone(),
        pulleyVelocity: upperPulleyVelocityAt(topUpperPoint),
      },
      rollerLower: {
        beltVelocity: beltVelocityAt(
          bottomLowerPoint,
          lowerPositiveTangent,
        ),
        normal: lowerNormal.clone(),
        point: bottomLowerPoint,
        positivePathTangent: lowerPositiveTangent.clone(),
        pulleyVelocity: rollerVelocityAt(bottomLowerPoint),
      },
      rollerUpper: {
        beltVelocity: beltVelocityAt(
          bottomUpperPoint,
          upperPositiveTangent,
        ),
        normal: upperNormal.clone(),
        point: bottomUpperPoint,
        positivePathTangent: upperPositiveTangent.clone(),
        pulleyVelocity: rollerVelocityAt(bottomUpperPoint),
      },
    };
    let maximumNoSlipError = 0;
    for (const contact of Object.values(contacts)) {
      contact.noSlipError = contact.beltVelocity.distanceTo(
        contact.pulleyVelocity,
      );
      maximumNoSlipError = Math.max(
        maximumNoSlipError,
        contact.noSlipError,
      );
    }
    return {
      beltCirculationSpeed,
      beltTravel,
      centerDistanceResidual: centerline.length()
        - pulleyCenterDistance,
      centerlineAngle,
      centerlineAngularSpeed,
      contacts,
      eccentricCenter,
      eccentricCenterVelocity,
      maximumNoSlipError,
      rollerAngle,
      rollerAngularSpeed,
      rollerCenter,
      rollerCenterVelocity: rollerCenterVelocityFromTreadle,
      rollerVelocityClosureError: rollerCenterVelocityFromBelt.clone()
        .sub(rollerCenterVelocityFromTreadle),
      shaftAngle,
      shaftAngularSpeed,
      shaftTravel,
      treadleAngle,
      treadleAngularSpeed,
      treadleRadiusResidual: treadleVector.length() - treadleRadius,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const beltMaterial = matte(PALETTE.belt, {
    metalness: 0.05,
    roughness: 0.58,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const shaftRotor = new THREE.Group();
  shaftRotor.position.set(shaftCenter.x, shaftCenter.y, wheelPlaneZ);
  shaftRotor.userData.axis = new THREE.Vector3(0, 0, 1);
  shaftRotor.userData.role =
    'continuously-rotating-output-shaft-carrying-round-eccentric-pulley';
  root.add(shaftRotor);
  const eccentricPulley = makePulley({
    radius: eccentricPulleyRadius,
    width: 0.28,
    color: PALETTE.driven,
    grooves: 1,
    spokes: 6,
  });
  eccentricPulley.position.x = -eccentricity;
  eccentricPulley.userData.role =
    'circular-pulley-mounted-eccentrically-on-output-shaft';
  shaftRotor.add(eccentricPulley);
  const shaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.050, 0.035),
    whiteMaterial,
  );
  shaftIndex.position.set(0.26, 0, 0.21);
  shaftIndex.userData.role =
    'white-index-showing-continuous-output-shaft-rotation';
  shaftRotor.add(shaftIndex);

  const treadle = new THREE.Group();
  treadle.position.set(treadlePivot.x, treadlePivot.y, 0.02);
  treadle.userData.axis = new THREE.Vector3(0, 0, 1);
  treadle.userData.role =
    'oscillating-treadle-pivoted-at-right-hand-fixed-fulcrum';
  root.add(treadle);
  const treadleBehindPivot = 0.30;
  const treadleBeyondRoller = 1.26;
  const treadleLength = treadleBehindPivot
    + treadleRadius + treadleBeyondRoller;
  const treadleBeam = new THREE.Mesh(
    new THREE.BoxGeometry(treadleLength, 0.17, 0.30),
    matte(PALETTE.driver, { metalness: 0.10, roughness: 0.62 }),
  );
  treadleBeam.position.x = (
    treadleRadius + treadleBeyondRoller - treadleBehindPivot
  ) / 2;
  treadleBeam.userData.role =
    'foot-operated-treadle-carrying-belt-roller';
  treadle.add(treadleBeam);
  const footPad = new THREE.Mesh(
    new THREE.BoxGeometry(0.94, 0.27, 0.52),
    matte(PALETTE.driver, { metalness: 0.08, roughness: 0.65 }),
  );
  footPad.position.x = treadleRadius + treadleBeyondRoller - 0.42;
  footPad.userData.role = 'broad-foot-pad-at-free-end-of-treadle';
  treadle.add(footPad);
  const treadleRoller = makePulley({
    radius: treadleRollerRadius,
    width: 0.28,
    color: PALETTE.brass,
    grooves: 1,
    spokes: 4,
  });
  treadleRoller.position.set(treadleRadius, 0, wheelPlaneZ - 0.02);
  treadleRoller.userData.role =
    'free-spinning-belt-roller-carried-on-moving-treadle';
  treadle.add(treadleRoller);
  const rollerAxle = cylinderAlongZ(0.070, 0.42, darkMaterial, 24);
  rollerAxle.position.set(treadleRadius, 0, wheelPlaneZ - 0.04);
  rollerAxle.userData.role =
    'roller-axle-fixed-in-treadle-but-not-fixed-in-space';
  treadle.add(rollerAxle);

  const belt = new THREE.Group();
  belt.position.z = beltPlaneZ;
  belt.userData.isBelt = true;
  belt.userData.role =
    'one-constant-length-endless-band-linking-treadle-roller-and-eccentric';
  const beltTubeRadius = 0.038;
  const vector3 = (point) => new THREE.Vector3(point.x, point.y, 0);
  const upperStraightRun = tubeBetween(
    vector3(eccentricUpperTangentLocal),
    vector3(rollerUpperTangentLocal),
    beltTubeRadius,
    beltMaterial,
  );
  upperStraightRun.userData.role =
    'first-straight-external-tangent-run-of-single-band';
  belt.add(upperStraightRun);
  const lowerStraightRun = tubeBetween(
    vector3(rollerLowerTangentLocal),
    vector3(eccentricLowerTangentLocal),
    beltTubeRadius,
    beltMaterial,
  );
  lowerStraightRun.userData.role =
    'second-straight-external-tangent-run-of-single-band';
  belt.add(lowerStraightRun);
  const eccentricWrap = new THREE.Mesh(
    new THREE.TorusGeometry(
      eccentricPulleyRadius,
      beltTubeRadius,
      9,
      64,
      eccentricWrapAngle,
    ),
    beltMaterial,
  );
  eccentricWrap.rotation.z = tangentNormalAngle;
  eccentricWrap.userData.role =
    'long-wrap-of-single-band-around-round-eccentric-pulley';
  belt.add(eccentricWrap);
  const rollerWrap = new THREE.Mesh(
    new THREE.TorusGeometry(
      treadleRollerRadius,
      beltTubeRadius,
      9,
      42,
      rollerWrapAngle,
    ),
    beltMaterial,
  );
  rollerWrap.position.x = pulleyCenterDistance;
  rollerWrap.rotation.z = -tangentNormalAngle;
  rollerWrap.userData.role =
    'short-wrap-of-same-single-band-around-treadle-roller';
  belt.add(rollerWrap);
  root.add(belt);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(6.10, 0.16, 0.72),
    frameMaterial,
  );
  base.position.set(0.10, -2.65, -0.22);
  base.userData.fixed = true;
  base.userData.role = 'fixed-base-of-treadle-drive-demonstrator';
  root.add(base);
  const shaftPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.21, 4.08, 0.38),
    frameMaterial,
  );
  shaftPost.position.set(shaftCenter.x, -0.49, -0.24);
  shaftPost.userData.fixed = true;
  shaftPost.userData.role = 'fixed-standard-supporting-upper-shaft';
  root.add(shaftPost);
  const shaftBearing = cylinderAlongZ(0.23, 0.46, frameMaterial, 30);
  shaftBearing.position.set(shaftCenter.x, shaftCenter.y, -0.02);
  shaftBearing.userData.fixed = true;
  shaftBearing.userData.role = 'fixed-bearing-at-eccentric-shaft-axis';
  root.add(shaftBearing);
  const shaftPin = cylinderAlongZ(0.105, 0.72, darkMaterial, 28);
  shaftPin.position.set(0, 0, -0.05);
  shaftPin.userData.role = 'rotating-output-shaft-through-fixed-bearing';
  shaftRotor.add(shaftPin);
  const pivotPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 1.12, 0.42),
    frameMaterial,
  );
  pivotPost.position.set(treadlePivot.x, -2.10, -0.18);
  pivotPost.userData.fixed = true;
  pivotPost.userData.role = 'right-hand-fixed-treadle-pivot-standard';
  root.add(pivotPost);
  const treadlePivotBearing = cylinderAlongZ(
    0.20,
    0.54,
    frameMaterial,
    28,
  );
  treadlePivotBearing.position.set(
    treadlePivot.x,
    treadlePivot.y,
    -0.01,
  );
  treadlePivotBearing.userData.fixed = true;
  treadlePivotBearing.userData.role = 'fixed-treadle-fulcrum-bearing';
  root.add(treadlePivotBearing);
  const treadlePivotPin = cylinderAlongZ(0.075, 0.68, darkMaterial, 24);
  treadlePivotPin.position.set(
    treadlePivot.x,
    treadlePivot.y,
    0.12,
  );
  treadlePivotPin.userData.fixed = true;
  treadlePivotPin.userData.role = 'fixed-treadle-fulcrum-pin';
  root.add(treadlePivotPin);

  const update = (time) => {
    const state = stateAtTime(time);
    shaftRotor.rotation.z = state.shaftAngle;
    treadle.rotation.z = state.treadleAngle;
    setSpin(
      treadleRoller,
      state.rollerAngle - state.treadleAngle,
    );
    belt.position.set(
      state.eccentricCenter.x,
      state.eccentricCenter.y,
      beltPlaneZ,
    );
    belt.rotation.z = state.centerlineAngle;
    root.userData.currentState = state;
    root.userData.beltContacts = state.contacts;
  };

  root.userData = {
    archetype: movement.archetype,
    beltPath: {
      beltLength,
      eccentricLowerTangentLocal,
      eccentricUpperTangentLocal,
      eccentricWrapAngle,
      lowerNormalLocal,
      lowerRunTangentLocal,
      rollerLowerTangentLocal,
      rollerUpperTangentLocal,
      rollerWrapAngle,
      straightRunLength,
      tangentNormalAcross,
      tangentNormalAlong,
      tangentNormalAngle,
      upperNormalLocal,
      upperRunTangentLocal,
    },
    blocks: {
      base,
      belt,
      eccentricPulley,
      eccentricWrap,
      footPad,
      lowerStraightRun,
      pivotPost,
      rollerAxle,
      rollerWrap,
      shaftBearing,
      shaftIndex,
      shaftPin,
      shaftPost,
      shaftRotor,
      treadle,
      treadleBeam,
      treadlePivotBearing,
      treadlePivotPin,
      treadleRoller,
      upperStraightRun,
    },
    circleIntersections,
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      input:
        'oscillation of the foot treadle; the reversible one-coordinate model is parameterized by continuous shaft angle for an unambiguous closed demonstration',
      note:
        'the eccentric center, constant pulley-center separation, treadle-roller arc, lower-roller spin, and every belt contact follow from the one shaft coordinate',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid shaft eccentric and treadle',
        'massless inextensible single endless band',
        'zero belt slip at both round pulleys',
        'lossless pins and bearings',
        'quasi-static reversible kinematics with flywheel inertia omitted',
      ],
      sourceSpecifiesPhysicalScaleSpeedBeltThicknessOrInertia: false,
      treatment:
        'the source animation supplies relative linkage dimensions and phase but no physical scale, speed, belt thickness, force, or inertia; scaled geometry is reconstructed independently and the circle constraints, differential rates, moving-belt transport, and no-slip roller spin are solved analytically',
    },
    fidelity: 'authored',
    geometry: {
      beltPlaneZ,
      demonstrationPeriod,
      eccentricPulleyRadius,
      eccentricRadiusRatio,
      eccentricity,
      pulleyCenterDistance,
      restCenterlineAngle,
      restEccentricCenter,
      restRollerCenter,
      restTreadleAngle,
      rollerStartAngle,
      shaftAngularSpeed,
      shaftCenter,
      shaftPeriod,
      shaftStartAngle,
      shaftTurnsPerDemonstration,
      sourceScale,
      treadlePivot,
      treadleRadius,
      treadleRollerRadius,
      wheelPlaneZ,
    },
    mechanism:
      'one-foot-treadle-carries-one-free-roller-connected-by-one-constant-length-endless-band-to-one-round-pulley-mounted-eccentrically-on-the-continuously-rotating-shaft',
    officialDescription: movement.description,
    sourceAnimation: {
      available: true,
      officialCanvasModelPresent: true,
      sourcePrescribedPhysicalTiming: false,
      sourcePrescribesRelativeGeometryAndPhase: true,
    },
    sourceReference: {
      brownPlate374: {
        alternateEccentricCenter: new THREE.Vector2(341, 106),
        eccentricPulleyCenter: new THREE.Vector2(251, 101),
        eccentricPulleyRadiusPixels: 89,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 7,
        shaftCenter: new THREE.Vector2(293, 101),
        treadlePivot: new THREE.Vector2(417, 425),
        treadleRollerCenter: new THREE.Vector2(238, 386),
        treadleRollerRadiusPixels: 27,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'rotary motion is produced at the shaft from a treadle',
          'one endless band is used',
          'the band runs from a roller carried on the treadle',
          'the band runs to an eccentric carried on the shaft',
        ],
        engravingEvidence:
          'the plate shows a right-pivoted treadle, one small roller on the treadle, two runs of the same band, a circular upper pulley offset from the shaft center, and a dashed opposite eccentric position',
        reconstructionDisclosure:
          'colors, depth, supports, physical scale, shaft speed, and three-turn display cycle are engineered; no belt beads are added, and the original animation is used only to resolve relative dimensions and the intended assembly rather than copied as geometry or code',
      },
      officialAnimationGeometry: {
        eccentricCenterAtZero: sourceRestEccentricCenter.clone(),
        eccentricPulleyRadius: sourceEccentricRadius,
        eccentricity: sourceEccentricity,
        lowerRollerRadius: sourceTreadleRollerRadius,
        lowerRollerRestCenter: sourceRestRollerCenter.clone(),
        shaftCenter: new THREE.Vector2(0, 0),
        treadlePivot: sourceTreadlePivot.clone(),
      },
      officialPage: 'https://507movements.com/mm_374.html',
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod,
      note:
        'three uniform shaft revolutions close the visible 10:3 roller index after ten roller turns and the treadle completes three smooth oscillations; the unmarked one-piece belt path also closes, while no artificial bead or texture phase is imposed',
      shaftPeriod,
    },
    transmission: {
      beltTransportLaw:
        'signed belt circulation speed is -R_eccentric times (shaft angular speed minus centerline angular speed)',
      lowerRollerLaw:
        'omega_roller = omega_centerline + (R_eccentric/r_roller)(omega_shaft - omega_centerline)',
      pulleyRadiusRatio: eccentricRadiusRatio,
      reversibleInputNote:
        'the source describes treadle-to-shaft power flow; the rendered uniform shaft parameter traces the same one-degree-of-freedom motion in reverse for stable inspection',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.70, -2.86, -0.60),
    new THREE.Vector3(3.12, 2.91, 0.88),
  );
  root.userData.groundFloorY = -2.73;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(3.0, 2.3, 11.2),
    root,
    update,
  };
}

export function createAuthoredTreadleEccentricDriveMovement(movement) {
  if (movement.id !== 374) return null;
  return treadleEccentricBandDrive(movement);
}
