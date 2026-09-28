import {correctBearingParts} from './bearing-working-parts.js';
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { creaseIndexedNormals } from './crease-normals.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function modulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function wrappedAngle(unwrappedAngle) {
  const turns = unwrappedAngle / FULL_TURN;
  if (Math.abs(turns - Math.round(turns)) < 1e-12) return 0;
  return modulo(unwrappedAngle, FULL_TURN);
}

function wrappedCycleCoordinate(time, period) {
  const cycles = time / period;
  if (Math.abs(cycles - Math.round(cycles)) < 1e-12) return 0;
  return modulo(time, period) / period;
}

function makeAxialCylinder({
  length,
  material,
  radius,
  role,
  segments = 48,
}) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  cylinder.userData.role = role;
  return cylinder;
}

function makeSupportWheel({
  hubRadius,
  indexAngle = 0,
  innerRadius,
  material,
  outerRadius,
  role,
  spokeCount,
  z,
}) {
  const wheel = new THREE.Group();
  wheel.userData.innerRadius = innerRadius;
  wheel.userData.outerRadius = outerRadius;
  wheel.userData.role = role;
  wheel.userData.spokeCount = spokeCount;
  wheel.userData.axialPlane = z;

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(
      (outerRadius + innerRadius) / 2,
      (outerRadius - innerRadius) / 2,
      16,
      144,
    ),
    material,
  );
  rim.position.z = z;
  rim.userData.innerRadius = innerRadius;
  rim.userData.outerRadius = outerRadius;
  rim.userData.role = `${role}-rolling-rim`;
  wheel.add(rim);

  const hub = makeAxialCylinder({
    length: 0.58,
    material,
    radius: hubRadius,
    role: `${role}-hub`,
  });
  hub.position.z = z;
  wheel.add(hub);

  const spokes = [];
  const spokeLength = innerRadius - hubRadius - 0.08;
  const spokeCenterRadius = (innerRadius + hubRadius + 0.08) / 2;
  for (let index = 0; index < spokeCount; index += 1) {
    const angle = Math.PI / 4 + FULL_TURN * index / spokeCount;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(spokeLength, 0.18, 0.28),
      material,
    );
    spoke.position.set(
      Math.cos(angle) * spokeCenterRadius,
      Math.sin(angle) * spokeCenterRadius,
      z,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `${role}-straight-spoke-${index + 1}`;
    spokes.push(spoke);
    wheel.add(spoke);
  }

  const index = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.14, 0.065),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  const indexRadius = (outerRadius + innerRadius) / 2;
  index.position.set(
    Math.cos(indexAngle) * indexRadius,
    Math.sin(indexAngle) * indexRadius,
    z + 0.24,
  );
  index.rotation.z = indexAngle;
  index.userData.initialAngle = indexAngle;
  index.userData.role = `${role}-white-rim-speed-index`;
  wheel.add(index);
  return { hub, index, rim, spokes, wheel };
}

// Round sides shade smoothly; the flat end caps keep their own normals.
function smoothBar(geometry) {
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  const merged = mergeVertices(geometry, 1e-6);
  geometry.dispose();
  return creaseIndexedNormals(merged, Math.PI / 4);
}

function makeMainShaftWheel({
  flywheelInnerRadius,
  flywheelOuterRadius,
  journalRadius,
  material,
  z,
}) {
  const rotor = new THREE.Group();
  rotor.userData.flywheelOuterRadius = flywheelOuterRadius;
  rotor.userData.journalRadius = journalRadius;
  rotor.userData.role = 'main-flywheel-and-supported-shaft-journal';

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(
      (flywheelOuterRadius + flywheelInnerRadius) / 2,
      (flywheelOuterRadius - flywheelInnerRadius) / 2,
      20,
      144,
    ),
    material,
  );
  rim.position.z = z;
  rim.userData.innerRadius = flywheelInnerRadius;
  rim.userData.outerRadius = flywheelOuterRadius;
  rim.userData.role = 'four-spoke-main-flywheel-rim';
  rotor.add(rim);

  const hub = makeAxialCylinder({
    length: 0.62,
    material,
    radius: 0.84,
    role: 'main-flywheel-hub',
  });
  hub.position.z = z;
  rotor.add(hub);

  const spokes = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = FULL_TURN * index / 4;
    const point = (radius, angularOffset) => new THREE.Vector3(
      Math.cos(angle + angularOffset) * radius,
      Math.sin(angle + angularOffset) * radius,
      0,
    );
    // Each spoke runs from inside the hub into the rim's section, so both
    // open tube ends are buried and the spoke visibly meets the rim.
    const curve = new THREE.QuadraticBezierCurve3(
      point(0.78, 0),
      point(2.05, 0.24),
      point(flywheelInnerRadius + 0.15, 0.12),
    );
    // A closed (capped) round bar swept along the curve.
    const section = new THREE.Shape().absarc(0, 0, 0.17, 0, FULL_TURN, false);
    const spoke = new THREE.Mesh(
      smoothBar(new THREE.ExtrudeGeometry(section, {
        bevelEnabled: false, curveSegments: 16, extrudePath: curve, steps: 36,
      })),
      material,
    );
    spoke.position.z = z;
    spoke.userData.role = `main-flywheel-curved-spoke-${index + 1}`;
    spokes.push(spoke);
    rotor.add(spoke);
  }

  const flywheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.15, 0.07),
    matte(PALETTE.white, { roughness: 0.45 }),
  );
  flywheelIndex.position.set(
    (flywheelOuterRadius + flywheelInnerRadius) / 2,
    0,
    z + 0.46,
  );
  flywheelIndex.userData.role = 'white-main-flywheel-speed-index';
  rotor.add(flywheelIndex);

  const journal = makeAxialCylinder({
    length: 2.5,
    material,
    radius: journalRadius,
    role: 'small-supported-shaft-journal-in-two-rolling-contacts',
    segments: 72,
  });
  journal.position.z = -0.12;
  rotor.add(journal);

  const journalIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.48, 0.055),
    matte(PALETTE.white, { roughness: 0.44 }),
  );
  journalIndex.position.set(0, journalRadius * 0.52, 0.91);
  journalIndex.userData.role = 'white-supported-journal-speed-index';
  rotor.add(journalIndex);
  return {
    flywheelIndex,
    hub,
    journal,
    journalIndex,
    rim,
    rotor,
    spokes,
  };
}

