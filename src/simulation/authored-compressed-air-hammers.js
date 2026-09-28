import {correctHammerWorkingParts} from './hammer-working-parts.js';
import {plate, poly, circle, polygonClipping, spline} from './finite-plate-geometry.js';
import {mergePassageParts} from './finite-fluid-passages.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (10 + x * (-15 + 6 * x));
}

function smootherStepDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * x ** 2 * (1 - x) ** 2;
}

function smootherStepSecondDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * x * (1 - x) * (1 - 2 * x);
}

function setRodBetween(mesh, start, end) {
  const delta = end.clone().sub(start);
  const length = Math.max(0.001, delta.length());
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.y = length;
  mesh.quaternion.setFromUnitVectors(Y_AXIS, delta.normalize());
}

function tubeThrough(points, radius, material, role, segments = 48) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  const mesh = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(curve, segments, radius, 12, false),
    material,
  ), role);
  mesh.userData.curve = curve;
  return mesh;
}

// Brown's frame C is one broad casting in the plane of the working parts:
// a flat bed, a pocket holding pump D, a slender S-curved neck up to the
// head carrying shaft E, a slender hollow arm (the air reservoir) sweeping
// down from the valve chest to the bed, a yoke round cylinder B, and the
// arched anvil pedestal. Outlines are traced from the doubled plate in
// pixels; the casting is 0.60 deep with the parts on its mid-plane, so the
// pump, friction wheel and cylinder stand in windows through it and the
// shaft runs in bored bosses.
function buildBroadHollowFrame(root, bx, by, shaftCenter) {
  const blocks = root.userData.blocks;
  const geometry = root.userData.geometry;
  const half = 0.30;
  const map = (points) => points.map(([x, y]) => [bx(x), by(y)]);
  const rect = (x0, y0, x1, y1) => poly(map([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]));
  const outline = poly(map([
    [80, 965], [80, 888], [115, 888], [115, 752], [135, 722], [175, 705],
    [350, 700], [352, 760], [368, 780], [392, 778], [420, 748], [447, 695],
    [457, 660], [462, 600], [460, 555], [445, 505], [425, 440], [417, 380],
    [413, 300], [410, 232], [485, 232], [485, 380], [690, 380], [690, 232],
    [715, 232], [715, 194], [765, 194], [752, 300], [735, 400], [720, 435],
    [650, 475], [610, 510], [587, 560], [585, 610], [595, 660], [620, 720],
    [650, 785], [670, 830], [697, 820], [730, 700], [785, 668], [785, 645],
    [900, 645], [905, 668], [930, 700], [945, 800], [965, 868], [1000, 900],
    [1000, 965],
  ]));
  const opening = poly(map([
    [455, 410], [690, 404], [650, 420], [600, 465], [570, 520], [557, 590],
    // The S-arm's inner edge is kept about 33 px inside its outer edge all
    // the way to the foot (it used to cross it at y 760, pinching the
    // casting in two).
    [562, 650], [575, 705], [605, 760], [630, 820], [640, 888], [400, 888], [405, 860],
    [420, 810], [445, 760], [475, 690], [487, 620], [485, 570], [465, 490],
    [452, 440],
  ]));
  const arch = poly(map([
    [722, 888], [735, 780], [760, 720], [810, 693], [870, 698], [905, 730],
    [925, 800], [935, 888],
  ]));
  // The shaft bosses are cut out here and added below with real bores.
  const bosses = [[405, 486], [689, 716]];
  let body = polygonClipping.difference(outline, opening, arch,
    ...bosses.map(([x0, x1]) => rect(x0, 228, x1, 348)));
  // Pump D rises through a round-cornered gap in the pocket's top wall.
  const pocketWindow = polygonClipping.union(rect(150, 718, 336, 888),
    rect(203, 690, 309, 720));
  // Reservoir C: a closed passage along the hollow arm's mid-line, inside
  // the casting (pass 69: it used to be a groove open on the front face,
  // stopping blind above the arm's foot, so the reservoir leaked and was cut
  // off from pump D). It now opens through the top of the arm's tab into the
  // valve chest standing on it, runs down the S-arm, through its foot and
  // along the hollow bed, and rises into the bed top under pump D's bored
  // foot, so pump, reservoir and chest form one sealed path.
  const centre = spline(map([[740, 188], [740, 212], [741, 300], [727, 410], [685, 443],
    [630, 473], [598, 515], [578, 565], [572, 610], [580, 660], [598, 712],
    [615, 745], [631, 790], [645, 840], [650, 880], [642, 912], [615, 928],
    [560, 931], [420, 931], [300, 930], [272, 925], [259, 910], [256, 895],
    [256, 884]]));
  const channelHalfWidth = 0.05;
  const sides = [[], []];
  centre.forEach((point, index) => {
    const a = centre[Math.max(0, index - 1)];
    const b = centre[Math.min(centre.length - 1, index + 1)];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const normal = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
    sides[0].push([point[0] + normal[0] * channelHalfWidth, point[1] + normal[1] * channelHalfWidth]);
    sides[1].push([point[0] - normal[0] * channelHalfWidth, point[1] - normal[1] * channelHalfWidth]);
  });
  const channel = poly([...sides[0], ...sides[1].reverse()]);
  const passageHalfDepth = 0.18;
  const front = polygonClipping.difference(body, pocketWindow);
  const frame = blocks.hollowReservoirFrame;
  frame.geometry.dispose();
  frame.geometry = mergePassageParts([
    plate(front, -half, -passageHalfDepth),
    plate(polygonClipping.difference(front, channel), -passageHalfDepth, passageHalfDepth),
    plate(front, passageHalfDepth, half),
    // The pocket's back wall stands behind pump D.
    plate(polygonClipping.intersection(body, rect(115, 700, 352, 888)), -0.52, -half),
  ]);
  frame.position.set(0, 0, 0);
  frame.rotation.set(0, 0, 0);
  frame.scale.set(1, 1, 1);
  const air = blocks.reservoirAir;
  air.geometry.dispose();
  air.geometry = plate(channel, -passageHalfDepth + 0.01, passageHalfDepth - 0.01);
  air.position.set(0, 0, 0);
  air.rotation.set(0, 0, 0);
  air.scale.set(1, 1, 1);
  air.material.opacity = 0.35;
  // The air sealed inside the closed casting is not seen.
  air.visible = false;
  const material = frame.material;
  const extra = [];
  const add = (geometry, role) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.role = role;
    root.add(mesh);
    extra.push(mesh);
    return mesh;
  };
  // Bosses in the head's left column and right wall, bored for shaft E.
  const boss = (x0, x1, role) => {
    const profile = polygonClipping.difference(
      poly([[-half, by(348)], [half, by(348)], [half, by(228)], [-half, by(228)]]),
      poly(circle([0, shaftCenter.y], 0.092, 64)),
    );
    return add(plate(profile, bx(x0), bx(x1)).rotateY(Math.PI / 2), role);
  };
  // rotateY(+90) maps plate z to world x and plate x to world -z; the
  // profile is symmetric in z, so only the extrusion range matters.
  blocks.shaftBosses = [
    boss(410, 485, 'shaft-E-bored-boss-in-head-column-of-frame-C'),
    boss(690, 715, 'shaft-E-bored-boss-in-head-right-wall-of-frame-C'),
  ];
  // The horizontal disk turns on a stud rising from the head column.
  const stud = add(new THREE.CylinderGeometry(0.05, 0.05, 1, 32),
    'fixed-stud-carrying-horizontal-disk-M');
  const studBottom = by(228);
  const studTop = geometry.frictionDiskCenter.y + 0.125;
  stud.scale.y = studTop - studBottom;
  stud.position.set(geometry.frictionDiskCenter.x, (studTop + studBottom) / 2, 0);
  // Yoke round cylinder B: a top bar over the valve chest, the right wall,
  // and a bored bottom bar on which B's lower head sits.
  const chestTop = geometry.valveLinkageY + 0.15;
  const yokeRight = bx(915);
  add(new THREE.BoxGeometry(yokeRight - bx(693), 0.12, 2 * half)
    .translate((yokeRight + bx(693)) / 2, chestTop + 0.06, 0), 'yoke-top-bar-of-frame-C-over-valve-chest');
  const barTop = geometry.hammerCylinderInnerBottomY - 0.08;
  const barBottom = barTop - 0.08;
  add(new THREE.BoxGeometry(0.10, chestTop + 0.12 - barBottom, 2 * half)
    .translate(yokeRight - 0.05, (chestTop + 0.12 + barBottom) / 2, 0), 'yoke-right-wall-of-frame-C');
  const barProfile = polygonClipping.difference(
    poly([[bx(790), -half], [yokeRight - 0.10, -half], [yokeRight - 0.10, half], [bx(790), half]]),
    poly(circle([geometry.hammerAxisX, 0], 0.075, 64)),
  );
  add(plate(barProfile, -barTop, -barBottom).rotateX(Math.PI / 2), 'yoke-bottom-bar-of-frame-C-bored-for-hammer-rod');
  // Brown's port passages: the lower one curls down B's left side, the
  // upper one drops straight into B's top head.
  const chestBottom = geometry.valveLinkageY - 0.15;
  const portMaterial = blocks.valveConnectingRod.material;
  const cylinderOuter = geometry.hammerInnerRadius + 0.085;
  const lowerPort = tubeThrough([
    new THREE.Vector3(1.66, chestBottom + 0.01, 0),
    new THREE.Vector3(1.70, chestBottom - 0.40, 0),
    new THREE.Vector3(1.715, 2.60, 0),
    new THREE.Vector3(1.72, geometry.hammerCylinderInnerBottomY + 0.22, 0),
    new THREE.Vector3(geometry.hammerAxisX - cylinderOuter + 0.01,
      geometry.hammerCylinderInnerBottomY + 0.12, 0),
  ], 0.04, portMaterial, 'valve-chest-port-passage-to-bottom-of-cylinder-B', 64);
  root.add(lowerPort);
  const upperPort = tubeThrough([
    new THREE.Vector3(2.36, chestBottom + 0.01, 0),
    new THREE.Vector3(2.36, (chestBottom + geometry.hammerCylinderInnerTopY) / 2 + 0.04, 0),
    new THREE.Vector3(2.36, geometry.hammerCylinderInnerTopY + 0.07, 0),
  ], 0.04, portMaterial, 'valve-chest-port-passage-to-top-of-cylinder-B', 16);
  root.add(upperPort);
  // Pump D stands on a foot bored through to the reservoir passage in the
  // bed: it delivers down into C.
  const pumpFoot = add(boredLatheGeometry([{radial: 0.40, axial: -0.5}, {radial: 0.40, axial: 0.5}], 0.07, 64),
    'bored-foot-of-pump-D-delivering-into-bed-of-C');
  const footTop = geometry.pumpCylinderInnerBottomY - 0.08;
  pumpFoot.scale.y = footTop - by(888);
  pumpFoot.position.set(geometry.pumpAxisX, (footTop + by(888)) / 2, geometry.pumpAxisZ);
  // Brown draws two collars on shaft E beside the friction wheel.
  blocks.shaftCollars = [578, 612].map((pixel) => {
    const collar = new THREE.Mesh(
      boredLatheGeometry([{radial: 0.28, axial: -0.075}, {radial: 0.28, axial: 0.075}], 0.087, 64),
      blocks.driveShaft.material,
    );
    collar.rotation.z = Math.PI / 2;
    collar.position.x = bx(pixel);
    collar.userData.role = 'collar-on-shaft-E';
    blocks.driveAssembly.add(collar);
    return collar;
  });
  blocks.frameBrackets = extra;
  blocks.portPassages = [lowerPort, upperPort];
}

