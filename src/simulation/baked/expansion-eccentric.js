import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';

export async function makeBakedExpansionEccentric(){
  return makeBakedRigidMovement(await loadBakedBundle(new URL('./assets/137.json.gz',import.meta.url)),{
    mechanism:'shaped-expansion-eccentric',
    note:'The shaped cam rocks a fork with two freely turning rollers; the valve rod hangs from the lower pin. Motion is recorded from a gravity-and-contact simulation. The fork pivots in the eye of the hanging support drawn at the right. The partly hidden cam contour, roller spacing, depths and support stem are reconstructed.',
  });
}
