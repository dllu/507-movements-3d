import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { creaseIndexedNormals } from './crease-normals.js';
import { circle, plate, poly, polygonClipping as clip } from './finite-plate-geometry.js';
import { rackPinionGeometry, rackToothGeometry } from './rack-pinion-parts.js';
import { spokedWheelGeometry } from './spoked-wheel.js';
import { PALETTE, markShadows, matte } from './primitives.js';

// Movement 284: Brown's saw-mill carriage feed. A lower crank rocks the
// bell crank about fulcrum a by a long rod; the catch hung from the screw-set
// slider on its vertical arm PULLS the large ratchet anticlockwise one tooth
// per crank turn, the click at the upper left holds it against clockwise
// return, and the pinion on the ratchet shaft feeds the carriage rack.
//
// Every visible part is one flat extrusion in its drawn plane. Positions and
// proportions are measured on the 525 px plate; the outlines are rebuilt as
// the intended curves (circles, arcs, straight lines, a clothoid scroll).
// The official page has no animation for this movement.

const TAU = Math.PI * 2;
const SCALE = 0.0155; // model units per plate pixel
const O_PX = [140, 352]; // ratchet centre on the plate
const P = (x, y) => [(x - O_PX[0]) * SCALE, (O_PX[1] - y) * SCALE];
const px = (value) => value * SCALE;

const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (a) => Math.hypot(a[0], a[1]);
const ang = (a) => Math.atan2(a[1], a[0]);
const mod = (value, period) => ((value % period) + period) % period;
const smooth = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (6 * t - 15) + 10);
};

// ---------------------------------------------------------------- geometry

// Measured on the plate (raster pixels, y down).
const PLATE = {
  ratchetCenter: [140, 352],
  ratchetTipRadius: 107,
  ratchetRootRadius: 100.5,
  ratchetRimInnerRadius: 87,
  ratchetHubRadius: 26,
  ratchetSpokeWidth: 13,
  ratchetTeeth: 44,
  fulcrumA: [141, 122],
  rockerJoint: [465, 122],
  inputShaft: [454, 453],
  crankPin: [389, 438],
  catchHinge: [141, 187],
  clickPivot: [73, 232],
  clickTip: [53.5, 292.5],
  rackPitch: 24,
  pinionTeeth: 8,
};

const N_TEETH = PLATE.ratchetTeeth;
const PITCH = TAU / N_TEETH;
const R_TIP = px(PLATE.ratchetTipRadius);
const R_ROOT = px(PLATE.ratchetRootRadius);
const PINION_PITCH_RADIUS = px(PLATE.pinionTeeth * PLATE.rackPitch / TAU);
const RACK_PITCH = px(PLATE.rackPitch);
const RACK_ADDENDUM = 0.1;
const FULCRUM = P(...PLATE.fulcrumA);
const ROCKER_LENGTH = len(sub(P(...PLATE.rockerJoint), FULCRUM));
const INPUT = P(...PLATE.inputShaft);
const CRANK_RADIUS = len(sub(P(...PLATE.crankPin), INPUT));
const ROD_LENGTH = len(sub(P(...PLATE.rockerJoint), P(...PLATE.crankPin)));
const SOURCE_CRANK_ANGLE = ang(sub(P(...PLATE.crankPin), INPUT));
const SOURCE_SLIDER_RADIUS = len(sub(P(...PLATE.catchHinge), FULCRUM));
const CLICK_PIVOT = P(...PLATE.clickPivot);
// The pawl noses rest a hair off the pocket corner.
const SEAT_RADIUS = R_ROOT + 0.002;
const SEAT_ANGLE_OFFSET = -0.002 / R_ROOT;

const CRANK_PERIOD = 2.4;
const FEED_STROKES = 8;
const LOOP_REVOLUTIONS = FEED_STROKES + 1;
const LOOP_PERIOD = CRANK_PERIOD * LOOP_REVOLUTIONS;
const STEPS_PER_REV = 480;
const GRAVITY = 54; // model units / s^2 (1 unit is about 0.18 m)

