import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';
export async function makeBakedInternalRack(){
 return makeBakedRigidMovement(await loadBakedBundle(new URL('./assets/139.json.gz',import.meta.url)),{
  mechanism:'conjugate-internal-rack-sliding-carriage',slideAxes:{frame:'x',rack:'y',couplerX:'x',coupler:'y'},
  note:'The nine-tooth pinion alternates between the internal rack rows while the rack slides vertically in its carriage. The hand-drawn opening is adjusted for properly meshing teeth. Hidden depths, rear supports and the coupler weight are reconstructed.',
 });
}
