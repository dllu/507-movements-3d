import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeBeltGovernorPhysics} from '../src/simulation/mujoco-belt-governor/physics.js';
import {makeBeltGovernorSolids} from '../src/simulation/mujoco-belt-governor/solids.js';

test('163 visible fork, rod, groove shoes and balls follow the native joints',async()=>{
 const p=makeBeltGovernorPhysics(await loadMujoco(),{speedAmplitude:.25}),v=makeBeltGovernorSolids(),g=p.geometry;
 try{
  const parts=v.root.userData.parts;assert.equal(Object.keys(parts).length,43);
  v.root.traverse(o=>{if(o.isMesh)assert.equal(o.material.fog,false);});assert.equal(v.root.userData.hideGround,true);
  const sites=['bell-follower','rod-end','fork-end'].map(n=>p.id('mjOBJ_SITE',n));
  for(let tick=0;tick<=40000;tick++){
   if(tick%400===0){const s=p.state();v.update(s);
    for(const sign of [-1,1]){
     const name=sign<0?'left':'right',ball=p.id('mjOBJ_GEOM',name+'-ball');
     assert.ok(parts[name+'Ball'].getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(...p.data.geom_xpos.slice(3*ball,3*ball+3)))<1e-10);
     const tip=parts['grooveTip'+sign].getWorldPosition(new THREE.Vector3());
     assert.ok(tip.distanceTo(new THREE.Vector3(...p.data.site_xpos.slice(3*sites[0],3*sites[0]+3)))<1e-10);
    }
    const fork=parts.forkPin.getWorldPosition(new THREE.Vector3()),nativeFork=new THREE.Vector3(...p.data.site_xpos.slice(3*sites[2],3*sites[2]+3));assert.ok(fork.distanceTo(nativeFork)<1e-10);
    const rod=v.root.getObjectByName('body:rod').localToWorld(new THREE.Vector3(0,-g.rodLength,0));assert.ok(rod.distanceTo(new THREE.Vector3(...p.data.site_xpos.slice(3*sites[1],3*sites[1]+3)))<1e-10);
    assert.ok(Math.abs(v.root.getObjectByName('body:belt').position.y-s.forkY)<1e-12);
    assert.ok(Math.abs(v.root.getObjectByName('body:shoe').position.x-s.followerX)<1e-12);
   }
   if(tick<40000)p.step();
  }
 }finally{p.dispose();v.dispose();}
});
