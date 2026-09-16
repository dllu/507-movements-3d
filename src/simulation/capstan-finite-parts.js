import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { circle, poly, plate, polygonClipping } from './finite-plate-geometry.js';

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

export function capstanSocketRimGeometry() {
  return plate(polygonClipping.difference(rectangle(-0.155,-0.14,0.155,0.14),
    rectangle(-0.11,-0.10,0.11,0.10)), -0.045, 0.045).rotateY(Math.PI / 2);
}

// Smoothly acquire constant packing pitch over the first quarter-radian.
// Unlike easing over the entire helix, this leaves every pair of turns apart.
export function capstanPackingProgress(progress, wrapAngle) {
  const angle = progress * wrapAngle, lead = 0.25;
  const u = Math.min(angle / lead, 1);
  const integral = angle < lead ? lead * (u**3 - 0.5*u**4) : angle - lead/2;
  return integral / (wrapAngle - lead/2);
}
