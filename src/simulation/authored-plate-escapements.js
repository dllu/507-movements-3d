import * as THREE from 'three';
import { polygonClipping } from './finite-plate-geometry.js';
import { PALETTE, markShadows, matte } from './primitives.js';
import { spokedWheelOutline } from './spoked-wheel.js';
import { makeSeeThrough } from './see-through-part.js';
import {
  TAU,
  arborMesh,
  arcFromTo,
  arcPoints,
  circleAtX,
  arcThrough,
  circlePoints,
  clipToDisc,
  joinPath,
  linePoints,
  placeFlat,
  platePhaseTime,
  plateMapper,
  plateMesh,
  polar,
  solveDrivenWheel,
  tagged,
  toFlat,
  toothedOutline,
  turnedSmooth,
  wheelAngleAt,
} from './plate-escapement-kit.js';

// Movements 288-296 rebuilt as flat extruded parts whose outlines are the
// intended geometry of Brown's plates (arcs, straight lines, regular tooth
// forms measured from the engraving). Pendulum/balance motion is a smooth
// prescribed oscillation; the escape wheel is solved from contact with the
// drawn pallet outlines (plate-escapement-kit.js), so lock, recoil or rest,
// impulse and drop come from the shapes themselves. No hidden pins, backing
// pieces or depth offsets are added to make the action work.

const DEG = Math.PI / 180;
const WHEEL_COLOR = PALETTE.driver;
const ANCHOR_COLOR = PALETTE.driven;
const ARBOR_COLOR = PALETTE.ink;

function finish(root, movement, update, { period, cameraDirection = new THREE.Vector3(0, 0, 1), fit }) {
  root.userData.fidelity = 'authored';
  root.userData.hideGround = true;
  root.userData.timeline = { demonstrationPeriod: period };
  if (fit) root.userData.cameraFitBounds = fit;
  root.userData.materialsIgnoreSceneFog = true;
  root.traverse((object) => {
    for (const material of [object.material].flat().filter(Boolean)) material.fog = false;
  });
  update(0);
  markShadows(root);
  root.userData.cameraDirection = cameraDirection;
  return { root, update, cameraDirection };
}

function fitBox(map, [x0, y0, x1, y1], zMin = -0.4, zMax = 0.4) {
  const [ax, ay] = map([x0, y1]);
  const [bx, by] = map([x1, y0]);
  return new THREE.Box3(new THREE.Vector3(Math.min(ax, bx), Math.min(ay, by), zMin), new THREE.Vector3(Math.max(ax, bx), Math.max(ay, by), zMax));
}

// Windows and bore of a spoked wheel from the shared builder
// (spoked-wheel.js), turned by `turn` so they sit at the plate's angles.
function builderHoles(options, turn) {
  const { windows, bore } = spokedWheelOutline({ ...options, phase: (options.phase ?? 0) + turn });
  return [...windows, ...(bore ? [bore] : [])];
}

const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];

// Split a wheel outline into one collision polygon per tooth pitch: the
// tooth plus the root that follows it, closed below the root circle.
function toothCells(count, phase, tooth, rootRadius, depth) {
  const pitch = TAU / count;
  const cells = [];
  for (let k = 0; k < count; k += 1) {
    const base = phase - k * pitch;
    const outline = tooth.map(([offset, radius]) => polar([0, 0], radius, base + offset));
    const next = polar([0, 0], tooth[0][1], base - pitch);
    const inner = rootRadius - depth;
    cells.push({
      points: [
        ...outline,
        next,
        polar([0, 0], inner, base - pitch),
        polar([0, 0], inner, base),
      ],
    });
  }
  return cells;
}

// ---------------------------------------------------------------------------
// One escape wheel driven by train torque and one oscillating escapement
// part (anchor, frame, lever...) rocking about a fixed pivot. All outlines
// are given in model coordinates at the plate's pose.

function pivotedEscapement({
  movement,
  name,
  period,
  halfDepth = 0.09,
  wheel,
  oscillator,
  arbors = [],
  extras,
  extraUpdate,
  extraObstacles,
  extraPlot,
  fit,
  mechanism,
  dropAcceleration = 40,
  plotView,
}) {
  const root = new THREE.Group();
  root.name = name;
  const wheelMaterial = matte(wheel.color ?? WHEEL_COLOR, { metalness: 0.2, roughness: 0.55 });
  const oscillatorMaterial = matte(oscillator.color ?? ANCHOR_COLOR, { metalness: 0.2, roughness: 0.55 });
  const arborMaterial = matte(ARBOR_COLOR, { metalness: 0.35, roughness: 0.45 });
  const { center, count, direction } = wheel;
  const pitch = TAU / count;

  // Oscillator: one extruded outline rocking about its pivot.
  const pivot = oscillator.pivot;
  const local = (points) => points.map(([x, y]) => [x - pivot[0], y - pivot[1]]);
  const localOutline = local(oscillator.outline);
  const localHoles = (oscillator.holes ?? []).map(local);
  const rocker = new THREE.Group();
  rocker.name = oscillator.name;
  rocker.position.set(pivot[0], pivot[1], 0);
  const [rockerZ0, rockerZ1] = oscillator.zRange ?? [-halfDepth, halfDepth];
  rocker.add(plateMesh(localOutline, localHoles, rockerZ0, rockerZ1, oscillatorMaterial, oscillator.role));
  root.add(rocker);
  const { amplitude = 0, rest = 0 } = oscillator;
  const rockerAngle = oscillator.angle ?? ((t) => rest + amplitude * Math.sin(TAU * t / period));

  // Contact pieces: the parts of the oscillator that can reach the wheel.
  const wheelCenterLocal = [center[0] - pivot[0], center[1] - pivot[1]];
  const reach = wheel.tipRadius + (oscillator.clipMargin ?? 0.5);
  // Pieces may be bare point lists (wheel layer) or { points, layer }.
  const pieces = (oscillator.contactPieces
    ?? clipToDisc(localOutline, wheelCenterLocal, reach, localHoles))
    .map((piece) => (Array.isArray(piece) ? { layer: 0, flat: toFlat(piece) } : { layer: piece.layer ?? 0, flat: toFlat(piece.points) }));
  const cells = wheel.cells ?? toothCells(count, wheel.phase, wheel.tooth, wheel.rootRadius, wheel.cellDepth ?? 0.2)
    .map((cell) => ({ points: cell.points }));
  const solution = solveDrivenWheel({
    wheel: { center, count, parts: cells },
    obstacles: (t) => [
      ...pieces.map((piece) => ({ layer: piece.layer, points: placeFlat(piece.flat, { x: pivot[0], y: pivot[1], angle: rockerAngle(t) }) })),
      ...(extraObstacles?.(t) ?? []),
    ],
    period,
    direction,
    dropAcceleration,
    maxUnresolved: movement.tune?.debug ? Infinity : 20,
    startTime: oscillator.startTime ?? period / 4,
  });
  if ((solution.failed || solution.unresolved) && !movement.tune?.debug) {
    throw new Error(`${name}: escapement does not advance one tooth per beat cycle (advance ${solution.advance / pitch} pitch, unresolved ${solution.unresolved})`);
  }
  // Start at the plate's pose: the oscillator near its drawn angle (zero)
  // at the moment the solved wheel best matches the drawn tooth phase.
  const candidates = [];
  for (let i = 0; i < 400; i += 1) {
    const time = period * i / 400;
    if (oscillator.plateTime ? oscillator.plateTime(time) : Math.abs(rockerAngle(time)) <= (oscillator.plateTolerance ?? 0.3) * Math.abs(amplitude) + 1e-12) candidates.push(time);
  }
  const { time: t0 } = platePhaseTime(solution, period, candidates);
  const solvedAt = (time) => direction * wheelAngleAt(solution, period, time);
  const startAngle = solvedAt(t0);
  const wheelOffset = -Math.round(startAngle / pitch) * pitch;
  const initialWheelAngle = startAngle + wheelOffset;

  // Wheel: toothed outline at the solved tooth phase; windows/holes are laid
  // out at the plate's angles for t = 0.
  const outline = wheel.outline ?? toothedOutline(center, count, wheel.phase, wheel.tooth);
  const holes = wheel.holes(-initialWheelAngle);
  const wheelRotor = new THREE.Group();
  wheelRotor.name = `${wheel.role}-rotor`;
  wheelRotor.position.set(center[0], center[1], 0);
  const centred = (points) => points.map(([x, y]) => [x - center[0], y - center[1]]);
  const [wheelZ0, wheelZ1] = wheel.zRange ?? [-halfDepth, halfDepth];
  wheelRotor.add(plateMesh(centred(outline), holes.map(centred), wheelZ0, wheelZ1, wheelMaterial, wheel.role));
  root.add(wheelRotor);

  for (const arbor of arbors) {
    const mesh = arborMesh(arbor.center, arbor.radius, arbor.z0 ?? -0.3, arbor.z1 ?? 0.3, arborMaterial, arbor.role);
    root.add(mesh);
  }

  if (extras) {
    const frameMaterial = matte(PALETTE.frame, { metalness: 0.15, roughness: 0.65 });
    for (const mesh of extras(root, { frame: frameMaterial, wheel: wheelMaterial, oscillator: oscillatorMaterial, arbor: arborMaterial, rocker, wheelRotor })) {
      if (!mesh.parent) root.add(mesh);
    }
  }
  const update = (time) => {
    rocker.rotation.z = rockerAngle(time + t0);
    wheelRotor.rotation.z = wheelOffset + solvedAt(time + t0);
    extraUpdate?.(time + t0);
  };
  root.userData.plot2d = (t) => {
    update(t);
    return [
      { points: centred(outline).map((p) => add(rot(p, wheelRotor.rotation.z), center)), color: 'orangered' },
      { points: localOutline.map((p) => add(rot(p, rocker.rotation.z), pivot)), color: 'steelblue' },
      ...localHoles.map((hole) => ({ points: hole.map((p) => add(rot(p, rocker.rotation.z), pivot)), color: 'steelblue' })),
      ...(extraPlot?.(t + t0) ?? []),
      ...(wheel.cells ? wheel.cells.map((cell) => ({ points: cell.points.map((p) => add(rot(p, wheelRotor.rotation.z), center)), color: cell.layer === 1 ? 'red' : 'darkred' })) : []),
      ...pieces.map((piece) => ({ points: Array.from({ length: piece.flat.length / 2 }, (_, i) => add(rot([piece.flat[2 * i], piece.flat[2 * i + 1]], rocker.rotation.z), pivot)), color: piece.layer === 2 ? 'navy' : 'deepskyblue' })),
    ];
  };
  root.userData.plotView = plotView;
  root.userData.solution = solution;
  root.userData.kinematics = {
    period,
    timeOrigin: t0,
    rockerAngle: (t) => rockerAngle(t + t0),
    wheelAngle: (t) => wheelOffset + solvedAt(t + t0),
    states: solution.states,
  };
  root.userData.blocks = { rocker, wheelRotor };
  root.userData.contactOutlines = { rocker: localOutline, pivot, wheelCenter: center, wheelCells: cells, pieces: pieces.map((piece) => piece.flat), pieceLayers: pieces.map((piece) => piece.layer) };
  root.userData.mechanism = mechanism;
  return finish(root, movement, update, { period, fit });
}

