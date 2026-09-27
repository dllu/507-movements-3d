import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makePumpCatchDrive} from '../src/simulation/pump-catch.js';
import profile from '../src/data/pump-catch-profile.js';
import {makePumpCatchLiveCandidate} from '../scripts/lib/pump-catch-live-rope.mjs';
import {indexPumpCatchHardware} from '../scripts/lib/pump-catch-indexed-hardware.mjs';
import {makePumpCatchPlayback} from '../scripts/lib/pump-catch-playback.mjs';
import {makePumpCatchHeelContact} from '../scripts/lib/pump-catch-heel-contact.mjs';
import {solidSurface} from './helpers/solid-surface.mjs';

const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const dispose=model=>model.root.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});
const poses=[0,.04,.25,1,1.25,1.345,1.75,2.5,3.245,3.47,3.6525,3.75,4.0167,4.25,4.250001,5.345,7.6525,8.25];

test('086 completes the measured loose wheel and input band with real shaft and rope passages',()=>{
 const model=makePumpCatchDrive(),u=model.root.userData,h=u.completeHardware;
 // p60 support policy: Brown draws no second sheave, stand or pump hardware.
 assert.equal(Object.keys(u.parts).length,28);
 assert.deepEqual(Object.keys(u.parts).filter(n=>/^remote|Barrel|Guide|Hanger|LowerBed|Crosshead/.test(n)),[]);
 assert.equal(u.blocks.remoteInput,undefined);assert.equal(u.fidelity,'authored');assert.equal(u.hideGround,true);
 assert.notEqual(u.blocks.wheel,u.blocks.cam);assert.equal(u.blocks.catch.parent,u.blocks.wheel);
 near(h.radius,(u.source.center[0]-u.source.visibleRope.x)/u.source.scale);
 near(h.ropeRadius,u.source.visibleRope.width/(2*u.source.scale));
 near(u.rearDrive.radius,((u.source.rearRuns.lower[0]+u.source.rearRuns.lower[1])-(u.source.rearRuns.upper[0]+u.source.rearRuns.upper[1]))/(4*u.source.scale));
 for(const [name,point]of [
  ['spokedLooseWheelA',[0,0,-.2]],['looseWheelHub',[0,0,-.35]],['frontBearingStandard',[0,0,.3]],
  ['ropeLoadFerrule',[0,.06,0]],['basePlinth',[-h.radius,(u.source.center[1]-u.source.base.top)/u.source.scale-.05,h.z]]]){
  const solid=solidSurface(u.parts[name].geometry),p=new THREE.Vector3(...point);
  assert.ok(solid.box.containsPoint(p),name+' probe must lie within the overall body bounds');
  assert.equal(solid.inside(p),false,name+' needs a real passage');
 }
 dispose(model);
});

test('086 all rigid solids and changing rope meshes are closed with consistent surface normals',()=>{
 const model=makePumpCatchDrive();
 function check(name,g){
  const p=g.attributes.position,n=g.attributes.normal,edges=new Map();let volume=0;
  for(let i=0;i<(g.index?.count??p.count);i+=3){
   const ids=[0,1,2].map(j=>g.index?g.index.getX(i+j):i+j),v=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),
    cross=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
   assert.ok(cross.lengthSq()>1e-28,name+' degenerate face');volume+=v[0].dot(v[1].clone().cross(v[2]))/6;
   assert.ok(cross.dot(ids.reduce((sum,j)=>sum.add(new THREE.Vector3().fromBufferAttribute(n,j)),new THREE.Vector3()))>0,name+' inward normal');
   const keys=v.map(p=>p.toArray().join(','));for(let j=0;j<3;j++){
    const a=keys[j],b=keys[(j+1)%3],key=a<b?a+'/'+b:b+'/'+a,e=edges.get(key)??{count:0,sign:0};
    e.count++;e.sign+=a<b?1:-1;edges.set(key,e);
   }
  }
  assert.ok(volume>0,name+' nonpositive volume');
  assert.ok([...edges.values()].every(e=>e.count===2&&e.sign===0),name+' open or inconsistent boundary');
 }
 for(const [name,mesh]of Object.entries(model.root.userData.parts))check(name,mesh.geometry);
 for(const time of [1.345,3.6525,4.0167]){model.update(time);check('pumpRope at '+time,model.root.userData.parts.pumpRope.geometry);}
 dispose(model);
});

