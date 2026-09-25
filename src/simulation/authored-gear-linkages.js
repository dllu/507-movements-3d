import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeGear,
  makeShaft,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';

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

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function makeSpokedSpurGear({
  color,
  depth,
  hubRadius,
  pitchRadius,
  spokeCount,
  teeth,
  toothHeight,
  webInnerRadius,
}) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.userData.axis = Z_AXIS.clone();
  root.userData.rotor = rotor;

  const toothPitch = Math.PI * 2 / teeth;
  const rootRadius = pitchRadius - toothHeight * 0.65;
  const outerRadius = pitchRadius + toothHeight * 0.55;
  const template = makeGear({teeth,radius:pitchRadius,depth,
    addendum:outerRadius-pitchRadius,dedendum:pitchRadius-rootRadius});
  const profile = template.userData.rotor.children[0].geometry.parameters.shapes.clone();
  disposeObject3D(template);
  if (webInnerRadius > 0) {
    const opening = new THREE.Path();
    opening.absarc(0, 0, webInnerRadius, 0, Math.PI * 2, true);
    profile.holes.push(opening);
  }

  const gearMaterial = matte(color, { metalness: 0.14, roughness: 0.61 });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const rimGeometry = new THREE.ExtrudeGeometry(profile,{depth,bevelEnabled:true,
    bevelSize:.009,bevelOffset:-.009,bevelThickness:.009,bevelSegments:1,curveSegments:64});
  rimGeometry.translate(0,0,-depth/2);
  const rim = new THREE.Mesh(rimGeometry,gearMaterial);
  rim.userData.role = webInnerRadius > 0
    ? 'thin-toothed-open-web-spur-gear-rim'
    : 'solid-small-driving-spur-pinion';
  rotor.add(rim);

  const hub = cylinderAlongZ(hubRadius, depth * 1.55, darkMaterial, 36);
  hub.userData.role = 'spur-gear-bearing-hub';
  rotor.add(hub);

  const spokes = [];
  if (spokeCount > 0) {
    const spokeStart = hubRadius * 0.72;
    const spokeEnd = webInnerRadius + 0.08;
    const spokeLength = spokeEnd - spokeStart;
    for (let index = 0; index < spokeCount; index += 1) {
      const angle = index / spokeCount * Math.PI * 2;
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(spokeLength, 0.105, depth * 0.72),
        gearMaterial,
      );
      const midpointRadius = (spokeStart + spokeEnd) / 2;
      spoke.position.set(
        midpointRadius * Math.cos(angle),
        midpointRadius * Math.sin(angle),
        0,
      );
      spoke.rotation.z = angle;
      spoke.userData.role = 'open-web-spoke-rigid-with-large-spur-gear';
      rotor.add(spoke);
      spokes.push(spoke);
    }
  }

  const frontRing = new THREE.Mesh(
    new THREE.TorusGeometry(
      webInnerRadius > 0 ? webInnerRadius : pitchRadius * 0.58,
      0.035,
      9,
      72,
    ),
    darkMaterial,
  );
  frontRing.position.z = depth / 2 + 0.015;
  frontRing.userData.role = 'visible-spur-gear-web-boundary';
  // Drawn web/rim edge only: retained as a hidden reference, not a dark rim.
  frontRing.visible = false;
  frontRing.userData.retiredInkOutline = true;
  rotor.add(frontRing);

  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });
  const rotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      webInnerRadius > 0 ? pitchRadius * 0.72 : pitchRadius * 0.52,
      Math.max(0.045, pitchRadius * 0.035),
      0.028,
    ),
    indexMaterial,
  );
  rotationIndex.position.set(
    webInnerRadius > 0 ? pitchRadius * 0.35 : pitchRadius * 0.42,
    0,
    depth / 2 + 0.042,
  );
  rotationIndex.userData.role = 'white-spur-gear-rotation-index';
  rotor.add(rotationIndex);

  root.userData.depth = depth;
  root.userData.hubRadius = hubRadius;
  root.userData.outerRadius = outerRadius;
  root.userData.pitchRadius = pitchRadius;
  root.userData.rootRadius = rootRadius;
  root.userData.spokeCount = spokeCount;
  root.userData.spokeEnd = spokeCount > 0 ? webInnerRadius + 0.08 : 0;
  root.userData.spokeStart = spokeCount > 0 ? hubRadius * 0.72 : 0;
  root.userData.spokes = spokes;
  root.userData.teeth = teeth;
  root.userData.toothHeight = outerRadius - rootRadius;
  root.userData.addendum = outerRadius - pitchRadius;
  root.userData.dedendum = pitchRadius - rootRadius;
  root.userData.toothPitch = toothPitch;
  root.userData.toothProfile = 'true-involute';
  root.userData.rotationIndex = rotationIndex;
  root.userData.webInnerRadius = webInnerRadius;
  return markShadows(root);
}

