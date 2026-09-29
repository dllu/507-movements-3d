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

test('161 lower bracket is one tapered casting round the spindle and the end eye is as deep as the rod',()=>{
 const v=makeBallGovernorSolids();
 try{
  const {parts}=v.root.userData;
  assert.equal(parts.lowerBearing,undefined,'no separate bearing drum perched on the bar');
  const support=parts.lowerSupport,box=new THREE.Box3().setFromObject(support);
  // Round boss concentric with the spindle: the bar sides (z = ±R) run tangentially into it.
  assert.ok(Math.abs(box.max.x-.28)<1e-3&&Math.abs(box.max.z-.28)<1e-3&&Math.abs(box.min.z+.28)<1e-3);
  const p=support.geometry.attributes.position;let boreMin=Infinity,endHeight=-Infinity,endLow=Infinity;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=Math.hypot(x,z);if(r>.05)boreMin=Math.min(boreMin,r);
   if(x<-2.3){endHeight=Math.max(endHeight,y);endLow=Math.min(endLow,y);}
  }
  assert.ok(Math.abs(boreMin-.106)<2e-3,'spindle bore');
  assert.ok(Math.abs(endHeight-endLow-.16)<2e-3&&box.max.y-box.min.y>.39,'tapers from boss depth to a thin end');
  const eye=new THREE.Box3().setFromObject(parts.spindleEndEye),spindle=new THREE.Box3().setFromObject(parts.spindle);
  assert.ok(eye.max.z-eye.min.z>=spindle.max.z-spindle.min.z-1e-6,'eye as thick as the rod');
 }finally{v.dispose();}
});
