import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const HALF_PI = Math.PI / 2;
const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function quinticState(parameter) {
  const u = THREE.MathUtils.clamp(parameter, 0, 1);
  return {
    rate: 30 * u ** 2 * (1 - u) ** 2,
    value: u ** 3 * (10 + u * (-15 + 6 * u)),
  };
}

function rotate2(vector, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * vector.x - sine * vector.y,
    sine * vector.x + cosine * vector.y,
  );
}

class PlanarArcCurve3 extends THREE.Curve {
  constructor(center, radius, startAngle, sweep, z) {
    super();
    this.center = center.clone();
    this.radius = radius;
    this.startAngle = startAngle;
    this.sweep = sweep;
    this.z = z;
  }

  getPoint(parameter, target = new THREE.Vector3()) {
    const angle = this.startAngle + this.sweep * parameter;
    return target.set(
      this.center.x + this.radius * Math.cos(angle),
      this.center.y + this.radius * Math.sin(angle),
      this.z,
    );
  }

  getPointAt(parameter, target = new THREE.Vector3()) {
    return this.getPoint(parameter, target);
  }

  getTangent(parameter, target = new THREE.Vector3()) {
    const angle = this.startAngle + this.sweep * parameter;
    return target.set(
      -Math.sin(angle) * Math.sign(this.sweep),
      Math.cos(angle) * Math.sign(this.sweep),
      0,
    );
  }

  getTangentAt(parameter, target = new THREE.Vector3()) {
    return this.getTangent(parameter, target);
  }
}

function cylinderAlongZ(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function makeAnnularHousing(innerRadius, outerRadius, depth, material) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    curveSegments: 80,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  const housing = new THREE.Mesh(geometry, material);
  housing.userData.role =
    'fixed-annular-four-port-cock-body-surrounding-turning-plug';
  return markShadows(housing);
}

function makePipe({
  center,
  length,
  material,
  name,
  orientation,
  radius,
}) {
  const pipe = new THREE.Group();
  pipe.userData.role = `${name}-fixed-external-port-pipe`;
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 36),
    material,
  );
  if (orientation === 'horizontal') barrel.rotation.z = Math.PI / 2;
  barrel.position.set(center.x, center.y, 0);
  barrel.userData.role = `${name}-pipe-barrel`;
  const bore = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.54, radius * 0.54,
      length + 0.035, 28),
    matte(PALETTE.ink, { metalness: 0.16, roughness: 0.42 }),
  );
  if (orientation === 'horizontal') bore.rotation.z = Math.PI / 2;
  bore.position.set(center.x, center.y, 0.01);
  bore.userData.role = `${name}-visible-port-bore`;
  pipe.add(barrel, bore);
  return markShadows(pipe);
}

function makePassage({
  curve,
  flowMaterial,
  name,
  recessMaterial,
  whiteMaterial,
}) {
  const passage = new THREE.Group();
  passage.userData.role = `${name}-rigid-quarter-circular-plug-passage`;
  const recess = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 56, 0.245, 16, false),
    recessMaterial,
  );
  recess.userData.role = `${name}-passage-dark-cutaway-wall`;
  const flowCore = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 56, 0.155, 14, false),
    flowMaterial,
  );
  // This is a front-face cutaway overlay, lifted clear of the opaque passage
  // wall so fluid identity remains legible without pretending it is a second
  // physical conduit.
  flowCore.position.z = 0.20;
  flowCore.userData.role = `${name}-visible-fluid-core`;
  const markers = Array.from({ length: 5 }, (_, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 18, 12),
      whiteMaterial,
    );
    marker.userData.index = index;
    marker.userData.role = `${name}-flow-direction-index`;
    passage.add(marker);
    return marker;
  });
  passage.add(recess, flowCore);
  passage.userData.curve = curve;
  passage.userData.flowCore = flowCore;
  passage.userData.markers = markers;
  passage.userData.recess = recess;
  return markShadows(passage);
}

