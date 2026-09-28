import * as THREE from 'three';
import { circle, poly, plate, ring, polygonClipping } from './finite-plate-geometry.js';

// The pawl plates share the wheel's plane and their integral round toes bear
// on its teeth. No beveled surface extends into the analytical contact.
export function installAlternatingPawl236(root) {
  const { blocks: b, geometry: g } = root.userData;
  const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
  const pins = [];
  for (const [pawl, plane] of [[b.longPawl, g.longPawlPlaneZ], [b.shortPawl, g.shortPawlPlaneZ]]) {
    const { body, pivotHub, length } = pawl.userData;
    // Brown's straight pawls b and c lie in the wheel's plane; each ends in
    // a wedge whose rounded toe, of the working nose radius, seats in the
    // tooth root. No cranked foot or cross-pin reaches back.
    const r = g.pawlNoseRadius, toe = [], [toeFrom, toeTo] = g.pawlToeArc(length);
    for (let i = 0; i <= 24; i++) {
      const angle = toeFrom + (toeTo - toeFrom) * i / 24;
      toe.push([length + r * Math.cos(angle), r * Math.sin(angle)]);
    }
    // The same flanks bound the idle pawl's riding solve in the kinematics.
    // The trailing edge tapers toward the toe so the next tooth's tip passes
    // clear of it at the end of the stroke.
    const [lower, upper] = g.pawlFlankPolylines(length);
    const outline = polygonClipping.union(poly([
      ...lower.slice(1).reverse(), ...toe, ...upper.slice(1),
    // A round eye boss with a solid wall round the hinge pin's bore.
    ]), poly(circle([0, 0], 0.14, 64)));
    replace(body, plate(polygonClipping.difference(outline, poly(circle([0, 0], 0.075, 64))), -0.065, 0.065)); // bore opened past the hub's own bore
    replace(pivotHub, ring(0.071, 0.105, -0.117, 0.117, 64));
    pivotHub.rotation.set(0, 0, 0);
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
  // Brown draws fulcrum a and the wheel arbor as plain pins with no studs,
  // bosses or framing, so each fixed pin is only as long as the parts it
  // carries: a clears the lever's joint eye and the arbor the wheel's hub.
  const shaft = b.fulcrumShaft.userData.rotor.children.find(o => o.isMesh);
  shaft.geometry.scale(1, 0.34 / 0.82, 1);
  b.fulcrumShaft.position.z = 0.83;
  b.fulcrumShaft.userData.length = 0.34;
  const arbor = b.ratchetShaft.userData.rotor.children.find(o => o.isMesh);
  arbor.geometry.scale(1, 0.56 / 0.96, 1);
  b.ratchetShaft.position.z = b.ratchet.position.z;
  b.ratchetShaft.userData.length = 0.56;
  replace(b.ratchet.userData.hub, ring(0.102, 0.34, -0.213, 0.213, 96));
  const index = b.ratchet.userData.indicator;
  replace(index, new THREE.BoxGeometry(0.045, 0.55, 0.012));
  index.position.set(0, 0.8, g.ratchetDepth / 2 + 0.006);
  // Frame the lever's whole swing: its handle rises 2A above the drawn pose.
  const bounds = new THREE.Box3(new THREE.Vector3(-4.02, -2.42, -0.65), new THREE.Vector3(2.43, 4.94, 1.2));
  for (const angle of [g.leverBias - g.leverAmplitude, g.leverBias, g.leverBias + g.leverAmplitude]) {
    const handle = g.sourceHandlePoint.clone().sub(g.fulcrum).rotateAround(new THREE.Vector2(), angle).add(g.fulcrum);
    bounds.expandByPoint(new THREE.Vector3(handle.x, handle.y + 0.15, 0));
  }
  root.userData.cameraFitBounds.copy(bounds);
  b.activeContactMarker.visible = false;
  root.userData.workingParts236 = { pins };
  root.userData.minimumDisplayCycleSeconds = 6;
  root.userData.hideGround = true;
  root.userData.reconstructionNote = 'Two straight flat pawls in the wheel plane seat their rounded toes in the tooth roots and advance the wheel on alternate strokes. The drive is re-phased so that Brown\'s drawn pose is the handoff (b seated at the end of its stroke, c about to engage). A returning pawl is tracked as a rigid plate resting on the moving teeth under a prescribed inward angular acceleration: it slides up the tooth backs, drops off each crest over several frames and runs on past its root; after each lever reversal the wheel stands while it slides back down into the root (its backlash) and meets the face. Contact forces, hinge bias and load capacity are not dynamically solved.';
  root.userData.contactQualification236 = {
    contact: 'rounded toe seated in the root, touching the steep face and the previous tooth back; drive normal is the face normal',
    normalConvention: 'wheel-to-pawl; its negative gives the force on the wheel',
    return: 'idle pawl tracked continuously on the tooth outline with prescribed-acceleration drops; the wheel stands until the returning toe reaches its root',
    source: 'Official page checked: no inline animation registration.',
  };
  root.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    for (const material of [].concat(o.material ?? [])) material.fog = false;
  });
}