function circleIntersectionUpper(firstCenter, firstRadius, secondCenter, secondRadius) {
  const line = secondCenter.clone().sub(firstCenter);
  const centerDistance = line.length();
  const along = (
    firstRadius ** 2 - secondRadius ** 2 + centerDistance ** 2
  ) / (2 * centerDistance);
  const heightSquared = firstRadius ** 2 - along ** 2;
  if (heightSquared < -1e-12) {
    throw new Error('Movement 148 four-bar dimensions do not close.');
  }
  const height = Math.sqrt(Math.max(0, heightSquared));
  const unit = line.multiplyScalar(1 / centerDistance);
  const perpendicular = new THREE.Vector2(-unit.y, unit.x);
  return {
    along,
    centerDistance,
    height,
    point: firstCenter.clone()
      .addScaledVector(unit, along)
      .addScaledVector(perpendicular, height),
  };
}

function gearedAlternatingCrank() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  const pinionTeeth = 12;
  const largeGearTeeth = 48;
  const moduleScale = 0.085;
  const pinionPitchRadius = pinionTeeth * moduleScale;
  const largeGearPitchRadius = largeGearTeeth * moduleScale;
  const toothHeight = moduleScale * 1.48;
  const centerDistance = pinionPitchRadius + largeGearPitchRadius;
  const largeGearCenter = new THREE.Vector2(0, 0);
  const pinionCenter = new THREE.Vector2(-centerDistance, 0);

  // Brown's engraving is a near-change-point crank-rocker. These dimensions
  // preserve its proportions while keeping the eccentric gear pin as the
  // shortest link, so the large gear can complete every revolution.
  const inputCrankRadius = 1.30;
  const attachedCrankLength = 1.56;
  const outputRockerLength = 5.84;
  const fixedRockerPivot = new THREE.Vector2(5.72, 0.96);
  const groundLength = fixedRockerPivot.distanceTo(largeGearCenter);
  const grashofMargin = (
    attachedCrankLength + groundLength
    - inputCrankRadius - outputRockerLength
  );

  const gearDepth = 0.34;
  const gearPlaneZ = 0;
  const crankPlaneZ = 0.42;
  const rockerPlaneZ = 0.66;
  const jointPinCenterZ = (crankPlaneZ + rockerPlaneZ) / 2;
  const attachedCrankDepth = 0.18;
  const outputRockerDepth = 0.17;
  const guideHalfGap = 0.20;
  const guideRailRadius = 0.050;
  const guideFollowerRadius = 0.115;
  const guideRunningClearance = (
    guideHalfGap - guideRailRadius - guideFollowerRadius
  );

  const pinion = makeSpokedSpurGear({
    color: PALETTE.driver,
    depth: gearDepth,
    hubRadius: 0.23,
    pitchRadius: pinionPitchRadius,
    spokeCount: 0,
    teeth: pinionTeeth,
    toothHeight,
    webInnerRadius: 0,
  });
  pinion.position.set(pinionCenter.x, pinionCenter.y, gearPlaneZ);
  pinion.userData.role = 'twelve-tooth-continuous-input-pinion';

  const largeGear = makeSpokedSpurGear({
    color: PALETTE.driven,
    depth: gearDepth,
    hubRadius: 0.34,
    pitchRadius: largeGearPitchRadius,
    spokeCount: 8,
    teeth: largeGearTeeth,
    toothHeight,
    webInnerRadius: largeGearPitchRadius * 0.78,
  });
  largeGear.position.set(largeGearCenter.x, largeGearCenter.y, gearPlaneZ);
  largeGear.userData.role = 'forty-eight-tooth-continuous-large-spur-gear';

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.60,
  });
  const guideMaterial = matte(PALETTE.accent, {
    metalness: 0.20,
    roughness: 0.52,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.47,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.70,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const largeGearRotor = largeGear.userData.rotor;
  const crankPin = cylinderAlongZ(
    0.14,
    0.76,
    darkMaterial,
    32,
  );
  crankPin.position.set(inputCrankRadius, 0, 0.29);
  crankPin.userData.role = 'eccentric-pin-fixed-to-large-spur-gear';
  largeGearRotor.add(crankPin);

  const crankPinFace = cylinderAlongZ(0.075, 0.04, indexMaterial, 24);
  crankPinFace.position.set(inputCrankRadius, 0, 0.69);
  crankPinFace.userData.role = 'white-index-on-large-gear-crank-pin';
  largeGearRotor.add(crankPinFace);

  const attachedCrank = new THREE.Group();
  attachedCrank.userData.role =
    'alternately-rotating-guided-crank-attached-to-large-gear';
  attachedCrank.userData.axis = Z_AXIS.clone();
  const attachedCrankBody = makeBeam(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(attachedCrankLength, 0, 0),
    {
      color: PALETTE.driver,
      depth: attachedCrankDepth,
      jointRadius: 0.16,
      thickness: 0.13,
    },
  );
  attachedCrankBody.userData.role =
    'short-rigid-crank-between-gear-pin-and-floating-joint';

  const guideRails = [-1, 1].map((side) => {
    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(
        inputCrankRadius + side * guideHalfGap,
        guideRailRadius,
        9,
        96,
      ),
      guideMaterial,
    );
    rail.userData.role =
      'circular-guide-rail-around-fixed-large-gear-shaft';
    rail.userData.side = side < 0 ? 'inner' : 'outer';
    return rail;
  });
  const guideBridge = makeBeam(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -inputCrankRadius - guideHalfGap, 0),
    {
      color: PALETTE.accent,
      depth: attachedCrankDepth * 0.84,
      jointRadius: 0.001,
      thickness: 0.075,
    },
  );
  guideBridge.userData.role = 'guide-rail-bridge-rigid-with-attached-crank';
  const attachedCrankIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.052, attachedCrankDepth + 0.035),
    indexMaterial,
  );
  attachedCrankIndex.position.set(attachedCrankLength * 0.68, 0, 0.018);
  attachedCrankIndex.userData.role = 'white-attached-crank-rotation-index';
  attachedCrank.add(
    ...guideRails,
    guideBridge,
    attachedCrankBody,
    attachedCrankIndex,
  );

  const outputRocker = new THREE.Group();
  outputRocker.userData.role = 'fixed-pivot-long-output-rocker';
  outputRocker.userData.axis = Z_AXIS.clone();
  const outputRockerBody = makeBeam(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(outputRockerLength, 0, 0),
    {
      color: PALETTE.driver,
      depth: outputRockerDepth,
      jointRadius: 0.17,
      thickness: 0.12,
    },
  );
  outputRockerBody.userData.role =
    'long-rocker-joining-floating-joint-to-fixed-frame-pivot';
  const outputRockerIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.052, outputRockerDepth + 0.035),
    indexMaterial,
  );
  outputRockerIndex.position.set(outputRockerLength * 0.13, 0, 0.018);
  outputRockerIndex.userData.role = 'white-output-rocker-rotation-index';
  outputRocker.add(outputRockerBody, outputRockerIndex);

  const floatingJointPin = cylinderAlongZ(
    0.14,
    0.52,
    darkMaterial,
    32,
  );
  floatingJointPin.position.z = jointPinCenterZ;
  floatingJointPin.userData.role =
    'through-pin-joining-attached-crank-and-output-rocker';

  const guideFollower = cylinderAlongZ(
    guideFollowerRadius,
    0.30,
    darkMaterial,
    32,
  );
  guideFollower.position.set(
    largeGearCenter.x,
    largeGearCenter.y,
    crankPlaneZ,
  );
  guideFollower.userData.role =
    'fixed-large-gear-shaft-follower-captured-between-circular-rails';
  const guideFollowerFace = cylinderAlongZ(
    guideFollowerRadius * 0.48,
    0.035,
    indexMaterial,
    24,
  );
  guideFollowerFace.position.set(
    largeGearCenter.x,
    largeGearCenter.y,
    crankPlaneZ + 0.17,
  );
  guideFollowerFace.userData.role = 'white-guide-follower-face';

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'three-bearing-fixed-frame';
  const frameBackZ = -0.43;
  const backRail = makeBeam(
    new THREE.Vector3(pinionCenter.x - 0.52, 0, frameBackZ),
    new THREE.Vector3(fixedRockerPivot.x + 0.45, 0, frameBackZ),
    {
      color: PALETTE.frame,
      depth: 0.24,
      jointRadius: 0.001,
      thickness: 0.20,
    },
  );
  backRail.userData.role = 'fixed-horizontal-bearing-rail';
  fixedFrame.add(backRail);

  const makePedestal = (center, height, width, role) => {
    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 0.31),
      frameMaterial,
    );
    pedestal.position.set(center.x, center.y - height / 2, frameBackZ);
    pedestal.userData.role = role;
    fixedFrame.add(pedestal);
    return pedestal;
  };
  const pinionPedestal = makePedestal(
    pinionCenter,
    1.55,
    0.48,
    'fixed-left-pinion-bearing-pedestal',
  );
  const rockerPedestal = makePedestal(
    fixedRockerPivot,
    1.78,
    0.50,
    'fixed-right-rocker-bearing-pedestal',
  );
  const largeGearBearingPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.76, 0.31),
    frameMaterial,
  );
  largeGearBearingPlate.position.set(0, -0.38, frameBackZ);
  largeGearBearingPlate.userData.role = 'fixed-large-gear-bearing-plate';
  fixedFrame.add(largeGearBearingPlate);

  const pinionShaft = makeShaft({ length: 1.08, radius: 0.10, axis: Z_AXIS });
  pinionShaft.position.set(pinionCenter.x, pinionCenter.y, -0.02);
  pinionShaft.userData.role = 'fixed-pinion-bearing-shaft';
  const largeGearShaft = makeShaft({ length: 1.38, radius: 0.12, axis: Z_AXIS });
  largeGearShaft.position.set(largeGearCenter.x, largeGearCenter.y, 0.08);
  largeGearShaft.userData.role = 'fixed-large-gear-center-shaft';
  const rockerPivotShaft = makeShaft({ length: 1.28, radius: 0.12, axis: Z_AXIS });
  rockerPivotShaft.position.set(
    fixedRockerPivot.x,
    fixedRockerPivot.y,
    0.22,
  );
  rockerPivotShaft.userData.role = 'fixed-output-rocker-pivot-shaft';
  fixedFrame.add(pinionShaft, largeGearShaft, rockerPivotShaft);

  const bearingRings = [
    [pinionCenter, 0.24, 'fixed-pinion-bearing-ring'],
    [largeGearCenter, 0.31, 'fixed-large-gear-bearing-ring'],
    [fixedRockerPivot, 0.25, 'fixed-output-rocker-bearing-ring'],
  ].map(([center, radius, role]) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.055, 9, 40),
      darkMaterial,
    );
    ring.position.set(center.x, center.y, frameBackZ + 0.19);
    ring.userData.role = role;
    fixedFrame.add(ring);
    return ring;
  });

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(11.2, 8.7, 5.0),
    new THREE.MeshBasicMaterial({
      color: PALETTE.paper,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0.55, 0.05, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;

  root.add(
    cameraEnvelope,
    fixedFrame,
    pinion,
    largeGear,
    attachedCrank,
    outputRocker,
    floatingJointPin,
    guideFollower,
    guideFollowerFace,
  );

  const pinionAngularSpeed = Math.PI;
  const largeGearAngularSpeed = -pinionAngularSpeed
    * pinionTeeth / largeGearTeeth;
  const cyclePeriod = fullTurn / Math.abs(largeGearAngularSpeed);
  const largeGearToothPitch = fullTurn / largeGearTeeth;
  const sourceLargeGearAngle = largeGearToothPitch / 2;
  const sourceCrankAngle = THREE.MathUtils.degToRad(159);
  const crankPhaseOffset = sourceCrankAngle - sourceLargeGearAngle;
  const meshPhaseInvariant = Math.PI;
  const gearContactPoint = new THREE.Vector2(-largeGearPitchRadius, 0);
  crankPin.position.set(
    inputCrankRadius * Math.cos(crankPhaseOffset),
    inputCrankRadius * Math.sin(crankPhaseOffset),
    crankPin.position.z,
  );
  crankPinFace.position.set(
    inputCrankRadius * Math.cos(crankPhaseOffset),
    inputCrankRadius * Math.sin(crankPhaseOffset),
    crankPinFace.position.z,
  );

  const stateAtTime = (time) => {
    const largeGearAngle = sourceLargeGearAngle + largeGearAngularSpeed * time;
    const pinionAngle = (
      meshPhaseInvariant - largeGearTeeth * largeGearAngle
    ) / pinionTeeth;
    const crankAngle = largeGearAngle + crankPhaseOffset;
    const crankPinPosition = new THREE.Vector2(
      largeGearCenter.x + inputCrankRadius * Math.cos(crankAngle),
      largeGearCenter.y + inputCrankRadius * Math.sin(crankAngle),
    );
    const intersection = circleIntersectionUpper(
      crankPinPosition,
      attachedCrankLength,
      fixedRockerPivot,
      outputRockerLength,
    );
    const floatingJointPosition = intersection.point;
    const attachedCrankVector = floatingJointPosition.clone()
      .sub(crankPinPosition);
    const outputRockerVector = floatingJointPosition.clone()
      .sub(fixedRockerPivot);
    const attachedCrankAngle = Math.atan2(
      attachedCrankVector.y,
      attachedCrankVector.x,
    );
    const outputRockerAngle = THREE.MathUtils.euclideanModulo(
      Math.atan2(outputRockerVector.y, outputRockerVector.x),
      fullTurn,
    );

    const crankPinVelocity = new THREE.Vector2(
      -largeGearAngularSpeed
        * (crankPinPosition.y - largeGearCenter.y),
      largeGearAngularSpeed
        * (crankPinPosition.x - largeGearCenter.x),
    );
    const rockerPerpendicular = new THREE.Vector2(
      -outputRockerVector.y,
      outputRockerVector.x,
    );
    const velocityDenominator = attachedCrankVector.dot(rockerPerpendicular);
    const outputRockerAngularSpeed = attachedCrankVector.dot(crankPinVelocity)
      / velocityDenominator;
    const floatingJointVelocity = rockerPerpendicular
      .multiplyScalar(outputRockerAngularSpeed);
    const attachedRelativeVelocity = floatingJointVelocity.clone()
      .sub(crankPinVelocity);
    const attachedCrankAngularSpeed = (
      attachedCrankVector.x * attachedRelativeVelocity.y
      - attachedCrankVector.y * attachedRelativeVelocity.x
    ) / attachedCrankLength ** 2;

    const guideRadial = largeGearCenter.clone().sub(crankPinPosition);
    const guideRadialUnit = guideRadial.clone().normalize();
    const guideMaterialVelocityAtFollower = crankPinVelocity.clone().add(
      new THREE.Vector2(-guideRadial.y, guideRadial.x)
        .multiplyScalar(attachedCrankAngularSpeed),
    );
    const guideRelativeVelocity = guideMaterialVelocityAtFollower
      .multiplyScalar(-1);
    const guideRadialVelocityError = guideRelativeVelocity.dot(guideRadialUnit);
    const guideTangentialSlidingSpeed = (
      guideRelativeVelocity.x * -guideRadialUnit.y
      + guideRelativeVelocity.y * guideRadialUnit.x
    );
    const cyclePhase = THREE.MathUtils.euclideanModulo(
      time / cyclePeriod,
      1,
    );
    let stage;
    if (Math.abs(attachedCrankAngularSpeed) < 0.01) {
      stage = attachedCrankAngle > Math.PI / 2
        ? 'attached-crank-at-counterclockwise-reversal'
        : 'attached-crank-at-clockwise-reversal';
    } else {
      stage = attachedCrankAngularSpeed > 0
        ? 'attached-crank-rocking-counterclockwise'
        : 'attached-crank-rocking-clockwise';
    }

    const pinionContactRadius = new THREE.Vector2(pinionPitchRadius, 0);
    const largeGearContactRadius = new THREE.Vector2(-largeGearPitchRadius, 0);
    const pinionContactVelocity = new THREE.Vector2(
      -pinionAngularSpeed * pinionContactRadius.y,
      pinionAngularSpeed * pinionContactRadius.x,
    );
    const largeGearContactVelocity = new THREE.Vector2(
      -largeGearAngularSpeed * largeGearContactRadius.y,
      largeGearAngularSpeed * largeGearContactRadius.x,
    );

    return {
      attachedCrankAngle,
      attachedCrankAngularSpeed,
      attachedCrankClosureError:
        attachedCrankVector.length() - attachedCrankLength,
      crankAngle,
      crankPinPosition,
      crankPinVelocity,
      cyclePhase,
      floatingJointPosition,
      floatingJointVelocity,
      gearCenterDistanceError:
        pinionCenter.distanceTo(largeGearCenter) - centerDistance,
      gearRatio: largeGearAngularSpeed / pinionAngularSpeed,
      guideRadialVelocityError,
      guideRadiusError: guideRadial.length() - inputCrankRadius,
      guideTangentialSlidingSpeed,
      largeGearAngle,
      largeGearAngularSpeed,
      meshPhaseInvariant:
        pinionTeeth * pinionAngle + largeGearTeeth * largeGearAngle,
      outputRockerAngle,
      outputRockerAngularSpeed,
      outputRockerClosureError:
        outputRockerVector.length() - outputRockerLength,
      pinionAngle,
      pinionAngularSpeed,
      pitchLineSpeedError:
        pinionContactVelocity.distanceTo(largeGearContactVelocity),
      stage,
      transmissionAngle: Math.acos(THREE.MathUtils.clamp(
        attachedCrankVector.dot(outputRockerVector)
          / (attachedCrankLength * outputRockerLength),
        -1,
        1,
      )),
    };
  };

  const stateAtCyclePhase = (phase) => stateAtTime(phase * cyclePeriod);
  const canonicalStates = {
    halfTurn: stateAtCyclePhase(0.5),
    quarterTurn: stateAtCyclePhase(0.25),
    source: stateAtCyclePhase(0),
    threeQuarterTurn: stateAtCyclePhase(0.75),
  };

  root.userData.mechanism =
    'spur-geared-eccentric-pin-guided-attached-crank-rocker';
  root.userData.blocks = {
    attachedCrank,
    attachedCrankBody,
    attachedCrankIndex,
    backRail,
    bearingRings,
    cameraEnvelope,
    crankPin,
    crankPinFace,
    fixedFrame,
    floatingJointPin,
    guideBridge,
    guideFollower,
    guideFollowerFace,
    guideRails,
    largeGear,
    largeGearBearingPlate,
    largeGearRotor,
    largeGearShaft,
    outputRocker,
    outputRockerBody,
    outputRockerIndex,
    pinion,
    pinionPedestal,
    pinionShaft,
    rockerPedestal,
    rockerPivotShaft,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.geometry = {
    attachedCrankDepth,
    attachedCrankLength,
    axis: Z_AXIS.clone(),
    centerDistance,
    crankPhaseOffset,
    crankPlaneZ,
    cyclePeriod,
    fixedRockerPivot: fixedRockerPivot.clone(),
    gearDepth,
    gearPlaneZ,
    grashofMargin,
    groundLength,
    guideFollowerRadius,
    guideHalfGap,
    guideRailRadius,
    guideRunningClearance,
    inputCrankRadius,
    largeGearAngularSpeed,
    largeGearCenter: largeGearCenter.clone(),
    largeGearPitchRadius,
    largeGearTeeth,
    largeGearToothPitch,
    meshPhaseInvariant,
    moduleScale,
    outputRockerDepth,
    outputRockerLength,
    pinionAngularSpeed,
    pinionCenter: pinionCenter.clone(),
    pinionPitchRadius,
    pinionTeeth,
    rockerPlaneZ,
    sourceCrankAngle,
    sourceLargeGearAngle,
    toothHeight,
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(pinion, state.pinionAngle);
    setSpin(largeGear, state.largeGearAngle);
    attachedCrank.position.set(
      state.crankPinPosition.x,
      state.crankPinPosition.y,
      crankPlaneZ,
    );
    attachedCrank.rotation.z = state.attachedCrankAngle;
    outputRocker.position.set(
      fixedRockerPivot.x,
      fixedRockerPivot.y,
      rockerPlaneZ,
    );
    outputRocker.rotation.z = state.outputRockerAngle;
    floatingJointPin.position.set(
      state.floatingJointPosition.x,
      state.floatingJointPosition.y,
      jointPinCenterZ,
    );
    root.userData.contacts = {
      attachedCrankPin: {
        closureError: state.attachedCrankClosureError,
        position: state.crankPinPosition.clone(),
      },
      circularGuide: {
        followerRadius: guideFollowerRadius,
        innerRailRadius: inputCrankRadius - guideHalfGap,
        outerRailRadius: inputCrankRadius + guideHalfGap,
        radialVelocityError: state.guideRadialVelocityError,
        radiusError: state.guideRadiusError,
        runningClearance: guideRunningClearance,
        slidingSpeed: state.guideTangentialSlidingSpeed,
      },
      floatingJoint: {
        attachedCrankClosureError: state.attachedCrankClosureError,
        outputRockerClosureError: state.outputRockerClosureError,
        position: state.floatingJointPosition.clone(),
      },
      spurMesh: {
        contactPoint: gearContactPoint.clone(),
        largeGearPitchRadius,
        largeGearTeeth,
        lineOfCenters: new THREE.Vector2(1, 0),
        meshPhaseInvariant: state.meshPhaseInvariant,
        pinionPitchRadius,
        pinionTeeth,
        pitchLineSpeedError: state.pitchLineSpeedError,
      },
    };
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
  root.userData.hideGround = true;
  root.userData.supportsRestart = true;
  root.userData.animationTiming = {authoredCyclePeriod:cyclePeriod,displayCycleDuration:cyclePeriod,playbackTimeScale:1};
  root.userData.fidelity = 'authored';
  markShadows(root);
  root.traverse((object) => {
    if (!object.userData.cameraFitGuide) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });
  for (const index of [
    attachedCrankIndex,
    crankPinFace,
    guideFollowerFace,
    largeGear.userData.rotationIndex,
    outputRockerIndex,
    pinion.userData.rotationIndex,
  ]) {
    index.castShadow = false;
    index.receiveShadow = false;
  }

  return {
    cameraDirection: new THREE.Vector3(.05, .03, 15),
    root,
    update,
    reset: () => update(0),
  };
}

export function createAuthoredGearLinkageMovement(movement) {
  switch (movement.id) {
    case 148: return gearedAlternatingCrank();
    default: return null;
  }
}
