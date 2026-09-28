import * as THREE from 'three';
import { finishHookFamily } from './lifting-check-hook-parts.js';
import { circle, plate, poly, polygonClipping, capsule } from './finite-plate-geometry.js';
import {
  PALETTE,
  makeDynamicCable,
  markShadows,
  matte,
} from './primitives.js';

// Movement 251 is modelled in plate pixels (x from the jaw-pivot midline,
// y up from the jaw pivots in Brown's drawn pose) and scaled by S.
const S = 0.05;
const PIVOT_X = 29.75;

// Right jaw outline about its own pivot, traced from Brown's right hook A
// (classical contour of the ink) and made symmetric: a crescent horn with a
// round end, a pivot boss, a straight shank and an inward foot. The foot
// top carries a 35-degree barb matching the undercut T head, so the load
// presses the jaws shut (see LOAD_ANGLE). Counter-clockwise, pixels, y up.
const JAW_OUTLINE = [[3.02, 140.94], [3.36, 142.36], [4.09, 143.62], [5.16, 144.62], [6.48, 145.26], [7.92, 145.5], [9.37, 145.31], [10.7, 144.71], [11.8, 143.74], [12.58, 142.5], [12.96, 141.09], [15.9, 140.4], [19.77, 139.12], [23.79, 137.6], [27.59, 135.56], [31.17, 133.13], [34.55, 130.43], [37.74, 127.52], [40.75, 124.42], [43.58, 121.14], [46.24, 117.72], [48.68, 114.14], [50.82, 110.39], [52.59, 106.48], [54.06, 102.43], [55.4, 98.31], [56.73, 94.17], [57.94, 90.02], [58.87, 85.82], [59.36, 81.57], [59.45, 77.26], [59.24, 72.92], [58.86, 68.58], [58.33, 64.27], [57.57, 60.02], [56.46, 55.87], [54.93, 51.86], [53.04, 47.97], [50.84, 44.22], [48.41, 40.6], [45.82, 37.11], [43.12, 33.73], [40.34, 30.45], [37.47, 27.24], [34.53, 24.09], [31.53, 20.99], [28.48, 17.93], [25.39, 14.91], [22.27, 11.92], [19.14, 8.95], [16, 6], [12.53, 5.02], [12.93, 3.88], [13.23, 2.7], [13.42, 1.5], [13.5, 0.29], [13.47, -0.92], [13.33, -2.13], [13.09, -3.32], [12.73, -4.48], [12.28, -5.61], [11.73, -6.69], [11.08, -7.71], [10.34, -8.68], [3, -14], [3, -44.5], [2.82, -46.06], [2.31, -47.54], [1.47, -48.86], [0.36, -49.97], [-0.96, -50.81], [-2.44, -51.32], [-4, -51.5], [-15.25, -51.5], [-22.75, -44], [-22.75, -34.2], [-18.75, -37], [-10.5, -37], [-10.5, -13], [-13.5, -5], [-12.5, 6.5], [-9.79, 10.03], [-6.73, 13.16], [-3.39, 15.98], [0.14, 18.57], [3.79, 21.02], [7.49, 23.42], [11.16, 25.85], [14.76, 28.36], [18.22, 31.04], [21.48, 33.96], [24.49, 37.15], [27.26, 40.57], [29.78, 44.16], [32.08, 47.88], [34.23, 51.7], [36.29, 55.59], [38.29, 59.54], [40.08, 63.56], [41.43, 67.71], [42.18, 71.99], [42.46, 76.39], [42.5, 80.82], [42.39, 85.24], [41.96, 89.59], [41.01, 93.85], [39.48, 97.96], [37.54, 101.93], [35.32, 105.73], [32.9, 109.39], [30.31, 112.93], [27.6, 116.38], [24.78, 119.74], [21.81, 122.96], [18.6, 125.96], [15.06, 128.66], [11.29, 131.13], [7.67, 133.68], [4.6, 136.69], [2.5, 140.5]];

// T head on W (pixels in the gripped frame; W hangs with this frame on the
// jaw frame). Brown: bar 253..281 x 240..251, stem 259..271 down to W at 284.
const T_STEM = 6;
const T_BAR = 11;
const T_TOP = -26;
const T_BOTTOM = -37;
const T_CHAMFER = 3;
const LOAD_ANGLE = 35 * Math.PI / 180;
const T_UNDERCUT_Y = T_BOTTOM + (T_BAR - T_STEM) * Math.tan(LOAD_ANGLE);
const W_TOP = -70;
const W_BOTTOM = -264;
const W_HALF = 78.5;
const RIB_INNER = 79;
const POST_INNER = 92;
const POST_OUTER = 119;
// Slot B in the top beam (Brown: y 11..41 → 203..173; half-widths 38 at the
// top, 49 at the mouth). Its rounded lower lips press the horns inward.
const BEAM_BOTTOM = 173;
const BEAM_TOP = 203;
const BEAM_HALF = 129;
const SLOT_TOP_HALF = 38;
const SLOT_MOUTH_HALF = 50;
const SLOT_LIP_RADIUS = 3;
// Monkey (rope block) stop lugs: the claw shanks seat on them when closed.
const STOP_HALF = 19.15;
const BLOCK_BOTTOM = -18;

const rotate = ([x, y], angle) => {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [x * c - y * s, x * s + y * c];
};

function smootherStep01(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return u ** 3 * (u * (u * 6 - 15) + 10);
}

function ramp(time, start, end, from, to) {
  return from + (to - from) * smootherStep01((time - start) / (end - start));
}

function densify(points, spacing, closed = true) {
  const result = [];
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i += 1) {
    const a = points[i], b = points[(i + 1) % points.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / spacing));
    for (let k = 0; k < steps; k += 1) result.push([a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps]);
  }
  return result;
}

function insideConvex(point, convex, eps = 1e-9) {
  for (let i = 0; i < convex.length; i += 1) {
    const a = convex[i], b = convex[(i + 1) % convex.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const cross = (ex * (point[1] - a[1]) - ey * (point[0] - a[0])) / Math.hypot(ex, ey);
    if (cross <= eps) return false;
  }
  return true;
}

function insidePolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > point[1]) !== (yj > point[1])
      && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Distance from a point to a polygon boundary (for reported clearances).
