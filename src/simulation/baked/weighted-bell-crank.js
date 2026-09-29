import * as THREE from 'three';
import {loadBakedBundle,makeBakedRigidMovement} from './playback.js';
import {groundBlock} from '../ground-block.js';
import {PALETTE} from '../primitives.js';
import {plate,poly,circle,polygonClipping as clip} from '../finite-plate-geometry.js';
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
// Brown loops the cord through a round eye at the end of the lever's upright
// arm, in the lever's plane. The bake hung it on a bare stub pin standing 0.2
// in front of the lever. Presentation only: the lever is re-cut as one plate
// with a round eye (r 0.13, bore 0.055) concentric with the old pin, the pin is
// removed, and the pulley and weight move back into the lever's plane
// (z 0.46), so the cord runs flat from the eye over the pulley to the weight.
// The pulley's fixed stub is shortened by the same amount.
export const cordEyeOuterRadius=.13,cordEyeBoreRadius=.055;
function cordThroughLeverEye(root,g){
 const lever=root.getObjectByName('body:lever'),shift=g.leverPivot.z-g.cordPlaneZ,a=-g.leverIncludedAngle;
 if(!lever)return 0;
 const tip=[g.outputArmLength*Math.cos(a),g.outputArmLength*Math.sin(a)];
 let body=null,pinMesh=null;
 lever.traverse(o=>{if(!o.isMesh)return;const hex=o.material.color?.getHex();if(hex===0xd8a533)body=o;
  else if(hex===0x252a2d&&!pinMesh){const pos=o.geometry.attributes.position;for(let i=0;i<pos.count;i++)if(Math.hypot(pos.getX(i)-tip[0],pos.getY(i)-tip[1])<.06){pinMesh=o;break;}}});
 if(body){
  const bar=(L,h,angle)=>{const c=Math.cos(angle),s=Math.sin(angle),r=([x,y])=>[x*c-y*s,x*s+y*c];return poly([[0,-h],[L,-h],[L,h],[0,h]].map(r));};
  const shape=clip.difference(clip.union(bar(g.inputArmLength,g.inputArmHalfWidth,0),poly(circle([g.inputArmLength,0],g.inputArmHalfWidth,96)),
   bar(g.outputArmLength,g.outputArmHalfWidth,a),poly(circle(tip,cordEyeOuterRadius,96))),
   poly(circle([0,0],g.leverPivotRadius+.0002,96)),poly(circle(tip,cordEyeBoreRadius,64)));
  body.geometry.dispose();body.geometry=plate(shape,-.10,.10);body.name='lever-with-cord-eye';
 }
 if(pinMesh){
  // Drop the stub pin's triangles (all vertices within 0.06 of the eye centre).
  const src=pinMesh.geometry.index?pinMesh.geometry.toNonIndexed():pinMesh.geometry,pos=src.attributes.position,keep=[];
  for(let t=0;t<pos.count;t+=3){let near=true;for(let k=0;k<3;k++)if(Math.hypot(pos.getX(t+k)-tip[0],pos.getY(t+k)-tip[1])>=.06)near=false;if(!near)keep.push(t);}
  const out=new THREE.BufferGeometry();
  for(const [name,attribute] of Object.entries(src.attributes)){const n=attribute.itemSize,array=new attribute.array.constructor(keep.length*3*n);keep.forEach((t,j)=>array.set(attribute.array.subarray(t*n,(t+3)*n),j*3*n));out.setAttribute(name,new THREE.BufferAttribute(array,n));}
  if(src!==pinMesh.geometry)src.dispose();pinMesh.geometry.dispose();pinMesh.geometry=out;
 }
 for(const name of ['body:pulley','body:weight'])for(const child of root.getObjectByName(name)?.children??[])child.position.z+=shift;
 root.traverse(o=>{if(!o.isMesh||o.parent!==root&&o.parent?.name?.startsWith('body:')||o.material.color?.getHex()!==0x252a2d)return;
  const pos=o.geometry.attributes.position;let moved=false;
  for(let i=0;i<pos.count;i++)if(Math.hypot(pos.getX(i)-g.pulleyCenter.x,pos.getY(i)-g.pulleyCenter.y)<.15&&pos.getZ(i)>g.pulleyCenter.z){pos.setZ(i,pos.getZ(i)+shift);moved=true;}
  if(moved){pos.needsUpdate=true;o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();}});
 return shift;
}
export function makeWeightedBellCrankModel(bundle){
 const model=makeBakedRigidMovement(bundle,{mechanism:'passive-three-stud-weighted-bell-crank',slideAxes:{weight:'y'},note:'Three disk studs lift the weight through an elbow and a cord over the pulley. Cord tension returns the elbow onto a stop. The stop, bearings and rope fittings are reconstructed; the weight follows an ideal vertical guide.'});
 const g=bundle.cordGeometry,cord=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({color:PALETTE.rope,roughness:.65,metalness:.12,fog:false}));
 cord.name='weighted-cord';cord.castShadow=true;cord.receiveShadow=true;model.root.add(cord);
 const rigidUpdate=model.update;
 const cordG={...g,cordPlaneZ:g.leverPivot.z};
 model.update=time=>{rigidUpdate(time);const state=model.root.userData.state;updateWeightedCord(cord,cordG,model.root.userData.blocks.weight.position.y,weightedCordGeometry(g,state.qpos.lever));};
 presentSourceSupports(model.root,g);
 plainStudEnds(model.root);
 sinkWeightEye(model.root);
 cordThroughLeverEye(model.root,g);
 model.reset=()=>model.update(0);model.root.userData.cameraFov=18;model.root.userData.reconstructionStatus='reconstructed';model.update(0);return model;
}
export async function makeBakedWeightedBellCrank(){return makeWeightedBellCrankModel(await loadBakedBundle(new URL('./assets/154.json.gz',import.meta.url)));}
