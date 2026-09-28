import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import {plate, poly, circle, capsule, polygonClipping as clip} from './finite-plate-geometry.js';
import {horizontalPlate, horizontalRing} from './horizontal-turbine-solids.js';
import {curvedPipeWall, mergePassageParts} from './finite-fluid-passages.js';
import {fitPistonGuide} from './piston-guide-parts.js';
import {PALETTE, markShadows, matte} from './primitives.js';

// Movement 483, Brown's dry gas meter, rebuilt element by element from the
// plate (pass 74). Plate pixels (525 px image) map to scene units by
// x = (px - 262) / 50, y = (330 - py) / 50; z is depth (+z toward the viewer).
//
// What Brown draws, left to right below the valve shelf:
//   case wall | fixed end board | leather | moving plate (pins top and
//   bottom) | leather | fixed inner board | central partition | fixed inner
//   board | leather | moving plate (flags to a vertical rod) | leather |
//   fixed end board | case wall.
// Each chamber A, A' is therefore a closed double bellows: its moving plate
// divides it into an outer and an inner measuring space. The left plate is
// drawn at mid-stroke and the right plate at the end of its stroke (inner
// leather closed up, outer drawn out), i.e. the two plates work a quarter
// turn apart, as in every two-diaphragm dry meter.
// Above the shelf Brown draws valve B (an inverted cup, sectioned), a C-shaped
// bracket holding B's vertical spindle, a bar at the top running to the pin
// of the vertical rod on the right, the tall outlet column on the left and a
// plain box (the dial-work case) at the upper right.
//
// Reconstruction: each plate is worked through a flag (arm on a vertical flag
// rod plus a short link to the plate's pin). Each flag rod has an arm at its
// top, and a link from that arm to a crank pin on the spindle of B, so the two
// rocking flag rods turn the spindle continuously; the crank pins are a
// quarter turn apart. B is a D-shaped cup turning on a seat with a central
// exhaust port and one port for each of the four measuring spaces: the
// ports under the cup exhaust (to the outlet column through a passage cored
// in the shelf), the ports outside it admit the gas that fills the case.
// The right flag rod stands in front of the bellows as Brown draws it; the
// left one stands behind the left chamber, where the plate's pins point.

const FULL_TURN = Math.PI * 2;
const px = (value) => (value - 262) / 50;
const py = (value) => (330 - value) / 50;

const LAYOUT = Object.freeze({
  wallInnerX: 2.80,
  wallOuterX: 3.24,
  floorTopY: -3.14,
  roofBottomY: 5.90,
  backZ: -1.90,
  // The back wall is as thick as the side walls' 0.44 plus a little: the four
  // port passages are cored inside it (see the ducts below).
  backOuterZ: -2.40,
  frontZ: 2.20,
  endBoardFaceX: 2.50,
  innerBoardFaceX: 0.33,
  partitionHalf: 0.04,
  bellowsHalfHeight: 2.54,
  bellowsHalfDepth: 1.10,
  plateThickness: 0.26,
  foldLeather: 0.88,
  shelfTopY: 3.64,
  shelfBottomY: 3.40,
  shelfEndX: px(300),
  seatEndX: px(340),
  crankCenter: [0.56, 0],
  crankRadius: 0.5,
  valveOuterRadius: 0.70,
  valveTopY: py(114),
  portRadius: 0.40,
  portHoleRadius: 0.085,
  exhaustHoleRadius: 0.11,
  columnCenter: [px(135), 0.6],
  flagY: 2.80,
});

function circleIntersection(c0, r0, c1, r1, branch) {
  const dx = c1[0] - c0[0], dz = c1[1] - c0[1];
  const d = Math.hypot(dx, dz);
  const a = (d * d + r0 * r0 - r1 * r1) / (2 * d);
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const ux = dx / d, uz = dz / d;
  const mx = c0[0] + a * ux, mz = c0[1] + a * uz;
  return branch === 0 ? [mx - h * uz, mz + h * ux] : [mx + h * uz, mz - h * ux];
}

// A four-bar from the crank pin to a flag rod's top arm, and the flag from the
// rod to its plate. Angles are measured in the xz plane from +x toward +z.
const FLAG_LINKAGES = Object.freeze({
  right: {
    rod: [1.95, 1.30], armLength: 1.0,
    crankOffset: 0, branch: 0,
    flagOffset: THREE.MathUtils.degToRad(-16), flagArm: 1.035, flagLink: 0.67, pinSide: -1,
  },
  left: {
    rod: [-1.90, -1.35], armLength: 1.0,
    crankOffset: THREE.MathUtils.degToRad(85), branch: 0,
    flagOffset: THREE.MathUtils.degToRad(-10.8), flagArm: 1.04, flagLink: 0.66, pinSide: 1,
  },
});

// Link length that makes the crank-rocker symmetric: the two dead points of
// the rocker fall exactly half a turn of the crank apart, so each measuring
// space closes during exactly half a turn and B's half-round cavity can
// exhaust it for exactly that half turn. (The rocker pin's chord between its
// dead points then points at the crank centre: d^2 = l^2 + a^2 - r^2.)
function symmetricLinkLength(spec, layout = LAYOUT) {
  const d = Math.hypot(spec.rod[0] - layout.crankCenter[0], spec.rod[1] - layout.crankCenter[1]);
  return Math.sqrt(d * d - spec.armLength ** 2 + layout.crankRadius ** 2);
}

