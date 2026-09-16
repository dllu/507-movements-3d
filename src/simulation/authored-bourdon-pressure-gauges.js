import {correctElasticGaugeParts} from './elastic-gauge-working-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeDynamicLink,
  makeGear,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function makeDeformingStrip({
  halfDepth,
  halfWidth,
  material,
  role,
  segmentCount,
}) {
  const pointCount = segmentCount + 1;
  const positions = new Float32Array(pointCount * 4 * 3);
  const indices = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const a = index * 4;
    const b = (index + 1) * 4;
    indices.push(
      a, b, b + 1,
      a, b + 1, a + 1,
      a + 2, a + 3, b + 3,
      a + 2, b + 3, b + 2,
      a, a + 2, b + 2,
      a, b + 2, b,
      a + 1, b + 1, b + 3,
      a + 1, b + 3, a + 3,
    );
  }
  indices.push(
    0, 1, 3,
    0, 3, 2,
  );
  const end = segmentCount * 4;
  indices.push(
    end, end + 2, end + 3,
    end, end + 3, end + 1,
  );
  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setIndex(indices);
  const strip = addRole(new THREE.Mesh(geometry, material), role);
  strip.userData.halfDepth = halfDepth;
  strip.userData.halfWidth = halfWidth;
  strip.userData.segmentCount = segmentCount;
  strip.userData.setCenterline = (points) => {
    if (points.length !== pointCount) {
      throw new Error(`Expected ${pointCount} Bourdon centerline points`);
    }
    for (let index = 0; index < pointCount; index += 1) {
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(pointCount - 1, index + 1)];
      const tangent = next.clone().sub(previous).normalize();
      const normal = new THREE.Vector3(-tangent.y, tangent.x, 0);
      const center = points[index];
      const vertices = [
        center.clone().addScaledVector(normal, halfWidth)
          .add(new THREE.Vector3(0, 0, halfDepth)),
        center.clone().addScaledVector(normal, -halfWidth)
          .add(new THREE.Vector3(0, 0, halfDepth)),
        center.clone().addScaledVector(normal, halfWidth)
          .add(new THREE.Vector3(0, 0, -halfDepth)),
        center.clone().addScaledVector(normal, -halfWidth)
          .add(new THREE.Vector3(0, 0, -halfDepth)),
      ];
      for (let vertexIndex = 0; vertexIndex < 4; vertexIndex += 1) {
        const offset = (index * 4 + vertexIndex) * 3;
        positions[offset] = vertices[vertexIndex].x;
        positions[offset + 1] = vertices[vertexIndex].y;
        positions[offset + 2] = vertices[vertexIndex].z;
      }
    }
    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    strip.userData.centerlinePoints = points.map((point) => point.clone());
  };
  return strip;
}

function makeTubeCap(material, role) {
  const cap = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.25, 0.15),
    material,
  ), role);
  cap.userData.closed = true;
  return cap;
}

function setCapAtEnd(cap, points) {
  const endpoint = points.at(-1);
  const before = points.at(-2);
  const tangent = endpoint.clone().sub(before).normalize();
  cap.position.copy(endpoint);
  cap.rotation.z = Math.atan2(tangent.y, tangent.x);
}

function makeArcTube({ center, color, radius, role, start, end, z }) {
  const points = [];
  for (let index = 0; index <= 64; index += 1) {
    const angle = THREE.MathUtils.lerp(start, end, index / 64);
    points.push(new THREE.Vector3(
      center.x + radius * Math.cos(angle),
      center.y + radius * Math.sin(angle),
      z,
    ));
  }
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return addRole(new THREE.Mesh(
    new THREE.TubeGeometry(curve, 96, 0.025, 8, false),
    matte(color, { roughness: 0.58 }),
  ), role);
}

