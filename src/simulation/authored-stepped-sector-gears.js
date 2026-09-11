import * as THREE from 'three';
import {
  PALETTE,
  makeShaft,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const QUARTER_TURN = Math.PI / 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function radialPoint(radius, angle) {
  return new THREE.Vector2(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
  );
}

function centeredExtrusion(shape, depth, bevelSize = 0.006) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevelSize > 0,
    bevelSegments: bevelSize > 0 ? 1 : 0,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 2,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function annularSectorShape(innerRadius, outerRadius, startAngle, endAngle) {
  const sweep = endAngle - startAngle;
  const segments = Math.max(12, Math.ceil(Math.abs(sweep) / (Math.PI / 40)));
  const shape = new THREE.Shape();
  for (let index = 0; index <= segments; index += 1) {
    const angle = THREE.MathUtils.lerp(
      startAngle,
      endAngle,
      index / segments,
    );
    const point = radialPoint(outerRadius, angle);
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  }
  for (let index = segments; index >= 0; index -= 1) {
    const angle = THREE.MathUtils.lerp(
      startAngle,
      endAngle,
      index / segments,
    );
    const point = radialPoint(innerRadius, angle);
    shape.lineTo(point.x, point.y);
  }
  shape.closePath();
  return shape;
}

function involuteToothShape({
  centerAngle,
  equivalentTeeth,
  outerRadius,
  pitchRadius,
  pressureAngle,
  rootRadius,
}) {
  const angularPitch = FULL_TURN / equivalentTeeth;
  const pitchHalfToothAngle = Math.PI / (2 * equivalentTeeth);
  const baseRadius = pitchRadius * Math.cos(pressureAngle);
  const involuteAtPitch = Math.tan(pressureAngle) - pressureAngle;
  const involuteAngleAtRadius = (sampleRadius) => {
    if (sampleRadius <= baseRadius) return 0;
    const parameter = Math.sqrt((sampleRadius / baseRadius) ** 2 - 1);
    return parameter - Math.atan(parameter);
  };
  const involuteStartRadius = Math.max(rootRadius, baseRadius);
  const halfAngleAt = (sampleRadius) => (
    pitchHalfToothAngle + involuteAtPitch
      - involuteAngleAtRadius(sampleRadius)
  );
  const startHalfAngle = halfAngleAt(involuteStartRadius);
  const points = [
    radialPoint(rootRadius, centerAngle - angularPitch / 2),
    radialPoint(rootRadius, centerAngle - startHalfAngle),
  ];
  if (involuteStartRadius > rootRadius + 1e-12) {
    points.push(radialPoint(
      involuteStartRadius,
      centerAngle - startHalfAngle,
    ));
  }
  const flankSamples = 8;
  for (let sample = 1; sample <= flankSamples; sample += 1) {
    const radius = THREE.MathUtils.lerp(
      involuteStartRadius,
      outerRadius,
      sample / flankSamples,
    );
    points.push(radialPoint(radius, centerAngle - halfAngleAt(radius)));
  }
  points.push(radialPoint(
    outerRadius,
    centerAngle + halfAngleAt(outerRadius),
  ));
  for (let sample = flankSamples - 1; sample >= 0; sample -= 1) {
    const radius = THREE.MathUtils.lerp(
      involuteStartRadius,
      outerRadius,
      sample / flankSamples,
    );
    points.push(radialPoint(radius, centerAngle + halfAngleAt(radius)));
  }
  if (involuteStartRadius > rootRadius + 1e-12) {
    points.push(radialPoint(
      rootRadius,
      centerAngle + startHalfAngle,
    ));
  }
  points.push(radialPoint(
    rootRadius,
    centerAngle + angularPitch / 2,
  ));

  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  });
  shape.closePath();
  return {
    angularPitch,
    baseRadius,
    involuteStartRadius,
    shape,
  };
}

