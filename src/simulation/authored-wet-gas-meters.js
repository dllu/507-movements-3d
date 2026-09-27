import {correctGasMeterParts} from './gas-meter-working-parts.js';
import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import {plate, poly, sector, polygonClipping} from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const QUARTER_TURN = Math.PI / 2;

function circularSegmentPrism(
  radius,
  surfaceY,
  depth,
  material,
  role,
) {
  const normalizedLevel = THREE.MathUtils.clamp(surfaceY / radius, -1, 1);
  const levelAngle = Math.asin(normalizedLevel);
  const startAngle = Math.PI - levelAngle;
  const endAngle = FULL_TURN + levelAngle;
  const shape = new THREE.Shape();
  for (let index = 0; index <= 96; index += 1) {
    const angle = THREE.MathUtils.lerp(
      startAngle,
      endAngle,
      index / 96,
    );
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 64,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.role = role;
  return mesh;
}

function annularSectorPrism({
  innerRadius,
  outerRadius,
  startAngle,
  endAngle,
  depth,
  material,
  role,
}) {
  const shape = new THREE.Shape();
  const segments = 28;
  for (let index = 0; index <= segments; index += 1) {
    const angle = THREE.MathUtils.lerp(
      startAngle,
      endAngle,
      index / segments,
    );
    const x = outerRadius * Math.cos(angle);
    const y = outerRadius * Math.sin(angle);
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let index = segments; index >= 0; index -= 1) {
    const angle = THREE.MathUtils.lerp(
      startAngle,
      endAngle,
      index / segments,
    );
    shape.lineTo(
      innerRadius * Math.cos(angle),
      innerRadius * Math.sin(angle),
    );
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 32,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.role = role;
  return mesh;
}

// Brown's compartments B (plate 481). Each chamber is bounded by one wall
// drawn as a single bent sheet plus its own stretch of drum shell:
//  - an inner hook that curls round the central pipe a (the four hooks nest
//    round a, and the gap at the end of each hook is a chamber mouth);
//  - a straight leg offset from the axis, running out towards the shell;
//  - an L-turn near the shell (the short chord Brown draws parallel to the
//    shell), and a small joggle out to the shell itself;
//  - the shell arc, which runs on clockwise past the next wall's L-turn and
//    stops short of that wall's joggle. The channel between the arc and the
//    next wall's chord leads to that gap: the chamber's peripheral outlet, the
//    "gap on the outer side" Brown draws at each of the four compartments.
// Local frame of wall 0: the leg runs up x = +legOffset from the shell to the
// hook, which curls counterclockwise round the axis. Walls k are rotated k*90
// degrees. Proportions are measured on the plate (drum radius R): leg offset
// 0.35R, hook an Archimedean spiral 0.35R -> 0.26R that leaves the leg
// tangentially, chord at 0.87R, joggle at 264 degrees, shell arc 186 -> 264
// degrees (12 degree outlet gap).
export const WET_METER_CHAMBER_LAYOUT = Object.freeze({
  drumRadius: 2.05,
  shellThickness: 0.05,
  wallThickness: 0.045,
  hookStartRadius: 0.725,
  hookEndRadius: 0.54,
  hookEndAngle: THREE.MathUtils.degToRad(136),
  chordRadius: 1.78,
  chordEndX: -0.14,
  joggleAngle: THREE.MathUtils.degToRad(264),
  arcEndAngle: THREE.MathUtils.degToRad(186),
});

// The hook is an Archimedean spiral r = r0 + k*(phi - phi0) that starts where
// its tangent is parallel to the leg (tan(phi0) = k / r0), so the leg runs
// straight into the curl without a kink.
export function hookGeometry(layout = WET_METER_CHAMBER_LAYOUT) {
  const {hookStartRadius: r0, hookEndRadius: r1, hookEndAngle} = layout;
  let startAngle = 0;
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const rate = (r1 - r0) / (hookEndAngle - startAngle);
    startAngle = Math.atan(rate / r0);
  }
  const rate = (r1 - r0) / (hookEndAngle - startAngle);
  return {legX: r0 * Math.cos(startAngle), rate, startAngle};
}

export function hookedPartitionCenterline(layout = WET_METER_CHAMBER_LAYOUT) {
  const {
    hookStartRadius: r0, hookEndAngle,
    chordRadius, chordEndX, joggleAngle, drumRadius, shellThickness,
  } = layout;
  const {legX, rate, startAngle} = hookGeometry(layout);
  const points = [];
  const shellMid = drumRadius - shellThickness / 2;
  points.push(new THREE.Vector2(shellMid * Math.cos(joggleAngle), shellMid * Math.sin(joggleAngle)));
  points.push(new THREE.Vector2(chordEndX, -chordRadius));
  points.push(new THREE.Vector2(legX, -chordRadius));
  for (let sample = 0; sample <= 64; sample += 1) {
    const angle = THREE.MathUtils.lerp(startAngle, hookEndAngle, sample / 64);
    const radius = r0 + rate * (angle - startAngle);
    points.push(new THREE.Vector2(radius * Math.cos(angle), radius * Math.sin(angle)));
  }
  return points;
}

// Offset a centreline by +-thickness/2 with true miters, so the L-turn keeps
// its full wall thickness.
function thickPolylineShape(points, thickness) {
  const half = thickness / 2;
  const left = [];
  const right = [];
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const point = points[index];
    const next = points[Math.min(points.length - 1, index + 1)];
    const inDir = point.clone().sub(previous);
    const outDir = next.clone().sub(point);
    if (inDir.lengthSq() < 1e-12) inDir.copy(outDir);
    if (outDir.lengthSq() < 1e-12) outDir.copy(inDir);
    inDir.normalize();
    outDir.normalize();
    const n0 = new THREE.Vector2(-inDir.y, inDir.x);
    const n1 = new THREE.Vector2(-outDir.y, outDir.x);
    const miter = n0.clone().add(n1).normalize();
    const scale = half / Math.max(0.35, miter.dot(n1));
    left.push(point.clone().addScaledVector(miter, scale));
    right.push(point.clone().addScaledVector(miter, -scale));
  }
  return [...left, ...right.reverse()].map((point) => [point.x, point.y]);
}

