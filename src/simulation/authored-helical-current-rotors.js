import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import { correctWindRotorWorkingParts } from './wind-rotor-working-parts.js';

const FULL_TURN = Math.PI * 2;

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function cylinderBetween(start, end, radius, material, role, sides = 24) {
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), sides),
    material,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  mesh.userData.role = role;
  return mesh;
}

function helicalPoint({
  handedness,
  length,
  radius,
  startAngle,
  turns,
  u,
}) {
  const angle = startAngle + handedness * FULL_TURN * turns * u;
  return new THREE.Vector3(
    THREE.MathUtils.lerp(-length / 2, length / 2, u),
    radius * Math.cos(angle),
    radius * Math.sin(angle),
  );
}

function helicalRibbonGeometry({
  handedness,
  innerRadius,
  length,
  outerRadius,
  segments,
  startAngle,
  turns,
}) {
  const positions = [];
  const indices = [];
  for (let index = 0; index <= segments; index += 1) {
    const u = index / segments;
    const inner = helicalPoint({
      handedness,
      length,
      radius: innerRadius,
      startAngle,
      turns,
      u,
    });
    const outer = helicalPoint({
      handedness,
      length,
      radius: outerRadius,
      startAngle,
      turns,
      u,
    });
    positions.push(...inner.toArray(), ...outer.toArray());
    if (index < segments) {
      const base = index * 2;
      if (handedness > 0) {
        indices.push(base, base + 1, base + 3, base, base + 3, base + 2);
      } else {
        indices.push(base, base + 3, base + 1, base, base + 2, base + 3);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = {
    handedness,
    innerRadius,
    length,
    outerRadius,
    segments,
    startAngle,
    turns,
  };
  return geometry;
}

function makeFlowArrow({ material, position, role }) {
  const group = addRole(new THREE.Group(), role);
  group.position.copy(position);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.78, 14),
    material,
  );
  shaft.rotation.z = -Math.PI / 2;
  shaft.position.x = -0.18;
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.28, 18),
    material,
  );
  head.rotation.z = -Math.PI / 2;
  head.position.x = 0.34;
  group.add(shaft, head);
  return group;
}

