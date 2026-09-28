import * as THREE from 'three';
import { bandInvoluteGear, involute } from './band-epicyclic-geometry.js';
import { plate, poly, ring, sector, circle, polygonClipping } from './finite-plate-geometry.js';
import { guernseyContact } from './baked/guernsey-contact.js';

// Partial gears need not have an integer full-circle tooth count. Their
// circular pitch and base pitch match the ten-tooth pinions exactly.
function sectorTooth(radius, internal, module, addendum, depth) {
  const pressure = Math.PI / 6, base = radius * Math.cos(pressure);
  const pitch = Math.PI * module / radius, backlash = .001;
  const root = radius + (internal ? 1 : -1) * (addendum + .006);
  const tip = radius + (internal ? -1 : 1) * addendum;
  const half = r => pitch / 4 - backlash / (2 * radius)
    + (internal ? 1 : -1) * (involute(r / base) - involute(1 / Math.cos(pressure)));
  const points = [], point = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  for (let i = 0; i <= 48; i++) {
    const r = root + (tip - root) * i / 48; points.push(point(r, -half(r)));
  }
  for (let i = 0; i <= 8; i++) points.push(point(tip, -half(tip) + 2 * half(tip) * i / 8));
  for (let i = 48; i >= 0; i--) {
    const r = root + (tip - root) * i / 48; points.push(point(r, half(r)));
  }
  const geometry = plate(poly(points), -depth / 2, depth / 2);
  geometry.userData.involuteSector = { radius, internal, module, addendum, pressure, basePitch: Math.PI * module * Math.cos(pressure) };
  return geometry;
}

