import * as THREE from 'three';
import {bandInvoluteGear,involute} from './band-epicyclic-geometry.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
const annulus=(inner,outer,low,high)=>boredLatheGeometry([{radial:outer,axial:low},{radial:outer,axial:high}],inner,64);
// Paint an existing tooth, including its edge, without adding contact geometry.
const paintIndexTooth=(mesh,material,teeth)=>{
 const geometry=mesh.geometry,p=geometry.attributes.position;
 geometry.clearGroups();mesh.material=[mesh.material,material];
 let start=0,last=-1;
 for(let i=0;i<p.count;i+=3){
  const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3;
  const index=Math.hypot(x,y)>.70&&Math.abs(Math.atan2(y,x))<Math.PI/(2*teeth)?1:0;
  if(index!==last){if(last>=0)geometry.addGroup(start,i-start,last);start=i;last=index;}
 }
 geometry.addGroup(start,p.count-start,last);
};
export function correctEpicyclic503504(root,id){
 const b=root.userData.blocks,g=root.userData.geometry;
 root.userData.minimumDisplayCycleSeconds=12;
 if(id===503){
  for(const[gear,bore]of[[b.lowerC,.116],[b.upperD,.116],[b.planetB,.106]]){
   const hub=gear.userData.rotor.children.find(o=>o.userData.boreRadius&&!o.userData.bevelGearBody);
   replace(hub,annulus(bore,.216,-.46,.285).rotateX(Math.PI/2));hub.rotation.set(0,0,0);hub.position.set(0,0,0);hub.userData.boreRadius=bore;
  }
  replace(b.planetAxle,new THREE.CylinderGeometry(.105,.105,1.75,48));b.planetAxle.position.x=.77;
  replace(b.outerCarrierHead,new THREE.CylinderGeometry(.24,.24,.25,48));b.outerCarrierHead.position.x=1.50;
  replace(b.carrierIndex,new THREE.BoxGeometry(.18,.04,.055));b.carrierIndex.position.set(1.50,.22,0);
  root.userData.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-1.88,-1.70,-1.88),new THREE.Vector3(1.88,1.70,1.88));
  root.userData.reconstructionNote='Two loose equal bevel wheels drive the arm at their average speed; the carried pinion turns according to their speed difference. Tooth sections, shaft fits and the two input speeds are reconstructed.';
 }else{
  // One straight 20-tooth B profile serves all outputs. Base pitch is shared;
  // each output's tooth thickness adapts to its own working pressure angle.
  const module=g.fixedModule,alpha=Math.PI/9,spacing=g.carrierPinSpacing,base20=10*module*Math.cos(alpha),half20=Math.PI/40+involute(1/Math.cos(alpha))-.0006/(20*module),tip=.8375,rootRadius=.655,backlash=.0012;
  const profile=(teeth,bore,depth,half)=>bandInvoluteGear({teeth,baseRadius:teeth*module*Math.cos(alpha)/2,baseHalfAngle:half,rootRadius,tipRadius:tip,boreRadius:bore,depth,flankSamples:24});
  const install=(gear,geometry)=>{replace(gear.userData.rotor.children[0],geometry);gear.userData.rotor.children[0].userData.boreRadius=geometry.userData.boreRadius;Object.assign(gear.userData,{referenceModule:module,baseRadius:geometry.userData.baseRadius,baseHalfAngle:geometry.userData.baseHalfAngle,basePitch:geometry.userData.basePitch,rootRadius,outerRadius:tip,toothProfile:'common-base-pitch-profile-shifted-involute'});};
  install(b.fixedA,profile(20,.121,g.gearDepth,half20));install(b.inputRowB,profile(20,.151,.83,half20));
  for(const row of b.intermediateRows.slice(1))row.visible=false;
  const branches={};
  for(const[label,gear]of Object.entries(b.outputs)){
   const n=gear.userData.teeth,workingB=spacing*20/(20+n),workingOutput=spacing*n/(20+n),baseOutput=n*module*Math.cos(alpha)/2,workingModule=2*spacing/(20+n),workingAlpha=Math.acos((base20+baseOutput)/spacing),halfOutput=(Math.PI-backlash/workingModule-20*(half20-involute(workingB/base20)))/n+involute(workingOutput/baseOutput);
   install(gear,profile(n,.131,g.gearDepth,halfOutput));
   paintIndexTooth(gear.userData.rotor.children[0],b.outputIndices[label].material,n);
   branches[label]={teeth:n,workingPressureAngle:workingAlpha,workingBRadius:workingB,workingOutputRadius:workingOutput,basePitch:2*Math.PI*base20/20,baseHalfAngle:halfOutput,contactRatio:(Math.sqrt(tip*tip-base20*base20)+Math.sqrt(tip*tip-baseOutput*baseOutput)-spacing*Math.sin(workingAlpha))/(Math.PI*module*Math.cos(alpha))};
  }
  replace(b.stationaryStud,new THREE.CylinderGeometry(.12,.12,1.70,48));b.stationaryStud.position.y=-.72;
  replace(b.intermediateSleeve,annulus(.091,.15,-.53,.53));
  replace(b.outputPin,new THREE.CylinderGeometry(.13,.13,1.42,48));b.outputPin.position.y=-.13;
  replace(b.carrierPivots[0],annulus(.121,.19,-.07,.07));b.carrierPivots[0].position.y=-.84;
  root.userData.workingProfiles={module,pressureAngle:alpha,base20,half20,tipRadius:tip,rootRadius,backlash,branches};
  root.userData.reconstructionNote='One thick 20-tooth wheel drives the 21-, 20-, and 19-tooth outputs. F holds its world orientation; E and G turn slowly in opposite directions. Common base pitch and adjusted output tooth thicknesses reconstruct the unspecified historical teeth.';
 }
 root.userData.familyReview.contactQualification='See docs/validation/503-504-contact-solids.json; working contact ratios and sampled actual surfaces.';
 root.userData.hideGround=true;
 root.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)m.fog=false;});
}
