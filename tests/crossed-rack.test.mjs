import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeCrossedRackDrive} from '../src/simulation/crossed-rack.js';
import {sampleCrossedRackMotion} from '../src/simulation/crossed-rack-motion.js';
import {MovementEngine} from '../src/simulation/engine.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const near=(a,b,tolerance=1e-9)=>assert(Math.abs(a-b)<=tolerance,`${a} != ${b}`),
 dispose=model=>model.root.traverse(x=>{x.geometry?.dispose();x.material?.dispose();});

test('080 follows the measured finite rack, joint centers and crossed pawl layers',()=>{
 const model=makeCrossedRackDrive(),u=model.root.userData,p=u.geometry;
 assert.equal(p.teeth,16);assert.equal(Object.keys(u.parts).length,16);assert.equal(u.hideGround,true);assert.equal(u.fidelity,'authored');
 near(p.pitch,35.77748215444516/175.59899774689143);near(p.scale,175.59899774689143);
 for(const [key,pixel]of [['left',[453.144903726183,286.2500598318096]],['right',[804.3428992199658,296.14622830981034]]]){
  u.source(pixel).forEach((v,i)=>near(p.anchors[key][i],v));
 }
 assert(p.layers.right[0]>p.layers.left[1]);assert(p.layers.left[0]>p.layers.rack[1]);
 assert.match(u.idealConstraints,/ideal prismatic/);assert.equal(u.playbackDuration,undefined);near(u.minimumDisplayCycleSeconds,4);dispose(model);
});

test('080 renders closed outward surfaces and real shaft bores and slot',()=>{
 const model=makeCrossedRackDrive(),u=model.root.userData;
 for(const [name,mesh]of Object.entries(u.parts)){
  const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,edges=new Map();let volume=0;
  for(let i=0;i<(g.index?.count??p.count);i+=3){
   const ids=[0,1,2].map(j=>g.index?g.index.getX(i+j):i+j),v=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),
    normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
   assert(normal.lengthSq()>1e-22,name);volume+=v[0].dot(v[1].clone().cross(v[2]))/6;
   assert(normal.dot(ids.reduce((s,j)=>s.add(new THREE.Vector3().fromBufferAttribute(n,j)),new THREE.Vector3()))>0,name);
   const keys=v.map(v=>v.toArray().join(','));for(let j=0;j<3;j++){
    const a=keys[j],b=keys[(j+1)%3],id=a<b?a+'/'+b:b+'/'+a,e=edges.get(id)??{count:0,sign:0};e.count++;e.sign+=a<b?1:-1;edges.set(id,e);
   }
  }
  assert(volume>0,name);for(const e of edges.values()){assert.equal(e.count,2,name);assert.equal(e.sign,0,name);}
 }
 for(const key of ['left','right']){
  const solid=solidSurface(u.parts[key+'Pawl'].geometry),z=(u.geometry.layers[key][0]+u.geometry.layers[key][1])/2;
  assert.equal(solid.inside(new THREE.Vector3(0,0,z)),false);
  assert.equal(solid.inside(new THREE.Vector3(u.geometry[key+'BoreRadius']+.012,0,z)),true);
 }
 assert.equal(solidSurface(u.parts.taperedLever.geometry).inside(new THREE.Vector3(0,0,-.18)),false);
 const slot=u.geometry.source.slot,point=u.source([(slot.left+slot.right)/2,(slot.top+slot.bottom)/2]);
 assert.equal(solidSurface(u.parts.slottedRack.geometry).inside(new THREE.Vector3(...point,0)),false);dispose(model);
});

test('080 carries the whole rack through cycles, retains rollback and returns seamlessly to its start',()=>{
 const model=makeCrossedRackDrive(),u=model.root.userData,p=u.geometry,keys=['q','rackY','leftAngle','rightAngle'];
 near(sampleCrossedRackMotion(0).rackY,0);near(sampleCrossedRackMotion(9).rackY/p.pitch,4.380129831371553);
 // Both compared heights can differ from the physical knots by the
 // independently certified 0.001-source-pixel compression allowance.
 near((sampleCrossedRackMotion(8).rackY-sampleCrossedRackMotion(4).rackY)/p.pitch,2.006313622,2*.001/(p.pitch*p.scale));
 assert(sampleCrossedRackMotion(1.5).rackY<sampleCrossedRackMotion(1).rackY,'Physical rollback at reversal');
 for(const seam of [4,8])for(const key of keys)near(sampleCrossedRackMotion(seam-1e-9)[key],sampleCrossedRackMotion(seam+1e-9)[key],1e-8);
 for(const time of [-1,0,.173,1,3,4,7.351,9,10,100]){
  model.update(time);const first={...u.kinematics};model.update(time+37);model.update(time);assert.deepEqual(u.kinematics,first);
  const fast=sampleCrossedRackMotion(time/2,{period:2});for(const key of keys)near(first[key],fast[key]);
 }
 // The recorded lift (0-9 s) is followed by a three-second return; the
 // twelve-second cycle closes in pose and velocity and never finishes.
 const loop=12;near(sampleCrossedRackMotion(0).duration,loop);assert.equal(u.playbackDuration,undefined);
 for(const seam of [9,loop,2*loop])for(const key of keys)near(sampleCrossedRackMotion(seam-1e-7)[key],sampleCrossedRackMotion(seam+1e-7)[key],2e-6);
 const before=sampleCrossedRackMotion(loop-1e-6),after=sampleCrossedRackMotion(loop+1e-6);
 near(before.angularVelocities[0],after.angularVelocities[0],1e-4);near(before.rackVelocity,0,1e-3);
 for(const time of [10,10.5,100,1e6]){const state=sampleCrossedRackMotion(time);assert(!state.finished&&!state.inputStopped);}
 assert(sampleCrossedRackMotion(10.5).rackY<sampleCrossedRackMotion(9).rackY-p.pitch,'the released rack is let down');
 for(const key of keys)near(sampleCrossedRackMotion(loop+3.1)[key],sampleCrossedRackMotion(3.1)[key],1e-9);
 for(const time of [NaN,Infinity,-Infinity])assert.throws(()=>sampleCrossedRackMotion(time));
 for(const period of [0,-1,NaN,Infinity])assert.throws(()=>sampleCrossedRackMotion(1,{period}));dispose(model);
});