// ---------------------------------------------------------------------------
// 288: recoil anchor escapement.

function recoilAnchor288(movement) {
  const tune = movement.tune ?? {};
  const map = plateMapper([250, 405], 0.02);
  const s = map.scale;
  const P = (x, y) => map([x, y + (tune.dy ?? 0)]);
  // Escape wheel A: radial leading faces with sloped backs and flat roots
  // (tips lead the counterclockwise rotation of Brown's arrow). Brown's 33
  // teeth. His pallet corners c and d stand almost exactly five pitches
  // apart, which locks both sides at once; each pallet is set 3.25 px
  // outward (about a sixth of a pitch between them), inside the engraving's
  // own drift, so the span is five and a half pitches and the anchor works
  // (the working window is about 6-8 px of total spread).
  const count = tune.count ?? 33;
  const rdx = tune.rdx ?? 3.25;
  const ldx = tune.ldx ?? -3.25;
  const pitch = TAU / count;
  const tipRadius = 221 * s;
  const rootRadius = 192 * s;
  const tooth = [
    [0, rootRadius],
    [0, tipRadius],
    [-0.7 * DEG, tipRadius - 0.6 * s],
    [-5.6 * DEG, rootRadius],
    ...Array.from({ length: 5 }, (_, i) => [-(5.6 + (pitch / DEG - 5.6) * (i + 1) / 6) * DEG, rootRadius]),
  ];
  const arborRadius = 15 * s;
  const pivot = P(247.5, 142);
  // Anchor H-L-K: straight top L, circular-arc sides, straight inner edges,
  // the semicircular boss round the arbor a, pallet faces c-e and d-b.
  const outline = joinPath(
    [P(129, 83), P(402, 82)],
    arcThrough(P(402, 82), P(393 + rdx / 2, 156), P(364 + rdx, 206), 20),
    [P(337 + rdx, 207)],
    [P(355 + rdx / 2, 132)],
    [P(276, 132)],
    arcPoints(P(248, 140), 28 * s, 0, -Math.PI, 24),
    [P(220, 132), P(163, 133), P(154 + ldx, 185)],
    [P(137 + ldx, 212)],
    arcThrough(P(137 + ldx, 212), P(117, 150), P(129, 83), 20).slice(1, -1),
  );
  return pivotedEscapement({
    movement,
    name: 'movement-288-recoil-anchor-escapement',
    period: 2,
    wheel: {
      role: 'escape-wheel-A',
      center: [0, 0],
      count,
      direction: 1,
      tooth,
      phase: 90.97 * DEG,
      tipRadius,
      rootRadius,
      cellDepth: 12 * s,
      // Three plain spokes and Brown's round hub (spoked-wheel.js); equal
      // 120-degree spacing fitted to his 56/199/311-degree spokes.
      holes: (turn) => builderHoles({
        spokes: 3,
        outerRadius: rootRadius,
        rimInnerRadius: 158 * s,
        spokeWidth: 18 * s,
        hubRadius: 36 * s,
        hubArcRadius: 36 * s,
        hubFillet: 5 * s,
        rimFillet: 5 * s,
        boreRadius: arborRadius,
        phase: 68.8 * DEG,
      }, turn),
    },
    oscillator: {
      name: 'anchor-H-L-K',
      role: 'recoil-anchor-H-L-K',
      pivot,
      outline,
      holes: [circlePoints(pivot, 9 * s, 40)],
      amplitude: (tune.amplitude ?? 3.2) * DEG,
      rest: (tune.rest ?? 2) * DEG,
    },
    arbors: [
      { center: [0, 0], radius: arborRadius, z0: -0.3, z1: 0.22, role: 'escape-wheel-arbor' },
      { center: pivot, radius: 9 * s, z0: -0.3, z1: 0.2, role: 'anchor-arbor-a' },
    ],
    fit: fitBox(map, [28, 70, 482, 505]),
    plotView: [-2.7, 2.9, 2.7, 6.6],
    mechanism: 'A pendulum-rocked anchor H-L-K alternately catches the escape wheel A on the inner face c-e of pallet H and the outer face d-b of pallet K; neither face is concentric with a, so the wheel recoils, then follows the retiring face (impulse) and drops to the other pallet.',
  });
}

// ---------------------------------------------------------------------------
// 289: dead-beat anchor escapement. The anchor hangs from a far above the
// wheel; its band encircles the top of the wheel and its pallets H and K
// work at the sides. Each pallet has a locking face that is an arc about a
// (the wheel rests while the pallet slides) and a short impulse face.

function deadbeat289(movement) {
  const tune = movement.tune ?? {};
  const map = plateMapper([257, 352], 0.02);
  const s = map.scale;
  const P = (x, y) => map([x, y]);
  const count = tune.count ?? 32;
  const pitch = TAU / count;
  const tipRadius = 137 * s;
  const rootRadius = 111 * s;
  // Hooked, forward-leaning teeth: the leading face leans ahead of its root
  // and the long back runs down to a sharp root.
  const lean = (tune.lean ?? 3.5) * DEG;
  const tooth = [[-lean, rootRadius], [0, tipRadius], [-(pitch + lean), rootRadius]];
  const a = P(257, 47);
  const bandCenter = P(257, 358);
  const outerR = 184 * s;
  const innerR = 164 * s;
  const onWheel = (angleDeg, radiusPx) => polar([0, 0], radiusPx * s, angleDeg * DEG);
  // Pallet H (left): locking ledge about a ending at c, impulse face c-e.
  const c = onWheel(tune.cAngle ?? 175, tune.cRadius ?? 133);
  const e = onWheel(tune.eAngle ?? 178.4, tune.eRadius ?? 144);
  const ledgeEnd = circleAtX(a, Math.hypot(c[0] - a[0], c[1] - a[1]), P(100, 0)[0], false);
  // Pallet K (right): locking underside about a from b, impulse face b-d.
  const b = onWheel(tune.bAngle ?? 2, tune.bRadius ?? 133);
  const d = onWheel(tune.dAngle ?? 5.8, tune.dRadius ?? 141);
  const kOuterX = P(436, 0)[0];
  const undersideEnd = circleAtX(a, Math.hypot(b[0] - a[0], b[1] - a[1]), kOuterX, false);
  const hOuterX = P(78, 0)[0];
  const stemLeft = P(239, 0)[0];
  const stemRight = P(275, 0)[0];
  const eyeR = 18 * s;
  const outline = joinPath(
    arcFromTo(a, [a[0] - eyeR, a[1]], [a[0] + eyeR, a[1]], false, 24),
    [circleAtX(bandCenter, outerR, stemRight, true)],
    arcFromTo(bandCenter, circleAtX(bandCenter, outerR, stemRight, true), circleAtX(bandCenter, outerR, kOuterX, true), false, 40),
    [undersideEnd],
    arcFromTo(a, undersideEnd, b, false, 10),
    [d],
    [circleAtX(bandCenter, innerR, P(410, 0)[0], true)],
    arcFromTo(bandCenter, circleAtX(bandCenter, innerR, P(410, 0)[0], true), circleAtX(bandCenter, innerR, P(100, 0)[0], true), true, 60),
    [ledgeEnd],
    arcFromTo(a, ledgeEnd, c, true, 8),
    [e, P(78, 342)],
    [circleAtX(bandCenter, outerR, hOuterX, true)],
    arcFromTo(bandCenter, circleAtX(bandCenter, outerR, hOuterX, true), circleAtX(bandCenter, outerR, stemLeft, true), false, 40),
  );
  return pivotedEscapement({
    movement,
    name: 'movement-289-dead-beat-anchor-escapement',
    period: 2,
    wheel: {
      role: 'escape-wheel-A',
      center: [0, 0],
      count,
      direction: 1,
      tooth,
      phase: (tune.phase ?? 90.9) * DEG,
      tipRadius,
      rootRadius,
      cellDepth: 10 * s,
      // Brown's four lens windows (spoked-wheel.js, windowShape 'lens'):
      // each is the rim's inside and one circular arc meeting in sharp
      // tips, the crossings 14 px wide at the rim and widening to the hub,
      // the windows square to the page (A at the top).
      holes: (turn) => [
        ...spokedWheelOutline({
          windowShape: 'lens', outerRadius: rootRadius, rimInnerRadius: 82 * s, spokes: 4,
          spokeTipWidth: 14 * s, hubRadius: 33 * s, boreRadius: 0, phase: 45 * DEG + turn, arcSegments: 256,
        }).windows,
        circlePoints([0, 0], 9 * s, 40),
      ],
    },
    oscillator: {
      name: 'anchor-H-L-K',
      role: 'dead-beat-anchor-H-L-K',
      pivot: a,
      outline,
      holes: [circlePoints(a, 9 * s, 40)],
      amplitude: (tune.amplitude ?? 2) * DEG,
      clipMargin: 0.3,
      rest: (tune.rest ?? 0) * DEG,
    },
    arbors: [
      { center: [0, 0], radius: 9 * s, z0: -0.3, z1: 0.22, role: 'escape-wheel-arbor' },
      { center: a, radius: 9 * s, z0: -0.3, z1: 0.2, role: 'anchor-arbor-a' },
    ],
    fit: fitBox(map, [60, 20, 460, 505]),
    plotView: [-3.6, -1.2, 3.6, 3.2],
    mechanism: 'The pendulum rocks anchor H-L-K about a. A tooth of wheel A rests on a locking face that is an arc about a, so the wheel stands dead still while the pallet slides; as the pallet withdraws the tooth slides over the short impulse face c-e or d-b, pushing the anchor, and drops to the other pallet.',
  });
}

