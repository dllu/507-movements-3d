import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeSpringTreadleSolids} from '../src/simulation/mujoco-spring-return-treadle/solids.js';
import {makeSpringTreadlePhysics} from '../src/simulation/mujoco-spring-return-treadle/coupled-physics.js';

test('160 visible assembly follows native attachments and keeps the treadle above its floor',async()=>{
 const p=makeSpringTreadlePhysics(await loadMujoco()),v=makeSpringTreadleSolids(),u=v.root.userData,geometry=u.parts.leaf.geometry;
 try{
  assert.equal(u.parts.treadle.geometry.userData.plate.polygons.length,1,'Treadle must be one connected casting');
  for(let tick=0;tick<=32000;tick++){
   if(tick%250===0){const s=p.state();v.update(s);
    for(const [name,point,z] of [['springAnchorHead',s.upper,.24],['treadleAnchorHead',s.lower,.72]])assert.ok(u.parts[name].getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(point[0],point[1],z))<1e-12);
    assert.ok(new THREE.Box3().setFromObject(u.parts.treadle,true).min.y>-3.726);
    assert.equal(u.parts.leaf.geometry,geometry);assert.ok(geometry.attributes.position.array.every(Number.isFinite));
   }
   if(tick<32000)p.step();
  }
  const pos=geometry.attributes.position,index=geometry.index;let volume=0;
  for(let i=0;i<index.count;i+=3){const [a,b,c]=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(pos,index.getX(i+j)));volume+=a.dot(b.cross(c))/6;}
  assert.ok(volume>.1,'Spring faces must enclose positive oriented volume');
  v.root.traverse(o=>{if(o.material)assert.equal(o.material.fog,false);});assert.equal(u.hideGround,true);
 }finally{v.dispose();p.dispose();}
});
