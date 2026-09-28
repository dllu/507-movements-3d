import {finishMangle371} from './reversing-transmission-working-parts.js';
import {circle,plate,poly,polygonClipping,sector} from './finite-plate-geometry.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeGear,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongX(radius, length, material, segments = 28) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function extrudeCentered(shape, depth, options = {}) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: options.bevelEnabled ?? true,
    bevelSegments: options.bevelSegments ?? 1,
    bevelSize: options.bevelSize ?? 0.018,
    bevelThickness: options.bevelThickness ?? 0.018,
    curveSegments: 1,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function makeOpenAnnularSector({
  depth,
  innerRadius,
  material,
  outerRadius,
  startAngle,
  sweep,
}) {
  const shape = new THREE.Shape();
  const samples = 144;
  for (let index = 0; index <= samples; index += 1) {
    const angle = startAngle + sweep * index / samples;
    const x = outerRadius * Math.cos(angle);
    const y = outerRadius * Math.sin(angle);
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let index = samples; index >= 0; index -= 1) {
    const angle = startAngle + sweep * index / samples;
    shape.lineTo(
      innerRadius * Math.cos(angle),
      innerRadius * Math.sin(angle),
    );
  }
  shape.closePath();
  const rim = new THREE.Mesh(
    extrudeCentered(shape, depth, {
      bevelSize: 0.014,
      bevelThickness: 0.014,
    }),
    material,
  );
  rim.userData.openingPreserved = true;
  rim.userData.startAngle = startAngle;
  rim.userData.sweep = sweep;
  return rim;
}

// Brown's web has four curved-sided arms: each opening is bounded by the
// rim and one arc bulging toward the hub, which leaves the rim parallel to
// the arm, so the arms keep their width outboard and flare into the hub.
function curvedSpokeWebGeometry(depth) {
  const webRadius = 1.35;
  const openingRim = 1.29;
  // Arms 0.32 wide at the rim (0.16 half-width) and openings reaching to
  // 0.52 of the web radius, as measured on the plate.
  const halfSpan = Math.PI / 4 - Math.asin(0.16 / openingRim);
  const apexRadius = 0.70;
  // Circle (centre on the opening's bisector) through both rim corners
  // and the inner apex.
  const cornerX = openingRim * Math.cos(halfSpan);
  const cornerY = openingRim * Math.sin(halfSpan);
  const arcCentre = (cornerX ** 2 + cornerY ** 2 - apexRadius ** 2)
    / (2 * (cornerX - apexRadius));
  const arcRadius = arcCentre - apexRadius;
  const cornerAngle = Math.atan2(cornerY, cornerX - arcCentre);
  const openings = [];
  for (let index = 0; index < 4; index += 1) {
    const centre = Math.PI / 4 + index * Math.PI / 2;
    const cos = Math.cos(centre);
    const sin = Math.sin(centre);
    const local = [];
    for (let step = 0; step <= 48; step += 1) {
      const angle = -halfSpan + 2 * halfSpan * step / 48;
      local.push([openingRim * Math.cos(angle), openingRim * Math.sin(angle)]);
    }
    for (let step = 1; step < 64; step += 1) {
      const angle = cornerAngle + (2 * Math.PI - 2 * cornerAngle) * step / 64;
      local.push([arcCentre + arcRadius * Math.cos(angle), arcRadius * Math.sin(angle)]);
    }
    openings.push(poly(local.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos])));
  }
  return plate(polygonClipping.difference(
    poly(circle([0, 0], webRadius, 192)),
    poly(circle([0, 0], 0.11, 96)),
    ...openings,
  ), -depth / 2, depth / 2);
}

function makeFourLobedWeb({ depth, hubRadius, material, spokeRadius }) {
  const web = new THREE.Mesh(curvedSpokeWebGeometry(depth), material);
  web.userData.lobeCount = 4;
  web.userData.role = 'four-curved-spoke-web-of-open-mangle-wheel';
  return web;
}

