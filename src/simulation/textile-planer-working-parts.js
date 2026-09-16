import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { circle, plate, poly, polygonClipping, sector } from './finite-plate-geometry.js';

export function boredRollGeometry(radius, length, bore, segments = 128) {
  return boredLatheGeometry([
    { axial: -length / 2, radial: radius },
    { axial: length / 2, radial: radius },
  ], bore, segments);
}

export function boredBlockGeometry(width, height, depth, bore) {
  return plate(polygonClipping.difference(poly([
    [-width / 2, -height / 2], [width / 2, -height / 2],
    [width / 2, height / 2], [-width / 2, height / 2],
  ]), poly(circle([0, 0], bore, 64))), -depth / 2, depth / 2);
}

export function textileBrushGeometry(inner, outer, width) {
  // Circular working edge: unlike a radial box its corners cannot protrude
  // through the nominal cloth tangent. Small tessellation clearance is stated.
  return plate(sector(inner, outer, -.055, .055, 12), -width / 2, width / 2);
}

export function woodFeedToothGeometry(root, tip, pitch, width) {
  // Wood-gripping point with concave flanks, not an involute gear pair.
  // The actual point has exactly the radius used by the bite calculation.
  const points = [];
  for (const sign of [-1, 1]) {
    const start = new THREE.Vector2(root * Math.cos(pitch * .45), sign * root * Math.sin(pitch * .45));
    const control = new THREE.Vector2(root * 1.005, sign * root * Math.sin(pitch * .07));
    const end = new THREE.Vector2(tip, 0);
    const curve = new THREE.QuadraticBezierCurve(start, control, end);
    const side = curve.getPoints(12).map(p => p.toArray());
    points.push(...(sign === -1 ? side : side.reverse().slice(1)));
  }
  return plate(poly(points), -width / 2, width / 2);
}

export function finishProcessPresentation(root, duration, note) {
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = duration;
  root.userData.cameraFov = 8;
  root.userData.reconstructionNote = note;
  root.traverse(object => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material) material.fog = false;
    }
  });
}
