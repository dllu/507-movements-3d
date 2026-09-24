import {correctVariableFaceGear} from './variable-face-gear-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeGear,
  makeShaft,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function makeGaussLegendreRule(order) {
  const nodes = new Float64Array(order);
  const weights = new Float64Array(order);
  const half = Math.ceil(order / 2);
  for (let index = 0; index < half; index += 1) {
    let root = Math.cos(Math.PI * (index + 0.75) / (order + 0.5));
    let derivative = 0;
    for (let iteration = 0; iteration < 24; iteration += 1) {
      let previous = 1;
      let current = root;
      for (let degree = 2; degree <= order; degree += 1) {
        const next = (
          (2 * degree - 1) * root * current
          - (degree - 1) * previous
        ) / degree;
        previous = current;
        current = next;
      }
      derivative = order * (root * current - previous) / (root * root - 1);
      const correction = current / derivative;
      root -= correction;
      if (Math.abs(correction) < 2e-16) break;
    }
    const weight = 2 / ((1 - root * root) * derivative * derivative);
    nodes[index] = -root;
    nodes[order - 1 - index] = root;
    weights[index] = weight;
    weights[order - 1 - index] = weight;
  }
  return { nodes, weights };
}

const QUADRATURE = makeGaussLegendreRule(32);

function integrateGaussLegendre(integrand, start, end) {
  if (start === end) return 0;
  const midpoint = (start + end) / 2;
  const halfWidth = (end - start) / 2;
  let sum = 0;
  for (let index = 0; index < QUADRATURE.nodes.length; index += 1) {
    sum += QUADRATURE.weights[index] * integrand(
      midpoint + halfWidth * QUADRATURE.nodes[index],
    );
  }
  return halfWidth * sum;
}

function beamBetween(start, end, width, depth, z, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  beam.position.set(midpoint.x, midpoint.y, z);
  beam.rotation.z = Math.atan2(delta.y, delta.x);
  return beam;
}

function annularPlate(centerX, outerRadius, innerRadius, depth, material) {
  const shape = new THREE.Shape();
  shape.absarc(centerX, 0, outerRadius, 0, FULL_TURN, false);
  const opening = new THREE.Path();
  opening.absarc(centerX, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(opening);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.035,
    bevelThickness: 0.025,
    curveSegments: 96,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geometry, material);
}

