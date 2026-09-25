import * as THREE from 'three';
import {correctMercuryInstrument} from './mercury-instrument-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

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
  for (let index = 0; index <= 36; index += 1) {
    const angle = Math.PI + Math.PI * index / 36;
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
  7: ['a', 'b', 'c'],
  8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  9: ['a', 'b', 'c', 'd', 'f', 'g'],
});

function makeDigit(value, material) {
  const digit = new THREE.Group();
  const placements = {
    a: [0, 0.15, 0],
    b: [0.09, 0.075, Math.PI / 2],
    c: [0.09, -0.075, Math.PI / 2],
    d: [0, -0.15, 0],
    e: [-0.09, -0.075, Math.PI / 2],
    f: [-0.09, 0.075, Math.PI / 2],
    g: [0, 0, 0],
  };
  for (const segmentName of DIGIT_SEGMENTS[value]) {
    const [x, y, rotation] = placements[segmentName];
    const segment = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.025, 0.026),
      material,
    );
    segment.position.set(x, y, 0);
    segment.rotation.z = rotation;
    digit.add(segment);
  }
  return digit;
}

function makeTwoDigitLabel(value, material) {
  const label = addRole(new THREE.Group(), `inch-scale-label-${value}`);
  const tens = makeDigit(Math.floor(value / 10), material);
  const ones = makeDigit(value % 10, material);
  tens.position.x = -0.105;
  ones.position.x = 0.105;
  label.add(tens, ones);
  label.userData.valueInches = value;
  return label;
}

function makeAtmosphericArrow(material, index) {
  const arrow = addRole(new THREE.Group(),
    `atmospheric-pressure-arrow-${index + 1}`);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.33, 12),
    material,
  );
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.095, 0.20, 18),
    material,
  );
  shaft.position.y = 0.13;
  head.position.y = -0.12;
  head.rotation.z = Math.PI;
  arrow.add(shaft, head);
  return arrow;
}

