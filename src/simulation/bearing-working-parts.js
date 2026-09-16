import * as THREE from 'three';
import {ring, plate, poly, polygonClipping} from './finite-plate-geometry.js';
import {boredCylinderGeometry, fitPistonGuide} from './piston-guide-parts.js';

function replace(mesh, geometry) {
  mesh.geometry.dispose();
  mesh.geometry = geometry;
}

function pedestalGeometry() {
  // Smooth intended casting edges, fitted to the source proportions. The old
  // pedestal stopped at the bottom of the wheels rather than below them.
  const shape = new THREE.Shape();
  shape.moveTo(-5.45, -12.75);
  shape.lineTo(5.45, -12.75);
  shape.lineTo(5.45, -4.05);
  shape.bezierCurveTo(5.45, -2.55, 3.85, -2.0, 2.75, -3.8);
  shape.quadraticCurveTo(0, -6.55, -2.75, -3.8);
  shape.bezierCurveTo(-3.85, -2.0, -5.45, -2.55, -5.45, -4.05);
  shape.closePath();
  let section = poly(shape.getPoints(32).map(p => p.toArray()));
  for (const sign of [-1, 1]) {
    const window = new THREE.Shape();
    window.moveTo(sign * 4.0, -8.1);
    window.lineTo(sign * 4.0, -5.95);
    window.quadraticCurveTo(sign * 1.35, -5.7, sign * 2.35, -6.65);
    window.closePath();
    section = polygonClipping.difference(section, poly(window.getPoints(24).map(p => p.toArray())));
  }
  const arch = new THREE.Shape();
  arch.moveTo(-3.95, -12.05);
  arch.lineTo(3.95, -12.05);
  arch.bezierCurveTo(3.7, -8.4, 2.9, -7.2, 0, -7.15);
  arch.bezierCurveTo(-2.9, -7.2, -3.7, -8.4, -3.95, -12.05);
  arch.closePath();
  section = polygonClipping.difference(section, poly(arch.getPoints(40).map(p => p.toArray())));
  return plate(section, -.17, .17);
}

function axle(parent, radius, low, high, material, role, x = 0, y = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, high - low, 64), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, (low + high) / 2);
  mesh.userData.role = role;
  parent.add(mesh);
  return mesh;
}

function correctWheelBearing(root) {
  const {blocks: b, geometry: g} = root.userData;
  replace(b.frame, pedestalGeometry());
  b.frame.position.z = 1.75;
  replace(b.base, new THREE.BoxGeometry(11.0, .26, .8));
  b.base.position.set(0, -12.88, 1.65);
  b.supportAxles = [];
  for (const [index, side] of ['left', 'right'].entries()) {
    const z = g.supportWheelAxialPlanes[index];
    const hub = b[`${side}SupportHub`];
    replace(hub, boredCylinderGeometry(g.supportHubRadius, g.supportAxleRadius + .008, .58));
    replace(b[`${side}SupportRim`], ring(g.supportInnerRadius, g.supportOuterRadius, -.2, .2, 256));
    for (const spoke of b[`${side}SupportSpokes`]) {
      const start = g.supportHubRadius - .03, end = g.supportInnerRadius + .03;
      replace(spoke, new THREE.BoxGeometry(end - start, .18, .28));
      const a = spoke.rotation.z;
      spoke.position.set(Math.cos(a) * (start + end) / 2, Math.sin(a) * (start + end) / 2, z);
    }
    b[`${side}SupportIndex`].position.z = z + .23;
    const x = (index ? 1 : -1) * g.supportCenterX;
    b.supportAxles.push(axle(root, g.supportAxleRadius, z - .31, 2.04, b.pivotCaps[index].material,
      `${side}-fixed-axle-through-bored-support-wheel`, x, g.supportCenterY));
    b.pivotCaps[index].position.z = 2.0;
  }
  replace(b.mainFlywheelRim, ring(g.flywheelInnerRadius, g.flywheelOuterRadius, -.2, .2, 256));
  b.mainFlywheelIndex.position.z = b.mainFlywheelRim.position.z + .235;
  b.shaftJournalIndex.position.z = 1.1575;
  // Contact dots label the interface from in front of the shaft, rather than
  // occupying the tangent solids themselves.
  b.contactMarkers.forEach(marker => { marker.position.z = 1.26; });
  root.userData.minimumDisplayCycleSeconds = g.inputCyclePeriod;
  root.userData.workingBearingReview = {
    interfaces: 'Bored support hubs, fixed axles, flat rims and a separated full-height front pedestal.',
    residual: 'No-slip motion is analytical; bearing loads, friction and elastic deformation are not solved. Casting depth and axle fastening are inferred.',
  };
}

