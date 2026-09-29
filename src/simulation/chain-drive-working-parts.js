import * as THREE from 'three';
import profiles from './chain-drive-profiles.js';
import {plate,ring,polygonClipping as clip} from './finite-plate-geometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {creaseLatheNormals} from './crease-normals.js';
const TAPER_SIDE_228=1;
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
// 227: Brown's pulley is a clean, regular six-pointed wheel. Each tooth
// stands through an edge-on loop link; the flat plate links lie on straight
// flats between the teeth. The profile is analytic: a flat under each plate
// link, a concave notch hugging each plate link's round end at the joint (the
// driving face, 0.0008 clear), and concave flanks rising to a sharp point.
// p93: the notch now departs at 22 degrees (was 38), so the flank's control
// point lies inside the chord from the notch to the tip and the flank is
// truly hollow, as Brown draws the star's sides (it bulged at 38).
export function cleanSprocketProfile227(g,options={}){
 const R=g.pitchRadius,half=g.chainNodeStep/2,e=g.plateLinkEndRadius+(options.clearance??.0008),
  tip=options.tipRadius??2.62,depart=(options.departDegrees??22)*Math.PI/180,tipHalf=options.tipHalfWidth??.2,
  arcSteps=24,curveSteps=40,outer=[];
 const P=(a,r)=>[Math.cos(a)*r,Math.sin(a)*r],rot=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
 // Upper half of the tooth at angle 0: joint N at +half; the valley flat
 // faces direction +2*half; the notch runs from the flat's tangent point
 // (psi = 2*half+pi) round the joint to the departure psi0+depart.
 const N=P(half,R),psi0=2*half+Math.PI,psi1=psi0+depart,D=[N[0]+e*Math.cos(psi1),N[1]+e*Math.sin(psi1)],
  t=[-Math.sin(psi1),Math.cos(psi1)],k=(D[1]-tipHalf)/-t[1],C=[D[0]+k*t[0],D[1]+k*t[1]],T=[tip,0];
 const upper=[];// from the tip down to the valley flat
 for(let i=0;i<=curveSteps;i++){const s=1-i/curveSteps,a=(1-s)*(1-s),b=2*s*(1-s),c=s*s;upper.push([a*D[0]+b*C[0]+c*T[0],a*D[1]+b*C[1]+c*T[1]]);}
 for(let i=1;i<=arcSteps;i++){const psi=psi1-(psi1-psi0)*i/arcSteps;upper.push([N[0]+e*Math.cos(psi),N[1]+e*Math.sin(psi)]);}
 const tooth=[...upper.slice().reverse().map(p=>[p[0],-p[1]]),...upper.slice(1)];
 for(let n=0;n<g.sprocketToothCount;n++)for(const p of tooth)outer.push(rot(p,g.toothCenterPhase+n*g.toothStep));
 outer.push(outer[0]);
 const hole=[];for(let i=0;i<=96;i++)hole.push(P(-i/96*2*Math.PI,g.shaftHoleRadius));
 return [[outer.map(p=>p.map(v=>+v.toFixed(8))),hole.map(p=>p.map(v=>+v.toFixed(8)))]];
}
// p93: 227's edge-on links were a thin wire loop with two broad box straps
// laid on its straight sides, so each looked like a box joined to the flat
// plates by wire rings. Make each one piece: the same loop path (its round
// end bars still pass through the flat plates' eyes) swept with a flat
// section that is as broad as the straps along the sides and narrows through
// each end bar to fit the eye.
function edgeOnLinkGeometry227(g){
 const L=g.linkPitch,r=g.linkLoopHalfWidth,t=g.linkWireRadius,broad=g.plateLinkEndRadius-.01,eye=g.plateLinkEyeRadius??.048;
 const narrow=Math.sqrt(Math.max(1e-6,(eye-.004)**2-t*t));
 const path=[];// [x,y,tx,ty,halfBroad]
 const straight=60,arc=48;
 // Integration p93: hold the narrow section until the loop has left the
 // plate's thickness (with margin for articulation), then broaden; the
 // earlier blend began at the tip and grazed the plate by 0.002-0.003.
 const hold=.3;
 const pushArc=(cx,from)=>{for(let i=0;i<=arc;i++){const a=from+Math.PI*i/arc,u=Math.max(0,(Math.abs(i/arc-.5)*2-hold)/(1-hold)),w=narrow+(broad-narrow)*u*u*(3-2*u);
   path.push([cx+r*Math.cos(a),r*Math.sin(a),-Math.sin(a),Math.cos(a),w]);}};
 for(let i=0;i<straight;i++){const x=r+(L-2*r)*i/straight;path.push([x,-r,1,0,broad]);}
 pushArc(L-r,-Math.PI/2);
 for(let i=1;i<straight;i++){const x=L-r-(L-2*r)*i/straight;path.push([x,r,-1,0,broad]);}
 pushArc(r,Math.PI/2);
 const positions=[],normals=[],index=[];
 // Four corners per station, each face with its own normals.
 const n=path.length;
 const faces=[[0,1,'out'],[1,2,'up'],[2,3,'in'],[3,0,'down']];
 for(const [c0,c1,kind] of faces){
  const base=positions.length/3;
  for(const [x,y,tx,ty,w] of path){
   const nx=ty,ny=-tx;// outward in the loop plane
   const corners=[[x+nx*t,y+ny*t,-w],[x+nx*t,y+ny*t,w],[x-nx*t,y-ny*t,w],[x-nx*t,y-ny*t,-w]];
   for(const c of [c0,c1]){positions.push(...corners[c]);
    normals.push(...(kind==='out'?[nx,ny,0]:kind==='in'?[-nx,-ny,0]:kind==='up'?[0,0,1]:[0,0,-1]));}
  }
  for(let i=0;i<n;i++){const j=(i+1)%n,a=base+2*i,b=base+2*i+1,c=base+2*j,d=base+2*j+1;index.push(a,c,b,b,c,d);}
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 geometry.setIndex(index);
 // Orient every triangle outward (the loop runs counterclockwise).
 const pos=geometry.attributes.position,nor=geometry.attributes.normal,A=new THREE.Vector3(),B=new THREE.Vector3(),C=new THREE.Vector3(),N=new THREE.Vector3();
 for(let k=0;k<index.length;k+=3){A.fromBufferAttribute(pos,index[k]);B.fromBufferAttribute(pos,index[k+1]);C.fromBufferAttribute(pos,index[k+2]);N.fromBufferAttribute(nor,index[k]);
  if(B.sub(A).cross(C.sub(A)).dot(N)<0){const tmp=index[k+1];index[k+1]=index[k+2];index[k+2]=tmp;}}
 geometry.setIndex(index);
 geometry.userData={profile:'one-piece-edge-on-loop-link-227',broadHalf:broad,endBarHalf:narrow};
 return geometry;
}
// p107: the user's direction is that 227's chain is formed with pins, not
// single bent pieces. Each link standing across a tooth is a real pin-chain
// outer link: two flat side plates, one in front of and one behind the
// pulley plane (the "different planes" of Brown's caption; the tooth enters
// the space between them), joined at each joint by a pin through the flat
// inner plate's eye, with a round rivet head outside each side plate. As
// Brown draws them, the side plates are narrow bars (the strips across the
// teeth and between the hanging plates), round-ended concentric with the
// pins, so each broad inner plate shows its two rivet heads at its ends. Built in the link's frame: x along the chord, y across the
// pulley plane (world z after the link's quarter turn), z radial.
function pinnedOuterLinkGeometry227(g){
 const L=g.linkPitch,r=g.linkLoopHalfWidth,t=g.linkWireRadius,pin=(g.plateLinkEyeRadius??.048)-.006,
  head=pin*1.45,broad=head+.022,embed=.004,parts=[];
 const shape=new THREE.Shape();
 shape.absarc(L,0,broad,-Math.PI/2,Math.PI/2,false);
 shape.absarc(0,0,broad,Math.PI/2,3*Math.PI/2,false);
 shape.closePath();
 for(const side of [-1,1]){
  // Shape (x, z) extruded 2t along -y by the quarter turn, then centred on y = side*r.
  const plateGeometry=new THREE.ExtrudeGeometry(shape,{bevelEnabled:false,curveSegments:16,depth:2*t,steps:1}).rotateX(Math.PI/2);
  plateGeometry.translate(0,side*r+t,0);
  parts.push(plateGeometry.index?plateGeometry.toNonIndexed():plateGeometry);
 }
 for(const x of [0,L]){
  // The pin runs between the side plates' inner faces (ends embedded).
  const shaft=new THREE.CylinderGeometry(pin,pin,2*(r-t)+2*embed,20,1,false);shaft.translate(x,0,0);parts.push(shaft.toNonIndexed());
  for(const side of [-1,1]){
   const profile=[[0,0],[head,0],[head,.012],[head*.72,.024],[0,.028]].map(([a,b])=>new THREE.Vector2(a,b));
   const cap=creaseLatheNormals(new THREE.LatheGeometry(profile,24));
   if(side<0)cap.rotateX(Math.PI);
   cap.translate(x,side*(r+t-embed),0);
   parts.push(cap.toNonIndexed());
  }
 }
 for(const part of parts){part.deleteAttribute('uv');}
 const geometry=mergeGeometries(parts);
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData={profile:'pinned-outer-link-two-side-plates-227',broadHalf:broad,pinRadius:pin,headRadius:head,sidePlateHalfGap:r-t};
 return geometry;
}
export function correctChainDrive(model,id){
 const {root}=model,d=root.userData,b=d.blocks,g=d.geometry;
 const wheel=id===227?b.sprocket:id===229?b.wheel:null;
 const originalWheelPolygons=wheel?[wheel.geometry.parameters.shapes.extractPoints(64).shape.map(p=>p.toArray())]:null;
 d.chainDriveParts={originalWheelPolygons};
 if(id===227){
  replace(wheel,plate(cleanSprocketProfile227(g),-g.sprocketDepth/2,g.sprocketDepth/2));
  const outer=pinnedOuterLinkGeometry227(g);let shared=null;
  root.traverse(o=>{if(o.userData.role!=='edge-on-flat-loop-link-across-tooth')return;
   if(!shared){shared=o.geometry;}o.geometry=outer;o.userData.role='pinned-outer-link-side-plates-across-tooth';
   for(const strap of o.children)if(strap.userData.role==='edge-on-link-side-strap')strap.visible=false;});
  shared?.dispose();
 }
 else if(profiles[id]){
  if(wheel)replace(wheel,plate(profiles[id],-(g.sprocketDepth??g.wheelDepth)/2,(g.sprocketDepth??g.wheelDepth)/2));
  else {
   // 228: Brown draws slender triangular wedges standing on the rim. Keep
   // the generated driving notch against the rung (up to its centre radius)
   // and cut the rest to a pointed tent about 0.4 wide at the rim and 0.47
   // proud (the apex rises above the generated blank, clear of the rungs).
   const s=TAPER_SIDE_228,taper=[[[[1.55,-.75*s],[2.03,-.75*s],[2.03,-.6*s],[2.42,-.31*s],[1.95,-.08*s],[1.55,-.08*s],[1.55,-.75*s]]]];
   const cap=[[[[2.03,-.47*s],[2.42,-.31*s],[1.99,-.1*s],[2.03,-.47*s]]]];
   const outline=id===228?clip.union(clip.intersection(profiles[id],taper),cap):profiles[id];
   const geometry=plate(outline,-g.toothDepth/2,g.toothDepth/2);for(const tooth of b.teeth)replace(tooth,geometry);
  }
 }
 if(id===228){
  replace(b.disk,ring(g.shaftRadius+.003,g.diskRadius,-g.diskDepth/2,g.diskDepth/2,96));b.disk.rotation.set(0,0,0);
  replace(b.hub,ring(g.shaftRadius+.003,g.hubRadius,-g.hubDepth/2,g.hubDepth/2,64));b.hub.rotation.set(0,0,0);
 }
 if(id!==228)replace(b.hub,ring(g.shaftHoleRadius*(id===227?.72:.68)+.003,g.hubOuterRadius,-(g.hubDepth??.34)/2,(g.hubDepth??.34)/2,64));
 b.cameraEnvelope.visible=false;
 const bounds={227:[[-2.7,-4.7,-.74],[2.7,3.1,.74]],228:[[-2.65,-4.75,-.89],[2.65,3.35,.89]],229:[[-3.5,-2.35,-.64],[3.5,3.25,.64]]}[id];
 d.cameraFitBounds=new THREE.Box3(new THREE.Vector3(...bounds[0]),new THREE.Vector3(...bounds[1]));
 d.cameraFov=8;d.cameraDistanceScale=1;
 d.hideGround=true;d.minimumDisplayCycleSeconds=4;
 d.reconstructionNote='Rigid chain links follow a prescribed, continuous chordal path with exact pitch. Working pulley profiles have finite clearance for entry and exit. Tension, load sharing, backlash take-up and elastic chain dynamics are not solved.';
 root.traverse(o=>{for(const m of [].concat(o.material??[]))m.fog=false;});
 // 228: the plate looks at the disk face from well to the left and above,
 // the shaft running back and up to the left.
 model.cameraDirection=new THREE.Vector3(id===228?-9:.9,id===228?3.6:.6,id===228?7:14);
}