function dualFaceGapTransferMangleWheel(movement) {
  const root = new THREE.Group();

  // The tooth numbers are engineered because Brown gives no dimensions.  A
  // 44-position wheel with a four-pitch opening keeps the gap as narrow as
  // the ten-tooth pinion's crossover allows (Brown's is narrower still); the
  // forty remaining intervals and ten-tooth pinion also make the complete
  // alternating cycle close after exactly nine uniform pinion revolutions.
  const wheelPositionCount = 44;
  const openingIntervals = 4;
  const mainToothIntervals = wheelPositionCount - openingIntervals;
  const pinionTeeth = 10;
  const wheelPitchRadius = 1.72;
  const pitchRatio = pinionTeeth / wheelPositionCount;
  const pinionPitchRadius = wheelPitchRadius * pitchRatio;
  const module = 2 * wheelPitchRadius / wheelPositionCount;
  const circularPitch = Math.PI * module;
  const wheelAngularPitch = FULL_TURN / wheelPositionCount;
  const pinionAngularPitch = FULL_TURN / pinionTeeth;
  const openingAngle = openingIntervals * wheelAngularPitch;
  const openingHalfAngle = openingAngle / 2;
  const openingCenterAngle = Math.PI;
  const firstTerminalAngle = openingCenterAngle + openingHalfAngle;
  const mainArcSweep = mainToothIntervals * wheelAngularPitch;
  const secondTerminalAngle = firstTerminalAngle + mainArcSweep;
  // Equal to mainArcSweep / pitchRatio, written in whole pinion turns so the
  // branch boundaries fall on exact multiples of a turn.
  const mainRunInputAngle = mainToothIntervals / pinionTeeth * FULL_TURN;
  const terminalCrossoverInputAngle = Math.PI;
  const rearRunStart = mainRunInputAngle
    + terminalCrossoverInputAngle;
  const firstTerminalCrossoverStart = rearRunStart
    + mainRunInputAngle;
  const mechanismCycleInputAngle = firstTerminalCrossoverStart
    + terminalCrossoverInputAngle;
  const inputRevolutionPeriod = 3;
  const inputAngularSpeed = FULL_TURN / inputRevolutionPeriod;
  const mechanismCyclePeriod = mechanismCycleInputAngle
    / inputAngularSpeed;
  const inputStartAngle = THREE.MathUtils.degToRad(21);
  const pinionDepth = 0.43;
  const pinionToothHeight = module * 1.8;
  const pinionOuterRadius = pinionPitchRadius
    + pinionToothHeight / 2;
  const wheelBodyDepth = 0.12;
  const faceToothDepth = 0.075;
  const faceToothOffset = wheelBodyDepth / 2 + faceToothDepth / 2;
  const innerRimRadius = 1.32;
  const outerRimRadius = 2.08;
  const toothRadialLength = outerRimRadius - innerRimRadius - 0.08;
  const toothCenterRadius = (innerRimRadius + outerRimRadius) / 2;
  const toothTangentialWidth = circularPitch * 0.53;
  const terminalRolloverAmplitude = Math.asin(
    pinionPitchRadius / wheelPitchRadius,
  );
  const openingPitchCircleHalfChord = wheelPitchRadius
    * Math.sin(openingHalfAngle);
  const openingRadialClearance = openingPitchCircleHalfChord
    - pinionOuterRadius;

  const stateAtInputTravel = (inputTravel) => {
    let pathInputAngle = positiveModulo(
      inputTravel,
      mechanismCycleInputAngle,
    );
    if (Math.abs(pathInputAngle) < 1e-12
      || Math.abs(pathInputAngle - mechanismCycleInputAngle) < 1e-12) {
      pathInputAngle = 0;
    }

    let activeFace;
    let branch;
    let branchProgress;
    let centerDerivative;
    let contactPoint;
    let faceToothCoordinate = null;
    let localContactAngle;
    let pinionCenter;
    let pinionToothCoordinate = null;
    let terminalIndex = null;
    let wheelAngle;
    let wheelAngleDerivative;

    if (pathInputAngle < mainRunInputAngle) {
      const runInput = pathInputAngle;
      activeFace = 'front';
      branch = 'front-face-tooth-run';
      branchProgress = runInput / mainRunInputAngle;
      localContactAngle = firstTerminalAngle + pitchRatio * runInput;
      wheelAngle = Math.PI - localContactAngle;
      wheelAngleDerivative = -pitchRatio;
      pinionCenter = new THREE.Vector3(
        -wheelPitchRadius,
        0,
        pinionPitchRadius,
      );
      centerDerivative = new THREE.Vector3();
      contactPoint = new THREE.Vector3(-wheelPitchRadius, 0, 0);
      faceToothCoordinate = (
        localContactAngle - firstTerminalAngle
      ) / wheelAngularPitch;
      pinionToothCoordinate = runInput / pinionAngularPitch;
    } else if (pathInputAngle < rearRunStart) {
      const alpha = pathInputAngle - mainRunInputAngle;
      const sine = Math.sin(alpha);
      const cosine = Math.cos(alpha);
      const radialDistance = Math.sqrt(
        wheelPitchRadius ** 2
          - (pinionPitchRadius * sine) ** 2,
      );
      const angularOffset = Math.asin(
        pitchRatio * sine,
      );
      activeFace = null;
      branch = 'second-terminal-front-to-rear-crossover';
      branchProgress = alpha / terminalCrossoverInputAngle;
      localContactAngle = secondTerminalAngle;
      wheelAngle = Math.PI - secondTerminalAngle - angularOffset;
      wheelAngleDerivative = -pinionPitchRadius * cosine
        / radialDistance;
      pinionCenter = new THREE.Vector3(
        -radialDistance,
        0,
        pinionPitchRadius * cosine,
      );
      centerDerivative = new THREE.Vector3(
        pinionPitchRadius ** 2 * sine * cosine / radialDistance,
        0,
        -pinionPitchRadius * sine,
      );
      contactPoint = new THREE.Vector3(
        -radialDistance,
        pinionPitchRadius * sine,
        0,
      );
      terminalIndex = mainToothIntervals;
    } else if (pathInputAngle < firstTerminalCrossoverStart) {
      const runInput = pathInputAngle - rearRunStart;
      activeFace = 'rear';
      branch = 'rear-face-tooth-run';
      branchProgress = runInput / mainRunInputAngle;
      localContactAngle = secondTerminalAngle - pitchRatio * runInput;
      wheelAngle = Math.PI - localContactAngle;
      wheelAngleDerivative = pitchRatio;
      pinionCenter = new THREE.Vector3(
        -wheelPitchRadius,
        0,
        -pinionPitchRadius,
      );
      centerDerivative = new THREE.Vector3();
      contactPoint = new THREE.Vector3(-wheelPitchRadius, 0, 0);
      faceToothCoordinate = (
        secondTerminalAngle - localContactAngle
      ) / wheelAngularPitch;
      pinionToothCoordinate = runInput / pinionAngularPitch;
    } else {
      const alpha = pathInputAngle - firstTerminalCrossoverStart;
      const sine = Math.sin(alpha);
      const cosine = Math.cos(alpha);
      const radialDistance = Math.sqrt(
        wheelPitchRadius ** 2
          - (pinionPitchRadius * sine) ** 2,
      );
      const angularOffset = Math.asin(
        pitchRatio * sine,
      );
      activeFace = null;
      branch = 'first-terminal-rear-to-front-crossover';
      branchProgress = alpha / terminalCrossoverInputAngle;
      localContactAngle = firstTerminalAngle;
      wheelAngle = Math.PI - firstTerminalAngle + angularOffset;
      wheelAngleDerivative = pinionPitchRadius * cosine
        / radialDistance;
      pinionCenter = new THREE.Vector3(
        -radialDistance,
        0,
        -pinionPitchRadius * cosine,
      );
      centerDerivative = new THREE.Vector3(
        pinionPitchRadius ** 2 * sine * cosine / radialDistance,
        0,
        pinionPitchRadius * sine,
      );
      contactPoint = new THREE.Vector3(
        -radialDistance,
        -pinionPitchRadius * sine,
        0,
      );
      terminalIndex = 0;
    }

    const pinionAngle = inputStartAngle + inputTravel;
    const wheelAngularSpeed = wheelAngleDerivative * inputAngularSpeed;
    const pinionCenterVelocity = centerDerivative.clone()
      .multiplyScalar(inputAngularSpeed);
    const wheelPitchVelocity = new THREE.Vector3().crossVectors(
      Z_AXIS.clone().multiplyScalar(wheelAngularSpeed),
      contactPoint,
    );
    const pinionPitchVelocity = pinionCenterVelocity.clone().add(
      new THREE.Vector3().crossVectors(
        X_AXIS.clone().multiplyScalar(inputAngularSpeed),
        contactPoint.clone().sub(pinionCenter),
      ),
    );
    const meshPhaseError = faceToothCoordinate === null
      ? null
      : faceToothCoordinate - pinionToothCoordinate;

    return {
      activeFace,
      branch,
      branchProgress,
      contactPoint,
      cycleProgress: pathInputAngle / mechanismCycleInputAngle,
      faceToothCoordinate,
      inputAngle: pinionAngle,
      inputAngularSpeed,
      inputTravel,
      localContactAngle,
      meshPhaseError,
      pathInputAngle,
      pinionAngle,
      pinionCenter,
      pinionCenterVelocity,
      pinionPitchVelocity,
      pinionToothCoordinate,
      rollingVelocityError: pinionPitchVelocity.distanceTo(
        wheelPitchVelocity,
      ),
      terminalIndex,
      wheelAngle,
      wheelAngularSpeed,
      wheelPitchVelocity,
      wheelToPinionRatio: wheelAngleDerivative,
    };
  };

  const stateAtTime = (time) => stateAtInputTravel(
    rearRunStart + time * inputAngularSpeed,
  );

  const wheelMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.58,
    side: THREE.DoubleSide,
  });
  const frontToothMaterial = matte(PALETTE.driver, {
    metalness: 0.17,
    roughness: 0.52,
  });
  const rearToothMaterial = matte(PALETTE.brass, {
    metalness: 0.19,
    roughness: 0.49,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.58,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const outputRotor = new THREE.Group();
  outputRotor.userData.axis = Z_AXIS.clone();
  outputRotor.userData.role =
    'alternately-rotating-dual-face-mangle-wheel-assembly';
  root.add(outputRotor);

  const wheelBody = makeOpenAnnularSector({
    depth: wheelBodyDepth,
    innerRadius: innerRimRadius,
    material: wheelMaterial,
    outerRadius: outerRimRadius,
    startAngle: firstTerminalAngle,
    sweep: mainArcSweep,
  });
  wheelBody.userData.role =
    'open-annular-body-carrying-two-opposed-face-tooth-rows';
  outputRotor.add(wheelBody);

  const wheelWeb = makeFourLobedWeb({
    depth: wheelBodyDepth * 1.08,
    hubRadius: 0.37,
    material: wheelMaterial,
    spokeRadius: innerRimRadius - 0.08,
  });
  outputRotor.add(wheelWeb);

  const wheelHub = cylinderAlongZ(0.31, 0.30, darkMaterial, 40);
  wheelHub.userData.role = 'fixed-axis-hub-of-alternating-wheel';
  outputRotor.add(wheelHub);
  const hubFace = new THREE.Mesh(
    new THREE.TorusGeometry(0.225, 0.026, 9, 44),
    rearToothMaterial,
  );
  hubFace.position.z = 0.166;
  hubFace.userData.role = 'front-hub-outline-visible-in-brown-engraving';
  outputRotor.add(hubFace);

  const outputShaft = cylinderAlongZ(0.105, 1.08, darkMaterial, 28);
  outputShaft.userData.role = 'alternating-output-wheel-shaft';
  outputRotor.add(outputShaft);

  const frontFaceTeeth = [];
  const rearFaceTeeth = [];
  const terminalPairs = [];
  for (let index = 0; index <= mainToothIntervals; index += 1) {
    const angle = firstTerminalAngle + index * wheelAngularPitch;
    const terminal = index === 0 || index === mainToothIntervals;
    const radialLength = terminal
      ? toothRadialLength * 1.05
      : toothRadialLength;
    const tangentialWidth = terminal
      ? toothTangentialWidth * 1.12
      : toothTangentialWidth;
    const pair = [];
    for (const [face, z, material, collection] of [
      ['front', faceToothOffset, frontToothMaterial, frontFaceTeeth],
      ['rear', -faceToothOffset, rearToothMaterial, rearFaceTeeth],
    ]) {
      const tooth = new THREE.Mesh(
        new THREE.BoxGeometry(
          radialLength,
          tangentialWidth,
          faceToothDepth,
        ),
        material,
      );
      tooth.position.set(
        toothCenterRadius * Math.cos(angle),
        toothCenterRadius * Math.sin(angle),
        z,
      );
      tooth.rotation.z = angle;
      tooth.userData.face = face;
      tooth.userData.index = index;
      tooth.userData.nominalAngle = angle;
      tooth.userData.role = terminal
        ? `${face}-face-terminal-tooth-for-pinion-crossover`
        : `${face}-face-radial-tooth-of-mangle-wheel`;
      tooth.userData.terminal = terminal;
      collection.push(tooth);
      pair.push(tooth);
      outputRotor.add(tooth);
    }
    if (terminal) terminalPairs.push(pair);
  }

  const outputIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.075, 0.035),
    whiteMaterial,
  );
  outputIndex.position.set(0.89, 0, faceToothOffset + 0.065);
  outputIndex.userData.role =
    'white-output-index-making-alternating-wheel-angle-legible';
  outputRotor.add(outputIndex);

  const pinionCarrier = new THREE.Group();
  pinionCarrier.userData.role =
    'front-rear-and-radially-mobile-uniform-pinion-carrier';
  root.add(pinionCarrier);

  const pinion = makeGear({
    axis: X_AXIS,
    color: PALETTE.driver,
    depth: pinionDepth,
    radius: pinionPitchRadius,
    teeth: pinionTeeth,
    toothHeight: pinionToothHeight,
  });
  pinion.userData.circularPitch = circularPitch;
  pinion.userData.role =
    'uniformly-rotating-radial-axis-pinion-working-on-both-wheel-faces';
  pinionCarrier.add(pinion);

  const inputShaftRotor = new THREE.Group();
  inputShaftRotor.userData.axis = X_AXIS.clone();
  inputShaftRotor.userData.role =
    'input-shaft-rigidly-rotating-with-mobile-pinion';
  pinionCarrier.add(inputShaftRotor);
  const inputShaft = cylinderAlongX(0.072, 1.72, darkMaterial, 24);
  inputShaft.position.x = -0.89;
  inputShaft.userData.role = 'uniformly-rotating-input-shaft';
  inputShaftRotor.add(inputShaft);
  const shaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(1.02, 0.026, 0.036),
    whiteMaterial,
  );
  shaftIndex.position.set(-0.92, 0.079, 0);
  shaftIndex.userData.role =
    'white-input-shaft-index-proving-uniform-spin';
  inputShaftRotor.add(shaftIndex);

  const carrierCollar = cylinderAlongX(0.18, 0.24, frameMaterial, 28);
  carrierCollar.position.x = -0.65;
  carrierCollar.userData.role =
    'sliding-bearing-collar-following-terminal-crossover-path';
  pinionCarrier.add(carrierCollar);
  const carrierBridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.72, 0.15),
    frameMaterial,
  );
  carrierBridge.position.x = -0.72;
  carrierBridge.userData.role =
    'schematic-mobile-cross-slide-for-pinion-shaft';
  pinionCarrier.add(carrierBridge);

  // The crossbars seat against the carrier collar at its front and rear
  // stations (pinion pitch radius either side of the median plane).
  const guideCrossbarZ = pinionPitchRadius + 0.18 + 0.055 - 0.003;
  const guideRails = [];
  for (const y of [-0.43, 0.43]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 2 * guideCrossbarZ),
      frameMaterial,
    );
    rail.position.set(-2.46, y, 0);
    rail.userData.fixed = true;
    rail.userData.role =
      'schematic-fixed-front-rear-guide-for-mobile-pinion-carrier';
    guideRails.push(rail);
    root.add(rail);
  }

  const guideCrossbars = [];
  for (const z of [-guideCrossbarZ, guideCrossbarZ]) {
    const crossbar = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.98, 0.11),
      frameMaterial,
    );
    crossbar.position.set(-2.46, 0, z);
    crossbar.userData.fixed = true;
    crossbar.userData.role =
      'fixed-crossbar-of-schematic-pinion-transfer-guide';
    guideCrossbars.push(crossbar);
    root.add(crossbar);
  }

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(5.46, 0.16, 0.72),
    frameMaterial,
  );
  base.position.set(-0.34, -2.29, -0.23);
  base.userData.fixed = true;
  base.userData.role = 'fixed-base-beneath-mangle-wheel';
  root.add(base);
  const bearingPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 2.34, 0.24),
    frameMaterial,
  );
  bearingPost.position.set(0, -1.13, -0.36);
  bearingPost.userData.fixed = true;
  bearingPost.userData.role = 'rear-output-bearing-post';
  root.add(bearingPost);
  const fixedBearing = cylinderAlongZ(0.20, 0.22, frameMaterial, 30);
  fixedBearing.position.z = -0.42;
  fixedBearing.userData.fixed = true;
  fixedBearing.userData.role = 'fixed-bearing-for-alternating-output-shaft';
  root.add(fixedBearing);

  const frontContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    whiteMaterial,
  );
  frontContactMarker.userData.role =
    'active-front-face-pitch-contact-marker';
  root.add(frontContactMarker);
  const rearContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    whiteMaterial,
  );
  rearContactMarker.userData.role =
    'active-rear-face-pitch-contact-marker';
  root.add(rearContactMarker);
  const terminalContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.062, 18, 12),
    whiteMaterial,
  );
  terminalContactMarker.userData.role =
    'active-terminal-rollover-contact-marker';
  root.add(terminalContactMarker);

  const update = (time) => {
    const state = stateAtTime(time);
    outputRotor.rotation.z = state.wheelAngle;
    pinionCarrier.position.copy(state.pinionCenter);
    setSpin(pinion, state.pinionAngle);
    inputShaftRotor.rotation.x = state.pinionAngle;

    frontContactMarker.visible = state.activeFace === 'front';
    rearContactMarker.visible = state.activeFace === 'rear';
    terminalContactMarker.visible = state.activeFace === null;
    frontContactMarker.position.copy(state.contactPoint);
    frontContactMarker.position.z = faceToothOffset + faceToothDepth / 2;
    rearContactMarker.position.copy(state.contactPoint);
    rearContactMarker.position.z = -faceToothOffset - faceToothDepth / 2;
    terminalContactMarker.position.copy(state.contactPoint);

    root.userData.activeContact = {
      face: state.activeFace,
      pinionCenter: state.pinionCenter.clone(),
      pinionPitchVelocity: state.pinionPitchVelocity.clone(),
      point: state.contactPoint.clone(),
      rollingVelocityError: state.rollingVelocityError,
      terminalIndex: state.terminalIndex,
      wheelPitchVelocity: state.wheelPitchVelocity.clone(),
    };
    root.userData.kinematics = state;
  };

  root.userData = {
    archetype: movement.archetype,
    blocks: {
      base,
      bearingPost,
      carrierBridge,
      carrierCollar,
      fixedBearing,
      frontContactMarker,
      frontFaceTeeth,
      guideCrossbars,
      guideRails,
      hubFace,
      inputShaft,
      inputShaftRotor,
      outputIndex,
      outputRotor,
      outputShaft,
      pinion,
      pinionCarrier,
      rearContactMarker,
      rearFaceTeeth,
      shaftIndex,
      terminalContactMarker,
      terminalPairs,
      wheelBody,
      wheelHub,
      wheelWeb,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      input:
        'one uniformly increasing angle of the radial pinion shaft',
      note:
        'wheel angle and the pinion carrier radial/front-rear coordinates are exact dependent coordinates fixed by rolling contact on a face row or a terminal tooth',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid teeth and shafts',
        'zero backlash at the active pitch contact',
        'massless carrier that follows the terminal-tooth rollover constraint',
        'opposed tooth flanks represented about one thin median pitch plane',
      ],
      sourceSpecifiesDimensionsTimingBacklashOrCarrierGuide: false,
      treatment:
        'Brown supplies topology and motion direction but no dimensions, timing, tooth section, backlash, or carrier guide; tooth counts and scale are engineered while every active branch enforces exact no-slip pitch contact',
    },
    fidelity: 'authored',
    geometry: {
      circularPitch,
      faceToothDepth,
      faceToothOffset,
      firstTerminalAngle,
      firstTerminalCrossoverStart,
      innerRimRadius,
      inputAngularSpeed,
      inputRevolutionPeriod,
      inputStartAngle,
      sourceInputTravel: rearRunStart,
      mainArcSweep,
      mainRunInputAngle,
      mainToothIntervals,
      mechanismCycleInputAngle,
      mechanismCyclePeriod,
      module,
      openingAngle,
      openingCenterAngle,
      openingHalfAngle,
      openingIntervals,
      openingPitchCircleHalfChord,
      openingRadialClearance,
      outerRimRadius,
      pinionAngularPitch,
      pinionDepth,
      pinionOuterRadius,
      pinionPitchRadius,
      pinionTeeth,
      pinionToothHeight,
      pitchRatio,
      rearRunStart,
      secondTerminalAngle,
      terminalCrossoverInputAngle,
      terminalRolloverAmplitude,
      toothCenterRadius,
      toothRadialLength,
      toothTangentialWidth,
      wheelAngularPitch,
      wheelBodyDepth,
      wheelPitchRadius,
      wheelPositionCount,
    },
    mechanism:
      'uniform-radial-pinion-rolls-along-the-front-face-tooth-row-rolls-smoothly-around-the-second-terminal-tooth-through-the-left-opening-runs-back-on-the-rear-face-and-rolls-around-the-first-terminal-tooth-to-repeat-producing-alternating-wheel-rotation',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate371: {
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 8,
        openingLowerEndpoint: new THREE.Vector2(136, 382),
        openingUpperEndpoint: new THREE.Vector2(99, 218),
        outerRimBottom: new THREE.Vector2(289, 456),
        outerRimRight: new THREE.Vector2(493, 253),
        outerRimTop: new THREE.Vector2(289, 50),
        pinionCenter: new THREE.Vector2(102, 253),
        shaftLeftEnd: new THREE.Vector2(14, 253),
        wheelCenter: new THREE.Vector2(289, 253),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the mechanism is a modification of mangle-wheel motion',
          'the large wheel is toothed on both faces',
          'the pinion revolves uniformly',
          'the large wheel receives alternating circular motion',
          'the pinion passes from one wheel face to the other through the opening at the left',
        ],
        engravingEvidence:
          'the plate shows a four-broad-spoke circular wheel, two concentric rim outlines, a long radial series of face teeth interrupted only at the left, a small edge-on pinion at the upper terminal of that opening, and its horizontal radial shaft continuing left',
        reconstructionDisclosure:
          'the 44-position wheel, four-pitch opening, ten-tooth pinion, thin median pitch plane, terminal-rollover contact law, carrier guide, colors, dimensions, and three-second input period are engineered because Brown gives no numerical specification or tooth section and the official page has no canvas animation',
      },
      officialPage: 'https://507movements.com/mm_371.html',
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtInputTravel,
    stateAtTime,
    timeline: {
      demonstrationPeriod: inputRevolutionPeriod,
      fullAlternatingMechanismPeriod: mechanismCyclePeriod,
      note:
        'display timing is keyed to one uniform pinion revolution so tooth motion stays legible; one complete front-run, crossover, rear-run, crossover sequence takes exactly nine such revolutions',
    },
    transmission: {
      faceRunLaw:
        'on either face, wheel angular speed magnitude equals pinion speed times pinion pitch radius divided by wheel pitch radius; the sign reverses between faces',
      fullCycleInputRevolutions:
        mechanismCycleInputAngle / FULL_TURN,
      openingLaw:
        'the four omitted wheel pitches form the left opening; at each terminal the pinion center and contact point follow the exact circle-circle rollover solution while moving continuously between front and rear',
      pitchContactPlane:
        'the two opposed face-tooth flanks are idealized about the wheel median plane because the source supplies no axial tooth section',
      terminalRolloverLaw:
        'for pinion rollover angle alpha, radial center distance is sqrt(R^2-r^2 sin^2(alpha)), axial center coordinate is plus or minus r cos(alpha), and wheel correction is plus or minus asin((r/R) sin(alpha))',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.38, -2.39, -0.78),
    new THREE.Vector3(2.22, 2.18, 0.78),
  );
  root.userData.groundFloorY = -2.37;
  markShadows(root);
  const model = finishMangle371(root, update);
  // Brown draws no white phase marks; they stay allocated for the checks.
  outputIndex.visible = false;
  shaftIndex.visible = false;
  // Brown's band is two solid rims joined by the radial teeth. The pinion's
  // face never reaches radii below 1.495 or above 1.97 (or, at 1.97, within
  // 0.18 of the median plane), so both rims are made as deep as the tooth
  // stock (0.136 each side): the teeth's uncut stock ends, which read as
  // necks where the cut working length met thin rails, now lie inside the
  // rims, and each tooth shows only its smooth working length between them.
  {
    const g = root.userData.geometry;
    wheelBody.geometry.dispose();
    wheelBody.geometry = plate(polygonClipping.union(
      sector(1.29, 1.495, g.firstTerminalAngle, g.secondTerminalAngle, 288),
      sector(1.97, 2.11, g.firstTerminalAngle, g.secondTerminalAngle, 288),
      // Past each terminal tooth only where the crossing pinion never comes
      // (r < 1.45 and r > 2.0, checked over the whole rollover), so the
      // terminal teeth's outer halves are carried by the rims too.
      sector(1.29, 1.45, g.firstTerminalAngle - 0.07, g.firstTerminalAngle, 16),
      sector(1.29, 1.45, g.secondTerminalAngle, g.secondTerminalAngle + 0.07, 16),
      sector(2.0, 2.11, g.firstTerminalAngle - 0.07, g.firstTerminalAngle, 16),
      sector(2.0, 2.11, g.secondTerminalAngle, g.secondTerminalAngle + 0.07, 16)), -0.136, 0.136);
    root.userData.geometry.rimRadii = {inner: [1.29, 1.495], outer: [1.97, 2.11], halfDepth: 0.136};
  }
  // Each tooth bar is one part serving both faces: one colour, so no seam
  // shows along its median plane.
  for (const tooth of rearFaceTeeth) tooth.material = frontToothMaterial;
  // One small fixed slotted guide replaces the undrawn rectangular yoke, rails,
  // shoes, bridge and collar: the input shaft passes through a slot that
  // lets it move from face to face (z) and float along its own axis (x)
  // through the rollovers. Brown shows only a small block on the shaft.
  {
    const g = root.userData.geometry;
    let reach = 0;
    for (let i = 0; i <= 720; i += 1) reach = Math.max(reach, Math.abs(root.userData.stateAtInputTravel(i * g.mechanismCycleInputAngle / 720).pinionCenter.z));
    const slotHalf = inputShaft.geometry.parameters.radiusTop + 0.006;
    const guideX = -2.46, halfY = 0.26, halfZ = reach + 0.22;
    const slot = [];
    for (const [cz, a0] of [[reach, 0], [-reach, Math.PI]]) {
      for (let i = 0; i <= 24; i += 1) {
        const a = a0 + Math.PI * i / 24;
        slot.push([slotHalf * Math.cos(a), cz + slotHalf * Math.sin(a)]);
      }
    }
    // Plate in the y-z plane: shape (u, v) = (y, z), extruded along x.
    const outline = [];
    const corner = 0.08;
    for (const [cy, cz, a0] of [[halfY - corner, halfZ - corner, 0], [-halfY + corner, halfZ - corner, Math.PI / 2],
      [-halfY + corner, -halfZ + corner, Math.PI], [halfY - corner, -halfZ + corner, 3 * Math.PI / 2]]) {
      for (let i = 0; i <= 8; i += 1) {
        const a = a0 + Math.PI / 2 * i / 8;
        outline.push([cy + corner * Math.cos(a), cz + corner * Math.sin(a)]);
      }
    }
    const guidePlateGeometry = plate(polygonClipping.difference([[outline]], [[slot]]), -0.06, 0.06)
      .rotateY(Math.PI / 2).rotateX(Math.PI / 2);
    const guidePlate = new THREE.Mesh(guidePlateGeometry, frameMaterial);
    guidePlate.position.set(guideX, 0, 0);
    guidePlate.userData.fixed = true;
    guidePlate.userData.role = 'fixed-slotted-guide-carrying-input-shaft-from-face-to-face';
    // Like the wheel's own bearing, the fixed guide is shown without the
    // undrawn frame that would carry it.
    root.add(guidePlate);
    markShadows(guidePlate);
    for (const part of [...guideRails, ...guideCrossbars, ...(root.userData.blocks.guideShoes ?? []), carrierBridge, carrierCollar]) {
      part.visible = false;
      part.userData.retiredUndrawnGuide = true;
    }
    Object.assign(root.userData.blocks, {guidePlate});
  }
  return model;
}

export function createAuthoredMangleWheelMovement(movement) {
  if (movement.id !== 371) return null;
  return dualFaceGapTransferMangleWheel(movement);
}
