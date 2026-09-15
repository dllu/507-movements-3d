import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeCurveTubeBuffer} from '../src/simulation/curve-tube-buffer.js';
import {ReturnBandRoute} from '../src/simulation/mujoco-spring-return-treadle/band-route.js';
import {AxiallySeparatedBand} from '../src/simulation/axially-separated-band.js';
test('reusable band tube retains radius, normal direction and storage through motion',()=>{
 const tube=makeCurveTubeBuffer({segments:192,sides:8}),p=tube.geometry.attributes.position,n=tube.geometry.attributes.normal,array=p.array;
 try{for(let pose=0;pose<33;pose++){
  const curve=new AxiallySeparatedBand(new ReturnBandRoute([.774+.05*Math.sin(pose/32*Math.PI),2.664-.38*Math.sin(pose/32*Math.PI)],[.738,-2.322-.38*Math.sin(pose/32*Math.PI)]),{startZ:.24,endZ:.72});tube.update(curve);assert.equal(p.array,array);
  for(let i=0;i<=192;i++)for(let j=0;j<8;j++){
   const k=i*8+j,center=curve.getPointAt(i/192),point=new THREE.Vector3().fromBufferAttribute(p,k),normal=new THREE.Vector3().fromBufferAttribute(n,k),tangent=curve.getTangentAt(i/192);
   assert.ok(Math.abs(point.distanceTo(center)-.048)<5e-7);assert.ok(Math.abs(normal.length()-1)<1e-6);assert.ok(Math.abs(normal.dot(tangent))<1e-6);assert.ok(point.sub(center).dot(normal)>.04799);
  }
  assert.ok(tube.geometry.boundingBox.containsBox(new THREE.Box3().setFromBufferAttribute(p)));
 }}finally{tube.geometry.dispose();}
});
