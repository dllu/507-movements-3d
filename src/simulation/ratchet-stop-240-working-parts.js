import * as THREE from 'three';
import paths from './baked/ratchet-stop-240-paths.js';
import {stop240Contact,stop240Radius} from './ratchet-stop-240-contact.js';
import{plate,poly,circle,capsule,ring,polygonClipping as clip}from'./finite-plate-geometry.js';
export const stop240MaximumLifts=paths.paths.map(p=>Math.max(...p));
const parks=stop240MaximumLifts.map(v=>v+.10);
function pathAt(values,q){const x=Math.max(0,Math.min(1,q))*(values.length-1),i=Math.min(values.length-2,Math.floor(x)),f=x-i;return{value:values[i]*(1-f)+values[i+1]*f,slope:(values[i+1]-values[i])*(values.length-1)};}
export function stateStops240(s,stops,outline,pitch){
 s.pawls=s.pawls.map((old,i)=>{
  const stop=stops[i],ratio=parks[i]/stop.parkLift;let lift=Math.abs(old.angleDelta)*ratio,speed=old.angularSpeed*ratio,acceleration=old.angularAcceleration*ratio;
  if(old.engaged){const p=pathAt(paths.paths[i],s.driveProgress);lift=p.value;speed=stop.liftSign*p.slope*(-s.wheelAngularSpeed/pitch);acceleration=stop.liftSign*p.slope*(-s.wheelAngularAcceleration/pitch);}
  const contact=stop240Contact(stop,lift,s.wheelAngle,outline);contact.normalClearance+=.0005;
  const close=old.engaged&&contact.normalClearance<.008;
  const r=contact.center.clone().sub(stop.pivot),velocity=new THREE.Vector2(-r.y,r.x).multiplyScalar(speed),wheelVelocity=new THREE.Vector2(-contact.point.y,contact.point.x).multiplyScalar(s.wheelAngularSpeed);
  const normalVelocityError=velocity.sub(wheelVelocity).dot(contact.outwardNormal);
  return{...old,angle:stop.restAngle+stop.liftSign*lift,angleDelta:stop.liftSign*lift,angularSpeed:speed,angularAcceleration:acceleration,
   contact:close?contact:null,finiteContact:contact,normalVelocityError,nosePoint:contact.center,
   mode:old.engaged?(s.wheelDwelling?'reverse-locked-on-steep-face':close?`riding-${contact.edge.type}`:'prescribed-free-run-clearance'):old.mode};
 });return s;
}
export function finishStops240(root,stops){
 const d=root.userData,b=d.blocks,g=d.geometry,groups=[b.hookGravityStop,b.straightGravityStop,b.springPawlStop],bodies=[b.hookGravityStopBody,b.straightGravityStopBody,b.springPawlStopBody],noses=[],collars=[];
 const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
 stops.forEach((stop,i)=>{
  const body=bodies[i],group=groups[i],shape=body.geometry.parameters.shapes,outline=poly(shape.extractPoints(24).shape.map(p=>p.toArray()));
  const joined=clip.union(outline,capsule(stop.sourceArm.toArray(),stop.arm.toArray(),.075,24));
  replace(body,plate(i<2?clip.difference(joined,poly(circle([0,0],.089,128))):joined,-.09,.09));
  const nose=new THREE.Mesh(new THREE.CylinderGeometry(stop240Radius-.0005,stop240Radius-.0005,.46,96),body.material);nose.rotation.x=Math.PI/2;nose.position.set(stop.arm.x,stop.arm.y,.20);nose.userData.role=`${stop.key}-finite-working-toe`;group.add(nose);noses.push(nose);
  const collar=group.children.find(o=>o.userData.role===`${stop.key}-pivot-ring`);replace(collar,ring(.089,.205,-.035,.035,128));collars.push(collar);
 });
 replace(b.wheel.userData.hub,ring(.124,.39,-.2272,.2272,128));
 replace(b.wheelIndicator,new THREE.BoxGeometry(.055,.65,.012));
 b.wheelIndicator.position.set(0,.95,g.wheelDepth/2+.006);
 for(const group of groups)for(const child of group.children)if(child.userData.role?.endsWith('-rotation-witness'))child.visible=false;

 // Make the spring/pawl connection a finite pin and bored eye while keeping
 // its prescribed flexure around the fixed anchor explicit.
 const joint=g.springBearingLocal,eye=new THREE.Mesh(ring(.074,.14,-.09,.09,96),b.springPawlStopBody.material);eye.position.set(joint.x,joint.y,.32);
 const body=b.springPawlStopBody;replace(body,plate(clip.difference(clip.union(body.geometry.userData.plate.polygons,poly(circle(joint.toArray(),.14,96))),poly(circle(joint.toArray(),.074,96))),-.09,.09));
 const pin=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.28,64),collars[2].material);pin.rotation.x=Math.PI/2;pin.position.set(joint.x,joint.y,.40);groups[2].add(pin);pin.userData.role='spring-stop-leaf-attachment-pin';
 eye.geometry.dispose();
 d.workingParts={stops,noses,collars,eye:body,pin,paths};d.minimumDisplayCycleSeconds=12;d.hideGround=true;
 d.sourceAnimation.reason='Animation unavailable: fetched page has no inline add_model or mm_present program.';
 d.dynamics={forceValidated:false,prescribedBiasAndSelection:true,freeRunPath:'offline continuous finite-circle clearance',selfLocking:false};
 d.reconstructionNote='The hook, straight gravity stop and spring stop are compared one at a time with finite toes on the retaining faces. Their free-running lift, drop and selection are prescribed. The retaining reaction tends to lift each stop, so gravity or spring preload is required; unlimited holding load and passive release are not validated. The lower spring motion is an illustrative flexure.';
 root.traverse(o=>{if(o.isMesh)for(const material of[].concat(o.material))material.fog=false;});
}
