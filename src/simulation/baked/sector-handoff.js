import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';
export async function makeBakedSectorHandoff(){
 const bundle=await loadBakedBundle(new URL('./assets/123.json.gz',import.meta.url));
 const visual=makeBakedRigidMovement(bundle,{mechanism:'baked-sector-handoff',slideBodies:['rack'],note:'The double rack alternately drives two sectors through tooth contact. Motion is recorded from a validated simulation. Section view reveals the curved piece catching each stop. Equal spur gears, relieved sector ends and a rephased transfer piece correct inconsistencies in the engraving; depths, bearings and the rack guide are reconstructed.'});
 const root=visual.root,rack=root.getObjectByName('rack'),outline=root.getObjectByName('section-outline-of-double-rack');
 root.userData.setSectionView=enabled=>{root.userData.sectionView=Boolean(enabled);rack.visible=!enabled;outline.visible=Boolean(enabled);};
 root.userData.setSectionView(false);return visual;
}
