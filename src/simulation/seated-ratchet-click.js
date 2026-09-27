// Seated ratchet clicks: one smooth planar plate per click, whose nose fills
// the valley between a tooth's working face and the next flank, plus an exact
// geometric follower that rests the click on the turning ratchet outline.
// Used by 321 (Harrison's going barrel, clicks R and T) and 370 (the mirror
// polisher's hooked click).
import { plate, poly, circle, polygonClipping as clip } from './finite-plate-geometry.js';

const TAU = 2 * Math.PI;
const turn = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const norm = (v) => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };
const positiveModulo = (value, modulus) => ((value % modulus) + modulus) % modulus;

// Saw teeth with straight flanks. Going in the `hand` direction from tip k the
// flank falls to the root, then the working face rises to tip k+1 over a
// small `rake` fraction of a pitch (a nearly radial face that a click can
// slide down continuously as it drops).
export function sawRatchetOutline({ radius, rootRadius, teeth, hand, rootAngle, rake = 0.04 }) {
  const pitch = TAU / teeth;
  // Root 0 lies at rootAngle; tip 0 precedes it by (1 - rake) pitch.
  const phase = rootAngle - hand * (1 - rake) * pitch;
  const outline = [];
  for (let k = 0; k < teeth; k += 1) {
    const tip = phase + hand * k * pitch;
    outline.push(turn([radius, 0], tip));
    outline.push(turn([rootRadius, 0], tip + hand * (1 - rake) * pitch));
  }
  // Keep a counterclockwise ring for the planar extrusion.
  if (hand < 0) outline.reverse();
  return { outline, pitch, phase, radius, rootRadius, teeth, hand, rake, rootAngle };
}


