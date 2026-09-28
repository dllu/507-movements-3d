import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { circle, capsule, poly, plate, polygonClipping } from './finite-plate-geometry.js';

const rectangle = (x0, y0, x1, y1) => poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
const verticalPlate = (outline, low, high) => plate(outline, low, high).rotateX(-Math.PI / 2);

// Eight real radial sockets. The occupied opposite pair connects through the
// center; six unused sockets retain their blind inner walls. End plates retain
// a load-bearing head above and below every opening.
export function capstanHeadGeometry(radius) {
  const disk = poly(circle([0, 0], radius, 128));
  const bore = poly(circle([0, 0], 0.15, 48));
  const cuts = [rectangle(-1.5, -0.11, 1.5, 0.11), bore];
  for (let i = 1; i < 8; i++) {
    if (i === 4) continue;
    const a = i * Math.PI / 4;
    cuts.push(poly([[0.86,-0.11],[1.5,-0.11],[1.5,0.11],[0.86,0.11]]
      .map(([x,y]) => [x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)])));
  }
  const annulus = polygonClipping.difference(disk, bore);
  const parts = [verticalPlate(annulus, -0.21, -0.08),
    verticalPlate(polygonClipping.difference(disk, ...cuts), -0.08, 0.12),
    verticalPlate(annulus, 0.12, 0.21)];
  const result = mergeGeometries(parts); parts.forEach(p => p.dispose());
  return result;
}

// The rim stands proud of the head round each socket mouth. Its opening is a
// little larger than the socket and it starts at the head's surface, so its
// walls never lie in the socket's walls.
export function capstanSocketRimGeometry() {
  return plate(polygonClipping.difference(rectangle(-0.16,-0.145,0.16,0.145),
    rectangle(-0.117,-0.107,0.117,0.107)), -0.012, 0.075).rotateY(Math.PI / 2);
}

// Smoothly acquire constant packing pitch over the first quarter-radian.
// Unlike easing over the entire helix, this leaves every pair of turns apart.
export function capstanPackingProgress(progress, wrapAngle) {
  const angle = progress * wrapAngle, lead = 0.25;
  const u = Math.min(angle / lead, 1);
  const integral = angle < lead ? lead * (u**3 - 0.5*u**4) : angle - lead/2;
  return integral / (wrapAngle - lead/2);
}

