import * as THREE from 'three';
import { circle, plate, ring } from './finite-plate-geometry.js';
import { boredPlanarLinkGeometry } from './bored-planar-link.js';
import { nearest390Outline } from './dual-band-pawl-contact.js';
import { matte, PALETTE } from './primitives.js';

// The rising edge is the positive-torque face. The long trailing edge used
// by clockwise mechanisms (such as 284) would drive the opposite direction.
export function carrierPawlFlank225({ outerRadius, rootRadius, pitch, noseRadius }) {
  const root = new THREE.Vector2(rootRadius, 0);
  const tip = new THREE.Vector2(outerRadius * Math.cos(0.16 * pitch), outerRadius * Math.sin(0.16 * pitch));
  const edge = tip.clone().sub(root), normal = new THREE.Vector2(edge.y, -edge.x).normalize();
  const point = root.clone().lerp(tip, 0.58), clearance = 0.0002;
  const center = point.clone().addScaledVector(normal, noseRadius + clearance);
  return { root, tip, point, normal, center, radius: center.length(), angle: Math.atan2(center.y, center.x), clearance };
}
export function carrierPawlClearance225(center, wheelAngle, outline, noseRadius) {
  const c = Math.cos(wheelAngle), s = Math.sin(wheelAngle);
  return nearest390Outline([c * center.x + s * center.y, -s * center.x + c * center.y], outline).distance - noseRadius;
}

export function installCarrierPawl225(root) {
  const { blocks: b, geometry: g } = root.userData;
  const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
  const material = b.pawlBody.material, dark = b.pawlNose.material;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(g.pawlLength * 0.45, -0.16, 0), new THREE.Vector3(g.pawlLength, 0, 0)]);
  // A single ordered perimeter avoids unions between tangent capsule arcs,
  // which can fail ring reconstruction under browser floating-point arithmetic.
  const points = curve.getPoints(24).map(p => [p.x, p.y]);
  const widths = points.map(([x]) => 0.045 + 0.095 * Math.max(0, 1 - x / 0.25) ** 2);
  const outline = points.map(([x, y], i) => [x, y + widths[i]]);
  for (let i = 1; i <= 16; i++) {
    const angle = Math.PI / 2 - Math.PI * i / 16;
    outline.push([g.pawlLength + 0.045 * Math.cos(angle), 0.045 * Math.sin(angle)]);
  }
  outline.push(...points.slice(0, -1).reverse().map(([x, y], i) => [x, y - widths[points.length - 2 - i]]));
  for (let i = 1; i < 32; i++) {
    const angle = -Math.PI / 2 - Math.PI * i / 32;
    outline.push([0.14 * Math.cos(angle), 0.14 * Math.sin(angle)]);
  }
  replace(b.pawlBody, plate([[outline, circle([0, 0], 0.074, 64)]], -0.065, 0.065));
  replace(b.pawlNose, new THREE.CylinderGeometry(g.pawlNoseRadius, g.pawlNoseRadius, g.pawlNoseDepth, 128));
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
  const start = -Math.acos(0.10 / 0.19);
  const bearing = Array.from({ length: 65 }, (_, i) => {
    const angle = start + (Math.PI - 2 * start) * i / 64;
    return [0.19 * Math.cos(angle), 0.19 * Math.sin(angle)];
  });
  bearing.push([-0.10, -0.27], [0.10, -0.27]);
  replace(b.bottomBearing, plate([[bearing, circle([0, 0], 0.074, 64)]], -0.12, 0.18));
  b.bottomBearing.position.z = 0;
  replace(b.ratchet.userData.hub, ring(0.108, 0.32, -0.1988, 0.1988, 96));
  const index = b.ratchet.userData.indicator;
  replace(index, new THREE.BoxGeometry(0.04, 0.65, 0.012));
  index.position.set(0, 0.9, g.ratchetDepth / 2 + 0.006);
  const journal = new THREE.Mesh(ring(0.108, 0.24, -0.44, -0.24, 96), matte(PALETTE.frame));
  journal.userData.role = 'bored-fixed-output-shaft-journal'; root.add(journal);
  root.userData.workingParts225 = { carrier, hinge, floorPin, journal };
  root.userData.updateWorkingParts225 = state => hinge.position.set(state.pawlPivot.x, state.pawlPivot.y, 0.34);
  root.userData.minimumDisplayCycleSeconds = g.cyclePeriod;
  root.userData.hideGround = true;
  root.userData.reconstructionNote = 'The separately hinged pawl drives a finite rising tooth flank with positive wheel torque, then follows a prescribed lifted return and drop. The wheel is held during return; gravity or spring bias, holding friction, impact and load capacity are not dynamically solved. No animation is registered on the official page.';
  root.traverse(o => { for (const material of [].concat(o.material ?? [])) material.fog = false; });
}