function eccentricCrownWheelAndSlidingPinion(movement) {
  const root = new THREE.Group();
  const crownAssembly = new THREE.Group();
  const crownRotor = new THREE.Group();
  crownAssembly.add(crownRotor);
  crownAssembly.userData.axis = Z_AXIS.clone();
  crownAssembly.userData.rotor = crownRotor;
  root.add(crownAssembly);

  // The engraved wheel is a circular crown whose geometric center is offset
  // from its vertical arbor. Its outer pitch locus is therefore the polar
  // equation of an eccentric circle about the true shaft center O.
  const crownPitchCircleRadius = 2.4;
  const eccentricity = 0.64;
  const crownTeethCount = 40;
  const pinionTeethCount = 8;
  // Brown draws a shallow drum: a narrow rim carrying the crown teeth on its
  // upper edge and a four-armed cross below them.
  const crownInnerRadius = 2.2;
  const crownBodyOuterRadius = 2.57;
  const crownBodyDepth = 0.6;
  const crownBodyCenterZ = -0.06;
  const crownBodyTopZ = crownBodyCenterZ + crownBodyDepth / 2;
  const crownToothHeight = 0.3;
  const crownPitchPlaneZ = crownBodyTopZ + crownToothHeight / 2;
  const crownToothRadialDepth = 0.31;
  const inputAngularSpeed = 0.78;
  const sourcePoseAngle = Math.PI;

  const pitchRadiusAtBodyAngle = (bodyAngle) => {
    const sine = Math.sin(bodyAngle);
    return eccentricity * Math.cos(bodyAngle) + Math.sqrt(
      crownPitchCircleRadius ** 2 - eccentricity ** 2 * sine ** 2,
    );
  };
  const cyclePitchTravel = integrateGaussLegendre(
    pitchRadiusAtBodyAngle,
    0,
    FULL_TURN,
  );
  const pitchTravelFromZero = (bodyAngle) => {
    let turns = Math.floor(bodyAngle / FULL_TURN);
    let remainder = bodyAngle - turns * FULL_TURN;
    if (remainder > FULL_TURN - 4e-15) {
      turns += 1;
      remainder = 0;
    }
    return turns * cyclePitchTravel + integrateGaussLegendre(
      pitchRadiusAtBodyAngle,
      0,
      remainder,
    );
  };
  const circularPitch = cyclePitchTravel / crownTeethCount;
  const module = circularPitch / Math.PI;
  const pinionPitchRadius = module * pinionTeethCount / 2;
  const pinionToothHeight = module * 1.8;
  const pinionOuterRadius = pinionPitchRadius + pinionToothHeight / 2;
  const pinionRootRadius = pinionPitchRadius - pinionToothHeight / 2;
  // The plate's pinion is a long pinion: its teeth run along the shaft over
  // the whole range of relative radius, so it stays axially fixed while the
  // contact travels along its face.
  const pinionDepth = 2 * eccentricity + crownToothRadialDepth + 0.1;
  const pinionAxialCenterX = crownPitchCircleRadius;
  const pinionCenterZ = crownPitchPlaneZ + pinionPitchRadius;
  const pinionPhase = Math.PI / pinionTeethCount;
  const inputCyclePeriod = FULL_TURN / inputAngularSpeed;

  const toothBodyAngles = [];
  const toothPitchTravels = [];
  for (let toothIndex = 0; toothIndex < crownTeethCount; toothIndex += 1) {
    const targetTravel = toothIndex * circularPitch;
    let lower = 0;
    let upper = FULL_TURN;
    for (let iteration = 0; iteration < 58; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (pitchTravelFromZero(middle) < targetTravel) lower = middle;
      else upper = middle;
    }
    toothBodyAngles.push((lower + upper) / 2);
    toothPitchTravels.push(targetTravel);
  }

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.61,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.57,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.5 });

  const crownRing = annularPlate(
    eccentricity,
    crownBodyOuterRadius,
    crownInnerRadius,
    crownBodyDepth,
    driverMaterial,
  );
  crownRing.position.z = crownBodyCenterZ;
  crownRing.userData.role = 'eccentric-circular-crown-wheel-body';
  crownRing.userData.geometricCenter = new THREE.Vector2(eccentricity, 0);
  crownRotor.add(crownRing);

  const crownTeeth = [];
  const toothGeometry = new THREE.BoxGeometry(
    crownToothRadialDepth,
    circularPitch * 0.46,
    crownToothHeight,
  );
  for (let toothIndex = 0; toothIndex < crownTeethCount; toothIndex += 1) {
    const bodyAngle = toothBodyAngles[toothIndex];
    const pitchRadius = pitchRadiusAtBodyAngle(bodyAngle);
    const tooth = new THREE.Mesh(toothGeometry, driverMaterial);
    tooth.position.set(
      Math.cos(bodyAngle) * pitchRadius,
      Math.sin(bodyAngle) * pitchRadius,
      crownBodyTopZ + crownToothHeight / 2,
    );
    tooth.rotation.z = bodyAngle;
    tooth.userData.bodyAngle = bodyAngle;
    tooth.userData.crownTooth = true;
    tooth.userData.index = toothIndex;
    tooth.userData.pitchRadius = pitchRadius;
    tooth.userData.pitchTravel = toothPitchTravels[toothIndex];
    tooth.userData.radialToArbor = true;
    crownRotor.add(tooth);
    crownTeeth.push(tooth);
  }

  const crownHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.38, 40),
    inkMaterial,
  );
  crownHub.rotation.x = Math.PI / 2;
  const spokeZ = crownBodyTopZ - 0.12;
  crownHub.position.z = spokeZ;
  crownHub.userData.role = 'eccentric-crown-wheel-arbor-hub';
  crownRotor.add(crownHub);

  const spokeAngles = [0.12, 0.12 + FULL_TURN / 4, 0.12 + FULL_TURN / 2, 0.12 + 3 * FULL_TURN / 4];
  const crownSpokes = [];
  for (const [index, angle] of spokeAngles.entries()) {
    const innerIntersection = eccentricity * Math.cos(angle) + Math.sqrt(
      crownInnerRadius ** 2 - eccentricity ** 2 * Math.sin(angle) ** 2,
    );
    const start = new THREE.Vector2(
      Math.cos(angle) * 0.29,
      Math.sin(angle) * 0.29,
    );
    const end = new THREE.Vector2(
      Math.cos(angle) * (innerIntersection + 0.12),
      Math.sin(angle) * (innerIntersection + 0.12),
    );
    const spoke = beamBetween(
      start,
      end,
      0.3,
      0.17,
      spokeZ,
      driverMaterial,
    );
    spoke.userData.role = 'crown-wheel-cross-arm';
    spoke.userData.index = index;
    crownRotor.add(spoke);
    crownSpokes.push(spoke);
  }

  const crownShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 2.65,
    radius: 0.105,
  });
  crownShaft.position.z = -0.92;
  crownShaft.userData.role = 'eccentric-crown-wheel-vertical-arbor';
  crownRotor.add(crownShaft);

  const pinion = makeGear({
    axis: X_AXIS,
    color: PALETTE.driven,
    depth: pinionDepth,
    radius: pinionPitchRadius,
    teeth: pinionTeethCount,
    toothHeight: pinionToothHeight,
  });
  pinion.userData.axiallySliding = false;
  pinion.userData.keyedToShaft = true;
  pinion.userData.role = 'long-involute-crown-pinion';
  root.add(pinion);

  const pinionCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, pinionDepth * 1.65, 28),
    drivenMaterial,
  );
  pinionCollar.rotation.x = Math.PI / 2;
  pinionCollar.userData.role = 'hidden-keyed-pinion-bore-sleeve';
  pinion.userData.rotor.add(pinionCollar);

  const shaftLength = 4.1;
  const shaftCenterX = 3.5;
  const shaftRadius = 0.095;
  const pinionShaft = makeShaft({
    axis: X_AXIS,
    color: PALETTE.ink,
    length: shaftLength,
    radius: shaftRadius,
  });
  pinionShaft.position.set(shaftCenterX, 0, pinionCenterZ);
  pinionShaft.userData.role = 'fixed-axis-rotating-splined-pinion-shaft';
  root.add(pinionShaft);

  const splineLength = pinionDepth;
  const splineCenterX = pinionAxialCenterX;
  const pinionSplineRibs = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = index * Math.PI / 2;
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(0.027, 0.027, splineLength),
      inkMaterial,
    );
    rib.position.set(
      Math.cos(angle) * shaftRadius * 1.02,
      Math.sin(angle) * shaftRadius * 1.02,
      splineCenterX - shaftCenterX,
    );
    rib.rotation.z = angle;
    rib.userData.role = 'pinion-shaft-key-under-long-pinion';
    pinionShaft.userData.rotor.add(rib);
    pinionSplineRibs.push(rib);
  }

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    whiteMaterial,
  );
  contactMarker.userData.role = 'instantaneous-crown-pinion-pitch-contact';
  root.add(contactMarker);

  const pitchRadiusDerivative = (crownAngle) => {
    const sine = Math.sin(crownAngle);
    const cosine = Math.cos(crownAngle);
    const radical = Math.sqrt(
      crownPitchCircleRadius ** 2 - eccentricity ** 2 * sine ** 2,
    );
    return -eccentricity * sine
      - eccentricity ** 2 * sine * cosine / radical;
  };
  const pitchRadiusSecondDerivative = (crownAngle) => {
    const sine = Math.sin(crownAngle);
    const cosine = Math.cos(crownAngle);
    const radical = Math.sqrt(
      crownPitchCircleRadius ** 2 - eccentricity ** 2 * sine ** 2,
    );
    const numerator = eccentricity ** 2 * sine * cosine;
    return -eccentricity * cosine
      - eccentricity ** 2 * (cosine ** 2 - sine ** 2) / radical
      - numerator ** 2 / radical ** 3;
  };
  const sourcePitchTravel = pitchTravelFromZero(sourcePoseAngle);
  const sourceBodyContactTravel = pitchTravelFromZero(-sourcePoseAngle);

  const stateAtInputTravel = (
    inputTravel,
    crownAngularSpeed = inputAngularSpeed,
    crownAngularAcceleration = 0,
  ) => {
    const crownAngle = sourcePoseAngle + inputTravel;
    const pitchRadius = pitchRadiusAtBodyAngle(crownAngle);
    const radiusDerivative = pitchRadiusDerivative(crownAngle);
    const radiusSecondDerivative = pitchRadiusSecondDerivative(crownAngle);
    const pinionPitchTravel = pitchTravelFromZero(crownAngle)
      - sourcePitchTravel;
    const pinionAngle = pinionPhase + pinionPitchTravel / pinionPitchRadius;
    const pinionAngularSpeed = crownAngularSpeed
      * pitchRadius / pinionPitchRadius;
    const pinionAngularAcceleration = (
      crownAngularSpeed ** 2 * radiusDerivative
      + crownAngularAcceleration * pitchRadius
    ) / pinionPitchRadius;
    // The contact travels along the fixed long pinion's face; neither body
    // slides axially at the pitch point.
    const contactAxialSpeed = crownAngularSpeed * radiusDerivative;
    const contactAxialAcceleration = crownAngularSpeed ** 2
      * radiusSecondDerivative + crownAngularAcceleration * radiusDerivative;
    const pinionAxialSpeed = 0;
    const pinionAxialAcceleration = 0;
    const eccentricCenter = new THREE.Vector3(
      Math.cos(crownAngle) * eccentricity,
      Math.sin(crownAngle) * eccentricity,
      crownBodyCenterZ,
    );
    const contactPoint = new THREE.Vector3(
      pitchRadius,
      0,
      crownPitchPlaneZ,
    );
    const pinionCenter = new THREE.Vector3(
      pinionAxialCenterX,
      0,
      pinionCenterZ,
    );
    const crownSurfaceVelocity = Y_AXIS.clone().multiplyScalar(
      crownAngularSpeed * pitchRadius,
    );
    const pinionRotationalSurfaceVelocity = Y_AXIS.clone().multiplyScalar(
      pinionAngularSpeed * pinionPitchRadius,
    );
    const pinionCenterVelocity = X_AXIS.clone().multiplyScalar(pinionAxialSpeed);
    const pinionSurfaceVelocity = pinionCenterVelocity.clone().add(
      pinionRotationalSurfaceVelocity,
    );
    const bodyContactAngle = -crownAngle;
    const bodyContactPitchTravel = pitchTravelFromZero(bodyContactAngle);
    const meshPitchInvariant = positiveModulo(
      bodyContactPitchTravel
        - sourceBodyContactTravel
        + pinionPitchTravel,
      circularPitch,
    );
    const centeredMeshPitchInvariant = Math.min(
      meshPitchInvariant,
      circularPitch - meshPitchInvariant,
    );

    return {
      axialSlidingSpeed: pinionAxialSpeed,
      contactAxialAcceleration,
      contactAxialPosition: pitchRadius,
      contactAxialSpeed,
      bodyContactAngle,
      bodyContactPitchTravel,
      centeredMeshPitchInvariant,
      contactPoint,
      crownAngle,
      crownAngularAcceleration,
      crownAngularSpeed,
      crownSurfaceVelocity,
      eccentricCenter,
      meshPitchInvariant,
      pinionAngle,
      pinionAngularAcceleration,
      pinionAngularSpeed,
      pinionAxialAcceleration,
      pinionAxialSpeed,
      pinionCenter,
      pinionCenterVelocity,
      pinionPitchTravel,
      pinionRotationalSurfaceVelocity,
      pinionSurfaceVelocity,
      pitchRadius,
      pitchRadiusDerivative: radiusDerivative,
      pitchRadiusSecondDerivative: radiusSecondDerivative,
      rollingSpeedError: Math.abs(
        crownSurfaceVelocity.y - pinionRotationalSurfaceVelocity.y,
      ),
      speedRatio: pinionAngularSpeed / crownAngularSpeed,
    };
  };
  const stateAtTime = (time) => stateAtInputTravel(time * inputAngularSpeed);
  const solidClearanceAtInputTravel = (inputTravel) => {
    const state = stateAtInputTravel(inputTravel);
    return {
      pinionRootToCrownBody: (
        pinionCenterZ - pinionRootRadius
      ) - crownBodyTopZ,
      shaftToCrownBody: (
        pinionCenterZ - shaftRadius
      ) - crownBodyTopZ,
      pinionFaceMargin: Math.min(
        state.pitchRadius - crownToothRadialDepth / 2
          - (pinionAxialCenterX - pinionDepth / 2),
        pinionAxialCenterX + pinionDepth / 2
          - state.pitchRadius - crownToothRadialDepth / 2,
      ),
      shaftTravelMargin: Math.min(
        state.pitchRadius - (shaftCenterX - shaftLength / 2),
        shaftCenterX + shaftLength / 2 - state.pitchRadius,
      ),
    };
  };

  const canonicalTimes = Object.freeze({
    sourcePoseNearestRadius: 0,
    firstMeanCrossing: inputCyclePeriod / 4,
    farthestRadius: inputCyclePeriod / 2,
    secondMeanCrossing: inputCyclePeriod * 3 / 4,
    cycleClosure: inputCyclePeriod,
  });
  // The catalog archetype name predates the long-pinion correction.
  root.userData.archetype = 'eccentric-circular-crown-wheel-sliding-involute-pinion';
  root.userData.blocks = {
    contactMarker,
    crownAssembly,
    crownHub,
    crownRing,
    crownShaft,
    crownSpokes,
    crownTeeth,
    pinion,
    pinionCollar,
    pinionShaft,
    pinionSplineRibs,
  };
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.2, -3.05, -2.3),
    new THREE.Vector3(5.65, 3.05, 1.3),
  );
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    averagePitchRadius: cyclePitchTravel / FULL_TURN,
    circularPitch,
    crownBodyCenterZ,
    crownBodyDepth,
    crownBodyOuterRadius,
    crownBodyTopZ,
    crownInnerRadius,
    crownPitchCircleRadius,
    crownPitchPlaneZ,
    crownTeethCount,
    crownToothHeight,
    crownToothRadialDepth,
    cyclePitchTravel,
    eccentricity,
    inputAngularSpeed,
    inputCyclePeriod,
    maximumPitchRadius: crownPitchCircleRadius + eccentricity,
    minimumPitchRadius: crownPitchCircleRadius - eccentricity,
    module,
    pinionCenterZ,
    pinionDepth,
    pinionAxialCenterX,
    pinionOuterRadius,
    pinionPhase,
    pinionPitchRadius,
    pinionRootRadius,
    pinionTeethCount,
    pinionToothHeight,
    shaftCenterX,
    shaftLength,
    shaftRadius,
    splineCenterX,
    splineLength,
    sourcePoseAngle,
    spokeAngles,
    toothBodyAngles,
    toothPitchTravels,
  };
  root.userData.mechanism = 'eccentric-crown-wheel-with-long-fixed-pinion';
  root.userData.pitchRadiusAtBodyAngle = pitchRadiusAtBodyAngle;
  root.userData.pitchTravelFromZero = pitchTravelFromZero;
  root.userData.solidClearanceAtInputTravel = solidClearanceAtInputTravel;
  root.userData.sourceAnimation = {
    available: false,
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate219: {
      imageHeight: 525,
      imageWidth: 525,
      rasterCrownGeometricCenter: new THREE.Vector2(219, 255),
      rasterCrownOuterRadius: 143,
      rasterPinionCenter: new THREE.Vector2(291, 220),
      rasterPinionRadius: 14,
      rasterShaftCenter: new THREE.Vector2(265, 278),
      rasterShaftFarPoint: new THREE.Vector2(489, 75),
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtInputTravel = stateAtInputTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.toothCountRationale = 'The engraving is schematic; forty crown teeth and eight pinion teeth preserve its visible five-to-one mean pitch ratio while keeping one exact whole-tooth closure.';
  root.userData.transmission = {
    averageSpeedRatio: crownTeethCount / pinionTeethCount,
    inputAngularSpeed,
    inputCyclePeriod,
    maximumSpeedRatio: (
      crownPitchCircleRadius + eccentricity
    ) / pinionPitchRadius,
    minimumSpeedRatio: (
      crownPitchCircleRadius - eccentricity
    ) / pinionPitchRadius,
    outputTurnsPerInputTurn: crownTeethCount / pinionTeethCount,
    pitchLaw: 'pinionAngularSpeed = crownAngularSpeed * instantaneousRadius / pinionPitchRadius',
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(crownAssembly, state.crownAngle);
    pinion.position.copy(state.pinionCenter);
    setSpin(pinion, state.pinionAngle);
    setSpin(pinionShaft, state.pinionAngle);
    contactMarker.position.copy(state.contactPoint);
    crownAssembly.userData.angularSpeed = state.crownAngularSpeed;
    crownShaft.userData.angularSpeed = state.crownAngularSpeed;
    pinion.userData.angularSpeed = state.pinionAngularSpeed;
    pinion.userData.axialSpeed = state.pinionAxialSpeed;
    pinion.userData.contactAxialSpeed = state.contactAxialSpeed;
    pinionShaft.userData.angularSpeed = state.pinionAngularSpeed;
    root.userData.contact = {
      contactPoint: state.contactPoint,
      crownSurfaceVelocity: state.crownSurfaceVelocity,
      pinionRotationalSurfaceVelocity: state.pinionRotationalSurfaceVelocity,
      rollingDirection: Y_AXIS.clone(),
      rollingSpeedError: state.rollingSpeedError,
    };
    root.userData.kinematics = state;
  };
  update(0);
  correctVariableFaceGear(root, 219);
  // Brown draws no phase stripe, sliding collar or pitch marker.
  pinion.userData.rotor.children[1].visible = false;
  pinion.userData.rotor.children[3].visible = false;
  pinionCollar.visible = false;
  root.userData.reconstructionNote = 'An eccentric crown wheel drives a long pinion whose teeth span the whole range of relative radius, as Brown draws it; the contact travels along the fixed pinion. Equal accumulated pitch gives five pinion turns per crown revolution. Dimensions and finite tooth profiles are inferred.';
  root.rotation.z = THREE.MathUtils.degToRad(55);
  root.userData.cameraFitBounds.set(new THREE.Vector3(-3.23, -3.23, -2.27), new THREE.Vector3(3.35, 4.70, 1.46));
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(0, -10, 6),
  };
}

export function createAuthoredEccentricCrownGearMovement(movement) {
  if (movement.id !== 219) return null;
  return eccentricCrownWheelAndSlidingPinion(movement);
}
