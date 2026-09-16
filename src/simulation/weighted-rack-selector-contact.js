import * as T from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate, poly, circle, capsule, polygonClipping as clip} from './finite-plate-geometry.js';

// An ideal circular working face replaces the illegible inner edge of C.  The
// source distinguishes this inboard lug from the long outboard guide pin.
export const selectorGeometry = Object.freeze({radius:2,halfWidth:.075,endAngle:-.9,restAngle:-.10,rollerRadius:.10,lugX:-.12,lugAboveGuide:.30});
const {radius:R,halfWidth:w,endAngle:end,restAngle:rest,rollerRadius:r}=selectorGeometry;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function selectorClosestPoint(q,angle){
 const c=Math.cos(angle),s=Math.sin(angle),x=c*q.x+s*q.y,y=-s*q.x+c*q.y;
 const phi=clamp(Math.atan2(y,x+R),end,0),cx=-R+R*Math.cos(phi),cy=R*Math.sin(phi);
 return {x,y,cx,cy,phi,gap:Math.hypot(x-cx,y-cy)-w-r};
}
// Exact circle/circle tangency, including the rounded lower end. There is no
// iterative contact search, mesh construction, or physics stepping in playback.
export function selectorState(rightPose,guideY,pivot){
 const a=rightPose.rackAngle,c=Math.cos(a),s=Math.sin(a),lx=selectorGeometry.lugX,ly=guideY+selectorGeometry.lugAboveGuide;
 const q={x:rightPose.pivot.x+lx*c-ly*s-pivot.x,y:rightPose.pivot.y+lx*s+ly*c-pivot.y};
 let angle=rest;
 if(selectorClosestPoint(q,rest).gap<0){
  const rho=Math.hypot(q.x,q.y),alpha=Math.atan2(q.y,q.x),candidates=[];
  const arcCos=((R+w+r)**2-R*R-rho*rho)/(2*R*rho);
  if(Math.abs(arcCos)<=1)for(const sign of[-1,1])candidates.push(alpha+sign*Math.acos(arcCos));
  const tx=-R+R*Math.cos(end),ty=R*Math.sin(end),length=Math.hypot(tx,ty),beta=Math.atan2(ty,tx);
  const tipCos=(rho*rho+length*length-(w+r)**2)/(2*rho*length);
  if(Math.abs(tipCos)<=1)for(const sign of[-1,1])candidates.push(alpha-beta+sign*Math.acos(tipCos));
  const valid=candidates.map(v=>Math.atan2(Math.sin(v),Math.cos(v))).filter(v=>v<=rest+1e-10&&v>-.95&&Math.abs(selectorClosestPoint(q,v).gap)<1e-8);
  if(!valid.length)throw new Error('391 selector has no admissible contact branch');
  angle=Math.max(...valid);
 }
 const point=selectorClosestPoint(q,angle),distance=Math.hypot(point.x-point.cx,point.y-point.cy),nx=(point.x-point.cx)/distance,ny=(point.y-point.cy)/distance;
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
 old.geometry=plate(clip.difference(clip.union(poly(points),poly(circle([0,0],.19,64))),poly(circle([0,0],.134,64))),.23,.37);
 old.userData.role='closed-curved-selector-C-with-rounded-entry-and-bored-pivot';
 const add=(geometry,material,role,parent=b.rightRack)=>{const o=new T.Mesh(geometry,material);o.userData.role=role;parent.add(o);return o;};
 const lug=add(plate(clip.difference(clip.union(capsule([0,g.guideY-.10],[lx,ly],.10,32),poly(circle([lx,ly],.15,64))),poly(circle([lx,ly],.056,64))),-.125,.125),b.rightRack.userData.body.material,'inboard-upper-rack-lug-for-elbow-C');
 const roller=add(boredLatheGeometry([{axial:-.11,radial:r},{axial:.11,radial:r}],.058,64),b.rightRack.userData.pivotBore.material,'upper-rack-lug-contact-roller');roller.rotation.x=Math.PI/2;roller.position.set(lx,ly,.32);
 const axle=add(new T.CylinderGeometry(.055,.055,.46,32),roller.material,'upper-lug-roller-axle');axle.rotation.x=Math.PI/2;axle.position.set(lx,ly,.19);
 const stud=add(new T.CylinderGeometry(.055,.055,.37,32),roller.material,'elbow-spring-attachment-standoff',b.elbowLever);stud.rotation.x=Math.PI/2;stud.position.set(-.02,-.62,.15);
 // Fixed stop bears on the curved stem, with a nonzero moment arm; a pin
 // against the circular pivot boss alone would not arrest rotation.
 const stop=add(new T.CylinderGeometry(.065,.065,.94,32),roller.material,'fixed-selector-rest-stop',b.fixedFrame);stop.rotation.x=Math.PI/2;
 const stopPhi=-.23,sx=-R+(R+w+.065)*Math.cos(stopPhi),sy=(R+w+.065)*Math.sin(stopPhi);
 stop.position.set(b.elbowLever.position.x+sx*Math.cos(rest)-sy*Math.sin(rest),b.elbowLever.position.y+sx*Math.sin(rest)+sy*Math.cos(rest),.16);
 const pivotXY=[b.elbowLever.position.x,b.elbowLever.position.y],stopXY=[stop.position.x,stop.position.y],anchorXY=[b.springAnchorBoss.position.x,b.springAnchorBoss.position.y];
 const bracket=add(plate(clip.difference(clip.union(capsule(pivotXY,anchorXY,.14,32),capsule(pivotXY,stopXY,.14,32),poly(circle(pivotXY,.20,64))),poly(circle(pivotXY,.132,64)),poly(circle(stopXY,.066,64)),poly(circle(anchorXY,.101,64))),-.20,-.12),b.fixedFrame.children[0].material,'fixed-selector-pivot-stop-and-spring-bracket',b.fixedFrame);
 b.leverContactIndex.geometry.dispose();b.leverContactIndex.geometry=new T.SphereGeometry(.028,16,10);
 d.updateSelectorContact=state=>{const p=state.elbowAssist.point;b.leverContactIndex.position.set(p.x,p.y,.47);};
 b.elbowCam=old;b.elbowLug=lug;b.elbowRoller=roller;b.elbowRollerAxle=axle;b.elbowSpringStud=stud;b.elbowRestStop=stop;b.elbowBracket=bracket;
 d.selectorContactReview={...selectorGeometry,qualification:'Exact unilateral circular-face and rounded-tip contact on prescribed rack trajectories. Spring torque and contact-normal direction checked; guide-corner scheduling, inertia and passive branch dynamics remain prescribed, not a native force solution.'};
}
