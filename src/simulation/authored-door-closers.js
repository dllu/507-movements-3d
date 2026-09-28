import { correctDoorCloserParts } from './door-closer-working-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeDynamicLink,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function quinticState(parameter) {
  const u = THREE.MathUtils.clamp(parameter, 0, 1);
  return {
    acceleration: 60 * u * (1 - u) * (1 - 2 * u),
    rate: 30 * u ** 2 * (1 - u) ** 2,
    value: u ** 3 * (10 + u * (-15 + 6 * u)),
  };
}

function cylinderAlongY(radius, length, material, segments = 32) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function ringAroundY(radius, tube, material, segments = 40) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 10, segments),
    material,
  );
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function yawFromPositiveX(vector) {
  return Math.atan2(-vector.z, vector.x);
}

function makeSocketedPin({
  baseY,
  endpointY,
  frameMaterial,
  pinMaterial,
  rolePrefix,
  whiteMaterial,
}) {
  const assembly = new THREE.Group();
  assembly.userData.role = `${rolePrefix}-socket-assembly`;

  const socketHeight = 0.25;
  const socket = cylinderAlongY(0.19, socketHeight, frameMaterial, 36);
  socket.position.y = baseY + socketHeight / 2;
  socket.userData.role = `${rolePrefix}-socket-fixed-to-support`;
  assembly.add(socket);

  const socketLip = ringAroundY(0.19, 0.035, pinMaterial);
  socketLip.position.y = baseY + socketHeight;
  socketLip.userData.role = `${rolePrefix}-socket-upper-lip`;
  assembly.add(socketLip);

  const rotor = new THREE.Group();
  rotor.userData.role = `${rolePrefix}-pin-turning-in-socket`;
  assembly.add(rotor);

  const pinBottomY = baseY + 0.055;
  const pinTopY = endpointY + 0.17;
  const pin = cylinderAlongY(
    0.085,
    pinTopY - pinBottomY,
    pinMaterial,
    28,
  );
  pin.position.y = (pinBottomY + pinTopY) / 2;
  pin.userData.role = `${rolePrefix}-vertical-turning-pin`;
  rotor.add(pin);

  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 24, 16),
    pinMaterial,
  );
  eye.position.y = endpointY;
  eye.userData.role = `${rolePrefix}-link-end-eye`;
  rotor.add(eye);

  const orientationTab = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.10, 0.16),
    pinMaterial,
  );
  orientationTab.position.set(0.20, endpointY, 0);
  orientationTab.userData.role = `${rolePrefix}-pin-orientation-yoke`;
  rotor.add(orientationTab);

  const orientationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 0.018, 0.05),
    whiteMaterial,
  );
  orientationIndex.position.set(0.24, endpointY + 0.061, 0);
  orientationIndex.userData.role = `${rolePrefix}-white-pin-turn-index`;
  rotor.add(orientationIndex);

  assembly.userData.orientationIndex = orientationIndex;
  assembly.userData.rotor = rotor;
  assembly.userData.socket = socket;
  assembly.userData.socketLip = socketLip;
  return assembly;
}

function makeHangingWeight({ material, whiteMaterial }) {
  const group = new THREE.Group();
  group.userData.role = 'gravity-closing-suspended-weight';

  // Brown's weight is a small pear-shaped bulb, about a quarter of a link
  // length tall, hanging close under its neck.
  // The profile is closed on the axis at both ends, so the bulb is solid.
  // Pass 90: one smooth spline (a round bulb tapering into the neck), not a
  // few straight facets; the lathe has enough segments to read round.
  const profile = [
    ...new THREE.SplineCurve([
      [0, -0.291], [0.13, -0.262], [0.22, -0.175], [0.25, -0.055], [0.228, 0.065],
      [0.165, 0.160], [0.112, 0.225], [0.092, 0.267],
    ].map(([x, y]) => new THREE.Vector2(x, y))).getPoints(48),
    new THREE.Vector2(0, 0.267),
  ];
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 72),
    material,
  );
  body.position.y = 0.138;
  body.userData.role = 'pear-shaped-door-closing-weight';
  group.add(body);

  // The neck is centred on the bulb and sunk 0.10 into its top, so the
  // bulb closes round it instead of meeting it along the rim.
  const neck = cylinderAlongY(0.09, 0.23, material, 28);
  neck.position.y = 0.42;
  neck.userData.role = 'weight-neck';
  group.add(neck);

  const eye = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.035, 9, 28),
    material,
  );
  eye.position.y = 0.60;
  eye.userData.role = 'weight-suspension-eye';
  group.add(eye);

  const index = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 10),
    whiteMaterial,
  );
  index.position.set(0, 0.05, 0.395);
  index.userData.role = 'white-weight-height-index';
  group.add(index);

  group.userData.body = body;
  group.userData.eye = eye;
  group.userData.eyeOffsetY = 0.60;
  group.userData.index = index;
  return group;
}

