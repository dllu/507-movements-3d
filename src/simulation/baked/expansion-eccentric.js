import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';

export async function makeBakedExpansionEccentric(){
  return makeBakedRigidMovement(await loadBakedBundle(new URL('./assets/137.json.gz',import.meta.url)),{
    mechanism:'shaped-expansion-eccentric',
    note:'The smooth shaped cam bears on both freely turning rollers at once, rocking the fork positively; the valve rod hangs from the lower pin. Motion is recorded from a gravity-and-contact simulation. The fork pivots in the eye of the hanging support drawn at the right. The cam edge keeps Brown\'s three dimples as shallow hollows, shaped so that one fork can follow it with both rollers (constant pitch diameter); its hidden arcs, the 4-pixel roller spread, depths and support stem are reconstructed.',
  });
}
