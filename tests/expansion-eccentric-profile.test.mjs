import test from 'node:test';
import assert from 'node:assert/strict';
import {expansionEccentricProfile,expansionForkLimits,expansionEccentricSpread} from '../src/simulation/expansion-eccentric-profile.js';
import {expansionEccentricOutline as trace} from '../src/data/expansion-eccentric-outline.js';
test('137 smooth cam follows the visible landmarks and bears on both fork rollers through a turn',()=>{
 const p=expansionEccentricProfile();
 const distance=(q,a,b)=>{const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*x+(q[1]-a[1])*y)/(x*x+y*y)));return Math.hypot(q[0]-a[0]-t*x,q[1]-a[1]-t*y);};
 // The three-lobed conjugate cam departs from the traced dimples by up to 8.9 px.
 for(const [x,y] of trace.visibleRuns.flat())assert(Math.min(...p.map((a,i)=>distance([x-trace.shaft[0],trace.shaft[1]-y],a,p[(i+1)%p.length])))<9.5);
 for(let i=0;i<p.length;i++)assert(p[i][0]*p[(i+1)%p.length][1]-p[i][1]*p[(i+1)%p.length][0]>0,'fan triangles must stay inside this star-shaped contour');
 assert.equal(expansionEccentricSpread,4);
 // With the upper roller on the cam, the lower roller stays within 1.22 px
 // of it (fork play in radians times the ~367 px arm), never jamming by more
 // than 0.04 px: the fork is positively driven by both rollers. The distinct
 // lobes cost about 0.6 px more play than the earlier smoothed cam; the rollers
 // now swing through about 39 px a turn.
 let minimum=Infinity,maximum=-Infinity;
 for(let i=0;i<360;i++){
  const r=expansionForkLimits(p,i*2*Math.PI/360);minimum=Math.min(minimum,r.width);maximum=Math.max(maximum,r.width);
 }
 assert(minimum*367>-.05,`jam ${minimum*367} px`);assert(maximum*367<1.3,`play ${maximum*367} px`);
 let low=Infinity,high=-Infinity;for(let i=0;i<360;i++){const r=expansionForkLimits(p,i*2*Math.PI/360);low=Math.min(low,r.upper);high=Math.max(high,r.upper);}
 assert((high-low)*367>36,'the lobed cam rocks the fork perceptibly');
});
