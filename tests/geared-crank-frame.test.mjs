import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {gearedCrankState,gearedCrankSource as g,gearedCrankLengths as l,sourcePoint} from '../src/simulation/geared-crank-source.js';
import {makeGearedCrankFrame} from '../src/simulation/geared-crank-frame.js';
import {solidSurface} from './helpers/solid-surface.mjs';
test('148 candidate keeps source eccentric and fixed pivot and closes a complete turn',()=>{
 const first=gearedCrankState(0);assert.ok(first.wrist.distanceTo(sourcePoint(g.eccentric))<1e-12);
 assert.ok(first.joint.distanceTo(sourcePoint(g.joint))<1e-12);let previous=first;
 for(let i=0;i<=1024;i++){
  const s=gearedCrankState(8*i/1024);
  assert.ok(Math.abs(s.wrist.distanceTo(s.joint)-l.coupler)<1e-12);
  assert.ok(Math.abs(s.pivot.distanceTo(s.joint)-l.output)<1e-12);
  assert.ok(s.closureHeight>.56);
  assert.ok(Math.abs(s.rockerAngle-previous.rockerAngle)<.01);
  assert.ok(Math.abs(s.couplerAngle-previous.couplerAngle)<.03);previous=s;
 }
 assert.ok(first.joint.distanceTo(previous.joint)<1e-12);
});
test('148 candidate real crank and frame bores clear their joining pins',()=>{
 const v=makeGearedCrankFrame();
 try{
  const parts=v.root.userData.parts,crank=parts['bored-short-crank'],frame=parts['oblong-rocking-frame'];
  const c=solidSurface(crank.geometry),f=solidSurface(frame.geometry);let minimum=Infinity;
  for(let i=0;i<=64;i++){
   const s=v.update(i*8/64),ci=crank.matrixWorld.clone().invert(),fi=frame.matrixWorld.clone().invert();
   for(let j=0;j<96;j++){
    const a=2*Math.PI*j/96,dx=.12*Math.cos(a),dy=.12*Math.sin(a);
    for(const center of [s.wrist,s.joint])minimum=Math.min(minimum,c.signedDistance(new Vector3(center.x+dx,center.y+dy,.27).applyMatrix4(ci)));
    minimum=Math.min(minimum,f.signedDistance(new Vector3(s.joint.x+dx,s.joint.y+dy,.475).applyMatrix4(fi)));
   }
  }
  assert.ok(minimum>.0027,`minimum pin clearance ${minimum}`);
 }finally{v.dispose();}
});
