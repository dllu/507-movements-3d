import test from 'node:test';
import assert from 'node:assert/strict';
import {idealCordShape} from '../src/simulation/mujoco-cord-treadle/ideal-cord-shape.js';
import {cordTreadleParameters,cordTreadleMetrics} from '../src/simulation/cord-treadle-motion.js';
const g=cordTreadleParameters(),distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('ideal slack illustration preserves endpoints, cord length and pulley tangent',()=>{
 for(const [disk,treadle] of [[0,g.initialTreadle],[Math.PI/2,.34520362]]){
  const s=idealCordShape(disk,treadle,{segments:4096}),m=cordTreadleMetrics(disk,treadle,g);
  assert.ok(distance(s.points[0],[...m.pin,.64])<1e-12);assert.ok(distance(s.points.at(-1),[...m.eye,.64])<1e-12);
  const measured=s.points.slice(1).reduce((sum,p,i)=>sum+distance(p,s.points[i]),0);
  assert.ok(Math.abs(measured-s.length)<.00003);assert.ok(Math.abs(s.length-g.cordLength-s.tendonExtension)<1e-8);
  // Pass 72: controls are [pin, parabola control, pulley entry, exit, eye].
  const [, control, entry, exit, eyePoint]=s.controls,radial=entry.map((v,i)=>v-g.guide[i]),tangent=entry.map((v,i)=>v-control[i]);
  assert.ok(Math.abs(tangent[0]*radial[0]+tangent[1]*radial[1])<1e-9*Math.hypot(...tangent),'the run meets the pulley tangentially');
  assert.ok(Math.abs(Math.hypot(...radial)-g.guideRadius)<1e-12);
  assert.ok(distance(exit,m.exit)<1e-12&&distance(eyePoint,m.eye)<1e-12);
  assert.ok(s.points.flat().every(Number.isFinite));
 }
 const slack=idealCordShape(Math.PI/2,.34520362,{segments:4096});assert.ok(slack.slack>1);
 // The weight of the hanging vertical run keeps it straight from the pulley
 // to the resting treadle's eye; the slack settles in the diagonal run as a
 // gravity sag (a parabola with a vertical axis) that meets the pulley
 // tangentially.
 const [pin,control,entry,exit,eye]=slack.controls,run=[eye[0]-exit[0],eye[1]-exit[1]],runLength=Math.hypot(...run);
 const onOutgoing=slack.points.filter(p=>p[1]<exit[1]-1e-6&&Math.abs(p[0]-exit[0])<.3);
 assert.ok(onOutgoing.length>100);
 for(const p of onOutgoing)assert.ok(Math.abs(((p[0]-exit[0])*run[1]-(p[1]-exit[1])*run[0])/runLength)<1e-9,'straight hanging run');
 const middle=[(pin[0]+entry[0])/2,(pin[1]+entry[1])/2];
 assert.ok(Math.abs(control[0]-middle[0])<1e-12&&control[1]<middle[1]-.5,'vertical-axis sag below the chord');
 const bar=[Math.cos(.34520362),Math.sin(.34520362)];
 for(const p of slack.points){const d=[p[0]-eye[0],p[1]-eye[1]];if(Math.hypot(...d)<.14)continue;assert.ok(-d[0]*bar[1]+d[1]*bar[0]>.13,`cord at ${p} crosses the bar`);}
 assert.ok(Math.min(...slack.points.map(p=>p[1]))>=eye[1]-1e-9,'the cord meets its eye from above');
});
test('ideal profile repeats with mechanism phase and reports native tendon extension',()=>{
 const a=idealCordShape(Math.PI/2,.34520362),b=idealCordShape(Math.PI/2+2*Math.PI,.34520362);
 assert.ok(Math.max(...a.points.map((p,i)=>distance(p,b.points[i])))<1e-9);
 const taut=idealCordShape(0,g.initialTreadle+.0001);assert.ok(taut.tendonExtension>0);assert.equal(taut.slack,0);assert.ok(Math.abs(taut.length-g.cordLength-taut.tendonExtension)<1e-8);
});
