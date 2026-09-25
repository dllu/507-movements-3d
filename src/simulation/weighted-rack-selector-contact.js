import * as T from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate, poly, circle, capsule, polygonClipping as clip} from './finite-plate-geometry.js';

// An ideal circular working face replaces the illegible inner edge of C.  The
// source distinguishes this inboard lug from the long outboard guide pin.
// Brown's short link hangs from a pin on C down to the top of A'; it is
// fixed to C (the second arm of the elbow) and is the face that the rack's
// upper lug roller loads on approach and that carries it over the corner.
export const selectorGeometry = Object.freeze({radius:2,halfWidth:.075,endAngle:-.9,restAngle:-.10,rollerRadius:.10,lugX:-.12,lugAboveGuide:.30,linkPin:[-.06,-.62],linkEnd:[-.48,-1.50]});
const {radius:R,halfWidth:w,endAngle:end,restAngle:rest,rollerRadius:r}=selectorGeometry;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function selectorClosestPoint(q,angle){
 const c=Math.cos(angle),s=Math.sin(angle),x=c*q.x+s*q.y,y=-s*q.x+c*q.y;
 const phi=clamp(Math.atan2(y,x+R),end,0),cx=-R+R*Math.cos(phi),cy=R*Math.sin(phi);
 return {x,y,cx,cy,phi,gap:Math.hypot(x-cx,y-cy)-w-r};
}
// Closest point of the link's capsule face (lever frame) to roller centre q.
const [px,py]=selectorGeometry.linkPin,[ex,ey]=selectorGeometry.linkEnd;
export function selectorLinkClosestPoint(q,angle){
 const c=Math.cos(angle),s=Math.sin(angle),x=c*q.x+s*q.y,y=-s*q.x+c*q.y,dx=ex-px,dy=ey-py;
 const t=clamp(((x-px)*dx+(y-py)*dy)/(dx*dx+dy*dy),0,1),cx=px+t*dx,cy=py+t*dy;
 return {x,y,cx,cy,t,gap:Math.hypot(x-cx,y-cy)-w-r};
}
const faceGap=(q,angle)=>Math.min(selectorClosestPoint(q,angle).gap,selectorLinkClosestPoint(q,angle).gap);
// The lever rests at its stop until the roller would enter C or its link;
// otherwise it takes the first admissible (touching) angle below rest, found
// by a monotone scan and bisection. No physics stepping in playback.
export function selectorState(rightPose,guideY,pivot){
 const a=rightPose.rackAngle,c=Math.cos(a),s=Math.sin(a),lx=selectorGeometry.lugX,ly=guideY+selectorGeometry.lugAboveGuide;
 const q={x:rightPose.pivot.x+lx*c-ly*s-pivot.x,y:rightPose.pivot.y+lx*s+ly*c-pivot.y};
 let angle=rest;
 if(faceGap(q,rest)<0){
  let hi=rest,lo=rest;
  while(faceGap(q,lo)<0){hi=lo;lo-=.01;if(lo<-.95)throw new Error('391 selector has no admissible contact branch');}
  for(let i=0;i<48;i++){const mid=(hi+lo)/2;if(faceGap(q,mid)<0)hi=mid;else lo=mid;}
  angle=lo;
 }
 const arcPoint=selectorClosestPoint(q,angle),linkPoint=selectorLinkClosestPoint(q,angle),point=linkPoint.gap<arcPoint.gap?linkPoint:arcPoint,distance=Math.hypot(point.x-point.cx,point.y-point.cy),nx=(point.x-point.cx)/distance,ny=(point.y-point.cy)/distance;
 const ca=Math.cos(angle),sa=Math.sin(angle),normal={x:ca*nx-sa*ny,y:sa*nx+ca*ny};
 const arm={x:q.x+pivot.x-rightPose.pivot.x,y:q.y+pivot.y-rightPose.pivot.y};
 return {leverAngle:angle,springDeflection:rest-angle,contact:angle<rest-1e-9,gap:point.gap,point,normal,
  rackTorquePerNormalForce:arm.x*normal.y-arm.y*normal.x,
  leverTorquePerNormalForce:-(q.x*normal.y-q.y*normal.x),q};
}