// ---------------------------------------------------------------------------
// 290: seven-tooth wheel D inside an annular pendulum frame. The frame hangs
// on a suspension spring C from fixed chops; two plain rectangular pallets
// A and B project inward from the ring at the horizontal diameter.

function union(polygons) {
  const close = (ring) => [...ring, ring[0]];
  return polygonClipping.union(...polygons.map((rings) => rings.map(close)))
    .map((polygon) => polygon.map((ring) => ring.slice(0, -1)));
}

function annular290(movement) {
  const tune = movement.tune ?? {};
  const map = plateMapper([256, 281], 0.02);
  const s = map.scale;
  const P = (x, y) => map([x, y]);
  const count = 7;
  const pitch = TAU / count;
  const tipRadius = (tune.tipRadius ?? 86) * s;
  const rootRadius = 68 * s;
  // Teeth: a short, nearly radial leading face and a long back: one circular
  // arc through Brown's measured root, middle and tip radii (it stays low
  // and rises steeply to the next tip); the wheel turns clockwise.
  const backStart = -3 * DEG;
  const backMid = (tune.backMid ?? 76.6) * s;
  const land = (tune.land ?? 2) * DEG;
  const backArc = arcThrough(
    polar([0, 0], 71 * s, backStart),
    polar([0, 0], backMid, (backStart - pitch + land) / 2),
    polar([0, 0], tipRadius, -pitch + land),
    24,
  ).map(([x, y]) => [Math.atan2(y, x), Math.hypot(x, y)]);
  // A short land at the tip keeps the point from being a knife edge.
  const tooth = [[0, tipRadius], [-1.2 * DEG, rootRadius], ...backArc];
  const ringInner = 99 * s;
  const ringOuter = 112.5 * s;
  const pivot = P(257, 66);
  const tabLength = (tune.tabRadius ?? 83.5) * s;
  const tabHalf = 4 * s;
  const tab = (side) => {
    const x0 = side * (ringInner + 2 * s);
    const x1 = side * tabLength;
    return [[x0, -tabHalf], [x1, -tabHalf], [x1, tabHalf], [x0, tabHalf]];
  };
  const rect = (x0, y0, x1, y1) => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
  const filletedJoint = (x0, x1, yRing, yEnd, flare, up) => {
    // Rod or socket meeting the ring through concave circular fillets.
    const sign = up ? -1 : 1;
    const points = [];
    const r = flare;
    const leftCorner = [x0 - r, yRing];
    const rightCorner = [x1 + r, yRing];
    const arc = (cx, cy, a0, a1) => {
      for (let i = 0; i <= 8; i += 1) {
        const t = a0 + (a1 - a0) * i / 8;
        points.push(P(cx + r * Math.cos(t), cy + sign * r * Math.sin(t)));
      }
    };
    points.push(P(leftCorner[0], yRing - sign * 6));
    arc(x0 - r, yRing + sign * r, -Math.PI / 2, 0);
    points.push(P(x0, yEnd), P(x1, yEnd));
    arc(x1 + r, yRing + sign * r, Math.PI, 3 * Math.PI / 2);
    points.push(P(rightCorner[0], yRing - sign * 6));
    return points;
  };
  const pieces = union([
    [circlePoints([0, 0], ringOuter, 160), circlePoints([0, 0], ringInner, 160)],
    [filletedJoint(248.5, 268, 172, 140, 10, true)],
    [rect(256, 65, 258.5, 142)],
    [filletedJoint(248.5, 268.5, 390, 640, 14, false)],
    [tab(1)],
    [tab(-1)],
  ]);
  if (pieces.length !== 1) throw new Error('290 frame is not one piece');
  const [frameOuter, ...frameHoles] = pieces[0];
  const bob = circlePoints(P(258.5, 660), 34 * s, 64);
  const bobbed = union([[frameOuter, ...frameHoles], [bob]])[0];
  return pivotedEscapement({
    movement,
    name: 'movement-290-annular-pendulum-escapement',
    period: 2,
    wheel: {
      role: 'seven-tooth-escape-wheel-D',
      center: [0, 0],
      count,
      direction: -1,
      tooth,
      phase: (tune.phase ?? 104) * DEG,
      tipRadius,
      rootRadius,
      cellDepth: 10 * s,
      holes: () => [circlePoints([0, 0], 9 * s, 40)],
    },
    oscillator: {
      name: 'annular-pendulum-frame-K',
      role: 'annular-pendulum-frame-with-pallets-A-B',
      pivot,
      outline: bobbed[0],
      holes: bobbed.slice(1),
      amplitude: (tune.amplitude ?? 1.8) * DEG,
      rest: 0,
      contactPieces: [tab(1), tab(-1)].map((points) => points.map(([x, y]) => [x - pivot[0], y - pivot[1]])),
    },
    arbors: [{ center: [0, 0], radius: 9 * s, z0: -0.3, z1: 0.22, role: 'wheel-arbor-D' }],
    extras: (root, materials) => {
      const chops = plateMesh(rect(247, 38, 265.5, 65), [], -0.16, 0.16, materials.frame, 'fixed-suspension-chops');
      const pin = arborMesh([0, 0], 4.5 * s, P(241, 0)[0], P(277.5, 0)[0], materials.frame, 'chops-pin');
      pin.geometry.rotateY(Math.PI / 2);
      pin.position.set(0, P(0, 50.5)[1], 0);
      const collet = arborMesh([0, 0], 15 * s, 0.09, 0.15, materials.wheel, 'wheel-collet-D');
      return [chops, pin, collet];
    },
    fit: fitBox(map, [100, 30, 410, 505]),
    plotView: [-2.3, -1.2, 2.3, 1.2],
    mechanism: 'The annular pendulum frame swings on its suspension spring C; its two rectangular pallets A and B enter the seven-tooth wheel D alternately from the right and left. A tooth falls on the entering pallet and is held; as the frame swings back the tooth slides off the pallet end, the long curved back of the tooth pushing the pallet outward (impulse), and the wheel drops to the other pallet.',
  });
}

// ---------------------------------------------------------------------------
// 296: detached lever escapement. The balance D carries a roller pin that
// enters the notch E of lever E-B-C in the middle of each vibration and
// swings the lever between its bankings; the lever's pallets lock and
// receive impulse from the fifteen-tooth club wheel A.

