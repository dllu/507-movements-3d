import * as THREE from 'three';
import {bandInvoluteGear,involute} from './band-epicyclic-geometry.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import generated from './generated-irregular-gear-profiles.js';
import {boredPlanarLinkGeometry} from './bored-planar-link.js';
import {supportMaterial} from './back-plate-support.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
const boreHub=(mesh,bore)=>{const p=mesh.geometry.parameters;replace(mesh,boredLatheGeometry([{radial:Math.max(p.radiusTop,bore+.025),axial:-p.height/2},{radial:Math.max(p.radiusBottom,bore+.025),axial:p.height/2}],bore,64));};
const contourGeometry=(outline,bore,depth)=>{const shape=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x,y))),hole=new THREE.Path();hole.absarc(0,0,bore,0,Math.PI*2,true);shape.holes.push(hole);const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:64}).translate(0,0,-depth/2);geometry.userData={outline,boreRadius:bore,toothProfile:'offline-swept-mating-gear-envelope'};return geometry;};
// A flat strap bounded by two eye circles concentric with its pins and their
// outer common tangents, bored at both eyes.
function taperedStrapGeometry(length,eyeA,eyeB,bore,depth){
 const c=(eyeA-eyeB)/length,sn=Math.sqrt(1-c*c),shape=new THREE.Shape();
 const a0=Math.atan2(sn,c),b0=a0;
 shape.absarc(0,0,eyeA,a0,2*Math.PI-a0,false);shape.absarc(length,0,eyeB,-b0,b0,false);shape.closePath();
 for(const x of[0,length]){const hole=new THREE.Path();hole.absarc(x,0,bore,0,Math.PI*2,true);shape.holes.push(hole);}
 const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:48}).translate(0,0,-depth/2);
 geometry.userData.bores=[{x:0,y:0,radius:bore},{x:length,y:0,radius:bore}];return geometry;
}
export function irregularCircularProfile(radius,teeth,depth,bore){
 const alpha=Math.PI/6,module=2*radius/teeth,baseRadius=radius*Math.cos(alpha);
 return bandInvoluteGear({teeth,baseRadius,baseHalfAngle:Math.PI/(2*teeth)+involute(1/Math.cos(alpha))-.0008/radius,rootRadius:radius-.9*module,tipRadius:radius+.85*module,boreRadius:bore,depth,flankSamples:24});
}
export function correctIrregularGearFamily(root,id,update){
 const b=root.userData.blocks,g=root.userData.geometry;
 if(id===201){
  const body=b.eccentricGear.userData.rotor.children[0],profile=irregularCircularProfile(g.driverPitchRadius,g.driverTeeth,.34,.098),offset=g.driverEccentricOffset;
  const outline=profile.userData.outline.map(p=>p.clone().add(offset)),shape=new THREE.Shape(outline),hole=new THREE.Path();hole.absarc(0,0,.098,0,2*Math.PI,true);shape.holes.push(hole);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.34,bevelEnabled:false,curveSegments:64}).translate(0,0,-.17);geometry.userData={...profile.userData,outline,boreCenter:[0,0]};replace(body,geometry);profile.dispose();
  // The bore is a snug fit (0.003 clear) on the 0.095 input shaft the gear is keyed to.
  b.eccentricGear.userData.boreRadius=.098;
  const rotor=b.pinion.userData.rotor;replace(rotor.children[0],irregularCircularProfile(g.pinionPitchRadius,g.pinionTeeth,.34,.084));
  // The original quarter-pitch convention belonged to trapezoidal teeth.
  rotor.children[0].geometry.rotateZ(-Math.PI/(2*g.pinionTeeth));
  boreHub(rotor.children[1],.084);rotor.children[2].visible=false;
  replace(b.slotFollower,new THREE.CylinderGeometry(.125,.125,.36,48));
  const rim=b.rod.children.find(o=>o.userData.role==='slot-follower-roller-rim');replace(rim,new THREE.TorusGeometry(.13,.025,10,48));rim.visible=false;rim.userData.retiredInkOutline=true;
  root.userData.reconstructionNote='An eccentric circular gear reconstructs the unspecified irregular driver. Its carried pinion rotates continuously, rocking the slotted arm and reciprocating rod A. The belt speed is measured relative to that moving arm; dimensions and speeds are inferred.';
 }else if(id===196){
  replace(b.wheelBody,contourGeometry(generated[196].outline,g.boreRadius,g.wheelDepth));for(const tooth of b.wheelToothMeshes)tooth.visible=false;
  const pinionBody=b.pinion.userData.rotor.children[0];replace(pinionBody,irregularCircularProfile(g.pinionPitchRadius,g.pinionTeeth,g.wheelDepth,.070));pinionBody.geometry.rotateZ(-Math.PI/(2*g.pinionTeeth));
  boreHub(b.wheelHub,.075);b.wheelHub.userData.boreRadius=.075;
  const rotor=b.pinion.userData.rotor;boreHub(rotor.children[1],.070);rotor.children[2].visible=false;
  const arm=b.carrierArm,link=new THREE.Mesh(taperedStrapGeometry(g.carrierLength,.25,.15,.076,.15),arm.children[0].material);link.userData.role='flat-tapered-strap-arm-A-to-stand';
  for(const child of arm.children)child.visible=false;arm.add(link);
  arm.userData.setEndpoints=(start,end)=>{link.position.copy(start);link.rotation.z=Math.atan2(end.y-start.y,end.x-start.x);};
  const state=root.userData.kinematics;arm.userData.setEndpoints(new THREE.Vector3(g.carrierPivot.x,g.carrierPivot.y,.405),new THREE.Vector3(state.wheelCenter.x,state.wheelCenter.y,.405));
  b.boredCarrierLink=link;
  // A plain pin from the stand's eye (in the pedestal's plane, z -0.69..-0.47)
  // to just proud of the strap's front face; no barrel.
  const pinLow=-.70,pinHigh=.405+.075+.02;
  const pivot=new THREE.Mesh(new THREE.CylinderGeometry(.073,.073,pinHigh-pinLow,48),link.material);pivot.rotation.x=Math.PI/2;pivot.position.set(g.carrierPivot.x,g.carrierPivot.y,(pinLow+pinHigh)/2);pivot.userData.role='fixed-pin-through-bored-carrier-eye';root.add(pivot);b.carrierPivotPin=pivot;
  replace(b.carrierBearing,boredLatheGeometry([{radial:.23,axial:-.12},{radial:.23,axial:.12}],.075,64).rotateX(Math.PI/2));b.carrierBearing.position.z=-.58;b.carrierBearing.userData.role='fixed-stand-eye-at-carrier-arm-pivot';
  b.carrierStandard.userData.setEndpoints(new THREE.Vector3(g.carrierPivot.x,-1.7,-.58),new THREE.Vector3(g.carrierPivot.x,g.carrierPivot.y-.20,-.58));
  // Pinion B's fixed axis is carried, not a bare stub: a bored bearing boss
  // round the axle's rear end, on a stay running straight back to a round
  // flange on the framing wall behind (both hidden behind the pinion in the
  // plate's view). The old loose ring on the axle becomes that boss.
  {const frame=supportMaterial();frame.fog=false;const axle=b.pinion.position,zWall=-1.6;
   const boss=[];root.traverse(o=>{if(o.userData.role==='fixed-bearing-at-pinion-B')boss.push(o);});
   for(const o of boss){replace(o,boredLatheGeometry([{radial:.2,axial:-.42},{radial:.2,axial:-.08}],.095,64).rotateX(Math.PI/2));o.material=frame;o.position.set(axle.x,axle.y,-.28);o.rotation.set(0,0,0);}
   const stay=new THREE.Mesh(new THREE.BoxGeometry(.24,.24,-zWall-.701),frame);stay.position.set(axle.x,axle.y,(zWall-.701)/2);stay.userData.role='fixed-stay-from-pinion-B-bearing-to-framing-wall';
   const flange=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.08,48).rotateX(Math.PI/2),frame);flange.position.set(axle.x,axle.y,zWall-.04);flange.userData.role='fixed-framing-flange-behind-pinion-B';
   for(const o of[stay,flange]){o.castShadow=o.receiveShadow=true;root.add(o);}b.pinionBearingStay=stay;}
  root.userData.reconstructionNote='A uniform fixed-axis pinion rolls against an inferred two-lobed pitch curve and rocks the carrying arm. The mating teeth are reconstructed around that motion; historical dimensions and load response are unspecified.';
 }else{
  root.userData.profileGenerationBlank=[b.drivenBody,...b.drivenTeeth].map(mesh=>({outline:mesh.geometry.parameters.shapes.extractPoints(64).shape.map(p=>[p.x,p.y]),buffer:mesh.geometry.parameters.options.bevelSize??0}));
  // Both scrolls are hobbed offline by one rack, so their teeth match; each
  // step has a whole tooth on its high side and a relieved notch floor after it.
  replace(b.drivenBody,contourGeometry(generated[191].outline,g.boreRadius,g.gearDepth));for(const tooth of b.drivenTeeth)tooth.visible=false;
  replace(b.driverBody,contourGeometry(generated['191driver'].outline,g.boreRadius,g.gearDepth));for(const tooth of b.driverTeeth)tooth.visible=false;
  for(const body of[b.drivenBody,b.driverBody])body.geometry.userData.toothProfile='offline-rack-hobbed-conjugate-scroll';
  for(const gear of[b.driver,b.driven]){const hub=gear.userData.rotor.children.find(o=>o.userData.role?.endsWith('scroll-gear-hub'));boreHub(hub,.076);hub.userData.boreRadius=.076;}
  root.userData.reconstructionNote='The lower scroll turns uniformly and accelerates the upper scroll during each turn. The stepped seam requires disengagement and a sudden speed reset: this prescribed repeat is not a smooth, continuously engaged physical drive.';
 }
 root.userData.hideGround=true;root.userData.minimumDisplayCycleSeconds=id===191?12:10;
 root.userData.irregularGearReview={report:'docs/validation/191-196-201-contact.json',generatedEnvelope:id!==201,loadedDynamics:false};
 for(const object of[b.contactMarker,b.gearContactMarker,b.wheelPitchLine,b.driverPitchLine,b.drivenPitchLine])if(object)object.visible=false;
 root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)material.fog=false;});
 const visible=[];root.traverseVisible(o=>{if(o.isMesh){o.geometry.computeBoundingBox();visible.push(o);}});
 const bounds=new THREE.Box3(),period=root.userData.transmission.cyclePeriod??root.userData.transmission.inputCyclePeriod;
 for(let i=0;i<=64;i++){update(period*i/64);root.updateMatrixWorld(true);for(const mesh of visible)bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));}
 root.userData.cameraFitBounds=bounds.expandByScalar(.06);root.userData.cameraDistanceScale=1.04;update(0);
}