function boundaryDistance(point, polygon) {
  let best = Infinity;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const t = THREE.MathUtils.clamp(((point[0] - a[0]) * ex + (point[1] - a[1]) * ey) / (ex * ex + ey * ey), 0, 1);
    best = Math.min(best, Math.hypot(point[0] - a[0] - t * ex, point[1] - a[1] - t * ey));
  }
  return best;
}

const mirror = (points) => points.map(([x, y]) => [-x, y]).reverse();
const shift = (points, dx, dy) => points.map(([x, y]) => [x + dx, y + dy]);
const scaled = (points) => points.map(([x, y]) => [x * S, y * S]);

// Right cheek of slot B (convex, counter-clockwise), with a filleted lip.
function rightCheekOutline() {
  const d = [SLOT_TOP_HALF - SLOT_MOUTH_HALF, BEAM_TOP - BEAM_BOTTOM];
  const length = Math.hypot(...d);
  const normal = [d[1] / length, -d[0] / length];
  const r = SLOT_LIP_RADIUS;
  const center = [SLOT_MOUTH_HALF + r * (1 - normal[1]) / normal[0], BEAM_BOTTOM + r];
  const t2 = [center[0] - r * normal[0], center[1] - r * normal[1]];
  const a2 = Math.atan2(t2[1] - center[1], t2[0] - center[0]);
  const a1 = -Math.PI / 2;
  const arc = [];
  for (let i = 0; i <= 12; i += 1) {
    const angle = a2 + (a1 - a2) * i / 12;
    arc.push([center[0] + r * Math.cos(angle), center[1] + r * Math.sin(angle)]);
  }
  return [...arc.slice(-1), [BEAM_HALF, BEAM_BOTTOM], [BEAM_HALF, BEAM_TOP], [SLOT_TOP_HALF, BEAM_TOP], ...arc.slice(0, -1)];
}

function teePieces() {
  const rightWing = [[T_STEM, T_UNDERCUT_Y], [T_BAR, T_BOTTOM], [T_BAR, T_TOP - T_CHAMFER], [T_BAR - T_CHAMFER, T_TOP], [T_STEM, T_TOP]];
  const middle = [[-T_STEM, W_TOP], [T_STEM, W_TOP], [T_STEM, T_TOP], [-T_STEM, T_TOP]];
  return { rightWing, leftWing: mirror(rightWing), middle };
}

function teeOutline() {
  return [[-T_STEM, W_TOP], [T_STEM, W_TOP], [T_STEM, T_UNDERCUT_Y], [T_BAR, T_BOTTOM], [T_BAR, T_TOP - T_CHAMFER], [T_BAR - T_CHAMFER, T_TOP],
    [-T_BAR + T_CHAMFER, T_TOP], [-T_BAR, T_TOP - T_CHAMFER], [-T_BAR, T_BOTTOM], [-T_STEM, T_UNDERCUT_Y]];
}

// Planar contact geometry shared by the motion law, userData and the tests.
function createPlanarContacts() {
  const dense = densify(JAW_OUTLINE, 0.3);
  const hornSamples = dense.filter(([, y]) => y > 95);
  const footSamples = dense.filter(([, y]) => y < -20);
  const cheek = rightCheekOutline();
  const tee = teePieces();
  const jawAt = (phi, samples = JAW_OUTLINE) => samples.map((p) => {
    const q = rotate(p, phi);
    return [q[0] + PIVOT_X, q[1]];
  });
  // Overlap tests run in the jaw's own frame: the few convex vertices are
  // moved instead of the densely sampled jaw boundary.
  const jawBox = [Math.min(...JAW_OUTLINE.map((p) => p[0])), Math.max(...JAW_OUTLINE.map((p) => p[0])),
    Math.min(...JAW_OUTLINE.map((p) => p[1])), Math.max(...JAW_OUTLINE.map((p) => p[1]))];
  // Closed sub-outlines for point-in-polygon tests: a horizontal ray from a
  // point above y 90 (or below -20) only crosses edges of that band.
  const band = (keep) => JAW_OUTLINE.filter((p, i) => keep(p) || keep(JAW_OUTLINE[(i + 1) % JAW_OUTLINE.length])
    || keep(JAW_OUTLINE[(i + JAW_OUTLINE.length - 1) % JAW_OUTLINE.length]));
  const hornOutline = band(([, y]) => y > 88);
  const footOutline = band(([, y]) => y < -18);
  const toJaw = (points, phi, dy) => points.map(([x, y]) => rotate([x - PIVOT_X, y + dy], -phi));
  const overlapsLocal = (samples, convex) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of convex) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (const p of samples) {
      if (p[0] <= x0 || p[0] >= x1 || p[1] <= y0 || p[1] >= y1) continue;
      if (insideConvex(p, convex)) return true;
    }
    return convex.some((v) => v[0] > jawBox[0] && v[0] < jawBox[1] && v[1] > jawBox[2] && v[1] < jawBox[3]
      && insidePolygon(v, v[1] > 90 ? hornOutline : v[1] < -20 ? footOutline : JAW_OUTLINE));
  };
  // Right jaw vs right cheek of slot B with the rope block at height h.
  const hornOverlaps = (h, phi) => overlapsLocal(hornSamples, toJaw(cheek, phi, -h));
  // Right jaw foot vs the T head raised r above its gripped position.
  const footOverlaps = (r, phi) => overlapsLocal(footSamples, toJaw(tee.rightWing, phi, r))
    || overlapsLocal(footSamples, toJaw(tee.middle, phi, r));
  const footInnerX = (phi) => Math.min(...jawAt(phi, footSamples).map(([x]) => x));
  return { cheek, footInnerX, footOverlaps, hornOverlaps, jawAt, tee };
}

