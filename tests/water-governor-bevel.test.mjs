import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {makeWaterGovernorBevels} from '../src/simulation/mujoco-water-governor/bevel-train.js';
test('162 bevel envelopes and loose-gear backing faces follow the source dimensions',()=>{
 const v=makeWaterGovernorBevels();try{
  const {parts,parameters:p}=v.root.userData;
  for(const name of ['upperInput','spindleDrive','upperLoose','lowerLoose','gateOutput']){
   const positions=parts[name+'Tooth0'].geometry.attributes.position;
   let outer=0;for(let i=0;i<positions.count;i++)outer=Math.max(outer,Math.hypot(positions.getX(i),positions.getY(i)));
   assert.ok(Math.abs(outer/.018-37)<.001);
   const body=parts[name+'Body'].geometry.attributes.position;
   let bore=Infinity;for(let i=0;i<body.count;i++)bore=Math.min(bore,Math.hypot(body.getX(i),body.getY(i)));
   assert.ok(Math.abs(bore-p.bore)<1e-7);
  }
  for(const [name,offset]of [['upperLoose',.468],['lowerLoose',.378]]){
   const positions=parts[name+'Body'].geometry.attributes.position;let toe=Infinity;
   for(let i=0;i<positions.count;i++)toe=Math.min(toe,positions.getZ(i));
   assert.ok(Math.abs(toe-offset)<1e-7,'stud root lies at the inner body face');
  }
  v.root.traverse(o=>{if(o.isMesh)assert.equal(o.material.fog,false);});
 }finally{v.dispose();}
});
test('162 all three perpendicular meshes have matching pitch velocities',()=>{
 const v=makeWaterGovernorBevels();try{
  const {blocks,parameters:p}=v.root.userData;
  const start=Object.fromEntries(Object.entries(blocks).map(([n,b])=>[n,b.rotation.z]));
  v.update({spindle:1,upper:1,lower:-1,output:1});
  const velocity=(name,point)=>new THREE.Vector3(0,0,blocks[name].rotation.z-start[name]).applyQuaternion(blocks[name].parent.quaternion).cross(point);
  for(const [a,b,sign]of [['upperInput','spindleDrive',1],['gateOutput','upperLoose',1],['gateOutput','lowerLoose',-1]]){
   const point=new THREE.Vector3(-p.pitchRadius,sign*p.pitchRadius,0);
   assert.ok(velocity(a,point).distanceTo(velocity(b,point))<1e-12);
  }
  v.update();for(const [name,b]of Object.entries(blocks))assert.equal(b.rotation.z,start[name]);
 }finally{v.dispose();}
});
