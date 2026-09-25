import * as THREE from 'three';
import {circle, poly, plate, polygonClipping} from './finite-plate-geometry.js';
import {smootherstepLaw} from './gab-disengager-shared.js';
import {PALETTE, markShadows, matte} from './primitives.js';

// Brown 186: spring-handle gab-disengaging gear, traced from the 525 px plate.
//
// Topology (front to back): the eccentric rod with its round crown and the
// downward gab; the flat spring handle, its blade riveted (blind) behind the
// rod's tail; the tapered valve rocker on its rockshaft; the cam lever hung on
// pin c (claw, curved arm, forked head with its cross-pin ends, and the drop
// ending in notch a). The lever lies behind the rocker so the claw's hooked
// foot passes behind the rocker arm and crown, as Brown dashes it, and rests
// on the rear of the valve pin. Pulling the spring loop up turns the stiff
// loop with the lever about c while the strap bends just below its riveted
// pad; the tongue at the loop's top pushes the drop up, so the claw's foot
// bears on the pin and raises the rod until the gab clears the pin by 4 px.
// The tongue's end then flexes up into notch a and holds the lever; flexing
// it out again lowers the rod back onto the pin. The claw's
// 71 px reach from c fixes the lever turn (about 29 degrees) needed for the
// 42 px lift. The eccentric stops (rocker at mid-travel, the plate pose)
// while the gab is lifted, since the claw rests on the pin.
// Brown draws no frame, so none is built.

const S = 0.015; // model units per source pixel
const ORIGIN = [270, 250]; // valve (gab) pin centre in the plate
const P = (x, y) => [(x - ORIGIN[0]) * S, (ORIGIN[1] - y) * S];
const toRaster = ([x, y]) => [ORIGIN[0] + x / S, ORIGIN[1] - y / S];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const rot = (a, [x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoother = (v) => smootherstepLaw(clamp01(v)).value;

const PIN_R = 19 * S;
const PIN_C_R = 6 * S;
const RIVET_R = 4.5 * S;
const BORE_GAP = 0.0015;
const CONTACT_GAP = 0.002; // claw foot / pin and strap tip / drop, visually touching
const FOOT_Y_PX = 250 - 19 - CONTACT_GAP / S;
const Z = {
  rocker: [-0.36, -0.06], shaft: [-0.6, 0], lever: [-0.62, -0.4],
  rodBack: [0, 0.2], rodFront: [0.2, 0.28], blade: [-0.042, -0.002],
  strapFront: -0.022, strapBack: -0.51, strapDepth: 0.04, pin: [-0.64, 0.3], pinC: [-0.64, 0.3],
};
const SHAFT = P(260, 62);
const C = P(341, 242); // lever pivot c on the rod
const ROCKER_AMPLITUDE = 0.07; // rad, about 4 degrees each way
const ROD_LENGTH = 16; // model units to the off-plate eccentric strap
const HOLD_LIFT = 42 * S; // rod bottom clears the 38 px pin by 4 px
const STRAP_WIDTH = 14 * S; // Brown's broad double-line strap

// Notch a at the foot of the drop (plate pixels).
const NOTCH = {flatY: 313.5, flatX0: 457, rampX: 470.5, ceilX: 476.5, ceilY: 309.5, lipX: 485.5, lipY: 318};
const TIP_SEAT_PX = 3.9;
const BAR_PX = 150; // length of the diagonal bar below its riveted pad
const ROOT_BEND = 0.2; // share of it that carries the main bend, just below the pad

// Cycle (seconds): run the eccentric three turns, stop, pull, latch, hold,
// release, lower, dwell.
const T = {
  run: 7, ramp: 1, turns: 3, pull: [7.5, 9.5], snap: [9.6, 10.1], unsnap: [12.1, 12.6],
  lower: [12.8, 14.8], period: 15.4,
};

const ringPx = (points, origin = [0, 0]) => points.map(([x, y]) => sub(P(x, y), origin));
const polyPx = (points, origin) => poly(ringPx(points, origin));
const circlePx = (x, y, r, origin = [0, 0], n = 96) => poly(circle(sub(P(x, y), origin), r * S, n));
function smoothPx(points, origin, count = 160) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(...sub(P(x, y), origin), 0)), true, 'centripetal');
  return poly(curve.getSpacedPoints(count).slice(0, -1).map((p) => [p.x, p.y]));
}
function plateMesh(shape, [low, high], material, role) {
  const mesh = new THREE.Mesh(plate(shape, low, high), material);
  mesh.userData.role = role;
  return mesh;
}
function cylinder(radius, [low, high], material, role, segments = 48) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, high - low, segments), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.z = (low + high) / 2;
  mesh.userData.role = role;
  return mesh;
}