function makeInvoluteSector({
  color,
  depth,
  equivalentTeeth,
  installedToothCenters,
  planeZ,
  pitchRadius,
  pressureAngle,
  relieveBoundaryTeeth,
  role,
  sectorEnd,
  sectorStart,
}) {
  const group = new THREE.Group();
  group.position.z = planeZ;
  group.userData.axis = Z_AXIS.clone();
  group.userData.role = role;

  const module = 2 * pitchRadius / equivalentTeeth;
  const addendum = module * 0.9;
  const dedendum = module * 1.375;
  const rootRadius = pitchRadius - dedendum;
  const outerRadius = pitchRadius + addendum;
  const transitionRadialClearance = module * 0.18;
  const relievedOuterRadius = pitchRadius - transitionRadialClearance;
  const hubRadius = 0.39;
  const material = matte(color, { metalness: 0.13, roughness: 0.59 });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.2,
    roughness: 0.5,
  });

  const web = new THREE.Mesh(
    centeredExtrusion(
      annularSectorShape(
        hubRadius * 0.78,
        rootRadius + module * 0.025,
        sectorStart,
        sectorEnd,
      ),
      depth,
      0.004,
    ),
    material,
  );
  web.userData.role = `${role}-solid-sector-web`;
  group.add(web);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(hubRadius, hubRadius, depth, 40),
    material,
  );
  hub.rotation.x = Math.PI / 2;
  hub.userData.role = `${role}-shaft-hub`;
  group.add(hub);

  const hubRing = new THREE.Mesh(
    new THREE.TorusGeometry(hubRadius * 0.72, 0.022, 8, 40),
    darkMaterial,
  );
  hubRing.position.z = depth / 2 + 0.009;
  hubRing.userData.role = `${role}-front-hub-ring`;
  group.add(hubRing);

  const toothMeshes = [];
  const transitionTeeth = [];
  const workingTeeth = [];
  let baseRadius = null;
  let involuteStartRadius = null;
  installedToothCenters.forEach((centerAngle, toothIndex) => {
    const isBoundaryTooth = relieveBoundaryTeeth
      && (toothIndex === 0 || toothIndex === installedToothCenters.length - 1);
    const toothOuterRadius = isBoundaryTooth
      ? relievedOuterRadius
      : outerRadius;
    const toothProfile = involuteToothShape({
      centerAngle,
      equivalentTeeth,
      outerRadius: toothOuterRadius,
      pitchRadius,
      pressureAngle,
      rootRadius,
    });
    baseRadius = toothProfile.baseRadius;
    involuteStartRadius = toothProfile.involuteStartRadius;
    const tooth = new THREE.Mesh(
      centeredExtrusion(toothProfile.shape, depth, 0.003),
      material,
    );
    tooth.userData.centerAngle = centerAngle;
    tooth.userData.index = toothIndex;
    tooth.userData.outerRadius = toothOuterRadius;
    tooth.userData.pitchRadius = pitchRadius;
    tooth.userData.role = isBoundaryTooth
      ? `${role}-transition-relieved-boundary-tooth`
      : `${role}-working-involute-tooth`;
    tooth.userData.toothProfile = isBoundaryTooth
      ? 'true-involute-transition-relieved'
      : 'true-involute';
    tooth.userData.transitionRelieved = isBoundaryTooth;
    toothMeshes.push(tooth);
    if (isBoundaryTooth) transitionTeeth.push(tooth);
    else workingTeeth.push(tooth);
    group.add(tooth);
  });

  group.userData.addendum = addendum;
  group.userData.angularPitch = FULL_TURN / equivalentTeeth;
  group.userData.baseRadius = baseRadius;
  group.userData.depth = depth;
  group.userData.dedendum = dedendum;
  group.userData.equivalentTeeth = equivalentTeeth;
  group.userData.installedTeeth = toothMeshes.length;
  group.userData.involuteStartRadius = involuteStartRadius;
  group.userData.module = module;
  group.userData.outerRadius = outerRadius;
  group.userData.pitchRadius = pitchRadius;
  group.userData.planeZ = planeZ;
  group.userData.pressureAngle = pressureAngle;
  group.userData.relieveBoundaryTeeth = relieveBoundaryTeeth;
  group.userData.relievedOuterRadius = relievedOuterRadius;
  group.userData.rootRadius = rootRadius;
  group.userData.sectorEnd = sectorEnd;
  group.userData.sectorStart = sectorStart;
  group.userData.toothMeshes = toothMeshes;
  group.userData.toothProfile = 'true-involute-with-transition-relief';
  group.userData.transitionRadialClearance = transitionRadialClearance;
  group.userData.transitionTeeth = transitionTeeth;
  group.userData.workingTeeth = workingTeeth;
  return group;
}

