import * as THREE from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate,poly,circle,capsule,polygonClipping} from './finite-plate-geometry.js';
import {markShadows} from './primitives.js';
function replace(mesh,geometry){mesh.geometry.dispose();mesh.geometry=geometry;}
function bore(outer,inner,length){return boredLatheGeometry([{radial:outer,axial:-length/2},{radial:outer,axial:length/2}],inner,64);}
function beam(a,b,width,depth,material){const delta=b.clone().sub(a),m=new THREE.Mesh(new THREE.BoxGeometry(delta.length(),width,depth),material);m.position.copy(a).add(b).multiplyScalar(.5);m.rotation.z=Math.atan2(delta.y,delta.x);return m;}
function unbevel(mesh){const old=mesh.geometry.parameters,g=new THREE.ExtrudeGeometry(old.shapes,{...old.options,bevelEnabled:false});g.translate(0,0,-old.options.depth/2);replace(mesh,g);}
export function correctDetachedChronometer(root,id,update){
 const d=root.userData,b=d.blocks,g=d.geometry,p={pairs:[],workingPairs:[]};
 if(id===308){
  // Mount every axial pin in the rim instead of leaving it outside the rim.
  replace(b.wheelRing,plate(polygonClipping.difference(poly(circle([0,0],g.pinOrbitRadius+.05,128)),poly(circle([0,0],g.pinOrbitRadius-.17,128))),-g.wheelDepth/2,g.wheelDepth/2));
  for(const spoke of b.spokeMeshes){const angle=spoke.rotation.z,end=g.pinOrbitRadius-.10;replace(spoke,new THREE.BoxGeometry(end-.13,.105,g.wheelDepth*.76));spoke.position.set(Math.cos(angle)*(end+.13)/2,Math.sin(angle)*(end+.13)/2,0);}
  replace(b.wheelHub,bore(.15,.126,.82));
  const bearings={};b.fixedFrame.traverse(o=>{if(o.userData.role?.endsWith('-bearing'))bearings[o.userData.role]=o;});
  p.pairs.push([bearings['sixty-pin-wheel-bearing'],b.wheelHub]);
  replace(b.pivotEye,bore(.22,.126,.18).rotateX(Math.PI/2));
  replace(b.pendulumRod,new THREE.BoxGeometry(7.64,.12,.18));b.pendulumRod.position.set(0,-4,.12);b.pendulumRod.rotation.z=-Math.PI/2;
  p.pairs.push([bearings['pendulum-crutch-bearing'],b.pivotEye],[bearings['pendulum-crutch-bearing'],b.pendulumRod]);
  const detentShaft=bearings['Q-detent-bearing'];replace(detentShaft,new THREE.CylinderGeometry(.12,.12,1.35,48));detentShaft.position.z=.10;
  replace(b.detentPivotEye,bore(.19,.126,.16).rotateX(Math.PI/2));
  const tail=g.detentTailAtRest.clone().sub(g.detentPivot).toArray();
  const rail=polygonClipping.difference(polygonClipping.union(capsule([0,0],tail,.06,24),poly(circle([0,0],.19,64))),poly(circle([0,0],.126,64)));
  replace(b.detentRail,plate(rail,-.07,.07));b.detentRail.position.set(0,0,0);b.detentRail.rotation.set(0,0,0);
  p.pairs.push([detentShaft,b.detentPivotEye],[detentShaft,b.detentRail],[detentShaft,b.detentBrace]);
  const center=g.detentCatchCenterAtRest.clone().sub(g.detentPivot),start=center.clone().setLength(.22);
  const bridge=beam(new THREE.Vector3(start.x,start.y,.005),new THREE.Vector3(center.x,center.y,.005),.065,.07,b.detentRail.material);bridge.userData.role='Q-upper-plane-bridge-to-rounded-locking-pad';b.detentAssembly.add(bridge);p.catchBridge=bridge;
  p.workingPairs=b.wheelPins.flatMap(pin=>[[pin,b.detentCatch],[pin,bridge]]);
  d.reconstructionNote='Lever Q now holds each finite wheel pin on a rounded locking pad, withdraws before the step and returns after the outgoing pin clears. The pin row is mounted in the rim. Detent motion is prescribed; the impulse-pallet profile and one-way C–Q handoff remain unresolved, so this is not a validated passive escapement.';
  p.contactQualification='Rounded Q pad: 0.0005 nominal clearance, resisting lock reaction, full-cycle finite pin clearance and continuous prescribed withdrawal/return. Impulse I and click C remain unqualified.';
 }else{
  // Remove the banking-tail bevel that projected beyond the stated stop corner.
  unbevel(b.bankingTail);
  replace(b.wheelHub,bore(.34,.116,.70));replace(b.wheelShaft,new THREE.CylinderGeometry(.11,.11,1.05,48));
  replace(b.leverPivotHub,bore(.22,.126,.72));
  const arbor=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,1.26,48),b.leverPivotHub.material);arbor.rotation.x=Math.PI/2;arbor.position.z=.12;arbor.userData.role='locking-lever-arbor-through-rear-journal';b.palletLever.add(arbor);p.arbor=arbor;
  replace(b.balanceStaff,new THREE.CylinderGeometry(.115,.115,2.05,48));b.balanceStaff.position.z=.53;
  for(const[journal,radius]of[[b.wheelBearing,.11],[b.leverBearing,.12],[b.balanceBearing,.115]]){replace(journal,bore(.30,radius+.006,.24).rotateX(Math.PI/2));journal.position.z=-.50;}
  p.pairs.push([b.wheelShaft,b.wheelHub],[b.wheelShaft,b.wheelBearing],[arbor,b.leverPivotHub],[arbor,b.leverBearing],[b.balanceStaff,b.balanceBearing],[b.balanceStaff,b.rollerDisk]);
  for(const shaft of[b.wheelShaft,arbor,b.balanceStaff])for(const frame of[b.wheelToLeverFrame,b.leverToBalanceFrame,b.leverToBanksFrame])p.pairs.push([shaft,frame]);
  p.workingPairs=b.bankingPins.map(pin=>[b.bankingTail,pin]);
  b.base.visible=false;b.cameraEnvelope.visible=false;
  d.reconstructionNote='Pallets A and B illustrate locking only; the acting vibration receives direct impulse at balance pallet C, followed by a short return step. The lever now reaches its finite banking stops without bevel interference, and the arbors reach bored journals. Wheel/pallet and fork-pin handoffs remain unvalidated prescribed motion; passive energy and impact dynamics are not simulated.';
  p.contactQualification='Finite banking tail/pins and journals checked. Existing locking A/B, direct impulse C and fork handoffs remain unqualified.';
 }
 d.detachedChronometerParts=p;d.hideGround=true;d.minimumDisplayCycleSeconds=4;d.cameraDirection=new THREE.Vector3(0,.16,15);d.cameraFov=8;d.cameraDistanceScale=.86;
 root.traverse(o=>{for(const mat of[].concat(o.material??[]))mat.fog=false;});markShadows(root);
 const bounds=new THREE.Box3(),point=new THREE.Vector3(),period=g.pendulumPeriod??g.balancePeriod;
 for(let i=0;i<=32;i++){update(period*i/32);root.updateMatrixWorld(true);root.traverseVisible(o=>{const pos=o.geometry?.attributes.position;if(pos&&!o.userData.cameraFitGuide)for(let j=0;j<pos.count;j++)bounds.expandByPoint(point.fromBufferAttribute(pos,j).applyMatrix4(o.matrixWorld));});}
 d.cameraFitBounds=bounds.expandByScalar(.15);update(0);
}
