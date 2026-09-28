import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import { createAuthoredIntermittentMovement as create } from '../src/simulation/authored-intermittent.js';
import { makeGeneva212ContactLaw } from '../src/simulation/geneva-212-contact.js';
import { solidSurface, surfacePoints, surfaceTriangles } from './helpers/solid-surface.mjs';
const m=create({id:212}),d=m.root.userData,g=d.geometry,b=d.blocks,branch=makeGeneva212ContactLaw(g);
const rot=(p,a)=>p.clone().rotateAround(new T.Vector2(),a),cross=(a,b)=>a.x*b.y-a.y*b.x;
function pose(a){const s=d.stateAtInputAngle(a);b.driver.userData.rotor.rotation.z=s.driverAngle;b.stopWheel.userData.rotor.rotation.z=s.stopWheelAngle;m.root.updateMatrixWorld(true);return s;}
const bodies=[b.driverBody,b.stopWheelBody],fields=bodies.map(o=>solidSurface(o.geometry)),points=bodies.map(o=>{const p=surfacePoints(o.geometry),step=Math.ceil(p.length/3200);return p.filter((_,i)=>i%step===0);});
function gap(){let min=Infinity;for(let j=0;j<2;j++){const matrix=bodies[1-j].matrixWorld.clone().invert().multiply(bodies[j].matrixWorld),field=fields[1-j];for(const p of points[j]){const q=p.clone().applyMatrix4(matrix);if(field.box.distanceToPoint(q)>.003)continue;min=Math.min(min,field.signedDistance(q,.05));}}return min;}
function face(mesh,world){const p=world.clone().applyMatrix4(mesh.matrixWorld.clone().invert());let distance=Infinity,normal;for(const t of surfaceTriangles(mesh.geometry)){const n=t.getNormal(new T.Vector3());if(Math.abs(n.z)>.1)continue;const v=t.closestPointToPoint(p,new T.Vector3()).distanceTo(p);if(v<distance){distance=v;normal=n.transformDirection(mesh.matrixWorld);}}return{distance,normal};}

test('212 complete finite branch, dwell and terminal poses retain both unrelieved bodies',()=>{
 const angles=[...Array.from({length:33},(_,i)=>branch.tailEnd*i/32),branch.entryEnd-1e-6,branch.entryEnd+1e-6,branch.tailStart-1e-6,branch.tailStart+1e-6,branch.tailEnd-1e-4,branch.tailEnd+1e-4,Math.PI,2*Math.PI,2*Math.PI+.445,4*Math.PI+.85,6*Math.PI+.4,g.forwardInputLimit];let minimum=Infinity;
 for(const a of angles){pose(a);const value=gap();minimum=Math.min(minimum,value);assert.ok(value>-3.1e-6,`${a}: ${value}`);}
 console.log({minimumActualProfileClearance:minimum});
 assert.equal(b.driverBody.geometry.parameters.options.bevelEnabled,false);assert.equal(b.stopWheelBody.geometry.parameters.options.bevelEnabled,false);
});

test('212 p98: the lengthened, rounded finger clears both bodies and every slot bottom through a dense sweep',()=>{
 let minimum=Infinity,bottom=Infinity;const finger=g.driverOutline.filter(p=>p.length()>4.3*g.constructionScale);
 for(let i=0;i<=120;i++){const a=branch.tailEnd*i/120+(i%3)*1e-4,s=pose(a);minimum=Math.min(minimum,gap());
  for(const slot of g.slotPolylines){const P=rot(slot[1],s.stopWheelAngle).add(g.stopWheelCenter),Q=rot(slot[2],s.stopWheelAngle).add(g.stopWheelCenter),e=Q.clone().sub(P);
   for(const f of finger){const w=rot(f,s.driverAngle).add(g.driverCenter),t=T.MathUtils.clamp(w.clone().sub(P).dot(e)/e.lengthSq(),0,1);bottom=Math.min(bottom,w.distanceTo(P.clone().addScaledVector(e,t)));}}}
 assert.ok(minimum>-3.1e-6,`profile clearance ${minimum}`);assert.ok(bottom>.03,`the finger clears the slot bottoms: ${bottom}`);
 console.log({poses:121,minimumProfileClearance:minimum,slotBottomClearance:bottom});
});

