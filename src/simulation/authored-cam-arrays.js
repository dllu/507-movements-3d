import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeShaft,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

function centeredExtrusion(shape, depth, bevel = 0.012) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevel > 0,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 64,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function planarRotor() {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.userData.axis = Z_AXIS.clone();
  root.userData.rotor = rotor;
  return root;
}

function rotateVector(vector, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    vector.x * cosine - vector.y * sine,
    vector.x * sine + vector.y * cosine,
  );
}

function cross2(left, right) {
  return left.x * right.y - left.y * right.x;
}

function normalizeAngle(angle) {
  return THREE.MathUtils.euclideanModulo(angle, Math.PI * 2);
}

function profileGeometryAt(config, profileAngle) {
  const cosine = Math.cos(profileAngle);
  const sine = Math.sin(profileAngle);
  const radius = config.baseRadius
    + config.lift * (1 + cosine) / 2;
  const radiusDerivative = -config.lift * sine / 2;
  const radiusSecondDerivative = -config.lift * cosine / 2;
  const boundary = new THREE.Vector2(
    radius * cosine,
    radius * sine,
  );
  const tangent = new THREE.Vector2(
    radiusDerivative * cosine - radius * sine,
    radiusDerivative * sine + radius * cosine,
  );
  const tangentDerivative = new THREE.Vector2(
    radiusSecondDerivative * cosine
      - 2 * radiusDerivative * sine - radius * cosine,
    radiusSecondDerivative * sine
      + 2 * radiusDerivative * cosine - radius * sine,
  );
  const tangentLength = tangent.length();
  const normal = new THREE.Vector2(
    tangent.y / tangentLength,
    -tangent.x / tangentLength,
  );
  const tangentLengthDerivative = tangent.dot(tangentDerivative)
    / tangentLength;
  const normalDerivative = new THREE.Vector2(
    (
      tangentDerivative.y - normal.x * tangentLengthDerivative
    ) / tangentLength,
    (
      -tangentDerivative.x - normal.y * tangentLengthDerivative
    ) / tangentLength,
  );
  const rollerCenterEnvelope = boundary.clone().addScaledVector(
    normal,
    config.rollerRadius,
  );
  const rollerCenterEnvelopeDerivative = tangent.clone().addScaledVector(
    normalDerivative,
    config.rollerRadius,
  );
  const curvatureNumerator = (
    radius ** 2 + 2 * radiusDerivative ** 2
      - radius * radiusSecondDerivative
  );
  return {
    boundary,
    curvatureNumerator,
    normal,
    normalDerivative,
    radius,
    radiusDerivative,
    radiusSecondDerivative,
    rollerCenterEnvelope,
    rollerCenterEnvelopeDerivative,
    tangent,
    tangentDerivative,
    tangentLength,
  };
}