function bourdonPressureGauge(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8;
  const branchSegmentCount = 46;
  const fixedMidpoint = new THREE.Vector3(0, 2.47, 0);
  const relaxedBranchRadius = 2.5;
  const relaxedBranchArcAngle = 2.22;
  const branchArcLength = relaxedBranchRadius * relaxedBranchArcAngle;
  const maximumSectorAngle = 0.46;
  const sectorPivot = new THREE.Vector3(0, -2.10, 0.13);
  const leftSectorPinLocal = new THREE.Vector3(-0.4, 0.5, 0);
  const rightSectorPinLocal = new THREE.Vector3(0, -0.55, 0);
  const sectorPitchRadius = 0.66;
  const sectorEquivalentTeeth = 36;
  const pinionPitchRadius = 0.22;
  const pinionTeeth = 12;
  const gearRatio = sectorPitchRadius / pinionPitchRadius;
  const pinionCenter = new THREE.Vector3(
    sectorPivot.x,
    sectorPivot.y + sectorPitchRadius + pinionPitchRadius,
    0.27,
  );
  const pointerZeroAngle = 2.35;
  const maximumScaleReading = 10;
  const maximumDemonstrationPressurePascal = 1_000_000;

  const tubeMaterial = matte(PALETTE.brass, {
    metalness: 0.50,
    roughness: 0.31,
    side: THREE.DoubleSide,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.46,
  });
  const sectorMaterial = matte(PALETTE.driver, {
    metalness: 0.22,
    roughness: 0.42,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.23,
    roughness: 0.60,
  });
  const dialMaterial = matte(PALETTE.paper, {
    opacity: 0.78,
    roughness: 0.88,
    side: THREE.DoubleSide,
    transparent: true,
  });
  dialMaterial.depthWrite = false;
  const pressureMaterial = matte(PALETTE.driver, {
    opacity: 0.36,
    roughness: 0.48,
    transparent: true,
  });
  pressureMaterial.depthWrite = false;

  const branchCenterline = (side, radius) => {
    const points = [];
    const branchAngle = branchArcLength / radius;
    for (let index = 0; index <= branchSegmentCount; index += 1) {
      const angle = branchAngle * index / branchSegmentCount;
      points.push(new THREE.Vector3(
        side * radius * Math.sin(angle),
        fixedMidpoint.y - radius * (1 - Math.cos(angle)),
        0.04,
      ));
    }
    return points;
  };

  const branchEndpoint = (side, radius) => {
    const branchAngle = branchArcLength / radius;
    return new THREE.Vector3(
      side * radius * Math.sin(branchAngle),
      fixedMidpoint.y - radius * (1 - Math.cos(branchAngle)),
      0.04,
    );
  };

  const sectorPinWorld = (localPin, angle) => localPin.clone()
    .applyAxisAngle(new THREE.Vector3(0, 0, 1), angle)
    .add(sectorPivot);

  const relaxedLeftEnd = branchEndpoint(-1, relaxedBranchRadius);
  const relaxedRightEnd = branchEndpoint(1, relaxedBranchRadius);
  const leftLinkLength = relaxedLeftEnd.distanceTo(
    sectorPinWorld(leftSectorPinLocal, 0),
  );
  const rightLinkLength = relaxedRightEnd.distanceTo(
    sectorPinWorld(rightSectorPinLocal, 0),
  );

  const solveBranchRadius = (side, sectorPin, sectorAngle, linkLength) => {
    if (sectorAngle === 0) return relaxedBranchRadius;
    const targetSquared = linkLength ** 2;
    const pin = sectorPinWorld(sectorPin, sectorAngle);
    const residual = (radius) => branchEndpoint(side, radius)
      .distanceToSquared(pin) - targetSquared;
    let lower = relaxedBranchRadius;
    let upper = 4;
    if (residual(lower) > 1e-12 || residual(upper) < 0) {
      throw new Error('Bourdon linkage radius solution is not bracketed');
    }
    for (let iteration = 0; iteration < 64; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (residual(middle) > 0) upper = middle;
      else lower = middle;
    }
    return (lower + upper) / 2;
  };

  const dialFace = addRole(new THREE.Mesh(
    new THREE.CircleGeometry(3.22, 96),
    dialMaterial,
  ), 'translucent-dial-face-exposing-working-parts');
  dialFace.position.z = -0.43;
  const outerRim = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(3.32, 0.16, 16, 96),
    frameMaterial,
  ), 'fixed-round-pressure-gauge-case-rim');
  outerRim.position.z = -0.18;
  const innerRim = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(3.08, 0.045, 10, 96),
    inkMaterial,
  ), 'fixed-inner-bezel-of-pressure-gauge');
  innerRim.position.z = -0.02;

  const tubeBranches = [-1, 1].map((side) => makeDeformingStrip({
    halfDepth: 0.072,
    halfWidth: 0.135,
    material: tubeMaterial,
    role: side < 0
      ? 'left-half-of-center-fed-flattened-bourdon-tube-B'
      : 'right-half-of-center-fed-flattened-bourdon-tube-B',
    segmentCount: branchSegmentCount,
  }));
  tubeBranches.forEach((branch, index) => {
    branch.userData.branchSide = index === 0 ? -1 : 1;
    branch.userData.crossSection = {
      inPlaneDimension: 0.27,
      nonCircular: true,
      throughDepthDimension: 0.144,
    };
  });
  const tubeCaps = [
    makeTubeCap(tubeMaterial, 'closed-free-end-of-left-tube-branch'),
    makeTubeCap(tubeMaterial, 'closed-free-end-of-right-tube-branch'),
  ];
  const tubeEndPins = [-1, 1].map((side) => {
    const pin = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.28, 24),
      inkMaterial,
    ), side < 0
      ? 'left-free-tube-end-link-pin'
      : 'right-free-tube-end-link-pin');
    pin.rotation.x = Math.PI / 2;
    return pin;
  });

  const centerClamp = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.70, 0.38, 0.34),
    frameMaterial,
  ), 'fixed-clamp-C-at-middle-of-bourdon-tube');
  centerClamp.position.set(fixedMidpoint.x, fixedMidpoint.y + 0.04, 0);
  centerClamp.userData.sourceLabel = 'C';

  const pressurePassagePoints = [
    new THREE.Vector3(0, -3.78, -0.29),
    new THREE.Vector3(0, -2.92, -0.29),
    new THREE.Vector3(-0.18, -0.42, -0.29),
    new THREE.Vector3(-0.12, 1.72, -0.29),
    new THREE.Vector3(0, fixedMidpoint.y, -0.10),
  ];
  const pressurePassageCurve = new THREE.CatmullRomCurve3(
    pressurePassagePoints,
    false,
    'centripetal',
  );
  const pressurePassage = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(pressurePassageCurve, 96, 0.10, 14, false),
    frameMaterial,
  ), 'fixed-hidden-passage-from-bottom-socket-to-center-feed-C');
  const pressureCore = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(pressurePassageCurve, 96, 0.052, 12, false),
    pressureMaterial,
  ), 'visible-pressure-medium-reaching-center-feed-C');
  const inletSocket = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.31, 1.28, 32),
    frameMaterial,
  ), 'bottom-process-pressure-inlet-socket');
  inletSocket.position.set(0, -3.62, -0.25);
  const inletCollar = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.44, 0.30, 32),
    inkMaterial,
  ), 'threaded-pressure-inlet-collar');
  inletCollar.position.set(0, -3.13, -0.25);

  const sector = addRole(new THREE.Group(),
    'single-differential-toothed-sector-connected-to-both-tube-ends');
  sector.position.copy(sectorPivot);
  const sectorHub = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.25, 28),
    inkMaterial,
  ), 'fixed-pivot-bearing-of-toothed-sector');
  sectorHub.rotation.x = Math.PI / 2;
  const leftSectorArm = makeDynamicLink({
    color: PALETTE.driver,
    depth: 0.16,
    jointRadius: 0.10,
    thickness: 0.11,
  });
  leftSectorArm.userData.role = 'upper-left-input-arm-of-sector';
  leftSectorArm.userData.setEndpoints(
    new THREE.Vector3(0, 0, 0),
    leftSectorPinLocal,
  );
  const rightSectorArm = makeDynamicLink({
    color: PALETTE.driver,
    depth: 0.16,
    jointRadius: 0.10,
    thickness: 0.11,
  });
  rightSectorArm.userData.role = 'lower-input-arm-of-sector';
  rightSectorArm.userData.setEndpoints(
    new THREE.Vector3(0, 0, 0),
    rightSectorPinLocal,
  );
  const sectorAngularPitch = Math.PI * 2 / sectorEquivalentTeeth;
  const sectorToothCount = 5;
  const sectorTeeth = [];
  for (let index = 0; index < sectorToothCount; index += 1) {
    const angle = Math.PI / 2
      + (index - (sectorToothCount - 1) / 2) * sectorAngularPitch;
    const tooth = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.085, 0.17),
      sectorMaterial,
    ), `tooth-${index + 1}-of-sector-piece`);
    tooth.position.set(
      Math.cos(angle) * (sectorPitchRadius + 0.035),
      Math.sin(angle) * (sectorPitchRadius + 0.035),
      0,
    );
    tooth.rotation.z = angle - Math.PI / 2;
    tooth.userData.pitchAngle = angle;
    sectorTeeth.push(tooth);
  }
  const sectorRim = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(
      sectorPitchRadius - 0.025,
      0.09,
      10,
      28,
      sectorAngularPitch * 5.15,
    ),
    sectorMaterial,
  ), 'toothed-sector-pitch-arc');
  sectorRim.rotation.z = Math.PI / 2 - sectorAngularPitch * 2.575;
  sector.add(
    sectorHub,
    leftSectorArm,
    rightSectorArm,
    sectorRim,
    ...sectorTeeth,
  );

  const links = [
    addRole(makeDynamicLink({
      color: PALETTE.ink,
      depth: 0.12,
      jointRadius: 0.105,
      thickness: 0.075,
    }), 'rigid-link-from-left-tube-end-to-sector'),
    addRole(makeDynamicLink({
      color: PALETTE.ink,
      depth: 0.12,
      jointRadius: 0.105,
      thickness: 0.075,
    }), 'rigid-link-from-right-tube-end-to-sector'),
  ];

  const pinion = makeGear({
    color: PALETTE.ink,
    depth: 0.18,
    radius: pinionPitchRadius,
    teeth: pinionTeeth,
    toothHeight: 0.065,
  });
  pinion.userData.role = 'pointer-spindle-pinion-meshing-with-sector';
  pinion.position.copy(pinionCenter);
  const pointer = addRole(new THREE.Group(),
    'pointer-keyed-to-pinion-spindle');
  pointer.position.copy(pinionCenter);
  pointer.position.z = 0.48;
  const pointerNeedle = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(2.25, 0.055, 0.075),
    inkMaterial,
  ), 'pressure-indicating-pointer-needle');
  pointerNeedle.position.x = 1.08;
  const pointerTip = addRole(new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.30, 3),
    inkMaterial,
  ), 'pressure-pointer-arrowhead');
  pointerTip.rotation.z = -Math.PI / 2;
  pointerTip.position.x = 2.25;
  const pointerHub = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.12, 28),
    sectorMaterial,
  ), 'pointer-spindle-front-hub');
  pointerHub.rotation.x = Math.PI / 2;
  pointer.add(pointerNeedle, pointerTip, pointerHub);

  const scaleCenter = pinionCenter.clone();
  const scaleRadius = 2.34;
  const pointerMaximumAngle = pointerZeroAngle
    - maximumSectorAngle * gearRatio;
  const scaleArc = makeArcTube({
    center: scaleCenter,
    color: PALETTE.ink,
    radius: scaleRadius,
    role: 'graduated-pressure-dial-arc',
    start: pointerMaximumAngle,
    end: pointerZeroAngle,
    z: 0.03,
  });
  const scaleTicks = [];
  for (let value = 0; value <= maximumScaleReading; value += 1) {
    const fraction = value / maximumScaleReading;
    const angle = THREE.MathUtils.lerp(
      pointerZeroAngle,
      pointerMaximumAngle,
      fraction,
    );
    const major = value % 5 === 0;
    const tick = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.055, major ? 0.30 : 0.19, 0.075),
      inkMaterial,
    ), `dial-scale-mark-${value}`);
    tick.position.set(
      scaleCenter.x + scaleRadius * Math.cos(angle),
      scaleCenter.y + scaleRadius * Math.sin(angle),
      0.06,
    );
    tick.rotation.z = angle - Math.PI / 2;
    tick.userData.angle = angle;
    tick.userData.value = value;
    scaleTicks.push(tick);
  }

  root.add(
    dialFace,
    pressurePassage,
    pressureCore,
    inletSocket,
    inletCollar,
    outerRim,
    innerRim,
    scaleArc,
    ...scaleTicks,
    ...tubeBranches,
    ...tubeCaps,
    ...tubeEndPins,
    centerClamp,
    sector,
    ...links,
    pinion,
    pointer,
  );

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const cyclePosition = cycleTime / cycleDuration;
    const phaseAngle = Math.PI * 2 * cyclePosition;
    const pressureFraction = (1 - Math.cos(phaseAngle)) / 2;
    const pressureFractionVelocity = Math.PI / cycleDuration
      * Math.sin(phaseAngle);
    const sectorAngle = maximumSectorAngle * pressureFraction;
    const sectorAngularVelocity = maximumSectorAngle
      * pressureFractionVelocity;
    const leftRadius = solveBranchRadius(
      -1,
      leftSectorPinLocal,
      sectorAngle,
      leftLinkLength,
    );
    const rightRadius = solveBranchRadius(
      1,
      rightSectorPinLocal,
      sectorAngle,
      rightLinkLength,
    );
    const branchRadii = [leftRadius, rightRadius];
    const branchCenterlines = [
      branchCenterline(-1, leftRadius),
      branchCenterline(1, rightRadius),
    ];
    const tubeEndPoints = branchCenterlines.map((points) => points.at(-1));
    const sectorInputPins = [
      sectorPinWorld(leftSectorPinLocal, sectorAngle),
      sectorPinWorld(rightSectorPinLocal, sectorAngle),
    ];
    const pinionAngle = -sectorAngle * gearRatio;
    const pinionAngularVelocity = -sectorAngularVelocity * gearRatio;
    const pointerAngle = pointerZeroAngle + pinionAngle;
    return {
      branchArcAngles: branchRadii.map((radius) => branchArcLength / radius),
      branchCenterlines,
      branchRadii,
      cyclePosition,
      cycleTime,
      gaugePressurePascal:
        maximumDemonstrationPressurePascal * pressureFraction,
      gearPitchVelocityResidual:
        sectorAngularVelocity * sectorPitchRadius
        + pinionAngularVelocity * pinionPitchRadius,
      leftLinkLengthResidual:
        tubeEndPoints[0].distanceTo(sectorInputPins[0]) - leftLinkLength,
      pinionAngle,
      pinionAngularVelocity,
      pointerAngle,
      pressureFraction,
      pressureFractionVelocity,
      rightLinkLengthResidual:
        tubeEndPoints[1].distanceTo(sectorInputPins[1]) - rightLinkLength,
      scaleReading: maximumScaleReading * pressureFraction,
      sectorAngle,
      sectorAngularVelocity,
      sectorInputPins,
      tubeEndPoints,
    };
  };

  root.userData.archetype =
    'center-fed-double-ended-bourdon-tube-differential-sector-pinion-gauge';
  root.userData.mechanism =
    'pressure-straightens-both-halves-of-flattened-center-fixed-tube-B-two-rigid-links-turn-one-sector-and-the-sector-drives-the-pointer-pinion';
  root.userData.blocks = {
    centerClamp,
    dialFace,
    innerRim,
    inletCollar,
    inletSocket,
    leftSectorArm,
    links,
    outerRim,
    pinion,
    pointer,
    pointerHub,
    pointerNeedle,
    pointerTip,
    pressureCore,
    pressurePassage,
    rightSectorArm,
    scaleArc,
    scaleTicks,
    sector,
    sectorHub,
    sectorRim,
    sectorTeeth,
    tubeBranches,
    tubeCaps,
    tubeEndPins,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.62, -4.34, -0.78),
    new THREE.Vector3(3.62, 3.62, 0.78),
  );
  root.userData.canonicalTimes = {
    maximumPressure: cycleDuration / 2,
    returnToZero: cycleDuration,
    sourcePose: cycleDuration * 0.34,
    zeroPressure: 0,
  };
  root.userData.degreesOfFreedom = {
    independentPointerCoordinates: 0,
    independentPressureInputs: 1,
    independentSectorCoordinates: 0,
    independentTubeBranchCoordinates: 0,
  };
  root.userData.geometry = {
    branchArcLength,
    branchSegmentCount,
    cycleDuration,
    fixedMidpoint,
    maximumScaleReading,
    maximumSectorAngle,
    pinionCenter,
    pinionPitchRadius,
    relaxedBranchArcAngle,
    relaxedBranchRadius,
    sectorPitchRadius,
    sectorPivot,
  };
  root.userData.linkage = {
    leftLinkLength,
    leftSectorPinLocal,
    rightLinkLength,
    rightSectorPinLocal,
    solver:
      'each elastic branch radius is solved by bisection so its rigid end link closes exactly on the one rotating sector',
  };
  root.userData.sourceAnimation = {
    available: false,
    officialCanvasModelPresent: false,
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    bourdonPatentCorroboration: {
      detail:
        'Bourdon states that a flattened thin metallic tube changes form with internal pressure, that increased pressure tends to straighten it, and that its motion may be transmitted by a toothed sector and pinion.',
      patent: 'Eugene Bourdon, US Patent 9,163 (1852)',
      url: 'https://patents.google.com/patent/US9163A/en',
    },
    brownSpecificity:
      'Brown’s plate and caption specifically show tube B fixed at its middle C, both ends free and closed, both ends linked to one toothed sector, and that sector meshing with the pointer pinion. This differs from the patent’s common one-fixed-end pressure-gauge arrangement and is modeled as drawn.',
    officialDescription: movement.description,
    officialEngraving: './engravings/mm_499.png',
    officialInlineModelUrl: movement.sourceUrl,
    reconstructionDisclosure:
      'The official page marks Animated unavailable. Brown fixes topology and motion sense but not tube section, elastic constants, tooth counts, linkage dimensions, pressure range, or timing. The noncircular 0.27-by-0.144 tube, exact rigid-link closure, 36:12 sector/pinion pitch ratio, 0-to-1 MPa eight-second demonstration, hidden inlet passage, depth, colors, and supports are explicit reconstruction choices.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    externalMeshEquation:
      'sectorAngularVelocity * sectorPitchRadius + pinionAngularVelocity * pinionPitchRadius = 0',
    gearRatio,
    maximumDemonstrationPressurePascal,
    pinionTeeth,
    pointerTurnsWithPinion: true,
    sectorEquivalentTeeth,
  };
  root.userData.cameraDistanceScale = 1.02;

  const update = (time) => {
    const state = stateAtTime(time);
    tubeBranches.forEach((branch, index) => {
      branch.userData.setCenterline(state.branchCenterlines[index]);
      branch.userData.radiusOfCurvature = state.branchRadii[index];
      setCapAtEnd(tubeCaps[index], state.branchCenterlines[index]);
      tubeEndPins[index].position.copy(state.tubeEndPoints[index]);
    });
    sector.rotation.z = state.sectorAngle;
    links[0].userData.setEndpoints(
      state.tubeEndPoints[0],
      state.sectorInputPins[0],
    );
    links[1].userData.setEndpoints(
      state.tubeEndPoints[1],
      state.sectorInputPins[1],
    );
    setSpin(pinion, state.pinionAngle);
    pointer.rotation.z = state.pointerAngle;
    pressureCore.material.opacity = 0.10 + 0.52 * state.pressureFraction;
    pressureCore.userData.gaugePressurePascal = state.gaugePressurePascal;
    root.userData.kinematics = state;
  };
  update(0);
  root.userData.fidelity = 'authored';
  correctElasticGaugeParts(root,499,update);
  markShadows(root);
  dialFace.castShadow = false;
  pressureCore.castShadow = false;
  return {
    root,
    update,
    cameraDirection: root.userData.cameraDirection,
  };
}

export function createAuthoredBourdonPressureGaugeMovement(movement) {
  if (movement.id !== 499) return null;
  return bourdonPressureGauge(movement);
}