function makeExternalFlowMarkers({
  count,
  material,
  name,
}) {
  const group = new THREE.Group();
  group.userData.role = `${name}-external-flow-indices`;
  const markers = Array.from({ length: count }, (_, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 18, 12),
      material,
    );
    marker.userData.index = index;
    marker.userData.role = `${name}-flow-index`;
    group.add(marker);
    return marker;
  });
  group.userData.markers = markers;
  return group;
}

function fourWaySteamCock(movement) {
  const root = new THREE.Group();

  // Brown supplies the two ported positions but no dimensions or animation.
  // The upper engraving is the reference pose. Rotating its one rigid plug
  // clockwise by exactly 90 degrees produces the lower engraving.
  const plugRadius = 1.72;
  const passageEndpointRadius = 1.46;
  const passageRadius = passageEndpointRadius;
  const bodyInnerRadius = 1.79;
  const bodyOuterRadius = 2.10;
  const bodyDepth = 0.58;
  const plugDepth = 0.43;
  const pipeRadius = 0.34;
  const pipeLength = 2.10;
  const pipeCenterRadius = bodyOuterRadius + pipeLength / 2 - 0.08;
  const upperPositionAngle = 0;
  const lowerPositionAngle = -HALF_PI;
  const cycleDuration = 8;
  const upperHoldEnd = 0.32;
  const clockwiseTransferEnd = 0.50;
  const lowerHoldEnd = 0.82;
  const angularAlignmentTolerance = 1e-10;

  const bodyMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.54,
  });
  const bodyDarkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.42,
  });
  const plugMaterial = matte(PALETTE.brass, {
    metalness: 0.24,
    roughness: 0.50,
  });
  const supplyMaterial = matte(PALETTE.driver, {
    metalness: 0.08,
    roughness: 0.43,
    transparent: true,
    opacity: 0.88,
  });
  const exhaustMaterial = matte(PALETTE.fluid, {
    metalness: 0.06,
    roughness: 0.46,
    transparent: true,
    opacity: 0.88,
  });
  supplyMaterial.depthWrite = false;
  exhaustMaterial.depthWrite = false;
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.38 });

  const fixedBody = new THREE.Group();
  fixedBody.userData.role =
    'fixed-four-port-body-with-top-supply-bottom-exhaust-and-two-cylinder-ports';
  const housing = makeAnnularHousing(
    bodyInnerRadius,
    bodyOuterRadius,
    bodyDepth,
    bodyMaterial,
  );
  fixedBody.add(housing);

  const pipeDefinitions = {
    bottomExhaust: {
      center: new THREE.Vector2(0, -pipeCenterRadius),
      name: 'bottom-exhaust',
      orientation: 'vertical',
    },
    leftCylinder: {
      center: new THREE.Vector2(-pipeCenterRadius, 0),
      name: 'left-cylinder-end',
      orientation: 'horizontal',
    },
    rightCylinder: {
      center: new THREE.Vector2(pipeCenterRadius, 0),
      name: 'right-cylinder-end',
      orientation: 'horizontal',
    },
    topSupply: {
      center: new THREE.Vector2(0, pipeCenterRadius),
      name: 'top-steam-supply',
      orientation: 'vertical',
    },
  };
  const pipes = {};
  for (const [key, definition] of Object.entries(pipeDefinitions)) {
    const pipe = makePipe({
      ...definition,
      length: pipeLength,
      material: bodyMaterial,
      radius: pipeRadius,
    });
    pipes[key] = pipe;
    fixedBody.add(pipe);
  }

  const portCollars = [
    [0, bodyOuterRadius, 0],
    [bodyOuterRadius, 0, -HALF_PI],
    [0, -bodyOuterRadius, 0],
    [-bodyOuterRadius, 0, -HALF_PI],
  ].map(([x, y, rotation], index) => {
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(pipeRadius * 1.22, pipeRadius * 1.22,
        0.38, 36),
      bodyDarkMaterial,
    );
    collar.rotation.z = rotation;
    collar.position.set(x, y, 0);
    collar.userData.index = index;
    collar.userData.role = 'fixed-port-collar';
    fixedBody.add(collar);
    return collar;
  });
  root.add(markShadows(fixedBody));

  const plugRotor = new THREE.Group();
  plugRotor.userData.role =
    'single-quarter-turn-plug-carrying-two-rigid-disjoint-passages';
  const plug = cylinderAlongZ(plugRadius, plugDepth, plugMaterial, 80);
  plug.userData.role = 'close-fitting-rotary-cock-plug';
  plugRotor.add(plug);

  const channelAStart = new THREE.Vector2(0, passageEndpointRadius);
  const channelAEnd = new THREE.Vector2(-passageEndpointRadius, 0);
  const channelBStart = channelAStart.clone().multiplyScalar(-1);
  const channelBEnd = channelAEnd.clone().multiplyScalar(-1);
  const channelACurve = new PlanarArcCurve3(
    new THREE.Vector2(-passageRadius, passageRadius),
    passageRadius,
    0,
    -HALF_PI,
    plugDepth / 2 + 0.13,
  );
  const channelBCurve = new PlanarArcCurve3(
    new THREE.Vector2(passageRadius, -passageRadius),
    passageRadius,
    Math.PI,
    -HALF_PI,
    plugDepth / 2 + 0.13,
  );
  const channelA = makePassage({
    curve: channelACurve,
    flowMaterial: supplyMaterial,
    name: 'passage-A',
    recessMaterial: bodyDarkMaterial,
    whiteMaterial,
  });
  const channelB = makePassage({
    curve: channelBCurve,
    flowMaterial: exhaustMaterial,
    name: 'passage-B',
    recessMaterial: bodyDarkMaterial,
    whiteMaterial,
  });
  plugRotor.add(channelA, channelB);

  const stem = cylinderAlongZ(0.19, 1.10, bodyDarkMaterial, 32);
  stem.position.z = 0.34;
  stem.userData.role = 'plug-operating-stem';
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(1.38, 0.15, 0.13),
    bodyDarkMaterial,
  );
  handle.position.set(0.67, 0, 0.84);
  handle.userData.role = 'quarter-turn-operating-handle';
  const handleIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 20, 14),
    whiteMaterial,
  );
  handleIndex.position.set(1.34, 0, 0.84);
  handleIndex.userData.role =
    'white-index-showing-the-plug-quarter-turn';
  plugRotor.add(stem, handle, handleIndex);
  root.add(markShadows(plugRotor));

  const fixedQuadrant = new THREE.Group();
  fixedQuadrant.userData.role = 'fixed-ninety-degree-handle-travel-reference';
  const quadrantCurve = new PlanarArcCurve3(
    new THREE.Vector2(0, 0),
    1.34,
    0,
    -HALF_PI,
    0.80,
  );
  const quadrant = new THREE.Mesh(
    new THREE.TubeGeometry(quadrantCurve, 36, 0.025, 8, false),
    whiteMaterial,
  );
  quadrant.userData.role = 'fixed-quarter-turn-index-arc';
  fixedQuadrant.add(quadrant);
  root.add(fixedQuadrant);

  const topFlow = makeExternalFlowMarkers({
    count: 4,
    material: supplyMaterial,
    name: 'top-supply',
  });
  const bottomFlow = makeExternalFlowMarkers({
    count: 4,
    material: exhaustMaterial,
    name: 'bottom-exhaust',
  });
  const leftFlowMaterial = supplyMaterial.clone();
  const rightFlowMaterial = exhaustMaterial.clone();
  leftFlowMaterial.depthWrite = false;
  rightFlowMaterial.depthWrite = false;
  const leftFlow = makeExternalFlowMarkers({
    count: 4,
    material: leftFlowMaterial,
    name: 'left-cylinder-port',
  });
  const rightFlow = makeExternalFlowMarkers({
    count: 4,
    material: rightFlowMaterial,
    name: 'right-cylinder-port',
  });
  const externalFlow = new THREE.Group();
  externalFlow.userData.role = 'explanatory-fixed-pipe-flow-indices';
  externalFlow.add(topFlow, bottomFlow, leftFlow, rightFlow);
  root.add(externalFlow);

  const portCenters = {
    bottomExhaust: new THREE.Vector2(0, -passageEndpointRadius),
    leftCylinder: new THREE.Vector2(-passageEndpointRadius, 0),
    rightCylinder: new THREE.Vector2(passageEndpointRadius, 0),
    topSupply: new THREE.Vector2(0, passageEndpointRadius),
  };

  const stateAtTime = (time) => {
    const cycleTime = positiveModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    let stage;
    let plugAngle;
    let plugAngularSpeed;
    if (phase < upperHoldEnd) {
      stage = 'upper-engraving-position-dwell';
      plugAngle = upperPositionAngle;
      plugAngularSpeed = 0;
    } else if (phase < clockwiseTransferEnd) {
      stage = 'clockwise-quarter-turn-transfer';
      const duration = (clockwiseTransferEnd - upperHoldEnd)
        * cycleDuration;
      const motion = quinticState(
        (phase - upperHoldEnd) / (clockwiseTransferEnd - upperHoldEnd),
      );
      plugAngle = -HALF_PI * motion.value;
      plugAngularSpeed = -HALF_PI * motion.rate / duration;
    } else if (phase < lowerHoldEnd) {
      stage = 'lower-engraving-position-dwell';
      plugAngle = lowerPositionAngle;
      plugAngularSpeed = 0;
    } else {
      stage = 'counterclockwise-return-quarter-turn';
      const duration = (1 - lowerHoldEnd) * cycleDuration;
      const motion = quinticState(
        (phase - lowerHoldEnd) / (1 - lowerHoldEnd),
      );
      plugAngle = -HALF_PI * (1 - motion.value);
      plugAngularSpeed = HALF_PI * motion.rate / duration;
    }
    const upperAlignmentError = Math.abs(plugAngle - upperPositionAngle);
    const lowerAlignmentError = Math.abs(plugAngle - lowerPositionAngle);
    const upperPositionActive = upperAlignmentError
      <= angularAlignmentTolerance;
    const lowerPositionActive = lowerAlignmentError
      <= angularAlignmentTolerance;
    const alignedPosition = upperPositionActive
      ? 'upper-engraving-position'
      : lowerPositionActive
        ? 'lower-engraving-position'
        : null;
    const connections = upperPositionActive
      ? [
          ['top-steam-supply', 'left-cylinder-end'],
          ['right-cylinder-end', 'bottom-exhaust'],
        ]
      : lowerPositionActive
        ? [
            ['top-steam-supply', 'right-cylinder-end'],
            ['left-cylinder-end', 'bottom-exhaust'],
          ]
        : [];
    const channelAEndpoints = [channelAStart, channelAEnd]
      .map((endpoint) => rotate2(endpoint, plugAngle));
    const channelBEndpoints = [channelBStart, channelBEnd]
      .map((endpoint) => rotate2(endpoint, plugAngle));
    return {
      alignedPosition,
      blockedDuringTransfer: alignedPosition === null,
      channelAEndpoints,
      channelAFlowDirection: upperPositionActive
        ? 1
        : lowerPositionActive ? -1 : 0,
      channelBEndpoints,
      channelBFlowDirection: upperPositionActive
        ? -1
        : lowerPositionActive ? 1 : 0,
      connections,
      cycleTime,
      lowerAlignmentError,
      lowerPositionActive,
      phase,
      plugAngle,
      plugAngularSpeed,
      stage,
      upperAlignmentError,
      upperPositionActive,
    };
  };

  function updatePassageMarkers(passage, direction, time, active) {
    passage.userData.flowCore.material.opacity = active ? 0.88 : 0.16;
    passage.userData.markers.forEach((marker, index) => {
      marker.visible = active;
      if (!active) return;
      const forwardParameter = positiveModulo(
        time / 1.45 + index / passage.userData.markers.length,
        1,
      );
      const parameter = direction > 0
        ? forwardParameter
        : 1 - forwardParameter;
      marker.position.copy(passage.userData.curve.getPoint(parameter));
      marker.position.z += 0.34;
    });
  }

  function updatePipeMarkers(group, {
    axis,
    direction,
    time,
    visible = true,
  }) {
    group.userData.markers.forEach((marker, index) => {
      marker.visible = visible;
      if (!visible) return;
      const progress = positiveModulo(
        time / 1.45 + index / group.userData.markers.length,
        1,
      );
      const directed = direction > 0 ? progress : 1 - progress;
      const coordinate = THREE.MathUtils.lerp(
        bodyOuterRadius + 0.12,
        bodyOuterRadius + pipeLength - 0.24,
        directed,
      );
      marker.position.set(axis.x * coordinate, axis.y * coordinate, 0.42);
    });
  }

  const update = (time) => {
    const state = stateAtTime(time);
    plugRotor.rotation.z = state.plugAngle;
    const routingActive = state.alignedPosition !== null;
    updatePassageMarkers(
      channelA,
      state.channelAFlowDirection,
      time,
      routingActive,
    );
    updatePassageMarkers(
      channelB,
      state.channelBFlowDirection,
      time,
      routingActive,
    );
    updatePipeMarkers(topFlow, {
      axis: new THREE.Vector2(0, 1),
      direction: -1,
      time,
      visible: routingActive,
    });
    updatePipeMarkers(bottomFlow, {
      axis: new THREE.Vector2(0, -1),
      direction: 1,
      time,
      visible: routingActive,
    });
    const upper = state.upperPositionActive;
    leftFlowMaterial.color.setHex(upper ? PALETTE.driver : PALETTE.fluid);
    rightFlowMaterial.color.setHex(upper ? PALETTE.fluid : PALETTE.driver);
    updatePipeMarkers(leftFlow, {
      axis: new THREE.Vector2(-1, 0),
      direction: upper ? 1 : -1,
      time,
      visible: routingActive,
    });
    updatePipeMarkers(rightFlow, {
      axis: new THREE.Vector2(1, 0),
      direction: upper ? -1 : 1,
      time,
      visible: routingActive,
    });
    root.userData.contacts = {
      channelA: {
        active: routingActive,
        endpoints: state.channelAEndpoints.map((point) => point.clone()),
        route: state.connections[0] ?? null,
      },
      channelB: {
        active: routingActive,
        endpoints: state.channelBEndpoints.map((point) => point.clone()),
        route: state.connections[1] ?? null,
      },
      plugToBody: {
        radialClearance: bodyInnerRadius - plugRadius,
        coaxialityError: 0,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData = {
    archetype:
      'quarter-turn-two-passage-four-way-steam-cock-alternating-admission-and-exhaust',
    blocks: {
      channels: { channelA, channelB },
      externalFlow,
      fixedBody,
      fixedQuadrant,
      handle,
      handleIndex,
      housing,
      pipes,
      plug,
      plugRotor,
      portCollars,
      stem,
    },
    constraintResiduals: {
      channelAOpposesChannelBStart:
        channelAStart.clone().add(channelBStart).length(),
      channelAOpposesChannelBEnd:
        channelAEnd.clone().add(channelBEnd).length(),
      channelAStartRadius:
        channelAStart.length() - passageEndpointRadius,
      channelAEndRadius:
        channelAEnd.length() - passageEndpointRadius,
      plugQuarterTurn:
        lowerPositionAngle - upperPositionAngle + HALF_PI,
      plugToBodyRadialClearance:
        bodyInnerRadius - plugRadius - 0.07,
      sidePortsOpposed:
        portCenters.leftCylinder.clone()
          .add(portCenters.rightCylinder).length(),
      supplyAndExhaustOpposed:
        portCenters.topSupply.clone()
          .add(portCenters.bottomExhaust).length(),
    },
    constraints: {
      body:
        'The top supply, bottom exhaust, and opposed cylinder-end ports are fixed in one four-port housing.',
      plug:
        'One close-fitting coaxial plug carries two disjoint quarter-circular passages as a rigid body.',
      routing:
        'At either indexed angle each supply route terminates at exactly one cylinder end while the opposite cylinder end terminates at exhaust; supply never connects directly to exhaust.',
      transfer:
        'The reconstruction suppresses explanatory flow indices between indexed positions because Brown does not specify transient port overlap.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'two rigid passage orientations',
        'four-way port connection map',
      ],
      independentPrescribedInputs: 1,
      inputs: ['quarter-turn angle of the cock plug'],
      note:
        'The plug has one rotational degree of freedom and two working detents separated by exactly 90 degrees.',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid close-fitting plug and housing',
        'incompressible explanatory flow markers with no pressure calculation',
        'zero leakage and zero clearance at the four indexed port interfaces',
        'transient throttling, partial overlap, pressure loss, and plug torque omitted',
        'quintic zero-speed motion between the two source positions',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless kinematic and connectivity reconstruction',
    },
    fidelity: 'authored',
    geometry: {
      angularAlignmentTolerance,
      bodyDepth,
      bodyInnerRadius,
      bodyOuterRadius,
      channelAEnd: channelAEnd.clone(),
      channelAStart: channelAStart.clone(),
      channelBEnd: channelBEnd.clone(),
      channelBStart: channelBStart.clone(),
      lowerPositionAngle,
      passageEndpointRadius,
      passageRadius,
      pipeCenterRadius,
      pipeLength,
      pipeRadius,
      plugDepth,
      plugRadius,
      portCenters,
      upperPositionAngle,
    },
    mechanism:
      'one-quarter-turn-cylindrical-plug-with-two-opposed-quarter-circular-passages-alternately-connects-top-steam-supply-to-one-cylinder-end-and-the-other-cylinder-end-to-bottom-exhaust',
    motion: {
      cycleDuration,
      lowerPosition:
        'top supply to right cylinder; left cylinder to bottom exhaust',
      return:
        'the visualization returns counterclockwise to repeat both source positions',
      transferAngle: -HALF_PI,
      upperPosition:
        'top supply to left cylinder; right cylinder to bottom exhaust',
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 395 page marks Animated unavailable and supplies only the two static plug positions.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate395: {
        imageHeight: 525,
        imageWidth: 525,
        lowerPlugApproximateCenterPixels: [167, 356],
        lowerPlugApproximateRadiusPixels: 124,
        measurementUncertaintyPixels: 6,
        upperPlugApproximateCenterPixels: [360, 173],
        upperPlugApproximateRadiusPixels: 124,
      },
      constructionEvidence: {
        engravingEvidence:
          'Both circular cross-sections show four orthogonal ports and the same pair of opposed curved plug passages; their orientations differ by one quarter-turn.',
        explicitInBrownDescription: [
          'one four-way cock formerly used on steam engines',
          'steam enters at the top',
          'the two represented positions differ by a quarter turn of the plug',
          'upper figure exhausts the right cylinder end',
          'lower figure exhausts the left cylinder end while steam enters the opposite port',
        ],
        reconstructionDisclosure:
          'No official animation, dimensions, port width, transient overlap, timing, or pressure data is supplied. The dwell timing, smooth transfer, colors, and flow indices are explanatory additions.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 395',
    },
    stateAtTime,
    timeline: {
      clockwiseTransfer: [upperHoldEnd, clockwiseTransferEnd],
      cycleDuration,
      lowerPositionDwell: [clockwiseTransferEnd, lowerHoldEnd],
      returnTransfer: [lowerHoldEnd, 1],
      upperPositionDwell: [0, upperHoldEnd],
    },
    transmission: {
      lowerConnectionMap: [
        ['top-steam-supply', 'right-cylinder-end'],
        ['left-cylinder-end', 'bottom-exhaust'],
      ],
      rigidRotationLaw:
        'p_world = R_z(plugAngle) * p_plug for every passage centerline and endpoint',
      upperConnectionMap: [
        ['top-steam-supply', 'left-cylinder-end'],
        ['right-cylinder-end', 'bottom-exhaust'],
      ],
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.42, -4.42, -0.70),
    new THREE.Vector3(4.42, 4.42, 1.12),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(6.8, 5.5, 12.5);
  root.userData.groundFloorY = -4.32;
  update(0);
  return { root, update };
}

export function createAuthoredFourWayCockMovement(movement) {
  if (movement.id !== 395) return null;
  return fourWaySteamCock(movement);
}
