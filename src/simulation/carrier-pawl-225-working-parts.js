import * as THREE from 'three';
import { groundBlock } from './ground-block.js';
import { circle, plate, ring } from './finite-plate-geometry.js';
import { boredPlanarLinkGeometry } from './bored-planar-link.js';
import { nearest390Outline } from './dual-band-pawl-contact.js';
import { matte, PALETTE } from './primitives.js';

// The rising edge is the positive-torque face. The long trailing edge used
// by clockwise mechanisms (such as 284) would drive the opposite direction.
export function carrierPawlFlank225({ outerRadius, rootRadius, pitch, noseRadius, flankFraction = 0.58 }) {
  const root = new THREE.Vector2(rootRadius, 0);
  const tip = new THREE.Vector2(outerRadius * Math.cos(0.16 * pitch), outerRadius * Math.sin(0.16 * pitch));
  const edge = tip.clone().sub(root), normal = new THREE.Vector2(edge.y, -edge.x).normalize();
  const point = root.clone().lerp(tip, flankFraction), clearance = 0.0002;
  const center = point.clone().addScaledVector(normal, noseRadius + clearance);
  return { root, tip, point, normal, center, radius: center.length(), angle: Math.atan2(center.y, center.x), clearance };
}
export function carrierPawlClearance225(center, wheelAngle, outline, noseRadius) {
  const c = Math.cos(wheelAngle), s = Math.sin(wheelAngle);
  return nearest390Outline([c * center.x + s * center.y, -s * center.x + c * center.y], outline).distance - noseRadius;
}

// Signed clearance between the whole flat pawl outline (local to its hinge)
// and the wheel outline. The pawl shares the wheel's plane; its arched bar is
// shaped so that only the nose touches the teeth, which tests verify.
export function carrierPawlBarClearance225(pivot, angle, wheelAngle, barOutline, wheelOutline) {
  const ca = Math.cos(angle), sa = Math.sin(angle), cw = Math.cos(wheelAngle), sw = Math.sin(wheelAngle);
  let clearance = Infinity;
  for (const [x, y] of barOutline) {
    const wx = pivot.x + ca * x - sa * y, wy = pivot.y + sa * x + ca * y;
    if (wx * wx + wy * wy > 3.2) continue;
    clearance = Math.min(clearance, nearest390Outline([cw * wx + sw * wy, -sw * wx + cw * wy], wheelOutline).distance);
  }
  for (const [x, y] of wheelOutline) {
    const wx = cw * x - sw * y - pivot.x, wy = sw * x + cw * y - pivot.y;
    clearance = Math.min(clearance, nearest390Outline([ca * wx + sa * wy, -sa * wx + ca * wy], barOutline).distance);
  }
  return clearance;
}

// Largest pawl angle (the lift direction lowers it) at which the wheel-side
// edge of the bar, given as hinge-local points ordered away from the hinge,
// keeps at least `margin` from every point of the densified wheel outline.
const denseWheel225 = new WeakMap();
export function carrierPawlBarLiftLimit225(pivot, baseAngle, wheelAngle, edge, wheelOutline, margin) {
  let dense = denseWheel225.get(wheelOutline);
  if (!dense) {
    dense = [];
    for (let i = 0; i < wheelOutline.length; i++) {
      const [ax, ay] = wheelOutline[i], [bx, by] = wheelOutline[(i + 1) % wheelOutline.length];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.006));
      for (let k = 0; k < n; k++) dense.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
    }
    denseWheel225.set(wheelOutline, dense);
  }
  const radii = edge.map(([x, y]) => Math.hypot(x, y)), polar = edge.map(([x, y]) => Math.atan2(y, x));
  const cw = Math.cos(wheelAngle), sw = Math.sin(wheelAngle);
  let limit = Infinity;
  for (const [x, y] of dense) {
    const px = cw * x - sw * y - pivot.x, py = sw * x + cw * y - pivot.y, rho = Math.hypot(px, py);
    if (rho < radii[0] || rho > radii.at(-1)) continue;
    let j = 1;
    while (radii[j] < rho) j += 1;
    const t = (rho - radii[j - 1]) / (radii[j] - radii[j - 1]), psi = polar[j - 1] + (polar[j] - polar[j - 1]) * t;
    const local = Math.atan2(py, px) - baseAngle, wrapped = Math.atan2(Math.sin(local), Math.cos(local));
    if (Math.abs(wrapped - psi) > 0.35) continue;
    limit = Math.min(limit, baseAngle + wrapped - psi - margin / rho);
  }
  return limit;
}

