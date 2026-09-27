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

// Brown's pawl: a flat dog with a round boss on the radial pivot pin,
// tapering to a rounded nose. Outline in pawl-local x (along the pawl) and y;
// the plate is extruded through the pawl thickness along local z (radial).
export function capstanPawlOutline({ length, bossRadius, noseRadius }, count = 48) {
  // Brown's dog is curved: its back bulges away from the teeth and it
  // tapers from the boss to the rounded nose.
  const bulge = 0.06, steps = 24, left = [], right = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, x = u * length, y = bulge * Math.sin(Math.PI * u);
    const slope = bulge * Math.PI / length * Math.cos(Math.PI * u), n = Math.hypot(1, slope);
    const w = 0.085 * (1 - u) + noseRadius * u;
    left.push([x - slope * w / n, y + w / n]); right.push([x + slope * w / n, y - w / n]);
  }
  const union = polygonClipping.union(poly([...left, ...right.reverse()]),
    poly(circle([0, 0], bossRadius, count)), poly(circle([length, 0], noseRadius, count)));
  return union[0][0].slice(0, -1);
}

export function capstanPawlGeometry(dimensions) {
  const outline = poly(capstanPawlOutline(dimensions));
  return plate(polygonClipping.difference(outline, poly(circle([0, 0], dimensions.boreRadius, 48))),
    -dimensions.thickness / 2, dimensions.thickness / 2);
}
