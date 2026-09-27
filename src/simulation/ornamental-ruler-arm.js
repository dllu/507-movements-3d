import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { circle, poly, plate, polygonClipping as clip } from './finite-plate-geometry.js';

// Each parallel-ruler link is one flat extrusion: two round eyes, circular
// arcs concentric with the pivots, joined by a smooth body whose half-width
// is a spline symmetric about the pin line and about the link's midpoint.
// The half-widths (fractions of the pin distance, for 0 <= t <= 0.5, mirrored
// for the second half) follow Brown's baluster outlines read from the plates:
// 349 a plain swelling bar, 367 a neck and bead at each eye, a bulb either
// side and a waist at the middle.
export const rulerArmHalfWidths = {
  349: [[0, .075], [.12, .052], [.22, .046], [.36, .062], [.5, .075]],
  367: [[0, .06], [.09, .04], [.15, .058], [.21, .04], [.30, .064], [.38, .084], [.45, .066], [.5, .044]],
};

export function rulerArmHalfWidth(id, t) {
  const curve = rulerArmCurve(id);
  const u = Math.min(t, 1 - t);
  // SplineCurve is uniform in its control index, so invert x numerically.
  let low = 0, high = .5;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (curve.getPoint(mid).x < u) low = mid; else high = mid;
  }
  return curve.getPoint((low + high) / 2).y;
}

const curves = new Map();
function rulerArmCurve(id) {
  if (!curves.has(id)) {
    const half = rulerArmHalfWidths[id];
    const full = [...half, ...half.slice(0, -1).reverse().map(([t, h]) => [1 - t, h])];
    curves.set(id, new THREE.SplineCurve(full.map(([t, h]) => new THREE.Vector2(t, h))));
  }
  return curves.get(id);
}

export function rulerArmOutline(id, length, startRadius, endRadius = startRadius) {
  const samples = rulerArmCurve(id).getSpacedPoints(400);
  const top = samples.map((p) => [p.x * length, p.y * length]);
  const bottom = samples.slice().reverse().map((p) => [p.x * length, -p.y * length]);
  const outline = clip.union(poly([...top, ...bottom]),
    poly(circle([0, 0], startRadius + .04, 128)),
    poly(circle([length, 0], endRadius + .04, 128)));
  return clip.difference(outline, poly(circle([0, 0], startRadius, 96)),
    poly(circle([length, 0], endRadius, 96)));
}

export function ornamentalRulerArmGeometry(id, length, depth, startRadius, endRadius = startRadius) {
  const flat = plate(rulerArmOutline(id, length, startRadius, endRadius), -depth / 2, depth / 2);
  // Smooth the curved side walls; the flat faces and the eye/body corners
  // keep their creases.
  const geometry = toCreasedNormals(flat, Math.PI / 5);
  geometry.userData.plate = flat.userData.plate;
  flat.dispose();
  return geometry;
}