function correctRollerBearing(root) {
  const {blocks: b, geometry: g} = root.userData;
  // No bevel may protrude into a working race or belt. A circumscribed inner
  // polygon keeps the finite outer race outside the ideal cylindrical rollers.
  replace(b.pulleyWeb, ring(g.outerRaceInnerRadius / Math.cos(Math.PI / 512), g.pulleyWebOuterRadius,
    -g.pulleyDepth / 2, g.pulleyDepth / 2, 512));
  replace(b.pulleyRim, ring(g.pulleyWebOuterRadius - .12, g.pulleyOuterRadius,
    -g.pulleyRimDepth / 2, g.pulleyRimDepth / 2, 512));
  const inside = g.pulleyOuterRadius / Math.cos(Math.PI / 512);
  const outside = g.pulleyOuterRadius + g.beltThickness;
  const outline = [[-outside, -g.beltLegLength]];
  for (let i = 0; i <= 256; i++) {
    const angle = Math.PI - Math.PI * i / 256;
    outline.push([outside * Math.cos(angle), outside * Math.sin(angle)]);
  }
  outline.push([outside, -g.beltLegLength], [inside, -g.beltLegLength]);
  for (let i = 0; i <= 256; i++) {
    const angle = Math.PI * i / 256;
    outline.push([inside * Math.cos(angle), inside * Math.sin(angle)]);
  }
  outline.push([-inside, -g.beltLegLength]);
  replace(b.belt, plate(poly(outline), -g.beltDepth / 2, g.beltDepth / 2));
  replace(b.innerRace, new THREE.CylinderGeometry(g.innerRaceRadius, g.innerRaceRadius, g.innerRaceDepth, 256));
  replace(b.cagePlate, ring(g.innerRaceRadius + .08, g.outerRaceInnerRadius - .08,
    -g.cageDepth / 2, g.cageDepth / 2, 256));
  b.cageIndex.visible = false;
  b.cagePins = [];
  for (const assembly of b.rollerAssemblies) {
    replace(assembly.body, boredCylinderGeometry(g.rollerBodyRadius, .065, g.rollerDepth));
    replace(assembly.hub, boredCylinderGeometry(.105, .065, g.rollerDepth * 1.1));
    b.cagePins.push(axle(assembly.positionGroup, .060, -.365, .31, assembly.hub.material,
      `retainer-pin-through-roller-${assembly.index + 1}`));
    assembly.faceIndex.position.z = g.rollerDepth / 2 + .02;
  }
  // Hide the invented pedestal: the engraving is an open bearing section and
  // does not specify how its stationary journal is attached to a machine.
  root.remove(b.supportPost, b.supportFoot);
  b.supportPost.visible = b.supportFoot.visible = false;
  b.pulleyIndex.position.x = 1.70;
  replace(b.pulleyIndex, new THREE.BoxGeometry(.48, .075, .055));
  b.pulleyIndex.position.z = g.pulleyDepth / 2 + .0275;
  root.userData.minimumDisplayCycleSeconds = root.userData.timeline.demonstrationPeriod;
  root.userData.workingBearingReview = {
    interfaces: 'Finite cylindrical races, bored rollers and captured retainer pins; exposed cutaway without an invented stand.',
    residual: 'Pure rolling and cage spacing are imposed analytically. Loads, slip, lubrication and cage force response are not solved; historical retainer details remain ambiguous.',
  };
}

export function correctBearingParts(model, id) {
  if (id === 250) correctWheelBearing(model.root);
  else correctRollerBearing(model.root);
  fitPistonGuide(model.root, model.update, model.root.userData.minimumDisplayCycleSeconds);
  model.cameraDirection = new THREE.Vector3(.45, .55, 15);
}
