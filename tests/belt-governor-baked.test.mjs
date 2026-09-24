import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeBeltGovernorPhysics} from '../src/simulation/mujoco-belt-governor/physics.js';
import {makeBeltGovernorModel} from '../src/simulation/baked/belt-governor.js';
const bundle=JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/163.json.gz')));
test('163 serialized bake follows native balls and fork after the free spindle phase alignment',async()=>{
 const m=await loadMujoco(),p=makeBeltGovernorPhysics(m,bundle.parameters),v=makeBeltGovernorModel(bundle);let maximum=0;
 try{
  const start=bundle.initialState,w=p.description.nominalSpeed,A=p.description.speedAmplitude,k=2*Math.PI/bundle.period;
  p.data.qpos.set(start.qpos);p.data.qvel.set(start.qvel);p.data.time=start.time;p.data.ctrl[0]=w*start.time+A*(1-Math.cos(k*start.time))/k+.01*(w+A*Math.sin(k*start.time));m.mj_forward(p.model,p.data);
  const pairs=[['leftBall','mjOBJ_GEOM','left-ball',true],['rightBall','mjOBJ_GEOM','right-ball',true],['forkPin','mjOBJ_SITE','fork-end',false]].map(([name,type,n,rotate])=>({mesh:v.root.getObjectByName(name),id:p.id(type,n),type,rotate}));
  const ticks=Math.round(bundle.period/p.timestep);
  for(let tick=0;tick<=ticks;tick++){
   if(tick%16===0||tick===ticks){p.state();v.update(tick*p.timestep);for(const {mesh,id,type,rotate}of pairs){const positions=type==='mjOBJ_GEOM'?p.data.geom_xpos:p.data.site_xpos,expected=new THREE.Vector3(...positions.slice(3*id,3*id+3));if(rotate)expected.applyAxisAngle(new THREE.Vector3(0,1,0),-bundle.offsets[0]);maximum=Math.max(maximum,expected.distanceTo(mesh.getWorldPosition(new THREE.Vector3())));}}
   if(tick<ticks)p.step();
  }
  console.log({maximumNativePointDifference:maximum});assert.ok(maximum<.00003);
 }finally{v.dispose();p.dispose();}
});
test('163 bake keeps native travel, repeat belt marks, bounds and exact restart',()=>{
 const v=makeBeltGovernorModel(bundle);try{
  let meshes=0;v.root.traverse(o=>{if(o.isMesh){meshes++;assert.equal(o.material.fog,false);}});assert.equal(meshes,51);for(const name of ['flatBelt','upperPulley','middlePulley','lowerPulley'])assert.equal(v.root.getObjectByName(name).receiveShadow,false);assert.ok(bundle.positionClosure<1e-6);assert.ok(bundle.velocityClosure<1e-6);
  assert.ok(Math.abs(bundle.turns[12]/bundle.beltSeamSpacing-Math.round(bundle.turns[12]/bundle.beltSeamSpacing))<1e-12);
  const initial=JSON.stringify(v.root.userData.state),snapshot=()=>{v.root.updateMatrixWorld(true);const a=[];v.root.traverse(o=>{if(o.isMesh&&o.name!=='middlePulley')a.push(...o.matrixWorld.elements);});return a;};
  v.update(.371*bundle.period);const first=snapshot();v.update(100.371*bundle.period);const repeat=snapshot();assert.ok(Math.max(...first.map((x,i)=>Math.abs(x-repeat[i])))<1e-9);
  for(let i=0;i<129;i++){v.update(bundle.period*(i+.273)/129);assert.ok(v.root.userData.cameraFitBounds.containsBox(new THREE.Box3().setFromObject(v.root,true)));}
  const seamState=()=>{const rigid=[],marks=[];v.root.traverse(o=>{if(o.name.startsWith('beltSeam')){if(o.visible)marks.push(o.getWorldPosition(new THREE.Vector3()));}else if(o.isMesh)rigid.push(...o.matrixWorld.elements);});return{rigid,marks};};
  v.update(bundle.period-1e-8);const before=seamState();v.update(bundle.period+1e-8);const after=seamState();assert.ok(Math.max(...before.rigid.map((x,i)=>Math.abs(x-after.rigid[i])))<1e-6);
  for(const point of before.marks.filter(p=>p.x<4.47))assert.ok(after.marks.some(p=>p.distanceTo(point)<1e-6),'interior seam pattern remains continuous; new marks enter at the cut ends');
  v.reset();assert.equal(JSON.stringify(v.root.userData.state),initial);
 }finally{v.dispose();}
});

test('163 serialized geometry and world transforms match the clearance-audited source solids',async()=>{
 const {makeBeltGovernorSolids}=await import('../src/simulation/mujoco-belt-governor/solids.js');
 const {beltGovernorState}=await import('../src/simulation/mujoco-belt-governor/kinematics.js');
 const {sampleBakedMotion}=await import('../src/simulation/baked/playback.js');
 const original=makeBeltGovernorSolids({beltSeamSpacing:bundle.beltSeamSpacing}),baked=makeBeltGovernorModel(bundle);
 try{
  const time=.371*bundle.period;original.update(beltGovernorState(sampleBakedMotion(bundle,time),bundle.geometry));baked.update(time);
  for(const [name,mesh]of Object.entries(original.root.userData.parts)){
   const actual=baked.root.getObjectByName(name);assert.ok(actual,name);const actualPositions=actual.geometry.attributes.position.array,expectedPositions=mesh.geometry.attributes.position.array;assert.equal(actualPositions.length,expectedPositions.length);assert.ok(actualPositions.every((x,i)=>x===expectedPositions[i]),name+' positions (JSON normalizes signed zero)');assert.deepEqual(actual.geometry.index?.array,mesh.geometry.index?.array,name+' triangles');assert.equal(actual.visible,mesh.visible);
   assert.ok(Math.max(...actual.matrixWorld.elements.map((x,i)=>Math.abs(x-mesh.matrixWorld.elements[i])))<1e-12,name+' transform');
  }
 }finally{original.dispose();baked.dispose();}
});
