import * as THREE from 'three';
import data from './baked/seven-tooth-238-profiles.js';
import sweep from './baked/seven-tooth-238-sweep.js';
import{plate,poly,circle,capsule,ring,polygonClipping as clip}from'./finite-plate-geometry.js';
import{mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';
// Depth of each pallet block behind its working face (in the plate plane).
const FACE_DEPTH={B:{tip:.16,root:.16},C:{tip:.0605,root:.16}};
const convexHull=points=>{const p=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lower=[],upper=[];
 for(const q of p){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),q)<=0)lower.pop();lower.push(q);}
 for(const q of p.reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),q)<=0)upper.pop();upper.push(q);}
 return [...lower.slice(0,-1),...upper.slice(0,-1)];};
export function finishSevenTooth238(root){
 const d=root.userData,b=d.blocks,g=d.geometry,parts={faces:[],mounts:[],attachments:[],profile:data};
 const replace=(mesh,geometry,reset=false)=>{mesh.geometry.dispose();mesh.geometry=geometry;if(reset)mesh.rotation.set(0,0,0);};
 replace(b.escapeWheel.userData.body,plate(clip.difference(poly(data.outline),poly(circle([0,0],.089,128))),-g.wheelDepth/2,g.wheelDepth/2));
 // Brown draws D's arbor as a small ringed hole (outer radius ~8 px, 0.13).
 replace(b.escapeWheel.userData.hub,ring(.089,.14,-g.wheelDepth*.725,g.wheelDepth*.725,128),true);
 b.escapeWheel.userData.tipRidges.forEach(o=>o.visible=false);
 replace(b.escapeWheel.userData.indicator,new THREE.BoxGeometry(.24,.05,.012));b.escapeWheel.userData.indicator.position.set(.39,0,g.wheelDepth/2+.006);
 const source=b.palletBody.geometry.parameters.shapes.extractPoints(32).shape.map(p=>p.toArray());let body=poly(source);
 for(const [side,pallet]of[['B',b.bPallet],['C',b.cPallet]]){
  const face=d.faceAt(side,0),a=face.rootPoint.clone().sub(g.palletPivot),z=face.tipPoint.clone().sub(g.palletPivot),n=face.normal;
  const outline=[a.clone().addScaledVector(n,-.0005),z.clone().addScaledVector(n,-.0005),z.clone().addScaledVector(n,-FACE_DEPTH[side].tip),a.clone().addScaledVector(n,-FACE_DEPTH[side].root)].map(p=>p.toArray());
  const material=pallet.face.children[0].material;for(const child of pallet.face.children)child.geometry?.dispose();pallet.face.clear();
  // The face reaches back through the wheel's whole depth (z = .27) and sits
  // on a broader web of the anchor behind the wheel, so B and C read as
  // blocks of the anchor rather than tabs perched on pins.
  const wheelBack=g.palletPlaneZ-g.wheelDepth/2-.01;// .01 behind the wheel's back face
  const mesh=new THREE.Mesh(plate(poly(outline),wheelBack,g.palletPlaneZ+.09),material);mesh.userData.role=`${side}-finite-one-sided-lock-and-impulse-face`;pallet.face.add(mesh);pallet.faceIndex.visible=false;parts.faces.push(mesh);
  const mid=a.clone().lerp(z,.5).addScaledVector(n,-.0305),tangent=z.clone().sub(a).normalize(),half=Math.min(.06,face.length*.2);
  void half;void tangent;
  const web=[a.clone().addScaledVector(n,-.0005),z.clone().addScaledVector(n,-.0005),z.clone().addScaledVector(n,-.16),a.clone().addScaledVector(n,-.16)].map(p=>p.toArray());
  replace(pallet.standoff,plate(poly(web),.05,wheelBack),true);pallet.standoff.position.set(0,0,0);pallet.standoff.material=material;parts.mounts.push(pallet.standoff);
  // A rear-layer strap joins each complete working face to the engraved
  // carrier; C's old standoff ended in empty space beside the outline.
  let closest,distance=Infinity;
  for(let i=0;i<source.length;i++){const a=source[i],z=source[(i+1)%source.length],dx=z[0]-a[0],dy=z[1]-a[1],u=Math.max(0,Math.min(1,((mid.x-a[0])*dx+(mid.y-a[1])*dy)/(dx*dx+dy*dy))),p=[a[0]+u*dx,a[1]+u*dy],r=Math.hypot(mid.x-p[0],mid.y-p[1]);if(r<distance){distance=r;closest=p;}}
  body=clip.union(body,capsule(mid.toArray(),closest,.08,24));parts.attachments.push({side,mid:mid.toArray(),carrier:closest});
 }
 // Brown draws B and C as the anchor's own edges (C its hooked end). The
 // anchor body is therefore one solid plate up to just behind the wheel,
 // with a pad under each working face, so the faces rise straight out of it
 // instead of perching as separate blocks on thin nibs.
 const wheelBackPlane=g.palletPlaneZ-g.wheelDepth/2-.01;
 for(const attachment of parts.attachments){const face=d.faceAt(attachment.side,0),a=face.rootPoint.clone().sub(g.palletPivot),z=face.tipPoint.clone().sub(g.palletPivot),n=face.normal;
  const pad=[a.clone().addScaledVector(n,-.0005),z.clone().addScaledVector(n,-.0005),z.clone().addScaledVector(n,-.16),a.clone().addScaledVector(n,-.16)].map(p=>p.toArray());
  // Each pad is joined to the carrier by a broad web (the convex hull of the
  // pad and a disc at the carrier), so C reads as the anchor's hooked end
  // rather than a block on a thin nib.
  const hullPoints=[...pad,...Array.from({length:24},(_,i)=>[attachment.carrier[0]+.28*Math.cos(i*Math.PI/12),attachment.carrier[1]+.28*Math.sin(i*Math.PI/12)])];
  body=clip.union(body,poly(pad),poly(convexHull(hullPoints)));}
 // Brown's B and C are faces cut in the anchor's own outline, so the anchor
 // is one plate as thick as the pallet faces: in the wheel's layer (up to the
 // faces' front, palletPlaneZ + .09) it keeps its whole outline except the
 // region the star's teeth sweep relative to it over a cycle (baked offline,
 // with 3% radial clearance), and the faces stand flush in it rather than as
 // blocks on a thinner plate.
 //
 // Brown draws B as a plain square step: the anchor's left edge, a straight
 // top on which the star rests, and a straight inner edge dropping square to
 // the notch. The web and pad above add a rounded knob and the swept region
 // leaves a stepped ledge beside the face, so both layers are trimmed to
 // that step: nothing above the corner-root-tip top line, a straight edge
 // square to the face from its tip down to the swept notch floor, and in the
 // notch the rear layer follows the same swept floor as the front one.
 const swept=poly(sweep.outline),fb=d.faceAt('B',0),bRoot=fb.rootPoint.clone().sub(g.palletPivot),bTip=fb.tipPoint.clone().sub(g.palletPivot),bn=fb.normal,bt=bTip.clone().sub(bRoot).normalize();
 const corner=source.reduce((best,p)=>Math.hypot(p[0]-bRoot.x,p[1]-bRoot.y)<Math.hypot(best[0]-bRoot.x,best[1]-bRoot.y)?p:best);
 const at=(p,u,v)=>[p.x+bt.x*u+bn.x*v,p.y+bt.y*u+bn.y*v];
 const insideSwept=q=>{let inside=false;const r=sweep.outline;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],c=r[j];if((a[1]>q[1])!==(c[1]>q[1])&&q[0]<(c[0]-a[0])*(q[1]-a[1])/(c[1]-a[1])+a[0])inside=!inside;}return inside;};
 // Depth of the square step: where the edge square to the face meets the
 // swept notch floor (the swept region's first re-entry below the tip).
 let stepDepth=0;while(stepDepth<1&&insideSwept(at(bTip,-.0005,-stepDepth)))stepDepth+=.001;stepDepth+=.05;while(stepDepth<1&&!insideSwept(at(bTip,-.0005,-stepDepth)))stepDepth+=.001;
 const bCut=poly([[corner[0],corner[1]],at(bRoot,0,-.0005),at(bTip,0,-.0005),at(bTip,0,-stepDepth-.01),at(bTip,1.2,-stepDepth-.01),at(bTip,1.2,.8),[corner[0]+bn.x*.8,corner[1]+bn.y*.8]]);
 const notch=clip.intersection(swept,poly([at(bTip,0,-stepDepth-.4),at(bTip,1.2,-stepDepth-.4),at(bTip,1.2,.8),at(bTip,0,.8)]));
 body=clip.difference(body,bCut);parts.bStep={corner,depth:stepDepth};
 const bore=poly(circle([0,0],.094,128)),front=clip.difference(body,swept,bore);
 const layers=[plate(clip.difference(body,notch,bore),-.11,wheelBackPlane),plate(front,wheelBackPlane,g.palletPlaneZ+.09)];
 replace(b.palletBody,mergeGeometries(layers));layers.forEach(layer=>layer.dispose());parts.frontLayer=front;
 replace(b.palletHub,ring(.094,.3,-.14,.14,128),true);
 replace(b.palletIndicator,new THREE.BoxGeometry(.30,.04,.012));b.palletIndicator.position.z=.116;
 b.frameRail.visible=false;b.palletBearingPost.visible=false;
 const bearing=new THREE.Mesh(ring(.094,.24,-.06,.06,128),b.palletHubRing.material);// The journal sits 0.01 behind the hub's rear face (-0.14) instead of
 // sharing 0.04 of its length; the arbor still passes fully through it.
 bearing.position.set(g.palletPivot.x,g.palletPivot.y,-.2);bearing.userData.role='bored-fixed-journal-at-A';root.add(bearing);parts.bearing=bearing;
 d.workingParts=parts;d.hideGround=true;d.minimumDisplayCycleSeconds=6;
 d.sourceAnimation.reason='Animation unavailable: fetched source has no inline add_model or mm_present program.';
 d.reconstructionNote='The source axes, seven star tips and connected B/C carrier are retained. The reconstructed 4° half-swing and 5° impulse shorten B and remove 14.3% of the plate-scaled star area for finite clearance. C has a supporting working tip, but B approaches a different flank whose loaded impulse is unresolved. Lock, impulse and drop remain prescribed; this is not a dynamically validated escapement. The undimensioned source has no animation.';
 d.contactQualification={completeTransmissionValidated:false,C:{finiteTipNormalCone:true},B:{finiteTipNormalCone:false,closestFlankImpulseValidated:false,witnessCycle:.22,closestGap:.00010332026832988482,normalVelocityMismatch:-.01678671122703923}};
 d.dynamics={forceValidated:false,prescribedOscillationAndDrop:true,velocityContinuous:true,profileAreaLoss:data.qualification.areaLossFraction};
 root.traverse(o=>{if(o.isMesh)for(const material of[].concat(o.material))material.fog=false;});
}
