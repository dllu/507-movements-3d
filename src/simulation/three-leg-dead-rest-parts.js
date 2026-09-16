import * as THREE from 'three';
import {plate, poly, polygonClipping as clip} from './finite-plate-geometry.js';

// A bounded correction to the outer dead rests. The separate inner-pin
// impulse and the prescribed transitions are deliberately not qualified here.
export function correctThreeLegDeadRests(root, id) {
  const d = root.userData;
  if (id === 306) {
    for (const marker of d.blocks.toothTips) marker.visible = false;
    d.reconstructionNote = 'The three-legged wheel and S-shaped pallet opening follow the engraving. Motion is prescribed: the finite teeth still intersect the plate during impulse, so this is not a working contact simulation.';
    return;
  }
  const b = d.blocks, g = d.geometry, D = g.centerDistance;
  const radius = Math.hypot(D, g.longToothRadius), gap = 0.0005;
  const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
  // The finite backing must lie above the tip's two supporting tangents.
  // Keeping a symmetric radial spear here penetrates one concentric rest.
  const toothOutline = [[.12,-.055],[1.52,-.055],[1.70,.10],[1.88,0],
    [1.70,.18],[1.50,.055],[.12,.055]];
  for (const tooth of b.longToothMeshes) {
    replace(tooth, plate(poly(toothOutline), -g.wheelDepth/2, g.wheelDepth/2));
    tooth.userData.finiteDeadRestTip = true;
  }
  b.deadStopMounts = [];
  const plateOutline = b.plate.geometry.userData.plate.polygons.map(polygon =>
    polygon.map(ring => ring.map(([x,y]) => [x,y+D])));
  const restProfiles = {};
  for (const [side, mesh, phase, sign] of [
    ['D', b.stopD, 0, 1], ['E', b.stopE, 1, -1],
  ]) {
    const angles = [0, g.releaseHalfPhase].map(p => {
      const s = d.stateAtTime((phase+p)*g.halfBeatDuration);
      const q = d.longToothTipAt(s.wheelAngle,s.startIndex);
      return Math.atan2(q.y-g.palletPivot.y,q.x-g.palletPivot.x)-s.palletAngle;
    });
    const low = Math.min(...angles), high = Math.max(...angles);
    const arc = r => Array.from({length:65},(_,i) => {
      const a = low+(high-low)*i/64;
      return [r*Math.cos(a),D+r*Math.sin(a)];
    });
    const outline = [...arc(radius-sign*gap), ...arc(radius-sign*.13).reverse()];
    replace(mesh, plate(poly(outline), -.08, .08));
    mesh.position.set(0,0,g.lockPlaneZ); mesh.rotation.set(0,0,0);
    mesh.userData.workingFace = 'finite concentric dead rest; transition remains prescribed';
    const footprint = clip.intersection(poly(outline), plateOutline);
    if (!footprint.length) throw new Error(`307 ${side} stop has no plate attachment`);
    const mount = new THREE.Mesh(plate(footprint,g.palletDepth/2-.012,g.lockPlaneZ-.068),mesh.material);
    mount.userData.role = `finite-stop-${side}-mount-to-pallet-plate`;
    b.plateCarrier.add(mount); b.deadStopMounts.push(mount);
    restProfiles[side] = {outline, low, high, faceRadius:radius-sign*gap, sign};
  }
  d.finiteDeadRest = {radius, gap, toothOutline, restProfiles,
    scope:'Outer dead-rest intervals only; finite tips, reaction cones and attachments.',
    residual:'The existing wheel schedule still intersects the stops during release; round inner pins still intersect their impulse backing. No complete working escapement or passive dynamics is claimed.'};
  d.workingPartsReview = {...d.workingPartsReview,
    scope:'Finite concentric outer dead rests, raked supported tooth tips and connected stop mounts; existing journal corrections retained.',
    qualification:'Finite outer dead rests have near contact and a resisting reaction. Release and the round-pin impulse still interfere under the prescribed motion; full transmission is unresolved.'};
  d.reconstructionNote = 'The long front teeth rest on concentric stops D and E; separate rear pins supply impulse at A and B. The outer resting faces and their supports are reconstructed, but the prescribed release and round-pin impulse still intersect their mating parts. This is not a validated working escapement.';
}
