import * as THREE from 'three';
import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';
import {groundBlock} from '../ground-block.js';
import {weightedCordGeometry,updateWeightedCord} from '../mujoco-weighted-bell-crank/sync.js';
// Presentation only (the baked physics keeps its supports and return stop):
// Brown hangs the top pulley with no gallows (a minimal rear post now carries its axle stub), stands the disk and the bell
// crank on front pedestals, and draws two thin base plates on hatched ground.
// Hide the merged rear frame (base rail, rear posts, pulley gallows and stop)
// and draw those source supports in front of the studs and lever arms.
function presentSourceSupports(root,g){
 let frameMesh=null;
 root.traverse(o=>{if(!frameMesh&&o.isMesh&&o.material.color?.getHex()===0x59605f)frameMesh=o;});
 if(!frameMesh)return;
 frameMesh.visible=false;
 // The pulley's white rotation index (a lone box) is not in the plate.
 root.getObjectByName('body:pulley')?.traverse(o=>{if(o.isMesh&&o.geometry.attributes.position.count===36&&o.material.color.getHex()===0xfaf9f5)o.visible=false;});
 const s=g.sourceScale,cx=g.sourceDiskCenter.x,cy=g.sourceDiskCenter.y;
 const w=(x,y)=>new THREE.Vector2((x-cx)*s,(cy-y)*s);
 const frame=frameMesh.material;
 const ink=new THREE.MeshStandardMaterial({color:0x1d1f1f,roughness:.6,metalness:.1,fog:false});
 const group=new THREE.Group();group.name='source-front-supports';
 const extrude=(shape,z0,z1,material,name)=>{const m=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:z1-z0,bevelEnabled:false,curveSegments:48}).translate(0,0,z0),material);m.name=name;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
 const baseTop=g.sourceBaseY-5,baseBottom=g.sourceBaseY+12;
 // Disk pedestal: round head about the axle, sides flaring to a wide foot.
 const disk=new THREE.Shape(),dh=w(cx+30,cy),r=30*s;
 const p=(x,y)=>w(x,y);
 disk.moveTo(...p(96,baseTop).toArray());disk.lineTo(...p(214,baseTop).toArray());
 disk.quadraticCurveTo(...p(184,baseTop-8).toArray(),...p(181,baseTop-60).toArray());
 disk.lineTo(...dh.toArray());disk.absarc(0,0,r,0,Math.PI,false);
 disk.lineTo(...p(121,baseTop-60).toArray());
 disk.quadraticCurveTo(...p(118,baseTop-8).toArray(),...p(96,baseTop).toArray());
 extrude(disk,.68,.80,frame,'front-disk-pedestal');
 // Bell-crank post: straight post with a round head and a flared left foot.
 const lp=g.sourceLeverPivot,lr=25*s,post=new THREE.Shape(),lc=w(lp.x,lp.y);
 post.moveTo(...p(lp.x+25,baseTop).toArray());post.lineTo(...p(lp.x+25,lp.y).toArray());
 post.absarc(lc.x,lc.y,lr,0,Math.PI,false);post.lineTo(...p(lp.x-25,baseTop-45).toArray());
 post.quadraticCurveTo(...p(lp.x-28,baseTop-4).toArray(),...p(lp.x-60,baseTop).toArray());
 extrude(post,.68,.80,frame,'front-bell-crank-post');
 for(const [x,y,name] of [[cx,cy,'disk-axle-end'],[lp.x,lp.y,'bell-crank-pin-end']]){const c=new THREE.Shape();c.absarc(...w(x,y).toArray(),10*s,0,2*Math.PI,false);extrude(c,.80,.83,ink,name);}
 for(const [x0,x1] of [[74,226],[226,371]]){const plate=new THREE.Shape(),a=w(x0,baseTop),b=w(x1,baseBottom);plate.moveTo(a.x,a.y);plate.lineTo(b.x,a.y);plate.lineTo(b.x,b.y);plate.lineTo(a.x,b.y);plate.closePath();extrude(plate,-.30,.80,frame,'base-plate');}
 // The top pulley's axle stub needs a carrier: a plain post rises from the
 // ground block behind the hanging weight (clear of its path) to a bored
 // head round the stub's rear end. Brown's crop shows no support there.
 {const px=3.962,py=3.43,foot=w(0,baseBottom).y,post=new THREE.Shape();
  post.moveTo(px-.12,foot);post.lineTo(px+.12,foot);post.lineTo(px+.12,py);post.absarc(px,py,.2,0,Math.PI,false);post.lineTo(px-.12,foot);
  const bore=new THREE.Path();bore.absarc(px,py,.1,0,2*Math.PI,true);post.holes.push(bore);
  extrude(post,-.42,-.24,frame,'pulley-axle-rear-post');}
 const left=w(6,baseBottom),right=w(514,baseBottom),depth=26*s;
 // The hatched ground is a cut solid under the base plates, not a sheet of strokes.
 const ground=groundBlock(right.x-left.x,depth,1.2,{name:'fixed-ground-block'});ground.position.set((left.x+right.x)/2,left.y-depth/2,.25);group.add(ground);
 root.add(group);group.updateMatrixWorld(true);
 root.userData.cameraFitBounds.union(new THREE.Box3().setFromObject(group));
}
// Stud and pin end faces were baked paper-white inside dark rims, which read
// as white index dots; they take the plain dark colour of the studs and pins.
function plainStudEnds(root){
 root.traverse(o=>{if(!o.isMesh||!o.visible||o.material.color?.getHex()!==0xfaf9f5)return;o.material=o.material.clone();o.material.color.setHex(0x252a2d);});
}

