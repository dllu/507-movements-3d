import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';
export async function makeBakedThreeWiper(){
 const bundle=await loadBakedBundle(new URL('./assets/128.json.gz',import.meta.url));
 return makeBakedRigidMovement(bundle,{mechanism:'three-wiper-contact-driven-frame',slideAxes:{frame:'x'},
  note:'Three wipers push the frame through its curved faces. Motion is recorded from a contact simulation with friction in the ideal guides. Frame contours follow the engraving; depths, mass and friction are reconstructed. Each back-and-forth stroke takes two seconds.'});
}
