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
    assert.ok(u.parts.springAnchorHead.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(s.upper[0],s.upper[1],.24))<1e-12);
    // p109: no peg at the treadle; the cord ends in a loop round the eye's
    // crown, in the eye's mid-plane, on the native eye's line of pull.
    assert.equal(u.parts.treadleAnchorHead,undefined);assert.equal(u.parts.treadleAnchorStem,undefined);
    const loop=new THREE.Box3().setFromObject(u.parts.treadleCordLoop,true),curve=u.bandCurve,end=curve.getPoint(1);
    assert.ok(Math.abs(end.z)<1e-12&&Math.abs(loop.min.z+loop.max.z)<1e-3,'cord end and loop in the treadle plane');
    assert.ok(loop.containsPoint(end)&&Math.hypot(end.x-s.lower[0],end.y-s.lower[1])<.48,'cord ends in the loop above the eye');
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