function followerGeometryAtDriveAngle(config, driveAngle, shaftCenter) {
  const orientation = driveAngle + config.phaseOffset;
  const roughRollerCenter = new THREE.Vector2(
    config.leverLength * Math.cos(config.sourceLeverAngle),
    config.leverLength * Math.sin(config.sourceLeverAngle),
  );
  let profileAngle = normalizeAngle(
    Math.atan2(
      roughRollerCenter.y - shaftCenter.y,
      roughRollerCenter.x - shaftCenter.x,
    ) - orientation,
  );
  let profile;
  let rollerCenter;
  let closureError = Infinity;
  let iterations = 0;
  for (; iterations < 18; iterations += 1) {
    profile = profileGeometryAt(config, profileAngle);
    const envelopeOffset = rotateVector(
      profile.rollerCenterEnvelope,
      orientation,
    );
    const envelopeDerivative = rotateVector(
      profile.rollerCenterEnvelopeDerivative,
      orientation,
    );
    rollerCenter = shaftCenter.clone().add(envelopeOffset);
    closureError = rollerCenter.lengthSq() - config.leverLength ** 2;
    if (Math.abs(closureError) < 1e-13) break;
    const derivative = 2 * rollerCenter.dot(envelopeDerivative);
    if (Math.abs(derivative) < 1e-10) {
      throw new Error(`Movement 149 ${config.name} follower reached a singularity.`);
    }
    const rawStep = closureError / derivative;
    const step = THREE.MathUtils.clamp(rawStep, -0.5, 0.5);
    profileAngle = normalizeAngle(profileAngle - step);
  }
  if (Math.abs(closureError) >= 1e-11) {
    throw new Error(`Movement 149 ${config.name} follower did not converge.`);
  }

  profile = profileGeometryAt(config, profileAngle);
  const contactPoint = shaftCenter.clone().add(
    rotateVector(profile.boundary, orientation),
  );
  const contactNormal = rotateVector(profile.normal, orientation);
  const envelopeOffset = rotateVector(
    profile.rollerCenterEnvelope,
    orientation,
  );
  const envelopeDerivative = rotateVector(
    profile.rollerCenterEnvelopeDerivative,
    orientation,
  );
  rollerCenter = shaftCenter.clone().add(envelopeOffset);
  const partialDriveDerivative = new THREE.Vector2(
    -envelopeOffset.y,
    envelopeOffset.x,
  );
  const denominator = rollerCenter.dot(envelopeDerivative);
  const profileAnglePerDriveRadian = -rollerCenter.dot(
    partialDriveDerivative,
  ) / denominator;
  const rollerCenterPerDriveRadian = partialDriveDerivative.clone()
    .addScaledVector(
      envelopeDerivative,
      profileAnglePerDriveRadian,
    );
  const leverAngle = Math.atan2(rollerCenter.y, rollerCenter.x);
  const leverAnglePerDriveRadian = cross2(
    rollerCenter,
    rollerCenterPerDriveRadian,
  ) / config.leverLength ** 2;
  const outputPin = new THREE.Vector2(
    config.outputArmLength * Math.cos(leverAngle),
    config.outputArmLength * Math.sin(leverAngle),
  );
  const outputYPerDriveRadian = config.outputArmLength
    * Math.cos(leverAngle) * leverAnglePerDriveRadian;
  const contactFromShaft = contactPoint.clone().sub(shaftCenter);
  const camSurfacePerDriveRadian = new THREE.Vector2(
    -contactFromShaft.y,
    contactFromShaft.x,
  );
  const contactTangent = new THREE.Vector2(
    -contactNormal.y,
    contactNormal.x,
  );
  const rollerAngularSpeedPerDriveRadian = (
    rollerCenterPerDriveRadian.dot(contactTangent)
      - camSurfacePerDriveRadian.dot(contactTangent)
  ) / config.rollerRadius;

  return {
    camSurfacePerDriveRadian,
    contactCoincidenceError: contactPoint.clone().addScaledVector(
      contactNormal,
      config.rollerRadius,
    ).distanceTo(rollerCenter),
    contactNormal,
    contactPoint,
    contactTangent,
    driveAngle,
    envelopeClosureError: Math.abs(
      rollerCenter.length() - config.leverLength
    ),
    iterations,
    leverAngle,
    leverAnglePerDriveRadian,
    outputPin,
    outputSliderPosition: new THREE.Vector2(
      config.outputSliderX,
      outputPin.y,
    ),
    outputSlotOffsetX: outputPin.x - config.outputSliderX,
    outputYPerDriveRadian,
    profile,
    profileAngle,
    profileAnglePerDriveRadian,
    rollerAngularSpeedPerDriveRadian,
    rollerCenter,
    rollerCenterPerDriveRadian,
  };
}

