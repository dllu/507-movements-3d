import {correctScriberDynamometer} from './scriber-dynamometer-gears.js';
import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongX(radius, length, material, segments = 32) {
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

export function makePitchConeGear({
  axis,
  boreRadius,
  color,
  indexTooth,
  innerDistance,
  outerDistance,
  pitchConeAngle,
  teeth,
  toothHeight,
}) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.quaternion.setFromUnitVectors(
    Z_AXIS,
    axis.clone().normalize(),
  );
  root.userData.axis = axis.clone().normalize();
  root.userData.rotor = rotor;

  const pitchRadiusAt = (distance) => (
    distance * Math.tan(pitchConeAngle)
  );
  const toothHeightAt = (distance) => (
    toothHeight * distance / outerDistance
  );
  const innerRootRadius = pitchRadiusAt(innerDistance)
    - toothHeightAt(innerDistance) * 0.44;
  const outerRootRadius = pitchRadiusAt(outerDistance)
    - toothHeight * 0.44;
  const bodyGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(boreRadius, innerDistance),
    new THREE.Vector2(innerRootRadius, innerDistance),
    new THREE.Vector2(outerRootRadius, outerDistance),
    new THREE.Vector2(boreRadius, outerDistance),
  ], 64);
  bodyGeometry.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(
    bodyGeometry,
    matte(color, { metalness: 0.16, roughness: 0.56 }),
  );
  body.userData.role = 'true-pitch-cone-miter-gear-body';
  rotor.add(body);

  const toothMaterial = matte(color, {
    metalness: 0.18,
    roughness: 0.51,
    side: THREE.DoubleSide,
  });
  const indexMaterial = matte(PALETTE.white, {
    roughness: 0.42,
    side: THREE.DoubleSide,
  });
  const halfToothAngle = Math.PI / teeth * 0.54;
  const toothMeshes = [];
  const vertex = (distance, radialOffset, angle) => {
    const radius = pitchRadiusAt(distance) + radialOffset;
    return [
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      distance,
    ];
  };
  for (let index = 0; index < teeth; index += 1) {
    const angle = index / teeth * FULL_TURN;
    const innerHeight = toothHeightAt(innerDistance);
    const vertices = [
      ...vertex(innerDistance, -innerHeight * 0.44,
        angle - halfToothAngle),
      ...vertex(innerDistance, -innerHeight * 0.44,
        angle + halfToothAngle),
      ...vertex(innerDistance, innerHeight * 0.56,
        angle + halfToothAngle),
      ...vertex(innerDistance, innerHeight * 0.56,
        angle - halfToothAngle),
      ...vertex(outerDistance, -toothHeight * 0.44,
        angle - halfToothAngle),
      ...vertex(outerDistance, -toothHeight * 0.44,
        angle + halfToothAngle),
      ...vertex(outerDistance, toothHeight * 0.56,
        angle + halfToothAngle),
      ...vertex(outerDistance, toothHeight * 0.56,
        angle - halfToothAngle),
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setIndex([
      0, 3, 2, 0, 2, 1,
      4, 5, 6, 4, 6, 7,
      0, 1, 5, 0, 5, 4,
      3, 7, 6, 3, 6, 2,
      0, 4, 7, 0, 7, 3,
      1, 2, 6, 1, 6, 5,
    ]);
    geometry.computeVertexNormals();
    const tooth = new THREE.Mesh(
      geometry,
      index === indexTooth ? indexMaterial : toothMaterial,
    );
    tooth.userData.index = index;
    tooth.userData.pitchConeTooth = true;
    tooth.userData.role = 'closed-straight-tooth-on-true-pitch-cone';
    rotor.add(tooth);
    toothMeshes.push(tooth);
  }

  const faceRing = new THREE.Mesh(
    new THREE.TorusGeometry(
      pitchRadiusAt(outerDistance) * 0.62,
      0.025,
      8,
      52,
    ),
    matte(PALETTE.ink, { metalness: 0.20, roughness: 0.48 }),
  );
  faceRing.position.z = outerDistance + 0.018;
  faceRing.userData.role = 'miter-gear-face-index-ring';
  rotor.add(faceRing);
  const faceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      pitchRadiusAt(outerDistance) * 0.52,
      0.047,
      0.026,
    ),
    indexMaterial,
  );
  faceIndex.position.set(
    pitchRadiusAt(outerDistance) * 0.43,
    0,
    outerDistance + 0.034,
  );
  faceIndex.userData.role = 'white-index-showing-miter-gear-spin';
  rotor.add(faceIndex);

  root.userData.body = body;
  root.userData.boreRadius = boreRadius;
  root.userData.faceIndex = faceIndex;
  root.userData.faceRing = faceRing;
  root.userData.innerDistance = innerDistance;
  root.userData.outerDistance = outerDistance;
  root.userData.outerPitchRadius = pitchRadiusAt(outerDistance);
  root.userData.pitchConeAngle = pitchConeAngle;
  root.userData.teeth = teeth;
  root.userData.toothHeight = toothHeight;
  root.userData.toothMeshes = toothMeshes;
  return markShadows(root);
}

