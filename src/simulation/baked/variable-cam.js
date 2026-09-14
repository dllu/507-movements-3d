import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';
export async function makeBakedVariableCam(){
 return makeBakedRigidMovement(await loadBakedBundle(new URL('./assets/138.json.gz',import.meta.url)),{
  mechanism:'traced-variable-cam-pointed-follower',slideBodies:['follower'],
  note:'A pointed rod follows the shaped cam in two fixed guides. The cam outline follows the engraving; gravity-driven motion is recorded offline, including brief lift-off at sharp corners. Physical size, rear mounting and depths are reconstructed.',
 });
}
