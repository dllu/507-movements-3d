import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { capsule, circle, plate, poly, polygonClipping, ring } from './finite-plate-geometry.js';
import { markShadows } from './primitives.js';

const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
const journal = (radius, bore, length) => boredLatheGeometry([
  { radial: radius, axial: -length / 2 }, { radial: radius, axial: length / 2 },
], bore, 64);

// Structural corrections only: the two working pallets and their prescribed
// release still need a compatible finite-contact reconstruction.
export function correctLanternWorkingParts(root, update) {
  const d = root.userData, b = d.blocks, g = d.geometry, p = { pairs: [] };
  for (const part of b.sidePlates) {
    replace(part, ring(g.wheelInnerRadius, g.wheelOuterRadius,
      -g.sidePlateDepth / 2, g.sidePlateDepth / 2, 192));
  }
  for (const spoke of b.sidePlateSpokes) {
    replace(spoke, new THREE.BoxGeometry(2.45, .16, g.sidePlateDepth * .82));
    spoke.position.x = 1.575 * Math.cos(spoke.rotation.z);
    spoke.position.y = 1.575 * Math.sin(spoke.rotation.z);
  }
  for (const hub of b.wheelHubs) replace(hub, journal(.47, .166, .30));
  replace(b.wheelShaft, new THREE.CylinderGeometry(.16, .16, 2.80, 64));
  b.wheelShaft.position.z = -.20;
  for (const bearing of [b.wheelBearing, b.armBearing]) {
    replace(bearing, journal(bearing === b.wheelBearing ? .43 : .37, .166, .50).rotateX(Math.PI / 2));
    bearing.position.z = -1.24;
  }
  const armArbor = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .80, 64), b.armHub.material);
  armArbor.rotation.x = Math.PI / 2; armArbor.position.z = -1.25;
  armArbor.userData.role = 'arm-A-arbor-reaching-rear-journal';
  b.armAssembly.add(armArbor); p.armArbor = armArbor;
  const a = g.wheelCenter.toArray(), c = g.armPivot.toArray();
  const frame = polygonClipping.difference(
    polygonClipping.union(capsule(a, c, .13, 32), poly(circle(a, .43, 64)), poly(circle(c, .37, 64))),
    poly(circle(a, .166, 64)), poly(circle(c, .166, 64)),
  );
  replace(b.standard, plate(frame, -1.60, -1.36));
  b.standard.position.set(0, 0, 0); b.standard.rotation.set(0, 0, 0);
  b.standard.userData.role = 'fixed-bored-rear-plate-joining-both-arbor-bearings';
  p.pairs.push([b.wheelShaft, b.wheelBearing], [b.wheelShaft, b.standard],
    [armArbor, b.armBearing], [armArbor, b.standard], [b.armHub, b.armBearing],
    ...b.wheelHubs.map(hub => [b.wheelShaft, hub]),
    ...b.sidePlateSpokes.map(spoke => [b.wheelShaft, spoke]));
  b.base.visible = false; b.cameraEnvelope.visible = false; b.armIndex.visible = false;
  // Paint the indicators onto existing faces rather than adding protruding
  // rings and balls in the pallet's working region.
  for (const [marker, radius, z] of [[b.wheelIndex, .09, g.trundleLength / 2 + .0005],
    [b.rimIndex, .075, g.sidePlateOffset + g.sidePlateDepth / 2 + .0005]]) {
    replace(marker, new THREE.CircleGeometry(radius, 24)); marker.position.z = z;
    marker.material = marker.material.clone(); marker.material.polygonOffset = true;
    marker.material.polygonOffsetFactor = -1; marker.material.polygonOffsetUnits = -1;
  }
  for (const pallet of [b.palletB, b.palletC]) {
    for (const child of pallet.children) if (/label-marker/.test(child.userData.role)) child.visible = false;
  }
  replace(b.contactMarker, new THREE.SphereGeometry(.035, 12, 8));
  d.lanternWorkingParts = p;
  d.reconstructionNote = 'The eight-trundle wheel has connected end rings, spokes and bored supports. Pallet motion remains illustrative: finite interference and the release/contact-force direction still need reconstruction; this is not a validated passive escapement.';
  d.hideGround = true; d.minimumDisplayCycleSeconds = 4;
  d.cameraDirection = new THREE.Vector3(0, .12, 15);
  d.cameraFov = 8; d.cameraDistanceScale = .85;
  root.traverse(o => { for (const mat of [].concat(o.material ?? [])) mat.fog = false; });
  markShadows(root);
  for (const marker of [b.wheelIndex, b.rimIndex, b.contactMarker]) {
    marker.castShadow = false; marker.receiveShadow = false;
  }
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  for (let i = 0; i <= 32; i++) {
    update(g.armPeriod * i / 32); root.updateMatrixWorld(true);
    root.traverseVisible(o => { const a = o.geometry?.attributes.position;
      if (a) for (let j = 0; j < a.count; j++) bounds.expandByPoint(point.fromBufferAttribute(a, j).applyMatrix4(o.matrixWorld)); });
  }
  d.cameraFitBounds = bounds.expandByScalar(.15); update(0);
}
