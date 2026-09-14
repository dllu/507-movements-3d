import test from 'node:test';
import assert from 'node:assert/strict';
import {expansionEccentricProfile,expansionForkLimits} from '../src/simulation/expansion-eccentric-profile.js';
import {expansionEccentricOutline as trace} from '../src/data/expansion-eccentric-outline.js';
test('137 shaped cam preserves visible landmarks and exposes fork-spacing conflict',()=>{
 const p=expansionEccentricProfile();
 const distance=(q,a,b)=>{const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*x+(q[1]-a[1])*y)/(x*x+y*y)));return Math.hypot(q[0]-a[0]-t*x,q[1]-a[1]-t*y);};
 for(const [x,y] of trace.visibleRuns.flat())assert(Math.min(...p.map((a,i)=>distance([x-trace.shaft[0],trace.shaft[1]-y],a,p[(i+1)%p.length])))<.15);
 for(let i=0;i<p.length;i++)assert(p[i][0]*p[(i+1)%p.length][1]-p[i][1]*p[(i+1)%p.length][0]<0,'fan triangles must stay inside this star-shaped contour');
 let originalMin=Infinity,adjustedMin=Infinity;
 for(let i=0;i<180;i++){
  const angle=i*2*Math.PI/180,old=expansionForkLimits(p,angle),r=expansionForkLimits(p,angle,{spread:12});
  originalMin=Math.min(originalMin,old.width);adjustedMin=Math.min(adjustedMin,r.width);
  assert(r.gap('upper',(r.lower+r.upper)/2)>=0&&r.gap('lower',(r.lower+r.upper)/2)>=0);
 }
 assert(originalMin<-.06);assert(adjustedMin>.001);
});