function hoopReactionDynamometer(movement) {
  const root = new THREE.Group();

  const gearTeeth = 18;
  const pitchConeAngle = Math.PI / 4;
  const outerConeDistance = 0.94;
  const innerConeDistance = 0.27;
  const outerPitchRadius = outerConeDistance
    * Math.tan(pitchConeAngle);
  const module = 2 * outerPitchRadius / gearTeeth;
  const circularPitch = Math.PI * module;
  const toothHeight = module * 1.75;
  const commonApex = new THREE.Vector3();
  const inputPeriod = 4;
  const inputAngularSpeed = FULL_TURN / inputPeriod;
  const inputStartAngle = THREE.MathUtils.degToRad(14);
  const outputStartLocalAngle = THREE.MathUtils.degToRad(14);
  const planetStartLocalAngle = THREE.MathUtils.degToRad(6);
  const hoopRadius = 1.72;
  const hoopTubeRadius = 0.105;
  const hoopOuterRadius = hoopRadius + hoopTubeRadius;
  const bandAttachmentPoint = new THREE.Vector3(0, 0, hoopOuterRadius);
  const bandLeverArm = bandAttachmentPoint.z;
  const transmittedTorque = 0.72;
  const hoopGearReactionTorque = 2 * transmittedTorque;
  const gravity = 9.81;
  const indicatedWeightForce = hoopGearReactionTorque / bandLeverArm;
  const indicatedMass = indicatedWeightForce / gravity;
  const inputPower = transmittedTorque * inputAngularSpeed;

  const differentialRates = (
    inputSignedAngularSpeed,
    outputSignedAngularSpeed,
  ) => {
    const carrierAngularSpeed = (
      inputSignedAngularSpeed + outputSignedAngularSpeed
    ) / 2;
    const planetRelativeAngularSpeed = -(
      inputSignedAngularSpeed - outputSignedAngularSpeed
    ) / 2;
    return {
      carrierAngularSpeed,
      differentialResidual:
        inputSignedAngularSpeed + outputSignedAngularSpeed
        - 2 * carrierAngularSpeed,
      inputGearLocalAngularSpeed: inputSignedAngularSpeed,
      outputGearLocalAngularSpeed: -outputSignedAngularSpeed,
      outputSignedAngularSpeed,
      planetRelativeAngularSpeed,
    };
  };

  const heldRates = differentialRates(
    inputAngularSpeed,
    -inputAngularSpeed,
  );
  const freeHoopWithOutputHeldRates = differentialRates(
    inputAngularSpeed,
    0,
  );

  const contactPoints = {
    inputToBottomPlanet: new THREE.Vector3(
      outerConeDistance,
      -outerConeDistance,
      0,
    ),
    inputToTopPlanet: new THREE.Vector3(
      outerConeDistance,
      outerConeDistance,
      0,
    ),
    outputToBottomPlanet: new THREE.Vector3(
      -outerConeDistance,
      -outerConeDistance,
      0,
    ),
    outputToTopPlanet: new THREE.Vector3(
      -outerConeDistance,
      outerConeDistance,
      0,
    ),
  };

  const stateAtTime = (time) => {
    const inputTravel = inputAngularSpeed * time;
    const inputAngle = inputStartAngle + inputTravel;
    const outputLocalAngle = outputStartLocalAngle + inputTravel;
    const outputShaftAngle = -inputTravel;
    const topPlanetLocalAngle = planetStartLocalAngle - inputTravel;
    const bottomPlanetLocalAngle = planetStartLocalAngle - inputTravel;
    const hoopAngle = 0;
    const inputAngularVelocity = X_AXIS.clone()
      .multiplyScalar(inputAngularSpeed);
    const outputAngularVelocity = X_AXIS.clone()
      .multiplyScalar(-inputAngularSpeed);
    const topPlanetAngularVelocity = Y_AXIS.clone()
      .multiplyScalar(-inputAngularSpeed);
    const bottomPlanetAngularVelocity = Y_AXIS.clone()
      .multiplyScalar(inputAngularSpeed);
    const velocityAt = (angularVelocity, point) => (
      new THREE.Vector3().crossVectors(angularVelocity, point)
    );
    const contacts = {
      inputToBottomPlanet: {
        firstVelocity: velocityAt(
          inputAngularVelocity,
          contactPoints.inputToBottomPlanet,
        ),
        point: contactPoints.inputToBottomPlanet.clone(),
        secondVelocity: velocityAt(
          bottomPlanetAngularVelocity,
          contactPoints.inputToBottomPlanet,
        ),
      },
      inputToTopPlanet: {
        firstVelocity: velocityAt(
          inputAngularVelocity,
          contactPoints.inputToTopPlanet,
        ),
        point: contactPoints.inputToTopPlanet.clone(),
        secondVelocity: velocityAt(
          topPlanetAngularVelocity,
          contactPoints.inputToTopPlanet,
        ),
      },
      outputToBottomPlanet: {
        firstVelocity: velocityAt(
          outputAngularVelocity,
          contactPoints.outputToBottomPlanet,
        ),
        point: contactPoints.outputToBottomPlanet.clone(),
        secondVelocity: velocityAt(
          bottomPlanetAngularVelocity,
          contactPoints.outputToBottomPlanet,
        ),
      },
      outputToTopPlanet: {
        firstVelocity: velocityAt(
          outputAngularVelocity,
          contactPoints.outputToTopPlanet,
        ),
        point: contactPoints.outputToTopPlanet.clone(),
        secondVelocity: velocityAt(
          topPlanetAngularVelocity,
          contactPoints.outputToTopPlanet,
        ),
      },
    };
    let maximumPitchVelocityError = 0;
    for (const contact of Object.values(contacts)) {
      contact.pitchVelocityError = contact.firstVelocity.distanceTo(
        contact.secondVelocity,
      );
      maximumPitchVelocityError = Math.max(
        maximumPitchVelocityError,
        contact.pitchVelocityError,
      );
    }
    const bandForce = new THREE.Vector3(
      0,
      -indicatedWeightForce,
      0,
    );
    const indicatedBandTorque = bandAttachmentPoint.clone()
      .cross(bandForce);
    return {
      balanceResidualTorque: hoopGearReactionTorque
        - indicatedWeightForce * bandLeverArm,
      bandForce,
      bottomPlanetAngularVelocity,
      bottomPlanetLocalAngle,
      contacts,
      differentialResidual: heldRates.differentialResidual,
      hoopAngle,
      hoopAngularSpeed: heldRates.carrierAngularSpeed,
      indicatedBandTorque,
      inputAngle,
      inputAngularSpeed,
      inputAngularVelocity,
      inputPower,
      inputTravel,
      maximumPitchVelocityError,
      outputAngularSpeed: -inputAngularSpeed,
      outputAngularVelocity,
      outputLocalAngle,
      outputPower: inputPower,
      outputShaftAngle,
      planetRelativeAngularSpeed:
        heldRates.planetRelativeAngularSpeed,
      topPlanetAngularVelocity,
      topPlanetLocalAngle,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const hoopMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.57,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.20,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const outputShaftRotor = new THREE.Group();
  outputShaftRotor.userData.axis = X_AXIS.clone();
  outputShaftRotor.userData.role =
    'continuous-horizontal-shaft-keyed-to-left-output-miter-gear';
  root.add(outputShaftRotor);
  const outputShaft = cylinderAlongX(0.09, 5.05, darkMaterial, 28);
  outputShaft.userData.role =
    'horizontal-output-shaft-turning-inside-loose-input-gear';
  outputShaftRotor.add(outputShaft);
  const outputShaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(4.46, 0.028, 0.038),
    whiteMaterial,
  );
  outputShaftIndex.position.y = 0.101;
  outputShaftIndex.userData.role =
    'white-index-proving-keyed-output-shaft-counter-rotation';
  outputShaftRotor.add(outputShaftIndex);

  const inputGear = makePitchConeGear({
    axis: X_AXIS,
    boreRadius: 0.13,
    color: PALETTE.driver,
    indexTooth: 0,
    innerDistance: innerConeDistance,
    outerDistance: outerConeDistance,
    pitchConeAngle,
    teeth: gearTeeth,
    toothHeight,
  });
  inputGear.userData.role =
    'right-loose-input-miter-gear-free-on-horizontal-shaft';
  root.add(inputGear);

  const outputGear = makePitchConeGear({
    axis: X_AXIS.clone().negate(),
    boreRadius: 0.105,
    color: PALETTE.driven,
    indexTooth: 0,
    innerDistance: innerConeDistance,
    outerDistance: outerConeDistance,
    pitchConeAngle,
    teeth: gearTeeth,
    toothHeight,
  });
  outputGear.userData.role =
    'left-miter-gear-fast-keyed-to-horizontal-output-shaft';
  root.add(outputGear);

  const inputSleeveRotor = new THREE.Group();
  inputSleeveRotor.userData.axis = X_AXIS.clone();
  inputSleeveRotor.userData.role =
    'loose-input-sleeve-turning-independently-around-output-shaft';
  root.add(inputSleeveRotor);
  const inputSleeve = cylinderAlongX(0.16, 0.61, brassMaterial, 30);
  inputSleeve.position.x = 1.19;
  inputSleeve.userData.role =
    'visible-loose-bearing-sleeve-between-input-gear-and-shaft';
  inputSleeveRotor.add(inputSleeve);
  const inputSleeveIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.032, 0.044),
    whiteMaterial,
  );
  inputSleeveIndex.position.set(1.20, 0.17, 0);
  inputSleeveIndex.userData.role =
    'white-index-on-loose-input-sleeve';
  inputSleeveRotor.add(inputSleeveIndex);

  const hoopCarrier = new THREE.Group();
  hoopCarrier.userData.axis = X_AXIS.clone();
  hoopCarrier.userData.role =
    'freely-journaled-hoop-carrier-held-stationary-by-measuring-band';
  root.add(hoopCarrier);
  const hoop = new THREE.Mesh(
    new THREE.TorusGeometry(hoopRadius, hoopTubeRadius, 12, 96),
    hoopMaterial,
  );
  hoop.rotation.y = Math.PI / 2;
  hoop.userData.role =
    'hoop-shaped-frame-free-to-revolve-on-middle-of-horizontal-shaft';
  hoopCarrier.add(hoop);

  const carrierBoss = cylinderAlongX(0.23, 0.42, frameMaterial, 32);
  carrierBoss.userData.role =
    'loose-central-bearing-of-hoop-on-horizontal-shaft';
  hoopCarrier.add(carrierBoss);
  const carrierArms = [];
  for (const y of [-1, 1]) {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 1.28, 0.14),
      frameMaterial,
    );
    arm.position.y = y * 0.70;
    arm.userData.role =
      'radial-hoop-arm-carrying-horizontal-intermediate-miter-gear';
    carrierArms.push(arm);
    hoopCarrier.add(arm);
  }
  const carrierCrossArms = [];
  for (const z of [-1, 1]) {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 1.12),
      frameMaterial,
    );
    arm.position.z = z * 0.62;
    arm.userData.role = 'cross-brace-of-hoop-planet-carrier';
    carrierCrossArms.push(arm);
    hoopCarrier.add(arm);
  }

  const topPlanetGear = makePitchConeGear({
    axis: Y_AXIS,
    boreRadius: 0.08,
    color: PALETTE.accent,
    indexTooth: 2,
    innerDistance: innerConeDistance,
    outerDistance: outerConeDistance,
    pitchConeAngle,
    teeth: gearTeeth,
    toothHeight,
  });
  topPlanetGear.userData.role =
    'upper-balanced-intermediate-miter-gear-carried-by-hoop';
  hoopCarrier.add(topPlanetGear);
  const bottomPlanetGear = makePitchConeGear({
    axis: Y_AXIS.clone().negate(),
    boreRadius: 0.08,
    color: PALETTE.accent,
    indexTooth: 11,
    innerDistance: innerConeDistance,
    outerDistance: outerConeDistance,
    pitchConeAngle,
    teeth: gearTeeth,
    toothHeight,
  });
  bottomPlanetGear.userData.role =
    'lower-balanced-intermediate-miter-gear-carried-by-hoop';
  hoopCarrier.add(bottomPlanetGear);

  const planetAxles = [];
  for (const y of [-1, 1]) {
    const axle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.068, 0.57, 22),
      darkMaterial,
    );
    axle.position.y = y * 1.31;
    axle.userData.role =
      'intermediate-miter-gear-axle-fixed-in-hoop-carrier';
    planetAxles.push(axle);
    hoopCarrier.add(axle);
  }

  const hoopIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 18, 12),
    whiteMaterial,
  );
  hoopIndex.position.set(0, hoopRadius, 0);
  hoopIndex.userData.role =
    'white-index-showing-measuring-hoop-remains-stationary';
  hoopCarrier.add(hoopIndex);

  const bandEnd = new THREE.Vector3(
    bandAttachmentPoint.x,
    -1.46,
    bandAttachmentPoint.z,
  );
  const measuringBand = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.LineCurve3(bandAttachmentPoint, bandEnd),
      12,
      0.028,
      9,
      false,
    ),
    darkMaterial,
  );
  measuringBand.userData.isMeasuringBand = true;
  measuringBand.userData.role =
    'single-tangent-band-applying-known-restraint-to-hoop-periphery';
  root.add(measuringBand);
  const bandAttachment = new THREE.Mesh(
    new THREE.SphereGeometry(0.068, 18, 12),
    brassMaterial,
  );
  bandAttachment.position.copy(bandAttachmentPoint);
  bandAttachment.userData.role =
    'band-attachment-at-known-hoop-lever-arm';
  root.add(bandAttachment);
  const suspensionRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.31, 16),
    darkMaterial,
  );
  suspensionRod.position.set(0, -1.60, bandAttachmentPoint.z);
  suspensionRod.userData.role = 'scale-pan-suspension-from-measuring-band';
  root.add(suspensionRod);
  const scalePan = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.30, 0.075, 36),
    brassMaterial,
  );
  scalePan.position.set(0, -1.79, bandAttachmentPoint.z);
  scalePan.userData.role = 'weighted-scale-pan-indicating-hoop-restraint';
  root.add(scalePan);
  const scaleWeights = [];
  for (const [index, radius, height, y] of [
    [0, 0.22, 0.12, -1.69],
    [1, 0.16, 0.10, -1.58],
  ]) {
    const weight = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 28),
      darkMaterial,
    );
    weight.position.set(0, y, bandAttachmentPoint.z);
    weight.userData.force = indicatedWeightForce / 2;
    weight.userData.forceFraction = 0.5;
    weight.userData.index = index;
    weight.userData.role = 'calibrated-weight-on-dynamometer-scale-pan';
    scaleWeights.push(weight);
    root.add(weight);
  }

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(5.55, 0.17, 1.12),
    frameMaterial,
  );
  base.position.set(0, -2.05, -0.31);
  base.userData.fixed = true;
  base.userData.role = 'fixed-dynamometer-base';
  root.add(base);
  const supportPosts = [];
  const shaftBearings = [];
  for (const x of [-2.24, 2.24]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 2.12, 0.32),
      frameMaterial,
    );
    post.position.set(x, -1.03, -0.30);
    post.userData.fixed = true;
    post.userData.role =
      'fixed-side-standard-supporting-horizontal-shaft';
    supportPosts.push(post);
    root.add(post);
    const bearing = cylinderAlongX(0.19, 0.28, frameMaterial, 30);
    bearing.position.set(x, 0, -0.02);
    bearing.userData.fixed = true;
    bearing.userData.role =
      'fixed-end-bearing-for-horizontal-dynamometer-shaft';
    shaftBearings.push(bearing);
    root.add(bearing);
  }

  const contactMarkers = Object.values(contactPoints).map((point, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 10),
      whiteMaterial,
    );
    marker.position.copy(point);
    marker.userData.index = index;
    marker.userData.role = 'one-of-four-active-miter-pitch-contacts';
    root.add(marker);
    return marker;
  });

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(inputGear, state.inputAngle);
    setSpin(outputGear, state.outputLocalAngle);
    setSpin(topPlanetGear, state.topPlanetLocalAngle);
    setSpin(bottomPlanetGear, state.bottomPlanetLocalAngle);
    outputShaftRotor.rotation.x = state.outputShaftAngle;
    inputSleeveRotor.rotation.x = state.inputAngle;
    hoopCarrier.rotation.x = state.hoopAngle;
    root.userData.currentState = state;
    root.userData.pitchContacts = state.contacts;
  };

  root.userData = {
    archetype: movement.archetype,
    blocks: {
      bandAttachment,
      base,
      bottomPlanetGear,
      carrierArms,
      carrierBoss,
      carrierCrossArms,
      contactMarkers,
      hoop,
      hoopCarrier,
      hoopIndex,
      inputGear,
      inputSleeve,
      inputSleeveIndex,
      inputSleeveRotor,
      measuringBand,
      outputGear,
      outputShaft,
      outputShaftIndex,
      outputShaftRotor,
      planetAxles,
      scalePan,
      scaleWeights,
      shaftBearings,
      supportPosts,
      suspensionRod,
      topPlanetGear,
    },
    contactPoints,
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      input:
        'uniform rotation of the right loose bevel gear while the measuring hoop is statically restrained',
      note:
        'the keyed shaft, both balanced intermediate gears, and every mesh rate follow from the equal-miter differential constraints; the weight supplies a static torque balance rather than another motion coordinate',
      storedEnergyStates: 0,
    },
    differentialRates,
    dynamics: {
      idealizations: [
        'four rigid equal 45-degree miter gears',
        'zero backlash and pitch slip',
        'lossless bearings and tooth contacts',
        'steady externally imposed input speed and load torque',
        'massless inextensible measuring band with a static hanging weight',
      ],
      sourceSpecifiesDimensionsTimingToothCountFrictionOrLoad: false,
      treatment:
        'the source specifies the differential topology and weighing principle but not scale; equal eighteen-tooth pitch cones, speed, transmitted torque, and weights are engineered, while the exact differential, contact-velocity, power, and torque balances are solved analytically',
    },
    fidelity: 'authored',
    geometry: {
      bandAttachmentPoint,
      bandLeverArm,
      circularPitch,
      commonApex,
      gearTeeth,
      hoopOuterRadius,
      hoopRadius,
      hoopTubeRadius,
      innerConeDistance,
      inputAngularSpeed,
      inputPeriod,
      inputStartAngle,
      module,
      outerConeDistance,
      outerPitchRadius,
      outputStartLocalAngle,
      pitchConeAngle,
      planetStartLocalAngle,
      toothHeight,
    },
    measurement: {
      balanceResidualTorque: hoopGearReactionTorque
        - indicatedWeightForce * bandLeverArm,
      gravity,
      hoopGearReactionTorque,
      indicatedMass,
      indicatedWeightForce,
      inputPower,
      losslessPowerResidual: inputPower - inputPower,
      scalePanTared: true,
      transmittedTorque,
      weightMoment: indicatedWeightForce * bandLeverArm,
    },
    mechanism:
      'one-loose-input-and-one-keyed-output-miter-gear-mesh-through-two-opposed-hoop-carried-intermediate-miter-gears-the-held-hoop-reaction-is-balanced-by-one-weighted-peripheral-band-to-measure-transmitted-power',
    officialDescription: movement.description,
    operatingCase: {
      rendered:
        'hoop held stationary for measurement: equal side gears counter-rotate and the band weight balances the carrier reaction',
      sourceAlternative:
        'if the hoop is unrestrained while the output is held, it revolves with the input at half input speed for this equal-gear reconstruction',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate372: {
        bandIndicatorCenter: new THREE.Vector2(267, 423),
        hoopBottom: new THREE.Vector2(270, 343),
        hoopLeft: new THREE.Vector2(141, 194),
        hoopRight: new THREE.Vector2(401, 194),
        hoopTop: new THREE.Vector2(270, 48),
        imageHeight: 525,
        imageWidth: 525,
        leftShaftBearing: new THREE.Vector2(122, 194),
        leftStandardTop: new THREE.Vector2(86, 139),
        measurementUncertaintyPixels: 9,
        rightShaftBearing: new THREE.Vector2(419, 194),
        rightStandardTop: new THREE.Vector2(451, 139),
        shaftCenter: new THREE.Vector2(270, 194),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'two horizontal bevel gears are carried in a hoop-shaped frame',
          'the hoop revolves freely on the middle of the horizontal shaft',
          'two vertical bevel gears mesh with the carried gears',
          'one coaxial bevel gear is fast and the other loose on the shaft',
          'holding the hoop transmits rotation from one side gear to the other',
          'releasing the hoop lets it revolve with the driven side',
          'a weighted band on the hoop periphery indicates the restraining power',
        ],
        engravingEvidence:
          'the plate shows two end standards and one horizontal shaft, a large central hoop, a symmetric pair of intermediate bevel gears within it, the two opposed coaxial bevel gears, and the peripheral measuring band and central weight indication below',
        reconstructionDisclosure:
          'equal eighteen-tooth miter gears, exact pitch-cone dimensions, the right-side loose input assignment, bearing details, colors, input speed, torque, weight, and display period are engineered because Brown gives no numerical values and the official page has no canvas animation',
      },
      jamesWhitePrimaryDesign: {
        book: 'A New Century of Inventions',
        plateAndFigures: 'Plate 3, figures 3 and 4',
        publicationYear: 1822,
        sourceUrl:
          'https://www.gutenberg.org/cache/epub/42951/pg42951-images.html',
        transmissionEvidence:
          'White describes two balanced intermediate wheels carried by frame I K, connecting the two coaxial wheels, and a scale basin receiving the measuring weights',
      },
      officialPage: 'https://507movements.com/mm_372.html',
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod: inputPeriod,
      note:
        'one displayed cycle is one uniform input revolution; because all four bevel gears are equal, every tooth index and the counter-rotating keyed shaft also close in that period while the restrained hoop stays fixed',
    },
    transmission: {
      differentialEquation:
        'omega_input_about_X + omega_output_about_X = 2 omega_hoop_about_X',
      freeHoopWithOutputHeldRates,
      heldMeasurementRates: heldRates,
      heldOutputRatio: -1,
      planetSpinLaw:
        'planet spin relative to the hoop equals -(omega_input_about_X - omega_output_about_X)/2 for equal miter gears',
      torqueLaw:
        'the restraining torque on the hoop is twice the transmitted side-shaft torque; the hanging weight indicates it through weight force times the known band lever arm',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.85, -2.50, -1.08),
    new THREE.Vector3(2.85, 1.98, 2.05),
  );
  correctScriberDynamometer(root, 372);
  root.userData.groundFloorY = -2.10;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(6.8, 3.9, 8.7),
    root,
    update,
  };
}

export function createAuthoredDynamometerMovement(movement) {
  if (movement.id !== 372) return null;
  return hoopReactionDynamometer(movement);
}
