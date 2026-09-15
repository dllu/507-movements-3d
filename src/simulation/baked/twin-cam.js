import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';
export function makeTwinCamModel(bundle){
 const model=makeBakedRigidMovement(bundle,{mechanism:'twin-cam-guided-outputs',slideBodies:['upperSlide','lowerSlide'],note:'The cams alternately lift the levers; gravity returns them. Pinned rods drive vertical sliders. The lower guides, rear bearings and obscured portions of the cam outlines are reconstructed and are not shown in the engraving.'});
 model.root.userData.reconstructionStatus='reconstructed';
 return model;
}
export async function makeBakedTwinCam(){return makeTwinCamModel(await loadBakedBundle(new URL('./assets/149.json.gz',import.meta.url)));}
