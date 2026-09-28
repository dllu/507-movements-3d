import * as THREE from 'three';
import {createDiagonalCatchScaffold} from '../authored-diagonal-catches.js';
import {diagonalCatchProfile,diagonalLatchFinger} from './catch-profile.js';
import {plate,poly,circle,ring,polygonClipping as clip} from '../finite-plate-geometry.js';
import {disposeObject3D} from '../dispose-model.js';
import {makeDiagonalCatchUpdater,DIAGONAL_CATCH_ROD_EDGE_Y} from './update-solids.js';

// Brown 181/182: the visible assembly around the qualified planar contact
// profiles (catch outline, the two catching faces and the two working arms
// the tappet strikes). Every part is a plain extrusion in one plane, placed
// where Brown's hidden lines put it (back to front):
//   W  the lower back-weight arm, dashed behind the piston rod;
//   R  the piston rod, its tappet projecting forward through U and L;
//   U  the upper handle's working arm, dashed behind the catch;
//   L  the lower handle's working arm;
//   C  the catch, with the upper handle's horn and weight arm and the lower
//      handle's beak: each catching face is simply the end of its own casting,
//      joined to its boss in the catch's plane.
// The joints between each face and its boss are carved from the region the
// catch can occupy relative to that handle over its whole range, so nothing
// in plane C but the qualified faces ever meets the catch; no rear plates,
// axial webs, sleeves, rollers or pin heads are added. The back-weight rods
// hang just behind the eyes they hang from.
const Z=Object.freeze({
 rodsW:[-.585,-.54],W:[-.525,-.425],R:[-.405,-.265],U:[-.245,-.145],L:[-.125,-.025],rodsC:[-.005,.04],C:[.055,.165],
});
const PROUD=.015,HUB=.40,BORE=.21,SHAFT=.2,EYE=.14,EYE_HOLE=.062,PIN=.06,ROD_EYE=.11,ROD_HALF=.05;
export const DIAGONAL_CATCH_PLANES=Z;