// Brown's pawl: a flat dog on the radial pivot pin, drawn seated. It is built
// in that seated pose (pivot at the origin, y up, x toward the recoil side)
// and turned into pawl-local axes, x from the pivot to the tip.
// - A round boss on the pin.
// - A straight back, tangent to the boss, down to a rounded shoulder.
// - A straight front edge, vertical like the tooth face it bears on, down to
//   the tip in the root.
// - A hooked belly: one smooth cubic from under the boss, bending down and
//   then easing onto a short toe that lies along the ramp, so the tip's
//   angle is the valley's (face against ramp) and it fills the root corner.
const turn = ([x, y], angle) => [x*Math.cos(angle) - y*Math.sin(angle), x*Math.sin(angle) + y*Math.cos(angle)];
const unit = ([x, y]) => { const n = Math.hypot(x, y); return [x/n, y/n]; };
// Round the corner at b (between a and c) with an arc of radius r.
function filletCorner(a, b, c, r, steps) {
  const u = unit([a[0]-b[0], a[1]-b[1]]), v = unit([c[0]-b[0], c[1]-b[1]]);
  const half = Math.acos(Math.max(-1, Math.min(1, u[0]*v[0] + u[1]*v[1]))) / 2;
  const back = r / Math.tan(half), bis = unit([u[0]+v[0], u[1]+v[1]]), d = r / Math.sin(half);
  const center = [b[0]+bis[0]*d, b[1]+bis[1]*d];
  const p = [b[0]+u[0]*back, b[1]+u[1]*back], q = [b[0]+v[0]*back, b[1]+v[1]*back];
  let a0 = Math.atan2(p[1]-center[1], p[0]-center[0]), a1 = Math.atan2(q[1]-center[1], q[0]-center[0]);
  let sweep = a1 - a0; while (sweep > Math.PI) sweep -= 2*Math.PI; while (sweep < -Math.PI) sweep += 2*Math.PI;
  return Array.from({ length: steps+1 }, (_, i) => [center[0]+r*Math.cos(a0+sweep*i/steps), center[1]+r*Math.sin(a0+sweep*i/steps)]);
}
export function capstanPawlSeatPitch({ seatTip }) { return Math.atan2(seatTip[1], seatTip[0]); }
export function capstanPawlOutline(dimensions, count = 48) {
  const { seatTip: tip, shoulderHeight, bossRadius: rb, toeLength, toeAngle, shoulderRadius, tipRadius, bellyStart, bellyLead } = dimensions;
  const shoulder = [tip[0], shoulderHeight];
  // Back: the line from the shoulder tangent to the boss on its upper side.
  const d = Math.hypot(...shoulder), phi = Math.atan2(shoulder[1], shoulder[0]);
  const backAngle = phi + Math.acos(rb / d), backPoint = [rb*Math.cos(backAngle), rb*Math.sin(backAngle)];
  // Belly: leaves the boss tangentially at bellyStart, ends on the toe.
  const toe = [Math.cos(toeAngle), Math.sin(toeAngle)], heel = [tip[0] + toe[0]*toeLength, tip[1] + toe[1]*toeLength];
  const b0 = [rb*Math.cos(bellyStart), rb*Math.sin(bellyStart)], t0 = [-Math.sin(bellyStart), Math.cos(bellyStart)];
  const span = Math.hypot(heel[0]-b0[0], heel[1]-b0[1]);
  const p1 = [b0[0] + t0[0]*span*bellyLead, b0[1] + t0[1]*span*bellyLead], p2 = [heel[0] + toe[0]*span*0.35, heel[1] + toe[1]*span*0.35];
  const belly = Array.from({ length: 33 }, (_, i) => {
    const t = i/32, s = 1-t;
    return [0, 1].map(k => s*s*s*b0[k] + 3*s*s*t*p1[k] + 3*s*t*t*p2[k] + t*t*t*heel[k]);
  });
  const points = [];
  // Tip (valley-angle point, slightly rounded), front edge, shoulder, back.
  points.push(...filletCorner(heel, tip, shoulder, tipRadius, 8));
  points.push(...filletCorner(tip, shoulder, backPoint, shoulderRadius, 12));
  // Boss: counter-clockwise from the back's tangent point round to the belly.
  let sweep = bellyStart - backAngle; while (sweep <= 0) sweep += 2*Math.PI;
  const steps = Math.max(8, Math.round(count * sweep / (2*Math.PI)));
  for (let i = 0; i <= steps; i++) { const a = backAngle + sweep*i/steps; points.push([rb*Math.cos(a), rb*Math.sin(a)]); }
  points.push(...belly.slice(1, -1));
  // Straight runs are subdivided so every sampled edge point is a vertex.
  const dense = [];
  points.forEach((p, i) => {
    const q = points[(i+1) % points.length], n = Math.max(1, Math.ceil(Math.hypot(q[0]-p[0], q[1]-p[1]) / 0.01));
    for (let k = 0; k < n; k++) dense.push([p[0] + (q[0]-p[0])*k/n, p[1] + (q[1]-p[1])*k/n]);
  });
  const seat = capstanPawlSeatPitch(dimensions);
  return dense.map(point => turn(point, -seat));
}

export function capstanPawlGeometry(dimensions) {
  const outline = poly(capstanPawlOutline(dimensions));
  return plate(polygonClipping.difference(outline, poly(circle([0, 0], dimensions.boreRadius, 48))),
    -dimensions.thickness / 2, dimensions.thickness / 2);
}
