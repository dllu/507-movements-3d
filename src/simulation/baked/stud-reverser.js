import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';
export function makeStudReverserModel(bundle){
 const model=makeBakedRigidMovement(bundle,{mechanism:'passive-stud-disk-bar-reverser',slideAxes:{bar:'x'},note:'The disk studs push the bar forward and operate the elbow for its return. A raised inner arm lets each stud pass beneath it; gravity resets the elbow onto a stop. The hidden depth relief, bearings, bar guides and guide resistance are reconstructed.'});
 model.root.userData.cameraFov=18;model.root.userData.reconstructionStatus='reconstructed';return model;
}
export async function makeBakedStudReverser(){return makeStudReverserModel(await loadBakedBundle(new URL('./assets/153.json.gz',import.meta.url)));}
