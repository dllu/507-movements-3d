import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const movement=JSON.parse(fs.readFileSync('src/data/movements.json')).movements[130];
const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
test('131 finite pin fits the visible through-slot throughout its orbit',()=>{
 const v=createMovementModel(movement),u=v.root.userData,b=u.blocks,d=u.geometry;
 const hole=b.slottedArm.geometry.parameters.shapes.holes[0].getPoints(96);
 const radius=b.crankPinBody.geometry.parameters.radiusTop;
 let minimum=Infinity,maximum=-Infinity;
 try{
  assert.equal(b.slottedArm.geometry.parameters.options.bevelSize,0);
  for(const name of ['slotOutline','slotFace','crankArm','diskRotationIndex','crankPinIndex','sectorRotationIndex','rackIndex','pitchContactMarker'])assert.equal(b[name].visible,false);
  for(let i=0;i<=720;i++){
   v.update(i*d.cyclePeriod/720);v.root.updateMatrixWorld(true);
   const p=b.slottedArm.worldToLocal(b.crankPin.getWorldPosition(new THREE.Vector3()));
   const gap=Math.min(...hole.slice(0,-1).map((a,j)=>distance(p,a,hole[j+1])))-radius;
   minimum=Math.min(minimum,gap);maximum=Math.max(maximum,gap);
   assert(gap>.00099,'finite pin must clear every slot wall and cap');
   assert(gap<.00101,'ideal centreline motion must not leave a visible driving gap');
   const slotBox=new THREE.Box3().setFromObject(b.slottedArm),diskBox=new THREE.Box3().setFromObject(b.driverDisk),pinBox=new THREE.Box3().setFromObject(b.crankPinBody);
   assert(slotBox.min.z-diskBox.max.z>.049,'slot arm must clear the disk face');
   assert(pinBox.min.z<slotBox.min.z&&pinBox.max.z>slotBox.max.z,'pin must span the slot depth');
  }
  // The former outline intruded 0.04 into this same opening.
  assert(minimum-.04<0,'old outline would intersect the corrected pin');
  assert(maximum*44.4<.045);
 }finally{disposeObject3D(v.root);}
});
