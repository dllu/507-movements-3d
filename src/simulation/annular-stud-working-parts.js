import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { capsule, circle, plate, poly, polygonClipping, ring } from './finite-plate-geometry.js';
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
    // Brown draws A and B as square lugs stepping inward from the annulus.
    // Each lug keeps the exact tangent working face backed toward the ring,
    // unioned with a block reaching out into the ring whose inner edge, row
    // by row, stays just outside every sampled tooth pose of the beat.
    const wheelOutline = outline.slice(0, -1);
    const beatSamples = 1440;
    const localOutlines = Array.from({ length: beatSamples }, (_, i) => {
      const state = d.stateAtTime(g.pendulumPeriod * i / beatSamples);
      const cw = Math.cos(state.wheelAngle), sw = Math.sin(state.wheelAngle);
      const cp = Math.cos(state.pendulumAngle), sp = Math.sin(state.pendulumAngle);
      const ox = g.wheelCenter.x - g.suspensionPivot.x, oy = g.wheelCenter.y - g.suspensionPivot.y;
      const xs = new Float64Array(wheelOutline.length), ys = new Float64Array(wheelOutline.length);
      wheelOutline.forEach(([x, y], j) => {
        const wx = cw * x - sw * y + ox, wy = sw * x + cw * y + oy;
        xs[j] = cp * wx + sp * wy; ys[j] = -sp * wx + cp * wy;
      });
      return { xs, ys };
    });
    const center = g.pendulumCenterLocal;
    const lugHeight = .34, rowCount = 137, lugClearance = .004;
    for (const [side, pallet] of [[-1, b.leftPallet], [1, b.rightPallet]]) {
      const points = pallet.userData.facePoints;
      const outward = points.map(v => v.clone().sub(center).normalize());
      const face = points.map((v, i) => v.clone().addScaledVector(outward[i], .0001));
      const back = points.map((v, i) => v.clone().addScaledVector(outward[i], .22));
      const faceY = points.reduce((sum, v) => sum + v.y, 0) / points.length;
      const outerX = center.x + side * (g.annulusInnerRadius + .09);
      const innerLimit = center.x + side * (g.annulusInnerRadius - .24);
      // Teeth descend past A and rise past B, so each square lug stands on the
      // far side of its face, as Brown's steps do.
      const rows = Array.from({ length: rowCount }, (_, i) => faceY + side * (-lugHeight + lugHeight * i / (rowCount - 1)))
        .sort((u, v) => u - v);
      const reach = rows.map(() => -Infinity);
      const rowStep = rows[1] - rows[0];
      for (const { xs, ys } of localOutlines) {
        for (let j = 0, n = xs.length; j < n; j++) {
          const k = (j + 1) % n, ax = xs[j], ay = ys[j], cx = xs[k], cy = ys[k];
          if (side * ax < side * innerLimit && side * cx < side * innerLimit) continue;
          const low = Math.min(ay, cy), high = Math.max(ay, cy);
          if (high === low || high < rows[0] || low > rows.at(-1)) continue;
          const first = Math.max(0, Math.ceil((low - rows[0]) / rowStep));
          const last = Math.min(rowCount - 1, Math.floor((high - rows[0]) / rowStep));
          for (let r = first; r <= last; r++) {
            const x = ax + (cx - ax) * (rows[r] - ay) / (cy - ay);
            reach[r] = Math.max(reach[r], side * x);
          }
        }
      }
      const edge = rows.map((y, r) => {
        const worst = Math.max(reach[Math.max(r - 1, 0)], reach[r], reach[Math.min(r + 1, rowCount - 1)]);
        return [side * Math.max(worst + lugClearance, side * innerLimit), y];
      });
      const block = poly([...edge, [outerX, rows.at(-1)], [outerX, rows[0]]]);
      const lug = polygonClipping.union(block, poly([...face, ...back.reverse()].map(v => v.toArray())));
      replace(pallet.userData.body, plate(lug, -g.pendulumDepth / 2, g.pendulumDepth / 2));
      pallet.userData.body.material = b.annulus.material;
      pallet.userData.workingEdge.visible = false;
      p.pairs.push([b.sevenToothDisk, pallet.userData.body]);
    }
    // The short bridges now sit wholly inside the lug/annulus overlap.
    for (const [side, connector] of [[-1, b.leftConnector], [1, b.rightConnector]]) {
      replace(connector, new THREE.BoxGeometry(.1, .12, g.pendulumDepth * .8));
      connector.rotation.set(0, 0, 0);
      const faceY = connector === b.leftConnector
        ? b.leftPallet.userData.facePoints.reduce((s, v) => s + v.y, 0) / b.leftPallet.userData.facePoints.length
        : b.rightPallet.userData.facePoints.reduce((s, v) => s + v.y, 0) / b.rightPallet.userData.facePoints.length;
      connector.position.set(center.x + side * (g.annulusInnerRadius + .03), faceY, 0);
    }
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
    // The concave working blocks are beyond the studs as seen from F. Their
    // long arms pass outside the pin ends, with short axial mounting bosses.
    p.mounts = [];
    for (const [group, side] of [[b.frontPallet, 1], [b.rearPallet, -1]]) {
      const arm = group.children.find(o => o.userData.role.endsWith('long-arm-from-F'));
      const bridge = group.children.find(o => o.userData.role.endsWith('arm-to-working-pallet-bridge'));
      const points = d.lockFacePoints(side);
      const mid = points[Math.floor(points.length / 2)];
      const mountPoint = mid.clone().addScaledVector(mid.clone().normalize(), .28 * .55);
      arm.position.z = side * .96; bridge.position.z = side * .96;
      const mount = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .36, 32), arm.material);
      mount.rotation.x = Math.PI / 2;
      mount.position.set(mountPoint.x, mountPoint.y, side * .81);
      mount.userData.role = `${side > 0 ? 'front' : 'rear'}-axial-pallet-mount`;
      group.add(mount); p.mounts.push(mount);
      for (const edge of group.children.filter(o => o.geometry?.type === 'TubeGeometry')) edge.visible = false;
    }
    replace(b.palletPivotHub, new THREE.CylinderGeometry(.30, .30, 2.16, 64));
    replace(arbor, new THREE.CylinderGeometry(.14, .14, .84, 64));
    arbor.position.z = -1.36;
    replace(b.wheelShaft, new THREE.CylinderGeometry(.14, .14, 2.62, 64));
    b.wheelShaft.position.z = -.50;
    b.wheelBearing.position.z = -1.58; b.palletBearing.position.z = -1.58;
    const axes = [g.wheelCenter.toArray(), g.palletPivot.toArray()];
    const support = capsule(...axes, .25, 48);
    support[0].push(...axes.map(center => circle(center, .146, 64)));
    replace(b.rearStandard, plate(support, -1.87, -1.63));
    b.rearStandard.position.set(0, 0, 0); b.rearStandard.rotation.set(0, 0, 0);
    p.pairs.push([arbor, b.palletBearing], [arbor, b.rearStandard]);
    p.pairs.push([b.palletPivotHub, b.palletBearing], ...b.spokeMeshes.map(spoke => [b.wheelShaft, spoke]));
    replace(b.pivotIndex, new THREE.CircleGeometry(.045, 24));
    b.pivotIndex.position.set(.18, 0, 1.0805);
    replace(b.wheelIndex, new THREE.CircleGeometry(.065, 24));
    b.wheelIndex.position.set(g.studOrbitRadius, 0, .8155);
    d.reconstructionNote = 'The outward-backed pallets oppose clockwise stud motion, with arms outside the pin ends and axial mounting bosses. Small finite working-face interference remains unresolved during the prescribed handoff; this is not contact-validated passive dynamics.';
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
      const a = o.userData.cameraFitExclude ? null : o.geometry?.attributes.position;
      if (a) for (let j = 0; j < a.count; j++) bounds.expandByPoint(point.fromBufferAttribute(a, j).applyMatrix4(o.matrixWorld));
    });
  }
  d.cameraFitBounds = bounds.expandByScalar(.15); update(0);
}
