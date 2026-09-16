import profile from './baked/radial-pin-mangle-pinion.js';
import {poly,plate,circle,polygonClipping as clip} from './finite-plate-geometry.js';

export function fitRadialPinManglePinion(root) {
  const d=root.userData,b=d.blocks,gear=b.pinion.userData.rotor.children[0];
  // Retain the original full 0.37 axial extent, including its former bevel
  // limits, so the pinion still overlaps the real radial pins and their seats.
  gear.geometry.dispose();
  gear.geometry=plate(clip.difference(poly(profile.points),poly(circle([0,0],.055,96))),-.185,.185);
  gear.userData.role='finite-radial-pin-envelope-mangle-pinion';
  b.pinion.userData.toothProfile='offline-finite-radial-capsule-envelope';
  d.radialPinContact={teeth:profile.teeth,rotationalSymmetry:profile.rotationalSymmetry,outerRadius:profile.max,rootRadius:profile.min,
    cutterClearance:profile.clearance,sourcePinsRetained:true,motion:'prescribed-ideal-rolling',status:'partial'};
}

export function discloseRadialPinMangleContact(root) {
  root.userData.reconstructionNote='The single radial pin row and all finite pin seats are retained. Its pinion is cut offline against both runs and both reversals, with five repeated tooth pairs. Prescribed ideal rolling leaves up to 0.00821 model-unit working separation in the sampled audit. A trial loaded-flank seating law jumps about 0.0221 rad at the terminal pin handoff with a small departing moment, so it is not used. Blind guide and front-side universal depth are reconstructed; forces and passive pickup remain unsolved.';
}