export function correctGuernseyWorkingParts(root) {
  const b = root.userData.blocks, g = root.userData.geometry;
  const disposed = new Set();
  const replace = (mesh, geometry) => {
    if (!disposed.has(mesh.geometry)) { disposed.add(mesh.geometry); mesh.geometry.dispose(); }
    mesh.geometry = geometry;
  };
  const bore = (mesh, inner, outer, length) => {
    replace(mesh, ring(inner, outer, -length / 2, length / 2, 96)); mesh.rotation.set(0, 0, 0);
  };
  const addendum = .045, pressure = Math.PI / 6;
  for (const [rack, internal, radius] of [[b.externalRack, false, g.externalSectorPitchRadius], [b.internalRack, true, g.internalSectorPitchRadius]]) {
    const geometry = sectorTooth(radius, internal, g.gearModule, addendum, .18);
    const span = internal ? g.internalSectorSpan : g.externalSectorSpan;
    const angle = internal ? g.leftCenterAngle : g.upperCenterAngle;
    replace(rack.children[0], plate(sector(
      radius + (internal ? addendum + .005 : -.162),
      radius + (internal ? .162 : -addendum - .005),
      angle - span / 2, angle + span / 2), -.088, .088));
    // The body is 0.002 thinner each side than the teeth, whose roots it
    // overlaps: equal faces there z-fought.
    for (const tooth of rack.userData.teeth) {
      replace(tooth, geometry);
      const angle = tooth.rotation.z;
      tooth.position.set(0, 0, 0); tooth.rotation.z = angle;
    }
  }
  for (const balance of [b.upperBalance, b.leftBalance]) {
    const pinion = balance.pinion;
    pinion.traverse(o => { if (o.isMesh) o.visible = false; });
    const r = g.pinionPitchRadius;
    const mesh = new THREE.Mesh(bandInvoluteGear({ teeth: g.pinionTeeth,
      baseRadius: r * Math.cos(pressure),
      baseHalfAngle: Math.PI / (2 * g.pinionTeeth) + involute(1 / Math.cos(pressure)) - .001 / (2 * r),
      rootRadius: r - addendum - .006, tipRadius: r + addendum,
      // The left hub runs right through its pinion, so that pinion is bored
      // clear of the hub's bore wall (the two shared it and z-fought); the
      // pinion's bore lies inside the hub.
      boreRadius: balance === b.leftBalance ? .13 : .074, depth: .18, flankSamples: 48 }), b.externalRack.userData.teeth[0].material);
    mesh.userData.role = 'finite-involute-balance-pinion'; pinion.add(mesh); balance.workingPinion = mesh;
    bore(balance.hub, .074, .19, .32); bore(balance.bearing, .074, .245, .24);
    // The upper hub ends on its pinion's back face instead of running 0.06
    // into the pinion's bore (a shared bore wall that z-fought).
    if (balance === b.upperBalance) { bore(balance.hub, .074, .19, .26); balance.hub.position.z -= .03; }
    balance.spokes.forEach(spoke => { spoke.scale.x = 1.93 / 1.82; });
  }
  // Overlapping projected balance rims occupy separate axial planes. Their
  // pinions retain the common sector plane and the shafts span both levels.
  b.leftBalance.balance.position.z = -.15;
  b.leftBalance.pinion.position.z += .21;
  b.leftBalance.hub.position.z += .21;
  bore(b.leftBalance.hub, .074, .19, .74);

  const head = plate(guernseyContact.heads.flatMap(points => poly(points)), -.025, .13);
  const foot = plate(poly(guernseyContact.rearFoot), -.14, -.024);
  b.escapeWheelFeet = [];
  for (const tooth of b.escapeWheelTeeth) {
    replace(tooth, head);
    const support = new THREE.Mesh(foot, tooth.material);
    support.rotation.copy(tooth.rotation); support.userData.role = 'rear-web-supporting-relieved-escape-head';
    tooth.parent.add(support); b.escapeWheelFeet.push(support);
  }
  b.palletBodies.forEach((pallet, i) => {
    replace(pallet, plate(poly(guernseyContact.profiles[i ? 'lower' : 'upper']), -.09, .09));
  });
  b.anchorArms.forEach((arm, i) => {
    b.palletBodies[i].geometry.computeBoundingBox();
    const target = b.palletBodies[i].geometry.boundingBox.getCenter(new THREE.Vector3());
    replace(arm, new THREE.BoxGeometry(Math.hypot(target.x,target.y), .17, .15));
    arm.position.set(target.x/2,target.y/2,.13); arm.rotation.z=Math.atan2(target.y,target.x);
  });
  b.palletWorkingEdges.forEach(mesh => { mesh.visible = false; });
  b.pitchMarkers.forEach(mesh => { mesh.visible = false; });
  b.palletContactMarker.material.visible = false;
  b.escapeWheelAngularIndex.visible = false;
  // A compact source-like wheel web replaces crossed spokes and floating dots.
  b.escapeWheelSpokes.forEach(mesh => { mesh.visible = false; });
  const web = new THREE.Mesh(ring(.079, g.escapeWheelRootRadius, -.12, .12, 96), b.escapeWheelRim.material);
  b.escapeWheelRotor.add(web); b.escapeWheelWeb = web;
  bore(b.escapeWheelHub, .079, .2, .24 * 1.32);
  bore(b.escapeBearing, .079, .25, .30);
  bore(b.leverHub, .074, .19, .46);
  bore(b.leverBearing, .074, .25, .30);
  // Thin rear bearings previously overlapped the balance rims. Keep support
  // layers behind the rear balance, while the existing arbors remain engaged.
  b.leftBalance.bearing.position.z = -.37;
  b.leftBalance.shaft.position.z = .02;
  root.updateMatrixWorld(true);
  // The beams also need passages: boring only the visible collars would
  // leave their solid underlying frame and arm ends across the same arbors.
  const centers = [g.leverPivot, g.escapeWheelCenter, g.upperBalanceCenter, g.leftBalanceCenter];
  for (const beam of [...b.frameBars, ...b.rackArms, ...b.anchorArms, ...b.upperBalance.spokes, ...b.leftBalance.spokes]) {
    const { width: length, height: width, depth } = beam.geometry.parameters;
    let shape = poly([[-length/2,-width/2],[length/2,-width/2],[length/2,width/2],[-length/2,width/2]]);
    for (const center of centers) {
      const p = beam.worldToLocal(new THREE.Vector3(center.x, center.y, beam.getWorldPosition(new THREE.Vector3()).z));
      shape = polygonClipping.difference(shape, poly(circle([p.x,p.y], .079, 96)));
    }
    replace(beam, plate(shape, -depth/2, depth/2));
  }
  // Brown draws both balances as open rims whose crossing shows the other rim
  // and both racks through them. Pass 56: no glazed film stands in for a web;
  // each rim joins its arbor by a slim bored two-armed bar (the presentation
  // keeps one of the three bars), so the wheels stay open and every part is
  // opaque.
  for (const balance of [b.upperBalance, b.leftBalance]) {
    balance.angularIndex.visible = false;
  }
  root.traverse(o => { for (const m of [o.material].flat().filter(Boolean)) m.fog = false; });
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = 6;
  root.userData.cameraDirection = new THREE.Vector3(.5, .3, 18);
  root.userData.finiteWorkingParts = { gearAddendum: addendum, gearPressureAngle: pressure,
    basePitch: Math.PI * g.gearModule * Math.cos(pressure), contact: guernseyContact.report };
  root.userData.reconstructionNote = 'One rigid anchor and two toothed sectors link the opposed balances. Timing is prescribed. The relieved wheel heads use inferred rear supports; the upper pallet still lacks working holding contact and early lower impulse has a gap, so the complete loaded escapement and its response to shocks are not validated.';
  root.userData.constraints.escapement = 'Finite sided pallets and relieved tooth heads follow a prescribed lock/impulse/drop sequence; upper holding and early lower impulse remain separated, not treated as loaded contact.';
  root.userData.dynamics.idealizations = root.userData.dynamics.idealizations.filter(s => !s.includes('zero-clearance') && !s.includes('zero backlash'));
}