function lever296(movement) {
  const tune = movement.tune ?? {};
  const map = plateMapper([298, 285], 0.02);
  const s = map.scale;
  const P = (x, y) => map([x, y]);
  const count = 15;
  const pitch = TAU / count;
  const tipRadius = 194 * s;
  const rootRadius = 150 * s;
  // Claw teeth (clockwise): from each gap a convex circular back rises to
  // the tip, which leads; the undercut face drops back to the root and a
  // plain land runs to the next gap.
  const tipAt = -(tune.tipOffset ?? 19.9) * DEG;
  const back = arcThrough(
    polar([0, 0], rootRadius + 2 * s, 0),
    polar([0, 0], 187 * s, tipAt * 0.69),
    polar([0, 0], tipRadius, tipAt),
    20,
  ).map(([x, y]) => [Math.atan2(y, x), Math.hypot(x, y)]);
  const faceRoot = tipAt + (tune.undercut ?? 6.4) * DEG;
  const tooth = [
    ...back,
    [faceRoot, rootRadius],
    ...Array.from({ length: 4 }, (_, i) => [faceRoot + (-pitch - faceRoot) * (i + 1) / 5, rootRadius]),
  ];
  const B = P(296, 51);
  const O = P(tune.balanceX ?? 70, 71);
  const pinRadius = (tune.pinRadius ?? 26) * s;
  const pinSize = 4 * s;
  const mouth = (tune.mouth ?? 19) * s;
  const slotBottom = pinRadius + pinSize + 1.5 * s;
  const u = (() => { const d = [B[0] - O[0], B[1] - O[1]]; const l = Math.hypot(...d); return [d[0] / l, d[1] / l]; })();
  const v = [-u[1], u[0]];
  const F = (a, l) => [O[0] + u[0] * a * s + v[0] * l * s, O[1] + u[1] * a * s + v[1] * l * s];
  const m = mouth / s;
  const halfSlot = 5.5;
  // Pallets as drawn, each turned a few degrees about B (right 2, left 3;
  // 4-7 px at the pallets) so the pallets' impulse faces carry the wheel
  // through nearly all of each beat's half tooth while the pin swings the
  // lever (about 0.45 and 0.5 pitch, with 0.03 recoil and 0.08 free drop);
  // as traced the wheel moved only 0.25 on one beat and ran 0.45 free with
  // the lever at rest after the other.
  const turnAboutB = (point, degrees) => add(rot([point[0] - B[0], point[1] - B[1]], degrees * DEG), B);
  const RP = (x, y) => turnAboutB(P(x, y), tune.rightTurn ?? 2);
  const LP = (x, y) => turnAboutB(P(x, y), tune.leftTurn ?? 3);
  const leverOutline = [
    P(294, 14), P(446, 54), P(508, 36), P(496, 92), RP(430, 88),
    RP(404, 124), RP(384, 108), RP(398, 82), LP(206, 82), LP(210, 106), LP(180, 106), LP(166, 74),
    F(m, -27), F(m, -halfSlot), F(slotBottom / s, -halfSlot), F(slotBottom / s, halfSlot), F(m, halfSlot), F(m, 27),
    P(160, 50),
  ];
  // Lever angle: the pin carries the slot while it is inside it; otherwise
  // the lever rests at the banking reached as the pin leaves.
  const period = 2;
  const balanceAmplitude = (tune.balanceAmplitude ?? 230) * DEG;
  const beta0 = Math.atan2(u[1], u[0]);
  const balanceAngle = (t) => balanceAmplitude * Math.sin(TAU * t / period);
  const pinAt = (beta) => [O[0] + pinRadius * Math.cos(beta0 + beta), O[1] + pinRadius * Math.sin(beta0 + beta)];
  const restDirection = Math.atan2(pinAt(0)[1] - B[1], pinAt(0)[0] - B[0]);
  const exitBeta = Math.acos(mouth / pinRadius);
  const slotAngle = (beta) => {
    const pin = pinAt(beta);
    return Math.atan2(pin[1] - B[1], pin[0] - B[0]) - restDirection;
  };
  const banking = slotAngle(exitBeta);
  const leverAngle = (t) => {
    const beta = balanceAngle(t);
    if (Math.abs(beta) <= exitBeta) return slotAngle(beta);
    return Math.sign(beta) * banking;
  };
  const balance = new THREE.Group();
  balance.name = 'balance-D';
  balance.position.set(O[0], O[1], 0);
  return pivotedEscapement({
    movement,
    name: 'movement-296-lever-escapement',
    period,
    dropAcceleration: tune.drop ?? 40,
    wheel: {
      role: 'club-tooth-escape-wheel-A',
      center: [0, 0],
      count,
      direction: -1,
      tooth,
      phase: (tune.phase ?? 89.4) * DEG,
      tipRadius,
      rootRadius,
      cellDepth: 12 * s,
      holes: (turn) => builderHoles({
        spokes: 3,
        windowShape: 'lens',
        outerRadius: rootRadius,
        rimInnerRadius: 112 * s,
        // Brown's crossings: about 22 px across at the rim, and each
        // window's inner arc stops about 33 px from the centre, so the
        // three crossings meet in a broad web round the arbor.
        spokeTipWidth: (tune.spokeTipWidth ?? 22) * s,
        hubRadius: (tune.spokeHub ?? 33) * s,
        boreRadius: 5 * s,
        // Brown's windows: right, lower left and upper left.
        phase: -60 * DEG,
      }, turn),
    },
    oscillator: {
      name: 'lever-E-B-C',
      role: 'pallet-lever-E-B-C',
      pivot: B,
      outline: leverOutline,
      holes: [circlePoints(B, 5 * s, 32)],
      angle: leverAngle,
      startTime: 0,
      plateTime: (t) => Math.abs(balanceAngle(t)) < 0.15 * exitBeta,
      clipMargin: 0.3,
    },
    arbors: [
      { center: [0, 0], radius: 5 * s, z0: -0.3, z1: 0.2, role: 'escape-wheel-arbor' },
      { center: B, radius: 5 * s, z0: -0.3, z1: 0.2, role: 'lever-arbor-B' },
    ],
    extras: (root, materials) => {
      // The balance's roller has its own colour so it does not blend into
      // the lever where they overlap.
      const diskMaterial = matte(PALETTE.accent, { metalness: 0.2, roughness: 0.55 });
      const disk = plateMesh(circlePoints([0, 0], 46 * s, 96), [circlePoints([0, 0], 5 * s, 32)], -0.34, -0.14, diskMaterial, 'balance-roller-disk-D');
      const pin = arborMesh([pinRadius * Math.cos(beta0), pinRadius * Math.sin(beta0)], pinSize, -0.14, 0.08, materials.arbor, 'roller-pin');
      // The fixed staff through D's centre (it was placed at the wheel's
      // centre, coincident with the escape-wheel arbor, leaving D empty).
      const arbor = arborMesh(O, 5 * s, -0.4, 0.0, materials.arbor, 'balance-arbor-D');
      balance.add(disk, pin);
      root.add(balance);
      return [arbor];
    },
    extraUpdate: (t) => { balance.rotation.z = balanceAngle(t); },
    fit: fitBox(map, [10, 10, 512, 480]),
    plotView: [-4.8, 3.4, 4.8, 6.0],
    mechanism: 'The balance D swings freely except in the middle of each vibration, when its roller pin enters the notch E and swings the lever E-B-C across; one pallet unlocks the club-tooth wheel A, whose tooth then slides over the pallet end and returns an impulse through the lever to the pin, and the other pallet locks the next tooth. The lever then rests on its banking until the pin returns.',
  });
}

// ---------------------------------------------------------------------------
// 291: Arnold's spring-detent (free) escapement. Balance a carries the
// impulse roller (a plain disc with one triangular notch) and, on its
// arbor, the small discharging stud. Detent spring A (fixed at b) carries
// the stop d, the stud i and the hook k; the light passing spring runs from
// i under k to the stud. The escape wheel B turns clockwise.

function smoothStep(x) {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
}

