import * as THREE from 'three';
import { makeCouplingShaft } from './coupling-shaft.js';
import {
  PALETTE,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function capsuleShape(startX, endX, radius) {
  const shape = new THREE.Shape();
  shape.moveTo(startX, -radius);
  shape.lineTo(endX, -radius);
  shape.absarc(endX, 0, radius, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(startX, radius);
  shape.absarc(startX, 0, radius, Math.PI / 2, Math.PI * 1.5, false);
  shape.closePath();
  return shape;
}

function capsuleHole(startX, endX, radius) {
  const hole = new THREE.Path();
  hole.moveTo(startX, -radius);
  hole.absarc(startX, 0, radius, -Math.PI / 2, -Math.PI * 1.5, true);
  hole.lineTo(endX, radius);
  hole.absarc(endX, 0, radius, Math.PI / 2, -Math.PI / 2, true);
  hole.lineTo(startX, -radius);
  hole.closePath();
  return hole;
}

function extrudedMesh(shape, depth, material) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.025,
    bevelThickness: 0.02,
    curveSegments: 32,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geometry, material);
}

function cylinderAlongZ(radius, depth, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function taperedInputArmShape(length) {
  const hubRadius = 0.38;
  const wristRadius = 0.22;
  const shape = new THREE.Shape();
  shape.moveTo(0, -hubRadius);
  shape.quadraticCurveTo(length * 0.24, -0.31, length - 0.16, -0.18);
  shape.absarc(length, 0, wristRadius, -Math.PI / 2, Math.PI / 2, false);
  shape.quadraticCurveTo(length * 0.24, 0.31, 0, hubRadius);
  shape.absarc(0, 0, hubRadius, Math.PI / 2, Math.PI * 1.5, false);
  shape.closePath();
  return shape;
}

function parallelOffsetSlottedCranks(movement) {
  const root = new THREE.Group();
  const centerDistance = 1.36;
  const inputCrankRadius = 1.72;
  const inputCenter = new THREE.Vector2(-centerDistance / 2, 0);
  const outputCenter = new THREE.Vector2(centerDistance / 2, 0);
  // Brown views from the plain crank's side: its shaft runs toward the
  // viewer and the wrist pin reaches back through the slotted crank.
  const inputPlaneZ = 0.31;
  const outputPlaneZ = -0.31;
  const crankDepth = 0.2;
  const sourceInputAngle = Math.PI / 3;
  const inputAngularSpeed = 0.82;
  const inputCyclePeriod = FULL_TURN / inputAngularSpeed;
  const minimumSlotRadius = inputCrankRadius - centerDistance;
  const maximumSlotRadius = inputCrankRadius + centerDistance;
  // Keep the rounded slot end clear of the shaft hub at minimum throw.
  const slotStartRadius = minimumSlotRadius - 0.02;
  const outputHubRadius = 0.17;
  const slotEndRadius = maximumSlotRadius + 0.2;
  const slotHalfWidth = 0.155;
  const wristPinRadius = 0.095;
  const outputBodyHalfWidth = 0.34;
  const outputBodyStart = 0.12;
  const outputBodyEnd = slotEndRadius + 0.22;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.5 });

  const inputCrank = new THREE.Group();
  const inputRotor = new THREE.Group();
  inputCrank.add(inputRotor);
  inputCrank.position.set(inputCenter.x, inputCenter.y, 0);
  inputCrank.userData.axis = Z_AXIS.clone();
  inputCrank.userData.rotor = inputRotor;
  inputCrank.userData.role = 'plain-fixed-radius-input-crank';
  root.add(inputCrank);

  const inputArm = extrudedMesh(
    taperedInputArmShape(inputCrankRadius),
    crankDepth,
    driverMaterial,
  );
  inputArm.position.z = inputPlaneZ;
  inputArm.userData.role = 'source-tapered-plain-crank-arm';
  inputRotor.add(inputArm);
  const inputHub = cylinderAlongZ(0.4, crankDepth * 1.35, driverMaterial, 38);
  inputHub.position.z = inputPlaneZ;
  inputHub.userData.role = 'input-crank-hub';
  inputRotor.add(inputHub);
  const inputWristBoss = cylinderAlongZ(0.23, crankDepth * 1.3, driverMaterial, 32);
  inputWristBoss.position.set(inputCrankRadius, 0, inputPlaneZ);
  inputWristBoss.userData.role = 'input-crank-wrist-boss';
  inputRotor.add(inputWristBoss);

  const outputCrank = new THREE.Group();
  const outputRotor = new THREE.Group();
  outputCrank.add(outputRotor);
  outputCrank.position.set(outputCenter.x, outputCenter.y, 0);
  outputCrank.userData.axis = Z_AXIS.clone();
  outputCrank.userData.rotor = outputRotor;
  outputCrank.userData.role = 'radially-slotted-variable-radius-output-crank';
  root.add(outputCrank);

  const outputShape = capsuleShape(
    outputBodyStart,
    outputBodyEnd,
    outputBodyHalfWidth,
  );
  outputShape.holes.push(capsuleHole(
    slotStartRadius,
    slotEndRadius,
    slotHalfWidth,
  ));
  const outputSlottedArm = extrudedMesh(
    outputShape,
    crankDepth,
    drivenMaterial,
  );
  outputSlottedArm.position.z = outputPlaneZ;
  outputSlottedArm.userData.role = 'continuous-radial-slot-output-arm';
  outputRotor.add(outputSlottedArm);
  const outputHub = cylinderAlongZ(outputHubRadius, crankDepth * 1.45, drivenMaterial, 40);
  outputHub.position.z = outputPlaneZ;
  outputHub.userData.role = 'output-slotted-crank-hub';
  outputRotor.add(outputHub);
  const outputIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.055, 0.025),
    whiteMaterial,
  );
  outputIndex.visible = false;
  outputIndex.position.set(outputBodyEnd - 0.35, outputBodyHalfWidth + 0.024, outputPlaneZ);
  outputIndex.userData.role = 'output-crank-face-index';
  outputRotor.add(outputIndex);

  // The plate's wrist pin projects well beyond the slotted crank.
  const wristPinBeyondSlot = 0.45;
  const wristPinLength = Math.abs(outputPlaneZ - inputPlaneZ)
    + crankDepth * 0.8 + wristPinBeyondSlot;
  const wristPin = cylinderAlongZ(
    wristPinRadius,
    wristPinLength,
    inkMaterial,
    28,
  );
  wristPin.position.set(
    inputCrankRadius,
    0,
    inputPlaneZ + Math.sign(inputPlaneZ) * crankDepth * 0.4
      - Math.sign(inputPlaneZ) * wristPinLength / 2,
  );
  wristPin.userData.axis = Z_AXIS.clone();
  wristPin.userData.parallelCouplingWrist = true;
  wristPin.userData.role = 'input-wrist-pin-through-output-slot';
  inputRotor.add(wristPin);
  const slotFollowerRoller = cylinderAlongZ(
    slotHalfWidth * 0.72,
    crankDepth * 0.72,
    inkMaterial,
    28,
  );
  slotFollowerRoller.position.set(inputCrankRadius, 0, outputPlaneZ);
  slotFollowerRoller.userData.role = 'wrist-roller-visible-in-radial-slot';
  inputRotor.add(slotFollowerRoller);

  const inputShaft = makeCouplingShaft({
    color: PALETTE.ink, radius: 0.105, startZ: 0.165, endZ: 1.915,
  });
  inputShaft.position.x = inputCenter.x;
  inputShaft.userData.role = 'first-offset-parallel-crank-shaft';
  root.add(inputShaft);
  const outputShaft = makeCouplingShaft({
    color: PALETTE.ink, radius: 0.105, startZ: -1.915, endZ: -0.165,
  });
  outputShaft.position.x = outputCenter.x;
  outputShaft.userData.role = 'second-offset-parallel-slotted-crank-shaft';
  root.add(outputShaft);

  const inputWristAnchor = new THREE.Object3D();
  inputWristAnchor.position.set(inputCrankRadius, 0, outputPlaneZ);
  inputWristAnchor.userData.role = 'input-wrist-center-at-output-plane';
  inputRotor.add(inputWristAnchor);
  const outputSlotAnchor = new THREE.Object3D();
  outputSlotAnchor.position.set(minimumSlotRadius, 0, outputPlaneZ);
  outputSlotAnchor.userData.role = 'same-wrist-center-in-output-slot-coordinates';
  outputRotor.add(outputSlotAnchor);

  const unwrapNear = (principalAngle, referenceAngle) => principalAngle
    + FULL_TURN * Math.round((referenceAngle - principalAngle) / FULL_TURN);
  const outputAngleAtInputAngle = (inputAngle) => {
    const relativeX = inputCrankRadius * Math.cos(inputAngle) - centerDistance;
    const relativeY = inputCrankRadius * Math.sin(inputAngle);
    return unwrapNear(Math.atan2(relativeY, relativeX), inputAngle);
  };
  const driverAngleAtOutputAngle = (outputAngle) => {
    const sine = Math.sin(outputAngle);
    const cosine = Math.cos(outputAngle);
    const slotRadius = -centerDistance * cosine + Math.sqrt(
      inputCrankRadius ** 2 - centerDistance ** 2 * sine ** 2,
    );
    const principal = Math.atan2(
      slotRadius * sine,
      centerDistance + slotRadius * cosine,
    );
    return {
      inputAngle: unwrapNear(principal, outputAngle),
      slotRadius,
    };
  };
  const sourceOutputAngle = outputAngleAtInputAngle(sourceInputAngle);

  const stateAtInputTravel = (
    inputTravel,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => {
    const inputAngle = sourceInputAngle + inputTravel;
    const sine = Math.sin(inputAngle);
    const cosine = Math.cos(inputAngle);
    const relativeX = inputCrankRadius * cosine - centerDistance;
    const relativeY = inputCrankRadius * sine;
    const radiusSquared = relativeX ** 2 + relativeY ** 2;
    const slotRadius = Math.sqrt(radiusSquared);
    const outputAngle = unwrapNear(
      Math.atan2(relativeY, relativeX),
      inputAngle,
    );
    const ratioNumerator = inputCrankRadius
      * (inputCrankRadius - centerDistance * cosine);
    const outputToInputSpeedRatio = ratioNumerator / radiusSquared;
    const ratioDerivative = inputCrankRadius * centerDistance
      * (centerDistance ** 2 - inputCrankRadius ** 2)
      * sine / radiusSquared ** 2;
    const outputAngularSpeed = resolvedInputAngularSpeed
      * outputToInputSpeedRatio;
    const outputAngularAcceleration = inputAngularAcceleration
      * outputToInputSpeedRatio
      + resolvedInputAngularSpeed ** 2 * ratioDerivative;
    const slotRadiusDerivative = inputCrankRadius * centerDistance
      * sine / slotRadius;
    const slotRadiusSecondDerivative = inputCrankRadius * centerDistance
      * cosine / slotRadius
      - (inputCrankRadius * centerDistance * sine) ** 2 / slotRadius ** 3;
    const slotRadialSpeed = resolvedInputAngularSpeed * slotRadiusDerivative;
    const slotRadialAcceleration = resolvedInputAngularSpeed ** 2
      * slotRadiusSecondDerivative
      + inputAngularAcceleration * slotRadiusDerivative;
    const wristPoint = new THREE.Vector2(
      inputCenter.x + inputCrankRadius * cosine,
      inputCenter.y + inputCrankRadius * sine,
    );
    const radialUnit = new THREE.Vector2(
      Math.cos(outputAngle),
      Math.sin(outputAngle),
    );
    const tangentialUnit = new THREE.Vector2(-radialUnit.y, radialUnit.x);
    const wristVelocity = new THREE.Vector2(
      -inputCrankRadius * resolvedInputAngularSpeed * sine,
      inputCrankRadius * resolvedInputAngularSpeed * cosine,
    );
    const wristAcceleration = new THREE.Vector2(
      -inputCrankRadius * (
        resolvedInputAngularSpeed ** 2 * cosine
          + inputAngularAcceleration * sine
      ),
      inputCrankRadius * (
        -(resolvedInputAngularSpeed ** 2) * sine
          + inputAngularAcceleration * cosine
      ),
    );
    const reconstructedWrist = outputCenter.clone().addScaledVector(
      radialUnit,
      slotRadius,
    );
    const reconstructedVelocity = radialUnit.clone()
      .multiplyScalar(slotRadialSpeed)
      .addScaledVector(
        tangentialUnit,
        slotRadius * outputAngularSpeed,
      );
    const reconstructedAcceleration = radialUnit.clone().multiplyScalar(
      slotRadialAcceleration - slotRadius * outputAngularSpeed ** 2,
    ).addScaledVector(
      tangentialUnit,
      slotRadius * outputAngularAcceleration
        + 2 * slotRadialSpeed * outputAngularSpeed,
    );

    return {
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      inputCenter: inputCenter.clone(),
      outputAngle,
      outputAngularAcceleration,
      outputAngularSpeed,
      outputCenter: outputCenter.clone(),
      outputToInputSpeedRatio,
      radialUnit,
      ratioDerivative,
      reconstructedAcceleration,
      reconstructedVelocity,
      reconstructedWrist,
      slotLocalPoint: new THREE.Vector2(slotRadius, 0),
      slotRadialAcceleration,
      slotRadialSpeed,
      slotRadius,
      slotRadiusDerivative,
      slotRadiusSecondDerivative,
      tangentialUnit,
      wristAcceleration,
      wristPoint,
      wristPositionError: reconstructedWrist.distanceTo(wristPoint),
      wristVelocity,
      wristVelocityError: reconstructedVelocity.distanceTo(wristVelocity),
      wristAccelerationError: reconstructedAcceleration.distanceTo(
        wristAcceleration,
      ),
    };
  };
  const stateAtTime = (time) => stateAtInputTravel(time * inputAngularSpeed);
  const solidClearanceAtInputTravel = (inputTravel) => {
    const state = stateAtInputTravel(inputTravel);
    return {
      crankPlaneClearance: Math.abs(outputPlaneZ - inputPlaneZ) - crankDepth,
      innerSlotTravelMargin: state.slotRadius - slotStartRadius,
      outerSlotTravelMargin: slotEndRadius - state.slotRadius,
      wristToSlotSideClearance: slotHalfWidth - wristPinRadius,
      rollerToHubClearance: state.slotRadius - slotHalfWidth * 0.72 - outputHubRadius,
    };
  };

  const canonicalTimes = Object.freeze({
    sourcePose: 0,
    fastestOutput: (FULL_TURN - sourceInputAngle) / inputAngularSpeed,
    quarterCycle: inputCyclePeriod / 4,
    slowestOutput: (Math.PI - sourceInputAngle) / inputAngularSpeed,
    threeQuarterCycle: inputCyclePeriod * 3 / 4,
    cycleClosure: inputCyclePeriod,
  });
  root.userData.archetype = 'offset-parallel-shaft-wrist-pin-radial-slot-coupling';
  root.userData.blocks = {
    inputArm,
    inputCrank,
    inputHub,
    inputShaft,
    inputWristAnchor,
    inputWristBoss,
    outputCrank,
    outputHub,
    outputIndex,
    outputShaft,
    outputSlotAnchor,
    outputSlottedArm,
    slotFollowerRoller,
    wristPin,
  };
  root.userData.hideGround = true;
  root.userData.cameraDistanceScale = 0.88;
  // Brown frames the figure with the slotted arm raised, filling about two
  // thirds of the plate; fitting the arm's whole revolution framed it small.
  // The fit keeps the upper sweep and the shafts, so the arm's tip leaves
  // the frame briefly only while it points down (a deliberate plate crop).
  const sweptRadius = outputBodyEnd + outputBodyHalfWidth + 0.025;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(outputCenter.x - sweptRadius * 0.75, -sweptRadius * 0.35, -1.915),
    new THREE.Vector3(outputCenter.x + sweptRadius * 0.75, sweptRadius, 1.915),
  );
  // The whole revolution, kept separately from the plate crop above.
  root.userData.sweptBounds = new THREE.Box3(
    new THREE.Vector3(outputCenter.x - sweptRadius, -sweptRadius, -1.915),
    new THREE.Vector3(outputCenter.x + sweptRadius, sweptRadius, 1.915),
  );
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.driverAngleAtOutputAngle = driverAngleAtOutputAngle;
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    centerDistance,
    crankDepth,
    inputCenter,
    inputCrankRadius,
    inputPlaneZ,
    maximumSlotRadius,
    minimumSlotRadius,
    outputBodyEnd,
    outputBodyHalfWidth,
    outputBodyStart,
    outputHubRadius,
    outputCenter,
    outputPlaneZ,
    slotEndRadius,
    slotHalfWidth,
    slotStartRadius,
    sourceInputAngle,
    sourceOutputAngle,
    wristPinLength,
    wristPinRadius,
  };
  root.userData.mechanism = 'parallel-offset-shafts-coupled-by-wrist-in-radial-slot';
  root.userData.outputAngleAtInputAngle = outputAngleAtInputAngle;
  root.userData.solidClearanceAtInputTravel = solidClearanceAtInputTravel;
  root.userData.sourceAnimation = {
    available: false,
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate220: {
      imageHeight: 525,
      imageWidth: 525,
      rasterInputCrankCenter: new THREE.Vector2(196, 311),
      rasterInputShaftFarPoint: new THREE.Vector2(90, 390),
      rasterOutputCrankCenter: new THREE.Vector2(315, 315),
      rasterOutputShaftFarPoint: new THREE.Vector2(439, 224),
      rasterSlotFarEnd: new THREE.Vector2(310, 84),
      rasterWristAtInputPlane: new THREE.Vector2(263, 185),
      rasterWristAtSlotPlane: new THREE.Vector2(313, 151),
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtInputTravel = stateAtInputTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    inputAngularSpeed,
    inputCyclePeriod,
    maximumOutputToInputSpeedRatio: inputCrankRadius
      / (inputCrankRadius - centerDistance),
    minimumOutputToInputSpeedRatio: inputCrankRadius
      / (inputCrankRadius + centerDistance),
    outputTurnsPerInputTurn: 1,
    speedLaw: 'dOutput/dInput = r(r-d cos(input))/(r²+d²-2rd cos(input))',
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(inputCrank, state.inputAngle);
    setSpin(inputShaft, state.inputAngle);
    setSpin(outputCrank, state.outputAngle);
    setSpin(outputShaft, state.outputAngle);
    outputSlotAnchor.position.x = state.slotRadius;
    inputCrank.userData.angularSpeed = state.inputAngularSpeed;
    inputShaft.userData.angularSpeed = state.inputAngularSpeed;
    outputCrank.userData.angularSpeed = state.outputAngularSpeed;
    outputShaft.userData.angularSpeed = state.outputAngularSpeed;
    outputSlotAnchor.userData.radialSpeed = state.slotRadialSpeed;
    root.userData.constraint = {
      accelerationError: state.wristAccelerationError,
      positionError: state.wristPositionError,
      velocityError: state.wristVelocityError,
      wristPoint: state.wristPoint,
    };
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  root.traverse((object) => {
    for (const material of [object.material].flat().filter(Boolean)) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(7, 5.5, 9),
  };
}

export function createAuthoredOffsetCrankSlotMovement(movement) {
  if (movement.id !== 220) return null;
  return parallelOffsetSlottedCranks(movement);
}
