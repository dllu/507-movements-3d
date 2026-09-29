// 370's click: Brown's S-shaped eccentric rod. It lies in the ratchet's own
// plane behind the long bar. Its strap rides an eccentric keyed on the
// crankpin's rear end (rigid with the crankshaft), so relative to the bar the
// strap centre E circles the bar's top eye with the eccentric's throw. From
// the strap the rod runs down the bar, passes a loose keeper on the bar's
// back, bends left over the top of the ratchet and back down (the S), and its
// hooked end lies along a tooth flank with its nose cut to the valley. The
// rod's weight hangs the hook against the teeth: going down, the nose drives
// a tooth face and turns the wheel anticlockwise; going up, it rides up the
// flank, passes the tip and drops into the next root.
//
// Everything here is planar, in the bar's frame (origin at the top eye, y up
// the bar, x across it). The rod is described in a reference pose (strap
// centre at eRef, rotation 0) in which its nose sits seated in root 0 of the
// wheel at wheel angle 0.
import { poly, circle, polygonClipping as clip } from './finite-plate-geometry.js';
import { sawRatchetOutline } from './seated-ratchet-click.js';

const TAU = 2 * Math.PI;
const rotate = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const norm = (v) => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };

function insideRing(p, ring) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
function segmentsCross(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
// Mitred outward offset of a counterclockwise ring.
function grow(points, distance) {
  const n = points.length;
  const normals = points.map((p, i) => {
    const q = points[(i + 1) % n];
    const e = norm([q[0] - p[0], q[1] - p[1]]);
    return [e[1], -e[0]];
  });
  return points.map((p, i) => {
    const a = normals[(i + n - 1) % n], b = normals[i];
    const k = distance / (1 + a[0] * b[0] + a[1] * b[1]);
    return [p[0] + (a[0] + b[0]) * k, p[1] + (a[1] + b[1]) * k];
  });
}

// Centreline of the S from the strap centre down to the hook's round tip: a
// straight run down the bar, arc A turning left over the wheel, a level
// crossing, arc B curling down and back in (Brown's hook), and a short
// straight stem entering the tooth valley along its bisector.
function sCentreline({ eRef, tipCentre, inward, stemLength, crossingY, bendRadius, samples = 48 }) {
  const h1 = Math.atan2(inward[1], inward[0]);
  const s0 = [tipCentre[0] - inward[0] * stemLength, tipCentre[1] - inward[1] * stemLength];
  // Arc B, anticlockwise from heading 180 degrees (level, leftward) to h1.
  const rB = (crossingY - s0[1]) / (1 + Math.cos(h1));
  const b0 = [s0[0] - rB * Math.sin(h1), crossingY];
  const cB = [b0[0], b0[1] - rB];
  const rA = Math.min(bendRadius, eRef[0] - b0[0]);
  if (!(rA > 0) || !(rB > 0)) throw new RangeError('S-link arcs do not fit');
  const cA = [eRef[0] - rA, crossingY + rA];
  const aTop = [eRef[0], cA[1]];
  const points = [];
  const line = (p, q, n) => { for (let i = 0; i < n; i += 1) points.push([p[0] + (q[0] - p[0]) * i / n, p[1] + (q[1] - p[1]) * i / n]); };
  line(eRef, aTop, samples);
  // Arc A, travelling down: from angle 0 about cA to -90 degrees.
  for (let i = 0; i < samples; i += 1) {
    const a = -Math.PI / 2 * i / samples;
    points.push([cA[0] + rA * Math.cos(a), cA[1] + rA * Math.sin(a)]);
  }
  line([cA[0], crossingY], b0, samples);
  // Arc B: b0 is at angle 90 degrees about cB; travelling anticlockwise to
  // heading h1 ends at angle h1 - 90 degrees (+ 360).
  const a0 = Math.PI / 2;
  let a1 = h1 - Math.PI / 2;
  while (a1 <= a0) a1 += 2 * Math.PI;
  for (let i = 0; i < samples * 2; i += 1) {
    const a = a0 + (a1 - a0) * i / (samples * 2);
    points.push([cB[0] + rB * Math.cos(a), cB[1] + rB * Math.sin(a)]);
  }
  line(s0, tipCentre, samples / 2);
  points.push(tipCentre);
  return { points, rA, rB, cA, cB, aTop, b0, s0, tipCentre };
}

function offsetBand(centre, width) {
  const left = [], right = [];
  const last = centre.length - 1;
  for (let i = 0; i <= last; i += 1) {
    const a = centre[Math.max(0, i - 1)], b = centre[Math.min(last, i + 1)];
    const t = norm([b[0] - a[0], b[1] - a[1]]);
    const n = [-t[1], t[0]];
    left.push([centre[i][0] + n[0] * width / 2, centre[i][1] + n[1] * width / 2]);
    right.push([centre[i][0] - n[0] * width / 2, centre[i][1] - n[1] * width / 2]);
  }
  return poly([...left, ...right.reverse()]);
}

export function buildMirrorSLink({
  wheelCentre, radius, rootRadius, teeth, rake, rootAngle,
  eRef, discRadius, strapClearance = 0.005, strapWidth, width,
  stemLength, crossingY, bendRadius, tipClearance = 0.004,
}) {
  const wheel = sawRatchetOutline({ radius, rootRadius, teeth, hand: 1, rootAngle, rake });
  const pitch = TAU / teeth;
  const C = wheelCentre;
  const at = (r, a) => [C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)];
  const root = at(rootRadius, rootAngle);
  const tipBehind = at(radius, rootAngle - (1 - rake) * pitch);
  const tipAhead = at(radius, rootAngle + rake * pitch);
  const flank = norm([tipBehind[0] - root[0], tipBehind[1] - root[1]]);
  const face = norm([tipAhead[0] - root[0], tipAhead[1] - root[1]]);
  const bisector = norm([face[0] + flank[0], face[1] + flank[1]]);
  // The hook ends in a round tip of half the rod's width; seated, it touches
  // both the face and the flank (less a hair of clearance). A circle in the
  // valley seats the same whatever the rod's angle, so the hook stays seated
  // while the wheel turns under it.
  const tipRadius = width / 2;
  const halfValley = Math.acos(face[0] * flank[0] + face[1] * flank[1]) / 2;
  const reach = (tipRadius + tipClearance) / Math.sin(halfValley);
  const tipCentre = [root[0] + bisector[0] * reach, root[1] + bisector[1] * reach];
  const inward = [-bisector[0], -bisector[1]];
  const path = sCentreline({ eRef, tipCentre, inward, stemLength, crossingY, bendRadius });
  const strapInner = discRadius + strapClearance;
  const strapOuter = strapInner + strapWidth;
  const polygons = clip.difference(
    clip.union(
      offsetBand(path.points, width),
      poly(circle(tipCentre, tipRadius, 64)),
      poly(circle(eRef, strapOuter, 128)),
    ),
    poly(circle(eRef, strapInner, 128)),
  );
  // Wheel outline (wheel frame, centred on the axis) with a hair of running
  // clearance, and the rod's outer ring.
  const wheelRing = grow(wheel.outline, 0.0015);
  const rodRing = polygons[0][0].slice(0, -1);
  return {
    wheel, pitch, nose: tipCentre, tipCentre, tipRadius, flank, face, bisector,
    path, polygons, rodRing, wheelRing, strapInner, strapOuter, root,
  };
}

