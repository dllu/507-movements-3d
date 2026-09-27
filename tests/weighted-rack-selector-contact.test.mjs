import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAuthoredAlternatingWeightedRackMovement as create} from '../src/simulation/authored-alternating-weighted-racks.js';
import {solidSurface,surfacePoints,surfaceTriangles} from './helpers/solid-surface.mjs';
const m=create({id:391}),d=m.root.userData,b=d.blocks,sourceShift=d.geometry.sourcePhase*d.timeline.cycleDuration,stateAt=t=>d.stateAtTime(t-sourceShift),updateAt=t=>m.update(t-sourceShift),g=d.selectorContactReview,cache=new Map();
function data(o){if(!cache.has(o))cache.set(o,{points:surfacePoints(o.geometry),solid:solidSurface(o.geometry)});return cache.get(o);}
function clearance(a,c){let min=Infinity;for(const[x,y]of[[a,c],[c,a]]){const tr=y.matrixWorld.clone().invert().multiply(x.matrixWorld),field=data(y).solid;for(const p of data(x).points){const q=p.clone().applyMatrix4(tr);if(field.box.distanceToPoint(q)>.003)continue;min=Math.min(min,field.signedDistance(q,.04));}}return min;}
const linkTriangles=surfaceTriangles(b.elbowLink.geometry);
// Closest point of the real link mesh to the roller's axis, in the roller's plane.
function meshContact(){const world=b.elbowRoller.getWorldPosition(new T.Vector3()),p=b.elbowLink.worldToLocal(world.clone());p.z=.42;let distance=Infinity,closest;for(const tri of linkTriangles){const q=tri.closestPointToPoint(p,new T.Vector3()),value=Math.hypot(q.x-p.x,q.y-p.y);if(value<distance){distance=value;closest=q;}}
 const force=new T.Vector3(p.x-closest.x,p.y-closest.y,0).normalize().transformDirection(b.elbowLink.matrixWorld);return{gap:distance-g.rollerRadius,force,world};}

