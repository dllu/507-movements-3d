import * as THREE from 'three';
import data from './baked/partial-lantern-rack.js';
import { plate, poly, circle, capsule, ring, polygonClipping as clip } from './finite-plate-geometry.js';
import { nearest390Outline as nearest } from './dual-band-pawl-contact.js';

// These are finite geometric witnesses, not a solved unilateral transmission.
export function partialLanternContacts(state) {
  let minimum = Infinity, active = Infinity, inactive = Infinity, driving = null, closest = null;
  const activeSide = state.upperRackActive ? 1 : -1;
  for (const [pin, center] of state.lanternPinCenters.entries()) {
    const local = [center.x - state.frameTranslation.x, center.y];
    for (const tooth of data.teeth) {
      const hit = nearest(local, tooth.outline), gap = hit.distance - data.pinRadius;
      minimum = Math.min(minimum, gap);
      if (tooth.side !== activeSide) { inactive = Math.min(inactive, gap); continue; }
      const normal = [(local[0] - hit.point[0]) / hit.distance, (local[1] - hit.point[1]) / hit.distance];
      const driveForce = -normal[0] * state.frameDirection;
      const resistingMoment = center.x * normal[1] - center.y * normal[0];
      const witness = { pin, tooth: tooth.index, side: tooth.side, gap, normal,
        point: [hit.point[0] + state.frameTranslation.x, hit.point[1]], driveForce, resistingMoment };
      if (gap < active) { active = gap; closest = witness; }
      if (driveForce > 0 && resistingMoment > 0 && (!driving || gap < driving.gap)) driving = witness;
    }
  }
  return { minimum, active, inactive, closest, driving,
    hasClosePositiveDrive: !!driving && driving.gap < .002,
    loadedTransferValidated: false };
}

export function finishPartialLanternRack(root, update) {
  const d = root.userData, b = d.blocks, g = d.geometry;
  const replace = (mesh, geometry, reset = false) => {
    const old = mesh.geometry; mesh.geometry = geometry; old.dispose();
    if (reset) mesh.rotation.set(0, 0, 0);
  };
  for (const tooth of data.teeth) {
    const mesh = (tooth.side > 0 ? b.topRackTeeth : b.bottomRackTeeth)[tooth.index];
    replace(mesh, plate(poly(tooth.outline), -.145, .195));
    mesh.userData.workingOutline = tooth.outline;
  }
  for (const pin of b.lanternPins) replace(pin, new THREE.CylinderGeometry(g.lanternPinRadius, g.lanternPinRadius, .61, 96));
  for (const hub of b.lanternHubs) replace(hub, ring(.079, .16, -.05, .05, 128), true);
  const reach = g.pinionBodyRadius - .042;
  for (const spoke of b.lanternSpokes) replace(spoke,
    plate(clip.difference(capsule([-reach, 0], [reach, 0], .0325, 16), poly(circle([0, 0], .079, 128))), -.026, .026));
  replace(b.pinionBearing, ring(.079, .26, -.055, .055, 128), true);
  for (const roller of b.guideRollers) {
    const p = roller.userData;
    replace(p.hub, ring(.059, g.guideRollerRadius * .26, -.18125, .18125, 128), true);
    // Keep face indices; the raised tread patch would interrupt smooth rolling.
    for (const child of p.rotor.children) if (child.isMesh && child !== p.hub && child !== p.tread
      && !p.spokes.includes(child) && !p.faceIndicators.includes(child)) child.visible = false;
  }
  // The old bevel expanded the frame through its nominally tangent rollers.
  const sourceShape = b.rackFrameBody.geometry.parameters.shapes;
  replace(b.rackFrameBody, new THREE.ExtrudeGeometry(sourceShape, { depth: g.frameDepth, bevelEnabled: false, curveSegments: 64 }).translate(0, 0, -g.frameDepth / 2));
  b.contactMarker.visible = false;
  b.contactMarker.userData.referenceOnly = 'nominal pitch point, not finite pin contact';
  d.workingParts = { teeth: [...b.topRackTeeth, ...b.bottomRackTeeth], profiles: data, finiteContactAtState: partialLanternContacts };
  d.hideGround = true;
  d.minimumDisplayCycleSeconds = 8;
  d.sourceAnimation = { ...d.sourceAnimation, available: true, registeredModel: 'mm_199', sourceUrl: 'https://507movements.com/mm_199.html' };
  d.reconstructionNote = 'The four source pins and larger entry teeth are retained. Finite rack flanks are reconstructed; the source animation’s constant-speed strokes and instantaneous reversals remain prescribed. During roughly the final fifth of each half-stroke, close contact only retards the frame: the nearest positive-drive face is up to 0.092 model units away. Loaded pickup and reversal are not validated.';
  d.contactQualification = { finiteFlanksCorrected: true, loadedTransmissionValidated: false,
    stateAtInputTravelContactFields: 'nominal original-source pitch construction; use workingParts.finiteContactAtState for rendered surfaces',
    failedTransferPhase: .99951171875, maximumPositiveDriveGap: .0918035114 };
  root.traverse(o => { if (o.isMesh) for (const material of [].concat(o.material)) material.fog = false; });
  return time => {
    update(time);
    const contact = partialLanternContacts(d.kinematics);
    d.kinematics.finiteContact = contact;
    d.contacts.partialLanternPinionRackMesh = { ...d.contacts.partialLanternPinionRackMesh,
      nominalPitchConstruction: true, finiteContact: contact, loadedTransmissionValidated: false };
  };
}