function russianWeightedDoorCloser(movement) {
  const root = new THREE.Group();

  // Brown supplies a symmetric two-link toggle but no dimensions.  A real
  // door/frame pair is included so the two socketed pin paths and the phrase
  // "pins are brought together" have an explicit spatial interpretation.
  const doorWidth = 2.66;
  const doorHeight = 2.86;
  const doorThickness = 0.13;
  const hingeAxis = new THREE.Vector3(0, 0, 0);
  const framePinOffset = 1.05;
  const doorPinRadius = 2.25;
  const endpointY = 3.64;
  const linkLength = 2.15;
  const maximumDoorAngle = THREE.MathUtils.degToRad(78);
  const cycleDuration = 10;
  const openingEndPhase = 0.40;
  const openDwellEndPhase = 0.50;
  const closingEndPhase = 0.90;
  const weightSuspensionLength = 0.34;
  const weightMass = 1.4;
  const gravity = 9.81;
  const weightForce = weightMass * gravity;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.10,
    roughness: 0.72,
  });
  const wallMaterial = matte(0xc4c6c1, {
    metalness: 0,
    roughness: 0.90,
  });
  const doorMaterial = matte(PALETTE.driven, {
    metalness: 0.03,
    roughness: 0.73,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.30,
    roughness: 0.44,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0,
    roughness: 0.46,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'stationary-door-frame-and-wall';
  fixedFrame.userData.fixed = true;
  root.add(fixedFrame);

  const wallPanel = new THREE.Mesh(
    new THREE.BoxGeometry(2.25, doorHeight, doorThickness),
    wallMaterial,
  );
  wallPanel.position.set(-1.125, doorHeight / 2, -doorThickness / 2);
  wallPanel.userData.role = 'fixed-wall-beside-door-opening';
  fixedFrame.add(wallPanel);

  const jamb = new THREE.Mesh(
    new THREE.BoxGeometry(0.19, doorHeight + 0.28, 0.30),
    frameMaterial,
  );
  jamb.position.set(0, (doorHeight + 0.28) / 2, -0.10);
  jamb.userData.role = 'fixed-vertical-door-jamb';
  fixedFrame.add(jamb);

  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(5.10, 0.20, 0.30),
    frameMaterial,
  );
  lintel.position.set(0.25, doorHeight + 0.10, -0.10);
  lintel.userData.role = 'fixed-door-frame-lintel';
  fixedFrame.add(lintel);

  const frameSocketBracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.14, 0.46),
    frameMaterial,
  );
  frameSocketBracket.position.set(
    -framePinOffset,
    doorHeight + 0.16,
    0,
  );
  frameSocketBracket.userData.role = 'frame-pin-socket-bracket';
  fixedFrame.add(frameSocketBracket);

  const doorAssembly = new THREE.Group();
  doorAssembly.userData.role = 'door-turning-about-fixed-vertical-hinge';
  root.add(doorAssembly);

  const doorPanel = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth, doorHeight, doorThickness),
    doorMaterial,
  );
  doorPanel.position.set(
    doorWidth / 2,
    doorHeight / 2,
    -doorThickness / 2,
  );
  doorPanel.userData.role = 'moving-door-panel';
  doorAssembly.add(doorPanel);

  const doorTrim = [];
  for (const specification of [
    { x: 0.12, y: doorHeight / 2, sx: 0.07, sy: doorHeight - 0.20 },
    { x: doorWidth - 0.12, y: doorHeight / 2, sx: 0.07, sy: doorHeight - 0.20 },
    { x: doorWidth / 2, y: 0.12, sx: doorWidth - 0.20, sy: 0.07 },
    { x: doorWidth / 2, y: doorHeight - 0.12, sx: doorWidth - 0.20, sy: 0.07 },
  ]) {
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(specification.sx, specification.sy, 0.025),
      darkMaterial,
    );
    trim.position.set(specification.x, specification.y, 0.012);
    trim.userData.role = 'one-of-four-door-face-trim-bars';
    doorAssembly.add(trim);
    doorTrim.push(trim);
  }

  const doorHandle = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 24, 16),
    brassMaterial,
  );
  doorHandle.position.set(doorWidth - 0.31, 1.48, 0.10);
  doorHandle.userData.role = 'door-opening-handle';
  doorAssembly.add(doorHandle);

  const hingeBarrels = [];
  for (const y of [0.48, 1.43, 2.38]) {
    const barrel = cylinderAlongY(0.115, 0.38, darkMaterial, 28);
    barrel.position.set(0, y, 0);
    barrel.userData.role = 'one-of-three-fixed-axis-door-hinge-barrels';
    root.add(barrel);
    hingeBarrels.push(barrel);
  }

  const framePinAssembly = makeSocketedPin({
    baseY: doorHeight + 0.20,
    endpointY,
    frameMaterial,
    pinMaterial: darkMaterial,
    rolePrefix: 'frame-side',
    whiteMaterial,
  });
  framePinAssembly.position.x = -framePinOffset;
  root.add(framePinAssembly);
  const framePinRotor = framePinAssembly.userData.rotor;

  const doorSocketBracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.14, 0.46),
    doorMaterial,
  );
  doorSocketBracket.position.set(
    doorPinRadius,
    doorHeight + 0.16,
    0,
  );
  doorSocketBracket.userData.role = 'door-pin-socket-bracket';
  doorAssembly.add(doorSocketBracket);

  const doorPinAssembly = makeSocketedPin({
    baseY: doorHeight + 0.20,
    endpointY,
    frameMaterial: doorMaterial,
    pinMaterial: darkMaterial,
    rolePrefix: 'door-side',
    whiteMaterial,
  });
  doorPinAssembly.position.x = doorPinRadius;
  doorAssembly.add(doorPinAssembly);
  const doorPinRotor = doorPinAssembly.userData.rotor;

  const frameToggleLink = makeDynamicLink({
    color: PALETTE.driver,
    depth: 0.16,
    jointRadius: 0.14,
    thickness: 0.13,
  });
  frameToggleLink.userData.role = 'fixed-frame-pin-to-weighted-toggle-link';
  root.add(frameToggleLink);

  const doorToggleLink = makeDynamicLink({
    color: PALETTE.driver,
    depth: 0.16,
    jointRadius: 0.14,
    thickness: 0.13,
  });
  doorToggleLink.userData.role = 'door-pin-to-weighted-toggle-link';
  root.add(doorToggleLink);

  const toggleJoint = new THREE.Group();
  toggleJoint.userData.role = 'weighted-central-toggle-joint';
  root.add(toggleJoint);
  const toggleEye = new THREE.Mesh(
    new THREE.SphereGeometry(0.20, 28, 18),
    darkMaterial,
  );
  toggleEye.userData.role = 'central-toggle-pin-eye';
  toggleJoint.add(toggleEye);
  const toggleIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 10),
    whiteMaterial,
  );
  toggleIndex.position.set(0, 0.15, 0.12);
  toggleIndex.userData.role = 'white-toggle-height-index';
  toggleJoint.add(toggleIndex);

  const weight = makeHangingWeight({
    material: brassMaterial,
    whiteMaterial,
  });
  root.add(weight);
  const weightEyeOffsetY = weight.userData.eyeOffsetY;

  const suspension = makeDynamicLink({
    color: PALETTE.ink,
    depth: 0.055,
    jointRadius: 0.055,
    thickness: 0.055,
  });
  suspension.userData.role = 'vertical-link-from-toggle-joint-to-weight-eye';
  root.add(suspension);

  const frameAnchor = new THREE.Vector3(
    -framePinOffset,
    endpointY,
    0,
  );
  const openSegmentDuration = openingEndPhase * cycleDuration;
  const closeSegmentDuration = (
    closingEndPhase - openDwellEndPhase
  ) * cycleDuration;

  const scheduleAtTime = (time) => {
    const wrappedTime = positiveModulo(time, cycleDuration);
    const phase = wrappedTime / cycleDuration;
    if (phase < openingEndPhase) {
      const smooth = quinticState(phase / openingEndPhase);
      return {
        acceleration: smooth.acceleration / openSegmentDuration ** 2,
        fraction: smooth.value,
        rate: smooth.rate / openSegmentDuration,
        stage: 'external-opening-raises-weight',
      };
    }
    if (phase < openDwellEndPhase) {
      return {
        acceleration: 0,
        fraction: 1,
        rate: 0,
        stage: 'open-dwell-weight-raised',
      };
    }
    if (phase < closingEndPhase) {
      const local = (
        phase - openDwellEndPhase
      ) / (closingEndPhase - openDwellEndPhase);
      const smooth = quinticState(local);
      return {
        acceleration: -smooth.acceleration / closeSegmentDuration ** 2,
        fraction: 1 - smooth.value,
        rate: -smooth.rate / closeSegmentDuration,
        stage: 'gravity-weight-closes-door',
      };
    }
    return {
      acceleration: 0,
      fraction: 0,
      rate: 0,
      stage: 'closed-dwell-against-stop',
    };
  };

  const stateAtTime = (time) => {
    const schedule = scheduleAtTime(time);
    const doorAngle = maximumDoorAngle * schedule.fraction;
    const doorAngularSpeed = maximumDoorAngle * schedule.rate;
    const doorAngularAcceleration = maximumDoorAngle
      * schedule.acceleration;
    const cosine = Math.cos(doorAngle);
    const sine = Math.sin(doorAngle);
    const doorAnchor = new THREE.Vector3(
      doorPinRadius * cosine,
      endpointY,
      -doorPinRadius * sine,
    );
    const doorAnchorVelocity = new THREE.Vector3(
      -doorPinRadius * sine * doorAngularSpeed,
      0,
      -doorPinRadius * cosine * doorAngularSpeed,
    );
    const chord = doorAnchor.clone().sub(frameAnchor);
    const endpointDistance = chord.length();
    const halfDistance = endpointDistance / 2;
    const toggleRise = Math.sqrt(
      linkLength ** 2 - halfDistance ** 2,
    );
    const endpointDistancePerDoorRadian = -framePinOffset
      * doorPinRadius * sine / endpointDistance;
    const toggleRisePerDoorRadian = framePinOffset
      * doorPinRadius * sine / (4 * toggleRise);
    const endpointDistanceRate = endpointDistancePerDoorRadian
      * doorAngularSpeed;
    const toggleRiseRate = toggleRisePerDoorRadian
      * doorAngularSpeed;
    const midpoint = frameAnchor.clone().add(doorAnchor)
      .multiplyScalar(0.5);
    const apex = midpoint.clone();
    apex.y += toggleRise;
    const apexVelocity = doorAnchorVelocity.clone().multiplyScalar(0.5);
    apexVelocity.y = toggleRiseRate;
    const weightCenter = apex.clone();
    weightCenter.y -= weightSuspensionLength + weightEyeOffsetY;
    const weightEye = weightCenter.clone();
    weightEye.y += weightEyeOffsetY;
    const potentialEnergy = weightForce * weightCenter.y;
    const potentialEnergyRate = weightForce * toggleRiseRate;
    const closingTorque = -weightForce
      * toggleRisePerDoorRadian;
    const gravityPower = closingTorque * doorAngularSpeed;
    const linkCompressionForce = weightForce * linkLength
      / (2 * toggleRise);
    const endpointSeparatingForce = weightForce * endpointDistance
      / (4 * toggleRise);
    const framePinYaw = yawFromPositiveX(chord);
    const doorToApexHorizontal = chord.clone().multiplyScalar(-1);
    doorToApexHorizontal.y = 0;
    const doorPinWorldYaw = yawFromPositiveX(doorToApexHorizontal);
    return {
      apex,
      apexVelocity,
      closingTorque,
      doorAnchor,
      doorAnchorVelocity,
      doorAngle,
      doorAngularAcceleration,
      doorAngularSpeed,
      doorPinRelativeYaw: doorPinWorldYaw - doorAngle,
      doorPinWorldYaw,
      endpointDistance,
      endpointDistancePerDoorRadian,
      endpointDistanceRate,
      endpointSeparatingForce,
      frameAnchor: frameAnchor.clone(),
      framePinYaw,
      gravityPower,
      linkCompressionForce,
      midpoint,
      openFraction: schedule.fraction,
      potentialEnergy,
      potentialEnergyRate,
      stage: schedule.stage,
      toggleRise,
      toggleRisePerDoorRadian,
      toggleRiseRate,
      weightCenter,
      weightEye,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    doorAssembly.rotation.y = state.doorAngle;
    framePinRotor.rotation.y = state.framePinYaw;
    doorPinRotor.rotation.y = state.doorPinRelativeYaw;
    frameToggleLink.userData.setEndpoints(state.frameAnchor, state.apex);
    doorToggleLink.userData.setEndpoints(state.doorAnchor, state.apex);
    frameToggleLink.userData.endpoints = {
      end: state.apex.clone(),
      start: state.frameAnchor.clone(),
    };
    doorToggleLink.userData.endpoints = {
      end: state.apex.clone(),
      start: state.doorAnchor.clone(),
    };
    toggleJoint.position.copy(state.apex);
    weight.position.copy(state.weightCenter);
    suspension.userData.setEndpoints(state.apex, state.weightEye);
    suspension.userData.endpoints = {
      end: state.weightEye.clone(),
      start: state.apex.clone(),
    };
    doorAssembly.userData.angularSpeed = state.doorAngularSpeed;
    framePinRotor.userData.worldYaw = state.framePinYaw;
    doorPinRotor.userData.worldYaw = state.doorPinWorldYaw;
    weight.userData.verticalSpeed = state.toggleRiseRate;
    root.userData.contacts = {
      doorHinge: {
        active: true,
        axis: new THREE.Vector3(0, 1, 0),
        point: hingeAxis.clone(),
      },
      doorPinInSocket: {
        active: true,
        point: state.doorAnchor,
        relativeYaw: state.doorPinRelativeYaw,
      },
      framePinInSocket: {
        active: true,
        point: state.frameAnchor,
        yaw: state.framePinYaw,
      },
      toggleJoint: {
        active: true,
        leftLinkClosure: state.apex.distanceTo(state.frameAnchor)
          - linkLength,
        point: state.apex,
        rightLinkClosure: state.apex.distanceTo(state.doorAnchor)
          - linkLength,
      },
    };
    root.userData.kinematics = state;
  };

  const closedState = stateAtTime(0);
  const openState = stateAtTime(openingEndPhase * cycleDuration);
  root.userData = {
    archetype:
      'socketed-door-frame-pins-weighted-spatial-toggle-door-closer',
    blocks: {
      doorAssembly,
      doorHandle,
      doorPanel,
      doorPinAssembly,
      doorPinOrientationIndex:
        doorPinAssembly.userData.orientationIndex,
      doorPinRotor,
      doorSocketBracket,
      doorToggleLink,
      doorTrim,
      fixedFrame,
      framePinAssembly,
      framePinOrientationIndex:
        framePinAssembly.userData.orientationIndex,
      framePinRotor,
      frameSocketBracket,
      frameToggleLink,
      hingeBarrels,
      jamb,
      lintel,
      suspension,
      toggleEye,
      toggleIndex,
      toggleJoint,
      wallPanel,
      weight,
      weightBody: weight.userData.body,
      weightEye: weight.userData.eye,
      weightIndex: weight.userData.index,
    },
    constraintResiduals: {
      closedLeftLinkLength: closedState.apex.distanceTo(
        closedState.frameAnchor,
      ) - linkLength,
      closedRightLinkLength: closedState.apex.distanceTo(
        closedState.doorAnchor,
      ) - linkLength,
      openLeftLinkLength: openState.apex.distanceTo(
        openState.frameAnchor,
      ) - linkLength,
      openRightLinkLength: openState.apex.distanceTo(
        openState.doorAnchor,
      ) - linkLength,
      symmetricApexAtClosed: closedState.apex.clone()
        .sub(closedState.midpoint)
        .setY(0)
        .length(),
      symmetricApexAtOpen: openState.apex.clone()
        .sub(openState.midpoint)
        .setY(0)
        .length(),
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      inputs: [
        'door angle about its fixed vertical hinge; external effort opens it and the raised weight supplies closing effort on return',
      ],
      note:
        'two equal rigid links close the spatial toggle exactly, so pin separation, apex height, weight height, and both socket-pin yaws follow the one door angle',
      storedEnergyStates: 1,
    },
    dynamics: {
      energyLaw:
        'U=m*g*weightHeight and gravity generalized torque about the door hinge is -dU/dDoorAngle',
      gravity,
      idealizations: [
        'door, frame, pins, sockets, and equal toggle links are rigid',
        'all hinge, socket, and toggle joints are frictionless and backlash-free',
        'the weight hangs vertically beneath the toggle apex on a fixed-length suspension',
        'motion is quasistatically prescribed; opening work raises the weight and gravity supplies the closing work',
        'dimensions, mass, absolute duration, easing, colors, and architectural context are independent reconstruction choices',
      ],
      sourceSpecifiesDimensionsMassGravityAbsoluteTimingOrDoorAngle: false,
      weightForce,
      weightMass,
    },
    fidelity: 'authored',
    geometry: {
      closedEndpointDistance: closedState.endpointDistance,
      closedToggleRise: closedState.toggleRise,
      doorHeight,
      doorPinRadius,
      doorThickness,
      doorWidth,
      endpointY,
      framePinOffset,
      hingeAxis,
      linkLength,
      maximumDoorAngle,
      openEndpointDistance: openState.endpointDistance,
      openToggleRise: openState.toggleRise,
      weightEyeOffsetY,
      weightSuspensionLength,
    },
    mechanism:
      'one-fixed-frame-socket-pin-one-door-socket-pin-two-equal-toggle-links-one-weighted-apex-one-vertical-door-hinge',
    sourceAnimation: {
      available: true,
      officialCanvasModelPresent: true,
      officialCanvasModelId: 'mm_385',
      normalizedEventPhases: [0, openingEndPhase, openDwellEndPhase, closingEndPhase, 1],
      sourcePrescribedAbsoluteTiming: false,
      sourceViewBox: [0, 0, 42, 42],
    },
    sourceReference: {
      brownPlate385: {
        centralJointPixels: new THREE.Vector2(263, 180),
        framePinPixels: new THREE.Vector2(34, 372),
        halfEndpointSpanPixels: 228.5,
        imageHeight: 525,
        imageWidth: 525,
        jointRisePixels: 192,
        measurementUncertaintyPixels: 6,
        movingPinPixels: new THREE.Vector2(491, 372),
        weightCenterPixels: new THREE.Vector2(264, 291),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'one turning pin is socketed to the door',
          'one turning pin is socketed to the fixed frame',
          'opening brings the two pins together and raises the weight',
          'the descending weight depresses the toggle joint toward a straight line and widens the pins to close the door',
        ],
        officialAnimationEvidence:
          'the inline mm_385 canvas model has a static support, an interpolated member, a connecting rod, and normalized key positions 0, 0.4, 0.5, and 0.9 in a 42-by-42 view',
        plateProportionUse:
          'the equal-link length is selected so the closed reconstruction reproduces the plate ratio of 192 pixels joint rise to 228.5 pixels half endpoint span',
        reconstructionDisclosure:
          'the real three-dimensional door hinge arc, absolute scale, 78-degree opening, ten-second quintic schedule, weight mass, materials, architecture, and camera are independently engineered reconstruction choices; the official animation supplies the qualitative action and normalized event phases',
      },
      officialPage: movement.sourceUrl,
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      demonstrationPeriod: cycleDuration,
      events: {
        closedDwellStarts: closingEndPhase * cycleDuration,
        closingStarts: openDwellEndPhase * cycleDuration,
        openDwellStarts: openingEndPhase * cycleDuration,
        openingStarts: 0,
      },
      normalizedEventPhases: [
        0,
        openingEndPhase,
        openDwellEndPhase,
        closingEndPhase,
        1,
      ],
      note:
        'source event proportions are retained; the ten-second duration and quintic easing are reconstruction choices giving zero velocity and acceleration at motion/dwell boundaries',
    },
    transmission: {
      endpointDistanceLaw:
        'd(delta)=sqrt(frameOffset^2+doorPinRadius^2+2*frameOffset*doorPinRadius*cos(delta))',
      gravityClosingTorqueLaw:
        'tau(delta)=-m*g*frameOffset*doorPinRadius*sin(delta)/(4*toggleRise)',
      toggleHeightLaw:
        'toggleRise(delta)=sqrt(linkLength^2-[endpointDistance(delta)/2]^2)',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.45, -0.06, -2.70),
    new THREE.Vector3(3.05, 5.34, 0.65),
  );
  root.userData.groundFloorY = 0;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(6.2, 4.8, 8.8),
    root,
    update,
  };
}

