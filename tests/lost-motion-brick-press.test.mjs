import test from 'node:test';
import assert from 'node:assert/strict';
import {lostMotionBrickGeometry,lostMotionBrickAtAngle,lostMotionBrickState} from '../src/simulation/lost-motion-brick-press-motion.js';

test('166 keeps the pin inside the slot through both drives and dwells',()=>{
 const g=lostMotionBrickGeometry();
 for(let i=0;i<=720;i++){
  const s=lostMotionBrickAtAngle(2*Math.PI*i/720,g);
  assert.ok(s.distance>=g.inner-1e-12&&s.distance<=g.outer+1e-12);
  assert.ok(Math.abs((s.pin[0]-s.x)*-Math.sin(s.rodAngle)+s.pin[1]*Math.cos(s.rodAngle))<1e-12);
  if(s.stage==='retract')assert.ok(Math.abs(s.distance-g.outer)<1e-12);
  if(s.stage==='advance')assert.ok(Math.abs(s.distance-g.inner)<1e-12);
 }
});

test('166 has two exact held-output dwells and continuous handoffs',()=>{
 const g=lostMotionBrickGeometry(),s=lostMotionBrickAtAngle(0,g);
 assert.equal(lostMotionBrickAtAngle(.1*s.outerEngagement,g).x,lostMotionBrickAtAngle(.9*s.outerEngagement,g).x);
 assert.equal(lostMotionBrickAtAngle(Math.PI+.1*(s.innerEngagement-Math.PI),g).x,lostMotionBrickAtAngle(Math.PI+.9*(s.innerEngagement-Math.PI),g).x);
 for(const angle of [0,s.outerEngagement,Math.PI,s.innerEngagement,2*Math.PI])assert.ok(Math.abs(lostMotionBrickAtAngle(angle-1e-9,g).x-lostMotionBrickAtAngle(angle+1e-9,g).x)<1e-8);
 assert.ok(Math.abs(s.stroke-(2*g.crankRadius-(g.outer-g.inner)))<1e-12);
});

test('166 starts at the measured engraving crank-pin location and repeats',()=>{
 const g=lostMotionBrickGeometry(),s=lostMotionBrickState(0,g);
 assert.ok(Math.abs(s.pin[0]/g.scale+228-141)<1e-10);
 assert.ok(Math.abs(274-s.pin[1]/g.scale-221)<1e-10);
 assert.ok(Math.abs(lostMotionBrickState(g.period,g).x-s.x)<1e-12);
});