function makeRotorAssembly(position, role) {
  const assembly = new THREE.Group();
  const rotor = new THREE.Group();
  assembly.add(rotor);
  assembly.position.set(position.x, position.y, 0);
  assembly.userData.axis = Z_AXIS.clone();
  assembly.userData.role = role;
  assembly.userData.rotor = rotor;
  return assembly;
}

function steppedFourPlaneSectorGears(movement) {
  const root = new THREE.Group();

  // Brown's construction divides one uniform driver turn into four equal
  // 90-degree intervals. Each interval uses a different axially separated
  // pair of circular sectors. The inferred pitch radii all add to the same
  // four-unit shaft spacing and reproduce the four source key angles exactly.
  const centerDistance = 4;
  const driverCenter = new THREE.Vector2(0, centerDistance / 2);
  const outputCenter = new THREE.Vector2(0, -centerDistance / 2);
  const pressureAngle = THREE.MathUtils.degToRad(20);
  const sectorDepth = 0.22;
  const planeZs = [-0.63, -0.21, 0.21, 0.63];
  const outputKeyAngles = [
    0,
    -Math.PI / 6,
    -Math.PI / 2,
    -5 * Math.PI / 3,
    -FULL_TURN,
  ];
  const rawPairs = [
    {
      driverEquivalentTeeth: 24,
      driverPitchRadius: 1,
      driverSectorEnd: -Math.PI / 2,
      driverSectorStart: -Math.PI,
      name: 'small-driver-to-large-output',
      outputEquivalentTeeth: 72,
      outputPitchRadius: 3,
      outputSectorEnd: 2 * Math.PI / 3,
      outputSectorStart: Math.PI / 2,
    },
    {
      driverEquivalentTeeth: 40,
      driverPitchRadius: 1.6,
      driverSectorEnd: Math.PI,
      driverSectorStart: Math.PI / 2,
      name: 'first-medium-driver-to-medium-output',
      outputEquivalentTeeth: 60,
      outputPitchRadius: 2.4,
      outputSectorEnd: Math.PI,
      outputSectorStart: 2 * Math.PI / 3,
    },
    {
      driverEquivalentTeeth: 56,
      driverPitchRadius: 2.8,
      driverSectorEnd: Math.PI / 2,
      driverSectorStart: 0,
      name: 'large-driver-to-small-output',
      outputEquivalentTeeth: 24,
      outputPitchRadius: 1.2,
      outputSectorEnd: 13 * Math.PI / 6,
      outputSectorStart: Math.PI,
    },
    {
      driverEquivalentTeeth: 40,
      driverPitchRadius: 1.6,
      driverSectorEnd: 0,
      driverSectorStart: -Math.PI / 2,
      name: 'second-medium-driver-to-medium-output',
      outputEquivalentTeeth: 60,
      outputPitchRadius: 2.4,
      outputSectorEnd: Math.PI / 2,
      outputSectorStart: Math.PI / 6,
    },
  ];
  const pairDefinitions = rawPairs.map((pair, pairIndex) => {
    const driverAngularPitch = FULL_TURN / pair.driverEquivalentTeeth;
    const outputAngularPitch = FULL_TURN / pair.outputEquivalentTeeth;
    const driverPitchCount = Math.round(
      (pair.driverSectorEnd - pair.driverSectorStart) / driverAngularPitch,
    );
    const outputPitchCount = Math.round(
      (pair.outputSectorEnd - pair.outputSectorStart) / outputAngularPitch,
    );
    const driverToothCenters = Array.from(
      { length: driverPitchCount + 1 },
      (_, toothIndex) => pair.driverSectorStart
        + toothIndex * driverAngularPitch,
    );
    const outputToothCenters = Array.from(
      { length: outputPitchCount },
      (_, toothIndex) => pair.outputSectorStart
        + (toothIndex + 0.5) * outputAngularPitch,
    );
    return {
      ...pair,
      driverAngularPitch,
      driverInstalledTeeth: driverToothCenters.length,
      driverModule: 2 * pair.driverPitchRadius
        / pair.driverEquivalentTeeth,
      driverMountPhase: driverToothCenters[0],
      driverToothCenters,
      outputAngularPitch,
      outputInstalledTeeth: outputToothCenters.length,
      outputModule: 2 * pair.outputPitchRadius
        / pair.outputEquivalentTeeth,
      outputMountPhase: outputToothCenters[0],
      outputToothCenters,
      pairIndex,
      planeZ: planeZs[pairIndex],
      speedRatio: pair.driverPitchRadius / pair.outputPitchRadius,
      transitionReliefAngle: driverAngularPitch * 0.22,
    };
  });

  const driverAngularSpeed = 1;
  const driverCyclePeriod = FULL_TURN / driverAngularSpeed;
  const stateAtDriverTravel = (
    driverTravel,
    resolvedDriverAngularSpeed = driverAngularSpeed,
  ) => {
    const completedTurns = Math.floor(driverTravel / FULL_TURN);
    const wrappedDriverAngle = driverTravel - completedTurns * FULL_TURN;
    const activePairIndex = Math.min(
      3,
      Math.floor(wrappedDriverAngle / QUARTER_TURN),
    );
    const pair = pairDefinitions[activePairIndex];
    const intervalTravel = wrappedDriverAngle
      - activePairIndex * QUARTER_TURN;
    const outputAngle = -completedTurns * FULL_TURN
      + outputKeyAngles[activePairIndex]
      - pair.speedRatio * intervalTravel;
    const outputPerDriverAngle = -pair.speedRatio;
    const outputAngularSpeed = outputPerDriverAngle
      * resolvedDriverAngularSpeed;
    const driverContactRadius = new THREE.Vector2(
      0,
      -pair.driverPitchRadius,
    );
    const outputContactRadius = new THREE.Vector2(
      0,
      pair.outputPitchRadius,
    );
    const driverContactPoint = driverCenter.clone().add(
      driverContactRadius,
    );
    const outputContactPoint = outputCenter.clone().add(
      outputContactRadius,
    );
    const contactPoint = new THREE.Vector3(
      (driverContactPoint.x + outputContactPoint.x) / 2,
      (driverContactPoint.y + outputContactPoint.y) / 2,
      pair.planeZ,
    );
    const driverSurfaceVelocity = new THREE.Vector2(
      pair.driverPitchRadius * resolvedDriverAngularSpeed,
      0,
    );
    const outputSurfaceVelocity = new THREE.Vector2(
      -pair.outputPitchRadius * outputAngularSpeed,
      0,
    );
    const driverLocalContactAngle = -Math.PI / 2 - driverTravel;
    const outputLocalContactAngle = Math.PI / 2 - outputAngle;
    const driverPitchPhase = (
      driverLocalContactAngle - pair.driverMountPhase
    ) / pair.driverAngularPitch;
    const outputPitchPhase = (
      outputLocalContactAngle - pair.outputMountPhase
    ) / pair.outputAngularPitch;
    const meshPhaseSum = positiveModulo(
      driverPitchPhase + outputPitchPhase,
      1,
    );
    const transitionDistance = Math.min(
      intervalTravel,
      QUARTER_TURN - intervalTravel,
    );
    const transitionReliefActive = transitionDistance
      <= pair.transitionReliefAngle;
    return {
      activePairIndex,
      activePairName: pair.name,
      contactCenterError: driverContactPoint.distanceTo(outputContactPoint),
      contactPoint,
      completedTurns,
      driverAngle: driverTravel,
      driverAngularSpeed: resolvedDriverAngularSpeed,
      driverLocalContactAngle,
      driverPitchPhase,
      driverSurfaceVelocity,
      driverTravel,
      intervalTravel,
      meshPhaseError: Math.abs(meshPhaseSum - 0.5),
      meshPhaseSum,
      noSlipError: driverSurfaceVelocity.distanceTo(outputSurfaceVelocity),
      outputAngle,
      outputAngularSpeed,
      outputLocalContactAngle,
      outputPerDriverAngle,
      outputPitchPhase,
      outputSurfaceVelocity,
      pair,
      speedChangeBoundary: intervalTravel === 0,
      transitionDistance,
      transitionReliefActive,
      wrappedDriverAngle,
    };
  };
  const stateAtTime = (time) => stateAtDriverTravel(
    time * driverAngularSpeed,
    driverAngularSpeed,
  );

  const driverAssembly = makeRotorAssembly(
    driverCenter,
    'uniform-input-shaft-carrying-four-axially-separated-sectors',
  );
  const outputAssembly = makeRotorAssembly(
    outputCenter,
    'variable-speed-output-shaft-carrying-four-mating-sectors',
  );
  root.add(driverAssembly, outputAssembly);

  const driverSectors = [];
  const outputSectors = [];
  pairDefinitions.forEach((pair) => {
    const driverSector = makeInvoluteSector({
      color: PALETTE.driver,
      depth: sectorDepth,
      equivalentTeeth: pair.driverEquivalentTeeth,
      installedToothCenters: pair.driverToothCenters,
      planeZ: pair.planeZ,
      pitchRadius: pair.driverPitchRadius,
      pressureAngle,
      relieveBoundaryTeeth: true,
      role: `${pair.name}-driver-sector-plane-${pair.pairIndex + 1}`,
      sectorEnd: pair.driverSectorEnd,
      sectorStart: pair.driverSectorStart,
    });
    const outputSector = makeInvoluteSector({
      color: PALETTE.driven,
      depth: sectorDepth,
      equivalentTeeth: pair.outputEquivalentTeeth,
      installedToothCenters: pair.outputToothCenters,
      planeZ: pair.planeZ,
      pitchRadius: pair.outputPitchRadius,
      pressureAngle,
      relieveBoundaryTeeth: false,
      role: `${pair.name}-output-sector-plane-${pair.pairIndex + 1}`,
      sectorEnd: pair.outputSectorEnd,
      sectorStart: pair.outputSectorStart,
    });
    driverSectors.push(driverSector);
    outputSectors.push(outputSector);
    driverAssembly.userData.rotor.add(driverSector);
    outputAssembly.userData.rotor.add(outputSector);
  });

  const totalLayerWidth = planeZs.at(-1) - planeZs[0] + sectorDepth;
  const driverShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: totalLayerWidth + 0.72,
    radius: 0.105,
  });
  driverShaft.position.set(driverCenter.x, driverCenter.y, 0);
  driverShaft.userData.role = 'uniform-input-shaft-through-all-four-planes';
  root.add(driverShaft);
  const outputShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: totalLayerWidth + 0.72,
    radius: 0.105,
  });
  outputShaft.position.set(outputCenter.x, outputCenter.y, 0);
  outputShaft.userData.role = 'variable-output-shaft-through-all-four-planes';
  root.add(outputShaft);

  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });
  const frontFaceZ = planeZs.at(-1) + sectorDepth / 2 + 0.045;
  const makeFaceIndex = (rotor, role) => {
    const index = new THREE.Group();
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.07, 0.028),
      whiteMaterial,
    );
    stripe.position.x = 0.42;
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 18, 12),
      whiteMaterial,
    );
    tip.position.x = 0.79;
    index.position.z = frontFaceZ;
    index.userData.role = role;
    index.add(stripe, tip);
    rotor.add(index);
    return index;
  };
  const driverFaceIndex = makeFaceIndex(
    driverAssembly.userData.rotor,
    'white-index-showing-uniform-input-rotation',
  );
  const outputFaceIndex = makeFaceIndex(
    outputAssembly.userData.rotor,
    'white-index-showing-four-variable-output-speeds',
  );

  const contactMarkers = pairDefinitions.map((pair) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 18, 12),
      whiteMaterial,
    );
    marker.position.set(
      0,
      driverCenter.y - pair.driverPitchRadius,
      pair.planeZ + sectorDepth / 2 + 0.055,
    );
    marker.userData.pairIndex = pair.pairIndex;
    marker.userData.role = `${pair.name}-active-pitch-contact-marker`;
    root.add(marker);
    return marker;
  });

  const sourceState = stateAtDriverTravel(0);
  const closureState = stateAtDriverTravel(FULL_TURN);
  const canonicalTimes = Object.freeze({
    firstSpeedChange: driverCyclePeriod / 4,
    secondSpeedChange: driverCyclePeriod / 2,
    sourcePose: 0,
    thirdSpeedChange: driverCyclePeriod * 3 / 4,
    cycleClosure: driverCyclePeriod,
  });

  root.userData.archetype =
    'four-plane-stepped-sector-gears-variable-circular-motion';
  root.userData.blocks = {
    contactMarkers,
    driverAssembly,
    driverFaceIndex,
    driverSectors,
    driverShaft,
    outputAssembly,
    outputFaceIndex,
    outputSectors,
    outputShaft,
  };
  root.userData.cameraDistanceScale = 0.96;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.3, -5.25, -1.08),
    new THREE.Vector3(3.3, 5.25, 1.08),
  );
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    centerDistance,
    driverCenter,
    outputCenter,
    outputKeyAngles,
    pairDefinitions,
    planeZs,
    pressureAngle,
    sectorDepth,
    totalLayerWidth,
  };
  root.userData.mechanism =
    'four-quarter-driver-sectors-mesh-with-four-separate-output-sectors';
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: 15,
    independentlyReconstructed: true,
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    officialTransitionNote:
      'A few transition teeth must be altered to prevent collision and jamming.',
    plate223: {
      imageHeight: 525,
      imageWidth: 525,
      inferredDriverEquivalentTeeth: [24, 40, 56, 40],
      inferredDriverInstalledTeeth: [7, 11, 15, 11],
      inferredDriverPitchRadii: [1, 1.6, 2.8, 1.6],
      inferredOutputEquivalentTeeth: [72, 60, 24, 60],
      inferredOutputInstalledTeeth: [6, 10, 14, 10],
      inferredOutputPitchRadii: [3, 2.4, 1.2, 2.4],
      rasterDriverCenter: new THREE.Vector2(248, 167),
      rasterOutputCenter: new THREE.Vector2(246, 417),
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtDriverTravel = stateAtDriverTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    driverAngularSpeed,
    driverCyclePeriod,
    driverTurnsPerCycle: 1,
    historicalTransitionInterferenceRemoved: true,
    outputSpeedRatioSequence: pairDefinitions.map(
      (pair) => -pair.speedRatio,
    ),
    outputTurnsPerDriverTurn: (
      closureState.outputAngle - sourceState.outputAngle
    ) / FULL_TURN,
    speedChangeCountPerCycle: 4,
    transitionMethod:
      'axially-separated-pairs-with-radially-relieved-boundary-teeth',
    variableOutputSpeed: true,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(driverAssembly, state.driverAngle);
    setSpin(driverShaft, state.driverAngle);
    setSpin(outputAssembly, state.outputAngle);
    setSpin(outputShaft, state.outputAngle);
    contactMarkers.forEach((marker, pairIndex) => {
      marker.visible = pairIndex === state.activePairIndex;
      marker.scale.setScalar(state.transitionReliefActive ? 0.72 : 1);
    });
    driverAssembly.userData.angularSpeed = state.driverAngularSpeed;
    driverShaft.userData.angularSpeed = state.driverAngularSpeed;
    outputAssembly.userData.angularSpeed = state.outputAngularSpeed;
    outputShaft.userData.angularSpeed = state.outputAngularSpeed;
    root.userData.contacts = {
      activePair: {
        centerError: state.contactCenterError,
        meshPhaseError: state.meshPhaseError,
        name: state.activePairName,
        noSlipError: state.noSlipError,
        pairIndex: state.activePairIndex,
        point: state.contactPoint,
        transitionReliefActive: state.transitionReliefActive,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(6.2, -7.4, 10.5),
  };
}

export function createAuthoredSteppedSectorGearMovement(movement) {
  if (movement.id === 223) return steppedFourPlaneSectorGears(movement);
  return null;
}
