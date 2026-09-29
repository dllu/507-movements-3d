import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAuthoredEpicyclicTrainMovement} from '../src/simulation/authored-epicyclic-trains.js';
import {solidSurface, surfacePoints} from './helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';

for (const id of [506,507]) test(`${id} moving rendered solids clear the reconstructed source supports`, () => {
 const model=createAuthoredEpicyclicTrainMovement({id}),u=model.root.userData,b=u.blocks;
 const supports=id===506?[b.rearPost,b.mainBearingLinks[1],...b.mainBearings,b.driverBearing,b.supportBase]:[b.outputBearing,b.outputBearingPedestal,b.bottomMainBearing,b.supportBase];
 const groups=id===506?[b.driverAH,b.lowerBC,b.upperFG,b.carrierKL]:[b.outputCAssembly,b.longSleeveDE,b.shortSleeveAH,b.carrierMN,b.fixedShaftMP];
 const moving=[];for(const group of groups)group.traverseVisible(o=>{if(o.isMesh)moving.push(o);});
 const cache=new Map();
 const data=o=>{if(!cache.has(o.geometry))cache.set(o.geometry,{surface:solidSurface(o.geometry),points:surfacePoints(o.geometry)});return cache.get(o.geometry);};
 for(const mesh of [...moving,...supports])data(mesh);
 let queries=0;
 try {
  for(let step=0;step<17;step++){
   model.update(u.transmission.nominalCarrierPeriod*(step+.31)/17);model.root.updateMatrixWorld(true);
   for(const fixed of supports)for(const part of moving){
    const f=data(fixed),p=data(part),worldF=f.surface.box.clone().applyMatrix4(fixed.matrixWorld),worldP=p.surface.box.clone().applyMatrix4(part.matrixWorld);
    if(!worldF.intersectsBox(worldP))continue;
    for(const [from,to]of[[fixed,part],[part,fixed]]){
     const a=data(from),z=data(to),matrix=to.matrixWorld.clone().invert().multiply(from.matrixWorld);
     for(const sample of a.points){const point=sample.clone().applyMatrix4(matrix);if(!z.surface.box.containsPoint(point))continue;queries++;
      assert.ok(!z.surface.inside(point)||z.surface.distance(point)<1e-6,`${id} phase ${step}: ${from.userData.role} enters ${to.userData.role} at ${point.toArray()}`);
     }
    }
   }
  }
  assert.ok(queries>100,'the sweep must exercise overlapping bounding boxes, including actual journal passages');
 } finally {disposeObject3D(model.root);}
});
