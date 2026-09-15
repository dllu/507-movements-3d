import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeOpposedScrewNuts,opposedScrewState,opposedScrewDimensions as g} from '../src/simulation/opposed-screw-nuts.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

test('151 candidate puts wheel on screw axis and upper worm into the page',()=>{
 const v=makeOpposedScrewNuts();try{
  const b=v.root.userData.blocks;
  const axis=(body,a)=>a.transformDirection(body.matrixWorld);
  assert.ok(axis(b.wheel,new THREE.Vector3(0,0,1)).distanceTo(new THREE.Vector3(1,0,0))<1e-12);
  assert.ok(axis(b.worm,new THREE.Vector3(1,0,0)).distanceTo(new THREE.Vector3(0,0,-1))<1e-12);
  assert.equal(v.root.userData.geometry.wheelRadius,1.302);
  assert.ok(Math.abs(v.root.userData.geometry.wormAxisY-(268-152)*.014)<.10);
 }finally{v.dispose();}
});
test('151 opposite threads keep nuts symmetric about their original midpoint',()=>{
 for(let i=0;i<=600;i++){
  const s=opposedScrewState(i/10);assert.ok(Math.abs(s.nutX[0]+s.nutX[1]-g.sourceNutX[0]-g.sourceNutX[1])<1e-12);
  assert.ok(Math.abs(s.wormAngle-18*s.wheelAngle)<1e-12);
  for(let j=0;j<2;j++)assert.ok(Math.abs(s.nutX[j]-g.sourceNutX[j]+(j===0?1:-1)*g.pitch*s.wheelAngle/(2*Math.PI))<1e-12);
 }
 assert.deepEqual(opposedScrewState(0),opposedScrewState(60));
 const speed=Math.abs(opposedScrewState(13.501).wormAngle-opposedScrewState(13.5).wormAngle)/.001;
 assert.ok(speed<2*Math.PI*1.26);
});
test('151 rendered square threads clear their nut threads through a complete screw turn',()=>{
 const v=makeOpposedScrewNuts();try{
  const parts=v.root.userData.parts;
  for(let side=0;side<2;side++){
   const meshes=[parts[`external-thread-${side}`],parts[`internal-thread-${side}`]],data=meshes.map(mesh=>({mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
   for(let pose=0;pose<=8;pose++){
    v.update(27*pose/8);
    for(const [a,b] of [[data[0],data[1]],[data[1],data[0]]]){
     const transform=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
     for(const p of a.points){const q=p.clone().applyMatrix4(transform);assert.ok(!b.solid.inside(q)||b.solid.distance(q)<1e-6,`thread intersection at side ${side}, pose ${pose}`);}
    }
   }
  }
 }finally{v.dispose();}
});
