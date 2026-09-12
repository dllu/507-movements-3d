import fs from 'node:fs';
import {makePumpCatchWeightedCandidate} from './lib/pump-catch-weighted-candidate.mjs';
import {renderedPrism} from './lib/crossed-rack-mesh-prisms.mjs';
import {rotate} from '../src/simulation/finite-plate-geometry.js';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/086-finite-rope-dynamics.json.gz',prefix=process.env.PROBE_PREFIX??'artifacts/review/086-finite-rope-overlap',data=readStudyReport(input);
verifyStudySources(data.sources);const sources=freezeStudySources([input,'scripts/check-pump-catch-overlap.mjs',...data.sources.map(s=>s.file)],prefix);
const model=makePumpCatchWeightedCandidate(data.parameters.candidateOptions),u=model.root.userData,pivot=u.geometry.pivot;
const names=['hookedCatchB','pointedCamC','inputShaft','fixedTripStop'],prisms=Object.fromEntries(names.map(name=>[name,renderedPrism(u.parts[name].geometry)]));
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>a.map((v,k)=>v-b[k]);
const box=points=>({min:[0,1].map(k=>Math.min(...points.map(v=>v[k]))),max:[0,1].map(k=>Math.max(...points.map(v=>v[k])))});
const intersects=(a,b)=>[0,1].every(k=>a.min[k]<=b.max[k]&&b.min[k]<=a.max[k]);
function tree(triangles){
  const bounds=box(triangles.flatMap(t=>[t.min,t.max]));if(triangles.length<=8)return{...bounds,triangles};
  const axis=bounds.max[0]-bounds.min[0]>bounds.max[1]-bounds.min[1]?0:1;
  triangles.sort((a,b)=>a.min[axis]+a.max[axis]-b.min[axis]-b.max[axis]);const mid=triangles.length>>1;
  return{...bounds,left:tree(triangles.slice(0,mid)),right:tree(triangles.slice(mid))};
}
// Convex clipping of individual rendered cap triangles avoids stitching nearly
// coincident polygon-union rings. Triangles have disjoint interiors, so their
// pair intersection areas sum to the complete cap intersection area.
function triangleArea(a,b){
  let points=a;
  for(let edge=0;edge<3&&points.length;edge++){
    const origin=b[edge],d=sub(b[(edge+1)%3],origin),next=[];
    for(let i=0;i<points.length;i++){
      const p=points[i],q=points[(i+1)%points.length],dp=cross(d,sub(p,origin)),dq=cross(d,sub(q,origin));
      if(dp>=0)next.push(p);if((dp>=0)!==(dq>=0)){const f=dp/(dp-dq);next.push(p.map((v,k)=>v+f*(q[k]-v)));}
    }points=next;
  }
  if(points.length<3)return 0;let area=0;for(let i=1;i+1<points.length;i++)area+=cross(sub(points[i],points[0]),sub(points[i+1],points[0]))/2;return Math.abs(area);
}
const unit=[[0,0],[1,0],[0,1]],controls=[
  {name:'identical',actual:triangleArea(unit,unit),expected:.5},
  {name:'clear',actual:triangleArea(unit,unit.map(p=>p.map(v=>v+2))),expected:0},
  {name:'penetrating',actual:triangleArea(unit,unit.map(([x,y])=>[x+.5,y])),expected:.125},
  {name:'shared-edge',actual:triangleArea(unit,[[0,0],[0,1],[-1,0]]),expected:0},
  {name:'contained',actual:triangleArea(unit,[[.1,.1],[.2,.1],[.1,.2]]),expected:.005}
];
if(controls.some(c=>Math.abs(c.actual-c.expected)>1e-13))throw Error('Independent triangle clipping control failed');
const trees=Object.fromEntries(names.slice(1).map(name=>[name,tree(prisms[name].triangles.slice())]));
const pairs=names.slice(1).map(name=>({name,checks:0,maximumArea:0,worst:null,failed:0}));let poses=0;
function check(time,q,label){
  const P=rotate(pivot,q[0]);poses++;
  for(const p of pairs){const angle=p.name==='fixedTripStop'?0:data.angularSpeed*time,offset=rotate(P,-angle);let overlap=0;
    for(const t of prisms.hookedCatchB.triangles){const points=t.points.map(v=>rotate(v,q[1]-angle).map((v,k)=>v+offset[k])),bounds=box(points);
      const visit=node=>{if(!intersects(bounds,node))return;if(node.triangles){for(const other of node.triangles)if(intersects(bounds,other))overlap+=triangleArea(points,other.points);}else{visit(node.left);visit(node.right);}};
      visit(trees[p.name]);
    }p.checks++;
    if(overlap>p.maximumArea){p.maximumArea=overlap;p.worst={time,q,label};}if(overlap>1e-10)p.failed++;}
}
for(let i=0;i<data.rows.length;i++){
  const r=data.rows[i];check(r.time,r.q,'knot');if(i){const before=data.rows[i-1];check((r.time+before.time)/2,r.q.map((v,k)=>(v+before.q[k])/2),'midpoint');}
  if(i%2000===0)console.log({knots:i,poses,pairs});
}
verifyStudySources(data.sources);verifyStudySources(sources);
const report={movement:86,status:'independent-cap-triangle-overlap-diagnostic',passed:pairs.every(p=>!p.failed),mechanicsPassed:false,candidateIntegrated:false,productionChanged:false,
  input,poses,pairs,controls,prisms:Object.fromEntries(names.map(n=>[n,prisms[n].validation])),sources,
  qualification:'Every rendered cap triangle, including the hole boundaries, is intersected independently at every saved knot and midpoint. Side triangles establish complete prisms. The area threshold is 1e-10 square model units. This catches edge crossings missed by vertex contacts, but is a sampled primary-pair screen, not a continuous clearance or complete-hardware proof.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});if(!report.passed)process.exitCode=1;
