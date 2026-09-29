import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {makeBakedDiagonalCatchModel} from '../src/simulation/baked/diagonal-catch.js';
import {createDiagonalContactProjector} from '../src/simulation/mujoco-diagonal-catch/project-contact.js';

const bundle=JSON.parse(gunzipSync(fs.readFileSync(new URL('../src/simulation/baked/assets/181.json.gz',import.meta.url))));
const snapshot=model=>Object.values(model.root.userData.parts).flatMap(p=>p.matrixWorld.elements);
for(const id of [181,182])test(`${id} baked assembly repeats, retains its weight joints and moves the whole rod`,()=>{
 const model=makeBakedDiagonalCatchModel(bundle,id),root=model.root,u=root.userData;
 try{
  const initial=snapshot(model),rod=root.getObjectByName('piston-rod');
  const shoe=Object.entries(u.parts).find(([n])=>/^source-projecting-piston-rod-tappet-shoe/.test(n))[1];
  const rodOffset=new THREE.Box3().setFromObject(rod).min.y-new THREE.Box3().setFromObject(shoe).min.y;
  assert.ok(!/hatch/.test(JSON.stringify(Object.keys(u.parts))),'no hatch notation');
  root.traverse(o=>assert.ok(!o.isLine,'no line notation'));
  for(let i=0;i<=360;i++){
   model.update(i/20);assert.ok(snapshot(model).every(Number.isFinite));
   const rb=new THREE.Box3().setFromObject(rod);
   assert.ok(rb.max.y>2.64+.5&&rb.min.y<-3.325-.5,'whole piston rod runs past both picture edges');
   const tappet=new THREE.Box3().setFromObject(shoe);
   assert.ok(Math.abs((rb.min.y-tappet.min.y)-rodOffset)<1e-9,'rod travels with its tappet');
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
 // Plate outlines of the displayed working solids: each must lie inside its
 // qualified contact envelope, apart from the bored bosses and eyes, which
 // never come near the tappet or the catch.
 const selectors=[[/^upper-handle-curved-tappet-arm-plate/,0],[/^lower-handle-curved-tappet-arm-plate/,1],
  [/^continuous-source-diagonal-catch/,4],[/^source-projecting-piston-rod-tappet-shoe/,5]];
 const find=re=>{const m=Object.entries(model.root.userData.parts).filter(([name])=>re.test(name));assert.equal(m.length,1);return m[0][1];};
 const bosses=[['upper',.4],['lower',.4],['catchEye',.14]];
 try{
  for(const time of [0,3.8,4.5,8.1,12.65,13.05,13.6,17.1]){
   model.update(time);const q=model.root.userData.stateAtTime(time),polygons=projector.polygons(q);
   const centres={upper:model.root.getObjectByName('body:upper').position,lower:model.root.getObjectByName('body:lower').position,
    catchEye:model.root.getObjectByName('anchor:catchWeight').getWorldPosition(new THREE.Vector3())};
   const inBoss=p=>bosses.some(([k,r])=>Math.hypot(p.x-centres[k].x,p.y-centres[k].y)<=r+1e-6);
   for(const [selector,i]of selectors){
    const mesh=find(selector),positions=mesh.geometry.attributes.position;
    for(let j=0;j<positions.count;j++){
     const p=new THREE.Vector3().fromBufferAttribute(positions,j).applyMatrix4(mesh.matrixWorld);
     assert.ok(inBoss(p)||contains(polygons[i],[p.x,p.y]),`${mesh.name} leaves its contact envelope at ${time}`);
    }
   }
   // The catching faces are the ends of the horn and beak plates in the
   // catch's plane: those plates may touch the catch only at the faces.
   for(const [selector,side]of [[/^upper-handle-horn-and-weight-arm/,'upper'],[/^lower-handle-beak/,'lower']]){
    const mesh=find(selector),positions=mesh.geometry.attributes.position;
    for(let j=0;j<positions.count;j++){
     const p=new THREE.Vector3().fromBufferAttribute(positions,j).applyMatrix4(mesh.matrixWorld);
     if(contains(polygons[4],[p.x,p.y]))assert.ok(contains(polygons[side==='upper'?2:3],[p.x,p.y]),`${mesh.name} meets the catch away from its face at ${time}`);
    }
   }
  }
 }finally{model.dispose();}
});

for(const id of [181,182])test(`${id} synchronous registry route plays the same baked assembly with whole weighted rods`,async()=>{
 const {createAuthoredDiagonalCatchMovement}=await import('../src/simulation/authored-diagonal-catches.js');
 const {diagonalCatchKeys}=await import('../src/simulation/baked/diagonal-catch-keys.js');
 const {DIAGONAL_CATCH_ROD_EDGE_Y}=await import('../src/simulation/mujoco-diagonal-catch/update-solids.js');
 const {createHash}=await import('node:crypto');
 assert.equal(diagonalCatchKeys.assetSha256,createHash('sha256').update(fs.readFileSync(new URL('../src/simulation/baked/assets/181.json.gz',import.meta.url))).digest('hex'));
 const live=createAuthoredDiagonalCatchMovement({id}),baked=makeBakedDiagonalCatchModel(bundle,id);
 try{
  const a=live.root.userData.parts,b=baked.root.userData.parts;
  assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());
  assert.ok(!Object.keys(a).some(n=>/roller|hook-pocket/.test(n)),'no nominal latch rollers or pockets');
  const point=new THREE.Vector3(),other=new THREE.Vector3();let worst=0;
  for(let i=0;i<=720;i++){
   const time=i*18/720;live.update(time);baked.update(time);
   for(const name of Object.keys(a)){
    const pa=a[name].geometry.attributes.position,pb=b[name].geometry.attributes.position;
    for(let j=0;j<pa.count;j+=Math.max(1,pa.count>>3)){
     point.fromBufferAttribute(pa,j).applyMatrix4(a[name].matrixWorld);other.fromBufferAttribute(pb,j).applyMatrix4(b[name].matrixWorld);
     worst=Math.max(worst,point.distanceTo(other));
    }
   }
   for(const rod of Object.values(a).filter(m=>/vertical-rod/.test(m.name)))
    assert.ok(new THREE.Box3().setFromObject(rod).min.y<DIAGONAL_CATCH_ROD_EDGE_Y-.3,'whole rod runs below the drawing edge to its weight');
  }
  assert.ok(worst<3e-4,`compact keys follow the bake: ${worst}`);
 }finally{baked.dispose();live.dispose();}
});

for(const id of [181,182])test(`${id} (pass 104): the upper handle is ochre, the lower blue, so their crossing arms read as two parts`,()=>{
 const model=makeBakedDiagonalCatchModel(bundle,id),colours={upper:new Set(),lower:new Set()};
 try{
  model.root.traverse(o=>{const r=o.name||'';if(o.isMesh&&/^(upper|lower)-handle/.test(r))colours[r.split('-')[0]].add(o.material.color.getHexString());});
  assert.equal(colours.upper.size,1);assert.equal(colours.lower.size,1);
  const [u]=colours.upper,[l]=colours.lower;
  assert.notEqual(u,l);
  const c=new THREE.Color('#'+u),hsl={};c.getHSL(hsl);
  assert.ok(hsl.h>0.08&&hsl.h<0.16,'ochre upper handle');
 }finally{model.dispose?.();}
});
test('181/182 (p109): pivot shafts and pins are mid steel grey, not pale holes',()=>{
 for(const id of [181,182]){const model=makeBakedDiagonalCatchModel(bundle,id);let n=0;
  try{model.root.traverse(o=>{if(o.isMesh&&/pivot-shaft|pin/.test(o.userData.role??o.name??'')&&o.material?.color){assert.notEqual(o.material.color.getHex(),0x9aa19d);if(o.material.color.getHex()===0x7e8584)n++;}});assert.ok(n>0);}
  finally{model.dispose?.();}}
});
