import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';
export async function makeBakedSectorHandoff(){
 const bundle=await loadBakedBundle(new URL('./assets/123.json.gz',import.meta.url));
 const visual=makeBakedRigidMovement(bundle,{mechanism:'baked-sector-handoff',slideBodies:['rack'],note:'The double rack alternately drives two sectors through tooth contact. Motion is recorded from a validated simulation. Section view reveals the curved piece catching each stop. Equal spur gears, relieved sector ends and a rephased transfer piece correct inconsistencies in the engraving; depths, bearings and the rack guide are reconstructed.'});
 const root=visual.root,rack=root.getObjectByName('rack'),outline=root.getObjectByName('section-outline-of-double-rack');
 root.userData.setSectionView=enabled=>{root.userData.sectionView=Boolean(enabled);rack.visible=!enabled;outline.visible=Boolean(enabled);};
 root.userData.setSectionView(false);
 // Brown draws the sectors and double rack in a flat face view.
 visual.cameraDirection.set(.02,.015,1);
 // Fit the sectors, spur gears and the rack's source-pose length. The rack
 // runs partly out of frame at the ends of its sweep instead of shrinking
 // the subject to the whole recorded travel.
 const fit=root.userData.cameraFitBounds;fit.min.y=Math.max(fit.min.y,-3.25);fit.max.y=Math.min(fit.max.y,3.1);
 return visual;
}
