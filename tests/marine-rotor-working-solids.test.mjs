import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAuthoredCommonPaddleWheelMovement as paddle} from '../src/simulation/authored-common-paddle-wheels.js';
import {createAuthoredScrewPropellerMovement as screw} from '../src/simulation/authored-screw-propellers.js';
import {surfacePoints,solidSurface,surfaceTriangles} from './helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
for(const[id,create]of[[487,paddle],[488,screw]])test(`${id} finite rotor clears fixed bearings and supports over a full turn`,()=>{
 const m=create({id}),d=m.root.userData,b=d.blocks,pairs=[];
 const moving=id===487?[b.shaft,b.hub,...b.rims,...b.spokeAssemblies.flatMap(a=>[a.paddle,...a.spokes])]:[b.shaft,b.hub,...b.bladeAssemblies.map(a=>a.blade)];
 const fixed=id===487?[...b.bearings,...b.supportLegs,...b.baseRails]:[...b.bearings,...b.pedestals,b.base];
 for(const a of moving)for(const c of fixed)pairs.push([a,c]);
 const cache=new Map(),get=o=>{if(!cache.has(o))cache.set(o,{points:surfacePoints(o.geometry),surface:solidSurface(o.geometry)});return cache.get(o);};
 const bad={};try{for(let i=0;i<=32;i++){
  m.update(d.geometry.cycleDuration*(i+.17)/33);m.root.updateMatrixWorld(true);
  for(const[a,c]of pairs){if(!new T.Box3().setFromObject(a).intersectsBox(new T.Box3().setFromObject(c)))continue;
   for(const[v,f]of[[a,c],[c,a]]){const tr=f.matrixWorld.clone().invert().multiply(v.matrixWorld),surface=get(f).surface;
    for(const p of get(v).points){const q=p.clone().applyMatrix4(tr);if(surface.box.distanceToPoint(q)>.0001)continue;const gap=surface.signedDistance(q,.03);if(gap< -2e-6){const key=`${v.userData.role}/${f.userData.role}`;bad[key]=Math.min(bad[key]??0,gap);}}
   }
  }
 }assert.deepEqual(bad,{});}finally{disposeObject3D(m.root);}
});
test('488 blade is a closed outward-wound shell around its constant-lead midsurface',()=>{
 const m=screw({id:488}),d=m.root.userData,g=d.blocks.bladeAssemblies[0].blade.geometry,p=g.attributes.position;
 try{
  const count=g.userData.sourceVertexCount,surface=solidSurface(g),edges=new Map();let volume=0;
  const key=p=>p.toArray().map(x=>Math.round(x*1e6)).join(',');
  for(const triangle of surfaceTriangles(g)){
   volume+=triangle.a.dot(triangle.b.clone().cross(triangle.c))/6;
   for(const[a,b]of[[triangle.a,triangle.b],[triangle.b,triangle.c],[triangle.c,triangle.a]]){const ids=[key(a),key(b)].sort(),edge=ids.join('|');edges.set(edge,(edges.get(edge)??0)+1);}
  }
  assert.ok(volume>.03);assert.ok([...edges.values()].every(n=>n===2),'all physical mesh edges have two faces');
  for(let r=1;r<d.geometry.radialSegments;r+=5)for(let c=1;c<d.geometry.chordSegments;c+=3){
   const i=r*(d.geometry.chordSegments+1)+c,a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+count),mid=a.clone().add(b).multiplyScalar(.5),expected=d.bladeSurfacePointScene(r/d.geometry.radialSegments,-1+2*c/d.geometry.chordSegments);
   assert.ok(mid.distanceTo(expected)<2e-7);assert.ok(Math.abs(a.distanceTo(b)-.045)<2e-7);assert.equal(surface.inside(mid),true);
  }
 }finally{disposeObject3D(m.root);}
});
test('487 flat annular rims connect spokes to paddles and expose the face index',()=>{
 const m=paddle({id:487}),d=m.root.userData,b=d.blocks,g=d.geometry;try{
 for(const a of b.spokeAssemblies)for(const s of a.spokes){s.geometry.computeBoundingBox();assert.ok(s.geometry.boundingBox.max.x+s.position.x>g.paddleInnerRadiusSceneUnit+.1);}
 b.hub.geometry.computeBoundingBox();assert.ok(b.shaftIndex.position.z-.045/2>b.hub.geometry.boundingBox.max.y);
 for(const r of b.rims){assert.equal(r.geometry.type,'BufferGeometry');assert.ok(solidSurface(r.geometry).inside(new T.Vector3(g.rimPitchRadiusSceneUnit,0,0)));}
 }finally{disposeObject3D(m.root);}
});
for(const[id,create]of[[487,paddle],[488,screw]])test(`${id} readable playback preserves scene and GPU storage`,()=>{
 const m=create({id}),d=m.root.userData,objects=[];try{m.root.traverse(o=>objects.push([o,o.geometry,o.geometry?.attributes.position.array]));for(let i=0;i<100;i++)m.update(i*.13);
 const after=[];m.root.traverse(o=>after.push(o));assert.equal(after.length,objects.length);for(const[o,g,a]of objects){assert.equal(o.geometry,g);assert.equal(o.geometry?.attributes.position.array,a);}
 assert.equal(d.minimumDisplayCycleSeconds,4);assert.equal(d.hideGround,true);
 }finally{disposeObject3D(m.root);}
});
