import * as THREE from 'three';
import {loadBakedBundle} from './playback.js';
import {makeDiagonalCatchPlayback} from './diagonal-catch-playback.js';

export function makeBakedDiagonalCatchModel(bundle,id=181){
 return makeDiagonalCatchPlayback(new THREE.ObjectLoader().parse(bundle.object),bundle,id);
}

export async function makeBakedDiagonalCatch(id){
 return makeBakedDiagonalCatchModel(await loadBakedBundle(new URL('./assets/181.json.gz',import.meta.url)),id);
}