// Catch outline (raster, y down). Brown's catch is a Victorian scroll: a
// circular-arc stem from the hinge eye runs into a clothoid scroll that
// curls up anticlockwise into a round terminal, and a pointed claw web
// under the foot of the stem reaches left into the teeth, its lower edge
// sweeping smoothly out into the underside of the scroll. The scroll and
// stem are fitted to the plate's ink (about 1 px residual). The hinge sits
// CATCH_HINGE_DROP px lower on the feed screw than Brown's slider (the
// drawn setting cannot sweep far enough for the claw to drop behind the
// next tooth), and the stem is refitted from there so the hook itself hangs
// where Brown draws it.
const CATCH_HINGE_DROP = 9;
const CATCH_HINGE = [PLATE.catchHinge[0], PLATE.catchHinge[1] + CATCH_HINGE_DROP];
// The claw point, at the pocket corner of Brown's pose. Its upper (working)
// edge follows the radial tooth face it pulls on, which is why it runs
// nearly level where Brown's slopes up into the stem.
const CATCH_CLAW_TIP = [240.2, 338.6];
// The working edge rises 8 degrees, just inside the 7.6-degree tooth face
// plus the catch's own turn while pulling (Brown's rises about 16, which
// would cut into the tooth above).
const CLAW_RISE = 8 * Math.PI / 180;
// Gig-back: the carriage stops GL tooth short of the start and the catch and
// click are let down onto the backs, then the wheel settles 0.18 tooth past
// the seat onto the click.
const GL = 0.15;
const CLAW_EDGE = 10; // straight working edge, px (the tooth face is 6.5)
function catchOutlineRaster() {
  const hinge = CATCH_HINGE;
  const stemEnd = [255.8, 312.34];
  const stemHeading = 1.2883; // raster heading at the stem end (down and right)
  const tangent = [Math.cos(stemHeading), Math.sin(stemHeading)];
  const normal = [-tangent[1], tangent[0]];
  // The circle through the hinge tangent to the stem end.
  const d = sub(hinge, stemEnd);
  const radius = (d[0] * d[0] + d[1] * d[1]) / (2 * (d[0] * normal[0] + d[1] * normal[1]));
  const center = add(stemEnd, [normal[0] * radius, normal[1] * radius]);
  const a0 = ang(sub(hinge, center));
  const a1 = ang(sub(stemEnd, center));
  const sweep = mod(a1 - a0 + Math.PI, TAU) - Math.PI;
  const arcSteps = 60;
  const spine = [];
  for (let i = 0; i <= arcSteps; i += 1) {
    const a = a0 + sweep * i / arcSteps;
    spine.push(add(center, [Math.abs(radius) * Math.cos(a), Math.abs(radius) * Math.sin(a)]));
  }
  const scrollLength = 97.9;
  const k0 = Math.sign(sweep) / Math.abs(radius);
  const k1 = -0.1388;
  const exponent = 1.642;
  const steps = 160;
  let heading = stemHeading;
  let position = stemEnd;
  for (let i = 0; i < steps; i += 1) {
    const s = (i + 0.5) / steps;
    heading += (k0 + (k1 - k0) * s ** exponent) * scrollLength / steps;
    position = add(position, [Math.cos(heading) * scrollLength / steps, Math.sin(heading) * scrollLength / steps]);
    spine.push(position);
  }
  // Half-width tapers 5.4 px at the eye, 4.6 at the stem foot, 3.8 at the
  // terminal.
  const lengths = [0];
  for (let i = 1; i < spine.length; i += 1) lengths.push(lengths[i - 1] + len(sub(spine[i], spine[i - 1])));
  const total = lengths.at(-1);
  const stemLength = lengths[arcSteps];
  const half = (s) => (s <= stemLength
    ? 5.4 + (4.6 - 5.4) * s / stemLength
    : 4.6 + (3.8 - 4.6) * (s - stemLength) / (total - stemLength));
  const outer = [];
  const inner = [];
  for (let i = 0; i < spine.length; i += 1) {
    const t = sub(spine[Math.min(spine.length - 1, i + 1)], spine[Math.max(0, i - 1)]);
    const n = [-t[1] / len(t), t[0] / len(t)];
    const w = half(lengths[i]);
    outer.push(add(spine[i], [n[0] * w, n[1] * w]));
    inner.push(add(spine[i], [-n[0] * w, -n[1] * w]));
  }
  const stroke = poly([...outer, ...inner.slice().reverse()]);
  const bead = poly(circle(spine.at(-1), 4.6, 48));
  const boss = poly(circle(hinge, 11, 64));
  // Claw web. The working edge runs straight from the point at CLAW_RISE
  // (along the radial tooth face it pulls on) until clear of the tooth tip,
  // then curves up into the stem's left (outer) edge as Brown's does; the lower
  // edge is one cubic from the point, leaving at Brown's 37 degrees and
  // tangent into the scroll's underside at its lowest point.
  const tip = CATCH_CLAW_TIP;
  const bezier = (p0, p1, p2, p3, count) => Array.from({ length: count + 1 }, (_, i) => {
    const u = i / count;
    const v = 1 - u;
    return [0, 1].map((k) => v * v * v * p0[k] + 3 * v * v * u * p1[k] + 3 * v * u * u * p2[k] + u * u * u * p3[k]);
  });
  const faceDirection = [Math.cos(CLAW_RISE), -Math.sin(CLAW_RISE)];
  const shoulder = add(tip, [faceDirection[0] * CLAW_EDGE, faceDirection[1] * CLAW_EDGE]);
  let upperIndex = 0;
  let lowestIndex = arcSteps;
  for (let i = 0; i < outer.length; i += 1) {
    if (i <= arcSteps + 10 && Math.abs(outer[i][1] - (shoulder[1] - 10)) < Math.abs(outer[upperIndex][1] - (shoulder[1] - 10))) {
      upperIndex = i;
    }
    if (i > arcSteps && i < arcSteps + steps * 0.8 && outer[i][1] > outer[lowestIndex][1]) lowestIndex = i;
  }
  const unit = (v) => [v[0] / len(v), v[1] / len(v)];
  const upperTangent = unit(sub(outer[upperIndex + 1], outer[upperIndex - 1]));
  const upper = [tip, ...bezier(shoulder, add(shoulder, [faceDirection[0] * 3, faceDirection[1] * 3]),
    add(outer[upperIndex], [upperTangent[0] * 4, upperTangent[1] * 4]), outer[upperIndex], 16)];
  const target = outer[lowestIndex];
  const tt = unit(sub(outer[lowestIndex + 1], outer[lowestIndex - 1]));
  const span = len(sub(target, tip));
  const leave = 37 * Math.PI / 180;
  const lower = bezier(tip, add(tip, [Math.cos(leave) * span * 0.4, Math.sin(leave) * span * 0.4]),
    sub(target, [tt[0] * span * 0.35, tt[1] * span * 0.35]), target, 24);
  const web = poly([...lower, ...outer.slice(upperIndex + 1, lowestIndex).reverse(), ...upper.slice().reverse()]);
  const bore = poly(circle(hinge, 4.5, 48));
  return clip.difference(clip.union(stroke, bead, boss, web), bore);
}

// Click (holding pawl): an eye about its pin and a tapered finger bounded by
// two circular arcs meeting at the tip.
function arcThrough(a, b, c, count) {
  const [ax, ay] = a;
  const [bx, by] = b;
  const [cx, cy] = c;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  const r = Math.hypot(ax - ux, ay - uy);
  const a0 = Math.atan2(ay - uy, ax - ux);
  const a2 = Math.atan2(cy - uy, cx - ux);
  const a1 = Math.atan2(by - uy, bx - ux);
  let sweep = a2 - a0;
  const between = mod(a1 - a0, TAU) < mod(a2 - a0, TAU);
  if (between) sweep = mod(sweep, TAU);
  else sweep = mod(sweep, TAU) - TAU;
  return Array.from({ length: count + 1 }, (_, i) => [
    ux + r * Math.cos(a0 + sweep * i / count),
    uy + r * Math.sin(a0 + sweep * i / count),
  ]);
}

function clickOutlineRaster(tip = PLATE.clickTip) {
  const leftEdge = arcThrough([64, 236], [57.3, 262], tip, 40);
  const rightEdge = arcThrough(tip, [69.5, 263], [81.5, 236], 40);
  const finger = poly([...leftEdge, ...rightEdge.slice(1), [73, 228]]);
  const eye = poly(circle(PLATE.clickPivot, 9, 64));
  return clip.difference(clip.union(finger, eye), poly(circle(PLATE.clickPivot, 4, 48)));
}

// Raster polygons -> model polygons relative to a pivot.
function toModel(polygons, pivotRaster = O_PX) {
  const pivot = P(...pivotRaster);
  return polygons.map((polygon) => polygon.map((ringPoints) => ringPoints.map(
    ([x, y]) => sub(P(x, y), pivot))));
}

// Ratchet teeth (wheel frame): a radial steep face at each pocket angle
// facing clockwise, the straight back rising anticlockwise... i.e. from the
// tip down to the next pocket, as Brown cuts them (the plate's r(theta)
// jumps up abruptly and falls gradually with increasing angle).
function ratchetProfile(mountPhase) {
  const points = [];
  for (let n = 0; n < N_TEETH; n += 1) {
    const theta = mountPhase + n * PITCH;
    points.push([R_ROOT * Math.cos(theta), R_ROOT * Math.sin(theta)]);
    points.push([R_TIP * Math.cos(theta), R_TIP * Math.sin(theta)]);
  }
  return points;
}

// ----------------------------------------------------------- contact solver

