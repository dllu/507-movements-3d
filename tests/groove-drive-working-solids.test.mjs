import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAuthoredIntermittentShuttleDriveMovement as c397} from '../src/simulation/authored-intermittent-shuttle-drives.js';
import {createAuthoredCamRockingDriveMovement as c398} from '../src/simulation/authored-cam-rocking-drives.js';
import {surfacePoints,solidSurface} from './helpers/solid-surface.mjs';
const models=[c397({id:397}),c398({id:398})];
function audit(m,pairs,period,steps=64){
 const fields=pairs.flatMap(([a,b])=>[[a,b],[b,a]]).map(([a,b])=>({a,b,points:surfacePoints(a.geometry),field:solidSurface(b.geometry),min:Infinity,maxNear:0}));
 for(let i=0;i<=steps;i++){m.update(period*i/steps);m.root.updateMatrixWorld(true);for(const f of fields){const tr=f.b.matrixWorld.clone().invert().multiply(f.a.matrixWorld);let gap=Infinity;for(const p of f.points){const q=p.clone().applyMatrix4(tr);if(f.field.box.distanceToPoint(q)>.035)continue;gap=Math.min(gap,f.field.signedDistance(q));}f.min=Math.min(f.min,gap);if(Number.isFinite(gap))f.maxNear=Math.max(f.maxNear,gap);}}
 return pairs.map((pair,i)=>({pair,min:Math.min(fields[i*2].min,fields[i*2+1].min),maxNear:fields[i*2].maxNear}));
}
function clear(fields){for(const f of fields)assert.ok(f.min>0,`${f.pair.map(o=>o.userData.role).join('/')} ${f.min}`);}
test('397 finite pin clears and stays close to the real open crescent throughout both traversals',()=>{
 const m=models[0],b=m.root.userData.blocks,r=b.rocker.userData;
 const fields=audit(m,[[b.crank.userData.pin,r.slotBody],[b.crank.userData.pin,r.lowerArm],[b.crank.userData.pin,r.upperArm],[b.crank.userData.arm,r.slotBody]],6);
 clear(fields);assert.ok(fields[0].min<.002);assert.ok(fields[0].maxNear<.004);
 assert.ok(b.crank.userData.pin.geometry.parameters.radiusTop>.119,'retain the full working pin');
 const law=m.root.userData.openCrescentLaw;
 for(let i=1;i<256;i++){const rho=law.low+(law.high-law.low)*i/256,q=law.pointAtRadius(rho),t=law.pointAtRadius(rho+1e-6).sub(law.pointAtRadius(rho-1e-6)).normalize();
  assert.ok(q.dot(t)>.20,'both finite flanks retain opposing moments about rocker pivot');}
});
test('397 bored rod and pivot interfaces remain engaged without metal overlap',()=>{
 const m=models[0],b=m.root.userData.blocks,r=b.rocker.userData;
 clear(audit(m,[[r.topJoint,b.connectingRod],[b.sliderJoint,b.connectingRod],[b.rockerShaft,r.pivotHub],[b.rockerShaft,b.rockerBoss],[b.crank.userData.shaft,b.crankBoss],...b.guides.map(p=>[b.shuttleBar,p])],6));
});
test('398 source-arc groove has actual opposed walls and a clear recessed floor',()=>{
 const m=models[1],b=m.root.userData.blocks,cam=b.cam.userData,roller=b.follower.userData.roller;
 const fields=audit(m,[[roller,cam.innerLand],[roller,cam.outerLand],[roller,cam.disk]],7);
 clear(fields);for(const f of fields.slice(0,2)){assert.ok(f.min<.001);assert.ok(f.maxNear<.0015);}
 assert.ok(fields[2].min>.025);
 assert.ok(roller.geometry.parameters.radiusTop>.099,'retain source-radius roller');
});
test('398 bore and crosshead guide interfaces retain working depth and clear solids',()=>{
 const m=models[1],b=m.root.userData.blocks;
 clear(audit(m,[[b.follower.userData.pivot,b.connectingRod],[b.outputWheel.userData.crankPin,b.connectingRod],...b.follower.userData.blocks.flatMap(p=>b.guides.map(g=>[p,g]))],7));
});
test('397/398 playback remains allocation-stable, groundless and at readable authored speed',()=>{
 for(const[m,period]of [[models[0],6],[models[1],7]]){const d=m.root.userData,before=[];m.root.traverse(o=>before.push([o,o.geometry]));for(let i=0;i<32;i++){d.stateAtTime(i*.17);m.update(i*.17);}const after=[];m.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,before);assert.equal(d.minimumDisplayCycleSeconds,period);assert.equal(d.hideGround,true);m.root.traverse(o=>{for(const material of[].concat(o.material??[]))assert.equal(material.fog,false);});}
});