function linkageState(spec, crankAngle, layout = LAYOUT) {
  const [ox, oz] = layout.crankCenter;
  const pin = [ox + layout.crankRadius * Math.cos(crankAngle + spec.crankOffset),
    oz + layout.crankRadius * Math.sin(crankAngle + spec.crankOffset)];
  const armTip = circleIntersection(spec.rod, spec.armLength, pin, spec.linkLength, spec.branch);
  const rockerAngle = Math.atan2(armTip[1] - spec.rod[1], armTip[0] - spec.rod[0]);
  const flagAngle = rockerAngle + spec.flagOffset;
  const flagTip = [spec.rod[0] + spec.flagArm * Math.cos(flagAngle), spec.rod[1] + spec.flagArm * Math.sin(flagAngle)];
  const plateX = flagTip[0] + spec.pinSide * Math.sqrt(Math.max(0, spec.flagLink ** 2 - flagTip[1] ** 2));
  return {armTip, crankPin: pin, flagAngle, flagTip, plateX, rockerAngle};
}

function superellipsePoints(halfHeight, halfDepth, count = 64, exponent = 4) {
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const t = FULL_TURN * index / count;
    const c = Math.cos(t), s = Math.sin(t);
    points.push([
      halfHeight * Math.sign(c) * Math.abs(c) ** (2 / exponent),
      halfDepth * Math.sign(s) * Math.abs(s) ** (2 / exponent),
    ]);
  }
  return points;
}