// Rotation of a pivoted plate towards the wheel (direction sign), swept from
// an angle just behind its current pose, at which its outline first ENTERS
// the ratchet outline: exact circle/segment crossing angles, vertex-edge both
// ways. Exits (the claw leaving a tooth face it sits under) are ignored, so
// the sweep may start inside a pocket. Both outlines run anticlockwise.
function firstHit(pivot, localPoints, localEdges, wheelPoints, wheelEdges, open, sign) {
  let best = Infinity;
  const circleSegment = (center, radius, a, b, callback) => {
    const d = sub(b, a);
    const f = sub(a, center);
    const A = d[0] * d[0] + d[1] * d[1];
    const B = 2 * (f[0] * d[0] + f[1] * d[1]);
    const C = f[0] * f[0] + f[1] * f[1] - radius * radius;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return;
    const root = Math.sqrt(disc);
    for (const t of [(-B - root) / (2 * A), (-B + root) / (2 * A)]) {
      if (t >= 0 && t <= 1) callback([a[0] + d[0] * t, a[1] + d[1] * t], d);
    }
  };
  // A point moving with velocity v enters an anticlockwise outline across
  // edge direction d when v points to the edge's left (inside).
  const entering = (v, d) => d[0] * v[1] - d[1] * v[0] > 0;
  for (const v of localPoints) {
    const radius = len(v);
    const base = ang(v);
    for (const [a, b] of wheelEdges) {
      circleSegment(pivot, radius, a, b, (x, d) => {
        const r = sub(x, pivot);
        if (!entering([-sign * r[1], sign * r[0]], d)) return;
        const travel = mod(sign * (ang(r) - base - open), TAU);
        if (travel < best) best = travel;
      });
    }
  }
  for (const w of wheelPoints) {
    const dw = sub(w, pivot);
    const radius = len(dw);
    const base = ang(dw);
    for (const [a, b] of localEdges) {
      circleSegment([0, 0], radius, a, b, (x, d) => {
        // In the plate's frame the wheel point turns the other way.
        if (!entering([sign * x[1], -sign * x[0]], d)) return;
        const travel = mod(sign * (base - ang(x) - open), TAU);
        if (travel < best) best = travel;
      });
    }
  }
  return open + sign * best;
}

function makeContactSolver(outline, pivotOf, sign, region) {
  // Only the working part of the outline (near the wheel) can touch it.
  // Decimated to about 1.5 px spacing; corners (the claw) are kept.
  let full = outline[0][0].slice(0, -1);
  if (full.reduce((area, p, i) => {
    const q = full[(i + 1) % full.length];
    return area + p[0] * q[1] - q[0] * p[1];
  }, 0) < 0) full = full.slice().reverse();
  const ring = full.filter((point, i) => {
    const prev = full[(i + full.length - 1) % full.length];
    const next = full[(i + 1) % full.length];
    const turn = Math.abs(mod(ang(sub(next, point)) - ang(sub(point, prev)) + Math.PI, TAU) - Math.PI);
    return i % 3 === 0 || turn > 0.3;
  });
  const keep = ring.map((point) => region(point));
  const localPoints = ring.filter((_, i) => keep[i]);
  const localEdges = [];
  for (let i = 0; i < ring.length; i += 1) {
    const j = (i + 1) % ring.length;
    if (keep[i] || keep[j]) localEdges.push([ring[i], ring[j]]);
  }
  const localCenter = localPoints.reduce((sum, point) => add(sum, point), [0, 0])
    .map((value) => value / localPoints.length);
  return (hinge, wheelAngle, profile, current, window) => {
    const wheelPoints = [];
    const wheelEdges = [];
    const count = profile.length;
    const centerAngle = ang(add(hinge, rot(localCenter, current)));
    for (let i = 0; i < count; i += 1) {
      const p = rot(profile[i], wheelAngle);
      const delta = Math.abs(mod(ang(p) - centerAngle + Math.PI, TAU) - Math.PI);
      if (delta > window) continue;
      wheelPoints.push(p);
      wheelEdges.push([p, rot(profile[(i + 1) % count], wheelAngle)]);
    }
    // Start just outside the current pose: contact is followed continuously
    // (sweeping in from far out would land on the outermost tooth instead).
    const open = current - sign * 0.01;
    return firstHit(hinge, localPoints, localEdges, wheelPoints, wheelEdges, open, sign);
  };
}

// ------------------------------------------------------------- kinematics

function fourBar(crankAngle) {
  const pin = add(INPUT, [CRANK_RADIUS * Math.cos(crankAngle), CRANK_RADIUS * Math.sin(crankAngle)]);
  const delta = sub(pin, FULCRUM);
  const d = len(delta);
  const along = (ROCKER_LENGTH ** 2 - ROD_LENGTH ** 2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ROCKER_LENGTH ** 2 - along ** 2));
  const u = [delta[0] / d, delta[1] / d];
  const foot = add(FULCRUM, [u[0] * along, u[1] * along]);
  const c1 = add(foot, [-u[1] * h, u[0] * h]);
  const c2 = add(foot, [u[1] * h, -u[0] * h]);
  const joint = c1[1] >= c2[1] ? c1 : c2;
  return { pin, joint, rocker: ang(sub(joint, FULCRUM)) };
}

const hingeAt = (rocker, sliderRadius) => add(FULCRUM, rot([0, -sliderRadius], rocker));

// World polar angle of the catch nose seated on the pocket circle.
function seatAngle(hinge, reach, radius = SEAT_RADIUS) {
  const d = len(hinge);
  const along = (d * d + radius ** 2 - reach ** 2) / (2 * d);
  const h = Math.sqrt(Math.max(0, radius ** 2 - along ** 2));
  const u = [hinge[0] / d, hinge[1] / d];
  const c1 = add([u[0] * along, u[1] * along], [-u[1] * h, u[0] * h]);
  const c2 = add([u[0] * along, u[1] * along], [u[1] * h, -u[0] * h]);
  return ang(c1[0] > c2[0] ? c1 : c2);
}

let cachedSolution = null;

