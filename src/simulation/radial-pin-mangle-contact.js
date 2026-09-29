import * as THREE from 'three';
import profile from './baked/radial-pin-mangle-pinion.js';
import { smoothExtrudeGeometry } from './smooth-extrusion.js';

// p99: 194's pinion is the offline envelope of Brown's 22 pins (radial
// stadium studs, round studs at the two ends) cut through the prescribed
// rolling law over the whole cycle (both runs and both reversals), with
// ten-fold symmetry: see scripts/generate-radial-pin-mangle-pinion.mjs.
// One flat extrusion over the pinion's full face.
export function fitRadialPinManglePinion(root) {
  const d = root.userData, b = d.blocks, gear = b.pinion.userData.rotor.children[0];
  gear.geometry.dispose();
  const shape = new THREE.Shape(profile.points.map(([x, y]) => new THREE.Vector2(x, y)));
  // Solid: the pinion is fast on its shaft, which runs straight through it
  // (a bore of the shaft's own radius would leave coincident walls).
  const geometry = smoothExtrudeGeometry(shape, 0.37, { low: -0.185, curveSegments: 96 });
  geometry.parameters = { shapes: shape, options: { depth: 0.37, bevelEnabled: false } };
  geometry.userData.pinionOutline = profile.points;
  geometry.userData.toothProfile = 'offline-envelope-of-radial-stadium-pins-and-round-end-studs';
  gear.geometry = geometry;
  gear.userData.role = 'finite-radial-pin-envelope-mangle-pinion';
  b.pinion.userData.toothProfile = 'offline-envelope-of-radial-stadium-pins-and-round-end-studs';
  b.pinion.userData.outerRadius = profile.max;
  b.pinion.userData.rootRadius = profile.min;
  d.radialPinContact = {
    teeth: profile.teeth, rotationalSymmetry: profile.rotationalSymmetry,
    outerRadius: profile.max, rootRadius: profile.min, cutterClearance: profile.clearance,
    pinCount: profile.pinCount, pinHalfLength: profile.pinHalfLength, pinRadius: profile.pinRadius,
    endStudRadius: profile.endStudRadius, motion: 'prescribed-ideal-rolling',
  };
}

export function discloseRadialPinMangleContact(root) {
  root.userData.reconstructionNote = 'Brown\'s 22 radial pins stand on the face as flat stadium studs; the two end pins, about which the pinion swings at each reversal, are round studs, since an oblong pin cannot turn half a revolution in a tooth space. The 10-tooth pinion is cut offline as the envelope of every pin through the prescribed rolling law over both runs and both reversals. In the sampled audit some pin stays within 0.006 of the pinion throughout (the reversals are held within the 0.0005 cutting clearance); contact alternates between the flanks, so a loaded wheel would ripple slightly (not simulated). The blind guide and the front universal drive reconstruct hidden depth; forces are not simulated.';
}
