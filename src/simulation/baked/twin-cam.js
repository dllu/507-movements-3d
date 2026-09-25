import * as THREE from 'three';
import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';
export function makeTwinCamModel(bundle){
 const model=makeBakedRigidMovement(bundle,{mechanism:'twin-cam-guided-outputs',slideBodies:['upperSlide','lowerSlide'],note:'The cams alternately lift the levers; gravity returns them. Pinned rods drive vertical sliders. The lower guides (carried back to the rear bearing bar), rear bearings and obscured portions of the cam outlines are reconstructed and are not shown in the engraving.'});
 model.root.userData.reconstructionStatus='reconstructed';
 // Carry both rod guides from the rear bearing bar, so the guides (and the
 // slides the rods drive in them) do not float: a web runs straight back from
 // each guide to a strap on the bar's plane. The lower guide's web is its
 // outer rail carried down below the cams' swept disc and back,
 // clear of the upper rod and slide.
 const frame=model.root.getObjectByName('rear-bearing-frame');
 if(frame){
  const add=(name,[x0,y0,z0],[x1,y1,z1])=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),frame.material);
   mesh.name=name;mesh.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);mesh.castShadow=mesh.receiveShadow=true;frame.parent.add(mesh);return mesh;};
  add('guide-web0',[2.54,-2.985,-.95],[3.00,-1.69,-.26]);
  // The lower guide's web drops below the cams' swept disc before running
  // back, so it never crosses their path.
  add('guide-web1-drop',[3.11,-2.95,.54],[3.30,-2.38,.60]);
  add('guide-web1',[3.11,-2.95,-.95],[3.30,-2.62,.54]);
  add('guide-strap',[2.54,-2.985,-.95],[3.16,-1.05,-.70]);
 }
 return model;
}
export async function makeBakedTwinCam(){return makeTwinCamModel(await loadBakedBundle(new URL('./assets/149.json.gz',import.meta.url)));}
