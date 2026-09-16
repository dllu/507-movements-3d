import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { circle, plate, poly, ring } from './finite-plate-geometry.js';
import { markShadows } from './primitives.js';

const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
const journal = (outer, bore, length) => boredLatheGeometry([
  { radial: outer, axial: -length / 2 }, { radial: outer, axial: length / 2 },
], bore, 64);

// Common finite shaft interfaces and framing; only 290's working contact is
// qualified here. The 292 handoff needs a separate profile/timing reconstruction.
export function correctAnnularStudEscapement(root, id, update) {
  const d = root.userData, b = d.blocks, g = d.geometry, p = { pairs: [] };
  if (id === 290) {
    const outline = b.sevenToothDisk.geometry.parameters.shapes.getPoints().map(v => v.toArray());
    replace(b.sevenToothDisk, plate([[outline, circle([0, 0], .126, 64)]], -g.wheelDepth / 2, g.wheelDepth / 2));
    replace(b.annulus, ring(g.annulusInnerRadius, g.annulusInnerRadius + 2 * g.annulusTubeRadius,
      -g.pendulumDepth / 2, g.pendulumDepth / 2, 192));
    for (const pallet of [b.leftPallet, b.rightPallet]) {
      // Backing belongs outside the wheel, not radially away from the remote
      // suspension pivot. The latter put the left block through a tooth.
      const points = pallet.userData.facePoints;
      const outward = points.map(v => v.clone().sub(g.pendulumCenterLocal).normalize());
      const face = points.map((v, i) => v.clone().addScaledVector(outward[i], .0001));
      const back = points.map((v, i) => v.clone().addScaledVector(outward[i], .22));
      replace(pallet.userData.body, plate(poly([...face, ...back.reverse()].map(v => v.toArray())), -.24, .24));
      pallet.userData.workingEdge.visible = false;
      p.pairs.push([b.sevenToothDisk, pallet.userData.body]);
    }
    // The short bridges overlap both backing and annulus, in front of the
    // wheel's swept face. No unsupported hairline contact extensions.
    for (const connector of [b.leftConnector, b.rightConnector]) connector.position.z = .18;
    p.pairs.push(...[b.annulus, b.leftConnector, b.rightConnector, b.upperRod, b.lowerRod]
      .map(part => [b.sevenToothDisk, part]));
    replace(b.wheelHub, journal(.27, .126, .76));
    replace(b.wheelShaft, new THREE.CylinderGeometry(.12, .12, 1.45, 64));
    b.wheelShaft.position.z = -.075;
    replace(b.wheelBearing, journal(.31, .126, .40).rotateX(Math.PI / 2));
    b.wheelBearing.position.z = -.70;
    replace(b.suspensionBearing, journal(.30, .126, .50).rotateX(Math.PI / 2));
    b.suspensionBearing.position.z = -.65;
    const arbor = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 1.42, 64), b.suspensionHub.material);
    arbor.rotation.x = Math.PI / 2; arbor.position.z = -.27;
    arbor.userData.role = 'pendulum-arbor-through-fixed-suspension-journal';
    b.annularPendulum.add(arbor); p.arbor = arbor;
    p.pairs.push([arbor, b.suspensionBearing], [arbor, b.rearStandard], [b.wheelShaft, b.sevenToothDisk]);
    p.pairs.push([b.suspensionHub, b.suspensionBearing]);
    b.pendulumIndex.visible = false;
    replace(b.wheelIndex, new THREE.CircleGeometry(.075, 24));
    b.wheelIndex.position.z = g.wheelDepth / 2 + .0005;
    // Shorten the invented stand to the two supported axes; the original plate
    // has no long pedestal below the pendulum.
    const low = g.wheelCenter.y - .35, high = g.suspensionPivot.y + .35;
    replace(b.rearStandard, new THREE.BoxGeometry(.21, high - low, .24));
    b.rearStandard.position.set(0, (low + high) / 2, -.95);
    b.rearStandard.rotation.set(0, 0, 0);
    d.reconstructionNote = 'Finite wheel and outward-backed pallets retain the prescribed recoil and drop path. Landing velocity changes are idealized; pendulum energy, friction and impacts are not passively simulated.';
  } else {
    replace(b.wheelRim, ring(g.wheelInnerRadius, g.wheelOuterRadius,
      -g.wheelDepth / 2, g.wheelDepth / 2, 192));
    // Spokes terminate inside the solid hub and rim, without crossing the bore.
    for (const spoke of b.spokeMeshes) {
      replace(spoke, new THREE.BoxGeometry(2.70, .25, g.wheelDepth * .84));
      spoke.position.set(1.65 * Math.cos(spoke.rotation.z), 1.65 * Math.sin(spoke.rotation.z), 0);
    }
    replace(b.wheelHub, journal(.42, .146, .78));
    for (const bearing of [b.wheelBearing, b.palletBearing]) {
      replace(bearing, journal(bearing === b.wheelBearing ? .40 : .37, .146, .44).rotateX(Math.PI / 2));
    }
    b.palletBearing.position.z = -1.04;
    const arbor = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .38, 64), b.palletPivotHub.material);
    arbor.rotation.x = Math.PI / 2; arbor.position.z = -.74;
    arbor.userData.role = 'pallet-arbor-extension-through-fixed-journal';
    b.palletAssembly.add(arbor); p.arbor = arbor;
    p.pairs.push([arbor, b.palletBearing], [arbor, b.rearStandard]);
    p.pairs.push([b.palletPivotHub, b.palletBearing], ...b.spokeMeshes.map(spoke => [b.wheelShaft, spoke]));
    replace(b.pivotIndex, new THREE.CircleGeometry(.045, 24));
    b.pivotIndex.position.set(.18, 0, .8105);
    replace(b.wheelIndex, new THREE.CircleGeometry(.065, 24));
    b.wheelIndex.position.set(g.studOrbitRadius, 0, .8155);
    d.reconstructionNote = 'The wheel has alternating front/rear studs and concentric locking faces. Shaft interfaces and spoke attachments are corrected, but finite stud/pallet and arm interference remains unresolved during the prescribed handoff; this is not contact-validated passive dynamics.';
  }
  p.pairs.push([b.wheelShaft, b.wheelHub], [b.wheelShaft, b.wheelBearing], [b.wheelShaft, b.rearStandard]);
  b.base.visible = false; b.cameraEnvelope.visible = false;
  replace(b.contactMarker, new THREE.SphereGeometry(.035, 12, 8));
  d.hideGround = true; d.minimumDisplayCycleSeconds = 4;
  d.cameraDirection = new THREE.Vector3(0, .12, 15);
  d.cameraFov = 8; d.cameraDistanceScale = .85;
  d.annularStudWorkingParts = p;
  root.traverse(o => { for (const mat of [].concat(o.material ?? [])) mat.fog = false; });
  markShadows(root);
  for (const marker of [b.contactMarker, b.wheelIndex, b.pivotIndex].filter(Boolean)) {
    marker.castShadow = false; marker.receiveShadow = false;
    if (marker.geometry.type === 'CircleGeometry') {
      marker.material = marker.material.clone();
      marker.material.polygonOffset = true;
      marker.material.polygonOffsetFactor = -1;
      marker.material.polygonOffsetUnits = -1;
    }
  }
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  for (let i = 0; i <= 32; i++) {
    update(g.pendulumPeriod * i / 32); root.updateMatrixWorld(true);
    root.traverseVisible(o => {
      const a = o.geometry?.attributes.position;
      if (a) for (let j = 0; j < a.count; j++) bounds.expandByPoint(point.fromBufferAttribute(a, j).applyMatrix4(o.matrixWorld));
    });
  }
  d.cameraFitBounds = bounds.expandByScalar(.15); update(0);
}
