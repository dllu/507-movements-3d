import test from 'node:test';
import assert from 'node:assert/strict';
import {slidingWormAtTime,slidingWormDimensions as g} from '../src/simulation/sliding-worm-kinematics.js';
test('143 closes the measured fixed rod through a complete traverse and restart',()=>{
 const first=slidingWormAtTime(0);assert.ok(Math.abs(first.carriageX)<1e-12);assert.ok(Math.hypot(first.wrist[0]-g.crank[0],first.wrist[1]-g.crank[1])<1e-12);
 const measuredLength=Math.hypot(472.5-251,332.5-364.25)*.015;
 let low=Infinity,high=-Infinity;
 for(let i=0;i<=1440;i++){
  const s=slidingWormAtTime(g.period*i/1440),rod=Math.hypot(g.fixedPivot[0]-s.wrist[0],g.fixedPivot[1]-s.wrist[1]);
  assert.ok(Math.abs(rod-measuredLength)<1e-12);
  assert.ok(Math.abs(Math.hypot(s.wrist[0]-s.carriageX,s.wrist[1])-Math.hypot(...g.crank))<1e-12);
  assert.ok(Math.abs(-s.inputAngle/22-s.wheelAngle)<1e-12,'left-hand worm turns opposite to the wheel');
  assert.ok(s.carriageX-.99>-2.97&&s.carriageX+.99<2.895,'complete carriage stays on the fixed guide');
  low=Math.min(low,s.carriageX);high=Math.max(high,s.carriageX);
 }
 assert.ok(high-low>.94&&high-low<.96);
 const end=slidingWormAtTime(g.period);assert.ok(Math.hypot(end.wrist[0]-first.wrist[0],end.wrist[1]-first.wrist[1])<1e-12);
 assert.deepEqual(slidingWormAtTime(0),first);
});
