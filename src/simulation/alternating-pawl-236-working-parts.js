import * as THREE from 'three';
import { circle, poly, plate, ring, polygonClipping } from './finite-plate-geometry.js';

// The pawl plates share the wheel's plane and their integral round toes bear
// on its teeth. No beveled surface extends into the analytical contact.
// c's eye bushing ends at 0.42 + 0.117; the lever plate (0.18 deep) rests on it.
const LEVER_BACK_Z = 0.539;
const LEVER_Z = LEVER_BACK_Z + 0.09;

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
    // p101: the lever's back face sits on c's eye bushing, and b's eye
    // carries a boss of its own colour forward to the same face, so neither
    // pawl hangs on a bare length of pin behind the lever.
    const front = LEVER_BACK_Z - plane;
    replace(pivotHub, ring(0.071, 0.105, -0.117, Math.max(0.117, front), 64));
    pivotHub.rotation.set(0, 0, 0);
    if (front > 0.117 + 1e-6) {
      const boss = new THREE.Mesh(ring(0.105, 0.14, 0.064, front, 64), body.material);
      boss.userData.role = `${pawl.userData.role}-eye-boss-to-lever`;
      pawl.add(boss);
    }
    const pinTop = LEVER_Z + 0.14;
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, pinTop - (plane - 0.14), 64), pivotHub.material);
    pin.rotation.x = Math.PI / 2;
    pin.position.z = (pinTop + plane - 0.14) / 2 - plane;
    pin.userData.role = `${pawl.userData.role}-hinge-pin`;
    pawl.add(pin); pins.push(pin);
  }
  // Drill the actual lever web as well as its visible eye rings.
  const sourceShape = b.leverBody.geometry.parameters.shapes;
  const outline = poly(sourceShape.getPoints().map(p => [p.x, p.y]));
  // The web's holes stand 0.002 outside the eye rings' bores, so the two bores
  // are not coincident surfaces.
  const holes = b.leverJoints.map((joint, i) => poly(circle([joint.position.x, joint.position.y], i === 1 ? 0.083 : 0.073, 64)));
  replace(b.leverBody, plate(polygonClipping.difference(outline, ...holes), -0.09, 0.09));
  // The eye rings stand proud of the lever's front only; behind, the lever's
  // own back face bears on the pawl eyes (the joints sit 0.02 forward).
  b.leverJoints.forEach((joint, i) => replace(joint.children[0], ring(i === 1 ? 0.081 : 0.071, 0.14, -0.105, 0.1, 64)));
  b.lever.position.z = LEVER_Z;
  // Brown draws fulcrum a and the wheel arbor as plain pins with no studs,
  // bosses or framing, so each fixed pin is only as long as the parts it
  // carries: a clears the lever's joint eye and the arbor the wheel's hub.
  const shaft = b.fulcrumShaft.userData.rotor.children.find(o => o.isMesh);
  shaft.geometry.scale(1, 0.28 / 0.82, 1);
  b.fulcrumShaft.position.z = LEVER_Z + 0.02;
  b.fulcrumShaft.userData.length = 0.28;
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
  root.userData.reconstructionNote = 'Two straight flat pawls in the wheel plane seat their rounded toes in the tooth roots and advance the wheel on alternate strokes. The ratchet wheel is treated as a flywheel (p101): it never stands. Each pawl drives it at a steady speed; a little before each end of the swing the lever slows to reverse, the pawl falls behind and the wheel coasts on, losing 12% of its speed, while the hand turns the lever over quickly and the other pawl slides down the tooth back into its root and catches its face at the wheel\'s own speed. The wheel speed and lever reversals are prescribed (quintic reversals meeting the strokes with continuous angle, speed and acceleration; the lever turns exactly at Brown\'s drawn top), not integrated from inertia and load. A returning pawl is tracked as a rigid plate resting on the moving teeth under a prescribed inward angular acceleration, and rests exactly on the back of its V next to each separation and catch. Contact forces, hinge bias, flywheel inertia and load are not dynamically solved.';
  root.userData.contactQualification236 = {
    contact: 'rounded toe seated in the root, touching the steep face and the previous tooth back; drive normal is the face normal',
    normalConvention: 'wheel-to-pawl; its negative gives the force on the wheel',
    return: 'idle pawl tracked continuously on the tooth outline with prescribed-acceleration drops; the flywheel coasts on (at no less than 88% of its driving speed) until the returning toe, seated in its root, catches its face',
    source: 'Official page checked: no inline animation registration.',
  };
  root.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    for (const material of [].concat(o.material ?? [])) material.fog = false;
  });
}
