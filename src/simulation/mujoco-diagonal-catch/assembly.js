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
// Each face's casting is the tangent hull of the face and its boss, clear of
// the catch over the baked cycle except at the face; no rear plates, axial
// webs, sleeves, rollers or pin heads are added. The back-weight rods
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

const tangentLever=(a,ra,b,rb)=>hull([...circle(a,ra,96),...circle(b,rb,64)]);

// The circular arc from p0 through pm to p1.
function arc3(p0,pm,p1,n=64){
 const [ax,ay]=p0,[bx,by]=pm,[cx,cy]=p1,d=2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by));
 const ux=((ax*ax+ay*ay)*(by-cy)+(bx*bx+by*by)*(cy-ay)+(cx*cx+cy*cy)*(ay-by))/d,uy=((ax*ax+ay*ay)*(cx-bx)+(bx*bx+by*by)*(ax-cx)+(cx*cx+cy*cy)*(bx-ax))/d;
 const ang=([x,y])=>Math.atan2(y-uy,x-ux),a0=ang(p0),am=ang(pm),a1=ang(p1),r=Math.hypot(ax-ux,ay-uy),T=2*Math.PI;
 const mod=v=>((v%T)+T)%T;let sweep=mod(a1-a0);if(mod(am-a0)>sweep)sweep-=T;
 return Array.from({length:n+1},(_,i)=>[ux+r*Math.cos(a0+sweep*i/n),uy+r*Math.sin(a0+sweep*i/n)]);
}
// The circular arc leaving p along direction dir (tangent there) and ending at e.
function tangentArc(p,dir,e,n=64){
 const l=Math.hypot(...dir),t=[dir[0]/l,dir[1]/l],w=[p[0]-e[0],p[1]-e[1]];
 let nrm=[-t[1],t[0]];const dot=nrm[0]*w[0]+nrm[1]*w[1];
 if(dot>0)nrm=[-nrm[0],-nrm[1]];
 const r=(w[0]**2+w[1]**2)/(-2*(nrm[0]*w[0]+nrm[1]*w[1])),c=[p[0]+nrm[0]*r,p[1]+nrm[1]*r];
 const a0=Math.atan2(p[1]-c[1],p[0]-c[0]),a1=Math.atan2(e[1]-c[1],e[0]-c[0]);
 const turn=t[0]*(p[1]-c[1])-t[1]*(p[0]-c[0])<0?1:-1;
 let sweep=a1-a0;while(turn*sweep<0)sweep+=turn*2*Math.PI;
 return Array.from({length:n+1},(_,i)=>[c[0]+r*Math.cos(a0+sweep*i/n),c[1]+r*Math.sin(a0+sweep*i/n)]);
}
// Beak (plate-181 px, lower handle frame): its point, the end of its working
// edge, and where its outer arc (tangent to that edge) meets the boss.
export const BEAK_ARC=[[329,288],[332,307],[300,363.5]];

let cachedPlates=null;
function castingOutlines(scaffold){
 if(cachedPlates)return cachedPlates;
 const b=scaffold.root.userData.blocks,catchOutline=diagonalCatchProfile().polygons.map(p=>[p[0]]);
 const catchEye=[b.catchWeightAnchor.position.x,b.catchWeightAnchor.position.y];
 const catchWithEye=clip.union(catchOutline,poly(circle(catchEye,EYE,96)));
 const plates={catchEye,catch:catchWithEye};
 for(const side of ['upper','lower']){
  const finger=diagonalLatchFinger(side),fit=finger.fit,weight=[b[side+'HandleWeightAnchor'].position.x,b[side+'HandleWeightAnchor'].position.y];
  const hub=poly(circle([0,0],HUB,128));
  // Pass 99: each face's casting is one clean outline, the tangent hull of
  // its qualified catching face and its boss (straight flanks tangent to the
  // boss), so it has no carved steps, slits or notches. It stays clear of
  // the catch over the whole baked cycle except at the face itself
  // (tests/diagonal-catch-baked.test.mjs).
  let body=hull([...finger.polygons.flat(2),...circle([0,0],side==='upper'?HUB:.2,128)]);
  // The beak's hull is squared off along the line of its heel's end face
  // (plate-181 px, handle frame), which the catch grazes on entry.
  if(side==='lower'){
   const local=([x,y])=>[(x-271)*.0125-fit.pivot[0],(234-y)*.0125-fit.pivot[1]];
   // Brown's crescent: the beak's outer edge is one circular arc from its
   // point to the boss, bulging clear of the face's working corners.
   const [p0,p1,end]=BEAK_ARC.map(local);
   body=clip.union(body,poly([p0,...tangentArc(p1,[p1[0]-p0[0],p1[1]-p0[1]],end),[0,0]]));
   const a=local([305.5,277.8]),b=local([308.7,274.4]),d=[b[0]-a[0],b[1]-a[1]],n=[d[1],-d[0]],k=40;
   body=clip.difference(body,poly([[a[0]-d[0]*k,a[1]-d[1]*k],[a[0]+d[0]*k,a[1]+d[1]*k],
    [a[0]+d[0]*k-n[0]*k,a[1]+d[1]*k-n[1]*k],[a[0]-d[0]*k-n[0]*k,a[1]-d[1]*k-n[1]*k]]));
  }
  // Drop the zero-length spur the squared end leaves at the face's corner.
  const carved=clip.union(body,finger.polygons,hub).map(rings=>rings.map(ring=>{
   const kept=ring.filter((p,i)=>i===0||Math.hypot(p[0]-ring[i-1][0],p[1]-ring[i-1][1])>2e-4);
   return kept.filter((p,i)=>{if(i===0||i===kept.length-1)return true;const a=kept[i-1],b=kept[i+1];
    return Math.hypot(b[0]-a[0],b[1]-a[1])>2e-4;});}));
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
 // Pass 99: the piston rod is steel grey so the orange tappet on its face
 // reads as a separate part.
 const tappetMaterial=new THREE.MeshStandardMaterial({color:'#de5a3f',roughness:.62,metalness:.1});
 const pistonMaterial=new THREE.MeshStandardMaterial({color:'#7e8584',roughness:.55,metalness:.2});
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