function hull(points){
 const p=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lower=[],upper=[];
 for(const q of p){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),q)<=0)lower.pop();lower.push(q);}
 for(const q of p.reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),q)<=0)upper.pop();upper.push(q);}
 return poly([...lower.slice(0,-1),...upper.slice(0,-1)]);
}
const rotate=([x,y],a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
const tangentLever=(a,ra,b,rb)=>hull([...circle(a,ra,96),...circle(b,rb,64)]);

// Brown's lower beak: the crescent rising from the boss to the catching face
// (plate 181 px), in the lower handle's frame.
function lowerCrescent(fit){
 const local=([x,y])=>[(x-271)*.0125-fit.pivot[0],(234-y)*.0125-fit.pivot[1]];
 const s=new THREE.Shape();s.moveTo(295,323);
 s.bezierCurveTo(312,319,326,315,329,288);
 s.bezierCurveTo(340,319,338,343,317,365);
 s.quadraticCurveTo(306,376,289,375);s.lineTo(285,351);s.closePath();
 return poly(s.getPoints(16).map(p=>local(p.toArray())));
}

// Remove from `shape` (a handle's frame) every place the catch, with its eye
// boss and a running clearance, can reach over the handle's and the catch's
// full angular ranges.
function carveCatchSweep(shape,pivot,[h0,h1],catchPolygons,gap=.015){
 const offsets=[[0,0],...Array.from({length:8},(_,k)=>[gap*Math.cos(k*Math.PI/4),gap*Math.sin(k*Math.PI/4)])];
 let free=shape;
 for(const c of [0,.019,.038,.057])for(let h=h0;h<=h1+1e-9;h+=.005)for(const [ox,oy]of offsets){
  free=clip.difference(free,catchPolygons.map(p=>p.map(r=>r.map(pt=>{
   const w=rotate(pt,c),v=rotate([w[0]-pivot[0],w[1]-pivot[1]],-h);return[v[0]+ox,v[1]+oy];}))));
 }
 return free;
}

let cachedPlates=null;
function castingOutlines(scaffold){
 if(cachedPlates)return cachedPlates;
 const b=scaffold.root.userData.blocks,catchOutline=diagonalCatchProfile().polygons.map(p=>[p[0]]);
 const catchEye=[b.catchWeightAnchor.position.x,b.catchWeightAnchor.position.y];
 const catchWithEye=clip.union(catchOutline,poly(circle(catchEye,EYE,96)));
 const plates={catchEye,catch:catchWithEye};
 for(const [side,range]of [['upper',[-1.0,.0014]],['lower',[-.947,.003]]]){
  const finger=diagonalLatchFinger(side),fit=finger.fit,weight=[b[side+'HandleWeightAnchor'].position.x,b[side+'HandleWeightAnchor'].position.y];
  const hub=poly(circle([0,0],HUB,128));
  // The face's casting: Brown's horn (the hull of face and boss) above the
  // upper boss; his crescent beak beside the lower one.
  const body=side==='upper'?hull([...finger.polygons.flat(2),...circle([0,0],HUB,128)]):clip.union(lowerCrescent(fit),hull([...finger.polygons.flat(2),...circle([0,0],.2,64)]));
  const carved=clip.union(carveCatchSweep(body,fit.pivot,range,catchWithEye),finger.polygons,hub);
  const working=clip.union(b[side+'HandleWorkingArm'].children[0].geometry.userData.plate.polygons,
   poly(circle([b[side+'HandleWorkingTip'].position.x,b[side+'HandleWorkingTip'].position.y],.10,64)),hub);
  const weightArm=tangentLever([0,0],HUB,weight,EYE);
  plates[side]={pivot:fit.pivot,weight,face:carved,working,weightArm};
 }
 return cachedPlates=plates;
}

export function createDiagonalCatchAssembly(){
 const scaffold=createDiagonalCatchScaffold({id:181}),sb=scaffold.root.userData.blocks,g=scaffold.root.userData.geometry;
 const outlines=castingOutlines(scaffold);
 const shoe={left:g.tappetShoeLeftX,right:g.tappetShoeRightX},pistonRodX=(177-271)*.0125,source181PistonY=g.source181PistonY;
 const catchMaterial=sb.catchHub.material.clone(),handleMaterial=sb.upperHandleHub.material.clone();
 disposeObject3D(scaffold.root);
 const steel=new THREE.MeshStandardMaterial({color:'#9aa19d',roughness:.45,metalness:.3});
 const rodSteel=new THREE.MeshStandardMaterial({color:'#6f7773',roughness:.5,metalness:.2});
 const tappetMaterial=new THREE.MeshStandardMaterial({color:'#c9563d',roughness:.62,metalness:.1});
 const pistonMaterial=new THREE.MeshStandardMaterial({color:'#de5a3f',roughness:.62,metalness:.1});
 const root=new THREE.Group(),groups={};
 const bored=(polygons,center,radius)=>clip.difference(polygons,poly(circle(center,radius,96)));
 const mesh=(geometry,material,role,parent)=>{const m=new THREE.Mesh(geometry,material);m.userData.role=role;parent.add(m);return m;};
 const body=(name,x,y)=>{const o=new THREE.Group();o.name='body:'+name;o.position.set(x,y,0);root.add(o);groups[name]=o;return o;};
 const span=(...planes)=>[Math.min(...planes.map(p=>Z[p][0]))-PROUD,Math.max(...planes.map(p=>Z[p][1]))+PROUD];
 const shaft=(name,center,[low,high])=>{const s=new THREE.Mesh(new THREE.CylinderGeometry(SHAFT,SHAFT,high-low,64),steel);
  s.rotation.x=Math.PI/2;s.position.set(center[0],center[1],(low+high)/2);s.userData.role=`fixed-${name}-pivot-shaft`;s.userData.fixed=true;root.add(s);};

 // Catch: one plate in C, bored for its shaft and its weight pin.
 const catchBody=body('catch',0,0);
 mesh(plate(bored(bored(outlines.catch,[0,0],BORE),outlines.catchEye,EYE_HOLE),...Z.C),catchMaterial,'continuous-source-diagonal-catch',catchBody);
 shaft('central-diagonal-catch',[0,0],[Z.C[0],Z.C[1]]);

 // Handles: boss through all of a casting's plates; each plate one outline.
 const handles={upper:{planes:{face:'C',working:'U',weightArm:'C'}},lower:{planes:{face:'C',working:'L',weightArm:'W'}}};
 const anchors={};
 for(const side of ['upper','lower']){
  const o=outlines[side],b=body(side,...o.pivot),planes=handles[side].planes;
  const [low,high]=span(...Object.values(planes));
  mesh(ring(BORE,HUB,low,high,128),handleMaterial,`${side}-handle-bored-boss`,b);
  const face=side==='upper'&&planes.weightArm===planes.face?clip.union(o.face,o.weightArm):o.face;
  const eyeHole=poly(circle(o.weight,EYE_HOLE,64)),center=[0,0];
  mesh(plate(bored(clip.difference(face,eyeHole),center,BORE),...Z[planes.face]),handleMaterial,
   side==='upper'?'upper-handle-horn-and-weight-arm':'lower-handle-beak',b);
  mesh(plate(bored(o.working,center,BORE),...Z[planes.working]),handleMaterial,`${side}-handle-curved-tappet-arm-plate`,b);
  if(planes.weightArm!==planes.face)mesh(plate(bored(clip.difference(o.weightArm,eyeHole),center,BORE),...Z[planes.weightArm]),handleMaterial,`${side}-handle-back-weight-arm`,b);
  shaft(`${side}-valve-handle`,o.pivot,[low,high]);
  anchors[side+'Weight']={parent:b,at:o.weight,armPlane:planes.weightArm};
 }
 anchors.catchWeight={parent:catchBody,at:outlines.catchEye,armPlane:'C'};

 // Piston rod and the hatched tappet on its front face.
 const piston=body('piston',0,0);
 {const top=(234-23)*.0125+1.65+.8,bottom=(234-500)*.0125-1.96-.8,x0=pistonRodX-33*.0125/2,x1=pistonRodX+33*.0125/2;
  const rod=mesh(plate(poly([[x0,bottom],[x1,bottom],[x1,top],[x0,top]]),...Z.R),pistonMaterial,'whole-piston-rod',piston);rod.name='piston-rod';
  // The rendered shoe is a hair inside the solved one on its working faces.
  const inset=.002;
  mesh(plate(poly([[shoe.left+inset,-.25+inset],[shoe.right-inset,-.25+inset],[shoe.right-inset,.25-inset],[shoe.left+inset,.25-inset]]),Z.R[1]-.01,Z.L[1]),
   tappetMaterial,'source-projecting-piston-rod-tappet-shoe',piston);}

 // Back-weight rods: a flat bar and its round eye in one outline, hanging on
 // a pin through the arm's eye, just behind it; the bar runs straight past the
 // lower edge of the drawing to its (undrawn) weight.
 const rodPlane={W:Z.rodsW,C:Z.rodsC};
 for(const [name,a]of Object.entries(anchors)){
  const rz=rodPlane[a.armPlane],anchor=new THREE.Object3D();anchor.name='anchor:'+name;
  // update-solids hangs each rod group 0.24 in front of its anchor.
  anchor.position.set(a.at[0],a.at[1],(rz[0]+rz[1])/2-.24);a.parent.add(anchor);
  const pin=new THREE.Mesh(new THREE.CylinderGeometry(PIN,PIN,Z[a.armPlane][1]-rz[0],40),steel);
  pin.rotation.x=Math.PI/2;pin.position.set(a.at[0],a.at[1],(Z[a.armPlane][1]+rz[0])/2);pin.userData.role='back-weight-rod-hinge-pin';a.parent.add(pin);
  const group=body(name,0,0);root.updateMatrixWorld(true);
  const eyeY=a.parent.localToWorld(new THREE.Vector3(...a.at,0)).y;
  const length=eyeY-DIAGONAL_CATCH_ROD_EDGE_Y+2.4,t=(rz[1]-rz[0])/2;
  const outline=clip.difference(clip.union(poly([[-ROD_HALF,0],[ROD_HALF,0],[ROD_HALF,-length],[-ROD_HALF,-length]]),poly(circle([0,0],ROD_EYE,64))),poly(circle([0,0],EYE_HOLE,48)));
  mesh(plate(outline,-t,t),rodSteel,`${name}-hanging-back-weight-vertical-rod`,group);
 }

 const parts={},families={};
 root.traverse(o=>{if(o.isMesh){
  const name=o.name==='piston-rod'?'piston-rod':(o.userData.role??'part')+'#'+Object.keys(parts).length;o.name=name;parts[name]=o;
  o.castShadow=true;o.receiveShadow=true;
  let parent=o;while(parent&&!parent.name.startsWith('body:'))parent=parent.parent;
  families[name]=parent?.name.slice(5)??'fixed';
 }});
 root.userData={parts,families,blocks:groups,geometry:{...g,planes:Z},hideGround:true,materialsIgnoreSceneFog:true,
  cameraFov:8,cameraDistanceScale:1.02,supportsRestart:true,reconstructionStatus:'under-review',
  simulationBackend:'offline-projected-mujoco-candidate',mechanism:'passive-diagonal-catch',
  animationTiming:{authoredCyclePeriod:18,displayCycleDuration:18,playbackTimeScale:1}};
 const update=makeDiagonalCatchUpdater(root);
 update([0,0,0,source181PistonY]);
 return {root,parts,families,update,dispose:()=>disposeObject3D(root)};
}
