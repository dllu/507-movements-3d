import * as THREE from 'three';
import pinProfiles from './chain-pump-pin-profiles.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
import {pinnedOuterLinkGeometry} from './chain-drive-working-parts.js';
const tube=(r,h,b)=>boredLatheGeometry([{radial:r,axial:-h/2},{radial:r,axial:h/2}],b,64);
const rectangle=(w,h,x=0,y=0)=>poly([[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]]);
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
function finish(root,seconds){root.userData.hideGround=true;root.userData.minimumDisplayCycleSeconds=seconds;root.traverse(o=>{for(const m of o.material?[].concat(o.material):[])m.fog=false;});}
export function correctChainPump(root){
 const d=root.userData,b=d.blocks,g=d.geometry;
 b.base.visible=false;b.reservoirRim.visible=false;b.reservoir.visible=false;b.reservoirOpening.visible=false;
 replace(b.cylinder,tube(g.cylinderInnerRadius+.06,g.cylinderHeight,g.cylinderInnerRadius));
 for(const wheel of[b.topWheel,b.bottomWheel]){
  replace(wheel.hub,tube(.17,.76,.107));replace(wheel.axle,new THREE.CylinderGeometry(.105,.105,1.08,32));
  wheel.rim.visible=false;wheel.spokes.forEach(o=>o.visible=false);wheel.workingParts=[];
  // Each cheek is one plate: Brown's eight-armed star (hub, eight long arms
  // between the chain seats) joined by his thin rim, with the carrier-shaft
  // pockets swept out of the rim.
  const cheek=plate(pinProfiles.shape,-.025,.025);// inner face 0.2725: the shafts (half-length 0.28, capped by the riser bore) bear on it
  for(const z of[-.2975,.2975]){
   const rim=new THREE.Mesh(cheek,wheel.rim.material);rim.userData.role="swept-cross-shaft-pocket-rim";rim.position.z=z;wheel.rotor.add(rim);wheel.workingParts.push(rim);
  }
  const bracket=new THREE.Mesh(tube(.20,.18,.107),b.topWheel.hub.material);bracket.rotation.x=Math.PI/2;bracket.position.copy(wheel.axle.position);bracket.position.z=-.52;root.add(bracket);wheel.bearing=bracket;
 }
 for(const carrier of b.carriers){const axle=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.56,32),carrier.link.material);axle.rotation.x=Math.PI/2;axle.userData.role='chain-carrier-cross-shaft';carrier.carrier.add(axle);carrier.crossShaft=axle;}
 // p109: the chain is 227's pinned chain: alternate outer links (two side
 // plates, z 0.018-0.046 each side) and inner links (one plate, z +-0.014)
 // joined at every carrier by its cross shaft, which is the chain pin. The
 // 24 links close the loop at the carrier pitch; each spans the chord
 // between its two carriers (on the wheels the chord is 2.6% shorter than
 // the arc pitch, taken up by scaling the link along its length).
 b.endlessChain.visible=false;
 const pitch=g.carrierSpacing,eyeRadius=.046;
 const outerGeometry=pinnedOuterLinkGeometry({pitch,halfGap:.032,plateHalfThickness:.014,eyeRadius,pins:false});
 const broad=outerGeometry.userData.broadHalf,innerShape=new THREE.Shape();
 innerShape.absarc(pitch,0,broad,-Math.PI/2,Math.PI/2,false);innerShape.absarc(0,0,broad,Math.PI/2,3*Math.PI/2,false);innerShape.closePath();
 for(const x of[0,pitch]){const eye=new THREE.Path();eye.absarc(x,0,eyeRadius-.003,0,2*Math.PI,true);innerShape.holes.push(eye);}
 const innerGeometry=new THREE.ExtrudeGeometry(innerShape,{bevelEnabled:false,curveSegments:16,depth:.028,steps:1}).rotateX(Math.PI/2).translate(0,.014,0);
 const outerMaterial=b.carriers[0].link.material,innerMaterial=outerMaterial.clone();innerMaterial.color.offsetHSL(0,0,.10);
 const chain=new THREE.Group();chain.userData.role='pinned-endless-chain-of-alternate-inner-and-outer-links';root.add(chain);
 const links=b.carriers.map((c,i)=>{c.link.visible=false;const link=new THREE.Mesh(i%2?innerGeometry:outerGeometry,i%2?innerMaterial:outerMaterial);
  link.userData.role=i%2?'pinned-chain-inner-link-plate':'pinned-chain-outer-link-side-plates';link.userData.chainLink=true;chain.add(link);return link;});
 b.chainLinks=links;
 const ax=new THREE.Vector3(),ay=new THREE.Vector3(0,0,1),az=new THREE.Vector3(),basis=new THREE.Matrix4();
 d.updateChainLinks=()=>{
  links.forEach((link,i)=>{
   const a=b.carriers[i].carrier.position,c=b.carriers[(i+1)%links.length].carrier.position;
   ax.subVectors(c,a);const chord=ax.length();ax.divideScalar(chord);az.crossVectors(ax,ay);
   basis.makeBasis(ax,ay,az);link.quaternion.setFromRotationMatrix(basis);link.position.copy(a);link.scale.set(chord/pitch,1,1);
  });
 };
 const floor=b.dischargeTrough.children[0],troughShape=clip.difference(rectangle(2.35,.72),poly(circle([1.05,0],g.cylinderInnerRadius,96)));
 replace(floor,plate(troughShape,-.045,.045).rotateX(Math.PI/2));floor.rotation.z=0;
 b.dischargeTrough.children.slice(1).forEach(o=>o.rotation.z=0);
 // The outlet stream begins beside the riser rather than crossing its disks.
 replace(b.dischargeWater,new THREE.BoxGeometry(1.72,.055,.64));b.dischargeWater.position.x=g.leftLegX-1.40;
 d.reconstructionNote='An imposed chain path carries a pinned chain of alternate inner and outer links (pins are the carrier cross shafts) with sealing disks up the riser. Split wheel cheeks have swept pockets around carrier cross shafts; chain articulation, tension, power transfer and hydraulic efficiency are not dynamically solved. Water is schematic and the small disk clearance is not a pressure-tight seal.';
 finish(root,8);
}
export function correctWeir(root){
 const d=root.userData,b=d.blocks,g=d.geometry;
 b.foundation.visible=false;b.channelBanks.visible=false;
 for(const [body,length,offset,assembly]of[[b.upperBody,b.upperBody.geometry.parameters.height,b.upperBody.position.y,b.upperPivotAssembly],[b.lowerBody,g.lowerLength,b.lowerBody.position.y,b.lowerPivotAssembly]]){
  const shape=clip.difference(clip.union(rectangle(.16,length,0,offset),poly(circle([0,0],.16,64))),poly(circle([0,0],.097,64)));
  replace(body,plate(shape,-g.gateWidth/2,g.gateWidth/2));body.position.y=0;
  for(const bearing of assembly.bearings)replace(bearing,tube(.18,.18,.097));
 }
 b.upperContactEdge.geometry.dispose();b.upperContactEdge.geometry=new THREE.BoxGeometry(.025,.05,g.gateWidth);b.upperContactEdge.position.set(-g.upperThickness/2+.0125,-g.upperPivotFromBottom+.025,0);
 b.upperReinforcements.forEach(o=>o.position.x=g.upperThickness/2+.025);
 b.lowerReinforcements.forEach(o=>o.position.x=-g.lowerThickness/2-.025);
 // Keep the first batten clear of the pivot axle.
 b.lowerReinforcements[0].position.y=.20;
 for(const assembly of[b.upperPivotAssembly,b.lowerPivotAssembly])assembly.bearings.find(o=>o.position.z>0).visible=false;
 // Brown's section draws no pivot post: the rear bearings stand for the
 // channel wall that carries both axles, which the section cuts away.
 // Separate schematic head volumes from the finite moving leaves.
 replace(b.upstreamWater,new THREE.BoxGeometry(2.61,1,3.08));b.upstreamWater.position.x=-1.925;
 replace(b.downstreamWater,new THREE.BoxGeometry(1.70,1,3.08));b.downstreamWater.position.x=2.25;
 const y=g.notchBottomY,curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.4,y+.24,0),new THREE.Vector3(.16,y+.23,0),new THREE.Vector3(.48,y-.10,0),new THREE.Vector3(1.6,g.downstreamWaterLevel+.15,0)]);
 replace(b.notchFlow,new THREE.TubeGeometry(curve,64,.10,12,false));
 replace(b.bedFlow,new THREE.CylinderGeometry(1,1,3,24).rotateZ(Math.PI/2));
 d.updateWorkingParts=state=>{
  b.notchFlow.visible=state.contactDrive<1e-8;
  const lowest=state.lowerBottomCenter.y-g.lowerThickness/2*Math.abs(Math.sin(state.lowerAngle)),gap=lowest-g.channelFloorY;
  b.bedFlow.position.set(0,g.channelFloorY+gap/2,0);b.bedFlow.scale.set(1,Math.max(.001,gap*.25),Math.max(.001,gap*.25));// The scour passage fills from nothing as the leaf lifts off the bed.
  b.bedFlow.visible=state.contactDrive>1e-4&&gap>1e-4;
 };
 d.reconstructionNote='The upper-leaf angle follows a prescribed flood cycle; the lower angle solves the finite panel-edge contact geometry. Bored pivots permit that motion. Head volumes and flow streams are schematic; pressure, inertia, friction, stability and automatic reopening/reclosure are not dynamically validated.';
 finish(root,12);
}