test('086 production has exact candidate pose, rigid geometry and live rope parity',()=>{
 const model=makePumpCatchDrive(),u=model.root.userData,candidate=makePumpCatchLiveCandidate(),v=candidate.root.userData,motion=makePumpCatchPlayback(profile);
 indexPumpCatchHardware(candidate);
 assert.deepEqual(u.source,v.source);
 // Production prunes the undrawn hardware, lengthens the pump rod to the rope
 // end, opens the band and runs the plinth slab left to abut post B as Brown
 // draws it; every other part matches the qualified candidate.
 assert.deepEqual(u.families,Object.fromEntries(Object.entries(v.families).filter(([n])=>!u.prunedHardware.includes(n))));
 assert.deepEqual(u.geometry,v.geometry);assert.deepEqual(u.completeHardware,v.completeHardware);
 const reshaped=new Set(['pumpOutputRod','inputDriveRope','basePlinth']);
 const plinth=new THREE.Box3().setFromObject(u.parts.basePlinth),post=new THREE.Box3().setFromObject(u.parts.overheadPost);
 assert.ok(Math.abs(plinth.min.x-post.max.x)<1e-6,'plinth slab abuts post B');
 for(const time of poses){
  const expected=motion.sample(time);assert.deepEqual(u.stateAtTime(time),expected);model.update(time);candidate.setState(expected);
  for(const [name,mesh]of Object.entries(u.parts)){
   if(reshaped.has(name)){assert.deepEqual(mesh.matrixWorld.elements,v.parts[name].matrixWorld.elements,name+' transform');continue;}
   const other=v.parts[name];assert.deepEqual(mesh.matrixWorld.elements,other.matrixWorld.elements,name+' transform');
   for(const [key,a]of Object.entries(mesh.geometry.attributes)){
    const b=other.geometry.attributes[key];assert.equal(a.count,b.count);
    assert.deepEqual(a.array.subarray(0,a.count*a.itemSize),b.array.subarray(0,b.count*b.itemSize),name+'/'+key);
   }
   const a=mesh.geometry.index,b=other.geometry.index;assert.equal(a.count,b.count);
   assert.deepEqual(a.array.subarray(0,a.count),b.array.subarray(0,b.count),name+' topology');
  }
 }
 dispose(model);dispose(candidate);
});

test('086 retains startup, repeats a settled four-second cycle and keeps the input band continuous',()=>{
 const model=makePumpCatchDrive(),u=model.root.userData,rate=profile.repeat.period/u.playbackPeriod;
 assert.equal(u.playbackPeriod,4);assert.equal(u.minimumDisplayCycleSeconds,4);
 assert.deepEqual(u.stateAtTime(0).q,[0,0,0]);assert.deepEqual(u.stateAtTime(-1),u.stateAtTime(0));
 for(const time of [NaN,Infinity,-Infinity])assert.throws(()=>model.update(time),/Nonfinite/);
 for(let i=0;i<=200;i++){
  const time=.25+i*4/200,a=u.stateAtTime(time),b=u.stateAtTime(time+4);
  for(let k=0;k<3;k++)near(a.q[k],b.q[k],2e-9);
  near(b.camAngle-a.camAngle,-2*Math.PI);
 }
 const seam=(profile.repeat.start+profile.repeat.period)/rate,delta=1e-7,a=u.stateAtTime(seam-delta),b=u.stateAtTime(seam+delta);
 for(let k=0;k<3;k++)near(a.q[k],b.q[k],1e-5);
 // Brown's two hatched runs are laid rope in the groove of A's sheave. They
 // leave the plate to the right, run straight on and end cleanly (no second
 // sheave is drawn); the lay travels with the sheave rim.
 const rope=u.parts.inputDriveRope;
 assert.equal(rope.geometry.type,'LaidRopeGeometry');assert.equal(rope.geometry.parameters.closed,false);
 rope.geometry.computeBoundingBox();near(rope.geometry.boundingBox.max.x,u.rearDrive.bandEnd,1e-6);
 assert.equal(u.parts.inputDriveBand,undefined);
 near(rope.geometry.parameters.radius,u.rearDrive.ropeRadius);
 near(rope.geometry.userData.ropeLay.length,u.rearDrive.bandLength,1e-3);
 for(const time of [.3,1.7]){model.update(time);near(rope.geometry.userData.travel,-u.kinematics.camAngle*u.rearDrive.radius,1e-9);}
 dispose(model);
});

