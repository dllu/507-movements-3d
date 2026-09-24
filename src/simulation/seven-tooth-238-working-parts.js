import * as THREE from 'three';
import data from './baked/seven-tooth-238-profiles.js';
import{plate,poly,circle,capsule,ring,polygonClipping as clip}from'./finite-plate-geometry.js';
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
  const outline=[a.clone().addScaledVector(n,-.0005),z.clone().addScaledVector(n,-.0005),z.clone().addScaledVector(n,-.0605),a.clone().addScaledVector(n,-.0605)].map(p=>p.toArray());
  const material=pallet.face.children[0].material;for(const child of pallet.face.children)child.geometry?.dispose();pallet.face.clear();
  const mesh=new THREE.Mesh(plate(poly(outline),g.palletPlaneZ-.09,g.palletPlaneZ+.09),material);mesh.userData.role=`${side}-finite-one-sided-lock-and-impulse-face`;pallet.face.add(mesh);pallet.faceIndex.visible=false;parts.faces.push(mesh);
  const mid=a.clone().lerp(z,.5).addScaledVector(n,-.0305),tangent=z.clone().sub(a).normalize(),half=Math.min(.06,face.length*.2);
  replace(pallet.standoff,plate(capsule(mid.clone().addScaledVector(tangent,-half).toArray(),mid.clone().addScaledVector(tangent,half).toArray(),.023,16),.05,g.palletPlaneZ+.02),true);pallet.standoff.position.set(0,0,0);parts.mounts.push(pallet.standoff);
  // A rear-layer strap joins each complete working face to the engraved
  // carrier; C's old standoff ended in empty space beside the outline.
  let closest,distance=Infinity;
  for(let i=0;i<source.length;i++){const a=source[i],z=source[(i+1)%source.length],dx=z[0]-a[0],dy=z[1]-a[1],u=Math.max(0,Math.min(1,((mid.x-a[0])*dx+(mid.y-a[1])*dy)/(dx*dx+dy*dy))),p=[a[0]+u*dx,a[1]+u*dy],r=Math.hypot(mid.x-p[0],mid.y-p[1]);if(r<distance){distance=r;closest=p;}}
  body=clip.union(body,capsule(mid.toArray(),closest,.08,24));parts.attachments.push({side,mid:mid.toArray(),carrier:closest});
 }
 replace(b.palletBody,plate(clip.difference(body,poly(circle([0,0],.094,128))),-.11,.11));
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