// Build the click outline in the carrier frame at its seated pose. The blade
// lies on the flank behind the tooth it holds: its inner edge runs along the
// flank chord (which passes clear outside the wheel beyond the tooth tip), its
// end is cut along the working face, so the nose is the valley's own angle
// and sits in the root. Behind the flank the blade sweeps smoothly to a round
// bored boss.
//   pivot:     click journal centre
//   apex:      tooth root the nose sits in
//   face:      unit vector from the root up the working face
//   flank:     unit vector from the root up the flank behind the nose
//   shank:     length of the straight blade along the flank
//   fillet:    optional radius of a bend into a straight run to the boss
//              (otherwise one tangent arc from the flank to the boss)
//   width:     blade width; bossRadius/boreRadius: bored pivot boss
export function seatedClickOutline({
  pivot, apex, face, flank, width, bossRadius, boreRadius,
  shank, fillet, clearance = 0.004, samples = 96, trimRadius,
}) {
  const bisector = norm([face[0] + flank[0], face[1] + flank[1]]);
  const nose = [apex[0] + bisector[0] * clearance, apex[1] + bisector[1] * clearance];
  // Outward normal of the flank (the side the blade lies on).
  let out = [-flank[1], flank[0]];
  if (out[0] * face[0] + out[1] * face[1] < 0) out = [-out[0], -out[1]];
  const offset = (p, d) => [p[0] + out[0] * d, p[1] + out[1] * d];
  // Centreline: from past the nose (trimmed by the face) up the flank, then
  // a tangent arc to the boss.
  const end = offset([nose[0] - flank[0] * width, nose[1] - flank[1] * width], width / 2);
  const knee = offset([nose[0] + flank[0] * shank, nose[1] + flank[1] * shank], width / 2);
  const straight = 24;
  const lead = Array.from({ length: straight + 1 }, (_, i) => [
    knee[0] + (end[0] - knee[0]) * i / straight, knee[1] + (end[1] - knee[1]) * i / straight]);
  let sweepPoints;
  if (fillet) {
    // Straight from the boss, a fillet of radius `fillet`, then the blade
    // along the flank: Brown's level blade drooping to its nose.
    let nrm = [-flank[1], flank[0]];
    if (nrm[0] * (pivot[0] - knee[0]) + nrm[1] * (pivot[1] - knee[1]) < 0) nrm = [-nrm[0], -nrm[1]];
    const c = [knee[0] + nrm[0] * fillet, knee[1] + nrm[1] * fillet];
    const r2 = [knee[0] - c[0], knee[1] - c[1]];
    // Travelling toward the nose the blade runs along -flank at the knee.
    const sigma = Math.sign(-r2[1] * -flank[0] + r2[0] * -flank[1]);
    const d = Math.hypot(pivot[0] - c[0], pivot[1] - c[1]);
    const beta = Math.atan2(pivot[1] - c[1], pivot[0] - c[0]);
    const phi = Math.acos(Math.min(1, fillet / d));
    let tangentPoint = null;
    for (const sgn of [1, -1]) {
      const a = beta + sgn * phi;
      const t = [c[0] + fillet * Math.cos(a), c[1] + fillet * Math.sin(a)];
      const travel = norm([t[0] - pivot[0], t[1] - pivot[1]]);
      const arcDirection = [-sigma * (t[1] - c[1]) / fillet, sigma * (t[0] - c[0]) / fillet];
      if (travel[0] * arcDirection[0] + travel[1] * arcDirection[1] > 0.99) tangentPoint = t;
    }
    const aT = Math.atan2(tangentPoint[1] - c[1], tangentPoint[0] - c[0]);
    const aK = Math.atan2(r2[1], r2[0]);
    const turnAngle = sigma * positiveModulo(sigma * (aK - aT), TAU);
    const run = Math.max(2, Math.round(samples / 2));
    sweepPoints = [
      ...Array.from({ length: run }, (_, i) => [
        pivot[0] + (tangentPoint[0] - pivot[0]) * i / run, pivot[1] + (tangentPoint[1] - pivot[1]) * i / run]),
      ...Array.from({ length: samples }, (_, i) => {
        const a = aT + turnAngle * i / samples;
        return [c[0] + fillet * Math.cos(a), c[1] + fillet * Math.sin(a)];
      }),
    ];
  } else {
    // From the knee the blade sweeps to the boss along the one circular arc
    // that leaves the flank tangentially and passes through the pivot.
    const toPivot = [pivot[0] - knee[0], pivot[1] - knee[1]];
    const normal = [-flank[1], flank[0]];
    const rho = (toPivot[0] ** 2 + toPivot[1] ** 2) / (2 * (normal[0] * toPivot[0] + normal[1] * toPivot[1]));
    const centreOfArc = [knee[0] + normal[0] * rho, knee[1] + normal[1] * rho];
    const a0 = Math.atan2(knee[1] - centreOfArc[1], knee[0] - centreOfArc[0]);
    const a1 = Math.atan2(pivot[1] - centreOfArc[1], pivot[0] - centreOfArc[0]);
    const sense = Math.sign((knee[0] - centreOfArc[0]) * flank[1] - (knee[1] - centreOfArc[1]) * flank[0]);
    const sweep = sense * positiveModulo(sense * (a1 - a0), TAU);
    const radiusOfArc = Math.abs(rho);
    sweepPoints = Array.from({ length: samples }, (_, i) => {
      const a = a1 - sweep * i / samples;
      return [centreOfArc[0] + radiusOfArc * Math.cos(a), centreOfArc[1] + radiusOfArc * Math.sin(a)];
    });
  }
  const centre = [...sweepPoints, ...lead];
  const left = [];
  const right = [];
  const last = centre.length - 1;
  for (let i = 0; i <= last; i += 1) {
    const a = centre[Math.max(0, i - 1)];
    const b = centre[Math.min(last, i + 1)];
    const t = norm([b[0] - a[0], b[1] - a[1]]);
    const n = [-t[1], t[0]];
    left.push([centre[i][0] + n[0] * width / 2, centre[i][1] + n[1] * width / 2]);
    right.push([centre[i][0] - n[0] * width / 2, centre[i][1] - n[1] * width / 2]);
  }
  const band = poly([...left, ...right.reverse()]);
  // Everything beyond the working-face line, near the nose, is tooth.
  let beyond = [-face[1], face[0]];
  if (beyond[0] * flank[0] + beyond[1] * flank[1] > 0) beyond = [-beyond[0], -beyond[1]];
  const L = trimRadius ?? width * 2.5;
  const cut = clip.intersection(
    poly([
      [nose[0] - face[0] * L, nose[1] - face[1] * L],
      [nose[0] + face[0] * L, nose[1] + face[1] * L],
      [nose[0] + (face[0] + beyond[0]) * L, nose[1] + (face[1] + beyond[1]) * L],
      [nose[0] + (beyond[0] - face[0]) * L, nose[1] + (beyond[1] - face[1]) * L],
    ]),
    poly(circle(nose, L, 96)),
  );
  const body = clip.difference(clip.union(band, poly(circle(pivot, bossRadius, 64))), cut, poly(circle(pivot, boreRadius, 48)));
  return { polygons: body, nose, bisector };
}

export function clickPlate(outline, depth) {
  return plate(outline.polygons, -depth / 2, depth / 2);
}

