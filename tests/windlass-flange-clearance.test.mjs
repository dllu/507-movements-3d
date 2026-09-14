import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../src/data/movements.json',import.meta.url)));
test('129 keeps the entire finite rope clear of its three flanges throughout a cycle',()=>{
 const v=createMovementModel(catalog.movements[128]),u=v.root.userData,d=u.geometry;
 const distance=(p,x,r)=>{
  const axial=Math.abs(p.x-x)-d.barrelFlangeThickness/2,radial=Math.hypot(p.y-d.shaftY,p.z)-r;
  return Math.hypot(Math.max(axial,0),Math.max(radial,0))+Math.min(Math.max(axial,radial),0);
 };
 try{
  assert.equal(u.blocks.barrelFlanges.length,3);
  assert(u.blocks.barrelFlanges.some(f=>f.position.x===0));
  let minimum=Infinity;
  for(let i=0;i<=120;i++){
   const state=u.stateAtTime(i*d.cyclePeriod/120);
   for(let j=0;j<=1000;j++){
    const p=state.ropeCurve.getPoint(j/1000);
    for(const f of u.blocks.barrelFlanges)minimum=Math.min(minimum,distance(p,f.position.x,f.geometry.parameters.radiusTop)-d.ropeRadius);
   }
  }
  assert(minimum>0,`finite rope/flange clearance ${minimum}`);
  assert(distance(d.largeRopeExit,d.largeRopeExit.x,d.largeBarrelPitchRadius+d.barrelFlangeExtraRadius)<d.ropeRadius,'old exit flange must fail');
  assert.equal(u.hideGround,true);
  assert.equal(u.animationTiming.displayCycleDuration,6);
 }finally{disposeObject3D(v.root);}
});
