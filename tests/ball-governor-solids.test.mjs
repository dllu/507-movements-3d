import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeBallGovernorPhysics} from '../src/simulation/mujoco-ball-governor/physics.js';
import {makeBallGovernorSolids} from '../src/simulation/mujoco-ball-governor/solids.js';

test('161 visible eyes and pins follow native hinges through the complete speed cycle',async()=>{
 const m=await loadMujoco(),p=makeBallGovernorPhysics(m),v=makeBallGovernorSolids();
 try{
  const {blocks,parts}=v.root.userData,g=p.geometry;
  const point=(block,position)=>block.localToWorld(new THREE.Vector3(...position));
  for(let tick=0;tick<=16000;tick++){
   if(tick%100===0){
    const s=p.state();v.update(s);
    for(const name of ['left','right']){
     const sign=name==='left'?-1:1,upper=blocks[name+'Upper'],lower=blocks[name+'Lower'];
     assert.ok(point(upper,[0,0,0]).distanceTo(parts[name+'TopPin'].getWorldPosition(new THREE.Vector3()))<1e-10);
     assert.ok(point(upper,[0,-g.elbowArm,0]).distanceTo(point(lower,[0,0,0]))<1e-10);
     assert.ok(point(lower,[0,-g.lowerLink,0]).distanceTo(point(blocks.sleeve,[sign*g.sleeveRadius,0,0]))<1e-5);
     const ball=point(upper,[0,-g.ballArm,0]);
     assert.ok(Math.abs(Math.hypot(ball.x,ball.z)-(g.pivotRadius+g.ballArm*Math.sin(s[name+'Spread'])))<1e-10);
    }
    assert.equal(blocks.output.rotation.y,0,'fork does not rotate with the spindle');
    assert.equal(blocks.output.position.y,s.sleeveY);
   }
   if(tick<16000)p.step();
  }
  v.root.traverse(o=>{if(o.isMesh)assert.equal(o.material.fog,false);});
 }finally{v.dispose();p.dispose();}
});
