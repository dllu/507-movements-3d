import assert from 'node:assert/strict';
import test from 'node:test';
import {createAuthoredBoatDetacherMovement} from '../src/simulation/authored-boat-detachers.js';
import {surfacePoints,solidSurface} from './helpers/solid-surface.mjs';
const model=createAuthoredBoatDetacherMovement({id:492});
const {blocks:b,geometry:g}=model.root.userData;
function clearance(a,points,target,surface){const t=target.matrixWorld.clone().invert().multiply(a.matrixWorld);let minimum=Infinity;
 for(const p of points){const q=p.clone().applyMatrix4(t);if(surface.box.distanceToPoint(q)>.02)continue;minimum=Math.min(minimum,surface.signedDistance(q,.02));}return minimum;}
function sweep(pairs,samples=160){
 const prepared=pairs.map(([a,c,min])=>[a,surfacePoints(a.geometry),c,solidSurface(c.geometry),min]);
 for(let i=0;i<=samples;i++){model.update(g.cycleDuration*i/samples);model.root.updateMatrixWorld(true);
  for(const [a,points,c,surface,min] of prepared){const gap=clearance(a,points,c,surface);assert.ok(gap>min,`${a.userData.role} / ${c.userData.role} at ${i}: ${gap}`);}}
}
const mesh=o=>o.isMesh?o:o.children.find(c=>c.isMesh);

test('492 tongue, lever eye, hook and standard never cross through the release and reset',()=>{
 sweep([[b.tongueBar,b.leverEye,0],[b.tongueTip,b.leverEye,0],[b.tongueBar,b.hookBar,0],[b.tongueEye,b.hookBar,0],
  [b.tongueBar,b.standardBar,0.01],[b.tongueEye,b.standardBar,0.01],[b.leverBody,b.standardBar,0.01],[b.leverEye,b.tongueEye,0],
  [b.hookBar,b.standardBar,0],[b.tongueBar,b.leverBody,0]]);
});

test('492 pins pass through the bored standard, tongue eye and lever',()=>{
 const pins=[b.tongueHingePin,b.leverFulcrumPin].map(p=>p.children.find(c=>/shank/.test(c.userData.role)));
 sweep([[pins[0],b.standardBar,0],[pins[0],b.tongueEye,0],[pins[1],b.standardBar,0],[pins[1],b.leverBody,0]],40);
});

test('492 locked hook bears on the tongue and the locked tongue bears on the eye',()=>{
 model.update(0);model.root.updateMatrixWorld(true);
 const tongue=surfacePoints(b.tongueBar.geometry);
 const hookGap=clearance(b.tongueBar,tongue,b.hookBar,solidSurface(b.hookBar.geometry));
 const eyeGap=clearance(b.tongueBar,tongue,b.leverEye,solidSurface(b.leverEye.geometry));
 assert.ok(hookGap>0&&hookGap<0.02,`hook seat ${hookGap}`);
 assert.ok(eyeGap>0&&eyeGap<0.02,`eye seat ${eyeGap}`);
});