function free291(movement) {
  const tune = movement.tune ?? {};
  // Wheel B about Brown's centre mark (145.5, 327). His ten unobstructed
  // tooth tips lie 119.5-125.8 px from it (mean about 121.7 on the ink), so
  // the tips are on 121.7 px; roots on 101 px.
  const map = plateMapper([tune.cx ?? 145.5, tune.cy ?? 327], 0.02);
  const s = map.scale;
  const P = (x, y) => map([x, y]);
  const count = 13;
  const pitch = TAU / count;
  const tipRadius = (tune.tip ?? 121.7) * s;
  const rootRadius = (tune.root ?? 101) * s;
  // Hooked teeth leaning clockwise: the tip leads, its face is undercut
  // back to the root and a straight back rises to the next tip.
  const undercut = (tune.undercut ?? 1.2) * DEG;
  const rootPoint = polar([0, 0], rootRadius, undercut);
  const nextTip = polar([0, 0], tipRadius, -pitch);
  const tooth = [
    [0, tipRadius],
    [undercut, rootRadius],
    ...Array.from({ length: 5 }, (_, i) => {
      const u = (i + 1) / 6;
      const x = rootPoint[0] + (nextTip[0] - rootPoint[0]) * u;
      const y = rootPoint[1] + (nextTip[1] - rootPoint[1]) * u;
      return [Math.atan2(y, x), Math.hypot(x, y)];
    }),
  ];
  const period = 2;
  // Layers: wheel, impulse roller and stop d in the wheel plane; detent,
  // passing spring and discharging stud in the plane in front of it.
  const wheelZ = [-0.07, 0.07];
  const frontZ = [0.1, 0.22];
  const springZ = [0.17, 0.215];
  // Balance a: impulse roller with the notch g-h facing the wheel at t = 0.
  // Balance a and its roller: a circle fit to Brown's roller outline gives
  // centre (75, 182.5), radius 48.5 px (ink centre line); his arbor mark at
  // (77, 186) is 4 px off that centre, so the concentric roller and arbor
  // stand at the roller's centre. (Round the arbor mark, a 48 px roller
  // would stand 2 px nearer the wheel than Brown's and block the tips.)
  const O = P(tune.ox ?? 75, tune.oy ?? 182.5);
  const rollerRadius = (tune.rollerRadius ?? 48.5) * s;
  const toWheel = Math.atan2(-O[1], -O[0]);
  const notchAt = toWheel + (tune.notchTurn ?? -8) * DEG;
  const notchLeft = notchAt - (tune.notchLong ?? 50) * DEG;
  const notchRight = notchAt + 1.5 * DEG;
  const apex = polar([0, 0], 26 * s, notchAt - 8 * DEG);
  const roller = joinPath(arcPoints([0, 0], rollerRadius, notchRight, notchLeft + TAU, 120), [apex]);
  const balanceAmplitude = (tune.balanceAmplitude ?? 250) * DEG;
  const balanceAngle = (t) => balanceAmplitude * Math.sin(TAU * t / period);
  const balanceRate = (t) => balanceAmplitude * TAU / period * Math.cos(TAU * t / period);
  // Passing spring: from beyond stud i under hook k to its tip at the stud.
  const springTip = P(tune.springTipX ?? 88, 185.4);
  const springEnd = P(408, 168.5);
  const studI = P(336, 172.4);
  const tipOffset = [springTip[0] - O[0], springTip[1] - O[1]];
  const tailReach = (tune.tailReach ?? 16) * s;
  const tailHalf = 0.25;
  const halfThick = 1 * s;
  // The stud is a slim tail; it meets the spring's underside (lifting) or
  // top (bending it down) with its edge, offset c from its centre line.
  const edge = 7 * s * Math.sin(tailHalf) * (tailReach - tipOffset[0]) / (tailReach - 7 * s);
  const c = halfThick + edge + 1 * s;
  const tauUp = Math.atan2(tipOffset[1] - c, tipOffset[0]);
  const tauDown = Math.atan2(tipOffset[1] + c, tipOffset[0]);
  const slipAngle = Math.acos(Math.min(1, tipOffset[0] / tailReach));
  const tailAngle0 = tauUp;
  const b = P(440, 199);
  const armToTip = b[0] - springTip[0];
  const fall = 0.05 * period;
  const lift = (A) => tipOffset[0] * Math.tan(A) - (tipOffset[1] - c);
  const depress = (A) => tipOffset[0] * Math.tan(A) - (tipOffset[1] + c);
  // The stud meets the spring `lead` before the notch faces the wheel, so
  // the tooth released at d falls into the notch as it comes round.
  const lead = (tune.unlockLead ?? 55) * DEG;
  const omega = TAU / period;
  const clampUnit = (v) => Math.max(-1, Math.min(1, v));
  const tCCW = (theta) => Math.asin(clampUnit(theta / balanceAmplitude)) / omega;
  const tCW = (theta) => period / 2 - Math.asin(clampUnit(theta / balanceAmplitude)) / omega;
  const bendX = 146;
  const springArm = P(bendX, 0)[0] - springTip[0];
  const thetaAt = (A) => A - tauUp - lead;
  // Detent rotation about b (clockwise raises d) and passing-spring bend.
  const detentState = (t) => {
    const tt = ((t + period / 4) % period + period) % period - period / 4;
    const A = tauUp + lead + balanceAngle(t);
    const l0 = tCCW(thetaAt(tauUp));
    const l1 = tCCW(thetaAt(slipAngle));
    if (tt >= l0 && tt <= l1) return { detent: -Math.max(0, lift(A)) / armToTip, spring: 0 };
    if (tt > l1 && tt <= l1 + fall) return { detent: -lift(slipAngle) / armToTip * (1 - smoothStep((tt - l1) / fall)), spring: 0 };
    const d0 = tCW(thetaAt(tauDown));
    const d1 = tCW(thetaAt(-slipAngle));
    if (tt >= d0 && tt <= d1) return { detent: 0, spring: -Math.min(0, depress(A)) / springArm };
    if (tt > d1 && tt <= d1 + fall) return { detent: 0, spring: -depress(-slipAngle) / springArm * (1 - smoothStep((tt - d1) / fall)) };
    return { detent: 0, spring: 0 };
  };
  // Detent A with hook k and stud i (one piece), and the stop d.
  // The hook k is a bent tab: its post stands at the back of the detent's
  // plane and its lip reaches forward over the passing spring, which runs
  // in front of the post and on past the end of A to the stud.
  const detentOutline = [P(133, 192), P(326, 194.5), P(326, 151), P(347, 151), P(347, 195.8), P(440, 196), P(440, 202), P(133, 201)];
  // Stop d: its bottom on Brown's ink line at y 215, 11 px wide. Brown draws
  // it at x 188-199, but there the roller's periphery (which overlaps the
  // tip circle, as his roller does) caught the tooth under it 0.11 before a
  // tip reached d, so the wheel rested on the roller and d never locked.
  // Set 7 px nearer the roller (x 181-192), the tip locks on d's face and
  // the tooth under the roller stands about 1 px clear of it, so the
  // balance swings free of the wheel except at unlocking and impulse.
  const dx = tune.dx ?? 181;
  const stopD = [P(dx, 201.5), P(dx + 11, 201.5), P(dx + 11, tune.stopBottom ?? 215), P(dx, tune.stopBottom ?? 215)];
  const localB = (points) => points.map(([x, y]) => [x - b[0], y - b[1]]);
  const balance = new THREE.Group();
  balance.name = 'balance-a';
  balance.position.set(O[0], O[1], 0);
  const passing = new THREE.Group();
  passing.name = 'light-passing-spring';
  return pivotedEscapement({
    movement,
    name: 'movement-291-arnold-free-escapement',
    period,
    dropAcceleration: tune.drop ?? 1500,
    wheel: {
      role: 'escape-wheel-B',
      center: [0, 0],
      count,
      direction: -1,
      tooth,
      phase: (tune.phase ?? 73) * DEG,
      tipRadius,
      rootRadius,
      cellDepth: 10 * s,
      holes: () => [circlePoints([0, 0], 7 * s, 40)],
    },
    oscillator: {
      name: 'detent-spring-A',
      role: 'detent-spring-A-with-hook-k-and-stud-i',
      color: PALETTE.brass,
      pivot: b,
      outline: detentOutline,
      zRange: frontZ,
      angle: (t) => detentState(t).detent,
      contactPieces: [localB(stopD)],
      startTime: 0.3 * period,
      // Brown's pose: the balance at the middle of its swing with the notch
      // at the wheel and A down on its banking (d locking): the return swing,
      // on which the stud only bends the passing spring.
      plateTime: (t) => Math.abs(balanceAngle(t)) < 6 * DEG && balanceRate(t) < 0
        && detentState(t).detent === 0 && detentState(t).spring === 0,
    },
    extraObstacles: (t) => [{ points: placeFlat(toFlat(roller), { x: O[0], y: O[1], angle: balanceAngle(t) }) }],
    extraPlot: (t) => [
      { points: roller.map((p) => add(rot(p, balanceAngle(t)), O)), color: 'green' },
      { points: stopD.map((p) => add(rot([p[0] - b[0], p[1] - b[1]], detentState(t).detent), b)), color: 'purple' },
    ],
    arbors: [
      { center: [0, 0], radius: 7 * s, z0: -0.3, z1: 0.14, role: 'escape-wheel-arbor' },
    ],
    extras: (root, materials) => {
      const detentMaterial = matte(PALETTE.brass, { metalness: 0.25, roughness: 0.5 });
      const balanceMaterial = matte(PALETTE.driven, { metalness: 0.2, roughness: 0.55 });
      // Stop d is fixed under A and reaches down into the wheel plane.
      const stop = plateMesh(localB(stopD), [], wheelZ[0], frontZ[1], detentMaterial, 'stop-d-under-detent');
      materials.rocker.add(stop);
      materials.rocker.add(plateMesh(localB([P(133, 178), P(137, 178), P(137, 192.5), P(133, 192.5)]), [], frontZ[0], springZ[0] - 0.015, detentMaterial, 'hook-k-post'));
      materials.rocker.add(plateMesh(localB([P(133, 178), P(146, 178), P(146, 181.8), P(133, 181.8)]), [], frontZ[0], springZ[1] + 0.02, detentMaterial, 'hook-k-lip'));
      balance.add(
        plateMesh(roller, [circlePoints([0, 0], 5 * s, 32)], wheelZ[0], wheelZ[1], balanceMaterial, 'balance-impulse-roller-with-notch-g'),
        plateMesh(joinPath(arcPoints([0, 0], 7 * s, tailAngle0 + lead + tailHalf, tailAngle0 + lead - tailHalf + TAU, 40), [polar([0, 0], tailReach, tailAngle0 + lead)]),
          [circlePoints([0, 0], 5 * s, 32)], frontZ[0], frontZ[1], balanceMaterial, 'discharging-stud-a'),
      );
      root.add(balance);
      const dir = [springEnd[0] - springTip[0], springEnd[1] - springTip[1]];
      const len = Math.hypot(...dir);
      const n = [-dir[1] / len * halfThick, dir[0] / len * halfThick];
      const along = (x) => { const u = (x - springTip[0]) / dir[0]; return [springTip[0] + dir[0] * u, springTip[1] + dir[1] * u]; };
      const strip = (a, bEnd) => [
        [a[0] + n[0], a[1] + n[1]], [bEnd[0] + n[0], bEnd[1] + n[1]],
        [bEnd[0] - n[0], bEnd[1] - n[1]], [a[0] - n[0], a[1] - n[1]],
      ];
      // The passing spring is held in stud i and passes under the lip of k;
      // bent down by the stud, only its free end beyond k flexes.
      const face = along(P(326, 0)[0]);
      const bend = along(P(bendX, 0)[0]);
      passing.position.set(bend[0] - b[0], bend[1] - b[1], 0);
      passing.add(plateMesh(strip(springTip, bend).map(([x, y]) => [x - bend[0], y - bend[1]]), [], springZ[0], springZ[1], detentMaterial, 'light-passing-spring-i-k'));
      materials.rocker.add(plateMesh(localB(strip(bend, face)), [], springZ[0], springZ[1], detentMaterial, 'light-passing-spring-held-length'));
      materials.rocker.add(plateMesh(localB(strip(along(P(347, 0)[0]), springEnd)), [], springZ[0], springZ[1], detentMaterial, 'passing-spring-end-f'));
      materials.rocker.add(passing);
      // A is screwed into b: the block's face stands at A's root (x 440).
      const block = plateMesh([P(440, 178), P(484, 178), P(484, 219), P(440, 219)], [], -0.3, frontZ[1], materials.frame, 'fixed-block-b');
      const screw = arborMesh(P(464, 198.5), 8 * s, frontZ[1], frontZ[1] + 0.05, materials.frame, 'screw-at-b');
      const arbor = arborMesh(O, 5 * s, -0.3, frontZ[1] + 0.06, materials.arbor, 'balance-arbor');
      return [block, screw, arbor];
    },
    extraUpdate: (t) => {
      balance.rotation.z = balanceAngle(t);
      passing.rotation.z = detentState(t).spring;
    },
    fit: fitBox(map, [20, 140, 500, 455]),
    plotView: [-2.2, -0.2, 1.4, 3.4],
    mechanism: 'The detent spring A, fixed at b, holds a tooth of wheel B on its stop d. As the balance returns, the stud on its arbor lifts the light spring, which bears on the hook k and raises A and d; one tooth escapes and the next strikes the notch g in the impulse roller, then A falls and d stops the following tooth. On the other swing the stud merely bends the light spring down, so the balance is otherwise free.',
  });
}

