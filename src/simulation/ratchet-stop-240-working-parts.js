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
// The hook and straight stops as flat bands from their pivot eyes to the
// finite toe (not the tooth root the source-shaped bodies reach): Brown's
// curved hook bows outward over the teeth, the straight stop is a plain
// tapering bar. Each ends in its own rounded toe of the finite nose radius.
export const BAND240={hook:{bow:[[.24,.24],[.52,.34],[.78,.26]],width:[.18,.17,.15],radial:0},straight:{bow:[[.48,.06],[.8,.07]],width:[.16,.13],radial:1},spring:{radial:1},clearance:.05,neck:.09};
// Where a stop's working toe leaves its tooth space: the toe runs out along
// the bisector of the space's opening (between the two neighbouring tips), or
// radially, to a neck just clear of the tip circle, so the band behind it
// rides clear of the next tooth while the toe bears on the retaining face.
export function toeExit240(stop,profile,tipRadius){
 const toe=stop.pivot.clone().add(stop.arm),angle=Math.atan2(toe.y,toe.x),tips=profile.filter(p=>p.length()>tipRadius-1e-6).map(p=>Math.atan2(Math.sin(Math.atan2(p.y,p.x)-angle),Math.cos(Math.atan2(p.y,p.x)-angle)));
 const ahead=Math.min(...tips.filter(t=>t>0)),behind=Math.max(...tips.filter(t=>t<0)),open=angle+(ahead+behind)/2;
 // The straight stop leaves radially, so its bar runs on over the next tip.
 const opening=new THREE.Vector2(Math.cos(open),Math.sin(open)).multiplyScalar(tipRadius),radial=BAND240[stop.style].radial,dir=opening.clone().sub(toe).normalize().multiplyScalar(1-radial).addScaledVector(toe.clone().normalize(),radial).normalize(),along=toe.dot(dir),R=tipRadius+BAND240.clearance+BAND240.neck;
 return toe.clone().addScaledVector(dir,-along+Math.sqrt(along*along-toe.lengthSq()+R*R)).sub(stop.pivot);
}
export function stopBand240(stop,profile,tipRadius){
 const spec=BAND240[stop.style],arm=stop.arm,neck=toeExit240(stop,profile,tipRadius),unit=neck.clone().normalize(),normal=new THREE.Vector2(-unit.y,unit.x),outward=stop.pivot.clone().add(neck).normalize(),r=stop240Radius-.0005;
 const side=stop.style==='hook'?outward:(normal.dot(outward)>0?normal:normal.clone().negate());
 const centre=[new THREE.Vector2(),...spec.bow.map(([f,o])=>neck.clone().multiplyScalar(f).addScaledVector(side,o)),neck.clone(),arm.clone()];
 const width=[spec.width[0],...spec.width,BAND240.neck,r];
 const curve=new THREE.CatmullRomCurve3(centre.map(p=>new THREE.Vector3(p.x,p.y,0)),false,'centripetal'),n=96,pts=curve.getSpacedPoints(n).map(p=>new THREE.Vector2(p.x,p.y));
 const lengths=[0];for(let i=1;i<centre.length;i++)lengths.push(lengths[i-1]+centre[i].distanceTo(centre[i-1]));
 const at=f=>{const x=f*lengths.at(-1);let i=0;while(i<centre.length-2&&lengths[i+1]<x)i++;const t=Math.min(1,Math.max(0,(x-lengths[i])/(lengths[i+1]-lengths[i])));return width[i]*(1-t)+width[i+1]*t;};
 const left=[],right=[];pts.forEach((p,i)=>{const q=pts[Math.min(n,i+1)],o=pts[Math.max(0,i-1)],t=q.clone().sub(o).normalize(),w=at(i/n);left.push([p.x-t.y*w,p.y+t.x*w]);right.push([p.x+t.y*w,p.y-t.x*w]);});
 const end=pts[n].clone().sub(pts[n-1]).normalize(),toe=[];for(let i=1;i<24;i++){const a=Math.atan2(end.y,end.x)+Math.PI/2-Math.PI*i/24;toe.push([arm.x+r*Math.cos(a),arm.y+r*Math.sin(a)]);}
 return poly([...left,...toe,...right.reverse()]);
}
// Brown's stop C and its flat S-lever are one plate, set out in world
// coordinates at rest and returned in the stop group's frame (the S-lever's
// pivot eye at the origin). C is a block below the teeth whose upper right
// corner is the rounded working toe; its left end drops into a round knob.
// From C's lower right a narrow spring band runs right under the wheel,
// loops back and runs down to a pointed leaf round the pivot eye.
export const C240={toeRun:[-.95,-.3],length:.8,depth:.34,knob:.15,band:.055,leaf:.17,eye:.17};
export function stopC240(stop,profile,tipRadius){
 const P=stop.pivot,T=P.clone().add(stop.arm),r=stop240Radius-.0005,neck=toeExit240(stop,profile,tipRadius).add(P),left=new THREE.Vector2(...C240.toeRun).normalize();
 let down=new THREE.Vector2(left.y,-left.x);if(down.dot(neck)<0)down.negate();const right=left.clone().negate(),up=down.clone().negate(),w=BAND240.neck;
 // The toe: a short tapered finger from the neck into the tooth space.
 const exit=neck.clone().sub(T).normalize(),side=new THREE.Vector2(-exit.y,exit.x),finger=[];
 for(let i=0;i<=16;i++){const a=Math.atan2(-exit.y,-exit.x)+Math.PI/2-Math.PI*i/16;finger.push(T.clone().add(new THREE.Vector2(r*Math.cos(a),r*Math.sin(a))));}
 // Its base runs on into the block so the two are one plate.
 finger.push(neck.clone().addScaledVector(side,w).addScaledVector(exit,.14),neck.clone().addScaledVector(exit,.16),neck.clone().addScaledVector(side,-w).addScaledVector(exit,.14));
 // The block hangs from the neck: its top edge runs left, its left end
 // drops into a round knob, its right end is square.
 const L=C240.length,D=C240.depth,block=[];
 block.push(neck.clone().addScaledVector(right,.1).addScaledVector(up,w*.5));
 block.push(neck.clone().addScaledVector(left,L).addScaledVector(up,w*.5));
 const knob=neck.clone().addScaledVector(left,L+.02).addScaledVector(down,D);
 const k0=Math.atan2(up.y+left.y,up.x+left.x);for(let i=0;i<=16;i++){const a=k0+Math.PI*1.25*i/16;block.push(knob.clone().add(new THREE.Vector2(C240.knob*Math.cos(a),C240.knob*Math.sin(a))));}
 block.push(neck.clone().addScaledVector(left,L*.55).addScaledVector(down,D*.8));
 block.push(neck.clone().addScaledVector(down,D).addScaledVector(right,.1));
 const ring=pts=>{const local=pts.map(p=>p.clone().sub(P));let area=0;local.forEach((p,i)=>{const q=local[(i+1)%local.length];area+=p.x*q.y-q.x*p.y;});if(area<0)local.reverse();return poly(local.map(p=>p.toArray()));};
 return {outline:clip.union(ring(finger),ring(block)),joint:neck.clone().addScaledVector(down,D*.8).addScaledVector(right,.05).sub(P)};
}
// The band's course is traced from the plate (pixels): the lower run up from
// the leaf, the loop at the right and the upper run back to C.
export const S240_PLATE=[[300,430],[345,421],[362,404],[348,392],[300,396],[250,402]];
export function sLever240(stop,joint,g){
 const P=stop.pivot,plateToLocal=([x,y])=>new THREE.Vector2((x-g.sourceImageCenter.x)*g.sourceScale-P.x,(g.sourceImageCenter.y-y)*g.sourceScale-P.y);
 const control=[new THREE.Vector2(0,0),...S240_PLATE.map(plateToLocal),joint.clone()];
 const curve=new THREE.CatmullRomCurve3(control.map(p=>new THREE.Vector3(p.x,p.y,0)),false,'centripetal'),pts=curve.getSpacedPoints(120).map(p=>new THREE.Vector2(p.x,p.y));
 const start=pts[1].clone().sub(pts[0]).normalize(),tip=pts[0].clone().addScaledVector(start,-.45);
 const line=[tip,tip.clone().lerp(pts[0],.5),...pts],length=[0];for(let i=1;i<line.length;i++)length.push(length[i-1]+line[i].distanceTo(line[i-1]));
 const width=line.map((p,i)=>{const s=length[i];return s<.45?C240.leaf*Math.sin(Math.PI/2*s/.45):s<.9?C240.leaf-(C240.leaf-C240.band)*(s-.45)/.45:C240.band;});
 const left=[],right=[];line.forEach((p,i)=>{const q=line[Math.min(line.length-1,i+1)],o=line[Math.max(0,i-1)],t=q.clone().sub(o).normalize();left.push([p.x-t.y*width[i],p.y+t.x*width[i]]);right.push([p.x+t.y*width[i],p.y-t.x*width[i]]);});
 return clip.union(poly([...left,...right.reverse()]),poly(circle([0,0],C240.eye,64)));
}
export function finishStops240(root,stops){
 const d=root.userData,b=d.blocks,g=d.geometry,groups=[b.hookGravityStop,b.straightGravityStop,b.springPawlStop],bodies=[b.hookGravityStopBody,b.straightGravityStopBody,b.springPawlStopBody],noses=[],collars=[];
 const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
 stops.forEach((stop,i)=>{
  const body=bodies[i],group=groups[i],shape=body.geometry.parameters.shapes,outline=poly(shape.extractPoints(24).shape.map(p=>p.toArray()));
  // Each stop is one flat plate in the wheel's plane whose own rounded toe
  // (the finite nose radius) bears on the retaining face: no cross-pin.
  let joined;
  if(i<2)joined=clip.union(stopBand240(stop,g.localProfilePoints,g.wheelOuterRadius),poly(circle([0,0],.19,64)));
  else{const c=stopC240(stop,g.localProfilePoints,g.wheelOuterRadius);joined=clip.union(c.outline,sLever240(stop,c.joint,g));}
  replace(body,plate(clip.difference(joined,poly(circle([0,0],.089,128))),-.09,.09));
  const nose=new THREE.Object3D();nose.position.set(stop.arm.x,stop.arm.y,body.position.z);nose.userData.role=`${stop.key}-finite-working-toe`;group.add(nose);noses.push(nose);
  const collar=group.children.find(o=>o.userData.role===`${stop.key}-pivot-ring`);replace(collar,ring(.089,.205,-.02,.035,128));/* seated just clear of the plate's face */collars.push(collar);
 });
 replace(b.wheel.userData.hub,ring(.124,.39,-.2272,.2272,128));
 replace(b.wheelIndicator,new THREE.BoxGeometry(.055,.65,.012));
 b.wheelIndicator.position.set(0,.95,g.wheelDepth/2+.006);
 for(const group of groups)for(const child of group.children)if(child.userData.role?.endsWith('-rotation-witness'))child.visible=false;

 // The S-lever is part of stop C's plate and turns with it about the leaf's
 // pivot eye; the old round leaf-spring tube is no longer drawn.
 root.remove(b.leafSpring);b.leafSpring.userData.drawn=false;
 d.workingParts={stops,noses,collars,paths};d.minimumDisplayCycleSeconds=12;d.hideGround=true;
 d.sourceAnimation.reason='Animation unavailable: fetched page has no inline add_model or mm_present program.';
 d.dynamics={forceValidated:false,prescribedBiasAndSelection:true,freeRunPath:'offline continuous finite-circle clearance',selfLocking:false};
 d.reconstructionNote='The hook, straight gravity stop and spring stop are flat plates in the wheel plane, compared one at a time with their own rounded toes on the retaining faces. Their free-running lift, drop and selection are prescribed. The retaining reaction tends to lift each stop, so gravity or spring preload is required; unlimited holding load and passive release are not validated. Stop C and its flat S-lever turn rigidly about the lever\'s pivot eye; the spring\'s flexure is not modelled.';
 root.traverse(o=>{if(o.isMesh)for(const material of[].concat(o.material))material.fog=false;});
}
