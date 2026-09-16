import * as THREE from 'three';
import {bevelToothGeometry,bevelBodyGeometry} from './bevel-geometry.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {bandInvoluteGear,involute} from './band-epicyclic-geometry.js';
import {boreSpur,boredCylinder} from './epicyclic-family-corrections.js';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};

function ratioBevel(gear,mateRadius,boreRadius,{phase=0,fraction=.8,heightFactor=1.8}={}){
 const n=gear.userData.teeth,radius=gear.userData.radius,module=2*radius/n,cone=Math.atan(radius/mateRadius);
 const raw=bevelToothGeometry({teeth:n,innerDistance:mateRadius*fraction,outerDistance:mateRadius,pitchConeAngle:cone,toothHeight:module*heightFactor,toothThicknessFactor:.93,flankSegments:16,tipSegments:6});
 const body=bevelBodyGeometry(raw,boreRadius);
 const rotor=gear.userData.rotor;
 const geometry=raw.clone().rotateX(Math.PI).translate(0,0,mateRadius).rotateZ(phase);
 body.rotateX(Math.PI).translate(0,0,mateRadius);
 replace(rotor.children[0],body);rotor.children[0].userData.boreRadius=boreRadius;
 const old=gear.userData.toothMeshes[0].geometry;for(const tooth of gear.userData.toothMeshes)tooth.geometry=geometry;old.dispose();
 const hub=rotor.children.find(m=>m.geometry?.type==='CylinderGeometry');boredCylinder(hub,boreRadius);
 // The hub's shaft passage remains concentric with the corrected cone.
 const indicator=rotor.children.at(-1);indicator.position.z=mateRadius-raw.userData.root.z-.018;
 Object.assign(gear.userData,{pitchConeAngle:cone,coneApexLocal:new THREE.Vector3(0,0,mateRadius),outerDistance:mateRadius,innerDistance:mateRadius*fraction,geometryPhase:phase,boreRadius,toothProfile:'ratio-derived-back-cone-involute-approximation'});
 raw.dispose();return gear;
}
function fullSpur(gear,boreRadius){
 boreSpur(gear,boreRadius);
 const p=gear.userData,r=p.pitchRadius,m=p.module,alpha=Math.PI/9;
 const geometry=bandInvoluteGear({teeth:p.teeth,baseRadius:r*Math.cos(alpha),baseHalfAngle:Math.PI/(2*p.teeth)+involute(1/Math.cos(alpha))-.0003/(4*r),rootRadius:r-1.05*m,tipRadius:r+.8*m,boreRadius,depth:.18,flankSamples:24});
 replace(gear.userData.rotor.children[0],geometry);Object.assign(p,{rootRadius:r-1.05*m,outerRadius:r+.8*m,addendum:.8*m,dedendum:1.05*m,pressureAngle:alpha,toothProfile:'involute-with-matched-full-depth-working-flanks'});
}
function remove(object){object?.removeFromParent();object?.traverse(o=>o.geometry?.dispose());}
export function correctCompoundEpicyclic(root,id){
 const b=root.userData.blocks;root.userData.hideGround=true;
 for(const name of['fixedContactMarkers','carriedContactMarkers','bevelContactMarkers','spurContactMarkers'])for(const marker of b[name]??[])marker.visible=false;
 for(const label of Object.values(b.labels))remove(label);
 if(id===506){
  const r=root.userData.geometry.pitchRadii;
  for(const[first,second,bore1,bore2]of[['A','B',.121,.121],['H','G',.121,.121],['C','D',.121,.106],['F','E',.121,.106]]){
   ratioBevel(b[`gear${first}`],r[second.toLowerCase()],bore1,{phase:['A','H'].includes(first)?Math.PI/b[`gear${first}`].userData.teeth:0});
   ratioBevel(b[`gear${second}`],r[first.toLowerCase()],bore2,{phase:second==='E'?Math.PI/16-Math.PI/12:0});
  }
  boredCylinder(b.lowerSleeve,.121);boredCylinder(b.upperSleeve,.121);boredCylinder(b.compoundSleeve,.106);
  replace(b.supportBase,new THREE.BoxGeometry(8.20,.22,2.5));b.supportBase.position.z=-.90;
  replace(b.driverBearingPedestal,new THREE.BoxGeometry(.28,3.16,.28));b.driverBearingPedestal.position.y=-1.58;
  remove(b.carrierBar);replace(b.carrierIndex,new THREE.BoxGeometry(.024,.30,.045));b.carrierIndex.position.set(2.672,.13,0);
  root.userData.reconstructionLimits='Conical involute approximation; source tooth counts inferred. Sampled engagement and residuals in movement-506-507.md.';
 }else{
  // Nested sleeves must fit inside the small ten-tooth bevel roots.
  for(const [mesh,r,bore]of[[b.longSleeve,.135,.106],[b.shortSleeve,.165,.136]]){
   const h=mesh.geometry.parameters.height;replace(mesh,boredLatheGeometry([{radial:r,axial:-h/2},{radial:r,axial:h/2}],bore,64));mesh.userData.boreRadius=bore;
  }
  boredCylinder(b.planetSleeve,.106);boredCylinder(b.carrierHub,.106);
  ratioBevel(b.gearA,2.5,.136,{fraction:.82});ratioBevel(b.gearD,2.5,.106,{fraction:.82});
  const raw=bevelToothGeometry({teeth:100,innerDistance:.25*.82,outerDistance:.25,pitchConeAngle:Math.atan(10),toothHeight:.05*1.8,toothThicknessFactor:.93,flankSegments:16,tipSegments:6});
  const body=bevelBodyGeometry(raw,raw.userData.root.radius*.82-.08);
  const transform=geometry=>geometry.rotateY(Math.PI/2).translate(-.25,0,0).rotateX(Math.PI/100);
  replace(b.crownRim,transform(body));b.crownRim.rotation.set(0,0,0);
  const tooth=transform(raw.clone());const old=b.crownTeeth[0].geometry;
  for(let i=0;i<b.crownTeeth.length;i++){const mesh=b.crownTeeth[i];mesh.geometry=tooth;mesh.position.set(0,0,0);mesh.rotation.set(i*2*Math.PI/100,0,0);}old.dispose();raw.dispose();
  Object.assign(b.gearC.userData,{radius:2.5,pitchConeAngle:Math.atan(10),coneApexLocal:new THREE.Vector3(-.25,0,0),outerDistance:.25,innerDistance:.205,toothProfile:'ratio-derived-back-cone-involute-approximation'});
  for(const [gear,bore]of[[b.gearE,.106],[b.gearH,.136],[b.gearF,.106],[b.gearG,.106]])fullSpur(gear,bore);
  for(const gear of[b.gearF,b.gearG]){gear.userData.rotor.children[0].geometry.rotateZ(-Math.PI/49);gear.userData.geometryPhase=-Math.PI/49;}
  const arm=clip.difference(poly([[-.065,-.095],[2.215,-.095],[2.215,.095],[-.065,.095]]),poly(circle([0,0],.106,64)));
  replace(b.carrierArm,plate(arm,-.095,.095).rotateX(Math.PI/2));b.carrierArm.position.set(0,4.17,0);
  // The engraving shows a vertical output bearing under the horizontal shaft.
  b.outputBearing.position.z=0;b.outputBearingArm.position.z=0;b.outputBearingArm.scale.z=.18;
  b.outputBearingPedestal.position.z=0;
  b.supportBase.scale.set(.74,1,.27);b.supportBase.position.x=.78;
  b.outputIndex.position.set(.267,1.65,0);replace(b.outputIndex,new THREE.BoxGeometry(.035,1.15,.045));
  root.userData.slowOutputReadout={ratio:25000,degreesPerCarrierRevolution:360/25000,secondsPerOutputRevolution:root.userData.transmission.nominalSlowOutputPeriod};
  root.userData.reconstructionNote='Wheel C turns only 0.0144° per carrier revolution (25,000:1). Its long white index shows the true output; at normal speed one full output turn takes about 72.7 hours.';
  root.userData.reconstructionLimits='Correct25,000:1 velocity retained; ratios and common apices exact, back-cone involute flanks approximate. See movement-506-507.md.';
 }
 root.traverse(o=>{for(const mat of(Array.isArray(o.material)?o.material:[o.material]))if(mat)mat.fog=false;});
}
