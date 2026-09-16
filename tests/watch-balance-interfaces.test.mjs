import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthoredWatchRegulatorMovement as watch } from '../src/simulation/authored-watch-regulators.js';
import { createAuthoredCompensationBalanceMovement as balance } from '../src/simulation/authored-compensation-balances.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

for(const id of [318,319])test(`${id}: finite staff, spring and arm interfaces over a complete demonstration`,()=>{
  const model=(id===318?watch:balance)({id,description:''}),r=model.root,b=r.userData.blocks,g=r.userData.geometry;
  const pairs=id===318?[[b.balanceStaff,b.lowerBearing],[b.balanceStaff,b.balanceHub],[b.balanceStaff,b.springCollet],[b.regulatorRing,b.fixedRing],...b.springSegments.flatMap(s=>b.curbPins.map(p=>[s,p]))]
    :[[b.staff,b.fixedBearing],[b.staff,b.hub],[b.staff,b.springCollet],[b.staff,b.mainBar],...b.compoundArmSegments.flat().flatMap(s=>[b.rightWeight,b.leftWeight].flatMap(w=>[[s.steel,w.block],[s.brass,w.block],[s.steel,w.clampScrew],[s.brass,w.clampScrew]])),...[b.topTimingScrew,b.bottomTimingScrew].map(s=>[s.stem,s.nut])];
  const samples=new Map(),solids=new Map();
  for(const[a,c]of pairs){if(!samples.has(a))samples.set(a,surfacePoints(a.geometry));if(!solids.has(c))solids.set(c,solidSurface(c.geometry));}
  const period=g.adjustmentCyclePeriod??g.thermalCyclePeriod;let queries=0,minCurbGap=Infinity;
  // 65 includes every thermal extreme and spans the faster balance oscillations.
  for(let i=0;i<=64;i++){
    model.update(period*i/64);r.updateMatrixWorld(true);
    for(const[a,c]of pairs){const transform=c.matrixWorld.clone().invert().multiply(a.matrixWorld),solid=solids.get(c);
      for(const p of samples.get(a)){const q=p.clone().applyMatrix4(transform);queries++;
        if(solid.inside(q))assert.ok(solid.distance(q)<1e-5,`${id}: ${a.userData.role} enters ${c.userData.role} at pose ${i}: ${solid.distance(q)} (${q.toArray()})`);
        if(id===318&&b.curbPins.includes(c))minCurbGap=Math.min(minCurbGap,solid.distance(q,minCurbGap));
      }
    }
  }
  console.log(JSON.stringify({id,queries,minCurbGap:id===318?minCurbGap:null}));
  assert.equal(b.backPlate.visible,false);assert.equal(r.userData.hideGround,true);
  r.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])assert.equal(m.fog,false);});
  const geometryIds=()=>{const a=[];r.traverse(o=>{if(o.geometry)a.push(o.geometry.uuid);});return a;};
  const before=geometryIds();for(let i=0;i<100;i++)model.update(i*.31);assert.deepEqual(geometryIds(),before);
});
