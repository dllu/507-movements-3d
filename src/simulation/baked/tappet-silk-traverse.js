import {loadBakedBundle} from './playback.js';
import {makeSilkTraverseAssembly} from '../mujoco-silk-tappet/assembly.js';
export async function makeBakedTappetSilkTraverse() {
  return makeSilkTraverseAssembly(await loadBakedBundle(new URL('./assets/173-tappet.json.gz',import.meta.url)));
}
