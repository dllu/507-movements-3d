import * as THREE from 'three';
import { circle, poly, plate, ring, capsule, polygonClipping } from './finite-plate-geometry.js';
import { rackPinionGeometry, rackToothGeometry } from './rack-pinion-parts.js';
import { sawFeedHoldingPath } from './baked/saw-feed-holding-path.js';
import { nearest390Outline } from './dual-band-pawl-contact.js';

export function sawFeedFlank({ radius, rootRadius, teeth, noseRadius, fraction = .32 }) {
  const pitch=2*Math.PI/teeth;
  const outer=new THREE.Vector2(radius*Math.cos(.25*pitch),radius*Math.sin(.25*pitch));
  const end=new THREE.Vector2(rootRadius*Math.cos(pitch),rootRadius*Math.sin(pitch));
  const edge=end.clone().sub(outer),normal=new THREE.Vector2(edge.y,-edge.x).normalize();
  const point=outer.clone().lerp(end,fraction),center=point.clone().addScaledVector(normal,noseRadius+.0002);
  return{point,normal,center,radius:center.length(),angle:Math.atan2(center.y,center.x),fraction};
}

export function installSawFeedWorkingParts(root) {
  const b=root.userData.blocks,g=root.userData.geometry,rotor=b.ratchet.userData.rotor;
  const rim=b.ratchet.userData.body;
  const outline=b.ratchet.userData.profilePoints.map(p=>p.toArray());
  rim.geometry=plate(polygonClipping.difference(poly(outline),poly(circle([0,0],g.ratchetInnerRadius,96))),-.16,.16);
  rotor.children.find(o=>o.userData.role==='ratchet-shaft-visible-bore').visible=false;
  const hub=rotor.children.find(o=>o.userData.role==='ratchet-and-pinion-common-hub');
  hub.geometry=ring(.164,.4,-.2048,.2048,96);hub.rotation.set(0,0,0);
  const nose=b.pawlNose;nose.geometry=new THREE.CylinderGeometry(g.pawlNoseRadius,g.pawlNoseRadius,.42,96);
  const L=g.pawlLength,curve=new THREE.CatmullRomCurve3([new THREE.Vector3(),new THREE.Vector3(L*.34,.13,0),new THREE.Vector3(L*.76,.08,0),new THREE.Vector3(L,0,0)]);
  const points=curve.getPoints(32).map(p=>[p.x,p.y]);
  const contour=polygonClipping.union(...points.slice(1).map((p,i)=>capsule(points[i],p,.045,12)),poly(circle([0,0],.15,64)));
  b.pawlBody.geometry=plate(polygonClipping.difference(contour,poly(circle([0,0],.074,64))),-.065,.065);
  // This hinge is carried by the adjustable slider, rather than parented to
  // the moving catch itself. The pin therefore spans its actual bored eye.
  const hinge=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.34,48),nose.material);hinge.rotation.x=Math.PI/2;hinge.userData.role='finite-slider-pawl-hinge';root.add(hinge);
  b.slider.geometry=new THREE.CylinderGeometry(.17,.17,.20,48);b.slider.position.z=.26;
  const holding=b.holdingPawl,oldBody=holding.children.find(o=>o.userData.role==='holding-pawl-body');
  const holdingMaterial=oldBody.isMesh?oldBody.material:oldBody.children.find(o=>o.isMesh).material;
  oldBody.visible=false;
  const holdingOutline=polygonClipping.difference(polygonClipping.union(capsule([0,0],[sawFeedHoldingPath.length,0],.04,24),poly(circle([0,0],.15,64)),poly(circle([sawFeedHoldingPath.length,0],.052,64))),poly(circle([0,0],.114,64)));
  const holdingBody=new THREE.Mesh(plate(holdingOutline,-.05,.05),holdingMaterial);
  // The unbored small end is embedded in the finite working nose.
  holdingBody.userData.role='bored-holding-click';holding.add(holdingBody);
  const holdingNose=new THREE.Mesh(new THREE.CylinderGeometry(sawFeedHoldingPath.radius,sawFeedHoldingPath.radius,.32,96),nose.material);
  holdingNose.rotation.x=Math.PI/2;holdingNose.position.set(sawFeedHoldingPath.length,0,-.12);holdingNose.userData.role='finite-holding-click-nose';holding.add(holdingNose);
  const holdingPin=holding.children.find(o=>o.userData.role==='holding-pawl-fixed-pivot-pin');
  holdingPin.geometry=new THREE.CylinderGeometry(.11,.11,1.1,64);holdingPin.position.z=-.25;
  const pinionRotor=b.pinion.userData.rotor;
  pinionRotor.children.forEach(o=>o.visible=false);
  const addendum=.075;
  const pinion=new THREE.Mesh(rackPinionGeometry({radius:g.pinionPitchRadius,teeth:g.pinionTeeth,addendum,depth:.28,bore:.164}),rim.material);
  pinion.rotation.z=Math.PI/2-2.83/g.pinionPitchRadius-g.sourceWheelAngle-Math.PI/g.pinionTeeth;
  pinion.userData.role='finite-involute-feed-pinion';pinionRotor.add(pinion);
  for(const tooth of b.rackTeeth){tooth.geometry=rackToothGeometry({pitch:g.rackPitch,addendum,depth:.28});tooth.rotation.z=Math.PI;}
  const journalOutline=polygonClipping.difference(polygonClipping.union(poly(circle([0,0],.26,96)),capsule([0,0],[0,-.34],.12,16)),poly(circle([0,0],.164,96)));
  const journal=new THREE.Mesh(plate(journalOutline,-.09,.09),holdingMaterial);journal.position.z=-.38;journal.userData.role='bored-output-shaft-guide-journal';root.add(journal);
  b.outputShaft.geometry=new THREE.CylinderGeometry(.16,.16,1.1,64);
  const crankMaterial=b.crankArm.children.find(o=>o.isMesh).material;
  b.crankArm.children.forEach(o=>o.visible=false);
  const crankOutline=polygonClipping.difference(polygonClipping.union(capsule([0,0],[g.crankRadius,0],.11,24),poly(circle([0,0],.33,96)),poly(circle([g.crankRadius,0],.23,64))),poly(circle([0,0],.234,96)),poly(circle([g.crankRadius,0],.144,64)));
  const crankPlate=new THREE.Mesh(plate(crankOutline,.48,.68),crankMaterial);crankPlate.userData.role='bored-input-crank-plate';b.crankArm.add(crankPlate);
  b.inputBearing.geometry=new THREE.CylinderGeometry(.23,.23,.90,64);
  root.userData.workingParts={rim,hub,hinge,pinion,outline,addendum,holdingBody,holdingNose,holdingPin,journal,crankPlate};
  root.userData.updateWorkingInterfaces=state=>{
    hinge.position.set(state.pawlGeometry.pawlPivot.x,state.pawlGeometry.pawlPivot.y,.50);
    const phase=THREE.MathUtils.euclideanModulo(-state.wheelAngle/g.ratchetToothPitch,1);
    const x=phase*(sawFeedHoldingPath.angles.length-1),i=Math.floor(x),f=x-i;
    holding.rotation.z=sawFeedHoldingPath.angles[i]*(1-f)+sawFeedHoldingPath.angles[i+1]*f;
    const center=new THREE.Vector2(holding.position.x+sawFeedHoldingPath.length*Math.cos(holding.rotation.z),holding.position.y+sawFeedHoldingPath.length*Math.sin(holding.rotation.z));
    const hit=nearestSawFeedContact(center,state.wheelAngle,outline);
    const contact=new THREE.Vector2(...hit.point).rotateAround(new THREE.Vector2(),state.wheelAngle),normal=center.clone().sub(contact).normalize();
    state.holdingContact={gap:hit.distance-sawFeedHoldingPath.radius,point:contact,normal,
      outputMomentArm:-(contact.x*normal.y-contact.y*normal.x),angle:holding.rotation.z};
  };
  root.userData.dynamics={prescribedDriveAndReturn:true,holdingPath:'offline bounded-rate clearance follower',forceValidated:false};
  root.userData.reconstructionNote='The crank-rocker closes geometrically and the feed nose drives an actual ratchet flank. The holding click follows a continuous prescribed clearance path. Pawl bias, friction, impact and load transfer are not dynamically validated; the carriage travels through a finite observation window.';
  root.userData.cameraFitBounds.min.y=-2.85;
  root.userData.cameraFitBounds.max.set(6.3,4.75,1.0);
  root.userData.hideGround=true;root.userData.minimumDisplayCycleSeconds=8;root.userData.cameraFov=8;
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])m.fog=false;}});
}

export function nearestSawFeedContact(point, angle, outline) {
  const c=Math.cos(angle),s=Math.sin(angle);
  return nearest390Outline([c*point.x+s*point.y,-s*point.x+c*point.y],outline);
}