function makeBearingFrame(material) {
  const shape = new THREE.Shape();
  shape.moveTo(-4.78, -8.55);
  shape.lineTo(4.78, -8.55);
  shape.lineTo(4.78, -4.02);
  shape.quadraticCurveTo(4.78, -3.08, 4, -2.93);
  shape.quadraticCurveTo(3.23, -3.02, 3.13, -3.78);
  shape.lineTo(2.82, -5.1);
  shape.quadraticCurveTo(1.55, -5.58, 0, -5.58);
  shape.quadraticCurveTo(-1.55, -5.58, -2.82, -5.1);
  shape.lineTo(-3.13, -3.78);
  shape.quadraticCurveTo(-3.23, -3.02, -4, -2.93);
  shape.quadraticCurveTo(-4.78, -3.08, -4.78, -4.02);
  shape.closePath();

  const leftWindow = new THREE.Path();
  leftWindow.moveTo(-3.42, -6.66);
  leftWindow.lineTo(-3.24, -4.69);
  leftWindow.quadraticCurveTo(-2.05, -5.06, -1.06, -5.73);
  leftWindow.closePath();
  shape.holes.push(leftWindow);

  const rightWindow = new THREE.Path();
  rightWindow.moveTo(3.42, -6.66);
  rightWindow.lineTo(1.06, -5.73);
  rightWindow.quadraticCurveTo(2.05, -5.06, 3.24, -4.69);
  rightWindow.closePath();
  shape.holes.push(rightWindow);

  const lowerArch = new THREE.Path();
  lowerArch.moveTo(-2.86, -7.98);
  lowerArch.lineTo(-2.55, -7.08);
  lowerArch.quadraticCurveTo(-2.02, -5.93, 0, -5.84);
  lowerArch.quadraticCurveTo(2.02, -5.93, 2.55, -7.08);
  lowerArch.lineTo(2.86, -7.98);
  lowerArch.closePath();
  shape.holes.push(lowerArch);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.06,
    bevelThickness: 0.05,
    curveSegments: 32,
    depth: 0.34,
  });
  geometry.translate(0, 0, -0.17);
  const frame = new THREE.Mesh(geometry, material);
  frame.position.z = 0.14;
  frame.userData.fixed = true;
  frame.userData.role =
    'fixed-pedestal-frame-carrying-two-support-wheel-pivots';
  return frame;
}