function solveFeed() {
  if (cachedSolution) return cachedSolution;
  // Crank angles of the two rocker extremes (the crank turns clockwise).
  let maxRocker = { value: -Infinity };
  let minRocker = { value: Infinity };
  for (let i = 0; i < 7200; i += 1) {
    const angle = TAU * i / 7200;
    const { rocker } = fourBar(angle);
    if (rocker > maxRocker.value) maxRocker = { value: rocker, angle };
    if (rocker < minRocker.value) minRocker = { value: rocker, angle };
  }

  // Click: its tip seats in pocket 0 with the wheel at 0. The tip may be
  // lengthened a few pixels along the drawn finger to phase the pockets.
  const clickAxis = sub(PLATE.clickTip, PLATE.clickPivot);
  const clickTipRaster = (extension) => add(PLATE.clickTip,
    [clickAxis[0] / len(clickAxis) * extension, clickAxis[1] / len(clickAxis) * extension]);
  const pocketFor = (tipRaster) => {
    const reachClick = len(sub(P(...tipRaster), CLICK_PIVOT));
    let pocket = ang(P(...tipRaster));
    for (let i = 0; i < 60; i += 1) {
      const error = len(sub([SEAT_RADIUS * Math.cos(pocket), SEAT_RADIUS * Math.sin(pocket)], CLICK_PIVOT)) - reachClick;
      const e2 = len(sub([SEAT_RADIUS * Math.cos(pocket + 1e-6), SEAT_RADIUS * Math.sin(pocket + 1e-6)], CLICK_PIVOT)) - reachClick;
      pocket -= error / ((e2 - error) / 1e-6);
    }
    return pocket;
  };

  // Catch: the feed screw sets the slider radius (CATCH_HINGE_DROP below
  // Brown's). 9 px is the least setting at which the claw both drives one
  // tooth past the click and drops clear behind the next tooth on the
  // return (checked on the solved motion; 3-8 px fail).
  const reach = len(sub(P(...CATCH_CLAW_TIP), P(...CATCH_HINGE)));
  const strokeAt = (radius, phase) => {
    const low = seatAngle(hingeAt(maxRocker.value, radius), reach);
    const high = seatAngle(hingeAt(minRocker.value, radius), reach);
    // Where the nose passes the tooth tips at the bottom of its return.
    const lowAtTips = seatAngle(hingeAt(maxRocker.value, radius), reach, R_TIP);
    const overtravel = mod(high - phase - SEAT_ANGLE_OFFSET, PITCH);
    return { low, high, lowAtTips, sweep: high - low, overtravel, dropMargin: high - overtravel - PITCH - lowAtTips };
  };
  // The slider stands where the catch's hinge eye is built (CATCH_HINGE);
  // the click is Brown's.
  const sliderRadius = SOURCE_SLIDER_RADIUS + px(CATCH_HINGE_DROP);
  const clickExtension = 0;
  const clickTip = clickTipRaster(clickExtension);
  const clickTipLocal = sub(P(...clickTip), CLICK_PIVOT);
  const clickReach = len(clickTipLocal);
  const pocketAngle = pocketFor(clickTip);
  const mountPhase = pocketAngle - SEAT_ANGLE_OFFSET;
  const clickSeatPoint = [SEAT_RADIUS * Math.cos(pocketAngle), SEAT_RADIUS * Math.sin(pocketAngle)];
  const clickSeatRotation = ang(sub(clickSeatPoint, CLICK_PIVOT)) - ang(clickTipLocal);
  const stroke = strokeAt(sliderRadius, mountPhase);

  const catchOutline = toModel(catchOutlineRaster(), CATCH_HINGE);
  const clickOutline = toModel(clickOutlineRaster(clickTip), PLATE.clickPivot);
  const catchNoseLocal = sub(P(...CATCH_CLAW_TIP), P(...CATCH_HINGE));
  const catchSolver = makeContactSolver(catchOutline, null, -1,
    (point) => len(add(P(...CATCH_HINGE), point)) < R_TIP + px(30));
  const clickSolver = makeContactSolver(clickOutline, null, 1,
    (point) => len(add(CLICK_PIVOT, point)) < R_TIP + px(20));
  const profile = ratchetProfile(mountPhase);
  const window = 0.35;
  // The wheel's clockwise limit against the click where it stands: the
  // carriage load turns the wheel back until a tooth face meets the click.
  let clickRing = clickOutline[0][0].slice(0, -1);
  if (clickRing.reduce((area, q, i) => {
    const r = clickRing[(i + 1) % clickRing.length];
    return area + q[0] * r[1] - r[0] * q[1];
  }, 0) < 0) clickRing = clickRing.slice().reverse();
  clickRing = clickRing.filter((q) => len(add(CLICK_PIVOT, q)) < R_TIP + px(20));
  const clickAngleWorld = ang(P(...clickTip));
  const wheelHold = (beta, current) => {
    const world = clickRing.map((q) => add(CLICK_PIVOT, rot(q, beta)));
    const edges = [];
    for (let i = 0; i + 1 < world.length; i += 1) edges.push([world[i], world[i + 1]]);
    const points = [];
    const localEdges = [];
    for (let i = 0; i < profile.length; i += 1) {
      const q = profile[i];
      const delta = Math.abs(mod(ang(q) + current - clickAngleWorld + Math.PI, TAU) - Math.PI);
      if (delta > window) continue;
      points.push(q);
      localEdges.push([q, profile[(i + 1) % profile.length]]);
    }
    const hold = firstHit([0, 0], points, localEdges, world, edges, current + 1e-5, -1);
    return current - hold > 2 * PITCH ? -Infinity : hold;
  };

  // The pocket at or just above the nose (a seated nose may sit a hair past
  // its seat angle).
  const catchPocket = (theta) => Math.ceil((theta - mountPhase - SEAT_ANGLE_OFFSET) / PITCH - 0.05);
  const noseWorld = (hinge, alpha) => add(hinge, rot(catchNoseLocal, alpha));

  const dt = CRANK_PERIOD / STEPS_PER_REV;
  const total = STEPS_PER_REV * LOOP_REVOLUTIONS;
  const wheel = new Float64Array(total + 1);
  const catchAngle = new Float64Array(total + 1);
  const clickAngle = new Float64Array(total + 1);
  const crankAngle = new Float64Array(total + 1);
  const engaged = new Uint8Array(total + 1);
  const catchGap = new Float64Array(total + 1);
  const clickGap = new Float64Array(total + 1);

  const crankAt = (step) => maxRocker.angle - TAU * step / STEPS_PER_REV;
  const lift = (v) => (v < 0.15 ? smooth(v / 0.15) : v > 0.65 ? smooth((0.8 - v) / 0.15) : 1);
  // Gig-back schedule (one crank turn): lift catch and click, run the
  // carriage back to GL tooth short of the start, lower both onto the
  // teeth, then let the carriage's back load settle the wheel clockwise
  // until the click catches its pocket.
  // Relative to where the wheel rests on the seated click (estimated, then
  // taken from the end of a feed stroke below).
  let clickSeatWheel = wheelHold(clickSeatRotation, 0.5 * PITCH);
  const gigBackWheel = (v, start) => (v < 0.65
    ? clickSeatWheel + PITCH * GL + (start - clickSeatWheel - PITCH * GL) * (1 - smooth((v - 0.2) / 0.45))
    : clickSeatWheel + PITCH * (GL - (GL + 0.18) * smooth((v - 0.8) / 0.15)));

  const simulate = (initial, firstStep = 0) => {
    let { psi, alpha, beta } = initial;
    let omega = 0;
    let gigStart = psi;
    let betaRate = 0;
    const startHinge = hingeAt(fourBar(crankAt(firstStep)).rocker, sliderRadius);
    let pocket = catchPocket(ang(noseWorld(startHinge, alpha)) - psi);
    let catchHand = alpha;
    let clickHand = beta;
    for (let step = firstStep; step <= total; step += 1) {
      const revolution = Math.min(LOOP_REVOLUTIONS - 1, Math.floor(step / STEPS_PER_REV));
      const phase = step / STEPS_PER_REV - revolution;
      const crank = crankAt(step);
      const hinge = hingeAt(fourBar(crank).rocker, sliderRadius);
      let isDriving = false;
      if (revolution < FEED_STROKES) {
        const pocketSeat = mountPhase + SEAT_ANGLE_OFFSET + pocket * PITCH;
        const driven = seatAngle(hinge, reach) - pocketSeat;
        const floor = wheelHold(beta, psi);
        isDriving = driven > floor;
        psi = Math.max(floor, driven);
        // Catch: gravity swings it onto the teeth; contact holds it off them.
        const contact = catchSolver(hinge, psi, profile, alpha, window);
        const free = alpha + omega * dt - (GRAVITY / reach) * dt * dt;
        if (free <= contact) {
          omega = step ? Math.min(3, (contact - alpha) / dt) : 0;
          alpha = contact;
        } else {
          omega -= (GRAVITY / reach) * dt;
          alpha = free;
        }
        const clickContact = clickSolver(CLICK_PIVOT, psi, profile, beta, window);
        const clickFree = beta + betaRate * dt + (GRAVITY / clickReach) * dt * dt;
        if (clickFree >= clickContact) {
          betaRate = step ? Math.max(-3, (clickContact - beta) / dt) : 0;
          beta = clickContact;
        } else {
          betaRate += (GRAVITY / clickReach) * dt;
          beta = clickFree;
        }
        catchGap[step] = alpha - contact;
        clickGap[step] = clickContact - beta;
        catchHand = alpha;
        clickHand = beta;
      } else {
        const prevPsi = psi;
        if (phase === 0) gigStart = psi;
        psi = gigBackWheel(phase, gigStart);
        if (phase >= 0.8) psi = Math.max(psi, wheelHold(beta, prevPsi));
        const contact = catchSolver(hinge, psi, profile, alpha, window);
        // The hand lets each part down past the teeth, so both end resting
        // on them wherever the lift began.
        const letDown = 0.15 * smooth((phase - 0.65) / 0.15);
        alpha = Math.max(contact, catchHand + 0.3 * lift(phase) - letDown);
        const clickContact = clickSolver(CLICK_PIVOT, psi, profile, beta, window);
        beta = Math.min(clickContact, clickHand - 0.3 * lift(phase) + letDown);
        omega = 0;
        betaRate = 0;
        catchGap[step] = alpha - contact;
        clickGap[step] = clickContact - beta;
      }
      pocket = catchPocket(ang(noseWorld(hinge, alpha)) - psi);
      wheel[step] = psi;
      catchAngle[step] = alpha;
      clickAngle[step] = beta;
      crankAngle[step] = crank;
      engaged[step] = isDriving ? 1 : 0;
    }
    return { psi, alpha, beta };
  };
  // A first pass through the gig-back alone gives the settled state it
  // leaves; the recorded loop starts from that state, so its end (after its
  // own gig-back) matches its start.
  const gigStep = FEED_STROKES * STEPS_PER_REV;
  // Where the wheel rests on the click at the end of a feed stroke.
  const solution0Seat = () => wheel[2 * STEPS_PER_REV] - 2 * PITCH;
  const gigHinge = hingeAt(fourBar(crankAt(gigStep)).rocker, sliderRadius);
  const settled = simulate({
    psi: FEED_STROKES * PITCH,
    alpha: catchSolver(gigHinge, FEED_STROKES * PITCH, profile, 0.3, window),
    beta: clickSolver(CLICK_PIVOT, FEED_STROKES * PITCH, profile, clickSeatRotation - 0.3, window),
  }, gigStep);
  simulate(settled);
  clickSeatWheel = solution0Seat();
  const settledAgain = simulate({
    psi: FEED_STROKES * PITCH,
    alpha: catchSolver(gigHinge, FEED_STROKES * PITCH, profile, 0.3, window),
    beta: clickSolver(CLICK_PIVOT, FEED_STROKES * PITCH, profile, clickSeatRotation - 0.3, window),
  }, gigStep);
  const loopStart = { ...settledAgain };
  const loopEnd = simulate(settledAgain);
  const catchStart = loopStart.alpha;
  const clickStart = loopStart.beta;

  cachedSolution = {
    catchAngle,
    catchNoseLocal,
    catchOutline,
    catchStart,
    catchGap,
    loopEnd,
    loopStart,
    clickAngle,
    clickGap,
    clickOutline,
    clickSeatRotation,
    clickStart,
    crankAngle,
    dt,
    engaged,
    maxRockerCrank: maxRocker.angle,
    minRockerCrank: minRocker.angle,
    clickExtension,
    mountPhase,
    reach,
    sliderRadius,
    stroke,
    total,
    wheel,
  };
  return cachedSolution;
}