test('080 free pawls remain pinned to the rotating lever throughout finite travel',()=>{
 const model=makeCrossedRackDrive(),u=model.root.userData;
 for(let i=0;i<=200;i++){
  model.update(i/20);
  for(const key of ['left','right']){
   const eye=new THREE.Vector3().applyMatrix4(u.blocks[key].matrixWorld),pin=new THREE.Vector3().applyMatrix4(u.parts[key+'PawlPin'].matrixWorld);
   near(eye.x,pin.x,1e-12);near(eye.y,pin.y,1e-12);near(u.blocks.rack.position.x,0);near(u.blocks.rack.rotation.z,0);
  }
 }
 dispose(model);
});

test('080 each loaded hook supports actual rack material',()=>{
 const model=makeCrossedRackDrive(),u=model.root.userData,rack=u.parts.slottedRack,
  rackBody={mesh:rack,solid:solidSurface(rack.geometry),points:surfacePoints(rack.geometry)};
 for(const [time,key]of [[1,'right'],[3,'left']]){
  const hook=u.parts[key+'HookWeb'],hookBody={mesh:hook,solid:solidSurface(hook.geometry),points:surfacePoints(hook.geometry)},
   penetrates=()=>[[rackBody,hookBody],[hookBody,rackBody]].some(([from,to])=>{
    const matrix=to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
    return from.points.some(v=>{const p=v.clone().applyMatrix4(matrix);return to.solid.box.containsPoint(p)&&to.solid.inside(p)&&to.solid.distance(p)>1e-6;});
   });
  model.update(time);assert.equal(penetrates(),false,key+': nominal penetration');u.blocks.rack.position.y-=.002;model.root.updateMatrixWorld(true);
  assert.equal(penetrates(),true,key+': absent supporting contact');
 }
 dispose(model);
});

test('080 independent solid families clear through startup, reversals and the return stroke',()=>{
 const model=makeCrossedRackDrive(),u=model.root.userData,parts=Object.entries(u.parts).map(([name,mesh])=>({name,mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
 for(const time of [0,.06,.1,.114,1,1.5,2,3,4,5,6,7,8,9,9.2,9.5,10,10.5,11,11.4,11.6,11.8,11.9,12]){
  model.update(time);const boxes=parts.map(p=>p.solid.box.clone().applyMatrix4(p.mesh.matrixWorld));
  for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(u.families[parts[i].name]!==u.families[parts[j].name]&&boxes[i].intersectsBox(boxes[j])){
   for(const [a,b]of [[parts[i],parts[j]],[parts[j],parts[i]]]){
    const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
    for(const v of a.points){const p=v.clone().applyMatrix4(matrix);if(b.solid.box.containsPoint(p)&&b.solid.inside(p))assert(b.solid.distance(p)<=1e-6,`${time}: ${a.name}/${b.name}`);}
   }
  }
 }
 dispose(model);
});

test('finite engine playback pauses, clamps, reports completion and replays without resetting the camera',()=>{
 const engine=Object.create(MovementEngine.prototype),model=makeCrossedRackDrive(),events=[],view={marker:'user orbit'};
 Object.assign(engine,{model,elapsed:0,playbackDuration:10,playbackEnded:false,playing:false,speed:2,playbackTimeScale:1,
  clock:{getDelta:()=>0},camera:view,updateGroundClearance:()=>{},onPlaybackChange:s=>events.push(s)});
 engine.advance(3);near(engine.elapsed,0);assert.equal(engine.togglePlaying(),true);engine.advance(1.25);near(engine.elapsed,2.5);
 engine.setPlaying(false);const stopped={...model.root.userData.kinematics};engine.advance(100);assert.deepEqual(model.root.userData.kinematics,stopped);
 engine.togglePlaying();engine.advance(100);near(engine.elapsed,10);assert(engine.playbackEnded&&!engine.playing);assert(events.at(-1).ended);
 const final={...model.root.userData.kinematics};engine.advance(100);assert.deepEqual(model.root.userData.kinematics,final);
 let resets=0;engine.fitCamera=()=>resets++;engine.resetView();assert.equal(resets,1);near(engine.elapsed,10);
 engine.togglePlaying();near(engine.elapsed,0);assert(engine.playing&&!engine.playbackEnded);near(model.root.userData.kinematics.rackY,0);assert.equal(engine.camera,view);
 engine.advance(.5);near(engine.elapsed,1);dispose(model);
});

test('ordinary cyclic engine playback keeps advancing with its original delta',()=>{
 const engine=Object.create(MovementEngine.prototype),updates=[];
 Object.assign(engine,{model:{update:(...args)=>updates.push(args)},elapsed:100,playing:true,speed:1.5,playbackTimeScale:.73,
  playbackDuration:Infinity,playbackEnded:false,clock:{getDelta:()=>0},updateGroundClearance:()=>{}});
 engine.advance(.016);assert.equal(updates[0][1],.016*1.5*.73);assert(engine.playing&&!engine.playbackEnded);
 engine.advance(100);assert(engine.elapsed>200);assert(engine.playing&&!engine.playbackEnded);
});