function antiFrictionWheelBearing(movement) {
  const root = new THREE.Group();
  const renderScale = 0.7;
  root.scale.setScalar(renderScale);

  // The official canvas construction supplies an exact 0.6 journal, two
  // radius-5 support wheels, and pivots at (+/-4, -3.919184). Their 5.6
  // center distance is precisely 5 + 0.6, so both contacts are external and
  // the support-wheel rate is -0.6 / 5 = -0.12 of shaft speed.
  const journalRadius = 0.6;
  const flywheelOuterRadius = 4;
  const flywheelInnerRadius = 3.2;
  const supportOuterRadius = 5;
  const supportInnerRadius = 4.6;
  const supportHubRadius = 0.6;
  const supportAxleRadius = 0.18;
  const supportCenterX = 4;
  const centerDistance = supportOuterRadius + journalRadius;
  const supportCenterY = -Math.sqrt(
    centerDistance ** 2 - supportCenterX ** 2,
  );
  const driverAngularSpeed = 1;
  const supportAngularSpeed =
    -driverAngularSpeed * journalRadius / supportOuterRadius;
  const inputCyclePeriod = FULL_TURN / driverAngularSpeed;
  const fullMarkedAssemblyClosure = 25 * inputCyclePeriod;
  const leftSupportAxialPlane = 0.22;
  const rightSupportAxialPlane = 0.78;
  const supportRimHalfThickness =
    (supportOuterRadius - supportInnerRadius) / 2;
  const supportWheelAxialClearance =
    rightSupportAxialPlane - leftSupportAxialPlane
    - 2 * supportRimHalfThickness;

  const mainMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.52,
  });
  const supportMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.55,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const pinMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.46,
  });

  const main = makeMainShaftWheel({
    flywheelInnerRadius,
    flywheelOuterRadius,
    journalRadius,
    material: mainMaterial,
    z: -0.66,
  });
  root.add(main.rotor);

  const left = makeSupportWheel({
    hubRadius: supportHubRadius,
    indexAngle: Math.PI,
    innerRadius: supportInnerRadius,
    material: supportMaterial,
    outerRadius: supportOuterRadius,
    role: 'left-circumferential-support-wheel',
    spokeCount: 4,
    z: leftSupportAxialPlane,
  });
  left.wheel.position.set(-supportCenterX, supportCenterY, 0);
  const right = makeSupportWheel({
    hubRadius: supportHubRadius,
    indexAngle: 0,
    innerRadius: supportInnerRadius,
    material: supportMaterial,
    outerRadius: supportOuterRadius,
    role: 'right-circumferential-support-wheel',
    spokeCount: 4,
    z: rightSupportAxialPlane,
  });
  right.wheel.position.set(supportCenterX, supportCenterY, 0);
  root.add(left.wheel, right.wheel);

  const frame = makeBearingFrame(frameMaterial);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(10.7, 0.34, 1.1),
    frameMaterial,
  );
  base.position.set(0, -8.78, 0.16);
  base.userData.fixed = true;
  base.userData.role = 'fixed-bearing-frame-base';
  const supportAxialPlanes = [
    leftSupportAxialPlane,
    rightSupportAxialPlane,
  ];
  const pivotCaps = [-supportCenterX, supportCenterX].map((x, index) => {
    const cap = makeAxialCylinder({
      length: 0.16,
      material: pinMaterial,
      radius: 0.25,
      role: `${index === 0 ? 'left' : 'right'}-fixed-support-pivot-cap`,
      segments: 36,
    });
    cap.position.set(x, supportCenterY, supportAxialPlanes[index] + 0.37);
    cap.userData.fixed = true;
    return cap;
  });
  root.add(frame, base, ...pivotCaps);

  const shaftCenter = new THREE.Vector2(0, 0);
  const leftCenter = new THREE.Vector2(-supportCenterX, supportCenterY);
  const rightCenter = new THREE.Vector2(supportCenterX, supportCenterY);
  const contactForSupport = (supportCenter) => supportCenter.clone().add(
    shaftCenter.clone().sub(supportCenter)
      .normalize()
      .multiplyScalar(supportOuterRadius),
  );
  const leftContact = contactForSupport(leftCenter);
  const rightContact = contactForSupport(rightCenter);
  const contactMarkers = [leftContact, rightContact].map((point, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 24, 16),
      matte(PALETTE.accent, { metalness: 0.18, roughness: 0.48 }),
    );
    marker.position.set(
      point.x,
      point.y,
      supportAxialPlanes[index] + 0.23,
    );
    marker.userData.contactAxialPlane = supportAxialPlanes[index];
    marker.userData.fixed = true;
    marker.userData.role =
      `${index === 0 ? 'left' : 'right'}-exact-rolling-contact-marker`;
    return marker;
  });
  root.add(...contactMarkers);

  const velocityAtPoint = (angularSpeed, radialVector) => new THREE.Vector2(
    -angularSpeed * radialVector.y,
    angularSpeed * radialVector.x,
  );
  const contactState = (supportCenter, contact, axialPlane,
    supportAngleUnwrapped, driverAngleUnwrapped) => {
    const driverRadialVector = contact.clone().sub(shaftCenter);
    const supportRadialVector = contact.clone().sub(supportCenter);
    const driverVelocity = velocityAtPoint(
      driverAngularSpeed,
      driverRadialVector,
    );
    const supportVelocity = velocityAtPoint(
      supportAngularSpeed,
      supportRadialVector,
    );
    return {
      axialPlane,
      centerDistance: shaftCenter.distanceTo(supportCenter),
      contact: contact.clone(),
      contact3D: new THREE.Vector3(contact.x, contact.y, axialPlane),
      contactGap:
        shaftCenter.distanceTo(supportCenter)
        - journalRadius - supportOuterRadius,
      driverRadialVector,
      driverVelocity,
      normalFromSupportToShaft: shaftCenter.clone().sub(supportCenter)
        .normalize(),
      rollingPhaseError:
        journalRadius * driverAngleUnwrapped
        + supportOuterRadius * supportAngleUnwrapped,
      rollingVelocityError:
        journalRadius * driverAngularSpeed
        + supportOuterRadius * supportAngularSpeed,
      supportRadialVector,
      supportVelocity,
      tangentialVelocityError: driverVelocity.clone().sub(supportVelocity),
    };
  };

  const stateAtTime = (time) => {
    const driverAngleUnwrapped = driverAngularSpeed * time;
    const supportAngleUnwrapped =
      -driverAngleUnwrapped * journalRadius / supportOuterRadius;
    const leftRollingContact = contactState(
      leftCenter,
      leftContact,
      leftSupportAxialPlane,
      supportAngleUnwrapped,
      driverAngleUnwrapped,
    );
    const rightRollingContact = contactState(
      rightCenter,
      rightContact,
      rightSupportAxialPlane,
      supportAngleUnwrapped,
      driverAngleUnwrapped,
    );
    return {
      driverAngle: wrappedAngle(driverAngleUnwrapped),
      driverAngleUnwrapped,
      driverAngularAcceleration: 0,
      driverAngularSpeed,
      fullAssemblyCoordinate: wrappedCycleCoordinate(
        time,
        fullMarkedAssemblyClosure,
      ),
      inputCycleCoordinate: wrappedCycleCoordinate(time, inputCyclePeriod),
      leftRollingContact,
      leftSupportAngle: wrappedAngle(supportAngleUnwrapped),
      leftSupportAngleUnwrapped: supportAngleUnwrapped,
      leftSupportCenter: leftCenter.clone(),
      ordinaryJournalSlidingSpeed:
        Math.abs(driverAngularSpeed) * journalRadius,
      rightRollingContact,
      rightSupportAngle: wrappedAngle(supportAngleUnwrapped),
      rightSupportAngleUnwrapped: supportAngleUnwrapped,
      rightSupportCenter: rightCenter.clone(),
      rollingContactsNoSlip:
        leftRollingContact.tangentialVelocityError.length() < 1e-12
        && rightRollingContact.tangentialVelocityError.length() < 1e-12,
      shaftCenter: shaftCenter.clone(),
      supportAngularAcceleration: 0,
      supportAngularSpeed,
      supportAxleSlidingSpeed:
        Math.abs(supportAngularSpeed) * supportAxleRadius,
    };
  };

  root.userData.archetype =
    'shaft-journal-supported-by-two-circumferential-wheels-with-exact-no-slip-ratio';
  root.userData.blocks = {
    base,
    contactMarkers,
    frame,
    leftSupportHub: left.hub,
    leftSupportIndex: left.index,
    leftSupportRim: left.rim,
    leftSupportSpokes: left.spokes,
    leftSupportWheel: left.wheel,
    mainFlywheelHub: main.hub,
    mainFlywheelIndex: main.flywheelIndex,
    mainFlywheelRim: main.rim,
    mainFlywheelSpokes: main.spokes,
    mainRotor: main.rotor,
    pivotCaps,
    rightSupportHub: right.hub,
    rightSupportIndex: right.index,
    rightSupportRim: right.rim,
    rightSupportSpokes: right.spokes,
    rightSupportWheel: right.wheel,
    shaftJournal: main.journal,
    shaftJournalIndex: main.journalIndex,
  };
  root.userData.cameraDistanceScale = 0.9;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-6.45, -6.35, -0.9),
    new THREE.Vector3(6.45, 3, 0.85),
  );
  root.userData.geometry = {
    centerDistance,
    driverAngularSpeed,
    flywheelInnerRadius,
    flywheelOuterRadius,
    fullMarkedAssemblyClosure,
    inputCyclePeriod,
    journalRadius,
    renderScale,
    supportAngularSpeed,
    supportAxleRadius,
    supportCenterX,
    supportCenterY,
    supportHubRadius,
    supportInnerRadius,
    supportRimHalfThickness,
    supportOuterRadius,
    supportWheelAxialClearance,
    supportWheelAxialPlanes: [...supportAxialPlanes],
  };
  root.userData.mechanism =
    'small-main-shaft-journal-rolls-without-slip-on-two-large-circumferential-support-wheels-whose-fixed-pivots-replace-one-ordinary-bearing';
  root.userData.sourceAnimation = {
    available: true,
    independentlyReconstructed: true,
    officialAngularRateMultipliers: {
      mainShaft: 1,
      supportWheels: -0.12,
    },
    officialCanvasModelPresent: true,
    officialModelRadii: {
      journal: 0.6,
      mainFlywheel: 4,
      supportWheel: 5,
    },
    officialSupportPivots: [
      new THREE.Vector2(-4, -3.919184),
      new THREE.Vector2(4, -3.919184),
    ],
    referenceScope:
      'wheel counts, centers, radii, spoke counts, rotation directions, and exact minus-0.12 support-wheel rate',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate250: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one small shaft journal at the center of a four-spoke flywheel rests simultaneously on the circumferences of two four-spoke wheels carried by a fixed pedestal',
      measurementUncertaintyPixels: 5,
      officialAnimationAvailable: true,
      rasterFrameBounds: {
        bottom: 450,
        left: 135,
        right: 394,
        top: 220,
      },
      rasterJournal: {
        centerX: 266,
        centerY: 141,
        radius: 17,
      },
      rasterMainFlywheel: {
        centerX: 266,
        centerY: 141,
        outerRadius: 90,
      },
      rasterSupportWheels: [
        { centerX: 175, centerY: 241, outerRadius: 119 },
        { centerX: 354, centerY: 241, outerRadius: 119 },
      ],
      view: 'front-elevation-through-three-parallel-wheel-axes',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 63,
      edition: 21,
      illustrationPage: 62,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    fullMarkedAssemblyClosure,
    inputRevolution: inputCyclePeriod,
  };
  root.userData.transmission = {
    axiallySeparatedSupportWheels: true,
    contactCount: 2,
    contactType: 'external-pure-rolling',
    driver: 'main-shaft-journal',
    fullClosureDriverTurns: 25,
    fullClosureSupportTurns: -3,
    inputCyclePeriod,
    ordinaryJournalSlidingSpeed:
      Math.abs(driverAngularSpeed) * journalRadius,
    supportAxleSlidingSpeed:
      Math.abs(supportAngularSpeed) * supportAxleRadius,
    supportToShaftSpeedRatio: supportAngularSpeed / driverAngularSpeed,
    supportWheelCount: 2,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    main.rotor.rotation.z = state.driverAngle;
    left.wheel.rotation.z = state.leftSupportAngle;
    right.wheel.rotation.z = state.rightSupportAngle;
    root.userData.contacts = {
      leftJournalToSupportRim: {
        gap: state.leftRollingContact.contactGap,
        point: state.leftRollingContact.contact.clone(),
        rollingPhaseError: state.leftRollingContact.rollingPhaseError,
        tangentialVelocityError:
          state.leftRollingContact.tangentialVelocityError.clone(),
      },
      rightJournalToSupportRim: {
        gap: state.rightRollingContact.contactGap,
        point: state.rightRollingContact.contact.clone(),
        rollingPhaseError: state.rightRollingContact.rollingPhaseError,
        tangentialVelocityError:
          state.rightRollingContact.tangentialVelocityError.clone(),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(0.8, 1.2, 10),
  };
}

function sixRollerPulleyBearing(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.94);

  const rollerCount = 6;
  const innerRaceRadius = 0.5;
  const rollerPitchRadius = 0.45;
  const rollerBodyRadius = rollerPitchRadius;
  const rollerCenterRadius = innerRaceRadius + rollerPitchRadius;
  const outerRaceInnerRadius = rollerCenterRadius + rollerPitchRadius;
  const adjacentRollerCenterDistance = 2 * rollerCenterRadius
    * Math.sin(Math.PI / rollerCount);
  const adjacentRollerClearance = adjacentRollerCenterDistance
    - 2 * rollerBodyRadius;
  const pulleyOuterRadius = 2.05;
  const pulleyWebOuterRadius = 1.86;
  const pulleyDepth = 0.46;
  const pulleyRimDepth = 0.58;
  const rollerDepth = 0.5;
  const innerRaceDepth = 0.86;
  const cageDepth = 0.08;

  // Brown's 270 hangs a round twisted rope, not a flat belt, about 0.16
  // across at this scale.
  const beltThickness = 0.16;
  const beltDepth = 0.16;
  const beltCenterlineRadius = pulleyOuterRadius + beltThickness / 2;
  const beltLegLength = 3;
  const beltVisibleLength = 2 * beltLegLength
    + Math.PI * beltCenterlineRadius;
  const beltMarkerLoopLength = FULL_TURN * pulleyOuterRadius;
  const beltHiddenReturnLength = beltMarkerLoopLength - beltVisibleLength;
  const beltMarkerCount = 8;

  const demonstrationPeriod = 6;
  // Brown's arrow on the left figure runs counter-clockwise (down the
  // left side), so the pulley turns anticlockwise seen from the front.
  const outerRaceAngularSpeed = FULL_TURN / demonstrationPeriod;
  const cageToOuterSpeedRatio = outerRaceInnerRadius
    / (innerRaceRadius + outerRaceInnerRadius);
  const rollerToOuterSpeedRatio = outerRaceInnerRadius
    / (outerRaceInnerRadius - innerRaceRadius);
  const cageAngularSpeed = outerRaceAngularSpeed * cageToOuterSpeedRatio;
  const rollerAngularSpeed = outerRaceAngularSpeed
    * rollerToOuterSpeedRatio;
  const beltLinearSpeed = -outerRaceAngularSpeed * pulleyOuterRadius;
  const fullMarkedAssemblyOuterTurns = 171;
  const fullMarkedAssemblyClosure = fullMarkedAssemblyOuterTurns
    * demonstrationPeriod;

  const pulleyMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.55,
  });
  const rollerMaterial = matte(PALETTE.accent, {
    metalness: 0.17,
    roughness: 0.5,
  });
  const cageMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const beltMaterial = matte(PALETTE.belt, {
    metalness: 0.05,
    roughness: 0.7,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.47,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const centeredExtrusion = (shape, depth, bevelSize = 0.008) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize,
      bevelThickness: bevelSize,
      curveSegments: 32,
      depth,
    });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  };
  const makeAnnulus = ({
    depth,
    innerRadius,
    material,
    outerRadius,
    role,
  }) => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
    shape.holes.push(hole);
    const mesh = new THREE.Mesh(
      centeredExtrusion(shape, depth, Math.min(0.012, depth * 0.14)),
      material,
    );
    mesh.userData.innerRadius = innerRadius;
    mesh.userData.outerRadius = outerRadius;
    mesh.userData.role = role;
    return mesh;
  };

  const pulley = new THREE.Group();
  const pulleyRotor = new THREE.Group();
  pulley.add(pulleyRotor);
  pulley.userData.axis = new THREE.Vector3(0, 0, 1);
  pulley.userData.rotor = pulleyRotor;
  pulley.userData.role =
    'belt-driven-pulley-and-outer-bearing-race-rotating-as-one-member';
  const pulleyWeb = makeAnnulus({
    depth: pulleyDepth,
    innerRadius: outerRaceInnerRadius,
    material: pulleyMaterial,
    outerRadius: pulleyWebOuterRadius,
    role: 'cutaway-visible-solid-pulley-web-outside-bearing-race',
  });
  const pulleyRim = makeAnnulus({
    depth: pulleyRimDepth,
    innerRadius: pulleyWebOuterRadius - 0.12,
    material: pulleyMaterial,
    outerRadius: pulleyOuterRadius,
    role: 'wide-belt-pulley-rim-and-working-tread',
  });
  const outerRaceSurface = new THREE.Mesh(
    new THREE.TorusGeometry(
      outerRaceInnerRadius + 0.035,
      0.035,
      10,
      96,
    ),
    darkMaterial,
  );
  outerRaceSurface.position.z = pulleyDepth / 2 + 0.01;
  outerRaceSurface.userData.innerWorkingRadius = outerRaceInnerRadius;
  outerRaceSurface.userData.role =
    'internal-working-surface-of-rotating-outer-race';
  outerRaceSurface.visible = false; // ink edge line only: kept for references, not drawn
  outerRaceSurface.userData.retiredInkOutline = true;
  const pulleyFrontFlange = new THREE.Mesh(
    new THREE.TorusGeometry(pulleyOuterRadius - 0.035, 0.035, 9, 96),
    darkMaterial,
  );
  pulleyFrontFlange.position.z = pulleyRimDepth / 2 + 0.015;
  pulleyFrontFlange.userData.role = 'front-edge-of-belt-pulley-tread';
  pulleyFrontFlange.visible = false; // ink edge line only: kept for references, not drawn
  pulleyFrontFlange.userData.retiredInkOutline = true;
  const pulleyRearFlange = pulleyFrontFlange.clone();
  pulleyRearFlange.position.z = -pulleyRimDepth / 2 - 0.015;
  pulleyRearFlange.userData.role = 'rear-edge-of-belt-pulley-tread';
  const pulleyIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.075, 0.055),
    whiteMaterial,
  );
  pulleyIndex.position.set(1.56, 0, pulleyDepth / 2 + 0.055);
  pulleyIndex.userData.role = 'white-index-on-pulley-and-outer-race';
  pulleyRotor.add(
    pulleyWeb,
    pulleyRim,
    outerRaceSurface,
    pulleyFrontFlange,
    pulleyRearFlange,
    pulleyIndex,
  );

  const innerRace = makeAxialCylinder({
    length: innerRaceDepth,
    material: darkMaterial,
    radius: innerRaceRadius,
    role: 'stationary-inner-race-and-pulley-journal',
    segments: 64,
  });
  innerRace.position.z = -0.02;
  innerRace.userData.fixed = true;
  const innerRaceFrontRing = new THREE.Mesh(
    new THREE.TorusGeometry(innerRaceRadius * 0.76, 0.045, 9, 54),
    frameMaterial,
  );
  innerRaceFrontRing.position.z = innerRaceDepth / 2 + 0.02;
  innerRaceFrontRing.userData.fixed = true;
  innerRaceFrontRing.userData.role = 'front-face-of-stationary-inner-race';
  const innerRaceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.065, 0.045),
    whiteMaterial,
  );
  innerRaceIndex.position.set(
    0,
    innerRaceRadius * 0.52,
    innerRaceDepth / 2 + 0.055,
  );
  innerRaceIndex.userData.fixed = true;
  innerRaceIndex.userData.role = 'white-stationary-inner-race-index';

  const rollerCarrier = new THREE.Group();
  rollerCarrier.userData.axis = new THREE.Vector3(0, 0, 1);
  rollerCarrier.userData.role =
    'six-pocket-retainer-orbiting-with-roller-center-cage-speed';
  const cagePlate = makeAnnulus({
    depth: cageDepth,
    innerRadius: innerRaceRadius + 0.08,
    material: cageMaterial,
    outerRadius: outerRaceInnerRadius - 0.08,
    role: 'rear-retaining-plate-for-six-equally-spaced-rollers',
  });
  cagePlate.position.z = -rollerDepth / 2 - 0.075;
  const cageIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 16, 10),
    whiteMaterial,
  );
  cageIndex.position.set(
    innerRaceRadius + 0.12,
    0,
    -rollerDepth / 2 - 0.02,
  );
  cageIndex.userData.role = 'white-index-on-roller-retainer';
  rollerCarrier.add(cagePlate, cageIndex);

  const rollerAssemblies = [];
  const rollerBodies = [];
  const rollerHubs = [];
  const rollerIndices = [];
  const rollerInitialAngles = [];
  for (let index = 0; index < rollerCount; index += 1) {
    const initialAngle = Math.PI / 2 + FULL_TURN * index / rollerCount;
    rollerInitialAngles.push(initialAngle);
    const positionGroup = new THREE.Group();
    positionGroup.position.set(
      Math.cos(initialAngle) * rollerCenterRadius,
      Math.sin(initialAngle) * rollerCenterRadius,
      0,
    );
    positionGroup.userData.index = index;
    positionGroup.userData.role = `roller-${index + 1}-orbit-position`;
    const rotor = new THREE.Group();
    rotor.userData.axis = new THREE.Vector3(0, 0, 1);
    rotor.userData.role = `roller-${index + 1}-material-spin`;
    const body = makeAxialCylinder({
      length: rollerDepth,
      material: rollerMaterial,
      radius: rollerBodyRadius,
      role: `cylindrical-working-body-of-roller-${index + 1}`,
      segments: 48,
    });
    const frontRing = new THREE.Mesh(
      new THREE.TorusGeometry(
        rollerBodyRadius * 0.78,
        0.025,
        8,
        40,
      ),
      darkMaterial,
    );
    frontRing.position.z = rollerDepth / 2 + 0.018;
    frontRing.userData.role = `front-face-ring-of-roller-${index + 1}`;
    frontRing.visible = false; // ink edge line only: kept for references, not drawn
    frontRing.userData.retiredInkOutline = true;
    const hub = makeAxialCylinder({
      length: rollerDepth * 1.1,
      material: darkMaterial,
      radius: 0.085,
      role: `center-hole-of-roller-${index + 1}`,
      segments: 24,
    });
    const faceIndex = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.045, 0.04),
      whiteMaterial,
    );
    faceIndex.position.set(
      rollerBodyRadius * 0.58,
      0,
      rollerDepth / 2 + 0.045,
    );
    faceIndex.userData.role = `white-spin-index-on-roller-${index + 1}`;
    rotor.add(body, frontRing, hub, faceIndex);
    positionGroup.add(rotor);
    rollerCarrier.add(positionGroup);
    rollerAssemblies.push({
      body,
      faceIndex,
      frontRing,
      hub,
      index,
      initialAngle,
      positionGroup,
      rotor,
    });
    rollerBodies.push(body);
    rollerHubs.push(hub);
    rollerIndices.push(faceIndex);
  }

  const supportPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 2.25, 0.3),
    frameMaterial,
  );
  supportPost.position.set(0, -2.35, -0.62);
  supportPost.userData.fixed = true;
  supportPost.userData.role = 'fixed-post-carrying-stationary-inner-race';
  const supportFoot = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.18, 0.42),
    frameMaterial,
  );
  supportFoot.position.set(0, -3.43, -0.62);
  supportFoot.userData.fixed = true;
  supportFoot.userData.role = 'fixed-base-of-pulley-bearing-standard';

  const beltOuterRadius = beltCenterlineRadius + beltThickness / 2;
  const beltInnerRadius = beltCenterlineRadius - beltThickness / 2;
  const beltShape = new THREE.Shape();
  beltShape.moveTo(-beltOuterRadius, -beltLegLength);
  beltShape.lineTo(-beltOuterRadius, 0);
  const beltArcSamples = 64;
  for (let sample = 0; sample <= beltArcSamples; sample += 1) {
    const angle = Math.PI - Math.PI * sample / beltArcSamples;
    beltShape.lineTo(
      Math.cos(angle) * beltOuterRadius,
      Math.sin(angle) * beltOuterRadius,
    );
  }
  beltShape.lineTo(beltOuterRadius, -beltLegLength);
  beltShape.lineTo(beltInnerRadius, -beltLegLength);
  beltShape.lineTo(beltInnerRadius, 0);
  for (let sample = 0; sample <= beltArcSamples; sample += 1) {
    const angle = Math.PI * sample / beltArcSamples;
    beltShape.lineTo(
      Math.cos(angle) * beltInnerRadius,
      Math.sin(angle) * beltInnerRadius,
    );
  }
  beltShape.lineTo(-beltInnerRadius, -beltLegLength);
  beltShape.closePath();
  const belt = new THREE.Mesh(
    centeredExtrusion(beltShape, beltDepth, 0.006),
    beltMaterial,
  );
  belt.userData.centerlineRadius = beltCenterlineRadius;
  belt.userData.innerWorkingRadius = beltInnerRadius;
  belt.userData.role =
    'single-flat-belt-with-exact-straight-to-semicircular-tangent-path';

  const beltPointAtVisibleDistance = (distance) => {
    const clampedDistance = THREE.MathUtils.clamp(
      distance,
      0,
      beltVisibleLength,
    );
    if (clampedDistance <= beltLegLength) {
      return {
        accelerationDirection: new THREE.Vector2(0, 0),
        curvature: 0,
        pathStage: 'left-straight-rising',
        position: new THREE.Vector2(
          -beltCenterlineRadius,
          -beltLegLength + clampedDistance,
        ),
        tangent: new THREE.Vector2(0, 1),
      };
    }
    const arcDistance = clampedDistance - beltLegLength;
    const arcLength = Math.PI * beltCenterlineRadius;
    if (arcDistance <= arcLength) {
      const angle = Math.PI - arcDistance / beltCenterlineRadius;
      return {
        accelerationDirection: new THREE.Vector2(
          -Math.cos(angle),
          -Math.sin(angle),
        ),
        angle,
        curvature: 1 / beltCenterlineRadius,
        pathStage: 'upper-semicircular-pulley-wrap',
        position: new THREE.Vector2(
          Math.cos(angle) * beltCenterlineRadius,
          Math.sin(angle) * beltCenterlineRadius,
        ),
        tangent: new THREE.Vector2(
          Math.sin(angle),
          -Math.cos(angle),
        ),
      };
    }
    const rightLegDistance = arcDistance - arcLength;
    return {
      accelerationDirection: new THREE.Vector2(0, 0),
      curvature: 0,
      pathStage: 'right-straight-falling',
      position: new THREE.Vector2(
        beltCenterlineRadius,
        -rightLegDistance,
      ),
      tangent: new THREE.Vector2(0, -1),
    };
  };

  const beltMarkerOffsets = Array.from(
    { length: beltMarkerCount },
    (_, index) => beltMarkerLoopLength * index / beltMarkerCount,
  );
  const beltMarkers = beltMarkerOffsets.map((offset, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 18, 12),
      whiteMaterial,
    );
    marker.userData.index = index;
    marker.userData.initialDistance = offset;
    marker.userData.role = `arc-length-belt-marker-${index + 1}`;
    return marker;
  });
  const beltMarkerStateAtTime = (time, index) => {
    const routeDistance = modulo(
      beltMarkerOffsets[index] + beltLinearSpeed * time,
      beltMarkerLoopLength,
    );
    if (routeDistance <= beltVisibleLength) {
      const point = beltPointAtVisibleDistance(routeDistance);
      return {
        ...point,
        acceleration: point.accelerationDirection.clone().multiplyScalar(
          beltLinearSpeed ** 2 * point.curvature,
        ),
        routeDistance,
        velocity: point.tangent.clone().multiplyScalar(beltLinearSpeed),
        visible: true,
      };
    }
    const hiddenProgress = (routeDistance - beltVisibleLength)
      / beltHiddenReturnLength;
    return {
      acceleration: new THREE.Vector2(0, 0),
      curvature: null,
      hiddenProgress,
      pathStage: 'hidden-return-below-open-engraving',
      position: new THREE.Vector2(
        THREE.MathUtils.lerp(
          beltCenterlineRadius,
          -beltCenterlineRadius,
          hiddenProgress,
        ),
        -beltLegLength - 0.18,
      ),
      routeDistance,
      tangent: new THREE.Vector2(-1, 0),
      velocity: new THREE.Vector2(0, 0),
      visible: false,
    };
  };

  const innerContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 16, 10),
    whiteMaterial,
  );
  innerContactMarker.position.z = rollerDepth / 2 + 0.07;
  innerContactMarker.userData.role =
    'moving-inner-race-contact-of-reference-roller';
  const outerContactMarker = innerContactMarker.clone();
  outerContactMarker.userData.role =
    'moving-outer-race-contact-of-reference-roller';

  root.add(
    supportFoot,
    supportPost,
    belt,
    pulley,
    rollerCarrier,
    innerRace,
    innerRaceFrontRing,
    innerRaceIndex,
    innerContactMarker,
    outerContactMarker,
    ...beltMarkers,
  );

  const rollerStateAtTime = (time, index) => {
    const initialAngle = rollerInitialAngles[index];
    const outerRaceAngleUnwrapped = outerRaceAngularSpeed * time;
    const cageAngleUnwrapped = cageAngularSpeed * time;
    const rollerSpinAngleUnwrapped = rollerAngularSpeed * time;
    const centerAngle = initialAngle + cageAngleUnwrapped;
    const radial = new THREE.Vector2(
      Math.cos(centerAngle),
      Math.sin(centerAngle),
    );
    const tangent = new THREE.Vector2(-radial.y, radial.x);
    const center = radial.clone().multiplyScalar(rollerCenterRadius);
    const centerVelocity = tangent.clone().multiplyScalar(
      rollerCenterRadius * cageAngularSpeed,
    );
    const centerAcceleration = radial.clone().multiplyScalar(
      -rollerCenterRadius * cageAngularSpeed ** 2,
    );
    const innerContactPoint = radial.clone().multiplyScalar(innerRaceRadius);
    const outerContactPoint = radial.clone().multiplyScalar(
      outerRaceInnerRadius,
    );
    const rollerInnerContactVelocity = centerVelocity.clone().addScaledVector(
      tangent,
      -rollerPitchRadius * rollerAngularSpeed,
    );
    const rollerOuterContactVelocity = centerVelocity.clone().addScaledVector(
      tangent,
      rollerPitchRadius * rollerAngularSpeed,
    );
    const innerRaceContactVelocity = new THREE.Vector2(0, 0);
    const outerRaceContactVelocity = tangent.clone().multiplyScalar(
      outerRaceInnerRadius * outerRaceAngularSpeed,
    );
    return {
      cageAngle: wrappedAngle(cageAngleUnwrapped),
      cageAngleUnwrapped,
      center,
      centerAcceleration,
      centerAngle,
      centerVelocity,
      index,
      initialAngle,
      innerContactGap:
        rollerCenterRadius - rollerPitchRadius - innerRaceRadius,
      innerContactPhaseError:
        rollerCenterRadius * cageAngleUnwrapped
        - rollerPitchRadius * rollerSpinAngleUnwrapped,
      innerContactPoint,
      innerNoSlipVelocityError: rollerInnerContactVelocity.clone().sub(
        innerRaceContactVelocity,
      ),
      innerRaceContactVelocity,
      outerContactGap:
        outerRaceInnerRadius - rollerCenterRadius - rollerPitchRadius,
      outerContactPhaseError:
        rollerCenterRadius * cageAngleUnwrapped
        + rollerPitchRadius * rollerSpinAngleUnwrapped
        - outerRaceInnerRadius * outerRaceAngleUnwrapped,
      outerContactPoint,
      outerNoSlipVelocityError: rollerOuterContactVelocity.clone().sub(
        outerRaceContactVelocity,
      ),
      outerRaceAngleUnwrapped,
      outerRaceContactVelocity,
      rollerInnerContactVelocity,
      rollerMaterialAngle: wrappedAngle(
        initialAngle + rollerSpinAngleUnwrapped,
      ),
      rollerMaterialAngleUnwrapped:
        initialAngle + rollerSpinAngleUnwrapped,
      rollerOuterContactVelocity,
      rollerSpinAngleUnwrapped,
      tangent,
    };
  };

  const stateAtTime = (time) => {
    const outerRaceAngleUnwrapped = outerRaceAngularSpeed * time;
    const cageAngleUnwrapped = cageAngularSpeed * time;
    const rollerSpinAngleUnwrapped = rollerAngularSpeed * time;
    const rollers = Array.from(
      { length: rollerCount },
      (_, index) => rollerStateAtTime(time, index),
    );
    const topPulleySurfaceVelocity = new THREE.Vector2(
      -outerRaceAngularSpeed * pulleyOuterRadius,
      0,
    );
    const topBeltVelocity = new THREE.Vector2(beltLinearSpeed, 0);
    return {
      beltLinearSpeed,
      beltMarkers: beltMarkers.map((_, index) => (
        beltMarkerStateAtTime(time, index)
      )),
      beltToPulleyNoSlipError: topBeltVelocity.clone().sub(
        topPulleySurfaceVelocity,
      ),
      cageAngle: wrappedAngle(cageAngleUnwrapped),
      cageAngleUnwrapped,
      cageAngularAcceleration: 0,
      cageAngularSpeed,
      fullAssemblyCoordinate: wrappedCycleCoordinate(
        time,
        fullMarkedAssemblyClosure,
      ),
      inputCycleCoordinate: wrappedCycleCoordinate(time, demonstrationPeriod),
      outerRaceAngle: wrappedAngle(outerRaceAngleUnwrapped),
      outerRaceAngleUnwrapped,
      outerRaceAngularAcceleration: 0,
      outerRaceAngularSpeed,
      rollerAngularAcceleration: 0,
      rollerAngularSpeed,
      rollers,
      rollerSpinAngle: wrappedAngle(rollerSpinAngleUnwrapped),
      rollerSpinAngleUnwrapped,
      time,
      topBeltVelocity,
      topPulleySurfaceVelocity,
    };
  };

  root.userData.archetype =
    'belt-driven-pulley-six-roller-bearing-fixed-inner-race-rotating-outer-race';
  root.userData.mechanism =
    'one-belt-driven-pulley-and-outer-race-rolls-on-six-equally-spaced-cylindrical-elements-around-one-fixed-inner-race-with-the-six-centers-orbiting-at-fourteen-nineteenths-and-each-roller-spinning-at-fourteen-ninths-of-outer-race-speed';
  root.userData.bearingInterpretation = {
    certainty:
      'the six rolling elements and assembled/cutaway relationship are visible in the public engraving, but the precise historical retainer construction is under-specified',
    consolidatedView:
      'the model combines Brown’s assembled left view and exposed right view into one open-front 3D cutaway',
    interpretation: 'six-cylindrical-roller-radial-bearing',
    sourceAmbiguityAcknowledged: true,
  };
  root.userData.blocks = {
    belt,
    beltMarkers,
    cageIndex,
    cagePlate,
    innerContactMarker,
    innerRace,
    innerRaceFrontRing,
    innerRaceIndex,
    outerContactMarker,
    outerRaceSurface,
    pulley,
    pulleyFrontFlange,
    pulleyIndex,
    pulleyRearFlange,
    pulleyRim,
    pulleyRotor,
    pulleyWeb,
    rollerAssemblies,
    rollerBodies,
    rollerCarrier,
    rollerHubs,
    rollerIndices,
    supportFoot,
    supportPost,
  };
  root.userData.cameraDistanceScale = 0.94;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.7, -3.65, -0.85),
    new THREE.Vector3(2.7, 2.55, 0.85),
  );
  root.userData.geometry = {
    adjacentRollerCenterDistance,
    adjacentRollerClearance,
    beltCenterlineRadius,
    beltDepth,
    beltHiddenReturnLength,
    beltLegLength,
    beltMarkerCount,
    beltMarkerLoopLength,
    beltThickness,
    beltVisibleLength,
    cageDepth,
    fullMarkedAssemblyClosure,
    innerRaceDepth,
    innerRaceRadius,
    outerRaceInnerRadius,
    pulleyDepth,
    pulleyOuterRadius,
    pulleyRimDepth,
    pulleyWebOuterRadius,
    rollerBodyRadius,
    rollerCenterRadius,
    rollerCount,
    rollerDepth,
    rollerPitchRadius,
  };
  root.userData.sourceAnimation = {
    available: true,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialNote:
      'the site illustrates a roller bearing and adds rotation marks, while noting that Brown’s intended bearing style is not completely clear',
    referenceScope:
      'six-element topology, exposed bearing arrangement, belt wrap, and qualitative directions only; all race ratios, contact velocities, cage rate, roller spin, and belt-marker paths were independently derived',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate270: {
      assembledView: {
        centerX: 145,
        centerY: 266,
        coverRadius: 63,
        holeCircleRadius: 44,
        holeRadius: 6,
        pulleyOuterRadius: 113,
      },
      cutawayView: {
        centerX: 391,
        centerY: 267,
        innerRaceRadius: 25,
        pulleyOuterRadius: 112,
        rollerCenters: [
          { x: 390, y: 219 },
          { x: 435, y: 244 },
          { x: 436, y: 296 },
          { x: 391, y: 322 },
          { x: 346, y: 297 },
          { x: 345, y: 245 },
        ],
        rollerRadius: 25,
      },
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'two views of one pulley bearing: the left is assembled beneath a wrapped belt and the right exposes six equally spaced rolling elements between a central stationary journal and the rotating pulley hub',
      measurementUncertaintyPixels: 6,
      officialAnimationAvailable: true,
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
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod,
    fullMarkedAssemblyClosure,
  };
  root.userData.transmission = {
    beltLinearSpeed,
    beltMarkerStateAtTime,
    beltPointAtVisibleDistance,
    cageAngularSpeed,
    cageToOuterSpeedRatio,
    contactCount: rollerCount * 2,
    fullClosureCageTurns:
      fullMarkedAssemblyOuterTurns * cageToOuterSpeedRatio,
    fullClosureOuterTurns: fullMarkedAssemblyOuterTurns,
    fullClosureRollerTurns:
      fullMarkedAssemblyOuterTurns * rollerToOuterSpeedRatio,
    innerRaceAngularSpeed: 0,
    outerRaceAngularSpeed,
    rollerAngularSpeed,
    rollerStateAtTime,
    rollerToOuterSpeedRatio,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    pulleyRotor.rotation.z = state.outerRaceAngleUnwrapped;
    pulleyRotor.userData.angularSpeed = state.outerRaceAngularSpeed;
    rollerCarrier.rotation.z = state.cageAngleUnwrapped;
    rollerCarrier.userData.angularSpeed = state.cageAngularSpeed;
    for (const [index, assembly] of rollerAssemblies.entries()) {
      assembly.rotor.rotation.z = rollerInitialAngles[index]
        + state.rollerSpinAngleUnwrapped - state.cageAngleUnwrapped;
      assembly.rotor.userData.angularSpeed = state.rollerAngularSpeed;
    }
    for (const [index, marker] of beltMarkers.entries()) {
      const markerState = state.beltMarkers[index];
      marker.position.set(
        markerState.position.x,
        markerState.position.y,
        beltDepth / 2 + 0.065,
      );
      marker.visible = markerState.visible;
      marker.scale.setScalar(markerState.visible ? Math.min(1, markerState.routeDistance / .12, (beltVisibleLength - markerState.routeDistance) / .12) : 0);
      marker.userData.velocity = markerState.velocity.clone();
      marker.userData.pathStage = markerState.pathStage;
    }
    const referenceRoller = state.rollers[0];
    innerContactMarker.position.x = referenceRoller.innerContactPoint.x;
    innerContactMarker.position.y = referenceRoller.innerContactPoint.y;
    outerContactMarker.position.x = referenceRoller.outerContactPoint.x;
    outerContactMarker.position.y = referenceRoller.outerContactPoint.y;
    root.userData.contacts = {
      beltOnPulleyTread: {
        innerBeltRadius: beltInnerRadius,
        noSlipVelocityError: state.beltToPulleyNoSlipError.clone(),
        pulleyRadius: pulleyOuterRadius,
        topContact: new THREE.Vector2(0, pulleyOuterRadius),
      },
      innerRaceToRollers: state.rollers.map((roller) => ({
        gap: roller.innerContactGap,
        noSlipVelocityError: roller.innerNoSlipVelocityError.clone(),
        phaseError: roller.innerContactPhaseError,
        point: roller.innerContactPoint.clone(),
        rollerIndex: roller.index,
      })),
      outerRaceToRollers: state.rollers.map((roller) => ({
        gap: roller.outerContactGap,
        noSlipVelocityError: roller.outerNoSlipVelocityError.clone(),
        phaseError: roller.outerContactPhaseError,
        point: roller.outerContactPoint.clone(),
        rollerIndex: roller.index,
      })),
    };
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(0.85, 1.5, 10.8),
  };
}

export function createAuthoredBearingMovement(movement) {
  let result;
  switch (movement.id) {
    case 250: result = antiFrictionWheelBearing(movement); break;
    case 270: result = sixRollerPulleyBearing(movement); break;
    default: return null;
  }
  correctBearingParts(result, movement.id);
  result.root.userData.fidelity = 'authored';
  return result;
}