function makePeriodicRollerMotion(config, shaftCenter) {
  // Integrate the exact rolling speed rather than estimating follower spin
  // from polar radius. Hermite interpolation keeps both angle and angular
  // speed continuous at table boundaries and at every full-cycle wrap.
  const fullTurn = Math.PI * 2;
  const sampleCount = 16384;
  const step = fullTurn / sampleCount;
  const angles = new Float64Array(sampleCount + 1);
  const speeds = new Float64Array(sampleCount + 1);
  for (let index = 0; index <= sampleCount; index += 1) {
    speeds[index] = followerGeometryAtDriveAngle(
      config,
      index * step,
      shaftCenter,
    ).rollerAngularSpeedPerDriveRadian;
    if (index > 0) {
      angles[index] = angles[index - 1]
        + (speeds[index - 1] + speeds[index]) * step / 2;
    }
  }

  const angleAtDriveAngle = (driveAngle) => {
    const turns = Math.floor(driveAngle / fullTurn);
    const wrapped = driveAngle - turns * fullTurn;
    const tablePosition = wrapped / step;
    const index = Math.min(
      sampleCount - 1,
      Math.floor(tablePosition),
    );
    const fraction = tablePosition - index;
    const fractionSquared = fraction * fraction;
    const fractionCubed = fractionSquared * fraction;
    const h00 = 2 * fractionCubed - 3 * fractionSquared + 1;
    const h10 = fractionCubed - 2 * fractionSquared + fraction;
    const h01 = -2 * fractionCubed + 3 * fractionSquared;
    const h11 = fractionCubed - fractionSquared;
    const withinCycle = h00 * angles[index]
      + h10 * step * speeds[index]
      + h01 * angles[index + 1]
      + h11 * step * speeds[index + 1];
    return turns * angles[sampleCount] + withinCycle;
  };

  return {
    angleAtDriveAngle,
    angles,
    sampleCount,
    speeds,
    step,
    totalAnglePerCycle: angles[sampleCount],
  };
}

function makeCamAssembly(config, material, darkMaterial, indexMaterial) {
  const assembly = new THREE.Group();
  assembly.rotation.z = config.phaseOffset;
  assembly.userData.phaseOffset = config.phaseOffset;
  assembly.userData.role = `${config.name}-pear-cam-rigid-on-common-shaft`;

  const shape = new THREE.Shape();
  const profileSamples = 192;
  const outlinePoints = [];
  for (let index = 0; index < profileSamples; index += 1) {
    const angle = index / profileSamples * Math.PI * 2;
    const point = profileGeometryAt(config, angle).boundary;
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
    outlinePoints.push(new THREE.Vector3(
      point.x,
      point.y,
      config.camDepth / 2 + 0.025,
    ));
  }
  shape.closePath();
  const plate = new THREE.Mesh(
    centeredExtrusion(shape, config.camDepth, 0.014),
    material,
  );
  plate.position.z = config.camPlaneZ;
  plate.userData.camProfile = 'smooth-single-lobe-polar-pear';
  plate.userData.role = `${config.name}-smooth-single-lobe-cam-plate`;

  const outline = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(outlinePoints, true, 'centripetal'),
      profileSamples,
      0.026,
      7,
      true,
    ),
    darkMaterial,
  );
  outline.position.z = config.camPlaneZ;
  outline.userData.role = `${config.name}-dark-cam-profile-outline`;

  const index = cylinderAlongZ(0.064, 0.038, indexMaterial, 22);
  index.position.set(
    config.baseRadius + config.lift * 0.56,
    0,
    config.camPlaneZ + config.camDepth / 2 + 0.055,
  );
  index.userData.role = `${config.name}-white-cam-lobe-index`;
  assembly.add(plate, outline, index);
  return { assembly, index, outline, plate, profileSamples };
}

function makeFollowerRoller(config, darkMaterial, faceMaterial, indexMaterial) {
  const root = planarRotor();
  const rotor = root.userData.rotor;
  const body = cylinderAlongZ(
    config.rollerRadius,
    config.rollerWidth,
    darkMaterial,
    42,
  );
  body.userData.role = `${config.name}-rolling-cam-follower-tread`;
  const face = cylinderAlongZ(
    config.rollerRadius * 0.68,
    config.rollerWidth + 0.035,
    faceMaterial,
    36,
  );
  face.userData.role = `${config.name}-cam-follower-face`;
  const capPlaneZ = config.leverPlaneZ - config.camPlaneZ + 0.15;
  const cap = cylinderAlongZ(
    config.rollerRadius * 0.47,
    0.055,
    darkMaterial,
    32,
  );
  cap.position.z = capPlaneZ;
  cap.userData.role = `${config.name}-rotating-follower-axle-end-cap`;
  const index = new THREE.Mesh(
    new THREE.BoxGeometry(
      config.rollerRadius * 1.15,
      0.060,
      0.035,
    ),
    indexMaterial,
  );
  index.position.set(
    config.rollerRadius * 0.32,
    0,
    capPlaneZ + 0.040,
  );
  index.userData.role = `${config.name}-white-follower-rolling-index`;
  rotor.add(body, face, cap, index);
  root.userData.role = `${config.name}-free-rolling-cam-follower`;
  return { body, cap, face, index, root, rotor };
}