// Flat strap of rectangular section swept along a centreline rebuilt each
// frame (after the shared makeFlatStrap, with outward-facing winding so the
// strap reads as a closed solid to containment checks).
function makeFlatStrap(maxPoints, width, depth, material) {
  const faces = 4, perRing = faces * 2;
  const positions = new Float32Array((maxPoints * perRing + 8) * 3);
  const index = [];
  for (let i = 0; i < maxPoints - 1; i++) for (let f = 0; f < faces; f++) {
    const a = i * perRing + f * 2, b = a + 1, c = a + perRing, d = b + perRing;
    index.push(a, b, c, b, d, c);
  }
  const capStart = maxPoints * perRing;
  index.push(capStart, capStart + 2, capStart + 1, capStart, capStart + 3, capStart + 2);
  index.push(capStart + 4, capStart + 5, capStart + 6, capStart + 4, capStart + 6, capStart + 7);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, material);
  const corner = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  mesh.userData.setPoints = (points) => {
    if (points.length !== maxPoints) throw new RangeError('Strap point count changed');
    const rings = points.map((point, i) => {
      const previous = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
      const tx = next.x - previous.x, ty = next.y - previous.y, length = Math.hypot(tx, ty) || 1;
      const nx = -ty / length, ny = tx / length;
      return corner.map(([s, t]) => [point.x + nx * s * width / 2, point.y + ny * s * width / 2, point.z + t * depth / 2]);
    });
    rings.forEach((ring, i) => {
      for (let f = 0; f < faces; f++) for (let k = 0; k < 2; k++) positions.set(ring[(f + k) % 4], (i * perRing + f * 2 + k) * 3);
    });
    [rings[0], rings.at(-1)].forEach((ring, e) => ring.forEach((p, k) => positions.set(p, (capStart + e * 4 + k) * 3)));
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  };
  return mesh;
}

// ---------- motion laws ----------
function eccentricAngle(t) {
  const {run, ramp, turns} = T;
  const total = turns * 2 * Math.PI;
  const speed = total / (run - ramp);
  const rampDistance = (u) => speed * (u / 2 - ramp * Math.sin(Math.PI * u / ramp) / (2 * Math.PI));
  if (t <= 0 || t >= run) return 0;
  if (t < ramp) return rampDistance(t);
  if (t > run - ramp) return total - rampDistance(run - t);
  return speed * (ramp / 2 + t - ramp);
}
function segment(t, [a, b]) { return smoother((t - a) / (b - a)); }