function curvedPartition({
  index,
  depth,
  material,
  layout = WET_METER_CHAMBER_LAYOUT,
}) {
  const group = new THREE.Group();
  group.rotation.z = index * QUARTER_TURN;
  group.userData.role = `helical-measuring-partition-${index + 1}`;
  // The wall and its own stretch of shell are one solid sheet; the shell arc
  // runs slightly past the joggle so the joggle ends inside it.
  const outline = polygonClipping.union(
    poly(thickPolylineShape(hookedPartitionCenterline(layout), layout.wallThickness)),
    sector(
      layout.drumRadius - layout.shellThickness,
      layout.drumRadius,
      layout.arcEndAngle,
      layout.joggleAngle + THREE.MathUtils.degToRad(1),
      96,
    ),
  );
  const geometry = plate(outline, -depth / 2, depth / 2);
  const sheet = new THREE.Mesh(geometry, material);
  sheet.userData.role = `hooked-sheet-of-partition-${index + 1}`;
  group.add(sheet);
  return group;
}

function stageAtLocalPhase(localPhase, cycleDuration) {
  if (localPhase < 0.25) {
    return {
      fillFraction: localPhase * 4,
      fillFractionRatePerSecond: 4 / cycleDuration,
      inletOpen: true,
      outletOpen: false,
      stage: 'filling-from-central-dry-well',
    };
  }
  if (localPhase < 0.5) {
    return {
      fillFraction: 1,
      fillFractionRatePerSecond: 0,
      inletOpen: false,
      outletOpen: false,
      stage: 'sealed-known-volume',
    };
  }
  if (localPhase < 0.75) {
    return {
      fillFraction: 3 - localPhase * 4,
      fillFractionRatePerSecond: -4 / cycleDuration,
      inletOpen: false,
      outletOpen: true,
      stage: 'discharging-to-outer-case',
    };
  }
  return {
    fillFraction: 0,
    fillFractionRatePerSecond: 0,
    inletOpen: false,
    outletOpen: false,
    stage: 'submerged-and-refilling-with-water',
  };
}

