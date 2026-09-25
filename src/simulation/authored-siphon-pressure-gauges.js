import * as THREE from 'three';
import {correctMercuryInstrument} from './mercury-instrument-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function setVerticalColumn(mesh, bottom, top) {
  const height = Math.max(0.001, top - bottom);
  mesh.position.y = (bottom + top) / 2;
  mesh.scale.y = height;
}

function makeTubeAlong(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  return addRole(new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      Math.max(48, points.length * 5),
      radius,
      20,
      false,
    ),
    material,
  ), role);
}

function lowerBendPoints(radius, tangentY, z = 0) {
  const points = [];
  for (let index = 0; index <= 32; index += 1) {
    const angle = Math.PI + Math.PI * index / 32;
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      tangentY + Math.sin(angle) * radius,
      z,
    ));
  }
  return points;
}

const DIGIT_SEGMENTS = Object.freeze({
  0: ['a', 'b', 'c', 'd', 'e', 'f'],
  1: ['b', 'c'],
  2: ['a', 'b', 'g', 'e', 'd'],
  3: ['a', 'b', 'g', 'c', 'd'],
  4: ['f', 'g', 'b', 'c'],
  5: ['a', 'f', 'g', 'c', 'd'],
  6: ['a', 'f', 'g', 'e', 'c', 'd'],
});

function makeScaleDigit(value, material) {
  const digit = addRole(new THREE.Group(), `scale-numeral-${value}`);
  const placements = {
    a: [0, 0.15, 0, 0],
    b: [0.09, 0.075, 0, Math.PI / 2],
    c: [0.09, -0.075, 0, Math.PI / 2],
    d: [0, -0.15, 0, 0],
    e: [-0.09, -0.075, 0, Math.PI / 2],
    f: [-0.09, 0.075, 0, Math.PI / 2],
    g: [0, 0, 0, 0],
  };
  for (const segmentName of DIGIT_SEGMENTS[value]) {
    const [x, y, z, rotation] = placements[segmentName];
    const segment = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.025, 0.025),
      material,
    ), `segment-${segmentName}-of-scale-numeral-${value}`);
    segment.position.set(x, y, z);
    segment.rotation.z = rotation;
    digit.add(segment);
  }
  digit.userData.value = value;
  return digit;
}