// ---------------------------------------------------------------------------
// 292: stud escapement for large clocks. Studs stand alternately on the
// front and back faces of the wheel rim; the anchor hung at F has two plain
// arms, B-c in front of the wheel and A-R behind it, each ending in a pallet
// whose locking face is an arc about F (dead-beat) and whose end is the
// inclined impulse face.

function stud292(movement) {
  const tune = movement.tune ?? {};
  const map = plateMapper([190, 495], 0.02);
  const s = map.scale;
  const P = (x, y) => map([x, y]);
  const studs = 48;
  const studPitch = TAU / studs;
  // Brown's rim has a middle line (radius 230 px): the studs are clear
  // triangles standing on it, the front ones pointing outward over the
  // outer half of the face, the back ones inward over the inner half.
  const middle = 230 * s;
  const studBase = (tune.studBase ?? 9) * s;
  const studHeight = (tune.studHeight ?? 10) * s;
  const F = P(227.5, 56);
  const layerZ = { back: [-0.32, -0.2], front: [0.2, 0.32] };
  // Path frame at the pallets: x runs down the studs' path (away from F,
  // which the path points at), y runs outward across it; both pallets move
  // along y (arcs about F), so their locking faces x = const are dead-beat.
  const pathPoint = polar([0, 0], middle, (tune.pathAngle ?? 27) * DEG);
  const psi0 = Math.atan2(pathPoint[1] - F[1], pathPoint[0] - F[0]);
  const rho0 = Math.hypot(pathPoint[0] - F[0], pathPoint[1] - F[1]);
  const radiusPx = rho0 / s;
  const pf = (x, y) => polar(F, rho0 + x * s, psi0 + y / radiusPx);
  const studTriangle = (angle, front) => {
    const half = studBase / 2 / middle;
    const lead = angle - half; // clockwise travel: the leading flank is radial
    return front
      ? [polar([0, 0], middle, lead), polar([0, 0], middle + studHeight, lead), polar([0, 0], middle, angle + half)]
      : [polar([0, 0], middle, lead), polar([0, 0], middle, angle + half), polar([0, 0], middle - studHeight, lead)];
  };
  const phase = (tune.phase ?? 30) * DEG;
  const studAngles = Array.from({ length: studs }, (_, k) => phase - k * studPitch);
  const cells = studAngles.map((angle, k) => ({ points: studTriangle(angle, k % 2 === 1), layer: k % 2 ? 1 : 2 }));
  // Pallets (anchor frame = plate pose), each a band between two arcs about
  // F (x = 0 is the locking face met by the oncoming studs) cut off by one
  // inclined impulse face: Brown's wedge c ends the front arm in a sharp
  // point T, and R mirrors it from the inside of the path.
  const W = tune.palletWidth ?? 24;
  const D = tune.palletDrop ?? 16;
  const yU = tune.palletSet ?? 15;
  const G = tune.palletGap ?? 32;
  const arcX = (x, y0, y1, n = 24) => Array.from({ length: n + 1 }, (_, i) => pf(x, y0 + (y1 - y0) * i / n));
  const wedge = (yCorner, dropSign, yFar) => joinPath(
    arcX(0, yFar, yCorner),
    [pf(W, yCorner - dropSign * D)],
    arcX(W, yCorner - dropSign * D, yFar).slice(1),
  );
  const frontPallet = wedge(yU, 1, yU + 40);
  const backPallet = wedge(yU - G, -1, yU - G - 40);
  const B = P(482, 338);
  const hubR = 36 * s;
  const bar = (a, b, w) => {
    const d = [b[0] - a[0], b[1] - a[1]]; const l = Math.hypot(...d); const n = [-d[1] / l * w / 2, d[0] / l * w / 2];
    return [[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]];
  };
  // The front arm runs F-B, then down the arc band B-c to the wedge; the
  // band's working end (the pallet c) is thickened back to the studs'
  // layer. The back arm runs straight from F to its pallet R.
  const bandTop = (Math.atan2(B[1] - F[1], B[0] - F[0]) - psi0) * radiusPx;
  const frontArm = union([
    [circlePoints(F, hubR, 64)],
    [bar(F, B, 40 * s)],
    [circlePoints(B, 20 * s, 32)],
    [wedge(yU, 1, bandTop)],
  ]);
  const backEnd = pf(W / 2, yU - G - 30);
  const backArm = union([
    [circlePoints(F, hubR, 64)],
    [bar(F, backEnd, 26 * s)],
    [backPallet],
  ]);
  if (frontArm.length !== 1 || backArm.length !== 1) throw new Error('292 arms are not single pieces');
  const local = (points) => points.map(([x, y]) => [x - F[0], y - F[1]]);
  const wheelOptions = {
    spokes: 4,
    outerRadius: 250 * s,
    rimInnerRadius: 205 * s,
    spokeWidth: 30 * s,
    hubRadius: 26 * s,
    rimFillet: 6 * s,
    boreRadius: 11 * s,
    phase: 40 * DEG,
  };
  return pivotedEscapement({
    movement,
    name: 'movement-292-stud-escapement',
    period: 2,
    halfDepth: 0.08,
    wheel: {
      role: 'stud-wheel-rim',
      center: [0, 0],
      count: studs / 2,
      direction: -1,
      tooth: [[0, 250 * s]],
      outline: circlePoints([0, 0], 250 * s, 256),
      phase,
      tipRadius: middle + studHeight,
      rootRadius: middle - studHeight,
      cells,
      holes: (turn) => builderHoles(wheelOptions, turn),
    },
    oscillator: {
      name: 'stud-anchor-F',
      role: 'front-arm-F-B-with-pallet-c',
      pivot: F,
      outline: frontArm[0][0],
      holes: [...frontArm[0].slice(1), circlePoints(F, 9 * s, 32)],
      zRange: layerZ.front,
      amplitude: (tune.amplitude ?? 2) * DEG,
      contactPieces: [{ points: local(frontPallet), layer: 1 }, { points: local(backPallet), layer: 2 }],
    },
    extras: (root, materials) => {
      const back = plateMesh(local(backArm[0][0]), [...backArm[0].slice(1).map(local), circlePoints([0, 0], 9 * s, 32)],
        layerZ.back[0], layerZ.back[1], materials.oscillator, 'back-arm-F-A-with-pallet-R');
      materials.rocker.add(back);
      // Hub between the two arm plates, bored for the arbor.
      materials.rocker.add(plateMesh(circlePoints([0, 0], hubR, 64), [circlePoints([0, 0], 9 * s, 32)], layerZ.back[1], layerZ.front[0], materials.oscillator, 'anchor-hub-F'));
      materials.rocker.add(plateMesh(local(frontPallet), [], 0.09, layerZ.front[0], materials.oscillator, 'front-pallet-c'));
      materials.rocker.add(plateMesh(local(backPallet), [], layerZ.back[1], -0.09, materials.oscillator, 'back-pallet-R'));
      // Steel studs set in the wheel, so they read as Brown's clear
      // triangles on the rim.
      const studMaterial = matte(PALETTE.white, { metalness: 0.3, roughness: 0.45 });
      studAngles.forEach((angle, k) => {
        const z = k % 2 ? [0.08, 0.18] : [-0.18, -0.08];
        materials.wheelRotor.add(plateMesh(studTriangle(angle, k % 2 === 1), [], z[0], z[1], studMaterial, k % 2 ? 'front-stud' : 'back-stud'));
      });
      return [];
    },
    arbors: [
      { center: [0, 0], radius: 11 * s, z0: -0.4, z1: 0.3, role: 'wheel-arbor' },
      { center: F, radius: 9 * s, z0: -0.42, z1: 0.42, role: 'anchor-arbor-F' },
    ],
    fit: fitBox(map, [0, 20, 510, 520]),
    plotView: [3.2, 3.2, 5.2, 5.2],
    mechanism: 'The pendulum rocks the anchor about F. The front pallet c and the back pallet R cross the path of the studs alternately; a stud rests on a pallet face that is an arc about F (dead-beat), slides over the inclined end of that pallet as it withdraws (impulse) and the wheel drops half a stud pitch to the next stud, which lands on the other pallet.',
  });
}

// ---------------------------------------------------------------------------
// 293: duplex escapement (close-up of the top of the wheel). The long teeth
// in the wheel's plane rest on the balance roller A and pass one at a time
// through its notch; the crown pins a on the wheel's face then strike the
// impulse pallet B on the balance staff (single beat).

