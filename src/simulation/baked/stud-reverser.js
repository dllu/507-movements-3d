import * as THREE from 'three';
import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';
import {backBar,pinBoss,footPillar,supportMaterial} from '../back-plate-support.js';

// Brown draws no frame. Carry the four fixed axles (disk, elbow pivot and the
// two bar rollers) on one plain back bar behind the mechanism: a rail hidden
// behind the sliding bar, dropping to each roller, a drop behind the disk and
// an arm to the elbow pivot, each axle in a boss. A short pillar under the
// disk grounds it on an implied floor below the plate.
function addBackSupport(root){
 const mat=supportMaterial(),zFront=-0.56,group=new THREE.Group();
 group.userData.role='fixed-back-bar-carrying-disk-elbow-and-roller-axles';
 const v=(x,y)=>new THREE.Vector2(x,y);
 const disk=v(0,0),elbow=v(-2.645,0.084),rollerL=v(-3.388,1.624),rollerR=v(2.59,1.624),railY=2.23;
 group.add(
  backBar([rollerL,v(-2.85,railY),v(0,railY),v(rollerR.x,railY),rollerR],{zFront,width:0.3,material:mat,role:'fixed-back-rail-behind-bar'}),
  backBar([v(0,railY),disk,elbow],{zFront,width:0.3,material:mat,role:'fixed-back-drop-to-disk-and-elbow'}),
  pinBoss({x:disk.x,y:disk.y,radius:0.24,zBack:zFront,zFront:-0.24,material:mat,role:'fixed-disk-axle-boss'}),
  pinBoss({x:elbow.x,y:elbow.y,radius:0.2,zBack:zFront,zFront:-0.30,material:mat,role:'fixed-elbow-pivot-boss'}),
  ...[rollerL,rollerR].map(p=>pinBoss({x:p.x,y:p.y,radius:0.17,zBack:zFront,zFront:-0.30,material:mat,role:'fixed-roller-axle-boss'})),
  footPillar({x:0,yTop:0,yFloor:-2.05,z:zFront-0.05,width:0.3,footWidth:0.9,material:mat,role:'fixed-back-bar-pillar'}),
 );
 mat.fog=false;
 group.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;o.userData.runsPastCrop=true;}});
 root.add(group);
 // Framed by the recorded motion bounds, as before: the support lies behind
 // and below them.
 root.userData.backSupport=group;
}

// Stud and pin end faces were baked paper-white inside dark rims, which read
// as white index dots; they take the plain dark colour of the studs and pins.
function plainStudEnds(root){
 root.traverse(o=>{if(!o.isMesh||!o.visible||o.material.color?.getHex()!==0xfaf9f5)return;o.material=o.material.clone();o.material.color.setHex(0x252a2d);});
}

export function makeStudReverserModel(bundle){
 const model=makeBakedRigidMovement(bundle,{mechanism:'passive-stud-disk-bar-reverser',slideAxes:{bar:'x'},note:'The disk studs push the bar forward and operate the elbow for its return. A raised inner arm lets each stud pass beneath it; gravity resets the elbow onto a stop. The hidden depth relief, bearings, bar guides and guide resistance are reconstructed.'});
 // Presentation only: Brown draws no elbow stop, so hide the fixed grey stop
 // under the elbow pivot (the only frame-grey fixed mesh); the recorded
 // motion still comes to rest on it.
 model.root.children[0]?.children?.forEach(o=>{if(o.isMesh&&o.material.color?.getHex()===0x59605f)o.visible=false;});
 addBackSupport(model.root);
 plainStudEnds(model.root);
 model.root.userData.cameraFov=18;model.root.userData.reconstructionStatus='reconstructed';return model;
}
export async function makeBakedStudReverser(){return makeStudReverserModel(await loadBakedBundle(new URL('./assets/153.json.gz',import.meta.url)));}
