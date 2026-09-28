import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const movement=JSON.parse(fs.readFileSync('src/data/movements.json')).movements[132];
const box=o=>new THREE.Box3().setFromObject(o);
const joined=(a,b)=>{const q=box(a).intersect(box(b));if(q.isEmpty())return false;const size=q.getSize(new THREE.Vector3());return Math.min(size.x,size.y,size.z)>1e-5;};
test('133 frame supports connect and the anvil covers the rising platen',()=>{
 const v=createMovementModel(movement),u=v.root.userData,b=u.blocks,d=u.geometry;
 try{
  v.root.updateMatrixWorld(true);
  for(let i=0;i<2;i++){
   assert(joined(b.frameColumns[i],b.baseRail));
   assert(joined(b.headerPanel,b.topBlocks[i]));
   const old=box(b.frameColumns[i]);old.min.y=-.25*.42;assert(!old.intersectsBox(box(b.baseRail)),'former column gap must fail');
  }
  assert(joined(b.headerPanel,b.fixedAnvil));assert(joined(b.headerPanel,b.topCap));
  const anvil=box(b.fixedAnvil);
  for(let i=0;i<=720;i++){
   v.update(i*d.cyclePeriod/720);v.root.updateMatrixWorld(true);const platen=box(b.platenBody);
   assert(anvil.min.x<platen.min.x&&anvil.max.x>platen.max.x);
   assert(anvil.min.z<platen.min.z&&anvil.max.z>platen.max.z,'pressing faces must overlap in depth');
   assert(anvil.min.y-platen.max.y>=d.closedPressClearance-1e-7,'platen must not enter anvil');
   const moving=[];b.platen.traverse(o=>{if(o.isMesh)moving.push(o);});
   const ears=moving.filter(o=>o.userData.role==='platen-guide-ear-wrapping-frame-column');
   assert.equal(ears.length,2,'each crossbar end carries a guide ear round its column');
   for(const part of moving.filter(o=>!ears.includes(o)))for(const fixed of [...b.frameColumns,b.baseRail,b.headerPanel,b.topCap])assert(!box(part).intersectsBox(box(fixed)),'platen assembly must clear fixed supports');
   for(const ear of ears){
    for(const fixed of [b.baseRail,b.headerPanel,b.topCap])assert(!box(ear).intersectsBox(box(fixed)),'guide ears clear the base and head');
    const column=box(b.frameColumns.find(c=>c.userData.side===ear.userData.side));const eb=box(ear);
    assert(eb.min.x<column.min.x&&eb.max.x>column.max.x&&eb.min.z<column.min.z,'the ear wraps its column');
    const pos=ear.geometry.attributes.position,q=new THREE.Vector3();const shrunk=column.clone().expandByScalar(-1e-6);
    for(let k=0;k<pos.count;k++){q.fromBufferAttribute(pos,k).applyMatrix4(ear.matrixWorld);assert(!shrunk.containsPoint(q),'no ear vertex inside the column');}
    // Running clearance on the four guided faces.
    let gap=Infinity;for(let k=0;k<pos.count;k++){q.fromBufferAttribute(pos,k).applyMatrix4(ear.matrixWorld);if(q.x>=column.min.x-.01&&q.x<=column.max.x+.01&&q.z>=column.min.z-.01&&q.z<=column.max.z+.01)gap=Math.min(gap,Math.max(column.min.x-q.x,q.x-column.max.x,column.min.z-q.z,q.z-column.max.z));}
    assert(gap>0.003&&gap<0.005,`ear running clearance ${gap}`);
   }
  }
  let undrawnCheek=false;v.root.traverse(o=>{if(/guide-along-platen/.test(o.userData.role??''))undrawnCheek=true;});
  assert(!undrawnCheek,'Brown draws no guide cheeks inside the columns');
  assert(-.43+.04+(.3+.18)/2<box(b.platenBody).min.z,'former anvil sat entirely behind the platen');
 }finally{disposeObject3D(v.root);}
});
