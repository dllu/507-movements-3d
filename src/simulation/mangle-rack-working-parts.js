import * as THREE from 'three';
import profiles from './baked/mangle-rack-working-profiles.js';
import { capsule, circle, plate, poly, polygonClipping, ring, sector } from './finite-plate-geometry.js';
import { boredPlanarLinkGeometry } from './bored-planar-link.js';
import { PALETTE, matte, markShadows } from './primitives.js';

const capsuleOutline = (length, radius) => capsule([0, 0], [length, 0], radius, 128);
const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
const mesh = (geometry, color, role) => { const value = new THREE.Mesh(geometry, matte(color)); value.userData.role = role; return value; };
function clearChildren(group) { for (const child of [...group.children]) { child.geometry?.dispose(); group.remove(child); } }
function boredPinion(b, id) {
  const gear = b.pinion.userData.rotor.children[0];
  const radius = id === 197 ? 0.075 : 0.083;
  const points = id === 197 ? profiles[197].points : gear.geometry.parameters.shapes.getPoints().map(p => p.toArray());
  if (id === 198) gear.userData.sourceOutline = points;
  replace(gear, plate(polygonClipping.difference(poly(points), poly(circle([0, 0], radius, 96))), id === 197 ? -0.17 : -0.19, id === 197 ? 0.17 : 0.19));
  gear.userData.role = id === 197 ? 'generated-ten-tooth-pin-rack-pinion' : 'bored-six-tooth-endless-rack-pinion';
  const hub = b.pinion.userData.rotor.children[1];
  // The keyed hub rotates with its shaft; the finite opening still represents
  // the real shaft/body interface instead of two overlapping full cylinders.
  const bounds = new THREE.Box3().setFromBufferAttribute(hub.geometry.attributes.position);
  const depth = bounds.max.y - bounds.min.y, outer = bounds.max.x;
  replace(hub, ring(radius, outer, -depth / 2, depth / 2, 96));
  hub.rotation.set(0, 0, 0);
}
function finish197(root) {
  const { blocks: b, geometry: g } = root.userData;
  boredPinion(b, 197);
  for (const rim of b.rackPinRims) { replace(rim, ring(0.065, 0.086, -0.007, 0.007, 64)); rim.position.z = 0.27; }
  for (const [guide, side] of [[b.leftEndGuide, -1], [b.rightEndGuide, 1]]) {
    const start = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    replace(guide, plate(sector(g.guideRailCenterRadius - g.guideRailRadius, g.guideRailCenterRadius + g.guideRailRadius, start, start + Math.PI, 128), 0.415, 0.545));
    guide.position.set(side * g.straightRackLength / 2, 0, 0);
    const reach = g.straightRackLength / 2 + g.guideRailCenterRadius;
    // The mount rises from the frame's end member itself (0.11 wide, centred
    // on outerFrameHalfWidth), so it no longer pokes out past the short ends.
    // A flat bracket carries each guide arc at its apex from a standard that
    // stands on the solid frame plate just inside the end member, so nothing
    // reaches past the frame's short ends. The standard clears the pinion's
    // furthest reach at the end turns (3.575 from the frame centre) by 0.025.
    const inner = 3.6, outer = g.outerFrameHalfWidth - 0.08;
    const support = mesh(new THREE.BoxGeometry(outer - reach, 0.3, 0.13), PALETTE.driven, 'front-end-guide-mount');
    support.position.set(side * (outer + reach) / 2, 0, 0.48);
    const post = mesh(new THREE.BoxGeometry(outer - inner, 0.3, 0.9), PALETTE.driven, 'axial-end-guide-frame-mount');
    post.position.set(side * (outer + inner) / 2, 0, 0.066);
    const web = mesh(new THREE.BoxGeometry(g.outerFrameHalfWidth - g.straightRackLength / 2, 0.13, 0.18), PALETTE.driven, 'rear-rack-frame-web');
    web.position.set(side * (g.outerFrameHalfWidth + g.straightRackLength / 2) / 2, 0, -0.32);
    b.rackAssembly.add(support, post, web);
  }
  // Brown's square frame is one solid plate: the capsule rack sits on its
  // face and the C-shaped end guides stand off it on the side mounts. The
  // pinion shaft is driven from the front, so nothing passes through it.
  // The plate takes a pale tint of the frame's blue so the rack and guides
  // on its face stay legible, as on Brown's white plate.
  const plateHalfWidth = g.outerFrameHalfWidth - 0.05, plateHalfHeight = g.outerFrameHalfHeight - 0.05;
  const backPlate = mesh(plate(poly([[-plateHalfWidth, -plateHalfHeight], [plateHalfWidth, -plateHalfHeight],
    [plateHalfWidth, plateHalfHeight], [-plateHalfWidth, plateHalfHeight]]), -0.47, -0.384), 0x9db8c7, 'solid-plate-of-reciprocating-square-frame');
  b.rackAssembly.add(backPlate);
  {
    const shaftMesh = b.pinionShaft.userData.rotor.children[0];
    const radius = shaftMesh.geometry.parameters.radiusTop;
    // Shaft runs from the pinion hub's back face (z = -0.11) forward past the collar.
    replace(shaftMesh, new THREE.CylinderGeometry(radius, radius, 0.73, 22).translate(0, 0.335, 0));
  }
  replace(b.shaftGuideFollower, ring(0.075, g.guideFollowerOuterRadius, -0.065, 0.065, 128));
  const slider = poly([[-0.285, -0.115], [0.285, -0.115], [0.285, 0.115], [-0.285, 0.115]]);
  replace(b.shaftSlider, plate(polygonClipping.difference(slider, poly(circle([0, 0], 0.076, 64))), -0.08, 0.08));
}
function finish198(root) {
  const { blocks: b, geometry: g } = root.userData, data = profiles[198], length = g.straightRackLength;
  boredPinion(b, 198);
  b.rackTeeth.forEach((tooth, index) => {
    const indexes = Array.from({ length: data.perTooth + 1 }, (_, j) => (index * data.perTooth + j) % data.points.length);
    const boundary = [...indexes.map(i => data.points[i]), ...[...indexes].reverse().map(i => data.outside[i])];
    const c = Math.cos(-tooth.rotation.z), s = Math.sin(-tooth.rotation.z);
    const local = boundary.map(p => { const x = p[0] - tooth.position.x, y = p[1] - tooth.position.y; return [c * x - s * y, s * x + c * y]; });
    replace(tooth, plate(poly(local), -0.14, 0.14));
  });
  replace(b.toothRootRail, plate(polygonClipping.difference(capsuleOutline(length, 1.12), capsuleOutline(length, 1.075)), -0.36, 0.16));
  replace(b.carrierPlate, plate(polygonClipping.difference(capsuleOutline(length, 3 * g.pinionPitchRadius), capsuleOutline(length, g.pinionPitchRadius + 0.089)), -0.50, -0.3432));
  replace(b.slotRail, plate(polygonClipping.difference(capsuleOutline(length, g.pinionPitchRadius + 0.12), capsuleOutline(length, g.pinionPitchRadius + 0.089)), -0.36, -0.25));
  b.carrierCrossTie.position.z = 0.97; // original tie geometry is centered at z=-0.15
  for (const sign of [-1, 1]) {
    const post = mesh(new THREE.BoxGeometry(0.15, 0.15, 1.3), PALETTE.driven, 'front-cross-tie-end-mount');
    post.position.set(length / 2, sign * 3 * g.pinionPitchRadius, 0.20);
    b.rackCarrier.add(post);
  }
  replace(b.pinionBearing, ring(0.084, 0.21, -0.08, 0.08, 96));
  b.pinionBearing.position.z = -0.75;
  for (const rod of [b.topSuspensionRod, b.bottomSuspensionRod]) {
    clearChildren(rod);
    const link = mesh(boredPlanarLinkGeometry({ length: g.linkLength, width: 0.13, eyeRadius: 0.18, boreRadius: 0.138, depth: 0.14 }), PALETTE.driver, 'bored-mangle-suspension-link');
    const startCenter = new THREE.Object3D(), endCenter = new THREE.Object3D();
    rod.add(link, startCenter, endCenter);
    rod.userData.setEndpoints = (start, end) => { link.position.copy(start); link.rotation.z = Math.atan2(end.y - start.y, end.x - start.x); startCenter.position.copy(start); endCenter.position.copy(end); };
  }
  // The engraved frame pivots are carried on the side posts, at the front
  // suspension plane; the former short markers did not reach either rod.
  for (const pin of b.framePivotMarkers) { replace(pin, new THREE.CylinderGeometry(0.13, 0.13, 1.40, 48)); pin.position.z = -0.11; }
  for (const pin of b.carrierPivotMarkers) { replace(pin, new THREE.CylinderGeometry(0.135, 0.135, 0.9, 48)); pin.position.z = 0.12; }
  b.guideRollers.forEach((roller, i) => {
    const oldY = roller.position.y;
    const rotor = roller.userData.rotor;
    // Brown draws the four guide rollers as plain discs with a small centre;
    // the open spoked rim becomes a solid web out to the tread.
    const rim = rotor.children.find(o => o.userData.role === 'open-pulley-rim');
    if (rim) {
      rim.updateMatrix();
      const box = new THREE.Box3().setFromBufferAttribute(rim.geometry.attributes.position).applyMatrix4(rim.matrix);
      const outer = (box.max.x - box.min.x) / 2;
      replace(rim, ring(g.guideRollerRadius * 0.26 - 0.002, outer, box.min.z, box.max.z, 128));
      rim.rotation.set(0, 0, 0);
      rim.userData.role = 'plain-disc-guide-roller-web';
      for (const spoke of rotor.children.filter(o => o.userData.role === 'radial-pulley-spoke')) { spoke.geometry.dispose(); rotor.remove(spoke); }
    }
    const patch = rotor.children.find(o => o.geometry?.type === 'BoxGeometry' && !o.userData.role && o.position.z === 0);
    if (patch) patch.position.x -= 0.006;
    const hub = roller.userData.hub;
    replace(hub, ring(0.061, g.guideRollerRadius * 0.26, -0.16675, 0.16675, 96));
    hub.rotation.set(0, 0, 0);
    let radius = 0;
    roller.userData.rotor.traverse(o => { if (!o.isMesh) return; o.updateMatrix(); const p = o.geometry.attributes.position;
      for (let k = 0; k < p.count; k++) { const q = new THREE.Vector3().fromBufferAttribute(p, k).applyMatrix4(o.matrix); radius = Math.max(radius, Math.hypot(q.x, q.y)); } });
    roller.position.y = roller.userData.verticalSign * (g.frameHalfHeight + 0.0525 + radius + 0.002);
    b.guideRollerShafts[i].position.y += roller.position.y - oldY;
    g.guideRollerY = Math.abs(roller.position.y);
  });
}