// The baked eye stands tangent on the ball. A tapered shank, filleted into
// the ball's crown and rising into the eye's lower rim, sinks the eye into
// the ball as a forged eye bolt (presentation only; the cord still ends at
// the eye's baked attachment).
function sinkWeightEye(root){
 const weight=root.getObjectByName('body:weight');let eye=null;
 weight?.traverse(o=>{if(o.isMesh&&o.material.color?.getHex()===0x252a2d)eye=o;});
 if(!eye)return;
 const shank=new THREE.Mesh(new THREE.LatheGeometry([[0,.40],[.10,.40],[.10,.45],[.06,.50],[.035,.545],[0,.545]].map(([x,y])=>new THREE.Vector2(x,y)),48),eye.material);
 shank.name='weight-eye-shank';shank.castShadow=true;shank.receiveShadow=true;weight.add(shank);
}
export function makeWeightedBellCrankModel(bundle){
 const model=makeBakedRigidMovement(bundle,{mechanism:'passive-three-stud-weighted-bell-crank',slideAxes:{weight:'y'},note:'Three disk studs lift the weight through an elbow and a cord over the pulley. Cord tension returns the elbow onto a stop. The stop, bearings and rope fittings are reconstructed; the weight follows an ideal vertical guide.'});
 const g=bundle.cordGeometry,cord=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({color:0x41413b,roughness:.65,metalness:.12,fog:false}));
 cord.name='weighted-cord';cord.castShadow=true;cord.receiveShadow=true;model.root.add(cord);
 const rigidUpdate=model.update;
 model.update=time=>{rigidUpdate(time);const state=model.root.userData.state;updateWeightedCord(cord,g,model.root.userData.blocks.weight.position.y,weightedCordGeometry(g,state.qpos.lever));};
 presentSourceSupports(model.root,g);
 plainStudEnds(model.root);
 sinkWeightEye(model.root);
 model.reset=()=>model.update(0);model.root.userData.cameraFov=18;model.root.userData.reconstructionStatus='reconstructed';model.update(0);return model;
}
export async function makeBakedWeightedBellCrank(){return makeWeightedBellCrankModel(await loadBakedBundle(new URL('./assets/154.json.gz',import.meta.url)));}
