import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';
import {plate,poly,circle,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {twinCamLevers} from '../mujoco-twin-cam/source.js';
export function makeTwinCamModel(bundle){
 const model=makeBakedRigidMovement(bundle,{mechanism:'twin-cam-guided-outputs',slideBodies:['upperSlide','lowerSlide'],note:'The cams alternately lift the levers; gravity returns them. The bake guides the rods\' lower ends in vertical slides off the plate; those slides, their guides and the rear bearings are inferred and not shown, and obscured portions of the cam outlines are reconstructed.'});
 model.root.userData.reconstructionStatus='reconstructed';
 // Brown draws only the cams, the two levers on their common pivot and the
 // two hanging rods broken off below (p60 support policy): no rear bearing
 // bar, rod guides or slides. The bake keeps its guided slides as bodies
 // (they set the rods' swing), but have no visible parts; the rods end cleanly
 // at Brown's break with no lower eye, and the lever pivot and cam shafts
 // end as short plain stubs just behind the rearmost lever and cam.
 const root=model.root,drop=[];
 root.traverse(o=>{if(o.isMesh&&/^(?:rear-bearing-frame|guide\d-(?:-1|1)|guide-back\d|slider(?:-pin|-retainer)?\d)$/.test(o.name))drop.push(o);});
 for(const o of drop){o.removeFromParent();o.geometry.dispose();}
 const replace=(name,geometry)=>{const mesh=root.getObjectByName(name);if(!mesh)return;mesh.geometry.dispose();mesh.geometry=geometry;};
 twinCamLevers.forEach((l,i)=>replace('rod'+i,plate(clip.difference(clip.union(poly(circle([0,0],.17,96)),
  poly([[-.09,0],[.09,0],[.09,-.36],[.036,-.36],[.036,-l.rodLength],[-.036,-l.rodLength],[-.036,-.36],[-.09,-.36]])),poly(circle([0,0],.074,96))),0,.10)));
 replace('pivot-shaft',disk(.12,-.26,.80,96));
 replace('cam-shaft',disk(.13,-.60,.68,96));
 // The rollers and their axle caps are steel so each roller reads against the
 // brass cam it rides on (they were the cam's brass).
 const steel=root.getObjectByName('roller0')?.material?.clone();
 if(steel){steel.color.setHex(0x7e8584);for(const name of ['roller0','roller1','roller-retainer0','roller-retainer1']){const mesh=root.getObjectByName(name);if(mesh)mesh.material=steel;}}
 return model;
}
export async function makeBakedTwinCam(){return makeTwinCamModel(await loadBakedBundle(new URL('./assets/149.json.gz',import.meta.url)));}
