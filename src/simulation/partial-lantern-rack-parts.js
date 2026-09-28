import * as THREE from 'three';
import data from './baked/partial-lantern-rack.js';
import { plate, poly, circle, capsule, ring, polygonClipping as clip } from './finite-plate-geometry.js';
import { nearest390Outline as nearest } from './dual-band-pawl-contact.js';
import { smoothExtrudeGeometry } from './smooth-extrusion.js';

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
      const witnessAt = (point, distance) => {
        const normal = [(local[0] - point[0]) / distance, (local[1] - point[1]) / distance];
        return { pin, tooth: tooth.index, side: tooth.side, gap: distance - data.pinRadius, normal,
          point: [point[0] + state.frameTranslation.x, point[1]],
          driveForce: -normal[0] * state.frameDirection,
          resistingMoment: center.x * normal[1] - center.y * normal[0] };
      };
      const witness = witnessAt(hit.point, hit.distance);
      if (gap < active) { active = gap; closest = witness; }
      // The root arc is concentric with a pin seated at its cusp, so the
      // single nearest point is degenerate there; the drive witness is the
      // nearest outline sample whose normal drives the frame.
      if (gap > .2) continue;
      for (const point of tooth.outline) {
        const distance = Math.hypot(local[0] - point[0], local[1] - point[1]);
        if (driving && distance - data.pinRadius >= driving.gap) continue;
        const w = witnessAt(point, distance);
        if (w.driveForce > 0 && w.resistingMoment > 0) driving = w;
      }
      if (witness.driveForce > 0 && witness.resistingMoment > 0 && (!driving || gap < driving.gap)) driving = witness;
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
  // Each rack is one extrusion with the frame: the teeth are the frame
  // between identical symmetric pin-envelope spaces (scripts/
  // generate-partial-lantern-rack.mjs). The per-tooth meshes stay as hidden
  // finite-contact witnesses of the same outlines and depth.
  const low = -g.frameDepth / 2, high = g.frameDepth / 2;
  for (const tooth of data.teeth) {
    const mesh = (tooth.side > 0 ? b.topRackTeeth : b.bottomRackTeeth)[tooth.index];
    replace(mesh, plate(poly(tooth.outline), low, high));
    mesh.userData.workingOutline = tooth.outline;
    mesh.visible = false;
    mesh.userData.contactWitnessOnly = 'merged into the rack frame extrusion';
  }
  for (const pin of b.lanternPins) replace(pin, new THREE.CylinderGeometry(g.lanternPinRadius, g.lanternPinRadius, .61, 96));
  for (const hub of b.lanternHubs) replace(hub, ring(.079, .16, -.05, .05, 128), true);
  const reach = g.pinionBodyRadius - .042;
  // The spokes' centre hole lies inside the hub (r .16), clear of the hub's
  // .079 bore wall, which they used to share.
  for (const spoke of b.lanternSpokes) replace(spoke,
    plate(clip.difference(capsule([-reach, 0], [reach, 0], .0325, 16), poly(circle([0, 0], .12, 128))), -.026, .026));
  replace(b.pinionBearing, ring(.079, .26, -.055, .055, 128), true);
  for (const roller of b.guideRollers) {
    const p = roller.userData;
    replace(p.hub, ring(.059, g.guideRollerRadius * .26, -.18125, .18125, 128), true);
    // Keep face indices; the raised tread patch would interrupt smooth rolling.
    for (const child of p.rotor.children) if (child.isMesh && child !== p.hub && child !== p.tread
      && !p.spokes.includes(child) && !p.faceIndicators.includes(child)) child.visible = false;
  }
  // The old bevel expanded the frame through its nominally tangent rollers.
  const sourceShape = [].concat(b.rackFrameBody.geometry.parameters.shapes)[0];
  const { shape: outer, holes } = sourceShape.extractPoints(64);
  const ringOf = points => { const r = points.map(p => [p.x, p.y]); if (r[0][0] !== r.at(-1)[0] || r[0][1] !== r.at(-1)[1]) r.push(r[0]); return r; };
  const frame = [[ringOf(outer), ...holes.map(ringOf)]];
  const merged = clip.union(frame, ...data.teeth.map(tooth => poly(tooth.outline)));
  replace(b.rackFrameBody, smoothExtrudeGeometry(merged.map(([ring, ...rest]) => {
    const shape = new THREE.Shape(ring.slice(0, -1).map(p => new THREE.Vector2(...p)));
    shape.holes = rest.map(h => new THREE.Path(h.slice(0, -1).map(p => new THREE.Vector2(...p))));
    return shape;
  }), g.frameDepth, { low, curveSegments: 1 }));
  b.rackFrameBody.userData.toothProfile = 'both racks in one extrusion: identical symmetric pin-envelope spaces';
  b.contactMarker.visible = false;
  b.contactMarker.userData.referenceOnly = 'nominal pitch point, not finite pin contact';
  d.workingParts = { teeth: [...b.topRackTeeth, ...b.bottomRackTeeth], profiles: data, finiteContactAtState: partialLanternContacts };
  d.hideGround = true;
  d.minimumDisplayCycleSeconds = 8;
  d.sourceAnimation = { ...d.sourceAnimation, available: true, registeredModel: 'mm_199', sourceUrl: 'https://507movements.com/mm_199.html' };
  d.reconstructionNote = 'The four source pins and larger entry teeth are retained. Both racks are one extrusion with the frame, and every tooth space is the same symmetric envelope of a lantern pin through its cusp: a root arc concentric with the seated pin between two near-straight flanks, with flat tips at one height; the source animation’s constant-speed strokes and instantaneous reversals remain prescribed. During roughly the final fifth of each half-stroke, close contact only retards the frame: the nearest positive-drive face is up to 0.092 model units away. Loaded pickup and reversal are not validated.';
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