function makeOutputSlider(config, material, indexMaterial) {
  const root = new THREE.Group();
  root.userData.axis = new THREE.Vector3(0, 1, 0);
  root.userData.role = `${config.name}-guided-vertical-output-rod`;
  const slotRailLength = config.outputSlotHalfWidth * 2;
  const slotRails = [-1, 1].map((side) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(
        slotRailLength,
        0.052,
        config.outputHeadDepth,
      ),
      material,
    );
    rail.position.y = side * config.outputSlotHalfHeight;
    rail.userData.role = `${config.name}-horizontal-output-head-slot-rail`;
    rail.userData.side = side < 0 ? 'lower' : 'upper';
    return rail;
  });
  const slotCheeks = [-1, 1].map((side) => {
    const cheek = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.052,
        config.outputSlotHalfHeight * 2,
        config.outputHeadDepth,
      ),
      material,
    );
    cheek.position.x = side * config.outputSlotHalfWidth;
    cheek.userData.role = `${config.name}-output-head-slot-end-cheek`;
    cheek.userData.side = side < 0 ? 'left' : 'right';
    return cheek;
  });
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(
      config.outputRodRadius,
      config.outputRodRadius,
      config.outputRodLength,
      24,
    ),
    material,
  );
  rod.position.y = -config.outputRodLength / 2
    - config.outputSlotHalfHeight;
  rod.userData.role = `${config.name}-rectilinearly-reciprocating-rod`;
  const rodIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      config.outputRodRadius * 1.35,
      config.outputRodLength * 0.34,
      0.024,
    ),
    indexMaterial,
  );
  rodIndex.position.set(
    0,
    -config.outputRodLength * 0.52,
    config.outputRodRadius + 0.018,
  );
  rodIndex.userData.role = `${config.name}-white-output-translation-index`;
  root.add(...slotRails, ...slotCheeks, rod, rodIndex);
  return {
    rod,
    rodIndex,
    root,
    slotCheeks,
    slotRails,
  };
}

