import * as THREE from 'three';
import { capsule, circle, plate, poly, polygonClipping as clip, ring } from './finite-plate-geometry.js';
import { markShadows } from './primitives.js';
const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
function borePlate(mesh, holes, depth) {
  const shape = mesh.geometry.parameters.shapes;
  const outline = poly(shape.getPoints(1).map(p => p.toArray()));
  replace(mesh, plate(clip.difference(outline, ...holes.map(([center, radius]) => poly(circle(center, radius, 64)))), -depth / 2, depth / 2));
}
export function correctQuadrantCatchInterfaces(root, originalUpdate) {
  const d = root.userData, b = d.blocks, g = d.geometry;
  const parts = { sleeves: [], boredPlates: [], journals: [], axialLayers: { upper: -.20, lower: .16 }, workingContactQualified: false };
  const quadrantZ = { upper: .44, lower: .76 };
  // Each weight rod lies just behind its handle's eye, so the plate's upper
  // rod passes behind the upper quadrant.
  const weightRodPlaneZ = { upper: -.38, lower: -.02 };
  const weightRodBottomY = { upper: d.source183PointToModel(new THREE.Vector2(400, 478)).y,
    lower: d.source183PointToModel(new THREE.Vector2(142, 506)).y };
  Object.assign(g, { upperHandlePlaneZ: -.20, lowerHandlePlaneZ: .16, upperQuadrantPlaneZ: .44, lowerQuadrantPlaneZ: .76, frameCenterZ: -.73, frameDepth: .14,
    weightRodPlaneZ, weightRodBottomY });
  for (const side of ['upper', 'lower']) {
    const body = b[`${side}Handle`], z = parts.axialLayers[side], pivot = g[`${side}Pivot`];
    body.position.z = z;
    const quadrant = b[`${side}Quadrant`]; quadrant.position.z = quadrantZ[side] - z;
    for (const key of ['HandleWorkingArm', 'HandleWeightArm', 'QuadrantStartSpoke', 'QuadrantEndSpoke']) {
      const group = b[`${side}${key}`], mesh = group.children.find(o => o.isMesh && /-plate$/.test(o.userData.role));
      const holes = [[[0, 0], .116]];
      if (key === 'HandleWeightArm') holes.push([g[`${side}WeightLocal`].toArray(), .052]);
      borePlate(mesh, holes, key.startsWith('Quadrant') ? .2068 : key === 'HandleWeightArm' ? .176 : .20);
      parts.boredPlates.push(mesh);
    }
    const hub = b[`${side}HandleHub`];
    replace(hub, ring(.116, .42, -.118, .118, 96)); hub.rotation.set(0, 0, 0);
    const sleeve = new THREE.Mesh(ring(.116, .23, 0, quadrantZ[side] - z + .10, 64), hub.material);
    sleeve.userData.role = `${side}-bored-sleeve-joining-handle-and-quadrant-web`;
    body.add(sleeve); parts.sleeves.push(sleeve);
    const shaft = b[`${side}PivotShaft`];
    replace(shaft, new THREE.CylinderGeometry(.11, .11, 1.82, 64)); shaft.position.z = .11;
    b[`${side}PivotHead`].position.z = 1.085; b[`${side}PivotSlot`].visible = false;
    const journal = new THREE.Mesh(ring(.116, .25, -.79, -.57, 64), b.frameSpine.material);
    journal.position.set(pivot.x, pivot.y, 0); journal.userData.role = `${side}-fixed-bored-quadrant-shaft-journal`;
    root.add(journal); parts.journals.push(journal);
    const eye = body.children.find(o => /back-weight-eye$/.test(o.userData.role));
    replace(eye, ring(.052, .16, -.112, .112, 64)); eye.position.z = 0;
    // Brown draws each back-weight rod hanging from its eye and running off
    // the plate; the upper rod passes behind its quadrant. No weight block is
    // drawn, so the rod is a broken-end section down to the plate's edge.
    const connector = b[`${side}WeightConnector`], rodZ = weightRodPlaneZ[side] - z;
    // The pin runs from the eye's front face back to the rod's front face.
    replace(connector, new THREE.CylinderGeometry(.045, .045, .112 - rodZ - .05, 48));
    connector.position.z = (.112 + rodZ + .05) / 2;
    const rod = b[`${side}WeightRod`];
    replace(rod, new THREE.BoxGeometry(.125, 1, .10));
    rod.position.z = rodZ;
    rod.userData.role = `${side}-quadrant-handle-hanging-back-weight-broken-end-rod`;
    b[`${side}Weight`].position.z = rodZ;
    b[`${side}Weight`].visible = false;
    b[`${side}HandleIndex`].visible = false; b[`${side}QuadrantIndex`].visible = false;
  }
  // Preserve the old working-pair XY geometry for the next coupled transfer
  // reconstruction. These full pins still overlap both finite quadrant bands.
  b.upperBottomSeatPin.position.z = .60 - parts.axialLayers.upper;
  b.lowerTopSeatPin.position.z = .60 - parts.axialLayers.lower;
  const support = clip.difference(clip.union(capsule(g.upperPivot.toArray(), g.lowerPivot.toArray(), .10, 24),
    poly(circle(g.upperPivot.toArray(), .25, 64)), poly(circle(g.lowerPivot.toArray(), .25, 64))),
    poly(circle(g.upperPivot.toArray(), .116, 64)), poly(circle(g.lowerPivot.toArray(), .116, 64)));
  replace(b.frameSpine, plate(support, -.80, -.66)); b.frameSpine.position.set(0, 0, 0);
  b.frameSpine.userData.role = 'compact-bored-rear-support-joining-two-fixed-journals';
  b.pistonGuide.visible = false; b.upperCrossbar.visible = false; b.lowerCrossbar.visible = false;
  const x = g.pistonRodX, half = .20;
  replace(b.pistonRod, plate(poly([[x-half,-3.10],[x-.06,-3.03],[x+.04,-3.13],[x+half,-3.06],
    [x+half,3.10],[x+.04,3.03],[x-.06,3.13],[x-half,3.06]]), -.77, -.53));
  b.pistonRod.position.set(0, 0, 0);
  b.pistonRod.userData.role = 'source-width-sectioned-piston-rod';
  // The tappet rides on the rod's front face rather than through its section.
  replace(b.tappet, new THREE.BoxGeometry(g.tappetShoeRightX - (x-half), 2*g.tappetHalfHeight, .85));
  b.tappet.position.set((g.tappetShoeRightX+x-half)/2, 0, -.105); b.tappetIndex.visible = false;
  // Raised decorative tubes are not mechanical stock. Actual plates retain
  // their original finite XY boundaries, with bores cut through them.
  root.traverse(o => { if (/dark-outline$|arc-outline$|dark-hub-ring$/.test(o.userData.role ?? '')) o.visible = false; });
  const update = time => {
    originalUpdate(time);
    b.pistonRod.position.y = -b.pistonGroup.position.y;
    b.tappetContactMarker.position.z = g.lowerQuadrantPlaneZ + g.lowerQuadrantDepth / 2 + .18;
    for (const side of ['upper', 'lower']) {
      const assembly = b[`${side}WeightAssembly`], rod = b[`${side}WeightRod`];
      assembly.position.z = parts.axialLayers[side];
      const length = Math.max(.05, assembly.position.y - weightRodBottomY[side]);
      rod.scale.y = length + .06; rod.position.y = (.06 - length) / 2;
    }
  };
  d.quadrantFiniteInterfaces = parts;
  d.reconstructionNote = 'The source-width rod is shown as a broken-end section; its tappet moves along that section. Separate handle planes, bored hubs/plates, connected sleeves and journals repair structural collisions. The full retaining pins and quadrant bands remain visible and still interfere during the prescribed synchronized transfer. Their release order and passive weight-driven handoff are unresolved; this is not a validated catch or a production MuJoCo bake.';
  d.minimumDisplayCycleSeconds = 12; d.hideGround = true;
  d.cameraDirection = new THREE.Vector3(0, .12, 18); d.cameraFov = 8; d.cameraDistanceScale = .88;
  root.traverse(o => { for (const material of [].concat(o.material ?? [])) material.fog = false; }); markShadows(root);
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  for (let i = 0; i <= 64; i++) {
    update(g.cyclePeriod*i/64); root.updateMatrixWorld(true);
    root.traverseVisible(o => { const a = o.geometry?.attributes.position;
      if (a) for (let j=0;j<a.count;j++) bounds.expandByPoint(point.fromBufferAttribute(a,j).applyMatrix4(o.matrixWorld)); });
  }
  d.cameraFitBounds = bounds.expandByScalar(.12);
  d.sampledMotionBounds = { min: bounds.min.toArray(), max: bounds.max.toArray() }; update(0);
  return update;
}