function helicalCurrentRotor(movement) {
  const root = new THREE.Group();
  const helixHandedness = 1;
  const helixTurns = 1;
  const helixStartAngleRadian = 0;
  const cylinderLengthSceneUnit = 4.00;
  const coreRadiusSceneUnit = 0.58;
  const outerRadiusSceneUnit = 1.34;
  const helixSegments = 192;
  const axisHeightSceneUnit = 0.28;
  const physicalPitchMetre = 0.80;
  const physicalCoreRadiusMetre = 0.14;
  const physicalOuterRadiusMetre = 0.32;
  const axialFlowSpeedMetrePerSecond = 0.80;
  const axialToRotorCoupling = 1 / 6;
  const workingFluidDensityKilogramPerCubicMetre = 998;
  const torqueCoefficient = 0.22;
  const shaftAngularVelocityRadianPerSecond = -helixHandedness
    * FULL_TURN * axialToRotorCoupling
    * axialFlowSpeedMetrePerSecond / physicalPitchMetre;
  const cycleDuration = FULL_TURN
    / Math.abs(shaftAngularVelocityRadianPerSecond);
  const physicalMeanBladeRadiusMetre = (
    physicalCoreRadiusMetre + physicalOuterRadiusMetre
  ) / 2;
  const bladePitchAngleRadian = Math.atan(
    physicalPitchMetre / (FULL_TURN * physicalMeanBladeRadiusMetre),
  );
  const sweptAnnulusAreaSquareMetre = Math.PI * (
    physicalOuterRadiusMetre ** 2 - physicalCoreRadiusMetre ** 2
  );
  const flowDynamicPressurePascal = 0.5
    * workingFluidDensityKilogramPerCubicMetre
    * axialFlowSpeedMetrePerSecond ** 2;
  const drivingTorqueMagnitudeNewtonMetre = torqueCoefficient
    * flowDynamicPressurePascal
    * sweptAnnulusAreaSquareMetre
    * physicalOuterRadiusMetre;
  const drivingTorqueXNewtonMetre = -helixHandedness
    * drivingTorqueMagnitudeNewtonMetre;
  const resistingLoadTorqueXNewtonMetre = -drivingTorqueXNewtonMetre;
  const shaftPowerWatt = drivingTorqueXNewtonMetre
    * shaftAngularVelocityRadianPerSecond;
  const tipSpeedRatio = Math.abs(shaftAngularVelocityRadianPerSecond)
    * physicalOuterRadiusMetre / axialFlowSpeedMetrePerSecond;
  const markerPacketAdvanceMetre = axialFlowSpeedMetrePerSecond
    * cycleDuration / 4;
  const markersPerPath = 5;

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    const rotorAngleRadian = shaftAngularVelocityRadianPerSecond * time;
    const axialFluidDisplacementMetre = axialFlowSpeedMetrePerSecond * time;
    return {
      axialFluidDisplacementMetre,
      axialFlowSpeedMetrePerSecond,
      cycleTime,
      drivingTorqueXNewtonMetre,
      loadWheelAngleRadian: rotorAngleRadian,
      markerTravelTurns: axialFluidDisplacementMetre
        / markerPacketAdvanceMetre,
      phase,
      resistingLoadTorqueXNewtonMetre,
      rotorAngleRadian,
      shaftAngularVelocityRadianPerSecond,
      shaftPowerWatt,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.38,
  });
  const coreMaterial = matte(PALETTE.driven, {
    metalness: 0.24,
    roughness: 0.40,
  });
  const bladeMaterial = matte(PALETTE.accent, {
    metalness: 0.22,
    opacity: 0.82,
    roughness: 0.38,
    side: THREE.DoubleSide,
    transparent: true,
  });
  bladeMaterial.depthWrite = false;
  const flowMaterial = matte(PALETTE.fluid, {
    opacity: 0.42,
    roughness: 0.26,
    transparent: true,
  });
  flowMaterial.depthWrite = false;
  const markerMaterial = matte(PALETTE.white, {
    opacity: 0.96,
    roughness: 0.20,
    transparent: true,
  });
  markerMaterial.depthWrite = false;

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(6.35, 0.18, 2.32),
    frameMaterial,
  ), 'fixed-base-under-helical-current-rotor');
  base.position.y = -1.82;
  root.add(base);
  const supportXs = [-2.34, 2.34];
  const supports = supportXs.map((x, index) => {
    const support = addRole(new THREE.Group(),
      `fixed-bearing-pedestal-${index + 1}`);
    const upright = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 2.04, 0.64),
      frameMaterial,
    );
    upright.position.set(x, -0.77, 0);
    const shoulder = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.30, 0.82),
      frameMaterial,
    );
    shoulder.position.set(x, axisHeightSceneUnit - 0.18, 0);
    support.add(upright, shoulder);
    root.add(support);
    return { shoulder, support, upright };
  });
  const bearings = supportXs.map((x, index) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.075, 12, 36),
      darkMaterial,
    );
    bearing.rotation.y = Math.PI / 2;
    bearing.position.set(x, axisHeightSceneUnit, 0);
    bearing.userData.role = `fixed-journal-bearing-${index + 1}`;
    root.add(bearing);
    return bearing;
  });

  const rotor = addRole(new THREE.Group(),
    'one-rigid-helical-ribbon-cylinder-and-shaft-rotor');
  rotor.position.y = axisHeightSceneUnit;
  root.add(rotor);
  const shaft = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 5.72, 28),
    darkMaterial,
  ), 'single-horizontal-output-shaft-through-both-bearings');
  shaft.rotation.z = Math.PI / 2;
  rotor.add(shaft);
  const coreCylinder = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      coreRadiusSceneUnit,
      coreRadiusSceneUnit,
      cylinderLengthSceneUnit,
      64,
    ),
    coreMaterial,
  ), 'central-cylinder-around-which-the-spiral-is-wound');
  coreCylinder.rotation.z = Math.PI / 2;
  rotor.add(coreCylinder);
  const endCollars = [-1, 1].map((side, index) => {
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.70, 0.70, 0.13, 48),
      darkMaterial,
    );
    collar.rotation.z = Math.PI / 2;
    collar.position.x = side * cylinderLengthSceneUnit / 2;
    collar.userData.role = `rigid-end-collar-${index + 1}`;
    rotor.add(collar);
    return collar;
  });

  const bladeGeometry = helicalRibbonGeometry({
    handedness: helixHandedness,
    innerRadius: coreRadiusSceneUnit,
    length: cylinderLengthSceneUnit,
    outerRadius: outerRadiusSceneUnit,
    segments: helixSegments,
    startAngle: helixStartAngleRadian,
    turns: helixTurns,
  });
  const helicalBlade = addRole(new THREE.Mesh(
    bladeGeometry,
    bladeMaterial,
  ), 'single-one-turn-radial-helical-ribbon');
  rotor.add(helicalBlade);
  const makeHelicalEdge = (radius, role) => {
    const points = Array.from(
      { length: helixSegments + 1 },
      (_, index) => helicalPoint({
        handedness: helixHandedness,
        length: cylinderLengthSceneUnit,
        radius,
        startAngle: helixStartAngleRadian,
        turns: helixTurns,
        u: index / helixSegments,
      }),
    );
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const edge = new THREE.Mesh(
      new THREE.TubeGeometry(curve, helixSegments, 0.045, 10, false),
      darkMaterial,
    );
    edge.userData.role = role;
    // Brown inks the ribbon's edges only because the plate is a line drawing;
    // the dark edge tubes stay as hidden references.
    edge.visible = false;
    edge.userData.retiredInkOutline = true;
    rotor.add(edge);
    return { curve, edge };
  };
  const innerBladeEdge = makeHelicalEdge(
    coreRadiusSceneUnit,
    'inner-helical-edge-fixed-to-cylinder',
  );
  const outerBladeEdge = makeHelicalEdge(
    outerRadiusSceneUnit,
    'outer-free-edge-of-single-helical-ribbon',
  );
  const bladeEndRails = [0, 1].map((u, index) => {
    const inner = helicalPoint({
      handedness: helixHandedness,
      length: cylinderLengthSceneUnit,
      radius: coreRadiusSceneUnit,
      startAngle: helixStartAngleRadian,
      turns: helixTurns,
      u,
    });
    const outer = helicalPoint({
      handedness: helixHandedness,
      length: cylinderLengthSceneUnit,
      radius: outerRadiusSceneUnit,
      startAngle: helixStartAngleRadian,
      turns: helixTurns,
      u,
    });
    const rail = cylinderBetween(
      inner,
      outer,
      0.045,
      darkMaterial,
      `radial-end-edge-of-ribbon-${index + 1}`,
      12,
    );
    rail.visible = false;
    rail.userData.retiredInkOutline = true;
    rotor.add(rail);
    return rail;
  });

  const bladeMarkerParameter = 0.19;
  const bladeMarker = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 20, 14),
    markerMaterial,
  ), 'white-index-marker-rigidly-fixed-to-helical-ribbon');
  bladeMarker.position.copy(helicalPoint({
    handedness: helixHandedness,
    length: cylinderLengthSceneUnit,
    radius: outerRadiusSceneUnit,
    startAngle: helixStartAngleRadian,
    turns: helixTurns,
    u: bladeMarkerParameter,
  }));
  rotor.add(bladeMarker);

  const loadWheel = addRole(new THREE.Group(),
    'rigid-load-wheel-on-output-shaft');
  loadWheel.position.x = 2.77;
  const loadWheelDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.58, 0.16, 44),
    coreMaterial,
  );
  loadWheelDisc.rotation.z = Math.PI / 2;
  const loadWheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.055, 12, 44),
    darkMaterial,
  );
  loadWheelRim.rotation.y = Math.PI / 2;
  const loadWheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.10, 0.10),
    markerMaterial,
  );
  loadWheelIndex.position.set(0.10, 0.48, 0);
  loadWheel.add(loadWheelDisc, loadWheelRim, loadWheelIndex);
  rotor.add(loadWheel);

  const flowOffsets = [
    [-0.88, -0.47],
    [-0.52, 0.72],
    [-0.08, -0.92],
    [0.38, 0.88],
    [0.82, -0.52],
  ];
  const flowCurves = [];
  const flowMarkerSets = [];
  for (let pathIndex = 0; pathIndex < flowOffsets.length; pathIndex += 1) {
    const [offsetY, z] = flowOffsets[pathIndex];
    const y = axisHeightSceneUnit + offsetY;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.55, y, z),
      new THREE.Vector3(-1.65, y, z),
      new THREE.Vector3(1.65, y, z),
      new THREE.Vector3(3.55, y, z),
    ], false, 'centripetal');
    flowCurves.push(curve);
    const markers = Array.from({ length: markersPerPath }, (_, index) => {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 18, 12),
        markerMaterial,
      );
      marker.userData.role =
        `axial-current-marker-path-${pathIndex + 1}-${index + 1}`;
      root.add(marker);
      return marker;
    });
    flowMarkerSets.push(markers);
  }
  const markerProgress = (turns, pathIndex, markerIndex) =>
    THREE.MathUtils.euclideanModulo(
      turns + markerIndex / markersPerPath
        + pathIndex / (flowOffsets.length * markersPerPath),
      1,
    );

  const flowArrows = [-0.78, 0, 0.78].map((offsetY, index) => {
    const arrow = makeFlowArrow({
      material: flowMaterial,
      position: new THREE.Vector3(
        -3.20,
        axisHeightSceneUnit + offsetY,
        1.16,
      ),
      role: `fixed-positive-x-current-direction-arrow-${index + 1}`,
    });
    root.add(arrow);
    return arrow;
  });

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.x = state.rotorAngleRadian;
    for (let pathIndex = 0; pathIndex < flowMarkerSets.length; pathIndex += 1) {
      const markers = flowMarkerSets[pathIndex];
      for (let markerIndex = 0; markerIndex < markers.length; markerIndex += 1) {
        const progress = markerProgress(
          state.markerTravelTurns,
          pathIndex,
          markerIndex,
        );
        markers[markerIndex].position.copy(
          flowCurves[pathIndex].getPointAt(progress),
        );
        markers[markerIndex].scale.setScalar(
          Math.sin(Math.PI * progress) ** 0.48,
        );
      }
    }
  };

  const geometry = {
    axialFlowSpeedMetrePerSecond,
    axialToRotorCoupling,
    bladeMarkerParameter,
    bladePitchAngleRadian,
    coreRadiusSceneUnit,
    cycleDuration,
    cylinderLengthSceneUnit,
    flowDynamicPressurePascal,
    helixHandedness,
    helixSegments,
    helixStartAngleRadian,
    helixTurns,
    markerPacketAdvanceMetre,
    markersPerPath,
    outerRadiusSceneUnit,
    physicalCoreRadiusMetre,
    physicalMeanBladeRadiusMetre,
    physicalOuterRadiusMetre,
    physicalPitchMetre,
    shaftAngularVelocityRadianPerSecond,
    sweptAnnulusAreaSquareMetre,
    tipSpeedRatio,
    torqueCoefficient,
    workingFluidDensityKilogramPerCubicMetre,
  };
  const helixPointScene = (u, radius) => helicalPoint({
    handedness: helixHandedness,
    length: cylinderLengthSceneUnit,
    radius,
    startAngle: helixStartAngleRadian,
    turns: helixTurns,
    u,
  });

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'single-one-turn-radial-helical-ribbon-around-horizontal-cylinder-axial-flow-to-rigid-shaft-rotation',
    blocks: {
      base,
      bearings,
      bladeEndRails,
      bladeMarker,
      coreCylinder,
      endCollars,
      flowArrows,
      flowMarkerSets,
      helicalBlade,
      innerBladeEdge,
      loadWheel,
      loadWheelIndex,
      outerBladeEdge,
      rotor,
      shaft,
      supports,
    },
    degreesOfFreedom: {
      independentOperatingCoordinates: 1,
      loadWheelRotationRigidWithShaft: 1,
      rotorRotationAboutHorizontalAxis: 1,
    },
    dynamics: {
      assumptionScope:
        'The engraving gives no dimensions, flow speed, load, pitch, efficiency, or absolute rate. The displayed water-current operating point uses a quasi-steady torque coefficient and a disclosed axial-to-rotor coupling; it is a mechanically signed demonstration rather than CFD.',
      energyBalance:
        'At the displayed steady speed, current torque and shaft angular velocity have the same negative-X sign, so tau_x*omega_x is positive extracted shaft power. An equal opposite load torque represents the driven machine.',
      markerContinuity:
        'White current packets advance from the analytic integral U*t of axial fluid speed and use getPointAt arc-length sampling on uninterrupted positive-X paths, with smooth endpoint fades.',
      reciprocalScrewAction:
        'For the rendered right-handed helix, positive-X axial flow produces negative-X shaft rotation. Reversing either flow or handedness reverses the rotation sign.',
      singleFlight:
        'Exactly one radial helical ribbon makes exactly one turn from the left end of the central cylinder to the right; no duplicate or hidden second flight is present.',
    },
    fidelity: 'authored',
    flow: {
      direction: new THREE.Vector3(1, 0, 0),
      flowCurves,
      markerProgress,
    },
    geometry,
    helixPointScene,
    mechanism:
      'One continuous radial spiral flight is wound exactly once around one horizontal cylinder and is rigid with its shaft. A positive-X axial stream meets the inclined helical surface and supplies torque about the same axis; for the displayed right-handed winding the shaft turns in the negative-X sense. Both journals and the external load wheel share the rotor angle exactly. White packets show the uninterrupted axial current, while fixed arrows distinguish stream direction from rotor direction.',
    motion: {
      axialFlowDirection: new THREE.Vector3(1, 0, 0),
      rotationAxis: new THREE.Vector3(1, 0, 0),
      rotationSenseViewedFromPositiveX: 'clockwise',
      shaftAngularVelocityVector: new THREE.Vector3(
        shaftAngularVelocityRadianPerSecond,
        0,
        0,
      ),
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 484 HTML marks Animated unavailable and supplies only Brown’s engraving and one-sentence caption.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate484: {
        approximateAxisEndpointsPixels: [[68, 283], [463, 283]],
        approximateCylinderBoundsPixels: [111, 238, 398, 330],
        approximateHelixOuterExtremaPixels: [112, 153, 395, 420],
        approximateLeftBearingPixels: [91, 283],
        approximateRightBearingPixels: [431, 283],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 14,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'there is one spiral',
          'the spiral is wound around a cylinder',
          'wind can drive it',
          'a stream of water can drive it',
          'the output is rotary motion',
        ],
        engravingEvidence:
          'Brown’s elevation shows one horizontal cylindrical core on a through-shaft in two pedestal bearings and one broad spiral sheet whose outer edge is high at both ends and low near midspan, the projection of one complete turn.',
        fullerCorroboration:
          'John Douglas Pitts Fuller’s 1834 Key to the Analytical Table of Mechanical Movements, items 23–24, states that a spiral wound round a cylinder converts wind or a stream into circular motion. Brown’s caption is a near-verbatim later statement of that earlier kinematic example.',
        reconstructionDisclosure:
          'The one spiral, one cylinder, horizontal supported shaft, full-turn projected shape, and wind-or-water-to-rotation function are source-grounded. Right-handedness, positive-X water demonstration, radial flight profile, physical pitch and radii, flow speed, torque coefficient, coupling, power, dimensions, load wheel, particles, colors, and timing are independently engineered and exposed.',
      },
      fullerKeyUrl:
        'https://books.google.com/books/about/A_Key_to_the_Analytical_Table_of_Mechani.html?id=zfbIl5EO76AC',
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 484',
    },
    stateAtTime,
    transmission: {
      angularSpeedEquation:
        'omega_x=-handedness*(2*pi)*k_coupling*U_axial/pitch',
      helixEquation:
        'x=L*(u-1/2); y=r*cos(theta0+h*2*pi*N*u); z=r*sin(theta0+h*2*pi*N*u)',
      powerEquation:
        'P_shaft=tau_x*omega_x>0 at the displayed steady operating point',
      rigidShaftConstraint:
        'theta_cylinder=theta_spiral=theta_shaft=theta_load_wheel',
      torqueEquation:
        'abs(tau_x)=C_Q*(rho*U^2/2)*pi*(R_outer^2-R_core^2)*R_outer',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.78, -2.05, -2.05),
    new THREE.Vector3(3.78, 2.30, 2.05),
  );
  root.userData.cameraDistanceScale = 1.14;
  root.userData.cameraDirection = new THREE.Vector3(8.4, 4.4, 11.5);
  root.userData.groundFloorY = -2.05;
  correctWindRotorWorkingParts(root, 484);
  markShadows(root);
  helicalBlade.castShadow = false;
  for (const arrow of flowArrows) {
    arrow.traverse((object) => {
      if (object.isMesh) object.castShadow = false;
    });
  }
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredHelicalCurrentRotorMovement(movement) {
  if (movement.id !== 484) return null;
  return helicalCurrentRotor(movement);
}