export function springHandleGabDisengager() {
  const root = new THREE.Group();
  const mats = {
    rocker: matte(PALETTE.driven, {roughness: 0.6}),
    rod: matte(PALETTE.driver, {roughness: 0.62}),
    lever: matte(PALETTE.accent, {roughness: 0.55}),
    strap: matte(PALETTE.brass, {roughness: 0.5, metalness: 0.2}),
    pin: matte(0xc9b27a, {roughness: 0.45, metalness: 0.25}),
    shaft: matte(PALETTE.muted, {roughness: 0.6, metalness: 0.2}),
    ink: matte(PALETTE.ink, {roughness: 0.7}),
  };

  // ---------- valve rocker on its rockshaft (local origin at the shaft) ----------
  const rocker = new THREE.Group();
  rocker.name = 'valve-rocker';
  rocker.position.set(...SHAFT, 0);
  const pinLocal = sub([0, 0], SHAFT);
  const rockerOutline = polygonClipping.union(
    circlePx(260, 62, 51, SHAFT),
    polyPx([[211, 70], [309, 70], [302, 218], [300, 244], [240, 244], [234, 212]], SHAFT),
    circlePx(270, 250, 50, SHAFT),
  );
  const valveArm = plateMesh(polygonClipping.difference(rockerOutline,
    poly(circle([0, 0], 29 * S + BORE_GAP, 96)), poly(circle(pinLocal, PIN_R + BORE_GAP, 96))), Z.rocker, mats.rocker, 'valve-rocker-arm');
  const valveShaft = cylinder(29 * S, Z.shaft, mats.shaft, 'rockshaft');
  // Brown hatches the cut rockshaft; the model shows its plain steel end.
  const valvePin = cylinder(PIN_R, Z.pin, mats.pin, 'valve-gab-pin');
  valvePin.position.x = pinLocal[0];
  valvePin.position.y = pinLocal[1];
  rocker.add(valveArm, valveShaft, valvePin);

  // ---------- eccentric rod (local origin at the gab centre) ----------
  const rod = new THREE.Group();
  rod.name = 'eccentric-rod';
  const bar = polygonClipping.union(
    // Brown breaks the rod off at the left (a drawing convention); it runs on
    // whole toward its eccentric, past the view.
    polyPx([[-300, 231], [-300, 269], [353, 269], [353, 231]]),
    circlePx(353, 250, 19),
    polygonClipping.intersection(circlePx(270, 250, 53, [0, 0], 160), polyPx([[200, 180], [340, 180], [340, 250], [200, 250]])),
  );
  const gabSlot = polygonClipping.union(polyPx([[249.5, 250], [290.5, 250], [290.5, 280], [249.5, 280]]), circlePx(270, 250, 20.5));
  const pinCBore = poly(circle(C, PIN_C_R + BORE_GAP, 48));
  const RIVET = P(362, 256);
  const rivetBore = poly(circle(RIVET, RIVET_R + BORE_GAP, 48));
  const groove = polygonClipping.union(polyPx([[56, 242], [142, 242], [146, 249.5], [142, 257], [56, 257]]), circlePx(56, 249.5, 7.5));
  const rodBody = plateMesh(polygonClipping.difference(bar, gabSlot, pinCBore, rivetBore), Z.rodBack, mats.rod, 'eccentric-rod-with-crown-and-gab');
  const rodFace = plateMesh(polygonClipping.difference(bar, gabSlot, pinCBore, groove), Z.rodFront, mats.rod, 'eccentric-rod-grooved-face');
  const pinC = cylinder(PIN_C_R, Z.pinC, mats.ink, 'lever-pivot-pin-c', 24);
  pinC.position.x = C[0]; pinC.position.y = C[1];
  // Spring handle blade: riveted to the back of the rod's tail (blind rivet).
  // Blade end, 12 px across the strap; the strap proper starts 0.15 px on.
  const J1 = [372.89 - 0.125, 260.18 - 0.083], J2 = [365.12 - 0.125, 271.82 - 0.083];
  const blade = plateMesh(polygonClipping.difference(
    polyPx([[350, 247], [366, 240], J1, J2, [352, 266]]), rivetBore), Z.blade, mats.strap, 'spring-handle-riveted-blade');
  const rivet = cylinder(RIVET_R, [Z.blade[0], 0.18], mats.ink, 'spring-handle-rivet', 24);
  rivet.position.x = RIVET[0]; rivet.position.y = RIVET[1];
  const rivetHead = cylinder(7 * S, [-0.066, Z.blade[0]], mats.ink, 'spring-handle-rivet-head', 24);
  rivetHead.position.x = RIVET[0]; rivetHead.position.y = RIVET[1];
  rod.add(rodBody, rodFace, pinC, blade, rivet, rivetHead);

  // ---------- cam lever (local origin at pin c) ----------
  const lever = new THREE.Group();
  lever.name = 'cam-lever';
  const leftNub = [[459, 221], [465, 196], [477, 198], [472, 223]];
  const rightNub = [[493, 201], [506, 208], [501, 235], [489, 231]];
  const leverOutline = polygonClipping.union(
    circlePx(341, 242, 17, C),
    // Claw: rises from c to its knuckle and hooks down behind the crown.
    smoothPx([[250, 222], [251, 200], [256, 184], [263, 168], [272, 155], [283, 146], [295, 145], [306, 150], [320, 164],
      [334, 185], [346, 209], [354, 230], [356, 246], [340, 258], [326, 248], [316, 228], [306, 208], [298, 196],
      [292, 198], [288, 210], [286, 222]], C),
    polyPx([[245, FOOT_Y_PX], [285, FOOT_Y_PX], [286.5, 215], [250, 212], [246, 222]], C),
    // Curved arm to the forked head.
    smoothPx([[346, 234], [362, 241], [380, 250], [410, 254], [440, 248], [460, 236], [470, 224], [475, 208], [480, 200],
      [486, 204], [484, 212], [476, 226], [464, 240], [450, 254], [430, 264], [400, 269], [370, 270], [344, 266]], C),
    // Fork head and the drop ending in notch a.
    polyPx([[470, 222], [478, 198], [493, 200], [490, 225], [490, 240], [491, 265], [491, 290], [494, 306], [497, NOTCH.lipY],
      [NOTCH.lipX, NOTCH.lipY], [NOTCH.lipX, NOTCH.ceilY], [NOTCH.ceilX, NOTCH.ceilY], [NOTCH.rampX, NOTCH.flatY],
      [NOTCH.flatX0, NOTCH.flatY], [459, 308], [466, 301], [474, 292], [477, 278], [477, 255], [475, 235]], C),
  );
  const nubShape = polygonClipping.union(polyPx(leftNub, C), polyPx(rightNub, C));
  const leverBody = plateMesh(polygonClipping.difference(leverOutline, nubShape, poly(circle([0, 0], PIN_C_R + BORE_GAP, 48))),
    Z.lever, mats.lever, 'cam-lever-claw-arm-and-notched-drop');
  const leverNubs = plateMesh(nubShape, [Z.lever[0] + 0.01, Z.lever[1] + 0.03], mats.lever, 'fork-cross-pin-ends');
  lever.add(leverBody, leverNubs);

  // ---------- spring handle strap (deformable, in rod coordinates) ----------
  const J = [369, 266]; // the strap leaves its riveted pad just below and right of c
  const tipY = NOTCH.flatY + STRAP_WIDTH / 2 / S + CONTACT_GAP / S;
  const restPx = [J, [390, 280], [404, 294], [414, 313], [422.3, 335], [437, 382], [452, 432], [462, 465], [460, 486], [449, 493], [434, 487], [418, 466],
    [404, 428], [394, 388], [391, 360], [397, 343], [410, 333], [428, 326.5], [445, 322.4], [456, tipY + 0.15],
    [466, tipY], [476, tipY]];
  const STRAP_POINTS = 121;
  const restCurve = new THREE.CatmullRomCurve3(restPx.map((p) => new THREE.Vector3(...P(...p), 0)), false, 'centripetal');
  const restPoints = restCurve.getSpacedPoints(STRAP_POINTS - 1).map((p) => [p.x, p.y]);
  // Straighten the tongue that bears on the drop's flat face.
  const flatStart = P(456, 0)[0];
  for (const p of restPoints) if (p[0] >= flatStart && p[1] > P(0, 330)[1]) p[1] = P(0, tipY)[1];
  const cumulative = [0];
  for (let i = 1; i < restPoints.length; i++) cumulative.push(cumulative[i - 1] + Math.hypot(...sub(restPoints[i], restPoints[i - 1])));
  const strapLength = cumulative.at(-1);
  const arcAt = (px) => cumulative[restPoints.reduce((best, p, i) => (Math.hypot(...sub(p, P(...px))) < Math.hypot(...sub(restPoints[best], P(...px))) ? i : best), 0)];
  // The diagonal bar flexes over BAR_PX below the blade; the loop beyond is rigid.
  const bendIndex = cumulative.findIndex((s) => s >= BAR_PX * S);
  const bendLength = cumulative[bendIndex];
  const restAngle = restPoints.map((p, i) => {
    const a = restPoints[Math.max(0, i - 1)], b = restPoints[Math.min(restPoints.length - 1, i + 1)];
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  });
  const restAngleAt = (s) => {
    const i = Math.min(bendIndex - 1, Math.max(0, cumulative.findIndex((c) => c > s) - 1));
    const f = clamp01((s - cumulative[i]) / (cumulative[i + 1] - cumulative[i]));
    return THREE.MathUtils.lerp(restAngle[i], restAngle[i + 1], f);
  };
  const sLegLow = arcAt([418, 466]), sLegHigh = arcAt([394, 388]);
  const strapWeights = cumulative.map((s) => ({
    seat: smoother((s - (strapLength - 6 * S)) / (5 * S)),
    z: THREE.MathUtils.lerp(Z.strapFront, Z.strapBack, smoother((s - sLegLow) / (sLegHigh - sLegLow))),
  }));
  const strap = makeFlatStrap(STRAP_POINTS, STRAP_WIDTH, Z.strapDepth, mats.strap);
  strap.userData.role = 'spring-handle-strap-and-loop';
  strap.name = 'spring-handle-strap';

  rod.add(strap); // strap geometry is kept in rod coordinates
  root.add(rocker, rod, lever);

  // ---------- kinematics ----------
  const footLocalY = P(0, FOOT_Y_PX)[1] - C[1];
  const footX = [P(245, 0)[0] - C[0], P(285, 0)[0] - C[0]];
  const pinInLever = (theta, lift) => {
    const beta = Math.asin(lift / ROD_LENGTH);
    return rot(-theta, sub(rot(-beta, [0, -lift]), C));
  };
  const footClearance = (theta, lift) => footLocalY - pinInLever(theta, lift)[1] - PIN_R;
  const liftForAngle = (theta) => {
    if (theta <= 0 || footClearance(theta, 0) >= CONTACT_GAP - 1e-12) return 0;
    let lo = 0, hi = 1.5;
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2;
      if (footClearance(theta, mid) < CONTACT_GAP) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };
  let thetaHold;
  {
    let lo = 0, hi = 1.2;
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2;
      if (liftForAngle(mid) < HOLD_LIFT) lo = mid; else hi = mid;
    }
    thetaHold = (lo + hi) / 2;
  }

  function stateAtTime(time) {
    const t = THREE.MathUtils.euclideanModulo(time, T.period);
    const alpha = eccentricAngle(t);
    const rockerAngle = ROCKER_AMPLITUDE * Math.sin(alpha);
    const pull = segment(t, T.pull), lower = segment(t, T.lower);
    const seated = segment(t, T.snap) * (1 - segment(t, T.unsnap));
    const theta = thetaHold * pull * (1 - lower);
    // Local upward deflection (px) of the tongue's end into notch a.
    const tipOffsetPx = [0, TIP_SEAT_PX * seated];
    const lift = liftForAngle(theta);
    const beta = Math.asin(lift / ROD_LENGTH);
    const pin = add(SHAFT, rot(rockerAngle, pinLocal));
    const gab = add(pin, [0, lift]);
    let stage = 'engaged-running';
    if (t >= T.run) stage = 'engaged-stopped';
    if (t >= T.pull[0]) stage = 'pulling-handle-lifting-rod';
    if (t >= T.snap[0]) stage = 'spring-end-snapping-into-notch-a';
    if (t >= T.snap[1]) stage = 'latched-disengaged';
    if (t >= T.unsnap[0]) stage = 'releasing-spring-end-from-notch-a';
    if (t >= T.lower[0]) stage = 'lowering-rod-onto-pin';
    if (t >= T.lower[1]) stage = 'engaged-stopped';
    const gabBottomClearance = lift - 2 * PIN_R; // rod lower edge above pin top
    return {
      time: t, stage, eccentricAngle: alpha, rockerAngle, leverAngle: theta, lift, rodAngle: beta,
      tipOffsetPx, pin, gab, pivotC: add(gab, rot(beta, C)),
      gabCaptured: lift < PIN_R, gabClear: gabBottomClearance > 0, gabBottomClearance,
      footClearance: footClearance(theta, lift), footContactX: pinInLever(theta, lift)[0],
      latched: seated > 1 - 1e-9,
    };
  }

  // Diagonal bar: an inextensible spring strip clamped at the riveted pad.
  // Its tangent angle is rest + theta * smootherstep over the first
  // ROOT_BEND of its length (the short bend just below the pad) + a gentle
  // A * bump + B * odd bump (C2 at both ends), (A, B) solved so it ends
  // exactly on the loop. The loop (bottom, legs, top strip, tongue) is rigid
  // in the lever frame: it turns with the lever about c, and its tongue only
  // slides a few px along the drop's flat, to where the bar needs just a
  // symmetric bow. The last 6 px of tongue deflect up into notch a to latch.
  const BEND_STEPS = 128;
  const bumpA = (u) => 64 * u ** 3 * (1 - u) ** 3;
  const bumpB = (u) => 256 * u ** 3 * (1 - u) ** 3 * (1 - 2 * u);
  const bendLine = (theta, A, B) => {
    const line = [P(...J)];
    for (let n = 0; n < BEND_STEPS; n++) {
      const u = (n + 0.5) / BEND_STEPS, x = line[n];
      const a = restAngleAt(u * bendLength) + theta * smoother(u / ROOT_BEND) + A * bumpA(u) + B * bumpB(u);
      line.push([x[0] + bendLength / BEND_STEPS * Math.cos(a), x[1] + bendLength / BEND_STEPS * Math.sin(a)]);
    }
    return {line};
  };
  const restEnd = bendLine(0, 0, 0).line.at(-1);
  const restEndError = sub(restEnd, restPoints[bendIndex]);
  const pb = restPoints[bendIndex];
  const loopPoint = (theta, sx, seatY, i) => add(C, rot(theta, add(sub(restPoints[i], C), [sx, seatY * strapWeights[i].seat])));
  const endMiss = (theta, A, B, sx) => sub(sub(bendLine(theta, A, B).line.at(-1), restEndError), loopPoint(theta, sx, 0, bendIndex));
  const newton2 = (f, guess) => {
    let [a, b] = guess;
    for (let it = 0; it < 60; it++) {
      const r = f(a, b);
      if (Math.hypot(...r) < 1e-12) break;
      const e = 1e-7, ra = f(a + e, b), rb = f(a, b + e);
      const j = [[(ra[0] - r[0]) / e, (rb[0] - r[0]) / e], [(ra[1] - r[1]) / e, (rb[1] - r[1]) / e]];
      const det = j[0][0] * j[1][1] - j[0][1] * j[1][0];
      const da = (j[1][1] * r[0] - j[0][1] * r[1]) / det, db = (-j[1][0] * r[0] + j[0][0] * r[1]) / det;
      const scale = Math.min(1, 0.1 / Math.max(Math.abs(da), Math.abs(db)));
      a -= da * scale; b -= db * scale;
    }
    return [a, b];
  };
  // The tongue slides to where the bar needs only its symmetric bow (B = 0).
  // Continuation in lever angle from the last solution keeps the same branch.
  let solved = {theta: 0, guess: [0, 0]};
  const solveBar = (theta) => {
    if (theta === 0) { solved = {theta: 0, guess: [0, 0]}; return [0, 0, 0]; }
    const steps = Math.max(1, Math.ceil(Math.abs(theta - solved.theta) / 0.05));
    let guess = solved.guess;
    for (let k = 1; k <= steps; k++) {
      const th = solved.theta + (theta - solved.theta) * k / steps;
      guess = newton2((A, sx) => endMiss(th, A, 0, sx), guess);
    }
    solved = {theta, guess};
    return [guess[0], 0, guess[1]];
  };
  const strapShape = (state) => {
    const theta = state.leverAngle, seatY = state.tipOffsetPx[1] * S;
    const [A, B, sx] = solveBar(theta);
    return {theta, sx, seatY, A, B, slidePx: sx / S};
  };
  const strapPointsInRod = (state) => {
    const shape = strapShape(state);
    const {line} = bendLine(shape.theta, shape.A, shape.B);
    return restPoints.map((p, i) => {
      if (i >= bendIndex) return [...loopPoint(shape.theta, shape.sx, shape.seatY, i), strapWeights[i].z];
      const f = cumulative[i] / bendLength * BEND_STEPS, n = Math.min(BEND_STEPS - 1, Math.floor(f)), w = f - n;
      const q = [THREE.MathUtils.lerp(line[n][0], line[n + 1][0], w), THREE.MathUtils.lerp(line[n][1], line[n + 1][1], w)];
      const e = restEndError.map((v) => v * cumulative[i] / bendLength);
      return [...sub(q, e), strapWeights[i].z];
    });
  };
  const toWorld = (state, [x, y, z]) => new THREE.Vector3(...add(state.gab, rot(state.rodAngle, [x, y])), z);
  const strapPointsWorld = (state) => strapPointsInRod(state).map((p) => toWorld(state, p));

  function update(time) {
    const state = stateAtTime(time);
    rocker.rotation.z = state.rockerAngle;
    rod.position.set(...state.gab, 0);
    rod.rotation.z = state.rodAngle;
    lever.position.set(...state.pivotC, 0);
    lever.rotation.z = state.rodAngle + state.leverAngle;
    strap.userData.setPoints(strapPointsInRod(state).map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    root.userData.kinematics = state;
    return state;
  }

  // Framing: the plate plus the handle's full swing.
  const fitBounds = new THREE.Box3();
  for (let i = 0; i <= 48; i++) {
    update(T.period * i / 48);
    root.updateMatrixWorld(true);
    fitBounds.expandByObject(root, true);
  }
  fitBounds.expandByScalar(0.08);
  // Frame Brown's plate: the complete rod counts only as far as his break.
  fitBounds.min.x = Math.max(fitBounds.min.x, P(23, 0)[0] - 0.08);

  Object.assign(root.userData, {
    fidelity: 'authored',
    mechanism: 'strap-spring-handle-turns-rod-hung-claw-lever-onto-valve-pin-lifting-gab-and-latches-in-notch-a',
    archetype: 'spring-handle-cam-lifted-eccentric-rod-gab-pin-notch-latch',
    hideGround: true,
    animationTiming: {authoredCyclePeriod: T.period},
    minimumDisplayCycleSeconds: T.period,
    cameraFitBounds: fitBounds,
    cameraDistanceScale: 1,
    stateAtTime,
    strapPointsWorld,
    strapShape,
    liftForAngle,
    sourcePointFromRaster: (x, y) => new THREE.Vector2(...P(x, y)),
    sourceRasterFromPoint: (x, y) => new THREE.Vector2(...toRaster([x, y])),
    geometry: {
      cyclePeriod: T.period, timeline: T, sourceUnitsPerPixel: S, sourceOrigin: ORIGIN, pinRadius: PIN_R,
      pivotCRadius: PIN_C_R, rivetRadius: RIVET_R, contactGap: CONTACT_GAP, rockerAmplitude: ROCKER_AMPLITUDE,
      rodLength: ROD_LENGTH, holdLift: HOLD_LIFT, thetaHold, shaft: SHAFT, pivotC: C,
      rivet: RIVET, footLocalY, footX, notch: NOTCH, tipRestY: tipY, strapWidth: STRAP_WIDTH, strapDepth: Z.strapDepth,
      strapJunction: P(...J), strapLength, barBendIndex: bendIndex, barLength: bendLength, rootBend: ROOT_BEND, layers: Z,
      strapRestPoints: restPoints.map((p) => [...p]),
    },
    blocks: {
      valveRocker: rocker, valveArm, valveShaft, valveShaftFace: valveArm, valvePin,
      eccentricRod: rod, rodBody, rodFace, pinC, blade, rivet, rivetHead,
      camLever: lever, leverBody, leverNubs, springStrap: strap,
    },
    jointChecks: [
      [valveArm, valveShaft], [valveArm, valvePin], [rodBody, valvePin], [rodFace, valvePin],
      [rodBody, pinC], [rodFace, pinC], [leverBody, pinC], [rodBody, rivet], [blade, rivet],
    ],
    rigidBodies: [rocker, rod, lever, strap],
  });

  update(0);
  markShadows(root);
  return {root, update, cameraDirection: new THREE.Vector3(0.03, 0.02, 1)};
}
