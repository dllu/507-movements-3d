import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthoredConicalPendulumMovement as conical } from '../src/simulation/authored-conical-pendulums.js';
import { createAuthoredCompensationPendulumMovement as compensation } from '../src/simulation/authored-compensation-pendulums.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

for(const id of [315,316,317])test(`${id}: actual moving surfaces clear repaired journals over 17 poses`,()=>{
  const model=(id===315?conical:compensation)({id,description:''}),root=model.root,b=root.userData.blocks;
  const pairs=id===315?[[b.spindle,b.upperBearing],[b.spindle,b.lowerBearing],[b.spindle,b.bearingPlate],[b.lowerSocket,b.sphericalSeat],[b.rigidRod,b.sphericalSeat],[b.lowerSocket,b.actualCrankArm],[b.rigidRod,b.bob]]
    :[[b.fixedPivotShaft,b.movingPivotHub],[b.fixedPivotShaft,b.pivotBrackets[0]],[b.fixedPivotShaft,b.pivotBrackets[1]],[b.rod,b.fixedPivotShaft],...(id===317?[[b.rod,b.mainBob],...[b.steelLamina,b.brassLamina].flatMap(l=>[b.leftEndWeight,b.rightEndWeight].map(w=>[l,w.block]))]:[])];
  const points=new Map(),solids=new Map();
  for(const[a,c]of pairs){if(!points.has(a))points.set(a,surfacePoints(a.geometry));if(!solids.has(c))solids.set(c,solidSurface(c.geometry));}
  const period=root.userData.geometry.cyclePeriod ?? root.userData.geometry.thermalCyclePeriod;
  assert.ok(period>0);
  let checked=0;
  for(let i=0;i<17;i++){
    model.update(period*i/16);root.updateMatrixWorld(true);
    // p104: 317's laminae are rewritten each pose, so sample them live.
    for(const[a]of pairs)if(a.userData.layer)points.set(a,surfacePoints(a.geometry));
    for(const[a,c]of pairs){const transform=c.matrixWorld.clone().invert().multiply(a.matrixWorld),solid=solids.get(c);
      for(const p of points.get(a)){const q=p.clone().applyMatrix4(transform);checked++;
        if(solid.inside(q))assert.ok(solid.distance(q)<1e-5,`${id} ${a.userData.role} enters ${c.userData.role}: ${solid.distance(q)}, pose ${i}, point ${q.toArray()}`);
      }
    }
  }
  console.log(JSON.stringify({id,queries:checked}));
  assert.equal(root.userData.hideGround,true);assert.match(root.userData.reconstructionNote,/prescribe|prescribes/);
  root.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])assert.equal(m.fog,false);});
  const count=()=>{let n=0;root.traverse(()=>n++);return n;};const before=count();for(let i=0;i<50;i++)model.update(i*.119);assert.equal(count(),before);
});
