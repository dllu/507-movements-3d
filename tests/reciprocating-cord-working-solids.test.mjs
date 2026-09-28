import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {createAuthoredPumpDrillMovement as a} from '../src/simulation/authored-pump-drills.js';
import {createAuthoredTreadleEccentricDriveMovement as c} from '../src/simulation/authored-treadle-eccentric-drives.js';
import {createAuthoredGigSawMovement as e} from '../src/simulation/authored-gig-saws.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const meshes=o=>{const a=[];o.traverseVisible(c=>{if(c.isMesh)a.push(c)});return a;};
for(const[id,f]of[[359,a],[374,c],[392,e]]){
test(`${id} selected finite working surfaces stay clear through the cycle`,()=>{
 const m=f({id}),d=m.root.userData,b=d.blocks,pairs=[],bad={};let dynamic=[];
 if(id===359){dynamic=b.cordBranches.map(c=>c.userData.mesh);pairs.push(dynamic);for(const cord of dynamic)pairs.push([cord,b.spindle]);const sleeve=b.crossbar.children.find(o=>o.userData.role==='loose-crossbar-guide-hole-around-spindle');pairs.push([sleeve,b.spindle]);}
 if(id===374){for(const belt of[b.upperStraightRun,b.lowerStraightRun,b.eccentricWrap,b.rollerWrap])for(const pulley of[b.eccentricPulley,b.treadleRoller])pairs.push([belt,pulley.userData.workingGroove]);pairs.push([b.treadleBeam,b.pivotPost],[b.shaftBearing,b.shaftPin],[b.treadlePivotBearing,b.treadlePivotPin],[b.treadleBeam,b.treadlePivotPin],[b.treadleBeam,b.rollerAxle],[b.treadleRoller.userData.workingGroove,b.rollerAxle]);}
 if(id===392){for(const rail of b.guideRails)pairs.push([b.workingRod,rail]);pairs.push([b.workingRod,b.crankRotor.userData.crankPin],[b.workingRod,b.sawAssembly.userData.lowerWrist],[b.workingRod,b.crankRotor.userData.hub],[b.workingRod,b.sawAssembly.userData.lowerBlock],[b.workingJournal,b.workingShaft]);for(const o of[b.sawAssembly.userData.lowerBlock,b.sawAssembly.userData.upperBlock])for(const rail of b.guideRails)pairs.push([o,rail]);for(const o of[b.sawAssembly.userData.blade,...b.sawAssembly.userData.sawTeeth])for(const table of b.tableParts)if(o)pairs.push([o,table]);}
 const cache=new Map();for(let i=0;i<=16;i++){m.update((d.geometry.cyclePeriod??d.geometry.demonstrationPeriod??d.motion.inputCycleDuration)*i/16);m.root.updateMatrixWorld(true);dynamic.forEach(o=>cache.delete(o));const get=o=>{if(!cache.has(o))cache.set(o,{p:surfacePoints(o.geometry),s:solidSurface(o.geometry)});return cache.get(o);};for(const pair of pairs)for(const[v,f]of[pair,[...pair].reverse()]){const tr=f.matrixWorld.clone().invert().multiply(v.matrixWorld),s=get(f).s;for(const p of get(v).p){const world=p.clone().applyMatrix4(v.matrixWorld);if(id===359&&world.y>d.geometry.anchorY-d.geometry.connectorDrop-.05)continue;const q=p.clone().applyMatrix4(tr);if(s.box.distanceToPoint(q)>1e-6)continue;const gap=s.signedDistance(q,.04);if(gap<-2e-6){const key=`${v.userData.role||v.id}/${f.userData.role||f.id}`;if(gap<(bad[key]?.gap||0))bad[key]={i,gap,world:world.toArray()};}}}}
 assert.deepEqual(bad,{});
 });
}

