import * as THREE from 'three';
import {bevelToothGeometry,bevelBodyGeometry} from './bevel-geometry.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {rackPinionGeometry,rackToothGeometry} from './rack-pinion-parts.js';
import {plate,poly,circle,polygonClipping} from './finite-plate-geometry.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
const bored=(inner,outer,length)=>boredLatheGeometry([{radial:outer,axial:-length/2},{radial:outer,axial:length/2}],inner,64);
function bevel(gear,phase=0){
 const u=gear.userData,profile=bevelToothGeometry({teeth:u.teeth,innerDistance:u.innerDistance,outerDistance:u.outerDistance,pitchConeAngle:u.pitchConeAngle,toothHeight:u.toothHeight,toothThicknessFactor:.96,flankSegments:16,tipSegments:6});
 replace(u.body,bevelBodyGeometry(profile,u.boreRadius));
 for(const[toothIndex,tooth]of u.toothMeshes.entries()){replace(tooth,profile.clone().rotateZ(toothIndex*2*Math.PI/u.teeth+phase));tooth.userData.bevelTooth=true;}
 u.faceRing.position.z=profile.userData.root.z+.018;u.faceIndex.position.z=profile.userData.root.z+.034;
 u.toothProfile='back-cone-involute-approximation';u.toothPhase=phase;profile.dispose();
}
export function correctScriberDynamometer(root,id){
 const b=root.userData.blocks,g=root.userData.geometry;
 if(id===368){
  b.driverBevel.userData.boreRadius=.074;b.drivenBevel.userData.boreRadius=.084;
  bevel(b.driverBevel);bevel(b.drivenBevel,9.2*Math.PI/180);
  replace(b.verticalBearing,bored(.084,.16,.24));
  const hub=b.spurGear.userData.rotor.children[1],p=hub.geometry.parameters;replace(hub,bored(.074,Math.max(p.radiusTop,.10),p.height));b.spurGear.userData.rotor.children[2].visible=false;
  const addendum=.042,phase=(b.rack.userData.localBottom+g.scribingBottomY-g.spurCenter.y)/g.spurPitchRadius+Math.PI/g.spurTeeth-g.inputStartAngle;
  replace(b.spurGear.userData.rotor.children[0],rackPinionGeometry({radius:g.spurPitchRadius,teeth:g.spurTeeth,addendum,depth:.31,bore:.074}).rotateZ(phase));
  const rackTransform=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0));
  for(const tooth of b.rack.userData.teeth){replace(tooth,rackToothGeometry({pitch:g.rackPitch,addendum,depth:.315}).applyMatrix4(rackTransform));tooth.rotation.set(0,0,0);tooth.position.z=b.rack.userData.pitchPlaneZ;}
  b.rack.userData.body.position.z=b.rack.userData.pitchPlaneZ-addendum-.006-.075;
  for(const guide of b.rackGuides)for(const cheek of guide.children.slice(1))cheek.position.x=g.spurCenter.x+Math.sign(cheek.position.x-g.spurCenter.x)*.215;
  const tableOutline=poly([[-2.325,-.925],[2.325,-.925],[2.325,.925],[-2.325,.925]]),shaftHole=poly(circle([-1.12,-.05],.085,128)),rackHole=poly([[.39,.37],[.73,.37],[.73,.65],[.39,.65]]);
  replace(b.table,plate(polygonClipping.difference(tableOutline,shaftHole,rackHole),-.08,.08).rotateX(-Math.PI/2));
  b.contactBead.visible=false;
  root.userData.reconstructionNote='The same shaft turns the cylinder through bevel gears and moves its scriber through a spur gear and rack. Their fixed ratio sets the spiral pitch. The hand-cranked reversal retraces the same line; Brown specifies no automatic return or speed.';
 }else{
  for(const gear of[b.inputGear,b.outputGear,b.topPlanetGear,b.bottomPlanetGear])bevel(gear);
  replace(b.inputSleeve,bored(.092,.16,.61));replace(b.carrierBoss,bored(.092,.23,.42));
  for(const bearing of b.shaftBearings){replace(bearing,bored(.092,.19,.28));bearing.position.z=0;}
  replace(b.outputShaftIndex,new THREE.BoxGeometry(.44,.012,.026));b.outputShaftIndex.position.set(-1.72,.088,0);
  for(const arm of b.carrierArms){replace(arm,new THREE.CylinderGeometry(.068,.068,1.45,48));arm.position.y=Math.sign(arm.position.y)*.94;}
  for(const axle of b.planetAxles)axle.visible=false; // Replaced by the continuous cylindrical carrier arms.
  for(const arm of b.carrierCrossArms){replace(arm,new THREE.BoxGeometry(.14,.14,1.40));arm.position.z=Math.sign(arm.position.z)*.93;}
  for(const marker of b.contactMarkers)marker.visible=false;
  root.userData.reconstructionNote='The restrained hoop carries two intermediate bevel gears. Equal side gears counter-rotate, and the weighing band balances twice the transmitted shaft torque. Power additionally requires shaft speed; the illustrated load and speed are assumed.';
 }
 root.userData.hideGround=true;root.userData.minimumDisplayCycleSeconds=id===368?10:8;
 root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)material.fog=false;});
}