function duplex293(movement) {
  const tune = movement.tune ?? {};
  const map = plateMapper([262, 560], 0.02);
  const s = map.scale;
  const P = (x, y) => map([x, y]);
  const count = tune.count ?? 13;
  const pitch = TAU / count;
  const tipRadius = (tune.tipRadius ?? 413) * s;
  const rimRadius = 318 * s;
  const pinCircle = (tune.pinCircle ?? 260) * s;
  const pinR = 7 * s;
  const half = (tune.toothHalf ?? 3.2) * DEG;
  // Long radial spike teeth with a narrow land at the tip.
  const tooth = [
    [0.25 * DEG, tipRadius], [-0.25 * DEG, tipRadius],
    [-half, rimRadius],
    ...Array.from({ length: 6 }, (_, i) => [-half - (pitch - 2 * half) * (i + 1) / 7, rimRadius]),
    [-pitch + half, rimRadius],
  ];
  const toothPhase = (tune.phase ?? 90.6) * DEG;
  const toothCellsList = toothCells(count, toothPhase, tooth, rimRadius, 12 * s).map((cell) => ({ points: cell.points, layer: 0 }));
  const pinAngle = (k) => toothPhase - (k + 0.5) * pitch;
  const pinCells = Array.from({ length: count }, (_, k) => ({ points: circlePoints(polar([0, 0], pinCircle, pinAngle(k)), pinR, 16), layer: 1 }));
  const axis = P(267, 113.75);
  const rollerR = (tune.rollerRadius ?? 39.5) * s;
  const notchAt = (tune.notchAt ?? -34) * DEG;
  const notchHalf = (tune.notchHalf ?? 11) * DEG;
  const notchDepth = (tune.notchDepth ?? 16) * s;
  const roller = joinPath(
    arcPoints(axis, rollerR, notchAt + notchHalf, notchAt - notchHalf + TAU, 96),
    [polar(axis, rollerR - notchDepth, notchAt - notchHalf * 0.6), polar(axis, rollerR - notchDepth, notchAt + notchHalf * 0.6)],
  );
  // Impulse pallet B: two circular arcs (both bulging right) from the boss
  // round the staff to its pointed tip; its reach is set by `reach`.
  const reach = (tune.reach ?? 187.5) / 199;
  const Bp = (x, y) => { const q = P(x, y); return [axis[0] + (q[0] - axis[0]) * reach, axis[1] + (q[1] - axis[1]) * reach]; };
  const tipB = Bp(336, 302);
  const palletB = union([
    [circlePoints(axis, 16 * s, 48)],
    [joinPath(arcThrough(Bp(275, 128), Bp(302, 220), tipB, 24), arcThrough(tipB, Bp(349, 228), Bp(290, 104), 24).slice(1))],
  ])[0];
  const localA = (points) => points.map(([x, y]) => [x - axis[0], y - axis[1]]);
  const period = 2;
  const amplitude = (tune.amplitude ?? 95) * DEG;
  // Display law: the balance swings harmonically in phase u, but lingers
  // (speed down to 1 - warp of the mean) through the impulse arc, so the
  // notch passage, the pin's push on B and the drop read as one spread
  // advance instead of a snap. A kinematic presentation choice.
  const warpDepth = tune.warp ?? 0.7;
  const warpAt = tune.warpAt ?? -0.3;
  const bump = [0.4375, 0.21875, 0.0625, 0.0078125];
  const bumpMean = 0.2734375;
  const slow = (x) => bump.reduce((sum, a, i) => sum + a * Math.sin((i + 1) * x) / (i + 1), 0) / (1 - bumpMean);
  const warp = (phi) => phi - warpDepth * (slow(phi - warpAt) - slow(-warpAt));
  // Brown's wheel reads as a heavy ring: a thick plate whose long teeth
  // work the roller A in the wheel's own layer, with the crown pins a
  // standing on its front face under pallet B.
  const wheelHalf = tune.wheelHalfDepth ?? 0.2;
  const pinZ = [wheelHalf - 0.01, wheelHalf + 0.13];
  const palletZ = [wheelHalf + 0.02, wheelHalf + 0.12];
  const rollerHalf = 0.12;
  const wheelOptions = {
    spokes: 4, outerRadius: rimRadius, rimInnerRadius: 226 * s, spokeWidth: 26 * s,
    hubRadius: 30 * s, rimFillet: 8 * s, boreRadius: 10 * s, phase: 45 * DEG,
  };
  return pivotedEscapement({
    movement,
    name: 'movement-293-duplex-escapement',
    period,
    halfDepth: wheelHalf,
    dropAcceleration: tune.drop ?? 150,
    wheel: {
      role: 'duplex-escape-wheel',
      center: [0, 0],
      count,
      direction: -1,
      tooth,
      phase: toothPhase,
      tipRadius,
      rootRadius: rimRadius,
      cells: [...toothCellsList, ...pinCells],
      holes: (turn) => builderHoles(wheelOptions, turn),
    },
    oscillator: {
      name: 'balance-staff-A',
      role: 'impulse-pallet-B',
      pivot: axis,
      outline: palletB[0],
      holes: [circlePoints(axis, 7 * s, 32)],
      zRange: palletZ,
      amplitude,
      angle: (t) => amplitude * Math.sin(warp(TAU * t / period)),
      plateTolerance: 0.03,
      contactPieces: [{ points: localA(roller), layer: 0 }, { points: localA(palletB[0]), layer: 1 }],
    },
    extras: (root, materials) => {
      materials.rocker.add(plateMesh(localA(roller), [circlePoints([0, 0], 7 * s, 32)], -rollerHalf, rollerHalf, materials.oscillator, 'notched-roller-A'));
      for (let k = 0; k < count; k += 1) {
        materials.wheelRotor.add(arborMesh(polar([0, 0], pinCircle, pinAngle(k)), pinR, pinZ[0], pinZ[1], materials.wheel, 'crown-pin-a'));
      }
      // Pallet B covers the roller's notch in Brown's pose; it is shown
      // see-through so the notch reads behind it.
      makeSeeThrough(materials.rocker.children.find((mesh) => mesh.userData.role === 'impulse-pallet-B'));
      return [];
    },
    arbors: [
      { center: axis, radius: 7 * s, z0: -wheelHalf - 0.1, z1: palletZ[1] + 0.06, role: 'balance-staff-arbor' },
      { center: [0, 0], radius: 10 * s, z0: -wheelHalf - 0.1, z1: wheelHalf + 0.06, role: 'wheel-arbor' },
    ],
    fit: fitBox(map, [30, 40, 510, 440]),
    plotView: [-2.6, 5.4, 2.6, 9.6],
    mechanism: 'Each long tooth rests on the balance roller A until the notch comes round; the tooth passes through the notch, the wheel turns and a crown pin a strikes the impulse pallet B, driving the balance; the next long tooth then falls on the roller. On the return swing the notch merely passes the resting tooth (single beat).',
  });
}

// ---------------------------------------------------------------------------
// 294 and 295: one cylinder escapement model. 295 is Brown's plan of the top
// of the wheel: wedge pallets a, b, c on stalks, and the cylinder A-B at the
// level of the wheel, cut to a C whose lips A and B are the impulse edges.
// 294 is the same cylinder seen from the side (its profile from Brown's
// perspective view). The balance rides on the collet at the cylinder's far
// end; Brown draws no balance, frame or wheel arbor bearings.