export function installWeightedRackSelector(root){
 const d=root.userData,b=d.blocks,g=d.geometry,lx=selectorGeometry.lugX,ly=g.guideY+selectorGeometry.lugAboveGuide;
 const points=[];
 for(let i=0;i<=160;i++){const a=end*i/160;points.push([-R+(R+w)*Math.cos(a),(R+w)*Math.sin(a)]);}
 const tip=[-R+R*Math.cos(end),R*Math.sin(end)];
 for(let i=1;i<=32;i++){const a=end-Math.PI*i/32;points.push([tip[0]+w*Math.cos(a),tip[1]+w*Math.sin(a)]);}
 for(let i=159;i>=0;i--){const a=end*i/160;points.push([-R+(R-w)*Math.cos(a),(R-w)*Math.sin(a)]);}
 const old=b.elbowLever.children[0];old.geometry.dispose();
 old.geometry=plate(clip.difference(clip.union(poly(points),poly(circle([0,0],.19,64)),capsule(selectorGeometry.linkPin,selectorGeometry.linkEnd,w,32)),poly(circle([0,0],.134,64))),.23,.37);
 old.userData.role='closed-curved-selector-C-with-rounded-entry-and-bored-pivot';
 const linkPinCap=new T.Mesh(new T.CylinderGeometry(.07,.07,.04,32),b.leverContactIndex.material.clone());linkPinCap.material.color.set(0x252a2d);linkPinCap.rotation.x=Math.PI/2;linkPinCap.position.set(...selectorGeometry.linkPin,.39);linkPinCap.userData.role='pin-joining-short-link-to-elbow-lever-C';b.elbowLever.add(linkPinCap);
 const add=(geometry,material,role,parent=b.rightRack)=>{const o=new T.Mesh(geometry,material);o.userData.role=role;parent.add(o);return o;};
 const lug=add(plate(clip.difference(clip.union(capsule([0,g.guideY-.10],[lx,ly],.10,32),poly(circle([lx,ly],.15,64))),poly(circle([lx,ly],.056,64))),-.125,.125),b.rightRack.userData.body.material,'inboard-upper-rack-lug-for-elbow-C');
 const roller=add(boredLatheGeometry([{axial:-.11,radial:r},{axial:.11,radial:r}],.058,64),b.rightRack.userData.pivotBore.material,'upper-rack-lug-contact-roller');roller.rotation.x=Math.PI/2;roller.position.set(lx,ly,.32);
 const axle=add(new T.CylinderGeometry(.055,.055,.46,32),roller.material,'upper-lug-roller-axle');axle.rotation.x=Math.PI/2;axle.position.set(lx,ly,.19);
 const stud=add(new T.CylinderGeometry(.055,.055,.655,32),roller.material,'elbow-spring-attachment-standoff',b.elbowLever);stud.rotation.x=Math.PI/2;stud.position.set(-.02,-.62,.2925);
 // Fixed stop bears on the curved stem, with a nonzero moment arm; a pin
 // against the circular pivot boss alone would not arrest rotation.
 const stop=add(new T.CylinderGeometry(.065,.065,.72,32),roller.material,'fixed-selector-rest-stop',root);stop.rotation.x=Math.PI/2;
 const stopPhi=-.23,sx=-R+(R+w+.065)*Math.cos(stopPhi),sy=(R+w+.065)*Math.sin(stopPhi);
 stop.position.set(b.elbowLever.position.x+sx*Math.cos(rest)-sy*Math.sin(rest),b.elbowLever.position.y+sx*Math.sin(rest)+sy*Math.cos(rest),.16);
 const pivotXY=[b.elbowLever.position.x,b.elbowLever.position.y],stopXY=[stop.position.x,stop.position.y],anchorXY=[b.springAnchorBoss.position.x,b.springAnchorBoss.position.y];
 const bracket=add(plate(clip.difference(clip.union(capsule(pivotXY,anchorXY,.14,32),capsule(pivotXY,stopXY,.14,32),poly(circle(pivotXY,.20,64))),poly(circle(pivotXY,.132,64)),poly(circle(stopXY,.066,64)),poly(circle(anchorXY,.101,64))),-.20,-.12),b.fixedFrame.children[0].material,'fixed-selector-pivot-stop-and-spring-bracket',root);
 // Brown's top bar carrying C's pivot and spring d's anchor is kept (the rest
 // of the undrawn frame is not shown); a short web drops from the anchor end
 // to the top of the right guide b casting so the bar is carried.
 let guideTop=null;
 const guideCurve=b.rightGuide?.userData.centerline;
 if(guideCurve){b.rightGuide.updateMatrix();let best=Infinity;for(let i=0;i<=400;i++){const p=guideCurve.getPoint(i/400).applyMatrix4(b.rightGuide.matrix);const d=Math.hypot(p.x-anchorXY[0],p.y-anchorXY[1]);if(d<best){best=d;guideTop=[p.x,p.y];}}
  // End on the casting's outer face, clear of the groove the rack pin runs in.
  const ux=anchorXY[0]-guideTop[0],uy=anchorXY[1]-guideTop[1],ul=Math.hypot(ux,uy);guideTop=[guideTop[0]+ux/ul*.20,guideTop[1]+uy/ul*.20];}
 if(guideTop){const web=add(plate(capsule(anchorXY,guideTop,.06,24),-.30,-.12),b.fixedFrame.children[0].material,'fixed-web-from-selector-bracket-to-right-guide',root);b.elbowBracketWeb=web;}
 b.leverContactIndex.geometry.dispose();b.leverContactIndex.geometry=new T.SphereGeometry(.028,16,10);
 d.updateSelectorContact=state=>{const p=state.elbowAssist.point;b.leverContactIndex.position.set(p.x,p.y,.47);};
 b.elbowCam=old;b.elbowLug=lug;b.elbowRoller=roller;b.elbowRollerAxle=axle;b.elbowSpringStud=stud;b.elbowRestStop=stop;b.elbowBracket=bracket;
 d.selectorContactReview={...selectorGeometry,qualification:'Exact unilateral circular-face and rounded-tip contact on prescribed rack trajectories. Spring torque and contact-normal direction checked; guide-corner scheduling, inertia and passive branch dynamics remain prescribed, not a native force solution.'};
}
