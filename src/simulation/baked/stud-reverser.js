import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';
export function makeStudReverserModel(bundle){
 const model=makeBakedRigidMovement(bundle,{mechanism:'passive-stud-disk-bar-reverser',slideAxes:{bar:'x'},note:'The disk studs push the bar forward and operate the elbow for its return. A raised inner arm lets each stud pass beneath it; gravity resets the elbow onto a stop. The hidden depth relief, bearings, bar guides and guide resistance are reconstructed.'});
 // Presentation only: Brown draws no elbow stop, so hide the fixed grey stop
 // under the elbow pivot (the only frame-grey fixed mesh); the recorded
 // motion still comes to rest on it.
 model.root.children[0]?.children?.forEach(o=>{if(o.isMesh&&o.material.color?.getHex()===0x59605f)o.visible=false;});
 model.root.userData.cameraFov=18;model.root.userData.reconstructionStatus='reconstructed';return model;
}
export async function makeBakedStudReverser(){return makeStudReverserModel(await loadBakedBundle(new URL('./assets/153.json.gz',import.meta.url)));}