// ------------------------------------------------------------------ model

function smoothPlate(polygons, low, high) {
  const extruded = plate(polygons, low, high);
  extruded.deleteAttribute('normal');
  extruded.deleteAttribute('uv');
  const geometry = mergeVertices(extruded, 1e-7);
  extruded.dispose();
  creaseIndexedNormals(geometry, Math.PI / 5);
  return geometry;
}

function box(x0, y0, x1, y1) {
  return poly([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]);
}

function cylinderZ(radius, low, high, material, segments = 48) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, high - low, segments), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.z = (low + high) / 2;
  return mesh;
}

function hullOfCircles(a, ra, b, rb, count = 64) {
  // Outline of two circles joined by their outer tangents.
  const d = sub(b, a);
  const dist = len(d);
  const base = ang(d);
  const phi = Math.acos((ra - rb) / dist);
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const t = base + phi + (TAU - 2 * phi) * i / count;
    points.push(add(a, [ra * Math.cos(t), ra * Math.sin(t)]));
  }
  for (let i = 0; i <= count; i += 1) {
    const t = base - phi + 2 * phi * i / count;
    points.push(add(b, [rb * Math.cos(t), rb * Math.sin(t)]));
  }
  return poly(points);
}

function crankRockerPullCatchSawFeed(movement) {
  const solution = solveFeed();
  const root = new THREE.Group();
  const mat = (color, roughness = 0.6) => matte(color, { metalness: 0.13, roughness });
  const frameMaterial = mat(PALETTE.frame, 0.68);
  const carriageMaterial = mat(PALETTE.muted, 0.7);
  const rackMaterial = mat(PALETTE.driven, 0.6);
  const wheelMaterial = mat(PALETTE.driven, 0.58);
  const leverMaterial = mat(PALETTE.driven, 0.56);
  const driverMaterial = mat(PALETTE.driver, 0.57);
  const pawlMaterial = mat(PALETTE.accent, 0.55);
  const inkMaterial = mat(PALETTE.ink, 0.48);
  const named = (mesh, role) => { mesh.userData.role = role; return mesh; };

  // Planes (z): posts and carriage behind, rack and pinion, the shaft
  // hanger, then the ratchet, catch and click in one plane; the bell crank
  // and crank just behind that plane, the rod in front of the rack.
  const Z = {
    carriage: [-0.60, -0.20], leftPost: [-1.00, -0.62], rack: [-0.20, 0.06], pinion: [-0.18, 0.06],
    hanger: [0.08, 0.16], wheel: [0.18, 0.34], lever: [0.00, 0.16], rod: [0.18, 0.30],
  };

  // Fixed frame: the left post behind the carriage, the right post under it.
  const frame = new THREE.Group();
  frame.userData.role = 'fixed-saw-feed-frame';
  root.add(frame);
  const leftPost = named(new THREE.Mesh(smoothPlate(box(61, 80, 109, 506), ...Z.leftPost), frameMaterial),
    'left-frame-post-behind-carriage');
  const rightPost = named(new THREE.Mesh(smoothPlate(box(455, 400, 505, 506), ...Z.carriage), frameMaterial),
    'right-frame-post-under-carriage');
  // Bracket carrying fulcrum a off the left post, behind the bell crank.
  const fulcrumBracket = named(new THREE.Mesh(smoothPlate(clip.union(box(100, 112, 141, 132),
    poly(circle(P(...PLATE.fulcrumA), px(10), 48))), Z.leftPost[1], -0.02), frameMaterial),
  'fulcrum-bracket-on-left-post');
  // Shaft hanger: a flat arm from under the carriage (bolted to the left
  // post, whose foot block is also the carriage's left way) up to the
  // ratchet shaft, between the pinion and the ratchet.
  const hangerFoot = [85, 416];
  const hangerOutline = clip.difference(clip.union(
    hullOfCircles(P(...PLATE.ratchetCenter), px(14), P(...hangerFoot), px(13)),
    box(61, 400, 109, 432)), poly(circle([0, 0], px(12) + 0.004, 48)));
  const hanger = named(new THREE.Mesh(smoothPlate(hangerOutline, ...Z.hanger), frameMaterial),
    'ratchet-shaft-hanger');
  const hangerBlock = named(new THREE.Mesh(smoothPlate(box(61, 400, 109, 432), Z.leftPost[1], Z.hanger[0]),
    frameMaterial), 'hanger-foot-and-carriage-way-on-left-post');
  // Crank shaft bearing plate on the right post's face.
  const crankBearing = named(new THREE.Mesh(smoothPlate(clip.difference(clip.union(box(443, 410, 467, 495),
    poly(circle(INPUT, px(19), 64))), poly(circle(INPUT, px(10) + 0.004, 48))), Z.carriage[1], -0.10), frameMaterial),
  'input-crank-shaft-bearing-plate');
  frame.add(leftPost, rightPost, fulcrumBracket, hanger, hangerBlock, crankBearing);

  // Carriage (saw bed) with the rack on its side. Brown breaks the bed off at
  // both plate edges; it is modelled whole, ending just beyond them.
  const carriage = new THREE.Group();
  carriage.userData.role = 'translating-saw-bed-carriage-with-side-rack';
  root.add(carriage);
  const bed = named(new THREE.Mesh(smoothPlate(box(12, 270, 518, 400), ...Z.carriage), carriageMaterial),
    'saw-bed-carriage');
  const bedRail = named(new THREE.Mesh(smoothPlate(box(12, 270, 518, 283), Z.carriage[1], Z.carriage[1] + 0.06),
    carriageMaterial), 'saw-bed-top-rail');
  const rackPitchY = PINION_PITCH_RADIUS;
  const rackRootY = rackPitchY + RACK_ADDENDUM + 0.006;
  const rackBar = named(new THREE.Mesh(smoothPlate(poly([
    [P(27, 0)[0], P(0, 283)[1]], [P(490, 0)[0], P(0, 283)[1]],
    [P(490, 0)[0], rackRootY], [P(27, 0)[0], rackRootY]]), ...Z.rack), rackMaterial), 'carriage-rack-bar');
  carriage.add(bed, bedRail, rackBar);
  const rackTooth = rackToothGeometry({ pitch: RACK_PITCH, addendum: RACK_ADDENDUM, depth: Z.rack[1] - Z.rack[0] });
  const rackTeeth = [];
  for (let i = -4; i <= 14; i += 1) {
    const x = i * RACK_PITCH;
    if (x < P(27, 0)[0] + RACK_PITCH / 2 || x > P(490, 0)[0] - RACK_PITCH / 2) continue;
    const tooth = named(new THREE.Mesh(rackTooth, rackMaterial), 'downward-carriage-rack-tooth');
    tooth.position.set(x, rackPitchY, (Z.rack[0] + Z.rack[1]) / 2);
    tooth.rotation.z = Math.PI;
    rackTeeth.push(tooth);
    carriage.add(tooth);
  }

  // Ratchet, pinion and shaft turn together.
  const ratchet = new THREE.Group();
  ratchet.userData.role = 'large-one-way-saw-feed-ratchet-wheel';
  ratchet.userData.axis = new THREE.Vector3(0, 0, 1);
  root.add(ratchet);
  const profile = ratchetProfile(solution.mountPhase);
  const shaftRadius = px(12);
  const maxCrankAngle = solution.maxRockerCrank;
  // Display time 0 is Brown's pose (horizontal arm) in the third stroke.
  const sourceTimeOffset = 2 * CRANK_PERIOD
    + mod(maxCrankAngle - SOURCE_CRANK_ANGLE, TAU) / TAU * CRANK_PERIOD;
  const sourceWheelAngle = (() => {
    const x = sourceTimeOffset / solution.dt;
    const i = Math.floor(x);
    return solution.wheel[i] * (1 - (x - i)) + solution.wheel[i + 1] * (x - i);
  })();
  const ratchetBody = named(new THREE.Mesh(spokedWheelGeometry({
    outline: profile,
    spokes: 4,
    // Brown's spokes stand at 45 degrees in his pose (display time 0).
    phase: Math.PI / 4 - sourceWheelAngle,
    rimInnerRadius: px(PLATE.ratchetRimInnerRadius),
    spokeWidth: px(PLATE.ratchetSpokeWidth),
    hubArcRadius: px(PLATE.ratchetHubRadius),
    hubFillet: px(3),
    rimFillet: px(3),
    boreRadius: shaftRadius + 0.004,
    thickness: Z.wheel[1] - Z.wheel[0],
  }), wheelMaterial), 'forty-four-tooth-four-spoke-ratchet');
  ratchetBody.position.z = (Z.wheel[0] + Z.wheel[1]) / 2;
  ratchetBody.userData.noRotationIndicator = true;
  const pinion = named(new THREE.Mesh(rackPinionGeometry({
    radius: PINION_PITCH_RADIUS, teeth: PLATE.pinionTeeth, addendum: RACK_ADDENDUM,
    depth: Z.pinion[1] - Z.pinion[0], bore: shaftRadius + 0.004,
  }), wheelMaterial), 'eight-tooth-feed-pinion');
  // A pinion tooth space sits under the rack tooth above the shaft.
  pinion.rotation.z = Math.PI / 2 + Math.PI / PLATE.pinionTeeth;
  pinion.position.z = (Z.pinion[0] + Z.pinion[1]) / 2;
  const shaft = named(cylinderZ(shaftRadius, Z.pinion[0] - 0.01, Z.wheel[1] + 0.06, inkMaterial),
    'ratchet-and-pinion-shaft');
  ratchet.add(ratchetBody, pinion, shaft);

  // Bell crank: the arm to the rod and the slotted vertical arm, one plate.
  const bellCrank = new THREE.Group();
  bellCrank.userData.role = 'adjustable-bell-crank-lever';
  bellCrank.userData.axis = new THREE.Vector3(0, 0, 1);
  bellCrank.position.set(FULCRUM[0], FULCRUM[1], 0);
  root.add(bellCrank);
  const local = (polygons) => polygons.map((polygon) => polygon.map((ringPoints) => ringPoints.map(
    (point) => sub(point, FULCRUM))));
  const leverOutline = clip.difference(clip.union(
    hullOfCircles(P(150, 122.5), px(7.5), P(...PLATE.rockerJoint), px(11)),
    box(122, 100, 164, 232)),
  box(130, 134, 157, 224),
  poly(circle(P(...PLATE.fulcrumA), px(4.5) + 0.004, 48)),
  poly(circle(P(...PLATE.rockerJoint), px(4.5) + 0.004, 48)),
  poly(circle(P(141, 94), px(6) + 0.004, 32)));
  const lever = named(new THREE.Mesh(smoothPlate(local(leverOutline), ...Z.lever), leverMaterial),
    'bell-crank-arm-and-slotted-screw-frame');
  // Feed screw: eye head above the frame, the threaded rod in the slot, the
  // nut-slider carrying the catch hinge. Only its setting (the slider
  // radius) matters to the motion.
  const sliderY = FULCRUM[1] - solution.sliderRadius;
  const sliderRasterY = O_PX[1] - sliderY / SCALE;
  const screwHead = named(new THREE.Mesh(smoothPlate(local(clip.difference(clip.union(
    poly(circle(P(141, 75), px(12), 64)), box(137, 80, 145, 100)),
  poly(circle(P(141, 75), px(5), 48)))), 0.04, 0.12), inkMaterial), 'feed-screw-eye-head');
  const slider = named(new THREE.Mesh(smoothPlate(local(box(130, sliderRasterY - 10.5, 157, sliderRasterY + 10.5)),
    ...Z.lever), inkMaterial), 'screw-set-catch-slider');
  const screwMaterial = mat(PALETTE.brass, 0.5);
  const rodBetween = (y0, y1, role) => {
    const a = P(141, y0);
    const b = P(141, y1);
    const mesh = named(new THREE.Mesh(new THREE.CylinderGeometry(px(6), px(6), Math.abs(a[1] - b[1]), 32),
      screwMaterial), role);
    mesh.position.set(a[0] - FULCRUM[0], (a[1] + b[1]) / 2 - FULCRUM[1], 0.08);
    return mesh;
  };
  const screwUpper = rodBetween(134, sliderRasterY - 10.5, 'feed-screw-upper-thread');
  const screwLower = rodBetween(sliderRasterY + 10.5, 224, 'feed-screw-lower-thread');
  const fulcrumPin = named(cylinderZ(px(4.5), Z.leftPost[1] + 0.3, Z.lever[1] + 0.05, inkMaterial), 'fulcrum-a-pin');
  fulcrumPin.position.set(0, 0, fulcrumPin.position.z);
  const hingeLocal = [0, -solution.sliderRadius];
  const hingePin = named(cylinderZ(px(4.2), Z.lever[1], Z.wheel[1] + 0.04, inkMaterial), 'catch-hinge-pin');
  hingePin.position.set(hingeLocal[0], hingeLocal[1], hingePin.position.z);
  const hingeCap = named(cylinderZ(px(6.5), Z.wheel[1], Z.wheel[1] + 0.04, inkMaterial), 'catch-hinge-cap');
  hingeCap.position.set(hingeLocal[0], hingeLocal[1], hingeCap.position.z);
  const rodPinLocal = sub(P(...PLATE.rockerJoint), FULCRUM);
  const rodPin = named(cylinderZ(px(4.5), Z.lever[0], Z.rod[1] + 0.03, inkMaterial), 'rocker-rod-pin');
  rodPin.position.set(rodPinLocal[0], rodPinLocal[1], rodPin.position.z);
  bellCrank.add(lever, screwHead, slider, screwUpper, screwLower, hingePin, hingeCap, rodPin);
  // The fulcrum pin is fixed in the bracket; the bell crank turns on it.
  fulcrumPin.position.set(FULCRUM[0], FULCRUM[1], fulcrumPin.position.z);
  root.add(fulcrumPin);

  // Catch (the pulling hook) in the ratchet plane.
  const catchGroup = new THREE.Group();
  catchGroup.userData.role = 'pulling-catch-hung-from-bell-crank';
  catchGroup.userData.axis = new THREE.Vector3(0, 0, 1);
  root.add(catchGroup);
  const catchBody = named(new THREE.Mesh(smoothPlate(solution.catchOutline, ...Z.wheel), pawlMaterial),
    'scroll-catch-with-pulling-claw');
  catchGroup.add(catchBody);

  // Click (holding pawl) on its pin in the left post.
  const click = new THREE.Group();
  click.userData.role = 'holding-click-against-clockwise-return';
  click.userData.axis = new THREE.Vector3(0, 0, 1);
  click.position.set(CLICK_PIVOT[0], CLICK_PIVOT[1], 0);
  root.add(click);
  const clickBody = named(new THREE.Mesh(smoothPlate(solution.clickOutline, ...Z.wheel), pawlMaterial),
    'holding-click-body');
  click.add(clickBody);
  const clickPin = named(cylinderZ(px(4) - 0.004, Z.leftPost[1], Z.wheel[1] + 0.04, inkMaterial), 'click-pivot-pin');
  const clickCap = named(cylinderZ(px(6), Z.wheel[1], Z.wheel[1] + 0.04, inkMaterial), 'click-pin-cap');
  for (const mesh of [clickPin, clickCap]) {
    mesh.position.set(CLICK_PIVOT[0], CLICK_PIVOT[1], mesh.position.z);
    root.add(mesh);
  }

  // Input crank (tapered arm) on its shaft in the right post's bearing.
  const inputCrank = new THREE.Group();
  inputCrank.userData.role = 'continuously-revolving-input-crank';
  inputCrank.userData.axis = new THREE.Vector3(0, 0, 1);
  inputCrank.position.set(INPUT[0], INPUT[1], 0);
  root.add(inputCrank);
  const crankArm = named(new THREE.Mesh(smoothPlate(clip.difference(
    hullOfCircles([0, 0], px(20), [CRANK_RADIUS, 0], px(12)),
    poly(circle([CRANK_RADIUS, 0], px(4.5) + 0.004, 48))), ...Z.lever), driverMaterial), 'tapered-input-crank-arm');
  const crankShaft = named(cylinderZ(px(10), Z.carriage[1] + 0.01, Z.lever[1] + 0.01, inkMaterial),
    'input-crank-shaft');
  const crankPin = named(cylinderZ(px(4.5), Z.lever[0], Z.rod[1] + 0.03, inkMaterial), 'input-crank-pin');
  crankPin.position.set(CRANK_RADIUS, 0, crankPin.position.z);
  inputCrank.add(crankArm, crankShaft, crankPin);

  // Connecting rod: a slender bar with an eye at each end.
  const connectingRod = new THREE.Group();
  connectingRod.userData.role = 'crank-to-bell-crank-connecting-rod';
  root.add(connectingRod);
  const rodBody = named(new THREE.Mesh(smoothPlate(clip.difference(clip.union(
    hullOfCircles([0, 0], px(4), [ROD_LENGTH, 0], px(4)),
    poly(circle([0, 0], px(9), 48)), poly(circle([ROD_LENGTH, 0], px(9), 48))),
  poly(circle([0, 0], px(4.5) + 0.004, 32)), poly(circle([ROD_LENGTH, 0], px(4.5) + 0.004, 32))), ...Z.rod),
  driverMaterial), 'connecting-rod-with-eyes');
  connectingRod.add(rodBody);

  const stateAtTime = (time) => {
    const loopTime = mod(time + sourceTimeOffset, LOOP_PERIOD);
    const x = loopTime / solution.dt;
    const i = Math.min(solution.total - 1, Math.floor(x));
    const f = x - i;
    const lerp = (array) => array[i] * (1 - f) + array[i + 1] * f;
    const wheelAngle = lerp(solution.wheel);
    const crank = maxCrankAngle - TAU * (loopTime / CRANK_PERIOD);
    const bar = fourBar(crank);
    const hinge = hingeAt(bar.rocker, solution.sliderRadius);
    const catchAngle = lerp(solution.catchAngle);
    const nose = add(hinge, rot(solution.catchNoseLocal, catchAngle));
    return {
      catchAngle,
      catchGap: solution.catchGap[i],
      clickAngle: lerp(solution.clickAngle),
      clickGap: solution.clickGap[i],
      crankAngle: crank,
      crankPin: bar.pin,
      driving: solution.engaged[i] === 1,
      gigBack: loopTime >= FEED_STROKES * CRANK_PERIOD,
      hinge,
      loopTime,
      nose,
      rackX: -PINION_PITCH_RADIUS * wheelAngle,
      rockerAngle: bar.rocker,
      rockerJoint: bar.joint,
      wheelAngle,
      wheelTeethAdvanced: wheelAngle / PITCH,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    inputCrank.rotation.z = state.crankAngle;
    bellCrank.rotation.z = state.rockerAngle;
    catchGroup.position.set(state.hinge[0], state.hinge[1], 0);
    catchGroup.rotation.z = state.catchAngle;
    click.rotation.z = state.clickAngle;
    ratchet.rotation.z = state.wheelAngle;
    carriage.position.x = state.rackX;
    connectingRod.position.set(state.crankPin[0], state.crankPin[1], 0);
    connectingRod.rotation.z = ang(sub(state.rockerJoint, state.crankPin));
    root.userData.kinematics = state;
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    bed, bellCrank, carriage, catchBody, catchGroup, click, clickBody, clickPin, connectingRod, crankArm,
    crankBearing, fulcrumBracket, hanger, hangerBlock, inputCrank, lever, leftPost, pinion, rackBar, rackTeeth,
    ratchet, ratchetBody, rightPost, shaft, slider,
  };
  root.userData.geometry = {
    crankPeriod: CRANK_PERIOD,
    crankRadius: CRANK_RADIUS,
    feedStrokes: FEED_STROKES,
    loopPeriod: LOOP_PERIOD,
    mountPhase: solution.mountPhase,
    // Measured: how far past the click's seat the catch drives the wheel.
    overtravel: (() => {
      const perRev = STEPS_PER_REV;
      let peak = -Infinity;
      for (let i = perRev; i <= 2 * perRev; i += 1) peak = Math.max(peak, solution.wheel[i]);
      return peak - solution.wheel[2 * perRev];
    })(),
    pinionPitchRadius: PINION_PITCH_RADIUS,
    pinionTeeth: PLATE.pinionTeeth,
    rackPitch: RACK_PITCH,
    ratchetPitch: PITCH,
    ratchetRootRadius: R_ROOT,
    ratchetTeeth: N_TEETH,
    ratchetTipRadius: R_TIP,
    rockerLength: ROCKER_LENGTH,
    rodLength: ROD_LENGTH,
    sliderRadius: solution.sliderRadius,
    sourceScale: SCALE,
    sourceSliderRadius: SOURCE_SLIDER_RADIUS,
    catchHingeDrop: CATCH_HINGE_DROP,
    catchClawTipRaster: CATCH_CLAW_TIP,
    catchSweep: solution.stroke.sweep,
  };
  root.userData.solution = solution;
  root.userData.stateAtTime = stateAtTime;
  root.userData.ratchetProfile = profile;
  root.userData.mechanism =
    'a continuously turning lower crank rocks the bell crank about fulcrum a through a long rod; the catch hung from the screw-set slider on its vertical arm pulls the ratchet anticlockwise one tooth per turn and drops behind the next tooth on the return, while the click at the upper left holds the wheel against clockwise return; the pinion on the ratchet shaft feeds the carriage rack to the left, and after eight strokes catch and click are lifted and the carriage is run back (gig-back) so the loop closes';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 284 page marks its animation unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.reconstructionNote =
    'Catch, click and wheel follow a contact solve on the actual outlines: the catch and click fall under gravity onto the teeth and are held off them by contact; the catch drives only when seated in a pocket. The wheel is held on the click by the carriage load on the return. The gig-back (lifting catch and click and running the carriage back) is the sawyer\'s action, not described by Brown; it closes the animation loop.';
  root.userData.animationTiming = { authoredCyclePeriod: LOOP_PERIOD };
  root.userData.minimumDisplayCycleSeconds = LOOP_PERIOD;
  root.userData.hideGround = true;
  root.userData.cameraFov = 8;
  const min = P(-30, 512);
  const max = P(520, 58);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(min[0], min[1], -1.0), new THREE.Vector3(max[0], max[1], 0.4));
  update(0);
  markShadows(root);
  return {
    root,
    update,
    // Brown draws a flat front elevation.
    cameraDirection: new THREE.Vector3(0, 0, 14),
  };
}

export function createAuthoredSawFeedMovement(movement) {
  if (movement.id !== 284) return null;
  const result = crankRockerPullCatchSawFeed(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
