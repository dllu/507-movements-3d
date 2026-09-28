import * as THREE from 'three';
import ellipseProfile from './generated-elliptical-idler-profile.js';
import {smoothExtrudeGeometry} from './smooth-extrusion.js';
import {bandInvoluteGear,involute} from './band-epicyclic-geometry.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {boredPlanarLinkGeometry} from './bored-planar-link.js';
import {PALETTE,matte} from './primitives.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
const bored=(inner,outer,length)=>boredLatheGeometry([{radial:outer,axial:-length/2},{radial:outer,axial:length/2}],inner,64);
export function idlerCircularGeometry(radius,teeth,depth,bore){const alpha=25*Math.PI/180,module=2*radius/teeth;const geometry=bandInvoluteGear({teeth,baseRadius:radius*Math.cos(alpha),baseHalfAngle:Math.PI/(2*teeth)+involute(1/Math.cos(alpha))-.001/(2*radius),rootRadius:radius-1.1*module,tipRadius:radius+.9*module,boreRadius:bore,depth,flankSamples:24});const phase=0;geometry.rotateZ(phase);geometry.userData.outline=geometry.userData.outline.map(p=>p.clone().rotateAround(new THREE.Vector2(),phase));return geometry;}
function circular(gear,radius,teeth,depth,bore){const rotor=gear.userData.rotor;replace(rotor.children[0],idlerCircularGeometry(radius,teeth,depth,bore));const hub=rotor.children[1],p=hub.geometry.parameters;replace(hub,bored(bore,Math.max(p.radiusTop,bore+.035),p.height));rotor.children[2].visible=false;}
const flatten=(mesh,depth)=>replace(mesh,new THREE.ExtrudeGeometry(mesh.geometry.parameters.shapes,{depth,bevelEnabled:false,curveSegments:64}).translate(0,0,-depth/2));
// p96: Brown draws each link as a flat bar about 0.15 of the gear radius
// wide ending in round eyes about 1.25 bar widths in radius, concentric with
// the pins: one bored extrusion in a steel link colour, not a thin ink strip.
const linkMaterial=()=>matte(PALETTE.muted,{metalness:.3,roughness:.5});
function link(group,length,bore,gearRadius){const width=.15*gearRadius,mesh=new THREE.Mesh(boredPlanarLinkGeometry({length,width,eyeRadius:1.25*width,boreRadius:bore,depth:.09}),linkMaterial());for(const old of group.children)old.visible=false;group.add(mesh);group.userData.setEndpoints=(a,b)=>{mesh.position.copy(a);mesh.rotation.z=Math.atan2(b.y-a.y,b.x-a.x);};group.userData.boredMesh=mesh;return mesh;}
export function correctVariableIdler(root,id,update){
 const b=root.userData.blocks,g=root.userData.geometry;
 if(id===221){
  circular(b.outputGear,g.outputPitchRadius,g.outputTeeth,g.circularGearDepth,.107);circular(b.compoundOuterGear,g.compoundOuterPitchRadius,g.compoundOuterTeeth,g.circularGearDepth,.107);circular(b.compoundPinion,g.compoundPinionPitchRadius,g.compoundPinionTeeth,g.driverGearDepth,.107);
  if(ellipseProfile){const shape=new THREE.Shape(ellipseProfile.map(p=>new THREE.Vector2(...p))),hole=new THREE.Path();hole.absarc(0,0,g.boreRadius,0,2*Math.PI,false);shape.holes.push(hole);replace(b.driverBody,smoothExtrudeGeometry(shape,g.driverGearDepth,{low:-g.driverGearDepth/2}));for(const tooth of b.driverTeeth)tooth.visible=false;}
  replace(b.driverHub,bored(.107,.22,1.08));b.driverHub.position.z=-.13;
  for(const mesh of[b.guideFloor,b.guideInnerIsland,b.guideOuterRail])flatten(mesh,mesh===b.guideFloor?g.guideFloorDepth:g.guideRailDepth);
  replace(b.guideRoller,bored(.107,.142,.12));b.guideRoller.position.z=-.49;g.guideRollerRadius=.142;
  replace(b.compoundSpindle,new THREE.CylinderGeometry(.105,.105,1.13,48));b.compoundSpindle.position.z=.015;
  const carrierLink=link(b.carrierBeam,g.carrierLength,.107,g.outputPitchRadius);for(const collar of b.carrierCollars??[])collar.visible=false;carrierLink.position.set(0,0,.48);carrierLink.rotation.z=0;
  replace(b.outputShaft.userData.rotor.children[0],new THREE.CylinderGeometry(.105,.105,1.25,48));b.outputShaft.position.z=.225;
  root.userData.reconstructionNote='The focus-mounted elliptical driver turns a carried compound pinion. A parallel guide groove keeps its spindle at the required distance while the rear wheel drives A. Profiles, clearances and speed are reconstructed from the source geometry.';
 }else{
  circular(b.driverGear,g.driverPitchRadius,g.driverTeeth,g.gearDepth,.092);circular(b.outputGear,g.outputPitchRadius,g.outputTeeth,g.gearDepth,.097);circular(b.idlerGear,g.idlerPitchRadius,g.idlerTeeth,g.gearDepth,.092);
  const body=b.driverGear.userData.rotor.children[0],u=body.geometry.userData,shape=new THREE.Shape(u.outline),hole=(x,y,r)=>{const h=new THREE.Path();h.absarc(x,y,r,0,2*Math.PI,false);shape.holes.push(h);};hole(0,0,.092);const eccentricBore=g.eccentricCenterVector.clone().negate().rotateAround(new THREE.Vector2(),-g.driverGearLocalPhase);hole(eccentricBore.x,eccentricBore.y,.107);const geometry=new THREE.ExtrudeGeometry(shape,{depth:g.gearDepth,bevelEnabled:false,curveSegments:64}).translate(0,0,-g.gearDepth/2);geometry.userData={...u,eccentricBore:eccentricBore.toArray()};replace(body,geometry);
  replace(b.driverCenterJoint,new THREE.CylinderGeometry(.09,.09,.55,48));b.driverCenterJoint.position.z=.30;
  replace(b.driverShaft.userData.rotor.children[0],new THREE.CylinderGeometry(.105,.105,1.025,48));b.driverShaft.position.z=-.2625;
  link(b.outputLink,g.carrierLength,.097,g.outputPitchRadius);link(b.driverLink,g.carrierLength,.092,g.outputPitchRadius);b.outputLinkCollar.visible=false;for(const collar of b.idlerLinkCollars)collar.visible=false;
  root.userData.reconstructionNote='A circular gear turns about an eccentric shaft. Two fixed-length links keep the moving idler correctly spaced from the driver center and output shaft, producing variable output speed. Dimensions, tooth profiles and bearing fits are inferred.';
 }
 root.userData.hideGround=true;root.userData.minimumDisplayCycleSeconds=12;
 for(const marker of[b.smallMeshMarker,b.outerMeshMarker,b.driverContactMarker,b.outputContactMarker])if(marker)marker.visible=false;
 root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)material.fog=false;});update(0);
}