function wetGasMeter(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8;
  const chamberCount = 4;
  const drumAngularVelocityRadianPerSecond = FULL_TURN / cycleDuration;
  const nominalChamberVolumeCubicMetre = 0.006;
  const volumePerDrumRevolutionCubicMetre = chamberCount
    * nominalChamberVolumeCubicMetre;
  const nominalVolumeFlowCubicMetrePerSecond =
    volumePerDrumRevolutionCubicMetre / cycleDuration;
  const registerReductionRatio = 10;
  const dialVolumePerRevolutionCubicMetre =
    volumePerDrumRevolutionCubicMetre * registerReductionRatio;

  const caseRadiusSceneUnit = 2.35;
  const caseDepthSceneUnit = 1.55;
  const layout = WET_METER_CHAMBER_LAYOUT;
  const drumRadiusSceneUnit = layout.drumRadius;
  const drumDepthSceneUnit = 1.08;
  // Brown's water line stands about 0.2 drum radii above the axis; 0.185R
  // keeps at least one hook mouth above it at every drum angle.
  const waterSurfaceY = 0.38;
  // Chamber k's mouth is the free end of the hook of wall k-1 (its trailing
  // neighbour); its outlet is the shell gap between its own arc end and the
  // joggle of wall k-1.
  const centralInletPortRadiusSceneUnit = layout.hookEndRadius;
  const peripheralOutletPortRadiusSceneUnit = drumRadiusSceneUnit;
  const portBaseAngleRadian = layout.hookEndAngle - QUARTER_TURN;
  const outletBaseAngleRadian = (layout.arcEndAngle + layout.joggleAngle
    - QUARTER_TURN) / 2;
  const outletGapHalfAngleRadian = (layout.arcEndAngle - layout.joggleAngle
    + QUARTER_TURN) / 2;
  // A chamber starts to discharge when its outlet gap rises out of the water
  // on the right; the quarter-staggered stage clock is aligned to that.
  const outletEmergenceAngleRadian = Math.asin(
    waterSurfaceY / peripheralOutletPortRadiusSceneUnit,
  );
  const stagePhaseOffset = THREE.MathUtils.euclideanModulo(
    0.5 - (outletEmergenceAngleRadian - outletBaseAngleRadian) / FULL_TURN,
    1,
  );
  const markerPassesPerDrumRevolution = 4;
  const markersPerPath = 8;

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    const drumAngleRadian = drumAngularVelocityRadianPerSecond * time;
    const drumAngleModuloRadian = FULL_TURN * phase;
    const chamberStates = [];
    for (let index = 0; index < chamberCount; index += 1) {
      const localPhase = THREE.MathUtils.euclideanModulo(
        phase + index / chamberCount + stagePhaseOffset,
        1,
      );
      const stage = stageAtLocalPhase(localPhase, cycleDuration);
      const inletPortAngleRadian = drumAngleModuloRadian
        + portBaseAngleRadian + index * QUARTER_TURN;
      const outletPortAngleRadian = drumAngleModuloRadian
        + outletBaseAngleRadian + index * QUARTER_TURN;
      chamberStates.push({
        ...stage,
        chamberGasVolumeCubicMetre:
          nominalChamberVolumeCubicMetre * stage.fillFraction,
        index,
        inletPortAngleRadian,
        inletPortY: centralInletPortRadiusSceneUnit
          * Math.sin(inletPortAngleRadian),
        localPhase,
        outletPortAngleRadian,
        outletPortY: peripheralOutletPortRadiusSceneUnit
          * Math.sin(outletPortAngleRadian),
      });
    }
    const totalChamberGasVolumeCubicMetre = chamberStates.reduce(
      (sum, chamber) => sum + chamber.chamberGasVolumeCubicMetre,
      0,
    );
    const instantaneousInletFlowCubicMetrePerSecond =
      nominalChamberVolumeCubicMetre * chamberStates.reduce(
        (sum, chamber) => sum
          + Math.max(0, chamber.fillFractionRatePerSecond),
        0,
      );
    const instantaneousOutletFlowCubicMetrePerSecond =
      nominalChamberVolumeCubicMetre * chamberStates.reduce(
        (sum, chamber) => sum
          + Math.max(0, -chamber.fillFractionRatePerSecond),
        0,
      );
    return {
      chamberStates,
      cycleTime,
      dialAngleRadian: -drumAngleRadian / registerReductionRatio,
      drumAngleModuloRadian,
      drumAngleRadian,
      drumRevolutionsElapsed: time / cycleDuration,
      instantaneousInletFlowCubicMetrePerSecond,
      instantaneousOutletFlowCubicMetrePerSecond,
      markerTravelTurns: markerPassesPerDrumRevolution
        * time / cycleDuration,
      measuredVolumeCubicMetre:
        nominalVolumeFlowCubicMetrePerSecond * time,
      phase,
      totalChamberGasVolumeCubicMetre,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.25,
    roughness: 0.47,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.42,
  });
  const partitionMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    roughness: 0.43,
  });
  const caseMaterial = matte(PALETTE.frame, {
    metalness: 0.16,
    opacity: 0.22,
    roughness: 0.42,
    side: THREE.DoubleSide,
    transparent: true,
  });
  caseMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.39,
    roughness: 0.24,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const inletMaterial = matte(PALETTE.accent, {
    metalness: 0.21,
    roughness: 0.43,
  });
  const markerMaterial = matte(PALETTE.white, {
    opacity: 0.94,
    roughness: 0.24,
    transparent: true,
  });
  markerMaterial.depthWrite = false;
  const dialFaceMaterial = matte(PALETTE.paper, {
    roughness: 0.88,
  });

  const stationaryCaseA = new THREE.Group();
  stationaryCaseA.userData.role =
    'stationary-cylindrical-case-A-partly-filled-with-water';
  const caseShell = new THREE.Mesh(
    new THREE.CylinderGeometry(
      caseRadiusSceneUnit,
      caseRadiusSceneUnit,
      caseDepthSceneUnit,
      80,
      1,
      true,
    ),
    caseMaterial,
  );
  caseShell.rotation.x = Math.PI / 2;
  caseShell.userData.role = 'transparent-stationary-shell-of-case-A';
  // The case edges are rolled metal beads in the case's own colour, not ink.
  const caseRims = [-1, 1].map((side, index) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(caseRadiusSceneUnit, 0.085, 11, 80),
      frameMaterial,
    );
    rim.position.z = side * caseDepthSceneUnit / 2;
    rim.userData.role = `stationary-case-rim-${index + 1}`;
    stationaryCaseA.add(rim);
    return rim;
  });
  const rearCaseHead = new THREE.Mesh(
    new THREE.CircleGeometry(caseRadiusSceneUnit, 80),
    caseMaterial,
  );
  rearCaseHead.position.z = -caseDepthSceneUnit / 2 - 0.005;
  rearCaseHead.userData.role = 'transparent-rear-head-of-case-A';
  stationaryCaseA.add(caseShell, rearCaseHead);
  root.add(stationaryCaseA);

  const caseWater = circularSegmentPrism(
    caseRadiusSceneUnit - 0.11,
    waterSurfaceY,
    caseDepthSceneUnit - 0.12,
    waterMaterial,
    'stationary-water-volume-above-drum-centerline',
  );
  root.add(caseWater);

  const base = new THREE.Group();
  base.userData.role = 'fixed-pedestal-supporting-case-A';
  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(5.50, 0.18, 1.95),
    frameMaterial,
  );
  baseRail.position.y = -2.49;
  baseRail.userData.role = 'fixed-bottom-base-rail';
  base.add(baseRail);
  // Brown's case sits on two low flared humps that hug its lower quarters.
  const footGroundY = -2.485;
  const footShape = (side) => {
    const points = [[1.545, footGroundY], [2.42, footGroundY]];
    for (let i = 1; i <= 12; i += 1) {
      const t = i / 12;
      const x = (1 - t) ** 2 * 2.42 + 2 * (1 - t) * t * 1.98 + t ** 2 * 1.852;
      const y = (1 - t) ** 2 * footGroundY + 2 * (1 - t) * t * -2.18 + t ** 2 * -1.447;
      points.push([x, y]);
    }
    for (let i = 1; i <= 8; i += 1) {
      const angle = THREE.MathUtils.degToRad(-38 - 11 * i / 8);
      points.push([2.356 * Math.cos(angle), 2.356 * Math.sin(angle)]);
    }
    return points.map(([x, y]) => new THREE.Vector2(side * x, y));
  };
  for (const side of [-1, 1]) {
    const outline = footShape(side);
    if (side < 0) outline.reverse();
    const foot = new THREE.Mesh(
      new THREE.ExtrudeGeometry(new THREE.Shape(outline), {
        depth: 1.40, bevelEnabled: false, curveSegments: 1,
      }).translate(0, 0, -0.70),
      frameMaterial,
    );
    foot.userData.role = side < 0
      ? 'fixed-left-case-foot'
      : 'fixed-right-case-foot';
    base.add(foot);
  }
  root.add(base);

  const drum = new THREE.Group();
  drum.userData.role =
    'one-revolving-four-compartment-measuring-drum';
  // No separate closed shell: each chamber wall carries its own stretch of
  // the drum shell (see curvedPartition), leaving Brown's four outlet gaps.
  const journal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 1.34, 40, 1, true),
    darkMaterial,
  );
  journal.rotation.x = Math.PI / 2;
  journal.userData.role =
    'hollow-rotating-journal-surrounding-central-inlet-pipe-a';
  drum.add(journal);

  const partitions = [];
  const chamberMouths = [];
  const peripheralOutletSlots = [];
  const gasPockets = [];
  const gasPocketMaterials = [];
  for (let index = 0; index < chamberCount; index += 1) {
    const partition = curvedPartition({
      depth: 1.04,
      index,
      material: partitionMaterial,
    });
    drum.add(partition);
    partitions.push(partition);

    // Port references (no geometry): the mouth at the free end of the
    // trailing wall's hook, and the centre of the shell gap.
    const inletAngle = portBaseAngleRadian + index * QUARTER_TURN;
    const mouth = new THREE.Object3D();
    mouth.position.set(
      centralInletPortRadiusSceneUnit * Math.cos(inletAngle),
      centralInletPortRadiusSceneUnit * Math.sin(inletAngle),
      0,
    );
    mouth.userData.role = `central-mouth-of-compartment-B-${index + 1}`;
    drum.add(mouth);
    chamberMouths.push(mouth);

    const outletAngle = outletBaseAngleRadian + index * QUARTER_TURN;
    const outletSlot = new THREE.Object3D();
    outletSlot.position.set(
      peripheralOutletPortRadiusSceneUnit * Math.cos(outletAngle),
      peripheralOutletPortRadiusSceneUnit * Math.sin(outletAngle),
      0,
    );
    outletSlot.userData.role =
      `peripheral-outlet-gap-of-compartment-B-${index + 1}`;
    drum.add(outletSlot);
    peripheralOutletSlots.push(outletSlot);

    const gasPocketMaterial = matte(PALETTE.driver, {
      opacity: 0.20,
      roughness: 0.26,
      side: THREE.DoubleSide,
      transparent: true,
    });
    gasPocketMaterial.depthWrite = false;
    const gasPocket = annularSectorPrism({
      depth: drumDepthSceneUnit * 0.62,
      endAngle: index * QUARTER_TURN + 1.34,
      innerRadius: 0.48,
      material: gasPocketMaterial,
      outerRadius: 1.73,
      role: `gas-displacing-water-in-compartment-B-${index + 1}`,
      startAngle: index * QUARTER_TURN - 0.16,
    });
    drum.add(gasPocket);
    gasPockets.push(gasPocket);
    gasPocketMaterials.push(gasPocketMaterial);
  }
  root.add(drum);

  const axle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.115, 2.10, 30),
    darkMaterial,
  );
  axle.rotation.x = Math.PI / 2;
  axle.userData.role = 'fixed-horizontal-axis-through-hollow-journal';
  root.add(axle);

  const centralInletCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 1.52),
    new THREE.Vector3(0, 0, 0.92),
    new THREE.Vector3(0, 0.05, 0.55),
    new THREE.Vector3(0.08, 0.18, 0.39),
    new THREE.Vector3(0.25, 0.35, 0.29),
    new THREE.Vector3(0.45, 0.43, 0.20),
  ], false, 'centripetal');
  const centralInletPipeA = new THREE.Mesh(
    new THREE.TubeGeometry(centralInletCurve, 96, 0.105, 18, false),
    inletMaterial,
  );
  centralInletPipeA.userData.role =
    'stationary-central-pipe-a-through-journal-turned-above-water';
  root.add(centralInletPipeA);

  const flowMarkers = [];
  for (let index = 0; index < markersPerPath; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.078, 18, 12),
      markerMaterial,
    );
    marker.userData.role = `central-inlet-gas-marker-${index + 1}`;
    root.add(marker);
    flowMarkers.push(marker);
  }
  const markerProgress = (turns, markerIndex) =>
    THREE.MathUtils.euclideanModulo(
      turns + markerIndex / markersPerPath,
      1,
    );

  const registerDial = new THREE.Group();
  registerDial.position.set(2.68, 1.27, 0.88);
  registerDial.userData.role =
    'dial-work-registering-known-volume-per-drum-revolution';
  const dialFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.43, 48),
    dialFaceMaterial,
  );
  dialFace.userData.role = 'register-dial-face';
  const dialRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.43, 0.052, 9, 48),
    darkMaterial,
  );
  dialRim.position.z = 0.02;
  dialRim.userData.role = 'register-dial-rim';
  const dialPointer = new THREE.Group();
  dialPointer.position.z = 0.055;
  dialPointer.userData.role = 'register-pointer-reduced-from-drum-shaft';
  const dialNeedle = new THREE.Mesh(
    new THREE.BoxGeometry(0.31, 0.052, 0.035),
    matte(PALETTE.driver, { roughness: 0.42 }),
  );
  dialNeedle.position.x = 0.14;
  dialPointer.add(dialNeedle);
  const dialHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.07, 24),
    darkMaterial,
  );
  dialHub.rotation.x = Math.PI / 2;
  dialHub.position.z = 0.065;
  registerDial.add(dialFace, dialRim, dialPointer, dialHub);
  root.add(registerDial);

  const update = (time) => {
    const state = stateAtTime(time);
    drum.rotation.z = state.drumAngleRadian;
    dialPointer.rotation.z = state.dialAngleRadian;
    for (let index = 0; index < chamberCount; index += 1) {
      const fillFraction = state.chamberStates[index].fillFraction;
      gasPocketMaterials[index].opacity = 0.035 + 0.34 * fillFraction;
      gasPockets[index].visible = fillFraction > 1e-5;
    }
    for (let index = 0; index < markersPerPath; index += 1) {
      const progress = markerProgress(state.markerTravelTurns, index);
      flowMarkers[index].position.copy(
        centralInletCurve.getPointAt(progress),
      );
      const fade = Math.sin(Math.PI * progress) ** 0.52;
      flowMarkers[index].scale.setScalar(fade);
    }
  };

  const geometry = {
    caseDepthSceneUnit,
    caseRadiusSceneUnit,
    centralInletPortRadiusSceneUnit,
    chamberCount,
    cycleDuration,
    dialVolumePerRevolutionCubicMetre,
    drumAngularVelocityRadianPerSecond,
    drumDepthSceneUnit,
    drumRadiusSceneUnit,
    markerPassesPerDrumRevolution,
    markersPerPath,
    nominalChamberVolumeCubicMetre,
    nominalVolumeFlowCubicMetrePerSecond,
    outletBaseAngleRadian,
    outletEmergenceAngleRadian,
    outletGapHalfAngleRadian,
    peripheralOutletPortRadiusSceneUnit,
    portBaseAngleRadian,
    stagePhaseOffset,
    registerReductionRatio,
    volumePerDrumRevolutionCubicMetre,
    waterSurfaceY,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'four-chamber-helical-drum-wet-gas-meter-with-water-sealed-sequential-fill-discharge-central-turned-inlet-and-revolution-totalizer',
    blocks: {
      axle,
      base,
      caseRims,
      caseShell,
      caseWater,
      centralInletPipeA,
      dialFace,
      dialPointer,
      drum,
      chamberMouths,
      flowMarkers,
      peripheralOutletSlots,
      gasPockets,
      journal,
      partitions,
      rearCaseHead,
      registerDial,
      stationaryCaseA,
    },
    degreesOfFreedom: {
      drumRotation: 1,
      independentOperatingCoordinates: 1,
      registerPointerRotationSlavedByDialWork: 1,
      stationaryInletAndCase: 0,
    },
    dynamics: {
      assumptionScope:
        'The reconstruction prescribes uniform drum speed for a nominal steady gas flow. Water slosh, detailed free-surface clipping inside each helical chamber, pressure ripple, bearing friction, leakage, gas compressibility, and the undisclosed historical dial tooth counts are not integrated.',
      chamberCycle:
        'The four equal chambers are quarter-cycle staggered. Each is linearly filled from the central dry well, sealed at its known volume, discharged through its peripheral opening, and then submerged and refilled with water. One chamber fills while the opposite chamber empties, keeping modeled through-flow constant. The stage clock is aligned so discharge begins as the chamber’s shell gap rises out of the water on the right.',
      markerContinuity:
        'Central-pipe markers advance from totalized metered volume, traverse the complete stationary pipe with getPointAt arc-length sampling, and fade at both ends.',
      meterLaw:
        'Q=(4*V_chamber)*omega/(2*pi). One complete drum revolution transfers four chamber volumes, and the dial total is obtained from accumulated drum revolutions.',
      waterSeal:
        'The stationary case is filled above the drum center. The central hook mouths and the peripheral shell gaps of each chamber alternately emerge and submerge, so water separates the inlet dry well, sealed measuring volume, and outer-case outlet space.',
    },
    fidelity: 'authored',
    flowPaths: {
      centralInletCurve,
      markerProgress,
    },
    geometry,
    mechanism:
      'Stationary case A contains water above its horizontal centerline and one freely revolving drum. Four equal B compartments are separated by curved, approximately helical partitions. Fixed pipe a passes through the hollow journal and turns upward above the water into the central inlet region. Each partition hooks round pipe a, runs out along a leg offset from the axis, turns along the shell and joins it; its stretch of shell runs on past the next partition’s turn and stops short, leaving the gap on the outer side of each compartment that Brown draws. As the drum turns counterclockwise, the hooked mouths admit gas sequentially; each chamber displaces its water, becomes water-sealed at a known volume, then lifts its peripheral gap out of the water, discharges into the case and fills with water again. Four chamber volumes pass per drum revolution. Dial-work totalizes those revolutions; no belt, reciprocating linkage, or moving outer case is used.',
    motion: {
      dialPointerDirection: 'clockwise through an engineered 10:1 reduction',
      drumDirectionViewedFromFront: 'counterclockwise',
      drumRotationAxis: new THREE.Vector3(0, 0, 1),
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 481 HTML marks Animated unavailable and supplies only Brown’s engraving and caption.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate481: {
        approximateCentralPipePixels: [262, 258],
        approximateDrumCenterPixels: [263, 264],
        approximatePeripheralDirectionArrowPixels: [365, 349],
        approximateWaterSurfacePixels: [260, 230],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 16,
      },
      bureauOfStandardsCircular309Url:
        'https://www.govinfo.gov/content/pkg/GOVPUB-C13-bcd86cede6b39b231bf2f405be30379b/pdf/GOVPUB-C13-bcd86cede6b39b231bf2f405be30379b.pdf',
      constructionEvidence: {
        explicitInBrownDescription: [
          'stationary case A is filled with water above the center',
          'the inner drum revolves and has four compartments B',
          'compartment inlets surround central pipe a through a hollow journal',
          'pipe a turns upward to admit gas above water',
          'successive gas filling turns the drum and displaces water',
          'passing chambers refill with water',
          'known chamber contents and dial-counted revolutions register volume',
        ],
        engravingEvidence:
          'Brown’s end view shows the circular stationary case, a level water surface above the horizontal axis, four curved drum partitions each ending in a turn and a stretch of shell with a gap on its outer side, the central turned pipe, and a counterclockwise peripheral direction arrow.',
        historicalCorroboration:
          'U.S. Bureau of Standards Circular 309, pp. 41–45, describes an exterior case, a usually four-compartment approximately helical drum, rear inlet openings, front outlet openings, water sealing, pressure-driven rotation, and one known delivery from each compartment per revolution.',
        reconstructionDisclosure:
          'The case, water level, four B chambers, central turned pipe a, direction, sequential displacement, and revolution-based measurement are source-grounded. Exact 3D partition curves, chamber volume, speed, port dimensions, materials, and the illustrative 10:1 dial reduction are independently engineered and exposed.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 481',
    },
    stateAtTime,
    transmission: {
      chamberPhaseEquation:
        'u_i=mod(theta/(2*pi)+i/4+u_0,1), i=0,1,2,3; u_0 aligns discharge with the gap emerging',
      dialEquation: 'theta_dial=-theta_drum/10',
      meterEquation:
        'V_measured=N_drum*(4*V_chamber); Q=4*V_chamber/T_revolution',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.30, -2.90, -1.72),
    new THREE.Vector3(3.30, 2.90, 1.72),
  );
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraDirection = new THREE.Vector3(6.8, 3.2, 11.8);
  root.userData.groundFloorY = -2.72;
  correctGasMeterParts(root,481,update);
  // Brown's section shows one level water line just above the centre with gas
  // above it. Water is drawn distinctly below that line; each chamber's gas
  // tint is clipped to the space above the stationary surface, so the fill
  // never reads as a vertical gas/water split while the drum turns.
  const waterSurfaceClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), -waterSurfaceY);
  for (const material of gasPocketMaterials) material.clippingPlanes = [waterSurfaceClip];
  root.userData.localClippingEnabled = true;
  const surfaceHalfWidth = Math.sqrt((caseRadiusSceneUnit - 0.11) ** 2 - waterSurfaceY ** 2);
  const waterSurfaceLine = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * surfaceHalfWidth, 0.035),
    matte(PALETTE.fluid, { roughness: 0.3, side: THREE.DoubleSide }),
  );
  waterSurfaceLine.position.set(0, waterSurfaceY - 0.0175, (caseDepthSceneUnit - 0.12) / 2 + 0.002);
  waterSurfaceLine.userData.role = 'stationary-level-water-surface-line';
  root.add(waterSurfaceLine);
  root.userData.blocks.waterSurfaceLine = waterSurfaceLine;
  // Brown leaves the gas space above the water plain white: back the section
  // with an opaque paper-white case head instead of a grey tinted one, so the
  // space above the line reads blank and the water below reads against white.
  rearCaseHead.material = matte(PALETTE.paper, {
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  // The finite ported drum heads stay as closed solids but are drawn as
  // clear as the section Brown cuts through them, not as a grey veil.
  for (const head of root.userData.blocks.drumHeads ?? []) {
    head.material = head.material.clone();
    head.material.color.setHex(PALETTE.paper);
    head.material.opacity = 0.04;
  }
  // The rear drum head closes the chambers behind Brown's section: an opaque
  // plain paper-white face (like the case head behind it), with no shadows,
  // so the chambers read blank above the water and water-filled below it.
  const rearDrumHead = root.userData.blocks.drumHeads?.[0];
  if (rearDrumHead) {
    rearDrumHead.material = matte(PALETTE.paper, { roughness: 0.95, side: THREE.DoubleSide });
    rearDrumHead.receiveShadow = false;
  }
  // Brown fills case and chambers alike to just above the centre: the water
  // reads as a clear blue body in every compartment, not a faint tint.
  caseWater.material.opacity = 0.42;
  // Its front face stands just behind the section plane (z = 0.48), so the
  // cut leaves a real water face across the chambers instead of an open
  // volume whose only visible face is hidden behind the rear drum head.
  caseWater.geometry.scale(1, 1, 1.17 / (caseDepthSceneUnit - 0.12)).translate(0, 0, -0.115);
  // Brown's plate is a flat end section of case and drum.
  root.userData.cameraDirection.set(0.05, 0.08, 15);
  root.userData.cameraFov = 10;
  markShadows(root);
  caseShell.castShadow = false;
  rearCaseHead.castShadow = false;
  // No partition shadows on the blank paper-white back of the section.
  rearCaseHead.receiveShadow = false;
  caseWater.castShadow = false;
  if (rearDrumHead) rearDrumHead.receiveShadow = false;
  caseWater.receiveShadow = false;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredWetGasMeterMovement(movement) {
  if (movement.id !== 481) return null;
  return applyCutawayFor(wetGasMeter(movement), movement.id);
}
