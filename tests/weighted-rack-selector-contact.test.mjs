import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAuthoredAlternatingWeightedRackMovement as create} from '../src/simulation/authored-alternating-weighted-racks.js';
import {solidSurface,surfacePoints,surfaceTriangles} from './helpers/solid-surface.mjs';
const m=create({id:391}),d=m.root.userData,b=d.blocks,sourceShift=d.geometry.sourcePhase*d.timeline.cycleDuration,stateAt=t=>d.stateAtTime(t-sourceShift),updateAt=t=>m.update(t-sourceShift),g=d.selectorContactReview,cache=new Map();
function data(o){if(!cache.has(o))cache.set(o,{points:surfacePoints(o.geometry),solid:solidSurface(o.geometry)});return cache.get(o);}
function clearance(a,c){let min=Infinity;for(const[x,y]of[[a,c],[c,a]]){const tr=y.matrixWorld.clone().invert().multiply(x.matrixWorld),field=data(y).solid;for(const p of data(x).points){const q=p.clone().applyMatrix4(tr);if(field.box.distanceToPoint(q)>.003)continue;min=Math.min(min,field.signedDistance(q,.04));}}return min;}
const camTriangles=surfaceTriangles(b.elbowCam.geometry);
// Closest point of C's real plate to the roller's axis, in the roller's plane.
function meshContact(){const world=b.elbowRoller.getWorldPosition(new T.Vector3()),p=b.elbowCam.worldToLocal(world.clone());p.z=.30;let distance=Infinity,closest;for(const tri of camTriangles){const q=tri.closestPointToPoint(p,new T.Vector3()),value=Math.hypot(q.x-p.x,q.y-p.y);if(value<distance){distance=value;closest=q;}}
 const force=new T.Vector3(p.x-closest.x,p.y-closest.y,0).normalize().transformDirection(b.elbowCam.matrixWorld);return{gap:distance-g.rollerRadius,force,world};}