export function finishMangleRackWorkingParts(root, update, id) {
  if (id === 197) finish197(root); else finish198(root);
  const wrappedUpdate = time => { update(time); if (id === 197) root.userData.blocks.shaftGuideFollower.position.z = 0.48; };
  const d = root.userData;
  d.minimumDisplayCycleSeconds = 9;
  d.hideGround = true;
  d.sourceAnimation = { available: true, registeredModel: `mm_${id}`, sourceUrl: `https://507movements.com/mm_${id}.html` };
  d.reconstructionNote = id === 197
    ? 'Ten finite pinion teeth are cut offline against the eleven full-radius rack pins. The rising and falling shaft, opposite straight runs and counterclockwise motor follow the registered source topology and direction. Motion is prescribed; guide loads, friction and passive branch selection are not dynamically solved.'
    : 'The closed rack teeth are cut offline against the six-tooth pinion, retaining the two suspension links and fixed shaft. The shaft passes through a finite clearance opening and behind the front cross-tie. Rigid linkage closure and driving motion are prescribed; loads, friction and compliance are not dynamically solved.';
  d.finiteWorkingProfile = profiles[id];
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  for (let i = 0; i <= 48; i++) { wrappedUpdate(d.transmission.cyclePeriod * i / 48); root.updateMatrixWorld(true); root.traverse(o => {
    if (!o.isMesh || !o.visible || !o.material.visible) return;
    const p = o.geometry.attributes.position;
    for (let j = 0; j < p.count; j++) bounds.expandByPoint(point.fromBufferAttribute(p, j).applyMatrix4(o.matrixWorld));
  }); }
  // The whole sweep is kept as sweptBounds. The frame travels most of its own
  // length, so fitting that sweep left the plate's subject small and off
  // centre; the camera instead fits the source pose, as Brown frames it, and
  // the far end of the frame runs out of view near the ends of its stroke.
  d.sweptBounds = bounds.expandByScalar(0.05);
  const pose = new THREE.Box3();
  wrappedUpdate(0); root.updateMatrixWorld(true); root.traverse(o => {
    if (!o.isMesh || !o.visible || !o.material.visible) return;
    const p = o.geometry.attributes.position;
    for (let j = 0; j < p.count; j++) pose.expandByPoint(point.fromBufferAttribute(p, j).applyMatrix4(o.matrixWorld));
  });
  d.cameraFitBounds = pose.expandByScalar(0.12); d.cameraDistanceScale = 1.02;
  // 197's square frame travels most of its own length; fitting only the
  // source pose let a third of the frame slide out of view. Frame the whole
  // travel of the presented frame instead.
  if (id === 197) { d.cameraFitBounds = d.sweptBounds.clone(); d.cameraDistanceScale = 1; }
  root.traverse(o => { for (const material of [].concat(o.material ?? [])) material.fog = false; });
  wrappedUpdate(0); markShadows(root);
  // Brown draws the rack pins as plain circles on the rack face; their long
  // stems otherwise throw a row of diagonal stripes across it.
  if (id === 197) for (const pin of [...d.blocks.rackPins, ...d.blocks.rackPinRims]) pin.traverse(o => { o.castShadow = false; });
  return { root, update: wrappedUpdate, cameraDirection: new THREE.Vector3(1.2, 0.7, 18) };
}