export function createAuthoredDoorCloserMovement(movement) {
  if (movement.id !== 385) return null;
  const model = correctDoorCloserParts(russianWeightedDoorCloser(movement));
  // The working-parts pass moves the eye (and neck) 0.15 along the lower
  // pin, clear of the suspension plate, which left the neck standing half
  // off the bulb's top. Centre the bulb, neck and height index under the
  // eye, so the neck is sunk squarely into the bulb, then refit the camera
  // bounds to the moved bulb.
  const { weightEye } = model.root.userData.blocks;
  const eyeZ = weightEye.position.z;
  for (const role of ['pear-shaped-door-closing-weight', 'weight-neck', 'white-weight-height-index']) {
    weightEye.parent.traverse((o) => { if (o.userData.role === role) o.position.z += eyeZ - (role === 'weight-neck' ? o.position.z : 0); });
  }
  // Pass 93: fit only the presented parts (pins, bosses, links, weight);
  // the door, wall, hinges and blocks are not presented, so they must not
  // widen the frame.
  const notPresented = /^(fixed-wall-beside-door-opening|moving-door-panel|one-of-three-fixed-axis-door-hinge-barrels|fixed-hinge-leaf-on-wall|door-hinge-leaf-on-door|(frame|door)-pin-socket-bracket|fixed-vertical-door-jamb|fixed-door-frame-lintel|one-of-four-door-face-trim-bars|door-opening-handle)$/;
  const bounds = model.root.userData.cameraFitBounds.makeEmpty(), box = new THREE.Box3();
  for (let i = 0; i <= 32; i += 1) {
    model.update(10 * i / 32);
    model.root.updateMatrixWorld(true);
    model.root.traverseVisible((o) => {
      if (!o.geometry || notPresented.test(o.userData.role ?? '')) return;
      o.geometry.computeBoundingBox();
      bounds.union(box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
    });
  }
  // Frame Brown's view: the pins in their bosses, the toggle and the weight.
  model.update(0);
  return model;
}