// One leather segment between two faces, drawn in by one V fold at its middle.
// The leather has a constant slant length f on each side of the fold, so the
// fold is deep when the segment is closed up and shallow when drawn out.
function createLeatherSegment(material, role, layout = LAYOUT) {
  const around = 64, rings = 33;
  const section = superellipsePoints(layout.bellowsHalfHeight, layout.bellowsHalfDepth, around);
  const positions = new Float32Array(rings * around * 3);
  const indices = [];
  for (let i = 0; i < rings - 1; i += 1) for (let j = 0; j < around; j += 1) {
    const a = i * around + j, b = i * around + (j + 1) % around;
    const c = (i + 1) * around + (j + 1) % around, d = (i + 1) * around + j;
    indices.push(a, b, d, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(positions, 3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attribute);
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.role = role;
  const update = (x0, x1) => {
    const length = Math.abs(x1 - x0);
    const dip = Math.sqrt(Math.max(0, layout.foldLeather ** 2 - (length / 2) ** 2));
    let cursor = 0;
    for (let i = 0; i < rings; i += 1) {
      const u = i / (rings - 1);
      const x = THREE.MathUtils.lerp(x0, x1, u);
      const v = 1 - Math.abs(2 * u - 1);
      const scale = 1 - dip / layout.bellowsHalfHeight * v;
      for (let j = 0; j < around; j += 1) {
        positions[cursor] = x;
        positions[cursor + 1] = section[j][0] * scale;
        positions[cursor + 2] = section[j][1] * scale;
        cursor += 3;
      }
    }
    attribute.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return dip;
  };
  return {mesh, update};
}

// Plan shapes are given in (x, z); horizontalPlate extrudes them upward.
const planPoly = (points) => poly(points.map(([x, z]) => [x, -z]));
const planCircle = ([x, z], r, n = 48) => poly(circle([x, -z], r, n));
const planCapsule = ([x0, z0], [x1, z1], r) => capsule([x0, -z0], [x1, -z1], r, 24);
const planRect = (x0, x1, z0, z1) => planPoly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);

function boxBetween(x0, x1, y0, y1, z0, z1) {
  return new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

// A bar of given length along +x from the origin, with rounded eyes.
function barGeometry(length, width, low, high, eyeRadius = width / 2, holes = []) {
  const outline = clip.union(capsule([0, 0], [length, 0], width / 2, 24), poly(circle([0, 0], eyeRadius, 32)), poly(circle([length, 0], eyeRadius, 32)));
  const cut = holes.length ? clip.difference(outline, ...holes.map(([x, r]) => poly(circle([x, 0], r, 24)))) : outline;
  return horizontalPlate(cut, low, high);
}

function roundedPolyline(points, radius) {
  const path = new THREE.CurvePath();
  let start = points[0].clone();
  for (let index = 1; index < points.length - 1; index += 1) {
    const corner = points[index];
    const inDir = corner.clone().sub(points[index - 1]).normalize();
    const outDir = points[index + 1].clone().sub(corner).normalize();
    const r = Math.min(radius, corner.distanceTo(points[index - 1]) / 2, corner.distanceTo(points[index + 1]) / 2);
    const a = corner.clone().addScaledVector(inDir, -r);
    const b = corner.clone().addScaledVector(outDir, r);
    path.add(new THREE.LineCurve3(start, a));
    path.add(new THREE.QuadraticBezierCurve3(a, corner.clone(), b));
    start = b;
  }
  path.add(new THREE.LineCurve3(start, points.at(-1).clone()));
  return path;
}

function valveBGeometry(layout = LAYOUT) {
  // B seen in plan: a D (half disc) that also covers the central exhaust
  // port; its cavity is a smaller D. Walls, top and a foot flange, as
  // Brown's section shows (cup with a stepped foot).
  const R = layout.valveOuterRadius;
  const halfDisc = (radius) => {
    const points = [];
    for (let i = 0; i <= 48; i += 1) {
      const t = -Math.PI / 2 + Math.PI * i / 48;
      points.push([radius * Math.cos(t), radius * Math.sin(t)]);
    }
    return points;
  };
  const outer = clip.union(planPoly(halfDisc(R)), planCircle([0, 0], 0.26, 48));
  const flange = clip.union(planPoly(halfDisc(0.84)), planCircle([0, 0], 0.32, 48));
  const cavity = clip.union(planPoly(halfDisc(0.58)), planCircle([0, 0], 0.17, 48));
  const y0 = layout.shelfTopY, y1 = layout.valveTopY, yFlange = py(131);
  return mergePassageParts([
    horizontalPlate(clip.difference(flange, cavity), y0, yFlange),
    horizontalPlate(clip.difference(outer, cavity), yFlange, y1 - 0.18),
    horizontalPlate(outer, y1 - 0.18, y1),
  ]);
}

function dryGasMeter(movement) {
  const L = LAYOUT;
  const root = new THREE.Group();
  const cycleDuration = 8;
  const right = {...FLAG_LINKAGES.right, linkLength: symmetricLinkLength(FLAG_LINKAGES.right)};
  const left = {...FLAG_LINKAGES.left, linkLength: symmetricLinkLength(FLAG_LINKAGES.left)};

  const halfPlate = L.plateThickness / 2;
  const spaces = [
    {key: 'A-outer', side: 'left', port: null, board: -(L.endBoardFaceX + 0.15)},
    {key: 'A-inner', side: 'left', port: null, board: -(L.innerBoardFaceX - 0.145)},
    {key: 'A-prime-inner', side: 'right', port: null, board: L.innerBoardFaceX - 0.145},
    {key: 'A-prime-outer', side: 'right', port: null, board: L.endBoardFaceX + 0.15},
  ];
  const spaceLengths = (leftX, rightX) => [
    leftX - halfPlate + L.endBoardFaceX,
    -L.innerBoardFaceX - (leftX + halfPlate),
    rightX - halfPlate - L.innerBoardFaceX,
    L.endBoardFaceX - (rightX + halfPlate),
  ];
  const bellowsArea = Math.PI * L.bellowsHalfHeight * L.bellowsHalfDepth * 0.93;

  // Port timing from the kinematics: each space exhausts while it closes.
  const samples = 720;
  const lengthTable = [];
  for (let i = 0; i <= samples; i += 1) {
    const phi = FULL_TURN * i / samples;
    lengthTable.push(spaceLengths(linkageState(left, phi).plateX, linkageState(right, phi).plateX));
  }
  const strokeLengths = spaces.map((_, k) => Math.max(...lengthTable.map((row) => row[k])) - Math.min(...lengthTable.map((row) => row[k])));
  // Each space closes from the crank angle of its greatest length to that of
  // its least; its port is set at the middle of that interval.
  const closingCenter = spaces.map((_, k) => {
    const column = lengthTable.slice(0, samples).map((row) => row[k]);
    const iMax = column.indexOf(Math.max(...column)), iMin = column.indexOf(Math.min(...column));
    const span = THREE.MathUtils.euclideanModulo(iMin - iMax, samples);
    return FULL_TURN * (iMax + span / 2) / samples;
  });
  // Choose B's orientation on its spindle so that no port lies on the
  // exhaust passage leading to the column.
  const [ox, oz] = L.crankCenter;
  const channelAngle = Math.atan2(L.columnCenter[1] - oz, L.columnCenter[0] - ox);
  // Brown's pose at time zero: A' at the end of its stroke with its inner
  // leather closed up (so A is at mid-stroke).
  const rightColumn = lengthTable.slice(0, samples).map((row) => row[2]);
  const crankAngleAtZero = FULL_TURN * rightColumn.indexOf(Math.min(...rightColumn)) / samples;
  // Of the equally good orientations, B shows its round side to the viewer
  // in Brown's pose, as his section of a cup.
  let valveOffset = 0, bestScore = -Infinity;
  for (let deg = 0; deg < 360; deg += 1) {
    const offset = THREE.MathUtils.degToRad(deg);
    const clearance = Math.min(...closingCenter.map((c) => Math.abs(Math.atan2(Math.sin(c + offset - channelAngle), Math.cos(c + offset - channelAngle)))));
    const facing = Math.cos(crankAngleAtZero + offset - Math.PI / 2);
    const score = Math.round(clearance * 1000) + 0.01 * facing;
    if (score > bestScore) {bestScore = score;valveOffset = offset;}
  }
  spaces.forEach((space, k) => {
    space.portAngle = closingCenter[k] + valveOffset;
    space.port = [ox + L.portRadius * Math.cos(space.portAngle), oz + L.portRadius * Math.sin(space.portAngle)];
  });
  const portLapAngle = (L.portHoleRadius + 0.04) / L.portRadius;
  const volumePerRevolution = strokeLengths.reduce((sum, stroke) => sum + stroke, 0) * bellowsArea;

  const stateAtTime = (time) => {
    const crankAngle = crankAngleAtZero + FULL_TURN * time / cycleDuration;
    const leftState = linkageState(left, crankAngle);
    const rightState = linkageState(right, crankAngle);
    const lengths = spaceLengths(leftState.plateX, rightState.plateX);
    const valveAngle = crankAngle + valveOffset;
    const ports = spaces.map((space) => {
      const relative = Math.atan2(Math.sin(space.portAngle - valveAngle), Math.cos(space.portAngle - valveAngle));
      const fromEdge = Math.abs(relative) - Math.PI / 2;
      return {
        key: space.key,
        state: fromEdge < -portLapAngle ? 'exhaust' : fromEdge > portLapAngle ? 'admit' : 'covered',
        relative,
      };
    });
    return {
      crankAngle,
      cumulativeMeasuredVolume: volumePerRevolution * time / cycleDuration,
      left: leftState,
      phase: THREE.MathUtils.euclideanModulo(time / cycleDuration, 1),
      ports,
      right: rightState,
      spaceLengths: lengths,
      spaceVolumes: lengths.map((length) => length * bellowsArea),
      valveAngle,
    };
  };

  // ---- materials
  const caseMaterial = matte(PALETTE.frame, {metalness: 0.2, roughness: 0.55});
  const boardMaterial = matte(PALETTE.muted, {metalness: 0.12, roughness: 0.6});
  const leatherMaterial = matte(0x7b5b3e, {metalness: 0.02, roughness: 0.85, side: THREE.DoubleSide});
  // Stone rather than paper: a paper-coloured back panel reads as a hole.
  const backMaterial = matte(0xbfb6a0, {roughness: 0.95}); // the ground-block.js stone
  const plateAMaterial = matte(PALETTE.driven, {metalness: 0.17, roughness: 0.42});
  const plateAPrimeMaterial = matte(PALETTE.accent, {metalness: 0.17, roughness: 0.42});
  const valveMaterial = matte(PALETTE.driver, {metalness: 0.23, roughness: 0.38});
  const ironMaterial = matte(PALETTE.ink, {metalness: 0.35, roughness: 0.4});
  const pipeMaterial = matte(PALETTE.frame, {metalness: 0.25, roughness: 0.44});

  const addMesh = (parent, geometry, material, role) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.role = role;
    parent.add(mesh);
    return mesh;
  };

  // ---- fixed case (front removed, as Brown shows it)
  const fixedCase = new THREE.Group();
  fixedCase.userData.role = 'fixed-gas-tight-dry-meter-case';
  root.add(fixedCase);
  const floor = addMesh(fixedCase, boxBetween(-L.wallOuterX, L.wallOuterX, L.floorTopY - 0.12, L.floorTopY, L.backOuterZ, L.frontZ), caseMaterial, 'fixed-dry-meter-floor');
  const walls = [-1, 1].map((side) => addMesh(fixedCase,
    boxBetween(side < 0 ? -L.wallOuterX : L.wallInnerX, side < 0 ? -L.wallInnerX : L.wallOuterX, L.floorTopY, L.roofBottomY, L.backOuterZ, L.frontZ),
    caseMaterial, side < 0 ? 'fixed-left-case-wall' : 'fixed-right-case-wall'));
  const backPanel = addMesh(fixedCase, boxBetween(-L.wallInnerX, L.wallInnerX, L.floorTopY, L.roofBottomY, L.backOuterZ, L.backZ), caseMaterial, 'fixed-back-panel-of-case');
  const roof = addMesh(fixedCase, horizontalPlate(clip.difference(
    planRect(-L.wallOuterX, L.wallOuterX, L.backOuterZ, L.frontZ),
    planCircle(L.columnCenter, 0.205, 64)), L.roofBottomY, L.roofBottomY + 0.12), caseMaterial, 'fixed-dry-meter-roof');

  // Brown's thick shelf carries B's seat; the exhaust passage from B's
  // central port to the outlet column is cored between its layers.
  const portHoles = () => spaces.map((space) => planCircle(space.port, L.portHoleRadius, 32));
  const rodBore = planCircle(left.rod, 0.075, 32);
  const centerHole = planCircle(L.crankCenter, L.exhaustHoleRadius, 32);
  const columnHole = planCircle(L.columnCenter, 0.14, 48);
  const shelfOutline = planRect(-L.wallInnerX, L.shelfEndX, L.backZ, L.frontZ);
  const seatOutline = planRect(L.shelfEndX, L.seatEndX, -1.0, 1.0);
  const passage = clip.union(planCapsule(L.crankCenter, L.columnCenter, 0.075), planCircle(L.crankCenter, L.exhaustHoleRadius, 32), planCircle(L.columnCenter, 0.14, 48));
  const shelf = addMesh(fixedCase, mergePassageParts([
    horizontalPlate(clip.difference(shelfOutline, ...portHoles(), centerHole, columnHole, rodBore), L.shelfTopY - 0.08, L.shelfTopY),
    horizontalPlate(clip.difference(shelfOutline, ...portHoles(), passage, rodBore), L.shelfTopY - 0.18, L.shelfTopY - 0.08),
    horizontalPlate(clip.difference(shelfOutline, ...portHoles(), rodBore), L.shelfBottomY, L.shelfTopY - 0.18),
    horizontalPlate(clip.difference(seatOutline, ...portHoles()), L.shelfTopY - 0.10, L.shelfTopY),
  ]), caseMaterial, 'fixed-shelf-carrying-seat-of-B-with-cored-exhaust-passage');

  // Fixed boards and the central partition.
  const boardGeometry = (x0, x1) => boxBetween(x0, x1, -L.bellowsHalfHeight, L.bellowsHalfHeight, -L.bellowsHalfDepth, L.bellowsHalfDepth);
  const fixedBoards = [
    addMesh(fixedCase, boardGeometry(-L.wallInnerX, -L.endBoardFaceX), boardMaterial, 'fixed-outer-end-board-of-A'),
    addMesh(fixedCase, boardGeometry(-L.innerBoardFaceX, -L.partitionHalf), boardMaterial, 'fixed-inner-end-board-of-A'),
    addMesh(fixedCase, boardGeometry(L.partitionHalf, L.innerBoardFaceX), boardMaterial, 'fixed-inner-end-board-of-A-prime'),
    addMesh(fixedCase, boardGeometry(L.endBoardFaceX, L.wallInnerX), boardMaterial, 'fixed-outer-end-board-of-A-prime'),
  ];
  const partition = addMesh(fixedCase, boxBetween(-L.partitionHalf, L.partitionHalf, L.floorTopY, L.shelfBottomY, -L.bellowsHalfDepth, L.bellowsHalfDepth), boardMaterial, 'fixed-central-partition-between-A-and-A-prime');

  // Outlet column (Brown's tall pipe at the left) and the unseen inlet at the
  // back of the case.
  const columnCurve = new THREE.LineCurve3(new THREE.Vector3(L.columnCenter[0], L.shelfTopY, L.columnCenter[1]), new THREE.Vector3(L.columnCenter[0], py(5), L.columnCenter[1]));
  const outletColumn = addMesh(fixedCase, curvedPipeWall(columnCurve, 0.14, 0.20, 8, 40), pipeMaterial, 'fixed-outlet-column-from-exhaust-of-B');
  // The inlet enters through the back of the case behind the dial-work box.
  const inletCurve = new THREE.LineCurve3(new THREE.Vector3(2.2, 4.6, L.backOuterZ), new THREE.Vector3(2.2, 4.6, L.backOuterZ - 0.3));
  const inletPipe = addMesh(fixedCase, curvedPipeWall(inletCurve, 0.10, 0.15, 4, 32), pipeMaterial, 'fixed-inlet-through-back-of-case');
  // (the back panel is bored for it below)
  backPanel.material = backMaterial;

  // Dial-work case: the plain box Brown draws at the upper right.
  const dialCase = addMesh(fixedCase, boxBetween(L.seatEndX, L.wallInnerX, py(165), L.roofBottomY, 1.45, L.frontZ), caseMaterial, 'fixed-dial-work-case-at-upper-right');

  // Ducts from the four seat ports to the fixed boards of their spaces.
  const ductRuns = [];
  // Pass 83: each duct drops only a little below the shelf, to one of two
  // levels, and runs straight back into the thick back wall. Inside the wall
  // it runs in a passage cored in one of two layers and leaves the wall's
  // front face level with its board, straight into that board: the fixed
  // boards run back to the wall, and a passage cored in the board turns out
  // of the board's face into its measuring space. Nothing of a duct shows
  // between the shelf and the boards but the short drops and elbows under
  // the shelf. The front duct of each pair under the shelf lies lower, so
  // no drop meets a run; in the wall, the two ducts of a layer are routed
  // round each other (A outer goes up over A' outer's entry). Inside the
  // wall and the boards each duct is a liner in a close bore.
  const layerZ = [-2.06, -2.24];
  const bore = 0.075;
  const boardPassageZ = -0.60;
  // [level under the shelf, level in the board, layer, in-wall route]
  const ductRoute = {
    'A-outer': [3.29, 2.20, 1, (x, bx) => [[x, 3.29], [x, 3.60], [bx, 3.60], [bx, 2.20]]],
    'A-inner': [3.10, 2.30, 0, (x, bx) => [[x, 3.10], [bx, 3.10], [bx, 2.30]]],
    'A-prime-inner': [3.10, 1.90, 0, (x, bx) => [[x, 3.10], [x, 1.90], [bx, 1.90]]],
    'A-prime-outer': [3.29, 2.30, 1, (x, bx) => [[x, 3.29], [x, 2.30], [bx, 2.30]]],
  };
  // Board of each space: its x span and the face that opens into the space.
  const boardSpans = {
    'A-outer': [-L.wallInnerX, -L.endBoardFaceX, -L.endBoardFaceX],
    'A-inner': [-L.innerBoardFaceX, -L.partitionHalf, -L.innerBoardFaceX],
    'A-prime-inner': [L.partitionHalf, L.innerBoardFaceX, L.innerBoardFaceX],
    'A-prime-outer': [L.endBoardFaceX, L.wallInnerX, L.endBoardFaceX],
  };
  const entries = [[], []];
  const channels = [[], []];
  const boardPassages = {};
  spaces.forEach((space) => {
    const [pxk, pzk] = space.port;
    const [portY, boardY, layer, route] = ductRoute[space.key];
    const runZ = layerZ[layer];
    const face = boardSpans[space.key][2];
    const wallRun = route(pxk, space.board);
    const points = [
      new THREE.Vector3(pxk, L.shelfBottomY + 0.02, pzk),
      new THREE.Vector3(pxk, portY, pzk),
      ...wallRun.map(([x, y]) => new THREE.Vector3(x, y, runZ)),
      new THREE.Vector3(space.board, boardY, boardPassageZ),
      new THREE.Vector3(face, boardY, boardPassageZ),
    ];
    const curve = roundedPolyline(points, 0.1);
    const mesh = addMesh(fixedCase, curvedPipeWall(curve, 0.05, 0.07, 200, 16), pipeMaterial, `fixed-duct-from-seat-port-to-${space.key}`);
    ductRuns.push({curve, layer, mesh, points, boardY, face});
    entries[layer].push(poly(circle([pxk, portY], bore, 32)), poly(circle([space.board, boardY], bore, 32)));
    for (let i = 1; i < wallRun.length; i += 1) channels[layer].push(capsule(wallRun[i - 1], wallRun[i], bore, 24));
    boardPassages[space.key] = {boardY, face};
  });
  // The fixed boards run back to the wall, each with its cored passage.
  spaces.forEach((space, k) => {
    const [x0, x1] = boardSpans[space.key];
    const {boardY, face} = boardPassages[space.key];
    const outline = planRect(x0, x1, L.backZ, L.bellowsHalfDepth);
    const passage = clip.union(
      planCapsule([space.board, L.backZ - 0.1], [space.board, boardPassageZ], bore),
      planCapsule([space.board, boardPassageZ], [face + Math.sign(face - space.board) * 0.1, boardPassageZ], bore));
    const board = fixedBoards[k];
    board.geometry.dispose();
    board.geometry = mergePassageParts([
      horizontalPlate(outline, -L.bellowsHalfHeight, boardY - bore),
      horizontalPlate(clip.difference(outline, passage), boardY - bore, boardY + bore),
      horizontalPlate(outline, boardY + bore, L.bellowsHalfHeight),
    ]);
  });
  const inletBore = poly(circle([2.2, 4.6], 0.10, 32));
  const wallFace = poly([[-L.wallInnerX, L.floorTopY], [L.wallInnerX, L.floorTopY], [L.wallInnerX, L.roofBottomY], [-L.wallInnerX, L.roofBottomY]]);
  const slab = (holes, z0, z1) => plate(clip.difference(wallFace, inletBore, ...holes), z0, z1);
  backPanel.geometry.dispose();
  backPanel.geometry = mergePassageParts([
    slab([...entries[0], ...entries[1]], layerZ[0] + bore, L.backZ),
    slab([...channels[0], ...entries[1]], layerZ[0] - bore, layerZ[0] + bore),
    slab(entries[1], layerZ[1] + bore, layerZ[0] - bore),
    slab(channels[1], layerZ[1] - bore, layerZ[1] + bore),
    slab([], L.backOuterZ, layerZ[1] - bore),
  ]);

  // ---- bellows: leather, moving plates with their pins
  const leather = [
    createLeatherSegment(leatherMaterial, 'leather-of-A-outer-space'),
    createLeatherSegment(leatherMaterial, 'leather-of-A-inner-space'),
    createLeatherSegment(leatherMaterial, 'leather-of-A-prime-inner-space'),
    createLeatherSegment(leatherMaterial, 'leather-of-A-prime-outer-space'),
  ];
  const bellowsA = new THREE.Group();
  bellowsA.userData.role = 'bellows-like-measuring-chamber-A';
  const bellowsAPrime = new THREE.Group();
  bellowsAPrime.userData.role = 'bellows-like-measuring-chamber-A-prime';
  bellowsA.add(leather[0].mesh, leather[1].mesh);
  bellowsAPrime.add(leather[2].mesh, leather[3].mesh);
  root.add(bellowsA, bellowsAPrime);

  const pinGeometry = (sign) => mergePassageParts([
    new THREE.CylinderGeometry(0.045, 0.045, L.flagY + 0.10 - L.bellowsHalfHeight, 20).translate(0, sign * (L.bellowsHalfHeight + (L.flagY + 0.10 - L.bellowsHalfHeight) / 2), 0),
    new THREE.CylinderGeometry(0.085, 0.085, 0.07, 24).translate(0, sign * (L.flagY + 0.125), 0),
  ]);
  const makePlate = (material, role, parent) => {
    const group = new THREE.Group();
    group.userData.role = role;
    const board = addMesh(group, boxBetween(-halfPlate, halfPlate, -L.bellowsHalfHeight, L.bellowsHalfHeight, -L.bellowsHalfDepth, L.bellowsHalfDepth), material, `${role}-board`);
    const pins = [1, -1].map((sign) => addMesh(group, pinGeometry(sign), ironMaterial, `${role}-${sign > 0 ? 'upper' : 'lower'}-flag-pin`));
    parent.add(group);
    return {board, group, pins};
  };
  const movingA = makePlate(plateAMaterial, 'moving-plate-of-A', bellowsA);
  const movingAPrime = makePlate(plateAPrimeMaterial, 'moving-plate-of-A-prime', bellowsAPrime);

  // ---- flag rods, flags, top arms and links
  const makeFlagRod = (spec, name, topY) => {
    const group = new THREE.Group();
    group.position.set(spec.rod[0], 0, spec.rod[1]);
    group.userData.role = `rocking-flag-rod-of-${name}`;
    const shaft = addMesh(group, new THREE.CylinderGeometry(0.055, 0.055, topY - L.floorTopY, 24).translate(0, (topY + L.floorTopY) / 2, 0), ironMaterial, `vertical-flag-rod-of-${name}`);
    const flagArms = [1, -1].map((sign) => {
      const arm = addMesh(group, barGeometry(spec.flagArm, 0.09, -0.04, 0.04, 0.09), ironMaterial, `${sign > 0 ? 'upper' : 'lower'}-flag-arm-of-${name}`);
      arm.position.y = sign * (L.flagY - 0.10);
      arm.userData.flagOffset = spec.flagOffset;
      return arm;
    });
    const topArm = addMesh(group, barGeometry(spec.armLength, 0.10, -0.04, 0.04, 0.10), ironMaterial, `top-arm-of-flag-rod-of-${name}`);
    topArm.position.y = topY - 0.04;
    // Joint pins standing on the arm tips, through the eyes of the links.
    const jointPin = (x, z, y0, y1, role) => {
      const sign = Math.sign(y1 - y0), height = Math.abs(y1 - y0);
      const pin = addMesh(group, mergePassageParts([
        new THREE.CylinderGeometry(0.035, 0.035, height, 20).translate(0, y0 + sign * height / 2, 0),
        new THREE.CylinderGeometry(0.065, 0.065, 0.04, 24).translate(0, y1 + sign * 0.02, 0),
      ]), ironMaterial, role);
      pin.position.set(x, 0, z);
      return pin;
    };
    const flagJointPins = [1, -1].map((sign) => jointPin(spec.flagArm * Math.cos(spec.flagOffset), spec.flagArm * Math.sin(spec.flagOffset),
      sign * (L.flagY - 0.10), sign * (L.flagY + 0.06), `${sign > 0 ? 'upper' : 'lower'}-flag-joint-pin-of-${name}`));
    const topJointPin = jointPin(spec.armLength, 0, topY - 0.04, topY + 0.12, `top-arm-joint-pin-of-${name}`);
    root.add(group);
    return {flagArms, flagJointPins, group, shaft, topArm, topJointPin};
  };
  // A' works a crank pin on a disc at the top of the spindle; A works an
  // eccentric sheave just below it, so neither rod sweeps over the other's
  // pin and nothing stands on the spindle axis where a link passes over it.
  const sheaveY = [5.24, 5.32], discY = [5.34, 5.42];
  const rightTopY = discY[1], leftTopY = sheaveY[0] - 0.02;
  const rodA = makeFlagRod(left, 'A', leftTopY);
  const rodAPrime = makeFlagRod(right, 'A-prime', rightTopY);
  const makeLink = (length, role, y, width = 0.08, holeRadius = 0.04) => {
    const mesh = addMesh(root, barGeometry(length, width, -0.04, 0.04, width, [[0, holeRadius], [length, holeRadius + 0.015]]), ironMaterial, role);
    mesh.position.y = y;
    return mesh;
  };
  const flagLinksA = [1, -1].map((sign) => makeLink(left.flagLink, `${sign > 0 ? 'upper' : 'lower'}-flag-link-to-plate-of-A`, sign * (L.flagY), 0.10, 0.04));
  const flagLinksAPrime = [1, -1].map((sign) => makeLink(right.flagLink, `${sign > 0 ? 'upper' : 'lower'}-flag-link-to-plate-of-A-prime`, sign * (L.flagY), 0.10, 0.04));
  const crankLinkAPrime = makeLink(right.linkLength, 'link-from-flag-rod-of-A-prime-to-crank-of-B', rightTopY + 0.06, 0.1, 0.04);
  // A's link is an eccentric rod: its far end is a strap round the sheave.
  const sheaveRadius = 0.62;
  const crankLinkA = addMesh(root, horizontalPlate(clip.difference(
    clip.union(capsule([0, 0], [left.linkLength, 0], 0.05, 24), poly(circle([0, 0], 0.10, 32)), poly(circle([left.linkLength, 0], sheaveRadius + 0.10, 64))),
    poly(circle([0, 0], 0.04, 24)), poly(circle([left.linkLength, 0], sheaveRadius + 0.005, 96))), sheaveY[0], sheaveY[1]),
  ironMaterial, 'eccentric-rod-from-flag-rod-of-A-to-sheave-on-spindle-of-B');

  // ---- valve B on its spindle, the C bracket and the crank
  const spindle = new THREE.Group();
  spindle.position.set(ox, 0, oz);
  spindle.userData.role = 'turning-spindle-of-valve-B';
  root.add(spindle);
  const valveB = addMesh(spindle, valveBGeometry(), valveMaterial, 'D-cup-valve-B-turning-on-its-seat');
  valveB.rotation.y = -valveOffset;
  const spindleShaft = addMesh(spindle, new THREE.CylinderGeometry(0.06, 0.06, discY[0] - L.valveTopY, 24).translate(0, (discY[0] + L.valveTopY) / 2, 0), ironMaterial, 'spindle-shaft-of-B');
  const crankDisc = addMesh(spindle, horizontalRing(0, 0.62, discY[0], discY[1], 64), ironMaterial, 'crank-disc-on-top-of-spindle');
  const sheave = addMesh(spindle, horizontalPlate(planCircle([L.crankRadius * Math.cos(left.crankOffset), L.crankRadius * Math.sin(left.crankOffset)], sheaveRadius, 96), sheaveY[0], sheaveY[1]), ironMaterial, 'eccentric-sheave-on-spindle-of-B');
  const crankPins = [
    {offset: right.crankOffset, top: rightTopY + 0.14, role: 'crank-pin-for-link-from-A-prime'},
  ].map(({offset, top, role}) => {
    const pin = addMesh(spindle, mergePassageParts([
      new THREE.CylinderGeometry(0.04, 0.04, top - discY[1], 20).translate(0, (top + discY[1]) / 2, 0),
      new THREE.CylinderGeometry(0.075, 0.075, 0.06, 24).translate(0, top + 0.03, 0),
    ]), ironMaterial, role);
    pin.position.set(L.crankRadius * Math.cos(offset), 0, L.crankRadius * Math.sin(offset));
    return pin;
  });
  // C bracket standing on the shelf left of B; its two jaws are the
  // spindle's bearings.
  // Brown's C: a back standing on the shelf, two jaws reaching over B and a
  // round-ended opening between them.
  const cX0 = px(234), cX1 = px(298), back = 0.26, topY = py(69), lowJawTop = py(98), lowJawBottom = py(106), upJawBottom = py(78);
  const uCenterY = (lowJawTop + upJawBottom) / 2, uRadius = (upJawBottom - lowJawTop) / 2, uCenterX = cX0 + back + uRadius;
  const cOutline = [[cX0, L.shelfTopY], [cX0 + back, L.shelfTopY], [cX0 + back, lowJawBottom], [cX1, lowJawBottom], [cX1, lowJawTop]];
  for (let i = 0; i <= 16; i += 1) {
    const t = -Math.PI / 2 - Math.PI * i / 16;
    cOutline.push([uCenterX + uRadius * Math.cos(t), uCenterY + uRadius * Math.sin(t)]);
  }
  cOutline.push([cX1, upJawBottom], [cX1, topY]);
  for (let i = 0; i <= 8; i += 1) {
    const t = Math.PI / 2 + Math.PI / 2 * i / 8;
    cOutline.push([cX0 + back + back * Math.cos(t), topY - back + back * Math.sin(t)]);
  }
  // The body is extruded front to back; the two jaws are horizontal plates
  // bored for the spindle.
  let cBracket;
  {
    const jawBore = (y0, y1) => horizontalPlate(clip.difference(planRect(cX0 + back + 0.02, cX1, -0.12, 0.12), planCircle([ox, oz], 0.075, 32)), y0, y1);
    const body = plate(clip.difference(poly(cOutline),
      poly([[cX0 + back + 0.01, lowJawBottom - 0.001], [cX1 + 0.01, lowJawBottom - 0.001], [cX1 + 0.01, lowJawTop + 0.001], [cX0 + back + 0.01, lowJawTop + 0.001]]),
      poly([[cX0 + back + 0.01, upJawBottom - 0.001], [cX1 + 0.01, upJawBottom - 0.001], [cX1 + 0.01, topY + 0.001], [cX0 + back + 0.01, topY + 0.001]])), -0.12, 0.12);
    cBracket = addMesh(fixedCase, mergePassageParts([body, jawBore(lowJawBottom, lowJawTop), jawBore(upJawBottom, topY)]), caseMaterial, 'fixed-C-bracket-carrying-spindle-of-B');
  }

  const update = (time) => {
    const state = stateAtTime(time);
    const lx = state.left.plateX, rx = state.right.plateX;
    leather[0].update(-L.endBoardFaceX, lx - halfPlate);
    leather[1].update(lx + halfPlate, -L.innerBoardFaceX);
    leather[2].update(L.innerBoardFaceX, rx - halfPlate);
    leather[3].update(rx + halfPlate, L.endBoardFaceX);
    movingA.group.position.x = lx;
    movingAPrime.group.position.x = rx;
    spindle.rotation.y = -state.crankAngle;
    for (const [rod, spec, s, flagLinks, crankLink, topY] of [
      [rodA, left, state.left, flagLinksA, crankLinkA, leftTopY],
      [rodAPrime, right, state.right, flagLinksAPrime, crankLinkAPrime, rightTopY],
    ]) {
      rod.group.rotation.y = -s.rockerAngle;
      for (const arm of rod.flagArms) arm.rotation.y = -spec.flagOffset;
      for (const link of flagLinks) {
        link.position.x = s.flagTip[0];
        link.position.z = s.flagTip[1];
        link.rotation.y = -Math.atan2(0 - s.flagTip[1], s.plateX - s.flagTip[0]);
      }
      crankLink.position.x = s.armTip[0];
      crankLink.position.z = s.armTip[1];
      crankLink.rotation.y = -Math.atan2(s.crankPin[1] - s.armTip[1], s.crankPin[0] - s.armTip[0]);
      void topY;
    }
  };

  const geometry = {
    bellowsArea,
    crankAngleAtZero,
    cycleDuration,
    layout: L,
    linkages: {left, right},
    portLapAngle,
    spaces: spaces.map(({key, side, port, portAngle, board}) => ({key, side, port, portAngle, board})),
    strokeLengths,
    valveOffset,
    volumePerRevolution,
  };
  root.userData = {
    animationTiming: {authoredCyclePeriod: cycleDuration, targetCycleDuration: 4},
    archetype: movement.archetype ?? 'two-opposed-variable-volume-bellows-A-A-prime-dead-center-shifted-D-slide-valve-B-positive-displacement-dry-gas-meter-with-fill-count-dials',
    blocks: {
      backPanel, bellowsA, bellowsAPrime, cBracket, crankDisc, crankLinkA, crankLinkAPrime, crankPins, sheave,
      dialCase, ductRuns, fixedBoards, fixedCase, flagLinksA, flagLinksAPrime, floor, inletPipe, leather,
      movingA, movingAPrime, outletColumn, partition, rodA, rodAPrime, roof, shelf, spindle, spindleShaft,
      valveB, walls,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Two bellows chambers A and A′ stand either side of a central partition. Each is closed at both ends by fixed boards and divided by its moving plate into an outer and an inner measuring space, so the plate is driven one way by gas admitted on one side while the other side is emptied. Each plate works a flag on a vertical flag rod; an arm on top of each flag rod drives, through a link, a crank pin on the spindle of valve B, the two pins a quarter turn apart, so the plates keep a quarter stroke apart and the spindle turns continuously. B is a D-shaped cup turning on a seat in the shelf with one port for each measuring space round a central exhaust port: the ports under the cup are open to the exhaust, which runs through a passage in the shelf to the tall outlet column; the ports outside it admit the gas that fills the case. Each revolution of the spindle passes the four space volumes; the dial-work in the box at the upper right counts revolutions.',
    motion: {spindleTurnsPerCycle: 1, valveBRotation: 'continuous, with the crank spindle'},
    reconstruction:
      'Brown’s plate shows one elevation. The flag and crank linkage, the left flag rod behind chamber A, the four port ducts, their passages cored in the thick back wall and in the fixed boards (which run back to that wall), the cored exhaust passage, the inlet through the back of the case and the rounded-rectangle bellows section are inferred; the crank radius, arm and link lengths are chosen so both rocking flag rods can turn one crank, and the port angles are derived from the plate motion so each space exhausts while it closes.',
    sourceAnimation: {
      available: false,
      officialPageMarksAnimationUnavailable: true,
      reason: 'The official Movement 483 page marks Animated unavailable and supplies only Brown’s engraving and caption.',
    },
    sourceReference: {officialPage: movement.sourceUrl, plate: 'Brown 1868, Movement 483', pixelScale: 'x=(px-262)/50, y=(330-py)/50'},
    stateAtTime,
    update,
  };
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
  root.userData.workingPartsReview = {
    status: 'kinematic-linkage-and-port-timing',
    residual: 'Gas pressures and the resulting plate forces are not solved; the crank turns uniformly and the plates follow the linkage exactly.',
  };
  update(0);
  markShadows(root);
  fitPistonGuide(root, update, cycleDuration);
  root.userData.cameraDirection = new THREE.Vector3(0.25, 0.45, 15);
  root.userData.cameraFov = 10;
  return {cameraDirection: root.userData.cameraDirection, root, update};
}

export function createAuthoredDryGasMeterMovement(movement) {
  if (movement.id !== 483) return null;
  return applyCutawayFor(dryGasMeter(movement), movement.id);
}
