import * as THREE from 'three';
import {plate} from './finite-plate-geometry.js';

// Face-on sections of casings extruded along z (rotary engines and the like)
// otherwise read as open rings with no walls. The cut removes only the front
// cover: this adds the back cover as one plate spanning the union of the named
// extrusions' outer contours, just behind their rear face.
// `alsoCover` names further parts (any geometry) whose vertices extend the
// silhouette, e.g. a guide standing out from the casing.
export function addBackCover(root, roles, {thickness = 0.12, material, role = 'fixed-back-cover-behind-section', center = [0, 0], alsoCover = []} = {}) {
  root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const polygons = [];let back = Infinity, found = null;
  root.traverse(o => {
    // Layered (ported) casings carry their full outline shapes in userData.
    if (!o.isMesh || !roles.includes(o.userData?.role)) return;
    const outlineShapes = o.geometry.type === 'ExtrudeGeometry' ? o.geometry.parameters.shapes : o.geometry.userData?.outlineShapes;
    if (!outlineShapes) return;
    found ??= o;
    const toRoot = new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld);
    o.geometry.computeBoundingBox();
    const box = o.geometry.boundingBox.clone().applyMatrix4(toRoot);back = Math.min(back, box.min.z);
    for (const shape of [].concat(outlineShapes)) {
      const points = shape.extractPoints(24).shape.map(p => new THREE.Vector3(p.x, p.y, 0).applyMatrix4(toRoot));
      polygons.push([[...points.map(p => [p.x, p.y]), [points[0].x, points[0].y]]]);
    }
  });
  if (!found) return null;
  // Filled silhouette: the radial envelope about `center` of all outlines
  // (the casings are star-shaped about their shaft), so the passages between
  // the bore and the outer walls are closed at the back as well.
  const bins = 1440, envelope = new Array(bins).fill(0);
  const note = (x, y) => {
    const dx = x - center[0], dy = y - center[1], r = Math.hypot(dx, dy);
    const bin = Math.floor(THREE.MathUtils.euclideanModulo(Math.atan2(dy, dx), Math.PI * 2) / (Math.PI * 2) * bins) % bins;
    envelope[bin] = Math.max(envelope[bin], r);
  };
  for (const [[...ring]] of polygons) for (let i = 0; i + 1 < ring.length; i++) {
    const [a, b] = [ring[i], ring[i + 1]], steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.01));
    for (let k = 0; k <= steps; k++) note(a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps);
  }
  root.traverse(o => {
    if (!o.isMesh || !alsoCover.includes(o.userData?.role)) return;
    const toRoot = new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld), v = new THREE.Vector3(), position = o.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {v.fromBufferAttribute(position, i).applyMatrix4(toRoot);note(v.x, v.y);}
  });
  // Bins no outline reached take the interpolated neighbouring radii.
  const known = envelope.map((r, i) => r > 0 ? i : -1).filter(i => i >= 0);
  for (let i = 0; i < bins; i++) if (!envelope[i]) {
    const after = known.find(k => k > i) ?? known[0] + bins, before = [...known].reverse().find(k => k < i) ?? known.at(-1) - bins;
    const t = (i - before) / (after - before);
    envelope[i] = envelope[(before + bins) % bins] * (1 - t) + envelope[after % bins] * t;
  }
  const outline = envelope.map((r, i) => {
    const angle = (i + 0.5) / bins * Math.PI * 2;
    return [center[0] + r * Math.cos(angle), center[1] + r * Math.sin(angle)];
  });
  const union = [[[...outline, outline[0]]]];
  const cover = new THREE.Mesh(plate(union, back - thickness, back), material ?? [].concat(found.material)[0]);
  cover.userData.role = role;cover.castShadow = true;cover.receiveShadow = true;
  root.add(cover);
  return cover;
}
