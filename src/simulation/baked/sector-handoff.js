import * as THREE from 'three';
import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';
import {slideSleeve,supportMaterial} from '../back-plate-support.js';
import {disk,ring} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';

function addRackGuides(root){
 const rack=root.getObjectByName('body:rack'),mat=supportMaterial(),ink=matte(PALETTE.ink,{metalness:.2,roughness:.5});
 const top=2.311,bottom=-2.40,xc=.0195,halfWidth=.167,z0=.32,z1=.60,travel=1.79,gap=.12,guideLength=.3,zWall=-.25,shaftBack=-.1;
 const fixed=new THREE.Group();fixed.name='fixed-rack-guides';root.add(fixed);
 const mesh=(g,m,name,parent)=>{const o=new THREE.Mesh(g,m);o.name=name;parent.add(o);return o;};
 const ends=[];
 for(const [name,sign,tip] of [['upper',1,top],['lower',-1,bottom]]){
  const guideStart=tip+sign*(travel+gap),guideEnd=guideStart+sign*guideLength,extEnd=guideEnd+sign*(travel+.05);
  const [lo,hi]=[tip-sign*.02,extEnd].sort((a,b)=>a-b);
  mesh(new THREE.BoxGeometry(2*halfWidth,hi-lo,z1-z0).translate(xc,(lo+hi)/2,(z0+z1)/2),rack.children.find(c=>c.isMesh)?.material??mat,name+'-rod-run-on',rack);
  const sleeve=slideSleeve({center:new THREE.Vector3(xc,(guideStart+guideEnd)/2,(z0+z1)/2),axis:'y',length:guideLength,
   innerWidth:2*halfWidth+.012,innerDepth:z1-z0+.012,wall:.05,zWall});
  sleeve.name=name+'-rod-guide';fixed.add(sleeve);ends.push(guideEnd);
 }
 const floor=Math.min(...ends)-.35;
 mesh(new THREE.BoxGeometry(.26,Math.max(...ends)-floor,.08).translate(0,(Math.max(...ends)+floor)/2,zWall-.04),mat,'upright-guide-bar',fixed);
 mesh(new THREE.BoxGeometry(.6,.08,.5).translate(0,floor+.04,zWall-.04),mat,'upright-guide-bar-foot',fixed);
 const shafts=['left','center','right'].map(n=>root.getObjectByName('body:'+n));
 const xs=shafts.map(b=>b.position.x);
 mesh(new THREE.BoxGeometry(Math.max(...xs)-Math.min(...xs)+.5,.3,.08).translate(0,0,zWall-.04),mat,'shaft-bearing-bar',fixed);
 for(const body of shafts){
  const radius=.172;
  mesh(disk(radius,zWall+.004,shaftBack+.001,64),ink,'shaft-run-on',body);
  mesh(ring(radius+.003,radius+.12,zWall,shaftBack-.03,64).translate(body.position.x,body.position.y,0),mat,'shaft-rear-bearing',fixed);
 }
 markShadows(fixed);
}

export async function makeBakedSectorHandoff(){
 const bundle=await loadBakedBundle(new URL('./assets/123.json.gz',import.meta.url));
 const visual=makeBakedRigidMovement(bundle,{mechanism:'baked-sector-handoff',slideBodies:['rack'],note:'The double rack alternately drives two sectors through tooth contact. Motion is recorded from a validated simulation. Section view reveals the curved piece catching each stop. Equal spur gears, relieved sector ends and a rephased transfer piece correct inconsistencies in the engraving; depths, bearings and the rack guide are reconstructed.'});
 const root=visual.root,rack=root.getObjectByName('rack'),outline=root.getObjectByName('section-outline-of-double-rack');
 root.userData.setSectionView=enabled=>{root.userData.sectionView=Boolean(enabled);rack.visible=!enabled;outline.visible=Boolean(enabled);};
 root.userData.setSectionView(false);
 // Brown breaks the rack's rods off above and below. They run on whole into
 // fixed guides just past the rack's reach; the guides hang on one plain
 // upright bar behind the gears, which also carries the three shafts' rear
 // bearings and stands on a foot below the lower guide. All are fixed parts
 // added outside the recorded bodies, so the recorded motion is unchanged.
 addRackGuides(root);
 // Brown draws the sectors and double rack in a flat face view.
 visual.cameraDirection.set(.02,.015,1);
 // Brown draws the whole double rack, so keep its full recorded sweep in
 // view; fit that tall silhouette box directly (not its bounding sphere).
 root.userData.cameraDistanceScale=.01;
 // The generic fit margin leaves ≈13% slack at the stroke ends; trim it.
 const fit=root.userData.cameraFitBounds;fit.min.y+=.35;fit.max.y-=.35;
 return visual;
}