// Pose helpers. A rod pose is (e, beta): the strap centre in the bar frame and
// the rod's rotation from its reference pose about that centre.
export function makeSLinkSolver(link, { wheelCentre, eRef }) {
  const C = wheelCentre;
  const { rodRing, wheelRing, wheel, pitch } = link;
  const reach = (wheel.radius + 0.01) ** 2;
  const edgeReach = (wheel.radius + 0.03) ** 2;
  // Only the rod's hook end can reach the wheel: test the part of its outer
  // ring within 0.45 of the wheel's rim in the reference pose (its edges and
  // vertices), which covers every swing the drive makes.
  const nearIndex = [];
  rodRing.forEach((p, i) => { if (Math.hypot(p[0] - C[0], p[1] - C[1]) < wheel.radius + 0.45) nearIndex.push(i); });
  const nearSet = new Set(nearIndex);
  const nearEdges = nearIndex.filter((i) => nearSet.has((i + 1) % rodRing.length));
  const rel = rodRing.map((p) => [p[0] - eRef[0], p[1] - eRef[1]]);
  const noseRel = [link.nose[0] - eRef[0], link.nose[1] - eRef[1]];
  const noseRadius = Math.hypot(link.nose[0] - C[0], link.nose[1] - C[1]);
  const noseAngle0 = Math.atan2(link.nose[1] - C[1], link.nose[0] - C[0]);
  const place = (p, e, beta) => { const q = rotate(p, beta); return [e[0] + q[0], e[1] + q[1]]; };
  const nosePoint = (e, beta) => place(noseRel, e, beta);
  // Near points transformed into the wheel frame (reused buffers).
  const slot = new Int32Array(rodRing.length).fill(-1);
  nearIndex.forEach((i, n) => { slot[i] = n; });
  const nearX = new Float64Array(nearIndex.length), nearY = new Float64Array(nearIndex.length);
  const edgeA = Int32Array.from(nearEdges, (i) => slot[i]);
  const edgeB = Int32Array.from(nearEdges, (i) => slot[(i + 1) % rodRing.length]);
  const wx = Float64Array.from(wheelRing, (p) => p[0]), wy = Float64Array.from(wheelRing, (p) => p[1]);
  const wn = wheelRing.length;
  const insideWheel = (x, y) => {
    let result = false;
    for (let i = 0, j = wn - 1; i < wn; j = i, i += 1) {
      if ((wy[i] > y) !== (wy[j] > y) && x < (wx[j] - wx[i]) * (y - wy[i]) / (wy[j] - wy[i]) + wx[i]) result = !result;
    }
    return result;
  };
  const orient = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  // Does the rod at (e, beta) overlap the wheel turned by w? (A thin rod
  // cannot swallow a whole tooth, so vertex-inside and edge-crossing tests
  // on the hook end are complete.)
  const overlaps = (e, beta, w) => {
    const c = Math.cos(beta), s = Math.sin(beta), cw = Math.cos(-w), sw = Math.sin(-w);
    for (let n = 0; n < nearIndex.length; n += 1) {
      const p = rel[nearIndex[n]];
      const x = e[0] + p[0] * c - p[1] * s - C[0], y = e[1] + p[0] * s + p[1] * c - C[1];
      const qx = x * cw - y * sw, qy = x * sw + y * cw;
      if (qx * qx + qy * qy < reach && insideWheel(qx, qy)) return true;
      nearX[n] = qx; nearY[n] = qy;
    }
    for (let m = 0; m < edgeA.length; m += 1) {
      const ax = nearX[edgeA[m]], ay = nearY[edgeA[m]], bx = nearX[edgeB[m]], by = nearY[edgeB[m]];
      // Skip an edge wholly outside the tips' circle grown by 0.03: rod
      // ring edges near the wheel are at most 0.1 long, so their chords sag
      // under 0.003 and cannot dip in.
      if (ax * ax + ay * ay > edgeReach && bx * bx + by * by > edgeReach) continue;
      for (let j = 0; j < wn; j += 1) {
        const k = (j + 1) % wn;
        const d1 = orient(wx[j], wy[j], wx[k], wy[k], ax, ay), d2 = orient(wx[j], wy[j], wx[k], wy[k], bx, by);
        if ((d1 > 0) === (d2 > 0)) continue;
        const d3 = orient(ax, ay, bx, by, wx[j], wy[j]), d4 = orient(ax, ay, bx, by, wx[k], wy[k]);
        if ((d3 > 0) !== (d4 > 0)) return true;
      }
    }
    return false;
  };
  // Least lift (largest inward beta) that clears the wheel. Inward
  // (positive beta) swings the hook toward the axis.
  const rest = (e, w, start) => {
    let low = start, high = start;
    if (overlaps(e, start, w)) {
      do { high = low; low -= 0.01; if (low < start - 0.4) throw new RangeError('S-link cannot clear the ratchet'); } while (overlaps(e, low, w));
    } else {
      do { low = high; high += 0.01; if (high > start + 0.4) return low; } while (!overlaps(e, high, w));
    }
    for (let i = 0; i < 26; i += 1) { const mid = (low + high) / 2; if (overlaps(e, mid, w)) high = mid; else low = mid; }
    return low;
  };
  // Rotation that puts the nose back on its seated radius for strap centre e.
  const seatBeta = (e, guess) => {
    const f = (beta) => { const n = nosePoint(e, beta); return Math.hypot(n[0] - C[0], n[1] - C[1]) - noseRadius; };
    // Come in from outside to the first (left-side) crossing of the seat.
    let a = guess - 0.25;
    if (f(a) <= 0) throw new RangeError('S-link seat not bracketed');
    let b = a;
    while (f(b) > 0) { a = b; b += 0.01; if (b > guess + 0.5) throw new RangeError('S-link seat not reached'); }
    for (let i = 0; i < 50; i += 1) { const m = (a + b) / 2; if (f(m) > 0) a = m; else b = m; }
    return (a + b) / 2;
  };
  const noseAngle = (e, beta) => { const n = nosePoint(e, beta); return Math.atan2(n[1] - C[1], n[0] - C[0]); };
  return { overlaps, rest, seatBeta, nosePoint, noseAngle, noseAngle0, noseRadius, pitch };
}