test('391 A1 carries one rigid diagonal protrusion with a roller, and C has no pivoting piece',()=>{
 assert.equal(b.elbowProtrusion,b.rightRack.userData.body,'protrusion and rack are one extrusion');
 assert.equal(b.elbowRoller.parent,b.rightRack);assert.equal(b.elbowRollerAxle.parent,b.rightRack);
 const [fx,fy]=g.protrusionFoot,[rx,ry]=g.roller;
 assert.ok(rx<fx&&ry>fy,'the protrusion runs up and to the left');
 const slope=Math.atan2(fx-rx,ry-fy);assert.ok(slope>.3&&slope<.7,`diagonal: ${slope}`);
 assert.ok(solidSurface(b.rightRack.userData.body.geometry).inside(new T.Vector3((fx+rx)/2,(fy+ry)/2,0)),'the protrusion is solid rack stock');
 // Nothing hinged on C: only its plate, fixed pin, spring stud and knob.
 assert.deepEqual(b.elbowLever.children.map(o=>o.userData.role).filter(r=>/link/.test(r)),[]);
 for(const o of b.elbowLever.children)assert.equal(o.children.length,0);
 // C's pivot stands free, as Brown draws it: no lug or bracket.
 let lug=null;m.root.traverse(o=>{if(/lug/.test(o.userData.role??''))lug=o;});assert.equal(lug,null);
});
test('391 elbow lever C, the roller, protrusion, guide pin, pins and knob remain separated over a full cycle',()=>{
 const pairs=[[b.elbowCam,b.elbowRoller],[b.elbowCam,b.rightRack.userData.guidePin],[b.elbowCam,b.rightRack.userData.body],[b.elbowCam,b.elbowRestStop],[b.elbowCam,b.elbowLever.children[1]],[b.elbowCam,b.elbowRollerAxle],
  [b.elbowRoller,b.elbowRollerAxle],[b.elbowRoller,b.rightRack.userData.body],[b.elbowSpringStud,b.elbowRoller],[b.elbowRestStop,b.elbowRoller],[b.elbowLever.children[1],b.elbowRoller],[b.elbowLever.children[1],b.rightRack.userData.body],
  [b.elbowCam,b.spring],[b.elbowRoller,b.rightGuide.userData.casting],[b.rightRack.userData.body,b.rightGuide.userData.casting]];
 for(let i=0;i<=256;i++){m.update(i/32);m.root.updateMatrixWorld(true);for(const[a,c]of pairs)assert.ok(clearance(a,c)>-2e-6,`${i}: ${a.userData.role}/${c.userData.role}`);}
});
test('391 the roller bears on C\'s arm and C pushes A1 outward over the upper angle against positive spring tension',()=>{
 let count=0,maxGap=0,minRackTorque=Infinity,maxRackTorque=-Infinity;
 for(let i=0;i<=256;i++){const time=4+1.5*i/256,state=stateAt(time);if(!state.elbowAssist.active)continue;updateAt(time);m.root.updateMatrixWorld(true);const hit=meshContact(),arm=hit.world.clone().sub(new T.Vector3(state.rightRack.pivot.x,state.rightRack.pivot.y,hit.world.z)),torque=arm.x*hit.force.y-arm.y*hit.force.x;
  assert.ok(hit.gap>=-2e-3&&hit.gap<.002,`finite contact gap ${hit.gap}`);
  // C's thrust points down and outward, well clear of the rack's pivot far below: an outward (clockwise) moment.
  assert.ok(torque<-1.0,`outward clockwise rack torque ${torque}`);
  const normal=new T.Vector3(state.elbowAssist.normal.x,state.elbowAssist.normal.y,0);assert.ok(hit.force.dot(normal)>.995,'mesh contact normal matches the analytic arm normal');
  const ca=Math.cos(state.elbowAssist.leverAngle),sa=Math.sin(state.elbowAssist.leverAngle),[ax,ay]=g.springStud,attachment=new T.Vector3(ax*ca-ay*sa,ax*sa+ay*ca,0),springDirection=b.springAnchorBoss.position.clone().sub(b.elbowLever.position).sub(attachment).setZ(0).normalize(),springTorque=attachment.x*springDirection.y-attachment.y*springDirection.x;
  const p=new T.Vector3(state.elbowAssist.point.x,state.elbowAssist.point.y,0),leverReaction=-(p.x*hit.force.y-p.y*hit.force.x);
  assert.ok(springTorque>0&&leverReaction<0,'spring d turns C back onto the roller');
  assert.ok(state.rightRack.angularSpeed<1e-9,'A1 swings outward during the assist');
  assert.ok(state.elbowAssist.armAngle<-.2&&state.elbowAssist.armAngle>g.endAngle+.05,'contact lies on the curved arm');
  count++;maxGap=Math.max(maxGap,hit.gap);minRackTorque=Math.min(minRackTorque,torque);maxRackTorque=Math.max(maxRackTorque,torque);
 }
 assert.ok(count>20,`assist carries A1 over the angle: ${count}`);
 console.log({selectorAssistSamples:count,maxGap,minRackTorque,maxRackTorque});
});
test('391 the rising rack loads the spring before the top, C carries A1 over, then C returns to rest',()=>{
 const loading=stateAt(3.2),top=stateAt(4),assist=stateAt(4.25),released=stateAt(5.2),bottom=stateAt(0);
 assert.ok(loading.elbowAssist.loading&&!loading.elbowAssist.active&&loading.rightRack.engaged);
 assert.ok(top.elbowAssist.springDeflection>THREE_DEGREES*9,'C swings well round against spring d');
 assert.ok(assist.elbowAssist.active&&!assist.elbowAssist.loading&&assist.rightRack.rackAngle<0);
 assert.ok(!released.elbowAssist.contact&&released.elbowAssist.gap>.05);
 assert.equal(released.elbowAssist.leverAngle,g.restAngle);assert.equal(bottom.elbowAssist.contact,false);
 // Brown's knob under the short arm's tip is carried on C (pass 82): it stands
 // on the boss hanging from the tip and swings with C, never floating free.
 const knobAt=t=>{updateAt(t);m.root.updateMatrixWorld(true);return b.elbowCam.worldToLocal(b.elbowRestStop.getWorldPosition(new T.Vector3()));};
 const rest=knobAt(0),swung=knobAt(3.8);
 assert.ok(rest.distanceTo(swung)<1e-9,'knob is fixed in C');
 assert.equal(b.elbowRestStop.parent,b.elbowLever);
 const face=new T.Box3().setFromBufferAttribute(b.elbowCam.geometry.attributes.position).max.z;
 assert.ok(Math.abs(rest.z-.04-face)<1e-6,'knob stands on C\'s front face');
 assert.ok(solidSurface(b.elbowCam.geometry).signedDistance(new T.Vector3(rest.x,rest.y,.30),.2)<-.02,'knob centre lies inside the boss on C');
});
const THREE_DEGREES=Math.PI/60;
test('391 C moves continuously through contact entry and release; playback retains buffers',()=>{
 let prior=stateAt(0),maximumStep=0,maximumSwing=0;for(let i=1;i<=8192;i++){const next=stateAt(i/1024);maximumStep=Math.max(maximumStep,Math.abs(next.elbowAssist.leverAngle-prior.elbowAssist.leverAngle));maximumSwing=Math.max(maximumSwing,next.elbowAssist.springDeflection);assert.ok(next.elbowAssist.gap>-1e-8);prior=next;}
 assert.ok(maximumStep<.006,`no branch jump: ${maximumStep}`);
 assert.ok(maximumSwing>THREE_DEGREES*9&&maximumSwing<THREE_DEGREES*12,`C swings about 30 degrees: ${maximumSwing}`);
 for(const [a,c]of[[2,3.6],[4.1,6]]){let lo=a,hi=c;const first=stateAt(lo).elbowAssist.contact;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(stateAt(mid).elbowAssist.contact===first)lo=mid;else hi=mid;}
  assert.ok(Math.abs(stateAt(hi+1e-7).elbowAssist.leverAngle-stateAt(lo-1e-7).elbowAssist.leverAngle)<1e-5);}
 const before=[];m.root.traverse(o=>before.push([o,o.geometry]));for(let i=0;i<=256;i++)m.update(i/32);const after=[];m.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,before);
 assert.match(g.qualification,/passive branch dynamics remain prescribed/);
});
