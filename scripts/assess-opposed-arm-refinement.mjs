import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeOpposedArmCandidate} from './lib/opposed-arm-candidate.mjs';
const files=JSON.parse(process.env.PROBE_INPUTS??'["artifacts/review/079-load6-dynamics.json","artifacts/review/079-load6-fine.json","artifacts/review/079-load6-finer.json"]'),
 prefix=process.env.PROBE_PREFIX??'079-load6-refinement',studies=await Promise.all(files.map(async file=>JSON.parse(await readFile(file,'utf8')))),
 model=makeOpposedArmCandidate(studies[0].geometry),u=model.root.userData,sources=[],radii={wheel:0,upper:0,lower:0},comparisons=[];
for(const file of ['scripts/assess-opposed-arm-refinement.mjs','scripts/lib/opposed-arm-candidate.mjs',...files]){
 const bytes=await readFile(file),archive=`artifacts/review/${prefix}-geometry-source-${sources.length}.txt`;
 await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
for(const [name,mesh]of Object.entries(u.parts))if(Object.hasOwn(radii,u.families[name])){
 mesh.updateMatrix();const family=u.families[name],p=mesh.geometry.attributes.position;
 for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrix);radii[family]=Math.max(radii[family],family==='wheel'?Math.hypot(v.x,v.y):Math.hypot(v.y,v.z));}
}
const at=(rows,time)=>{
 let lo=0,hi=rows.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(rows[mid].time<time)lo=mid+1;else hi=mid;}
 if(lo===0)return rows[0].x;
 const a=rows[lo-1],b=rows[lo],t=Math.max(0,Math.min(1,(time-a.time)/(b.time-a.time)));return a.x.map((v,i)=>v+(b.x[i]-v)*t);
};
for(let index=1;index<studies.length;index++){
 const a=studies[index-1],b=studies[index];
 if(a.failures.length||b.failures.length)throw Error('Refinement includes a failed dynamics study');
 for(const key of ['period','stroke','gravity','spring','restBeta','damping','coulomb','inertia'])if(JSON.stringify(a.parameters[key])!==JSON.stringify(b.parameters[key]))throw Error('Different physics: '+key);
 if(JSON.stringify(a.geometry)!==JSON.stringify(b.geometry))throw Error('Different geometry');
 const start=Math.max(a.rows[0].time,b.rows[0].time),end=Math.min(a.rows.at(-1).time,b.rows.at(-1).time),
  times=[...new Set([...a.rows,...b.rows].map(r=>r.time).filter(t=>t>=start&&t<=end))].sort((a,b)=>a-b),
  maximum={wheel:{pixels:0},upper:{pixels:0},lower:{pixels:0}},steady={wheel:{pixels:0},upper:{pixels:0},lower:{pixels:0}};
 for(const time of times){
  const x=at(a.rows,time),y=at(b.rows,time);
  for(const [i,key]of ['wheel','upper','lower'].entries()){
   const angle=Math.abs(x[i]-y[i]);if(angle>Math.PI)throw Error('Large angle mismatch requires a different bound');
   const displacement=2*radii[key]*Math.sin(angle/2),pixels=displacement*u.geometry.scale,record={time,angle,displacement,pixels,a:x[i],b:y[i]};
   if(pixels>maximum[key].pixels)maximum[key]=record;if(time>=a.parameters.period&&pixels>steady[key].pixels)steady[key]=record;
  }
 }
 const maximumPixels=Math.max(...Object.values(maximum).map(v=>v.pixels)),maximumSteadyPixels=Math.max(...Object.values(steady).map(v=>v.pixels));
 comparisons.push({coarse:files[index-1],fine:files[index],dt:[a.dt,b.dt],start,end,unionKnots:times.length,maximum,steady,maximumPixels,maximumSteadyPixels,withinQuarterPixel:maximumPixels<=.25});
}
const passed=comparisons.every(v=>v.withinQuarterPixel),report={movement:79,status:passed?'spatial-refinement-passed':'spatial-refinement-needs-smaller-steps',productionChanged:false,mechanicsPassed:false,passed,radii,comparisons,sources,
 qualification:'Maximum separation of the two piecewise-linear angle trajectories is evaluated at every knot in their union. Prescribed linkage poses are identical at matched times. The exact rotation chord bound applies to every wheel/pawl vertex and every interval between those knots. This bounds differences between numerical trajectories; it is not a formal continuum error estimate, energy pass or collision certificate.'};
await writeFile(`artifacts/review/${prefix}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed,radii,comparisons:comparisons.map(v=>({dt:v.dt,maximumPixels:v.maximumPixels,maximumSteadyPixels:v.maximumSteadyPixels,unionKnots:v.unionKnots}))});if(!passed)process.exitCode=1;
