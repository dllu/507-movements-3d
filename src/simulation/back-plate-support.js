import * as THREE from 'three';
import { disk, ring } from './finite-plate-geometry.js';
import { PALETTE, matte } from './primitives.js';

// Shared support convention for plates where Brown draws no frame: fixed
// pivots, shafts and guides are carried on a plain back bar (or plate)
// behind the moving parts, with a boss or bearing for each fixed pivot and a
// bracket for each guide, grounded by a short pillar and foot. Everything is
// plain frame colour and sits behind (negative z of) the mechanism.

export function supportMaterial() {
  return matte(PALETTE.frame, { metalness: 0.15, roughness: 0.65 });
}

function tag(mesh, role) {
  mesh.userData.role = role;
  mesh.name = role;
  return mesh;
}

// A flat bar of rectangular section through `points` (xy) with its front face
// at z = zFront; round pads at the joints keep bends clean.
export function backBar(points, { zFront, width = 0.3, thickness = 0.1, material, role = 'back-bar' } = {}) {
  const mat = material ?? supportMaterial();
  const group = new THREE.Group();
  group.userData.role = role;
  const z = zFront - thickness / 2;
  for (let i = 0; i + 1 < points.length; i += 1) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const seg = tag(new THREE.Mesh(new THREE.BoxGeometry(len, width, thickness), mat), `${role}-segment`);
    seg.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, z);
    seg.rotation.z = Math.atan2(dy, dx);
    group.add(seg);
  }
  for (const p of points) {
    // Closed turned solids (CylinderGeometry has an open seam).
    const pad = tag(new THREE.Mesh(disk(width / 2, zFront - thickness, zFront, 64), mat), `${role}-pad`);
    pad.position.set(p.x, p.y, 0);
    group.add(pad);
  }
  return group;
}

// A plain rectangular plate behind the mechanism, front face at zFront.
export function backPlate({ minX, maxX, minY, maxY, zFront, thickness = 0.1, material, role = 'back-plate' }) {
  const plate = tag(new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, maxY - minY, thickness), material ?? supportMaterial()), role);
  plate.position.set((minX + maxX) / 2, (minY + maxY) / 2, zFront - thickness / 2);
  return plate;
}

// A solid boss (fixed pin shank) along z from zBack up to zFront.
export function pinBoss({ x, y, radius, zFront, zBack, material, role = 'pin-boss' }) {
  const boss = tag(new THREE.Mesh(disk(radius, zBack, zFront, 64), material ?? supportMaterial()), role);
  boss.position.set(x, y, 0);
  return boss;
}

// A bored bearing boss along z (for a turning shaft) from zBack to zFront.
export function bearingBoss({ x, y, boreRadius, outerRadius, zFront, zBack, material, role = 'bearing-boss' }) {
  const boss = tag(new THREE.Mesh(ring(boreRadius, outerRadius, zBack, zFront, 64), material ?? supportMaterial()), role);
  // ring() is turned about z between the two heights.
  boss.position.set(x, y, 0);
  return boss;
}

// A pillar standing on a foot: vertical column from yFloor to yTop at (x, z).
export function footPillar({ x, yTop, yFloor, z, width = 0.26, depth = 0.1, footWidth, footDepth = 0.5, material, role = 'support-pillar' }) {
  const mat = material ?? supportMaterial();
  const group = new THREE.Group();
  group.userData.role = role;
  const column = tag(new THREE.Mesh(new THREE.BoxGeometry(width, yTop - yFloor, depth), mat), `${role}-column`);
  column.position.set(x, (yTop + yFloor) / 2, z);
  const foot = tag(new THREE.Mesh(new THREE.BoxGeometry(footWidth ?? width * 3, 0.1, footDepth), mat), `${role}-foot`);
  foot.position.set(x, yFloor + 0.05, z);
  group.add(column, foot);
  return group;
}

// An open rectangular sleeve guiding a bar that slides along `axis` ('x' or
// 'y'). innerWidth is the in-plane clearance across the bar, innerDepth the
// z clearance; the sleeve is centred on `center`. A web runs from the back
// wall of the sleeve to the framing plane zWall (if given).
export function slideSleeve({ center, axis = 'x', length, innerWidth, innerDepth, wall = 0.06, zWall, material, role = 'slide-guide' }) {
  const mat = material ?? supportMaterial();
  const group = new THREE.Group();
  group.userData.role = role;
  const ow = innerWidth + 2 * wall, od = innerDepth + 2 * wall;
  const add = (sx, sy, sz, px, py, pz, r) => {
    const m = tag(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat), r);
    m.position.set(px, py, pz);
    group.add(m);
  };
  const along = axis === 'x';
  const L = length;
  // In-plane cheeks (either side of the bar).
  for (const s of [-1, 1]) {
    const off = s * (innerWidth + wall) / 2;
    if (along) add(L, wall, od, 0, off, 0, `${role}-cheek`);
    else add(wall, L, od, off, 0, 0, `${role}-cheek`);
  }
  // Front and back covers.
  for (const s of [-1, 1]) {
    const off = s * (innerDepth + wall) / 2;
    if (along) add(L, innerWidth, wall, 0, 0, off, `${role}-${s < 0 ? 'back' : 'front'}`);
    else add(innerWidth, L, wall, 0, 0, off, `${role}-${s < 0 ? 'back' : 'front'}`);
  }
  if (zWall !== undefined) {
    const back = center.z - od / 2;
    const webLen = back - zWall;
    if (webLen > 1e-3) {
      if (along) add(Math.min(L, 0.3), ow, webLen, 0, 0, -od / 2 - webLen / 2, `${role}-web`);
      else add(ow, Math.min(L, 0.3), webLen, 0, 0, -od / 2 - webLen / 2, `${role}-web`);
    }
  }
  group.position.copy(center);
  return group;
}

// The swept bounds of the mechanism with the given supports hidden, so added
// supports (pillars down to a floor, guides past Brown's crop) do not change
// the plate's default framing. Sets root.userData.cameraFitBounds unless one
// is already authored, and returns the box.
export function freezeFitBoundsWithout(root, update, period, supports, samples = 32) {
  if (root.userData.cameraFitBounds?.isBox3) return root.userData.cameraFitBounds;
  // Box3.setFromObject ignores visibility, so detach the supports instead.
  const parents = supports.map((part) => part.parent);
  supports.forEach((part) => part.removeFromParent());
  const box = new THREE.Box3();
  for (let i = 0; i < samples; i += 1) {
    update(period * i / samples, period / samples);
    root.updateMatrixWorld(true);
    box.union(new THREE.Box3().setFromObject(root, true));
  }
  supports.forEach((part, index) => parents[index]?.add(part));
  update(0, 0);
  root.userData.cameraFitBounds = box;
  return box;
}
