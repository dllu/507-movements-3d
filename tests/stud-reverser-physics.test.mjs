import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeStudReverserPhysics} from '../src/simulation/mujoco-stud-reverser/physics.js';
const mujoco=await loadMujoco();
test('153 prototype has one driven disk and passive bar and elbow coordinates',()=>{
 const p=makeStudReverserPhysics(mujoco);try{assert.equal(p.model.nq,3);assert.equal(p.model.nu,1);for(let i=0;i<4800;i++)p.step();assert.ok(p.data.qpos[1]>.5);assert.ok(Array.from(p.data.qfrc_applied).every(x=>x===0));}finally{p.dispose();}
});
test('153 bar stays stationary when stud contact is removed',()=>{
 const p=makeStudReverserPhysics(mujoco,{contact:false,gravity:0});try{const q=Array.from(p.data.qpos);for(let i=0;i<4800;i++)p.step();assert.ok(Math.abs(p.data.qpos[0]-q[0])>.5);assert.ok(Math.abs(p.data.qpos[1]-q[1])<1e-12);assert.ok(Math.abs(p.data.qpos[2]-q[2])<1e-12);}finally{p.dispose();}
});
test('153 flat L sustains passive reciprocation without a prescribed reset, returning the bar within the studs\' reach',async()=>{
 const {FLAT_INPUT_ARM}=await import('../src/simulation/mujoco-stud-reverser/geometry.js');
 const p=makeStudReverserPhysics(mujoco,{...FLAT_INPUT_ARM,barFriction:2});
 try{assert.deepEqual(Array.from(p.model.jnt_range).slice(4,6),[0,0]);assert.equal(p.model.geom_bodyid[p.id('mjOBJ_GEOM','lever-rest-stop')],0);let low=Infinity,high=-Infinity;const periodTicks=Math.round(p.description.period/p.timestep),ends=[];
  for(let i=1;i<=periodTicks*3;i++){p.step();if(i>periodTicks*2){low=Math.min(low,p.data.qpos[1]);high=Math.max(high,p.data.qpos[1]);}if(i%periodTicks===0)ends.push(Array.from(p.data.qpos));}
  // The flat lever throws the bar 0.62 left of Brown's pose (the next stud still meets the lug down to about -0.9).
  assert.ok(low>-.7&&low<-.55,String(low));assert.ok(high>1&&high<1.05);assert.ok(Math.abs(ends[2][1]-ends[1][1])<.001);assert.ok(Math.abs(ends[2][2]-ends[1][2])<1e-5);
  assert.ok(Math.abs(ends[2][1])<.002,'each cycle ends at the drawn bar pose');
 }finally{p.dispose();}
});
test('153 elbow boss is lever-coloured with its pin in the eye, and the return arm has plate width',async()=>{
 const THREE=await import('three');const {makeRelievedStudReverser}=await import('../src/simulation/mujoco-stud-reverser/geometry.js');
 const v=makeRelievedStudReverser({inputContactMinimum:1.4}),b=v.root.userData.blocks,g=v.root.userData.geometry;
 try{
  assert.equal(b.leverPivotCollar.material,b.inputArm.userData.blocks.working.material);
  const pin=b.fixedFrame.getObjectByName('fixed-elbow-pivot-pin');assert.ok(pin);pin.geometry.computeBoundingBox();
  assert.ok(pin.geometry.boundingBox.max.z>g.leverPlaneZ+.36,'pin reaches the boss face');
  const arm=b.outputArm.userData.blocks.body.geometry;arm.computeBoundingBox();
  // Working (+y) edge unchanged at the old half-width; idle edge widened to about 0.31 total at the eye.
  assert.ok(Math.abs(arm.boundingBox.max.y-g.leverOutputHalfWidth)<1e-3);
  assert.ok(arm.boundingBox.max.y-arm.boundingBox.min.y>.3);
  assert.ok(Math.abs(arm.boundingBox.max.x-(g.leverOutputLength+g.leverOutputHalfWidth))<5e-3);
 }finally{v.dispose();}
});
test('153 L lever is flat: one input-arm extrusion in the stud plane, shortened and rounded concentric with its end',async()=>{
 const THREE=await import('three');const {makeRelievedStudReverser,FLAT_INPUT_ARM}=await import('../src/simulation/mujoco-stud-reverser/geometry.js');
 const v=makeRelievedStudReverser(),b=v.root.userData.blocks,g=v.root.userData.geometry;
 try{
  v.root.updateMatrixWorld(true);const box=o=>new THREE.Box3().setFromObject(o);
  assert.equal(b.inputArm.children.length,1);assert.equal(b.inputArm.userData.blocks.raised,undefined);
  const arm=b.inputArm.userData.blocks.working,work=box(arm);
  const pinEnd=Math.max(...b.pinAssemblies.map(a=>box(a.userData.blocks.pin).max.z)),pinStart=Math.min(...b.pinAssemblies.map(a=>box(a.userData.blocks.pin).min.z));
  assert.ok(pinEnd-work.min.z>=.06&&pinStart<work.min.z,'studs reach into the arm plane');
  const z=new Set();const p=arm.geometry.attributes.position;for(let i=0;i<p.count;i++)z.add(p.getZ(i).toFixed(5));assert.equal(z.size,2,'one flat extrusion');
  assert.equal(g.leverInputLength,FLAT_INPUT_ARM.flatInputLength);assert.ok(g.leverInputLength<1.667);
  const L=g.leverInputLength,h=g.leverInputHalfWidth;let tip=0;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);if(x>L+1e-6){tip++;assert.ok(Math.abs(Math.hypot(x-L,y)-h)<2e-3);}}
  assert.ok(tip>10);assert.ok(Math.abs(b.inputArm.rotation.z-FLAT_INPUT_ARM.inputAngleOffset)<1e-12);
 }finally{v.dispose();}
});