// Exact planar overlap of two simple rings (with holes ignored for the
// wheel's bore, which never reaches the click).
function segmentsCross(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)) && d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0;
}
function inside(p, ring) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}

// Geometric follower. `x` is the wheel's travel from the seated pose in the
// ratcheting (`hand`) direction; the click rests at the least lift ψ ≥ 0 that
// clears the outline. Returns the click rotation about its pivot relative to
// the seated pose.
export function makeSeatedFollower({ outline, wheel, pivot, seatWheelAngle, runningClearance = 0 }) {
  const ring = outline.polygons[0][0].slice(0, -1).map((p) => [p[0] - pivot[0], p[1] - pivot[1]]);
  const { pitch, hand } = wheel;
  // The click rests on the outline grown by a small running clearance
  // (a mitred offset of the saw polygon).
  const wheelRing = runningClearance > 0 ? mitreOffset(wheel.outline, runningClearance) : wheel.outline;
  const radius = wheel.radius + runningClearance * 3;
  // Lift direction: the rotation that carries the nose away from the axis.
  const noseLocal = [outline.nose[0] - pivot[0], outline.nose[1] - pivot[1]];
  const lifted = turn(noseLocal, 0.01);
  const liftSign = Math.hypot(lifted[0] + pivot[0], lifted[1] + pivot[1]) > Math.hypot(...outline.nose) ? 1 : -1;
  const reachSq = (radius + 1e-3) ** 2;
  const overlaps = (x, psi) => {
    const clickRing = ring.map((p) => { const q = turn(p, liftSign * psi); return [q[0] + pivot[0], q[1] + pivot[1]]; });
    // Work in the wheel frame.
    const back = -(seatWheelAngle + hand * x);
    const local = clickRing.map((p) => turn(p, back));
    const near = [];
    for (let i = 0; i < local.length; i += 1) {
      const p = local[i];
      if (p[0] * p[0] + p[1] * p[1] < reachSq) {
        if (inside(p, wheelRing)) return true;
        near.push(i);
      }
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of local) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    const wheelNear = [];
    for (let j = 0; j < wheelRing.length; j += 1) {
      const w = wheelRing[j];
      if (w[0] >= minX && w[0] <= maxX && w[1] >= minY && w[1] <= maxY) {
        if (inside(w, local)) return true;
        wheelNear.push(j);
      }
    }
    const edges = new Set();
    for (const i of near) { edges.add((i + local.length - 1) % local.length); edges.add(i); }
    const wheelEdges = new Set();
    for (const j of wheelNear) { wheelEdges.add((j + wheelRing.length - 1) % wheelRing.length); wheelEdges.add(j); }
    for (const i of edges) {
      const a = local[i], b = local[(i + 1) % local.length];
      for (const j of wheelEdges) if (segmentsCross(a, b, wheelRing[j], wheelRing[(j + 1) % wheelRing.length])) return true;
    }
    return false;
  };
  const maximumLift = 0.9;
  const angleAt = (travel) => {
    const x = positiveModulo(travel, pitch);
    if (!overlaps(x, 0)) return 0;
    let low = 0, high = maximumLift;
    if (overlaps(x, high)) throw new RangeError('click cannot clear the ratchet');
    for (let i = 0; i < 44; i += 1) {
      const mid = (low + high) / 2;
      if (overlaps(x, mid)) low = mid; else high = mid;
    }
    // A hair of running clearance above exact contact.
    return liftSign * (high + 2e-6);
  };
  return { angleAt, liftSign, pitch, overlaps };
}

function mitreOffset(points, distance) {
  // Counterclockwise ring: outward normals point right of each edge.
  const n = points.length;
  const normals = points.map((p, i) => {
    const q = points[(i + 1) % n];
    const e = norm([q[0] - p[0], q[1] - p[1]]);
    return [e[1], -e[0]];
  });
  return points.map((p, i) => {
    const a = normals[(i + n - 1) % n];
    const b = normals[i];
    const k = distance / (1 + a[0] * b[0] + a[1] * b[1]);
    return [p[0] + (a[0] + b[0]) * k, p[1] + (a[1] + b[1]) * k];
  });
}

// Periodic lookup built at load for followers without an offline table.
export function followerTable(angleAt, pitch, count = 384) {
  const values = Array.from({ length: count + 1 }, (_, i) => angleAt(pitch * i / count));
  values[count] = values[0];
  return (travel) => {
    const u = positiveModulo(travel, pitch) / pitch * count, i = Math.min(count - 1, Math.floor(u)), t = u - i;
    return values[i] + (values[i + 1] - values[i]) * t;
  };
}
