import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeWaterGovernorModel} from '../src/simulation/baked/water-governor.js';
import {makeWaterGovernorPhysics} from '../src/simulation/mujoco-water-governor/physics.js';
const bundle=JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/162.json.gz')));
test('162 serialized adaptive bake follows native ball and pin positions, including the numerical seam correction',async()=>{
 const m=await loadMujoco(),p=makeWaterGovernorPhysics(m,bundle.parameters),v=makeWaterGovernorModel(bundle);let maximum=0;
 try{
  const start=bundle.initialState,k=2*Math.PI/bundle.period,w=p.description.nominalSpeed,A=p.description.speedAmplitude;
  p.data.qpos.set(start.qpos);p.data.qvel.set(start.qvel);p.data.time=start.time;
  p.data.ctrl[0]=w*start.time+A*(1-Math.cos(k*start.time))/k+.01*(w+A*Math.sin(k*start.time));m.mj_forward(p.model,p.data);
  const pairs=[['leftBall','left-ball'],['rightBall','right-ball'],['selectorPin','selector-pin']].map(([mesh,name])=>[v.root.getObjectByName(mesh),p.id('mjOBJ_GEOM',name)]);
  const ticks=Math.round(bundle.loopEnd/p.timestep);
  for(let tick=0;tick<=ticks;tick++){
   if(tick%16===0||tick===ticks){p.state();v.update(tick*p.timestep);
    for(const [mesh,id]of pairs){const actual=new THREE.Vector3(...p.data.geom_xpos.slice(3*id,3*id+3));maximum=Math.max(maximum,mesh.getWorldPosition(new THREE.Vector3()).distanceTo(actual));}
   }
   if(tick<ticks)p.step();
  }
  console.log({maximumNativePointDifference:maximum});assert.ok(maximum<.0001);
 }finally{v.dispose();p.dispose();}
});
test('162 instanced teeth, repeat phase, bounds and exact restart survive many cycles',()=>{
 const v=makeWaterGovernorModel(bundle);try{
  let meshes=0,instances=0;v.root.traverse(o=>{if(o.isMesh){meshes++;assert.equal(o.material.fog,false);}if(o.isInstancedMesh){instances++;assert.equal(o.count,30);}});
  // Two horizontal gears each carry a bore sleeve and Brown's back hub, keyed to their shafts.
  assert.equal(meshes,40);assert.equal(instances,5);
  for(const [gear,shaft]of [['upperInput','inputShaft'],['gateOutput','outputShaft']])for(const part of ['Sleeve','Hub']){
   const mesh=v.root.getObjectByName(gear+part);assert.equal(mesh.parent.name,'body:'+shaft,'the hub turns with its shaft');
   const p=mesh.geometry.attributes.position;let inner=Infinity;for(let i=0;i<p.count;i++)inner=Math.min(inner,Math.hypot(p.getY(i),p.getZ(i)));
   assert.ok(Math.abs(inner-.10)<.002,'the hub bore fits the .10 shaft');
  }
  const initial=JSON.stringify(v.root.userData.state);
  const snapshot=()=>{v.root.updateMatrixWorld(true);const matrices=[];v.root.traverse(o=>{if(o.isMesh)matrices.push(...o.matrixWorld.elements);});return matrices;};
  const t=bundle.loopStart+.41*bundle.period;v.update(t);const reference=snapshot();v.update(t+100*bundle.period);const repeated=snapshot();assert.ok(Math.max(...reference.map((x,i)=>Math.abs(x-repeated[i])))<1e-9);
  for(let i=0;i<129;i++){v.update(bundle.loopEnd*(i+.371)/129);assert.ok(v.root.userData.cameraFitBounds.containsBox(new THREE.Box3().setFromObject(v.root,true)));}
  v.update(bundle.loopEnd-1e-8);const before=snapshot();v.update(bundle.loopEnd+1e-8);const after=snapshot();assert.ok(Math.max(...before.map((x,i)=>Math.abs(x-after[i])))<1e-6);
  v.reset();assert.equal(JSON.stringify(v.root.userData.state),initial);
 }finally{v.dispose();}
});

test('162 serialized instanced teeth preserve the audited visible geometry',async()=>{
 const {makeWaterGovernorSolids}=await import('../src/simulation/mujoco-water-governor/solids.js');
 const {waterGovernorState}=await import('../src/simulation/mujoco-water-governor/kinematics.js');
 const {sampleBakedMotion}=await import('../src/simulation/baked/playback.js');
 const original=makeWaterGovernorSolids(),baked=makeWaterGovernorModel(bundle);
 try{
  const time=bundle.loopEnd*.371;original.update(waterGovernorState(sampleBakedMotion(bundle,time),bundle.geometry));baked.update(time);
  for(const name of ['upperInput','spindleDrive','upperLoose','lowerLoose','gateOutput']){
   const instances=baked.root.getObjectByName(name+'Teeth');
   assert.deepEqual(instances.geometry.attributes.position.array,original.root.getObjectByName(name+'Tooth0').geometry.attributes.position.array);
   for(let i=0;i<30;i++){
    const matrix=new THREE.Matrix4();instances.getMatrixAt(i,matrix);matrix.premultiply(instances.matrixWorld);
    const expected=original.root.getObjectByName(name+'Tooth'+i).matrixWorld;
    assert.ok(Math.max(...matrix.elements.map((x,j)=>Math.abs(x-expected.elements[j])))<1e-7,'only Float32 instance-matrix rounding is permitted');
   }
  }
 }finally{original.dispose();baked.dispose();}
});
