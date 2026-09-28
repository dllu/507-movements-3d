import * as THREE from 'three';
import paths from './baked/ratchet-stop-240-paths.js';
import {stop240Contact,stop240Radius} from './ratchet-stop-240-contact.js';
import{plate,poly,circle,capsule,ring,polygonClipping as clip}from'./finite-plate-geometry.js';
export const stop240MaximumLifts=paths.paths.map(p=>Math.max(...p));
// Stop C parks just clear of the tips: its S-spring bends to follow it.
const parks=stop240MaximumLifts.map((v,i)=>v+(i===2?.03:.10));
function pathAt(values,q){const x=Math.max(0,Math.min(1,q))*(values.length-1),i=Math.min(values.length-2,Math.floor(x)),f=x-i;return{value:values[i]*(1-f)+values[i+1]*f,slope:(values[i+1]-values[i])*(values.length-1),curvature:0};}
export function stateStops240(s,stops,outline,pitch){
 s.pawls=s.pawls.map((old,i)=>{
  // Stop C stays down through every stroke, as Brown draws it: turning on
  // its own hole, its toe can only leave or re-enter a space by riding the
  // ramp, never by a lift at rest. The hook and straight stops alternate.
  if(i===2&&!old.engaged)old={...old,engaged:true,parked:false};
  const stop=stops[i],ratio=parks[i]/stop.parkLift;let lift=Math.abs(old.angleDelta)*ratio,speed=old.angularSpeed*ratio,acceleration=old.angularAcceleration*ratio;
  if(old.engaged){const p=pathAt(paths.paths[i],s.driveProgress);lift=p.value;speed=stop.liftSign*p.slope*s.driveProgressSpeed;acceleration=stop.liftSign*(p.curvature*s.driveProgressSpeed**2+p.slope*s.driveProgressAcceleration);}
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
export const BAND240={hook:{bow:[[.24,.30],[.52,.42],[.78,.29]],width:[.24,.21,.15],radial:0},straight:{bow:[[.48,0],[.8,0]],width:[.24,.19],radial:0},spring:{radial:1},clearance:.05,neck:.09,eye:.25};
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
// pivot eye at the origin). C is traced from the plate: a tapered block
// whose top edge runs up under the teeth to its upper right tip, a short
// right edge, and a lower edge that swings left and curls down into a round
// knob; its drawn hole is kept as a plain hole. The tip is the stop's
// rounded working toe on the steep face; the right edge runs down from it.
export const C240_PLATE={
 top:[[40,262],[120,250],[230,236],[330,196],[392,140]],
 bottom:[[447,232],[400,275],[360,300],[290,308],[240,295],[200,272],[150,268],[125,282],[116,322],[102,366],[76,390],[42,382],[20,332],[22,280]],
 hole:[335,225],holeRadius:.05,joint:[395,282]};
export const C240={band:.055,leaf:.17,eye:.17};
export function stopC240(stop,profile,tipRadius,g){
 const P=stop.pivot,T=P.clone().add(stop.arm),r=stop240Radius-.0005;
 const world=([x,y])=>new THREE.Vector2((130+x/4-g.sourceImageCenter.x)*g.sourceScale,(g.sourceImageCenter.y-(330+y/4))*g.sourceScale);
 const bottomRight=world(C240_PLATE.bottom[0]),A=world(C240_PLATE.top.at(-1));
 // The top edge runs tangent onto the toe; the right edge is a capsule from
 // the toe down to the block's lower right.
 const d=A.distanceTo(T),base=Math.atan2(A.y-T.y,A.x-T.x),half=Math.acos(Math.min(1,r/d));
 const tangents=[base+half,base-half].map(t=>T.clone().add(new THREE.Vector2(r*Math.cos(t),r*Math.sin(t))));
 const Q=tangents.sort((u,v)=>v.distanceTo(bottomRight)-u.distanceTo(bottomRight))[0];
 const toLocal=list=>{const local=list.map(p=>p.clone().sub(P));let area=0;local.forEach((p,i)=>{const q=local[(i+1)%local.length];area+=p.x*q.y-q.x*p.y;});if(area<0)local.reverse();return poly(local.map(p=>p.toArray()));};
 const block=toLocal([...C240_PLATE.top.map(world),Q,T,...C240_PLATE.bottom.map(world)]);
 const edge=capsule(T.clone().sub(P).toArray(),bottomRight.clone().sub(P).toArray(),r,32);
 const hole=world(C240_PLATE.hole).sub(P);
 return {outline:clip.difference(clip.union(block,edge),poly(circle(hole.toArray(),C240_PLATE.holeRadius,48))),joint:world(C240_PLATE.joint).sub(P)};
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
// The S-spring's rest outline is built in the anchor's frame; each vertex
// then turns about C's pivot by C's angle times a weight that rises smoothly
// from 0 at the anchored leaf to 1 where the band joins C.
export function makeSSpring240(anchorStop,jointLocal,g,material,cPivot,anchor){
 const outline=clip.difference(sLever240(anchorStop,jointLocal,g),poly(circle([0,0],.089,96)));
 const geometry=plate(outline,-.09,.09),mesh=new THREE.Mesh(geometry,material);mesh.position.set(anchor.x,anchor.y,.32);mesh.userData.role='stop-C-flat-S-spring';
 const control=[new THREE.Vector2(0,0),...S240_PLATE.map(([x,y])=>new THREE.Vector2((x-g.sourceImageCenter.x)*g.sourceScale-anchor.x,(g.sourceImageCenter.y-y)*g.sourceScale-anchor.y)),jointLocal.clone()];
 const curve=new THREE.CatmullRomCurve3(control.map(p=>new THREE.Vector3(p.x,p.y,0)),false,'centripetal'),line=curve.getSpacedPoints(200).map(p=>new THREE.Vector2(p.x,p.y));
 const position=geometry.attributes.position,rest=Float32Array.from(position.array),weights=new Float32Array(position.count);
 for(let k=0;k<position.count;k++){const p=new THREE.Vector2(rest[3*k],rest[3*k+1]);let best=Infinity,at=0;line.forEach((q,i)=>{const v=q.distanceToSquared(p);if(v<best){best=v;at=i;}});const s=at/200,t=Math.min(1,Math.max(0,(s-.5)/.45));weights[k]=t*t*(3-2*t);}
 const pin=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,.34,48).rotateX(Math.PI/2),material.clone());pin.material.color.set(0x1d2124);pin.position.set(anchor.x,anchor.y,.33);pin.userData.role='stop-C-S-spring-fixed-anchor-pin';
 const hx=cPivot.x-anchor.x,hy=cPivot.y-anchor.y;
 return{mesh,pin,weights,update(angle){for(let k=0;k<position.count;k++){const a=angle*weights[k],c=Math.cos(a),s=Math.sin(a),x=rest[3*k]-hx,y=rest[3*k+1]-hy;position.array[3*k]=hx+c*x-s*y;position.array[3*k+1]=hy+s*x+c*y;}position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.computeBoundingBox();}};
}
export function finishStops240(root,stops){
 const d=root.userData,b=d.blocks,g=d.geometry,groups=[b.hookGravityStop,b.straightGravityStop,b.springPawlStop],bodies=[b.hookGravityStopBody,b.straightGravityStopBody,b.springPawlStopBody],noses=[],collars=[];let sSpring=null;
 const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
 stops.forEach((stop,i)=>{
  const body=bodies[i],group=groups[i],shape=body.geometry.parameters.shapes,outline=poly(shape.extractPoints(24).shape.map(p=>p.toArray()));
  // Each stop is one flat plate in the wheel's plane whose own rounded toe
  // (the finite nose radius) bears on the retaining face: no cross-pin.
  let joined;
  if(i<2)joined=clip.union(stopBand240(stop,g.localProfilePoints,g.wheelOuterRadius),poly(circle([0,0],BAND240.eye,96)));
  else{
   // C turns on a fixed pin through its own hole. The S-spring is a separate
   // flat band from its anchored leaf eye to C's lower right; it bends to
   // follow C (see sSpring240 below).
   const c=stopC240(stop,g.localProfilePoints,g.wheelOuterRadius,g);joined=c.outline;
   const anchor=new THREE.Vector2((stop.sourceAnchor.x-g.sourceImageCenter.x)*g.sourceScale,(g.sourceImageCenter.y-stop.sourceAnchor.y)*g.sourceScale);
   const joint=stop.pivot.clone().add(c.joint);
   sSpring=makeSSpring240({pivot:anchor},joint.clone().sub(anchor),g,body.material,stop.pivot,anchor);
  }
  // C's drawn hole is small: a slimmer pin and collar there.
  const bore=i===2?.05:.089;
  replace(body,plate(clip.difference(joined,poly(circle([0,0],bore,128))),-.09,.09));
  const nose=new THREE.Object3D();nose.position.set(stop.arm.x,stop.arm.y,body.position.z);nose.userData.role=`${stop.key}-finite-working-toe`;group.add(nose);noses.push(nose);
  const collar=group.children.find(o=>o.userData.role===`${stop.key}-pivot-ring`);replace(collar,i===2?ring(.05,.1,-.02,.035,96):ring(.089,.13,-.02,.035,128));/* seated just clear of the plate's face */collars.push(collar);
 });
 root.traverse(o=>{if(o.userData.role==='stop-C-fixed-pivot-pin'){const m=o.isMesh?o:o.userData.rotor?.children.find(c=>c.isMesh)??o.children.find(c=>c.isMesh);if(m){m.geometry.dispose();m.geometry=new THREE.CylinderGeometry(.047,.047,.34,48);}}});
 replace(b.wheel.userData.hub,ring(.124,.39,-.2272,.2272,128));
 replace(b.wheelIndicator,new THREE.BoxGeometry(.055,.65,.012));
 b.wheelIndicator.position.set(0,.95,g.wheelDepth/2+.006);
 for(const group of groups)for(const child of group.children)if(child.userData.role?.endsWith('-rotation-witness'))child.visible=false;

 // The S-spring replaces the old round leaf-spring tube.
 root.remove(b.leafSpring);b.leafSpring.userData.drawn=false;
 root.add(sSpring.mesh,sSpring.pin);b.sSpring=sSpring.mesh;b.sSpringAnchorPin=sSpring.pin;d.sSpring240=sSpring;
 d.workingParts={stops,noses,collars,paths};d.minimumDisplayCycleSeconds=12;d.hideGround=true;
 d.sourceAnimation.reason='Animation unavailable: fetched page has no inline add_model or mm_present program.';
 d.dynamics={forceValidated:false,prescribedBiasAndSelection:true,freeRunPath:'offline continuous finite-circle clearance',selfLocking:false};
 d.reconstructionNote='The hook, straight gravity stop and spring stop are flat plates in the wheel plane, compared one at a time with their own rounded toes on the retaining faces. Their free-running lift, drop and selection are prescribed. The retaining reaction tends to lift each stop, so gravity or spring preload is required; unlimited holding load and passive release are not validated. Stop C turns on a pin through its own hole; the flat S-spring, anchored at its leaf eye, bends to follow C by a prescribed blend, not a solved flexure.';
 root.traverse(o=>{if(o.isMesh)for(const material of[].concat(o.material))material.fog=false;});
}