function siphonPressureGauge(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8;
  const legCenterX = 0.76;
  const bendTangentY = -2.42;
  const tubeTopY = 3.02;
  const datumY = -0.18;
  const scaleSpacing = 0.47;
  const maximumScaleReading = 4;
  const maximumSurfaceDisplacement =
    scaleSpacing * maximumScaleReading;
  const innerBoreRadius = 0.118;
  const glassOuterRadius = 0.19;
  const sceneMetresPerUnit = 0.2;
  const mercuryDensityKilogramsPerCubicMetre = 13545.8924;
  const standardGravityMetresPerSecondSquared = 9.80665;
  const atmosphericPressurePascal = 101325;
  const equalLegAreaSceneSquared = Math.PI * innerBoreRadius ** 2;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.64,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.46,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.42,
    roughness: 0.36,
  });
  // An ivory scale board, distinct from the page, carries the marks.
  const scaleMaterial = matte(0xe6dcc3, {
    roughness: 0.86,
  });
  const scaleInkMaterial = matte(PALETTE.ink, {
    roughness: 0.54,
  });
  const mercuryMaterial = matte(PALETTE.muted, {
    metalness: 0.82,
    roughness: 0.16,
  });
  const glassMaterial = matte(0xb9dae4, {
    opacity: 0.27,
    roughness: 0.16,
    side: THREE.DoubleSide,
    transparent: true,
  });
  glassMaterial.depthWrite = false;
  const steamMaterial = matte(PALETTE.driver, {
    opacity: 0.38,
    roughness: 0.48,
    transparent: true,
  });
  steamMaterial.depthWrite = false;

  const glassLegs = [-1, 1].map((side) => {
    const leg = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(
        glassOuterRadius,
        glassOuterRadius,
        1,
        28,
        1,
        true,
      ),
      glassMaterial,
    ), side < 0
      ? 'connected-left-glass-leg-subjected-to-boiler-pressure'
      : 'open-right-glass-leg-adjacent-to-scale');
    leg.position.set(
      side * legCenterX,
      (bendTangentY + tubeTopY) / 2,
      0,
    );
    leg.scale.y = tubeTopY - bendTangentY;
    leg.userData.crossSectionArea = equalLegAreaSceneSquared;
    return leg;
  });
  const glassBend = makeTubeAlong(
    lowerBendPoints(legCenterX, bendTangentY),
    glassOuterRadius,
    glassMaterial,
    'transparent-lower-u-bend-of-equal-bore-glass-tube',
  );

  const mercuryColumns = [-1, 1].map((side) => {
    const column = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(
        innerBoreRadius,
        innerBoreRadius,
        1,
        24,
      ),
      mercuryMaterial,
    ), side < 0
      ? 'mercury-column-under-boiler-pressure-in-left-leg'
      : 'mercury-column-under-atmospheric-pressure-in-right-leg');
    column.position.x = side * legCenterX;
    column.position.z = 0;
    column.userData.crossSectionArea = equalLegAreaSceneSquared;
    return column;
  });
  const mercuryBend = makeTubeAlong(
    lowerBendPoints(legCenterX, bendTangentY),
    innerBoreRadius,
    mercuryMaterial,
    'continuous-mercury-through-lower-u-bend',
  );
  const menisci = [-1, 1].map((side) => {
    const meniscus = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(innerBoreRadius * 1.015, 24, 12),
      mercuryMaterial,
    ), side < 0
      ? 'left-mercury-free-surface-meniscus'
      : 'right-mercury-free-surface-meniscus');
    meniscus.position.x = side * legCenterX;
    meniscus.scale.y = 0.22;
    return meniscus;
  });

  const openLegRim = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(
      glassOuterRadius,
      0.035,
      12,
      36,
    ),
    glassMaterial,
  ), 'open-to-atmosphere-rim-of-right-leg');
  openLegRim.rotation.x = Math.PI / 2;
  openLegRim.position.set(legCenterX, tubeTopY, 0);
  openLegRim.userData.openToAtmosphere = true;

  const pressurePipePoints = [
    new THREE.Vector3(-3.72, 2.72, 0),
    new THREE.Vector3(-2.85, 2.72, 0),
    new THREE.Vector3(-1.28, 2.72, 0),
    new THREE.Vector3(-0.87, 2.83, 0),
    new THREE.Vector3(-legCenterX, tubeTopY, 0),
  ];
  const pressureConnection = makeTubeAlong(
    pressurePipePoints,
    0.245,
    inkMaterial,
    'sealed-pressure-pipe-from-boiler-to-left-leg',
  );
  const pressureCore = makeTubeAlong(
    pressurePipePoints,
    0.125,
    steamMaterial,
    'visible-pressurized-steam-within-connection',
  );
  pressureConnection.userData.connectedLeg = 'left';

  const boilerFlange = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.16, 32),
    inkMaterial,
  ), 'boiler-or-apparatus-connection-flange');
  boilerFlange.rotation.z = Math.PI / 2;
  boilerFlange.position.set(-3.72, 2.72, 0);

  const valveStem = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.65, 20),
    brassMaterial,
  ), 'pressure-isolation-valve-stem');
  valveStem.position.set(-2.53, 3.05, 0);
  const valveHandle = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.055, 10, 28),
    brassMaterial,
  ), 'pressure-isolation-valve-handwheel');
  valveHandle.rotation.x = Math.PI / 2;
  valveHandle.position.set(-2.53, 3.38, 0);

  const scaleBottom = datumY - 0.28;
  const scaleTop = datumY + 6 * scaleSpacing + 0.28;
  const scaleBoard = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(1.13, scaleTop - scaleBottom, 0.11),
    scaleMaterial,
  ), 'fixed-zero-through-six-pressure-scale-board');
  // The board stands just behind the tube plane; its marks read from the
  // front only (the board hides them from behind).
  scaleBoard.position.set(1.72, (scaleBottom + scaleTop) / 2, -0.06);
  const scaleSpine = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.035, scaleTop - scaleBottom - 0.12, 0.045),
    scaleInkMaterial,
  ), 'vertical-pressure-scale-spine');
  scaleSpine.position.set(1.28, (scaleBottom + scaleTop) / 2, 0.01);
  const scaleTicks = [];
  const scaleNumerals = [];
  for (let value = 0; value <= 6; value += 1) {
    const y = datumY + value * scaleSpacing;
    const tick = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(value === 0 ? 0.43 : 0.34, 0.038, 0.05),
      scaleInkMaterial,
    ), `scale-mark-${value}`);
    tick.position.set(value === 0 ? 1.48 : 1.435, y, 0.02);
    tick.userData.value = value;
    const numeral = makeScaleDigit(value, scaleInkMaterial);
    numeral.position.set(2.00, y, 0.004);
    numeral.scale.setScalar(0.72);
    scaleTicks.push(tick);
    scaleNumerals.push(numeral);
  }
  const zeroDatumIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.025, 0.035),
    brassMaterial,
  ), 'equal-level-zero-datum-across-both-legs');
  zeroDatumIndex.position.set(0, datumY, -0.23);

  const readingPointer = addRole(new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.28, 3),
    brassMaterial,
  ), 'live-reading-index-at-right-mercury-surface');
  readingPointer.rotation.z = -Math.PI / 2;
  readingPointer.position.x = 1.16;
  readingPointer.position.z = 0.05;

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(4.7, 0.18, 0.64),
    frameMaterial,
  ), 'fixed-gauge-support-base');
  base.position.set(-0.22, -3.38, -0.22);
  const backPost = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 5.9, 0.18),
    frameMaterial,
  ), 'fixed-gauge-back-support');
  backPost.position.set(0, -0.20, -0.52);
  const tubeClamps = [-1.18, 1.05, 2.40].map((y, index) => {
    const clamp = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(1.86, 0.105, 0.12),
      brassMaterial,
    ), `fixed-u-tube-retaining-clip-${index + 1}`);
    clamp.position.set(0, y, -0.19);
    return clamp;
  });

  root.add(
    base,
    backPost,
    ...tubeClamps,
    scaleBoard,
    scaleSpine,
    ...scaleTicks,
    ...scaleNumerals,
    zeroDatumIndex,
    ...mercuryColumns,
    mercuryBend,
    ...menisci,
    ...glassLegs,
    glassBend,
    openLegRim,
    pressureConnection,
    pressureCore,
    boilerFlange,
    valveStem,
    valveHandle,
    readingPointer,
  );

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const cyclePosition = cycleTime / cycleDuration;
    const phaseAngle = Math.PI * 2 * cyclePosition;
    const pressureFraction = (1 - Math.cos(phaseAngle)) / 2;
    const pressureFractionVelocity = Math.PI / cycleDuration
      * Math.sin(phaseAngle);
    const scaleReading = maximumScaleReading * pressureFraction;
    const surfaceDisplacement = scaleSpacing * scaleReading;
    const leftSurfaceY = datumY - surfaceDisplacement;
    const rightSurfaceY = datumY + surfaceDisplacement;
    const mercuryHeadDifferenceScene = rightSurfaceY - leftSurfaceY;
    const mercuryHeadDifferenceMetres = mercuryHeadDifferenceScene
      * sceneMetresPerUnit;
    const gaugePressurePascal = mercuryDensityKilogramsPerCubicMetre
      * standardGravityMetresPerSecondSquared
      * mercuryHeadDifferenceMetres;
    const leftAbsolutePressurePascal = atmosphericPressurePascal
      + gaugePressurePascal;
    const leftColumnVolumeSceneCubed = equalLegAreaSceneSquared
      * (leftSurfaceY - bendTangentY);
    const rightColumnVolumeSceneCubed = equalLegAreaSceneSquared
      * (rightSurfaceY - bendTangentY);
    return {
      atmosphericPressurePascal,
      cyclePosition,
      cycleTime,
      gaugePressurePascal,
      hydrostaticResidualPascal: gaugePressurePascal
        - mercuryDensityKilogramsPerCubicMetre
          * standardGravityMetresPerSecondSquared
          * mercuryHeadDifferenceMetres,
      leftAbsolutePressurePascal,
      leftColumnVolumeSceneCubed,
      leftSurfaceY,
      mercuryHeadDifferenceMetres,
      mercuryHeadDifferenceScene,
      pressureFraction,
      pressureFractionVelocity,
      rightAbsolutePressurePascal: atmosphericPressurePascal,
      rightColumnVolumeSceneCubed,
      rightSurfaceY,
      scaleReading,
      surfaceDisplacement,
      totalStraightLegMercuryVolumeSceneCubed:
        leftColumnVolumeSceneCubed + rightColumnVolumeSceneCubed,
    };
  };

  const initialState = stateAtTime(0);
  root.userData.archetype =
    'equal-bore-open-atmosphere-mercury-u-tube-siphon-pressure-gauge';
  root.userData.mechanism =
    'boiler-pressure-depresses-mercury-in-connected-leg-and-raises-it-equally-in-open-scale-leg-until-rho-g-h-balances-gauge-pressure';
  root.userData.blocks = {
    backPost,
    base,
    boilerFlange,
    glassBend,
    glassLegs,
    menisci,
    mercuryBend,
    mercuryColumns,
    openLegRim,
    pressureConnection,
    pressureCore,
    readingPointer,
    scaleBoard,
    scaleNumerals,
    scaleSpine,
    scaleTicks,
    tubeClamps,
    valveHandle,
    valveStem,
    zeroDatumIndex,
  };
  // Brown's view: the cocked pipe, bent tube and scale marks (the stand,
  // clips and board are removed by source presentation).
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.95, -3.5, -0.5),
    new THREE.Vector3(2.35, 4.35, 0.5),
  );
  root.userData.canonicalTimes = {
    maximumPressure: cycleDuration / 2,
    returnToZero: cycleDuration,
    sourcePose: cycleDuration / 2,
    zeroPressure: 0,
  };
  root.userData.degreesOfFreedom = {
    independentMercurySurfaceCoordinates: 0,
    independentPressureInputs: 1,
  };
  root.userData.geometry = {
    bendTangentY,
    cycleDuration,
    datumY,
    equalLegAreaSceneSquared,
    glassOuterRadius,
    innerBoreRadius,
    legCenterX,
    maximumScaleReading,
    maximumSurfaceDisplacement,
    scaleSpacing,
    tubeTopY,
  };
  root.userData.hydrostatics = {
    atmosphericPressurePascal,
    equalBoreVolumeConservation:
      'left rise plus right rise equals zero; each surface moves by the same magnitude in the opposite direction',
    equation: 'gaugePressurePascal = mercuryDensity * gravity * verticalSurfaceDifferenceMetres',
    mercuryDensityKilogramsPerCubicMetre,
    sceneMetresPerUnit,
    standardGravityMetresPerSecondSquared,
    totalStraightLegMercuryVolumeSceneCubed:
      initialState.totalStraightLegMercuryVolumeSceneCubed,
  };
  root.userData.sourceAnimation = {
    available: false,
    officialCanvasModelPresent: false,
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    metrologyCorroboration: {
      detail:
        'NBS Monograph 8 gives the fundamental differential/gage manometer relation p = rho g h and tabulates mercury density at 20 degrees Celsius.',
      report: 'NBS Monograph 8, Mercury Barometers and Manometers (1960)',
      url: 'https://nvlpubs.nist.gov/nistpubs/Legacy/MONO/nbsmonograph8.pdf',
    },
    officialDescription: movement.description,
    officialEngraving: './engravings/mm_498.png',
    officialInlineModelUrl: movement.sourceUrl,
    reconstructionDisclosure:
      'The official page marks Animated unavailable. Brown fixes the U-tube, mercury, connected pressure leg, open scale leg, and equilibrium principle but gives no bore, scale units, pressure history, or timing. Equal bores, 20-degree-C mercury density, an eight-second smooth 0-to-4-to-0 demonstration, dimensions, colors, and supports are explicit reconstruction choices.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    maximumGaugePressurePascal: stateAtTime(cycleDuration / 2)
      .gaugePressurePascal,
    pressureScalePascalPerDivision:
      mercuryDensityKilogramsPerCubicMetre
      * standardGravityMetresPerSecondSquared
      * 2 * scaleSpacing * sceneMetresPerUnit,
    rightSurfaceRisePerScaleDivision: scaleSpacing,
  };
  root.userData.cameraDistanceScale = 1.03;

  const update = (time) => {
    const state = stateAtTime(time);
    setVerticalColumn(
      mercuryColumns[0],
      bendTangentY - 0.025,
      state.leftSurfaceY,
    );
    setVerticalColumn(
      mercuryColumns[1],
      bendTangentY - 0.025,
      state.rightSurfaceY,
    );
    menisci[0].position.y = state.leftSurfaceY;
    menisci[1].position.y = state.rightSurfaceY;
    readingPointer.position.y = state.rightSurfaceY;
    pressureCore.material.opacity = 0.10 + 0.55 * state.pressureFraction;
    pressureCore.userData.gaugePressurePascal = state.gaugePressurePascal;
    mercuryColumns[0].userData.absolutePressureAtSurfacePascal =
      state.leftAbsolutePressurePascal;
    mercuryColumns[1].userData.absolutePressureAtSurfacePascal =
      state.rightAbsolutePressurePascal;
    root.userData.kinematics = state;
  };
  update(0);
  root.userData.fidelity = 'authored';
  markShadows(root);
  for (const glassObject of [...glassLegs, glassBend, openLegRim]) {
    glassObject.castShadow = false;
    glassObject.receiveShadow = false;
  }
  pressureCore.castShadow = false;
  correctMercuryInstrument(root, 498, update);
  return {
    root,
    update,
    cameraDirection: root.userData.cameraDirection,
  };
}

export function createAuthoredSiphonPressureGaugeMovement(movement) {
  if (movement.id !== 498) return null;
  return siphonPressureGauge(movement);
}
