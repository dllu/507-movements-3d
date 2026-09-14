import fs from 'node:fs';
import assert from 'node:assert/strict';
import {cordSelfClearance} from './lib/bow-drill-cord-distance.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const input=process.env.REPORT??'/dev/shm/126-dynamics-j.json',prefix=process.env.PROBE_PREFIX??'/dev/shm/126-cord-clearance';
const sources=freezeStudySources(['scripts/audit-bell-crank-cords.mjs','scripts/lib/bow-drill-cord-distance.mjs','scripts/lib/study-report-io.mjs',input],prefix);
const dynamics=JSON.parse(fs.readFileSync(input)),radius=dynamics.options.cordRadius??8.430555555555555/100;
assert.equal(dynamics.failure,null);assert.equal(dynamics.timeResets,0);assert(dynamics.completedTime>=dynamics.duration-1e-8);
const minimumGaps={input:Infinity,output:Infinity},minimumBendRadii={input:Infinity,output:Infinity},rows=[];
for(const row of dynamics.rows){
 const cords={};
 for(const[name,points]of Object.entries(row.cords)){
  const sections=points.slice(1).map((p,i)=>[points[i],p]),clearance=cordSelfClearance(sections,radius,{excludedArc:2.2*radius});
  minimumGaps[name]=Math.min(minimumGaps[name],clearance.gap);let minimumBendRadius=Infinity;
  for(let i=1;i<points.length-1;i++){
   const a=points[i].map((v,k)=>v-points[i-1][k]),b=points[i+1].map((v,k)=>v-points[i][k]);
   const cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],area=Math.hypot(...cross);
   if(area>1e-14)minimumBendRadius=Math.min(minimumBendRadius,Math.hypot(...a)*Math.hypot(...b)*Math.hypot(...a.map((v,k)=>v+b[k]))/(2*area));
  }
  minimumBendRadii[name]=Math.min(minimumBendRadii[name],minimumBendRadius);cords[name]={...clearance,minimumBendRadius};
 }
 rows.push({time:row.time,cords});
}
const report={sources,input,radius,minimumGaps,minimumBendRadii,rows,qualification:'Nonlocal centerline-segment capsules enclose each rendered tube span. Positive separation excludes intersection between the tested spans. Pairs separated by less than 2.2 rope radii of intervening arclength are excluded as local neighbors. Three-point bend radius is a local curvature diagnostic, not a proof of local tube injectivity. Uses 20 ms native samples; continuous-time clearance is not established.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({rows:rows.length,minimumGaps,minimumBendRadii});
assert(Object.values(minimumGaps).every(gap=>gap>=0),'Nonlocal cord envelope overlap');assert(Object.values(minimumBendRadii).every(r=>r>radius),'Local bend radius below cord radius');