function tabulate(from, to, step, fn) {
  const values = [];
  const count = Math.round((to - from) / step);
  for (let i = 0; i <= count; i += 1) values.push(fn(from + step * i, i, values));
  return {
    from, step, values,
    at(x) {
      const f = (x - from) / step;
      if (f <= 0) return values[0];
      if (f >= values.length - 1) return values.at(-1);
      const i = Math.floor(f), t = f - i;
      return values[i] + (values[i + 1] - values[i]) * t;
    },
  };
}

function pileDriverReleasingHooks(movement) {
  const root = new THREE.Group();
  const renderScale = 0.6;
  root.scale.setScalar(renderScale);
  const contacts = createPlanarContacts();

  // ---------------------------------------------------------------- laws --
  // Opening angle forced by slot B (quasi-static: the jaws' weight keeps
  // the horns on the lips; minimal non-penetrating angle at each height).
  const slotStart = 20;
  const slotAngle = (h) => {
    if (h <= slotStart || !contacts.hornOverlaps(h, 0)) return 0;
    let low = 0, high = 0.4;
    for (let k = 0; k < 40; k += 1) {
      const mid = (low + high) / 2;
      if (contacts.hornOverlaps(h, mid)) low = mid; else high = mid;
    }
    return high;
  };
  // Feet leave the T head once their inner tips pass its bar ends.
  let lo = 0, hi = 0.4;
  for (let k = 0; k < 50; k += 1) {
    const mid = (lo + hi) / 2;
    if (contacts.footInnerX(mid) >= T_BAR) hi = mid; else lo = mid;
  }
  const freeAngle = hi;
  const openAngle = freeAngle + 0.022;
  // Height of the T above its gripped seat while the barbs slide out.
  const supportAt = (phi) => {
    let low = -4, high = 8;
    if (!contacts.footOverlaps(low, phi)) return null;
    for (let k = 0; k < 44; k += 1) {
      const mid = (low + high) / 2;
      if (contacts.footOverlaps(mid, phi)) low = mid; else high = mid;
    }
    return high;
  };
  // Solved directly (not interpolated) so the seat never dips into the barbs.
  const support = (phi) => supportAt(Math.min(Math.max(phi, 0), freeAngle - 1e-9)) ?? 0;
  const heightWhere = (test) => {
    let low = slotStart, high = 60;
    for (let k = 0; k < 44; k += 1) {
      const mid = (low + high) / 2;
      if (test(mid)) high = mid; else low = mid;
    }
    return high;
  };
  const topHeight = heightWhere((h) => slotAngle(h) >= openAngle);
  const engageHeight = heightWhere((h) => slotAngle(h) > 0);

  // Re-catch: descending onto the resting T, the feet ride its chamfered
  // top, cam open, slide down the bar ends and fall shut beneath the bar.
  const catchHeight = -50;
  const catchLowOvertravel = 2;
  const lowHeight = catchHeight - catchLowOvertravel;
  let snapRelative = null, snapAngle = 0;
  const camTable = tabulate(-24, catchLowOvertravel, 0.05, (r, i, previous) => {
    let phi = previous.at(-1) ?? 0;
    if (snapRelative !== null) return snapAngle;
    if (contacts.footOverlaps(r, phi)) {
      let a = phi, b = phi + 0.02;
      while (contacts.footOverlaps(r, b)) { a = b; b += 0.02; }
      for (let k = 0; k < 34; k += 1) {
        const mid = (a + b) / 2;
        if (contacts.footOverlaps(r, mid)) a = mid; else b = mid;
      }
      return b;
    }
    if (phi > 0) {
      // Gravity closes the jaw only through continuously clear angles; if it
      // can close fully here the tip has cleared the bar corner.
      let next = phi;
      while (next > 0 && !contacts.footOverlaps(r, Math.max(0, next - 0.001))) next = Math.max(0, next - 0.001);
      if (next === 0 && phi > 0.02) { snapRelative = r; snapAngle = phi; return phi; }
      phi = next;
    }
    return phi;
  });

  // The tabulated angle is refined so interpolation never leaves a foot
  // inside the T head.
  const camAngle = (r) => {
    const tabulated = camTable.at(r);
    if (!contacts.footOverlaps(r, tabulated)) return tabulated;
    let low = tabulated, high = tabulated + 0.02;
    for (let k = 0; k < 40; k += 1) {
      const mid = (low + high) / 2;
      if (contacts.footOverlaps(r, mid)) low = mid; else high = mid;
    }
    return high;
  };

  // Timeline (canonical seconds). The rope block rises with W gripped,
  // slot B opens the jaws, W falls, the block descends and re-grips.
  const period = 10;
  const riseEnd = 3.8;
  const descentStart = 5;
  const descentEnd = 8.6;
  const swingEnd = 8.95;
  const takeUpStart = 9.3;
  const gravity = 280; // px/s², a readable demonstration scale
  const blockHeight = (u) => {
    if (u < riseEnd) return ramp(u, 0, riseEnd, catchHeight, topHeight);
    if (u < descentStart) return topHeight;
    if (u < descentEnd) return ramp(u, descentStart, descentEnd, topHeight, lowHeight);
    if (u < takeUpStart) return lowHeight;
    return ramp(u, takeUpStart, period, lowHeight, catchHeight);
  };
  const riseAngle = (u) => slotAngle(blockHeight(u));
  lo = 0; hi = riseEnd;
  for (let k = 0; k < 60; k += 1) {
    const mid = (lo + hi) / 2;
    if (riseAngle(mid) >= freeAngle) hi = mid; else lo = mid;
  }
  const releaseTime = hi;
  const grippedY = (u) => blockHeight(u) + support(riseAngle(u));
  const releaseY = grippedY(releaseTime);
  const releaseVelocity = (grippedY(releaseTime) - grippedY(releaseTime - 1e-4)) / 1e-4;
  const restY = catchHeight;
  const fallDuration = (releaseVelocity + Math.sqrt(releaseVelocity ** 2 + 2 * gravity * (releaseY - restY))) / gravity;
  const impactTime = releaseTime + fallDuration;
  lo = 0; hi = riseEnd;
  for (let k = 0; k < 60; k += 1) {
    const mid = (lo + hi) / 2;
    if (blockHeight(mid) >= 0) hi = mid; else lo = mid;
  }
  const displayTimeOffset = hi; // t = 0 shows Brown's pose

  const stateAtTime = (time) => {
    let u = ((time % period) + period) % period;
    if (Math.abs(u - period) < 1e-9) u = 0;
    const h = blockHeight(u);
    let stage, phi, teeY, velocity = 0;
    if (u < releaseTime) {
      stage = slotAngle(h) > 0 ? 'slot-b-squeezing-horns-open-jaws' : 'hoisting-gripped-weight';
      phi = slotAngle(h);
      teeY = h + support(phi);
      velocity = (grippedY(Math.min(u + 1e-4, releaseTime)) - grippedY(Math.max(0, u - 1e-4))) / 2e-4;
    } else if (u < impactTime) {
      stage = 'released-weight-falling';
      const tau = u - releaseTime;
      phi = slotAngle(h);
      teeY = releaseY + releaseVelocity * tau - gravity * tau * tau / 2;
      velocity = releaseVelocity - gravity * tau;
    } else if (u < descentStart) {
      stage = 'weight-on-pile-jaws-held-open';
      phi = slotAngle(h);
      teeY = restY;
    } else if (u < descentEnd) {
      stage = 'rope-block-descending-jaws-cam-over-t-head';
      phi = Math.max(slotAngle(h), camAngle(restY - h));
      teeY = restY;
    } else if (u < swingEnd) {
      stage = 'jaws-falling-shut-under-t-head';
      phi = snapAngle * (1 - smootherStep01((u - descentEnd) / (swingEnd - descentEnd)));
      teeY = restY;
    } else if (u < takeUpStart) {
      stage = 'jaws-closed-under-t-head';
      phi = 0;
      teeY = restY;
    } else {
      stage = 'taking-up-to-grip';
      phi = 0;
      teeY = restY;
    }
    const relative = teeY - h;
    const gripped = u < releaseTime || u >= period - 1e-9;
    return {
      blockHeight: h,
      cycleCoordinate: u / period,
      gripped,
      jawOpeningAngle: phi,
      localTime: u,
      stage,
      teeRelative: relative,
      weightY: teeY,
      weightVelocity: velocity,
      weightBottomY: teeY + W_BOTTOM,
      pileHeadGap: teeY - restY,
    };
  };

  // ------------------------------------------------------------ materials --
  const jawMaterial = matte(PALETTE.driven, { metalness: 0.2, roughness: 0.48 });
  const weightMaterial = matte(PALETTE.driver, { metalness: 0.16, roughness: 0.55 });
  const blockMaterial = matte(PALETTE.accent, { metalness: 0.24, roughness: 0.44 });
  const frameMaterial = matte(PALETTE.frame, { metalness: 0.15, roughness: 0.68 });
  const darkMaterial = matte(PALETTE.ink, { metalness: 0.24, roughness: 0.48 });
  const mesh = (geometry, material, role) => {
    const object = new THREE.Mesh(geometry, material);
    object.userData.role = role;
    return object;
  };
  const slab = (polygons, low, high, material, role) => mesh(plate(polygons, low, high), material, role);
  const box = (x0, x1, y0, y1, z0, z1, material, role) => {
    const object = mesh(new THREE.BoxGeometry((x1 - x0) * S, (y1 - y0) * S, z1 - z0), material, role);
    object.position.set((x0 + x1) / 2 * S, (y0 + y1) / 2 * S, (z0 + z1) / 2);
    return object;
  };

  // Depth layers (local units): jaws and T head in one plane, the rope-block
  // casting behind them, the frame deepest.
  const JAW_Z = [-0.2, 0.2];
  const BLOCK_Z = [-0.7, -0.25];
  const TEE_Z = [-0.3, 0.3];
  const FRAME_Z = [-0.9, 0.9];
  // Back face of slot B: behind the rope (radius 0.2 about z -0.475) and the
  // rope-block casting (back at z -0.7).
  const BEAM_BACK_Z = -0.74;
  const RIB_Z = [-0.9, -0.3];
  const LUG_Z = [-0.25, 0.9];
  const PIN_RADIUS = 4.4;

  // --------------------------------------------------------------- frame --
  const frame = new THREE.Group();
  frame.userData.fixed = true;
  frame.userData.role = 'fixed-pile-driver-frame-with-slot-b';
  const groundY = restY + W_BOTTOM - 9 - 29 - 40;
  // Brown's top beam is one continuous timber: slot B is cut through its
  // front part only (open at the front, top and bottom), so the beam's back
  // runs unbroken behind the slot, the rope and the horns.
  const cheekRight = rightCheekOutline();
  const beamHalves = [cheekRight, mirror(cheekRight)].map((outline, index) => {
    const half = slab(poly(scaled(outline)), BEAM_BACK_Z, FRAME_Z[1], frameMaterial,
      `${index ? 'left' : 'right'}-half-of-top-beam-with-side-of-slot-b`);
    half.userData.fixed = true;
    return half;
  });
  const beamBack = box(-BEAM_HALF, BEAM_HALF, BEAM_BOTTOM, BEAM_TOP, FRAME_Z[0], BEAM_BACK_Z, frameMaterial,
    'continuous-back-of-top-beam-behind-slot-b');
  beamBack.userData.fixed = true;
  beamHalves.push(beamBack);
  const posts = [-1, 1].map((side) => box(side < 0 ? -POST_OUTER : POST_INNER, side < 0 ? -POST_INNER : POST_OUTER,
    restY + W_BOTTOM - 8, BEAM_BOTTOM, ...FRAME_Z, frameMaterial, `${side < 0 ? 'left' : 'right'}-guide-post`));
  const ribs = [-1, 1].map((side) => box(side < 0 ? -POST_INNER : RIB_INNER, side < 0 ? -RIB_INNER : POST_INNER,
    restY + W_BOTTOM - 8, BEAM_BOTTOM, ...RIB_Z, frameMaterial, `${side < 0 ? 'left' : 'right'}-weight-guide-batten`));
  const postFeet = [-1, 1].map((side) => box(side < 0 ? -POST_OUTER - 10 : POST_INNER, side < 0 ? -POST_INNER : POST_OUTER + 10,
    groundY, restY + W_BOTTOM - 8, ...FRAME_Z, frameMaterial, `${side < 0 ? 'left' : 'right'}-post-and-foot-below-plate-crop`));
  frame.add(...beamHalves, ...posts, ...ribs, ...postFeet);
  // Pile head and pile beneath the plate's crop, where W lands.
  const anvil = box(-60, 60, restY + W_BOTTOM - 9, restY + W_BOTTOM, -1.0, 1.0, darkMaterial, 'pile-head-impact-anvil');
  const pile = box(-40, 40, groundY, restY + W_BOTTOM - 9, -0.8, 0.8, frameMaterial, 'pile-below-impact-head');
  const belowCrop = [anvil, pile, ...postFeet];
  for (const part of belowCrop) part.userData.beyondPlateCrop = true;
  frame.add(anvil, pile);
  root.add(frame);

  // ------------------------------------------------------ rope block (monkey)
  const block = new THREE.Group();
  block.userData.role = 'rope-block-carrying-pliers-jaws';
  // Round ears concentric with the jaw pivots, joined to the block's sides
  // (the pivots sat on the block's edges with the old free-standing discs).
  const EAR_RADIUS = 10.5;
  const ear = (side) => polygonClipping.union(
    poly(circle([side * PIVOT_X, 0], EAR_RADIUS, 96)),
    poly(side > 0
      ? [[STOP_HALF - 1, -EAR_RADIUS], [PIVOT_X, -EAR_RADIUS], [PIVOT_X, EAR_RADIUS], [STOP_HALF - 1, EAR_RADIUS]]
      : [[-PIVOT_X, -EAR_RADIUS], [-STOP_HALF + 1, -EAR_RADIUS], [-STOP_HALF + 1, EAR_RADIUS], [-PIVOT_X, EAR_RADIUS]]),
  );
  // An eye lug standing on the crossbar, across the rope eye's plane, that
  // the eye's lower bow passes through.
  const castingOutline = polygonClipping.union(
    poly([[-68, 94], [68, 94], [68, 104], [-68, 104]]),
    poly([[-35, 84], [35, 84], [35, 94], [-35, 94]]),
    poly([[-24.5, 67], [24.5, 67], [24.5, 84], [-24.5, 84]]),
    poly([[-24.5, 67], [0, 49], [24.5, 67]]),
    poly([[-STOP_HALF, BLOCK_BOTTOM], [STOP_HALF, BLOCK_BOTTOM], [STOP_HALF, 10], [26, 10], [24, 34], [0, 21], [-24, 34], [-26, 10], [-STOP_HALF, 10]]),
    ear(1),
    ear(-1),
  );
  const casting = slab(castingOutline.map((polygon) => polygon.map((ring) => scaled(ring))), ...BLOCK_Z, blockMaterial,
    'rope-block-casting-bar-web-stirrup-and-pivot-ears');
  // p98 (the user's review): Brown's two curved members between the jaws
  // are springs, not cast stirrups. They are one bowed steel leaf seated at
  // its middle in the V at the top of the pivot block; each free end bears
  // on the inside of a jaw arm below the crossbar and pushes it outward, so
  // the feet close under the T head except at the top, where slot B presses
  // the horns in against the leaf and the jaws open. Brown's section shows
  // the leaf passing through an open slot between the hatched stem pieces;
  // behind it a thin web (set back behind the leaf) joins the crossbar's
  // stem to the pivot block, as the stem's unsectioned back.
  const SPRING_Z = [-0.5, -0.04];
  const stemWeb = slab(poly(scaled([[-7, 16], [7, 16], [7, 58], [-7, 58]])), -0.69, SPRING_Z[0] - 0.02,
    blockMaterial, 'rope-block-stem-web-behind-the-spring-slot');
  block.add(stemWeb);
  const SPRING_HALF = 1.6;
  const springRightArm = [[0, 22.6], [11, 31.3], [25, 42.5], [41, 52], [55, 62], [63.5, 73], [67, 84], [66.6, 90]];
  const springRest = (() => {
    const pts = [...springRightArm.slice(1).map(([x, y]) => [-x, y]).reverse(), ...springRightArm];
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
    const count = 241;
    const samples = curve.getSpacedPoints(count - 1).map((p) => [p.x, p.y]);
    // Arc length from the seated middle, normalised per arm (0 at the seat,
    // 1 at each free end).
    const mid = (count - 1) / 2;
    const length = [0];
    for (let i = 1; i < count; i += 1) length.push(length[i - 1] + Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]));
    const u = samples.map((_, i) => Math.abs(length[i] - length[mid]) / (length[count - 1] - length[mid]));
    return { samples, u, count, mid };
  })();
  // A cantilever carrying an end load: deflection shape (3u^2 - u^3) / 2
  // keeps the seat and its tangent fixed.
  const springShape = (u) => (3 * u * u - u * u * u) / 2;
  const springCenterline = (dx) => springRest.samples.map(([x, y], i) => {
    const w = springShape(springRest.u[i]) * dx;
    return [x + (x >= 0 ? w : -w), y];
  });
  const springOutline = (dx) => {
    const c = springCenterline(dx);
    const left = [], right = [];
    for (let i = 0; i < c.length; i += 1) {
      const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
      const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty);
      left.push([c[i][0] - SPRING_HALF * ty / l, c[i][1] + SPRING_HALF * tx / l]);
      right.push([c[i][0] + SPRING_HALF * ty / l, c[i][1] - SPRING_HALF * tx / l]);
    }
    return { left, right };
  };
  // Tip deflection (right arm, + outward) at which the leaf just bears on the
  // right jaw at opening angle phi (0.15 px running clearance).
  const springClearance = 0.15;
  // Only the upper part of each arm can reach the jaw (checked over the
  // whole leaf in the tests); the jaw's inner edge runs from outline index
  // 84 (below the arm's inner face) round to the horn tip.
  const jawInnerEdge = JAW_OUTLINE.slice(84);
  // Signed distance to the inner edge: negative inside the jaw (running up
  // the inner edge, the jaw lies on the right).
  const innerEdgeSignedDistance = (point) => {
    let best = Infinity, sign = 1;
    for (let i = 0; i + 1 < jawInnerEdge.length; i += 1) {
      const a = jawInnerEdge[i], b = jawInnerEdge[i + 1];
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const t = THREE.MathUtils.clamp(((point[0] - a[0]) * ex + (point[1] - a[1]) * ey) / (ex * ex + ey * ey), 0, 1);
      const d = Math.hypot(point[0] - a[0] - t * ex, point[1] - a[1] - t * ey);
      if (d < best) { best = d; sign = ex * (point[1] - a[1]) - ey * (point[0] - a[0]) > 0 ? 1 : -1; }
    }
    return sign * best;
  };
  const touchStart = springRest.mid + Math.round(0.55 * springRest.mid);
  const springTouches = (dx, phi) => {
    const c = springRest.samples, n = springRest.count;
    const cosine = Math.cos(-phi), sine = Math.sin(-phi);
    const at = (i) => [c[i][0] + springShape(springRest.u[i]) * dx, c[i][1]];
    for (let i = touchStart; i < n; i += 2) {
      const p = at(i), a = at(Math.max(0, i - 1)), b = at(Math.min(n - 1, i + 1));
      const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty);
      for (const side of [1, -1]) {
        const x = p[0] - side * SPRING_HALF * ty / l - PIVOT_X, y = p[1] + side * SPRING_HALF * tx / l;
        const q = [x * cosine - y * sine, x * sine + y * cosine];
        if (innerEdgeSignedDistance(q) < springClearance) return true;
      }
    }
    return false;
  };
  const springDeflectionAt = (phi) => {
    let low = -40, high = 12;
    for (let k = 0; k < 17; k += 1) {
      const mid = (low + high) / 2;
      if (springTouches(mid, phi)) high = mid; else low = mid;
    }
    return low;
  };
  const springMaterial = matte(PALETTE.ink, { metalness: 0.35, roughness: 0.45 });
  // A closed strip: each of its four long faces has its own vertices (sharp
  // edges, smooth along the leaf), and both ends are capped.
  const springGeometry = new THREE.BufferGeometry();
  {
    const n = springRest.count;
    springGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((n * 8 + 8) * 3), 3));
    const index = [];
    for (let i = 0; i < n - 1; i += 1) {
      for (let c = 0; c < 4; c += 1) {
        const a = i * 8 + 2 * c, b = a + 1;
        index.push(a, b, a + 8, b, b + 8, a + 8);
      }
    }
    const cap = n * 8;
    index.push(cap, cap + 2, cap + 1, cap, cap + 3, cap + 2, cap + 4, cap + 5, cap + 6, cap + 4, cap + 6, cap + 7);
    springGeometry.setIndex(index);
  }
  let springDeflection = null;
  const writeSpring = (dx) => {
    if (springDeflection === dx) return;
    springDeflection = dx;
    const { left, right } = springOutline(dx);
    const position = springGeometry.attributes.position;
    const n = springRest.count;
    const corner = (i, c) => {
      const [[x, y], z] = [[left[i], SPRING_Z[0]], [left[i], SPRING_Z[1]], [right[i], SPRING_Z[1]], [right[i], SPRING_Z[0]]][c % 4];
      return [x * S, y * S, z];
    };
    for (let i = 0; i < n; i += 1) {
      for (let c = 0; c < 4; c += 1) {
        position.setXYZ(i * 8 + 2 * c, ...corner(i, c));
        position.setXYZ(i * 8 + 2 * c + 1, ...corner(i, c + 1));
      }
    }
    for (let c = 0; c < 4; c += 1) {
      position.setXYZ(n * 8 + c, ...corner(0, c));
      position.setXYZ(n * 8 + 4 + c, ...corner(n - 1, c));
    }
    position.needsUpdate = true;
    springGeometry.computeVertexNormals();
    springGeometry.computeBoundingBox();
    springGeometry.computeBoundingSphere();
  };
  const spring = mesh(springGeometry, springMaterial, 'bowed-leaf-spring-pushing-jaw-arms-outward');
  spring.userData.deformable = true;
  block.add(spring);
  // Tabulated over the jaws' whole range of opening.
  // (slot B opens the jaws to openAngle at most; the re-catch cams them to
  // snapAngle; the tests check the whole cycle stays inside the table.)
  const maximumOpening = Math.max(openAngle, snapAngle) + 0.012;
  const springTable = tabulate(0, maximumOpening + 0.008, 0.004, (phi) => springDeflectionAt(phi));
  writeSpring(springTable.at(0));

  // The stop lugs reach forward into the jaw plane below the pivot bosses.
  const stopLug = slab(poly(scaled([[-STOP_HALF, BLOCK_BOTTOM], [STOP_HALF, BLOCK_BOTTOM], [STOP_HALF, -14], [-STOP_HALF, -14]])),
    BLOCK_Z[1], JAW_Z[1], blockMaterial, 'rope-block-jaw-closing-stop-lugs');
  const ring = mesh(new THREE.TorusGeometry(7 * S, 2 * S, 24, 64), darkMaterial, 'hoisting-rope-eye-on-rope-block');
  const ropeZ = (BLOCK_Z[0] + BLOCK_Z[1]) / 2;
  // The eye's lower bow runs through the lug's bore (centre y EYE_BOW).
  const EYE_BOW = 108.2;
  ring.position.set(0, (EYE_BOW + 7) * S, ropeZ);
  // The lug: a thin plate standing on the crossbar across the eye's plane
  // (so its bore runs along x), arched concentric with that bore.
  const lugHalfThickness = 1.7 * S, lugRadius = 4.4, lugBore = 2.35;
  const lugShape = polygonClipping.difference(
    polygonClipping.union(poly(circle([0, EYE_BOW], lugRadius, 64)),
      poly([[-lugRadius, 103], [lugRadius, 103], [lugRadius, EYE_BOW], [-lugRadius, EYE_BOW]])),
    poly(circle([0, EYE_BOW], lugBore, 48)));
  // Built in the (z, y) plane about the rope's line, then turned edge-on.
  const eyeLug = slab(lugShape.map((polygon) => polygon.map((r) => r.map(([u, v]) => [u * S, v * S]))),
    -lugHalfThickness, lugHalfThickness, blockMaterial, 'rope-eye-lug-on-crossbar');
  eyeLug.rotation.y = Math.PI / 2;
  eyeLug.position.z = ropeZ;
  const pins = [-1, 1].map((side) => {
    const pin = mesh(new THREE.CylinderGeometry(PIN_RADIUS * S, PIN_RADIUS * S, JAW_Z[1] + 0.06 - BLOCK_Z[0] + 0.02, 48), darkMaterial,
      `${side < 0 ? 'left' : 'right'}-jaw-pivot-pin`);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(side * PIVOT_X * S, 0, (JAW_Z[1] + 0.06 + BLOCK_Z[0] - 0.02) / 2);
    const head = mesh(new THREE.CylinderGeometry(7 * S, 7 * S, 0.05, 48), darkMaterial, `${side < 0 ? 'left' : 'right'}-jaw-pivot-pin-head`);
    head.rotation.x = Math.PI / 2;
    head.position.set(side * PIVOT_X * S, 0, JAW_Z[1] + 0.01 + 0.025);
    block.add(head);
    return pin;
  });
  block.add(casting, eyeLug, stopLug, ring, ...pins);

  const jaws = [-1, 1].map((side) => {
    const jaw = new THREE.Group();
    jaw.position.x = side * PIVOT_X * S;
    jaw.userData.role = `${side < 0 ? 'left' : 'right'}-pliers-jaw-a`;
    const outline = side > 0 ? JAW_OUTLINE : mirror(JAW_OUTLINE);
    const shape = polygonClipping.difference(poly(scaled(outline)), poly(circle([0, 0], (PIN_RADIUS + 0.12) * S, 64)));
    const body = slab(shape, ...JAW_Z, jawMaterial, `${side < 0 ? 'left' : 'right'}-bored-pliers-jaw-with-horn-a-and-foot`);
    jaw.add(body);
    block.add(jaw);
    return jaw;
  });
  root.add(block);

  // ------------------------------------------------------------ weight W --
  const weight = new THREE.Group();
  weight.userData.role = 'solid-drop-weight-w-with-t-head';
  const weightBody = box(-W_HALF, W_HALF, W_BOTTOM, W_TOP, ...FRAME_Z, weightMaterial, 'solid-drop-weight-w');
  const tee = slab(poly(scaled(teeOutline())), ...TEE_Z, weightMaterial, 't-head-fixed-on-weight-w');
  // Brown's rounded lugs on W's sides ride in front of the guide battens.
  const lugs = [];
  for (const side of [-1, 1]) for (const y of [-106, -233]) {
    const arc = [];
    for (let i = 0; i <= 24; i += 1) {
      const a = -Math.PI / 2 + Math.PI * i / 24;
      arc.push([side * (W_HALF - 0.5 + 6 * Math.cos(a)), y + 6.5 * Math.sin(a)]);
    }
    const outline = side > 0 ? arc : arc.reverse();
    const lug = slab(poly(scaled(outline)), ...LUG_Z, weightMaterial, `${side < 0 ? 'left' : 'right'}-rounded-guide-lug-of-w`);
    lugs.push(lug);
  }
  weight.add(weightBody, tee, ...lugs);
  root.add(weight);

  // ------------------------------------------------------------ rope --
  const hoistRopeRadius = 0.2;
  const rope = makeDynamicCable({ color: PALETTE.belt, laid: true, maxSegments: 256, radius: hoistRopeRadius });
  rope.userData.role = 'vertical-hoisting-rope-through-slot-b';
  rope.userData.mesh.userData.role = 'vertical-hoisting-rope-through-slot-b';
  // It runs up out of the picture past Brown's crop.
  rope.userData.mesh.userData.beyondPlateCrop = true;
  root.add(rope);
  // Brown draws only the rope running up through slot B and out of the
  // picture; its winch is not drawn, so the rope runs straight past the crop
  // (it is excluded from the camera fit) and ends cleanly well above it.
  const ropeTopY = BEAM_TOP * S + 8;

  // ---------------------------------------------------------------- update --
  const update = (time) => {
    const state = stateAtTime(time + displayTimeOffset);
    block.position.y = state.blockHeight * S;
    jaws[0].rotation.z = -state.jawOpeningAngle;
    jaws[1].rotation.z = state.jawOpeningAngle;
    writeSpring(springTable.at(state.jawOpeningAngle));
    weight.position.y = state.weightY * S;
    // The rope's end is seized into the top of the eye (ring top 124.2), so
    // no gap shows between them.
    const ropeEndY = (state.blockHeight + 123.6) * S;
    const hangingLength = ropeTopY - ropeEndY;
    // The lay travels with the rope: its phase is fixed at the eye.
    rope.userData.setPoints([new THREE.Vector3(0, ropeTopY, ropeZ), new THREE.Vector3(0, ropeEndY, ropeZ)], hangingLength);
    root.userData.kinematics = state;
  };

  root.userData.archetype = 'slot-triggered-twin-pivot-releasing-hooks-with-ballistic-pile-driver-drop';
  root.userData.mechanism =
    'rope-block-carries-pliers-jaws-gripping-the-t-head-of-w-until-slot-b-squeezes-the-horns-and-opens-the-jaws-then-the-jaws-cam-over-and-regrip-the-t-head';
  root.userData.blocks = {
    anvil, beamHalves, block, casting, frame, jaws, lugs, pile, pins, posts, ribs, ring, rope, spring, stemWeb, stopLug, tee, weight, weightBody,
    jawBodies: jaws.map((jaw) => jaw.children[0]),
  };
  root.userData.displayTimeOffset = displayTimeOffset;
  root.userData.stateAtTime = stateAtTime;
  root.userData.planar = {
    ...contacts,
    camAngle,
    slotAngle,
    support,
  };
  root.userData.geometry = {
    blockBottom: BLOCK_BOTTOM,
    catchHeight,
    engageHeight,
    freeAngle,
    gravity,
    springHalfThickness: SPRING_HALF,
    springRestCenterline: springRightArm.map((p) => [...p]),
    springDeflectionAt: (phi) => springTable.at(phi),
    jawOutline: JAW_OUTLINE.map((p) => [...p]),
    loadAngle: LOAD_ANGLE,
    lowHeight,
    openAngle,
    pinRadius: PIN_RADIUS,
    pivotX: PIVOT_X,
    pixelScale: S,
    renderScale,
    restY,
    snapAngle,
    snapRelative,
    stopHalfWidth: STOP_HALF,
    tee: { stemHalf: T_STEM, barHalf: T_BAR, top: T_TOP, bottom: T_BOTTOM, undercutY: T_UNDERCUT_Y },
    topHeight,
    weight: { halfWidth: W_HALF, top: W_TOP, bottom: W_BOTTOM },
    slot: { bottom: BEAM_BOTTOM, top: BEAM_TOP, mouthHalf: SLOT_MOUTH_HALF, topHalf: SLOT_TOP_HALF, lipRadius: SLOT_LIP_RADIUS },
  };
  root.userData.timeline = {
    cycleDuration: period, demonstrationPeriod: period, descentEnd, descentStart, impactTime, releaseTime, riseEnd, swingEnd, takeUpStart,
  };
  root.userData.transmission = {
    externalReloadRequired: false,
    hookCount: 2,
    releaseType: 'slot-b-squeezes-pliers-horns-to-open-jaws',
    releasedBody: 'pile-driver-weight-w',
    trigger: 'horns-a-enter-slot-b-in-the-top-beam',
  };
  root.userData.dynamics = {
    prescribedHoist: true,
    quasiStaticJaws: true,
    validatedPassiveRelease: false,
    releaseLaw: 'slot-B lips press the horns inward; the minimal non-penetrating opening angle is solved against the jaw outline; W falls ballistically once the foot tips pass the T bar ends',
    closingLaw: `the ${Math.round(LOAD_ANGLE * 180 / Math.PI)}-degree barbs turn the load into a closing moment, and Brown's bowed leaf spring, seated in the rope block, pushes the jaw arms outward so the jaws close when unloaded`,
    springLaw: 'each free end of the leaf follows the inside of its jaw arm (0.15 px running clearance); the leaf deflects as a cantilever under an end load, (3u^2 - u^3)/2 along each arm from its seat; spring force and preload are not solved',
    limitation: 'hoist motion, contact forces, friction and the jaws\' swing-shut timing are prescribed; impact is inelastic',
  };
  root.userData.reconstructionNote =
    'W is one solid block with a T head. The pliers jaws A pivot on the rope block; their barbed feet hook under the undercut T bar. Rising into slot B, the horns are pressed inward by its lips, opening the jaws until the feet pass the bar ends and W falls. Descending, the feet ride the T head\'s chamfered top, cam open and fall shut under the bar. Brown\'s two curved members are one bowed leaf spring seated in the V of the pivot block, bearing on the jaw arms and flexing as slot B presses them in; a set-back web behind the leaf joins the crossbar stem to the pivot block. Brown\'s flat foot tops are drawn with a 35-degree barb so the load holds the jaws closed; slot B is widened at its mouth to admit the horns.';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official page marks movement 251 animation unavailable',
    referenceScope: 'static engraving and public-domain description only; no official motion data exists',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate251: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'two mirror-image pliers jaws pivot on the rope block, their feet grip the T head on top of the solid weight W, and their horns enter the slot in the top beam',
      measurementUncertaintyPixels: 2,
      officialAnimationAvailable: false,
      rasterJawPivots: [{ x: 237.5, y: 214 }, { x: 297, y: 214 }],
      rasterTeeBar: { left: 253, right: 281, top: 240, bottom: 251 },
      rasterTeeStem: { left: 259, right: 271, top: 251, bottom: 284 },
      rasterWeightBounds: { left: 186, right: 344, top: 284, bottom: 478 },
      rasterSlotB: { centerX: 265, topY: 13, topHalfWidth: 38, bottomY: 37, bottomHalfWidth: 49 },
      rasterTopBeam: { top: 11, bottom: 41 },
      rasterRopeBlockBar: { left: 198, right: 335, top: 110, bottom: 120 },
      rasterHornTop: 67,
      view: 'front-elevation-through-rope-block-jaws-t-head-weight-and-slot-b',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 63,
      edition: 21,
      illustrationPage: 62,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };

  finishHookFamily(root, period);
  // Fit the drawn parts over the whole cycle; the pile, anvil and post feet
  // below the plate's crop and the rope running up out of it are excluded.
  for (const part of [...belowCrop, rope]) part.visible = false;
  const fitBounds = new THREE.Box3();
  for (let sample = 0; sample <= 64; sample += 1) {
    update(period * sample / 64);
    root.updateMatrixWorld(true);
    root.traverseVisible((object) => {
      if (!object.isMesh) return;
      object.geometry.computeBoundingBox();
      fitBounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
    });
  }
  root.userData.cameraFitBounds = fitBounds.expandByScalar(0.02);
  root.userData.cameraDistanceScale = 0.88;
  for (const part of [...belowCrop, rope]) part.visible = true;
  update(0);
  markShadows(root);
  return {
    root,
    update,
    // Brown draws a flat front elevation.
    cameraDirection: new THREE.Vector3(0, 0, 1),
  };
}

export function createAuthoredPileDriverMovement(movement) {
  let result;
  switch (movement.id) {
    case 251: result = pileDriverReleasingHooks(movement); break;
    default: return null;
  }
  result.root.userData.fidelity = 'authored';
  return result;
}