function mercurialBarometer(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8;
  const legCenterX = 0.70;
  const bendTangentY = -4.03;
  const longLegTopY = 5.20;
  const shortLegOpenY = -2.35;
  const reservoirBottomY = -3.48;
  const leftBaselineSurfaceY = -3.00;
  const inchMetres = 0.0254;
  const baselineReadingInches = 30;
  const sceneMetresPerUnit = 0.10;
  const baselineHeadMetres = baselineReadingInches * inchMetres;
  const baselineHeadScene = baselineHeadMetres / sceneMetresPerUnit;
  const rightBaselineSurfaceY = leftBaselineSurfaceY + baselineHeadScene;
  const innerTubeRadius = 0.105;
  const glassOuterRadius = 0.165;
  const reservoirAreaRatio = 5;
  const tubeAreaSceneSquared = Math.PI * innerTubeRadius ** 2;
  const reservoirAreaSceneSquared = reservoirAreaRatio
    * tubeAreaSceneSquared;
  const reservoirInnerRadius = Math.sqrt(
    reservoirAreaSceneSquared / Math.PI,
  );
  const mercuryDensityKilogramsPerCubicMetre = 13595.1;
  const standardGravityMetresPerSecondSquared = 9.80665;
  const meanAtmosphericPressurePascal =
    mercuryDensityKilogramsPerCubicMetre
    * standardGravityMetresPerSecondSquared
    * baselineHeadMetres;
  const pressureAmplitudePascal =
    mercuryDensityKilogramsPerCubicMetre
    * standardGravityMetresPerSecondSquared
    * 0.8 * inchMetres;

  const glassMaterial = matte(0xb9dae4, {
    opacity: 0.27,
    roughness: 0.16,
    side: THREE.DoubleSide,
    transparent: true,
  });
  glassMaterial.depthWrite = false;
  const mercuryMaterial = matte(PALETTE.muted, {
    metalness: 0.84,
    roughness: 0.15,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.65,
  });
  // An ivory scale board, distinct from the page, carries the marks.
  const scaleMaterial = matte(0xe6dcc3, {
    roughness: 0.88,
  });
  const inkMaterial = matte(PALETTE.ink, {
    roughness: 0.53,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.36,
    roughness: 0.38,
  });
  const atmosphereMaterial = matte(PALETTE.driven, {
    opacity: 0.48,
    roughness: 0.46,
    transparent: true,
  });
  atmosphereMaterial.depthWrite = false;

  const glassLongLeg = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      glassOuterRadius,
      glassOuterRadius,
      1,
      28,
      1,
      true,
    ),
    glassMaterial,
  ), 'sealed-long-glass-leg-with-inch-scale');
  glassLongLeg.position.set(
    legCenterX,
    (bendTangentY + longLegTopY) / 2,
    0,
  );
  glassLongLeg.scale.y = longLegTopY - bendTangentY;
  const glassBend = makeTubeAlong(
    lowerBendPoints(legCenterX, bendTangentY),
    glassOuterRadius,
    glassMaterial,
    'transparent-lower-bend-joining-long-and-short-legs',
  );
  const glassShortLower = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      glassOuterRadius,
      glassOuterRadius,
      reservoirBottomY - bendTangentY + 0.16,
      28,
      1,
      true,
    ),
    glassMaterial,
  ), 'narrow-lower-neck-of-short-leg');
  glassShortLower.position.set(
    -legCenterX,
    (bendTangentY + reservoirBottomY) / 2,
    0,
  );
  const reservoirBulb = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.43, 36, 24),
    glassMaterial,
  ), 'expanded-open-atmospheric-reservoir-of-short-leg');
  reservoirBulb.position.set(-legCenterX, -2.96, 0);
  reservoirBulb.scale.y = 1.28;
  const shortOpenNeck = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.18,
      0.18,
      0.56,
      28,
      1,
      true,
    ),
    glassMaterial,
  ), 'open-neck-above-short-leg-reservoir');
  shortOpenNeck.position.set(-legCenterX, -2.57, 0);
  const shortOpenRim = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.032, 10, 32),
    glassMaterial,
  ), 'short-leg-rim-open-to-atmosphere');
  shortOpenRim.rotation.x = Math.PI / 2;
  shortOpenRim.position.set(-legCenterX, shortLegOpenY, 0);
  shortOpenRim.userData.openToAtmosphere = true;
  const sealedLongCap = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(glassOuterRadius, 28, 16),
    glassMaterial,
  ), 'hermetically-closed-top-of-long-leg');
  sealedLongCap.position.set(legCenterX, longLegTopY, 0);
  sealedLongCap.scale.y = 0.52;
  sealedLongCap.userData.hermeticallyClosed = true;

  const mercuryBend = makeTubeAlong(
    lowerBendPoints(legCenterX, bendTangentY),
    innerTubeRadius,
    mercuryMaterial,
    'continuous-mercury-through-lower-bend',
  );
  const lowerShortMercury = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      innerTubeRadius,
      innerTubeRadius,
      reservoirBottomY - bendTangentY + 0.12,
      24,
    ),
    mercuryMaterial,
  ), 'mercury-joining-lower-bend-to-short-reservoir');
  lowerShortMercury.position.set(
    -legCenterX,
    (bendTangentY + reservoirBottomY) / 2,
    0,
  );
  const longMercuryColumn = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      innerTubeRadius,
      innerTubeRadius,
      1,
      24,
    ),
    mercuryMaterial,
  ), 'mercury-column-supported-in-sealed-long-leg');
  longMercuryColumn.position.x = legCenterX;
  const reservoirMercury = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      reservoirInnerRadius,
      reservoirInnerRadius,
      1,
      32,
    ),
    mercuryMaterial,
  ), 'mercury-free-surface-in-open-short-reservoir');
  reservoirMercury.position.x = -legCenterX;
  const menisci = [-1, 1].map((side) => {
    const radius = side < 0 ? reservoirInnerRadius : innerTubeRadius;
    const meniscus = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.012, 26, 14),
      mercuryMaterial,
    ), side < 0
      ? 'open-reservoir-mercury-meniscus-under-atmosphere'
      : 'long-column-mercury-meniscus-under-torricellian-vacuum');
    meniscus.position.x = side * legCenterX;
    meniscus.scale.y = 0.20;
    return meniscus;
  });

  const rightSurfaceForReading = (readingInches) => {
    const headScene = readingInches * inchMetres / sceneMetresPerUnit;
    const headDelta = headScene - baselineHeadScene;
    return rightBaselineSurfaceY
      + headDelta * reservoirAreaSceneSquared
        / (tubeAreaSceneSquared + reservoirAreaSceneSquared);
  };
  const scaleBottomY = rightSurfaceForReading(27.8);
  const scaleTopY = rightSurfaceForReading(31.2);
  // Brown draws only the inch marks beside the long leg: they are carried
  // on a narrow board just behind the tube plane (front face at z -0.0025),
  // held to the leg by a band (see mercury-instrument-parts.js).
  const scaleBoard = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.58, scaleTopY - scaleBottomY + 0.20, 0.10),
    scaleMaterial,
  ), 'fixed-calibrated-28-through-31-inch-scale-board');
  scaleBoard.position.set(
    1.23,
    (scaleBottomY + scaleTopY) / 2,
    -0.0525,
  );
  const scaleSpine = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.012, scaleTopY - scaleBottomY, 0.045),
    inkMaterial,
  ), 'vertical-inch-scale-spine');
  scaleSpine.position.set(1.05, (scaleBottomY + scaleTopY) / 2, 0.01);
  const scaleTicks = [];
  for (let tenths = 280; tenths <= 310; tenths += 1) {
    const reading = tenths / 10;
    const wholeInch = tenths % 10 === 0;
    const halfInch = tenths % 5 === 0;
    const tick = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(
        wholeInch ? 0.42 : (halfInch ? 0.32 : 0.23),
        // Fine engraved lines: at 0.021 per tenth a 0.026 tick merged its
        // neighbours into one black block.
        wholeInch ? 0.010 : 0.006,
        0.045,
      ),
      inkMaterial,
    ), `inch-scale-mark-${reading.toFixed(1)}`);
    tick.position.set(
      wholeInch ? 1.25 : (halfInch ? 1.20 : 1.155),
      rightSurfaceForReading(reading),
      0.02,
    );
    tick.userData.valueInches = reading;
    scaleTicks.push(tick);
  }
  const scaleLabels = [28, 29, 30, 31].map((reading) => {
    const label = makeTwoDigitLabel(reading, inkMaterial);
    label.position.set(1.73, rightSurfaceForReading(reading), 0.03);
    label.scale.setScalar(0.52);
    return label;
  });
  const liveReadingPointer = addRole(new THREE.Mesh(
    new THREE.ConeGeometry(0.105, 0.25, 3),
    brassMaterial,
  ), 'live-inch-reading-index-at-long-column-meniscus');
  liveReadingPointer.rotation.z = -Math.PI / 2;
  liveReadingPointer.position.set(1.00, rightBaselineSurfaceY, 0.04);

  const atmosphericArrows = [0, 1, 2].map((index) => {
    const arrow = makeAtmosphericArrow(atmosphereMaterial, index);
    arrow.position.set(
      -legCenterX + (index - 1) * 0.25,
      shortLegOpenY + 0.48 + Math.abs(index - 1) * 0.08,
      0.02,
    );
    return arrow;
  });

  const supportBase = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(3.30, 0.18, 0.62),
    frameMaterial,
  ), 'fixed-barometer-support-base');
  supportBase.position.set(0.24, -4.91, -0.25);
  const supportSpine = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 9.45, 0.17),
    frameMaterial,
  ), 'fixed-barometer-back-support');
  supportSpine.position.set(0.03, 0.01, -0.47);
  const retainingClips = [-3.55, -1.15, 1.30, 3.80].map((y, index) => {
    const clip = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.095, 0.11),
      brassMaterial,
    ), `fixed-glass-retaining-clip-${index + 1}`);
    clip.position.set(0, y, -0.17);
    return clip;
  });

  root.add(
    supportBase,
    supportSpine,
    ...retainingClips,
    scaleBoard,
    scaleSpine,
    ...scaleTicks,
    ...scaleLabels,
    mercuryBend,
    lowerShortMercury,
    longMercuryColumn,
    reservoirMercury,
    ...menisci,
    glassLongLeg,
    glassBend,
    glassShortLower,
    reservoirBulb,
    shortOpenNeck,
    shortOpenRim,
    sealedLongCap,
    liveReadingPointer,
    ...atmosphericArrows,
  );

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const cyclePosition = cycleTime / cycleDuration;
    const phaseAngle = Math.PI * 2 * cyclePosition;
    const pressureWave = -Math.cos(phaseAngle);
    const pressureWaveVelocity = Math.PI * 2 / cycleDuration
      * Math.sin(phaseAngle);
    const atmosphericPressurePascal = meanAtmosphericPressurePascal
      + pressureAmplitudePascal * pressureWave;
    const atmosphericPressureVelocityPascalPerSecond =
      pressureAmplitudePascal * pressureWaveVelocity;
    const mercuryHeadMetres = atmosphericPressurePascal
      / (mercuryDensityKilogramsPerCubicMetre
        * standardGravityMetresPerSecondSquared);
    const mercuryHeadScene = mercuryHeadMetres / sceneMetresPerUnit;
    const headDeltaScene = mercuryHeadScene - baselineHeadScene;
    const rightSurfaceShift = headDeltaScene
      * reservoirAreaSceneSquared
      / (tubeAreaSceneSquared + reservoirAreaSceneSquared);
    const leftSurfaceShift = -headDeltaScene
      * tubeAreaSceneSquared
      / (tubeAreaSceneSquared + reservoirAreaSceneSquared);
    const rightSurfaceY = rightBaselineSurfaceY + rightSurfaceShift;
    const leftSurfaceY = leftBaselineSurfaceY + leftSurfaceShift;
    const variableMercuryVolumeSceneCubed =
      tubeAreaSceneSquared * (rightSurfaceY - bendTangentY)
      + reservoirAreaSceneSquared * (leftSurfaceY - reservoirBottomY);
    return {
      absolutePressureResidualPascal: atmosphericPressurePascal
        - mercuryDensityKilogramsPerCubicMetre
          * standardGravityMetresPerSecondSquared
          * mercuryHeadMetres,
      atmosphericPressurePascal,
      atmosphericPressureVelocityPascalPerSecond,
      cyclePosition,
      cycleTime,
      leftSurfaceShift,
      leftSurfaceY,
      longLegVacuumLengthScene: longLegTopY - rightSurfaceY,
      mercuryHeadMetres,
      mercuryHeadScene,
      pressureWave,
      pressureWaveVelocity,
      readingInches: mercuryHeadMetres / inchMetres,
      rightSurfaceShift,
      rightSurfaceY,
      torricellianVacuumPressurePascal: 0,
      variableMercuryVolumeSceneCubed,
      volumeChangeResidualSceneCubed:
        tubeAreaSceneSquared * rightSurfaceShift
        + reservoirAreaSceneSquared * leftSurfaceShift,
    };
  };

  const initialState = stateAtTime(0);
  root.userData.archetype =
    'open-reservoir-sealed-vacuum-long-leg-mercurial-barometer';
  root.userData.mechanism =
    'atmospheric-pressure-on-open-short-reservoir-supports-mercury-column-in-sealed-evacuated-long-leg-with-volume-conserving-reservoir-correction';
  root.userData.blocks = {
    atmosphericArrows,
    glassBend,
    glassLongLeg,
    glassShortLower,
    liveReadingPointer,
    longMercuryColumn,
    lowerShortMercury,
    menisci,
    mercuryBend,
    reservoirBulb,
    reservoirMercury,
    retainingClips,
    scaleBoard,
    scaleLabels,
    scaleSpine,
    scaleTicks,
    sealedLongCap,
    shortOpenNeck,
    shortOpenRim,
    supportBase,
    supportSpine,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.55, -5.12, -0.78),
    new THREE.Vector3(2.08, 5.42, 0.78),
  );
  root.userData.canonicalTimes = {
    highestAtmosphericPressure: cycleDuration / 2,
    lowestAtmosphericPressure: 0,
    returnToLowest: cycleDuration,
    sourcePose: cycleDuration * 0.43,
  };
  root.userData.degreesOfFreedom = {
    independentAtmosphericPressureInputs: 1,
    independentMercurySurfaceCoordinates: 0,
  };
  root.userData.geometry = {
    bendTangentY,
    cycleDuration,
    glassOuterRadius,
    innerTubeRadius,
    leftBaselineSurfaceY,
    legCenterX,
    longLegTopY,
    reservoirBottomY,
    reservoirInnerRadius,
    rightBaselineSurfaceY,
    shortLegOpenY,
  };
  root.userData.hydrostatics = {
    equation:
      'atmosphericPressurePascal = mercuryDensity * gravity * (longSurfaceY - reservoirSurfaceY) * sceneMetresPerUnit',
    inchMetres,
    meanAtmosphericPressurePascal,
    mercuryDensityKilogramsPerCubicMetre,
    pressureAmplitudePascal,
    reservoirAreaRatio,
    reservoirAreaSceneSquared,
    sceneMetresPerUnit,
    standardGravityMetresPerSecondSquared,
    tubeAreaSceneSquared,
    variableMercuryVolumeSceneCubed:
      initialState.variableMercuryVolumeSceneCubed,
  };
  root.userData.sourceAnimation = {
    available: false,
    officialCanvasModelPresent: false,
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    metrologyCorroboration: {
      detail:
        'NBS Monograph 8 gives P = rho g h for a liquid column whose upper surface is under vacuum and defines the differential height between liquid surfaces; it also gives the standard mercury density used here.',
      report: 'NBS Monograph 8, Mercury Barometers and Manometers (1960)',
      url: 'https://nvlpubs.nist.gov/nistpubs/Legacy/MONO/nbsmonograph8.pdf',
    },
    officialDescription: movement.description,
    officialEngraving: './engravings/mm_501.png',
    officialInlineModelUrl: movement.sourceUrl,
    reconstructionDisclosure:
      'The official page marks Animated unavailable. Brown fixes the closed evacuated long leg, open short leg, mercury, inch scale, and atmospheric operating principle but gives no bore, reservoir area, pressure history, or timing. A 5:1 reservoir/tube area ratio, standard mercury density, 29.2-to-30.8-inch eight-second weather cycle, volume-corrected scale positions, dimensions, supports, and colors are explicit reconstruction choices. Brown’s optional float-and-dial weather-glass is described but not pictured and is therefore not added.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    baselineReadingInches,
    leftReservoirDropPerLongColumnRise:
      tubeAreaSceneSquared / reservoirAreaSceneSquared,
    maximumReadingInches: 30.8,
    minimumReadingInches: 29.2,
    rightSurfaceForReading,
  };
  root.userData.cameraDistanceScale = 1.20;

  const update = (time) => {
    const state = stateAtTime(time);
    setVerticalColumn(
      longMercuryColumn,
      bendTangentY - 0.025,
      state.rightSurfaceY,
    );
    setVerticalColumn(
      reservoirMercury,
      reservoirBottomY,
      state.leftSurfaceY,
    );
    menisci[0].position.y = state.leftSurfaceY;
    menisci[1].position.y = state.rightSurfaceY;
    liveReadingPointer.position.y = state.rightSurfaceY;
    const normalizedPressure = (
      state.atmosphericPressurePascal
      - (meanAtmosphericPressurePascal - pressureAmplitudePascal)
    ) / (2 * pressureAmplitudePascal);
    atmosphereMaterial.opacity = 0.24 + 0.44 * normalizedPressure;
    atmosphericArrows.forEach((arrow) => {
      arrow.scale.y = 0.90 + 0.20 * normalizedPressure;
      arrow.userData.absolutePressurePascal =
        state.atmosphericPressurePascal;
    });
    root.userData.kinematics = state;
  };
  update(0);
  root.userData.fidelity = 'authored';
  markShadows(root);
  for (const glassObject of [
    glassLongLeg,
    glassBend,
    glassShortLower,
    reservoirBulb,
    shortOpenNeck,
    shortOpenRim,
    sealedLongCap,
  ]) {
    glassObject.castShadow = false;
    glassObject.receiveShadow = false;
  }
  atmosphericArrows.forEach((arrow) => {
    arrow.traverse((object) => {
      if (object.isMesh) object.castShadow = false;
    });
  });
  correctMercuryInstrument(root, 501, update);
  return {
    root,
    update,
    cameraDirection: root.userData.cameraDirection,
  };
}

export function createAuthoredMercurialBarometerMovement(movement) {
  if (movement.id !== 501) return null;
  return mercurialBarometer(movement);
}
