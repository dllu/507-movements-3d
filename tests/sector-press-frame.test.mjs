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
   assert(joined(b.frameColumns[i],b.baseRail));assert(joined(b.platenGuideRails[i],b.frameColumns[i]));
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
   for(const part of [...b.frameColumns,...b.platenGuideRails,b.baseRail,b.headerPanel,b.topCap])assert(!box(b.platen).intersectsBox(box(part)),'platen assembly must clear fixed supports');
  }
  assert(-.43+.04+(.3+.18)/2<box(b.platenBody).min.z,'former anvil sat entirely behind the platen');
 }finally{disposeObject3D(v.root);}
});
