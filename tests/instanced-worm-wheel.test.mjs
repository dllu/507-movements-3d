import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshBasicMaterial,Matrix4,Vector3,ObjectLoader} from 'three';
import {makeInstancedWormWheel} from '../src/simulation/instanced-worm-wheel.js';
import {solidSurface,surfaceTriangles} from './helpers/solid-surface.mjs';

test('instanced tooth sectors form a closed bored wheel and survive serialization',()=>{
 const p={teeth:22,depth:.3},cut={angularSteps:32,axialSteps:8,radii:[]};
 for(let j=0;j<=8;j++)for(let i=0;i<=32;i++)cut.radii.push(.75+.04*Math.cos(2*Math.PI*i/32)-.02*(1-(2*j/8-1)**2));
 const wheel=makeInstancedWormWheel(p,cut,.132,new MeshBasicMaterial()),solid=solidSurface(wheel.geometry),matrix=new Matrix4();
 try{
  const edges=new Map();let volume=0;
  for(const f of surfaceTriangles(wheel.geometry)){
   if(f.getArea()<1e-12)continue;
   volume+=f.a.dot(f.b.clone().cross(f.c))/6;
   const keys=[f.a,f.b,f.c].map(v=>v.toArray().map(x=>Math.round(x*1e6)).join(','));
   for(let j=0;j<3;j++){const a=keys[j],b=keys[(j+1)%3],key=[a,b].sort().join('/'),e=edges.get(key)??{count:0,direction:0};e.count++;e.direction+=a<b?1:-1;edges.set(key,e);}
  }
  assert.ok(volume>0);assert.equal([...edges.values()].filter(e=>e.count!==2||e.direction!==0).length,0);
  for(let k=0;k<22;k++){
   wheel.getMatrixAt(k,matrix);
   for(const z of [-.1,0,.1]){
    const local=new Vector3(.5,0,z),world=local.clone().applyMatrix4(matrix);
    assert.ok(Math.abs(Math.hypot(world.x,world.y)-.5)<1e-7);
    assert.equal(solid.inside(local),true);
    assert.equal(solid.inside(new Vector3(.13,0,z)),false);
   }
  }
  const restored=new ObjectLoader().parse(wheel.toJSON());
  assert.equal(restored.count,22);assert.deepEqual([...restored.instanceMatrix.array],[...wheel.instanceMatrix.array]);
  assert.equal(restored.geometry.attributes.position.count,wheel.geometry.attributes.position.count);
  restored.geometry.dispose();restored.material.dispose();
 }finally{wheel.geometry.dispose();wheel.material.dispose();}
});