export function installCarrierPawl225(root) {
  const { blocks: b, geometry: g } = root.userData;
  const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
  const material = b.pawlBody.material, dark = matte(PALETTE.ink, { metalness: 0.22, roughness: 0.48 });
  // Brown's pawl is a plain, gently curved bar that tapers from a broad hinge
  // end to a slim rounded point: its centre line is one shallow circular arc
  // (sagitta 0.17, about 6% of the length against Brown's 5%), and its
  // wheel-side edge rises just clear of the tooth behind the nose while the
  // pawl drives. On the return the bar's own edge lifts it over that tooth.
  const sagitta = 0.17;
  const arcRadius = (g.pawlLength ** 2 / 4 + sagitta ** 2) / (2 * sagitta);
  const halfAngle = Math.asin(g.pawlLength / 2 / arcRadius);
  const curve = { getPoints: (n) => Array.from({ length: n + 1 }, (_, i) => {
    const a = -halfAngle + 2 * halfAngle * i / n;
    return new THREE.Vector3(g.pawlLength / 2 + arcRadius * Math.sin(a), -(arcRadius * Math.cos(a) - (arcRadius - sagitta)), 0);
  }) };
  // A single ordered perimeter avoids unions between tangent capsule arcs,
  // which can fail ring reconstruction under browser floating-point arithmetic.
  const points = curve.getPoints(32).map(p => [p.x, p.y]);
  // Brown's bar thickens steadily from about 0.14 at the point to 0.33 at
  // the hinge; the wheel-side half stays slim near the nose, so most of the
  // taper is on the outer edge.
  const noseRadius = g.pawlNoseRadius, hingeHalfWidth = 0.165;
  const taper = (x, power) => noseRadius + (hingeHalfWidth - noseRadius) * Math.max(0, 1 - x / g.pawlLength) ** power;
  const widths = points.map(([x]) => taper(x, 1.2));
  const outerWidths = points.map(([x]) => taper(x, 0.55));
  const wheelEdge = points.map(([x, y], i) => [x, y + widths[i]]);
  const outline = [...wheelEdge];
  for (let i = 1; i <= 16; i++) {
    const angle = Math.PI / 2 - Math.PI * i / 16;
    outline.push([g.pawlLength + noseRadius * Math.cos(angle), noseRadius * Math.sin(angle)]);
  }
  outline.push(...points.slice(0, -1).reverse().map(([x, y], i) => [x, y - outerWidths[points.length - 2 - i]]));
  for (let i = 1; i < 32; i++) {
    const angle = -Math.PI / 2 - Math.PI * i / 32;
    outline.push([hingeHalfWidth * Math.cos(angle), hingeHalfWidth * Math.sin(angle)]);
  }
  g.pawlWheelEdge = wheelEdge.filter(([x]) => x > 0.3);
  replace(b.pawlBody, plate([[outline, circle([0, 0], 0.074, 64)]], -0.065, 0.065));
  g.pawlOutline = outline;
  g.pawlBarSagitta = sagitta;
  g.pawlBarArcRadius = arcRadius;
  b.pawlIndex.position.y = -0.12;
  b.pawlIndex.position.z = 0.08;
  for (const child of [...b.carrier.children]) { child.geometry?.dispose(); b.carrier.remove(child); }
  const carrier = new THREE.Mesh(boredPlanarLinkGeometry({ length: g.carrierLength, width: 0.17, eyeRadius: 0.14, boreRadius: 0.074, depth: 0.14 }), material);
  carrier.userData.role = 'bored-vibrating-carrier';
  const startCenter = new THREE.Object3D(), endCenter = new THREE.Object3D();
  b.carrier.add(carrier, startCenter, endCenter);
  b.carrier.userData.setEndpoints = (start, end) => {
    carrier.position.set(start.x, start.y, 0.46);
    carrier.rotation.z = Math.atan2(end.y - start.y, end.x - start.x);
    startCenter.position.set(start.x, start.y, 0.46);
    endCenter.position.set(end.x, end.y, 0.46);
  };
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.52, 64), dark);
  hinge.rotation.x = Math.PI / 2; hinge.userData.role = 'actual-carrier-pawl-hinge-shaft'; root.add(hinge);
  const floorPin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.70, 64), dark);
  floorPin.rotation.x = Math.PI / 2; floorPin.position.set(g.carrierPivot.x, g.carrierPivot.y, 0.30);
  floorPin.userData.role = 'actual-fixed-carrier-floor-shaft'; root.add(floorPin);
  // Brown's bell-shaped lug: a rounded head about the floor pin flaring down
  // in concave sides to a broad foot on the hatched ground, which is modelled
  // as a plain ground block (its top 0.314 below the pin, as drawn).
  const groundDrop = 0.314, head = 0.2, foot = 0.42, flare = -0.55;
  const bearing = [];
  for (let i = 0; i <= 48; i++) { const angle = flare + (Math.PI - 2 * flare) * i / 48; bearing.push([head * Math.cos(angle), head * Math.sin(angle)]); }
  const [lx, ly] = bearing.at(-1);
  for (let i = 1; i <= 16; i++) { const t = i / 16, u = t * t; bearing.push([lx + (-foot - lx) * u, ly + (-groundDrop - ly) * t]); }
  const [rx, ry] = bearing[0];
  for (let i = 0; i <= 15; i++) { const t = 1 - i / 16, u = t * t; bearing.push([rx + (foot - rx) * u, ry + (-groundDrop - ry) * t]); }
  replace(b.bottomBearing, plate([[bearing.reverse(), circle([0, 0], 0.074, 64)]], -0.12, 0.18));
  b.bottomBearing.position.z = 0;
  b.bottomBearing.material = matte(PALETTE.frame);
  // Kept inside the framed view (right edge x 2.85, bottom y -2.65).
  const groundLeft = g.carrierPivot.x - 0.9, groundRight = 2.84;
  const ground = groundBlock(groundRight - groundLeft, 0.22, 0.8, { name: 'hatched-ground-under-carrier-lug' });
  ground.material = ground.material[2];
  ground.position.set((groundLeft + groundRight) / 2, g.carrierPivot.y - groundDrop - 0.11, 0.05);
  root.add(ground);
  replace(b.ratchet.userData.hub, ring(0.108, 0.32, -0.1988, 0.1988, 96));
  const index = b.ratchet.userData.indicator;
  replace(index, new THREE.BoxGeometry(0.04, 0.65, 0.012));
  index.position.set(0, 0.9, g.ratchetDepth / 2 + 0.006);
  const journal = new THREE.Mesh(ring(0.108, 0.24, g.pawlPlaneZ - 0.44, g.pawlPlaneZ - 0.24, 96), matte(PALETTE.frame));
  journal.userData.role = 'bored-fixed-output-shaft-journal'; root.add(journal);
  root.userData.workingParts225 = { carrier, hinge, floorPin, journal };
  root.userData.updateWorkingParts225 = state => hinge.position.set(state.pawlPivot.x, state.pawlPivot.y, 0.34);
  root.userData.minimumDisplayCycleSeconds = g.cyclePeriod;
  root.userData.hideGround = true;
  root.userData.reconstructionNote = 'The separately hinged pawl drives a finite rising tooth flank with positive wheel torque, then follows a prescribed lifted return and drop. The wheel is held during return; gravity or spring bias, holding friction, impact and load capacity are not dynamically solved. No animation is registered on the official page.';
  root.traverse(o => { for (const material of [].concat(o.material ?? [])) material.fog = false; });
}
