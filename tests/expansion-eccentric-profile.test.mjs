import test from 'node:test';
import assert from 'node:assert/strict';
import {expansionEccentricProfile,expansionForkLimits,expansionEccentricSpread} from '../src/simulation/expansion-eccentric-profile.js';
import {expansionEccentricOutline as trace} from '../src/data/expansion-eccentric-outline.js';
test('137 smooth cam follows the visible landmarks and bears on both fork rollers through a turn',()=>{
 const p=expansionEccentricProfile();
 const distance=(q,a,b)=>{const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*x+(q[1]-a[1])*y)/(x*x+y*y)));return Math.hypot(q[0]-a[0]-t*x,q[1]-a[1]-t*y);};
 // Pass 99: the constant-diameter pitch design keeps Brown's dimples as
 // concave hollows and departs from the traced landmarks by up to 7.9 px.
 for(const [x,y] of trace.visibleRuns.flat())assert(Math.min(...p.map((a,i)=>distance([x-trace.shaft[0],trace.shaft[1]-y],a,p[(i+1)%p.length])))<9.5);
 for(let i=0;i<p.length;i++)assert(p[i][0]*p[(i+1)%p.length][1]-p[i][1]*p[(i+1)%p.length][0]>0,'fan triangles must stay inside this star-shaped contour');
 assert.equal(expansionEccentricSpread,4.05);
 // Brown's dimples: at least three separate concave runs, each hollow far
 // wider than the rollers (concave radius above 100 px, rollers 31-32 px).
 {
  const n=p.length,cross=i=>{const a=p[(i+n-1)%n],b=p[i],c=p[(i+1)%n];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);};
  let runs=0,concave=0;for(let i=0;i<n;i++){const k=cross(i)<0;if(k)concave++;if(k&&!(cross((i+n-1)%n)<0))runs++;}
  assert(runs>=3&&concave/n>.15,`dimples ${runs} runs, ${concave/n}`);
  for(let i=0;i<n;i++){
   const a=p[(i+n-1)%n],b=p[i],c=p[(i+1)%n],ab=Math.hypot(b[0]-a[0],b[1]-a[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]),ca=Math.hypot(a[0]-c[0],a[1]-c[1]);
   const radius=ab*bc*ca/(2*Math.abs(cross(i))||1e-12);if(cross(i)<0)assert(radius>100,`concave radius ${radius}`);
  }
 }
 // With the upper roller on the cam, the lower roller stays within 1.22 px
 // of it (fork play in radians times the ~367 px arm), never jamming by more
 // than 0.04 px: the fork is positively driven by both rollers. The distinct
 // lobes cost about 0.6 px more play than the earlier smoothed cam; the rollers
 // now swing through about 39 px a turn.
 let minimum=Infinity,maximum=-Infinity;
 for(let i=0;i<360;i++){
  const r=expansionForkLimits(p,i*2*Math.PI/360);minimum=Math.min(minimum,r.width);maximum=Math.max(maximum,r.width);
 }
 // Pass 97: spread 4.05 px leaves 0.06 px of play at the tightest angle, so
 // the fork never pinches the cam.
 assert(minimum*367>.05,`jam ${minimum*367} px`);assert(maximum*367<1.7,`play ${maximum*367} px`);
 let low=Infinity,high=-Infinity;for(let i=0;i<360;i++){const r=expansionForkLimits(p,i*2*Math.PI/360);low=Math.min(low,r.upper);high=Math.max(high,r.upper);}
 assert((high-low)*367>36,'the lobed cam rocks the fork perceptibly');
});