test('391 elbow lever C, its link, the rack lug and roller, guide pin, pins and stop remain separated over a full cycle',()=>{
 const pairs=[[b.elbowCam,b.elbowRoller],[b.elbowCam,b.rightRack.userData.guidePin],[b.elbowCam,b.elbowLug],[b.elbowCam,b.rightRack.userData.body],[b.elbowCam,b.elbowRestStop],[b.elbowCam,b.elbowLever.children[1]],[b.elbowCam,b.elbowRollerAxle],
  [b.elbowLink,b.elbowRoller],[b.elbowLink,b.elbowRollerAxle],[b.elbowLink,b.rightRack.userData.guidePin],[b.elbowLink,b.rightRack.userData.body],[b.elbowLink,b.elbowLug],[b.elbowLink,b.elbowLinkPin],[b.elbowLink,b.elbowCam],[b.elbowLink,b.elbowSpringStud],[b.elbowLink,b.elbowRestStop],
  [b.elbowRoller,b.elbowRollerAxle],[b.elbowLug,b.elbowRollerAxle],[b.elbowLug,b.elbowRoller],[b.elbowSpringStud,b.elbowRoller],[b.elbowRestStop,b.elbowRoller]];
 for(let i=0;i<=256;i++){m.update(i/32);m.root.updateMatrixWorld(true);for(const[a,c]of pairs)assert.ok(clearance(a,c)>-2e-6,`${i}: ${a.userData.role}/${c.userData.role}`);}
});
test('391 the link bears end-on on the roller, pushes the rack outward and balances positive spring tension during assist',()=>{
 let count=0,maxGap=0,minRackTorque=Infinity,maxRackTorque=-Infinity;
 for(let i=0;i<=128;i++){const time=3.36+2*i/128,state=stateAt(time);if(!state.elbowAssist.active)continue;updateAt(time);m.root.updateMatrixWorld(true);const hit=meshContact(),arm=hit.world.clone().sub(new T.Vector3(state.rightRack.pivot.x,state.rightRack.pivot.y,hit.world.z)),torque=arm.x*hit.force.y-arm.y*hit.force.x;
  assert.ok(hit.gap>=-2e-6&&hit.gap<.0005,`finite contact gap ${hit.gap}`);
  // The strut's thrust runs along the link, so its line clears the rack's pivot far below: an outward (clockwise) moment.
  assert.ok(torque<-2.0,`outward clockwise rack torque ${torque}`);
  const along=new T.Vector3(Math.cos(state.elbowAssist.strutAngle),Math.sin(state.elbowAssist.strutAngle),0);assert.ok(hit.force.dot(along)>.999,'contact normal lies along the link (two-force strut)');
  const ca=Math.cos(state.elbowAssist.leverAngle),sa=Math.sin(state.elbowAssist.leverAngle),[ax,ay]=g.springStud,attachment=new T.Vector3(ax*ca-ay*sa,ax*sa+ay*ca,0),springDirection=b.springAnchorBoss.position.clone().sub(b.elbowLever.position).sub(attachment).setZ(0).normalize(),springTorque=attachment.x*springDirection.y-attachment.y*springDirection.x;
  const pin=new T.Vector3(state.elbowAssist.linkPin.x,state.elbowAssist.linkPin.y,0),camReaction=-(pin.x*hit.force.y-pin.y*hit.force.x);
  assert.ok(springTorque>0&&camReaction<0,'positive spring tension requires a compressive strut reaction');
  assert.ok(state.rightRack.angularSpeed<1e-9,'source spring assists outward selection');
  count++;maxGap=Math.max(maxGap,hit.gap);minRackTorque=Math.min(minRackTorque,torque);maxRackTorque=Math.max(maxRackTorque,torque);
 }
 // C pushes through the upper crossover (3.36-4.0) and into the start of the descent, then lets go.
 assert.ok(count>45&&count<110,`assist spans the upper corner and ends early in the descent: ${count}`);
 console.log({selectorAssistSamples:count,maxGap,minRackTorque,maxRackTorque});
});
test('391 the rising rack loads the spring before the outward assist, then C returns to its stop pin',()=>{
 const loading=stateAt(2.8),assist=stateAt(3.5),released=stateAt(5.0),end=stateAt(5.4);
 assert.ok(loading.elbowAssist.loading&&!loading.elbowAssist.active&&loading.rightRack.engaged);
 assert.ok(loading.elbowAssist.springDeflection>THREE_DEGREES*9,'C swings well round against spring d');
 assert.ok(assist.elbowAssist.active&&!assist.elbowAssist.loading);
 assert.ok(!released.elbowAssist.contact&&released.elbowAssist.gap>.05&&end.elbowAssist.gap>released.elbowAssist.gap);
 assert.equal(released.elbowAssist.leverAngle,g.restAngle);
 updateAt(0);m.root.updateMatrixWorld(true);
 // The short arm's lower edge rests on the stop pin.
 const stop=b.elbowCam.worldToLocal(b.elbowRestStop.getWorldPosition(new T.Vector3()));stop.z=.30;
 let nearest=Infinity;for(const tri of surfaceTriangles(b.elbowCam.geometry))nearest=Math.min(nearest,tri.closestPointToPoint(stop,new T.Vector3()).distanceTo(stop));
 assert.ok(Math.abs(nearest-g.stopRadius)<.0003,`finite stop actually touches the short arm: ${nearest}`);
});
const THREE_DEGREES=Math.PI/60;
test('391 C and its link move continuously through contact entry, release and the link\'s fall; playback retains buffers',()=>{
 let prior=stateAt(0),maximumStep=0,maximumLinkStep=0,maximumSwing=0;for(let i=1;i<=8192;i++){const next=stateAt(i/1024);maximumStep=Math.max(maximumStep,Math.abs(next.elbowAssist.leverAngle-prior.elbowAssist.leverAngle));maximumLinkStep=Math.max(maximumLinkStep,Math.abs(next.elbowAssist.linkAngle-prior.elbowAssist.linkAngle));maximumSwing=Math.max(maximumSwing,next.elbowAssist.springDeflection);assert.ok(next.elbowAssist.gap>-1e-8);prior=next;}
 assert.ok(maximumStep<.0035,`no branch jump: ${maximumStep}`);assert.ok(maximumLinkStep<.005,`link never jumps: ${maximumLinkStep}`);
 assert.ok(maximumSwing>THREE_DEGREES*10&&maximumSwing<THREE_DEGREES*13,`C swings about 33 degrees: ${maximumSwing}`);
 for(const [a,c]of[[1.5,2.8],[3.5,4.0]]){let lo=a,hi=c;const first=stateAt(lo).elbowAssist.contact;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(stateAt(mid).elbowAssist.contact===first)lo=mid;else hi=mid;}
  for(const key of['leverAngle','linkAngle'])assert.ok(Math.abs(stateAt(hi+1e-7).elbowAssist[key]-stateAt(lo-1e-7).elbowAssist[key])<1e-5,key);}
 // The link hangs straight down when free and is met end-on.
 assert.ok(Math.abs(stateAt(1).elbowAssist.linkAngle+Math.PI/2)<1e-12);
 const before=[];m.root.traverse(o=>before.push([o,o.geometry]));for(let i=0;i<=256;i++)m.update(i/32);const after=[];m.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,before);
 assert.match(g.qualification,/passive branch dynamics remain prescribed/);
});