test('212 actual relief, rounded finger corner, slot and pocket faces provide clockwise reactions',()=>{
 // p98: the lengthened finger's rounded leading corner. Sample every regime
 // between the located boundaries, plus the tail.
 const edges=[0,...branch.boundaries.map(x=>x.at),branch.tailEnd],stages=new Set();
 let worstGap=0,minimumDrive=Infinity;
 for(let i=1;i+1<edges.length;i++)for(const f of [.2,.5,.8]){
  const a=edges[i]+(edges[i+1]-edges[i])*f,s=pose(a),stage=s.engagement.workingContactStage;stages.add(stage);
  const p=branch.contactAt(a,s.stopWheelAngle,stage);
  const world=new T.Vector3(p.x,p.y,0),wheel=face(b.stopWheelBody,world),driver=face(b.driverBody,world);
  worstGap=Math.max(worstGap,wheel.distance,driver.distance);assert.ok(Math.max(wheel.distance,driver.distance)<3.1e-6,`${stage} at ${a}: ${wheel.distance} ${driver.distance}`);
  // B's corner on A's curved face takes A's face normal; A's corner (or
  // rounded corner) on B's flat face takes the reverse of B's.
  const normal=/mouth/.test(stage)?driver.normal:wheel.normal.clone().negate();
  const moment=cross(p.clone().sub(g.stopWheelCenter),normal);
  if(stage!=='rounded-finger-mouth-hold'){assert.ok(moment<-.06,`${stage}: actual moment ${moment}`);minimumDrive=Math.min(minimumDrive,-moment);}
 }
 for(const stage of ['relief-mouth-drive','fillet-flank-drive','fillet-mouth-drive','rim-corner-pocket-drive'])assert.ok(stages.has(stage),stage);
 console.log({maximumActualContactGap:worstGap,minimumTestedClockwiseMoment:minimumDrive,stages:[...stages]});
});

test('212 contact branch is position-continuous, monotone and has exact analytical rates away from impacts',()=>{
 let previous=0;for(let i=0;i<=4096;i++){const s=d.stateAtInputAngle(g.forwardInputLimit*i/4096,1,0);assert.ok(s.stopWheelAngle<=previous+1e-10);previous=s.stopWheelAngle;assert.ok(Number.isFinite(s.stopWheelAngularSpeed));}
 for(const a of [0,branch.entryEnd,branch.tailStart,branch.tailEnd,2*Math.PI,4*Math.PI,6*Math.PI]){const x=d.stateAtInputAngle(a-1e-8),y=d.stateAtInputAngle(a+1e-8);assert.ok(Math.abs(x.stopWheelAngle-y.stopWheelAngle)<1e-6);}
 for(const a of [.1,.3,.5,.75,.84,.91,1.5,2*Math.PI+.3]){const h=1e-5,s=d.stateAtInputAngle(a,1,0),lo=d.stateAtInputAngle(a-h),hi=d.stateAtInputAngle(a+h);assert.ok(Math.abs((hi.stopWheelAngle-lo.stopWheelAngle)/(2*h)-s.stopWheelAngularSpeed)<1e-7);assert.ok(Math.abs((hi.stopWheelAngle-2*s.stopWheelAngle+lo.stopWheelAngle)/h**2-s.stopWheelAngularAcceleration)<3e-4);}
 assert.ok(branch.tailEnd>g.normalIndexInputAngle);assert.ok(d.stateAtInputAngle(.445).engagement.officialPhaseError>.0007);
 for(let k=0;k<3;k++){const s=d.stateAtInputAngle(k*2*Math.PI+branch.tailEnd+.01);assert.equal(s.lock.active,true);assert.ok(s.lock.concentricityError<3e-7);}
});

test('212 terminal remains a real blocking surface and reverse playback declares its bias',()=>{
 const s=pose(g.forwardInputLimit),p=new T.Vector3(s.limit.contactPoint.x,s.limit.contactPoint.y,0);
 assert.ok(face(b.driverBody,p).distance<3e-6);assert.ok(face(b.stopWheelBody,p).distance<3e-6);
 b.driver.userData.rotor.rotation.z+=.002;m.root.updateMatrixWorld(true);assert.ok(gap()<-.0001);
 assert.match(d.reconstructionNote,/assisting output bias/);assert.match(d.reconstructionNote,/impacts/);assert.match(d.reconstructionNote,/not simulated/);
});

test('212 rendered law and public fields agree while reverse cycles retain all buffers',()=>{
 const before=[];m.root.traverse(o=>before.push([o,o.geometry]));
 for(let i=0;i<=64;i++){m.update(d.timeline.demonstrationPeriod*i/64-d.displayTimeOffset);const s=d.stateAtTime(d.timeline.demonstrationPeriod*i/64);assert.equal(b.stopWheel.userData.rotor.rotation.z,s.stopWheelAngle);assert.equal(d.kinematics.stopWheelAngle,s.stopWheelAngle);assert.equal(Boolean(d.contacts.lockingPocket),s.lock.active);}
 const after=[];m.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(before,after);
 for(const key of['firstIndexComplete','secondIndexComplete','thirdIndexComplete'])assert.equal(d.canonicalStates[key].lock.active,true);
 assert.equal(d.sourceAnimation.available,true);assert.equal(d.sourceAnimation.runtimeReconstructsFiniteContact,true);
});

test('212 opens at Brown\'s pose: two indexes done, the convex stop face a-b beside the top slot',()=>{
 m.update(0);
 const s=d.kinematics;
 assert.ok(Math.abs(s.stopWheelAngle+2*g.stopStepAngle)<1e-9,`B turned two steps: ${s.stopWheelAngle}`);
 // The convex face's midpoint lies up and to the right of B's centre.
 const arc=g.convexStopArc,mid=arc[Math.floor(arc.length/2)].clone().rotateAround(new T.Vector2(),s.stopWheelAngle);
 const angle=Math.atan2(mid.y,mid.x)*180/Math.PI;
 assert.ok(angle>15&&angle<90,`convex face at ${angle} degrees`);
});