function grimshawCompressedAirHammer(movement) {
  const root = new THREE.Group();
  // Layout follows Brown's plate: 0.00715 units per pixel of the doubled
  // 1050-pixel engraving, x from the plate's column 540, y up from the
  // underside of the bed. Cylinder B's drawn bore then equals Grimshaw's
  // 4.5 inches at 0.135 units per inch.
  const groundY = -1.92;
  const brownUnitsPerPixel = 0.00715;
  const bx = (pixel) => (pixel - 540) * brownUnitsPerPixel;
  const by = (pixel) => (965 - pixel) * brownUnitsPerPixel + groundY;
  const visualUnitsPerSourceInch = 0.135;
  const sourcePumpBoreInch = 8;
  const sourcePumpStrokeInch = 8;
  const sourceHammerPistonBoreInch = 4.5;
  const sourceHammerStrokeInch = 10;
  // Brown draws pump D about as wide as cylinder B, not Grimshaw's 8-inch
  // bore: the drawn barrel (about 0.71 across outside) sets the bore.
  const brownPumpBorePixels = 75.5;
  const pumpInnerRadius = brownPumpBorePixels * brownUnitsPerPixel / 2;
  const pumpStroke = sourcePumpStrokeInch * visualUnitsPerSourceInch;
  const pumpCrankRadius = pumpStroke / 2;
  const hammerInnerRadius = sourceHammerPistonBoreInch
    * visualUnitsPerSourceInch / 2;
  // Brown's short cylinder B, deep piston A and high anvil leave room for
  // about 77 drawn pixels of travel, not Grimshaw's 10-inch stroke.
  const brownHammerStrokePixels = 77;
  const hammerStroke = brownHammerStrokePixels * brownUnitsPerPixel;
  const sourceMainShaftRpm = 180;
  const sourceHammerBlowsPerMinute = 270;
  const frictionSpeedRatio = sourceHammerBlowsPerMinute
    / sourceMainShaftRpm;
  const driveCycleDuration = 2.4;
  const hammerCycleDuration = driveCycleDuration / frictionSpeedRatio;
  const driveAngularVelocity = FULL_TURN / driveCycleDuration;
  const valveDiskAngularVelocity = driveAngularVelocity
    * frictionSpeedRatio;
  const educationalTimeScale = driveCycleDuration
    / (60 / sourceMainShaftRpm);
  const pressurePascalPerPsi = 6894.757293168;
  const atmosphericPressurePascal = 101325;
  const sourceTypicalGaugePressurePsi = 20;
  const reservoirGaugePressurePascal = sourceTypicalGaugePressurePsi
    * pressurePascalPerPsi;
  const reservoirAbsolutePressurePascal = atmosphericPressurePascal
    + reservoirGaugePressurePascal;
  const polytropicExponent = 1.35;
  const sourceInchMetre = 0.0254;
  const physicalHammerPistonAreaSquareMetre = Math.PI * (
    sourceHammerPistonBoreInch * sourceInchMetre / 2
  ) ** 2;

  const shaftCenter = new THREE.Vector3(0, by(285), 0);
  const pumpAxisX = -2.03;
  const pumpAxisZ = shaftCenter.z;
  const pumpPistonThickness = 0.16;
  const pumpWristOffset = 0.21;
  // Pump D stands on the bed in the frame's pocket, its open top at the
  // drawn height (plate y 615); the rod reaches the crank on shaft E.
  const pumpCylinderInnerBottomY = -1.02;
  const pumpCylinderInnerTopY = 0.54;
  const pumpConnectingRodLength = shaftCenter.y + pumpCrankRadius
    - pumpWristOffset - (pumpCylinderInnerTopY - 0.10 - pumpPistonThickness / 2);
  const pumpPistonArea = Math.PI * pumpInnerRadius ** 2;
  const pumpDeliveredVolumePerDriveRevolution = 2
    * pumpPistonArea * pumpStroke;

  const hammerAxisX = bx(842);
  const hammerAxisZ = 0;
  const hammerPistonThickness = 0.64;
  const hammerCylinderInnerBottomY = by(430);
  const hammerCylinderInnerTopY = by(240);
  const hammerPistonBottomCenterY = hammerCylinderInnerBottomY + 0.06
    + hammerPistonThickness / 2;
  const hammerPistonArea = Math.PI * hammerInnerRadius ** 2;
  const hammerHeadHeight = 0.34;
  const anvilTopY = by(585);
  const hammerHeadBottomCenterY = anvilTopY + hammerHeadHeight / 2;
  const lowerAdmissionStartPhase = 0.02;
  const lowerCutoffPhase = 0.42;
  const upperAdmissionStartPhase = 0.52;
  const upperCutoffPhase = 0.92;
  const impactSpeedVisualUnitsPerSecond = 3 * hammerStroke
    / (0.5 * hammerCycleDuration);

  const frictionWheelRadius = 0.43;
  const frictionContactRadius = frictionWheelRadius
    / frictionSpeedRatio;
  const frictionDiskThickness = 0.25;
  // Brown's horizontal disk lies on top of the frame head; the wheel on
  // shaft E bears on its underside.
  const frictionDiskCenter = new THREE.Vector3(
    bx(462),
    shaftCenter.y + frictionWheelRadius + frictionDiskThickness / 2,
    0,
  );
  const frictionWheelCenter = new THREE.Vector3(
    frictionDiskCenter.x + frictionContactRadius,
    shaftCenter.y,
    frictionDiskCenter.z,
  );
  const valveCrankRadius = 0.22;
  const valveConnectingRodLength = 2.51;
  const valveSliderAxisZ = frictionDiskCenter.z;
  const valveLinkageY = frictionDiskCenter.y + 0.253;
  const valveChestX = 1.90;
  const valveNeutralSliderX = frictionDiskCenter.x + Math.sqrt(
    valveConnectingRodLength ** 2 - valveCrankRadius ** 2,
  );
  const valveRightSliderX = frictionDiskCenter.x
    + valveCrankRadius + valveConnectingRodLength;
  const valveLeftSliderX = frictionDiskCenter.x
    - valveCrankRadius + valveConnectingRodLength;

  const canonicalHammerPhase = (unwrappedPhase) => {
    const rawPhase = positiveModulo(unwrappedPhase, 1);
    return [0, lowerAdmissionStartPhase, lowerCutoffPhase, 0.5,
      upperAdmissionStartPhase, upperCutoffPhase].find((boundary) =>
      Math.abs(rawPhase - boundary) < 1e-12) ?? rawPhase;
  };

  const pumpKinematicsAtDrivePhase = (unwrappedDrivePhase) => {
    const drivePhase = positiveModulo(unwrappedDrivePhase, 1);
    const driveAngle = FULL_TURN * unwrappedDrivePhase + Math.PI;
    const cosine = Math.cos(driveAngle);
    const sine = Math.sin(driveAngle);
    const crankPin = new THREE.Vector3(
      pumpAxisX,
      shaftCenter.y + pumpCrankRadius * cosine,
      pumpAxisZ + pumpCrankRadius * sine,
    );
    const horizontalOffset = pumpAxisZ - crankPin.z;
    const verticalReach = Math.sqrt(Math.max(
      0,
      pumpConnectingRodLength ** 2 - horizontalOffset ** 2,
    ));
    const pistonPin = new THREE.Vector3(
      pumpAxisX,
      crankPin.y - verticalReach,
      pumpAxisZ,
    );
    const horizontalOffsetDerivative = -pumpCrankRadius * cosine;
    const horizontalOffsetSecondDerivative = pumpCrankRadius * sine;
    const verticalReachDerivative = -horizontalOffset
      * horizontalOffsetDerivative / verticalReach;
    const verticalReachSecondDerivative = -(
      horizontalOffsetDerivative ** 2
      + horizontalOffset * horizontalOffsetSecondDerivative
    ) / verticalReach - (
      horizontalOffset ** 2 * horizontalOffsetDerivative ** 2
    ) / verticalReach ** 3;
    const pistonDerivativeByAngle = -pumpCrankRadius * sine
      - verticalReachDerivative;
    const pistonSecondDerivativeByAngle = -pumpCrankRadius * cosine
      - verticalReachSecondDerivative;
    return {
      crankPin,
      driveAngle,
      driveAngularVelocity,
      drivePhase,
      horizontalOffset,
      pistonAcceleration: pistonSecondDerivativeByAngle
        * driveAngularVelocity ** 2,
      pistonCenterY: pistonPin.y - pumpWristOffset,
      pistonDerivativeByAngle,
      pistonPin,
      pistonSecondDerivativeByAngle,
      pistonVelocity: pistonDerivativeByAngle * driveAngularVelocity,
      verticalReach,
      verticalReachDerivative,
      verticalReachSecondDerivative,
    };
  };

  const pumpStateAtDrivePhase = (unwrappedDrivePhase) => {
    const kinematics = pumpKinematicsAtDrivePhase(unwrappedDrivePhase);
    const pistonBottomY = kinematics.pistonCenterY
      - pumpPistonThickness / 2;
    const pistonTopY = kinematics.pistonCenterY
      + pumpPistonThickness / 2;
    const lowerChamberHeight = pistonBottomY
      - pumpCylinderInnerBottomY;
    const upperChamberHeight = pumpCylinderInnerTopY - pistonTopY;
    const rising = kinematics.pistonVelocity > 1e-10;
    const falling = kinematics.pistonVelocity < -1e-10;
    return {
      ...kinematics,
      deliveredFlowVisualVolumePerSecond: pumpPistonArea
        * Math.abs(kinematics.pistonVelocity),
      lowerChamberHeight,
      lowerDeliveryValveOpen: falling,
      lowerInletValveOpen: rising,
      pistonBottomY,
      pistonTopY,
      upperChamberHeight,
      upperDeliveryValveOpen: rising,
      upperInletValveOpen: falling,
    };
  };

  const hammerKinematicsAtPhase = (unwrappedHammerPhase) => {
    const phase = canonicalHammerPhase(unwrappedHammerPhase);
    let acceleration;
    let lift;
    let regime;
    let velocity;
    if (phase < 0.5) {
      const local = phase / 0.5;
      const duration = hammerCycleDuration * 0.5;
      lift = hammerStroke * smootherStep(local);
      velocity = hammerStroke * smootherStepDerivative(local) / duration;
      acceleration = hammerStroke
        * smootherStepSecondDerivative(local) / duration ** 2;
      regime = phase < lowerAdmissionStartPhase
        ? 'bottom-crossover-after-impact'
        : phase < lowerCutoffPhase
          ? 'reservoir-air-admitted-below-piston-lifts-hammer'
          : 'lower-charge-expands-after-adjustable-cutoff';
    } else {
      const local = (phase - 0.5) / 0.5;
      const duration = hammerCycleDuration * 0.5;
      lift = hammerStroke * (1 - local ** 3);
      velocity = -3 * hammerStroke * local ** 2 / duration;
      acceleration = -6 * hammerStroke * local / duration ** 2;
      regime = phase < upperAdmissionStartPhase
        ? 'top-crossover-before-downstroke'
        : phase < upperCutoffPhase
          ? 'reservoir-air-admitted-above-piston-drives-downstroke'
          : 'upper-charge-expands-after-adjustable-cutoff-to-impact';
    }
    if (Math.abs(phase) < 1e-12) {
      regime = 'hammer-impact-stopped-before-next-lifting-stroke';
    }
    const pistonCenterY = hammerPistonBottomCenterY + lift;
    const hammerHeadCenterY = hammerHeadBottomCenterY + lift;
    return {
      acceleration,
      hammerFaceY: hammerHeadCenterY - hammerHeadHeight / 2,
      hammerHeadCenterY,
      impactContact: Math.abs(lift) < 1e-12,
      lift,
      phase,
      pistonCenterY,
      regime,
      velocity,
    };
  };

  const chamberGeometryAtHammerPhase = (phase) => {
    const hammer = hammerKinematicsAtPhase(phase);
    const pistonBottomY = hammer.pistonCenterY
      - hammerPistonThickness / 2;
    const pistonTopY = hammer.pistonCenterY
      + hammerPistonThickness / 2;
    const lowerChamberHeight = pistonBottomY
      - hammerCylinderInnerBottomY;
    const upperChamberHeight = hammerCylinderInnerTopY - pistonTopY;
    return {
      hammer,
      lowerChamberHeight,
      lowerChamberVolume: hammerPistonArea * lowerChamberHeight,
      pistonBottomY,
      pistonTopY,
      upperChamberHeight,
      upperChamberVolume: hammerPistonArea * upperChamberHeight,
    };
  };

  const lowerCutoffVolume = chamberGeometryAtHammerPhase(
    lowerCutoffPhase,
  ).lowerChamberVolume;
  const upperCutoffVolume = chamberGeometryAtHammerPhase(
    upperCutoffPhase,
  ).upperChamberVolume;
  const lowerExpansionConstant = reservoirAbsolutePressurePascal
    * lowerCutoffVolume ** polytropicExponent;
  const upperExpansionConstant = reservoirAbsolutePressurePascal
    * upperCutoffVolume ** polytropicExponent;

  const valveKinematicsAtHammerPhase = (unwrappedHammerPhase) => {
    const phase = canonicalHammerPhase(unwrappedHammerPhase);
    const diskAngle = FULL_TURN * unwrappedHammerPhase - Math.PI / 2;
    const crankPin = new THREE.Vector3(
      frictionDiskCenter.x + valveCrankRadius * Math.cos(diskAngle),
      valveLinkageY,
      frictionDiskCenter.z - valveCrankRadius * Math.sin(diskAngle),
    );
    const transverseOffset = valveSliderAxisZ - crankPin.z;
    const longitudinalReach = Math.sqrt(Math.max(
      0,
      valveConnectingRodLength ** 2 - transverseOffset ** 2,
    ));
    const sliderPin = new THREE.Vector3(
      crankPin.x + longitudinalReach,
      valveLinkageY,
      valveSliderAxisZ,
    );
    const displacement = sliderPin.x - valveNeutralSliderX;
    const command = displacement >= 0
      ? displacement / (valveRightSliderX - valveNeutralSliderX)
      : displacement / (valveNeutralSliderX - valveLeftSliderX);
    const lowerHalf = phase > 0 && phase < 0.5;
    const upperHalf = phase > 0.5;
    return {
      command,
      crankPin,
      diskAngle,
      diskAngularVelocity: valveDiskAngularVelocity,
      lowerExhaustOpening: upperHalf ? Math.max(0, -command) : 0,
      lowerSupplyOpening: phase >= lowerAdmissionStartPhase
        && phase < lowerCutoffPhase
        ? Math.max(0, command)
        : 0,
      longitudinalReach,
      phase,
      sliderDisplacement: displacement,
      sliderPin,
      transverseOffset,
      upperExhaustOpening: lowerHalf ? Math.max(0, command) : 0,
      upperSupplyOpening: phase >= upperAdmissionStartPhase
        && phase < upperCutoffPhase
        ? Math.max(0, -command)
        : 0,
    };
  };

  const pneumaticStateAtHammerPhase = (unwrappedHammerPhase) => {
    const phase = canonicalHammerPhase(unwrappedHammerPhase);
    const chamber = chamberGeometryAtHammerPhase(phase);
    const valve = valveKinematicsAtHammerPhase(phase);
    let lowerChamberMode = 'exhausted-to-atmosphere';
    let lowerPressurePascal = atmosphericPressurePascal;
    let upperChamberMode = 'exhausted-to-atmosphere';
    let upperPressurePascal = atmosphericPressurePascal;
    if (phase >= lowerAdmissionStartPhase && phase < lowerCutoffPhase) {
      lowerChamberMode = 'reservoir-supply-below-piston';
      lowerPressurePascal = reservoirAbsolutePressurePascal;
    } else if (phase >= lowerCutoffPhase && phase < 0.5) {
      lowerChamberMode = 'sealed-lower-polytropic-expansion-after-cutoff';
      lowerPressurePascal = lowerExpansionConstant
        / chamber.lowerChamberVolume ** polytropicExponent;
    }
    if (phase >= upperAdmissionStartPhase && phase < upperCutoffPhase) {
      upperChamberMode = 'reservoir-supply-above-piston';
      upperPressurePascal = reservoirAbsolutePressurePascal;
    } else if (phase >= upperCutoffPhase) {
      upperChamberMode = 'sealed-upper-polytropic-expansion-after-cutoff';
      upperPressurePascal = upperExpansionConstant
        / chamber.upperChamberVolume ** polytropicExponent;
    }
    const pneumaticForceNewton = physicalHammerPistonAreaSquareMetre
      * (lowerPressurePascal - upperPressurePascal);
    return {
      ...chamber,
      lowerChamberMode,
      lowerExpansionResidual: lowerChamberMode.startsWith('sealed')
        ? lowerPressurePascal
          * chamber.lowerChamberVolume ** polytropicExponent
          - lowerExpansionConstant
        : 0,
      lowerPressurePascal,
      pneumaticForceNewton,
      phase,
      upperChamberMode,
      upperExpansionResidual: upperChamberMode.startsWith('sealed')
        ? upperPressurePascal
          * chamber.upperChamberVolume ** polytropicExponent
          - upperExpansionConstant
        : 0,
      upperPressurePascal,
      valve,
    };
  };

  // Brown draws piston A raised at the top of B, so playback starts at the
  // top of the hammer stroke (half a hammer cycle after impact). The offset
  // is a constant shift, so the two-turn loop stays continuous.
  const sourcePoseTimeOffset = 0.5 * hammerCycleDuration;
  const stateAtTime = (time) => {
    const shiftedTime = time + sourcePoseTimeOffset;
    const unwrappedDrivePhase = shiftedTime / driveCycleDuration;
    const unwrappedHammerPhase = shiftedTime / hammerCycleDuration;
    const pump = pumpStateAtDrivePhase(unwrappedDrivePhase);
    const pneumatic = pneumaticStateAtHammerPhase(unwrappedHammerPhase);
    const friction = {
      contactRadius: frictionContactRadius,
      diskAngle: FULL_TURN * unwrappedHammerPhase - Math.PI / 2,
      diskAngularVelocity: valveDiskAngularVelocity,
      diskSurfaceSpeed: valveDiskAngularVelocity * frictionContactRadius,
      noSlipResidual: driveAngularVelocity * frictionWheelRadius
        - valveDiskAngularVelocity * frictionContactRadius,
      speedRatio: frictionSpeedRatio,
      wheelAngle: pump.driveAngle,
      wheelAngularVelocity: driveAngularVelocity,
      wheelSurfaceSpeed: driveAngularVelocity * frictionWheelRadius,
    };
    return {
      friction,
      hammer: pneumatic.hammer,
      hammerPhase: pneumatic.phase,
      pneumatic,
      pump,
      reservoir: {
        absolutePressurePascal: reservoirAbsolutePressurePascal,
        gaugePressurePascal: reservoirGaugePressurePascal,
        regulatedBySafetyValve: true,
      },
      time,
      valve: pneumatic.valve,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.42,
    roughness: 0.38,
  });
  const driveMaterial = matte(PALETTE.driver, {
    metalness: 0.24,
    roughness: 0.44,
  });
  const airMaterial = matte(0x83c6dd, {
    transparent: true,
    opacity: 0.34,
    roughness: 0.20,
    side: THREE.DoubleSide,
  });
  airMaterial.depthWrite = false;
  const reservoirAirMaterial = matte(0x73c9e5, {
    transparent: true,
    opacity: 0.58,
    roughness: 0.18,
  });
  reservoirAirMaterial.depthWrite = false;
  const compressedAirMaterial = matte(0xf0b468, {
    transparent: true,
    opacity: 0.58,
    roughness: 0.20,
  });
  compressedAirMaterial.depthWrite = false;
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.38,
    roughness: 0.42,
  });
  const rodMaterial = matte(PALETTE.accent, {
    metalness: 0.36,
    roughness: 0.40,
  });
  const cylinderMaterial = matte(PALETTE.driven, {
    transparent: true,
    opacity: 0.38,
    roughness: 0.30,
    side: THREE.DoubleSide,
  });
  cylinderMaterial.depthWrite = false;

  const foundation = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(4.25, 0.20, 1.72),
    frameMaterial,
  ), 'grimshaw-hammer-foundation');
  foundation.position.set(0, groundY + 0.10, 0);
  root.add(foundation);

  const reservoirCurvePoints = [
    new THREE.Vector3(-0.35, -0.80, -0.30),
    new THREE.Vector3(-0.25, -0.05, -0.30),
    new THREE.Vector3(-0.03, 0.78, -0.30),
    new THREE.Vector3(0.40, 1.58, -0.30),
    new THREE.Vector3(0.91, 2.13, -0.30),
  ];
  const hollowReservoirFrame = tubeThrough(
    reservoirCurvePoints,
    0.37,
    frameMaterial,
    'hollow-frame-reservoir-C',
    72,
  );
  root.add(hollowReservoirFrame);
  const reservoirAir = tubeThrough(
    reservoirCurvePoints.map((point) => new THREE.Vector3(
      point.x,
      point.y,
      -0.02,
    )),
    0.16,
    reservoirAirMaterial,
    'front-cutaway-window-into-regulated-air-reservoir-C',
    72,
  );
  root.add(reservoirAir);
  const reservoirFoot = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.42, 1.16),
    frameMaterial,
  );
  reservoirFoot.position.set(-0.25, -0.73, -0.24);

  const hammerSupport = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.42, 0.72),
    frameMaterial,
  );
  hammerSupport.position.set(1.03, 2.13, -0.22);

  const driveAssembly = addRole(new THREE.Group(),
    'constant-speed-rotary-driving-shaft-E');
  driveAssembly.position.copy(shaftCenter);
  root.add(driveAssembly);
  const driveShaft = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 3.13, 26),
    darkMaterial,
  ), 'rotary-driving-shaft-E');
  // Overhung at the left: the shaft ends in the pump crank, outboard of E.
  driveShaft.rotation.z = Math.PI / 2;
  driveShaft.position.x = -0.365;
  driveAssembly.add(driveShaft);
  const drivePulley = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.47, 0.47, 0.20, 42),
    driveMaterial,
  ), 'belt-driving-pulley-E');
  drivePulley.rotation.z = Math.PI / 2;
  drivePulley.position.x = bx(315);
  driveAssembly.add(drivePulley);
  const drivePulleyRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.045, 9, 52),
    darkMaterial,
  );
  drivePulleyRim.rotation.y = Math.PI / 2;
  drivePulleyRim.position.x = -1.83;
  const driveIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.08, 0.32),
    matte(PALETTE.white, { roughness: 0.48 }),
  );
  driveIndex.position.set(-1.84, 0.31, 0);
  const pumpCrankArm = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.12, pumpCrankRadius, 0.10),
    driveMaterial,
  ), 'pump-D-crank-on-shaft-E');
  pumpCrankArm.position.set(-1.88, pumpCrankRadius / 2, 0);
  driveAssembly.add(pumpCrankArm);
  const pumpCrankPinVisual = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.24, 22),
    rodMaterial,
  );
  pumpCrankPinVisual.rotation.z = Math.PI / 2;
  pumpCrankPinVisual.position.set(-1.99, pumpCrankRadius, 0);
  driveAssembly.add(pumpCrankPinVisual);

  const pumpCylinder = addRole(new THREE.Group(),
    'double-acting-air-pump-D');
  root.add(pumpCylinder);
  const pumpShell = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      pumpInnerRadius + 0.085,
      pumpInnerRadius + 0.085,
      pumpCylinderInnerTopY - pumpCylinderInnerBottomY + 0.16,
      42,
      1,
      true,
      Math.PI * 0.13,
      Math.PI * 1.72,
    ),
    cylinderMaterial,
  ), 'cutaway-double-acting-pump-D-cylinder');
  pumpShell.position.set(
    pumpAxisX,
    (pumpCylinderInnerTopY + pumpCylinderInnerBottomY) / 2,
    pumpAxisZ,
  );
  pumpCylinder.add(pumpShell);
  const pumpEndRings = [pumpCylinderInnerBottomY - 0.08,
    pumpCylinderInnerTopY + 0.08].map((y, index) => {
    const ring = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(pumpInnerRadius + 0.09, 0.045, 9, 44),
      darkMaterial,
    ), `pump-D-end-ring-${index + 1}`);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(pumpAxisX, y, pumpAxisZ);
    return ring;
  });
  const pumpPistonAssembly = addRole(new THREE.Group(),
    'double-acting-pump-D-piston');
  root.add(pumpPistonAssembly);
  const pumpPiston = new THREE.Mesh(
    new THREE.CylinderGeometry(
      pumpInnerRadius * 0.96,
      pumpInnerRadius * 0.96,
      pumpPistonThickness,
      38,
    ),
    driveMaterial,
  );
  pumpPistonAssembly.add(pumpPiston);
  const pumpConnectingRod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.062, 1, 20),
    rodMaterial,
  ), 'constant-length-pump-D-connecting-rod');
  root.add(pumpConnectingRod);
  const pumpLowerAir = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      pumpInnerRadius * 0.89,
      pumpInnerRadius * 0.89,
      1,
      30,
    ),
    airMaterial,
  ), 'pump-D-lower-air-chamber');
  root.add(pumpLowerAir);
  const pumpUpperAir = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      pumpInnerRadius * 0.89,
      pumpInnerRadius * 0.89,
      1,
      30,
    ),
    airMaterial,
  ), 'pump-D-upper-air-chamber');
  root.add(pumpUpperAir);

  const pumpValveChest = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.88, 0.62),
    darkMaterial,
  ), 'pump-D-four-check-valve-chest');
  pumpValveChest.position.set(-0.48, 0.70, pumpAxisZ);
  const pumpCheckValves = [
    ['lowerInletValveOpen', 0.45, -0.13],
    ['lowerDeliveryValveOpen', 0.45, 0.13],
    ['upperInletValveOpen', 0.91, -0.13],
    ['upperDeliveryValveOpen', 0.91, 0.13],
  ].map(([stateKey, y, z], index) => {
    const valve = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 18, 12),
      index % 2 === 0 ? brassMaterial : rodMaterial,
    ), `pump-D-${stateKey}`);
    valve.position.set(-0.70, y, pumpAxisZ + z);
    valve.userData.stateKey = stateKey;
    return valve;
  });

  const deliveryPipe = tubeThrough([
    new THREE.Vector3(-0.28, 0.78, pumpAxisZ + 0.16),
    new THREE.Vector3(-0.12, 0.48, -0.12),
    new THREE.Vector3(-0.20, -0.08, -0.18),
  ], 0.072, rodMaterial, 'pump-D-delivery-pipe-to-reservoir-C', 36);

  const frictionWheelAssembly = addRole(new THREE.Group(),
    'sliding-leather-faced-friction-wheel-N');
  frictionWheelAssembly.position.copy(frictionWheelCenter);
  root.add(frictionWheelAssembly);
  // Brown draws the wheel on shaft E with a milled face bearing on the
  // underside of disk M: an orange driving wheel on the shaft with a brown
  // leather tyre whose rim carries disk M round at right angles.
  const frictionTyreThickness = 0.045;
  const frictionWheel = new THREE.Mesh(
    new THREE.CylinderGeometry(
      frictionWheelRadius - frictionTyreThickness,
      frictionWheelRadius - frictionTyreThickness,
      0.16,
      48,
    ),
    driveMaterial,
  );
  frictionWheel.rotation.z = Math.PI / 2;
  frictionWheelAssembly.add(frictionWheel);
  const frictionTyre = addRole(new THREE.Mesh(
    boredLatheGeometry([
      {radial: frictionWheelRadius, axial: -0.085},
      {radial: frictionWheelRadius, axial: 0.085},
    ], frictionWheelRadius - frictionTyreThickness, 96),
    matte(0x7a4a2a, { roughness: 0.82 }),
  ), 'leather-face-of-friction-wheel-N-bearing-on-disk-M');
  frictionTyre.rotation.z = Math.PI / 2;
  frictionWheelAssembly.add(frictionTyre);
  const frictionWheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.048, 0.10),
    matte(PALETTE.white, { roughness: 0.48 }),
  );
  frictionWheelIndex.position.y = frictionWheelRadius * 0.79;

  const frictionDiskAssembly = addRole(new THREE.Group(),
    'horizontal-variable-speed-friction-disk-M');
  frictionDiskAssembly.position.copy(frictionDiskCenter);
  root.add(frictionDiskAssembly);
  const frictionDisk = new THREE.Mesh(
    boredLatheGeometry([
      {radial: 0.66, axial: -frictionDiskThickness / 2},
      {radial: 0.66, axial: frictionDiskThickness / 2},
    ], 0.056, 96),
    brassMaterial,
  );
  frictionDiskAssembly.add(frictionDisk);
  const frictionContactTrack = new THREE.Mesh(
    new THREE.TorusGeometry(frictionContactRadius, 0.026, 8, 44),
    darkMaterial,
  );
  frictionContactTrack.rotation.x = Math.PI / 2;
  frictionContactTrack.position.y = 0.058;
  frictionDiskAssembly.add(frictionContactTrack);
  const valveCrankPinVisual = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.26, 32),
    driveMaterial,
  ), 'valve-disk-M-crank-pin');
  valveCrankPinVisual.position.set(valveCrankRadius, 0.255, 0);
  frictionDiskAssembly.add(valveCrankPinVisual);

  const frictionShiftLever = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.075, 1.06),
    rodMaterial,
  ), 'notched-friction-wheel-speed-control-lever-P');
  frictionShiftLever.position.set(
    frictionWheelCenter.x,
    2.96,
    frictionWheelCenter.z + 0.25,
  );
  frictionShiftLever.rotation.x = -0.16;

  const valveConnectingRod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.052, 1, 18),
    rodMaterial,
  ), 'forked-connecting-rod-from-disk-M-to-slide-valve');
  root.add(valveConnectingRod);
  // The slide valve is forked: the rod's eye enters a slot from the left
  // and turns on a vertical pin across it.
  const box = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(
    x1 - x0, y1 - y0, z1 - z0,
  ).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const slideValve = addRole(new THREE.Mesh(
    mergePassageParts([
      box(-0.17, 0.17, 0.046, 0.08, -0.18, 0.18),
      box(-0.17, 0.17, -0.08, -0.046, -0.18, 0.18),
      box(0.125, 0.17, -0.046, 0.046, -0.18, 0.18),
      box(-0.17, 0.125, -0.046, 0.046, 0.135, 0.18),
      box(-0.17, 0.125, -0.046, 0.046, -0.18, -0.135),
      new THREE.CylinderGeometry(0.066, 0.066, 0.092, 32),
    ]),
    driveMaterial,
  ), 'reciprocating-slide-valve-G');
  root.add(slideValve);
  const valveChest = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.30, 0.64),
    cylinderMaterial,
  ), 'fixed-slide-valve-chest-on-cylinder-B');
  valveChest.position.set(hammerAxisX, 2.43, hammerAxisZ);
  root.add(valveChest);
  const cutoffSlides = [-1, 1].map((side, index) => {
    const slide = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.08, 0.40),
      brassMaterial,
    ), `adjustable-cutoff-slide-J-${index + 1}`);
    slide.position.set(
      hammerAxisX + side * 0.29,
      2.61,
      hammerAxisZ,
    );
    return slide;
  });

  const reservoirSupplyPipe = tubeThrough([
    new THREE.Vector3(0.80, 2.06, -0.30),
    new THREE.Vector3(0.98, 2.34, -0.20),
    new THREE.Vector3(hammerAxisX, 2.39, 0),
  ], 0.065, rodMaterial, 'reservoir-C-supply-pipe-to-slide-valve', 30);

  const fixedHammerCylinder = addRole(new THREE.Group(),
    'fixed-hammer-cylinder-B');
  root.add(fixedHammerCylinder);
  const hammerCylinderCenterY = (
    hammerCylinderInnerBottomY + hammerCylinderInnerTopY
  ) / 2;
  const hammerCylinderHalfHeight = (
    hammerCylinderInnerTopY - hammerCylinderInnerBottomY
  ) / 2;
  const hammerCylinderShell = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      hammerInnerRadius + 0.085,
      hammerInnerRadius + 0.085,
      hammerCylinderHalfHeight * 2 + 0.16,
      44,
      1,
      true,
      Math.PI * 0.12,
      Math.PI * 1.72,
    ),
    cylinderMaterial,
  ), 'front-cutaway-hammer-cylinder-B-shell');
  hammerCylinderShell.position.set(
    hammerAxisX,
    hammerCylinderCenterY,
    hammerAxisZ,
  );
  fixedHammerCylinder.add(hammerCylinderShell);
  const hammerCylinderRings = [
    hammerCylinderInnerBottomY - 0.08,
    hammerCylinderInnerTopY + 0.08,
  ].map((y, index) => {
    const ring = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(hammerInnerRadius + 0.09, 0.042, 9, 44),
      darkMaterial,
    ), `hammer-cylinder-B-end-ring-${index + 1}`);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(hammerAxisX, y, hammerAxisZ);
    return ring;
  });

  const hammerAssembly = addRole(new THREE.Group(),
    'rigid-hammer-piston-A-rod-and-head');
  root.add(hammerAssembly);
  const hammerPiston = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      hammerInnerRadius * 0.98,
      hammerInnerRadius * 0.98,
      hammerPistonThickness,
      38,
    ),
    driveMaterial,
  ), 'hammer-piston-A');
  hammerAssembly.add(hammerPiston);
  const hammerPistonSeal = new THREE.Mesh(
    new THREE.TorusGeometry(hammerInnerRadius * 0.97, 0.024, 8, 40),
    darkMaterial,
  );
  hammerPistonSeal.rotation.x = Math.PI / 2;
  hammerAssembly.add(hammerPistonSeal);
  const hammerHeadOffsetY = hammerHeadBottomCenterY
    - hammerPistonBottomCenterY;
  const pistonRodTopY = -hammerPistonThickness / 2;
  const pistonRodBottomY = hammerHeadOffsetY + hammerHeadHeight / 2;
  const hammerPistonRod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.065,
      0.065,
      pistonRodTopY - pistonRodBottomY,
      22,
    ),
    darkMaterial,
  ), 'rigid-hammer-piston-rod');
  hammerPistonRod.position.y = (pistonRodTopY + pistonRodBottomY) / 2;
  hammerAssembly.add(hammerPistonRod);
  const hammerHead = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.20, hammerHeadHeight, 48),
    driveMaterial,
  ), 'compressed-air-hammer-head');
  hammerHead.position.y = hammerHeadOffsetY;
  hammerAssembly.add(hammerHead);
  const hammerFace = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.045, 48),
    darkMaterial,
  ), 'compressed-air-hammer-striking-face');
  hammerFace.position.y = hammerHeadOffsetY - hammerHeadHeight / 2;
  hammerAssembly.add(hammerFace);

  const lowerHammerAir = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      hammerInnerRadius * 0.89,
      hammerInnerRadius * 0.89,
      1,
      30,
    ),
    compressedAirMaterial,
  ), 'air-admitted-below-hammer-piston');
  root.add(lowerHammerAir);
  const upperHammerAir = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      hammerInnerRadius * 0.89,
      hammerInnerRadius * 0.89,
      1,
      30,
    ),
    compressedAirMaterial,
  ), 'air-admitted-above-hammer-piston');
  root.add(upperHammerAir);

  const exhaustPort = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.28, 20),
    darkMaterial,
  ), 'side-exhaust-port-H');
  exhaustPort.rotation.z = Math.PI / 2;
  exhaustPort.position.set(
    hammerAxisX + hammerInnerRadius + 0.18,
    hammerCylinderCenterY,
    hammerAxisZ,
  );

  const anvil = addRole(new THREE.Group(), 'fixed-grimshaw-anvil');
  root.add(anvil);
  // Brown's anvil is a tapered block seated in the arched pedestal's top.
  const anvilBodyHeight = anvilTopY - 0.05 - by(645);
  const anvilBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.44, anvilBodyHeight, 48),
    brassMaterial,
  );
  anvilBody.position.set(hammerAxisX, anvilTopY - 0.05 - anvilBodyHeight / 2, 0);
  anvil.add(anvilBody);
  const anvilFace = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.05, 48),
    darkMaterial,
  ), 'fixed-grimshaw-anvil-face');
  anvilFace.position.set(hammerAxisX, anvilTopY - 0.025, 0);
  anvil.add(anvilFace);
  const anvilStand = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.20, 0.92),
    frameMaterial,
  );
  anvilStand.position.set(hammerAxisX, groundY + 0.20, 0);

  const throttleTreadle = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.10, 0.24),
    rodMaterial,
  ), 'foot-treadle-K-throttle-control');
  throttleTreadle.position.set(0.48, groundY + 0.28, 0.58);
  throttleTreadle.rotation.z = -0.14;
  const safetyValve = addRole(new THREE.Group(),
    'adjustable-reservoir-safety-valve');
  safetyValve.position.set(-0.13, 0.20, 0.06);
  const safetyStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.42, 16),
    brassMaterial,
  );
  safetyValve.add(safetyStem);
  const safetyWeight = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 20, 14),
    driveMaterial,
  );
  safetyWeight.position.y = 0.16;
  safetyValve.add(safetyWeight);

  const update = (time) => {
    const state = stateAtTime(time);
    driveAssembly.rotation.x = state.pump.driveAngle;
    frictionWheelAssembly.rotation.x = state.friction.wheelAngle;
    frictionDiskAssembly.rotation.y = state.friction.diskAngle;
    pumpPistonAssembly.position.set(
      pumpAxisX,
      state.pump.pistonCenterY,
      pumpAxisZ,
    );
    setRodBetween(
      pumpConnectingRod,
      state.pump.crankPin,
      state.pump.pistonPin,
    );
    pumpLowerAir.scale.y = Math.max(0.001,
      state.pump.lowerChamberHeight);
    pumpLowerAir.position.set(
      pumpAxisX,
      pumpCylinderInnerBottomY + state.pump.lowerChamberHeight / 2,
      pumpAxisZ,
    );
    pumpUpperAir.scale.y = Math.max(0.001,
      state.pump.upperChamberHeight);
    pumpUpperAir.position.set(
      pumpAxisX,
      state.pump.pistonTopY + state.pump.upperChamberHeight / 2,
      pumpAxisZ,
    );
    for (const valve of pumpCheckValves) {
      const open = state.pump[valve.userData.stateKey];
      valve.scale.setScalar(open ? 1.28 : 0.82);
    }

    slideValve.position.copy(state.valve.sliderPin);
    setRodBetween(
      valveConnectingRod,
      state.valve.crankPin,
      state.valve.sliderPin,
    );
    hammerAssembly.position.set(
      hammerAxisX,
      state.hammer.pistonCenterY,
      hammerAxisZ,
    );
    lowerHammerAir.scale.y = Math.max(0.001,
      state.pneumatic.lowerChamberHeight);
    lowerHammerAir.position.set(
      hammerAxisX,
      hammerCylinderInnerBottomY
        + state.pneumatic.lowerChamberHeight / 2,
      hammerAxisZ,
    );
    upperHammerAir.scale.y = Math.max(0.001,
      state.pneumatic.upperChamberHeight);
    upperHammerAir.position.set(
      hammerAxisX,
      state.pneumatic.pistonTopY
        + state.pneumatic.upperChamberHeight / 2,
      hammerAxisZ,
    );
    lowerHammerAir.visible = state.pneumatic.lowerPressurePascal
      > atmosphericPressurePascal * 1.005;
    upperHammerAir.visible = state.pneumatic.upperPressurePascal
      > atmosphericPressurePascal * 1.005;
  };

  const geometry = {
    anvilTopY,
    atmosphericPressurePascal,
    driveAngularVelocity,
    driveCycleDuration,
    educationalTimeScale,
    frictionContactRadius,
    frictionDiskCenter: frictionDiskCenter.clone(),
    frictionSpeedRatio,
    frictionWheelCenter: frictionWheelCenter.clone(),
    frictionWheelRadius,
    hammerAxisX,
    hammerAxisZ,
    hammerCycleDuration,
    hammerCylinderInnerBottomY,
    hammerCylinderInnerTopY,
    hammerHeadBottomCenterY,
    hammerHeadHeight,
    hammerInnerRadius,
    hammerPistonArea,
    hammerPistonBottomCenterY,
    hammerPistonThickness,
    hammerStroke,
    impactSpeedVisualUnitsPerSecond,
    lowerAdmissionStartPhase,
    lowerCutoffPhase,
    lowerCutoffVolume,
    lowerExpansionConstant,
    physicalHammerPistonAreaSquareMetre,
    polytropicExponent,
    pressurePascalPerPsi,
    pumpAxisX,
    pumpAxisZ,
    pumpConnectingRodLength,
    pumpCrankRadius,
    pumpCylinderInnerBottomY,
    pumpCylinderInnerTopY,
    pumpDeliveredVolumePerDriveRevolution,
    pumpInnerRadius,
    pumpPistonArea,
    pumpPistonThickness,
    pumpWristOffset,
    pumpStroke,
    reservoirAbsolutePressurePascal,
    reservoirGaugePressurePascal,
    shaftCenter: shaftCenter.clone(),
    sourceHammerBlowsPerMinute,
    sourceHammerPistonBoreInch,
    sourceHammerStrokeInch,
    sourceMainShaftRpm,
    sourcePumpBoreInch,
    sourcePumpStrokeInch,
    sourceTypicalGaugePressurePsi,
    upperAdmissionStartPhase,
    upperCutoffPhase,
    upperCutoffVolume,
    upperExpansionConstant,
    valveConnectingRodLength,
    valveCrankRadius,
    valveDiskAngularVelocity,
    valveChestX,
    valveLeftSliderX,
    valveLinkageY,
    valveNeutralSliderX,
    valveRightSliderX,
    valveSliderAxisZ,
    visualUnitsPerSourceInch,
    sourcePoseTimeOffset,
    brownUnitsPerPixel,
    brownPumpBorePixels,
    brownHammerStrokePixels,
    frictionDiskThickness,
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    animationTiming: {
      // Two shaft turns equal three valve/hammer cycles, returning every
      // moving member to the same phase.
      authoredCyclePeriod: 2 * driveCycleDuration,
    },
    archetype:
      'grimshaw-compressed-air-hammer-with-double-acting-pump-hollow-frame-reservoir-variable-friction-disk-driven-slide-valve-adjustable-cutoff-and-double-acting-hammer-piston',
    blocks: {
      anvil,
      anvilFace,
      cutoffSlides,
      deliveryPipe,
      driveAssembly,
      drivePulley,
      driveShaft,
      exhaustPort,
      fixedHammerCylinder,
      frictionContactTrack,
      frictionDisk,
      frictionDiskAssembly,
      frictionShiftLever,
      frictionWheel,
      frictionWheelAssembly,
      foundation,
      hammerAssembly,
      hammerCylinderRings,
      hammerCylinderShell,
      hammerFace,
      hammerHead,
      hammerPiston,
      hammerPistonRod,
      hammerSupport,
      hollowReservoirFrame,
      lowerHammerAir,
      pumpCheckValves,
      pumpConnectingRod,
      pumpCrankArm,
      pumpCylinder,
      pumpEndRings,
      pumpLowerAir,
      pumpPiston,
      pumpPistonAssembly,
      pumpShell,
      pumpUpperAir,
      pumpValveChest,
      reservoirAir,
      reservoirFoot,
      reservoirSupplyPipe,
      safetyValve,
      slideValve,
      throttleTreadle,
      upperHammerAir,
      valveChest,
      valveConnectingRod,
      valveCrankPinVisual,
    },
    chamberGeometryAtHammerPhase,
    degreesOfFreedom: {
      hammerPistonAndHeadIndependent: false,
      mainShaftToPumpIndependent: false,
      mainShaftToValveDiskIndependent: false,
      physicalOperatingDegreesOfFreedom: 3,
      prescribedRotaryInputs: 1,
      pumpAndHammerSharePosition: false,
    },
    dynamics: {
      fullCompressibleFlowValveLossLeakageThermalFrictionImpactAndReservoirMassBalanceSolved:
        false,
      hammerModel:
        'The piston, rod and hammer are rigid. Their schedule preserves the two powered strokes, adjustable cutoffs, finite-speed blow and impact reset; it is not claimed as a numerical prediction without the source’s missing moving mass, port area and loss data.',
      reservoirModel:
        'The hollow frame is represented as a large safety-valve-regulated plenum at the inventor’s ordinary 20 psi gauge setting. Pump delivery is exact geometrically; pressure ripple and blower diversion while idle are disclosed rather than invented.',
    },
    fidelity: 'authored',
    geometry,
    hammerKinematicsAtPhase,
    mechanism:
      'Shaft E directly cranks the double-acting pump D, which delivers on both piston strokes into hollow-frame reservoir C. A feathered leather-faced wheel on E rolls without slip on a horizontal disk at a selected radius, making the disk and slide valve run faster than E. The valve admits reservoir air alternately below and above piston A while exhausting the opposite side; fixed cutoff slides end admission early, the trapped charge expands, and the rigid piston-rod-head strikes the anvil.',
    motion: {
      driveCycleDuration,
      educationalTimeScale,
      hammerCycleDuration,
      motionType:
        'constant-speed-main-shaft-exact-double-acting-pump-no-slip-variable-radius-friction-valve-and-double-acting-cutoff-air-hammer',
    },
    pneumaticStateAtHammerPhase,
    pumpKinematicsAtDrivePhase,
    pumpStateAtDrivePhase,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      sourcePrescribedAbsoluteTiming: true,
      sourcePrescribedNormalizedTiming: false,
    },
    sourcePose: {
      hammerLift: sourceState.hammer.lift,
      pumpPistonCenterY: sourceState.pump.pistonCenterY,
      slideValveX: sourceState.valve.sliderPin.x,
    },
    sourceReference: {
      brownPlate472: {
        approximateHammerCylinderBBoundsPixels: [386, 84, 91, 184],
        approximateHollowReservoirCBoundsPixels: [190, 177, 236, 279],
        approximatePumpDBoundsPixels: [106, 304, 81, 151],
        approximateShaftEBoundsPixels: [117, 85, 290, 116],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 14,
      },
      brownConstructionEvidence: {
        explicitInBrownDescription: [
          'hammer head is attached to piston A working inside cylinder B',
          'slide valve on top admits air above and below the hammer piston like steam in a steam engine',
          'air comes from reservoir C formed in the framing',
          'air pump D is driven by a crank on rotary shaft E',
        ],
        engravingEvidence:
          'Brown shows pump D at lower left, shaft E and its drive pulley across the top, the hollow curved frame C, a valve linkage along the crown, and fixed cylinder B over piston A and the anvil at right.',
      },
      grimshaw1865Paper: {
        dimensionsAndOperation: [
          'double-acting pump: 8 inch bore and 8 inch stroke',
          'hammer piston: 4.5 inch bore and 10 inch full stroke',
          'ordinary reservoir pressure: about 20 psi gauge',
          'slide valve alternately admits compressed air below and above the piston and cylinder side port exhausts',
          'leather-faced wheel slides on feathered main shaft and contacts horizontal disk at variable radius',
          'main shaft normally 150 to 200 rpm and friction drive varies hammer rate from 150 to 420 blows per minute',
          'separate adjustable cutoff slides regulate the quality of the blow',
        ],
        publication:
          'William D. Grimshaw, High-Speed Compressed-Air Hammer, Civil Engineer and Architect’s Journal, December 1865, pages 351–353',
      },
      grimshawPatent45896: {
        claimsRepresented: [
          'compressed-air reservoir formed in hollow airtight framework between pump and hammer cylinder',
          'double-acting pump with four check valves driven by a crank on the driving pulley',
          'slide valve driven by crank disk through a variable-radius friction wheel on the feathered shaft',
          'adjustable cutoff blocks associated with the slide valve',
        ],
        date: '1865-01-10',
        patentNumber: 'US45896A',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 472',
      reconstructionDisclosure:
        'The 1865 paper supplies principal bores, strokes, pressure and operating-speed ranges but not every plate dimension, valve-lap curve, piston mass, port area, loss coefficient or contact setting. Brown’s proportions determine the layout: one broad cast frame C in the plane of the parts, a small pump D in its base pocket, cylinder B in a yoke at the head, and the anvil on an arched pedestal. Pump D’s bore and piston A’s travel follow the plate (about 4 in and 4.1 in at the 4.5-in hammer-bore scale), not the paper’s 8-in pump bore and 10-in stroke. The four pump checks, safety valve, throttle treadle, speed lever and exhaust port, which Brown does not draw, are not shown. The selected 180 rpm shaft, 270 blows/minute 1.5:1 friction setting, 20 psi gauge plenum, 1.35 expansion exponent, cutoff phases, display slowdown, colors and ideal impact are explicit reconstruction choices.',
    },
    stateAtTime,
    transmission: {
      airCircuit:
        'four-check-valve double-acting pump D -> regulated hollow-frame reservoir C -> throttle -> slide valve -> alternate hammer chambers -> side exhaust',
      frictionDrive:
        'omega_disk / omega_shaft = friction-wheel radius / selected disk contact radius = 1.5, with zero ideal tangential-speed residual',
      pumpDrive:
        'shaft-E crank pin to pump-D piston pin remains one constant connecting-rod length on a vertical slider axis',
      rigidHammer:
        'piston A, its rod, head and striking face share one vertical translation inside fixed cylinder B',
    },
    update,
    valveKinematicsAtHammerPhase,
  };
  correctHammerWorkingParts(root, 472);
  // The shared correction runs shell B 0.08 past each inner end, through the
  // full-radius heads, so the shell's outer wall and its section faces lay on
  // the heads' and z-fought (p88). Shell B is now only the barrel between the
  // heads; the heads close its ends face to face.
  hammerCylinderShell.geometry.dispose();
  hammerCylinderShell.geometry = boredLatheGeometry([
    {radial: hammerInnerRadius + 0.085, axial: -hammerCylinderHalfHeight},
    {radial: hammerInnerRadius + 0.085, axial: hammerCylinderHalfHeight},
  ], hammerInnerRadius, 64);
  // The shared correction bores the friction wheel to its full radius; keep
  // the leather tyre as its bearing face (bored wheel body inside it).
  frictionWheel.geometry.dispose();
  frictionWheel.geometry = boredLatheGeometry([
    {radial: frictionWheelRadius - frictionTyreThickness, axial: -0.08},
    {radial: frictionWheelRadius - frictionTyreThickness, axial: 0.08},
  ], 0.087, 96);
  buildBroadHollowFrame(root, bx, by, shaftCenter);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(bx(78), groundY - 0.02, -1.10),
    new THREE.Vector3(bx(1002), 4.08, 1.10),
  );
  root.userData.cameraDistanceScale = 1.00;
  root.userData.cameraDirection = new THREE.Vector3(.7, 1.0, 15);
  root.userData.groundFloorY = groundY;

  markShadows(root);
  for (const object of [hammerCylinderShell, pumpShell, reservoirAir,
    lowerHammerAir, upperHammerAir, pumpLowerAir, pumpUpperAir,
    valveChest]) {
    object.castShadow = false;
  }
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredCompressedAirHammerMovement(movement) {
  if (movement.id !== 472) return null;
  return applyCutawayFor(grimshawCompressedAirHammer(movement), movement.id);
}
