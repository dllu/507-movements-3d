import fs from 'node:fs';
import crypto from 'node:crypto';
import {makePullPawlCandidate} from './lib/pull-pawl-candidate.mjs';
const files=JSON.parse(process.env.PROBE_FILES??'["artifacts/review/078-amplitude-038.json","artifacts/review/078-amplitude-038-fine.json","artifacts/review/078-amplitude-038-finer.json"]'),
 data=files.map(f=>JSON.parse(fs.readFileSync(f))),model=makePullPawlCandidate(data[0].geometry),u=model.root.userData,p=u.geometry,radius={};
for(const [name,mesh]of Object.entries(u.parts)){
 const family=u.families[name];if(family==='fixed')continue;const positions=mesh.geometry.attributes.position;
 for(let i=0;i<positions.count;i++)radius[family]=Math.max(radius[family]??0,Math.hypot(positions.getX(i)+mesh.position.x,positions.getY(i)+mesh.position.y));
}
const chord=(r,angle)=>2*r*Math.sin(Math.min(Math.PI,Math.abs(angle))/2),comparisons=[];
for(let pair=0;pair<2;pair++){
 const coarse=data[pair],fine=data[pair+1],maxima=Object.fromEntries(['wheel','lever','left','right'].map(k=>[k,{error:0}]));
 for(let i=0;i<fine.rows.length;i++){
  const row=fine.rows[i],index=i*fine.dt/coarse.dt,low=Math.floor(index),high=Math.min(coarse.rows.length-1,low+1),f=index-low,
   a=coarse.rows[low],b=coarse.rows[high],q=a.q+(b.q-a.q)*f,x=a.x.map((v,k)=>v+(b.x[k]-v)*f),dq=q-row.q,
   errors={wheel:chord(radius.wheel,x[0]-row.x[0]),lever:chord(radius.lever,dq)};
  for(const [j,key]of ['left','right'].entries())errors[key]=chord(Math.hypot(...p.arms[key]),dq)+chord(radius[key],x[j+1]-row.x[j+1]);
  for(const [key,error]of Object.entries(errors))if(error>maxima[key].error)maxima[key]={error,sourcePixels:error*p.scale,index:i,time:row.time};
 }
 comparisons.push({coarse:files[pair],fine:files[pair+1],coarseStep:coarse.dt,fineStep:fine.dt,maxima,maximumSourcePixels:Math.max(...Object.values(maxima).map(v=>v.error*p.scale))});
}
const cycles=data.map((d,index)=>({file:files[index],rows:d.rows.length,dt:d.dt,cycles:Array.from({length:Math.floor(d.duration/d.parameters.period)},(_,cycle)=>{
 const start=Math.round(cycle*d.parameters.period/d.dt),end=Math.round((cycle+1)*d.parameters.period/d.dt);let forward=0,reverse=0,stopped=0;
 for(let i=start+1;i<=end;i++){const delta=d.rows[i].x[0]-d.rows[i-1].x[0];if(delta<0)forward-=delta;else reverse+=delta;if(Math.abs(d.rows[i].v[0])<1e-5)stopped++;}
 return{cycle,netClockwisePitches:(d.rows[start].x[0]-d.rows[end].x[0])/p.pitch,forwardPitches:forward/p.pitch,reversePitches:reverse/p.pitch,stoppedFraction:stopped/(end-start)};
})})),toleranceSourcePixels=.25,
 report={movement:78,status:'observed-spatial-refinement',passed:comparisons.at(-1).maximumSourcePixels<=toleranceSourcePixels,productionChanged:false,mechanicsPassed:false,
  toleranceSourcePixels,radius,comparisons,cycles,
  qualification:'Compare the complete first two cycles at every finer knot against linear interpolation of the coarser trajectory. Chord bounds use actual Float32 mesh radii and moving-pivot arm lengths. This measures observed step refinement, not a proof of exact dynamics, conservative interpolation or energy balance.',
  sources:[...files,'scripts/assess-pull-pawl-convergence.mjs','scripts/lib/pull-pawl-candidate.mjs'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(process.env.PROBE_OUTPUT??'artifacts/review/078-convergence.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({passed:report.passed,comparisons:comparisons.map(r=>({coarse:r.coarseStep,fine:r.fineStep,max:r.maximumSourcePixels})),finestCycles:cycles.at(-1).cycles});
if(!report.passed)process.exitCode=1;
