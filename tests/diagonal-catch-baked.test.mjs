import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {makeBakedDiagonalCatchModel} from '../src/simulation/baked/diagonal-catch.js';
import {createDiagonalContactProjector} from '../src/simulation/mujoco-diagonal-catch/project-contact.js';

const bundle=JSON.parse(gunzipSync(fs.readFileSync(new URL('../src/simulation/baked/assets/181.json.gz',import.meta.url))));
const snapshot=model=>Object.values(model.root.userData.parts).flatMap(p=>p.matrixWorld.elements);
for(const id of [181,182])test(`${id} baked assembly repeats, retains its weight joints and sections the rod`,()=>{
 const model=makeBakedDiagonalCatchModel(bundle,id),root=model.root,u=root.userData;
 try{
  const initial=snapshot(model),section=root.getObjectByName('sectioned-piston-rod'),rodBounds=new THREE.Box3().setFromObject(section);
  for(let i=0;i<=360;i++){
   model.update(i/20);assert.ok(snapshot(model).every(Number.isFinite));
   assert.deepEqual(new THREE.Box3().setFromObject(section).min.toArray(),rodBounds.min.toArray());
   for(const name of ['upperWeight','lowerWeight','catchWeight']){
    const anchor=root.getObjectByName('anchor:'+name).getWorldPosition(new THREE.Vector3());
    const weight=root.getObjectByName('body:'+name).getWorldPosition(new THREE.Vector3());
    assert.ok(Math.hypot(anchor.x-weight.x,anchor.y-weight.y)<1e-12,'weight eye remains on its pin');
    assert.ok(Math.abs(weight.z-anchor.z-.24)<1e-12);
   }
  }
  assert.deepEqual(snapshot(model),initial);
  model.update(13.57);model.reset();assert.deepEqual(snapshot(model),initial);
  const bottom=u.stateAtTime(id===181?17.1:8.1),top=u.stateAtTime(id===181?8.1:17.1);
  assert.ok(Math.abs(bottom[0])<.002&&Math.abs(bottom[1])<.002&&Math.abs(bottom[3]+1.6375)<.006);
  assert.ok(Math.abs(top[0]+.995)<.002&&Math.abs(top[1]+.9446)<.002&&Math.abs(top[3]-1.9625)<.006);
  assert.equal(u.hideGround,true);assert.equal(u.materialsIgnoreSceneFog,true);
  assert.equal(u.animationTiming.displayCycleDuration,12);
 }finally{model.dispose();}
});

function ringContains(ring,p){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
function contains(polygons,p){
 for(const rings of polygons){
  if(ringContains(rings[0],p)&&!rings.slice(1).some(r=>ringContains(r,p)))return true;
  for(const ring of rings)for(let i=1;i<ring.length;i++){
   const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
   if(length<1e-20)continue;const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length));
   if(Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)<2e-7)return true;
  }
 }
 return false;
}
test('serialized working solids stay inside the qualified planar contact envelopes',()=>{
 const model=makeBakedDiagonalCatchModel(bundle),projector=createDiagonalContactProjector();
 const selectors=[[/^upper-.*-curved-tappet-arm-plate/,/^upper-.*-rounded-working-handle-tip/],
  [/^lower-.*-curved-tappet-arm-plate/,/^lower-.*-rounded-working-handle-tip/],
  [/^upper-finite-catching-finger/],[/^lower-finite-catching-finger/],[/^continuous-source-diagonal-catch/],[/^source-projecting-piston-rod-tappet-shoe/]];
 try{
  for(const time of [0,3.8,4.5,8.1,12.65,13.05,13.6,17.1]){
   model.update(time);const polygons=projector.polygons(model.root.userData.stateAtTime(time));
   for(let i=0;i<selectors.length;i++)for(const selector of selectors[i]){
    const matches=Object.entries(model.root.userData.parts).filter(([name])=>selector.test(name));assert.equal(matches.length,1);
    const mesh=matches[0][1],positions=mesh.geometry.attributes.position;
    for(let j=0;j<positions.count;j++){
     const p=new THREE.Vector3().fromBufferAttribute(positions,j).applyMatrix4(mesh.matrixWorld);
     assert.ok(contains(polygons[i],[p.x,p.y]),`${mesh.name} leaves its contact envelope at ${time}`);
    }
   }
  }
 }finally{model.dispose();}
});