// March the rod round `turns` crank turns. eAt(phase) gives the strap centre
// in the bar frame. Returns the last (steady) turn sampled at `samples`
// points, with the wheel angle unwrapped so that w(phase + 1) = w(phase) +
// pitch.
export function simulateSLinkDrive(solver, eAt, { samples = 720, turns = 3, dropTurnFraction = 0.015, rake }) {
  const { pitch } = solver;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  let e = eAt(0);
  let beta = solver.seatBeta(e, 0);
  let w = wrap(solver.noseAngle(e, beta) - solver.noseAngle0);
  let k = 0;
  // Largest inward swing per sample while the hook falls.
  const toothDrop = 0.12;
  const dropPerSample = toothDrop / (dropTurnFraction * samples);
  const record = [];
  for (let i = 0; i <= turns * samples; i += 1) {
    const phase = i / samples;
    e = eAt(phase);
    const seat = solver.seatBeta(e, beta);
    const ws = w + wrap(solver.noseAngle(e, seat) - solver.noseAngle0 - k * pitch - w);
    let engaged = false;
    if (i > 0) {
      // Resting on the stationary wheel, the tip would slide down the flank;
      // once that rest would carry it past the root (up the undercut face,
      // which draws a pushing tip in rather than letting it out) or the
      // seated tip would lie beyond the root, it drives the face instead.
      const resting = Math.min(solver.rest(e, w, beta), beta + dropPerSample);
      const restRel = wrap(solver.noseAngle(e, resting) - w - solver.noseAngle0 - k * pitch);
      if (ws > w + 1e-12 || restRel > -1e-9) { w = Math.max(w, ws); beta = seat; engaged = true; }
      else beta = resting;
    }
    const rel = wrap(solver.noseAngle(e, beta) - w - solver.noseAngle0 - k * pitch);
    // Only a return can carry the nose past a tip (clockwise, onto the next
    // flank); going the other way it drives the face instead.
    k += Math.min(0, Math.floor((rel + (1 - rake) * pitch) / pitch + 1e-9));
    if (i >= (turns - 1) * samples) record.push({ phase, beta, w, engaged, e });
  }
  return record;
}
