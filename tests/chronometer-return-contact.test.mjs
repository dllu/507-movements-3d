import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAuthoredFreeEscapementMovement as create} from '../src/simulation/authored-free-escapements.js';
import {surfaceTriangles} from './helpers/solid-surface.mjs';
import {makeChronometerPassingStudy} from '../src/simulation/mujoco-chronometer-passing/physics.js';
import loadMujoco from '@mujoco/mujoco';

test('313 preserves the whole active pallet face inside the locked wheel clearance circle',()=>{
  const m=create({id:313}),d=m.root.userData,g=d.geometry,b=d.blocks;m.update(0);m.root.updateMatrixWorld(true);
  let wheelDistance=Infinity;
  const center=new THREE.Vector3(g.balanceCenter.x,g.balanceCenter.y,0);
  for(const tooth of b.escapeTeeth)for(const triangle of surfaceTriangles(tooth.geometry)){
    const p=[triangle.a,triangle.b,triangle.c].map(p=>p.clone().applyMatrix4(tooth.matrixWorld).setZ(0));
    for(let i=0;i<3;i++)wheelDistance=Math.min(wheelDistance,new THREE.Line3(p[i],p[(i+1)%3]).closestPointToPoint(center,true,new THREE.Vector3()).distanceTo(center));
  }
  let outer=0;const positions=b.impulsePalletBody.geometry.attributes.position;
  for(let i=0;i<positions.count;i++)outer=Math.max(outer,Math.hypot(positions.getX(i),positions.getY(i)));
  assert.ok(wheelDistance-outer>.01,`locked whole-wheel radial clearance ${wheelDistance-outer}`);
  for(let i=0;i<=512;i++){
    const s=d.contactGeometryAtPhase(g.impulseStartPhase+(g.impulseEndPhase-g.impulseStartPhase)*i/512);
    assert.ok(s.palletRadius<g.palletOuterRadius-.0199999);
    assert.ok(s.palletRadius>g.palletInnerRadius+.0599999);
  }
  const direction=new THREE.Vector2(Math.cos(g.impulsePalletLocalAngle),Math.sin(g.impulsePalletLocalAngle));
  let low=Infinity,high=-Infinity;for(let i=0;i<positions.count;i++){
    const normal=-direction.y*positions.getX(i)+direction.x*positions.getY(i);low=Math.min(low,normal);high=Math.max(high,normal);
  }
  assert.ok(Math.abs(high-low-.15)<1e-6,'full transverse jewel thickness is retained');
});

test('313 reduced native passing study is passive and disappears when contact is disabled',async()=>{
  const mujoco=await loadMujoco();
  for(const contact of[false,true]){
    const p=makeChronometerPassingStudy(mujoco,{contact});let lift=0,flex=0;
    try{assert.equal(p.model.nu,0);for(let i=0;i<16000;i++){p.step();lift=Math.max(lift,p.data.qpos[0]);flex=Math.max(flex,p.data.qpos[1]);}
      if(contact){assert.ok(lift>.12);assert.ok(flex>.4);}else{assert.equal(lift,0);assert.equal(flex,0);}
    }finally{p.dispose();}
  }
});