function twinCamLeverRodArray() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.012;
  const sourcePivot = new THREE.Vector2(46, 240);
  const sourceShaft = new THREE.Vector2(407, 305);
  const sourceUpperRoller = new THREE.Vector2(416, 153);
  const sourceLowerRoller = new THREE.Vector2(428, 250);
  const sourceUpperOutput = new THREE.Vector2(276, 184);
  const sourceLowerOutput = new THREE.Vector2(291, 246);
  const pivot = new THREE.Vector2(0, 0);
  const fromSource = (point) => new THREE.Vector2(
    (point.x - sourcePivot.x) * sourceScale,
    (sourcePivot.y - point.y) * sourceScale,
  );
  const shaftCenter = fromSource(sourceShaft);
  const rollerRadius = 0.22;
  const rollerWidth = 0.30;
  const camDepth = 0.27;
  const inputAngularSpeed = 0.60;
  const cyclePeriod = fullTurn / inputAngularSpeed;

  const makeConfig = ({
    baseRadius,
    camPlaneZ,
    color,
    lift,
    leverPlaneZ,
    name,
    outputRodLength,
    sourceContactProfileAngle,
    sourceOutput,
    sourceRoller,
  }) => {
    const sourceRollerCenter = fromSource(sourceRoller);
    const sourceOutputPoint = fromSource(sourceOutput);
    const sourceCamDistance = sourceRollerCenter.distanceTo(shaftCenter);
    const resolvedBaseRadius = baseRadius
      ?? sourceCamDistance - rollerRadius;
    const resolvedLift = lift
      ?? sourceCamDistance - rollerRadius - resolvedBaseRadius;
    const sourceEnvelopeAngle = Math.atan2(
      sourceRollerCenter.y - shaftCenter.y,
      sourceRollerCenter.x - shaftCenter.x,
    );
    const phaseOffset = sourceEnvelopeAngle - sourceContactProfileAngle;
    const leverLength = sourceRollerCenter.length();
    const sourceLeverAngle = Math.atan2(
      sourceRollerCenter.y,
      sourceRollerCenter.x,
    );
    const sourceLeverDirection = sourceRollerCenter.clone().normalize();
    const outputArmLength = sourceOutputPoint.dot(sourceLeverDirection);
    const sourceOutputProjectedPoint = sourceLeverDirection.clone()
      .multiplyScalar(outputArmLength);
    const outputSliderX = sourceOutputProjectedPoint.x;
    const camRadiusAtSource = resolvedBaseRadius
      + resolvedLift * (1 + Math.cos(sourceContactProfileAngle)) / 2;
    return {
      baseRadius: resolvedBaseRadius,
      camDepth,
      camPlaneZ,
      camRadiusAtSource,
      color,
      lift: resolvedLift,
      leverLength,
      leverPlaneZ,
      name,
      outputArmLength,
      outputHeadDepth: 0.16,
      outputPinRadius: 0.075,
      outputRodLength,
      outputRodRadius: 0.070,
      outputSliderX,
      outputSlotHalfHeight: 0.105,
      outputSlotHalfWidth: 0.24,
      phaseOffset,
      rollerRadius,
      rollerWidth,
      sourceContactProfileAngle,
      sourceEnvelopeAngle,
      sourceLeverAngle,
      sourceLeverDirection,
      sourceOutputPoint,
      sourceOutputProjectedPoint,
      sourceOutputProjectionError: sourceOutputProjectedPoint.distanceTo(
        sourceOutputPoint,
      ),
      sourceRollerCenter,
    };
  };

  const upperSourceCamDistance = fromSource(sourceUpperRoller)
    .distanceTo(shaftCenter);
  const upperConfig = makeConfig({
    baseRadius: 0.72,
    camPlaneZ: -0.36,
    color: PALETTE.driver,
    lift: upperSourceCamDistance - rollerRadius - 0.72,
    leverPlaneZ: -0.02,
    name: 'upper',
    outputRodLength: 1.20,
    sourceContactProfileAngle: 0,
    sourceOutput: sourceUpperOutput,
    sourceRoller: sourceUpperRoller,
  });
  const lowerConfig = makeConfig({
    camPlaneZ: 0.30,
    color: PALETTE.accent,
    lift: 0.78,
    leverPlaneZ: 0.64,
    name: 'lower',
    outputRodLength: 1.78,
    sourceContactProfileAngle: Math.PI,
    sourceOutput: sourceLowerOutput,
    sourceRoller: sourceLowerRoller,
  });
  const configs = [upperConfig, lowerConfig];
  const rollerMotionRecords = configs.map((config) => (
    makePeriodicRollerMotion(config, shaftCenter)
  ));

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.59,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.16,
    roughness: 0.56,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const lowerLeverMaterial = matte(0x2b6d86, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.47,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.70,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const camInput = planarRotor();
  const camRotor = camInput.userData.rotor;
  camInput.position.set(shaftCenter.x, shaftCenter.y, 0);
  camInput.userData.role = 'uniformly-rotating-common-two-cam-shaft';
  camRotor.userData.role = 'one-rigid-phased-two-cam-rotor';
  const camRecords = configs.map((config) => {
    const record = makeCamAssembly(
      config,
      config.name === 'upper' ? driverMaterial : accentMaterial,
      darkMaterial,
      indexMaterial,
    );
    camRotor.add(record.assembly);
    return { ...record, config };
  });
  const rotatingHub = cylinderAlongZ(0.16, 1.36, darkMaterial, 32);
  rotatingHub.userData.role = 'common-hub-rigid-with-both-cams';
  const shaftRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.052, 0.029),
    indexMaterial,
  );
  shaftRotationIndex.position.set(0.18, 0, 0.76);
  shaftRotationIndex.userData.role = 'white-common-cam-shaft-index';
  camRotor.add(rotatingHub, shaftRotationIndex);

  const leverRecords = configs.map((config) => {
    const lever = new THREE.Group();
    lever.position.set(pivot.x, pivot.y, config.leverPlaneZ);
    lever.userData.axis = Z_AXIS.clone();
    lever.userData.role = `${config.name}-cam-operated-pivoted-lever`;
    const leverColor = config.name === 'upper'
      ? PALETTE.driven
      : 0x2b6d86;
    const body = makeBeam(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(config.leverLength, 0, 0),
      {
        color: leverColor,
        depth: 0.17,
        jointRadius: 0.001,
        thickness: 0.16,
      },
    );
    body.userData.role = `${config.name}-rigid-lever-from-common-pivot-to-roller`;
    const pivotRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.245, 0.045, 10, 42),
      darkMaterial,
    );
    pivotRing.position.z = 0.115;
    pivotRing.userData.role = `${config.name}-lever-pivot-face-ring`;
    const leverIndex = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.046, 0.026),
      indexMaterial,
    );
    leverIndex.position.set(config.leverLength * 0.46, 0, 0.115);
    leverIndex.userData.role = `${config.name}-white-lever-angle-index`;
    const roller = makeFollowerRoller(
      config,
      darkMaterial,
      config.name === 'upper' ? drivenMaterial : lowerLeverMaterial,
      indexMaterial,
    );
    roller.root.position.set(
      config.leverLength,
      0,
      config.camPlaneZ - config.leverPlaneZ,
    );
    const rollerAxle = cylinderAlongZ(0.09, 0.70, darkMaterial, 28);
    rollerAxle.position.set(
      config.leverLength,
      0,
      (config.camPlaneZ - config.leverPlaneZ) / 2,
    );
    rollerAxle.userData.role = `${config.name}-roller-through-axle`;
    const outputPin = cylinderAlongZ(
      config.outputPinRadius,
      0.54,
      darkMaterial,
      26,
    );
    outputPin.position.set(config.outputArmLength, 0, 0.12);
    outputPin.userData.role = `${config.name}-lever-pin-in-output-head-slot`;
    lever.add(
      body,
      pivotRing,
      leverIndex,
      roller.root,
      rollerAxle,
      outputPin,
    );

    const slider = makeOutputSlider(
      config,
      config.name === 'upper' ? drivenMaterial : lowerLeverMaterial,
      indexMaterial,
    );
    slider.root.position.z = config.leverPlaneZ + 0.20;
    const guide = new THREE.Group();
    guide.userData.fixed = true;
    guide.userData.role = `${config.name}-fixed-vertical-output-guide`;
    const guideY = -0.76;
    const guideHalfGap = config.outputRodRadius + 0.035;
    const guideCheeks = [-1, 1].map((side) => {
      const cheek = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.34, 0.20),
        frameMaterial,
      );
      cheek.position.set(
        config.outputSliderX + side * guideHalfGap,
        guideY,
        config.leverPlaneZ + 0.20,
      );
      cheek.userData.role = `${config.name}-fixed-output-guide-cheek`;
      cheek.userData.side = side < 0 ? 'left' : 'right';
      guide.add(cheek);
      return cheek;
    });
    return {
      body,
      config,
      guide,
      guideCheeks,
      guideHalfGap,
      guideY,
      lever,
      leverIndex,
      outputPin,
      pivotRing,
      roller,
      rollerAxle,
      slider,
    };
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-common-pivot-and-cam-shaft-frame';
  const baseY = -2.25;
  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(6.1, 0.22, 1.30),
    frameMaterial,
  );
  baseRail.position.set(2.25, baseY, -0.18);
  baseRail.userData.role = 'fixed-base-under-two-cam-lever-array';
  const pivotPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, -baseY, 0.48),
    frameMaterial,
  );
  pivotPost.position.set(pivot.x, baseY / 2, -0.52);
  pivotPost.userData.role = 'fixed-post-supporting-common-lever-pivot';
  const shaftPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, shaftCenter.y - baseY, 0.48),
    frameMaterial,
  );
  shaftPost.position.set(
    shaftCenter.x,
    (shaftCenter.y + baseY) / 2,
    -0.52,
  );
  shaftPost.userData.role = 'fixed-post-supporting-common-cam-shaft';
  const pivotShaft = makeShaft({ length: 1.72, radius: 0.11, axis: Z_AXIS });
  pivotShaft.position.set(pivot.x, pivot.y, 0.13);
  pivotShaft.userData.role = 'fixed-shaft-through-both-lever-pivots';
  const camShaft = makeShaft({ length: 1.72, radius: 0.105, axis: Z_AXIS });
  camShaft.position.set(shaftCenter.x, shaftCenter.y, 0.13);
  camShaft.userData.role = 'fixed-axis-through-both-phased-cams';
  const pivotBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.26, 0.06, 10, 42),
    darkMaterial,
  );
  pivotBearing.position.set(pivot.x, pivot.y, -0.40);
  pivotBearing.userData.role = 'fixed-common-lever-pivot-bearing';
  const camBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.06, 10, 42),
    darkMaterial,
  );
  camBearing.position.set(shaftCenter.x, shaftCenter.y, -0.48);
  camBearing.userData.role = 'fixed-common-cam-shaft-bearing';
  fixedFrame.add(
    baseRail,
    pivotPost,
    shaftPost,
    pivotShaft,
    camShaft,
    pivotBearing,
    camBearing,
    ...leverRecords.map(({ guide }) => guide),
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 4.8, 2.8),
    new THREE.MeshBasicMaterial({
      color: PALETTE.paper,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(2.65, -0.38, 0.10);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;

  root.add(
    cameraEnvelope,
    fixedFrame,
    camInput,
    ...leverRecords.flatMap(({ lever, slider }) => [lever, slider.root]),
  );

  const stateAtDriveAngle = (driveAngle) => {
    const followers = configs.map((config, configIndex) => {
      const state = followerGeometryAtDriveAngle(
        config,
        driveAngle,
        shaftCenter,
      );
      const rollerAngularDisplacement = rollerMotionRecords[configIndex]
        .angleAtDriveAngle(driveAngle);
      const leverAngularSpeed = state.leverAnglePerDriveRadian
        * inputAngularSpeed;
      const rollerCenterVelocity = state.rollerCenterPerDriveRadian.clone()
        .multiplyScalar(inputAngularSpeed);
      const camSurfaceVelocity = state.camSurfacePerDriveRadian.clone()
        .multiplyScalar(inputAngularSpeed);
      const rollerAngularSpeed = state.rollerAngularSpeedPerDriveRadian
        * inputAngularSpeed;
      const rollerContactRadius = state.contactPoint.clone().sub(
        state.rollerCenter,
      );
      const rollerSurfaceVelocity = rollerCenterVelocity.clone().add(
        new THREE.Vector2(
          -rollerAngularSpeed * rollerContactRadius.y,
          rollerAngularSpeed * rollerContactRadius.x,
        ),
      );
      const relativeContactVelocity = camSurfaceVelocity.clone().sub(
        rollerSurfaceVelocity,
      );
      const outputVelocityY = state.outputYPerDriveRadian
        * inputAngularSpeed;
      const sliderPosition = state.outputSliderPosition.clone();
      let stage;
      if (Math.abs(outputVelocityY) < 0.002) {
        stage = state.outputSliderPosition.y
          > (config.name === 'upper' ? 0.40 : 0.18)
          ? `${config.name}-rod-at-upper-reversal`
          : `${config.name}-rod-at-lower-reversal`;
      } else {
        stage = outputVelocityY > 0
          ? `${config.name}-rod-rising`
          : `${config.name}-rod-falling`;
      }
      return {
        ...state,
        camSurfaceVelocity,
        contactNormalVelocityError: relativeContactVelocity.dot(
          state.contactNormal,
        ),
        contactTangentialRollingError: relativeContactVelocity.dot(
          state.contactTangent,
        ),
        leverAngularSpeed,
        outputVelocityY,
        relativeContactVelocity,
        rollerAngularDisplacement,
        rollerAngularSpeed,
        rollerCenterVelocity,
        rollerSurfaceVelocity,
        sliderPosition,
        stage,
      };
    });
    const cyclePhase = THREE.MathUtils.euclideanModulo(
      driveAngle / fullTurn,
      1,
    );
    const stage = followers.map(({ stage: followerStage }) => followerStage)
      .join('-and-');
    return {
      cyclePhase,
      driveAngle,
      followers,
      inputAngularSpeed,
      stage,
    };
  };
  const stateAtTime = (time) => stateAtDriveAngle(inputAngularSpeed * time);
  const stateAtCyclePhase = (phase) => stateAtDriveAngle(phase * fullTurn);

  const motionExtrema = configs.map((config, configIndex) => {
    let maximumOutputY = -Infinity;
    let minimumOutputY = Infinity;
    let maximumLeverAngle = -Infinity;
    let minimumLeverAngle = Infinity;
    const extremaSamples = 4096;
    for (let index = 0; index < extremaSamples; index += 1) {
      const follower = stateAtCyclePhase(index / extremaSamples)
        .followers[configIndex];
      maximumOutputY = Math.max(maximumOutputY, follower.sliderPosition.y);
      minimumOutputY = Math.min(minimumOutputY, follower.sliderPosition.y);
      maximumLeverAngle = Math.max(maximumLeverAngle, follower.leverAngle);
      minimumLeverAngle = Math.min(minimumLeverAngle, follower.leverAngle);
    }
    return {
      maximumLeverAngle,
      maximumOutputY,
      minimumLeverAngle,
      minimumOutputY,
      outputStroke: maximumOutputY - minimumOutputY,
    };
  });

  root.userData.mechanism =
    'common-shaft-phased-twin-pear-cams-roller-levers-two-vertical-rods';
  root.userData.blocks = {
    baseRail,
    camBearing,
    camInput,
    camRecords,
    camRotor,
    camShaft,
    cameraEnvelope,
    fixedFrame,
    leverRecords,
    pivotBearing,
    pivotPost,
    pivotShaft,
    rotatingHub,
    shaftPost,
    shaftRotationIndex,
  };
  root.userData.canonicalStates = {
    halfTurn: stateAtCyclePhase(0.5),
    quarterTurn: stateAtCyclePhase(0.25),
    source: stateAtCyclePhase(0),
    threeQuarterTurn: stateAtCyclePhase(0.75),
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    camDepth,
    configs,
    cyclePeriod,
    fullTurn,
    inputAngularSpeed,
    motionExtrema,
    pivot: pivot.clone(),
    rollerRadius,
    rollerMotionRecords,
    rollerWidth,
    shaftCenter: shaftCenter.clone(),
    sourceLowerOutput: sourceLowerOutput.clone(),
    sourceLowerRoller: sourceLowerRoller.clone(),
    sourcePivot: sourcePivot.clone(),
    sourceScale,
    sourceShaft: sourceShaft.clone(),
    sourceUpperOutput: sourceUpperOutput.clone(),
    sourceUpperRoller: sourceUpperRoller.clone(),
  };
  root.userData.profileGeometryAt = profileGeometryAt;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtDriveAngle = stateAtDriveAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(camInput, state.driveAngle);
    state.followers.forEach((follower, index) => {
      const record = leverRecords[index];
      record.lever.rotation.z = follower.leverAngle;
      setSpin(
        record.roller.root,
        follower.rollerAngularDisplacement - follower.leverAngle,
      );
      record.slider.root.position.set(
        follower.sliderPosition.x,
        follower.sliderPosition.y,
        record.config.leverPlaneZ + 0.20,
      );
    });
    root.userData.contacts = state.followers.map((follower, index) => ({
      camName: configs[index].name,
      coincidenceError: follower.contactCoincidenceError,
      contactNormal: follower.contactNormal.clone(),
      contactPoint: follower.contactPoint.clone(),
      normalVelocityError: follower.contactNormalVelocityError,
      rollerCenter: follower.rollerCenter.clone(),
      tangentialRollingError: follower.contactTangentialRollingError,
    }));
    root.userData.kinematics = state;
  };
  update(0);

  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  root.userData.fidelity = 'authored';
  markShadows(root);
  root.traverse((object) => {
    if (!object.userData.cameraFitGuide) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });
  for (const index of [
    shaftRotationIndex,
    ...camRecords.map(({ index }) => index),
    ...leverRecords.flatMap(({ leverIndex, roller, slider }) => [
      leverIndex,
      roller.index,
      slider.rodIndex,
    ]),
  ]) {
    index.castShadow = false;
    index.receiveShadow = false;
  }

  return {
    cameraDirection: new THREE.Vector3(8.3, 4.8, 12.0),
    root,
    update,
  };
}

export function createAuthoredCamArrayMovement(movement) {
  switch (movement.id) {
    case 149: return twinCamLeverRodArray();
    default: return null;
  }
}