test('086 finite catch contacts clear through lift and release; the pump returns to its lowest point',()=>{
 const model=makePumpCatchDrive(),u=model.root.userData,contact=makePumpCatchHeelContact(model);
 let min=Infinity,max=-Infinity,camContacts=0,stopContacts=0;
 for(let i=0;i<=160;i++){
  const state=u.stateAtTime(i*4.25/160);min=Math.min(min,state.pumpHeight);max=Math.max(max,state.pumpHeight);
  assert.ok(contact.minimumRawGap(state.q,state.camAngle)>=-1e-6,'Catch intersects finite cam, shaft or stop');
  for(const c of contact.query(state.q,state.camAngle,{margin:1e-5})){
   if(c.kind==='cam')camContacts++;if(c.kind==='stop')stopContacts++;
  }
 }
 assert.ok(camContacts>0);assert.ok(stopContacts>0);near(min,0,1e-9);assert.ok(max>2.59&&max<2.60);
 dispose(model);
});

test('086 actual rope stays attached and constant in length, reuses its buffers and fits the complete camera envelope',()=>{
 const model=makePumpCatchDrive(),u=model.root.userData,h=u.completeHardware,g=u.parts.pumpRope.geometry,
  arrays=Object.fromEntries(Object.entries(g.attributes).map(([key,a])=>[key,a.array])),indices=g.index.array,
  clamp=solidSurface(u.parts.wheelRopeClamp.geometry),head=solidSurface(u.parts.pumpOutputRod.geometry),
  bounds=new THREE.Box3(new THREE.Vector3(...profile.motionBounds.min),new THREE.Vector3(...profile.motionBounds.max)),counts=new Set();
 for(const time of poses){
  model.update(time);assert.equal(u.parts.pumpRope.geometry,g);assert.equal(g.index.array,indices);
  for(const [key,a]of Object.entries(g.attributes))assert.equal(a.array,arrays[key]);
  assert.equal(g.drawRange.count,g.index.count);const p=g.attributes.position,sections=(p.count-50)/25,centers=[];counts.add(sections);
  assert.equal(sections,Math.floor(sections));assert.ok(sections<1700);
  for(let i=0;i<sections;i++){
   const points=Array.from({length:24},(_,j)=>new THREE.Vector3().fromBufferAttribute(p,i*25+j)),
    center=points.reduce((s,p)=>s.add(p),new THREE.Vector3()).multiplyScalar(1/24);centers.push(center);
   for(const point of points)near(point.distanceTo(center),h.ropeRadius,1e-6);
  }
  let length=0;for(let i=1;i<centers.length;i++)length+=centers[i].distanceTo(centers[i-1]);near(length,h.ropeLength,1e-5);
  near(clamp.distance(centers[0].clone().applyMatrix4(u.parts.wheelRopeClamp.matrixWorld.clone().invert())),0,1e-6);
  near(head.distance(centers.at(-1).clone().applyMatrix4(u.parts.pumpOutputRod.matrixWorld.clone().invert())),0,1e-6);
  for(const [name,mesh]of Object.entries(u.parts))assert.ok(bounds.containsBox(new THREE.Box3().setFromObject(mesh,true)),name+' exceeds full-motion bounds');
 }
 assert.ok(counts.size>4,'Must exercise changing wrap topology');dispose(model);
});
