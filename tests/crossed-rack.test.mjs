import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeCrossedRackDrive} from '../src/simulation/crossed-rack.js';
import {sampleCrossedRackMotion} from '../src/simulation/crossed-rack-motion.js';
import {MovementEngine} from '../src/simulation/engine.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import profile from '../src/data/crossed-rack-profile.js';
import {makeCrossedRackOverlap} from '../scripts/lib/crossed-rack-overlap.mjs';
const near=(a,b,tolerance=1e-9)=>assert(Math.abs(a-b)<=tolerance,`${a} != ${b}`),
 dispose=model=>model.root.traverse(x=>{x.geometry?.dispose();x.material?.dispose();});

test('080 follows the measured finite rack, joint centers and crossed pawl layers',()=>{
 const model=makeCrossedRackDrive(),u=model.root.userData,p=u.geometry;
 assert.equal(p.teeth,16);assert.equal(Object.keys(u.parts).length,14);
 // Pass 91: each pawl is a flat plate with nothing in front; its pin stops inside the eye.
 for(const key of ['left','right']){assert.equal(u.parts[key+'PinFrontCap'],undefined);const g=u.parts[key+'PawlPin'].geometry;g.computeBoundingBox();assert(g.boundingBox.max.z<p.layers[key][1]);}assert.equal(u.hideGround,true);assert.equal(u.fidelity,'authored');
 near(p.pitch,35.77748215444516/175.59899774689143);near(p.scale,175.59899774689143);
 for(const [key,pixel]of [['left',[453.144903726183,286.2500598318096]],['right',[804.3428992199658,296.14622830981034]]]){
  u.source(pixel).forEach((v,i)=>near(p.anchors[key][i],v));
 }
 assert(p.layers.right[0]>p.layers.left[1]);assert(p.layers.left[0]>p.layers.rack[1]);
 // The pawls lie just in front of the rack, so the hook webs reach back no further than needed.
 assert(p.layers.left[0]-p.layers.rack[1]<=.02&&p.layers.right[0]-p.layers.left[1]<=.02&&p.layers.right[1]<=.17);
 assert.match(u.idealConstraints,/ideal prismatic/);assert.match(u.idealConstraints,/MuJoCo/);assert.equal(u.playbackDuration,undefined);near(u.minimumDisplayCycleSeconds,4);dispose(model);
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

// Display time of a physical loop time (display zero is a quarter swing in).
const display=tau=>((tau-profile.displayOffset+profile.loopPeriod)%profile.loopPeriod)/2;

test('080 plays a baked MuJoCo ratchet lift and reset as a seamless sixteen-second loop',()=>{
 const model=makeCrossedRackDrive(),u=model.root.userData,p=u.geometry,keys=['q','rackY','leftAngle','rightAngle'],at=tau=>sampleCrossedRackMotion(display(tau));
 // Display zero shows the source pose: lever level, rack at its drawn height, right hook seated.
 const start=sampleCrossedRackMotion(0);near(start.q,0);assert(Math.abs(start.rackY)<.01&&Math.abs(start.rightAngle)<.005);
 // Pass 99: three lever swings lift the rack about two pitches each, with physical rollback at each handoff.
 near((at(16).rackY-at(8).rackY)/p.pitch,2,.1);near((at(24).rackY-at(16).rackY)/p.pitch,2,.1);near((at(24).rackY-at(0).rackY)/p.pitch,5.95,.2);
 assert(at(5.2).rackY<at(4.8).rackY-.02,'Physical rollback at handoff');
 // The brief reset (4.7 of 32 physical seconds) lets the rack down again and
 // the loop closes in pose and speed.
 assert.equal(profile.liftEnd,24);assert(profile.provenance.plan.unsupport[1]<=4.7);
 assert(at(27.2).rackY<at(24).rackY-5*p.pitch,'the released rack is let down');
 const loop=16;near(start.duration,loop);assert.equal(u.playbackDuration,undefined);
 for(const seam of [loop,2*loop,5*loop])for(const key of keys)near(sampleCrossedRackMotion(seam-1e-7)[key],sampleCrossedRackMotion(seam+1e-7)[key],1e-6);
 const before=sampleCrossedRackMotion(loop-2e-3),after=sampleCrossedRackMotion(loop+2e-3);
 near(before.rackVelocity,after.rackVelocity,.02);near(before.angularVelocities[0],after.angularVelocities[0],1e-3);
 // No jumps anywhere, including the start and the seam: at 240 samples per display second
 // the rack moves at most 0.008 and a pawl turns at most 0.003 rad.
 let previous=sampleCrossedRackMotion(0),worst={rackY:0,leftAngle:0,rightAngle:0};
 for(let i=1;i<=240*loop;i++){const state=sampleCrossedRackMotion(i/240);for(const key of Object.keys(worst))worst[key]=Math.max(worst[key],Math.abs(state[key]-previous[key]));previous=state;}
 assert(worst.rackY<.008&&worst.leftAngle<.003&&worst.rightAngle<.003,JSON.stringify(worst));
 for(const time of [-1,0,.173,1,3,4,7.351,9,10,100]){
  model.update(time);const first={...u.kinematics};model.update(time+37);model.update(time);assert.deepEqual(u.kinematics,first);
  const fast=sampleCrossedRackMotion(time/2,{period:2});for(const key of keys)near(first[key],fast[key]);
 }
 for(const time of [10,10.5,100,1e6]){const state=sampleCrossedRackMotion(time);assert(!state.finished&&!state.inputStopped);}
 for(const key of keys)near(sampleCrossedRackMotion(loop+3.1)[key],sampleCrossedRackMotion(3.1)[key],1e-9);
 for(const time of [NaN,Infinity,-Infinity])assert.throws(()=>sampleCrossedRackMotion(time));
 for(const period of [0,-1,NaN,Infinity])assert.throws(()=>sampleCrossedRackMotion(1,{period}));dispose(model);
});

test('080 baked motion is current, and rendered hooks never overlap the rack',()=>{
 const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex'),v=profile.provenance;
 for(const {file,sha256}of v.sources)if(/crossed-rack/.test(file))assert.equal(hash(file),sha256,file+' changed since the bake: rerun scripts/bake-crossed-rack-mujoco.mjs');
 assert.equal(v.mujoco.version,JSON.parse(fs.readFileSync('node_modules/@mujoco/mujoco/package.json')).version);
 assert(v.minimumContactGap>0&&v.renderedOverlap.maximum<=1e-6&&v.periodicResiduals.at(-1).position<1e-4);
 const model=makeCrossedRackDrive(),overlap=makeCrossedRackOverlap(model.root.userData);let worst=0;
 for(let i=0;i<=3200;i++)worst=Math.max(worst,overlap(sampleCrossedRackMotion(i*16/3200)));
 assert(worst<=1e-6,'rendered hook/rack overlap '+worst);dispose(model);
});

test('080 free pawls remain pinned to the rotating lever throughout finite travel',()=>{
 const model=makeCrossedRackDrive(),u=model.root.userData;
 for(let i=0;i<=320;i++){
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
 for(const [time,key]of [[.5,'right'],[2.5,'left']]){
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

test('080 independent solid families clear through startup, handoffs and the reset',()=>{
 const model=makeCrossedRackDrive(),u=model.root.userData,parts=Object.entries(u.parts).map(([name,mesh])=>({name,mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
 for(const time of [0,.1,.2,.3,.5,1,1.5,1.6,2,2.5,3,3.1,3.5,4,5,5.6,6,7,7.5,8,8.5,9,9.2,9.4,9.6,10,10.5,11,11.5,12,12.4,12.8,13.2,13.6,14,14.5,15,15.5,16]){
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
 engine.togglePlaying();near(engine.elapsed,0);assert(engine.playing&&!engine.playbackEnded);near(model.root.userData.kinematics.rackY,sampleCrossedRackMotion(0).rackY);assert.equal(engine.camera,view);
 engine.advance(.5);near(engine.elapsed,1);dispose(model);
});

test('ordinary cyclic engine playback keeps advancing with its original delta',()=>{
 const engine=Object.create(MovementEngine.prototype),updates=[];
 Object.assign(engine,{model:{update:(...args)=>updates.push(args)},elapsed:100,playing:true,speed:1.5,playbackTimeScale:.73,
  playbackDuration:Infinity,playbackEnded:false,clock:{getDelta:()=>0},updateGroundClearance:()=>{}});
 engine.advance(.016);assert.equal(updates[0][1],.016*1.5*.73);assert(engine.playing&&!engine.playbackEnded);
 engine.advance(100);assert(engine.elapsed>200);assert(engine.playing&&!engine.playbackEnded);
});
