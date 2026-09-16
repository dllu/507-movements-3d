import * as THREE from 'three';
import { circle, poly, plate, ring, polygonClipping } from './finite-plate-geometry.js';

// The front pawl webs clear the wheel; their integral round toes reach its
// actual working plane. No beveled surface extends into the analytical contact.
export function installAlternatingPawl236(root) {
  const { blocks: b, geometry: g } = root.userData;
  const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
  const pins = [];
  for (const [pawl, plane] of [[b.longPawl, g.longPawlPlaneZ], [b.shortPawl, g.shortPawlPlaneZ]]) {
    const { body, pivotHub, contactFinger, length } = pawl.userData;
    const outline = polygonClipping.union(poly([
      [-0.04, -0.1], [length * 0.16, -0.115], [length - 0.18, -0.065],
      [length + 0.015, 0], [length - 0.17, 0.1], [-0.04, 0.11],
    ]), poly(circle([0, 0], 0.105, 64)));
    replace(body, plate(polygonClipping.difference(outline, poly(circle([0, 0], 0.071, 64))), -0.065, 0.065));
    replace(pivotHub, ring(0.071, 0.105, -0.117, 0.117, 64));
    pivotHub.rotation.set(0, 0, 0);
    const low = -0.08, high = plane + 0.06;
    replace(contactFinger, new THREE.CylinderGeometry(g.pawlNoseRadius, g.pawlNoseRadius, high - low, 192));
    contactFinger.position.z = (low + high) / 2 - plane;
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.94 - (plane - 0.14), 64), pivotHub.material);
    pin.rotation.x = Math.PI / 2;
    pin.position.z = (0.94 + plane - 0.14) / 2 - plane;
    pin.userData.role = `${pawl.userData.role}-hinge-pin`;
    pawl.add(pin); pins.push(pin);
  }
  // Drill the actual lever web as well as its visible eye rings.
  const sourceShape = b.leverBody.geometry.parameters.shapes;
  const outline = poly(sourceShape.getPoints().map(p => [p.x, p.y]));
  const holes = b.leverJoints.map((joint, i) => poly(circle([joint.position.x, joint.position.y], i === 1 ? 0.081 : 0.071, 64)));
  replace(b.leverBody, plate(polygonClipping.difference(outline, ...holes), -0.09, 0.09));
  b.leverJoints.forEach((joint, i) => replace(joint.children[0], ring(i === 1 ? 0.081 : 0.071, 0.14, -0.12, 0.12, 64)));
  b.lever.position.z = 0.87;
  // Axial shoulders separate the independently swinging eyes from the lever.
  const shaft = b.fulcrumShaft.userData.rotor.children.find(o => o.isMesh);
  shaft.geometry.scale(1, 1.12 / 0.82, 1);
  replace(b.ratchet.userData.hub, ring(0.102, 0.34, -0.213, 0.213, 96));
  const index = b.ratchet.userData.indicator;
  replace(index, new THREE.BoxGeometry(0.045, 0.55, 0.012));
  index.position.set(0, 0.8, 0.156);
  root.userData.cameraFitBounds.set(new THREE.Vector3(-4.02, -2.42, -0.65), new THREE.Vector3(2.43, 4.94, 1.2));
  b.activeContactMarker.visible = false;
  root.userData.workingParts236 = { pins };
  root.userData.minimumDisplayCycleSeconds = 6;
  root.userData.hideGround = true;
  root.userData.reconstructionNote = 'Two rounded toes contact real tooth corners and advance the wheel on alternate strokes. Pawl return lift and corner seating are prescribed; hinge bias, contact forces and load capacity are not dynamically solved. The wheel slows to zero at each lever reversal.';
  root.userData.contactQualification236 = {
    contact: 'outer corner of steep rising flank, with outward normal 10 degrees clockwise from radial',
    normalConvention: 'wheel-to-pawl; its negative gives the force on the wheel',
    return: 'smooth prescribed outward hinge lift; no passive spring simulation',
    source: 'Official page checked: no inline animation registration.',
  };
  root.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    for (const material of [].concat(o.material ?? [])) material.fog = false;
  });
}
