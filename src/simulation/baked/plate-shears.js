import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';
export async function makeBakedPlateShears(){
 return makeBakedRigidMovement(await loadBakedBundle(new URL('./assets/130.json.gz',import.meta.url)),{
  mechanism:'gravity-opened-eccentric-plate-shears',note:'The cam closes the shear and the long arm’s weight opens it. Motion is recorded from a gravity-and-contact simulation. The blades pass beside one another, with the cut progressing outward from the throat. Depths and shaft supports are reconstructed.'});
}
