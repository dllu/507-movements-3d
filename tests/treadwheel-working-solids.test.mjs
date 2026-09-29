import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAuthoredEdgeRunnerMovement as a} from '../src/simulation/authored-edge-runners.js';
import {createAuthoredAnimalTreadwheelMovement as b} from '../src/simulation/authored-animal-treadwheels.js';
import {createAuthoredPersonTreadmillMovement as c} from '../src/simulation/authored-person-treadmills.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const models=[a({id:375}),b({id:376}),c({id:377})];
const cache=new Map(),get=o=>{if(!cache.has(o))cache.set(o,{p:surfacePoints(o.geometry),s:solidSurface(o.geometry)});return cache.get(o);};
function clearance(a,b){let min=Infinity;for(const[x,y]of[[a,b],[b,a]]){const tr=y.matrixWorld.clone().invert().multiply(x.matrixWorld),s=get(y).s;for(const p of get(x).p){const q=p.clone().applyMatrix4(tr);if(s.box.distanceToPoint(q)>.003)continue;min=Math.min(min,s.signedDistance(q,.15));}}return min;}
function inside(o,p){return get(o).s.inside(o.worldToLocal(p.clone()));}
function joined(a,b,p){assert.ok(inside(a,p)&&inside(b,p),`${a.userData.role}/${b.userData.role} connected`);}

test('375 actual runner/track solids and independent journals clear over the complete carrier orbit',()=>{
 const m=models[0],b=m.root.userData.blocks;
 const pairs=[[b.inputShaft,b.inputBearing],[b.inputShaft,b.inputBearingSupport],[b.verticalShaft,b.lowerBearing],...b.edgeRunners.flatMap(r=>[[r.userData.stone,b.pan],[r.userData.stone,b.crossAxle],[r.userData.rotor.children.find(o=>o.userData.role==='edge-runner-bearing-hub'),b.crossAxle]])];
 for(let i=0;i<=64;i++){m.update(i/16);m.root.updateMatrixWorld(true);for(const[a,b]of pairs)assert.ok(clearance(a,b)>-2e-6,`${i}: ${a.userData.role}/${b.userData.role}`);}
});
test('375 finite trough supports the rolling contact and bearings connect to the frame',()=>{
 const m=models[0],b=m.root.userData.blocks;m.update(0);m.root.updateMatrixWorld(true);
 const floor=new T.Vector3(1.44,-1.42,0);assert.ok(inside(b.pan,floor));assert.ok(!inside(b.pan,new T.Vector3(1.44,-1.38,0)));assert.ok(!inside(b.pan,new T.Vector3(0,-1.5,0)));assert.ok(inside(b.pan,new T.Vector3(.3,-1.73,0)),'p96: the centre bore is a blind socket');
 joined(b.lowerBearing,b.lowerBase,new T.Vector3(.15,-1.755,0));joined(b.pan,b.lowerBase,new T.Vector3(1.44,-1.755,0));joined(b.inputBearing,b.inputBearingSupport,new T.Vector3(2.45,new T.Box3().setFromObject(b.inputBearing).min.y+.03,0));joined(b.inputBearingSupport,b.frameTop,new T.Vector3(2.45,1.5,-.2));
});
test('376 bored journal arms and horse body clear the axle at every wheel pose',()=>{
 const m=models[1],b=m.root.userData.blocks;for(let i=0;i<=64;i++){m.update(i/16);m.root.updateMatrixWorld(true);for(const part of[...b.fixedBearings,...b.bearingArms,b.torso,b.neck,b.head].filter(Boolean))assert.ok(clearance(part,b.axle)>-2e-6,part.userData.role);}
});
test('376 one-piece treads, their end cheeks, spokes and side rings have finite connections',()=>{
 const m=models[1],d=m.root.userData,b=d.blocks;m.update(0);m.root.updateMatrixWorld(true);
 assert.deepEqual(b.treadMounts,[]);
 const band=side=>b.faceRims[side>0?1:0];
 for(const tread of b.treadBoards)for(const side of[-1,1]){const i=tread.userData.index,angle=i*d.geometry.treadPitch,ring=b.sideRings[side>0?1:0];
  // p109: boards run into continuous flange rings, which meet the band and ring.
  const flange=b.treadFlanges[side>0?1:0],ends=d.treadChannel;
  joined(tread,flange,b.wheelRotor.localToWorld(new T.Vector3(Math.cos(angle)*1.70,Math.sin(angle)*1.70,side*(ends.boardEndZ-.002))));
  joined(flange,band(side),b.wheelRotor.localToWorld(new T.Vector3(Math.cos(angle)*1.95,Math.sin(angle)*1.95,side*.6725)));
  joined(flange,ring,b.wheelRotor.localToWorld(new T.Vector3(Math.cos(angle)*1.98,Math.sin(angle)*1.98,side*.58)));
 }
 for(const spoke of b.radialSpokes){const p=spoke.localToWorld(new T.Vector3(spoke.userData.halfLength+.01,0,0)),ring=b.sideRings[spoke.userData.side>0?1:0];joined(spoke,ring,p);}
});
test('377 axle has a real bearing passage and rail posts meet the foundation',()=>{
 const m=models[2],b=m.root.userData.blocks;for(let i=0;i<=64;i++){m.update(i/16);m.root.updateMatrixWorld(true);assert.ok(clearance(b.axle,b.bearing)>-2e-6);}
 for(const post of b.railPosts)joined(post,b.base,new T.Vector3(post.position.x,-1.97,post.position.z));
 for(const foot of b.feet){const p=foot.getWorldPosition(new T.Vector3());assert.ok(Math.abs(p.z)+.08<1.102,'foot lies inside full-width tread field');}
});
test('377 prescribed finite foot path clears every board while passive balance remains unqualified',()=>{
 const m=models[2],b=m.root.userData.blocks;let min=0;for(let i=0;i<=64;i++){m.update(i/16);m.root.updateMatrixWorld(true);for(const foot of b.feet)for(const tread of b.treadBoards)min=Math.min(min,clearance(foot,tread));}
 assert.ok(min>=-2e-6,`foot/tread penetration: ${min}`);
 for(const [i,m]of models.entries()){assert.equal(m.root.userData.hideGround,true);assert.equal(m.root.userData.minimumDisplayCycleSeconds,i===0?6:12);assert.match(m.root.userData.workingPartsReview.qualification,/unqualified/);}
});
test('family playback retains scene objects and geometry buffers',()=>{for(const m of models){const before=[];m.root.traverse(o=>before.push([o,o.geometry]));for(let i=0;i<=64;i++)m.update(i/16);const after=[];m.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,before);}});