const byRole=(root,name)=>{let result;root.traverse(o=>{if(o.userData.role===name)result=o});return result};
test('359 moving sleeve has a real spindle bore and rope buffers remain allocated',()=>{
 const m=a({id:359}),d=m.root.userData,b=d.blocks,sleeve=byRole(m.root,'loose-crossbar-guide-hole-around-spindle'),solid=solidSurface(sleeve.geometry);
 assert.ok(!solid.inside(new T.Vector3(0,0,0)));assert.ok(!solid.inside(new T.Vector3(d.geometry.spindleRadius-.04,0,0)));assert.ok(solid.inside(new T.Vector3(d.geometry.spindleRadius+.06,0,0)));
 const original=b.cordBranches.map(o=>o.userData.mesh.geometry);
 for(let i=0;i<=32;i++){m.update(i/4);b.cordBranches.forEach((o,j)=>assert.equal(o.userData.mesh.geometry,original[j]));assert.ok(Math.abs(d.currentState.leftCord.branchLength-d.geometry.branchLength)<1e-10);}
});
test('374 finite pulley channels have floors and retaining lips at the actual band depth',()=>{
 const m=c({id:374}),b=m.root.userData.blocks,g=m.root.userData.geometry;
 for(const [pulley,r]of[[b.eccentricPulley,g.eccentricPulleyRadius],[b.treadleRoller,g.treadleRollerRadius]]){
  const solid=solidSurface(pulley.userData.workingGroove.geometry);
  assert.ok(!solid.inside(new T.Vector3(r,0,0)),'nominal band point lies in channel');
  assert.ok(solid.inside(new T.Vector3(r-.055,0,0)),'floor has finite material');
  assert.ok(solid.inside(new T.Vector3(r,.075,0)),'side lip retains band');
 }
 // 374's shaft is Brown's large one (radius .26, bore .264).
 for(const [bearing,r]of[[b.shaftBearing,.264],[b.treadlePivotBearing,.079]]){const solid=solidSurface(bearing.geometry);assert.ok(!solid.inside(new T.Vector3(r-.003,0,0)));assert.ok(solid.inside(new T.Vector3(r+.015,0,0)));}
});
test('374 standards support journals without filling their bores',()=>{
 const m=c({id:374}),b=m.root.userData.blocks;m.update(0);m.root.updateMatrixWorld(true);
 for(const [post,bearing,r]of[[b.shaftPost,b.shaftBearing,.39],[b.pivotPost,b.treadlePivotBearing,.20]]){
  const point=new T.Vector3(bearing.position.x,bearing.position.y-r+.012,-.20);
  assert.ok(solidSurface(post.geometry).inside(post.worldToLocal(point.clone())));
  assert.ok(solidSurface(bearing.geometry).inside(bearing.worldToLocal(point.clone())));
 }
});
test('392 guide cheeks cover sliding block depth and finite rod bores receive both pins',()=>{
 const m=e({id:392}),d=m.root.userData,b=d.blocks,s=solidSurface(b.workingRod.geometry);
 assert.ok(!s.inside(new T.Vector3(0,0,0)));assert.ok(!s.inside(new T.Vector3(d.geometry.connectingRodLength,0,0)));assert.ok(s.inside(new T.Vector3(.16,0,0)));
 m.root.updateMatrixWorld(true);const rodBox=new T.Box3().setFromObject(b.workingRod);for(const pin of[b.crankRotor.userData.crankPin,b.sawAssembly.userData.lowerWrist]){const box=new T.Box3().setFromObject(pin);assert.ok(box.min.z<rodBox.min.z&&box.max.z>rodBox.max.z,'pin spans both faces of bored eye');}
 for(const rail of b.guideRails){assert.ok(Math.abs(rail.position.x)-.105/2>.32);assert.equal(rail.position.z,b.sawAssembly.position.z);}
 for(const table of b.tableParts){const box=new T.Box3().setFromObject(table);assert.ok(box.max.x<-.16||box.min.x>.16,'slot clears the actual saw tooth width');}
});
test('all three retain finite scene size, readable timing and explicitly bounded force claims',()=>{
 for(const [id,f]of[[359,a],[374,c],[392,e]]){
  const m=f({id}),count=meshes(m.root).length,geometries=new Set(meshes(m.root).map(o=>o.geometry));
  for(let i=0;i<=24;i++){m.update(i/2);assert.equal(meshes(m.root).length,count);for(const o of meshes(m.root))assert.ok(geometries.has(o.geometry));}
  assert.ok(m.root.userData.minimumDisplayCycleSeconds>=5);assert.equal(m.root.userData.hideGround,true);assert.match(m.root.userData.workingPartsReview.residual,/prescribed|not solved/);
 }
});