function cylinderEscapement(movement) {
  const tune = movement.tune ?? {};
  const s = 0.02;
  const count = 15;
  const pitch = TAU / count;
  // Wheel (plan, 295 scale): the cylinder axis sits on the wedge circle.
  const axisRadius = 420 * s;
  const W = [0, 0];
  const cylAxis = [0, axisRadius];
  const Rt = (tune.tipRadius ?? 426) * s;
  const heelTop = (tune.heelTop ?? 412) * s;
  const heelBottom = 400 * s;
  const valleyBottom = (tune.valleyBottom ?? 352) * s;
  const wedge = (tune.wedgeLength ?? 9.2) * DEG;
  const stalkHalf = 1.4 * DEG;
  // The wheel web (rim, stalks and round-bottomed valleys) lies in the plane
  // of the cylinder's deep cut; each tooth's wedge head stands on a short
  // pillar at the level of the C passage, as Brown's plan overlays them.
  const valley = arcThrough(
    polar(W, heelBottom, -stalkHalf),
    polar(W, valleyBottom, -pitch / 2),
    polar(W, heelBottom, -pitch + stalkHalf),
    28,
  ).map(([x, y]) => [Math.atan2(y, x), Math.hypot(x, y)]);
  const tooth = [[stalkHalf, heelBottom], ...valley.slice(0, -1)];
  const phase = (tune.phase ?? 96) * DEG;
  const headAngle = (k) => phase - k * pitch;
  const heelSpan = 2.6 * DEG;
  const head = (k) => {
    const h = headAngle(k);
    return [
      polar(W, heelTop, h + stalkHalf), polar(W, Rt, h - wedge), polar(W, Rt - 5 * s, h - wedge + 1.2 * DEG),
      polar(W, heelBottom - 6 * s, h - heelSpan + stalkHalf), polar(W, heelBottom - 6 * s, h + stalkHalf),
    ];
  };
  const pillar = (k) => {
    const h = headAngle(k);
    return [polar(W, heelBottom - 6 * s, h + stalkHalf), polar(W, heelBottom - 6 * s, h - stalkHalf),
      polar(W, heelTop - 2 * s, h - stalkHalf), polar(W, heelTop - 2 * s, h + stalkHalf)];
  };
  const rimInner = (tune.rimInner ?? 325) * s;
  const rimChamfer = 3 * s;
  // Cylinder section at the wheel: a C of the tube's wall, lips rounded.
  const Rc = 49 * s;
  const rc = 39 * s;
  const wallSpan = (tune.wallSpan ?? 180) * DEG;
  const openFacing = (tune.openFacing ?? -90) * DEG;
  const wallFrom = openFacing + (TAU - wallSpan) / 2;
  const wallTo = wallFrom + wallSpan;
  const lipR = (Rc - rc) / 2;
  const mid = (Rc + rc) / 2;
  const cSection = joinPath(
    arcPoints([0, 0], Rc, wallFrom, wallTo, 60),
    arcPoints(polar([0, 0], mid, wallTo), lipR, wallTo, wallTo + Math.PI, 10),
    arcPoints([0, 0], rc, wallTo, wallFrom, 50),
    arcPoints(polar([0, 0], mid, wallFrom), lipR, wallFrom + Math.PI, wallFrom + TAU, 10),
  );
  const period = 2;
  const amplitude = (tune.amplitude ?? 100) * DEG;
  // Cylinder along z (294's axis): u is Brown's 294 axial pixel.
  const k = 1.307 * s;
  const zOf = (u) => -(u - 242) * k;
  const px = (v) => v * 1.307 * s;
  const cylinderParts = [];
  const cut1 = [zOf(283), zOf(202)];
  const cut2 = [zOf(357), zOf(283)];
  const headZ = [cut1[0] + 0.1, cut1[0] + 0.35];
  const webZ = [cut2[1] - 0.45, cut2[1] - 0.25];
  const deepSpan = (tune.deepSpan ?? 110) * DEG;
  const deepFrom = openFacing + Math.PI - deepSpan / 2;
  const deepSection = joinPath(
    arcPoints([0, 0], Rc, deepFrom, deepFrom + deepSpan, 40),
    arcPoints([0, 0], rc, deepFrom + deepSpan, deepFrom, 34),
  );
  const cylinder = new THREE.Group();
  cylinder.name = 'cylinder-A-B';
  cylinder.position.set(cylAxis[0], cylAxis[1], 0);
  const cylMaterial = matte(ANCHOR_COLOR, { metalness: 0.25, roughness: 0.5 });
  const tube = (role, u0, u1, outer, inner = 0) => {
    const z0 = zOf(u1); const z1 = zOf(u0);
    const profile = inner > 0
      ? [[z0, px(inner)], [z0, px(outer)], [z1, px(outer)], [z1, px(inner)]]
      : [[z0, 0], [z0, px(outer)], [z1, px(outer)], [z1, 0]];
    const mesh = tagged(new THREE.Mesh(turnedSmooth(profile), cylMaterial), role);
    cylinder.add(mesh);
    return mesh;
  };
  // Upper end (toward the 295 viewer): pivot, collar, dome, flange, tube.
  tube('cylinder-upper-end-pivot', 20, 50, 5);
  tube('cylinder-upper-end-collar', 50, 110, 17.5);
  const dome = [];
  for (let i = 0; i <= 16; i += 1) {
    const a = (Math.PI / 2) * i / 16;
    dome.push([zOf(110 + 28 * (1 - Math.cos(a))), px(17.5 + 20 * Math.sin(a))]);
  }
  cylinder.add(tagged(new THREE.Mesh(turnedSmooth([[zOf(138), 0], ...dome.slice().reverse(), [zOf(110), 0]].reverse()), cylMaterial), 'cylinder-upper-end-dome'));
  tube('cylinder-upper-end-flange', 138, 148, 40);
  tube('cylinder-upper-end-tube', 148, 202, 37.5, 30);
  cylinder.add(plateMesh(cSection, [], cut1[0], cut1[1], cylMaterial, 'cylinder-passage-C-with-lips-A-B'));
  cylinder.add(plateMesh(deepSection, [], cut2[0], cut2[1], cylMaterial, 'cylinder-deep-cut-wall'));
  tube('cylinder-tube-below-passage', 357, 390, 37.5, 30);
  tube('cylinder-lower-plug', 390, 427, 40);
  tube('balance-collet-on-cylinder', 427, 445, 47);
  tube('cylinder-lower-collar', 445, 473, 17);
  tube('cylinder-lower-pivot-collar', 473, 490, 12);
  tube('cylinder-lower-pivot', 490, 510, 5);
  const is294 = movement.id === 294;
  const model = pivotedEscapement({
    movement,
    name: is294 ? 'movement-294-cylinder-perspective' : 'movement-295-cylinder-action',
    period,
    halfDepth: 0.08,
    dropAcceleration: tune.drop ?? 250,
    wheel: {
      role: 'cylinder-escape-wheel',
      zRange: webZ,
      center: W,
      count,
      direction: -1,
      tooth,
      phase,
      tipRadius: Rt,
      rootRadius: valleyBottom,
      cells: [
        ...toothCells(count, phase, tooth, valleyBottom, 10 * s).map((cell) => ({ points: cell.points, layer: 2 })),
        ...Array.from({ length: count }, (_, i) => ({ points: head(i), layer: 1 })),
        ...Array.from({ length: count }, (_, i) => ({ points: pillar(i), layer: 2 })),
      ],
      // Brown's plan draws the wheel's rim as one arc about 27 px (at this
      // scale) inside the valley bottoms and nothing below it. The rim is a
      // narrow band whose chamfered inner edge is that arc; inside it a
      // plain web, recessed behind the rim, fills the wheel, so the plan
      // shows a blank face below the arc (no arms or windows).
      holes: () => [circlePoints([0, 0], rimInner + rimChamfer, 120)],
    },
    oscillator: {
      name: 'cylinder-A-B-rocker',
      role: 'cylinder-passage-contact-section',
      pivot: cylAxis,
      outline: cSection.map(([x, y]) => [x + cylAxis[0], y + cylAxis[1]]),
      zRange: [-0.001, 0.001],
      amplitude,
      plateTolerance: 0.05,
      clipMargin: 0.1,
      contactPieces: [
        { points: cSection, layer: 1 },
        { points: deepSection, layer: 2 },
      ],
    },
    extras: (root, materials) => {
      // The thin contact outline above is only the solver's section; the
      // visible cylinder is the turned/cut body (one rigid part).
      materials.rocker.children.forEach((child) => { child.visible = false; });
      materials.rocker.add(...cylinder.children.slice());
      // The rim's chamfered inner edge and the plain recessed web inside it.
      const [zb, zf] = webZ;
      materials.wheelRotor.add(tagged(new THREE.Mesh(turnedSmooth([
        [zb, rimInner], [zb, rimInner + rimChamfer], [zf, rimInner + rimChamfer], [zf - rimChamfer, rimInner],
      ], { segments: 180 }), materials.wheel), 'cylinder-wheel-rim-chamfered-inner-edge'));
      materials.wheelRotor.add(tagged(new THREE.Mesh(turnedSmooth([
        [zb, 10 * s], [zb, rimInner], [zb + 0.08, rimInner], [zb + 0.08, 10 * s],
      ], { segments: 180 }), materials.wheel), 'cylinder-wheel-plain-recessed-web'));
      // Wedge heads on their pillars, raised to the passage level.
      for (let i = 0; i < count; i += 1) {
        materials.wheelRotor.add(plateMesh(head(i), [], headZ[0], headZ[1], materials.wheel, 'wedge-pallet-head'));
        materials.wheelRotor.add(plateMesh(pillar(i), [], webZ[1], headZ[0], materials.wheel, 'wedge-pallet-pillar'));
      }
      return [];
    },
    // The arbor passes through the web's bore (radius 10 s) and stands just
    // proud of both faces of the recessed web.
    arbors: [{ center: W, radius: 10 * s, z0: webZ[0] - 0.12, z1: webZ[0] + 0.2, role: 'escape-wheel-arbor' }],
    fit: is294
      ? new THREE.Box3(new THREE.Vector3(-1.1, axisRadius - 1.1, zOf(512)), new THREE.Vector3(1.1, axisRadius + 1.1, zOf(18)))
      : new THREE.Box3(new THREE.Vector3(-4.4, axisRadius - 2.4, webZ[0] - 0.05), new THREE.Vector3(4.4, axisRadius + 1.6, headZ[1] + 0.05)),
    plotView: [-1.8, axisRadius - 1.4, 1.8, axisRadius + 2.2],
    mechanism: 'The balance turns the cylinder A-B back and forth. A wedge pallet of the wheel rests on the outside of the cylinder, slides up the lip A as the opening comes round (impulse), drops inside and rests on the inside wall; on the return swing it slides out over lip B (impulse) and the next pallet drops on the outside.',
  });
  if (!is294) {
    // Brown's plan draws two phases of the one cylinder side by side, about
    // 17 degrees either side of the wheel's top: left, pallet b about to
    // pass lip B; right, pallet c inside the passage. The model has one
    // cylinder; the plan is turned so it stands at his right-hand position
    // (the phase t = 0 shows, a pallet inside), and the view spans his whole
    // drawing, so pallets b and a stand where he draws them to its left.
    const turn = (tune.planTurn ?? -17) * DEG;
    model.root.rotation.z = turn;
    const axis = [-Math.sin(turn) * axisRadius, Math.cos(turn) * axisRadius];
    model.root.userData.cameraFitBounds = new THREE.Box3(
      new THREE.Vector3(axis[0] - 7.9, axis[1] - 3.4, webZ[0] - 0.05),
      new THREE.Vector3(axis[0] + 2.2, axis[1] + 0.8, headZ[1] + 0.05));
    model.root.userData.cameraFov = 12;
  }
  return model;
}

export function createAuthoredPlateEscapementMovement(movement) {
  switch (movement.id) {
    case 288: return recoilAnchor288(movement);
    case 289: return deadbeat289(movement);
    case 290: return annular290(movement);
    case 291: return free291(movement);
    case 292: return stud292(movement);
    case 293: return duplex293(movement);
    case 294:
    case 295: return cylinderEscapement(movement);
    case 296: return lever296(movement);
    default: return null;
  }
}
