import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeWaterGovernorPhysics} from '../src/simulation/mujoco-water-governor/physics.js';
import {makeWaterGovernorSolids} from '../src/simulation/mujoco-water-governor/solids.js';
test('162 visible hinges and selector working faces track native coordinates',async()=>{
 const p=makeWaterGovernorPhysics(await loadMujoco()),v=makeWaterGovernorSolids();
 try{
  const {blocks,parts}=v.root.userData,g=p.geometry;
  const point=(block,xyz)=>block.localToWorld(new THREE.Vector3(...xyz));
  const nativeCenter=name=>new THREE.Vector3(...p.data.geom_xpos.slice(3*p.id('mjOBJ_GEOM',name),3*p.id('mjOBJ_GEOM',name)+3));
  for(let tick=0;tick<=16000;tick++){
   if(tick%50===0){
    const s=p.state();v.update(s);
    for(const name of ['left','right']){
     const sign=name==='left'?-1:1;
     assert.ok(point(blocks[name+'Upper'],[0,0,0]).distanceTo(parts[name+'HeadPin'].getWorldPosition(new THREE.Vector3()))<1e-10);
     assert.ok(point(blocks[name+'Upper'],[0,-g.elbowArm,0]).distanceTo(point(blocks[name+'Lower'],[0,0,0]))<1e-10);
     assert.ok(point(blocks[name+'Lower'],[0,-g.lowerLink,0]).distanceTo(point(blocks.sleeve,[sign*g.sleeveRadius,0,0]))<1e-5);
    }
    assert.ok(parts.selectorPin.getWorldPosition(new THREE.Vector3()).distanceTo(nativeCenter('selector-pin'))<1e-10);
    for(const [name,sign,half]of [['upper',-1,.117],['lower',1,.153]]){
     const mesh=parts[name+'Stud'],tip=point(mesh,[0,sign*mesh.geometry.parameters.height/2,0]),native=nativeCenter(name+'-stud');native.y+=sign*half;
     assert.ok(tip.distanceTo(native)<1e-10,'stud working face matches native contact');
    }
   }
   if(tick<16000)p.step();
  }
  v.root.traverse(o=>{if(o.isMesh)assert.equal(o.material.fog,false);});
 }finally{v.dispose();p.dispose();}
});
